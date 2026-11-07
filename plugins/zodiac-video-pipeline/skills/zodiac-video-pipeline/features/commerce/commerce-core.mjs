const fail=code=>{throw new Error(code)};
const clamp01=v=>Math.max(0,Math.min(1,Number(v)||0));
const num=v=>Number.isFinite(Number(v))?Number(v):0;

export function normalizeMonetizationDecision(value){
  const v=String(value??'').trim().toLowerCase();
  if(v==='yes'||v==='y'||v==='true'||v==='1')return {format:'zodiac-monetization@1',advertising:true,provider:'kalodata'};
  if(v==='no'||v==='n'||v==='false'||v==='0')return {format:'zodiac-monetization@1',advertising:false};
  fail('YES_OR_NO_REQUIRED');
}

export function buildRankPayload(keyword,{pageSize=20,pageNumber=1,dateRange='last30Day',needImage=1}={}){
  if(!String(keyword??'').trim())fail('KALODATA_KEYWORD_REQUIRED');
  return {
    region:'VN',language:'vi-VN',currency:'VND',date_range:dateRange,
    sort_field:{field:'video_revenue',type:'DESC'},page_size:pageSize,page_number:pageNumber,
    is_affiliate:1,need_image:needImage,need_extra:true,keyword:String(keyword).trim()
  };
}

export function normalizeCandidates(rows=[],matchedKeywords=[]){
  const seen=new Map();
  for(const row of rows){
    const id=String(row?.product_id??'').trim();if(!id)continue;
    const prior=seen.get(id);
    const item={
      product_id:id,
      product_name:String(row.product_name??prior?.product_name??'').trim(),
      seller_id:String(row.seller_id??prior?.seller_id??'').trim(),
      seller_name:String(row.seller_name??prior?.seller_name??'').trim(),
      commission_rate:num(row.commission_rate??prior?.commission_rate),
      sales_volumn:num(row.sales_volumn??prior?.sales_volumn),
      video_revenue:num(row.video_revenue??prior?.video_revenue),
      unit_price:num(row.unit_price??prior?.unit_price),
      revenue:num(row.revenue??prior?.revenue),
      showcase_revenue:num(row.showcase_revenue??prior?.showcase_revenue),
      master_image_url:String(row.master_image_url??prior?.master_image_url??'').trim(),
      matched_keywords:[...new Set([...(prior?.matched_keywords??[]),...matchedKeywords.map(String)])]
    };
    seen.set(id,item);
  }
  return [...seen.values()];
}

const minMax=(items,key)=>{
  const vals=items.map(x=>num(x[key]));const min=Math.min(...vals),max=Math.max(...vals);
  return v=>max===min?(max>0?1:0):(num(v)-min)/(max-min);
};

export function rankCandidates(candidates,creativeScores={}){
  if(!Array.isArray(candidates)||!candidates.length)return [];
  const normVideo=minMax(candidates,'video_revenue'),normSales=minMax(candidates,'sales_volumn'),normCommission=minMax(candidates,'commission_rate');
  return candidates.map(c=>{
    const creative=creativeScores[c.product_id]??{};
    const story=clamp01(creative.story_fit),visual=clamp01(creative.visual_quality),demo=clamp01(creative.demo_potential),price=clamp01(creative.price_fit);
    let score=30*story+20*normVideo(c.video_revenue)+15*normSales(c.sales_volumn)+10*normCommission(c.commission_rate)+10*visual+10*demo+5*price;
    const disqualified=story<0.2; if(disqualified)score-=50;
    return {...c,creative_scores:{story_fit:story,visual_quality:visual,demo_potential:demo,price_fit:price},story_fit_disqualified:disqualified,score:Number(score.toFixed(4))};
  }).sort((a,b)=>b.score-a.score||b.video_revenue-a.video_revenue||a.product_id.localeCompare(b.product_id));
}

export function buildAffiliateHandoff(product,{retrievedAt=null}={}){
  if(!product?.product_id||!product?.product_name)fail('PRODUCT_IDENTITY_REQUIRED');
  const seller=String(product.seller_name??'').trim();
  return {
    format:'zodiac-affiliate-handoff@1',provider:'kalodata',region:'VN',kalodata_product_id:String(product.product_id),
    product_name:String(product.product_name).trim(),seller_name:seller,
    tiktok_search_query:[String(product.product_name).trim(),seller].filter(Boolean).join(' '),
    affiliate_status:'AFFILIATE_MARKET_VERIFIED',account_attach_status:'UNVERIFIED',
    price_snapshot:num(product.unit_price||product.min_price),commission_snapshot:num(product.commission_rate),
    sales_snapshot:num(product.sales_volumn),video_revenue_snapshot:num(product.video_revenue),
    thumbnail_source:String(product.master_image_url??''),...(retrievedAt?{retrieved_at:retrievedAt}:{})
  };
}

const TOPOLOGIES=new Set(['interrupt','embedded','seed_and_reveal','split_exposure','post_payoff','callback']);
const TREATMENTS=new Set(['narrator_hijack','freeze_analysis','prop_zoom','character_demo','mystery_clue','visual_annotation','comparison_card']);
const RETURNS=new Set(['snap_back','unfreeze','zoom_out','character_callback','narrator_callback','prop_callback','dialogue_resume']);
const CLAIMS=new Set(['observable_feature','seller_claim','kalodata_metric','creative_copy']);

export function commercialDurationClass(seconds){
  const s=Number(seconds);if(!Number.isFinite(s)||s<5||s>18)fail('DURATION_OUT_OF_RANGE');
  if(s<=7)return 'flash';if(s<=12)return 'standard';if(s<=15)return 'demo';return 'extended';
}

function validateAdvertisementStructure(plan){
  if(!TOPOLOGIES.has(plan.topology))fail('INTEGRATION_TOPOLOGY');
  if(!TREATMENTS.has(plan.treatment))fail('INTEGRATION_TREATMENT');
  commercialDurationClass(plan.commercial_duration_s);
  if(!RETURNS.has(plan.return_mechanism))fail('INTEGRATION_RETURN');
  if(!String(plan.story_before_anchor??'').trim()||!String(plan.story_after_anchor??'').trim())fail('STORY_ANCHORS_REQUIRED');
}

// Fresh story-hijack advertisements make their creative beats auditable. This
// structural check does not certify a joke, product demonstration or copy quality.
function assertStoryHijack(ad,narration,at){
  const v=ad.story_hijack;
  if(!v||typeof v!=='object'||Array.isArray(v))fail('MOCK_AD_STORY_HIJACK_REQUIRED');
  const keys=['trigger','pivot','product_reveal','demo','wordplay','cta','snapback'];
  if(Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>typeof v[k]!=='string'||!v[k].trim()))
    fail('MOCK_AD_STORY_HIJACK_FIELDS');
  const before=narration.slice(0,at),after=narration.slice(at+ad.text.length);
  if(!before.includes(v.trigger)||!ad.story_before_anchor.includes(v.trigger))
    fail('MOCK_AD_TRIGGER_NOT_IN_STORY');
  let previous=-1;
  for(const key of ['pivot','product_reveal','demo','cta']){
    const pos=ad.text.indexOf(v[key],previous+1);
    if(pos<0||pos<=previous)fail('MOCK_AD_BEAT_ORDER_'+key.toUpperCase());
    previous=pos;
  }
  if(!v.product_reveal.includes(ad.fictional_product))fail('MOCK_AD_REVEAL_PRODUCT_MISMATCH');
  if(!ad.text.includes(v.wordplay))fail('MOCK_AD_WORDPLAY_MISSING');
  if(!ad.story_after_anchor.startsWith(v.snapback)||!after.trimStart().startsWith(v.snapback))
    fail('MOCK_AD_SNAPBACK_NOT_IMMEDIATE');
  const afterSnap=after.trimStart().slice(v.snapback.length);
  if(!afterSnap.trim())fail('MOCK_AD_STORY_RESUMPTION_MISSING');
  // A literal transition explanation is not a sudden return.
  if(/^(?:quay lại|trở lại|tiếp tục)\s+(?:câu chuyện|nội dung)/iu.test(v.snapback.trim()))
    fail('MOCK_AD_META_RETURN_FORBIDDEN');
}

export function validateMockAdvertisement(plan,narration,{requireStoryHijack=false}={}){
  if(!plan||typeof plan!=='object'||Array.isArray(plan))fail('MOCK_AD_REQUIRED');
  const fields=new Set(['topology','treatment','commercial_duration_s','return_mechanism','story_before_anchor','story_after_anchor','fictional_product','text','story_hijack','disclosure']);
  if(Object.keys(plan).some(k=>!fields.has(k)))fail('MOCK_AD_COMMERCIAL_FIELDS_FORBIDDEN');
  validateAdvertisementStructure(plan);
  if(typeof plan.fictional_product!=='string'||!plan.fictional_product.trim()||typeof plan.text!=='string'||!plan.text.includes(plan.fictional_product))fail('MOCK_AD_FICTIONAL_PRODUCT_REQUIRED');
  const spokenDisclosure=/quảng cáo hư cấu/iu.test(plan.text);
  const visualDisclosure=plan.disclosure?.mode==='visual_label'&&plan.disclosure?.label==='Quảng cáo hư cấu';
  if(plan.disclosure!==undefined&&!visualDisclosure)fail('MOCK_AD_DISCLOSURE_PLAN_INVALID');
  if(!spokenDisclosure&&!visualDisclosure)fail('MOCK_AD_DISCLOSURE_REQUIRED');
  if(/https?:\/\//iu.test(plan.text+plan.fictional_product))fail('MOCK_AD_EXTERNAL_PRODUCT_FORBIDDEN');
  if(typeof narration!=='string')fail('MOCK_AD_NARRATION_REQUIRED');
  const at=narration.indexOf(plan.text);
  if(at<0||narration.indexOf(plan.text,at+1)>=0)fail('MOCK_AD_COPY_MISMATCH');
  if(!narration.slice(0,at).includes(plan.story_before_anchor)||!narration.slice(at+plan.text.length).includes(plan.story_after_anchor))fail('MOCK_AD_STORY_ANCHORS');
  if(requireStoryHijack||plan.story_hijack!==undefined)assertStoryHijack(plan,narration,at);
  return {status:'PASS',mode:'fictional',disclosure_mode:spokenDisclosure?'spoken':'visual_label',issues:[]};
}

export function validateAffiliateIntegrationPlan(plan,{recent=[]}={}){
  if(plan?.format!=='zodiac-affiliate-integration@1')fail('INTEGRATION_FORMAT');
  validateAdvertisementStructure(plan);
  if(!Array.isArray(plan.product_asset_ids)||!plan.product_asset_ids.length)fail('PRODUCT_ASSETS_REQUIRED');
  if(!Array.isArray(plan.claims))fail('CLAIMS_REQUIRED');
  for(const c of plan.claims)if(!CLAIMS.has(c?.type)||!String(c?.text??'').trim())fail('INVALID_CLAIM');
  const recentPair=recent.slice(-3).filter(x=>x?.topology===plan.topology&&x?.treatment===plan.treatment).length;
  if(recentPair>=2&&!String(plan.repeat_reason??'').trim())return {status:'REVIEW',issues:[{code:'RECENT_MOTIF_REPETITION',topology:plan.topology,treatment:plan.treatment}]};
  return {status:'PASS',issues:[]};
}
