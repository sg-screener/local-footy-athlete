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
number 3 is abolished. · `UNENFORCED` — nothing enforces a cap anywhere;
**SEVEN** 3-row fallback branches still ship (was eleven; `da733e30` paid four,
re-measured on clean HEAD 2026-08-13 by `arms`). SEAT_INBOX item 25.
**⚠ TWO OF THIS ROW'S THREE CLAUSES WERE WRONG ABOUT WHICH PART IS MISSING —
CORRECTED 2026-08-13, seat `arms`, code opened first.**
- **THE RULING ITSELF IS ENFORCED AND MUTATION-PROVEN.** `test:rules-kernel`
  carries a cell named *"ONE exercise cap for every training age"* asserting
  `beginner.maxExercisesPerStrengthSession === normal.…`, plus three siblings
  killing the other beginner-only caps; 122/0. **Mutant: put
  `maxExercisesPerStrengthSession: 3` back on `NEW_ATHLETE_POLICY` → that cell
  and two others RED.** The abolition is held; it is the CAP'S ENFORCEMENT that
  is missing, which is a different sentence.
- **"ZERO readers" IS REFUTED.** `coachingEngine.ts:8846` reads it into
  `AIConstraints.maxExercisesPerSession` (`:618`). **The dead end is ONE HOP
  LATER** — that field has zero consumers — and the code already says so in its
  own words at `sessionRowCounting.ts:309`: *"read by no prompt builder,
  validator or trim."* `patterns` reached the same refutation independently.
- **THE COUNT IS NOW `SEVEN` ON COMMITTED HEAD — RE-MEASURED 2026-08-13 AFTER
  THE COMPOSER LANDED (`da733e30`), seat `arms`.** Brace-matched over
  `fallbackExercisesForPlanEntry`, and the file is CLEAN (working tree ==
  HEAD, so both worlds agree for the first time):
  **`3x1, 1x2, 7x3, 1x4, 8x5`.** **The head line above still says "eleven" and
  is now stale in the OPPOSITE direction** — it overstates what is left.
  **HISTORY, KEPT BECAUSE IT IS THE LESSON:** an hour earlier this read
  **HEAD `11x3` · working tree `7x3`**, and **TWO SEATS PUBLISHED "SEVEN" INSIDE
  ONE HOUR AND BOTH WERE WRONG** — a count taken off another seat's uncommitted
  tree and reported as a fact about the repo. Eleven was right then; seven is
  right now; **neither statement means anything without its world.** The same
  sentence was false, then true, in sixty minutes.

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
has no mode of its own yet (R-002 makes it an off-season inside pre-season).
**⚠ AND HALF OF THE STATED BLOCKER IS GONE — CORRECTED 2026-08-13, seat `arms`.**
This sentence read *"and R-004's dated span is still `UNENFORCED`, so there is
nowhere to hang the number"*, and **SEAT_INBOX item 54 blocks its Christmas half
on exactly that clause** (*"Blocked on R-004, which item 55 puts on another
seat"*). **R-004 is `BUILT` and the dated span SHIPS** — measured through the
generator, not read: `noTeamTrainingSpansFromConstraints` → `clubClosedSpans`
(`coachingEngine.ts:8943`) → `teamDays`, held by `test:christmas-break`
`[11]`/`[11b]`/`[11c]` at 44/0 and **mutation-proven** (unhooking the span reds 7
cells; the non-vacuity control stays green). **So item 54 is NOT waiting on a
seat, and nobody should wait for one.**
**THE REAL WALL IS THE OTHER HALF OF THAT SENTENCE AND IT STANDS UNTOUCHED:** a
dated span is not a WEEK IDENTITY. `Section18WeekMode` has eleven members
(`weeklyExposureContractV2.ts:27`) and none of them is a Christmas break, so
there is still nowhere to hang 1/week. **Growing that union is the `cod_decel`
hazard for the third time** — ship the `satisfies Record<…>` in the same commit
as the member or generation breaks. **Owner unchanged: item 54's, `pace`.**
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

**R-016** · **Reps are prescribed as a range, shown as one APPROVED REP TARGET**
(Bible `:770`, `:4936`) · The only visible rep targets are **3, 4, 5, 6, 8,
10, 15 and 20**; timed prescriptions are unchanged. The nearest target to the
range midpoint is used and an equal-distance tie goes lower, so `3x8-12` is
written as `3x10` and `3x15-20` as `3x15`. Assume-prescribed logging uses the
same target the athlete saw. · `BUILT` — one shared owner serves the screen,
projection and workload fallback.

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
`BUILT` — `npm run test:existing-week-proof`
(`src/__tests__/existingWeekProofTests.ts`, 10 cells), in the `test:bible`
chain. Seat `patterns`, 2026-08-13, at Sam's direct order.
**⚠ THE GATE IS RED ON ARRIVAL AND THAT IS THE FINDING, NOT A DEFECT IN IT.**
It is a TWO-ROUTE AGREEMENT: route A generates the week with the fact live —
what every existing suite proves — and route B generates the week with NO fact,
accepts it, then lands the fact on that already-accepted week through
`rebaseAcceptedEffectiveWeek`, *"sole precedence owner for a currently accepted
athlete-visible week"*. **The routes must agree; they do not.**
**MEASURED: a pre-existing away week LOSES ITS FIXTURE AND KEEPS ITS CLUB
NIGHTS** — `["Team Training + Upper Pull", "Team Training + Upper Push"]` survive
a live travel fact. That is item 30's glass evidence (*"Tuesday the 22nd and
Thursday the 24th still read Strength + Team Training"*) **reproduced in a test
for the first time**, and it is why two days of away work read as done.
**THE FIX SITE IS NAMED BY MUTATION, not by reading:** blinding
`derivedWeekContract.ts:85`'s travel filter reds the half that PASSES, so that
filter is what takes the fixture off a pre-existing week and **there is no
equivalent for team days.** Fix belongs to whoever holds `coachingEngine.ts`
(item 30 records it HELD).
**TWO FIXTURE MISTAKES WERE MADE AND BOTH ARE RECORDED IN THE SUITE**, because
each would have manufactured a defect: the legacy `ActiveConstraint` spelling
fed to a read door that filters on `factKind`, and a compatibility PROJECTION
substituted for the constraint generation is proven to accept. **The control
cell caught both** — route A must pass before route B's failure means anything.
**AND THE TWO DOORS GENUINELY SPEAK TWO SPELLINGS** of one athlete answer:
generation reads `type`/`startDate`/`expiresAt`, the read door reads
`factKind`/`effectiveFrom`/`effectiveUntil`. That divergence is its own finding.

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
by SIDE EFFECT. · `BUILT` — `npm run test:main-lift-pattern`'s sibling
`npm run test:fatigue-abolition` (`src/__tests__/fatigueAbolitionLawTests.ts`,
8 cells), in the `test:bible` chain. Seat `patterns`, 2026-08-13, inbox item 57.
**IT IS A DIFFERENCE TEST, NOT A SOURCE SCAN, AND THAT IS THE LOAD-BEARING
CHOICE.** The abolition survives as DELIBERATE NO-OPS — `void
input.readinessDeloaded;` at two sites in `weeklyExposureContractBuilders`, each
with a comment saying what was removed. **A comment is not a gate**: reinstating
a reduction there means deleting a `void` and writing ordinary-looking code. So
the assertion is the observable consequence instead — **the weekly exposure
contract must be byte-identical with the deload flag on and off**, across 30
worlds (3 phases x 3 sub-phases x 3 capacity bands, plus bye build/recovery and
club/no-club). That does not decay when the three sites are refactored.
**THE CONTROL IS HALF THE GUARD.** A difference test that passes because the
instrument is inert is the emptiest green there is, so a cell proves the SAME
comparison does move for an active severe injury — which also pins the other
half of Sam's sentence, *"injury is untouched — a medical restriction may still
block and pause"*. The two signals are asserted ASYMMETRIC in one cell, so it
reds in both directions.
**THREE MUTANTS KILLED:** reinstating the count reduction reds 2 cells;
reinstating an exposure removal reds 3; blinding the injury control reds 3.
**WHAT IT DOES NOT HOLD — MECHANISM THREE.** Bible `:4962` names three sites;
the first two are exposure-contract shapes and this holds them. The third — *"a
session-action rule converting a session to recovery once 75% of its rows were
stripped"* — lives BELOW this builder and a contract comparison cannot see it.
It needs the action walker, is named in the suite's own NOT-COVERED line and in
`docs/STATUS_PATTERNS.md`, and is **not** claimed here.
**✅ MECHANISM THREE NOW HAS ITS OWN ARM — `test:fatigue-session-collapse`
(`fatigueSessionCollapseLawTests.ts`, 14 cells), seat `readiness`, 2026-08-13,
same inbox item 57. It does not re-assert the sibling's contract comparison.**
**THE MECHANISM IS GONE AS CLAIMED, AND WHAT KEEPS IT GONE IS AN ACCIDENT.** The
75% conversion still exists for INJURY (`injuryAdjustmentEngine.ts:327`) and that
file contains **zero** occurrences of `fatigue` — but measurement found the door
ajar: `extractInjuryContext('im absolutely cooked 9/10')` returns
**`{bodyPart:'unknown', bucket:null, severity:9}`**. **A pure fatigue sentence —
the verbatim name of R-038's most severe READINESS tier — enters the INJURY door
at the pause band, on a live path** (`CoachScreen.tsx:1294`), because "cooked" is
a negative descriptor and body part is deliberately optional.
**IT STRIPS NOTHING FOR ONE REASON ONLY: with `bucket:null` every strength row
rates `good`**, so `removeNames` is empty and the >=50% swap is unreachable.
**Nothing anywhere stated that.** Making the region-agnostic fallback more
careful — *"no body part? be cautious with everything"* — reinstates mechanism
three for fatigue instantly. **The suite pins the INERTNESS, not the leak**, and
records the leak as its own cell so closing it reds rather than silently
invalidating the guard above it.
**FOUR CELLS ARE STRUCTURAL:** `TierDirective`'s key set is pinned EXACTLY, so a
`removesExposures` field reds the day it is added; and **severity 6 and 7 must
give the identical directive** — the abolished trigger was `7+`, and
`injurySeverityBands` records that *"7 was never a band edge"*.
**THREE MUTANTS KILLED, 2 cells each:** a removal field on the directive; the
`7+` escalation reinstated; **the null-bucket fallback opened** — which reds the
load-bearing cell AND the asymmetry control. Restored from backup, `git diff`
clean. **STILL NOT COVERED:** driving a real week through the session-action
layer, which needs the action walker. **The gap is now narrow rather than
open** — the only route from a fatigue sentence to a stripped row is that
fallback, and it is watched.

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

**AND THE CALL SITES ARE CUT — ALL THREE WRITERS, 2026-08-13, seat `readiness`.**
`applyPatternBiases`, `applyReadinessBias` and `biasConditioningReadiness` each
stepped the CAPACITY band down from session feedback. The vote they were really
casting now travels as `recentFatiguePattern`, a peer of the fatigue signals the
soft-deload counters already carried. Held by
`test:progression-capacity-laundering`, 25 cells, 4 mutants killed; **one mutant
survives and is named in the suite** (severing the resolver->input wire, which
nothing catches because no suite generates a week from an athlete with real
feedback history — L13 walker territory).

**⚠ THE AUTHORITY FOR THAT CUT IS SAM'S OWN 2026-07-27 RULING, NOT A NEW
DECISION, AND I NEARLY ASKED HIM FOR ONE.** I carried *"should a rough fortnight
lower his capacity band?"* to him in **three separate reports** before grepping.
It is answered twice, verbatim, in the text this very row is about:
> *"a CAPACITY score computed from onboarding answers … **which reads no facts
> at all and changes only when the profile changes**"* (Bible `:4964`)
> *"**It changes only when the profile changes**, and it means 'this athlete's
> baseline is low', not 'I am cooked today'"* (Bible `:3717`)

**Session feedback IS a fact, and a fatigue streak is not a profile change.** The
build follows the ruling; the question is WITHDRAWN as already settled.
**This is the failure the ask gate exists to stop, committed by the seat that
had just quoted the rule against it twice in the same session** — R-046 and
R-062 were corrected precisely because their rows were trusted instead of
measured, and then the same trust was extended to my own memory.

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
pump delts at 2-3 sets.** The current signed pools are **8 biceps + 7 triceps +
8 shoulders (23 candidates)**, with the Section 20.3 do-not-pair list applied
inside each two-exercise family. Supersedes the app's 2+2+1+1 shape whose fourth
slot reached outside the earlier sixteen signed candidates. Gunshow is normal
gym work with a complete authored six-movement shape. ·
`BUILT` — `sessionBuilder.ts` `arms_pump` is literally
`[{biceps, 2}, {triceps, 2}, {delts, 2}]`, and **TWO suites name the composition
and assert it**: `optionalTopUpTests.ts:499` (*"R1. the G-1 Gunshow is Sam's
SIGNED 2 biceps + 2 triceps + 2 pump delts"*, 27/0) and
`mobilityAccessoryDoorTests.ts:149` (*"A1. a Gunshow is 2 biceps + 2 triceps + 2
shoulder"*, asserting `counts.biceps === 2 && counts.triceps === 2 &&
counts.delts === 2`, 28/0).
**⚠ THIS ROW READ `UNENFORCED — no suite named for the composition` WHILE TWO
SUITES NAMED IT.** Corrected 2026-08-13 by the desktop after opening the
enforcers and finding them PRESENT and GREEN — gate rule 2 run backwards. **The
row was not describing the code; it was describing a search nobody had redone.**
**2026-08-21 UPDATE:** Sam replaced the three candidate pools and added eight
forbidden pairings. `test:mobility-accessory-doors` now pins the exact 8/7/8
lists and drives 730 deterministic dates, requiring every candidate to appear
and every forbidden pair to remain absent.

**2026-08-21 EQUIPMENT-SCOPE CORRECTION:** reduced-equipment Gunshows were an
invalid composition test world. Dumbbell-only and band-only are away equipment
states, not the normal gym context in which Gunshow is prescribed. The old
thin-kit A5 cell and shrink-never-pad wording are retired. A3 now guards that
every signed normal-gym family is deep enough to fill its two slots. A4 still
guards the authored 2-3 sets on both the pools and the built session.

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

## G-2 OUTRANKS THE INJURY EXCEPTION — Sam, 2026-08-16

**R-095** · *"G-2 outranks the injury exception. High Box Squat and Vertical Jump
are both prohibited on G-2. Omit and disclose; upper-body work remains legal."* ·
**A CONFLICT BETWEEN TWO OF SAM'S OWN RULINGS, RESOLVED IN FAVOUR OF G-2.**

The authored injury exception placed a "quality-lower neural primer" — High Box
Squat 2x3 + Vertical Jump 2x3 — on the G-2 day when a severe upper injury paused
upper work. Sam's G-2 ruling of 2026-08-15 prohibits added LOWER-BODY sprint,
jumping, plyometric and power work, and **a Vertical Jump is plyometric.** The two
rulings could not both hold; the later and safety-side one wins.

- **Both movements are prohibited on G-2.** No dose reduction rescues either.
- **The work is OMITTED and DISCLOSED**, never moved to another day and never
  substituted with different lower work.
- **Upper-body strength remains legal on G-2**, which is the standing G-2 position.

`ENFORCED` in the scheduler already: `WC-051` in `rules/weeklyLegality.ts` refuses
any lower purpose on G-2 as a typed legality rule, so the exception cannot be
scheduled. **The guard proving the OMIT-AND-DISCLOSE half did not land in this
mission** — `injuryAuthorityOwnershipTests` G2-G4 still assert the old exception and
are reported as a genuine defect family, not rebased under time pressure.

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

**R-082** · *"the equipment for conditioning is very simple whatever modality it
chooses - thats the equipment needed and there's only 5 - running = bodyweight,
ski = skiErg, bike = bikeErg, row = Rower and air bike = air bike"*
(2026-08-13) · **CONDITIONING EQUIPMENT IS DERIVED FROM THE MODALITY, NOT A
PER-SESSION TABLE.** running → nothing · ski → SkiErg · bike → BikeErg · row →
Rower · air bike → Air Bike. **44 rows collapse to 5. Do not author a
session-by-session list** — the modality is already on the template.
**Search words:** conditioning equipment, erg, treadmill, modality, machine,
which machine, rower, no erg. ·
`BUILT` — **THE ROW WAS WRONG, NOT THE APP, AND IT WAS WRONG IN BOTH HALVES.**
The derivation is `conditioningEquipmentForModality`
(`src/utils/sessionEquipment.ts:87`), reading `CONDITIONING_META[name].modality`,
and it is exactly his five rows. **There is no 44-row table to collapse — the
collapse had already happened**, and 0 of the 90 conditioning templates carries a
hand-written equipment list. Two seats opened it independently before building
(`docs/STATUS_TERMINAL.md`, `docs/STATUS_AUDIT.md`) and neither rebuilt it, which
is registry rule 2 working.
**⚠ BUT NOTHING IN THE CHAIN WAS WATCHING THE MODALITY BRANCH.** The only
in-chain cells fed an AUTHORED `equipmentRequired: ['Rower']` — **the
per-session-table branch this ruling exists to forbid** — so the whole modality
derivation could have been deleted and `test:session-execution-checklist` stayed
green. Guarded now by 8 cells in that suite (79/0, in `test:bible`) which pass a
BARE template name so the answer can only come from the modality:
row -> `modality:row`, ski -> `ski`, bike -> `bike_erg`, air bike -> `air_bike`,
**running -> NOTHING**, plus a cell asserting no template authors a list at all.
**Mutation-proven both ways:** deleting the ski row reds 1 cell; making row
return `bike_erg` reds 4, three of them pre-existing.
**⚠ TWO ANSWERS EXIST BEYOND HIS FIVE, DECLARED AND PINNED so the count cannot
grow quietly.** `mixed` (40 templates) derives nothing — defensible, a circuit is
mostly bodyweight, but it is a sixth answer he did not rule. `swim` (1 template)
derives nothing, and **a swim session needs a POOL**. One template, so it is
named rather than chased. `treadmill` is inferred from the NAME, not the
modality, and is a seventh path — worth his eye, not a defect.

**R-083** · *"ya can't do much with overhead pushing or pull or even horizontal
pulling without equipment - i can't account for everyone and if they want to
train properly they'll sign up to a gym"* (2026-08-13) · **A BODYWEIGHT-ONLY
ATHLETE SIMPLY DOES NOT GET SOME PATTERNS.** Vertical push, vertical pull and
horizontal pull are **REMOVED, not substituted**, when the kit cannot do them.
Do not author a bodyweight vertical push or pull; do not fill the slot with
something else. **The app must SAY the kit is the cause** rather than shrink
silently — this is the one case where a short session is not a defect.
**Search words:** bodyweight, no equipment, no kit, pull-up, dip, inverted row,
vertical push, vertical pull, horizontal pull, missing pattern, short day, gym
membership, sign up to a gym. ·
`UNENFORCED` (was `BUILT cf77855f`; corrected 2026-08-14 — see the receipt at
the foot of this row. By gate rule 4 a ruling enforced on ONE route of several
is UNENFORCED, and the pool is one route of at least three.)
**THE BLOCKER NAMED IN THIS ROW IS CLEARED.** *"one site
delivered, the second blocked on the load/availability conflation"* was true when
written; `cf77855f` separated the two questions. `equipmentClassFor` answers
*"what does this lift LOAD with"* and was being asked *"can this athlete DO it
with no kit"* — **wrong in BOTH directions**: a `Pull-Up` carries no load and
needs a bar, a `Reverse Lunge` is load-classed dumbbell and needs nothing. That
conflation is exactly why a bodyweight athlete was prescribed Pull-Ups, Dips and
Inverted Rows. `EXERCISE_EQUIPMENT_REQUIREMENT`
(`src/data/exerciseEquipmentRequirement.ts`) is now the separate availability
field, read by `exerciseAllowedByEquipment`.
**REMOVED, NOT SUBSTITUTED, is held at the oracle too:** `slotIsTrainableOnKit`
(`src/rules/sessionSlotCoverage.ts`) drops a slot no legal exercise can fill, and
it is DERIVED — it does not know the words "vertical pull", it asks the tagged
library, so the day a bodyweight lift is authored the exemption disappears by
itself.
**GUARDED:** `test:edge-generation-equipment` (38/0, in `test:bible`) carries a
per-row table under the heading *"LOAD IS NOT AVAILABILITY — R-083's second
site"*, asserting each named lift's bodyweight verdict AND the reason, with
`Push-ups` as the control that must stay legal.
**⚠ THE SECOND CLAUSE IS NOT DELIVERED AND THE ROW MUST NOT PRETEND IT IS.**
*"The app must SAY the kit is the cause"* — `SlotCoverage.unavailable` names the
dropped slots and **has NO reader outside the rule module.** Nothing athlete-
facing says *"you'd need a gym for this"*; the day just comes out shorter. **The
removal is BUILT and the SAYING is not**, and by "done means the athlete can see
it" that half is still owed. It is the one piece of this row left.
**⚠ RECEIPT, 2026-08-14 (mission slice 1A) — ONE ROUTE COVERED, AT LEAST THREE
STILL OPEN, SO THE ROW STAYS `UNENFORCED`.**
**COVERED — the pool walk.** `selectPoolEntryAvoiding`
(`src/data/exercisePoolsStrength.ts:1049`) no longer falls through to the raw
pool when the athlete's KIT is what emptied it; it returns a typed refusal
(`PoolSelection`, `:964`) which `applyPoolRotation` (`:1120`) propagates and
`src/data/defaultProgram.ts:2569` turns into a removed row. Held by
`exercisePoolsStrengthTests` cell 14.15 (504/0), which asserts the refusal AND
that `[pool-override-fallback]` does not fire — the old fallback is the mutant
it kills. Exclusion and injury still fall through, unchanged and out of scope.
Measured: `[pool-override-fallback]` 16 → **0**, and scenario 6's
`impossible_without_kit` findings 7 → **5**.
**STILL OPEN — and each one was measured putting an impossible lift back.**
(1) **CANONICALISER RESTORATION**, `src/utils/workoutCanonicalisation.ts:885`,
sourcing `FALLBACK_PATTERN_EXERCISE` (`:172`, `push: 'Overhead Press'`,
`pull: 'Pull-Ups'`) and building rows with a hardcoded `equipmentRequired: []`.
It asks the sheet nothing and runs LAST: `row_restored` went 4 → 12 across six
weeks, the eight new ones being exactly the `Pull-Ups` and `Overhead Press` the
pool had just refused. (2) **TEMPLATE COMPLETION** — `RDLs` reaches the athlete
unrewritten though the pool answers `Single-Leg RDL`, so that row never passed
through rotation at all; `Face Pull` likewise survives a refused
`isolation_upper`. (3) **NON-POOL ROWS** — `Band Pallof Press` classifies to no
pool, so no pool-layer change can ever reach it; only the sheet can.
**AND THE SECOND CLAUSE IS STILL NOT DELIVERED** (the paragraph above): after
this change the bodyweight Tuesday shows an Upper Pull of two rows the athlete
cannot do, and says nothing about the kit.
**⚠ RECEIPT 2, 2026-08-14 (mission slice 1B) — THE ROW STAYS `UNENFORCED`, AND
THE REASON IS NOW A LAW COLLISION RATHER THAN MISSING WORK.**
**COVERED — the judging side.** `test:ladder-wide` judges each laddered day
against the KIT-ACHIEVABLE ladder: `sessionSlotCoverage` has taken
`availableEquipment` and computed `unavailable` since R-084, and the wide census
simply never passed it. It does now
(`src/__tests__/ladderCoverageWideCensusTests.ts`), which takes the deficient
count 178 → **126 of 318** with the ceiling untouched at 88, and puts the
difference in a printed **R-083 KIT-BLOCKED CENSUS** of 86 days
(`vertical_pull` 52, `vertical_push` 42, `horizontal_pull` 26) rather than
letting it vanish. Two new cells hold it: the category reds if the oracle ever
stops being told the kit, and reds if a FULL-GYM athlete is ever kit-blocked —
the only way this exemption could hide a real composer gap.
**STILL OPEN — AND ONE OF THEM CANNOT BE CLOSED WITHOUT SAM.**
(1) **THE RESTORE ROUTE IS BLOCKED BY §18, NOT BY MISSING CODE.** The guard was
built and measured: it removes `Pull-Ups`, `Overhead Press` and
`Romanian Deadlift` and takes `row_restored` 12 → 0. **`print:week` scenario 6
then fails to generate at all** —
`Section18WeekAcceptanceError: pattern_restore_failure:strength_patterns:0` ×3
plus `required_minimum_shortfall:main_strength:1`. Attributed by disabling that
guard alone and re-running. `section18EffectiveWeekEvaluator.ts:1440` raises the
finding for every `requiredSafePattern` with no meaningful main lift, and a
kit-untrainable pattern is still required there. **R-083 and §18 are in direct
contradiction for a bodyweight athlete, and §18 wins by refusing the week** —
the athlete gets nothing, which is worse than a row they can see and skip.
Teaching §18 the kit (the shape its injury `prohibitedPatterns` already has) is
a change to safety acceptance behaviour and **needs Sam's ruling.** Not shipped.
`SEAT_INBOX` item 48 records two earlier commits reverted for this same code.
(2) **A THIRD ROUTE ADDS ROWS AFTER CANONICALISATION** — `Band Pallof Press`
reaches a bodyweight athlete having passed neither the pool nor the canonicaliser
triage. Unlocated.
(3) **THE SAYING IS BUILT BUT UNSHIPPED** — `Workout.equipmentRemovals` +
`part.detail.kit_cannot_train` + `projectVisibleWeek.partDetail` exist and are
preserved, but they hang off the removal in (1) and could not be seen on glass
while scenario 6 refuses to generate.
**⚠ RECEIPT 3, 2026-08-14 (slice 1B-completion) — ALL FOUR ROUTES ARE CLOSED IN
A MEASURED TREE THAT IS NOT SHIPPED, SO THE ROW STAYS `UNENFORCED`.** See the
R-090 row below, which unblocked the §18 half, and `docs/MISSION_THREE_FIXES.md`.
**THE THIRD ROUTE WAS NEVER A ROUTE — IT WAS A NAME.** `Band Pallof Press`
reached bodyweight athletes because the row is built as **`Pallof Press`** while
Sam's sheet is keyed **`Band Pallof Press`**: `equipmentRequiredFor` found no row
under the raw spelling, returned null, and the question fell through to the load
classifier, which said yes. Two slices reported it as an unlocated pipeline.
Fixed in the ONE oracle (`exerciseAllowedByEquipment` resolves the spelling
first), not at the three callers. **`canonicalExerciseName` cannot be used there
— it imports the selectable vocabulary, which reads `STRENGTH_POOLS` at
module-init, and the cycle kills `print:week` before a week is built.**
**THE SAYING IS DELIVERED IN THAT TREE AND SURVIVES A REOPEN**, which was the
open question: the record is CARRIED FORWARD, not recomputed, because §18's
gateway re-canonicalises without the kit and a recomputation wrote `undefined`
over the reason the day is short.
**STILL THE ONE THING BETWEEN THIS ROW AND `BUILT`:** 20 kit-limited worlds are
newly refused (R-090's receipt). Nothing else is outstanding.

**R-084** · *"single leg hip thrust is an accessory"* (2026-08-13) · **A
SINGLE-LEG HIP THRUST IS AN ACCESSORY, NOT SINGLE-LEG HIP WORK.** Its existing
`isolation_lower` tag is CORRECT — **do not re-file it as `hinge`.** **The
single-leg hip pool is ONE exercise, the Single-Leg RDL, and Sam is not adding
more.** Consequences: the slot checker must not report a one-exercise pool as a
coverage defect, and the variety-rotator must not treat "the same exercise every
leg day" as a fault — it is meant to repeat. **A bodyweight athlete therefore
cannot fill the single-leg hip slot, and by R-083 that is the kit's answer, not
a defect to solve.**
**Search words:** single leg hip thrust, hip thrust, single-leg hip, accessory,
isolation, one exercise pool, re-tag, refile, empty slot, bodyweight leg day.
· `BUILT` — the tag already carries `isolation_lower`; nothing to change.

**⚠ CORRECTION RECEIPT, 2026-08-14 (slice B1 CP1) — ONE CLAUSE OF THIS ROW IS
SUPERSEDED. THE ROW'S OWN WORDS ARE UNCHANGED AND STAY AS WRITTEN.**
The clause *"A bodyweight athlete therefore cannot fill the single-leg hip
slot"* is **no longer the app's answer.** `R-086`, ruled the SAME DAY, put
`Single-Leg RDL` into `BODYWEIGHT_CAPABLE`, which makes it legal on a bodyweight
kit; the two rows have contradicted each other since 2026-08-13 and the code has
always implemented R-086. `docs/POOL_CENSUS_2026-08-14.md` measured the
contradiction and reported it as NOT ESTABLISHED rather than choosing.
**SAM RULED IT, 2026-08-14, via the B1 seat question:** for a temporary
bodyweight/away athlete an **unloaded `Single-Leg RDL` COUNTS as a valid
single-leg-hip exercise**, and weighted versions remain preferable when the kit
allows. **R-086 stands.** The preference is expressed by the authored pool ORDER
the composer selects in — a weighted option is simply earlier in the list where
it is legal — never by widening `BODYWEIGHT_CAPABLE`, which R-086 closed at two.
**Everything else in this row is untouched:** the single-leg hip pool is still
ONE exercise, it is still meant to repeat, and a one-exercise pool is still not a
coverage defect.
**GUARDED:** `test:composer-b1` — two cells, *"an unloaded Single-Leg RDL is a
legal single-leg-hip row"* and *"the away lower day actually carries it"*.

---

**R-085** · *"yes, skip standing, owned and closed"* (2026-08-13, answering
`audit`'s AWAITING SAM entry) · **THE STOP SCAN SKIPS THREE MORE STATES THE
QUEUE WAS ALREADY WRITING.** It knew only BLOCKED and WORKABLE, so a
`STANDING, EVERY STOP` order, an item `OWNED BY` another seat, and a finished
`✅ CLOSED` item all read as live work — and `EXIT 1` was unreachable by
construction while any of them existed. **Measured before asking: the scan
handed one seat 10 live orders and NOT ONE was its own** (5 owned, 3 closed, 2
standing).
**⚠ THE OWNED CASE IS THE ONE THAT MATTERED, AND IT WAS THE RULE FIGHTING
ITSELF.** `CLAUDE.md` says *"OWNED IS NOT BLOCKED … you walk past it. You do
NOT mark it blocked"* — so the only way past an owned item was to write the
false marker that rule exists to forbid. **The scan was asking for the lie.**
**Each skip is deliberately narrow, so it cannot be typed over a queue to buy
silence:** `OWNED BY` must name its owner in backticks, the completion mark
must OPEN the head line, and the standing phrase is item 13's own wording.
**Search words:** stop hook, seat inbox hook, standing order, owned by, closed,
skip, exit 1, queue empty, nagging, keeps asking, duplicate work, walk past.
· `BUILT 2026-08-13 by seat `arms`` — all three skips live in
`scripts/seat-inbox-hook.sh`; verified by reproducing the scan against the live
queue, which now finds nothing. **`audit` raised it and did NOT build it: an
agent editing the script that governs it needs the person paying for it to say
yes, and this row is that yes.**

---

**R-086** · *"leave it at two"* (2026-08-13, answering `audit` on whether
Deadlift and Goblet Squat should join) · **THE `BODYWEIGHT_CAPABLE` SET IS
CLOSED AT TWO: `Walking Lunges` AND `Single-Leg RDL`.** These are the movements
whose authored kit only LOADS them and which survive losing that load, so a
bodyweight athlete may still be prescribed them. **EVERY OTHER EXERCISE FOLLOWS
THE AUTHORED SHEET VERBATIM** — if its kit is missing, it is refused.
**⚠ THIS IS A CLOSURE, NOT A BACKLOG. Do not add a third by inference, and do
not "complete" the list.** The obvious generalisation — *a missing LOADING
implement (barbell/dumbbell/kettlebell) is survivable, a missing APPARATUS is
not* — reproduces both of these rows and then silently legalises `Deadlift`,
`Goblet Squat` and `Banded Bicep Curl` on a bodyweight kit. **A band curl
without the band is not a curl; a goblet squat is DEFINED by the thing you
hold.** A tag cannot say whether a movement survives losing its load — only Sam
can, and he has said it twice and stopped.
**A THIRD ENTRY REQUIRES A NEW SAM RULING AND A NEW ROW HERE.**
**Search words:** bodyweight capable, unloaded, without weights, deadlift,
goblet squat, banded, walking lunges, single leg rdl, availability, load is not
availability, loading implement, apparatus, third entry, add to the list.
· `BUILT 2026-08-13` — `BODYWEIGHT_CAPABLE` in
`src/data/exerciseEquipmentRequirement.ts` holds exactly these two, and
`test:edge-generation-equipment` carries a SIGNED-CONTENT PIN (equality, not a
subset) so a third entry reds on arrival rather than shipping quietly.

**⚠ WHY THESE THREE ARRIVED LATE, AND IT IS A DEFECT IN THIS FILE'S PROCESS.**
All three were ruled by Sam on 2026-08-13 and written into `SEAT_INBOX.md`
items 47 and 48 with instructions to register them. **Nobody did, and the seat
never checked.** On 2026-08-13 an agent then re-asked R-084 verbatim — it could
not find a ruling that was not here. **The ask gate greps THIS file: a ruling
that is not in it is, mechanically, a ruling that does not exist.**
**Each row above now carries a `Search words:` line** — the second half of the
same lesson, learnt when R-079 was re-asked because it did not contain the words
"team night" or "no club".

---

**R-087** · *"depends what's in the rest of the week / each week should contain
all the main lifts i.e. squat, hinge, single leg knee, single leg hip, push pull
in both horizontal and vertical then accessories for uppers and lowers and some
core"* (2026-08-13, answering `readiness`'s awaiting-sam entry on which slots
drop from a 7-exercise full body day) · **THE WEEK IS THE UNIT OF COVERAGE, NOT
THE DAY. A FULL BODY DAY HAS NO FIXED TEMPLATE.**

**THE COMPLETE WEEKLY SET, IN SAM'S WORDS:** squat · hinge · single-leg knee ·
single-leg hip · horizontal push · horizontal pull · vertical push · vertical
pull · upper accessory · lower accessory · core.

**THIS ANSWERS THE QUESTION BY DISSOLVING IT.** `readiness` asked which two of
the current seven come out to make room for the single-leg slots. **Sam's answer
is that the seven are not a list to be edited — they are whatever the week has
not covered yet.** A full body day placed after a lower day that already ran
squat and hinge is a DIFFERENT SEVEN from a full body day that is the week's
first strength session. **Any fix that hardcodes a full-body row list, however
carefully chosen, contradicts this ruling on the day it lands.**

**AND THIS IS WHY THE 102 FULL BODY DAYS ARE MISSING SINGLE-LEG WORK.** They
were never asked for it, because a full-body day's intent is
`plannedPatterns:["squat","hinge","push","pull"]` and `MainStrengthPattern`
cannot say the single-leg slots. **The composer's job is not to add two rows to
a template. It is to make a full body day ASK the week what is still open** —
which is the same union-widening `readiness` measured, now with a stated purpose
rather than a guessed row list.

**Bible :122 sets the SIZE at 7 and Sam has not moved it.** Eleven slots into
seven rows means a full body day cannot be the only strength day in a week and
still cover everything — which is exactly why the answer depends on the rest of
the week. **Coverage is owed BY THE WEEK. Where a week's structure cannot pay
it, that is a real deficiency to report, not a template to pad.**

**Search words:** full body, full body strength, seven exercises, 7 exercises,
which exercises, what are the 7, template, slot list, weekly coverage, main
lifts, all the main lifts, rest of the week, squat hinge single leg, MainStrengthPattern,
plannedPatterns, composer, R-014, item 51.
· `UNENFORCED` — no reader asks the week what is open before composing a full
body day; `MainStrengthPattern` is still `squat|hinge|push|pull`.

---

**R-088** · *"7 strength exercises can be a cap - but the mobility pairings dont
count at all towards the cap... there should be a mobility warm up and prehab
stuff then there should be 2-3 non competing pairings of strength with mobility
in the session, i.e. lower body strength upper body mobility - the mobility
portion does not count so 7 is the max the app should set and a user should be
able to add as many of their own things on top of it as they choose"*
(2026-08-13, answering `cap`) · **THE CAP IS SEVEN AND IT COUNTS STRENGTH ONLY.**

**THREE THINGS ARE RULED HERE AND THEY ARE OFTEN CONFLATED:**

**1. THE NUMBER IS 7, NOT 6.** `trainingAgePolicy.ts` holds
`maxExercisesPerStrengthSession: 6` and **nobody authored the 6** — it is the
same unauthored-number defect R-013 abolished the beginner's 3 for. Bible `:122`
says *"6-7 exercises"* and *"full body strength and 7 exercises"*.

**2. WHAT THE CAP COUNTS IS STRENGTH ROWS ONLY.** The mobility/prehab flow at
the top of the session (Bible `:229`) and **the mobility half of every
strength+mobility superset do NOT count.** A session with 7 strength rows and 3
paired mobility picks is at the cap, not over it. **A counter that counts session
rows rather than strength rows will read 10 and be wrong.**
**⚠ THE PAIRING ITSELF IS ALREADY RULED AND ALREADY BUILT — see [[R-015]].**
Sam said *"i put in there somewhere"* and he did: 2-3 accessory exercises paired
with non-competing mobility as supersets, main lifts NEVER paired. **Do not
rebuild it. This ruling only says it is free of the cap.**

**3. THE CAP BINDS THE APP, NOT THE ATHLETE.** *"7 is the max the app should
set and a user should be able to add as many of their own things on top of it as
they choose."* **A cap that refuses an athlete's own added exercise is a defect,
not enforcement.** The number is a ceiling on what the app PRESCRIBES.

**Search words:** exercise cap, maxExercisesPerStrengthSession, how many
exercises, 6 or 7, seven exercises, mobility pairing, superset, does mobility
count, row count, user added, athlete added, add their own, over the cap.
· `UNENFORCED` — the constant is still 6; no reader distinguishes strength rows
from paired mobility; nothing exempts athlete-added rows.

---

**R-089** · *"wednesday can squat but it depends on the rest of the week!!! if
the lower day didnt have the single leg hip or single leg knee then i'd rather
put them on the wednesday but if it did then yes squatting and hinging again is
fine... every squat should be matched with a hinge and every single leg knee
should be matched with a single leg hip / it doesnt matter if you have two
squats, two hinges, 1 single leg knee and 1 single leg hip / thats fiiine"*
(2026-08-13, answering `readiness`'s §18 collision) · **COVERAGE IS A PRIORITY
ORDER, NOT A REPLACEMENT — AND THE LOWER PATTERNS MOVE IN PAIRS.**

**THIS RESOLVES THE COLLISION `readiness` MEASURED, AND IT RESOLVES IT IN §18's
FAVOUR.** Building R-087 as REPLACEMENT refused twelve worlds because a
full-body day that stopped planning squat and hinge stopped paying those
exposures. **Sam's answer is that it never stops planning them.** It plans the
UNCOVERED slots FIRST, and then keeps going — *"squatting and hinging again is
fine"*. **VOLUME IS UNTOUCHED. §18 does not change. The main-strength target does
not drop.**

**THE ORDER, IN HIS WORDS:**
1. **Slots the week has not covered go first** — *"if the lower day didnt have
   the single leg hip or single leg knee then i'd rather put them on the
   wednesday"*.
2. **Then repeat freely** — *"if it did then yes squatting and hinging again is
   fine"*.
3. **Later sessions balance the remainder** — *"there is probably another lowers
   or full body session later in the week and it can be balanced out as well as
   possible there"*. **As well as possible — this is a BEST-EFFORT target, not a
   refusal condition. A week that cannot balance is not an invalid week.**

**⚠ AND THE NEW LAW, WHICH IS THE PART NOTHING IN THE APP HOLDS:
EVERY SQUAT IS MATCHED WITH A HINGE. EVERY SINGLE-LEG KNEE IS MATCHED WITH A
SINGLE-LEG HIP.** Counts move in pairs across the week. **2 squats / 2 hinges /
1 single-leg knee / 1 single-leg hip is EXPLICITLY FINE** — he said so in
as many words. **What is wrong is 2 squats and 1 hinge.**
**THE PAIRING IS KNEE-TO-HIP, NOT LEFT-TO-RIGHT.** It is a
push-pull-style balance of the lower body, not a limb thing.

**Search words:** does wednesday squat, full body day, repeat pattern, twice a
week, two squats, squat hinge balance, matched with a hinge, single leg knee,
single leg hip, coverage versus volume, section 18, main-strength target,
uncoveredMainPatternsForWeek, priority order, R-087.
· `BUILT 2026-08-13` (`laws`) — **BOTH HALVES.**
**THE ORDERING:** a post-pass over the FINISHED week reorders each full-body
day's `plannedPatterns` uncovered-first (`orderPlannedByUncoveredFirst`,
`coachingEngine.ts` before `logAllocationWeekValidation`). **It returns an
IDENTICAL MULTISET**, which is why it refuses ZERO worlds where the earlier
REPLACEMENT refused twelve: volume, §18 and the main-strength target cannot
move if nothing is removed. Census byte-identical before and after —
92 deficient / 318 laddered / 174 worlds / 6 refused.
**THE PAIRING:** `test:ladder-wide` now counts squat/hinge and
single-leg-knee/single-leg-hip **per WEEK** across all 174 worlds and reds when
either is unmatched. **Directional, not an equality** — his wording bounds
squats by hinges, and 74 worlds are legitimately `sq0/hi1`, which an equality
would have failed. Mutation-proven: injecting one extra squat reds the squat
cell and leaves the knee cell green. **Non-vacuity asserts BOTH COUNTERS ARE
LIVE** (a week carrying a squat AND a hinge, and one carrying both single-leg
slots) rather than a shape count — the first draft demanded 3 distinct shapes,
failed at 2, and the THRESHOLD was the thing that was wrong.
**⚠ TWO LIMITS, MEASURED:** (1) the ordering delivers points 2 and 3 but NOT
the example in point 1 — a week where only the single-leg slots are open is
UNCHANGED, because the full-body template is `['squat','hinge','push','pull']`
and an ordering cannot introduce a member the list does not have; putting
single leg on the Wednesday needs the template to WIDEN, which is the
substitution class that refused twelve worlds. (2) This corpus never produces
two squats in one week, so the exact `2 squats / 1 hinge` shape he named is
currently UNREACHABLE here — the guard is green and mutation-proven, not
green-because-exercised.

**R-090** · **SEAT-DRAFTED WORDING, APPROVED BY SAM (2026-08-14) — these are NOT
his verbatim words and must never be quoted as such.** Grounded in **R-083** and
**Bible §0** (*"find what they can still do"*), and **in nothing else — do NOT
cite D3**, which governs access to strength-session VARIANTS and has nothing to
do with equipment acceptance. · **WHEN AN ATHLETE'S KIT CANNOT TRAIN A REQUIRED
PATTERN, §18 JUDGES REQUIRED PATTERNS AGAINST THE KIT-ACHIEVABLE SET, PUBLISHES
THE BEST ACHIEVABLE WEEK, AND THE DAY NAMES THE GAP IN PLAIN ATHLETE LANGUAGE.**
A kit-caused gap is a **typed, disclosed shortfall — never a refusal.**
**WHY IT EXISTS:** R-083 says a pattern the kit cannot train is REMOVED, and §18
said a required safe pattern must be RESTORED or the week is rejected. For a
bodyweight athlete both cannot hold, and §18 had the last word: measured
2026-08-14, honouring R-083 made `print:week` scenario 6 produce **no week at
all**. The athlete getting nothing is worse than a row they can see and skip.
**⚠ EQUIPMENT MAY NEVER WEAKEN AN ACHIEVABLE REQUIREMENT.** The exemption is
PATTERN-SCOPED: a week that names `pull` as kit-impossible has said nothing about
`push`, and a full-gym athlete missing a pattern is still a §18 failure exactly
as before.
**Search words:** kit achievable, equipment shortfall, bodyweight athlete, week
refused, pattern_restore_failure, required_minimum_shortfall,
planner_selected_target_miss, best achievable week, disclose not refuse, R-083,
Bible section 0.
· `UNENFORCED` — **BUILT AND MEASURED, DELIBERATELY NOT SHIPPED.** The tree is at
`116bf886`; the change is preserved at `scratchpad/slice1bc/` and reported in
full in `docs/MISSION_THREE_FIXES.md` (slice 1B-completion).
**WHAT WORKS:** all six `print:week` scenarios publish (was 5 of 6), scenario 6's
`impossible_without_kit` findings go **5 → 0**, `row_restored` resurrections of
kit-illegal rows go **12 → 0**, and the athlete reads *"Some of this needs gym
kit you don't have…"* on the day. Six new cells in `test:section18-v2` hold the
ruling and its control (full gym still fails); six in
`test:workout-canonicalisation` hold the removal and its survival through
persistence + a kit-less re-canonicalisation.
**WHY IT IS NOT SHIPPED:** `test:ladder-wide`'s 180-world sweep goes from **6
refused weeks to 26**, and the ~20 new ones are `Bodyweight Only` and `Dumbbells`
— the very athletes this ruling exists to serve. They refuse with
`pattern_restore_failure ... domain=strength_patterns`, meaning the removal
record never reached the evaluator on those paths. **Shipping that would refuse
20 kit-limited worlds to publish six, which inverts the ruling.**
**⚠ §18 REPORTS THIS SHORTFALL UNDER THREE SEPARATE CODES** —
`pattern_restore_failure`, `required_minimum_shortfall` and
`planner_selected_target_miss` — in two different functions. Whoever finishes
this must answer all three; the third was found only by
`test:section18-gateway`, never by `print:week`.
**⚠ RECEIPT 2, 2026-08-14 (slice 1B-final) — THE CODE IS PARKED ON
`slice1bc-parked` (`375f32ce`), AND THE DIAGNOSIS IN RECEIPT 1 WAS WRONG.**
Receipt 1 said *"the removal record never reached the evaluator on those paths"*.
**Measured, one world traced end to end (`Off-season/4d/club/Bodyweight Only/w2`):
THE RECORD IS NOT LOST ANYWHERE.** It is written, threaded through the weeks-2-4
build, and reaches `evaluateSection18EffectiveWeek` fully typed — and that
evaluator **ACCEPTS** the athlete's real week. Both suspects are killed: the
week-2 build path does thread it, and the gateway's fallback candidates carry no
record only because they contain no strength rows to remove.
**THE SIGNATURE DESCRIBES THE SELECTED REPAIR CANDIDATE**, not the composed week
— on the failing arms that candidate is a synthesised `Hard Conditioning x3`
week the athlete never had.
**⚠ RECEIPT 3, 2026-08-14 (slice 1B-final-2) — TWO CLAIMS IN RECEIPT 2 ARE
CORRECTED BY DIRECT GATEWAY INSTRUMENTATION OF THE SAME WORLD.**
(1) Receipt 2 said `evaluateSection18EffectiveWeek` **ACCEPTS** the athlete's real
w2 week. **IT DOES NOT.** That was inferred from a printer that emitted only
CHANGED verdicts, so an unprinted line was read as an acceptance. The primary
candidate's evaluation is blocking, with all six findings.
(2) Receipt 2 said the signature "reports the last repair candidate, not the week
that failed". **The primary arm carries the IDENTICAL signature**, so the thrown
text is not wrong about this world — it is uninformative, and right by
coincidence, which is why three slices trusted it.
**THE REAL CAUSE, MEASURED:** the composed w2 week contains **ZERO rows
classified `main_strength`**. Every bodyweight lift — `Bodyweight Squat`,
`Walking Lunges`, `Single-Leg RDL`, `Push-ups` — classifies `strength_accessory`
with `mainStrengthPattern: null`. §18 then correctly reports `main_strength:0`
and four unrestored patterns. **That is a row-classification property of a
bodyweight week and is INDEPENDENT of R-090.** Week 1 published only because it
retained exactly one main lift.
**THREE INDEPENDENT MECHANISMS CONTRIBUTE** (named, not fixed, per the slice
fence): the zero-main-lift classification above; R-090's downgrade not firing
even where the evaluated candidate carries removals naming all four patterns;
and a defect in the PARKED code — it removes `Chest Supported Row`,
`Romanian Deadlift` and `Pallof Press`, whose sheet entry is `[]` meaning
*needs nothing*. **The parked implementation removes work this athlete can do.**
Full table and the composed week in `docs/MISSION_THREE_FIXES.md`.

**R-091** · *"it makes sense to just remove the ai from building week 1 or doing
a complete rebuild in the app (never going to happen for an athlete) - so i think
it's more elegant that the code just builds the first block, then updates for the
second block based on what they did etc"* (Sam, 2026-08-14) · **THE AI BUILDS
NOTHING.** No exercises, sessions, sets, structure or placement — not for week 1,
not for a rebuild. **The AI may still converse and explain**; it may not compose.
**THE ENDPOINT IS SHARED AND IS NOT THE SUBJECT.** Program generation posted to
`env.coachChatEndpoint`, the same edge function coach CHAT uses. Only the
generation MODE is removed; the endpoint, its plumbing and every conversational
route are untouched, and `test:coach-plan`, `test:coach-tab-slice2` and
`test:coach-clarifier-advance` are the evidence they still work.
**Search words:** ai generation, remove the ai, edge function, week 1, first
block, rebuild, generateProgramFromProfile, generateProgramLocally, deterministic
builder, coach chat, generation mode.
· `BUILT src/services/api/generateProgram.ts:1505` for sole deterministic builder
ownership. The history-responsive clause of this quote is NOT claimed by this
receipt and remains governed by the later progression slice.
**ONE DOOR, NOT FOUR.** `generateProgramFromProfile` is what onboarding's
`CompleteScreen`, `useProgramRebuild`, `coachTurnController` and
`coachProgramEdit`'s injected generator all call; it now returns
`generateProgramLocally` and the 528 lines that built a prompt, posted a payload
and parsed a week back out are deleted. **Reachability is removed, not guarded**
— there is no flag or argument that reaches the old path, because the path is
gone. Zero production `fetch` to the coach endpoint remains in
`generateProgram.ts`.
**GUARDED:** `test:onboarding-generation-outcome` (49/0) drives that one door
with `fetch` replaced by a throw and asserts three things — a week is built, the
network was never touched, and the week IS `generateProgramLocally`'s, compared
on days, names, types and every prescribed row rather than on ids and timestamps
that are minted per call. A non-vacuity cell asserts the week is not empty.
**IDENTITY, NOT IMPROVEMENT — MEASURED.** The `print:week` corpus is
byte-for-byte unchanged (digest `0cca0f63`), the 180-world sweep is 174 built /
6 refused before AND after with **the same six worlds named**, and `test:qa`,
`test:scenarios`, `test:ladder-wide`, `test:compile` and `test:pools` are
unmoved. **Nothing was re-baselined:** the sole builder's defects are the
evidence base for the composer, and this slice hid none of them.

---

**R-092** · *"i think any push pull hinge squat single leg knee single leg hip
get the main lift role there."* (Sam, 2026-08-14) · **A DAY'S PLANNED PATTERN
GETS THE MAIN-LIFT ROLE ON THAT DAY.** The row that fills a planned pattern's
slot is `main_strength` for that pattern — it is not an accessory because the day
also carries other work, and it is not demoted because a different day already
covered the pattern.
**⚠ THE GUARD IS PART OF THE RULING, and without it the ruling doubles a
pattern.** A day carrying TWO rows of one pattern — a horizontal push and a
vertical push — gets **ONE** main lift: the day's FIRST row of that pattern takes
the role and the supplementary row stays `strength_accessory`. Reading his
sentence without that guard credits both, which inflates the week's main-lift
count and makes a five-row upper day look like four main lifts.
**Search words:** main lift role, main_strength, strength_accessory, push pull
hinge squat, single leg knee, single leg hip, role assignment, supplementary,
second push, composer, section18Evidence.
· **`UNENFORCED` GLOBALLY — and this row states that rather than implying
otherwise.** The ruling holds on the COMPOSED route only, which is one
configuration of 180. By gate rule 4 a ruling enforced on one route of several is
UNENFORCED, exactly as `R-090` records for the same reason. It becomes `BUILT`
when every program-building route is migrated or deleted (slice B1 CP2/CP3).
**GUARDED, ROUTE-SCOPED:** `test:composer-b1` (48 cells, 0 failures) —
*"each PLANNED pattern gets exactly one main lift"*, *"[guard d] a supplementary
same-pattern row stays an accessory"*, and *"an unplanned pattern never takes the
main-lift role"*. The composed control world's stored week is the live receipt:
`Bench Press` and `Barbell Row` carry `role=main_strength`, and `DB Shoulder
Press` — the day's second push — carries `strength_accessory`.

---

**⚠ R-090 — ROUTE-SCOPED ENFORCEMENT RECEIPT, 2026-08-14 (slice B1 CP1). THE ROW
ABOVE STAYS `UNENFORCED` AND THIS RECEIPT DOES NOT CHANGE THAT.**
R-090's first half is now BUILT on the composed route: required patterns are
judged against the kit-achievable set at **contract construction**
(`buildSection18WeeklyExposureContractV2`'s `kitUnachievablePatterns` input,
`weeklyExposureContractV2.ts:1262`), and a kit-caused gap is a typed
`ComposedGap` carrying what the kit would need in the sheet's own words, derived
from kit + sheet rather than from any record.
**WHAT IS STILL OWED, AND THE ROW MUST NOT PRETEND OTHERWISE.** (1) The
composed route is **ONE configuration of 180** — full gym, two-day pre-season
with a club night, week 1 — so by gate rule 4 the ruling is UNENFORCED globally.
(2) **The gap is TYPED but not yet SAID:** `ComposedGap` has no athlete-facing
reader, so the day still just comes out shorter. That is the same half of R-083
this registry already records as owed, and B1 CP1 did not pay it.
**GUARDED, ROUTE-SCOPED:** `test:composer-b1` — *"a kit-unachievable pattern is
not owed (R-083)"*, *"a bodyweight athlete gets typed gaps, not substitutes"*,
*"the gap names what the kit would need, in the sheet's own words"*, and the
full-gym control *"a full-gym athlete has no kit gap at all"*.
**MEASURED:** the 180-world sweep moves **174 built / 6 refused -> 175 built / 5
refused**, the world that stops being refused is exactly the migrated one, and
**every one of the other 179 worlds is byte-identical.**

---

**R-093** · *"either way i'd make them full body sessions. Squat and single leg
hip with push and pull + accessories then hinge and single leg knee with push and
pull (in opposite plane to earlier in week) + accessories - but the ideal would be
to do full body strength on different nights"*, and on the impossible plane:
*"yes repeat achievable pull plane"* (Sam, 2026-08-14) · **WHERE EVERY AVAILABLE
GYM NIGHT IS A CLUB NIGHT, THE TWO SESSIONS ARE FULL BODY.**
**SEAT-DRAFTED WORDING, APPROVED BY SAM — NOT his verbatim words:** session A is
squat + single-leg hip + push + pull + accessories; session B is hinge +
single-leg knee + push + pull in the OPPOSITE planes where those planes are
kit-achievable. **The kit outranks the plane preference** — R-083/R-090 govern, an
impossible plane repeats the achievable one, and where no plane of a pattern is
achievable the pattern is removed and disclosed. **An illegal exercise is never
authored to manufacture plane variety.**
**HIS STATED IDEAL — full-body strength on DIFFERENT nights — IS APPROVED
DIRECTION AND IS NOT BUILT. It must not be marked built by this row.**
**Search words:** full body, club night, team night, both nights, squat single
leg hip, hinge single leg knee, opposite plane, repeat pull plane, two strength
sessions, composed shape.
· **`UNENFORCED`.** **B1 CP2 STOPPED before this could carry a receipt.** The
composer builds the shape correctly — measured, and printed in
`docs/MISSION_THREE_FIXES.md` — but the composed week does not survive to
storage: three post-composition sites still rewrite or discard composed rows.
**No guard may claim this row until a composed week reaches an athlete unchanged.**

---

**R-094** · *"no just make it regular loads forget what i said or delet that
section of bible"* (Sam, 2026-08-14) · **NO AUTOMATIC LOAD REDUCTION SOLELY
BECAUSE GYM WORK SHARES A DAY WITH CLUB TRAINING.**
**SEAT-DRAFTED WORDING, APPROVED BY SAM — NOT his verbatim words:** full-body gym
work on a club-training day receives the normal load and prescription it would
receive off a club night. **Injury, readiness, deload and every other
independently ruled safety constraint still apply in full** — this ruling removes
one automatic reduction, not the safety envelope.
**⚠ THE CLAUSE HE IS DELETING WAS NEVER IN THE BIBLE.** Searched: the nearest
clauses (`:266`, `:736`, `:77`) are about hard LOWER work near a GAME, and `:94`
already says *"if can only do 2 strength sessions should be 2 x full body and
those sessions should be pretty solid"*. The reduction exists in CODE ONLY and is
recorded in the findings ledger. The Bible carries a dated amendment stating
exactly this rather than deleting text that does not exist.
**Search words:** regular loads, team night, club night, moderate intensity, low
fatigue, keep CNS sharp, isHardExposure, load reduction, same day as training.
· **`UNENFORCED`.** **B1 CP2 STOPPED.** The composed path applies no team-night
reduction — nothing in `composeWeek` asks whether the day is a club night — but a
composed week does not currently reach storage intact, so there is no
athlete-visible receipt and this row may not claim one. The legacy mirror at
`coachingEngine.ts:2226-2251` is **unchanged and still live** on every
non-composed route.

---

**R-096** · *"DO NOT INVENT OR RE-RULE LOAD BEHAVIOUR. Sam has already authored
it... The missing work is integration, not policy."* (Sam, 2026-08-16, FINAL) ·
**THE CANONICAL LOAD PRIORITY. EVERY NUMBER COMES FROM AN AUTHORED SOURCE;
THE APP ONLY DECIDES WHICH SOURCE ANSWERS.**
**1. EXACT-EXERCISE HISTORY WINS** — a valid recorded load from a COMPLETED
exposure is the base, *"even if the exercise disappeared for one or more blocks
and later returns"*. Then the approved progression/readiness rules: successful
training + good recovery → smallest practical progression; very hard or low
readiness → **hold load and reduce volume first**; the athlete may always edit.
**2. UNSEEN → SAM'S OWN ESTIMATE** — `EXERCISE_LOAD_MAP`'s squat/bench anchor,
conservatively rounded through the existing equipment lattice.
**⚠ NO SECOND RATIO TABLE AND NO SECOND ESTIMATION FUNCTION MAY BE CREATED.**
**3. BODYWEIGHT IS A DEFAULT, NOT A PROHIBITION** — initial display is BW / zero
additional external load; **the athlete may always add and record external load**
(shown as BW + X kg); when the exact exercise returns its recorded added-load
history WINS. **`loadRatio 0` means no automatic estimate or cross-exercise
transfer. It NEVER means the athlete is forbidden from adding weight, and no
existing weight control may be removed, hidden or disabled.**
**4. NO VALID HISTORY OR ESTIMATE** — no exact history, no valid authored
mapping, or missing anchor inputs → **leave the suggestion blank**.
**5. NO REPLACEMENT CONTAMINATION** — never seed a rotated exercise from the
OUTGOING exercise's weight merely because they share a slot, role or movement
pattern.
**INCREMENTS COME FROM THE AUTHORED EQUIPMENT LATTICE.** *"Never round, rewrite
or 'correct' the athlete's recorded number; their number remains the base. If
the equipment required for an optional external load is unknown, preserve the
recorded load and leave the next choice editable rather than guessing."*
**⚠ THIS SUPERSEDES EVERY EARLIER LOAD CLARIFICATION OF 2026-08-16**, including
two interpretations that were briefly BUILT on this branch and are now removed
from the code, the guards and this registry: *"rotated exercises are always
blank"* (wrong — clause 2 gives an unseen mapped exercise the authored estimate)
and *"bodyweight has no weight field"* (wrong, and the more damaging: it
short-circuited authored-unloaded rows before reading history and would have
discarded an athlete's recorded weighted Pull-Up). **Clause 5 is the only one
that survived all three revisions unchanged.**
**Search words:** load authority, exact exercise, canonical exercise, recorded
load, anchor estimate, EXERCISE_LOAD_MAP, anchorMultipliers, equipmentLattice,
squat anchor, bench anchor, rotated load, sibling transfer, loadRatio, returning
exercise, unset load, blank load, bodyweight, BW plus, added load, weighted
pull-up, outgoing exercise, contamination, smallest practical increment.
· **`BUILT rules/blockBoundaryProgression.ts` — `decideBlockBoundaryLoads` and
`smallestPracticalIncrementKg`, guarded by `test:block-two-progression`
(21 cells).** Ten mutations seen RED before this row was written: unknown
equipment guessing 2.5; the lattice step doubled; history windowed to the
previous block; `partial` counted as successful; the authored estimate
outranking own history; an unseen mapped exercise falling to blank; a rotated
row seeded from any recorded load; **bodyweight short-circuited before history
(the interpretation this ruling retired)**; the athlete's recorded number
rounded; and projection's authority to re-derive restored.

**R-097** · *"Real history, overrides and block state enter the single
generation-time Block Two owner. The final prescription is stored. Projection
only displays the stored prescription and may not recalculate it."* (Sam,
2026-08-16) · **ONE OWNER, AT GENERATION TIME, AND THE SCREEN OBEYS IT.**
**⚠ THE AUTHORING-TIME FREEZE ALREADY EXISTED** —
`bakeMicrocycleStrengthProgression`, at the end of `generateProgramLocally` —
**and was fed `sessionFeedback: {}`, `weightOverrides: {}`, `workoutHistory: []`,
`blockState: null`.** It baked a history-free load into storage while the
screen, reading the live store, could derive a different one. **The defect was
four empty arguments, not a missing layer.**
**A MATCHING PAIR OF NUMBERS IS NOT EVIDENCE HERE.** "Stored == visible" is
equally produced by *"projection obeys"* and by *"both passes happened to
agree"*, so the guard hands projection a history that CONTRADICTS the one
generation saw and requires it not to move.
**Search words:** stored visible reloaded, projection authority, read-time
progression, authoring freeze, bake, materialise, prescription identity,
relaunch, four empty arguments, single owner.
· **`BUILT services/api/generateProgram.ts` — the `progressionHistory` option
and the fed `bakeMicrocycleStrengthProgression` call, guarded by
`test:block-two-progression` cell [8] plus its contradictory-history control.**
The mutation that restores projection's authority reddens it.

**R-098** · *"Keep meaningful load/intensity and reduce volume first: reduce a
four-set main lift to three sets; reduce secondary-lift sets where necessary;
reduce the number of hard conditioning sessions; replace removed hard
conditioning with easier aerobic work when the weekly conditioning requirement
still needs to be met."* (Sam, 2026-08-16, approved contract, "Completed but
very hard") · **AT A BLOCK BOUNDARY, THE CONTRACT'S NUMBER WINS OVER THE
FREEZE'S.**
**⚠ THE APP ALREADY REDUCED A VERY-HARD BLOCK, TO THE WRONG NUMBERS.** Measured
at `6117a9fd`, one athlete, three histories differing only in the recovery
answers: good → `Deadlift 3 × 4-6 @ 102.5`; **very_hard → `1 × 4-4 @ 100`**;
very_easy → `4 × 4-6 @ 102.5`. `drop_two` collapsed EVERY strength row to a
single set and dragged the rep range down with it (`6-10 → 4-8`, `12-15 →
10-13`). One set is not the contract's number and reps are not on its reduction
list. The authoring-time freeze remains the IN-BLOCK progression owner; the
boundary now has the last word on VOLUME exactly as R-096/R-097 gave it the last
word on LOAD.
**REPS ARE DELIBERATELY UNTOUCHED.** The contract's reduction list names sets and
conditioning; restoring the freeze's lowered rep range would be ADDING
repetitions, which the same instruction forbids.
**THE REDUCTION'S CEILING IS THE AUTHORED DOSE, SNAPSHOTTED BEFORE THE FREEZE
RUNS.** Read afterwards it is the collapsed 1, and the `min()` can only return 1
— measured: exactly ONE lift in the block moved. The same snapshot carries week
4's already-halved dose, which is what stops the reduction raising a deload and
undoing R-034.
**`recoveryGood: false` WAS DOING TWO JOBS** — "they said it was brutal" and
"they said nothing" — and the contract treats those oppositely.
`BlockRecoveryVerdict` is three-way; silence HOLDS, only `very_hard` reduces.
**Search words:** very hard block, completed but very hard, reduce volume, four
sets to three, secondary sets, drop_two, one set, deload law, authored dose
snapshot, recovery verdict, low readiness, high soreness.
· **`WORKING rules/blockBoundaryProgression.ts` —
`decideBlockBoundaryVolume` / `applyBlockBoundaryVolume` /
`snapshotAuthoredSets`, and the signed sentence in `rules/projectionCopy.ts`.
Guarded by `test:block-two-difficult-missed` (86 cells).** Twenty-four mutations
seen RED, four of which SURVIVED the first pass and named real holes: the
contract's own cap was DECORATION because `resolveComposedDose` clamps every main
lift to three; the fixture answered `very_hard` AND `high` together so either
reader could be deleted; the deload clamp had no coordinates; and reps added back
land exactly ON the control's number and are invisible to it.
**⚠ THE CONDITIONING HALF IS UNREACHED BY GENERATION.** 48 worlds swept at
`6117a9fd` — every world that built carried ONLY `aerobic_base` and `tempo`. The
replace-hard-with-easy rule is wired into the real path and guarded against
constructed trees; emitting hard conditioning is a scheduler change and was out
of scope.

**R-099** · *"One disrupted week does not redesign the program. When the athlete
completes less than roughly 75 percent of required sessions across the block, ask
whether the weekly commitment is unrealistic. ... Rebuild only after the athlete
confirms. Do not shame them, cram missed work into later days or silently reduce
the plan."* (Sam, 2026-08-16, approved contract, "Missed sessions") · **THE
QUESTION IS DERIVED; ONLY THE ANSWER IS STORED.**
The ask is a function of the logged sessions and the commitment the block was
built on, so storing it would be storing a derivation — `docs/NORTH_STAR.md`'s
standing refusal. It survives reload by being RECOMPUTED, which is stronger than
persistence. The ANSWER is an athlete decision and rides the existing decision
ledger as one appended `weekly_commitment_answer`; **no new persisted key**, so
`test:persisted-inputs-schema`'s four-class property is untouched.
**THERE IS NO SEPARATE "ONE DISRUPTED WEEK" RULE.** With the whole block as the
denominator, one empty week of four is `9/12` — exactly 75%, which is not BELOW
it. The contract's first sentence is what choosing the block-length denominator
BUYS. A `disruptedWeeks >= 2` branch would never bind, and a branch that can be
deleted with no cell moving is decoration.
**⚠ THE LEGALITY OF A SMALLER COMMITMENT IS GENERATION'S ANSWER, NOT A TABLE.**
Measured with the production probe over nine worlds: Pre-season `d=3 → []`,
`d=4 → [3]`, `d=5 → [4,3]`; In-season the same; Off-season `d=3 → [2]`,
`d=4 → [3,2]`, `d=5 → [3,2]`. **A pre-season or in-season athlete already at
three has NOTHING legal to offer**, and the honest answer for them is no question
at all. A phase/gym table in the rule would have had to reproduce four different
owners' refusals (`main_strength_permitted_minimum`,
`sprint_high_speed_required_minimum`, `hard_day_permitted_maximum`,
`required_safe_patterns_present`) and would be wrong the day any of them moved.
**A DECLINE IS RECORDED, NOT INFERRED FROM ABSENCE.** Absence means "not asked
yet"; collapsing them is how an app re-asks the same question every redraw.
**Search words:** missed sessions, attendance, 75 percent, weekly commitment,
smaller program, one disrupted week, decline, cram, silently reduce, legal
session counts, commitment fact, rebuild after confirm.
· **`WORKING rules/weeklyCommitmentQuestion.ts` (derivation),
`rules/weeklyCommitmentLegality.ts` (the probe that asks generation),
`store/weeklyCommitmentAnswer.ts` (the door; confirms through the EXISTING
`commitProfileProgramTransaction`, never a second rebuild path). Guarded by
`test:block-two-difficult-missed`.** Twenty mutations seen RED; one SURVIVED the
first pass — the attendance fixtures used only `full` and `skipped`, so a rule
counting `partial` as attendance had no coordinate to fail on, and `partial` is
the commonest real answer for exactly this athlete.

---

**R-100** · *"How long should we leave this exercise out?"* — with the three
answers **Today only / This block / Until I change it** (Sam, 2026-08-16,
approved contract, "Athlete substitutions and exclusions"; merge authorised the
same day: *"merge it"*) · **ONE CANONICAL EXCLUSION OWNER, AND THE EXPIRY IS
ARITHMETIC RATHER THAN A JOB.**
The stored fact is the athlete's DECISION (scope, decision day, last day,
block, reason); the flat "which names are out" list every reader used is now a
PROJECTION of it onto a DATE. That is what makes a `today_only` answer stop
applying tomorrow with no sweep, no scheduled task and no second writer —
nothing can forget to run.
**THE BLOCK END IS STORED, NOT RE-DERIVED, AND THAT IS NOT A NORTH-STAR
VIOLATION.** The anchor MOVES — rollover advances it — so re-deriving "this
block" a fortnight later answers for a DIFFERENT block than the athlete was
standing in. "The block I was in when I answered" is a fact about the moment of
the decision, and a fact is an input.
**ONE DECISION PER EXERCISE.** Changing the scope UPDATES that decision; it
never mints a second, so Status can never show two rows disagreeing about when
an exercise comes back.
**⚠ AN ORDINARY SUBSTITUTION IS NOT AN EXCLUSION.** The swap door called
`addExclusion` on the original, so one swap for one sore shoulder permanently
banned a lift from every future program with nothing to expire it. Sam's
contract forbids it in as many words; the ban is gone and the swap only pins the
alternative.
**⚠ SAM DECLINED THE SWAP-SIDE STATUS ROW — 2026-08-16, verbatim: *"leave
swaps"*.** Asked whether a swapped-in exercise should also appear on the status
list, he ruled it should not. **Only removals appear.** This is a RULING, not an
omission, and it is recorded so it is not re-asked or "fixed" later.
**A GAP NAMES ITS REAL CAUSE.** A slot an exclusion empties is disclosed as an
EXCLUSION gap, never as a kit gap — the test is "would the kit ALONE have
emptied it", so a thing the athlete cannot do outranks a thing they chose. Where
a legal same-pattern replacement exists it is used and no gap is shown.
**Search words:** exclusion, exclusion scope, today only, this block, until I
change it, leave this exercise out, remove exercise, restore exercise, change
scope, banned exercise, substitution does not ban, typed gap, exclusion gap,
silently restore, leave swaps, swap status row.
· **`WORKING rules/exerciseExclusions.ts` (the decision and the one
`exclusionIsActiveOn` predicate), `utils/exerciseExclusionOwner.ts` (the one
transaction), `store/athletePreferencesStore.ts` (stored decisions, derived
projection, legacy fold at hydration). Guarded by `test:exercise-exclusions`
(51 cells) and `LAW-an-exclusion-is-answered-with-a-scope` /
`LAW-a-gap-names-its-real-cause`.** 13 of 13 mutants seen RED. One first read as
SURVIVING and the INSTRUMENT was at fault — `//` in the replacement text
terminated perl's own `s///`, so the file never changed. One red was MEASURED
before it was believed: "boot wipes the athlete's exclusions" was refuted by a
standalone probe, `before=1 after=1` over three cycles. **NOT SEEN ON GLASS —
every cell is headless and the three-option sheet is owed a device pass.**

---

**R-101** · *"1. Increase load by the smallest practical increment. 2. Add one
set when more volume is appropriate and the session remains inside its approved
cap. 3. Add another session only when phase, schedule and gym availability
permit it, and after athlete confirmation."* — with *"everything consistently
easy: load first, sets second, then consider another session"* and the verbatim
offer *"You've been completing your training consistently and recovering well.
Your schedule allows another session. Would you like to add one session each
week?"* / **Add one session** / **Keep my current schedule** (Sam, 2026-08-16,
approved contract + the Block Two progression-ladder order) · **THE LADDER IS
ORDERED, AND ONE LIFT NEVER TAKES TWO RUNGS IN ONE ROLLOVER.**
**⚠ THE IN-BLOCK FREEZE ALREADY BROKE THE ORDER.**
`utils/progressionRules.buildBuildOutput` returns `loadDelta: 'up'` **and**
`setsDelta: 'add_one'` on the SAME lift after three consecutive full
completions, and `buildOverreach` does the same — both rungs at once, with no
session set ceiling anywhere on the path. The boundary now has the last word on
an ADDED set exactly as R-098 gave it the last word on a REDUCED one.
**THE RUNG IS COUNTED FROM THE ATHLETE'S PREVIOUS PRESCRIPTION, NOT FROM THE
ROW.** By the time the boundary runs the freeze may already have put its set on
the row; adding to the row would hand out TWO sets in one rollover while every
comment said one, and no cell comparing against a silent control could see it
because the control never got either set.
**THE CEILING IS WC-030's OWN 16**, `SET_CEILING` exported rather than
re-declared, counted through `slotCountsTowardSetBudget` so accessories and core
stay outside it — Sam's *"Ab Wheel is outside that ceiling"*. **WC-030's
week-time check tests the LAYOUT's declared ceiling, never a real session's
total**, so the ladder is the first owner in the app that counts one.
**STRENGTH DIFFICULTY AND CONDITIONING DIFFICULTY ARE DIFFERENT RECORDED
FIELDS.** Measured over 24 worlds: a generated week has **144 strength-only
days, 64 combined and ZERO conditioning-only**, so the session feeling cannot
answer both. Conditioning reads `SessionFeedback.conditioning.rpe` — the
conditioning input, never written from a strength answer; strength reads
`feeling`/`soreness` on a date carrying no conditioning. `difficulty` is
deliberately unread: the panel writes it as
`executionSummary ? sessionRpe : conditioningRpe` and it does not say which
question it answered. The RPE band is the SIGNED effort scale's own
`8 — very hard` and `RPE 5-6 is easy`, joined by the WORD, not by a new number.
**"CONSISTENTLY EASY" IS A STRICT SUBSET OF "GOOD".** `good` and `hard` are
legal, well-recovered answers that buy load and a set; they do not buy a
training day.
**THE OFFER'S ANSWER RIDES THE EXISTING `weekly_commitment_answer` ENTRY.** One
question of the form *"how many sessions a week"*, asked in two directions, one
canonical answer per block — and the two can never collide, because the
shrinking question needs attendance BELOW 75% and the offer needs the block to
qualify. **No new persisted key.**
**⚠ AMENDED 2026-08-17, ON THREE ORDERS FROM SAM, AND TWO OF THE AMENDMENTS
RETRACT CLAIMS THIS ROW MADE THE DAY BEFORE.**
**THE SET RULE IS RULED AND MATCHES WHAT WAS BUILT:** *"One extra set per
strength day, applied to one eligible main or secondary lift that did not
receive a load increase. Never more than one extra set per session, and never
beyond the 16-set ceiling."*
**CLUB TRAINING IS NOT AN ELIGIBILITY REQUIREMENT AND CANNOT BECOME ONE.** The
only mention of team training on the offer path is `availableTrainingDays`
REMOVING club nights from the free days — a club night reduces availability and
never grants it. **A clubless athlete IS offered the session** (off-season, two
gym days, guarded). Where a clubless athlete gets no offer it is generation
refusing: pre-season and in-season clubless athletes have **no legal week at ANY
count including the one they are on** — `sprint_high_speed_required_minimum:0`,
the club night was carrying the sprint exposure. **This RETRACTS "every world
with no club night refuses the larger week"**, which was misleading in
pre/in-season and false in off-season.
**⚠ AND THE 16-SET CEILING IS REACHED BY A REAL GENERATED WORLD — RETRACTING
"UNREACHABLE".** That first sweep measured BLOCK 1 worlds, where the largest
session total is 12. A clubless off-season athlete on two gym days is authored at
**exactly 16** at block 2, four main lifts at four sets, the freeze having added
the fourth.
**⚠ THAT ATHLETE ALSO KILLED A GATE.** `smallerRungsAlreadySpent` demanded the
two smaller rungs had LANDED before a session could be offered — and every one of
her sessions is on the ceiling with every load `history_held`, which is the
contract's *"load and set progression are UNAVAILABLE"* case in the flesh. The
gate refused exactly the athlete the word was written for. **Both branches open
the offer; the gate and the `set_added` explanation row that fed it are
deleted.** *"Only after load and sets"* holds structurally: the question is
derived from a STORED block in which the boundary has already decided both.
**`n → n+1` IS LEGAL IN 11 OF 27 WORLDS.** Generation is asked; no table is
written.
**⚠ AND THE HARD-CONDITIONING RESPONSE IS `NOT BUILT`, NOT `REUSED`.** Sam,
2026-08-17: *"Record the hard-conditioning response honestly as NOT BUILT; do not
claim the entire low-recovery conditioning clause is enforced."* R-098's code is
wired into the real path, but every hard-conditioning cell in its suite drives a
CONSTRUCTED tree and **64 of 64 conditioning days across 16 built worlds are
`aerobic_base`**. Under low recovery what is enforced end to end is **load held
and main/secondary sets reduced** — nothing else. The missing producer is a
scheduler/§18 change emitting `sprint`, `vo2`, `glycolytic` or `cod_decel`.
**Search words:** progression order, load first, sets second, add one set, set
ceiling, 16 sets, working sets, accessory outside the count, both rungs, same
rollover, extra session, add one session, keep my current schedule, another
session, gym availability, unavailable day, consistently easy, strength easy,
conditioning difficult, conditioning rpe, quality split, deload not raised.
· **`WORKING rules/blockBoundaryProgression.ts` —
`decideBlockBoundarySetAdditions` / `applyBlockBoundarySetAdditions` /
`countMainSecondarySets` / the `byQuality` read / `smallerRungsFoundSomewhereToGo`;
`rules/extraSessionOffer.ts` (the derived offer and the availability read);
`rules/weeklyCommitmentQuestion.commitmentPatchFor` (the growing direction);
`screens/home/useBlockBoundaryPrompts.ts` (derivation, no writer);
`screens/home/BlockBoundaryCards.ExtraSessionOfferCard`; the three signed
entries in `rules/projectionCopy.ts`. Guarded by `test:block-two-ladder`
(52 cells) and `test:block-two-extra-session` (40 cells).** 37 mutations seen
RED, EIGHT of which SURVIVED a first pass and each named a real hole: three
separate cases of TWO GATES CATCHING ONE FIXTURE — one of them a gate no world
could reach (`reduces` strictly implies `!qualifies`) — an ambiguous
all-combined block with no fixture, a brutal combined day no cell told from a
brutal squat day, block 1 with no fixture, an ordering witness wired to nothing
testable, and an answer filed against a hand-written block number.
**⚠ IT ALSO REDDENED `test:block-two-screen-delivery` (35/0 → 33/2) AND THAT WAS
A REAL DEFECT, NOT AN INSTRUMENT FAULT:** the offer's derivation read the
athlete's free days EAGERLY, so every athlete paid a profile read — and would
have paid a whole generation — on every redraw of the Program surface. Both
reads are inside the closures now; 35/0 restored and the cost property is held
in the new suite too. **NOT SEEN ON GLASS — the card is driven through its real
`onPress` and its real signed copy, but no device has rendered it.**

**R-102** · *"When the athlete changes equipment for this session, persist one
typed, canonical fact keyed to the actual session occurrence/date … It must be
read by every producer that may add or restore work; expire after that session;
never alter profile equipment, away equipment, base block selection, rotation
history or future sessions."* (2026-08-18) · **THE SESSION EQUIPMENT ANSWER IS A
STORED FACT, NOT SCREEN STATE.** This **AMENDS R-072's `BUILT` note**, which
recorded *"It writes NO equipment fact"* as the shipped behaviour. **The SCOPE
ruling of R-072 is untouched — there are still exactly three scopes and this
invents no fourth**; scope (2), the DEFAULT case, is simply written down now in
the same typed shape as the other two.
**Search words:** session equipment, today only, untick barbell, missing for
session, temporary equipment, no barbell today.
**WHY IT WAS ORDERED:** the sheet emitted a loop of `swap_exercise` actions and
held *"I have no barbell today"* in React `useState`, gone on unmount. So no
producer downstream could know the kit had changed, and the removal could not
expire on return because it never began.
· `BUILT` — `missing_for_session` on `set_equipment_modifier`
(`types/programControlAction.ts`), scoped `temporaryFactScope({kind:'date'})` so
`from === until === the session's own day`, written by
`DayWorkoutScreenV2.applySessionEquipment` **before** it applies anything, through
the same `transactTemporarySourceFact` the week and span answers use.
**GUARDED:** `test:visible-surfaces` section [5] (in `test:bible`), mutation M3.
**MEASURED 2026-08-18, headless through the real doors:** the fact alone
recomposes the day, every visible row is legal by `exerciseAllowedByEquipment`,
each replacement carries its own load, and **rotation history is unchanged**.
**⚠ SOURCE-AND-HEADLESS, NOT GLASS — the device check is owed.**

**R-103** · *"When an intended main lift is unavailable because of equipment or
an active injury restriction, choose the next best SAFE and LEGAL training
option before refusing."* (2026-08-18) · **THE CONSTRAINED STRENGTH FALLBACK
LADDER.** Order: (1) legal alternative main lift, same pattern and plane; (2)
legal secondary compound, same pattern and plane; (3) legal simpler, unilateral
or lower-load version; (4) legal accessory targeting the same muscles/action;
(5) legal related pattern/plane as a final useful fallback; (6) typed refusal
only when no safe, meaningful work exists.
**INJURY LEGALITY OUTRANKS THE LADDER** — do not assume another hinge or press
is safe because it is related. **Typed pattern/plane/role/equipment metadata,
never name regexes.** An accessory keeps its OWN ruled role and dose and never
inherits the outgoing prescription. Every replacement uses its own load
authority. **Accessory and adjacent-pattern fallbacks are PARTIAL coverage and
must be disclosed as such** — a typed, athlete-visible explanation naming what
was substituted and what remains untrained. Existing weekly balance and set
ceilings still apply.
**Search words:** fallback ladder, no barbell, RDL alternative, partial
coverage, kit-blocked pattern, safe legal option.
· `BUILT` — `buildSessionEquipmentReplacementPlan` (`src/utils/sessionEquipment.ts`)
WALKS the authored `SAFE_TRAINING_FALLBACK_TIERS` ladder
(`same_movement_pattern` -> `similar_muscle_group` -> `unaffected_body_area`,
which is Sam's ordering in the app's own words) and takes the first rung that is
LEGAL on the remaining kit, per `exerciseAllowedByEquipment`. The plan carries
`fallbackTier` and `coversOriginalPattern` so partial coverage is disclosed, and
rung 6 is a typed `no_legal_fallback_on_remaining_kit`.
**GUARDED:** `test:visible-surfaces` section [7], 6 cells (in `test:bible`) —
mutation **M4** (drop the legality filter) reds two of them and reproduces the
defect BY NAME.
**WHAT IT FIXED, measured through the real door 2026-08-18:** a barbell-less
athlete was offered **`Inverted Row (Bodyweight)`**, which Sam's sheet requires
`rings_trx` for. The write door correctly refused it and the refusal was
flattened into *"That change didn't go through."* **A ladder that offers an
illegal rung has not fallen back, it has failed quietly.** It now lands
`Barbell Row -> Single-Arm DB Row`, same pattern, legal, own load.
**⚠ ITS DISCLOSURE HAS A KNOWN OBSTACLE, recorded so it is not re-bought:**
`ComposedGap` is keyed on a `SessionSlot`; four of the six `MainStrengthPattern`
values map to one by name, but **`push` and `pull` do not — a slot carries a
PLANE (`horizontal_push`/`vertical_push`) that a pattern does not.** That
mapping needs ruling, not inventing.

**R-104** · *"Each composed/visible row must identify the actual implement
selected for that session. The athlete must not infer it from availability."*
plus *"do not split load history by implement. The same exercise may retain its
suggested load when moving between barbell, dumbbells or kettlebells; the
athlete can edit it."* (2026-08-18) · **THE SELECTED IMPLEMENT IS STATED, AND
THE CUES AGREE WITH IT.** Reuse existing authored equipment-specific cues; add a
typed cue variant where setup genuinely differs; use a generic cue only where it
is correct for EVERY supported implement; **flag missing authored technique
guidance rather than invent coaching copy.** **LOAD HISTORY IS NOT SPLIT** — that
is explicitly out of scope.
**Search words:** selected implement, barbell or dumbbell, RDL cues, bar slides
down leg, implement-specific cue, which implement.
· `BUILT` — `src/rules/selectedImplement.ts` is the one owner
(`resolveSelectedImplement`): Sam's authored sheet first, the load classifier
only where he has not answered, and an OR-GROUP resolved against the EFFECTIVE
kit for that date. `src/data/cueImplement.ts` records which implement each
authored cue assumes and `cueForImplement` SUPPRESSES a cue written for a
different one. **`EXERCISE_CUES` is untouched** — it is equality-gated to Sam's
master sheet, which is exactly what stops a dumbbell RDL cue being invented.
**GUARDED:** `test:visible-surfaces` section [6], 10 cells (in `test:bible`),
including a COVERAGE GATE that re-runs the implement-word scan over the whole cue
library and reds on any naming cue missing from the table — it caught three the
audit had missed. Mutations **M5** (cue stops checking the implement) and **M6**
(the OR-GROUP ignores the kit) both red, printing *"bar slides down leg"*
verbatim.
**AND IT IS PROVEN ON GLASS**, which is what this row needs and prose could not
give it: `.maestro/visible/implement-and-cues.yaml`, 20 steps green on a booted
simulator serving this branch (metro-url asserted, never assumed). Screenshots
`artifacts/visible/r104-before-barbell.png` (`RDLs 3 x 3 · Barbell`, Form cues
present) and `r104-after-dumbbells.png` (`RDLs 3 x 3 · Dumbbells`, **Form cues
row absent on that row and present on every other**). The flow also asserts the
SENTENCE is gone, not merely an id.
**⚠ THE LOAD IS DELIBERATELY UNCHANGED AT 90kg** across that switch — Sam's own
ruling: *"do not split load history by implement … the athlete can edit it."*
**THE AUDIT THAT SIZED IT, in `docs/STATUS_VISIBLE.md`:** of 132 authored requirements exactly **1** is
explicitly disjunctive (`RDLs`/`Romanian Deadlift` = barbell OR dumbbells), but
**46** loadable pool rows name no implement and on **14** of them the authored
sheet and `equipmentClassFor` DISAGREE (`Single-Leg RDL` authored barbell,
loaded as a dumbbell; four pulldowns authored machine, classed cable). **No
field anywhere states the implement selected.**
**THE CUE FAILURE IS REACHABLE TODAY:** `'RDLs'` carries *"Push hips back, BAR
slides down leg"* and cues are keyed by NAME only — so an athlete who unticks the
barbell keeps `RDLs` (legally, on dumbbells) and is still told to slide a bar
down their leg.

---

## R-105 — THE WEEKLY-REDUCTION PROMPT BELONGS TO THE COACH, NOT THE DAY PAGE

**Sam, 2026-08-19, seeing it on the Program screen in a simulator screenshot:**
*"This should not be popping up on the main page - it should show up in the
coaches chat with a notification"*.

The card in question is the completion-shortfall offer — *"You have been
completing about 0 of your 5 planned sessions. Would a smaller weekly program fit
your life better?"* with `4 / 3 / 2 sessions a week` and `Keep it as is` — which
today renders inline on the Day/Program screen beneath the change card.

**THE RULING.** It moves to the **coach chat**, and its arrival is announced by a
**notification**. It does not render on the Program screen.

**WHY THIS IS THE SAME RULING AS THE UNDO SURFACE ONE (2026-08-09), NOT A NEW
PREFERENCE.** `docs/UNDO_SURFACE_RULING_2026-08-09.md` already records Sam's
architecture in his own words — *"the coach should be its own tab and the athlete
just talks to it when it wants to change something"* — and
`docs/LFA_PRODUCT_ARCHITECTURE.md` names the coach conversation as the athlete's
change interface. A multiple-choice program negotiation sitting on the Day page
is a **second change-interface beside the recorded one**, which is exactly what
that ruling killed the standing bar and the confirm sheet for. **A surface that
asks the athlete to renegotiate their week is change-talk by definition.**

**⚠ THIS ID IS USED TWICE, AND SAM HAS RULED WHICH ROW KEEPS IT — 2026-08-20:**
*"The weekly-reduction ruling keeps R-105. The duplicate power-pool ruling must
receive the next unused ruling id during integration, after all concurrent
branches are present."* **THIS ROW KEEPS `R-105`.** **The power-pool row below
is now `R-118`**, renumbered by the integrator on 2026-08-20 once every
concurrent branch was in one tree and the combined registry had been counted.
Grep for the SEARCH WORDS, not the number.

· **`BUILT` 2026-08-20 by seat `finish-coach-product`** —
`rules/weeklyCommitmentConversation.ts` (the one derivation, moved out of
`screens/home/useBlockBoundaryPrompts.ts`), `rules/commitmentChangePreview.ts`
(the preview), `screens/coach/useCoachWeeklyCommitment.ts` (the Coach hook and
the derived notification), `components/CommitmentCard.tsx`,
`screens/coach/CoachTabScreen.tsx` (the bubbles and the footer card) and
`navigation/AppNavigator.tsx` (the tab dot). **Guarded by
`test:coach-weekly-reduction`** (62 assertions, in `test:bible`), which walks two
real athletes through the production doors and compares what the athlete was
SHOWN against what ARRIVED. Thirteen mutations, twelve seen red.

**THE PROGRAM SURFACE NO LONGER DERIVES IT AT ALL**, which is what makes the
ruling structural rather than a render that was switched off: the two derive
functions and the two card components are gone from
`screens/home/`, so the Day page cannot raise the offer again without importing
a module it no longer imports.

**HOW THE TWO OPEN QUESTIONS WERE ANSWERED, AND THEY ARE FOR SAM TO CONFIRM:**

- **THE NOTIFICATION IS A DERIVED COACH-TAB DOT, NOT THE COACH-UPDATE
  MECHANISM.** `coachUpdatesStore` is a PROGRAM-TAB card whose only writer is the
  frozen `CoachScreen` — using it would have put the conversation's arrival back
  on the surface this ruling removes it from, and it would have STORED a
  derivation, which R-099 refuses in as many words. So `hasNotification` is
  `conversation !== null`, computed from the same facts in the same pass: no
  unread flag, no counter, nothing to clear, and a relaunch cannot resurrect a
  notification for an answered question.
- **THE OFFER DOES NOT EXPIRE, BECAUSE THERE IS NOTHING TO EXPIRE.** It is
  re-derived from the facts every time; it stops being put when the athlete
  answers (the ledger entry) or when the facts stop supporting it. A dated expiry
  would be new stored state for a question that is not stored.

**AND ONE THING THE RULING DID NOT ANTICIPATE, FOUND BY BUILDING IT, THEN RULED
BY SAM ON 2026-08-20:** *"If the scheduler cannot actually place the additional
session safely, do not offer it. The in-season Saturday-game athlete should
receive no fourth-session offer unless the regenerated program genuinely contains
it."*

An offer gated on legality alone would have promised a session generation will
not place. Measured on a real walked in-season athlete with a Saturday game —
legal at four days, and the same two gym days either way (`[1,3]` and `[1,3]`).
**The rebuild is the last gate**, which is exactly what he ruled, and it was
already built when he ruled it. Registry row
`LAW-an-offer-the-rebuild-will-not-keep-is-not-put`, guarded by
`test:coach-weekly-reduction` section [10] — a second real athlete, cold-started
and walked, whose every CHEAP gate opens and whose refusal names the REBUILD.

**⚠ SAM ALSO RULED WHAT THE APP MUST NOT DO ABOUT THE LOADS — 2026-08-20:** *"Do
not add a warning saying 60 of 90 loads may move. That is a transaction defect,
not intended product behaviour. Existing exercises must retain progression from
their own history; new exercises use their own history or authored starting
estimate."* **The preview therefore claims STRUCTURE and never loads**, and no
warning was added. The defect itself belongs to the settings/persistence lane:
`docs/PROFILE_CHANGE_DOUBLE_REGENERATION_HANDOFF_2026-08-20.md`. **A warning
would have been the app apologising for a defect instead of fixing it**, and
recording it as intended behaviour is how a defect becomes a feature.

**THE SEVEN COACH SENTENCES ARE SIGNED — Sam, 2026-08-20:** *"I approve all seven
proposed Coach sentences exactly as written."* Every one carries
`source: 'sam_ruling'` and that provenance in `rules/projectionCopy.ts`; the
words are unchanged from the draft he approved.

**Search words:** weekly reduction, smaller weekly program, completing 0 of 5,
coach notification, coach chat, extra session offer, optional session preview,
add one session, keep it as is, program page card, day page popup, tab badge.

---

**⚠ RENUMBERED `R-105` -> `R-118` BY THE INTEGRATOR, 2026-08-20.** Sam ruled on
2026-08-20: *"The weekly-reduction ruling keeps R-105. The duplicate power-pool
ruling must receive the next unused ruling id during integration, after all
concurrent branches are present."* All concurrent branches are now in one tree —
Settings `88f17e2c`, Injury `da545333` and Product/Coach `18968818` — the
combined registry was counted in both row formats, and `R-118` is the first id
no tree uses (`R-114`/`R-115` went to Injury, `R-119` to Settings' combined-day
ruling). **Anything citing `R-105` for the POWER-POOL ruling means this row.**

**R-118** · *"Choose (c). Add more legitimate no-equipment explosive upper-body
options. Until that pool exists, skip the power component rather than prescribe
the identical exercise twice."* (Sam, 2026-08-20, answering `orchestrator`) ·
**ONE EXERCISE APPEARS ONCE PER SESSION, AND POWER IS THE SIDE THAT GIVES WAY.**

Measured across the 180-world corpus on 2026-08-19: letting the power
specialist's budget reach the composer delivered **32 sessions prescribing one
exercise twice** — `Explosive Push-up` as Power and the same movement as
Strength, on the same day. **Every one was a `Bodyweight Only` world**, because
`Explosive Push-up` was the **only** `upper` entry in `POWER_EXERCISE_POOL` and
is also a legal bodyweight push. Full Gym and Dumbbells produced zero.

**TWO PARTS, AND THE SECOND IS THE FLOOR UNDER THE FIRST.**

- **THE POOL GROWS.** More legal zero-equipment explosive upper-body movements,
  so a non-colliding option exists. **This is the real fix** — a pool with one
  member for a whole family is the defect.
- **UNTIL THEN, THE PRIMER IS SKIPPED.** Power is the fence-exempt extra — not a
  hard exposure, not main strength, no conditioning credit — so dropping it
  costs the week no exposure it is owed. The strength row is the session's real
  work and cannot be dropped.

⚠ **"SKIP" IS THE FALLBACK, NOT THE DESIGN.** A future hand that finds the skip
and treats it as the intended behaviour has read half the ruling. It fires only
when the pool has nothing else to offer, and every pool entry added makes it
fire less.

· `BUILT` — pool: `rules/powerExercisePool.ts`; skip:
`rules/materialiseComposedWeek.ts`, held by `test:power-primer-policy`
(`generatedPowerDeliveryTests` collision cells) and re-measured by
`scripts/run-programming-release-matrix.ts`.

---

**R-106** · *"It is one training day containing two separate components: one
strength session and one conditioning session. Count and assess each component
separately, but do not call it two training days."* (Sam, 2026-08-20, answering
`orchestrator`) · **A COMBINED DAY IS ONE DAY AND TWO COMPONENTS. IT IS NOT
AMBIGUOUS AND IT IS NOT DISCARDED.**

**THIS SETTLES A CONFLICT BETWEEN TWO LIVE AUTHORITIES**, which is why the
Journey candidate was held. The 2026-08-18 production change at `56eff993`
counts separately-answered combined strength and conditioning components — and
that is the only way the extra-session offer becomes reachable at all. Three
cells of `test:block-two-ladder` still required combined days to be **discarded
as ambiguous**. Both could not be right.

**SAM'S ANSWER IS THE PRODUCTION CHANGE, NOT THE GUARD.** The three cells are
obsolete and are rewritten to the ruling; the production behaviour stands.

**THE TWO HALVES ARE BOTH LOAD-BEARING:**

- **SEPARATELY** — a brutal conditioning answer must not make the STRENGTH
  quality read hard, and vice versa. The athlete answered about one component.
- **ONE DAY** — day counts, session counts and "did they train" read ONE.
  Counting it twice inflates every weekly total the athlete is assessed on.

· `BUILT` — `test:block-two-ladder` combined-day section; production owner
unchanged at `56eff993`. **Supersedes the discard-as-ambiguous reading; the
older R-101 text describing that reading is superseded on this point only.**

---

**R-107** · *"Keep the athlete on the current screen. Undo must appear on
whichever screen initiated the change, including inside the active session. Do
not send them back to the Day page."* (Sam, 2026-08-20, answering
`orchestrator`) · **UNDO FOLLOWS THE ACTION, NOT THE SCREEN THAT HAPPENS TO OWN
THE TOAST.**

**THIS AMENDS THE 2026-08-09 UNDO SURFACE RULING'S "ONE MOUNT" CLAUSE, AND ONLY
THAT CLAUSE.** `docs/UNDO_SURFACE_RULING_2026-08-09.md` killed the standing bar
and the confirm sheet because they built a second change-interface beside the
coach. **That reasoning is untouched.** What is amended is the implementation
note that the transient toast *"mounts once, on the Program screen"* — a
one-mount rule that, once the five labelled changes moved into the session
screen, meant every session-screen change raised its toast on the screen BEHIND
it, where its six-second life expired unseen.

**IT IS STILL ONE TOAST, WITH ONE OWNER AND ONE LEDGER.** The component, its
copy, its ledger read and its one-step semantics are unchanged. What changes is
that the surface the athlete acted on is the surface it appears on, and **at
most one is ever visible**, because a screen renders it only while it is the
focused one.

⚠ **AND THE ATHLETE IS NOT MOVED.** The rejected alternative was navigating back
to the Day page after a session change so the existing mount could be reached.
Sam refused it outright: a change made inside a session must not eject the
athlete from that session.

· `BUILT` — `components/UndoToast` + its mounts, held by
`test:undo-reversal` / `test:session-change-hub`.

---

**R-108** · *"Delete the obsolete Coach keyword/escalation authority rather than
patching phrases around it. Coach responses must come from canonical
injury/readiness facts and Sam-approved wording — not words such as 'breathless'
or 'cannot walk' taken out of context."* (Sam, 2026-08-20, answering
`orchestrator`) · **A COACH REPLY ABOUT THE ATHLETE'S BODY COMES FROM A STORED
FACT AND SIGNED WORDS, OR IT DOES NOT EXIST.**

**WHAT WAS DELETED:** `RED_FLAG_URGENT_MEDICAL_REPLY`,
`RED_FLAG_PHYSIO_MEDICAL_REPLY`, 21 regex patterns, `detectRedFlagSymptoms`,
`RedFlagDetection`, the guard's `red_flag_hard_stop` branch and kind, the
engine's bail-out, the screen's suppression branch — **and the embedded mirror
of all of it in `supabase/functions/coach-chat/index.ts`.**

**MEASURED BEFORE DELETION**, with the real function and an EMPTY accepted-injury
set, so it reached every athlete regardless of what the app knew about them:

| typed | answered |
| --- | --- |
| "I cannot walk after leg day" | *"Stop training now … needs a physio or medical assessment"* |
| "The tempo run left me breathless" | *"… call emergency services if symptoms are severe"* |
| "My hands went numb on the bar" | *"… call emergency services"* |
| "I was a bit dizzy after the sprints" | *"… call emergency services"* |

Ordinary post-leg-day soreness answered with a medical hard stop, in words that
were never in the signed sheet — **the highest-stakes copy in the app, selected
by matching a word against a sentence with no reference to a single stored
fact.**

⚠ **THIS IS A DELETION, NOT A NARROWER REGEX, AND THAT IS THE RULING.** A
pattern list cannot tell a symptom from a figure of speech; editing the phrases
moves the false positives, it does not remove them. Sam's instruction names that
explicitly — *"rather than patching phrases around it"*.

⚠ **BOTH HALVES WENT TOGETHER.** The edge function cannot import from `src/`, so
it carried its own copy under a `KEEP IN SYNC` note. Deleting only the client is
how the defect returns: the next reader finds the server still escalating and
restores the client to match.

**WHAT SURVIVES, AND WHY IT IS NOT THE SAME THING.** The severity clarifier
(*"How bad is it? Rough pain out of 10."*) is a QUESTION drawn from the injury
vocabulary; what was deleted was an ANSWER — medical instruction. The readiness
path is untouched: a poor-sleep fatigue constraint still reduces the session and
still leaves the game and team-training anchors alone, because that decision is
made from a stored fact.

· `BUILT` — `test:injury-guard` `[0]` and `test:injury-client-guard` `[0]`, both
**INVERTED rather than deleted** (`gate-must-watch-the-deleted-surface`): they
keep the exact sentences as coordinates that must never again produce medical
copy, each behind a CONTROL proving the clarifier still fires. The client suite
also reads BOTH sources and fails if the words or the detector reappear in
either.

---

**R-109** · *"Then fix the six accessibility labels so athletes hear exercise
names, not internal IDs."* (Sam, 2026-08-20) · **A ROW SPEAKS THE ATHLETE'S
WORD. THE TEST ID IS AN ADDRESS, NOT A NAME.**

Six sheet-row components set `accessibilityLabel={testID}` on an
`accessibilityRole="button"` Pressable. That role makes the row ONE accessibility
leaf, so the label is the WHOLE of what a screen-reader user hears — and on the
Remove picker that was
`component-delete-action-dev-e2e-standard-in-season-week-2026-07-13-dow-1-…-ex-squat-1`
where the screen plainly reads **"Back Squat"**.

⚠ **IT WAS DELIBERATE AND GUARDED, WHICH IS WHY IT NEEDED A RULING AND NOT A
PATCH.** Three cells of `test:accessibility-contracts` REQUIRED it, titled
*"expose their stable identity to accessibility"*. Sam's ruling overturns those
three; they are inverted, not deleted.

**NOTHING LOSES ITS ADDRESS.** `testID` sets `accessibilityIdentifier`, which is
what Maestro's `id:` and the explorer match on; only the spoken name changes.
Proven on glass the same day — `id: "session-change-remove"` resolves while that
component's label is the word "Remove" — and asserted by a cell that all three
components still carry `testID`, so a "fix" that deleted the id would not pass.

**THE SIX:** `EquipmentLimitationSheet.MissingToggle`, `HomeScreenV2.SheetOption`,
`PlanChangeSheet`, `GuidedInjuryFlowSheet.FlowOption`,
`DayWorkoutScreenV2.ExerciseSheetOption`, `dev/StoredStateExportButton`.

· `BUILT` — `test:accessibility-contracts` section [5], inverted to require the
LABEL and to prove the id survives.

---

**R-110** · *"Power belongs inside the Strength section, generally as its first
row. Remove the separate POWER / PRIMER section from the athlete-facing screen.
A session with one power row and four other strength rows displays Strength 0/5.
Preserve power's internal role and programming logic; change its
projection/grouping and order only. Without power, Strength begins with the main
lift as usual."* (Sam, 2026-08-20) · **POWER IS A STRENGTH ROW, NOT A SECTION.**

The Session screen opened a `Power / Primer` disclosure above `Strength`, so a
day of one power row and five strength rows read **`Power / Primer 0/1` +
`Strength 0/5`** — two counters for one block of work the athlete does in one
go, and a collapsed section hiding a single exercise. It now reads **`Strength
0/6`, opening with the power row.**

⚠ **THE SECTION IS DELETED, NOT HIDDEN.** `'power'` is gone from
`SessionExecutionSectionId`, from `SECTION_LABELS` and from `SECTION_ORDER` —
declarations, not merely an unused branch — so no future reader can route a row
back into a section that no longer exists.

⚠ **POWER'S PROGRAMMING IS UNTOUCHED, AND THAT IS ASSERTED, NOT ASSUMED.**
`role: 'power'` still rides every row; `getSessionComponents` still emits the
typed `power` component with its own `completionPolicy`; the row still carries
`componentId: 'power'`; every §18 counter, budget and policy still reads
`powerRows()`. Only the disclosure it is projected into changed. A cell requires
the component and the row's attachment to it, so a "fix" that got the display
right by deleting power's identity fails.

⚠ **AND NO SECOND ORDERING AUTHORITY WAS CREATED.** An `orderSectionItems`
partition that hoisted power inside the projection was written and then
**DELETED**: mutating it to a no-op reddened not one cell, because
`sessionTemplate`'s `d2Rank` (`SESSION_ROLE_ORDER`: power → main → accessory →
midline/prehab) has always owned that order and the section filter preserves it.
A second sort agreeing with the first is a rival authority nothing can tell apart
when they disagree. The property is held end to end instead: a fixture that
authors power LAST still projects it first.

✅ **THE DAY CARD IS INCLUDED — ANSWERED THE SAME DAY, IN THIS SAME TASK.** The
first pass changed the Session screen only and left the Program tab's day card
listing `POWER — 1 exercise` as its own timeline row, on the grounds that it is
a different owner (`rules/dayTimeline` over `projectDayDetail`'s typed PARTS).
**Sam: *"Merge POWER into Strength on the Program tab's Day summary card too. No
separate POWER row. Strength's count includes the power exercise. If Strength is
expanded, power appears first. Tapping Strength opens the combined strength
work. Preserve power's internal role for programming, counting and progression.
This is the same athlete-facing ruling, not a new programming decision."*** So it
is recorded here rather than as a new row.

**THE PROJECTION ALREADY AGREED AND ONLY HALF-ACTED.** `PART_BUCKET_KIND` mapped
`power -> strength` so no day could be TITLED "Power" (Sam, 2026-08-08: *"power
is just part of the Strength work"*) — and then listed power as its own row
underneath that title. The bucket ruling now reaches the parts list:
`COMPONENT_TO_PART` maps the power COMPONENT to a strength PART, `partsForWorkout`
does not mint a second strength part, and `composeDayDetail` merges the two row
populations BEFORE `orderRowsAsSessionPresents` so the session template places
one list and power leads by D2's authored order rather than by a second sort.
The `power` member of `VisiblePartKind` is DELETED, so the compiler found every
table that had to answer for it.

⚠ **A POWER-ONLY SESSION KEEPS ITS PART.** The fold happens only when a strength
component exists to fold into; a day of power work and no strength rows would
otherwise lose its only content off every surface — the class
`visibleDayDetail`'s *"every part, in order, always"* rule exists to prevent. It
reads "Strength", which is what the session screen calls it too.

⚠ **AND IT IS NOT A DEDUPE BY KIND.** `COMPONENT_TO_PART` is many-to-one in
three places (conditioning/finisher, session/strength, recovery/recovery_addon)
and those pairs carry DIFFERENT rows that must both render. Only power/strength
merges, because only its rows are re-filed into the survivor.

**COUNTING IS UNCHANGED, AND THAT IS ASSERTED WHERE A REAL WORLD EXISTS.**
`PART_COUNTS_TOWARD_LOAD` said `power: true` and `strength: true`, so a power row
inside a strength part counts exactly as before. The word `power` had to leave
two table-lookup cells with the kind; the CLAIM moved rather than vanishing, to
`test:power-primer-policy` over a projected week that actually contains power
days.

**FIVE GUARDS WERE INVERTED, NOT DELETED** — every one of them required the old
shape: the day-card cell that asserted a day LEADS with a power part and that the
timeline NAMES it; the bucket-dedupe cell whose only exhibit was the
power+strength day; the `parts.length === components.length` law in
`test:projection-ownership`; the power-delivery cell that counted one power PART
per power row; and the walker's L-P3 rows-conservation table, which is owed
power's rows under Strength now. The last was found by measurement, not by
reading: it reported *"a strength part with 4 rows while the day has 3 authored
ones"*.

**FIXED IN PASSING, AND SAID SO:** `test:day-first-timeline`'s power cell was
ALSO red at HEAD for a reason unrelated to power — it asserted
`title === "Strength"` from before the compound-title ruling, so the exhibit day
legitimately read "Strength + Team Training".

**PROVEN ON GLASS, BOTH SURFACES, ONE DAY, 2026-08-20.** Day summary card:
**`STRENGTH — 6 exercises`**, no POWER row, expanding to Vertical Jump, Back
Squat, RDLs, Single-Leg RDL, Band Pallof Press, Cossack Squat. Session screen,
same day: **`STRENGTH 0/6`**, same six, same order.

· `BUILT` — `test:session-execution` section `[7]`, non-vacuity control first
and mutation-proven: routing power away from Strength reds 7 cells, and the
deleted sort has its own cell forbidding a new one. Day card:
`test:day-first-timeline` (*"POWER is not a part — a day's power work sits inside
Strength, first"*), `test:power-primer-policy` (+3 cells, including the load
count and a non-vacuity control) and `test:projection-ownership`. Mutation-proven
three ways: un-folding the part reds 4, dropping power's rows reds 3, ordering
power last reds 2.

**MEASURED AT BOTH ENDS:** 66 suites — every one reading the projection, the
composition, the timeline or either screen — run before and after, comparing
failure NAMES. **One line of difference in the whole set, and it is a failure
REMOVED.** `test:compile` byte-identical at 671 errors / 77 worse pairs, product
scope unmoved at 30.

---

**R-111** · *"Put the play/demo button immediately beside the exercise name. Put
the completion checkbox at the far right where the play button currently sits.
Keep sets/reps on the lower left and weight controls on the lower right. Apply
consistently to Mobility, Power and Strength rows. Preserve completion
behaviour, video behaviour and accessible exercise-name labels."* (Sam,
2026-08-20) · **THE DEMO BELONGS TO THE NAME; THE RIGHT EDGE BELONGS TO THE
STATE.**

The two controls had swapped jobs by accident of layout. Play sat at the far
right of the header row — the end of a list row, which is where a list keeps its
state — while the checkbox led the row, vertically centred against the WHOLE
card, so on an expanded Strength row it sat level with the weight stepper rather
than with anything it referred to. A row now reads **name → demo → … → done**,
left to right.

⚠ **BOTH ARE MOVES, NOT REBUILDS.** Same `onPlay` handler and the same
`Play <name> demo` label on both the name and the button; same
`onToggle(itemId)`, `accessibilityRole="checkbox"`, checked state, spoken label
and `session-execution-check-…` identity, so every flow that ticks a row keeps
finding it. Sets/reps and the weight control did not move at all.

⚠ **"CONSISTENTLY" NEEDED NO PER-SURFACE WORK.** Mobility, Power and Strength
rows already reach ONE header (`ExerciseHeaderRow`) and ONE checklist wrapper
(`ExecutionChecklistItem`); both changes are in those two components, and a cell
requires there be exactly one of each, so a fourth arrangement cannot appear
without a new component.

⚠ **ONE PRIOR GUARD REQUIRED THE OLD PLACEMENT AND IS INVERTED, NOT DELETED**
(`gate-must-watch-the-deleted-surface`). *"Every checkbox is centred against its
complete exercise row"* demanded `alignItems: 'center'` and NO `marginTop` — the
exact two things the ruled placement needs. Same coordinates, now naming the
ruled arrangement.

**PROVEN ON GLASS, 2026-08-20**, `standard-in-season-week` on iPhone 17 Pro:
Strength expanded with power (`0/6`, Vertical Jump first) and without it (`0/5`,
Back Squat first) after a real Remove through the athlete's own door; Mobility
expanded; a tick moved the counter `0/6 → 1/6` and dulled the row; the relocated
play button opened the Back Squat demo.

· `BUILT` — `test:session-execution` section `[7]`, mutation-proven: returning
the checkbox to the left reds 1, returning play to the far right reds 2,
re-centring the row reds the inverted cell — and nothing else in either case.

---

**R-112** · *"Do NOT build a seven-exercise enforcement gate. My programming rule
is that exercise count itself is not the authority; balanced movement coverage
and the 16-set ceiling are. Record the unused `7` as dead authority for deletion
during the upcoming hinge-taxonomy cleanup, after confirming it has zero live
readers."* (Sam, 2026-08-20) · **EXERCISE COUNT IS NOT AN AUTHORITY, AND THE
NUMBER THAT PRETENDED TO BE ONE IS DEAD.**

Raised as a NOT-COVERED finding while closing R-110's counting ambiguity: the
"strength exercise cap" is proven to exclude power **at the counter**, and there
is no live decision that counter feeds. Sam's answer is that the gate should
never be built — **the authority is movement coverage plus the 16-set ceiling,
not a count of rows.**

⚠ **THE DEAD AUTHORITY IS THREE LAYERS DEEP, AND THE COMMENT DESCRIBING IT IS
FALSE.** Confirmed by census, with a positive control (the same greps return
real hits elsewhere):

| symbol | production readers |
| --- | --- |
| `trainingAgePolicy.maxExercisesPerStrengthSession: 7` (R-088) | **0** — two test files only |
| `exerciseBudgetRows` — the counter it would spend | **0** — tests only |
| `AIConstraints.maxExercisesPerSession` | **0**, and it is not even fed by the 7 — `scheduleToCoachingPlan` sets it from `GLOBAL_RULES.dailyMovementCeiling` |

`sessionRowCounting.ts:330` states that the 7 *"flows into
`AIConstraints.maxExercisesPerSession`"*. **It does not.** That sentence is the
kind of claim a later reader would have built enforcement on.

⚠ **NOT DELETED HERE — SAM SCOPED IT TO THE HINGE-TAXONOMY CLEANUP**, and
*"do not start another change in this lane"*. `ROLES_EXEMPT_FROM_THE_CAP` and
`exerciseBudgetRows` are the fence power is exempted BY, so whoever deletes the
number must keep the exemption's meaning or move it — the census above is the
list to work from.

⚠ **R-088 IS NARROWED, NOT OVERTURNED.** Sam ruled the number 7 there; he has
now ruled that **nothing should enforce it**. The number stops being a cap and
becomes an authored description of session size.

· `WRITTEN` — no code changes. The zero-reader census is the receipt;
`test:exercise-cap`'s own non-vacuity cell is red at HEAD for the matching reason
(*"the corpus contains sessions at or near the cap"*).

---

**R-113** · *"'Power appears first' applies only to a standalone power primer.
For valid contrast training, preserve the authored pair at the main slot: heavy
lift → paired explosive movement → rest. The explosive row must appear
immediately after its heavy partner, not at the top of the session. Both remain
inside the single Strength section; there is still no separate Power section …
Do not add another sorting rule. The existing canonical session-template/superset
owner already carries contrast order; the projection must delegate to it."*
(Sam, 2026-08-20) · **A CONTRAST PAIR IS ONE PRESCRIPTION AND KEEPS ITS OWN
ORDER.**

R-110 moved power inside Strength and put it first. That is right for a
STANDALONE primer and wrong for contrast, where the explosive movement is the
second half of a pairing performed at the main slot — *"finish the heavy set,
walk to the power movement, then do it sharply"*.

**THE PAIR WAS ALREADY IN THE DATA AND NOBODY READ IT.**
`powerRowAlignment` stamps `supersetGroup`, `pairType: 'contrast'` and
`supersetOrder` (heavy = 1, explosive = 2) when it forms the pair. The session
template clustered the group but ordered its MEMBERS by the workout's stored
array order — where the power row sits first — so both surfaces rendered
**explosive → heavy**, the exact reverse of the prescription. `supersetOrder` had
one reader in the whole app: the `1a`/`1b` letter.

⚠ **NO SECOND SORTING RULE WAS ADDED, WHICH WAS THE INSTRUCTION.**
`sessionTemplate.inPairOrder` READS the field the pairing owner already writes,
inside the canonical owner. The day card delegates through
`orderRowsAsSessionPresents`, so **one owner fixed both surfaces at once** — and
a cell proves the two cannot drift.

**ZERO BLAST RADIUS, MEASURED BEFORE IT WAS WRITTEN:** across generated
Off/Pre/In-season worlds at three experience levels, **zero superset groups of
two or more reach a generated program at all**, so nothing an athlete can see
today moves.

⚠⚠ **AND THE REASON FOR THAT ZERO IS A FINDING SAM SHOULD RULE ON.**
**384 contrast power rows over 48 generated Off-season worlds; 0 paired; 384
downgraded**, every one `no_heavy_same_family_main_lift`. Two rules never meet:
`powerPrimerPolicy` returns `kind: 'contrast'` only in LATE OFF-SEASON (the
pre-season route needs `powerGoalNudge`, hardcoded `false` at both production
call sites), while `powerRowAlignment`'s heavy test requires
`prescribedRepsMax <= 6` — and the lowest rep range off-season strength work
carries is `6-8`. **Section 4's contrast rule is prescribed and then always
cancelled.** NOT FIXED — *"do not start another change in this lane"*.

· `BUILT` — `test:power-primer-policy` section `[9]`, 14 cells over a pairing
formed by the REAL `powerRowAlignment` owner on a REAL generated contrast day,
with exactly one declared override (the partner's rep range) and a control cell
proving the unpaired result without it. Mutation-proven four ways: neutralising
`inPairOrder` reds the two placement cells; stripping `supersetOrder`, breaking
the group, and reversing the pair each move the order, and the day card moves
identically every time. The prior "power first" cells in
`test:session-execution`, `test:day-first-timeline` and
`test:power-primer-policy` are **NARROWED to standalone primers**, each with a
control that reds if its world stops being all-primer.

---

**R-114** · *"At 6-7/10, the typed injury-risk sheet wins. Never offer Hip
Thrust—or any exercise—the sheet marks risky for that injured area, even if an
older example says otherwise. Walk down the ladder to the nearest legal option;
if none exists, omit honestly. Update or remove the contradictory example so
there is one authority."* (2026-08-20) · **THE INJURY SHEET OUTRANKS THE BIBLE'S
NAMED SWAP EXAMPLES.**
**Search words:** hip thrust knee, chest supported row shoulder, caution rating,
6-7 band, which authority wins, contradictory swap example, sheet vs bible.
**WHY IT WAS ORDERED:** two things Sam authored disagreed. His knee section says
*"Heavy knee-dominant work -> hip thrust"* and his shoulder section says *"some
pulling if tolerated"*, while his ruled injury matrix (2026-07-28) rates
`Hip Thrusts` `knee: 'caution'` and `Chest Supported Row` `shoulder: 'caution'`,
and his 6-7 band removes risky work through the area. Three
`test:tap-swap-hierarchy` cells had been RED on `main` ever since the matrix
landed, because the code followed the matrix and the cells followed the prose.
**A READING THAT WOULD HAVE RECONCILED THEM WAS TRIED AND REFUTED BY
MEASUREMENT** — admitting `caution` work at 6-7 unless it is heavy shipped three
of Sam's own bad swaps (`Broad Jumps` for a 7/10 knee, `Single-Leg RDL` for a
7/10 hamstring, `Close Grip Bench` for a 6/10 shoulder) and took that suite from
3 fails to 8.
· `WORKING` — `injuryPermitsExerciseAtSeverity` (`rules/injuryExerciseRisk.ts`)
is the one owner of the band question and was already correct; the RULING
retired the rival authority. The Bible now carries a **WHICH AUTHORITY WINS**
paragraph in Section 8 naming the precedence, anchored to that function through
`bibleThresholdAnchors.injury_sheet_outranks_swap_examples`, so
`test:bible-coverage` holds the new rule line to a named enforcer rather than
counting it as debt. The three contradictory cells now assert the ruling.
**GUARDED:** `test:tap-swap-hierarchy` — **16 ok / 3 fail and DYING on `main`
-> 25 passed, 0 failed, running to completion** (its last fixture omitted both
capacity answers, so `resolveTapSwapEnvironment` threw and the final cells never
ran). Mutation **M17** — the sheet stops outranking the examples — reds 6.

---

**R-115** · *"An 8-10 injury with serious symptoms must NEVER write into the
athlete's Remove list or permanently alter the accepted program. Preserve the
original exercises. On that date, show them as unavailable/skip with the
explicit injury safety explanation, or block the session if necessary. Clearing
or resolving the injury must immediately reveal the original accepted session
again, including after close/reopen. Remove remains exclusively athlete-authored
Remove."* (2026-08-20) · **AN INJURY WITHHOLDS A ROW; IT DOES NOT REMOVE ONE.**
**Search words:** injury omission, red flag, serious symptoms, empty session,
remove list, exclusions written by injury, session cannot be completed,
unavailable row, injury restore.
**WHY IT WAS ORDERED, MEASURED:** an injury omission was written through
`remove_exercise`, whose `today_only` scope lands in
`athletePreferencesStore.exclusions` — the athlete's OWN decisions. A red-flag
hamstring at 9/10 wrote **five exclusions the athlete never made**, and because
Restore works by RE-DERIVING it replayed them, so `clear_injury_modifier`
answered *"Injury resolved. Affected sessions were safely recomposed."* over a
day that was **empty forever**.
· `WORKING` — `rules/injuryWithheldRows.ts` is the owner. Nothing is written:
`InjuryEpisodeV1` is already a `TemporarySourceFact` and
`ScheduleState.temporarySourceFacts` is already fed by the two VIEW doors, so
the withholding is a PURE DERIVATION applied at the same seam
`applyExclusionsToAuthoredDay` sits at — and for the same stated reason, that a
projection reaching a canonicaliser gets written down. The two projections sit
side by side and do opposite things on purpose: an exclusion FILTERS a row out,
an injury MARKS it (`WorkoutExercise.unavailableForInjury`). The refusal to
record the day lands in `sessionOutcomeRecordableRefusal`, which already had two
readers — the write door and `SessionFeedbackPanel` — so the UI needs no change
to honour the ruling. **Only a RED FLAG blocks**; an ordinary injury substitutes
and the athlete trains.
**GUARDED:** `test:injury-fallback-journey` sections [10] and [11], 27 cells,
driven end to end through the real doors. Mutations **M12** (the omission writes
a Remove decision again) reds 6, **M13** (rows stop being marked) reds 1,
**M14** (the day becomes recordable) reds 1, **M15** (an ordinary injury blocks
too) reds 3, **M16** (an injury reaches back before its onset) reds 1.
**⚠ HEADLESS, NOT GLASS — the device check is owed**, and
`npm run seed:injury-fallback` prints the exact expected glass state.
**⚠ ONE THING THE UI LANE STILL OWNS:** `projectVisibleDay` BLANKS the day
outright while a red-flag constraint is active — measured identically on `main`
`9f081efa`, so it predates this unit. Sam's ruling permits blocking the session,
so nothing here fights it, but *"show them as unavailable/skip"* is only half
delivered until that projection renders the marked rows.

---

**R-116** · *"Use Sam's attached mock only as a layout reference. Do not add the
athlete photo, change the app's typeface, or introduce separate cards around
every exercise … Add the approved calendar icon immediately before the date …
a distinct approved icon beside each section heading … Tighten each exercise
row: exercise name with Play immediately beside it, sets × reps directly below,
Form cues directly below that. Remove the excessive vertical gaps … Move the
checkbox onto the SAME horizontal control line as the weight stepper, positioned
immediately to its right. **This supersedes the earlier ruling that placed the
checkbox level with the exercise name.** Rows without a weight stepper still
reserve the same right-side control position … Power is visually an ordinary
Strength row. Remove its unique visible rest line (`2:00 rest`)."* (Sam,
2026-08-20) · **LOAD AND DONE ARE ONE MOVEMENT OF THE HAND.**

⚠ **R-111's CHECKBOX CLAUSE IS SUPERSEDED, EXPLICITLY AND BY NAME.** R-111 moved
the tick from the row's left edge to the far right of the NAME line. Sam has now
moved it again, onto the control row beside the stepper. **Only that clause
falls** — R-111's other half, *"the play/demo button immediately beside the
exercise name"*, is untouched and still guarded. The cell that asserted the tick
was the row's last child is INVERTED, not deleted, and its replacement is
stricter: it pins the checkbox's position RELATIVE TO THE STEPPER, which is what
this ruling actually says, rather than relative to the row.

**THE CHECKBOX CHANGED OWNER, NOT IDENTITY.** `ExecutionChecklistItem` still
mints exactly one checkbox — same handler, role, checked state, spoken label and
`session-execution-check-…` id — and now HANDS IT DOWN to the card, because only
the card knows where its stepper is. One checkbox in the app, placed by the only
component that can place it.

⚠ **A ROW WITHOUT A STEPPER RESERVES THE SLOT ANYWAY.** Fixed-width, so the tick
column cannot wander between a loaded row and a bodyweight one in the same
session — his words, and the thing a simple `flex-end` would have got wrong.

⚠ **POWER'S REST LINE IS HIDDEN, AND NO PRESCRIPTION IS DELETED.** *"hiding
Power's rest line must not delete its domain prescription."* Power was the only
role whose rest cleared the 90-second display threshold, so that line WAS its
special format. `restSeconds` is untouched on the row, still stored, still
generated, still read — `restLabel` is computed exactly as before and a cell
asserts it. Only the `Text` is role-gated.

**WHAT WAS DELIBERATELY NOT TAKEN FROM THE MOCK:** the athlete photo, the
typeface, and per-exercise cards. Header, black background and visual identity
unchanged.

**ICONS COME FROM THE SET ALREADY ON THIS SCREEN** — no new graphic asset — and
the section map is keyed on the TYPED section id, never the label string. The
Day card already paid for that mistake: `displayLabelIconKind` matches a
rendered NAME against a table of equalities, so a renamed title falls through to
a grey default. The map is PARTIAL on purpose: a section Sam did not name draws
nothing rather than inviting a fourth answer.

· `BUILT` — `test:session-execution` section `[10]`, 24 cells, two non-vacuity
controls. Mutation-proven five ways, each killing exactly one cell: the checkbox
back before the stepper; Power's rest line restored; the calendar icon removed;
Conditioning dropped from the icon table; the row gaps returned to loose.

---

**R-117** · *"The Conditioning screenshot is rejected for both units and copy
quality. Clean the entire athlete-facing Conditioning projection, not only this
one line … The pace must be calculated using `60 / kmh`, rounded to the nearest
second. Do not relabel km/h values as min/km … Remove these athlete-inappropriate
implementation lines … Trace where punctuation is being lost. Fix the shared
structured formatter/projection rather than patching this card with one literal
string. Add a census that renders every authored Conditioning session and fails
on malformed percentage ranges, missing punctuation, internal/debug vocabulary or
incorrect pace units."* (Sam, 2026-08-20) · **THE PROJECTION IS THE COPY.**

Plus, mid-task: *"icon for conditioning should not be amber - keep same grey as
the other logos"* — one line in `components/icons/SectionIcon.rowIconColor`, so
the Day card and the Session screen moved together. `game` keeps its amber; it
is a fixture, not a section the athlete trains through.

**WHAT THE ATHLETE READ BEFORE.** `composeConditioningRows` pasted six authored
FIELDS together with separators. Classic 4×4 arrived as `Rest: 3 min easy jog` /
`Sets: 4 reps` / `90–100% MAS; HR 90–95% max late` / a lower-case cue / and
`All 5 modalities — 4 min is inside the 8 min erg cap; Air Bike is time-native.`
The pace beneath it read `13.5-15 km/h` under the word "pace".

**`rules/conditioningDisplay` IS THE ONE PROJECTION.** Labelled lines, not a
join. The welded intensity field splits into a speed target and a heart-rate
SENTENCE. Authoring parentheticals are removed by MARKER, so `(1 km)` and
`(20+20)` survive and `(Sam's 1:2 ruling)` does not. Comma splices become full
stops — punctuation only, no word added or moved.

⚠ **THE DOSE LABEL COMES FROM THE QUALITY, NOT THE SHEET'S OWN UNIT WORD.**
Measured across all 55 templates, the sheet uses `reps` and `rounds` for
structurally identical doses inside ONE quality — `aerobic_power` holds both
`4 reps` (Classic 4×4) and `8 rounds` (MAS 15:15). Promoting that word printed
`Reps: 4` on Classic 4×4, which is Sam's rejected line wearing a different word.
`QUALITY_DOSE_LABEL` is a total `Record`, so a new quality stops the build.

⚠ **WHERE THE PUNCTUATION WAS ACTUALLY LOST — AND IT WAS NOT THE FORMATTER.**
`dayWorkoutHelpers.cleanNotes` step 2 stripped `[|•–—]` as "orphan separators",
matching a dash with zero whitespace either side. So `90–100% MAS` reached the
glass as `90 100% MAS`, and every em dash Sam wrote into a cue went with it. The
rule was right for the world it was written in — notes were once six fields
pasted with ` – ` between them. `|` and `•` still go; a dash is now the author's.

⚠ **THE FIRST CENSUS WENT 35/35 GREEN WHILE THE SIMULATOR SHOWED `90 100%`.**
It read `conditioningDisplayLines` — one call short of the glass. It now renders
through `cleanNotes` as the screen does. **A census that stops before the
renderer measures the sheets, not what the athlete reads.**

· `WORKING` — `test:conditioning-copy-census`, 35 cells over all 55 authored
templates, 3 non-vacuity controls. It found four templates my own read had
missed. Mutations, each killing the named cells and nothing else: `90 100%`
restored · km/h pace restored · the authoring-note remover stripped (4) ·
every dose relabelled `Sets` (2) · **`cleanNotes`' dash-stripping restored (29
lines, and the eaten em dash manufactured a comma splice)**. One mutation
SURVIVED the first census — the welded `HR … max late` line — and that gap is
now its own cell.

**THE SHEET WAS NOT EDITED.** `conditioningTemplateEquality` proves the module
ships Sam's 2026-07-25 spreadsheet byte for byte; form repairs live in the
projection so it stays green. The one field Sam re-authored in chat is a CITED
override with its own non-vacuity control — editing a snapshot named after a
date would make it a record of nothing. 95/95 → 96/96.

---

**⚠ THIS ROW HAS MOVED TWICE: WRITTEN AS `R-112`, RENUMBERED TO `R-114` BY ITS
OWN SEAT, AND RENUMBERED AGAIN TO `R-119` BY THE INTEGRATOR ON 2026-08-20.**
Seat `finish-settings-persistence` branched from `9f081efa`, where `R-111` was
the last row, and seat `sessionui` landed `R-112` and `R-113` on `main` while
this branch was unmerged, so that seat moved its own unlanded row to `R-114`.
**Seat `finish-injury` independently claimed `R-114` AND `R-115` for a matched
pair on the same day** — the injury-matrix authority and the withholding it
enables — and leaving that pair in place was measured to be the smaller move.
So this row moved once more, to the first id no tree uses. **The landed rows are
untouched; only unlanded rows moved.** Anything citing `R-112` or `R-114` for
the combined-day ruling means this row.

**R-119** · *"A gym session completed on the same date as club training counts
as a completed gym session. It remains one calendar training day with two
components, but each completed component keeps its own credit. Club training
must not erase the completed gym component from the commitment/completion
denominator. Guard both sides of that ratio so generation and later
block-history evaluation use the same component-aware count."* (Sam,
2026-08-20) · **A COMBINED DAY IS ONE DAY WITH TWO COMPONENTS, AND EACH
COMPONENT IS CREDITED SEPARATELY.**

**⚠ THE APP ERASED THE GYM COMPONENT IN THREE PLACES, ALL THE SAME LINE.** A
gym session sharing a date with club training is stored as
`workoutType: 'Team Training'`, while `getSessionComponents` on that very
workout returns `["power","strength","team_training"]` — the app knew the
lifting was there. Three readers asked `workoutType === 'Strength' || 'Mixed'`
and could not see it:
- `strengthLogging.buildStrengthPerformanceLogs:132` returned `[]`, so **the
  athlete's lifts on a club night were never recorded at all** — no load, no set
  count, and nothing for the block boundary to progress those lifts from;
- `readBlockHistory`'s NUMERATOR counts days carrying strength logs, so it missed
  the day as a consequence;
- `deriveAcceptedBlockStrengthRequirement`, the DENOMINATOR, skipped it directly.

**MEASURED BEFORE THE FIX, two worn athletes identical but for where the club
night falls** (cold start through real onboarding, four weeks lived through the
live outcome writer, one real miss): separated club nights **8 required / 7
recorded**; a club night on a gym day **4 required / 4 recorded**, and **0 of 3
club-night dates recorded any lifting**. The ratio was self-consistent, which is
precisely why it survived — nothing looked wrong from either side alone.

**AFTER: both athletes read 8 required / 7 recorded, and 3 of 3 club-night dates
record the lifting.** The separated athlete is unchanged, and their pure club
nights still record nothing, which is correct — those days carry no gym rows.

**THE FIX IS ONE SHARED OWNER, NOT THREE EDITS.**
`sessionComponents.carriesStrengthComponent` asks the component question — does
this day carry gym rows, with `getSessionComponentRows` already separating the
club session from them — and both sides of the ratio call it. A fourth reader
cannot re-invent the `workoutType` answer without deleting the shared one.

**Search words:** club night, team training, combined day, gym on a club night,
completed component, completion denominator, commitment denominator, 75 percent,
attendance, component-aware count, strength logs missing, workoutType gate.

· `BUILT src/utils/sessionComponents.ts carriesStrengthComponent`, read by
`strengthLogging.buildStrengthPerformanceLogs` and
`blockBoundaryProgression.deriveAcceptedBlockStrengthRequirement`. **Guarded by
`test:settings-persistence` stage 5**, which compares the TWO athlete shapes
rather than asserting agreement — an earlier cut asserted only that the two
sides agreed, and they agreed at 4 and 4 on exactly the app this ruling
forbids. Three cells: the club-night lifting is recorded, the same training
earns the same credit, and both sides of the ratio count the same sessions,
each preceded by an anti-vacuity cell. **⚠ NOT SEEN ON GLASS** — another lane
owns the simulator; this is headless.

**R-120** · *"Replace the Active Session Add action's random flat list with the
approved hierarchy: 1. Strength / Conditioning / Mobility-Warm-up. 2. A relevant
subcategory, such as upper/lower/movement pattern. 3. Legal final exercise
choices. Never show athletes a mixed internal list containing options like
'Breathing reset'."* (Sam, 2026-08-20) · **THE ADD MENU IS THREE LEVELS, AND ITS
WORDS ARE THE ATHLETE'S.**

**WHAT THE ATHLETE SAW, MEASURED ON GLASS AND HEADLESSLY.** Add opened one flat
list of the GENERATION PROMPT's own groups — **23 buttons** on a full-kit
off-season athlete: `Lower squat`, `Upper push horizontal`, `Upper pull
vertical`, `Groin / adductors`, `Hamstring (light)`, `Lower prehab`, `Tissue
quality`, `Easy cardio (zone 1)`, `Breathing reset`. The sheet is auto-height
and does not scroll, so on the simulator the list **ran off the top of the
screen past the status bar** and the first ten entries could not be reached at
all. The NAMES behind it were already legal, already equipment- and
injury-filtered, and already the athlete's; it was the MENU that was internal.

**IT NOW READS `Strength (125)` / `Conditioning (94)` / `Mobility / Warm-up
(30)`**, then a subcategory, then the choices.

**⚠ NO NEW TAXONOMY — THREE JOINS ONTO OWNERS THAT ALREADY EXIST.** A fourth
filing of "what kind of work is this" is the rival-authority shape this repo
keeps paying for, so nothing here invents one:
- **The families ARE session sections.** `AddFamilyId` is an `Extract` of
  `SessionExecutionSectionId` and the labels are `SECTION_LABELS` itself, so
  adding under "Conditioning" lands in the section the session screen calls
  Conditioning — and the level-1 glyph is `SESSION_SECTION_ICON_KIND` (R-116's
  one owner), not a lookalike.
- **The strength subcategories ARE the pools.** The join is a new stable
  `VocabularyGroup.id` — the pool key — never the prompt's label text. A
  `label === 'Mobility'` join would break silently the day the prompt is
  reworded.
- **The conditioning subcategories ARE `ConditioningTier`.** Sam's own
  session-intent classification already sorts all 90 formats into A / B-high /
  B-low / C; they render as Sprints & speed, Hard intervals, Tempo & steady,
  Easy & flush.

**`REGISTRY-GREP: R-110`** — *"Power belongs inside the Strength section,
generally as its first row."* It does here too: Power & jumps is Strength's
FIRST subcategory and is not a family of its own, which is the same sentence
applied to a menu. Guarded by name.

**⚠ THE SIX-PER-GROUP CAP IS DELETED, AND THAT IS THE RULING, NOT A LIBERTY.**
Its own stated reason was *"few enough that the sheet is a decision rather than
a catalogue"* — a reason belonging to a screen that showed all 23 groups at
once. The hierarchy is what makes it a decision now, so the cap had nothing left
to do except hide movements: at six an athlete with a full rack could not reach
Dips, Face Pull or the Z-Press at all. `REGISTRY-GREP: R-088` — *"a user should
be able to add as many of their own things on top of it as they choose"*. Level
3 shows every legal choice and SCROLLS, in a `maxHeight` list rather than
`flex: 1`, which would collapse to zero inside an auto-height `Sheet`.

**Search words:** add exercise, add menu, add flow, three levels, hierarchy,
family, subcategory, breathing reset, tissue quality, easy cardio, flat list,
internal label, movement pattern, conditioning tier, add candidates, six per
group, ADD_CANDIDATES_PER_GROUP.

· `BUILT src/utils/addExerciseCandidates.ts legalAddFamilies` /
`legalAddCandidates` (replacing `legalAddCandidateGroups`), read by
`screens/home/DayWorkoutScreenV2` through `openExerciseAdd` -> `openAddFamily`
-> `openAddSubcategory`, whose steps are `add_family` / `add_subcategory` /
`add_pick`. **Guarded by `test:exercise-add-candidates` case [5]** — 16 cells:
three families in Sam's order, labels identical to `SECTION_LABELS`, R-110's
power placement, every count equal to the list it opens, no measured internal
label at level 1 or 2, and — the other half — that nothing legal fell out of the
vocabulary on the way into the hierarchy. **Five mutations were run and each
reddened its own cell and only its own**: power moved to another family, a
prompt label passed through to level 2, a count off by one, a pool dropped, and
a hand-typed family label. `test:exercise-edit-entry-surface` re-points onto the
three new step names rather than dropping the rows with the old ones.

**⚠ SEEN ON GLASS, AND THE ONE DEFECT THAT ONLY GLASS COULD SEE.** The whole
route was driven on the simulator through Program -> Start Session -> the
five-action hub -> Add, on a build from the branch with a
`standard-in-season-week` seed: level 1 shows the three families with the
session screen's own glyphs, Strength opens on Power & jumps, and **Face Pull —
the 21st name in its pool and unreachable under the old cap — was added, taking
the session from 6 rows to 7**, landing at row 5 where the session template
orders accessories. `assertNotVisible` passes on `Breathing reset`,
`Tissue quality` and `Easy cardio (zone 1)` at level 1.

**Level 3 opened ALREADY SCROLLED**, because both add levels render a
`ScrollView` at the same position of the same tree and React reused the instance
with its offset — so entering level 3 from the bottom of level 2 put the first
movements above the fold, where they read as absent. **No headless cell can see
that**: it is component identity, not data. Each list is now keyed to its own
step so it remounts at its first row, re-verified on the device.

**R-120a** · *"Change the Strength hierarchy to this: 1. Power & Jumps ->
exercise choices. 2. Lower body -> Hinge / Squat / Single leg / Accessories ->
exercise choices. 3. Upper body -> Push / Pull / Arms & shoulders / Accessories
-> exercise choices. 4. Midline & Carries -> exercise choices. This adds one
extra step only where needed. Conditioning and Mobility / Warm-up can keep their
current structure. Use these athlete-visible names exactly."* (Sam, 2026-08-20)
· **THE DEPTH IS NOT UNIFORM, AND THAT IS THE RULING.**

R-120's first cut gave Strength TEN flat headings. This groups them under four
and pays for one more tap ONLY under Lower body and Upper body. **A heading
therefore either owns its exercises or owns a further question, and
`AddGroupSpec.leaves` is the single place that says which** — the screen reads
how many leaves are legal and routes itself, so *"only where needed"* is data,
not a branch somebody has to remember to write.

**`Single leg` IS THE `unilateral` TAG, NOT A HAND-WRITTEN LIST.** Sam put it
BESIDE Hinge and Squat, which means siblings PARTITION: it takes the unilateral
movements out of those two rather than duplicating them, so a movement belongs
to exactly one leaf and the two counts cannot double-count it.
`EXERCISE_TAGS.unilateral` already decides this for the per-side dose. Measured
on the live pools: **6 of 13 squat names and 1 of 7 hinge names, with nothing
untagged**, so the rule never guesses. It applies to the two primary lower
patterns ONLY — `Single-Leg Calf Raise` stays in `Accessories` with the other
calf work, which is where an athlete looks for it.

**Search words:** add hierarchy, strength headings, lower body, upper body,
single leg, hinge squat accessories, push pull arms shoulders, midline carries,
power and jumps, one extra step, variable depth, unilateral tag.

· `BUILT` `ADD_GROUPS` / `ADD_LEAF_LABELS` / `LEAF_FOR_POOL` /
`liftUnilateralToSingleLeg` in `src/utils/addExerciseCandidates.ts`, read by
`DayWorkoutScreenV2` through `openExerciseAdd` -> `openAddFamily` ->
`openAddGroup` -> (`openAddLeaf`) -> the exercises, whose steps are
`add_family` / `add_group` / `add_leaf` / `add_pick`. **Guarded by
`test:exercise-add-candidates` case [5], now 26 cells / 48 green**, including
Sam's four headings asserted as an ORDERED list of exact strings, both extra
questions asserted verbatim, *"only where needed"* asserted in BOTH directions
(the two deep headings AND that every other heading is shallow), the partition
(`Single leg` holds the unilateral names, Squat and Hinge no longer do, and
**no exercise appears under two leaves anywhere in the tree**), and every label
the athlete reads being one Sam declared. **Six mutations were run and each
reddened its own cell and only its own**: an extra step where none was asked
for, the partition disabled, the partition duplicating instead, the heading
order changed, an internal label on a leaf, and a straight-through heading
whose list title drifted from its button.

**⚠ SEEN ON GLASS, INCLUDING BOTH BRANCHES AND EVERY EXIT.** Four Strength
headings on one screen; Lower body -> Hinge / Squat / Single leg / Accessories,
whose Single leg list is exactly the unilateral movements with per-side doses;
Midline & Carries going STRAIGHT to its exercises and its Back climbing to the
headings rather than to a step that was never shown; Back walking the full
depth 4 -> 3 -> 2 -> 1; Cancel closing from the deepest level; and an add
completed through the deep branch (Upper body -> Accessories -> Scap Pull Ups),
taking the session from 6 rows to 7.

**⚠ OBSERVED ON GLASS AND PROVEN NOT TO BE THIS CHANGE.** Adding a shoulder
exercise also put a shoulder drill into the day's Mobility / Warm-up. That is
`selectMobilityPrehabFlow` DERIVING the warm-up from the workout — the north
star working — and it is untouched here: `programControlActions`,
`mobilityPrehabFlow` and `sessionTemplate` are all outside this branch's diff,
the same name was equally addable through the old flat menu's `Shoulder health`
group, and a headless probe through the screen's own owners (with a non-zero
warm-up as its positive control) returns byte-identical section counts in this
branch and in a control worktree at `c12a058c`.

**R-120b** · *"Keep the title as 'Accessories'. The previous step already makes
the body area clear."* (Sam, 2026-08-20) · **THE PATH IS THE CONTEXT; THE TITLE
IS NOT.**

Raised BY the seat, not by Sam: Sam's names give both halves of the body a leaf
called *"Accessories"*, so the exercise list opens titled `Accessories` with
nothing on that screen saying which half. The seat offered to title it
`Lower body — Accessories`. **Sam refused, and the reason is the ruling:** the
athlete has just tapped `Lower body`, so the step behind them already answers
it, and joining the two approved names would invent a third.

⚠ **DO NOT "FIX" THIS.** The two `Accessories` leaves ARE different lists —
19-20 movements of calves, isolation and lower prehab under Lower body, 3-4
scap and cuff drills under Upper body — so the duplicate word looks like a
defect on a screenshot and is not one. **Guarded by
`test:exercise-add-candidates` case [5]**: the leaf title must be the bare leaf
label, so a future seat that helpfully prefixes the body area reddens a cell
citing this row instead of quietly re-litigating it.

**Search words:** accessories, duplicate label, leaf title, lower body
accessories, upper body accessories, body area prefix, add menu title.

---

**R-121** · *"Use 'the one I can see'. The review and the applied session must
both name the exercise currently visible to the athlete. Keep older substitution
history internally, but do not show an older exercise as the source of this new
Injury change."* (Sam, 2026-08-20) · **A SUBSTITUTION IS NAMED BY THE ROW IT
REPLACED, NOT BY THE ROW THAT ONCE STOOD THERE.**

**Search words:** swapped from, substitution source, chain head, double swap,
second injury, older exercise, base exercise name, injury review names, which
name is shown, substitutedFrom.

**WHY IT WAS ORDERED, MEASURED.** Spotted on glass during the Active Session
injury review's device pass and then reproduced headlessly — two injuries in
sequence on one day:

```
knee 7/10      the athlete now sees   Chest-Supported DB Row  (was Leg Press)
shoulder 7/10  the review promised    Chest-Supported DB Row -> Easy Bike
               the session then said  "Swapped from Leg Press"
```

⚠ **IT WAS NOT A WORDING BUG, AND THE FIRST DIAGNOSIS OF IT WAS WRONG.** It was
first reported to Sam as the session "preserving the head of the substitution
chain". It is not preserving anything: **every injury settle rebuilds the day
from the AUTHORED week and re-applies all active injuries in ONE pass**, so the
second injury genuinely planned against `Leg Press` and had never seen the row
the athlete had been looking at all week. The intermediate view is not stored
anywhere and is not meant to be — it is a derivation.

· `WORKING` — `rules/injurySubstitutionSource.ts` is the one owner of both the
choice of name and the sentence, read by the row badge
(`screens/home/DayWorkoutScreenV2`) and by the review
(`utils/sessionInjuryReview`). The screen composed that string itself until this
ruling, which is exactly how the two came to disagree.

**THE NAME IS DERIVED, NOT REMEMBERED**, because a remembered one would not
survive a restart — boot re-derives the day and would quietly revert to the
authored name. `previouslyVisibleInjurySources` re-runs the same planner over
every active injury EXCEPT the most recently declared one, which is a pure
function of stored facts. **Which injury is "the new one" is derived too
(`mostRecentlyDeclaredInjuryId`), never taken from whichever action is running**
— the live door knows what the athlete just tapped and boot does not, and if the
two disagreed the badge would reword on the first relaunch.

**TWO NAMES, ONE SHOWN.** `substitutedFrom.baseExerciseName` is what the athlete
could SEE and is the only one ever rendered; `originExerciseName` is the authored
exercise, kept per Sam's *"keep older substitution history internally"* and
written ONLY when it differs — an always-present field that is almost always
equal to its neighbour is one readers start trusting for the wrong reason.
`injurySubstitutionSourceName` refuses to consult it at all.

⚠ **THIS DECIDES A NAME, NEVER AN OUTCOME.** The extra planner pass reads the
previous view and nothing else; it cannot change which exercise the ladder
chooses or which row is withheld. **With one injury the map is empty and nothing
changes**, which is the overwhelmingly common case.

⚠ **HALF OF THIS RULING IS NOT DONE, AND SAM HAS BEEN TOLD.** It holds for
SUBSTITUTED rows. It does NOT hold for WITHHELD ones. **MEASURED**, two injuries
in sequence: the review promises to leave out `Tricep Pushdown` and
`Bicep Curl (Barbell)`, and the session withholds `Bulgarian Split Squats` and
`Single-Leg RDL`. **THAT ONE IS NOT A NAME, IT IS THE ROW.** A substituted row
can be relabelled because the row is whatever the ladder chose; a withheld row is
the athlete's ORIGINAL exercise by R-115's design, and the settle's joint
re-derivation reverts it to the AUTHORED one, so the first injury's replacement
stops existing rather than being withheld in place. **The fix is a DERIVATION
change** — injuries applied one on top of another in declaration order instead of
jointly from the authored week — **which changes which exercise the athlete gets,
not just what it is called.** That is Sam's ruling to make and was deliberately
not taken. Pinned by the `⚠ OPEN` cell in `[9]`, which asserts the CURRENT
behaviour so it cannot drift unnoticed — **that cell is a measurement, not an
approval.**

**GUARDED:** `test:session-injury-review` sections `[9]` and `[10]`, driven end
to end through the real doors, including a restart. **The `[9]` cells are
INVERTED, not deleted** — they used to PIN the divergence as a measured fact
awaiting this ruling, and they now refuse it and assert more: that the authored
name is still kept and still not shown. `[9]` carries the control that the second
injury really does land on a row the FIRST one produced, without which every cell
under it would be green and empty. Mutations: **M6** (the settle names the
authored row again) reds 4, **M7** (the badge reaches for the older exercise)
reds 3, **M8** (the internal history stops being written) reds 1.

---

**R-122** · *"The resulting session violates the approved Injury fallback ladder.
'Skip' is the final option only after the app proves there is no safe
alternative. … Breathing Reset must never appear inside Strength … A Strength
replacement must remain a legal Strength exercise. Mobility / Warm-up and
Conditioning movements cannot be used to fill a Strength slot. 'Safe adjacent
pattern' still means useful Strength work. If no safe Strength option exists
after the full ladder, leave it unavailable rather than inserting recovery
work."* (Sam, 2026-08-20) · **A SECTION IS A BOUNDARY, AND SKIP IS THE LAST
ANSWER, NOT AN EARLY ONE.**

**Search words:** breathing reset strength, easy bike strength, recovery in
strength slot, category boundary, session section, skipped work, unavailable
today, unknown injury rating, unrated exercise unsafe, ladder exhausted.

**WHY IT WAS ORDERED:** a stacked-injury session came back as a screen of
skipped work with a breathing drill sitting in the Strength section.

**THREE DEFECTS, MEASURED.**

**D1 — THE LADDER HAD NO CONCEPT OF A SECTION.** It ranked the whole legal
library by movement pattern and safety. The app already knew `Breathing Reset` is
Mobility — the Add menu has known since R-120, through a TOTAL map from pool to
leaf to family — but the injury path never asked. `rules/exerciseSessionFamily`
now derives the family from those same maps and authors nothing of its own; a new
category table would have been a second answer, free to disagree.

**D2 — RECOVERY WAS INJECTED AFTER THE LADDER HAD SPOKEN.**
`getTapSwapChoices` appends `recoveryChoice`, two hard-coded literals minted
inside the swap surface (`Easy Bike`, or `Breathing Reset` when there is no
bike), which never went through the ladder at all. **FIXING ONLY THE LADDER MADE
THIS WORSE** — the pooled recovery option disappeared, the "already has a
recovery tier" guard stopped matching, and `Breathing Reset` was pushed onto a
`Bench Press` menu that had never carried it. Caught by `test:tap-swap-hierarchy`,
not by reasoning.

**D3 — THE CLASSIFICATION DEFECT SAM SUSPECTED FROM THE SCREENSHOT.**
*"'Breathing Reset is unsafe with your hamstring' appears wrong and may expose a
broader classification defect."* It did. **Two questions were sharing one
predicate and they disagree on exactly one answer, `unknown`.** *May this be a
REPLACEMENT?* rightly refuses an unrated exercise — there is always another rung.
*Must this EXISTING row come out?* must NOT, because there is no other rung and
the row is struck off the athlete's session. **70 of the 90 pooled and
conditioning names have no entry in the injury sheet**, so every conditioning
format in the app was being marked *"not safe with your <region> right now"* for
every injury at every band. `injuryWithholdsExistingRow` is the second owner;
`classifyExerciseRiskForBucket`'s own comment already stated the rule
(*"DO NOT 'FIX' THIS BY MAKING `unknown` RISKY … close it in the DATA"*) and this
was the caller breaking it.

**AND THE STACKING RULE THAT CAME WITH IT** — *"Stacked injuries operate on the
session the athlete could see before the newest injury."* The settle used to
re-plan every active injury JOINTLY from the authored week, so a second injury
planned against `Leg Press` and never saw the row the first had put there.
Injuries are now applied **in declaration order, each against the result of the
one before it**, and **stage k sees only the injuries that existed by stage k** —
a full environment at every stage re-derived the first injury while already
knowing the second, which is the same defect wearing a different hat. The final
state is still checked against every active injury, because the last stage
carries them all. R-121's naming falls out of this for free rather than needing a
derivation bolted on, and R-121's withheld half — recorded as OPEN when it was
ruled — is closed by it.

· `WORKING` — `rules/exerciseSessionFamily` (the boundary),
`rules/injuryFallbackLadder.walkInjuryFallbackLadder` (one traversal producing
both the options and the rung-by-rung explanation, so no separate explainer can
drift), `rules/injuryExerciseRisk.injuryWithholdsExistingRow`, and the ordered
stages in `programControlActions.recomposeSessionForInjury`.

**MEASURED AFTER, ordinary single injuries on a real generated week** — knee
7/10: 4 unsafe rows, **4 Strength replacements, 0 skipped**; shoulder 6/10: 1
row, 1 replacement, 0 skipped; hamstring 5/10: `RDLs -> Glute Bridge`, Sam's own
Bible good swap, 0 skipped.

**D4 — AND ONE PLACE WHERE "MISSING" STILL MEANT "SAFE", FOUND BY SAM'S OWN
QUESTION.** *"When an exercise has no injury-safety rating, does the planner now
treat it as safe? It must not."* Two of the three gates already refused it —
`buildInjuryFallbackLadder` only ever considers rated exercises
(`candidateFor` returns `null` without tags), and `assessTapSwapCandidateSafety`
refuses an unrated name outright. **But `isRecoveryName` — a hard-coded pair,
`Easy Bike` and `Breathing Reset` — skipped BOTH the unrated refusal and the
per-region check.** MEASURED at knee 9/10 AND shoulder 9/10, the most severe
world the app has: `Breathing Reset` came back **`safe=true`**, under the
sentence *"passes injury, readiness and equipment checks"* when no injury check
had run. Every other unrated name was correctly refused; only the exemption let
it through. **The exemption is deleted.** `Easy Bike` is rated and is judged on
its ratings like everything else; `Breathing Reset` is unrated and is refused as
*"cannot be verified against the active injury"* until somebody rates it IN THE
DATA. The EQUIPMENT exemption is a different question and stays — "can this
athlete perform it with today's kit" is not "is this safe for the injured area".

⚠ **ASKING `injuryPermitsExerciseAtSeverity` WOULD HAVE PASSED AND PROVED
NOTHING** — that predicate always refused `unknown`. The hole was one layer out,
in the function the ladder actually passes as `isLegal`. **Ask the gate, not the
predicate.**

**GUARDED:** `test:session-injury-review` `[11]` — the check Sam asked for by
name, sweeping 13 regions x 4 bands **on top of an already-applied injury**.
⚠ **THE FIRST VERSION OF THAT GATE WAS GREEN AND EMPTY**: with one injury the
ladder almost never runs out, so removing the boundary from the planner, the
ladder AND the recovery fallback reddened NOTHING. It sweeps a stacked world now
and asserts it reached the state the boundary is about. Mutation **M13** (the
planner and the recovery-fallback boundaries both off) reds 2 and reproduces
`Chest-Supported DB Row -> Easy Bike` exactly. ⚠ **THE TWO BOUNDARIES ARE
BELT-AND-BRACES — either alone holds, which is why single mutations do not bite.
Do not delete one as redundant.** `npm run probe:injury-ladder` prints, for every
skipped row, each rung's candidates and why each was rejected. `[11]` also sweeps
EVERY unrated name against the real gate in the severe world and asserts none
passes; restoring the `isRecoveryName` exemption reds it.

**EVERY REPLACEMENT IN THE DEVICE PROOF IS ADMITTED BY AN EXPLICIT RATING, NOT
BY A MISSING ONE** — for a 7/10 knee, `Band Pull-Apart`, `Chest-Supported DB
Row`, `Explosive Landmine Press`, `Banded Bicep Curl` and `Single-Arm DB Floor
Press` are each rated **`knee: good`** in Sam's ruled matrix (2026-07-28), and
each is a Strength row by the Add menu's own family map.

---

**R-123** · *"Put all five Active Session actions into one shared bottom-sheet
shell — Equipment, Injury, Add, Remove, Swap. The shell must be the single owner
of opening and closing animation, safe-area spacing, title and step header,
scrolling, Back behaviour, Cancel behaviour, resetting state when closed, and
consistent height and layout. Each action must keep ownership of its own
questions and behaviour. Compare the current incremental wrappers with a true
one-owner shell before coding; prefer the design that removes duplicated
sheet/navigation behaviour."* · Sam, 2026-08-20 · seat `sheetshell`.

**THE SHARED THING ALREADY EXISTED AND WAS NOT ENOUGH.** All three surfaces used
`ui/Sheet`. Each then decided height, scrolling, title, Back and Cancel ON TOP
of it, so five actions had **three** sheet call sites — and Injury crossed two of
them mid-flow, its questions in `GuidedInjuryFlowSheet` and its review a step of
`ExerciseEditSheet`. MEASURED before any edit: three heights (fixed 92% / auto /
auto), three scroll answers (whole-sheet / **none at all** / a `maxHeight: 360`
list on three add levels only, with `pick_exercise`, `choose_swap` and
`injury_review` unbounded and unscrolled), three title styles, three Back
implementations plus a fourth `Button` labelled "Back", **nine identical inline
Cancel buttons in one file**, two reset rules and a third owned by the screen —
and Add/Remove/Swap SNAPPED shut where the other two faded, because the component
returned `null` on close.

**`components/SessionActionSheet` is the one thing that renders a `Sheet` for a
session action**, and the gate is the NEGATIVE half: no action file may render a
`Sheet`, keep a Back, keep a Cancel, keep a scroll view or keep a
reset-on-`visible` effect. Bodies publish their step UP (`useSessionActionStep`)
rather than the shell taking a header down, because the header comes from
wherever the step state lives and that state must live INSIDE the shell for the
shell to be able to reset it.

**`onBack` UNDEFINED DRAWS NO BACK.** Six steps had shown a Back that closed the
sheet; an exit wearing a Back label is not *"up exactly one step"*, and this app
already refuses to draw a door that cannot act. **`choose_swap` and
`confirm_remove` GAINED the Back they should have had** — each is reached from
`pick_exercise` and nowhere else, so the step above them is that picker.

⚠ **KEYING THE SCROLL VIEW BY THE STEP IS THE OBVIOUS RESET AND IT IS WRONG
HERE.** The body renders inside the scroll view and the injury flow keeps its own
current step in `useState` inside the body, so a remount on every step change
throws that away and the flow can never leave its first question. The offset is
reset imperatively instead. **The remount that IS wanted is the per-OPEN one**,
and it is keyed by an epoch the shell mints, because RN's `Modal` keeps its
children mounted through the dismiss animation on iOS — so "did a reopen see
fresh state?" had depended on animation timing.

**`ui/Sheet` GAINED A SECOND NAMED MODE, `cappedBody`** — hug the content, stop
at 92%. `flexibleBody` is a DEFINITE height, which a `flex: 1` child needs and
which would open "Remove this exercise?" 92% tall with two lines in it; that is
why three callers had each invented their own inner `maxHeight`. A `cappedBody`
sheet's scrolling child must use `flexShrink: 1`, never `flex: 1` — flex-basis-0
measures ZERO inside a parent still deriving its height, the sliver defect from
Sam's device on 2026-07-29. The sliver gate (`test:profile-reset-ui` `[13]`) was
WIDENED to accept the second declared mode, not exempted for one file.

**GUARDED:** `test:session-action-shell`, 57 cells. **MUTATION-PROVEN, seven
mutations, each restored from a scratchpad backup:** `flexShrink`→`flex` (1 red),
epoch key dropped (2), scroll view re-keyed by step (1), Back drawn
unconditionally (1), one inline Cancel restored (1), Equipment rendering its own
`Sheet` (2), and `cappedBody` dropped — which reds the WIDENED sliver gate (1),
proving the widening still bites.

**NOT COVERED, NAMED:** `injury_review` still has no Back — the step above it is
the guided flow's LAST question, in a component that always restarts at `region`,
so a Back landing there would not be "up one step". Cancel exits applying
nothing, exactly as before. **That is a ruling nobody has given.**

---

**R-124** · *"The Injury review must not apply the 'unaffected body area' fallback
separately to every blocked row, producing false pairings like Back Squat → Row
and RDL → Floor Press. Preserve the existing ordered ladder through same
movement, secondary compound, accessory or isometric, safe adjacent pattern —
those remain per-exercise replacements. If those stages find nothing safe, do not
describe unrelated upper-body work as replacing that specific lower-body
exercise. Handle the unresolved rows at session level … Do not show false arrows
between unrelated exercises. Clearing the injury must restore the exact original
session, including after restart."* · Sam, 2026-08-21 · seat `sheetshell` ·
MERGED `68918d47`, rollback `pre-injury-fallback-merge-2026-08-21`.

**MEASURED BEFORE ANY CODE MOVED** (`npm run probe:injury-review-pairings`), knee
7/10 on the athlete's real Monday: **rungs 1-4 accepted ZERO candidates for all
five blocked rows** while rung 5 accepted 44-73. Every arrow the athlete saw was
the loop handing each row the next unused name off one long list — reorder the
rows and `Back Squat` gets a different partner. **Two of the five were already
elsewhere in the same week** (`Band Pull-Apart` Tuesday, `Single-Arm DB Floor
Press` Thursday), taking the athlete's upper-body rows for the week from 7 to 12.
Swept every region at 6-7: rungs 1-4 are real for Lower back, Shoulder, Elbow and
Neck on the upper days, and **structurally empty for every lower-limb region on
the lower-body day** — Sam's matrix rates 0 of 9 squats, 0 of 7 lunges and 0 of 8
hinges `good` for any lower limb.

**SAM'S DECISIONS, 2026-08-21, IN HIS ORDER:** keep the safe row and add at most
three · `Chest-Supported Row`, `Side Plank` and a non-kneeling dead-bug instead of
`Ab Wheel` if Ab Wheel kneels (it does) · paused rows appear in the REVIEW and
leave the ACTIVE SESSION — **no five greyed-out SKIP cards** · one concise summary
line · cap at three and never exceed the original session size or the existing
weekly limits · **carries and kneeling OUT for a 6-7 knee, held in the SHARED
safety authority, never a screen-specific exception, and never a blanket ban for
a mild knee** · no false arrows · clearing restores exactly, including after
restart.

**THE DERIVATION IS `utils/injurySessionAdjustment`**, and for the measured world
it returns exactly Sam's three: `Chest Supported Row`, `Dead Bug`, `Side Plank`,
under *"5 lower-body exercises paused for your knee. Today's session has been
adjusted to safe upper-body and core work."* — every word of it derived from what
happened to the rows.

⚠ **NOTHING IS STORED, AND THAT IS THE WHOLE OF REQUIREMENT 8.** It is a
read-time projection from the injury FACT at the same VIEW door as
`rules/injuryWithheldRows`. Writing the three added rows as `add_exercise`
decisions was the obvious build and fails outright: the ledger replays them
forever after the knee is better.

⚠ **A PLANNER READS THE DAY, NOT THE DRAWING.** The adjustment removes and
appends rows, which `markInjuryWithheldRows` has always refused to do — because
the injury planner reads back through the same resolver.
`resolveWorkoutOnDate` suppresses it; `visibleWorkoutOnDate`, which answers *"what
can the athlete see"*, deliberately does not. **Removing that suppression
reddened NOTHING until `[10]` was written for it.**

⚠ **STACKED INJURIES ARE STAGED IN DECLARATION ORDER, IN MEMORY.** Measured by
instrumenting the settle: stage 1 plans `Leg Press -> Glute Bridge` and the
ordinary swap door then REFUSES the write, because that row is unsafe under the
injury declared afterwards. Correct — and it leaves the authored day, so the
review promised `Kettlebell Swings` while the session paused `Leg Press`. R-121
from a new direction. **Reporting and filtering are two questions**: `paused`
carries the name the athlete saw, `pausedOnTheDay` the name the day holds.

⚠ **A RED FLAG GETS NO ADJUSTMENT AT ALL** — the 8-10 full-stop rule owns it
start to finish (R-115). **And the athlete is never left with an empty session**:
where nothing is kept and nothing can be added, the rows stay, dimmed, with their
reason and a `SKIP` badge where the checkbox would be — the checkbox is REPLACED,
not disabled.

**GUARDED:** `test:injury-session-adjustment`, 44 cells. **MUTATION-PROVEN, four
mutations, tree restored byte-identical after each:** staging replaced by one
pass (1 red), the report using the day's names (1), the planner reading the drawn
day (1, only after `[10]` existed), the honesty read pointed at the planner's day
(5). Controls in four older suites were RE-AIMED to genuine worlds by searching
the real doors, never lowered — and where no such world exists any more
(`exercise-restore-owner` `[2]`: no injury substitutes on that day at any band)
the cell names the mechanism that is actually there and says so with the
measurement.

**NOT COVERED, NAMED:** a temporary equipment fact does not narrow the added
block — the block's environment carries the permanent kit and the injuries, and
projecting equipment facts into it is `composeTemporarySourceFactCompatibility`'s
territory, not this unit's.

---

**R-125** · *"Permanently retire the weekly coach card because Status owns that
information now. Delete its remaining tests and stale rebuild references."* ·
Sam, 2026-08-21 · seat `boats`.

`utils/weeklyCoachUpdate.ts` was deleted by the 2026-08-19 burn and carried on
the rebuild list from that day. **It is now RETIRED, not pending.** The seat that
deleted it had already named the successor in its own E/G/H table —
`CoachStatusScreen` ("My Status"), which `useCoachNoteActions` says "owns the
program modifiers now".

`coachLivePathV2IntegrationTests` was the last suite holding it: 23 blocks across
9 sections, every `buildWeeklyCoachUpdateFromConstraints` call and every
assertion on `card.activeIssues` / `avoid` / `keep` / `ctaPrefill` /
`sessionsChanged`. **The suite had been DEAD AT IMPORT since the burn**, so none
of it had run. The four links that are NOT the card — constraint → projection →
visible day → visible week — are what the suite is for, and they all still run.
**DEAD → 58 passed / 0 failed.**

---

**R-126** · *"Short-on-time has no current athlete-facing route. Prove that, then
delete its remaining implementation, tests and debt entry. Do not repair it."* ·
Sam, 2026-08-21 · seat `boats`.

**PROVEN FIRST** — `npm run test:short-on-time-absent`, 8 cells, 0 failures:

- the fact was written only inside a branch gated on `action.scope === 'today_only'`;
- **all three athlete dispatches of `set_schedule_modifier` use `current_week`**,
  and no screen, component or hook pairs that action with `today_only` at all;
- the only thing that could put minutes on a readiness signal,
  `buildReadinessSignalPatch`, had **zero production callers**.

**DELETED:** `rules/timeAvailabilityPolicy.ts` whole; the `short_time` quick
option, its patch case and its detector in `utils/readiness.ts`; the short-time
constraint branch in `utils/readinessConstraints.ts`; the door branch in
`utils/programControlActions.ts`; nine cells and the `today_only` helper in
`programControlDurableOwnershipTests` (**18/2 → 11/0** — two of the deleted cells
were already failing); the `short_time` cells in `readinessSignalTests`; section
[4] of `severityScaleOwnershipTests`.

⚠ **AND THE DECLARED DEBT I HAD ADDED IS DELETED, NOT SATISFIED.** It pinned
`severity: fact.maxSessionMinutes < 20 ? 7 : 5` in `rules/temporarySourceFact.ts`
as a live violation of the 2026-07-28 ruling. **That line is not short-on-time
code** — it is on the COACH's time-cap path ("only got 40 minutes on
Wednesdays"), a different and live feature. Gating a live coach line under a dead
feature's section was the error.

**NOT DELETED, AND THE DISTINCTION IS THE POINT:** `createTemporaryTimeCapFact`,
`TemporaryTimeCapFact` and `timeCapProjection` stay. The coach still writes a
time-cap fact with `sourceSurface: 'coach_chat'`. **The two answers shared a fact
type and nothing else.** `programControlDurableOwnershipTests` also keeps its two
cells asserting the Time door stays ABSENT, which now enforce this ruling.

---

**R-127** · *"Delete the obsolete expectation that fatigue 7/10 collapses the
session to Rest. Re-measure 'Totally cooked' through the current visible Tired
button on a real generated session."* · Sam, 2026-08-21 · seat `boats`.

⚠ **THE DEFECT I REPORTED ON 2026-08-21 DOES NOT EXIST, AND THE ERROR WAS THE
DOOR I MEASURED THROUGH.** I reported that "the app cautions max-effort work it
still prescribes", from a legacy dispatcher inside a suite fixture.

**RE-MEASURED THROUGH THE CONTROL THE ATHLETE PRESSES** — the Tired sheet's third
option `Totally cooked`, `onApply('cooked_week')` →
`readinessActionForKind` → `set_fatigue_status`, `level: 'cooked'`,
`scope: 'current_week'`, through the real durable executor on a real generated
in-season week (`npm run probe:totally-cooked`):

| day | sets before → after | rows dropped |
| --- | --- | --- |
| Mon | `2,3,3,3,3,2,1` → `1,2,2,2,1` | Single-Leg RDL, Band Pallof Press |
| Tue | `2,3,3,2,13` → `1,3,2,13` | Band Pull-Apart |
| Wed | `3,3,2` → `2,2` | Banded External Rotation |

`ok=true, changedProgram=true`. **Warnings on every day: 0.** The week is
RECOMPOSED, not annotated. There is no "warns but does not act" defect on the
athlete's door, and **nothing asks for the deleted rewrite system back.**

The two obsolete cells are deleted, and so is the pin I put in their place.

---

**R-128** · *"Trust the athlete's latest reported injury number immediately. Do
not stage the return. Remove the unused staged-reintroduction rule, its obsolete
tests and any dead supporting fields that have no other live purpose. Add a guard
proving the latest reported severity is the current authority."* · Sam,
2026-08-21 · seat `boats`. **RULED AND BUILT.**

⚠ **AND MY REPORT THAT RAISED THE QUESTION WAS WRONG ABOUT ONE FACT.** I said
`rules/injuryReintroduction.ts` had zero production callers.
**`utils/generationConstraints.ts:331` called it on every injury constraint it
built.** I had grepped for two of its three exports and generalised to the
module. The staging was LIVE at generation time, so this is a product change, not
a dead-code deletion.

**WHAT THE ATHLETE GETS NOW.** Report 8, then report 4 → restricted as a **4**.
Before this, restricted as a **6** — the lever relaxed at most one band per
report, so improving faster than the app expected bought no relief.

**DELETED:** the rule module whole; `effectiveSeverity`, which existed only to
carry the staged answer and became an exact alias of `severity`;
**`priorSeverity` everywhere** — written in five places and consumed in exactly
one, the staging call, so with that gone it had no reader at all; the barrel
export; and the staging suite.

**THE GUARD — `test:injury-latest-severity`, 48 cells, in the bible chain.** It
holds the BEHAVIOUR, not the absence of a file: nine severities each get exactly
the gates that number earns; a reported 4 after a 9 is identical to a fresh 4
across five buckets and every gate at once; the one-band steps 8→6, 6→4, 4→2,
10→8 each match their fresh equivalent; improvement AND worsening land
immediately; and a stored constraint still carrying the retired `priorSeverity`
is ignored rather than honoured.

⚠ **MUTATION-PROVEN AFTER A HALF-MUTATION PROVED NOTHING.** Restoring the staging
alone reddened ZERO cells, because the caller no longer forwarded the input.
Restoring BOTH halves kills **16**. The headline cell's first cut compared
`status: 'improving'` against `'active'` — staging never keyed on status, so it
was unkillable; the stepped side now carries the peak.

**MEASURED vs control at `3821af21`:** `[product]` 30 and `[devtools]` 50
identical; `[tests]` 588 → 574 with four files LEAVING the worse list and none
joining; runtime-reachable 551 → 550; **`test:scenarios` byte-identical**; and
`test:injury-authority`, `test:fatigue-abolition`, `test:preseason-exposure`,
`test:exposure-engine`, `test:injury-severity-bands`,
`test:conditioning-templates` and `test:rules-kernel` every one unchanged.

---

**R-129** · *"Add primer program - 2 hip mobility drills, upper back mobility
drill, 1 extra drill (not hip or upper back mobility), pogo hops 2x10, explosive
upper body, explosive lower body, optional 3 accelerations for 15m at 90%,
optional heavy but easy lifts for low reps, i.e. TB dead or high box squat 2x2
(make exception to the 3 rep minimum rule here just for this session) and bench
for 2x3 or something? around 70% 1 RM? make this optional in the session i.e. no
checkbox inside session for the heavy but easy lifts or accelerations … for now
- it's only available to be added by player or swapped by a player … so default
to gunshow - when I add in the female pathway, the primer will become the
default … yes a lightning bolt"* (Sam, 2026-08-23) · **THE PRIMER IS AN EIGHTH
SESSION TYPE, ATHLETE-PLACED ONLY, AND ITS LAST TWO SLOTS ARE UNCHECKED.**

**THE AUTHORED COMPOSITION, IN SAM'S ORDER:**

| # | slot | dose | tick box |
| --- | --- | --- | --- |
| 1-2 | hip mobility | 2 drills | yes |
| 3 | upper-back mobility | 1 drill | yes |
| 4 | one further mobility drill, **neither hip nor upper back** | 1 drill | yes |
| 5 | Pogo Hops | 2 x 10 | yes |
| 6 | explosive upper body | authored dose | yes |
| 7 | explosive lower body | authored dose | yes |
| 8 | 3 accelerations, 15m at 90% | **optional** | yes |
| 9 | heavy-but-easy lift, low reps (Trap Bar Deadlift / High Box Squat 2x2, Bench 2x3, ~70% 1RM) | **optional** | yes |

**PLACEMENT (a):** `athlete` ONLY. **NOT `generator`.** G-1 keeps the Gunshow;
the Primer is add/swap only. ⚠ **THE DEFAULT FLIPS WITH THE FEMALE PATHWAY** —
Sam, same message: *"when I add in the female pathway, the primer will become the
default"*. **That is a STATED FUTURE ORDER, not scope for this task**, and a hand
that builds generator placement now has run ahead of the ruling.

**CHOOSER (b):** its own Add/Swap category, lightning-bolt glyph.
**COUNTING (c):** optional — no load, never a hard day, never breaks rest,
exactly as Gunshow. **COMPOSITION (d):** the table above.

**THE 3-REP FLOOR EXCEPTION IS SCOPED TO THIS SESSION.** The floor is
`strengthProgressionIntegration.applyDelta`'s `repsFloor` (3 when no band
applies). Slot 9 authors 2 reps and the exception must be **stated on the slot**,
never by lowering the global floor.

⚠ **THREE THINGS THE APP CANNOT DO TODAY, MEASURED 2026-08-23 BEFORE ANY CODE
WAS WRITTEN — these are the build, not decoration:**

1. **THERE IS NO PERCENT-OF-1RM ANYWHERE IN THE APP.** `grep -i "1RM"` over
   `types/domain.ts` returns NOTHING; every prescription is sets x reps (+ kg).
   *"around 70% 1 RM"* therefore ships as an authored COACHING NOTE on slot 9,
   not as a computed load. **ASSUMED, NOT RULED** — Sam wrote it with a question
   mark and has not been asked to sign it.
2. **THE EXPLOSIVE-UPPER POOL HAS EXACTLY ONE MEMBER.** `POWER_EXERCISE_POOL`
   holds one `family: 'upper'` entry — `Explosive Push-up`. **Slot 6 will
   prescribe the same movement every single time.** This is **R-118 already**,
   whose fix is *"add more legitimate no-equipment explosive upper-body
   options"*; the Primer makes that thin pool visible on every use rather than
   on a bodyweight-only world. **Not fixed here. Named.**
3. **`SpeedBlock` MAY NOT CARRY SLOT 8.** `SpeedBlockCountingFence` is
   `hardExposure: true, createsHardDay: true` — routing the accelerations
   through it would flip an OPTIONAL session into a HARD DAY and contradict
   answer (c). Slot 8 is an authored row, not a speed block.

**AMENDED THE SAME DAY, BY SAM, BEFORE ANY CODE — THE NO-CHECKBOX CLAUSE IS
WITHDRAWN AND REPLACED.** *"I actually don't care about what weight they use or
whether they tick it off or not really, so you can keep the checkboxes, but maybe
it's worth removing the weight toggle completely from this session?"* (Sam,
2026-08-23, second message). **Every row keeps its tick box. NO ROW IN THIS
SESSION SHOWS A WEIGHT CONTROL.** The `optional` column above now means only
"skippable, no penalty", which is what slots 8 and 9 always meant.

⚠ **THE WEIGHT CONTROL IS CHOSEN BY EXERCISE NAME AND KNOWS NOTHING ABOUT THE
SESSION.** `utils/loadEstimation.resolveLoadControlMode(exerciseName,
selectedImplement)` takes no session argument at all: `'none'` is reached only
via `PREHAB_NO_LOAD_EXERCISES`, a NAME set. A Trap Bar Deadlift must keep its
stepper in a strength session and lose it here, so **the mode must become
session-aware** — a signature change through `useDayWorkout.getLoadControlMode`
and its `DayWorkoutScreenV2` call sites. It is NOT a name added to a set, and a
hand that adds `Trap Bar Deadlift` to `PREHAB_NO_LOAD_EXERCISES` has silently
removed the stepper from every strength session in the app.

⚠ **`completionPolicy: 'optional_no_penalty'` IS WRITTEN AND READ BY NOTHING.**
Measured 2026-08-23: outside `sessionComponents.ts` and its own suites, zero
readers — the `canOverride` shape CLAUDE.md names. Recorded because the amendment
above means **nothing in this task gives it a reader either**; it stays dead
weight until some later task earns it one.

**DURATION AND PURPOSE (Sam, same message):** *"a little 20 min session the day
before their game to feel good"*. `durationMinutes: 20`. **It adds no fatigue,
contributes to no load and to no readiness — exactly as Gunshow does not**, which
is answer (c) restated by its author and not a new clause.

**SLOTS 1-4 NEED NO NEW CONTENT.** `MOBILITY_REGION_BY_ID` (signed 2026-07-30)
already tags every pool drill: `hips` 7, `upper` 5, `lower` 5, `midline` 3. Slots
1-2 draw `hips`, slot 4 draws `lower`/`midline` (Sam: *"not hip or upper back"*).

**SLOT 3 IS THE WHOLE `upper` REGION — RULED, NOT ASSUMED.** *"yeah just put the
whole upper group in please"* (Sam, 2026-08-23, third message), answering the
imprecision between his words (*"upper BACK mobility drill"*) and the signed
`upper` region, which is broader and holds `pec-doorway`, a CHEST stretch. **All
five `upper` drills are legal for slot 3.** No narrowed sub-set exists and none
is to be invented.

**FOUR ON-GLASS AMENDMENTS, SAM, 2026-08-23, after seeing the Add menu on his
phone.** All four are HIS words and all four are held:

1. *"change primer subtitle - short, sharp session to feel ready for game day"* —
   **SIGNED copy.** It replaces my proposed line, and the difference is the
   lesson: mine described what is IN the session, his says what it is FOR.
2. *"change conditioning subittle - swap the word intervals for running"* —
   now *"Light or hard - bike, row, ski or running"*.
3. *"put primer below gunshow in the list"* — it had landed last, which put the
   two optional gym sessions at opposite ends of the menu. Moved in BOTH owners:
   the render order in `PlanChangeSheet` and the row model in
   `planChangeTypeMenu`, which must not disagree.
4. *"Is it possible to change the recovery icon to a battery thats like 3/4
   full?"* — **THIS ONE AMENDS THE 2026-08-11 ICON AUDIT** and needed care. The
   row used `full-energy`, which is ALSO the readiness screen's "full energy"
   ANSWER; repointing that name would have silently changed a screen Sam did not
   ask about. A new `three-quarter-energy` name was added instead
   (`battery-80`). `test:approved-icons` was MOVED to the new signed state, not
   loosened — it now asserts the 3/4 battery is present AND that `full-energy`
   is ABSENT from this sheet, so reinstating the full battery reds.

· **`WORKING`** — `test:primer-session`, 20 cells, built 2026-08-23 by seat
`primer`. Every cell drives the REAL composer or the REAL owner over 40 seeds;
none builds a Workout by hand. **MUTATION-PROVEN, FOUR MUTANTS, THREE KILLED AND
THE FOURTH WORTH MORE THAN THE THREE:** removing `'primer'` from the no-load set
reds `L1`; turning the hip region RESTRICTION back into a `spread` reds `S1`;
flipping Pogo Hops' `reducedTakeoverOnly` reds `S6`. **The survivor was an
explicit `exclude: ['Pogo Hops']` on the explosive-lower slot — removing it
changed nothing, because `eligiblePowerExercises` already drops every
reduced-takeover entry. It was DEAD CODE dressed as a guarantee, and it was
deleted rather than kept**; `S6` now names the owner that actually holds the rule.
Tree restored byte-identical after each mutant.

**MEASURED AT BOTH ENDS, CONTROL AND CANDIDATE, ON THE SAME TREE.** Typecheck:
**662 errors on HEAD, 662 with this work** — the gate is red on `main` and this
change adds nothing to it. Fourteen suites run both ways; every one matches its
control, including the three `test:session-type-charter` failures (`E1`, `E2`,
`F2`) which are pre-existing and name recovery/prehab/gunshow, not the Primer.

⚠ **ONE REGRESSION WAS INTRODUCED AND CAUGHT BY THE CONTROL, NOT BY READING.**
`test:athlete-door-matrix` went **416/15 → 414/17**: the explosive slot resolved
training age with the STRICT crosswalk resolver, which THROWS on an answer it has
no row for ("Advanced"). Fixed to `ladderLevelForProfile`, the entry point that
module's own comment names for a possibly-incomplete profile; back to **416/15**,
and `S10` now holds it.

⚠ **NOT DONE: THE ATHLETE HAS NOT SEEN IT.** No simulator pass, no screenshot.
By CLAUDE.md's own standard — *"DONE MEANS THE ATHLETE CAN SEE IT"* — this is
WORKING in the suites and **OWED on glass**: the Add-menu row with its bolt, the
week-row glyph, the day card reading "Primer", and a session screen with no
weight controls.


---

**R-130** · *"It's one switch. Male or Female. … Everything in the app right now
is built for the male path. Nothing has to change on the male side. The female
path removes gunshow entirely. Prioritises lower body accessories and core over
upper body accessories. And adds in the primer. … If it's easier to just say
'never program gunshow for females' we can do that. And if they really want to do
it then they can add it. … No it can't be changed after onboarding - a male is
always a male. … There are no existing athletes mate. … there should be more
focus on lower body accessories which will take care of the knee issue thing"*
(Sam, 2026-08-23) · **THE FEMALE PATH IS ONE IMMUTABLE ONBOARDING ANSWER, AND IT
CHANGES FOUR THINGS.**

1. **THE GENERATOR NEVER PLACES A GUNSHOW.** The Add menu still offers it — she
   may add one.
2. **THE PRIMER IS PLACED ON G-1 AS OPTIONAL**, *"if no other sessions exist
   there"*; **a MULTI-GAME week gets none** unless she adds it (Sam, same day,
   answering the G-1 question directly). ⚠ **This REVERSES R-129's placement
   answer for females only** — R-129 says `placedBy: ['athlete']`, and it stays
   that way on the male path.
3. **Lower-body accessories and core are prioritised over upper-body
   accessories**, core landing on upper days to displace upper volume.
4. **No separate knee mechanism** — the lower-accessory shift covers it.

**SIGNED COPY, his literal words:** the question is `What is your gender?` and the
two buttons are `Male` and `Female`.

**IMMUTABLE AFTER ONBOARDING. NO MIGRATION** — there are no existing athletes, so
the field is required and has no default.

**THE STATED NON-GOAL:** the week's SHAPE does not change — same days, same
session types, same anchors. Only which accessories fill the sessions and which
optional session is offered.

⚠ **THE DESIGN DECISION THIS RULING FORCES:** `rules/sessionTypeCharter.ts`
answers *"who may place this?"* ONCE PER TYPE, for the whole app. Both changes 1
and 2 need that answer to depend on WHO THE ATHLETE IS. That is the shape change,
and it belongs in the charter — not as `if (female)` inside `coachingEngine`.

· `WORKING` — built by seat `pathway`, 2026-08-23, all four changes plus the
onboarding step, each held by a named gate: the question/immutability by
`test:onboarding-reliability` walk cells + `test:onboarding-presentation` +
`generationGenderOrThrow` (no default-for-the-unrecorded); the per-path charter
by `test:session-type-charter` **44/0 — green for the first time on record**
(per-path observation over four generated programs, E2b pinning no-male-primer
/ no-female-gunshow); the G−1 Primer placement and the R-130b mix by the
stage-b differential's **17-scenario golden (15 male worlds byte-frozen, 2
female worlds appended)** and `test:primer-session` 27/0; the G−1 ask's
per-path offer at `rules/g1LandingAsk.ts` (route id kept, label/placement per
path — R-130a item 3). Athlete-visible proof: full female onboarding walk,
week view with the Friday Primer, the R-130b split day, all on the simulator
with screenshots to Sam. The male acceptance held at every slice: golden
byte-identical, compile-gate breach list byte-equal to the control sweep at
`3ebd5662`, door matrix at its standing 416/15 with no new red names.
Original brief: `docs/FEMALE_PATH_BRIEF_2026-08-23.md`; build log:
`docs/STATUS_PATHWAY.md`.

---

**R-130a** · *"1. bring gunshow back later 2. yes, the exact female mix is
correct 3. yes offer females the primer … i want the UI to keep consistent style
so when you're adding the onboarding step it should match all the other steps"*
(Sam, 2026-08-23, answering seat `pathway`'s three questions) · **THE THREE
OPEN EDGES OF R-130, CLOSED IN ONE MESSAGE.**

1. **MALES STAY EXACTLY AS THEY ARE THIS JOB; THE AUTO-GUNSHOW RETURNS LATER AS
   ITS OWN ORDER.** Context that forced the question: the G−1 Gunshow
   auto-placement has been dead since the 2026-08-19 demolition (area 3) — the
   allocation lives in uncalled `buildWeeklyPlan`, the stage-b golden records
   `gunshowSessions: 0` everywhere, and `test:session-type-charter` E2 says so
   on `main`. So the male path today has NO generator-placed optional session,
   and R-130's byte-identity acceptance freezes that state. The male G−1
   Gunshow restoration is **a stated future order with no owner yet** — the
   scheduler placement built for the female Primer must make it a
   one-row flip, and the charter keeps gunshow's male `generator` claim as
   DECLARED DEBT until that order lands.
2. **THE FEMALE MIX IS SIGNED AS PROPOSED:** upper days — the arm/shoulder
   isolation slots (`triceps` + `shoulders` on push day, `biceps` + `traps` on
   pull day, the `arm_or_shoulder` row on the combined upper day) become
   midline + one glute/lower accessory; lower days — one extra glute-biased
   lower accessory row. **Session lengths unchanged.** Females only.
3. **THE G−1 LANDING ASK OFFERS FEMALES THE PRIMER** where it offers males the
   Gunshow (`take_the_gunshow` route and the zero-accessory fallback). The Add
   menu still offers her the Gunshow — R-130's own words.

**AND THE ONBOARDING STEP MATCHES THE EXISTING STEPS' STYLE** — same layout,
same tiles, same motion as the other option screens; no new visual language.

· `WRITTEN` → building. Seat `pathway`; plan in `docs/STATUS_PATHWAY.md`.

---

**R-130b** · *"no don't just add meaningless glute exercises in - i'd rather it
be pulls kept and a couple of prehab drills - or some low fatiguing lower body
work - like lower body accessories but don't just make it glute only … so pull
day probably becomes horizontal, vertical, core, core, shoulder prehab, 1-2
lower body accessories … same with push day"* (Sam, 2026-08-23, on seeing the
first female mix on glass) · **THE FEMALE SPLIT-DAY SHAPE, RE-RULED — AND THE
GLUTE NARROWING IS DEAD.**

1. **Female split days are his list, verbatim:** the day's two main movements
   (horizontal + vertical of its direction), **two core seats, one shoulder
   prehab seat** (the shoulder-health pool — external rotation, scap work),
   and **1-2 low-fatigue lower-body accessory seats**. The direction's
   accessory rows and all arm/shoulder isolation are gone from female split
   days. Built as two lower seats; kit or exclusions may drop one, which is
   the ruled 1-2 range rather than a defect.
2. **The lower seats draw the WHOLE lower-isolation pool** — hamstring, quad,
   calf, glute alike. *"don't just make it glute only"* supersedes R-130a's
   glute bias; the narrowing was measured delivering `Back Extension` on every
   seat (the reachable glute group is one exercise deep) and that monotony is
   what he refused.
3. Female lower days keep their one extra lower-accessory seat (unnarrowed);
   the combined upper day and full-body shapes are untouched by this ruling —
   he spoke to the split days.

Supersedes R-130a item 2's signed table. Males untouched, as everywhere in
R-130. · Seat `pathway`.

---

**R-131** · *"why are things that need seconds instead of reps being given reps
- bosch hold and half copenhagen both show 2x15 but its an isometric not a rep
thing"* (Sam, 2026-08-23) · **AN ISOMETRIC FILLING A STRENGTH SEAT KEEPS ITS
AUTHORED SECONDS.**

The prehab pools already author these rows in seconds (Bosch Hold 2×20-30s,
Copenhagen Plank (Half) 3×20-30s, Long-Lever Copenhagen 3×15-25s, per side);
the defect was the composer dosing ANY strength-seat row from its positional
rep ladder, which cannot say "seconds". The dose owner
(`rules/composedDose.resolveComposedDose`) now returns the authored duration
dose — category `authored_timed_hold` — and the unit travels to the stored row
(`prescriptionType`/`perSide`), so every surface renders `2 × 20-30s / side`.
Applies to BOTH paths: one male world (`offseason-no-equipment`, bodyweight
kit) carried these rows and moved with the fix — a PREDICTED golden movement,
scoped in the regen to exactly that scenario plus the two female ones.
· `WORKING` — differential golden (the three re-pinned worlds), on-glass
check with slice 6's walk. Seat `pathway`.

---

**R-132** · *"Stopwatch in the strength sessions or programmed sessions in top
right corner above everything maybe on same line as Thu 20/8 - 7 Exercises =
keeping font the same but just saying 'Start session' its a little button or
something with a timer next to it that you can pause or end, i.e. this should
make it easy to monitor how long the strength lasts and makes putting in the
feed back form very easy"* (Sam, 2026-08-23) · **THE SESSION STOPWATCH.**

On the session screen's subtitle line, right side, in the subtitle's own font:
idle shows his verbatim **"Start session"**; running shows the elapsed figure
with **Pause/End**; paused shows **Resume/End** (batch 37). What is STORED is
the athlete's timing ACTS (start/pause timestamps — facts) and, on End, ONE
measured RESULT in minutes; elapsed is derived, so a relaunch mid-session
resumes the same count. The measured minutes seed the strength feedback form's
duration boxes when nothing is stored yet — the second half of his sentence —
and the stored answer always outranks the measurement.
`session-stopwatch-store` is registered with the hydration gate and the
persisted-inputs schema (acts = `fact`, measurement = `result`).
· `WORKING` — on-glass walk (start/pause/end and the seeded form). Seat
`pathway`.

**R-132a** · *"I think the start session needs to be more obvious a button -
maybe via a play button as well or an underline? i dont know?"* (Sam,
2026-08-23) · The idle control is a SMALL LIME PILL — the app's own
primary-chip look (`colors.button.primary` on `primaryText`, the "Yes, log it"
family) — with a play triangle before the same signed words, font unchanged.
He floated play glyph or underline and left the treatment open; the pill is
the app's existing button language rather than a new one, and the play glyph
is his first suggestion honoured. Running/paused states keep their quiet text
form — his note was about Start only.

**R-133** · *"carries all timed / butterfly stretch - what does the
description say for them because they could be either / side plan and the
breathing are all reps - i noticed groin squeeze had reps - they should be
timed"* (Sam, 2026-08-23, answering the unit census his "whats the best way
to go about making sure all of them are correct?" ordered) · **UNITS, RULED
NAME BY NAME.**

**Carries — ALL timed, in seconds.** The strength carry pool authors no
doses, so the timed prescriptions live in `TIMED_CARRY_PRESCRIPTIONS` beside
the pool, consulted through the same authored-unit lookup as the prehab holds
(R-131). Suitcase Carry's metres (registered under R-131's extension the same
day) became seconds under this ruling — no carry prescribes distance any
more, and no composed row does either. **The SECONDS are seat-proposed under
his unit ruling, open to his adjustment:** Farmer 2×30-40s, Bear 2×30-40s,
Overhead 2×20-30s per side, Suitcase 2×30-40s per side.

**Groin Squeeze — timed.** His verbatim. Was 3×10-12 reps; now 3×20-30s
(seconds seat-proposed, unit his).

**Side plank and the breathing drills — reps stand.** His verbatim: rep
counts of held/breathed repetitions are deliberate, not unit defects. The
same shape covers the squeeze-cue accessories (Pallof, TKE, Band Pull-Apart,
Weighted Dead Bug, Ab Wheel and kin): reps with a hold inside the rep.

**Butterfly Stretch, Pissing Dog Against Wall, Dumbbell Pullovers — REPS,
RULED.** Shown their shared shape (reps where each rep is held a few
seconds — Butterfly 2×6-10 "Hold each rep 6–10 seconds", Pissing Dog 2×6
"Hold each rep 5 seconds", Pullovers 2×10 "Hold each rep for 2-3 seconds"),
Sam ruled verbatim: *"keep those three as reps"* (2026-08-23). Zero code
moved — they were already authored reps; this row exists so the
hold-each-rep shape is never re-flagged as a unit defect. **This closes the
unit census**: every exercise is now either explicitly timed (R-131/R-133),
explicitly distance (the Primer's Acceleration), or ruled reps.

· `WORKING` — carries: the R-133 pool-walk cells in `test:pools` (every
carry pool entry must resolve to a duration dose); Groin Squeeze + Bear
Carry: the Stage-B differential golden (both female worlds moved exactly
there; the male 15 byte-frozen). Seat `pathway`.

---

**R-134** · *"Yeah thats a pretty good answer, its a bit long and waaaaay too
expensive but it seems like it's talking to the athlete well - how do we improve
that..."* followed by *"yep that sounds good boss"* (Sam, 2026-08-24) ·
**PRESERVE THE COACHING TONE; MAKE THE EVERYDAY ANSWER SHORTER AND CHEAPER.**

The full-source `gpt-5.6-sol` answer remains the quality benchmark, not the
production request shape. The normal Coach Lab path retrieves exact, line-named
excerpts from the current Bible, active rulings and canonical exercise sources
for each athlete question; it never saves a condensed mini-Bible. Answers aim
for 60–90 words and fail the Lab above 100. Routine requests use low reasoning
and low verbosity, and record input, cached-input, cache-write, output,
reasoning and total-token receipts. `sol`, `terra` and `luna` may be compared in
Coach Lab, but a cheaper model replaces the benchmark only after Sam judges its
answer quality. · `WORKING` — `test:coach-lab` retrieval, request-shape,
receipt and answer-length cells. Seat `snapshot`.

---

**R-135** · *"completeky agree on your verdict"* (Sam, 2026-08-24), referring
to the first retrieved Sol answer being *"overly medical and not practical
enough"* and the proposed correction that it should explain the reduced-session
option before escalating warning signs · **ORDINARY TRAINING SORENESS GETS
PRACTICAL COACHING FIRST; MEDICAL TRIAGE STAYS PROPORTIONATE.**

When the athlete reports normal fatigue or soreness without pain or a warning
sign, Coach leads with the relevant LFA-backed training option. It does not spend
the answer inventing an injury screen, lead with its inability to diagnose or
bundle a severity scale and symptom checklist into one question. A genuine pain
or warning-sign report still receives the proper safety limit, and genuinely
missing information may still earn one short focused question. · `WORKING` —
`test:coach-lab` prompt-binding cell plus Sam's review of the same-case Sol tape.
Seat `snapshot`.

---

**R-136** · *"but yes i approve the answer and now compare against terra and
luna"* (Sam, 2026-08-24) · **THE CORRECTED SAME-CASE SOL TAPE IS APPROVED AS
THE QUALITY BENCHMARK; APPROVAL NEVER TRANSFERS TO ANOTHER RESPONSE.**

The exact approved message, model (`gpt-5.6-sol`) and prompt version
(`coach-lab-openai-v2-retrieval`) are stored together in the case corpus. The
evaluator requires all three to match; changing the words, model or prompt
returns the candidate to owner review. This approval does not choose the final
production tier by itself. Sam's accompanying question about whether Coach may
alter the plan reopens that future product decision but does not overturn the
current read-only-v1 ruling without a separate confirmation-path decision.
· `WORKING` — exact-tape and competing-model cells in `test:coach-lab`. Seat
`snapshot`.

---

**R-137** · *"okay terra it is"* (Sam, 2026-08-24) · **TERRA IS THE SELECTED
COACH TIER.**

`gpt-5.6-terra` becomes the default for the rebuilt Coach after its same-case
answer matched or bettered the approved Sol voice at materially lower measured
cost and latency. The exact Sol tape remains the quality benchmark; model
selection does not inherit its approval, and Terra must still clear the nine
unreviewed Coach Lab questions before app integration. Luna is not the fallback:
its same-case tape was cheaper but failed truthful Snapshot-field reporting and
introduced broader advice than its declared basis supported. · `WORKING` —
default-model, allowed-model and pending-only bench cells in `test:coach-lab`.
Seat `snapshot`.

---

**R-138** · *"correct those three answer shapes, rerun them, then connect Terra
to the read-only app chat ... be careful not to just fix edge cases - i'm more
concerned about how and why it's reading it wrong"* (Sam, 2026-08-24) ·
**TERRA REPLACES THE SIMPLE CONVERSATIONAL COACH AS A READ-ONLY LIVE APP CHAT.**

The three wider-bench defects are corrected at the shared model-input boundary,
not by adding phrases for their questions: every visible day now carries a
deterministic past/today/future relation to the Snapshot date; conversational
references resolve only from bounded recent turns and an explicit active target
(including explicit `null`); and today's quick check is typed as a same-day
readiness input distinct from a separately recorded `Wrecked`/`Absolutely
cooked` declaration. Terra receives that one typed input in Lab and production.

The app sends the one live Coach Snapshot, the athlete message and at most six
recent turns to a dedicated server-owned `gpt-5.6-terra` endpoint. The server,
not the app, owns instructions and exact retrieval from the current Bible,
rulings and canonical exercise sources. The response schema can carry no
program action; the server rejects a non-empty action list and the app rejects
one again. The old conversational change proposal/card/writer is disconnected.
Existing athlete-owned My Status and system-raised commitment controls remain
separate controls and are not model tools. · `WORKING` — shared-context,
three-mutation and exact-rerun cells in `test:coach-lab`; generated-knowledge,
server/client, empty-action and screen-cutover cells in
`test:coach-chat-integration`, reached by `test:coach-snapshot` in
`test:bible`. Seat `snapshot`.

---

**R-139** · *"I want you to create a 'progess tab' with the same UI as the
other tabs - I changed my mind, coach should just have the my status in top
right and then a chat box - but it can monitor the readiness and the consistency
of the athlete for future sessions ... the progress tab should have the load
continuum ... progress charts on main lifts and 2km time trial ... Mobility /
warm up ... should have the green tick if its completed as well"* (Sam,
2026-08-24) · **PROGRESS OWNS VISIBLE TRACKING; COACH STAYS INFORMED BUT SIMPLE;
SAVED MOBILITY COMPLETION IS VISIBLE.**

Progress is a fourth live bottom tab. It owns the load continuum immediately
below its title, then the athlete's current recorded 2km time, followed by
multi-week main-lift charts in a two-column grid. The app does not invent a 2km history:
today only one 2km answer is stored, so the chart is ready for future recorded
tests but shows only the fact that exists now.

Coach removes the visible Snapshot dashboard. Its glass is My Status plus the
conversation and composer, while Terra still receives the same live Snapshot,
including readiness and Consistency, as private coaching context. No copied or
persisted dashboard state is introduced.

Mobility / Warm-up on the day view reads the saved checklist item evidence
through the same completion owner as the feedback result. Full or partial
performed work draws the same green tick as every other performed component. A
legacy whole-session `full` result restores the tick; a legacy partial result
does not guess which section was completed. · `WORKING` — `test:coach-snapshot`
and `test:session-execution`. Seat `snapshot`.

---

**R-140** · *"wording approved"* (Sam, 2026-08-24), approving the three exact
sentences put to him after the fresh Coach checkpoint audit · **COACH FAILURES
AND THE AI DISCLOSURE SAY WHAT ACTUALLY HAPPENED.**

An unavailable Coach says **"Coach isn't available right now. Try again
shortly."** A truth/safety refusal says **"I can't answer that safely."** A
usable-answer absence keeps the previously approved **"I don't have an answer
for that yet."** The Privacy page says **"Coach messages and concise,
whitelisted summaries of your program, readiness, training load, progress and
restrictions may be sent to backend and AI services so the app can return a
Coach response. The Coach is completely read-only and cannot change your
program."**

The typed cause, not HTTP or provider prose, chooses the athlete sentence.
· `WORKING` — `test:coach-snapshot` + `test:profile-reset-ui`. Seat
`coachhardening`.

---

**R-141** · *"do we still need this export state thing in the app?"* followed
by *"okay do that"* (Sam, 2026-08-24) · **STORED-STATE DIAGNOSTICS ARE
FAILURE-ONLY, NOT PART OF A HEALTHY ATHLETE SCREEN.**

The temporary **Export stored state** button and its internal answer/snapshot
counts are removed from the normal Welcome and Profile screens. The underlying
export remains available only on the real onboarding completion failure
surface, where an athlete can be blocked before Profile is reachable and the
diagnostic may still explain the refusal. Nothing is exported automatically;
sharing remains an explicit tap on that failure surface. · `WORKING` —
`test:action-log` + `test:profile-mirror-narrowing`. Seat `exportcleanup`.

---

**R-142** · *"remove so i can coach you properly"* (Sam, 2026-08-24) · **THE
NAME QUESTION STANDS ALONE.**

The Name onboarding screen keeps **"What should I call you?"** and removes the
subtitle **"So I can coach you properly."** No replacement sentence is added.
The input follows the question after the existing section spacing. · `WORKING`
— `test:onboarding-presentation`. Seat `onboardingcopy`.

---

**R-143** · *"change to what position fits you best - and your position gives
LFA a small programming bias"* (Sam, 2026-08-24) · **POSITION, NOT FOOTY ROLE,
IS THE ATHLETE WORD.**

The onboarding screen asks **"What position fits you best?"** and says **"Your
position gives LFA a small programming bias."** The matching Profile edit step
uses the same question so the two athlete surfaces cannot drift back to
different language. · `WORKING` — `test:role-buckets` +
`test:profile-reset-ui`. Seat `positioncopy`.

---

**R-144** · *"remove icons here"* on the season-phase picker (Sam,
2026-08-24) · **SEASON PHASE CHOICES ARE TEXT-ONLY.**

Off-season, Pre-season and In-season keep their existing cards, labels and
supporting lines, but none has a leading icon or reserved icon box. This
supersedes the earlier icon-audit binding only for this onboarding screen. ·
`WORKING` — `test:onboarding-presentation`. Seat `seasonicons`.

---

**R-145** · *"this needs to be 7 buttons 1-7 ... make it a horizontal slider
instead of the buttons - like we have on the feedback forms"* and *"A gym
session can be on the same day as team training. Lifting in the morning or
before training is completely fine."* (Sam, 2026-08-24) · **GYM AVAILABILITY
IS ONE SEVEN-STOP SLIDER.**

The six-card picker is replaced by one empty horizontal slider with visible
stops 1–7. It retains the existing `trainingDaysPerWeek` answer and Continue
transaction. Feedback and onboarding sliders share one discrete touch owner,
so their mechanics cannot drift. · `WORKING` —
`test:onboarding-presentation` + `test:effort-scale`. Seat
`commitmentslider`.

---

**R-146** · *"Change this subtitle to team training"* on the sprint-exposure
screen (Sam, 2026-08-24) · **SPRINT EXPOSURE USES TEAM-TRAINING LANGUAGE.**

The subtitle reads **"So we can manage speed work and recovery. Team training
counts if you sprint there."** The retired **"Club training"** version is
absent. · `WORKING` — `test:onboarding-presentation`. Seat `sprintcopy`.

---

**R-147** · *"change body title to \"measurements\""* on Review (Sam,
2026-08-24) · **REVIEW CALLS HEIGHT AND WEIGHT MEASUREMENTS.**

The Review section containing Height and Weight is titled **MEASUREMENTS**.
The retired **BODY** section title is absent. · `WORKING` —
`test:onboarding-presentation`. Seat `measurementcopy`.

---

**R-148** · Sam supplied the complete replacement Welcome copy beginning
*"TRAIN FOR FOOTY. One complete program built around your season and
schedule."* (2026-08-24) · **WELCOME EXPLAINS THE COMPLETE LFA PROGRAM.**

Welcome presents **YOUR PLAN / Everything works together**, **YOUR WEEK / Footy
comes first**, and **YOUR PROGRESS / See how you’re tracking**, using Sam's
exact descriptions for phase-specific training, schedule fit and progress
monitoring. The CTA reads **Build my program →** and keeps **Takes about 3
minutes**. The retired card copy is absent. · `WORKING` —
`test:onboarding-presentation`. Seat `welcomecopy`.

---

**R-149** · *"remove your progress your week your program from this screen"*
(Sam, 2026-08-24) · **WELCOME CARDS HAVE NO EYEBROW LABELS.**

The three Welcome cards begin directly with their main headings. **YOUR
PROGRAM**, **YOUR WEEK** and **YOUR PROGRESS**, along with their label field and
reserved label spacing, are removed. · `WORKING` —
`test:onboarding-presentation`. Seat `welcomeeyebrows`.

---

**R-150** · *"put them back but reduce the padding between 'your plan' and
'everything works together' so it's smaller and the same in each box ... change
the main title back to Built for footy"* (Sam, 2026-08-24) · **WELCOME LABELS
RETURN WITH ONE COMPACT GAP.**

The Welcome hero reads **BUILT FOR FOOTY.** The three shared eyebrow labels are
**YOUR PLAN**, **YOUR WEEK** and **YOUR PROGRESS**. All three use the same 2px
gap before their main heading; no card owns independent spacing. This
supersedes R-149. · `WORKING` — `test:onboarding-presentation`. Seat
`welcomecompact`.

---

**R-151** · Season Phase answer-card typography consistency (Sam, 2026-08-24) ·
**ANSWER CARDS USE ONE TYPOGRAPHY OWNER; HEADINGS DO NOT STYLE ANSWERS.**

Every two-line onboarding choice uses the same system-font recipe: 16px bold
title and 13px regular supporting line, with shared line heights and no forced
case. Screen-heading variants are not used for answer text. Authored casing is
still copy: this ruling removes style-driven capitals and does not silently
rewrite approved words. · `WORKING` — `test:onboarding-presentation`. Seat
`onboardingtype`.

---

**R-152** · Team-session intensity onboarding step retirement (Sam,
2026-08-24) · **TEAM-SESSION SIZE COMES FROM COMPLETED-SESSION FEEDBACK.**

Onboarding asks which days contain team training and then advances directly to
gym availability. It does not ask athletes to estimate how hard team sessions
usually are, and Review does not show that retired answer. Both obsolete
intensity screens and routes are deleted. Until an eligible team session has
feedback, the derived size is honestly unknown rather than guessed from a
static onboarding answer. Existing stored intensity values remain readable as
legacy profile data but no longer shape the read. · `WORKING` —
`test:onboarding-presentation` + `test:team-night-size` +
`test:onboarding-field-influence`. Seat `onboardingtype`.

---

**R-153** · Welcome first-card copy shortening (Sam, 2026-08-24) ·
**FIRST CARD ENDS AT RECOVERY.**

The first Welcome card reads **YOUR PLAN / Built as one program** with the body
**"Strength, speed, conditioning and recovery."** The retired **Everything
works together** heading and the longer phase-specific sentence are absent. ·
`WORKING` — `test:onboarding-presentation`. Seat `onboardingtype`.

---

**R-154** · Position-choice alignment (Sam, 2026-08-24) · **POSITION
CHOICES ARE LEFT ALIGNED.**

All five full-width Position choices align their labels to the left. The shared
selected-state tick remains in the top-right corner. · `WORKING` —
`test:role-buckets`. Seat `onboardingtype`.

---

**R-155** · Gym-days wheel picker clarification (Sam, 2026-08-24) · **GYM
DAYS SNAP THROUGH THE CENTRE.**

The gym-days answer is a horizontal 1–7 number wheel that opens on **4**. The
number nearest the centre grows and becomes fully visible; numbers fade and
shrink toward the edges. Dragging or tapping snaps the nearest number into the
centre. The earlier rail-and-thumb control is absent, while feedback forms keep
their own existing sliders. This supersedes R-145's empty/shared-control detail
but retains its range, subtitle and stored answer. · `WORKING` —
`test:onboarding-presentation` + `test:effort-scale`. Seat `onboardingtype`.

---

**R-156** · Bottom-copy deletion on `EquipmentScreen` (Sam, 2026-08-24) ·
**CARDIO CHOICES END THE SCREEN.**

`Train somewhere else? Go back and change where you train.` and `Nothing
ticked? Continue anyway — you'll get a bodyweight program.` are deleted together
with their `Pressable` and `footNote` style. Standard Back and Continue remain.
· `WORKING` — `test:equipment-answer`. Seat `onboardingtype`.

---

**R-157** · Generation-card icon alignment (Sam, 2026-08-24) · **ICONS
CENTRE AGAINST THE FULL MESSAGE.**

Each generation education card places its icon beside one text block containing
both the title and supporting sentence. The row centres the icon vertically
against that complete block rather than against the title alone. · `WORKING` —
`test:onboarding-presentation`. Seat `onboardingtype`.

---

**R-158** · Welcome first-card heading replacement (Sam, 2026-08-24) ·
**TRAIN EVERYTHING THAT MATTERS.**

The **YOUR PLAN** card heading is **Train everything that matters**. Its body
remains **"Strength, speed, conditioning and recovery."** The retired **Built
as one program** heading is absent. · `WORKING` —
`test:onboarding-presentation`. Seat `onboardingtype`.

---

**R-159** · Game-day picker layout (Sam, 2026-08-24) · **SEVEN DAYS IN ONE
ROUNDED-SQUARE ROW.**

Game Day says **"Select the day you play most often."** and presents Monday
through Sunday in one horizontal row. The controls remain compact rounded-square
tiles rather than becoming circles. The shared day picker retains its 3-3-1
default for Team Training; R-160 later gives usual gym days the same row. ·
`WORKING` — `test:onboarding-presentation` + `test:game-anchor`. Seat
`onboardingtype`.

---

**R-160** · Usual gym-day picker layout (Sam, 2026-08-24) · **MATCH THE
SEVEN-ACROSS GAME-DAY ROW.**

The multi-select **Which days can you usually get there?** screen uses the same
single horizontal row of seven compact rounded-square weekday tiles as Game
Day. Its existing selection cap, dimming and Continue behaviour are unchanged.
This supersedes only R-159's statement that this screen retained the 3-3-1
layout. · `WORKING` — `test:onboarding-presentation`. Seat `onboardingtype`.

---

**R-161** · Generation-card icon horizontal alignment (Sam, 2026-08-24) ·
**ICONS CENTRE BETWEEN THE CARD EDGE AND WORDS.**

Each generation education card gives its icon one fixed column spanning the
space before the text, then centres the icon inside that column. The title and
body retain their existing horizontal position, and R-157's vertical centring
remains intact. · `WORKING` — `test:onboarding-presentation`. Seat
`onboardingtype`.

---

**R-162** · Program Day-card surface consistency (Sam, 2026-08-24) · **THE
THREE DAY CARDS USE THE SAME DARK BACKGROUND.**

On the Program Day view, the programmed session, Team Training and **Need to
make a change?** cards share the same darker background and border. Team
Training and the change card reuse the programmed card's existing surface style
rather than copying its colour values. · `WORKING` — `test:day-first-timeline`.
Seat `onboardingtype`.

---

**R-163** · Team-training-only Day helper (Sam, 2026-08-24) · **HAVE FUN AT
TRAINING!**

When Team Training is the only session on the Program Day view, its card shows
**"Have fun at training!"** between the title and **Log Session**, in the same
subtitle position and style used by Game Day's **Good luck!** line. The Log
Session action and pop-up are unchanged. · `WORKING` —
`test:day-first-timeline` + `test:signed-copy-extraction` +
`test:copy-rulings-binding`. Seat `onboardingtype`.

---

**R-164** · Programmed-part heading scale (Sam, 2026-08-24) · **MAKE THE
PROGRAMMED HEADINGS READABLE.**

On the Program Day strength view, **Mobility / Warm-up** and programmed-part
headings such as **Strength** use the same 15px scale as **Need to make a
change?** Their exercise-count lines remain compact. Team Training's **Session
status** label also remains compact because it is status metadata, not a
programmed part heading. · `WORKING` — `test:day-first-timeline`. Seat
`onboardingtype`.

---

**R-165** · Program Week-card surface consistency (Sam, 2026-08-24) · **WEEK
USES THE SAME DARK CARD SURFACE AS DAY.**

Ordinary Week-view day cards reuse the darker programmed-session surface from
Day view instead of the lighter default card colour. The current-day card keeps
its existing lime selected treatment, and week-edit move targets keep their
feedback colour. · `WORKING` — `test:day-first-timeline`. Seat
`onboardingtype`.

---

**R-166** · Profile page-card surface consistency (Sam, 2026-08-24) ·
**PROFILE USES THE SAME DARK CARD SURFACE.**

Every section card on the Profile page uses one shared `#101010` darker surface:
Program Setup, FAQ, Support, Developer Tools, Legal and Danger Zone. The green
**Something changed? Tell the coach** strip and the red Danger Zone border keep
their existing semantic treatments. Setup-sheet cards are outside this page
surface ruling. · `WORKING` — `test:profile-reset-ui`. Seat `onboardingtype`.

---

**R-167** · Welcome first-card heading replacement (Sam, 2026-08-24) ·
**FULL ATHLETIC DEVELOPMENT.**

The **YOUR PLAN** card heading is **Full athletic development**. Its body remains
**“Strength, speed, conditioning and recovery.”** The retired **Train everything
that matters**, **Built as one program** and **Everything works together**
headings are absent. · `WORKING` — `test:onboarding-presentation`. Seat
`onboardingtype`.

---

**R-168** · Seven-across weekday labels (Sam, 2026-08-24) · **FIRST LETTER
ONLY.**

The seven-across Game Day and usual gym-day pickers display **M T W T F S S**,
not **Mon Tue Wed Thu Fri Sat Sun**. Each tile keeps its full weekday as its
accessibility label. The shared 3-3-1 picker retains its three-letter labels. ·
`WORKING` — `test:onboarding-presentation`. Seat `onboardingtype`.

---

**R-169** · Team-training weekday layout (Sam, 2026-08-24) · **MATCH THE
SEVEN-ACROSS LETTER ROW.**

The Team Training Days picker uses the same single **M T W T F S S** row as
Game Day and usual gym days. It remains a multi-select answer and retains its
existing Continue rule and selected-count feedback. · `WORKING` —
`test:onboarding-presentation`. Seat `onboardingtype`.

---

**R-170** · Session-duration feedback and stopwatch handoff (Sam, 2026-08-24) ·
**ONE MINUTES FIELD; THE STRENGTH TIMER PREFILLS IT.**

Team Training, Game and programmed-session feedback show one **Minutes** field,
not separate Hours and Minutes fields. Existing stored durations remain total
minutes and reopen as that same total. For a strength session, Pause preserves
the frozen elapsed reading, End stores it, and Log Session captures the latest
elapsed reading before opening feedback. A timer result is matched by workout
and date, pre-fills the editable Minutes field, and never replaces an already
saved athlete answer. If the timer was never used, the field stays blank for the
athlete's estimate. · `WORKING` — `test:session-logging-ui`. Seat
`onboardingtype`.

---

**R-171** · Added-session identity across destination shapes (Sam, 2026-08-24) ·
**THE DAY CHANGES; THE SESSION DOES NOT.**

Adding Recovery, Mobility, Primer, Gunshow, Accessories, conditioning or
strength to a Team Training-only day keeps the added session's own type,
headline, exercises and prescriptions. Team Training remains a separate
component. Adding the same choice to a free day produces the same programmed
session content without inventing Team Training. · `WORKING` —
`test:athlete-door-matrix` + `test:session-components`. Seat `onboardingtype`.

---

**R-172** · Week Add-game icon parity (Sam, 2026-08-24) · **ONE GAME TROPHY.**

The **Add a game** row inside **Edit this week** uses the exact shared trophy
drawing and amber colour owner used by Game Day on the Week view. It does not
use the similar library `trophy-outline` glyph. · `WORKING` —
`test:day-first-timeline`. Seat `onboardingtype`.

---

**R-173** · Off-season finish-date anchor (Sam, 2026-08-24) · **ASK FOR THE
FINISH DATE; DERIVE THE OFF-SEASON WEEK.**

When an athlete chooses Off-season, onboarding asks **“When did your season
finish?”** and stores the exact local calendar date. **“I'm not sure”** is an
explicit answer and falls back to recently finished. The first complete Monday
after the finish date is Phase Week 1; the existing season clock derives early
(weeks 1–2), mid (weeks 3–4) and late (week 5 onward) from that one anchor. The
app never stores a second early/mid/late answer. The same question is asked when
an existing athlete shifts into Off-season, and Review shows the saved answer.
The date cannot be impossible or in the future. · `WORKING` —
`test:phase-clock` + `test:onboarding-presentation` +
`test:profile-reset-ui`. Seat `onboardingtype`.
