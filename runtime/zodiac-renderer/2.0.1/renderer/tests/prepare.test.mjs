import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {prepareRendererProps, validateExecutablePlan, validateSceneLayout} from "../scripts/prepare.mjs";

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
