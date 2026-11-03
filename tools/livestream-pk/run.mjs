// Hành trình Tầng Trời — a roguelike run the whole room plays as one party.
// The chat votes a door on every floor (Slay the Spire's map, Choice Chamber's chat votes), fights what is behind it
// with the same element roles as the boss, and after a win votes one of three "ấn chòm sao" (Hades' boons, one per
// sign). Two ấn of one element resonate (Hades' duo boons); a kỳ ngộ can trade a curse for a reward (Hades' pact);
// every floor raises the stakes (Balatro's ante). When the party falls the run is over, but the channel keeps its best
// floor, unlocks more ấn and, after a full clear, climbs an Ascension level (Rogue Legacy / Slay the Spire).
// The doors are seeded by the day, so everybody gets the same climb that night.
// No gift ever revives the party or buys a door: revival is a room rally ("hồi sinh"), never a purchase.
// Pure logic: the game owns the state (saved with everything else) and pays the rewards.

export const RUN_DEFAULTS = Object.freeze({
  runFloors: 5,
  runVoteSeconds: 14,
  runFightSeconds: 45,
  runEliteSeconds: 50,
  runBossSeconds: 70,
  runPauseSeconds: 4,
  runPartyHp: 100,
  runPartyHpPerViewer: 12,
  runEnemyHpMin: 220,
  runEnemyHpPerViewer: 70,
  runAttackSeconds: 9,
  runRageAttackSeconds: 6,
  runCommentDamage: 8,
  runCommentCooldownMs: 2000,
  runLikeDamage: 0.5,
  runDiamondDamage: 6,
  runSocialDamage: 30,
  runReviveSeconds: 15,
  runReviveNeed: 6, // distinct viewers typing "hồi sinh" (fewer in a small room)
  runLightPerFloor: 8,
});

const ELEMENT_OF = { aries: 'fire', leo: 'fire', sagittarius: 'fire', taurus: 'earth', virgo: 'earth', capricorn: 'earth', gemini: 'air', libra: 'air', aquarius: 'air', cancer: 'water', scorpio: 'water', pisces: 'water' };

// One ấn per sign. `mod` is what it adds to the party's modifiers (see mods()).
export const BOONS = Object.freeze({
  aries: { label: 'Ấn Bạch Dương', text: 'comment sát thương x2', mod: { comment: 2 } },
  taurus: { label: 'Ấn Kim Ngưu', text: '+40 máu tối đa, hồi đầy', mod: { maxHp: 40 }, heal: 1 },
  gemini: { label: 'Ấn Song Tử', text: '25% đòn đánh trúng 2 lần', mod: { echo: 0.25 } },
  cancer: { label: 'Ấn Cự Giải', text: 'cứ 10 tim hồi 1 máu', mod: { likeHeal: 0.1 } },
  leo: { label: 'Ấn Sư Tử', text: 'quà sát thương x2', mod: { gift: 2 } },
  virgo: { label: 'Ấn Xử Nữ', text: 'quái đánh yếu đi 30%', mod: { atk: 0.7 } },
  libra: { label: 'Ấn Thiên Bình', text: 'mỗi phiếu bầu hồi 2 máu', mod: { voteHeal: 2 } },
  scorpio: { label: 'Ấn Bọ Cạp', text: 'quái dưới 25% máu nhận x2', mod: { execute: 2 } },
  sagittarius: { label: 'Ấn Nhân Mã', text: '+15 giây mỗi trận', mod: { time: 15 } },
  capricorn: { label: 'Ấn Ma Kết', text: 'chặn mỗi đòn thứ 3', mod: { blockEvery: 3 } },
  aquarius: { label: 'Ấn Bảo Bình', text: '+6% sát thương mỗi cung có mặt', mod: { crowd: 0.06 } },
  pisces: { label: 'Ấn Song Ngư', text: 'tự hồi sinh 1 lần', mod: { freeRevive: 1 } },
});
export const BASE_UNLOCKED = Object.freeze(['aries', 'taurus', 'cancer', 'leo', 'virgo', 'sagittarius']);
const UNLOCK_ORDER = ['pisces', 'gemini', 'scorpio', 'capricorn', 'libra', 'aquarius'];

// Two ấn of the same element.
export const RESONANCE = Object.freeze({
  fire: { label: 'Cộng hưởng Lửa', text: 'quà chí mạng x3' },
  earth: { label: 'Cộng hưởng Đất', text: 'quái đánh yếu thêm 20%' },
  air: { label: 'Cộng hưởng Khí', text: 'comment hồi chiêu 1 giây' },
  water: { label: 'Cộng hưởng Nước', text: 'tim sát thương x1.5' },
});

export const CURSES = Object.freeze({
  heavy: { label: 'Nguyền Sao Thổ', text: 'tim không gây sát thương' },
  blackhole: { label: 'Nguyền Hố Đen', text: '-25% máu tối đa' },
  retro: { label: 'Nguyền Nghịch Hành', text: 'quái đánh mạnh thêm 30%' },
});

export const DOORS = Object.freeze({
  fight: { label: 'Quái', icon: '⚔️' },
  elite: { label: 'Tinh anh', icon: '💀' },
  chest: { label: 'Rương', icon: '🎁' },
  event: { label: 'Kỳ ngộ', icon: '❓' },
  rest: { label: 'Đền nghỉ', icon: '🔥' },
  boss: { label: 'Chúa tể', icon: '🪐' },
});

const ENEMIES = {
  fight: ['Thiên thạch lạc', 'Sứa Tinh vân', 'Quạ Nhật thực', 'Bóng ma Sao băng', 'Cua Bụi sao'],
  elite: ['Hộ vệ Vành đai', 'Rồng Sao chổi', 'Kỵ sĩ Hố đen'],
  boss: ['Chúa tể Sao Thổ'],
};

// Kỳ ngộ: a dilemma the chat settles with A or B.
export const EVENTS = Object.freeze([
  { id: 'cursed-gem', title: 'Viên ngọc bị nguyền', options: [{ label: 'Nhặt: +1 ấn, mang Nguyền Nghịch Hành', do: { boon: 1, curse: 'retro' } }, { label: 'Bỏ đi: hồi 10% máu', do: { heal: 0.1 } }] },
  { id: 'wishing-well', title: 'Giếng ước Sao Kim', options: [{ label: 'Uống nước giếng: hồi 35% máu', do: { heal: 0.35 } }, { label: 'Thả đồng sao: +1 ấn, mất 20% máu', do: { boon: 1, hurt: 0.2 } }] },
  { id: 'stranger', title: 'Lữ khách lạ mặt', options: [{ label: 'Nhận quà: mỗi người 1 viên ngọc', do: { gems: 1 } }, { label: 'Học võ: +15 máu tối đa', do: { maxHp: 15 } }] },
  { id: 'black-gate', title: 'Cổng Hố Đen', options: [{ label: 'Bước qua: vượt luôn 1 tầng, mang Nguyền Hố Đen', do: { skip: 1, curse: 'blackhole' } }, { label: 'Đi vòng: hồi 15% máu', do: { heal: 0.15 } }] },
  { id: 'library', title: 'Thư viện Sao Thủy', options: [{ label: 'Đọc bùa: gỡ 1 lời nguyền', do: { cleanse: 1 } }, { label: 'Đọc bí kíp: +1 ấn', do: { boon: 1 } }] },
  { id: 'saturn-pact', title: 'Giao kèo Sao Thổ', options: [{ label: 'Ký: +2 ấn, mang Nguyền Sao Thổ', do: { boon: 2, curse: 'heavy' } }, { label: 'Từ chối: hồi 10% máu', do: { heal: 0.1 } }] },
]);

const LETTERS = ['A', 'B', 'C'];
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
// mulberry32: a small seeded generator, so a night's doors are the same for everybody
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function createRun({ st, cfg, now, onEvent, dayKey, present, reward, gem }) {
  // the channel's record, read through st each time so a full reset (a fresh object) is picked up
  const M = () => (st.runMeta ??= { best: 0, runs: 0, clears: 0, ascension: 0, unlocked: [...BASE_UNLOCKED] });
  let r = null; // st.run, cached
  const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];

  // --- modifiers from ấn, resonance and curses ---
  function resonance() {
    const n = {};
    for (const b of st.run?.boons ?? []) n[ELEMENT_OF[b]] = (n[ELEMENT_OF[b]] ?? 0) + 1;
    return Object.keys(n).filter(el => n[el] >= 2);
  }
  function mods() {
    const m = { comment: 1, gift: 1, like: 1, atk: 1, maxHp: 0, echo: 0, likeHeal: 0, voteHeal: 0, execute: 1, time: 0, blockEvery: 0, crowd: 0, freeRevive: 0, crit: 2, cooldown: cfg.runCommentCooldownMs };
    for (const id of st.run?.boons ?? []) for (const [k, v] of Object.entries(BOONS[id].mod)) {
      if (['comment', 'gift', 'atk', 'execute'].includes(k)) m[k] *= v; else m[k] += v;
    }
    for (const el of resonance()) {
      if (el === 'fire') m.crit = 3;
      if (el === 'earth') m.atk *= 0.8;
      if (el === 'air') m.cooldown = 1000;
      if (el === 'water') m.like *= 1.5;
    }
    const curses = st.run?.curses ?? [];
    if (curses.includes('heavy')) m.like = 0;
    if (curses.includes('retro')) m.atk *= 1.3;
    return m;
  }
  const maxHp = () => {
    const base = st.run.baseHp + mods().maxHp;
    return Math.max(20, Math.round(st.run.curses.includes('blackhole') ? base * 0.75 : base));
  };

  // --- the climb ---
  function floorsFor() { return Math.min(7, cfg.runFloors + Math.floor(M().ascension / 2)); }
  function doorsFor(floor, of, rnd) {
    if (floor === of) return ['boss'];
    if (floor === 1) return ['fight', rnd() < 0.5 ? 'event' : 'chest'];
    const pool = ['fight', 'fight', 'elite', 'chest', 'event', 'event', 'rest'];
    const n = rnd() < 0.5 ? 2 : 3, out = [];
    while (out.length < n) { const d = pick(pool, rnd); if (!out.includes(d) && !(d === 'rest' && floor === of - 1 && out.includes('rest'))) out.push(d); }
    return out;
  }

  function start() {
    if (st.run) return null;
    const crowd = Math.max(1, present().length), of = floorsFor();
    const rnd = seeded(hash(`${dayKey()}:${M().runs}`));
    const map = Array.from({ length: of }, (_, i) => doorsFor(i + 1, of, rnd));
    const baseHp = cfg.runPartyHp + cfg.runPartyHpPerViewer * crowd;
    st.run = r = { no: M().runs + 1, floor: 0, of, map, seed: hash(`${dayKey()}:${M().runs}:x`), baseHp, hp: baseHp, shield: 0, boons: [], curses: [], party: {}, phase: null, revived: false, freeUsed: 0, attacks: 0, ascension: M().ascension, startedAt: now() };
    onEvent({ type: 'run-start', no: r.no, floors: of, ascension: M().ascension, best: M().best, hp: baseHp });
    nextFloor();
    return r;
  }
  const rndOf = () => seeded(hash(`${r.seed}:${r.floor}:${r.phase?.kind ?? ''}`));

  function vote(kind, options, extra = {}) {
    const seconds = cfg.runVoteSeconds;
    r.phase = { kind, options, votes: options.map(() => 0), voters: {}, endsAt: now() + seconds * 1000, ...extra };
    onEvent({ type: 'run-vote', kind, floor: r.floor, of: r.of, seconds, options: optionsView(), title: extra.title });
  }
  function optionsView() {
    const p = r.phase;
    return p.options.map((o, i) => {
      const base = { key: LETTERS[i], votes: p.votes[i] };
      if (p.kind === 'door') return { ...base, type: o, label: DOORS[o].label, icon: DOORS[o].icon };
      if (p.kind === 'boon') return { ...base, id: o, sign: o, label: BOONS[o].label, text: BOONS[o].text, element: ELEMENT_OF[o] };
      return { ...base, label: o.label };
    });
  }

  function nextFloor() {
    if (r.floor >= r.of) return end(true);
    r.floor++;
    const doors = r.map[r.floor - 1];
    if (doors.length === 1) return enter(doors[0]);
    vote('door', doors);
  }

  function enter(type) {
    onEvent({ type: 'run-door', door: type, label: DOORS[type].label, icon: DOORS[type].icon, floor: r.floor, of: r.of });
    if (type === 'fight' || type === 'elite' || type === 'boss') return fight(type);
    if (type === 'rest') {
      const heal = Math.round(maxHp() * 0.3);
      r.hp = Math.min(maxHp(), r.hp + heal);
      onEvent({ type: 'run-rest', heal, hp: r.hp, max: maxHp() });
      return pause();
    }
    if (type === 'chest') {
      const people = present();
      for (const [id, v] of people) gem(id, v, 1);
      const offers = offerBoons(rndOf(), 2);
      onEvent({ type: 'run-chest', people: people.length });
      if (offers.length) return vote('boon', offers);
      return pause();
    }
    // kỳ ngộ
    const ev = EVENTS[Math.floor(rndOf()() * EVENTS.length)];
    vote('event', ev.options, { title: ev.title, eventId: ev.id });
  }

  function fight(type) {
    const crowd = Math.max(1, present().length);
    const scale = (1 + 0.18 * (r.floor - 1)) * (1 + 0.15 * r.ascension) * (type === 'elite' ? 1.6 : type === 'boss' ? 2.6 : 1);
    const hp = Math.round(Math.max(cfg.runEnemyHpMin, cfg.runEnemyHpPerViewer * crowd) * scale);
    const seconds = (type === 'boss' ? cfg.runBossSeconds : type === 'elite' ? cfg.runEliteSeconds : cfg.runFightSeconds) + mods().time;
    const name = pick(ENEMIES[type], rndOf());
    const t = now();
    r.phase = { kind: 'fight', type, name, hp, max: hp, endsAt: t + seconds * 1000, nextAttackAt: t + cfg.runAttackSeconds * 1000, combo: 0, comboAt: 0, lastComment: {}, dmg: {} };
    onEvent({ type: 'run-fight', door: type, name, hp, seconds, floor: r.floor, of: r.of });
  }

  function pause() { r.phase = { kind: 'pause', until: now() + cfg.runPauseSeconds * 1000 }; }

  function offerBoons(rnd, n = 3) {
    const pool = M().unlocked.filter(id => !r.boons.includes(id)), out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  }
  function addBoon(id) {
    if (!id || r.boons.includes(id)) return;
    const before = resonance();
    r.boons.push(id);
    if (BOONS[id].heal) r.hp = maxHp(); else r.hp = Math.min(maxHp(), r.hp + (BOONS[id].mod.maxHp ?? 0));
    const fresh = resonance().filter(el => !before.includes(el));
    onEvent({ type: 'run-boon', id, sign: id, label: BOONS[id].label, text: BOONS[id].text, resonance: fresh.map(el => ({ element: el, ...RESONANCE[el] })) });
  }

  // --- votes ---
  function resolveVote() {
    const p = r.phase, best = p.votes.indexOf(Math.max(...p.votes)); // ties and no votes → the first option
    const choice = p.options[best], total = p.votes.reduce((a, b) => a + b, 0);
    onEvent({ type: 'run-voted', kind: p.kind, key: LETTERS[best], votes: p.votes[best], total });
    if (p.kind === 'door') return enter(choice);
    if (p.kind === 'boon') { addBoon(choice); return pause(); }
    // kỳ ngộ
    const d = choice.do, rnd = rndOf();
    if (d.heal) r.hp = Math.min(maxHp(), r.hp + Math.round(maxHp() * d.heal));
    if (d.hurt) r.hp = Math.max(1, r.hp - Math.round(maxHp() * d.hurt));
    if (d.maxHp) { r.baseHp += d.maxHp; r.hp += d.maxHp; }
    if (d.gems) for (const [id, v] of present()) gem(id, v, d.gems);
    if (d.curse && !r.curses.includes(d.curse)) r.curses.push(d.curse);
    if (d.cleanse) r.curses.shift();
    for (let i = 0; i < (d.boon ?? 0); i++) addBoon(offerBoons(rnd, 1)[0]);
    r.hp = Math.min(r.hp, maxHp());
    onEvent({ type: 'run-event', title: p.title, choice: choice.label, curse: d.curse ? { id: d.curse, ...CURSES[d.curse] } : null, hp: r.hp, max: maxHp() });
    if (d.skip && r.floor < r.of - 1) r.floor += d.skip;
    pause();
  }

  // Comment "A"/"B"/"C" while a vote is open, or "hồi sinh" while the party is down. Returns true if it was a vote.
  function chat(u, v, text) {
    if (!st.run) return false;
    r = st.run;
    const p = r.phase;
    if (p?.kind === 'down') {
      if (/^\s*hoi sinh\b/.test(text) && !p.rally[u.userId]) {
        p.rally[u.userId] = v.nickname;
        if (Object.keys(p.rally).length >= p.need) revive(Object.values(p.rally));
      }
      return false;
    }
    if (!['door', 'boon', 'event'].includes(p?.kind)) return false;
    const i = LETTERS.indexOf(text.trim().toUpperCase());
    if (i < 0 || i >= p.options.length) return false;
    if (p.voters[u.userId] === undefined) {
      p.voters[u.userId] = i;
      p.votes[i]++;
      const heal = mods().voteHeal;
      if (heal) r.hp = Math.min(maxHp(), r.hp + heal);
    } else if (p.voters[u.userId] !== i) { p.votes[p.voters[u.userId]]--; p.voters[u.userId] = i; p.votes[i]++; } // a change of mind counts once
    return true;
  }

  // --- fighting ---
  function hit(u, v, kind, n = 0) {
    if (!st.run) return 0;
    r = st.run;
    const p = r.phase;
    if (p?.kind !== 'fight' || !v.sign || p.hp <= 0) return 0;
    const m = mods(), t = now(), el = ELEMENT_OF[v.sign];
    let base = 0, mult = 1, crit = false;
    if (kind === 'comment') {
      if (t - (p.lastComment[u.userId] ?? 0) < m.cooldown) return 0;
      p.lastComment[u.userId] = t;
      base = cfg.runCommentDamage * m.comment;
      if (el === 'earth') r.shield = Math.min(12, r.shield + 1);
      if (el === 'air') { p.combo = t - p.comboAt < 4000 ? Math.min(10, p.combo + 1) : 1; p.comboAt = t; mult *= 1 + 0.15 * p.combo; }
    } else if (kind === 'like') {
      base = n * cfg.runLikeDamage * m.like;
      if (el === 'water') mult *= 3;
      if (m.likeHeal) r.hp = Math.min(maxHp(), r.hp + Math.floor(n * m.likeHeal));
    } else if (kind === 'gift') {
      base = n * cfg.runDiamondDamage * m.gift;
      if (el === 'fire') { mult *= m.crit; crit = true; }
    } else if (kind === 'follow' || kind === 'share') base = cfg.runSocialDamage;
    if (r.boons.includes(v.sign)) mult *= 1.5; // "người được chọn": fans of a sign whose ấn the party holds
    if (m.crowd) mult *= 1 + m.crowd * new Set(present().map(([, x]) => x.sign).filter(Boolean)).size;
    if (m.execute > 1 && p.hp < p.max / 4) mult *= m.execute;
    let dmg = Math.round(base * mult);
    if (m.echo && dmg > 0 && hash(`${u.userId}:${t}`) % 100 < m.echo * 100) { dmg *= 2; crit = true; }
    if (dmg <= 0) return 0;
    p.hp = Math.max(0, p.hp - dmg);
    p.dmg[u.userId] = (p.dmg[u.userId] ?? 0) + dmg;
    const who = (r.party[u.userId] ??= { nickname: v.nickname, sign: v.sign, dmg: 0 });
    who.nickname = v.nickname;
    who.dmg += dmg;
    if (crit && dmg >= 30) onEvent({ type: 'run-crit', nickname: v.nickname, sign: v.sign, dmg }); // small crits only show as numbers
    if (p.hp <= 0) won({ nickname: v.nickname, sign: v.sign, kind });
    return dmg;
  }

  function won(finisher = null) {
    const p = r.phase, top = Object.entries(p.dmg).sort((a, b) => b[1] - a[1])[0];
    onEvent({ type: 'run-won', door: p.type, name: p.name, floor: r.floor, of: r.of, mvp: top ? { nickname: r.party[top[0]].nickname, sign: r.party[top[0]].sign, dmg: top[1] } : null, finisher });
    if (p.type === 'boss') return end(true);
    if (p.type === 'elite') for (const [id, v] of present()) if (p.dmg[id]) gem(id, v, 1);
    const offers = offerBoons(rndOf());
    if (offers.length) vote('boon', offers); else pause();
  }

  function attack(t) {
    const p = r.phase, m = mods();
    p.nextAttackAt = t + (p.hp < p.max / 3 ? cfg.runRageAttackSeconds : cfg.runAttackSeconds) * 1000;
    r.attacks++;
    if (m.blockEvery && r.attacks % m.blockEvery === 0) return onEvent({ type: 'run-attack', blocked: 'capricorn', dmg: 0, hp: r.hp, max: maxHp() });
    if (r.shield >= 4) { r.shield -= 4; return onEvent({ type: 'run-attack', blocked: 'shield', dmg: 0, hp: r.hp, max: maxHp() }); }
    const dmg = Math.round(maxHp() * 0.09 * (p.type === 'elite' ? 1.3 : p.type === 'boss' ? 1.5 : 1) * (1 + 0.1 * r.ascension) * m.atk);
    r.hp = Math.max(0, r.hp - dmg);
    onEvent({ type: 'run-attack', dmg, hp: r.hp, max: maxHp() });
    if (r.hp <= 0) down();
  }

  function down() {
    if (mods().freeRevive > r.freeUsed) {
      r.freeUsed++;
      r.hp = Math.round(maxHp() * 0.4);
      return onEvent({ type: 'run-revive', free: true, hp: r.hp, max: maxHp() });
    }
    if (r.revived) return end(false);
    const need = Math.max(1, Math.min(cfg.runReviveNeed, Math.ceil(present().length / 2)));
    r.fightPhase = r.phase;
    r.phase = { kind: 'down', endsAt: now() + cfg.runReviveSeconds * 1000, need, rally: {} };
    onEvent({ type: 'run-down', need, seconds: cfg.runReviveSeconds });
  }
  function revive(names) {
    r.revived = true;
    r.hp = Math.round(maxHp() * 0.4);
    const f = r.fightPhase;
    r.fightPhase = null;
    if (f) { f.endsAt = Math.max(f.endsAt, now() + 15000); f.nextAttackAt = now() + cfg.runAttackSeconds * 1000; r.phase = f; } else pause();
    onEvent({ type: 'run-revive', free: false, names: names.slice(0, 5), count: names.length, hp: r.hp, max: maxHp() });
  }

  function end(cleared) {
    const run = st.run;
    if (!run) return;
    st.run = r = null;
    const floors = cleared ? run.of : Math.max(0, run.floor - 1);
    M().runs++;
    M().best = Math.max(M().best, cleared ? run.of : run.floor);
    let unlocked = null;
    if (floors >= 2) { unlocked = UNLOCK_ORDER.find(id => !M().unlocked.includes(id)) ?? null; if (unlocked) M().unlocked.push(unlocked); }
    if (cleared) { M().clears++; M().ascension = Math.min(10, M().ascension + 1); }
    const party = Object.entries(run.party).sort((a, b) => b[1].dmg - a[1].dmg);
    for (const [id] of party) reward(id, floors, cleared);
    onEvent({ type: 'run-end', cleared, floor: run.floor, of: run.of, floors, best: M().best, ascension: M().ascension, unlocked: unlocked && { id: unlocked, ...BOONS[unlocked] }, fighters: party.length,
      mvp: party[0] ? { nickname: party[0][1].nickname, sign: party[0][1].sign, dmg: party[0][1].dmg } : null, reward: cfg.runLightPerFloor * floors });
  }

  function tick() {
    if (!st.run) return;
    r = st.run;
    const p = r.phase, t = now();
    if (!p) return nextFloor();
    if (['door', 'boon', 'event'].includes(p.kind) && t >= p.endsAt) return resolveVote();
    if (p.kind === 'pause' && t >= p.until) return nextFloor();
    if (p.kind === 'down' && t >= p.endsAt) return end(false);
    if (p.kind !== 'fight') return;
    if (t >= p.endsAt) {
      // the enemy got away: the party takes a heavy hit and walks on without a reward
      const dmg = Math.round(maxHp() * 0.35);
      r.hp = Math.max(0, r.hp - dmg);
      onEvent({ type: 'run-fled', name: p.name, dmg, hp: r.hp, max: maxHp() });
      if (p.type === 'boss') return end(false);
      if (r.hp <= 0) return down();
      return pause();
    }
    if (t >= p.nextAttackAt) attack(t);
  }

  function view() {
    if (!st.run) return null;
    r = st.run;
    const p = r.phase, t = now();
    return {
      no: r.no, floor: r.floor, of: r.of, hp: r.hp, max: maxHp(), shield: r.shield, ascension: r.ascension,
      boons: r.boons.map(id => ({ id, label: BOONS[id].label, text: BOONS[id].text, element: ELEMENT_OF[id] })),
      resonance: resonance().map(el => ({ element: el, ...RESONANCE[el] })),
      curses: r.curses.map(id => ({ id, ...CURSES[id] })),
      phase: p?.kind ?? null,
      vote: ['door', 'boon', 'event'].includes(p?.kind) ? { kind: p.kind, title: p.title ?? null, options: optionsView(), remainingMs: Math.max(0, p.endsAt - t), voters: Object.keys(p.voters).length } : null,
      enemy: p?.kind === 'fight' ? { name: p.name, door: p.type, icon: DOORS[p.type].icon, hp: p.hp, max: p.max, remainingMs: Math.max(0, p.endsAt - t), rage: p.hp < p.max / 3, combo: t - p.comboAt < 4000 ? p.combo : 0 } : null,
      down: p?.kind === 'down' ? { got: Object.keys(p.rally).length, need: p.need, remainingMs: Math.max(0, p.endsAt - t) } : null,
      next: r.map[r.floor] ?? null,
      top: Object.values(r.party).sort((a, b) => b.dmg - a.dmg).slice(0, 3).map(({ nickname, sign, dmg }) => ({ nickname, sign, dmg })),
      meta: { best: M().best, runs: M().runs, ascension: M().ascension, unlocked: M().unlocked.length },
    };
  }

  const stop = () => { if (st.run) end(false); };
  return { start, chat, hit, tick, view, stop, active: () => Boolean(st.run), meta: M };
}
