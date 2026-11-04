// Everything a viewer can read on screen. Only comments and hearts are ever suggested, never a gift.
export const COPY = Object.freeze({
  title: 'Vườn Mây',
  welcome: 'Chào mừng tới Vườn Mây',
  howTo: '“trồng rau” · “tưới” · “bón phân” · “nhổ cỏ” · “bắt sâu” · “hái” khi chín',
  joined: name => `Chào ${name}, vườn của bạn đây!`,
  joinedHint: tier => `Tầng ${tier} · gõ “trồng rau” để gieo hạt`,
  gifts: Object.freeze({ dew: 'Giọt sương', star: 'Phân sao', rain: 'Mưa phép', tree: 'Thần thụ' }),
  events: Object.freeze({ rain: 'Mưa tưới', pests: 'Đợt sâu bệnh', merchant: 'Chợ phiên', golden: 'Giờ vàng' }),
  eventHint: Object.freeze({ rain: 'Cả vườn lớn nhanh gấp đôi', pests: 'Cả phòng gõ "bắt sâu"!', merchant: 'Một loại cây được giá gấp đôi', golden: 'Hái được gấp đôi vàng' }),
  steal: (thief, victim) => `${thief} trộm cây của ${victim}`,
  caught: (victim, thief) => `${victim} bắt được ${thief}!`,
  bark: victim => `Chó nhà ${victim} sủa vang`,
  levelUp: (name, level) => `${name} lên cấp ${level}`,
  thiefBoard: 'Đạo chích của đêm',
});
