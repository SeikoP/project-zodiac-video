# Shared Remotion renderer handoff

This template mirrors the `zodiac-remotion@1.15.0` semantic runtime contract. Do not copy it into zodiac-job@3 archives.

Studio resolves the exact runtime hash, sets `ZODIAC_PACKAGE_ROOT`, uses the job root as Remotion `--public-dir`, and supplies production/publish/timing through shared render props.

Runtime 1.15 validates production schema, canonical asset lineage, Semantic Animation Gate mechanisms, measured captions, state/event ordering, voice anchors, visual progression, publish metadata and local fonts. Part-level articulation is represented by package-owned child entities rather than internal SVG-group animation through `<Img>`.

Runtime tests are standalone and never read `../../production.json`. The bundled Studio runtime manifest, not this authoring template tree, is authoritative for the pinned SHA-256.
