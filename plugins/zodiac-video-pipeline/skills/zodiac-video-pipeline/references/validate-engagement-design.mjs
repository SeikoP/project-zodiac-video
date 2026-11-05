#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {assertEngagementDesign} from '../features/episode/engagement-contract.mjs';
const [workspace]=process.argv.slice(2);
if(!workspace){console.error('Usage: node validate-engagement-design.mjs <workspace>');process.exit(2);}
const root=path.resolve(workspace),dir=path.join(root,'.authoring');
const read=async n=>JSON.parse(await readFile(path.join(dir,n),'utf8'));
try{
 const [design,plan,candidates]=await Promise.all(['engagement-design.json','narrative-plan.json','concept-candidates.json'].map(read));
 const selected=candidates.candidates.find(x=>x.id===candidates.selected_candidate_id);
 assertEngagementDesign(design,{plan,selectedCandidate:selected});
 console.log('ENGAGEMENT_DESIGN_PASS: beats='+design.beat_pull.length);
}catch(e){console.error(e.message);process.exitCode=2;}
