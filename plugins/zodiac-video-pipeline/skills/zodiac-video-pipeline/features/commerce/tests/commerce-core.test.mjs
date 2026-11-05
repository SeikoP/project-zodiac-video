import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  normalizeMonetizationDecision,
  buildRankPayload,
  normalizeCandidates,
  rankCandidates,
  buildAffiliateHandoff,
  validateAffiliateIntegrationPlan,
  commercialDurationClass,
} from '../commerce-core.mjs';
import {kalodataRequest} from '../kalodata-client.mjs';
import {localizeProductMedia, sniffImage} from '../product-media-adapter.mjs';

test('monetization gate is explicit yes/no and Kalodata-only when enabled',()=>{
  assert.deepEqual(normalizeMonetizationDecision('no'),{format:'zodiac-monetization@1',advertising:false});
  assert.deepEqual(normalizeMonetizationDecision('YES'),{format:'zodiac-monetization@1',advertising:true,provider:'kalodata'});
  assert.throws(()=>normalizeMonetizationDecision('maybe'),/YES_OR_NO_REQUIRED/);
});

test('Kalodata rank payload is Vietnam affiliate-first and video-commerce oriented',()=>{
  const p=buildRankPayload('cốc giữ nhiệt');
  assert.equal(p.region,'VN');
  assert.equal(p.language,'vi-VN');
  assert.equal(p.currency,'VND');
  assert.equal(p.date_range,'last30Day');
  assert.equal(p.is_affiliate,1);
  assert.equal(p.need_image,1);
  assert.equal(p.need_extra,true);
  assert.equal(p.keyword,'cốc giữ nhiệt');
  assert.deepEqual(p.sort_field,{field:'video_revenue',type:'DESC'});
});

test('Kalodata client sends secret-key header and fails closed without a key',async()=>{
  await assert.rejects(()=>kalodataRequest('/openapi/v1/tiktok/product/rank',{}, {apiKey:'',fetchImpl:async()=>{}}),/KALODATA_API_KEY_MISSING/);
  let seen;
  const fetchImpl=async(url,opts)=>{seen={url,opts};return {ok:true,json:async()=>({success:true,data:[]})};};
  await kalodataRequest('/openapi/v1/tiktok/product/rank',{region:'VN'},{apiKey:'k_test',fetchImpl,baseUrl:'https://www.kalodata.com'});
  assert.equal(seen.opts.headers['secret-key'],'k_test');
  assert.equal(seen.opts.headers['content-type'],'application/json;charset=UTF-8');
});

test('candidate ranking keeps story fit above commission',()=>{
  const raw=[
    {product_id:'a',product_name:'Cốc giữ nhiệt A',seller_name:'A Store',commission_rate:8,sales_volumn:100,video_revenue:1000,unit_price:180000,master_image_url:'https://img/a.jpg'},
    {product_id:'b',product_name:'Sản phẩm ít liên quan B',seller_name:'B Store',commission_rate:30,sales_volumn:1000,video_revenue:10000,unit_price:180000,master_image_url:'https://img/b.jpg'},
  ];
  const candidates=normalizeCandidates(raw,['cốc giữ nhiệt']);
  const ranked=rankCandidates(candidates,{a:{story_fit:1,visual_quality:.8,demo_potential:.8,price_fit:.8},b:{story_fit:.05,visual_quality:.8,demo_potential:.8,price_fit:.8}});
  assert.equal(ranked[0].product_id,'a');
  assert.ok(ranked[0].score>ranked[1].score);
});

test('affiliate handoff never requires a TikTok URL',()=>{
  const handoff=buildAffiliateHandoff({product_id:'123',product_name:'Cốc ABC 900ml',seller_name:'ABC Official',unit_price:189000,commission_rate:12,master_image_url:'https://img/abc.jpg'});
  assert.equal(handoff.provider,'kalodata');
  assert.equal(handoff.tiktok_search_query,'Cốc ABC 900ml ABC Official');
  assert.equal(handoff.account_attach_status,'UNVERIFIED');
  assert.equal('direct_product_url' in handoff,false);
});

test('integration plan uses topology x treatment, adaptive duration, and penalizes recent repetition',()=>{
  const plan={format:'zodiac-affiliate-integration@1',topology:'interrupt',treatment:'narrator_hijack',commercial_duration_s:9,return_mechanism:'snap_back',story_before_anchor:'manh mối',story_after_anchor:'Bọ Cạp quan tâm gì',product_asset_ids:['product.123.hero'],claims:[{type:'observable_feature',text:'Dung tích 900ml'}]};
  assert.equal(validateAffiliateIntegrationPlan(plan,{recent:[{topology:'embedded',treatment:'character_demo'}]}).status,'PASS');
  assert.equal(commercialDurationClass(9),'standard');
  assert.equal(validateAffiliateIntegrationPlan(plan,{recent:[plan,plan]}).status,'REVIEW');
  assert.throws(()=>validateAffiliateIntegrationPlan({...plan,commercial_duration_s:3},{recent:[]}),/DURATION_OUT_OF_RANGE/);
});

test('product media adapter localizes PNG source and emits deterministic SVG transport',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-commerce-'));
  try{
    await mkdir(path.join(root,'.authoring'),{recursive:true});
    // 1x1 transparent PNG
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2QdQAAAAASUVORK5CYII=','base64');
    assert.deepEqual(sniffImage(png),{mime:'image/png',ext:'png',width:1,height:1});
    const fetchImpl=async()=>({ok:true,arrayBuffer:async()=>png,headers:{get:()=> 'image/png'}});
    const product={product_id:'123',product_name:'Cốc ABC',master_image_url:'https://img/hero.png',product_description:[]};
    const first=await localizeProductMedia(root,product,{fetchImpl,maxImages:1});
    const second=await localizeProductMedia(root,product,{fetchImpl,maxImages:1});
    assert.equal(first.assets[0].path,'assets/product/123-hero.svg');
    assert.equal(first.assets[0].sha256,second.assets[0].sha256);
    const svg=await readFile(path.join(root,first.assets[0].path),'utf8');
    assert.match(svg,/data:image\/png;base64,/);
    assert.match(svg,/preserveAspectRatio="xMidYMid meet"/);
    assert.equal(first.assets[0].transport_kind,'svg');
    assert.equal(first.assets[0].source_mime,'image/png');
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('commerce visual-intent asset projection preserves Kalodata provenance in supported Job@5 category',async()=>{
  const {buildVisualIntentProductAssets}=await import('../product-media-adapter.mjs');
  const media={format:'zodiac-product-media@1',provider:'kalodata',product_id:'123',assets:[{id:'product.123.hero',role:'hero',path:'assets/product/123-hero.svg',transport_kind:'svg',source_mime:'image/png',source_width:800,source_height:800,source_sha256:'a'.repeat(64),sha256:'b'.repeat(64)}]};
  const assets=buildVisualIntentProductAssets(media);
  assert.equal(assets['product.123.hero'].category,'story_object');
  assert.equal(assets['product.123.hero'].commerce.provider,'kalodata');
  assert.equal(assets['product.123.hero'].commerce.transport,'svg_raster_embed');
  assert.equal(assets['product.123.hero'].commerce.source_sha256,'a'.repeat(64));
});

test('product media byte sniffer reads JPEG and lossless WebP dimensions',()=>{
  // Minimal JPEG containing SOF0 2x3.
  const jpg=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0x00,0x03,0x00,0x02,0x03,0x01,0x11,0x00,0x02,0x11,0x00,0x03,0x11,0x00,0xff,0xd9]),Buffer.alloc(8)]);
  assert.deepEqual(sniffImage(jpg),{mime:'image/jpeg',ext:'jpg',width:2,height:3});
  // WebP VP8L header encoding width=2, height=3.
  const webp=Buffer.alloc(25);webp.write('RIFF',0,'ascii');webp.writeUInt32LE(17,4);webp.write('WEBP',8,'ascii');webp.write('VP8L',12,'ascii');webp.writeUInt32LE(5,16);webp[20]=0x2f;webp[21]=1;webp[22]=0x80;webp[23]=0;webp[24]=0;
  assert.deepEqual(sniffImage(webp),{mime:'image/webp',ext:'webp',width:2,height:3});
});
