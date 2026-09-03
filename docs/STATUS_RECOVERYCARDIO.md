# STATUS — seat `recoverycardio`

Opened 2026-09-04. One writer: this seat.

## The ask

Sam, on a Recovery session added to an optional day: *"i added it and it popped
up with 'conditioning and recovery' that sounds intense and a light 10/min walk
or bike should not be called conditioning - recovery walk or bike should be it's
own thing and just sit inside a recovery session as part of it - it also doesn't
say how long the light bike or walk should be"*.

Then, mid-task: *"these badges i.e. core, recovery, etc - they're taking up too
much attention - drop their opacity down to 50%"*.

## What it actually was — ONE cause, three symptoms

A composed Recovery session carried **no `composedOptionalKind`**. An explicit
comment in `sessionBuilder.finaliseDerivedSession` said so on purpose: *"the
recovery variants stamp nothing (recovery is a charter-deleted type — nothing may
carry its identity forward)"*. That sentence predates
`LAW-standalone-mobility-recovery-session-parity` (Sam, 2026-08-21), which
un-deleted the type.

Untagged, the session reached `finaliseWorkoutAfterMutation`'s full
strength/conditioning pass — the pass that **already stands down for a session
carrying that marker**. That pass classifies rows by NAME:

- `Light Walk or Stationary Bike` → classified conditioning →
  `row_promoted / promoted_to_typed_conditioning`, and a `conditioningBlock` is
  invented on a Recovery session.
- The block gives the row a **"Bike" modality subtitle**.
- It sorts the row **behind the breathing row** Sam authored last.
- On a build older than `c3f16708` (2026-08-29) it also became its **own
  "Conditioning" section** with no dose line — which is Sam's screenshot.

**The other two easy-cardio rows are unaffected.** `Outdoor Walk` and
`Incline Treadmill Walk` are not on the classifier's list, so they render
correctly. That is exactly why the guard never saw this: the suite built the
session on ONE date and asserted against whatever the rotation drew.

### Second, independent defect — SEEN ON GLASS

Swapping `Outdoor Walk` (authored `1 × 10 min`) for `Light Walk or Stationary
Bike` rendered **`2 × 12 min`**. `quickExerciseActions`' `add_hierarchy_fallback`
choice copied the Add menu's `bandFor` guess into `prescription`, and
`buildSwapSuggestionPayload` spreads a choice's prescription LAST — so it
displaced a dose Sam signed. That file's own header already forbids it: *"The
DOSE carries over from the row being replaced… A dose belongs to the SLOT the new
movement steps into."*

## What landed

| file | change |
| --- | --- |
| `src/utils/sessionBuilder.ts` | `COMPOSED_OPTIONAL_KIND_BY_TYPE` stamps `recovery` for `recovery` / `passive_recovery` / `extended_recovery`; the charter-deleted sentence is gone. |
| `src/utils/quickExerciseActions.ts` | the add-hierarchy swap choice no longer states `sets` / `repsMin` / `repsMax` / `restSeconds`. It states only what belongs to the MOVEMENT: unit, per-side, note, load. |
| `src/utils/tapSwapHierarchy.ts` | `TapSwapChoice.prescription`'s `sets` / `repsMin` / `repsMax` are optional, so a choice that knows only WHICH movement can say only that. |
| `src/components/common/SessionTierBadge.tsx` | one `BADGE_DE_EMPHASIS = 0.5` on the chip — not eight repainted colours in `TIER_CONFIG`. |
| `src/__tests__/recoverySimpleTemplateTests.ts` | new `[4b]` and `[4c]`. |

**The reader predates the writer:** `projectVisibleWeek.partHeadline` was already
branching on `optional === 'recovery'`. Nothing there needed changing.

## Receipts

**`test:recovery-template` 61 passed, 0 failed** (was 39).

`[4b]` runs **every** easy-cardio pool member through the **WRITE** path
(`buildDerivedSession` → `finaliseWorkoutAfterMutation` → template → checklist),
not the builder alone, and asserts: one Recovery section, no invented
conditioning block, recovery presentation with a number, no modality subtitle,
`1 × 10 min`, breathing last. `[4c]` drives the **real swap door**
(`rankedQuickSwapChoices`), not a hand-built payload.

**MUTATION-PROVEN, both ways:**
- Remove `recovery` from `COMPOSED_OPTIONAL_KIND_BY_TYPE` → **3 red, all in the
  `Light Walk or Stationary Bike` world** (block, modality, breathing-last);
  the other two cardio worlds stay green. Restored → green.
- Revert the `quickExerciseActions` change → **3 red, all in `[4c]`**. Restored
  → green.

**BLAST RADIUS — control run at both ends, same tree.** 24 suites swept. Ten
carried reds or throws; each was re-run on the reverted tree and the fingerprints
(exit code, pass/fail counts, red-line counts) are **byte-identical**:
`session-execution`, `tap-swap-hierarchy`, `exercise-removal-owner`,
`section18-recovery-neutrality`, `day-first-timeline`, `exercise-add-candidates`,
`session-change-sequence`, `exercise-restore-owner`, `session-list-combinations`,
`surface-agreement`. Also identical: `session-template` (1), `mobility-flow` (3),
`session-execution-checklist` (2), `session-type-charter` (5). **Every one is
pre-existing on this branch.** Green with no reds: `session-components`,
`exercise-intake`, `athlete-safe-refusal`, `signed-copy-extraction`,
`projection-ownership`, `optional-topup`, `mobility-accessory-doors`,
`illness-recovery-mode`, `visible-program-projection`.

`npm run test:compile` — **product 0 errors, devtools 0 errors**. The gate is red
on `src/__tests__/sessionWorkOwnershipJourneyTests.ts` (7), committed at
`01e805e3` by seat `flyowner` and untouched here. `npm run test:release` is
**0/27 on the clean tree** — measured before and after, identical.

## SEEN ON GLASS

**⚠ AND THE FIRST DEVICE RUN WAS WORTHLESS — READ THIS BEFORE TRUSTING A
SCREENSHOT.** `npm run lfa:dev` reported *"Metro already running on :8081 — verify
it serves THIS checkout"* and it did not: `:8081` belonged to
`/private/tmp/lfa-hingecod-8d68`, **another seat's worktree**. Every screenshot
before 8:12 was that seat's bundle. It was caught by an A/B that refused to move:
the badge's brightest pixel read `(216,216,0)` with the opacity change and
`(216,216,0)` without it. **A device screenshot is evidence only once the bundle's
origin is proven.**

Own Metro on `:8092` from this checkout, app launched with
`-RCT_jsLocation 127.0.0.1:8092`, reseeded `standard-in-season-week`:

- badge brightest pixel `(216,216,0)` → `(108,136,8)` — exactly half.
- Recovery added to the Sun 19/7 rest day: **one `Recovery 0/6` section**, no
  Conditioning heading, breathing last.
- Swapped row 5 `Outdoor Walk` → **`Light Walk / Bike`, `1 × 10 min`**, still row
  5 inside Recovery. Before the fix, on the same flow: `2 × 12 min`.

## NOT COVERED

- Sam's physical iPhone.
- The section SPLIT itself could not be reproduced on this checkout — `c3f16708`
  (2026-08-29) added the `!lowLoadIds` exclusion to `conditioningRows` that stops
  it. Sam's build is older. The cells hold the property anyway.
- **⚠ FOUND, MEASURED, NOT FIXED — needs a ruling.** `addExerciseCandidates.bandFor`
  re-derives a dose from tags for names whose dose is AUTHORED in
  `POOL_REGISTRY`: **88 of 105 pool names disagree with their own pool entry**
  (`Face Pull` authored `3 × 15-20`, offered `2 × 10-12`; `Banded Bicep Curl`
  `3 × 15-20` vs `2 × 10-12`). Two dose owners for one authored row. Fixing it
  changes every Add dose in the app, so it is reported rather than swept into a
  task about a recovery walk.
- The shared simulator is now pointed at `:8092`. Whoever owns
  `lfa-hingecod-8d68` will need to relaunch against `:8081`.
