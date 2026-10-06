const normalizeToken = (value) => String(value)
  .normalize('NFC')
  .toLocaleLowerCase('vi-VN')
  .replace(/[\p{P}\p{S}]/gu, ' ')
  .trim()
  .replace(/\s+/gu, ' ');

const sentenceEnd = (text) => /[.!?…]["'”’)}\]]*$/u.test(String(text).trim());

const sentenceEnd = (text) => /[.!?…]["'”’)}\]]*$/u.test(String(text).trim());
const clauseEnd = (text) => /[,;:—–-]["'”’)}\]]*$/u.test(String(text).trim());
const measuredLine = (words) => words.map((word) => word.text).join(" ");
const measureBalancedLines = (words, measure, maxWidth, maxLines) => {
  if (!words.length) return [];
  const full = measuredLine(words);
  if (measure(full) <= maxWidth) return [full];
  if (maxLines < 2) return null;
  let best = null;
  for (let split = 1; split < words.length; split++) {
    const left = measuredLine(words.slice(0, split));
    const right = measuredLine(words.slice(split));
    const leftWidth = measure(left);
    const rightWidth = measure(right);
    if (leftWidth > maxWidth || rightWidth > maxWidth) continue;
    const orphanPenalty = Math.min(split, words.length - split) <= 2 ? maxWidth : 0;
    const phraseBonus = clauseEnd(words[split - 1].text) ? -maxWidth * 0.15 : 0;
    const score = Math.abs(leftWidth - rightWidth) + orphanPenalty + phraseBonus;
    if (!best || score < best.score) best = {score, lines:[left,right]};
  }
  return best?.lines ?? null;
};
const largestFittingPrefix = (words, measure, maxWidth, maxLines) => {
  let best = 0;
  let preferred = 0;
  for (let count = 1; count <= words.length; count++) {
    const lines = measureBalancedLines(words.slice(0, count), measure, maxWidth, maxLines);
    if (!lines) break;
    best = count;
    if (count >= 3 && clauseEnd(words[count - 1].text)) preferred = count;
  }
  return preferred || best;
};
const splitSemanticSentence = (sentence, measure, maxWidth, maxLines) => {
  const pages = [];
  let remaining = sentence;
  while (remaining.length) {
    const wholeLines = measureBalancedLines(remaining, measure, maxWidth, maxLines);
    if (wholeLines) { pages.push({words:remaining,lines:wholeLines}); break; }
    const count = largestFittingPrefix(remaining, measure, maxWidth, maxLines);
    if (!count) {
      const oversized = remaining.find((word) => measure(word.text) > maxWidth);
      throw new Error(oversized ? "A caption token exceeds the safe width: " + oversized.text : "Caption sentence cannot fit the measured two-line envelope.");
    }
    const part = remaining.slice(0, count);
    const lines = measureBalancedLines(part, measure, maxWidth, maxLines);
    if (!lines) throw new Error("Caption semantic split lost its measured layout.");
    pages.push({words:part,lines});
    remaining = remaining.slice(count);
  }
  return pages;
};
export const segmentCaptionWords = (words, options) => {
  const {maxLines = 2, maxWidth, measure} = options;
  if (!Array.isArray(words) || words.some((word) => typeof word.text !== "string" || !Number.isFinite(word.startMs) || !Number.isFinite(word.endMs) || word.endMs <= word.startMs)) {
    throw new Error("Caption input must contain measured, non-empty word timings.");
  }
  if (typeof measure !== "function" || !Number.isFinite(maxWidth) || maxWidth <= 0) {
    throw new Error("Measured caption layout requires a font measurement function and positive safe width.");
  }
  const sentences = [];
  let sentence = [];
  for (const word of words) {
    sentence.push(word);
    if (sentenceEnd(word.text)) { sentences.push(sentence); sentence = []; }
  }
  if (sentence.length) sentences.push(sentence);
  const pages = [];
  for (const unit of sentences) {
    for (const page of splitSemanticSentence(unit, measure, maxWidth, maxLines)) {
      pages.push({words:page.words,lines:page.lines,startMs:page.words[0].startMs,endMs:page.words.at(-1).endMs});
    }
  }
  return pages;
};

export const resolveVoiceAnchor = (anchorText, words, occurrence) => {
  const anchor = normalizeToken(anchorText).split(' ').filter(Boolean);
  if (!anchor.length) throw new Error('Voice anchor text must not be empty.');
  const tokens = words.map((word) => ({word, normalized: normalizeToken(word.text)}));
  const matches = [];
  for (let start = 0; start <= tokens.length - anchor.length; start++) {
    const candidate = tokens.slice(start, start + anchor.length).map((token) => token.normalized);
    if (candidate.every((token, index) => token === anchor[index])) matches.push(start);
  }
  if (!matches.length) throw new Error('Voice anchor not found in measured word timings: ' + anchorText);
  if (occurrence === undefined && matches.length > 1) throw new Error('Voice anchor is ambiguous; provide a 1-based occurrence: ' + anchorText);
  const index = occurrence === undefined ? matches[0] : matches[occurrence - 1];
  if (!Number.isInteger(index) || index < 0) throw new Error('Voice anchor occurrence is out of range: ' + anchorText);
  return {startMs: tokens[index].word.startMs, endMs: tokens[index + anchor.length - 1].word.endMs};
};

export const resolveProductionEvents = (production, timing) => {
  const resolved = {};
  for (const scene of production.scenes) {
    const row = timing.scenes.find((item) => item.scene_id === scene.id);
    if (!row) throw new Error('Runtime timing missing scene ' + scene.id);
    for (const event of scene.events) {
      let startFrame;
      if (event.trigger.source === 'scene_start') {
        startFrame = row.start_frame;
      } else if (event.trigger.source === 'voice_anchor') {
        const anchor = resolveVoiceAnchor(event.trigger.text, row.captions, event.trigger.occurrence);
        startFrame = Math.floor(anchor.startMs * timing.fps / 1000);
        if (startFrame < row.start_frame || startFrame >= row.start_frame + row.duration_frames) {
          throw new Error('Voice anchor falls outside scene ' + scene.id + ': ' + event.trigger.text);
        }
      } else {
        throw new Error('Unsupported event trigger in ' + event.id);
      }
      resolved[event.id] = startFrame;
    }
  }
  return resolved;
};

export const validateEventStates = (scene) => {
  const states = new Map(scene.entities.map((entity) => [entity.id, entity.initial_state]));
  for (const event of scene.events) {
    if (event.target === 'camera') continue;
    const entity = scene.entities.find((item) => item.id === event.target);
    if (!entity) throw new Error('Event target does not exist in scene ' + scene.id + ': ' + event.target);
    if (states.get(event.target) !== event.state_before) {
      throw new Error('Event state_before does not match prior state for ' + event.id);
    }
    if (!entity.states[event.state_after]) throw new Error('Event state_after is not declared for ' + event.id);
    states.set(event.target, event.state_after);
  }
};

export const validateVisualProgression = (scene, timingRow, resolvedEvents, fps, maxGapSeconds = 5) => {
  const forbiddenDecoration = /particle|glow|bounce|zoom/iu;
  const changes = scene.events.filter((event) => event.target !== 'camera' && event.state_before !== event.state_after);
  if (!changes.length) throw new Error('Visual progression requires an entity state change in ' + scene.id);
  const frames = changes.map((event) => {
    if (forbiddenDecoration.test(event.action)) throw new Error('Decoration-only event cannot count as visual progression: ' + event.id);
    const frame = resolvedEvents[event.id];
    if (!Number.isInteger(frame)) throw new Error('Unresolved visual event: ' + event.id);
    return frame - timingRow.start_frame;
  }).sort((a, b) => a - b);
  const maxGap = maxGapSeconds * fps;
  if (frames[0] > maxGap || frames.at(-1) < 0 || timingRow.duration_frames - frames.at(-1) > maxGap) {
    throw new Error('Visual progression has a gap longer than 5-second in ' + scene.id);
  }
  for (let index = 1; index < frames.length; index++) {
    if (frames[index] - frames[index - 1] > maxGap) throw new Error('Visual progression has a gap longer than 5-second in ' + scene.id);
  }
};
export const validateNarrationProgressionProxy = (scene, maxGapWords = 15) => {
  const words = normalizeToken(scene.voice).split(' ').filter(Boolean);
  const positions = [];
  for (const event of scene.events ?? []) {
    if (event.target === 'camera' || event.state_before === event.state_after) continue;
    if (event.trigger?.source === 'scene_start') {
      positions.push(0);
      continue;
    }
    if (event.trigger?.source !== 'voice_anchor') continue;
    const anchor = normalizeToken(event.trigger.text).split(' ').filter(Boolean);
    const matches = [];
    for (let start = 0; start <= words.length - anchor.length; start++) {
      if (anchor.every((token, index) => words[start + index] === token)) matches.push(start);
    }
    if (!matches.length) throw new Error('Visual progression anchor not found in narration: ' + event.trigger.text);
    if (event.trigger.occurrence === undefined && matches.length > 1) throw new Error('Visual progression anchor is ambiguous: ' + event.trigger.text);
    const selected = event.trigger.occurrence === undefined ? matches[0] : matches[event.trigger.occurrence - 1];
    if (!Number.isInteger(selected)) throw new Error('Visual progression anchor occurrence is out of range: ' + event.trigger.text);
    positions.push(selected);
  }
  const unique = [...new Set(positions)].sort((a, b) => a - b);
  if (!unique.length) throw new Error('Visual progression requires at least one story-changing event in ' + scene.id);
  const points = [0, ...unique, words.length];
  for (let index = 1; index < points.length; index++) {
    const gap = points[index] - points[index - 1];
    if (gap > maxGapWords) throw new Error('VISUAL_PROGRESSION_DENSITY: ' + scene.id + ' has ' + gap + ' words without a meaningful visual change; max ' + maxGapWords + '.');
  }
};

