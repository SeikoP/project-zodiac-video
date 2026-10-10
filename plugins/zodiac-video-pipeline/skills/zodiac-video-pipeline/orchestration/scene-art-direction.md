# Scene art direction gate — Phase 02 (proposed extension)

Before authoring `production.json`, split the approved Narration into voiced performance segments. Preserve exact narration order and content. Each segment declares what the audience **must see**, its real performing subject, required concrete props, environment profile, semantic palette, shot, and asset/event cost justification. This is authoring guidance and does not add fields to `zodiac-job@5`.

Use `art-direction/palette-registry.json` (canonical colors only) and `art-direction/environment-registry.json` (profiles from the installed V4 composition index). Palettes represent **accents and distribution of existing token colors**, not repainting V4 assets, creating full-background SVGs, or modifying hardcoded renderer fields.

Story Objects are **optional semantic highlights**. Never require one in each scene or depict its SVG as a full background. A Story Object appears only when an explicit voice anchor benefits from metaphor, never in place of physical actions and reaction objects. Preserve explicit effect enter/release events in native production, and enforce visual roles and spatial contact via existing validators.

Run `node orchestration/validate-scene-art-direction.mjs <workspace>` before authoring; then native V4 compilers, full Phase-02 manifest, Director V2, preview pairs, and human Visual Review. **This extension is a design-time gate only. PASS does not mean native execution PASS.**
