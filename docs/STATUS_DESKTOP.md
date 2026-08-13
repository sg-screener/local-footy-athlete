# DESKTOP — your own status file. ONE WRITER: you.

**CLAIMED 2026-08-13 by session `691865a7`, and the claim is reasoned rather than
assumed:** the other two named themselves to me over the wire — `34617` as *"the
terminal"* (rules engine: conditioning selection, `defaultProgram`, §18 safety)
and `88331` as *"second terminal (session -8f)"*. **I am the one driving the
simulator and Maestro**, and the away flow this session continues is recorded in
the inbox as *"OWNED BY THE DESKTOP AGENT, and it found this itself by putting
the away flow on a PHONE"*. `STATUS_AGENT3.md` is therefore `88331`'s to rename.
**If either of them disagrees, this line is the thing to correct.**

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

## 2026-08-13 — AWAY (items 28, 36, 37 / R-075) — session `691865a7`

**WHAT THE ATHLETE CAN SEE NOW, photographed each time:** telling the app he is
away 13-20 July takes the team night off Tuesday and Thursday, takes the game off
Saturday, and **Saturday now carries "Accessories — 5 exercises"** where it used
to read *"Training Day"*. His five own training days are untouched throughout.

### THE THREE THINGS WORTH CARRYING FORWARD

**1. TWO ORDERED FIXES WERE REFUTED BY MEASURING THEM, ON THE SAME DAY.** Item
28's step 1 (*"put travel back on `isRuledDerivingConstraint`"*) and item 36's
(*"assert the athlete's rows are a SUPERSET home->away"*). Both were aimed at
mechanisms that measurement said were not there. **Neither was a bad order — both
were written from totals rather than contents.** Item 28 was decided by
photographing the week both ways; item 36 by dumping the ROWS instead of the row
COUNT. **When an order names a mechanism, print the mechanism before building
against it.**

**2. THE INSTRUMENT CONTROL IS NOW PERMANENT AND IT IS WHY ANY OF THIS READ.**
`[temporary-source-fact] lane` logs on EVERY commit, not only on failure, so **a
run with no lane line is a DEAD INSTRUMENT, not a result.** That single line
withdrew the premise the whole of item 28 rested on: the refusal (*"That didn't
save"*) never reproduced, and two earlier confidently-wrong conclusions had come
from reading an absence with no control.

**3. `git status` IS NOT AN INSTRUMENT IN THIS CHECKOUT AND IT COST REAL WORK
TODAY.** `b62add9f` committed a stale index — 37 files, 3,421 deletions, titled
*"comment only"*. It deleted the entire away read-filter. I read HEAD **three
times** before believing it, then restored from my working copy
(`186c2b1b`), verified as a strict superset (`git diff --numstat b62add9f^ HEAD`
= `+26 / -0`). **Use `cmp` against `git show HEAD:<path>`, and stage-and-commit by
path in ONE command.**

### WHAT I TRIED AND BACKED OUT — so nobody spends it again

- **Travel on the deriving lane** (item 28 step 1). Re-authors the current week,
  but Thu goes `Strength` -> `Rest Day`, the tap takes ~1 min and generates
  **1,220 workouts** — §18's 48-candidate repair search regenerating Thursday
  **616 times** on a club-less bye-build. Backed out; the comment now carries the
  measurement so the line is not ordered changed a third time.
- **Moving `applyAwayPass` BEFORE §18 tier four** (item 37, first attempt).
  Photographed: Saturday stayed empty AND **Wednesday got worse** — core
  `Conditioning` became optional `Accessories`. Reverted.
- **`'rest'` on the vacated day.** Shipped, and Sam overturned it within the hour:
  *"your Saturday Rest Day is the wrong case"*. **`'none'` and `'rest'` are two
  wordings of one hole.**

### R-075 — WHERE IT ACTUALLY LANDED (later, same session)

**THE DAY HALF IS DONE AND ON GLASS.** A vacated Saturday reads *"Conditioning —
2 exercises"* (`400 m Repeats`, CORE); Sunday held nothing and correctly stays
*"Rest Day"*. **No new machinery** — `_resolveDateRaw` already answered *"a game
slot was freed"*; it was gated to a TEMPLATE game with no calendar mark, and an
away-vacated fixture is a MARKED one.

**MY FIRST BUILD PASSED ITS OWN CELL AND WAS STILL WRONG.** It filled the day with
`prehab_accessories` — a substitution in SHAPE, not in KIND: it replaced his
running with arm work. **A cell about "carries work" cannot catch a wrong-kind
fill; [15e] now asserts `workoutType`.** Same lesson as the row-count cell, one
day later: assert the property he actually named.

**THE BLOCK ARITHMETIC IS MEASURED AND IT SPLITS CLEANLY** (2 weeks, 8 club
nights, `test:away-flow` [13g]/[13h]):

| | home | away |
| --- | --- | --- |
| club sessions | 8 | **0** |
| conditioning | 4 | **12** |
| strength sessions | 20 | **16** |
| strength rows | 79 | **72** |

**CONDITIONING HOLDS EXACTLY — 8 removed, 8 back, one for one**, and nobody built
it for this case; it falls out of the plan-side club filter. **STRENGTH IS
BREACHED — 20 -> 16.** Eight COMBINED club days were removed and only four of
their gym halves came back. **That is the whole remaining unit of R-075.**
**The first version of that measurement was WRONG-UNIT** — it tallied
`workoutType`, which reads *"Mixed"* as neither strength nor conditioning when it
is both. Counting EXPOSURES is what turned a confusing tally into two clean arms.

### START HERE NEXT

- **R-075's STRENGTH CONSERVATION — the first thing to build.** Generation-side:
  the plan must keep the strength count when club days go. Owes `test:scenarios`
  + `test:qa` either side. **Do not loosen [13h] to cover it.**
- **THE ONE UNIT BEHIND BOTH ITEM 28 AND R-075's WEEK HALF:** a club-less week's §18 contract
  declares more core conditioning than a bye-build delivers, and the 48-candidate
  repair search cannot close it. **Both away routes dead-end there.** R-075 is
  filled at the DAY, not the WEEK.
- **Item 34 / census C7 is one line from startable** and is the terminal's now:
  the hinge is deleted on purpose by the `main_pattern_drift` branch in
  `workoutCanonicalisation.ts`, receipted in `482e0cb6`.
- **`test:power-counting`'s golden has moved and NOBODY owns it.** Cause is known
  (`c69151d9` is not output-neutral). I declined to re-bless a golden I did not
  author; it is still unclaimed.
- **The device flow lives in a session scratchpad and has nearly been lost twice.**
  `pkill -f "expo start --dev-client"` -> ONE `npx expo start --dev-client --port
  8082 --clear` -> `scripts/dev-e2e/run-maestro-ios.sh -e
  SEED_ID=standard-in-season-week <flow>`. 14 steps. **It should live in
  `.maestro/`.**



---

## 2026-08-13 — STANDING STOP-CHECKS (items 1 and 13), performed not skipped

**1a — MERGE `codex/*`: QUIET, and measured by merge-base AGE as the order
requires, never by commit count.** Every local `codex/*` branch with commits not
in `main` forks from **2026-07-19** and is **1,371 commits behind**. Merging any
of them reverts a month of work — the item already ruled that, and this is the
re-measurement rather than a re-ask. `program-week-navigation-bounds` (the one
fresh branch, merged `e231a6bc` on 2026-08-12) is fully in. **NOTHING OF SAM'S UI
WORK IS WAITING OUTSIDE `main`.**

**⚠ AND ONE BROKEN REF, found by that sweep and not by looking for it:**
`refs/heads/codex/ui-tweaks.lock.stale-seat` is a null ref —
`git show-ref` exits `fatal: bad ref … (000000…)` and every branch walk prints a
warning. The file exists at `.git/refs/heads/codex/ui-tweaks.lock.stale-seat`.
**Left in place: deleting a ref is not my call and it is harmless noise**, but it
makes every `git branch` sweep emit a warning that a future agent may read as its
own error. Named so nobody spends time on it twice.

**13 — UNENFORCED LAW COUNT: 28, counted the way the item insists
(`grep -c "state: 'UNENFORCED'" src/rules/lawRegistry.ts`), out of 123 law rows.
NOT LOWERED TODAY, and I am not going to pretend otherwise.**
The item names FOUR laws as "remaining", which reads as four unenforced rows and
is not what the file says — **the four are the ones with a PRICED route; the
other 24 have none.** That is exactly the miscount shape the item itself warns
about ("the terminal has miscounted this twice, both times one low"), so the
number is stated with its command beside it.
**Nothing I built today honestly closes one.** My cells hold RULINGS (R-075), not
laws; the mutation-proving I did was per-change, and `LAW-green-gate-is-a-claim`
needs it STANDING. **Claiming a law is enforced because a related cell exists is
the failure this registry was built to stop.**


---

## 2026-08-13 — MY STANDING RULE: I DO NOT WRITE `docs/SEAT_INBOX.md` ANY MORE

**THIRD INSTANCE TODAY, SO IT GETS A RULE INSTEAD OF A THIRD APOLOGY.** Three of
my commits carried another agent's uncommitted inbox edits: `a46d8c9e` (items 35,
2, 7, 13 removals), `44066a92` (781 changed lines), `9c2b7562` (151 changed lines,
items 34 and 35). **Nothing was lost in any of them — I checked the archives each
time and every removal pointed at content already committed elsewhere — but that
is luck, not method.**

**THE CAUSE IS NOT CARELESSNESS AND THAT IS WHY IT KEPT HAPPENING.** I commit
through a private index by explicit path, which is the documented protection —
and **it does not protect a SHARED FILE.** `git add docs/SEAT_INBOX.md` stages
whatever that file currently holds, including edits a neighbour has not committed
yet. The private index stops me staging their *other* files; it cannot stop me
staging their lines in *my* file. **Two agents editing one file is the whole
defect, which is exactly what Sam's one-writer rule says.**

**SO: I READ THE INBOX AND I DO NOT WRITE IT.** Item status, blockers, findings
and handoffs go HERE, in my own file, which nobody else edits. If an item needs a
marking the seat has not made, I write the marking here and name the item. **The
one exception I will still take is retiring a question I myself put under
`## AWAITING SAM`** — leaving it there after Sam has ruled makes
`test:ruling-registry` red, and it is my line to remove.

**AND THE ONE-WRITER RULE IS NOT HOLDING ELSEWHERE EITHER:** `docs/STATUS_AUDIT.md`
has commits from the terminal (`569c27b4`, the MAS census C2 work). Almost
certainly innocent — that file was `STATUS_AGENT3.md` until the audit seat renamed
it, so anyone holding the old name lands in it. **Worth telling them the name
moved rather than that they trespassed.**


---

## 2026-08-13 — R-075's STRENGTH ARM: THE §8 ALTERNATIVE, AND MY OWN DIAGNOSIS WITHDRAWN

**§8 asks for an ALTERNATIVE on the table before attempt three. I had stopped
without putting one up, which is only half the law.** Here it is, and finding it
refuted what I had written an hour earlier.

**WITHDRAWN: *"`allocations` and the final plan disagree about Tuesday — the bye
allocator has a second writer the final loop cannot see."*** True as far as it
went, and the wrong frame. **`buildWeeklyPlan` is 5,387 lines (`:1844`-`:7231`)
and does not return `plan` — it returns `adjusted`.** Between them sits a REPAIR
STAGE, and that is the second writer:

- `freeDayCandidates` — one bare `core` allocation per day not already occupied.
- `freeSlots()` — those candidates, **but only while `restBudgetSpare() > 0`**,
  i.e. only while spending a free day still leaves the week its required rest.
- `claimSlot()` — pushes a claimed day into `adjusted`.
- `strengthShortfall` — what makes it claim.

**SO TUESDAY IS NOT AN ALLOCATION AT ALL. It is a REPAIR** — the bye allocator
emits Monday and Friday, the repair sees the week short of strength and claims
Tuesday as core. **And that is why my optional Gunshow on Tuesday vanished: I put
a session on a day the repair was about to claim, so the repair claimed elsewhere
or not at all, and the count never moved.** The placement was never the lever.

### AND THE HONEST ANSWER IS THAT NOTHING IS SHORT

`restBudgetSpare()` is **not** the blocker — R-006 sets `fullRest.required: 1` and
the away week achieves 3, so there are two spare days to claim. **The repair does
not fire because `strengthShortfall` is ZERO: the away week meets its contract
exactly.** Its target is 3 core and it delivers 3.

**THE GUNSHOW WAS NEVER CONTRACT WORK.** It is a fixture-relative extra, placed on
G−1 by the game branch and never counted by the exposure contract at all. So when
the trip removes the fixture, **nothing in the app's own accounting registers a
loss** — which is exactly why no repair, no shortfall and no placement fixes it.

### THEREFORE: THE UNIT IS THE CONTRACT, NOT THE PLAN

**R-075's strength arm needs the WEEKLY EXPOSURE CONTRACT to want one more session
when a trip removed the fixture.** Then the machinery that already exists — the
shortfall, the free-day budget, `claimSlot` — does the rest with no new placement
code. **Any fix in the allocator or the repair is treating a number that is
already correct.**

**NOT ATTEMPTED, and this is the third time today I have named the same reason:**
it is a contract change, the deepest layer, and it owes `test:scenarios` +
`test:qa` either side. `coachingEngine.ts` is byte-identical to HEAD. **Next
session starts at `weeklyExposureContract`, with the two dead ends and this
alternative all measured.**


---

## 2026-08-13 — R-075 STRENGTH ARM: THREE ATTEMPTS, AND §8 SAYS THE ARCHITECTURE IS THE QUESTION

**Three placements tried, all measured, all reverted. `coachingEngine.ts` is
byte-identical to HEAD.** Under §8 (*"3+ fixes failed → question the
architecture, do not attempt a fourth"*) I am stopping and stating the
architectural finding, which the third attempt is what earned.

| attempt | where | what happened |
| --- | --- | --- |
| 1 | game branch's remaining-days loop | **DEAD CODE** — the away arm never enters it (`isByeWeek=true`) |
| 2 | bye branch, FIRST free day | placed on Tuesday, **displaced**; plan came back `Mon[core] Tue[core] Fri[core]` |
| 3 | bye branch, LAST free day | placed on Thursday, **displaced**; plan came back `Mon[core] Thu[core] Fri[core]` |

**ATTEMPT 3 IS THE ONE THAT EXPLAINS THE OTHER TWO.** The optional did not
disappear — **it was CONSUMED.** The plan's shape moved from `Mon/Tue/Fri` to
`Mon/Thu/Fri`, which is my Thursday placement promoted to core. Wherever I put an
optional, the strength repair takes it: `DISPLACEABLE_TIERS` includes
`'optional'`, and the repair is looking for a core day.

### THE ARCHITECTURAL FINDING

**THE BYE ALLOCATOR EMITS TWO CORE SESSIONS AGAINST A TARGET OF THREE, AND THE
REPAIR SILENTLY COVERS THE DIFFERENCE.** Measured directly: after the bye
branch's own loop the plan is `[Monday[core] Friday[core]]` — two — and the
contract's `actualCore` is three. The third core day is not planned, it is
REPAIRED in.

**SO THE WEEK IS PERMANENTLY ONE CORE SHORT AT PLANNING TIME, AND ANY OPTIONAL IS
THE NEAREST THING FOR THE REPAIR TO EAT.** Sam's Gunshow can never survive while
that is true — not on the first free day, not on the last, not anywhere. **The
placement was never the lever, and neither is the contract** (which I said last
pass and now withdraw: the contract's number is correct at 3; it is the ALLOCATOR
that under-delivers against it).

**THE UNIT, THEREFORE:** make the bye allocator emit its full core target, so the
repair stops consuming optionals to do the allocator's job. Then the optional
budget — already `2`, already computed, already unused by this branch — has room
for R-075's replacement with no new placement code at all.

**A FOURTH PLACEMENT ATTEMPT IS THE WRONG MOVE AND §8 SAYS SO.** Each of the three
revealed a new consumer in a different place; that is the pattern the law names.

**BASELINES CAPTURED FOR WHOEVER BUILDS IT** (so the either-side numbers are not
re-derived): `test:scenarios` **1 failed** (`GAME-MOVE-SAT-TO-FRI`, pre-existing);
`test:qa` **168 passed / 11 failed across 17 scenarios, 5 allowed findings used**.


---

## 2026-08-13 — QUEUE SWEEP: EVERY ITEM IS BLOCKED, CLOSED, BUILT, OR A STANDING CHECK RUN THIS TURN

Stated with the state of each, so *"the queue is clear"* is a receipt and not a
claim:

| item | state |
| --- | --- |
| **37 (mine)** | **`BLOCKED-BY: sam`** — R-069(2) vs R-075. Question + grep in `## AWAITING SAM` (`9822ddea`). **Day half BUILT and on glass.** |
| 28-C1, 37 (dup), 35, 34, 30, 2, 21 | `BLOCKED-BY: other-agent` |
| 36 | **PAID** — `[13d]` rewritten, the prescribed fix refuted by measurement |
| 33, 26, 29 | BUILT |
| 32, 25 | CLOSED |
| 31 | RULED |
| 7 | done, re-measured by `audit` |
| 27 | A1/B1 fixed; its C1 is item 28-C1, already blocked above |
| 28 | DONE — the rebuild, and its ordered step 1 refuted on glass |
| **1, 13** | **STANDING — both RUN this turn, not skipped** |

**1a — QUIET.** Every local `codex/*` branch ahead of `main` forks from
2026-07-19 and is 1,371 commits behind; merging any reverts a month. **Nothing of
Sam's UI work waits outside `main`.** Measured by merge-base AGE as the order
demands, never by commit count.

**13 — 28 UNENFORCED of 123 law rows**, counted with the item's own command.
**Not lowered, and not dressed up as if it were.** Nothing I built today honestly
closes one: my cells hold RULINGS, not laws.

**SO THERE IS ONE QUESTION FOR SAM AND IT IS THE ONLY ONE** — away: the bye's two
lifts, or his usual gym count? Everything else on my side is either finished or
waiting on another agent.
