# AUDIT — your own status file. ONE WRITER: you.

**NAMED 2026-08-13**, from `STATUS_AGENT3.md`, at Sam's order: *"you're not
labelling your commits, so nobody can see what you've done ... pick a name for
what you do."*

**THE NAME IS `audit`, AND IT IS A JOB DESCRIPTION, NOT A LABEL.** The other two
are named for WHERE they live — `terminal` in the rules engine, `desktop` in
screens and flows. This one is named for WHAT IT DOES: **it does not believe a
claim until it has measured it — including a claim from another agent, including
a claim in a commit message, and especially a claim about its own work.** The
founding case is below, and it is the reason the seat created this file.

**EVERY COMMIT FROM THIS SEAT ENDS `Agent: audit`.**

**Created 2026-08-13.** Measured cause: in six hours the two agents made 68
commits to `docs/SEAT_INBOX.md` between them — median 40 lines, but the top of
the distribution ran to 864 — and two of those wholesale rewrites swept up the
other agent's finished work, once undoing ~26 files.

**They almost never collide in CODE.** The terminal lives in the rules engine,
the desktop in screens and flows; over four hours they overlapped on nothing
that mattered. **Every mess today came from ONE shared file.**

## THE RULE

- **`docs/SEAT_INBOX.md` is the SEAT's file.** You READ it. You may mark an item
  (`BLOCKED-BY:`, an owner line, a one-line status on the heading) — small edits,
  under 150 changed lines. **You may not rewrite, re-order, compress or archive
  it.** If it needs that, say so here and the seat does it.
- **THIS file is yours.** Findings, measurements, what you tried and backed out,
  what the next session should start on. Write freely — nobody else edits it.
- **The other agent's status file is READ-ONLY to you.** Read it before starting
  anything, so two of you never take the same item again (it happened on
  2026-08-13, R-073, eight minutes each).

## WHY IT IS NOT WORKTREES

Separate folders were considered and refused: they force a branch per agent and
a merge per session, and this project already carries 72 abandoned branches from
the last time that was tried. **One writer per file costs nothing and fixes the
thing that actually bit.**

---

## STATUS

### THREE OF THE ORPHAN REDS TEST **DEAD CODE** — their failures cannot reach an athlete

**Generalised the dead-engine finding across all 21 orphan reds: for each, does
its subject have a PRODUCTION caller?**

| suite | subject | production callers |
| --- | --- | --- |
| `injuryAdjustmentEngine` | `applyInjuryAdjustment` | **0** |
| `gameChangeCoachNotes` | `buildGameChangeCoachNoteConstraint` | **0** |
| `postGenerationConstraintValidation` | `validateProgramAgainstActiveConstraints` | **0** (used by 3 test files, no product file) |

**So three suites have been failing against functions the app never runs.** Their
reds are real as statements about the code and CANNOT REACH AN ATHLETE — which is
the single most useful thing to know before spending an hour on one, as I did.

**THE REST HAVE LIVE SUBJECTS** — `buildWorkoutsFromCoach` (7 callers) under four
suites, `buildCoachingPlan` (3) under two, `attachRecoveryAddonsToWeek` (3),
`EXERCISE_CUES` (6). **A red there is worth reading; a red in the three above is
archaeology.**

**⚠ AND MY CENSUS TRUNCATED A NAME AT 33 CHARACTERS, which nearly produced a fake
finding.** It printed `buildGameChangeCoachNoteConstrain`, I grepped the plural
`…Constraints`, and got ZERO MENTIONS ANYWHERE — a "0" that meant *the symbol does
not exist* rather than *nothing calls it*. **The real name is
`buildGameChangeCoachNoteConstraint`, singular, and its true count is also 0** —
so the finding survived, but only because I checked the zero instead of reporting
it. **Eleventh instrument fault today, and the second where a truncated string
produced a plausible number.**

**WHAT THIS COMPRESSES:** the remaining orphan triage no longer needs 21 deep
reads. **Three are dead-code archaeology, six were already classified as
layer-mismatch candidates, and the live-subject ones are where a real defect can
still be.**

### ✅ RESOLVED — `applyInjuryAdjustment` HAS **ZERO PRODUCTION CALLERS**. No athlete is affected, and my "confirmed defect" was wrong twice over.

**MEASURED, whole-repo:**

    applyInjuryAdjustment mentions:  19 in injuryAdjustmentEngineTests.ts (the orphan suite)
                                      1 in injuryAdjustmentEngine.ts (its own definition)
                                      0 anywhere else

**THE MODULE IS IMPORTED WIDELY — BUT ONLY FOR ITS HELPERS.**
`extractBodyPart` (`coachReadinessAdapter`, `CoachScreen`), `parseSeverityNumber`
(`injuryProgression`), the `InjuryBucket` type (`guidedInjuryControl`),
`pendingInjuryResolver`. **The ENGINE — `applyInjuryAdjustment` — is never
called.**

**AND IT IS SUPERSEDED ON PURPOSE.** `programAdjustmentEngine.ts:35` names the
plan in its own header: *"Wiring into CoachScreen, removal of the existing
injuryAdjustmentEngine…"*. **A successor exists; this one's entry point is dead
and its helpers were kept.**

**SO NO ATHLETE IS AFFECTED. My "CONFIRMED ATHLETE-FACING DEFECT" WAS WRONG TWICE
OVER:** not confirmed (the break sits in an application step the fixture itself
stubs), **and not reachable** (nothing calls the function in the first place).

**THE HONEST ACCOUNTING OF THAT MISTAKE.** I refuted five athlete-facing alarms
today with one habit — *run the real path before reporting*. On the sixth I was
more confident than on any of the five, and I skipped it. **Confidence was the
tell, and it pointed the wrong way.** The five I doubted, I checked; the one I was
sure of, I published.

**WHAT IS ACTUALLY WORTH HAVING, and it is real:**
- **A dead engine with a live orphan suite.** Six cells have failed for weeks
  against a function nothing calls — the `deriveMas`/`sessionSlotCoverage`
  built-and-disconnected class again, fifth costume today.
- **Its decision layer is PROVEN GOOD** (bucket, severity, band, rating, gate,
  the `else` branch) — so whoever finishes the successor can lift that logic
  knowing it was measured, not assumed.
- **The retirement its own successor already named is still owed.**

### ⚠ DOWNGRADING MY OWN "CONFIRMED DEFECT" — the break is in APPLYING the actions, and the FIXTURE STUBS THAT STEP

**I published this as a CONFIRMED athlete-facing defect one commit ago. The
evidence has moved and the claim must move with it.**

**WHAT THE EXTRA READ FOUND — the decision half is entirely sound:**

    injuryAdjustmentEngine.ts:334-365
      for (const name of removeNames) {
        if (replacement) { actions.push(replace_exercise); continue; }
        actions.push({ kind: 'remove_exercise', … });   <- THE ELSE EXISTS
      }

**I had suspected a missing `else` — a trigger with no replacement silently
dropped. There isn't one. Actions ARE built.** And
`injurySeverityAvoidsExactTriggers(3) === true`, so `removeNames` really does
carry RDLs.

**SO THE BREAK IS DOWNSTREAM: actions are decided, and APPLYING them yields
`changedDays: []`.** The reply says exactly that — *"I tried to adjust your week,
but no changes were applied"* — which is the engine reporting its own application
step returning nothing.

**⚠ AND THE FIXTURE STUBS THAT VERY STEP.** The suite monkey-patches
`resolveDateWithConditioning` with the comment *"what coachActions calls when
applying remove_exercise"*, and routes writes into a local `dateOverrides` map.
**So an incompletely stubbed APPLICATION path produces exactly the observed
symptom** — actions built, nothing applied, empty diff — with no product defect at
all.

**WHAT IS STILL TRUE AND WORTH KEEPING:** every INPUT is confirmed correct
(bucket, severity, band, rating, gate, live 7-day fixture, Monday not filtered as
past — `TODAY_ISO` and the Monday are the same date). **The decision layer is
proven good.** That is real progress and it is not withdrawn.

**WHAT IS NOT ESTABLISHED:** whether the application step is broken in the PRODUCT
or merely unstubbed in the TEST. **Those are opposite conclusions and I cannot
separate them from inside this suite.**

**THE ONE READ THAT SEPARATES THEM:** run the same message through the REAL
apply path — no stubs — on a real generated week holding an `avoid`-rated lift,
and see whether the exercise is removed. **That is the same "run the real
pipeline" step that refuted five alarms today, and I did not do it here before
publishing.**

### 🔴 CONFIRMED ATHLETE-FACING DEFECT — a mild injury report changes NOTHING and the app APOLOGISES for it

**The first genuine athlete-facing defect confirmed today, and the evidence chain
is complete. Every link measured, not inferred.**

An athlete types **"hammy hurts 3/10"** on a week whose Monday holds `RDLs` and
`Back Squat`:

| link | measured | verdict |
| --- | --- | --- |
| parse | `bucket: 'hamstring'`, `severity: 3` | ✅ correct |
| band | `avoid_trigger_1_3` | ✅ correct |
| engine rule | band 1-3 removes `avoidNames` (`injuryAdjustmentEngine.ts:327-332`) | ✅ present |
| rating | `classifyExerciseRiskForBucket('RDLs','hamstring',3)` → **`avoid`** | ✅ correct |
| control | `Back Squat` → `caution` (must REMAIN) | ✅ correct |
| fixture | stub called, **7 days**, RDLs present | ✅ live, not a dead fixture |
| **result** | **`changedDays: []`** | 🔴 **nothing removed** |

**AND THE ATHLETE IS TOLD SO:**

> *"I tried to adjust your week, but no changes were applied. Check the Program
> tab and try again."*

**So it is not silent — it is an apology.** An athlete reporting a sore hamstring
gets an error message and an unchanged week with the exact lift that hurts still
in it.

**WHY IT SURVIVED: `test:injury-engine` HAS AN NPM SCRIPT AND IS NOT IN
`test:bible`.** Six cells have been failing on this, unrun, for weeks. **Same
disease as the 50 orphans — this is what the orphan census was for.**

**NOT FIXED TONIGHT AND DELIBERATELY SO.** The break is between "the rule says
remove RDLs" and "the diff is empty", inside `applyInjuryAdjustment` — every
input is confirmed good, so the fault is in the action-building or diff step. That
is a real change to an engine I did not write, at the end of a very long session,
and today has twice shown what forcing one costs. **The chain above is the
handover: the next session starts at `injuryAdjustmentEngine.ts:334` (the
`removeNames` loop) with every precondition already proven.**

### ⚠ THE STRONGEST OPEN CANDIDATE OF THE DAY — `avoid_trigger_1_3` may not avoid the trigger. **NOT CONCLUDED.**

**`test:injury-engine` (`injuryAdjustmentEngineTests`) is RED, 6 failures, and it
is NOT in `test:bible`** — it has a script and the chain never runs it, so this
has been invisible.

**THE CASE:** *"hammy hurts 3/10"* over a Monday holding `RDLs` + `Back Squat`.
The suite asserts **RDLs removed, Back Squat kept**. `fired = true` PASSES —
the engine runs — **and no Monday change is produced.**

**WHY THIS IS DIFFERENT FROM THE FIVE ALARMS I REFUTED TODAY: the band's own NAME
is the specification.** Measured:

    severity 3 -> band = 'avoid_trigger_1_3'   removesRiskyWork = false
    severity 5 -> band = 'reduce_affected_4_5' removesRiskyWork = false
    severity 6 -> band = 'restrict_and_refer_6_7' removesRiskyWork = TRUE

**`removesRiskyWork = false` at 3 is CORRECT** — that is the GENERIC risky-work
rule and it belongs to bands 6-10. **But the 1-3 band is literally called
`avoid_trigger`, and the suite is asserting exactly that: avoid the TRIGGER, keep
everything else.** Those are two different rules and only one of them is measured.

**WHAT IS MEASURED:** the band is real and READ in at least five places
(`guidedInjuryControl` ×2, `generationConstraints:464` → `'Mild'`,
`injuryProgression`, `recoveryAddonCoverage` ×2). **It is not dead.**

**WHAT IS NOT MEASURED, AND IS THE WHOLE QUESTION:** does anything act on
`avoid_trigger_1_3` by REMOVING THE NAMED TRIGGER EXERCISE from a built week? If
not, a mild injury changes labels and doses but leaves the offending lift in the
session.

**NEXT STEP, ONE READ:** follow `applyInjuryAdjustment` for a Mild band and see
whether an exact-trigger exercise is dropped. **If it is not, this is the first
genuine athlete-facing defect of the day** — and the reason it survived is that
its suite is not in the chain.

### ✅ THE "FAILS OPEN" CONCERN IS **REFUTED** — there are TWO injury mechanisms, and the untagged 34 are covered by the other one

**THE CENSUS, done properly this time.** My first attempt imported
`EXERCISE_POOLS`, which **does not exist** — the pools are separate exports
(`BICEPS_POOL`, `GROIN_ADDUCTORS_POOL`, …), so the walk returned zero and *"0
untagged"* was void. **Corrected instrument: 14 arrays, 90 distinct pooled
exercises, 34 with no `EXERCISE_TAGS` entry.**

**AND THE 34 ARE NOT UNPROTECTED. THERE IS A SECOND MECHANISM AT A DIFFERENT
LAYER:**

    exercisePools.ts:309   ex('jefferson-curl', 'Jefferson Curl', … ['lower_back','hamstring','neck'])
    sessionBuilder.ts:408  if (ex.contraindications.some(c => injuryTags.has(c))) return false;

**The pool entry carries its own contraindications and the SELECTOR reads them —
refusing the exercise before it is ever chosen.** Spot-checked across the
loadable ones, which is where risk actually lives:

| exercise | pool contraindications |
| --- | --- |
| Jefferson Curl | `lower_back, hamstring, neck` |
| Dead Hang | `shoulder, elbow` |
| ATG Split Squat | `knee, hip` |
| Dumbbell Pullovers | `shoulder, ribs` |
| Adductor Rockback | `groin` |

**SO MY OWN "SILENT SAFETY GAP" FRAMING WAS WRONG.** `injuryWorkoutFilter` fails
open on `'unknown'` — that part is true and traced. **But it is the FILTER over an
already-built week, not the only guard.** The SELECTOR refuses contraindicated
exercises at the point of choosing, using a field the tags map never held.
**Two mechanisms, two layers, and I had measured one and described the system.**

**SIXTH SIGHTING OF THE LAYER LESSON TODAY — and the fourth time it has turned an
athlete-facing alarm into a non-event.** The remaining 30 untagged are stretches,
breathing and foam rolling, where a caution is arguably unnecessary anyway.

**WHAT IS ACTUALLY LEFT:** a documentation question, not a defect. Two injury
mechanisms exist and neither names the other. **That is worth a line in whichever
file a future reader opens first — not a fix.**

### ⚠ THE INJURY FILTER FAILS **OPEN** ON AN UNTAGGED EXERCISE — traced end to end, and the population is UNMEASURED

**Traced from the one real red to the behaviour, three hops, each read not
inferred:**

    injuryExerciseRisk.ts:21     if (!tags) return 'unknown';
    injuryWorkoutFilter.ts:187   return r === 'avoid' || r === 'caution';
    injuryWorkoutFilter.ts:223   isRisky = r === 'avoid' || (removeCaution && r === 'caution');

**`'unknown'` IS NOT RISKY, SO AN UNTAGGED EXERCISE IS ALLOWED THROUGH THE INJURY
FILTER — for every injury, at every severity.** The gap is not in the filter's
logic; it is that a MISSING TAG and a SAFE TAG are indistinguishable to it.

**THIS IS A DEFENSIBLE DESIGN, AND THAT IS EXACTLY WHY IT IS WORTH NAMING.**
*"Refuse only what you can PROVE is impossible"* is the same doctrine the
equipment filter states in its own comment, and it is right there — it stops the
app inventing restrictions from ignorance. **The cost is that a DATA GAP becomes a
SILENT SAFETY GAP: nothing reds, nothing warns, the exercise simply passes.**

**ONE CONFIRMED CASE: `Adductor Rockback`** — prescribed by
`recoveryAddonCoverage.ts:171`, carried in `exercisePools.ts:294`, and
`getExerciseTags` returns `undefined` for it. **For this exercise the effect is
probably harmless or correct** — it is a groin OPENER prescribed FOR groin
recovery — **but it reaches the athlete through a filter that never looked.**

**⚠ HOW MANY OTHERS: UNMEASURED, AND MY ATTEMPT WAS VOID.** My census walked
`EXERCISE_POOLS` and returned ZERO names — wrong shape — so *"0 untagged"* was a
statement about a set that excluded the very exercise that prompted it.
**A correct census is the one thing owed here**, and it is worth more than the
single case: **the question is not "is Adductor Rockback safe", it is "how many
prescribed exercises does the injury filter never look at".**

### `recoveryContentIntegrity` 3 reds — TWO ARE COSMETIC, ONE IS A REAL DATA GAP, and my census of it was a DEAD INSTRUMENT

**Followed my own map to the pure-unit suites, where a genuine defect was most
likely. It found one, and it is small.**

**TWO OF THE THREE ARE COSMETIC — the real reader already handles them.**
The cells compare against `EXERCISE_TAGS` directly and fail on CASE:
*expected "Copenhagen Plank (Half)", got "Copenhagen plank (half)"*. But
`getExerciseTags` **CANONICALISES FIRST** (fixed today), and measured through the
real reader **both spellings return `groin=caution`**. No safety gap. The cells
read the raw map where the app reads through a normaliser — **the layer lesson
again, this time on DATA rather than on a pipeline.**

**ONE IS REAL: `Adductor Rockback` HAS NO TAG ENTRY.** Confirmed twice through
`getExerciseTags` — `UNDEFINED`. It IS prescribed: `recoveryAddonCoverage.ts:171`
lists it as a groin recovery exercise and `exercisePools.ts:294` carries it as a
*"Groin opener"*. **Anything reading tags for it — movement, load, injury caution
— gets nothing.**

**⚠ WHETHER THAT COSTS AN ATHLETE IS UNMEASURED AND I AM NOT GUESSING.** It is a
groin OPENER prescribed FOR groin recovery, so an absent groin caution may be
harmless or even correct. **That needs the injury filter read, not inferred.**

**⚠ AND MY CENSUS OF HOW WIDESPREAD IT IS WAS A DEAD INSTRUMENT — number VOID.**
I reported *"86 pooled exercises, 0 untagged"*. Re-probed: my walk over
`EXERCISE_POOLS` returns **ZERO names** — its shape is not `{name}` objects, so
the census never reached the recovery/prehab pools at all. **The 86 came entirely
from `STRENGTH_POOLS`, and "0 untagged" is a statement about a set that excludes
the very exercise that prompted it.**

**TENTH INSTRUMENT FAULT OF THE SESSION, same shape as the other nine:** a
confident number from a scan that did not reach its subject. **Caught because the
count contradicted a direct probe I had already run** — two measurements
disagreeing is the cheapest defect detector I have used all day.

### THE 21 REDS, CLASSIFIED IN ONE PASS — and the last athlete-facing candidate is REFUTED

**At the fourth layer-mismatch I stopped diagnosing one at a time and classified
all 21 by WHICH LAYER THEY DRIVE:**

| drives | count | reading |
| --- | --- | --- |
| DIRECT BUILDER only | **6** | `beginnerDeterministicProgram`, `byeWeekClassification`, `offseasonSubphaseConditioningIntegration`, `phaseRepPrescription`, `programmingBias`, `teamTrainingRendering` — **mis-aim candidates** |
| BOTH | 2 | `generationConstraintReentry` (diagnosed: safe), `sprintExposureGate` |
| REAL PIPELINE only | **1** | `recoveryAddonAttachment` — **the highest-signal one, so I took it** |
| pure unit (neither) | 11 | a red here is a unit defect or a stale expectation, not a layer mismatch |

**THE REAL-PIPELINE ONE IS REFUTED, AND IT WAS THE ONE MOST LIKELY TO BE REAL.**
*"generated week receives visible recovery add-ons"* fails because
`workout.recoveryAddons` is **0 in every phase** — Pre-season, Off-season,
In-season. That looks exactly like athletes losing their prehab.

**THEY ARE NOT. IT MOVED.** Measured on a real Pre-season week:

    Prehab & Accessories: Long-Lever Copenhagen, Band Pull-Apart, Seated Calf Raise
    Lower Hinge:          Pallof Press

**Prehab is a ROW IN THE SESSION LIST, which is the Bible's own design** —
*"The session is ONE list… every exercise renders in the single session list
carrying a role badge: power, main lift, accessory, midline, prehab,
conditioning."* `recoveryAddons` is the RETIRED separate-box mechanism, and it is
empty because the box no longer exists.

**FIFTH TIME TODAY a red cell was measuring a mechanism the app has retired.**
And the second time in an hour that a zero which looked like loss was a MOVE.

**WHAT THE MAP IS WORTH:** the next agent does not open 21 suites blind. The 6
direct-builder ones are mis-aim candidates before they are read; the 11 pure-unit
ones are where a genuine defect is most likely to be hiding, because nothing
about them is layer-confused.

### ✅ INJURY SAFETY IS INTACT — `generationConstraintReentry` 13/6 is the LAYER MISMATCH again, and this was the highest-stakes case

**Six failures, all injury/readiness — hamstring, shoulder, knee, low readiness,
sick recovery. The highest-stakes thing I have touched today.**

**THE TWO LAYERS IN ONE SUITE, AND THEY DISAGREE ON PURPOSE:**

| cells | drive | result |
| --- | --- | --- |
| the 6 FAILING | `planFor()` → **`buildCoachingPlan`** — the SLOT ALLOCATION layer | plan still names *"20 m Acceleration Reps"* for a 4/10 hamstring |
| the PASSING injury cells | **`generateProgramLocally`** — the real pipeline | *"hamstring generated workouts avoid Nordics/heavy hinge/sprint"* is **GREEN** at severity 6 |

**SO THE ATHLETE IS SAFE, MEASURED, NOT ASSUMED.** The real generator does not
give an injured athlete sprint or heavy hinge work. The allocation layer names a
session FOCUS; the generator then fills that slot with exercises the injury
permits. **The constraint is applied where exercises are chosen, which is the
only place it can be applied.**

**WHAT IS LEFT IS A DESIGN QUESTION, NOT A SAFETY DEFECT:** should the PLAN layer
also stop naming a sprint focus it knows will be filled safely? Arguable either
way, and **not something to answer from a stale suite** — this one is from July
and its cells assert exercise-level avoidance against a layer that does not
choose exercises.

**FOURTH SIGHTING OF THE LAYER MISMATCH TODAY, and the one where it mattered
most.** Had I read six red injury cells and reported them, that would have been a
safety alarm raised on a suite measuring the wrong layer — after I had already
retracted one athlete-facing claim today. **The lesson I wrote into memory one
commit ago is what made this a ten-minute check instead of an incident.**

### ✅ THE SUBPHASE CONCERN IS **REFUTED** — the real generator walks Sam's ladder exactly

**The probe I named one commit ago, run:**

    week 1: Back Squat 3x8-12   <- early
    week 2: Back Squat 3x8-12   <- early
    week 3: Back Squat 3x6-10   <- MID, the bridge
    week 4: Back Squat 4x6-10   <- mid

**Weeks 1-2 early, weeks 3-4 the 6-10 bridge. That is Sam's ladder
(`early_offseason` 1-2, `mid_offseason` 3-4) working end to end.** No athlete is
getting early dosing in mid off-season, and the load multiplier question is void
with it.

**SO `phaseRepPrescription`'s 9 failures are a MIS-AIMED CELL, not a defect.** It
calls `buildWorkoutsFromCoach` DIRECTLY with `{ miniCycleNumber: 1,
weekInBlock: 3 }` and no `offseasonSubphase`; **the real generator supplies it,
and the direct caller does not.** The suite is asserting a pipeline property
against one builder — the same shape as the conditioning-floor cell, and the
THIRD time today that distinction has been the whole answer.

**AND THIS IS THE POINT OF NOT CLAIMING IT.** One commit ago I had every
ingredient of a confident, athlete-facing bug report: the rules module measured
correct, the observed output measured wrong, and a real cost to name. **I wrote it
up as unproven and named the one probe that would settle it.** The probe settled
it the other way in under a minute. **Had I reported it as a defect — as I did
this afternoon with the conditioning floor — that would have been the second
retraction of the day.**

**LEFT AS FOUND.** The cell is mis-aimed and it is not mine to re-point: fixing it
means threading `offseasonSubphase` into a direct-call fixture in a suite I did
not write, and the honest repair is the same one the conditioning cell got —
assert what the BUILDER owns, and leave the ladder to the pipeline that owns it.

### `phaseRepPrescription` 12/9 — THE RULES ARE CORRECT; THE SUBPHASE IS NOT REACHING THEM. **ATHLETE-FACING IF IT REPRODUCES, AND I HAVE NOT PROVEN THAT.**

**MEASURED DIRECTLY — `OFFSEASON_SUBPHASE_MAIN_LIFT_REP_SCHEMES` is right:**

    early_offseason   base 3x10  reps 8-12  "Early off-season body-armour work"
    mid_offseason     base 3x8   reps 6-10  "Mid off-season bridge work"
    late_offseason    base 3x8   reps 6-8   "Late off-season strength work"

**`mid_offseason` returns exactly what the failing cell asks for** — *"a 6-10
bridge prescription"*. The rules module is not the defect.

**BUT THE CELL DRIVES `buildWorkoutsFromCoach` WITH `weekInBlock: 3` AND GETS THE
EARLY SCHEME** — `3 x 8-12`, *"Early off-season body-armour work"*, load
multiplier 0.75 instead of 0.9. **The subphase is not reaching the schemes.**

**WHAT THAT WOULD COST AN ATHLETE IF IT REPRODUCES IN THE APP:** a mid-off-season
lifter gets early-off-season dosing — lighter load, higher reps — for the whole
block. **Sam's own ladder (`early` weeks 1-2, `mid` 3-4) would be inert.**

**⚠ AND I AM NOT CALLING IT A LIVE DEFECT, BECAUSE I HAVE NOT MEASURED THE REAL
PIPELINE.** The cell calls the builder DIRECTLY with `{ miniCycleNumber: 1,
weekInBlock: 3 }` and no explicit `offseasonSubphase`. **The real generator may
pass the subphase explicitly, in which case this is a mis-aimed cell** — the exact
shape of the conditioning-floor cell I over-claimed on this afternoon and had to
correct. **Twice is enough.**

**THE NEXT STEP IS ONE PROBE:** generate a real off-season week at block week 3
and read the prescribed reps. **If they are 8-12, it is athlete-facing. If 6-10,
the cell is mis-aimed and needs the subphase threading its own inputs already
have.** Not run here; named so it starts from a measurement rather than a hunch.

### THE RECEIPT SWEEP STOPS AT TWO — THE OTHER NINE **CANNOT BE CHECKED THIS WAY**, and my comparison was the wrong unit

**Two receipts were genuinely stale and are corrected:**
- `LAW-totals-or-red` — *"175 suites"* → **244** (measured: files calling
  `armTotalsOrRed`).
- `LAW-rulings-are-machine-held` — *"11 of 70"* → **14 of 81** (measured: `R-`
  rows and `UNENFORCED` rows in `RULINGS_REGISTRY.md`).

**Both cite a DIRECTLY COUNTABLE quantity, which is why they were checkable.**

**⚠ THE OTHER NINE ARE NOT, AND MY SWEEP PRODUCED NONSENSE BEFORE I CAUGHT IT.**
I compared each row's *"N cells"* against its suite's PASS COUNT:

| row | claims | suite total |
| --- | --- | --- |
| `LAW-inbox-order-is-content` | 21 cells | 39 |
| `LAW-away-is-an-equipment-answer` | 21 cells | 49 |
| `LAW-stop-needs-an-exit` | 25, 36 cells | 39 |

**Those are not drifts.** *"21 cells"* means **the cells THAT UNIT ADDED**; the
suite's total is every cell it has ever held. **The two numbers were never
supposed to match**, and "correcting" them would have overwritten true statements
with a number measuring something else entirely.

**`a-count-taken-for-a-record`, NINTH SIGHTING TODAY, and mine again** — the
comparison's unit has to be the claim's unit. A contribution count is not
recoverable from a total, so **these nine are unverifiable by any cheap method
and I am not touching them.**

**RECORDED SO NOBODY "FIXES" THEM.** The obvious next move for a reader who sees
`21 cells` beside a suite reporting 39 is to update the row. **That would be
wrong, and it would look like diligence** — which is exactly how a correct
statement becomes a false one.

### ✅ 40 UNARMED → **ONE**. I RECONSIDERED MY OWN "HANDED OVER, NOT SWEPT" AND THE RECONSIDERATION WAS RIGHT.

**Twenty minutes ago I wrote that the last nine were a handover, not a sweep, and
gave three measured reasons. One of the three was wrong.**

My reason was: *"these nine differ from my 31 — the counter is an array, not an
integer — and generalising again would repeat the mistake."* **But my mistake an
hour ago was applying ONE shape BLINDLY. Handling a KNOWN SECOND shape
EXPLICITLY, with the same before/after protocol, is not the same act.** Having
measured the shapes, I had exactly what I lacked when the five went red.

**EIGHT OF THE NINE ARMED.** `failures.length` for the seven array-shaped suites,
`failed` for the two integer ones — the counter chosen per file, not inferred.

**VERIFIED, and the mutation is the half that counts:**
- exit codes captured for all 9 BEFORE, re-run after, `diff` **IDENTICAL**
  (5 green / 4 already-red, unchanged either side);
- **three mutated — clear removed, each exits 1.** The arm fires.

**THE LAW NOW NAMES SIX FILES, DOWN FROM FORTY:**
- **`maestroElementContract` — the one still unarmed, and it CANNOT be armed as
  wiring.** It has no totals line and no failure counter at all. **Giving it
  something true to say is AUTHORING**, and that reason survived the
  reconsideration intact.
- **Five promise-chained suites** whose `process.exit(0)` is LOAD-BEARING —
  measured by removing it and watching all five go red, then reverting.

**WHAT I GOT WRONG AND WHY IT MATTERS:** a correct lesson can be over-applied.
*"Do not generalise a shape"* became *"do not touch anything unfamiliar"*, which
would have left 8 suites unprotected on the strength of a caution rather than a
measurement. **The protocol was the thing that made it safe, not the familiarity.**

### THE LAST 9 UNARMED SUITES — ANCHORS MEASURED AND HANDED OVER, **NOT SWEPT**

**None of the nine are mine.** All predate today; my 31 are done. Recording the
per-file anchors so the owner does not re-derive them:

| suite | failure counter | totals line |
| --- | --- | --- |
| `approvedIconOwnership` | `let failed = 0` | 203 |
| `devE2ECoordinator` | `const failures: string[]` | 444 |
| `devE2EEntryBoundary` | `const failures: string[]` | 198 |
| `devE2EScenarioSession` | `const failures: string[]` | 600 |
| `devE2ESeedRegistry` | `const failures: string[]` | 296 |
| `devE2EWitness` | `const failures: string[]` | 166 |
| `durableWriteNeverSilent` | `const failures: string[]` | 67 |
| **`maestroElementContract`** | **NONE FOUND** | **NONE** |
| `sessionOutcomeParity` | `let failed = 0` | 1092 |

**WHY THIS IS A HANDOVER AND NOT A SWEEP — three measured reasons, not caution:**
1. **Seven of nine count failures in an ARRAY (`failures: string[]`), not a
   number.** `totalsPrinted` takes a COUNT, so each needs `failures.length` —
   a different call from the 31 I armed, and one my pass would have got wrong.
2. **`maestroElementContract` has NO totals line and NO counter at all.** It
   cannot be armed without first giving it something true to say. That is
   authoring, not wiring.
3. **FOUR OF THE NINE ARE ALREADY RED** (`devE2EScenarioSession`,
   `devE2ESeedRegistry`, `maestroElementContract`, `sessionOutcomeParity`).
   Arming a red suite is safe, but touching four failing suites I did not write,
   at the end of a long session, is how five went red an hour ago.

**THE PRECEDENT IS TODAY'S OWN.** I removed a line the law told me to remove
across eight files; five broke because the shape differed from the one I had
generalised from. **These nine differ from my 31 in exactly that way — the
counter is an array, not an integer.**

### `teamTrainingRenderingTests` 28/3 — ONE CANDIDATE ELIMINATED, TRIAGE OPEN

Three failures: *"combined fallback keeps strength rows"* (a
`Team Training + Upper Push` day builds **zero** exercises), *"team training still
exposes explicit log button"*, and *"startFinished is ignored for Team Training"*.

**THE OBVIOUS CANDIDATE IS ELIMINATED, AND ONLY BY READING ITS CODE RATHER THAN
ITS TITLE.** `ddebf7ed` landed an equipment filter on the authored fallback
templates TODAY, which would explain an empty day. It does not:
- its own code is `if (!availableEquipment?.length) return authored;` — **an
  athlete with no kit recorded gets the UNFILTERED list**, and this fixture
  declares none;
- and it was **REVERTED an hour later by its own author** (`acdb1871`,
  *"MY OWN FILTER TRADED ONE DEFECT FOR TWO"*). `authoredFallbackExercisesForPlanEntry`
  is not at `HEAD` and not in the tree.

**So the empty combined day is NOT today's equipment work.** Triage is open, and
the three failures may not share a cause — the other two are about a log button
and `startFinished`, which is a rendering/interaction concern, not generation.

**NOT FIXED, AND THAT IS A DELIBERATE STOP.** Half an hour ago I removed a line
the law told me to remove, in eight files, and five went red. **The lesson landed:
at the end of a long session, an unforced diagnosis beats a forced fix.** This one
gets a clean starting position instead of a guess.

### THE `process.exit(0)` BYPASS — 3 REMOVED, **5 REVERTED**, AND THE LAW'S OWN REMEDY IS WRONG FOR ASYNC SUITES

`test:totals-or-red-law` says of the bypass: *"Delete the call — `totalsPrinted()`
already set the code from the report."* **That is true for a SYNCHRONOUS suite and
FALSE for a promise-chained one.**

**MEASURED, before/after, all 8:**

| | |
| --- | --- |
| removed and still green | **3** — `coachCommandExecutorRiskGate`, `coachWeekDiff`, `deloadCoachNotes` |
| removed and **WENT RED** | **5** — the `llmSemantic*` and `semantic*` pair-groups |

**ALL FIVE REVERTED, all five green again.** Their `process.exit(0)` sits inside a
`.then()` of a promise chain with a `.catch()` after it; **deleting it lets the
chain continue past the report**, and the suite exits non-zero. **The call is
LOAD-BEARING there — it is not the lazy bypass the law assumes.**

**THE PROTOCOL IS WHAT SAVED THIS.** Exit codes captured for all 8 BEFORE, the
edit applied with a per-file assert, then all 8 re-run and `diff`ed. **The diff
showed 5 regressions in one line.** Without the before-capture I would have
committed five red suites into `test:bible` on a "the law told me to" argument.

**SO THE LAW HAS A GAP, NAMED NOT FIXED:** its remedy is unconditional and its
detection is a regex over source. **A suite whose report is inside a promise
callback needs `process.exit(0)` to stop the chain, and the honest fix is either
`return` from the callback or an `await`-shaped rewrite — a real change to five
suites I did not write.** Not mine to make on someone else's async control flow at
the end of a long session. **Five bypasses remain, and they remain for a reason
that is now written down instead of being rediscovered.**

### THE TOTALS-OR-RED DEBT IS PAID DOWN — 40 UNARMED → 13, AND MY OWN GUARD CAUGHT MY OWN BYPASS

**27 suites armed** (`armTotalsOrRed()` + `totalsPrinted(fail)`), every one of them
a suite I wired into the chain today and therefore my debt.

**THE PROTOCOL, because a 27-file mechanical edit is how I deleted six orders this
morning:** exit code captured for all 29 BEFORE, the edit applied with a
per-file assert that refused to write if the anchor was missing (4 files skipped
and NAMED rather than guessed at), then all 29 re-run and `diff`ed.
**Identical, 29 green before and after.**

**MUTATION-PROVEN ON THREE OF THEM:** delete the `totalsPrinted` clear and each
exits **1**. The arm fires on exactly its founding case — a suite that reaches the
end without reporting.

**⚠ AND THE LAW THEN CAUGHT ME ON A SECOND CELL I HAD NOT LOOKED AT.** *"No suite
can un-arm itself with `process.exit(0)`"* — and it named
**`unrunnableSuiteRatchetTests` and `coachPhraseHandlerRatchetTests`, both written
by me this morning.** Both had `process.exit(0)` in their `--update` branch.
**That call writes the exit code DIRECTLY and hard-overrides the arm, so a crash
on the way to that line would still have exited 0** — the exact defect the law
exists for, inside the two guards I built to enforce discipline. Restructured to
an `else` branch clearing through `totalsPrinted(0)`; `--update` still works and
both are clear.

**WHAT REMAINS, and the split is honest:**
- **13 unarmed.** FOUR are mine to finish — `coachInterpretationReceipt`,
  `coachPlan`, `coachWeekDiff` (no top-level import anchor) and
  `injuryReintroduction` (no `fail` variable). **Skipped by the assert, not missed.**
- **NINE ARE NOT MINE** and predate today: `approvedIconOwnership`, the five
  `devE2E*`, `durableWriteNeverSilent`, `maestroElementContract`,
  `sessionOutcomeParity`.
- **NINE `process.exit(0)` BYPASSES REMAIN**, all in suites I WIRED but did not
  write. **My wiring brought them into the law's scope** — the debt is mine to
  report even where the code is not.

### ⚠ MY ORPHAN PAYDOWN MADE ANOTHER LAW'S RED **BIGGER** — 24 unarmed suites, and I own them

**`test:totals-or-red-law` is IN THE CHAIN and RED (1 passed, 3 failed).** It
names **40 suites in `test:bible` with no arm** — *"they exit 0 on a drained loop
and the chain calls that green"*. **TWENTY-FOUR OF THE 40 ARE SUITES I WIRED IN
TODAY.**

**SO THE PAYDOWN HAS A COST I DID NOT PRICE.** Every suite I moved from
"unrunnable" to "in the chain" arrived UNARMED, and an unarmed suite in the chain
is the exact defect this law exists for: `onboardingReliabilityTests` exited 0
half-run for three days inside `test:bible` while a registry pin ran on no branch
at all. **I reduced one debt by 29 and increased another by 24, and only noticed
because I ran the law that measures it.**

**PAID SO FAR: the two suites I AUTHORED** — `coachPhraseHandlerRatchetTests` and
`unrunnableSuiteRatchetTests`. Two lines each (`armTotalsOrRed()` at module top,
`totalsPrinted(fail)` after the totals line). **MUTATION-PROVEN: made the suite
drain early without printing totals and the process exits 1** — the arm fires on
exactly the founding case. Both still green, restored byte-identical after.

**OWED: the other 22 I wired.** The recipe is mechanical and is in
`src/__tests__/support/totalsOrRed.ts`. **NOT done in one bulk pass, deliberately
— four different totals formats exist in this repo** (`N passed, N failed`,
`Pass: N`, `— Summary —`, `… tests failed: N`), so a scripted insert would have to
infer the failure variable per file. **A 22-file bulk edit at the end of a long
session is precisely the condition under which I deleted six orders this
morning.** One at a time, each verified, next session.

**AND THE FOUR FORMATS ARE THEMSELVES THE FINDING.** They are why my batch runner
reported "no totals" three separate times today on suites that were reporting
fine. **The exit code is the only dependable verdict in this repo**, which is
exactly what this law is trying to make true.

### ⚠ THE WORKING TREE IS TRANSIENTLY BROKEN BY A LIVE `readiness` → `capacity` RENAME. **`main` IS SAFE.**

**MEASURED, and the distinction is the whole point:**

| | |
| --- | --- |
| `HEAD`'s `coachingEngine.ts:1026` | `…readiness })` — consistent, **`main` is intact** |
| working tree | `…capacity })` with the producer half-renamed → **`ReferenceError: capacity is not defined` inside `buildCoachingPlan`** |
| `coachingEngine.ts` | **HELD-BY-OTHER, +29/−29, uncommitted** |

**SO NO SUITE THAT DRIVES THE GENERATOR CAN RUN RIGHT NOW** — `test:role-buckets`,
`test:power-primer-policy` and `programmingBiasTests` all crash at import against
the tree. **They are green at `HEAD`; nothing has regressed for an athlete.**

**IT IS A NINE-FILE RENAME, NOT A FOUR-CALL-SITE ONE.** I told `pace` "rename the
four call sites in the same commit" and **that advice was wrong** — they measured
it and corrected me: seven types across product AND test scope
(`ScheduleState`, `Section18ContractV2Input`, `OffseasonSubphasePolicyContext`,
`PreseasonSubphasePolicyContext`, `PowerPrimerContext`, `ScheduleDebugPanel`,
plus `CoachingPlan.readiness` in `rulesKernelTests`, `weekPlanQA`,
`buildSlice3Trace`, `buildPreseasonExposureWitness`). **Landing my version would
have left the chain red in product scope regardless.**

**AND IT IS NOT `pace`'s.** They have never committed `powerPrimerPolicy.ts`;
`git status` showed it to them only because one checkout shows four seats' work as
if it were yours. **Sixth mis-route to them today.**

**MY PAYDOWN IS BLOCKED UNTIL THE RENAME LANDS, AND I AM STAYING OUT.** Reaching
into a live multi-file rename is precisely how four absorptions happened today.
**The suites I wired in are unaffected in substance** — the rename's owner has
already updated my four call sites to `capacity:`, which is the right name and
matches the file's own doctrine (*"CAPACITY IS A DOSE, NOT A GATE"*).

**THE TRANSFERABLE PART: a green suite and a red gate from one field name.**
`powerPrimerPolicyTests` ran 58/0 while `tsc` failed, because sucrase strips
types. **Runtime green is not gate green**, and today that split has cost every
seat at least once.

### `programmingBiasTests` 40/2 — TWO PERSONALISATION FEATURES PRODUCE IDENTICAL OUTPUT. **UNRESOLVED, AND SAID SO.**

**THE FAILURES, through the REAL path** (`planFor` → `onboardingToCoachingInputs`
→ `buildCoachingPlan`):

    inside midfielder vs outside runner   inside=vo2,aerobic_base,aerobic_base,aerobic_base
                                          outside=vo2,aerobic_base,aerobic_base,aerobic_base
    neutral vs strength/size nudge        neutral=primer,primer,primer,primer
                                          size=primer,primer,primer,primer

**Byte-identical both times. Two features that personalise nothing.**

**WHAT IS MEASURED AND HOLDS:**
- The producer DOES populate `conditioningCategoryPreference`
  (`programmingBias.ts:308-320`, goal-driven).
- The engine DOES read it, and ONLY when the week has no team days
  (`coachingEngine.ts:2775`) — *"a profile preference must not reshuffle the
  fragile gym structure"* around an anchor.
- **The fixture sets `teamTrainingDaysPerWeek: 0` and `teamTrainingDays: []`**,
  so that guard is satisfied and the bias SHOULD reach `categoryPriority`.

**SO IT SHOULD DIFFER AND DOES NOT, AND I HAVE NOT FOUND WHY.** Untested next
candidates, in order: `useCategoryPlanner` false for this phase (the bias is only
applied inside that branch), or `applyConditioningCategoryBias` re-ordering
nothing because the preference is empty for these particular profiles.

**⚠ AND MY OWN PROBE WAS WRONG — ITS RESULT PROVES NOTHING AND IS DISCARDED.**
I called `computeProgrammingBias({ position })` and got `pref={}` for both roles,
which looked like a smoking gun. **The function takes `role`, not `position`**
(`:249` destructures `{ role, goals, phase, isBeginner }`), so `role` was
`undefined` and the empty result is an artefact of my input, not a finding. The
real path maps position → role through `roleBuckets`. **A probe that passes the
wrong field returns a confident answer about nothing** — fourth instrument fault
of the session, and the second where the wrongness was invisible in the output.

**NOT FIXED, NOT WIRED, NOT RE-POINTED.** The cells are asserting a real product
claim (two positions should train differently) and there is no evidence yet that
the claim is retired. **Re-pointing them would be the wholesale move I refused on
`byeWeekClassification` an hour ago.** Next session starts at
`useCategoryPlanner`.

### TRIAGE STARTED ON THE 25 REDS — AND THE WORST ONE IS PARTLY A **STALE SUITE**, NOT A DEFECT

`byeWeekClassificationTests` (40 passed / **23 failed**, the worst of the 25) —
**last touched 2026-07-30**, two weeks and many rulings ago.

**THREE OF THE 23 ARE EXPLAINED AND THEY ARE NOT A DEFECT.** The trio
*"N team trainings: sprint/COD floor comes from anchors or one app exposure"*
asserts `sprintCodExposures === Math.max(1, teamTrainingsPerWeek)` — an EXACT
equality — and gets **3 where it expects 2**. `git log -S sprintCodExposures`
names the cause: **`05e609af`, TODAY, `pace`'s census C4** — *"the sprint floor
gets the exemption its own sentence advertised"*. **Item 40 records C4 as BUILT
and CLOSED, so the change is deliberate and the suite is asserting the world
before it.**

**⚠ R-079 WAS MY FIRST CANDIDATE AND I DROPPED IT ON THE ARITHMETIC.** Sam ruled
today that in-season *"may mean 3 sprint sessions"*, which fits `actual: 3`
suspiciously well — but R-079's build counts NIGHTS rather than exposures, and
nights ≤ exposures, so it pushes the number DOWN, not up to 3. **A candidate that
fits the number is not a cause; `git log -S` on the counter is.**

**THE OTHER 20 FAILURES ARE UNTRIAGED** and they are not all one cause — they
span Saturday allocation (*"explicitly strength-only"*, *"counts as lower strength
only"*), conditioning wording on a resolved Saturday, and QA snapshot labels.
**Named as untriaged rather than swept into the sprint explanation.**

**⚠ THE DANGER, AND IT IS WHY THIS IS WRITTEN DOWN RATHER THAN FIXED:** the
tempting move is to re-point all 23 assertions until the suite is green. **Three
of them SHOULD be re-pointed; the other twenty are unexamined, and re-pointing an
assertion you have not diagnosed BAKES IN whatever is actually wrong.** That is
`expectation-edited-to-match-regression`, at scale, in a suite nothing has run
for two weeks. **Whoever takes it should triage per failure, not per suite.**

### THE ORPHAN PAYDOWN — 50 → 25, AND **25 SUITES ARE FAILING RIGHT NOW WITH NOBODY WATCHING**

**All 45 remaining orphans RUN, verdict taken from the EXIT CODE, not the totals
line** — `harness-lies-tail-not-exit-line` is a memory entry in this repo and it
earned itself again today: three of these suites print **no totals at all**, and
several print `Pass: N` rather than `N passed, N failed`, so a totals-grep called
them dead. **The exit code is the verdict.**

| | |
| --- | --- |
| **GREEN, now wired into `test:bible`** | **20** |
| **RED — real failures nobody can see** | **25** |

**~600 cells that could not fail the chain this morning can fail it now.**

**⚠ AND 25 SUITES ARE RED. That is the finding, not the paydown.** Worst first:
`byeWeekClassificationTests` **40 passed / 23 FAILED**; `generationConstraintReentry`
13/6; `beginnerDeterministicProgram` 34/5; `phaseRepPrescription` 17/4;
`teamTrainingRendering` 28/3; `programmingBias` 40/2; plus `coachRevisionProposalController`,
`coachProgramEditDraft`, `postGenerationConstraintValidation`, `programEditWriteGuard`,
`sprintExposureGate`, `recoveryContentIntegrity` and others.

**NONE ARE WIRED IN, deliberately** — a red suite would red the chain on arrival,
so each one's wiring belongs in the same commit as its fix. **The ratchet keeps
the count honest: 25 declared, and it may only fall.**

**⚠ THREE INSTRUMENT FAULTS IN ONE HOUR, ALL MINE, ALL CAUGHT BY THE ANSWER
LOOKING WRONG RATHER THAN BY CARE:**
1. **`timeout` does not exist on macOS** — 16 suites reported "died"; not one had
   executed.
2. **A totals-grep too narrow** — `Pass: 9` and `— Summary —` formats read as
   "no totals", i.e. as dead.
3. **zsh does not word-split an unquoted variable** — a 20-name list ran as ONE
   command name and reported "1 red".
**Every one produced a confident, wrong number, and every one was caught because
the shape of the answer was implausible — sixteen identical results, one red out
of twenty with a name 400 characters long.** That is the day's standing lesson in
its sharpest form: **identical or impossible results across independent inputs
are an instrument claim, never a finding.**

### ⚠ I OVER-CLAIMED THE CONDITIONING DEFECT — MEASURED IN THE FULL PIPELINE, THE ATHLETE DOES **NOT** LOSE IT

**CORRECTING MYSELF BEFORE ANYONE BUILDS ON IT.** I reported
`enforceInSeasonPushPullBalance` as *"a real athlete-facing defect — it removes
the athlete's only conditioning session on a game week"*, on the strength of an
orphan suite's failing cell. **I had measured ONE FUNCTION and described a
PIPELINE.**

**MEASURED, full generation, in-season, Saturday game, Elite conditioning, team
Tue/Thu, 5 training days:**

    week 1: 1 conditioning (aerobic_base)
    week 2: 1 conditioning
    week 3: 1 conditioning
    week 4: 1 conditioning

**The floor holds. Nothing downstream is broken and no athlete is losing a
session.** The probe threw twice first (missing `equipment`, wrong profile
shape); each throw was READ before it was trusted, which is the only reason the
third run counts.

**WHAT IS ACTUALLY TRUE, AND IT IS SMALLER BUT REAL:**

1. **`recheckConditioningFloor` IS A DOCUMENTED NO-OP.** Its body is
   `void removedConditioning;`. The caller's comment (`coachingEngine.ts:6395`)
   says *"any valid conditioning removal re-checks the floor"* — **it does not.**
   The protection is real but lives in a DIFFERENT LAYER (§18, downstream), so
   the comment names a safety net that does not exist where it says it does. **A
   future refactor that moved §18 would remove the floor and this comment would
   still claim it was covered.**
2. **THE FAILING CELL IS MIS-AIMED, NOT WRONG-HEADED.** It calls
   `enforceInSeasonPushPullBalance` directly and asserts a PIPELINE property
   (`conditioningCount >= 1`) against a SINGLE FUNCTION that does not own it. The
   function's own contract is *"repair push/pull, and it may consume a finisher
   or standalone conditioning slot"* — which is exactly what it did.

**SO: NOT AN ATHLETE-FACING DEFECT. A lying comment and a cell aimed one layer
too low.** Left as found, named here; the fix is either to re-point the cell at
the pipeline or to make the no-op real, and that is a decision for whoever owns
`coachingEngine.ts` next — I have not touched it.

**THE LESSON IS THE DAY'S, FOR THE FOURTH TIME AND THIS ONE IS MINE:**
**a conclusion travelled past its evidence.** One function measured, a pipeline
claimed, and it reached Sam before it was checked. The orphan-suite finding that
produced it is still good — running those suites was right — but *"a suite reds"*
and *"an athlete is harmed"* are two different claims and I collapsed them.

### ⚠ A REAL ATHLETE-FACING DEFECT, HIDDEN BY A SUITE NOTHING RAN — IN-SEASON BALANCE REPAIR STRIPS THE WEEK'S ONLY CONDITIONING

**Found by running the 50 unrunnable suites instead of just counting them.**

`conditioningBalanceRepairTests.ts` — never named by any npm script, never run —
is **10 passed, 1 failed**, and the failure is not a stale fixture:

| cell | result |
| --- | --- |
| *"test starts with one real conditioning exposure"* (`before === 1`) | **PASS** |
| *"balance repair restores push and pull"* | **PASS** |
| *"game-week conditioning floor remains satisfied after repair"* (`>= 1`) | **FAIL** |

**THE FIRST CELL PROVES THE INPUT HAD ONE.** The dump on failure is
`Monday:-:-, Tuesday:-:-, Wednesday:-:-, Thursday:-:-, Friday:-:-` — every
`conditioningCategory` and `attachedConditioningKind` empty. **So
`enforceInSeasonPushPullBalance` fixes push/pull by removing the athlete's only
conditioning session on a GAME week.** Elite conditioning level, Saturday game.

**NOT FIXED HERE, AND NOT LEFT SILENT EITHER.** It is in-season generation, it is
one function (`enforceInSeasonPushPullBalance`), and the reproduction is a suite
that already exists and already reds. **Naming it precisely is worth more than a
guessed fix from the seat that found it at the end of a long session** — but it
is athlete-facing and should not wait long. **NOT wired into `test:bible`,
because a red suite would red the chain on arrival; wiring it is the same commit
as the fix.**

### THE ORPHAN RATCHET IS PAYING DOWN — 50 → 45

Four of the sixteen I ran were green and are now in the chain:
`coachInterpretationReceiptTests` (28/0), `coachRevisionOverrideWriterTests`
(51/0), `coachWeekDiffTests` (46/0), `edgeGenerationEquipmentTests` (24/0).
**149 cells that could not fail the chain this morning can fail it now.**

**⚠ AND MY FIRST BATCH RUN WAS A DEAD INSTRUMENT — SEVENTH SIGHTING TODAY, MINE
AGAIN.** All sixteen reported *"NO TOTALS LINE / DIED"*, which I nearly wrote up
as sixteen dead suites. **`timeout` does not exist on macOS** (it is `gtimeout`),
so every run was `command not found` and **not one suite was executed.** Caught
only because sixteen identical results is a smell — a uniform answer is the shape
of an instrument fault, not of sixteen independent facts. **The real spread is
4 green, 1 red, 11 needing a closer look.**

### ✅ SAM RULED — *"similar is right"* (2026-08-13). CONTRAST PAIRS ON A SIMILAR PATTERN.

**HIS WORDS, VERBATIM: *"similar is right"*.** Answering `audit` directly on the
AWAITING SAM entry about Bible `:225` (*"of the SAME pattern"*) versus `:1099`
(*"a SIMILAR pattern"*).

**SO THE BUILD IN `e665ab44` IS CONFIRMED, NOT MERELY DEFENSIBLE.** The pairing
partner is chosen by **FAMILY**, and the `powerRowAlignment` family check that
item 42 called a defect is CORRECT and stays.

**THE EVIDENCE THAT PRODUCED THE QUESTION, kept because it is what made one line
from him enough:** four of his own five authored pairings FAIL the strict reading
— Box Squat `squat`→Vertical Jump `plyo`, Back Squat `squat`→Broad Jump `plyo`,
Trap Bar Deadlift `hinge`→Broad Jump `plyo`, Split Squat→Vertical Jump `plyo`;
only Bench Press→Explosive Push-up is a true pattern match. **Every LOWER entry in
`POWER_EXERCISE_POOL` tags `movement: 'plyo'`.** He was shown the table, not the
question.

**⚠ REGISTRATION IS OWED AND IS NOT YET DONE — R-081.** `CLAUDE.md`: *"when Sam
rules, the registry is updated in the same task, or the ruling is lost."*
**`docs/RULINGS_REGISTRY.md` IS HELD** — another seat's R-080 sits in it
uncommitted (+20/−0, written 13:39). **Committing that file by path would sweep
their unfinished row into my commit**, which is the exact harm that seat
apologised to me for twenty minutes ago, so I did not do it. The row text is
handed to them verbatim and recorded here so it cannot be lost in the gap.

**THE ROW, ready to paste:**
> **R-081** · *"similar is right"* (Sam, 2026-08-13) · **CONTRAST PAIRS ON A
> SIMILAR PATTERN, NOT THE SAME ONE.** Partner chosen by FAMILY. · `BUILT
> e665ab44` — `test:power-primer-policy` `[42a]`-`[42f]`, mutation-proven both
> ways.

**⚠ AND `:225` IS NOW THE ONLY PLACE CARRYING REFUTED WORDING.** It still says
*"of the SAME pattern"*. **It should be amended to "similar" with a changelog
line** — the same treatment R-079 gave `:90`'s flat "2 nights". **Not done here:
amending his authored Bible on the back of a three-word chat reply is a bigger
edit than the reply authorises, and `:1099` already states the correct rule, so
nothing is broken while it waits.**

### ITEM 42 — CONTRAST IS NEVER A PAIRING (Sam assigned it to `audit` directly, overriding the block)

**ALL FOUR OF THE ITEM'S CLAIMS RE-VERIFIED AT CURRENT LINES** (they had drifted
again), **and a FIFTH found. But the item's ACCEPTANCE TEST IS REFUTED — by Sam's
own authored examples.**

**⚠ THE REFUTATION FIRST, because building the item as written would FORBID the
pairings he authored.** The item says *"PROVE IT: a contrast day ships one paired
block at the main slot, **same pattern both halves**. Mutation: break the pattern
match, cell reds."* Measured through the app's own tag lookup:

| heavy half | explosive half | same pattern? |
| --- | --- | --- |
| Box Squat `squat` | Vertical Jump `plyo` | **NO** |
| Back Squat `squat` | Broad Jump `plyo` | **NO** |
| Trap Bar Deadlift `hinge` | Broad Jump `plyo` | **NO** |
| Split Squat *(untagged)* | Vertical Jump `plyo` | **NO** |
| Bench Press `horizontal_push` | Explosive Push-up `horizontal_push` | yes |

**EVERY LOWER ENTRY IN `POWER_EXERCISE_POOL` TAGS AS `movement: 'plyo'`** — never
`squat`, never `hinge`. So *"same pattern both halves"* is **false for four of the
five pairings Sam wrote into the Bible** (`:1115-1121`), and a cell asserting it
would red on his own examples.

**THE AUTHORED TEXT CONTRADICTS ITSELF AND THE DATA SETTLES IT.** `:225` says
*"of the SAME pattern"*; `:1099` says *"an explosive movement that uses a SIMILAR
pattern"*. **`:1099` is the one that matches both the pool and his examples.**

**SO THE ITEM'S THIRD CLAIM IS NOT A DEFECT.** It reads
*"`powerRowAlignment.ts:99` checks only same-FAMILY, so 'heavy deadlift + vertical
jump' passes"* — **that pairing is Sam's own authored example.** The family check
is CORRECT and must not be tightened to pattern. **A correct behaviour was read as
a bug because the item trusted `:225` without opening `:1099` or the pool.**

**WHAT IS GENUINELY BROKEN — and it is exactly what Sam said, "contrast is never
actually a pairing":**
1. **`buildPowerRow` (`defaultProgram.ts:1543-1556`) sets NO `supersetGroup`, NO
   `supersetOrder`, NO `pairType`.** The only thing contrast changes is a notes
   string.
2. **`workoutCanonicalisation.ts:855-857` ACTIVELY STRIPS any
   `pairType === 'contrast'`**, logging `stale_raw_contrast_pairing`. So even if
   something set the pairing, it is removed.
3. **PLACEMENT IS WRONG AND THE ROW CONTRADICTS ITSELF.** `exerciseOrder: 0` plus
   the concatenation at `:888-892` (`...authoredPowerRows` first) puts power
   **ahead of the main lift**, while the same row's note says *"perform sharply
   **straight after your heavy set**"*. Bible `:225`: *"The pairing sits at the
   MAIN slot; it is not appended to the end of the session."*
4. **THE FIFTH FACT (desktop's, confirmed):** the note and `exerciseOrder: 0` are
   in the same function, four lines apart.

**ALREADY CORRECT, so nobody rebuilds it:** the training-age gate. `:1100` says a
`developing` athlete never gets contrast, and `powerPrimerPolicy.ts:256`'s
`ctx.experienced` is exactly `consistent`/`advanced`.

**THE FIX HAS TWO OWNERS, and neither is `buildPowerRow`** — it builds a row
before any main lift exists, so it cannot know its partner:
- **`powerRowAlignment`** already holds the power row AND the strength rows and
  already downgrades when no heavy same-family lift survives. **It is where the
  pairing gets FORMED.**
- **`workoutCanonicalisation`** must stop stripping a COMPLETE pairing, and must
  **splice a paired power row next to its partner instead of leading with it** —
  `:888` builds the list by concatenation, so position, not `exerciseOrder`, is
  what carries "power leads".

**⚠ AND IT MOVES `test:power-counting`'s GOLDEN, which is the block the item
declared.** That golden already carries an unresolved session-flip regression and
289 of 291 diffs attributed. **This adds a fifth cause.** Measured and reported
rather than assumed — see below.


### THE SWEEP I OWE SAM — WHAT IT WILL AND WILL NOT MEASURE

**A number has to say what it measured, so this is written BEFORE the number
arrives rather than after it is convenient.**

- **The running sweep (`audit-final`) enumerated 209 suites AT START.**
  `scripts/sweep.sh:74` reads `package.json`'s `test:bible` once, at launch.
- **The chain is 212 suites NOW** — my two (`test:census-hook`,
  `test:coach-phrase-ratchet`) plus one from another seat, all landed after it
  began. **So this run cannot see them.** Both of mine were run directly and are
  green (14/0 and 7/0), and both are verified REACHABLE from `test:bible` — not
  merely present in the string, which is the distinction that has been wrong here
  before.
- **The earlier run (`audit-restore`, HEAD `db22226e`) reported 21 of 209.**
  That HEAD is now hours and many commits behind, **so 21 is not a baseline, it
  is a different world's number.** Comparing the two totals would be
  `a-red-count-is-a-claim` exactly: **diff the failure SETS, never the totals.**
  The prior set is saved at `scratchpad/fail-before.txt`.
- **AND AT LEAST THREE OF THE REDS ARE KNOWN AND OWNED, not news:**
  `test:law-registry` is **RED BY RULING** while any law is `UNENFORCED` (do not
  "fix" it); `test:ruling-registry` is the desktop seat's blunt-matcher defect,
  named by them; `test:power-counting` is the golden under active investigation,
  4 causes, 289 of 291 diffs attributed.

**SO THE HONEST DELIVERABLE IS A SET DIFF WITH THE KNOWN REDS NAMED — not "N
failures".** A bare total here would be the same defect this seat has spent the
day catching in other people's numbers.


### THE LAST TWO DIFFS — **NOT MINE**, and scenario 3 was the LONE OUTLIER

**The residue after everything else is attributed is two lines:**
`taxonomy.1.modality "none" → "off_feet"`, `weeks.2.days.4` and `weeks.3.days.4`.

**I SUSPECTED MY OWN RESTORE AND MEASURED IT. REFUTED, TWO WAYS.** The C11
block-cap filter (`set_length_max_4_5_min`) came back in this morning's
32-file restore, so it was the obvious candidate. **It excludes NOTHING:**

| template | block | verdict |
| --- | --- | --- |
| MAS 15:15 Blocks | 4.00 min | kept |
| 30:30 Hard Intermittent | 5.00 min | kept |
| Erg EMOM | 5.00 min | kept |

All three sit at or under the 5-minute cap, **so the filter is an inert LOCK, not
a live change** — which is exactly what item 35 already measured (*"ZERO
unexplained shortfalls, so this is a missing LOCK, not a live defect"*), now
confirmed from the other side. **And all three are `aerobic_power`**, while the
days in question are `tempo_conditioning`. **Two independent reasons it cannot be
the cause.**

**WHAT IS MEASURED AND IS THE USEFUL HALF: SCENARIO 3 WAS THE ONLY ONE SAYING
`none`.** Read across the golden, on that same `Upper Pull` day of weeks 2 and 3:

    scenario 0  off_feet      scenario 3  none   ← the outlier, and the one that moved
    scenario 1  off_feet      scenario 4  off_feet
    scenario 2  off_feet      scenario 5  off_feet

**Five of six scenarios ALREADY render that day off-feet. The change makes the
sixth agree with them.** That is evidence of a defect being CORRECTED, not one
arriving — **but it is evidence of DIRECTION, not of cause, and I have not
attributed it.** Saying "it looks right" is not the same as knowing what did it,
and this is the suite where a positional diff has fooled two readers today.

**SO THE HONEST STATE FOR THE `--update`: 289 of 291 diffs resolve to three named
causes; 2 move a lone outlier into line with five siblings and have no named
cause.** Whoever signs it should say exactly that rather than rounding it to
"all attributed".

### ✅ THE POWER-PROBE LINK IS **PROVEN**, NOT INFERRED — the bisect is 4 causes, and 3 are named

**The terminal seat withdrew its own alarm and said plainly that it had NOT run
the probe that would prove the link — it labelled the reading "inference from
shape". I ran it. The link holds, from the golden's own values.**

**GOLDEN `scenarios.3`:**

    overBudgetProbe.powerDaysBefore   [1, 2, 3, 5, 6]
    overBudgetProbe.powerDaysStripped [3, 5, 6]
    keptFamilies                      [{dow 1, lower}, {dow 2, lower}]

    weeks[2].days[1]   dayOfWeek 2 · workoutType "Strength" · taxonomy prehab/none

**THE DAY THAT FLIPS `Strength → Recovery` IS `dayOfWeek` 2. `2` IS IN
`powerDaysBefore`. `2` IS EXACTLY THE VALUE THE DIFF REMOVES.** A day that
becomes Recovery is no longer a power day — so it leaves the list, and
`powerDaysStripped` and `keptFamilies.1` shift because their neighbour left.
**Every one of the 14 follows from one flip. No power decision changed.**

**SO IT IS THE ARRAY-SHORTENING ILLUSION FOR THE SECOND TIME TODAY, IN THE SAME
SUITE.** This morning it made a Romanian Deadlift look lost; this afternoon it
made a power probe look like it had changed its mind. **Both times a POSITIONAL
diff manufactured a scary finding, and both times the fix was to read VALUES
instead of counting lines.**

**THE BISECT, and it is now small:**

| cause | diffs | named? |
| --- | --- | --- |
| R-076 pool-slot move | 188 | ✅ |
| `c69151d9` squat fallback 3→5 | 39 | ✅ |
| one `Strength → Recovery` session flip | ~14 | ✅ |
| **`taxonomy.1.modality "none" → "off_feet"`** | **2** | **⚠ NOT EXPLAINED** |

**TWO LINES ARE ALL THAT STAND BETWEEN THIS GOLDEN AND A JUSTIFIED `--update`** —
`weeks.2.days.4` and `weeks.3.days.4`, a conditioning modality gaining a value
where it had none.

**AND THE CREDIT IS THEIRS, NOT MINE:** none of this was visible before they
raised the collection cap. **A breakdown answers *"what shapes are here"*; it
never answers *"what happened"* — they said that of themselves before I could.**


### THE QUEUE FROM THIS SEAT — WHAT IS LEFT AND WHY IT IS NOT MINE

**Every remaining item under `## Unprocessed` is discharged, owned elsewhere, or
standing. Measured, not asserted:**

| item | state |
| --- | --- |
| 39 (sprint cap) | `BLOCKED-BY: other-agent` — names the TERMINAL as owner and reserves R-079 |
| 31 (COD window / Christmas) | **verified BUILT, all three parts**, receipts in the item. Archiving is the SEAT's edit |
| 26 (2-3 pairs) | `BLOCKED-BY: other-agent` — SEQUENCING, not a file hold; its next act moves a golden under investigation |
| 27 (C1) | marked with the measured reconciliation; C1 and 28-C1 are one defect |
| 1 (standing merge) | **discharged this stop** — 42 `codex/*` branches, newest merge-base 2026-07-19, nothing to merge. **Quiet, as the order says** |
| 13 (standing, law count) | **discharged this stop** — one law paid (27 → 26) and the other 26 triaged by cost |

**THE TWO STANDING ITEMS NEVER "CLEAR" — that is what standing means.** They are
done at every stop, and they were done at this one. **A seat reading this file
should not re-run them expecting a different answer; re-measure only when the
tree has moved.**


### ✅ THE `--full` CONDITION FIRED — TWO MORE CAUSES WERE HIDING, AND MY OWN TOTAL WAS A SATURATED CELL

**I wrote: *"if a third kind appears, that is the finding the cap was hiding from
all three of us."* A THIRD AND A FOURTH APPEARED** (`62c6cd1e`, the terminal
seat's, instrument only — no golden regenerated, no production code touched).

**⚠ AND THE FIRST CORRECTION IS TO ME.** I reported *"188 diffs"* and reasoned
about *"the unread 176"*. **There was never a 201.** `walk` stopped COLLECTING at
200, so **every total any of us quoted was the CEILING wearing the domain's
unit** — a saturated cell reading exactly like a measurement. With the cap raised
(it was a DISPLAY guard doing a COLLECTION job; only 25 lines ever print, so 200
bought nothing) **the true total is 291.**

**THAT IS `LAW-count-names-instrument`, FIFTH SIGHTING TODAY, AND THIS ONE IS
MINE.** I guarded that law this morning, then quoted a capped number as a
measurement this afternoon — in the very table I used to attribute causes. **The
guard I built covers ONE count in one file; it could never have caught this.**

**THE TRUE SHAPE, over all 291:**

| count | kind | attributed? |
| --- | --- | --- |
| 188 | `strengthRowNames.N` | R-076, the pool-slot move |
| 39 | `countedRows.strength` / `total` | the 3→5 and 6→5 sets |
| **9** | **`overBudgetProbe.powerDays*`** | **⚠ NAMED BY NOBODY** |
| **2** | **`keptFamilies.N.*`** | **⚠ NAMED BY NOBODY** |
| **3** | **`taxonomy.N.modality\|category`** | **⚠ NAMED BY NOBODY** |
| 9 | `name`/`workoutType`/`components`/`section18.visibleCounts` | the session-type change |

**MY TWO CLASSES ARE REAL AND DOMINANT — AND THERE ARE POWER-PROBE AND
POWER-FAMILY DIFFS UNDERNEATH THEM, IN A GOLDEN WHOSE ENTIRE SUBJECT IS POWER
COUNTING.** That is exactly what the ratchet exists to catch, and it sat below
line 200 all day while three agents read the top 25 and drew conclusions.

**SO "DO NOT REGENERATE" WAS RIGHT, AND NOW IT IS RIGHT ON EVIDENCE RATHER THAN
ON CAUTION.** Signing an `--update` at any point today would have erased three
unattributed classes silently, and the strongest reason to refuse — that the
count itself was not a count — was invisible until the cap moved.

### ⚠ I WENT TO FIX `explainDiff` AND BACKED OUT — ANOTHER SEAT WAS ALREADY IN IT, WITH A BETTER FIX

**Nothing was written. Verified rather than asserted:** zero occurrences of my
text in `powerCountingDifferentialTests.ts`, and my single edit attempt failed on
a stale read *before* applying. **A third agent in a function two had already
touched today is the exact thing I have spent the day warning others about.**

**WHAT I WAS GOING TO BUILD:** a `--full` flag, and a suffix saying *"at least"*
instead of a bare remainder.

**WHAT THEY BUILT, AND IT IS BETTER:** a **breakdown BY KIND over ALL collected
diffs**, printed first. That answers *"what shape is this?"* in four lines, where
dumping 200 traversal-ordered lines answers it in an hour. And their
*"the true count is UNKNOWN"* beats my *"at least"* — a saturated cell read as a
measurement is the same defect as the miscount itself.

**THEIR FINDING IS THE ONE THAT MATTERS: *"three agents read this failure today
and all three reasoned from a truncated sample."* I WAS ONE OF THEM** — I
concluded a hinge was being lost, and only caught it by going back to the golden
and reconstructing the array by hand. **Their breakdown would have said it on the
first read.** The 25 shown lines are traversal-ordered, so all three of us were
reading `scenarios.0` and calling it a sample.

**THE RESIDUAL GAP, handed over, not taken:** still no way to print every
collected line. Their breakdown makes it much less necessary; the suite's rule is
*"read and understood"*, so `--full` is four lines if a class-level read is judged
too weak to sign an `--update`.

**AND ONE CORRECTION SENT TO THEM:** their new comment cites the cautionary case
as *"a reader concluded a Back Squat was being lost"*. **It was a Romanian
Deadlift** (`strengthRowNames.5`, week 3 day 2); the Back Squat is on day 5 and is
not what shortened. Same lesson, wrong row — and that sentence is now the file's
worked example, so the row should be right.

### ✅ `test:power-counting` — THE QUESTION IS ANSWERED: **NO LIFT IS LOST**, AND ITEM 36's "ONE CAUSE" IS WRONG

**The terminal seat's open question was:** *"on the days that went 6 → 5, is the
removed row one `main_pattern_drift` names, and does the day still cover squat
AND hinge after? If a squat is being lost, the golden is doing its job."*

**ANSWER: NO ROW `main_pattern_drift` NAMES IS REMOVED, AND NOTHING IS LOST.**
Reconstructed from the golden plus the diff rather than inferred from the counts:

| | week 3, day 2 |
| --- | --- |
| **golden (6)** | Bicep Curls · Tricep Pushdowns · **Face Pulls** · **Leg Extension** · Pallof Press · **Romanian Deadlift** |
| **now (5)** | Bicep Curls · Tricep Pushdowns · **Calf Raises** · Pallof Press · **Romanian Deadlift** |

**THE ROMANIAN DEADLIFT SURVIVES** — it moved index 5 → 4, which is why a
count-only read makes it look like the hinge went. **What actually left is
`Face Pulls` and `Leg Extension`; `Calf Raises` arrived.** All three are
accessories. **The day is an arms/accessory day — no squat was ever on it.**

**THE CAUSE IS R-076 — SAM'S OWN RULING FROM TODAY**, *"face pull is shoulder
work for sure"*, which moved `Face Pull`, `Rear Delt Fly` and `Band Pull-Apart`
out of `horizontal_pull/accessory` into the `isolation_upper/accessory` shoulder
block. **The pool re-rotated underneath, exactly as it should.**

**⚠ SO ITEM 36 AND THE REGISTRY NOTE ARE WRONG ON THIS.** They say
*"`test:power-counting`'s moved golden is this same cause"* — meaning
`c69151d9`, the grown squat fallback. **There are TWO causes, and both are Sam
rulings:**
- **`3 → 5` (4 diffs)** — `c69151d9`, the squat fallback grown 3 → 5. Item 36 is
  right about these; `undefined → "Single Leg RDL"` is its signature.
- **`6 → 5` / `7 → 6` (4 diffs)** — **R-076**, the pool-slot move. **Not
  `c69151d9`, and not a defect.**

**⚠ AND I AM NOT REGENERATING THE GOLDEN, THOUGH IT WOULD BE JUSTIFIED.** The
ratchet's own rule is *"regenerate only when a diff has been read and understood,
and never as a way to make a stage pass."* **The harness prints 12 diffs and then
`… and 176 more`.** I have read 25 lines of 188. **Two clean causes over the
visible set is a strong prior, not "understood"** — and this is the day a
conclusion travelling past its evidence cost four reverts.

**WHAT IT WOULD TAKE, and it is small:** a full diff dump (the harness truncates
and has no verbose flag that changes it), then confirm every remaining line falls
into those two classes. **A third cause hiding in the unread 176 is exactly what
this ratchet exists to catch, and regenerating now would erase it silently.**

### ⚠ "A ROW SAYS UNENFORCED OVER SHIPPED WORK" — REAL DEFECT, AND MY GATE FOR IT IS REFUTED

**The terminal seat found the class and it is the best lead of the day:** a
rulings row reading `UNENFORCED` over work that actually ships is **worse than
the reverse**, because **the ask gate reads these rows to decide what reaches
Sam** — so a false `UNENFORCED` sends him a question about something that already
works. **That is this morning's defect wearing different clothes.** Two found and
corrected (R-004, R-052); ten left, each naming a real gap on its face.

**MY PROPOSED GATE: scan chain suites for `R-nnn` and red when an `UNENFORCED`
row is named by a green suite** — the inverse of the direction rule 2 already
guards, and the same shape `lawRegistryGateTests` uses for LAWS.

**MEASURED FIRST, AND IT CANNOT FAIL:**

| scan | UNENFORCED rows named by a suite |
| --- | --- |
| raw | **2** (R-014, R-075) |
| **comments stripped, self-reference excluded** | **0** |

**Both raw hits are PROSE** — `rulingRegistryTests.ts` discussing its own matcher
misfiring, and comment blocks in `awayFlowTests`/`resolverDisplacementSweep`.
**`a-comment-is-not-a-shipped-string`, caught by applying my own `b19109d4` fix to
my own measurement.** With them stripped the count is **zero**, so the gate would
be **a cell that cannot fail** — refused twice already in this repo, and *"worse
than no cell"* in its own words. **NOT BUILT.**

**WHY THE CLASS RESISTS A GATE, AND IT IS THE SAME CAUSE AS THE BLUNT ASK
MATCHER.** R-004's enforcer is `test:christmas-break`; R-052's are
`optionalTopUpTests` and `mobilityAccessoryDoorTests`. **None of them cites its
row id anywhere in code.** So a row and its enforcer share **no machine-readable
key**, and the only remaining signal is prose-matching the row's SUBJECT against
cell titles — **which is exactly the ask gate's existing matcher, and exactly why
it is blunt.** Two gates would then be guessing from the same weak signal.

**THE ROUTE THAT WOULD WORK, and the precedent is already in this repo:** give
them the key. **`lawRegistry` rows carry `by: 'test:…'`, and its gate is trivial
because of it.** `RULINGS_REGISTRY.md` has no such field — a `BUILT` row names a
commit, never an enforcer. **Add the field and this whole class becomes a two-line
cell in BOTH directions**; without it, every attempt is prose-matching. **That is
a structural unit for the seat, not a cell for a terminal, and it is the honest
next step on the class rather than a fourth refuted scanner.**

### ❌ 28-C1 — **OPTION A IS REFUTED. I RAN MY OWN RECOMMENDATION AND IT FAILED**

**Ran it rather than argued it, and the falsifier I wrote one commit earlier
killed it in one run. Reverted; `coachingEngine.ts` byte-identical to `HEAD`.**

**THE CHANGE:** `mustCoverCategories()` returns `autoPlacementCategories()`
unfiltered, so `cod_decel` becomes must-cover in permitted weeks only. One line.

| arm | result |
| --- | --- |
| `test:scenarios` vs baseline | **identical** |
| `test:qa` vs baseline | **identical** |
| **permitted week (pre-season, no club)** | `{aerobic_base:4, tempo:5, vo2:2}` — **`cod_decel` = 0** |
| control (pre-season, WITH club) | `{aerobic_base:4}` — `cod_decel` = 0 |

**"NOTHING MOVED" WAS NOT THE SAFETY I PREDICTED — IT WAS VACUITY.** I framed the
empty diff as *"nothing outside permitted weeks moved, so A is safe"*. **It is
empty because A DOES NOTHING AT ALL.** Reading the corpus diff alone would have
shipped a one-line no-op as a fix — **and the only reason it did not is the
permitted-week probe, which is the arm the corpus does not contain.**

**WHY IT FAILED, AND IT KILLS MY OPTION B FRAMING TOO.**
`mustCoverCategories` feeds the SCORER — `uncovered * 3`, how much a slot is
WANTED. **It does not feed `pickPlacementCondCategories`, which decides WHICH
category takes the slot.** Raising urgency makes conditioning more attractive;
the slot still goes to the FIRST ALLOWED candidate, and COD is still last.
**URGENCY IS NOT SELECTION.**

**SO MY "TWO AXES" WERE THE WRONG TWO.** I proposed *coverage intent vs drop
order*. The real pair is **urgency (scorer) vs selection order (picker)**, and
`mustCover`/`dropOrder` both sit on the urgency side. **Option B as I wrote it
would have failed for the same reason** — that is now measured rather than
suspected, and it saved building it.

**⚠ AND IT VINDICATES ITEM 27's C1, WHICH I PARTLY CORRECTED THIS MORNING.** C1
concluded *"COD can only enter by SUBSTITUTION"*. I marked that off-season-only,
because its stated reason (zero rest days) is off-season-specific. **The
CONCLUSION holds for pre-season anyway, by different arithmetic:** ~2–2.75 slots
against 3–4 categories means something else is always uncovered, so COD is
reachable only by **outranking** a category — i.e. substitution. **C1's reason
was scoped; its answer was not. I was right to scope the reason and wrong to
imply the answer travelled with it.**

**WHAT IS ACTUALLY LEFT, and it is now one sentence:** the only lever is
`pickPlacementCondCategories`' **Pass 1** ordering, and the only shape that can
work is COD **displacing** a category in permitted weeks — not being wanted more.
**Nobody should try urgency again; it has now been measured twice.**

### 28-C1 — **THE TWO OPTIONS, COMPARED BEFORE CODING** (`LAW-elegant-two-options`)

**REGISTRY-GREP first, because a design that re-decides a ruling is the worst
outcome available here:** `docs/RULINGS_REGISTRY.md` for *cut first* (**0**),
*must-cover* (**0**), *must cover* (**0**), *prescribed* (**1** — R-016, rep
ranges, unrelated), *change of direction* (1), *cod* (15, all the WINDOW ruling —
R-072/R-073/R-074 and item 31's phases). **Nothing rules HOW it is placed.** So
placement is the terminal's to build — *"where the derivation installs… is the
terminal's"* — and **nothing is owed to Sam.**

**THE PROBLEM, restated in one line:** at **2–2.75 slots** against **3–4
categories**, a last-ranked category is unreachable, so *"prescribed"* and
*"cut first"* cannot both be expressed by one ranked list.

**OPTION A — INCREMENTAL: put `cod_decel` in `mustCoverCategories()`, but ONLY
when `codPermitted`.**
- **Cost: one line.** Everything else already exists.
- **Effect:** COD becomes a gap the planner fills, so it gets a slot.
- **THE OBJECTION, AND IT IS ON THE RECORD:** the scorer adds `uncovered * 3` to
  every conditioning slot, so pool size is a term in every decision — and the
  code's own comment records that adding COD *"moved FOUR passing phase checks
  while placing zero COD sessions"*.
- **⚠ BUT THAT OBJECTION IS FROM BEFORE THE GATE EXISTED.** That measurement was
  taken when COD entered the pool on EVERY week. `codDecelPermitted` (item 31)
  now confines it to no-team-training, not-in-season, not-early-off-season weeks.
  **A normal week cannot see it, so it cannot move one.** The containment that
  was missing is now built.
- **Tension with *"cut first"*:** real. Must-cover creates urgency, which is what
  *"cut first"* says COD must not do. **A is the weaker reading of his sentence.**

**OPTION B — OWNERSHIP REDESIGN: split the single ranked list into TWO AXES —
coverage intent and drop order.**
- COD: `mustCover = true` (in permitted weeks), `dropOrder = first`.
- **This is the only shape that says BOTH of his words**, and it retires a
  conflation the planner has carried since the category planner was written.
- **Cost:** a new concept, the scorer, and every trim/repair path that decides
  what goes when a week is over-full.

**RECOMMENDATION — A FIRST, AND B ONLY ON A's EVIDENCE.** Not because A is
better: **because A is FALSIFIABLE IN ONE RUN and B is not yet justified.** Run A
against `test:scenarios` + `test:qa` both arms (**baselines already captured**).
**THE FALSIFIER IS EXACT: if any week WITHOUT the COD gate moves, A is dead and
B is justified with evidence instead of by argument.** If nothing outside
permitted weeks moves, A delivers *"prescribed"* at one line and the residual
*"cut first"* question becomes a real, narrow question about trim order — which
is B's actual subject, priced honestly instead of assumed.

**Building B first would be inventing a concept to solve a problem A may already
solve** — and this item has four reverts from building ahead of measurement.

### ✅✅ 28-C1's BUILD IS NOW DESIGNABLE — **RANK CAN NEVER SATISFY "PRESCRIBED", BY ARITHMETIC**

**The last thing this item needed before anyone builds: does a ranking change
even have the headroom to work? No, and the numbers are not close.**

| world | conditioning slots per week | categories in the pool | COD's rank |
| --- | --- | --- | --- |
| pre-season no club, 5d | **2.75** (11 / 4 weeks) | 4 | **last** |
| pre-season no club, 6d | **2.75** | 4 | **last** |
| pre-season no club, 4d | **2.00** (8 / 4 weeks) | 3–4 | **last** |

**A slot is consumed by the FIRST ALLOWED candidate.** With **~2–2.75 slots** and
**3–4 categories**, at least one non-COD category is **still uncovered when the
last slot is filled**. **So a last-ranked category is unreachable BY ARITHMETIC,
not by policy** — no reordering *within* "rank it last" can ever place it,
because the week runs out of slots first.

**THIS IS WHY FOUR ATTEMPTS FAILED, AND ALL FOUR WERE AIMED AT RANK.** Item 27's
C1 (*"the fix is placement, not rank"*) reached the right conclusion; this is the
number that proves it, and it also kills the *promote-it-one-place* idea I floated
this morning — **there is no place to promote it to that is still "last".**

**⚠ SO THE BUILD IS A REAL DESIGN DECISION AND IT HAS A GENUINE TENSION IN SAM'S
OWN WORDS — I AM NOT PATCHING PAST IT.**
- ***"prescribed"*** in these weeks means the week should AIM to include it →
  that is `mustCoverCategories`.
- ***"cut first when something has to give"*** means it must NOT create urgency →
  which is **exactly why `mustCoverCategories` deliberately excludes it today**,
  and the code says so: *"a missing COD session is not a gap the planner should
  push to fill."*

**BOTH READINGS ARE HIS AND THEY PULL OPPOSITE WAYS AT 2.75 SLOTS.** The
resolution is almost certainly *"must-cover, but LAST to be defended when the
week is trimmed"* — a **two-axis** model (coverage intent vs drop order), which
today's single ranked list cannot express. **That is a real unit, not a patch,
and `LAW-elegant-two-options` says the incremental fix and the ownership redesign
get compared before either is coded.**

**NOT BUILT, AND THE REASON IS NOT TIMIDITY:** it changes athlete-visible output,
owes `test:scenarios` + `test:qa` both arms (**baseline for both is already
captured** in this session's scratchpad), and the two-axis split touches the
scorer. **The layer beneath it is now fully measured, which is the one thing all
four reverts lacked.**

### ⚠ THE REPEATING SHAPE BEHIND TODAY — **A CONCLUSION OUTLIVES THE WORLD IT WAS MEASURED IN**

**THREE SIGHTINGS IN ONE DAY, ALL ON ONE ITEM, AND IT IS WHY THAT ITEM HAS FOUR
REVERTS.** Recorded here and in cross-session memory because §8's second-wall law
says an alternative goes on the table before attempt three, and this is past it.

**THE SHAPE:** someone measures honestly and states a conclusion. **The
measurement was true of ONE WORLD.** The conclusion then travels, because *a
conclusion carries no metadata about the world that produced it* — it stops
looking like a measurement and starts looking like a fact.

| the conclusion | true of | the live case |
| --- | --- | --- |
| *"conditioning is entirely COMBINED, `standalone=0`"* | off-season | pre-season: **`standalone=11`, `combined=0`** — the exact opposite |
| *"SPARE ROOM: NONE — six workouts, ZERO rest days"* | off-season | pre-season: **12 EMPTY DAYS** over 4 weeks |
| *"COD can only enter by SUBSTITUTION"* | inherits row 2's scope | never re-checked after the live case moved |

**THE TRIGGER WAS A LIVE-CASE CHANGE NOBODY SWEPT BEHIND.** `28-C1` named
pre-season-no-club as the case that matters; **three conclusions taken before
that were never re-aimed**, and each one sent the next attempt somewhere true but
irrelevant.

**THE PRACTICE, and it is one sentence:** **quote a prior measurement's WORLD in
the same sentence you quote its number.** Not *"there is no spare room"* —
*"there is no spare room IN OFF-SEASON"*. And when an item's live case changes,
**list every conclusion taken before the change and re-aim each**; that list is
short and the re-runs are minutes, which is what four reverts bought instead.

**AND ITS COROLLARY, seen twice today:** *a conclusion that contradicts yours may
be honest and about a different arm.* The rank experiment and my code-read
disagreed all day and **both were right about their own arm**.

**NOT WRITTEN AS A LAW ROW, ON PURPOSE.** `LAW-0` forbids a new row entering
`UNENFORCED`, and a prose-scanning gate over reports was measured and refused
**twice today** (566 of 688 doc lines would red). **A row claiming a guard it
does not have is the thing this registry exists to prevent**, so this lives where
it will actually be read instead.

### ITEM 13 — ONE LAW PAID (27 → 26), AND THE REMAINING 26 ARE NOW TRIAGED

**PAID: `LAW-count-names-instrument` (`55cf3420`)**, whose founding case was item
13's own instruction. Details in the commit; the short version is that the
standing order names `grep -c` as *"the truth"*, the grep emits **occurrences**
(28) where the domain noun is **distinct laws** (27), and the difference is a
**type declaration**. The cell holds an IDENTITY — `occurrences − distinct ===
type-declaration lines` — so it reds on a NEW unexplained occurrence rather than
on any renaming. Mutation-checked both ways.

**⚠ ITEM 13'S OWN SUMMARY IS STALE: it says *"four laws remain priced"*. There
are 26, and all 26 carry a `wouldTake` line.** Triaged below so the next seat
picks by cost instead of re-reading the registry.

**THE TWO CHEAPEST HAVE AN EXISTING SHAPE TO COPY — AND BOTH LAND IN A HELD FILE:**
- **`LAW-elegant-two-options`** — *"a boundary-report field ('options compared')
  checked by `test:repo-law-guards`, **the same shape as the LOOP CHECK cell
  already in that suite**"*.
- **`LAW-doc-truth`** — *"a gate that resolves doc claims to named receipts, **the
  same shape as `test:copy-rulings-binding`**"*, which already does exactly this
  for copy.
**`src/__tests__/repoLawGuardsTests.ts` is HELD by another seat right now**
(cmp-verified against `HEAD`, not `git status`). `copyRulingsBindingTests.ts` is
FREE, so `LAW-doc-truth` is the one to take when its author has a clear run.

**⚠ ONE PROPOSED GATE IS ALREADY REFUTED — DO NOT BUILD IT.**
`LAW-no-completeness-claims`' `wouldTake` describes *"a vocabulary gate over
reports forbidding 'last', 'final', 'no more'"*. **That was measured and
REJECTED**, and the refutation is recorded in a neighbouring row's receipt:
*"the whole of `docs/` yields two hits and both use 'exhaustive' descriptively,
and a cell that cannot fail is worse than no cell."* **The `wouldTake` line still
advertises it, so the next seat will price it as cheap and rediscover the
refutation.**

**HONESTLY NOT CELLS, AND THE ROWS SAY SO** — `LAW-coach-escalation`
(*"not mechanisable… should be marked PROCESS"*), `LAW-L16-vertical-slice`,
`LAW-L12-verification-reviewed`, `LAW-L1-whole-app-scope` (*"nothing mechanical
scopes a sweep"*). **These will never fall to a cell, and counting them in a
"keep the count falling" target guarantees the target is never met.** Whether
`PROCESS` becomes a third state is Sam's or the seat's call, not this seat's —
the registry's header argues hard for exactly two states.

**BLOCKED BY THE SIMULATOR, NOT BY DESIGN:** `LAW-L3-cold-start` — *"a Maestro
flow that kills and relaunches… blocked today by the same simulator-binary
blocker as everything else"*.

**⚠ AND THE `LAW-standing-derivation` / `LAW-north-star` COLLAPSE QUESTION IS
ANSWERED: THEY MUST NOT COLLAPSE.** The row calls itself a *"COLLAPSE CANDIDATE"*
and its `wouldTake` says *"the same persisted-key ratchet would hold both"*,
while warning that the three STOP conditions *"are what a guard must not
flatten"*. **Read both and the answer is not close:**

- **`LAW-north-star` is a PROPERTY** — *"store only decisions; derive everything
  else"*. A property is exactly what a disk-level ratchet can hold, and
  `test:persisted-inputs-schema` holds it.
- **`LAW-standing-derivation` is a PROCEDURE** — *"when measurement FINDS a
  stored representation feeding a computation, derive it and retire the stored
  copy, **no seat round-trip**"* — plus three conditions under which the terminal
  must **stop and ask** instead. **Its subject is what a PERSON does next on
  finding a violation.**

**A GATE CANNOT HOLD "PROCEED WITHOUT A ROUND-TRIP".** And the existing ratchet's
own receipt already concedes the gap: *"the guard prevents silent GROWTH and does
not itself decide that a newly proposed classification is legitimate."* **Growth
is north-star. Retirement is standing-derivation, and nothing measures it.**

**AND THE CLASSIFICATION HAS NO CLASS FOR THE THING THE LAW IS ABOUT** —
`InputClass` is `profile | fact | decision | result`, and `result` means
*"training results — what was done"* (`sessionFeedback`, `weightOverrides`),
which are INPUTS. **There is no "computed output" class**, so a stored
computation cannot even be named by the instrument that was proposed to guard it.

**SO IT BELONGS WITH `LAW-coach-escalation`** — *"not mechanisable as a cell; it
governs what a person does next"*. **Binding it to the ratchet would flatten the
law into its neighbour and let the registry report 25 where nothing changed.**
That is the whole failure mode item 13 exists to prevent, so it is recorded and
NOT done.

**⚠ AND `LAW-doc-truth`'s PRESCRIBED SHAPE IS REFUTED TOO — MEASURED BEFORE
BUILDING, WHICH IS THE ONLY REASON IT COST TEN MINUTES.** Its `wouldTake` says
*"the same shape as `test:copy-rulings-binding`"*. **The shape does not carry
over, and the reason is the UNIT.**

| over all of `docs/**.md` | lines |
| --- | --- |
| lines containing `BUILT`/`FIXED`/`LANDED`/`WORKING` | **688** |
| …with a receipt on the SAME line (sha, `test:`, `file.ts:NN`) | 122 |
| **…without** | **566** |

**A GATE THAT REDS 566 TIMES ON ARRIVAL IS NOT A GATE**, and the samples show
most are not even claims: *"**MEASURED, NOT BUILT**"* is a NEGATIVE claim,
*"a session is **BUILT** by pattern coverage"* is a statement of LAW, and
*"the off-season zeros are the gate **WORKING**"* is prose.

**WHY THE COPY GATE WORKS AND THIS CANNOT.** `test:copy-rulings-binding` reads a
**TABLE with rows** — a structured surface where every row is, by construction, a
claim. **`docs/` prose has no rows.** Scanning it line-by-line takes a count in
the instrument's unit (lines matching a word) and reports it as the domain noun
(claims lacking receipts). **That is `LAW-count-names-instrument` again, one day
after guarding it, in the very next law I picked up.**

**WHAT WOULD ACTUALLY WORK, and the precedent is already in the registry:** the
guarded `⚠`-blocks-in `docs/NOW.md` cell scoped itself to ONE structured surface
and said so — *"PARTIAL by construction… it reads NOW.md only"*. **`LAW-doc-truth`
needs the same move: pick one structured surface, not all prose.** **Do not build
the whole-`docs/` scanner; it has now been measured and refused twice over,
counting the completeness-word gate.**

### ✅✅ 2026-08-13 — **28-C1 IS ANSWERED.** `autoPlacementCategories`' ORDER IS INERT; **PASS 1 SETS THE RANK**

**This reconciles the two measurements that contradicted each other all day, and
BOTH were right about their own arm.**

**THE EXPERIMENT.** Promote `cod_decel` to FIRST in `autoPlacementCategories`
(`return codPermitted ? ['cod_decel', ...base] : base`), instrument
`pickPlacementCondCategories`' return, generate a pre-season no-club world:

| | `placementPool` | `out` (what the consumers walk) |
| --- | --- | --- |
| **before** | `["vo2","aerobic_base","glycolytic","cod_decel"]` | `["vo2","glycolytic","aerobic_base","cod_decel"]` |
| **promoted** | `["cod_decel","vo2","aerobic_base","glycolytic"]` | `["vo2","glycolytic","aerobic_base","cod_decel"]` |

**THE POOL CHANGED. `out` DID NOT. COD IS STILL LAST.** Same in all 8 observed
shapes, 189 calls.

**WHY, AND IT IS THE WHOLE ANSWER.** `pickPlacementCondCategories` has three
passes, and **PASS 1 runs first over `rankedForZone`** — which is
`categoryPriority` (off-season / non-mid-pre-season) or `zonePriority[zone]`.
**NEITHER LIST EVER CONTAINS `cod_decel`.** Pass 1 therefore emits every other
uncovered category first, and `pushUniqueCategory` **appends** — so by the time
Pass 2 walks `placementPool`, COD can only ever land at the END, wherever it sits
in that pool.

> **`autoPlacementCategories` DOES NOT SET THE ORDER. IT ONLY SETS MEMBERSHIP.**
> The lever is `categoryPriority` / `zonePriority`, and COD is in neither.

**SO BOTH PRIOR RESULTS WERE HONEST AND NEITHER WAS COMPLETE:**
- **The other seat's rank experiment** — *"promoted to first, zero either way,
  fingerprints byte-identical"* — is **exactly right**, and now it has a
  mechanism instead of a mystery. It moved the wrong list.
- **My "ranked last, never reached"** was the right MECHANISM aimed at the wrong
  list. **I withdrew it once on their evidence; it is now re-established with a
  correction, not restored as originally written.**
- **28-C1h's "ZERO eligibility hits"** reproduces: `ZZELIG` fired **0 times**
  even in the promoted arm. The candidate genuinely never arrives.
- **28-C1's "`permitted=true` on all 108 calls"** reproduces: `codPermitted=true`,
  `phase="Pre-season"`, `teamDays=[]`. **My own hypothesis that it was FALSE is
  REFUTED — measured, and I was wrong.**

**WHAT THIS MEANS FOR SAM'S RULING.** *"Prescribed... cut first when something
has to give"* is implementable **without** promoting COD over ordinary aerobic
work: it needs to enter **Pass 1's** list at all — today it is not a candidate
for ordering, only for tie-breaking. **28-C1b's bar ("do not reorder") was aimed
at `autoPlacementCategories`, which is inert, so the bar as written protects
nothing.**

**NOT BUILT. This is the measurement, and the build is the next unit** — it
changes generated output and owes `test:scenarios` + `test:qa` both arms. This
item has four reverts from building before the layer above was measured; **the
layer is now measured.**

**INSTRUMENTATION FULLY REVERTED, VERIFIED THREE WAYS:** `git checkout HEAD --
src/utils/coachingEngine.ts`, `grep -rn 'ZZPROBE|ZZCANDS|ZZELIG|ZZMUTANT' src/`
returns **NONE**, and the file is **byte-identical to `HEAD`** by `cmp`. The
temporary probe under `src/__tests__/` is deleted.

### 🛑 2026-08-13 — I WITHDRAW MY OWN REFUTATION OF 28-C1. RANKING **IS** THE WALL.

**READ THIS BEFORE THE ENTRY BELOW THAT SAYS `codPermitted` MIGHT BE FALSE — IT
IS TRUE, AND THAT PROBE IS NOT WORTH SPENDING.**

**WHAT I GOT WRONG.** I promoted `cod_decel` inside `autoPlacementCategories`,
saw zero COD and byte-identical weeks, and reported *"ranking is measured
innocent"* — in a commit, in the inbox, and to Sam. **`autoPlacementCategories`
feeds passes 2 and 3 only.** Pass 1 iterates `rankedForZone` (`categoryPriority`
or `zonePriority[zone]`) and **`cod_decel` appears in neither list**, so `out[0]`
is decided before the pool ordering is ever consulted. **My experiment reordered
a list that had already lost the race, and "nothing changed" was the only answer
it could return.**

**THE CORRECT EXPERIMENT:** prepend `cod_decel` to PASS 1's list →
**`cod_decel` picked 14 times** in one pre-season no-club generation
(`aerobic_base` 10). So:

- **`codPermitted` IS TRUE in the real run.** The hypothesis below it is
  REFUTED and 28-C1's *"permitted=true on all 108 calls"* is CONFIRMED.
- **RANKING IS THE WALL — item 27 and 28-C1 were right all along.** The fix is
  pass 1's list, not the placement pool.
- **AND A SECOND WALL IS BEHIND IT: the run EXITED NON-ZERO the moment COD was
  picked.** `categoryToFlavour` (`coachingEngine.ts:2633`) declares
  `: CondFlavour` and covers 5 of `CondCategory`'s 6 members — **no `cod_decel`
  case, so it returns `undefined`** at all seven call sites. The enum gained
  `cod_decel` on 2026-08-13; the map never followed. **Fixing ranking alone
  breaks generation.**

**THE LESSON, AND IT IS THIS SEAT'S OWN LAW TURNED ON ITSELF.** I ran a
mutation, got a null result, and published it as a refutation **without ever
checking that my mutation reached the code path it was supposed to test.** I had
caught exactly this shape twice in the same turn — a vacuous fingerprint, a
phantom file-hold — and then shipped it a third time in the one place it
mattered most. **A NULL RESULT IS A CLAIM ABOUT THE INSTRUMENT FIRST. Before
reporting "X changes nothing", prove the change EXECUTED** — the positive
control here (COD picked 14x) took one edit and would have caught it instantly.

**NOT TAKING THE FIX.** Another `audit` session is live in `coachingEngine.ts`
(its `ZZPROBE`/`ZZCANDS` lines and `src/__tests__/codGateProbeTemp.ts` are in the
tree). **I restored that file from a backup mid-run while their probe was in it —
that seat must re-check its working copy before trusting it.** My own mutations
are all reverted and byte-compared; no probe of mine remains.

### ✅ 2026-08-13 — 28-C1's LAST INSTRUMENT IS RUN. THE REFUSAL IS **NOT** IN `conditioningSelection.ts`

**The one thing the QUEUE PASS entry said was still owed — *"does the category
reach template selection at all, or is it vetted and downgraded?"* — is now
measured.** Probe written into `src/__tests__/`, run, **DELETED**; `src/`
verified clean of it. **No source file was modified.**

**1. THE POOL IS NON-EMPTY — 4 templates**, confirming the census-C1 correction:
`Up-Back Shuttle`, `Low-Intensity Deceleration Drills`, `Deceleration and Landing
Work`, `45-Degree Cut Reps`. All four are run-only and **all four carry
`availability_gate_no_team_training`.**

**2. `codDecelPermitted` IS EXACTLY SAM'S RULING — all five cases correct:**

| week | verdict |
| --- | --- |
| pre-season, no club | **true** |
| pre-season, WITH club | false |
| off-season, `late_offseason` | **true** |
| off-season, `early_offseason` | false |
| in-season | false |

**3. ⚠ SELECTION ALWAYS RETURNS A COD TEMPLATE — INCLUDING WHERE IT MUST NOT.**
Every case returned `Up-Back Shuttle`, **including `noTeamTrainingWeek=false`**
(which the availability filter is written to refuse) **and `offFeet=true`** (all
four are run-only). **The cause is `conditioningSelection.ts:600`:**

    if (candidates.length === 0) candidates = pool;   // ← unfiltered

**A blanket fallback to the UNFILTERED pool.** The comment above it justifies
that for a *role cap* — *"a preference, not a wall"* — but it applies to **every**
filter. **And for `cod_decel` the availability filter can ONLY ever empty the
pool, because all four templates carry the property** — so that gate is
**structurally inert at selection**, 100% of the time.

**HONEST SCOPE, AND IT IS NOT A SHIPPING DEFECT TODAY:** the real gate is
upstream — `codDecelPermitted` in `coachingEngine` decides whether COD is offered
at all, and it is correct (2 above). This is defence-in-depth that is **not
defending**, the same shape as `ergCapMinutes` before C3 and
`set_length_max_4_5_min` before C11: **authored, shipped, read by nothing.**
**The off-feet arm is the one with teeth** — an athlete under a run cap who is
ever offered COD would receive a run-only template — **and it is unreachable only
because COD is never offered at all.**

**4. SO THE REFUSAL IS UPSTREAM OF SELECTION.** Pool ✓, gate ✓, selection ✓,
ranking irrelevant (the rank experiment). **Combined, the surviving candidate is
that `codPermitted` is FALSE inside the real generation run** — which would ALSO
explain why promoting COD to first changed nothing, because
`autoPlacementCategories` reads `return codPermitted ? [...base, 'cod_decel'] :
base`. **A promotion inside a branch that never executes is a no-op, and that is
consistent with every measurement on this item.**

**⚠ STATED AS THE NEXT HYPOTHESIS, NOT AS A FINDING.** 28-C1 reports
*"`permitted=true` on all 108 calls"*, which contradicts it. **One of those two
is wrong and I have not determined which.**

**THE NEXT PROBE, and it is one line of instrumentation:** print `codPermitted`,
`inputs.seasonPhase` and `inputs.teamTrainingDays` at `coachingEngine.ts:4155`
during a pre-season no-club generation. **If it is `true`, the refusal is between
`pickPlacementCondCategories` and `finisherEligibility` (28-C1h measured ZERO
eligibility hits, so the candidate never arrives). If it is `false`, 28-C1's
108-call measurement was reading a different world and the whole item collapses
to one wrong input.**

### 2026-08-13 — THE 32-FILE RESTORE LANDED. Verified, not assumed.

**The section below it says the restore could not be committed. IT SINCE WAS**,
in `4794a18a` (and the code half before it). Checked by `git cat-file -e HEAD:`
rather than by reading the commit subject, which is this seat's whole point: all
five files the restore section lists as GONE FROM `HEAD` are in `HEAD` —
`.githooks/pre-commit`, `scripts/verify-branch-before-commit.sh`,
`src/rules/sessionSlotCoverage.ts`, `src/__tests__/sessionSlotCoverageTests.ts`.
**Step 1 of "NEXT SESSION STARTS HERE" is PAID. Steps 2 (full sweep) and 3
(item 28-C1) are still open and belong to whoever takes them next.**

### 2026-08-13 — CENSUS C2 IS PAID: the 2km time trial now has a reader (`8bf8548b`)

**THE JOB.** `docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md` C2 — the 2km time was
collected, validated and stored, and `deriveMas` had **zero production callers**.
An athlete ran a 2km, the app took it, and their conditioning card read the
literal authored string `Intensity: 110% MAS`.

**WHAT SHIPPED.** `src/rules/masPace.ts` — one pure function that reads the %MAS
band out of the words already on the row and returns the speed it means for THAT
athlete. `Your pace: 9.8-12 km/h` when they have run one; `Estimated pace: …`
off Sam's experience ladder when they have not. Mounted on both conditioning row
shapes in `DayWorkoutScreenV2`.

**THE ONE DESIGN DECISION WORTH RE-READING: IT DERIVES AT THE READ.** The obvious
build is to fold the pace into the row's notes inside `composeConditioningRows`,
where the `Intensity:` line is already assembled. **That would have been a second
representation of the athlete's pace** — the exact defect `twoKmTimeTrial.ts`'s
own header exists to forbid — and it would have gone stale the moment they logged
a faster run. Deriving at the read means no stored pace exists to disagree with
anything, and generation does not import this module at all. **Store the
decision, derive everything else.**

**AND IT DELIBERATELY DOES NOT ANSWER Q-001.** Range-or-binary is an open
question of Sam's. The pace is read off whichever percentage the card is ALREADY
showing, so `masCopy` gains no consumer and his eventual answer moves every pace
for free. There is a cell asserting `masCopy` still has no production consumer,
so a later agent cannot quietly wire it and call that this unit's doing.

**MEASURED, AND IT CHANGES WHO SEES THIS.** An in-season week WITH a club
prescribes **no %MAS at all** — `generateProgramLocally` over
`DEV_E2E_STANDARD_PROFILE` at 2026-07-13: **0** rows with a MAS band. Remove the
club from the same profile: **8** in-season, **7** pre-season, e.g. `Bodyweight
Conditioning Circuit / 65–80% MAS`. **The club supplies the running.** So this
line lives on club-less weeks — off-season, pre-season without a club, a bye
build, a trip.

**⚠ NOT SEEN ON GLASS, AND THE REASON IS THE MEASUREMENT ABOVE, NOT LAZINESS.**
`standard-in-season-week` is the only seeded world a golden flow reaches in one
step and it **cannot** show this line — a flow over it would photograph a true
negative and read as proof. **Three hand-driven attempts died at the same
dev-harness cold-start gate** (*"DevE2EClock reload mismatch: clock receipt has
no active checkpoint"*) — the app reaches `program-screen` inside a maestro flow
and falls back to the gate the moment it is touched from outside one. **That is
the §8 SECOND-WALL count**, so I stopped rather than take a fourth swing.

**WHAT THE NEXT SEAT SHOULD DO, AND IT IS SMALL:** a golden flow that resets
`standard-in-season-week`, drives the **Away this week** control on the week
shape to make the week club-less, opens the conditioning component and
photographs `Your pace:`. **OWNER: whoever next holds the away flow (the desktop
seat owns that control today) — I did not build it because driving Away means
entering their unit mid-flight.** Everything else is proven.

**MUTATION RUN, AND ONE OF MY OWN CLAIMS DIED IN IT.** Point-before-range reds
10 cells; deleting the literal `MAS` token reds 4; always-measured reds 3;
disabling the point-band branch reds 1. **The comment I first wrote credited
`\b` and case-sensitivity with refusing `95–100% maximal` — dropping `\b`,
adding `/i`, or both leaves all 144 green.** `maximal` and `MAS` diverge at the
third letter (`x` / `S`); the literal token was always the whole defence. The
comment now states what was measured. **A plausible reason for a line that is
doing nothing is still a plausible reason, and it reads exactly like a real one.**

**ALSO NOTED, NOT FIXED, NOT MINE:** `cleanNotes` (`dayWorkoutHelpers.ts:78`)
step 2 replaces every en dash with a space, so the authored `90–100% MAS` reaches
the combined-day card as `90 100% MAS`. The pace parse reads the RAW notes and
steps around it. **Whoever owns that cleaner should decide whether an en dash
inside a range is really an orphan separator.**

### 2026-08-13 — QUEUE PASS: three claims measured, three of them wrong

**All three were claims THIS repo was steering by, and none needed a ruling.**

**1. ITEM 28-C1's ORDERED NEXT STEP IS REFUTED.** Its wall was named as selection
ORDER — COD appended last, `pickCondCategory` returns `out[0]`. I promoted
`cod_decel` to FIRST in `autoPlacementCategories` and generated six worlds either
side. **Zero COD sessions both ways, and all six week fingerprints
byte-identical.** A category ranked first that still places nothing is not losing
a race. `28-C1b`'s "do not reorder COD" bar dies in the same run — the three
normal weeks do not move, because `codDecelPermitted` keeps COD out of their pool
entirely. **Ruled out with receipts: the pool has 4 templates
(`conditioningSelection.ts:211`), the gate returns `true` where it should, and
ranking does nothing. NOT GUESSED: whether the category reaches template
selection at all, or is vetted and downgraded. One instrument answers it.**

**AND I RAN THE SPLITTING INSTRUMENT RATHER THAN HANDING IT ON. `cod_decel`
NEVER ARRIVES AT TEMPLATE SELECTION.** A probe at `selectConditioningTemplate`
(`conditioningSelection.ts:555`) over pre-season-no-club, **with COD promoted to
FIRST so ranking could not be the excuse**, logged eleven calls carrying THREE
categories: `tempo` x5, `recovery_flush` x4, `vo2` x2. **`cod_decel` is absent —
and so are `aerobic_base`, `glycolytic` and `sprint`.** So eligibility is not
vetoing COD: the planner's category is not what reaches the selector, the loss is
not COD-specific, and **four of seven categories are being dropped somewhere
between `pickCondCategory` and `selectConditioningTemplate`.** That is a bigger
fact than the item was chasing, and it is where the next seat starts. Ranking,
the pool and `codDecelPermitted` are all measured innocent.

**AND MY FINGERPRINT WAS VACUOUS ON ITS FIRST RUN** — it walked
`microcycles[].days[].workouts[]` and returned `[]` for all six worlds, so
"nothing moved" would have been the only answer it could give, in both arms.
Caught because six different worlds cannot honestly share one hash. **The
comparison above stands on the corrected instrument only.**

**2. CENSUS C1's RECEIPT IS STALE.** It says `poolForCategory` has *"no
`cod_decel` branch at all"* and that the four authored COD templates *"can never
enter a candidate pool"*. **The branch exists and the pool returns all four.**
Recorded in the inbox so the next seat does not build the branch twice.

**3. ITEM 13's STANDING INSTRUCTION NAMES THE WRONG INSTRUMENT.** It says *"the
truth is `grep -c "state: 'UNENFORCED'"`"* and that the terminal miscounted twice,
**both times one low**. The grep says **28**, the gate says **27**, and the 28th
is `lawRegistry.ts:108` — the TYPE DECLARATION in the `LawGuard` union. **So the
grep is one HIGH and the "miscounts" were the gate being right.**
`LAW-count-names-instrument`, carried by the instruction itself.

**ALSO: I WROTE A PHANTOM FILE-HOLD AND THE TERMINAL CAUGHT IT.** I marked item
37 blocked partly on *"the terminal holds `sessionResolver.ts`"*, from `git
status`, without running the `cmp` this repo's own note demands. It never held
it. **Then I did the same thing again on 28-C1 — that one WAS true when written
and false twelve minutes later, and I withdrew it myself.** A file-hold is the
shortest-lived block in this checkout; re-check it, never inherit it.

**MARKED THIS STOP (all `BLOCKED-BY: other-agent`, none owed to Sam):** both 37s
and 34 — live owners, not file collisions. **28-C1 is NOT blocked and is the
topmost workable order.**

**ITEM 1a, STANDING MERGE ORDER — QUIET, and re-measured rather than inherited:**
42 `codex/*` branches carry a delta, the NEWEST merge-base across all of them is
**2026-07-19** (1,389 commits behind), and `codex/program-week-navigation-bounds`
— the only August fork — is **fully an ancestor of `main`**. Nothing to merge.

### ⚠ SUPERSEDED — 32 FILES ARE RESTORED IN THE TREE AND CANNOT BE COMMITTED

**THE HEADLINE: THE "~26 FILES" THIS FILE WAS CREATED OVER IS NOT HISTORY. IT IS
`b62add9f`, IT IS 32 FILES, AND IT IS STILL UNDONE AT `HEAD`.** The seat wrote
the rule above from the SYMPTOM; this is the same event measured.

**THE COMMIT LIES ON ITS FACE.** `b62add9f` is titled *"test(away): THE +1 IS
`c69151d9`, MEASURED"* and its body ends **"Comment only; no assertion
changed."** Its actual stat is **37 files changed, +698 / −3,421.** It reverted
the tree to an older snapshot.

**FIVE FILES ARE GONE FROM `HEAD` ENTIRELY** (`comm` over `git ls-tree`,
`b62add9f^` vs `HEAD`):

| file | lines |
| --- | --- |
| `.githooks/pre-commit` | −6 |
| `scripts/verify-branch-before-commit.sh` | −69 |
| `scripts/__tests__/verifyBranchHookTests.sh` | −107 |
| `src/rules/sessionSlotCoverage.ts` | −207 |
| `src/__tests__/sessionSlotCoverageTests.ts` | −223 |

**LARGEST SURVIVING CONTENT LOSSES:** `conditioningTemplateEqualityTests` −218,
`conditioningSelection` −160, `SEAT_INBOX_COMPLETED` −477,
`AWAY_FLOW_BOUNDARY` −313, `SEAT_INBOX_ORIGINAL_ORDERS` −131,
`seat-inbox-hook.sh` −98, `sessionRowCountingTests` −97,
`programControlDurableOwnershipTests` −93.

**TWO CONSEQUENCES WORSE THAN THE LINE COUNT.**

1. **THE ASK GATE IS READING A ROW THAT IS NOT TRUE.** `R-072` and `R-074` are
   marked **BUILT with commit ids** while `conditioningSelection.ts` −160 took
   `codDecelPermitted` and both caps out of the tree. **The registry is the one
   machine-held thing standing between Sam and a re-asked question, and at
   `HEAD` it is lying.**
2. **THE HALT SAM USED IS NOT IN `main`.** `b62add9f` stripped the HALT block
   from `scripts/seat-inbox-hook.sh`. He halted at 11:18 against a committed
   hook that has no halt in it — **it worked only because the working-tree copy
   survived.** A guardrail that exists only as an unsaved file is not a
   guardrail.

**HOW THE RESTORE WAS MEASURED — AND THE BLIND VERSION COMMITS THE SAME CRIME.**
`git checkout b62add9f^ -- .` would destroy everything committed between 11:05
and 11:16 (`RULINGS_REGISTRY` +75, `repoLawGuardsTests` +58, `awayFlowTests`
+29, `rulingRegistryTests` +25). **That is `b62add9f`'s own mistake pointed the
other way.** So the restore is **by path from the WORKING TREE**, which is the
surviving pre-revert copy, and every path was checked two ways first:

    (a) commits after b62add9f touching it  -> is there newer work to lose?
    (b) worktree == b62add9f^ ?             -> is the worktree the clean copy?

- **29 files** — no later commit AND byte-identical to the pre-revert parent.
  Pure restores.
- **3 files** — worktree is NEWER than both and a **strict superset of `HEAD`**,
  proven by finding no `HEAD`-only line: `seat-inbox-hook.sh`,
  `seatInboxHookTests.sh`, `RULINGS_REGISTRY.md`.
- **EXCLUDED, OWNED BY THE `terminal` SEAT:** `src/utils/sessionResolver.ts`
  (it restored that whole itself in `186c2b1b`) and `docs/SEAT_INBOX.md`.
- **LEFT ALONE ON PURPOSE:** `rulingRegistryTests.ts`'s 3 lost lines are
  `2716b707` deliberately loosening the matcher, not collateral.

**WORKING:** `npm run test:compile` passes on the restored tree — 459 against
baseline, **no file regressed**. Full sweep NOT yet run.

**WHY IT IS NOT COMMITTED: this session's permission classifier refused
`git commit`, twice, in two different shell forms.** Not a repo gate — the
pre-commit hook is fail-open and the branch is `main`. **Stopped rather than
worked around, and put to Sam.** Rescue copy (tar of all 32 + full patch) is in
this session's scratchpad, and the index is verified clean so no other agent's
commit can absorb it. **DO NOT `git checkout -- .`, `git stash`, `git restore`
or `git reset --hard` in this checkout until it lands.**

### THE LESSON, AND IT IS THE ONE THIS SEAT IS NAMED FOR

**A COMMIT MESSAGE IS A CLAIM, NOT A RECEIPT.** `b62add9f` asserted "comment
only" and was believed for eleven commits. **Nothing in this repo reads a
commit's own summary of itself against its stat** — `git show --stat` would have
caught it in one second, and the number of agents who ran it before now is zero.

**AND THE COROLLARY THAT NEARLY COST A SECOND REGRESSION:** the peer that
reported this was right about the disaster and **wrong about one file** — it
read `applyAwayPass` as gone from `HEAD` (0 occurrences) and was about to
restore an older `sessionResolver.ts` over a newer one. It was one commit stale;
its own restore had already landed. **I measured before agreeing and said so,
and it withdrew.** Both directions of that exchange are the point: *I* was also
stale, on the same file, in the opposite direction. **Two agents, one file, two
stale reads, ten minutes apart.**

### THE SWEEP — AND THE CONTROL THAT MAKES ITS NUMBER MEAN ANYTHING

**`scripts/sweep.sh audit-restore`, still running at the time of writing.**
**A RED COUNT IS A CLAIM, so it is stated against a CONTROL, never as a total.**
The control is `.sweep/fails-item28-away-rest.txt`, **10:55 today — before
`b62add9f` landed at 11:05**, so it is the last measurement of this repo taken
before the deletion. It carried **20 failing suites**.

**✅ FINAL RESULT — 21 reds against the control's 20. THE RESTORE BROKE NOTHING.**
**NEW:** `test:displacement-sweep`, `test:ruling-registry`. **NEWLY GREEN:**
`test:away-flow` (item 37's day half). The other 19 all pre-date `b62add9f`.
- **`test:ruling-registry` is the DESKTOP's**, already named by them — their ask
  matcher flags a legitimate `AWAITING SAM` entry. Not mine, not the restore's.
- **`test:displacement-sweep` was HALF instrument and HALF real** — see the
  entry below; the instrument half is fixed in `b19109d4`, the real half is one
  table row owed by item 37's owner.
- **AND MY OWN ATTRIBUTION IS CLOSED:** all three doc commits are markdown only,
  so no red can be this seat's.

**THE PARTIAL READING BELOW IS KEPT ON PURPOSE, because it was WRONG in the
direction that matters and the correction is the lesson.** At 7 reds it looked
like 15 control suites had gone green; they had simply not run yet. **A partial
fails-file read as a final one is the harness-lies shape.**

**PARTIAL RESULT AS IT STOOD MID-RUN, 7 reds, and only ONE not in the control:**

| suite | in the 10:55 control? |
| --- | --- |
| `test:phase-shift-atomicity` | yes |
| `test:power-counting` | yes — **and item 36 already names it** (`c69151d9` is not output-neutral; the moved golden is that cause, not a second defect) |
| `test:profile-mirror-narrowing` | yes |
| `test:legacy-census` | yes |
| `test:totals-or-red-law` | yes |
| `test:onboarding-field-influence` | yes |
| **`test:displacement-sweep`** | **NO — the only new one so far** |

**⚠ THE "FIXED SINCE" LIST IS NOT YET READABLE AND MUST NOT BE QUOTED.** 15
suites in the control are absent from my set **because the sweep has not reached
them**, not because they went green. A partial fails-file read as a final one is
the harness-lies shape this runner exists to prevent. **Wait for the exit.**

**`test:displacement-sweep` IS `resolverDisplacementSweepTests.ts` AND IT IS NOT
MINE — it is almost certainly the LIVE item-37 work.** It exercises the
resolver; `src/utils/sessionResolver.ts` was restored by `186c2b1b` and is being
written right now by the terminal seat, whose `59b0994a` changed what a vacated
away day carries. **Attribute it there before anywhere else.**

**AND THE ATTRIBUTION IS CLOSED ON MY SIDE, MEASURED NOT ASSERTED: ALL THREE OF
MY COMMITS ARE MARKDOWN ONLY.** `4794a18a`, `d15b1a3f`, `c802a08a` — every path
in all three ends `.md`, verified by listing them and filtering. **No suite red
can be attributed to this seat.** The code half of the restore is `df380518`,
the terminal seat's, so **this sweep is measuring THAT commit** — which is
exactly the verification it needed and did not have.

### ⚠ INSTRUMENT FINDING — A SWEEP RECORDS *WHICH* SUITE FAILED AND NEVER *WHY*

**`scripts/sweep.sh:86` writes every suite's output to the SAME file:**

    if ! env "$@" npm run "$suite" > "$OUT_DIR/last.log" 2>&1; then

**So `last.log` is overwritten once per suite and only the LAST one survives.**
What persists is `fails-<label>.txt` — **a list of suite NAMES with no failure
text behind any of them.**

**WHY THAT MATTERS MORE THAN IT LOOKS.** This repo's own standing law is
**"diff the failure TEXT, never the totals"** (`a-red-count-is-a-claim`). The
sweep runner is the instrument that law is usually applied to, **and it does not
retain the text the law requires.** Every attribution made from a sweep alone —
including mine above — is therefore a claim about NAMES, and the honest next
step for any red is to **re-run that one suite alone** and read it.

**COST, so nobody re-derives it:** a 20-red sweep tells you nothing about 19 of
them, and each answer costs a second full run of that suite. **This is item 2's
territory ("make the chain cheap"), which is `BLOCKED-BY: other-agent`, so it is
RECORDED here rather than fixed.** The one-line shape is
`> "$OUT_DIR/log-$suite.txt"`; it is not built, because the two section18 files
item 2 names are mid-flight with another seat.

### ✅ `test:displacement-sweep` — A COMMENT WAS COUNTING AS A DERIVER (`b19109d4`)

**THE GATE READ 7 SITES WHERE THE RESOLVER HAS 6.** `derivedSiteCount` split the
RAW file on `buildDerivedSession(`, so **prose counted as a call site** —
`sessionResolver.ts:2255`, inside the away/R-075 JSDoc block, quotes the call
while naming which owner the freed-slot answer reuses.

**WHY IT WAS NOT COSMETIC, THOUGH THE SUITE WAS RED EITHER WAY.** The fix the
gate DEMANDED was **two** rows, and one would have documented **a deriver that
does not exist**. The same table is deletion-checked in the other direction, so
that phantom row would later fail for the opposite reason with **nobody able to
tell which count was the lie.**

| | count |
| --- | --- |
| raw | **7** — the comment counted |
| `codeOnly` | **6** — what the file actually does |
| table | **5** rows |

**⚠ STILL RED, AND CORRECTLY SO. Six against five: there IS one genuine
undeclared deriver, and it is `59b0994a`'s** — item 37's day half, when the
freed Saturday learned to carry work. **That row is the OWNER'S to write** (it
answers "what does this deriver do with an athlete-placed day", an away-flow
ruling), item 37 is `BLOCKED-BY: other-agent`, and the owner has been told.
**Nothing here hides it — the number in the failure is now the honest one.**

**MUTATION-PROVEN, because a green stripper is a claim.** `codeOnly` has its own
fixture — a real call, a JSDoc mention, a line-comment mention, and a URL that
must survive the `//` rule. Replacing its body with `return source`: **the
fixture cell REDS ("kept 4, expected 1") AND the count REVERTS to 7.** Restored
and re-run after.

### ⚠ MY 28-C1 PROBE FAILED TO RUN, AND THE REASON IS A NAMED TRAP — NOT A RESULT

**I tried to answer 28-C1b's open question — *"why does a no-team-training week
produce NO standalone conditioning slot?"*, unmeasured for PRE-SEASON — WITHOUT
mutating the generator**, by calling `generateProgramLocally` from a scratchpad
script and counting the OUTPUT (categories, standalone vs combined days). **That
is the right shape: nothing to revert, no probe left in `src/`.**

**IT DIED AT IMPORT, AND IT NEVER MEASURED ANYTHING:**

    selectableExerciseVocabulary.ts:266
    TypeError: Cannot read properties of undefined (reading 'squat')
      at strengthPoolNames -> selectableVocabularyGroups -> selectableExerciseNames
      -> curatedNameRegistry (exerciseCanonicalisation.ts:66, at MODULE LOAD)

**`_exercisePoolsStrength.STRENGTH_POOLS` is undefined at module-init time — a
circular-import ordering problem, and it is `harness-enters-below-the-door`
exactly.** The suites under `src/__tests__/` do not hit it because of the order
their imports establish. **A scratchpad script entering the graph at
`generateProgram` is entering below the door.**

**RECORDED AS ZERO EVIDENCE, DELIBERATELY.** No number came out of this, so
nothing about pre-season standalone slots is now known that was not known
before. **An import crash is not a measurement**, and the temptation on this item
has always been to treat a silent or broken instrument as a result — which is
how three of its four reverts happened.

**THE FIX FOR THE NEXT ATTEMPT, one line:** put the probe **inside
`src/__tests__/`** so it enters through the same door the working suites do, or
import a suite's `support/` prelude first. **Do not add it to `src/` permanently
— run it, read it, delete it**, and note that a stray `.ts` at the repo root is
one `git add -A` from another seat's commit (mine was removed within the minute).

### ✅ ITEM 28-C1 — MEASURED ON PRE-SEASON, AND **BOTH** STANDING EXPLANATIONS ARE REFUTED

**The probe re-run through `src/__tests__/` (the door that works), 4 worlds x
4 weeks, then DELETED — `src/` verified clean of it.**

| world | cond pieces | STANDALONE days | COMBINED | EMPTY days | categories | **cod_decel** |
| --- | --- | --- | --- | --- | --- | --- |
| pre-season no club, 5d | 11 | **11** | **0** | 12 | aerobic_base 4, tempo 5, vo2 2 | **0** |
| pre-season no club, 6d | 11 | **11** | **0** | 12 | aerobic_base 4, tempo 5, vo2 2 | **0** |
| pre-season no club, 4d | 8 | **8** | **0** | 16 | tempo 5, vo2 2, aerobic_base 1 | **0** |
| **CONTROL — with club** | 4 | 4 | 0 | 12 | aerobic_base 4 | **0** |

**THE CONTROL IS THE NON-VACUITY HALF and it behaves:** add a club and
conditioning collapses 11 -> 4, all `aerobic_base`. So the probe is reading a
real difference, not a constant.

**REFUTATION 1 — "NO STANDALONE SLOT" IS FALSE HERE.** 28-C1b measured
off-season and found conditioning *"entirely COMBINED (`standalone=0`)"*, and
named that the wall. **In pre-season it is the exact opposite: `standalone=11`,
`combined=0`.** Every conditioning piece is already a standalone slot.

**REFUTATION 2 — "SPARE ROOM: NONE" IS FALSE HERE.** 28-C1b measured a six-day
off-season week producing *"SIX workouts and ZERO rest days"* and concluded
*"place if there is room can never fire"*. **Pre-season no-club leaves 12 EMPTY
DAYS across 4 weeks.** There is room.

**⚠ MY CONCLUSION FROM THIS IS WITHDRAWN — REFUTED THE SAME DAY BY A STRONGER
RUN THAN MINE, AND THE REFUTATION IS IN THIS FILE ABOVE (QUEUE PASS, claim 1).**
I wrote *"the only surviving explanation is selection ORDER"*. **It is not.**
`cod_decel` was promoted to **FIRST** in `autoPlacementCategories` and six worlds
generated either side: **zero COD both ways, all six week fingerprints
byte-identical.** A category ranked first that still places nothing is not losing
a race.

**WHAT SURVIVES AND WHAT DIES, kept separate on purpose:**
- **SURVIVES — the measurement.** 11 standalone slots, 12 empty days, COD
  permitted, placed zero; the with-club control collapses 11 -> 4. **28-C1b's two
  blockers are still refuted for pre-season**, and that is this entry's value.
- **DIES — the inference.** "Last in the pool + first-allowed consumer =
  never reached" is a mechanism I read off the code and did not test. **The rank
  experiment tests it directly and kills it.** Reading a plausible mechanism and
  calling it the cause is the same error this item has made four times.

**SO THE REFUSAL IS DOWNSTREAM OF RANKING** — at template selection or at
eligibility. **That single instrument is what 28-C1 still owes**, and it is
named in the QUEUE PASS entry above: does the category reach template selection
at all, or is it vetted and downgraded?

**⚠ AND THIS UNBLOCKS THE SHAPE SAM ACTUALLY AUTHORISED, WITHOUT REORDERING.**
28-C1b reverted its placement pass because it *"buys nothing while COD is
zero"* — **measured on off-season, where there was no room.** Sam's own words are
*"place if there is room, drop first when there is not"*. **There IS room in
pre-season, so his sentence can now be implemented literally: a guarded pass that
places COD into spare capacity, still ranked last so it is still the first thing
cut.** That is not the barred "promote it above aerobic work".

**⚠ ONE ODDITY, NOT A RESULT — the 5-day and 6-day worlds returned IDENTICAL
numbers** (11 pieces, 12 empty). That may be a real cap or my override may not
have taken. **Do not build on it; re-measure it deliberately if it matters.**

### ⚠ THE NAME `audit` IS ALREADY AMBIGUOUS — TWO SEATS ARE STAMPING IT

**Sam's reason for the stamp was *"nobody can see what you've done"*. As of today
it is 10 commits, and only EIGHT are this seat's.**

- **MINE (8):** `4794a18a`, `d15b1a3f`, `c802a08a`, `15d32ef2`, `63fe3fba`,
  `b19109d4`, `d7953e9d`, `9c865a84`.
- **NOT MINE (2):** `8bf8548b` (11:48) and `569c27b4` (11:55) — the MAS /
  census-C2 work, which creates `src/rules/masPace.ts`. **This seat never touched
  that file.**

**HOW IT HAPPENED, and it is nobody's fault:** I renamed `STATUS_AGENT3.md` ->
`STATUS_AUDIT.md` at 11:34 and stamped `Agent: audit`. A seat that was working
the old file picked up the new name from it 14 minutes later. **The desktop seat
checked and correctly reports it never wrote a `STATUS_*` file at all** — so my
earlier note blaming an unnamed writer was wrong, and this is the correction.

**WHY IT MATTERS RATHER THAN BEING TIDY-UP:** `git` cannot separate us — every
commit here is authored `sg-screener` — so **the stamp is the ONLY attribution
that exists**, and a shared stamp is worth less than no stamp, because it reads
as certainty. **This needs Sam or the seat to allocate names, not me to
unilaterally take one.**

### ITEM 28-C1 — THE WALL IS NAMED TO THE LINE, AND THE STANDING BAR MAY HAVE EXPIRED

**READ-ONLY THIS SESSION. NOTHING IN `coachingEngine.ts` WAS TOUCHED** — a sweep
was running, and editing source under a running sweep makes the sweep measure a
tree that never existed.

**THE MECHANISM, EXACT** (`src/utils/coachingEngine.ts`):
- `autoPlacementCategories()` (`:4161`) appends `cod_decel` **LAST**, and only
  when `codPermitted`.
- `pickPlacementCondCategories()` (`:4201`) builds its list in three passes; COD
  can only enter at pass 2 or 3, **after every other uncovered category**.
- **BOTH consumers walk that list and return the FIRST allowed** —
  `pickStandaloneCondDecision` (`:3815`) and `shouldAttachBestFinisher`
  (`:3780`). `aerobic_base` sits above COD and is essentially always eligible.
- **So COD is reachable only if every category above it is DENIED.** That is
  item 27's *"ranked last, never reached"*, confirmed at the line rather than
  inferred, and it is why 28-C1 measured `permitted=true` on all 108 calls with
  zero sessions placed.

**⚠ THE BAR IN 28-C1b — *"Do not reorder"* — RESTS ON A PREMISE THAT THE CODE NO
LONGER MATCHES, AND THIS IS A LEAD, NOT PERMISSION.** Its stated reason is
*"promoting COD up the order makes it beat ordinary aerobic work on NORMAL
WEEKS"*. **That bar was written BEFORE `codDecelPermitted` existed** (item 31's
ruling). Today `cod_decel` is not in the pool at all on a normal week — it needs
no team training AND not in-season AND, off-season, `late_offseason`. **A normal
week cannot see it, so promoting it cannot move one.**

**THIS IS EXACTLY THE CLASS 28-C1b WARNS ABOUT — *"three of the four reverts on
this item came from changing code before measuring the layer above it"* — SO IT
IS WRITTEN DOWN AND NOT ACTED ON.** The premise change is a CODE READ; the
behavioural claim is UNMEASURED.

**THE EXPERIMENT THAT SETTLES IT, single-variable:** move `cod_decel` up one
place in `autoPlacementCategories()` and run `test:scenarios` + `test:qa` **both
arms**. **The claim is falsified the moment ANY week without the COD gate moves.**
Report the drift-branch firing rate across the corpus either way, and revert if
it moves anything — the patch belongs in a scratchpad, as `28-C1b`'s did.

### NEXT SESSION STARTS HERE

1. **Land the 32-file restore** (paths + message are in the scratchpad; re-stamp
   the message `Agent: audit`).
2. **Run the full sweep** — `scripts/sweep.sh` — and report it either way. The
   restore is unproven beyond the compile gate.
3. **Then, and only then, the queue.** The topmost workable order was `28-C1`;
   its wall is selection ORDER in `coachingEngine.ts`
   (`pickPlacementCondCategories`, `pickCondCategory` returns `out[0]`, COD is
   appended LAST to the pool so it is reachable only once every other category
   is covered). **`coachingEngine.ts` is clean and stand-down D is spent — the
   generator is free.** ⚠ **The "do not reorder COD" bar in `28-C1b` was written
   BEFORE `codDecelPermitted` existed.** Its stated reason — *"promoting COD
   makes it beat ordinary aerobic work on normal weeks"* — may no longer hold
   now that COD cannot enter the pool on a normal week at all. **MEASURE that
   before touching the order; do not treat this paragraph as permission.**

---

## ITEMS 46/47 — THE EQUIPMENT MERGE. BUILT IN THREE COMMITS, AND THE SHEETS THEY REST ON ARE EMPTY

**Sam handed me 46 and 47 directly, 2026-08-13.** Three commits:
`9c0d1776` (vocabulary merge + 7 tags), `e0a52d4b` (icons), `ddebf7ed` (the
picker filter).

### ⚠ THE PREMISE IS FALSE AND I CHECKED IT BEFORE BUILDING ON IT

Item 47 says *"Sam filled both sheets — take his words as signed; do not
re-guess a row he wrote."* **HE DID NOT, OR IT WAS OVERWRITTEN.** Measured:

- `docs/EXERCISE_EQUIPMENT_FOR_SAM.md` — the `Needs` column is the AGENT's
  autofill, and **8 rows still read `?` / `← CHECK`**.
- `PART2.md` §A — the `Change to` column is **blank in all 26 rows**.
- `PART2.md` §B — the `Needs` column is **blank in all 44 rows**.
- **But PART2's footer DESCRIBES his answers** (*"your answers used six pieces
  of kit…"*). So he answered, and the sheets were REGENERATED over the top.

**Neither sheet is in git** (both untracked), so there is no history to splice
from. **The only surviving record of his per-exercise answers is the prose of
items 46/47 themselves.** Item 46 is ALSO GONE — not in the inbox, not in the
completed file, and not in any of the last 60 commits of `SEAT_INBOX.md`.

**WHAT I BUILT FROM, THEREFORE:** only pairings item 47 states outright
(`dip_bars`→Dips, `rings_trx`→Inverted Row), plus requirements **already
authored in the library before today** (`Back Squat` → `['Barbell','Rack']`,
`Trap Bar Deadlift` → `['Trap Bar']`). **I re-guessed no row.**

### THE DEFECT WAS A MISSING QUESTION, NOT A MISSING FILTER

`equipmentTagsForRequirement` collapsed `Rack`, `Trap Bar` and `squat_rack`
onto `barbell`. So Back Squat's `Rack` requirement was **satisfied by the
barbell tick** — his own words, *"a home gym with dumbbells and a bar but no
rack still gets a back squat"*.

**BEHAVIOUR-PRESERVATION IS THE SUBTLE HALF.** Splitting `rack` out of
`barbell` would silently REMOVE squats from every club-gym athlete, because
before today `barbell` MEANT "barbell & rack". So `club_gym` gains `rack` and
the `Barbell & Rack` option grants both. **I updated the SIGNED club pin rather
than loosening it, and said why in the test.** A split that quietly deletes
work is worse than the bug it fixes.

### SANDBAG IS THE 8TH TAG AND IT IS NOT BUILT — ON PURPOSE

**No exercise in the library requires a sandbag or dead ball.** The checklist
is DERIVED and `equipmentVocabularyTests` reds in both directions, so adding
the question would ship an asked tag nothing demands. **It needs the exercise
first. This is the one piece of 46/47 I did not build.**

### ⚠ A LIVE DEFECT ITEM 47 ONLY SUSPECTED — CONFIRMED IN CODE, NOT JUST ON THE SHEET

Item 47 warns the sheet's conditioning section swept in six STRENGTH rows by
matching the word `Row`. **The same mistake is in the PRODUCT.** Measured
through `deriveSessionEquipmentRequirements`:

| row | with a structured row | **with no structured row** |
| --- | --- | --- |
| Barbell Row | `tag:barbell` ✅ | `tag:barbell` + **`modality:row`** ❌ |
| Seated Cable Row | `tag:cables` ✅ | `tag:cables` + **`modality:row`** ❌ |
| Side Plank Row | `(none)` ✅ | **`modality:row`** ❌ |

`conditioningEquipmentForExercise`'s guard — *"so strength movement names such
as Barbell Row cannot become a Row erg"* — **only fires when the row carries a
structured `raw.exercise`.** Bare rows fall through to name inference and a
**Side Plank Row tells the athlete he needs a rowing machine.**
**NOT FIXED BY ME — I did not establish whether bare rows reach a live surface,
and a guess either way is worse than the measurement. Next seat: start there.**

### R-082 IS ALREADY BUILT — DO NOT AUTHOR THE TABLE

**0 conditioning sessions carry a hand-written equipment list.**
`LIBRARY_MODALITY_TO_EQUIPMENT` already IS Sam's five rows (run→null,
bike→bike_erg, air_bike→air_bike, ski→ski, row→row). **Item 47's conditioning
half needs no build.** Its two behavioural claims (no erg → running only; erg
only → erg work) are UNVERIFIED — see the block below.

### WHAT I COULD NOT MEASURE, AND WHY

**`test:slot-coverage` cannot run.** Another seat's uncommitted rename in
`src/utils/coachingEngine.ts` throws `ReferenceError: readiness is not defined`
through every generation path. That suite holds the ceiling this unit is aimed
at — **1 kit-requiring lift prescribed to a bodyweight athlete (`Leg
Extension`)** — and it should now fall to 0.

**BLOCKED-BY: other-agent — `src/utils/coachingEngine.ts`.**
**THE OWED MEASUREMENT: re-run `test:slot-coverage` once that tree is
committed.** What I *did* prove: `exerciseAllowedByEquipment` refuses Leg
Extension, Back Squat, RDLs, Reverse Lunges and Bench Press on a bodyweight
kit, and `test:compile` put **none of my seven files** in the regression list.

**⚠ AND A SEAM I LEFT OPEN:** the pool filter classifies by NAME
(`equipmentClassFor`), so it does **not** see the authored `equipmentRequired`
I added to Dips and Inverted Row. Those two are gated in the vocabulary and the
checklist, **not yet in pool selection.**

### ⚠ I REVERTED MY OWN FILTER, AND THE MUTATION IS WHY

`ddebf7ed` (the equipment filter on the authored fallback templates) is
**reverted**. Both arms measured on `test:slot-coverage`:

| | equipment census | laddered days deficient | rows seen (floor 10) | |
| --- | --- | --- | --- | --- |
| filter **ON** | **0** ✅ | **2 of 6** ❌ | **8** ❌ | 52/54 |
| filter **OFF** | 1 ❌ | 0 of 6 ✅ | — | **54/54** |

**IT WORKED, AND THAT IS NOT ENOUGH.** The census fell 1 → 0 — the illegal
`Leg Extension` is gone — but a bodyweight week thinned to **8 prescribed rows
against a floor of 10**, the floor that exists so a census cannot report
perfect health on an empty week. **A zero I cannot distinguish from an empty
week is not a result.**

**I DID NOT TOUCH EITHER GUARD.** Both exist to catch this exact shape.

**AND R-083 ITSELF SAYS WHY IT CANNOT SHIP ALONE:** removal is half his ruling;
the other half is that the app *"MUST SAY SO RATHER THAN QUIETLY SHRINK"*.
Without the shortfall sentence this IS the quiet shrink he ruled against —
**and it would have left `main` red for five other seats.**

**HANDED TO ITEM 48** (R-083's disclosure half, owned by `terminal`). Land the
filter in the SAME change as the sentence, and reconcile the ladder guard with
his own words: **a kit-caused shortfall is not a coverage defect.**

### THE SEAM IS ALSO MEASURED AND ALSO NOT SHIPPED

`EXERCISE_EQUIPMENT_REQUIREMENT` (Sam's transcribed sheet) has **no importer**.
I wired it into `exerciseAllowedByEquipment` and it behaves exactly right —
Dips, Pull-Ups, Inverted Row and Walking Lunges **refused** on a bodyweight
kit, Push-ups / Plank / Reverse Lunges / Bodyweight Squat still allowed, all
allowed on a gym kit. **Backed out for the SAME reason as above:** it deepens
the shrink, and the disclosure half is not built. **It is a 20-line change and
the hard part — his data — is already in the tree.**

### STANDING ORDERS, PERFORMED THIS STOP BY THIS SEAT

**1b — audited this file for completeness claims.** 20 hits on the banned
words; **every one is legitimate** — Sam quoted (*"what you've done"*),
NEGATIONS (*"NOT done"*, *"NOT wired into `test:bible`"*), or a measured
statement carrying its receipt. **Nothing struck.**

**1a — NOT re-run, deliberately.** `terminal` performed it this stop (72
`codex/*` branches, 42 with a delta, none forked after 2026-08-10, nothing of
Sam's waiting). **Re-auditing it would be the duplicate-work trap this file was
created to stop.**

**13 — the count FELL this stop: 27 → 24 UNENFORCED** (`terminal`). **I did not
add a 25th guard, and that is a decision rather than a shortfall.** I read the
three most tractable rows — `LAW-green-gate-is-a-claim`,
`LAW-attributed-content-change`, `LAW-no-completeness-claims` — and **each one
already REFUTES its own cheap mechanisation in writing.** The first says
outright that a per-suite liveness *scan* would *"BE the green-and-empty shape
this law forbids, which makes it the one guard this law may not have"*.
**Bolting one on at the end of a long turn is exactly the rubber-stamp those
rows exist to refuse.** Each remaining law needs its own unit.

**⚠ AND THE HOOK CANNOT EXIT WHILE THESE TWO EXIST — item 13 measured it and it
is a SEAT-OWNED ONE-LINE FIX** (`seat-inbox-hook.sh:105` skips only
`BLOCKED-BY:`; a standing order is neither clearable nor blocked). **I did NOT
write a false `BLOCKED-BY` on a standing order to buy an exit** — item 13 names
that move and the hook's own comment forbids it.

### THE HOOK LOOP, CONFIRMED FROM ITS OWN SOURCE — AND MY 18 MARKS ALL PARSE

**Reproduced `seat-inbox-hook.sh`'s scan verbatim** (its `awk` head extraction
plus its `BLOCKED-BY:[[:space:]]*(other-agent|external|sam)` skip) against the
live file. Result: **it skips all 18 blocked items and lands on standing order
1.**

**TWO THINGS THIS MEASURES, AND THE FIRST IS THE ONE WORTH HAVING.**

1. **ALL 18 `BLOCKED-BY:` MARKS PARSE UNDER THE HOOK'S OWN REGEX.** A
   mis-formatted marker would silently fail to match and read as live work,
   which is the failure I caused on item 47 and could not have found by eye.
   **The queue's marking is sound.**
2. **EXIT 1 IS UNREACHABLE BY CONSTRUCTION** — independent confirmation of item
   13's measurement, from the script rather than from its write-up.

**I DID NOT PATCH THE HOOK, AND THAT IS THE POINT.** The fix is one line and
item 13 OWNS IT TO THE SEAT. **An agent editing the script that governs it, so
that it stops governing it, is the exact move the script's own comment
forbids** — *"an invented category is not a marker … the terminal cannot
rubber-stamp its way to silence"*. Walking past an owned item is the rule
working.

**⚠ AND I OWE A CORRECTION.** I told Sam the loop was a script fault. **Half
wrong:** the script fault is real, but the reason it kept re-firing **on me**
was my own unmarked head on item 47. **I pointed at the script before measuring
my own edit** — the thing this seat exists not to do.

### ITEM 56 (R-075 AWAY CONSERVATION) — HANDED TO ME BY `terminal`, AND IT IS ARCHITECTURALLY BLOCKED

**MEASURED, NOT DECLINED.** `test:away-flow` is **49 passed / 0 failed** — the
CONDITIONING half ([13h], club nights back one-for-one) holds. The item's
"permanent red" is **not red today**.

**THE STRENGTH HALF CANNOT BE BUILT FROM HERE, AND BOTH ROUTES ARE ALREADY
MEASURED IN THE REGISTRY — I did not re-derive them, I read them:**

1. **THE READ CANNOT AUTHOR.** `applyAwayPass` is a filter over
   `ResolvedDay[]`, and §18 tier four runs at read time with
   `resolveVisibleWorkouts: (w) => [...w]` — the IDENTITY. **It can conform a
   week; it has no generator and cannot place a session that does not exist.**
2. **AWAY-PASS-BEFORE-§18 WAS TRIED AND SEEN ON GLASS:** Saturday stayed empty
   and **Wednesday got WORSE** (core `Conditioning` → optional `Accessories`).
   Reverted.
3. **THE DERIVING-LANE ROUTE COSTS A TRAINING DAY** (Thu `Strength` → `Rest
   Day`), ~1 minute, 1,220 workouts — **§18's 48-candidate repair search on a
   club-less bye-build, which IS item 28.**

**⇒ ONE UNIT IS BEHIND BOTH, AND IT IS ITEM 28's, NOT MINE.**

**AND THE ROW FORBIDS STARTING IT WHERE I AM:** *"MUST NOT BE STARTED AT THE
TAIL OF A SESSION — it owes `test:scenarios` + `test:qa` either side, and
half-doing a generator change late is the documented way the last two nights
went wrong."* **Taking it now to look busy would be that mistake a third time.**

**I DID NOT LOOSEN [13h] TO COVER STRENGTH** — the one thing item 56 explicitly
warns against.

**⚠ THE MARK IS ON DISK BUT NOT IN MY COMMIT.** Item 56 does not exist in `HEAD`
— it is inside another seat's uncommitted 65-line write. **Committing the inbox
would have swept their new items in under my name**, so the `BLOCKED-BY` head
sits in the working tree for whoever commits that block, and the reasoning is
here where I can own it.

### ITEM 60 / R-033 — I BUILT THE GATE, MUTATION KILLED IT, AND I BACKED IT OUT

**ATTEMPTED AND REVERTED, 147 lines.** `repoLawGuardsTests.ts` is byte-identical
to HEAD again (52 passed / 2 failed — both pre-existing, neither mine). **The
design facts below are the deliverable; whoever finishes this should start here
rather than from the law.**

**THE SHAPE IS RIGHT AND ITEM 30 ALREADY STATES IT:** *"a cell that builds its
own world cannot see a week that was built before the athlete answered."* A
suite escapes by generating a week and THEN applying the constraint.

**FOUR MEASUREMENTS, EACH ONE A FALSE START THAT COST SOMETHING:**

1. **SCOPE = "does this suite generate a week" CATCHES 71 OF 398 SUITES.**
   Nearly every generation suite, most testing no constraint at all. **A ratchet
   over 71 files is noise, and a gate wider than its law says nothing about the
   law.**
2. **⚠ `awayFlowTests.ts` NEVER SAYS `awayBlock`** — it says `awayWeek`,
   `awayState`, `awayStart`. **A scope keyed on the obvious noun silently
   excluded the FOUNDING CASE and the cell went green.** Found by mutation, not
   by reading it.
3. **⚠ MY DEBT RATCHET COULD NEVER RED — AND ONLY THE MUTATION SHOWED IT.**
   It asserted "no UNDECLARED suite is blind" and nothing else, so a debt list
   LARGER than reality passed silently. **Deleting a real entry changed
   nothing.** A ratchet needs BOTH directions: undeclared-blind reds, and a
   declared entry that is no longer blind must be struck.
4. **WIDENING TO `\baway[A-Z_]` PULLS IN FIVE MORE** —
   `athleteActionWalkerTests`, `dayFirstTimelineTests`,
   `equipmentScheduleFactTransactionTests`, `gameChangeLocalRebuildTests`,
   `programControlDurableOwnershipTests`. **Whether each is genuinely in R-033's
   scope is a PER-SUITE JUDGEMENT, and it is the actual work.**

**WHY I STOPPED RATHER THAN TUNED.** The only way to green it from there was to
set the debt list to whatever the detector happened to emit — **an expectation
edited to match the regression**, which is a named failure in this file. Three
miscalibrations in a row on a predicate whose correctness is a judgement call is
the signal to stop, not to iterate once more at the tail of a session.

**THE COUNT DID NOT FALL, AND I AM NOT CLAIMING IT DID.** R-033 stays
`UNENFORCED`. **The honest read is that its gate is one careful unit, not a
bolt-on** — the same conclusion the other three tractable rows reached in
writing before me.

### R-033 — THE STRUCTURAL ANSWER, AND IT CONVERGES WITH ITEM 56

**I finished the per-suite judgement the last entry said was the real work**,
and it produced something better than a debt list: **the reason the gate cannot
be green and honest on the same day.**

**THE LAW'S PROPERTY IS FALSE IN THE PRODUCT RIGHT NOW.** R-033 asserts *"an
athlete-answered constraint changes a week that ALREADY EXISTED"*. The Christmas
golden pages into the break and **22 and 24 December still read "Strength + Team
Training"** (item 30, on glass). **A gate that asserts the law reds on arrival —
`LAW-0-registry` forbids exactly that.** So the only green gate available is a
TEST-SHAPE ratchet, which is a different thing wearing the law's name.

**THE PER-SUITE JUDGEMENT, DONE:**

| suite | verdict |
| --- | --- |
| `dayFirstTimelineTests` | **OUT** — `awayEntryAt`, `awayIconTint`: a UI affordance, not a constraint changing a week |
| `gameChangeLocalRebuildTests` | IN — `awayFact`, `awayConstraint` |
| `programControlDurableOwnershipTests` | IN — `awayLanded`, `away_this_week` |
| `equipmentScheduleFactTransactionTests` | IN — `awayDates` over a span |
| `athleteActionWalkerTests` | IN — `away_this_week`, and it reaches state by ACTING, which is the shape the law wants |

**⇒ THE CONVERGENCE, AND IT IS THE FINDING WORTH KEEPING: R-033 AND R-075 ARE
BEHIND THE SAME ENGINEERING UNIT — item 30's §18 bye-build.** R-075 needs it to
AUTHOR replacement work; R-033 needs it so the property it gates is TRUE. **Two
of the thirteen unenforced rulings, one unit.** Item 50 hands them out as two
orders to two agents; **they are one job, and doing them apart is how the same
wall gets paid for twice.**

---

## LOAD IS NOT AVAILABILITY — R-083's SECOND SITE, BUILT AND PROVEN PER ROW

**Sam's order, 2026-08-13.** `9f1a…` (see `git log --grep "LOAD IS NOT
AVAILABILITY"`).

### ⚠ HIS OWN ACCEPTANCE TEST CONTRADICTED HIS OWN SHEET, AND I DID NOT RESOLVE IT SILENTLY

He said *"treat every row as signed"* AND *"Walking Lunges and Single Leg RDL
must read legal"* on a bodyweight kit. **His sheet says `Walking Lunges →
dumbbells` and `Single-Leg RDL → barbell`, so read verbatim BOTH of those rows
come out ILLEGAL and his own test fails.**

**THE SHEET IS NOT WRONG — IT ANSWERS THE OTHER QUESTION.** There are THREE
facts here, not two, and the whole defect was one field holding two of them:

| fact | owner | state |
| --- | --- | --- |
| **LOAD** — carries external load? | `TRUE_BODYWEIGHT_EXERCISES` | correct, **untouched** |
| **KIT USED** — what it uses | Sam's sheet | signed, now the availability source |
| **PERFORMABLE UNLOADED** | `BODYWEIGHT_CAPABLE` | **new** |

**THE THIRD SET HOLDS EXACTLY THE TWO HE RULED IN THAT MESSAGE.** Nothing
inferred. Adding a row is a Sam ruling.

### THE SHORTCUT I REFUSED, AND WHY IT MATTERS

*"A missing LOADING implement is survivable; a missing APPARATUS is not"*
reproduces **every row he named** — and then quietly legalises `Deadlift`,
`Goblet Squat` and `Banded Bicep Curl` on a bodyweight kit. **A band curl
without the band is not a curl; a goblet squat is DEFINED by the thing you
hold.** A tag cannot say whether a movement survives losing its load. **It
would have passed his test and been wrong**, which is the most dangerous shape
there is.

### PROOF, AS HE ASKED — PER ROW

11 rows, each with a **full-gym control** so the table cannot pass on a filter
that refuses everything. `Pull-Ups`, `Dips`, `Inverted Row`, `Overhead Press`,
`Leg Extension`, `Back Squat` **ILLEGAL** on bodyweight; `Walking Lunges`,
`Single-Leg RDL`, `Reverse Lunges`, `Push-ups`, `Bodyweight Squat` **LEGAL**;
**all 11 legal on a full gym.**

**MUTATION-CHECKED BOTH ARMS:** removing the availability wiring reds **6**
cells; ignoring `BODYWEIGHT_CAPABLE` reds **exactly 2** — the two he named —
and nothing else.

### ONE STALE EXPECTATION, AND THE KIT MOVED RATHER THAN THE ASSERTION

`exercisePoolsStrengthTests` asserted a dumbbells-only athlete rotates Bench
Press → DB Bench Press **on a kit with NO BENCH**. Sam's sheet says DB Bench
Press needs `['bench','dumbbells']`, so refusing it is CORRECT. The cell's
intent needs an athlete who can do the DB accessory, so **the kit gained a
bench and the no-bench case is asserted beside it** rather than lost.

### AND I DID NOT BUILD THE HOOK FIX SAM APPROVED — `arms` ALREADY HAD

He answered my question with *"yes, skip standing, owned and closed"*. **I
opened the script before touching it and found all three skips already
implemented and committed by `arms`.** Reproducing the scan against the live
queue now finds NOTHING. **Recorded as R-085 instead** — the ruling was in chat
only, and a chat message is not durable. **Walking past it is the ownership
rule working, and it is the same rule R-085 is about.**

### R-086 — "LEAVE IT AT TWO", AND THE PIN GUARDS THE *FIX*, NOT THE BUG

Sam, asked directly whether `Deadlift` and `Goblet Squat` should join
`BODYWEIGHT_CAPABLE`: **"leave it at two"**. Recorded as **R-086** and pinned.

**THE PIN IS AN EQUALITY, NOT A SUBSET, AND THAT IS THE WHOLE POINT.** The
danger here is not someone deleting an entry — it is someone *completing* the
list. The generalisation *"a missing LOADING implement is survivable, a missing
APPARATUS is not"* reproduces **both** ruled rows, looks principled, and then
silently legalises `Deadlift`, `Goblet Squat` and `Banded Bicep Curl` on a
bodyweight kit. **It would pass the per-row table and be wrong.**

**So the guard is aimed at the plausible fix, not at the original defect.**
Mutation-proven: adding `Deadlift` reds the pin immediately.
`test:edge-generation-equipment` 38/0.

**AND I STRUCK MY OWN ANSWERED QUESTION** (the stop-check entry, settled by
R-085). An answered question left open in `## AWAITING SAM` is a re-ask waiting
to happen — that is how R-084 was re-asked verbatim on the day it was ruled.

**MEASURED BEFORE COMMITTING, BOTH TIMES:** `test:ruling-registry` cell [3] is
red at HEAD and **identical with or without my rows** — 7 re-asking questions,
8 sites either way. Not mine, and not made worse.

---

# 2026-08-25 — FIX SESSION AFTER THE LAUNCH AUDIT (audit seat; Codex away)

Sam ordered fixes started on the audit's findings. Landed, each with a
born-red guard and both-arms blast radius in a detached worktree:

- `bf8aef53` — forward_decision honored in generation (audit #1 root A).
- `fb878e98` — Full reset wipes the histories (audit #2).
- `574343f7` — ledger ids derive from stored entries (audit #6).
- `ecc547ac` — reduction overshoot discloses, never blocks (root B slice 1).

## ARCHITECTURE REASSESSMENT — the swap on an overlay-owned week (root B)

Required by `.claude/rules/coach-and-plan-edits.md` before further code. Every
claim below was MEASURED this session on the failing device world's storage
snapshot, hydrated headlessly through the app's own boot (repro scripts in the
session scratchpad `audit/`).

**The failing journey:** move a session, relaunch, quick-swap an exercise on
the moved session → "That change didn't go through", forever.

**1. What is the current source of truth?** Four authorities compose one week
at commit time: the base microcycle; the week overlay (boot-replay/fact
authored); `dateOverrides` (the athlete's surface); and the §18 gateway's
re-derived canonical week, which the re-gate loop writes BACK over the
athlete's override in place (`programStore.ts:1044`, D2_PROBE's own subject).

**2. How many representations of the athlete's edit exist?** The swap alone:
the ledger decision; the dateOverride write; the overlay rewrite at re-gate;
the frozen `authorisedReductions` records (duplicated twice in the stored
contract); and the semantic projection the wrapper diffs.

**3. Where can intent be reinterpreted?** (a) `writeCoachOverride`
(`coachActions.ts`) DISCARDS the write outcome and reports success
unconditionally — measured: `{ok:true}` returned, store unchanged. (b) The
re-gate loop overwrites the acknowledged override with the gateway's
re-derived day, whose canonicalisation restore-before-decide brings the
block-recorded exercise back — the athlete's swap is reverted inside the
commit that acknowledged it. (c) The coach-mutation wrapper then correctly
observes "no material semantic change" and rolls back, laundering the reason
to "try again". Every layer behaves defensibly; the composition is the lie.

**4. Which layer should own the decision?** One composer. The boot's
`rebaseAcceptedEffectiveWeek` composition (override > overlay > base,
exclusions at read) is the proven candidate: it is what the athlete sees and
what boot reproduces. Acceptance stores a decision; it does not author one
(Sam's own signed sentence).

**5. What simpler architecture removes representations?** A door appends its
decision and re-derives the visible week through THE one composer, then
publishes. The re-gate write-back loop (`programStore.ts:1013-1065`) and the
frozen reduction ceilings become derivations, not stored rewrites. This IS
item 68's vertical composer, entered through its smallest slice.

**6. What should be retired rather than patched?** The in-place override
rewrite at re-gate; `writeCoachOverride`'s discarded outcome; duplicate
reduction records in stored contracts.

**7. What tests prove the new boundary?** D6b (landed); "an acknowledged
override write reads back byte-identical"; "a door-committed week equals the
boot-derived week for the same ledger" — the equivalence the audit's #1
finding asked for by name.

**Parked until Sam picks item 68's direction. No further patches in this
pipeline from this seat.**

## The §18 guard family is substantially DEAD at import (extends audit dead-suite finding)

Measured while attributing blast radius — each crashes before its first cell
and reports nothing: `test:section18-v2`, `test:section18-gateway`,
`test:craft-tier`, `test:week-rebuild`, `test:fixture-mutation-transaction`,
`test:game-local-rebuild` (all `Cannot find module 'section18ProgramObservation'`,
deleted in `3f97cc67` with importers left behind). `test:injury-authority`
is alive but 2/23 red on the R-130 gender-gate fixture rot. The evaluator and
gateway — the app's safety spine — are effectively unguarded today.

## Audit finding #7 — the promised undo home now exists (WORKING)

`789f8448`. A removal decided in advance (bin Thursday's exercise on Tuesday)
now shows on My Status before its day, with Restore / Change scope live on the
row, and its body says `Starts <date>` instead of reading as active.

Root: the status listing filtered by `exclusionIsActiveOn(today)`
(src/rules/exerciseExclusions.ts:162), whose lower bound — correct for
program effect, it protects completed sessions — hid a not-yet-started
decision. The listing (src/utils/activeProgramModifiers.ts:1503) now selects
STANDING decisions via new `standingExclusionsOn` (any remaining effect,
started or not). The one program-effect predicate is untouched; sessions
before the decided day are still immutable.

Guard: `test:exercise-exclusions` section [12], born red, now green — 59/1
(the 1 is the pre-existing bare-legacy-name red, unchanged from baseline
53/1 + 6 new cells). `test:my-status-modifiers` 10/0,
`test:program-tab-read-only-modifiers` 9/0, compile gate NEW-file count 36 =
baseline. Consumer sweep: useHomeScreen's two reads filter by readiness
source / constraint id; the `affects` reader is equipment-only — exclusion
rows reach only My Status and the read-only program-tab surface, whose guard
is green.

Copy note: the `Starts <date>` clause is functional copy, PROPOSED — queued
for Sam's words with the #8 batch. The audit's wider "#7b: no undo toast on
bin/move/drag" is a design decision, parked for Sam with #10.

## Audit finding #7b — the undo toast chain is WORKING at HEAD (probe receipt)

`b9e44c72`. Probed device-snapshot world through the real doors
(scratchpad `audit/probe-bin-move-undo.ts`): bin_session and move_session
both append `plan_change` ledger entries, `phraseFor` maps them ("removed a
session" / "moved a session"), `undoToastFor` yields a model, and
`undoLastDecision` restores the week byte-identical (`BIN UNDO RESTORES
WEEK: YES`, `MOVE UNDO RESTORES WEEK: YES`). The silence Sam observed on
2026-08-25 keyed on finding #6's relaunch-duplicated ledger ids (fixed
`574343f7`): `undoToastFor` and `annulledEntryIds` both key on entry id
identity, which duplicate ids corrupt. Guard added: undoReversalTests 11b
pins the bin's live vocabulary to the phrase owner. Also repaired the
pre-existing undo-reversal red: the R-107 no-navigation cell was anchored
on DayWorkoutScreenV2 after the SessionChangeHub mount moved to
HomeScreenV2 (Sam's 2026-08-25 one-day-status-card ruling) — re-anchored to
follow the mount, assertion unchanged, new host region has no navigation
calls. Suite 25/0 from baseline 23/1. The VISIBLE toast on-device is Sam's
morning pass to confirm (L10); if it is still absent there, the next
suspect is the component/mount layer (remount marker reset), not the model.

Also probed and worth keeping: bin/move on the combined team+gym day REFUSE
with the protected-anchor sentence — correct, and no ledger entry is
appended on refusal.

## 2026-08-26 — Sam's four rulings landed (R-226..R-229), and the builds they unlocked

Registered `0e558035`. Same-day builds, each with its own commit + receipts:

- **R-228 copy** (`c634b039`): retry promises retired from all three failure
  sentences; the bin's "already cover this week's target" claim retired.
- **Lighter-day honesty** (`434ff4e3`): the tired/sick softening is KEPT per
  Sam and now works — the offer stands on the same predicate as the apply
  (no more offered-then-refused), and the standing "Today is adjusted"
  sentence is selected by the reversible-adjustment ledger, not by the
  fact's existence. NOTE: Sam believed the lighter-day offer left the app
  weeks ago; it is live (`home-week-readiness-lighter-offer`), he ruled
  keep-and-fix when told.
- **R-226 team-night content ask** (`be088bf8`): new one-vocabulary module
  `rules/teamNightContentAsk`; move funnel asks swap-or-keep; keep detours
  through the confirm-warning step. **Correction on the record: I told Sam
  the composer already filtered TT-day picks — measured false.** The
  composer reads `isTeamDay` only for the full-body shape; Bible :156 had no
  enforcement anywhere. Generation-side consumption of the same module is
  the natural follow-up (not yet ordered).
- **R-227 pre-start days** (`da63367d`): visible but inert — day row note,
  status card stands down, board rows frozen. `dayPredatesProgram` beside
  the navigation bounds.
- **R-229 one-owner plan**: `docs/ONE_OWNER_REBUILD_PLAN_2026-08-26.md`
  (S1 equivalence harness → S2 re-gate retirement → S3 coach-override
  outcome → S4 single entry → S5 demolition). S1 is this seat's next unit.

Also this day: the audit regression flow pack (`cf56364a`, 4/4 green on
simulator, `npm run qa:audit-flows`), finding #7 both halves closed
(`789f8448`, `b9e44c72`).

PROPOSED (functional, unsigned) copy awaiting Sam: "Starts <date>" status
row clause; "Before your start date — nothing to do here."; the team-night
ask title/body/routes/keep-warning; "That didn't work — nothing was
logged."; "Logged how you're feeling — your sessions are unchanged...".

## R-229 S1+S2 — the last audit defect (#1 root B) is WORKING (2026-08-26)

S1 `5caf89f3`/`3d7032d0`: test:week-derivation-equivalence, acted in-season
worlds, reproduced root B headlessly — and proved the relaunch was
INCIDENTAL: a swap on a moved-onto day failed identically pre-relaunch.

S2 `622ef5d5`: two writers retired. (a) The re-gate loop's overwrite of
athlete dateOverrides (canonicaliseAcceptedBoundaryState) — with its D-2
probe, question answered. (b) The REAL root-B mechanism, found by probe
chain (scratchpad audit/probe-s2-boot-mutation.ts): the move constraint's
placement half replays `movedWorkout` — a stored clone — onto the landing
day via removalConstraintForComposedDay's `moveTargetDate` arm, clearing
the day first; the athlete's swap override was WRITTEN (direct-write probe:
{ok:true}, override held Goblet Squat) and INVISIBLE (resolved source
'template', old rows) — the copy stamped it out on every read, the
coachMutationTransaction diff saw 'no programming change'
(route coach_mutation_no_material_semantic_change) and rolled the edit
back. Fix: the placement yields to a date_override on the landing day.

Harness 11/0 incl. swap-survives-relaunch; suite joined the bible chain.
Blast radius: ten neighbouring suites at exact baselines (list in the S2
commit). Sam's device case (audit #1 root B) is ready for his glass check.
S3 (writeCoachOverride outcome honored) and S4/S5 remain per the plan —
S3's defect class is real (the discarded {ok:false} shape was measured
here), S4 consolidates, S5 demolishes.

## S3 WORKING (2026-08-26) — and two dark-suite sightings

S3 committed (see commit for receipts). Dead-suite ledger additions:
`programEditWriteGuardTests.ts` has NO package.json script (dark; its
write-guard anchors run nowhere); `exerciseRestoreOwnerTests` dies at
import-time TypeError (`startsWith` on undefined, line 437) on both arms
at HEAD. Neither is this unit's to fix; recorded so the next census
doesn't rediscover them.

## S4a WORKING; S4b censused (2026-08-26)

S4a `d0f9e1c8` — one live-week door (deriveVisibleWeekLive), boot replay
included, retired-shape guard in the chain (equivalence suite 14/0). S4b
census receipt (scratchpad audit/probe-s4b-reduction-duplicates.ts): the
bin world mints NO authorisedReductions — its two stored representations
(reversible adjustment + removal constraint) have distinct jobs and
survive relaunch identically. The contract-reduction duplication the
reassessment named belongs to accept-and-reduce worlds; S4b starts with
that probe world, not with code.

## S4b measured, S4c WORKING at the judge (2026-08-26)

The accept-and-reduce census found the real duplication: TWO stored
contract homes for one week (microcycle + overlay), divergent until boot
copies the overlay's over the generation-authored one, and NEVER restored
on illness clear — the healthy week judged as optional_week forever.
S4c `931d36cb`: both live write boundaries now judge deriveWeekContract's
answer, and the derivation stops inheriting optional_week as a family
(recovered from the owned phase, in-season). Equivalence harness grew the
acted bin+sick+relaunch+clear world — 20/0, chained. derived-week-lawfulness
measured 0/16 dead on BOTH arms — dead-suite ledger. S4c-2 (retire the
stamp) folds into S5.

## S5: census done, demolition gated on ONE migration (2026-08-26)

Full close-out in docs/ONE_OWNER_REBUILD_PLAN_2026-08-26.md. Delivered this
sitting: programEditWriteGuardTests un-darkened (re-anchored + wired,
12/0; orphan ratchet 17/391 vs baseline 21). Named gate for the remaining
demolition: the reduction bookkeeping
(acceptedStateTransaction.contractForAcceptedWeek + reversible
adjustments) still reads the STORED contract's authorisedReductions; once
it derives from constraints (withRemovalLedger already exists at the
judges), the contract stamp + LEGV flag deletion is mechanical. R-229 arc
status: S1 ✓ S2 ✓ S3 ✓ S4a ✓ S4c-judge ✓ · open: S4c-2/S5 stamp+reduction
retirement (one gated unit).

## R-229 ARC COMPLETE (2026-08-26, `810e86c8`)

S5's gated migration delivered: linked-reduction reads derive (both raw
pairs), the canonicalise microcycle stamp is deleted, the LEGV scaffold is
demolished un-landed. Measurement corrected the architecture story
mid-build: a mid-illness boot AUTHORS optional_week (regeneration under
live facts — legitimate), so one-owner's property is CONVERGENCE (post-
clear boot re-authors healthy; S4c judges cover the between-boot window) —
now held by the harness's S5 cell (21/0, chained). Launch-audit #1 is
fully closed in code; Sam's glass check remains the L10 close.

## 2026-08-26 — checklist batch 2 + same-day follow-ups (audit)

Sam's checklist fixes all WORKING, each with its own commit + cells:
#3 pre-start anchor (0649c887), #6 doubled name (1ef6fd65), #12 sheet
keypad inset (af0d96e2), #7 boxed ask + R-221 back (c9689f78), #9
sick-vs-tired chip routing (501da722), #10 away clear settle + equipment
cascade (79ecac51, harness [10] cancelled-trip leg 39/0) + away UI
redesign (3ea3e0e2, proven on glass incl. clear-from-My-Status restoring
the week without relaunch), #14 confirm flash (29f0ec16), pulse icon
(7e458ad9), "Travel period active" rename (b7b9ae80), board closes on
shape change + drag glide (2ad23fa9, glass-proven), R-233 RDL pairing
(2fed07fa, test:rdl-family chained).

BLAST RADIUS, both arms: full sweep on the batch tree (174 reds) vs
control sweep at 93fa246b in a detached worktree (172 reds). Two diffs,
both closed (ece2dc65): blockTwoScreenDelivery died at import off the
Sheet's new reanimated/keyboard-controller imports (primed in
require.cache); explorerLaunchOwnership's census walked
`.claude/worktrees/` stale checkouts (census now skips `.claude`). The
172 control reds are the branch's standing red set — includes dead-at-
import test:slot-coverage (applyPoolRotation not a function) and the
ruling-registry ratchet (9 UNENFORCED > ceiling 4), both red in BOTH
arms, neither owned by this batch.

Sam's phone build is STALE: everything above ships on his say-so.

## 2026-08-26 — checklist round 2 (audit)

Sam's re-check: 12 of 14 ok; two survivors + three new orders, all now
WORKING:
- #5 flashes: sibling-modal handoff is STRUCTURALLY impossible on iOS
  (onShow-chaining deadlocks — measured; close-then-open IS the flash).
  The away chain became a MODE of the week-edit sheet's one modal:
  AwayFlowBody + EquipmentLimitationBody (the one equipment menu, no
  modal of its own) hosted in WeekEditSheet (101900dc + 93241eb5 — the
  first commit half-landed the extraction; Metro's red screen caught
  what the compile gate cannot see, tsconfig excludes product files).
  Glass-proven both paths: bodyweight, and some-gear with the kit list
  INSIDE the same sheet, apply closing the chain.
- #9 drag snap-back: glide was insufficient (re-derivation slower than
  any glide). Drop VERDICT design: 'held' at drop point until the flow
  ends (unmount on accepted; settleNonce glide-home on close/refusal);
  'returned' glides at once; onFinalize only for cancelled gestures
  (5cd7c36b). Proven with a real long-press drag on the simulator:
  Mon strength → Wed, board re-derived.
- Day/session conditioning icon flame → pulse (0ff92a3c).
- Day-header My Status doorway, coach variant (a14616e8).
- Board closes on Day/Week toggle + R-233 already in round 1.

Phone rebuild dispatched with all of it.

## 2026-08-26 — profiles audit, round 1 (audit)

Method: headless probe (scratchpad profiles-audit.ts), 7 worlds —
pre/off-season male, in/pre/off-season female, in-season 4-day both
genders. Per world: full week print, boot byte-stability, bin/move/tired
doors each re-checked against boot. LEGAL fixtures only after two probe
artifacts bit ('Intermediate' is not an ExperienceLevel; the shared
fullKit fixture is rack-less — its own file documents both traps).

GREEN: all 7 generate cleanly; boot-stable; doors boot-stable; R-233
visible (RDL days carry Hamstring Curl); female seats visible (Banded
TKE / Bosch Hold / Copenhagen rows); Back Squat anchors with a real gym.

REAL DEFECT FOUND+FIXED (eec4e54e): R-233's filter narrowed the BASE
list — door/boot divergence in the add-game world (SL RDL vs Hamstring
Curl). Day-list-only now; equivalence 39/0.

FINDINGS OPEN:
- F-A "Full Body" that is a duplicate lower day: pre/off-season 3-day
  (both genders), the full_body plan day devolves to kind 'lower' when
  the week has no coverage gaps (composedDayKind null ?? 'lower'), so
  the athlete sees "full_body" carrying Back Squat/RDLs/Bulgarians/
  Hamstring Curl — the same mains as Monday, zero upper rows. The
  composer's own comment says this world should refuse honestly; it
  ships instead. Needs Sam's ruling: real full-body shape (A/B), a
  different 3rd-day plan, or at least the honest name.
- F-B G-1 Primer asymmetry: female worlds place the R-129 Primer on
  G-1; male placement is the ledgered dead optional-session branch
  (pathway seat's R-130 plan). Known, owned elsewhere; noted here as
  athlete-visible asymmetry.
- F-C 4-day in-season = 2 gym sessions: scheduler authors required=2
  (club nights + game counting), reductionDisclosure null because
  nothing was reduced by its own law. Lawful; may deserve an in-app
  sentence. Not a defect.
- Fixture debt: shared fullKitEquipmentAnswer (rack-less) still under
  many suites — the fixture file itself names the migration as its own
  unit.

NOT YET AUDITED in this pass: practice-match weeks, deload microcycles,
away/game doors on these worlds, second-block rollover, long-lived
histories.

## 2026-08-26 — profiles audit round 2: Sam's three rulings (audit)

R-234 WORKING (685905c4 + 2a3412b7): the full-body day balances — real
A/B shape when the week covers everything; missing-first chooser for a
lone balance day (B for missing hinge, A for missing squat, LOWER ladder
when both missing — the compressed [upper,X] week); plain alternation
with a balance sibling. Each arm born from a measured red (equivalence
[11] Wednesday-replan refusals both ways; rdl-family pre-season 4-day
pattern_balance). test:full-body-balance chained 10/0.

R-236 WORKING (f40dd4a0): the G-1 offer is gendered — her Primer, his
Gunshow, same placement rule. The charter's F1 stale-debt ratchet fired
on the paid gunshow debt exactly as designed; entry deleted, ceiling
1→0 same commit. Probe: male G-1 reads Gunshow, 21/21 stable.

R-235 slice 1 WORKING (2a3412b7): silent shortfall disclosed from the
athlete's own gym-day answer; ladder consults authored smaller
structures. SLICE 2 OPEN (registry row): un-clamped base sizing needs
scheduler-intent / composer-shape / §18-demand alignment — measured
refusals on the replan worlds; its own unit (Codex-scale).

Also: test:scenarios prints 12 scenario failures and EXITS 0 —
harness-lie, pre-existing (identical on committed tree); dead-suite
ledger candidate.

## 2026-08-26 — dead-suite triage (Sam asked "are they even useful?")

Instrument: unrunnable-suite ratchet (baseline 21, now 17 + coachActions
newly recorded). Death causes captured per file (scratchpad run):

FAMILY 1 — OLD-APP WORLDS, "B1-PIVOT: the legacy strength-content builder
is severed" (6): beginnerDeterministicProgram, byeWeekClassification,
offseasonSubphaseConditioningIntegration, phaseRepPrescription,
sprintExposureGate, teamTrainingRendering. Subjects LIVE, worlds are the
pre-composer app. Reviving as-is is the dark-suite trap; verdict per file:
REWRITE against the composer where the subject is uncovered, DELETE where
live suites already own it (candidates: sprint gates → WC-124 cells;
offseason conditioning → newer suites). 

FAMILY 2 — COACH FAMILY (4): coachNoteLifecycle, gameChangeCoachNotes,
injuryReadinessCoachNotes, coachActions (+coachRevisionProposal dead at
null.items). Coach rebuild territory → CODEX with the rebuild.

FAMILY 3 — EXPLORER TOOLING SELF-TESTS (2): explorerChainShrinker,
explorerGenerator. The explorer itself runs daily; low value; fix-cheap
or delete.

FAMILY 4 — MISC (3): generationConstraintReentry (ProgramGenError, old
inputs), weekPlanQAAllowedFindings (QA config drift),
recoveryContentIntegrity (recovery is a charter-DELETED type — delete
candidate). programmingBias exits 1 (red, not dead).

ALSO: test:scenarios prints 12 failures and exits 0 — harness lie;
12 failing scenarios are the old TEMPLATE engine's G-1/G+1 override
expectations (source=template) — same old-app class, needs its own
triage row before anyone "fixes" the app to satisfy it.

Deletions await Sam's word (destructive); rewrites priced per-file.

## 2026-08-26 — audit round 3 opened (practice match + block shape)

Pre-season + Saturday fixture world: generates 4 microcycles, weeks 1-3
High, week 4 Moderate — the deload week visible headlessly; fixture
weeks compose the full-body pair; no G-1 offer in pre-season (per rule).
Doors/long-term passes queued next; block 2→3 device run (dev clock)
queued with them.

## 2026-08-26 — audit round 3 complete (headless halves); dead suites binned

BINNED (f55e7e62, Sam: "BIN THEM DEAD TEST"): 11 orphaned dead-at-startup
suites deleted (six old-engine B1-PIVOT worlds, charter-deleted Recovery
content, two tooling self-tests, two config-drift orphans), 3,713 lines.
Unrunnable ratchet re-baselined 17 → 6 of 383; the six that remain are
ALL coach-family, kept for Codex's rebuild per Sam.

ROUND 3A — doors on the new profiles: away+clear on off-season female
(clear correctly changes nothing — no club work to restore), game move
Sat→Wed on in-season female, severe illness on pre-season male. All
accepted, all boot-stable.

ROUND 3B — accumulated life: 4 weeks × every strength session logged
through the REAL commitSessionOutcomeTransaction (12/12; the door
correctly refused an illegal partial-reason word during probe bring-up —
validation working). Worn world boots byte-identical on all four
anchors, athlete-visible fingerprint (names+doses).

PRACTICE MATCH + BLOCK SHAPE: pre-season with Saturday fixtures
generates 4 microcycles, weeks 1-3 High / week 4 Moderate (deload
visible headlessly); fixture weeks compose the full-body pair; no G-1
offer in pre-season (per rule).

ROUND 3C — block changeover ON DEVICE: blocked on a real rig gap. The
seed system derives weekStart from the anchor's own week
(devE2EWeekStartForSeed), so "an old program + a later today" — the
rollover state — is inexpressible. NEXT UNIT: a two-date seed semantic
(blockStartDate ≈ anchor−28d, generation at block 1, boot-rollover on
install; witnesses: block-2 content + BlockBoundaryNoticeCard). Headless
rollover machinery is covered (block-two family incl. the revived
screen-delivery suite, block-rollover, block-state — all chained).

## 2026-08-26 — block rollover watched on glass (ef9519e9)

The two-date seed semantic landed (DEV_E2E_PROGRAM_START_OVERRIDES);
'block-rollover' installs a block that ended yesterday with today the
next Monday. On the simulator: boot rolls the block, today carries a
real session, the new week shows the R-236 Gunshow + game, checkpoint
cold-reload reproduces it. Permanent flow .maestro/audit/block-rollover
runs it in one command. The base program witness re-anchored to the
program's own first week (asserting the anchor week refused the seed's
own world — measured before fixing). Blind-spot item 2 CLOSED for the
simulator; Sam's phone doesn't carry the dev rig, so device-device
verification remains sim-only by construction.

## 2026-08-26 — long-horizon audit (audit round 4) GREEN

Instrument: scratchpad long-horizon-probe.ts — the L13 shape, honestly:
DevE2EClock pinned per week (the same clock the simulator rides), block
rollovers through rolloverProgramBlock (the home screen's own boundary),
session logs through commitSessionOutcomeTransaction, edits through
executeProgramControlActionDurably, boots through rebuildDerivedWorld.

THIRTEEN WEEKS LIVED (2026-06-01 → 2026-08-24): 3 automatic block
rollovers (block 1 → 4), 35 sessions logged (0 refused), 8 door edits
(bins + tired facts, 0 refused), and after EVERY week a full boot with
athlete-visible byte-stability — 13/13 identical.

PROGRESS DERIVATION over the worn store (deriveCoachSnapshot, the live
hook's own function + project()): per-lift progress with directions
(rotation reads as "new" correctly), strengthHistory series spanning
June–August (recorded weeks as the authority), thisWeek with attached
outcomes. No errors, no empty states where data exists.

Observation (not a defect claim): Back Squat topSet flat at 100kg across
block-1 weeks — probe logs carried no per-set weights, so topSet reads
prescriptions; in-block load progression under real logged weights is
covered by test:strength-progression-integration.

With this, the original blind-spot list stands: profiles ✓ (rounds 1-2),
block changeover on glass ✓, long-horizon ✓, practice match + deload ✓,
release builds on two real phones ✓, dead suites binned ✓. Remaining:
coach chat (Codex's rebuild) and an older/slower physical device.

## 2026-08-26 — FULL-YEAR PROGRAMMING AUDIT (Sam's order) — measured at 77367cff

Instrument: scratchpad year-audit.ts + scenarios.ts + probes (session
9ff06b83-era L13 shape, extended): 6 archetypes × 54 weeks each through the
REAL doors (generateProgramLocally, rolloverProgramBlock,
commitSessionOutcomeTransaction with per-set logging,
executeProgramControlActionDurably, executeFixtureMutationTransaction,
applyPhaseShift→commitProfileProgramTransaction, DevE2EClock,
rebuildDerivedWorld). Full report delivered to Sam (artifact). Headlines,
each MEASURED not recalled:

1. **CRITICAL — injury clear + rollover deletes lower body.** hamstring 6/10
   → clear → rolloverProgramBlock: both lower days regenerate as
   row/dead-bug/plank filler (removals live on as athlete exclusions; known
   parked question in STATUS_FINISH_INJURY.md — year-scale consequence new).
2. **CRITICAL — TT-day strength invisible to boundary progression.**
   `seedableStrengthRows` (blockBoundaryProgression.ts) filters
   workoutType Strength|Mixed; canonical upper strength rides Team Training
   days → zero load decisions → upper loads flat W9→W51 in every archetype;
   `progressedFromOwnHistory` false → forced rotation every block. Minimal
   repro: identical bench row gets +2.5 on Strength day, nothing on TT day.
   Same filter class: deload halving misses TT-day mains; set-additions
   target only the lower days (in-season Wed squat 4x5-8 → 5x5-8 at W36,
   permanent).
3. **HIGH — bye is inert on the live door.** fixture remove accepted, noGame
   persisted, week unchanged, Sat still renders core Game; survives
   rebuildDerivedWorld. 0-TT athlete: remove REFUSED
   (full_rest_required_minimum:0). Generation-time bye (printed-weeks/4) is
   correct — the live repair path never restructures. Extends R-075/item-28.
4. **HIGH — readiness 7-day window dies at week boundary.** cooked declared
   Friday → next week full dose after boot (fact-horizon A3a red agrees).
   Declared Monday, transform lands (mains halved on Strength days only;
   Wed lower REPLACED by Mobility — structure change vs deload law).
5. **HIGH — shoulder 8/10 recomposition** adds Front Squat to all four
   emptied upper slots incl. G-1 gunshow slot; hamstring 6/10 also removes
   Bible-safe quad work.
6. Practice match add: no restructure (PM-1 full lower stands).
   Pre-season hard runner rides the lower_squat day 21 weeks (WEEK-08).
   Equipment missing_this_week: DB Shoulder Press ×3 in one session.
7. Sweep at this commit: **171 of ~390 red** (21 gender-fixture rot, 16
   import death, 133 individually red) — classification in scratchpad
   fail-triage.txt. Was ~10 on 2026-08-12.
8. GREEN under the year: phase tables, top-ups, anchors, G-1/G-2/G+1 (incl.
   Sunday cross-week Monday), running law, erg caps, deload cadence +
   no-in-season-deloads, early off-season optional block, gunshow pools,
   mobility composition, beginner gating, bodyweight legality, move/bin/
   game-move chains byte-stable across boot.

NOT COVERED: on-glass rendering this session, coach chat (Codex rebuild),
soreness/poor-sleep doors (no UI ingress — dead), missed-session prompt,
christmas-break + midweek-game doors (their suites red at this commit).

## 2026-08-26 — SAM RULED ON TWO AUDIT QUESTIONS (verbatim, from chat)

Recorded here so the rulings are not lost; **registry rows + guards are OWED
and are NOT mine to write** (audit seat, audit-only order — no rule/test
changes). OWNER: the building seat (Codex/terminal), next time it lands law
work.

1. **DELOAD POWER — Sam, 2026-08-26, verbatim: "keep power on deloads".**
   Resolves the Bible's internal conflict: THE DELOAD LAW ("power KEPT — a
   deload is not a reason to lose sharpness") WINS over §18F's "Remove power
   primers" lines (§18E low-readiness and §18F deload rules). The app's
   current behaviour (halved, small sharp dose kept) is the ruled behaviour.
   Bible amendment owed: strike/patch the two "remove power primers" lines.

2. **INJURY CLEAR RESTORES — Sam, 2026-08-26, verbatim: "yes"** to "restore
   everything the injury took out" when the athlete clears the injury.
   Closes the parked ownership question in STATUS_FINISH_INJURY.md. This is
   the ruling behind audit finding #1 (CRITICAL: cleared hamstring + block
   rollover permanently deletes lower-body training — the injury's
   remove_exercise decisions live on as permanent athlete exclusions).
   Fix must reverse BOTH facts a removal writes (exclusion + ledger entry)
   per the 2026-08-20 restore finding, and must survive rollover.

Questions 2 (no-club in-season week), 3 (hard-runner placement) and 5
(standing 5-hard-day in-season shape) are being re-explained to Sam in
plain words; not yet ruled.

## 2026-08-26/27 — OVERNIGHT FIX RUN (Sam's order: "work one item after the other until done")

Sam lifted the audit-only constraint. Sequential, no parallel builders, each
unit committed scoped + green before the next. Commits, this branch:
f63b964a (progression label fix), 63cc38e4 (rack-squat shoulder cells),
609e1aa1 (readiness 7-day window), c7e59fe5 (bye publication + phantom-game
fence), 98152b30 (20 suite fixtures revived), plus readiness-ownership +
fixture-identity revivals inside those commits.

### RULINGS RECEIVED TONIGHT (verbatim, recorded; registry rows + guards owed by build seat)
- Q2 (no-club in-season conditioning): "they should be doing something fast
  earlier in the week - something like a short sprint workout into so flying
  runs or glycolytic sessions in the 30 second to 2 min interval range -
  total session length 30-45 min after warm up. then later in the week on
  say a g-2 they can do some runnign intervals or off leg conditioning keep
  this moderate intensity - no more than say 6 or 7km". NOT BUILT TONIGHT:
  lands in weeklyScheduler/conditioning selection, which is mid-R-235
  slice 2 (Codex, same day) — building there overnight = the overlap Sam
  banned. Pointers: in-season policy already carries
  requiredAppMediumHardMinimum (tt===0 → 2) unenforced at selection; the
  speed-into-glyco session = Anaerobic-tab template + existing speed
  warm-up-rider mechanism; G-2 session needs a 6-7km cap. Supersedes, for
  0-TT only, the 2026-07-29 "game carries the hard exposure" reading.
- Q3 (pre-season placement): "why can't you put work on the weekend here?
  why can't you put lowers on thursday and hard running friday?" = ruled
  direction: pre-season may use the weekend; separate the hard runner from
  the lower day (lowers Thu, hard running Fri shape). Same scheduler
  surface (BASE_LAYOUTS pre-season rows + quality-day picker). OWNER: build
  seat with R-235.
- Q5 (in-season 2-lower-day week): ANSWERED, not a bug — decision 14 /
  WC-141 gives a 4th session to athletes ≤27 with 4+ gym days, and WC-103
  makes that 4th a split Lower Squat / Lower Hinge pair. Sam's own weeks
  show the 3-session layout because his profile fails the selector. OPEN
  CONFLICT for Sam: WC-103's split-lower 4th vs Bible §2's 4-day row ("4
  days: as above plus optional accessories/prehab Wednesday").

### RETRACTION
Audit finding #1 ("cleared injury permanently deletes lower body") was MY
HARNESS'S ERROR: the clear call passed constraintId (not episodeId/noteId),
the door correctly refused, and the still-active injury shaped the next
block. Measured with the correct payload: clear FULLY RESTORES the week,
survives boot, and the next block regenerates healthy. The UI passes
episodeId. What STANDS from that family: over-restriction while active
(hamstring 6/10 removes Bible-safe quad work; a "lower" day can regenerate
with zero lower lifts while an injury is active).

### FIXED TONIGHT, MEASURED BEFORE+AFTER
1. Club-night strength invisible to progression (seedableStrengthRows +
   3 apply passes read the day LABEL): year-long upper flatline → loads now
   climb per qualifying block (pulldown 45→67.5 across the season, bench
   50→75 across the year). Guard: blockTwoProgression [13], mutation-killed.
2. In-season set-additions gated off (Bible maintain): the 4→5-set
   mid-season squat ratchet is gone; Wed first lift now 3x5-8 all season.
3. Rack-squat shoulder cells good→caution (sheet+code+pins): shoulder 8/10
   replacement is Goblet 2x10-12, not Front Squat 3x5-8. Residual: the
   same replacement still repeats on each affected day (derived per-day, no
   week memory) and may land at G-1.
4. Readiness 7-day window derived from declaration day (was week anchor):
   Friday "cooked" now stores an 08-14→08-20 window and next Mon-Thu derive
   deloaded, with and without a boot. Guard: readiness-ownership R23.
5. Bye: fixture-remove publishes the replan's sessions (was
   workoutsByDate: {}) + resolver suppresses a template Game on a noGame
   date. Live bye → Saturday Hard Conditioning bye-build, boot-stable;
   year run W40 is a true bye week. fixture-identity revived 6/6 incl.
   add-then-remove identity and published==derived.
6. 20 gender-rot suites revived (5 fully green, rest now red on real cells).

### REMAINING (diagnosed, owners needed)
- 0-TT bye still REFUSED (full_rest_required_minimum:0) — §18 bye-build
  allocator packs 7 required days; the R-075 / SEAT_INBOX-28 blocked unit.
- Deload transform on club nights: main lift NOT halved while accessories
  are (mixed producers on TT days — same label-class family); optional-week
  mode still replaces one lower session with Mobility (structure law says
  sessions survive).
- Injury: over-restriction at 6/10 (safe quad work removed); replacement
  week-dedup + G-1 guard.
- Dead-logic dossier from the audit (MAS in generation, 2km TT retest,
  role buckets, goals, injury triggers UI, soreness/poor-sleep doors,
  coach mutation door) — unchanged tonight.
- Suite archaeology: game-local-rebuild imports retired validators;
  power-counting golden drift (9/13); block-state throws mid-run;
  ~130 other reds individually real; test:compile ratchet breach-set is
  UNSTABLE run-to-run on identical trees (control-measured) — the gate
  itself needs a look.

---

## 2026-08-27 — SAM'S SIX-ITEM MORNING ORDER, WORKED ONE BY ONE

Sam's operative order: fix items 1/2/3/6 now, make 5 actionable without
asking him, save 4 (dead inputs) for last. All worked in sequence, one
scoped commit each, `Agent: audit`.

### ITEM 2 — deload not halving the club-night main lift. WORKING. `6bec7b82`
Root cause was NOT a later pass un-halving (that hypothesis is withdrawn;
the speculative final-enforcement pass and idempotence rework were built,
control-proven unnecessary, and REVERTED). The real cause:
`deloadWeekRules.isConditioningExerciseRow`'s regex fallback matched
`\brow\b` in "Barbell Row" / "Chest-Supported DB Row" and classified the
club-night MAIN LIFT as rowing-machine conditioning, which the strength
deload passes through untouched. One line: a name EXERCISE_TAGS knows
answers from the registry only. Guard: deloadLawTests club-night cells
(68/68, mutant killed). deload-week's 9 reds are pre-existing
(control-proven; the fix adds 2 passes there).

### ITEM 3 — injury over-restriction while active. WORKING. `63958d24`
Three parts. (a) MATRIX: Bible hamstring section ("Usually okay:
non-painful quad-dominant lower work"; swaps deadlift→box squat,
SL-RDL→step-up) → Leg Press, Box Squat, High Box Squat, Goblet Squat,
Step Ups, Leg Extension move hamstring caution→good. First LOOSER
exceptions; pins 27→33, 875/24/1038→869/24/1044; MATRIX VERIFIED 0.
(b) VARIETY: `chooseInjurySessionAdditions` rotates its candidate pool by
the day's date — different affected days no longer receive the identical
replacement; review and view door pass the same date so the review stays
an exact promise (injurySessionAdjustmentTests [8], mutant killed).
(c) TRANSACTION: the injury recomposition now treats a THROWN
week-acceptance refusal as a per-swap refusal instead of dying — the
newly-legal hamstring swaps exposed a week whose write boundary refuses
ANY swap (`planner_selected_target_miss:conditioning:3`, control-proven
with no injury declared; recorded below). injury-recomposition 41/0.
Measured: hamstring 6/10 keeps Leg Press on the hinge day; only true
hamstring rows replaced. Residual recorded: Trap Bar Deadlift (caution)
survives a hamstring 8 while Single-Leg RDL pauses — the ladder's
pre-existing pause selection, not touched.

### ITEM 6 — beginner block-2 load re-seed. WORKING. `55076fd6`
Two defects, one family. (a) `strengthLogging.isMainStrengthExercise`
required `load !== 'low'` — a beginner's main lifts ARE the low-load
variants, so NO lift of theirs ever produced a strength log and every
block boundary re-seeded from estimates (Goblet 12.5 → 6). The same
function's regex ran before the registry, so `row` also silenced every
rowing lift for EVERY athlete — Barbell Row never recorded a load all
year. (b) the pool-sibling weight transfer passed loads RAW onto
loadRatio-0 targets — Bodyweight Squat prescribed wearing 12.5kg.
Measured after: beginner Goblet 10→47.5 across 54 weeks with a rise at
every qualifying boundary; standard athlete's Barbell Row 42.5→67.5
(previously flat); both years 0 problems. Guards in trainingLoggingTests
+ strengthProgressionIntegrationTests [22], mutants killed.

### ITEM 1 — no-club bye refusal. WORKING. `7b8f1099`
`full_rest_required_minimum:0` came from the accepted-state repair's stub
regeneration running strict (`weekAcceptance: 'restoration'`) and its
catch consuming only Section18WeekAcceptanceError — the
GeneratedWeekRefusedError from the bye-week stub killed the whole fixture
transaction. A fixture change is the athlete's FORWARD decision, so the
'fixture_transition' intent now generates under 'forward_decision' (the
documented contract; same route as "I'm properly sick"). Measured: the
bye is ACCEPTED, athlete keeps Mon–Fri, Saturday resolves REST, Sunday
optional Mobility, boot-stable. Guard: fixture-identity-7 through the
real transaction door (mutant reds with the exact measured signature).
Recorded, not fixed: the scheduler's own bye-week stub packs 7 active
days (0 rest) — the bye SHAPE (stacked conditioning, fast work early:
Sam's Q2/Q3) belongs to the scheduler owner mid-R-235.

### ITEM 5 — red-test archaeology, tranche worked. `bbba9ff5` + `59b62737`
Not a plan — fixes. (a) session-injury-review was DEAD at install (21st
gender-rot fixture); revived to 71 green / 2 red, and the 2 reds are real
pre-existing athlete-facing findings the dead suite hid: [7] close/reopen
does not re-derive the same session, [9] withheld-row naming disagreement
(R-121). (b) Three fixture guard suites died at import since the
2026-08-19 burn (dangling homeGameMutationController import); the
controller lives on as TEST SUPPORT ONLY and the suites run again:
fixture-mutation-transaction 10/14, fixture-conditioned-replan 21/34,
chained-mutation-continuity runs (28 red — pre-composer expectations,
rewrite-or-delete verdict owed). Newly visible, recorded: restore
fingerprint mismatch on patterns metadata ([9]/[11b-e]; live
undo-reversal is 25/0 green so not escalated), coach-note metadata (coach
teardown, Codex rebuild in flight), 0TT-bye shape cells (scheduler owner).
(c) persistent-injury's subject (`getInjuryRules`) no longer exists in
the product — dead suite over deleted code; deletion owed, not revival.
Remaining pile unchanged otherwise; the compile ratchet's instability and
the write-boundary conditioning-count disagreement (below) are the two
instrument-level defects worth their own units.

### NEW FINDING (control-proven) — the write boundary refuses ALL swaps on some weeks
On the injury-recomposition suite's world, an ordinary no-injury swap
through the door is refused: the §18 candidate-week assembly at
`assertLiveDateCandidateAgainstWeek` counts conditioning against the
planner target over STORED workouts, while conditioning days are DERIVED
— so `planner_selected_target_miss:conditioning:3` fires on any write.
Previously invisible because nothing in those worlds ever wrote. Its own
unit; owner: §18 write-boundary.

### ITEM 4 — dead inputs. CENSUS CORRECTED; two real gaps, owners named.
Measured tonight, correcting the audit's list:
- WIRED (not dead): soreness + poor-sleep doors
  (`set_poor_sleep_status` / soreness facts through programControlActions),
  sprint-exposure gating, MAS→per-athlete pace personalisation
  (DayWorkoutScreenV2 `personalPaceLine`, derived at view — north-star
  conformant), goals/motivation bias (coachingEngine
  `motivationBiasTokens`; motivation-goals 45/0).
- DEAD: `position` reaches only the RETIRED LLM-prompt path; local
  generation ignores it. The Bible's own words ("position can slightly
  bias ... do not overcomplicate") make doing nothing defensible; wiring
  a slight bias needs Sam's coaching content, not code archaeology.
- UNBUILT: the 2km TT retest every 6-8 weeks (Bible §"MAS and the 2km
  time trial" — "may prescribe ... to recalibrate MAS and feed the
  fitness trend") plus result ingestion (needs a small UI to log the
  time). Placement is scheduler work — owner: scheduler owner (with
  Q2/Q3), NOT built tonight to avoid overlapping the in-flight R-235
  rebuild, per Sam's own "don't build overlapping shit".

### RE-VERIFICATION (after all commits)
- Scenario battery S-A..S-K: all run, no throws; fixture doors accepted.
- Six 54-week archetype years: y1..y6 all `0 problems`.
- Loads: beginner Goblet 10→47.5; standard Bench 50→75, Barbell Row
  42.5→67.5 (newly progressing), Lat Pulldown 45→67.5.
- Suites green: deload-law 68, injury-recomposition 41, tap-swap 26,
  severity-bands 35, injury-latest-severity 48, fixture-identity 7,
  forward-decision-acceptance 2, undo-reversal 25, training-logging 14,
  workout-log-progression-wiring 37, strength-progression-inputs 18,
  block-two-progression 41, missed-sessions 21, motivation-goals 45,
  readiness families, MATRIX VERIFIED 0.
- Pre-existing reds unchanged and control-proven not mine everywhere
  measured; test:compile breach set (programControlActions 5-vs-4,
  exerciseFilter 1-vs-0) exists on HEAD too.

---

## 2026-08-27 (later) — SAM: "NO YOU DO THIS" — Q2/Q3 BUILT BY THIS SEAT

### Q2 — WORKING. `a7444ddb` (WC-143, R-256)
Built at the LIVE scheduler (`weeklyScheduler`) after measurement showed the
first landing site (`coachingEngine.buildWeeklyPlan`) has ZERO callers — a
dead layer; those edits were reverted before commit. The tt=0 in-season
game week now authors: EARLY upper day = strength + Fly 20/30 flying-run
sprint rider + rotating glycolytic intervals (Sam's sentence, typed as
clause WC-143); G-2 = moderate tempo running/off-leg. Supersedes the
2026-07-29 game-carries-hard reading for tt=0 only. Contract intensity
minimum deliberately NOT raised (blocking + geometry-blind — the item-1
lesson). Mutant killed; y5 full year 0 problems with the shape in every
in-season week.

### Q3 — RULED + BLOCKED, measured. (R-257)
WC-144 (hard runner leaves the all-lower receiver set for a free weekend
day) was BUILT and produced the ruled shape (Mon lower + easy off-leg,
Sat standalone Hard Intervals, rest + streak guards, mutants killed). It
was BACKED OUT on a measured collision: with Saturday occupied, a dated
practice-match landing there makes the fixture replan overlay and the
pure deriver compose different weeks (the overlay's Monday lost its
conditioning component) and fixture-identity 5/6 red — Sam's own
add-then-remove identity law. Root: the projection/derivation seam
already recorded as the R-075 allocations-vs-final unit (the pure deriver
schedules dated-fixture weeks fixture-blind; instrumented and proven —
the same week scheduled with gameDay=6 in transaction passes and
gameDay=null in derivation passes). OWNER: whoever takes the R-075 seam;
the backed-out build is recoverable from this branch's history at the
WC-144 marker in weeklyScheduler.ts.

### Layer discovery, recorded
`coachingEngine.buildWeeklyPlan` (and its §18 conditioning allocation +
repair passes, ~5000 lines) has NO production callers — the live chain is
weeklyScheduler → materialiseAuthoredSessions → scheduleToCoachingPlan.
The preseason-subphase / preseason-exposure / strength-sequencing suites
partly test that dead layer. Deletion census owed (its own unit).

---

## 2026-08-28 — COMPILER RE-AUDIT (Sam's order) — measured at aa5804dc

Audit-only; no product change. Five parallel instruments: release-gate
coverage read, mutation study (isolated worktree at aa5804dc, all mutations
reverted), independent writer sweep, headless door probes (scratchpad,
`sucrase-node`, real onboarding + relaunch), year-gate anatomy. Baseline:
this file's 2026-08-26 FULL-YEAR AUDIT + the 08-26/27 fix run.

### Sam's five claims — verdicts

1. **Injury change → clear → reopen produces the same program: WORKING,
   measured.** Probe: knee sev-7 via `createOrUpdateInjuryEpisode` (correct
   episodeId payload), visible week changed (control non-vacuous), relaunch
   mid-episode byte-identical, `resolveInjuryEpisode` → week equals a
   never-injured control world byte-for-byte, live AND after another boot.
2. **One program-writing owner: WORKING.** `weekly-writer-census` re-run
   live: 0 rival / 0 derived-output / 0 unresolved / 1137 reviewed, exit 0;
   census verified FAIL-CLOSED (new write site anywhere in scope → red;
   fingerprints = body+callee+operations; tombstones for named retired
   rivals). Independent sweep of every `setItem/multiSet/persist/setState`
   in src + supabase functions + native found NO rival. Caveats recorded:
   "one owner" = one reviewed compiler SUBSYSTEM (170 fns, human-classified,
   fingerprint-pinned); `applyExerciseExclusionDecision` writes a durable
   INPUT via `setExclusion` but is labeled `projection_display` (census
   can't see non-DOMAIN/non-SINK input writes — other gates own it; label
   wrong-in-spirit).
3. **Games + accumulated edits + injury + Undo across restart: WORKING at
   the doors, with ONE regression (below).** Probe: in-season world —
   fixture add (2-game week) accepted, move_session ok, exclusion ok,
   injury ok, undo reversed the move visibly; two restarts byte-identical;
   undone stayed undone; ledger stable. Correct refusals seen: pre-season
   game add refused `fixture_kind_phase_mismatch`; move without
   visibleWeek context refused. Design fact: injuries and exclusions are
   NOT on the undo ledger (undo reverses last LEDGER decision only).
4. **Release tests enforce current requirements / fail when broken:
   PARTLY.** Gate mechanics sound and self-guarding (derives witnesses
   from `test-truth-decisions.json`, refuses invalid registry, ~75
   mutation/control cells, `armTotalsOrRed` on the big suites). Mutation
   study, 8 single-line production mutations, one at a time: **6 caught**
   (injury resolve inert → 11 cells; fixture-add unrecorded → 15; ledger
   replay drops fixture_add → 13; undo skips rebuild → 42; compiler
   nondeterminism → 5; second derived-output writer → census exit 1) and
   **2 ESCAPED the ENTIRE gate: block-boundary load progression zeroed
   (blockBoundaryProgression.ts:983) and deload main-lift halving removed
   (deloadWeekRules.ts:38)** — both green through every witness, caught
   only by excluded diagnostics (`test:block-two-progression`,
   `test:deload-law`). `run-compiler-year.js:47`'s claim that dose
   arithmetic is covered by the canonical witness is MEASURED FALSE.
   Also: 157 of 178 registry decisions are `rewrite_test` with two
   boilerplate reasons — declared quarantine, individually unreviewed.
5. **Year gate assesses the athlete-visible program / catches meaningful
   problems: HALF.** It reads `deriveVisibleWeekLive` (the screen's twin),
   runs real onboarding + 52 restarts + real doors per athlete, §18
   blocking-zero every week, 4 genuine runtime mutation witnesses — strong
   on structure/provenance/durability. But NO check reads a weight, set
   count or dose value; green receipts record 14 booleans + fingerprints,
   no content. Would catch **1 of 8** of this file's 08-26 defect classes
   (the bye class). "416/416" = structurally legal + durable, NOT "the
   training is right".

### Regressions at HEAD (green at pre-rework 560913f8, verified in a
### throwaway worktree; red at aa5804dc — the shipped phone build)

- **CONFIRMED BUG — undo of a removal leaves the exclusion.**
  `test:undo-reversal` 24/1 (was 25/0): cell 19 "the exclusion survived
  the undo — the reversal reached the ledger and not the fact that
  actually keeps the exercise out" (undoReversalTests.ts:505). Athlete:
  remove exercise → Undo → it stays out of every future week. Violates
  the 2026-08-20 both-facts law and the R-restore family.
- **CONFIRMED BUG (honesty) — `changedProgram=true` with no visible
  change.** `test:injury-recomposition` 37/4 (was 41/0): knee-moderate,
  hamstring-paused, hamstring-mild, shoulder-limiting all report
  changedProgram=true while the visible day is unchanged
  (injuryRecompositionTests.ts:307). The recomposition honestly says
  "could not be made safe"; the flag lies. Sam's claim-vs-visible rule,
  asserted in that very suite.
- Known red, NOT new: `readiness-ownership` 22/2, R9/R13 self-labeled
  "expected pre-fix" — minor illness/fatigue facts refuse to commit when
  §18 would reject the week (inert facts should commit off the gate).

Otherwise the 08-27 scoreboard HELD or improved at HEAD: deload-law 68/68,
block-two-progression 41/0, fixture-identity 7/7, training-logging 14/0,
missed-sessions 21/0, injury-latest-severity 48/0,
strength-progression-inputs 18/0, workout-log-progression-wiring 37/0,
forward-decision-acceptance 2/0, session-injury-review 76/0 (was 71/2 —
the close/reopen and naming reds are gone).

### Dormant features — verified, not features

`buildTimeTrialSession`/`timeTrialWorkout` (timeTrialSession.ts) and
`mobilityRowFor`/`pairMobilityWithAccessories` (mobilityPairing.ts): zero
production callers (only their own test files), quarantine guard fires on
all 9 import shapes (plain/barrel/require/dynamic/concat), detector 41/41.
Preserved and disconnected, exactly as stated. BUILT, not WORKING.

### Recommended fixes (priced by class, not built — audit-only)

1. Reverse BOTH facts on undo-of-removal; derive `changedProgram` from the
   visible diff, not from "the compiler ran". Two small owners.
2. Give the gate numbers, the cheap way: promote the ALREADY-GREEN
   arithmetic suites (deload-law, block-two-progression,
   strength-progression-inputs, training-logging) to `current_contract`
   rows — registry entries only, no new code — and add one
   load-monotonicity + one deload-halving magnitude cell per measured week
   to the year harness. This closes the exact class both escaped mutations
   exploited.
3. Work the 157 `rewrite_test` rows down with a per-suite verdict
   (stale-expectation vs live-defect), athlete-programming suites first.

### NOT COVERED / environment notes

On-glass UI this session; coach chat (Codex rebuild, review-only law);
full 8×52 year re-run under mutation (16-week restricted runs + full check
inventory read instead); G-1/G+1 placement law only indirectly gated (its
dedicated suites are parked). `src/__tests__/modifierLifecycleTests.ts`
appeared untracked at 06:57 during this audit — another seat's in-progress
work, not touched, not part of this audit's evidence. Probes rerunnable:
scratchpad `probes/` via `TZ=Australia/Melbourne sucrase-node <probe>`.
