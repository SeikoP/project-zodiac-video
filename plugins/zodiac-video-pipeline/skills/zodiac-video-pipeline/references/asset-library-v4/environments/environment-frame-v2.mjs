// V4 Environment Frame @1 — authored, reusable spatial grammar, not a rendered backdrop.
// No new Job@5 fields: projection uses only existing entity state transforms/layers
// and spatial_bindings. Frames are authoring-only metadata discarded at handoff.
const STYLE='zodiac-paper-doodle-meme-v4';
const ROLES=new Set(['performer','listener','story_fixture','structural_fixture','foreground_fixture','hand_prop']);
const CONTACTS=new Set(['near','held_by','on_surface','emitted_by','points_to']);
const clone=x=>structuredClone(x);
const rect=t=>t&&['x','y','width','height'].every(k=>Number.isFinite(t[k]))&&t.width>0&&t.height>0;
const center=t=>({x:t.x+t.width/2,y:t.y+t.height/2});
const intersection=(a,b)=>({width:Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),height:Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y))});
const fail=(code,scene,context='')=>{throw new Error(`${code} scene=${scene?.id??'?'}${context?' '+context:''}`);};
const initial=e=>e?.states?.[e.initial_state];
const bounds=(t,scene,id)=>{if(!rect(t)||t.x<0||t.y<0||t.x+t.width>1080||t.y+t.height>1920)fail('FRAME_CANVAS_BOUNDS',scene,id);};
const validRole=(role,entity,scene)=>{
 if(!ROLES.has(role))fail('FRAME_ROLE_UNSUPPORTED',scene,role);
 if((role==='performer'||role==='listener')!==(entity.kind==='character'))fail('FRAME_ROLE_KIND_MISMATCH',scene,`${entity.id}/${role}`);
};

export function validateEnvironmentFrame(scene,assets,{styleToken=STYLE}={}){
 const frame=scene?.environment?.frame;if(!frame)return {skipped:true};
 if(frame.version!=='zodiac-environment-frame@1'||typeof frame.intent!=='string'||frame.intent.trim().length<8||!Array.isArray(frame.slots)||!frame.slots.length)
  fail('FRAME_CONTRACT_INVALID',scene);
 if(styleToken!==STYLE)fail('FRAME_TOKEN_MISMATCH',scene,'visual_system');
 const entities=new Map((scene.entities??[]).map(e=>[e.id,e]));const ids=new Set();let charCount=0,fixtureCount=0;
 for(const slot of frame.slots){
  if(!slot?.entity||ids.has(slot.entity)||!entities.has(slot.entity))fail('FRAME_SLOT_INVALID',scene,slot?.entity??'missing');
  ids.add(slot.entity);const e=entities.get(slot.entity);validRole(slot.role,e,scene);
  if(e.kind==='character')charCount++;else if(slot.role.endsWith('fixture'))fixtureCount++;
  bounds(slot.box,scene,slot.entity);const live=initial(e);if(!live)fail('FRAME_STATE_MISSING',scene,e.id);
  if(['x','y','width','height'].some(k=>live.transform[k]!==slot.box[k])||(slot.layer!==undefined&&live.layer!==slot.layer))fail('FRAME_SLOT_DRIFT',scene,e.id);
  if(slot.layer!==undefined&&(!Number.isInteger(slot.layer)||slot.layer<0||slot.layer>60))fail('FRAME_LAYER_INVALID',scene,e.id);
  if(slot.role==='foreground_fixture'&&(!Number.isInteger(slot.layer)||slot.layer<20))fail('FRAME_FOREGROUND_LAYER_REQUIRED',scene,e.id);
  for(const state of Object.values(e.states??{})){
   bounds(state.transform,scene,e.id);
   const asset=assets?.[state.asset];if(!asset||asset.style_id!==styleToken)fail('FRAME_TOKEN_MISMATCH',scene,`${e.id} asset=${state.asset}`);
  }
 }
 if(charCount<1||fixtureCount<1)fail('FRAME_NO_ACTING_SPACE',scene);
 const contacts=frame.contacts??[];
 if(!Array.isArray(contacts)||!contacts.some(c=>ids.has(c.entity)&&ids.has(c.anchor)&&entities.get(c.entity).kind==='character'||ids.has(c.entity)&&ids.has(c.anchor)&&entities.get(c.anchor).kind==='character'))fail('FRAME_NO_STORY_CONTACT',scene);
 const expected=[];
 for(const contact of contacts){
  const e=entities.get(contact?.entity),anchor=entities.get(contact?.anchor);
  if(!e||!anchor||e===anchor||!ids.has(e.id)||!ids.has(anchor.id)||!CONTACTS.has(contact.relation)||!Number.isFinite(contact.max_distance_px)||contact.max_distance_px<=0||contact.max_distance_px>1200)
   fail('FRAME_CONTACT_INVALID',scene,JSON.stringify(contact));
  const a=center(initial(e).transform),b=center(initial(anchor).transform);
  // Reject decorative "near" links stretched across an entire stage.
  if(Math.hypot(a.x-b.x,a.y-b.y)>Math.min(contact.max_distance_px,650))fail('FRAME_CONTACT_TOO_DISTANT',scene,`${e.id}->${anchor.id}`);
  const projected=(scene.spatial_bindings??[]).filter(b=>b.entity===contact.entity);
  if(projected.length!==1||projected[0].anchor!==contact.anchor||projected[0].relation!==contact.relation||projected[0].max_distance_px!==contact.max_distance_px)
   fail('FRAME_CONTACT_NOT_PROJECTED',scene,contact.entity);
  expected.push(contact);
 }
 const occlusions=frame.occlusions??[];
 if(!Array.isArray(occlusions))fail('FRAME_OCCLUSION_INVALID',scene);
 for(const rule of occlusions){
  const fixture=entities.get(rule.fixture),entry=frame.slots.find(s=>s.entity===rule.fixture);
  if(!fixture||entry?.role!=='foreground_fixture'||!Array.isArray(rule.actors)||!rule.actors.length)fail('FRAME_OCCLUSION_INVALID',scene,rule.fixture);
  const front=initial(fixture),frontBox=front.transform;
  for(const id of rule.actors){
   const actor=entities.get(id);if(!actor||actor.kind!=='character'||!ids.has(id))fail('FRAME_OCCLUSION_ACTOR_INVALID',scene,id);
   for(const state of Object.values(actor.states)){
    const body=state.transform,hit=intersection(frontBox,body);
    if(hit.width*hit.height<Math.min(11000,body.width*body.height*.07))fail('FRAME_NO_BODY_OCCLUSION',scene,id);
    const face={...body,height:body.height*.38};const faceHit=intersection(frontBox,face);
    if(faceHit.width*faceHit.height>face.width*face.height*.025)fail('FRAME_FACE_OCCLUSION',scene,id);
    if(front.layer<=state.layer)fail('FRAME_LAYER_OCCLUSION_MISMATCH',scene,id);
   }
  }
 }
 // The same geometry that produces the native preview is the geometry that
 // reaches Job@5. No unrecognized `occlusion_relations` fields are emitted.
 for(const rule of occlusions)if(!frame.slots.find(x=>x.entity===rule.fixture))fail('FRAME_OCCLUSION_INVALID',scene,rule.fixture);
 return {status:'PASS',slots:ids.size,contacts:expected.length,occlusions:occlusions.length};
}

export function applyEnvironmentFrame(scene,assets,{styleToken=STYLE}={}){
 if(!scene.environment?.frame)return clone(scene);
 const out=clone(scene),frame=out.environment.frame,entities=new Map((out.entities??[]).map(e=>[e.id,e]));
 if(!Array.isArray(frame.slots))fail('FRAME_CONTRACT_INVALID',out);
 for(const slot of frame.slots){
  const entity=entities.get(slot.entity),base=initial(entity)?.transform;
  if(!entity||!rect(base)||!rect(slot.box))fail('FRAME_SLOT_INVALID',out,slot.entity);
  const role=entity.kind==='character'?'character':slot.role==='structural_fixture'?'background':slot.role==='foreground_fixture'?'foreground_environment':'interactive_prop';
  if(entity.visual_role&&entity.visual_role!==role)fail('FRAME_ROLE_CONFLICT',out,entity.id);entity.visual_role=role;
  // Translate every state relative to the initial authored state so motion
  // and visual payoff transforms are not flattened by the layout compiler.
  const dx=slot.box.x-base.x,dy=slot.box.y-base.y,dw=slot.box.width-base.width,dh=slot.box.height-base.height;
  for(const state of Object.values(entity.states??{})){
   const t=state.transform;if(!rect(t))fail('FRAME_STATE_GEOMETRY',out,entity.id);
   state.transform={...t,x:t.x+dx,y:t.y+dy,width:t.width+dw,height:t.height+dh};
   if(slot.layer!==undefined)state.layer=slot.layer;
  }
 }
 const bindings=new Map((out.spatial_bindings??[]).map(b=>[b.entity,b]));
 for(const c of frame.contacts??[]){
  const previous=bindings.get(c.entity);if(previous&&(previous.anchor!==c.anchor||previous.relation!==c.relation))
   fail('FRAME_BINDING_CONFLICT',out,c.entity);
  bindings.set(c.entity,{entity:c.entity,anchor:c.anchor,relation:c.relation,max_distance_px:c.max_distance_px});
 }
 out.spatial_bindings=[...bindings.values()];
 validateEnvironmentFrame(out,assets,{styleToken});
 return out;
}
