# Channel visual system and compile

## HARD STYLE LOCK
New production uses `paper-doodle-chibi-meme`, token `zodiac-paper-doodle-meme-v4`, Human Stroke v2. Historical V3 provenance is not an active asset dependency.

## Visual Grammar + Character Assembly
Use `Frame → Mechanic → Character Assembly/Skin → Environment → Scene Direction`.

Choose silhouette, hair, face, accessories and outfit once per character. States change pose/expression only. Body profiles use authored paths, never scale-only height/weight. Compile character geometry before Scene Direction framing.

## Scene direction
Do not center every beat. Use semantic shot/focus/continuity; shot changes never substitute for story progression. Two-person blocking binds existing cast only.

## Environments
Every fresh scene needs a sparse, narration-grounded Scene Accent with a visibility lifecycle. Actors are independent of walls; physical furniture stays a prop. Scene Sets are recovery-only.

## Handmade + contact
Use v4/Human Stroke v2. Native hands remain visible; hidden pose-aware anchors bind actual grips/contact after posing.

Invalid: state-level identity swaps, scale-only body variants, legacy direct-copy, full-scene backgrounds, prop wallpaper, repeated centered framing, or camera motion hiding static storytelling.

## Meme is performed by the channel's cast

Use a readable setup, narrated reversal and exaggerated reaction. Keep channel identity: paper, ink, hair, silhouette and shirt/sign; vary pose/expression/crop. Never import a meme character or materialize historical `effect` metadata.

Land reactions at narrated turns. Select for situation; keep serious passages quiet.

Consider independent story lettering, beyond memes/captions: `references/story-text.md`. Declare use/omit in coverage, anchor reveal/release, and keep faces/captions clear.

| Narrated situation | Native adapter | What must read without captions |
|---|---|---|
| Self-cringe / bravado collapses | `facepalm-closeup` / `cry-closeup` | Composure changes into palm-over-face / tears |
| Denies evidence / notices own fault | `receipt-in-face` / `mirror-self-check` | Actual prop, gaze and contact expose contradiction |
| Excess affection / empty boast | `heart-offer-overkill` / `wallet-flex` | Heart offer / wallet contradicts the claim |
| Waiting / exhausted competence | `impatient-wait` / `exhausted-slump` | Hands on hips / body slumps |
| Friendly warning / retract a claim | `smiling-threat` / `take-that-back` | Sweet expression contrasts with held prop |
| Exit / teasing a friend | `polite-exit` / `playful-cheek-poke` | Clasped hands / actual cheek contact |
| Denial / awkward concession / disbelief | `innocent-shrug` / `awkward-grin` / `silent-judgment` | Shrug / embarrassed scratch / judgmental gaze |

Use the existing grammar request with role-to-state binding for the reaction:

```json
"meme_composition": {
  "id": "facepalm-closeup",
  "bindings": {"actor": "hero"},
  "state_bindings": {"actor": "realization"}
}
```

Start `hero` normally, then use a voice-anchored event into visible, reachable `realization`, with the adapter's pose/expression/crop. Bind other acting roles likewise. Without `state_bindings`, legacy initial-state acting remains. Set `meme_selected` through the existing configuration tool. Props, contacts, coverage and caption safety still apply.

Consider an adapter at each reversal; explain omissions in coverage. Reuse cast/framing, vary reactions. Establish the claim, react at its voice anchor, then release; never pre-empt the punchline. Optional `label` is an existing object with anchored visibility, outside interaction participants. Lettering must add meaning beyond captions. Review phone-size endpoints and audio-aligned timing.
