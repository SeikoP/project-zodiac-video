import test from 'node:test';
import assert from 'node:assert/strict';
import {createGarden} from './garden.mjs';
import {createPresentationQueue} from '../public/garden/presentation.js';
import {POT_ART,avatarSource} from '../public/garden/identity.js';
import {plotMotion,shouldReplaceNotice} from '../public/garden/view.js';

test('routine feedback cannot overwrite an achievement before its reading window ends',()=>{
 assert.equal(shouldReplaceNotice('hero',3000,'normal'),false);
 assert.equal(shouldReplaceNotice('important',3000,'normal'),false);
 assert.equal(shouldReplaceNotice('hero',3000,'important'),true);
 assert.equal(shouldReplaceNotice('hero',0,'normal'),true);
});

test('pot tiers have five distinct silhouettes; avatars reject unsafe schemes and fall back cleanly',()=>{
 assert.equal(new Set(Object.values(POT_ART).map(p=>p.body)).size,5);
 assert.equal(avatarSource('/garden/assets/avatar-1.svg'),'/garden/assets/avatar-1.svg');
 assert.equal(avatarSource('https://example.com/a.jpg'),'https://example.com/a.jpg');
 for(const input of ['javascript:alert(1)','data:text/html,a','file:///secret','https://u:p@example.com/a',null,'//example.com/a'])assert.equal(avatarSource(input),'');
});

test('plant motion settles and reduced motion skips every transient deformation',()=>{
 assert.ok(plotMotion('plant',0).scale<1);assert.equal(plotMotion('plant',900).scale,1);
 for(const kind of ['plant','levelup','water','fertilize','pest-cleared','weed-cleared','impact'])assert.deepEqual(plotMotion(kind,200,true),{scale:1,tilt:0,pulse:0});
 assert.ok(Math.abs(plotMotion('impact',80).tilt)>0);
 assert.ok(plotMotion('fertilize',300).scale>1,'fertilizer visibly lifts the crop');
 assert.ok(Math.abs(plotMotion('pest-cleared',120).tilt)>0,'clearing pests gives the crop a recovery wiggle');
 assert.ok(Math.abs(plotMotion('weed-cleared',120).tilt)>0,'clearing weeds gives the crop a recovery wiggle');
});

test('Top 5 snapshots preserve avatars while only Top 3 receive the existing XP rewards',()=>{
 let time=1800000000000;const g=createGarden({now:()=>time,config:{bossChance:0}});
 for(let i=0;i<6;i++)g.chat({userId:`u${i}`,nickname:`Người ${i}`,avatar:`/garden/assets/avatar-${i%6+1}.svg`,comment:'trồng'});
 const completed=g.competition.finish();assert.equal(completed.standings.length,5);assert.equal(completed.podium.length,3);
 assert.deepEqual(completed.podium.map(p=>p.rewardXp),[15,10,5]);
 assert.ok(completed.standings.every(p=>p.avatar&&p.level));
 const avatar=completed.standings[0].avatar;g.state.users.u0.avatar='';
 time+=8000;g.tick();assert.equal(g.state.session.previous.standings[0].avatar,avatar);
});

test('lifetime harvest and help achievements are earned once and survive new sessions',()=>{
 const g=createGarden({config:{bossChance:0}});g.chat({userId:'a',nickname:'An',comment:'trồng'});
 const u=g.state.users.a;u.career.harvests=9;g.competition.score(u,'harvest');
 assert.equal(u.titles.harvest10,1);g.competition.score(u,'harvest');assert.equal(u.titles.harvest10,1);
 u.career.helps=19;g.competition.score(u,'help');assert.equal(u.titles.helpful20,1);
 assert.equal(JSON.parse(JSON.stringify(g.state)).users.a.career.harvests,11);
});

test('presentation diagnostics expose the real active scene, queued work and quiet-window reason',()=>{
 let time=0;const q=createPresentationQueue(()=>time);q.push({type:'gift',id:'g',nickname:'An',roulette:{}});
 q.push({type:'card',userId:'a',nickname:'An'});q.tick();
 let d=q.snapshot();assert.equal(d.active.kind,'roulette');assert.equal(d.pending.length,1);
 time=3600;q.tick();d=q.snapshot();assert.equal(d.active,null);assert.equal(d.idleWaitMs,6000);
 time=9600;q.tick();assert.equal(q.snapshot().active.kind,'profile');
});

test('diagnostics bound queue details without hiding the actual backlog or mutating it',()=>{
 const q=createPresentationQueue(()=>0);for(let i=0;i<30;i++)q.push({type:'gift',id:String(i),nickname:'An'});
 const d=q.snapshot();assert.ok(d.primaryBudgetMs<=12000);assert.ok(d.pending.length<=8);assert.equal(d.pending.reduce((n,p)=>n+p.count,0),30);
 d.pending[0].nickname='Changed';assert.equal(q.snapshot().pending[0].nickname,'An');
 const custom=createPresentationQueue(()=>0);custom.tick({idleMs:5000});assert.equal(custom.snapshot().idleWaitMs,5000);
});
test('extended career milestones award once without changing gold or XP',()=>{
 const g=createGarden({config:{bossChance:0}});g.chat({userId:'milestone',comment:'trồng'});
 const u=g.state.users.milestone;Object.assign(u.career,{harvests:99,helps:49,pests:49});const before=[u.gold,u.xp];
 g.competition.score(u,'harvest');g.competition.score(u,'help');g.competition.score(u,'pest');g.competition.score(u,'harvest');
 assert.equal(u.titles.harvest100,1);assert.equal(u.titles.helpful50,1);assert.equal(u.titles.pestKeeper50,1);assert.deepEqual([u.gold,u.xp],before);
});
