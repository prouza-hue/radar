export type LibraryMediaFilter = 'all' | 'tv' | 'movie';
export const LIBRARY_MEDIA_STORAGE_KEY = 'radar-library-media';
export function parseLibraryMedia(value: unknown): LibraryMediaFilter {
  return value === 'tv' || value === 'movie' ? value : 'all';
}
export function filterLibraryRows<T extends {title:{type:string};progress:{status:string}}>(rows:T[],status:string,media:LibraryMediaFilter):T[]{
  return rows.filter(row=>(status==='all'||row.progress.status===status)&&(media==='all'||row.title.type===media));
}
