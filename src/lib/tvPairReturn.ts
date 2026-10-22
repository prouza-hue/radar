const KEY="radar-tv-pair-return";
export function rememberTvPairCode(code:string){
  if(!/^[A-HJ-NP-Z2-9]{10}$/.test(code))return;
  try{sessionStorage.setItem(KEY,JSON.stringify({code,expiresAt:Date.now()+10*60_000}));}catch{}
}
export function pendingTvPairCode():string|null{
  try{const row=JSON.parse(sessionStorage.getItem(KEY)||"null");return row&&row.expiresAt>Date.now()&&/^[A-HJ-NP-Z2-9]{10}$/.test(row.code)?row.code:null;}catch{return null;}
}
export function clearTvPairCode(){try{sessionStorage.removeItem(KEY);}catch{}}
export function tvReturnAfterLogin(){return pendingTvPairCode()?"/tv":"/";}
