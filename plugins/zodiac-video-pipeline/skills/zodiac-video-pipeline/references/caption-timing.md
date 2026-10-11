# Caption Timing Boundary — v1.57

Captions are runtime-owned after narration approval.

## Authoring contract
Visual Compile only declares the stable scene contract:

```json
{
  "captions": {
    "source": "voice",
    "segmentation": "semantic",
    "max_lines": 2
  }
}
```

Do not author caption pages, timestamps, frame ranges, fixed word counts, line breaks or per-page font sizes.

## Runtime ownership
Zodiac Studio/runtime:
1. generates or attaches voice;
2. measures word-level timing;
3. validates that measured tokens cover approved `scene.voice`;
4. groups measured words by sentence/natural clause;
5. measures text against the safe width using the exact demo CSS font stack `"Patrick Hand", "Segoe Print", cursive`;
6. uses balanced two-line wrapping and reduces font size only inside the allowed envelope;
7. places each page in the least-overlapping safe-area position;
8. highlights the active measured word.

The approved narration text/order remains authoritative. Runtime layout may split a sentence only because measured geometry cannot fit it. Do not emit `page_target_words` or `max_words`; fixed 4–7-word slicing is forbidden. Every spoken token must be covered by measured word timing without a visible dead zone. No orphan fragments; balance visual line widths and avoid one- or two-word dangling lines.
