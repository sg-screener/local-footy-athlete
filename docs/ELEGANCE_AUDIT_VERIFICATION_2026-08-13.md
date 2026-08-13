# ELEGANCE AUDIT — INDEPENDENT VERIFICATION, 2026-08-13

**Written by the incoming seat, 2026-08-13 19:0x UTC, before reading
`docs/ELEGANCE_AUDIT_2026-08-14.md`.** Sam asked, in his own words, for "a full
audit ... the biggest factors WHY it aint elegant". Seven read-only verifiers
were run in parallel, each given ONE question, each required to return
`file:line`, each told a correction of the seat's framing is worth as much as a
confirmation. **Two of the seven corrected the seat.** The elegance audit was
read only afterwards, so the agreement below is independent, not inherited.

**HEADLINE AGREEMENT WITH `docs/ELEGANCE_AUDIT_2026-08-14.md`:** its verdict —
"the app is short of one brain that composes the week once" — reproduces here
from different measurements. Two numbers match exactly and independently: **16
of the assigned `contract.*` fields have no reader**, and **the printed week is
an emergent side effect of a stack of later passes**. Item 68's decision stands.

**ONE CORRECTION TO THE STANDING FRAMING — see §7.** The seat hypothesis
recorded in the 2026-08-14 handoff (§8, flagged unverified) said the rules were
"bolted on as referees rather than wired in as inputs". **Measured: REFUTED.**
The rules ARE wired in as inputs. What is a pure test artifact is the LAW layer,
not the rule layer. Do not carry the refuted version forward.

---

## 1. THE WEEK IS WRITTEN ONCE AND REWRITTEN ~20 TIMES

Ordered mutation passes over an already-generated week, each with the mutation
site:

Generation tail — `services/api/generateProgram.ts:742` (strip rows / collapse
day to Rest), `:750-751` (provenance, pin history), `:767` + `:789` (the §18
gateway's repair search **replaces the whole week**), `:816` (top-ups added),
`:840`+`:861` (top-ups withdrawn again).

Every live single-date write — `utils/postGenerationConstraintValidation.ts:279`
(drift removal + pattern restore), `:313` (power removed/downgraded), `:502`,
`:512`, `:520-528` (injury, engine, equipment filters), `:531`, `:547-552`
(second finalise), `:1666`+`:1677` (the gateway returns ITS version of the day),
then `store/programStore.ts:2765` **runs 6-11 again on the same candidate**.

Hydration — `programStore.ts:894`, `:902`, `:905` (canonicalises twice inside,
`rules/section18SafetyFinaliser.ts:226`,`:286`, and strips `planEntryId` at
`:250-254`), `:930`+`:950`, `:961`, `:1118`, `:1157`, `:1299`, `:1492`
(`dateOverrides[date] = after`), `:1641`, `:1690`.

**This is the bloat mechanism.** Each rule was added as another pass over a
finished week instead of as an input to writing it.

## 2. TWO PASSES UNDO EACH OTHER, AND THE ATHLETE IS BLAMED FOR IT

`utils/coachActions.ts:666` (also `:632`, `:698`, `:775`;
`planChangeProducer.ts:1184`,`:1234`,`:1255`; `coachRevisionPolicy.ts:49`,`:158`;
`programEditWriteGuard.ts:245`) calls `validateLiveWorkoutWrite` with no
options. Default is restore ON (`workoutCanonicalisation.ts:885`, `!== false`)
and the reference is the **stored pre-edit workout**
(`postGenerationConstraintValidation.ts:1531-1533`) — so the exercise the
athlete just deleted is copied back (`workoutCanonicalisation.ts:889`), or
fabricated carrying the cue **"Restored from the deterministic main-pattern plan
after an invalid edit"** (`:447`). The later guard that exists to prevent
exactly this, `programStore.ts:2765-2769` ("never resurrect content the edit
deliberately removed"), runs **after** the row is already back and is therefore
vacuous. The edit then compares equal to current and the athlete is told
**"That removal would break the programmed session"** (`coachActions.ts:667-669`).

Same-pass self-cancel: `workoutCanonicalisation.ts:849-858` removes a swapped-in
lift; `:885-898`, thirty lines later, restores the planned pattern it just
removed.

**ROOT CAUSE, and it is one line of design, not a bug:** the typed authorship
signal exists — `types/domain.ts:908` `athletePlacement`, `rules/athletePlacement.ts:85`
`authorship === 'athlete'` — and the gateway and craft tier read it. **The
row-level passes do not.** `athletePlacement|authorship` returns nothing in
`workoutCanonicalisation.ts`, `postGenerationConstraintValidation.ts` or
`section18SafetyFinaliser.ts`. Their only proxy is a boolean flag the caller
sets, set inconsistently: OFF at `postGen:552`, `gateway:568`,`:1165`,
`safetyFinaliser:187`, `programStore:2769`; ON by default at all ten sites above.

## 3. NO SINGLE AUTHOR — MEASURED PER DECISION

- **Which exercise:** 5 live implementations. Authoritative for generation is
  `data/exercisePoolsStrength.ts:1015` via `data/defaultProgram.ts:2581`.
  `utils/exerciseScorer.ts:265` — the tag-aware selector — **never runs during
  generation** (only caller chain: `sessionBuilder.ts:783` <-
  `coachRevisionTemplates.ts:597`). One dead: `sessionBuilder.ts:833`.
- **Sets/reps:** 4 writers chained, last wins, order proven at
  `defaultProgram.ts:2605->2606->2618->2628`. **They disagree:**
  `defaultProgram.ts:1157` authors the main lower lift `3 x 5-8`;
  `rules/phaseRepSchemes.ts:53` overwrites it in-season with `3x3` — the
  authored literal is unreachable. A third value, `sets:3 reps 8-10`, is applied
  to EVERY exercise on the coach-revision path (`sessionBuilder.ts:790`).
- **Load:** 4 writers at generation, a separate ladder at render
  (`screens/home/useDayWorkout.ts:155,166,179`).
- **Session size cap:** exactly ONE definition —
  `rules/trainingAgePolicy.ts:58` `maxExercisesPerStrengthSession: 7` ->
  `coachingEngine.ts:8879` -> `AIConstraints` — and **nothing enforces it**. No
  trim, no prompt line, no validator. `rules/sessionRowCounting.ts:339` has zero
  production callers. (This is Sam's R-088, "6-7 exercises", visible as a
  mechanism.)
- **Which days are training days:** 3 deciders, and they disagree.
  `coachingEngine.ts:8952` unions team days into availability; `hooks/useSchedule.ts:170`
  and `utils/deriveVisibleWeek.ts:148` both use raw `preferredTrainingDays` and
  do not. The drift is documented in place at `coachingEngine.ts:8925-8933`.
- **Same rule, two severities:** `rules/weekStructureValidator.ts:307-310`
  raises `g1_not_light` as soft/strong with `canOverride: true`;
  `utils/programEditRiskAssessment.ts:319-322` raises the same situation as
  `g1_hard_work`, `hard_stop`, `canOverride: false`. Precedence receipt:
  `programEditRiskAssessment.ts:390-400` drops the overridable one. **On a coach
  edit the athlete cannot override; on generation the same fact is a soft note.**
- **The weekday name table is redeclared in 20 places** despite an owner at
  `utils/appDate.ts:140`,`:177` — Sunday-first in 14, Monday-first in 4.

## 4. THE GENERATOR'S VOCABULARY IS FOUR WORDS

`coachingEngine.ts:4995-5020` `buildStrengthIntent`: full body plans
`['squat','hinge','push','pull']` (`:5016`); `L-sq` -> `['squat']` (`:5001`);
`L-hi` -> `['hinge']` (`:5003`); `L-co` -> `['squat','hinge']` (`:5005`).
A grep of EVERY `plannedPatterns: [` literal in non-test `src/` returns only
combinations of those four. **Zero contain a single-leg member** — although
`rules/strengthPatternContributions.ts:31-37` defines `single_leg_knee` and
`single_leg_hip`, the ledger carries them, and
`rules/section18EffectiveWeekEvaluator.ts:493`,`:799-800` can owe them. A week
can owe a pattern no planner ever asks for. Single-leg arrives only incidentally
via the `unilateral` tag (`rules/sessionSlotCoverage.ts:272,278,281`).

**And weeks 2-4 are not written by the coach at all:**
`services/api/generateProgram.ts:~672`, `stateIndex === 0 ? args.coachWorkouts : []`
— only week 1 sees LLM output; the rest are synthesised by
`defaultProgram.ts:1330`.

## 5. THE SIZE IS THREE GOD FUNCTIONS, NOT SEDIMENT

`buildWeeklyPlan` = `coachingEngine.ts:1872-7284`, **5,413 lines, 60% of the
file**, 46 nested function declarations, 89 section banners. `handleCoachTurn` =
`coachTurnController.ts:3778-6295`, **2,518 lines, flat**. `routeCoachCommand` =
`coachCommandRouter.ts:1352-2271`, 920 lines, 187 regex literals in the file.
**8,851 lines in three functions.**

Commented-out code is essentially zero. No `X2`/`XLegacy` twins inside them. But
`coachCommandRouter.ts` and `coachProgramEdit.ts` carry **byte-identical twins** —
`scheduleMoveUsesViewedWeek` (`router:561` / `programEdit:3484`), `dayNameFromDow`
(`router:601` / `programEdit:3459`) — and five more that differ by one hunk.
Comment density diverges sharply: `coachingEngine.ts` is 28% comment (documented
reasoning); `coachProgramEdit.ts` is 6 comment lines in 5,797 (0.1%,
undocumented accretion).

## 6. EDGE-CASE SCAR TISSUE — SAM IS ONLY PARTLY RIGHT

Measured over 491 production files / 239,987 lines, hand-verified 4 of 5:

- **Exercises are handled GENERALLY, not special-cased.** Near-zero literal
  exercise-name branches; the only clear hit is `sessionResolver.ts:1825,1840`
  (`workout.name === 'Gunshow'`). Exercise behaviour lives in data tables. **This
  half of Sam's worry is not borne out.**
- **Days and scheduling ARE special-cased.** Biggest concentration in the app:
  `coachingEngine.ts:3199-3254`, five consecutive day-literal flags
  (`hasSundaySlot`, `useNoAnchorSpreadRhythm`, `preserveAnchoredSixDayRhythm`)
  keyed on `dayName === 'Saturday'/'Sunday'` driving distinct week rhythms; also
  `:2421`,`:2519`,`:2530`,`:8296` and `coachProgramEdit.ts:2098`.
- **Dead duplicate implementation:** `screens/home/HomeScreen.tsx:44-941` —
  `DESIGN_VERSION = 'v2'` hardcoded at `:51` makes `HomeScreenV2` the only
  reachable branch, while `HomeScreenClassic` (**872 lines, `:69-941`**) is still
  compiled and maintained beside it.
- `coachTurnController.ts:248,257,271,3510,3520` `legacyFallbackAllowed` — a
  genuine live dual path.
- Phase/season literals: only 8 hits app-wide. Not a problem.

## 7. THE REFUTATION — DO NOT CARRY THE OLD HYPOTHESIS FORWARD

Hypothesis under test (2026-08-14 handoff §8): *"a very large judging half and a
small older generating half — rules bolted on as referees rather than wired in
as inputs."*

- **127 of 135 `src/rules` modules have runtime production consumers.** 8 are
  test-only: `exerciseNameLiteralSweep`, `featureRegistry`, `index`,
  `lawRegistry`, `mobilityPairing`, `onboardingFieldInfluence`,
  `sessionTypeCharter`, `weekPreferenceShape`.
- **44 rules modules are imported DIRECTLY by the code that decides content**
  (`defaultProgram.ts`, `coachingEngine.ts`, `sessionBuilder.ts`,
  `exerciseScorer.ts`, `loadEstimation.ts`, ...) against **24** by the
  post-build checkers. 29 builder-only vs 9 referee-only. Verified as inputs, not
  guards: `coachingEngine.ts:1050` -> `:1058` -> consumed at `:1178`,`:1515`,`:1577`.
- **The generation closure is 186 files / 106,253 lines = 44% of production
  code.** The generating half is not small.
- **Test:production code ratio is 0.996 : 1** — one check per ~30 lines either
  side. That is ordinary, not a bloated judging half. 80% of test mass imports a
  module inside the generation closure; only ~3.4% targets judge-only rules.

**WHAT SURVIVES, AND IT IS REAL:** `rules/lawRegistry.ts` — 125 rows, 104
guarded, 21 UNENFORCED — **has no production importer at all**; 103 of 104 are
guarded by an npm test script and **0 rows name a runtime mechanism**. The LAW
layer is a test artifact. The RULE layer is not.

## 8. COMPUTED AND NEVER READ — 16, VERIFIED TWICE

`rules/section18EffectiveWeekEvaluator.ts:1052-1089` (14 fields incl.
`achievedModerateDayCount:1071`, `unavoidableAnchorCausedExcess:1084`),
`rules/section18SafetyPolicy.ts:415`, `rules/userRemovalConstraints.ts:267`.
Re-derived independently and matched the repo's own gate,
`src/__tests__/computedMustBeConsumedTests.ts:87-113`, name for name.
Also dead: `rules/preseasonExposureContract.ts:97`.

**CORRECTION TO PROJECT MEMORY:** `canOverride` is **no longer a zero-reader
value** — `rules/blockOverride.ts:59` reads `finding.canOverride === true`, per
receipt `rules/lawRegistry.ts:601`. The nine-instance list in
`docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md` needs that one struck.

Broader sweeps (462 zero-reader exported symbols of 1,508; 994 zero-reader
property names of 2,372) are **RAW and unreliable** — hand-verification of 5 put
the false-positive rate at 60%. **Do not quote those two numbers.**

## 9. NOT ESTABLISHED — read before quoting any of the above

- Nothing here was executed. Every claim is static.
- `sessionResolver.ts:1724-1729` carries a device probe comment claiming the
  Program tab early-returns at `:1729`, so ~700 lines of conditioning/recovery
  tail never run — while `useSchedule.ts:218` does pass `seasonPhase` (minted at
  `:155`). **Which holds at runtime is unresolved, and it is worth resolving:**
  if the comment is current, a large slice of the "reachable" count is reachable
  but dead.
- The LLM/edge branch (`generateProgram.ts:1475`) was not traced; the precedence
  claims in §3 cover the local path.
- `weeklyExposureContract.ts` and `weeklyExposureContractV2.ts` both have
  production importers; whether both are called in one request path is **not
  established**.
- `programStore.ts:1471-1487` contains a live `D2_PROBE` whose own question —
  "does this branch overwrite content the athlete authored, how often, and with
  what?" — is unanswered in the repo.
