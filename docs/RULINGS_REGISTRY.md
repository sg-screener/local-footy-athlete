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
**⚠ THIS ROW READ `STILL PARTLY UNENFORCED — the week fact is profile-derived
until the dated no-team-training span exists (item 31 part 5)` AFTER THAT SPAN
HAD SHIPPED.** Corrected 2026-08-13 by seat `arms`, which was sent to build it —
**that sentence is what SEAT_INBOX item 55 was written from, and item 55 is
therefore stale too.** The span exists (`no_team_training` schedule fact) and is
threaded end to end: `noTeamTrainingSpansFromConstraints`
(`services/api/generateProgram.ts:483`) → `clubClosedSpans`
(`utils/coachingEngine.ts:8943`, joined with away because *"the club is shut to
him this week"* is ONE question) → `teamDays` → `codDecelPermitted`. **Held by
`test:christmas-break` `[11]`/`[11b]`/`[11c]`, 44/0, on BOTH readers** (the
engine's `inputs.teamTrainingDays` and the plan's `isTeamDay`), with `[11]` as
the non-vacuity control. **Mutation-proven, not read:** deleting
`...(options.noTeamTrainingSpans ?? [])` from `clubClosedSpans` reds 7 cells
including `[11b]` and `[11c]` while `[11]` stays green.
**⚠ AND THE WINDOW OPENS ONTO NOTHING — MEASURED, NOT INFERRED.** A pre-season
club athlete in a week wholly inside his declared break loses both club nights
(control: *Team Training + Upper Push/Pull*; break week: none) and still gets
**ZERO COD sessions and ZERO COD rows.** That is **not** this row: it is
SEAT_INBOX **28-C1** — `pickPlacementCondCategories` PASS 1 ranks over
`categoryPriority`/`zonePriority` and **neither list ever contains `cod_decel`**,
and `categoryToFlavour` has no `cod_decel` case, so the ranking fix alone breaks
generation (`LAW-every-category-has-a-flavour`, `dd73a53b`, is the guard). **The
gate is no longer the wall. The ranking is.**

**R-004** · *"that way the app isn't guessing"* · The Christmas break is set by
ASKING: ~10 Dec *"when is your last team training?"*, ~3 Jan *"when does team
training go back?"*. The dates are defaults for WHEN TO ASK, never inferred
answers. · `BUILT` — `src/rules/christmasBreakAsk.ts` holds both halves keyed to
one break year, with **production readers** (`screens/home/useHomeScreen.ts:79`
imports `decideChristmasBreakAsk` and returns it at `:1584`;
`screens/home/HomeScreenV2.tsx:118` consumes it), held by `test:christmas-break`
**44/0**.
**⚠ THIS ROW SAID `UNENFORCED` FOR HOURS AFTER THE WORK LANDED, AND THAT IS THE
DEFECT THIS REGISTRY EXISTS TO PREVENT.** Its status still pointed at *"SEAT_INBOX
item 31 part 5"* while item 31 read *"ALL THREE ARE BUILT — VERIFIED, NOT REBUILT.
NOTHING IS OWED HERE."* **A row that says UNENFORCED over finished work sends the
next agent to rebuild it** — the exact waste gate rule 2 guards in the other
direction, and the thing Sam has been angriest about. **Corrected 2026-08-13 by
the desktop after opening the enforcer and finding it PRESENT**, which is gate
rule 2 run backwards and should be routine.

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

**⇒ THAT FIRST STEP IS DONE. RE-MEASURED 2026-08-13 (terminal), and this row's
blocker is CLOSED — do not chase it.** `getExerciseTags` canonicalises before
looking up (`exerciseTags.ts:3439`), so every name this row lists as unresolved
now resolves: `Face Pulls` -> `Face Pull`, `Pallof Press` -> `Band Pallof
Press`, `Bicep Curls` -> `Bicep Curl (Dumbbell)`, `Tricep Pushdowns` ->
`Tricep Pushdown`, `Romanian Deadlift` -> `RDLs`. **Probed over the 25 names the
generator actually ships in the away and QA weeks: 24 resolve.** The one that
does not is `Short Flush`, which is a CONDITIONING template
(`conditioningTemplates.ts:1186`) and correctly carries no strength tags —
**absence there is the right answer, not a blind spot.**

**AND THE DRIFT HALF IS ALSO DONE — `9b19244f`.** `main_pattern_drift` was
DESTROYING coverage: it measured every row against the plan's MAIN LIFT, so the
fallback emitted Sam's ladder and the canonicaliser deleted the hinge back out
(measured: 1 drop in the away suite, 0 across the QA corpus). Drift is now
measured against the day's own ladder (`patternsCompletingLadder`), and the guard
still refuses genuine drift — a push row on a squat day is still removed.
**⚠ Neither of these COMPOSES anything, so this row stays `UNENFORCED` and that
is honest.** What is left is the composer itself, and per the trace below it is
NOT `buildTagAwareSession`.

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

**R-076** · *"face pull is shoulder work for sure"* (2026-08-13) · **A POOL SLOT
IS AN INTERCHANGEABILITY CLAIM, and a face pull is not a substitute for a row.**
`applyPoolRotation` swaps freely within a (slot, role) pair, so filing
`Face Pull` under `horizontal_pull/accessory` beside `Seated Cable Row` declared
them equivalent. · `BUILT` — `exercisePoolsStrength.ts`: `Face Pull`,
`Rear Delt Fly` and `Band Pull-Apart` moved to the `isolation_upper/accessory`
shoulder block. **He ruled the face pull BY NAME; the two siblings moved with it
because his sentence is about the class and leaving them would keep the identical
defect under two other names.** `Seated Cable Row` stays and is now the only
accessory in that slot — a real narrowing of rotation variety there, stated
rather than found later.
**THE FOUNDING CASE:** closing an unrelated name-lookup miss let rotation act on
this membership and shipped `Pull-Ups | Barbell Row | Face Pulls` ->
`Pull-Ups | Barbell Row | Seated Cable Row` — two rows, no shoulder work.
Refuted and backed out (`faa69c2f`) before it reached him.
**MEASURED OUTPUT-NEUTRAL ON ITS OWN:** 3 worlds x 3 weeks, generated names
byte-identical before and after, because the lookup miss still masks rotation
here. It is a PREREQUISITE, not a fix on its own.
**⚠ AND THE LOOKUP FIX IS STILL REFUTED, FOR A NEW AND DEEPER REASON.** With
R-076 landed, canonicalising `classifyPoolSlot` swaps `Face Pulls` ->
`Bicep Curl (Barbell)`, and turns `Bicep Curls | Tricep Pushdowns` into
`Bicep Curl (Barbell) | Bicep Curl (Dumbbell) | Hammer Curl` — **three bicep
curls and no triceps**, his own two-squats shape in arm form.
**`isolation_upper/accessory` is ONE undifferentiated pool holding three muscle
groups.** The file's own comments name them — `// Bicep block`,
`// Tricep block`, `// Shoulder / trap block` — and rotation ignores all three.
**Sub-grouping that pool is the next unit, and the lookup fix waits on it.**

**R-079** · *"yes we do nights - in season that may mean 3 sprint sessions"* ·
*"in later off season after first 4 weeks of off season, they can sprint once a
week - in pre season christmas break they can sprint once a week as well"* ·
*"in pre season you can do flying sprints when there is team training because you
will get accelerations at footy"* (2026-08-13) ·
**1. THE UNIT IS NIGHTS.** Settles the Bible's own clash between `:90` (nights)
and `:129` (exposures) — `:90` wins. **A night is a night whether it holds one
sprint effort or twenty.** · `BUILT` —
`section18EffectiveWeekEvaluator.ts` `sprintHighSpeed.achievedCount` was
`sprintSources.length`, and one evening can raise TWO sources (a team-training
anchor and a typed true-speed block on the same day), so an athlete was charged
twice for one night out. Now counts DISTINCT `dayOfWeek`. The sources list is
untouched, so evidence keeps its detail and only the COUNT changes unit.
**2. THE PER-PHASE NUMBERS.** In season **up to 3** (was capped at 1, so a normal
club week with two team nights and a game was over its own ceiling by
construction — his *"that may mean 3"* is ACCEPTABLE, not a breach); late
off-season **1** (was 2); Christmas break **1**. ·
`BUILT` for in-season and late off-season in
**`weeklyExposureContractV2.ts`'s `policyFor` — which is the table §18 actually
reads.** In-season `max: null -> 3` on all three in-season blocks
(`in_season_game_week`/`practice_match_week`, `bye_build`, `bye_recovery`);
late off-season `preferred {1,2} / max 2 -> {1,1} / max 1`. **The TARGET stays 1
in-season** — his word is *"may"*, so three is a ceiling, not something to aim
for. **`max: null` meant NO CAP AT ALL, so this is the first authored in-season
sprint ceiling the app has had — census row A6 closed for that phase.**
**⚠ I FIRST EDITED THE WRONG TABLE.** The same numbers live in
`weeklyExposureContractBuilders.ts`, which is live but feeds a DIFFERENT consumer
(`coachingEngine`, `postGenerationConstraintValidation`, `preseasonExposureContract`),
and cell `9f` caught it by reading `permittedMaximum` off the contract the app
builds and finding it unchanged. **Both tables now carry the ruling; the V2 one
is the one that binds.** This is the fourth sighting today of a fix aimed at a
layer not in the chain. **⚠ CHRISTMAS IS NOT BUILT** — the break
has no mode of its own yet (R-002 makes it an off-season inside pre-season) and
R-004's dated span is still `UNENFORCED`, so there is nowhere to hang the number.
**3. PRE-SEASON IS A QUALITY RULE, NOT A COUNT — `UNENFORCED`.** `top_end_speed`
on a team night is his ruling; `acceleration` on a team night is the duplication
he is avoiding. **The nights unit is the PRECONDITION for it** — under a source
count his own instruction read as a breach — but nothing yet distinguishes the
two qualities on a team night.
**4. THE CROSS-CHECK HE ASKED FOR IS NOT DONE:** whether a pre-season team night
carrying flying sprints stays ONE hard day against R-007 and Bible `:118`.
Reported as owed rather than assumed.

**R-080** · *"Bodyweight leg day gets more single-leg knee work"* (2026-08-13) ·
**A LUNGE MAY NOT ROTATE INTO A SQUAT.** Asked whether a bodyweight leg day
should repeat the row, drop it, or ship short, **he refused all three and named
the slot instead** — the day was missing single-leg knee work and that is what
belongs there. · `BUILT test:pools` — `exercisePoolsStrength.ts`
`squat/accessory` held BOTH of his `:227` ladder slots in one list (bilateral
squats AND single-leg knee work), so `applyPoolRotation` swapped freely between
them. Measured, bodyweight off-season: `ROT Reverse Lunges -> Bodyweight Squat`
and `ROT Back Squat -> Bodyweight Squat` — **two rows became the SAME squat and
one of them had been a lunge.** Split into `single_leg_knee` /
`bilateral_squat` using the `PoolEntry.group` rule already built for the
arm/shoulder pool; rotation varies within a group and never across one.
**ATHLETE-VISIBLE, MEASURED EITHER SIDE:**
`Bodyweight Squat · Glute Bridge · **Bodyweight Squat** · Single Leg RDL · Leg
Extension · Back Squat` -> `Bodyweight Squat · Glute Bridge · **Walking Lunges** ·
Single Leg RDL · Leg Extension · Back Squat`. The duplicate is gone and the day
gains the single-leg knee slot — **the slot the coverage sweep measured as
most-missed (8 of 44 days).** `test:pools` 496/0, cells assert a lunge never
leaves its group across 12 cycles and that a bilateral squat never enters it.

**R-081** · *"similar is right"* (Sam, 2026-08-13, answering `audit` directly) ·
**CONTRAST PAIRS ON A SIMILAR PATTERN, NOT THE SAME ONE — the partner is chosen
by FAMILY.** Bible `:225` says *"an explosive lift of the SAME pattern"* and
`:1099` says *"an explosive movement that uses a SIMILAR pattern"*. **His own five
examples settle it and FOUR FAIL the strict reading**, measured through the app's
own tags: Box Squat `squat`→Vertical Jump `plyo`, Back Squat `squat`→Broad Jump
`plyo`, Trap Bar Deadlift `hinge`→Broad Jump `plyo`, Split Squat→Vertical Jump
`plyo`; only Bench Press→Explosive Push-up is a true pattern match. **Every LOWER
entry in `POWER_EXERCISE_POOL` tags `movement: 'plyo'`, never `squat`/`hinge`.**
· `BUILT e665ab44` — `powerRowAlignment` forms the pairing (heavy lift
`supersetOrder` 1, explosive movement 2) and `workoutCanonicalisation` stops
stripping a COMPLETE pairing and splices it at the main slot.
`test:power-primer-policy` `[42a]`-`[42f]`, non-vacuity first, mutation-proven
both ways (reverting the source reds `[42a]`-`[42d]`; pairing every row reds
`[42e]`).
**⚠ SEAT_INBOX ITEM 42 ASKED FOR THE OPPOSITE AND WAS REFUTED BEFORE BUILDING.**
Its acceptance test was *"same pattern both halves"* and it called
`powerRowAlignment`'s family check a defect. **Building it as written would have
made the app refuse four of the five pairings Sam authored.** The family check is
CORRECT and stays. **A ruling premise is a claim too — `:225` was trusted without
opening `:1099` or the pool.**
**⚠ AND `:225` IS NOW THE ONLY PLACE CARRYING THE REFUTED WORDING.** It should be
amended to *"similar"* with a changelog line, the way R-079 amended `:90`'s flat
*"2 nights"*. **Not done on the back of a three-word reply; `:1099` already states
the correct rule, so nothing is broken while it waits — but a Bible line that
contradicts a registered ruling is the same disease as a rule that lives in words
and not in code.**
**NOT A BREACH OF R-015.** That row's *"main lifts are NEVER paired"* is scoped to
MOBILITY pairing; `:225` opens *"**EXCEPTION** — contrast training"*. Contrast is
the named exception, and this was checked before the pairing shipped.

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

**R-075** · *"Away has to replace the work it removes, not just delete it - your
Saturday Rest Day is the wrong case."* · and, verbatim: *"If nothing was on that
day then it's probably worth just leaving as rest - if something was on that day
then it should be substited with a new similar session to keep the program
flowing - it really is common sense"* · *"if I go away for 2 weeks and I was
going to miss 4 team trainings 1 game and 5 strength sessions, then the 2 weeks
should aim to fill those with 5 conditionings and 5 strength ya know"* ·
**AWAY IS A SUBSTITUTION, NEVER A SUBTRACTION.**
**HIS EXAMPLE IS THE SPECIFICATION:** a day that held NOTHING stays REST; a day
that held SOMETHING gets a SIMILAR session; **the unit is the AWAY BLOCK, not the
day** — 4 team trainings + 1 game = 5 removed -> **5 CONDITIONING**, 5 strength ->
**5 STRENGTH**. Team training and fixtures map to CONDITIONING because that is the
quality they supplied — the same crosswalk the exposure counts already use.
***"AIM to fill"*** is a target, not a hard floor; a shortfall must SAY SO.
· **THE DAY HALF IS `BUILT 59b0994a`+ (2026-08-13), SEEN ON GLASS:** a vacated
Saturday reads *"Conditioning — 2 exercises"* (`400 m Repeats`), Sunday held
nothing and correctly stays *"Rest Day"*. `sessionResolver.ts` `freedByTheTrip`,
held by `test:away-flow` [15d]/[15e] — and [15e] asserts the KIND, because the
first build filled the day with `prehab_accessories` and that is a substitution in
SHAPE, not in KIND.
**THE BLOCK HALF IS HALF BUILT, AND IT IS MEASURED ON HIS OWN EXAMPLE** (a 4-week
block, 8 club nights — `test:away-flow` [13g]/[13h], non-vacuity first. **An
earlier version of this row said "2 weeks" and was wrong**: `microcycleLimit: 2`
is a request and the generator returned four. The ratios are per-block and
unaffected):

| | home | away |
| --- | --- | --- |
| club sessions | 8 | **0** |
| conditioning sessions | 4 | **12** |
| strength sessions | 20 | **16** |
| strength rows | 79 | **72** |

**THE CONDITIONING ARM HOLDS EXACTLY — 8 club nights removed, 8 conditioning
sessions added, one for one.** His ratio, on his own shape, and nobody had built
it for this case; it falls out of the plan-side club filter. `BUILT`, pinned by
[13h].
**⚠ THE STRENGTH ARM IS BREACHED: 20 -> 16 sessions, 79 -> 72 rows — AND THE LOSS
IS ONE EXACT DAY, NOT A DIFFUSE SHORTFALL.** Traced week by week:

| | home week | away week |
| --- | --- | --- |
| Mon | Lower Body Strength (core, 3) | Lower Body Strength (core, 4) |
| Tue | **Team Training + Upper Pull** (core, 3) | Lower Squat (core, 5) |
| Wed | Prehab & Accessories (opt, 5) | Prehab & Accessories (opt, 5) |
| Thu | **Team Training + Upper Push** (core, 3) | *(nothing)* |
| Fri | **Gunshow** (opt, 6) | Upper Body Strength (core, 4) |

**HE LOSES THE FRIDAY GUNSHOW — AN OPTIONAL DAY THE TRIP NEVER TOOK.** Core work
GROWS (9 -> 13 strength rows) because the club's upper volume comes back as real
sessions; what disappears is one OPTIONAL strength day per week, which is why the
count falls by exactly 4 over a 4-week block.
**THE LEVER IS FOUND, AND TWO WRONG SUSPECTS WERE ELIMINATED BY MEASUREMENT
FIRST — neither is the day set nor the budget.**
- `onboardingToCoachingInputs` returns `selectedDays` = Mon-Fri and
  `availableDays` = 5 in **both** arms. Not the day set.
- `actualCore=3, extraDays=2, optionalSessions=2` — **byte-identical in both
  arms.** Not the budget.
- `buildWeeklyPlan` then returns **4 allocations home and 3 away**, and the one
  missing away is the only `tier: 'optional'` entry.

**THE MISSING DAY IS THE GUNSHOW, AND IT IS ANCHORED TO THE FIXTURE.**
`coachingEngine.ts`, the remaining-days loop: the Gunshow is placed on
`slot.offset === -1` — **G−1, the day before the match.** Home has a Saturday
game, so G−1 is Friday and the Gunshow lands. **Away has no game, so there is no
G−1 and the Gunshow is never placed.** The code says so in its own words: *"the
gunshow is fixture-relative"*.

**SO THE TRIP REMOVES TWO THINGS AND REPLACES ONE.** The game goes (correctly,
R-020) and the G−1 session goes with it as a side effect. **That is precisely
what R-075 forbids** — *"replace the work it removes, not just delete it"*.

**⚠ AND IT MEETS A SIGNED RULING GOING THE OTHER WAY, RECONCILED HERE RATHER THAN
BUILT OVER.** Sam killed spare-day accessories on 2026-07-30 — *"Empty days stay
empty; the athlete has the add menu"* (R3), and re-ruled its neighbour need-based:
*"The trigger is the LACK, not the day."* **These do not collide, and the reason
is the TRIGGER:** R3 forbids filling a day because it is EMPTY; R-075 requires
filling because the TRIP TOOK SOMETHING. The second is the need-based shape Sam
already approved, with the trip as the need. **Build it as a need triggered by a
live travel span — never as "there is a spare day".**
**IT IS GENERATION-SIDE AND MUST NOT BE STARTED AT THE TAIL OF A SESSION** — it
owes `test:scenarios` + `test:qa` either side, and half-doing a generator change
late is the documented way the last two nights went wrong.
**It is deliberately NOT carried as a red cell** — `LAW-0-registry` forbids a law
entering as UNENFORCED and a permanent red is the same thing wearing a nicer word.
**Do not loosen [13h] to cover strength; build the conservation, then assert it.** A day the trip empties — a vacated fixture, a team-only night —
must carry REPLACEMENT WORK. **Both *"Training Day"* (the empty-day placeholder)
and *"Rest Day"* are wrong answers to the same question**, and he ruled out the
second one the same day it shipped. This is the read-side statement of R-018
(*"the plan should change until their return date"*) and it is what R-020's
*"the athlete's own sessions stay"* means when the club's work is what left. ·
`UNENFORCED` — and the blocker is ARCHITECTURAL, measured 2026-08-13, not a
missing rule:
**THE READ CANNOT AUTHOR.** `applyAwayPass` is a filter over `ResolvedDay[]`;
§18 tier four runs at read time with `resolveVisibleWorkouts: (w) => [...w]` —
the IDENTITY — so it can conform a week but has no generator and cannot place a
session that does not exist. **Moving the away pass BEFORE §18 was tried and
measured on glass: Saturday stayed empty and WEDNESDAY GOT WORSE** (core
`Conditioning` became optional `Accessories`). Reverted.
**AND THE AUTHORING ROUTE IS ALSO MEASURED AND ALSO FAILS TODAY:** putting travel
on the deriving lane re-authors the week but costs a training day (Thu
`Strength` -> `Rest Day`), takes ~1 minute, and generates 1,220 workouts — §18's
48-candidate repair search on a club-less bye-build (SEAT_INBOX item 28).
**SO R-075 IS BLOCKED ON THE SAME §18 BYE-BUILD SHORTFALL AS ITEM 28, AND THAT
IS NOW THE ONE UNIT BEHIND BOTH.**
**THE MECHANISM HE IS ASKING FOR ALREADY EXISTS AND IS NAMED:**
`sessionResolver.ts` `_resolveDateRaw` already answers *"a game slot was freed"*
with `buildDerivedSession('prehab_accessories', …, 'Freed game slot', …)` — but
only for a TEMPLATE game with no calendar mark, so an away-vacated MARKED fixture
never reaches it. **Start there, not from scratch.**

**⚠ THIS ROW IS INTERNALLY INCONSISTENT AND NEEDS A SEAT TIDY — 2026-08-13.**
Concurrent edits interleaved it. It still says *"THE READ CANNOT AUTHOR"* and
*"start there, not from scratch"*, **both of which are superseded**: the read DOES
author now (`freedByTheTrip` in `sessionResolver.ts`, shipped `c8702c56`, seen on
glass), and the day half is BUILT. Read the newest paragraphs, not the oldest.

**⚠ THE STRENGTH ARM WAS ATTEMPTED AND BACKED OUT — §8 SECOND WALL, 2026-08-13,
and the attempt is worth more than the code was.** A `fixtureRemovedByTrip` input
was added (writer: `onboardingToCoachingInputs`, from `resolvedFixtureDay`
surviving vs `targetFixtureDay` not) and a replacement placement tried at TWO
sites:
1. **The game branch's remaining-days loop — DEAD CODE.** Measured: the away arm
   never enters it (`hasGameThisWeek=false, isByeWeek=true,
   kind=in_season_bye_week`). Removed rather than left sitting.
2. **The bye branch's final assembly — FIRES, AND THE SESSION STILL DOES NOT
   SHIP.** Probed: *"placing trip gunshow on Tuesday"* prints, and the next probe
   reads `weeklyPlan n=3 :: Monday[core] Tuesday[core] Friday[core]`. **The
   allocation is made on a day the loop believes is UNALLOCATED, and the plan
   comes out with that day CORE and the optional gone.**

**SO `allocations` AND THE FINAL PLAN DISAGREE ABOUT TUESDAY — the bye allocator
has a second writer the final loop cannot see. THAT DISAGREEMENT IS THE UNIT, not
the placement.** Do not attempt a third site before it is explained: the flag is
proven live (`true` away, `false` home) and the branch is proven correct, so a
third guess is the third wall of the same shape. `coachingEngine.ts` was restored
byte-identical to HEAD.

**R-077** · *"let's go by week for that actually they will likely train less than
normal and i think they can always add a session in if they need to"* (Sam,
2026-08-13, answering R-075 vs R-069(2) on the STRENGTH count) · **AN AWAY WEEK
KEEPS THE BYE SHAPE FOR STRENGTH.** R-069(2) — *"bye recovery is exactly 2
lighter lifts"* — WINS. A trip is not a rebuild of the three gym days it
replaced, and the missing lifts are not chased. · `BUILT` — **the answer was DO
NOTHING, and nothing was done**: `coachingEngine.ts` is untouched and the three
placement attempts recorded under R-075 stay reverted.
**⚠ SCOPE — R-075 IS NOT OVERTURNED.** He ruled the STRENGTH count only. **The
conditioning replacement stands and ships**: a freed fixture day carries a
conditioning session (`freedByTheTrip`, `c8702c56`, seen on glass). Away still
replaces the club's work in KIND; it simply does not chase the lifts.
**THE ESCAPE HATCH IS PART OF THE RULING, AND IT IS VERIFIED RATHER THAN
ASSUMED** — he accepted training less BECAUSE he can top it up. Measured through
the real door (`listPlanChangeOptionsForDay`) on a live away week: **all seven
days return `canAdd: true` and offer `strength_upper`, `strength_lower`,
`strength_full` and `gunshow`.** Held by `test:away-flow` [17e]/[17f]/[17g],
non-vacuity first — at HOME the fixture day is `locked: 'game_day', canAdd:
false`, which proves the door is live.
**AND THE FREED DAY GAINED MORE THAN A SESSION:** at home that Saturday is a
LOCKED fixture; away it is editable and takes an added session on top. The
freed-Saturday work did not just fill the hole, it opened it to him.
**R-078** · *"leave it"* (Sam, 2026-08-13, asked directly with the number in front
of him) · **ZERO COD/DECEL IN A TIGHT NO-TEAM-TRAINING WEEK IS CORRECT, NOT A
DEFECT.** His Bible already rules the COD/Decel row *"LOW selection priority"*,
and a permitted week has only **2.0-2.75 conditioning slots against 3-4
categories** — so a last-ranked category is unreachable by ARITHMETIC and is
placed ZERO times. He was shown that number and the cost of the alternative (one
`tempo` session would have to give up its slot) and ruled the app correct as it
stands. **"Low selection priority" and "prescribed" cancel, and he chose LOW.**
· `BUILT` — **the answer was DO NOTHING, and nothing was done**: `coachingEngine.ts`
is byte-identical to `HEAD` and both attempted fixes are reverted. Held by
`test:standalone-conditioning-ownership` (4 cells, R-078): the gate PERMITS the
world, the pool is non-empty, the week really does place conditioning, and COD is
still zero. **Mutation-proven** — forcing `cod_decel` to the front of the
candidate list reds it at `cod: 6`.
**⚠ THIS ROW EXISTS TO STOP A FIFTH ATTEMPT.** The item was "fixed" and reverted
FOUR times; every attempt was honest and every one aimed at RANK. **Urgency is
refuted (`mustCoverCategories` feeds the scorer, not the picker) and rank is
refuted (Pass 1 orders from `categoryPriority`/`zonePriority`, which never contain
`cod_decel`).** Do not re-open without a new ruling from Sam.


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
exhaustion, "proof, never inference".** · `BUILT test:section18-safety` — the
LOCK, 2026-08-13, cells `R-073a/b/c`. **Mutation-proven; receipt at the end of
this row.** The DEFECT never reproduced. Measured
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

**⇒ THE LOCK IS BUILT 2026-08-13** — `test:section18-safety` cells
`R-073a/b/c`, suite 37/0, mutation witnesses 6 -> 7.
**The producer was NOT touched**, exactly as the line above orders — the ruling
gained a gate, the code gained nothing.

**THE MUTATION WITNESS, AND IT IS THE WHOLE VALUE OF THE CELL:** reinstate the
historical defect — `availableSafePatterns.length === 0` -> `requiredSafe.length
=== 0` at `section18SafetyPolicy.ts:311` — and **`R-073b` reds** naming the two
patterns that were still safe. Restored and byte-compared to HEAD after.

**⚠ AND THE FIRST VERSION OF THE LOCK WAS A BLIND GATE — ITS MUTANT SURVIVED.**
It fed an all-optional week with NO injury and asserted no cut. Green, and
worthless: the producer sits inside `if (prohibited.length > 0)`
(`section18SafetyPolicy.ts:269`), so a world with no prohibition **never reaches
the line the ruling is about.** The defect needs BOTH halves at once — an injury
that prohibits SOME patterns (so the producer is entered) AND a mode whose
`strength.required` is 0 (so `requiredSafe` collapses for reasons that are not
about safety). The fixture is therefore `early_offseason` + a PARTIAL lower-body
injury: squat and hinge go, **push and pull remain safe, so the honest answer is
NO CUT.** `R-073c` keeps the wider healthy-week arm but **states in the file that
it cannot kill this mutant** — sighting of `a-green-gate-is-a-claim`, caught by
mutating rather than by reading.

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
`BUILT` — `test:readiness-structure-law` block [8], 2026-08-13, seat `readiness`.
**⚠ THE ROW'S OWN PREDICTION CAME TRUE AND IT IS WHY THIS IS NO LONGER
`UNENFORCED`.** It read *"nothing reds if they re-merge"*, and between
2026-07-27 and 2026-08-13 **they re-merged in ten sites and nothing red** — the
census's detector included, which matched on the word `readiness` and so could
never see the difference. **The ten sites this row calls "deliberately
untouched" are STILL correct and were not touched; the ten in
`docs/STATUS_READINESS.md` are a DIFFERENT ten**, and the coincidence of the
number is why they had to be counted rather than assumed.
**THE SIGNALS NOW HAVE SEPARATE NAMES** (Sam's order, 2026-08-13): the
DECLARATION keeps `readiness`; CAPACITY is `CapacityBand` / `capacity` /
`calculateCapacity`, finishing the migration `capacityRubric.ts` began. **The
gate reds on any `readiness` compared against `'low'`/`'medium'`/`'high'`,
because after the split the declaration is never a three-level band.**

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
`BUILT` — `test:rules-kernel`, 122/0, 2026-08-13, seat `readiness` (item 53).
**⚠ THE ROW WAS WRONG, NOT THE APP. The enforcer was never NAMED, and every one
of the ruling's four clauses already had a cell:**
- *three DIFFERENT numbers* — `rulesKernelTests.ts:447` pins `min/preferred/max`
  as `2/3/4` and would red if any two collapsed.
- *team training counts toward the running days* — `:376`, two team trainings
  plus a game = **3** running exposures, with the off-feet flush excluded so the
  cell cannot pass by counting everything.
- *a 4th is valid, only a 5th breaches* — `:461` counts 4, `:525` asserts 4 is
  NOT over, `:472` asserts 5 IS over. Both directions, which is what makes it a
  three-number law rather than a cap.
- *floor 2* — `:550`, a 1-running-day week breaches, and `:557`/`:560` honour the
  two authored exemptions.
**MUTATION-PROVEN BEFORE THIS ROW WAS CHANGED, because a row certified off a
green suite nobody probed is how R-052 went wrong:** neutering the running-floor
emitter reds 4 cells; moving `minRunningExposures` 2 -> 1 reds 3. Restored from
backup, `git diff` clean.

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
`BUILT` — `sessionBuilder.ts` `arms_pump` is literally
`[{biceps, 2}, {triceps, 2}, {delts, 2}]`, and **TWO suites name the composition
and assert it**: `optionalTopUpTests.ts:499` (*"R1. the G-1 Gunshow is Sam's
SIGNED 2 biceps + 2 triceps + 2 pump delts"*, 27/0) and
`mobilityAccessoryDoorTests.ts:149` (*"A1. a Gunshow is 2 biceps + 2 triceps + 2
shoulder"*, asserting `counts.biceps === 2 && counts.triceps === 2 &&
counts.delts === 2`, 28/0). Shrink-never-pad is `pickFromPool`'s own behaviour.
**⚠ THIS ROW READ `UNENFORCED — no suite named for the composition` WHILE TWO
SUITES NAMED IT.** Corrected 2026-08-13 by the desktop after opening the
enforcers and finding them PRESENT and GREEN — gate rule 2 run backwards. **The
row was not describing the code; it was describing a search nobody had redone.**
**⚠ AND THE COUNTS WERE NEVER THE WHOLE ROW — "AT 2-3 SETS" WAS UNHELD UNTIL
2026-08-13, seat `arms`.** A1/A2/R1 assert the six exercises and their pools;
**no cell in the repo had ever read `prescribedSets` on this session**, so the
dose shipped correctly only because all sixteen signed rows happen to be authored
at 2 or 3. **And `A3`, the cell carrying shrink-never-pad, reads POOL SIZES and
builds nothing** — it stayed green through a mutation that padded a thin kit back
to six rows. Both closed and mutation-proven: `test:mobility-accessory-doors`
`[A4]` *"every Gunshow row carries Sam's AUTHORED 2-3 sets"* (band on the signed
rows AND the built session carrying the pool's own number) and `[A5]` *"a thin
kit really does shrink it — built, not inferred"*, **30/0**. **Measured across
four kits: gym 6 rows, dumbbells 5, bands 2, and BODYWEIGHT-ONLY ZERO — an empty
session card.** That last one is lawful under §20.3 alone and is what **R-083**
(*say the kit cannot train it, do not quietly shrink*) rules against; it is
SEAT_INBOX item 48, `OWNED BY terminal`, and is **not pinned green anywhere.**

**R-053** · MOBILITY COMPOSED FROM THE POOL (§20.4), signed. **The ten
`MOBILITY_FLOW_TEMPLATES` bundles are NOT recognised** — no ruling cited, no
changeset, no divergence report. · `BUILT` — `test:mobility-accessory-doors`,
green (21 cells, his 2-3 pairs survive the validator).

**R-054** · THE SEVEN STRENGTH SESSIONS (§20.5), signed. The athlete's own door
could previously reach only four of the seven. · `BUILT` 2026-08-13, seat `arms`
— `test:strength-variants` `[D3]` *"THE ATHLETE'S OWN DOOR HANDS BACK ALL SEVEN
— driven, not read"*, 16/0. **The row was right until now and the ten cells above
it were not enough:** `D1`/`D2` ask `strengthVariantsForDoor`, which is the
authored set answering a question about itself, so reverting
`CATEGORY_TEMPLATE_MATCH.strength_lower` (`planChangeProducer.ts:185`) to the
original hand-written `t.templateId === 'strength_lower'` — the Lower Body door
reaching one of three — left **D1, D2, E2, `test:athlete-door-matrix` (433/0),
`test:session-type-charter` (41/0) and every other suite GREEN.** D3 drives
`pickTemplateForCategory`, the function the athlete's tap lands on, over 90
date-seeded days, and reds on that mutation naming the door and both missing
variants. **A partition asserted only in the file that declares it is a document,
not a gate.**

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
reason. ·
`BUILT` — `test:rules-kernel` [C4] + `test:preseason-exposure`, 2026-08-13, seat
`readiness` (item 53). **⚠ THE ROW WAS WRONG, NOT THE APP — and it was wrong in
the specific way it warned about: the floor IS asserted, in a suite nobody had
named, and the two halves live in two different suites.**
- *one per week, year-round* — `rulesKernelTests.ts:884`, a zero-sprint week
  raises `cap_sprintCodExposures_under`.
- *except early off-season* — `:886` suppresses it for that subphase, and `:892`
  is the discriminator that keeps the two exemption vocabularies apart:
  **bye recovery lifts the RUNNING floor and NOT the sprint floor.** Without that
  cell the exemption could be widened to any light week and stay green.
- *a reduction requires an explicit typed reason* —
  `INV_EXPOSURE_REDUCTION_HAS_REASON` in `test:preseason-exposure`, with a
  matching entry in the mutation catalogue
  (`exposure_reduction_loses_typed_reason`), plus *"no-anchor deload preserves
  the sprint/COD exposure floor"*.
**MUTATION-PROVEN:** neutering the sprint-floor emitter reds 2 cells. Restored
from backup, `git diff` clean.
**⚠ `test:preseason-exposure` is 105/5 and has been since before this unit** —
verified against a control worktree at `ef38f5e8`, byte-identical failure names.
The five are Thursday-recovery placement and a low-readiness contract
adjustment; **none touch the typed-reason invariant, which passes.**

**R-063** · *"counts are STRUCTURE, and the deload law holds structure constant
while the work inside shrinks"* · A deload does NOT cut session COUNTS; it cuts
the work inside them. · `BUILT` — `test:deload-law`, green.

**R-064** · *"`readiness === 'low'` is the CAPACITY score, a different signal
this law does not govern"* · The readiness HOMONYM, restated as a boundary: the
capacity score is not the declaration. ·
`BUILT` — same gate as R-041, `test:readiness-structure-law` block [8],
2026-08-13. **AND THE QUOTED CODE NO LONGER COMPILES:** `readiness === 'low'` is
now `capacity === 'low'`, so the row's own example is the shape the gate
refuses. The boundary is a compile error and a red cell, not a sentence.

**R-070** · **"One main per pattern; Deadlift + RDL is illegal."**
(`LFA_PROGRAMMING_BIBLE.md:226`) · Two heavy lifts of the SAME pattern may not
share a session. · `BUILT 70e91a0f` — the oracle is
`src/rules/mainLiftPatternLaw.ts`, the production fence is in
`src/utils/exerciseScorer.ts:429`, and the guard is `npm run
test:main-lift-pattern` (23 cells), in the `test:bible` chain beside
`test:slot-coverage`. **36 breaches of 396 built sessions before the fence, 0
after** — every one of them `Bench Press + Close Grip Bench` out of
`selectExercises`, two heavy HORIZONTAL PRESSES, not the hinge this row
predicted. The law borrows both of its answers — `classifyExerciseRole` for
*"is this heavy"* and `slotsFilledByRow` for *"which pattern"* — so the composer
cannot obey a rule the gate measures differently.
**⚠ TWO OF THIS ROW'S OWN THREE EXAMPLES WERE REFUTED BY THE BUILD, and are
struck here rather than deleted so nobody re-derives them.** RDLs + Hip Thrusts
is one heavy hinge and one ACCESSORY hinge — `Hip Thrust` is `accessory` in the
app's own pools, and one of each is not what `:226` forbids. Overhead Press +
Incline DB Bench is `vertical_push` main + `horizontal_push` accessory; reading
both as *"push"* is the coarse vocabulary that would make Sam's own upper ladder
illegal. **THE THIRD STANDS:** `src/utils/exerciseScorer.ts:458` does permit two
of a movement and bar only three — it counts every pick, accessories included,
so it is a VOLUME cap and not this law. It is now labelled at the line and left
doing its own weaker job.
**⚠ WHAT IS STILL NOT FENCED: the coach's own edit doors.** The law is held at
generation and at the gate; a coach command that inserts a second heavy lift
into an existing session by another route is not refused today.
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
