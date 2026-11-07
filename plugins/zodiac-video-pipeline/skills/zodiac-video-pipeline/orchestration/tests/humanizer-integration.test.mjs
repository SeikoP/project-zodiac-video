import test from 'node:test';
import assert from 'node:assert/strict';
import {planPluginUse,validatePluginUse} from '../plan-plugin-use.mjs';

test('bundled Humanizer is available without external skill inventory',()=>{
 const r=planPluginUse({phase:'01-content',weaknesses:[{kind:'natural_voice',excerpt:'Đoạn này nghe quá công thức.'}],availableSkills:[]});
 const d=r.decisions[0];
 assert.equal(d.skill_id,'humanizer');
 assert.equal(d.status,'REQUESTED');
 assert.equal(d.preserve_semantics,true);
 assert.match(d.guidance_uri,/zodiac-video-pipeline\/humanizer\/skill\.md$/u);
 const applied={...r,decisions:[{...d,status:'APPLIED',skill_read_ref:'skill-read:humanizer',application_summary:'Giảm dấu hiệu văn mẫu, giữ nguyên facts, claims và payoff.'}]};
 assert.equal(validatePluginUse(applied).status,'VALID');
});

test('Humanizer remains conditional',()=>{
 assert.deepEqual(planPluginUse({phase:'01-content',weaknesses:[],availableSkills:[]}).decisions,[]);
});
