// Vườn Mây: wires comments, gifts and time into the garden modules. The only place that knows how they fit together.
import { gardenConfig } from './config.mjs';
import { catchPests, clearWeeds, fertilize, growthInfo, harvest, plant, tickPlots, water } from './care.mjs';
import { createLimiter, parseCommand, resolveMention } from './commands.mjs';
import { COPY, describeAction } from './copy.mjs';
import { CROPS, stageOf } from './crops.mjs';
import { createEvents, modifiers } from './events.mjs';
import { applyGift } from './gifts.mjs';
import { applyHearts, heartStatus, tickHearts } from './hearts.mjs';
import { catchThief, dog, steal, tickSteal } from './steal.mjs';
import { createCompetition } from './competition.mjs';
import { bump, emptyGardenState, ensureUser, isAwake, managePresence, migrateSeedZone, TIERS, seat, touch } from './world.mjs';
import { createBoss } from './boss.mjs';
import { expirePranks } from './roulette.mjs';
import { LEVEL_XP, potTierOf } from './progress.mjs';

export function createGarden({ config = {}, now = Date.now, rng = Math.random, onEvent = () => {}, onStateChange = () => {}, state = emptyGardenState(now()) } = {}) {
  const ctx = { state, cfg: gardenConfig(config), now, rng, emit: e => onEvent(e), markDirty: onStateChange, limiter: createLimiter(now) };
  migrateSeedZone(ctx);
  const competition = createCompetition({ state, now, sessionMs:ctx.cfg.sessionMs, awardsMs:ctx.cfg.awardsMs,
    onFinish:completed=>{
      events.reset();
      for(const p of Object.values(state.plots))if(p.owner)bump(ctx,p);
      ctx.emit({type:'session-end',...completed,awardsUntil:state.session.awardsUntil,nextNo:completed.no+1});ctx.markDirty();
    },
    onStart:(completed,pending)=>{
      events.reset();boss.reset();state.thefts=[];state.hearts=null;state.lastTick=now();ctx.limiter=createLimiter(now);
      for(const u of Object.values(state.users))Object.assign(u,{seat:null,gold:ctx.cfg.startGold,deco:[],stats:{harvest:0,steal:0,caught:0},helped:{},stealLog:{},stolenLog:[],banUntil:0,dogNight:null,competition:{no:state.session.no,points:0,harvests:0,lastAt:0}});
      for(const p of Object.values(state.plots)){
        Object.assign(p,{owner:null,crop:null,water:1,sleeping:false,deco:[],dogUntil:0,shieldUntil:0,blessingUntil:0,waterBoostUntil:0,speedUntil:0,prank:null,wateredAt:null,brokenUntil:0,replantCredit:false});bump(ctx,p);
      }
      ctx.emit({type:'round-start',no:state.session.no,previous:completed.no});
      for(const g of pending)applyGift(ctx,ensureUser(ctx,g),g);
      ctx.markDirty();
    }
  });
  const boss=createBoss(ctx);ctx.boss=boss;
  ctx.mods = () => modifiers(ctx);
  const events = createEvents(ctx);
  function freezeFarm(){
    const paused=state.farmPausedAt??state.session?.pausedAt;
    if(paused==null)return;
    const delta=Math.max(0,now()-paused);if(!delta)return;
    const shift=(object,keys)=>{for(const key of keys)if(Number.isFinite(object?.[key])&&object[key]>0)object[key]+=delta;};
    for(const p of Object.values(state.plots))if(p.owner){
      shift(p,['lastActive','wateredAt','waterBoostUntil','speedUntil','brokenUntil','dogUntil','shieldUntil','blessingUntil']);
      shift(p.crop,['ripeAt']);shift(p.prank,['until']);bump(ctx,p);
    }
    for(const u of Object.values(state.users)){
      shift(u,['lastSeen','banUntil']);
      for(const key of Object.keys(u.helped??{}))u.helped[key]+=delta;
      for(const key of Object.keys(u.stealLog??{}))u.stealLog[key]=u.stealLog[key].map(t=>t+delta);
      if(u.stolenLog)u.stolenLog=u.stolenLog.map(t=>t+delta);
    }
    for(const t of state.thefts)shift(t,['at']);
    ctx.limiter.shift?.('steal',delta);
    state.farmPausedAt=now();state.lastTick=now();ctx.markDirty();
  }
  ctx.onBossStart=()=>{events.reset();competition.pause();state.farmPausedAt=now();};
  ctx.onBossEnd=()=>{
    freezeFarm();competition.resume();delete state.farmPausedAt;state.lastTick=now();
    ctx.markDirty();
  };
  if(state.boss?.phase==='active')competition.pause();
  ctx.onPestCleared = (id, plotId) => events.notePestCleared(id, plotId);

  function run(user, cmd) {
    const own=user.seat&&state.plots[`${user.seat.tier}:${user.seat.slot}`];
    if(cmd.cmd!=='card'&&own?.brokenUntil>now())return {ok:false,reason:'broken',retryAfterMs:own.brokenUntil-now()};
    if(cmd.cmd==='card'&&!ctx.limiter.allow(user.userId,'card',8000))return {ok:false,reason:'cooldown',retryAfterMs:ctx.limiter.remaining(user.userId,'card',8000)};
    if (cmd.cmd !== 'card' && !ctx.limiter.allow(user.userId, 'care', ctx.cfg.careGapMs)) return { ok: false, reason: 'cooldown', retryAfterMs:ctx.limiter.remaining(user.userId,'care',ctx.cfg.careGapMs) };
    const target = cmd.mention ? resolveMention(state, cmd.mention, user.userId) : null;
    if (cmd.mention && !target) return { ok: false, reason: 'no-target' }; // a name nobody (or two people) answers to is never guessed at
    let result, scoreAction = null;
    switch (cmd.cmd) {
      case 'plant': if(cmd.arg==='unknown')return {ok:false,reason:'unknown-crop'}; result = plant(ctx, user, cmd.arg); scoreAction = 'plant'; break;
      case 'care': {
        const person=target??user,p=person.seat&&state.plots[`${person.seat.tier}:${person.seat.slot}`];
        const resolved=p?.crop?.pest?'pest':p?.crop?.weeds?'weed':'water';
        result=resolved==='pest'?catchPests(ctx,user,person):resolved==='weed'?clearWeeds(ctx,user,person):water(ctx,user,person);
        result.resolvedAction=resolved;scoreAction=resolved==='pest'?'pest':target&&target!==user?'help':resolved==='weed'?'help':'water';break;
      }
      case 'water': result = water(ctx, user, target ?? user); scoreAction = target && target !== user ? 'help' : 'water'; break;
      case 'pest': result = catchPests(ctx, user, target); scoreAction = 'pest'; break;
      case 'weed': result = clearWeeds(ctx, user, target ?? user); scoreAction = 'help'; break;
      case 'fertilize': result = fertilize(ctx, user); scoreAction = 'water'; break;
      case 'harvest': result = harvest(ctx, user); scoreAction = 'harvest'; break;
      case 'steal': result = steal(ctx, user, target); break;
      case 'catch': result = catchThief(ctx, user); scoreAction = 'catch'; break;
      case 'dog': result = dog(ctx, user); scoreAction = 'protect'; break;
      case 'card':
        ctx.emit({ type: 'card', plotId:user.seat?`${user.seat.tier}:${user.seat.slot}`:null, userId: user.userId, nickname: user.nickname, level: user.level, xp: user.xp, gold: user.gold, stats: user.stats, competition: competition.profile(user) });
        return { ok: true };
      default: return { ok: false, reason: 'unknown-command' };
    }
    if (result?.ok && scoreAction) {
      const award = competition.score(user, scoreAction);
      if (award?.titles.length) ctx.emit({ type: 'title', userId: user.userId, nickname: user.nickname, titles: award.titles, points: award.total });
    }
    return result;
  }

  function feedback(user,cmd,result) {
    const message=describeAction(ctx,user,cmd,result),plotId=user.seat?`${user.seat.tier}:${user.seat.slot}`:null;
    if(!(cmd.cmd==='card'&&result.ok)&&ctx.limiter.allow(user.userId,result.ok?'feedback-ok':'feedback-fail',result.ok?1000:800))
      ctx.emit({type:'action-feedback',userId:user.userId,nickname:user.nickname,plotId,action:result.resolvedAction??cmd.cmd,ok:result.ok,reason:result.reason??null,retryAfterMs:result.retryAfterMs??0,message});
    return {...result,message};
  }

  function chat(u) {
    freezeFarm();
    boss.tick();
    competition.tick();
    if(state.boss?.phase==='active'){
      const user=state.users[u.userId];if(user)touch(ctx,user);
      return {ok:false,reason:'boss-active',message:'Vườn và đồng hồ phiên đang tạm dừng · thả tim để đánh Sâu Chúa!'};
    }
    if(state.session?.phase==='awards'){
      const retryAfterMs=Math.max(0,state.session.awardsUntil-now());
      return {ok:false,reason:'awards',retryAfterMs,message:`Đang trao giải · phiên mới sau ${Math.ceil(retryAfterMs/1000)} giây. Giữ nguyên LV và XP.`};
    }
    const cmd = parseCommand(u.comment);
    let user = state.users[u.userId];
    const fresh = !user;
    let joined = false;
    user ??= ensureUser(ctx, u);
    if (!user.seat) {
      const plot = seat(ctx, user);
      if (!plot) { if (fresh) delete state.users[u.userId]; return feedback(user,cmd??{cmd:'chat'},{ok:false,reason:'no-room'}); }
      joined = true;
      ctx.emit({ type: 'joined', userId: user.userId, plotId: plot.id });
      const award = competition.score(user, 'join');
      if (award?.titles.length) ctx.emit({ type: 'title', userId: user.userId, nickname: user.nickname, titles: award.titles, points: award.total });
    }
    touch(ctx, user);
    const result=cmd?feedback(user,cmd,run(user,cmd)):{ok:true};
    return { ...result, action: cmd?.cmd ?? 'chat', joined, plotId: user.seat && `${user.seat.tier}:${user.seat.slot}`, competition: competition.profile(user) };
  }

  function expire() {
    const t = now();
    for (const p of Object.values(state.plots)) {
      for(const key of ['waterBoostUntil','speedUntil','brokenUntil'])if(p[key]&&p[key]<=t){p[key]=0;bump(ctx,p);}
      if (p.dogUntil && p.dogUntil <= t) { p.dogUntil = 0; bump(ctx, p); }
      if (p.shieldUntil && p.shieldUntil <= t) { p.shieldUntil = 0; bump(ctx, p); }
    }
  }

  const view = p => {
    const o = p.owner && state.users[p.owner];
    return { id: p.id, tier: p.tier, slot: p.slot, owner: o && { userId: o.userId, nickname: o.nickname, avatar: o.avatar, level: o.level, gold:o.gold, xp:o.xp, competition:competition.profile(o) },
      potTier: o ? potTierOf(o.level).id : null,
      growth:growthInfo(ctx,p),prank:p.prank??null,brokenUntil:p.brokenUntil??0,replantCredit:Boolean(p.replantCredit),
      stage: p.crop ? stageOf(p.crop, now(), ctx.cfg) : null,
      crop: p.crop && { type: p.crop.type, progress: p.crop.progress, pest: Boolean(p.crop.pest), weeds: Boolean(p.crop.weeds), fertilized: Boolean(p.crop.fertilized), stolen: p.crop.stolen, variant: p.crop.variant ?? 'common' },
      lastActive:p.lastActive, blessingUntil:p.blessingUntil??0, water: p.water, dog: p.dogUntil > now(), shield: p.shieldUntil > now(), deco: p.deco, awake: Boolean(o) && isAwake(ctx, p) };
  };

  return {
    state, cfg: ctx.cfg, events, competition, boss,
    chat,
    gift: g => {
      freezeFarm();boss.tick();
      competition.tick();
      if(state.session?.phase==='awards'){
        (state.session.pendingGifts??=[]).push({...g});ctx.markDirty();return {queued:true,reason:'awards'};
      }
      return applyGift(ctx,ensureUser(ctx,g),g);
    },
    like: data => { freezeFarm();if(state.session?.phase==='awards')return {ok:false,reason:'awards'}; const result = boss.hit(data)??applyHearts(ctx, data); if (result.ok) ctx.markDirty(); return result; }, social() {}, member() {},
    tick() { freezeFarm();boss.tick(); competition.tick(); if(state.session?.phase==='awards')return; boss.tick(); if(state.boss?.phase==='active'){state.lastTick=now();return;} expirePranks(ctx); managePresence(ctx); tickPlots(ctx); tickHearts(ctx); tickSteal(ctx); events.tick(); expire(); },
    changes(seen) {
      const parts = {}, plots = {};
      for (const p of Object.values(state.plots)) if (p.ver > (seen.ver ?? 0)) plots[p.id] = view(p);
      seen.ver = state.ver;
      if (Object.keys(plots).length) parts.plots = plots;
      const ev = JSON.stringify(state.event);
      if (ev !== seen.event) { seen.event = ev; parts.event = state.event; }
      const heart = heartStatus(state);
      if (seen.hearts !== heart.revision) { seen.hearts = heart.revision; parts.hearts = heart; }
      const bossKey=JSON.stringify([state.boss?.roundNo,state.boss?.revision]);
      if(seen.boss!==bossKey){seen.boss=bossKey;parts.boss=boss.status();}
      const revision = competition.revision();
      if (revision !== seen.competition) { seen.competition = revision; parts.competition = competition.status(); }
      return parts;
    },
    meta: () => ({ tiers: TIERS, copy: COPY, crops: CROPS, levelXp: LEVEL_XP, cfg: {
      tierWidth: ctx.cfg.tierWidth, tierHeight: ctx.cfg.tierHeight, plotsPerTier: ctx.cfg.plotsPerTier, plotsPerRow: ctx.cfg.plotsPerRow,
      plotCell: ctx.cfg.plotCell, activeCapacity: ctx.cfg.activeCapacity, modulesPerRow: ctx.cfg.modulesPerRow, moduleCapacity: ctx.cfg.moduleCapacity,
      potsPerShelf: ctx.cfg.potsPerShelf, shelvesPerModule: ctx.cfg.shelvesPerModule, rackWings: ctx.cfg.rackWings, shelvesPerWing: ctx.cfg.shelvesPerWing,
      rackWingGapX: ctx.cfg.rackWingGapX, potSpacingX: ctx.cfg.potSpacingX, shelfSpacingY: ctx.cfg.shelfSpacingY,
      moduleGapX: ctx.cfg.moduleGapX, moduleGapY: ctx.cfg.moduleGapY, zoneMarginX: ctx.cfg.zoneMarginX, zoneMarginY: ctx.cfg.zoneMarginY,
      potScale: ctx.cfg.potScale, potBottomOffset: ctx.cfg.potBottomOffset, potShelfGap: ctx.cfg.potShelfGap,
      tierMarginX: ctx.cfg.tierMarginX, tierMarginY: ctx.cfg.tierMarginY, camera: ctx.cfg.camera,
      bossChance:ctx.cfg.bossChance,bossDelayMs:ctx.cfg.bossDelayMs,bossDurationMs:ctx.cfg.bossDurationMs,sessionMs:ctx.cfg.sessionMs, graceMs: ctx.cfg.graceMs, sleepAfterMs: ctx.cfg.sleepAfterMs, evictAfterMs: ctx.cfg.evictAfterMs,
      rainMs: ctx.cfg.rainMs, rainMult: ctx.cfg.rainMult, pestStormMs: ctx.cfg.pestStormMs, stormPass: ctx.cfg.stormPass, stormReward: ctx.cfg.stormReward,
      merchantMs: ctx.cfg.merchantMs, merchantMult: ctx.cfg.merchantMult, goldenMs: ctx.cfg.goldenMs, goldenMult: ctx.cfg.goldenMult,
    } }),
    ctx,
  };
}
