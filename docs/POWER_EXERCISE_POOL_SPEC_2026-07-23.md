# Power Exercise Pool — spec (Sam's decisions, 2026-07-23)

Status: APPROVED design input from Sam (recorded verbatim below). Not yet
built. Sequencing: does NOT interrupt unit 0.2 — queue after the Phase 0
merge as a discrete unit (generation-side; overlaps Phase 4 but is fully
specified and needs no further design session).

## Why systemic (not three more hardcoded lines)

`buildPowerBlock` (src/data/defaultProgram.ts:1389) hardcodes exercise
identity: lower → Vertical Jump / Pogo Jumps (reduced), upper → Explosive
Push-up, med-ball adds. Adding exercises means turning identity selection
into a typed POOL + pure selector in the rules layer (sibling of
`powerPrimerPolicy`, which keeps sole ownership of DOSE and the safety
gates). Rendering in `buildPowerBlock` consumes the selector's output.
No change to the counting fence, placement, or the policy's gate order.

## Ownership split (unchanged law)

- `decidePowerPrimer` (policy): WHETHER power happens + dose
  (sets/repsMin/repsMax, primer vs contrast, reduced flag). Untouched.
- NEW `selectPowerExercise` (rules, pure, deterministic): WHICH exercise,
  from the pool, given family, phase, beginner/experience, reduced flag,
  equipment, and block identity.
- `buildPowerBlock`: renders the selection. No selection logic remains here.

## The pool (Sam's entries, verbatim intent)

Existing entries (unchanged behaviour, now data):

| Name | Family | Equipment | Gates | Cue |
|---|---|---|---|---|
| Vertical Jump | lower | — | default; all phases where power allowed | Every rep fast and sharp. Stop if reps get slow. |
| Pogo Jumps | lower | — | ONLY when reduced (lower niggle) — takes over the slot | (existing) |
| Explosive Push-up | upper | — | default upper | (existing) |

**RETIRED by Sam's locked list.** The two medicine-ball rows that used to sit
here — `Medicine Ball Overhead Throw` (lower) and `Medicine Ball Chest Pass`
(upper) — are gone: Chest Pass and Slam on 2026-07-24, Overhead Throw on
2026-07-25. `buildPowerBlock` no longer has an equipment-conditional branch and
no longer reads `availableEquipment`; the power block is **bodyweight-only**
until this spec's pool is built. Rule 7 below ("equipment substitutes, never
forces") therefore has nothing to substitute today — it still governs any
equipment-gated entry the pool adds later, e.g. Depth Jumps needing a box.

New entries (Sam, 2026-07-23):

| Name | Family | Equipment | Gates | Cue |
|---|---|---|---|---|
| Depth Jumps | lower | Box (knee height) | off/pre-season only; min training age `developing`; harder option | Step off box, absorb force and explode into vertical jump |
| Lateral Jump | lower | — | no training-age minimum (beginner friendly); lateral power; any phase where power allowed | Jump sideways off one leg, land on two |
| Lateral Bounds | lower | — | off/pre-season only; min training age `developing`; lateral power and control | Jump sideways off one leg, land on the other leg straight into next bound; can do while moving forward |
| Kneeling Jump | lower | — | off/pre-season only; min training age `consistent` (Sam's words: "consistent or advanced") | Start on knees, explode up to feet in one smooth motion |
| RFE Split Squat Jump | lower | Bench | off/pre-season only; min training age `consistent`; avoid close to games | Back foot on bench, slight lean forward, jump straight up off the front leg |

Experience gating standard (Sam, 2026-07-23): ONE ladder — the existing
`TrainingAgeLevel` from `resolveTrainingAgePolicy` (new → developing →
consistent → advanced, mapped from onboarding ExperienceLevel). Every pool
entry declares `minTrainingAge`. This SUBSUMES the policy's boolean
`isBeginner`/`experienced` pair for exercise selection — the selector reads
the ladder directly; do not add a third representation.

Tib raises: NOT power — parked for the prehab/recovery-addon pool, placed
in the Phase 4 design session.

## Selection rules (Sam's decisions)

1. **App picks; block-stable.** One primary exercise per session,
   deterministic on block/microcycle identity — the SAME pick every week
   within a training block; rotation happens at block rollover so
   lateral/vertical/depth all get trained across blocks. No per-week
   randomness.
2. **Athlete can change it.** The athlete's change persists for the block.
   MUST route through existing mutation ownership — no new writer.
   Terminal: diagnose the existing power-block UI affordance first (the
   current `options` list is display-alternates); report the wiring path
   before building. If honest persistence needs a new athlete-choice
   record, that is part of this unit, transaction-owned.
3. **Reduced (niggle) → Pogo Jumps takes over.** Existing behaviour,
   applies to ALL lower entries (Sam specified it per-exercise; it is the
   slot rule).
4. **In-season = familiar/low-impact only**: Vertical Jump, Lateral Jump
   (policy already restricts in-season to a small primer; the pool adds
   the impact gate).
5. **Contrast draws from the same pool** — any eligible exercise, same
   block-stable pick (no separate contrast preference).
6. **Dose is always policy-stamped.** Pool entries carry NO sets/reps
   (all four new entries: policy default). Options render the spec's dose.
7. **Equipment substitutes, never forces** (existing law): no box → Depth
   Jumps ineligible, selector falls back; a bodyweight option is always
   present.

## Invariants (tests-first, per L9)

- P1 gating: `new` never sees Depth/Bounds/Kneeling; `developing` never
  sees Kneeling; in-season pool = Vertical + Lateral Jump only.
- P2 reduced → Pogo Jumps regardless of other eligibility.
- P3 block-stability: same seed + same block → same pick across all weeks
  of the block; pick may change at block rollover.
- P4 no-box athlete never receives Depth Jumps; a zero-equipment option
  always exists for every (family, phase, experience) cell.
- P5 rendered options carry exactly the policy spec's sets/reps.
- P6 counting fence byte-identical to current (hardExposure:false,
  mainStrength:false, conditioningCredit:'none', isFinisher:false);
  §18/bible/ownership suites green.
- P7 contrast selection uses the same pool + gates as primer.
- P8 athlete override persists for the block and routes through the
  transaction owner; undo restores the app pick.

## Open items (not covered by this spec)

- Per-option cue rendering may need an optional `notes` field on
  `PowerBlockOption` (type addition — fine).
- Equipment-string matching for "Box" against onboarding equipment values —
  terminal to map to the real catalogue.
- (RESOLVED 2026-07-23) Experience bars use the single TrainingAgeLevel
  ladder — Depth/Bounds min `developing`, Kneeling min `consistent`.
- UI for the athlete change (rule 2) — diagnose-first, report before build.
