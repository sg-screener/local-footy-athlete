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
