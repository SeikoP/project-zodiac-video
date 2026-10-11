# Asset Style Compile Contract — v4

`design.md` is authoritative for the current package. New production uses `zodiac-paper-doodle-meme-v4` + `human-stroke-v2`.

## Compile rule
Before any character/prop/effect enters `assets/**`:
1. resolve semantic source and frame/mechanic role;
2. treat historical V3 lineage as **provenance only**;
3. if a user-supplied legacy source is selected, derive a package-owned V4 SVG instead of direct-copy/relabel;
4. preserve interaction sockets/semantic IDs that the selected mechanic requires;
5. re-author focal contour and bilateral character strokes so visible geometry matches Human Stroke v2;
6. normalize palette/stroke without runtime jitter/noise/filter tricks;
7. record authoring lineage; then run v4 production-style + visual-structure validation.

## Human Stroke v2
Passing metadata is insufficient. Characters are no longer exempt.

- focal silhouettes are path-first;
- focal assets need multiple independently curved paths;
- perfect `rect/circle/ellipse` primitives may be secondary details but cannot dominate focal geometry;
- character left/right arms and legs use independently authored curves rather than mirrored straight segments;
- paired facial/reaction marks may share a style but must not be exact mirrored clones;
- runtime randomness, SVG turbulence/filter noise, and random path jitter are forbidden.

A legacy direct copy fails new-production validation even if someone edits `style_id` to say V4.
