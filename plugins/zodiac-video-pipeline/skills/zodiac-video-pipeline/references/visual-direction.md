# Channel visual system and compile

## HARD STYLE LOCK
Use `paper-doodle-chibi-meme`, token `zodiac-paper-doodle-meme-v4`, Human Stroke v2. Historical V3 provenance is not an active asset dependency.

## Composition and identity
Use Frame -> Mechanic -> Character Assembly/Skin -> Environment -> Scene Direction. Choose body silhouette, hair, face, accessory, outfit and shirt/sign identity once; change pose/expression/crop for performance. Body variation uses authored geometry, never whole-body scaling. Compile geometry before framing.

Use semantic shot/focus/continuity and existing two-person cast. Camera changes do not replace story progression. Every fresh scene needs a narration-grounded Scene Accent with a visibility lifecycle. Actors remain independent of walls; physical furniture stays a prop. Scene Sets are recovery-only.

Keep native hands visible and bind actual post-pose grips/contact. Invalid: state-level identity swaps, legacy copies, repeated centered framing, prop wallpaper or camera motion hiding static storytelling.

## Meme is performed by the channel's cast
Keep paper, ink, hair, silhouette and shirt/sign. Establish normal setup, narrated reversal and exaggerated reaction. Never import meme characters or materialize retired effect metadata; leave serious passages quiet.

Native adapters by situation:
- Self-cringe/bravado collapse: `facepalm-closeup`, `cry-closeup`.
- Denial/self-recognition: `receipt-in-face`, `mirror-self-check`; actual prop/gaze/contact must expose the contradiction.
- Excess affection/empty boast: `heart-offer-overkill`, `wallet-flex`.
- Waiting/exhaustion: `impatient-wait`, `exhausted-slump`.
- Friendly warning/retracting a claim: `smiling-threat`, `take-that-back`.
- Exit/teasing: `polite-exit`, `playful-cheek-poke`; cheek contact must be real.
- Concession/disbelief: `innocent-shrug`, `awkward-grin`, `silent-judgment`.

For the full situation map and humor review, load `asset-library-v4/memes/README.md` when a meme is selected. Use a normal setup, a performed `meme-*` face at the reversal and story-specific focal lettering; do not treat a stock phrase plus a neutral sticker as a finished joke.

Bind reaction states in the existing grammar:
```json
"meme_composition": {
  "id": "facepalm-closeup",
  "bindings": {"actor": "hero"},
  "state_bindings": {"actor": "realization"}
}
```
Start normally, then transition at the approved voice anchor into the adapter's visible, reachable pose/expression/crop. Bind other acting roles likewise. Missing `state_bindings` retains legacy initial-state acting. Set `meme_selected` through the existing configuration tool; props, contacts, coverage and caption safety remain required.

Every fresh beat declares `layers.meme=use/omit` with a specific reason. Use requires reacting character `entity_ids`, selected adapter, `state_bindings` and its actual anchored reaction in that beat's `event_ids`. A flag, adapter name or initial punchline pose is insufficient. Completeness rejects absent decisions, unperformed selections and omitted reactions that occur in the beat; there is no quota.

Plan lettering independently with `references/story-text.md`: setup -> reaction -> payoff. Optional meme `label` binds an existing object with anchored visibility outside interaction participants. Release it when its job ends, and never pre-empt a punchline. Review phone-size endpoints and later audio-aligned runtime timing; native PASS is not creative approval.

Every fresh coverage beat explicitly decides story_text and meme use/omit with an editorial reason. Selected lettering needs authored overlays. A selected meme needs native acting in a visible, reachable reaction state entered from a normal setup at the exact voice anchor; initial punchline poses alone do not perform a reversal. Quiet omissions remain valid.
