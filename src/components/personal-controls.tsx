import {useEffect, useState, useRef} from "react";
import {Link, useRouter} from "@tanstack/react-router";
import {useAction, useMutation, useQuery} from "convex/react";
import {Sun, Moon, Plus, Check, Eye, Heart, ArrowLeft, X} from "lucide-react";
import {api} from "../../convex/_generated/api";
import AuthDialog from "./auth-dialog";

type Field = "saved" | "movieSeen" | "liked" | "hidden";
const paths = ["/", "/search", "/hot", "/mine"] as const;
type Origin = typeof paths[number];
export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const background = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
  if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", `hsl(${background})`);
}
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const media = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      let choice: string | null = null;
      try {choice = localStorage.getItem("radar-theme");} catch { /* Optional storage. */ }
      const next = choice === "dark" || (choice !== "light" && media.matches);
      applyTheme(next); setDark(next);
    };
    const onStorage = (e: StorageEvent) => {if (e.key === "radar-theme") sync();};
    media.addEventListener("change", sync); window.addEventListener("storage", onStorage);
    return () => {media.removeEventListener("change", sync); window.removeEventListener("storage", onStorage);};
  }, []);
  const label = dark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim";
  return <button type="button" className="theme-toggle" aria-label={label} title={label} data-testid="theme-toggle" onClick={() => {
    const next = !dark; setDark(next); applyTheme(next);
    try {localStorage.setItem("radar-theme", next ? "dark" : "light");} catch { /* In-memory switching remains available. */ }
  }}>{dark ? <Sun size={21}/> : <Moon size={21}/>}</button>;
}
function rememberOrigin(key: string) {
  try {
    const path = location.pathname;
    if (paths.includes(path as Origin)) {
      sessionStorage.setItem("radar-return", JSON.stringify({path, y: scrollY, key}));
      sessionStorage.setItem("radar-scroll:" + path, String(scrollY));
    }
  } catch { /* Navigation works without session storage. */ }
}
export function TitleLink({titleKey, children, ...props}: {titleKey: string; children: React.ReactNode; [key: string]: any}) {
  return <Link {...props} to="/title" search={{key: titleKey}} onClick={event => {
    props.onClick?.(event); if (!event.defaultPrevented) rememberOrigin(titleKey);
  }}>{children}</Link>;
}
export function useTitleOrigin(titleKey?: string) {
  const [path, setPath] = useState<Origin>("/mine");
  useEffect(() => {
    setPath("/mine");
    try {
      const origin = JSON.parse(sessionStorage.getItem("radar-return") || "null");
      const key = titleKey || new URLSearchParams(location.search).get("key");
      if (origin?.key === key && paths.includes(origin.path)) setPath(origin.path);
    } catch { /* Safe fallback for direct links. */ }
  }, [titleKey]);
  return path;
}
export function BackLink({titleKey}: {titleKey?: string}) {
  const path = useTitleOrigin(titleKey);
  return <Link className="back-link" to={path} resetScroll={false}><ArrowLeft size={17}/>{
    {"/": "Zpět domů", "/search": "Zpět na hledání", "/hot": "Zpět do Objevuj", "/mine": "Zpět do Mých"}[path]
  }</Link>;
}
export function restoreScroll() {
  try {
    const key = "radar-scroll:" + location.pathname, value = sessionStorage.getItem(key);
    if (value === null) return;
    sessionStorage.removeItem(key);
    requestAnimationFrame(() => scrollTo({top: Math.max(0, Number(value) || 0), behavior: "instant"}));
  } catch { /* Optional persistence. */ }
}
export function feedback(result: any, label: string) {
  window.dispatchEvent(new CustomEvent("radar-feedback", {detail: {result, label}}));
}
export function UndoNotice({result, label}: {result: any; label: string}) {
  const undo = useMutation(api.personal.undo);
  const [text, setText] = useState(label), [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false), [expired, setExpired] = useState(false);
  useEffect(() => {
    setText(label); setDone(false); setExpired(false);
    const timer = setTimeout(() => setExpired(true), 12000); return () => clearTimeout(timer);
  }, [result, label]);
  return <span className="undo-notice" role="status">{text}{result?.undoId && !done && !expired &&
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const response = await undo({id: result.undoId}); setText(response.message || "Vráceno."); setDone(response.ok);
        if (response.ok) window.dispatchEvent(new CustomEvent("radar-undone"));
      } catch {setText("Vrácení se nepodařilo. Zkus to znovu.");} finally {setBusy(false);}
    }}>Vrátit</button>}
  </span>;
}
export function rememberIntent(key: string, field: Field, stayOnCard = false) {
  rememberOrigin(key);
  sessionStorage.setItem("radar-intent", JSON.stringify({key, field, value: true, requestId: crypto.randomUUID(), createdAt: Date.now(),
    listPath: stayOnCard && paths.includes(location.pathname as Origin) ? location.pathname : undefined}));
}
function actionMessage(field: Field, active: boolean) {
  if (field === "saved") return active ? "Odebráno z Mých." : "Přidáno do Mých.";
  if (field === "liked") return active ? "Už se nepočítá mezi oblíbené." : "Zapamatováno pro další tipy.";
  if (field === "hidden") return active ? "Tip znovu povolen." : "Tento tip už nebudeme nabízet.";
  return active ? "Označení viděno zrušeno." : "Film označen jako viděný.";
}
export function IntentResume() {
  const me = useQuery(api.library.me), detail = useAction(api.catalog.detail);
  const change = useMutation(api.personal.change), router = useRouter(), running = useRef(false);
  const [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!me || running.current) return;
    let intent: any;
    try {intent = JSON.parse(sessionStorage.getItem("radar-intent") || "null");} catch {return;}
    if (!intent || !["saved", "liked", "hidden", "movieSeen"].includes(intent.field) || Date.now() - intent.createdAt > 1800000) {
      sessionStorage.removeItem("radar-intent"); return;
    }
    running.current = true;
    (async () => {
      try {
        await detail({key: intent.key});
        const result = await change({key: intent.key, field: intent.field, value: intent.value, requestId: intent.requestId});
        if (!result.ok) throw new Error(result.message);
        sessionStorage.removeItem("radar-intent"); setError("");
        if (paths.includes(intent.listPath)) await router.navigate({to: intent.listPath as Origin, resetScroll: false});
        else await router.navigate({to: "/title", search: {key: intent.key}});
        feedback(result, actionMessage(intent.field, false));
      } catch {setError("Původní akci se nepodařilo dokončit.");} finally {running.current = false;}
    })();
  }, [me, attempt, change, detail, router]);
  return error ? <div className="resume-error" role="alert">{error}<button onClick={() => setAttempt(n => n + 1)}>Zkusit znovu</button></div> : null;
}
export function PersonalButton({titleKey, field = "saved", compact = false, emphasis = "subtle"}: {
  titleKey: string; field?: Field; compact?: boolean; emphasis?: "primary" | "subtle";
}) {
  const row = useQuery(api.personal.state, {key: titleKey}), me = useQuery(api.library.me);
  const detail = useAction(api.catalog.detail);
  const change = useMutation(api.personal.change).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.personal.state, {key: args.key});
    if (current) store.setQuery(api.personal.state, {key: args.key}, {...current, [args.field]: args.value});
  });
  const [busy, setBusy] = useState(false), lock = useRef(false), [auth, setAuth] = useState(false), [message, setMessage] = useState("");
  // Also cover the first action on a title with no relation yet. No synthetic DB IDs.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const persisted = field === "saved" ? !!row && row.saved !== false : !!row?.[field];
  const active = optimistic ?? persisted;
  const Icon = field === "hidden" ? X : field === "liked" ? Heart : field === "movieSeen" ? (active ? Check : Eye) : active ? Check : Plus;
  const label = field === "saved" ? (active ? "Uloženo" : "Chci vidět") : field === "liked" ? "Líbí se mi" : field === "hidden" ? "Nezobrazovat" : "Viděno";
  const hint = field === "saved" && active ? "Odebrat z Mých" : field === "liked" && active ? "Zrušit Líbí se mi" : field === "movieSeen" && active ? "Zrušit označení viděno" : field === "hidden" ? "Nezobrazovat v Objevuj" : label;
  const className = compact ? `card-action card-action-${field} ${active ? "is-active" : ""}` : field === "hidden" ? "quiet hide-tip" : `${emphasis === "primary" ? "primary" : "secondary subtle"} personal-action`;
  return <><button type="button" data-testid={`personal-${field}`} data-title-key={titleKey} className={className} aria-label={label} title={hint} aria-pressed={active} aria-busy={busy}
    disabled={busy || row === undefined || me === undefined} onClick={async event => {
      event.stopPropagation();
      if (lock.current) return;
      if (!me) {rememberIntent(titleKey, field, compact); setAuth(true); return;}
      const before = active;
      lock.current = true; setBusy(true); setMessage(""); setOptimistic(!before);
      try {
        if (!row) await detail({key: titleKey});
        const result = await change({key: titleKey, field, value: !before});
        if (!result.ok) throw new Error(result.message);
        feedback(result, actionMessage(field, before));
      } catch {setMessage("Změnu se nepodařilo uložit. Původní stav byl obnoven.");}
      finally {setOptimistic(null); lock.current = false; setBusy(false);}
    }}><Icon size={compact ? 20 : 18} fill={field === "liked" && active ? "currentColor" : "none"}/>{!compact && label}</button>
    {message && <span className="quick-error" role="alert">{message}</span>}
    <AuthDialog open={auth} onClose={() => setAuth(false)}/>
  </>;
}
export function Feedback() {
  const [notice, setNotice] = useState<any>(null);
  useEffect(() => {
    const handler = (event: Event) => setNotice((event as CustomEvent).detail);
    window.addEventListener("radar-feedback", handler); return () => window.removeEventListener("radar-feedback", handler);
  }, []);
  useEffect(() => {if (!notice) return; const timer = setTimeout(() => setNotice(null), 13000); return () => clearTimeout(timer);}, [notice]);
  return notice ? <div className="global-feedback"><UndoNotice result={notice.result} label={notice.label}/></div> : null;
}
