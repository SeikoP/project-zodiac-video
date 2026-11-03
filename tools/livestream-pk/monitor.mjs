// What the host sees in the control panel: a rolling log of what happened and simple rates, so a quiet stage
// can be told apart from "TikTok sends nothing". Lives only on the host side (never sent to shared overlay pages:
// it holds raw nicknames and comments).
const MINUTE = 60000;
const KINDS = ['chat', 'gift', 'like', 'follow', 'share'];
const short = (s, n = 90) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export function createMonitor({ now = () => Date.now(), label = id => id, max = 120 } = {}) {
  const log = [];
  let seq = 0, lastAt = 0, lastKind = null, likeAcc = 0, likeAt = 0;
  const hits = Object.fromEntries(KINDS.map(k => [k, []])); // [time, amount]
  const total = Object.fromEntries(KINDS.map(k => [k, 0]));
  let diamonds = 0;
  let pending = [];

  function add(kind, text, extra = {}) {
    const e = { id: ++seq, t: now(), kind, text, ...extra };
    log.push(e);
    if (log.length > max) log.shift();
    pending.push(e);
  }
  function hit(kind, amount = 1) {
    const t = now();
    hits[kind].push([t, amount]);
    total[kind] += amount;
    lastAt = t;
    lastKind = kind;
  }
  function flushLikes() {
    if (likeAcc && now() - likeAt >= 4000) { add('like', `❤ +${likeAcc} lượt thả tim`); likeAcc = 0; likeAt = now(); }
  }

  // Wraps anything with chat/gift/like/social so every viewer action is counted and logged.
  const tap = game => ({
    chat: e => { hit('chat'); add('chat', `${short(e.nickname || e.userId, 24)}: ${short(e.comment, 80)}`); return game.chat(e); },
    gift: e => {
      const coins = (Number(e.diamonds) || 0) * (Number(e.count) || 1);
      hit('gift'); diamonds += coins;
      add('gift', `${short(e.nickname || e.userId, 24)} tặng ${short(e.giftName, 30)}${(e.count || 1) > 1 ? ` x${e.count}` : ''} (${coins} xu)`, { coins });
      return game.gift(e);
    },
    like: e => { const n = Number(e.count) || 0; hit('like', n); if (!likeAcc) likeAt = now(); likeAcc += n; flushLikes(); return game.like(e); },
    social: e => { const k = e.kind === 'share' ? 'share' : 'follow'; hit(k); add(k, `${short(e.nickname || e.userId, 24)} ${k === 'share' ? 'chia sẻ buổi live' : 'theo dõi kênh'}`); return game.social(e); },
  });

  // Game-side events worth a line in the log (the quiet ones are left out).
  function note(e) {
    switch (e.type) {
      case 'join': add('game', `${short(e.nickname, 24)} vào đội ${label(e.sign)}`, { sign: e.sign }); break;
      case 'lit': add('sky', `${label(e.sign)} đã sáng${e.by !== e.sign ? ` (nhờ ${label(e.by)})` : ''}`, { sign: e.sign }); break;
      case 'wheel-complete': add('sky', `Vòng ${e.no} trọn — ${e.winner ? label(e.winner) : 'không ai'} rực rỡ nhất`); break;
      case 'overtake': add('sky', `${label(e.sign)} vượt ${label(e.from)} lên hạng 1`, { sign: e.sign }); break;
      case 'moon-full': add('sky', `Trăng rằm lần ${e.count} — ánh sao x${e.multiplier} trong ${e.seconds}s`); break;
      case 'lucky-start': add('sky', `Sao may mắn: ${label(e.sign)} (x${e.multiplier}, ${e.seconds}s)`, { sign: e.sign }); break;
      case 'quiz-start': add('game', 'Câu đố bắt đầu'); break;
      case 'quiz-end': add('game', `Câu đố xong — đáp án ${e.answer}, ${e.winners.length} người đúng${e.winners.length ? `: ${e.winners.map(w => short(w.nickname, 16)).join(', ')}` : ''}`); break;
      case 'poll-start': add('game', `Bình chọn: ${short(e.q, 60)}`); break;
      case 'poll-end': add('game', e.winner ? `Bình chọn xong — ${label(e.winner)} thắng (${e.votes}/${e.total} phiếu)` : 'Bình chọn xong — chưa ai bình chọn'); break;
      case 'fortune': add('game', e.userId ? 'Một người nhận quẻ' : `Quẻ chung cho ${label(e.sign)}`); break;
      case 'wish': add('game', `${short(e.nickname, 24)} thả đèn ước${e.text ? `: ${short(e.text, 50)}` : ' (bí mật)'}`); break;
      case 'milestone': add('game', `Mốc người xem thứ ${e.count}`); break;
      case 'night-start': add('system', `Bắt đầu đêm ${e.no}`); break;
      case 'boss-start': add('game', `Sao Chổi Đen xuất hiện — ${e.hp} máu, ${e.seconds}s`); break;
      case 'boss-freeze': add('game', `Sao Chổi đóng băng ${label(e.sign)} — cần ${e.need} fan comment để phá băng`, { sign: e.sign }); break;
      case 'boss-rescue': add('game', `${short(e.nickname, 24)} phá băng cho ${label(e.sign)}`, { sign: e.sign }); break;
      case 'boss-blocked': add('game', `Khiên chặn đòn nhắm vào ${label(e.sign)}`); break;
      case 'boss-heal': add('game', `Không ai phá băng ${label(e.sign)} — Sao Chổi hồi ${e.heal} máu`); break;
      case 'boss-defeated': add('game', `Hạ Sao Chổi sau ${e.seconds}s — ${e.fighters} người góp sức${e.mvp ? `, MVP ${short(e.mvp.nickname, 20)}` : ''}`); break;
      case 'boss-escaped': add('game', `Sao Chổi trốn thoát (còn ${Math.round(e.hpShare * 100)}% máu)`); break;
      case 'chaos-start': add('sky', `Thủy Nghịch${e.real ? ' (Sao Thủy đang nghịch hành thật)' : ''} — cần ${e.need} người gõ "thuận"`); break;
      case 'chaos-fixed': add('sky', `Đã sửa sóng — ${e.count} người gõ "thuận"`); break;
      case 'chaos-end': add('sky', 'Thủy Nghịch tự hết'); break;
      case 'chest-open': add('game', `Rương sao #${e.no} mở (${e.seconds}s)`); break;
      case 'chest-close': add('game', `Rương sao #${e.no} đóng — ${e.claims} người nhận thẻ`); break;
      case 'set-complete': add('game', `${short(e.nickname, 24)} gom đủ 12 cung!`); break;
      case 'reset': add('system', 'Đã xoá toàn bộ dữ liệu'); break;
      default: break;
    }
  }
  const system = text => add('system', text);

  function rates() {
    const t = now(), out = {};
    for (const k of KINDS) {
      const list = hits[k];
      while (list.length && t - list[0][0] > 5 * MINUTE) list.shift();
      out[k] = { perMin: list.filter(([at]) => t - at <= MINUTE).reduce((a, [, n]) => a + n, 0), total: total[k] };
    }
    return out;
  }

  return {
    tap, note, system, flushLikes,
    stats: () => ({ rates: rates(), diamonds, lastAgo: lastAt ? now() - lastAt : null, lastKind }),
    // Entries added since the previous call (for broadcasting), and the whole log (for a page that just opened).
    drain: () => { flushLikes(); const out = pending; pending = []; return out; },
    all: () => [...log],
  };
}
