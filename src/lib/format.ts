import type {Title} from "./types";

export const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export function plural(count: number, one: string, few: string, many: string) {
  return new Intl.PluralRules("cs-CZ").select(count) === "one" ? one
    : new Intl.PluralRules("cs-CZ").select(count) === "few" ? few : many;
}
export const episodeCount = (n: number) => `${n} ${plural(n, "díl", "díly", "dílů")}`;
export const seenCount = (n: number) => `${n} ${plural(n, "viděný díl", "viděné díly", "viděných dílů")}`;

export function relative(date: string | null) {
  if (!date || !Number.isFinite(Date.parse(date.slice(0, 10)))) return "Datum zatím neznáme";
  const delta = Math.round((Date.parse(date.slice(0, 10)) - Date.parse(today())) / 86400000);
  if (delta === 0) return "Dnes";
  if (delta === 1) return "Zítra";
  if (delta === -1) return "Včera";
  if (delta < 0) return "Už vyšlo";
  if (delta <= 6) return `Za ${delta} ${plural(delta, "den", "dny", "dní")}`;
  return fullDate(date);
}
export function fullDate(date: string | null) {
  if (!date || !Number.isFinite(Date.parse(date.slice(0, 10)))) return "Termín nebyl oznámen";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(date.slice(0, 10) + "T12:00:00Z"));
}
export const episodeCode = (s: number, n: number) => `S${String(s).padStart(2, "0")}E${String(n).padStart(2, "0")}`;
export function titleDate(t: Title) { return t.type === "tv" ? t.next?.date || null : t.premiere; }
export function statusText(t: Title) {
  if (t.type === "movie") return t.premiere ? relative(t.premiere) : "Čekáme na termín";
  if (t.next?.date) return relative(t.next.date);
  if (["Ended", "Canceled", "Cancelled"].includes(t.status)) return t.status === "Ended" ? "Seriál ukončen" : "Seriál zrušen";
  return "Čekáme na další díl";
}
