import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPublishEditorial} from '../../features/publish/assess-publish-editorial.mjs';

const scene={entities:[
 {id:'lead',kind:'character'}, {id:'balance',kind:'narrative_visual'}
]};
const good={title:'Thiên Bình suy nghĩ quá lâu rồi lại đổi quyết định ngay phút cuối',
 cover:{hook:'THIÊN BÌNH CÂN NHẮC ĐẾN KHI BỎ LỠ CẢ HAI?',visuals:[
 {entity_id:'lead',state_id:'neutral'},{entity_id:'balance',state_id:'left'}]},
 hashtags:['#ThienBinh','#CungHoangDao','#TinhCachThienBinh','#DoDu','#bungmoto']};

test('fresh publishing requires meaningful title, hook, tags, actor and Narrative Visual',()=>{
 assert.equal(assessPublishEditorial(good,scene,{fresh:true}).status,'EDITORIAL_STRUCTURE_PASS');
 const poor={...good,title:'Thiên Bình',cover:{hook:'THIÊN BÌNH?',visuals:[]},hashtags:['#ThienBinh']};
 const codes=assessPublishEditorial(poor,scene,{fresh:true}).issues.map(x=>x.code);
 for(const code of ['PUBLISH_TITLE_INCOMPLETE','COVER_HOOK_TOO_THIN','PUBLISH_HASHTAG_COVERAGE_LOW','COVER_CHARACTER_MISSING','COVER_SEMANTIC_VISUAL_MISSING'])
  assert.ok(codes.includes(code),code);
});
test('explicit semantic omission allows character-only cover but not duplicated visuals',()=>{
 const cover={...good.cover,visuals:[{entity_id:'lead',state_id:'neutral'}],visual_omissions:{narrative_visual:'This beat only needs the actor expression'}};
 assert.equal(assessPublishEditorial({...good,cover},scene,{fresh:true}).status,'EDITORIAL_STRUCTURE_PASS');
 const duplicate={...cover,visuals:[cover.visuals[0],cover.visuals[0]]};
 assert.ok(assessPublishEditorial({...good,cover:duplicate},scene,{fresh:true}).issues.some(x=>x.code==='COVER_VISUAL_DUPLICATE'));
});
test('legacy publish packages retain compatibility',()=>{
 assert.equal(assessPublishEditorial({hashtags:['#BoCap']},scene,{fresh:false}).status,'LEGACY_COMPATIBLE');
});
