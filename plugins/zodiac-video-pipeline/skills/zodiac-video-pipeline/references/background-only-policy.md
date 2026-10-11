# Background-only composition policy (2.4.38)

**Environment backgrounds express place, not story action.** Auto-generated environment cue layers should contain static architectural identity (walls, windows, floor edges, outdoor lines, hallway lockers, signage when ambient); never auto-inject desk/table, bed, pillow, blanket, sofa, chair, kitchen counter/cabinet, or other scene furniture by profile alone. `backgroundOnlyRoles()` is applied by native Environment Compile and Binding Validation.

**Exception for spoken props:** If a piece of furniture is explicitly required by Narration, author it as a **separate semantic `prop` or `object`** in `production.json`, with exact native asset, performer relation, states, transitions, and timed event(s) as appropriate. Never silently generate it from an environment profile. Do not filter story props by asset name; only filter `env__` structural cues.

**Avoid accidental background emptiness:** Preserve existing scene-set background panels (architectural wall / floor planes / palette, behind actors). When an environment profile lacks sufficient ambient structure, expand the architectural scene-set or rear cues, not auto furniture. Caption-safe area and V4 paper token remain mandatory.

**Existing imported jobs:** Do not rewrite sealed archives or local renderer state; this policy takes effect on future Phase-02 compilation, and requires recompilation and new receipts for affected workspaces.

**Timing:** S03 timestamp, ASR diagnostics and local runner alignment fixes live in the GitHub runner, not this plugin; do not claim local fixes were tested or synchronized here.
