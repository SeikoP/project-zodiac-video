const $ = id => document.getElementById(id);
let simulator = false, cameraLocked = false, source;
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
function person() { const nickname = $('nickname').value.trim() || 'Người xem'; return { userId: slug(nickname), nickname }; }
async function request(route, body, method = 'POST') {
  const r = await fetch(`/api/${route}`, { method, ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) } : {}) });
  const data = await r.json();
  if (!r.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${r.status}`);
  return method === 'GET' ? data : data.result;
}
function resultText(result, action) {
  if (!result?.ok) return reasonText[result?.reason] ?? 'Lệnh chưa thực hiện được.';
  const message = ({ chat: 'Đã nhận bình luận.', plant: 'Đã gieo hạt.', water: 'Đã tưới cây.', pest: 'Đã xử lý sâu.', harvest: `Đã thu hoạch · +${result.gold ?? 0} vàng.`, steal: `Trộm thành công · +${result.amount ?? 0} vàng.`, catch: 'Đã bắt người vừa trộm.', dog: result.free ? 'Chó ra canh miễn phí.' : 'Chó ra canh vườn.', card: 'Đã gửi thẻ vườn lên overlay.' })[action] ?? 'Đã gửi vào Garden.';
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
  if (fx.type === 'gift') return `${fx.nickname ?? 'Người xem'} gửi quà: ${fx.tier} (${fx.total} xu)`;
  if (fx.type === 'event-start') return `Bắt đầu sự kiện: ${fx.kind}`;
  if (fx.type === 'event-end') return `Kết thúc sự kiện: ${fx.kind}`;
  if (fx.type === 'plant') return `${who} vừa gieo cây (${fx.crop})`;
  if (fx.type === 'harvest') return `${who} vừa thu hoạch · +${fx.gold} vàng`;
  if (fx.type === 'ripe') return `Một cây đã chín (${fx.crop})`;
  if (fx.type === 'levelup') return `${who} lên cấp ${fx.level}`;
  if (fx.type === 'steal') return 'Có lượt trộm cây';
  if (fx.type === 'catch') return 'Bắt được người vừa trộm';
  if (['water', 'help', 'pest-cleared'].includes(fx.type)) return `${fx.count ?? 1} lượt ${fx.type}`;
  return fx.type;
}

function renderStatus(s) {
  simulator = Boolean(s.simulator);
  $('mode').textContent = simulator ? 'Simulator riêng' : 'Garden thường';
  $('mode').className = `badge ${simulator ? '' : 'live'}`;
  $('modeNotice').textContent = simulator
    ? 'Dữ liệu mô phỏng tách riêng, không kết nối TikTok và không ghi vào save Garden thật.'
    : 'Dữ liệu đang ghi vào Garden thật. Muốn thử tương tác, dừng server này rồi chạy npm run garden:sim trên cùng cổng 4858.';
  $('viewers').textContent = s.viewers;
  $('planted').textContent = s.planted;
  $('ripe').textContent = s.ripe;
  $('activity').textContent = `${s.event ?? 'Không sự kiện'} · ${s.camera.current ?? 'camera chờ'}`;
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
  $('sessionTitle').textContent = competition.standings?.length ? `Phiên ${session.no}` : session?.previous?.podium?.length ? `Kết quả phiên ${session.previous.no}` : session ? `Phiên ${session.no} · chưa có điểm` : 'Đang chờ khách đầu tiên';
  const rows = competition.standings?.length ? competition.standings.slice(0, 5) : session?.previous?.podium ?? [];
  $('finishSession').disabled = !session || !competition.standings?.length;
  $('standings').replaceChildren(...(rows.length ? rows.map(row => {
    const item = document.createElement('li'), place = document.createElement('span'), name = document.createElement('span'), points = document.createElement('b');
    place.className = 'rank'; place.textContent = `${row.rank}.`;
    name.className = 'leader-name'; name.textContent = row.nickname;
    points.textContent = `${row.points} điểm`;
    item.append(place, name, points);
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
$('sendGift').addEventListener('click', async () => {
  const user = person(), diamonds = Number($('diamonds').value), count = Math.max(1, Math.min(99, Number($('giftCount').value) || 1));
  try {
    const result = await request('sim', { kind: 'gift', user, diamonds, count });
    $('actionResult').textContent = `Đã gửi ${result.tier} · ${diamonds * count} xu.`;
  } catch (e) { $('actionResult').textContent = `Không gửi được quà: ${e.message}`; }
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
  if (!confirm('Kết thúc phiên LIVE hiện tại và trao danh hiệu cho top 3?')) return;
  $('finishSession').disabled = true;
  try {
    const result = await request('session/finish', {});
    $('finishResult').textContent = result?.no ? `Đã chốt phiên ${result.no}: ${result.podium.map(row => `${row.nickname} · ${row.title}`).join(' / ') || 'chưa có người lên hạng'}.` : 'Chưa có phiên LIVE để chốt.';
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
    const planted = await post('chat', { comment: 'trồng rau' });
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
  try { const shot = JSON.parse(event.data); log(`Camera: ${shot.kind}${shot.tier ? ` · ${shot.tier}` : ''}`); }
  catch { /* the status endpoint still reports the camera state */ }
});
source.addEventListener('reset', () => { log('Simulator đã được reset.'); loadStatus(); });
source.onopen = () => { $('connection').textContent = simulator ? 'Simulator sẵn sàng' : 'Đã nối tới Garden'; };
source.onerror = () => { $('connection').textContent = 'Đang nối lại…'; };
loadStatus();
setInterval(loadStatus, 2000);
