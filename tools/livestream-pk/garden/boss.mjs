import {addGold,addXp} from './progress.mjs';
import {bump,ensureUser,isAwake,touch} from './world.mjs';

export function createBoss(ctx){
 const {state,cfg}=ctx;
 function changed(){state.boss.revision=(state.boss.revision??0)+1;ctx.markDirty();}
 function finish(won){
  const b=state.boss;if(b?.phase!=='active')return;
  b.phase=won?'won':'escaped';b.endedAt=ctx.now();
  ctx.onBossEnd?.();
  if(won)for(const c of Object.values(b.contributors)){
   const u=ensureUser(ctx,c);addGold(u,cfg.bossRewardGold);const lv=addXp(u,cfg.bossRewardXp);
   u.titles??={};u.titles.bossSlayer=(u.titles.bossSlayer??0)+1;
   const p=u.seat&&state.plots[`${u.seat.tier}:${u.seat.slot}`];if(p)bump(ctx,p);
   if(lv.leveledUp)ctx.emit({type:'levelup',userId:u.userId,plotId:p?.id??null,level:u.level});
  }
  changed();ctx.emit({type:'boss-end',won,contributors:Object.keys(b.contributors).length,xp:won?cfg.bossRewardXp:0,gold:won?cfg.bossRewardGold:0});
 }
 function start(){
  const b=state.boss;if(b?.phase!=='waiting')return;
  const active=Object.values(state.plots).filter(p=>p.owner&&isAwake(ctx,p)).length;
  b.phase='active';b.maxHp=Math.max(300,Math.min(2000,active*40));b.hp=b.maxHp;b.endsAt=ctx.now()+cfg.bossDurationMs;
  ctx.onBossStart?.();changed();ctx.emit({type:'boss-start',maxHp:b.maxHp,endsAt:b.endsAt});
 }
 function tick(){
  const s=state.session;if(!s||s.phase==='awards')return;
  if(state.boss?.roundNo!==s.no){
   const enabled=ctx.rng()<cfg.bossChance;
   state.boss={roundNo:s.no,phase:enabled?'waiting':'none',startsAt:s.startedAt+cfg.bossDelayMs,hp:0,maxHp:0,contributors:{},revision:(state.boss?.revision??0)+1};ctx.markDirty();
  }
  const b=state.boss;
  if(b.phase==='waiting'&&ctx.now()>=b.startsAt&&ctx.now()<s.startedAt+cfg.sessionMs)start();
  if(b.phase==='active'&&ctx.now()>=b.endsAt)finish(false);
 }
 function hit(data){
  tick();const b=state.boss;
  if(b?.phase!=='active')return null;
  const count=Number(data?.count);if(!Number.isSafeInteger(count)||count<=0)return {ok:false,reason:'invalid-count'};
  const damage=Math.min(b.hp,count,10000);b.hp-=damage;
  if(data.userId){
   if(state.users[data.userId])touch(ctx,state.users[data.userId]);
   const c=b.contributors[data.userId]??={userId:data.userId,nickname:data.nickname??state.users[data.userId]?.nickname??'Người làm vườn',damage:0};c.damage+=damage;
  }
  changed();ctx.emit({type:'boss-hit',damage,nickname:data.nickname??null});
  if(b.hp===0)finish(true);
  return {ok:true,boss:true,damage,hp:b.hp};
 }
 return {tick,hit,reset(){state.boss=null;},force(){tick();if(!state.boss)return {ok:false,reason:'no-session'};if(state.boss.phase!=='active'){
  state.boss.phase='waiting';state.boss.contributors={};start();
 }return {ok:true,boss:state.boss};},status(){return state.boss??null;}};
}
