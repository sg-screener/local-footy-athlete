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

**2026-08-28 implementation update (programming-remedy):** the paragraph above
is historical, not current debt. `3417731e` removed the old flavour translation;
the current typed selector has a COD pool. C12's four obsolete missing-map
expectations have been replaced by `conditioningCategoryTruth`, exercising all
seven categories and their actual prescriptions. Four deliberately reintroduced
category-loss defects fail that guard. This does not invent a COD quota or change
the no-team-training eligibility ruling. See
`docs/PROGRAMMING_GAP_CLOSURE_2026-08-28.md` for the diagnostic classification.

**R-004** · *"that way the app isn't guessing"* · The Christmas break is set by
ASKING: ~10 Dec *"When does team training finish before Christmas?"*, ~3 Jan
*"When does team training start again?"*. The dates are defaults for WHEN TO
ASK, never inferred answers. **Sam, 2026-09-03:** retain 3 January and present
the live question as a compact top-of-Program notification in both Day and Week,
using the missed-session question shape and a yellow calendar-and-snowflake icon.
· `BUILT` — `src/rules/christmasBreakAsk.ts` holds both halves keyed to one break
year, with production readers in Home; `test:christmas-break` holds the calendar
and program effects, and its focused first arm holds the 9-cell presentation.
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
modifier indicator's shape. **Corrected from physical-device feedback,
2026-08-31:** Day's small card is now the canonical presentation on both Program
views. Week retains its own surface identity for tests and accessibility, but it
must not branch into separate copy, markup or styles. Both notices remain
read-only and open the same My Status destination. · `BUILT`. Guard:
`test:program-tab-read-only-modifiers`.

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
**R-311 CORRECTED 2026-09-01:** Off-season weeks 1-4 keep this exception and
contain zero automatic Speed. The separate ordinary-running-volume exemption remains.
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

---

**R-174** · Per-exercise Quick Swap and Quick Remove (Sam, 2026-08-24) ·
**ONE-TAP ROW SHORTCUTS; ONE EXISTING CHANGE SYSTEM.**

Every exercise row — Strength, Mobility / Warm-up, Conditioning and optional
recovery work — shows Quick Swap and Quick Remove together at the top right;
the completion checkbox sits at the bottom right, on the exact same centreline
as the weight control immediately to its left. Neither control changes the
card's height. The action glyphs match the exercise-name font size. Swap is the
purple circular chasing-arrows icon; Remove is one red circular control with a
plain minus glyph — never a second circle inside it. Quick
Swap applies the best legal match immediately; each later tap advances through
the same ranked list for that original slot and wraps only after every legal
answer has been tried. Quick Remove removes first, then asks whether the athlete
wants a replacement. **No** leaves the row out; **Yes** offers the existing
ranked legal matches. Because those two actions now belong to each exercise
row, the session-wide **Need to make a change?** hub contains only Equipment,
Injury and Add — it does not repeat Swap or Remove and make the athlete choose
the row twice. The controls are shortcuts into the existing safety,
durable program-control, ledger, exclusion and Undo owners — never a second
swap/remove engine. Derived warm-up and recovery rows store only the athlete's
decision and apply it to the live projection. · `WORKING` —
`test:quick-exercise-actions`, reached in-chain by `test:mobility-flow`. Seat
`onboardingtype`.

---

**R-175** · Supplied LFA wordmark on the four main tabs (Sam, 2026-08-24) ·
**ONE VECTOR LOGO; TOP-LEVEL BRANDING ONLY.**

The exact supplied LFA wordmark is rendered from one shared vector owner. Its
default is white on the app's dark background; the same paths may be tinted
black for a future light surface rather than maintaining a second drawing.
Program, Coach, Progress and Profile show the compact wordmark at the top left.
Coach and Progress no longer imitate it with styled `LFA` text. Nested workout
details, onboarding steps and sheets keep their own back-button/title hierarchy
and do not repeat the logo. · `WORKING` — `test:lfa-wordmark`, reached in-chain
by `test:profile-reset-ui`. Seat `onboardingtype`.

---

**R-176** · Quick Remove asks before changing the program (Sam, 2026-08-24) ·
**PENDING CHOICE FIRST; ONE COMMITTING ACTION SECOND.**

This corrects R-174's removal order. Tapping Quick Remove leaves the exercise
in the session and asks whether to show replacements, remove it without a
replacement, or **Go back** without changing anything. The exercise name is
written once in that question, not repeated as a subtitle. Choosing **Yes**
opens the ranked legal replacement list while the original row remains; picking
an answer commits one atomic swap. Choosing **No** commits the removal and then
asks its existing scope question. Only either committing choice changes the
Program screen, so closing or going back is a truthful no-op rather than a
missing Undo. R-174's sentence *"Quick Remove removes first"* is superseded by
this ruling; its icon, ranking, durability and row-coverage requirements remain
unchanged. · `WORKING` — `test:quick-exercise-actions`, reached in-chain by
`test:mobility-flow`. Seat `onboardingtype`.

---

**R-177** · Profile tab heading parity (Sam, 2026-08-24) · **THE TAB ALREADY
NAMES THE PAGE.**

Profile uses the shared LFA wordmark as its top-level header and begins its
actual content at **Program Setup**. It does not repeat **Profile** as a page
title or keep the now-orphaned *“Your program setup and support.”* subtitle.
This matches the other main tabs' compact branded hierarchy. · `WORKING` —
`test:lfa-wordmark` + `test:profile-reset-ui`. Seat `onboardingtype`.

---

**R-178** · Weekly Coach question without a preamble (Sam, 2026-08-24) ·
**ASK THE QUESTION; DO NOT ANNOUNCE IT.**

When the Coach raises a weekly-commitment question, the actual question is the
next Coach bubble after the greeting. The visible conversation does not first
say *“Your coach has something to ask about your week.”* The existing derived
Coach-tab dot remains the notification required by R-105, and its concise
accessibility announcement remains available outside the conversation. ·
`WORKING` — `test:coach-weekly-reduction`. Seat `onboardingtype`.

---

**R-179** · Profile goal label and setup-edit button (Sam, 2026-08-24) ·
**NAME THE GOALS; SHOW THE ACTION AS AN ACTION.**

Profile labels the athlete's focus row **Main goal/s**. **Something changed?
Tell the coach** is a distinct dark rounded edit button inside Program Setup,
using the same small lime pencil treatment as the established program-edit
button rather than looking like another data row. · `WORKING` —
`test:profile-reset-ui`. Seat `onboardingtype`.

---

**R-180** · LFA wordmark on programmed workouts and My Status (Sam,
2026-08-24) · **THE BRAND REPLACES THE GENERIC WORKOUT TITLE.**

Every programmed workout detail shows the shared LFA wordmark beneath Back in
place of its generic top title such as **Strength**; the section-level work
headings remain. **My Status** also shows the shared wordmark before its Season
Phase and modifier content. This deliberately supersedes R-175's exclusion of
nested workout detail from wordmark placement. · `WORKING` —
`test:lfa-wordmark`, reached in-chain by `test:profile-reset-ui`. Seat
`onboardingtype`.

---

**R-181** · Day change actions live in the change card (Sam, 2026-08-24) ·
**ONE DAY-LEVEL OWNER; NO DEDICATED SESSION-SWAP DOOR.**

The Day card's **Need to make a change?** section contains Tired, Sick,
Injured, Add, Move and Remove. The separate *“Want to change something?”* link
is deleted. The dedicated **Swap this session** option is deleted from both Day
and Week; Move may trade places with an ordinary occupied session when that is
the truthful result. Team Training is different: moving strength work onto its
day combines the two sessions and never swaps Team Training away. The open
workout keeps its narrower Equipment, Injury and Add hub because exercise-level
Quick Swap and Quick Remove already own row changes. · `WORKING` —
`test:day-first-timeline` + `test:move-scoping`. Seat `onboardingtype`.

---

**R-182** · Profile setup change is a primary action (Sam, 2026-08-24) ·
**SAME VISUAL PRIORITY AS START SESSION.**

**Something changed? Tell the coach** is a full-width lime primary button with
black text and a black pencil, using the same shared medium button treatment as
**Start Session**. This supersedes R-179's dark edit-button treatment: the
control is important enough to look immediately actionable rather than blend
into the Program Setup card. · `WORKING` — `test:profile-reset-ui`. Seat
`onboardingtype`.

---

**R-183** · Profile setup flow matches the Profile surface (Sam, 2026-08-24) ·
**A NEAR-FULL-SCREEN FLOW SHOULD NOT LOOK LIKE A DIFFERENT APP.**

The setup flow opened by **Something changed? Tell the coach** uses Profile's
near-black page background and `#101010` card surface instead of the generic
grey popup surface. Its summary rows reuse Profile's 13-point labels, 14-point
values, spacing and 12-point card radius; edit rows use the established
15-point action scale. It still uses the shared Sheet, SheetHeader, buttons and
selection controls, so only the Profile-specific surface changes rather than
restyling every popup in the app. · `WORKING` — `test:profile-reset-ui`. Seat
`onboardingtype`.

---

**R-184** · Profile setup button has no pencil (Sam, 2026-08-24) ·
**THE WORDING ALREADY NAMES THE ACTION.**

The full-width lime **Something changed? Tell the coach** button keeps the same
shared medium primary treatment and behaviour, but has no decorative pencil
icon. This supersedes only the pencil requirement in R-182. · `WORKING` —
`test:profile-reset-ui`. Seat `onboardingtype`.

---

**R-185** · Profile setup is a page, not a popup (Sam, 2026-08-24) ·
**THE REVIEW FLOW IS A REAL DESTINATION.**

Tapping **Something changed? Tell the coach** opens a full-height Profile
subpage rather than a Sheet. It keeps the bottom tab bar and uses the same
top-left Back geometry as My Status. On the overview, Back returns to Profile;
inside an edit step, Back returns through that flow. The existing setup decision,
save transaction and focused equipment editor remain unchanged, and closing the
equipment editor returns to the setup page. This supersedes R-183's popup
presentation while retaining its approved colours and typography. · `WORKING`
— `test:profile-reset-ui` + `.maestro/golden/profile-setup-equipment.yaml`. Seat
`onboardingtype`.

---

**R-186** · Profile setup doorway matches its internal edit rows (Sam, 2026-08-24) ·
**ONE ACTION FAMILY, ONE VISUAL LANGUAGE.**

**Something changed? Tell the coach** uses the same dark action row, lime text
and right chevron as **Edit player details**, **Edit equipment** and **Edit
program details**. One shared component renders all four controls, so the
doorway cannot drift from the actions on the page it opens. It keeps no pencil.
This supersedes R-182's lime primary-button treatment. · `WORKING` —
`test:profile-reset-ui`. Seat `onboardingtype`.

---

**R-187** · Programmed section headings use normal casing (Sam, 2026-08-24) ·
**PROGRAMMED WORK DOES NOT SHOUT.**

Every section heading inside the Day programmed-work box uses its authored
normal casing — Mobility / Warm-up, Strength, Conditioning, Primer, Recovery,
Gunshow and future sections through the same renderer. Compact status labels
and badges such as SESSION STATUS and CORE remain uppercase. The shared
programmed-heading style owns the distinction; signed copy strings are not
rewritten. · `WORKING` — `test:day-first-timeline`. Seat `onboardingtype`.

---

**R-188** · Midline stays inside its session (Sam, 2026-08-24) ·
**MIDLINE IS WORK, NOT A SESSION NAME.**

Midline rows remain inside Strength or Conditioning even when edits leave them
as the only non-power work. Day and Week must never create a separate Midline
Work component or join it into the session headline. The row remains visible
and completable inside its owning session. · `WORKING` — `test:midline` +
`test:action-walker`. Seat `onboardingtype`.

---

**R-189** · Quick Swap similarity must be real (Sam, 2026-08-24) ·
**A SHARED FAMILY IS NOT A MATCH.**

The specialist swap ladder keeps its authored pattern and safety logic. The
generic Add-taxonomy completion may offer only exercises from the original
exact leaf and role; it may not exhaust the leaf and then call the rest of the
Strength library “similar.” A typed visible section may still correct an
ambiguous exercise name. Therefore a midline exercise such as Band Pallof Press
can never offer power work such as Box Jumps. Fewer truthful swaps are better
than a long irrelevant list. · `WORKING` — `test:quick-exercise-actions`,
reached in-chain by `test:mobility-flow`. Seat `onboardingtype`.

---

**R-190** · Fresh onboarding state is empty, never absent (Sam, 2026-08-24) ·
**A CLEAN INSTALL MUST NOT DEPEND ON HYDRATION HAVING ALREADY WON A RACE.**

The accepted-state calendar and readiness writers treat an unhydrated or
legacy-missing map as their canonical empty map. Installing the first program
may therefore clear or publish accepted state before persistence hydration
without crashing on `Object.keys(undefined)`. Existing answered facts retain
their guarded reset rules; absence is normalised only at the ownership
boundary. · `WORKING` — `test:calendar-ownership` +
`test:readiness-store-ownership`. Seat `onboardingtype`.

---

**R-191** · New onboarding means a new training context (Sam, 2026-08-24) ·
**A NEW ATHLETE NEVER INHERITS THE PREVIOUS ATHLETE'S PROGRAM FACTS.**

Accepting a newly generated onboarding program clears previous calendar
overrides, readiness answers, coach constraints, injury episodes, temporary
facts, program edits, feedback and load overrides before publishing the new
program. The usual game day remains one recurring Profile fact; onboarding
does not materialise every occurrence into dated Calendar overrides. This is
one fresh-program boundary, not screen-specific cleanup. · `WORKING` —
`test:accept-boundary-contract`. Seat `onboardingtype`.

---

**R-192** · Onboarding questions and answers use normal casing (Sam, 2026-08-24) ·
**THE ONBOARDING FLOW DOES NOT SHOUT.**

Onboarding keeps its larger readable heading scale but uses the same System
typeface and natural casing as the rest of the app. Questions and answer-card
labels are sentence case; no heading variant forces uppercase, and no
hard-coded option label recreates it. The **BUILT FOR FOOTY.** Welcome hero,
small eyebrow/status labels and intentional acronyms such as LFA remain their
authored brand/label treatment. This supersedes R-151's carve-out that left
authored all-capitals answer copy untouched. · `WORKING` —
`test:onboarding-presentation`. Seat `onboardingtype`.

---

**R-194** · Status stays immediate; day scheduling gets one doorway (Sam, 2026-08-24) ·
**STATE AND SCHEDULE ARE RELATED, NOT THE SAME ACTION.**

The Day **Need to make a change?** card exposes **Tired**, **Sick** and
**Injured** as its only direct status buttons. **Add**, **Move** and **Remove**
do not sit beside them as equal-weight buttons; one visually separate
**Edit day** doorway opens the existing deterministic Add / Move / Remove menu.
The legacy **Want to change something?** link and dedicated whole-session Swap
remain absent. The menu continues to derive capability from the selected day
and commits through the accepted-state transaction owner. This supersedes only
R-181's six-direct-button presentation; its movement and Team Training rules
remain standing. · `WORKING` — `test:session-change-hub` +
`test:day-first-timeline` + `test:move-scoping`. Seat `onboardingtype`.

---

**R-195** · Day status card names the athlete-state question plainly (Sam, 2026-08-25) ·
**STATUS WORDS STAY ON THE STATUS SURFACE.**

The Day status card reads **Not feeling 100%?** followed by **Tell us what’s
changed and we’ll adjust your training.** Tired, Sick and Injured remain
unchanged beneath it. The active workout's Equipment / Injury / Add hub is a
different question and therefore retains **Need to make a change?** plus its
existing session-specific explanation. · `WORKING` —
`test:session-change-hub` + `test:day-first-timeline`. Seat `onboardingtype`.

---

**R-196** · Plan options live on the programmed session card (Sam, 2026-08-25) ·
**STATUS CHANGES THE ATHLETE; PLAN OPTIONS CHANGE THE SESSION.**

The Day status card contains only **Tired**, **Sick** and **Injured**. A compact
`•••` control sits beside the programmed session's tier badge and opens the
existing deterministic Add / Move / Remove menu. The dots remain visually small,
but their invisible touch area is 44 × 44 points. Rest and Team Training-only
days retain a direct **Add a session** doorway because no programmed-session card
exists there to own the dots; Game Day keeps its specialised controls. This
supersedes R-194's full-width **Edit day** presentation, not its separation of
status from scheduling or any plan-change validation/write rule. · `WORKING` —
`test:session-change-hub` + `test:day-first-timeline` + simulator tap-through.
Seat `onboardingtype`.

---

**R-197** · Plan Add row names its destination (Sam, 2026-08-25) ·
**THE ACTION ADDS WORK TO THE SESSION ALREADY ON SCREEN.**

The first row in the programmed session's plan-options menu reads **Add to this
session**. It no longer reads **Add this session**. The action, sub-line and
deterministic Add flow are otherwise unchanged. · `WORKING` —
`test:day-first-timeline` + simulator tap-through. Seat `onboardingtype`.

---

**R-198** · Plan Remove row states the result plainly (Sam, 2026-08-25) ·
**REMOVING THE ONLY PROGRAMMED SESSION MAKES THE DAY A REST DAY.**

The destructive plan-options row reads **Remove session**. When removing that
session leaves the day empty, its sub-line reads **Make this a rest day**. On a
combined day, the existing truthful sub-line continues to explain that anything
else on the day stays; the interface never promises a rest day while Team
Training or other work remains. · `WORKING` — `test:day-first-timeline` +
`test:move-scoping` + simulator tap-through. Seat `onboardingtype`.

---

**R-199** · Programmed-session popup names what it contains (Sam, 2026-08-25) ·
**THE DOTS OPEN OPTIONS FOR THIS SESSION.**

The popup opened from the programmed-session card's `•••` control is headed
**Session options**. The previous **Plan change** heading is retired on this
entry path. The date and the Add / Move / Remove actions remain unchanged. ·
`WORKING` — `test:accessibility-contracts`. Seat `headeralign`.

---

**R-200** · Day status explanation speaks only about today (Sam, 2026-08-25) ·
**A SAME-DAY STATUS CHECK PROMISES A SAME-DAY ADJUSTMENT.**

The **Not feeling 100%?** card says **Tell us what’s changed and we’ll adjust
today.** The previous ending **we’ll adjust your training** is retired. Tired,
Sick and Injured remain unchanged. · `WORKING` —
`test:session-change-hub`. Seat `headeralign`.

---

**R-201** · Week adjustment sheet uses the shorter heading (Sam, 2026-08-25) ·
**THE SHEET SAYS ADJUST WEEK, THEN ASKS WHAT THE ATHLETE WANTS TO CHANGE.**

Tapping **Edit this week** opens a sheet headed **Adjust week**. Its first
question is **What do you want to change?** This corrects the earlier
**What changed this week?** wording. The existing Bye, Game, Away and session
options remain unchanged. · `WORKING` — `test:day-first-timeline`. Seat
`headeralign`.

---

**R-202** · Week adjustment options explain their result (Sam, 2026-08-25) ·
**FOUR OPTIONS, EACH WITH ONE PLAIN EXPLANATION.**

The first **Adjust week** screen reads: **I have a bye** / **Remove this week’s
game**; **Add a game** / **Add a game and adjust training around it**; **I’m
going away** / **Tell us when you’re away**; and **Manage sessions** / **Add,
move or remove training this week**. **Add a game** is the one popup label in
both competitive phases; the underlying phase-aware picker is unchanged. ·
`WORKING` — `test:day-first-timeline`. Seat `headeralign`.

---

**R-203** · Week editing becomes a secondary control (Sam, 2026-08-25) ·
**THE WEEK IS FOR READING FIRST.**

The large green-tinted **Edit this week** bar is removed. One compact `•••`
control sits at the right of the previous / date range / next row and opens the
same **Adjust week** sheet. Its visible dots match the Day pattern and retain a
44-point physical tap target. The range remains centred and Monday moves up into
the space the old bar occupied. · `WORKING` — `test:day-first-timeline`. Seat
`headeralign`.

---

**R-204** · Week adjustments are grouped by purpose (Sam, 2026-08-25) ·
**SCHEDULE CHANGES AND TRAINING ARE DIFFERENT KINDS OF EDIT.**

The first **Adjust week** screen groups **I have a bye**, **Add a game** and
**I’m going away** under **Schedule changes**. Their explanations read
**Remove this week’s game**, **Add another game to this week** and **Adjust
around travel or time away**. A small divider and gap then introduce
**Training**, whose one row reads **Manage sessions** / **Add, move or remove
training**. The same four action doors and their underlying behaviour remain
unchanged. · `WORKING` — `test:day-first-timeline`. Seat `headeralign`.

---

**R-210** · Active-session popup matches Day options and keeps its icons (Sam, 2026-08-25) ·
**MOVING AN ACTION DOES NOT REDRAW IT OR INVENT A SECOND MENU STYLE.**

The active-session `•••` popup uses the same flat label/subline rows, circular
icon wells, quiet dividers and centred ghost **Back** treatment as the Day
plan-options popup. It restores the active-session actions’ original exact
dumbbell, medical-cross and plain-plus SVG paths, colours and tints; the
substitute medical bag and outlined-plus icons are removed. Copy, order,
availability and the three established handlers remain unchanged. · `WORKING`
— `test:session-change-hub`. Seat `headeralign`.

---

**R-211** · Active-session options use the final question and explanations (Sam, 2026-08-25) ·
**THE MENU ASKS WHAT TO CHANGE, THEN EACH ROW SAYS WHAT IT NEEDS.**

The active-session sheet is headed **Session options** / **What do you want to
change?**. **Something hurts** reads **Adjust around pain or a niggle**.
**Equipment changed** reads **Tell us what’s missing**. The Add row, option
order, icons and established handlers remain unchanged. · `WORKING` —
`test:session-change-hub`. Seat `headeralign`.

---

**R-209** · Active-session changes move behind one options menu (Sam, 2026-08-25) ·
**THE SESSION HEADER OFFERS ONE QUIET DOORWAY, NOT A SECOND CHANGE CARD.**

The active-session header gains compact, circle-free `•••` matching the Week
control, with a 48-point invisible target. It opens **Session options** / **Need
to make a change?** with: **Something hurts** / **Adjust this session around a
niggle or injury**; **Equipment changed** / **Update what you have available**;
and **Add an exercise** / **Add something to this session**. Equipment remains
absent when the open session has no equipment requirements, rather than becoming
a dead button. Each option closes the menu and enters its established Injury,
Equipment or Add flow. The old active-session **Need to make a change?** card is
removed; row-level Quick Swap and Quick Remove remain where they are. ·
`WORKING` — `test:session-change-hub`. Seat `headeralign`.

---

**R-207** · Week Add action names the next choice briefly (Sam, 2026-08-25) ·
**THE EXPLANATION SAYS WHAT HAPPENS NEXT.**

The nested **Add a session** row reads **Choose a day to add it to**, replacing
R-206’s longer **Put another session on a day this week** explanation. Its Add
route is unchanged. · `WORKING` — `test:day-first-timeline`. Seat `headeralign`.

---

**R-208** · Week hierarchy stays visible without shouting (Sam, 2026-08-25) ·
**TODAY IS MARKED, WEEK OPTIONS ARE EASY TO HIT, AND METADATA IS LEGIBLE.**

The current-day Week card keeps its **TODAY** pill but replaces the full lime
outline with a one-point faint olive border and slight dark-olive tint. The
Week `•••` keeps its visible 24-point, circle-free treatment while its invisible
target grows to 48 points. Exercise-count metadata such as **6 exercises** uses
a slightly brighter grey. No card action or navigation behaviour changes. ·
`WORKING` — `test:day-first-timeline`. Seat `headeralign`.

---

**R-205** · Week adjustment heading names this week (Sam, 2026-08-25) ·
**THE SHEET NAMES THE SPECIFIC WEEK BEING CHANGED.**

The sheet opened from the Week dots is headed **Adjust this week**, superseding
R-201’s shorter **Adjust week** heading. Its question, grouped options and all
underlying behaviour remain unchanged. · `WORKING` —
`test:day-first-timeline`. Seat `headeralign`.

---

**R-206** · Week session actions explain the next choice (Sam, 2026-08-25) ·
**EACH TRAINING ACTION SAYS WHAT THE ATHLETE WILL CHOOSE NEXT.**

The nested **Manage sessions** step reads: **Add a session** / **Put another
session on a day this week**; **Move a session** / **Choose a session and move
it to another day**; and **Remove a session** / **Choose a session to remove
from the week**. Their order, icons and existing Add / Move / Remove routes are
unchanged. · `WORKING` — `test:day-first-timeline`. Seat `headeralign`.

---

**R-212** · Session equipment asks what is available today (Sam, 2026-08-25) ·
**THE SUB-SHEET MATCHES THE MENU THAT OPENED IT AND SUMMARISES IMPACT WITHOUT
TURNING INTO AN EXERCISE LIST.**

Tapping **Equipment changed** opens **Equipment** / **What do you have today?**
with **Untick anything you don’t have. We’ll adjust affected exercises around
what’s available.** Its rows match the parent Session Options sheet’s flat-row
style. Up to three affected exercises are named; four or more read **N exercises
affected**. The primary button always reads **Update session**. A centred ghost
**Back** replaces the top-right Cancel treatment. Equipment selection and its
existing apply pathway remain unchanged. · `WORKING` —
`test:session-action-shell`. Seat `headeralign`.

---

**R-213** · *"yes it should count them as exercises - they just shouldn't count
towards fatigue really but i think the whole session is the thing you give
feedback on not the exercises themselves"* and *"If a warm up is already ticked
off then it should stay, but otherwise swapping it for something else is okay if
they change a main lift because the warm up is supposed to prepare them for the
work ahead."* (Sam, 2026-08-25) · **WORK THE ATHLETE HAS ALREADY DONE OUTRANKS A
MENU RE-PICKED UNDERNEATH THEM.**

Raised by Sam from his own session: *"i think the mobility warm up is constantly
missed somehow"*. **He was right, and one cause explains every symptom he
listed.** The warm-up is DERIVED beside the session rather than stored in it, so
each surface has to remember to ask `selectMobilityPrehabFlow` for it separately
— and the ones that forgot are exactly the ones he noticed: the header count
(template only, so `8 exercises` for 8 strength rows plus a 4-movement warm-up),
the completion tick, and the swap door. The last two were wired in later; the
count never was.

**MEASURED 2026-08-25, headless, through the screen's own owners.** Swapping one
main lift on an 8-row lower day re-derived 2 of the 4 warm-up movements. The
saved ticks were keyed to the movements that vanished, so the reconciler saw ids
no longer in the plan: **2 of 4 ticks lost and the Mobility section's saved
completion went from `full` to unknown.** The athlete's OWN warm-up swap was
lost the same way — its decision is keyed to the slot id that no longer existed.

**THE FIX IS AN INPUT TO THE ONE OWNER, NOT A PATCH AT EACH SURFACE.**
`performedMovementIds` is a REQUIRED field on `MobilityPrehabFlowContext`
(`utils/sessionExecutionChecklist`'s `performedMobilityMovementIds` reads it off
the saved record), because the defect class here is a surface FORGETTING the
warm-up and an optional field is one a new screen omits without noticing. Both
halves of the ruling are held: a performed movement the fresh fill dropped is put
back, and everything NOT ticked is whatever the fill just chose for the new work.

⚠ **THE AUTHORED MENU SHAPE MAY NOW BE BROKEN, DELIBERATELY, AND ONLY HERE.** A
retained movement can come from a category the session's current menu does not
contain, so `mobilityPrehabFlowTests` §1 asserts the shape for a flow with
nothing performed. **The COUNT is not broken at all** — retention re-places work
inside the count the menu produced and never pads past it.

⚠ **FATIGUE IS UNCHANGED, WHICH IS THE HALF THAT NEEDED NO WORK.** R-049 (*"Dose
counts main work only. Warm-up and cool-down never count"*) and R-088 (the cap
counts strength rows only) already keep the warm-up out of load; the journal
engine never reads the flow. Counting warm-up movements AS EXERCISES and keeping
them out of fatigue were already two different questions in the code.

⚠ **NOT COVERED.** A tick that has not been saved yet: retention reads the
durable record, so ticking a warm-up and changing a main lift *before* logging
the session can still re-pick it. Raised for Sam rather than guessed at.

· `WORKING` — `test:mobility-flow` §7, 16 cells. Mutation-proven: neutering
retention, dropping the fresh-fill dedup, removing the count cap and ignoring
the ticked flag each red exactly one cell and only one. **The dedup mutation
survived TWO cells before it bit** — with every movement ticked, restoring all
of them and trimming to the menu count gives the same four either way, so the
cap was hiding the missing dedup; the cell that catches it ticks ONE movement.
Seat `warmup`.

---

**R-214** · *"can we remove the calendar icon, the Tue 25/8 - 8 exercises, then
put the start session button in its place?"* (Sam, 2026-08-25) · **THE SESSION
HEADER'S SECOND LINE IS A CONTROL ROW NOW, NOT A CAPTION.**

**SUPERSEDES R-116**, whose four passes aligned that calendar glyph's optical
centre against that date text, and **moves R-132's stopwatch** from the right of
the line to its left. Both deliberately: what Sam removed is the line's CONTENT,
and the geometry those rulings settled has nothing left to align.

`Start session` leads the row; the Session Options dots keep the right. The row
is now gated on `date` rather than on the subtitle string — gated on the words,
deleting them would have taken Start session and the options door with them.

⚠ **IT RETIRES THE EXERCISE COUNT RATHER THAN CORRECTING IT.** Sam ruled in the
same conversation that the warm-up SHOULD count as exercises (R-213), then
removed the only surface that showed a number. A corrected count with no reader
is the dead weight this repo keeps paying for, so it is deleted with its
surface. **If a count ever returns, it counts the execution plan — the one list
that already holds both the strength rows and the warm-up — and never the
template.**

⚠ **`components/SessionDateLine.tsx` IS DELETED, NOT LEFT UNMOUNTED**, and its
`DATE_LINE_HEIGHT` moved to `SessionStopwatchControl`, its one remaining
consumer. An unmounted component is a second header waiting to be remounted.

⚠ **THE SIX GUARDS THAT REQUIRED THE DATE LINE ARE INVERTED, NOT DELETED**
(`gate-must-watch-the-deleted-surface`). They now require the removal to stay
removed, the glyph not to return as an icon-font name, and Start session to
precede the dots on that row. · `WORKING` — `test:session-execution` §[10].
Seat `warmup`.

---

**R-214a** · *"there's not enough gap between the start session button and the
LFA logo — move start session down a bit so the padding above start session
matches the padding below start session before mobility. The three dots across
the other side should drop with it so they remain in line."* (Sam, 2026-08-25) ·
**A CONTROL ROW IS NOT A CAPTION, AND IT DOES NOT SIT CAPTION-TIGHT.**

The `marginTop: 3` was tuned when this row held a grey date caption bound
deliberately to the wordmark above it. R-214 replaced that caption with a
button, and 3 points then read as Start session touching the logo.

**THE GAP BELOW IS THREE TERMS AND THE FIX IS WRITTEN AS THEIR SUM**, not as the
number 20: the header's own `paddingBottom` (`sm`), the scroll's `paddingTop`
(`xs`), and the first section header's `paddingVertical` (`sm`) above its
heading. A later spacing pass on any one of them now moves both sides together
— a hardcoded 20 would silently unbalance the row, which is how the 3 survived
its own reason disappearing. The dots share the row, so they drop with it and
need no rule of their own.

⚠ **AND THE CAPTION'S TEXT STYLE WENT WITH THE CAPTION.** `headerSubtitle` had
zero consumers after R-214 — a style whose only reader is deleted is dead weight
the next screen will trust. · `WORKING` — `test:session-execution` §[10], 2
cells, mutation-proven: restoring `marginTop: 3` reds the sum cell and only it.
Seat `warmup`.

---

**R-215** · *"can you remove the option to hit 'end' after you hit start
session? the timer will just end when the user logs their session and hits 'save
and finish'."* (Sam, 2026-08-25) · **ONE ACTION ENDS A SESSION'S TIMER, AND IT
IS THE ONE THAT CANNOT BE TAKEN BACK.**

**PARTIALLY SUPERSEDES R-132**, whose *"a timer next to it that you can pause or
end"* built both controls. The pause half stays; the End button is deleted and
`session.stopwatch.end` is **deregistered, not left signed for nobody** — a
signed string with no surface is copy the next build finds, trusts as ruled, and
puts back on a screen Sam asked to clear.

⚠ **AND THE MOVE FIXED A DEFECT NOBODY HAD NAMED.** The end was NOT already at
Save & Finish: `handleFinishWorkout` ended the stopwatch and then flipped the
flag that OPENS the feedback sheet — and `handleCancelFeedback` flips that flag
straight back. **An athlete who tapped Log session and then cancelled had
already lost their running timer with no way to resume it.** The end now lives
in `handleFeedbackSaved`, and it is `endFor` rather than `end` so a stopwatch
running on another day's workout is never stopped by this save.

⚠ **THE PRE-FILLED MINUTES ARE UNCHANGED.** `measuredMinutesFor` reads a RUNNING
stopwatch by deriving its elapsed without mutating it — the exact case it was
written for — so the form still opens with the measured number even though the
timer is no longer stopped before it appears.

⚠ **THE STORE KEEPS `end`.** It is `endFor`'s foundation and the save door is
now its one caller. What was deleted is the BUTTON, and a cell requires the
control to have no path to the store's whole-session end, so a handler cannot
outlive it as the next screen's dead affordance. · `WORKING` —
`test:session-duration-feedback` §3/§4, **21 passed, 0 failed** (was 14/0).
Mutation-proven: removing the end from the save door reds the save cell and only
it. Seat `warmup`.

---

**R-216** · *"replace the capitalised headings for each section here to be
regular sentence case like the day view is"* (Sam, 2026-08-25) · **ONE LABEL
OWNER, ONE VOICE.**

`SECTION_LABELS` already reads `Mobility / Warm-up` and `Strength` — exactly
what the Day card prints. The session screen was SHOUTING the same strings
through `textTransform: 'uppercase'` plus 0.5 tracking. Both are deleted and
nothing replaces them; the strings are untouched, which is the point — this is
the same correction R-187 made on the Day card's own headings. · `WORKING` —
`test:session-execution`. Seat `warmup`.

---

**R-217** · *"add the little plus icon the bottom of the last box in each
section on session view — a 'quick add' feature that allows the athlete to add
an exercise to that section ... have it follow the same pathway as the old 'add
exercise' button, then remove the old add exercise button."* (Sam, 2026-08-25) ·
**THE ADD DOOR MOVES INTO THE SECTION IT ADDS TO.**

**IT IS THE SAME PATHWAY, ENTERED ONE RUNG DOWN.** R-120's level 1 is
*Strength / Conditioning / Mobility / Warm-up* — and the plus has already
answered that by WHERE it was tapped, so it opens at `openAddFamily`. No second
add flow exists: same `legalAddFamilies`/`legalAddCandidates` legality, same
rungs, same confirm.

**NO TRANSLATION TABLE, BY CONSTRUCTION.** `AddFamilyId` is an `Extract` of
`SessionExecutionSectionId`, so a section and an add family are one identity. A
section outside those three — Accessories, Recovery, Optional Work — has no
family and gets no plus.

⚠ **MOUNTED IN THE ONE SECTION OWNER**, which both the standalone Mobility route
and `SessionList` render through, so a section cannot exist without having been
asked the question. A per-route plus is a plus one route forgets — the R-213
lesson, applied before it could cost anything. A collapsed section shows none.

⚠ **THE MENU ROW IS REPLACED, NOT DUPLICATED** — Sam's word. `openExerciseAdd`
(level 1) had that row as its only caller and is deleted with it, and
`session.options.add.label`/`.subline` are **deregistered rather than left
signed for nobody**. `session.quick_add.label` (*"Quick add"*) is spoken only:
the control is a bare glyph, so a screen reader hears it beside the section
name.

⚠ **ITS "Nothing safe to add today" SENTENCE IS GONE, DELIBERATELY.** That
fallback fired only when EVERY family was empty. Legality is now read per
section before a plus is drawn, so a section with nothing safe shows no control
instead of a control that opens on a refusal — the honest answer moved from a
sentence to an absence. · `WORKING` — `test:session-change-hub` §5b, **55
passed, 0 failed**. Mutation-proven: dropping the plus from the `SessionList`
route reds the both-routes cell, and removing the legality check reds the
families cell — each alone. Seat `warmup`.

---

**R-217a** · *"the little gap between the line and the last exercise needs to be
smaller, the line itself can be slightly smaller, and the + button itself can be
slightly smaller"* (Sam, 2026-08-25, eye pass on R-217) · **THE QUICK-ADD BLOCK
TIGHTENS AS ONE.**

Gap above the connector `sm` -> `xs`, connector 10 -> 6, button 28 -> 24 with its
glyph 16 -> 14 and its own top gap 6 -> 4. The tap target is unchanged: the
`hitSlop={10}` was already doing that work, which is why the visible circle
could shrink without the control getting harder to hit.

**SECOND PASS, SAME EYE:** *"move to 0 ... keep the plus the same size but move
the circle to 20 ... the tap area can shrink i want there to be less space
there"*. Gap `xs` -> 0, so the line starts on the last card's edge; circle
24 -> 20 around an **unchanged 14 glyph**; `hitSlop` 10 -> 4. **The glyph
staying put while the ring closes on it is the instruction** — a later pass must
not "rebalance" the plus down to fit the smaller circle.

⚠ **THIRD PASS, AND THE FIRST TWO HAD NOT FOUND THE REAL GAP.** Sam, on a crop:
*"look at where the bottom of the last box finishes and where the line starts...
why the gap"*. `paddingTop: 0` was never going to close it —
`executionSectionBody` carries `gap: spacing.sm` and **the plus is one of its
children**, so the flex gap sat above the connector whatever padding the row
had. It is cancelled with `marginTop: -spacing.sm`, written as the SAME token so
a literal `-8` cannot silently reopen the gap the day the body's spacing
changes. A cell pins both halves together. · `WORKING` —
`test:session-change-hub`, ALL GREEN 56. Seat `warmup`.

---

**R-218** · *"you hit manage sessions — you get taken straight here — the dates
should not be selectable ... the day should be broken into its own thing but in
2 sections ... For days where nothing is planned, they can just be one box. Game
day is also one box. For rest days you should have a + icon ... for any box that
has a session in it, you should have a trash can symbol ... and these boxes
should be able to be dragged and dropped."* (Sam, 2026-08-25) · **THE WEEK BOARD.
Plan: `docs/WEEK_BOARD_PLAN_2026-08-25.md`.**

His four answers, asked before the plan: **two boxes is the cap**; a drop onto an
occupied box **swaps**; **every empty box carries a `+`**; the team-training box
**drags as `this_week_only`, no question**. His three corrections to the first
draft: the empty box is a property of **room**, not of rest days; **a day may
never hold three and speed is conditioning**; the old pathway is deleted **last**.

⚠ **THE BOXES ARE THE EXISTING MOVE SCOPES, AND THE DROP RULES ALREADY
EXISTED.** `move_session` already takes `whole_day | strength | conditioning |
recovery | team`, and `planChangeProducer` already computes destinations,
already refuses an occupied G-1 and already knows when a day is full. The board
RENDERS those owners. **A drop legality computed in the screen would be the
second authority this repo has already paid for twice.**

⚠ **THE SEAT'S "SPEED MAKES A THIRD PART" FLAG WAS RAISED AND WITHDRAWN,
MEASURED.** The generator places `speedBlock` as `pre_lift` when the day has
lifts and `standalone` when it does not, so speed is never a third thing.
Census over `generateProgramLocally` for all three season phases at 2026-07-13:
**84 workouts, ZERO days yielding more than two boxes.** The over-cap branch is
kept and renders every part rather than hiding one, so a future regression is
visible instead of silent.

**SLICE 1-3 LANDED** — the derivation, the board, the `+` and the bin, both
raising the same `changeSheetEntry` the retired rows raised. **Drag is slice 4
and is NOT built.** The old Add / Move / Remove rows are still compiled and are
now unreachable, deliberately and temporarily, at Sam's instruction that the old
pathway die last; `dayFirstTimelineTests` pins that exact transitional state so
a half-finished slice is visible rather than silently normal. · `WORKING` —
`test:week-board` 26 passed / 0 failed. Seat `warmup`.

---

**R-218a** · *"make this say 'add, bin or move your sessions' ... the dates don't
need to have their own boxes ... when I hit remove on a double day i get the
'just the gym session' or 'just team training' option still — it should know
which one I'm trying to delete because i hit the bin icon on that day."* (Sam,
2026-08-25, first look at the board) · **THE CONTROL THE ATHLETE TOUCHED IS AN
ANSWER, AND THE SCREEN MUST NOT ASK IT AGAIN.**

**The banner is his words**, replacing the seat's *"Add, remove or drag your
sessions"*: "bin" is the glyph he taps and "move" is what a drag DOES, so it
names outcomes rather than gestures.

**The date is not a box.** It was drawn as a filled rounded cell matching the
session boxes, so a row read as three boxes when only two are actionable. **A
label that looks like a control is the same defect as a control that looks like
a label.**

⚠ **THE BIN CARRIES ITS SCOPE, AND THIS DOES NOT WEAKEN THE SKIP LAW.** The
existing law refuses to skip the scope step when the APP would be INFERRING
which session was meant (Sam's finding 3: one offered scope on a two-session day
silently turned *"move the gym session"* into *"move everything"*). Here the
athlete answered with their thumb, on the box itself — R-120b's *"the path is
the context"*. **It is still validated against the producer's offer**: a scope
the producer does not offer for that day falls through to the question rather
than being committed. The board proposes; the producer still decides.

⚠ **BIN AND MOVE ARE DIFFERENT VOCABULARIES, AND THE CLUB NIGHT IS WHY.** Team
training carries no `move_session` scope — it travels through `move_team_night`
with a route — but it DOES have a `team` bin scope. One collapsed field would
have made the club night either un-binnable or movable by the wrong door, so
`WeekBoardBox` carries both. · `WORKING` — `test:week-board` 31 passed / 0
failed. Seat `warmup`.

---

**R-218b** · *"these boxes should be able to be dragged and dropped ... you
can't move more than 3 sessions to a day, and you can't move a
strength/conditioning/mobility etc session to where a team training box [is],
but you can drag a strength to a strength, or a strength to a free day."* (Sam,
2026-08-25) · **THE DRAG CHOOSES THE CHANGE. IT DOES NOT DECIDE WHETHER THE
CHANGE IS ALLOWED.**

A drop raises the SAME `apply` the destination list uses, so an illegal move
still refuses and a G-1 landing still raises its ask. **The board never commits
anything itself** — the two things `a-legality-probe-is-not-a-change-probe`
exists to keep apart.

⚠ **`activateAfterLongPress` IS WHAT LETS THIS LIVE IN A SCROLLING WEEK.** The
board sits in the Program tab's ScrollView; a pan claiming the touch immediately
would steal every attempt to scroll past it. A flick still scrolls, a hold
lifts. **This was named in the plan as the thing most likely to bite and is
answered by the gesture's own contract rather than by fighting the parent for
the responder.**

⚠ **THE FRAMES ARE MEASURED, NOT COMPUTED FROM THE STYLESHEET.** A hit-test
assuming "row 58 + gap 8, date column 44" would be a second copy of the layout,
wrong the first time a label wraps or the phone's text size changes.

⚠ **AND THE GESTURE'S POINT IS CONVERTED BEFORE IT IS TESTED.** Pan reports
`x`/`y` relative to the box it started on. Hit-testing those raw would match
whatever sits at the same offset in every row — a defect that reads as *"the
drop went to the wrong day"* and is really *"the two numbers were never in the
same space"*.

A refused drop gets a sentence, one per typed refusal: a spring-back with no
reason is indistinguishable from a fumbled drag. The club night drags as
`teamNightRoute: 'this_week_only'` and never raises the permanent ask, which is
Sam's answer given before the plan. · `WORKING` — `test:week-board` §5, 41
passed / 0 failed.

⚠ **NOT COVERED, AND IT IS THE SAFETY NET THIS SLICE MOST WANTED:**
`test:athlete-session-move` is **0 passed / 20 failed at HEAD**, before this work
and unchanged by it — the whole move suite is dark. The plan named it as slice
4's net and it cannot serve as one. **Raised for Sam; not this seat's to fix
inside a UI slice.** Seat `warmup`.

---

**R-218c** · *"the drag works but i cant seem to drop anything anywhere"* and
*"do the clean up"* (Sam, 2026-08-25) · **A DRAG THAT VISIBLY WORKS AND CAN
NEVER LAND, AND THE RETIREMENT OF THE OLD PATHWAY.**

⚠ **THE DROP BUG IS WORTH RECORDING BECAUSE IT LOOKED LIKE A GESTURE PROBLEM
AND WAS AN ARITHMETIC ONE.** Pan reports `x`/`y` relative to its own view — and
that view is being TRANSLATED BY THE FINGER, so the finger stays at nearly the
same point INSIDE the box for the whole drag. `onEnd`'s `event.x` was therefore
roughly `onStart`'s, every drop hit-tested back onto the box it came from,
resolved `same_day`, and returned in silence. **The two numbers a transform
cannot corrupt are the START offset and the TRANSLATION**; where the finger let
go is where it pressed plus how far it travelled. A cell pins that and reds if
`onEnd`'s own `x`/`y` are ever passed through again.

**THE OLD PATHWAY IS RETIRED, LAST, AS HE ASKED.** Gone: the nested *Add a
session / Move a session / Remove a session* step (R-206), its six signed
strings, the three `sessionAdd` / `sessionMove` / `sessionRemove` picker modes
and the whole-week tap-to-pick list they produced, the `edit-week-<action>-day`
identity, and the sheet's now-single-valued `step`. **`moveGame` and `addGame`
are untouched** — a fixture is still set and moved by picking a day, through its
own door.

⚠ **THE HANDLERS ARE UNTOUCHED, WHICH IS WHY HE ASKED FOR THIS ORDER.** The
board's `+`, bin and drag all raise the same `changeSheetEntry` with
`origin: 'week'` that those rows raised. **No second add, move or remove path
was built**, and the re-aimed cell in `dayFirstTimelineTests` is what would catch
one. Its transitional form — rows compiled but unreachable — did its job for two
commits and is now re-inverted to require the deletion. · `WORKING` —
`test:week-board` 43 passed / 0 failed; `test:session-change-hub` ALL GREEN 56;
`test:day-first-timeline` back to its 2 pre-existing reds. Seat `warmup`.

---

**R-219** · *"this should say 'add optional session'"* (Sam, 2026-08-25, on the
Rest Day card) · **WORK PUT ON A REST DAY IS OPTIONAL WORK, AND THE BUTTON SAYS
SO.** Rewords `day.add_session.action` from R-196's *"Add a session"*. The rest
day was the programmed answer; the word is the athlete's own reminder that what
they are adding sits on top of it. · `WORKING` — `test:signed-copy-extraction`.
Seat `warmup`.

---

**R-218e** · *"pulling a strength day to a strength day just disappeared the
session that was originally there = it didnt swap them"* (Sam, 2026-08-25) ·
**THE BOARD WAS SPEAKING A SCOPE THE PRODUCER NEVER OFFERED, AND AN UNOFFERED
SCOPED MOVE ABSORBS RATHER THAN SWAPS.**

**The board sent the BOX'S OWN scope** (`'strength'`). `moveOptionsForDay` does
not offer that for a day whose only content is a gym session — *"A
single-component day has nothing to scope: moving 'just the gym session' off a
day that is only a gym session IS the whole-day move, and offering both would be
two names for one action."* Such a day offers `['whole_day']` and nothing else.

**A `move_session` carrying an unoffered component scope is not a swap.** The
scoped path ABSORBS — Sam's doubling law, written for landing on a team night:
*"the move ABSORBS, the anchor stays put, and nothing travels back to the
source."* Absorbing into an occupied strength box overwrites it and returns
nothing. That is a session disappearing.

⚠ **THE TRANSACTION WAS NEVER THE FAULT, AND THE SEAT SAID OTHERWISE FIRST.**
It reported the loss as the known open conservation defect. Waking
`test:athlete-session-move` disproved that: cell 3, *"occupied compatible
destination swaps atomically"*, PASSES. **The swap works; the board was not
asking for one.** The earlier claim is withdrawn.

**THE FIX SPEAKS THE PRODUCER'S VOCABULARY RATHER THAN TEACHING THE BOARD A
SECOND ONE.** `weekBoardMoveScope` picks among the OFFERED ids: the box's own
component scope where the day offers it; otherwise `whole_day`, **but only when
that box is the day's whole movable content**, which is the precise case where
the two are one action under two names; otherwise nothing, and the drop is
refused rather than guessed at.

⚠ **THAT FALLBACK IS BOUNDED AND TWO CELLS KEEP IT SO.** Falling back to
`whole_day` whenever the component scope is missing would let a drag of ONE part
of a combined day move the entire day, club night included — the same class of
defect one step to the left. · `WORKING` — `test:week-board` §6, 54 passed / 0
failed. Seat `warmup`.

---

**R-218f** · *"this drag and drop screen is so fucking glitchy ... the dragging
doesn't lock into the next block ... I couldn't move Monday lowers to Wednesday"*
(Sam, 2026-09-01) · **THE DAY IS THE TARGET; THE LITTLE RECTANGLE IS NOT A
TINY RELEASE ZONE.**

The old board only chose a target after release, and only when the release
point sat inside the exact measured box. The date gutter and row gaps were dead
zones, no destination lit up, and a missed Monday dropped over Wednesday's
occupied half attempted a forbidden swap back into history even when Wednesday
had an empty slot.

The board now locks continuously to the nearest measured day and slot. Gaps
belong to the nearer day; outside the board still cancels. A lime outline and
haptic tick show the live destination, and the lifted card magnetically settles
into that slot while the canonical move owner decides. The card is opaque, so
the destination does not produce doubled text underneath it. A blocked target
uses the existing refusal owner and red state.

Dragging the exact past unlogged item currently named by the missed-session
prompt is itself the explicit *No, move it* answer; no preliminary chip tap is
required. No other past item becomes movable. Because a past move cannot put
future work back into history, an available destination slot wins across that
whole day. Ordinary future-to-future drags retain deliberate occupied-slot
swaps. · `WORKING` — `test:week-board` §5/5b and
`test:missed-session-prompt`; mutation disabling open-slot preference kills the
exact Monday-to-Wednesday cell. Real iPhone 17 Pro simulator press-hold-drag
verified lift, magnetic lock, occupied-session swap, landing and Save changes.
Seat `weekdragux`.

---

**R-220** · *"pulling a strength day to a strength day just disappeared the
session that was originally there = it didnt swap them"*, and his answer when
shown the conflict: **swap them** (Sam, 2026-08-25) · **AN ABSORB ONTO A CLUB
NIGHT THAT ALREADY HOLDS A SESSION IS A SWAP, NOT A ONE-WAY TRIP.**

**MEASURED, through the real door:** a 6-exercise lower day moved onto a Team
Training day carrying an 8-exercise upper session produced `Team Training +
lower` holding **6**, reported *"Done. Session moved."*, and lost the other 8.

**TWO CAUSES, AND THE SECOND IS WHY NOTHING CAUGHT THE FIRST.**

1. `teamTrainingAnchorContainer` builds the absorb base with `exercises: []` —
   right when the club night is ALONE, which is the doubling law's own case and
   where nothing can be lost; **the deletion itself** when it is not alone.
2. `detectAthleteMoveContentLoss`, the door's conservation post-condition,
   compares workout **IDENTITIES**. The combined day keeps the anchor's
   identity, so the check passed while the content went. Its own comment
   reasoned that an absorb displaces nothing *"because the anchor never left"* —
   true only for a bare club night. **`LAW-count-names-instrument`: the check
   named identities, not content.** This seat made the identical mistake in its
   first probe and had to correct it before the diagnosis was right.

**THE FIX KEEPS BOTH OF SAM'S RULINGS.** The day is split first: its gym session
comes off, the arrival takes that place beside the anchor, and the displaced
session goes back to the day the arrival came from. **The doubling law holds —
the anchor never moves and the day is still combined.** **The cap holds too** —
neither day ends up with three. Two gym parts on one club night is refused
rather than guessed at, because choosing one to displace would be choosing one
to delete.

⚠ **AN EARLIER ATTEMPT FILTERED THE DESTINATION OUT OF THE PRODUCER'S OFFER AND
WAS REVERTED.** It overturned the signed doubling law and reddened three cells
that pin it. **The guard belongs at the door every path passes, not beside the
one offer that exists today** — which is what the content-loss suite has been
saying about this whole class.

· `WORKING` — `test:athlete-session-move` cell 23, which calls the door DIRECTLY
rather than through the offer and follows EXERCISE NAMES rather than identities.
**Mutation-proven three ways:** removing the swap-back reds it *and shows the
conservation check correctly refusing*; removing the `displaced` survivor alone
survives, because the primary fix means nothing is lost; **removing BOTH
reproduces Sam's bug exactly — "the club night's own session lost 8"** — and the
cell catches it. `test:move-scoping` back to 17/1, its doubling cell green and
now asserting the swap. Seat `warmup`.

---

**R-221** · *"the bottom button should just say 'go back' too not double up on
leave frday free"* (Sam, 2026-08-25) · **A BACK ROW MUST NOT REPEAT AN OPTION
ABOVE IT.** The G-1 ask's back row read **Go back — leave Friday free**, signed
2026-07-30 on the reasoning that "Back" on a warning reads as "cancel" so the
row should say what it DOES. **That reasoning stopped applying the moment route
(a) on the same screen was already "Leave Friday free"** — the athlete read two
ways to do one thing. The day name goes with it and the row now takes no
context. Filed in the design document, so the copy census stays green rather
than being loosened. · `WORKING` — `test:g1-landing-ask-flow` cell 18, back to
its exact HEAD baseline. Seat `warmup`.

---

**R-222** · *"we need a bit more details on the strength session and the
conditioning sessions — otherwise it's too hard to know what days you're
swapping ... if all 3 are strength but they're really lowers, upper push, upper
pull, then it's too hard to know what you're changing"*, and *"this should only
show up when you're in the drag and drop screen"* (Sam, 2026-08-25) · **THE
BOARD NAMES THE SESSION; THE WEEK ROWS KEEP NAMING THE KIND.**

Every board box read `Strength`, so a week of three different sessions looked
like three identical ones and the athlete was dragging blind.

⚠ **NOTHING COMPOSES A NAME — THE OTHER FIELD WAS ALREADY THERE.** `VisiblePart`
carries `headline` (the specific name: Lower Squat, Upper Push) AND `bucket`
(the category word), **precisely so a surface can pick the one its job needs**.
The board is the one surface whose job is telling two sessions apart, and
`bucket` cannot do it. `bucket` remains the FALLBACK so a part with no specific
name still labels its box.

**Scoped by construction:** the week rows keep their bucket words (Sam's
2026-08-08 ruling) because they answer a different question — what KIND of day
is this — and `rules/weekBoard` reaches nothing but the board. · `WORKING` —
`test:week-board` §7, 59 passed / 0 failed. Seat `warmup`.

---

**R-223** · *"friday's gunshow instead"*, *"it always says keep fridays gunshow
even if there is no gunshow programmed — and i assume it probably says this on
the female pathway too"*, and *"just match session options style"* (Sam,
2026-08-25) · **"KEEP" BELONGS ONLY TO THE ROW THAT REALLY KEEPS SOMETHING.**

⚠ **THE VERB WAS THE FAULT, NOT THE ROUTE.** The Gunshow route is offered **only
on an EMPTY G-1** — Sam signed it 2026-07-30 so an athlete adding work the day
before a game is offered the session that day was built for — and its job there
is to PLACE that session. *"Keep"* promises something is already there. It now
reads **"Friday's Gunshow instead"**, and the female path takes the same
correction (**"Friday's Primer instead"**), which Sam predicted before it was
checked.

⚠ **AND THERE ARE TWO GUNSHOW ROWS, WHICH THE COPY CENSUS CAUGHT WHEN THE FIRST
EDIT REWORDED BOTH.** Route (a) reads *"Keep Friday's Gunshow"* on a day that
really holds one, and that is correct and stays. Only the empty-day route
changed. **The census refused the over-broad edit rather than the app shipping
it** — the design document is the contract, and it did its job.

**THE STYLE FIX IS THE EXIT, NOT THE ROWS.** The G-1 rows already share Session
Options' padding and hairline divider; what differed is that this step ended in
another LIST ROW, so the way out looked like a fourth thing to choose. It now
ends in the same centred ghost `Button` those sheets use — the component, not a
copy of its look.

⚠ **NOT DONE, AND NOT GUESSED AT: the icon chips.** Session Options rows carry a
38pt round glyph and the G-1 routes have none. There is no existing glyph that
means "accessories only" or "deloaded", and inventing three would be this seat
choosing athlete-facing symbols. Raised for Sam. · `WORKING` —
`test:g1-landing-ask-flow`, back to its exact HEAD failure list. Seat `warmup`.

---

**R-224** · *"this still just says strength"*, and *"yeah go after that — fix the
session naming ... i still want day card and week card to show the general thing
i.e. strength — but for this drag and drop knowing slightly more detail is
important"* (Sam, 2026-08-25) · **THE SPLIT HE ASKED FOR ALREADY EXISTED. THE
SPECIFIC NAME DID NOT.**

`VisiblePart` has carried `headline` (the specific name) and `bucket` (the
category word) all along, exactly so the board can show one and the day and week
cards the other — R-222 wired the board to `headline` and Sam still read
"Strength", because **`headline` was falling back to the generic word for every
session in the app.**

⚠ **MEASURED: 42 OF 42 sessions carrying exercises** across In-season,
Pre-season and Off-season resolved to `"Session"`, missed the strength label map
and printed "Strength". **This was never a board defect — the day card says
"Strength" for the same reason.**

**TWO OWNERS OF ONE QUESTION DISAGREED, AND THE QUIETER ONE WON EVERY SURFACE.**
`classifyGenerationSession` falls back from an empty `effectivePatterns` to
`plannedPatterns`; `resolveSessionDisplayName` read `effectivePatterns` alone. 26
of the 42 held a typed intent saying exactly what they were —
`plannedPatterns: ["pull"]`, primary `pull`, archetype `upper` — with an empty
delivery record. The namer now falls back the same way, on the same field, for
the same stated reason.

⚠ **THE FALLBACK IS TO THE TYPED PLAN, NOT TO PROSE.** `focus` and `name` stay
deliberately unread: that pass-through leaked planner text onto an athlete's
screen once (`surfaceAgreementTests` cell 3) and stays shut.

⚠ **THE REMAINING 16 ARE A DIFFERENT DEFECT, AND THE APP ALREADY SHOUTS ABOUT
IT.** They carry no typed intent at all. `test:session-naming` — dead at import
since before this work — throws the reason: *"B1-PIVOT: the legacy
strength-content builder is severed. A strength plan entry
(`sched:2026-07-13:1:lower`) reached `fallbackExercisesForPlanEntry`, which means
composeWeek did not cover a day the planner asked for."* **Those days are
composed by a fallback that carries no plan**, which is a composer-coverage
defect, not a naming one. Sam's Monday still reads "Strength" until it is fixed.

· `WORKING` — `test:week-board` §8, mutation-proven: removing the fallback reds
the three cells that name a session and only those. **§7 alone could not have
caught this** — it proves the board reads `headline`, with fixtures that supply
one. The cell is on the NAMER, where the disagreement was. It lives in
`test:week-board` because `test:session-naming` reports nothing; move it back
when that suite is alive. Seat `warmup`.

---

**R-225** · *"why the fuck would monday be different"* (Sam, 2026-08-25) · **IT
WAS NOT MONDAY. IT WAS WHICH BUILDER MADE THE DAY.**

A club night is retained from the ADAPTER and carries its typed plan. A pure
strength day is COMPOSER-owned, and `assembleAuthoredWeek` makes the composer's
workout the merge BASE — so the adapter's copy of `strengthIntent` never lands
on it. **The composer read `planned.strengthIntent` to decide the entire session
and then did not carry it out**, so every composer day in the app reached the
athlete as "Strength" while the two club nights named themselves.

⚠ **THE SAME MISTAKE THIS FILE ALREADY FIXED ONCE, ON THE FIELD DIRECTLY
ABOVE.** `ComposedDay.kind` was *"computed and thrown away, and every reader
guessed it back out of prose"* — 24 wrong days in a 180-world sweep. Same layer,
same shape, different field. `strengthIntent` is REQUIRED on
`ComposerPlannedDay`, so there was never a day without one to carry.

**MEASURED END TO END: 42 of 42 sessions unnamed → 0.** With R-224 (the namer's
planned-pattern fallback) that is the whole of it: Sam's week now reads
**Lower Body Strength / Upper Pull / Upper Push**. The day and week cards keep
their bucket words untouched, which is what he asked for and needed no work —
`VisiblePart` has always carried both.

⚠ **AND A THIRD DEAD SUITE.** `test:generated-week-assembly` dies at import at
HEAD, on a `composeWeek` call with incomplete inputs — after
`test:athlete-session-move` (one stale fixture, all 20 cells dark) and
`test:session-naming` (throws `B1-PIVOT`). **Three suites over one day, each
reporting nothing while `test:bible` counted them.** The cells for this ruling
live in `test:week-board` because a rule filed in a suite that reports nothing
is filed in the dark. · `WORKING` — `test:week-board` §9, 68 passed / 0 failed,
mutation-proven. Seat `warmup`.

---

**R-226** · *"give them the option of swapping to the safer team night versions. But allow them to say no and keep the regular ones. If they choose the regular ones then they should again be given a warning about it. Nothing long just a clear warning about added risk. Also make sure these pop ups and language match the rest of the app."* (Sam, 2026-08-26, answering launch-audit finding #10) · **A MOVED SESSION LANDING ON A TEAM NIGHT ASKS, NEVER SILENTLY REWRITES AND NEVER SILENTLY KEEPS.**

The collision this settles: conservation (a moved session keeps its content)
vs the Bible's TT-day filter (avoid high-soreness picks — RFE split squats,
Nordics, back squats, heavy RDLs; Bible line 156). Neither law wins alone —
the ATHLETE decides, at move time:

- **Offer**: swap the sore-making picks for team-night-safe versions from the
  existing pools (box squat, low-rep RDLs, hamstring curls, step-ups /
  reverse lunges — Bible's own lists, §Squat/§Single-leg/§Hamstring).
- **Decline path**: keeping the originals is allowed, followed by ONE short,
  clear added-risk warning. Not long.
- **Copy and popup shape must match the app's existing language** — same
  sheet idiom as the G-1 landing ask / team-night route ask, words through
  the signed-copy owner.

**Search words:** team night move, swap, sore, RDL, split squat, conservation,
moved session, TT day filter. · `WRITTEN` — build owed; guard owed with it.

---

**R-227 REVISED** · *"Hide any sessions before you entered i.e. Wednesday should not show any sessions on Monday or Tuesday on weekly view"* and *"sessions in the app that are currently programmed but greyed out because you sign up after that date should just be removed from weekly view entirely"* (Sam, 2026-08-26, replacing the earlier grey-card answer) · **WEEK VIEW BEGINS ON THE ATHLETE'S START DAY.**

A brand-new athlete's first Week view starts on their signup/generation day.
Earlier days and their generated sessions are absent from both the ordinary
Week list and Manage Week; they are not dimmed placeholders. This is a read
boundary, not destructive program editing: the authored program remains intact
for identity, replay and historical accounting.

**Search words:** first week, past days, before start, hidden, grey, dead days,
onboarding week, Manage Week. · `BUILT` — guarded by `test:pre-program-days`.

---

**R-228** · *(Sam, 2026-08-26, answering launch-audit finding #8 leftovers)* · **A FAILED SAVE SAYS IT DIDN'T WORK — NO RETRY PROMISE; A BIN NEVER CLAIMS THE WEEK IS STILL COVERED.**

- **(a)** Save failures are engineering defects to eliminate, and when one
  happens anyway the sentence says plainly that it didn't work. It must NOT
  promise that trying again in a moment will work ("give it another go in a
  moment" is retired — that promise is unverifiable). Sam verbatim: *"don't
  [lie] to them, say it didn't work."*
- **(c)** The bin result must not claim *"Your remaining sessions already
  cover this week's target."* Sam verbatim: *"no it shouldn't say that …
  that's just untrue."* The reduced-target disclosure variant ("…strength
  target has been reduced at your request") was not challenged and stands.
- **(b) was withdrawn as asked**: the "contradictory lighten sheet" question
  hit Sam's belief that the lighter-day offer left the app weeks ago. The
  offer is still in the code (`home-week-readiness-lighter-offer`,
  HomeScreenV2) — its removal or retention is being verified as its own
  item, not re-asked as copy.

**Search words:** save failed, give it another go, retry promise, bin result,
already cover, weekly target, lighter day. · `WRITTEN` — copy edits owed.

---

**R-229** · *"yes one owner obviously - i feel like we have done this over and over again - making everything one owner"* (Sam, 2026-08-26, answering the item-68 escalation from launch-audit finding #1 root B) · **ONE OWNER FOR REBUILDING THE VISIBLE WEEK WHEN FACTS CHANGE.**

There is to be exactly one composition path: given the stored decisions and
facts, ONE owner derives the visible week, and every door, boot replay and
edit goes through it. The re-gate write-back loop, `writeCoachOverride`'s
discarded outcome, and duplicated reduction records are the named
retirements (STATUS_AUDIT root-B reassessment, 2026-08-25). Sam's tone in
the ruling is itself the instruction: one-owner is the STANDING default for
this app's architecture — new state with two writers should never reach him
as a question again.

**Search words:** one owner, item 68, vertical composer, rebuild week, re-gate,
writeCoachOverride, root B. · `WRITTEN` — the build is the largest open unit;
slice plan owed before code.

---

**R-230** · *"they should not be allowed to use the app bodyweight only - it is for people that are looking to train properly for footy, i'm not interested in people doing bodyweight only - the only time bodyweight only should be okay is when they are away on holidays but i've already made a rule on that"* (Sam, 2026-08-26) · **BODYWEIGHT-ONLY IS NOT A SUPPORTED ATHLETE — ONBOARDING REQUIRES STRENGTH KIT.**

Supersedes **R-083's PREMISE, not its mechanics**: R-083 ("if they want to
train properly they'll sign up to a gym") told the app to accommodate a
no-kit athlete by REMOVING un-performable patterns with disclosure. R-230
closes the front door instead — the equipment step may not complete with no
strength kit ticked ("Continuing with nothing ticked is a real answer" is
retired). R-083's removal-with-disclosure behaviour remains correct ONLY
inside the temporary away/holiday window (the away-equipment rulings, where
kit is temporarily absent and the base program returns on the return date).
R-083's `UNENFORCED` state stops mattering at onboarding scope: the world it
governed permanently is no longer reachable.

**Search words:** bodyweight only, no equipment, no kit, refuse onboarding,
gym membership, sign up to a gym, away holiday equipment, R-083.
· `WORKING` — gate at the equipment step, held by `test:onboarding-bounds`
family cell (see commit).

---

**R-231** · *"won't this result in them never hitting those exercises though and getting a boring program that just selects the same exercises over and over again? if that's the case then I'd prefer that get the real exercises - just spread throughout the week instead of all on one night"* (Sam, 2026-08-26, answering the generation-side half of the R-226 question) · **GENERATION KEEPS THE REAL EXERCISES AND SPREADS THEM — NO AUTOMATIC TEAM-NIGHT PICK FILTER.**

The composer must NOT silently substitute the Bible :156 sore-making lifts
on team nights (that would starve variety and progression on club-heavy
weeks). Instead, PLACEMENT prefers the non-team-night strength day for the
flagged picks when the week has one — the athlete still back-squats, just
not right before club training. The R-226 ask remains the athlete-move
behaviour and is untouched.

**Known edge, named not asked:** the R-093 athlete whose EVERY strength day
is a club night has nowhere to spread to; there the picks stay real (Sam's
stated preference) and the R-083-style disclosure is available if it is
ever ruled wanted. Build owed at the composer's placement layer, consuming
`rules/teamNightContentAsk.teamNightFlaggedRows` as the one vocabulary.

**Same day, copy signing:** Sam rewrote the R-226 ask copy verbatim (title
"Team training tonight", routes "Use lower-fatigue options" / "Keep as is",
the warning, and the weekday done-sentence) and approved every other
sentence proposed on 2026-08-26 ("the rest of the wording is good"):
the Starts clause, the pre-start day note, the three failure sentences,
the readiness standing sentence, the club-log blocked reasons, and the
equipment-gate sentence. All are SIGNED as shipped.

**Search words:** team night picks, spread through the week, boring program,
variety, back squat placement, lower-fatigue, R-226, R-093.
· `WORKING` — built 2026-08-26 at the composer's R-093 pair assignment (the
sorer B shape lands on the non-club strength day; identity permutation when
there is nowhere to spread). Guard: week-derivation-equivalence [9].

---

**R-232** · *"i just want session feedback saved, monitored in progress tab, and then that should effect future programming - for both strength and condiitoning"* → proposal approved verbatim: *"yes build it - draft the wording and I'll approve"* (Sam, 2026-08-26) · **CONDITIONING FEEDBACK PICKS AMONG AUTHORED TIERS — NEVER EDITS A DOSE.**

Two rough logs of a tier (high effort ≥8 AND incomplete — Sam's approved
pair) inside the 28-day block window ease that tier off the resolver's
preference ladder, only while an authored easier tier can still serve the
day. Nothing stored — the ease derives from feedback each run, so comfort
returning IS the step back up (no ratchet state, no restore event). Every
outranking law (game proximity, weekly caps, strength interaction,
injuries) filters tiers BEFORE the ladder, so the ease can never override
one. The 2026-07-27 dose-adjustment retirement (Bible :4966) and Section
6's "doses come from authored templates" stand untouched — this picks
WHICH authored dose, never a number. Strength-side feedback wiring was
already WORKING (Sam's 2026-08-16 "feed the real persisted history").

Disclosure on the eased session (coachNotes), SIGNED verbatim (Sam,
2026-08-26, "approve"): *"Eased back today — your last couple of
conditioning sessions looked like a lot."* No step-up line exists by
design — nothing is stored, so the regular session's return has no event
to announce; Sam approved that shape with the sentence.

**Search words:** conditioning feedback, rough session, ease tier, RPE,
too much, dose adjustment, authored templates, progress tab, step up.
· `WORKING` — rules/conditioningFeedbackEase + resolver ladder + builder
disclosure; test:conditioning-feedback-ease 10/0 in the chain, mutation-
checked (threshold flip killed 3 cells).

**R-233** · *"why RDL's and Single leg RDLs are in the same session? this should not be happening / I'd rather it be RDL"s and nordics, or Single leg RDL's as the main hinge and then hamstring curls or nordics as the other one"* (Sam, 2026-08-26) · **ONE RDL VARIANT PER DAY — THE SINGLE-LEG HIP ROW YIELDS TO THE HAMSTRING PAIR.**
Why it was structural: R-093 pins the in-season hinge to RDLs, the :227 fill
order also owes a single-leg hip row, and R-084's pool is deliberately one
exercise — Single-Leg RDL. Measured pre-fix over 12 worlds: 6 shipped the
pair, up to 8 colliding days per program. The build: Nordic Lower / Hamstring
Curl join the single-leg hip slot's vocabulary (derived from the pool's own
hamstring group), and when the day already carries an RDL-family lift the
slot's candidates drop the family — hamstring row takes the spot. The HINGE
never yields (block stability). Preference, not a veto: a kit with neither
hamstring row keeps the repeated variant rather than an empty slot (R-080's
fallback shape). R-084's "meant to repeat" stands where no collision exists —
Single-Leg RDL still owns its day in worlds that never pair it.
Sam also re-ruled the same day: RDLs stay on team nights, dose-trimmed
("leave RDL's" — R-226 unchanged).
**Search words:** RDL, Single-Leg RDL, nordic, hamstring curl, same session,
double up, hinge, single leg hip, pairing.
· `WORKING` — composeWeek family guard + sessionSlotCoverage vocabulary;
test:rdl-family 7/0 in the chain (3 previously-colliding worlds generated
live; replaced-not-lost and survives-where-legal both pinned).

**R-234** · *"a - so its lowers + uppers + full body (full body - should match whats missing in rest of week or balance out program as well as possible)"* (Sam, 2026-08-26, profiles-audit finding F-A) · **A FULL-BODY DAY WITH NOTHING MISSING BALANCES — IT IS NEVER A DUPLICATE LOWER DAY.**
Extends R-087, which it does not reopen: when the week's genuine gaps span
the body, the coverage day still asks the week what is open (R-087
verbatim). The case R-087 left open — lower + upper already cover
everything — no longer falls to `composedDayKind(...) ?? 'lower'` (the
measured result: a day NAMED full_body carrying Monday's exact mains and
zero upper rows, both genders, pre- and off-season 3-day). It takes a real
full-body shape (the A/B ladders) and balances the week.
**Search words:** full body, duplicate lower, third day, 3-day split,
lowers uppers full body, balance, coverage day, R-087.
· `WORKING` — see the balance arm in composeWeek + test:full-body-balance.

**R-235** · *"nobody ever asks for training days - they list how many days they can get to the gym which is obviously 4 DAYS THEY CAN GET TO THE FUCKING GYM - so they should be able to receive 4 sessions on those days - footy training does not count as gym"* (Sam, 2026-08-26, profiles-audit finding F-C) · **`trainingDaysPerWeek` IS GYM DAYS. CLUB NIGHTS NEVER COUNT TOWARD IT.**
The measured violation: an in-season athlete answering 4 gym days
(Mon/Wed/Fri/Sun, game Saturday) was authored required=2 with no
disclosure, because the layout counted the two club nights toward the
athlete's number. The gym-day count is the athlete's own capacity answer;
club training is a separate obligation. Where game-adjacency laws make a
preferred gym day illegal, the session RELOCATES to the best legal day
(combining onto a club night is a legal relocation — Sam's own seed world
trains combined club nights); only what genuinely cannot be placed is
reduced, and a reduction is DISCLOSED.
**REFINED THE SAME DAY, IN SAM'S OWN WORDS:** *"just because it says i CAN
train 4 days doesn't mean it HAS to = it just gives the ceiling and you fit
the fucking program in to whats left"*. The gym-day answer is a CEILING,
never a quota. The scheduler's existing behaviour — fit the program into
the legal days, fewer sessions around games — is the ruled behaviour. The
former "slice 2" (forcing delivered counts up to the answer) is
**CANCELLED — do not build it**; the measured three-authority refusals it
produced are moot. What stands from this ruling: the shortfall is
DISCLOSED, never silent, from the athlete's own answer.
**Search words:** training days, gym days, four sessions, ceiling, quota,
club nights count, footy training, required strength sessions, reduction
disclosure.
· `WORKING` — weeklyScheduler accessIntended disclosure + the reduction
ladder consulting the authored smaller structures. Nothing further owed.

**R-236** · *"men should be given optional gunshow instead of optional primer"* (Sam, 2026-08-26, profiles-audit finding F-B) · **THE G-1 OPTIONAL SESSION IS GENDERED: WOMEN GET THE PRIMER (R-129), MEN GET THE GUNSHOW.**
The female path already places the R-129 Primer on G-1; the male optional
placement was the ledgered dead branch. Sam's answer revives it as the
GUNSHOW, not the Primer. Optional tier on both — no load, no fatigue
contribution (R-129's own words), never breaks a rest day.
**Search words:** gunshow, primer, G-1, optional session, day before game,
men, women, arms pump.
· `BUILT` — see generator optional placement + cells.

**R-237** · *"it should fill the gym days with 1. what is optimal ... then also fill up the next two ie gunshow or primer, and one day of mobility"*; *"if an athlete ... can only train 3 times then that would be 3 gym days, + 1 optional session requiring no equipment"*; *"it doesn't matter what time of the season it is"*; *"on spare days, it could add in mobility sessions that are optional and bodyweight only too"* (Sam, 2026-08-26, audit item 2) · **THE CORE WEEK STAYS OPTIMAL; SPARE CAPACITY OFFERS GENDERED GYM WORK AND EQUIPMENT-FREE MOBILITY.**
R-235's gym answer remains a ceiling, never a quota: the scheduler first
authors the best legal core week. If a gym-access day is still genuinely
spare, the original ruling offered a no-game gendered session. **Amended by
Sam's P03 direction on 2026-08-28:** no automatic Gunshow/female Primer in
off-season, no-game pre-season or an in-season bye. One-game G-1 placement
remains, including a pre-season practice match; multi-game weeks still receive
none automatically. Manual Add is unchanged. Guard: `test:spare-day-options`
(in `test:weekly-scheduler`) plus the real Add/restart/Undo compiler journey.
Separately, every phase
offers one optional Mobility session on a spare governable day; Off-season
keeps its signed target of two total. Auto-placed Mobility is composed through
the existing Mobility owner with bodyweight-only eligibility, may sit outside
the athlete's gym-day answer, and replaces an empty Rest shell rather than
double-booking a date. G+1 may take Mobility because it is recovery-class;
Accessories remain gym-only and cannot use G+1. Existing running ownership is
unchanged.
**Search words:** spare gym days, optional mobility, bodyweight only, no
equipment, Gunshow, Primer, gym ceiling, every season, G+1 recovery.
· `WORKING` — weeklyScheduler gendered offer + need-based optional top-up;
test:weekly-scheduler (spare-day-options) is in the Bible chain and mutation-
checked.

**R-238** · *"30:30 is 30 sec on 30 sec off, 1:1 is 1 min on 1 min off"*; *"It's okay to have 2 parts to a session but this looks like 1 session titled as 1 session with another part thrown in"*; *"Some conditioning sessions don't give a straight forward answer either — giving too many options and mixing up the prescription"* (Sam, 2026-08-26, audit item 3) · **CONDITIONING GIVES ONE PLAIN TITLE AND ONE PRESCRIPTION.**
`workToRest` remains internal physiology and never renders. Athlete titles use
plain duration words rather than colon shorthand, Work and Recovery spell the
actual times, and a simple authored count range resolves to the same concrete
round/repetition count materialised on the row. Merged workbook rows retain
their internal alternatives but the shared athlete projection selects one
already-authored branch, so no Work/Recovery/count line says “or” or “variant.”
A single conditioning option is rendered directly as its authored row; only two
or more genuine equivalents get a Choose one control. The structured Recovery
line is the only rest display on a standalone conditioning row.
**Search words:** conditioning title, 30:30, 1:1, work rest, one prescription,
choose one, alternatives, rounds, duplicate recovery.
· `WORKING` — shared conditioning projection + one-list composition;
test:conditioning-templates and test:session-template are in the Bible chain
and mutation-checked.

**R-239** · *"is this the nordic vo2 max session? if so why the fuck did you
change the name to classic 4x4 and why the fuck does it have 3 min easy jog in
the rest period - it's a fucking complete rest period - no jogging"*; *"also,
make sure that conditioning isn't like strength just choosing the top of the
list each time"* (Sam, 2026-08-26, conditioning simulator review) · **THE 4×4
SESSION IS NAMED 4×4 VO₂ MAX, ITS THREE-MINUTE RECOVERY IS COMPLETE REST, AND
CONDITIONING ROTATES ITS ELIGIBLE POOL ACROSS MINI-CYCLES.**
`Classic 4×4` remains the historical workbook identity so stored rows and
selection keys do not split; the shared athlete projection names it `4×4 VO₂
Max`. Sam's later prescription re-authors its Rest period to `3 min complete
rest`, superseding the dated workbook snapshot's `3 min easy jog`. Template
selection stays stable within one mini-cycle for progression, then advances by
mini-cycle number through every eligible template in that category rather than
restarting at index zero.
**Search words:** 4×4 VO2 max, Classic 4×4, complete rest, easy jog,
conditioning variety, top of list, rotation, mini-cycle.
· `WORKING` — test:conditioning-templates holds the exact title/rest and drives
all seven requestable categories through the real selector across twelve
mini-cycles, proving each advances beyond its first eligible template while
remaining stable inside one mini-cycle. It is in the Bible chain.

**R-240** · *"this is way to long as well - heart rate doesn't need to be in
the conditioning session and description can be simpler \"choose a pace you can
repeat across all 4 rounds.\" work recovery reounds intensity can be bolded too
- run through all the conditioning templates and make sure this is the case"*
(Sam, 2026-08-26, conditioning simulator review) · **CONDITIONING CARDS ARE
GLANCEABLE ACROSS THE WHOLE TEMPLATE LIBRARY.**
No athlete-facing conditioning projection carries a Heart rate line. The
sheet's HR clause remains internal source data; the actionable Intensity clause
still renders. The 4×4 VO₂ Max cue is exactly `Choose a pace you can repeat
across all 4 rounds.` One shared renderer bolds Work, Recovery, the applicable
count label (Rounds, Reps or Blocks), and Intensity for standalone and genuine
multi-option rows; it does not bold coaching prose.
The prescription uses 23-point line height on the primary row (20 on the
compact choice path), with a small gap below the session title so the bold
labels do not crowd either each other or the heading.
**Search words:** conditioning card length, heart rate, concise cue, bold work,
bold recovery, bold rounds, bold intensity, all templates.
· `WORKING` — the 55-template conditioning census forbids Heart rate globally,
the equality suite pins the exact 4×4 cue, and the session-template guard pins
the one shared label-emphasis renderer and its spacing. All are in the Bible
chain.

**R-241** · *"Programming is shit too = always just defaults to bench press and
back squat and lat pull down for some reason ... over 3 days of strength work i
got no pull ups or DB bench press but was given 2 benchs, two back squats, 2
RDL's and maybe even bulgarian split squats ... Its like it goes 'i need a
horizontal press' - top of list = bench press - okay put that in"* (Sam,
2026-08-26, audit item 4) · **A REPEATED WEEKLY PATTERN GETS A DISTINCT,
BLOCK-STABLE EXERCISE SEAT; PUSH AND PULL ALTERNATE WHICH PLANE LEADS.**
The existing block selector and its recorded history remain the authority.
What was too broad was its key: one row per movement slot meant every weekly
occurrence of that slot restored the first answer. History is now keyed by slot
plus zero-based weekly occurrence. Each seat remains deterministic and stable
through the build block, while another occurrence uses a different legal
same-pattern option. For push and pull, the main-lift role alternates between
the available horizontal and vertical planes across the week, so source order
cannot make horizontal win every day; a full-gym repeated upper week can carry
`Bench Press` plus `DB Bench Press` and `Barbell Row`/`Seated Cable Row` plus
`Lat Pulldown`/`Pull-Ups` rather than cloning the first rows. Legacy one-seat history
lifts to seat zero at read ingress and every new write carries the canonical
seat field.
**Search words:** boring program, strength variety, top of list, repeated bench,
repeated squat, repeated RDL, DB bench, pull ups, weekly exercise seat,
horizontal always first.
· `SUPERSEDED IN PART BY R-317` — distinct stored occurrence seats remain useful
for supporting exercise stability and variety, but R-241 no longer authorises a
second automatic weekly main lift in the same slot or alternating which repeated
plane becomes main.
· `BUILT` — `test:weekly-strength-variety` drives 40 real full-gym profile
worlds across both genders, all three phases and 3/4/5/6 gym-day answers. Its
test-first state counted 64 repeated weekly exercise identities across 20 of 40
worlds; after the shared-key correction it counts zero, pins the real DB Bench
and Pull-Up control, checks four-week seat stability, accepted multi-seat
history and legacy ingress. The guard is in the Bible chain.

**R-242** · *"title 'are you sure?' subtitle train hard friday and you'll feel
it saturday"*; *"Same session but easier / Gunshow / Primer / Accessories
only"*; *"make this the same on males and females but leave out gunshow for
females"*; *"no subtitles needed for each option"*; *"Fix adding stuff to the
g-1, the deloaded sessions suck or can't be placed — a deloaded session which
results in 1 exercise sometimes — and i just tried to do it now — went through
two warnings then told 'big game tomorrow, can't do that'"* (Sam, 2026-08-26,
G-1 warning and placement review) · **THE G-1 WARNING IS ONE SHORT, DIRECT
CHOICE, AND “SAME SESSION” KEEPS THE SESSION.**
It says `Are you sure?` and `Train hard Friday and you'll feel it Saturday`.
The choices are obvious boxed rows with no explanatory sub-lines and apply
immediately: Same session but easier, Gunshow, Primer and Accessories only.
Female athletes see the same order without Gunshow. `Go back` owns leaving the
day alone, so the menu does not repeat that as an option. Historical persisted
keep-day decisions remain readable but are not visible choices. Same session
but easier preserves every selected exercise and reduces the dose through the
existing deload appliers. It is typed as low stress for G-1. Selecting it
commits from the warning already shown: it does not reopen preview, show a
second warning or finish with the game-tomorrow refusal. When it is added beside
an already-low G-1 session, the saved combined day retains that low-stress fact;
it may not hide a separate hard session or team night.
**Search words:** G-1 warning, are you sure, same session easier, Gunshow,
Primer, accessories only, female, boxed options, day before game, two warnings,
one exercise, big game tomorrow, deload refused.
· `WORKING` — `test:g1-landing-ask-flow` binds the exact warning, gendered
route list, boxed presentation, direct commit, full exercise preservation,
five-category Add matrix, one-row conditioning regression, low-stress saved
day and persisted legacy route.

**R-243** · *"remove move this session on day view - move should only be
available on weekly view"*; *"if two sessions on the day = Pick a session to
remove / If just one session - Remove it - day becomes rest"* (Sam, 2026-08-26,
Day session-options review) · **DAY DOES NOT MOVE SESSIONS, AND REMOVE SAYS
WHAT THE NEXT TAP WILL DO.**
Move remains available from the Week board only. Day retains Add and Remove.
When removal needs a component choice the row says `Pick a session to remove`;
when the one programmed session would empty the day it says
`Remove it — day becomes rest`. The existing typed removal predicate chooses
between them.
**Search words:** Day move session, Week-only move, remove session copy, pick a
session, day becomes rest.
· `WORKING` — `test:day-first-timeline` pins the Week-only Move mount and
`test:move-scoping` pins both signed removal outcomes to the typed predicate.

**R-244** · *"add move and remove games are the exact same thing as add move
and remove training - so they should just be one button"*; *"dragging a game
or adding a game onto a day with something already on it just replaces what
was on that day"*; *"that pop up then doesn't need the lines seperating them
or the mini headings as seperators"* (Sam, 2026-08-26, Week management review)
· **ONE WEEK BOARD MANAGES TRAINING AND GAMES.**
The Week popup contains only Away and `Manage week`; it has no mini section
headings and no divider lines. The board can add, drag and remove training or
games. Adding or dragging a game onto an occupied day replaces that day's
content through the canonical fixture transaction, because a fixture owns its
day; an empty target simply receives it. Training continues through the
existing plan-change owner. The plus asks Training session or Game in both
competitive phases, and the game row warns that it replaces anything already
on the day.
**Search words:** Manage week, games and sessions, drag game, add game, replace
occupied day, fixture precedence, no headings, no separator lines.
· `WORKING` — `test:week-board` guards both game operations and fixture
precedence; `test:day-first-timeline` guards the two-row divider-free popup and
the one add chooser.

**R-245** · *"when you make a change in weekly view you should have to click
save changes - even though it is already saved - it's better UX for the athlete
to know that - and then be given a confirmed quickly then snap back to regular
weekly view"*; *"just a save changes button after making a change is enough"*
(Sam, 2026-08-26, Manage Week finish review) · **A CHANGED WEEK EDIT VISIT ENDS
WITH ONE SIMPLE SAVE BUTTON.**
The existing add, move and remove transactions remain immediate and durable.
Manage Week compares its current visible board with the board that opened the
visit; refused actions and no-op re-projections do not count as changes. The
button is absent before a change and appears as `Save changes` afterwards.
Tapping it briefly shows `Changes saved` before returning to the ordinary Week
view. The opening board and confirmation are transient screen state only and
are never persisted.
**Search words:** Save changes, Changes saved, Manage Week confirmation,
weekly edit finish, snap back, dirty board, immediate save.
· `WORKING` — `test:week-board` compares real board projections, binds both
signed strings and pins the one-button finish/return flow.

**R-246** · *"YouTube shorts in session view should default to muted if thats
possible"* (Sam, 2026-08-26, session demo review) · **EXERCISE DEMOS START
MUTED, WITHOUT AUTOPLAY.**
The inline YouTube player still waits for the athlete to press play. When the
player becomes ready, the embed uses YouTube's supported player API to mute it.
The athlete may turn sound back on with YouTube's ordinary control. Opening an
external YouTube fallback remains YouTube-owned and is unchanged.
**Search words:** YouTube Shorts, exercise demo, session view, muted by default,
player mute, no autoplay.
· `WORKING` — `test:video-modal-fill` pins JavaScript API enablement, the
on-ready mute command and the absence of autoplay.

**R-247** · *"When changing season phase there should be a 10 sec build screen
similiar to the 20 sec onboarding fake pause and then some sort of completion
screen"*; *"the copy should say ... 'takes up to 20 seconds'"*; *"off season
should STOP ... ASKING FOR TEAM TRAINING DAYS"*; *"EDITING INTO OFF SEASON FROM
INSIDE THE APP SHOULD STILL ASK WHEN LAST GAME WAS TOO"* (Sam, 2026-08-26,
season-phase change review) · **A PHASE CHANGE FEELS DELIBERATE, AND OFF-SEASON
STARTS FROM THE ATHLETE'S REAL FINISH DATE.**
Every in-app season-phase change holds the rebuild state for at least ten
seconds, says `Takes up to 20 seconds`, and then remains on an explicit
`Your program is ready` screen until the athlete taps Done. Entering Off-season
asks with the white title `Select the date of your last game` before availability
on both My Status and Profile setup. That answer uses the shared Going Away
calendar rather than separate Day / Month / Year fields. The exact date feeds
the canonical phase clock, so an athlete changing
two weeks late begins two weeks into Off-season rather than restarting at Week
1. `I'm not sure` remains an explicit fallback. Off-season never asks for team
training days and clears any stored team-training and game-day anchors as part
of the same accepted phase-change patch.
**Search words:** season phase build, ten seconds, takes up to 20 seconds,
program ready, Off-season finish date, last game, team training days, late
phase change, Profile setup, My Status.
· `WORKING` — `test:profile-reset-ui` guards both live entry points, the shared
timing/copy/completion owners, the Off-season routing and the saved Profile
patch; `test:phase-clock` guards exact-date phase-week derivation. A deterministic
iPhone 17 Pro simulator flow displayed the exact white title and shared calendar,
then completed My Status → Off-season → finish date → availability → build →
ready and proved the team-training question absent.

**R-248** · *"something changed tell the coach should be same size font as the
text about it i.e. commerical gym"* (Sam, 2026-08-26, Profile review) · **THE
SETUP ACTION MATCHES THE SETUP ANSWERS.**
`Something changed? Tell the coach` uses the same 14-point text size as Profile's
Program Setup values such as `Commercial gym`. Because R-186 makes the doorway
and its three destination edit rows one shared action family, the shared owner
sets that size for all four rather than styling the doorway independently. This
supersedes only R-183's old 15-point action-size number; its surface, spacing and
shared-component requirements remain.
**Search words:** Profile, Something changed, Tell the coach, Commercial gym,
font size, Program Setup, setup edit action.
· `WORKING` — `test:profile-reset-ui` compares the two owned font-size values
and requires both to remain 14.

**R-249** · *"hitting my status on day view has a pop up it doesn't need =
should just take me straight to the page"*; *"My status should also be removed
from coach tab only showing on the day view / weekly view (it's not on weekly
view yet)"* (Sam, 2026-08-26, Program navigation review) · **MY STATUS BELONGS
TO PROGRAM, ONE TAP AWAY.**
Day and Week each keep the same permanent My Status doorway in the Program
header, including when no modifiers are active. Either doorway opens a real
Program-stack My Status page directly. The intermediate modifier popup is
retired from this route. Coach is chat-only and renders neither the doorway nor
the status overlay. My Status keeps the existing active-modifier controls,
season-phase review and accepted transactions unchanged. This supersedes the
old Coach placement and the old two-step `Go to my status` popup route.
**Search words:** My Status, Day view, Week view, Coach tab, direct navigation,
modifier popup, Program stack, status doorway.
· `WORKING` — `test:program-tab-read-only-modifiers` guards both permanent
Program doorways, the direct route and popup retirement; `test:coach-tab-slice3`
guards the Program-stack destination and chat-only Coach; `test:my-status-modifiers`
guards the re-homed controls. `.maestro/golden/my-status-direct-navigation.yaml` walks Day
and Week into the same destination and proves Coach has no status doorway.

**R-250** · *"Page transitions in onboarding = not fade - move forward or
backward like a slide"* (Sam, 2026-08-26, onboarding review) · **ONBOARDING
MOVEMENT FOLLOWS NAVIGATION DIRECTION.**
The shared onboarding stack uses a horizontal push transition rather than a
cross-fade. Advancing slides the next page in from the right; Back uses the
native stack reversal, returning in the opposite direction. This is owned once
by the navigator rather than reimplemented on each questionnaire screen.
Welcome's initial entrance remains unanimated; moving from Welcome into the
questionnaire uses the destination screen's shared slide.
**Search words:** onboarding, page transition, slide, fade, forward, Back,
native stack.
· `WORKING` — `test:onboarding-presentation` requires the shared horizontal
transition and rejects the retired fade.

**R-251** · *"lime green highlight should not only come when released - should
move with number in focus i.e. moving from 4 to 5 the 5 should flick to the lime
green before it's locked on there so the colour follows the movement"* (Sam,
2026-08-26, gym-days wheel review) · **THE WHEEL'S COLOUR FOLLOWS LIVE FOCUS.**
The number nearest the centre turns lime while the athlete is dragging, as soon
as focus crosses to it; the highlight does not wait for release or snapping to
finish. Visual focus is separate from the committed gym-days answer: following
the drag cannot save an answer, scroll the list or add another settle owner.
The existing native snap and tap/release answer paths remain unchanged.
**Search words:** gym-days wheel, number picker, lime, live focus, drag, release,
snap, committed answer.
· `WORKING` — `test:onboarding-presentation` requires scroll-driven focus,
focus-driven lime styling and separation from the answer/scroll writers.

**R-252** · *"Equipment in onboarding section - when selecting commercial gym
and then tapping through to next page - you cant go back to commercial gym page
- it takes you to the step before that = should take you back to the commercial
gym option page"* (Sam, 2026-08-26, onboarding Equipment review) · **SAVING
EQUIPMENT CANNOT CHANGE THE BACK PATH MID-FLOW.**
On a fresh onboarding pass, Back from Gym Experience returns to the equipment
checklist and Back from that checklist returns to `Where do you train?`, with
the athlete's selected gym still shown. Saving the equipment answer while moving
forward cannot turn that second Back into an exit from Equipment. Opening
Equipment with an answer that already existed remains an edit and keeps its
established single-page Back behaviour.
**Search words:** onboarding, Equipment, Commercial gym, Back, Gym Experience,
equipment checklist, Where do you train, saved answer, navigation.
· `WORKING` — `test:equipment-answer` requires Equipment to snapshot whether an
answer existed on entry and rejects a live answer read that can change Back
semantics after Continue. A fresh iPhone 17 Pro simulator flow walked Commercial
gym → checklist → Gym Experience → Back → checklist → Back → Where do you train
and found Commercial gym still selected.

**R-253** · *"Commercial gym = everything is ticked already so subtitle needs
some work i.e. you can't tick any more things so what it says doesn't make
sense"* (Sam, 2026-08-26, onboarding Equipment copy review) · **THE INSTRUCTION
MATCHES WHAT THE ATHLETE CAN ACTUALLY DO.**
Commercial gym preselects the complete equipment and cardio checklist, so its
subtitle reads `Everything is ticked. Untick anything your gym doesn't have.`
It does not tell the athlete to tick anything extra. Club gym, Home gym and an
existing custom answer keep the two-way instruction because unchecked choices
remain available on those paths.
**Search words:** Commercial gym, Equipment, subtitle, everything ticked,
untick, tick anything extra, equipment checklist.
· `WORKING` — `test:equipment-vocabulary` proves Commercial gym selects the
whole current vocabulary; `test:equipment-answer` requires the Commercial-only
subtitle, retains the two-way fallback and requires the rendered subtitle to use
that owner. An iPhone 17 Pro simulator displayed the new sentence and found no
`tick anything extra` instruction.

**R-254** · *"on all the days where there is the line of 7 days with just the
letter on them Make pick a day = a row of 4 and a row of 3 with Mon Tue Wed
instead of just the letter - make it like shifting season mode pop up is"*
(Sam, 2026-08-26, onboarding weekday-picker review) · **WEEKDAY QUESTIONS USE
THE SEASON-SHIFT 4-OVER-3 GRID.**
Game Day, Team Training Days and usual gym days all show the canonical week as
`Mon Tue Wed Thu` followed by a centred `Fri Sat Sun` row. They use the same
compact chip geometry and three-letter labels as the in-app season-shift picker;
the seven-across `M T W T F S S` row and the unused 3-3-1 variant are retired.
Full weekday accessibility labels, single-versus-multiple selection, the gym-day
cap, Team Training feedback and each screen's existing Continue behaviour are
unchanged. This supersedes the layout and visible-label requirements in R-159,
R-160, R-168 and R-169 while retaining their behavioural requirements.
**Search words:** weekday picker, Pick a day, Mon Tue Wed, four over three,
4-3 grid, seven across, Game Day, Team Training Days, usual gym days, season
shift.
· `WORKING` — `test:onboarding-presentation` requires all three screens to use
one shared DayGrid, pins the wrapping 22%-width four-over-three geometry,
three-letter labels, full accessibility names and retirement of both former
variants. An iPhone 17 Pro simulator displayed the exact 4-over-3 usual-gym-day
grid with selection retained.

**R-255** · *"Little green lines next to the titles are useless - remove …
there should be 4 main lifts as graphs - even if no data yet - pull up bench
press RDL back squat - these should be predicted 1RM on these lifts … that way
the progress chart is clear and unaffected by changing program when you do 3
reps or 5 reps or 8 reps"* (Sam, 2026-08-26, Progress-tab review) · **FOUR
FIXED PREDICTED-1RM GRAPHS REPLACE RAW WORKING WEIGHT.**
Progress headings have no decorative lime dash. Main lifts always contains, in
order, Pull-Up, Bench Press, RDL and Back Squat; a lift with no usable history
keeps its graph card and says `No data yet` rather than disappearing. Each point
is the week's best Brzycki predicted 1RM from a completed set of 1–10 reps, so
different low-rep prescriptions share one strength scale. A real logged
weight-and-reps pair wins; when set detail is absent, a fully completed
prescription supplies its performed load and top prescribed rep target. Partial
work without set detail and sets above ten reps do not invent a point. Pull-Up
uses total system load (bodyweight plus added weight) for the calculation, then
shows the predicted added-load maximum with a `+` prefix.
**Search words:** Progress, green title line, main lifts, predicted 1RM,
estimated 1RM, Brzycki, Pull-Up, Bench Press, RDL, Back Squat, empty graph,
reps, bodyweight, added load.
· `WORKING` — `test:coach-snapshot` pins the formula, rep limit, fixed ordered
histories, empty histories, Pull-Up system-load calculation and absence of the
title marks; `test:workout-log-progression-wiring` pins the real set pair and
completed-prescription fallback. The iPhone 17 Pro simulator displayed the four
ordered cards, a `+28 kg` Pull-Up estimate, an empty Back Squat card and no lime
heading dashes.

**R-256** · *"they should be doing something fast earlier in the week -
something like a short sprint workout into so flying runs or glycolytic
sessions in the 30 second to 2 min interval range - total session length 30-45
min after warm up. then later in the week on say a g-2 they can do some
runnign intervals or off leg conditioning keep this moderate intensity - no
more than say 6 or 7km"* (Sam, 2026-08-26, the audit's Q2, built on his direct
order 2026-08-27) · **THE NO-CLUB IN-SEASON GAME WEEK AUTHORS SAM'S FAST
SESSION AND A G-2 MODERATE.**
Held by `weeklyScheduler` clause WC-143: the tt=0 game week authors ONE hard
app exposure — glycolytic category, the WC-135 sprint riding the same day as
its opener, placed early (G-4 or before, preferring an upper day) — and the
second app exposure prefers the G-2 day at moderate intensity (tempo running
on an upper day, off-leg on a lower day, per WC-115). Supersedes, for tt=0
game weeks ONLY, the 2026-07-29 "the game carries the hard exposure" reading;
club athletes keep that credit. A reduced week (deload or low readiness)
authors neither. Guard: `test:weekly-scheduler` WC-143 cells, mutation-killed.
**Search words:** no club, no-club, fast work, sprint into glycolytic, flying
runs, G-2 moderate, 6-7km, in-season conditioning, Q2.

**R-257** · *"why can't you put work on the weekend here? why can't you put
lowers on thursday and hard running friday?"* (Sam, 2026-08-26, the audit's
Q3, build ordered 2026-08-27) · **THE PRE-SEASON HARD RUNNER LEAVES THE
HEAVY LOWER DAY — THE WEEKEND IS LEGAL GROUND. RULED; BUILD BLOCKED, MEASURED.**
The intended enforcer (scheduler clause WC-144: when every receiving day
carries a lower purpose, the hard exposure takes a free day — Saturday
first — and the lowers keep easy off-leg work; gym access bounds STRENGTH,
not running, per WC-060/decision 15) was BUILT on 2026-08-27, produced the
ruled shape (Mon lower + easy off-leg, Sat standalone Hard Intervals,
mutation-killed cells), and was BACKED OUT the same day on a measured
collision: with a hard session occupying Saturday, a dated practice-match
arriving on that Saturday makes the fixture transaction's replan overlay and
the pure deriver compose DIFFERENT weeks (Monday lost its conditioning
component in the overlay), and `fixture-identity` cells 5/6 red — the
add-then-remove identity law Sam himself ruled. The block is the
projection/derivation seam already recorded as the R-075
allocations-vs-final-plan unit: fix that seam, then re-land WC-144 (the
backed-out build is in this branch's history at the WC-144 marker in
`weeklyScheduler.ts`).
**Search words:** weekend, hard running friday, lower day hard runner,
pre-season placement, separate hard runner, Q3, WC-144, blocked.

**R-258** · *"i need you to rebuild what we currently have by making it more
like the template … let's do it piece by piece"* (Sam, 2026-08-27, driving from
his prototype screenshots, judging each piece himself on the simulator) ·
**THE DAY SCREEN IS BEING WALKED TOWARD THE TEMPLATE, ONE PIECE PER
INSTRUCTION. SIX PIECES RULED AND BUILT; ALL SIX SEEN BY SAM ON GLASS.**
(a) The MY STATUS header pill loses its glow — the lime border over a
green-tinted fill becomes the same neutral card treatment as the notice strip
below it (`ModifiersStrip.coachStrip`). (b) The onboarding build screen's ready
state drops the three education cards and centres the tick + "Your program is
ready" in the band between the screen top and the CTA — measured, because the
scroll view starts below the top inset and runs under an absolute footer
(`CompleteScreen`). (c) The Day/Week toggle, the date row and the day card
tighten to the template's proportions: 28pt above the date, 21pt below it, paid
by `topBar` 6/0, `dayFirst.marginTop` 4 and a 32pt nav row whose 48pt tap target
is held by `hitSlop={8}`. **Halving the two margins alone moved 16pt and Sam
could not see it — most of the air was INSIDE the row.** (d) The day card's row
glyphs go 13 → 26 (`DAY_ROW_ICON_SIZE`), the completion tick with them.
**COLOUR IS UNCHANGED: the template draws them lime and R-116's grey stands.**
(e) A mobility-only day showed the battery — a composed optional session now
wears its own glyph from ONE shared table (`COMPOSED_OPTIONAL_ICON_KIND`),
replacing the two hand-kept `{ primer }` copies that R-116 exists to prevent;
prehab was the same defect and is fixed with it. (f) The day card title goes to
26pt and **stays on one line** (`adjustsFontSizeToFit`), with a small lime
**"TODAY'S FOCUS"** eyebrow above it (9.5pt after *"it should be smaller"*).
⚠ **(f) DOES NOT UN-WITHDRAW BATCH 32.** "TODAY'S SESSION" stays withdrawn and
asserted absent; the new eyebrow is a different string. **AND IT READS THE SAME
ON EVERY DAY.** It was first built to say "SESSION FOCUS" on a day the athlete
had walked to, because announcing "today" on a Saturday is the surface lying —
Sam was told exactly that and ruled against it the same morning: *"session focus
should be 'today's focus'"*. One string, one row, every day with a session. Guards:
`test:day-first-timeline` cells for the eyebrow, the one-line 26pt title, the
nav proportions + hitSlop and the topBar spacing were REWRITTEN in the same task
(they pinned the superseded 2026-08-22 state); `test:copy-rulings-binding` holds
the withdrawal.
**Search words:** template, prototype, rebuild, my status glow, header pill,
today's focus, eyebrow, day card title one line, bigger icons, row glyph size,
mobility battery icon, composed optional glyph, day week toggle padding, date
row spacing, program is ready centred.

**R-259** · *"we're going to work in the profile tab for a bit now … instead of
the 'edit player details' and having to go through each step again"*, then
*"why is the 'something changed? tell the coach' button even there?"*, then
*"it should be like everything else in the app = just a fucking pop up"*, then
*"it would be cleaner if we just had the grey side arrow thing like in the FAQ"*
(Sam, 2026-08-27, four passes in one morning) · **THE PROFILE PAGE EDITS ITSELF,
ONE ANSWER AT A TIME, IN A POPUP. BUILT; SEEN BY SAM ON GLASS.**
(a) **The "Something changed? Tell the coach" CTA, the full-screen setup review
page and its whole step machine are DELETED** — not unlinked. Sam hit the reason
himself: Equipment still opened that page underneath its own sheet, so dismissing
the sheet dropped him onto a screen he had never asked for. (b) Every setup row
on the Profile page carries the FAQ row's grey chevron and opens ONE question in
`ProfileFieldSheet`, which is built from the vocabulary of the sheets that were
already right (`SeasonPhaseShiftSheet`, `RebuildSheet`, `SessionFeedbackPanel`) —
bordered 54pt choice rows, radio for one / tick for many, `size="lg"` Save over a
`secondary` Cancel, and the seven-day questions on the app's OWN chip grid.
**There is no mode to enter first: the pen that briefly existed is gone.**
(c) Saving one answer commits and rebuilds immediately; it does NOT walk on to
the next question — Sam edited his name and was carried to "what is your 2km
time". (d) **Season phase opens the ACTUAL `SeasonPhaseShiftSheet` from My
Status**, same component, same `useSeasonPhaseControl`: a phase change asks
follow-ups and rebuilds a season, so it is not a field edit. (e) Main goal/s is
editable, and the row lists ALL of them — it read `goals[0]` and preferred
`biggestLimitation`, a different answer wearing the goals' label. (f) **The 2km
time trial stays an ONBOARDING step and gets no door in the app** — its old door
died with the setup page and Sam ruled against replacing it.
**Search words:** profile, program setup, something changed, tell the coach,
review your setup, pen icon, chevron, edit one line, field popup, season phase
from profile, main goals, 2km no app door.

**R-260** · *"EQUIPMENT LIST IS FUCKED - IT SHOULD BE THE SAME AS WHAT WAS SAID
IN THE ONBOARDING"*, then *"i also unticked cable machines in my fucking
onboarding and it's showing up as if i had it"*, then *"these don't all need to
say have it"* (Sam, 2026-08-27) · **THE EQUIPMENT EDITOR OPENS ON WHAT ONBOARDING
SAID, AND AN UNTICK IS AN ANSWER. BUILT; SEEN BY SAM ON GLASS.**
(a) It seeded only from the answer THAT EDITOR writes, so an athlete who had
never opened it saw everything blank — including a commercial-gym athlete whose
program assumes the lot. With no saved checklist it now seeds from the LOCATION
PRESET the athlete picked (`trainingLocation` → `EQUIPMENT_LOCATION_PRESETS`).
(b) ⚠ **THE PRESET DOES NOT MERGE PER-ITEM.** The first fix did merge, and put
back every item Sam had UNTICKED at onboarding — onboarding writes an entry only
for what was ticked, so an untick leaves no entry and looked identical to
silence. **A saved answer is the whole answer: ticked is have, absent is does
not have.** (c) The rows are the onboarding TILE — plain when unticked, lime
with a tick when ticked, and **no "Have it" caption on either surface**; NEVER
keeps its label, being a third state onboarding has no twin for. (d) The popup
carries a close control top-right and its Save is pinned outside the scroll view.
(e) The sheet is always mounted, so it re-seeds on open — seeding in `useState`
ran once at app start.
**Search words:** equipment editor, commercial gym all ticked, untick, have it,
onboarding tile, equipment preset, save equipment pinned, close top right.

---

**R-261** · Sam, 2026-08-27: *"conditioning is about training energy systems ...
so it should be counted"*, followed by approval of the shared rule and
*"okay go ahead with 1"*. A proper authored sprint session counts once toward
overall conditioning and also satisfies speed. It retains speed identity and
cannot replace separately required aerobic/repeat-effort work. Warm-up riders
and small primers are not full conditioning sessions by default. Combined
sessions do not double credit: the same component/rows count once, equivalent
choices count once, and combined speed plus intervals earn one session credit
while both training qualities remain distinguishable.
This supersedes the old blanket `SpeedBlockCountingFence.conditioningCredit:
'none'` interpretation, not the board's display grouping or quality-speed rest
rules. The authored template key supplies identity on old saves too; no ledger
rewrite is required. Deload changes dose, not the exposure's identity.
Guard: `LAW-proper-sprint-conditioning-credit`,
`test:canonical-weekly-compiler`, included in `test:release`.
Implementation and measured scope: `docs/STATUS_TESTTRUTH.md` step 19.

**R-262** · Sam, 2026-08-28: *"anything that effects the program should be listed - as a modifier that pops up and shows up in my status"*.

Owner: testtruth. Every active program-affecting restriction, accepted session/fixture
edit and lighter-day choice is visible in the Program indicator and My Status. This supersedes the
old time-cap hiding rule. Preserve R-249's direct My Status navigation: no extra
intermediate popup. Both surfaces use the same list and viewed-week context.
Recorded restrictions do not disappear because session prose changes or an old
note was dismissed. Separate accepted reports remain independently clearable;
Clear uses the existing canonical transaction and preserves unrelated edits.
Generated planned deload is shown from typed compiler metadata, read-only.
Session and fixture changes expose the existing exact latest-action Undo only
when eligible; showing an older active change does not manufacture a new Undo.
Guard: `LAW-all-program-effects-visible`, `test:modifier-lifecycle`, in
`test:release`. Receipts and NOT COVERED: `docs/STATUS_TESTTRUTH.md`.

**R-263** · *"there's no checkbox for the conditioning section like there is for
all the exercises above it"*, *"when you tap form cues - a lot of the exercises
form cues cover and glitch with the weight toggle … you can drop the weight
toggle below the last line"*, *"the completion badge thing that pops up can't be
seen on screen"*, *"the pretty cooked has a shaded background on the icon"*, *"the
injury one … they're all lime green = they should match the blue orange red"*
(Sam, 2026-08-27, afternoon) · **FIVE SESSION-AND-SHEET FIXES. BUILT; ALL SEEN BY
SAM ON GLASS.**
(a) **The conditioning checkbox was never missing from the MODEL.** Every
execution item is wrapped in `ExecutionChecklistItem`, which builds a checkbox
and hands it to `renderItem`; the two conditioning branches dropped the argument,
so the section's `0/1`, Select all and the saved receipt were all counting a row
the athlete could not tick. One tick per execution item — a choice row gets ONE,
never one per option, or two ticks would claim both were done. **Corrected on
Sam's physical phone, 2026-08-31:** the first cut put that tick in the title
header, where swap/remove already own the corner, so it sat one column inboard
from every other card. Choice and phase cards now pass the same checklist-owned
tick to one trailing completion row at the card's right edge. The move changes
no completion id, toggle, saved receipt or option-counting semantics.
⚠ `styles.controlsRow` is COUNTED by a law to keep the strength card's control
line single; conditioning uses its own shared trailing placement owner.
(b) **An open form cue drops the weight toggle below the last line.** The
controls are absolute at the card's bottom-right by R (2026-08-20) — pinned so
they centre against a COLLAPSED row without setting its height — and an expanded
cue flowed underneath them. The pin holds while collapsed; an open cue renders
the SAME element inside a positioned slot after the cue. The slot cancels
`EXERCISE_COLUMN_ACTION_RESERVE`, the column's 68pt quick-action reserve, or the
controls land 68pt inboard instead of straight down. Gap under the last line: 1.
(c) **The completion moment rendered as the LAST CHILD OF THE SESSION LIST**, so
on any session longer than a screen it appeared below the fold, held 2.5s and the
screen closed. It is an overlay `Sheet` now, and the beat is 4s. **"Consistency
starts here." is REMOVED** — a first session shows no support line at all.
(d) "Totally cooked" lost its `accent` plate: a LIME wash behind a RED glyph, the
only row in that sheet wearing two colours.
(e) The three injury regions were all `colors.accent.lime`; they now wear the
same blue/amber/red the Fatigue and Sick sheets use, in list order. The guard
that REQUIRED lime — and named these very hexes as forbidden — is inverted.
**Search words:** conditioning checkbox, form cues overlap weight toggle, drop
below last line, completion badge not visible, consistency starts here, totally
cooked shade, injury region colours.

**R-264** · Sam's programming-remediation direction, 2026-08-28 (P05/P08/P09/P10/P14/P20/P21).

Owner: programming-remedy. Advanced automatic curl choices prefer available
loaded biceps alternatives; band-only fallback and younger training ages remain.
Machine availability is a conditioning feasibility test, not a reason to narrow
to templates supporting the largest number of machines. Ordinary conditioning
receivers are selected as complete feasible whole-week sets, preserving exposure
budgets, fixture-relative priorities and hard constraints. R-237's narrower P03
amendment is recorded at that ruling. No change to P06 catalogue policy, new
power exercise roles/doses or assumptions about unreported club speed is implied.
Comparable upper/lower placements use recurring weekly gaps, including the
Sunday–Monday boundary. Conditioning chooses within the required category using
accepted per-block, per-occurrence identity history in the existing selection
history store: quality before template, no writes from previews, no cursor
consumed by rebuilding. Dose remains the authored template's. New blocks may
rotate; current accepted identities restore whenever feasible. The adapter
retains the specialist's feasible choice. This does not author extra exposures.
P09: the existing conditioning component's typed selected modality also reaches
the session prescription and year report (running versus off-leg). A strength
exercise name is never a modality input. P20's current-kit requirement includes
authored Primer/Gunshow/Accessories and dated restrictions on accepted Add rows;
Clear reconstructs their healthy accepted source instead of storing a filtered
replacement as a new athlete choice.
Guard: `LAW-programming-remediation-inputs-and-selection`,
`test:canonical-weekly-compiler` (`programmingInputTruth`), plus the existing
`test:weekly-scheduler` contract matrix. Status and NOT COVERED:
`docs/STATUS_PROGRAMMING_REMEDY.md`.

**R-265** · Sam's five programming follow-up decisions, 2026-08-28.

Owner: programming-remedy. Leg Press and conventional Deadlift remain manual
choices and suitable fallbacks, not automatic variety ahead of suitable legal
alternatives. P16's existing direction applies at the weekly slot level: if
permanent kit leaves Leg Press as the sole suitable bilateral squat, cover that
pattern once and keep the other lower day's single-leg work without another
Leg Press. Do not relabel unilateral work, add sets, erase an accepted block
selection or override an explicit pin. Existing accepted block selections restore. Box Jumps, Broad
Jumps and Jump Squats join the ordinary power pool without invented lower
preference than Vertical Jump; dose still belongs to the existing power policy.
G+2 in-season offers off-leg flush unless conditioning/team training is already
there; explicit mild soreness makes it required. Actual equipment, safety,
fixture restrictions and explicit unavailability still bind. A flush does not
manufacture fitness-conditioning credit. Adding Mobility or Recovery first
reads every exercise on the destination day, including strength warm-ups, and
composes a separate session with none of those exercises repeated. Existing
daily limit, logging and Undo remain. Sam accepted the existing club-speed floor
policy; R-079's permission is not an instruction to add unnecessary sprint work.
Guard: `LAW-programming-followup-approved-pools-flush-and-add`,
`test:canonical-weekly-compiler` (`programmingSelectionDecisions`,
`unilateralPriorityJourney`, `gPlusTwoFlushJourney`, `lowLoadAdditionJourney`, `conditioningClarity`).
Findings and NOT COVERED: `docs/PROGRAMMING_FOLLOWUP_2026-08-28.md`.

**R-266** · Sam's settled flush/retirement decisions, 2026-08-28.

Owner: programming-remedy. Retire the incomplete Bodyweight Circuit from
automatic selection without deleting the entry or saved references. Every flush
is easy off-leg recovery, strictly under 15 minutes including all rests,
preparation and transitions. Bike, Air Bike, RowErg and SkiErg are permitted when
available and suitable; one machine or a displayed round-by-round order is
allowed. Concrete timed doses are 4×1:1 (Short), 5×1:1 (Easy/Nasal), 4×2:1 (Erg),
10×30:30, 6×1:1 and 4×2:1. The first round includes preparation and all transitions
occur inside recovery; the final recovery is counted. This supersedes old flush
doses/restrictions only. Hard-conditioning limits remain. G+2 placement,
optional/core rules, availability/injury safeguards and no fitness-conditioning
credit remain R-265. Eligibility reads explicit permitted modalities and the
actual resolved prescription, not prose or unused alternatives.

Guard: `LAW-short-explicit-recovery-prescriptions`,
`test:canonical-weekly-compiler` (`flushPrescriptionTruth`, `flushRestartJourney`,
`gPlusTwoFlushJourney`, `conditioningClarity`). Original dated workbook remains
unchanged; seven explicit replacement records are equality-checked. Findings and
NOT COVERED: `docs/STATUS_PROGRAMMING_REMEDY.md`.

**R-269** · Sam's combined-day Mobility icon request, 2026-08-28.

Owner: programming-remedy. Resolve each component's icon from its typed identity
using the existing shared icon mapping. Mobility uses the person; Recovery keeps
the battery. No displayed-name inference, new icon, programming or completion
change. Guard: `LAW-component-typed-mobility-icon`,
`test:canonical-weekly-compiler` (`lowLoadAdditionJourney`). Native and restart
verification status and NOT COVERED: `docs/STATUS_PROGRAMMING_REMEDY.md`.

**R-267** · Sam's simple injury-flow decision, 2026-08-28.

Owner: programming-remedy. Main flow stays body area → severity → adjustment;
painful-movement reporting is optional. Existing mild/moderate rules remain;
6–7 excludes Caution/Avoid, 8–10 retains only clearly unaffected work. Ratings
include indirect support/loading. Explicit pain overrides generic ratings at
every active severity, including resolved conditioning machines. Preserve
historical reports. Serious symptoms use the separate safety pathway regardless
of numeric severity; no diagnosis or rehabilitation prescription is introduced.
Guard: `LAW-simple-injury-shared-safety`, `test:canonical-weekly-compiler`
(`simpleInjurySafetyTruth`, `guidedInjuryUiTruth`, `flushPrescriptionTruth`).
Verification status and NOT COVERED: `docs/STATUS_PROGRAMMING_REMEDY.md`.

**R-268** · Sam's P15/P19 decisions, 2026-08-28.

Owner: programming-remedy. In-season speed is not blanket-excluded by club
attendance. Reported missing acceleration/top-speed qualities may receive
existing authored speed work through the scheduler, within injury, fatigue,
availability, game-timing and weekly limits. Do not duplicate covered qualities.
Explosive Landmine Press is selectable power only, never a strength-slot choice
or strength credit. Existing power dose, equipment and experience gates remain.
P18 flush is unchanged. Supersedes older no-club-only/strength-role statements
in WC-135 and R-265, not their unrelated safety limits or doses.
Guard: `LAW-speed-quality-and-landmine-power`, `test:canonical-weekly-compiler`
(`inseasonSpeedTruth`, `powerOnlyLandmineJourney`). Verification status and
NOT COVERED: `docs/STATUS_PROGRAMMING_REMEDY.md`.

**R-270** · Sam's saved exercise implementation authorization, 2026-08-28.

Owner: intake. Implement all ten movements in `docs/EXERCISE_INTAKE_2026-08-28.md`
through the existing catalogue and canonical compiler, including their approved
automatic, manual, warm-up, accessory and Primer uses. The submitted ratings,
units, per-side prescriptions, experience and fixture restrictions bind.
Ball suitability, throwing wall and safe slam space require explicit equipment
answers; gym location and dead-ball ownership do not answer them. The three
specified ball power movements supersede the former blanket retirement; chest
passes, overhead throws, Bird Dogs and a conditioning slam template do not return.
Power rest remains hidden. Estimated 1RM is outside this work.
Guard: `LAW-exercise-intake-20260828`, `test:exercise-intake`.
Unresolved variant instructions and NOT COVERED: `docs/STATUS_INTAKE.md`.

The ball/wall/space equipment-answer clause above is superseded by R-296. The
exercise identities, prescriptions, eligibility and other R-270 boundaries are
unchanged.

**R-271** · Sam's attached device findings, 2026-08-28.

Owner: intake. Source: `/Users/samgeurts/Downloads/Untitled note.pdf`, three pages,
supplied with the explicit request to fix these alongside the exercise intake.
An addition confirmation names the work added, not the entire resulting day.
Removal names the visible components, including Gunshow and Mobility. Removing
Mobility must permit adding it again, retaining the other component and allowing
Undo and restart. Session and fixture edits belong to history, not Active
Modifiers; the latter retains athlete-state restrictions such as injury, illness,
fatigue, equipment and travel. This narrows R-262's session/fixture inclusion;
its restriction visibility, Clear and shared-count requirements remain.
Guard: `LAW-session-stack-and-status-boundary`, `test:canonical-weekly-compiler`
(`mobilityAddJourney`) and `test:modifier-lifecycle`.
Transaction reassessment, verification status and NOT COVERED: `docs/STATUS_INTAKE.md`.
**R-271 reaffirmed, 2026-09-03 (hingecod).** Sam, after the phone preview: *"Keep the
card off — my 28 August ruling stands. Call the Manage week route 'move it back',
not Undo."* No "Game moved" card on My Status, live or after a relaunch; the
route an athlete takes after a relaunch is the board (Manage week → drag →
save), named "move it back". `.maestro/audit/week-move-game.yaml` and
`test:move-game-relaunch` carry that wording.

**R-272** · Sam's Estimated 1RM implementation decisions, 2026-08-29.

Owner: intake. Read the saved `FEATURE_BRIEF_ESTIMATED_1RM_RIR_2026-08-28.md`
with Sam's final message: Bench/OHP, Pull-Up/Lat Pulldown, Back Squat/Bulgarian
Split Squat, RDL/Trap-Bar Deadlift are four configurable charts, never program
edits. Retain separate lift and calculation-method histories. Ask only for a
selected checked lift's last-set RIR: an initially unanswered 0–4/5+ picker.
Unanswered/open-ended 5+ create no estimate. Old persisted Skip observations
remain readable and create no estimate. Calculate only at RIR 0–4 and
completed reps plus RIR no greater than 15, using the verified Nuzzo curves
(Bench-specific curve for Bench). Preserve raw inputs and version; no automatic
load changes, confidence badges or new PB awards. Last-set fatigue remains.
Pull-ups use recorded session bodyweight plus added load and display estimated
added load. Assisted pull-ups remain out of scope. Bulgarians use one total
external load, reps and RIR for the non-dominant leg; no side selector or second
leg entry. New observations never fall back to the legacy best-set calculation.
Historical legacy lines remain clearly separate.
**Corrected from physical-device feedback, 2026-08-31:** the first form took
liberties Sam did not authorize. A checked tracked lift now asks only its lift
name, **“How many more clean reps could you have done on your last set?”**, and
the existing unanswered 0–5+ picker. These questions appear after the estimated
training-minutes field and reuse the popup's typography and picker owners. The
load comes from that session row's weight control; reps come from the canonical
rep target the session displays (for example, 3 × 3 supplies 3). There is no
editable weight, rep, bodyweight or setup/technique field, no Skip action, no
last-set summary and no repeated approximation caveat in this popup. Setup no
longer gates Lat Pulldown or partitions a lift's new history. Existing saved raw
observations remain readable; no stored athlete data is deleted or rewritten.
**Audit F002 reclassified by Sam, 2026-08-31:** the saved exercise weight plus
the displayed prescribed repetitions for the completed final working set plus
the athlete's last-set RIR answer are the intended estimator inputs. A checked
3 × 3 supplies 3 reps, 3 × 5 supplies 5 and 4 × 8 supplies 8. The ordinary
athlete flow does not require actual per-set repetition entry, so audit-injected
or incidental logged reps must not replace the prescribed value. F002 is an
intentional product simplification, not a software defect; the historical audit
receipt remains unchanged.
This explicitly authorizes the feature previously excluded from R-270's intake.
Guard: `LAW-estimated-1rm-last-set-rir`, `test:estimated-1rm`.
Research, verification status and NOT COVERED: `docs/STATUS_INTAKE.md`.

**R-273** · Sam's session section Add consistency decisions, 2026-08-29.

Owner: intake. Every editable exercise section uses the existing shared + and
Add route, including Strength, Conditioning, Mobility, Primer, Accessories,
Recovery and Optional Work. The tapped section and exercise role are distinct
typed inputs and survive accepted edits/restart. Safety filters choices, never
the button; an empty safe list explains why. Completed session records remain
read-only. No exercise Add buttons on games or team-training entries. Existing
rows, cues, videos and loading controls remain. This supersedes R-217's older
empty-choice button suppression, not existing equipment/injury/fixture limits.
Guard: `LAW-session-section-add-context`, `test:session-section-add` and
`test:session-execution`; full compiler tests retain Move/Undo and annual rules.
Verification status, safety conflicts and NOT COVERED: `docs/STATUS_INTAKE.md`.

**R-274** · Athlete-added strength ownership and planner cap, 2026-08-29.

Owner: intake. The four-session main-strength maximum governs what LFA
automatically programs. A deliberately athlete-added fifth session retains the
existing `AthletePlacement` provenance through session Add, exercise
Add/Swap/Remove, restart and Undo. True athlete-added strength is excluded from
the planner-frequency and Section 18 maximum-breach calculation, including
after completion, while an athlete edit to an existing programmed session is
still app-frequency. Both remain athlete-owned, and all completed work remains
in total workload and training history.
The app must not delete, reduce or move another session to compensate. Five
app-authored main-strength sessions remain a blocking over-programming defect.
Equipment and injury legality continue to come from the canonical exercise
chooser and compiler; this ruling creates no parallel session kind or
name-based exception.
Guard: `LAW-athlete-added-strength-outside-planner-cap`,
`test:section18-v2` and `test:canonical-weekly-compiler`.
Verification status and NOT COVERED: `docs/STATUS_INTAKE.md`.

**R-275** · Missed-session move and dated fatigue sequence, 2026-08-30.

Owner: fatiguecatchup. The missed-session question has three signed answers:
“Yes, log it”, “No, skip it” and “No, move it”. Move opens the existing Week
board and authorises only that prompt's past, unlogged item to move to today or
the future; it must not turn future work into a past obligation.

Every fatigue choice writes one dated fact. Bit tired is noted only. Pretty flat
slightly reduces that date through the canonical lighter-day transformation.
Totally/absolutely cooked means no session on that date and therefore no later
missed-session chase. Any two consecutive calendar dates with any combination
of the three choices deload from the second date through Sunday. Cooked remains
rest on its own date. Same-date repeats do not form a streak; a gap breaks it;
Sunday followed by Monday opens a fresh Monday-through-Sunday deload. The
athlete is told: “That’s two tired days in a row.” Clear removes the factual
report from derivation; expiry does not erase history.

**Copy corrected from physical-device feedback, 2026-08-31:** the successful
record-only “bit tired” sheet keeps the title **“Got it”** and says **“You should
be okay to train as planned, but if you start feeling flatter, let me know and
we’ll pull things back.”** This replaces “Noted — today stays as planned.” It
does not change the recorded fact, fatigue level, program derivation, later
lighter-day threshold or consecutive-day deload behaviour.

**Week-editor heading removed from physical-device feedback, 2026-08-31:** the
redundant “Sessions / games” banner above the editable board is absent. The
actual game move/add picker instructions remain, an unchanged editor can still
leave through the existing Day / Week control, and a changed editor still
finishes through Save changes.

This supersedes R-035/R-038's rolling seven-day readiness horizon and its rule
that cooked sessions remain offered. Illness remains a separate door and does
not count toward the fatigue sequence.
Guard: `LAW-dated-fatigue-and-missed-move`, `test:fatigue-sequence`,
`test:missed-session-prompt` and `test:plan-change-producer`.
Verification status and NOT COVERED: `docs/STATUS_FATIGUECATCHUP.md`.

**R-276** · App-wide readable small type, 2026-08-31.

Owner: legibletype. The explanatory lines below Tired, Sick and Injured use
12pt type with a 16pt line height. Elsewhere, every athlete-facing word uses at
least 11pt type; compact hierarchy comes from weight, colour and spacing rather
than unreadably small letters. The larger onboarding scale remains unchanged.
Invisible automation markers and an icon-only selected-tile checkmark are not
readable copy and keep their functional sizes.

This supersedes only the sub-11pt values in R-057's Renee typography scale. The
System face, heading hierarchy, normal casing and screen structures remain.
Guard: `LAW-renee-typography-app-wide`, `test:prototype-typography` and
`test:day-first-timeline`.
Verification status and NOT COVERED: `docs/STATUS_LEGIBLETYPE.md`.

**R-277** · Accepted lived-history integrity and completed load, 2026-08-31.

Owner: historyfix. A completed strength outcome stores the athlete's actual
minutes on the existing canonical session-feedback fact beside session RPE. A
transaction reports committed only when every semantically accepted answer in
the normalized athlete intent matches the persisted fact; the candidate being
written cannot serve as its own verification oracle. A verification failure
restores the prior accepted state.

Completed session load is actual minutes × session RPE in AU. Strength,
conditioning, team training and games all contribute through one completed-load
derivation, each measured component exactly once. Combined day records are
visited once, genuinely separate same-day sessions each contribute once,
skipped optional sessions and rest days contribute zero, completed optional
sessions contribute their actual load, removal removes the load, and restart or
phase change reconstructs the same daily, weekly and four-week rolling history.
This monitoring history does not automatically rewrite future programming.

Guard: `LAW-accepted-lived-history-integrity`, `test:journal-load` (including
its production `test:lived-history-foundations` journey and deliberate
minutes-loss mutation). Verification and NOT COVERED:
`docs/STATUS_HISTORYFIX.md`.

**R-278** · Personal Injured-tile explanation, 2026-08-31.

Owner: legibletype. The Injured tile beneath “Not feeling 100%?” says “Adapt
training around your injury”. This supersedes only the earlier template wording
“Adapt training around an injury”; the Tired and Sick wording, all three icons,
their destinations and the status-card layout remain unchanged.

Guard: `LAW-day-change-card-owns-plan-actions` and
`test:day-first-timeline`.
Verification status and NOT COVERED: `docs/STATUS_LEGIBLETYPE.md`.

**R-279** · Compact performance tests, pace authority and body measurements, 2026-08-31.

Owner: progressmetrics. Progress removes the large 2km-only card and places a
compact Performance tests section below Main Lifts. The athlete chooses one
test in each category: Aerobic is 2km TT or 3km TT; Anaerobic is 400m run or
1 min max cal air bike; Sprint is 100m sprint or “20m sprint (electronically
timed)”. Results persist as one history per test. The newest result compares
with the previous result for that same test: faster timed results show a green
down arrow and percentage improved; slower timed results show a red up arrow
and percentage worse. Air-bike calories reverse that direction and success
rule. A first result is an honest baseline with no invented percentage.

The selected aerobic result derives running pace from distance divided by time,
for both 2km and 3km. The existing onboarding 2km answer remains read fallback
until a new aerobic result exists. The other four tests are progress-only.
Editable height and weight sit beneath the tests, retain the existing accepted
measurement bounds and save through the accepted profile/program transaction.

Guard: `LAW-progress-performance-tests-and-measurements` and
`test:coach-snapshot`.
Verification status and NOT COVERED: `docs/STATUS_PROGRESSMETRICS.md`.

**R-280** · Simplified main-lift selectors and plain progress comparisons, 2026-08-31.

Owner: progressmetrics. The Progress strength heading reads “Main lifts
(Estimated 1RM)” once. Each of the four strength cards shows only the currently
selected lift and its result; tapping the lift opens its two choices instead of
showing both choices permanently inside the card. The pairs remain Pull-Up/Lat
Pulldown, Bench Press/OHP, RDL/Trap-Bar Deadlift and Back Squat/Bulgarian Split
Squat. The first option is displayed as “Pull-Up (added weight)”. An empty card
shows “No data yet” without a second lime dash pretending to be a value.

Performance change has no arrow or chart icon. A positive result shows the
percentage followed by “better” in green; a negative result shows the percentage
followed by “worse” in red. Timed tests improve when time falls, while the
max-calorie test improves when calories rise.

Guard: `LAW-progress-shows-four-fixed-predicted-one-rep-max-graphs`,
`LAW-progress-performance-tests-and-measurements` and `test:coach-snapshot`.
Verification status and NOT COVERED: `docs/STATUS_PROGRESSMETRICS.md`.

**R-281** · Sweet-spot load hero and weekly AU history, 2026-08-31.

Owner: progressmetrics. The top Progress card keeps the existing signed
acute-versus-four-week-normal continuum and names its three states “In the
sweet spot”, “Potentially overtraining” and “Potentially undertraining”. When
the stored current week is deliberately deloaded, a below-range result says
“Deload week” instead of implying undertraining. The explanation says the
sweet spot helps the athlete build fitness without training too hard or
undertraining; a deload explains that lower load is expected.

The same card adds a weekly load-over-time chart in AU. Its points come from
R-277's one completed-load owner—actual minutes multiplied by session RPE for
strength, conditioning, team training and games—rather than a second screen
calculation. This Progress chart is the explicit exception to the older raw-AU
and monthly-only chart wording; the relative four-week continuum remains the
owner of the status because an absolute AU has no universal good/bad threshold.
The graph waits for two measured weekly points and otherwise says it builds as
the athlete trains. Monitoring remains read-only and does not automatically
change future programming.

Guard: `LAW-progress-load-owns-the-dashboard-hero`,
`LAW-accepted-lived-history-integrity` and `test:coach-snapshot`.
Verification status and NOT COVERED: `docs/STATUS_PROGRESSMETRICS.md`.

**R-282** · Conditioning template identity survives equipment delivery, 2026-08-31.

Owner: condnames. Sam approved the correction after the active-session screen
showed the exact Continuous Aerobic Run prescription under the unlisted title
“Outdoor Aerobic Run”. Equipment feasibility may change how a selected
conditioning template is delivered, but it never renames that template.
Running, walking, bodyweight or mixed delivery is shown separately as the mode;
the title remains one of the authored conditioning template identities and the
prescription still comes from that template.

This extends R-238–R-240's one-title/one-prescription ruling. The former
equipment-substitution row-name vocabulary is retired rather than retained as a
second set of conditioning titles.

Guard: `LAW-conditioning-shows-one-plain-title-and-one-prescription` and
`test:conditioning-identity`. Verification status and NOT COVERED:
`docs/STATUS_CONDNAMES.md`.

**R-283** · Conditioning delivery uses one professional Mode field, 2026-08-31.

Owner: condnames. Sam rejected the redundant labels “Run · running” and the
equivalent machine wording. The session view uses exactly `Mode: Run`, `Mode:
Bike`, `Mode: Air Bike`, `Mode: RowErg` and `Mode: SkiErg`. A genuinely mixed
session keeps the same field and shows only its ordered modes, for example
`Mode: Bike → RowErg`. Equipment fallbacks use the same grammar: `Mode: Walk`,
`Mode: Run / Walk`, `Mode: Bodyweight` or `Mode: Mixed`.

This corrects R-282's vague “shown separately as the mode” wording; it does not
change template identity, dose, modality selection or equipment feasibility.

Guard: `LAW-conditioning-shows-one-plain-title-and-one-prescription` and
`test:conditioning-identity`. Verification status and NOT COVERED:
`docs/STATUS_CONDNAMES.md`.

**R-284** · One font size throughout a conditioning card, 2026-08-31.

Owner: condnames. Sam required the conditioning card's text to be the same
font size throughout. The template title, Mode field, Work, Recovery, count,
Intensity, coaching cue and personal pace all use 15 points. Font weight and
colour may still distinguish a title, structured label or pace prescription;
size may not.

This applies to both the ordinary one-prescription row and every row inside a
genuine multi-option conditioning card.

Guard: `LAW-conditioning-shows-one-plain-title-and-one-prescription` and
`test:session-template`. Verification status and NOT COVERED:
`docs/STATUS_CONDNAMES.md`.

**R-285** · Conditioning labels do not use a second text weight, 2026-08-31.

Owner: condnames. Sam's follow-up glass review showed that `Work`, `Recovery`,
`Rounds` and `Intensity` were still visually different because a nested text
span made those labels extra-bold and white while their values used the body
weight and colour. The labels and values now use the same text style. Colons
and line breaks provide the structure; a second label font treatment does not.

This supersedes R-240's label-emphasis instruction and narrows R-284's allowance
for weight and colour: the title and personal pace may retain their hierarchy,
but structured prescription labels may not differ from their values.

Guard: `LAW-conditioning-shows-one-plain-title-and-one-prescription` and
`test:session-template`. Verification status and NOT COVERED:
`docs/STATUS_CONDNAMES.md`.

**R-286** · Conditioning cards use an athlete hierarchy, not database fields, 2026-08-31.

Owner: condnames. Sam replaced the session card's labelled field stack with a
universal athlete-facing hierarchy: template name, plain modality, prominent
session structure, work/recovery pair, between-block recovery, intensity, one
coaching cue, then a relevant personal target in lime. The 30-second hard card
therefore reads `Bike`, `2 blocks × 5 rounds`, `30s hard / 30s easy`, `2–3 min
between blocks`, `100–110% MAS`, then its cue. `Mode:`, `Work:`, `Recovery:`,
`Rounds:` and `Intensity:` do not render.

This supersedes R-283's `Mode:` prefix, R-284's one-size instruction and
R-285's labelled-line treatment. The modality is a quiet italic line, structure
is the clearest text, and a divider separates structure from intensity. One
shared pure projection owns the hierarchy for all 55 authored templates and
both session render paths.

A min/km personal target is relevant only when the typed delivered modality is
exactly `Run`. Bike, Air Bike, RowErg, SkiErg, mixed, walk and run/walk sessions
show no running target. The relevant lime line is named `Your target`, matching
the approved mock-up; an unmeasured estimate keeps its honest `Estimated
target` qualifier.

Guard: `LAW-conditioning-shows-one-plain-title-and-one-prescription`,
`test:conditioning-templates`, `test:conditioning-identity`,
and `test:session-template`. Supporting copy-census verification and NOT
COVERED: `docs/STATUS_CONDNAMES.md`.

**R-287** · Speed is a proper ordered session section, 2026-08-31.

Owner: condnames. When a workout carries prescribed speed work, the active
session shows the actual speed exercises inside a `Speed` section using the
same section and prescription-card treatment as the other work. The active
session order is Mobility / Warm-up, Strength, Speed, then Conditioning. Speed
never falls through to a generic `Session` section or a bare `speed work`
placeholder.

This completes the existing 2026-08-17 ruling that sprint rows belong under
Speed rather than Strength, and supersedes that note's claim that the active
session places Speed before lifting. It changes presentation and checklist
membership, not speed selection, dose, sprint credit or conditioning credit.

Guard: `LAW-session-speed-rows-and-order`, `test:session-template` and
`test:session-execution`. Verification status and NOT COVERED:
`docs/STATUS_CONDNAMES.md`.

**R-288** · A Primer always ends after its seventh low-fatigue row, 2026-08-31.

Owner: selectionrepair. Sam removed the three former optional exercise rows
from every Primer: Acceleration, the rotating Trap Bar Deadlift / High Box
Squat row, and Bench Press. A Primer remains two hip-mobility drills, one upper
mobility drill, one further lower/midline mobility drill, Pogo Hops, one upper
power exercise and one lower power exercise. The same composition applies to
generator-placed and athlete-added Primers. Athletes who want more work add a
separate Strength session.

This supersedes only R-129's optional Acceleration and heavy-but-easy rows. It
does not alter Primer placement, purpose, duration, low-stress counting,
mobility regions, power selection, load-control behaviour or the female-path
placement amendment in R-130.

Guard: `LAW-primer-stays-seven-low-fatigue-rows` and `test:exercise-intake`
(`test:primer-session` S7/W1/W2). Verification status and NOT COVERED:
`docs/STATUS_SELECTIONREPAIR.md`.

**R-289** · Injury-adjusted strength and conditioning use honest identities, 2026-08-31.

Owner: selectionrepair. When an injury adjustment pauses every originally
planned strength movement pattern, the strength component is named
`Injury-Adjusted Session`. It is not left under the original pattern name and
is not renamed from the replacement rows. If at least one original pattern
survives, the existing typed effective-pattern name remains authoritative.

An explicitly off-feet conditioning request may not select an authored
template whose identity says `Run`. The selector chooses another feasible
same-quality authored machine template; if none exists, the existing injury
feasibility boundary removes conditioning. The founding 2027-03-01 high
calf/Achilles case therefore receives `Steady Blocks` on Bike rather than
`Continuous Aerobic Run`. This narrows R-282 only at selection time: later
equipment substitutions still preserve the identity of the honestly selected
template.

Guards: `LAW-fully-replaced-strength-is-injury-adjusted-session` with
`test:session-naming`, and `LAW-off-feet-selection-never-names-running` with
`test:conditioning-templates`. Verification status and NOT COVERED:
`docs/STATUS_SELECTIONREPAIR.md`.

**R-290** · Complete, clock-readable conditioning copy, 2026-08-31.

Owner: condnames. Every one of the 55 authored conditioning templates has one
complete athlete-facing projection: plain title, work, recovery, count,
intensity and one short coaching cue. Approximate sprint times are removed when
distance is the actual prescription. Timing uses familiar intervals and simple
departures—5, 10, 15, 20, 30 and 60 seconds or whole minutes—where doing so
preserves the intended energy system, work-to-recovery relationship and total
dose. The athlete should not have to repeatedly add awkward work and recovery
figures to know when the next effort starts. Familiar clock points—including
30, 45, 60 and 90 seconds and whole minutes—remain available where they fit the
session.

This is a presentation resolution over the signed conditioning source, not a
replacement programming system. The signed template remains authoritative for
quality, eligibility, placement, modality constraints, safety caps and authored
dose bands. Internal selection and safety readers consume those signed fields;
the athlete projection resolves the one concrete instruction shown in the
session. One complete projection replaces the former partial title, cue and
prescription maps so there cannot be two competing athlete versions.

Every non-flush standalone conditioning session uses exactly:

`Warm-up`

`5–10 min build-up`

`Start with an easy jog, then progress into run-throughs, increasing the intensity as you go.`

Guard: `LAW-conditioning-athlete-copy-is-complete-and-clock-readable` and
`test:conditioning-templates`. Supporting census and simulator verification:
`test:conditioning-copy-census`, `.maestro/visible/conditioning-one-prescription.yaml`
and `docs/STATUS_CONDNAMES.md`.

**R-291** · ATG remains an acronym in exercise display copy, 2026-08-31.

Owner: selectionrepair. Every athlete-facing exercise projection writes
`ATG Split Squat`, never `Atg Split Squat`. The canonical catalogue identity
was already correct; the shared display formatter must preserve `ATG` as an
acronym rather than title-casing it as an ordinary word. Matching, cue, video
and programming identities remain unchanged.

Guard: `LAW-atg-exercise-display-acronym` and `test:exercise-display`.
Verification status and physical-phone receipt:
`docs/STATUS_SELECTIONREPAIR.md`.

**R-292** · Mobility / Warm-up never repeats a session exercise, 2026-08-31.

Owner: selectionrepair. A derived Mobility / Warm-up flow may not prescribe an
exercise whose canonical identity already appears in the workout's visible
Power, Strength, Speed, Conditioning, Mobility or Recovery content. The
warm-up selector takes the next legal exercise from the same authored slot; it
does not delete a duplicate after composition or change the main session.

R-213's completed-warm-up retention remains authoritative except at this exact
collision: if a later session edit puts a completed warm-up exercise into the
load-bearing session, that main row wins and the flow does not restore a second
visible prescription for the same movement. Non-conflicting completed warm-up
movements still survive re-derivation.

Guard: `LAW-warmup-never-repeats-session-exercise` and `test:mobility-flow`.
Verification status and physical-phone receipt:
`docs/STATUS_SELECTIONREPAIR.md`.

**R-293** · Conditioning intensity units follow typed modality, 2026-08-31.

Owner: selectionrepair. The selected typed conditioning modality owns the
athlete-facing intensity measure. Running retains the authored MAS percentage
or running pace. Bike, Air Bike, RowErg, SkiErg and mixed-ergo work display
`Effort: X/10`, with the value deterministically derived from that template's
authored intended intensity. The modality is never inferred from a session
name, description, cue or catalogue position.

This is a read-time projection over the selected conditioning option. Generic
stored prescription copy remains modality-neutral, so generated sessions,
added sessions, swaps, injury substitutions and restart reconstruction all use
the same rule without rewriting dose, work, recovery, rounds, instructions,
selection or placement.

Guard: `LAW-conditioning-intensity-unit-follows-typed-modality` through the
chained `test:conditioning-identity` gate. The same census is release-blocking
through `test:conditioning-modality-persistence`. Verification status and NOT
COVERED: `docs/STATUS_SELECTIONREPAIR.md`.

**R-294** · Movement Prep and Mobility retain distinct identities, 2026-08-31.

Owner: selectionrepair. The derived warm-up section is called `Movement Prep`
and uses the flame icon on both the Day view and active Session view. A typed
standalone or athlete-added Mobility session remains called `Mobility` and
keeps the established mobility-person icon.

The distinction is resolved from the typed composed-session identity at the
shared execution-plan boundary. Exercise names, workout titles and description
copy do not decide it. This narrows R-269: its Mobility-person ruling continues
to govern explicitly composed Mobility work, while derived prep now has the
separate Movement Prep identity.

Guard: `LAW-movement-prep-and-mobility-have-distinct-identities` through the
chained `test:session-execution-checklist` gate. Verification status and NOT
COVERED: `docs/STATUS_SELECTIONREPAIR.md`.

**R-295** · Automatic programming variety has no constraint explainer, 2026-08-31.

Owner: selectionrepair. Automatic exercise variety, collision avoidance and
programming de-duplication do not display a `Swapped from …` line. Equipment
wording is shown only when the block-selected exercise is genuinely illegal
under that date's typed available kit. Injury and athlete-authored exclusions
retain their existing truthful explanations.

The founding case was a healthy, full-kit session containing `Hamstring Curl`.
It displayed `Swapped from Single-Leg RDL — equipment today` despite zero
equipment limitations. The composer had deliberately replaced the second
RDL-family movement to honour R-233, but its cause classifier recognized only
an exact duplicate and defaulted every other substitution to `kit_today`.

The composer now records RDL-family collision avoidance as `already_on_day`,
keeps that provenance internally, and the shared badge owner renders no copy
for that automatic cause. `kit_today` must be proven by the base exercise's
actual illegality under the day's kit. Any substitution with no attributable
cause fails compilation instead of inventing equipment context.

The display owner also revalidates any persisted `kit_today` provenance against
the current typed kit. If the base exercise is legal today, the line is hidden
immediately rather than waiting for canonical reconstruction. A genuine illegal
base exercise keeps the equipment explanation.

Guard: `LAW-automatic-variety-has-no-constraint-explainer` through
`test:rdl-family + test:session-injury-review`. Verification status and NOT
COVERED: `docs/STATUS_SELECTIONREPAIR.md`.

**R-296** · One Medicine ball equipment answer, 2026-08-31.

Owner: selectionrepair. Onboarding, Profile and temporary-equipment editing show
one option labelled `Medicine ball`. `Ball suitable for slams`, `Suitable
throwing wall` and `Impact-safe floor and clear space` are retired as separate
equipment answers.

Selecting `Medicine ball` permits every approved medicine-ball throw and slam.
The athlete decides whether their ball and surroundings suit the movement; if
not, they change the exercise or remove Medicine ball. Commercial gym starts
with Medicine ball ticked, like its other equipment, so the athlete can remove
it during onboarding.

New writes contain only the canonical `medicine_ball` capability. Older saved
ball/wall/space answers and temporary facts lift at read to that capability, so
an existing athlete neither loses valid access nor sees retired questions when
editing their answer. This supersedes only R-270's split ball/wall/space
equipment-answer clause; the approved movements and their programming rules are
unchanged.

Guard: `LAW-one-medicine-ball-equipment-answer` through the chained
`test:equipment-vocabulary + test:equipment-answer + test:exercise-intake +
test:power-pool` gates. Verification status and NOT COVERED:
`docs/STATUS_SELECTIONREPAIR.md`.

**R-297** · One session-section order on Session, Day and Week, 2026-08-31.

Owner: selectionrepair. Every athlete-facing program view presents an ordinary
combined session in this order:

`Movement Prep → Strength → Speed → Conditioning`

The derived Movement Prep flow is mounted first. Stored workout components then
follow the same typed execution-section order on the active Session, Day and
Week views. The component extractor continues to own membership and programming
semantics; its internal arrival order is not athlete-facing presentation policy.

A typed standalone or athlete-added Mobility session retains the `Mobility`
name and mobility-person icon ruled in R-294. This ruling changes no selection,
dose, exposure credit, placement, completion or feedback policy.

Guard: `LAW-one-session-section-order-on-session-day-and-week` through the
chained `test:projection-ownership + test:session-execution-checklist` gates.
Verification status and NOT COVERED: `docs/STATUS_SELECTIONREPAIR.md`.

**R-298** · Conditioning template identity and selected modality must agree, 2026-09-01.

Owner: condpair. Every one of the 55 signed conditioning templates explicitly
declares the typed modalities it supports. Distance-based and running-identity
templates are Run-only. Air Bike identities are Air Bike-only. Erg identities
are machine-only. A generic time-based template may support more than one mode
only when its title, work prescription and instructions remain true on each.

When a required modality cannot use the selected template, selection chooses a
stable compatible template from the same conditioning quality. It never places
a different machine under an incompatible identity. Warm-up copy is projected
from the selected typed modality: running may use jog/run-through language;
Bike, RowErg, SkiErg and mixed-ergo work use a machine build-up. The selected
template/modality pair remains typed through final composition, saving and
restart, and the final workout boundary refuses any incompatible authored pair.

This changes no weekly placement, conditioning frequency, intended quality,
prescription or progression rule.

Guard: `LAW-conditioning-template-and-selected-modality-must-be-compatible`
through chained `test:conditioning-templates` (which invokes the complete
template/modality gate). The persistence and full-year catalogue-order gates
remain release-blocking through `test:programming-selection-release`.
Verification status and NOT COVERED: `docs/STATUS_CONDPAIR.md`.

**R-299** · Canonical pulldown identity and six-row male upper splits, 2026-09-01.

Owner: condpair. `Single-Arm Lat Pulldown` is the only current athlete-facing
and writable identity. `Single-Arm Pulldown` remains only as a legacy
read-ingress alias, so old saved programs and training history reopen and
progress under the canonical identity without data loss. Cues, video,
equipment, injury metadata, progression and authored sheet data resolve to the
one canonical row.

The pulldown identity and variation-family parts of this ruling remain current.
R-334 supersedes its exact split-session row shape for both sexes: useful-session
minimums and typed direction-matched accessories now own that structure.

Same-session near-duplicate prevention is explicit typed data, not name
parsing. The shared composer, athlete Add and athlete Swap routes consume the
same variation-family owner. It currently binds the ruled pulldown family and
the relevant bench-, overhead-press-, row-, bodyweight-pull- and RDL-variation
families. An occupied family cannot be selected again in the same session.

When either upper split is made easier, its important movement planes survive.
Low-value accessory rows are removed before the remaining dose is reduced, so
G-1 and scheduled deload routes do not produce a long list of one-set
exercises.

Guard: `LAW-upper-split-composition-and-pulldown-identity` through the chained
`test:composer-b1 + test:exercise-canonicalisation + test:deload-law` gates. The
focused `test:upper-split-composition` boundary, workbook equality and annual
male/female save/restart and catalogue-reversal sweep remain release-blocking
through `test:programming-selection-release`. Verification status and NOT
COVERED: `docs/STATUS_CONDPAIR.md`.

**R-300** · Conditioning cards show one exact, clock-readable prescription, 2026-09-01.

Owner: conddosecopy. Current conditioning cards use `sets`, `reps` and exact
durations; they do not ask the athlete to interpret authoring ranges or the word
`blocks`. Where a dose builds across a three-week mini-cycle, the compiler owns
the exact rung before final composition. Continuous Aerobic Run therefore
delivers 30, then 35, then 40 minutes; the athlete never sees `30–50 min` and a
saved/reopened week retains its chosen rung.

Run warm-ups prescribe an exact 10-minute running build-up. Machine conditioning
prescribes an exact 5-minute build-up on the selected machine. Run prescriptions
may retain MAS and a personal pace; Bike, Air Bike, RowErg, SkiErg and mixed-ergo
prescriptions use effort out of 10 and never MAS.

The complete reviewed 55-template copy is projected through the shared
conditioning display owner. `Deceleration and Landing Work`, `Erg EMOM`, `Easy
Aerobic Flush` and `Bodyweight Conditioning Circuit` are retired from every
current automatic selection pool but remain readable for historical saved
programs. `200 m Hard Repeats` is seven reps in both dose and cue, and
`2-Minute Flush Intervals` has the corrected work line. This supersedes R-290
only where that earlier athlete copy used ranges or `blocks`; the signed
catalogue remains the owner of physiology, eligibility, modality limits and
safety caps.

Guard: `LAW-conditioning-athlete-copy-is-complete-and-clock-readable` through
the chained `test:conditioning-templates` gate. That gate is also explicitly in
`test:programming-selection-release`, alongside final composition, modality,
save/restart and generated-week checks. Verification status and NOT COVERED:
`docs/STATUS_CONDDOSECOPY.md`.

**R-301** · `SL` remains fully capitalised in every exercise title, 2026-09-01.

Owner: exerciseacronym. Sam ruled: *"SL back extension holds or anything that
is listed as SL - should both be capitilaised - right now it looks like Sl"*.
The shared athlete-facing exercise-name formatter therefore treats `SL` as an
acronym, just like `ATG`, `DB`, `RDL` and `OHP`. Canonical exercise identities,
matching, cues, video links and programming selection remain unchanged.

Guard: `LAW-sl-exercise-display-acronym` through chained
`test:exercise-display`. Verification and NOT COVERED:
`docs/STATUS_EXERCISEACRONYM.md`.

**R-302** · Strength day headlines choose Speed or Conditioning, 2026-09-01.

Owner: daytitlepriority. Sam ruled that `Strength + Speed` is correct when no
conditioning is present, but a day containing all three must read
`Strength + Conditioning`, never `Strength + Speed + Conditioning`. The Speed
section remains visible and unchanged inside the same day; only its priority in
the compact day/week headline changes.

Guard: `LAW-strength-day-headline-priority` through chained
`test:day-first-timeline`. Verification and NOT COVERED:
`docs/STATUS_DAYTITLEPRIORITY.md`.

**R-303** · Normal Off-season app energy-system density is four days, 2026-09-01.

Owner: yearrepair. From normal Off-season week 5 onward, proper authored Speed
counts inside a maximum of four app-programmed energy-system days. A normal
healthy advanced week contains one Speed day, one hard/aerobic-power exposure,
one tempo/capacity exposure and at most one easy-aerobic exposure. One delivered
day receives one credit even when Speed and metabolic conditioning are combined.
The app does not author three app-programmed energy-system days consecutively,
including across Sunday/Monday. Where availability permits, hard, tempo and
Speed remain on distinct days; a packed strength day may remain strength plus
Movement Prep/Mobility while equipment-free conditioning uses a cleaner free
day. Weeks 1–2 retain the lower transition and optional rules. Team Training,
games, Pre-season, In-season, flush, game-proximity and deload rules are not
reclassified by this ruling.

This supersedes the earlier normal-Off-season five-app-exposure reference in
WC-132, not the general three-to-five total-conditioning statement across all
phases and real anchors.

Guard: `LAW-normal-offseason-app-energy-density` through chained
`test:weekly-scheduler + test:session-classification`. The scheduler gate walks
every exact two-through-six-day availability set across normal, scheduled-deload
and representative club-night coordinates. The annual evidence validator is
date-based, so it catches both a fifth day and a consecutive triple spanning a
week boundary. Verification status and NOT COVERED:
`docs/STATUS_YEARREPAIR.md`.

**R-304** · The selected tracked lift is the programmed pattern anchor, 2026-09-01.

Owner: yearrepair. Bench Press, Pull-Up, Back Squat and RDL are the four default
tracked lifts and automatic main-strength anchors for push, pull, squat and
hinge. The athlete's corresponding alternatives are Overhead Press, Lat
Pulldown, Bulgarian Split Squat and Trap Bar Deadlift. Selecting an alternative
fully removes its default from automatic programming; the default does not
return later in the week as an accessory.

The anchor applies whenever its pattern is programmed and the exercise is
legal. Injury, unavailable equipment, athlete removal, G-1, fixture and genuine
recovery constraints still win. The saved Profile choice is an explicit input
to live re-derivation, future generation, Coach preview and cold restart, so
those routes cannot silently author different lift identities.

Annual evidence reports distinct eligible dates, distinct delivered dates and
typed reasons for every withheld opportunity. Repeated observations—not an
arbitrary injury-blind annual quota—are the graph-usefulness contract.

Guard: `LAW-selected-tracked-lift-is-program-anchor` through chained
`test:estimated-1rm + test:compiler-year`. Verification status and NOT COVERED:
`docs/STATUS_YEARREPAIR.md`.

**R-305** · Male Upper Pull owns two major pulls, not three, 2026-09-01.

Owner: yearrepair. A normal male Upper Pull contains exactly one horizontal and
one vertical major pull; a spare seat may not add another row or pulldown. The
athlete's selected tracked lift occupies its real authored plane, so Pull-Up and
Lat Pulldown anchor vertical pull rather than wearing a horizontal seat label.
R-334 supersedes this ruling's interim accessory-seat prescription. The exactly
one horizontal plus one vertical major Pull invariant remains current.

Ordinary Upper Push/Pull accessory ownership is now governed by R-334; Gunshow
remains the explicit mixed arms-and-delts session.
The existing canonical Single-Arm Lat Pulldown identity, typed variation-family
rules, progression, injury and equipment priorities remain unchanged.

Guard: `LAW-male-upper-split-has-two-major-pulls-and-rotating-accessories`
through chained `test:composer-b1 + test:estimated-1rm`. Verification status
and NOT COVERED: `docs/STATUS_YEARREPAIR.md`.

**R-306** · Annual workload reports preserve the intentional female structure, 2026-09-01.

Owner: yearrepair. Annual reporting preserves intentional coaching differences
instead of forcing equality. R-309 refines the programming premise: required
male and female sessions share the football-performance foundation unless an
explicit rule differs, while optional male Gunshow versus female Primer remains
the main intentional Friday difference.

The annual workload instrument partitions final main-session rows into main
strength, power, core, prehab, mobility/recovery and conditioning. Optional
session rows are reported as an orthogonal subtotal rather than hiding their
content. Every headline states main-session rows, Movement Prep rows and their
sum as total athlete-visible rows. Same-day duplication is decided by canonical
row identity, never similar display text.

Guard: `LAW-annual-row-report-preserves-intentional-gender-structure` through
chained `test:programming-hierarchy` (which reaches `test:year-row-summary`
through the programming-selection release boundary).
Verification status and NOT COVERED: `docs/STATUS_YEARREPAIR.md`.

**R-307** · Final session rows own annual display; Speed evidence is not appended, 2026-09-01.

Owner: yearrepair. The canonical athlete-facing `day.rows` projection is the
sole row source for annual audit, HTML and PDF output. `speedRows` remains typed
evidence and must match a final canonical identity and modality, but it is never
concatenated into display output. Duplicate final identities, missing Speed
projection, or an evidence/final modality mismatch are red audit findings. An
Air Bike row therefore cannot reappear as a fabricated Running row.

Annual vocabulary uses two terms. A conditioning category is exactly
Continuous Aerobic, Tempo, Hard Intervals or Flush. A conditioning template is
an actual selected authored identity such as Classic 4×4, Fly 30 or Steady
Blocks. Reports state both sets separately and include Movement Prep in the
total athlete-visible row headline. Proper Speed continues to earn exactly one
weekly energy-system credit through the canonical evidence owner.

The weekly audit also keeps six counting units separate: explicit fixture
athlete-days, generated-conditioning athlete-days, typed Running Speed
athlete-days, team-training credit athlete-days, total semantic energy-system
credits, and the distinct union of app-programmed energy-system athlete-days.
None is inferred from a display-role spelling, and none is relabelled as another
merely because one combined session contributes to both semantic breakdowns.

Guard: `LAW-annual-export-uses-final-rows-once-and-separates-categories-from-templates`
through chained `test:programming-hierarchy + test:canonical-weekly-compiler`.
Verification status and NOT COVERED: `docs/STATUS_YEARREPAIR.md`.

**R-308** · Separate explicit fixtures remain separate fixed facts, 2026-09-01.

Owner: yearrepair. Consecutive football games are valid when the accepted
calendar holds distinct explicit fixture events. A Friday school match plus a
Saturday club match, or Saturday and Sunday round-robin matches, therefore
remain two fixed anchors. Generated conditioning and Speed adapt around those
anchors; a spacing preference never rejects or deletes the fixtures.

A Move releases only its exact source event and retains any other event in the
week. Adding an already-explicit date is a duplicate no-change; adding a
different date is a genuine second fixture. The accepted effect, decision
ledger, cold reconstruction and Undo retain that distinction.

Guard: `LAW-explicit-consecutive-fixtures-are-distinct-fixed-facts` through
chained `test:fixture-mutation-transaction`. Verification status and NOT
COVERED: `docs/STATUS_YEARREPAIR.md`.

**R-309** · Required programming shares the football-robustness foundation, 2026-09-01.

Owner: yearrepair. Required male and female sessions share the same performance
foundation unless an explicit coaching rule says otherwise. R-334 supersedes
this ruling's blanket split-upper ban on biceps, triceps and delt work: ordinary
Upper Push and Upper Pull now use typed direction-matched accessories. The
football-robustness foundation remains available for lower work, team-night
composition and legal support/fallback positions; an exposure already in the
delivered week is not duplicated merely because another seat exists.

Male Gunshow and female Primer remain optional G-1 offers only in a one-game
In-season or Pre-season fixture week, including a Pre-season practice match.
They are not automatic in ordinary Off-season, no-game, multi-game or bye weeks,
and a scheduled or low-readiness deload suppresses them. The Gunshow stays low
soreness and three reps from failure, excludes slow Chin-Up Negatives, reduces
from 2+2+2 to 1+1+1 for a 4-7/10 upper-body injury, and pauses at 8-10/10.
Manual Add remains available subject to the same composition and safety owner.

The canonical selection record must reconstruct the exact same final male and
female sessions after restart; accepted edits and Undo preserve the same final
content rather than re-running a different accessory fill.

Guard: `LAW-required-programming-shares-football-robustness-foundation` through
chained `test:programming-hierarchy + test:mobility-accessory-doors +
test:weekly-scheduler + test:team-night-content +
test:canonical-weekly-compiler`. Verification status, mutation receipts and
NOT COVERED: `docs/STATUS_YEARREPAIR.md`.

**R-310** · A genuine deload reduces the whole visible week, 2026-09-01.

Owner: yearrepair. Scheduled, readiness-triggered and illness-triggered deloads
share one transformation. Strength sets fall, and total programmed conditioning
duration falls roughly 30–50% against the relevant build dose. No more than one
proper hard metabolic exposure remains; fatigue-based 10/10 metabolic work is
removed. A tiny, fully recovered Speed exposure may remain, but its volume must
fall. High-eccentric work is reduced or removed around the reduced week.

The stored prescription and athlete-facing instruction are one result. Reducing
an absent duration field while leaving `Rounds: 8` or `Work: 40 min` on screen
does not satisfy this ruling. Counts/rounds decrease together; a continuous
one-set prescription reduces its visible work minutes. When a hard row is
demoted into a longer easy-aerobic template during a readiness/illness deload,
the shorter easy-remainder dose prevents the template swap from preserving or
increasing the complete week's duration.

A remaining-week fatigue trigger must not leave an automatic six-row Gunshow or
Primer unchanged. It is suppressed or reduced through the same compiled
reduced-week state. Accepted fatigue inputs reconstruct the exact same final
sessions after restart; reversing the exact triggering report through its
Clear/Undo door restores the prior sessions.

Guard: `LAW-genuine-deload-reduces-the-whole-visible-week` through chained
`test:deload-law + test:deload-week + test:offseason-deload-conditioning +
test:temporary-source-facts + test:fatigue-sequence`. Verification status,
mutation receipts and NOT COVERED: `docs/STATUS_YEARREPAIR.md`.

**R-311** · Real running-speed development, 2026-09-01.

Owner: yearrepair. A Speed requirement means running. Bike/Air Bike acceleration
is conditioning and cannot satisfy it. Repeat-sprint work performed on incomplete
recovery is conditioning and cannot be written as pure Speed. The canonical
`speedBlock` writer accepts only run-modality acceleration or top-end-speed
templates; the visible rows it owns carry the same authored identity.

A no-team-training Off-season carries zero automatic Speed in weeks 1-4;
acceleration alternates with longer progressive build-ups in weeks 5-8; then
small Fly 20/Fly 30 exposures use full recovery. The newer behaviour that
required Speed from week 1 is withdrawn; R-062's opening exception remains.

In Pre-season and In-season, team training may satisfy acceleration under the
existing anchor-credit rule. A frequency-only team-training answer never proves
maximum velocity. The app adds a run-only top-speed exposure when a legal day and
the weekly anchor/load budget permit it. Genuine fixture proximity, multi-anchor
congestion, injury or a reduced week may omit or reduce that top-up.

Guard: `LAW-real-running-speed-development` through chained
`test:offseason-deload-conditioning + test:weekly-scheduler`. The former invokes
the 12/12 `test:real-running-speed` final-week gate. Verification status,
mutation receipts and NOT COVERED: `docs/STATUS_YEARREPAIR.md`.

**R-312** · Automatic Nordic prescriptions are typed and realistic, 2026-09-01.

Owner: yearrepair. Hamstring Nordic Curl regression status is typed exercise
data, not wording inferred from the exercise name or coaching notes. A full
unassisted eccentric Nordic uses 2–3 sets of 4–6 repetitions. An assisted or
substantially regressed Nordic uses 2–3 sets of 6–8. The automatic owner chooses
the low end of those set bands and no automatic route may turn a full
unassisted lower into 2×15 or 3×10 hypertrophy work.

Automatic full Nordics are excluded from G-2 through game day, and the low
automatic band prevents a large Nordic dose beside demanding running elsewhere
in the delivered week. `Reverse Nordic Curl` remains a separate quad-dominant
exercise and is never classified as a hamstring Nordic because its name happens
to contain the same word.

The automatic dose owner does not rewrite an athlete-entered prescription.
Manual Add remains available through the existing legality and safety boundary;
its exact accepted sets and reps survive durable save and restart, while Undo
reverses the athlete's decision rather than leaving a re-dosed automatic row.

Guard: `LAW-automatic-nordic-prescriptions-are-typed-and-realistic` through
chained `test:offseason-deload-conditioning`, which invokes the 12/12
`test:nordic-prescriptions` final-week/action boundary. Verification status,
mutation receipts and NOT COVERED: `docs/STATUS_YEARREPAIR.md`.

**R-313** · Automatic loads follow the typed implement lattice, 2026-09-01.

Owner: yearrepair. There is no caller-supplied generic load increment. Every
app-authored load change resolves the exercise's implement and uses the one
equipment lattice: barbell uses normal total-load rungs; dumbbell uses per-hand
rungs; kettlebell uses real fixed-bell sizes; cable and machine use their
authored stack/plate rungs. Weighted bodyweight has a separate 2.5 kg external-
load class, which does not pretend that Pull-Ups require barbell equipment.

An earned increase selects the first real rung above the accepted base. This is
important when the athlete's own base is off-lattice: a 26.5 kg recorded
kettlebell value remains their historical number, but the next automatic fixed-
bell suggestion is 28 kg, never 30.5 kg or base-plus-four. An automatic
reduction rounds conservatively down. A hold preserves the exact base.

The rule scopes automatic authorship, not athlete truth. A manually entered or
logged number is never rounded merely because the app displays, saves or reloads
it; explicit adjustable equipment and athlete-entered loads therefore remain
representable. Initial generation, weekly progression and block-boundary
progression share the typed owner. The visible card renders the stored result,
and durable save/restart must return that exact prescription.

Guard: `LAW-automatic-loads-follow-the-typed-implement-lattice` through chained
`test:load-ratio-rulings`, whose first command is the 9/9
`test:equipment-load-increments` final progression and cold-restart boundary.
Verification status, mutation receipt and NOT COVERED:
`docs/STATUS_YEARREPAIR.md`.

**R-314** · Required Team Training gym work is compact at composition, 2026-09-01.

Owner: yearrepair. Movement Prep remains outside the gym count. The required gym
portion attached to a Team Training day contains no more than one explosive
row, one main upper-body lift, one secondary upper-body lift and one or two
football-robustness or trunk rows. In a healthy build week both upper lifts and
one or two support rows remain; compactness may not be manufactured by deleting
the session. Injury and deload may reduce the work, but may not inflate it.

Ordinary Off-season generation retires team anchors. Athlete-added rows and
clearly optional sessions remain outside this required-session shape and are
not silently removed. The canonical composer declares the compact strength
slots before materialisation; the final stored/visible non-power rows must equal
that declaration rather than being trimmed by a screen, exporter or restart.

Guard: `LAW-required-team-night-gym-is-compact-at-composition` through chained
`test:team-night-size`, whose first command is the 34/34
`test:team-night-compact` final-generation matrix. Verification status,
mutation receipt and NOT COVERED: `docs/STATUS_YEARREPAIR.md`.

**R-315** · Mid-week remainder placement counts delivered energy history, 2026-09-01.

Owner: yearrepair. A remainder rebuild receives the athlete's settled pre-boundary
energy-system athlete-days before it chooses future conditioning or Speed. It
separately carries whether each delivered day was app-programmed work, actual
team/game anchor credit, or Running Speed. Past dates count but are not fresh
receiver seats, and standing club answers cannot overwrite what the pinned day
actually contained.

The scheduler may author only the governable remainder. It does not append a
catch-up exposure when every such placement would create a new run of three
consecutive app-programmed energy-system days. Clear, restart and final
projection preserve the same settled-history-plus-remainder result.

Guard: `LAW-midweek-remainder-counts-delivered-energy-history` through chained
`test:weekly-scheduler`. The exact remainder cell carries four delivered days,
including Thursday/Friday, two standing club-night answers that the travel week
did not actually deliver, and Saturday as the first governable day. Verification,
mutation receipt and NOT COVERED: `docs/STATUS_YEARREPAIR.md`.

**R-316** · Seated Good Morning is one variant-aware exercise, 2026-09-01.

Owner: yearrepair. `Seated Good Morning` is one canonical exercise identity.
Bodyweight, Dumbbell and Barbell are variants of that identity, not separate
exercises. They share one video, cue set, injury profile, selection slot and
exercise history. The selected variant controls its equipment requirement,
athlete-visible load control and experience eligibility.

`Seated Good Morning (Barbell)` exists only as legacy saved-data ingress. An
existing stored row with that name reopens as `Seated Good Morning` with its
barbell variant preserved, but no current writer or automatic selector emits the
legacy identity. Variant choices cannot coexist in one session or compete as
separate catalogue entries.

Guard: `LAW-seated-good-morning-is-one-variant-aware-identity` through chained
`test:exercise-canonicalisation + test:programming-selection-release`.
Verification status, mutation receipt and NOT COVERED:
`docs/STATUS_YEARREPAIR.md`.

**R-317** · Automatic strength programming spends each weekly main seat once,
2026-09-01.

Owner: weeklybudget. A healthy automatically programmed week generally owns six
main seats: bilateral squat, bilateral hinge, horizontal push, vertical push,
horizontal pull and vertical pull. They are weekly allowances. Separate Lower
Squat and Lower Hinge sessions own their matching bilateral seat and do not
borrow the other. Limited one- or two-day weeks may consolidate unspent seats
without creating a giant session. Once a seat is spent, later compatible work
is typed support rather than another main lift.

Tracked Back Squat, RDL, Bench Press, Pull-Ups and athlete-selected alternatives
are preferred for their one matching weekly main seat, not copied into every
compatible occurrence. Block stability remains for the selected main and
supporting seats without freezing the same whole session skeleton across the
year. Athlete-added sessions stay outside this automatic budget and do not
trigger automatic refills or a broad-count equality veto.

This supersedes the every-lower-day squat-plus-hinge assumption, equal or
near-equal broad-pattern counts, and the main-lift part of R-241's repeated-seat
rule. Guard: `LAW-automatic-weekly-main-strength-budget` through chained
`test:full-body-balance`, which invokes `test:weekly-strength-budget` and
`test:weekly-strength-variety`. Full red-first, mutation, annual audit and NOT
COVERED evidence: `docs/STATUS_WEEKLYBUDGET.md`.

**R-318** · Final automatic exercise identities obey one systemic weekly selector,
2026-09-01.

Owner: weeklyselector. Every non-Mobility/non-Prehab exercise identity appears
at most once in one automatically programmed athlete-week. The exercise
catalogue's real classification, never a composer role, owns the six weekly
main families. Squat, hinge and equivalent upper push/pull variations share
their real family, so relabelling an anchor as support cannot bypass a spent
seat.

Dedicated `Lower Squat` owns bilateral squat and single-leg knee work;
dedicated `Lower Hinge` owns bilateral hinge and single-leg hip, hamstring,
glute and lower-back work. Compressed full-body weeks may combine categories
without exceeding the same weekly identity or family limits. Fallback order is
unused legal same-category work, unused suitable same-movement/muscle
accessory, suitable genuine prehab, then empty. Prehab and Mobility may repeat
but never inherit or satisfy a main-strength slot. Upper work uses the same
hierarchy. Athlete additions stay unrestricted and do not refill automatic
work.

This extends R-317 from typed main-seat roles to the final delivered exercise
names and supersedes repeated-strength fallback or dedicated-day expectations
that contradict that boundary. Guard:
`LAW-systemic-automatic-weekly-exercise-selection` through chained
`test:full-body-balance`, which invokes the focused
`test:automatic-weekly-selection`. Red-first, generated-world, durable restart,
mutation, annual audit and NOT COVERED evidence:
`docs/STATUS_WEEKLYSELECTOR.md`.

Amended 2026-09-02 by owner fivebridge: the one weekly selector and its typed
history also govern strength accessories, Gunshow, Primer, power and automatic
optional sessions. A used preferred identity falls through the existing
role-appropriate order; an exhausted shelf leaves the row empty. Typed
automatic authorship survives injury rebuild, fixture repair and restart, while
athlete-added rows remain outside the history. Focused red-first, mutation and
updated persistence evidence: `docs/STATUS_FIVEBRIDGE.md`.

**R-319** · Automatic strength sessions contain at most four compound exercises,
2026-09-02.

Owner: compoundcap. Governed strength and accessory exercises carry one optional
canonical metadata answer: `compound` or `isolation`. Power, plyometric, carry,
core, robustness, prehab, mobility and conditioning work remain unclassified;
`Face Pull` and `Cable Face Pull` remain distinct isolation identities. The
classification completeness guard derives its required scope from the selectable
strength and governed support pools, rather than keeping a second name list.

Correction, 2026-09-02: `Lower Accessories — Isolation` contains SL 45° Back
Extension, Nordic Lower, Hamstring Curl, Leg Extension, Calf Raises, Tib Raises,
Single-Leg Hip Thrust, Back Extension, Copenhagen Plank (Half), Long-Lever
Copenhagen, Groin Squeeze, Single-Leg Calf Raise and Seated Calf Raise. This is
only the Compound/Isolation grouping. Their existing pools and calf, groin and
muscle tags remain unchanged.

An automatic compound may fill only an uncovered genuine strength direction and
each automatically programmed strength session may contain no more than four.
Support then tries a legal direction-matched isolation, genuine prehab,
core/robustness, and finally an empty slot. No fifth or sixth compound is added
as volume. Equipment, injury, weekly identity/family, accepted block selection
and restart rules continue to apply. Athlete-added work remains unrestricted.

Guard: `LAW-automatic-strength-session-compound-limit` through chained
`test:full-body-balance`, which invokes focused
`test:compound-session-selection`. Red-first, classification-removal, deliberate
fifth-compound and representative generated-world receipts plus NOT COVERED:
`docs/STATUS_COMPOUNDCAP.md`.

**R-320** · Canonical session work has one visible owner, 2026-09-02.

Owner: flyowner. One logical prescription belongs to one canonical session
component and appears once in `buildSessionTemplate(...)`. Typed component
membership outranks a fallback inferred from the workout container. The final
`day.rows` projection is the whole athlete-facing export; `speedRows` is typed
evidence only and annual audit, HTML and PDF readers never append it.

The weekly deload decision is made after feasible components are known and
before their rows are transformed. A typed Speed warm-up does not spend the
week's one sharp exposure, and a 10/10 Fly prescription cannot carry “easy
aerobic only.” The visible session title derives from the final canonical
components. Durable save/restart reconstructs the same final content, including
when a saved no-Team-Training span and a separate Going Away fact overlap.

Guard: `LAW-canonical-session-work-has-one-visible-owner` through chained
`test:programming-hierarchy`, whose programming-release child invokes both
`test:session-work-ownership` and `test:deload-quality-owner`. The exact
accumulated Christmas-break journey, three deliberate mutations, final results
and NOT COVERED receipt live in `docs/STATUS_FLYOWNER.md`.

**R-321** · Bench Thoracic Extension joins the existing mobility catalogue,
2026-09-02.

Owner: benchthoracic. Bench Thoracic Extension is a bodyweight Mobility exercise
for everyone. It requires a bench or plyo box, uses a total prescription of
2 × 5 slow repetitions with a 3-second bottom pause and 30 seconds rest, and is
eligible for automatic upper-body Movement Prep, Mobility and Recovery sessions
plus manual Add/Swap. It is available in all phases and at G-1 in a comfortable
range. Its supplied muscles, cues, injury ratings and video are recorded in
`docs/EXERCISE_INTAKE_BENCH_THORACIC_EXTENSION_2026-09-02.md`; app terminology
maps latissimus dorsi to Lats, thoracic spinal extensors to Upper back and
abdominals to Midline. No new equipment answer is introduced.

Guard: `LAW-bench-thoracic-extension-intake` through chained
`test:exercise-intake`. Red-first, mutation, final execution and NOT COVERED
receipt: `docs/STATUS_BENCHTHORACIC.md`.

**R-322** · Sleeper Stretch joins the existing mobility catalogue, 2026-09-02.

Owner: sleeperstretch. Sleeper Stretch is a bodyweight Mobility exercise for
everyone, prescribed as 2 × 30 seconds per side with 15 seconds rest. It is
eligible for automatic upper-body Movement Prep, Mobility and Recovery plus
manual Add/Swap, but is not automatically selected in Primer. It remains
available in all phases and at G-1 as a short, gentle hold; its near-game rating
is Caution. Its supplied muscles, cues, injury ratings, restrictions and video
are recorded in `docs/EXERCISE_INTAKE_SLEEPER_STRETCH_2026-09-02.md`. No new
equipment answer or special selection system is introduced.

Guard: `LAW-sleeper-stretch-intake` through chained `test:exercise-intake`.
Red-first, mutation, final execution and NOT COVERED receipt:
`docs/STATUS_SLEEPERSTRETCH.md`.

**R-323** · Foam Roller Thoracic Extension joins the existing mobility
catalogue, 2026-09-02.

Owner: foamthoracic. Foam Roller Thoracic Extension is a Mobility exercise for
everyone, prescribed as 2 × 5 slow total repetitions with a 5-second overhead
pause and 30 seconds rest. A foam roller is mandatory. One light dumbbell or
one weight plate is the normal loading choice, with no weight as the supplied
beginner regression; the app records total held load and never estimates it.
It is eligible for automatic upper-body Movement Prep, Mobility and Recovery
plus manual Add/Swap, but not automatic Primer selection, in every phase and at
G-1 when light and comfortable.
Its supplied muscles, cues, injury ratings, restrictions and video are recorded
in `docs/EXERCISE_INTAKE_FOAM_ROLLER_THORACIC_EXTENSION_2026-09-02.md`.
Existing terminology maps latissimus dorsi to Lats, thoracic spinal extensors
to Upper back, serratus anterior to Shoulders and abdominals to Midline. The
existing Dumbbells and Barbell and plates answers cover the loading choice, so
no new equipment answer is introduced.

Guard: `LAW-foam-roller-thoracic-extension-intake` through chained
`test:exercise-intake`. Red-first, mutation, final execution and NOT COVERED
receipt: `docs/STATUS_FOAMTHORACIC.md`.

**R-324** · Band-Assisted Pull-Up joins the existing vertical-pull catalogue,
2026-09-02.

Owner: bandassistpullup. Band-Assisted Pull-Up is a source-bound regression from
Pull-Ups. It is automatically selected in place of Pull-Ups and manually
offered only when swapping Pull-Ups for complete beginners of either gender and
female athletes at 1–2 years. It is unavailable to 1–2-year male athletes and
female athletes above that tier. It inherits the replaced Pull-Up row's role,
sets and repetitions; assistance is increased enough to complete those reps.
It requires a resistance band plus either a rack or pull-up bar and uses the
existing band-strength/colour control. Support height is recorded in the
existing session note. It is not offered by Add or from any other Swap source.
Its supplied muscles, cues, injury ratings, restrictions and video are recorded
in `docs/EXERCISE_INTAKE_BAND_ASSISTED_PULL_UP_2026-09-02.md`. No new equipment
answer, loading unit, role or prescription owner is introduced.

Guard: `LAW-band-assisted-pull-up-intake` through chained
`test:exercise-intake`. Red-first, mutation, final execution and NOT COVERED
receipt: `docs/STATUS_BANDASSISTPULLUP.md`.

**R-325** · Incline Push-Up joins the existing horizontal-push catalogue,
2026-09-02.

Owner: inclinehop. Incline Push-Up is a source-bound regression from Push-ups.
It is automatically selected in place of Push-ups and manually offered only
when swapping Push-ups for complete beginners of either gender and female
athletes at 1–2 years. It is unavailable to 1–2-year male athletes and athletes
above that tier. It inherits the replaced Push-ups row's role, sets and
repetitions. It requires either a bench or plyo box, uses bodyweight only, and
records support height in the existing session note rather than kilograms. It
is not offered by Add or from any other Swap source. Its supplied muscles,
cues, injury ratings, restrictions and video are recorded in
`docs/EXERCISE_INTAKE_INCLINE_PUSH_UP_2026-09-02.md`. No new equipment answer,
loading unit, role, screen or prescription owner is introduced.

Guard: `LAW-incline-push-up-intake` through chained `test:exercise-intake`.
Red-first, mutation, final execution and NOT COVERED receipt:
`docs/STATUS_INCLINEHOP.md`.

**R-326** · Single-Leg Hop and Stick joins the existing lower-body Power pool,
2026-09-02.

Owner: inclinehop. Single-Leg Hop and Stick is available automatically in
lower-body Power blocks and manually through Add/Swap only for athletes with
2+ years of training. It is a bodyweight, per-side movement in all phases,
including in-season at low volume, while the existing Power policy excludes it
from G-1. Its single app prescription uses the lower bound of the supplied
range: 2 × 5 repetitions per side with 120 seconds rest and a full reset before
each repetition. Its supplied muscles, cues, injury ratings, restrictions and
video are recorded in
`docs/EXERCISE_INTAKE_SINGLE_LEG_HOP_AND_STICK_2026-09-02.md`. No new equipment
answer, loading unit, exercise role or power-selection path is introduced.

Guard: `LAW-single-leg-hop-and-stick-intake` through chained
`test:exercise-intake`. Red-first, mutation, final execution and NOT COVERED
receipt: `docs/STATUS_INCLINEHOP.md`.

**R-327** · Exercise movement planes are typed metadata and a cautious selector
tie-break, 2026-09-02.

Owner: movementplane. The Exercise Master workbook and canonical typed metadata
carry Sam's exact supplied `primaryPlane` and `secondaryPlanes` answers. Primary
values are sagittal, frontal, transverse, multiplanar or not_applicable;
secondaries are unique, never repeat the primary and are empty for multiplanar
or not_applicable. Unlisted exercises remain unanswered and are recorded in
`docs/MOVEMENT_PLANE_QUESTIONS_2026-09-02.md`; no name, cue, muscle, pool or
description is used to guess them. No plane label is shown to athletes.

Status: `BUILT`.

The existing automatic selector applies planes only after injury, equipment,
experience, season/game proximity, session purpose/family and weekly limits.
An accepted current-block identity still restores first. A legal automatic
substitute prefers the same primary plane where possible; otherwise useful
missing-plane coverage may break an equal-candidate tie before stable
rotation/history. Planes do not chase equal percentages and sagittal work may
remain the majority.

Weekly and annual checks require one meaningful primary-frontal lower-body
strength/prehab/power contribution. They separately require at least one
meaningful gym strength/prehab/power/trunk exercise whose primary plane is
transverse or multiplanar, or whose secondary plane includes transverse. Team
Training never earns this gym credit. Athletic transverse/COD exposure remains
typed separately. Off-season Weeks 1–4 have no athletic-transverse target; after
Week 4, each complete rolling 14-day window requires one qualifying exposure
when the athlete is healthy and running-eligible. Team Training counts, as do
rotational medicine-ball work, COD, cutting, curved running and angled
deceleration; straight-line acceleration does not count, and conditioning names
or descriptions are never inferred. The existing fortnightly late-off-season or
Christmas COD exchange may satisfy the window without adding a day or exposure
credit. Injury, illness, travel, deload, low-readiness, running restriction and
game-proximity safety outrank the target. Generation and annual audit consume
the same typed rule. Trunk rotation/anti-rotation is a softer 7–14 day check
using Band Pallof Press, both Woodchops or Side Plank Row rather than a weekly
quota.

Guard: `LAW-typed-exercise-movement-planes` through chained
`test:full-body-balance`, which invokes `test:movement-planes`. Red-first,
workbook equality, selector ordering, annual audit and NOT COVERED receipt:
`docs/STATUS_MOVEMENTPLANE.md`.

**R-328** · Banded 90/90 External Rotation joins the existing Shoulder health
catalogue, 2026-09-02.

Owner: movementplane. The movement is available to everyone, uses the existing
band equipment answer and band-resistance load control, and records repetitions
per arm. Its transverse-plane metadata, supplied muscles, cues, injury ratings,
restrictions and exact video are recorded in
`docs/EXERCISE_INTAKE_BANDED_90_90_EXTERNAL_ROTATION_2026-09-02.md`.

It inherits Banded External Rotation's 2 × 15–20 repetitions per arm with 20
seconds rest. It is automatic in Shoulder health and upper-body Movement Prep,
manual through Add/Swap, and not automatic in Primer. It adds no equipment
answer, loading unit, exercise role or selector.

Guard: `LAW-banded-90-90-external-rotation-intake` through chained
`test:exercise-intake`, which invokes `test:banded-90-90-external-rotation`.
Red-first, exact workbook equality and NOT COVERED receipt:
`docs/EXERCISE_INTAKE_BANDED_90_90_EXTERNAL_ROTATION_2026-09-02.md`.

**R-329** · Team Training supplies COD; the app adds only a fortnightly small
dose in late off-season and the Christmas shutdown, 2026-09-02.

Owner: movementplane. A week containing Team Training already has its
change-of-direction exposure and receives no app-authored COD. In late
off-season and during an accepted Christmas club shutdown, a no-team, no-game,
healthy build week receives one small dose every second week. The Christmas
counter starts on the first Monday on or after the shutdown begins, so club
nights before a weekend closure do not consume the first dose.

The app exchanges an existing easy/moderate conditioning component for the
authored `Low-Intensity Deceleration Drills` template (2–4 controlled reps,
about 3–5 minutes). It does not add a day, change the weekly conditioning count
or overload the existing conditioning-dose field with an exercise identity.
Early/mid off-season, ordinary clubless pre-season, in-season, deload,
low-readiness and running-restricted weeks receive no automatic dose from this
rule.

Guard: `LAW-fortnightly-cod-outside-team-training` through chained
`test:weekly-scheduler`. Red-first, 14-coordinate behavior tape and NOT COVERED
receipt: `docs/STATUS_MOVEMENTPLANE.md`.

**R-330** · Automatic Speed uses the earliest genuinely fresh legal day,
2026-09-02.

Owner: speedfresh. This changes only the placement of an already-required
automatic Speed exposure. G+1, G-2, G-1 and game day remain prohibited. G+2 is
legal only when a later fresh legal day is unavailable. A day immediately after
heavy lower strength, hard conditioning or Team Training loses to a fresh
alternative. Among the remaining days, upper-body strength wins, then a legal
standalone day, then the safest existing legal fallback; Monday-first week order
breaks the final tie. Candidate input order never affects the result.

Speed remains first inside a combined session and consumes one existing weekly
conditioning exposure. Hard conditioning may move to a later legal receiver
instead of forcing same-day consolidation. The weekly session and conditioning
counts do not increase. A delivered Team Training or game Speed quality still
prevents a duplicate exposure. All existing requirement, missing-quality,
game-proximity, injury, illness, fatigue, deload, readiness, prescription,
save/restart, Undo and athlete-added-session rules remain with their current
owners.

Guard: `LAW-fresh-automatic-speed-placement` through chained
`test:weekly-scheduler`. Focused behavior, real persistence/Undo tape, mutation
and NOT COVERED receipt: `docs/STATUS_SPEEDFRESH.md`.

**R-331** · COD is one combined session and may sit on a lower-body day,
2026-09-02.

Owner: codcombine. The COD catalogue has one selectable Run-only session named
`Change of Direction`. It uses the normal Speed warm-up, then shows exactly
three sections in this order:

1. Low-Intensity Deceleration Drills — 20 m build-up + 3 m controlled stop;
   start every 30 seconds; 10 reps; effort 4/10.
2. 45-Degree Cut Reps — 10 m approach + cut + 10 m exit; start every 60
   seconds; 5 reps per side; effort 10/10.
3. Up-Back Shuttle — 30 m out + 30 m back; start every 60 seconds; 10 reps
   (trimmed from 15 by Sam on 2026-09-02: *"the COD is slightly too large"*);
   effort 7/10.

The supplied cues remain attached to their matching section. `Deceleration and
Landing Work` is removed. The other three names are sections, not separate
selectable sessions. This combined COD session may replace conditioning on a
Lower Squat, Lower Hinge, upper-body or standalone day. It is therefore an
explicit exception to the normal lower-day off-feet preference. It remains one
conditioning exposure/day, retains R-329's cadence and safety rules, and can
never be rendered as a machine session.

Guard: `LAW-one-combined-cod-session` through chained `test:weekly-scheduler`,
with workbook equality through `test:conditioning-templates`. Red-first,
mutation and NOT COVERED receipt: `docs/STATUS_CODCOMBINE.md`.

**R-332** · T-Bar Tib Raises is the equipment progression of Tib Raises,
2026-09-02.

Owner: tibbar. T-Bar Tib Raises uses the existing lower-prehab and lower-body
Movement Prep routes with the same 2 × 15–20 total repetitions and 30 seconds
rest as Tib Raises. It is available to everyone in all phases, uses the new
athlete-answerable `Tib bar` equipment capability, records athlete-chosen total
external kilograms through the existing 2.5 kg control, and carries Sam's
supplied cues, ratings, restrictions, sagittal plane and video.

When the tib bar is available, automatic selection prefers the T-bar movement
over its bodyweight base. Without one, Tib Raises remains available. The Swap
ladder offers the direct progression from Tib Raises, manual Add/Swap remains
available, and the two identities share one variation family. A familiar light
dose remains legal at G-1; Primer does not select it automatically.

Guard: `LAW-t-bar-tib-raises-intake` through chained `test:exercise-intake`,
which invokes `test:t-bar-tib-raises`. Red-first, workbook, mutation, final
execution and NOT COVERED receipt: `docs/STATUS_TIBBAR.md`.

**R-333** · A typed conditioning block keeps the canonical conditioning card,
including inside a Recovery session, 2026-09-02.

Owner: fivebridge. Conditioning-block ownership, rather than the surrounding
workout label, selects the athlete-facing presentation. Standalone flushes keep
their template identity, selected modality, work, recovery, exact amount,
effort and cue through final composition, save and restart. Ordinary Recovery
exercises keep the existing low-load exercise card. No template-name exception
is permitted.

Guard: `LAW-standalone-flush-conditioning-presentation` through chained
`test:standalone-conditioning-ownership`, which invokes
`test:standalone-flush-presentation`. Red-first, real restart, mutation and NOT
COVERED receipt: `docs/STATUS_FIVEBRIDGE.md`.

**R-334** · Healthy ordinary strength sessions stay useful and split-upper
accessories belong to their direction, 2026-09-02.

Owner: fourconfirmed. An ordinary healthy, non-deload Lower Squat, Lower Hinge,
Upper Push or Upper Pull contains at least four real strength/accessory rows.
Relevant lower-body prehab or robustness may count; Movement Prep, Mobility,
Conditioning, Speed and Midline do not. Midline may be added separately but
cannot disguise a two-exercise strength session. A genuinely shorter final
session carries its typed cause: scheduled deload, injury/illness, low readiness,
game proximity, restricted equipment/availability, athlete exclusions,
catalogue exhaustion or an explicitly short session.

The existing weekly identity and main-family budgets, dedicated lower-day
purposes, four-compound ceiling, safety and athlete-added freedoms remain.
Fallback is unused legal same-purpose work, same/supporting-muscle accessory,
prehab/robustness, optional Midline, then an honest empty position only after
the legal unused catalogue is exhausted. No repeat or unrelated filler may be
used to reach the floor.

Upper Push automatically owns chest, pressing/lateral-delt and triceps support;
Upper Pull automatically owns back/lat, rear-delt/face-pull/shrug and biceps
support. Mixed/full-upper and Gunshow may use both directions. Athlete additions
remain unrestricted. This supersedes R-299's exact split row shape, R-305's
interim accessory shape and R-309's blanket ban on direct arm/delt work in
required split-upper sessions. One typed accessory-affinity field in the
Exercise Master and canonical exercise catalogue owns the distinction; no
exercise-name matching is permitted.

· `SUPERSEDED IN PART BY R-342` (2026-09-02) — a prehab drill no longer counts
toward the four; loaded robustness still does.

Guard: `LAW-minimum-useful-strength-and-directional-upper-accessories` through
chained `test:full-body-balance`, which invokes
`test:minimum-useful-strength-session`. The guard drives final male/female
generation across every phase and representative 2–6-day availability, checks
the workbook in both directions, exact identity/main-family uniqueness, the
compound ceiling and persistence. Red-first, mutation, annual evidence and NOT
COVERED receipt: `docs/STATUS_FOURCONFIRMED.md`.

**R-335** · The final-year audit checks the accepted journey rather than stale
calendar shortcuts, 2026-09-02.

Owner: fivebridge. This changes the audit harness only. Pre-season Team
Training is Monday and Wednesday; In-season Team Training is Tuesday and
Thursday. The accepted Christmas club shutdown runs 19 December 2026 through
11 January 2027. The illustrative Going Away span runs 28 December through 1
January, with normal equipment restored on 2 January. Team anchors are checked
date by date after those accepted absences, rather than against fixed annual
weekday totals.

Every final fixture placement must equal the accepted fixture facts exported
for that week. Two or more distinct accepted fixtures in one week are legal;
the audit no longer imposes a one-fixture ceiling, and an automatic gendered
optional session may be valid relative to any accepted fixture in that week.
The production scheduler is unchanged.

Guard: `LAW-final-year-audit-accepted-journey` through chained
`test:programming-year-audit-rules`. Focused synthetic journey cases, mutation
and NOT COVERED receipt: `docs/STATUS_FIVEBRIDGE.md`.

**R-336** · Lower Hinge automatic support is hinge-purpose only, and the
final-year audit credits the combined COD session by typed identity,
2026-09-02.

Owner: hingecod. Sam's instruction, paraphrased from the confirmed annual
audit findings: *"Lower Hinge sessions may automatically use the main hinge,
single-leg hip-dominant work, hamstring exercises, glute exercises,
back-extension/posterior-chain work, relevant lower-body posterior-chain
prehab, and suitable calf or general football-robustness work only after
relevant posterior-chain choices are exhausted. Lower Hinge sessions must not
automatically use squats, lunges, step-ups or step-downs, Bulgarian split
squats, leg extensions, reverse Nordics, Spanish squat work, or other clearly
knee-dominant/squat-family exercises."*

The refusal is judged by typed metadata only: an exercise whose real movement
slot is bilateral squat or single-leg knee, or whose signed primary muscle is
Quads or Knee (a hinge-family lift is never knee-dominant), may not enter a
dedicated Lower Hinge whether the strength or the prehab route offered it.
Posterior-chain support is a hinge-family lift or an exercise whose signed
primary muscle is Hamstrings, Glutes or Low back; the hinge day's robustness
bench draws from that set first and from calf or general robustness only when
no legal unused posterior option remains. If the preferred filler is illegal,
the next legal unused posterior-chain option is taken; a typed gap is left
only when no suitable legal option exists. Exercise names never decide.

Preserved unchanged: the R-334 useful-session minimum, one automatic
appearance per exercise per week, the four-compound ceiling, equipment, injury
and game-safety legality, athlete-added work, and Lower Squat's separate
ownership (R-317, R-318).

The annual analyzer credits athletic transverse exposure from typed identity:
the club-training role, the authored conditioning quality reached through a
template name or through the typed section rows the combined Change of
Direction session renders (R-331), and the power pool's declared exposure. No
COD programming, cadence, placement or prescription changed.

Guard: `LAW-lower-hinge-purpose-relevant-support` through chained
`test:full-body-balance`, which invokes `test:automatic-weekly-selection`;
`LAW-final-year-audit-credits-typed-athletic-exposure` through chained
`test:programming-hierarchy`, which invokes `test:programming-audit-projection`.
Red-first, mutation, focused 34-week results and NOT COVERED receipt:
`docs/STATUS_HINGECOD.md`.

**R-337** · The week is budgeted in stimuli, not days, 2026-09-02.

Owner: hingecod. Sam, asked why off-season weeks 5–7 used five training days
and stacked Speed onto tempo when the schedule had room: *"is the problem
thinking in days vs thinking in stimulus?"* — then, on the answer, *"count
stimulus"*. His shape for that week: *"Mon tues rest thursday rest saturday
rest"*, bike sprints after Monday's lower session, no Sunday session.

The phase's energy-system target is a list of stimuli — from normal Off-season
week 5, and in Pre-season without a fixture: Speed, one hard, one tempo, at
most one easy — and days are only where they are put. A planned automatic
Speed day is one of those stimuli, so the metabolic budget is what remains
after it. Density is a separate rule: when the week has enough legal receivers,
Speed owns its day and carries no metabolic block; Speed shares a day with
tempo or intervals only when the legal receivers are short. A stimulus goes
onto a day the athlete already trains before it opens a new day; even spacing
is judged only among arrangements that add the same number of days. Off-feet
metabolic work may sit after a lower session as before.

Unchanged by ruling: R-303's four-app-day maximum and no three consecutive
energy-system days, WC-143's no-club game week (fast session early, Speed on
an upper day, moderate at G-2) and P15's in-season caps where Speed rides an
upper receiver, the club-night Speed top-up, game-proximity, injury, illness,
readiness, deload and equipment rules, and every strength rule. A strength
session whose only energy-system component is Speed keeps its session name on
the week row; Speed is a part, not the day.

Measured on the checkpoint's own 34-week journeys (both sexes): off-season
weeks 5–7 each used five training days with a Sunday bike sprint and Speed
stacked onto Saturday's tempo. After: four training days (Mon lower + easy
off-feet, Tue upper + hard, Thu hinge + tempo off-feet, Sat upper + Speed
only), Sunday empty, zero stacked days; strength, hinge purpose, restart and
analyzer results unchanged.

Guard: `LAW-week-budgeted-in-stimuli` through chained `test:weekly-scheduler`
(the six-day cell, the Speed-owns-its-day cell and the exact availability
matrix cell). Red-first, mutation and NOT COVERED receipt:
`docs/STATUS_HINGECOD.md`.

**R-338** · Flys and accelerations are conditioning that also count as the
speed stimulus, and Speed stays with the lifting day, 2026-09-02.

Owner: hingecod. Sam, verbatim: *"the fly counts as conditioning - i've said
this before = flys and accelerations are conditioning but they count towards
the speed stimuli as well. conditioning is just energy system work, so that
friday 5 min intervals should not even be there = should just be hinge +
flys"*, and on placement: *"keep it on the friday - that's okay - i'd rather
them do it after lower body work than the next day i think - at least they're
warm up and not sore"*.

Under R-337's stimulus budget, a club athlete's missing-quality Speed in a
phase that counts Speed inside its target (Pre-season without a fixture;
normal Off-season build) is planned and budgeted like any other stimulus: two
team nights plus the hard session plus the fly are the four exposures, and no
extra aerobic session is owed. In-season keeps R-268/P15 (Speed rides an upper
receiver inside the game-week caps). This refines R-079's pre-season quality
rule (top-end speed is still owed with two club nights) and the Bible §8 line
*"1 hard conditioning session outside of TT ... and then 1-2 lighter
sessions"*: the lighter session is not owed when the fly is the fourth.

Placement: freshness first (R-330 — the day after heavy lower, hard
conditioning or a club night loses to a fresh alternative); then an upper
strength day, then an existing lower strength day, then a new standalone day.
Speed may share a lower lifting day and follows the lifting. This supersedes
R-330's "free standalone day before the remaining fallback" order.

Measured: the pre-season club week (club Mon/Wed) was Fri hinge + Fly + 5-minute
aerobic intervals and Sat upper + hard; it is now Fri hinge + Fly only and Sat
upper + hard. Off-season builds are unchanged by this row.

Guard: `LAW-flys-count-as-conditioning-and-speed` through chained
`test:weekly-scheduler` (the two-club-night pre-season cells and the fresh
existing-day placement cell). Receipt: `docs/STATUS_HINGECOD.md`.

**R-338 addendum, 2026-09-03 (hingecod) — the NO-CLUB game week's Speed rides
its early fast session.** The in-season contract counts Speed as conditioning
(this row) inside the game-week caps (P15: three app exposures including the
flush offer). R-330's freshness placement gave the no-club game week a Speed
day of its own, so hard + Speed + moderate + flush made four and the generated
week was REFUSED at Section 18 — the in-season six-day and three-day no-club
athletes got a blank program from install (`test:canonical-weekly-compiler`
"In-season / 6 gym days generation accepts its own weekly counts"). Sam's Q2
shape (WC-143) is one session: *"a short sprint workout into ... flying runs
or glycolytic sessions"*. Now the no-club game week's Speed rides the fast
(glycolytic) session — one exposure, the weekly count does not increase, which
is R-330's own word. Club athletes, bye weeks and every other phase are
untouched. · `WORKING` — `test:weekly-scheduler` "[WC-143/R-338] the NO-CLUB
game week's Speed rides its early fast session" (red-first: 1 red on the
committed scheduler), and the two in-season no-club install cells of
`test:canonical-weekly-compiler`.

**R-345 addendum, 2026-09-03 (hingecod) — a recorded conditioning seat
restores only into its own week.** The materialiser counts conditioning
seats per WEEK, but the block record (`BlockConditioningSelection`) carried
no week, so a rebuild matched `(block, category, seat 0)` to the FIRST week's
entry: the Off-season three-day athlete's week-4 Saturday tempo was "30:30
Controlled Tempo Blocks" at install and "2 min On / 1 min Easy" after relaunch
("Off-season / 3 gym days preserves its compiled week and dose exactly across
restart"). The record now carries `weekStartISO`, generation records every
week's seats (it kept only the first per seat), and a seat restores only into
the week it was recorded for; a record without a week restores only into a
context without one. · `WORKING` — `test:conditioning-templates` (four
seat-week cells) and the restart cell above.

**R-339** · "Running" means running: attached conditioning runs on upper days
outside In-season, stays off-feet on lower days and in-season, 2026-09-02.

Owner: hingecod. Sam, on the audit finding that twelve pre-season hard
interval sessions sat on a bike on upper-body days: *"its okay if there's none
in season because two team trainings and a game is enough, any extra
conditioning should be off leg, but there should be at least 1-2 extra runs in
pre season, and probably half or more in off season"*, and on the fix: *"Make
hard conditioning run by default when it isn't on a lower day ... yeah i mostly
agree with this"*.

The planner already said "running" for conditioning attached to an upper day
and "off-leg" for a lower day (WC-115, Bible :147). The session builder read
"running" as "running allowed" and its standing combined-day policy sent every
combined non-sprint session to a machine, so a default picker then rolled a
bike, mixed ergs, rower or ski. That policy was never recorded as a ruling and
contradicts the Bible.

Now: a lower or full-body lift's attached work is off-feet; in-season every
app-added metabolic exposure is off-feet; a flush is off-feet; the COD session
is never a machine; otherwise an upper day in Off-season or Pre-season RUNS its
attached hard, tempo or aerobic work, with a run-capable template selected for
it. A standalone easy-aerobic day runs outside In-season. The athlete's own
off-feet answer, injury restrictions and the running-load streak guard still
outrank this. Measured on the regenerated 34-week journeys: off-season app
conditioning 13 of 19 sessions on legs (was 6), pre-season 20 of 34 (was 4),
in-season 0 of 8 (unchanged).

Guard: `LAW-running-means-running` through chained
`test:conditioning-modality-by-day` (typed policy cells; generated Off-season,
Pre-season with and without club nights, and In-season weeks). Red-first,
mutation and NOT COVERED: `docs/STATUS_HINGECOD.md`.

**R-340** · Repeat-sprint ability is a hard conditioning demand, requested from
late Pre-season and in in-season bye weeks, 2026-09-02.

Owner: hingecod. Sam: *"why are there no repeat srpint sessions? i have them
planned as templates in the app - figure out why this is happening"*. Cause:
the five authored repeat-sprint templates sat behind the `sprint` category,
and every Speed request named only acceleration or top-end speed (R-311 rules
that repeat-sprint work on incomplete recovery is conditioning, never Speed),
while the hard-conditioning slot only ever asked for aerobic power or
anaerobic work. No planner could ask for them.

Now `repeat_sprint` is its own conditioning demand category (the same waist
`cod_decel` uses), counted as hard conditioning everywhere the hard categories
are read (Section 18 stress, deload reduction, game-proximity safety, block
boundary, taxonomy, visible identity). The Pre-season overlay rotates aerobic
power with repeat-sprint by mini-cycle from phase week 4 (the late
subphase); the In-season bye-week hard exposure is a small repeat-sprint dose
(Bible :1436 names only *"a small Anaerobic or Repeat Sprint dose"*
in-season). The Speed pool no longer offers repeat-sprint templates (R-311).
R-339 renders the in-season dose off-feet (Assault-bike / bike repeat
sprints, Bible :680) and the pre-season dose as a run on an upper day.

Measured on a regenerated 52-week male year: nine repeat-sprint sessions —
late pre-season weeks 16–18 and 24–26 on upper days as runs, bye weeks 31, 37
and 43 on the bike; 52/52 restarts.

Guard: `LAW-repeat-sprint-is-a-hard-conditioning-demand` through chained
`test:weekly-scheduler` (late/early Pre-season rotation, bye-week dose,
game-week refusal, Speed pool exclusion) and `test:conditioning-templates`
(category/quality truth). Receipt: `docs/STATUS_HINGECOD.md`.

**R-341** · Speed variety: the Pre-season shelves rotate and a club athlete's
first Pre-season block asks for an authored acceleration too, 2026-09-02.

Owner: hingecod. Sam: *"figure out why this ... speed variety is narrow ...
there should be more variety that the athlete can be given"*. Cause: with
club nights the app asked only for top-end speed (R-079: footy supplies
accelerations), and the template preference simply alternated Fly 20 and Fly
30 by week; accelerations appeared only in the no-club Off-season weeks. The
year delivered Fly 20 eleven times and one hill or 30 m acceleration never.

Now the Pre-season top-end shelf rotates Fly 20 -> Fly 30 -> Progressive
Sprint Exposure week by week; the acceleration shelf rotates 20 m -> Hill ->
30 m; and a club athlete's FIRST Pre-season block (phase weeks 1–4) asks for
top-end and acceleration together, taking an authored acceleration on the
even weeks. From the second block the ask is top-end only. R-311's Off-season
progression and the small in-season Fly 20 / Fly 30 alternation are
unchanged; every preferred name is a real run-only Speed template. Measured
on a regenerated 52-week male year: five speed templates in rotation (Fly 20
×6, Fly 30 ×5, Progressive ×3, 20 m ×3, Hill ×2) where the audited year had
Fly 20 ×11 and three accelerations.

Guard: `LAW-speed-shelves-rotate` through chained
`test:speed-template-variety`. Receipt: `docs/STATUS_HINGECOD.md`.

**R-342** · Split lower days carry a loaded third row, use the ordinary set
budget, and a prehab drill is not one of the useful four, 2026-09-02.

Owner: hingecod. Sam, on the generated year: *"I think the main issue is there
just isn't much meat on the bones of the sessions ... figure out why they are
so small"*, and *"go"* on the plan to put meat on the lower days. Measured
cause, on the audited 52-week male year: the split Lower Squat / Lower Hinge
ladder was one main lift, one single-leg row and THREE robustness seats, so a
day was 3.4–4.0 rows and 7.8–11 sets, most of it 2 × 10 drills; the in-season
four-day layout further capped those days at 10 sets (WC-031); and R-334's
useful-four counted Crab Walks and Bosch Hold as strength, so the receipts said
"met".

Now: (1) both split lower ladders are main lift, single-leg row, a LOADED
lower accessory seat (`loaded_lower_accessory`, filled only by the authored
`isolation_lower` strength pool — Leg Extension, Hamstring Curl, Nordic Lower,
Back Extension, Single-Leg Hip Thrust, Calf Raises — dosed 3 × 8–12, never a
prehab drill, both sexes) and two robustness seats; R-336 ownership still
picks knee-dominant on the squat day and posterior chain on the hinge day.
(2) WC-031's 10-set exception is killed: the in-season four-day split uses the
ordinary 12–15 (ceiling 16) budget, and the loaded seat counts toward that
budget like a push or pull accessory. (3) A prehab-route row (pool authorship
in `lower_prehab` / `hamstring_light` / `shoulder_health`) does not count
toward R-334's four; loaded robustness (Nordic Lower, Copenhagen Plank, Calf
Raises, Groin Squeeze) still does. (4) While an ordinary split day has fewer
than four loaded rows, a robustness seat opens its loaded bench first; drills
enter once the minimum is met or when no loaded row is legal. R-334's
"relevant lower-body prehab or robustness may count" is superseded in that
one respect; the rest of R-334, R-317/R-318 (one bilateral seat per week, no
second anchor), R-336 and the four-compound ceiling are unchanged.

Measured on regenerated 52-week years (male and female): split lower days are
4.4–5.0 rows and 10.6–14.0 sets (Off-season squat 14.0, hinge 11.8–12.4;
In-season 11.7–12.4), every ordinary day "met", zero unexplained shortfalls;
the only reduced days carry typed causes (deload, illness, injury, kit).

Guard: `LAW-split-lower-days-carry-loaded-work` through chained
`test:minimum-useful-strength-session` (three new cells), with the ladder
pinned in `test:slot-coverage` and the budget in `test:weekly-scheduler`.
Receipt: `docs/STATUS_HINGECOD.md`.

**R-343** · A loadable bodyweight lift completed at the top of its rep range
earns its first suggested added load, and the audit robot logs bodyweight
lifts, 2026-09-02.

Owner: hingecod. Sam, on the generated year's Pull-Ups reading BW for all 52
weeks: the athlete *"would add weight"*, and asked why the audit did not. Two
causes: the block boundary treated an authored-unloaded row as
`bodyweight_default` and wrote nothing until the athlete had recorded a load
(R-096 clause 3 as built), and the audit robot never logged a set for a
zero-load row, so no evidence of reps existed.

Now: at a block boundary, a lift the athlete can add load to (`bodyweight_plus`
— Pull-Ups, Chin-Ups, Dips, Push-ups, Inverted Row; never a Nordic) that has
no recorded load, sits in a block that QUALIFIES on completion and recovery
exactly as a loaded rise does, and was completed at the top of its prescribed
range in that block — proven by real logged sets (`actualReps >=
prescribedRepsMax`; a session merely marked complete claims nothing about
reps) — is suggested the lattice's smallest added load (BW + 2.5 kg). The row
is stored as `bodyweight_progressed`, renders "BW + 2.5kg", carries its own
athlete-facing sentence, and from then on R-096 clause 1 governs it like any
loaded lift (2.5 → 5 → 7.5 …). Rotation reads the same "earned a rise"
predicate. A very-hard block, a rep short of the top, or no per-set detail
leaves it at BW. The journey/audit robot now logs bodyweight rows at
bodyweight with their reps (no weight invented). An automatic in-block step
that the weighted-bodyweight lattice can only express as zero holds the load
instead (R-096: hold load, reduce volume first).

Measured on a regenerated 52-week male year: Pull-Ups BW for weeks 1–4, then
+2.5 kg from week 5, +5 at 12, +7.5 at 16, +10 at 20, +12.5 at 24, +15 at 32,
+20 at 39, +27.5 by week 52; 52/52 restarts. FINDING, pre-existing and not
fixed here: on the week before each in-season bye and the bye week itself
(weeks 30–31, 36–37, 42–43, 48) every lift's load is the ONBOARDING ESTIMATE
(Back Squat 95, Bench 80, RDL 77.5 against the athlete's 100/85/82.5), so the
Pull-Up reads BW there; the audited year shows the same numbers. Owner to be
assigned.

Guard: `LAW-bodyweight-lift-earns-added-load` through chained
`test:block-two-progression` (five new cells). Receipt:
`docs/STATUS_HINGECOD.md`.

**R-344** · A rebuilt week carries the athlete's own accepted loads,
2026-09-02.

Owner: hingecod. Sam: *"approved"* on the root-cause report for the bye-week
weights. Cause: `buildFixtureProjection` generates a one-week stub with
`generateProgramLocally({ microcycleLimit: 1, previousProgram })` and no
`blockNumber` or `progressionHistory`, so generation defaults to block 1 and
empty history, the block boundary never runs, and every row keeps the
compiler's onboarding estimate; the replan's released-day planner offer is
built the same way. The stub reaches the athlete on every bye week
(`full_regeneration`) and on every week after a moved Sunday game (the
rolling horizon's +1 protection week). Measured on the audited year: Back
Squat 95 / Bench 80 / RDL 77.5 against the athlete's 100 / 85 / 82.5 on weeks
30–31, 36–37, 42–43 and 48, a weighted Pull-Up reading "BW", and the next
boundary progressing from the lower logged number.

Ruling, R-096 clause 1 applied at the rebuild: the same lift's own accepted
load (name + role) is carried into the rebuilt week — same-day row first (by
id, else the day's only such row), else the week's one load when the lift
moved days; a lift the accepted week never carried keeps the compiler's own
load (clause 5); an ambiguous match is left alone; an accepted blank carries
as blank. ONE owner, `rules/acceptedLoadCarry.ts`, read by the fixture
projection's single output (minimal repair, full regeneration and the planner
offer alike) and by the readiness reduction that already carried loads under
R-034. Passing history and a block number into the stub was rejected: its
`blockStartISO` is its own week, so the previous-block window would be wrong
and could re-progress mid-block.

Measured after: regenerated 52-week male year, weeks 30 / 36 / 48 carry
100 / 105 / 112.5 and the bye weeks 31 / 37 / 43 carry the new block's
102.5 / 105 / 110; Pull-Ups climb without a drop; Back Squat ends the year
at 115 (was 102.5); female year the same shape; 52/52 restarts each.

Guard: `LAW-rebuilt-week-carries-own-loads` through chained
`test:accepted-load-carry` (seven cells) and the R-344 journey cell in
chained `test:fixture-mutation-transaction` (bye week, week after a Sunday
game, relaunch). Receipt: `docs/STATUS_HINGECOD.md`.

· R-343 note (Sam, 2026-09-02): the added-load SENTENCE is deleted. It had no
reader on the phone (no screen renders the block-boundary sentences; only the
coach context receives them), and the card's "BW + 2.5 kg" is the athlete's
fact. The `bodyweight_progressed` decision, its load and its stored row stand.

**R-345** · A rebuilt week keeps its accepted sets and reps and cannot repeat
what the accepted week keeps on other days, 2026-09-02.

Owner: hingecod. Sam's item 1 ("yes"). Two gaps in the one-week rebuild
(bye, moved game, readiness, injury): the stub is generated without the
block's progression, so every boundary rung beyond the load — the earned
set, the very-hard-block reduction, the in-block wave — was missing; and the
stub's composer started with an empty weekly ledger, so a day it replaced
could repeat an identity the accepted week kept on another day (week 41:
Seated Calf Raise on the rebuilt Monday and the stored Wednesday, both
athletes). Now: (1) the fixture door's carry is `loads_and_dose` — the same
lift's accepted sets, reps and load travel into the rebuilt week; the
readiness door keeps `loads` only (R-034's reduced dose is the compiler's).
(2) A rebuild states the accepted week's automatic strength identities by
weekday (`acceptedWeekIdentitiesByDay`), and composing day D treats every
identity on the accepted week's OTHER days as taken — in the composer's
candidate list, its prehab and trunk fallback benches, and the later
automatic families (Gunshow, power). Main lifts are NOT listed: they follow
the block's recorded seat and may move weekday when the week reshapes
(measured: listing them replaced the athlete's Back Squat with a High Box
Squat at the estimate on every week after a Sunday game). Power rows and
prehab drills are outside the once-per-week rule and are not listed.
Passing block number and history into the stub was rejected again (wrong
previous-block window).

Measured after, both 52-week athletes: 0 weekly repeats (was 2), focused
composition 24/24, strength-budget PASS/PASS/PASS; weeks 30/31/36/37/43/48
carry Back Squat at the accepted 100/102.5/105/105/110/112.5; 52/52 restarts.

Guard: `LAW-rebuilt-week-keeps-dose-and-ledger` through chained
`test:rebuilt-week-ledger` (two cells, 9 worlds, with a shifted-seed
liveness control) and `test:accepted-load-carry` (dose-carry and identity
listing cells), and the item-1 journey cell in chained
`test:fixture-mutation-transaction` (sets, reps and no cross-day repeat
through a bye, a Sunday move and a relaunch). Receipt: `docs/STATUS_HINGECOD.md`.

**R-346** · Side Plank, Cossack Squat and Lateral Lunge are loadable
bodyweight lifts, 2026-09-02.

Owner: hingecod. Sam: side planks *"should be able to add weight to the top
of your hip"*; Cossack squats and lateral lunges *"should be able to be
loaded"*; BW then BW + 2.5 kg is fine. The three join
`BODYWEIGHT_LOADABLE_EXERCISES` (card reads "BW", then "BW + 2.5 kg"; the
plus button and the automatic lattice already step 2.5 kg for that mode);
Side Plank leaves the no-load-control list. A loadable lift that is
progression-eligible may earn the lattice's next rung on a qualifying block
(R-096 clause 1) — the block-two guard now accepts "held, or raised by its
own rung" for a bodyweight accessory. Guard: `test:render-truth` (the
agreed-loadable list) — `LAW-loadable-bodyweight-lifts`. Receipt:
`docs/STATUS_HINGECOD.md`.

**R-347** · The Lower Squat day's loaded third seat is knee-side first,
frontal favoured, posterior last, 2026-09-02.

Owner: hingecod. Sam: *"could it not do a different type of knee exercise? …
what about cossack squats and lateral lunges … they're a different plane,
they could be favoured"*. Cause: the seat shopped only the seven-entry
`isolation_lower` pool (leg extension, calf raise, back extension on a squat
day), the selector admitted a compound only through a compound-direction
seat, and the block selector's movement-plane cohort narrowed the seat on the
week's TRANSVERSE hole (one lift, Single-Leg Squat (to Box), on 40 of 45
squat days once compounds were admitted). Now: a loaded single-leg knee lift
(unilateral squat or lunge pattern, strength route) also fills
`loaded_lower_accessory`; the seat is a compound direction of its own (one
compound per seat, the four-compound session ceiling unchanged); on a Lower
Squat day the seat's bench is everything that is not posterior-chain, the
frontal pair is favoured only while the week still lacks a frontal-plane
lift, and only the frontal hole may narrow this seat; a posterior isolation
is taken only when nothing knee-side is legal. The hinge day keeps R-336
(knee-dominant refused, posterior first). Measured on both 52-week athletes:
ten different lifts on the seat across 45 squat days (Reverse Lunges 8, Leg
Extension 8, Cossack 5, Single-Leg Box Squat 5, Bulgarian 4, Single-Leg Leg
Press 4, Step Ups 3, Lateral Lunge 3, Walking Lunges 2, Calf Raises 1 — male),
0 posterior. Guard: `LAW-squat-day-loaded-seat-is-knee-side` through chained
`test:automatic-weekly-selection` (50-world cell) and `test:slot-coverage`
(mapping cells). Receipt: `docs/STATUS_HINGECOD.md`.

**R-348** · A hinge day is the main hinge, one hamstring exercise and one
back-extension type, then other things, 2026-09-02.

Owner: hingecod. Sam, shown week 27's hinge day (RDLs, Hamstring Curl, Back
Extension, Nordic Lower, Crab Walks): *"rdl or sl rdl, ham curl or nordic,
back extension or bosch — so 3 exercises is plenty for hinge day — then it
can be other things like glute hip groin tib calf core etc after that"* and
*"do not put ham curl and nordic in the same session"*. Cause: three hinge-day
preferences (R-233's hamstring pair on the single-leg-hip seat, R-347's
posterior-first loaded seat, R-342's loaded-first robustness bench with
R-336's posterior-first order) each said "hamstrings first" and nothing
counted; 21 of 22 in-season hinge days carried four hamstring-type rows.

Now two typed support buckets, read from the catalogue's primary muscles and
classification, never a name list: `hamstring` (an isolation whose only
primary muscle is the hamstrings — Hamstring Curl, Nordic Lower, Swiss Ball
Hamstring Curl) and `back_extension` (posterior support training hamstrings
with glutes, low back or calves — Back Extension, SL 45° Back Extension and
its Hold, Bosch Hold). The main hinge lifts (compounds), glute-only work,
calves, groin, hips and trunk are outside both. After the main lift a hinge
day carries at most one row of each bucket; every later seat drops a spent
bucket. Measured after, both athletes: 47 hinge days, 0 over the cap, 42–43
carrying exactly one of each (in-season: RDLs, Hamstring Curl, Back Extension,
Copenhagen, Crab Walks). Guard: `LAW-hinge-day-three-then-other-things`
through chained `test:automatic-weekly-selection` (bucket cell + 50-world
cell). Receipt: `docs/STATUS_HINGECOD.md`.

**R-349** · A readiness deload keeps the athlete's sessions and halves the
sets, 2026-09-02.

Owner: hingecod. Sam chose "2b" on the report: two tired days in a row were
turning Wednesday's hinge session into Mobility because the deload flagged the
week as low readiness and Decision 14 (WC-141, *"low readiness never adds
work"*) vetoed the fourth in-season session on the rebuild. Ruling: that veto
is about EARNING a fourth session; a deloaded week that already has four is
maintaining, not adding. The scheduler's readiness gains
`deloadKeepsSessions`, set by the weekly compiler whenever the readiness
directive is `deloaded`, and the fourth-session selector is not vetoed under
it; conditioning's reduced-week rules still read `lowReadiness`. Measured:
week 45 keeps Lower Squat, Upper Pull, Lower Hinge and Upper Push with every
retained lift at half sets and the same weight. Guard:
`LAW-readiness-deload-keeps-sessions` through chained `test:weekly-scheduler`
(R-349 cell with its veto control) and the tired-pair cell in
`test:readiness-load-retention`. Receipt: `docs/STATUS_HINGECOD.md`.

**R-350** · The week board carries "two tired days in a row" from the second
date through Sunday, 2026-09-02.

Owner: hingecod. Sam chose "3b". R-275 promised the athlete is told; the
sentence showed only once, as the tap-time acknowledgment, because the board
projection drops app-derived constraints and shows one row per dated fact,
and the streak is a derived constraint no single fact carries. Now the board
derives the fatigue-sequence constraint from the dated reports and shows a
row from the second date through Sunday whose body is the signed sentence
(`readiness.fatigue.sequence`), clearable through its two reports; it never
shows on the first tired date. Guard: `LAW-tired-streak-row-on-the-board`
through chained `test:readiness-load-retention` (tired-pair cells). Receipt:
`docs/STATUS_HINGECOD.md`.

**R-351** · A full-body day beside dedicated days still owns one big lift,
2026-09-02.

Owner: hingecod. Sam approved the root-cause report ("approve 2 3. 4 5").
A 3-day, no-club, Off-season athlete (lower + upper + full body) was refused
at the end of onboarding: the lower day reserved squat and hinge, the upper
day reserved both push planes and both pull planes, and the full-body day
(R-087: only what the other days missed) composed three unilateral helpers
and no main lift, so week 3 (mid Off-season, three main-strength days
required) counted two. Accepted at the 2026-08-27 census checkpoint, refused
from the weekly-budget commit (R-317) onward. Now, when every main seat is
reserved and a full-body day owns none, the owner holding both planes of a
pattern hands the VERTICAL plane over: the upper day keeps a horizontal press
and a horizontal pull as its mains (vertical rows stay as supporting work),
and the full-body day leads with the seat it owns. One seat per week (R-317)
is unchanged. Options rejected: lowering the week-3 minimum (changes the
law); counting a no-big-lift session as strength (the reclassification move
banned 2026-07-27); lower/upper/lower for 3-day athletes (contradicts R-234).
Guard: `LAW-full-body-day-owns-one-big-lift` through chained
`test:three-day-main-seat`. Receipt: `docs/STATUS_HINGECOD.md`.

**R-352** · A pinned drill wins the last robustness seat once four loaded
rows stand, 2026-09-02.

Owner: hingecod. Sam approved pile 4 of the red-test report. R-342 turned one
of the lower day's robustness seats into the loaded seat; the one robustness
seat left asked for the first uncovered football category, so the athlete's
pinned Reverse Nordic Curl (a bodyweight quad drill) lost to Crab Walks and
the intake suite's boundary cells went red. Now, once the day is not below
its four loaded rows, a legal pinned candidate is the seat's bench and the
block selector honours the pin; below four, loaded work still comes first.
Options rejected: rewriting the test (the pin is a promise to the athlete);
a sixth seat (more volume). Guard: `LAW-pinned-drill-wins-the-last-seat`
through chained `test:exercise-intake` (boundary cells + the new control
cell). Receipt: `docs/STATUS_HINGECOD.md`.

**R-353** · The tracked Bulgarian split squat sits in the single-leg knee
seat, 2026-09-02.

Owner: hingecod. Sam: "yep fix that" on the root-cause report. The
tracked-lift seat table put `bulgarian_split_squat` in the squat MAIN seat,
but the weekly selector refuses a compound with no main family on a main
seat, so the athlete's chosen lift was refused every week (High Box Squat
taken) while the single-leg seat took Reverse Lunges — the tracked lift never
landed and its 1RM estimate could never be observed. Now the lift is the
tracked lift of the `single_leg_knee` seat: the composer requests it there
ahead of the seat's bench (the seat is not a main seat, so `isMainLift` is
not required); the squat seat keeps a bilateral squat; Back Squat still
leaves automatic work as the displaced default. Guard:
`LAW-tracked-single-leg-squat-sits-in-the-single-leg-seat` through chained
`test:estimated-1rm`. Receipt: `docs/STATUS_HINGECOD.md`.

**R-230 restated by Sam, 2026-09-02:** "there is no way to do bodyweight
only — the only way you can do it is if you're on holiday and you have a
temporary 'do what ya can' style program." The compiler-year archetype
`male-2-novice-bodyweight` (a world onboarding refuses at the equipment step)
was a stale fixture and is now `male-2-novice-home`; the push refusal it
produced was never an athlete-reachable defect. Owner: hingecod.

**R-354** · An injury report never changes a day the athlete already did,
2026-09-02.

Owner: hingecod. Sam: "approve the past-session bug". Measured on the
compiler-year archetypes: a knee reported on Wednesday added a Copenhagen
plank to the done Monday. The rebuild pinned the done days correctly; the
weekly lower-body frontal completion that runs after the injury week fold
walked every strength date with no history boundary. Now the source-fact
compiler hands the newest injury's first shaped date to the injury week
compile (`historyBeforeISO`) and the completion pass (`placeableFromISO`)
never places on an earlier day. Guard: `LAW-injury-report-never-changes-a-done-day`
through chained `test:injury-limited-kit`. Receipt: `docs/STATUS_HINGECOD.md`.

**R-355** · Injured on limited kit: no strength filler on a Mobility day, no
third row of a pattern, and doubling before nothing, 2026-09-02.

Owner: hingecod. Sam: "shouldn't it just be if you have limited equipment
that you can double up on things when injured?" … "yes doubling". Three
rules for the injury-added block: (a) a Mobility or Recovery session never
receives strength fillers — the paused stretch comes off; (b) the block never
gives a day a third row of a push or pull pattern the day already carries
twice; (c) when no unused legal compound in the unaffected half remains, the
block repeats a safe compound the rest of the week already carries (never a
paused row, a row already on the day, or an athlete exclusion) before leaving
the position empty. R-334's "no repeat filler" stands for healthy sessions;
this is the injured, limited-kit case it left open. Guard:
`LAW-injured-limited-kit-doubles-up` through chained
`test:injury-limited-kit`. Receipt: `docs/STATUS_HINGECOD.md`.

**R-356** · The week checker judges what the app could honestly build,
2026-09-02.

Owner: hingecod. Sam: "yep do all" on the five week-checker notes. (1) An
injury that withdraws a core-conditioning session with no off-feet
replacement writes an `injury_restriction` reduction of
`conditioning_core_frequency` on the week contract (counted as the athlete
sees the week, after the read-time exposure filter), so an injured week is
not judged against the healthy target. (2) Two dedicated upper days no
longer both claim the same four seats; the second takes the vertical push
and pull. (3) The week's only strength day seats squat, hinge, push and pull
before the single-leg pair, so the four-compound ceiling never eats its pull
main. (4) The in-season app-sprint top-up counts high-speed exposures (club
nights plus games), not distinct days; a game moved onto a club night is two.
(5) A conditioning day emptied to its warm-up collapses to the honest rest
shell — at the injury fold and at read. Guard:
`LAW-week-checker-judges-what-the-app-could-build` through chained
`test:week-checker-allowances`. Receipt: `docs/STATUS_HINGECOD.md`.

**R-357** · Every canonical week answers for its lower-body frontal plane,
2026-09-03.

Owner: hingecod. Sam: "approve 1" on the cohort root-cause report. The
lower-body frontal completion (`completeWeeklyLowerBodyFrontal`) used to run
only inside the injury compiler and the fixture replan; a healthy week whose
frontal row left with a G+1 Monday (Sunday game the week before) or with a
deload cut answered nothing — measured on the six-athlete cohort (3-day
athlete weeks 30/36/48; 2-day athlete week 15; beginner 10 of 156). The same
function now runs in the row compiler for every week, after the candidate is
authored and before it is judged: one frontal row on a strength day the
athlete has not done yet, or the honest `lower_body_frontal_unavailable`
exception the audit reads; a week that already carries the plane is
untouched. The deload keep-order treats a frontal-plane row as important,
alongside the four upper planes, so the cut keeps the plane. Extends R-327.
· `WORKING` — `test:plane-and-load-memory` (cells 1a/1b/1c), red-first at
`64fbace0`.

**R-358** · A recorded load by name outranks any estimate, 2026-09-03.

Owner: hingecod. Sam: "approve 2". Every composed row's base load was the
onboarding estimate (`resolveComposedLoad` → `estimateStartingWeight`), and
the athlete's own logged loads were read only at a block boundary and in an
injury swap. A week re-derived mid-block (bye recovery, G+1 coverage) gained
rows the block never had and prescribed them at the estimate over the
athlete's record (DB Shoulder Press 15 → 9; Seated DB Press 27.5 → 10; Goblet
27.5 → 12.5), the athlete confirmed the estimate and the next block trusted
it; the injury block's added rows did the same (Trap Bar 50 → 25). Now the
composer's base load and the injury block's added rows read the athlete's
last logged load by canonical name (`recordedLoadsFromFeedback`, the one map
the injury swap already used) before any estimate; reachability (R-083) is
still asked first. A lift with no record still starts from the estimate.
Writer: the program compiler (`compileCanonicalProgram`), from the
progression state cut off at the progression's own `asOfISO`, so a relaunch
reads exactly the record the build read; the fixture-week stub states its
loads only (cut off at the week's Monday) through the generator's
`recordedLoads` option; the injury compiler carries the same map to the
block's added rows. Readers: `resolveComposedLoad`,
`addExerciseCandidates.loadFor`. Not ruled:
seeding a NEW lift from a related lift's record (the beginner's year-3 Back
Squat after a year of High Box Squat) — mapped for Sam, awaiting his call.
· `WORKING` — `test:plane-and-load-memory` (cells 2a/2b/2c), red-first at
`64fbace0`.



**R-359** · A sixth hard day is warned, never refused, and the app never
opens it, 2026-09-03.

Owner: hingecod. Sam: "go" on the cohort's blank-weeks finding. R-009 ruled
the warning; the generated-week contract still BLOCKED on
`hard_day_permitted_maximum`, so a 4-day athlete whose club nights fell on
two other days (five committed days) plus the app's own Saturday speed
session made six, the rollover threw, and three cohort athletes saw a blank
program from week 9 to 30 and could not report an injury. Two changes: (1)
the clause DISCLOSES instead of blocking — the week publishes with its
contract and the §18 effective-week evaluator carries the warning
(`hard_day_breach`); (2) when the athlete's own strength days, club nights
and games already reach the Bible's absolute hard-day maximum (five), the
scheduler's automatic speed session rides an existing strength day instead
of opening a new one. Extends R-009, R-007, R-065. · `WORKING` —
`test:hard-day-warns` (three worlds: six committed days warned and published
with an accepted shoulder report; five committed days and no sixth opened;
the cohort's exact Mon/Wed-club shape), red-first at `7dc09008`.

**R-359 addendum, same day (hingecod) — the evaluator's own breach was still
blocking.** The generated-week contract disclosed, but the §18 effective-week
evaluator marked `hard_day_breach` BLOCKING, and the accepted-week gateway
throws on any blocking finding under a restoration — so every exercise edit
on a week the app had already published past the maximum was refused with
"nothing on your plan changed" (intake's unresolved 2026-08-29 finding: "Add
Session permitted the fifth session, then exercise Add refused it"). Witness:
the Pre-season 5-gym-day athlete with club Tue/Thu who adds strength on
Wednesday and Saturday (6 hard days, permitted 5). The finding is now
advisory, as R-359 already said in words; R-274's "athlete-added strength is
excluded from the Section 18 maximum-breach calculation" stays as written
for the main-strength maximum. · `WORKING` — `test:hard-day-warns` world (4)
(red-first: 2 red with the severity flipped back), `section18ContractV2Tests`
12b, and the seven athlete-owned-fifth cells of
`test:canonical-weekly-compiler` (30 → 15 red, 0 new). Two findings NOT
fixed, recorded in `docs/STATUS_HINGECOD.md`: a merged "Mobility + Full Body
Strength" day reads as recovery to the visible classifier while §18 counts it
hard; adding strength onto a day that already has strength relabels the whole
day athlete-added, so the planner-governed count drops and
`required_minimum_shortfall` refuses later edits.

**R-360** · A new lift borrows its first weight from a logged lift in its
family, with a cap, 2026-09-03.

Owner: hingecod. Sam: "yes with a cap" on the mapped question 3. Every
prescribed lift hangs off one anchor (squat or bench) with a fixed ratio
(`EXERCISE_LOAD_MAP`), so a logged sibling implies the anchor and the anchor
implies the new lift: record ÷ sibling ratio × this ratio, reading the
sibling with the largest ratio (closest to the anchor), capped at
`FAMILY_SEED_CAP_MULTIPLIER` (1.5) × the lift's own onboarding estimate,
rounded to the lift's equipment lattice. A weak sibling borrows down as
honestly as a strong one borrows up. Order everywhere a first weight is
decided: the lift's own record (R-358) → a family borrow → the estimate.
Readers: `resolveComposedLoad`, `decideBlockBoundaryLoads`,
`loadForReplacementExercise`, `addExerciseCandidates.loadFor`; one owner:
`familySeedFromRecord`. Measured on the cohort: the beginner's year-3 Back
Squat would start at 50 from his High Box Squat 67.5 (47.5 before); a 35 kg
DB bench would imply 93.5 for a first Bench Press and is capped to 70
(estimate 47.5; he reached 75). · `WORKING` — `test:family-seed` (8 cells),
red-first at `7dc09008`.
**R-356 addendum, same day.** (1) covers MAIN STRENGTH as well: a strength
day whose every main lift the injury paused (a knee on a lower day) is
recorded as an `injury_restriction` reduction of `main_strength_frequency`
by the same withdrawal count — the pre-change tree carried
`required_minimum_shortfall:main_strength 3 vs 2` on every full-gym knee
week; the earlier green came from R-355's repeat rung duplicating a lift
there. R-355's doubling is therefore gated to its own case: it fires only
when the kit offers no unused legal compound at all; a spent weekly seat
budget is not limited kit (the 52-week audit caught Barbell Row and
Pull-Ups doubled in week 22 before the gate).
**R-355 scope, second correction, 2026-09-03 (hingecod).** The gate above
over-reached: a lower-back report on a lower day pauses EVERY row, the weekly
seat budget refuses every unused upper compound, and with doubling gated off
the day kept nothing and added nothing — so the apply step (R-115: never a
blank day) left all five unsafe rows standing with "could not be made safe.
Skip those" (`test:injury-fallback-journey` "lower back, limiting", red from
`4e2ebbf2`, green at `cee3c49e`). R-355(c)'s own words are "before leaving the
position empty": doubling now fires when the kit has no unused compound OR
when the day keeps nothing. The week-22 calf day kept rows, so it still does
not double (`test:injury-limited-kit` 16/16 unchanged).

**R-361** · The app accent is yellow, 2026-09-03.

Owner: accentyellow. Sam: "Change the app's accent colour from lime #C8FF00
to yellow #D8D800, with #B0B000 for the pressed state. Sam's ruling, 3 Sep.
Logo stays as is." The primary accent is `#D8D800`; translucent accent
treatments use the same `216, 216, 0` RGB; and the shared primary-button
pressed state is exactly `#B0B000`. Semantic success, warning, error and info
colours do not change. The supplied LFA wordmark and brand image assets do not
change. The existing `lime` / `limeDark` key names remain as compatibility
names so this colour-only ruling does not create a repo-wide API rename.
Guard: `LAW-the-app-accent-is-yellow-and-the-logo-is-unchanged` through chained
`test:accent-colour` (7 cells, including an old-lime mutation).
Receipt: `docs/STATUS_ACCENTYELLOW.md`.
**R-361 addendum, 2026-09-03 (hingecod), after the phone preview.** Sam:
*"'today's focus' on day view and the little icons on the weekly view still
have the old lime green — why was lime green not completely ripped out?"*
Three hand-written `#C6FF00` literals survived the token change (the week
view's day-row icon accent and the "Today's focus" eyebrow in `HomeScreenV2`,
the Add glyph stroke in `SessionChangeHub`); the accent suite only listed the
exact old tokens. All three now read `colors.accent.lime` (the yellow), and
`test:accent-colour` refuses ANY lime-family hex literal in app source.

**R-362** · Five rear-shoulder exercises may be selected in Movement Prep,
2026-09-03.

Owner: warmuprear. Sam named `Incline Y Raise`, `Face Pull`,
`Cable Face Pull`, `Rear Delt Fly` and `Band Pull-Apart`: all five remain in
their existing Arms/shoulders catalogue ownership and are also eligible for
the shoulder-prehab slots in an upper or full-body warm-up. Existing equipment,
injury, experience and game-proximity filters still apply. `Face Pull` and
`Cable Face Pull` are two versions of one exercise family: either may be used,
but both may never appear on the same day, across warm-up and main work as well
as within the warm-up. A performed warm-up Face Pull outranks a fresh redraw of
its sibling. Guard: `LAW-five-rear-shoulder-exercises-can-warm-up-but-face-pulls-never-pair`
through chained `test:warmup-rear-shoulder` (9 cells, 730 dated upper warm-ups,
both main/warm-up directions and a removal mutation). Receipt:
`docs/STATUS_WARMUPREAR.md`.

**R-363** · The injury workbook is release unit 31; completeness and parity
are gated; Adductor Rockback's thirteen ratings; the squat elbow/wrist cells,
2026-09-03.

Owner: integrate. Sam ruled four things in one sitting. (1) The injury
workbook is rebuilt ONLY through the existing matrix pipeline (extract →
derive → build → apply), never by hand, and its check is release unit 31
(`test:injury-matrix-sheet`, a current contract in the decisions register).
(2) Unit 31 holds three things: sheet ↔ code parity cell for cell in both
directions; COMPLETENESS — every pool member the app can place has a full
thirteen-region row in code and on the sheet; and no DECISION cell remains
(a cell the rules cannot decide reads DECISION, never good). It is red until
every untagged drill has Sam's intake classification; the run prints the
decision list. (3) Adductor Rockback's thirteen ratings, from the rated drills
nearest to it: groin, hip, knee, ankle/foot, lower back, shoulder, elbow and
wrist/hand Caution; quad, hamstring, calf, ribs and neck Good. Recorded as
named exceptions in the ruling file where the Groin muscle rules and the
declaration do not already give them. (4) On the squat elbow/wrist cells the
sheet had not carried (Back, Front and Box Squat), *"the app is right"* —
these fall under R-267 ("ratings include indirect support/loading", 2026-08-28),
which had been applied to code and sheet but never transcribed into the ruling
file; the transcription now carries all 56 R-267 cells, the 2026-08-26 rack
shoulder cells and the 2026-08-27 quad-dominant hamstring cells, so the
pipeline reproduces the code exactly (apply step: 0 changed cells, 167 rows
normalised). Not invented: the 33 untagged pool members (26 mobility drills
incl. Adductor Rockback, 6 tissue-quality, 4 breathing, 3 easy-cardio walks)
carry no tags row and cannot until Sam supplies their classification
(movement pattern, region, load, soreness, stability, eccentric, late-week);
5 contraindication cells (Hip 90/90 knee, Deep Squat Hold ankle/foot,
Butterfly Stretch ankle/foot, Jefferson Curl neck, Dumbbell Pullovers ribs)
and the three walks' conditioning family are his to rule. Guard:
`test:injury-matrix-sheet` (release unit 31). Receipt: `docs/STATUS_INTEGRATE.md`.

**R-364** · The complete intake supersedes the 24 July untagged exemption for
the 33 recovery exercises, 2026-09-04.

Owner: integrate. Sam: *"'Mobility' must not mean 'safe for every injury.' For
example, an athlete with a knee issue should not be offered ATG Split Squats
merely because they sit in the mobility group. Every exercise needs injury
behaviour based on what it physically demands."* For the 30 mobility,
tissue-quality and breathing drills and the three zone-1 walks, the complete
intake process (classification + thirteen-region injury ratings, the same as
the six mobility drills of 2 September) supersedes the 24 July
`mobility_untagged` exemption, which is retired. Each row is classified from
its actual movement, loading and existing contraindications — no blanket
ratings. Every pool contraindication Sam authored is preserved or
strengthened: it is Avoid on the tags row (refused as a swap and withheld from
an existing session at every severity) AND it stays on the pool entry (refused
at selection). ATG Split Squat is unavailable whenever a knee injury is active.
No equipment, equipment type, question or filter is added; the pool entry
still owns each dose. The three walks join the conditioning ruling as the
`walk` family (lower body Caution). Adductor Rockback's R-363 ratings enter
through this intake with groin strengthened to Avoid. Guards:
`test:exercise-intake` (the 33 rows equal the intake document; every
contraindication refuses selection, swap and retention; mutations
`recovery_rating` and `atg_knee`), `test:injury-matrix-sheet` (release unit
31: parity + completeness, green). Intake: `docs/EXERCISE_INTAKE_RECOVERY_2026-09-04.md`.
Receipt: `docs/STATUS_INTEGRATE.md`.

---

**R-365** · *"I don't want it to show for any strength exercise - ever"*, then
*"shouldn't happen in mobility or recovery either - the only thing that has rest
is conditioning and speed"* (Sam, 2026-09-04, on finding `2:00 rest` under
`Hamstring Curl` and `Nordic Lower`) · **REST IS A CONDITIONING AND SPEED LINE.
NO OTHER ROW PRINTS ONE.**

⚠ **THIS SUPERSEDES R-116's REST CLAUSE, AND THE CLAUSE'S PREMISE IS THE
LESSON.** R-116 (2026-08-20) hid the line for POWER alone, reasoning that
*"Power was the only role whose rest cleared the 90-second display threshold"*.
That was a MEASUREMENT of the doses of the day written down as if it were the
rule. It stopped being true the moment a compiler dosed anything else at 90 s+,
and it did: two hamstring rows. **R-116's other clauses are untouched** — the
checkbox beside the stepper, the play button beside the name, sets × reps then
Form cues, no separate Power row format or section. Only the rest clause falls.

⚠ **THE GATE IS THE CARD, NOT A CONDITION INSIDE IT.** `StrengthExerciseCard`
renders strength, mobility, recovery, accessories, prehab and primer rows;
conditioning and speed have their own `ConditioningPhaseRow`, which owns its own
rest wording. Deleting the line from the shared card therefore states Sam's rule
BY CONSTRUCTION — there is no role list left to keep in step, and no future dose
change can leak a rest line back onto a strength row. `formatRest` and the
`restHint` style are removed from the screen with it; `formatRest` survives in
`dayWorkoutHelpers` for the conditioning owner.

⚠ **A LINE IS DELETED; A PRESCRIPTION IS NOT.** `restSeconds` is untouched on
the row — still stored, still generated, still read by everything that reads it.
Same boundary R-116 drew for Power.

**Search words:** rest, rest line, rest period, rest hint, 2:00 rest, restSeconds,
formatRest, restHint, 90 second threshold, Hamstring Curl, Nordic Lower, power
rest, conditioning rest, speed rest.

· `BUILT src/screens/home/DayWorkoutScreenV2.tsx` — the `restLabel` computation,
the gated `Text`, the `formatRest` import and the `restHint` style are all gone.
**Guarded by `test:session-execution-checklist` [10]** — four cells: the shared
card prints no rest line at all; the screen keeps no rest hint outside
conditioning and speed; the card still stores `restSeconds` unchanged; and no
role-gated rest survives anywhere. **MUTATION-PROVEN 2026-09-04:** restoring the
screen reddened exactly those cells (209/5 against 212/2) and nothing else;
restoring the fix returned the suite to its two pre-existing reds.

⚠ **THE OLD CELL WAS GREEN THE WHOLE TIME THE RULE WAS LEAKING**, because it
pinned the EXCEPTION's source text (`restLabel && exercise?.role !== 'power'`)
rather than the rule. A cell that asserts an exception cannot see the rule break.
It is INVERTED here, not deleted.

---

**R-366** · *"show the long cues everywhere"* (Sam, 2026-09-04, on finding
`Jefferson Curl` reading **"Slow reps"** on his phone while the curated cue for
the same movement — *"Tuck your chin and slowly roll down one segment at a time.
Add small weight when easy"* — existed and was never rendered) · **THE CURATED
CUE LAYER OWNS EVERY ATHLETE-VISIBLE COACHING WORD ON EVERY ROW. A ROW'S OWN
NOTE MAY NOT STAND IN FOR IT.**

The screen carried a `cueTextOverride` prop, and both mobility routes passed the
row's `notes` into it: the Movement Prep list passed `exercise.notes`, and the
shared session mapper passed `cleanNotes(...)` for any row presented as mobility
without a `sessionSection`. Those notes are the static strings on the pool rows
in `exercisePools.ts` — shorthand written for the pool, not for the athlete. So
one exercise had two sets of athlete-visible words and the screen silently
preferred the shorter, on exactly the rows an athlete reads while warming up.

**The override is DELETED, not defaulted.** Every row — strength, recovery,
mobility, add-on, manually added — now reaches `resolvedCue.text`, which is
`buildCueText` through canonicalisation, which is Sam's master sheet. A prop
that can be passed is a second authority waiting to be used again; the only way
this stays one source is for the second door not to exist.

Coverage checked before the change, not after: all 94 pool rows resolve to a
real curated cue, so no row lost its words. **The pool `notes` field is
untouched** — it is still read by the conditioning dose line, the visible read
model and the coach; only its role as a *form cue* is retired.

Guard: `test:session-execution-checklist` (no route overrides the curated cue
with a row note), `test:mobility-flow` (a mobility row does not override the
curated cue with its pool note) and `test:session-change-hub` (manually added
mobility reads the one curated cue source). All three cells previously asserted
the OPPOSITE — they pinned `cueTextOverride={exercise.notes}` as required — and
are INVERTED here, not deleted. Proven on glass 2026-09-04: `Jefferson Curl`
and `Bosch Hold` both read their curated cue in Movement Prep.
Receipts: `docs/STATUS_LONGCUES.md`.

**R-367** · The main-lift badge is the seat's, not the exercise's, 2026-09-04.

Owner: variety. Sam: *"the screen is lying to you about main lifts."* Whether a
row wears the main-lift badge is decided by THE SEAT IT FILLED, never by which
pool array its name sits in. `utils/sessionRoles.sessionRoleForRow` is the one
resolver: `section18Evidence.role === 'main_strength'` is a main lift;
`'strength_accessory'` is not, and may not be promoted by an anchor-bench name;
a row carrying no evidence still falls to `classifyExerciseRole`, which is
retained for athlete additions and legacy stored weeks and is no longer allowed
to overrule a decided row.

This restores R-092 (*"the composer DECIDES the role; §18 reads this rather than
re-inferring it from the exercise name"*) on the athlete's surface. Nothing new
is authored: `materialiseComposedWeek` and the retained `defaultProgram` adapter
have both written `section18Evidence.role` all along, and `deloadWeekRules`
already read it with this exact precedence. The screen was a second authority
and it was winning.

MEASURED over the preserved 52-week driver, before: **14 of 14 `lower_squat`
days shipped with no main lift on the glass**, while the composer had chosen one
every week — `Leg Press`, 406 selections of 406, reason `single_legal_candidate`.
After: 0 such days, and exactly **108 rows moved from `accessory` to
`main_lift`** with the total row count, prehab, midline, power, conditioning and
team-training counts all unchanged. Every day gaining a second main lift is one
horizontal plus one vertical (or squat plus hinge), which is R-305's shape;
`test:main-lift-pattern` reports 0 R-070 breaches across 35 generated sessions.

`rules/mainLiftPatternLaw.isMainLift` reads the same resolver, so R-070 and the
glass cannot disagree about which rows are main lifts.

NOT COVERED: `deloadWeekRules` keeps an inline copy of the same precedence
because its fallback resolves aliases with `resolveExerciseName`; folding it in
is the next convergence and is named in `docs/STATUS_VARIETY.md`.

Guard: `test:visible-surfaces` section [12], both directions, driving the real
materialiser and the real session-template owner. Receipts:
`docs/STATUS_VARIETY.md`.

**R-368** · B-Stance RDL joins the single-leg hip group, 2026-09-04.

Owner: variety. Sam: *"add this into the exercise list as well - so we have
another single leg hip dominant lift."* B-Stance RDL is a loaded single-leg
hip-dominant lift for everyone, seated in the hinge accessory pool's
`single_leg_hip` group. Barbell or dumbbell with dumbbells resolved first; no
kettlebell, and it is NOT bodyweight-capable — the sheet says barbell or
dumbbell and nothing was widened past it.

WHY IT MATTERS MORE THAN AN ORDINARY ADDITION: the app owned exactly ONE loaded
single-leg hip lift, and `exercisePoolsStrength.ts` has said so in its own words
since 2026-08-13 — *"the app owns exactly ONE single-leg hip lift in this pool,
so that group cannot rotate at all today ... more variety is a content unit, not
this one."* This is that content unit. The group now holds two loaded options and
can rotate.

"Same as Single-Leg RDL" is held as EQUALITY, never as a copy: the identical
authored dose category, the identical load profile row, the identical experience
gate and late-week rating, and slot membership DERIVED from `movement: 'hinge'`
+ `unilateral: true` by the same owner that seats the sibling. A suite pinning
those as literals would stay green on the day the sibling's numbers moved and
the two lifts silently diverged.

It differs where Sam authored it to, and those are literals: hamstring **Avoid**
(the sibling is Caution — a B-stance loads the front hamstring harder because
the rear leg is not sharing the work), knee Good, stability moderate, eccentric
high, load moderate.

SAME-SESSION IDENTITY: it joins the `romanian_deadlift` variation family, so
R-233's one-RDL-variant-per-day covers it on arrival rather than being found by
an athlete reading two RDLs on one page. **The consequence is stated:** in-season
R-093 puts an RDL on every hinge day, so this lift is excluded exactly where the
sibling is. The variety it buys is off-season and pre-season variety.

The master workbook row was INSERTED at its Lower hinge position, never appended
— 218 to 219 data rows with every other row byte-identical — and the
movement-plane mirror moved with it.

NOT COVERED: per-side rendering. Sam's sheet says the repetitions are per side
and they do not render that way; neither do `Single-Leg RDL`, `Walking Lunges`
or `Bulgarian Split Squats`, all measured shipping as plain `3 × 8`, because
`perSide` is only ever read off an authored prehab/carry pool entry and never
derived from `unilateral: true`. A class-wide gap, raised with Sam and not fixed
for one lift. Also not added to `BEGINNER_EXERCISE_PRIORITY.hinge`, which is a
preference order rather than a legality gate.

Guard: `LAW-b-stance-rdl-intake` through chained `test:exercise-intake`, which
invokes `test:b-stance-rdl`. Receipts: `docs/STATUS_VARIETY.md`,
`docs/EXERCISE_INTAKE_B_STANCE_RDL_2026-09-04.md`.
