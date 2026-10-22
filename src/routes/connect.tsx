import {createFileRoute,Link} from '@tanstack/react-router';
import {useEffect,useRef,useState} from 'react';
import {useAction,useMutation,useQuery} from 'convex/react';
import {useAuthActions} from '@convex-dev/auth/react';
import {api} from '../../convex/_generated/api';
import {Shell,PageHeading} from '@/components/radar';
export const Route=createFileRoute('/connect')({component:Connect,head:()=>({meta:[{name:'robots',content:'noindex,nofollow'},{name:'referrer',content:'no-referrer'}]})});
function Connect(){
 const start=useAction(api.tvPairingStart.start),poll=useMutation(api.tvPairing.poll),cancel=useMutation(api.tvPairing.cancel),{signIn}=useAuthActions(),me=useQuery(api.library.me);
 const [stage,setStage]=useState('idle'),[code,setCode]=useState(''),[error,setError]=useState(''),[expires,setExpires]=useState(0);
 const secret=useRef<string|null>(null),generation=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null),busy=useRef(false);
 function stop(){generation.current++;if(timer.current)clearTimeout(timer.current);const old=secret.current;secret.current=null;busy.current=false;if(old)void cancel({secret:old}).catch(()=>{});}
 useEffect(()=>()=>stop(),[]);
 async function begin(){if(busy.current)return;stop();busy.current=true;const id=generation.current;setStage('starting');setError('');
  const proof=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');secret.current=proof;
  try{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(proof));const challenge=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   const created=await start({challenge,deviceName:'Radar web – přenos'});
   if(generation.current!==id){void cancel({secret:proof}).catch(()=>{});return;}
   if(!created.ok)throw new Error(created.message||'Kód se nepodařilo vytvořit.');setCode(created.userCode);setExpires(created.expiresAt);setStage('pending');
   const check=async()=>{if(generation.current!==id)return;if(Date.now()>=created.expiresAt){stop();setStage('expired');return;}
    try{const p=await poll({secret:proof});if(generation.current!==id)return;
     if(p.status==='approved'){setStage('signing-in');await signIn('tv-device',{secret:proof});if(generation.current!==id)return;secret.current=null;busy.current=false;setStage('complete');return;}
     if(p.status==='denied'||p.status==='expired'){stop();setStage(p.status);return;}
     timer.current=setTimeout(check,Math.max(5000,Number(p.interval||5)*1000));
    }catch{if(generation.current===id){stop();setError('Připojení se nepodařilo. Vytvoř nový kód; tvoje data se nemění.');setStage('error');}}
   };timer.current=setTimeout(check,Math.max(5000,Number(created.interval||5)*1000));
  }catch(e){if(generation.current===id){stop();setError(e instanceof Error?e.message:'Připojení není dostupné.');setStage('error');}}
 }
 const approval='https://serialovy-radar.macaly.app/tv#code='+encodeURIComponent(code);
 return <Shell><PageHeading title="Připojit původní účet" subtitle="Stejné tituly a označení. Žádný nový prázdný účet."/><section className="backup-panel" data-testid="migration-connect" data-state={stage}>
 {me?<><h2>Připojeno: {me.email||me.name||'tvůj účet'}</h2><p>Tento web používá stejnou databázi jako původní Radar a tvoje TV.</p><div className="migration-actions"><Link className="primary" to="/mine">Otevřít Moje</Link><Link className="secondary" to="/backup">Stáhnout zálohu</Link></div></>:stage==='pending'||stage==='signing-in'?<><h2>Potvrď tento kód na původním Radaru</h2><p className="migration-code">{code}</p><p>Otevři potvrzení, přihlas se ke svému dosavadnímu účtu a zkontroluj shodný kód. Původní stránka jej označuje jako připojení televize; zařízení se jmenuje <strong>Radar web – přenos</strong>.</p><a className="primary" href={approval} target="_blank" rel="noopener noreferrer">Otevřít potvrzení v původním Radaru</a><p role="status">{stage==='signing-in'?'Dokončuji připojení…':'Čekám na tvoje výslovné potvrzení.'}</p><p className="fine">Platnost do {new Date(expires).toLocaleTimeString('cs-CZ')}. Nikam neposílej přihlašovací token ani heslo.</p><button className="quiet" onClick={()=>{stop();setStage('idle');setCode('')}}>Zrušit připojení</button></>:<><p>Nová adresa zatím nemá vlastní Google autorizaci. Bezpečně ji připojíme přes existující jednorázové párování; původní účet zůstane zachovaný.</p>{stage==='expired'&&<p>Kód vypršel. Vytvoř nový.</p>}{stage==='denied'&&<p>Připojení bylo zamítnuté.</p>}<button className="primary" disabled={stage==='starting'} onClick={()=>void begin()}>{stage==='starting'?'Připravuji kód…':'Vytvořit připojovací kód'}</button></>}
 {error&&<p role="alert" className="error">{error}</p>}<p className="fine">Je to přechodný přístup během migrace, nikoli samostatný přesun databáze. Správu Google přihlášení a ostatních zařízení dál prováděj na původním webu.</p></section></Shell>;
}
