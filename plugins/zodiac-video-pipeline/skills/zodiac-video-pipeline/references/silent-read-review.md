# Silent Read Review

Create `.authoring/silent-read-review.json` after the final narration draft and before Content Review.

Reviewer role: `silent_reader`.

Judge the text while deliberately ignoring TTS delivery, music, captions, animation, cuts and visual acting. Exact criteria:

- `premise_clarity`
- `progression_without_performance`
- `contradiction_reframe_legibility`
- `recognition_on_page`
- `payoff_without_audiovisual_help`
- `ending_energy_on_page`
- `sign_irreplaceability_on_page`

Every criterion requires an actual narration excerpt. If the text only works because a voice actor, sound effect, caption reveal or edit is imagined, mark REVIEW and revise narration or concept at the owning layer.

The review binds SHA-256 of `narration.txt`, `narrative-plan.json` and `concept-candidates.json`. Run `references/validate-silent-read-review.mjs <workspace>`.
