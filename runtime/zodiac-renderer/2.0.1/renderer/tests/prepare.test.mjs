import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {prepareRendererProps, validateExecutablePlan, validateSceneLayout, validateVisualRoleSizes, visualRoleSizeLimit} from "../scripts/prepare.mjs";

const minimalPlan = () => ({
  format: "zodiac-render-plan@1",
  fps: 24,
  video: {width: 1080, height: 1920},
  assets: {"char.scorpio": {path: "assets/char-scorpio.svg"}},
  scenes: [
    {
      id: "S01",
      start_frame: 0,
      duration_frames: 48,
      events: [
        {
          event_id: "E01",
          scene_id: "S01",
          target: "scorpio",
          start_frame: 8,
          end_frame: 16,
          state_before: "guarded",
          state_after: "open",
          motion: "reaction_pop",
        },
      ],
    },
  ],
});

test("prepare preserves resolved frame ranges exactly", async () => {
  const root = await mkdtemp(join(tmpdir(), "zodiac-renderer-v2-"));
  await mkdir(join(root, ".runtime"), {recursive: true});
  await mkdir(join(root, "assets"), {recursive: true});
  await writeFile(
    join(root, "assets", "char-scorpio.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>',
    "utf8",
  );
  const plan = minimalPlan();
  await writeFile(join(root, ".runtime", "render-plan.json"), JSON.stringify(plan), "utf8");
  const {output} = await prepareRendererProps(root);
  const props = JSON.parse(await readFile(output, "utf8"));
  assert.equal(props.scenes[0].events[0].start_frame, 8);
  assert.equal(props.scenes[0].events[0].end_frame, 16);
  assert.match(props.assets["char.scorpio"].src, /^data:image\/svg\+xml;base64,/);
});

test("invalid executable frame range is rejected", () => {
  const plan = minimalPlan();
  plan.scenes[0].events[0].end_frame = 8;
  assert.throws(() => validateExecutablePlan(plan), /invalid resolved frame range/);
});

test("renderer prepare source has no semantic scheduling hooks", async () => {
  const source = await readFile(new URL("../scripts/prepare.mjs", import.meta.url), "utf8");
  for (const forbidden of [
    "materializeProductionDefaults",
    "resolveProductionEvents",
    "validatePerformanceTiming",
    "voice_anchor",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("caption safe zone blocks transformed visible props", () => {
  const plan = minimalPlan();
  plan.scenes[0].layout_contract = {
    canvas:{width:1080,height:1920},
    caption_safe_zone:{x:80,y:1320,width:920,height:340},
    character_zone:{x:10,y:400,width:1000,height:500},
    prop_zone:{x:100,y:920,width:900,height:350},
    effect_zone:{x:20,y:380,width:1000,height:400},
  };
  plan.scenes[0].entities = [{id:"story_prop",initial_state:"visible",
    states:{visible:{asset:"char.scorpio",visible:true,transform:{x:200,y:1310,width:300,height:260}}}}];
  assert.throws(() => validateSceneLayout(plan), /LAYOUT_OVERLAP/);
});

test("caption safe zone accepts non-colliding dense layout", () => {
  const plan = minimalPlan();
  plan.scenes[0].layout_contract = {
    canvas:{width:1080,height:1920},
    caption_safe_zone:{x:80,y:1320,width:920,height:340},
    character_zone:{x:10,y:400,width:1000,height:500},
    prop_zone:{x:100,y:920,width:900,height:350},
    effect_zone:{x:20,y:380,width:1000,height:400},
  };
  plan.scenes[0].entities = [0,1,2].map(i=>({
    id:"actor"+i,initial_state:"idle",
    states:{idle:{asset:"char.scorpio",visible:true,transform:{x:i*300,y:400,width:240,height:400}}}
  }));
  assert.doesNotThrow(() => validateSceneLayout(plan));
});

test("spatial binding rejects a prop anchored to the wrong person", () => {
  const plan = minimalPlan();
  const scene = plan.scenes[0];
  scene.layout_contract = {
    canvas:{width:1080,height:1920},
    caption_safe_zone:{x:80,y:1320,width:920,height:340},
    character_zone:{x:10,y:400,width:1000,height:500},
    prop_zone:{x:100,y:930,width:880,height:340},
    effect_zone:{x:20,y:380,width:1040,height:510}
  };
  scene.entities = [
    {id:"scorpio",initial_state:"idle",states:{idle:{asset:"char.scorpio",visible:true,transform:{x:40,y:500,width:250,height:400}}}},
    {id:"story_prop",initial_state:"idle",states:{idle:{asset:"char.scorpio",visible:true,transform:{x:770,y:850,width:310,height:230}}}}
  ];
  scene.spatial_bindings = [{entity:"story_prop",anchor:"scorpio",relation:"held_by",max_distance_px:260}];
  assert.throws(() => validateSceneLayout(plan), /SPATIAL_SEMANTICS_MISMATCH/);
  scene.entities[1].states.idle.transform.x = 110;
  scene.entities[1].states.idle.transform.y = 750;
  assert.doesNotThrow(() => validateSceneLayout(plan));
});

test("spatial binding rejects missing anchor identities", () => {
  const plan = minimalPlan();
  plan.scenes[0].layout_contract = {
    canvas:{width:1080,height:1920},
    caption_safe_zone:{x:80,y:1320,width:920,height:340},
    character_zone:{x:10,y:400,width:1000,height:500},
    prop_zone:{x:100,y:930,width:880,height:340},
    effect_zone:{x:20,y:380,width:1040,height:510}
  };
  plan.scenes[0].entities = [{id:"story_effect",initial_state:"idle",states:{idle:{asset:"char.scorpio",visible:true,transform:{x:350,y:580,width:310,height:230}}}}];
  plan.scenes[0].spatial_bindings = [{entity:"story_effect",anchor:"friend",relation:"emitted_by",max_distance_px:220}];
  assert.throws(() => validateSceneLayout(plan), /SPATIAL_ANCHOR_MISSING/);
});

test("density classifies named props and effects by asset metadata instead of IDs", () => {
  const plan = minimalPlan();
  plan.assets = {
    "char.scorpio": {path:"assets/characters/scorpio.svg",category:"character"},
    notebook:{path:"assets/props/notebook.svg",category:"prop"},
    pen:{path:"assets/props/pen.svg",category:"prop"},
    question:{path:"assets/effects/question.svg",category:"effect"},
  };
  plan.scenes[0].layout_contract = {
    canvas:{width:1080,height:1920},
    caption_safe_zone:{x:80,y:1320,width:920,height:340},
    character_zone:{x:10,y:400,width:1000,height:500},
    prop_zone:{x:100,y:930,width:880,height:340},
    effect_zone:{x:20,y:380,width:1000,height:400},
  };
  const entity = (id,asset) => ({id,initial_state:"visible",states:{visible:{asset,visible:true,transform:{x:40,y:300,width:260,height:230}}}});
  plan.scenes[0].entities = [
    entity("gemini","char.scorpio"),
    entity("friend","char.scorpio"),
    entity("notebook","notebook"),
    entity("pen","pen"),
    entity("question_effect","question"),
  ];
  assert.doesNotThrow(() => validateSceneLayout(plan));
  plan.scenes[0].entities.push(entity("extra_pen","pen"));
  assert.throws(() => validateSceneLayout(plan), /DENSITY_EXCEEDED.*props=3/);
});

test("environment cues are excluded from actor density even with arbitrary IDs", () => {
  const plan = minimalPlan();
  plan.assets = {
    "char.scorpio": {path:"assets/characters/scorpio.svg"},
    board: {path:"assets/environment/classroom-whiteboard.svg",category:"environment"},
  };
  plan.scenes[0].layout_contract = {
    canvas:{width:1080,height:1920},
    caption_safe_zone:{x:80,y:1320,width:920,height:340},
  };
  plan.scenes[0].entities = [
    ...[1,2,3].map(i=>({id:"actor"+i,initial_state:"idle",states:{idle:{asset:"char.scorpio",visible:true,transform:{x:40,y:300,width:260,height:230}}}})),
    {id:"classroom_board",initial_state:"idle",states:{idle:{asset:"board",visible:true,transform:{x:40,y:300,width:260,height:230}}}},
  ];
  assert.doesNotThrow(() => validateSceneLayout(plan));
});


// Regression from the actual Song Tu Job@5 v1.0.1: native 320x160 SVG pen
// is intentionally drawn at 250x125 in S06 and 220x115 in S07.
const songTuEightScenes = () => {
  const penAsset={path:"assets/props/pen.svg",category:"prop",
    lineage:{source_master:"props/pen.svg",source_library:"zodiac-visual-grammar-v4"}};
  const assets={
    PROP_PEN:penAsset,
    PROP_NOTEBOOK:{path:"assets/props/notebook.svg",category:"prop"},
    EFFECT_QUESTION:{path:"assets/effects/question.svg",category:"effect"},
    EFFECT_EXCLAMATION:{path:"assets/effects/exclamation.svg",category:"effect"}
  };
  const specs=[
    [{id:"question_effect",asset:"EFFECT_QUESTION",w:270,h:205}],
    [{id:"notebook",asset:"PROP_NOTEBOOK",w:260,h:244}],
    [{id:"notebook",asset:"PROP_NOTEBOOK",w:520,h:488}],
    [{id:"notebook",asset:"PROP_NOTEBOOK",w:260,h:244},
     {id:"story_effect",asset:"EFFECT_EXCLAMATION",w:260,h:200}],
    [{id:"notebook",asset:"PROP_NOTEBOOK",w:250,h:265}],
    [{id:"pen",asset:"PROP_PEN",w:250,h:125}],
    [{id:"notebook",asset:"PROP_NOTEBOOK",w:520,h:488},
     {id:"pen",asset:"PROP_PEN",w:220,h:115}],
    [{id:"notebook",asset:"PROP_NOTEBOOK",w:345,h:323}]
  ];
  const scenes=specs.map((entries,index)=>({
    id:"s"+String(index+1).padStart(2,"0"),start_frame:index*60,
    duration_frames:60,events:[],
    layout_contract:{caption_safe_zone:{x:80,y:1400,width:920,height:300}},
    entities:entries.map(({id,asset,w,h},e)=>({id,initial_state:"visible",
      states:{visible:{asset,visible:true,transform:{x:70+e*450,y:470,width:w,height:h}}}}))
  }));
  return {format:"zodiac-render-plan@1",fps:30,video:{width:1080,height:1920},assets,scenes};
};

test("all eight Song Tu scenes pass visual-role sizing; pen survives both S06 and S07",()=>{
  const plan=songTuEightScenes();
  assert.equal(visualRoleSizeLimit("prop",plan.assets.PROP_PEN).profile,"writing-pen");
  assert.equal(visualRoleSizeLimit("prop",plan.assets.PROP_NOTEBOOK).minimumArea,43000);
  assert.doesNotThrow(()=>validateVisualRoleSizes(validateSceneLayout(validateExecutablePlan(plan))));
  assert.equal(plan.scenes[5].entities[0].states.visible.transform.width,250);
  assert.equal(plan.scenes[6].entities[1].states.visible.transform.width,220);
});

test("normal notebook and effect roles still fail if too small",()=>{
  for(const [sceneIndex,entityIndex] of [[1,0],[3,1]]){
    const plan=songTuEightScenes();
    const state=plan.scenes[sceneIndex].entities[entityIndex].states.visible;
    state.transform.width=120;
    state.transform.height=110;
    assert.throws(()=>validateVisualRoleSizes(plan),/VISUAL_ROLE_TOO_SMALL/);
  }
});

test("pen exemption requires trusted asset path, lineage and real visible size",()=>{
  for(const mutation of [
    a=>delete a.lineage,
    a=>a.path="assets/props/notebook.svg",
    a=>a.category="effect"
  ]){
    const plan=songTuEightScenes();
    mutation(plan.assets.PROP_PEN);
    assert.throws(()=>validateVisualRoleSizes(plan),/VISUAL_ROLE_TOO_SMALL scene=s06 entity=pen/);
  }
  for(const size of [{width:190,height:125},{width:220,height:105},{width:200,height:110}]){
    const plan=songTuEightScenes();
    Object.assign(plan.scenes[5].entities[0].states.visible.transform,size);
    assert.throws(()=>validateVisualRoleSizes(plan),/VISUAL_ROLE_TOO_SMALL scene=s06 entity=pen/);
  }
});

test("hidden props do not require prominence, but visible marked states do",()=>{
  const plan=songTuEightScenes();
  const hidden=plan.scenes[5].entities[0].states.visible;
  hidden.visible=false;
  hidden.transform.width=2;hidden.transform.height=2;
  assert.doesNotThrow(()=>validateVisualRoleSizes(plan));
  hidden.visible=true;
  assert.throws(()=>validateVisualRoleSizes(plan),/VISUAL_ROLE_TOO_SMALL/);
});

test("full renderer prepare and cover metadata accepts eight Song Tu scenes",async()=>{
  const root=await mkdtemp(join(tmpdir(),"zodiac-songtu-cover-"));
  try{
    const plan=songTuEightScenes();
    await mkdir(join(root,".runtime"),{recursive:true});
    await mkdir(join(root,"publish"),{recursive:true});
    for(const asset of Object.values(plan.assets)){
      const path=join(root,asset.path);
      await mkdir(join(path,".."),{recursive:true});
      await writeFile(path,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"></svg>');
    }
    await writeFile(join(root,".runtime","render-plan.json"),JSON.stringify(plan));
    await writeFile(join(root,"publish","publish.json"),JSON.stringify({
      format:"zodiac-publish@1",source:{production:"production.ir.json"},
      cover:{source_scene_id:"s04",visuals:[{entity_id:"notebook",state_id:"visible"}]}
    }));
    const result=await prepareRendererProps(root);
    const props=JSON.parse(await readFile(result.output,"utf8"));
    assert.equal(props.scenes.length,8);
    assert.equal(props.publish.cover.source_scene_id,"s04");
    assert.ok(props.assets.PROP_PEN.src.startsWith("data:image/svg+xml;base64,"));
  }finally{
    const {rm}=await import("node:fs/promises");
    await rm(root,{recursive:true,force:true});
  }
});
