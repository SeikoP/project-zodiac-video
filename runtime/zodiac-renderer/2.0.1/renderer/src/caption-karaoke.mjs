export const CAPTION_STROKE_PX = 2;
export const CAPTION_BOUNCE_PX = 2;

export function validateCaptionWords(caption) {
  if (caption.words === undefined) return;
  const textWords = caption.text.match(/[\p{L}\p{N}_]+/gu) ?? [];
  if (!Array.isArray(caption.words) || !caption.words.length || caption.words.length !== textWords.length)
    throw new Error('CAPTION_WORD_TIMING_INVALID');
  let previousEnd = -Infinity;
  for (const [index, word] of caption.words.entries()) {
    if (typeof word.text !== 'string' || word.text.normalize('NFC') !== textWords[index].normalize('NFC') ||
        !Number.isFinite(word.start_frame) || !Number.isFinite(word.end_frame) ||
        word.end_frame <= word.start_frame || word.start_frame < previousEnd - 1e-6 ||
        word.start_frame < caption.start_frame - 0.5 || word.end_frame > caption.end_frame + 0.5)
      throw new Error('CAPTION_WORD_TIMING_INVALID');
    previousEnd = word.end_frame;
  }
}

export function resolveCaptionWordLines(caption, frame) {
  validateCaptionWords(caption);
  let index = 0;
  return caption.resolved_layout.lines.map(line =>
    line.split(/([\p{L}\p{N}_]+)/u).map(text => {
      const word = /^[\p{L}\p{N}_]+$/u.test(text) ? caption.words?.[index++] : undefined;
      const active = !!word && frame >= word.start_frame && frame < word.end_frame;
      const progress = active ? (frame - word.start_frame) / (word.end_frame - word.start_frame) : 0;
      return {text, active, lift: active ? CAPTION_BOUNCE_PX * Math.sin(Math.PI * progress) : 0};
    }).filter(part => part.text.length));
}
