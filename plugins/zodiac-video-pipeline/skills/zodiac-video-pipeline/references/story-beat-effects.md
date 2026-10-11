# Story-beat effects — V4 narrative choreography

Purpose: visual effects actively communicate a change in the story, not just decorate props.

1. Select semantic beat: `observation`, `noticing`, `barrier`, `subtext`, `contrast`, `distance`, `realization`, `payoff`.
2. Use exact approved voice anchor and a later release anchor; pair `enter` and `release` on a native effect entity, initially hidden.
3. Focus effect relative to speaker, eyeline or interpersonal gap; don't hide faces or captions.
4. Reuse verified library asset and lightweight transform/opacity motions; don't create a new SVG just to fake pose animation.
5. Distinguish standard narrative effect from meme composition. Meme requires explicit selection, native contact checks and enter/peak/release.
6. Keep effects sparse: emphasize cause → reversal → consequence. Emotional payoff can use restraint rather than confetti.
7. Before Visual Review run `node orchestration/validate-story-beat-choreography.mjs <workspace>` and all manifest validators, compile native preview pairs again. A structural PASS never substitutes for visual inspection.
8. Record effects in `.authoring/story-beat-choreography.json` using `zodiac-story-beat-choreography@1`, with semantic role, voice and release anchors, referenced entity and native asset master.

Never update user-approved Narration to satisfy a visual beat. No invented asset refs, silent meme selection or fabricated runner QA.
