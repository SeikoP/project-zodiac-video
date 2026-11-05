#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {assertEngagementDesign,assertEngagementReview} from '../features/episode/engagement-contract.mjs';
const [workspace]=process.argv.slice(2);
if(!workspace){console.error('Usage: node validate-engagement-review.mjs <workspace>');process.exit(2);}
const root=path.resolve(workspace),dir=path.join(root,'.authoring');
const readJson=async n=>JSON.parse(await readFile(path.join(dir,n),'utf8'));
try{
 const [review,design,plan,candidates,narrationRaw]=await Promise.all([
  readJson('engagement-review.json'),readJson('engagement-design.json'),readJson('narrative-plan.json'),readJson('concept-candidates.json'),readFile(path.join(dir,'narration.txt'),'utf8')
 ]);
 const selected=candidates.candidates.find(x=>x.id===candidates.selected_candidate_id);
 assertEngagementDesign(design,{plan,selectedCandidate:selected});
 assertEngagementReview(review,{design,plan,narrationRaw});
 console.log('ENGAGEMENT_REVIEW_PASS: criteria=6; beats='+review.pull_chain.length);
}catch(e){console.error(e.message);process.exitCode=2;}
