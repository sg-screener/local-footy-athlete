# Programming and Load history spacing — verification receipt

LOOP CHECK: section-specific workload omission — sighting 2; compress through shared work-area credit for saved add-ons and optional flows.

NOT-VISIBLE: these changes remain in isolated branches pending Sam’s approval to combine them. The active UI preview was not changed by this work.

Owner: legprogram. No merge, deployment, simulator restart or live-data reset was performed.

The main programming checkpoint is `06722458`, followed by the prehab correction `c2236f64`, on `codex/programming-coverage-20260908` in `/private/tmp/lfa-programming-coverage-20260908`. Its parent `0505e3bb` snapshots Sam's confirmed starting code: `8d06bbde` plus the existing uncommitted work. That snapshot is not an authored programming change.

The separate padding fix is `8059c65f` on `codex/load-history-spacing-20260908`, in `/private/tmp/lfa-ui-spacing-20260908`. Its parent `2901f4cf` snapshots the later UI work. Combine only the authored corrections after Sam approves; do not merge either snapshot wholesale.

## Changes and their checks

- **Weekly calf and hamstring work:** `weeklyLegCoverage` credits existing work and repairs missing categories after rotation. `footballRobustnessFoundation` distinguishes Nordic/curl credit from equipment-only hinge alternatives. Existing experience rules determine which normal choices are available; an ineligible Nordic cannot conceal a missing curl machine. Dated health restrictions and deliberate deletions remain protected. Held by `test:leg-programming` and the annual `weekly_calf_hamstring` check.
- **Whole-day leg demand:** `lowerBodyWorkload`, `trainingWorkload`, `conditioningDemand` and `weeklyScheduler.wholeWeekPlacementCost` count working sets, jumps, hard conditioning, demanding prehab and club/game days. The existing planner compares complete legal arrangements, retains useful training, and prefers fewer consecutive demanding leg days. No assumed exercise order or blanket full-body ban. Held by the whole-week and Saturday Speed journeys plus the four-day-pile-up rule case and fault control.
- **Returning running:** `runningReturn` replaces existing field prescriptions with the two introductory weeks and reduces returning jump repetitions. Generation, injury rebuilding and fixture repair share that rule. The source-fact compiler saves the returning week so reopening cannot silently restore full dose. Actual injury recovery, a bye, deliberate run-dose edits and reopening are exercised by the 135-check journey.
- **Restrictions and prehab:** dated athlete context reaches warm-ups, prehab, optional flows and replacement projection. Meaningful prehab counts toward its area and loses duplicate/full deload doses; light mobility does not count as strength. Screen changes only pass context in `HomeScreenV2` and `DayWorkoutScreenV2`, as flagged before editing. Shared optional context/workload/return-marker fields were also flagged. Existing lifting loads, availability, fixtures, off-feet conditioning and optional status remain governed by their existing owners.
- **Spacing:** the 44-point arrow row added 15 points above and below the smaller week label. `LoadHistoryScreen` offsets that extra height and uses the shared 16-point inset for cards and session rows, retaining the arrow targets. All three compilation scopes have zero errors. Native pixels were not measured.

Options compared: targeted changes inside the existing owners, with shared rules across callers; or an ownership redesign replacing the scheduler. The targeted option was chosen. New individual return protocols and separate repairs in each screen were rejected. The common rule functions and injected-fault checks catch the next mismatch across those paths.

## Results

The broader compiler audit reaches **416 distinct athlete-weeks (eight profiles × 52)** at the main programming checkpoint. **407 athlete-weeks pass every weekly check; nine fail the strength-frequency check described below.** All 416 weekly calf/hamstring checks and all 416 weekly reopen checks pass. The six fault types are caught in all eight selected runs (48 executions, six distinct faults). The combined gate remains red for those nine weekly findings and the existing ownership prerequisite. [Full annual report](/private/tmp/lfa-programming-coverage-20260908/output/legprogram-year-acceptance/combined/index.html). The final prehab follow-up is tested separately below; this is not an eight-profile rerun of that later change.

Focused programming suite: **27 named rule cases, 135 actual-journey assertions and 13 distinct injected faults caught**. Compilation: **zero errors across product, developer tools and tests**. The compiler-year detector passes **45 infrastructure controls**; these are separate from athlete-week results.

Related passing surfaces: test-truth; whole-week planning (10 journey groups, seven faults); Saturday Speed (14 journey groups, eight faults); conditioning phase authorship (42 cases); normal running (12 cases); Nordic dose (12 cases); conditioning access (105 date/profile cases across 15 profiles, two eight-reopen journeys and four faults); progression dose (615 checks); injury/compiler preview; injury fallback; mobility flow; generated weeks; automatic selection; movement planes; deload law. Detailed command receipts are listed in the [receipt index](/private/tmp/legprogram-verification-receipts.json).

Mutation names for the new guard: `ignore-previous-addon-dose`, `ignore-addon-flow-credit`, `ignore-strength-in-addons`, `count-ineligible-nordic-as-available`, `ignore-deliberate-removal`, `disconnect-whole-day-ranking`, `disconnect-weekly-coverage`, `hinge-replaces-curl`, `tib-replaces-calf`, `ignore-whole-day-legs`, `skip-running-return`, `ignore-prehab-dose`, `ignore-derived-injury`. Each injected fault caused its guard to fail.

The existing annual repair suite passes **45 cases** and catches **25 distinct injected faults** after the goal-budget correction. The final prehab follow-up was then checked by the full programming, mobility, Saturday Speed and whole-week suites, compilation and the final three-day annual run.

The final three-day audit, rerun with the follow-up later committed as `c2236f64`, reaches **52 weeks / 364 athlete-days**, **52 identical reopens** and **29 recorded actions**. Its selector checker reports zero exact exercise repeats, zero dedicated-day ownership findings and zero required movement-plane gaps. It also reports two repeated main-lift families (four exercise occurrences), 18 soft trunk-plane findings and one accepted plane exception. The unchanged baseline produces the same counts. The checker therefore remains **FAIL** for those existing findings; the zero required-plane count is not an overall pass.

## Remaining failures

- Nine annual athlete-weeks exceed the strength-frequency limit after a knee-injury report: five lifting days against a maximum of four. They are weeks 10–12 of Pre-season for both six-session profiles, plus weeks 10–12 of In-season for the profile without a standing fixture. The same four-to-five failure reproduces on the unchanged baseline for both profiles in Pre-season and for the no-standing-fixture profile in In-season through the real phase-change door. In the fresh probes, injury repair adds a lifting session on a previously empty day. These baseline probes reproduce the defect class; they do not repeat the entire annual history. [Baseline/current probes](/private/tmp/lfa-programming-coverage-20260908/output/legprogram-strength-frequency-probe.json).
- The repository-process guard has **12 failing checks out of 63**, identical to the starting checkpoint: existing report-format, inbox/history, test-flow reachability, store-writer and source-anchor issues. No new failing check was introduced. [Comparison](/private/tmp/lfa-programming-coverage-20260908/output/legprogram-repo-guard-comparison.json).

- The law gate has **21 UNENFORCED rows out of 312 registry rows**; the baseline had the same 21 out of 311. The new programming rule is guarded and included in `test:bible`.
- The current ownership scan has **one unresolved owner out of 1,191 inspected owners**: the existing `ProgressTabScreen` fingerprint. There are zero confirmed rival authors and zero derived publishers. Its fingerprint was not changed by this work.
- The weekly-scheduler command still encounters the same **two zero-equipment assertion failures** as the baseline (eight of ten cases pass). The preceding scheduler, freshness, persistence, COD and generated-fixture checks pass; the downstream continuity and spare-day tests pass separately. The existing no-equipment profile-save refusal is also unchanged.
- The three-day selection findings above remain. This report does not turn baseline failures into passes.

## NOT COVERED

Physical-iPhone acceptance; native spacing pixels; the combined programming/UI version; live or remote persistence; real OS process death. Restart tests clear and rehydrate isolated stores through production boot. The eight-profile audit tests the main programming checkpoint; it was not repeated in full after the final prehab follow-up. The final three-day annual run and the named targeted suites cover that follow-up. The eight annual profiles do not cover every possible combination of injury, equipment, fixture and edit. The full `test:bible` chain was not rerun end-to-end; its named relevant surfaces and known failing gates are reported above. No merge or deployment is included. After Sam approves combining, check overlapping files and rerun relevant tests on the combined code before device acceptance.

