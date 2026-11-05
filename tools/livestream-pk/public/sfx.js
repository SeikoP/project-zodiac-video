// Sound effects: real recordings from public/sfx (see manifest.json, installed by `npm run audio`) where
// available, otherwise the small synthesized versions below (Web Audio, no files): a soft pluck for joins, chimes for lit
// constellations, a whoosh for meteors, a bell for the full moon. Rate-limited so a busy room
// stays pleasant. ?sfx=0 turns it off, ?sfx=0.5 sets the volume. In OBS, tick
// "Control audio via OBS" on the Browser Source to hear it in the stream.
export function createSfx(volume = 0.3, {manifestUrl='/sfx/manifest.json',onState=()=>{}}={}) {
  let ctx=null,master=null,noise=null,samples={},definitions={},loading=null,currentNodes=null,currentSink=null;
  const cache=new Map(),variants=new Map(),handles=new Set(),lastAt={},recent=[];
  const missing=new Set();
  const state=()=>({context:volume<=0?'muted':ctx?.state??'cold',loading:Boolean(loading&&!Object.keys(definitions).length),loadedRoles:Object.keys(samples).length,missing:[...missing],voices:handles.size,volume});
  const report=()=>{try{onState(state());}catch{}};
  async function loadSamples(){
    if(loading)return loading;
    loading=(async()=>{try{
      const response=await fetch(manifestUrl),{roles}=await response.json();definitions=roles??{};
      await Promise.all(Object.entries(definitions).map(async([name,def])=>{
        const bufs=[];
        for(const f of def.files??[]){
          if(typeof f!=='string'||f.includes('..')||/^[\/]/.test(f)){missing.add(name);continue;}
          const url=manifestUrl.slice(0,manifestUrl.lastIndexOf('/')+1)+f;
          if(!cache.has(url))cache.set(url,(async()=>{const r=await fetch(url);if(!r.ok)throw Error('missing');return ctx.decodeAudioData(await r.arrayBuffer());})());
          try{bufs.push({buffer:await cache.get(url),file:f});}catch{missing.add(name);}
        }
        if(bufs.length)samples[name]={bufs,gain:def.gain??1};
      }));
    }catch{missing.add('manifest');}report();})();return loading;
  }
  function ready(){
    if(volume<=0)return false;
    if(!ctx){
      try{ctx=new (window.AudioContext||window.webkitAudioContext)();}catch{return false;}
      master=ctx.createGain();master.gain.value=volume;master.connect(ctx.destination);
      noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      loadSamples();
    }
    if(ctx.state==='suspended')ctx.resume?.().then(report).catch(report);
    return ctx.state==='running';
  }
  const tone = (freq, at, dur, { type = 'sine', gain = 0.5, glide = 0 } = {}) => {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(currentSink??master);currentNodes?.push(o);
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
    s.connect(f).connect(g).connect(currentSink??master);currentNodes?.push(s);
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

  function play(name,arg,meta={}){
    if(!ready())return null;
    const def=definitions[name],sample=samples[name],fn=SOUNDS[name]??SOUNDS[def?.fallback];
    if(!sample&&!fn)return null;
    const now=performance.now();
    if(!meta.managed){
      if(now-(lastAt[name]??-Infinity)<(def?.cooldownMs??250))return null;
      while(recent.length&&now-recent[0]>1000)recent.shift();if(recent.length>=8)return null;
      recent.push(now);lastAt[name]=now;
    }
    const nodes=[],sink=ctx.createGain();sink.gain.value=Number.isFinite(meta.gain)?meta.gain:1;sink.connect(master);
    let finish,timer,done=false;const ended=new Promise(r=>finish=r);
    const handle={name,sampleId:null,fallback:!sample,ended,stop(){if(done)return;done=true;clearTimeout(timer);for(const n of nodes)try{n.stop();}catch{}sink.disconnect?.();handles.delete(handle);finish();report();}};
    handles.add(handle);currentNodes=nodes;currentSink=sink;
    let duration=Math.min(5000,def?.maxDurationMs??2500);
    try{
      if(sample){
        const choices=sample.bufs.map((_,i)=>i).filter(i=>meta.sampleId?sample.bufs[i].file===meta.sampleId:sample.bufs.length===1||i!==variants.get(name));
        if(!choices.length){handle.stop();return null;}
        const index=choices[Math.floor(Math.random()*choices.length)];variants.set(name,index);
        const selected=sample.bufs[index],src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=selected.buffer;g.gain.value=sample.gain;src.connect(g).connect(sink);nodes.push(src);handle.sampleId=selected.file;duration=Math.min(duration,src.buffer.duration*1000+40);src.onended=()=>handle.stop();src.start();
      }else fn(arg);
    }catch{handle.stop();return null;}finally{currentNodes=null;currentSink=null;}
    timer=setTimeout(()=>handle.stop(),Math.max(20,duration));report();return handle;
  }
  play.warmup=async()=>{ready();await loading;report();return state();};
  play.stop=()=>{for(const h of [...handles])h.stop();};
  play.setVolume=n=>{volume=Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;if(master)master.gain.value=volume;if(!volume)play.stop();report();};
  play.status=state;
  return play;
}
