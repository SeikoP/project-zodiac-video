# Coverage, checks, review, revisions

## Coverage before compilation
Each beat of Visual Intent `art_direction.visual_coverage` decides, with a real reference or an explicit omission and a reason: actor, scene accent, story visual, ordinary prop, support, caption, and meme. A symbolic metaphor cannot stand in for an ordinary prop the narration uses. Sparse composition stays legitimate for reflection and payoff beats when the omission is explained. Never add a component to make a check green.

## Five internal stages (one editorial phase)
- **2A Story plan:** semantic goals, narrated turns, scene dependencies, callbacks and payoffs, continuity. Never split approved narration just for visual variety.
- **2B Cast and shared assets:** lock hair, body, outfit and shared prop identities.
- **2C Scene production:** per scene confirm the story-focus chain, physical interactions, event endpoints and a native preview.
- **2D Cross-scene continuity:** cast identity, callback source ordering, recurring objects, payoff source.
- **2E Aggregate review:** full scenes and event endpoint pairs, then genuine user Visual Review. Scene-level authoring QC never substitutes for native frame QC or approval.

## What the checks mean
| Check | Judges |
| --- | --- |
| scene experience | story focus chain, character action, environment specificity (a depth layer or enough background area), physical storytelling, depth separation, frame occupancy about 26 % of the pre-caption field, secondary action, callback, story visual role |
| story-visual presence | required Phase 1 visual executed: entity, asset, narrative brief, coverage, reveal event |
| authoring completeness | coverage decisions present, references real |
| precompile boundary / preflight | structure before any SVG is generated |
| geometry (build QA) | nothing off-canvas, nothing inside the caption lane |
| HyperFrames check | contract, safe zones, contrast, overlap, line hold time, sound |
A PASS is structure evidence. It never proves the picture communicates, and it never grants approval.

## Failure ownership
Fix the source that owns the failure, then recompile; never edit a PASS.
| Symptom | Fix in | Who |
| --- | --- | --- |
| ids, coordinates, caption lane, canvas bounds, event spacing, prop family, overlap | Core assembly | Core, no model call |
| static scene, unclear focus, weak acting | the scene's stage or act choice | agent, at most two re-choices, then an owner card |
| identity, outfit, pose mismatch | cast design intent | agent, reopens the character's scenes |
| missing prop or art | asset request (`NEW_VARIANT_MASTER_REQUIRED`) | owner |
| story meaning or necessary wording | Phase 1 | owner |

## Revisions
Changing narration reopens content and visuals, including voice anchors and timing. Changing an identity reopens the character's checks. Changing cover copy alone must not recreate character SVGs. Reopen only the scenes whose own semantic input changed, plus dependents for review. Preserve unrelated scenes and caches. Use the impact assessment to know what to revalidate; it cannot grant approvals.

## Approvals
Voice listening, Visual Review and export approval are **genuine user actions**. No agent, validator, preview, build or CI result creates one. Report such gates as PENDING until the user acts. Human review also judges what machines cannot: faces, emotion, tone, whether the accent drawing matches its declared setting, and whether each Story Visual reads muted at phone size.

## Frame-review finding codes
When frames of a build are looked at, each scene is `ok` or `fix` with codes: `FOCUS_UNCLEAR` (the eye does not know where to land or who does what), `ACTOR_HIDDEN` (a character is cut, covered or too small), `COMPOSITION_UNBALANCED` (everything crowds one side or leaves dead space), `STATIC_SCENE` (nothing visibly changes between early and late frame), `PROP_IRRELEVANT` (a prop the story does not use), `TEXT_UNREADABLE` (lettering too small or low contrast at phone size), `STORY_MISMATCH` (the frame shows something other than the narration), `OTHER`. A `fix` carries ONE concrete instruction for the scene (what to change, in the scene's own words), never a restyle of the episode. The repair must answer the code: `FOCUS_UNCLEAR` is fixed by a contact or a reaction between the actors on the anchor, `STATIC_SCENE` by a second acting turn or a picture reveal.
