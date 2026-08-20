# STATUS — seat `finish-integration`

**One name, one file, one writer.** Opened 2026-08-20.
`ls docs/STATUS_*.md` before the first commit returned 39 files; **`FINISH_INTEGRATION`
was free** (the nearest neighbours are `FINISH_JOURNEY`, `FINISH_PROGRAMMING`,
and the two candidate files this integration brings in,
`FINISH_SETTINGS_PERSISTENCE` and `FINISH_INJURY`, `FINISH_COACH_PRODUCT`).

**Base:** `main @ 7d1bdf24`, frozen tag `sessionui-r117-frozen`.
**Branch:** `finish/integration-candidate`.
**Worktree:** session scratchpad `wt-integration`; control worktree `wt-control`
detached at the same `7d1bdf24`, both sharing the main checkout's `node_modules`.
**Stamp:** `Agent: finish-integration`. Commits by explicit pathspec only.
**THE SHARED MAIN CHECKOUT IS NOT WRITTEN TO. THIS DOES NOT MERGE TO `main`.**

## WHAT I READ BEFORE TOUCHING ANYTHING

`CLAUDE.md`, `AGENTS.md` (both halves — LAW ZERO, the count/anchoring laws, L1–L16,
the shared-checkout environment facts), `docs/CODEX_HANDOFF_2026-08-11.md`,
`docs/STATUS_FINISH_PROGRAMMING.md`, `docs/STATUS_FINISH_JOURNEY.md`, and each
candidate's own status file read out of its own commit:
`STATUS_FINISH_SETTINGS_PERSISTENCE` (815 lines, 4 sessions),
`STATUS_FINISH_INJURY` (468 lines), `STATUS_FINISH_COACH_PRODUCT` (433 lines).
`docs/RULINGS_REGISTRY.md` and `src/rules/lawRegistry.ts` were measured, not read
for recall — see the id census below.

## ⚠ FINDING 0 — TWO OF THE FIVE CANDIDATES ARE ALREADY IN THE BASE

Measured, not recalled:

```
git merge-base --is-ancestor 12fac3f1 7d1bdf24  -> YES
git merge-base --is-ancestor 74c593aa 7d1bdf24  -> YES
git rev-list --count 7d1bdf24..12fac3f1         -> 0
git rev-list --count 7d1bdf24..74c593aa         -> 0
```

- **Programming `12fac3f1`** landed at `e6d45010`
  (`merge(PROGRAMMING): 41 findings cleared…`).
- **Journey `74c593aa`** landed at `3ddc4c16`
  (`merge(JOURNEY): the complete athlete lifecycle is held…`).

So lanes 1 and 5 of the ordered integration are **VERIFY-ONLY**: no merge is
performed, their targeted guards are run against the integrated tree and compared
to the same guards at base. The three lanes that carry unmerged bytes are
**Settings `88f17e2c` (19 commits), Injury `da545333` (7 commits, includes
`b09626a3`), Product/Coach `18968818` (8 commits)** — all three branched from
`main @ 9f081efa`, which is 13 commits behind the base, with the whole SESSIONUI
R-110…R-117 era in between.

## RULING-ID CENSUS — MEASURED ACROSS THE COMBINED REGISTRY BEFORE RESOLVING

Both registry row formats counted (`## R-nnn — …` headings and `**R-nnn** · …`
rows); an earlier count that matched only the second format missed the
weekly-reduction row entirely and would have reported no `R-105` duplicate.

| tree | rows | duplicates | free ids below the max |
| --- | --- | --- | --- |
| base `main @ 7d1bdf24` | 116 | **R-105 (twice)** | **R-114, R-115** |
| Settings `88f17e2c` | +1 | — | claims **R-114** |
| Injury `da545333` | +2 | — | claims **R-114, R-115** |
| Product/Coach `18968818` | +0 | — | fills the existing R-105 weekly-reduction row |

**Combined demand: `R-114` is claimed twice and `R-105` is used twice.**
The already-landed ids `R-112`, `R-113`, `R-116`, `R-117` are untouched.

### THE RESOLUTION, AND WHY

- **`R-105` stays with the weekly-reduction ruling** — Sam ruled it on
  2026-08-20 in as many words.
- **The power-pool ruling takes `R-118`** — the *next unused id measured across
  the combined registry*, which is the mechanism Sam's own ruling names
  (*"must receive the next unused ruling id during integration, after all
  concurrent branches are present"*). All branches are now present; `R-118` is
  the first id no tree uses.
- **Injury keeps `R-114` and `R-115`.** They are a matched pair — the matrix
  authority and the withholding it enables — and `da545333` had already been
  renumbered once (from `R-112`/`R-113`) when sessionui landed those ids on
  `main`. Splitting the pair to save the same single row-move is the worse trade.
- **Settings' combined-day *COUNT IT* ruling moves `R-114` → `R-119`.** One row,
  and that lane had also already renumbered once (from `R-112`).

Every registry row, law-registry row, source comment, status reference and guard
naming a moved id is updated in the same commit as its move.

---

# THE INTEGRATED CANDIDATE

**Branch `finish/integration-candidate`.** Cut from `7d1bdf24` (tag
`sessionui-r117-frozen`). **NOT MERGED TO `main`, and the shared main checkout
was never written to** — every measurement below comes from
`scratchpad/wt-integration` against `scratchpad/wt-control`, a detached worktree
at the same `7d1bdf24` sharing the main checkout's `node_modules`.

| # | lane | candidate | how it entered |
| --- | --- | --- | --- |
| 1 | Programming | `12fac3f1` | **already in base** at `e6d45010` — verified, not merged |
| 2 | Settings/persistence | `88f17e2c` | merged, 1 conflict |
| 3 | Injury core + Injury UI | `da545333` (incl. `b09626a3`) | merged, 4 conflicts |
| 4 | Product/Coach | `18968818` | merged, 4 conflicts |
| 5 | Journey | `74c593aa` | **already in base** at `3ddc4c16` — verified, not merged |

No `measure/*-DO-NOT-MERGE` branch was merged, cherry-picked or copied from.
Both such branches (`e585ed5d`, `2e9a5a13`) exist and were read only as prior
seats' written findings, exactly as their own status files ask.

## CONFLICT RESOLUTIONS AND THEIR OWNERS

| file | lanes | resolved to |
| --- | --- | --- |
| `package.json` `test:bible` | all 4 | UNION, each lane's suites inserted at the position they hold in that lane's own chain. **400 sweepable entries, zero duplicates, every entry resolves to a defined script.** |
| `src/rules/lawRegistry.ts` | all 3 merged lanes | UNION of tail appends. 143 rows, zero duplicate ids (136 + 3 + 2 + 2). |
| `docs/RULINGS_REGISTRY.md` | all 3 | UNION, spliced into ASCENDING id order rather than appended. 119 rows, **zero duplicates**. |
| `src/screens/home/DayWorkoutScreenV2.tsx` | Injury × `main` R-116/R-117 | **`main` owns the layout; the candidate owns the withholding.** See below. |
| `src/utils/weekRebuild.ts` | Coach × Settings | **THEIRS at the call site** — the Coach extraction is the caller — and the extraction now reads Settings' `statedProgressionInputs`. |
| `src/store/profileProgramTransaction.ts` | Coach × Settings | BOTH kept; the Coach docblock's premise re-written as history because this tree falsifies it. |

### THE ONE THAT DECIDED THE UI — `DayWorkoutScreenV2`

`main`'s R-116 made `ExecutionChecklistItem`'s `children` a RENDER PROP
`(checkbox) => ReactNode` so the tick could join the weight stepper as one
control group. The Injury candidate still carried the pre-R-116 shape and drew
the tick itself. **Either side taken wholesale loses a ruling.**

Resolution: `main`'s render-prop signature and its 22x22-drawn/44x44-tappable
Pressable are kept byte-for-byte; R-115's `withheld` prop is added; and the SKIP
marker REPLACES the tick INSIDE the same `checkbox` handover — so a withheld
row's marker lands on the control line where the tick would have been, and there
is still exactly ONE place in the app that decides what sits at that position.

The candidate's fourth hunk re-added the affected-row badge and the cue
disclosure at their PRE-R-116 position, which R-116 had moved into the grid's
text stack. **Taken verbatim it would have drawn both TWICE.** The R-115 injury
sentence is re-sited to where the affected-row notice actually lives now.
Verified after resolution: exactly ONE `CueDisclosure` and ONE `affectedRowNotice`
in `StrengthExerciseCard`.

### THE HOMESCREEN RECONCILIATION — MEASURED, NOT ASSERTED

`git diff 7d1bdf24 -- src/screens/home/HomeScreenV2.tsx` is EXACTLY the R-105
deletion: 2 imports, 6 destructured names and 2 JSX blocks out, one comment
naming where the behaviour went in. Nothing else.

- `SectionIcon` 2, `RowIconKind` 5, `rowIconColor` 4 — **identical to base**, so
  the shared section-icon owner is untouched.
- `handleSwapExercise`, `handleRemoveExercise`, `onSwapRow`, `onRemoveRow`,
  `swapExerciseAtDate`, `removeExerciseAtDate` — **0 in both trees.** No
  row-level Swap/Remove control was restored.

## RULING-ID RENUMBERS

The combined registry was counted in BOTH row formats before any id moved. An
earlier count matching only `**R-nnn**` missed the `## R-105` weekly-reduction
heading entirely and would have reported no duplicate at all.

| ruling | was | now | why |
| --- | --- | --- | --- |
| the weekly-reduction conversation | `R-105` | **`R-105`** | Sam ruled it keeps the id, 2026-08-20 |
| the power-pool / primer-yields ruling | `R-105` | **`R-118`** | Sam: *"must receive the next unused ruling id during integration, after all concurrent branches are present"*. All are present; `R-118` is the first id no tree uses. |
| the injury-matrix authority | `R-114` | **`R-114`** | kept — a matched pair with R-115, and already renumbered once from R-112 |
| an injury withholds a row | `R-115` | **`R-115`** | kept |
| the combined-day *COUNT IT* ruling | `R-114` | **`R-119`** | collided with Injury; one row moves instead of splitting the pair. Its third id — written R-112, then R-114 by its own seat. |

**Every registry row, `lawRegistry` `ruledAt`, status reference and guard naming
a moved id was updated in the same commit as its move** — 12 exact-string edits
for the power-pool move (registry row, its renumber note, the weekly-reduction
row's forward reference, 4 in `docs/STATUS_ORCHESTRATOR.md`, 6 in
`src/__tests__/generatedPowerDeliveryTests.ts`) and 3 for the combined-day move.
`grep -rn R-114` now returns provenance prose only.

**THE REGISTRY IS NOW 119 ROWS, ZERO DUPLICATES, `R-001`..`R-119` CONTIGUOUS.**
`R-112`, `R-113`, `R-116` and `R-117` were never touched. The `R-105` duplicate
was already on `main` before this integration began.

## ⚠ THE LANE DEFECT THIS INTEGRATION FOUND AND FIXED

**`test:injury-fallback-journey` — the lane's own new guard — was DYING, and its
three restart cells were green and empty.** Section [11] called
`quiet(() => relaunchApp('injury-visible:relaunch'))` at three sites. Broken
twice over: `relaunchApp` takes `{ storage, todayISO }`, so the label arrived as
`args` and `args.todayISO` was `undefined`; and being un-awaited inside `quiet`,
the restart could not have happened before the next comparison even with the
right argument — the inert-relaunch shape `test:settings-persistence` M8 exists
for. The suite printed `172 passed, 0 failed` and then killed the process on the
unhandled rejection, exit 1.

**REPRODUCED ON THE FROZEN CANDIDATE `da545333` IN ITS OWN DETACHED WORKTREE** —
the candidate's defect, not the merge's. Fixed the way sections [4] and [8] of
the same file already call it. **POSITIVE CONTROL, COUNTED:** `[relaunch]
ENVELOPE` lines go **13 -> 16**. Three restarts that never happened now happen.

---

# VERIFICATION

## COMPLETE TEST-ROSTER COMPARISON

`scripts/sweep.sh`, both runs read ONLY after their own `SWEEP RESULT` line.

| | control `7d1bdf24` | integrated candidate |
| --- | --- | --- |
| failing suites | **185 of 396** | **184 of 400** |
| **GAINED** (red only on the candidate) | — | **0** |
| **LOST** (red only at base) | — | **1 — `test:tap-swap-hierarchy`** |

The +4 sweepable suites are the four this integration adds to the chain, and
**none of them is in the failing set**: `test:settings-persistence`,
`test:injury-fallback-journey`, `test:injury-recomposition`,
`test:coach-weekly-reduction`.

**SANITY-CHECKED BEFORE THE TOTALS WERE BELIEVED** — the known baseline reds are
present in both sets: `law-registry`, `ruling-registry`, `repo-law-guards`,
`exercise-exclusions`, `signed-copy-extraction`, `visible-surfaces`,
`week-rebuild`, `block-rollover`, `composer-severance`.
`test:mid-block-restart` is absent from BOTH — it is **not in the chain**, so
the sweep never runs it; it throws at base independently.

## GATES

| instrument | control `7d1bdf24` | integrated |
| --- | --- | --- |
| `test:law-registry` | **136 rows / 115 guarded / 21 UNENFORCED**, 12 passed / 2 failed | **143 / 122 / 21**, 12 passed / 2 failed |
| `test:ruling-registry` | 6 passed / 2 failed; 9 rulings UNENFORCED against a ceiling of 4 | **identical** — same 9 ids |
| `test:signed-copy-extraction` | 7 passed / 1 failed; **584** unauthored athlete-visible strings, ceiling 580 | 7 / 1; **583** |
| `test:copy-rulings-binding` | 9 passed / 0 failed | **9 / 0** |
| `test:repo-law-guards` | 55 passed / 8 failed | **55 / 8** |
| `test:compile` | exit 1; **89 over-baseline entries** — 85 test files, 4 product files reading CLEANER than baseline, **zero product files worse** | exit 1; **89 entries, SET DIFF EMPTY** |

**Seven new law rows, every one BORN GUARDED. The UNENFORCED count did not rise
— 21 on both trees.** The two law-registry failures are the same two cells by
name on both trees.

## GENERATED-WORLD CENSUS — UNITS AND DENOMINATORS

`scripts/probe-refusal-census.ts`, run on both trees.

| | control `7d1bdf24` | integrated |
| --- | --- | --- |
| generation OCCURRENCES | 180 | **180** |
| distinct athlete SETUPS (dedup key `phase/days/club-state/kit`) | 90 | **90** |
| occurrences BUILT / REFUSED | 180 / 0 | **180 / 0** |
| distinct setups that refuse | 0 of 90 | **0 of 90** |
| typed refusal FAMILIES | 0 | **0** |

**The Programming lane's 180-world acceptance holds unchanged after all three
merges.** This is 180 generation occurrences, not 180 athletes: the same 90
setups are each generated at two microcycle limits.

## THE LANE SUITES — INTEGRATED TREE, EACH RUN ALONE

Chained npm scripts make the last totals line lie, so every suite was run on its
own and its exit code read, never its tail.

| lane | suite | result |
| --- | --- | --- |
| Programming | `test:weekly-scheduler` | scheduler 96/96 · fixtures 11/11 · travel 10/10 · off-season 9/9, exit 0 |
| Programming | `test:power-primer-policy` | 58/0 · generated power delivery **48/48**, exit 0 |
| Programming | `test:conditioning-phase-authorship` | 42/0, exit 0 |
| Programming | `test:generated-week` | 36/0, exit 0 |
| Settings | `test:settings-persistence` | **187 passed / 0 failed**, exit 0 |
| Settings | `test:results-persist` · `test:worn-world-boot` | 5/0 · 5/0 |
| Injury | `test:injury-fallback-journey` | **172 / 0, exit 0** (was exit 1, DYING) |
| Injury | `test:injury-recomposition` · `test:tap-swap-hierarchy` | 41/0 · **25/0** |
| Injury | `test:injury-guard` · `test:injury-client-guard` | 193/0 · 61/0 |
| Coach | `test:coach-weekly-reduction` | **64 / 0**, exit 0 |
| Coach | `test:coach-tab-slice1` · `test:block-two-screen-delivery` | 80/80 · 36/0 |
| Coach | `test:block-two-extra-session` | 40 passed / 1 failed (base: 18 passed + 8 FAILED, then THROWS) |
| Journey | `test:athlete-journey` | **64 / 0**, exit 0 |
| Journey | `test:block-two-boot-preservation` · `-difficult-missed` · `-ladder` · `-progression` | 20/0 · 88/0 · 59/0 · 38/0 |
| Journey | `test:profile-rehydration-cannot-unfinish` | 5/0 |
| accepted UI | `test:session-execution` | **177 / 1 on BOTH trees — same failure NAME**, diffed not counted |
| accepted UI | `test:conditioning-copy-census` | 35/0 |
| exclusion/load | `test:exercise-exclusions` | 53/1 (base 52/1, **same single failure name**) |
| exclusion/load | `test:strength-progression-inputs` · `-capacity-laundering` · `workout-log-progression-wiring` | 18/0 · 25/25 · 34/0 |
| travel/kit | `test:travel-zero-equipment` · `test:dated-equipment-fact` · `test:equipment-answer` | 10/0 · 3/0 · 41/0 |

## MUTATION RESULTS

Every mutation applied by EXACT STRING with its anchor asserted to occur exactly
once, restored from an OWN backup (never `git checkout --`), and the tree
verified byte-identical by sha after each.

| lane | subjects re-run | killed | harness |
| --- | --- | --- | --- |
| Settings | **7 of the lane's 22** — the ones whose owners the merge touched, plus its headline properties | **7 / 7** | integrator's runner |
| Injury | **17 of 17 — the lane's whole set** | **17 / 17** | the lane's own `scripts/mutate-injury-fallback.js` |
| Coach | **5 of the lane's 13**, plus 1 new integration-specific subject | **6 / 6** | integrator's runner |

The integration-specific mutant is the one that matters here: replacing the
merged extraction's `statedProgressionInputs(persistedState)` with empty history
reds **7 cells in `test:athlete-journey` and 4 in `test:settings-persistence`**,
naming the athlete's own loads (`Leg Press 125->113.5`). **The two lanes' owners
really are joined, and the join is under a guard.**

Settings subjects re-killed: the settings door states the history (10 reds); the
dated-fact door states it too (3); the fresh-install reset is total (THROWS by
name); the club-night lifts are recorded (3); the denominator is component-aware
(2); the shared predicate discriminates (2); remove means remove in storage (6).

Coach subjects re-killed: the rebuild is the last gate (2); a preview does not
author (2); the preview is built from the hook's own world (1); the Program page
does not draw the moved conversation (1); the tab carries the derived
notification (1).

---

# ⚠ THE ONE THING THIS CANDIDATE IS NOT CLEAN ON

**RESTORE STOPS RETRIEVING THE REMOVED EXERCISE ONCE AN INJURY SWAP HAS TAKEN A
SLOT ON THE SAME DAY. It is a CROSS-LANE INTERACTION: no candidate has it
alone.**

Measured, and the bisect is on this branch's own merge sequence:

| tree | `test:session-change-sequence` |
| --- | --- |
| control `7d1bdf24` | **ALL GREEN — 22 passed** |
| frozen Settings `88f17e2c` · integration step 2 `407a133c` | **GREEN** |
| frozen Injury `da545333`, and its own base `9f081efa` | **GREEN — 22 passed** |
| integration step 3 `91b0aa70` (Settings + Injury) | **21 passed, 1 failed** |
| integrated candidate | **21 passed, 1 failed** |

`test:session-change-durability` moves **42 passed / 5 failed -> 40 / 7** over
the same step. The 5 base reds are identical name for name and survive; the two
new ones have the same subject as the third.

**THE THREE NEW RED CELLS, ALL ONE SUBJECT:**
- *restoring the removal brings the EXACT row back*
- *RESTORE returns the EXACT original session — the row is back in its place at its load*
- *RESTORE brings the removed row back*

**THE MECHANISM, QUOTED FROM THE RUN RATHER THAN INFERRED.** The trigger is step
[3] of the sequence — remove `Bench Press`, swap, restart, then declare a knee
injury at 6/10. The injury pass's own sentence changes across the merge:

- Settings only: *"Injury restrictions are active. **Back Squat left out —
  nothing safe was available.**"* — an OMISSION.
- Settings + Injury: *"Injury restrictions are active. **Back Squat swapped for
  Chest-Supported DB Row.** That means no squatting this session."* — a SWAP,
  and **a swap is a WRITE**.

The Injury lane's derived ladder gives the injury an answer where before it had
none (the census behind it: same-pattern answers **6 -> 479** of 1569 unsafe
occurrences). That answer is written as a day override, built from a week
regenerated after the restart — and Settings' session-3 change removes an
excluded row at AUTHORING time, so that regenerated week no longer contains
`Bench Press` at all. The override is baked without it.

**AND THERE IS NO REBUILD TO RECOVER IT.** Probed directly:
`restoreExcludedExercise('Bench Press')` returns **`rebuildRequired: false`**,
because the exclusion's scope is `today_only`. The property can only be
delivered by the read-time reveal, and the row is no longer there to reveal.

**THE 2026-08-19 FIX IS NOW INERT FOR THIS PURPOSE.**
`coachActions.resolveDateWorkout` states `athleteExclusions: []` so a writer-side
read carries the hidden row — the recorded law
*"a filter that gets written down is not a filter"*. After the authoring-time
removal there is nothing hidden to un-hide: the row is genuinely absent, so
lifting the filter reveals nothing. **The seam still exists and no longer does
its job.**

**WHY IT IS NOT FIXED HERE, AND THIS IS A DELIBERATE STOP.** The fix is not a
line — it requires deciding what a writer-side read of a day should contain now
that removal is a storage fact, which re-opens Sam's 2026-08-19 *"Remove means
simply remove the selected exercise/component. Nothing replaces it"* as applied
to storage, against *"Restore still retrieves the block's recorded exercise"*.
**Two of his own rulings meet on one slot.** That is L7 (Sam gates) and it is the
same ownership question `finish-injury` refused to answer and escalated. Patching
it at the caller would be the edge-case fix his standing instruction forbids.

**AND THE REASON EVERY LANE MISSED IT: NEITHER SUITE IS IN `test:bible`.**
`test:session-change-sequence`, `test:session-change-durability` and
`test:session-change-hub` are all outside the chain, so the full sweep — which is
why `GAINED` reads 0 — cannot see them. *A check outside the chain is a check
nobody runs*, and this is that law's newest case. **Putting them in the chain is
left to whoever fixes the defect**, because adding a known-red suite to the chain
is a decision about what the chain means, not a measurement.

---

# NOT COVERED

- **NO PHYSICAL iPHONE.** L10 is unmet by construction. The simulator evidence
  below is a simulator, not Sam's device, and nothing here is "done".
- **THE RESTORE-AFTER-INJURY-SWAP DEFECT ABOVE IS NOT FIXED.** It is athlete-
  facing and it is a regression against the base.
- **THE THREE SESSION-CHANGE SUITES ARE STILL OUTSIDE `test:bible`**, so nothing
  in the chain watches that defect.
- **MUTATION COVERAGE IS PARTIAL FOR TWO LANES.** Settings 7 of 22 subjects,
  Coach 5 of 13 plus 1 new. Injury is 17 of 17. The subjects NOT re-run are the
  ones whose owners no merge touched; each lane's own status file records its
  full set and they were not re-verified here.
- **`test:mid-block-restart` throws at base and still throws.** Not in the chain,
  not investigated.
- **185 of 396 chain suites are red at base and 184 of 400 here.** This
  integration did not reduce that backlog and was not asked to; only
  `test:tap-swap-hierarchy` moved, and it moved green.
- **`test:compile` is red on both trees** against a documented stale baseline.
  Zero new diagnostics is what was verified; the backlog is untouched.
- **HANDOFF-COND-REACH is untouched** — `sessionui`'s recorded finding that the
  headless harness and the phone disagree about whether off-season conditioning
  exists, and that an in-season athlete reaches no conditioning row in any of 8
  headless variants. Sam scoped it out of the UI task and it is not integration
  work either.
- **The stored-vs-visible exclusion residue, the double-regeneration ownership
  question, and the Coach lane's B-1..B-5 findings** are carried forward as their
  own lanes recorded them; only B-3/B-4 were re-measured here, by the Settings
  lane, before the freeze.
- **No away/holiday dated span (R-072 scope 3)** was walked. `test:away-flow` is
  red at base and here.

## LOG

- 2026-08-20 — worktree cut from `7d1bdf24`, control cut beside it, base swept
  (185 of 396). Programming and Journey verified already present.
- 2026-08-20 — Settings merged (`407a133c`), Injury merged (`91b0aa70`),
  Product/Coach merged (`8cb589bd`). Ruling ids settled. Full sweep, compile,
  census, gates and mutation batteries run. The restore-after-injury-swap
  interaction found, bisected and recorded.

Agent: finish-integration
