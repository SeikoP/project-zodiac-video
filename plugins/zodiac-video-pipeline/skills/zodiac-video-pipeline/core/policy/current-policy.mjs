import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const orchestrationDir=path.dirname(fileURLToPath(import.meta.url));
const skillRoot=path.resolve(orchestrationDir,'../..');
const requiredKeys=[
 'narrative',
 'story_object',
 'visual_grammar',
 'scene_system',
 'character_assembly',
 'handoff',
 'renderer'
];

export async function loadCurrentPolicy(root=skillRoot){
 const policyPath=path.join(root,'bootstrap','current-policy.json');
 const policy=JSON.parse(await readFile(policyPath,'utf8'));
 if(policy?.format!=='zodiac-current-policy@1')throw new Error('CURRENT_POLICY_FORMAT_INVALID');
 for(const key of requiredKeys){
  if(typeof policy[key]!=='string'||!policy[key])throw new Error('CURRENT_POLICY_FIELD_INVALID '+key);
 }
 return policy;
}
