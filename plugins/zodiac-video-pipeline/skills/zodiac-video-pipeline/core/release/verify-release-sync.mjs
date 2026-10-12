import {createHash} from 'node:crypto';

export function canonicalDigest(value){
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

/** Verify trusted released identity before accepting GitHub source fallback. */
export function verifyReleaseSync({installedManifest,stagedManifest,sourceManifest,allowGitHubFallback=false}){
 const issues=[];
 const valid=x=>x&&typeof x==='object'&&typeof x.name==='string'&&typeof x.version==='string';
 if(![installedManifest,stagedManifest,sourceManifest].every(valid))issues.push('SOURCE_RELEASE_MISMATCH:missing_or_invalid_manifest');
 else{
  for(const [label,m] of [['staged',stagedManifest],['source',sourceManifest]]){
   if(m.name!==installedManifest.name||m.version!==installedManifest.version)issues.push('SOURCE_RELEASE_MISMATCH:'+label+'_identity');
  }
  for(const [label,m] of [['staged',stagedManifest],['source',sourceManifest]]){
   if(m.contract_digest!==installedManifest.contract_digest||!m.contract_digest)issues.push('SOURCE_RELEASE_MISMATCH:'+label+'_contract_digest');
  }
  if(allowGitHubFallback){
   if(!installedManifest.source_sha||sourceManifest.source_sha!==installedManifest.source_sha)issues.push('SOURCE_RELEASE_MISMATCH:github_commit');
   if(!installedManifest.snapshot_digest||sourceManifest.snapshot_digest!==installedManifest.snapshot_digest)issues.push('SOURCE_RELEASE_MISMATCH:github_snapshot');
  }
 }
 return {ok:issues.length===0,pluginVersion:installedManifest?.version??null,sourceSha:sourceManifest?.source_sha??null,contractDigest:installedManifest?.contract_digest??null,issues};
}
