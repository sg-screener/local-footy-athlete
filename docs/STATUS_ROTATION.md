# STATUS — seat `rotation`

Block Two: exercise rotation and preference pinning.
Base: `dda2747d` (clean `main`). Branch `feat/block-two-rotation`, isolated worktree.

## THE OWNERSHIP ANSWER — BEFORE

**There was no rotation owner. The only enforcer had been deleted.**

`composeWeek.ts:292`, in the repo's own words: *"the rule whose only enforcer,
`applyPoolRotation`, was deleted in the B2 rebuild."*

What replaced it was ONE LINE — `composeWeek.ts:1060`:

```ts
const step = Math.max(0, inputs.phaseClock.weekNumber - 1);
...
const identity = preferred[step % preferred.length];
```

**Selection was keyed by the PHASE WEEK NUMBER. The contract keys it by the
BLOCK.** That single substitution is the whole defect.

### `selectPoolEntry` / `selectPoolEntryAvoiding` HAVE ZERO PRODUCTION CALLERS

`src/data/exercisePoolsStrength.ts` still carries a full rotation implementation:
block/week cadence, pin bias, exclusion filter, injury filter, equipment filter,
`PoolRotationOutcome` refusals. **Every reference to it outside its own file is a
test or a comment.** `test:pools` (~1,175 lines) is green against code nothing
runs — `a-suite-can-test-code-nothing-runs` again, at scale.

`prefs.pinned` had the same shape: stored canonically in
`athletePreferencesStore`, displayed by `activeProgramModifiers`, and its only
selection reader was the dead `applyPrefsToPool`. **A pin changed nothing.**

## MEASURED BEFORE — real `generateProgramLocally`, full kit, Pre-season, 3 days

Blocks 1/2/3, each 3 build weeks + deload. Per pool slot:

```
horizontal_push/anchor  b1: w1 Bench Press  → w2 Incline Bench → w3 Close Grip Bench
horizontal_pull/anchor  b1: w1 Barbell Row  → w2 Chest Supported Row → w3 Single-Arm DB Row
hinge/anchor            b1: w1 Deadlift+RDLs → w2 RDLs
```

**Three different main lifts inside ONE build block.** The contract's *"main and
secondary lifts may remain for a second consecutive block"* was not merely
unimplemented — it was unreachable, because the athlete never met the same lift
twice.

## AFTER — same worlds, same instrument

```
horizontal_push/anchor  b1 Bench Press ×4 wks | b2 Incline Bench ×4 | b3 Close Grip Bench ×4
horizontal_pull/anchor  b1 Barbell Row ×4     | b2 Chest Supported Row ×4 | b3 Single-Arm DB Row ×4
hinge/anchor            b1 Deadlift ×4        | b2 RDLs ×4
```

Stable across all four weeks including the deload; rotates at the build boundary.

## WHAT LANDED

- **`src/rules/exerciseRotation.ts`** — new. `decideRotation()` is the one owner.
  Main lifts advance once per BLOCK, accessories once per WEEK, a deload holds
  the block's last build week. Retention reads the EXISTING progression decision.
- **`blockBoundaryProgression.progressedFromOwnHistory`** — the `history_progressed`
  condition, lifted out and exported so rotation READS it. `decideBlockBoundaryLoads`
  now calls it too: one owner of the predicate, two readers, no drift.
- **`composeWeek`** — `step` DELETED, not wrapped. Block identity, pins and the
  progressed set are now required inputs.
- **`generateProgram`** — threads block number, week-in-block, deload flag, pinned
  identities and the progressed set into the composer.

### The two-block cap stores nothing

NORTH_STAR: store only decisions. A retention is visible in the arithmetic —
the base cadence is a pure function of the block number, so
`retainedLastBlock(b) ⟺ selected(b-1) ≠ baseIdentity(b-1)`. No counter, which
matters because **this app regenerates the program on every boot**.

## GATES

`npm run test:compile` — 6 pre-existing `bibleConformance` failures.
**CONTROL RUN AT `dda2747d` IN A CLEAN WORKTREE: the identical 6.** My change adds
zero. The gate is red on `main` itself.

## STOP CONDITION CHECKED — NOT TRIGGERED

The mission: *"If current product copy promises that a pin overrides the two-block
maximum, STOP."* Swept `src/screens` and `src/components`: the only "pinned"
wording on glass belongs to `ExerciseVideoModal`'s demo videos — video pinning,
which the mission excludes by name. **No copy promises a pin overrides anything.**

## SUITES AFTER THE OWNER LANDED — 9 REDS, ALL ONE SIGNATURE

| suite | result |
| --- | --- |
| `test:exercise-exclusions` | **51 / 51 green** — exclusion still beats everything through the new owner |
| `test:pools` | 473 pass, 1 fail |
| `test:block-two-progression` | 34 pass, **3 fail** |
| `test:block-two-difficult-missed` | 84 pass, **4 fail** |
| `test:block-two-screen-delivery` | 34 pass, **1 fail** |
| `test:block-two-ladder` | **2 fail** |

**Nearly every red is the same fact: `ABSENT_ROW` — Deadlift is no longer in
block 2.** Under the old week-keyed cadence, block 2 week 1 landed on Deadlift by
coincidence. Under the contract it rotates, because *"most exercises normally
rotate at a new build block"*.

**RETENTION WAS INSTRUMENTED AND IS CORRECT.** Printing the owner's inputs on the
real progression worlds:

```
qualifies:true  loads:{"Deadlift":100}  progressedIdentities:["Deadlift"]   ← retains
qualifies:false loads:{}                progressedIdentities:[]             ← rotates
```

The reds belong to the **second** athlete — no recorded history, so nothing
supports retention and the slot rotates. That is the contract's default, not a
defect. The instrumentation was removed before commit; the tree is clean at
`969306c1`.

⚠ **NOT ALL NINE ARE ADJUDICATED YET.** Two are NOT obviously the same class and
must be judged individually before any merge is proposed:

- the ladder's *"a REAL generated session sits EXACTLY on the 16-set ceiling"* and
  *"NO SET IS ADDED ON AN AMBIGUOUS ANSWER"* — different exercises carry different
  authored set counts, so this may be a knock-on rather than an outdated number;
- difficult/missed's *"the week SHAPE is untouched — same sessions on the same
  days"*. **A shape change is not an identity change.** If rotation moved which
  DAYS exist, that is a defect in this change, not an outdated assertion.

Nothing is being rewritten to green until each is judged on its own.

## SESSION 2 — THE TWO SUSPECTED REGRESSIONS, AND THREE DEFECTS IN MY OWN WORK

**[1] "the week SHAPE is untouched" — REFUTED.** That assertion keys rows by
`week:workoutName:EXERCISE NAME`. `scripts/probe-day-shape.ts` strips the names:
**28 sessions both sides, skeletons identical, rows-per-day identical.** The only
difference is Deadlift (retained) vs RDLs (rotated). No day moved.

**[2] "a REAL generated session sits EXACTLY on the 16-set ceiling" — REAL, and
it is rung 1 of that suite firing for the first time.**

```
base:  Leg Press:4 Single-Leg RDL:4 Incline DB Bench:4 Single-Arm Pulldown:4 = 16
after: Goblet Squat:4 Single-Leg RDL:4 Bench Press:3   Chin-Ups:3            = 14
```

Nothing lost a set — two lifts stopped being GIVEN one, because they now progress
by LOAD, and that suite's own rule is *"never both on one lift in one rollover"*.
Under the week-keyed selector a main lift could not survive into block 2, so it
never had its own history and the load rung **could not fire**. Swept 24
phase × days × experience worlds: off-season peaks at 14/15, every pre-season and
in-season world still reaches 16. The fixture moved off-season → pre-season.

### THREE DEFECTS THIS SESSION WERE MINE, FOUND BY MY OWN INSTRUMENTS

1. **A mutation reddened NOTHING.** The "pin outranks the two-block maximum"
   mutation walked straight through: the cell pinned a name the cap does not act
   on, so it passed for the wrong reason. Rewritten to run the cap's own scenario
   twice — once with every candidate pinned — and demand the same answer. The
   mutation now reds.
2. **THE PARTIAL-KIT FIXTURE WAS MALFORMED.** `EquipmentAnswer.tags` is a RECORD
   of `tag -> 'have'`; I passed an ARRAY. The answer resolved to no kit, so the
   "dumbbell athlete" was silently a BODYWEIGHT athlete and every partial-kit
   cell was testing the wrong world. `a-fixture-is-a-claim-too`.
3. **MAIN/SECONDARY WAS THE WRONG SIGNAL, AND IT HID A PRODUCT DEFECT.** I keyed
   "is this a main lift" off the pool's ANCHOR bench. Every anchor is a barbell
   lift, so a partial-kit athlete has no anchor rows and those cells compared an
   empty set to itself. The app's own line is `slotCountsTowardSetBudget` — what
   `countMainSecondarySets` counts. Switching to it immediately red on
   `single_leg_knee`, `vertical_push` and `vertical_pull` **still changing every
   week inside one block**, because they are not the day's primary row for a
   planned pattern and fell to the accessory cadence. Fixed in `composeWeek`.

### AND ONE PRODUCT DEFECT THE PARTIAL-KIT TABLE EXPOSED

The dumbbell athlete's `hinge` slot has TWO legal options. Block 1 took RDLs,
block 2 retained it, and **block 3's cadence index wrapped straight back to
RDLs** — the cap "fired" and the athlete got a third consecutive block anyway.
The cap now REMOVES the exercise it is dropping from the walk instead of stepping
one index past it.

## MUTATION RECEIPTS — `bash scripts/mutate-rotation.sh`

Seven mutations, all red. The suite is 38/38 and every cell has been seen fail.

| mutation | reddens |
| --- | --- |
| main lifts rotate weekly again (the original defect) | 4 cells, both athletes |
| the deload advances the cadence | accessory deload hold |
| the two-block maximum is removed | 4 cells |
| a pin outranks the two-block maximum | 2 cells |
| retention ignores history, always keeps | 3 cells incl. its control |
| the pin bias is dropped | the pin control |
| an empty legal list invents a row | the typed-gap refusal |

## GATES — BASE `dda2747d` vs THIS BRANCH

| suite | base | now | delta |
| --- | --- | --- | --- |
| `test:compile` | 6 failing pairs | 6 failing pairs | **0 — red on `main` itself** |
| `test:exercise-exclusions` | 51 / 0 | 51 / 0 | 0 |
| `test:pools` | 473 / 1 | 473 / 1 | 0 (pre-existing) |
| `test:ladder-wide` | 13 / 1 | 13 / 1 | 0 (pre-existing) |
| `test:block-two-boot-preservation` | — | 20 / 0 | 0 |
| `test:equipment-answer` | — | 41 / 0 | 0 |
| `test:block-two-ladder` | 51 / 1 | 49 / **3** | **+2** |
| `test:block-two-progression` | 37 / 0 | 32 / **5** | **+5** |
| `test:block-two-difficult-missed` | 88 / 0 | 84 / **4** | **+4** |
| `test:block-two-screen-delivery` | 35 / 0 | 34 / **1** | **+1** |
| `test:exercise-rotation` (new) | — | **38 / 0** | new |

**12 NEW REDS, NOT ONE OF THEM REWRITTEN.** They share two signatures:

- **`ABSENT_ROW`** — Deadlift/Pull-Ups are no longer in block 2 for an athlete
  whose history does not qualify. Contract-correct: *"most exercises normally
  rotate at a new build block"*; the old expectation was an artefact of the
  week-keyed cadence landing on Deadlift by coincidence.
- **the ladder's set rung has nothing to land on** — with every compound lift now
  block-stable and retained, all six progressed by LOAD, so no lift is eligible
  for a set. Contract-correct ("load first, set second"), but it leaves that
  rung's world without a subject.

⚠ **A TENSION WORTH SAM'S EYE, NOT A BUG.** Retention fires whenever the lift
progressed, which for a consistent athlete is ALWAYS — so every compound lift is
kept for exactly two blocks and then rotated, in lockstep. The contract permits
this (*"may remain for a second consecutive block"*, *"maximum is two"*) and
accessories still rotate weekly, so *"most exercises change"* still holds by row
count. **The four-block tables show this rhythm plainly and it is the thing to
look at first.**

## SESSION 3 — THE EXPERIENCE GATE WAS ALREADY THERE, AND NOTHING CONSUMED IT

**The answer to "why is the composer not consuming `experienceGate`": nothing was.**
`data/muscleExperienceMetadata.ts` authors a gate for every exercise,
`rules/experienceCrosswalk.ts` maps an athlete to the gates they may be
auto-programmed from, and `isExerciseAutoProgrammableFor` joins them — with
**ZERO production callers**. The identical shape to the deleted pool rotation and
to `prefs.pinned`: a complete authored authority running on nothing. **Three of
them now, in one mission.**

It is consumed in ONE place: the composer's legality step, ordered
exclusion → equipment → experience. No second policy, and **no exercise-name list
anywhere** — Bodyweight Squat and Goblet Squat are authored `everyone_regression`
and `2-5 years` does not see that gate, so rulings 4 and 5 fall out of data that
already existed.

### THE ACCEPTANCE CHECK — experienced full-gym athlete, four real blocks

```
before   squat   Goblet Squat → Goblet Squat → Bodyweight Squat → Goblet Squat
after    squat   Leg Press ×4
before   hinge   Deadlift first
after    hinge   RDLs first
```

**No Bodyweight Squat. No Goblet Squat. Merge condition met.**

### ⚠ THE "SQUAT POOL GAP" WAS MY FIXTURE. RETRACTED.

**I reported that an experienced full-gym athlete had one legal squat and asked
Sam whether to add a rack or more exercises. The premise was false and the ask
should never have been made.**

`fullKitEquipmentAnswer` is a hand-authored TEN-tag list whose docstring claims
it grants *"every tag"*. That stopped being true on **2026-08-13**, when `rack`
and `trap_bar` stopped collapsing onto `barbell` and seven new askable tags
appeared. The canonical `commercial_gym` preset pre-ticks **all seventeen**. With
no rack, Back Squat, Front Squat, Box Squat and High Box Squat are kit-illegal,
and the only two squats left standing are both regression-gated — so Leg Press
was the last one out. **The gap was manufactured by the fixture.**

Fixed by DERIVING the answer from the production preset the way `EquipmentScreen`
does, so it cannot drift again:

```
presetEquipmentAnswer('commercial_gym')   // 17 tags, rack and trap_bar included
```

**The corrected experienced full-gym athlete:**

```
squat   Back Squat → Back Squat → Box Squat → Box Squat
hinge   RDLs       → RDLs       → Deadlift  → Deadlift
```

Real barbell squats, held two blocks, then rotated. **No Bodyweight Squat, no
Goblet Squat.** `fullKitEquipmentAnswer` itself is deliberately NOT changed —
many suites' worlds would move, and that is its own unit.

**FOURTH FIXTURE DEFECT OF THIS MISSION.** The others: an array where a record
was wanted; anchor-bench membership as the main-lift signal; `'Intermediate'`
where `ExperienceLevel` has no such member. Every one of them made a cell pass or
a finding appear for the wrong reason.

### ⚠ THE GENUINE NO-RACK CASE IS KEPT, AND GUARDED

Ruling 4. An athlete with machines and **no rack** is a real athlete, and for
them Leg Press really is the only experience-legal bilateral squat — retaining it
is correct. Cell [14b] states that athlete explicitly and proves both halves: the
commercial-gym athlete DOES get rack-required squats, and the no-rack athlete
does NOT and keeps Leg Press. Repairing the fixture did not erase the true case.

### ⚠ ONE REMAINING POOL-CONTENT GAP, REPORTED AS RULING 3 REQUIRES

Measured after each filter, for the experienced full-gym athlete:

**`single_leg_hip` authors ONE exercise in total — `Single-Leg RDL`.** No kit and
no experience level can rotate it. It is retained with
`reason: 'single_legal_candidate'` rather than crossing a movement group, which
is ruling 3's instruction. **This one is real and survives the corrected
fixture.**

### ⚠ TRAP BAR DEADLIFT IS NEVER SELECTED — OBSERVED, NOT FIXED

With the rack and trap bar present, hinge candidates order as
`RDLs → Trap Bar Deadlift → Deadlift`. The measured four blocks give
**RDLs, RDLs, Deadlift, Deadlift** — index 1 is stepped over, because a retention
does not consume a cadence step and the block-keyed index moves on regardless.

Ruling 7 says *"rotate legally between the preferred options"*, so a preferred
option never appearing is worth Sam's eye. **Deliberately NOT changed here:** the
fix is a change to cadence semantics, and this session was scoped to the fixture
correction with *"no new audit or unrelated work"*.

### MUTATION RECEIPTS — 11 mutations, all red

New this session: the experience gate not consumed; the experience gate refusing
instead of falling back (ruling 6); hinge priority dropped; single-leg becoming
retention-eligible (owner and composer).

⚠ **THE HARNESS ITSELF HAD TWO DEFECTS, AND BOTH ARE FIXED:**

1. **IT DESTROYED A SESSION OF UNCOMMITTED WORK.** It undid each mutation with
   `git checkout -- <file>`, which on a dirty tree writes HEAD over whatever you
   had. It wiped every session-3 edit to both rule files the moment it ran. **A
   REVERT IS A WRITE.** It now backs the files up to a temp dir and restores from
   that, so it can run on a dirty tree — which is the entire point of a mutation
   harness. The work was reapplied from context and committed BEFORE mutating.
2. **IT READ A DEAD SUITE AS A CLEAN ONE.** Removing ruling 6's fallback makes
   generation REFUSE, so the suite crashed, printed no `FAIL` lines, and the
   harness reported "nothing went red" — the opposite of the truth. It now
   requires the totals line and calls its absence `RED (SUITE KILLED)`.

## GATES — BASE `dda2747d` vs THIS BRANCH, FINAL

| suite | base | now | delta |
| --- | --- | --- | --- |
| `test:compile` | 6 failing pairs | 6 failing pairs | 0 — red on `main` itself |
| `test:exercise-rotation` (new) | — | **53 / 0** | new |
| `test:exercise-exclusions` | 51 / 0 | 51 / 0 | 0 |
| `test:pools` | 473 / 1 | 473 / 1 | 0 |
| `test:ladder-wide` | 13 / 1 | 13 / 1 | 0 |
| `test:equipment-answer` | 41 / 0 | 41 / 0 | 0 |
| `test:edge-generation-equipment` | 37 / 1 | 37 / 1 | 0 (pre-existing) |
| `test:block-two-boot-preservation` | 20 / 0 | **20 / 0** | 0 — re-aimed |
| `test:block-two-screen-delivery` | 35 / 0 | **35 / 0** | 0 |
| `test:block-two-ladder` | 51 / 1 | **51 / 1** | 0 — same pre-existing red |
| `test:block-two-difficult-missed` | 88 / 0 | 87 / **1** | +1 |
| `test:block-two-progression` | 37 / 0 | 28 / **9** | +9 |

**From 12 new reds to 10, and four suites returned to base parity.**

### THE 10 REMAINING REDS ARE ONE SHAPE, AND NOT REWRITTEN

Every one is a hard-coded exercise NAME the corrected rotation no longer places
in block 2 — `Bicep Curl (Barbell)`, `Copenhagen Plank (Half)`, `Pull-Ups` — and
each is caught by that suite's own liveness cell reporting `ABSENT_ROW`. Their
SUBJECTS (accessory load seeding, bodyweight added-load restoration) remain valid
product rules.

**Why the names moved:** ruling 2 gives a block ONE accessory per slot instead of
one per week. Block 2 of the progression world now carries three accessories
(`Banded Dead Bug`, `Banded External Rotation`, `Banded TKE`) where weekly
rotation gave it nine. **⚠ This is a visible drop in accessory variety per block
and Sam should confirm it is what he wants** — it follows directly from ruling 2.

They are NOT re-aimed because re-aiming needs a world that contains a loaded
accessory AND Pull-Ups, and choosing one carelessly is how three fixture defects
already entered this mission. That is the next honest piece of work.

## FIRST TRACE (REDESIGN) — THERE IS NO SELECTION-HISTORY OWNER

Ordered before any redesign coding. Driven through the REAL boot
(`rebuildDerivedWorld`), not argued from the code.
`scripts/trace-selection-history.ts`.

| question | answer |
| --- | --- |
| **A.** boot with UNCHANGED inputs | identities return **identical** |
| **B.** boot after the athlete's equipment answer changed | **REWRITTEN** |
| **C.** any identity in durable storage | **NONE** |

**B is the finding.** The athlete builds a block on a commercial-gym answer, then
loses the rack before relaunching. The block they already accepted comes back
changed underneath them:

```
hinge:  Trap Bar Deadlift  →  Deadlift
squat:  Front Squat        →  Leg Press
```

**Nothing was reloaded — it was re-derived.** `program-store`'s `partialize`
persists exactly six keys — `generationAnchorISO`, `seasonPhaseClock`,
`sessionFeedback`, `weightOverrides`, `temporarySourceFacts`, `injuryEpisodes` —
and **no selected exercise name appears anywhere in the persisted bytes.**
Identities survive a boot today only because replay happens to be deterministic
*when nothing changed*. Change one legality fact and the past is rewritten.

That is precisely the failure the redesign order names: *"Do not infer the
previous selection by replaying the current candidate list: equipment, injury and
preferences may have changed, and replay would rewrite history."*

**No canonical owner exists to reuse.** The decision ledger is append-only and
typed to ATHLETE decisions (`AthleteDecision`); a block's selected exercises are
the app's decision, not the athlete's. So a typed `BlockExerciseSelection` record
has to be added, storing the decision — block identity, slot/group, role,
canonical identity — and never another program snapshot.

## MERGE VERDICT (SUPERSEDED — see the redesign order)

⚠ The verdict below covers the CURSOR implementation, which Sam has ruled must
not merge. It is kept because its gate numbers are still the baseline the
redesign is measured against.



**MERGE THE ROTATION OWNER. DO NOT MERGE THE TEN STALE CELLS AS-IS.**

Met: no regression squat reaches an experienced full-gym athlete; rack-required
squats are available and selected; the no-rack case still retains Leg Press;
58/0 on the new suite with 11 mutations all red; four suites at base parity; the
typecheck gate unchanged (6 pairs, red on `main` itself).

**The ten remaining reds are all one shape** — a hard-coded exercise NAME the
corrected rotation no longer places in block 2 (`Bicep Curl (Barbell)`,
`Copenhagen Plank (Half)`, `Pull-Ups`, and one `Deadlift` case), each caught by
its own liveness cell reporting `ABSENT_ROW`. Their SUBJECTS — accessory load
seeding, bodyweight added-load restoration — remain valid product rules.

**RE-EVALUATED AGAINST THE CORRECTED FIXTURE, AS ORDERED, AND THE ANSWER IS NO:**
pointing `blockTwoProgressionTests` and `blockTwoDifficultMissedTests` at the
canonical commercial-gym answer makes them WORSE, not better:

| suite | malformed fixture | canonical fixture |
| --- | --- | --- |
| `test:block-two-progression` | 28 / 9 | **20 / 17** |
| `test:block-two-difficult-missed` | 87 / 1 | **84 / 4** |

With a rack present the hinge and squat picks move again, so `Deadlift` leaves
block 2 as well. **The corrected fixture does not rescue them; it moves them
further.** Re-aiming them is therefore a real unit of work that must be done ON
the canonical fixture so it is done once — not folded into this correction. The
probe was reverted from a local backup; both suites are back at 28/9 and 87/1.

## NOT COVERED

- **The 12 new reds are not adjudicated cell by cell.** They are explained and
  classified above, and NONE has been rewritten. That is session 3's work and it
  must be per-cell, not a bulk sweep.
- **The dead `selectPoolEntry` family is still standing.** Burn the Boats is
  scoped to a legacy selector that EXECUTES and rewrites or rejects the new owner.
  Measured: it has zero production callers, so it rewrites nothing and there is
  no boat under way to burn. Deleting it would also take `test:pools` (473 cells)
  with it. **Recommendation: delete in its own commit, not folded into this one.**
- **The post-decision rewrite audit is empirical, not exhaustive.** Cell [11]
  proves no generated program in this suite carries a `ex-canonical-*` repair row
  and no repair-path placeholder name. `workoutCanonicalisation.fallbackPatternRow`
  is the one identity-minting function found; it is a repair path and does not
  execute on generation. The full materialise → assemble → finalise chain has NOT
  been read line by line.
- Proof 13 (an ordinary substitution may rotate back later and creates no
  exclusion) has no cell yet.
- No simulator/device pass. Everything here is headless.
