import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [source,out]=process.argv.slice(2);
if(!source||!out)throw Error('Usage: node export_character_visual_baseline.mjs <source_repo> <output_dir>');
const compiler=resolve(source,'plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/characters/compile-character-assembly.mjs');
const {compileCharacterSvg}=await import(pathToFileURL(compiler));
const cases=[
 ['lean-explain',{entity_id:'a',body_profile:'lean_tall',hair_id:'spiky-overthink',face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'teal',accessory_id:'none',variant_seed:'baseline-a'},{pose_id:'explain',expression_id:'smug'}],
 ['round-offer',{entity_id:'b',body_profile:'round_soft',hair_id:'blocky-cut',face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'coral',accessory_id:'none',variant_seed:'baseline-b'},{pose_id:'offer',expression_id:'embarrassed'}],
 ['stocky-phone',{entity_id:'c',body_profile:'stocky_short',hair_id:'antenna-short',face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'ochre',accessory_id:'none',variant_seed:'baseline-c'},{pose_id:'text-phone',expression_id:'side-eye'}],
 ['petite-run',{entity_id:'d',body_profile:'petite_compact',hair_id:'asym-bang',face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'slate',accessory_id:'none',variant_seed:'baseline-d'},{pose_id:'run',expression_id:'panic'}]
];
await mkdir(out,{recursive:true});const report={source,sha:{}};
for(const [name,identity,state] of cases){
 const svg=compileCharacterSvg(identity,state).svg;
 await writeFile(join(out,name+'.svg'),svg);
 report.sha[name]=createHash('sha256').update(svg).digest('hex');
}
await writeFile(join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
