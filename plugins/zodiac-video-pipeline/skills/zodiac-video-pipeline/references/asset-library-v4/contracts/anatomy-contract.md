# Semantic Anatomy Contract

A reusable master exposes enough structure for an agent to derive story-specific states without adding a reusable file for every outcome.

## Anatomy modes
- `explicit_groups`: SVG IDs are semantic moving/revealable parts.
- `character_groups`: stable identity groups plus mutable face/arms/held-prop groups.
- `rigid_master`: no useful reusable articulation; move/rotate/place the master as a whole or create a package-owned derivative when a story needs more detail.

Reusable scene/background modules are not part of the asset-library contract.

## Group roles
`structural`, `identity`, `articulated`, `revealable`, `contents`, `information_surface`, `attachment`, `effect`.

Names describe meaning, not state. Use `flap`, `interior`, `right_arm`, `notification_card`; never `flap_open`, `interior_visible`, `right_arm_reaching`.

## Concrete-parts rule
All `semantic_parts` in `manifest.json` must resolve to an `id` in the SVG. Placeholder anatomy such as `inspect_svg_groups` is forbidden.

## Agent derivation
The agent chooses a state from the beat, mutates semantic parts, and writes package-owned derivatives. Role and affordance hints guide planning but never restrict coherent derivations supported by geometry.

## Part-level motion
For a mechanism that visibly moves, keep structural groups in a parent asset and extract the moving/revealable group to a child asset/entity. Animate the child through the normal production event/state system. Do not label a whole-asset crossfade as part-level animation.

## Master admission
A state change alone never justifies a new master. Add a master only for a genuinely new identity/function whose geometry cannot be coherently derived from an existing master.
