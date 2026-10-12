import {readFile} from 'node:fs/promises';

const stateId=(beat,index)=>{
 const role=String(beat?.role??'state').replace(/[^a-z0-9_-]+/giu,'-').toLowerCase();
 return role+'-'+String(index+1).padStart(2,'0');
};

export function projectStoryObjectPlan(plan){
 if(!plan||!['zodiac-story-object-plan@1','zodiac-story-object-plan@2'].includes(plan.format))throw new Error('STORY_OBJECT_COMPAT_FORMAT_INVALID');
 const central=plan.central_metaphor??{};
 const states={};const cues=[];
 for(const [index,beat] of (plan.beats??[]).entries()){
  const state=stateId(beat,index);
  states[state]={
   visual_read:String(beat?.visual_change??beat?.semantic_delta?.after_read??state),
   signature:String(beat?.visual_change??beat?.semantic_delta?.after_read??state)
  };
  cues.push({
   scene_id:beat?.scene_id,
   voice_anchor:beat?.voice_anchor,
   state,
   relation:{mode:beat?.presentation_mode==='physical_interaction'?'anchored_to_scene':'near',anchor:'character.lead'},
   compatibility:{beat_id:beat?.beat_id,object_entity:beat?.object_entity}
  });
 }
 return {
  format:'zodiac-visual-metaphor-plan@1',
  decision:{mode:(plan.beats??[]).length?'required':'omitted',reason:'Projected from approved legacy Story Object plan',review_ref:'compat:'+String(central.id??'story-object')},
  metaphors:(plan.beats??[]).length?[{
   id:String(central.id??'legacy-story-object'),
   meaning:String(central.meaning??central.payoff_transformation??'Legacy visual metaphor'),
   visual_states:states,cues
  }]:[],
  compatibility:{source_format:plan.format,source_semantics:'story_object',projection_only:true}
 };
}

export async function projectLegacyStoryObjectFile(file){
 const raw=await readFile(file,'utf8');
 return projectStoryObjectPlan(JSON.parse(raw));
}
