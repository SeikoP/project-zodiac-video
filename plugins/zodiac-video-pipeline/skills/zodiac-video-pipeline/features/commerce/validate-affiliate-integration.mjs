#!/usr/bin/env node
import {access,readFile} from 'node:fs/promises';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateAffiliateIntegrationPlan,validateMockAdvertisement} from './commerce-core.mjs';
import {readArtifact} from '../../phases/phase01/phase01-artifacts.mjs';
import {readCommerceHistory} from './commerce-history.mjs';
const exists=p=>access(p).then(()=>true).catch(()=>false);
const fail=code=>{throw new Error(code)};
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));

export async function validateCommerceWorkspace(workspace,{recent=null,stage='visual'}={}){
  if(!['content','visual'].includes(stage))fail('AFFILIATE_VALIDATION_STAGE_INVALID');
  let state;try{state=await readJson(path.join(workspace,'.authoring/pipeline-state.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(state?.flags?.mock_ad_enabled){
    if(state.flags.affiliate_enabled)fail('MOCK_AD_AFFILIATE_CONFLICT');
    const plan=await readArtifact(workspace,'narrative-plan.json');
    let narration;try{narration=await readFile(path.join(workspace,'.authoring/narration.txt'),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;narration=await readFile(path.join(workspace,'narration.txt'),'utf8');}
    const requireStoryHijack=state.flags.mock_ad_story_hijack_required===true;
    const verdict=validateMockAdvertisement(plan.mock_ad,narration,{requireStoryHijack});
    if(stage==='visual'){
      const production=await readJson(path.join(workspace,'production.json'));
      if(verdict.disclosure_mode==='visual_label'){
        const label=plan.mock_ad.disclosure.label;
        const shown=(production.scenes??[]).some(s=>
          String(s.voice??'').includes(plan.mock_ad.fictional_product)&&
          JSON.stringify(s.entities??[]).includes(label)
        );
        if(!shown)fail('MOCK_AD_VISUAL_DISCLOSURE_MISSING');
      }
      const voice=(production.scenes??[]).map(s=>s.voice??'').join(production.voice_partition==='utf8_ranges'?'':'\n');
      try{validateMockAdvertisement(plan.mock_ad,voice,{requireStoryHijack});}catch(e){fail('MOCK_AD_VISUAL_COPY_MISMATCH '+e.message);}
    }
    return {...verdict,advertising:false,stage};
  }
  const dir=path.join(workspace,'.authoring','commerce');const monetizationPath=path.join(dir,'monetization.json');
  if(!(await exists(monetizationPath)))fail('MONETIZATION_DECISION_REQUIRED');
  const monetization=await readJson(monetizationPath);
  if(monetization?.format!=='zodiac-monetization@1'||typeof monetization.advertising!=='boolean')fail('MONETIZATION_DECISION_INVALID');
  if(!monetization.advertising)return {status:'PASS',advertising:false,stage,issues:[]};
  if(monetization.provider!=='kalodata')fail('KALODATA_PROVIDER_REQUIRED');
  const common={selection:'product-selection.json',integration:'affiliate-integration.json',handoff:'affiliate-handoff.json'};
  for(const [key,rel] of Object.entries(common))if(!(await exists(path.join(dir,rel))))fail(key==='selection'?'PRODUCT_SELECTION_REQUIRED':key==='integration'?'AFFILIATE_INTEGRATION_REQUIRED':'AFFILIATE_HANDOFF_REQUIRED');
  const selection=await readJson(path.join(dir,common.selection)),integration=await readJson(path.join(dir,common.integration)),handoff=await readJson(path.join(dir,common.handoff));
  if(selection?.format!=='zodiac-product-selection@1'||selection.provider!=='kalodata'||!selection.product?.product_id)fail('PRODUCT_SELECTION_INVALID');
  const historyRecent=recent??(await readCommerceHistory(workspace)).entries;
  const integrationVerdict=validateAffiliateIntegrationPlan(integration,{recent:historyRecent});if(integrationVerdict.status==='REVIEW')return {status:'REVIEW',advertising:true,stage,issues:integrationVerdict.issues};
  if(handoff?.format!=='zodiac-affiliate-handoff@1'||handoff.provider!=='kalodata'||String(handoff.kalodata_product_id)!==String(selection.product.product_id)||!String(handoff.tiktok_search_query??'').trim())fail('AFFILIATE_HANDOFF_INVALID');
  if('direct_product_url' in handoff)fail('DIRECT_PRODUCT_URL_FORBIDDEN_V1');
  if(stage==='visual'){
    const mediaPath=path.join(dir,'product-media.json');if(!(await exists(mediaPath)))fail('PRODUCT_MEDIA_REQUIRED');
    const media=await readJson(mediaPath);
    if(media?.format!=='zodiac-product-media@1'||media.provider!=='kalodata'||String(media.product_id)!==String(selection.product.product_id)||!Array.isArray(media.assets)||!media.assets.length)fail('PRODUCT_MEDIA_INVALID');
    if(!media.assets.some(x=>integration?.product_asset_ids?.includes(x.id)))fail('INTEGRATION_MEDIA_MISMATCH');
  }
  return {status:'PASS',advertising:true,stage,product_id:String(selection.product.product_id),issues:[]};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const workspace=process.argv[2],stage=process.argv[3]??'visual';if(!workspace){console.error('Usage: node validate-affiliate-integration.mjs <workspace> [content|visual]');process.exit(2);}try{const r=await validateCommerceWorkspace(path.resolve(workspace),{stage});console.log(`AFFILIATE_INTEGRATION_${r.status} advertising=${r.advertising} stage=${r.stage}`);if(r.status==='REVIEW')process.exitCode=1;}catch(e){console.error('AFFILIATE_INTEGRATION_BLOCKED '+e.message);process.exit(1);}}
