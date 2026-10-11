#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateHumanStroke} from './validate-human-stroke.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
const token=JSON.parse(await readFile(path.join(root,'foundations/style-token.json'),'utf8'));
const fail=(code,msg)=>{throw new Error(`${code}: ${msg}`);};
const packageRoot=process.argv[2];if(!packageRoot){console.error('Usage: node validate-production-style.mjs <package-root>');process.exit(2);}
const production=JSON.parse(await readFile(path.join(packageRoot,'production.json'),'utf8'));
const design=await readFile(path.join(packageRoot,'design.md'),'utf8');const m=design.match(/<!-- STYLE_TOKEN_BEGIN -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- STYLE_TOKEN_END -->/u);if(!m)fail('STYLE_TOKEN_V4_INVALID','design.md missing STYLE_TOKEN');let designToken;try{designToken=JSON.parse(m[1]);}catch(e){fail('STYLE_TOKEN_V4_INVALID','invalid STYLE_TOKEN JSON: '+e.message);}if(designToken.id!==token.id)fail('STYLE_TOKEN_V4_INVALID',`design token must be ${token.id}`);
if(designToken.version!==token.version||designToken.style_family!==token.family||designToken.handmade_profile!==token.handmade_profile||designToken.hard_style_lock!==true||designToken.handmade_imperfection?.profile!==token.handmade_profile)fail('STYLE_TOKEN_V4_INVALID','design token version, family, or handmade profile drifts from V4 foundation');
const cc=designToken.character_construction??{},contract=designToken.asset_style_contract??{};
if(cc.handmade_profile!==token.handmade_profile||cc.body_variation!==token.body_variation||cc.identity_rule!==token.identity_rule||!Array.isArray(cc.body_profiles)||cc.body_profiles.length<1||JSON.stringify(cc.sticker_edge_px_at_1080)!==JSON.stringify(token.sticker_edge_px_at_1080)||JSON.stringify(cc.outline_px_at_1080)!==JSON.stringify(token.character_outline_px_at_1080))fail('STYLE_TOKEN_V4_INVALID','character identity, authored variation, line weight, or sticker edge drifts from V4 contract');
if(contract.style_token!==token.id||contract.handmade_profile!==token.handmade_profile||contract.legacy_v3_direct_copy!==false||JSON.stringify(contract.prop_effect_source_stroke_px)!==JSON.stringify(token.prop_effect_source_stroke_px)||JSON.stringify(designToken.palette_roles)!==JSON.stringify(token.palette_roles))fail('STYLE_TOKEN_V4_INVALID','asset style contract must lock native V4 palette/strokes and forbid direct V3 geometry copies');
const designPalette=new Set(Object.values(designToken.palette_roles??{}).map(x=>String(x).toUpperCase()));if(token.palette.some(x=>!designPalette.has(x.toUpperCase())))fail('STYLE_TOKEN_V4_INVALID','design token palette omits colors from the canonical V4 foundation');
let checked=0,characters=0;
for(const [assetId,a] of Object.entries(production.assets??{})){
 if(a.style_id!==token.id)fail('STYLE_TOKEN_V4_INVALID',`${assetId} style_id must be ${token.id}`);
 if(a.lineage?.source_library==='zodiac-paper-doodle-asset-library-v3'&&a.lineage?.mode==='direct_copy')fail('V3_DIRECT_COPY_FORBIDDEN',`${assetId} may not direct-copy v3 geometry into v4 production`);
 if(typeof a.path!=='string'||!a.path.trim())fail('STYLE_TOKEN_V4_INVALID',`${assetId} missing path`);
 const svg=await readFile(path.resolve(packageRoot,a.path),'utf8');
 const category=String(a.category??'').toLowerCase();const kind=category==='character'?'character':category==='effect'||/\/effects\//u.test(a.path.replaceAll('\\','/'))?'support':'focal';
 try{validateHumanStroke(svg,kind);}catch(e){fail('HUMAN_STROKE_V2_INVALID',`${assetId}: ${e.message}`);}checked++;if(kind==='character')characters++;
}
console.log(`ASSET_STYLE_V4_PASS: assets=${checked} token=${token.id}`);console.log(`CHARACTER_HUMAN_STROKE_PASS: characters=${characters}`);
