import {HeadContent,Scripts,createRootRoute} from '@tanstack/react-router';
import AppConvexProvider from '@/components/convex-client-provider';
import {IntentResume,Feedback} from '@/components/personal-controls';

export const Route=createRootRoute({
  head:()=>({meta:[{charSet:'utf-8'},{name:'viewport',content:'width=device-width, initial-scale=1, viewport-fit=cover'},{title:'Seriálový radar'},{name:'description',content:'Tvůj osobní přehled filmů a seriálů.'},{name:'theme-color',content:'#faf8f5'},{name:'robots',content:'noindex, nofollow'}],
    links:[{rel:'stylesheet',href:'/radar-original.css'},{rel:'stylesheet',href:'/tv-pair-original.css'},{rel:'stylesheet',href:'/migration-ui.css'},{rel:'icon',type:'image/svg+xml',href:'/favicon.svg'},{rel:'manifest',href:'/manifest.json'},{rel:'apple-touch-icon',href:'/logo192.png'}]}),
  shellComponent:RootDocument,
});
function RootDocument({children}:{children:React.ReactNode}){
  return <html lang="cs" suppressHydrationWarning><head><HeadContent/><script src="/theme.js"/></head><body><AppConvexProvider><IntentResume/><Feedback/>{children}</AppConvexProvider><Scripts/></body></html>;
}
