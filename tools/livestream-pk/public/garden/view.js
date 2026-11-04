// Pure view math for the Vườn Mây page (no DOM), so it can be tested in Node.
// meta = { islands: string[], cfg: { plotCell, plotsPerRow, islandSize, islandCols, islandMargin } } from the server's `meta` message.

export const lodOf = zoom => (zoom < 0.5 ? 'dot' : zoom < 1.8 ? 'plot' : 'close');

// Same layout as garden/world.mjs plotCenter (a test keeps the two in step).
export function plotPos(plot, { islands, cfg }) {
  const i = islands.indexOf(plot.island);
  const ox = (i % cfg.islandCols) * cfg.islandSize, oy = Math.floor(i / cfg.islandCols) * cfg.islandSize;
  return { x: ox + cfg.islandMargin + (plot.slot % cfg.plotsPerRow) * cfg.plotCell + cfg.plotCell / 2, y: oy + cfg.islandMargin + Math.floor(plot.slot / cfg.plotsPerRow) * cfg.plotCell + cfg.plotCell / 2 };
}

// The camera between two shots: smoothstep in position, geometric in zoom (so zooming feels even).
export function easeCamera(from, to, elapsedMs, easeMs = 600) {
  const t = Math.min(1, Math.max(0, elapsedMs / easeMs));
  if (t >= 1) return { ...to };
  const s = t * t * (3 - 2 * t);
  return { x: from.x + (to.x - from.x) * s, y: from.y + (to.y - from.y) * s, zoom: from.zoom * (to.zoom / from.zoom) ** s };
}

export const worldToScreen = (p, cam, vp) => ({ x: (p.x - cam.x) * cam.zoom + vp.w / 2, y: (p.y - cam.y) * cam.zoom + vp.h / 2 });

// Which owned plots to draw: in detail (awake ones first, nearest the centre first, at most maxDetail) or as dots.
export function visiblePlots(plots, cam, vp, meta, margin = 160, maxDetail = 150) {
  const owned = plots.filter(p => p.owner);
  if (lodOf(cam.zoom) === 'dot') return { detail: [], dots: owned };
  const hw = vp.w / 2 / cam.zoom + margin, hh = vp.h / 2 / cam.zoom + margin;
  const inside = [];
  for (const p of owned) {
    const pos = plotPos(p, meta), dx = pos.x - cam.x, dy = pos.y - cam.y;
    if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) inside.push({ p, d: dx * dx + dy * dy });
  }
  inside.sort((a, b) => (b.p.awake - a.p.awake) || (a.d - b.d));
  return { detail: inside.slice(0, maxDetail).map(x => x.p), dots: inside.slice(maxDetail).map(x => x.p) };
}

// Small LRU of avatar images. `get` starts loading on the first ask and returns the image only once it is ready.
export function createAvatarCache(limit = 200, make = url => { const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; return img; }) {
  const map = new Map();
  return {
    get(url) {
      if (!url) return null;
      let img = map.get(url);
      if (img) map.delete(url);
      else { img = make(url); if (map.size >= limit) map.delete(map.keys().next().value); }
      map.set(url, img);
      return img.complete && img.naturalWidth > 0 ? img : null;
    },
  };
}
