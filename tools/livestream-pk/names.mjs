// Everything a viewer controls that ends up on the stream passes through here first:
// nicknames (control and bidi characters removed, length capped, links/phone numbers and blocked words
// replaced) and avatar URLs (https images from TikTok's own CDNs only).
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g;
const strip = s => s.normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd');
const LINKISH = /https?:|www\.|\.(com|vn|net|me|io|ly|xyz)\b|\d{8,}|\S@\S+\.\S+/i;

export function cleanName(raw, blockedWords = [], max = 32) {
  const s = String(raw ?? '').normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  if (!s || LINKISH.test(s)) return 'Người xem';
  const lower = s.toLowerCase();
  const words = new Set(lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const plain = new Set([...words].map(strip));
  if (blockedWords.some(w => { const b = String(w).toLowerCase(); return words.has(b) || plain.has(strip(b)); })) return 'Người xem ẩn danh';
  const chars = Array.from(s);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : s;
}

const CDN = /(^|\.)(tiktokcdn(-us|-eu)?\.com|ibyteimg\.com|byteimg\.com|tiktokv\.com|tiktok\.com)$/i;
export function safeAvatar(url) {
  try {
    const u = new URL(String(url ?? ''));
    return u.protocol === 'https:' && CDN.test(u.hostname) ? u.href : '';
  } catch { return ''; }
}
