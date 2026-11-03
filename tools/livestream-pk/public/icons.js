// Icons that mirror the buttons viewers actually tap in TikTok LIVE (comment, like, gift, follow,
// share), so on-screen instructions match what they see on their own phone.
const svg = (body, label) => `<svg class="ico" viewBox="0 0 24 24" role="img" aria-label="${label}">${body}</svg>`;

export const ICON = {
  comment: svg('<path fill="#2F3C44" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><circle cx="8" cy="10" r="1.5" fill="#fff"/><circle cx="12" cy="10" r="1.5" fill="#fff"/><circle cx="16" cy="10" r="1.5" fill="#fff"/>', 'Bình luận'),
  heart: svg('<path fill="#FE2C55" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>', 'Thả tim'),
  gift: svg('<path fill="#FE2C55" d="M20 6h-2.18c.11-.31.18-.65.18-1a3 3 0 0 0-3-3c-1.05 0-1.96.54-2.5 1.35L12 4.02l-.5-.67A2.99 2.99 0 0 0 9 2a3 3 0 0 0-3 3c0 .35.07.69.18 1H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-5-2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM9 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>', 'Tặng quà'),
  follow: svg('<circle cx="12" cy="12" r="11" fill="#FE2C55"/><path d="M12 6.5v11M6.5 12h11" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>', 'Theo dõi'),
  share: svg('<path fill="#2F3C44" d="M14 9V5l8 7.5-8 7.5v-4.2c-5.5 0-9.2 1.7-12 5.7 1.1-5.7 4.7-11.1 12-12.5z"/>', 'Chia sẻ'),
};
