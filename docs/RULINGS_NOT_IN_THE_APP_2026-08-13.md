# SAM'S RULINGS THAT ARE NOT IN THE APP — census, 2026-08-13

**Commissioned by Sam, 2026-08-13, in these words:** *"find what I've ruled on
that currently does not make it to the app, or things in the app that contradict
what I've said. my rulings should all be in the app by now and I'm fucking sick
of fixing these tiny little edge cases when the real logic i have already put in
place IS NOT ACTUALLY IN FUCKING PLACE."*

**METHOD.** Six independent auditors, one slice each, each required to run a
grep that WOULD have found an enforcer before reporting its absence, and to
attach a `file:line` receipt to every claim. **Findings without a receipt were
discarded.** Two findings below were reached by two auditors independently and
are marked **[CONVERGENT]** — those are the most certain in the document.

**WHAT "IN THE APP" MEANS HERE.** Production code that makes the behaviour
happen or blocks its violation. A value computed, stored or passed along but
read by no enforcer is NOT in the app. Rendering that generation never produces
is NOT in the app. A rule held only by a test is NOT in the app. **An advisory
finding, where Sam stated a rule, is NOT in the app** — and is called out as
such.

**20 findings. 6 CONTRADICTED, 1 ABOLISHED-BUT-STILL-SHIPPING, 13 NOT IN APP.**

---

## A. THE APP DOES THE OPPOSITE OF WHAT SAM RULED

### A1. One "cooked" tap deloads the athlete FOREVER
**Ruling:** a low-readiness declaration deloads a fixed **7-day rolling window**
from the declaration day; the open-ended hold is the ILLNESS door's one
difference. `LFA_PROGRAMMING_BIBLE.md:4961`, `:4957`, `:4960`.
**What the app does:** `programControlActions.ts:1378-1379` mints the cooked
fact with the same scope severe illness gets → `durableFactHorizon.ts:82`
returns `{ kind: 'open', until: null }`, and `:134` states *"Open horizons never
elapse"*. **The 7-day window code exists and is DEAD:**
`readinessIllnessLaw.ts:86,138,147,152,213` are its only mentions — no caller in
`src/`.
**Athlete impact:** one tap on "cooked" deloads them, and at that tier makes
every session optional (`generationConstraints.ts:181-183`), **indefinitely,
every week, until they go back and manually clear it.**

### A2. A developing athlete gets contrast work **[CONVERGENT]**
**Ruling:** contrast is gated to `consistent` / `advanced` on the ladder.
`LFA_PROGRAMMING_BIBLE.md:225`, restated `:4940`.
**What the app does:** `powerPrimerPolicy.ts:241` —
`contrastEligible = ctx.readiness === 'high' && !reduced && !isPreseasonTeamDay`.
Readiness, niggle and team-day only; **no rung of the ladder appears anywhere in
the eligibility expression.** The one experience input, `ctx.isBeginner`, is
`level === 'new'` (`coachingEngine.ts:1507`), so `developing` sails through.
**Athlete impact:** the "1-2 years" onboarding answer gets true contrast
prescriptions — two rungs below Sam's gate.

### A3. The athlete is shown a rep RANGE, not a single number **[CONVERGENT]**
**Ruling:** ranges are the generation source, but the athlete sees a **single
middle number** — *"3x8-12 is written as 3x10"*. `LFA_PROGRAMMING_BIBLE.md:770`,
law added `:4936`.
**What the app does:** `dayWorkoutHelpers.ts:251-256` renders
`${sets} × ${min}-${max}`, on the session screen at
`DayWorkoutScreenV2.tsx:2212`. The week projection has a **dedicated signed
range template** for it (`projectionCopy.ts:736-740`). No midpoint collapse
exists anywhere upstream. The only `midpointReps` in the repo
(`journalLoad.ts:490`) serves the JOURNAL.
**Athlete impact:** they read "3 × 8-10", pick a number themselves — the exact
ambiguity the ruling was written to end — **while the journal silently scores
their load against a midpoint they were never shown.**

### A4. Two heavy lifts of the same pattern in one session
**Ruling:** one main per pattern; Deadlift + RDL is illegal.
`LFA_PROGRAMMING_BIBLE.md:226`.
**What the app does:** the production fallback at `defaultProgram.ts:1172-1177`
emits **RDLs 3×8-10 + Hip Thrusts 3×8-12** — both classify as main lifts, both
`movement: 'hinge'` (`exerciseTags.ts:585`, `:627`). Again at `:1194-1196`:
Overhead Press + Incline DB Bench, both `push`. The only stacking cap in the
repo says the opposite — `exerciseScorer.ts:405`:
`if (currentCount >= 2) continue; // hard cap: never 3 of same pattern`.
**No duplicate-pattern validator exists.**
**Athlete impact:** two heavy hinges or two heavy presses in one session, with
nothing to catch it.

### A5. A 6th hard day is a confirm dialog, not a refusal
**Ruling:** an edit that would create a 6th hard day must be **REFUSED** with
plain-language copy. `LFA_PROGRAMMING_BIBLE.md:118`.
**What the app does:** `weekStructureValidator.ts:481-499` grades it `'strong'`
with `canOverride: true`; `conflictResolutionHierarchy.ts:107` maps `strong` →
`editDecision: 'confirm'`. **Only `hard_stop` maps to `block`.**
**Athlete impact:** the week Sam said is impossible is one tap away.

### A6. Sprint is capped at 2 nights a week — and there is no cap
**Ruling:** sprinting is limited to **2 nights per week, counting team-training
nights**. `LFA_PROGRAMMING_BIBLE.md:90`, `:129`.
**What the app does:** `weeklyExposureContractV2.ts:1029` sets
`sprint: { max: null }` for **every pre-season row**, in-season game week
(`:912`), both bye rows (`:923`, `:933`) and mid off-season (`:1003`). A `null`
maximum short-circuits the blocking evaluator. The only other ceiling is graded
`'soft'` (`weekStructureValidator.ts:452`) = advisory. **And team training and
games are CREDITED as sprint exposures** (`sessionClassificationAdapter.ts:165`).
**Athlete impact:** 3 team nights plus any app sprint work = 4 sprint nights, and
nothing objects.

---

## B. ABOLISHED BY SAM — STILL SHIPPING

### B1. The retired conditioning progression system is still dosing conditioning
**Ruling:** the per-tier `TIER_CAPS` progression is **retired outright**,
because the authored templates own conditioning entirely and *"two systems
dosing it means the older one inventing its numbers"*.
`LFA_PROGRAMMING_BIBLE.md:4966`.
**What the app does:** `TIER_CAPS` is alive at
`conditioningProgressionRules.ts:101`, consumed at `:284`, entered from
`sessionBuilder.ts:1377`, applied to the athlete's session at `:1379-1383` and
stamped onto the Workout at `:1398` — reached from the live week resolver at
`sessionResolver.ts:2023`. **The replacement is live at the same time**
(`conditioningSelection.ts:285`, three production callers).
**Athlete impact:** conditioning duration is nudged by a layer that invents its
own numbers, running on top of Sam's authored doses. **This is precisely the
two-systems state he forbade.**

---

## C. RULED, NEVER BUILT

### C1. Change-of-direction and deceleration work is never programmed. Ever.
**Ruling:** COD/decel is prescribed in weeks with no team training (late
off-season, Christmas break) and cut first when something has to give.
`CONDITIONING_FRAMEWORK_SAM_2026-07-25.md:121`, Bible `:1440`.
**Receipt:** `conditioningSelection.ts:132-147` — `poolForCategory` has six
`case` branches and **no `cod_decel` branch at all**. The four authored COD
templates (`conditioningTemplates.ts:628,645,662,679`) can never enter a
candidate pool. The gate that would scope them (`:302-303`) is dead twice: no
caller ever passes `noTeamTrainingWeek`, and `templatesForTier`, the only other
function that maps COD, has **no production caller**.
**Athlete impact:** no athlete has ever received a COD or decel session, in any
phase.

### C2. The athlete's 2km time trial is collected and never used

> **✅ BUILT 2026-08-13 — `8bf8548b`, `audit` seat. THE ORIGINAL FINDING BELOW IS
> LEFT WORD FOR WORD; this block is the answer to it, not a rewrite of it.**
>
> `rules/masPace.ts` is the reader C2 says does not exist. A %MAS row now carries
> **the speed it means for that athlete** — `Intensity: 65–80% MAS` gains
> `Your pace: 9.8-12 km/h` off their own 2km, or `Estimated pace: …` off Sam's
> default for their experience level when they have not tested. Held by
> `LAW-mas-percent-names-a-pace` / `test:time-trial` `[23]`-`[25]`, 34 cells,
> born guarded, mutation-checked four ways.
>
> **DERIVED AT THE READ, NEVER AT GENERATION** — a pace stored in a row would be
> a second representation of the athlete's pace, which is the defect
> `twoKmTimeTrial.ts`'s own header forbids. Nothing is stored, so logging a
> faster 2km reprices every card with no regeneration.
>
> **Q-001 (%MAS: range or binary?) IS UNTOUCHED AND STAYS OPEN.** The pace is
> read off whichever percentage the card is ALREADY showing, so `masCopy` gains
> no consumer and his answer moves the pace for free. A cell holds that.
>
> **⚠ AND THE ATHLETE IMPACT BELOW HAS A LIMIT THAT WAS NOT KNOWN WHEN IT WAS
> WRITTEN — MEASURED, NOT ASSUMED.** An in-season week **with a club** prescribes
> **no %MAS at all**: `generateProgramLocally` over `DEV_E2E_STANDARD_PROFILE`
> yields **0** rows carrying a MAS band, while the same profile with the club
> removed yields **8** in-season and **7** in pre-season. The club supplies the
> running. So this line appears on club-less weeks — off-season, pre-season
> without a club, a bye build, a trip — and on a normal in-season week there was
> never a percentage to translate. **That also means no seeded world can
> photograph it in one step, which is why the glass proof is still owed.**

**Ruling:** MAS = 2km average speed × 1.00; a skipped trial gets Sam's signed
default pace by level (6:30 / 7:15 / 8:00 / 8:45), applied at derivation.
`STAGE_C_TIME_TRIAL_RULINGS_2026-07-29.md:36-44`, `:73-88`.
**Receipt:** `deriveMas` (`twoKmTimeTrial.ts:156-167`) has **zero production
callers**. `MAS_FROM_TIME_TRIAL_MULTIPLIER` and `TWO_KM_TIME_TRIAL_DEFAULTS`
likewise. `masCopy.ts` is imported by no production module at all. The file's
own comment at `:17` claims *"Everything downstream reads deriveMas"*. Nothing
does.
**Athlete impact:** they run a 2km time trial, the app validates and stores it,
and their conditioning card reads the literal stored string **"Intensity: 110%
MAS"** (`conditioningSelection.ts:517`, `conditioningTemplates.ts:915`) — no
personal pace, no distance.

### C3. The 8-minute erg interval cap has no reader
**Ruling:** intervals over 8 min are **Run or Bike only**; Ski, Row and Air Bike
have a HARD CAP of 8 minutes, 6 preferred.
`CONDITIONING_FRAMEWORK_SAM_2026-07-25.md:137`, Bible `:1297`, `:1401-1402`.
**Receipt:** fully encoded as data (`conditioningTemplates.ts:275-282`:
`ergCapMinutes: 8`, `uncappedModalities: ['run','bike']`,
`excludedModalities: ['ski','row','air_bike']`) and read by **nothing but a
test**. **The authored data already breaches it unchecked:** template "Short
Flush" (`:1197`) offers *"one continuous 8–10 min block"* on Ski/Row, and the
runtime modality reader admits it because its only exclusion test is a prose
regex (`conditioningSelection.ts:206`) this note does not match.
**Athlete impact:** a continuous 10-minute Ski or Row block can ship — above the
ceiling, on the two machines he barred.

### C4. Sam's floors are advisory; only his ceilings are enforced
**Ruling:** running ≥2 days/week, weekly conditioning minimum, sprint/COD ≥1
from mid off-season. Bible `:4283`, `weeklyExposureCounts.ts:72,74`.
**Receipt:** all three are computed as `under` findings
(`weeklyExposureCounts.ts:323-367`) and `weekStructureValidator.ts:454-466`
takes the `under` branch FIRST and hardcodes `severity: 'info'`,
`canOverride: true` — skipping light weeks entirely. The `capSeverity` map three
lines above is **only reached for over-caps**. `grep` for any repair consumer of
the three `_under` rule IDs: **zero matches.** The `_over` twin IS consumed
(`coachTurnController.ts:2261`).
**Athlete impact:** a week with zero running days ships with an overridable
info note. **Ceilings refuse; floors do nothing.**

### C5. Zero rest days is an accepted week in off-season and pre-season
**Ruling:** 1-2 full rest days, and it *"stands everywhere"* except bye-recovery
and early off-season. `LFA_PROGRAMMING_BIBLE.md:128`.
**Receipt:** `weeklyExposureContractV2.ts:1005`, `:1016`, `:1030` set
`rest: { required: 0 }` for mid off-season, late off-season and all three
pre-season rows — the only rows with a real training load and a zero floor, and
the only `rest:` lines in the file with no justifying comment. That field is the
sole input to the blocking check (`section18EffectiveWeekEvaluator.ts:1484`), so
with 0 the comparison is unreachable.
**Athlete impact:** a 7-day training week is built and accepted.

### C6. The deload window is owned by the WEEK, which the law forbids
**Ruling:** "deloaded? optional?" is owned **per day**; the week mode is DERIVED
from it, *precisely because* a week-granular owner can only honour a rolling
window by snapping it to weeks — *"the exact behaviour the law rules out"*.
`LFA_PROGRAMMING_BIBLE.md:4960`.
**Receipt:** `resolveDayDirective` (`readinessIllnessLaw.ts:201`), whose own
comment calls it *"The single read point for both doors"*, has **ZERO callers**.
The live owner is week-granular: `generationConstraints.ts:182-183` mints whole-
week booleans, read at `generateProgram.ts:551` and stamped on the whole week.
**Athlete impact:** a Thursday "wrecked" call retro-deloads Monday to Wednesday
and drops off at Sunday.

### C7. The lower-day heavy-slot ladder does not exist in generation
**Ruling:** heavy squat → heavy hinge → single-leg knee-dominant → single-leg
hip-dominant → accessories. `LFA_PROGRAMMING_BIBLE.md:227`.
**Receipt:** strength selection for generated weeks is done by the LLM
(`generateProgram.ts:1417`) and the prompt never mentions the ladder —
`grep -rniE "single-leg|unilateral" src/services/api/generateProgram.ts` → zero
matches. The only ladder-shaped code (`exerciseScorer.ts:597-601`) is reachable
from exactly one call site, `coachRevisionTemplates.ts:597` — the coach-revision
path, **never the weekly generator**. The fallbacks confirm it: the squat-only
branch has no hinge and no single-leg at all.
**Athlete impact:** lower-day structure is whatever the model returns.

### C8. "Contrast" is never actually a pairing
**Ruling:** a contrast pairing is a heavy lift supersetted with an explosive
lift **of the same pattern**, at the MAIN slot. `LFA_PROGRAMMING_BIBLE.md:225`.
**Receipt:** `buildPowerRow` (`defaultProgram.ts:1531-1559`) sets no
`supersetGroup`, no `supersetOrder`, no `pairType` — the only difference contrast
makes is a notes string. `workoutCanonicalisation.ts:791-796` then **actively
strips** any `pairType === 'contrast'` as `stale_raw_contrast_pairing`, and
`:822-827` sorts all power rows to the top, ahead of the main lift.
`powerRowAlignment.ts:99` only checks some same-FAMILY row is heavy — so "heavy
deadlift + vertical jump" passes.
**Athlete impact:** a standalone jump at the top of the session plus a sentence
telling them to do it after their heavy set.

### C9. Progression overwrites the authored dose with no ceiling
**Ruling:** beginners get 2-3 sets, 4-8 reps at RPE 6-7; phase rep bands govern
main-lift dose. `LFA_PROGRAMMING_BIBLE.md:3140-3142`, `:768`.
**Receipt:** the caps are read in exactly one place, at GENERATION
(`defaultProgram.ts:942-970`). The week the athlete opens is then re-prescribed
by `applyStrengthProgression` (`sessionResolver.ts:1624`), and the delta at
`strengthProgressionIntegration.ts:498-500` has **floors only, no ceilings and
no policy** — and its hardcoded rep floor of `3` is **below the beginner minimum
of 4**. `add_one` fires after 3 clean sessions (`progressionRules.ts:338-341`).
**Athlete impact:** a beginner who logs three good sessions is silently moved to
4 sets; a down-delta drops them to 3 reps. Both outside Sam's dose, **on the card
they are actually looking at.**

### C10. Main-strength reductions are inferred, not proven
**Ruling:** main strength gains the same exhaustion proof equipment has
(`not_attempted | substituted | exhausted`); **measured** exhaustion — *"proof,
never inference"* — emits the typed reduction.
`INJURY_AUTHORITY_EXHAUSTION_RULING_2026-08-06.md:22-27`, kept by V2 `:19-21`.
**Receipt:** all 8 production `substitutionStatus` hits are equipment or
conditioning; the main-strength contract block
(`weeklyExposureContractV2.ts:373-378`) has no exhaustion status. The only
producer (`section18SafetyPolicy.ts:311-318`) fires on
`availableSafePatterns.length === 0` — an inference that never asks whether a day
remained.
**Athlete impact:** a week that genuinely ran out of days records no typed
reduction, so the Coach Note owes no reason for the missing session.

### C11. The MAS set-length limit has no reader
**Ruling:** short-intermittent high-%MAS blocks are ≤ ~4-5 min, **enforced at
selection time**. `CONDITIONING_FRAMEWORK_SAM_2026-07-25.md:58`, `:113`, `:127`.
**Receipt:** `set_length_max_4_5_min` appears five times — a type member, a
source string, three template assignments — and **no reader**. The selection
filter (`conditioningSelection.ts:291-304`) gates on three other properties and
has no clause for it.
**Athlete impact:** a MAS block can run past 5 minutes, which by Sam's own
definition trains a different quality than the session claims.

### C12. Mobility pairing — see SEAT_INBOX item 26
`MOBILITY_PAIRING_RULINGS_2026-07-31.md`, authored 2026-07-31, status line
*"AUTHORED, NOT COMMISSIONED"*. No producer; and the validator caps pairs at 1
per session (`defaultProgram.ts:1299`), so it would delete two thirds of the
design if built naively.

### C13. Session size — see SEAT_INBOX item 25
Size comes from template row length (`sessionBuilder.ts:718`);
`maxExercisesPerStrengthSession` has zero readers; the abolished 3 still ships
from eleven fallback branches.

---

## WHAT THIS CENSUS SAYS AS A WHOLE

**The app is not missing Sam's logic. It is holding it and not reading it.**
Nine of these twenty are a value, a policy field, a typed status or a whole
function that EXISTS, is correct, and has no consumer — `deriveMas`,
`resolveDayDirective`, `ergCapMinutes`, `set_length_max_4_5_min`,
`maxExercisesPerStrengthSession`, the COD templates, the ladder, the contrast
pairing, the mobility pairing. **That is the same defect twenty times, not
twenty defects.**

**THE PATTERN THAT PRODUCES IT:** a ruling is captured faithfully into a data
structure, and the unit ends before anything reads it. The repo already has a
test named `test:computed-must-be-consumed`. **It is not catching these.**

**THE SYSTEMIC FIX, per Sam's standing instruction** (*"Don't fix edge cases,
build a systemic fix into the system so issues are fixed globally"*): every
authored ruling must carry a named ENFORCER and a cell that fails when the
enforcer is removed. **A ruling with no enforcer is UNENFORCED and must be
counted like the law registry counts its rows** — visible, falling, and
stop-the-line. Widening `test:computed-must-be-consumed` from values to RULINGS
is the unit that closes the class.

**AND ONE STANDING PROCESS FIX:** three of these twenty were recorded in a doc
whose own status line said *"AUTHORED, NOT COMMISSIONED"* or equivalent. **A
ruling captured but not commissioned is a defect at the moment of capture.**
Nothing may be filed as authored without an inbox item created in the same pass.
