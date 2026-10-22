import {useEffect, useRef, useState} from "react";
import {useAction, useMutation, usePaginatedQuery, useQuery} from "convex/react";
import {Link} from "@tanstack/react-router";
import {Bell, BellOff, Heart} from "lucide-react";
import {api} from "../../convex/_generated/api";
import {today, fullDate, episodeCode, relative, episodeCount, seenCount} from "@/lib/format";
import {dashboardKind} from "@/lib/personal-model";
import {sortLibraryRows, type LibrarySortMode} from "@/lib/librarySort";
import {TitleLink, PersonalButton, restoreScroll} from "./personal-controls";
import {PushControls} from "./push-controls";
import {QuickSeenButton} from "./episode-action";
import {PosterCard} from "./radar";

function usePragueDay() {
  const [day, setDay] = useState(today);
  useEffect(() => {
    const update = () => setDay(today());
    const interval = setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => {clearInterval(interval); document.removeEventListener("visibilitychange", update);};
  }, []);
  return day;
}

export function PersonalRadar({dashboard = false}: {dashboard?: boolean}) {
  const day = usePragueDay();
  const {results, status, loadMore} = usePaginatedQuery(api.overview.page, {day}, {initialNumItems: 6});
  const timeline = useAction(api.catalog.timeline), detail = useAction(api.catalog.detail), history = useMutation(api.personal.includeLegacyHistory);
  const [filter, setFilter] = useState("all"), [sortMode, setSortMode] = useState<LibrarySortMode>("added");
  const [syncError, setSyncError] = useState(false), [retry, setRetry] = useState(0);
  const [historyDone, setHistoryDone] = useState(false), [held, setHeld] = useState<Record<string, any>>({});
  const attempts = useRef(new Set<string>()), timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const restored = useRef(false);

  useEffect(() => {if (status === "CanLoadMore") loadMore(6);}, [status, loadMore]);
  useEffect(() => {
    let live = true; setHistoryDone(false);
    (async () => {
      let cursor: string | null = null;
      do {
        const page = await history({paginationOpts: {numItems: 100, cursor}});
        if (page.isDone) break;
        cursor = page.continueCursor;
      } while (live);
    })().catch(() => {if (live) setSyncError(true);}).finally(() => {if (live) setHistoryDone(true);});
    return () => {live = false;};
  }, [history, retry]);
  useEffect(() => {
    try {
      const value = sessionStorage.getItem("radar-library-filter");
      if (value && ["all", "watching", "want", "seen"].includes(value)) setFilter(value);
      const savedSort = localStorage.getItem("radar-library-sort");
      if (savedSort === "alpha" || savedSort === "added") setSortMode(savedSort);
    } catch { /* Optional persistence. */ }
    const releaseHeld = () => {for (const timer of timers.current.values()) clearTimeout(timer); timers.current.clear(); setHeld({});};
    window.addEventListener("radar-undone", releaseHeld);
    return () => {window.removeEventListener("radar-undone", releaseHeld); for (const timer of timers.current.values()) clearTimeout(timer);};
  }, []);

  const needs = results.filter(r => !r.title || (r.title.type === "tv" && r.timelineRefreshAt <= Date.now())).map(r => r.titleKey).join("|");
  useEffect(() => {
    let cancelled = false;
    const keys = needs.split("|").filter(key => key && !attempts.current.has(`${day}:${key}`));
    (async () => {
      for (const key of keys) {
        if (cancelled) break;
        attempts.current.add(`${day}:${key}`);
        try {
          if (!results.find(r => r.titleKey === key)?.title) await detail({key});
          if (/^(tmdb|tvmaze):tv:/.test(key)) await timeline({key});
        } catch {if (!cancelled) setSyncError(true);}
      }
    })();
    return () => {cancelled = true;};
  }, [needs, day, retry, detail, timeline]);

  const complete = status === "Exhausted" && historyDone;
  useEffect(() => {if (complete && !restored.current) {restored.current = true; restoreScroll();}}, [complete]);

  const rows = results.filter(r => r.title && r.progress);
  const classified = rows.map(r => ({row: r, kind: dashboardKind(r, day)}));
  const upcoming = classified.filter(x => x.kind === "upcoming").map(x => x.row)
    .sort((a, b) => (a.title.next?.date || a.title.premiere || "9999").localeCompare(b.title.next?.date || b.title.premiere || "9999"));
  const ready = classified.filter(x => x.kind === "ready").map(x => x.row)
    .sort((a, b) => b._creationTime - a._creationTime);
  const catchupMap = new Map(classified.filter(x => x.kind === "catchup").map(x => [x.row.titleKey, x.row]));
  for (const [key, row] of Object.entries(held)) catchupMap.set(key, row);
  const catchup = [...catchupMap.values()].sort((a, b) => b._creationTime - a._creationTime);
  const uncertain = !complete || syncError || rows.some(r => r.saved !== false && r.title.type === "tv" && !r.progress.complete);

  function hold(row: any) {
    const timer = timers.current.get(row.titleKey); if (timer) clearTimeout(timer);
    setHeld(old => ({...old, [row.titleKey]: row}));
  }
  function release(key: string, ok: boolean) {
    const remove = () => {setHeld(old => {const next = {...old}; delete next[key]; return next;}); timers.current.delete(key);};
    if (!ok) {remove(); return;}
    setHeld(old => old[key] ? {...old, [key]: {...old[key], acknowledged: true}} : old);
    const timer = timers.current.get(key); if (timer) clearTimeout(timer);
    timers.current.set(key, setTimeout(remove, 4500));
  }
  function row(r: any, mode: "library" | "catchup" | "upcoming" | "ready" = "library") {
    const t = r.title, p = r.progress;
    const e = mode === "catchup" ? p.nextToWatch : mode === "upcoming" ? t.next : null;
    const description = mode === "ready"
      ? t.type === "movie" ? "Chci vidět" : p.released ? `${episodeCount(p.released)} už vyšlo` : "Chci vidět"
      : e ? `${episodeCode(e.season, e.number)} · ${e.name}`
      : t.type === "movie" ? (r.movieSeen ? "Viděno" : "Chci vidět")
      : p.started ? (p.caughtUp ? "Všechny vydané díly viděné" : seenCount(p.seenCount)) : "Chci vidět";
    return <article className="timeline-entry" key={r._id} data-title={t.key}>
      <TitleLink titleKey={t.key} className="timeline-row"><img src={t.poster || "/logo192.png"} alt="" loading="lazy"/><div className="timeline-info"><h3>{t.name}</h3><p>{description}</p><small>
        {mode === "catchup" ? r.acknowledged ? "Označeno jako viděné." : `${episodeCount(p.missing)} k dohnání${!p.complete ? " v dostupných datech" : ""}`
          : mode === "upcoming" ? `${relative(e?.date || t.premiere)} · ${fullDate(e?.date || t.premiere)}`
          : mode === "ready" ? t.type === "tv" ? "Ještě nezačato" : t.premiere ? fullDate(t.premiere) : "Připraveno v Mých"
          : t.type === "tv" ? <>{r.notifications ? <Bell size={12}/> : <BellOff size={12}/>} {r.notifications ? "Odběr nových dílů" : "Bez upozornění"}</> : null}
      </small></div></TitleLink>
      {mode === "catchup" && e && <QuickSeenButton key={`${t.key}:${e.season}:${e.number}`} titleKey={t.key} season={e.season} episode={e.number} compact
        onBegin={() => hold(r)} onSettled={ok => release(t.key, ok)}/>} 
    </article>;
  }

  if (status === "LoadingFirstPage") return <div className="skeleton episodes-skeleton" aria-label="Načítání osobního přehledu"/>;
  const hasDashboardContent = catchup.length || ready.length || upcoming.length;
  const filteredLibraryRows = rows.filter(r => filter === "all" || r.progress.status === filter);
  const visibleLibraryRows = sortLibraryRows(filteredLibraryRows, sortMode);
  return <section data-testid="personal-radar" data-state={complete ? "ready" : "loading"}>
    {!complete && <p className="rec-loading-note" role="status">Doplňujeme celý tvůj přehled…</p>}
    {dashboard ? rows.length ? hasDashboardContent ? <div className="radar-columns dashboard-sections">
      {!!catchup.length && <section className="radar-block"><h2>Pokračovat</h2>{catchup.map(r => row(r, "catchup"))}</section>}
      {!!ready.length && <section className="radar-block"><h2>Připravené ke sledování</h2>{ready.slice(0, 4).map(r => row(r, "ready"))}
        {ready.length > 4 && <Link className="dashboard-more" to="/mine">Všech {ready.length} v Mých</Link>}</section>}
      {!!upcoming.length && <section className="radar-block"><h2>Brzy vyjde</h2>{upcoming.slice(0, 6).map(r => row(r, "upcoming"))}</section>}
    </div> : <div className="personal-empty-small"><h3>{uncertain ? "Ještě doplňujeme data." : "Všechno dohnáno."}</h3>
      <p>{uncertain ? "Jakmile budeme mít úplný přehled, objeví se tu další krok." : "Nemáš nic rozkoukaného ani připraveného."}</p>
      <Link to="/hot">Objev něco dalšího</Link></div>
      : complete && <div className="personal-empty-small"><h3>Začni svým prvním titulem.</h3><Link to="/search">Najít film nebo seriál</Link></div>
      : <><div className="library-toolbar">
        <div className="library-filters" aria-label="Stav sledování">{[["all", "Vše"], ["watching", "Sleduju"], ["want", "Chci vidět"], ["seen", "Viděné"]].map(([key, label]) =>
          <button key={key} className={`filter ${filter === key ? "selected" : ""}`} aria-pressed={filter === key} onClick={() => {setFilter(key); try {sessionStorage.setItem("radar-library-filter", key);} catch {}}}>{label}</button>)}</div>
        <div className="library-sort" role="group" aria-label="Řazení">
          <button className={`filter ${sortMode === "alpha" ? "selected" : ""}`} aria-pressed={sortMode === "alpha"} onClick={() => {setSortMode("alpha"); try {localStorage.setItem("radar-library-sort", "alpha");} catch {}}}>Abeceda</button>
          <button className={`filter ${sortMode === "added" ? "selected" : ""}`} aria-pressed={sortMode === "added"} onClick={() => {setSortMode("added"); try {localStorage.setItem("radar-library-sort", "added");} catch {}}}>Datum přidání</button>
        </div>
      </div>
      {!!rows.some(r => r.saved !== false && r.title.type === "tv") && <details className="bulk-reminders"><summary>Upozornění na sledované seriály</summary><PushControls allSeries/>
        <p className="fine">Pro aktuálně uložené seriály. Nově přidané zapneš zvlášť.</p></details>}
      {visibleLibraryRows.map(r => row(r))}
      {complete && !visibleLibraryRows.length && <div className="personal-empty-small">V tomto výběru zatím nic není. <Link to="/search">Najít titul</Link></div>}</>}
    {syncError && <p role="alert" className="small">Část přehledu se nepodařilo doplnit. <button className="quiet" onClick={() => {attempts.current.clear(); setSyncError(false); setRetry(n => n + 1);}}>Zkusit znovu</button></p>}
    {complete && rows.some(r => r.progressLimited || (r.timelineReady && !r.progress.complete && r.title.type === "tv")) && <p className="fine">U některých dlouhých seriálů zatím nemáme úplná data. Neoznačujeme je proto za dokončené.</p>}
  </section>;
}

export function Recommendations({filter = "all"}: {filter?: string}) {
  const me = useQuery(api.library.me), action = useAction(api.catalog.recommendations);
  const {results, status, loadMore} = usePaginatedQuery(api.overview.preferences, {}, {initialNumItems: 50});
  const signature = JSON.stringify(results);
  const [data, setData] = useState<any>(null), [error, setError] = useState(false), [refreshing, setRefreshing] = useState(false), [retry, setRetry] = useState(0);
  const restored = useRef(false);
  useEffect(() => {
    const refreshAfterUndo = () => setRetry(n => n + 1);
    window.addEventListener("radar-undone", refreshAfterUndo);
    return () => window.removeEventListener("radar-undone", refreshAfterUndo);
  }, []);
  useEffect(() => {if (status === "CanLoadMore") loadMore(50);}, [status, loadMore]);
  useEffect(() => {
    if (!me || status !== "Exhausted") return;
    let live = true;
    const timer = setTimeout(() => {
      setRefreshing(true); setError(false);
      action({}).then(response => {if (live) {setData(response); if (!restored.current) {restored.current = true; requestAnimationFrame(restoreScroll);}}})
        .catch(() => {if (live) setError(true);}).finally(() => {if (live) setRefreshing(false);});
    }, 180);
    return () => {live = false; clearTimeout(timer);};
  }, [!!me, signature, status, action, retry]);

  if (me === undefined) return <div className="skeleton episodes-skeleton"/>;
  if (!me) return <div className="personal-empty-small">Označ, co se ti líbí. Po přihlášení začneme vybírat podle tebe. <Link to="/search">Najít oblíbený titul</Link></div>;
  if (error && !data) return <div role="alert">Tipy se nepodařilo načíst. <button className="secondary" onClick={() => setRetry(n => n + 1)}>Zkusit znovu</button></div>;
  if (!data) return <div className="skeleton episodes-skeleton" aria-label="Vybíráme tipy"/>;
  if (!data.seedCount) return <div className="personal-empty-small">Označ, co se ti líbí. Začneme vybírat podle tebe. <Link to="/search">Najít oblíbený titul</Link></div>;

  const exclusions = new Set(results.filter(r => r.saved || r.liked || r.hidden || r.seen).map(r => r.key));
  const items = data.items.filter((item: any) => !exclusions.has(item.title.key) && (filter === "all" || item.title.type === filter)).slice(0, 12);
  const groups = new Map<string, any[]>();
  for (const item of items) {if (!groups.has(item.reason)) groups.set(item.reason, []); groups.get(item.reason)!.push(item);}

  return <div data-testid="recommendations" data-state={refreshing ? "loading" : "ready"} aria-busy={refreshing}>
    <details className="taste-summary" data-testid="taste-summary"><summary><Heart size={15} fill="currentColor"/>Tvůj vkus <span>{data.seedCount}</span></summary>
      <p className="fine">Srdíčka ovlivňují doporučení, ale nepřidávají titul do Mých.</p>
      <div className="taste-list">{(data.taste || []).map((item: any) => <div className="taste-item" key={item.key}>
        <TitleLink titleKey={item.key} className="taste-link"><span>{item.name}</span>{item.year && <small>{item.year}</small>}</TitleLink>
        <PersonalButton titleKey={item.key} field="liked" compact/>
      </div>)}</div>
    </details>
    {refreshing && <p className="rec-loading-note" role="status">Upravujeme tipy podle posledních změn…</p>}
    {(data.partial || error) && <p className="fine">Část zdrojů je nedostupná. Zobrazujeme dostupné tipy. <button className="quiet" onClick={() => setRetry(n => n + 1)}>Zkusit znovu</button></p>}
    {[...groups].map(([reason, group]) => <section className="rec-group" key={reason}><h2>{reason}</h2><div className="poster-grid">{group.map(item =>
      <div className="rec-item" key={item.title.key}><PosterCard title={item.title} allowHide/></div>)}</div></section>)}
    {!items.length && <div className="personal-empty-small">{filter === "all" ? "Další vhodné tipy zatím nemáme." : `Pro tento vkus zatím nemáme další ${filter === "movie" ? "filmové" : "seriálové"} tipy.`} <Link to="/search">Přidat další oblíbený titul</Link></div>}
  </div>;
}
