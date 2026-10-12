from pathlib import Path
import json, os, re

skill=Path('plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline').resolve()
orch=skill/'orchestration'

move={
'commit-phase01-step.mjs':'phases/phase01/commit-phase01-step.mjs','execution-preflight.mjs':'phases/phase01/execution-preflight.mjs','phase01-artifacts.mjs':'phases/phase01/phase01-artifacts.mjs',
'commit-phase02-step.mjs':'phases/phase02/commit-phase02-step.mjs','finalize-phase02-workspace.mjs':'phases/phase02/finalize-phase02-workspace.mjs','phase02-execute-with-depth.mjs':'phases/phase02/phase02-execute-with-depth.mjs','phase02-execute.mjs':'phases/phase02/phase02-execute.mjs','phase02-handoff-context.mjs':'phases/phase02/phase02-handoff-context.mjs','phase02-seal-gate.mjs':'phases/phase02/phase02-seal-gate.mjs','phase02-selected-dependencies.mjs':'phases/phase02/phase02-selected-dependencies.mjs','phase02-transition-gate.mjs':'phases/phase02/phase02-transition-gate.mjs','seal-phase02-review.mjs':'phases/phase02/seal-phase02-review.mjs',
'episode-handoff.mjs':'features/episode/episode-handoff.mjs','validate-episode-handoff.mjs':'features/episode/validate-episode-handoff.mjs','validate-scene-art-direction.mjs':'features/visual-composition/validate-scene-art-direction.mjs',
'commit-phase03-release.mjs':'phases/phase03/commit-phase03-release.mjs','compile-job-v5.mjs':'phases/phase03/compile-job-v5.mjs','export-zodiac-job-v2.mjs':'phases/phase03/export-zodiac-job-v2.mjs','handoff-preflight.mjs':'phases/phase03/handoff-preflight.mjs','phase03-production-release.mjs':'phases/phase03/phase03-production-release.mjs','run-phase03-production.mjs':'phases/phase03/run-phase03-production.mjs','validate-handoff-workspace-v2.mjs':'phases/phase03/validate-handoff-workspace-v2.mjs','validate-job5-import-gate.mjs':'phases/phase03/validate-job5-import-gate.mjs','validate-zodiac-job-zip-v2.mjs':'phases/phase03/validate-zodiac-job-zip-v2.mjs','zip-core-v2.mjs':'phases/phase03/zip-core-v2.mjs',
}

# Discover owners already established by F1/F2 wrappers.
owners={}
wrapper_re=re.compile(r"^export \* from ['\"]([^'\"]+)['\"];",re.M)
for p in orch.glob('*.mjs'):
    m=wrapper_re.search(p.read_text())
    if m: owners[p.resolve()]=(p.parent/m.group(1)).resolve()
for name,dst in move.items(): owners[(orch/name).resolve()]=(skill/dst).resolve()
# Current Job5 round-trip utilities are core model utilities, not compatibility implementation.
for name in ['migrate-production-model.mjs','project-legacy-ir.mjs']:
    owners[(orch/name).resolve()]=(skill/'core/model'/name).resolve()

rx=re.compile(r"(?P<a>(?:\bfrom\s+|\bimport\s*\(\s*)['\"])(?P<s>\.\.?/[^'\"]+)(?P<z>['\"](?:\s*\))?)")
def rel(a,b):
    v=os.path.relpath(b,a).replace(os.sep,'/')
    return v if v.startswith('.') else './'+v
def rewrite(text,old,new):
    def sub(m):
        target=(old.parent/m.group('s')).resolve(); target=owners.get(target,target)
        return m.group('a')+rel(new.parent,target)+m.group('z')
    return rx.sub(sub,text)

def adjust(name,text):
    if name in {'commit-phase01-step.mjs','commit-phase02-step.mjs'}: text=text.replace("path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')","path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')")
    if name=='execution-preflight.mjs':
        text=text.replace("const root=path.resolve(here,'..');","const root=path.resolve(here,'../..');").replace("path.join(here,'pipeline-state.template.json')","path.join(root,'orchestration/pipeline-state.template.json')")
    if name=='phase02-execute-with-depth.mjs': text=text.replace("path.resolve(home,'..',script)","path.resolve(home,'../..',script)")
    if name=='phase02-execute.mjs': text=text.replace("path.resolve(HERE,'../../..')","path.resolve(HERE,'../../../..')")
    if name=='phase02-seal-gate.mjs': text=text.replace("new URL('./validate-pipeline-state.mjs',import.meta.url)","new URL('../../core/state/validate-pipeline-state.mjs',import.meta.url)")
    if name=='phase02-selected-dependencies.mjs': text=text.replace("'orchestration/phase02-execute.mjs'","'phases/phase02/phase02-execute.mjs'")
    if name=='phase02-transition-gate.mjs': text=text.replace("path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')","path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')")
    if name=='commit-phase03-release.mjs': text=text.replace("const here=path.dirname(fileURLToPath(import.meta.url)),skill=path.resolve(here,'..');","const here=path.dirname(fileURLToPath(import.meta.url)),skill=path.resolve(here,'../..');").replace("path.join(skill,'phases/03-handoff.json')","path.join(skill,'orchestration/phases/03-handoff.json')")
    if name=='compile-job-v5.mjs': text=text.replace("'../../../plugin.json'","'../../../../plugin.json'").replace("'../references/contracts/authoring-ir-v1.schema.json'","'../../references/contracts/authoring-ir-v1.schema.json'")
    if name=='handoff-preflight.mjs': text=text.replace("new URL('../references/contracts/authoring-ir-v1.schema.json',import.meta.url)","new URL('../../references/contracts/authoring-ir-v1.schema.json',import.meta.url)")
    if name=='phase03-production-release.mjs': text=text.replace("'../references/contracts/authoring-ir-v1.schema.json'","'../../references/contracts/authoring-ir-v1.schema.json'")
    if name=='run-phase03-production.mjs': text=text.replace("fileURLToPath(new URL('./run-validator-with-receipt.mjs',import.meta.url))","path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../core/evidence/run-validator-with-receipt.mjs')").replace("fileURLToPath(new URL('./'+tool,import.meta.url))","path.resolve(path.dirname(fileURLToPath(import.meta.url)),tool)")
    if name=='validate-handoff-workspace-v2.mjs': text=text.replace("'../../../plugin.json'","'../../../../plugin.json'").replace("path.resolve(here,'../references/contracts')","path.resolve(here,'../../references/contracts')")
    # executable/source dependency strings used by Phase2 source fingerprinting
    for a,b in {
      'orchestration/episode-handoff.mjs':'features/episode/episode-handoff.mjs','orchestration/episode-scope.mjs':'features/episode/episode-scope.mjs','orchestration/validate-pipeline-state.mjs':'core/state/validate-pipeline-state.mjs','orchestration/run-validator-with-receipt.mjs':'core/evidence/run-validator-with-receipt.mjs','orchestration/validate-authoring-scene-events.mjs':'features/visual-composition/validate-authoring-scene-events.mjs','orchestration/validate-visual-quality.mjs':'features/visual-composition/validate-visual-quality.mjs','orchestration/validate-phase02-precompile-boundary.mjs':'features/visual-composition/validate-phase02-precompile-boundary.mjs','orchestration/phase02-composition.mjs':'features/visual-composition/phase02-composition.mjs','orchestration/generated-asset-ownership.mjs':'core/ownership/generated-asset-ownership.mjs','orchestration/compile-narration-performance.mjs':'features/narration-performance/compile-narration-performance.mjs','orchestration/resolve-scene-composition.mjs':'features/visual-composition/resolve-scene-composition.mjs','orchestration/validate-phase02-art-direction.mjs':'features/visual-composition/validate-phase02-art-direction.mjs','orchestration/validate-scene-set-identity.mjs':'features/scene-set/validate-scene-set-identity.mjs','orchestration/scene-set-detection.mjs':'features/scene-set/scene-set-detection.mjs','orchestration/phase02-selected-dependencies.mjs':'phases/phase02/phase02-selected-dependencies.mjs','orchestration/validate-motion-consistency.mjs':'features/visual-composition/validate-motion-consistency.mjs','orchestration/validate-scene-set-accents.mjs':'features/scene-set/validate-scene-set-accents.mjs','orchestration/validate-publish-prep.mjs':'features/publish/validate-publish-prep.mjs','orchestration/validate-character-intent-preflight.mjs':'features/visual-composition/validate-character-intent-preflight.mjs','orchestration/run-director-v2-review.mjs':'features/visual-composition/run-director-v2-review.mjs','orchestration/phase02-transition-gate.mjs':'phases/phase02/phase02-transition-gate.mjs','orchestration/compile-depth-composition.mjs':'features/visual-composition/compile-depth-composition.mjs','orchestration/validate-depth-composition.mjs':'features/visual-composition/validate-depth-composition.mjs','orchestration/phase02-execute.mjs':'phases/phase02/phase02-execute.mjs',
    }.items(): text=text.replace(a,b)
    return text

# Correct model ownership before phase code is rewritten.
(skill/'core/model').mkdir(parents=True,exist_ok=True)
for name in ['migrate-production-model.mjs','project-legacy-ir.mjs']:
    compat=skill/'compat/migrations'/name; dst=skill/'core/model'/name; src=compat.read_text()
    if name=='migrate-production-model.mjs': src=src.replace('../../orchestration/normalize-motion.mjs','../../features/visual-composition/normalize-motion.mjs').replace('../../core/state/production-model.mjs','../state/production-model.mjs')
    dst.write_text(src); compat.write_text(f"export * from '../../core/model/{name}';\n"); (orch/name).write_text(f"export * from '../core/model/{name}';\n")

for name,dst_rel in move.items():
    old=orch/name; dst=skill/dst_rel; dst.parent.mkdir(parents=True,exist_ok=True)
    src=adjust(name,rewrite(old.read_text(),old,dst)); dst.write_text(src)
    target=rel(orch,dst); wrapper=f"export * from '{target}';\n"
    if 'process.argv' in src and 'fileURLToPath(import.meta.url)' in src: wrapper+=f"import {{forwardCliIfMain}} from './forward-cli.mjs';\nforwardCliIfMain(import.meta.url,new URL('{target}',import.meta.url));\n"
    old.write_text(wrapper)

# Current routers import owners directly.
for name in ['plan-plugin-use.mjs','plan-step-context.mjs']:
    p=orch/name; p.write_text(rewrite(p.read_text(),p,p))

# Manifests call canonical owners; only true orchestration entrypoints remain orchestration locators.
owner_by_name={p.name:p for p in owners.values()}
for manifest in (orch/'phases').glob('*.json'):
    data=json.loads(manifest.read_text())
    for step in data.get('steps',[]):
        for cap in [*(step.get('required_capabilities') or []),*(step.get('conditional_capabilities') or [])]:
            loc=cap.get('tool_locator')
            if isinstance(loc,str) and loc.startswith('orchestration/') and loc not in {'orchestration/verify-entry-freshness.mjs','orchestration/plan-plugin-use.mjs'}:
                name=Path(loc).name
                if name in owner_by_name: cap['tool_locator']=owner_by_name[name].relative_to(skill).as_posix()
    manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

# Phase01 validator replay classification follows canonical owner locators, retaining wrapper aliases.
p=skill/'phases/phase01/commit-phase01-step.mjs'; text=p.read_text()
text=text.replace("'orchestration/plan-plugin-use.mjs','orchestration/validate-episode-scope.mjs','orchestration/validate-episode-concept.mjs'","'orchestration/plan-plugin-use.mjs','features/episode/validate-episode-scope.mjs','features/episode/validate-episode-concept.mjs','orchestration/validate-episode-scope.mjs','orchestration/validate-episode-concept.mjs'")
p.write_text(text)

# Source-inspection tests use owner implementation.
def rep(rel,*pairs):
    p=skill/rel; text=p.read_text()
    for a,b in pairs: text=text.replace(a,b)
    p.write_text(text)
rep('orchestration/tests/execution-bootstrap.test.mjs',("path.resolve(orch,'execution-preflight.mjs')","path.resolve(orch,'../phases/phase01/execution-preflight.mjs')"))
rep('orchestration/tests/native-source-fingerprint.test.mjs',("new URL('../phase02-execute.mjs',import.meta.url)","new URL('../../phases/phase02/phase02-execute.mjs',import.meta.url)"))
rep('orchestration/tests/phase02-write-contract.test.mjs',("new URL('../phase02-execute.mjs',import.meta.url)","new URL('../../phases/phase02/phase02-execute.mjs',import.meta.url)"))
rep('orchestration/tests/phase03-seal-gate-wiring.test.mjs',("new URL('../run-phase03-production.mjs',import.meta.url)","new URL('../../phases/phase03/run-phase03-production.mjs',import.meta.url)"))
rep('orchestration/tests/story-object-composition.test.mjs',("new URL('run-director-v2-review.mjs',here)","new URL('../features/visual-composition/run-director-v2-review.mjs',here)"),("new URL('run-phase03-production.mjs',here)","new URL('../phases/phase03/run-phase03-production.mjs',here)"))
rep('orchestration/tests/director-v2-manifest.test.mjs',("orchestration/run-director-v2-review.mjs","features/visual-composition/run-director-v2-review.mjs"))
rep('orchestration/tests/meme-composition-wiring.test.mjs',("orchestration/validate-meme-selection.mjs","features/meme/validate-meme-selection.mjs"))
rep('orchestration/tests/phase02-input-order.test.mjs',("new URL('../phase02-execute.mjs',import.meta.url)","new URL('../../phases/phase02/phase02-execute.mjs',import.meta.url)"),("path.join(root,'orchestration/run-validator-with-receipt.mjs')","path.join(root,'core/evidence/run-validator-with-receipt.mjs')"),("path.join(root,'orchestration/validate-pipeline-state.mjs')","path.join(root,'core/state/validate-pipeline-state.mjs')"))

# Phase02 execution fixture follows the moved owner and owner dependencies.
p=skill/'orchestration/tests/phase02-execute.test.mjs'; text=p.read_text().replace("new URL('../phase02-execute.mjs',import.meta.url)","new URL('../../phases/phase02/phase02-execute.mjs',import.meta.url)")
anchor=" await write(path.join(skill,'core/evidence/run-validator-with-receipt.mjs'),await readFile(new URL('../../core/evidence/run-validator-with-receipt.mjs',import.meta.url),'utf8'));\n"
extra=" await write(path.join(skill,'core/state/authoring-lease.mjs'),await readFile(new URL('../../core/state/authoring-lease.mjs',import.meta.url),'utf8'));\n await write(path.join(skill,'phases/phase02/finalize-phase02-workspace.mjs'),await readFile(new URL('../../phases/phase02/finalize-phase02-workspace.mjs',import.meta.url),'utf8'));\n await write(path.join(skill,'phases/phase02/phase02-selected-dependencies.mjs'),await readFile(new URL('../../phases/phase02/phase02-selected-dependencies.mjs',import.meta.url),'utf8'));\n await write(path.join(skill,'features/visual-composition/compile-visual-intent.mjs'),await readFile(new URL('../../features/visual-composition/compile-visual-intent.mjs',import.meta.url),'utf8'));\n await write(path.join(skill,'features/episode/episode-handoff.mjs'),await readFile(new URL('../../features/episode/episode-handoff.mjs',import.meta.url),'utf8'));\n"
if extra not in text and anchor in text: text=text.replace(anchor,anchor+extra)
text=text.replace("path.join(skill,'orchestration',scriptName)","path.join(skill,'features/visual-composition',scriptName)")
p.write_text(text)

# Architecture gate for owner graph and thin orchestration root.
p=skill/'orchestration/tests/executable-architecture.test.mjs'; text=p.read_text()
if "import {access,readFile} from 'node:fs/promises';" in text: text=text.replace("import {access,readFile} from 'node:fs/promises';","import {access,readFile,readdir} from 'node:fs/promises';")
if 'phase execution implementation has explicit owners' not in text:
    text += '''\nconst phaseOwners=['phases/phase01/commit-phase01-step.mjs','phases/phase01/execution-preflight.mjs','phases/phase01/phase01-artifacts.mjs','phases/phase02/commit-phase02-step.mjs','phases/phase02/phase02-execute.mjs','phases/phase02/phase02-transition-gate.mjs','phases/phase03/compile-job-v5.mjs','phases/phase03/run-phase03-production.mjs','phases/phase03/validate-job5-import-gate.mjs'];\ntest('phase execution implementation has explicit owners',async()=>{for(const rel of phaseOwners)assert.equal(await exists(path.join(skill,rel)),true,rel+' missing');assert.equal(await exists(path.join(skill,'features/visual-composition/validate-scene-art-direction.mjs')),true);});\ntest('orchestration root contains routing or thin wrappers, not phase implementation',async()=>{const allowed=new Set(['forward-cli.mjs','plan-plugin-use.mjs','plan-step-context.mjs','verify-entry-freshness.mjs']);const found=[];for(const e of await readdir(orchestration,{withFileTypes:true})){if(!e.isFile()||!e.name.endsWith('.mjs'))continue;const s=await readFile(path.join(orchestration,e.name),'utf8');if(!/^export \\* from ['"][^'"]+['"];\\n(?:import \\{forwardCliIfMain\\} from '\\.\\/forward-cli\\.mjs';\\nforwardCliIfMain\\([^\\n]+\\);\\n)?$/u.test(s))found.push(e.name);}assert.deepEqual(found.sort(),[...allowed].sort());});\ntest('fresh phase owner modules never import compatibility implementation',async()=>{const walk=async d=>{const out=[];for(const e of await readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())out.push(...await walk(p));else if(e.isFile()&&p.endsWith('.mjs'))out.push(p);}return out;};for(const f of await walk(path.join(skill,'phases')))assert.doesNotMatch(await readFile(f,'utf8'),/(?:from|import\\s*\\()\\s*['"][^'"]*compat\\//u);});\ntest('current Job5 round-trip model utilities are core, not compatibility implementation',async()=>{for(const rel of ['core/model/migrate-production-model.mjs','core/model/project-legacy-ir.mjs'])assert.equal(await exists(path.join(skill,rel)),true);for(const rel of ['compat/migrations/migrate-production-model.mjs','compat/migrations/project-legacy-ir.mjs']){const s=await readFile(path.join(skill,rel),'utf8');assert.match(s,/^export \\* from ['"][^'"]+core\\/model\\//u);}});\ntest('active phase manifests point migrated capabilities at canonical owner modules',async()=>{const allow=new Set(['orchestration/verify-entry-freshness.mjs','orchestration/plan-plugin-use.mjs']);for(const name of ['01-content.json','02-visual-production.json','03-handoff.json']){const m=JSON.parse(await readFile(path.join(orchestration,'phases',name),'utf8'));for(const step of m.steps??[])for(const cap of [...(step.required_capabilities??[]),...(step.conditional_capabilities??[])])if(typeof cap.tool_locator==='string'&&cap.tool_locator.startsWith('orchestration/'))assert.ok(allow.has(cap.tool_locator),name+':'+cap.id+' '+cap.tool_locator);}});\n'''
p.write_text(text)

print('F3_MIGRATION_APPLIED')

# Final parity patches found by clean-branch verification.
p=skill/'orchestration/tests/execution-bootstrap.test.mjs'
text=p.read_text()
text=text.replace("path.join(orch,'execution-preflight.mjs')","path.resolve(orch,'../phases/phase01/execution-preflight.mjs')")
p.write_text(text)

p=skill/'phases/phase03/commit-phase03-release.mjs'
text=p.read_text()
text=text.replace("path.join(here,'phases/03-handoff.json')","path.join(skill,'orchestration/phases/03-handoff.json')")
p.write_text(text)

