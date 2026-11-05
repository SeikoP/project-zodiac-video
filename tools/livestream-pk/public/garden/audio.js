const CARE=new Set(['plant','water','help','harvest','fertilize','pestClear','weedClear','softBlocked']);
export const CUE_LABELS={plant:'Gieo hạt',water:'Tưới nước',help:'Giúp bạn',harvest:'Hái cây',fertilize:'Bón phân',pestClear:'Bắt sâu',weedClear:'Nhổ cỏ',softBlocked:'Nhắc nhẹ',levelUp:'Lên cấp',tierUnlock:'Mở bậc chậu',achievement:'Thành tựu',theft:'Trộm cây',catch:'Bắt trộm',shieldBlock:'Khiên chặn',dew:'Sương tưới',star:'Phân sao',rain:'Mưa quà',wheelStart:'Mở vòng quay',wheelTick:'Nhịp vòng quay',wheelResult:'Kết quả quay',meteorFly:'Thiên thạch bay',meteorImpact:'Thiên thạch chạm',quake:'Địa chấn',bossIntro:'Boss xuất hiện',bossHit:'Tim đánh boss',bossGiftHit:'Quà đánh boss',bossWin:'Thắng boss',bossEscape:'Boss trốn',roundStart:'Mở phiên',podium:'Top 5',reward:'Trao thưởng',roundEnd:'Chốt phiên',rainStart:'Trời mưa',pestsStart:'Bão sâu',merchantStart:'Thương lái',goldenStart:'Giờ vàng'};
export function createGardenAudio({music,sfx,now=()=>performance.now(),onState=()=>{}}){
 let levels={master:1,music:.16,care:.2,event:.25},muted=false,timer=null,last=null,dropped=0,coalesced=0;
 const voices=[],seen=new Set(),starts=[],lastRole=new Map(),leases=new Map();
 const priority=role=>role==='wheelTick'?0:/bossWin|bossEscape|meteorImpact|quake/.test(role)?6:/boss|meteor/.test(role)?5:CARE.has(role)?1:3;
 function refreshDuck(){
  clearTimeout(timer);timer=null;
  for(const [id,lease] of leases)if(now()>=lease.until)leases.delete(id);
  const values=[...leases.values()];music.duck(values.length?Math.min(...values.map(l=>l.amount)):1,values.length?Math.max(...values.map(l=>l.until-now())):0);
  if(values.length){timer=setTimeout(refreshDuck,Math.max(10,Math.min(...values.map(l=>l.until-now()))+1));timer.unref?.();}
 }
 function status(){refreshDuck();return {muted,levels:{...levels},voices:voices.length,dropped,coalesced,last,...sfx.status?.()};}
 function remove(v){const i=voices.indexOf(v);if(i>=0)voices.splice(i,1);}
 const api={
  warmup:()=>sfx.warmup(),
  cue({role,eventId,sceneId,phase='action',count=1,ageMs=0,audition=false,sampleId}){
   if(!CUE_LABELS[role]||muted||levels.master===0||role==='softBlocked'&&!audition)return null;
   const care=CARE.has(role),key=`${eventId??sceneId??role}:${phase}:${role}`;
   if(seen.has(key))return null;
   if(care&&ageMs>500){dropped++;return null;}
   seen.add(key);while(seen.size>512)seen.delete(seen.values().next().value);
   const cooldown=role==='wheelTick'?75:role==='bossHit'?180:care?250:role==='achievement'?4000:1500;
   if(now()-(lastRole.get(role)??-Infinity)<cooldown){coalesced+=count;return null;}
   while(starts.length&&now()-starts[0].at>1000)starts.shift();
   const rank=priority(role),group=care?'care':'event';
   if(starts.length>=8||care&&starts.filter(s=>s.group==='care').length>=5){dropped++;return null;}
   const same=voices.filter(v=>v.group===group);
   if(same.length>=3||voices.length>=6){const candidates=same.length>=3?same:voices;const victim=candidates.find(v=>v.priority<=rank);if(!victim){dropped++;return null;}victim.handle.stop();remove(victim);}
   const handle=sfx(role,null,{managed:true,sampleId,gain:levels[group],cueId:key,priority:rank,group});
   if(!handle){dropped++;return null;}
   const voice={handle,priority:rank,group};voices.push(voice);handle.ended.then(()=>remove(voice));
   lastRole.set(role,now());starts.push({at:now(),group});coalesced+=Math.max(0,count-1);
   last={role,label:CUE_LABELS[role],sampleId:handle.sampleId,fallback:handle.fallback,eventId,sceneId,phase};
   if(!care&&role!=='bossHit'&&role!=='wheelTick'){leases.set(key,{amount:rank>=5?.2:.35,until:now()+(/bossIntro/.test(role)?2000:1500)});refreshDuck();}
   try{onState(status());}catch{}return handle;
  },
  setLevels(next){for(const key of Object.keys(levels))if(Number.isFinite(next[key]))levels[key]=Math.max(0,Math.min(1,next[key]));sfx.setVolume(muted?0:levels.master);music.setVolume?.(muted?0:levels.music*levels.master);},
  mute(on){muted=Boolean(on);if(muted)api.stop();sfx.setVolume(muted?0:levels.master);music.setVolume?.(muted?0:levels.music*levels.master);},
  stop(){for(const voice of [...voices])voice.handle.stop();voices.length=0;sfx.stop();leases.clear();clearTimeout(timer);timer=null;music.duck(1,0);},
  status,
 };
 return api;
}
