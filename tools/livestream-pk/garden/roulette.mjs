import { bump, isAwake } from './world.mjs';

export const WHEEL = Object.freeze([
  {kind:'speed',label:'Gió tăng tốc',self:true},
  {kind:'fertilizer',label:'Phân mây',self:true},
  {kind:'shield',label:'Khiên lá',self:true},
  {kind:'slow',label:'Mây lười',self:false},
  {kind:'dry',label:'Nắng tinh nghịch',self:false},
  {kind:'weeds',label:'Cỏ ghé chơi',self:false},
]);

export function spin(ctx,user,plot){
  const now=ctx.now();
  const rivals=Object.values(ctx.state.plots).filter(p=>p.owner&&p.owner!==user.userId&&p.crop?.progress<1&&isAwake(ctx,p)&&!(p.shieldUntil>now)&&!(p.blessingUntil>now)&&!p.prank);
  const targets=kind=>rivals.filter(p=>(kind!=='dry'||p.water>0)&&(kind!=='weeds'||!p.crop.weeds));
  const choices=WHEEL.filter(o=>o.self?Boolean(plot)&&(o.kind==='shield'||plot.crop?.progress<1)&&(o.kind!=='fertilizer'||!plot.crop.fertilized):targets(o.kind).length>0);
  // A full room still gets a temporary public blessing rather than an invisible gift.
  const outcome=choices[Math.min(choices.length-1,Math.floor(ctx.rng()*choices.length))]??WHEEL[2];
  const eligible=targets(outcome.kind);
  const target=outcome.self?plot:eligible[Math.min(eligible.length-1,Math.floor(ctx.rng()*eligible.length))];
  const durationMs=outcome.kind==='fertilizer'?0:outcome.kind==='shield'?60000:outcome.self?ctx.cfg.rouletteBuffMs:ctx.cfg.prankMs;
  const affected=target?[target]:Object.values(ctx.state.plots).filter(p=>p.owner&&isAwake(ctx,p));
  for(const p of affected){
    if(outcome.kind==='speed')p.speedUntil=now+durationMs;
    if(outcome.kind==='fertilizer')p.crop.fertilized=true;
    if(outcome.kind==='shield')p.shieldUntil=Math.max(p.shieldUntil??0,now+durationMs);
    if(!outcome.self){
      p.prank={kind:outcome.kind,until:now+durationMs,water:p.water,weeds:Boolean(p.crop.weeds)};
      if(outcome.kind==='dry')p.water=0;
      if(outcome.kind==='weeds')p.crop.weeds=true;
    }
    bump(ctx,p);
  }
  return {id:`${now}:${ctx.state.ver}`,index:WHEEL.indexOf(outcome),kind:outcome.kind,label:outcome.label,
    targetId:target?.owner??null,targetPlotId:target?.id??null,expiresAt:durationMs?now+durationMs:null,targetName:target?ctx.state.users[target.owner]?.nickname:'Cả vườn',durationMs,self:outcome.self};
}

export function expirePranks(ctx){
  for(const p of Object.values(ctx.state.plots))if(p.prank&&p.prank.until<=ctx.now()){
    if(p.crop){
      if(p.prank.kind==='dry')p.water=p.prank.water;
      if(p.prank.kind==='weeds')p.crop.weeds=p.prank.weeds;
    }
    p.prank=null;bump(ctx,p);
  }
}
