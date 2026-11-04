// The quiz bank. The twelve-sign questions (and the sign profiles they came from) left with the zodiac content;
// the colour-team questions arrive later. Until then the generated bank is empty, which the game and server accept:
// startQuiz() simply returns false. Hand-written { q, options, answer } entries in quiz.json are still honoured.

// Small seeded PRNG so a bank can be reproduced (mulberry32).
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Kinds a newcomer can answer at a glance (none generated for now).
export const EASY = new Set();

// extra: hand-written { q, options, answer } from quiz.json. Returns a flat list (empty when there is nothing).
export function buildQuizBank({ extra = [] } = {}) {
  const seen = new Set();
  return extra
    .filter(x => x?.q && Array.isArray(x.options) && x.options.length >= 2 && 'ABCD'.includes(x.answer))
    .filter(x => !seen.has(x.q) && seen.add(x.q))
    .map(x => ({ kind: 'trivia', ...x }));
}
