from pathlib import Path
import json, os, re

skill=Path("plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline")
orch=skill/"orchestration"

groups={
 "features/episode":["episode-scope.mjs","episode-writer-brief.mjs","compile-writer-brief.mjs","validate-episode-scope.mjs","validate-episode-concept.mjs"],
 "features/narration-performance":["compile-narration-performance.mjs","voice-source-ranges.mjs"],
 "features/story-object":["validate-story-object.mjs","validate-story-object-composition.mjs"],
 "features/scene-set":["scene-set-detection.mjs","validate-scene-set.mjs","validate-scene-set-identity.mjs","validate-scene-set-accents.mjs","validate-archive-frame.mjs"],
 "features/visual-composition":["compile-depth-composition.mjs","compile-visual-intent.mjs","derive-scene-context.mjs","director-v2-core.mjs","director-v2-gate.mjs","normalize-motion.mjs","phase02-composition-core.mjs","phase02-composition.mjs","resolve-scene-composition.mjs","scene-state-trace.mjs","semantic-motion-qa.mjs","validate-anchor-lanes.mjs","validate-animation-semantics.mjs","validate-authoring-scene-events.mjs","validate-character-intent-preflight.mjs","validate-depth-composition.mjs","validate-motion-consistency.mjs","validate-phase02-art-direction.mjs","validate-phase02-precompile-boundary.mjs","validate-runner-motion-boundary.mjs","validate-semantic-asset-fit.mjs","validate-story-beat-choreography.mjs","validate-visual-quality-core.mjs","validate-visual-quality.mjs","validate-visual-structure.mjs","write-phase02-authoring.mjs","build-native-preview-pairs.mjs","validate-native-preview-pairs.mjs","run-director-v2-review.mjs"],
 "features/cover":["validate-cover-design.mjs"],
 "features/ending":["compile-ending-payoff.mjs","validate-ending-payoff.mjs"],
 "features/meme":["validate-meme-selection.mjs"],
 "features/publish":["validate-publish-prep.mjs"],
}
move={name:f"{folder}/{name}" for folder,names in groups.items() for name in names}
f1={
 "capability-registry.mjs":"core/policy/capability-registry.mjs","current-policy.mjs":"core/policy/current-policy.mjs","creative-policy.mjs":"core/policy/creative-policy.mjs","resolve-capability-route.mjs":"core/policy/resolve-capability-route.mjs","select-asset-guidance.mjs":"core/policy/select-asset-guidance.mjs","context-capsule.mjs":"core/policy/context-capsule.mjs","authoring-lease.mjs":"core/state/authoring-lease.mjs","production-model.mjs":"core/state/production-model.mjs","validate-pipeline-state.mjs":"core/state/validate-pipeline-state.mjs","approval-source-hashes.mjs":"core/evidence/approval-source-hashes.mjs","build-source-snapshot.mjs":"core/evidence/build-source-snapshot.mjs","compile-evidence-brief.mjs":"core/evidence/compile-evidence-brief.mjs","episode-evidence.mjs":"core/evidence/episode-evidence.mjs","handoff-receipt.mjs":"core/evidence/handoff-receipt.mjs","preview-lineage.mjs":"core/evidence/preview-lineage.mjs","phase02-evidence-audit.mjs":"core/evidence/phase02-evidence-audit.mjs","run-validator-with-receipt.mjs":"core/evidence/run-validator-with-receipt.mjs","schema-lite.mjs":"core/schema/schema-lite.mjs",
}
allmap={str((orch/n).resolve()):str((skill/r).resolve()) for n,r in {**f1,**move}.items()}

def rel(frm,to):
 return Path(os.path.relpath(to,frm)).as_posix() if os.path.relpath(to,frm).startswith(".") else "./"+Path(os.path.relpath(to,frm)).as_posix()

rx1=re.compile(r"(\bfrom\s+['\"])(\.\.?/[^'\"]+)(['\"])")
rx2=re.compile(r"(\bimport\s*\(\s*['\"])(\.\.?/[^'\"]+)(['\"]\s*\))")
def rewrite_imports(text,old,new):
 def repl(m):
  target=str((old.parent/m.group(2)).resolve())
  mapped=Path(allmap.get(target,target))
  return m.group(1)+rel(new.parent,mapped)+m.group(3)
 return rx2.sub(repl,rx1.sub(repl,text))

eager={"validate-scene-set.mjs","validate-story-beat-choreography.mjs","validate-visual-quality-core.mjs","validate-visual-quality.mjs","validate-visual-structure.mjs","run-director-v2-review.mjs","validate-cover-design.mjs","validate-publish-prep.mjs"}

def adjust(name,text):
 if name in {"scene-set-detection.mjs","validate-scene-set-identity.mjs"}: text=text.replace("new URL('../references/","new URL('../../references/")
 if name=="compile-depth-composition.mjs": text=text.replace("'../references/depth-catalog.json'","'../../references/depth-catalog.json'")
 if name in {"normalize-motion.mjs","validate-motion-consistency.mjs"}: text=text.replace("new URL('../contracts/","new URL('../../contracts/")
 if name in {"phase02-composition.mjs","resolve-scene-composition.mjs","validate-phase02-precompile-boundary.mjs"}: text=text.replace("new URL('../references/","new URL('../../references/")
 if name=="resolve-scene-composition.mjs": text=text.replace("load('../references/","load('../../references/")
 if name in {"validate-depth-composition.mjs","validate-phase02-art-direction.mjs"}: text=text.replace("path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')","path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')")
 if name=="validate-semantic-asset-fit.mjs": text=text.replace("path.resolve(here,'../references/asset-library-v4')","path.resolve(here,'../../references/asset-library-v4')")
 if name=="validate-visual-quality-core.mjs": text=text.replace("path.join(here,'../references/asset-library-v4')","path.join(here,'../../references/asset-library-v4')")
 if name=="validate-visual-quality.mjs": text=text.replace("path.resolve(here,'../references/asset-library-v4/validation/validate-production-style.mjs')","path.resolve(here,'../../references/asset-library-v4/validation/validate-production-style.mjs')")
 if name=="validate-visual-structure.mjs": text=text.replace("path.resolve(here,'../references/asset-library-v4')","path.resolve(here,'../../references/asset-library-v4')")
 if name=="write-phase02-authoring.mjs": text=text.replace("path.dirname(fileURLToPath(import.meta.url)),'../../../plugin.json'","path.dirname(fileURLToPath(import.meta.url)),'../../../../plugin.json'")
 if name=="validate-meme-selection.mjs": text=text.replace("path.join(here,'../references/asset-library-v4/memes/index.json')","path.join(here,'../../references/asset-library-v4/memes/index.json')")
 if name=="run-director-v2-review.mjs":
  text=text.replace("const here=path.dirname(fileURLToPath(import.meta.url));","const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');")
  pairs={
   "script:'director-v2-gate.mjs'":"script:'features/visual-composition/director-v2-gate.mjs'",
   "script:'handoff-preflight.mjs'":"script:'orchestration/handoff-preflight.mjs'",
   "script:'../references/asset-library-v4/scene-direction/validate-scene-direction-compile.mjs'":"script:'references/asset-library-v4/scene-direction/validate-scene-direction-compile.mjs'",
   "script:'../references/asset-library-v4/environments/validate-environment-frame.mjs'":"script:'references/asset-library-v4/environments/validate-environment-frame.mjs'",
   "script:'validate-visual-quality.mjs'":"script:'features/visual-composition/validate-visual-quality.mjs'",
   "script:'validate-authoring-scene-events.mjs'":"script:'features/visual-composition/validate-authoring-scene-events.mjs'",
   "script:'validate-story-beat-choreography.mjs'":"script:'features/visual-composition/validate-story-beat-choreography.mjs'",
   "script:'build-native-preview-pairs.mjs'":"script:'features/visual-composition/build-native-preview-pairs.mjs'",
   "script:'validate-native-preview-pairs.mjs'":"script:'features/visual-composition/validate-native-preview-pairs.mjs'",
   "script:'resolve-scene-composition.mjs'":"script:'features/visual-composition/resolve-scene-composition.mjs'",
   "script:'phase02-composition.mjs'":"script:'features/visual-composition/phase02-composition.mjs'",
   "script:'validate-story-object.mjs'":"script:'features/story-object/validate-story-object.mjs'",
   "script:'validate-story-object-composition.mjs'":"script:'features/story-object/validate-story-object-composition.mjs'",
   "path.resolve(here,stage.script)":"path.resolve(skill,stage.script)",
   "path.resolve(here,'run-validator-with-receipt.mjs')":"path.resolve(skill,'core/evidence/run-validator-with-receipt.mjs')",
  }
  for a,b in pairs.items(): text=text.replace(a,b)
 return text

for name,dst in move.items():
 old=orch/name; new=skill/dst
 src=adjust(name,rewrite_imports(old.read_text(),old,new))
 new.parent.mkdir(parents=True,exist_ok=True);new.write_text(src)
 target=rel(orch,new)
 wrapper=f"export * from '{target}';\n"
 guarded=("===fileURLToPath(import.meta.url)" in src or "=== fileURLToPath(import.meta.url)" in src)
 if "process.argv" in src and guarded and name not in eager:
  wrapper+=f"import {{forwardCliIfMain}} from './forward-cli.mjs';\nforwardCliIfMain(import.meta.url,new URL('{target}',import.meta.url));\n"
 old.write_text(wrapper)

cap=skill/"bootstrap/capabilities.json";data=json.loads(cap.read_text())
owners={"scene_set":"features/scene-set/validate-scene-set.mjs","story_object":"features/story-object/validate-story-object.mjs","cover":"features/cover/validate-cover-design.mjs","narration_performance":"features/narration-performance/compile-narration-performance.mjs","character_assembly":"references/asset-library-v4/characters/compile-character-assembly.mjs"}
for row in data["capabilities"]:
 if row["id"] in owners: row["owner"]=owners[row["id"]]
cap.write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n")

arch=orch/"tests/executable-architecture.test.mjs";s=arch.read_text().replace("import {access,readFile} from 'node:fs/promises';","import {access,readFile,readdir} from 'node:fs/promises';")
if "feature compiler and validator implementation has semantic owners" not in s:
 s+=r"""
const featureOwners=[
 'features/episode/episode-scope.mjs','features/narration-performance/compile-narration-performance.mjs','features/story-object/validate-story-object.mjs','features/scene-set/validate-scene-set.mjs','features/visual-composition/phase02-composition.mjs','features/cover/validate-cover-design.mjs','features/ending/validate-ending-payoff.mjs','features/meme/validate-meme-selection.mjs','features/publish/validate-publish-prep.mjs',
];
test('feature compiler and validator implementation has semantic owners',async()=>{for(const rel of featureOwners)assert.equal(await exists(path.join(skill,rel)),true,rel+' missing');});
test('capability registry points at real feature owners',async()=>{const registry=JSON.parse(await readFile(path.join(skill,'bootstrap/capabilities.json'),'utf8'));const expected={scene_set:'features/scene-set/validate-scene-set.mjs',story_object:'features/story-object/validate-story-object.mjs',cover:'features/cover/validate-cover-design.mjs',narration_performance:'features/narration-performance/compile-narration-performance.mjs',character_assembly:'references/asset-library-v4/characters/compile-character-assembly.mjs'};for(const [id,owner] of Object.entries(expected)){const row=registry.capabilities.find(item=>item.id===id);assert.ok(row,id+' missing');assert.equal(row.owner,owner,id+' owner mismatch');assert.equal(await exists(path.join(skill,owner)),true,id+' owner path missing');}});
test('fresh feature owner modules never import compatibility implementation',async()=>{const root=path.join(skill,'features');const walk=async dir=>{const out=[];for(const ent of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...await walk(p));else if(ent.isFile()&&p.endsWith('.mjs'))out.push(p);}return out;};for(const file of await walk(root)){const source=await readFile(file,'utf8');assert.doesNotMatch(source,/(?:from|import\s*\()\s*['"][^'"]*compat\//u,path.relative(skill,file)+' imports compat');}});
"""
arch.write_text(s)

def patch(rel,pairs):
 p=skill/rel;s=p.read_text()
 for a,b in pairs:s=s.replace(a,b)
 p.write_text(s)
patch("orchestration/tests/character-publish-audit.test.mjs",[("skills/zodiac-video-pipeline/orchestration/validate-publish-prep.mjs","skills/zodiac-video-pipeline/features/publish/validate-publish-prep.mjs")])
patch("orchestration/tests/frame-composition-quality.test.mjs",[("const root=path.resolve(here,'..');","const root=path.resolve(here,'../..');"),("path.join(root,'validate-visual-structure.mjs')","path.join(root,'features/visual-composition/validate-visual-structure.mjs')")])
patch("orchestration/tests/story-object-composition.test.mjs",[("new URL('run-director-v2-review.mjs',here)","new URL('../features/visual-composition/run-director-v2-review.mjs',here)")])
patch("orchestration/tests/story-object-system.test.mjs",[("new URL('../run-director-v2-review.mjs',import.meta.url)","new URL('../../features/visual-composition/run-director-v2-review.mjs',import.meta.url)")])

p=skill/"orchestration/tests/director-v2-rollback.test.mjs";s=p.read_text()
s=s.replace(" const source=path.join(base,'source'),workspace=path.join(base,'workspace');\n await mkdir(source,{recursive:true});await mkdir(path.join(workspace,'.authoring'),{recursive:true});\n for(const x of ['director-v2-core.mjs','director-v2-gate.mjs','run-director-v2-review.mjs'])await copyFile(path.join(original,x),path.join(source,x));"," const source=path.join(base,'skill'),workspace=path.join(base,'workspace');\n const feature=path.join(source,'features/visual-composition');await mkdir(feature,{recursive:true});await mkdir(path.join(source,'orchestration'),{recursive:true});await mkdir(path.join(workspace,'.authoring'),{recursive:true});\n for(const x of ['director-v2-core.mjs','director-v2-gate.mjs','run-director-v2-review.mjs'])await copyFile(path.resolve(original,'../features/visual-composition',x),path.join(feature,x));")
s=s.replace(" await writeFile(path.join(source,'compile-job-v5.mjs'),`export function assertJob5VisualRoleSizes"," await writeFile(path.join(source,'orchestration/compile-job-v5.mjs'),`export function assertJob5VisualRoleSizes")
s=s.replace("const run=spawnSync(process.execPath,[path.join(source,'run-director-v2-review.mjs'),workspace]","const run=spawnSync(process.execPath,[path.join(feature,'run-director-v2-review.mjs'),workspace]")
p.write_text(s)

p=skill/"orchestration/tests/phase02-execute.test.mjs";s=p.read_text()
m=" await write(path.join(skill,'orchestration/run-validator-with-receipt.mjs'),await readFile(new URL('../run-validator-with-receipt.mjs',import.meta.url),'utf8'));\n"
if "orchestration/forward-cli.mjs" not in s:s=s.replace(m,m+" await write(path.join(skill,'orchestration/forward-cli.mjs'),await readFile(new URL('../forward-cli.mjs',import.meta.url),'utf8'));\n")
m=" for(const name of ['episode-handoff.mjs','episode-scope.mjs'])await write(path.join(skill,'orchestration',name),await readFile(new URL('../'+name,import.meta.url),'utf8'));\n"
if "features/episode/episode-scope.mjs" not in s:s=s.replace(m,m+" await write(path.join(skill,'features/episode/episode-scope.mjs'),await readFile(new URL('../../features/episode/episode-scope.mjs',import.meta.url),'utf8'));\n")
m=" await write(path.join(skill,'orchestration/validate-phase02-art-direction.mjs'),await readFile(new URL('../validate-phase02-art-direction.mjs',import.meta.url),'utf8'));\n"
if "features/visual-composition',name" not in s:s=s.replace(m,m+" for(const name of ['phase02-composition.mjs','phase02-composition-core.mjs','validate-phase02-precompile-boundary.mjs','validate-phase02-art-direction.mjs']) await write(path.join(skill,'features/visual-composition',name),await readFile(new URL('../../features/visual-composition/'+name,import.meta.url),'utf8'));\n await write(path.join(skill,'features/scene-set/scene-set-detection.mjs'),await readFile(new URL('../../features/scene-set/scene-set-detection.mjs',import.meta.url),'utf8'));\n")
p.write_text(s)
