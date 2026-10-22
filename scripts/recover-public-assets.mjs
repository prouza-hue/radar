import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root='https://serialovy-radar.macaly.app';
const assets=[
 ['public/radar-original.css',root+'/assets/index-BEZxYLFr.css','10a85cb4ff13537d10ccbba92d973f9bf68bc1a1613b3f4eeb2fd19c4f2d4a4a'],
 ['public/tv-pair-original.css',root+'/assets/tv-pair-CL1YC0bV.css','f198bdc255f3ad806a39f1bedd3742421080708eb68c38793450a174f881e0a6'],
 ['public/theme.js',root+'/theme.js','a4ce9cf4ad2a7c39f3ac8b77c19f13938253f95135ad292395d2b02cc3d118cf'],
 ['public/favicon.svg',root+'/favicon.svg','8b54cd3f1614539f78f48b7c9bce1e4dc87aee188ac9b74c2f0ed2ea8b8ae648'],
 ['public/logo192.png',root+'/logo192.png','6510047d4dec05f523a62f95fb9f7d7b0c24b8682163ca8ba94bc7f78edfd999'],
 ['public/logo512.png',root+'/logo512.png','ca6c5cb1e0a5c5fb40322cdba569c150e85d12586d297cae5a76788c40f31c3e'],
 ['public/manifest.json',root+'/manifest.json','1d6a55d588dac375a3928fbe2886addd0ba19cb5a70fe6211a4c9208d55dd691'],
 ['public/downloads/Radar-TV-1.0.1.apk','https://assets.macaly-user-data.dev/CRtkra9G4860EqBgyG8blgXv/souhypaclxa4ykckh7w2pp77/8tXug0KsI3WmHi-xgfCPu/radar-tv-1-0-1-xiIL3UI_.apk','fba44a5d591a7c1e9dd43ba30e1ae094bf3d87d7614c56a98912b81be6e9accc'],
];
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const [path,url,expected] of assets){
 let bytes;try{bytes=await readFile(path);}catch{}
 if(bytes&&hash(bytes)===expected){console.log('Verified local',path);continue;}
 const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw new Error('Asset unavailable '+path+' HTTP '+response.status);
 bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length>5_000_000||hash(bytes)!==expected)throw new Error('Asset checksum differs: '+path);
 await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);console.log('Recovered and verified',path);
}
await mkdir('migration',{recursive:true});
await writeFile('migration/PUBLIC_ASSETS.json',JSON.stringify({kind:'original-public-build-not-source',assets:assets.map(([path,url,sha256])=>({path,url,sha256}))},null,2)+'\n');
