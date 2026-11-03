// Background music: rotates through the channel's tracks with cross-fades, never repeats the same
// track twice in a row, switches between a calm and an upbeat playlist with the room's mood, and
// ducks under big sound effects. ?music=0 turns it off, ?music=0.3 sets the volume.
export function createMusic({ volume = 0.22, onBlocked = () => {} } = {}) {
  const FADE_MS = 3500;
  let lists = { calm: [], upbeat: [] };
  let mood = 'calm', muted = false, duck = 1, duckUntil = 0, lastFile = null, started = false;
  const players = []; // { el, vol, target, file }

  const base = () => (muted ? 0 : volume) * duck;
  const url = f => `/music/${f.split('/').map(encodeURIComponent).join('/')}`;

  function pick() {
    const pool = lists[mood].length ? lists[mood] : lists.calm.length ? lists.calm : lists.upbeat;
    if (!pool.length) return null;
    const choices = pool.length > 1 ? pool.filter(t => t.file !== lastFile) : pool;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function startNext() {
    const t = pick();
    if (!t) return;
    lastFile = t.file;
    const el = new Audio(url(t.file));
    el.preload = 'auto';
    el.volume = 0;
    const p = { el, vol: 0, target: 1, file: t.file, title: t.title };
    players.push(p);
    el.play().then(() => { started = true; }).catch(() => { players.splice(players.indexOf(p), 1); onBlocked(); });
    el.addEventListener('ended', () => { fadeOut(p); startNext(); });
  }
  const fadeOut = p => { p.target = 0; };

  // 50ms ramp loop; also starts the next track a few seconds before the current one ends (the cross-fade).
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = now - last;
    last = now;
    if (duckUntil && now > duckUntil) { duckUntil = 0; duck = 1; }
    for (const p of [...players]) {
      const goal = p.target * base();
      p.vol += Math.sign(goal - p.vol) * Math.min(Math.abs(goal - p.vol), (volume || 1) * dt / FADE_MS * 1.5);
      p.el.volume = Math.max(0, Math.min(1, p.vol));
      if (p.target === 0 && p.vol <= 0.002) { p.el.pause(); players.splice(players.indexOf(p), 1); continue; }
      const left = p.el.duration - p.el.currentTime;
      if (p.target === 1 && Number.isFinite(left) && left < FADE_MS / 1000 && !p.next) { p.next = true; fadeOut(p); startNext(); }
    }
  }, 50);

  return {
    setLists(next) { lists = { calm: next.calm ?? [], upbeat: next.upbeat ?? [] }; if (volume > 0 && !players.length) startNext(); },
    // Called with 'calm' or 'upbeat'; a change cross-fades into a track of the new mood.
    setMood(next) { if (next === mood) return; mood = next; if (players.length) { players.forEach(fadeOut); startNext(); } },
    skip() { players.forEach(fadeOut); startNext(); },
    toggleMute() { muted = !muted; return muted; },
    // Lower the music briefly under a loud effect.
    duck(amount = 0.35, ms = 2200) { duck = amount; duckUntil = performance.now() + ms; },
    resume() { if (!players.length) startNext(); players.forEach(p => p.el.paused && p.el.play().catch(() => {})); },
    nowPlaying: () => players.find(p => p.target === 1)?.title ?? null,
    get started() { return started; },
  };
}
