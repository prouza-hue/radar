#!/usr/bin/env python3
"""Validate a Radar personal-state backup and prepare an EMPTY Convex restore.
No network calls; never imports, appends, replaces or modifies a live database.
The backup contains current watch flags, not original episode-watch timestamps.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
from typing import Any

KEY = re.compile(r"^(tmdb:(?:tv|movie)|tvmaze:tv):[0-9]+$")
FLAGS = ("saved", "liked", "hidden", "movieSeen", "notifications")


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def validate(data: Any) -> tuple[list[dict[str, Any]], int]:
    require(isinstance(data, dict), "Backup must be a JSON object.")
    require(data.get("schema") == "radar-personal-state" and data.get("schemaVersion") == 1,
            "Expected radar-personal-state schema version 1.")
    require(data.get("scope") == "current-personal-state", "Unknown export scope.")
    try:
        stamp = dt.datetime.fromisoformat(data["exportedAt"].replace("Z", "+00:00"))
        require(stamp.tzinfo is not None, "Export time must include its timezone.")
        timestamp = int(stamp.timestamp() * 1000)
        require(timestamp >= 0, "Invalid export timestamp.")
    except (KeyError, TypeError, AttributeError, ValueError) as exc:
        raise ValueError("Missing or invalid export timestamp.") from exc
    rows = data.get("records")
    require(isinstance(rows, list), "Missing records array.")
    require(len(rows) <= 100000, "Too many records.")
    keys: set[str] = set()
    counts = dict(titles=len(rows), saved=0, liked=0, hidden=0, seenMovies=0, watchedEpisodes=0)
    for row in rows:
        require(isinstance(row, dict), "Invalid title record.")
        key = row.get("titleKey")
        require(isinstance(key, str) and bool(KEY.fullmatch(key)), "Invalid title identity.")
        require(key not in keys, f"Duplicate title: {key}")
        keys.add(key)
        for flag in FLAGS:
            require(type(row.get(flag)) is bool, f"Missing boolean {flag}: {key}")
        added = row.get("addedAt")
        require(type(added) in (int, float) and math.isfinite(added) and added >= 0,
                f"Missing or invalid original added date: {key}")
        watched = row.get("watched")
        require(isinstance(watched, list), f"Missing watched episodes: {key}")
        identities: set[tuple[int, int]] = set()
        for ep in watched:
            require(isinstance(ep, dict), f"Invalid episode: {key}")
            season, number = ep.get("season"), ep.get("number")
            require(type(season) is int and 0 <= season <= 200 and type(number) is int
                    and 0 <= number <= 1000, f"Invalid episode number: {key}")
            pair = (season, number)
            require(pair not in identities, f"Duplicate watched episode: {key} {pair}")
            identities.add(pair)
        require(":movie:" not in key or not watched, f"A film cannot have episode history: {key}")
        require(":tv:" not in key or not row["movieSeen"], f"A series cannot use film-seen flag: {key}")
        counts["saved"] += row["saved"]
        counts["liked"] += row["liked"]
        counts["hidden"] += row["hidden"]
        counts["seenMovies"] += row["movieSeen"]
        counts["watchedEpisodes"] += len(watched)
    supplied = data.get("counts")
    require(isinstance(supplied, dict), "Missing backup counts.")
    for key, count in counts.items():
        require(type(supplied.get(key)) is int and supplied[key] == count,
                f"Backup count mismatch: {key}")
    return rows, timestamp


def prepare(data: Any, target_user_id: str, output: Path) -> dict[str, Any]:
    require(bool(re.fullmatch(r"[A-Za-z0-9]{16,80}", target_user_id)),
            "Provide the ACTUAL new Convex users._id, never an email or a guessed identity.")
    rows, timestamp = validate(data)
    require(not output.exists(), "Output directory already exists; refusing to overwrite.")
    output.mkdir(parents=True, mode=0o700)
    os.chmod(output, 0o700)
    relations, episodes = [], []
    for row in sorted(rows, key=lambda r: r["titleKey"]):
        relations.append({"userId": target_user_id, "titleKey": row["titleKey"],
                          "addedAt": row["addedAt"], "revision": 0,
                          **{key: row[key] for key in FLAGS}})
        for ep in row["watched"]:
            episodes.append({"userId": target_user_id, "titleKey": row["titleKey"],
                             "season": ep["season"], "episode": ep["number"],
                             "watched": True, "watchedAt": timestamp})
    artifacts = {}
    for name, records in (("user_titles.jsonl", relations), ("watched_episodes.jsonl", episodes)):
        payload = "".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n"
                          for row in records).encode()
        p = output / name
        p.write_bytes(payload)
        os.chmod(p, 0o600)
        artifacts[name] = {"rows": len(records), "sha256": hashlib.sha256(payload).hexdigest()}
    report = {
        "kind": "restore-plan-not-executed", "schemaVersion": 1,
        "targetUserId": target_user_id, "requiresEmptyTables": True,
        "counts": data["counts"], "files": artifacts,
        "warnings": [
            "Use only on a NEW destination with EMPTY user_titles and watched_episodes tables.",
            "Never use --append, --replace or --replace-all on the live source database.",
            "Sign in to the destination first; confirm its actual user identity and deployment.",
            "Original watchedAt is not exposed by the personal export. The export timestamp is a restoration marker, NOT an original viewing date.",
            "No auth sessions, provider secrets, push subscriptions, original deleted watch rows or full database backup are included.",
            "Load/rebuild title metadata and follower counts on the destination, then compare every exported flag and episode before switching clients.",
        ],
    }
    p = output / "RESTORE_PLAN.json"
    p.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.chmod(p, 0o600)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", type=Path)
    parser.add_argument("--target-user-id", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        require(args.backup.stat().st_size <= 100_000_000, "Backup too large.")
        data = json.loads(args.backup.read_text(encoding="utf-8"))
        result = prepare(data, args.target_user_id, args.out)
    except (OSError, ValueError, TypeError) as exc:
        parser.exit(1, f"Restore preparation stopped: {exc}\n")
    print(f"Prepared {result['counts']['titles']} titles and {result['counts']['watchedEpisodes']} watched episodes. Nothing was imported.")
    print(f"Review {args.out / 'RESTORE_PLAN.json'} before using any database CLI.")


if __name__ == "__main__":
    main()
