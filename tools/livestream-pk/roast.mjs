// Vòng quay bóc phốt: a globe of the 4 teams spins and lands on one, and the show "exposes" that team with a gentle,
// meme-style tease. The team's fans have a short window to protest ("oan!"); everyone else can agree ("chuẩn!").
// Enough protests clear the team's name (the protesters get starlight); otherwise the tease stands and the team gets
// the lucky star as consolation — so being roasted is never a loss. Entertainment only, never mean.

export const ROASTS = Object.freeze({
  red: ['Nóng như nồi lẩu: sôi 3 giây, nguội 3 phút', 'Thắng cãi xong mới hỏi: ủa nãy cãi chuyện gì?', 'Làm gì cũng nhanh, trừ việc nhận lỗi', 'Bắt đầu 10 dự án, xong được… cái tên dự án', 'Đói một cái là nhân cách thứ hai xuất hiện'],
  yellow: ['Sáng như mặt trời, nhưng sáng thứ hai thì tắt hẳn', 'Chụp 200 tấm, đăng 1 tấm, vẫn chê ánh sáng', 'Cười trước, hiểu chuyện sau', 'Mời cả nhóm một bữa, kể lại ba năm', 'Cái gương là bạn thân nhất'],
  green: ['Mở 47 tab, tab nào cũng "đang đọc dở"', 'Chọn quán ăn 45 phút, cuối cùng "tuỳ mọi người"', 'Hứa "mai làm", mai lại có hứng việc khác', 'Đi chợ mua rau, về nhà có thêm ba cái cây', 'Chậm rãi tới mức cây trong nhà mọc nhanh hơn'],
  blue: ['Mơ giữa ban ngày, tỉnh đúng lúc deadline', 'Khóc vì quảng cáo bột giặt', 'Bình tĩnh bề ngoài, bên trong 47 cơn sóng', 'Nghe nhạc buồn để… buồn thêm cho đủ', 'Đi lạc ngay trong nhà mình'],
});

export const ROAST_DEFAULTS = Object.freeze({
  roastSpinMs: 5000, // how long the globe spins on screen before the tease shows
  roastSeconds: 25, // the protest window, counted from the start
  roastClearLight: 15, // each fan who protests when the name is cleared
  roastAgreeLight: 3,
});

const PROTEST_RE = /^\s*(oan|oan qua|oan uc|phot gia|khong dung|sai roi|vu khong)\b/;
const AGREE_RE = /^\s*(chuan|dung roi|dung qua|qua dung|chuan luon|haha+|kk+|hihi)\b/;

export function createRoast({ st, cfg, now, rng, onEvent, present, shine, lucky }) {
  // the team to roast: one with fans on stage (they're the ones who can protest), else any
  function start(team) {
    if (st.roast) return null;
    const here = [...new Set(present().map(([, v]) => v.team).filter(Boolean))];
    team = ROASTS[team] ? team : here.length ? here[Math.floor(rng() * here.length)] : Object.keys(ROASTS)[Math.floor(rng() * Object.keys(ROASTS).length)];
    const lines = ROASTS[team], fans = present().filter(([, v]) => v.team === team).length;
    st.roastNo = (st.roastNo ?? 0) + 1;
    const line = lines[(st.roastNo + Math.floor(rng() * lines.length)) % lines.length];
    const t = now();
    st.roast = { team, line, startedAt: t, endsAt: t + cfg.roastSeconds * 1000, need: Math.max(1, Math.min(4, Math.ceil(fans / 2))), protest: {}, agree: {} };
    onEvent({ type: 'roast-start', team, line, need: st.roast.need, spinMs: cfg.roastSpinMs, seconds: cfg.roastSeconds });
    return st.roast;
  }

  // "oan" from the roasted team's fans, "chuẩn" from everyone else. Returns true when the comment was a reaction.
  function chat(u, v, text) {
    const r = st.roast;
    if (!r || now() < r.startedAt + cfg.roastSpinMs) return false;
    if (v.team === r.team && PROTEST_RE.test(text)) { r.protest[u.userId] ??= v.nickname; return true; }
    if (v.team !== r.team && AGREE_RE.test(text)) { r.agree[u.userId] ??= v.nickname; return true; }
    return false;
  }

  function tick() {
    const r = st.roast;
    if (!r || now() < r.endsAt) return;
    st.roast = null;
    const protesters = Object.keys(r.protest), agreers = Object.keys(r.agree), cleared = protesters.length >= r.need;
    if (cleared) for (const id of protesters) shine(id, cfg.roastClearLight, 'roast');
    else for (const id of agreers) shine(id, cfg.roastAgreeLight, 'roast');
    const consoled = !cleared && lucky(r.team);
    onEvent({ type: 'roast-end', team: r.team, line: r.line, cleared, protests: protesters.length, need: r.need, agree: agreers.length, names: Object.values(cleared ? r.protest : r.agree).slice(0, 4), consoled: Boolean(consoled) });
  }

  const view = () => {
    const r = st.roast;
    return r && { team: r.team, protests: Object.keys(r.protest).length, need: r.need, agree: Object.keys(r.agree).length, remainingMs: Math.max(0, r.endsAt - now()), spinning: now() < r.startedAt + cfg.roastSpinMs };
  };
  return { start, chat, tick, view };
}
