// Layout self-check. Open the overlay with ?audit=1 and it reports, every 3 seconds, any element that
// leaves the 1080×1920 stage, text that spills out of its box, or blocks that overlap. Issues show in
// a red badge (not in the stream if you leave ?audit off) and in the browser console.
export function runAudit() {
  const stage = document.getElementById('stage'), sr = stage.getBoundingClientRect(), k = sr.width / 1080, out = [];
  const name = el => (el.id ? '#' + el.id : typeof el.className === 'string' && el.className.trim() ? `${el.tagName.toLowerCase()}.${el.className.trim().split(/\s+/).join('.')}` : el.tagName.toLowerCase());
  const clampOk = '.call,.lines p,.fine,.opt span,.modal h2,#center .sub';
  for (const el of stage.querySelectorAll('*')) {
    if (el.closest('svg') && el.tagName !== 'svg') continue;
    if (['CANVAS', 'SCRIPT', 'STYLE'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (el.closest('#wheel .ring') || el.id === 'hero' || el.id === 'scrim' || el.id === 'audit') continue;
    const worst = Math.max((sr.left - r.left) / k, (r.right - sr.right) / k, (sr.top - r.top) / k, (r.bottom - sr.bottom) / k);
    if (worst > 1) out.push(`OUTSIDE ${name(el)} by ${Math.round(worst)}px`);
    if (cs.overflow === 'visible' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && !el.children.length && cs.display !== 'inline') out.push(`SPILL ${name(el)} "${(el.textContent || '').slice(0, 24)}"`);
    if (['hidden', 'clip'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 2 && !el.matches(`${clampOk},#event,#center,.slide,.node,#wheel`)) out.push(`CLIPPED ${name(el)} ${el.scrollHeight}>${el.clientHeight}`);
  }
  const box = sel => { const e = document.querySelector(sel); if (!e || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { sel, t: (r.top - sr.top) / k, b: (r.bottom - sr.top) / k, l: (r.left - sr.left) / k, r: (r.right - sr.left) / k }; };
  const blocks = ['#top', '#event', '#base'].map(box).filter(Boolean);
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i], b = blocks[j];
    if (a.t < b.b - 1 && b.t < a.b - 1 && a.l < b.r && b.l < a.r) out.push(`OVERLAP ${a.sel} × ${b.sel}`);
  }
  return [...new Set(out)];
}

export function startAudit() {
  const badge = document.createElement('div');
  badge.id = 'audit';
  badge.style.cssText = 'position:absolute;left:8px;top:8px;z-index:99;max-width:520px;padding:6px 10px;border-radius:8px;font:700 16px/1.3 system-ui;background:#c43c3c;color:#fff;display:none;white-space:pre-wrap';
  document.getElementById('stage').append(badge);
  setInterval(() => {
    const issues = runAudit();
    badge.style.display = issues.length ? 'block' : 'none';
    badge.textContent = issues.slice(0, 6).join('\n');
    if (issues.length) console.warn('[audit]', issues);
  }, 3000);
  window.runAudit = runAudit;
}
