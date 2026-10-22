import {createFileRoute,Link} from '@tanstack/react-router';
import {Authenticated,Unauthenticated,useMutation,useQuery} from 'convex/react';
import {useAuthActions} from '@convex-dev/auth/react';
import {api} from '../../convex/_generated/api';
import {Shell,PageHeading} from '@/components/radar';
import {AccountSecurity} from '@/components/account-security';
import {TvDevices} from '@/components/tv-devices';
import {PushControls,stopDevice} from '@/components/push-controls';
import {PersonalBackup} from '@/components/personal-backup';
import {useState} from 'react';
export const Route=createFileRoute('/account')({component:Account});
function Account(){
 const {signOut}=useAuthActions(),unsubscribe=useMutation(api.notifications.unsubscribe),session=useQuery(api.tvPairing.current);
 const [error,setError]=useState('');
 return <Shell><PageHeading title="Tvůj účet" subtitle="Přihlášení a upozornění pod kontrolou."/><Authenticated><div className="account-settings">
 {session===undefined?<p>Ověřuji přihlášení…</p>:session.signedIn?<section><h2>Původní účet je připojený</h2><p>{session.account?.email||session.account?.name}. Seznam a označení jsou společné s původním Radarem.</p><p className="fine">Přechodná relace nemá oprávnění spravovat ostatní zařízení nebo propojení Google.</p><a className="secondary" href="https://serialovy-radar.macaly.app/account" target="_blank" rel="noopener noreferrer">Správa účtu na původním Radaru ↗</a></section>:<><TvDevices/><section><AccountSecurity/><p className="fine">Pokud už máš seznam pod e-mailem, propojuj Google z tohoto účtu. Propojení vyžaduje přihlášení z posledních 10 minut.</p></section></>}
 <section><h2>Upozornění</h2><p>Nejdřív povol toto zařízení. Potom zapni zvoneček u titulů, které chceš sledovat.</p><PushControls/></section><PersonalBackup/>
 <button className="secondary" data-testid="sign-out" onClick={async()=>{try{await stopDevice(unsubscribe);await signOut()}catch{setError('Odhlášení se nepodařilo. Zkus to znovu.')}}}>Odhlásit se</button>{error&&<p role="alert">{error}</p>}
 </div></Authenticated><Unauthenticated><p>Přihlas se tlačítkem nahoře.</p><Link to="/">Zpět na radar</Link></Unauthenticated></Shell>;
}
