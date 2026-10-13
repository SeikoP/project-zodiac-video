# Native shirt identity

Choose `plain-shirt` for an actor with no stated sign, or `zodiac-glyph-shirt`
with an explicit `zodiac_sign_id` for a sign-bearing actor. The torso retains
its selected shirt color and one baked intrinsic chest glyph. Never infer a
supporting actor's sign. Do not add rays, halos, stars or floating marks around
that glyph. Glyph paths use the native token and travel with pose geometry.

The sign participates in identity hashing, the asset blueprint and native
assembly replay validation. Shirt color remains stable. Actors may share shirt
geometry; do not add decorative variants just to distinguish them.
