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

### THE COMPOSER'S BEFORE-NUMBER — 24 of 44 days (55%). `b46d1565`.

**AND MEASURING IT FOUND A BUG IN THE ORACLE FIRST, which is the whole reason to
measure before building.** `UPPER_SPLIT_SLOTS` held ONE direction (push) and
`slotDayKindFor` collapsed both into one kind, so **every pull-only day was
judged against push slots and could not cover its ladder at any content.** 12 of
the 20 misses in the sweep were phantom. Fixed: `upper_split_push` /
`upper_split_pull`, each with its own list, mutation-checked.

**THE CORRECTED SWEEP — 5 worlds x 4 weeks, 44 strength days:**

| | |
| --- | --- |
| cover every slot | **24 (55%)** |
| have a DOUBLED slot | **12** (was reported as 0 behind the phantom misses) |

Most-missed: `arm_or_shoulder` 12 · `single_leg_knee` 8 · `single_leg_hip` 8 ·
`squat` 4 · `hinge` 4.

**THE SINGLE-LEG GAP IS THE REAL COMPOSER TARGET.** The `Lower Hinge` and
`Lower Squat` days carry **7-8 rows** and still miss BOTH single-leg slots — so
this is not a session-size problem, which is Sam's whole point (*"the number of
exercises is not important"*). A day can be long and still uneven.

**⚠ AND ONE MISS IS PROBABLY A TAG QUESTION, NOT A COMPOSER ONE — do not build
against it before deciding.** The 12 pull days are `Pull-Ups + Barbell Row +
Face Pulls`, and `Face Pulls` tags as `horizontal_pull`. That reads as
doubled-horizontal + missing-arm/shoulder. **A face pull is rear-delt work**, so
the honest fix may be the tag, not the session. Changing a tag changes every
reader, so it is flagged rather than taken.

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
