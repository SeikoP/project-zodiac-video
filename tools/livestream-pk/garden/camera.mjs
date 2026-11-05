// Camera director: overview is home, raw activity becomes a short queue of readable presentation beats.
import { TIERS, plotCenter, tierCenter } from './world.mjs';

const WIDTH = 1080, VIEW_HEIGHT = 1560;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createCamera({ cfg, now, getPlots = () => [], isSecondaryReady=()=>true }) {
  const c = cfg.camera;
  let queue = [], current = null, locked = false, overviewReadyAt = 0;
  let foregroundUntil=now(),secondaryReadyAt=now()+c.idleMs,bossActive=false;

  const split = id => { const [tier, slot] = String(id).split(':'); return { tier, slot: Number(slot) }; };
  const plotAt = id => { const p = split(id); return { tier: p.tier, ...plotCenter(p.tier, p.slot, cfg) }; };

  function overviewTarget() {
    const spanX = (cfg.potsPerShelf - 1) * cfg.potSpacingX;
    const rackWidth = cfg.rackWings * spanX + (cfg.rackWings - 1) * cfg.rackWingGapX;
    const left = cfg.zoneMarginX - 76;
    const right = cfg.zoneMarginX + rackWidth + 76;
    const top = cfg.zoneMarginY - 132;
    const bottom = cfg.zoneMarginY + (cfg.shelvesPerWing - 1) * cfg.shelfSpacingY
      + 110;
    const width = right - left + 36, height = bottom - top + 24;
    const zoom = clamp(Math.min(WIDTH / width, VIEW_HEIGHT / height) * .98, c.zoomWorld, c.zoomTier);
    return { tier: TIERS[0].id, x: (left + right) / 2,
      y: (top + bottom) / 2 - 180 / zoom, zoom };
  }

  const base = e => ({ at: now(), type: e.type, plotId: e.plotId ?? null, nickname: e.nickname ?? null,
    ttl: e.type === 'gift' ? c.giftTtlMs : c.ttlMs, gift: e.type === 'gift',
    ...(e.type === 'gift' ? { total:e.total??0, affected:e.affected??0, effects:e.effects??[],benefits:e.benefits??{},blessingMs:e.blessingMs??0,roulette:e.roulette??null } : {}) });
  const closeTarget = id => {
    const p = plotAt(id);
    return { tier:p.tier, x:p.x + 170 / c.zoomClose, y:p.y - 20 / c.zoomClose, zoom:c.zoomClose };
  };

  function candidate(e) {
    const b = base(e);
    if(e.type==='session-end')return {...b,kind:'session',priority:-2,...overviewTarget(),stableMs:6000,travelMs:c.overviewEaseMs};
    if(e.type==='boss-start')return {...b,kind:'boss',priority:1,...overviewTarget(),stableMs:c.stableMinMs,travelMs:c.overviewEaseMs};
    if (e.type === 'event-start') return { ...b, kind:'event', priority:1, ...overviewTarget(), stableMs:c.eventHoldMs, travelMs:c.overviewEaseMs, eventKind:e.kind };
    if (e.type === 'event-active') {
      const plot = getPlots().find(p => p.crop && (e.kind === 'pests' ? p.crop.pest : e.kind === 'merchant' ? p.crop.type === e.crop : e.kind === 'golden' ? p.crop.progress >= 1 : p.crop.progress < 1));
      if (!plot) return null;
      return { ...b, kind:'event-focus', priority:1, plotId:plot.id, ...closeTarget(plot.id), eventKind:e.kind, ttl:e.endsAt == null ? c.ttlMs : Math.max(0,e.endsAt-now()), stableMs:c.levelHoldMs, travelMs:c.easeMs };
    }
    if (e.type === 'gift') {
      return {...b,kind:'gift',priority:0,...overviewTarget(),giftWide:true,stableMs:c.lowGiftHoldMs,travelMs:c.overviewEaseMs,giftKind:e.tier};
    }
    if (e.type === 'steal' || e.type === 'catch') {
      return { ...b, kind:e.type, priority:2, ...closeTarget(e.plotId), stableMs:c.stealHoldMs, travelMs:c.easeMs };
    }
    if (e.plotId && e.type==='levelup') {
      return { ...b, kind:e.type, priority:3, ...closeTarget(e.plotId), stableMs:c.levelHoldMs, travelMs:c.easeMs };
    }
    // Join is intentionally not a camera beat. The overlay pulses the new pot in overview.
    return null;
  }

  function trim() {
    const t = now();
    queue = queue.filter(q => t - q.at <= q.ttl);
    if (queue.length <= c.queueMax) return;
    queue.sort((a,b) => a.priority-b.priority || a.at-b.at);
    queue.length = c.queueMax;
  }

  function push(e) {
    if(e.type==='gift')foregroundUntil=Math.max(now(),foregroundUntil)+(e.impact?2800:e.roulette?3600:1800);
    if(e.type==='boss-start')bossActive=true;
    if(e.type==='boss-end'){bossActive=false;secondaryReadyAt=now()+c.idleMs;}
    if (e.type === 'event-end') {
      queue = queue.filter(q => q.eventKind !== e.kind);
      if (current?.eventKind === e.kind) current.until = now();
      return;
    }
    if(e.type==='session-end'){queue=[];if(current)current.until=now();}
    if(e.type==='boss-start'){queue=[];if(current)current.until=now();foregroundUntil=now();}
    if (locked) return;
    const cand = candidate(e);
    if (!cand) return;
    if(cand.gift&&current&&!current.gift&&current.kind!=='session')current.until=Math.min(current.until,now()+800);
    if (cand.kind !== 'gift' && queue.some(q => q.kind === cand.kind && q.plotId === cand.plotId)) return;
    if (cand.kind === 'gift' && !cand.roulette && cand.plotId) {
      const same = queue.find(q => q.kind === 'gift' && !q.roulette && q.plotId === cand.plotId && cand.at - q.at <= c.mergeMs);
      if (same) {
        const tiers=['dew','star','roulette','rain','meteor','cataclysm'],strongest=tiers.indexOf(same.giftKind)>tiers.indexOf(cand.giftKind)?same:cand;
        const effects=new Map(same.effects.map(e=>[e.plotId,e]));
        for(const e of cand.effects)effects.set(e.plotId,{...e,from:effects.get(e.plotId)?.from??e.from});
        const benefits=Object.fromEntries(['seeded','watered','fertilized','weeds','protected'].map(key=>[key,Math.max(same.benefits?.[key]??0,cand.benefits?.[key]??0)]));
        Object.assign(same,{...strongest,at:cand.at,total:same.total+cand.total,effects:[...effects.values()].slice(0,48),affected:effects.size,benefits,priority:Math.min(same.priority,cand.priority),stableMs:Math.max(same.stableMs,cand.stableMs),ttl:Math.max(same.ttl,cand.ttl)});
        return;
      }
    }
    queue.push(cand); trim();
  }

  function choose() {
    trim();
    if (!queue.length) return null;
    const eligible=queue.filter(q=>q.zoom!==c.zoomClose||(!bossActive&&isSecondaryReady()&&now()>=Math.max(secondaryReadyAt,foregroundUntil+c.idleMs)));
    if(!eligible.length)return null;
    const pool=eligible.some(q=>q.gift)?eligible.filter(q=>q.gift):eligible;
    const best = pool.reduce((a,b)=>b.priority<a.priority || (b.priority===a.priority && b.at<a.at) ? b : a);
    queue.splice(queue.indexOf(best),1);
    return best;
  }

  const overviewShot = () => ({ kind:'overview', priority:9, ...overviewTarget(), stableMs:Infinity, travelMs:c.overviewEaseMs, gift:false });

  function start(shot) {
    const t=now(), travelMs=Math.max(0,shot.travelMs ?? c.easeMs);
    const stableMs=shot.kind==='overview' ? Infinity : Math.max(shot.stableMs ?? c.holdMinMs,c.stableMinMs ?? c.holdMinMs);
    current={...shot,startedAt:t,stableAt:t+travelMs,until:stableMs===Infinity?Infinity:t+travelMs+stableMs};
    if(shot.kind!=='overview'&&shot.zoom!==c.zoomClose)secondaryReadyAt=Math.max(secondaryReadyAt,current.until+c.idleMs);
    const {at,ttl,gift,type,...out}=shot;
    return {...out,travelMs,stableMs,holdMs:stableMs===Infinity?Infinity:travelMs+stableMs,label:type??shot.kind,pending:queue.length};
  }

  return {
    push,
    setLock(on){locked=Boolean(on);if(locked)queue=[];},
    tick(){
      if(locked)return null;
      trim(); const t=now();
      if(current?.kind==='overview' && queue.length) {
        if(t<overviewReadyAt&&!queue.some(q=>q.gift||q.kind==='session'||q.kind==='boss'))return null;
        const next=choose();return next?start(next):null;
      }
      if(current && t<current.until) return null;
      if(current?.zoom===c.zoomClose&&!queue.some(q=>q.gift||q.kind==='session'||q.kind==='boss')){
        overviewReadyAt=t+c.overviewEaseMs+c.overviewHoldMs;
        return start(overviewShot());
      }
      const next=choose();
      if(next)return start(next);
      if(!current || current.kind!=='overview')return start(overviewShot());
      return null;
    },
    state:()=>({queue:queue.map(q=>({...q})),current:current&&{...current},locked,idleWaitMs:Math.max(0,secondaryReadyAt-now(),foregroundUntil+c.idleMs-now())}),
  };
}
