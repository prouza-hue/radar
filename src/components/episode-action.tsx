import {useRef, useState} from "react";
import {useMutation, useQuery} from "convex/react";
import {Check, Eye, LoaderCircle} from "lucide-react";
import {api} from "../../convex/_generated/api";
import {episodeCode} from "@/lib/format";
import {feedback} from "./personal-controls";

export function QuickSeenButton({titleKey, season, episode, compact = false, onLogin, onBegin, onSettled}: {
  titleKey: string; season: number; episode: number; compact?: boolean;
  onLogin?: () => void; onBegin?: () => void; onSettled?: (ok: boolean) => void;
}) {
  const me = useQuery(api.library.me);
  const watched = useQuery(api.watched.season, {titleKey, season});
  const change = useMutation(api.watched.markReleased).withOptimisticUpdate((store, args) => {
    const queryArgs = {titleKey: args.titleKey, season: args.season};
    const old = store.getQuery(api.watched.season, queryArgs);
    if (old) store.setQuery(api.watched.season, queryArgs, args.watched
      ? [...new Set([...old, args.episode])] : old.filter(n => n !== args.episode));
    const progress = store.getQuery(api.personal.progress, {key: args.titleKey});
    if (progress) {
      const others = progress.watched.filter((e: any) => e.season !== args.season || e.number !== args.episode);
      store.setQuery(api.personal.progress, {key: args.titleKey}, {...progress, watched: args.watched
        ? [...others, {season: args.season, number: args.episode}] : others});
    }
  });
  const lock = useRef(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const seen = !!watched?.includes(episode), code = episodeCode(season, episode);
  return <div className="episode-action"><button className={`quick-seen ${compact ? "compact" : ""}`} data-testid="quick-seen"
    data-episode={`${season}-${episode}`} aria-label={`${seen ? "Odznačit" : "Označit jako viděno"}: ${code}`}
    aria-pressed={seen} title={`${seen ? "Odznačit" : "Viděno"}: ${code}`} disabled={busy || watched === undefined}
    onClick={async () => {
      if (lock.current) return;
      if (!me) { onLogin?.(); return; }
      lock.current = true; setBusy(true); setError(""); onBegin?.();
      let ok = false;
      try {
        const result = await change({titleKey, season, episode, watched: !seen});
        if (!result.ok) { setError(result.message || "Označení se nepodařilo uložit."); return; }
        ok = true;
        feedback(result, `${code}: ${seen ? "označení zrušeno" : "viděno"}.`);
      } catch { setError("Změna se neuložila. Původní stav byl obnoven."); }
      finally { lock.current = false; setBusy(false); onSettled?.(ok); }
    }}>{busy ? <LoaderCircle size={18} className="animate-spin"/> : seen ? <Check size={18}/> : <Eye size={18}/>}<span>{seen ? "Viděno" : "Označit viděno"}</span></button>
    {error && <p className="quick-error" role="alert">{error}</p>}
  </div>;
}
