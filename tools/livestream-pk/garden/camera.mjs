// Camera director: overview is home, raw activity becomes a short queue of readable presentation beats.
import { TIERS, plotCenter, tierCenter } from './world.mjs';

const WIDTH = 1080, VIEW_HEIGHT = 1320;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createCamera({ cfg, now, getPlots = () => [] }) {
  const c = cfg.camera;
  let queue = [], current = null, locked = false, shown = [];

  const split = id => { const [tier, slot] = String(id).split(':'); return { tier, slot: Number(slot) }; };
  const plotAt = id => { const p = split(id); return { tier: p.tier, ...plotCenter(p.tier, p.slot, cfg) }; };

  function overviewTarget() {
    const active = getPlots().filter(p => p?.owner);
    if (!active.length) {
      const p = tierCenter(TIERS[0].id, cfg);
      return { tier: TIERS[0].id, x: p.x, y: p.y - 90 / c.zoomWorld, zoom: c.zoomWorld };
    }
    const pts = active.map(p => ({ p, ...plotCenter(p.tier, p.slot, cfg) }));
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    const width = Math.max(cfg.potSpacingX * 3.5, maxX - minX + cfg.potSpacingX * 2.5);
    const height = Math.max(cfg.shelfSpacingY * 2.6, maxY - minY + cfg.shelfSpacingY * 2.2);
    const zoom = clamp(Math.min(WIDTH / width, VIEW_HEIGHT / height) * .9, c.zoomWorld, c.zoomTier);
    return { tier: TIERS[0].id, x: (minX + maxX) / 2, y: (minY + maxY) / 2 - 80 / zoom, zoom };
  }

  const base = e => ({ at: now(), type: e.type, plotId: e.plotId ?? null, nickname: e.nickname ?? null,
    ttl: e.type === 'gift' ? c.giftTtlMs : c.ttlMs, gift: e.type === 'gift' });

  function candidate(e) {
    const b = base(e);
    if (e.type === 'event-start') return { ...b, kind:'event', priority:0, ...overviewTarget(), stableMs:c.eventHoldMs, travelMs:c.overviewEaseMs, eventKind:e.kind };
    if (e.type === 'gift') {
      if (!e.plotId) return { ...b, kind:'gift', priority:1, ...overviewTarget(), stableMs:c.giftHoldMs, travelMs:c.overviewEaseMs, giftKind:e.tier };
      const p = plotAt(e.plotId), big = e.tier === 'rain' || e.tier === 'tree';
      return { ...b, kind:'gift', priority:big ? 1 : 2, tier:p.tier, x:p.x, y:p.y, zoom:c.zoomClose,
        stableMs:big ? c.giftHoldMs : c.lowGiftHoldMs, travelMs:c.easeMs, giftKind:e.tier };
    }
    if (e.type === 'steal' || e.type === 'catch') {
      const a = plotAt(e.plotId), b2 = e.thiefPlotId ? plotAt(e.thiefPlotId) : a;
      const zoom = clamp(Math.min(WIDTH / (Math.abs(a.x-b2.x)+560), VIEW_HEIGHT / (Math.abs(a.y-b2.y)+560)), c.zoomTier, c.zoomClose);
      return { ...b, kind:e.type, priority:2, tier:a.tier, x:(a.x+b2.x)/2, y:(a.y+b2.y)/2, zoom, stableMs:c.stealHoldMs, travelMs:c.easeMs };
    }
    if (e.type === 'levelup' || (e.type === 'ripe' && (e.first || e.crop === 'nammay'))) {
      const p = plotAt(e.plotId);
      return { ...b, kind:e.type, priority:3, tier:p.tier, x:p.x, y:p.y, zoom:c.zoomClose, stableMs:c.levelHoldMs, travelMs:c.easeMs };
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
    if (locked) return;
    const cand = candidate(e);
    if (!cand) return;
    if (cand.kind === 'gift' && cand.plotId) {
      const same = queue.find(q => q.kind === 'gift' && q.plotId === cand.plotId && cand.at - q.at <= c.mergeMs);
      if (same) {
        Object.assign(same,{at:cand.at,priority:Math.min(same.priority,cand.priority),stableMs:Math.max(same.stableMs,cand.stableMs),giftKind:cand.giftKind,ttl:Math.max(same.ttl,cand.ttl)});
        return;
      }
    }
    queue.push(cand); trim();
  }

  function choose() {
    trim();
    if (!queue.length) return null;
    shown = shown.filter(s => now()-s.t <= c.quotaWindowMs);
    const gifts=shown.filter(s=>s.gift).length, nonGift=shown.filter(s=>!s.gift).length;
    const pool = gifts>=1 && nonGift<c.quotaMin && queue.some(q=>!q.gift) ? queue.filter(q=>!q.gift) : queue;
    const best = pool.reduce((a,b)=>b.priority<a.priority || (b.priority===a.priority && b.at<a.at) ? b : a);
    queue.splice(queue.indexOf(best),1);
    return best;
  }

  const overviewShot = () => ({ kind:'overview', priority:9, ...overviewTarget(), stableMs:Infinity, travelMs:c.overviewEaseMs, gift:false });

  function start(shot) {
    const t=now(), travelMs=Math.max(0,shot.travelMs ?? c.easeMs);
    const stableMs=shot.kind==='overview' ? Infinity : Math.max(shot.stableMs ?? c.holdMinMs,c.stableMinMs ?? c.holdMinMs);
    current={...shot,startedAt:t,stableAt:t+travelMs,until:stableMs===Infinity?Infinity:t+travelMs+stableMs};
    if(shot.kind!=='overview') shown.push({t,gift:shot.gift});
    const {at,ttl,gift,type,...out}=shot;
    return {...out,travelMs,stableMs,holdMs:stableMs===Infinity?Infinity:travelMs+stableMs,label:type??shot.kind,pending:queue.length};
  }

  return {
    push,
    setLock(on){locked=Boolean(on);if(locked)queue=[];},
    tick(){
      if(locked)return null;
      trim(); const t=now();
      if(current?.kind==='overview' && queue.length) return start(choose());
      if(current && t<current.until) return null;
      const next=choose();
      if(next)return start(next);
      if(!current || current.kind!=='overview')return start(overviewShot());
      return null;
    },
    state:()=>({queue:queue.map(q=>({...q})),current:current&&{...current},locked}),
  };
}
