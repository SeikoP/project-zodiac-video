# Main into experimental Studio sync

Merged production `origin/main` at `97733845e9e84401c1b4a10d5dfbe9e8aae2e820`
into `experiment/main-2`, previously `6505d96910adfcd1c65dc06190b1fde9bf3105bc`.
Backup: `backup/main-2-before-main-sync-20261118`.

The merge imports 17 production commits and retains the experimental Studio
implementation. No production branch, installed plugin or running app is changed.

Integration adjustments:

- Update the synthetic Studio Phase-1 fixture to Narrative Plan 2.1, with an
  anchored performance beat and an explicit story-visual decision. The production
  importer retains its current validation; no approval is granted by this fixture.
- Remove a duplicate historical schema fingerprint introduced by automatic merge.

## Local validation

- Python Studio P0/P1/P2/P3/P4, historical Job@5, checklist and changed production
  boundary suites: 145 passed, 78 subtests passed, one existing Qt deprecation warning.
- Studio visual compiler / HyperFrames SDK: 11 passed.
- Studio TypeScript: `pnpm exec tsc --noEmit` passed.
- Renderer 2.0.2: 100 passed; TypeScript check passed.
- Plugin native suites: 1,154 passed, 4 failed out of 1,158.
- Canonical contract bundle check and asset-library validation passed.
- Git whitespace checks passed with `core.whitespace=cr-at-eol`, accounting for
  CRLF documentation already present in the imported commits.

All four native failures were reproduced on unchanged production main in the
same environment: two assertions in `phases/phase02/tests/authoring-completeness.test.mjs`,
one in `references/context-isolation.test.mjs`, and one in
`references/validate-narrative.test.mjs` under the pipeline skill directory.
These are inherited failures, not a clean full-suite result.

No release/package build, native desktop/manual visual acceptance, real TTS/ASR,
or final MP4 render was performed. Older Phase-1 capsules still need to meet the
current production handoff contract; existing approved source was not rewritten.
