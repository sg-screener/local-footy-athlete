# TWO AUDITS RECONCILED — codex/`elegance` vs the seat's seven verifiers

Sam, 2026-08-13, holding both reports: *"do you agree and where do you disagree?
or what did he miss that you hit and what do you miss that he hit?"*

Sources: `docs/ELEGANCE_AUDIT_2026-08-14.md` (the terminal) and
`docs/ELEGANCE_AUDIT_VERIFICATION_2026-08-13.md` (seven parallel one-question
verifiers, run before the terminal's report was read). **The two were produced
independently and agree on the verdict.**

## RE-RAN, NOT TAKEN ON TRUST

- `node scripts/measure-elegance-audit.js`, 2026-08-13 19:14 UTC: **549
  production files, 266,430 lines, 3,249 relative import edges, 2,037
  cross-layer, 242 files inside circular groups, 5 groups.** Reproduces the
  report's table exactly. `utils->rules` 204 vs `rules->utils` 82;
  `utils->store` 169 vs `store->utils` 114.
- `scripts/typecheck-baseline.json`: product scope total **35** — the report's
  "459 baseline errors, 35 in product source" is real.
- **The bodyweight root cause is CONFIRMED and it is one function.**
  `src/data/exercisePoolsStrength.ts:964` `selectPoolEntryAvoiding` — at `:977`
  `if (effective.length === 0)` it logs `[pool-override-fallback]` (`:982`) and
  falls through to `walkEntries(pool.entries, ...)` at `:989`. **When equipment
  filtering empties a slot, the app prescribes the unfiltered exercise.** That
  is why the bodyweight-only printed week contains Barbell Row, Overhead Press,
  Pull-Ups and RDL. It is a five-line change in shape, not an equipment-data
  problem.

## FULL AGREEMENT

The verdict — *no single brain composes the week once; later passes make the
final program an emergent side effect* — was reached twice from different
measurements. Also independently identical: **16 of 43 assigned `contract.*`
fields have no reader**, name for name. And the seat's verifier independently
confirmed the report's §1 bullet: **the slot engine's composing functions are
not on the generation path** — `utils/exerciseScorer.ts:265 selectExercises`
runs only via `sessionBuilder.ts:783` <- `coachRevisionTemplates.ts:597`, never
during generation.

## WHAT THE TERMINAL HIT THAT THE SEAT MISSED

1. **Cycles.** The seat measured *reachability* (186 files, 44% of production);
   the terminal measured *circularity* (242 files, largest group 232). The cycle
   number is the better measure of "parts crossing over each other" and the seat
   did not take it.
2. **The compile gate is green against a 459-error baseline** — the type checker
   is not protecting this app. The seat never looked.
3. **The bodyweight raw-pool fallback** (confirmed above). The seat's edge-case
   probe reported "exercises are handled generally, not special-cased" and was
   right about branches — but missed that the *generality* is where the defect
   lives.
4. **The screen is another interpretation layer**: `3 x 2-4` printed by the
   projection becomes one middle number on the Day screen; `1 x 1` conditioning
   filler; Power parts with no rows. The seat audited generation and never
   opened projection.
5. **Week 5 is identical for five different histories** (`npm run sim:changeover`),
   and a completed session with no logged rows is invisible to progression.
6. **Process (§7)**: 33 agent commits rewrote the shared inbox; two paper-phone
   directories; probes recorded against a tree another seat was editing. The
   seat hit this live — its own first commit collided with the terminal's.

## WHAT THE SEAT HIT THAT THE TERMINAL MISSED

1. **THE BIGGEST ONE — nothing at row level reads WHO CHOSE a row.** The report
   states "athlete decisions are immutable inputs" as a *goal* of Option B. It
   never names the live mechanism that breaks it today: `athletePlacement`
   (`types/domain.ts:908`) and `authorship === 'athlete'`
   (`rules/athletePlacement.ts:85`) exist and the gateway reads them, but
   `workoutCanonicalisation.ts`, `postGenerationConstraintValidation.ts` and
   `section18SafetyFinaliser.ts` never mention either. Consequence with
   receipts: a deleted exercise is restored (`workoutCanonicalisation.ts:889`,
   fabricated cue at `:447`), the guard meant to stop that
   (`programStore.ts:2765-2769`) runs after the row is already back and is
   vacuous, and the athlete is then told *"That removal would break the
   programmed session"* (`coachActions.ts:667-669`).
2. **Named disagreements, not "layers can reinterpret".** Sets/reps:
   `defaultProgram.ts:1157` authors `3x5-8`, `rules/phaseRepSchemes.ts:53`
   overwrites in-season with `3x3`, order proven at
   `defaultProgram.ts:2605->2606->2618->2628`. Training days:
   `coachingEngine.ts:8952` unions team days, `useSchedule.ts:170` and
   `deriveVisibleWeek.ts:148` do not. Same `g1` fact: overridable at
   `weekStructureValidator.ts:307`, `hard_stop` at
   `programEditRiskAssessment.ts:319`, precedence proven at `:390-400`.
3. **The generator's vocabulary is four words.** Every `plannedPatterns` literal
   in non-test `src/` is a combination of squat/hinge/push/pull
   (`coachingEngine.ts:4995-5020`). **No archetype anywhere asks for a single-leg
   slot**, though `rules/strengthPatternContributions.ts:31-37` defines two and
   the ledger can owe them. The report's loop-check line mentions a single-leg
   probe; it does not state this root.
4. **Weeks 2-4 never see coach output** — `generateProgram.ts`,
   `stateIndex === 0 ? args.coachWorkouts : []`.
5. **Sam's R-088 has no enforcer at all**:
   `rules/trainingAgePolicy.ts:58 maxExercisesPerStrengthSession: 7` reaches
   `AIConstraints` and nothing else. No trim, no validator.
6. **Twenty copies of the weekday table** (14 Sunday-first, 4 Monday-first)
   despite an owner at `utils/appDate.ts:140`.
7. **872 dead lines of `HomeScreenClassic`** still compiled beside the live
   screen (`screens/home/HomeScreen.tsx:51,69-941`).
8. **The refutation.** See below.

## THE ONE REAL DISAGREEMENT — §4's framing

The report's §4 heading, *"the judging system grew faster than the product
brain"*, is TRUE of yesterday's commits and of the LAW/doc scaffolding. It is
NOT true of `src/rules`, and the two must not be collapsed:

- **127 of 135 `src/rules` modules have runtime production consumers.** 8 are
  test-only.
- **44 rules modules are imported DIRECTLY by the code that decides content**
  vs 24 by the post-build checkers; 29 builder-only vs 9 referee-only.
- **Test:production code ratio is 0.996 : 1** — ordinary, not a bloated judging
  half. 80% of test mass imports a module inside the generation closure.
- Of the report's own +14,995 test/script and +29,086 doc lines: **the doc half
  is agents writing to each other**, which is process cost, not architecture.

**What survives, sharpened:** it is the **LAW layer**, not the rule layer, that
judges without owning. `src/rules/lawRegistry.ts` has **no production importer**
and **0 of 125 rows name a runtime mechanism**. The 2026-08-14 handoff §8
hypothesis — "rules bolted on as referees rather than wired in as inputs" — is
**REFUTED**. Do not let Option B be sold on it; Option B stands on the cycle
count, the repair stack and the authorship gap, all of which are real.

## WHAT THIS CHANGES ABOUT THE RECOMMENDATION

Both audits land on Option B and neither wants a big-bang rewrite. Two additions
the seat would make to it:

- **The success measure "post-composition row repair paths are deleted" now has
  a list.** The ~20 ordered mutation sites are enumerated in
  `docs/ELEGANCE_AUDIT_VERIFICATION_2026-08-13.md` §1. Option B is checkable
  against it.
- **There is a cheap move that is NOT the composer and tests the same
  principle:** make the row-level passes read `athletePlacement`/`authorship`,
  and make the bodyweight slot at `exercisePoolsStrength.ts:977` drop or
  substitute instead of falling through to the raw pool. Both are days, not
  months, and both fail loudly if the "decisions are inputs" idea is wrong.
  **Sam has not been asked whether he wants that first — it is not a
  counter-proposal, it is an option he should be given.**

## NOT COVERED

Nothing here was run on a device or in the app. The seat re-ran only the two
node measurements named at the top; every other claim on both sides is static
source reading. The report's §5 sim result and §6 screen findings were NOT
independently re-measured by the seat — they are the terminal's receipts.
