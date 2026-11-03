// Bộ thẻ Hoàng Đạo: 12 signs × 10 editions = 120 cards (5 classic, Hoàng Kim from the pity counter, 4 themed-hour editions). Shared by the server (drops) and the overlay (how a card looks).
// Cards are only ever earned by being there (the timed star chest, beating the boss), never bought.
export const EDITIONS = Object.freeze([
  { id: 'base', label: 'Thường', rarity: 1, color: '#8EC0B9' },
  { id: 'star', label: 'Tinh Tú', rarity: 2, color: '#F2C45C' },
  { id: 'retro', label: 'Thủy Nghịch', rarity: 3, color: '#B48CF2', foil: true, hint: 'chỉ rơi khi Thủy Nghịch' },
  { id: 'fullmoon', label: 'Trăng Tròn', rarity: 3, color: '#FFE7A1', foil: true, hint: 'chỉ rơi vào đêm trăng tròn thật' },
  { id: 'boss', label: 'Diệt Sao Chổi', rarity: 4, color: '#E97A66', foil: true, hint: 'MVP hạ Sao Chổi Đen' },
  { id: 'gold', label: 'Hoàng Kim', rarity: 4, color: '#FFD45E', foil: true, hint: 'chắc chắn có sau 10 lần nhận rương không ra thẻ hiếm' },
  // Bộ thẻ Giờ Hành Tinh: each only drops during its themed hour (rương, or the act's MVP)
  { id: 'h-mars', label: 'Giờ Sao Hỏa', rarity: 2, color: '#E97A66', hour: 'mars', hint: 'rơi trong giờ Sao Hỏa' },
  { id: 'h-venus', label: 'Giờ Sao Kim', rarity: 2, color: '#F2A7C3', hour: 'venus', hint: 'rơi trong giờ Sao Kim' },
  { id: 'h-mercury', label: 'Giờ Sao Thủy', rarity: 2, color: '#B48CF2', hour: 'mercury', hint: 'rơi trong giờ Sao Kim (và giờ Sao Thủy)' },
  { id: 'h-saturn', label: 'Giờ Sao Thổ', rarity: 2, color: '#8EC0B9', hour: 'saturn', hint: 'rơi trong giờ Sao Hỏa (và giờ Sao Thổ)' },
]);
export const EDITION = Object.fromEntries(EDITIONS.map(e => [e.id, e]));
export const CARD_TOTAL = 12 * EDITIONS.length;
export const cardId = (sign, edition) => `${sign}:${edition}`;
export const parseCard = id => { const [sign, edition] = String(id).split(':'); return { sign, edition }; };
