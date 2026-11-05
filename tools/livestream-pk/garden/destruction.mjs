import {bump,isAwake} from './world.mjs';

export function strike(ctx,user,plot,tier){
 const now=ctx.now(),large=tier==='cataclysm';
 // The giver always receives a visible benefit, even when every rival has a shield.
 if(plot){
  plot.brokenUntil=0;plot.shieldUntil=plot.blessingUntil=now+ctx.cfg.treeBlessingMs;
  if(plot.crop){plot.crop.progress=1;plot.crop.ripeAt=now;}
  bump(ctx,plot);
 }
 if(ctx.state.boss?.phase==='active'){
  const damage=Math.ceil(ctx.state.boss.maxHp*(large?.6:.25));
  const hit=ctx.boss.hit({userId:user.userId,nickname:user.nickname,count:damage});
  if(hit?.boss)return {mode:'boss',damage:hit.damage,destroyed:[],label:large?'Đại địa chấn':'Thiên thạch',shieldMs:plot?ctx.cfg.treeBlessingMs:0};
 }
 const targets=Object.values(ctx.state.plots).filter(p=>p.owner&&p.owner!==user.userId&&p.crop&&isAwake(ctx,p)&&!(p.shieldUntil>now)&&!(p.blessingUntil>now));
 const destroyed=[];
 while(targets.length&&destroyed.length<(large?3:1)){
  const index=Math.min(targets.length-1,Math.floor(ctx.rng()*targets.length)),p=targets.splice(index,1)[0];
  destroyed.push({plotId:p.id,userId:p.owner,nickname:ctx.state.users[p.owner]?.nickname,crop:p.crop.type,progress:p.crop.progress});
  ctx.state.thefts=ctx.state.thefts.filter(t=>t.plotId!==p.id);
  p.crop=null;p.brokenUntil=now+ctx.cfg.brokenMs;p.replantCredit=true;p.waterBoostUntil=p.speedUntil=0;p.prank=null;bump(ctx,p);
 }
 return {mode:'garden',destroyed,label:large?'Đại địa chấn':'Thiên thạch',shieldMs:plot?ctx.cfg.treeBlessingMs:0,brokenMs:ctx.cfg.brokenMs};
}
