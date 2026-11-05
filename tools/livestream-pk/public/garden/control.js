import { cameraReason } from './view.js';
import {createViewerAvatar} from './identity.js';
const $ = id => document.getElementById(id);
let simulator = false, cameraLocked = false, source, players=[],gifting=false;
let lastPreviewAt=0;
const sceneName=kind=>({gift:'Quà tăng trưởng',roulette:'Vòng quay',impact:'Kỹ năng quà',profile:'Hồ sơ gọn',overview:'Toàn cảnh',event:'Mở sự kiện',boss:'Boss',session:'Trao giải','event-focus':'Zoom sự kiện',levelup:'Zoom lên cấp',steal:'Zoom trộm',catch:'Zoom bắt trộm'})[kind]??kind??'Chờ';
const eventName=kind=>({rain:'Mưa tưới',pests:'Bão sâu',merchant:'Thương lái',golden:'Giờ vàng'})[kind]??kind;
const sceneText=p=>`${sceneName(p.kind)}${p.nickname?` · ${p.nickname}`:''}${p.total?` · ${p.total} xu`:''}`;
addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==$('preview').contentWindow||event.data?.type!=='garden-presentation')return;
 const d=event.data,q=d.presentation;if(!q)return;lastPreviewAt=Date.now();
 $('previewConnection').textContent=`Preview trực tiếp · ${d.fps} FPS${d.visibility==='hidden'?' · tab ẩn':''}`;
 $('playingScene').textContent=q.active?`${sceneText(q.active)} · còn ${(q.active.remainingMs/1000).toFixed(1)}s`:d.camera.reason||'Toàn cảnh · không có cảnh quà đang phát';
 const effect=q.active?.effect;
 $('activeMechanics').textContent=[effect?effect.target?`${effect.label} → ${effect.target}`:effect.mode==='boss'?`${effect.label} · −${effect.damage} HP boss`:`${effect.label} · phá ${effect.destroyed} cây`:null,d.boss?.phase==='active'?`Boss ${d.boss.hp}/${d.boss.maxHp} HP · ${Math.ceil(d.boss.remainingMs/1000)}s`:null,d.event?`${eventName(d.event.kind)} · ${d.event.phase==='active'?'đang chạy':'chuẩn bị'} · ${Math.ceil(d.event.remainingMs/1000)}s`:null,d.session==='awards'?'Đang trao giải':null].filter(Boolean).join(' / ')||'Chăm cây bình thường';
 $('secondaryGate').textContent=d.blocked||q.active&&q.active.kind!=='profile'?'Đang bận · '+(d.blocked||sceneName(q.active.kind)):q.idleWaitMs>0?`Chờ rảnh thêm ${(q.idleWaitMs/1000).toFixed(1)}s`:'Đã đủ 6s rảnh · có thể chạy tác vụ phụ';
 $('queueCounts').textContent=`Đang chờ: ${q.primary} chính · ${q.secondary} phụ${q.pendingCount>8?' · hiển thị 8 mục đầu':''}`;
 $('presentationQueue').replaceChildren(...(q.pending.length?q.pending.map(p=>{const li=document.createElement('li');li.textContent=`${sceneText(p)} · ưu tiên ${p.priority} · đợi ${(p.ageMs/1000).toFixed(1)}s`;return li;}):[Object.assign(document.createElement('li'),{textContent:'Hàng đợi preview đang trống'})]));
});
setInterval(()=>{if(Date.now()-lastPreviewAt>2500)$('previewConnection').textContent='Chưa nhận dữ liệu preview · mở hoặc tải lại khung';},1000);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const reasonText = {
  cooldown: 'Thao tác đang có thời gian chờ.', 'no-target': 'Không tìm thấy đúng một người khớp tên đó.', 'no-room': 'Vườn đã hết ô có thể dùng.',
  busy: 'Ô của bạn đang có cây.', level: 'Cần lên cấp thêm để mở loại hạt này.', gold: 'Chưa đủ vàng.', 'no-crop': 'Ô của bạn chưa có cây.', 'not-ripe': 'Cây chưa chín.',
  'no-pest': 'Ô của bạn hiện không có sâu.', banned: 'Tạm khóa trộm sau lần bị bắt.', self: 'Không thể trộm cây của mình.', asleep: 'Ô này đang nghỉ.', dog: 'Chó đang canh vườn.',
  shield: 'Ô đang được bảo vệ.', cap: 'Đã đạt giới hạn trộm.', 'no-thief': 'Chưa có lượt trộm nào để bắt.', active: 'Chó đang canh rồi.', 'no-plot': 'Người chơi chưa có ô đất.',
};

function slug(text) {
  return String(text || 'người xem').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 48) || 'nguoi-xem';
}
function person() { const nickname = $('nickname').value.trim() || 'Người xem',existing=players.find(p=>p.nickname===nickname); return { userId: existing?.userId?.replace(/^sim:/,'')??slug(nickname), nickname }; }
async function request(route, body, method = 'POST') {
  const r = await fetch(`/api/${route}`, { method, ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) } : {}) });
  const data = await r.json();
  if (!r.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${r.status}`);
  return method === 'GET' ? data : data.result;
}
function resultText(result, action) {
  if (!result?.ok) return result?.message ?? reasonText[result?.reason] ?? 'Lệnh chưa thực hiện được.';
  const message = result.message ?? ({ chat: 'Đã nhận bình luận.', plant: 'Đã gieo hạt.', water: 'Đã tưới cây.', pest: 'Đã xử lý sâu.', harvest: `Đã thu hoạch · +${result.gold ?? 0} vàng.`, steal: `Trộm thành công · +${result.amount ?? 0} vàng.`, catch: 'Đã bắt người vừa trộm.', dog: result.free ? 'Chó ra canh miễn phí.' : 'Chó ra canh vườn.', card: 'Đã gửi thẻ vườn lên overlay.' })[action] ?? 'Đã gửi vào Garden.';
  const score = result.competition ? ` · ${result.competition.points} điểm phiên${result.competition.rank ? ` · hạng ${result.competition.rank}` : ''}` : '';
  const profile = result.competition ? ` · mốc tiếp: ${result.competition.milestone.label} ${result.competition.milestone.progress}/${result.competition.milestone.target}${result.competition.titles.length ? ` · ${result.competition.titles[0].label}` : ''}` : '';
  return `${result.joined ? 'Đã vào vườn và nhận ô đất. ' : ''}${message}${score}${profile}`;
}

function log(message, kind = '') {
  const feed = $('feed');
  feed.querySelector('.empty')?.remove();
  const li = document.createElement('li'), time = document.createElement('time'), text = document.createElement('span');
  time.textContent = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  text.textContent = message;
  if (kind) li.dataset.kind = kind;
  li.append(time, text); feed.prepend(li);
  while (feed.children.length > 35) feed.lastElementChild.remove();
}

function describeFx(fx) {
  const who = fx.names?.join(', ') || fx.nickname || 'Người xem';
  if (fx.type === 'joined') return `${fx.count > 1 ? `${fx.count} người vừa vào` : `${who} vừa vào`} · ${fx.tier}`;
  if(fx.type==='boss-start')return `Sâu Chúa xuất hiện · ${fx.maxHp} HP · thả tim để đánh`;
  if(fx.type==='boss-hit')return `Cả phòng đánh boss −${fx.damage} HP`;
  if(fx.type==='boss-end')return fx.won?`Thắng boss · ${fx.contributors} người nhận +${fx.xp} XP, +${fx.gold} vàng`:'Hết giờ · Sâu Chúa đã trốn';
  if(fx.impact)return `${fx.nickname} dùng ${fx.impact.label} · ${fx.impact.mode==='boss'?`−${fx.impact.damage} HP boss`:`phá ${fx.impact.destroyed.length} cây`}`;
  if(fx.type==='session-end')return `Trao giải phiên ${fx.no} · ${(fx.podium??[]).map(p=>`${p.nickname} +${p.rewardXp} XP`).join(' / ')} · vườn mới sau 8s`;
  if(fx.type==='round-start')return `Phiên ${fx.no} bắt đầu · vườn sạch · giữ LV, XP và huy hiệu`;
  if(fx.type==='action-feedback')return `${fx.nickname??'Người xem'} · ${fx.message}`;
  if(fx.roulette)return `${fx.nickname} quay được ${fx.roulette.label} → ${fx.roulette.targetName}`;
  if (fx.type === 'gift') return `${fx.nickname ?? 'Người xem'} gửi quà: ${fx.tier} (${fx.total} xu)`;
  if (fx.type === 'event-start') return `Bắt đầu sự kiện: ${fx.kind}`;
  if (fx.type === 'event-end') return `Kết thúc sự kiện: ${fx.kind}`;
  if (fx.type === 'plant') return `${fx.count>1?`${fx.count} người`:who} vừa gieo hạt${fx.crop?` (${fx.crop})`:''}`;
  if (fx.type === 'harvest') return `${who} vừa thu hoạch · +${fx.gold??fx.plots?.reduce((sum,p)=>sum+(p.gold??0),0)??0} vàng`;
  if (fx.type === 'ripe') return `Một cây đã chín (${fx.crop})`;
  if (fx.type === 'levelup') return `${who} lên cấp ${fx.level}`;
  if (fx.type === 'steal') return 'Có lượt trộm cây';
  if (fx.type === 'catch') return 'Bắt được người vừa trộm';
  if (['water', 'help', 'pest-cleared'].includes(fx.type)) return `${fx.count ?? 1} lượt ${fx.type}`;
  return fx.type;
}

function renderStatus(s) {
  dispatchEvent(new CustomEvent('garden-status',{detail:s}));
  simulator = Boolean(s.simulator);
  $('presentationMonitor').hidden=false;
  $('cameraBackend').textContent=s.diagnosticsVersion?`${sceneName(s.camera.current)} · ${s.camera.pending} cảnh chờ · ${s.camera.locked?'đang khóa':'tự động'}${s.camera.idleWaitMs?` · chờ rảnh ${Math.ceil(s.camera.idleWaitMs/1000)}s`:''}`:'Server đang chạy chưa có dữ liệu chẩn đoán mới · cần khởi động lại simulator';
  $('cameraQueue').replaceChildren(...(s.camera.queue??[]).map(p=>{const li=document.createElement('li');li.textContent=`${sceneText(p)}${p.eventKind?' · '+eventName(p.eventKind):''} · ưu tiên ${p.priority} · đợi ${Math.round(p.ageMs/1000)}s`;return li;}));
  players=s.players??[];
  $('viewerNames').replaceChildren(...players.map(p=>Object.assign(document.createElement('option'),{value:p.nickname,label:`LV${p.level}`})));
  $('mode').textContent = simulator ? 'Simulator riêng' : 'Garden thường';
  $('mode').className = `badge ${simulator ? '' : 'live'}`;
  $('modeNotice').textContent = simulator
    ? 'Dữ liệu mô phỏng tách riêng, không kết nối TikTok và không ghi vào save Garden thật.'
    : 'Dữ liệu đang ghi vào Garden thật. Muốn thử tương tác, dừng server này rồi chạy npm run garden:sim trên cùng cổng 4858.';
  $('viewers').textContent = s.viewers;
  $('planted').textContent = s.planted;
  $('ripe').textContent = s.ripe;
  const reason=cameraReason({kind:s.camera.current,eventKind:s.camera.eventKind});
  $('activity').textContent = `${s.boss?.phase==='active'?`Sâu Chúa · ${s.boss.hp} HP`:s.event ?? 'Không sự kiện'} · ${reason||'Toàn cảnh'}${reason?` · ${Math.ceil(s.camera.remainingMs/1000)}s`:''} · chờ ${s.camera.pending}${s.camera.pending&&s.camera.idleWaitMs?` · nghỉ ${Math.ceil(s.camera.idleWaitMs/1000)}s`:''}`;
  cameraLocked = Boolean(s.camera.locked);
  $('cameraLock').textContent = cameraLocked ? 'Mở khóa camera' : 'Khóa camera';
  const auto = s.autoplay ?? { running:false,bots:0,profile:'normal' };
  $('autoStatus').textContent = auto.bots ? `${auto.bots} bot · ${auto.profile ?? 'normal'} · ${auto.running ? 'đang tự chơi' : 'đang dừng'}` : 'Chưa có bot';
  if ($('autoProfile') && auto.profile) $('autoProfile').value = auto.profile;
  $('autoLamp').classList.toggle('on', Boolean(auto.running));
  $('autoStart').disabled = !simulator || Boolean(auto.running);
  $('autoStop').disabled = !simulator || !auto.running;
  $('connection').textContent = simulator ? 'Simulator sẵn sàng' : 'Control host sẵn sàng';
  $('connection').className = 'pill good';
  for (const button of document.querySelectorAll('[data-sim-only]')) button.disabled = !simulator || (button.id === 'runDemo' && demoRunning);
  $('autoStart').disabled = !simulator || Boolean(auto.running);
  $('autoStop').disabled = !simulator || !auto.running;
  const competition = s.competition ?? {}, session = competition.session;
  const fighting=s.boss?.phase==='active';
  $('bossStatus').textContent=fighting?`${s.boss.hp}/${s.boss.maxHp} HP · ${Math.max(0,Math.ceil((s.boss.endsAt-Date.now())/1000))}s`:s.boss?.phase==='won'?'Đã thắng boss':s.boss?.phase==='escaped'?'Boss đã trốn':'Chưa có boss';
  $('bossHealth').max=s.boss?.maxHp||1;$('bossHealth').value=s.boss?.hp??0;
  const left=session?Math.max(0,Math.ceil((session.endsAt-(session.pausedAt??Date.now()))/1000)):0;
  $('roundClock').textContent=session?`${session.pausedAt!=null?'Tạm dừng phiên để đánh boss':'Phiên đang chạy'} · còn ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`:'Bình luận “trồng” để mở phiên';
  $('forceBoss').disabled=!simulator||fighting;
  for(const button of document.querySelectorAll('[data-comment]'))button.disabled=!simulator||fighting;
  for(const button of document.querySelectorAll('[data-event]'))button.disabled=fighting;
  for(const button of document.querySelectorAll('[data-gift],#sendGift'))button.disabled=!simulator||gifting;
  $('sessionTitle').textContent = session?.phase==='awards'?`Đang trao giải phiên ${session.no} · chờ vườn mới`:competition.standings?.length ? `Phiên ${session.no}` : session?.previous?.podium?.length ? `Kết quả phiên ${session.previous.no}` : session ? `Phiên ${session.no} · chưa có điểm` : 'Đang chờ khách đầu tiên';
  const rows = competition.standings?.length ? competition.standings.slice(0, 5) : session?.previous?.standings??session?.previous?.podium??[];
  $('finishSession').disabled = fighting || !session || session.phase==='awards' || !competition.standings?.length;
  $('standings').replaceChildren(...(rows.length ? rows.map(row => {
    const item = document.createElement('li'), place = document.createElement('span'), name = document.createElement('span'), points = document.createElement('b');
    place.className = 'rank'; place.textContent = `${row.rank}.`;
    name.className = 'leader-name'; name.textContent = row.nickname;
    points.textContent = `${row.points} điểm`;
    item.append(place,createViewerAvatar(row), name, points);
    if (row.title) { const title = document.createElement('small'); title.textContent = row.title; item.append(title); }
    return item;
  }) : [Object.assign(document.createElement('li'), { className: 'empty', textContent: 'Khách đầu tiên sẽ mở bảng đua.' })]));
  $('tiers').replaceChildren(...s.tiers.map(t => {
    const row = document.createElement('div'), label = document.createElement('span'), count = document.createElement('b');
    row.className = 'tier'; label.textContent = t.label; count.textContent = t.viewers; row.append(label, count); return row;
  }));
}

async function loadStatus() {
  try { renderStatus(await request('status', null, 'GET')); }
  catch (e) { $('connection').textContent = 'Garden mất kết nối'; $('modeNotice').textContent = `Không đọc được trạng thái: ${e.message}`; }
}

async function sendComment(comment) {
  if (!simulator) return;
  comment = String(comment ?? '').trim();
  if (!comment) return;
  const user = person();
  try {
    const result = await request('sim', { kind: 'chat', user, comment });
    $('actionResult').textContent = resultText(result, result?.action);
    log(`${user.nickname}: ${comment}${result?.ok === false ? ` · ${reasonText[result.reason] ?? result.reason}` : ''}`, 'chat');
    $('comment').value = '';
  } catch (e) { $('actionResult').textContent = `Không gửi được: ${e.message}`; }
}

$('chatForm').addEventListener('submit', event => { event.preventDefault(); sendComment($('comment').value); });
document.querySelectorAll('[data-comment]').forEach(button => button.addEventListener('click', () => sendComment(button.dataset.comment)));
async function sendGift(diamonds,count=1) {
  if(!simulator||gifting)return;
  const user = person();gifting=true;
  for(const button of document.querySelectorAll('[data-gift],#sendGift'))button.disabled=true;
  try {
    const result = await request('sim', { kind: 'gift', user, diamonds, count });
    $('actionResult').textContent = result.queued?`Đã nhận ${diamonds*count} xu · đang trao giải, quà sẽ dùng ở phiên mới.`:`${user.nickname} · ${diamonds*count} xu · ${result.roulette?`${result.roulette.label} → ${result.roulette.targetName}`:result.impact?result.impact.mode==='boss'?`Đánh boss −${result.impact.damage} HP`:`Phá ${result.impact.destroyed.length} cây${result.impact.destroyed.length?': '+result.impact.destroyed.map(p=>p.nickname).join(', '):' · hãy tạo đối thủ hoặc đợi khiên hết'}`:({dew:'Giọt sương',star:'Phân sao',rain:'Mưa phép'})[result.tier]??result.tier}`;
    log($('actionResult').textContent,'gift');
  } catch (e) { $('actionResult').textContent = `Không gửi được quà: ${e.message}`; }
  finally{gifting=false;await loadStatus();}
}
$('sendGift').addEventListener('click',()=>sendGift(Number($('diamonds').value),Math.max(1,Math.min(99,Math.floor(Number($('giftCount').value)||1)))));
document.querySelectorAll('[data-gift]').forEach(button=>button.addEventListener('click',()=>sendGift(Number(button.dataset.gift))));
$('prepareTargets').addEventListener('click',async()=>{
 try{
  let ready=0;
  for(let i=1;i<=4;i++){
   const r=await request('sim',{kind:'chat',user:{userId:`test-rival-${i}`,nickname:`Đối thủ ${i}`},comment:'trồng'});
   if(r.ok||r.reason==='busy')ready++;
  }
  $('actionResult').textContent=`${ready}/4 chậu thử đã có cây · bấm 50 / 500 / 1.000 xu để thử quà.${ready<4?' Chậu nứt cần đợi 8s; đang đánh boss thì kết thúc trận trước.':''}`;
  await loadStatus();
 }catch(e){$('actionResult').textContent=`Không tạo được chậu thử: ${e.message}`;}
});
document.querySelectorAll('[data-event]').forEach(button => button.addEventListener('click', async () => {
  try { await request('event', { type: button.dataset.event }); log(`Đã gọi sự kiện ${button.textContent}.`); await loadStatus(); }
  catch (e) { $('actionResult').textContent = `Không gọi được sự kiện: ${e.message}`; }
}));
$('cameraLock').addEventListener('click', async () => {
  try { await request('camera-lock', { on: !cameraLocked }); await loadStatus(); }
  catch (e) { $('actionResult').textContent = `Không điều khiển được camera: ${e.message}`; }
});
async function roomAction(action, rest = {}) {
  if (!simulator) return null;
  const result = await request('sim-room', { action, ...rest });
  await loadStatus();
  return result;
}
$('addBots').addEventListener('click', async () => {
  const count=Math.max(1,Math.min(48,Number($('autoCount').value)||24)),profile=$('autoProfile')?.value??'normal';
  try {
    const result=await roomAction('set',{count,profile});
    $('actionResult').textContent=`Đã đặt phòng thành ${result.bots} người · ${result.profile}.`;
    log(`Simulator đặt quy mô ${result.bots} bot · ${result.profile}.`,'demo');
  } catch(e){$('actionResult').textContent=`Không đặt được phòng: ${e.message}`;}
});
$('autoStart').addEventListener('click', async () => {
  try {
    const result = await roomAction('start', { profile: $('autoProfile')?.value ?? 'normal' });
    $('actionResult').textContent = `Phòng tự chơi đang chạy với ${result.bots} bot.`;
    log(`Bật tự chơi · ${result.bots} bot.`, 'demo');
  } catch (e) { $('actionResult').textContent = `Không bật được tự chơi: ${e.message}`; }
});
$('autoStop').addEventListener('click', async () => {
  try {
    const result = await roomAction('stop');
    $('actionResult').textContent = `Đã dừng tự chơi · giữ nguyên ${result.bots} bot trong vườn.`;
    log('Đã dừng phòng tự chơi.', 'demo');
  } catch (e) { $('actionResult').textContent = `Không dừng được tự chơi: ${e.message}`; }
});
$('finishSession').addEventListener('click', async () => {
  if (!confirm('Chốt phiên và vinh danh Top 5, thưởng XP Top 3 trong 8 giây, sau đó mở vườn mới? Giữ LV, XP và huy hiệu; mỗi người có lại 20 vàng.')) return;
  $('finishSession').disabled = true;
  try {
    const result = await request('session/finish', {});
    if(result?.ok===false){$('finishResult').textContent='Đang đánh boss · phiên tạm dừng, hãy kết thúc trận trước.';await loadStatus();return;}
    $('finishResult').textContent = result?.no ? `Đã chốt phiên ${result.no}: ${result.podium.map(row => `${row.nickname} · ${row.title} · +${row.rewardXp} XP`).join(' / ') || 'chưa có người lên hạng'}. Sau 8 giây mở vườn mới, giữ LV/XP/huy hiệu.` : 'Chưa có phiên LIVE để chốt.';
    await loadStatus();
  } catch (e) { $('finishResult').textContent = `Không chốt được phiên: ${e.message}`; await loadStatus(); }
});
$('clearFeed').addEventListener('click', () => $('feed').replaceChildren(Object.assign(document.createElement('li'), { className: 'empty', textContent: 'Log đã được xóa.' })));
$('reset').addEventListener('click', async () => {
  if (!simulator || !confirm('Xóa toàn bộ dữ liệu riêng của Garden simulator?')) return;
  try { await request('reset', {}); $('feed').replaceChildren(); log('Đã reset dữ liệu simulator.'); await loadStatus(); }
  catch (e) { $('actionResult').textContent = `Không reset được: ${e.message}`; }
});

let demoRunning = false;
$('runDemo').addEventListener('click', async () => {
  if (!simulator || demoRunning) return;
  demoRunning = true; $('runDemo').disabled = true;
  const user = { userId: `demo-${Date.now()}`, nickname: 'Mai' };
  const post = (kind, rest = {}) => request('sim', { kind, user, ...rest });
  try {
    const planted = await post('chat', { comment: 'trồng' });
    if (!planted?.ok) throw new Error(reasonText[planted?.reason] ?? 'Không gieo được cây.');
    for (let i = 0; i < 3; i++) await post('gift', { diamonds: 5, count: 1 });
    await wait(1600);
    const harvested = await post('chat', { comment: 'hái' });
    if (!harvested?.ok) throw new Error(reasonText[harvested?.reason] ?? 'Không thu hoạch được.');
    await request('event', { type: 'golden' });
    $('actionResult').textContent = 'Demo xong: người mới, trồng, quà, cây chín, thu hoạch và giờ vàng.';
    log('Demo hoàn tất: vào vườn → trồng → quà → chín → thu hoạch → giờ vàng.', 'demo');
  } catch (e) { $('actionResult').textContent = `Demo dừng: ${e.message}`; }
  finally { demoRunning = false; $('runDemo').disabled = !simulator; await loadStatus(); }
});

source = new EventSource('/events');
source.addEventListener('frame', event => {
  try {
    const data = JSON.parse(event.data);
    for (const fx of data.fx ?? []) log(describeFx(fx), fx.type);
  } catch { log('Không đọc được frame Garden.'); }
});
source.addEventListener('shot', event => {
  try { const shot = JSON.parse(event.data); log(`Camera: ${cameraReason(shot)||'Toàn cảnh'}${shot.nickname ? ` · ${shot.nickname}` : ''}`); }
  catch { /* the status endpoint still reports the camera state */ }
});
source.addEventListener('reset', () => { log('Simulator đã được reset.'); loadStatus(); });
source.onopen = () => { $('connection').textContent = simulator ? 'Simulator sẵn sàng' : 'Đã nối tới Garden'; };
source.onerror = () => { $('connection').textContent = 'Đang nối lại…'; };
loadStatus();
setInterval(loadStatus, 2000);

$('forceBoss').addEventListener('click',async()=>{try{await request('sim',{kind:'chat',user:person(),comment:'trồng'});const r=await request('boss',{});$('actionResult').textContent=r.ok?'Boss đã xuất hiện · đồng hồ phiên tạm dừng · thả tim hoặc dùng quà lớn để đánh':'Cần bình luận mở phiên trước';await loadStatus();}catch(e){$('actionResult').textContent=e.message;}});

$('bossLike').addEventListener('click',async()=>{try{const r=await request('sim',{kind:'like',user:person(),count:50});$('actionResult').textContent=r.boss?`Đã đánh boss −${r.damage} HP · còn ${r.hp} HP`:'Đã thả 50 tim chăm vườn';}catch(e){$('actionResult').textContent=e.message;}});

$('bossLikeMany').addEventListener('click',async()=>{try{const r=await request('sim',{kind:'like',user:person(),count:200});$('actionResult').textContent=r.boss?`Đã đánh boss −${r.damage} HP · còn ${r.hp} HP`:'Đã thả 200 tim chăm vườn';await loadStatus();}catch(e){$('actionResult').textContent=e.message;}});
