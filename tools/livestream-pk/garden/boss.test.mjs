import test from 'node:test';
import assert from 'node:assert/strict';
import {createGarden} from './garden.mjs';

function rig(config={}){
 let time=1800000000000;const events=[];
 const g=createGarden({now:()=>time,rng:()=>.1,onEvent:e=>events.push(e),config:{bossChance:1,bossDelayMs:1000,bossDurationMs:60000,sleepAfterMs:1e9,evictAfterMs:1e9,pestChancePerSec:0,weedChancePerSec:0,...config}});
 const chat=(comment,id='a')=>g.chat({userId:id,nickname:id,comment});
 const p=id=>Object.values(g.state.plots).find(p=>p.owner===id);
 return{g,events,chat,p,step:ms=>{time+=ms;g.tick();}};
}
test('boss preserves ripeness, cooldowns and buffs including a gift received mid-fight',()=>{
 const k=rig({bossChance:0});k.chat('trồng');const p=k.p('a'),t=k.g.ctx.now();
 p.crop.progress=1;p.crop.ripeAt=t-100000;p.waterBoostUntil=t+30000;p.shieldUntil=t+30000;p.wateredAt=t;
 k.g.boss.force();k.step(40000);
 k.g.gift({userId:'a',diamonds:50,count:1});p.speedUntil=k.g.ctx.now()+45000;
 k.step(5000);k.g.like({userId:'a',count:10000});
 assert.equal(p.waterBoostUntil-k.g.ctx.now(),30000);assert.equal(p.speedUntil-k.g.ctx.now(),45000);
 assert.equal(k.g.ctx.now()-p.wateredAt,0);assert.equal(k.chat('hái').gold,10);
 const restored=createGarden({state:JSON.parse(JSON.stringify(k.g.state)),now:()=>k.g.ctx.now()});
 assert.equal(restored.state.plots[p.id].speedUntil,p.speedUntil);
});
test('boss rolls once per round, counts hearts once, and pays contributors once',()=>{
 const k=rig();k.chat('trồng rau');k.step(1);assert.equal(k.g.state.boss.phase,'waiting');
 k.step(1000);const b=k.g.state.boss;assert.equal(b.phase,'active');
 const before=k.g.state.users.a.xp;
 const hit=k.g.like({userId:'a',nickname:'a',count:20});assert.equal(hit.damage,20);assert.equal(b.hp,b.maxHp-20);
 assert.equal(k.g.state.hearts,null,'boss hits do not also fill normal heart milestones');
 k.g.like({userId:'a',nickname:'a',count:10000});assert.equal(b.phase,'won');
 assert.equal(k.g.state.users.a.xp,before+8);assert.equal(k.g.state.users.a.titles.bossSlayer,1);
 k.step(100);assert.equal(k.g.state.users.a.xp,before+8);
 assert.equal(k.events.filter(e=>e.type==='boss-end').length,1);
});
test('absent and expired bosses do not reroll or accept late damage; round reset clears the encounter',()=>{
 const k=rig({bossChance:0});k.chat('chào');k.step(2000);assert.equal(k.g.state.boss.phase,'none');
 k.g.ctx.rng=()=>0;k.step(2000);assert.equal(k.g.state.boss.phase,'none');
 const j=rig();j.chat('chào');j.step(1001);j.step(60001);assert.equal(j.g.state.boss.phase,'escaped');
 j.g.like({userId:'a',count:10});assert.equal(j.g.state.boss.hp,j.g.state.boss.maxHp);assert.equal(j.g.state.users.a.xp,0);
 j.g.competition.finish();j.step(8000);assert.equal(j.g.state.boss.roundNo,2);
});
test('high gifts attack the active boss instead of destroying rival crops',()=>{
 const k=rig();k.chat('trồng rau');k.chat('trồng rau','b');k.step(1001);
 const hp=k.g.state.boss.hp;
 const r=k.g.gift({userId:'a',diamonds:500,count:1});assert.equal(r.tier,'meteor');assert.equal(r.impact.mode,'boss');
 assert.ok(k.g.state.boss.hp<hp);assert.ok(k.p('b').crop);
});
test('meteor destruction respects shields, retains progression and allows a free repair after eight seconds',()=>{
 const k=rig({bossChance:0});k.chat('trồng rau');k.chat('trồng rau','b');k.chat('trồng rau','c');
 k.p('c').shieldUntil=Infinity;const victim=k.p('b'),u=k.g.state.users.b;u.level=5;u.xp=400;
 victim.crop.progress=.9;const gold=u.gold;
 k.g.state.thefts.push({plotId:victim.id,at:1800000000000});
 const r=k.g.gift({userId:'a',diamonds:1000,count:1});assert.equal(r.tier,'cataclysm');assert.equal(r.impact.destroyed.length,1);
 assert.equal(victim.crop,null);assert.ok(k.p('c').crop);assert.deepEqual([u.level,u.xp,u.gold],[5,400,gold]);
 assert.equal(k.g.state.thefts.length,0);
 const blocked=k.chat('trồng rau','b');assert.equal(blocked.reason,'broken');assert.ok(blocked.retryAfterMs>0);
 k.step(8001);assert.equal(k.chat('trồng rau','b').ok,true);assert.equal(u.gold,gold);assert.equal(victim.crop.progress,0);
});

test('boss HP survives a save and defeat rewards cannot repeat after restart',()=>{
 const k=rig();k.chat('trồng rau');k.step(1001);k.g.like({userId:'a',count:40});
 const state=JSON.parse(JSON.stringify(k.g.state));const before=state.users.a.xp;
 const g=createGarden({state,now:()=>1800000001001});assert.equal(g.state.boss.hp,g.state.boss.maxHp-40);
 for(const count of [-1,NaN,Infinity,1.5])assert.equal(g.like({userId:'a',count}).ok,false);
 assert.equal(g.state.boss.hp,g.state.boss.maxHp-40);
 g.like({userId:'a',count:10000});assert.equal(g.state.users.a.xp,before+8);
 const resumed=createGarden({state:JSON.parse(JSON.stringify(g.state)),now:()=>1800000001101});resumed.tick();
 assert.equal(resumed.state.users.a.xp,before+8);assert.equal(resumed.state.users.a.titles.bossSlayer,1);
});

test('boss freezes the round clock and growth, blocks farm commands, then resumes after a saved fight',()=>{
 const k=rig({sessionMs:10000,bossDurationMs:20000});k.chat('trồng');k.step(1001);
 const before=k.g.competition.status().session,p=k.p('a'),progress=p.crop.progress;
 assert.ok(before.pausedAt);assert.equal(k.chat('hái').reason,'boss-active');
 k.step(9000);assert.equal(k.g.state.session.phase,'active');assert.equal(p.crop.progress,progress);
 assert.equal(k.g.competition.finish().reason,'boss-active');
 const saved=JSON.parse(JSON.stringify(k.g.state));let time=1800000010001;
 const g=createGarden({state:saved,now:()=>time,config:{sessionMs:10000,bossDurationMs:20000}});
 const remaining=before.endsAt-before.pausedAt;g.like({userId:'a',count:10000});
 assert.equal(g.state.boss.phase,'won');assert.equal(g.state.session.pausedAt,undefined);
 assert.equal(g.competition.status().session.endsAt-time,remaining);
 time+=remaining-1;g.tick();assert.equal(g.state.session.phase,'active');
 time+=2;g.tick();assert.equal(g.state.session.phase,'awards');
});
