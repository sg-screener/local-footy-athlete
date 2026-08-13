# THE RULINGS REGISTRY — the ONE machine-held list of what Sam has decided

**Built 2026-08-13 because Sam had to refuse the same question for the third
time in one day.** His words: *"IT SHOULDN'T EVEN BE AN OPTION FOR THE AI TO FIX
A PROBLEM THAT HAS BEEN FIXED"*.

**THIS IS THE LAW REGISTRY'S SHAPE APPLIED TO RULINGS.** Sam ruled on
2026-08-10 that *laws must be machine-held, not remembered*. **Rulings were
not.** They lived in a handoff doc, an archived orders file, and an AWAITING SAM
section — three places, none of which an agent reliably opens. That is why
"already ruled" kept dying.

---

## THE GATE — BINDING ON EVERY AGENT AND ON THE REVIEW SEAT

**1. NO QUESTION REACHES SAM WITHOUT A GREP OF THIS FILE FIRST, AND THE QUESTION
MUST STATE WHAT THE GREP RETURNED.** A question with no stated grep is refused
exactly like an unenforced law is refused. "I grepped `R-` for *game* and found
R-005, which does not cover X" is a legal question. "Can someone have two games
in a week?" is not.

**2. NO WORK STARTS ON A ROW WHOSE STATUS IS `BUILT` WITHOUT FIRST OPENING THE
ENFORCER AND FINDING IT ABSENT.** If it is present, the work is already done —
say so and move on.

**3. A NEW RULING FROM SAM IS ADDED HERE IN THE SAME COMMIT THAT RECORDS IT.**
A ruling captured without a row here is a defect at the moment of capture. This
is the rule three of the census findings died for.

**4. STATUS IS EITHER `BUILT <file:line or commit>` OR `UNENFORCED`.** Two
states only, same as the law registry. "Partly", "in progress" and "should be"
are not states. **A row whose enforcer cannot be named is UNENFORCED, however
true the ruling is.**

---

## HOW TO READ A ROW

`R-nnn` · **SAM'S WORDS, verbatim** · what it means · `STATUS`

**Verbatim matters.** Several defects this week came from an agent paraphrasing
a ruling and then building the paraphrase.

---

## SEASON, FIXTURES, THE WEEK

**R-001** · *"as many games as needed"* · A week may hold any number of games,
on any day. **The profile does NOT grow a second game field — the CALENDAR holds
fixtures; `gameDay` is only a DEFAULT.** ·
`BUILT 3f62ad62` (2026-08-12) — a split round no longer loses its second game.
**⚠ RE-ASKED 2026-08-13 by reading `domain.ts:192` `gameDay?: DayOfWeek` and
concluding "room for one". That single field is not the mechanism.**

**R-002** · *"off season means NO team training, the christmas break is
essentially an off season inside pre season - there is never team trainings
here"* · Off-season has NO team training, ever. The Christmas break is an
off-season inside pre-season. · `BUILT 5dc644ed` (2026-08-13) — Bible `:1440` and
`:1289` amended with his words and a changelog entry; QA scenarios S7 and S5
both corrected (S7 re-phased to pre-season, S5's team days cleared) and the
harness's own team-day violations went 4 -> 0.

**R-003** · *"the athlete can only do COD work in late off season (after first 4
weeks of off season), in christmas break or during pre season if no team
trainings … No COD required in season for anyone."* · The COD gate is: **no team
training this week AND not in season AND not the first four weeks of
off-season.** "After first 4 weeks" = `late_offseason`
(`seasonPhaseClock.ts:72-74`). · `BUILT c086ca3d` (2026-08-13) — `codDecelPermitted`
in `conditioningSelection.ts` is the one rule, read by BOTH gates. The wrong
input was in TWO places, not the one this row named: `defaultProgram.ts:1978`
and `coachingEngine.ts:4126` both read the standing profile. 9 cells in
`test:conditioning-templates`, every line mutation-killed.
**STILL PARTLY UNENFORCED:** the week fact is profile-derived until the dated
no-team-training span exists (item 31 part 5), so a club athlete's December week
still reports team training.

**R-004** · *"that way the app isn't guessing"* · The Christmas break is set by
ASKING: ~10 Dec *"when is your last team training?"*, ~3 Jan *"when does team
training go back?"*. The dates are defaults for WHEN TO ASK, never inferred
answers. · `UNENFORCED` — SEAT_INBOX item 31 part 5.

**R-005** · *"once a session is done then it's locked in, only the rest of the
week can change … wednesday to sunday should adjust to accomodate this"* · A
completed session is locked; the remainder of the week re-shapes around it.
Quiet mid-week re-shaping after a fixture change is WANTED. The lock boundary is
the DATE. · `BUILT` — matches code both halves; stand-down B. **Do not re-ask —
fourth appearance of the granted-permission defect.**

**R-006** · *"Full rest days: 1-2 stands everywhere except bye-recovery weeks and
early off-season, where 3 full rest days are permitted."* · The exception permits
MORE rest, not less. No phase may require zero. · `BUILT` —
`weeklyExposureContractV2.ts:1002,1021,1040,1062` now `required: 1`.

## HARD DAYS AND WEEK SHAPE

**R-007** · *"4 hard days plus 1 moderate/easy day is prefered but 5 hard days is
okay"* · Prefer 4+1; permit 5. **Five is NOT a defect — do not build a
fifth-hard-day block.** · `BUILT` (permission side). Stand-down A.

**R-008** · *"stop worrying about this moderate day thing - this is only on 17 QA
- when we get deeper into the app and test 100 then we will have many more
useful scenarios"* · The 4+1 GENERATION TARGET is **PARKED**. Reopen only when
the harness carries ~100 weeks. · `PARKED BY SAM 2026-08-13` — not owed, not
blocked, not a defect. **Do not re-ask.**

**R-009** · *"should give warnings but allow them to do whatever they want"* ·
The app warns, records and proceeds. **A refusal survives ONLY when the action is
physically impossible.** A 6th hard day is not. This SUPERSEDES Bible `:118`'s
"is refused" on this exact question. · `BUILT b027fef1` — his 6-hard-day sentence
ships.

## SESSIONS AND EXERCISES

**R-010** · *"just keep sessions for gym the same before footy training"* · A gym
session is the same size whatever else is on that day. **No team-night size case,
in either direction.** · `BUILT`.

**R-011** · *"just because the strength is on the same day doesn't mean they are
doing it at the club, they might do it in the morning or on the drive to footy"*
· **Same-day never implies same-place.** Do not reason from one to the other. ·
`BUILT` — the false comment is struck.

**R-012** · *"team training should be looked at more like conditioning - it's not
part of the strength exercises - it's its own component of the day"* · Team
training is its own component, held BY ROLE, not by name. · `BUILT e8521b79`.

**R-013** · **ONE exercise cap for every training age; the beginner cap of 3 was
never authored** (Bible `:3149`, `:4969`) · One cap, all training ages. The
number 3 is abolished. · `UNENFORCED` — `maxExercisesPerStrengthSession` has
ZERO readers; eleven 3-row fallback branches still ship. SEAT_INBOX item 25.

**R-014** · **⚠ RULED 2026-08-13, AND THE QUESTION IS VOID — THERE IS NO FLOOR
BECAUSE SIZE IS NOT THE RULE.** *"because the number of exercises is not
important the total work being done evenly across the body is"* ·
**A SESSION IS THE RIGHT SIZE WHEN ITS PATTERN SLOTS ARE FILLED.** The count is
a proxy and he refused it. **His slots, verbatim:**
*"lower body strength should have a hinge, a squat, an single leg knee, a single
leg hip, and accessory and/or some core"*;
*"upper body strength day should have push pull on the horizontal, push pull on
the vertical then should arm work or accessory work for the shoulders"*;
*"if you upper body pull or upper body push then it just becomes horizontal
movement, vertical movement, more arm work, more accessory work, maybe a lift
like a single arm press"*; *"then you can throw power and stuff in there"*. ·
`UNENFORCED` — **nothing composes a session by pattern.** The generator's
strength selection is done by the model and the prompt never mentions the ladder.
**AND IT WAS ALREADY IN HIS BIBLE at `:227`** — *"heavy squat pattern -> heavy
hinge pattern -> single-leg knee-dominant -> single-leg hip-dominant ->
accessories. An athlete is better served by a squat and a hinge than by two
squats."* — which is why he said *"i thought this would have been explained by
now"*. Census C7. **DO NOT SEND HIM A FLOOR NUMBER QUESTION.**

**⚠ AND THE PATTERN LOOKUP IS BROKEN, WHICH BLOCKS BUILDING THIS. MEASURED
2026-08-13.** A session cannot be composed by PATTERN while the app cannot tell
what pattern its own rows are. Over 5 worlds, counting only GYM rows (post-R-071):
**60 distinct names resolve to a pattern; 20 distinct names — 151 rows — resolve
to NOTHING.**
`getExerciseTags` is an EXACT-NAME lookup over a 149-entry map, and the generator
ships names that miss it:

| shipped | in the map? |
| --- | --- |
| `Face Pulls` x37 | **NO** — but `Face Pull` (singular) IS tagged |
| `Pallof Press` x28 | NO |
| `Bicep Curls` x20 | NO |
| `Tricep Pushdowns` x20 | NO |
| `Romanian Deadlift` x10 | **NO** — but `RDLs` IS tagged, same lift |

**TWO OF THE FIVE ARE THE SAME EXERCISE UNDER A SECOND NAME**, and the lookup
fails SILENTLY — `undefined` reads as "this row has no pattern", which is
indistinguishable from "this row is not strength work". **That is the same
default-means-nothing shape as `!row.role` meaning COUNT.**
**IT ALSO CORRECTED ME MID-MEASUREMENT:** a day named *"Lower Hinge"* appeared to
contain NO hinge. It contains a Romanian Deadlift. **The day was fine and my
instrument was not** — the exact reason a name-keyed lookup must not be trusted
to report absence.
**SO THE FIRST STEP OF C7 IS NOT THE COMPOSER — IT IS MAKING THE PATTERN
KNOWABLE.**

**⚠ AND THE COMPOSER IS NOT WHERE ANYONE WOULD LOOK. TRACED 2026-08-13, end to
end, because two fixes aimed at it changed nothing:**
1. **`buildTagAwareSession` / `exerciseScorer` ARE NOT ON THE GENERATION PATH.**
   `buildTagAwareSession` has exactly ONE production caller —
   `coachRevisionTemplates.ts:575`, the COACH-REVISION path. The weekly
   generator never calls it. **That is why enforcing the exercise ceiling at
   `sessionBuilder.ts:718` was inert: that file is not in the weekly chain.**
   The scorer's whole slot-shaped apparatus — `MIN_SESSION_SIZE`,
   `FILLER_REGIONS`, the ladder at `exerciseScorer.ts:597-601` — is unreachable
   from generation. **Probed: the top-up block fires ZERO times in five worlds.**
2. **THE REAL CHAIN IS:** plan entry -> `fallbackExercisesForPlanEntry`
   (`defaultProgram.ts:1070`, used at `:1288` for a missing day and at `:2461`
   when the AI payload has NO strength content) -> `applyPoolRotation`
   (`:2489`) -> `findOrCreateExercise`.
3. **THE ROTATION PRESERVES THE PATTERN — it is NOT the thief.** Measured:
   `RDLs -> Deadlift` (still hinge), `Reverse Lunges -> Walking Lunges` (still
   single-leg knee), `Leg Extension -> Nordic Lower`, `Back Squat -> Back Squat`,
   `Single Leg RDL -> Single Leg RDL`. It swaps VARIANTS inside a pool slot.
4. **SO THE HINGE IS DROPPED, NOT SWAPPED.** The fixed fallback emits FIVE rows
   and the shipped day has FOUR — Back Squat, Walking Lunges, Single Leg RDL,
   Nordic Lower — with the rotated `Deadlift` absent. **WHICH STEP DROPS IT IS
   THE ONE UNKNOWN LEFT, and it is the whole remaining unit.** Do not rebuild the
   composer until that row's disappearance is measured; two fixes have already
   been spent on layers that turned out not to be in the chain.
5. **NARROWED TO A THREE-STEP WINDOW — instrumented stage by stage.** The
   corrected fallback's hinge SURVIVES: `aiExercises` = *"Back Squat | Deadlift |
   Walking Lunges | Single Leg RDL | Nordic Lower"* (RDLs rotated to Deadlift,
   still a hinge), and it is **still all five rows** after `validatePairings`,
   after `applyPhaseRepSchemesToWorkoutExercises`, after the load-estimation
   step, and after `applySubphaseMainLiftLoadMultiplier`.
   **THE SHIPPED DAY IS FOUR ROWS — *"Back Squat, Walking Lunges, Single Leg RDL,
   Nordic Lower"*, `missing: [hinge]`.**
   **SO THE DROP IS AFTER `applySubphaseMainLiftLoadMultiplier` AND BEFORE THE
   WORKOUT IS RETURNED.** The remaining candidates are exactly:
   `applyTrainingAgePrescription` (`defaultProgram.ts:2536`) and the
   strength/conditioning assembly below it — **and the assembly's own branch did
   NOT run for these days**, which points at the training-age step first.
   **`applyTrainingAgePrescription` IS ALSO CLEARED — probed, all five rows
   survive it** (`afterTrainingAge: Back Squat | Deadlift | Walking Lunges |
   Single Leg RDL | Nordic Lower`).
   **SO THE WINDOW IS NOW ONE FUNCTION.** After the training-age step the only
   transform left before the workout ships is
   `finaliseBuiltWorkout` -> **`finaliseWorkoutAfterMutation`**
   (`workoutCanonicalisation.ts:581`), reached at `defaultProgram.ts:2763`.
   Everything between the fallback and it is measured innocent.
   **✅ CONFIRMED 2026-08-13 — `finaliseWorkoutAfterMutation` IS THE DROP SITE.**
   Probed at its entry: it RECEIVES *"Back Squat | Deadlift | Walking Lunges |
   Single Leg RDL | Nordic Lower"* — five rows, hinge present — and the shipped
   day is the same four rows minus `Deadlift`. **The hinge goes in and does not
   come out.** `workoutCanonicalisation.ts:581`, reached from
   `defaultProgram.ts:2763` via `finaliseBuiltWorkout`.
   **WHAT IS LEFT IS WHICH LINE INSIDE IT** — the function is long and classifies
   rows by domain (`domainPatterns`, `:635`) before rebuilding `finalRows`
   (`:955`). **The unit is now bounded to one file and one function.**
   **✅ THE LINE IS NAMED, 2026-08-13. IT IS THE `main_pattern_drift` BRANCH**
   (`workoutCanonicalisation.ts`, the `strengthAndSupportRows` loop —
   `intendedPatterns.size > 0 && pattern && !intendedPatterns.has(pattern) && !isMinorCrossPatternAccessory(item)`).
   Probed at that branch through the REAL generator, it printed exactly one line
   in the whole away suite and it is exactly the missing row:

       DRIFT-DROP "Deadlift" pattern=hinge intended=[squat] workout="Lower Squat"

   **SO NOTHING IS LOSING THE HINGE BY ACCIDENT — THE APP IS DELETING IT ON
   PURPOSE, AND THE GUARD DOING IT IS THE ONE THAT ENFORCES THE PLAN.** The plan
   entry names the day's MAIN lift (`squat`), the fallback correctly emits Sam's
   ladder (squat AND hinge, per `:227`), and the canonicaliser then removes the
   hinge as drift *from the plan*. **`:227` and `main_pattern_drift` are in
   direct contradiction, and the guard is currently winning:** *"An athlete is
   better served by a squat and a hinge than by two squats."*
   **THE FIX IS ONE SENTENCE AND IT EXPLAINS THE CLASS, NOT THE CASE:
   `intendedPatterns` names the day's MAIN LIFT, never its whole content, so a
   row whose pattern COMPLETES that day's own ladder is not drift.** Do not
   special-case squat/hinge; do not delete the drift guard, which exists to stop
   a day wandering off its plan.
   **WHAT IT COSTS TO LAND, stated so it is not started blind:** it changes
   generated output, so it needs `test:scenarios` and `test:qa` either side, and
   the drift branch's firing rate across the corpus — one probe, already written.
   **AND IT CANNOT ENTER THE LAW REGISTRY UNTIL IT IS FIXED:** `LAW-0-registry`
   forbids a new row entering as `UNENFORCED` (Sam withdrew that clause
   2026-08-10), so the guard and the fix are ONE commit, never two.
   **⚠ AND A SECOND FINDING FELL OUT OF THE SAME PROBE:** two other days NAMED
   *"Lower Squat"* arrive carrying **only upper-body accessories** — *"Bicep
   Curls | Tricep Pushdowns | Face Pulls | Leg Extension | Pallof Press"* and one
   with `Lateral Bounds` leading. **A lower day whose entire content is arm work
   is a naming/selection defect of its own**, and it is upstream of this drop —
   those days never had a squat or a hinge to lose.
   **⚠ CLEARED BY MEASUREMENT, SO NOBODY RE-SUSPECTS THEM:** the fallback (emits
   the hinge), `applyPoolRotation` (RDLs -> Deadlift, pattern PRESERVED),
   `validatePairings`, `applyPhaseRepSchemes`, the load-estimation step,
   `applySubphaseMainLiftLoadMultiplier`, and `applyTrainingAgePrescription`.
   **Seven stages, seven innocent.**
6. **ALSO instrumented at BOTH fallback call sites. The
   missing-day site (`:1288`) emits the corrected five rows verbatim —
   *"Lower Squat: Back Squat | RDLs | Reverse Lunges | Single Leg RDL | Leg
   Extension"* — and the AI-had-no-strength site (`:2461`) never fired in that
   world. **So the hinge is present when the day is handed on, and is gone by
   the time it ships. The drop is strictly downstream of
   `fallbackExercisesForPlanEntry`.**

**⚠ AND CENSUS A4 IS OVER-CALLED ON ITS SECOND EXAMPLE.** It names
*"Overhead Press + Incline DB Bench, both `push`"* as a duplicate-pattern breach.
**Judged by Sam's own split-day slots it is CORRECT and COMPLETE:** Overhead
Press = vertical push, Incline DB Bench = horizontal push, Lateral Raise =
arm/shoulder — `missing: []`, `duplicated: []`. His ruling separates the two
PLANES, so two presses in different planes is the shape he asked for, not a
breach. **The A4 finding stands for the LOWER example (two hinges) and is
withdrawn for the upper one.**
**BOTH FOUNDATIONS ARE NOW BUILT (2026-08-13):** the pattern lookup canonicalises
(`f5fc1898`, gym rows resolving 61% -> 91%), and Sam's slots are a real rule with
his own acceptance criteria (`cc6ef611`, `test:slot-coverage`, 20 cells).
**MEASURED: 70 strength days, only 19 cover every slot he named.** Most-missed:
single-leg hip 30, single-leg knee 22, arm/shoulder 21, horizontal push 20,
vertical push 20, hinge 12, squat 12. **That is the composer's before-number.**
**⚠ AND ONE GAP BELONGS TO A SHARED OWNER, NOT TO THIS RULE.**
`sessionNaming.inferStrengthMovementPatterns` — the app's ONE answer to "what
movement is this session about" — returns **NOTHING** for *"Upper Body Strength"*
and *"Full Body Strength"*, **two of Sam's seven signed strength sessions**
(Bible §20.5). Those days get no slot list and are currently unjudged. **The fix
belongs in that owner; a local regex would restore the second representation the
delegation exists to remove.** Two cells assert the gap so it cannot be forgotten.

**R-071** · *"yes it should be its own thing and not count as a strength exercise
- thats stupid"* · **CONDITIONING IS NOT A STRENGTH EXERCISE** and does not count
against the per-session cap. · `BUILT 01ef5863` (2026-08-13) — `conditioning`
added to `ROLES_EXEMPT_FROM_COUNTING` **and** `conditioningRow` now stamps the
role, because the rows carried none and an untagged row counts by default.
**Golden diff: 100 sessions, over-cap 8 -> 0, every session byte-identical —
only the COUNT moved.** 4 cells in `test:row-counting` (43/43); the
"a fourth may not arrive unannounced" gate reddened on the change and was updated
with the diff cited, not weakened.

**R-015** · *"On strength days, 2-3 accessory exercises are paired with mobility
exercises as SUPERSETS by default"* (+ 6 further clauses,
`MOBILITY_PAIRING_RULINGS_2026-07-31.md`) · Main lifts are NEVER paired; the
mobility pick must be non-competing; dose is the authored warm-up dose; picks
come from the signed pool; the standalone Mobility session is unchanged. ·
`BUILT` — producer exists; validator no longer caps at one pair.

**R-016** · **Reps are prescribed as a range, shown as a SINGLE MIDDLE NUMBER**
(Bible `:770`, `:4936`) · *"3x8-12 is written as 3x10"*. · `BUILT` — the athlete
sees one number.

## READINESS, AWAY, EQUIPMENT

**R-017** · **A low-readiness declaration deloads a fixed 7-day ROLLING WINDOW**
(Bible `:4961`) · Only the ILLNESS door holds open until cleared. · `BUILT` —
one "cooked" tap no longer deloads forever.

**R-018** · *"Away this week … if yes, follow same program, if no = reselect
equipment … and then the plan should change until their return date"* · Away
RESHAPES the program; it does not avoid the dates. Reuses the onboarding
equipment door with a start and an end date. · `BUILT`.

**R-019** · *"the athlete just removes the equipment they don't have while on the
trip"* · The away equipment answer is a subtraction from the existing list. ·
`BUILT`. **⚠ A three-way question on this was drafted 2026-08-13 and is VOID.**

**R-020** · *"yes clear team training and games while away"* · Away removes team
training and games; the athlete's own sessions stay. · `BUILT`.

**R-021** · *"i've taken out time caps for now"* · No time-cap row renders. **A
DISPLAY ruling, not a deletion order — the `time_limit` kind stays in the type.**
· `BUILT`.

**R-022** · *"i'd rather them shortened"* then ***"signed"*** on four phrases ·
Exercise preference applied / Exercise removed / Exercise prioritised /
Conditioning swapped. **It was FOUR, not three — excluded and pinned are
opposites.** · `BUILT`.

**R-023** · *"yes — one line on week, small card on day, read-only both"* · The
modifier indicator's shape. · `BUILT`.

**R-072** · *"equipment is usually only just for that session - there is no
longer a button on the day screen that allows you to edit equipment. you can
make permanant changes inside the profile section, or temporary changes to
equipment in a session view"* · **THERE ARE EXACTLY THREE EQUIPMENT SCOPES AND
NO FOURTH MAY BE INVENTED:** (1) **PROFILE** — permanent; (2) **SESSION VIEW** —
this session only, and this is the DEFAULT case (*"usually only just for that
session"*); (3) **AWAY** — a dated span that lifts itself on the return date
(R-018). **NO DAY-SCREEN DOOR** — verified absent from `DayWorkoutScreenV2.tsx`
and it must stay absent. · `BUILT` — the session door is
`DayWorkoutScreenV2.tsx:717` (`applySessionEquipment`), executing `swap_exercise`
with `scope: 'today_only'`, `oneOffOnly: true`, one action per exercise, refusing
by name when no safe replacement exists. It writes NO equipment fact:
`missing_this_week` has exactly two writers, both in `EquipmentLimitationSheet.tsx`,
the PROGRAM-screen span door. **⚠ SOURCE-READ, NOT GLASS — the device check is
owed:** open a session, tick kit off, see the rows change.
**WHAT THIS SETTLES:** the census row about an equipment change "not reaching an
existing week" was measured against the WRONG SCOPE. A session-scoped change is
not supposed to rewrite the week.

**R-073** · *"yeah well that sounds shit and not good"* — on a main-strength cut
made without proof · **A CUT MUST BE PROVEN, NEVER INFERRED.** The only producer
of a typed main-strength reduction (`section18SafetyPolicy.ts:311-318`) fires on
`availableSafePatterns.length === 0`, an inference about injury-safe patterns,
and **never asks whether a day remained.** A week that genuinely ran out of room
records NO typed reduction and the Coach Note owes the athlete a reason it cannot
give. His earlier ruling gives the shape
(`INJURY_AUTHORITY_EXHAUSTION_RULING_2026-08-06.md:22-27`): **measured
exhaustion, "proof, never inference".** · `UNENFORCED` — **the LAW has no gate (nothing
PREVENTS an inferred cut), but the DEFECT does not reproduce. Measured
2026-08-13 before building against it.**
**28 weeks, 7 worlds — 4 injury-free and 3 with a SEVERE injury (knee, lower
back, shoulder), including 3-day weeks and game weeks:**
- **weeks with an unexplained main-strength shortfall: ZERO.** Every week met
  its target or carried a typed reduction.
- **every main-strength reduction carries a PROVEN reason** —
  `insufficient_availability` x2 (*"Selected-day availability cannot safely hold
  the original strength target"*, on 3-day weeks) and
  `spacing_safety_conflict` x4 (*"Game-day, G-1 and G+1 protection leave fewer
  safe gym placements"*).
- **`injury_restriction` fired ZERO times** — the
  `availableSafePatterns.length === 0` inference producer never ran, not even
  with a Severe injury.
**SO THE ITEM'S PREMISE — *"a week that genuinely ran out of room records NO
typed reduction at all"* — IS FALSE AS MEASURED.** A 3-day week records
`insufficient_availability` with a detail an athlete could read.
**WHAT I DID NOT REACH:** `availableSafePatterns.length === 0` needs NO main
pattern to be safe, and three single-area injuries do not achieve that. **A
multi-area severe injury might, and that is the only state where the inferred
cut could still appear.** Build only after producing that state.
**PRODUCED, 2026-08-13 — AND THE SHAPE IS NOT THE ONE THIS LINE GUESSED.** The
map was called directly (`resolveRestrictedMainStrengthPatterns`) rather than
reasoned about:

| injuries | patterns left safe |
| --- | --- |
| three SEVERE single-area (knee + back_midline + shoulder) | `["pull"]` |
| **lower_body + upper_body with `pauseAffectedTraining`** | **`[]` ← the state** |
| ONE multi-area severe injury (upper_body + pause) alone | `["squat","hinge"]` |
| `profileInjuries` only — every area, all Severe | `["pull"]` |

**`pull` IS RESTRICTED BY EXACTLY ONE CONDITION IN THE WHOLE MAP**
(`weeklyExposureContractBuilders.ts:244-246`): `region === 'upper_body' && injury.pauseAffectedTraining`.
Nothing else, anywhere, ever touches it. **So a MULTI-AREA injury is not what
does it — it takes TWO active injuries, one of them upper-body AND pausing.**
And **`profileInjuries` can NEVER empty the set** at any severity, because that
half of the map has no `pull` clause at all — which is why three severe
single-area injuries could not reach it and no amount of them would.
**THE STATE IS REACHABLE, SO THE PRODUCER IS LIVE CODE, NOT DEAD CODE.** But in
that state the reason is PROVEN, not inferred — all four patterns are named by a
live injury — so the producer is not what Sam's ruling forbids. **What is still
owed is the LOCK (nothing PREVENTS an inferred cut), never a fix to this
branch.** Do not "fix" the producer; gate it.
**The proof machinery is ready if it ever is needed:**
`section18EffectiveWeekEvaluator.ts:1020` already writes
`unresolvedMinimumShortfall` / `unresolvedPlannerSelectedShortfall` every week,
and `conditioning` already has the exact reduction shape to copy
(`section18AcceptedWeekGateway.ts:1193`). Census C10.

**R-074** · *"okay it needs to be checked"* · **THE SET/BLOCK CAP — short
intermittent high-%MAS work keeps the set to ~4-5 min, "enforced at selection
time, not written into the dose"** (`CONDITIONING_FRAMEWORK_SAM_2026-07-25.md:58`,
`:113`, `:127`). · `BUILT 97c8d41b` (2026-08-13) — `set_length_max_4_5_min` had
five occurrences in the data and NO reader; it is now the fourth clause in the
selection filter. **THE UNIT IS THE BLOCK, NOT THE WORK INTERVAL** — all three
capped templates use second-scale intervals, so a filter on
`longestWorkIntervalMinutes` would have been permanently inert. A block is
rounds x (work + rest), and an authored *"(N min per block)"* WINS over the
derivation. All three are within cap at 4, 5 and 5 min. Two mutants killed
through the REAL selector. Census C11.

## LOAD AND THE JOURNAL

**R-024** · **A game's load counts in FULL** (effort x minutes), same unit as
everything else · · `BUILT`.

**R-025** · **Strength asks how long it took** — all four session kinds carry
real load · · `BUILT`.

**R-026** · **Starting load is 50% of calculated, adjusted from there; load is
athlete-owned** (Bible `:3142`) · A starting point, never a ceiling. · `BUILT`
(`loadEstimation.ts:1029-1043`).

## COPY AND THE ATHLETE'S WORDS

**R-027** · **Athlete-facing words are NEVER invented by an agent.** · Every
athlete-facing string is Sam's, or is drafted and shown to him for a one-word
veto. · `BUILT` — `SignedCopy`.

**R-028** · *"Change of Direction/Decel"* · Sam's own sheet tab name IS the COD
label — origin-signed, not an invention. · `BUILT`.

**R-029** · **The shortfall sentence branches BY CAUSE.** · Fixture-caused gets
its own sentence. · `BUILT 1dc52caf` — `section18ShortfallDisclosure.ts:158`
*"With a game {day}, there's only room for …"*, held both directions by
`test:shortfall-copy`. **⚠ RE-ASKED 2026-08-13 as if it did not exist.**

## HOW SAM WANTS TO BE WORKED WITH

**R-030** · *"stop worrying about adding complexity - just tell me if i need to
tell the terminal or claude code something - keep it simple"* · Replies to Sam:
what happened / what's next / what to send. Under 150 words. · `BINDING`.

**R-031** · *"how is it not obvious that I dont want you to just tell me shit
without updating what i need to tell the terminal?"* · Any answer that creates
work is written to the inbox BEFORE it is said in chat. · `BINDING`.

**R-032** · *"i need you to be shorter in your responses - its too confusing when
you write too much"* · Length is itself a defect. Being right buys no extra
words. · `BINDING`.

**R-033** · *"There has to be a better way than me hand-testing"* / *"my phone is
the last instrument"* · Sam is never the test rig. A change that alters an
EXISTING week is unverified until seen on a week that already existed. ·
`UNENFORCED as a gate` — SEAT_INBOX item 30.

---

---

## FROM THE BIBLE'S OWN CHANGELOG (§19), seeded 2026-08-13

**Every entry there is a ruling by construction** — the changelog exists because
Sam ruled that the Bible is AMENDED when a ruling supersedes it, and each entry
names the text it replaced. **25 of the 54 entries carry `(Sam, <date>)` and are
rows here.** The remaining 29 are Amendment-Pass edits that record WHERE a
superseded line lived rather than a fresh decision; they are covered by the row
their pass produced.

**R-034** · *"Main lifts HALF the sets at RPE 5-6 … power/speed KEPT as a small
sharp dose; conditioning HALF the total work with at most one quality
exposure"* · THE DELOAD LAW. A deload is authored content, not "less volume".
**Power is NOT removed on a deload.** · `BUILT` — `test:deload-law`, green.

**R-035** · *"low readiness means one thing: the next 7 days are deloaded"* ·
THE READINESS LAW. A ROLLING 7-day window from the declaration day, not the rest
of the calendar week. **The tier TYPE is retired** — readiness exposes
deloaded-or-not and nothing else. · `BUILT` — `test:readiness-illness-law`, green.

**R-036** · MILD training unchanged · MODERATE deloaded while the fact is ACTIVE
· SEVERE the authored return ladder · THE ILLNESS LAW, three tiers, all riding
the deload law rather than carrying illness-specific dosing. ·
`BUILT` — `test:readiness-illness-law`, green.

**R-037** · Three sick doors, not two · THE THREE SICK DOORS. With only two, the
law's MODERATE tier had **no producer, no storage and no way for an athlete to
reach it** — a flu-level illness either did nothing or emptied the week. ·
`BUILT` — `test:readiness-illness-law`, green.

**R-038** · *"Tired"* (noted only) · *"Wrecked"* (7 days deloaded) ·
*"Absolutely cooked"* (7 days deloaded AND every session optional) · THE
READINESS DOOR, THREE TIERS. His labels, verbatim. ·
`BUILT` — `test:readiness-illness-law`, green.

**R-039** · Fatigue EXPOSURE-BLOCKING **abolished**. A severity-7 signal blocked
nine exposure types and collapsed strength sessions to Rest — a count reduction
by SIDE EFFECT. · `UNENFORCED` — no suite named for it; the abolition is recorded
in the Bible and I could not name an enforcer.

**R-040** · RAW SEVERITY IS PRIVATE TO THE DOOR. No module outside the minting
door may read a readiness/fatigue severity, tier or magnitude; downstream
consumes the two flags only. · `BUILT` — `test:readiness-ownership`, green.
**⚠ I FIRST CITED A LAW ID THAT DOES NOT EXIST** (`LAW-raw-severity-is-private`);
grepped `lawRegistry.ts` and it returns ZERO. The nearest real rows are
`LAW-day-readiness-doors-are-direct` and `LAW-tired-severity-icon-ladder`,
neither of which holds this. **Citation removed rather than repaired** — a
fabricated reference in THIS file is the exact failure it exists to stop.

**R-041** · READINESS IS A HOMONYM. Two unrelated signals share the name — the
athlete's DECLARATION and a CAPACITY score from onboarding. **Ten call sites
belong to the capacity score and are deliberately untouched.** ·
`UNENFORCED` — a naming hazard, not a behaviour; nothing reds if they re-merge.

**R-042** · Section 18 `illness_recovery` week-mode dosing **DELETED**. It
predated the law and carried its own dosing — two representations, and the wrong
one was running. · `BUILT` — `test:illness-recovery-mode`, green.

**R-043** · Conditioning progression machinery **DELETED, not migrated**.
`TIER_CAPS` were invented numbers quietly deciding an athlete's dose. ·
`BUILT` — `test:conditioning-progression-inputs` asserts the retirement.

**R-044** · Beginners follow the universal phase table in EVERY phase. **The last
beginner-specific structural rule in the Bible, and the authority the code's
`maxCoreSessions: 2` rested on — both gone.** ·
`BUILT` — `trainingAgePolicy.ts` NORMAL_POLICY, `test:rules-kernel`.

**R-045** · *"do not overload them with too many exercises"* is guidance about
dose and complexity, **not a numeric limit** · ONE exercise cap for every
training age. The beginner-only cap of 3 was never authored. ·
`BUILT trainingAgePolicy.ts:43` (`maxExercisesPerStrengthSession: 6`)
**but ⚠ THE CAP IS NOT ENFORCED — it has one reader and that reader FORWARDS it
to the AI prompt. Eight sessions ship SEVEN counted rows (SEAT_INBOX item 25).**

**R-046** · *"Running: 2 days minimum per week, 3 preferred, 4 hard max. Team
training counts toward the running days. The app programs 3 by default."* ·
THE RUNNING LAW. **THREE numbers, not one** — floor 2, preferred 3, hard max 4.
A 4th running day is VALID everywhere and merely unusual; only a 5th breaches. ·
`UNENFORCED` — no suite named for the three-number split.

**R-047** · Muscle/experience sheet reconciliation. **MetCon DELETED** — the
conditioning ruling retiring the name wins over the muscle sheet. ·
`BUILT` — `test:muscle-experience`, green.

**R-048** · THE EXPERIENCE CROSSWALK — the single authored bridge from the
onboarding answer to the ladder (new / developing / consistent / advanced) to the
authored exercise gates. **Regressions are visible.** ·
`BUILT` — `test:muscle-experience`, green.

**R-049** · *"Dose counts main work only. Warm-up and cool-down never count
toward a session's conditioning dose."* · `BUILT` — `test:conditioning-dose`,
green, anchored by `ALL-COND-DOSE-DESCRIPTOR-01`.

**R-050** · THE OPTIONAL PLACEMENT LAW (§20.1). Optional placement is permitted
under stated conditions. **SUPERSEDES the blanket ban an agent generalised from
his words — that generalisation would have red-flagged his own authored early
off-season all-optional contracts.** · `BUILT` — `test:optional-topup`, green.

**R-051** · THE REST LAW (§20.2). **A day holding only optional work is still
rested, and the week reports both.** · `BUILT` — the rest floor
(`weeklyExposureContractV2` `required: 1` on all four rows, `afd07164`).

**R-052** · GUNSHOW COMPOSITION (§20.3), signed · **2 biceps + 2 triceps + 2
pump delts at 2-3 sets.** Supersedes the app's 2+2+1+1 shape whose fourth slot
reached outside the sixteen signed candidates. **Shrink-never-pad.** ·
`UNENFORCED` — no suite named for the composition.

**R-053** · MOBILITY COMPOSED FROM THE POOL (§20.4), signed. **The ten
`MOBILITY_FLOW_TEMPLATES` bundles are NOT recognised** — no ruling cited, no
changeset, no divergence report. · `BUILT` — `test:mobility-accessory-doors`,
green (21 cells, his 2-3 pairs survive the validator).

**R-054** · THE SEVEN STRENGTH SESSIONS (§20.5), signed. The athlete's own door
could previously reach only four of the seven. · `UNENFORCED` — no suite named
for the door's coverage of all seven.

**R-055** · THE FOUR QUESTIONS (§20.6), signed. For any type the app may place,
**"who may place it" is answered by a signed placement rule, not by the word
"generator"**. · `BUILT` — `test:session-type-charter`, green;
`CHARTER_DEBT` is where the app does not yet answer them.

**R-056** · *"off season means NO team training … so these are the only times COD
may be useful"* · THE COD WINDOW (2026-08-13). Duplicate of R-002/R-003 as a
Bible amendment; kept as its own row because the changelog entry is the Bible's
record and R-002/R-003 are the inbox's. · `BUILT 5dc644ed, c086ca3d`.

---

---

## FROM THE RULING DOCS, seeded 2026-08-13

**61 `*RULING*` / `*DECISION*` docs were scanned for Sam's verbatim words. Only
NINE carry any** — the rest record engineering decisions made under his rulings,
which belong to the law registry, not here. **That is the finding, not a
shortfall:** the ruling docs are mostly derivative, and the two sources that
actually hold his words are the Bible changelog and the inbox.

**R-057** · *"i like her fonts > better = please change to them"* · *"on all
pages everywhere"* · *"try and match font and size for everything she has
done"* · THE UI MERGE: Renee's typography, everywhere. ·
`BUILT` — see `docs/UI_MERGE_PLAN_2026-08-10.md`; nine rulings signed.

**R-058** · *"the idea is to merge them together - in the best way possible >
without destroying what i have now"* · The UI merge takes HER STRUCTURE and HIS
STYLE. **Not a replacement.** · `BUILT` — same plan.

**R-059** · *"No days at the top of the page - people only care about the day
they are on and if they need to view the other days they go to weekly view."* ·
No day-strip on the day screen. · `BUILT` — the day/week toggle and the 7-day
chip grid landed 2026-08-12 (Codex).

**R-060** · *"you can already undo changes using coaches notes"* · Undo is the
COACH's job, not a separate surface. · `BUILT` — `test:undo-*`; see
`UNDO_SHAPE_RULING_2026-08-09.md`.

**R-061** · *"the coach should be its own tab and the athlete just talks to it
when it wants to change something without tapping all the buttons? we've spoken
about this before."* · The coach is a TAB and the athlete talks to it. ·
`BUILT` — the coach tab ships; slices 1-3 landed 2026-08-10.

**R-062** · *"the year-round required minimum is 1 genuine sprint/high-speed
exposure per week except early off-season… Any reduction below the floor
requires an explicit typed authorised reason."* · THE SPRINT FLOOR — one per
week, year-round, early off-season excepted, and a reduction must carry a typed
reason. · `UNENFORCED` — no suite named for the floor; the typed-reason
machinery exists (`WeeklyExposureReductionReason`) but nothing was found
asserting the floor itself.

**R-063** · *"counts are STRUCTURE, and the deload law holds structure constant
while the work inside shrinks"* · A deload does NOT cut session COUNTS; it cuts
the work inside them. · `BUILT` — `test:deload-law`, green.

**R-064** · *"`readiness === 'low'` is the CAPACITY score, a different signal
this law does not govern"* · The readiness HOMONYM, restated as a boundary: the
capacity score is not the declaration. · `UNENFORCED` — same as R-041; a naming
hazard with no gate.

**R-070** · **"One main per pattern; Deadlift + RDL is illegal."**
(`LFA_PROGRAMMING_BIBLE.md:226`) · Two heavy lifts of the SAME pattern may not
share a session. · `UNENFORCED` — **no duplicate-pattern validator exists.** The
production fallback at `defaultProgram.ts:1172-1177` emits RDLs + Hip Thrusts,
both `movement: 'hinge'`; again at `:1194-1196`, Overhead Press + Incline DB
Bench, both `push`. The only stacking cap in the repo says the OPPOSITE —
`exerciseScorer.ts:405` allows two of a pattern and bars only three.
**⚠ THIS ROW EXISTS BECAUSE THE GATE CAUGHT ME.** I was carrying "the double
hinge — allowed or not?" to Sam as an open question **for four batches**. It is
RULED, in his own Bible, and has been since before the census wrote it down as
A4. Census `RULINGS_NOT_IN_THE_APP_2026-08-13.md:67`.

---

## QUESTIONS ALREADY PUT TO SAM AND NEVER ANSWERED

**A question he has already been asked, in a document he never came back to, is
the SAME failure this registry exists to stop** — it just fails in the other
direction. Re-asking it in new words wastes the answer he was already offered.
**Grep this section too.**

**Q-001** · **%MAS: RANGE OR BINARY?** ·
`docs/MAS_RANGE_VS_BINARY_DECISION_SHEET_2026-08-04.md`, written FOR him and
explicitly *"Nothing is decided here"*. Template rows carry `90-100% MAS`
ranges; `masCopy.ts` carries a binary `<=30s -> 110% / >30s -> 100%` rule — **two
representations of one intensity.** Three options and a recommendation (the
authored range owns it) are already written out. **STILL OPEN.**
**⚠ THIS IS THE SAME CONFLICT AS THE OPEN PACE QUESTION in SEAT_INBOX item 6's
C2 line** — his answer to the sheet settles both, and they must not be asked as
two separate questions.

**Q-002** · **THE SPRINT CAP: 2 NIGHTS OR 2-3 EXPOSURES?** · **TWO OF SAM'S OWN
LINES, IN DIFFERENT UNITS, AND THEY CANNOT BOTH BE THE ENFORCED NUMBER.**
`LFA_PROGRAMMING_BIBLE.md:90` — *"Sprinting limited to 2 nights per week which
includes nights at team training"* — HARD, counted in NIGHTS.
`:129` — *"A second exposure may occur naturally, while 2-3 remains the usual
maximum"* — SOFT, counted in EXPOSURES.
**This is genuinely his to settle; it is not a lookup.** Census A6. **What the
app does: `sprint: { max: null }` on four contract rows, and team training and
games are CREDITED as sprint exposures (`sessionClassificationAdapter.ts:165`)
— so three team nights alone can reach the cap before the app programs
anything.** **STILL OPEN.**

---

---

## FROM LFA_PROGRAMMING_POLICY_DECISIONS.md, seeded 2026-08-13

**Sam-APPROVED policy, July 2026.** This file carries no verbatim quotes — it
records what he approved rather than what he said — so these rows quote the
DECISION text and say so. **The oldest rulings in the registry, and the ones an
agent is least likely to have read.**

**R-065** · **FOUR HARD DAYS IS THE PREFERRED/DEFAULT SHAPE, NOT A UNIVERSAL
ABSOLUTE MAXIMUM.** Contract v2 owns both the preferred range and the permitted
maximum by phase/mode. **Up to FIVE may be accepted where that mode permits five
and the full §18 evaluation passes.** · `BUILT` — `weeklyExposureCounts.ts:84`
`maxHardDays: 4` is the TARGET and the finding fires above it;
`weekStructureValidator.ts:481` grades 5 as soft/info and 6+ as strong.
**This is the authority behind the 6-hard-day copy split (`b027fef1`).**

**R-066** · **A fixture occupies its day but does not make that weekday
permanently unavailable.** Removing it releases the day; moving it releases the
old day and occupies the new one ATOMICALLY. A known in-season bye releases the
usual game day. · `BUILT` — fixture-conditioned replan;
`test:fixture-conditioned-replan` exists (RED at HEAD, 27 failures — pre-existing).

**R-067** · **THE ACCEPTED EFFECTIVE WEEK IS THE SOLE MUTATION SOURCE** once any
program surface has been accepted. It composes base microcycle + week overlay +
date overrides + accepted calendar/constraint context, then resolves the visible
week under the carried Contract v2. · `BUILT` — `acceptedStateTransaction.ts`,
`test:accepted-state-transactions` 23/23 + 10/10 + 10/10.

**R-068** · **AN ATHLETE MAY BIN A PROGRAMMED SESSION** — even one marked CORE,
even one supplying a required weekly exposure. **The explicit deletion OWNS the
named target.** CORE creates an obligation on the planner to preserve equivalent
exposure elsewhere where possible; it is NOT a veto on the athlete. ·
`BUILT` — `LAW-warn-then-allow` / `mayOverrideBlock` (`ca33206f`),
`test:block-override`.

**R-069** · THE FIVE LOCKED DECISIONS, 14 July 2026: (1) practice-match weeks use
S3 with 1-2 TT and S3-4/default3 with 0 TT; (2) bye recovery is **exactly 2
lighter lifts**; (3) the first off-season block is early/early/mid/mid **with no
Week 4 deload**, then late off-season continues until the athlete changes phase;
(4) multi-pattern credit requires meaningful main-strength work with equal or
near-equal weekly main-lift balance; (5) **field activity NEVER receives
automatic power-primer credit, and power has no required weekly numeric
minimum.** · `BUILT` — §18 phase planner; `test:section18-phase-planner`
(RED at HEAD — pre-existing, not from this seeding).

---

## SEEDING IS INCOMPLETE AND THAT IS STATED, NOT HIDDEN

**74 rows, plus two OPEN questions.** Seeded from `COWORK_SEAT_HANDOFF_2026-08-13.md`'s
"RULINGS MADE TODAY", `SEAT_INBOX.md`'s answered `## AWAITING SAM` entries, the
stand-downs, `SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md`, and
`RULINGS_NOT_IN_THE_APP_2026-08-13.md`.

**THE BIBLE CHANGELOG IS NOW SEEDED (2026-08-13)** — 25 of its 54 entries carry
`(Sam, <date>)` and are rows R-034..R-056. The other 29 are Amendment-Pass edits
recording WHERE a superseded line lived rather than a fresh decision.

**THE RULING DOCS ARE NOW SCANNED (2026-08-13).** All 61 `*RULING*`/`*DECISION*`
docs were searched for Sam's verbatim words; only NINE carry any, and those are
rows R-057..R-064. **The rest record engineering decisions made UNDER his
rulings** — they belong to the law registry, not here.

**EVERY NAMED SOURCE IS NOW SEEDED (2026-08-13):** the handoff, the inbox's
answered AWAITING SAM entries, the stand-downs, the archived orders, the census,
**the Bible changelog** (R-034..R-056), **the 61 ruling docs** (R-057..R-064) and
**`LFA_PROGRAMMING_POLICY_DECISIONS.md`** (R-065..R-069).

**THAT IS NOT THE SAME AS COMPLETE.** Rulings Sam made in CHAT and captured
nowhere are, by definition, not here — the registry can only hold what was
written down. **A grep returning nothing still means "not recorded", never "he
never decided".**

**Until seeding is complete, a grep that returns NOTHING is not proof a ruling
does not exist** — say so in the question rather than claiming he never decided.
