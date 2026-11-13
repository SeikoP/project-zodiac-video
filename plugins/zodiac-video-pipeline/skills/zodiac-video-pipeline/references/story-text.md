# Story Text in Phase 2

Story Text is short authored lettering used when a few readable words explain the scene's key point better than a Narrative Visual.

A scene may contain **Story Text or Narrative Visual, never both**. This is a focal-semantic-layer rule, not a density quota: a scene may use neither.

Choose Story Text for a short reply, thought, verdict, label, score, product reveal, annotation, or punchline where the words themselves are the clearest content. Choose Narrative Visual only when a concrete visible action/state communicates the point better than text.

Author `kind: object`, `visual_role: overlay`, `category: overlay` SVGs with `story_text: {purpose, reason, states, styles}` in Visual Intent. Purposes: setup, contrast, payoff, annotation, dialogue, internal_voice.

Start hidden. Reveal/change/release at exact voice anchors; a final hold needs `hold_to_scene_end_reason`. Replace text rather than accumulating it. Never reveal a punchline early. Keep one focal Story Text entity at a time.

Supported treatments: `bubble`, `thought`, `burst`, `whisper`, `tag`, `ribbon`, `underline`, `sfx`, `note`, `stamp`, `score`, `title`. Choose by meaning, not rotation. Compact styles normally use 1–4 words; shorten rather than shrink long prose.

## Make the meme wording land

When a meme's joke depends on its wording, Story Text is the focal payoff, not a small decorative label. Preserve the recognizable verbal turn and adapt its subject to the approved story. Do not replace it with a generic emotion label or transcribe the whole narration. Examples: `Đừng nói nữa`, `Lần sau không dám nữa`, `Đề nghị nghiêm túc!`, `Alo, chú công an ơi!`.

Establish the setup without the answer; reveal the phrase at the exact reaction voice anchor, with the actor's pose/expression supporting that meaning. Use `burst` for an outburst, `stamp` for a verdict, `bubble` for a spoken reply, or `thought` for an internal reaction. Give the key words the strongest contrast and a clear place near the reacting actor, away from faces and runtime captions. Judge the lettering at a 270×480 preview: the whole phrase must be readable without zooming. For a longer recognizable phrase, author two short lines and enlarge the lettering area; never squeeze it into tiny type. Hold until it can be read alongside the voice, then release at an authored anchor.

Use one text surface for the punchline. For story-specific wording, author a normal `story_text` overlay and omit the adapter's optional `label` binding: the meme prop compiler owns stock labels and would replace their state assets with its stock phrase. Declare `layers.story_text=use` for authored lettering and `layers.meme=use` for the performed reaction. Do not show a stock label, another Story Text copy and the same sentence as a competing headline. Runtime captions remain runtime-owned. If removing the phrase removes the joke, a text-free acting preview cannot pass the creative review for that beat.

Make the wording do comedic work. It should expose the specific contradiction, failed cover story or disproportionate response: `TẮT LOA / KHÔNG TẮT MIC` has a consequence; `Cười trừ` only names an emotion. Break lines by the turn in meaning, not an equal character count. One line establishes or withholds; the emphasized line lands the reversal. Preserve a recognizable stock quote when it fits, but supply the story-specific setup that makes it funny. Do not substitute random slang, insults, all caps or a larger font for a joke. Judge setup, performed reaction and words together; technical checks cannot certify humor.

Story Text may coexist with actors, physical props, Scene Accent, effects, and runtime captions. It may not coexist with Narrative Visual in the same scene.

Bake safe path SVG lettering before projection, then run completeness, style/geometry/caption, event-pair, phone-size preview, and human Visual Review. Structural PASS never approves creative quality or final timing.
