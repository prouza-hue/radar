import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.RADAR_SMOKE_URL||'http://127.0.0.1:4173';
const out='qa-artifacts';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const width of [390,590,1280]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')console.error('BROWSER',m.text())});
  try{
   console.log('OPEN SEARCH',width);await page.goto(base+'/search',{waitUntil:'domcontentloaded'});
   await page.locator('[data-testid="search"]').waitFor();
   await page.locator('[data-testid="search"]').fill('Arrival');
   console.log('WAIT LIVE RESULTS',width);await page.locator('[data-testid="search-results"][data-state="ready"]').waitFor({timeout:90000});
   const card=page.locator('[data-title="tmdb:movie:329865"]');await card.waitFor();await card.locator('.poster-link').click();
   console.log('WAIT DETAIL',width);await page.locator('[data-testid="title-detail"][data-state="ready"]').waitFor({timeout:90000});
   assert.equal(await page.locator('[data-testid="stremio-link"]').getAttribute('href'),'stremio:///detail/movie/tt2543164');
   for(const dark of [false,true]){
    const now=await page.locator('html').evaluate(e=>e.classList.contains('dark'));
    if(now!==dark)await page.locator('[data-testid="theme-toggle"]').click();
    const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,bg:getComputedStyle(document.body).backgroundColor,width:innerWidth}));
    assert.equal(metrics.overflow,false,'overflow at '+width+' dark='+dark);results.push({width,dark,...metrics});
    await page.screenshot({path:out+'/arrival-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
   }
   console.log('CHECK CONNECT AND EXPORT GUARDS',width);
   await page.goto(base+'/connect',{waitUntil:'domcontentloaded'});await page.locator('[data-testid="migration-connect"]').waitFor();
   assert.equal(await page.locator('[data-testid="migration-connect"]').getAttribute('data-state'),'idle');
   await page.goto(base+'/backup',{waitUntil:'domcontentloaded'});await page.locator('[data-testid="personal-backup"]').waitFor();
   assert.equal(await page.locator('[data-testid="download-personal-data"]').count(),0,'anonymous export must be unavailable');
   assert.deepEqual(errors,[],'browser exceptions');console.log('PASSED VIEWPORT',width);
  }catch(e){
   await page.screenshot({path:out+'/failure-'+width+'.png',fullPage:true}).catch(()=>{});
   await writeFile(out+'/failure-'+width+'.html',await page.content());
   await writeFile(out+'/failure-'+width+'.json',JSON.stringify({url:page.url(),errors,message:String(e)},null,2));
   throw e;
  }finally{await context.close();}
 }
 await writeFile(out+'/smoke.json',JSON.stringify({origin:base,privateAccountTested:false,results},null,2));
 console.log('Anonymous real-data UI smoke passed at 390, 590 and 1280px, both themes. No private account writes.');
}finally{await browser.close();}
