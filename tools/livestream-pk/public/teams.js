// The four colour teams, shared by the server (events/teams.mjs re-exports this) and the browser (the overlay, the
// control page, the simulator). Plain data: no imports, so it loads the same way everywhere.

export const TEAMS = Object.freeze([
  Object.freeze({ id: 'red', label: 'Đỏ', color: '#e5484d', glyph: '🔴' }),
  Object.freeze({ id: 'yellow', label: 'Vàng', color: '#f5c518', glyph: '🟡' }),
  Object.freeze({ id: 'green', label: 'Xanh lá', color: '#30a46c', glyph: '🟢' }),
  Object.freeze({ id: 'blue', label: 'Xanh dương', color: '#3e63dd', glyph: '🔵' }),
]);
export const TEAM_IDS = TEAMS.map(t => t.id);
