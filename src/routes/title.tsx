import {createFileRoute,Link} from '@tanstack/react-router';
import TitleDetail from '@/components/title-detail';
import {Shell} from '@/components/radar';
export const Route=createFileRoute('/title')({validateSearch:(search:Record<string,unknown>)=>({key:typeof search.key==='string'&&/^(tmdb:(tv|movie)|tvmaze:tv):[0-9]+$/.test(search.key)?search.key:''}),component:Page});
function Page(){const {key}=Route.useSearch();return key?<TitleDetail titleKey={key}/>:<Shell><p>Vyber film nebo seriál.</p><Link to="/search">Hledat titul</Link></Shell>;}
