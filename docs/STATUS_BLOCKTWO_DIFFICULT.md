# STATUS — seat `blocktwo-difficult`

Mission: BLOCK TWO — DIFFICULT AND MISSED BLOCKS. Base `6117a9fd` (main).
Branch `feat/block-two-difficult-missed`, isolated worktree.

Own file per CLAUDE.md law 3. `docs/STATUS_BLOCKTWO.md` belongs to the seat that
built the successful-progression path and is not touched here.

## BASELINE, MEASURED AT `6117a9fd` BEFORE ANY EDIT

- `test:block-two-progression` — 37 passed, 0 failed.
- `test:ladder-wide` — **140 worlds built, 40 refused, 0 deficient of 368
  laddered days**, and **one cell already RED at base: `most worlds actually
  built`** (13/14). That red is the parked baseline, not this mission's.

## FOUR MEASUREMENTS THAT SHAPED THE BUILD

**1. A VERY-HARD BLOCK ALREADY COLLAPSES TO ONE SET, AND THAT CONTRADICTS THE
APPROVED CONTRACT.** Generating block 2 for the same athlete against three
histories (identical except the recovery answers) gives, for `Deadlift`:

| history | block 2 |
| --- | --- |
| good / mild | `3 × 4-6 @ 102.5` |
| **very_hard / high** | **`1 × 4-4 @ 100`** |
| very_easy / none | `4 × 4-6 @ 102.5` |

Every strength row behaves the same way — `3 → 1` sets, and the rep range is
pulled down too (`6-10 → 4-8`, `8-12 → 6-10`, `12-15 → 10-13`). The contract
says a very-hard block reduces a FOUR-set main lift to THREE. One set is not
that number, and reps are not on its reduction list at all.

**The load is already held correctly** (100, not 102.5) — clause 1 of path A was
true before this mission.

**2. THE FOUR-SET MAIN LIFT IS REAL AND THE COMPOSER NEVER AUTHORS IT.**
`resolveComposedDose` clamps every main lift to 3 (`min(setsMax, max(setsMin, 3))`).
Four sets appear only when the authoring-time freeze ADDS a set after an easy
block — which is exactly the contract's own progression order. So a four-set main
lift in block 1 is an athlete whose block 0 went easily, and it reaches block 2
through the recorded `StrengthExercisePerformanceLog.prescribedSets`.

**3. NO REACHABLE GENERATED WORLD CONTAINS HARD CONDITIONING.** 48 worlds swept
(3 phases × {3,4} training days × {Poor,Good} conditioning × {Never,Regularly}
sprint × {0,2} team days). Every world that built produced ONLY
`aerobic_base` and `tempo` components — `hard=0` in all of them. The rest
refused (`sprint_high_speed_required_minimum`, `hard_day_permitted_maximum`,
`main_strength_permitted_maximum`, `required_safe_patterns_present:hinge`).

Consequence, stated rather than hidden: the hard-conditioning clauses (A4, A5)
are built and guarded against constructed workout trees carrying hard
conditioning, and wired into the real generation path — but **no generated
fixture can exercise them today**, and making generation emit hard conditioning
is a scheduler change this mission's boundaries forbid.

**4. `soreness` HAS NO `severe`.** The vocabulary is `none | mild | moderate |
high`. A fixture written with `severe` type-errors but still RUNS under
sucrase — it silently becomes "not in the good set", which reads as a working
guard. High is the top of the scale.

## PATH A — MUTATION RUN, 24 MUTATIONS, ALL SEEN RED

Control 52/52 green. Four mutations SURVIVED the first pass and each one named a
real hole, none of which reading would have found:

**M1 — the contract's own number was decoration.** Raising
`HARD_BLOCK_MAIN_LIFT_SETS` from 3 to 4 changed nothing. `resolveComposedDose`
clamps every main lift to three, so the AUTHORED ceiling was doing all the work
and the constant could never bind. The "Deadlift runs at 3 sets" cell was passing
for the wrong reason. Closed by a decision-layer cell that hands the rule an
authored FOUR-set main lift — the only coordinate where the contract's number is
the binding one, and one generation does not produce.

**M5 — two doors, one fixture.** The fixture answered `very_hard` AND `high`
together, so deleting either reader left the other carrying the verdict. Closed
by an effort-only fixture and a soreness-only fixture, plus a cell that an
ordinary `hard` block does NOT reduce.

**M7 — the deload clamp had no coordinates.** It only bites for an exercise that
has recorded history AND appears in the deload week, and the generated fixture
puts `Deadlift` in no week-4 session. Closed by a decision-layer cell.

**M11 — reps added back are invisible against the control.** The comparison is
"hard block vs well-recovered block"; adding reps to the freeze's already-lowered
range lands the row exactly ON the control's number and the comparison stays
silent. Closed by asserting the volume owner moves `prescribedSets` AND NOTHING
ELSE — which also kills M10 a second way.

**M9 was weak rather than dead.** An accessory sits at the two-set floor already,
so reducing it and refusing to reduce it produce the same number. The cell now
asserts NO DECISION EXISTS, not that the number did not move.

## PATH B — MUTATION RUN, 20 MUTATIONS, ALL SEEN RED

Control 86/86 green. One mutation SURVIVED the first pass:

**B5 — `partial` counted as attendance, and no fixture had one.** The attendance
blocks were built from `full` and `skipped` only, so a rule that treated a
half-done session as a completed one had no coordinate to fail on. **`partial` is
the commonest real answer for exactly this question's athlete** — the one whose
life is getting in the way. Closed by a fully-partial block that reads as ZERO
attendance and therefore ASKS.

## THE MEASUREMENT THAT DECIDED PATH B'S SHAPE

The production legality probe (which asks generation, not a table), over nine
worlds at `6117a9fd`:

| phase | d=3 | d=4 | d=5 |
| --- | --- | --- | --- |
| Pre-season | **[]** | [3] | [4,3] |
| In-season | **[]** | [3] | [4,3] |
| Off-season | [2] | [3,2] | [3,2] |

**A pre-season or in-season athlete already at three sessions has NO legal
smaller programme** — `main_strength_permitted_minimum` refuses two — so the
honest answer for them is no question at all (`no_legal_smaller_commitment`).
It cost a crashed test run to find: the first version of the confirm cell tried
to rebuild a 3-day pre-season athlete at 2 and generation refused outright.

## SUITE SWEEP — BRANCH vs CONTROL, IDENTICAL

39 suites run in this tree and in a clean `6117a9fd` worktree. **The pass/fail
set is identical except `test:block-two-difficult-missed`, which does not exist
at control.** Every red in the sweep is the parked baseline:
`block-rollover`, `block-state`, `week-rebuild`, `deload-week`, `readiness`,
`readiness-ownership`, `conditioning-identity`, `conditioning-rotation`,
`quiescent-boot`, `weekly-dose-ownership`, `projection-ownership`,
`surface-agreement`, `law-registry`, `ruling-registry`, `repo-law-guards`,
`ladder-wide`.

`test:compile` returns 468 errors / 6 worse pairs — the base's own numbers, and
all six pre-existing files. No new pair.

---

# MISSION 2 — SCREEN DELIVERY + THE TWO-SESSION CONTRADICTION

Continued on `feat/block-two-difficult-missed` from `437d6693`.

## THE TWO-SESSION CONTRADICTION — TWO CAUSES, ONE OF THEM MINE

**CAUSE 1 — §18 IS A SECOND REPRESENTATION OF A NUMBER THE SCHEDULER OWNS.**

| | pre-season athlete, 2 gym days |
| --- | --- |
| scheduler | clause **WC-110**, `requiredStrengthSessions = 2` (Full Body ×2) |
| §18 phase table | `early/mid/late_preseason`, `strength.required = 3` |
| result | **REFUSED** `main_strength_required_minimum`, actual 2 |

Sam's approved source already resolves it — *"Four is preferred when
availability permits. Two days gets Full Body ×2"*
(`docs/WEEKLY_PROGRAMMING_SOURCE_REVIEW_2026-08-14.md:140`) — and so does his
2026-08-15 ruling in `schedulerExposureContract`'s own header: *"§18 derives its
acceptance contract from the scheduler's completed weekly schedule. It is not an
independent planner."* Fixed by passing the scheduler's own count as a typed
`insufficient_availability` reduction. **`insufficient_availability` already
existed** — the V1 contract records it for availability today; only V2 never
heard about it.

**CAUSE 2 — `commitmentPatchFor` KEPT THE FIRST `n` DAYS.** "The first two of
Mon/Tue/Wed/Fri" is Monday and Tuesday, and WC-110 says *"never back-to-back"*.
Now keeps the best-separated subset, scored on CYCLIC gaps.

**⚠ MY EARLIER NINE-WORLD TABLE WAS WRONG, AND BOTH HALVES WERE ARTEFACTS.** It
read pre-season and in-season `d=3 → []`. Corrected:

| phase | d=3 | d=4 | d=5 |
| --- | --- | --- | --- |
| Pre-season | **[2]** | [3,2] | [4,3,2] |
| In-season | **[2]** | [3,2] | [4,3,2] |
| Off-season | [2] | [2] | [2] |

## WORLD DELTAS — ZERO LOST, ZERO GAINED

`test:ladder-wide` after the §18 change: **140 built, 40 refused, 0 deficient of
368**, row counts `{"2":36,"3":70,"4":28,"5":116,"6":112,"7":6}` — byte-identical
to the pre-change run. Every ladder world already carries three or more gym days,
so the correction recovers none of them. 39-suite sweep identical.

## SCREEN DELIVERY

Two cards on the Program surface, reusing the missed-session card + chip pattern.
`useBlockBoundaryPrompts` derives both and **has no writer**;
`store/weeklyCommitmentAnswer.ts` is the only one. Acknowledgement and the
commitment answer are decision-ledger entries, so **no new persisted key**.

`test:block-two-screen-delivery` (35 cells) CALLS the real components, walks the
element tree, and invokes the real `onPress`. 13 mutations red.

**⚠ TWO OF MY OWN GATES WERE DECORATION.** The hook short-circuited on attendance
and on an existing answer; the rule owns both and returns before calling the
probe, so deleting them changed neither answer nor cost. Two mutations survived
twice before I believed it. Deleted.

## STILL OWED — THE SIMULATOR PASS

The element-level suite proves behaviour, not pixels. The device receipt is not
taken yet.

**ENVIRONMENT IS READY, CONFIRMED:** simulator `LFA Explorer 4c8535f`
(`0B4DEE36-F01D-47B2-B73A-E9BE2A7167A2`) is BOOTED and
`com.localfootyathlete.app` is INSTALLED. Start with `npm run lfa:dev`.

**THE ROUTE IS THE `christmas-break-ask` PRECEDENT.** That seed exists because a
date-gated card's cells were source-pinned and *"no device has ever rendered
them"* — the same position these two cards are in. Two seeds are owed in
`devE2ESeedIds.ts` / `devE2ESeedRegistry.ts`:

- `hard-block-two-notice` — block 2, block 1 logged `very_hard` / `high`, the
  stored program carrying its `blockBoundaryExplanation` reduction row;
- `missed-block-commitment-ask` — block 2, 6 of 12 block-1 sessions completed.

Then drive `home-block-boundary-notice-dismiss`,
`home-weekly-commitment-option-2` and `home-weekly-commitment-decline` with
Maestro, and relaunch to prove the acknowledgement and the decline survive.

---

# VISUAL PASS — NOT OBTAINED. THE BLOCKER IS A REAL DEFECT.

Attempted at `a0ac856d`. **No screenshot of either card was taken.** What follows
is what the attempt found, and the branch is back at exactly `a0ac856d`.

## WHAT WAS TRIED

The app was started from THIS worktree (`QA_SIM_UDID=0B4DEE36…`,
`QA_METRO_PORT=8083`) onto the booted `LFA Explorer 4c8535f`; it launched. Two
dev seeds (`hard-block-two-notice`, `missed-block-commitment-ask`) were written
following the `christmas-break-ask` precedent, and **both build correctly
headless** — 4 microcycles, 21 explanation rows, `hard_block_reduced` present.

Deep-linking to either seed lands on **`dev_e2e_app_hydration_failed:derived-world`**
— *"The app did not start"*. Clearing harness state and re-seeding reproduces it.

## ⚠ THE FINDING — BOOT DOES NOT FEED THE BLOCK BOUNDARY

`store/quiescentBoot.ts`, the derived-world rebuild:

```
const program = generateProgramLocally(profile, {
  weekAcceptance: 'restoration',
  todayISO: generationISO,
  previousProgram: null,
  ...(clock ? { seasonPhaseClock: clock } : {}),
});
```

**No `blockNumber` and no `progressionHistory`.** Both defaults are documented in
`generateProgram.ts` and were written by this seat in mission 1: absent
`blockNumber` means **block 1**, and *"ABSENT NOW MEANS EMPTY, NOT 'GO AND
LOOK'"* for the history.

So every relaunch regenerates at block 1 against an explicitly empty history.
**The whole block-boundary layer is erased on boot** — the load progression that
merged at `6117a9fd`, the very-hard reduction, and the stored
`blockBoundaryExplanation` the notice renders from. `weekRebuild.ts` passes these
at the rollover; boot does not.

**CONFIDENCE.** The missing arguments are a code fact. That they erase the layer
follows from generation's stated contract. **That this is the CAUSE of the
hydration refusal is an inference I did not confirm** — the refusal's own message
was never read, and other causes (the seeds' `blockState`, the anchor) are not
excluded.

## WHAT WAS REVERTED, AND WHY

The one-line boot fix (pass `blockNumber` + `progressionHistory` from the
persisted inputs) was written, and **backed out**. It did not clear the refusal
on device, `test:quiescent-boot` is already RED at baseline so it could not
report on it, and an unverified change to the boot path is worse than a reported
defect. The two seeds went with it — incomplete and unverified.

## THE NEXT STEP, IN ORDER

1. **Read the refusal.** `[boot][hydration] the derived-world rebuild…` is
   truncated on screen and absent from `/tmp/qa-metro.log`. Get the full text
   before changing anything.
2. Fix the boot inputs, and **guard it**: a cell that generates a block-2
   programme, boots, and asserts the explanation row survives.
3. Re-land the two seeds and take the screenshots.

`test:dev-e2e-seeds` throws on `stacked-team-training-upper-pull` at `a0ac856d`
BEFORE reaching any new seed — confirmed by a control run at HEAD. Pre-existing;
not repaired here.
