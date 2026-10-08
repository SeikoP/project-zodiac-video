// Pure, deterministic event-local motion. No timers, randomness or inferred narration.
const bounded = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (v) => {const t = bounded(v); return t * t * (3 - 2 * t);};
export const SUPPORTED_MOTIONS = Object.freeze([
  "state_swap", "open_shift", "reaction_pop", "effect_pop", "effect_pulse", "effect_wiggle",
  "effect_emphasis", "effect_dissolve", "phone_ping",
  "prop_pickup", "prop_offer", "prop_receive", "prop_drop", "prop_shake",
]);

export function semanticMotionAtFrame(event, frame, {role = "character", entering = false, exiting = false} = {}) {
  const neutral = {dx: 0, dy: 0, rotate: 0, scale: 1, opacity: 1};
  if (!event || frame < event.start_frame || frame >= event.end_frame) return neutral;
  const preset = event.motion;
  if (!SUPPORTED_MOTIONS.includes(preset)) throw new Error(`MOTION_PRESET_UNSUPPORTED ${preset}`);
  const length = Math.max(1, event.end_frame - event.start_frame);
  const phase = bounded((frame - event.start_frame + 1) / length);
  const eased = smoothstep(phase);
  const pulse = Math.sin(Math.PI * phase) ** 2;
  const motion = {...neutral};
  if (entering) {motion.opacity = eased; motion.scale = 0.90 + 0.10 * eased;}
  if (exiting) {motion.opacity = 1 - eased; motion.scale = 1 - 0.08 * eased;}
  if (role === "environment") return neutral;
  if (role === "character") {
    motion.scale *= 1 + 0.010 * pulse;
    motion.rotate = 0.9 * pulse;
    return motion;
  }
  switch (preset) {
    case "effect_pop": motion.scale *= 1 + 0.18 * pulse; break;
    case "effect_pulse":
    case "phone_ping": motion.scale *= 1 + 0.12 * pulse; break;
    case "effect_wiggle": motion.rotate = Math.sin(phase * 4 * Math.PI) * 6 * pulse; break;
    case "effect_emphasis": motion.scale *= 1 + 0.10 * pulse; break;
    case "effect_dissolve": motion.opacity *= 1 - eased; break;
    case "prop_pickup": motion.dy = -18 * pulse; break;
    case "prop_offer": motion.dx = 14 * pulse; break;
    case "prop_receive": motion.dx = -14 * pulse; break;
    case "prop_drop": motion.dy = 14 * pulse; break;
    case "prop_shake": motion.rotate = Math.sin(phase * 6 * Math.PI) * 5 * pulse; break;
    case "open_shift":
    case "reaction_pop":
    case "state_swap": break;
  }
  return motion;
}
