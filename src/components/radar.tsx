import {useEffect, useRef, useState} from "react";
import {Link} from "@tanstack/react-router";
import {useAction, usePaginatedQuery, useQuery, Authenticated, Unauthenticated, AuthLoading} from "convex/react";
import {Radar as RadarIcon, House, Flame, Search, Bookmark, ArrowUpRight, ArrowRight, SlidersHorizontal, Film, Info, RefreshCw} from "lucide-react";
import {api} from "../../convex/_generated/api";
import type {Title} from "@/lib/types";
import {plural} from "@/lib/format";
import {visibleDiscoveryTitles} from "@/lib/discovery";
import {ThemeToggle, TitleLink, PersonalButton, restoreScroll} from "./personal-controls";
import {HeaderSearchToggle, HeaderSearchField, rememberSearchEntry} from "./header-search";
import type {SearchInputState} from "./header-search";
import {PersonalRadar, Recommendations} from "./personal-radar";
import AuthDialog from "./auth-dialog";

export type View = "home" | "hot" | "search" | "mine";
export function Shell({children, view, search}: {children: React.ReactNode; view?: View; search?: SearchInputState}) {
  const [auth, setAuth] = useState(false);
  useEffect(() => {if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});}, []);
  const navigation = [
    {to: "/", name: "Domů", icon: House, id: "home"}, {to: "/hot", name: "Objevuj", icon: Flame, id: "hot"},
    {to: "/search", name: "Hledat", icon: Search, id: "search"}, {to: "/mine", name: "Moje", icon: Bookmark, id: "mine"},
  ] as const;
  const links = (mobile: boolean) => navigation.map(n => <Link key={n.id} to={n.to} className={view === n.id ? "active" : ""} aria-current={view === n.id ? "page" : undefined}
    onClick={n.id === "search" ? rememberSearchEntry : undefined}>
    <n.icon size={mobile ? 22 : 17}/><span>{n.name}</span></Link>);
  return <div className="app-shell compact-radar" data-testid="radar-app" data-ui-revision="compact-header-cards-1">
    <header className={`topbar ${search ? "search-expanded" : ""}`}><div className="header-row">
      <div className="brand-search"><Link to="/" className="brand" aria-label="Radar domů"><RadarIcon strokeWidth={1.65}/><span>radar<span className="brand-dot">.</span></span></Link>
        <HeaderSearchToggle expanded={!!search}/></div>
      <nav className="desktop-nav" aria-label="Hlavní navigace">{links(false)}</nav>
      <div className="account"><ThemeToggle/>
        <Authenticated><Link className="avatar" to="/account" aria-label="Nastavení účtu" title="Nastavení účtu"><SlidersHorizontal size={18}/></Link></Authenticated>
        <Unauthenticated><button className="login" onClick={() => setAuth(true)} aria-label="Přihlásit se"><span>Přihlásit se</span><ArrowUpRight size={15}/></button></Unauthenticated>
        <AuthLoading><span className="skeleton account-skeleton"/></AuthLoading>
      </div></div>{search && <HeaderSearchField {...search}/>}</header>
    <main className={`page-main page-${view || "other"}`}>{children}</main>
    <footer><span>radar. <span className="muted">Méně hledání. Více sledování.</span></span><Link to="/about">Zdroje a informace <Info size={14}/></Link></footer>
    <nav className="mobile-nav" aria-label="Mobilní navigace">{links(true)}</nav><AuthDialog open={auth} onClose={() => setAuth(false)}/>
  </div>;
}
export function Rating({title}: {title: Title}) {
  const rating = title.ratings[0];
  return rating ? <span className="rating"><span>{rating.source}</span><b>{rating.value.toFixed(1)}</b></span> : null;
}
export function PosterCard({title: t, compact = false, allowHide = false}: {title: Title; compact?: boolean; allowHide?: boolean}) {
  return <article className={`poster-card ${compact ? "compact" : ""}`} data-title={t.key}>
    <div className="poster-wrap"><TitleLink titleKey={t.key} className="poster-link" aria-label={`Detail: ${t.name}`}>
      {t.poster ? <img src={t.poster} alt={t.name} loading="lazy"/> : <div className="poster-missing"><Film size={32}/></div>}
      {t.hotReason && <span className="poster-tag">{t.hotReason}</span>}</TitleLink>
      <div className="card-actions" role="group" aria-label={`Rychlé akce: ${t.name}`}>
        <PersonalButton titleKey={t.key} compact/><PersonalButton titleKey={t.key} field="liked" compact/>{allowHide && <PersonalButton titleKey={t.key} field="hidden" compact/>}
      </div>
    </div>
    <div className="card-copy"><div className="card-title-row"><TitleLink titleKey={t.key}><h3>{t.name}</h3></TitleLink>
      {t.originalName && t.originalName !== t.name && <p className="original-card-title">{t.originalName}</p>}<Rating title={t}/></div>
      <p className="card-meta">{[t.year, t.type === "movie" ? "Film" : "Seriál"].filter(Boolean).join(" · ")}
        {t.availability.filter(a => a.region === "CZ" && a.type === "subscription").slice(0, 2).map(a => <span key={a.name}> · {a.name}</span>)}</p>
      {t.hotReason && <span className="tile-reason">{t.hotReason}</span>}
    </div>
  </article>;
}
function Skeletons({home = false}: {home?: boolean}) {
  return <div className={`poster-grid ${home ? "home-grid skeleton-grid" : ""}`} aria-label="Načítání titulů">{[1, 2, 3, 4, 5, 6].map(n =>
    <div key={n} className="skeleton-card"><div className="skeleton poster-placeholder"/><div className="skeleton text-placeholder"/></div>)}</div>;
}
export function useHot(enabled = true) {
  const action = useAction(api.catalog.hot);
  const [titles, setTitles] = useState<Title[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true; setLoading(true); setError("");
    action({}).then(data => {if (live) setTitles(data);}).catch(() => {if (live) setError("Aktuální výběr se nepodařilo načíst.");})
      .finally(() => {if (live) setLoading(false);});
    return () => {live = false;};
  }, [action, retry, enabled]);
  return {titles, loading, error, retry: () => setRetry(n => n + 1)};
}
function Failure({message, retry}: {message: string; retry: () => void}) {
  return <div className="empty" role="alert"><Info/><p>{message}</p><button className="secondary" onClick={retry}><RefreshCw size={16}/>Zkusit znovu</button></div>;
}
function MediaFilters({filter, onChange}: {filter: string; onChange: (value: string) => void}) {
  return <div className="filter-row" aria-label="Typ titulů">{[["all", "Vše"], ["tv", "Seriály"], ["movie", "Filmy"]].map(([key, label]) =>
    <button className={`filter ${filter === key ? "selected" : ""}`} key={key} aria-pressed={filter === key} onClick={() => onChange(key)}>{label}</button>)}</div>;
}
export function RadarPage({view}: {view: View}) {
  return view === "search" ? <SearchView/> : <OverviewPage view={view}/>;
}
function OverviewPage({view}: {view: Exclude<View, "search">}) {
  const me = useQuery(api.library.me), config = useQuery(api.catalog.config);
  const hiddenPrefs = usePaginatedQuery(api.overview.preferences, {}, {initialNumItems: 100});
  const [filter, setFilter] = useState("all"), [tab, setTab] = useState("hot"), [choicesReady, setChoicesReady] = useState(false);
  const hot = useHot(choicesReady && ((view === "hot" && tab === "hot") || (view === "home" && me === null)));
  const restored = useRef(false);
  useEffect(() => {
    if (hiddenPrefs.status === "CanLoadMore") hiddenPrefs.loadMore(100);
  }, [hiddenPrefs.status, hiddenPrefs.loadMore]);
  useEffect(() => {
    try {
      const savedTab = localStorage.getItem("radar-discover-tab"), savedFilter = sessionStorage.getItem("radar-hot-filter");
      if (savedTab === "hot" || savedTab === "personal") setTab(savedTab);
      if (savedFilter && ["all", "tv", "movie"].includes(savedFilter)) setFilter(savedFilter);
    } catch { /* Preferences are optional. */ }
    setChoicesReady(true);
  }, []);
  useEffect(() => {
    if (choicesReady && (view === "home" || (view === "hot" && tab === "hot")) && !hot.loading && !restored.current) {restored.current = true; restoreScroll();}
  }, [choicesReady, hot.loading, view, tab]);
  const hiddenKeys = new Set(hiddenPrefs.results.filter(row => row.hidden).map(row => row.key));
  const publicTitles = view === "home"
    ? visibleDiscoveryTitles(hot.titles, hiddenKeys, "all", 8)
    : visibleDiscoveryTitles(hot.titles, hiddenKeys, filter as "all" | "tv" | "movie", 24);
  const setMedia = (value: string) => {setFilter(value); try {sessionStorage.setItem("radar-hot-filter", value);} catch {}};
  return <Shell view={view}>{view === "mine" ? <><PageHeading title="Moje" subtitle="Uložené, rozkoukané i viděné."/>
    <Authenticated><PersonalRadar/></Authenticated><Unauthenticated><SignInEmpty/></Unauthenticated><AuthLoading><Skeletons/></AuthLoading></>
    : <>{view === "home" ? <><h1 className="visually-hidden">Tvůj radar</h1><Authenticated><div className="home-personal"><PersonalRadar dashboard/></div></Authenticated>
      <AuthLoading><div className="home-personal"><Skeletons home/></div></AuthLoading></>
      : <PageHeading title="Objevuj" subtitle={tab === "personal" ? "Podle tvého vkusu. Nejen novinky." : "Nové příběhy a sezóny, které stojí za pozornost."}/>}
      {(view === "hot" || me === null) && <section className={`hot-section ${view === "home" ? "home-feed" : ""}`}>
        {view === "home" ? <div className="section-heading home-feed-heading"><h2>Na radaru</h2><Link to="/hot" className="text-link">Objevuj <ArrowRight size={16}/></Link></div>
          : <div className="discover-toolbar"><div className="discover-tabs" aria-label="Výběr doporučení">{[["hot", "Teď frčí"], ["personal", "Pro tebe"]].map(([key, label]) =>
            <button key={key} className={`filter ${tab === key ? "selected" : ""}`} aria-pressed={tab === key} onClick={() => {setTab(key); try {localStorage.setItem("radar-discover-tab", key);} catch {}}}>{label}</button>)}</div>
            <MediaFilters filter={filter} onChange={setMedia}/></div>}
        {view === "hot" && tab === "personal" ? <Recommendations filter={filter}/>
          : <>{config && !config.tmdb && <p className="source-note">Živý seriálový výběr z TVmaze. Filmový katalog zatím není připojený.</p>}
            {hot.loading ? <Skeletons home={view === "home"}/> : hot.error ? <Failure message={hot.error} retry={hot.retry}/>
              : publicTitles.length ? <div className={`poster-grid ${view === "home" ? "home-grid" : ""}`} data-testid="hot-results" data-state="ready">{publicTitles.map(t => <PosterCard key={t.key} title={t} allowHide={view === "hot"}/>)}</div>
              : <div className="empty"><Film/><h3>Žádné aktuální tituly</h3><p>Zkus jiný výběr nebo to zopakuj později.</p></div>}</>}
      </section>}
    </>}
  </Shell>;
}
export function PageHeading({title, subtitle}: {title: string; subtitle: string}) {
  return <div className="page-heading"><h1>{title}</h1><p>{subtitle}</p></div>;
}
function SearchView() {
  const action = useAction(api.catalog.search), config = useQuery(api.catalog.config);
  const [q, setQ] = useState(""), [titles, setTitles] = useState<Title[]>([]), [state, setState] = useState("idle"), [filter, setFilter] = useState("all");
  const [restored, setRestored] = useState(false), [retry, setRetry] = useState(0), seq = useRef(0), didRestore = useRef(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem("radar-search") || "null");
      if (stored) {setQ(stored.q || ""); setFilter(["all", "tv", "movie"].includes(stored.filter) ? stored.filter : "all");}
    } catch { /* Invalid stored preferences are ignored. */ }
    setRestored(true);
  }, []);
  useEffect(() => {if (restored) {try {sessionStorage.setItem("radar-search", JSON.stringify({q, filter}));} catch {}}}, [q, filter, restored]);
  useEffect(() => {
    if (!restored) return;
    const id = ++seq.current; let live = true;
    if (q.trim().length < 2) {setState("idle"); setTitles([]); return;}
    setState("loading");
    const timer = setTimeout(() => {
      action({q}).then(result => {
        if (live && seq.current === id) {setTitles(result.titles); setState("ready"); if (!didRestore.current) {didRestore.current = true; requestAnimationFrame(restoreScroll);}}
      }).catch(() => {if (live && seq.current === id) setState("error");});
    }, 280);
    return () => {live = false; clearTimeout(timer);};
  }, [q, action, restored, retry]);
  const changeQuery = (value: string) => {didRestore.current = true; setQ(value);};
  const items = titles.filter(t => filter === "all" || t.type === filter);
  return <Shell view="search" search={{query: q, onChange: changeQuery, ready: restored}}><h1 className="visually-hidden">Hledat film nebo seriál</h1>
    <div className="search-content"><MediaFilters filter={filter} onChange={setFilter}/>
      {config && !config.tmdb && <p className="source-note">Zatím hledáme seriály přes TVmaze. Filmový katalog není připojený.</p>}
      <section data-testid="search-results" data-state={state}>{state === "loading" ? <Skeletons/> : state === "error" ? <Failure message="Zdroj vyhledávání neodpovídá." retry={() => setRetry(n => n + 1)}/>
        : state === "idle" ? <div className="search-idle"><p>Napiš název. Uložit i označit oblíbené můžeš rovnou na kartě.</p><div className="suggestions">{["Severance", "The Bear", "Slow Horses"].map(name =>
          <button onClick={() => changeQuery(name)} key={name}>{name}<ArrowUpRight size={14}/></button>)}</div></div>
        : <><p className="results-label">{items.length} {plural(items.length, "výsledek", "výsledky", "výsledků")}</p><div className="poster-grid">{items.map(t => <PosterCard key={t.key} title={t}/>)}</div>
          {!items.length && <div className="empty"><Film/><h3>Nic jsme nenašli.</h3><p>Zkus původní název nebo kratší dotaz.</p></div>}</>}
      </section>
    </div>
  </Shell>;
}
function SignInEmpty() {
  const [open, setOpen] = useState(false);
  return <div className="personal-empty-small"><h2>Tvoje tituly na jednom místě.</h2><p>Přihlas se, ať se seznam i vkus uloží k tvému účtu.</p>
    <button className="primary" onClick={() => setOpen(true)}>Přihlásit se <ArrowRight size={17}/></button><AuthDialog open={open} onClose={() => setOpen(false)}/></div>;
}
