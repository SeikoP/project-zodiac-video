import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'meme-effect-pairs.json'),'utf8'));
const memes=JSON.parse(fs.readFileSync(path.join(root,'index.json'),'utf8'));
const effects=JSON.parse(fs.readFileSync(path.join(root,'../effects/meme-effect-catalog.json'),'utf8'));
const props=JSON.parse(fs.readFileSync(path.join(root,'../props/index.json'),'utf8'));
const ids=new Set(memes.compositions.map(x=>x.id)),fx=new Set(Object.keys(effects.effects)),ps=new Set(props.assets.map(x=>x.id));
const seen=new Set(); const problems=[];
for(const p of catalog.pairs){
 if(seen.has(p.id))problems.push(`duplicate ${p.id}`);seen.add(p.id);
 if(!ids.has(p.meme_template_id))problems.push(`missing meme ${p.id}`);
 if(!Array.isArray(p.effect_ids)||p.effect_ids.length<1)problems.push(`no effects ${p.id}`);
 for(const e of p.effect_ids||[])if(!fx.has(e))problems.push(`missing effect ${e}`);
 if(p.default_prop_id&&!ps.has(p.default_prop_id))problems.push(`missing prop ${p.default_prop_id}`);
 for(const f of ['trigger_condition','semantic_intent','motion_sequence'])if(!p[f])problems.push(`missing ${f} ${p.id}`);
 if(JSON.stringify(p.required_events)!==JSON.stringify(['enter','peak','release']))problems.push(`lifecycle ${p.id}`);
 if(!p.requirements?.anchor||!p.requirements?.contact||!p.requirements?.life_cycle)problems.push(`unanchored ${p.id}`);
}
if(problems.length){console.error(JSON.stringify({status:'FAIL',problems},null,2));process.exit(1)}
console.log(JSON.stringify({status:'PASS',pairs:catalog.pairs.length,memes:ids.size},null,2));
