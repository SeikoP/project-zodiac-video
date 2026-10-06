# Production handoff v3.0

`production.json` is the machine-readable source for scenes, visual entities/states, event timeline, transitions, SFX, captions, asset registry, and compiled VisualStyleToken.

## HARD STYLE LOCK
Canonical visual family: `paper-doodle-chibi-meme`  
Canonical token: `zodiac-paper-doodle-meme-v3`

## Canonical narration serialization
For every new package, generate `narration.txt` from the final `production.json` only:

```python
narration = "\n".join(scene["voice"] for scene in production["scenes"])
```

Preserve internal newlines already present inside a scene voice. Never add a blank line as a scene separator. Do not add a final LF. Validation must compare this exact serialization; a receipt using different normalization is invalid.

## Structured handoff boundary
New packages require `handoff-manifest.json` with:
- non-empty `package_id`;
- non-empty `plugin_version`;
- `status[]` containing `LOCAL_RUNTIME_PENDING` or `RENDER_READY`.

README text is human-facing and must not be used as a magic machine marker.

## Asset library lineage
Phase 5 derives production states from reusable masters. Final runtime asset paths MUST remain package-owned under `assets/**`.

## Caption/design lock
`production.caption_style` is compiled from the marked VisualStyleToken in `design.md`. Font family/weight/default/min size/max lines and safe area must match exactly. When `caption_emphasis.ghost_frame=true`, `caption_style.background` must be `transparent`.

## Publish layer
Final creative packages include exactly two publish files for new work:
- `publish/publish-copy.txt` — all user-facing text in one copy-friendly file;
- `publish/publish.json` — machine-readable cover/caption/hashtag metadata.

Cover identity is mandatory even when the hook omits the sign. Cover visuals reuse existing production scene/entity states by default.

## Local-continuation package
New packages use `zodiac-job@3` and are data-only. Include `package-manifest.json`, `design.md`, canonical `narration.txt`, `production.json`, receipts, `handoff-manifest.json`, only referenced `assets/**`, and `publish/**`.

Do not include `renderer/**`, `library/**`, `references/**`, or `node_modules/**`. Reusable library/reference material is authoring input, not runtime payload. `LOCAL_RUNTIME_PENDING` means voice, measured timing, render props and rendered outputs are absent.

## Final validation receipt
`FINAL_VALIDATION.json` may set `status=PASS` only after the same Package Compatibility Gate used by Zodiac Studio has passed. Required fields for runtime 1.15 packages:
- `status=PASS`;
- `package_compatibility_gate=PASS`;
- `narration_scene_voice_identity=PASS`;
- `caption_design_lock=PASS`;
- `handoff_boundary=PASS`;
- `asset_lineage=PASS`;
- `semantic_animation_gate=PASS`;
- `interaction_choreography=PASS|NOT_APPLICABLE`;
- `production_sha256` equal to SHA-256 of the exact exported `production.json` bytes.

A contradictory receipt is a package-generation bug, not permission to bypass Studio validation.

## Local render/output
Canonical render writes `out/zodiac-story.mp4`, `out/cover.png`, `out/publish-copy.txt`, `out/publish.json`. Zodiac Studio `PACKAGE_PUBLISH` then creates `out/zodiac-publish-bundle.zip` using the mixed video when music is enabled.

## Runtime handoff gate
Read `references/package-format-v3.md` and `references/renderer-source-contract.md`. The package pins the exact shared runtime id/version/hash. Missing runtime is `RUNTIME_MISSING`; any mismatch is `RUNTIME_HASH_MISMATCH`. Never embed or patch a package-local renderer for v3.
