import test from 'node:test';
import assert from 'node:assert/strict';
import * as view from '../public/garden/view.js';
import fs from 'node:fs';
const { lodOf, easeCamera, visiblePlots, worldToScreen, plotPos, createAvatarCache } = view;
import { gardenConfig } from './config.mjs';
import { TIERS, plotCenter } from './world.mjs';

const cfg = gardenConfig();
const meta = { tiers: TIERS, cfg };
const VP = { w: 1080, h: 1920 };

test('every close-up explains its trigger and overview clears the reason',()=>{
 for(const kind of ['steal','catch','levelup'])assert.match(view.cameraReason({kind}),/^Cận cảnh · .+/);
 for(const eventKind of ['rain','pests','merchant','golden'])assert.match(view.cameraReason({kind:'event-focus',eventKind}),/^Cận cảnh · .+/);
 assert.equal(view.cameraReason({kind:'overview'}),'');
 for(const kind of ['ripe','harvest'])assert.equal(view.cameraReason({kind}),'');
});

test('crop and soil SVGs use the channel palette and handmade flat artwork',()=>{
 const palette=new Set(['#F6F0E6','#FFFDF9','#2F3C44','#5C6B75','#4B5B61','#F1C6A0','#D0C1B3','#8EC0B9','#E97A66','#F2C45C','#435064']);
 const dir=new URL('../public/garden/assets/',import.meta.url);
 for(const file of fs.readdirSync(dir).filter(f=>f.startsWith('crop-')||f==='pot-soil-front.svg')){
  const svg=fs.readFileSync(new URL(file,dir),'utf8');
  for(const color of svg.match(/#[0-9a-f]{6}/gi)??[])assert.ok(palette.has(color.toUpperCase()),`${file}: ${color}`);
  assert.doesNotMatch(svg,/<(?:filter|linearGradient|radialGradient|text)\b/);
  assert.match(svg,/human-stroke-v2/);
 }
});

test('a notice keeps its reading time while gifts or events occupy its dock',()=>{
 assert.equal(view.noticeTimeLeft(7000,10000,true),7000);
 assert.equal(view.noticeTimeLeft(7000,250,false),6750);
 assert.equal(view.noticeTimeLeft(7000,10000,false),6750,'a stalled tab does not discard a result');
 assert.equal(view.noticeTimeLeft(100,250,false),0);
});

test('gift copy describes measured impact instead of promising growth on a ripe garden',()=>{
 assert.match(view.giftImpactText({giftKind:'rain',affected:12}),/12 cây/);
 assert.match(view.giftImpactText({giftKind:'star',affected:1,effects:[{from:.55,to:1}]}),/45%/);
 assert.match(view.giftImpactText({giftKind:'dew',affected:1,effects:[{from:1,to:1}]}),/đủ nước/);
 assert.doesNotMatch(view.giftImpactText({giftKind:'rain',affected:0}),/lên|nâng/);
});

test('zoom callout stays next to the whole plant, within the frame on either side',()=>{
 for(const x of [250,370,730,830]){
  const bounds={left:x-155,right:x+155,top:650,bottom:1160};
  const card=view.focusCardPlacement(bounds,{w:350,h:280},VP);
  assert.ok(card.x>=24 && card.x+350<=1056);
  assert.ok(card.y>=340 && card.y+280<=1760);
  assert.ok(card.x>=bounds.right+24 || card.x+350<=bounds.left-24,'card never covers plant');
 }
});

test('lodOf: dots when zoomed out, plots in the middle, close-up when zoomed in', () => {
  assert.deepEqual([0.2, 0.26, 0.27, 0.4, 1.24, 1.25, 2.5].map(z => lodOf(z)), ['dot', 'dot', 'plot', 'plot', 'plot', 'close', 'close']);
});

test('plotPos agrees with the Seed Zone module layout', () => {
  for (const slot of [0, 5, 6, 23, 24, 47, 48, 95]) assert.deepEqual(plotPos({ tier:'cloud-1', slot }, meta), plotCenter('cloud-1', slot, cfg));
});

test('easeCamera starts at from, ends exactly at to, and passes between', () => {
  const from = { x: 0, y: 0, zoom: 0.3 }, to = { x: 1000, y: 2000, zoom: 2.5 };
  assert.deepEqual(easeCamera(from, to, 0, 600), from);
  assert.deepEqual(easeCamera(from, to, 600, 600), to);
  assert.deepEqual(easeCamera(from, to, 9999, 600), to);
  const mid = easeCamera(from, to, 300, 600);
  assert.ok(mid.x > 0 && mid.x < 1000 && mid.zoom > 0.3 && mid.zoom < 2.5);
  assert.ok(Math.abs(mid.zoom - Math.sqrt(0.3 * 2.5)) < 1e-9, 'zoom eases in log space, so the midpoint is the geometric mean');
});

test('worldToScreen puts the camera centre in the middle of the frame', () => {
  assert.deepEqual(worldToScreen({ x: 500, y: 700 }, { x: 500, y: 700, zoom: 2 }, VP), { x: 540, y: 960 });
  assert.deepEqual(worldToScreen({ x: 510, y: 700 }, { x: 500, y: 700, zoom: 2 }, VP), { x: 560, y: 960 });
});

const owned = (tier, slot, awake = true) => ({ id: `${tier}:${slot}`, tier, slot, owner: { userId: `${tier}${slot}` }, awake });

test('far overview uses dots; normal overview keeps crops readable', () => {
  const plots = [owned('cloud-1', 0), owned('cloud-1', 24), owned('cloud-1', 24)];
  const far = visiblePlots(plots, { x: 1800, y: 2400, zoom: 0.26 }, VP, meta);
  assert.deepEqual([far.detail.length, far.dots.length], [0, 3]);
  const readable = visiblePlots([plots[0]], { x: plotPos(plots[0], meta).x, y: plotPos(plots[0], meta).y, zoom: 0.38 }, VP, meta);
  assert.equal(readable.detail.length, 1);
});

test('at close rack zoom only plots inside the frame are drawn in detail', () => {
  const near = owned('cloud-1', 0), far = owned('cloud-1', 47);
  const c = plotPos(near, meta);
  const v = visiblePlots([near, far], { x: c.x, y: c.y, zoom: cfg.camera.zoomTier }, VP, meta);
  assert.deepEqual(v.detail.map(p => p.id), ['cloud-1:0']);
  assert.equal(v.dots.length, 0, 'off-screen plots are not drawn at all');
});

test('detail rendering is capped for the intended sub-100 room', () => {
  const plots = [];
  for (let s = 0; s < 48; s++) plots.push(owned('cloud-1', s, true));
  const c = { x: cfg.tierWidth / 2, y: cfg.tierHeight / 2, zoom: 0.38 };
  const v = visiblePlots(plots, c, VP, meta, 3000, 20);
  assert.equal(v.detail.length, 20);
  assert.equal(v.dots.length, 28);
  assert.ok(v.detail.every(p => p.awake));
});

test('the avatar cache starts loading on first ask, hands the image back once loaded, and forgets the oldest', () => {
  const made = [];
  const cache = createAvatarCache(2, url => { const img = { url, complete: false, naturalWidth: 0 }; made.push(img); return img; });
  assert.equal(cache.get('a'), null);
  made[0].complete = true; made[0].naturalWidth = 10;
  assert.equal(cache.get('a'), made[0]);
  cache.get('b'); cache.get('c');
  cache.get('a');
  assert.equal(made.length, 4, 'a was evicted when c arrived and had to be created again');
  assert.equal(cache.get(''), null);
});


test('sleeping plots are excluded entirely from rendering', () => {
  const awake = owned('cloud-1', 0, true), sleeping = owned('cloud-1', 1, false);
  const c = plotPos(awake, meta);
  const v = visiblePlots([awake, sleeping], { x: c.x, y: c.y, zoom: .5 }, VP, meta);
  assert.deepEqual(v.detail.map(p => p.id), [awake.id]);
  assert.equal(v.dots.length, 0);
});

test('logical row seven wraps to a right visual wing at the same vertical shelf', () => {
  const left = plotPos(owned('cloud-1', 0), meta);
  const right = plotPos(owned('cloud-1', 21), meta);
  assert.ok(right.x - left.x > cfg.potSpacingX * (cfg.potsPerShelf - 1));
  assert.equal(right.y, left.y);
});

test('overview care labels prioritize trouble, then ripe crops, then water and growth',()=>{
 const p={crop:{pest:true,weeds:true,progress:.5},stage:3,water:.1};
 assert.equal(view.careLabel(p),'Bắt sâu');p.crop.pest=false;
 assert.equal(view.careLabel(p),'Nhổ cỏ');p.crop.weeds=false;
 assert.equal(view.careLabel(p),'Hái ngay');p.stage=2;
 assert.equal(view.careLabel(p),'Cần tưới');p.water=1;
 assert.equal(view.careLabel(p),'50% lớn');p.crop=null;
 assert.equal(view.careLabel(p),'Gieo hạt');
});

test('overview identity is an adaptive nickname and never a public slot code', () => {
  assert.equal(typeof view.displayNickname, 'function');
  assert.equal(view.displayNickname('Nguyễn Minh Anh', .5), 'Nguyễn…');
  assert.equal(view.displayNickname('Nguyễn Minh Anh', .82), 'Nguyễn Min…');
  assert.equal(view.displayNickname('Mai', .5), 'Mai');
  assert.equal(view.displayNickname('🌱Vườn Mây', .5).startsWith('🌱'), true);
  assert.equal(view.displayNickname('', .5), 'Người xem');
});

test('overview identity theme follows the earned pot tier',()=>{
 const tiers=['clay','glazed','banded','royal','astral'],themes=tiers.map(view.identityLabelTheme);
 assert.equal(new Set(themes.map(t=>t.accent)).size,tiers.length,'each pot tier gives the name card a distinct accent');
 assert.ok(themes.every(t=>t.fill&&t.levelFill),'each tier supplies a readable card fill and LV badge fill');
 assert.deepEqual(view.identityLabelTheme('unknown'),view.identityLabelTheme('clay'));
});

test('Garden join notices do not expose slot-number identity', () => {
  const source = fs.readFileSync(new URL('../public/garden/garden.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /chậu #|padStart\(3, '0'\)/);
});

test('rackGeometry describes one outer frame containing two separated shelf wings', () => {
  assert.equal(typeof view.rackGeometry, 'function');
  const rack = view.rackGeometry(cfg);
  assert.equal(rack.wings.length, 2);
  assert.ok(rack.wings[0].right < rack.wings[1].left, 'visual wings have a readable center gap');
  assert.ok(rack.outer.left < plotPos(owned('cloud-1', 0), meta).x);
  assert.ok(rack.outer.right > plotPos(owned('cloud-1', 41), meta).x);
  assert.equal(rack.wings[0].top, rack.wings[1].top);
  assert.equal(rack.wings[0].bottom, rack.wings[1].bottom);
  assert.ok(rack.outer.right - rack.outer.left > 850, 'tighter greenhouse frame leaves room for a real center trellis without wasting portrait width');
});

test('dense overview label width always leaves a gap between adjacent pots', () => {
  assert.equal(typeof view.overviewLabelWidth, 'function');
  for (const zoom of [.45, .55, .65, .82]) {
    const width = view.overviewLabelWidth(cfg, zoom);
    assert.ok(width + 6 <= cfg.potSpacingX * zoom, `labels overlap at zoom ${zoom}`);
    assert.ok(width >= 48, 'labels remain large enough to carry a short nickname');
  }
});


test('garden guide follows the most useful room action and phase',()=>{
 const crop=(extra={})=>({owner:{},awake:true,stage:2,water:1,crop:{progress:.5,pest:false,weeds:false,...extra}});
 assert.equal(view.gardenGuide({boss:true,plots:[crop()]})[1],'thả tim');
 assert.equal(view.gardenGuide({awards:true,plots:[crop()]})[0].startsWith('Vinh danh'),true);
 assert.equal(view.gardenGuide({plots:[]})[1],'trồng');
 assert.equal(view.gardenGuide({plots:[{owner:{},awake:true,crop:null}]})[1],'trồng','an awake empty pot returns the loop to planting');
 assert.equal(view.gardenGuide({plots:[{...crop(),stage:3}]})[1],'hái');
 assert.equal(view.gardenGuide({plots:[crop({pest:true})],event:{kind:'pests',phase:'active'}})[1],'chăm');
 assert.equal(view.gardenGuide({plots:[crop({weeds:true})]})[1],'chăm');
 assert.equal(view.gardenGuide({plots:[{...crop(),water:.1}]})[1],'chăm');
});

test('idle hint chooses an empty slot close to the active room instead of always slot zero',()=>{
 const plots=[{slot:10,owner:{},awake:true},{slot:11,owner:{},awake:true}];
 const point=slot=>({x:slot*100,y:0});
 assert.equal(view.chooseIdleSlot(16,plots,point),9);
 assert.equal(view.chooseIdleSlot(2,[{slot:0,owner:{},awake:true},{slot:1,owner:{},awake:true}],point),null);
 assert.equal(view.chooseIdleSlot(4,[],point),0);
});

test('500 and 1000 coin destruction use distinct motion while reduced motion keeps result only',()=>{
 const meteor=view.impactMotion('meteor',325),quake=view.impactMotion('cataclysm',450);
 assert.equal(meteor.kind,'meteor');assert.equal(quake.kind,'quake');
 assert.equal(meteor.progress,.5);assert.equal(quake.progress,.5);
 assert.notEqual(quake.shake,undefined);
 assert.deepEqual(view.impactMotion('cataclysm',100,true),{kind:'result',progress:1,shake:0});
});

test('routine cooldown and idle states stay out of overview cards, while actionable problems remain visible',()=>{
 assert.equal(view.plotOverlayMode({feedback:{reason:'cooldown'},shown:{}}),'hidden');
 assert.equal(view.plotOverlayMode({feedback:{reason:'busy'},shown:{}}),'hidden');
 assert.equal(view.plotOverlayMode({shown:{key:'idle'}}),'hidden');
 assert.equal(view.plotOverlayMode({feedback:{reason:'gold'},shown:{}}),'card');
 assert.equal(view.plotOverlayMode({shown:{key:'pest'}}),'card');
 assert.equal(view.plotOverlayMode({focused:true,feedback:{reason:'cooldown'},shown:{}}),'card');
});

test('growth buffs expose one strong visual state without showing badges in dense overview',()=>{
 const now=10_000,p={crop:{},stage:2,growth:{bonusPercent:48,waterBoostUntil:20_000,speedUntil:0,fertilized:true}};
 let buff=view.growthBuffPresentation(p,now,.8);
 assert.deepEqual(buff.sources,['water','fertilizer']);
 assert.equal(buff.primary,'water');assert.equal(buff.bonusPercent,48);assert.equal(buff.mode,'aura');assert.equal(buff.showBadge,false,'overview keeps aura but drops persistent text badges');
 buff=view.growthBuffPresentation({...p,growth:{...p.growth,speedUntil:20_000}},now,.9,48);
 assert.equal(buff.primary,'speed');assert.equal(buff.mode,'rim');assert.equal(buff.showBadge,false,'dense rooms collapse buff to the pot rim and drop text');
 assert.equal(view.growthBuffPresentation(p,now,1.4).showBadge,true,'close focus may show the numeric buff');
 assert.equal(view.growthBuffPresentation({...p,stage:3},now,.8),null,'ripe crops do not advertise growth buffs');
 assert.equal(view.growthBuffPresentation({...p,growth:{bonusPercent:0,waterBoostUntil:0,speedUntil:0,fertilized:false}},now,.8),null);
});
