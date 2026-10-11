// LEGACY COMPATIBILITY VALIDATOR: historical Kim Nguu fixture only. Fresh Phase02 uses validate-phase02-art-direction.mjs.
#!/usr/bin/env node
// Creative coverage gate: reviews semantic art direction before Phase-02 compilation.
// Does not impersonate existing native validators or user Visual Review.
import fs from 'node:fs';
import path from 'node:path';
const ws=process.argv[2];
if(!ws){console.error('Usage: node validate-scene-art-direction.mjs <workspace>');process.exit(2)}
const read=p=>JSON.parse(fs.readFileSync(path.join(ws,p),'utf8'));
const plan=read('.authoring/scene-art-direction.json');
const narrative=fs.readFileSync(path.join(ws,'narration.txt'),'utf8').replaceAll('\r\n','\n').trim();
const index=read('art-direction/palette-registry.json');
const source=read('art-direction/environment-registry.json');
const errors=[];const fail=(code,at)=>errors.push({code,at});
const scenes=plan.scenes??[],ids=new Set(),positions=[];let reconstructed='';
if(plan.format!=='zodiac-scene-art-direction@1')fail('FORMAT','plan');
if(!Array.isArray(scenes)||scenes.length<5)fail('SCENE_UNDERSEGMENTED','minimum five voiced segments');
const anchorUses=[];const shots=new Set(),environments=new Set(),palettes=new Set();
for(let i=0;i<scenes.length;i++){
 const s=scenes[i],label=s.id??String(i);if(ids.has(s.id))fail('DUPLICATE_SCENE',label);ids.add(s.id);
 if(typeof s.voice!=='string'||!s.voice.trim())fail('VOICE_MISSING',label);
 reconstructed+=s.voice;
 if(!source.profiles.includes(s.environment_profile))fail('NON_NATIVE_ENVIRONMENT',label);
 if(!index.palettes[s.palette_id])fail('PALETTE_UNKNOWN',label);
 if(!['wide-environment','medium-character','reaction-closeup','prop-insert','two-person','caption-led'].includes(s.shot))fail('SHOT_INVALID',label);
 if(!s.performer||!s.action||!s.semantic_goal||!s.key_visual||!Array.isArray(s.required_entities)||!s.required_entities.includes('kimnguu'))fail('PERFORMANCE_INCOMPLETE',label);
 if(!s.color_reason||!s.environment_reason||!s.shot_reason)fail('ART_DECISION_UNEXPLAINED',label);
 if(s.story_object){anchorUses.push(i);
  if(s.story_object.id!=='anchor'||!['setup','friction','payoff'].includes(s.story_object.role)||!s.story_object.voice_anchor||!s.voice.includes(s.story_object.voice_anchor))fail('STORY_OBJECT_INVALID',label);
  if(s.story_object.render_layer!=='prop'||s.story_object.replaces_environment===true)fail('STORY_OBJECT_BACKDROP_TAKEOVER',label);
  if(!s.required_entities.includes('anchor'))fail('STORY_OBJECT_ENTITY_MISSING',label);
 }else if(s.required_entities.includes('anchor'))fail('UNAUTHORED_STORY_OBJECT',label);
 if(!s.animation||!s.animation.owner||!s.animation.effect_reason)fail('ANIMATION_INTENT_MISSING',label);
 environments.add(s.environment_profile);palettes.add(s.palette_id);shots.add(s.shot);
}
const norm=t=>String(t??'').replaceAll('\r\n','\n').trim().replace(/\s+/gu,' ');
if(norm(reconstructed)!==norm(narrative))fail('NARRATION_COVERAGE_MISMATCH','scenes.voice');
if(anchorUses.length>Math.ceil(scenes.length*0.45))fail('STORY_OBJECT_OVERUSE',anchorUses.join(','));
if(anchorUses.length===scenes.length)fail('STORY_OBJECT_PERSISTENT','all scenes');
if(environments.size<3)fail('ENVIRONMENT_VARIETY_INSUFFICIENT','3 native profiles minimum');
if(palettes.size<3)fail('PALETTE_VARIETY_INSUFFICIENT','3 purposeful palette ids minimum');
if(shots.size<3)fail('SHOT_VARIETY_INSUFFICIENT','3 shots minimum');
if(!scenes.some(s=>s.required_entities.includes('chair')&&s.required_entities.includes('impact_fx')))fail('CHAIR_GAG_MISSING','physical scene');
if(!scenes.some(s=>s.required_entities.includes('cafe_sign')))fail('CAFE_GAG_MISSING','physical scene');
if(!scenes.some(s=>s.required_entities.includes('attendance')))fail('ATTENDANCE_GAG_MISSING','physical scene');
const result={format:'zodiac-scene-art-direction-qc@1',status:errors.length?'BLOCKED':'PASS',scenes:scenes.length,story_object_scenes:anchorUses.length,environment_count:environments.size,palette_count:palettes.size,shot_count:shots.size,errors};
fs.mkdirSync(path.join(ws,'.authoring'),{recursive:true});fs.writeFileSync(path.join(ws,'.authoring/scene-art-direction-qc.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
