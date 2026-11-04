// A/B/C community heart rotation. Likes never seat viewers or execute care commands.
import { bump, isAwake } from './world.mjs';

export const HEART_KINDS = Object.freeze(['care', 'community', 'luck']);
export const HEART_MILESTONES = Object.freeze([100, 500, 1000]);
const newHearts = () => ({ step: 0, progress: 0, total: 0, revision: 0 });
export const heartStatus = state => {
  const h = state.hearts ?? newHearts();
  const next = HEART_MILESTONES[h.step] - (h.step ? HEART_MILESTONES[h.step - 1] : 0);
  return { step: h.step, kind: HEART_KINDS[h.step], progress: h.progress, target: next, total: h.total, revision: h.revision };
};

export function applyHearts(ctx, data) {
  const count = Number(data?.count);
  if (!Number.isSafeInteger(count) || count < 0 || (!count && !data?.drain)) return { ok: false, reason: 'invalid-count' };
  const h = ctx.state.hearts ??= newHearts();
  h.progress += Math.min(count, 10000);
  h.total += Math.min(count, 10000);
  const effects = [];
  // Never generate a burst of overlays from one batched packet; carry the rest to subsequent ticks.
  while (effects.length < 1) {
    const target = HEART_MILESTONES[h.step] - (h.step ? HEART_MILESTONES[h.step - 1] : 0);
    if (h.progress < target) break;
    h.progress -= target;
    const kind = HEART_KINDS[h.step];
    h.step = (h.step + 1) % HEART_KINDS.length;
    const eligible = Object.values(ctx.state.plots).filter(p => p.owner && isAwake(ctx, p) && p.crop && p.crop.progress < 1);
    if (kind === 'care' && eligible.length) {
      const plot = eligible[Math.floor(ctx.rng() * eligible.length)];
      boost(ctx, plot, .02);
    } else if (kind === 'community') {
      for (const plot of eligible) boost(ctx, plot, .01);
    }
    // Luck is a visual, non-economic celebration; it cannot create an undeserved player reward.
    h.revision++;
    ctx.emit({ type: 'heart-milestone', kind, step: h.step, total: h.total });
    effects.push(kind);
  }
  h.revision++;
  return { ok: true, effects, status: heartStatus(ctx.state) };
}

function boost(ctx, plot, gain) {
  const crop = plot.crop;
  const already = Math.max(0, Number(crop.heartBonus) || 0);
  const available = Math.max(0, .10 - already);
  const delta = Math.min(gain, available, Math.max(0, .999 - crop.progress));
  if (!delta) return;
  crop.progress += delta;
  crop.heartBonus = already + delta;
  bump(ctx, plot);
}

// Once per simulation tick, consume at most one deferred milestone.
export function tickHearts(ctx) {
  const h = ctx.state.hearts;
  if (!h) return;
  const target = HEART_MILESTONES[h.step] - (h.step ? HEART_MILESTONES[h.step - 1] : 0);
  if (h.progress >= target) applyHearts(ctx, { count: 0, drain: true });
}
