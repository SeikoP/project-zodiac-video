# Channel visual system and compile

## HARD STYLE LOCK
New production uses `paper-doodle-chibi-meme`, token `zodiac-paper-doodle-meme-v4`, Human Stroke v2. Historical V3 provenance is not an active asset dependency.

## Visual Grammar + Character Assembly
Use `Frame → Mechanic → Character Assembly/Skin → Environment → Scene Direction`.

Choose silhouette, hair, face, accessories and outfit once per character. States change pose/expression only. Body profiles use authored paths, never scale-only height/weight. Compile character geometry before Scene Direction framing.

## Scene direction
Do not center every beat. Use semantic shot/focus/continuity; shot changes never substitute for story progression. Two-person blocking binds existing cast only.

## Environments
Fresh production uses a canvas with sparse, narration-grounded Scene Accents. Every fresh scene needs a visible context cue; it may enter/leave with the narrated passage. Accents do not constrain actor positioning to a wall. Keep physical furniture as narrated props. Legacy Scene Sets remain recovery-only.

## Handmade + contact
Characters, props/effects and structural cues use v4/Human Stroke v2. Native character poses include visible hand contours and a hidden pose-aware prop anchor; grip/contact still follows post-pose semantic anchors and readability contracts.

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

For each narrated reversal, consider a situation-matched adapter in visual coverage; omit with a story reason when inappropriate. Reuse cast and framing, not the same reaction repeatedly. Let setup establish the claim, reaction land at its anchor, and the next beat release it; never show the punchline early. Optional `label` binds an existing object with voice-anchored visibility, not an interaction participant. Use short lettering only when it adds a joke beyond captions. Review at phone size, then check audio-aligned timing.
