// Pure view math for the Vườn Mây page (no DOM), so it can be tested in Node.
export const lodOf = zoom => (zoom < 0.27 ? 'dot' : zoom < 1.25 ? 'plot' : 'close');
export const shouldReplaceNotice=(tone,remaining,nextTone)=>nextTone!=='normal'||!['hero','important'].includes(tone)||remaining<=0;

const IDENTITY_LABEL_THEMES=Object.freeze({
 clay:Object.freeze({fill:'#FFF7F0',accent:'#E97A66',levelFill:'#F1C6A0'}),
 glazed:Object.freeze({fill:'#EEF8F5',accent:'#5B9F95',levelFill:'#8EC0B9'}),
 banded:Object.freeze({fill:'#FFF7DE',accent:'#C99524',levelFill:'#F2C45C'}),
 royal:Object.freeze({fill:'#F1F8F6',accent:'#3F8278',levelFill:'#8EC0B9'}),
 astral:Object.freeze({fill:'#F1EEF5',accent:'#435064',levelFill:'#F2C45C'}),
});
export const identityLabelTheme=tier=>IDENTITY_LABEL_THEMES[tier]??IDENTITY_LABEL_THEMES.clay;

export function plotMotion(kind,elapsed,reduced=false){
 const neutral={scale:1,tilt:0,pulse:0};if(reduced||elapsed<0)return neutral;
 const duration=kind==='levelup'?1200:kind==='impact'?650:kind==='fertilize'?900:800,t=Math.min(1,elapsed/duration);
 if(t>=1)return neutral;
 const cropBounce=kind==='fertilize'?Math.sin(t*Math.PI)*(1-t)*.09:0;
 const cropTilt=['water','pest-cleared','weed-cleared'].includes(kind)?Math.sin(t*Math.PI*5)*(1-t)*(kind==='water'?.025:.045):0;
 return {scale:kind==='plant'?.55+.45*(1-(1-t)**3):1+cropBounce,
  tilt:kind==='impact'?Math.sin(t*Math.PI*6)*(1-t)*.08:cropTilt,
  pulse:kind==='levelup'?Math.sin(t*Math.PI*3)*(1-t)*.055:0};
}

export function cameraReason(shot) {
  if(shot?.kind==='event-focus')return `Cận cảnh · ${{rain:'Mưa tưới',pests:'Bão sâu',merchant:'Thương lái',golden:'Giờ vàng'}[shot.eventKind]??'Sự kiện'}`;
  return ({levelup:'Cận cảnh · Lên cấp',steal:'Cận cảnh · Trộm cây',catch:'Cận cảnh · Bắt trộm'})[shot?.kind]??'';
}

export const noticeTimeLeft = (remaining, elapsed, blocked) => blocked ? remaining : Math.max(0,remaining-Math.min(250,Math.max(0,elapsed)));

export function feedbackCommand(feedback) {
  if(!feedback.ok){
    if(feedback.reason==='gold')return feedback.action==='plant'?'tưới @tên':'chăm';
    return ({broken:'trồng','no-crop':'trồng','unknown-crop':'trồng',level:'trồng','not-ripe':'chăm',busy:'chăm',dog:'trộm @tên',shield:'trộm @tên',cap:'trộm @tên','no-target':'vườn'})[feedback.reason]??'chăm';
  }
  return feedback.action==='harvest'?'trồng':['steal','catch','dog','card'].includes(feedback.action)?'vườn':'chăm';
}

export function plotProblem(p,now,cfg) {
  if(!p?.owner||!p.awake)return null;
  if(p.brokenUntil>now)return {key:'broken',title:`Chậu nứt · ${Math.ceil((p.brokenUntil-now)/1000)}s`,command:null,hint:'Đợi rồi gieo rau miễn phí'};
  if(!p.crop&&p.replantCredit)return {key:'replant',title:'Gieo lại miễn phí',command:'trồng',hint:'Quà bị phá kèm hạt rau hồi phục'};
  if(p.prank?.kind==='slow'&&p.prank.until>now)return {key:'slow',title:`Mây lười · ${Math.ceil((p.prank.until-now)/1000)}s`,command:null,hint:'Tự hết sau 20s · cây vẫn lớn'};
  if(p.crop?.pest)return {key:'pest',title:'Có sâu',command:'chăm',hint:'“chăm” sẽ tự bắt sâu trước'};
  if(p.crop?.weeds)return {key:'weed',title:'Có cỏ',command:'chăm',hint:'“chăm” sẽ tự nhổ cỏ trước'};
  if(p.crop&&p.water<.25)return {key:'dry',title:'Đất khô',command:'chăm',hint:'“chăm” sẽ tự tưới khi cần'};
  const left=(cfg.sleepAfterMs??90000)-(now-(p.lastActive??now));
  if(left>0&&left<=30000)return {key:'idle',title:'Sắp nghỉ',command:'vườn',hint:`Gõ để giữ chậu · còn ${Math.ceil(left/1000)}s`};
  return null;
}

export function problemPresentation(previous,problem,now) {
  if(!problem)return null;
  if(!previous||previous.key!==problem.key||now>=previous.nextAt)return {...problem,until:now+4000,nextAt:now+24000};
  return {...previous,...problem};
}

export function plotOverlayMode({focused=false,feedback=null,shown=null}={}) {
  if(focused)return 'card';
  if(feedback&&['cooldown','busy','not-ripe','no-pest','no-weeds','already-fertilized'].includes(feedback.reason))return 'hidden';
  if(!feedback&&shown?.key==='idle')return 'hidden';
  return 'card';
}

export function growthBuffPresentation(p,now,zoom=1,activeCount=1) {
  if(!p?.crop||(p.stage??0)>=3)return null;
  const sources=[];
  if((p.growth?.speedUntil??0)>now)sources.push('speed');
  if((p.growth?.waterBoostUntil??0)>now)sources.push('water');
  if(p.growth?.fertilized)sources.push('fertilizer');
  if(!sources.length)return null;
  const primary=sources.includes('speed')?'speed':sources.includes('water')?'water':'fertilizer';
  const bonusPercent=Math.max(0,Math.round(Number(p.growth?.bonusPercent)||0));
  return {sources,primary,bonusPercent,mode:activeCount>=12&&zoom<1.25?'rim':'aura',showBadge:zoom>=1.25};
}

export function giftImpactText(gift) {
  if(gift.roulette)return `${gift.roulette.label} → ${gift.roulette.targetName}${gift.roulette.durationMs?` · ${gift.roulette.durationMs/1000}s`:''}`;
  const count=gift.affected??0,first=gift.effects?.[0],gain=first?Math.round((first.to-first.from)*100):0;
  if(gift.giftKind==='dew')return count ? `${gain>0?`+${gain}% tiến độ · `:''}Đất đã đủ nước` : 'Chưa có chậu để tưới';
  if(gift.giftKind==='star')return `${gain>0?`+${gain}% tiến độ`:'Cây đã chín hoặc chậu trống'}${gift.benefits?.fertilized?' · đã bón phân':''}`;
  if(gift.giftKind==='tree')return `${count} cây lớn · ${gift.benefits?.protected??0} chậu bảo vệ ${Math.ceil((gift.blessingMs??60000)/1000)}s`;
  return `${count?`${count} cây được nâng giai đoạn`:'Chưa có cây đang lớn'}${gift.benefits?.watered?` · tưới ${gift.benefits.watered} chậu`:''}${gift.benefits?.weeds?` · sạch ${gift.benefits.weeds} cỏ`:''}`;
}

export function focusCardPlacement(plant, card, vp) {
  const gap = 28, edge = 24;
  const right = plant.right + gap;
  const x = right + card.w <= vp.w - edge ? right : plant.left - gap - card.w;
  return { x: Math.max(edge, Math.min(vp.w - card.w - edge, x)),
    y: Math.max(340, Math.min(vp.h - card.h - 160, (plant.top + plant.bottom - card.h) / 2)),
    side: right + card.w <= vp.w - edge ? 'right' : 'left' };
}

export function careLabel(p) {
  if (!p.crop) return 'Gieo hạt';
  if (p.crop.pest) return 'Bắt sâu';
  if (p.crop.weeds) return 'Nhổ cỏ';
  if ((p.stage ?? 0) >= 3) return 'Hái ngay';
  if (p.water < .25) return 'Cần tưới';
  return `${Math.round(Math.min(1, Math.max(0, p.crop.progress ?? 0)) * 100)}% lớn`;
}

export function gardenGuide({ boss=false, awards=false, plots=[], event=null }={}) {
  const awake=plots.filter(p=>p?.owner&&p.awake!==false);
  if(boss)return ['Cứu vườn','thả tim','Đồng hồ vườn tạm dừng · tim và quà lớn chuyển sang đánh Sâu Chúa'];
  if(awards)return ['Vinh danh Top 5','sắp mở vườn','Giữ LV, XP và thành tựu · đợi phiên mới'];
  if(!awake.length)return ['Bắt đầu','trồng','Tự chọn giống cao nhất đủ LV + vàng · nhận chậu ngay trong một bình luận'];
  const pest=awake.filter(p=>p.crop?.pest).length,weeds=awake.filter(p=>p.crop?.weeds).length,ripe=awake.filter(p=>(p.stage??0)>=3).length,dry=awake.filter(p=>p.crop&&(p.water??1)<.25).length,empty=awake.filter(p=>!p.crop).length;
  if(event?.kind==='pests'&&event.phase==='active'&&pest)return ['Cứu đợt sâu','chăm',`${pest} cây đang có sâu · “chăm” tự ưu tiên bắt sâu trước`];
  if(ripe)return ['Đã có cây chín','hái',`${ripe} cây sẵn sàng · hái nhận vàng + XP rồi “trồng” vụ mới`];
  if(pest)return ['Ưu tiên cứu cây','chăm',`${pest} cây có sâu · “chăm” tự bắt sâu trước khi tưới`];
  if(weeds)return ['Dọn cỏ trước','chăm',`${weeds} cây có cỏ · “chăm” tự nhổ cỏ rồi mới tưới`];
  if(dry)return ['Đất đang khô','chăm',`${dry} cây cần nước · “chăm” tự chọn việc hữu ích mà không tốn vàng`];
  if(empty)return ['Chậu đang trống','trồng',`${empty} chậu sẵn sàng · tự chọn giống cao nhất đủ LV + vàng`];
  return ['Cùng chăm vườn','chăm','Tự bắt sâu → nhổ cỏ → tưới · người mới chỉ cần gõ “trồng”'];
}

export function impactMotion(tier, elapsed, reduced=false) {
  if(reduced)return {kind:'result',progress:1,shake:0};
  const quake=tier==='cataclysm',duration=quake?900:650,t=Math.max(0,Math.min(1,elapsed/duration));
  return {kind:quake?'quake':'meteor',progress:t,shake:quake?Math.sin(t*Math.PI*10)*(1-t)*8:0};
}

export function chooseIdleSlot(capacity, plots, pointOf) {
  const occupied=new Set(plots.filter(p=>p?.owner&&p.awake!==false).map(p=>Number(p.slot)).filter(Number.isInteger));
  const empty=Array.from({length:Math.max(0,Number(capacity)||0)},(_,slot)=>slot).filter(slot=>!occupied.has(slot));
  if(!empty.length)return null;
  if(!occupied.size||typeof pointOf!=='function')return empty[0];
  const pts=[...occupied].map(pointOf).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(!pts.length)return empty[0];
  const center={x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length};
  return empty.map(slot=>({slot,p:pointOf(slot)})).filter(x=>x.p).sort((a,b)=>((a.p.x-center.x)**2+(a.p.y-center.y)**2)-((b.p.x-center.x)**2+(b.p.y-center.y)**2)||a.slot-b.slot)[0]?.slot??empty[0];
}

export function displayNickname(nickname, zoom = 1) {
  const clean = String(nickname ?? '').trim();
  if (!clean) return 'Người xem';
  const max = zoom < .65 ? 6 : zoom < 1.25 ? 10 : 16;
  const chars = [...clean];
  if (chars.length <= max) return clean;
  return chars.slice(0, max).join('').trimEnd() + '…';
}

export function overviewLabelWidth(cfg, zoom) {
  const spacing = Math.max(0, Number(cfg?.potSpacingX) || 0) * Math.max(0, Number(zoom) || 0);
  return Math.max(48, Math.min(166, spacing - 6));
}

export function slotLayout(slot, cfg) {
  const logicalRow = Math.floor(slot / cfg.potsPerShelf);
  const wing = Math.floor(logicalRow / cfg.shelvesPerWing);
  const row = logicalRow % cfg.shelvesPerWing;
  const col = slot % cfg.potsPerShelf;
  const spanX = (cfg.potsPerShelf - 1) * cfg.potSpacingX;
  return { module: 0, moduleCol: 0, moduleRow: 0, logicalRow, wing, row, col,
    x: cfg.zoneMarginX + wing * (spanX + cfg.rackWingGapX) + col * cfg.potSpacingX,
    y: cfg.zoneMarginY + row * cfg.shelfSpacingY };
}

export function rackGeometry(cfg) {
  const spanX = (cfg.potsPerShelf - 1) * cfg.potSpacingX;
  const top = cfg.zoneMarginY - 132;
  const bottom = cfg.zoneMarginY + (cfg.shelvesPerWing - 1) * cfg.shelfSpacingY + 110;
  const wings = Array.from({ length: cfg.rackWings }, (_, wing) => {
    const firstX = cfg.zoneMarginX + wing * (spanX + cfg.rackWingGapX);
    return { index: wing, firstX, left: firstX - 50, right: firstX + spanX + 50, top, bottom };
  });
  return {
    spanX,
    wings,
    outer: { left: wings[0].left, right: wings.at(-1).right, top, bottom },
  };
}

export function plotPos(plot, { cfg }) {
  const p = slotLayout(plot.slot, cfg);
  return { x: p.x, y: p.y };
}

export function easeCamera(from, to, elapsedMs, easeMs = 600) {
  const t = Math.min(1, Math.max(0, elapsedMs / easeMs));
  if (t >= 1) return { ...to };
  const s = t * t * t * (t * (t * 6 - 15) + 10);
  return { x: from.x + (to.x - from.x) * s, y: from.y + (to.y - from.y) * s, zoom: from.zoom * (to.zoom / from.zoom) ** s };
}

export const worldToScreen = (p, cam, vp) => ({ x: (p.x - cam.x) * cam.zoom + vp.w / 2, y: (p.y - cam.y) * cam.zoom + vp.h / 2 });

export function visiblePlots(plots, cam, vp, meta, margin = 160, maxDetail = 120) {
  const owned = plots.filter(p => p.owner && p.awake !== false);
  if (lodOf(cam.zoom) === 'dot') return { detail: [], dots: owned };
  const hw = vp.w / 2 / cam.zoom + margin, hh = vp.h / 2 / cam.zoom + margin;
  const inside = [];
  for (const p of owned) {
    const pos = plotPos(p, meta), dx = pos.x - cam.x, dy = pos.y - cam.y;
    if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) inside.push({ p, d: dx * dx + dy * dy });
  }
  inside.sort((a, b) => (b.p.awake - a.p.awake) || (a.d - b.d));
  return { detail: inside.slice(0, maxDetail).map(x => x.p), dots: inside.slice(maxDetail).map(x => x.p) };
}

export function createAvatarCache(limit = 200, make = url => { const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; return img; }) {
  const map = new Map();
  return {
    get(url) {
      if (!url) return null;
      let img = map.get(url);
      if (img) map.delete(url);
      else { img = make(url); if (map.size >= limit) map.delete(map.keys().next().value); }
      map.set(url, img);
      return img.complete && img.naturalWidth > 0 ? img : null;
    },
  };
}
