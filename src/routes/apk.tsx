import {createFileRoute} from '@tanstack/react-router';
import {Shell,PageHeading} from '@/components/radar';
export const Route=createFileRoute('/apk')({component:()=> <Shell><PageHeading title="Radar TV" subtitle="Aplikace pro Android TV a Nokia 8010."/><section className="about"><a className="primary" href="/downloads/Radar-TV-1.0.1.apk" download="Radar-TV-1.0.1.apk">Stáhnout APK 1.0.1</a><p>Nainstaluj přes současnou aplikaci, bez odinstalování. Jde o původní podepsanou verzi se Stremiem a Jellyfinem. Dosavadní server a párovací adresa zůstávají stejné.</p></section></Shell>});
