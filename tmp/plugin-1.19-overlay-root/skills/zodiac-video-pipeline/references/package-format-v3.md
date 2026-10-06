# Zodiac job package v3

Format: `zodiac-job@3`

A new package is data-only and targets the semantic shared runtime.

## Required payload
```text
package-manifest.json
production.json
narration.txt
design.md
handoff-manifest.json
FINAL_VALIDATION.json
assets/**                  # referenced production assets only
publish/publish.json
publish/publish-copy.txt
README.md                  # optional
```

Forbidden: `.authoring/**`, `renderer/**`, `library/**`, `references/**`, `node_modules/**`.

## Exact runtime reference
```json
{
  "format": "zodiac-job@3",
  "production_contract": "2.0",
  "runtime": {
    "id": "zodiac-remotion",
    "version": "1.15.0",
    "sha256": "4d52e6ca766649546482a5cdfbf879f4f19c4d3c41c07c7743cccec1a7100ffa"
  },
  "design": {
    "id": "zodiac-paper-doodle-meme-v3",
    "version": "3.1",
    "sha256": "<production.visual_system.style_token.source_hash>"
  },
  "producer": {
    "plugin": "zodiac-video-pipeline",
    "version": "1.19.1"
  }
}
```

Never use a “latest” runtime fallback. The design hash must match both `design.md` and compiled production style token.

Every production SVG asset requires canonical v3 lineage. Mechanical events require the Semantic Animation Gate mechanism contract. `FINAL_VALIDATION.json.production_sha256` must hash the exact exported production bytes and the receipt must record `asset_lineage=PASS`, `semantic_animation_gate=PASS`, and `interaction_choreography=PASS|NOT_APPLICABLE`.

The reusable asset library, interaction plan and authoring references stay inside the plugin/authoring workspace. Copy only story assets referenced by `production.assets`.
