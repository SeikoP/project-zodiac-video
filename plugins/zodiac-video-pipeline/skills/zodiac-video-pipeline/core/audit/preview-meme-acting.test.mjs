import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {compileCharacterSvg} from '../../references/asset-library-v4/characters/compile-character-assembly.mjs';
import {assertJob5VisualRoleSizes} from '../../phases/phase03/compile-job-v5.mjs';
import {resolveHandoffLayout} from '../../phases/phase03/handoff-preflight.mjs';
const script=fileURLToPath(new URL('./preview-meme-acting.mjs',import.meta.url));
const run=root=>spawnSync(process.execPath,[script,root],{encoding:'utf8',timeout:15000});

test('demo refuses an existing authoring directory without touching its sources',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'z-demo-protect-'));
 try{
  await writeFile(path.join(root,'production.json'),'keep this production');
  const result=run(root);assert.notEqual(result.status,0);
  assert.equal(await readFile(path.join(root,'production.json'),'utf8'),'keep this production');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('demo can rerun its own output but never a pipeline workspace',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'z-demo-rerun-'));
 try{
  for(let i=0;i<2;i++){const result=run(root);assert.equal(result.status,0,result.stderr);}
  const receipt=JSON.parse(await readFile(path.join(root,'meme-demo-receipt.json'))),html=await readFile(path.join(root,'index.html'),'utf8');
  const registry=JSON.parse(await readFile(new URL('../../references/asset-library-v4/memes/index.json',import.meta.url)));
  const catalog=JSON.parse(await readFile(new URL('../../references/asset-library-v4/characters/components/catalog.json',import.meta.url)));
  assert.equal(receipt.meme_count,registry.compositions.length);assert.equal(receipt.pose_count,catalog.poses.length);assert.equal(receipt.expression_count,catalog.expressions.length);
  for(const meme of registry.compositions)assert.ok(html.includes('data-meme="'+meme.id+'"'),meme.id);
  for(const pose of catalog.poses)assert.ok(html.includes('data-pose="'+pose.id+'"'),pose.id);
  for(const expression of catalog.expressions)assert.ok(html.includes('data-expression="'+expression.id+'"'),expression.id);
  const production=JSON.parse(await readFile(path.join(root,'production.json'))),cast=JSON.parse(await readFile(path.join(root,'.authoring/character-assembly-plan.json')));
  const additions=new Set(registry.compositions.filter(m=>m.reference_url).map(m=>m.id));
  const newScenes=production.scenes.filter(s=>additions.has(s.visual_grammar.meme_composition.id)).map(s=>({...s,layout_contract:resolveHandoffLayout()}));
  assertJob5VisualRoleSizes({assets:production.assets,scenes:newScenes});
  const threat=production.scenes.find(s=>s.visual_grammar.meme_composition.id==='take-that-back'),actor=threat.entities.find(e=>e.id==='hero'),prop=threat.entities.find(e=>e.id==='prop_prop');
  const stateId=threat.visual_grammar.meme_composition.acting_requirements.hero.state_id,transform=actor.states[stateId].transform,spec=cast.characters.find(c=>c.entity_id==='hero');
  const build=compileCharacterSvg(spec,spec.states[stateId]),viewBox=build.svg.match(/viewBox="([^"]+)"/u)[1].split(' ').map(Number),grip=build.sockets.prop_slot;
  const x=transform.x+(grip[0]-viewBox[0])*transform.width/viewBox[2],y=transform.y+(grip[1]-viewBox[1])*transform.height/viewBox[3],box=Object.values(prop.states).at(-1).transform;
  assert.ok(x>=box.x&&x<=box.x+box.width&&y>=box.y&&y<=box.y+box.height,'the native hand must meet the held toy, not float away from it');
  const call=production.scenes.find(s=>s.visual_grammar.meme_composition.id==='call-for-help');
  const caller=call.entities.find(e=>e.id==='hero'),callState=call.visual_grammar.meme_composition.acting_requirements.hero.state_id;
  const callerArt=compileCharacterSvg(spec,spec.states[callState]),ct=caller.states[callState].transform;
  const phone=Object.values(call.entities.find(e=>e.id==='prop_phone').states).at(-1).transform;
  const callGrip=callerArt.sockets.right_grip;
  const gx=ct.x+callGrip[0]*ct.width/520,gy=ct.y+callGrip[1]*ct.height/760;
  assert.ok(gx>=phone.x&&gx<=phone.x+phone.width&&gy>=phone.y&&gy<=phone.y+phone.height,'call phone must meet the raised hand beside the ear');
  assert.ok(html.includes('[data-labels=on] .speech.reaction[data-duplicate=true]{display:none}'),'stock wording must not compete with a duplicate demo caption');
  const contacts=[['absurd-offer','prop',[.5,.78]],['cry-hug-object','prop',[.5,.65]],['heart-offer-overkill','heart',[.5,.89]],['mirror-self-check','mirror',[.52,.83]],['receipt-in-face','receipt',[.42,.70]],['side-eye-object','prop',[.5,.5]],['wallet-flex','wallet',[.4,.6]]];
  for(const [id,role,anchor] of contacts){
   const scene=production.scenes.find(s=>s.visual_grammar.meme_composition.id===id),meme=scene.visual_grammar.meme_composition;
   const stateId=meme.acting_requirements.hero.state_id,actor=scene.entities.find(e=>e.id==='hero');
   const art=compileCharacterSvg(spec,spec.states[stateId]),t=actor.states[stateId].transform;
   const view=art.svg.match(/viewBox="([^"]+)"/u)[1].split(' ').map(Number),point=art.sockets.prop_slot;
   const hand=[t.x+(point[0]-view[0])*t.width/view[2],t.y+(point[1]-view[1])*t.height/view[3]];
   const prop=scene.entities.find(e=>e.id===meme.roles[role].entity_id),box=Object.values(prop.states).at(-1).transform;
   const contact=[box.x+anchor[0]*box.width,box.y+anchor[1]*box.height];
   assert.ok(Math.hypot(hand[0]-contact[0],hand[1]-contact[1])<=35,id+' prop must meet the authored grip instead of floating over the face');
  }
  for(const example of receipt.examples){
   assert.ok(html.includes('<p class="context">'+example.setup+'</p>'),example.meme+' must show the setup next to its reaction');
  }
  const before=await readFile(path.join(root,'production.json'),'utf8');
  await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/pipeline-state.json'),'live-state');
  const result=run(root);assert.notEqual(result.status,0);
  assert.equal(await readFile(path.join(root,'production.json'),'utf8'),before);
  assert.equal(await readFile(path.join(root,'.authoring/pipeline-state.json'),'utf8'),'live-state');
 }finally{await rm(root,{recursive:true,force:true});}
});
