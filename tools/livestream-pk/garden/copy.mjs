// Everything a viewer can read on screen. Only comments and hearts are ever suggested, never a gift.
import { CROPS } from './crops.mjs';
export function describeAction(ctx,user,cmd,result) {
  const action=result.resolvedAction??cmd.cmd;
  if(result.ok&&action==='plant')return `Đã trồng ${CROPS[result.crop].label} · gõ “chăm” để chăm cây`;
  if(result.reason==='broken')return `Chậu bị phá · đợi ${Math.ceil(result.retryAfterMs/1000)}s rồi gõ “trồng” để gieo lại miễn phí`;
  if(result.ok)return ({water:'Đã tưới · +25% tốc độ trong 30s · +1,5% tiến độ',pest:'Đã dọn sâu · cây tiếp tục lớn',weed:'Đã nhổ cỏ · cây thông thoáng',fertilize:'Đã bón phân · +18% tốc độ đến khi hái · +3% tiến độ',harvest:`Đã hái · +${result.gold??0} vàng, +${result.xp??0} XP`,steal:`Trộm thành công · +${result.amount??0} vàng`,catch:'Đã bắt trộm · cây được khôi phục',dog:'Chó đã ra canh vườn',card:'Thông tin vườn của bạn'})[action]??'Đã chăm cây';
  const wait=Math.max(1,Math.ceil((result.retryAfterMs??0)/1000));
  const plot=user.seat&&ctx.state.plots[`${user.seat.tier}:${user.seat.slot}`];
  return ({
    cooldown:`Đợi ${wait} giây rồi thử lại · không mất vàng`,
    busy:'Chậu đang có cây · gõ “chăm”, khi chín gõ “hái”',
    'unknown-crop':'Chưa có hạt này · gõ “trồng”, “trồng hướng dương” hoặc “trồng nấm mây”',
    level:`Hạt này cần cấp ${result.requiredLevel??2} · bạn cấp ${user.level} · trồng để lên cấp`,
    gold:`Cần ${result.requiredGold??1} vàng, bạn có ${user.gold??0} · hái cây hoặc giúp tưới để nhận vàng`,
    'no-crop':'Chậu còn trống · gõ “trồng” trước',
    'not-ripe':action==='steal'?'Chỉ trộm được cây vừa chín · thử chậu khác':`Cây mới ${Math.floor((plot?.crop?.progress??0)*100)}% · gõ “chăm”, đợi đủ 100% rồi “hái”`,
    'no-pest':'Cây đang sạch sâu · gõ “chăm” hoặc chờ bão sâu để giúp vườn',
    'no-weeds':'Cây đang sạch cỏ · gõ “chăm” để tưới cây',
    'already-fertilized':'Cây đã bón phân · chờ chín rồi gõ “hái”',
    'no-target':cmd.mention?'Tên chưa khớp hoặc trùng · ghi rõ “@tên người chơi” trên chậu':'Chưa có chậu phù hợp · cây cần chín, đang hoạt động và không được bảo vệ',
    'no-room':'Vườn đang đầy · chậu im lặng sẽ tự nhường chỗ sau 3 phút',
    banned:`Vừa bị bắt · còn ${wait} giây mới trộm lại được`,
    self:'Đó là chậu của bạn · gõ “hái” để thu hoạch',asleep:'Chủ chậu đang nghỉ · thử một người đang hoạt động',
    dog:'Có chó canh · chọn chậu khác',shield:'Chậu đang được bảo vệ · chọn chậu khác',cap:'Chậu này đã hết lượt trộm · chọn chậu khác',
    'no-thief':'Chưa có người vừa trộm bạn · chỉ bắt được trong 10 giây sau khi bị trộm',
    active:'Chó đã canh rồi · không cần thả thêm', 'no-plot':'Chưa có chậu · bình luận để nhận chỗ',
  })[result.reason]??'Chưa thực hiện được · gõ “vườn” để xem tình trạng';
}

export const COPY = Object.freeze({
  title: 'Vườn Mây',
  welcome: 'Chào mừng tới Vườn Mây',
  howTo: '“trồng” · “chăm” tự chọn việc miễn phí · “hái” khi chín · “vườn” xem thông tin gọn',
  joined: name => `Chào ${name}, vườn của bạn đây!`,
  joinedHint: tier => `Tầng ${tier} · gõ “trồng” để gieo hạt`,
  gifts: Object.freeze({ dew: 'Giọt sương', star: 'Phân sao', roulette: 'Vòng quay tinh nghịch', rain: 'Mưa phép', meteor: 'Thiên thạch', cataclysm: 'Đại địa chấn' }),
  events: Object.freeze({ rain: 'Mưa tưới', pests: 'Đợt sâu bệnh', merchant: 'Chợ phiên', golden: 'Giờ vàng' }),
  eventHint: Object.freeze({ rain: 'Cả vườn lớn nhanh gấp đôi', pests: 'Cả phòng gõ "bắt sâu"!', merchant: 'Một loại cây được giá gấp đôi', golden: 'Hái được gấp đôi vàng' }),
  steal: (thief, victim) => `${thief} trộm cây của ${victim}`,
  caught: (victim, thief) => `${victim} bắt được ${thief}!`,
  bark: victim => `Chó nhà ${victim} sủa vang`,
  levelUp: (name, level) => `${name} lên cấp ${level}`,
  thiefBoard: 'Đạo chích của đêm',
});
