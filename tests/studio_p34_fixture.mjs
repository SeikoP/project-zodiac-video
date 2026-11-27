// Synthetic technical fixture with real V4 character definitions. Never a creative approval.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const sha=x=>createHash('sha256').update(x).digest('hex');
const reference=JSON.parse(await readFile(new URL('./fixtures/phase2-gemini/visual-intent.json',import.meta.url),'utf8'));

export function makeFixture(narration=Array.from({length:8},(_,i)=>`Song Tử hỏi thêm câu ${i+1}.`).join('\n'),count=8){
  const words=[...narration.matchAll(/\S+/gu)],step=Math.ceil(words.length/count),scenes=[];
  let start=0;
  for(let i=0;i<count;i++){
    const stop=i===count-1?Buffer.byteLength(narration):Buffer.byteLength(narration.slice(0,words[Math.min(words.length-1,(i+1)*step)]?.index??narration.length));
    if(stop<=start)break;
    const text=Buffer.from(narration).subarray(start,stop).toString('utf8'),tokens=text.trim().split(/\s+/u);
    const scene={id:'s'+String(i+1).padStart(2,'0'),narration_range:[start,stop],semantic_goal:'Actor hỏi thêm và phản ứng với điện thoại; synthetic technical fixture.',
      grammar:{frame_id:'single-character-focus',mechanic_id:'explain',bindings:{subject:'gemini'}},
      entities:[{id:'gemini',kind:'character',initial_state:'neutral',visual_role:'character',states:Object.fromEntries(['neutral','asking','realizing'].map(s=>[s,{asset:'future-character',visible:true,layer:20,transform:{x:240,y:480,width:480,height:800}}]))},
        {id:'phone',kind:'object',visual_role:'interactive_prop',initial_state:'idle',states:{idle:{asset:'phone',visible:true,layer:25,transform:{x:760,y:760,width:180,height:260}}}}],
      events:tokens.length>=2?[{id:'ask',target:'gemini',state_before:'neutral',state_after:'asking',trigger:{type:'voice_anchor',text:tokens[Math.min(1,tokens.length-2)]},motion:{preset:'state_swap',duration_frames:12}},
        {id:'react',target:'gemini',state_before:'asking',state_after:'realizing',trigger:{type:'voice_anchor',text:tokens.at(-1)},motion:{preset:'state_swap',duration_frames:6,duration_override:true}}]:[]};
    scenes.push(scene);start=stop;
  }
  if(scenes.length && start<Buffer.byteLength(narration))scenes.at(-1).narration_range[1]=Buffer.byteLength(narration);
  const actor=structuredClone(reference.cast[0]);
  // This new synthetic actor uses current component IDs; old episode source is never migrated implicitly.
  Object.assign(actor,{hair_id:'high-tied-ponytail',face_profile_id:'balanced',outfit_id:'plain-shirt'});
  if(actor.visual_identity_intent?.identity_lock)for(const key of Object.keys(actor.visual_identity_intent.identity_lock))actor.visual_identity_intent.identity_lock[key]=actor[key];
  actor.design_intent.scene_anchor={...actor.design_intent.scene_anchor,scene_id:scenes[0].id,excerpt:Buffer.from(narration).subarray(...scenes[0].narration_range).toString('utf8').trim()};
  const castPlan=structuredClone(reference.episode_cast_plan);castPlan.bindings=castPlan.bindings.filter(b=>b.entity_id==='gemini').map(b=>({...b,scene_ids:scenes.map(s=>s.id)}));
  return {format:'zodiac-visual-intent@1',narration_sha256:sha(narration),video:{width:1080,height:1920,fps:30},
    cast:[actor],episode_cast_plan:castPlan,
    assets:{phone:{path:'library:props/phone.svg',category:'prop'}},scenes};
}

export function syntheticTiming(narration){const words=[...narration.matchAll(/\S+/gu)].map((m,i)=>({text:m[0],startMs:i*250,endMs:(i+1)*250,source_range:[Buffer.byteLength(narration.slice(0,m.index)),Buffer.byteLength(narration.slice(0,m.index+m[0].length))]}));return {format:'zodiac-speech-time-map@2',source:'measured_asr',fixture_classification:'SYNTHETIC_TEST_TIMING_NOT_REAL_ASR',narration_sha256:sha(narration),wav_sha256:'f'.repeat(64),duration_seconds:words.length*.25,words};}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const narration=process.argv[3]?await readFile(process.argv[3],'utf8'):undefined;
  await writeFile(process.argv[2],JSON.stringify(makeFixture(narration,Number(process.argv[4]??8)),null,2));
}
