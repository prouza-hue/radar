import {createFileRoute,Link} from "@tanstack/react-router";
import {Authenticated,Unauthenticated,useMutation} from "convex/react";
import {useAuthActions} from "@convex-dev/auth/react";
import {api} from "../../convex/_generated/api";
import {Shell,PageHeading} from "@/components/radar";
import {AccountSecurity} from "@/components/account-security";
import {TvDevices} from "@/components/tv-devices";
import {PushControls,stopDevice} from "@/components/push-controls";
import {useState} from "react";
export const Route=createFileRoute("/account")({component:Account});
function Account(){const {signOut}=useAuthActions();const unsubscribe=useMutation(api.notifications.unsubscribe);const [error,setError]=useState("");return <Shell><PageHeading title="Tvůj účet" subtitle="Přihlášení a upozornění pod kontrolou."/><Authenticated><div className="account-settings"><TvDevices/><section><h2>Upozornění</h2><p>Nejdřív povol toto zařízení. Potom zapni zvoneček u titulů, které chceš sledovat.</p><PushControls/></section><section><AccountSecurity/><p className="fine">Pokud už máš seznam pod e-mailem, propojuj Google z tohoto účtu. Propojení vyžaduje přihlášení z posledních 10 minut.</p></section><button className="secondary" data-testid="sign-out" onClick={async()=>{try{await stopDevice(unsubscribe);await signOut()}catch{setError("Odhlášení se nepodařilo. Zkus to znovu.")}}}>Odhlásit se</button>{error&&<p role="alert">{error}</p>}</div></Authenticated><Unauthenticated><p>Přihlas se tlačítkem nahoře.</p><Link to="/">Zpět na radar</Link></Unauthenticated></Shell>}
