const fail=code=>{throw new Error(code)};
const sha64=v=>/^[a-f0-9]{64}$/u.test(String(v??''));

export function validateCommerceProductTransport(asset,svg){
  const c=asset?.commerce;
  if(c?.format!=='zodiac-product-media-ref@1')fail('COMMERCE_METADATA_FORMAT');
  if(c.provider!=='kalodata')fail('COMMERCE_PROVIDER');
  if(c.transport!=='svg_raster_embed')fail('COMMERCE_TRANSPORT');
  if(!String(c.product_id??'').trim()||!String(c.role??'').trim())fail('COMMERCE_PRODUCT_IDENTITY');
  if(!['image/png','image/jpeg','image/webp'].includes(c.source_mime))fail('COMMERCE_SOURCE_MIME');
  if(!Number.isFinite(Number(c.source_width))||Number(c.source_width)<1||!Number.isFinite(Number(c.source_height))||Number(c.source_height)<1)fail('COMMERCE_SOURCE_DIMENSIONS');
  if(!sha64(c.source_sha256))fail('COMMERCE_SOURCE_HASH');
  if(asset.category!=='story_object'&&asset.category!=='prop')fail('COMMERCE_CATEGORY');
  if(!/^assets\/product\/[A-Za-z0-9._-]+\.svg$/u.test(String(asset.path??'')))fail('COMMERCE_ASSET_PATH');
  const raw=String(svg??'');
  if(!/<svg\b/u.test(raw)||!/<image\b/u.test(raw)||! /viewBox\s*=\s*["'][^"']+["']/u.test(raw))fail('COMMERCE_SVG_STRUCTURE');
  if(/<\s*(?:script|foreignObject|filter|animate\w*|use)\b/iu.test(raw))fail('COMMERCE_SVG_UNSAFE');
  const embedded=raw.match(/href\s*=\s*["']data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)["']/u);
  if(!embedded)fail('COMMERCE_EMBED_REQUIRED');
  if(embedded[1]!==c.source_mime)fail('COMMERCE_EMBED_MIME_MISMATCH');
  if(/https?:\/\//iu.test(raw.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/u,'')))fail('COMMERCE_REMOTE_RUNTIME_FORBIDDEN');
  return {status:'PASS',provider:'kalodata',product_id:String(c.product_id)};
}
