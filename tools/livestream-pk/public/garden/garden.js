// Vườn Mây: the channel's paper-doodle style drawn directly on the canvas; no generated image assets.
import {createPresentationQueue} from './presentation.js';
import {POT_ART,createViewerAvatar,avatarSource,earnedPattern} from './identity.js';
import { createMusic } from '../music.js';
import {createGardenAudio} from './audio.js';
import { createSfx } from '../sfx.js';
import { cameraReason, careLabel, displayNickname, easeCamera, feedbackCommand, focusCardPlacement, giftImpactText, lodOf, noticeTimeLeft, overviewLabelWidth, plotPos, plotProblem, problemPresentation, rackGeometry, visiblePlots, worldToScreen,plotMotion,shouldReplaceNotice } from './view.js';

const VP = { w: 1080, h: 1920 };
const canvas = document.getElementById('world'), ctx = canvas.getContext('2d');
const stage = document.getElementById('stage'), feed = document.getElementById('feed'), hint = document.getElementById('hint');
const eventHero = document.getElementById('eventHero'), eventArt = document.getElementById('eventArt'), eventHeroTitle = document.getElementById('eventHeroTitle'), eventHeroHint = document.getElementById('eventHeroHint'), eventHeroMeta = document.getElementById('eventHeroMeta'), eventMeterFill = document.getElementById('eventMeterFill');
const heartKind = document.getElementById('heartKind'), heartCount = document.getElementById('heartCount'), heartFill = document.getElementById('heartFill');
const zoneCount = document.getElementById('zoneCount');
const eventTicker = document.getElementById('eventTicker');
const guideStep=document.getElementById('guideStep'),guideCommand=document.getElementById('guideCommand'),guideText=document.getElementById('guideText');
const giftHero = document.getElementById('giftHero'), giftArt = document.getElementById('giftArt'), giftSender = document.getElementById('giftSender'), giftTitle = document.getElementById('giftTitle'), giftImpact = document.getElementById('giftImpact');
let giftPresentation = null;
const presentation=createPresentationQueue();let lastPresentation=null,bossState=null,heartState=null;
const bossArena=document.getElementById('bossArena'),bossFill=document.getElementById('bossFill'),bossHp=document.getElementById('bossHp'),bossClock=document.getElementById('bossClock'),bossLeaders=document.getElementById('bossLeaders'),bossInstruction=document.getElementById('bossInstruction'),bossKicker=document.getElementById('bossKicker'),bossDamage=document.getElementById('bossDamage');
const impactStage=document.getElementById('impactStage'),impactSender=document.getElementById('impactSender'),impactTitle=document.getElementById('impactTitle'),impactResult=document.getElementById('impactResult'),impactTargets=document.getElementById('impactTargets'),impactHint=document.getElementById('impactHint');
const audienceCount = document.getElementById('audienceCount'), eventLabel = document.getElementById('eventLabel'), sessionLabel = document.getElementById('sessionLabel'), leaders = document.getElementById('leaders');
const focusCard = document.getElementById('focusCard'), focusName = document.getElementById('focusName'), focusStatus = document.getElementById('focusStatus'), focusAction = document.getElementById('focusAction'), focusKicker = document.getElementById('focusKicker');
const focusStats=document.getElementById('focusStats');
const problems=new Map(),commandFeedback=new Map();
const harvestGhosts=new Map();
const plotMotions=new Map(),potPaths=Object.fromEntries(Object.entries(POT_ART).map(([id,art])=>[id,new Path2D(art.body)]));
const animatePlot=(id,kind)=>{if(id&&!reduceMotion)plotMotions.set(id,{kind,at:performance.now()});};
let sessionInfo=null,lastGuide=-1,lastSessionClock='';
let shotReason='';
const awards=document.getElementById('awards'),podium=document.getElementById('podium'),awardTitle=document.getElementById('awardTitle'),awardCountdown=document.getElementById('awardCountdown');
const wheelPanel=document.getElementById('roulette'),wheel=document.getElementById('wheel'),wheelResult=document.getElementById('wheelResult'),wheelHint=document.getElementById('wheelHint'),wheelSender=document.getElementById('wheelSender');
const growthRate=document.getElementById('growthRate'),growthLabel=document.getElementById('growthLabel'),growthFill=document.getElementById('growthFill'),growthSources=document.getElementById('growthSources'),focusLevel=document.getElementById('focusLevel'),xpFill=document.getElementById('xpFill');
let wheelPresentation=null,awardNo=null;
['Gió +30%','Phân mây','Khiên lá','Mây −25%','Nắng khô','Cỏ ghé chơi'].forEach((text,i)=>{
  const label=document.createElement('span');label.textContent=text;label.style.setProperty('--angle',`${i*60+30}deg`);wheel.append(label);
});
const GUIDES=[
  ['Bắt đầu','trồng','Tự chọn theo LV + vàng · rau LV1 · hoa LV2 · nấm LV4'],
  ['Một lệnh chăm cây','chăm','Tự dọn sâu → nhổ cỏ → tưới · không mất vàng'],
  ['Khi cây chín','hái','Nhận vàng + XP · gieo vụ mới để leo hạng'],
  ['Giúp bạn','tưới @tên','Ghi rõ tên trên chậu · cả hai có XP'],
  ['Cứu sâu','bắt sâu','Trong bão, cây mình sạch thì tự giúp hàng xóm'],
  ['Xem thông tin','vườn','Thông tin gọn ở dòng thông báo · hồ sơ đầy đủ khi zoom'],
  ['Giữ chậu','bình luận','Im 90s: chậu nghỉ · im 3 phút: nhường chỗ'],
  ['Đua phiên','10 phút','Trao giải 8s · vườn mới giữ LV, XP và huy hiệu'],
  ['Vòng quay quà','50–99 xu','Lợi cho mình hoặc trêu hàng xóm 20s · khiên chặn được'],
  ['Sâu Chúa','thả tim','35% phiên có boss · 1 tim = 1 sát thương'],
  ['Quà kỹ năng','thiên thạch','500 xu phá 1 cây · 1.000 xu phá tối đa 3 cây'],
  ['Tăng tốc thật','tưới +25%','30s tăng tốc · bón phân +18% đến khi hái'],
  ['Quà có vai trò riêng','tưới · bón · bảo vệ','Sương tưới · sao bón · mưa dọn cỏ · quà lớn phá cây'],
];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const displayRole=params.get('display')==='preview'||parent!==window?'preview':'live';
const checkpointKey=`garden-presentation:${location.host}:${displayRole}`;
let savedCheckpoint=null,checkpointLoaded=false,clientId;
try{clientId=sessionStorage.getItem('garden-client')||crypto.randomUUID();sessionStorage.setItem('garden-client',clientId);savedCheckpoint=JSON.parse(sessionStorage.getItem(checkpointKey)||'null');}catch{clientId=crypto.randomUUID();}
let lastDisplayPost=0;

const volume = (key, fallback) => { if(displayRole==='preview')return 0; const n = Number(params.get(key)); return params.has(key) && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback; };
const music=createMusic({volume:volume('music',.16)}),playSfx=createSfx(volume('sfx',.2),{manifestUrl:'/garden/audio/manifest.json'});
const gardenAudio=createGardenAudio({music,sfx:playSfx});
gardenAudio.setLevels({music:volume('music',.16),care:volume('sfx',.2),event:volume('sfx',.25)});
if(displayRole==='preview'||volume('sfx',.2)===0)gardenAudio.mute(true);
let soundSeq=0;
const legacyCues={sparkle:'plant',cleared:'harvest',cardFlip:'theft',boon:'fertilize',milestone:'levelUp',title:'achievement',bossStart:'bossIntro',bossHit:'bossGiftHit',fall:'bossEscape',firework:'rain',actClose:'roundEnd',actOpen:'rainStart',chestOpen:'merchantStart',lucky:'goldenStart'};
const sfx=(name,arg,options={})=>gardenAudio.cue({role:legacyCues[name]??name,eventId:options.eventId??`local:${++soundSeq}`,phase:options.phase??'action'});
// No visible audio control: LIVE/OBS attempts playback automatically. A normal browser that
// blocks autoplay unlocks on the first interaction anywhere, without adding overlay chrome.
const unlockAudio=()=>{music.resume();gardenAudio.warmup().catch(()=>{});};
addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
addEventListener('keydown', unlockAudio, { once: true, capture: true });
const fit = () => {
  const scale = Math.min(innerWidth / VP.w, innerHeight / VP.h);
  stage.style.transform = `scale(${scale})`;
  stage.style.left = `${(innerWidth - VP.w * scale) / 2}px`;
  stage.style.top = `${(innerHeight - VP.h * scale) / 2}px`;
};
addEventListener('resize', fit); fit();

let meta = null, focusPlot = null, focusAt = 0, focusMs = 0;
const plots = new Map(), floaters = [];
let cam = { x: 1350, y: 480, zoom: .38 }, from = cam, to = cam, shotAt = 0, cameraEaseMs = 1800, serverEvent = null, presentedEventKind = null;
const visualEvent = () => serverEvent?.phase === 'active' && presentedEventKind === serverEvent.kind ? serverEvent : null;
const C = { paper: '#F6F0E6', card: '#FFFDF9', ink: '#2F3C44', softInk: '#5C6B75', hair: '#4B5B61', skin: '#F1C6A0', shadow: '#D0C1B3', teal: '#8EC0B9', coral: '#E97A66', ochre: '#F2C45C', slate: '#435064' };
const SEED_SCENE = { rail:'#B8D6C4', trim:'#8EC0B9', flag:'#EBC49E' };
const eventNames = { rain: 'Mưa tưới', pests: 'Đợt sâu bệnh', merchant: 'Chợ phiên', golden: 'Giờ vàng' };
const EVENT_ART = {
  rain: '/garden/assets/event-rain.svg',
  pests: '/garden/assets/event-pests.svg',
  merchant: '/garden/assets/event-merchant.svg',
  golden: '/garden/assets/event-golden.svg',
};
const DECOR_ART = [
  '/garden/assets/decor-watering-can.svg',
  '/garden/assets/decor-birdhouse.svg',
  '/garden/assets/decor-windchime.svg',
  '/garden/assets/decor-lantern.svg',
];
const CROP_ART = {
  rau: { common: '/garden/assets/crop-rau.svg', lush: '/garden/assets/crop-rau-lush.svg', golden: '/garden/assets/crop-rau-golden.svg' },
  huongduong: { common: '/garden/assets/crop-huongduong.svg', lush: '/garden/assets/crop-huongduong-lush.svg', golden: '/garden/assets/crop-huongduong-golden.svg' },
  nammay: { common: '/garden/assets/crop-nammay.svg', lush: '/garden/assets/crop-nammay-lush.svg', golden: '/garden/assets/crop-nammay-golden.svg' },
};
const artCache = new Map();
const POT_SOIL_FRONT = '/garden/assets/pot-soil-front.svg';
const ALL_ART=[...Object.values(EVENT_ART),...DECOR_ART,...Object.values(CROP_ART).flatMap(v=>Object.values(v)),POT_SOIL_FRONT];
function gardenArt(src) {
  if (!src) return null;
  if (!artCache.has(src)) {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    artCache.set(src, image);
  }
  const image = artCache.get(src);
  return image.complete && image.naturalWidth ? image : null;
}
const preloadGardenArt=()=>ALL_ART.forEach(src=>gardenArt(src));
const FONT = '"Patrick Hand", "Segoe Print", cursive';
const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
let noticeRemaining=0,lastNoticeAt=0,noticeTone='normal';

function say(text, ms = 6500, tone = 'normal',person=null) {
  if(!shouldReplaceNotice(noticeTone,noticeRemaining,tone))return;
  noticeTone=tone;
  const li = el('li', text);
  li.dataset.tone = tone;
  if(person){li.textContent='';li.dataset.tier=person.potTier?.id??'clay';li.append(createViewerAvatar(person),el('span',text),el('b',`LV${person.level??1}`));}
  feed.append(li);
  while (feed.children.length > 1) feed.firstChild.remove();
  noticeRemaining=ms;
}
function show(title, sub = '', ms = 3500) {
  say(sub ? `${title} · ${sub}` : title, Math.min(7000, ms));
}

const nameOf = id => plots.get(id)?.owner?.nickname ?? 'Ai đó';
const posOf = id => { const p = plots.get(id); return p && meta ? plotPos(p, meta) : null; };
function float(kind, id, text = '') { if (reduceMotion) return; const p = posOf(id); if (p) floaters.push({ kind, text, ...p, born: performance.now() }); }

function handleFx(fx) {
  const C = meta?.copy;
  if (!C) return;
  if(['plant','water','help','levelup','harvest','fertilize','pest-cleared','weed-cleared'].includes(fx.type))for(const id of fx.plots?.map(p=>p.plotId)??[fx.plotId])animatePlot(id,fx.type==='help'?'water':fx.type);
  for(const p of fx.impact?.destroyed??[])animatePlot(p.plotId,'impact');
  if (fx.type === 'harvest') {
    for (const p of fx.plots ?? []) {float('text', p.plotId, `+${p.gold ?? 0} vàng · +${p.xp??0} XP`);if(p.before)harvestGhosts.set(p.plotId,{crop:p.before,at:performance.now()});}
  }
  const actionCue={water:'water',help:'help',plant:'plant',harvest:'harvest','pest-cleared':'pestClear','weed-cleared':'weedClear',fertilize:'fertilize',steal:'theft',catch:'catch','dog-bark':'shieldBlock','boss-start':'bossIntro','boss-hit':'bossHit','boss-end':fx.won?'bossWin':'bossEscape','session-end':'podium','round-start':'roundStart','title':'achievement',levelup:[3,5,7,9].includes(fx.level)?'tierUnlock':'levelUp','event-active':{rain:'rainStart',pests:'pestsStart',merchant:'merchantStart',golden:'goldenStart'}[fx.kind]}[fx.type];
  if(actionCue)gardenAudio.cue({role:actionCue,eventId:fx.eventId??`${fx.type}:${fx.receivedAt??performance.now()}`,count:fx.count??1,ageMs:fx.receivedAt?Math.max(0,Date.now()-fx.receivedAt):0});
  switch (fx.type) {
    case 'action-feedback': {
      const now=Date.now(),duration=fx.ok?3200:4500;
      if(fx.plotId&&!fx.ok)commandFeedback.set(fx.plotId,{...fx,at:now,until:now+duration});
      say(`${displayNickname(fx.nickname,1.25)} · ${fx.message}`,duration,fx.ok?'normal':'important');
      break;
    }
    case 'session-end':
      
      gardenAudio.stop();presentation.clear();lastPresentation=null;wheelPresentation=null;giftPresentation=null;focusPlot=null;commandFeedback.clear();feed.replaceChildren();noticeRemaining=0;
      break;
    case 'round-start':
      gardenAudio.stop();presentation.clear();lastPresentation=null;wheelPresentation=null;
      problems.clear();commandFeedback.clear();floaters.length=0;focusPlot=null;giftPresentation=null;
      say(`Phiên ${fx.no} bắt đầu · giữ LV + XP · gõ “trồng” nhận chậu mới`,6000,'hero');
      break;
    case 'joined': {
      
      if (fx.plotId) float('sparkle', fx.plotId);
      if (fx.count === 1 && fx.seats?.length === 1) {
        const seat = fx.seats[0];
        say(`${displayNickname(seat.nickname, .82)} đã nhận chậu`, 4000);
      } else if (fx.count > 1) {
        const sample = (fx.seats ?? []).slice(0, 2)
          .map(v => displayNickname(v.nickname, .82)).join(' · ');
        say(`${fx.count} người vào Khu Gieo Hạt${sample ? ' · ' + sample : ''}`, 4000);
      }
      break;
    }
    case 'gift':
      presentation.push(fx);
      break;
    case 'steal':  say(`${nameOf(fx.thiefPlotId)} trộm cây của ${nameOf(fx.plotId)}`, 5200, 'important'); float('coin', fx.plotId); break;
    case 'catch':  say(`${nameOf(fx.plotId)} bắt được ${nameOf(fx.thiefPlotId)}!`, 5200, 'important'); float('sparkle', fx.plotId); break;
    case 'dog-bark':  break;
    case 'levelup':  say(`${fx.nickname??nameOf(fx.plotId)} lên LV${fx.level} · Chậu ${fx.potTier?.label??POT_ART[plots.get(fx.plotId)?.potTier]?.label??'mới'}`, 5600, 'hero',fx); float('sparkle', fx.plotId); break;
    case 'plant':  break;
    case 'harvest':  break;
    case 'pest-cleared':  break;
    case 'weed-cleared':  break;
    case 'fertilize':  break;
    case 'title':  say(`${fx.nickname ?? 'Người làm vườn'}${fx.level?` · LV${fx.level}`:''} đạt ${fx.titles?.join(' · ') ?? 'danh hiệu mới'}`, 6000, 'hero',fx);animatePlot(fx.plotId,'levelup');break;
    case 'card': presentation.push(fx); break;
    case 'boss-start': music.setMood('upbeat');break;
    case 'boss-hit': bossDamage.textContent=`−${fx.damage??0}`;bossDamage.dataset.at=String(Date.now());break;
    case 'boss-end': music.setMood('calm');break;
    case 'heart-milestone': {
      const label = { care:'Tim chăm cây', community:'Sức sống khu vườn', luck:'Tim may mắn' }[fx.kind] ?? 'Tim cộng đồng';
      say(fx.kind === 'luck' && fx.plotId ? `${label} · +2 vàng` : label, 3200, fx.kind === 'luck' ? 'important' : 'normal');
      if (fx.plotId) float('sparkle', fx.plotId);
      break;
    }
    case 'event-start': break;
    case 'event-active':
      music.setMood(fx.kind === 'pests' || fx.kind === 'golden' ? 'upbeat' : 'calm');
      break;
    case 'event-end':
      if (presentedEventKind === fx.kind) 
      if (fx.kind === 'pests') say(fx.total === 0 ? 'Đợt sâu kết thúc · không có mục tiêu mới' : fx.ok ? `Cứu vườn thành công · ${fx.cleared}/${fx.total} ổ sâu · ${fx.participants} người nhận +${fx.reward} vàng/người` : `Hết đợt sâu · đã cứu ${fx.cleared}/${fx.total} ổ · cùng cố gắng lần sau`, 7000, 'hero');
      else say(`${eventNames[fx.kind] ?? 'Sự kiện'} đã kết thúc`, 4500);
      presentedEventKind = null;
      music.setMood('calm');
      break;
    default:
  }
}

function updateMeters(p){
  const XP=meta.levelXp;
  const lv=p.owner.level,xp=p.owner.xp??0,next=XP[lv],base=XP[lv-1]??XP.at(-1);
  focusLevel.textContent=next?`LV ${lv} → ${lv+1} · ${Math.max(0,xp-base)}/${next-base} XP`:`LV ${lv} · cấp cao nhất`;
  xpFill.style.width=`${next?Math.max(0,Math.min(1,(xp-base)/(next-base)))*100:100}%`;
  const progress=Math.round((p.crop?.progress??0)*100),bonus=p.growth?.bonusPercent??0;
  growthRate.textContent=p.crop?(progress>=100?'Sẵn sàng thu hoạch':`${bonus>=0?'+':''}${bonus}% tốc độ`):'Gieo cây để tăng tốc';
  growthRate.parentElement.dataset.slow=String(bonus<0);
  growthLabel.textContent=p.crop?`${progress}% trưởng thành · ${meta.crops[p.crop.type]?.label??''}`:'LV cao mở giống cây và kiểu chậu mới';
  growthFill.style.width=`${progress}%`;
  const now=Date.now(),sources=[];
  if(p.growth?.waterBoostUntil>now)sources.push(`Tưới +25% · ${Math.ceil((p.growth.waterBoostUntil-now)/1000)}s`);
  if(p.growth?.fertilized)sources.push('Phân +18%');
  if(p.growth?.speedUntil>now)sources.push(`Quà +30% · ${Math.ceil((p.growth.speedUntil-now)/1000)}s`);
  if(p.prank?.until>now)sources.push(`${p.prank.kind==='slow'?'Mây lười −25%':p.prank.kind==='dry'?'Nắng khô · tưới để gỡ':'Cỏ · nhổ cỏ để gỡ'} · ${Math.ceil((p.prank.until-now)/1000)}s`);
  if(p.crop?.pest)sources.push('Sâu −40%');if(p.crop?.weeds)sources.push('Cỏ −28%');if(p.crop&&p.water<=0)sources.push('Khô −50%');
  growthSources.textContent=sources.join(' · ')||'Tưới +25% trong 30s · bón phân +18%';
}

function renderMoments(now,wallNow){
  const celebrating=sessionInfo?.phase==='awards';
  awards.classList.toggle('on',celebrating);awards.setAttribute('aria-hidden',String(!celebrating));stage.classList.toggle('awards-live',celebrating);
  document.getElementById('zoneHint').textContent=celebrating?'Đang trao giải · tạm ngừng thao tác · quà được giữ cho phiên mới':bossState?.phase==='active'?'Sâu Chúa đang xuất hiện · thả tim để cứu vườn · quà lớn đánh boss':'Gõ “trồng” → “chăm” → “hái” · “vườn” xem thông tin gọn';
  if(celebrating)awardCountdown.textContent=`Phiên ${sessionInfo.no+1} mở sau ${Math.max(0,Math.ceil((sessionInfo.awardsUntil-wallNow)/1000))}s`;
  const next=presentation.tick({boss:bossState?.phase==='active',awards:celebrating,blocked:Boolean(focusPlot&&now<focusAt+focusMs),idleMs:meta.cfg.camera.idleMs});
  const compactNotices=presentation.drainNotices();
  if(compactNotices.length){const entries=compactNotices.flatMap(p=>p.entries);say(`${entries.length} quà đã ghi nhận · ${entries.slice(-3).map(e=>`${e.nickname??'Bạn'}: ${e.roulette?.label??e.impact?.label??'chăm vườn'}`).join(' · ')}`,2800,'important');}

  if(next!==lastPresentation){
    lastPresentation=next;giftPresentation=null;wheelPresentation=null;
    if(next?.kind==='compact')say(`${next.entries.length} quà đã ghi nhận · ${next.entries.slice(-3).map(e=>`${e.nickname??'Bạn'}: ${e.roulette?.label??e.impact?.label??'chăm vườn'}`).join(' · ')}`,1200,'important');
    if(next?.kind==='gift'){
      presentGift({...next,giftKind:next.tier,travelMs:0,stableMs:next.until-now,giftWide:next.tier==='rain'});
      if(!next.restored)gardenAudio.cue({role:next.tier==='rain'?'rain':next.tier==='star'?'star':'dew',sceneId:next.sceneId,phase:'action'});
    }
    if(next?.kind==='profile'){
      const p=plots.get(next.plotId);
      say(`${displayNickname(next.nickname,1.25)} · LV${next.level} · ${next.xp} XP · ${next.gold} vàng · ${next.competition?.points??0} điểm · ${p?careLabel(p):'chăm vườn'}`,2500);
    }
    if(next?.kind==='roulette'){
      const r=next.roulette;wheelPresentation=next;
      wheelSender.textContent=`${displayNickname(next.nickname,1.25)} · ${next.total} xu`;
      wheel.style.transition='none';wheel.style.transform='rotate(0deg)';void wheel.offsetWidth;
      wheel.style.transition=reduceMotion||next.restored?'none':'transform 2s cubic-bezier(.12,.65,.12,1)';wheel.style.transform=`rotate(${2160-r.index*60-30}deg)`;
      wheelResult.textContent='Quà mây đang chọn…';wheelHint.textContent='3 ô lợi cho mình · 3 ô trêu hàng xóm';if(!next.restored)gardenAudio.cue({role:'wheelStart',sceneId:next.sceneId,phase:'intro'});
    }
    if(next?.kind==='impact'){
      const r=next.impact;impactStage.dataset.kind=next.tier;
      impactSender.textContent=`${displayNickname(next.nickname,1.25)} kích hoạt · ${next.total} xu`;
      impactTitle.textContent=r.label;impactResult.textContent=r.mode==='boss'?`−${r.damage} HP Sâu Chúa`:r.destroyed.length?`PHÁ HỦY ${r.destroyed.length} CÂY`:'ĐỐI THỦ ĐƯỢC KHIÊN BẢO VỆ';
      impactTargets.replaceChildren(...r.destroyed.map(p=>el('span',`${p.nickname} · mất cây ${meta.crops[p.crop]?.label??''}`)));
      impactHint.textContent=r.mode==='boss'?'Quà lớn chuyển hỏa lực vào boss · người gửi được chín cây và khiên 60s':`Người gửi được chín cây + khiên 60s. ${r.destroyed.length?'Chậu bị phá nứt 8s → gõ “trồng” gieo lại miễn phí.':'Không có cây đối thủ hợp lệ để phá.'}`;
      if(!next.restored)gardenAudio.cue({role:next.tier==='cataclysm'?'quake':'meteorFly',sceneId:next.sceneId,phase:'intro'});
    }
  }
  const wheelVisible=Boolean(wheelPresentation)&&!celebrating;
  wheelPanel.classList.toggle('on',wheelVisible);wheelPanel.setAttribute('aria-hidden',String(!wheelVisible));stage.classList.toggle('wheel-live',wheelVisible);
  if(wheelVisible&&(reduceMotion||now-wheelPresentation.startedAt>=2000)){
    const r=wheelPresentation.roulette;if(!wheelPresentation.soundResult){wheelPresentation.soundResult=true;if(!wheelPresentation.restored)gardenAudio.cue({role:'wheelResult',sceneId:wheelPresentation.sceneId,phase:'result'});}wheelResult.textContent=`${r.label} → ${r.targetName}`;
    wheelHint.textContent=r.expiresAt&&r.expiresAt<=wallNow?'Hiệu ứng đã kết thúc':r.kind==='speed'?'+30% tốc độ trong 45s':r.kind==='fertilizer'?'+18% tốc độ đến khi hái':r.kind==='shield'?'Khiên bảo vệ trong 60s':`${r.durationMs/1000}s rồi tự hết${r.kind==='dry'?' · gõ “tưới” để gỡ sớm':r.kind==='weeds'?' · gõ “nhổ cỏ” để gỡ sớm':' · cây vẫn tiếp tục lớn'}`;
  }
  if(wheelVisible&&now-wheelPresentation.startedAt<2000&&!wheelPresentation.restored){const tick=Math.floor((now-wheelPresentation.startedAt)/140);gardenAudio.cue({role:'wheelTick',sceneId:wheelPresentation.sceneId,phase:`tick:${tick}`});}
  if(next?.kind==='impact'&&now-next.startedAt>=650&&!next.soundImpact){next.soundImpact=true;if(!next.restored)gardenAudio.cue({role:next.impact.mode==='boss'?'bossGiftHit':next.impact.destroyed.length?'meteorImpact':'shieldBlock',sceneId:next.sceneId,phase:'result'});}
  const impactVisible=next?.kind==='impact';impactStage.classList.toggle('on',impactVisible);impactStage.setAttribute('aria-hidden',String(!impactVisible));stage.classList.toggle('impact-live',impactVisible);
  const b=bossState,active=b?.phase==='active',ended=b&&['won','escaped'].includes(b.phase)&&wallNow-b.endedAt<6500;
  const visible=Boolean((active||ended)&&(!next||next.kind==='profile')&&!celebrating);
  bossArena.classList.toggle('on',visible);bossArena.setAttribute('aria-hidden',String(!visible));bossArena.dataset.phase=b?.phase??'';stage.classList.toggle('boss-live',visible);
  if(active||ended){
    bossFill.style.width=`${b.hp/b.maxHp*100}%`;bossHp.textContent=`${b.hp} / ${b.maxHp} HP`;
    bossClock.textContent=active?`Còn ${Math.max(0,Math.ceil((b.endsAt-wallNow)/1000))}s · thắng nhận +8 XP, +5 vàng`:'Ghi công những người đã cùng đánh boss';
    bossKicker.textContent=active?'BOSS CỘNG ĐỒNG':b.phase==='won'?'CỨU VƯỜN THÀNH CÔNG':'SÂU CHÚA ĐÃ TRỐN';
    bossInstruction.textContent=active?'THẢ TIM ĐỂ ĐÁNH · 1 TIM = 1 SÁT THƯƠNG':b.phase==='won'?'+8 XP · +5 VÀNG · HUY HIỆU KHẮC TINH':'Hẹn cả phòng ở trận tiếp theo';
    bossLeaders.textContent=Object.values(b.contributors).sort((a,b)=>b.damage-a.damage).slice(0,3).map(c=>`${c.nickname} · ${c.damage} sát thương`).join('  /  ')||'Cùng thả tim để mở đòn đầu tiên';
  }
  bossDamage.classList.toggle('on',wallNow-Number(bossDamage.dataset.at)<900);
  if(active){heartKind.textContent='BOSS · THẢ TIM ĐÁNH';heartCount.textContent=`${b.hp}/${b.maxHp} HP`;heartFill.style.width=`${b.hp/b.maxHp*Math.max(0,heartFill.parentElement.clientWidth-16)}px`;}else if(heartState)renderHearts(heartState);
}

function presentGift(data) {
  const now=performance.now();
  giftPresentation={...data,startedAt:now,until:now+(Number(data.travelMs)||0)+(Number(data.stableMs)||5000)};
  giftHero.dataset.kind=data.giftKind;
  giftArt.setAttribute('href',`#gift-${data.giftKind}`);
  giftSender.textContent=`${displayNickname(data.nickname??nameOf(data.plotId),1.25)} vừa mang tới`;
  giftTitle.textContent=meta?.copy?.gifts?.[data.giftKind]??'Quà vườn';
  giftImpact.textContent=(data.benefits?.seeded?'Gieo rau mới · ':'')+giftImpactText(data);
  const effects=data.giftWide?data.effects??[]:(data.effects??[]).filter(e=>e.plotId===data.plotId);
  for(const e of effects.slice(0,8))if(e.to>e.from)float('text',e.plotId,`+${Math.round((e.to-e.from)*100)}%`);
}

function renderGiftHero(now) {
  if(giftPresentation&&now>=giftPresentation.until)giftPresentation=null;
  const active=Boolean(giftPresentation);
  giftHero.classList.toggle('on',active);giftHero.setAttribute('aria-hidden',String(!active));
  stage.classList.toggle('gift-live',active);
  stage.dataset.gift=giftPresentation?.giftKind??'';
}

function drawGiftImpact(now) {
  const g=giftPresentation;
  if(!g||now>=g.until)return;
  const scale=(meta.cfg.potScale??1.4)*cam.zoom,color=({dew:'#78C9DE',star:C.ochre,rain:'#78B795',tree:C.ochre})[g.giftKind]??C.ochre;
  ctx.save();
  if(g.giftKind==='tree'&&g.giftWide){
    ctx.globalAlpha=.18;ctx.strokeStyle='#A7793C';ctx.lineWidth=40;
    ctx.beginPath();ctx.moveTo(540,1880);ctx.quadraticCurveTo(590,1400,540,900);ctx.stroke();
    for(let i=0;i<6;i++)drawLeaf(540,1020+i*95,160,i%2?-.95:1.1,i%2?C.ochre:'#78B795');
  }
  const effects=g.giftWide?g.effects??[]:(g.effects??[]).filter(e=>e.plotId===g.plotId);
  effects.forEach((effect,i)=>{
    const p=plots.get(effect.plotId);if(!p?.owner||!p.awake)return;
    const at=worldToScreen(plotPos(p,meta),cam,VP),phase=reduceMotion ? .35 : ((now-g.startedAt)/1500+i*.07)%1,r=(40+phase*35)*scale;
    ctx.globalAlpha=(1-phase)*.65;ctx.strokeStyle=color;ctx.lineWidth=Math.max(3,4*cam.zoom);
    ctx.beginPath();ctx.ellipse(at.x,at.y-25*scale,r,r*.7,0,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=.8;
    for(let j=0;j<4;j++){
      const angle=j*Math.PI/2+phase*Math.PI*2,x=at.x+Math.cos(angle)*r*.75,y=at.y-25*scale+Math.sin(angle)*r*.55;
      if(g.giftKind==='star'||g.giftKind==='tree')drawSparkle(x,y,Math.max(5,8*scale),color);
      else {ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,Math.max(3,4*scale),Math.max(5,7*scale),-.2,0,Math.PI*2);ctx.fill();}
    }
  });
  ctx.restore();
}

function renderCompetition(value) {
  const session = value?.session, current = value?.standings ?? [];
  sessionInfo=session;
  if(session?.phase==='awards'&&awardNo!==session.no){
    awardNo=session.no;awardTitle.textContent=`Những người gieo mây · Phiên ${session.no}`;podium.replaceChildren();
    for(const standing of session.completed?.standings??session.completed?.podium??[]){
      const entry={...standing,...session.completed?.podium?.find(p=>p.userId===standing.userId)};
      const row=el('article','');row.dataset.rank=entry.rank;
      row.style.setProperty('--order',entry.rank-1);
      row.append(el('small',`HẠNG ${entry.rank}`),createViewerAvatar(entry),el('b',entry.nickname),el('span',entry.title??'Người gieo mây'),el('strong',entry.rewardXp?`+${entry.rewardXp} XP · Lv${entry.level}`:`Vinh danh · Lv${entry.level??1}`),el('em',`${entry.points} điểm`));podium.append(row);
    }
    if(!podium.children.length)podium.append(el('p','Khép phiên · hẹn gặp ở vườn mới!'));
  }
  const rows = current.slice(0, 5),oldRows=new Map([...leaders.children].map(li=>[li.dataset.userId,{node:li,y:li.getBoundingClientRect().top}]));
  for(const old of oldRows.values())for(const animation of old.node.getAnimations())animation.cancel();
  const nextRows=[];
  if (!rows.length) {
    leaders.replaceChildren();
    const empty = document.createElement('li'); empty.className = 'empty';
    empty.textContent = session?'Phiên mới · gõ “chăm” để lên bảng!':'Bình luận, trồng và chăm cây để lên bảng.'; leaders.append(empty); return;
  }
  for (const row of rows) {
    const old=oldRows.get(row.userId),item=old?.node??document.createElement('li'),picture=item.querySelector('.viewer-avatar'), rank = document.createElement('span'), name = document.createElement('span'), points = document.createElement('b');
    item.replaceChildren();item.dataset.userId=row.userId;
    item.dataset.rank = row.rank;
    rank.className = 'rank'; rank.textContent = `${row.rank}.`;
    name.className = 'leader-name'; name.textContent = row.nickname;
    points.className = 'points'; points.textContent = `${row.points} đ`;
    item.append(rank,picture?.dataset.avatar===avatarSource(row.avatar)?picture:createViewerAvatar(row), name, points);nextRows.push(item);
  }
  leaders.replaceChildren(...nextRows);
  if(!reduceMotion)for(const li of nextRows){const old=oldRows.get(li.dataset.userId);if(old){const dy=old.y-li.getBoundingClientRect().top;if(Math.abs(dy)>1)li.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:350,easing:'ease-out'});}}
}

async function refreshStatus() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) return;
    const status = await response.json();
    audienceCount.textContent = `${status.viewers} người đang giữ vườn`;
    eventLabel.textContent = status.event ? `Sự kiện · ${eventNames[status.event] ?? status.event}` : 'Nhà kính đang yên bình';
    if (status.competition) renderCompetition(status.competition);
  } catch { /* the live Garden stream continues without the optional status ribbon */ }
}

function renderHearts(h) {
  if (!h) return;
  heartKind.textContent = ({ care:'TIM · CHĂM CÂY', community:'TIM · CẢ VƯỜN', luck:'TIM · MAY MẮN' })[h.kind] ?? 'TIM CỘNG ĐỒNG';
  heartCount.textContent = `${Math.min(h.progress,h.target)}/${h.target}`;
  heartFill.style.width = `${Math.round(Math.min(1,h.progress / Math.max(1,h.target))*Math.max(0,heartFill.parentElement.clientWidth-16))}px`;
}

function actionHintFor(p) {
  if(p?.brokenUntil>Date.now())return `CHẬU NỨT · ${Math.ceil((p.brokenUntil-Date.now())/1000)}s rồi gõ “trồng” miễn phí`;
  if (!p?.crop) return p?.replantCredit?'Gõ “trồng” để gieo lại miễn phí':'Gõ “trồng” để bắt đầu';
  if (p.crop.pest) return 'CÓ SÂU · gõ “bắt sâu” để cứu cây';
  if (p.crop.weeds) return 'CÓ CỎ · gõ “nhổ cỏ” để cây lớn lại';
  if ((p.stage ?? 0) >= 3) return 'CÂY CHÍN · gõ “hái” để nhận vàng + XP';
  if (p.water < .25) return 'ĐẤT KHÔ · gõ “tưới”';
  if (!p.crop.fertilized) return 'Gõ “bón phân” để tăng tốc';
  return 'Tiếp tục chăm cây · chờ cây chín';
}


function focusStatusFor(p) {
  if (!p?.crop) return 'Chậu trống · sẵn sàng gieo hạt';
  const cropName = meta?.crops?.[p.crop.type]?.label ?? p.crop.type;
  const stageName = ['Hạt','Mầm','Đang lớn','Chín','Quá lứa'][p.stage ?? 0] ?? 'Đang lớn';
  const variant = ({ lush:'Sum suê', golden:'Ánh kim' })[p.crop.variant];
  return `${cropName} · ${stageName}${variant ? ` · ${variant}` : ''}`;
}
function updateFocusCard(kind, plot) {
  const showCard = Boolean(plot?.owner && plot.awake && kind !== 'overview');
  focusCard.classList.toggle('on', showCard);
  focusCard.setAttribute('aria-hidden', String(!showCard));
  if (!showCard) return;
  const tier = plot.potTier ?? 'clay';
  focusCard.dataset.tier = tier;
  focusKicker.textContent = shotReason || 'HỒ SƠ VƯỜN';
  focusName.textContent = `${displayNickname(plot.owner?.nickname, 1.25)} · Lv${plot.owner.level}`;
  const avatarSlot=document.getElementById('focusAvatar');
  if(avatarSlot.dataset.owner!==plot.owner.userId+plot.owner.avatar){avatarSlot.dataset.owner=plot.owner.userId+plot.owner.avatar;avatarSlot.replaceChildren(createViewerAvatar(plot.owner));}

  focusStatus.textContent = focusStatusFor(plot);
  const profile=plot.owner.competition;
  focusStats.textContent=`${plot.owner.gold??0} vàng · ${plot.owner.xp??0} XP · ${profile?.points??0} điểm phiên${plot.blessingUntil>Date.now()?` · bảo vệ ${Math.ceil((plot.blessingUntil-Date.now())/1000)}s`:''}`;
  if(profile?.titles?.length)focusStats.textContent+=` · ${profile.titles.slice(0,2).map(t=>`${t.label}${t.count>1?` ×${t.count}`:''}`).join(' · ')}`;
  focusAction.textContent = actionHintFor(plot);
  updateMeters(plot);
}

function positionFocusCard(now) {
  const p = focusPlot && plots.get(focusPlot);
  const visible = Boolean(p?.owner && p.awake && cam.zoom >= 1.25 && now >= focusAt && now < focusAt + focusMs);
  focusCard.classList.toggle('on', visible);
  focusCard.setAttribute('aria-hidden', String(!visible));
  stage.classList.toggle('close-up', visible);
  if (!visible) return;
  updateFocusCard('focus',p);
  const feedback=commandFeedback.get(p.id),blocked=feedback&&feedback.until>Date.now()&&!feedback.ok;
  const action=feedback&&feedback.until>Date.now()?feedback.message:actionHintFor(p);
  if(focusAction.textContent!==action)focusAction.textContent=action;
  focusCard.dataset.blocked=String(Boolean(blocked));
  const at = worldToScreen(plotPos(p, meta), cam, VP), scale = (meta.cfg.potScale ?? 1.4) * cam.zoom;
  const bounds = { left:at.x-60*scale, right:at.x+60*scale, top:at.y-88*scale, bottom:at.y+62*scale };
  const card = focusCardPlacement(bounds, { w:focusCard.offsetWidth, h:focusCard.offsetHeight }, VP);
  focusCard.style.left = `${card.x}px`; focusCard.style.top = `${card.y}px`; focusCard.dataset.side = card.side;
}

function onMessage(event, data) {
  if (event === 'meta') {
    meta = data;
    hint.textContent = 'Bình luận để nhận chậu · gõ “trồng”';
    music.setLists(data.music ?? { calm: [], upbeat: [] });
    preloadGardenArt();
    music.resume();gardenAudio.warmup().catch(()=>{});
  } else if (event === 'reset') {
    noticeRemaining=0;noticeTone='normal';
    gardenAudio.stop();presentation.clear();lastPresentation=null;bossState=null;heartState=null;wheelPresentation=null;
    plots.clear();plotMotions.clear(); floaters.length = 0; serverEvent = null; presentedEventKind = null; giftPresentation = null;
    focusPlot = null; updateFocusCard('overview', null);
    problems.clear();commandFeedback.clear();sessionInfo=null;lastSessionClock='';
    say('Vườn mô phỏng đã làm mới', 4200);
  } else if (event === 'frame') {
    for (const [id, p] of Object.entries(data.parts.plots ?? {})) {const prev=plots.get(id);if(prev?.owner&&p.crop&&(!prev.crop||prev.stage!==p.stage))animatePlot(id,'plant');plots.set(id, p);}
    if (focusPlot && plots.get(focusPlot)) updateFocusCard('focus', plots.get(focusPlot));
    if (focusPlot && data.parts.plots?.[focusPlot]) hint.textContent = 'Cận cảnh thao tác · xem hướng dẫn cạnh cây';
    if ('event' in data.parts) {
      serverEvent = data.parts.event;
      if (!serverEvent) presentedEventKind = null;
      if (serverEvent?.phase === 'active') {
        presentedEventKind = serverEvent.kind;
        music.setMood(serverEvent.kind === 'golden' || serverEvent.kind === 'pests' ? 'upbeat' : 'calm');
      }
    }
    if (data.parts.competition) {
      renderCompetition(data.parts.competition);
      if(!checkpointLoaded){checkpointLoaded=true;if(savedCheckpoint&&sessionInfo&&savedCheckpoint.sessionNo===sessionInfo.no)presentation.restore(savedCheckpoint.queue);}
    }
    if('boss' in data.parts)bossState=data.parts.boss;
    if (data.parts.hearts) {heartState=data.parts.hearts;renderHearts(heartState);}
    for (const fx of data.fx ?? []) handleFx(fx);
    const count = [...plots.values()].filter(p=>p.owner&&p.awake).length;
    audienceCount.textContent=`${count} người đang giữ vườn`;
    zoneCount.textContent = `${count}/${meta?.cfg.activeCapacity??48} chậu · cùng chăm vườn`;
  } else if(event==='receipts'){
    for(const receipt of data)if(receipt.sessionNo===sessionInfo?.no)presentation.push({...receipt,compact:true});
  } else if (event === 'shot') {
    shotReason=cameraReason(data);
    from = cam;
    to = { x: data.x, y: data.y, zoom: data.zoom };
    cameraEaseMs = Math.max(0, Number(data.travelMs ?? data.easeMs) || 1800);
    const focused = data.plotId ? plots.get(data.plotId) : null;
    hint.textContent = data.kind === 'overview'||data.giftWide||data.kind==='boss'
      ? 'Bình luận để nhận chậu · gõ “trồng”'
      : data.eventKind ? meta?.copy?.eventHint?.[data.eventKind] ?? 'Cùng chăm vườn' : 'Cận cảnh thao tác · xem hướng dẫn cạnh cây';
    if(data.kind==='event'&&data.eventKind)presentedEventKind=data.eventKind;

    focusPlot = data.giftWide ? null : data.plotId ?? null;
    updateFocusCard(data.kind, focused);
    const now = performance.now();
    focusAt = now + Math.max(0, Number(data.travelMs) || cameraEaseMs);
    focusMs = Math.max(0, Number(data.stableMs) || 4600);
    shotAt = now;
  }
}

// SSE first; if the stream drops twice (a tunnel that cannot stream) fall back to long-polling.
function connect() {
  let fails = 0;
  const es = new EventSource('/events');
  for (const e of ['meta', 'frame', 'shot', 'reset','receipts']) es.addEventListener(e, m => { fails = 0; onMessage(e, JSON.parse(m.data)); });
  es.onerror = () => { if (++fails >= 2) { es.close(); poll(); } };
}
async function poll(id = '') {
  try {
    const r = await (await fetch(`/poll?wait=1${id ? `&id=${id}` : ''}`)).json();
    for (const m of r.msgs) onMessage(m.event, m.data);
    setTimeout(() => poll(r.id), 50);
  } catch { setTimeout(() => poll(id), 2000); }
}

// ---------- paper-doodle scene ----------
function cloudPath(width, height) {
  ctx.beginPath();
  ctx.moveTo(-width * .49, height * .12);
  ctx.bezierCurveTo(-width * .54, -height * .08, -width * .43, -height * .31, -width * .30, -height * .30);
  ctx.bezierCurveTo(-width * .24, -height * .52, -width * .07, -height * .47, width * .01, -height * .34);
  ctx.bezierCurveTo(width * .11, -height * .52, width * .25, -height * .40, width * .28, -height * .23);
  ctx.bezierCurveTo(width * .48, -height * .28, width * .53, -height * .06, width * .47, height * .12);
  ctx.bezierCurveTo(width * .51, height * .34, width * .33, height * .43, width * .19, height * .35);
  ctx.bezierCurveTo(width * .03, height * .47, -width * .11, height * .40, -width * .20, height * .33);
  ctx.bezierCurveTo(-width * .38, height * .47, -width * .53, height * .33, -width * .49, height * .12);
  ctx.closePath();
}

function drawBackdrop(now) {
  const sky = ctx.createLinearGradient(0, 0, 0, VP.h);
  sky.addColorStop(0, visualEvent()?.kind === 'golden' ? '#F5E1A3' : '#DCEBE4');
  sky.addColorStop(.56, '#F6F0E6');
  sky.addColorStop(1, '#D8E1D5');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VP.w, VP.h);

  const drift = reduceMotion ? 0 : Math.sin(now / 5200) * 16;
  ctx.save();
  ctx.globalAlpha = .38;
  ctx.fillStyle = C.ochre;
  ctx.beginPath(); ctx.arc(850 + drift, 370, 112, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.globalAlpha = .08;
  for (let x = -80; x < VP.w + 120; x += 180) {
    ctx.beginPath(); ctx.moveTo(x + drift * .25, 250); ctx.lineTo(x - 80 + drift * .25, VP.h); ctx.stroke();
  }
  for (let y = 420; y < VP.h; y += 260) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VP.w, y + 70); ctx.stroke();
  }
  ctx.restore();

  ctx.save(); ctx.strokeStyle = 'rgba(47,60,68,.16)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (const side of [62, VP.w - 62]) {
    const dir = side < VP.w / 2 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(side, -20); ctx.bezierCurveTo(side + dir * 52, 520, side - dir * 30, 1180, side, VP.h + 30); ctx.stroke();
    for (let y = 240; y < VP.h; y += 285) {
      ctx.save(); ctx.globalAlpha = .38; drawLeaf(side + dir * 10, y, 22, dir < 0 ? .8 : -.8, y % 570 ? C.teal : C.ochre); ctx.restore();
    }
  }
  ctx.restore();
}

function drawLeaf(x, y, size, angle = 0, color = C.teal) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-size * .8, -size * .6, -size * 1.1, size * .7, 0, size); ctx.bezierCurveTo(size * .8, size * .5, size * .8, -size * .5, 0, 0); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, size * .12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, size * .85); ctx.quadraticCurveTo(0, size * .35, size * .18, size * .1); ctx.stroke();
  ctx.restore();
}

function drawVine(x1, y1, x2, y2) {
  const s = cam.zoom;
  const a = worldToScreen({ x: x1, y: y1 }, cam, VP), b = worldToScreen({ x: x2, y: y2 }, cam, VP);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 15 * s; ctx.strokeStyle = C.teal;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(a.x + 100 * s, a.y + 100 * s, b.x - 120 * s, b.y - 100 * s, b.x, b.y); ctx.stroke();
  ctx.lineWidth = 5 * s; ctx.strokeStyle = C.ink; ctx.stroke();
  drawLeaf(a.x + 35 * s, a.y + 45 * s, 42 * s, -.9, C.teal);
  drawLeaf(b.x - 25 * s, b.y - 40 * s, 36 * s, 1.1, C.ochre);
  ctx.restore();
}

// One Seed Zone, presented as two shelf wings inside one greenhouse frame.
function drawTier(_tier, _index, _active) {
  const cfg = meta.cfg, s = cam.zoom, scene = SEED_SCENE, rack = rackGeometry(cfg), g = rack.outer;
  const w = g.right - g.left, h = g.bottom - g.top;
  const center = worldToScreen({ x: (g.left + g.right) / 2, y: (g.top + g.bottom) / 2 }, cam, VP);
  ctx.save(); ctx.translate(center.x, center.y); ctx.scale(s, s); ctx.translate(-w / 2, -h / 2);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  ctx.fillStyle = 'rgba(255,253,249,.76)'; ctx.strokeStyle = C.ink; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 32); ctx.fill(); ctx.stroke();

  ctx.strokeStyle = scene.rail; ctx.lineWidth = 18;
  ctx.beginPath(); ctx.moveTo(18, 66); ctx.quadraticCurveTo(w / 2, -28, w - 18, 66); ctx.stroke();

  const dividerX = (rack.wings[0].right + rack.wings[1].left) / 2 - g.left;
  ctx.strokeStyle = 'rgba(142,192,185,.72)'; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(dividerX, 84); ctx.lineTo(dividerX, h - 22); ctx.stroke();

  for (const wing of rack.wings) {
    const shelfLeft = wing.left - g.left + 28;
    const shelfWidth = wing.right - wing.left - 56;
    for (let row = 0; row < cfg.shelvesPerWing; row++) {
      const shelfWorldY = cfg.zoneMarginY + row * cfg.shelfSpacingY + cfg.potBottomOffset + cfg.potShelfGap;
      const shelfY = shelfWorldY - g.top;
      ctx.fillStyle = C.shadow;
      ctx.beginPath(); ctx.roundRect(shelfLeft, shelfY + 11, shelfWidth, 26, 10); ctx.fill();
      ctx.fillStyle = row % 2 ? C.paper : scene.rail; ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(shelfLeft, shelfY, shelfWidth, 18, 9); ctx.fill(); ctx.stroke();
    }
  }

  ctx.restore();
}

function drawShelfFronts() {
  const cfg = meta.cfg, rack = rackGeometry(cfg);
  ctx.save();
  for (const wing of rack.wings) {
    for (let row = 0; row < cfg.shelvesPerWing; row++) {
      const y = cfg.zoneMarginY + row * cfg.shelfSpacingY + cfg.potBottomOffset + cfg.potShelfGap + 7;
      const a = worldToScreen({ x: wing.left + 28, y }, cam, VP);
      const b = worldToScreen({ x: wing.right - 28, y }, cam, VP);
      ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, 5 * cam.zoom); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTierLandmark(index) {
  const cfg = meta.cfg, at = worldToScreen({ x: cfg.tierWidth * .84, y: index * cfg.tierHeight + cfg.tierHeight * .56 }, cam, VP);
  ctx.save(); ctx.translate(at.x, at.y); ctx.scale(cam.zoom, cam.zoom);
  ctx.strokeStyle = C.ink; ctx.fillStyle = C.card; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (index === 0) {
    ctx.beginPath(); ctx.moveTo(0, 38); ctx.quadraticCurveTo(-4, 4, 0, -28); ctx.stroke();
    drawLeaf(-1, -10, 30, -.8, C.teal); drawLeaf(0, 10, 26, .75, C.ochre);
  } else if (index === 1) {
    ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.fillStyle = C.ochre; ctx.fill(); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 42, Math.sin(a) * 42); ctx.lineTo(Math.cos(a) * 58, Math.sin(a) * 58); ctx.stroke(); }
  } else if (index === 2) {
    ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(0, -35); ctx.moveTo(-28, -35); ctx.lineTo(28, -35); ctx.lineTo(22, 26); ctx.quadraticCurveTo(0, 48, -22, 26); ctx.closePath();
    ctx.fillStyle = C.coral; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 34); ctx.lineTo(0, -15); ctx.strokeStyle = C.ochre; ctx.lineWidth = 6; ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-48, 28); ctx.lineTo(-39, -22); ctx.lineTo(-10, 3); ctx.lineTo(0, -43); ctx.lineTo(13, 3); ctx.lineTo(40, -22); ctx.lineTo(49, 28); ctx.closePath();
    ctx.fillStyle = C.teal; ctx.fill(); ctx.stroke(); drawSparkle(0, -8, 9, C.ochre);
  }
  ctx.restore();
}

function drawSeedling(stage) {
  ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (stage === 0) {
    ctx.beginPath(); ctx.ellipse(0, -1, 9, 6, -.2, 0, Math.PI * 2); ctx.fillStyle = C.ochre; ctx.fill(); ctx.stroke(); return;
  }
  ctx.beginPath(); ctx.moveTo(0, 9); ctx.quadraticCurveTo(-4, -8, 2, -31 - stage * 4); ctx.stroke();
  if (stage >= 1) drawLeaf(-1, -19, 16, -1.1, stage === 4 ? C.shadow : C.teal);
  if (stage >= 2) drawLeaf(1, -25, 15, .85, stage === 4 ? C.shadow : C.teal);
}

function drawRipeCrop(type, stage) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (stage === 0) { drawSeedling(stage); return; }
  if (stage < 3) {
    if (type === 'rau') {
      ctx.strokeStyle=C.ink;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,12);ctx.quadraticCurveTo(-3,-5,1,-24);ctx.stroke();
      drawLeaf(0,-9,stage===1?18:27,Math.PI-.7,C.teal);drawLeaf(1,-15,stage===1?17:25,Math.PI+.8,C.teal);
    } else if (type === 'huongduong') {
      const top=stage===1?-34:-61;
      ctx.strokeStyle=C.ink;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,13);ctx.quadraticCurveTo(7,-18,0,top);ctx.stroke();
      drawLeaf(0,-10,stage===1?19:27,-1.35,C.teal);drawLeaf(0,-24,stage===1?16:24,.9,C.teal);
      ctx.beginPath();ctx.ellipse(0,top,stage===1?10:16,stage===1?13:20,0,0,Math.PI*2);
      ctx.fillStyle=stage===1?C.teal:C.ochre;ctx.fill();ctx.strokeStyle=C.ink;ctx.lineWidth=4;ctx.stroke();
    } else {
      const cap=stage===1?18:30,top=stage===1?-13:-30;
      ctx.fillStyle=C.card;ctx.strokeStyle=C.ink;ctx.lineWidth=4;
      ctx.beginPath();ctx.roundRect(-8,top+4,16,15-top,5);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.ellipse(0,top,cap,cap*.65,0,Math.PI,Math.PI*2);ctx.quadraticCurveTo(cap,top+12,0,top+10);ctx.quadraticCurveTo(-cap,top+12,-cap,top);ctx.closePath();
      ctx.fillStyle=C.coral;ctx.fill();ctx.stroke();
      ctx.fillStyle=C.card;for(const x of [-.45,.25,.65]){ctx.beginPath();ctx.arc(cap*x,top-4-Math.abs(x)*3,3.5,0,Math.PI*2);ctx.fill();}
    }
    return;
  }
  if (type === 'huongduong') {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(3, -15, 0, -39); ctx.stroke();
    drawLeaf(-1, -15, 15, -1.2); drawLeaf(0, -20, 14, .8);
    for (let i = 0; i < 10; i++) { const a = i * Math.PI * 2 / 10; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 22, -47 + Math.sin(a) * 22, 7, 15, a + Math.PI / 2, 0, Math.PI * 2); ctx.fillStyle = C.ochre; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, -47, 12, 0, Math.PI * 2); ctx.fillStyle = C.hair; ctx.fill(); ctx.stroke();
  } else if (type === 'nammay') {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 9); ctx.quadraticCurveTo(-4, -12, 2, -31); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-27, -27); ctx.quadraticCurveTo(-23, -55, 1, -52); ctx.quadraticCurveTo(25, -53, 29, -28); ctx.quadraticCurveTo(3, -19, -27, -27); ctx.closePath(); ctx.fillStyle = stage === 4 ? C.shadow : C.coral; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, -30); ctx.quadraticCurveTo(0, -37, 12, -29); ctx.stroke();
  } else {
    drawLeaf(0, -25, 22, -.9, stage === 4 ? C.shadow : C.teal);
    drawLeaf(0, -29, 20, .8, stage === 4 ? C.shadow : C.ochre);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 10); ctx.quadraticCurveTo(-5, -10, 1, -35); ctx.stroke();
  }
}

function drawPlot(p, lod, now) {
  if (!p.owner || !p.awake) return;
  const at = worldToScreen(plotPos(p, meta), cam, VP), renderScale = meta.cfg.potScale ?? 1.05, size = 100 * renderScale * cam.zoom;
  ctx.save(); ctx.translate(at.x, at.y); ctx.scale(renderScale * cam.zoom, renderScale * cam.zoom); ctx.globalAlpha = 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const motion=plotMotions.get(p.id),elapsed=motion?now-motion.at:2000,m=plotMotion(motion?.kind,elapsed,reduceMotion);
  if(m.pulse||motion?.kind==='impact'){ctx.translate(0,55);ctx.rotate(motion?.kind==='impact'?m.tilt:0);ctx.scale(1+m.pulse,1-m.pulse*.4);ctx.translate(0,-55);}

  const tier = p.potTier ?? 'clay';
  const art=POT_ART[tier]??POT_ART.clay,colors=[art.fill,art.accent];
  ctx.fillStyle=C.shadow;ctx.beginPath();ctx.moveTo(-40,54);ctx.bezierCurveTo(-16,48,35,50,46,57);ctx.bezierCurveTo(30,65,-27,63,-40,54);ctx.fill();
  ctx.strokeStyle=C.ink;ctx.lineWidth=4;
  if(tier==='royal'){ctx.beginPath();ctx.moveTo(-37,17);ctx.bezierCurveTo(-65,3,-64,43,-35,35);ctx.moveTo(37,17);ctx.bezierCurveTo(63,2,64,43,35,34);ctx.stroke();}
  ctx.fillStyle=colors[0];ctx.fill(potPaths[tier]??potPaths.clay);ctx.stroke(potPaths[tier]??potPaths.clay);
  if(tier==='royal'||tier==='astral') {ctx.beginPath();ctx.roundRect(-36,49,72,8,3);ctx.fillStyle=tier==='astral'?C.ochre:colors[1];ctx.fill();ctx.stroke();}
  ctx.fillStyle=colors[0];ctx.beginPath();ctx.moveTo(-46,10);ctx.bezierCurveTo(-45,-5,42,-3,46,9);ctx.bezierCurveTo(44,25,-43,24,-46,10);ctx.fill();ctx.stroke();
  ctx.fillStyle=C.hair;ctx.beginPath();ctx.moveTo(-37,9);ctx.bezierCurveTo(-31,1,31,2,37,9);ctx.bezierCurveTo(28,18,-29,17,-37,9);ctx.fill();
  if(tier==='astral')drawSparkle(0,33,11,C.card);
  else if(tier==='glazed')drawLeaf(0,25,16,-.7,C.card);
  else if(tier==='royal'){ctx.fillStyle=C.ochre;ctx.beginPath();ctx.moveTo(-10,27);ctx.lineTo(0,19);ctx.lineTo(10,27);ctx.lineTo(0,41);ctx.closePath();ctx.fill();}
  else if(tier==='banded'){ctx.strokeStyle=C.ochre;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-35,32);ctx.quadraticCurveTo(0,42,35,32);ctx.stroke();}
  else if(tier==='clay'){ctx.strokeStyle=C.coral;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-22,27);ctx.lineTo(-15,38);ctx.moveTo(18,26);ctx.lineTo(22,36);ctx.stroke();}
  if(tier==='astral'){ctx.strokeStyle=C.ochre;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-44,7);ctx.lineTo(-42,-4);ctx.lineTo(-31,5);ctx.moveTo(31,4);ctx.lineTo(42,-5);ctx.lineTo(46,8);ctx.stroke();}
  ctx.fillStyle=colors[1];for(let i=0;i<(p.owner.level%2?1:2);i++){ctx.beginPath();ctx.arc(-5+i*10,45,2.5,0,Math.PI*2);ctx.fill();}
  const badges=p.owner.competition?.titles??[],badge=['podium1','bossSlayer','harvest50','helpful20','pestKeeper20','harvest10','helpful','pestKeeper','firstHarvest'].find(id=>badges.some(t=>t.id===id));
  if(badge){ctx.save();ctx.translate(-33,31);ctx.lineWidth=2.5;ctx.strokeStyle=C.ink;ctx.fillStyle=C.ochre;ctx.beginPath();ctx.moveTo(-10,-4);ctx.quadraticCurveTo(-9,-13,2,-11);ctx.quadraticCurveTo(13,-9,10,3);ctx.quadraticCurveTo(5,12,-5,9);ctx.closePath();ctx.fill();ctx.stroke();
    if(badge==='podium1'){ctx.beginPath();ctx.moveTo(-6,3);ctx.lineTo(-7,-5);ctx.lineTo(-1,-1);ctx.lineTo(2,-7);ctx.lineTo(6,-1);ctx.lineTo(8,-4);ctx.lineTo(6,4);ctx.closePath();ctx.fillStyle=C.card;ctx.fill();ctx.stroke();}
    else if(badge==='bossSlayer'){ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(6,-4);ctx.lineTo(4,4);ctx.lineTo(0,7);ctx.lineTo(-5,3);ctx.closePath();ctx.fillStyle=C.teal;ctx.fill();ctx.stroke();}
    else drawLeaf(0,-5,8,.2,C.card);ctx.restore();}

  const pattern=earnedPattern(badges);if(pattern){ctx.save();ctx.strokeStyle=C.ink;ctx.lineWidth=1.8;ctx.globalAlpha=.8;
    for(const x of [-20,0,20]){ctx.beginPath();if(pattern==='water'){ctx.moveTo(x-5,36);ctx.quadraticCurveTo(x,29,x+5,36);ctx.quadraticCurveTo(x+9,43,x+13,36);}else if(pattern==='leaf'){ctx.ellipse(x,34,4,8,.6,0,Math.PI*2);}else if(pattern==='season'){ctx.arc(x,35,6,0,Math.PI*2);}else if(pattern==='garden'){ctx.moveTo(x-6,40);ctx.lineTo(x,29);ctx.lineTo(x+6,40);ctx.closePath();}else ctx.ellipse(x,35,3,5,-.4,0,Math.PI*2);ctx.stroke();}ctx.restore();}
  if(p.brokenUntil>Date.now()){ctx.strokeStyle=C.ink;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-4,10);ctx.lineTo(9,24);ctx.lineTo(-1,35);ctx.lineTo(12,49);ctx.moveTo(9,24);ctx.lineTo(28,23);ctx.stroke();}
  if (p.crop) {
    ctx.save();ctx.translate(0,10);ctx.rotate(motion?.kind==='water'?m.tilt:0);ctx.scale(m.scale,m.scale);ctx.translate(0,-10);
    // Soil contact shadow makes the stem visibly grow from this pot, not float above it.
    ctx.save(); ctx.fillStyle = C.hair;
    ctx.beginPath(); ctx.ellipse(0, 15, 15, 4, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
    const variant = p.crop.variant ?? 'common';
    if (variant === 'golden') {
      drawSparkle(-31,-58,7,C.ochre);drawSparkle(32,-38,5,C.ochre);
    } else if (variant === 'lush') {
      drawLeaf(-18,-32,13,-1.1,C.teal);
    }
    const cropImage = (p.stage ?? 0) >= 2 ? gardenArt(CROP_ART[p.crop.type]?.[variant] ?? CROP_ART[p.crop.type]?.common) : null;
    if (cropImage) {
      ctx.save(); if(p.stage===4)ctx.globalAlpha=.65;
      const h=(p.stage===2?76:98)*(variant==='lush'?1.05:1);ctx.drawImage(cropImage,-h/2,15-h,h,h);ctx.restore();
    }
    else {
      ctx.save(); ctx.translate(0, 5); drawRipeCrop(p.crop.type, p.stage ?? 0); ctx.restore();
      if ((p.stage ?? 0) < 3 && variant === 'lush') {
        drawLeaf(-17,-31,12,-1.05,C.teal); drawLeaf(17,-37,11,.9,C.teal);
      } else if ((p.stage ?? 0) < 3 && variant === 'golden') {
        drawLeaf(-12,-29,11,-.9,C.ochre); drawSparkle(22,-44,6,C.ochre);
      }
    }

    if(p.stage>=2){if(p.crop.type==='rau')drawLeaf(25,-21,12,.9,C.teal);else if(p.crop.type==='huongduong'){ctx.fillStyle=C.ochre;for(const x of [-12,0,12]){ctx.beginPath();ctx.arc(x,-58-Math.abs(x)*.25,2.5,0,Math.PI*2);ctx.fill();}}else{ctx.strokeStyle=C.card;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-12,-43);ctx.lineTo(-12,-30);ctx.moveTo(3,-47);ctx.lineTo(3,-31);ctx.stroke();}}
    if (p.water < .22) {
      ctx.strokeStyle=C.coral;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(-14,5);ctx.lineTo(-5,10);ctx.lineTo(2,5);ctx.lineTo(12,10);ctx.stroke();
    } else if (p.water > .65) {
      ctx.fillStyle=C.teal;ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(-30,4,4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }

    if (p.crop.weeds) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      for (const x of [-28, -17, 22, 31]) {
        ctx.beginPath(); ctx.moveTo(x, 9); ctx.quadraticCurveTo(x - 8, -2, x - 4, -13); ctx.stroke();
        drawLeaf(x - 4, -9, 8, x < 0 ? -.9 : .9, C.teal);
      }
    }
    if (p.crop.fertilized) {
      ctx.globalAlpha = .82;
      drawSparkle(-36, -54, 7, C.ochre); drawSparkle(35, -38, 5, C.ochre);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  const ghost=harvestGhosts.get(p.id);if(ghost&&now-ghost.at<1000&&!reduceMotion){const t=(now-ghost.at)/1000;ctx.save();ctx.globalAlpha=1-t;ctx.translate(0,-t*42);const img=gardenArt(CROP_ART[ghost.crop.type]?.[ghost.crop.variant??'common']);if(img)ctx.drawImage(img,-49,-83,98,98);ctx.restore();}else if(ghost)harvestGhosts.delete(p.id);
  if(motion&&elapsed<1000&&['fertilize','pest-cleared','weed-cleared','harvest'].includes(motion.kind)&&!reduceMotion){const t=elapsed/1000;ctx.save();ctx.globalAlpha=1-t;ctx.fillStyle=motion.kind==='fertilize'?C.ochre:motion.kind==='pest-cleared'?C.coral:C.teal;
    for(let i=0;i<5;i++){const x=(i-2)*13,y=motion.kind==='fertilize'?-62+t*72:-12-t*55;ctx.beginPath();if(motion.kind==='weed-cleared'){ctx.moveTo(x,y);ctx.lineTo(x-7,y-13);ctx.lineTo(x+5,y-8);}else ctx.arc(x,y,3+i%2,0,Math.PI*2);ctx.fill();}ctx.restore();}
  if(motion?.kind==='water'&&elapsed<800){ctx.save();ctx.fillStyle=C.teal;ctx.globalAlpha=1-elapsed/800;for(const x of [-21,0,23]){const y=-48+elapsed/800*55;ctx.beginPath();ctx.moveTo(x,y-7);ctx.quadraticCurveTo(x+9,y+7,x,y+8);ctx.quadraticCurveTo(x-7,y+6,x,y-7);ctx.fill();}ctx.restore();}
  if (p.crop) {
    // Soil-front layer occludes only the lowest crop pixels so the plant reads as emerging from the pot.
    const soilFront = gardenArt(POT_SOIL_FRONT);
    if (soilFront) ctx.drawImage(soilFront, -52, 3, 104, 24);
    else {
      ctx.save(); ctx.fillStyle = C.hair; ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(0, 15, 33, 6, 0, 0, Math.PI); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  if (p.crop?.pest) {
    ctx.beginPath(); ctx.arc(31, -14, 8, 0, Math.PI * 2); ctx.fillStyle = C.coral; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, -18); ctx.lineTo(20, -23); ctx.moveTo(37, -18); ctx.lineTo(41, -23); ctx.stroke();
  }
  if (p.shield) {
    ctx.beginPath(); ctx.moveTo(28, -39); ctx.lineTo(40, -35); ctx.lineTo(37, -23); ctx.quadraticCurveTo(33, -18, 28, -16); ctx.quadraticCurveTo(22, -21, 20, -28); ctx.closePath(); ctx.fillStyle = C.teal; ctx.fill(); ctx.stroke();
  }
  if (p.dog) {
    ctx.beginPath(); ctx.arc(-31, -9, 5, 0, Math.PI * 2); ctx.arc(-39, -18, 4, 0, Math.PI * 2); ctx.arc(-29, -21, 4, 0, Math.PI * 2); ctx.fillStyle = C.coral; ctx.fill(); ctx.stroke();
  }
  if (p.deco?.includes('golden-tree')) {
    ctx.beginPath(); ctx.moveTo(-40, -17); ctx.lineTo(-35, -28); ctx.lineTo(-30, -18); ctx.lineTo(-19, -16); ctx.lineTo(-27, -9); ctx.lineTo(-25, 1); ctx.lineTo(-35, -4); ctx.lineTo(-44, 1); ctx.lineTo(-42, -9); ctx.lineTo(-50, -16); ctx.closePath(); ctx.fillStyle = C.ochre; ctx.fill(); ctx.stroke();
  }
  ctx.restore();

}

function drawPlotLabel(p) {
  if (!p.owner || !p.awake || cam.zoom < .27) return;
  if (focusPlot && cam.zoom >= 1.25) return;
  const at = worldToScreen(plotPos(p, meta), cam, VP), size = 100 * (meta.cfg.potScale ?? 1.4) * cam.zoom;
  const maxW = overviewLabelWidth(meta.cfg, cam.zoom), y = at.y + size * .55;
  const ripe = (p.stage ?? 0) >= 3;
  const event=visualEvent(),boost=event?.kind==='golden'&&ripe?meta.cfg.goldenMult:event?.kind==='merchant'&&p.crop?.type===event.crop?meta.cfg.merchantMult:0;
  const trouble = p.crop?.pest || p.crop?.weeds || (p.crop && p.water < .25);
  ctx.save(); ctx.font = `${cam.zoom < .65 ? 16 : 20}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const name = displayNickname(p.owner.nickname, cam.zoom);
  const label=`${name} · L${p.owner.level}`;
  const w = Math.min(maxW, ctx.measureText(label).width + 20);
  ctx.fillStyle = C.card; ctx.strokeStyle = 'rgba(47,60,68,.22)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(at.x-w/2, y, w, 25, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.fillText(label, at.x, y+10, w-9);
  if(p.crop){
    ctx.fillStyle='#D5DFD7';ctx.fillRect(at.x-w/2+4,y+21,w-8,4);
    ctx.fillStyle=p.crop.pest||p.crop.weeds?C.coral:'#4E9272';ctx.fillRect(at.x-w/2+4,y+21,(w-8)*p.crop.progress,4);
    if(p.growth?.bonusPercent){ctx.font=`bold 17px ${FONT}`;ctx.fillStyle=p.growth.bonusPercent>0?'#32694D':'#A54C38';ctx.fillText(`${p.growth.bonusPercent>0?'+':''}${p.growth.bonusPercent}%`,at.x,at.y+size*.34);}
  }
  if (trouble || ripe || boost) {
    // A small symbol beside the crop leaves both its silhouette and pot body visible.
    ctx.font = `bold 20px ${FONT}`; ctx.fillStyle = trouble ? C.coral : C.ochre;
    ctx.beginPath(); ctx.arc(at.x + size*.46, at.y-size*.34, boost?17:12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.ink; ctx.fillText(trouble ? '!' : boost ? `×${boost}` : '✓', at.x+size*.46, at.y-size*.34+1);
  }
  ctx.restore();
}

function drawProblemOverlay(p,wallNow) {
  const problem=plotProblem(p,wallNow,meta.cfg),previous=problems.get(p.id);
  const presentation=problemPresentation(previous,problem,wallNow);
  if(presentation)problems.set(p.id,presentation);else problems.delete(p.id);
  let feedback=commandFeedback.get(p.id);
  if(feedback&&feedback.until<=wallNow){commandFeedback.delete(p.id);feedback=null;}
  const shown=feedback??(presentation&&presentation.until>wallNow?presentation:null);
  if(!shown)return;
  const focused=focusPlot===p.id&&cam.zoom>=1.25,at=worldToScreen(plotPos(p,meta),cam,VP),scale=(meta.cfg.potScale??1.4)*cam.zoom;
  const width=focused?340:Math.min(166,meta.cfg.potSpacingX*cam.zoom-10),height=focused?126:82;
  const x=at.x-width/2,y=at.y-78*scale;
  const success=feedback?.ok;
  const blockedTitles={broken:'Chậu bị phá',gold:'Thiếu vàng',level:'Chưa đủ cấp','not-ripe':'Cây chưa chín',busy:'Đang có cây','no-crop':'Chậu còn trống',cooldown:'Đang chờ','no-pest':'Không có sâu','no-weeds':'Không có cỏ'};
  const title=feedback?(success?'Đã thực hiện':blockedTitles[feedback.reason]??'Chưa thể làm'):shown.title;
  const wait=feedback?Math.ceil((feedback.retryAfterMs-(wallNow-feedback.at))/1000):0;
  const waiting=feedback&&['cooldown','broken'].includes(feedback.reason)&&wait>0;
  const command=feedback?(waiting?`Đợi ${wait}s`:feedback.reason==='cooldown'?'Thử lại được rồi':feedbackCommand(feedback)):shown.command;
  ctx.save();ctx.fillStyle=success?'rgba(222,244,220,.96)':'rgba(255,234,207,.96)';ctx.strokeStyle=success?'#4E9272':C.coral;ctx.lineWidth=focused?4:2;
  ctx.beginPath();ctx.roundRect(x,y,width,height,focused?18:10);ctx.fill();ctx.stroke();
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=C.ink;
  ctx.font=`${focused?29:17}px ${FONT}`;ctx.fillText(title,at.x,y+height*.25,width-12);
  ctx.font=`bold ${focused?38:23}px ${FONT}`;ctx.fillText(feedback?.reason==='cooldown'||waiting?command:command?`Gõ “${command}”`:shown.key==='broken'?'Đợi rồi gieo rau':'Tự hết sau 20s',at.x,y+height*.59,width-10);
  const remaining=Math.max(0,Math.min(1,(shown.until-wallNow)/(feedback?(feedback.ok?3200:4500):4000)));
  ctx.fillStyle=success?'#4E9272':C.coral;ctx.fillRect(x+10,y+height-9,(width-20)*remaining,4);
  ctx.restore();
}

function renderGuides(wallNow) {
  const awake=[...plots.values()].filter(p=>p.owner&&p.awake),ripe=awake.filter(p=>p.stage>=3).length;
  const current=bossState?.phase==='active'?['Cứu vườn','thả tim','Đồng hồ vườn tạm dừng · quà lớn đánh boss']:sessionInfo?.phase==='awards'?['Vinh danh Top 5','sắp mở vườn','Giữ LV, XP và thành tựu · đợi phiên mới']:!awake.length?GUIDES[0]:ripe?['Đã có cây chín','hái',`${ripe} cây sẵn sàng · hái nhận vàng + XP, rồi “trồng” vụ mới`]:['Cùng chăm vườn','chăm','Tự bắt sâu → nhổ cỏ → tưới · người mới chỉ cần gõ “trồng”'];
  const key=current.join('|');if(key!==lastGuide){lastGuide=key;guideStep.textContent=current[0];guideCommand.textContent=current[1];guideText.textContent=current[2];}

  const seconds=sessionInfo?.phase==='awards'?Math.max(0,Math.ceil((sessionInfo.awardsUntil-wallNow)/1000)):sessionInfo?Math.max(0,Math.ceil(((sessionInfo.endsAt??sessionInfo.startedAt+(meta.cfg.sessionMs??600000))-(sessionInfo.pausedAt??wallNow))/1000)):0;
  const clock=sessionInfo?.phase==='awards'?`Trao giải · ${seconds}s`:sessionInfo?`${sessionInfo.pausedAt!=null?'Tạm dừng · ':''}P${sessionInfo.no} · ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:'Chờ chơi';
  if(clock!==lastSessionClock){lastSessionClock=clock;sessionLabel.textContent=clock;}
}

function drawDot(p) {
  if (!p.owner || !p.awake) return;
  const at = worldToScreen(plotPos(p, meta), cam, VP), r = Math.max(4, 47 * cam.zoom);
  ctx.beginPath(); ctx.ellipse(at.x, at.y, r * 1.08, r * .84, -.08, 0, Math.PI * 2);
  ctx.fillStyle = !p.crop ? C.paper : p.stage >= 3 ? (p.crop.type === 'nammay' ? C.coral : C.ochre) : C.teal;
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1.5, 5 * cam.zoom); ctx.globalAlpha = p.awake ? 1 : .52; ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
}

function drawSparkle(x, y, r, color = C.ochre) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r * .15, y - r * .16, x + r, y); ctx.quadraticCurveTo(x + r * .12, y + r * .13, x, y + r); ctx.quadraticCurveTo(x - r * .12, y + r * .12, x - r, y); ctx.quadraticCurveTo(x - r * .1, y - r * .12, x, y - r); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

function drawAtmosphere(now, activeTierIds) {
  const cfg = meta.cfg, t = reduceMotion ? 0 : now;

  meta.tiers.forEach((tier, i) => {
    if (!activeTierIds.has(tier.id)) return;
    const y = i * cfg.tierHeight + cfg.tierHeight / 2, bays = 3;
    for (let bay = 0; bay < bays; bay++) {
      const x = cfg.tierWidth * ((bay + 1) / (bays + 1));
      const at = worldToScreen({ x: x + Math.sin(t / 2600 + bay) * 24, y: y - 250 }, cam, VP);
      ctx.globalAlpha = .28;
      drawSparkle(at.x, at.y, Math.max(3, 10 * cam.zoom), bay % 2 ? C.ochre : C.teal);
      ctx.globalAlpha = 1;
    }
  });

  const shownEvent = visualEvent();
  if (shownEvent?.kind === 'rain') {
    const wash = ctx.createLinearGradient(0, 0, 0, VP.h);
    wash.addColorStop(0, 'rgba(70,119,139,.20)'); wash.addColorStop(1, 'rgba(142,192,185,.08)');
    ctx.fillStyle = wash; ctx.fillRect(0, 0, VP.w, VP.h);
    ctx.strokeStyle = 'rgba(52,79,94,.58)'; ctx.lineWidth = 4;
    for (let i = 0; i < 56; i++) {
      const x = (i * 79 + (t / 13) % 1160) % 1160 - 40, y = (i * 113 + (t / 7) % 2020) % 2020 - 40;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 17, y + 44); ctx.stroke();
    }
  } else if (shownEvent?.kind === 'golden') {
    const g = ctx.createRadialGradient(VP.w / 2, 650, 80, VP.w / 2, 650, 850);
    g.addColorStop(0, 'rgba(242,196,92,.28)'); g.addColorStop(1, 'rgba(242,196,92,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VP.w, VP.h);
    ctx.globalAlpha = .82;
    for (let i = 0; i < 44; i++) drawSparkle((i * 137 + 31 + t / 28) % 1080, (i * 281 + 67 + t / 80) % 1920, 6 + (i % 4) * 3, C.ochre);
    ctx.globalAlpha = 1;
  } else if (shownEvent?.kind === 'pests') {
    ctx.fillStyle = 'rgba(233,122,102,.10)'; ctx.fillRect(0, 0, VP.w, VP.h);
    ctx.save(); ctx.strokeStyle = 'rgba(233,122,102,.72)'; ctx.lineWidth = 18; ctx.setLineDash([34, 22]);
    ctx.beginPath(); ctx.moveTo(18, 360); ctx.lineTo(18, 1720); ctx.moveTo(VP.w - 18, 360); ctx.lineTo(VP.w - 18, 1720); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 30; i++) {
      const x = (i * 173 + 70 + t / 18) % 1160 - 40, y = (i * 257 + 120 + Math.sin(t / 300 + i) * 55) % 1880;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t / 210 + i) * .45);
      ctx.fillStyle = C.coral; ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-12, -18); ctx.moveTo(5, -10); ctx.lineTo(12, -18); ctx.stroke(); ctx.restore();
    }
  } else if (shownEvent?.kind === 'merchant') {
    ctx.fillStyle = 'rgba(242,196,92,.08)'; ctx.fillRect(0, 0, VP.w, VP.h);
    ctx.save(); ctx.strokeStyle = C.coral; ctx.lineWidth = 7; ctx.setLineDash([26, 14]);
    ctx.beginPath(); ctx.moveTo(60, 510); ctx.quadraticCurveTo(540, 610, 1020, 510); ctx.stroke(); ctx.restore();
    ctx.globalAlpha = .86;
    for (let i = 0; i < 26; i++) {
      const x = (i * 191 + 61) % 1080, y = (i * 313 + 93 + t / 44) % 1920;
      drawSparkle(x, y, 8 + (i % 3) * 2, i % 2 ? C.ochre : C.coral);
    }
    ctx.globalAlpha = 1;
  }
}

let lastEventDomAt=0,lastEventDomKey='';
function renderEventHero(now) {
  const e=visualEvent(),key=e?`${e.kind}:${e.phase}:${e.startedAt}`:'none';
  if(key===lastEventDomKey && now-lastEventDomAt<250)return;
  lastEventDomAt=now;lastEventDomKey=key;
  stage.classList.toggle('event-live',Boolean(e));
  eventHero.classList.toggle('on',Boolean(e));
  eventHero.setAttribute('aria-hidden',String(!e));
  if(!e)return;

  const src=EVENT_ART[e.kind]??'';
  if(eventArt.getAttribute('src')!==src)eventArt.setAttribute('src',src);
  eventArt.alt=eventNames[e.kind]??'Sự kiện';
  eventHero.dataset.kind=e.kind;
  eventHeroTitle.textContent=eventNames[e.kind]??e.kind;


  const cropLabel=e.crop&&(meta.crops?.[e.crop]?.label??e.crop);
  const hints={
    rain:'Mưa đã tưới đầy nước · tiếp tục chăm cây',
    pests:`Gõ “bắt sâu” · thắng: +${meta.cfg.stormReward} vàng/người góp sức`,
    merchant:cropLabel?`${cropLabel} ×${meta.cfg.merchantMult} vàng · cây chín? gõ “hái”`:'Chợ đang chọn cây thu mua',
    golden:`Thu hoạch ×${meta.cfg.goldenMult} vàng · gõ “hái”`,
  };
  eventHeroHint.textContent=hints[e.kind]??'';

  const keyMs={rain:'rainMs',pests:'pestStormMs',merchant:'merchantMs',golden:'goldenMs'}[e.kind];
  const duration=Math.max(1,Number(meta.cfg?.[keyMs])||1),remaining=Math.max(0,Number(e.endsAt||0)-Date.now());
  eventTicker.textContent=`${eventNames[e.kind]} · ${Math.ceil(remaining/1000)}s${e.kind==='pests'&&e.total>0?` · ${e.cleared??0}/${Math.ceil(e.total*meta.cfg.stormPass)} ổ`:''}`;
  let progress=Math.max(0,Math.min(1,remaining/duration));
  eventHeroTitle.textContent=`${eventNames[e.kind]} · ${Math.ceil(remaining/1000)}s`;
  eventHero.classList.toggle('urgent',remaining<=5000);
  const active=[...plots.values()].filter(p=>p.owner&&p.awake&&p.crop);
  let metaText=e.kind==='rain'?`${active.filter(p=>p.crop.progress<1).length} cây đang lớn ×${meta.cfg.rainMult}`:`${active.filter(p=>p.crop.progress>=1).length} chậu chín đang chờ thu hoạch`;
  if(e.kind==='pests'&&Number(e.total)>0){
    const cleared=Number(e.cleared)||0;progress=Math.max(0,Math.min(1,cleared/e.total));
    const target = Math.ceil(e.total * meta.cfg.stormPass);
    metaText=`${cleared}/${target} ổ cần cứu · ${Object.keys(e.participants??{}).length} người góp sức`;
    progress=Math.min(1,cleared/Math.max(1,target));
  } else if(e.kind==='pests') {
    metaText=`Không có mục tiêu mới · ${Math.ceil(remaining/1000)}s`;
  } else if(e.kind==='merchant'&&cropLabel) metaText=`${active.filter(p=>p.crop.type===e.crop&&p.crop.progress>=1).length} chậu ${cropLabel} chín sẵn sàng bán`;
  eventHeroMeta.textContent=metaText;
  eventMeterFill.style.width=`${Math.round(progress*100)}%`;
}

function drawFocus(now) {
  if (!focusPlot || now < focusAt || now - focusAt > focusMs) return;
  const plot = plots.get(focusPlot);
  if (!plot) return;
  const at = worldToScreen(plotPos(plot, meta), cam, VP), age = (now - focusAt) / Math.max(1, focusMs);
  const radius = Math.max(80, meta.cfg.plotCell * .9 * cam.zoom) + (reduceMotion ? 0 : Math.sin(now / 130) * 12);
  ctx.save();
  const dim = ctx.createRadialGradient(at.x, at.y, radius * .45, at.x, at.y, radius * 4.2);
  dim.addColorStop(0, 'rgba(47,60,68,0)');
  dim.addColorStop(.45, 'rgba(47,60,68,.04)');
  dim.addColorStop(1, 'rgba(47,60,68,.25)');
  ctx.fillStyle = dim; ctx.fillRect(0, 0, VP.w, VP.h);
  ctx.globalAlpha = Math.max(.3, 1 - age * .58); ctx.strokeStyle = C.ochre; ctx.lineWidth = 12; ctx.shadowColor = C.ochre; ctx.shadowBlur = 30; ctx.setLineDash([20, 10]);
  ctx.beginPath(); ctx.arc(at.x, at.y, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.lineWidth = 4; ctx.strokeStyle = C.card; ctx.beginPath(); ctx.arc(at.x, at.y, radius * .72, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawFloaters(now) {
  if (reduceMotion) return;
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i], age = (now - f.born) / 1400;
    if (age >= 1) { floaters.splice(i, 1); continue; }
    const p = worldToScreen(f, cam, VP), y = p.y - age * 110 * cam.zoom;
    ctx.globalAlpha = 1 - age;
    if (f.kind === 'sparkle') drawSparkle(p.x, y, Math.max(8, 28 * cam.zoom));
    else if (f.kind === 'text') {
      ctx.font = `bold 23px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 5;
      ctx.strokeStyle = C.card; ctx.strokeText(f.text, p.x, y - 30);
      ctx.fillStyle = C.ink; ctx.fillText(f.text, p.x, y - 30);
    }
    else if (f.kind === 'coin') { ctx.beginPath(); ctx.ellipse(p.x, y, 14 * cam.zoom + 4, 18 * cam.zoom + 4, -.12, 0, Math.PI * 2); ctx.fillStyle = C.ochre; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}

let lastFrameAt = 0,diagnosticAt=0,diagnosticFrames=0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!meta) return;
  const moving=now-shotAt<cameraEaseMs+120,eventLive=Boolean(visualEvent())||Boolean(giftPresentation&&now<giftPresentation.until),fps=moving||eventLive?45:floaters.length||plotMotions.size?30:20;
  if(now-lastFrameAt<1000/fps-2)return;
  lastFrameAt=now;
  cam = reduceMotion ? to : easeCamera(from, to, now - shotAt, cameraEaseMs);
  ctx.fillStyle = ({ rain: '#D8EDE8', pests: '#F1E0DA', merchant: '#F4E9D5', golden: '#F6EDCF' })[visualEvent()?.kind] ?? '#E7EFE7';
  ctx.fillRect(0, 0, VP.w, VP.h);
  drawBackdrop(now);

  const active = [...plots.values()].filter(p => p.owner && p.awake);
  const activeTierIds = new Set(active.map(p => p.tier));
  if (!activeTierIds.size) activeTierIds.add(meta.tiers[0].id);
  const close = focusPlot && cam.zoom >= 1.25;
  ctx.save(); if (close) ctx.globalAlpha = .18;
  drawTier(meta.tiers[0], 0, active); ctx.restore();
  drawAtmosphere(now, activeTierIds);

  const { detail, dots } = visiblePlots(active, cam, VP, meta);
  const lod = lodOf(cam.zoom);
  dots.forEach(drawDot);
  drawGiftImpact(now);
  if(lastPresentation?.kind==='impact'&&!reduceMotion){const t=Math.min(1,(now-lastPresentation.startedAt)/650);for(const hit of lastPresentation.impact.destroyed??[]){const target=plots.get(hit.plotId);if(!target)continue;const at=worldToScreen(plotPos(target,meta),cam,VP);ctx.save();ctx.strokeStyle=C.coral;ctx.fillStyle=C.ochre;ctx.lineWidth=5;
    if(t<1){const x=at.x+240*(1-t),y=at.y-500*(1-t);ctx.beginPath();ctx.moveTo(x+50,y-80);ctx.lineTo(x,y);ctx.stroke();ctx.beginPath();ctx.arc(x,y,18,0,Math.PI*2);ctx.fill();ctx.stroke();}
    else{const age=(now-lastPresentation.startedAt-650)/1800;ctx.globalAlpha=Math.max(0,1-age);ctx.beginPath();ctx.ellipse(at.x,at.y-15,45+age*65,20+age*25,0,0,Math.PI*2);ctx.stroke();}ctx.restore();}}

  drawFocus(now);
  const presented = close ? detail.filter(p => p.id === focusPlot) : detail;
  presented.forEach(p => drawPlot(p, lod, now));
  if (!close) drawShelfFronts(active);
  detail.forEach(drawPlotLabel); // Screen-space identity is always above the shelf lip.
  const wallNow=Date.now();
  presented.forEach(p=>drawProblemOverlay(p,wallNow));
  for(const id of problems.keys())if(!plots.get(id)?.awake)problems.delete(id);
  renderGuides(wallNow);
  const idleHint=document.getElementById('idleHint'),quiet=presentation.snapshot();
  const empty=Array.from({length:meta.cfg.activeCapacity},(_,slot)=>slot).find(slot=>![...plots.values()].some(p=>p.slot===slot&&p.owner&&p.awake));
  const idleAllowed=empty!=null&&!quiet.active&&!quiet.primary&&quiet.idleWaitMs===0&&!close&&bossState?.phase!=='active'&&sessionInfo?.phase!=='awards';
  idleHint.hidden=!idleAllowed;
  if(idleAllowed){const at=worldToScreen(plotPos({slot:empty,tier:meta.tiers[0].id},meta),cam,VP),u=active[Math.floor(wallNow/30000)%Math.max(1,active.length)];idleHint.style.left=`${Math.max(18,Math.min(730,at.x-140))}px`;idleHint.style.top=`${Math.max(430,Math.min(1780,at.y-60))}px`;idleHint.textContent=u?`${u.owner.nickname} · ${u.owner.competition?.milestone?.label??'Cùng gieo mây'} · ${u.owner.competition?.milestone?.progress??0}/${u.owner.competition?.milestone?.target??1}`:'Chậu mới đang chờ bạn · gõ “trồng”';}

  drawFloaters(now);
  renderEventHero(now);
  renderGiftHero(now);
  renderMoments(now,wallNow);
  noticeRemaining=noticeTimeLeft(noticeRemaining,lastNoticeAt?now-lastNoticeAt:0,false);
  lastNoticeAt=now;
  if(noticeRemaining===0)feed.replaceChildren();
  stage.classList.toggle('notice-live',feed.children.length>0);
  positionFocusCard(now);
  for(const [id,m] of plotMotions)if(now-m.at>1400||!plots.get(id)?.awake)plotMotions.delete(id);
  diagnosticFrames++;
  if(now-diagnosticAt>=500){
    const blocked=sessionInfo?.phase==='awards'?'Đang trao giải':bossState?.phase==='active'?'Đang đánh boss':focusPlot&&now<focusAt+focusMs?'Đang zoom':'';
    const report={type:'garden-presentation',presentation:presentation.snapshot(),blocked,camera:{reason:shotReason,zoom:cam.zoom,plotId:focusPlot},
      event:serverEvent?{kind:serverEvent.kind,phase:serverEvent.phase,remainingMs:Math.max(0,(serverEvent.endsAt??0)-wallNow)}:null,
      boss:bossState?{phase:bossState.phase,hp:bossState.hp,maxHp:bossState.maxHp,remainingMs:Math.max(0,(bossState.endsAt??0)-wallNow)}:null,
      session:sessionInfo?.phase??null,visibility:document.visibilityState,fps:Math.round(diagnosticFrames*1000/Math.max(1,now-diagnosticAt))};
    if(parent!==window)parent.postMessage(report,location.origin);
    try{sessionStorage.setItem(checkpointKey,JSON.stringify({sessionNo:sessionInfo?.no,queue:presentation.checkpoint()}));}catch{}
    if(now-lastDisplayPost>=1000){lastDisplayPost=now;const q=report.presentation;
      fetch('/api/display-status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,role:displayRole,build:meta.build,audio:gardenAudio.status(),scene:q.active,queues:{pendingCount:q.pendingCount,primary:q.primary,secondary:q.secondary,pending:q.pending},idle:{waitMs:Math.ceil(q.idleWaitMs),primary:q.primary+(q.active&&q.active.kind!=='profile'?1:0),blocked:Boolean(blocked)},fps:report.fps,visibility:document.visibilityState,camera:report.camera})}).then(r=>r.json()).then(data=>{for(const c of data.result?.commands??[]){if(c.type==='stop')gardenAudio.stop();if(c.type==='mute')gardenAudio.mute(c.on);if(c.type==='levels')gardenAudio.setLevels(c.levels??{});if(c.type==='warmup')gardenAudio.warmup().catch(()=>{});if(c.type==='cue')gardenAudio.cue({role:c.role,sampleId:c.sampleId,eventId:`audition:${c.at}`,phase:'audition',audition:true});}}).catch(()=>{});
    }
    diagnosticAt=now;diagnosticFrames=0;
  }
}
requestAnimationFrame(frame);
connect();
refreshStatus();
setInterval(refreshStatus, 8000);
