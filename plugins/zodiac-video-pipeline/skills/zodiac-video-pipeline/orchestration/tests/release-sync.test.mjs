import test from 'node:test';import assert from 'node:assert/strict';
import {verifyReleaseSync,canonicalDigest} from '../verify-release-sync.mjs';
const id={name:'zodiac-video-pipeline',version:'2.3.6',contract_digest:'a'.repeat(64),source_sha:'abc',snapshot_digest:'b'.repeat(64)};
test('identical released artifacts authorize fallback',()=>assert.equal(verifyReleaseSync({installedManifest:id,stagedManifest:{...id},sourceManifest:{...id},allowGitHubFallback:true}).ok,true));
for(const [name,change] of [['stale',{version:'2.3.5'}],['unreleased',{version:'2.3.7'}],['changed hash',{contract_digest:'c'.repeat(64)}],['changed commit',{source_sha:'def'}],['changed snapshot',{snapshot_digest:'d'.repeat(64)}]])test(name+' fails closed',()=>{const result=verifyReleaseSync({installedManifest:id,stagedManifest:id,sourceManifest:{...id,...change},allowGitHubFallback:true});assert.equal(result.ok,false);assert.match(result.issues.join(),/SOURCE_RELEASE_MISMATCH/)});
test('missing identity fails closed',()=>assert.equal(verifyReleaseSync({installedManifest:id,stagedManifest:null,sourceManifest:id}).ok,false));
test('digest stable across object insertion order',()=>assert.equal(canonicalDigest({b:1,a:{z:2,c:3}}),canonicalDigest({a:{c:3,z:2},b:1})));
