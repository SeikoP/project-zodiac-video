# Zodiac Control Plane v2 Core

This branch introduces the headless scheduling boundary described in the Control Plane v2 design.

## Current milestone

The implemented core owns:

- canonical `zodiac-job@5` / Authoring IR / Timing / Render Plan / Design Token / Error contracts;
- Authoring IR static validation;
- deterministic measured voice-anchor resolution;
- target-lane timeline scheduling;
- explicit merge/shift/conflict behavior;
- executable Render Plan validation;
- the `zodiac-control build` headless compiler;
- a Scorpio E21/E22 golden regression that proves same-target overlap is removed before renderer handoff.

The current Studio, TUI, plugin v1.x and released Remotion runtimes are intentionally unchanged by this milestone.

## Headless command

```bash
zodiac-control build <package-root>
```

A successful build writes:

```text
<package-root>/.runtime/render-plan.json
```

and prints:

```text
PACKAGE_VALID
PLAN_COMPILED
PLAN_VALID
TARGET_OVERLAP_COUNT=0
```

Failures are emitted as one canonical structured error JSON object.

## Ownership boundary

`production.ir.json` describes semantic intent. It never contains resolved event frame ranges.

`timing.json` supplies measured speech timing.

The Timeline Compiler is the only component that schedules semantic events into frame intervals. The Render Plan Validator verifies those intervals but never repairs them.

Renderer 2.0 and Studio v2 integration are intentionally deferred to the next implementation plan after this core CI gate is green.
