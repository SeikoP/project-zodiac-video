const phases = new Set(["anticipation","action","reaction","hold","settle"]);
const reservedFocus = new Set(["audience","self","offscreen_left","offscreen_right"]);
const finiteInt = (value) => Number.isInteger(value) && value >= 0;
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value)));

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
    const p = (frame + anticipation) / Math.max(1, anticipation);
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
