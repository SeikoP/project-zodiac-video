// Actual Remotion pixels, separate from timing/unit assertions.
import {mkdtemp, mkdir, cp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {prepareRendererProps} from './prepare.mjs';
const renderer=fileURLToPath(new URL('../',import.meta.url));
const fixture=join(renderer,'tests/fixtures/songtu');
const root=await mkdtemp(join(tmpdir(),'cover-opening-smoke-'));
await mkdir(join(root,'.runtime'));await mkdir(join(root,'publish'));
await cp(join(fixture,'assets'),join(root,'assets'),{recursive:true});
await cp(join(fixture,'render-plan.json'),join(root,'.runtime/render-plan.json'));
const publish=JSON.parse(await readFile(join(fixture,'publish.json'),'utf8'));
publish.cover.opening={enabled:true,duration_sec:1.5,transition_sec:0.3};
await writeFile(join(root,'publish/publish.json'),JSON.stringify(publish));
const {output}=await prepareRendererProps(root);
for(const [composition,frame,file] of [['ZodiacCover',0,'cover.png'],['ZodiacRenderPlan',0,'opening.png'],['ZodiacRenderPlan',32,'dissolve.png'],['ZodiacRenderPlan',40,'story.png']]){
 const r=spawnSync(process.execPath,[join(renderer,'scripts/local-remotion-cli.mjs'),'still','src/index.ts',composition,join(root,file),'--props='+output,'--frame='+frame],{cwd:renderer,stdio:'inherit'});
 if(r.status!==0)throw new Error('COVER_OPENING_SMOKE_FAILED: '+file);
 const png=await readFile(join(root,file));
 if(png.readUInt32BE(16)!==1080||png.readUInt32BE(20)!==1920)throw new Error('COVER_OPENING_CANVAS_INVALID');
}
console.log('COVER_OPENING_PIXEL_SMOKE_RENDERED '+root+'; editorial/caption collision review remains separate');
