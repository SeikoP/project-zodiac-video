# Fetch execution source without cloning the monorepo

The installed Zodiac plugin owns the 01 → 02 → 03 router, step manifests, review gates and episode authority. GitHub supplies **bytes**, never approvals. This transport does not fetch code samples or rewrite the approved Gemini Narration.

## One-time source production (only when a matching release exists)

The phase-scoped workflow is `.github/workflows/zodiac-source-bundle.yml`. Its artifact is `zodiac-execution-source-<phase>-<40-char commit>`. Actions execution is manual (`workflow_dispatch`), not automatic on every push.

With `GH_TOKEN` set to an authorized token supporting Actions artifact download:

```sh
python tools/fetch_phase_source.py \
  --phase 01-content \
  --version <installed-verified-plugin-version> \
  --release-id <installed-verified-release-id> \
  --commit <matching-40-char-artifact-commit> \
  --target /tmp/zodiac-source-01
```

Do **not** replace the placeholders with the GitHub `main` release if it differs from installed plugin provenance. On success `stage_source_bundle.py` validates the complete inventory, every SHA-256, safe paths, phase and release; extract destination must be empty. After that, invoke the plugin-native execution preflight and phase-manifest compilers. Transport success is not a phase PASS.

## Failure modes

- `SOURCE_TRANSPORT_UNAVAILABLE`: missing `GH_TOKEN`, inaccessible/expired artifact, no filesystem egress.
- `SOURCE_INTEGRITY_MISMATCH`: corrupt ZIP, mismatched commit, phase/release/version, unsafe file inventory.
- `SOURCE_VERSION_UNRESOLVED`: installed plugin release does not have an evidenced matching repository release. Resolve by inspecting exact original upload/source bytes, **not** by equating version bump with code drift.

## ChatGPT sandbox limitation

A GitHub connector's textual response and read-only `skill://` listing are not automatically available as files to Node/Python on the execution host. This script requires actual HTTPS egress or an authenticated artifact transfer to the host. If host network is blocked, do not claim that updating SKILL.md alone fixes it; stage the already-verifiable phase ZIP through an authorized file attachment. Never fall back to downloading the entire repository.

## Gemini continuation

Keep Concept A, Narration V3, and real user approvals. Once source identity resolves, rerun the exact Phase 01 manifest compilers/validators with real receipts and retain IN_REVIEW until explicit user Content Review. Do not begin Visual Production merely because transport succeeded.
