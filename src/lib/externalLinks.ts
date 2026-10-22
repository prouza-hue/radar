import type {Title} from "./types";

export type ExternalTitleLink = {
  key: "tmdb" | "imdb" | "csfd" | "rt";
  label: string;
  href: string;
  direct: boolean;
};

function query(title: string, year?: string) {
  return [title, year].filter(Boolean).join(" ").trim();
}

export function externalTitleLinks(title: Pick<Title, "source" | "type" | "id" | "name" | "originalName" | "year" | "imdbId">): ExternalTitleLink[] {
  const globalTitle = title.originalName || title.name;
  const globalQuery = query(globalTitle, title.year);
  const czechQuery = query(title.name, title.year);
  const tmdbDirect = title.source === "tmdb";
  const imdbDirect = !!title.imdbId && /^tt\d+$/.test(title.imdbId);

  return [
    {
      key: "tmdb",
      label: "TMDB",
      href: tmdbDirect
        ? `https://www.themoviedb.org/${title.type}/${title.id}`
        : `https://www.themoviedb.org/search?query=${encodeURIComponent(globalQuery)}`,
      direct: tmdbDirect,
    },
    {
      key: "imdb",
      label: "IMDb",
      href: imdbDirect
        ? `https://www.imdb.com/title/${title.imdbId}/`
        : `https://www.imdb.com/find/?q=${encodeURIComponent(globalQuery)}&s=tt`,
      direct: imdbDirect,
    },
    {
      key: "csfd",
      label: "ČSFD",
      href: `https://www.csfd.cz/hledat/?q=${encodeURIComponent(czechQuery)}`,
      direct: false,
    },
    {
      key: "rt",
      label: "Rotten Tomatoes",
      href: `https://www.rottentomatoes.com/search?search=${encodeURIComponent(globalQuery)}`,
      direct: false,
    },
  ];
}
