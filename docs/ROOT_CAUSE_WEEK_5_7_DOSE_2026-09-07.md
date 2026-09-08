# Weeks 5–7: root-cause report

Owner: scopebridge. Investigation only; no implementation approved or made.

The one-set main lifts are caused by conflicting progression rules. A separate missing case lets a bodyweight exercise receive both its first added weight and an extra set. This is reproducible beyond the three-day athlete. Approval requested for the bounded correction below, not a change to the athlete's goal, exercise choices or normal phase prescription.

## Evidence and limits

Source: Sam's `threedayprogram.pdf`, 63 pages, identifying source commit `709bf14083a309636f291e635d29611ecb5cc624`. Weeks 5–7 begin on pages 6, 7 and 9. Profile: female, Get stronger, 2–5 years, three days, commercial gym, Off-season starting 28 September 2026, no club sessions. Text extraction confirms the reported set counts.

Current reproduction: `node scripts/athlete-cohort-year.cjs --preset=three-day --weeks=7 --output=/private/tmp/lfa-underdose-detailed`, with a read-only observer loaded from `/private/tmp/lfa-underdose-trace.cjs`. It runs onboarding, logging, rollover, visible projection and restart through the existing journey driver. The observer captures inputs and returned decisions without changing them.

Evidence files:

- `/private/tmp/lfa-three-day-pdf.txt`: extracted source PDF text, page-separated.
- `/private/tmp/lfa-underdose-detailed/female-year.json`: current visible seven-week journey.
- `/private/tmp/lfa-underdose-detailed.json`: dated per-exercise progression inputs and before/after prescriptions.
- `/private/tmp/lfa-underdose-detailed.json.boundaries.json`: subsequent block load and set decisions.
- `/private/tmp/lfa-underdose-selector-controls.json`: exact selector input with individual signals removed.
- `/private/tmp/lfa-underdose-neutral/female-year.json`: diagnostic feedback control, described below.

The causal progression functions are unchanged between the PDF's commit and current HEAD `8d06bbde`. The working folder also contains earlier, approved, uncommitted work: the block-history change reads strength-component completion. That existing change is not part of this investigation. Current reproduction matches the reported set pattern, not every PDF weight or exercise. The full historical PDF build was not rerun.

## 1. Exact selector producing one set

The report driver logs completed sessions with `difficulty: 7`, `soreness: 'none'`, and `feeling: 'hard'` ([driver](../scripts/athlete-cohort-year.cjs), logging replacement around line 140). Seven is labelled **hard** by the approved effort scale; changing that label to make the report look better is not a fix.

The older progression path interprets this record differently from the block path:

1. [strengthProgressionIntegration.ts](../src/utils/strengthProgressionIntegration.ts), `FEEDBACK_TO_SESSION_FEELING` around line 76: `hard → Sore`, despite recorded soreness being `none`.
2. [progressionHelpers.ts](../src/utils/progressionHelpers.ts), `feelingToRPE` around line 54: `Sore → 8`. `applyStrengthProgression`, line 701, uses this inferred number rather than the recorded seven.
3. [feedbackPatterns.ts](../src/utils/feedbackPatterns.ts), `detectFlags` around line 107: three hard answers in the last four create `FATIGUE_STREAK`. Two hard answers with full completion also create `MIXED_SIGNALS`. `applyPatternBiases` around line 236 turns these into `recentFatiguePattern: true` (one Boolean vote, not two).
4. [progressionRules.ts](../src/utils/progressionRules.ts), `resolveProgression`, lines 123–146: two soft signals select a deload. This athlete gets **inferred RPE 8 + recent fatigue pattern**.
5. `buildDeload`, line 246, returns `setsDelta: 'drop_two'`, `loadDelta: 'big_down'`. The integration converts that into minus two sets and approximately 70% load; `applyDelta` floors sets at one around line 637.

The captured decision for Monday 26 October is exactly:

```text
state: deload
note: Soft deload: high RPE + recent fatigue pattern
setsDelta: drop_two
loadDelta: big_down
```

The actual inputs include medium capacity, full completion, flat trend, zero missed sessions, zero weeks off, no injury flag, no double-game week, no nearby game, and no recorded deload trigger. The numeric-feedback adaptation itself returns no special adjustment for seven with no soreness; the older feeling/pattern route introduces the reduction.

### Candidate states and rejection reasons

This selector is an ordered rule chain, not a scored list of alternative exercises.

| Candidate | Result for the captured Monday input |
|---|---|
| Return after a training break | Rejected: zero weeks off; requires at least two. |
| Hard-trigger deload | Rejected: no overreach trigger, double game or injury flag. |
| Soft-trigger deload | **Selected:** inferred RPE 8 and recent-fatigue flag reach the two-signal threshold. |
| Game-proximity hold | Not reached; also no game within two days. |
| Normal off-season build | Not reached because the soft deload returns first. Medium capacity otherwise selects build. |
| Maintain for low capacity | Does not fit: capacity is medium. |
| Hold for declining trend or multiple misses | Does not fit: flat trend and zero misses. |
| Overreach | Does not fit: requires high capacity, at least three build weeks and RPE at most seven. |

Directly rerunning this exact input with only `recentRPE: 7`, or only `recentFatiguePattern: false`, changes the result to **build, no set reduction**. These are diagnostic inputs, not source changes.

## 2. Why back extensions and pull-ups receive four sets

[canonicalWeeklyProgressionCompiler.ts](../src/rules/canonicalWeeklyProgressionCompiler.ts), `compileCanonicalProgramProgression` around line 317, runs the old progression pass first, then block-boundary loads, then block-boundary set additions. Normal weeks do not receive the bypass already used for compiler-controlled reduced-dose days.

The block-history reader accepts `hard` with no soreness as good recovery ([blockBoundaryProgression.ts](../src/rules/blockBoundaryProgression.ts), `GOOD_RECOVERY_FEELINGS`, line 449). The captured previous block contains **12 completed strength sessions out of 12 recorded strength sessions**, with `qualifies: true`, `byQuality.strength: 'good'`, and `reduces: false`. Thus the later pass increases weights even though the earlier pass just selected a deload.

| Exercise | Authored sets → old pass → final sets | Later weight decision |
|---|---|---|
| Back Squat | 3 → 1 → **1** | 47.5 → 50 kg, `history_progressed` |
| RDLs | 3 → 1 → **1** | 40 → 42.5 kg, `history_progressed` |
| SL 45° Back Extension | 3 → 1 → **4** | BW → BW + 2.5 kg, `bodyweight_progressed` |
| Pull-Ups | 3 → 1 → **4** | BW → BW + 2.5 kg, `bodyweight_progressed` |

The precise second defect is `decideBlockBoundarySetAdditions`, line 1597: its exclusion list only recognises **`history_progressed`** as a weight increase. It misses **`bodyweight_progressed`**, emitted at line 1103 for an earned first added weight.

### Candidates for Monday's extra set

| Existing row | Decision |
|---|---|
| Back Squat | Rejected: weight already increased (`history_progressed`). |
| RDLs | Rejected: weight already increased (`history_progressed`). |
| Cossack Squat | Eligible secondary candidate, but loses to an eligible primary candidate. |
| SL 45° Back Extension | **Selected:** the name-based progression classifier treats it as primary; its first added weight is missing from the exclusion list. |
| Calf/preparation/power/conditioning rows | Outside this set-addition budget or progression eligibility. |

The winner is the first eligible primary candidate, otherwise the first eligible row (around line 1626). The increase is based on **last block's recorded three sets plus one**, not the already-reduced one set (around line 1648). That explains the jump from one to four. Pull-ups reach the same missing bodyweight case. The upper-day bench, row and shoulder press receive `history_progressed` and are excluded from extra sets.

The back extension's visible accessory role and its name-based primary progression classification are also inconsistent. Excluding it merely because of its name or changing exercise selection would leave the shared feedback and bodyweight-increase bugs alive. Role consumers must be reconciled with the existing authored slot/budget contract during the correction, without inventing a new exercise hierarchy.

## 3. Why weeks 5–7, and how far this reaches

Week 5 starts the next accepted block. The compiler uses feedback available at that block's acceptance and materialises its weeks from that evidence. Reopening preserves that accepted decision. Weeks 5–7 therefore repeat the same bad dose; they do not need a fresh fatigue event every week. The Wednesday 28 October “Tired today” event occurs after Monday's one-set squat and RDL. It cannot be the initiating cause.

Four real-journey profiles were run through seven weeks. The table counts **distinct visible main-lift rows in each week**, keyed by athlete/date/exercise; each cell repeats in weeks 5, 6 and 7. It does not count internal observer calls or every secondary/accessory row.

| Profile | One-set main rows / all visible main rows per week |
|---|---:|
| Three-day, female, 2–5 years, commercial gym | 5 / 6 |
| Two-day, male, 2–5 years, commercial gym | 6 / 6 |
| Four-day, female, 2–5 years, minimal equipment | 5 / 6 |
| Three-day, male, beginner, commercial gym | 3 / 5 |

All four driver processes exited zero with no recorded journey-check failures. This measures a wider exposure, not every possible athlete. The exact per-rule observer was applied to the three-day case.

In a diagnostic control, only the three-day driver's qualitative answer for seven was changed in memory from `hard` to `good`; numeric effort remained seven, and the same dated events ran. One-set main rows fell from 5/6 to 0/6 in each target week. Squat/RDL/bench/row retained three sets and shoulder press retained its authored two. Back extension and pull-ups still received four sets plus added weight: the second defect survives independently. **Do not ship this fixture-only change:** it conceals a legal answer the app must handle. The app's feedback form can separately record feeling, soreness and numeric effort; this is shared production logic, not PDF formatting.

## 4. Smallest safe correction proposed for approval

Two options were compared:

1. **Local patches:** change the report's `hard` answer, clamp all lifts to at least two/three sets, or add the missing bodyweight case at one filter. Small edits, but they hide the feedback disagreement, can override genuine recovery reductions, and leave duplicated interpretations elsewhere. Not recommended.
2. **Bounded ownership cleanup in the existing progression system — recommended:** one interpretation of recorded feedback and one definition of an earned weight increase, consumed by the existing compiler and its checks. No new exercise selector or wholesale program rebuild is required.

Proposed scope:

- Preserve recorded numeric effort. Keep effort, actual soreness and declared readiness distinct. Seven/`hard` with no soreness must not silently become RPE eight/`Sore` and buy a recovery reduction. Use the existing approved effort and block-progression contracts to resolve this once; retain one explicit ingress interpretation for older records without numeric effort.
- Make session adaptation, recent-pattern analysis and block history consume that shared interpretation. Remove conflicting lookup tables and obsolete expectations. Real high-fatigue, injury, game and scheduled-deload cases retain their approved precedence and dose owners. The compiler must not allow a reduction verdict and earned progression to fight over the same accepted prescription.
- Define “this exercise earned more weight” once, covering both `history_progressed` and `bodyweight_progressed`. Use it in extra-set eligibility, explanations and validators. Audit `buildBlockBoundaryReductionExplanation` too: its `loadsHeld` calculation currently excludes only `history_progressed` at line 2200.
- Preserve the existing load-first, set-second ordering and session cap. Reconcile role/name/slot readers rather than adding a back-extension exception. Corrected exact set winners must be shown by the real journey before acceptance; the diagnostic control is not a promised final program.
- Preserve accepted-program and restart ownership. Do not silently rewrite a previously accepted athlete block to make an old PDF disappear. Any correction to an already accepted program needs an explicit, reviewable application step.

### Dependency sweep required during implementation

Production: `canonicalWeeklyProgressionCompiler.ts`, `strengthProgressionIntegration.ts`, `progressionHelpers.ts`, `feedbackAdapter.ts`, `feedbackPatterns.ts` (including its conditioning reader), `progressionRules.ts`, `blockBoundaryProgression.ts`, `blockExerciseSelection.ts`, `deloadWeekRules.ts`, `weeklyProgrammingContract.ts`, `projectionCopy.ts`, and `SessionFeedbackPanel.tsx`. Audit the shared feedback and exercise-role types and their callers before changing a shape.

Fixtures/checkers: both tracked year-driver variants, `athlete-cohort-year.cjs`, their output checkers and row summaries; `feedbackPatternTests.js`, `progressionTests.js`, `strengthProgressionIntegrationTests.js`, `progressionCapacityLaunderingTests.ts`, `strengthProgressionInputsTests.ts`, `blockTwoProgressionTests.ts`, `blockTwoLadderTests.ts`, `completeAthleteJourneyTests.ts`, `sessionFeedbackFormTests.ts`, `sessionExplanationTests.js`, canonical compiler/restart tests and the release decision registry. Search all callers again after edits; obsolete assertions are removed or replaced, not left in a second test path.

## 5. Checks required, and why current checks missed it

Focused existing runs during this diagnosis:

- `test:block-two-progression`: 47 assertions passed, zero failed.
- `test:block-two-ladder`: 59 assertions passed, zero failed.
- `test:progression-capacity-laundering`: 25 assertions passed, zero failed.

Those are **131 assertions across three suites**, not 131 athlete scenarios. They were green with this reproduction still broken.

The ladder's generated-history helper does not record `actualReps`, so it cannot earn a bodyweight first-load increase. Its broad “both rungs” comparison also requires both old and new loads to be numeric, which misses an unset/BW baseline. The bodyweight progression test checks the first added weight but does not join it to the no-extra-set assertion. The capacity suite supplies inferred fatigue inputs directly; its own output explicitly says the resolver-input wire is not covered. Existing integration expectations even retain the old drop-two reduction; the current release registry already marks that integration suite for rewriting.

Required tests before a corrected build:

1. **Feedback interpretation:** seven/hard/none; numeric/qualitative disagreements; older qualitative-only records; eight/nine/ten; soreness separately; missing answers; completion versus skipped/partial. Verify actual numeric inputs to the selector, not just the function name.
2. **Accumulated athlete matrix:** real onboarding → complete/log weeks 1–4 → accept week 5 → inspect weeks 5–7, for all cohort profiles plus relevant day counts, experience, equipment and phases. Check final per-row sets/reps/load against the approved decision, not only movement presence or session totals.
3. **Every load-increase route × set decision:** ordinary loaded rise, first BW-added load with recorded top-range sets, weighted BW history, held load, estimate/unset and rotated exercise. Assert no exercise receives both earned weight and an added set, across all appearances in the block. Assert the first-BW route was actually reached.
4. **Recovery controls:** explicit tired/cooked, injury, illness, missed sessions, game proximity, scheduled deload and combined strength/conditioning feedback. Prove valid reductions remain, with approved sets, load and repetitions; no blanket minimum-set patch.
5. **Delivery:** accepted data → PDF row summary → actual program/day screen → persistence and reopen. Check concrete values as well as equality: equal wrong values are not success. Preserve dates and prior completed logs.
6. **Make the checks prove themselves:** inject the old hard→Sore/RPE8 path, drop the first-BW case from the shared weight-increase predicate, and force a normal main row to one set. Each must fail for its intended reason. No production mutation was made during this investigation.
7. **Gates:** update the relevant existing suites and register the new behavioural coverage in `scripts/test-truth-decisions.json`; run the relevant progression, feedback, deload, compiler, projection/PDF and athlete-action suites, then the full current `npm run test:release` gate including compilation before a corrected build. Do not use the obsolete historical test fleet as a substitute for current contract coverage.

This catches the next failure in the class by checking the final combined prescription across feedback and load routes, rather than adding an exception for these two exercises.

## NOT COVERED

- No implementation, source/test/config change, new product rule, commit or phone build in this investigation.
- No full historical rebuild of the PDF's commit; current weights are not claimed identical to that PDF.
- No complete 52-/156-week rerun, all possible athlete combinations, or personal phone-state reproduction.
- No actual screen interaction or PDF visual/layout inspection; current screen delivery remains unverified here.
- No post-fix gates or mutation results: no fix exists yet. The full release gate was not run for this diagnosis.
