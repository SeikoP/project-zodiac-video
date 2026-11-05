import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {recordCommerceMotif,readCommerceHistory} from '../commerce-history.mjs';
import {validateCommerceWorkspace} from '../validate-affiliate-integration.mjs';

const plan={format:'zodiac-affiliate-integration@1',topology:'interrupt',treatment:'narrator_hijack',commercial_duration_s:9,return_mechanism:'snap_back',story_before_anchor:'before',story_after_anchor:'after',product_asset_ids:['product.123.hero'],claims:[]};

async function validWorkspace(root){const d=path.join(root,'.authoring/commerce');await mkdir(d,{recursive:true});for(const [name,value] of Object.entries({
 'monetization.json':{format:'zodiac-monetization@1',advertising:true,provider:'kalodata'},
 'product-selection.json':{format:'zodiac-product-selection@1',provider:'kalodata',product:{product_id:'123',product_name:'Cup',seller_name:'Shop'}},
 'product-media.json':{format:'zodiac-product-media@1',provider:'kalodata',product_id:'123',assets:[{id:'product.123.hero',path:'assets/product/123-hero.svg'}]},
 'affiliate-integration.json':plan,
 'affiliate-handoff.json':{format:'zodiac-affiliate-handoff@1',provider:'kalodata',kalodata_product_id:'123',product_name:'Cup',seller_name:'Shop',tiktok_search_query:'Cup Shop'}
}))await writeFile(path.join(d,name),JSON.stringify(value));}

test('motif history is durable and validator reads it by default',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'z-commerce-history-'));try{await validWorkspace(root);await recordCommerceMotif(root,plan,{episode_id:'ep1'});await recordCommerceMotif(root,plan,{episode_id:'ep2'});const h=await readCommerceHistory(root);assert.equal(h.entries.length,2);const v=await validateCommerceWorkspace(root);assert.equal(v.status,'REVIEW');assert.equal(v.issues[0].code,'RECENT_MOTIF_REPETITION');}finally{await rm(root,{recursive:true,force:true});}});
