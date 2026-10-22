import {useEffect, useRef, useState} from "react";
import {useMutation, useQuery} from "convex/react";
import {Bell, BellOff, Check} from "lucide-react";
import {api} from "../../convex/_generated/api";
import {feedback} from "./personal-controls";

function applicationKey(value: string) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
export async function stopDevice(unsubscribe: (args: {endpoint: string}) => Promise<any>) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    const result = await unsubscribe({endpoint: subscription.endpoint});
    if (!result.ok) throw new Error("Odběr se nepodařilo odpojit.");
    await subscription.unsubscribe();
  }
}
export function PushControls({titleKey, onLogin, allSeries = false}: {titleKey?: string; onLogin?: () => void; allSeries?: boolean}) {
  const [endpoint, setEndpoint] = useState<string | undefined>();
  const me = useQuery(api.library.me), config = useQuery(api.notifications.settings, {endpoint});
  const member = useQuery(api.library.membership, titleKey ? {key: titleKey} : "skip");
  const subscribe = useMutation(api.notifications.subscribe), unsubscribe = useMutation(api.notifications.unsubscribe);
  const save = useMutation(api.library.setSaved), reminder = useMutation(api.reminders.set), test = useMutation(api.notifications.test), enableAll = useMutation(api.reminders.enableAll);
  const delivery = useQuery(api.notifications.latestTest, me ? {} : "skip");
  const [supported, setSupported] = useState<boolean | null>(null), [enabled, setEnabled] = useState(false), [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), lock = useRef(false);
  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    const refresh = () => {
      if (!ok) return;
      setPermission(Notification.permission);
      navigator.serviceWorker.getRegistration("/").then(r => r?.pushManager.getSubscription()).then(s => {setEnabled(!!s); setEndpoint(s?.endpoint);}).catch(() => setEnabled(false));
    };
    refresh(); window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  async function enable() {
    if (!me) {onLogin?.(); return;}
    if (config?.testing) {setMessage("V tomto preview se push neodesílá. Produkční odběry zůstávají beze změny."); return;}
    if (!supported) {setMessage("Tento prohlížeč push nepodporuje. Zkus aktuální Chrome nebo Samsung Internet."); return;}
    if (!config?.ready || !config.publicKey) {setMessage("Odesílání zatím není dostupné."); return;}
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const result = await Notification.requestPermission(); setPermission(result);
      if (result !== "granted") throw new Error("Upozornění nejsou povolená. Změň oprávnění webu v prohlížeči.");
      await navigator.serviceWorker.register("/sw.js");
      const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Aktivace trvá příliš dlouho. Obnov stránku.")), 12000))]);
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: applicationKey(config.publicKey)});
      const payload = subscription.toJSON();
      if (!payload.keys?.p256dh || !payload.keys.auth) throw new Error("Prohlížeč neposkytl údaje pro odběr.");
      const registered = await subscribe({endpoint: subscription.endpoint, p256dh: payload.keys.p256dh, auth: payload.keys.auth});
      if (!registered.ok) throw new Error(registered.message);
      setEnabled(true); setEndpoint(subscription.endpoint);
      if (titleKey) {
        const saved = await save({key: titleKey, saved: true}); if (!saved.ok) throw new Error(saved.message);
        const subscribed = await reminder({key: titleKey, enabled: true}); if (!subscribed.ok) throw new Error(subscribed.message);
        feedback(subscribed, "Odběr titulu zapnutý.");
        setMessage(subscribed.dayBefore && subscribed.onRelease ? "Upozorníme tě den před vydáním a při vydání, podle dosavadního nastavení."
          : subscribed.onRelease ? "Upozorníme tě při vydání." : subscribed.dayBefore ? "Upozorníme tě den před vydáním." : "Odběr je uložený; časové upozornění máš v preferencích vypnuté.");
      } else if (allSeries) {
        const subscribed = await enableAll({}); if (!subscribed.ok) throw new Error(subscribed.message);
        feedback(subscribed, subscribed.message); setMessage("");
      } else setMessage("Upozornění jsou na tomto zařízení zapnutá.");
    } catch (error) {setMessage(error instanceof Error ? error.message : "Zapnutí se nepodařilo. Otevři preview přímo v prohlížeči a zkus to znovu.");}
    finally {lock.current = false; setBusy(false);}
  }
  async function toggle() {
    if (config?.testing) {setMessage("V tomto preview se push neodesílá. Produkční odběry zůstávají beze změny."); return;}
    if (!titleKey || !member?.notifications) {await enable(); return;}
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const result = await reminder({key: titleKey, enabled: false});
      if (!result.ok) throw new Error(result.message);
      feedback(result, "Odběr titulu vypnutý."); setMessage("");
    } catch {setMessage("Vypnutí se nepodařilo.");}
    finally {lock.current = false; setBusy(false);}
  }
  const registeredHere = enabled && config?.registered && permission === "granted";
  const label = busy ? "Nastavuji…" : titleKey && member?.notifications ? "Odběr titulu zapnutý"
    : allSeries ? "Zapnout u všech uložených seriálů" : titleKey ? "Upozornit při vydání" : registeredHere ? "Obnovit odběr na zařízení" : "Zapnout upozornění";
  return <div className="push-controls" data-testid="push-controls"><button className={titleKey ? "quiet" : "secondary"} disabled={busy || supported === null || !config}
    data-testid="enable-push" aria-pressed={!!member?.notifications} onClick={() => void toggle()}>
    {titleKey && member?.notifications ? <Check size={17}/> : <Bell size={17}/>} {label}</button>
    {titleKey && member?.notifications && !config?.testing && <p className="fine">{registeredHere ? "Toto zařízení má povolená oznámení." : "Odběr je uložený, ale toto zařízení oznámení nepřijímá."}</p>}
    {titleKey && member?.notifications && !registeredHere && !config?.testing && <button className="quiet" disabled={busy} onClick={() => void enable()}>Povolit toto zařízení</button>}
    {!titleKey && !allSeries && enabled && <><button className="secondary" disabled={busy || config?.testing} data-testid="test-push" onClick={async () => {
      setBusy(true); try {const result = await test({}); setMessage(result.message);} catch {setMessage("Test se nepodařilo odeslat.");} finally {setBusy(false);}
    }}>Poslat testovací upozornění</button><button className="quiet" disabled={busy || config?.testing} onClick={async () => {
      setBusy(true); try {await stopDevice(unsubscribe); setEnabled(false); setEndpoint(undefined); setMessage("Toto zařízení už nebude dostávat upozornění.");} catch {setMessage("Odpojení se nepodařilo.");} finally {setBusy(false);}
    }}><BellOff size={16}/>Vypnout na tomto zařízení</button></>}
    {message && <p className="push-message" role="status">{message}</p>}
    {!titleKey && !allSeries && config?.testing && <p className="fine">Testovací prostředí: skutečné odesílání je vypnuté.</p>}
    {!titleKey && !allSeries && delivery && <p className="fine" data-testid="push-delivery">{delivery.sent ? "Push služba přijala testovací zprávu." : delivery.pending ? "Zpráva čeká na odeslání / opakování." : "Test se nepodařilo doručit. Zkus odběr vypnout a znovu zapnout."}</p>}
    {supported === false && <p className="fine">Push vyžaduje podporovaný prohlížeč. Na iOS také instalaci na plochu.</p>}
  </div>;
}
