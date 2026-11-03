// Bộ thẻ Hoàng Đạo: 12 signs × 5 editions = 60 cards. Shared by the server (drops) and the overlay (how a card looks).
// Cards are only ever earned by being there (the timed star chest, beating the boss), never bought.
export const EDITIONS = Object.freeze([
  { id: 'base', label: 'Thường', rarity: 1, color: '#8EC0B9' },
  { id: 'star', label: 'Tinh Tú', rarity: 2, color: '#F2C45C' },
  { id: 'retro', label: 'Thủy Nghịch', rarity: 3, color: '#B48CF2', foil: true, hint: 'chỉ rơi khi Thủy Nghịch' },
  { id: 'fullmoon', label: 'Trăng Tròn', rarity: 3, color: '#FFE7A1', foil: true, hint: 'chỉ rơi vào đêm trăng tròn thật' },
  { id: 'boss', label: 'Diệt Sao Chổi', rarity: 4, color: '#E97A66', foil: true, hint: 'MVP hạ Sao Chổi Đen' },
]);
export const EDITION = Object.fromEntries(EDITIONS.map(e => [e.id, e]));
export const CARD_TOTAL = 12 * EDITIONS.length;
export const cardId = (sign, edition) => `${sign}:${edition}`;
export const parseCard = id => { const [sign, edition] = String(id).split(':'); return { sign, edition }; };
