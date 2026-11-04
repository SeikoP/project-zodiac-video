// Pure view math for the Vườn Mây page (no DOM), so it can be tested in Node.
export const lodOf = zoom => (zoom < 0.27 ? 'dot' : zoom < 1.25 ? 'plot' : 'close');

export function slotLayout(slot, cfg) {
  const row = Math.floor(slot / cfg.potsPerShelf);
  const col = slot % cfg.potsPerShelf;
  return { module: 0, moduleCol: 0, moduleRow: 0, row, col,
    x: cfg.zoneMarginX + col * cfg.potSpacingX,
    y: cfg.zoneMarginY + row * cfg.shelfSpacingY };
}

export function plotPos(plot, { cfg }) {
  const p = slotLayout(plot.slot, cfg);
  return { x: p.x, y: p.y };
}

export function easeCamera(from, to, elapsedMs, easeMs = 600) {
  const t = Math.min(1, Math.max(0, elapsedMs / easeMs));
  if (t >= 1) return { ...to };
  const s = t * t * t * (t * (t * 6 - 15) + 10);
  return { x: from.x + (to.x - from.x) * s, y: from.y + (to.y - from.y) * s, zoom: from.zoom * (to.zoom / from.zoom) ** s };
}

export const worldToScreen = (p, cam, vp) => ({ x: (p.x - cam.x) * cam.zoom + vp.w / 2, y: (p.y - cam.y) * cam.zoom + vp.h / 2 });

export function visiblePlots(plots, cam, vp, meta, margin = 160, maxDetail = 120) {
  const owned = plots.filter(p => p.owner && p.awake !== false);
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
