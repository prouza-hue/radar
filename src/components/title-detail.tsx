import {useEffect, useRef, useState} from "react";
import {useAction, useQuery} from "convex/react";
import {ArrowUpRight, CalendarDays, ChevronDown, ChevronUp, Info, Play, ArrowDown} from "lucide-react";
import {api} from "../../convex/_generated/api";
import type {Title, Episode, Availability} from "@/lib/types";
import {progressOf, type Timeline} from "@/lib/personal-model";
import {today, episodeCode, episodeCount, fullDate, relative, plural} from "@/lib/format";
import {externalTitleLinks} from "@/lib/externalLinks";
import {PersonalButton, BackLink, useTitleOrigin} from "./personal-controls";
import {QuickSeenButton} from "./episode-action";
import {EpisodeList} from "./episode-list";
import {PushControls} from "./push-controls";
import {StremioLink} from "./stremio-link";
import {Shell, type View} from "./radar";
import AuthDialog from "./auth-dialog";

function AvailabilitySummary({title}: {title: Title}) {
  const all = title.availability.filter(a => a.region === "CZ");
  const direct = [...new Map(all.filter(a => a.type === "subscription" || a.type === "free").map(a => [a.name, a])).values()];
  const transactions = new Map<string, {provider: Availability; types: Set<string>}>();
  for (const a of all.filter(a => a.type === "rent" || a.type === "buy")) {
    if (!transactions.has(a.name)) transactions.set(a.name, {provider: a, types: new Set()});
    transactions.get(a.name)!.types.add(a.type === "rent" ? "půjčení" : "nákup");
  }
  return <section className="availability-compact" data-testid="availability"><h2>Kde sledovat v ČR</h2>
    {!!direct.length && <div className="provider-list">{direct.map(a => <a key={a.name} className="provider-chip" href={a.url} target="_blank" rel="noreferrer"
      title={`Ověřit dostupnost: ${a.name} (přehled nabídky)`}>{a.name}{a.type === "free" ? " · zdarma" : ""}<ArrowUpRight size={14}/></a>)}</div>}
    {!!transactions.size && <details className="availability-more" data-testid="availability-more"><summary>Půjčit nebo koupit ({transactions.size})</summary>
      <div className="provider-list">{[...transactions].map(([name, {provider, types}]) => <a key={name} className="provider-chip" href={provider.url} target="_blank" rel="noreferrer"
        title={`Ověřit nabídku: ${name}`}>{name} · {[...types].join(" / ")}<ArrowUpRight size={14}/></a>)}</div>
    </details>}
    {!all.length ? <p className="muted small">Českou dostupnost zatím nemáme potvrzenou.</p>
      : <p className="fine">JustWatch přes TMDB. Odkazy otevřou přehled nabídky, ne přehrávač.</p>}
  </section>;
}
function ExternalSourceLinks({title: t}: {title: Title}) {
  const links = externalTitleLinks(t);
  const tmdbRating = t.ratings.find(r => r.source === "TMDB");
  const otherRatings = t.ratings.filter(r => r.source !== "TMDB");
  return <><div className="external-source-links" aria-label="Odkazy na filmové databáze">
    {links.map(link => <a key={link.key} className={`external-source-link source-${link.key}`} href={link.href} target="_blank" rel="noopener noreferrer"
      title={link.direct ? `Otevřít titul na ${link.label}` : `Vyhledat titul na ${link.label}`}>
      <span>{link.label}</span>{link.key === "tmdb" && tmdbRating && <strong>{tmdbRating.value.toLocaleString("cs-CZ", {minimumFractionDigits: 1, maximumFractionDigits: 1})}</strong>}<ArrowUpRight size={13}/>
    </a>)}
  </div>
  {otherRatings.map((r, i) => <div className="detail-rating secondary-rating" key={i}><span>{r.source}</span><strong>{r.value.toFixed(1)}<small>/{r.scale}</small></strong>
    {r.votes !== undefined && <small>{r.votes.toLocaleString("cs-CZ")} {plural(r.votes, "hlas", "hlasy", "hlasů")}</small>}</div>)}</>;
}
function TitleIdentity({title: t}: {title: Title}) {
  const [expanded, setExpanded] = useState(false), [clipped, setClipped] = useState(false);
  const paragraph = useRef<HTMLParagraphElement>(null);
  const text = t.overview || "Popis zatím není k dispozici.";
  useEffect(() => {
    const node = paragraph.current;
    if (!node || expanded) return;
    const measure = () => setClipped(node.scrollHeight > node.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, [text, expanded]);
  return <section className={`detail-hero ${!t.backdrop ? "no-backdrop" : ""}`}>
    {t.backdrop && <img className="detail-backdrop" src={t.backdrop} alt=""/>}<div className="detail-overlay"/>
    <div className="detail-inner"><div className={`detail-heading-row ${!t.poster ? "no-poster" : ""}`}>
      {t.poster && <img className="detail-poster" src={t.poster} alt={t.name}/>}
      <div className="detail-copy"><div className="detail-kind">{[t.type === "tv" ? "Seriál" : "Film", t.year, t.runtime ? `${t.runtime} min` : ""].filter(Boolean).join(" · ")}</div>
        <h1>{t.name}</h1>{t.originalName && t.originalName !== t.name && <p className="original-title">{t.originalName}</p>}
        {!!t.genres.length && <p className="genres">{t.genres.join(" · ")}</p>}
        <ExternalSourceLinks title={t}/>
      </div></div>
      <div className="detail-description"><p ref={paragraph} id="title-synopsis" className={`synopsis ${!expanded ? "clamped" : ""}`}>{text}</p>
        {(clipped || expanded) && <button className="description-toggle" aria-expanded={expanded} aria-controls="title-synopsis" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Méně" : "Celý popis"}{expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</button>}
      </div>
      <div className="detail-actions"><PersonalButton titleKey={t.key} emphasis="primary"/>
        {t.type === "movie" && <PersonalButton titleKey={t.key} field="movieSeen"/>}<PersonalButton titleKey={t.key} field="liked"/>
        <StremioLink title={t}/>
        {t.trailer && <a className="trailer-link" href={t.trailer} target="_blank" rel="noreferrer"><Play size={15}/>Trailer</a>}
      </div>
    </div>
  </section>;
}
function Sources({title: t}: {title: Title}) {
  return <section className="source-box"><details><summary>O datech a původní stanici</summary>
    {t.originalNetwork && <p>Původní stanice: {t.originalNetwork}. Nejde o potvrzení dostupnosti v ČR.</p>}
    <p>{t.source === "tvmaze" ? "Metadata a hodnocení z TVmaze. Texty mohou být v původním jazyce." : "Metadata a hodnocení z TMDB. Český překlad zobrazujeme, pokud existuje."}</p>
    <a href={t.sourceUrl} target="_blank" rel="noreferrer">Otevřít zdroj <ArrowUpRight size={14}/></a>
    <small>Aktualizováno {new Date(t.updatedAt).toLocaleDateString("cs-CZ")}</small>
    {t.last && <small>Poslední vydání: {fullDate(t.last.date)}</small>}
  </details></section>;
}
export default function TitleDetail({titleKey}: {titleKey: string}) {
  const get = useAction(api.catalog.detail), getSeason = useAction(api.catalog.season), getTimeline = useAction(api.catalog.timeline);
  const progress = useQuery(api.personal.progress, {key: titleKey}), member = useQuery(api.library.membership, {key: titleKey}), me = useQuery(api.library.me);
  const signedIn = !!me;
  const origin = useTitleOrigin(titleKey);
  const view: View = ({"/": "home", "/search": "search", "/hot": "hot", "/mine": "mine"} as const)[origin];
  const [title, setTitle] = useState<Title | null>(null), [error, setError] = useState("");
  const [retry, setRetry] = useState(0), [auth, setAuth] = useState(false);
  const [timeline, setTimeline] = useState<Timeline | null>(null), [timelineError, setTimelineError] = useState(false), [timelineRetry, setTimelineRetry] = useState(0);
  const [picked, setPicked] = useState(false), [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]), [epsLoading, setEpsLoading] = useState(false), [epsError, setEpsError] = useState(false), [epsRetry, setEpsRetry] = useState(0);
  const [target, setTarget] = useState<{season: number; number: number; nonce: number} | null>(null);
  const t = title?.key === titleKey ? title : null;
  const day = today();
  useEffect(() => {
    let live = true;
    setTitle(null); setError(""); setTimeline(null); setTimelineError(false); setPicked(false); setTarget(null); setEpisodes([]);
    get({key: titleKey}).then((data: Title) => {if (live) {setTitle(data); setSeason(data.seasons[0] || 1);}})
      .catch(() => {if (live) setError("Detail se nepodařilo načíst. Zkontroluj připojení a zkus to znovu.");});
    return () => {live = false;};
  }, [titleKey, get, retry]);
  useEffect(() => {
    if (!t || t.type !== "tv") return;
    let live = true;
    setEpsError(false); setEpisodes([]); setEpsLoading(true);
    const request = t.source === "tvmaze" ? Promise.resolve(t.episodes.filter(e => e.season === season)) : getSeason({key: t.key, season});
    request.then(data => {if (live) setEpisodes(data);}).catch(() => {if (live) setEpsError(true);})
      .finally(() => {if (live) setEpsLoading(false);});
    return () => {live = false;};
  }, [t, season, getSeason, epsRetry]);
  useEffect(() => {
    if (!t || t.type !== "tv" || !signedIn) return;
    let live = true; setTimelineError(false);
    getTimeline({key: t.key}).then(data => {if (live) setTimeline(data);}).catch(() => {if (live) setTimelineError(true);});
    return () => {live = false;};
  }, [t, getTimeline, timelineRetry, signedIn]);
  useEffect(() => {
    if (!t || !timeline || !progress || picked) return;
    const state = progressOf({title: t, timeline, watched: progress.watched, progressLimited: progress.limited}, today());
    if (progress.watched.length) setSeason(state.nextToWatch?.season || t.next?.season || Math.max(...progress.watched.map((e: any) => e.season)));
    setPicked(true);
  }, [t, timeline, progress, picked]);
  useEffect(() => {
    if (!target || epsLoading || season !== target.season || !episodes.some(e => e.number === target.number)) return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(`episode-${target.season}-${target.number}`);
      element?.scrollIntoView({block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
      element?.querySelector<HTMLButtonElement>(".episode-text")?.focus({preventScroll: true});
    });
    return () => cancelAnimationFrame(frame);
  }, [target, epsLoading, episodes, season]);
  const p = t && progress ? progressOf({title: t, timeline, watched: progress.watched, progressLimited: progress.limited}, day) : null;
  const next = p?.nextToWatch;
  const showResume = signedIn && !!p?.started && !!next;
  const nextName = next ? episodes.find(e => e.season === next.season && e.number === next.number)?.name || next.name : "";
  const ended = !!t && ["Ended", "Canceled", "Cancelled"].includes(t.status);
  const future = t?.next?.date && t.next.date.slice(0, 10) >= day ? t.next : null;
  const showReminders = !!t && (t.type === "tv" ? !ended || !!member?.notifications : !t.premiere || t.premiere >= day);
  const openEpisode = () => {if (next) {setPicked(true); setSeason(next.season); setTarget({season: next.season, number: next.number, nonce: Date.now()});}};
  const release = t && <div className="release-summary"><CalendarDays size={17}/><div>{t.type === "tv"
    ? future ? <><strong>{episodeCode(future.season, future.number)} · {relative(future.date)}</strong><small>{fullDate(future.date)} · původní vydání; dostupnost dílu v ČR není potvrzena.</small></>
      : <strong>{ended ? (t.status === "Ended" ? "Seriál je ukončený." : "Seriál byl zrušen.") : "Další termín zatím neznáme."}</strong>
    : <><strong>{t.premiere && t.premiere < day ? "Premiéra" : "Vychází"}: {fullDate(t.premiere)}</strong><small>{t.releaseRegion === "CZ" ? "Česká kinopremiéra." : "Datum původního vydání; český termín není potvrzený."}</small></>}
  </div></div>;
  return <Shell view={view}><BackLink titleKey={titleKey}/>{error ? <div className="empty" role="alert"><Info/><p>{error}</p><button className="secondary" onClick={() => setRetry(n => n + 1)}>Zkusit znovu</button></div>
    : !t ? <div className="skeleton detail-skeleton" aria-label="Načítání detailu"/>
    : <div className={`detail-workspace ${t.type === "movie" ? "movie" : "tv"}`} data-testid="title-detail" data-state="ready">
      <div className="detail-overview"><TitleIdentity key={t.key} title={t}/>{t.type === "tv" && <><AvailabilitySummary title={t}/><Sources title={t}/></>}</div>
      <div className="detail-activity"><section className={`watch-panel ${showResume ? "has-resume" : ""}`} data-testid="watch-summary">
        {t.type === "tv" && showResume && next && <><div className="resume-strip" data-testid="resume-strip">
          <button className="resume-copy" data-testid="jump-next-episode" onClick={openEpisode} title="Přejít na další neviděný díl">
            <span>Pokračuj · {episodeCode(next.season, next.number)} <ArrowDown size={13}/></span><strong>{nextName}</strong></button>
          <QuickSeenButton titleKey={t.key} season={next.season} episode={next.number} compact/>
        </div><p className="watch-count">{episodeCount(p!.missing)} k dohnání{!p?.complete ? " v dostupných datech" : ""}.</p></>}
        {t.type === "tv" && !next && p?.caughtUp && signedIn && <p className="small">Všechno dohnáno.</p>}
        {t.type === "tv" && p?.started && signedIn && !timeline && !timelineError && <p className="muted small">Doplňujeme přehled epizod…</p>}
        {t.type === "tv" && p?.started && signedIn && timelineError && <p className="small" role="alert">Přehled se nepodařilo doplnit. <button className="quiet" onClick={() => setTimelineRetry(n => n + 1)}>Zkusit znovu</button></p>}
        {t.type === "tv" && p?.started && signedIn && timeline && !timeline.complete && !next && <p className="muted small">Nemáme úplný přehled všech sezón.</p>}
        {release}{showReminders && <PushControls titleKey={t.key} onLogin={() => setAuth(true)}/>}</section>
        {t.type === "tv" ? <section className="episodes" data-testid="episodes-section"><div className="section-heading"><h2>Epizody</h2>
          <label className="season-select"><select aria-label="Sezóna" value={season} onChange={event => {setPicked(true); setTarget(null); setSeason(Number(event.target.value));}}>
            {[...new Set([...(t.seasons.length ? t.seasons : [1]), season])].sort((a, b) => a - b).map(s => <option key={s} value={s}>{s}. sezóna</option>)}
          </select><ChevronDown size={15}/></label></div>
          {epsLoading ? <div className="skeleton episodes-skeleton" aria-label="Načítání epizod"/> : epsError ? <p role="alert">Epizody se nepodařilo načíst. <button className="secondary" onClick={() => setEpsRetry(n => n + 1)}>Zkusit znovu</button></p>
            : !episodes.length ? <p className="muted">Epizody této sezóny zatím nejsou oznámené.</p>
            : <EpisodeList episodes={episodes} titleKey={t.key} season={season} onLogin={() => setAuth(true)} highlighted={target ? `${target.season}-${target.number}` : undefined}/>}
        </section> : <><AvailabilitySummary title={t}/><Sources title={t}/></>}
      </div>
    </div>}
    <AuthDialog open={auth} onClose={() => setAuth(false)}/>
  </Shell>;
}
