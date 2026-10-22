export type Page = {page:any[];isDone:boolean;continueCursor:string};
export type BackupReader = {
  me:()=>Promise<{name?:string;email?:string}|null>;
  preferences:(cursor:string|null)=>Promise<Page>;
  records:(cursor:string|null)=>Promise<Page>;
  state:(key:string)=>Promise<any>;
};
const validKey=(key:unknown)=>typeof key==='string'&&/^(tmdb:(movie|tv)|tvmaze:tv):[0-9]+$/.test(key);
const fail=(message:string):never=>{throw new Error(message)};
async function pages(read:(cursor:string|null)=>Promise<Page>){
 const result:any[]=[];let cursor:string|null=null;const visited=new Set<string>();
 for(let i=0;i<10000;i++){
  const p=await read(cursor);
  if(!p||!Array.isArray(p.page)||typeof p.isDone!=='boolean')fail('Neplatná stránka exportu.');
  result.push(...p.page);
  if(result.length>100000)fail('Export překročil bezpečný limit.');
  if(p.isDone)return result;
  if(!p.continueCursor||visited.has(p.continueCursor))fail('Export se zastavil na opakovaném kurzoru.');
  visited.add(p.continueCursor);cursor=p.continueCursor;
 }
 return fail('Export nebyl úplně dočten.');
}
function preferenceMap(rows:any[]){
 const map=new Map<string,string>();
 for(const r of rows){
  if(!validKey(r.key)||map.has(r.key))fail('Neplatný nebo duplicitní titul v preferencích.');
  map.set(r.key,JSON.stringify([!!r.saved,!!r.liked,!!r.hidden,!!r.seen,r.revision||0]));
 }
 return map;
}
function same(a:Map<string,string>,b:Map<string,string>){return a.size===b.size&&[...a].every(([k,v])=>b.get(k)===v)}
function account(profile:any){return JSON.stringify([profile?.email||'',profile?.name||''])}

/** Read-only current-state backup. No auth token, API key or private push endpoint is serialized. */
export async function exportPersonalState(reader:BackupReader,webOrigin:string,now=new Date()){
 const me=await reader.me();if(!me)fail('Nejdřív se přihlas ke svému účtu.');
 const before=preferenceMap(await pages(reader.preferences));
 const source=await pages(reader.records), seenKeys=new Set<string>();
 let owner:string|null=null;
 const records=source.map(row=>{
  if(!validKey(row.titleKey)||seenKeys.has(row.titleKey))fail('Duplicitní nebo neplatný titul. Záloha nebyla dokončena.');
  seenKeys.add(row.titleKey);
  if(typeof row.userId!=='string'||!row.userId)fail('Chybí ověření vlastníka záznamu.');
  if(owner&&owner!==row.userId)fail('Během exportu se změnil účet.');owner=row.userId;
  if(row.progressLimited)fail('U některého seriálu API neposkytlo úplnou historii. Použij úplný databázový export.');
  if(!Number.isFinite(row.addedAt)||row.addedAt<0)fail('Chybí původní datum přidání.');
  const signature=JSON.stringify([row.saved!==false,!!row.liked,!!row.hidden,!!row.movieSeen,row.revision||0]);
  if(before.get(row.titleKey)!==signature)fail('Během exportu se změnil stav titulu. Zkus export znovu.');
  if(!Array.isArray(row.watched))fail('Chybí historie epizod.');
  const episodeKeys=new Set<string>();
  const watched=row.watched.map((e:any)=>{
   if(!Number.isInteger(e.season)||e.season<0||e.season>200||!Number.isInteger(e.number)||e.number<0||e.number>1000)fail('Neplatná epizoda.');
   const key=e.season+':'+e.number;if(episodeKeys.has(key))fail('Duplicitní epizoda.');episodeKeys.add(key);
   return {season:e.season,number:e.number};
  }).sort((a:any,b:any)=>a.season-b.season||a.number-b.number);
  return {titleKey:row.titleKey,addedAt:row.addedAt,saved:row.saved!==false,liked:!!row.liked,hidden:!!row.hidden,movieSeen:!!row.movieSeen,notifications:!!row.notifications,watched,
   title:row.title?{name:String(row.title.name||''),originalName:String(row.title.originalName||''),year:String(row.title.year||''),type:row.title.type,imdbId:typeof row.title.imdbId==='string'?row.title.imdbId:null}:null};
 });
 if(before.size!==records.length)fail('Počet titulů v exportu nesouhlasí s účtem.');
 const after=preferenceMap(await pages(reader.preferences));
 const lastMe=await reader.me();
 if(!lastMe||account(me)!==account(lastMe)||!same(before,after))fail('Účet nebo historie se během exportu změnily. Zkus to znovu.');
 if(records.length){const current=await reader.state(records[0].titleKey);if(!current||current.userId!==owner)fail('Přihlášený účet se změnil.');}
 records.sort((a,b)=>a.titleKey.localeCompare(b.titleKey));
 return {schema:'radar-personal-state',schemaVersion:1,scope:'current-personal-state',exportedAt:now.toISOString(),source:{webOrigin,account:{name:me!.name||'',email:me!.email||''},userId:owner},
  counts:{titles:records.length,saved:records.filter(r=>r.saved).length,liked:records.filter(r=>r.liked).length,hidden:records.filter(r=>r.hidden).length,seenMovies:records.filter(r=>r.movieSeen).length,watchedEpisodes:records.reduce((n,r)=>n+r.watched.length,0)},
  limitations:['Nejde o úplný export databáze ani přihlašovacích relací.','API nevrací původní časy zhlédnutí epizod ani zrušená označení.','Starší epizody bez vazby na titul nelze tímto čtecím API vyloučit; před exportem otevři Moje a nech doběhnout doplnění historie.'],records};
}
