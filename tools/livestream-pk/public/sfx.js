// Sound effects: real recordings from public/sfx (see manifest.json, installed by `npm run audio`) where
// available, otherwise the small synthesized versions below (Web Audio, no files): a soft pluck for joins, chimes for lit
// constellations, a whoosh for meteors, a bell for the full moon. Rate-limited so a busy room
// stays pleasant. ?sfx=0 turns it off, ?sfx=0.5 sets the volume. In OBS, tick
// "Control audio via OBS" on the Browser Source to hear it in the stream.
export function createSfx(volume = 0.3) {
  let ctx = null, master = null, noise = null, samples = {}, loading = false;
  const lastAt = {}, recent = [];
  const COOLDOWN = { title: 4000, milestone: 1500, quiz: 800, join: 700, heart: 450, comment: 1500, dance: 800, sparkle: 400, wish: 1500, overtake: 4000, flow: 1200, quizTick: 900, boop: 1500, starFly: 900, bossHit: 300, runHit: 2000, cardFlip: 600, laugh: 3000 };

  // Loads the recorded effects listed in /sfx/manifest.json; any that fail to load stay synthesized.
  async function loadSamples() {
    if (loading) return;
    loading = true;
    try {
      const { roles } = await (await fetch('/sfx/manifest.json')).json();
      for (const [name, def] of Object.entries(roles ?? {})) {
        const bufs = [];
        for (const f of def.files) {
          try {
            const res = await fetch(`/sfx/${f}`);
            if (res.ok) bufs.push(await ctx.decodeAudioData(await res.arrayBuffer()));
          } catch { /* this file is optional */ }
        }
        if (bufs.length) samples[name] = { bufs, gain: def.gain ?? 1 };
      }
    } catch { /* no pack installed: everything stays synthesized */ }
  }
  const playSample = ({ bufs, gain }) => {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
    g.gain.value = gain;
    src.connect(g).connect(master);
    src.start();
  };

  function ready() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      loadSamples();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx.state !== 'closed';
  }

  const tone = (freq, at, dur, { type = 'sine', gain = 0.5, glide = 0 } = {}) => {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const hiss = (at, dur, { from = 4000, to = 600, gain = 0.4 } = {}) => {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    f.type = 'bandpass';
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + dur + 0.05);
  };
  const N = { c5: 523.25, e5: 659.25, g5: 783.99, a5: 880, c6: 1046.5, e6: 1318.5, g6: 1568 };
  // One pentatonic note per sign, so every sign "sounds" different when someone joins it.
  const PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
  const arp = (notes, step, dur, opts) => notes.forEach((f, i) => tone(f, i * step, dur, opts));

  const SOUNDS = {
    join: i => { const f = PENTA[(i ?? 0) % 12] * 2; tone(f, 0, 0.2, { type: 'triangle', gain: 0.35 }); tone(f * 1.5, 0.09, 0.24, { type: 'triangle', gain: 0.25 }); },
    heart: () => tone(900 + Math.random() * 300, 0, 0.09, { type: 'sine', gain: 0.12, glide: 1.4 }),
    comment: () => tone(1500, 0, 0.05, { type: 'sine', gain: 0.08 }),
    dance: () => tone(300, 0, 0.18, { type: 'sine', gain: 0.3, glide: 2 }),
    sparkle: () => tone(N.e6 * (0.9 + Math.random() * 0.3), 0, 0.25, { type: 'sine', gain: 0.25 }),
    combo: n => arp([N.c5, N.e5, N.g5, N.c6].slice(0, Math.min(4, 1 + (n ?? 5) / 5 | 0)), 0.06, 0.25, { type: 'triangle', gain: 0.3 }),
    firework: () => { hiss(0, 0.25, { from: 6000, to: 300, gain: 0.5 }); tone(180, 0.02, 0.3, { gain: 0.5, glide: 0.4 }); tone(N.g6, 0.2, 0.3, { gain: 0.2 }); },
    meteor: () => { hiss(0, 1.1, { from: 5000, to: 400, gain: 0.45 }); tone(90, 0.5, 0.7, { type: 'sine', gain: 0.6, glide: 0.5 }); },
    lit: () => arp([N.c5, N.e5, N.g5, N.c6], 0.07, 0.4, { type: 'triangle', gain: 0.3 }),
    flow: () => hiss(0, 0.5, { from: 800, to: 3000, gain: 0.12 }),
    wheel: () => { arp([N.c5, N.e5, N.g5, N.c6, N.e6, N.g6], 0.1, 0.7, { type: 'triangle', gain: 0.3 }); tone(130.8, 0, 1.2, { gain: 0.4 }); },
    moon: () => { tone(880, 0, 1.4, { gain: 0.35 }); tone(1760, 0, 1.0, { gain: 0.15 }); tone(659.25, 0.15, 1.2, { gain: 0.25 }); },
    moonEnd: () => arp([N.g5, N.e5, N.c5], 0.12, 0.5, { type: 'sine', gain: 0.25 }),
    lucky: () => arp([N.e5, N.g5, N.c6, N.e6], 0.06, 0.25, { type: 'sine', gain: 0.25 }),
    luckyEnd: () => tone(N.c6, 0, 0.3, { type: 'sine', gain: 0.15, glide: 0.6 }),
    overtake: () => { tone(N.g5, 0, 0.12, { type: 'square', gain: 0.12 }); tone(N.c6, 0.1, 0.2, { type: 'square', gain: 0.12 }); },
    fortune: () => { tone(523.25, 0, 1.0, { gain: 0.35 }); tone(783.99, 0.18, 1.1, { gain: 0.25 }); },
    fortuneEnd: () => tone(392, 0, 0.5, { gain: 0.2, glide: 0.8 }),
    wish: () => tone(N.a5, 0, 0.5, { type: 'sine', gain: 0.2, glide: 1.5 }),
    follow: () => arp([N.g5, N.c6, N.e6], 0.08, 0.3, { type: 'triangle', gain: 0.3 }),
    share: () => { hiss(0, 0.3, { from: 1000, to: 5000, gain: 0.2 }); tone(N.e6, 0.25, 0.4, { gain: 0.25 }); },
    title: () => arp([N.c5, N.g5, N.c6, N.e6, N.g6], 0.07, 0.35, { type: 'triangle', gain: 0.3 }),
    streak: () => arp([N.e5, N.a5], 0.1, 0.3, { type: 'triangle', gain: 0.3 }),
    quizStart: () => { for (let i = 0; i < 4; i++) tone(200, i * 0.09, 0.07, { type: 'square', gain: 0.1 }); },
    quizTick: () => tone(1000, 0, 0.05, { type: 'square', gain: 0.1 }),
    quiz: () => arp([N.g5, N.c6], 0.12, 0.3, { type: 'triangle', gain: 0.3 }),
    pollStart: () => arp([N.c5, N.g5], 0.09, 0.2, { type: 'sine', gain: 0.25 }),
    poll: () => arp([N.e5, N.g5, N.c6], 0.09, 0.3, { type: 'triangle', gain: 0.3 }),
    milestone: () => arp([N.c5, N.g5, N.c6, N.e6], 0.09, 0.5, { type: 'triangle', gain: 0.3 }),
    welcome: () => arp([N.c5, N.e5, N.g5, N.c6, N.e6], 0.08, 0.6, { type: 'triangle', gain: 0.3 }),
    night: () => { tone(110, 0, 1.8, { gain: 0.5 }); tone(220, 0, 1.4, { gain: 0.2 }); },
    boop: () => tone(330, 0, 0.12, { type: 'sine', gain: 0.2, glide: 0.8 }),
    // giờ hành tinh, the acts and their headliners
    hourStart: () => { [196, 261.63, 392].forEach((f, i) => tone(f, i * 0.22, 2.2, { gain: 0.32 })); tone(1568, 0.66, 1.6, { type: 'sine', gain: 0.12 }); },
    actOpen: () => { tone(N.g5, 0, 0.6, { type: 'triangle', gain: 0.25 }); tone(N.c6, 0.14, 0.8, { type: 'triangle', gain: 0.25 }); },
    headStart: () => { for (let i = 0; i < 3; i++) tone(146.8, i * 0.16, 0.14, { type: 'square', gain: 0.12 }); arp([N.c5, N.g5, N.c6, N.g6], 0.08, 0.5, { type: 'triangle', gain: 0.3 }); },
    actClose: () => arp([N.c6, N.g5, N.e5, N.c5, N.g5, N.c6], 0.1, 0.4, { type: 'triangle', gain: 0.25 }),
    pair: () => { tone(N.e5, 0, 0.5, { type: 'sine', gain: 0.25 }); tone(N.a5, 0.12, 0.6, { type: 'sine', gain: 0.25 }); tone(N.e6, 0.3, 0.9, { type: 'sine', gain: 0.15, glide: 1.02 }); },
    starFly: () => { hiss(0, 0.7, { from: 1500, to: 7000, gain: 0.15 }); tone(N.g6, 0.55, 0.5, { type: 'sine', gain: 0.18 }); },
    chestOpen: () => { tone(110, 0, 0.18, { type: 'square', gain: 0.15, glide: 1.5 }); arp([N.c6, N.e6, N.g6], 0.06, 0.35, { type: 'sine', gain: 0.25 }); },
    bossStart: () => { tone(55, 0, 1.6, { type: 'sawtooth', gain: 0.25, glide: 1.4 }); hiss(0.1, 1.2, { from: 300, to: 2500, gain: 0.25 }); },
    bossHit: () => { hiss(0, 0.12, { from: 2000, to: 400, gain: 0.3 }); tone(120, 0, 0.12, { gain: 0.3, glide: 0.5 }); },
    // Hành trình Tầng Trời
    door: () => { tone(220, 0, 0.5, { type: 'triangle', gain: 0.3, glide: 0.75 }); hiss(0.05, 0.4, { from: 600, to: 200, gain: 0.2 }); },
    boon: () => { arp([N.e5, N.a5, N.c6, N.e6, N.a5 * 2], 0.06, 0.6, { type: 'sine', gain: 0.28 }); },
    runHit: () => { tone(80, 0, 0.35, { type: 'square', gain: 0.25, glide: 0.5 }); hiss(0, 0.25, { from: 900, to: 150, gain: 0.35 }); },
    fall: () => { arp([N.c5, 466.16, 415.3, 392], 0.22, 0.6, { type: 'triangle', gain: 0.3 }); tone(65, 0.6, 1.5, { gain: 0.35 }); },
    revive: () => { hiss(0, 0.8, { from: 300, to: 6000, gain: 0.25 }); arp([N.c5, N.e5, N.g5, N.c6, N.e6, N.g6], 0.07, 0.7, { type: 'triangle', gain: 0.3 }); },
    cleared: () => { for (let i = 0; i < 6; i++) tone(98, i * 0.08, 0.1, { type: 'square', gain: 0.15 }); arp([N.c5, N.e5, N.g5, N.c6], 0.12, 0.9, { type: 'triangle', gain: 0.32 }); },
    cardFlip: () => hiss(0, 0.18, { from: 3000, to: 900, gain: 0.25 }),
    // vòng quay bóc phốt: the wheel ticking down, a "ba-dum-tss", the room laughing
    spin: () => { for (let i = 0; i < 18; i++) tone(1200, 0.05 * i + 0.004 * i * i, 0.03, { type: 'square', gain: 0.06 }); },
    roast: () => { tone(110, 0, 0.12, { type: 'square', gain: 0.2 }); tone(98, 0.15, 0.12, { type: 'square', gain: 0.2 }); hiss(0.32, 0.5, { from: 9000, to: 6000, gain: 0.3 }); },
    laugh: () => { for (let i = 0; i < 5; i++) tone(520 - i * 30, i * 0.13, 0.1, { type: 'sawtooth', gain: 0.08, glide: 0.8 }); },
  };

  return function play(name, arg) {
    const fn = SOUNDS[name];
    if (!fn || volume <= 0 || !ready()) return;
    const now = performance.now();
    if (now - (lastAt[name] ?? 0) < (COOLDOWN[name] ?? 250)) return;
    while (recent.length && now - recent[0] > 1000) recent.shift();
    if (recent.length >= 8) return; // never more than 8 sounds a second
    recent.push(now);
    lastAt[name] = now;
    if (samples[name]) playSample(samples[name]);
    else fn(arg);
  };
}
