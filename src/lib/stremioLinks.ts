import type {Title} from "./types";

export type StremioTitle = Pick<Title, "type" | "imdbId" | "name" | "originalName">;
export type StremioLinkTarget = {
  href: string;
  mode: "detail" | "search";
  label: string;
  description: string;
};

/** Official native-page scheme, shared by desktop and Android:
 * https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deep-links.md
 * https://github.com/Stremio/stremio-core/blob/master/src/deep_links/mod.rs
 * Radar's "tv" is an episodic series, not Stremio's live-TV "tv" type.
 * A metadata detail has no video ID, stream or autoplay instruction.
 */
export function stremioTitleLink(title: StremioTitle): StremioLinkTarget | null {
  if (title.type !== "movie" && title.type !== "tv") return null;
  const imdbId = typeof title.imdbId === "string" ? title.imdbId.trim() : "";
  if (/^tt[0-9]+$/.test(imdbId)) {
    const type = title.type === "tv" ? "series" : "movie";
    return {
      href: `stremio:///detail/${type}/${imdbId}`,
      mode: "detail",
      label: "Otevřít ve Stremiu",
      description: "Otevřít detail titulu v nainstalované aplikaci Stremio",
    };
  }
  // Without a verified IMDb ID, never pretend that a TMDB/TVmaze numeric ID is
  // a Cinemeta ID. The fallback is explicitly labelled as search, not detail.
  const original = typeof title.originalName === "string" ? title.originalName.trim() : "";
  const name = typeof title.name === "string" ? title.name.trim() : "";
  const query = original || name;
  if (!query) return null;
  return {
    href: `stremio:///search?search=${encodeURIComponent(query)}`,
    mode: "search",
    label: "Vyhledat ve Stremiu",
    description: "Chybí ověřené IMDb ID. Ve Stremiu se vyhledá název titulu.",
  };
}
