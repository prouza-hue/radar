import type {Title} from "./types";

export function visibleDiscoveryTitles(
  titles: Title[],
  hidden: Iterable<string>,
  filter: "all" | "tv" | "movie" = "all",
  limit = 24,
) {
  const blocked = hidden instanceof Set ? hidden : new Set(hidden);
  return titles
    .filter(title => !blocked.has(title.key))
    .filter(title => filter === "all" || title.type === filter)
    .slice(0, limit);
}
