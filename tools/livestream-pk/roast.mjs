// Vòng quay bóc phốt: a globe of the 12 signs spins and lands on one, and the show "exposes" that sign with a gentle,
// meme-style tease. The sign's fans have a short window to protest ("oan!"); everyone else can agree ("chuẩn!").
// Enough protests clear the sign's name (the protesters get starlight); otherwise the tease stands and the sign gets
// the lucky star as consolation — so being roasted is never a loss. Entertainment only, never mean.

export const ROASTS = Object.freeze({
  aries: ['Nóng như nồi lẩu: sôi 3 giây, nguội 3 phút', 'Thắng cãi xong mới hỏi: ủa nãy cãi chuyện gì?', 'Làm gì cũng nhanh, trừ việc nhận lỗi', 'Bắt đầu 10 dự án, xong được… cái tên dự án', 'Đói một cái là nhân cách thứ hai xuất hiện'],
  taurus: ['Gọi dậy sớm là kết thúc tình bạn', 'Ăn xong bữa này đã lên lịch bữa sau', 'Cãi không lại thì im lặng… ba ngày', 'Đi mua sắm 4 tiếng, về tay không vì "chưa ưng"', 'Đổi kế hoạch phút chót là mặt đơ luôn'],
  gemini: ['Mở 47 tab, tab nào cũng "đang đọc dở"', 'Nói chuyện 5 phút đổi 7 chủ đề', 'Hứa "mai làm", mai lại có hứng việc khác', 'Seen rồi rep trong… đầu', 'Sáng một người, tối một người, ai cũng là thật'],
  cancer: ['Nhớ cả câu bạn nói sai hồi lớp 3', 'Giận xong tự dỗ, dỗ xong lại giận', 'Đi chơi 2 ngày mang đồ như đi 2 tháng', 'Nghe nhạc buồn để… buồn thêm cho đủ', 'Ngoài cứng trong mềm như bánh bao nhân nước mắt'],
  leo: ['Chụp 200 tấm, đăng 1 tấm, vẫn chê ánh sáng', 'Nghe ai khen người khác là tai dựng đứng', 'Đi chợ thôi cũng phải là nhân vật chính', 'Mời cả nhóm một bữa, kể lại ba năm', 'Cái gương là bạn thân nhất'],
  virgo: ['Sửa lỗi chính tả trong tin nhắn chia tay', 'Dọn phòng xong vẫn thấy một hạt bụi có ý đồ', 'Lên kế hoạch cho việc lên kế hoạch', 'Khen thì một dòng, góp ý thì mười hai trang', 'Lo xa tới mức lo luôn chuyện năm 2050'],
  libra: ['Chọn quán ăn 45 phút, cuối cùng "tuỳ mọi người"', 'Ai cũng đúng, trừ việc mình phải chọn', 'Ghét drama nhưng biết hết drama', 'Đẹp đôi với cả… cái gương', 'Hẹn 7 giờ, 7 giờ vẫn đang chọn áo'],
  scorpio: ['Đọc tin nhắn "ok" ra 18 tầng nghĩa', 'Không giận đâu, chỉ ghi sổ thôi', 'Bí ẩn tới mức chính mình cũng không hiểu mình', 'Lướt hết ảnh 5 năm trước của người ta trong 5 phút', 'Tha thứ rồi, nhưng nhớ rõ ngày giờ'],
  sagittarius: ['Nói thật quá nên mất bạn… rồi lại có bạn mới', 'Mua vé đi chơi trước khi hỏi có rảnh không', 'Hứa "một ly thôi", về nhà lúc 3 giờ sáng', 'Chân muốn đi, ví muốn ở', 'Nghe bạn kể chuyện buồn xong kể chuyện vui của mình'],
  capricorn: ['Đi chơi mà đầu vẫn tính deadline', 'Nghỉ phép để… làm việc riêng', 'Cười một cái là tin vui cấp quốc gia', 'Lập kế hoạch 5 năm cho cả con mèo', 'Tiết kiệm tới mức tiếc cả tiếng thở dài'],
  aquarius: ['Thương cả nhân loại, trừ người nhắn "alo"', 'Ý tưởng đi trước thời đại, deadline thì đi sau', 'Biến mất 3 ngày rồi quay lại như chưa có gì', 'Khác người để… khác người', 'Tranh luận với AI và thắng'],
  pisces: ['Mơ giữa ban ngày, tỉnh đúng lúc deadline', 'Khóc vì quảng cáo bột giặt', 'Đi lạc ngay trong nhà mình', 'Tin người tới mức tin cả tin nhắn trúng thưởng', 'Nghĩ một đằng, mơ một nẻo'],
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
  // the sign to roast: one with fans on stage (they're the ones who can protest), else any
  function start(sign) {
    if (st.roast) return null;
    const here = [...new Set(present().map(([, v]) => v.sign).filter(Boolean))];
    sign = ROASTS[sign] ? sign : here.length ? here[Math.floor(rng() * here.length)] : Object.keys(ROASTS)[Math.floor(rng() * 12)];
    const lines = ROASTS[sign], fans = present().filter(([, v]) => v.sign === sign).length;
    st.roastNo = (st.roastNo ?? 0) + 1;
    const line = lines[(st.roastNo + Math.floor(rng() * lines.length)) % lines.length];
    const t = now();
    st.roast = { sign, line, startedAt: t, endsAt: t + cfg.roastSeconds * 1000, need: Math.max(1, Math.min(4, Math.ceil(fans / 2))), protest: {}, agree: {} };
    onEvent({ type: 'roast-start', sign, line, need: st.roast.need, spinMs: cfg.roastSpinMs, seconds: cfg.roastSeconds });
    return st.roast;
  }

  // "oan" from the roasted sign's fans, "chuẩn" from everyone else. Returns true when the comment was a reaction.
  function chat(u, v, text) {
    const r = st.roast;
    if (!r || now() < r.startedAt + cfg.roastSpinMs) return false;
    if (v.sign === r.sign && PROTEST_RE.test(text)) { r.protest[u.userId] ??= v.nickname; return true; }
    if (v.sign !== r.sign && AGREE_RE.test(text)) { r.agree[u.userId] ??= v.nickname; return true; }
    return false;
  }

  function tick() {
    const r = st.roast;
    if (!r || now() < r.endsAt) return;
    st.roast = null;
    const protesters = Object.keys(r.protest), agreers = Object.keys(r.agree), cleared = protesters.length >= r.need;
    if (cleared) for (const id of protesters) shine(id, cfg.roastClearLight, 'roast');
    else for (const id of agreers) shine(id, cfg.roastAgreeLight, 'roast');
    const consoled = !cleared && lucky(r.sign);
    onEvent({ type: 'roast-end', sign: r.sign, line: r.line, cleared, protests: protesters.length, need: r.need, agree: agreers.length, names: Object.values(cleared ? r.protest : r.agree).slice(0, 4), consoled: Boolean(consoled) });
  }

  const view = () => {
    const r = st.roast;
    return r && { sign: r.sign, protests: Object.keys(r.protest).length, need: r.need, agree: Object.keys(r.agree).length, remainingMs: Math.max(0, r.endsAt - now()), spinning: now() < r.startedAt + cfg.roastSpinMs };
  };
  return { start, chat, tick, view };
}
