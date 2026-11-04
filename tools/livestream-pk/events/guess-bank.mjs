// Đoán vật: the things the room can be asked to guess. Placeholder bank of eight; Task 16 writes the real one (40+).
// { answer, aliases: [other accepted spellings], clues: [vaguest, ..., giveaway] }. Clues 1-3 must not contain the answer
// or an alias as a word; clue 4 may.
export const GUESS_BANK = Object.freeze([
  { answer: 'con mèo', aliases: ['mèo', 'meo'], clues: ['Là con vật nuôi trong nhà', 'Rất thích bắt chuột', 'Có ria mép và bộ lông mềm', 'Kêu “meo meo” và thích nằm phơi nắng'] },
  { answer: 'con voi', aliases: ['voi'], clues: ['Con vật to nhất trên cạn', 'Có đôi tai quạt và hai chiếc ngà', 'Có cái mũi rất dài, hay phun nước để tắm', 'Cái mũi dài của nó gọi là cái vòi'] },
  { answer: 'con thỏ', aliases: ['thỏ', 'tho'], clues: ['Là con vật ăn cà rốt', 'Có đôi tai rất dài', 'Nhảy tưng tưng khắp nơi', 'Trên mặt trăng, chị Hằng nuôi một con'] },
  { answer: 'cái ô', aliases: ['ô', 'cái dù', 'dù'], clues: ['Đồ vật mang theo ngày mưa', 'Có cán cầm và khung nan', 'Xòe ra để che nắng che mưa', 'Bật lên là có mái che trên đầu'] },
  { answer: 'xe đạp', aliases: ['xe dap'], clues: ['Phương tiện không cần xăng', 'Có hai bánh tròn', 'Phải dùng sức chân mới đi được', 'Có yên, ghi đông và bàn đạp'] },
  { answer: 'quả chuối', aliases: ['chuối', 'trái chuối'], clues: ['Loại quả màu vàng', 'Cong cong như vầng trăng', 'Phải lột vỏ mới ăn', 'Khỉ rất thích ăn'] },
  { answer: 'đồng hồ', aliases: ['dong ho'], clues: ['Treo trên tường hoặc đeo ở tay', 'Có mặt tròn và các con số', 'Kim ngắn kim dài chạy vòng tròn', 'Kêu tích tắc báo giờ'] },
  { answer: 'cá heo', aliases: ['ca heo'], clues: ['Sống dưới biển nhưng thở bằng phổi', 'Rất thông minh và hay nhảy múa', 'Thích chơi đùa cùng tàu thuyền', 'Thường biểu diễn xiếc ở thủy cung'] },
]);
