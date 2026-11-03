// Dates that deserve a greeting on the stream (Vietnam). Fixed solar dates, plus lunar holidays by table
// (the lunar calendar can't be computed from the date alone) and Black Friday (4th Friday of November).
// occasionOn('2026-11-20') → { name, greeting, tip } or null. `tip` is the line a daily reading may use that day.
const FIXED = {
  '01-01': ['Tết Dương lịch', 'Chúc cả nhà năm mới bình an, nhiều niềm vui!', 'Năm mới, bắt đầu một thói quen nhỏ bạn vẫn định làm.'],
  '14-02': ['Valentine', 'Chúc ai có đôi hạnh phúc, ai một mình cũng được yêu thương!', 'Hôm nay hợp nói lời yêu thương, kể cả với bạn bè và gia đình.'],
  '08-03': ['Quốc tế Phụ nữ', 'Chúc chị em một ngày thật được trân trọng!', 'Hôm nay hãy dành cho mình một điều thật dịu dàng.'],
  '14-03': ['Valentine trắng', 'Một ngày nhiều ngọt ngào cho cả nhà!', 'Một món quà nhỏ làm tay hôm nay ý nghĩa hơn món đắt tiền.'],
  '01-04': ['Cá tháng Tư', 'Chúc cả nhà một ngày cười thật nhiều (đừng tin hết mọi thứ nhé)!', 'Hôm nay hợp một câu đùa vô hại.'],
  '30-04': ['Ngày 30/4', 'Chúc cả nhà kỳ nghỉ lễ thật vui!', 'Kỳ nghỉ dài hợp nạp lại năng lượng, đừng ôm việc.'],
  '01-05': ['Quốc tế Lao động', 'Chúc những người lao động một ngày nghỉ ngơi đúng nghĩa!', 'Hôm nay hợp nghỉ ngơi mà không áy náy.'],
  '01-06': ['Quốc tế Thiếu nhi', 'Ai cũng có một đứa trẻ bên trong — chúc cả nhà thật vui!', 'Làm một điều hồn nhiên bạn đã lâu không làm.'],
  '02-09': ['Quốc khánh', 'Chúc cả nhà một ngày lễ bình yên!', 'Hôm nay hợp gặp gia đình và cùng nhau ăn một bữa.'],
  '20-10': ['Phụ nữ Việt Nam', 'Chúc chị em một ngày được yêu thương và tôn vinh!', 'Gửi một lời chúc đến người phụ nữ bạn quý.'],
  '31-10': ['Halloween', 'Đêm huyền bí — chúc cả nhà vui và không bị doạ thật!', 'Một chút bí ẩn hôm nay làm ngày thêm vui.'],
  '11-11': ['Ngày độc thân', 'Độc thân hay không, hôm nay cũng xứng đáng được chiều!', 'Mua sắm bốc đồng hôm nay dễ hối hận, cân nhắc nhé.'],
  '20-11': ['Nhà giáo Việt Nam', 'Chúc quý thầy cô và những ai đang dạy người khác điều tốt!', 'Nhắn một lời cảm ơn đến người thầy bạn nhớ.'],
  '24-12': ['Đêm Giáng sinh', 'Chúc cả nhà một đêm ấm áp bên người thương!', 'Hôm nay hợp ở bên người bạn quý.'],
  '25-12': ['Giáng sinh', 'Giáng sinh an lành, nhiều niềm vui nhỏ!', 'Một món quà nhỏ cho ai đó sẽ làm cả hai vui.'],
  '31-12': ['Giao thừa dương lịch', 'Chúc cả nhà khép lại năm cũ thật nhẹ nhàng!', 'Viết ra ba điều bạn biết ơn trong năm nay.'],
};

const TET = ['Tết Nguyên Đán', 'Chúc mừng năm mới! Vạn sự như ý, an khang thịnh vượng!', 'Đầu năm hợp nói lời tốt đẹp và mỉm cười thật nhiều.'];
const TRUNG_THU = ['Tết Trung thu', 'Trung thu vui vẻ, trăng rằm thật tròn!', 'Ngắm trăng một lúc, đầu óc sẽ nhẹ hơn.'];
// Lunar holidays by solar date (extend as years pass).
const LUNAR = {
  '2027-02-06': TET, '2028-01-26': TET, '2029-02-13': TET, '2030-02-03': TET,
  '2027-09-15': TRUNG_THU, '2028-10-03': TRUNG_THU, '2029-09-22': TRUNG_THU, '2030-09-12': TRUNG_THU,
};

function blackFriday(y, m, d) {
  if (m !== 11) return false;
  const first = new Date(Date.UTC(y, 10, 1)).getUTCDay(); // 0 = Sunday
  return d === 1 + ((5 - first + 7) % 7) + 21; // 4th Friday
}

export function occasionOn(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const pad = n => String(n).padStart(2, '0');
  const hit = LUNAR[ymd] ?? FIXED[`${pad(d)}-${pad(m)}`];
  if (hit) return { name: hit[0], greeting: hit[1], tip: hit[2] };
  if (blackFriday(y, m, d)) return { name: 'Black Friday', greeting: 'Săn sale vui vẻ — nhớ mua thứ mình cần thật sự nhé!', tip: 'Chờ 24 giờ trước khi bấm mua món bạn thấy “phải có”.' };
  return null;
}
