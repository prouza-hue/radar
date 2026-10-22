import {createRouter as createTanStackRouter, Link} from '@tanstack/react-router';
import {routeTree} from './routeTree.gen';

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration:true,
    defaultPreload:'intent',
    defaultPreloadStaleTime:0,
    defaultNotFoundComponent:()=> <main className="app-shell"><h1>Stránka tu není.</h1><Link to="/">Zpět na Radar</Link></main>,
    defaultErrorComponent:({reset})=> <main className="app-shell"><h1>Stránku se nepodařilo načíst.</h1><button className="secondary" onClick={reset}>Zkusit znovu</button></main>,
  });
}
declare module '@tanstack/react-router' {interface Register {router:ReturnType<typeof getRouter>}}
