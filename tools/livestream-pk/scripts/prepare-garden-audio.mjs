// Original physical-style textures: filtered water/leaf noise, wood resonators and soft bells.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const ROLE_GROUPS={
 care:['plant','water','help','harvest','fertilize','pestClear','weedClear','softBlocked'],
 social:['levelUp','tierUnlock','achievement','theft','catch','shieldBlock'],
 gift:['dew','star','rain','wheelStart','wheelTick','wheelResult','meteorFly','meteorImpact','quake'],
 boss:['bossIntro','bossHit','bossGiftHit','bossWin','bossEscape'],
 session:['roundStart','podium','reward','roundEnd'],weather:['rainStart','pestsStart','merchantStart','goldenStart'],
};
const doubles=new Set([...ROLE_GROUPS.care.filter(r=>r!=='softBlocked'),...ROLE_GROUPS.social,'wheelResult']);
const sha=b=>createHash('sha256').update(b).digest('hex');
const dest=path.join(root,'public/garden/audio'),catalogFile=path.join(root,'garden/audio-catalog.json');
export function checkCatalog(catalog,directory=dest){
 const roles=Object.values(ROLE_GROUPS).flat();if(Object.keys(catalog.roles??{}).length!==36||catalog.assets?.length!==50)throw Error('Expected 36 roles / 50 original samples');
 const declared=new Set(catalog.assets.map(a=>a.file));
 for(const role of roles){const def=catalog.roles[role];if(!def?.files?.length||def.files.some(f=>!declared.has(f)||!/^[a-zA-Z][\w-]*\.wav$/.test(f)))throw Error('Invalid role '+role);}
 for(const a of catalog.assets){
  if(!/^[a-zA-Z][\w-]*\.wav$/.test(a.file)||!a.sourceUrl||!a.licenseId||!Number.isFinite(a.durationMs)||a.durationMs<=0)throw Error('Invalid asset '+a.file);
  const file=path.join(directory,a.file);if(sha(fs.readFileSync(file))!==a.sha256)throw Error('Checksum mismatch '+a.file);
 }
 return {roles:36,samples:50,listeningPending:catalog.assets.filter(a=>a.reviewStatus!=='listening-approved').length};
}
function waveform(role,variant){
 const water=/water|help|rain|dew/i.test(role),leaf=/plant|harvest|fertilize|pestClear|weedClear|theft/i.test(role),heavy=/boss|meteor|quake/i.test(role),tick=role==='wheelTick';
 const seconds=tick?.075:water?.9:leaf?.55:heavy?1.2:.8,rate=22050,n=Math.ceil(seconds*rate),pcm=Buffer.alloc(n*2);
 let seed=parseInt(sha(Buffer.from(role+variant)).slice(0,8),16)>>>0,low=0;
 const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296*2-1;};
 for(let i=0;i<n;i++){
  const t=i/rate,fade=Math.min(1,t/.012,(seconds-t)/.04),noise=rnd();low+=.12*(noise-low);
  let value=0;
  if(water){value=low*.55*(.55+.45*Math.sin(t*31)**2);for(let j=0;j<7;j++){const u=t-j*.105;if(u>=0)value+=Math.sin(2*Math.PI*(620+variant*38+j*91)*u+7*Math.exp(-u*23))*Math.exp(-u*38)*.21;}}
  else if(leaf){const env=Math.exp(-t*8);value=(noise-low)*env*.22+Math.sin(2*Math.PI*(155+variant*19)*t)*env*.26+low*Math.exp(-Math.abs(t-.19)*22)*.28;}
  else if(heavy){value=Math.sin(2*Math.PI*(72+variant*7)*t)*Math.exp(-t*6)*.33+Math.sin(2*Math.PI*143*t)*Math.exp(-t*9)*.12+low*.3*Math.exp(-t*5);}
  else {const base=(role==='softBlocked'?280:440)+variant*26;for(let j=0;j<(tick?1:3);j++){const u=t-j*.115;if(u>=0)value+=(Math.sin(2*Math.PI*base*[1,1.25,1.5][j]*u)+.15*Math.sin(2*Math.PI*base*2.76*u))*Math.exp(-u*(tick?65:8))*.18;}}
  pcm.writeInt16LE(Math.round(Math.max(-.72,Math.min(.72,value))*Math.max(0,fade)*32767),i*2);
 }
 const wav=Buffer.alloc(44);wav.write('RIFF');wav.writeUInt32LE(36+pcm.length,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);
 return {buffer:Buffer.concat([wav,pcm]),durationMs:Math.round(seconds*1000)};
}
export function prepareAudio({from,check=false}={}){
 if(check)return checkCatalog(JSON.parse(fs.readFileSync(catalogFile,'utf8')));
 const imported=from?JSON.parse(fs.readFileSync(path.join(path.resolve(from),'audio-catalog.json'),'utf8')):null;
 if(imported)checkCatalog(imported,path.resolve(from));
 const catalog={version:1,style:'organic-water-soil-leaves-soft-bells',generatedBy:'scripts/prepare-garden-audio.mjs',roles:{},assets:[]};
 const staging=fs.mkdtempSync(path.join(os.tmpdir(),'garden-audio-')),outputs=[];
 try{
  for(const [group,roles] of Object.entries(ROLE_GROUPS))for(const role of roles){
   const files=[];
   for(let variant=1;variant<=(doubles.has(role)?2:1);variant++){
    const file=`${role}-${variant}.wav`,wave=waveform(role,variant),output=path.join(staging,file);
    if(from){const input=path.join(path.resolve(from),file);fs.copyFileSync(input,output);}else fs.writeFileSync(output,wave.buffer);
    const bytes=fs.readFileSync(output);if(bytes.length<100)throw Error('Invalid WAV '+file);
    files.push(file);outputs.push({file,bytes});
    catalog.assets.push(imported?structuredClone(imported.assets.find(a=>a.file===file)):{id:`garden-${role}-${variant}`,file,durationMs:wave.durationMs,sourceUrl:'repo:scripts/prepare-garden-audio.mjs',author:'Garden project original procedural audio',licenseId:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',retrievedAt:'2026-11-05',sha256:sha(bytes),trimStartMs:0,trimEndMs:wave.durationMs,gainDb:0,tags:[group,role,'organic'],reviewStatus:'listening-pending'});
   }
   catalog.roles[role]=imported?structuredClone(imported.roles[role]):{files,gain:1,cooldownMs:role==='bossHit'?180:group==='care'?250:1500,priority:group==='care'?1:group==='boss'?5:3,maxDurationMs:2000,fallback:/water|help|rain|dew/i.test(role)?'flow':/boss|meteor|quake/i.test(role)?'bossHit':'sparkle',group:group==='care'?'care':'event'};
  }
  checkCatalog(catalog,staging);
  fs.mkdirSync(dest,{recursive:true});for(const {file,bytes} of outputs)fs.writeFileSync(path.join(dest,file),bytes);
  fs.writeFileSync(catalogFile,JSON.stringify(catalog,null,2)+'\n');
  fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({version:1,style:catalog.style,listeningPending:catalog.assets.filter(a=>a.reviewStatus!=='listening-approved').length,roles:catalog.roles,assets:catalog.assets},null,2)+'\n');
  fs.writeFileSync(path.join(dest,'LICENSES.md'),imported?'# Garden imported SFX\n\nSource and rights per asset: garden/audio-catalog.json. Import preserves supplied provenance and checksums; it does not grant new rights.\n':'# Garden original SFX\n\n50 original procedural sound samples generated by scripts/prepare-garden-audio.mjs. No third-party recordings or music were used. Dedicated under CC0-1.0; see the original generator for reproducibility.\n\nStyle: water, soil, leaves, wood resonators, soft bells. Human listening review and TikTok LIVE Studio mix acceptance are pending. Hashes and source metadata are in garden/audio-catalog.json.\n');
  return checkCatalog(catalog);
 }finally{for(const f of fs.readdirSync(staging))fs.unlinkSync(path.join(staging,f));fs.rmdirSync(staging);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const index=process.argv.indexOf('--from');console.log(JSON.stringify(prepareAudio({check:process.argv.includes('--check'),from:index>=0?process.argv[index+1]:undefined})));}catch(e){console.error(e.message);process.exitCode=1;}
}
