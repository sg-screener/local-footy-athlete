# TERMINAL — your own status file. ONE WRITER: you.

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

### ⚠ THE SEAT HOOK'S AWAITING-SAM EXIT IS DEFEATED BY A NEIGHBOUR'S COMMIT

**`scripts/seat-inbox-hook.sh:210` reads `git show HEAD --unified=0 -- $inbox`.**
It looks at the DIFF OF THE SINGLE NEWEST COMMIT. In a three-seat shared
checkout that is a race: I wrote two compliant `## AWAITING SAM` entries this
turn, both carrying `REGISTRY-GREP:` lines (`0a928eff`, `140e47c5`), and both
were voided the moment the desktop committed `20c73470` and `8ac581dd` on top.
**The exit condition was met and could not be taken, because someone else
committed.**

**IT IS A TIMING DEFECT, NOT A POLICY ONE.** The gate's intent — a question
reaches Sam only with a stated registry grep — is right and I am not arguing
with it. What is wrong is that the evidence is looked for in one commit rather
than in the FILE, so the busier the checkout the less the exit works.

**⚠ I HAVE NOT FIXED IT, DELIBERATELY, AND THE REASON MATTERS MORE THAN THE
BUG.** This is the hook that decides when MY turn may end. An agent quietly
editing the gate that is blocking it is indistinguishable from an agent
loosening its own leash, whatever the diff says. **Sam built this at his own
insistence that it be "a mechanism and not an instruction"; the mechanism
belongs to him and to the seat.** Recording it and continuing to work is the
honest move.

**THE SHAPE OF A FIX, for whoever owns it:** compare the AWAITING SAM section
against its content at the turn's START (the hook already keeps state under
`.claude/` for its exit-4 loop breaker), or scan the last N commits by this
agent, rather than `HEAD` alone. Either keeps the grep requirement exactly as
strict.


### ⚠ A LEG DAY SHIPS THREE SQUATS, TWO OF THEM THE SAME ROW — PRE-EXISTING

**Bodyweight off-season, 4-day, `2026-07-13`:**

    d4 "Lower Squat"  Bodyweight Squat · Glute Bridge · Bodyweight Squat ·
                      Single Leg RDL · Leg Extension · Back Squat

**`Bodyweight Squat` appears TWICE in one session, alongside `Back Squat`.** That
is three squat-pattern rows on one day and a literal duplicate row, against
`:227` — *"an athlete is better served by a squat and a hinge than by two
squats."*

**CONTROL-RUN, AND IT IS NOT MINE:** reverting `exercisePoolsStrength.ts` to
`bf1681c1^` (before the muscle-group rule) produces **the same duplicate**. It
predates today's pool work entirely.

**AND THE TWO THINGS MY GROUPING DOES CHANGE IN THIS WORLD ARE BOTH
IMPROVEMENTS**, which is the useful half of the control:

| day | before grouping | after |
| --- | --- | --- |
| d2 Upper Push | `Banded Bicep Curl` | **`Band Pull-Apart`** — shoulder work on a push day |
| d4 Lower Squat | `Nordic Lower` (hamstring) | **`Leg Extension`** (quad) — the quad stays a quad |

**⇒ CAUSE FOUND, AND IT IS EQUIPMENT, NOT GROUPING.** Instrumented every
rotation rewrite in that week:

    ROT Reverse Lunges -> Bodyweight Squat  [squat/accessory]
    ROT Back Squat     -> Bodyweight Squat  [squat/accessory]

**Two different source rows rotate to the SAME name, in the same (slot, role),
on the same day.** `Back Squat` is an ANCHOR — it lands in the accessory pool via
the `[pool-equipment-role-fallback]` path, because bodyweight-only equipment
filters the squat anchor pool to zero legal entries.

**SO WITH RESTRICTIVE EQUIPMENT THE POOL COLLAPSES TO ONE LEGAL OPTION AND
WITHIN-SESSION AVOIDANCE HAS NOWHERE TO GO.** `selectPoolEntryAvoiding` falls
back to the rotation-indexed entry when every candidate is avoided or filtered —
which is the right behaviour for "no alternative exists" and the WRONG behaviour
for "so print it twice". **Nothing downstream de-duplicates the session.**

**THIS PROBABLY UNIFIES BOTH REPORTS.** The desktop's two leg days carrying
IDENTICAL accessories is the same shape one level out: when equipment leaves few
legal entries, every day converges on the same handful. **Not proven across their
world — stated as the hypothesis to test first, not as a conclusion.**

**THE FIX IS A DECISION, NOT A PATCH:** when a session has no distinct legal
alternative, is the honest answer to REPEAT the row, DROP it, or SHIP SHORT?
Sam's `:227` says a day is judged by pattern coverage, and `sessionSlotCoverage`
already returns `duplicated: ['squat']` for exactly this — **the oracle names the
fault and nothing consumes it at build time.** Same gap as the composer: the app
can SEE this and does not act.

**⚠ AND THIS IS ADJACENT TO, NOT THE SAME AS, THE DESKTOP'S REPORT.** They found
both leg days carrying IDENTICAL four accessories in golden scenario 3; I could
not reproduce that world from a profile and measured a different one. **Two
findings, both real, and I have not shown they share a cause.**


### ⚠ CORRECTION — "THE APP PRESCRIBES NO SPRINT WORK AT ALL" IS WRONG. IT DOES.

**I claimed that in `7739e67f` and it is overstated. Measured properly, on
worlds I had NOT run when I said it:**

| world | speed blocks |
| --- | --- |
| **no club, PRE-SEASON** | **1 — `true_speed` on day 1** |
| no club, in-season | 0 |
| no club, off-season | 0 |
| WITH a club (pre-season 1 & 2 nights, in-season) | 0 |

**My error was generalising from club worlds only.** Every world in the first
sweep had a club; I never ran a no-club world for `speedBlock` before writing
"never, by any route". The sprint top-up is real and it fires.

**THE ACCURATE FINDING IS NARROWER AND SHARPER: the app places sprint work only
when there is no club AND it is pre-season.** The gates are at
`coachingEngine.ts:~5947` and they are the reason —
`if (session.isTeamDay) return false`, then the day BEFORE or AFTER a team day,
then game day / G-1 / G-2. **In a 2-team-night club week with a Saturday game
every single day is excluded**, so a club athlete gets none and the anchors cover
the requirement instead.

**AND `isTeamDay` IS EXACTLY THE GATE SAM'S CLAUSE 3 OVERTURNS** — *"in pre
season you can do flying sprints when there is team training because you will get
accelerations at footy"*. That is one named line, and it is the buildable half of
his ruling.

**⇒ AND THE "WHY" IS ANSWERED: THE FREE DAYS ARE NOT REFUSED — THEY ARE NEVER
CONSIDERED.** Instrumented the sprint-rescue condition
(`coachingEngine.ts:5894`) and ran both worlds:

    PRE-SEASON no club   SPRINT-GATE useCategoryPlanner=true alreadySprint=false
                         allowStandalone=true reason=preseason_shortfall   -> sprint placed
    IN-SEASON  no club   (no line printed at all)

**The probe sits on the `if` itself, so silence means the ENCLOSING PATH NEVER
RUNS IN-SEASON.** Every day-level gate I read first — `isTeamDay`, the
adjacent-day rule, game/G-1/G-2, the upper-day requirement, the lower-day
predecessor — is downstream of a block that is never entered. **I spent four
reads on eligibility rules that were never consulted.** The `sprintExposureGate`
itself is innocent: it answers `inseason_shortfall` / `allowStandaloneSprint:
true` when asked, and in-season it is not asked.

**SO THE GAP IS STRUCTURAL, NOT A THRESHOLD.** A no-club in-season athlete gets
zero sprint against `required: 1`, cell `9j` proves the week raises a BLOCKING
shortfall, and the only code that could fix it does not execute in that phase.
**Next: find what makes the enclosing path pre-season-only, and decide whether
in-season no-club should reach it.** That is a real product question — in-season
sprint is normally the club's job (which is why the path is where it is), and the
no-club athlete is the case nobody wrote.

### 2026-08-13 — R-079 BUILT (`0dc40d0c`, `ff31d40c`). ~~AND THE APP PRESCRIBES NO SPRINT WORK AT ALL~~ — struck, see the correction above.

**Sam's clause 3 — *"in pre season you can do flying sprints when there is team
training"* — is MOOT IN PRACTICE, and that is the finding.** Measured across
pre-season (1 and 2 team nights) and in-season (2 team nights + game), two weeks
each, checking **every route sprint work could arrive by**:

| route | result |
| --- | --- |
| `workout.speedBlock` | **0 in every world** |
| `conditioningCategory === 'sprint'` | **0** — pre-season conditioning is `aerobic_base` |
| rows named sprint/accel/flying/tempo | **0** |

**So the app never PRESCRIBES sprint work. Every sprint credit in the ledger
comes from a team-training anchor** (`kind: anchor.kind`, evidence
`normal_unrestricted_participation`). His permission to put flying sprints on a
team night cannot fire, because there are no flying sprints to place.

**AND THE VOCABULARY CANNOT EXPRESS HIS DISTINCTION EITHER.** `SpeedWorkKind` is
`true_speed | repeated_sprint | cod` — **there is no `acceleration` kind.** His
rule separates `top_end_speed` on a team night (allowed) from `acceleration` on a
team night (the duplication he is avoiding); the second half has no word in this
app. **Clause 3 is therefore UNENFORCED and not merely unbuilt — recorded on
R-079's row rather than left to be rediscovered.**

**⚠ THE NEXT QUESTION, AND IT IS THE SHARP ONE:** every phase's contract sets
`sprint.required: 1`. A CLUB athlete meets it from anchors alone. **A NO-CLUB
athlete gets zero sprint work and the contract requires one — does §18 raise
`required_minimum_shortfall` on sprint, or is it silent?** If silent, the app
owes a weekly exposure it never delivers and never reports. **Measure that
first; it is one evaluator call.**

**MY EARLIER PROBE WAS WRONG AND THIS REPLACES IT.** In `0dc40d0c` I reported
sprint nights as "not measured" because a name-regex probe returned 0 everywhere
and I assumed the instrument was at fault. **The instrument was crude but the
zero was REAL** — there genuinely are no sprint rows. Fourth instrument scare
today, and the first where the instrument turned out to be right.


### ⚠ DO NOT RE-RECORD `test:power-counting` YET — I FOUND A CHANGE I CANNOT EXPLAIN

**The desktop refused to bless this golden and was RIGHT to.** Its diff is 201
entries; a re-record claims all 201 are correct. **Attributed by control runs,
uncapping the suite's own 25-diff display limit (which is what made everyone
reason from a truncated sample):**

| tree | diffs |
| --- | --- |
| none of my code | **38** |
| all of mine except the region fix (`58641537`) | **145** |
| all of mine | **201** |

**MOST OF IT IS EXPLAINED AND CORRECT:**
- `3 -> 5` strength days — `c69151d9`'s `:227` fallback, gaining `Single Leg RDL`
  and `Leg Extension`.
- `Bicep Curl (Barbell) -> Lateral Raise`, `Bicep Curl (Dumbbell) -> Incline Y
  Raise`, `Hammer Curl -> Single-Arm Shrug` — the group-aware rotation
  (`bf1681c1`) keeping shoulder work on push days.
- `6 -> 5` days losing `Face Pulls` from a LOWER day — the region fix, correct.

**AND THE `"Back Squat" -> undefined` SCARE IS AN INDEX SHIFT, NOT A LOSS.** Every
one of those is `strengthRowNames.5` on a day that went 6 -> 5 rows: removing
`Face Pulls` at index 2 shifts everything up one, so the squat moves 5 -> 4 and
index 5 empties. **The squat survives. The removed row is always `Face Pulls`.**
Answering the desktop's exact question: it is (a), not (b).

**⚠ BUT ONE CHANGE IS MINE AND I CANNOT YET NAME WHICH COMMIT, AND IT IS NOT A
ROW — IT IS A WHOLE SESSION CHANGING TYPE.**
`scenarios.3.weeks.2.days.1`:

    "Prehab & Accessories" / Strength / 5 strength rows
      (Bird Dog, Lateral Lunge, Scap Push-Up, Single-Leg Calf Raise,
       Swiss Ball Hamstring Curl)
    ->  "Mobility" / Recovery / 0 strength rows, 6 total

and the week's counts move with it — `recoverySessions 1 -> 2`,
`byCategory.prehab 1 -> undefined`, `byCategory.recovery 1 -> 2`.

**⇒ BISECTED AND ATTRIBUTED: it is `bf1681c1`, the GROUP-AWARE ROTATION.**
Three files reverted together at each point, restore byte-verified every time:

| tree | total diffs | prehab-day lines |
| --- | --- | --- |
| none of my code | 38 | **0** |
| `9b19244f` (drift ladder only) | 60 | **0** |
| `b4ec714b` (+ region fix + R-076) | 201 | **0** |
| HEAD (+ grouping) | 201 | **11** |

**⚠ AND THAT IS THE WORRYING PART, NOT A RELIEF. A ROTATION CHANGE MUST NOT BE
ABLE TO CHANGE A SESSION'S TYPE.** `applyPoolRotation` picks WHICH VARIANT of an
exercise a row gets. It has no business turning a `Prehab & Accessories` /
Strength day into a `Mobility` / Recovery day, or moving the week from 1 recovery
session to 2. That it can means something downstream classifies a session FROM
ITS CONTENT, and a variant swap is enough to re-type the day.

**WHY IT IS NOT REVERTED:** `bf1681c1` fixes measured, athlete-visible defects (a
bicep curl as a PUSH day's accessory; `Bicep Curl | Bicep Curl | Hammer Curl`
with no triceps), and **every guard is green** — scenarios 64/1 unchanged, pools
479/0, slot-coverage 49/0, away-flow 49/0, conditioning-templates 91/0, typecheck
459. Reverting reinstates known defects to hide an unexplained one.

**⇒ AND THE MECHANISM IS FOUND. IT IS NOT A BUG — IT IS A STATED RULE, and the
code names it in its own reason strings** (`workoutCanonicalisation.ts:961-982`):

    type_changed   reason: 'final_component_structure_owns_type'
    name_changed   reason: 'final_content_owns_name'

**A SESSION'S IDENTITY IS DERIVED FROM ITS ROWS, BY DESIGN.** The canonicaliser
re-types and re-names a workout from whatever content survives it. So when the
day's five rows stopped counting as strength, `hasStrength` went false, the day
became `Recovery`, and the rows were re-emitted as the `Mobility` add-on
(`:985-995`). Nothing "deleted" the prehab session — **it was renamed by its own
content.**

**THAT IS THE ARCHITECTURE FINDING, and it is exactly the north star's shape:**
identity is DERIVED, not stored, which is right — but it means **every change to
what lands in a day is a change to what the day IS.** A variant swap is enough.
Rotation, drift removal, an accessory exemption: all of them can re-type a
session, and none of them look like they should.

**WHAT IS STILL OPEN, and it is the narrow question now:** why did those five
rows — `Bird Dog`, `Lateral Lunge`, `Scap Push-Up`, `Single-Leg Calf Raise`,
`Swiss Ball Hamstring Curl` — stop counting as strength when grouping landed?
`countedRows.strength` went 5 -> 0 in one step, which is a WHOLESALE
reclassification, not one row moving. **Start at `classifyRow` /
`participatesInCounting` with that day's rows, before and after `bf1681c1`.**
A single rotated name cannot explain five rows changing bucket, so either the
classification reads the DAY (a feedback loop), or one row's move flipped a
day-level branch. It may even be an IMPROVEMENT — those five rows are prehab
movements, not strength, and the day gained a row — **but I did not intend it,
cannot yet explain it, and a golden re-record would bury it under "regenerate,
looks routine" forever.**

**NEXT SESSION STARTS HERE, and it is cheap:** bisect all three files
(`workoutCanonicalisation.ts`, `sessionSlotCoverage.ts`,
`exercisePoolsStrength.ts`) across `9b19244f` / `b4ec714b` / `bf1681c1` and name
the commit. Then decide improvement-or-defect on the merits, and only then
re-record. **The suite's 25-diff cap hid this for two sessions — raise it while
you work.**


### 2026-08-13 — R-076 LANDED (`b4ec714b`). NEXT: SUB-GROUP `isolation_upper`.

**Sam ruled: *"face pull is shoulder work for sure"*.** Face Pull, Rear Delt Fly
and Band Pull-Apart moved out of `horizontal_pull/accessory` into the
`isolation_upper/accessory` shoulder block. **A pool slot is an
INTERCHANGEABILITY claim** — rotation swaps freely inside a (slot, role) pair —
so filing a face pull beside `Seated Cable Row` said they were substitutes.

**MEASURED OUTPUT-NEUTRAL ON ITS OWN.** 3 worlds x 3 weeks, generated names
byte-identical. It is a PREREQUISITE, not a fix — the name-lookup miss still
masks rotation here.

**⚠ THE LOOKUP FIX IS REFUTED FOR THE SECOND TIME, AND THE NEW REASON IS THE
NEXT UNIT.** Re-applied on top of R-076 and measured:

| before | after |
| --- | --- |
| `… Face Pulls` | `… Bicep Curl (Barbell)` |
| `… Bicep Curls \| Tricep Pushdowns` | `… Bicep Curl (Barbell) \| Bicep Curl (Dumbbell) \| Hammer Curl` |

**Three bicep curls and no triceps** — his two-squats shape in arm form.

**THE CAUSE: `isolation_upper/accessory` is ONE pool holding THREE muscle
groups.** The file's own comments name them (`// Bicep block`, `// Tricep
block`, `// Shoulder / trap block`) and rotation ignores all three, so it will
happily swap a tricep pushdown for a bicep curl. **`isolation_lower` already has
the pattern to copy** — `exercisePoolsStrength.ts:436` documents rotation order
groups (hamstring -> quad -> calf/ankle). Do the same for upper, THEN close the
lookup miss, THEN re-run the composer before/after.

**THE ORDER MATTERS AND IT IS NOW PROVEN TWICE:** the lookup miss is
load-bearing — it is accidentally protecting rows from a rotation that would
spoil them. Fix the POOL first, every time.

### WHAT I DID *NOT* TOUCH, DELIBERATELY

`Face Pull`'s `tag.movement` is still `horizontal_pull` in `exerciseTags`. Sam
ruled INTERCHANGEABILITY (which pool), and the pool move is what stops the bad
swap. The tag feeds injury filters and scoring, so changing it is a separate
unit with its own measurement. `slotsFilledByRow` already returns
`arm_or_shoulder` for it via the pool role, so nothing downstream needs the tag
to move today.


### 2026-08-13 — NOW: starting item 34 (pattern coverage / census C7)

**Lane: the rules engine.** Away, screens and flows are the desktop's — including
item 37/R-075, which I wrongly claimed for ninety minutes and have handed back.

---

### ⚠ I CAUSED THE ~26-FILE SWEEP THIS FILE WAS CREATED FOR. `b62add9f`.

**Written here in full because the header above cites it as measured cause and a
future session should be able to read what actually happened, not just the size.**

I meant to commit a comment-only change to one test file. I ran
`git add <one path> && git commit`. **`git commit` commits the INDEX, not the
path you just staged**, and in this shared checkout the index already held
another session's staged reverts and deletions. 37 files, 3421 deletions,
undoing work already on main: `c69151d9`'s `:227` lower fallback, `c086ca3d`'s
COD work, `sessionSlotCoverage.ts` + its suite deleted outright, the pre-commit
hook and branch-verify script deleted.

**I found it only by luck** — a byte-compare of an unrelated file came back DIRTY
at the end of the turn. My commit message said "comment only" and was false.

**THE FIX THAT ACTUALLY WORKS, and it is one line: read
`git diff --cached --stat` BEFORE every commit.** Not after, not as a receipt in
the message. If the file count is not what you intended, stop.

**RECOVERY, if it happens again** (`df380518` did this, 27 files, +1918):
- **The DISK is usually untouched — only the stale index was committed.** So
  `git add` the disk copies back.
- **Do NOT `git checkout <ref> -- <paths>`.** Sam ruled this on 2026-08-13 and he
  was right: 3 of the 28 files carried NEWER in-progress work a checkout would
  have destroyed. The permission classifier blocked my checkout and the block was
  correct.
- **Measure before staging:** compare each file's disk copy against both the
  pre-damage blob and HEAD. Mine came out 25 identical / 3 newer / 0 stale.
- `git add` with an unquoted newline-separated list is read by zsh as ONE
  pathspec. Use `git add --pathspec-from-file=<file>`.
- A stale `.git/index.lock` with no `git` in `ps` is safe to remove. Check `ps`
  first — a neighbour mid-commit is not stale.

**STILL OPEN FROM THE SWEEP, and it is the last piece:**
`src/__tests__/rulingRegistryTests.ts`. Its disk copy was the DAMAGED one, so
Sam's "don't overwrite disk" rule blocked my restore route. **It has since been
restored to 13 by someone else** and `[2]` passes — but R-073 is now BUILT (see
below), so the honest count is 12 and the ceiling should fall in the commit that
paid it. **Not yet done. Small.**

---

### LANDED TODAY (terminal)

- **R-073's LOCK — `1a04fd08`.** `test:section18-safety` 37/0, mutation witnesses
  6 -> 7. Sam: *"yeah well that sounds shit and not good"* on a cut made without
  proof. **The producer was NOT touched** — the ruling gained a gate, per the
  registry's own order.
  **⚠ MY FIRST VERSION WAS A BLIND GATE AND ITS MUTANT SURVIVED.** A no-injury
  fixture never reaches the producer at all — it sits inside
  `if (prohibited.length > 0)` (`section18SafetyPolicy.ts:269`). The defect needs
  BOTH halves: an injury prohibiting SOME patterns AND a mode with
  `strength.required === 0`. Fixture is `early_offseason` + a PARTIAL lower-body
  injury; push and pull stay safe, so the honest answer is no cut. Re-mutated
  after rebuilding: it reds. **Cell `R-073c` states in the file that it CANNOT
  kill that mutant**, rather than being credited with more than it holds.

- **`c69151d9` IS NOT OUTPUT-NEUTRAL — `b62add9f`, single-variable measurement.**
  Revert ONLY `defaultProgram.ts` to `c69151d9^`: home 21 both arms, away
  22 -> 21. The `[13d]` away red and `test:power-counting`'s moved golden are the
  SAME cause. The 11-for-11 away row swap is present in BOTH arms, so it is not
  what moved.
  **`test:power-counting`'s golden is STILL UNCLAIMED by either agent.** I hold
  the cause; neither of us has re-blessed it.

- **The owner ratchet — `59d121c3`**, and it reddened within hours on item 37
  naming nobody. Also carried the three `LAW-visible-first` cells, which
  `lawRegistry.ts:1277` had been claiming as `guarded` while the cells themselves
  were uncommitted.

### ITEM 34 — THE DRIFT HALF IS BUILT (`9b19244f`). THE COMPOSER HALF IS NOT.

**WHAT LANDED:** `patternsCompletingLadder` in `sessionSlotCoverage.ts`, read by
`main_pattern_drift`. Drift is now measured against **the day's ladder**, not its
main lift, so the fallback's hinge survives on a squat-led day. Away drift drops
**1 -> 0**; `test:scenarios` 64/1 in BOTH arms (control-run, pre-existing
`GAME-MOVE-SAT-TO-FRI`); typecheck 459, no regression. Mutation: strip the ladder
expansion and 3 cells red.

**⚠ THE AWAY SUITE DOES NOT HOLD THIS FIX.** Under the mutant `test:away-flow`
stays GREEN at 46/0, because `[13d]` is a one-sided floor and losing the hinge
does not push the away week below the home week. **`test:slot-coverage` is the
only suite that reds.** Do not read away's green as coverage of this.

**IT REACHES THE ATHLETE — measured, not inferred.** The away week's generated
"Lower Squat" day went **5 rows -> 6** and the week **22 -> 23**, which is the
exact number this file predicted before the fix was written. The hinge is on the
day now.

**R-014 STAYS `UNENFORCED`, HONESTLY.** It asks that a session be COMPOSED by
pattern; nothing composes yet. This removed the thing DESTROYING coverage — a
step toward the law, not the law.

**⚠ TWO OF R-014's BLOCKERS ARE NOW CLOSED, AND ITS ROW SAID OTHERWISE. I
re-measured instead of believing it:**
1. **The pattern lookup is FIXED.** `getExerciseTags` canonicalises before
   looking up (`exerciseTags.ts:3439`). Probed the 25 names the generator
   actually ships: **24 resolve.** The one that does not is `Short Flush`, a
   CONDITIONING template — absence there is the right answer. **My own previous
   entry said "fix the lookup first"; that was wrong and is struck.**
2. **The hinge-drop hunt is CLOSED.** R-014's row calls it *"the ONE unknown left
   … the whole remaining unit"* and narrows it to a window after
   `applySubphaseMainLiftLoadMultiplier`. That window ends at
   `finaliseWorkoutAfterMutation`'s `main_pattern_drift`, which `9b19244f` fixed.

### THE COMPOSER'S REAL TARGET — 8 PRE-SEASON LOWER DAYS. `97df35e6`.

**FOUR FINDINGS IN THIS SWEEP. THREE WERE MY INSTRUMENT, NOT THE APP.** That
ratio is the lesson; assume the next one is the oracle too until proven.

| | before | after |
| --- | --- | --- |
| days covering every slot | 24 (55%) | **36 (82%)** |
| days with a doubled slot | 12 | **0** |

**THE THREE ORACLE BUGS, all found by MEASURING before building:**
1. **`UPPER_SPLIT_SLOTS` held one direction (push).** Every pull-only day was
   judged against push slots and could not pass at any content. Now
   `upper_split_push` / `upper_split_pull`.
2. **It TALLIED instead of ASSIGNING.** A row filling two slots was credited to
   both and the overlap called a duplicate, so an accessory could never be SPENT
   where the day needed it. Now exact augmenting-path matching — **exact, not
   greedy, because greedy is order-dependent** and a cell feeds the same rows
   reversed to prove the answer holds.
3. **An upper ACCESSORY filled no accessory slot.** `Face Pull` is Sam's *"more
   arm work"*; the pools already say it is an accessory beside `Rear Delt Fly`,
   while `Barbell Row` is the anchor. **The tag was NOT changed** — retagging
   would hit pools, scorer and injury filters to fix one oracle.

### ⚠ FIXING `classifyPoolSlot` AT SOURCE IS **REFUTED** — IT MAKES PROGRAMS WORSE

**TRIED IT, MEASURED IT, BACKED IT OUT. 2026-08-13.** My own previous entry named
this as the next unit. It is wrong, and the measurement is why the change owed
one.

Canonicalising inside `classifyPoolSlot` turns 5 of its 14 nulls into
classifications (`Face Pulls`, `Bicep Curls`, `Tricep Pushdowns`,
`Romanian Deadlift`, `Single Leg RDL`). All five mappings are correct. **And that
is the problem — once classified, `applyPoolRotation` starts SWAPPING them
within their pool slot, and the swaps are bad:**

| before | after |
| --- | --- |
| `Pull-Ups \| Barbell Row \| Face Pulls` | `Pull-Ups \| Barbell Row \| Seated Cable Row` |
| `… Bicep Curls \| Tricep Pushdowns …` | `… Bicep Curl (Barbell) \| Bicep Curl (Dumbbell) …` |

**The pull day loses its shoulder work for a second row. The arm work becomes TWO
BICEP CURLS AND NO TRICEP.** That is Sam's "two squats" shape in arm form, and
the app would have shipped it.

**THE ROOT CAUSE IS NOT THE LOOKUP.** `Face Pull` sits in the pool as
`horizontal_pull/accessory` beside `Seated Cable Row`, so the pool declares them
interchangeable. **They are not** — a face pull is rear-delt work and a cable row
is a row. **The pool's own membership is what is wrong**, and canonicalising just
lets rotation act on it. Fixing the lookup without fixing the pool converts a
silent miss into a live defect.

**SO THE LOOKUP MISS IS LOAD-BEARING RIGHT NOW** — it is accidentally protecting
these rows from a rotation that would spoil them. **Do not "fix" it alone.** The
honest order is: decide the pool membership first (is a face pull a horizontal
pull, or shoulder accessory work?), then canonicalise.

**AND `sessionSlotCoverage`'s LOCAL canonicalise stays** — it only reads, never
rotates, so it gets the right answer without touching what ships. That local/
source split was the cautious call and the measurement vindicated it.

**⚠ THE ORIGINAL SILENT-NULL NOTE, KEPT because the defect is real even though
its fix is not:**
It is an exact-name lookup; the pool holds `Face Pull`, the generator ships
`Face Pulls`, so it returns `null` and the row reads as "not an accessory".
**This is the THIRD sighting of one defect in a day** — R-014 recorded it for
`getExerciseTags` (151 rows resolving to nothing) and that one was fixed AT the
lookup. I normalised LOCALLY in `sessionSlotCoverage` instead, on purpose:
`classifyPoolSlot` feeds rotation and scoring, so turning its nulls into answers
CHANGES GENERATED OUTPUT and owes a corpus measurement. **Fix it at source next,
with scenarios + qa either side.**

**WHAT IS LEFT IS REAL AND IT IS IN ONE PLACE:** 8 `single_leg_knee`, 8
`single_leg_hip`, 4 `squat`, 4 `hinge` — **every one a PRE-SEASON lower day
carrying SEVEN OR EIGHT rows with no single-leg work at all.** Not a size
problem. Sam's point exactly: a long day can still be uneven.

**SO THE NEXT UNIT REALLY IS THE COMPOSER**, with no blocker in front of it —
and R-014's own trace says where NOT to build it: `buildTagAwareSession` and
`exerciseScorer` are **not on the generation path** (one production caller, the
coach-revision path; the top-up block fires zero times in five worlds). Two fixes
have already been spent on layers not in the chain.

**I ALSO WROTE A SECOND COPY OF SAM'S THREE REDS AND DELETED IT.** Section `[2]`
of `sessionSlotCoverageTests.ts` already held all three from the earlier R-014
work. Caught by reading the file header instead of the diff — one-predicate-many-
copies, avoided by inches.

---

### ITEM 34 — THE BEFORE-MEASUREMENT (kept; it is what made the fix cheap)

**THE DRIFT BRANCH FIRES ZERO TIMES ACROSS THE WHOLE QA CORPUS.** Instrumented
`main_pattern_drift` in `workoutCanonicalisation.ts` and ran `test:qa`:

| corpus | drift drops |
| --- | --- |
| `test:qa` (full scenario report) | **0** |
| `test:away-flow` (control) | **1** — `Deadlift`, `intended=[squat]`, `"Lower Squat"` |

**THE CONTROL IS THE POINT — a bare 0 is exactly the shape that means "the probe
never ran".** The away arm printing precisely the one line C7 predicted is what
makes the zero trustworthy rather than vacuous.

**WHAT THE ZERO MEANS, and it cuts both ways:**
- **The blast radius of the fix is SMALL.** This is not a change rippling through
  every generated week.
- **AND `test:qa` CANNOT DETECT A REGRESSION IN IT.** A green corpus either side
  proves nothing about this branch, so "scenarios + qa unchanged" must NOT be
  written up as evidence the fix is safe. The evidence has to be a cell that
  exercises the branch directly.
- **WHY it is zero:** drift only bites when a day's rows carry a pattern the plan
  did not name, and that happens when the DETERMINISTIC FALLBACK fills a day
  (`completeCoachWorkoutsFromPlan`, `fallbackReason: edge_omitted_day`) — because
  the fallback emits Sam's whole `:227` ladder while the plan entry names one
  main lift. In `test:qa` the edge supplies the days, so the fallback never runs.

**THE FIX IS EXPRESSIBLE WITHOUT SPECIAL-CASING, which is what the order
demands.** `sessionSlotCoverage.ts` already holds Sam's three ladders
(`LOWER_SLOTS`, `UPPER_FULL_SLOTS`, `UPPER_SPLIT_SLOTS`) and `SLOTS_FOR_KIND`.
Derive the day's kind from `intendedPatterns`, then admit any row whose pattern
fills a slot in THAT day's ladder:

| day kind | derived from intended | admits |
| --- | --- | --- |
| lower | intended ⊆ {squat, hinge} | squat + hinge |
| upper_full | intended ⊇ {push, pull} | push + pull |
| upper_split | intended is exactly one of push/pull | that direction only |

**Only the lower row changes behaviour** — upper_full and upper_split already
admit exactly what they intend. That is the general rule landing on the one place
the census said it bites, NOT a squat/hinge special case, and if Sam later rules
an upper ladder that admits both directions the same code follows him.

**STILL OWED BEFORE IT SHIPS:** the law row + its guard in the SAME commit
(`LAW-0-registry` forbids a new row entering `UNENFORCED`), asserting his three
reds — a lower day with no hinge, two squats, an upper day missing vertical.

### FOR WHOEVER STARTS ITEM 34

The C7 drop site is named with a receipt in `482e0cb6`: the `main_pattern_drift`
branch in `workoutCanonicalisation.ts` deletes the fallback's hinge **on purpose**,
because the plan entry intends only `squat`. My own probe reached the same
function independently before that commit was read (`5d6ef5fa` is load-bearing
for it). **When C7 is fixed, away-flow `[13d]` stays green — the floor is
one-sided — but the away total becomes 23.**
