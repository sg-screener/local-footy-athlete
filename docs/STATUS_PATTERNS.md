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
