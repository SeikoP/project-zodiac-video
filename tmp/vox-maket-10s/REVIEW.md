# Vox comparison revision

Revised after the user rejected added graphic elements. This audition uses exactly the existing-assets acting demo's artwork, voice, caption words, font, background, brand mark and pose timing. The variant changes only the camera: cuts on original sentence anchors, closer crops and slow pushes. It is a constrained Vox-inspired editing comparison, not a complete Vox visual identity.

Removed from the video: added title blocks, decorative rings, character labels, yellow emphasis panels, paper cards and the demo footer. Old unreferenced files may remain on disk; `index.html` mounts only `compositions/acting.html`, copied from the existing-assets baseline with camera instructions replaced. `build_demo.py` asserts the scene's visible text nodes remain unchanged. The source ledger records source assets and audio.

Verification: HyperFrames check `ok: true`, zero errors; inspected keyframes at 2.6, 6.7, 8.15, 9.5 and 9.75 seconds. Cropping the secondary character at frame edges is intentional during close shots. User style approval and human audio listening remain pending. Production source and approval records were not changed.

Rebuild the baseline `../maket-acting-10s` first only if needed, then `python build_demo.py`; `npm run check`; `npm run render -- --fps 24 --quality looks --output maket-vox-style-10s.mp4`.
