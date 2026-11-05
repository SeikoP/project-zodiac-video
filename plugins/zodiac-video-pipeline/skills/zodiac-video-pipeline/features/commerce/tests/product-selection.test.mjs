import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeProductSelection} from '../write-product-selection.mjs';

test('writes canonical Kalodata selection and matching TikTok search handoff', async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'z-commerce-selection-'));
  try{
    const product={product_id:'1730001',product_name:'Cốc giữ nhiệt ABC 900ml',seller_name:'ABC Official Store',commission_rate:12,unit_price:189000,sales_volumn:4821,video_revenue:82000000,master_image_url:'https://cdn.example.com/hero.png'};
    const result=await writeProductSelection(root,product,{retrievedAt:'2026-11-05T12:00:00Z',creativeScores:{story_fit:0.91,visual_quality:0.8,demo_potential:0.7,price_fit:0.8}});
    assert.equal(result.selection.provider,'kalodata');
    assert.equal(result.selection.product.product_id,'1730001');
    assert.equal(result.selection.creative_scores.story_fit,0.91);
    assert.equal(result.handoff.kalodata_product_id,'1730001');
    assert.equal(result.handoff.tiktok_search_query,'Cốc giữ nhiệt ABC 900ml ABC Official Store');
    assert.equal('direct_product_url' in result.handoff,false);
    const savedSelection=JSON.parse(await readFile(path.join(root,'.authoring/commerce/product-selection.json'),'utf8'));
    const savedHandoff=JSON.parse(await readFile(path.join(root,'.authoring/commerce/affiliate-handoff.json'),'utf8'));
    assert.deepEqual(savedSelection,result.selection);
    assert.deepEqual(savedHandoff,result.handoff);
  }finally{await rm(root,{recursive:true,force:true});}
});
