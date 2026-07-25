# Load rulings + never-again literal lock + Phase 1.6 purge — build report (L2)

**Branch**: `feat/load-rulings-literal-lock-phase16-purge` → merged to `main`
`--no-ff` (`ada0510`).
**Commits**: `01caba3` (stage 1), `de7db07` (stage 2), `a9d70f2` (stage 3),
`2df5165` (stage 4).
**Status**: **Gates green, awaiting Sam device acceptance.**

---

## Stage 1 — Sam's load rulings, applied exactly

`LOAD_RULING_PENDING` is now **EMPTY**, and the gate asserts the emptiness: a
future addition parked there without a RULED row in the changeset fails the
build. Every ruled value is **parsed from Sam's table** and compared to shipped
code in both directions — a ruling cannot be recorded without shipping, or
shipped without being recorded.

| Exercise | loadRatio | EXERCISE_LOAD_MAP | Ruling as applied |
|---|---|---|---|
| High Box Squat | **1.14** | `{ squat, 0.90, barbell }` | 1.2 × Box Squat, **both** numbers derived from Box Squat's own (0.95 / 0.75). Heavier, not lighter. |
| Glute Bridge | **0.00** | **none** — stays `TRUE_BODYWEIGHT_EXERCISES` | Bodyweight-with-optional. No starting suggestion. |
| Single-Leg Hip Thrust | 0 (slot convention) | `{ squat, 0.20, dumbbell }` | As proposed. |
| Hamstring Curl | 0 (slot convention) | `{ squat, 0.25, machine }` | As proposed. **See rounding, below.** |
| Back Extension | 0 (slot convention) | `{ squat, 0.15, dumbbell }` | As proposed. |
| Single-Arm DB Floor Press | 0.35 | `{ bench, 0.22, dumbbell }` | Unchanged. |
| Speed Trap Bar Deadlift | n/a — still power-staged | `{ squat, 0.45, barbell }` | 40 kg reference. Placement still the power unit's. |

**Glute Bridge got one extra removal.** It was carrying a
`{ squat, 0.00, bodyweight }` entry in `EXERCISE_LOAD_MAP` *as well as*
membership of `TRUE_BODYWEIGHT_EXERCISES`. The bodyweight set short-circuits
before the map is ever read, so that entry was a second representation of a fact
another owner already held. It is gone. The cue's "add weight to hips if you can"
is now the whole instruction, which is exactly what "bodyweight-with-optional"
means.

Erg EMOM's conditioning triple and the QL / ATG names are recorded as **ruled**,
not proposed.

### One thing to rule: `Hamstring Curl` cannot read 22.5 kg

Your figures pin your reference athlete at an **88 kg squat 1RM**, and three of
the four fall out of the ratios exactly:

| | at 88 kg squat | your figure |
|---|---|---|
| Single-Leg Hip Thrust | 17.5 kg | 17.5 ✓ |
| Back Extension | 12.5 kg | 12.5 ✓ |
| Speed Trap Bar Deadlift | 40 kg | 40 ✓ |
| **Hamstring Curl** | **20 kg** | **22.5 ✗** |

22.5 is not on the machine grid at all: `ROUND_INCREMENTS.machine` is **5 kg**, so
the value can only ever be 20 or 25. Re-classing it as `dumbbell` would produce
22.5 — and would also be wrong, because equipment class gates availability
filtering and a leg-curl stack is not a dumbbell. So the ratio ships as you ruled
it and the discrepancy is flagged rather than papered over. Either the machine
grid is accepted, or plate-loaded stacks move to a 2.5 kg increment. Your call;
it is a one-line change either way.

---

## Stage 2 — Medicine Ball Overhead Throw retired

The last of the family. Chest Pass and Slam went on 2026-07-24; Overhead Throw
was still standing.

Both equipment-conditional branches in `buildPowerBlock` are gone, so the
function no longer takes or reads `availableEquipment` — that parameter existed
*only* to decide whether to offer a med-ball alternate. The power block is now
unconditionally bodyweight: Vertical Jump / Pogo Hops (reduced) for lower,
Explosive Push-up for upper.

`POWER_EXERCISE_POOL_SPEC`'s existing-entries table loses both med-ball rows and
records that its rule 7 ("equipment substitutes, never forces") has nothing to
substitute today — it still governs any equipment-gated entry the pool adds
later, e.g. Depth Jumps needing a box.

The power-primer suite's two equipment assertions became one **stronger** claim,
proven by comparison rather than asserted: the same athlete with and without a
medicine ball now gets byte-identical power options.

---

## Stage 3 — the never-again lock

Full sweep and the complete literal list live in
**`docs/EXERCISE_NAME_LOCK_REPORT_2026-07-25.md`**. Summary here.

The vocabulary switch closed the *generator's* naming rights. It said nothing
about names written into **code**, which bypass every one of those gates. That
class had already cost us three times:

- `Medicine Ball Overhead Throw` lived in `buildPowerBlock` for months — no cue,
  no video, no pool, no gate that could see it.
- `Leg Curl`, a name you **retired**, was still in a journal fixture.
- the **live** "Add exercise" affordance offers **six** names the app cannot cue.

`src/rules/exerciseNameLiteralSweep.ts` extracts them; `test:exercise-name-lock`
is the gate and it is in `test:bible`. **An exercise-name literal in code that
does not resolve to the locked vocabulary now fails the build.**

**Precision was the whole design problem.** The first draft matched every `name:`
in the codebase and returned 88 unresolved strings — mostly store keys and
onboarding screen names. An unreadable list gets rubber-stamped, not ruled on. So
a literal only counts as an exercise name when it sits in `name:` /
`exerciseName:` inside an object that **also prescribes a dose** (`sets`, `reps`,
`exerciseOrder`, `equipmentRequired`, `prescriptionType`, durations), or in a bare
`*EXERCISES` string array. A builder's exercise always comes with its dose; a
store key, a route, an icon and a session title never do.

Post-purge: **49 distinct literals across 97 positions** — 38 resolve outright,
11 carry a typed exemption, **0 unaccounted**.
`data/defaultProgram.ts` is deliberately in scope despite its path, and the suite
asserts the sweep reaches it — so it cannot go blind to the class that hid the
med-ball throw.

### Six live names render NO cue — your ruling owed

All offered by `src/screens/home/DayWorkoutScreenV2.tsx`, a reachable screen.
Parked under `awaiting_sam_ruling`; the gate asserts both that they still render
no cue **and** that the report names every one, so the park cannot go quiet.

| Offered today | Proposed mapping |
|---|---|
| `Split Squat` | The census flagged plain split squat as a **distinct easier regression** from Bulgarian, not a synonym — so an ADD, not a rename. Or drop the suggestion. |
| `Calf Isometric Hold` | No equivalent exists. Needs an add or a drop. |
| `Hip Mobility Flow` | Point at the existing **Hips/Adductors/Groin Reset** flow template rather than invent a movement name. |
| `T-Spine Openers` | `Open Book Thoracic Rotation` — same drill, already in vocabulary. Straight swap. |
| `Bike Flush Finisher` | `Easy Bike` — already in vocabulary (tier C flush). Straight swap. |
| `Tempo Run Finisher` | `Tempo Run` — already in vocabulary. Straight swap. |

**I did not apply the three straight swaps.** Changing what the athlete is
offered is a content decision, and this unit exists precisely to stop those
happening silently.

The exemption list cannot rot: an exemption for a name that now resolves, or for
a literal the sweep no longer finds, **fails the build**.

---

## Stage 4 — Phase 1.6 purge

Manifest: **`docs/PHASE_1_6_DELETED_MANIFEST_2026-07-25.md`**.

**Reachability was recomputed, not trusted.** The import graph was walked from
`App.tsx` *and* from every entry point `package.json` scripts actually run, plus
every `__tests__` file. That distinction is the cross-check you asked for:

- **112** product files are unreachable from `App.tsx`
- **15** of those are still reached by a test or dev-harness entry
- so only the **97** unreachable from *everything* were deleted

Deleting the list as given would have broken suites inside `test:bible`. The
15-file gap is recorded in the manifest as kept-with-reason (`trainAroundEngine`,
`weeklyCoachUpdate`, `blockAdjuster`, the explorer harness modules, and others —
dead to the app, alive to the harness; retiring them means retiring their
consumer first, which is a separate call).

**101 paths deleted in total:**

- the 97 unreachable product files — legacy Supabase service layer, auth /
  profile / journal / program / workout screens, the coach component set,
  `AddExerciseModal`, stale `.d.ts` shadows, orphan barrels, `rulesEngine.ts`
  (whose `getAvailableEquipment` was the last 'Medicine Ball' string, reachable
  only from a zero-caller function);
- the two dead edge functions and their `config.toml` registration — both
  confirmed dead by import graph, and both still naming retired exercises (6 and
  4 respectively);
- `SessionDurationScreen` plus `sessionDurationMinutes` from **both sides of the
  generation contract** (D6b): the type, the onboarding field, the navigator
  route, the Review row, the client's recommended-fields list, the edge
  function's profile type and its two prompt lines, and the 36 test fixtures that
  supplied it;
- `activeCoachNotesTests.ts`, the crashed never-run suite.

Also routed the two legacy `set_recovery_mode` `modifierTitle` sites through
`readinessFactAttribution` (`tapProgramModifiers`, `coachConstraintProducers`).
Both hardcoded an athlete-facing name the A4 owner already computes — the exact
second vocabulary that finding retired, where a tap fact read "Recovery mode
active" while the same fact read "Not 100% today" on the Program card.

### The lock proved itself

Stage 3's `dead_mock_fixture` exemptions were built to self-liquidate, and they
did. Deleting the journal screens removed `Leg Curl` and `Squat`; the sweep
stopped finding them; the staleness assertion **failed the build** until the
exemptions were removed. The kind is now provably empty. A mechanism that cleans
up after itself, checked by the gate rather than by memory.

---

## Gates

| Gate | Result |
|---|---|
| `test:bible` (incl. `test:compile`) | **EXIT 0** — 792 PASS assertions |
| `test:content-reconciliation` | PASS |
| `test:generation-vocabulary` | PASS |
| `test:pools` | PASS |
| `test:locked-list` | PASS 32/32 |
| `test:exercise-name-lock` (new) | PASS 9/9 |
| `test:authored-cues` | PASS |
| `test:exercise-canonicalisation` | PASS |
| `test:cue-join` / `test:readiness-ownership` | PASS |

### Typecheck ratchet — before / after, and now stricter

| Scope | Before | After | Δ |
|---|---|---|---|
| **product** (ships to athletes) | 63 | **38** | −25 |
| devtools | 53 | 53 | — |
| tests | 388 | 383 | −5 |
| **TOTAL** | **504** | **474** | **−30** |

The baseline is **updated**, so the gate is now stricter — those 25 product
errors can never come back.

**12 baseline entries vanished BY DELETION, not by anyone fixing a type error**,
and the baseline's own `_ownership` notes now say so explicitly (11 product, 1
test, each named). A future reader cannot mistake a deletion for a fix, and the
63 → 38 drop is attributable rather than mysterious.

---

## NOT-COVERED

- **No device or simulator verification.** Every claim here is static or
  test-derived. **Device acceptance is the gate.** Highest-value checks: the
  power block now showing a single bodyweight option (no med-ball anywhere), the
  new starting weights on High Box Squat / Hamstring Curl / Back Extension /
  Single-Leg Hip Thrust, Glute Bridge showing **no** weight, and — because 101
  files were deleted — that every screen still reachable in the app still opens.
- **The 15 kept-but-app-unreachable files are still dead to the athlete.**
  Retiring them means retiring their test or dev-harness consumer first. Listed
  in the manifest; not a decision I made unilaterally.
- **The six parked names still render no cue.** That is a real, live defect, made
  loud rather than fixed, because the fix is a content decision. Three are
  one-line swaps the moment you say yes.
- **`Hamstring Curl` will read 20 kg, not your 22.5.** Machine rounding, flagged
  above.
- **The literal sweep is position-based, not semantic.** It cannot see an
  exercise name assembled at runtime (template string, array join, name built
  from parts) or passed as a bare function argument rather than a `name:`
  property. Nothing like that exists today — the sweep found no such site — but
  the class is not closed by construction, only by the current shape of the code.
  A future builder that composes names dynamically would slip past, and the honest
  statement is that this lock closes hardcoded literals, not all possible naming.
- **`docs/LFA_PROGRAMMING_BIBLE.md` still names med-ball options** (~lines 1029,
  1034-1035) and `docs/canonical-exercise-list.md` still lists Medicine Ball Slam
  and Rotational Throw. Those are your coaching documents, not app content — not
  edited without your say.
- **Pre-existing failures NOT caused by this unit**, so they are never
  misattributed: `generatedProgramNormalizerTests` fails the same 3 tests on
  `main` and here; `programmingBiasTests` fails the same 1
  ("inside midfielder and outside runner produce a small safe ordering
  difference") on both. Verified by stashing to `main` and re-running.
- **`illnessRecoveryWeekMode.ts` shows a 4 → 2 improvement** I did not make and
  did not claim in the ratchet — it predates this branch and belongs to another
  unit's baseline.

---

## Next

1. **Sam device acceptance** — the gate.
2. **The six parked names** (§ Stage 3) — three are straight swaps.
3. **`Hamstring Curl` rounding** — accept 20 kg, or move plate-loaded machine
   stacks to a 2.5 kg increment.
4. **The power unit** — `POWER_EXERCISE_POOL_SPEC`, which is now the only thing
   standing between eight staged power names and a real pool, and which also owns
   the missing cues for `Vertical Jump`, `Explosive Push-up` and
   `RFE Split Squat Jump`.
