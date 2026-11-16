#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {validateNarrativeVisualDirection} from '../contracts/narrative-visual-contract.mjs';
export {validateNarrativeVisualDirection,validateNarrativeVisualDecision} from '../contracts/narrative-visual-contract.mjs';

export async function validateNarrativeVisualDirectionWorkspace(root){
 const base=path.resolve(root);
 const plan=JSON.parse(await readFile(path.join(base,'.authoring','narrative-plan.json'),'utf8'));
 const candidates=JSON.parse(await readFile(path.join(base,'.authoring','concept-candidates.json'),'utf8'));
 const selected=(candidates.candidates??[]).find(x=>x.id===candidates.selected_candidate_id);
 if(!selected)throw Error('NARRATIVE_VISUAL_SELECTED_CANDIDATE_MISSING');
 return validateNarrativeVisualDirection(plan,{selectedCandidate:selected});
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const root=process.argv[2];
 if(!root){console.error('Usage: node validate-narrative-visual-direction.mjs <workspace>');process.exit(2);}
 try{const result=await validateNarrativeVisualDirectionWorkspace(root);console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=1;}
 catch(error){console.error(error.message);process.exitCode=2;}
}
