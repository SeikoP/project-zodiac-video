# Constructive pipeline spike — 2026-11-26

**Gate (Task 4), status: measured criteria PASS; waiting for the owner to approve stills.**
Placement route chosen: Core `scene_assembler.PLACEMENT` table. `compileProduction` placement was not tried: the table already
compiles (`validate_authoring` = VALID) with zero geometry faults, so it was not needed.

Project: Nhân Mã episode, scenes s01 and s02, 3 runs each, luna (`gpt-6-luna`, creative role), `outputSchema` on every turn
(Stage then Act = 2 calls per run). Nothing was applied to the project. Tool: `python -m tools.studio_project.authoring_spike`.

## Run 1 — schema offered every state to every target
| scene | run | schema-valid | accepted | compiled | seconds | error |
|---|---|---|---|---|---|---|
| s01 | 1 | Y | N | N | 30.8 | ValueError: state_after 'reveal' không thuộc char-sagittarius |
| s01 | 2 | Y | Y | Y | 27.4 |  |
| s01 | 3 | Y | N | N | 24.9 | ValueError: state_after 'reveal' không thuộc char-sagittarius |
| s02 | 1 | Y | N | N | 34.4 | ValueError: state_after 'waiting' không có trong phone-busy |
| s02 | 2 | Y | N | N | 53.4 | ValueError: state_after 'invite' không có trong phone-busy |
| s02 | 3 | Y | N | N | 30.9 | ValueError: state_id của char-sagittarius 'reveal' không có trong menu |

Schema-valid 6/6, assembled 1/6. Every miss was a state placed on an entity that does not own it (`reveal` on char-sagittarius,
`waiting` on a prop). Cause: the schema's `state_after` enum was the union of all cast states.

## Fix
`stage_schema` / `act_schema(menus, stage)` now use `anyOf` with one variant per entity, so a state is only offered with the
entity that owns it, a prop only has `same`, and only entities in the chosen stage can act.

## Run 2 — after the fix
| scene | run | schema-valid | accepted | compiled | seconds | error |
|---|---|---|---|---|---|---|
| s01 | 1 | Y | Y | Y | 26.4 |  |
| s01 | 2 | Y | Y | Y | 22.4 |  |
| s01 | 3 | Y | Y | Y | 22.9 |  |
| s02 | 1 | Y | Y | Y | 32.4 |  |
| s02 | 2 | Y | Y | Y | 36.5 |  |
| s02 | 3 | Y | Y | Y | 33.0 |  |

| Criterion (plan Task 4) | Result |
|---|---|
| schema-valid ≥ 90% | 6/6 = 100% |
| both scenes compile, zero model retries | yes, 6/6 assembled and VALID with no retry |
| each scene < 60 s (Stage + Act) | 22–37 s |
| a placement route exists | yes: `PLACEMENT` table |
| owner approves the stills | **not yet**: the spike does not render stills |

Limits of this evidence: 2 scenes of 8, one episode, one account/model. It proves menu-constrained output assembles into valid
scenes; it does not show the scenes look good (that is the owner's eye) or that mechanic/frame combinations are always compatible.
