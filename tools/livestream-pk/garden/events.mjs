// Gameplay owns weather timing; a locked or absent camera must never stall it.
import { CROPS } from './crops.mjs';
import { addGold } from './progress.mjs';
import { bump, isAwake } from './world.mjs';

export const EVENT_TYPES=['rain','pests','merchant','golden'];
const DURATION={rain:'rainMs',pests:'pestStormMs',merchant:'merchantMs',golden:'goldenMs'};

export function modifiers(ctx){
  const e=ctx.state.event,cfg=ctx.cfg,active=e?.phase==='active';
  return {
    grow:active&&e.kind==='rain'?cfg.rainMult:1,
    gold:active&&e.kind==='golden'?cfg.goldenMult:1,
    boost:active&&e.kind==='merchant'?{crop:e.crop,mult:cfg.merchantMult}:null,
  };
}

export function createEvents(ctx){
  const {cfg,state}=ctx;
  const gap=()=>cfg.eventMinMs+ctx.rng()*(cfg.eventMaxMs-cfg.eventMinMs);
  let nextAt=ctx.now()+gap(),last=null;

  function queue(kind){
    const now=ctx.now();
    state.event={kind,phase:'pending',queuedAt:now,startedAt:null,endsAt:null};
    last=kind;
    ctx.emit({type:'event-start',kind,queuedAt:now});
    return activate(kind);
  }

  function activate(kind){
    const e=state.event;
    if(!e||e.phase!=='pending'||e.kind!==kind)return e;
    const now=ctx.now();
    e.phase='active';e.startedAt=now;e.endsAt=now+cfg[DURATION[kind]];
    if(kind==='rain')for(const p of Object.values(state.plots))if(p.crop&&isAwake(ctx,p)){p.water=1;bump(ctx,p);}
    if(kind==='merchant'){
      const present=[...new Set(Object.values(state.plots).filter(p=>p.crop&&isAwake(ctx,p)).map(p=>p.crop.type))];
      const crops=present.length?present:Object.keys(CROPS);
      e.crop=crops[Math.floor(ctx.rng()*crops.length)];
    }
    if(kind==='pests'){
      const sick=Object.values(state.plots).filter(p=>p.crop&&p.crop.progress<1&&isAwake(ctx,p)&&!(p.blessingUntil>now));
      for(let i=sick.length-1;i>0;i--){const j=Math.floor(ctx.rng()*(i+1));[sick[i],sick[j]]=[sick[j],sick[i]];}
      const hit=sick.slice(0,Math.max(1,Math.floor(sick.length*cfg.stormShare)));
      for(const p of hit){p.crop.pest=true;bump(ctx,p);}
      Object.assign(e,{total:hit.length,cleared:0,participants:{},targets:Object.fromEntries(hit.map(p=>[p.id,false]))});
    }
    ctx.emit({type:'event-active',kind,startedAt:e.startedAt,endsAt:e.endsAt,crop:e.crop??null,total:e.total??null});
    return e;
  }

  function end(){
    const e=state.event;
    if(!e)return;
    state.event=null;nextAt=ctx.now()+gap();
    let ok=true;
    if(e.phase==='active'&&e.kind==='pests'){
      ok=e.total>0&&e.cleared/e.total>=cfg.stormPass;
      if(ok)for(const id of Object.keys(e.participants))addGold(state.users[id],cfg.stormReward);
    }
    if(e.phase==='active')ctx.emit({type:'event-end',kind:e.kind,ok,cleared:e.cleared??0,total:e.total??0,reward:e.kind==='pests'&&ok?cfg.stormReward:0,participants:Object.keys(e.participants??{}).length});
  }

  return {
    tick(){
      const now=ctx.now();
      if(state.event){
        if(state.event.phase==='pending')activate(state.event.kind);
        if(state.event.phase==='active'&&now>=state.event.endsAt)end();
        return;
      }
      if(now<nextAt)return;
      const kinds=EVENT_TYPES.filter(k=>k!==last);
      queue(kinds[Math.floor(ctx.rng()*kinds.length)]);
    },
    force(kind){if(state.event)end();return queue(kind);},
    present(kind){return activate(kind);},
    reset(){state.event=null;nextAt=ctx.now()+gap();},
    current:()=>state.event,
    notePestCleared(userId,plotId){
      const e=state.event;
      if(e?.phase!=='active'||e.kind!=='pests'||ctx.now()>=e.endsAt||e.targets?.[plotId]!==false)return;
      e.targets[plotId]=true;
      e.cleared++;e.participants[userId]=true;
    },
  };
}
