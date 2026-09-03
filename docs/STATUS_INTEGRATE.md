# STATUS — seat `integrate`

Owner: the `integrate` seat (Claude Fable 5.1, Claude Code). One writer.
Worktree: `/private/tmp/lfa-integrate-ed8298af`, branch
`candidate/2026-09-03-integrated`.

## 2026-09-03 — Sam: "start from candidate ed8298af, integrate audit commits 6031df4a and 05f1cc44, run the complete canonical-compiler command and the full release gate, fix only genuine reds family by family, rerun the six simulator flows, report whether it is ready for my phone"

**Acceptance criteria (restated once, checked against every slice).**
1. The candidate `ed8298af` carries both audit commits; the ownership file
   keeps the candidate's newer census reviews where the two sides met.
2. `npm run test:compile`, `npm run test:canonical-weekly-compiler` (the
   whole chain) and `npm run test:release` are green on the merged tree.
3. Only genuine reds are fixed; a demonstrably stale test is re-pinned with
   the ruling that superseded it named.
4. The six `.maestro/audit/` flows PASS on the simulator against the merged
   tree.
**Non-goals.** No features. No side findings (the merged mobility/strength
taxonomy, the double-squat merge). Nothing outside a red's own family.

### Integration
- Fork point `e0788875`. Candidate side: `74ef3174`, `ec0d6d55`, `ed8298af`.
  Audit side: `6031df4a`, `05f1cc44`.
- `git merge --no-ff 05f1cc44` onto `ed8298af`: **no textual conflict.**
  `scripts/weekly-writer-ownership.json` keeps the candidate's four
  re-reviewed rows (`scheduleWeek`, `materialiseAuthoredSessions`,
  `generateProgramLocally`, `selectConditioningTemplateWithTrace`) and takes
  the audit's two (the `useDayWorkout` re-review, the `appSprintDay` row
  dropped with its function). `weeklyScheduler.ts` merged cleanly: the
  candidate's WC-143 Speed-rides-the-fast-session block and the audit's
  deletion of the zero-caller `appSprintDay` do not overlap;
  `appSprintNeedPermitted` keeps its three live callers.
- Merge commit `35fe7f38`.
- `test:compile` on the merge: **PASSED — product 0, devtools 0, tests 0.**

### Canonical compiler chain, first run on the merge (`35fe7f38`)
Slice **10605 / 0**; reset-coach 19/0; athlete-session-deletion 139/0;
program-hydration-ownership 83/0; **fixture-mutation-transaction 20 / 1** —
the chain stops there (cell 17, "Friday school game plus Saturday club game
are two explicit fixtures": `g2_hard_lower:2026-03-25`).

### Family 1 — a fixture add published a full hinge on G-2 (APP, fixed)
REGISTRY-GREP: R-095, R-359, R-009, Section 17.C.

**Bisect (same suite, hard-linked node_modules, control worktrees):**
`e0788875` fork point 21/21 · `74ef3174` (hard-day breach advisory) **20/1**
· `ec0d6d55` 20/1 · `05f1cc44` audit tip 21/21. The audit commits are not the
cause; the candidate's own R-359 addendum commit is.

**Mechanism, measured with a probe on the cell's world** (In-season, five
gym days, club Tue/Thu, Saturday game, athlete adds a Friday game):
- Before `74ef3174`: the hard-day breach was a contract BLOCKER, so both
  minimal candidates (keep every session) were `impossible`; the replan fell
  through to its full regeneration from the compiler's fixture-conditioned
  target — one merged lower day on Monday, club nights without strength,
  Wednesday mobility. No G-2 finding. That is the week cell 17 was green on.
- After: the breach is advisory, the keep-everything candidate is accepted,
  wins on edit size, and publishes Wednesday's hinge (RDLs, hamstring curl)
  two days before the athlete's new Friday game. The Section 17 craft tier
  flags it (`g2_hard_lower`, strong) and the gateway only DISCLOSES; the
  replan rejected on strong G-1 alone and its ranking read contract blockers
  only. Two accepted candidates, both `craftBlockers: 1`, zero rejected.

**Why it is the app, not the test.** Section 17.C G-2 ("no full hard lower
session on G-2") stands; R-095 ranks G-2 above the injury exception. R-359
made the hard-day breach a warning — it never made G-2 one. The green result
before `74ef3174` was a coincidence of the blocker, not a rule.

**Fix (`fixtureMinimalReplan.ts`, `acceptedStateTransaction.ts`):**
1. `FixtureReplanEditCost.craftBlockers` — the gateway's craft-tier blocking
   count on the candidate — ranks directly after `section18Blockers`, ahead
   of every edit-size dimension. Writer: `scoreCandidate`. Readers:
   `compareFixtureReplanEditCost`, the regeneration comparison below, and the
   rolling-horizon score (`craftBlockingWeeks`, after `blockingWeeks`).
2. When the best accepted minimal candidate still carries a craft blocker,
   the compiler's own week for these fixtures (the former inline fallback,
   now `regenerateFromCompilerTarget`) is scored by the same cost and wins if
   it is violation-free; a regeneration that is itself blocked loses on
   `section18Blockers`, an equally flawed one on edit size. The fixture fact
   is never refused (the gateway's "a craft violation may fail a candidate;
   it may never veto a fact" holds).

**Receipts.**
- Cell 17 red-first on `35fe7f38` (the chain run above); with only step 1
  still red (both candidates carry the violation); with step 2 **green**, and
  the published week is byte-equal to the fork point's (Mon `lower` with
  Broad Jumps / Leg Press / RDLs / Cossack / Nordic / Tib / Short Flush; club
  Tue/Thu; Wed Mobility; no strong finding).
- `test:fixture-mutation-transaction` **21 / 0**. `test:compile` PASSED
  (0/0/0 against baseline).
- Blast radius, fix vs control (`35fe7f38`, same node_modules), identical:
  g1-move-durability 35/0 · accumulated-away-transaction 20/0 ·
  move-game-relaunch 10/0 · chained-mutation-continuity 927/0 ·
  session-change-durability 59 · fixture-conditioned-replan 16/34 with the
  **same 18 FAIL lines** (md5 `757b442b…` both sides; inherited, diagnostic).
- Writer census: three owners moved (`scoreCandidate`,
  `buildFixtureMinimalReplan`, new nested
  `buildFixtureMinimalReplan.regenerateFromCompilerTarget`), re-reviewed
  with their prior classifications; **1166/1166, 0 unresolved, 0 rival, 0
  derived-output, gate exit 0.**

North star: TOWARD — no new stored state; the craft verdict the gateway
already derives now ranks the repair instead of being disclosed after it.

### Canonical compiler chain, second run (after family 1)
temporary-source-facts 90/0; conditioning-balance-repair 42/0. Red, identical
in the pre-fix control tree: session-injury-review [5] ×2,
injury-session-adjustment 51/54, injury-compiler-preview (12 running-budget
cells + a persistence witness that throws). All inherited from before the
fork; all in the injury family.

### Family 2 — the injury suites: four stale pins, two app defects
REGISTRY-GREP: R-275, R-303, R-356, R-095, R-124, Section 8 (6-7 band).

**Stale pins (test re-pinned, ruling named in the cell):**
1. `injuryCompilerPreviewTests` "keeps phase conditioning target" ×12 pinned
   `coreConditioning === 5` for normal Off-season; **R-303 (2026-09-01)** set
   that density to four. Re-pinned to the contract's own
   `OFFSEASON_OVERLAYS.normal_build.conditioningTarget.max`, never a literal.
2. `injuryCompilerPreviewTests` "persistence witness reaches a derived fatigue
   constraint" expected one cooked report to derive a constraint; **R-275
   (2026-08-30)** superseded R-038: one cooked report is rest on its own date
   and derives nothing, two consecutive dated reports deload through Sunday.
   The witness now files the second tired day (flat, next date) and reaches
   the R-275 sequence constraint; the crash behind the generic "nothing
   changed" (`temporarySourceFactIds` of `undefined`) was the test's own
   non-null assertion on a constraint that does not exist.
3. `injurySessionAdjustmentTests` "home athlete reaches a conditioning
   replacement": **R-356 (1)+(5)** — on a kit with no erg the withdrawn
   on-feet session has no replacement and the day rests. Re-pinned: the
   review withdraws the hard intermittent with `to: null` and does not say
   nothing changed.
4. `injurySessionAdjustmentTests` [1] CONTROL "a lower-body session with
   something safe in it" and [7] "the safe row is untouched": the tags rate
   every squat/hinge/lunge/single-leg/calf/plyo row `caution` or `avoid` for a
   knee (34 + 3 of 37, measured), so a four-compound lower session (a93f3ad2)
   holds no knee-`good` row at 7 and the Bible's 6-7 band pauses them all.
   Re-pinned: CONTROL is the session (≥5 rows); [7] holds safe rows untouched
   when any exist, else every original row paused, never silently dropped.
5. `sessionInjuryReviewTests` [5] "the review proposes nothing": the quiet-day
   search read `unsafeRowsForInjury` (the matrix) alone; the preview the
   review is built from also runs the typed exposure filter, which withdrew
   `Adductor Rockback` on a groin 6 Mobility day (the row has no tag; the
   matrix says `unknown`). The review honestly said "take out Adductor
   Rockback" while the helper had promised silence. The search now asks the
   preview owner (`compileSessionInjuryPreview`, before == after, rows and
   conditioning); the cell keeps judging the review's words. [5] 6/6.

**APP defect A — a dose edit refused as a "regression choice"
(`tapSwapHierarchy.assessTapSwapCandidateSafety`).** A prescription edit
travels through the swap door as a swap to the row's own name. When the app
itself had placed a source-bound regression (Incline Push-Up for the 1-2 year
female-5-home athlete), `sets +1` on it was refused: "available only from its
approved source exercise" — the source being the row's own name. Fix: keeping
the row's own exercise is not a regression choice; the relation governs
CHOOSING the regression from its source. Every other safety check still runs.

**APP defect B — an injury recompile promised a fourth conditioning day
(`canonicalWeeklyRowCompiler`, the delivered-day evidence).** female-6
(In-season, club Wed, Sunday game) reports a knee 7 on Friday. The fold
recompiles the remainder with Mon-Thu pinned as delivered history; the pinned
Tuesday squat + optional flush was handed to the scheduler as
`appProgrammed: true` (the visible classifier credits any conditioning unit),
so `deliveredAppDays` = Tue + Thu, demand = 2 + club + game = **4**, the
overlay contract's `plannerSelectedTarget` = 4 above its own
`permittedMaximum` 3, while the week the athlete saw held 3. The injury door
accepted (facts are never vetoed); every later exercise edit on the week hit
`planner_selected_target_miss:conditioning` at the write boundary and was
refused as "nothing on your plan changed" — the R-359-addendum class again,
through a different count. The scheduler counts its OWN authored days without
the recovery flush, and the §18 ledger counts every optional role outside the
core; the delivered-day producer now reads the same typed
`section18Evidence.conditioningRole` and excludes the optional roles. Measured:
the overlay contract's target 4 → 3, the write boundary accepts, all six
archetype/day edits accept (they were 4/6).

**Receipts (family 2).**
- `test:session-injury-review` green, [5] 6/6 (was 4/6). `test:injury-session-adjustment` **54 / 0** (was 51/54).
- `test:injury-compiler-preview` chain: the first file **193 / 0** (was 12 running-budget reds + a throw at the persistence witness; once past the throw it reached the archetype loop, where the two dose-edit refusals above were red and, after them, the "improving-injury" cell — re-pinned to fire only when the 7/10 pass withdrew rows on that day, since the athlete's own accepted set edit now also makes the day differ from healthy); derived-exercise durability 26/0, travel 12/0, strength templates 59/0, team-night 10/0 + 32/0, derived repair ownership 13/0. Chain exit 0.
- `test:compile` PASSED (0/0/0) after every step.
- Blast radius on the fixed tree: tap-swap-hierarchy 25/1 (**the one red, "hamstring issue avoids sprint, heavy hinge and Nordic suggestions", is identical on the pre-fix control tree** — inherited, diagnostic), temporary-source-facts 90/0, section18-v2 142/0, hard-day-warns 22/0, week-checker-allowances 38/0, fatigue-sequence 18/0, weekly-scheduler 141/141 + fresh speed 14/14 + 2/2 with generated-scheduler-fixtures 9/11 (**the same two bye-week released-day cells red on the control tree**; hingecod recorded them as HEAD's), injury-recomposition 186/0, readiness-load-retention 58/0, fixture-mutation-transaction 21/0.
- Writer census: `compileCanonicalProgramWeeks` re-reviewed (canonical_compiler, reason extended); **1166/1166, 0 unresolved, gate exit 0.**

**Side finding, recorded only (no work done, per Sam's brief):** `Adductor Rockback` has no `EXERCISE_TAGS` entry (the matrix answers `unknown`), and `Tib Raises` is rated `caution` for a knee while `T-Bar Tib Raises` is `good`. Data, not this family.

North star: TOWARD — both app fixes remove a second counter (the swap door judging an unchanged identity; the delivered-day evidence counting a flush the scheduler and the ledger never count). No new stored state.

### The complete canonical compiler command, on the final code (`ef01e15d`)
`npm run test:canonical-weekly-compiler`, uninterrupted, **exit 0, zero FAIL
lines**: slice 10605/0 · reset-coach 19/0 · athlete-session-deletion 139/0 ·
program-hydration-ownership 83/0 · fixture-mutation-transaction 21/0 ·
temporary-source-facts 90/0 · session-injury-review green ([5] 6/6) ·
injury-session-adjustment 54/54 · injury-compiler-preview 193/0 + 26/0 +
12/0 + 59/0 + 10/0 + 32/0 + 13/0 · conditioning-balance-repair 42/0.

### Release gate, first run on the final compiler code
`npm run test:release`: **18/30 units green**, stopped at unit 19
`test:injury-fallback-journey`. Green before it: test-truth, compile,
exercise-intake, readiness-load-retention, session-change-durability,
undo-reversal, injury-recomposition, deload-law, block-two-progression,
strength-progression-inputs, training-logging, **compiler-year**,
**weekly-writer-zero**, approved-icons, **canonical-weekly-compiler**,
coach-weekly-reduction, deriving-device-commit, fact-horizon.

### Family 3 — the fallback journey's two coverage cells (stale instrument)
REGISTRY-GREP: R-357, R-353, the 2026-08-13 weekly-set ruling ("the week is
the unit of coverage"), R-124.
The suite walks ONE three-day world (Mon/Wed/Fri, 5+ years, commercial gym)
and records the finer pattern identity of every row an injury makes unsafe
on its most-affected day; two coverage cells then require single-leg knee
and trunk among them. Measured: the generated week is Leg Press, RDLs,
Lateral Lunge, Nordic Lower, Calf Raises / six upper rows / Single-Leg RDL,
Single-Arm DB Floor Press, Pull-Ups, Landmine Press — the ladder reads
Lateral Lunge as `squat`, and no strength day carries a trunk row (Crab Hold
sits in Mobility). Those two coordinates are unreachable in this world as
composed since the four-compound sessions (a93f3ad2) and the frontal
completion (R-357). The suite's own precedent for single-leg hip is an
accepted Add on the lower day; the same door now carries Reverse Lunges
(knee 6) and Band Pallof Press (lower back 6). Ladder still walked over rows
a real athlete placed. **Suite green, exit 0; all nine coverage cells ok.**
`test:compile` PASSED.

**Composition question, recorded only (Sam's brief: no side findings):** by
the weekly-set ruling the week owes "single-leg knee … and some core"; this
three-day week's only single-leg knee work is the frontal Lateral Lunge and
it has no core row on a strength day. The sibling `test:slot-coverage` reds
hingecod classified as pinned to a superseded composition are the same
question.

### Families 4 and 5 — the last two gate units the candidate recorded red
Pre-run individually while the second gate run was in its year loop.

**Family 4 — `test:slot-coverage` 87/90 → 90/90 (both stale).**
REGISTRY-GREP: R-334, R-230, R-342, R-309.
- The two "[SAM] split PUSH/PULL is horizontal + vertical + core before
  weekly robustness allocation" cells pinned `filled.length === 3` from
  before **R-334 (2026-09-02)**, which gave split-upper support rows a
  direction so a push-affinity support row fills a push accessory seat
  (filled = horizontal, vertical, push_accessory_2, core). The cells' claim
  is the ORDER; re-pinned to "horizontal, vertical and core filled, the
  robustness seat not, nothing missing, six slots".
- The census ratchet ("no generated day is missing MORE of Sam's ladder",
  2 deficient against a ceiling of 1) failed only on the "off-season
  bodyweight" world — `equipmentAnswer.tags: {}` — whose pull day composed to
  a bare conditioning session (nothing to pull on) and whose push day doubled
  a core row. **R-230**: the equipment step cannot complete with no strength
  kit; that world is unreachable. Re-pinned to the catalogue's home kit, the
  same re-pin R-230 gave the compiler-year archetype. Census 1 deficient of
  12, inside the ceiling; the ceiling itself untouched.

**Family 5 — `test:session-section-add` 272/274 → 250/0 (stale).**
REGISTRY-GREP: R-288, R-273, R-297, R-129, R-236.
The coordinate `['primer', 'optional', 'upper_push']` (R-273, 2026-08-29)
expected a freshly composed Primer to offer an Optional Work section before
an Add. **R-288 (2026-08-31, aa81147b)** removed the Primer's three optional
rows: seven low-fatigue rows, no optional cluster, "athletes who want more
work add a separate Strength session". Measured on control trees: green at
`c3f16708`, red from `289a35b8` on — the R-288 commit sits between. The
coordinate is retired with the ruling named; R-288's own guard holds the
absence. Chain: Section Add 250/0, session-change-hub 59 green, exit 0.
`test:compile` PASSED after both.
