import copy
import json
import tempfile
import unittest
from pathlib import Path
from prepare_personal_import import prepare, validate


def fixture():
    return {
        "schema": "radar-personal-state", "schemaVersion": 1, "scope": "current-personal-state",
        "exportedAt": "2026-10-22T12:00:00.000Z",
        "counts": {"titles": 1, "saved": 1, "liked": 1, "hidden": 0, "seenMovies": 0, "watchedEpisodes": 2},
        "records": [{"titleKey": "tmdb:tv:95396", "addedAt": 1234, "saved": True,
                     "liked": True, "hidden": False, "movieSeen": False, "notifications": True,
                     "watched": [{"season": 1, "number": 1}, {"season": 1, "number": 3}]}],
    }


class ImportTests(unittest.TestCase):
    def test_keeps_every_episode_and_original_added_time(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "private-restore"
            result = prepare(fixture(), "n17newactualuserid123456789", path)
            self.assertEqual(result["files"]["watched_episodes.jsonl"]["rows"], 2)
            row = json.loads((path / "user_titles.jsonl").read_text())
            self.assertEqual(row["addedAt"], 1234)
            self.assertEqual(row["userId"], "n17newactualuserid123456789")
            self.assertTrue(row["notifications"])
            self.assertEqual(path.stat().st_mode & 0o777, 0o700)
            self.assertEqual((path / "user_titles.jsonl").stat().st_mode & 0o777, 0o600)
    def test_wrong_counts(self):
        data = fixture(); data["counts"]["watchedEpisodes"] = 1
        with self.assertRaisesRegex(ValueError, "count mismatch"): validate(data)
    def test_duplicate_episode(self):
        data = fixture(); data["records"][0]["watched"].append({"season": 1, "number": 1})
        with self.assertRaisesRegex(ValueError, "Duplicate watched"): validate(data)
    def test_duplicate_title(self):
        data = fixture(); data["records"].append(copy.deepcopy(data["records"][0]))
        with self.assertRaisesRegex(ValueError, "Duplicate title"): validate(data)
    def test_missing_flag(self):
        data = fixture(); del data["records"][0]["liked"]
        with self.assertRaisesRegex(ValueError, "Missing boolean"): validate(data)
    def test_not_an_email_user_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, "ACTUAL"):
                prepare(fixture(), "me@example.com", Path(tmp) / "out")
    def test_refuses_existing_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, "already exists"):
                prepare(fixture(), "n17newactualuserid123456789", Path(tmp))
    def test_requires_known_format(self):
        data = fixture(); data["schema"] = "random"
        with self.assertRaisesRegex(ValueError, "schema version"): validate(data)
    def test_movies_cannot_have_episodes(self):
        data = fixture(); data["records"][0]["titleKey"] = "tmdb:movie:1"
        with self.assertRaisesRegex(ValueError, "film cannot"): validate(data)
    def test_invalid_export_time(self):
        data = fixture(); data["exportedAt"] = "never"
        with self.assertRaisesRegex(ValueError, "timestamp"): validate(data)


if __name__ == "__main__": unittest.main()
