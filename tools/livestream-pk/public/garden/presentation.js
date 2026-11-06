export const SCENE_MS=Object.freeze({impact:2800,roulette:3600,gift:1800,profile:2500,compact:1200});
export function createPresentationQueue(now=()=>performance.now()){
 let pending=[],active=null,profileReadyAt=0,idleSince=now(),idleWindowMs=6000,notices=[];
 const seen=new Set();
 const remember=id=>{if(id)seen.add(id);while(seen.size>256)seen.delete(seen.values().next().value);};
 const compact=(p,reason)=>({...p,kind:'compact',reason,priority:4,entries:p.entries??[{id:p.id,nickname:p.nickname,total:p.total,roulette:p.roulette,impact:p.impact}]});
 const cost=()=>pending.reduce((n,p)=>n+(p.type==='gift'&&p.kind!=='compact'?SCENE_MS[p.kind]:0),0);
 function reduce(){
  while(cost()>12000){const i=pending.findIndex(p=>p.type==='gift'&&p.kind!=='compact');pending[i]=compact(pending[i],'scene-budget');}
  const short=pending.filter(p=>p.kind==='compact');
  if(short.length>1){pending=pending.filter(p=>p.kind!=='compact');pending.push({...short[0],entries:short.flatMap(p=>p.entries).slice(-64)});}
  pending=pending.slice(-64);
 }
 return {
  push(fx){
   const gift=fx.type==='gift';if(!gift&&fx.type!=='card')return;
   const identity=fx.eventId??fx.id;
   if(gift&&identity&&seen.has(identity))return;remember(identity);
   const kind=gift?(fx.impact?'impact':fx.roulette?'roulette':'gift'):'profile';
   if(!gift){if(active?.kind==='profile'&&active.userId===fx.userId&&now()<active.until)return;pending=pending.filter(p=>p.type!=='card');}
   if(gift){idleSince=now();if(active?.kind==='profile')active=null;}
   let item={...fx,sceneId:identity??null,kind,priority:kind==='impact'?0:kind==='roulette'?1:gift?2:5,queuedAt:now()};
   if(fx.compact||fx.roulette?.expiresAt&&fx.roulette.expiresAt<=Date.now())item=compact(item,fx.compact?'recovered':'expired');
   pending.push(item);reduce();
  },
  tick({blocked=false,boss=false,awards=false,idleMs=6000}={}){
   idleWindowMs=idleMs;
   if(boss||awards){
    if(active?.type==='gift')notices.push(compact(active,boss?'boss':'awards'));
    notices.push(...pending.filter(p=>p.type==='gift').map(p=>compact(p,boss?'boss':'awards')));
    notices=notices.slice(-64);pending=[];active=null;idleSince=now();return null;
   }
   if(blocked||(active&&active.kind!=='profile'&&now()<active.until)||pending.some(p=>p.type==='gift'))idleSince=now();
   pending=pending.filter(p=>p.type!=='card'||now()-p.queuedAt<=15000);
   if(blocked&&active?.kind==='profile')active=null;
   if(active&&now()<active.until)return active;
   if(active)idleSince=Math.max(idleSince,active.until);
   active=null;pending.sort((a,b)=>a.priority-b.priority||a.queuedAt-b.queuedAt);
   if(pending[0]?.kind==='profile'&&(blocked||now()<profileReadyAt||now()-idleSince<idleMs))return null;
   const next=pending.shift();active=next?{...next,sceneId:next.sceneId??next.id??`profile:${next.userId}:${next.queuedAt}`,startedAt:now(),until:now()+SCENE_MS[next.kind]}:null;
   if(next?.kind==='profile')profileReadyAt=now()+8000;
   return active;
  },
  drainNotices(){const out=notices;notices=[];return out;},
  checkpoint(wall=Date.now()){return {v:1,wall,active:active&&{...active,left:active.until-now(),elapsed:now()-active.startedAt},pending:pending.map(p=>({...p,age:now()-p.queuedAt})),seen:[...seen],idleAge:now()-idleSince,profileWait:profileReadyAt-now()};},
  restore(saved,wall=Date.now()){
   if(saved?.v!==1||!Number.isFinite(saved.wall)||wall-saved.wall<0||wall-saved.wall>120000||!Array.isArray(saved.pending)||saved.pending.length>64)return false;
   const dt=wall-saved.wall;
   pending=saved.pending.filter(p=>SCENE_MS[p.kind]).map(p=>({...p,queuedAt:now()-Math.max(0,p.age??0)-dt,restored:true}));
   const a=saved.active;
   active=a&&SCENE_MS[a.kind]&&a.left>dt?{...a,startedAt:now()-(a.elapsed??0)-dt,until:now()+a.left-dt,restored:true}:null;
   for(const id of (saved.seen??[]).slice(-256))remember(id);
   idleSince=now()-Math.max(0,saved.idleAge??0)-dt;profileReadyAt=now()+Math.max(0,(saved.profileWait??0)-dt);return true;
  },
  clear(){pending=[];active=null;notices=[];profileReadyAt=0;idleSince=now();seen.clear();},
  pending:()=>pending.length,
  snapshot(){
   const view=p=>({sceneId:p.sceneId??p.id,kind:p.kind,nickname:p.nickname,total:p.total,priority:p.priority,reason:p.reason,count:p.entries?.length??1,ageMs:Math.max(0,now()-p.queuedAt),effect:p.impact?{mode:p.impact.mode,label:p.impact.label,damage:p.impact.damage,destroyed:p.impact.destroyed?.length??0}:p.roulette?{label:p.roulette.label,target:p.roulette.targetName}:null});
   return {active:active&&{...view(active),phase:now()-active.startedAt>=2000?'result':'action',remainingMs:Math.max(0,active.until-now())},pending:pending.slice(0,8).map(view),pendingCount:pending.length,primaryBudgetMs:cost(),primary:pending.filter(p=>p.type==='gift').length,secondary:pending.filter(p=>p.type==='card').length,idleWaitMs:Math.max(0,idleWindowMs-(now()-idleSince),profileReadyAt-now())};
  },
 };
}
