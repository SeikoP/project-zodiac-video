import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {writeMonetizationDecision,readMonetizationDecision,validateMonetizationDecision} from '../monetization-gate.mjs';
import {validateCommerceWorkspace} from '../validate-affiliate-integration.mjs';

const mockAd=()=>({topology:'interrupt',treatment:'narrator_hijack',commercial_duration_s:9,return_mechanism:'snap_back',story_before_anchor:'Trước câu chuyện.',story_after_anchor:'Trở lại câu chuyện.',fictional_product:'Máy lọc suy nghĩ Sao Mộc',text:'Quảng cáo hư cấu: Máy lọc suy nghĩ Sao Mộc chỉ giữ lại điều đáng nhớ.'});
async function mockWorkspace(root){await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify({flags:{mock_ad_enabled:true,affiliate_enabled:false}}));const ad=mockAd();await writeFile(path.join(root,'.authoring/narrative-plan.json'),JSON.stringify({mock_ad:ad}));await writeFile(path.join(root,'narration.txt'),[ad.story_before_anchor,ad.text,ad.story_after_anchor].join('\n'));return ad;}

test('mock ad uses the narrative plan and narration without creating commerce files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'z-mock-'));
 try{const ad=await mockWorkspace(root);await writeFile(path.join(root,'production.json'),JSON.stringify({scenes:[{id:'ad',voice:[ad.story_before_anchor,ad.text,ad.story_after_anchor].join('\n')}]}));for(const stage of ['content','visual']){const r=await validateCommerceWorkspace(root,{stage});assert.equal(r.status,'PASS');assert.equal(r.mode,'fictional');}await assert.rejects(()=>readFile(path.join(root,'.authoring/commerce/monetization.json')),/ENOENT/);}finally{await rm(root,{recursive:true,force:true});}
});

test('mock ad requires disclosed fictional copy in the actual narration and a return to story',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'z-mock-'));
 try{const ad=await mockWorkspace(root);for(const change of [{text:ad.text.replace('Quảng cáo hư cấu: ','')},{return_mechanism:'none'},{commercial_duration_s:20},{product_id:'real-product'},{fictional_product:'Real URL https://shop.example/item'}]){await writeFile(path.join(root,'.authoring/narrative-plan.json'),JSON.stringify({mock_ad:{...ad,...change}}));await assert.rejects(()=>validateCommerceWorkspace(root,{stage:'content'}),/MOCK_AD_|INTEGRATION_|DURATION_/);}await writeFile(path.join(root,'.authoring/narrative-plan.json'),JSON.stringify({mock_ad:ad}));await writeFile(path.join(root,'narration.txt'),ad.text);await assert.rejects(()=>validateCommerceWorkspace(root),/MOCK_AD_STORY_ANCHORS/);}finally{await rm(root,{recursive:true,force:true});}
});

test('mock visual validation binds ad scenes to approved narration without product assets',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'z-mock-'));
 try{const ad=await mockWorkspace(root);await writeFile(path.join(root,'production.json'),JSON.stringify({scenes:[{id:'s01',voice:ad.story_before_anchor},{id:'ad',voice:ad.text},{id:'s02',voice:ad.story_after_anchor}]}));assert.equal((await validateCommerceWorkspace(root,{stage:'visual'})).status,'PASS');await writeFile(path.join(root,'production.json'),JSON.stringify({scenes:[{id:'s01',voice:ad.story_before_anchor}]}));await assert.rejects(()=>validateCommerceWorkspace(root,{stage:'visual'}),/MOCK_AD_VISUAL_COPY_MISMATCH/);}finally{await rm(root,{recursive:true,force:true});}
});

test('monetization decision persists explicitly in authoring state',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'z-mon-'));try{const d=await writeMonetizationDecision(root,'yes');assert.equal(d.advertising,true);const r=await readMonetizationDecision(root);assert.deepEqual(r,d);}finally{await rm(root,{recursive:true,force:true});}});

test('disabled commerce needs no product artifacts',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'z-mon-'));try{await writeMonetizationDecision(root,'no');assert.equal((await validateCommerceWorkspace(root)).status,'PASS');}finally{await rm(root,{recursive:true,force:true});}});

test('enabled commerce requires selection media integration and handoff',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'z-mon-'));try{await writeMonetizationDecision(root,'yes');await assert.rejects(()=>validateCommerceWorkspace(root),/PRODUCT_SELECTION_REQUIRED/);const dir=path.join(root,'.authoring','commerce');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'product-selection.json'),JSON.stringify({format:'zodiac-product-selection@1',provider:'kalodata',product:{product_id:'123',product_name:'Cup',seller_name:'Shop'}}));await writeFile(path.join(dir,'product-media.json'),JSON.stringify({format:'zodiac-product-media@1',provider:'kalodata',product_id:'123',assets:[{id:'product.123.hero',path:'assets/product/123-hero.svg'}]}));await writeFile(path.join(dir,'affiliate-integration.json'),JSON.stringify({format:'zodiac-affiliate-integration@1',topology:'interrupt',treatment:'narrator_hijack',commercial_duration_s:9,return_mechanism:'snap_back',story_before_anchor:'before',story_after_anchor:'after',product_asset_ids:['product.123.hero'],claims:[]}));await writeFile(path.join(dir,'affiliate-handoff.json'),JSON.stringify({format:'zodiac-affiliate-handoff@1',provider:'kalodata',kalodata_product_id:'123',product_name:'Cup',seller_name:'Shop',tiktok_search_query:'Cup Shop',affiliate_status:'AFFILIATE_MARKET_VERIFIED',account_attach_status:'UNVERIFIED'}));assert.equal((await validateCommerceWorkspace(root)).status,'PASS');}finally{await rm(root,{recursive:true,force:true});}});

test('monetization decision updates the persisted affiliate routing flag',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'z-mon-route-'));try{await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify({flags:{affiliate_enabled:false}}));await writeMonetizationDecision(root,'yes');const state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json'),'utf8'));assert.equal(state.flags.affiliate_enabled,true);assert.equal((await validateMonetizationDecision(root)).status,'PASS');await writeMonetizationDecision(root,'no');const next=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json'),'utf8'));assert.equal(next.flags.affiliate_enabled,false);}finally{await rm(root,{recursive:true,force:true});}});

test('content validation does not require Phase 02 media but visual validation does',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'z-mon-stage-'));try{await writeMonetizationDecision(root,'yes');const dir=path.join(root,'.authoring','commerce');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'product-selection.json'),JSON.stringify({format:'zodiac-product-selection@1',provider:'kalodata',product:{product_id:'123',product_name:'Cup',seller_name:'Shop'}}));await writeFile(path.join(dir,'affiliate-integration.json'),JSON.stringify({format:'zodiac-affiliate-integration@1',topology:'interrupt',treatment:'narrator_hijack',commercial_duration_s:9,return_mechanism:'snap_back',story_before_anchor:'before',story_after_anchor:'after',product_asset_ids:['product.123.hero'],claims:[]}));await writeFile(path.join(dir,'affiliate-handoff.json'),JSON.stringify({format:'zodiac-affiliate-handoff@1',provider:'kalodata',kalodata_product_id:'123',product_name:'Cup',seller_name:'Shop',tiktok_search_query:'Cup Shop',affiliate_status:'AFFILIATE_MARKET_VERIFIED',account_attach_status:'UNVERIFIED'}));assert.equal((await validateCommerceWorkspace(root,{stage:'content'})).status,'PASS');await assert.rejects(()=>validateCommerceWorkspace(root,{stage:'visual'}),/PRODUCT_MEDIA_REQUIRED/);}finally{await rm(root,{recursive:true,force:true});}});

test('fresh story-hijack gate requires product pivot, compact demo and immediate return',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'z-hijack-'));
 try{
  await mkdir(path.join(root,'.authoring'),{recursive:true});
  const ad={
   topology:'interrupt',treatment:'prop_zoom',commercial_duration_s:10,return_mechanism:'snap_back',
   story_before_anchor:'Ngẩng lên đã hai giờ sáng.',story_after_anchor:'Nhưng người ta đợi là màn hình điện thoại, không phải chiếc đèn.',
   fictional_product:'Đèn bàn Thức Khuya',
   text:'MÀ KHOAN! Hai giờ sáng mà vẫn sáng trưng? Quảng cáo hư cấu: Đèn bàn Thức Khuya! Bật một cái, sáng cả góc phòng! Sáng đèn thì dễ, sáng tình thì khó! Chốt ngay!',
   story_hijack:{trigger:'hai giờ sáng',pivot:'MÀ KHOAN!',product_reveal:'Đèn bàn Thức Khuya!',demo:'Bật một cái, sáng cả góc phòng!',wordplay:'Sáng đèn thì dễ, sáng tình thì khó!',cta:'Chốt ngay!',snapback:'Nhưng người ta đợi là màn hình điện thoại'}
  };
  const narration=[ad.story_before_anchor,ad.text,ad.story_after_anchor,'Người ấy vẫn chưa nhắn.'].join('\n');
  await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify({flags:{mock_ad_enabled:true,affiliate_enabled:false,mock_ad_story_hijack_required:true}}));
  await writeFile(path.join(root,'narration.txt'),narration);
  const setPlan=async x=>writeFile(path.join(root,'.authoring/narrative-plan.json'),JSON.stringify({mock_ad:x}));
  await setPlan(ad);
  assert.equal((await validateCommerceWorkspace(root,{stage:'content'})).status,'PASS');
  await writeFile(path.join(root,'production.json'),JSON.stringify({scenes:[{id:'s01',voice:ad.story_before_anchor},{id:'ad',voice:ad.text},{id:'s02',voice:ad.story_after_anchor+'\\nNgười ấy vẫn chưa nhắn.'}]}));
  assert.equal((await validateCommerceWorkspace(root,{stage:'visual'})).status,'PASS');
  for(const [bad,reason] of [
   [{...ad,story_hijack:undefined},/MOCK_AD_STORY_HIJACK_REQUIRED/],
   [{...ad,story_hijack:{...ad.story_hijack,trigger:'không có trong truyện'}},/MOCK_AD_TRIGGER_NOT_IN_STORY/],
   [{...ad,story_hijack:{...ad.story_hijack,cta:'MÀ KHOAN!'}},/MOCK_AD_BEAT_ORDER_CTA/],
   [{...ad,story_hijack:{...ad.story_hijack,product_reveal:'Sản phẩm khác'}},/MOCK_AD_REVEAL_PRODUCT_MISMATCH/],
   [{...ad,story_hijack:{...ad.story_hijack,snapback:'Quay lại câu chuyện'}},/MOCK_AD_SNAPBACK_NOT_IMMEDIATE/]
  ]){
   await setPlan(bad);
   await assert.rejects(()=>validateCommerceWorkspace(root,{stage:'content'}),reason);
  }
 }finally{await rm(root,{recursive:true,force:true});}
});

test('existing approved-style mock ad remains compatible when new story-hijack flag is absent',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'z-legacy-mock-'));
 try{await mockWorkspace(root);assert.equal((await validateCommerceWorkspace(root,{stage:'content'})).status,'PASS');}
 finally{await rm(root,{recursive:true,force:true});}
});
