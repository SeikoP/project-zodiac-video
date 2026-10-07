const phases = new Set(["anticipation","action","reaction","hold","settle"]);
const reservedFocus = new Set(["audience","self","offscreen_left","offscreen_right"]);
const finiteInt = (value) => Number.isInteger(value) && value >= 0;
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value)));


const frameCount = (fps, seconds, min, max) =>
  Math.max(min, Math.min(max, Math.round(Math.max(1, Number(fps) || 30) * seconds)));

const chooseMotionPreset = (event, production, phase) => {
  const keys = Object.keys(production?.visual_system?.motion_presets ?? {});
  if (!keys.length) throw new Error("PERFORMANCE_DEFAULTS: production declares no motion presets.");
  const lowered = keys.map((key) => [key, key.toLocaleLowerCase("en-US")]);
  const groups = event.target === "camera"
    ? [["camera","focus","zoom","pan"], ["nudge","state","swap"]]
    : phase === "reaction"
      ? [["reaction","recoil","pop","nudge"], ["state","swap","peel"]]
      : [["state","swap","nudge","peel"], ["reaction","pop"]];
  for (const needles of groups) {
    const match = lowered.find(([,key]) => needles.some((needle) => key.includes(needle)));
    if (match) return match[0];
  }
  return keys[0];
};

export const materializeProductionDefaults = (production) => {
  const fps = production?.video?.fps ?? 30;
  return {
    ...production,
    scenes: (production.scenes ?? []).map((scene) => ({
      ...scene,
      events: (scene.events ?? []).map((event) => {
        const incoming = event.performance ?? {};
        const phase = incoming.phase ?? (incoming.cause_event_id ? "reaction" : "action");
        const energy = Number.isFinite(incoming.energy)
          ? Number(incoming.energy)
          : phase === "reaction" ? 0.68 : phase === "hold" ? 0.28 : 0.5;
        const performance = {
          intent: String(incoming.intent ?? event.action ?? "state change").trim() || "state change",
          phase,
          energy,
          anticipation_frames: Number.isInteger(incoming.anticipation_frames)
            ? incoming.anticipation_frames
            : phase === "reaction" ? frameCount(fps, 0.07, 1, 4) : frameCount(fps, 0.12, 2, 6),
          hold_frames: Number.isInteger(incoming.hold_frames)
            ? incoming.hold_frames
            : phase === "hold" ? frameCount(fps, 0.28, 4, 12) : frameCount(fps, 0.12, 2, 7),
          settle_frames: Number.isInteger(incoming.settle_frames)
            ? incoming.settle_frames
            : frameCount(fps, phase === "reaction" ? 0.24 : 0.2, 4, 10),
          ...(incoming.focus ? {focus: incoming.focus} : {}),
          ...(incoming.cause_event_id ? {cause_event_id: incoming.cause_event_id} : {}),
        };
        const motion = event.motion ?? {
          preset: chooseMotionPreset(event, production, phase),
          duration_frames: frameCount(fps, phase === "reaction" ? 0.30 : 0.36, 8, 14),
        };
        return {...event, motion, performance};
      }),
    })),
  };
};


const smoothStep = (value) => {
  const p = Math.max(0, Math.min(1, value));
  return p * p * (3 - 2 * p);
};
const lerp = (from, to, progress) => from + (to - from) * progress;

export const poseTransitionChoreographyValues = (frame, motionDuration, performance, focusDirection = 0) => {
  const duration = Math.max(6, Number(motionDuration) || 1);
  const progress = Math.max(0, Math.min(1, frame / Math.max(1, duration - 1)));
  const energy = clamp01(performance?.energy ?? 0.5);
  const direction = focusDirection === 0 ? 1 : Math.sign(focusDirection);
  const swapAt = performance?.phase === "reaction" ? 0.36 : 0.44;
  const outgoing = {
    x: -direction * 7 * energy,
    y: 3.5 * energy,
    rotate_deg: -direction * 2.6 * energy,
    scale: 1 - 0.052 * energy,
    opacity: 1,
  };
  const overshoot = {
    x: direction * 4.5 * energy,
    y: -3 * energy,
    rotate_deg: direction * 1.7 * energy,
    scale: 1 + 0.028 * energy,
    opacity: 1,
  };
  const neutral = {x:0,y:0,rotate_deg:0,scale:1,opacity:1};
  const preload = (performance?.anticipation_frames ?? 0) > 0
    ? {
        x:-direction*5*energy,
        y:2.5*energy,
        rotate_deg:-direction*1.4*energy,
        scale:1-0.012*energy,
        opacity:1,
      }
    : neutral;

  if (progress < swapAt) {
    const p = smoothStep(progress / Math.max(0.001, swapAt));
    return {
      pose: "before",
      swap_progress: swapAt,
      x: lerp(preload.x, outgoing.x, p),
      y: lerp(preload.y, outgoing.y, p),
      rotate_deg: lerp(preload.rotate_deg, outgoing.rotate_deg, p),
      scale: lerp(preload.scale, outgoing.scale, p),
      opacity: 1,
    };
  }

  const incomingProgress = (progress - swapAt) / Math.max(0.001, 1 - swapAt);
  const overshootAt = 0.48;
  if (incomingProgress < overshootAt) {
    const p = smoothStep(incomingProgress / overshootAt);
    return {
      pose: "after",
      swap_progress: swapAt,
      x: lerp(outgoing.x, overshoot.x, p),
      y: lerp(outgoing.y, overshoot.y, p),
      rotate_deg: lerp(outgoing.rotate_deg, overshoot.rotate_deg, p),
      scale: lerp(outgoing.scale, overshoot.scale, p),
      opacity: 1,
    };
  }

  const p = smoothStep((incomingProgress - overshootAt) / Math.max(0.001, 1 - overshootAt));
  return {
    pose: "after",
    swap_progress: swapAt,
    x: lerp(overshoot.x, neutral.x, p),
    y: lerp(overshoot.y, neutral.y, p),
    rotate_deg: lerp(overshoot.rotate_deg, neutral.rotate_deg, p),
    scale: lerp(overshoot.scale, neutral.scale, p),
    opacity: 1,
  };
};

export const validatePerformanceAnimation = (scene) => {
  const entityIds = new Set((scene.entities ?? []).map((entity) => entity.id));
  const priorEventIds = new Set();
  for (const event of scene.events ?? []) {
    const p = event.performance;
    if (!p || typeof p !== "object") throw new Error("PERFORMANCE_ANIMATION_GATE: event requires performance metadata: " + event.id);
    if (!String(p.intent ?? "").trim()) throw new Error("PERFORMANCE_ANIMATION_GATE: performance intent is required: " + event.id);
    if (!phases.has(p.phase)) throw new Error("PERFORMANCE_ANIMATION_GATE: unsupported performance phase: " + event.id);
    if (!Number.isFinite(p.energy) || p.energy < 0 || p.energy > 1) throw new Error("PERFORMANCE_ANIMATION_GATE: energy must be within 0..1: " + event.id);
    for (const key of ["anticipation_frames","hold_frames","settle_frames"]) {
      if (!finiteInt(p[key])) throw new Error("PERFORMANCE_ANIMATION_GATE: " + key + " must be a non-negative integer: " + event.id);
    }
    if (p.anticipation_frames > 24 || p.hold_frames > 90 || p.settle_frames > 45) throw new Error("PERFORMANCE_ANIMATION_GATE: performance timing exceeds the supported envelope: " + event.id);
    if (p.focus && !reservedFocus.has(p.focus) && !entityIds.has(p.focus)) throw new Error("PERFORMANCE_ANIMATION_GATE: focus target is not a scene entity/reserved focus: " + event.id);
    if (p.focus === event.target) throw new Error("PERFORMANCE_ANIMATION_GATE: use focus=self instead of targeting the same entity: " + event.id);
    if (p.phase === "reaction" && !p.cause_event_id) throw new Error("PERFORMANCE_ANIMATION_GATE: reaction needs cause_event_id: " + event.id);
    if (p.cause_event_id && !priorEventIds.has(p.cause_event_id)) throw new Error("PERFORMANCE_ANIMATION_GATE: cause_event_id must reference an earlier event: " + event.id);
    if (event.target !== "camera" && event.state_before !== event.state_after && p.anticipation_frames + p.hold_frames + p.settle_frames === 0) {
      throw new Error("PERFORMANCE_ANIMATION_GATE: story-changing event needs anticipation, hold, or settle timing: " + event.id);
    }
    priorEventIds.add(event.id);
  }
};

export const validatePerformanceTiming = (scene, resolvedEvents) => {
  for (const event of scene.events ?? []) {
    const causeId = event.performance?.cause_event_id;
    if (!causeId) continue;
    const causeFrame = resolvedEvents[causeId];
    const reactionFrame = resolvedEvents[event.id];
    if (!Number.isInteger(causeFrame) || !Number.isInteger(reactionFrame)) throw new Error("PERFORMANCE_CAUSALITY: unresolved cause/reaction frame: " + event.id);
    if (reactionFrame <= causeFrame) throw new Error("PERFORMANCE_CAUSALITY: reaction must occur after its cause: " + event.id);
  }
};

export const performanceMotionValues = (frame, motionDuration, performance, focusDirection = 0) => {
  const neutral = {x:0,y:0,rotate_deg:0,scale:1,opacity:1};
  if (!performance) return neutral;
  const energy = clamp01(performance.energy);
  const anticipation = Math.max(0, performance.anticipation_frames ?? 0);
  const hold = Math.max(0, performance.hold_frames ?? 0);
  const settle = Math.max(0, performance.settle_frames ?? 0);
  const direction = focusDirection === 0 ? 1 : Math.sign(focusDirection);
  if (frame < 0) {
    if (!anticipation || frame < -anticipation) return neutral;
    const raw = anticipation <= 1 ? 1 : (frame + anticipation) / (anticipation - 1);
    const p = Math.max(0, Math.min(1, raw));
    const eased = p * p * (3 - 2 * p);
    return {x:-direction*5*energy*eased,y:2.5*energy*eased,rotate_deg:-direction*1.4*energy*eased,scale:1-0.012*energy*eased,opacity:1};
  }
  if (frame < motionDuration) {
    const p = frame / Math.max(1, motionDuration - 1);
    const pulse = Math.sin(Math.PI * Math.max(0, Math.min(1, p)));
    const reaction = performance.phase === "reaction" ? -1 : 1;
    return {x:direction*reaction*4*energy*pulse,y:-2*energy*pulse,rotate_deg:direction*reaction*1.6*energy*pulse,scale:1+0.018*energy*pulse,opacity:1};
  }
  if (frame < motionDuration + hold) return neutral;
  const settleFrame = frame - motionDuration - hold;
  if (settle > 0 && settleFrame < settle) {
    const p = settleFrame / Math.max(1, settle - 1);
    const decay = 1 - Math.max(0, Math.min(1, p));
    const wobble = Math.sin(p * Math.PI * 2) * decay;
    return {x:direction*2*energy*wobble,y:-1.2*energy*Math.abs(wobble),rotate_deg:direction*0.9*energy*wobble,scale:1+0.006*energy*Math.abs(wobble),opacity:1};
  }
  return neutral;
};
