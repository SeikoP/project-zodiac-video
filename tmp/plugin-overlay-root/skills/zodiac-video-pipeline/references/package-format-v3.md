# Zodiac job package v3

Format: `zodiac-job@3`

A v3 ZIP is data-only.

## Required payload
```text
package-manifest.json
production.json
narration.txt
design.md
handoff-manifest.json
assets/**                  # referenced production assets only
publish/publish.json
publish/publish-copy.txt
FINAL_VALIDATION.json      # when final validation receipt is emitted
README.md                  # optional
```

Forbidden: `renderer/**`, `library/**`, `references/**`, `node_modules/**`.

## Exact runtime reference
```json
{
  "format": "zodiac-job@3",
  "production_contract": "2.0",
  "runtime": {
    "id": "zodiac-remotion",
    "version": "1.14.0",
    "sha256": "88f845a0e9304383ed6627127206185d301ba1516b1e16e591cbe1ba47c3d1f8"
  },
  "design": {
    "id": "zodiac-paper-doodle-meme-v3",
    "version": "3.1",
    "sha256": "<production.visual_system.style_token.source_hash>"
  },
  "producer": {
    "plugin": "zodiac-video-pipeline",
    "version": "1.15.0"
  }
}
```

Never use “latest” runtime fallback. The design hash must match both `design.md` and compiled production style token.

The reusable asset library and references stay inside the plugin as authoring inputs. Copy only story assets actually referenced by `production.assets` into the job.
