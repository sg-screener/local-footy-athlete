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

### Release gate, second run (on the tree after families 3-5)
**21/30 units green**, stopped at unit 22 `test:session-execution` — a unit
the candidate's earlier runs never reached.

### Family 6 — `test:session-execution` [10] "a subtle lime separator" (stale)
REGISTRY-GREP: R-361 and its addendum.
The cell pinned `borderRightColor: 'rgba(200, 255, 0, 0.35)'` on the exercise
number gutter. **R-361 (2026-09-03)** made the accent yellow (#D8D800) and
`e4452275` changed the gutter's translucent separator to (216, 216, 0);
the candidate's own accent commit `f385dc75` then refused the whole lime
family. Re-pinned to the yellow rgba with the ruling named. 212/0;
`test:compile` PASSED.

### Release gate, final run on `119eb983`
`npm run test:release`, from the top, uninterrupted: **RELEASE GATE RESULT:
30/30 units green, RELEASE_GATE_EXIT=0.** (test-truth, compile, and the 28
current-contract witnesses including compiler-year, weekly-writer-zero and
the complete canonical-weekly-compiler chain.) The two earlier runs on
intermediate trees stopped at 18/30 and 21/30; every unit they passed is
unchanged by the later test re-pins.

### The six simulator flows, on the integrated code (`119eb983`)
Metro for THIS worktree on `:8082` (`QA_METRO_PORT=8082 npm run lfa:dev`;
the finished seat's `:8081` Metro was left untouched), the installed
iPhone 17 Pro build (native unchanged by every commit here — TS, tests,
scripts and docs only), each flow through `run-maestro-ios.sh` with
`--device` and `E2E_METRO_URL=http://127.0.0.1:8082`, 8-minute watchdog.
Proof the flows ran this tree: the app's launch receipt in its container
plist reads `resolvedMetroUrl: http://127.0.0.1:8082`, and the app's own
WARN lines landed in that Metro's log.

| flow | result |
| --- | --- |
| bin-undo-toast | **PASS** (40s) |
| block-rollover | **PASS** (30s) |
| full-reset-lands-clean | **PASS** (35s) |
| readiness-ack-never-silent | **PASS** (20s) |
| removal-undo-home | **PASS** (35s) |
| week-move-game | **PASS** (55s) — drag on the board, save, checkpoint relaunch, Sunday fixture after it, Undo, game back on Saturday |

**6 / 6 PASS.** Every step in every flow log reads `COMPLETED`; no watchdog fired.

### Where the candidate stands
Branch `candidate/2026-09-03-integrated`, tip `119eb983` (+ this docs commit),
six commits on top of `ed8298af`: the merge of `6031df4a`+`05f1cc44`, two
app fixes (fixture repair craft ranking; injury dose-edit door + delivered-
flush counting), and test re-pins in the injury, fallback, slot-coverage,
section-add and session-execution suites, each naming its ruling.
`test:compile` 0/0/0 · `test:canonical-weekly-compiler` exit 0 · `test:release`
**30/30** · six flows **6/6** · writer census 1166/1166. Nothing outside the
reds' own families was touched; the composition question (a three-day week's
single-leg knee / core rows) and the two tag inconsistencies are recorded
above, not worked. Ready for a phone build in my reading; the preview build
and install are the next seat's step, as they were for the last candidate.

## 2026-09-03 (later) — Sam: "investigate the held double-squat issue, the three-day program missing core/single-leg-knee work, and the two inconsistent injury tags; root causes and recommended fixes only; change nothing"
Read-only. Probes lived in the scratchpad and imported the tree by absolute
path; no file under src/, scripts/ or docs/RULINGS_REGISTRY.md was touched.
REGISTRY-GREP: R-087, R-089, R-095, R-317, R-318, R-334, R-342, R-347, R-348,
R-351, R-352, R-353, R-357, Section 17.C.

### 1. The double squat (cohort F004: Back Squat on both lower days in moved-game weeks 29/41/47)
**What the evidence says.** In `output/athlete-cohort-895dde2a/*/run/male-year.json`
every offending Friday carries `planEntryId: fixture-replan:<week>:friday:strength`
inside a `week-overlay:…:one_off_game:<Sunday>` — the fixture repair's
added-strength path, never the scheduler. The compiler's own target for that
Sunday-game week planned THREE strength days (`sched:…:1:lower`, `:2:upper_pull`,
`:4:upper_push`, Friday `rest_or_recovery`).

**Root cause — `fixtureMinimalReplan.addStrengthDeltaVariants`.** When the
game moves Saturday→Sunday the G-1 Gunshow Friday is released and the
contract's main-strength target (4 gym days) exceeds the accepted week's three,
so the repair adds one strength day. Its template list is `displaced` (none)
then `generated` = the target microcycle's main-strength workouts in list
order, and the added day takes `templates[index]` — i.e. the target's FIRST
strength day — with no regard to (a) which main patterns the accepted week
already covers (R-087/R-089: uncovered slots first; squat paired with hinge),
(b) R-317/R-318 weekly identity budget (the same lift on two days), or (c)
Section 17.C (Friday before a Sunday game is G-2). Reproduced on the pre-fix
merge `35fe7f38` with the phone's own move door (4-day athlete, Mon/Tue/Thu/Fri,
club Tue/Thu): Monday `lower` (Leg Press, RDLs, …) kept, Friday
`fixture-replan:…:friday:strength` = `lower_squat` (Leg Press, Cossack, …) —
Leg Press twice, two squat purposes, one hinge, a full lower on G-2. The origin
the row is stamped with, `pattern_balance_repair`, names a balance no code
computes.

**Where the integrated candidate stands.** The same move on `119eb983` now
regenerates the week (Mon lower_squat · Tue upper_pull · Thu lower_hinge ·
Fri upper_push): the family-1 fix ranks the minimal candidate's strong craft
finding (`g2_hard_lower` on that Friday) and lets the compiler's week win. A
bye (game removed) and a Saturday→Wednesday move also regenerate cleanly. So
the three cohort instances are almost certainly gone — they were all
Saturday→Sunday moves whose added Friday is G-2 — **but the template choice is
unchanged and will recur wherever the added day is not G-1/G-2/G+1 and the
regeneration is not cheaper** (a released mid-week day, a longer horizon).
Verify with the cohort rerun (`scripts/athlete-cohort-year.cjs` at `119eb983`).

**Recommended fix (one owner, no new counter).** The added day should be
AUTHORED for the week, not copied: hand the composer the accepted strength days
as history (the row compiler already does exactly this for a remainder compile
via `acceptedAutomaticHistory` and `pinHistoryDays`) and ask it for the one
missing purpose, chosen by the week's uncovered main patterns (R-087 order:
the seat the week lacks — here `lower_hinge`, since Monday's `lower` already
spent squat and hinge, the next uncovered pair is single-leg) under the R-317
identity budget. Minimum viable version inside the replan: rank `generated`
templates by "patterns not yet covered by the accepted strength days" and drop
any whose main identity already appears in the week, before `templates[index]`
is read. Guard: a `test:fixture-mutation-transaction` cell on the 4-day
Saturday→Sunday world asserting one squat purpose + one hinge purpose and no
repeated main identity, plus a `test:ladder-wide`-style weekly pairing count
over the replan's output.

### 2. The three-day program: no core row, no sagittal single-leg-knee row
**Measured world** (`injuryFallbackJourneyTests`' athlete: Mon/Wed/Fri, 5+
years, commercial gym, Off-season): Mon `lower` = Leg Press · RDLs · Lateral
Lunge · Nordic Lower · Calf Raises; Wed `upper` = six push/pull rows; Fri
`full_body` = Single-Leg RDL · Single-Arm DB Floor Press · Pull-Ups · Landmine
Press. Sam's R-087 weekly set ends "…upper accessory · lower accessory · core".

**Root cause A — core: no ladder a three-day week uses has a core seat.**
`sessionSlotCoverage.ts`: `LOWER_SLOTS` = squat · hinge · single_leg_knee ·
single_leg_hip · football_robustness; `UPPER_FULL_SLOTS` = the four planes ·
push_accessory_1 · pull_accessory_1 · football_robustness; `FULL_BODY_A/B` =
four mains · football_robustness. `core` exists only on the SPLIT upper
ladders (`UPPER_SPLIT_PUSH/PULL_SLOTS`). A trunk row can still reach a lower day
by accident through the robustness seat, but `FOOTBALL_ROBUSTNESS_CATEGORIES`
is hamstring → adductor/groin → calf → knee-capacity (no trunk category), and
R-352 gives the last robustness seat to "the first uncovered football
category", which is why the lower day ends in Nordic Lower + Calf Raises. The
five-day athletes get Band Pallof Press on a hinge day only because the split
ladders and their seats differ. So the three-day athlete never sees core work
on a strength day — by ladder construction, not by selection.

**Root cause B — single-leg knee: seated, but as a frontal lift the instruments
read as "squat".** The composer DID fill the lower day's `single_leg_knee` seat —
with Lateral Lunge (`section18Evidence.slot: single_leg_knee`), because R-347
favours the frontal pair while the week lacks a frontal-plane lift and R-357
requires every week to answer for the frontal plane; the sagittal
Reverse/Walking Lunge or Bulgarian only wins that seat once the frontal plane is
already covered elsewhere. Two vocabularies then disagree: `slotsForExerciseName`
(composer/oracle) maps a unilateral `lunge` to `single_leg_knee`, while
`injuryFallbackLadder.finerPatternIdentityOf` maps `movement: 'lunge'` through
`PATTERN_TO_SLOT` (`lunge: 'squat'`) and never reads `unilateral`, so every
lunge reports `squat`. The coverage instruments (fallback journey, injury
ladder) therefore see no single-leg knee in a week that has one. R-087's
"single-leg knee" is Sam's word for the seat; whether a lateral lunge satisfies
it is a coaching call he has not been asked.

**Recommended fixes.**
- Core: put the core seat into the ladders the three-day week uses — either a
  `core` slot on `LOWER_SLOTS`, `UPPER_FULL_SLOTS` and the full-body ladders
  (R-087 says the WEEK owes "some core"), or, cleaner, a week-level core
  seat the composer spends once wherever a robustness seat is free, exactly
  as R-357's frontal completion works for the plane. Ask Sam only whether
  "some core" means one row per week or one per lower day; the ladder change
  is mechanical either way. Guard: `test:slot-coverage` census on the three-day
  world.
- Single-leg knee: make `finerPatternIdentityOf` read `unilateral` (a
  unilateral squat/lunge is `single_leg_knee`, as `slotsForExerciseName`
  already says) so the ladder and the oracle share one vocabulary — this is a
  measurement fix, no composition change. Separately, if Sam wants a sagittal
  single-leg knee row every week alongside the frontal one, R-347's
  "frontal favoured only while the week lacks a frontal lift" is the knob;
  today the three-day week has one single-leg-knee seat and R-357 spends it
  on the frontal plane.

### 3. The two injury tags
**Adductor Rockback (no `EXERCISE_TAGS` entry, withdrawn on a groin 6).**
Two authorities, by design and by accident. The tags file deliberately omits
stretches ("34 of 90 pooled exercises have no entry … the rest are stretches";
a missing tag reads `unknown`, and callers treat unknown as allowed). The
typed exposure engine classifies BY NAME: `classifyExerciseExposures` matches
`/(copenhagen|adductor|groin|pancake)/` → `adductor_groin` before its
mobility rule (`/(mobility|stretch|foam roll|…)/` → `mobility`), and the
groin policy blocks `adductor_groin` from 6/10. "Adductor Rockback" contains
"adductor" and not "stretch", so a `recovery_support` rock-back on a Mobility
day is withdrawn like a loaded Copenhagen, while Butterfly Stretch and Hip
90/90 Stretch (same intent) read `mobility` and stay. Root cause: the exposure
classifier has no role/intensity input — a mobility row and a loaded row
with the same muscle word get the same exposure. Recommended: classify by the
row's typed role first (`section18Evidence.role === 'recovery_support'` or the
pool's mobility membership → `mobility`, never a loading exposure), and give
Adductor Rockback a tags entry so the matrix and the engine agree. A ruling is
needed only on whether a groin at 6/10 should keep gentle adductor mobility;
the classification defect stands either way.

**Tib Raises `knee: caution` vs T-Bar Tib Raises `knee: good`.** Both are
authored, at different times, by different instruments. Tib Raises' row was
rewritten on 2026-07-28 by `scripts/apply-injury-matrix-to-tags.js` from Sam's
ruled matrix (`docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx`): before the
migration it was `inj({ calf: 'caution', ankle: 'caution' })` with every other
region defaulting to good; the ruled matrix's blanket rules set groin, hip,
quad, hamstring, knee and lower back to caution for it. T-Bar Tib Raises was
authored on 2026-09-02 through the exercise-intake template
(`docs/EXERCISE_INTAKE_T_BAR_TIB_RAISES_2026-09-02.md`: knee Good, calf and
ankle Caution) and never passed through the matrix pipeline — the workbook
was last changed 2026-08-27 and `npm run verify:injury-matrix-sheet` reports
6 failures today, including "every exercise in CODE appears in the sheet"
naming T-Bar Tib Raises among the post-08-27 intakes. Root cause: two
authoring pipelines for one field, and the guard that holds code equal to the
workbook is not in any chain. Recommended: (1) re-run the matrix pipeline
over the new intakes so one ruling model rates both tib raises (they will land
identical, whichever way Sam's rules resolve them), (2) put
`verify:injury-matrix-sheet` (or its Phase-2 equality test) into the release
chain so an intake cannot diverge silently, (3) until then, align Tib Raises
to T-Bar Tib Raises only by Sam's word — the caution row is his ruled matrix,
not a typo.

## 2026-09-03 (later) — Sam: "Build all three fixes … one core row per week, not per lower day … count Lateral Lunge as single-leg knee without changing the sideways-first rule … replace fixture-day copying with selection of the week's missing movement purpose"

REGISTRY-GREP: R-087, R-089, R-317, R-318, R-347, R-357, Section 17.C, R-354.
Four slices, each red-first, no unrelated change.

### Slice 1 — the fixture repair adds the week's missing purpose (`fixtureStrengthPurposeSelection.ts`, `fixtureMinimalReplan.ts`)
- `rankStrengthTemplatesForWeek(accepted, targetDays)` — pure: the compiler
  target's strength days ranked by the accepted week's uncovered patterns
  (R-087), then Sam's pairs matched after the add (R-089: squat↔hinge,
  single-leg knee↔hip, push↔pull), then fewest repeats, then target order.
- `reselectRepeatedStrengthIdentities` — a copied day's main/accessory lifts
  the kept days already spend are re-selected through the weekly selector
  and the tap-swap safety gate from the seat's own pool, requested as typed
  SUPPORT (R-317: a spent main seat is never re-spent; a replaced main row
  becomes `strength_accessory`), load from `loadForReplacementExercise`.
- `addStrengthDeltaVariants` ranks `generated` and re-selects on placement;
  displaced accepted sessions keep their identity as before.
- Cells: `test:fixture-mutation-transaction` 19a (ranking: a week holding
  squat/push/pull owes a hinge; the cohort shape prefers the balanced repeat),
  19c (re-selection: Leg Press repeated on Friday becomes a squat-pool
  support row, the dose and seat kept, a day with no repeat untouched), 19b
  (the four-day Saturday→Sunday move through the door: squat purposes equal
  hinge purposes, no main lift twice, no full lower on the G-2 Friday).
  Suite **24 / 0**.

### Slice 2 — one core row per week (`canonicalWeeklyPlaneCompletion.ts#completeWeeklyCore`)
Mirrors R-357's frontal completion: a week whose strength days carry no
core-slot row (the ladder's own `slotsFilledByRow` vocabulary) gets one
selector-approved trunk-pool row on the first strength day under WC-048's
seven-movement ceiling (lower day first, then by date), else the honest
`weekly_core_unavailable` exception beside the frontal one. Runs in the row
compiler after the frontal completion, in the injury compiler (a withdrawn
core row is re-answered on a day not yet done, R-354) and on the fixture
repair's planner source. `buildAutomaticStrengthSupportRow` accepts the
`core` seat. Measured on the three-day world: Friday full-body gains
`Plank`. Cell: `test:slot-coverage` "[SAM] every generated week carries one
core row — the three-day week too" (red-first: the three-day world was the
one week without one) — **92 / 0**.

### Slice 3 — Lateral Lunge counts as single-leg knee (`injuryFallbackLadder.ts#finerPatternIdentityOf`)
A pool group still wins; otherwise a unilateral squat/lunge names
`single_leg_knee` and a unilateral hinge `single_leg_hip` — the answer
`slotsForExerciseName` already gives the composer. `PATTERN_TO_SLOT`'s
`lunge → squat` fold stays for the POOL lookup. R-347's sideways-first rule
is untouched. `test:injury-fallback-journey` now walks single-leg knee (the
frontal Lateral Lunge) and trunk (the week's core row) from the generated
world; the knee/lower-back Add devices I added earlier today are retired,
the hamstring one stays. Suite green, all nine coverage cells ok.

### Slice 4 — the two tags
- `exposureEngine.classifyExerciseExposures` asks the typed recovery pools
  (mobility, tissue quality, breathing) before any keyword: a member is
  `mobility`, full stop. `Adductor Rockback` no longer reads `adductor_groin`;
  `Groin Squeeze` and `Long-Lever Copenhagen` still do (controls).
  `test:exposure-engine` 164 / 0.
- `T-Bar Tib Raises` carries `Tib Raises`' ruled injury row (same movement
  pattern and primary muscle, no named exception → the same rule outcome);
  `test:t-bar-tib-raises` holds the two rows equal, 10 / 0; the intake doc
  carries a dated addendum. Not done, by design: a hand-authored tags entry
  for Adductor Rockback (13 regions are Sam's to rate; both authorities now
  agree it is allowed) and chaining `verify:injury-matrix-sheet` (the
  workbook predates every post-08-27 intake and fails today on that gap).

### Receipts
`test:compile` PASSED (0/0/0). Writer census: eleven owners re-reviewed
(new: `completeWeeklyCore`, `stripExceptionKind`,
`rankStrengthTemplatesForWeek`, `reselectRepeatedStrengthIdentities`);
**1170/1170, 0 unresolved, gate exit 0.** Blast radius, all green:
injury-recomposition 186, session-injury-review, injury-session-adjustment
54/54, injury-compiler-preview chain, temporary-source-facts 90,
g1-move-durability 35, accumulated-away 20, move-game-relaunch 10,
chained-mutation-continuity 927, session-change-durability 59,
plane-and-load-memory 20, full-body-balance, exercise-intake 64 (chain),
automatic-weekly-selection 24, week-checker-allowances 38, hard-day-warns
22, section18-v2 142, undo-reversal 28, deload-law 78; weekly-scheduler
141/141 with the same two inherited bye-fixture cells red. The complete
compiler chain, the release gate and the six flows follow below.

### The chain, the gate, the flows (2026-09-03, after `bab23e12`)
- **One red on the first chain run**, in the slice suite: "moving the fixture
  back restores the visible week exactly". Same rows, different ORDER on the
  full-body day: at generation the core row was appended AFTER the attached
  flush finisher; after a game move and move-back the repair path re-sorted
  the session and the core row sat before the finisher. Root cause was the
  append-at-end in `completeWeeklyCore`. Fix: the row goes in before the
  first conditioning row and `exerciseOrder` is renumbered, which is the
  Bible's session order (midline after accessories, before the finisher), so
  both paths agree. Slice cell green; slot-coverage 92/92 and fallback
  journey 182/0 unchanged. Census re-reviewed the owner: 1170/1170, exit 0.
  Observation, not changed (outside the ask): the frontal completion appends
  at the end the same way and would show the same order drift on a week
  where R-357 has to place a row after a finisher is attached.
- **Complete compiler chain** `test:canonical-weekly-compiler`: exit 0, every
  chained suite green (slice suite 0 failures, injury-session-adjustment
  54/54, 80/0 on the last chained suite).
- **Year witness** `test:compiler-year`: every cohort 52/52 weeks, 0 distinct
  failure keys, gate exit 0.
- **Release gate** `test:release`: **30/30 units green**, exit 0.
- **Six audit flows** on simulator B8B2C7B0 against THIS tree's Metro on
  :8082 (the other seat's :8081 untouched; the app's launch receipt says
  `resolvedMetroUrl` = 127.0.0.1:8082): bin-undo-toast, block-rollover,
  full-reset-lands-clean, readiness-ack-never-silent, removal-undo-home,
  week-move-game — **6 passed, 0 failed**. Metro :8082 stopped afterwards.

## Sam, 2026-09-03 — the injury workbook through the pipeline, release unit 31 (R-363)

**Asked:** apply the 13 Adductor Rockback ratings; app is right on the squat
elbow/wrist conflicts; rebuild the workbook through the existing pipeline;
resolve its six failures; add the check as release unit 31; run ALL 30 (33)
unrated drills through the pipeline and identify only the cases needing Sam;
completeness + parity in unit 31; no invented ratings; stop on any new
product decision.

### What the pipeline could not see (root causes)
- The pipeline last ran on 2026-08-03. Three later rulings (rack shoulder
  08-26, quad-dominant hamstring 08-27, R-267 support loading 08-28 — 65
  cells) were hand-edited into the sheet and code, never transcribed into the
  ruling file. The verify step printed only the first FIVE of those drifts
  (`drift.slice(0, 5)`), which is why my earlier report to Sam said "four
  squat cells": it was 65. Every one traces by blame to those four dated
  commits; all transcribed as named exceptions with their citations.
- The extract step read only the pre-migration snapshot, so 19 intake
  exercises since 07-28 never entered the workbook; Single-Arm Pulldown was
  retired from code but still in the sheet.
- "14 code entries do not author all 13 regions" was a PARSER defect: the
  verify read quoted keys only; those 14 entries used bare keys. Data was
  complete (T-Bar pin proved it). Parser now reads both; apply normalised them.
- The apply step prepended the Scap Pull Ups precedent note on every run (4
  copies by today). Now written once, duplicates folded.
- The ruling file has carried shin → calf routing since 08-03; the sheet never
  showed it (11 → 12 routes).

### Built
- `scripts/extract-injury-matrix.js`: three record kinds — evidence
  (snapshot, retired flagged), intake (live entries after the snapshot, 13
  authored cells carried, never tallied), untagged (pool members with no tags
  row, authored muscles + pool contraindications). Muscle regex accepts
  escaped apostrophes.
- `scripts/derive-injury-matrix-rules.js`: rules tallied from EVIDENCE only
  (118 rules unchanged, grid diff 0); everything the app can place is
  evaluated; intake cells lifted as exceptions; untagged rows get the muscle
  axis + declaration, and a cell the pool says is loaded but the rules leave
  good becomes DECISION (never good); an easy-cardio walk (conditioning
  format, no ruled family) is DECISION on every cell.
- `scripts/build-injury-matrix-sheet.py`: DECISION cells, pending pattern
  column, dated exception narrative, "what entered after the snapshot" block.
- `scripts/apply-injury-matrix-to-tags.js`: REFUSES (exit 2) any run that
  would change an authored code cell — a ruling enters through the ruling file
  first. This run: 0 changed cells, 167 rows normalised (semantic diff 0/2171).
  Inline comments INSIDE injury blocks were dropped by the rewrite (their
  provenance now lives in the ruling file's dated narrative).
- `docs/INJURY_MATRIX_RULINGS_2026-07-28.json`: 73 named exceptions added
  with dated narratives (08-26 ×3, 08-27 ×6, R-267 ×56, Rockback ×6; the five
  squat cells Sam ruled today are inside the R-267 block).
- `scripts/verify-injury-matrix-sheet.ts` → `test:injury-matrix-sheet`
  (release unit 31; `verify:` is an alias): parity both directions (reads
  quoted and bare keys), COMPLETENESS by the REAL pool imports, no DECISION
  cell, and it prints THE DECISION LIST. Pins re-recorded from the pipeline
  run: 194 exceptions, 200 rows, 2171 compared cells, 1060/42/1069, 12 routes.
- `scripts/test-truth-decisions.json`: `test:injury-matrix-sheet` as a
  current contract (R-363, ruling file). `package.json`: the script.
- Registry: R-363.

### Receipts
Pipeline: 200 exercises, 118 rules (38 bind), 194 exceptions (97 intake
lifts), 44 DECISION cells, retired evidence Single-Arm Pulldown. Sheet
regenerated. Apply: exit 0, 0 changed cells. Semantic before/after of
exerciseTags: 167 entries, 0 cell diffs, precedent note ×1. Unit 31:
**2 failures, both completeness** — 33 pool members without a tags row and
44 DECISION cells (5 contraindication cells + 3 walks × 13). Everything else
in the verifier green, including the former six. `test:exercise-intake`
green (97/97, 56/56, 48/48), `test:t-bar-tib-raises` 10/10, exposure engine
164/0, `test:compile` PASSED, census 1170/1170 exit 0.
- The bootstrap (`testTruthAuditTests`) pins the decisions count (196) and the
  current-contract count (33) with the named list; unit 31 moves them to 197
  / 34 with a dated comment, the same way the three 2026-09-03 promotions
  before it did. First gate run went red at unit 1 on exactly those pins.
- **Compiler chain** `test:canonical-weekly-compiler`: exit 0, 0 reds.
- **Release gate**, 31 units: **30 / 31 green**. Unit 31
  (`test:injury-matrix-sheet`) red on exactly the two COMPLETENESS checks —
  33 pool members without a tags row, 44 DECISION cells — i.e. the decision
  list for Sam. Parity, pins, structure, snapshot lifts all green.
- **Six audit flows** on simulator B8B2C7B0 against this tree's Metro on
  :8082 (launch receipt `resolvedMetroUrl` = 127.0.0.1:8082; the other seat's
  :8081 untouched): first attempt lost bin-undo-toast to the known Maestro
  driver hang (8-min watchdog fired, orphans killed); clean rerun
  **6 passed, 0 failed**. Metro :8082 stopped afterwards.

### For Sam — the decision list (nothing invented)
1. 33 drills have no tags row (26 mobility incl. Adductor Rockback, 6
   tissue-quality, 4 breathing, 3 easy-cardio walks). Each needs the intake
   classification (movement pattern, region, load, soreness, stability,
   eccentric, late-week) before the app can read a rating. Rockback's 13
   ratings are ruled and on the sheet; they reach the app with that row.
2. 5 cells where the pool says a region is loaded and the rules say good:
   Hip 90/90 knee, Deep Squat Hold ankle/foot, Butterfly Stretch ankle/foot,
   Jefferson Curl neck, Dumbbell Pullovers ribs.
3. The 3 walks: which conditioning family (Easy Bike's, or another)?
Optional, not blocking: R-267 is 56 named exceptions because no axis of the
model reads the prescribed load; a load axis would express it in one line.

## Sam, 2026-09-04 — R-364: the 33 recovery exercises through the complete intake

**Ruling:** for the 30 mobility / tissue-quality / breathing drills and the 3
zone-1 walks, the complete intake supersedes the 24 July `mobility_untagged`
exemption. "Mobility must not mean safe for every injury."

### Root-cause families, in order
1. **The exemption.** `mobility_untagged` (kind + 30-name set) retired from
   `selectableExerciseVocabulary.ts`; `zone1_recovery` now waives video only.
   Pins moved: reconciliation test's authorised-kinds list; authoring
   template; the 07-24 changeset carries a dated supersession note.
2. **The intake.** `docs/EXERCISE_INTAKE_RECOVERY_2026-09-04.md` — 33
   sections in the 2 September format, generated from ONE classification
   spec together with the 33 tags rows (`exerciseTags.ts`, new RECOVERY
   block), so neither is a hand copy. Classification: from each drill's
   actual movement, loading and existing contraindications. Rules applied:
   every pool contraindication → **Avoid** (kept on the pool entry too);
   loaded/stretched/weight-bearing regions → Caution (R-267 "indirect
   support/loading", the Rockback precedent for kneeling and hands-on-floor);
   otherwise Good. Patterns follow the six precedents (Horse Stance →
   isolation_lower, Sleeper → isolation_upper, Crab/Bench → core); walks are
   `conditioning` and join the ruling file as the `walk` family (lower body
   Caution). No tags prescription: the pool entry owns the dose, as before.
   No equipment sheet entry: the intake test reads each pool entry's own
   equipment. `programming` = strengthRole none, warmup true, primer true —
   the routes each drill already had (measured: load authority, load
   control, all four route answers and healthy-athlete swap identical for all
   33 before and after; only the injury answers changed).
3. **The pipeline.** Extract/verify/apply now read keys with an escaped
   apostrophe (`World\'s Greatest Stretch`, `Child\'s Pose…` had been
   reported untagged). Adductor Rockback's six named exceptions left the
   ruling file (its ratings are on its intake row; groin strengthened to
   Avoid under this ruling). Pipeline rerun: 200 exercises, 0 untagged, 0
   DECISION cells, 343 exceptions, 24 conditioning rows; apply exit 0 with 0
   changed cells (normalisation only). Unit 31 pins re-recorded.
4. **The guards.** `test:exercise-intake`: 33-row block — selectable, tags
   row (strengthRole none, no prescription), 13 ratings equal to the doc,
   muscles, pool equipment with no equipment-sheet entry, cue, exact video
   (walks stay video-exempt), movement line, dose equal to the pool's own,
   healthy swap still allowed; for EVERY contraindication: Avoid, and refused
   as a swap, withheld from an existing session and never selected at 1, 5
   and 10/10; ATG Split Squat unavailable at every knee severity; no kind
   waives tags; every pool member rated. Mutations `recovery_rating`
   (Pigeon Stretch hip → good) and `atg_knee` (rating + pool
   contraindication dropped) are in the intake test's own mutation loop.
   `sessionInjuryReviewTests`: [11] compares rated names case-insensitively
   (`QL Back Extension` was misread as unrated by title-casing); [5] searches
   the mild world after the severe one, because rated recovery rows now touch
   nearly every day at 6/10.

### Unrelated, reported not fixed (pre-existing at 5442efdd, control tree)
- `test:content-reconciliation`: "every selectable entry has defined load
  handling" — Band-Assisted Pull-Up is `unauthored`.
- `test:locked-list`: "every unruled addition lands in a no-load class" —
  Banded TKE, Bosch Hold, Crab Walks (and the same for Elephant Walks, QL
  Back Extension, whose load authority is unchanged by this work: unloaded
  via PREHAB_NO_LOAD_EXERCISES, not `bodyweight`).
- `git worktree list` shows ~160 worktrees on this machine.

### Receipts (R-364), exact commands
| command | exit | result |
| --- | --- | --- |
| `npm run test:injury-matrix-sheet` | 0 | MATRIX VERIFIED — 0 failures (parity 2600/2600 cells, 0 untagged, 0 DECISION) |
| `npm run test:exercise-intake` | 0 | 2146 passed / 0 failed (incl. mutations `recovery_rating`, `atg_knee`) |
| `LFA_INTAKE_MUTATION=recovery_rating` child | 1 | 8 intended failures (Pigeon Stretch hip: doc rating, Avoid, swap/withhold at 1, 5, 10) |
| `LFA_INTAKE_MUTATION=atg_knee` child | 1 | 3 intended failures (Knee rating, pool contraindications ≠ doc, unavailable at every knee severity) |
| on-disk flip Pigeon Stretch hip avoid→good, `npm run test:injury-matrix-sheet` | 1 | 1 FAILURE: "Pigeon Stretch.hip: sheet avoid, code good"; restored → VERIFIED |
| `npm run test:session-injury-review` | 0 | Pass 80 / Fail 0 |
| `npm run test:injury-fallback-journey` | 0 | Pass 182 / Fail 0 |
| `npm run test:exposure-engine` | 0 | Pass 164 |
| `npm run test:compile` | 0 | PASSED |
| `node scripts/weekly-writer-census.js` | 0 | 1170/1170, 0 unresolved |
| `npm run test:canonical-weekly-compiler` | 0 | 0 FAIL lines |
| `npm run test:release` | 0 | **31/31 units green** |
| `npm run qa:audit-flows` (E2E_METRO_URL=:8082) | 1 | 0/6 — the script cannot pass `--device`, which the guarded runner requires ("Pass an explicit --device simulator UUID"). Pre-existing; not changed. |
| the same six flows through `scripts/dev-e2e/run-maestro-ios.sh <flow> --device B8B2C7B0…` on this tree's Metro :8082 | — | bin-undo-toast, full-reset-lands-clean, readiness-ack-never-silent, removal-undo-home, week-move-game PASS; block-rollover hit the 8-min watchdog (Maestro driver hang, kotlinx coroutine stack), rerun alone: exit 0, flow COMPLETED. Launch receipt `resolvedMetroUrl` = 127.0.0.1:8082. |
| `npm run test:content-reconciliation` / `test:locked-list` | 1 / 1 | 19/20 and 32/33 — the same single red each at 5442efdd in a control tree (unrelated, reported above) |
Not run: `test:bible` (diagnostic fleet, no release authority).

### Phone install, 2026-09-04 (Sam: "build to my phone", then "do it over wifi")
- Checkout `26e382c1`, clean worktree. `pod install` (LANG=en_US.UTF-8) exit 0
  in this worktree; fresh isolated `xcodebuild clean build`, Release/iphoneos,
  `-allowProvisioningUpdates`: BUILD SUCCEEDED. `codesign --verify --deep
  --strict` OK, team 66M7FZ6G37. Bundle com.localfootyathlete.app 1.0.0 (1);
  main.jsbundle 8,579,365 bytes sha256 68f8718f92fe6f48…; executable sha256
  c22a7b803335ecd4….
- Sam's iPhone (AFA21856…) dropped to `unavailable` at the first attempt; over
  Wi-Fi it reappeared, one control-channel timeout and two "unable to locate"
  errors, then `devicectl device install app` succeeded IN PLACE (no
  uninstall, reset, data clearing or launch): bundle container
  EBB8FEF8-0E14-4994-8E2C-036FC204FA0C. Receipt:
  `docs/PHONE_INSTALL_RECEIPT_26e382c1_2026-09-04.json`. Renee's phone:
  unavailable, not installed.
