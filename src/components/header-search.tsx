import {useEffect, useRef, useState} from "react";
import {Link} from "@tanstack/react-router";
import {Search, X} from "lucide-react";

export type SearchInputState = {query: string; onChange: (value: string) => void; ready: boolean};
type SearchReturn = {path: "/" | "/hot" | "/mine" | "/title"; key?: string};
const INPUT_ID = "radar-search-input";

export function readSearchReturn(value: string | null): SearchReturn {
  try {
    const stored = JSON.parse(value || "null");
    if (!stored || Date.now() - stored.createdAt > 3600000) return {path: "/"};
    if (["/", "/hot", "/mine"].includes(stored.path)) return {path: stored.path};
    if (stored.path === "/title" && /^(tmdb:(tv|movie)|tvmaze:tv):\d+$/.test(stored.key || "")) return {path: "/title", key: stored.key};
  } catch { /* Untrusted or stale storage is not a navigation target. */ }
  return {path: "/"};
}
export function rememberSearchEntry() {
  try {
    if (location.pathname !== "/search") {
      sessionStorage.setItem("radar-search-origin", JSON.stringify({path: location.pathname, key: new URLSearchParams(location.search).get("key"), createdAt: Date.now()}));
      sessionStorage.setItem("radar-scroll:" + location.pathname, String(scrollY));
    }
    sessionStorage.setItem("radar-search-focus", "1");
  } catch { /* Search remains usable without storage. */ }
}
export function HeaderSearchToggle({expanded}: {expanded: boolean}) {
  const icon = <Search size={21}/>;
  return expanded
    ? <button type="button" className="header-search-toggle" data-testid="header-search-toggle" aria-label="Přejít do hledání" aria-expanded="true" aria-controls={INPUT_ID}
        onClick={() => document.getElementById(INPUT_ID)?.focus()}>{icon}</button>
    : <Link to="/search" className="header-search-toggle" data-testid="header-search-toggle" aria-label="Hledat film nebo seriál" aria-expanded="false"
        onClick={rememberSearchEntry}>{icon}</Link>;
}
export function HeaderSearchField({query, onChange, ready}: SearchInputState) {
  const input = useRef<HTMLInputElement>(null), close = useRef<HTMLAnchorElement>(null), focused = useRef(false);
  const [origin, setOrigin] = useState<SearchReturn>({path: "/"});
  useEffect(() => {
    try {setOrigin(readSearchReturn(sessionStorage.getItem("radar-search-origin")));} catch { /* Home is the fallback. */ }
  }, []);
  useEffect(() => {
    if (!ready || focused.current) return;
    focused.current = true;
    let requested = !query;
    try {requested ||= sessionStorage.getItem("radar-search-focus") === "1"; sessionStorage.removeItem("radar-search-focus");} catch { /* Focus empty direct search. */ }
    if (requested) input.current?.focus({preventScroll: true});
  }, [ready, query]);
  return <form className="header-search-field" role="search" data-testid="header-search-field" onSubmit={event => {event.preventDefault(); input.current?.blur();}}>
    <Search size={20} aria-hidden="true"/>
    <input ref={input} id={INPUT_ID} data-testid="search" type="search" value={query} onChange={event => onChange(event.target.value)}
      placeholder="Najdi film nebo seriál…" aria-label="Najdi film nebo seriál" autoComplete="off" spellCheck={false} enterKeyHint="search"
      onKeyDown={event => {if (event.key === "Escape") {event.preventDefault(); close.current?.click();}}}/>
    <Link ref={close} to={origin.path} search={origin.path === "/title" ? {key: origin.key!} : undefined} resetScroll={false}
      className="header-search-close" data-testid="header-search-close" aria-label="Zavřít hledání" title="Zavřít hledání"><X size={20}/></Link>
  </form>;
}
