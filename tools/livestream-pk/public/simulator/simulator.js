const $ = id => document.getElementById(id);
const feed = $('eventFeed');
const chatOverlay = $('chatOverlay');
let viewers = 1200, comments = 0, likes = 0, scenarioRun = 0, toastTimer;

function clock() {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
function log(message, kind = 'event') {
  const empty = feed.querySelector('.empty-feed');
  empty?.remove();
  const row = document.createElement('div');
  row.className = 'event-entry';
  const time = document.createElement('time');
  time.textContent = clock();
  const text = document.createElement('span');
  text.textContent = message;
  row.append(time, text);
  feed.prepend(row);
  while (feed.children.length > 80) feed.lastElementChild.remove();
}
async function api(route, body = {}) {
  const response = await fetch('/api/' + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('Server trả về dữ liệu không hợp lệ'); }
  if (!response.ok || result.ok === false) throw new Error(result.error || 'HTTP ' + response.status);
  return result.result;
}
function updateStats() {
  $('viewerPill').textContent = viewers >= 1000 ? (viewers / 1000).toFixed(1).replace('.0', '') + 'K' : String(viewers);
  $('viewerValue').textContent = viewers.toLocaleString('vi-VN');
  $('viewerCount').value = viewers;
  $('commentValue').textContent = comments.toLocaleString('vi-VN');
  $('likeValue').textContent = likes.toLocaleString('vi-VN');
  $('heartCount').textContent = likes >= 1000 ? (likes / 1000).toFixed(1) + 'K' : String(likes);
}
function phoneToast(message) {
  $('phoneToast').textContent = message;
  $('phoneToast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('phoneToast').classList.remove('show'), 2300);
}
function pushChat(name, message, kind = '') {
  const row = document.createElement('div');
  row.className = 'chat-line' + (kind ? ' ' + kind : '');
  const who = document.createElement('b');
  who.textContent = name;
  const what = document.createElement('span');
  what.textContent = message;
  row.append(who, what);
  chatOverlay.append(row);
  while (chatOverlay.children.length > 7) chatOverlay.firstElementChild.remove();
}
function pushSystem(message) {
  const row = document.createElement('div');
  row.className = 'chat-line system-line';
  const icon = document.createElement('span');
  icon.className = 'sys-dot';
  icon.textContent = '✦';
  const text = document.createElement('span');
  text.textContent = message;
  row.append(icon, text);
  chatOverlay.append(row);
  while (chatOverlay.children.length > 7) chatOverlay.firstElementChild.remove();
}
function floatHearts(n = 1) {
  const show = Math.min(8, Math.max(1, Math.ceil(n / 5)));
  for (let i = 0; i < show; i++) {
    const heart = document.createElement('span');
    heart.className = 'floating-heart';
    heart.textContent = ['♥', '💗', '💖'][i % 3];
    heart.style.setProperty('--dx', (Math.random() * 100 - 50) + 'px');
    $('phoneScreen').append(heart);
    setTimeout(() => heart.remove(), 1250);
  }
}
function currentName() {
  return $('viewerName').value.trim().slice(0, 32) || 'Người xem';
}
function updateScenarioStatus(text, active = false) {
  $('scenarioStatus').textContent = text;
  $('stopScenario').disabled = !active;
}

async function sendComment(value = $('commentText').value, name = currentName()) {
  const comment = String(value || '').trim();
  if (!comment) return;
  try {
    await api('sim/chat', { user: name, comment });
    comments++;
    pushChat(name, comment);
    log(name + ': ' + comment, 'chat');
    updateStats();
    $('commentText').value = '';
    $('phoneComment').value = '';
  } catch (error) {
    log('Lỗi comment: ' + error.message);
    phoneToast('Không gửi được comment');
  }
}
async function joinRoom(name = currentName()) {
  try {
    await api('sim/member', { user: name });
    viewers++;
    pushSystem(name + ' vừa tham gia LIVE');
    log(name + ' vừa tham gia phòng');
    phoneToast(name + ' đã vào phòng');
    updateStats();
  } catch (error) { log('Lỗi join: ' + error.message); }
}
async function sendLikes(count = 10, name = currentName()) {
  try {
    await api('sim/like', { user: name, count });
    likes += count;
    floatHearts(count);
    log(name + ' thả ' + count + ' tim');
    updateStats();
  } catch (error) { log('Lỗi tim: ' + error.message); }
}
async function sendGift() {
  const [diamonds, giftName] = $('giftSelect').value.split('|');
  const count = Math.max(1, Math.min(99, Number($('giftCount').value) || 1));
  try {
    await api('sim/gift', { user: currentName(), diamonds, giftName, count });
    const label = giftName + ' ×' + count;
    pushChat(currentName(), 'đã tặng ' + label, 'chat-gift');
    phoneToast('🎁 ' + currentName() + ' · ' + label);
    log(currentName() + ' tặng ' + label + ' (' + (Number(diamonds) * count) + ' xu)');
  } catch (error) { log('Lỗi quà: ' + error.message); }
}
async function social(kind) {
  try {
    await api('sim/social', { user: currentName(), kind });
    const title = kind === 'follow' ? 'đã theo dõi kênh' : 'đã chia sẻ LIVE';
    pushSystem(currentName() + ' ' + title);
    log(currentName() + ' ' + title);
    phoneToast(kind === 'follow' ? '＋ Đã follow' : '↗ Đã share');
  } catch (error) { log('Lỗi ' + kind + ': ' + error.message); }
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function runScenario(name) {
  const runId = ++scenarioRun;
  updateScenarioStatus('Đang chạy: ' + name, true);
  log('Bắt đầu kịch bản: ' + name);
  const alive = () => runId === scenarioRun;
  const step = async fn => { if (!alive()) return; await fn(); };
  try {
    if (name === 'warmup') {
      for (const [person, comment] of [['Minh', 'bạch dương'], ['An', 'xin quẻ'], ['Huy', 'ước thi đỗ'], ['Linh', '12/8/1998']]) {
        await step(() => joinRoom(person)); await wait(300);
        await step(() => sendComment(comment, person)); await wait(550);
      }
    } else if (name === 'busy') {
      await api('sim/crowd', { count: 30, giftRate: 0.12 });
      if (!alive()) return;
      for (let i = 1; i <= 8; i++) {
        await step(() => sendComment(['sư tử', 'xin quẻ', 'nhảy', 'ước bình an', 'A', 'song ngư'][i % 6], 'Fan' + i));
        await wait(140);
      }
      log('Đã tạo 30 người xem giả lập');
    } else if (name === 'gifts') {
      for (const [d, g, count] of [[1, 'Rose', 1], [5, 'Finger Heart', 3], [30, 'Doughnut', 2], [100, 'Hand Hearts', 1], [1000, 'Galaxy', 1]]) {
        await step(() => api('sim/gift', { user: 'TopFan', diamonds: d, giftName: g, count }));
        if (!alive()) return;
        pushChat('TopFan', 'đã tặng ' + g + ' ×' + count, 'chat-gift');
        phoneToast('🎁 ' + g + ' ×' + count);
        log('TopFan tặng ' + g + ' ×' + count);
        await wait(700);
      }
    } else if (name === 'game') {
      await step(() => sendComment('xin quẻ', 'Mai')); await wait(400);
      await step(() => api('quiz/start')); phoneToast('❓ Host mở câu đố'); log('Host kích hoạt câu đố');
      await wait(450);
      await step(() => sendComment('A', 'Mai')); await wait(500);
      await step(() => api('poll/start')); phoneToast('🗳 Host mở bình chọn'); log('Host kích hoạt bình chọn');
      await wait(500);
      await step(() => api('boss/start')); phoneToast('☄ Boss Sao Chổi Đen'); log('Host gọi Boss');
      await wait(400);
      await step(() => sendComment('đánh nó', 'Mai'));
    } else if (name === 'spam') {
      for (let i = 1; i <= 20 && alive(); i++) {
        await sendComment(['xin quẻ', 'sư tử', 'nhảy', 'hay quá', 'ước may mắn'][i % 5], 'Spam' + (i % 4));
        await wait(90);
      }
    } else if (name === 'crowd') {
      await api('sim/crowd', { count: 100, giftRate: 0.05 });
      pushSystem('100 người xem giả lập đã vào phòng');
      log('Tạo 100 người xem, có comment/tim/quà ngẫu nhiên');
    }
  } catch (error) {
    log('Kịch bản lỗi: ' + error.message);
  } finally {
    if (alive()) updateScenarioStatus('Hoàn tất: ' + name, false);
  }
}
function stopScenario() {
  scenarioRun++;
  api('sim/storm', { perSecond: 0 }).catch(() => {});
  updateScenarioStatus('Đã dừng kịch bản', false);
  log('Đã dừng mô phỏng');
}

$('chatForm').addEventListener('submit', event => {
  event.preventDefault();
  const text = $('phoneComment').value.trim();
  if (text) sendComment(text);
});
$('sendComment').addEventListener('click', () => sendComment());
$('commentText').addEventListener('keydown', event => { if (event.key === 'Enter') sendComment(); });
document.querySelectorAll('[data-comment]').forEach(button => button.addEventListener('click', () => sendComment(button.dataset.comment)));
$('joinButton').addEventListener('click', () => joinRoom());
$('likeButton').addEventListener('click', () => sendLikes(10));
$('railLike').addEventListener('click', () => sendLikes(1));
$('railGift').addEventListener('click', () => sendGift());
$('railShare').addEventListener('click', () => social('share'));
$('headerFollow').addEventListener('click', () => social('follow'));
$('followButton').addEventListener('click', () => social('follow'));
$('shareButton').addEventListener('click', () => social('share'));
$('sendGift').addEventListener('click', sendGift);
$('applyViewers').addEventListener('click', () => {
  viewers = Math.max(0, Math.min(999999, Number($('viewerCount').value) || 0));
  updateStats(); log('Đặt lượt xem giả lập: ' + viewers.toLocaleString('vi-VN'));
});
$('viewerPlus').addEventListener('click', () => {
  viewers = Math.min(999999, viewers + 100);
  updateStats(); log('Tăng 100 lượt xem giả lập');
});
document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => runScenario(button.dataset.scenario)));
$('stopScenario').addEventListener('click', stopScenario);
$('stressStart').addEventListener('click', async () => {
  try {
    await api('sim/storm', { perSecond: 300 });
    updateScenarioStatus('Đang tải cao · 300 event/giây', true);
    log('Bắt đầu stress test 300 event/giây');
  } catch (error) { log('Không chạy được stress test: ' + error.message); }
});
document.querySelectorAll('[data-host]').forEach(button => button.addEventListener('click', async () => {
  const route = button.dataset.host;
  try {
    await api(route, route === 'fortune/sign' ? { sign: '' } : {});
    phoneToast('Đã kích hoạt: ' + button.textContent.trim());
    log('Host action: ' + button.textContent.trim());
  } catch (error) { log('Host action lỗi: ' + error.message); }
}));
$('clearFeed').addEventListener('click', () => {
  feed.innerHTML = '<div class="empty-feed">Sự kiện mô phỏng sẽ hiển thị tại đây.</div>';
});
$('resetSimulator').addEventListener('click', async () => {
  if (!confirm('Xóa state game của Simulator? Dữ liệu livestream thật không bị ảnh hưởng.')) return;
  stopScenario();
  try {
    await api('reset');
    chatOverlay.innerHTML = '';
    pushSystem('Simulator đã được reset. Bắt đầu diễn tập mới!');
    comments = 0; likes = 0; viewers = 1200;
    updateStats();
    log('Đã reset state mô phỏng');
  } catch (error) { log('Reset lỗi: ' + error.message); }
});
window.addEventListener('beforeunload', () => {
  navigator.sendBeacon?.('/api/sim/storm', new Blob([JSON.stringify({ perSecond: 0 })], { type: 'application/json' }));
});

updateStats();
log('Simulator đã sẵn sàng · server riêng · TikTok thật bị khóa');
