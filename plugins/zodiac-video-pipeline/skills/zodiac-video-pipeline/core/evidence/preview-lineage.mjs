import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {compositionHash} from '../../orchestration/phase02-composition.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function previewLineage(root){
 const intentPath=path.join(root,'.authoring/visual-intent.json');let raw;try{raw=await readFile(intentPath)}catch(e){if(e.code==='ENOENT')return null;throw e;}
 const projection=await readFile(path.join(root,'.authoring/visual-intent-projection-receipt.json'));
 if(JSON.parse(projection).source_sha256!==compositionHash(JSON.parse(raw)))throw Error('PREVIEW_INTENT_PROJECTION_STALE');
 return {visual_intent_sha256:sha(raw),projection_receipt_sha256:sha(projection)};
}
