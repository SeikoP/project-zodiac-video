# Producer–runner contract parity — 2026-10-13

Observed plugin-native test 528: producer schema canonical hash `d6af8a599324fcf68dd43fb1627a0dc23f9b3db07ba0874eeb8a86e5df1a43c0` vs historical pinned hash `2ca8394b51a9b95174ee407731f309ec3cfd44b03f5f98f25655f46cbb625b85`.

Fix on audit branch replaces the stale hardcoded equality with a live producer/runner canonical schema comparison. This makes actual fingerprint drift fail closed without pinning a stale version forever.

Remaining: verify generated source bundles, plugin installation provenance, Story Object alias across exporter/importer, and actual rendered entity-level parity. Not yet PASS.
