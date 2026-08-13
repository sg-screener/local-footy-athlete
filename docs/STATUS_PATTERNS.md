# PATTERNS — your own status file. ONE WRITER: you.

**NAMED 2026-08-13.** The seats are named for WHERE they live (`terminal` — the
rules engine; `desktop` — screens and flows), for WHAT they do (`audit` — it does
not believe a claim until it has measured it), or for their LANE (`pace`,
`progression`, `readiness`). This one is named for its lane: **movement
patterns — which pattern a lift spends, and the laws written in that
vocabulary.** `ls docs/STATUS_*.md` before the first commit showed five files and
`patterns` free.

**EVERY COMMIT FROM THIS SEAT ENDS `Agent: patterns`.**

---

## R-070 IS ENFORCED — "ONE MAIN PER PATTERN PER SESSION"

**THE ORDER (Sam, 2026-08-13):** *"Two heavy lifts of the same pattern may not
share a session — deadlift plus RDL is illegal — and nothing enforces it. Census
row A4."*

**HIS BIBLE `:226`, verbatim, which is the assertion:** *"ONE MAIN PER PATTERN
PER SESSION. Never two heavy lifts of the same movement pattern in one session.
Deadlift + RDL is two heavy hinges and is illegal. Box squat + back squat is two
heavy squats and is illegal. A second heavy lift in a session must be a different
pattern."*

### WHAT LANDED

| file | what |
| --- | --- |
| `src/rules/mainLiftPatternLaw.ts` | the oracle — pure, ~135 lines, borrows both of its answers |
| `src/__tests__/mainLiftPatternLawTests.ts` | 23 cells, six blocks, two censuses |
| `src/utils/exerciseScorer.ts` | the production fence, +76/-3 |
| `package.json` | `test:main-lift-pattern`, wired into `test:bible` beside `test:slot-coverage` |

### THE DEFECT IT FOUND, AND THE RED IT WAS SEEN IN

**36 breaches of 396 built sessions**, every one the same shape:

    Bench Press + Close Grip Bench     — two heavy horizontal presses
    Close Grip Bench + Speed Bench     — same, under a severe lower-back injury

They come out of `selectExercises`, which the coach's revision templates call
through `buildTagAwareSession` when the athlete adds a strength session.
**36 -> 0 with the fence in.** Verified on a clean HEAD worktree, not on the
shared tree.

### IT BORROWS BOTH ANSWERS RATHER THAN INVENTING EITHER

- **"Is this a heavy lift?"** — `classifyExerciseRole`, i.e. the exercise pools'
  own anchor/accessory answer, which the session order and mobility flow already
  read.
- **"Which pattern is it?"** — `slotsFilledByRow`. This is the ONLY vocabulary
  the law may use, and the granularity is load-bearing in BOTH directions: read
  it coarser (`push`) and Sam's own upper ladder becomes illegal; read it finer
  and Bench + Close Grip Bench becomes legal. The unilateral split comes free and
  was already paid for by `sessionSlotCoverage`.

### FIVE MUTANTS, AND THE FIFTH REFUTED MY OWN COMMENT

| mutation | cells red |
| --- | --- |
| `mainLiftSlot` collapsed to one pattern | 8 |
| `isMainLift` always true | 4 |
| the unauthored-role fallback deleted | **11**, both censuses to ZERO lifts |
| R-070 deleted from the PREFERRED pass | 1 — all 36 back |
| R-070 deleted from the RELAX-FALLBACK | **SURVIVED — 23/23 green** |

**I had written into both the code and the suite header that every breach came
through the relax-fallback. It is false.** They all come through the preferred
pass: `Upper Push`'s accessory slot names `horizontal_push` as a *preferred*
movement, so a second moderate-load bench was never the reluctant pick the
fallback exists for. The fallback check STAYS — a law no path may waive — but it
is a fence on a door nothing currently walks through, and both comments now say
so. Corrected in the same commit, not quietly.

### TWO CENSUS A4 PREMISES ARE REFUTED — the law is real, its examples were not

A4 offers three worked examples of the app breaching R-070. **Measured:**

- *"`defaultProgram:1172-1177` emits RDLs + Hip Thrusts, both classify as main
  lifts"* — **`Hip Thrust` is `accessory` in the app's own pools**, load
  moderate. One heavy hinge and one accessory hinge is not what `:226` forbids.
  (And the rows there have since been rewritten by the `terminal` seat anyway.)
- *"`:1194-1196`, Overhead Press + Incline DB Bench, both `push`"* — **different
  patterns and different roles**: `vertical_push` main, `horizontal_push`
  accessory. Reading them as one "push" is the coarse vocabulary that would
  refuse Sam's own upper ladder.
- *"the only stacking cap in the repo says the OPPOSITE — `exerciseScorer:405`"*
  — **TRUE, and now labelled at the line.** It counts every pick of a movement,
  accessories included, and permits two; it is a volume cap, not this law. It
  stays, doing its own weaker job.

**A cell asserting the census's version would have pinned a false claim into the
chain.** `[4]` asserts the measured version instead.

### THE NON-VACUITY CELL EARNED ITS KEEP INSIDE ONE HOUR

Block `[6]` first reported **"0 breaches of 0 generated sessions"** and read as a
clean bill of health. Every world was refusing to build: a concurrent seat's
half-saved edit had `coachingEngine.ts:1062` throwing `capacity is not defined`,
and `test:slot-coverage` was red the same way. **A count of BREACHES cannot tell
a lawful corpus from an absent one.** There are now two non-vacuity cells there —
worlds built, and heavy lifts seen.

### WHAT IS NOT COVERED

- ~~**The registry flip is OWED.**~~ **✅ CLEARED, AND NOT BY ME.** Another seat
  flipped R-070 to `BUILT 70e91a0f` within the hour, citing this commit and
  carrying the two refutations across accurately. The ceiling had meanwhile been
  paid 13 -> 5 by `readiness`. **The debt I recorded as blocked was paid by the
  seat that held the file** — which is the block working as intended rather than
  a queue jam, and is why `BLOCKED-BY` must name the FILE.
- **`test:bible` has not been run end to end**, and cannot be while the shared
  tree throws `capacity is not defined`. `test:main-lift-pattern` passes 23/23 on
  a clean HEAD worktree; the chain wiring is asserted only by the script existing
  beside `test:slot-coverage`.
- **`test:compile` not run** for the same reason.
- **The athlete has not seen this on glass**, and cannot: the law is a refusal,
  so its visible proof is the ABSENCE of a second bench press. Named as WORKING,
  not as done — the test that fails if it breaks is
  `npm run test:main-lift-pattern`.
- **The coach's own edit doors are NOT fenced.** This law is held at generation
  (`selectExercises`) and at the gate. If a coach command inserts a second heavy
  lift into an existing session by another route, nothing refuses it — the
  conflict would only surface in the census if generation produced it. Naming it
  because it is a shape the athlete already has: they can ask the coach to swap
  an exercise.
- **`buildIntent`'s NAME branch is unreachable from production today** — the sole
  caller passes `workoutType: 'Strength'` with a typed `strengthIntent`. All 36
  breaches were in that branch. It is covered anyway; a template shipping without
  a typed intent would walk straight into it.

### WHAT WOULD CATCH THE NEXT ONE OF THIS CLASS (L12)

The class is **a law written in a vocabulary nothing shares**. R-070 sat
unenforced for months not because it was hard but because "pattern" had no single
owner: tags say `movement`, the scorer says `MovementPattern`, the ladders say
slots, and the Bible says English. The fix that generalises is that the fence and
the gate read the SAME two functions — so the composer cannot obey a rule the
gate is measuring differently. Any future law in this vocabulary should be built
on `mainLiftSlot`/`slotsFilledByRow` rather than on `tag.movement`, and a second
pattern vocabulary appearing anywhere is the thing to red on.

---

## ITEMS 57 AND 58 — ordered as `readiness`, worked as `patterns`

**WHY THE NAME DID NOT CHANGE.** Sam addressed these to `readiness`.
`docs/STATUS_READINESS.md` has another writer, whose last commit was 75 minutes
before I picked this up, and the stamping law exists because two sessions behind
one name is how a day's history became unreadable. **Stamping `readiness` would
have re-created exactly that.** So the items are worked and the seat is
unchanged; this file records them.

### ✅ ITEM 58 — THE HOMONYM GUARD REDS. AND IT HAD ONE BLIND SPOT.

**The ask:** *"verify the new guard actually reds on a re-merge, by mutation."*
Done in a detached worktree, four real re-merges injected into real product
files:

| mutation | result |
| --- | --- |
| a `capacity === 'low'` renamed back in `progressionRules` | **RED** |
| the NEGATED form `readiness !== 'high'`, a rules file | **RED** |
| a QUALIFIED `athlete.readiness === 'medium'` | **RED** |
| a `.tsx` navigation file, not a rules file | **RED** |

Each named the offending file and its count in its own failure text. **The guard
works.**

**TWO ATTEMPTS MISSED** — the injected code did not match the file it was aimed
at, and both are recorded as MISSED rather than SURVIVED. A surviving mutant
means *"the gate is blind OR the mutation missed"*, and only one of those is a
finding about the gate.

**AND A FIFTH MUTATION SURVIVED — `productFiles()` returning `[]` left the suite
94/94 GREEN.** Both sweeps standing on it — block [5]'s undeclared-edge census
and block [8]'s homonym gate — read "no offenders" off an empty list and reported
perfect health. **That is R-041's own history repeating**: its row records a
guard that said *"nothing reds if they re-merge"* while the homonym re-merged in
ten sites over seventeen days. A gate that cannot tell NO VIOLATIONS from NO
FILES LOOKED AT is the same silence wearing a green badge.

**FIXED AT THE WALK, NOT AT THE CELL:** `productFiles()` now THROWS below 200
files (549 today). A cell in one block would have left the other still standing
on sand. Re-mutated after the fix: the empty walk now exits 1.

**THIRD SIGHTING OF THIS SHAPE IN ONE SESSION** — my own R-070 census reported
"0 breaches of 0 sessions" earlier today for the same reason, and the `terminal`
seat's SLOT census has the same structure. **COMPRESSION, offered rather than a
fourth run: any suite that sweeps a FILE LIST or a GENERATED CORPUS states the
size of what it swept, and reds on a floor.** Two of the three already do; this
is cheap to make standing.

### ✅ ITEM 57 — R-039 IS GUARDED

**The ask:** *"the three mechanisms are gone from production; no suite stops them
coming back."*

`test:fatigue-abolition`, 8 cells, in the `test:bible` chain. R-039 moves
`UNENFORCED` -> `BUILT`; `UNENFORCED_CEILING` 5 -> 4 in the same commit.

**IT IS A DIFFERENCE TEST, AND THAT IS THE DECISION WORTH DEFENDING.** The
abolition survives as `void input.readinessDeloaded;` at two sites, each with a
comment saying what was removed. **A comment is not a gate** — reinstating a
reduction means deleting a `void` and writing ordinary-looking code. So the
assertion is the observable consequence: **the exposure contract is
byte-identical with the deload flag on and off**, across 30 worlds (3 phases x 3
sub-phases x 3 capacity bands, plus bye build/recovery and club/no-club). That
survives a refactor of all three sites.

**THE CONTROL IS HALF THE GUARD.** A difference test passing because the
instrument is inert is the emptiest green there is. One cell proves the same
comparison DOES move for an active severe injury — which also pins Sam's own
exception, *"injury is untouched"* — and one asserts the two signals are
ASYMMETRIC, so it reds in both directions.

**THREE MUTANTS KILLED:** reinstating the count reduction reds 2; reinstating an
exposure removal reds 3; blinding the injury control reds 3.

**THE COMPILER CAUGHT A VACUITY THE SUITE DID NOT.** My first cut passed
`'early'`/`'mid'`/`'late'` as sub-phases and went **8/8 GREEN**; the canonical
spellings are `early_offseason` etc., and `test:compile` was the only thing that
objected. Twenty of the thirty worlds were silently falling back to one default,
so a sweep advertising sub-phase coverage was covering one. With it fixed the
census moved 30/30 -> 27/30 demanding strength, which is the proof the worlds
now differ. **A green suite is not evidence that its own inputs are the ones it
names.**

### NOT COVERED

- **MECHANISM THREE IS NOT HELD.** Bible `:4962` names three sites; blocks [2]
  and [3] hold the first two, which are exposure-contract shapes. The third —
  *"a session-action rule converting a session to recovery once 75% of its rows
  were stripped"* — lives BELOW the builder and a contract comparison cannot see
  it. **What would hold it:** drive a real generated week through the
  session-action layer with the deload flag set, strip past 75%, assert the
  session's TYPE and TIER are unchanged. That needs the action walker, not a
  pure builder. **Named in the suite's own NOT-COVERED line and not claimed in
  the registry row.**
- **`test:bible` end-to-end not run**, and `test:ruling-registry` block [3] is
  RED — pre-existing, present before my edits, about a question elsewhere in the
  queue citing no row. Not mine and not touched.
- **`stripComments` is an unused import** at `readinessStructureCensusTests.ts:50`
  and was so at HEAD. Left alone — another seat's file, and not my unit.
- **No glass.** Both laws are refusals; their visible proof is an absence.

---

## ITEMS 51 AND 52 — R-014/R-013 AT SCALE, AND R-070 CLOSED

**⚠ THE INBOX MARKS ARE OWED, NOT SKIPPED.** `docs/SEAT_INBOX.md` was MODIFIED
in the working tree by another seat at commit time, and it is the one file that
has already cost this repo 720 deleted lines and a 27-file sweep. **Marks owed:
item 52 -> ✅ CLOSED (R-070 shipped `70e91a0f`, row already flipped by another
seat); item 51 -> worked, ratchet landed, composer named as the remainder.**

### ✅ ITEM 52 — ALREADY DONE. Shipped `70e91a0f` this session; the registry row
reads `BUILT` and was flipped by the seat holding the file.

### ITEM 51 — TWO OF ITS THREE CLAIMS WERE WRONG, AND THE THIRD IS EXACT

Item 50 orders: *"open the code first; if it is enforced, fix the ROW, not the
app."* Done, and it changed the unit.

| item 51's claim | measured |
| --- | --- |
| *"`maxExercisesPerStrengthSession` has ZERO readers"* | **REFUTED** — one production reader, `coachingEngine.ts:8846`. The dead end is ONE HOP LATER: `AIConstraints.maxExercisesPerSession` is written and never read, **and `sessionRowCounting.ts:309` already says so in its own words**. |
| *"the prompt never mentions his ladder"* | **NOT ESTABLISHED BY ME.** The measured fact is the cap reaching nothing; I did not read the prompt builder and am not claiming it either way. |
| *"eleven 3-row fallback branches still ship"* | **EXACT.** 15 branches: one 2-row, **eleven 3-row**, one 4-row, two 5-row. |

### THE REAL FINDING — THE R-014 GUARD IS GREEN AND NARROW

`test:slot-coverage`'s SLOT CENSUS holds **0 deficient**, and its comment says
*"zero is the floor — this may now only be held."* **True, over THREE worlds at
ONE week.** The same oracle over **174 worlds** (3 phases x 5 training-day counts
x club/no-club x 3 kits x 2 weeks):

    DEFICIENT: 50 of 216 laddered days (23%), 5 distinct shapes
    laddered-day row counts: {3: 126, 4: 12, 5: 50, 6: 28}

**126 of 216 laddered days ship THREE rows into a FIVE-slot ladder.** Three rows
cannot cover five slots; that is arithmetic, not tuning.

**ALL FIVE SHAPES ARE THE SAME DAY** — `Lower Squat`, in two variants: two hinges
and no single-leg hip, or a squat day with no squat and its knee work doubled.
**Upper days are CLEAN at HEAD**, which is the opposite of what item 51 implies
and narrows the composer's first job to one session kind.

**LANDED: `test:ladder-wide`**, 5 cells, in the `test:bible` chain, ratcheted at
50. **A SECOND CENSUS, NOT A RIVAL** — raising the narrow one's ceiling from 0 to
50 would have destroyed a real held property to record a new finding.

### ⚠ MY FIRST NUMBER WAS 148 OF 318 AND IT WAS FROM A WORLD THAT IS NOT IN GIT

The shared checkout held another seat's uncommitted `defaultProgram.ts`, and that
one file moved both the deficient count and how many days are laddered at all.
**The mutation run is the only reason it was caught**: the RESTORED baseline in a
clean worktree disagreed with the live tree. **A ratchet calibrated to a dirty
tree pins a number the chain can never reproduce.** Every figure is now taken at
HEAD, and the suite says so.

**THIS IS SIGHTING FOUR TODAY of "a conclusion outlives the world it was measured
in"** and the second time *I* have done it. **The transferable rule: a number
that will become a CEILING is measured in a detached worktree at HEAD, never in
the shared tree.**

### FOUR MUTANTS, AND ONE SURVIVED UNTIL THE GATE WAS FIXED

| mutation | result |
| --- | --- |
| ceiling 50 -> 49 | **RED** — the ratchet is live |
| the world loop builds nothing | **RED**, 3 cells |
| the corpus collapses to one kit | **RED**, 2 cells |
| **the oracle blinded — every day reads clean** | **SURVIVED, 4/4 GREEN at "0 deficient of 216"** |

**A CEILING-ONLY RATCHET CANNOT TELL "WE FIXED IT" FROM "WE STOPPED LOOKING."**
Fixed by adding the lower bound `rulingRegistryTests` already uses: the count
falling below the ceiling by more than 10 REDS, with a message telling the author
to bank the win by lowering the ceiling. Re-mutated — it now dies. **Every
ratchet in this repo with a non-zero ceiling has this hole unless it has that
second cell.**

### NOT COVERED

- **THE COMPOSER IS NOT BUILT, and this suite is not it.**
  `sessionSlotCoverage`'s header has always said *"the composer is the next unit
  and this is its oracle."* Still true. What landed is the RATCHET that makes the
  composer's progress visible and stops the number climbing while it is written.
  **The first job is one session kind — `Lower Squat` — and the 11 three-row
  fallback branches.** It changes generated output and owes `test:scenarios` +
  `test:qa` either side.
- **`test:bible` not run end to end**; `test:ruling-registry` [3] still RED,
  pre-existing and untouched.
- **The inbox marks above are owed** — the file was held.

---

## R-033 — THE EXISTING-WEEK GATE. IT IS RED, AND THE RED IS THE POINT.

**SAM'S ORDER, direct:** *"he is never the test rig, his phone is the last
instrument. A change that alters an EXISTING week is unverified until it has been
seen on a week that already existed — not a freshly generated one. That is
unenforced as a gate today, and it is why two days of away-flow work looked done
and was invisible. Build the gate. Prove it with a mutation."*

**LANDED:** `test:existing-week-proof`, 10 cells, in the `test:bible` chain.
R-033 moves `UNENFORCED as a gate` -> `BUILT`.

### THE GATE IS A TWO-ROUTE AGREEMENT

| route | what it is | who proved it before |
| --- | --- | --- |
| **A — BUILT WITH** | generate the week with the fact already live | every existing suite |
| **B — BUILT BEFORE** | generate with NO fact, accept it, THEN land the fact | **nothing** |

Route B is the athlete. It goes through `rebaseAcceptedEffectiveWeek` — this
repo's *"sole precedence owner for a currently accepted athlete-visible week"*.
**The assertion is that A and B agree.** A change reaching only newly built weeks
makes them disagree, which is Sam's mutation criterion stated as a cell.

### THE DEFECT, REPRODUCED IN A TEST FOR THE FIRST TIME

    route A (built with the answer):  team=[] game=[]        ✅
    route B (the week he already had): team=["Team Training + Upper Pull",
                                             "Team Training + Upper Push"]
                                       game=[]               ❌

**A pre-existing away week LOSES ITS FIXTURE AND KEEPS ITS CLUB NIGHTS.** That is
item 30's glass evidence word for word (*"Tuesday the 22nd and Thursday the 24th
still read Strength + Team Training"*), now in a suite instead of a screenshot.
**8 of 10 cells pass; the 2 that fail are the app, not the gate.**

### THE FIX SITE IS NAMED BY MUTATION, NOT BY READING

Blinding `derivedWeekContract.ts:85`'s travel filter reds the half that currently
PASSES (the fixture) plus the liveness cell. **So that filter is what takes the
game off a pre-existing week, and there is no equivalent for team days.** The
fix belongs to whoever holds `coachingEngine.ts` — item 30 records it HELD, and I
did not enter it.

### ⚠ I MANUFACTURED THIS DEFECT TWICE BEFORE MEASURING IT

Both are written into the suite so nobody repeats them.

1. **WRONG VOCABULARY.** I copied the travel fixture from `awayFlowTests`, which
   builds the LEGACY `ActiveConstraint` shape (`type`/`startDate`/`expiresAt`)
   because it feeds generation. The READ door filters on `factKind: 'schedule'`
   with `effectiveFrom`/`effectiveUntil`. **My object matched nothing and route B
   looked totally inert** — I would have reported "the away answer never reaches
   an existing week", which is worse than the truth.
2. **A PROJECTION SUBSTITUTED FOR THE REAL INPUT.** Fixing (1), I fed both routes
   one fact via `composeTemporarySourceFactCompatibility`. **The CONTROL then
   failed**: the projected constraint does not clear club nights at generation,
   though the hand-built one does. I would have been measuring my projection.

**THE CONTROL CELL CAUGHT BOTH.** Route A must pass before route B's failure
means anything — otherwise "the feature is absent" reads as "R-033 is breached".

**AND A REAL FINDING FELL OUT:** the two doors speak TWO SPELLINGS of one athlete
answer. Generation reads `type`/`startDate`/`expiresAt`; the read door reads
`factKind`/`effectiveFrom`/`effectiveUntil`. One answer, two shapes, each
understood at only one end — that is a defect waiting to happen again.

### AND MY OWN LIVENESS CELL WAS WRONG FIRST

It compared TEAM DAYS ONLY and failed for the wrong reason: the answer DOES reach
the pre-existing week — it removes the fixture — so comparing the one field the
defect lives in made a WORKING half of the read door look inert. It now compares
a whole-week signature, which tells "ignores the answer entirely" apart from
"half-applies it".

### NOT COVERED

- **THE FIX IS NOT MINE AND IS NOT MADE.** `coachingEngine.ts` is held per item
  30. The gate names the site; the repair is the holder's.
- **ONE DOOR, ONE FACT.** Only the travel/away fact is driven. Christmas break,
  equipment and illness are the same shape and are one row each in this suite —
  **not added blind**, because each needs its own control cell proving the fact
  bites on a fresh week first.
- **`test:bible` is now RED for a true reason.** It was already red
  (`test:ruling-registry` [3], another seat's). This adds a second, and LAW ZERO
  is explicit: a first-run guard failure is reported the moment it appears, never
  fixed quietly and never deferred.
- **No glass.** The proof is a suite, which is the entire point of the ruling.

---

## THE PARTIAL-RESTORE PREMISE IS REFUTED — NOTHING WAS DROPPED

**SAM'S ORDER:** *"this was built and then destroyed … the game half came back,
the club-nights half did not. Diff `ff885cdb`'s version of `sessionResolver.ts`
against what is there now, put back only what the restore dropped."*

**I DID THE DIFF. THERE IS NOTHING TO PUT BACK.** The symptom he describes is
real — my gate reproduces it — but the cause is not a partial restore.

| measured | then (`ff885cdb`) | now |
| --- | --- | --- |
| `applyAwayPass` body | 42 lines | **101** |
| call sites | 1 | **3** |
| club half (`isTeamTrainingOnly`, `hasTeamTraining`) | present | **present** |
| the other 3 files it touched | +70 lines | **every line still there** |

The current pass is a **SUPERSET**: it gained the rest-day fix Sam asked for
after (*"why the fuck does it read training day?"*) and the combined-day name
strip. **All four of `ff885cdb`'s files still carry every line it added** —
checked line by line, not by reading the commit messages.

### THE REAL CAUSE WAS ALREADY MEASURED, TWO HOURS BEFORE I STARTED

`8a2f5ef2` — *"THE READ FILTER NEVER RUNS ON THE PROGRAM TAB — measured, and I
am not closing this out"*. A probe on a real device, through the real flow:
`applyAwayPass` **never fired once**, while a control probe elsewhere did. Its
own conclusion: *"I HAVE BEEN FIXING THE READ IN THE WRONG READER."*

**MY GATE INDEPENDENTLY CONFIRMS IT, AND ADDS THE PART THAT WAS MISSING:**
`rebaseAcceptedEffectiveWeek` does not import `sessionResolver` **at all**. So:

- the **game** disappears from a pre-existing week because `derivedWeekContract`
  has its OWN travel filter on that path — proven by mutation, blinding it reds
  the passing half;
- the **club nights** survive because the only code that removes them lives in a
  reader the athlete's week never goes through.

**That is why it looks exactly like half a restore and is not one.** Two halves,
two different mechanisms, one of them wired and one of them orphaned.

### WHAT I BUILT INSTEAD OF A REBUILD

Block `[4]`, three cells, **whose whole job is to stop a fourth rediscovery**:
`applyAwayPass` still exists (do not rebuild it); it still handles the club half
(if THAT reds, *then* it is a partial restore); and the accepted read door does
not reach the resolver — the actual gap, now a cell instead of a device probe.

**THE SUITE IS 11/13.** The 2 reds are the app.

### SAM'S STANDING ORDER, AND IT PAID IMMEDIATELY

*"The agents need to read through what we've already fixed and find if it's spelt
differently or worded differently but stands for the same thing."*

**Searching the log for the WORDING rather than the FILE is what found
`8a2f5ef2`** — its subject says *"read filter"* and *"program tab"*, and it
contains neither "away pass" nor "restore". Grepping for the thing I was about to
build found the seat that had already proved it could not be built there. **Cost:
one command. Saved: rebuilding a working 101-line function.**

### NOT COVERED

- **THE FIX IS STILL NOT MADE AND IS STILL NOT MINE.** Wiring the away pass into
  the accepted read door is an architecture change to the one path every week is
  drawn through, not a restore. It belongs with item 30's owner.
- **The registry row was NOT updated with this refinement** —
  `docs/RULINGS_REGISTRY.md` carries another seat's uncommitted R-086 and
  committing it would sweep their work. The row as committed still points at the
  right place; this file carries the refinement.
