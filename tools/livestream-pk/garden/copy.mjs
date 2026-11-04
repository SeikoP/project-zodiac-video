// Everything a viewer can read on screen. Only comments and hearts are ever suggested, never a gift.
export const COPY = Object.freeze({
  title: 'Vườn Mây',
  welcome: 'Chào mừng tới Vườn Mây',
  howTo: 'Gõ “trồng rau” để nhận ô đất · “tưới” chăm cây · “hái” khi cây chín',
  joined: name => `Chào ${name}, vườn của bạn đây!`,
  joinedHint: tier => `Tầng ${tier} · gõ “trồng rau” để gieo hạt`,
  gifts: Object.freeze({ dew: 'Giọt sương', star: 'Phân sao', rain: 'Mưa phép', tree: 'Thần thụ' }),
  events: Object.freeze({ rain: 'Mưa mây', pests: 'Bão sâu', merchant: 'Thương lái đến', golden: 'Giờ vàng' }),
  eventHint: Object.freeze({ rain: 'Cả vườn lớn nhanh gấp đôi', pests: 'Cả phòng gõ "bắt sâu"!', merchant: 'Một loại cây được giá gấp đôi', golden: 'Hái được gấp đôi vàng' }),
  steal: (thief, victim) => `${thief} trộm cây của ${victim}`,
  caught: (victim, thief) => `${victim} bắt được ${thief}!`,
  bark: victim => `Chó nhà ${victim} sủa vang`,
  levelUp: (name, level) => `${name} lên cấp ${level}`,
  thiefBoard: 'Đạo chích của đêm',
});
