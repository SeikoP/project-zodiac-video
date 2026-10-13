# Character compiler baseline visual-equivalence audit

## Revisions

Historical baseline source: `7bc1af17e3e7cd36f6cef245ee93b49664d3d8b2`
Current stabilization branch before snapshot update: `672f4983d7aef94628688ca2fe2030f0bb142c25`.

GitHub Actions: https://github.com/SeikoP/project-zodiac-video/actions/runs/38434718012

Artifact: `character-geometry-comparison` (ID `11831834332`), containing both generated SVG sets and before/after PNG composites.

## Findings

| Fixture | Byte SHA changed? | CairoSVG 720x720 pixel difference |
|---|---|---|
| lean-explain | Yes | 0 (all channels) |
| round-offer | Yes | 0 |
| stocky-phone | Yes | 0 |
| petite-run | Yes | 0 |

Both revisions were executed using the *same fixture inputs*, with separate actual historical/current compiler imports. Rasterized with CairoSVG; compared with Pillow `ImageChops.difference` and mean channel difference. Each fixture had zero difference on all four RGBA channels. This verifies **visual equivalence at this renderer and raster resolution**; it does not prove universal SVG consumer equivalence, unsupported transform variants or creative approval.

Golden byte hashes were updated to the current generator output *only after* this verified pixel parity. The test remains exact SHA byte regression, while the audit artifact preserves historical comparison evidence.

No creative approval was fabricated and no approved narration changed.
