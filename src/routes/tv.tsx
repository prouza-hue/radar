import {createFileRoute,Link} from "@tanstack/react-router";
import {useMutation,useQuery} from "convex/react";
import {useEffect,useRef,useState} from "react";
import {MonitorCheck,ShieldCheck} from "lucide-react";
import {api} from "../../convex/_generated/api";
import {Shell,PageHeading} from "@/components/radar";
import AuthDialog from "@/components/auth-dialog";
import {clearTvPairCode,pendingTvPairCode,rememberTvPairCode} from "@/lib/tvPairReturn";
import "../tv-pair.css";

export const Route=createFileRoute("/tv")({component:TvPairPage,head:()=>({meta:[{title:"Připojit televizi — Radar"},{name:"robots",content:"noindex, nofollow"},{name:"referrer",content:"no-referrer"}]})});
const normalize=(s:string)=>s.toUpperCase().replace(/[\s-]/g,"");
function TvPairPage(){
  const me=useQuery(api.library.me),inspect=useMutation(api.tvPairing.inspect),approve=useMutation(api.tvPairing.approve);
  const [code,setCode]=useState(""),[auth,setAuth]=useState(false),[busy,setBusy]=useState(false),[info,setInfo]=useState<any>(null),[error,setError]=useState("");
  const [confirmed,setConfirmed]=useState(false),[outcome,setOutcome]=useState(""),[now,setNow]=useState(Date.now());
  const [loaded,setLoaded]=useState(false),attempted=useRef("");
  useEffect(()=>{
    const params=new URLSearchParams(location.hash.slice(1));const raw=params.get("code");
    const value=normalize(raw||pendingTvPairCode()||"");
    if(/^[A-HJ-NP-Z2-9]{10}$/.test(value)){setCode(value);rememberTvPairCode(value);}
    if(raw)history.replaceState(null,"",location.pathname+location.search);
    setLoaded(true);const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);
  },[]);
  async function lookup(value:string){
    setBusy(true);setError("");setInfo(null);setConfirmed(false);
    try{const r=await inspect({code:value});if(!r.ok){setError(r.message||"Kód není platný.");return;}setInfo(r);}
    catch{setError("Spojení se nepodařilo. Zkus načíst kód znovu.");}finally{setBusy(false);}
  }
  useEffect(()=>{
    if(!loaded||!me||outcome||!/^[A-HJ-NP-Z2-9]{10}$/.test(code)||attempted.current===code)return;
    attempted.current=code;void lookup(code);
  },[loaded,!!me,code,outcome]);
  const expired=info&&info.expiresAt<=now;
  async function decide(value:boolean){
    if(busy||expired||!info)return;setBusy(true);setError("");
    try{const r=await approve({code,approved:value,confirmed:value&&confirmed});if(!r.ok){setError(r.message||"Připojení se nepodařilo.");return;}setOutcome(value?"approved":"denied");clearTvPairCode();}
    catch{setError("Potvrzení se nepodařilo odeslat. Zkus to znovu.");}finally{setBusy(false);}
  }
  return <Shell><PageHeading title="Připojit televizi" subtitle="Stejný Radar na telefonu i na velké obrazovce."/>
    <section className="tv-pair-card" data-testid="tv-pair-page" data-state={busy?"loading":outcome||"ready"}>
      {outcome?<><MonitorCheck size={30}/><h2>{outcome==="approved"?"Televize je potvrzená.":"Připojení zamítnuto."}</h2>
        <p>{outcome==="approved"?"Za chvíli se na ní objeví tvoje Moje a osobní doporučení. Tenhle telefon můžeš odložit.":"Tvůj účet se s touto televizí nepropojil."}</p>
        <Link className="secondary" to="/account">Připojené televize a účet</Link></>
      :<><form onSubmit={e=>{e.preventDefault();if(me){attempted.current=code;void lookup(code);}else{attempted.current="";rememberTvPairCode(code);setAuth(true);}}}>
        <label htmlFor="tv-code">Kód z televizoru</label><input id="tv-code" data-testid="tv-code" value={code} onChange={e=>{setCode(normalize(e.target.value).slice(0,10));setInfo(null);setConfirmed(false);}} placeholder="ABCDE-FGHJK" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={11}/>
        {me===undefined?<p>Ověřuji přihlášení…</p>:!me?<><p>Přihlas se ke <strong>stejnému účtu</strong>, ve kterém máš svoje tituly. Kód zůstane připravený.</p><button className="primary" type="submit" disabled={!/^[A-HJ-NP-Z2-9]{10}$/.test(code)}>Přihlásit se a pokračovat</button></>
          :!info&&<button className="secondary" type="submit" disabled={busy||!/^[A-HJ-NP-Z2-9]{10}$/.test(code)}>{busy?"Ověřuji…":"Ověřit kód"}</button>}
      </form>
      {info&&me&&<div className="tv-pair-confirm"><p>Připojuješ <strong>{info.deviceName}</strong> k účtu <strong>{me.email||me.name||"Radaru"}</strong>.</p>
        <p className="tv-confirm-code">{info.code}</p><p>Potvrď jen zařízení, které máš před sebou. Na jeho obrazovce musí být právě tento kód.</p>
        <label className="tv-confirm-check"><input type="checkbox" data-testid="tv-confirm-match" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Kód na mojí televizi souhlasí.</label>
        {expired?<p role="alert">Kód vypršel. Na televizi si nech zobrazit nový.</p>:<div className="tv-pair-actions"><button className="primary" data-testid="tv-approve" disabled={!confirmed||busy} onClick={()=>void decide(true)}>Připojit televizi</button><button className="secondary" disabled={busy} onClick={()=>void decide(false)}>Zamítnout</button></div>}
      </div>}
      {error&&<p role="alert" className="error">{error}</p>}<p className="fine"><ShieldCheck size={15}/> Televize získá samostatné přihlášení. V účtu ji můžeš kdykoli odpojit. Žádné heslo jí nepředáváš.</p></>}
    </section><AuthDialog open={auth&&!me} onClose={()=>setAuth(false)}/>
  </Shell>;
}
