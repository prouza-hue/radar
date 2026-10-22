import type {Episode, Title} from "./types";

export type EpisodeIdentity = {season: number; number: number};
export type Timeline = {episodes: Episode[]; complete: boolean};
export type ProgressInput = {
  title?: Pick<Title, "type" | "status"> | null;
  watched?: EpisodeIdentity[];
  timeline?: Timeline | null;
  movieSeen?: boolean;
  progressLimited?: boolean;
};

export function progressOf(row: ProgressInput, day: string) {
  const watched = new Set((row.watched || []).map(e => `${e.season}:${e.number}`));
  const unique = new Map<string, Episode>();
  for (const e of row.timeline?.episodes || []) {
    if (e.season > 0 && e.number > 0) unique.set(`${e.season}:${e.number}`, e);
  }
  const episodes = [...unique.values()].sort((a, b) => a.season - b.season || a.number - b.number);
  const released = episodes.filter(e => e.date && e.date.slice(0, 10) <= day);
  const missing = released.filter(e => !watched.has(`${e.season}:${e.number}`));
  const complete = !!row.timeline?.complete && !row.progressLimited;
  const started = watched.size > 0;
  const caughtUp = complete && released.length > 0 && !missing.length;
  const status = row.title?.type === "movie" ? (row.movieSeen ? "seen" : "want")
    : started ? (caughtUp ? "seen" : "watching") : "want";
  return {
    status, started, seenCount: watched.size, released: released.length,
    missing: missing.length, nextToWatch: missing[0] || null, complete,
    caughtUp,
  };
}

export type DashboardKind = "catchup" | "ready" | "upcoming" | null;
export function dashboardKind(row: {
  saved?: boolean;
  movieSeen?: boolean;
  title: Pick<Title, "type" | "premiere" | "next">;
  progress: ReturnType<typeof progressOf>;
}, day: string): DashboardKind {
  if (row.saved === false || row.movieSeen) return null;
  if (row.title.type === "movie") {
    if (row.title.premiere && row.title.premiere.slice(0, 10) > day) return "upcoming";
    return "ready";
  }
  if (row.progress.started && row.progress.nextToWatch) return "catchup";
  if (!row.progress.started && row.progress.released > 0) return "ready";
  if (row.title.next?.date && row.title.next.date.slice(0, 10) >= day) return "upcoming";
  return null;
}

export type TasteSeed = {
  titleKey: string;
  addedAt: number;
  title: Pick<Title, "type" | "genres">;
};

/** Use the wider positive profile but keep external recommendation calls bounded.
 * Recent likes matter, while genre novelty and media balance prevent the last
 * six clicks from becoming the whole definition of the user's taste.
 */
export function selectRecommendationSeeds<T extends TasteSeed>(items: T[], max = 8): T[] {
  const ordered = [...items].sort((a, b) => b.addedAt - a.addedAt || a.titleKey.localeCompare(b.titleKey));
  const remaining = [...ordered], selected: T[] = [];
  const genreCounts = new Map<string, number>(), mediaCounts = new Map<string, number>();
  while (remaining.length && selected.length < max) {
    let bestIndex = 0, bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i], originalIndex = ordered.indexOf(item);
      const genres = [...new Set(item.title.genres || [])];
      const novelty = genres.length
        ? genres.reduce((sum, genre) => sum + 1 / (1 + (genreCounts.get(genre) || 0)), 0) / genres.length
        : 0;
      const mediaBalance = 1 / (1 + (mediaCounts.get(item.title.type) || 0));
      const recency = ordered.length <= 1 ? 1 : 1 - originalIndex / (ordered.length - 1);
      const score = novelty * 1.8 + mediaBalance * .65 + recency * .45;
      if (score > bestScore || (score === bestScore && item.titleKey < remaining[bestIndex].titleKey)) {
        bestScore = score; bestIndex = i;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    selected.push(next);
    mediaCounts.set(next.title.type, (mediaCounts.get(next.title.type) || 0) + 1);
    for (const genre of new Set(next.title.genres || [])) genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
  }
  return selected;
}

/** Source relevance leads; well-supported quality and shared genres refine it.
 * No release-year boost: an older candidate competes on exactly the same terms.
 * Keep a bounded pool so a film/series filter can use the same cached response.
 */
export function rankRecommendations(items: any[], excluded: string[]) {
  const skip = new Set(excluded), candidates = new Map<string, any>();
  for (const item of items) {
    if (!item?.title?.key || skip.has(item.title.key)) continue;
    const rating = item.title.ratings?.[0];
    const votes = Math.max(0, rating?.votes || 0);
    const value = rating ? rating.value * 10 / (rating.scale || 10) : 6.6;
    if (votes >= 100 && value < 6.2) continue;
    const quality = (votes * value + 250 * 6.6) / (votes + 250);
    const relevance = .9 / (1 + Math.max(0, item.rank || 0) / 12);
    const genreMatch = Math.max(0, Math.min(1, item.genreOverlap || 0));
    const score = relevance + quality * .6 + genreMatch * .65
      - Math.max(0, 6.7 - quality) * 1.4
      + Math.min(item.title.popularity || 0, 100) / 2500;
    const old = candidates.get(item.title.key);
    const support = {key: item.seed, name: item.seedName, kind: item.kind};
    if (old) {
      const supports = old.supports.some((s: any) => s.key === item.seed) ? old.supports : [...old.supports, support];
      if (score > old.baseScore) candidates.set(item.title.key, {...item, baseScore: score, supports});
      else old.supports = supports;
    } else candidates.set(item.title.key, {...item, baseScore: score, supports: [support]});
  }
  const pool = [...candidates.values()].map(item => {
    const names = item.supports.filter((s: any) => s.kind === "similar" && s.name).map((s: any) => s.name);
    return {
      ...item, seeds: item.supports.map((s: any) => s.key),
      score: item.baseScore + (item.supports.length - 1) * .65,
      reason: item.kind === "similar" && names.length > 1
        ? `Podobné jako ${names.slice(0, 2).join(" a ")}` : item.reason,
    };
  });
  const chosen: any[] = [], counts = new Map<string, number>();
  const takeBest = (predicate: (item: any) => boolean = () => true) => {
    pool.sort((a, b) => (b.score - (counts.get(b.seed) || 0) * .3)
      - (a.score - (counts.get(a.seed) || 0) * .3) || a.title.key.localeCompare(b.title.key));
    const index = pool.findIndex(predicate);
    if (index < 0) return false;
    const [next] = pool.splice(index, 1);
    chosen.push(next);
    counts.set(next.seed, (counts.get(next.seed) || 0) + 1);
    return true;
  };
  // If the candidate pool genuinely spans both media, preserve a small
  // evaluation set for each. Otherwise a large same-media pool can make the
  // Filmy/Seriály filter look empty even when relevant cross-media candidates exist.
  const media = ["tv", "movie"].filter(type => pool.some(item => item.title.type === type));
  if (media.length > 1) {
    for (let round = 0; round < 6 && chosen.length < 24; round++) {
      for (const type of media) if (chosen.length < 24) takeBest(item => item.title.type === type);
    }
  }
  while (pool.length && chosen.length < 24) takeBest();
  return chosen;
}
