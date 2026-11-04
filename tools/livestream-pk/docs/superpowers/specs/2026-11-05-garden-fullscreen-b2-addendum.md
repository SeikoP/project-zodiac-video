# Garden v6 Addendum — Full-screen B2 Rack

**Supersedes:** the visual requirement "one thin continuous 16-shelf column" in the Garden v6 spec. Logical gameplay remains one Seed Zone and one stable slot sequence.

## Approved layout

- One greenhouse frame fills the portrait LIVE play area.
- Two **visual wings** inside that same frame: left and right.
- Each wing: 8 shelves × 6 pots = 48 visible slots.
- Total capacity remains 96.
- Slot identity remains stable; logical rows 0–7 render on the left wing and rows 8–15 on the right wing.
- The wings are presentation geometry only: no A/B/C/D module labels, no separate zones, no separate gameplay state.
- Overview target: rack content occupies roughly 85–90% of usable width and at least ~65% of usable camera height while respecting top/bottom HUD safe areas.
- Overview labels use viewer nickname, never a public slot code. At dense zoom, truncate names to a readable short form rather than replacing them with `#012`.
- Focus keeps the longer nickname, crop state and action CTA in screen space above shelf lips.
- Pot/crop anchoring, 10/12/15-minute base growth and rotating heart mechanics remain unchanged.

## Acceptance

- 12/24/48/96 player layouts stay balanced across both visual wings without moving existing seats.
- At 96 players, six pots per shelf are visible with no horizontal overlap.
- Overview greenhouse appears as the primary content, not a narrow central tower.
- Left/right rack bounds stay within camera safe area.
- Public UI contains no slot-code fallback for pot identity.
- Event/focus overlays remain above shelf lips.
