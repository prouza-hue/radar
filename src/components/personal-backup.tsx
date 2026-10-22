import {useEffect,useRef,useState} from 'react';
import {useConvex,useQuery} from 'convex/react';
import {api} from '../../convex/_generated/api';
import {exportPersonalState} from '@/lib/personalBackup';
import {Link} from '@tanstack/react-router';
export function PersonalBackup(){
 const client=useConvex(),me=useQuery(api.library.me);const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<any>(null);const lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 async function download(){if(lock.current||!me)return;lock.current=true;setBusy(true);setError('');setResult(null);
  try{const data=await exportPersonalState({me:()=>client.query(api.library.me,{}),preferences:cursor=>client.query(api.overview.preferences,{paginationOpts:{numItems:100,cursor}}),records:cursor=>client.query(api.personal.records,{paginationOpts:{numItems:5,cursor}}),state:key=>client.query(api.personal.state,{key})},location.origin);
   if(!mounted.current)return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='radar-moje-data-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setResult(data.counts);
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Export se nepodařilo dokončit.');}finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 return <section className="backup-panel" data-testid="personal-backup"><h2>Záloha mých dat</h2><p>Uložené tituly, srdíčka, skryté tipy a označené epizody stáhneš do souboru. Nic neodešleme mimo tvůj prohlížeč a nic nepřepíšeme.</p><p className="fine">Před exportem otevři <Link to="/mine">Moje</Link> a nech doběhnout doplnění starší historie. Během exportu neměň označení na jiném zařízení.</p>{!me?<p>Přihlas se ke svému původnímu účtu.</p>:<button className="secondary" data-testid="download-personal-data" disabled={busy} onClick={()=>void download()}>{busy?'Kontroluji a připravuji zálohu…':'Stáhnout moje data'}</button>}{error&&<p className="error" role="alert">{error} Soubor nebyl označen za úspěšnou zálohu.</p>}{result&&<p role="status">Připraveno ke stažení: {result.titles} titulů a {result.watchedEpisodes} viděných epizod. Soubor si bezpečně uschovej; obsahuje tvůj e-mail a historii.</p>}<p className="fine">Jde o osobní seznam a současná označení, ne úplný export databáze. Neobsahuje hesla ani přihlášení; původní čas zhlédnutí epizod současné API neposkytuje.</p></section>;
}
