import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {describeGallery} from '../tools/studio_project/visual_gallery.mjs';
import {describeAssets,findCandidates,safeSvg,assetUsage} from '../tools/studio_project/visual_candidates.mjs';
import {THEMES,resolvePaletteSvg,themeFingerprint} from '../tools/studio_project/visual_themes.mjs';
import {quality} from '../tools/studio_project/visual_preview.mjs';

test('gallery projects real character components, contexts and three distinct phone masters without retired scenes',async()=>{
 const g=await describeGallery();assert.equal(g.human_review,'PENDING');
 for(const role of ['body','hair','outfit','face','pose','expression','context','meme'])assert.ok(g.items.some(r=>r.role===role),role);
 assert.equal(new Set(g.items.map(r=>r.id)).size,g.items.length);
 for(const item of g.items){assert.match(item.source_sha256,/^[a-f0-9]{64}$/u);safeSvg(Buffer.from(item.preview_data_uri.split(',')[1],'base64'));}
 const phones=g.items.filter(r=>r.identity?.compatibility==='V5_MASTER');assert.equal(phones.length,3);assert.equal(new Set(phones.map(r=>r.identity.model_id)).size,3);
 assert.equal(new Set(phones.map(r=>Buffer.from(r.preview_data_uri.split(',')[1],'base64').toString().match(/d="([^"]+)"/u)[1])).size,3);
 assert.ok(phones.every(r=>r.slots.left_grip&&r.slots.right_grip&&r.identity.view_id==='front'));
 const old=g.items.filter(r=>['phone','phone-busy','phone-ping','phone-quiet','phone-silent'].includes(r.id));assert.equal(old.length,5);assert.equal(new Set(old.map(r=>r.identity.model_id)).size,1);
 assert.ok(!g.items.some(r=>r.role==='scene_set'));
});

test('semantic palettes resolve explicit slots and preserve untagged identity colors',()=>{
 const source='<svg><path data-palette-fill="surface_alt" fill="#000000"/><path fill="#F1C6A0"/></svg>';
 assert.notEqual(resolvePaletteSvg(source,'rose-social'),resolvePaletteSvg(source,'apricot-campus'));
 for(const id of Object.keys(THEMES)){const output=resolvePaletteSvg(source,id);assert.ok(output.includes('fill="#F1C6A0"'));assert.ok(quality({entities:[]},id).caption_contrast>=4.5);assert.match(themeFingerprint(id),/^[a-f0-9]{64}$/u);}
 assert.throws(()=>resolvePaletteSvg(source,'missing'),/VISUAL_THEME_UNKNOWN/u);
 assert.throws(()=>resolvePaletteSvg('<svg><path data-palette-fill="skin"/></svg>','dark'),/VISUAL_PALETTE_ROLE_UNKNOWN/u);
});

test('explicit unsupported phone model and view never substitute existing art',async()=>{
 const intent={assets:{phone:{path:'assets/phone.svg'}},scenes:[{id:'s01',semantic_goal:'chat',entities:[{id:'prop',kind:'prop',initial_state:'idle',states:{idle:{asset:'phone'}}}]}]};
 for(const requirement of [{family_id:'phone',model_id:'not-a-model'},{family_id:'phone',view_id:'three-quarter'}])assert.equal((await findCandidates(intent,'s01',requirement)).status,'NO_FIT_ASSET');
 const rows=(await describeAssets()).items;assert.ok(rows.some(r=>r.id==='phone-rounded'));
});

test('phone screen markings stay legible against their resolved screen in every palette',async()=>{
 const luminance=hex=>hex.slice(1).match(/../gu).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
 for(const model of ['phone-rounded','phone-compact','phone-angular']){
  const source=await readFile(new URL(`../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/props/${model}.svg`,import.meta.url),'utf8');
  for(const theme of Object.keys(THEMES)){
   const svg=resolvePaletteSvg(source,theme),screen=svg.match(/<rect\b[^>]*data-palette-fill="surface"[^>]*>/u)?.[0],mark=svg.match(/<path\b[^>]*data-palette-stroke="muted_ink"[^>]*>/u)?.[0];
   assert.ok(screen&&mark);
   const a=luminance(screen.match(/\sfill="(#[a-f0-9]{6})"/iu)[1]),b=luminance(mark.match(/\sstroke="(#[a-f0-9]{6})"/iu)[1]);
   assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${model}/${theme}: screen markings`);
  }
 }
});

test('metadata-only catalog changes invalidate outstanding candidate revisions',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'p5-catalog-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const module=path.join(root,'tools/studio_project/visual_candidates.mjs'),props=path.join(root,'plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/props');
 await mkdir(path.dirname(module),{recursive:true});await mkdir(props,{recursive:true});
 await copyFile(new URL('../tools/studio_project/visual_candidates.mjs',import.meta.url),module);
 const row={id:'phone',path:'props/phone.svg',role:'prop',contexts:['chat'],slots:{left_grip:[10,20]}};
 await writeFile(path.join(props,'phone.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 H20 V40Z"/></svg>');
 const catalog=path.join(props,'index.json');await writeFile(catalog,JSON.stringify({assets:[row]}));
 const {describeAssets}=await import(pathToFileURL(module).href),before=await describeAssets();
 row.contexts=['work'];row.slots.left_grip=[30,40];
 await writeFile(catalog,JSON.stringify({assets:[row]}));
 const after=await describeAssets();
 assert.equal(before.items[0].source_sha256,after.items[0].source_sha256);
 assert.notEqual(before.source_revision,after.source_revision);
});

test('source-bound usage matches bytes across local aliases and never penalizes unreviewed builds',async()=>{
 const row=(await describeAssets()).items.find(r=>r.id==='phone');
 const history={format:'zodiac-asset-usage@1',records:[{project_id:'old',episode_id:'previous-episode',build_id:'b'.repeat(32),manifest_sha256:'c'.repeat(64),source_sha256:'d'.repeat(64),review_status:'NOT_REVIEWED',assets:[{source_sha256:row.source_sha256,scene_ids:['s02']}]}],not_an_approval:true};
 const usage=assetUsage(row,history);
 assert.equal(usage.length,1);assert.deepEqual(usage[0].scene_ids,['s02']);
 assert.equal(usage[0].review_status,'NOT_REVIEWED');
 assert.equal(assetUsage({...row,source_sha256:'0'.repeat(64)},history).length,0);
 const intent={assets:{episode_alias:{path:'assets/phone.svg'}},scenes:[{id:'s01',semantic_goal:'chat',entities:[{id:'prop',kind:'prop',initial_state:'idle',states:{idle:{asset:'episode_alias'}}}]}]};
 const before=await findCandidates(intent,'s01',{asset_id:'phone'}),after=await findCandidates(intent,'s01',{asset_id:'phone'},history);
 assert.deepEqual(before.bundles.map(r=>r.asset_id),after.bundles.map(r=>r.asset_id));
 assert.equal(after.bundles[0].candidate_id,before.bundles[0].candidate_id);
 assert.deepEqual(after.bundles[0].usage,usage);
 assert.deepEqual(after.bundles[0].warnings,[]);
 const gallery=await describeGallery(history),phone=gallery.items.find(r=>r.id==='phone');
 assert.deepEqual(phone.usage,usage);assert.equal(gallery.usage_evidence.not_an_approval,true);
 assert.equal(gallery.items.find(r=>r.id==='phone-rounded').usage.length,0);
});
