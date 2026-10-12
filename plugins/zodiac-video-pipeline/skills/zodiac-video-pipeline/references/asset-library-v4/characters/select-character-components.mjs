const hash32=s=>{let h=2166136261;for(const c of String(s)){h^=c.codePointAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
export function freshPreferredHairIds(catalog){
 return (catalog?.hair??[]).filter(row=>row.selection_tier==='preferred_meme').map(row=>row.id);
}
export function selectHairId({requested_id,seed='',mode='fresh'}={},catalog){
 const all=(catalog?.hair??[]).map(row=>row.id);
 if(requested_id){
  if(!all.includes(requested_id))throw new Error('HAIR_UNKNOWN '+requested_id);
  if(mode==='fresh'&&!freshPreferredHairIds(catalog).includes(requested_id))throw new Error('HAIR_NOT_FRESH_PREFERRED '+requested_id);
  return requested_id;
 }
 const pool=mode==='fresh'?freshPreferredHairIds(catalog):all;
 if(!pool.length)throw new Error('HAIR_POOL_EMPTY');
 return pool[hash32(seed)%pool.length];
}
