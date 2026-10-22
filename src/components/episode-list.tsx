import {useRef, useState} from "react";
import {useQuery, useMutation} from "convex/react";
import {Check, Film, Eye, LoaderCircle} from "lucide-react";
import {api} from "../../convex/_generated/api";
import type {Episode} from "@/lib/types";
import {episodeCode, fullDate, today, relative} from "@/lib/format";
import {UndoNotice, feedback} from "./personal-controls";

export function EpisodeList({episodes, titleKey, season, onLogin, highlighted}: {
  episodes: Episode[]; titleKey: string; season: number; onLogin: () => void; highlighted?: string;
}) {
  const me = useQuery(api.library.me), watched = useQuery(api.watched.season, {titleKey, season});
  const setWatched = useMutation(api.watched.markReleased).withOptimisticUpdate((store, args) => {
    const queryArgs = {titleKey: args.titleKey, season: args.season};
    const old = store.getQuery(api.watched.season, queryArgs);
    if (old) store.setQuery(api.watched.season, queryArgs, args.watched ? [...new Set([...old, args.episode])] : old.filter(n => n !== args.episode));
  });
  const setSeason = useMutation(api.watched.changeSeason), lock = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]), [bulk, setBulk] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null), [error, setError] = useState(""), [result, setResult] = useState<any>(null);
  const day = today();
  const released = episodes.filter(e => e.date && e.date.slice(0, 10) <= day);
  const allSeen = released.length > 0 && released.every(e => watched?.includes(e.number));
  async function batch(value: boolean) {
    if (!me) {onLogin(); return;}
    if (bulk || lock.current.size) return;
    setBulk(true); setError("");
    try {
      const response = await setSeason({titleKey, season, watched: value});
      if (!response.ok) throw new Error(response.message);
      setResult(response);
    } catch {setError("Sezónu se nepodařilo uložit. Zkus to znovu.");}
    finally {setBulk(false);}
  }
  const sources = [...new Set(episodes.map(e => e.summarySource).filter(Boolean))].join(" · ");
  return <div className="episode-list compact-episodes" data-testid="episode-list"><div className="season-actions">
    <span>{episodes.filter(e => watched?.includes(e.number)).length} / {episodes.length} viděno</span>
    {!allSeen ? <button className="secondary" data-testid="season-watched" disabled={bulk || pending.length > 0 || !released.length || watched === undefined} onClick={() => void batch(true)}>
      {bulk ? "Ukládám…" : "Označit vydané díly"}</button> : <span><Check size={16}/>Vydané díly viděné</span>}
    {allSeen && <details><summary>Upravit označení</summary><button className="quiet" data-testid="season-unwatch" disabled={bulk || pending.length > 0} onClick={() => void batch(false)}>Odznačit vydané díly sezóny</button></details>}
  </div>{result && <UndoNotice result={result} label="Označení sezóny uloženo."/>}
  {episodes.map(e => {
    const identity = `${e.season}-${e.number}`, seen = watched?.includes(e.number) || false;
    const available = !!e.date && e.date.slice(0, 10) <= day;
    const waiting = pending.includes(identity);
    return <div id={`episode-${identity}`} className={`episode-item ${seen ? "watched" : ""} ${!available ? "future" : ""}`}
      data-episode={identity} data-current={highlighted === identity} key={identity}><div className="episode-compact-row">
      {e.thumbnail ? <img className="episode-thumb" src={e.thumbnail} alt="" loading="lazy"/> : <div className="episode-thumb missing"><Film size={20}/></div>}
      <button className="episode-text" aria-expanded={expanded === identity} aria-controls={`episode-description-${identity}`} onClick={() => setExpanded(expanded === identity ? null : identity)}>
        <strong><span>{episodeCode(e.season, e.number)}</span> {e.name}</strong>
        <span className="episode-inline-date">{e.date ? available ? fullDate(e.date) : `${relative(e.date)} · ${fullDate(e.date)}` : "Datum neznámé"}</span>
        <span className="episode-synopsis">{e.synopsis || "Synopse zatím není dostupná."}</span>
      </button>
      <div className="episode-rating">{e.rating ? <><strong>{e.rating.value.toFixed(1)}</strong><small>{e.rating.source}</small></> : <span>—</span>}</div>
      <button className={`watched-toggle ${seen ? "checked" : ""}`} data-testid="watched-toggle" data-episode={identity}
        aria-label={`${seen ? "Odznačit" : "Viděno:"} ${episodeCode(e.season, e.number)}`} aria-pressed={seen}
        title={!available && !seen ? "Vydání dílu zatím není potvrzené" : seen ? "Zrušit označení viděno" : "Označit jako viděno"}
        disabled={bulk || waiting || watched === undefined || (!available && !seen)} onClick={async () => {
          if (!me) {onLogin(); return;}
          if (lock.current.has(identity)) return;
          lock.current.add(identity); setPending([...lock.current]); setError("");
          try {
            const response = await setWatched({titleKey, season: e.season, episode: e.number, watched: !seen});
            if (!response.ok) {setError(response.message || "Změnu se nepodařilo uložit."); return;}
            feedback(response, `${episodeCode(e.season, e.number)}: ${seen ? "označení zrušeno" : "viděno"}.`);
          } catch {setError("Uložení se nepodařilo. Původní stav byl obnoven.");}
          finally {lock.current.delete(identity); setPending([...lock.current]);}
        }}>{waiting ? <LoaderCircle size={18} className="animate-spin"/> : seen ? <Check size={19}/> : <Eye size={19}/>}</button>
    </div><div id={`episode-description-${identity}`} hidden={expanded !== identity} className="episode-expanded"><p>{e.synopsis || "Synopse zatím není dostupná."}</p>
      <small>{fullDate(e.date)} · Původní vydání, dostupnost v ČR nepotvrzena. Synopse: {e.summarySource || "zdroj metadat"}
        {e.tvmazeUrl && <a href={e.tvmazeUrl} target="_blank" rel="noreferrer"> · TVmaze</a>}</small>
    </div></div>;
  })}
  {!!sources && <p className="episode-source">Metadata a synopse: {sources}.</p>}
  {error && <p role="alert" className="error">{error}</p>}
  </div>;
}
