import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.RADAR_SMOKE_URL||'http://127.0.0.1:4173';
const out='qa-artifacts';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const width of [390,590,1280]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/search');await page.locator('[data-testid="search"]').waitFor();
  await page.locator('[data-testid="search"]').fill('Arrival');
  await page.locator('[data-testid="search-results"][data-state="ready"]').waitFor({timeout:90000});
  const card=page.locator('[data-title="tmdb:movie:329865"]');await card.waitFor();await card.locator('.poster-link').click();
  await page.locator('[data-testid="title-detail"][data-state="ready"]').waitFor({timeout:90000});
  assert.equal(await page.locator('[data-testid="stremio-link"]').getAttribute('href'),'stremio:///detail/movie/tt2543164');
  for(const dark of [false,true]){
   const now=await page.locator('html').evaluate(e=>e.classList.contains('dark'));
   if(now!==dark)await page.locator('[data-testid="theme-toggle"]').click();
   const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,bg:getComputedStyle(document.body).backgroundColor,width:innerWidth}));
   assert.equal(metrics.overflow,false,'overflow at '+width+' dark='+dark);results.push({width,dark,...metrics});
   await page.screenshot({path:out+'/arrival-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
  }
  await page.goto(base+'/connect');await page.locator('[data-testid="migration-connect"]').waitFor();
  assert.equal(await page.locator('[data-testid="migration-connect"]').getAttribute('data-state'),'idle');
  await page.goto(base+'/backup');await page.locator('[data-testid="personal-backup"]').waitFor();
  assert.equal(await page.locator('[data-testid="download-personal-data"]').count(),0,'anonymous export must be unavailable');
  assert.deepEqual(errors,[],'browser exceptions');await context.close();
 }
 await writeFile(out+'/smoke.json',JSON.stringify({origin:base,privateAccountTested:false,results},null,2));
 console.log('Anonymous real-data UI smoke passed at 390, 590 and 1280px, both themes. No private account writes.');
}finally{await browser.close();}
