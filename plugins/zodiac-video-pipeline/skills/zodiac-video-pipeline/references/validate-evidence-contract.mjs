#!/usr/bin/env node
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
const rootArg=process.argv[2];
if(!rootArg){console.error('Usage: node validate-evidence-contract.mjs <workspace-root>');process.exit(2);}
const root=path.resolve(rootArg);
const fail=m=>{throw new Error('EVIDENCE_CONTRACT_INVALID: '+m);};
const exists=p=>access(p).then(()=>true).catch(()=>false);
const resolveArtifact=async name=>{for(const p of [path.join(root,'.authoring',name),path.join(root,name)])if(await exists(p))return p;fail('missing '+name);};
const ledger=JSON.parse(await readFile(await resolveArtifact('evidence-ledger.json'),'utf8'));
const summary=(await readFile(await resolveArtifact('evidence-summary.md'),'utf8')).trim();
if(!summary)fail('evidence-summary.md must be non-empty');
const entries=Array.isArray(ledger.entries)?ledger.entries:Array.isArray(ledger.sources)?ledger.sources:null;
if(!entries||entries.length<2)fail('at least two independent useful sources are required');
const ids=new Set(),sources=new Set();
const sourceIdentity=e=>{if(typeof e?.url==='string'&&e.url.trim()){try{return new URL(e.url).hostname.toLowerCase().replace(/^www\./u,'');}catch{}}return String(e?.source_domain??e?.source??e?.publisher??'').trim().toLowerCase();};
for(const [i,e] of entries.entries()){
  if(!e||typeof e!=='object'||Array.isArray(e))fail(`entry ${i+1} must be an object`);
  if(typeof e.id!=='string'||!e.id.trim())fail(`entry ${i+1} missing id`);
  if(ids.has(e.id))fail('duplicate evidence id '+e.id);ids.add(e.id);
  const sid=sourceIdentity(e);if(!sid)fail(`${e.id} missing source identity`);sources.add(sid);
  const interpretation=e.supported_interpretation??e.interpretation??e.claim??e.summary??e.supports;
  if(typeof interpretation!=='string'||!interpretation.trim())fail(`${e.id} missing supported interpretation`);
}
if(sources.size<2)fail('evidence ledger needs at least two independent source identities');
if(typeof ledger.central_claim==='string'&&!ledger.central_claim.trim())fail('central_claim may not be blank');
console.log(`EVIDENCE_CONTRACT_PASS: entries=${entries.length} independent_sources=${sources.size}`);
