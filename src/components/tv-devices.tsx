import {Link} from "@tanstack/react-router";
import {useMutation,useQuery} from "convex/react";
import {useState} from "react";
import {api} from "../../convex/_generated/api";
import type {Id} from "../../convex/_generated/dataModel";
import "../tv-pair.css";

export function TvDevices(){
  const rows=useQuery(api.tvPairing.devices),revoke=useMutation(api.tvPairing.revoke);
  const [confirm,setConfirm]=useState<Id<"tvDevices">|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  return <section className="tv-devices" data-testid="tv-devices"><h2>Televize</h2><p>Spáruj TV přes kód nebo odpoj zařízení, které už nepoužíváš.</p>
    <Link className="secondary" to="/tv">Připojit televizi</Link>
    {rows===undefined?<p>Načítám zařízení…</p>:rows.length===0?<p className="fine">Zatím nemáš připojenou žádnou televizi.</p>:<div>{rows.map((r:any)=><article className="tv-device-row" key={r.id} data-device={r.id}><div><strong>{r.name}</strong><small>{r.active?"Připojeno":"Odpojeno / přihlášení vypršelo"} · {new Date(r.pairedAt).toLocaleDateString("cs-CZ")}</small></div>
      {r.active&&(confirm===r.id?<span className="tv-pair-actions"><button className="secondary" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{const result=await revoke({id:r.id});if(!result.ok)setError(result.message||"Odpojení se nepodařilo.");setConfirm(null);}catch{setError("Odpojení se nepodařilo. Zkus to znovu.");}finally{setBusy(false);}}}>Potvrdit odpojení</button><button className="quiet" disabled={busy} onClick={()=>setConfirm(null)}>Zrušit</button></span>
        :<button className="secondary" data-testid="tv-revoke" onClick={()=>setConfirm(r.id)}>Odpojit</button>)}
    </article>)}</div>}{error&&<p role="alert">{error}</p>}
  </section>;
}
