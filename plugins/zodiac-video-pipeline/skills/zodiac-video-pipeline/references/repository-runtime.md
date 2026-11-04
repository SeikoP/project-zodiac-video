# Repository host runtime

This variant is for development and execution from the project-zodiac-video checkout. The ChatGPT-installed plugin has its own ChatGPT runtime guide; both variants intentionally retain the same plugin version and phase contracts.

## Source and execution

- Run scripts from the checked-out plugin skill root. Pin source identity to the exact Git commit and verify SHA-256 inputs before native compilation.
- Use plan-step-context.mjs to load only the current step references. The repository checkout is executable source, not episode context or approval evidence.
- Use the active phase manifest, capability registry and conditional routes as the only authority for required tools and fallback order. Provider mappings here do not waive a required capability.
- Keep validators, durable receipts, transition gates and explicit user reviews unchanged. A successful script or local test never creates a creative approval.

## Capability providers

The repository host map names provider classes, not assumed credentials or guaranteed availability. Invoke only adapters actually configured in the execution environment. If a required provider is absent, apply the manifest-defined fallback or block; never fabricate a tool receipt.

## Local media boundary

TTS, measured word timing, Remotion, captions, cover rasterization, audio and MP4 acceptance remain local-runner responsibilities. A validated Job@5 ZIP is not media acceptance.
