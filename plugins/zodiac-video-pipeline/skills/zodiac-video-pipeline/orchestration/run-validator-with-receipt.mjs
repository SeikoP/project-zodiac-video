#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const [capabilityId,receiptPath,validator,...args]=process.argv.slice(2);
if(!capabilityId||!receiptPath||!validator){
  console.error('Usage: node run-validator-with-receipt.mjs <capability_id> <receipt_path> <validator_script> [args...]');
  process.exit(2);
}
const started=new Date().toISOString();
const run=spawnSync(process.execPath,[validator,...args],{encoding:'utf8'});
const receipt={
  format:'zodiac-validator-receipt@1',
  capability_id:capabilityId,
  validator:validator.replaceAll('\\','/'),
  args,
  executed_at:started,
  exit_code:run.status??1,
  status:run.status===0?'PASS':'FAIL',
  stdout:String(run.stdout??'').slice(-4000),
  stderr:String(run.stderr??'').slice(-4000)
};
await mkdir(path.dirname(receiptPath),{recursive:true});
await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n','utf8');
if(run.stdout)process.stdout.write(run.stdout);
if(run.stderr)process.stderr.write(run.stderr);
process.exit(run.status??1);
