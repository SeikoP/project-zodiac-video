# Ma Kết: existing-assets acting audition

Ten-second sample from `maket-nguoi-thua`, original MP4 audio range 0–10 seconds. Only existing package artwork appears: the S01 backdrop, two original characters with available poses, and one original shopping bag. The existing brand mark, palette, font and narration words are reused. No title cards, labels, diagrams, decorative marks, music, sound effects or generated artwork were added.

Changes are presentation only: pose timing, position, rigid lean/recoil, a coordinated character/bag pull, and small camera moves. The existing reach pose is mirrored toward the bag. Captions reuse the measured word anchors; the original long bag sentence is split at its existing clause boundary for readability. Original source files and approval records were not modified. `source-ledger.json` records hashes; the builder asserts copied SVG bytes match and hand/handle placement is within 2px before camera transformation.

Verification: build assertions and HyperFrames check passed; inspected snapshots at 0.8, 2.65, 6.7, 8.15, 9.5 and 9.75 seconds, including the revised contact geometry. This is limited animation from whole existing poses: facial movement and articulated arm transitions remain limited by the available artwork. The approaching pose leans as a whole figure. User visual approval and human audio listening remain pending.

Rebuild: `python build_demo.py`; `npm run check`; `npm run render -- --fps 24 --quality looks --output maket-acting-10s.mp4`.
