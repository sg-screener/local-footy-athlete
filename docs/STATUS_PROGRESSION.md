# PROGRESSION — your own status file. ONE WRITER: you.

**NAMED 2026-08-13.** The seats are named for WHERE they live (`terminal` — the
rules engine; `desktop` — screens and flows) or WHAT they do (`audit` — it does
not believe a claim until it has measured it). This one is named for its LANE:
**strength progression — `progressionRules.ts`,
`strengthProgressionIntegration.ts`, and the authored dose they spend.**

**WHY NOT `audit`.** This session began holding the `audit` memory. While it
worked, **another live session committed as `Agent: audit`** — `15d32ef2`,
`63fe3fba`, `d7953e9d` — so stamping `audit` here would have put two concurrent
seats behind one name, which is the exact ambiguity the stamping rule exists to
end. Renamed rather than collided. **`docs/STATUS_AUDIT.md` is NOT mine to
write** and was left alone.

**EVERY COMMIT FROM THIS SEAT ENDS `Agent: progression`.**

---

## STATUS

### ITEM 41 / CENSUS C6 — ASSIGNED TO THIS SEAT. PREMISE VERIFIED, DEFECT MEASURED, BUILD NOT STARTED

**THE ITEM'S PREMISE IS TRUE AND I CHECKED IT RATHER THAN TAKING IT.**
`resolveDayDirective` (`rules/readinessIllnessLaw.ts:201`) — whose own comment
calls it *"The single read point for both doors"* — has **exactly one grep hit
in the whole repo: its own definition. ZERO callers.** It is a fully written,
correct-looking owner that nothing asks. The live owner is week-granular
(`generationConstraints.ts` `weekDeloaded` / `weekMode`).

**THE DEFECT IS NOW A TABLE, NOT A SENTENCE.** A Thursday low-readiness call,
law (R-017/R-035: a rolling 7 days from the declaration day) against the live
week-granular owner:

| date | day | law (rolling 7d) | live (week) | |
| --- | --- | --- | --- | --- |
| 2026-07-13 | Mon | false | **true** | ⚠ retro-deloaded |
| 2026-07-14 | Tue | false | **true** | ⚠ retro-deloaded |
| 2026-07-15 | Wed | false | **true** | ⚠ retro-deloaded |
| 16–19 | Thu–Sun | true | true | agree |
| 2026-07-20 | Mon | **true** | false | ⚠ dropped |
| 2026-07-21 | Tue | **true** | false | ⚠ dropped |
| 2026-07-22 | Wed | **true** | false | ⚠ dropped |

**THREE DAYS DELOADED THAT THE LAW DOES NOT TOUCH, AND THREE DAYS THE LAW
DELOADS THAT SHIP AT FULL LOAD.** The retro half is the worse one for the
athlete: Monday to Wednesday were already trained or already planned when he
declared on Thursday. **Bible `:4960` is exact — a week-granular owner can only
honour a rolling window by snapping it to weeks, "the exact behaviour the law
rules out".**

**BUILD NOT STARTED, DELIBERATELY.** It changes generated output and owes
`test:scenarios` + `test:qa` either side; item 34 says in as many words that
starting a generation change at the tail of a session **"is the documented way
the last two nights went wrong"**, and this turn is long. **The expensive half —
verifying the premise and pricing the defect — is done and is above.** The three
files are FREE (`readinessIllnessLaw.ts`, `generationConstraints.ts`,
`generateProgram.ts`, all `cmp`-verified against `HEAD`).

**NEXT SESSION STARTS AT THE BUILD, NOT THE HUNT:** make `resolveDayDirective`
the read point and DERIVE the week mode from it. **Its proof is already written
in the item** — a Thursday declaration leaves Mon–Wed untouched and reaches the
following Wednesday — and the probe above is the shape of the cell.
**NOTHING IS OWED TO SAM:** R-017 is authored and built at the fact level; this
is engineering.

### ITEM 38 / R-077's ESCAPE HATCH — one defect FIXED, one measurement VOID

**THE ORDER (item 38, part 3):** *"Verify the athlete CAN add a strength session
to an away week — if that control is missing or refused on a bye-shaped week, his
ruling is only half true and that is a defect to report."*

**PARTS 1 AND 2 ARE NOT MINE AND I DID NOT ENTER THEM.** R-076 (face pull leaves
the horizontal-pull pool) is the TERMINAL's, which reports itself live on item
34. R-077's strength arm is the AWAY seat's and its answer is *do nothing*.

**⚠ AND THE OFFER HALF WAS ALREADY VERIFIED WHILE I WORKED — I DID NOT RE-DO IT.**
`R-077` is already a registry row, and another seat measured the hatch through
`listPlanChangeOptionsForDay`: **all seven days of an away week return
`canAdd: true` and offer `strength_upper`/`strength_lower`/`strength_full`**, held
by `test:away-flow` `[17e]`/`[17f]`/`[17g]` with the home game day
(`locked: 'game_day'`) as non-vacuity. **I read those cells rather than trusting
the row, and they say what the row says.**

**WHAT THEY ASSERT IS THE OFFER, NOT THE OUTCOME** — `canAdd: true` and the
option ids. `planChangeProducerTests` carries the general invariant that every
offered option *"validates and APPLIES through the same writer as the chat
door"*, but on ITS OWN worlds. **The composition — does an offered strength add
actually apply on an AWAY week — is the gap, and it is still open.**

**🛑 MY FIRST ATTEMPT WAS A DEAD INSTRUMENT — AND THEN I FOUND OUT EXACTLY WHY,
SO THE THREAD IS NOT LEFT AT "VOID".** Driving `buildPlanChangeProposal` +
`applyPlanChange` over a `resolveWeek`-built away week returned `ok=false` on
every strength add — **and identically on the HOME arm**. A both-arms refusal is
the shape that demands a positive control, so I ran one: **`metcon_offlegs`, the
template `planChangeProducerTests` [7] applies with one write, ALSO refused, as
did `mobility_flow`.** Nothing applied, so the harness could not tell a refusal
from a missing world.

**THE CAUSE IS NAMED, NOT GUESSED.** The refusal message is generic; the reason
is in `result.rejected[]`, and it reads
**`athlete_addition_publication_failed: "Athlete addition requires an accepted
program and profile"`.** My world had no seeded stores. **The app was never
refusing — my instrument was.** Both arms and the positive control were
explained by one missing precondition.

**RE-RUN ON A SEEDED WORLD (accepted program + profile in the stores), AND THE
ANSWER FLIPS:**

| | ok | pin minted | overlay written for the date |
| --- | --- | --- | --- |
| positive control, home (`metcon_offlegs`) | **true** | 1 | 1 |
| home, `strength_lower_squat` | **true** | 1 | 1 |
| **away, `strength_lower_squat`** | **true** | 1 | 1 |
| **away, `strength_upper_push`** | **true** | 1 | 1 |

**SO THE ADD IS NOT REFUSED ON AN AWAY WEEK AND IT IS NOT A NO-OP** — it returns
`ok=true`, mints a `UserRemovalConstraint` and writes a week-scoped overlay for
the target date. R-077's escape hatch is not shut.

**✅ AND THE LAST STEP IS NOW CLOSED — THE SESSION REALLY IS WRITTEN.** I had
left this open with "my reader shows Rest / 0 rows, but do NOT read that as a
defect". **That caution was right, and the reader was blind.**

The overlay is keyed `2026-07-13` — **exactly the week start my reader asks
for** — so the key was never the problem. Its content lives in
`workoutsByDate`, and I had been printing a field name that does not exist
(`workouts`), which is why it read as empty. **Also worth naming: my earlier
"overlay mentions the date" hit was nearly a false positive — this week's
`weekEnd` IS 2026-07-19, so a substring search for the date would have matched
the week's own end date rather than any session.** Printing the map directly:

| arm | `workoutsByDate['2026-07-19']` |
| --- | --- |
| positive control, home (`metcon_offlegs`) | **Hard Intervals**, 1 row |
| home, `strength_lower` | **Lower Squat**, 5 rows |
| **away, `strength_lower`** | **Lower Squat, 5 rows** |
| **away, `strength_upper`** | **Upper Push, 3 rows** |

**SO R-077'S ESCAPE HATCH WORKS END TO END.** The athlete's chosen strength
session is offered on every day of an away week (the other seat's half) AND is
written into the week the app reads from, away and home alike, with a positive
control proving the harness can see a known-good add. **Sam accepted training
less on a trip BECAUSE he can top it up — and he can.**

**✅✅ AND THE READ IS NOW CLOSED TOO — I RETRACT THE "SEPARATE OPEN QUESTION" I
FILED IN `0e0e52ca`.** I wrote that `rebaseAcceptedEffectiveWeek` "did not
surface a fresh overlay… the second would matter". **It surfaces it perfectly.
The bug was mine, for the third time on this one question.**

**`composeDaySurfaces` stores Sunday's `dayOfWeek` as `0`** (plain `getDay()`).
My helper computed `getDay() || 7`, which turns that `0` into `7` — **so I was
reading a key that does not exist and calling the answer Rest.** Corrected:

| arm | Sunday, through the REAL accepted-week read |
| --- | --- |
| positive control, home | **Hard Intervals**, 1 row |
| home, `strength_lower` | **Lower Squat**, 5 rows |
| **away, `strength_lower`** | **Lower Squat, 5 rows** |
| **away, `strength_upper`** | **Upper Push, 3 rows** |

**AND THE WEEK ITSELF CARRIES ITS OWN NON-VACUITY:** the home arm's key list
contains `6:Game Day` and **the away arms do not** — the fixture is gone,
so the world really is a trip and not a mislabelled home week.

**I ALSO TESTED THE OBVIOUS CULPRIT AND IT WAS INNOCENT.** Before finding my own
bug I suspected the pin: tier 1 of the read applies
`applyUserRemovalConstraintsToWeek`, and the add mints a constraint on that very
date, so "the pin eats the session it just placed" was a sharp hypothesis.
**Single-variable test — empty ONLY that list and re-read: no change.
Refuted.** Recorded because it is a plausible defect someone will suspect again.

**SO R-077 IS PROVEN END TO END: OFFERED, WRITTEN, AND READ BACK.** The only
remaining inch is the phone itself — *done means the athlete can see it* — and
that is a simulator check, not a measurement gap.

**THE LESSON, AND IT IS THE ONE THIS SEAT IS FOR: THREE INSTRUMENT FAULTS ON ONE
QUESTION, ALL MINE, EVERY ONE LOOKING EXACTLY LIKE AN APP DEFECT.**
(1) an unseeded world → "the add is refused"; (2) a field name that does not
exist (`workouts` for `workoutsByDate`) plus a substring hit on the week's own
`weekEnd` → "the write does not land"; (3) `|| 7` on a Sunday → "the week does
not show it". **Each would have been a serious, wrong bug report.** What caught
all three was the same move: a POSITIVE CONTROL, and printing the structure
instead of searching it.

### ⚠ AND CHASING THAT LAST STEP FOUND THE REAL HOLE: A GATE THAT DOES NOT EXIST

**The cheap next move I named was "find a KNOWN-GOOD addition this reader
surfaces". THERE ISN'T ONE, AND THE REASON IS WORSE THAN THE QUESTION.**

`coachAddSessionOwnershipTests` declines to prove that an accepted athlete
addition survives a §18 repair, and justifies that FOUR TIMES by deferring to
**`sectionOwnershipInvariantTests #10`**:

> *"Survival of an accepted add is otherwise pinned by the owner's own gate,
> sectionOwnershipInvariantTests #10."*
> *"Survival of an accepted add is proven by the owner's own gate."*

**THAT SUITE DOES NOT EXIST AND NEVER HAS.**
`git log --pretty=format: --name-only --diff-filter=A HEAD | grep -i sectionOwnership`
returns **nothing** over the branch's whole history, and the only four
references to the name anywhere in the repo were the ones inside that file.
**Every "covered over there" claim in it pointed at fiction.**

*(`git log --all` cannot be used here — it dies on the broken ref
`refs/heads/codex/ui-tweaks.lock.stale-seat` the desktop already recorded. The
`HEAD` walk is the working instrument.)*

**SO NOTHING PINS CENSUS #1's OWN DEFECT CLASS** — *"a 'Done' the athlete sees,
then loses when a later §18 repair canonicalises the day back to Rest"*. That is
the exact thing the suite is named for.

**AND THE SURVIVAL CELL HAD BEEN REPORTING `PASS` WHILE ASSERTING NOTHING.** It
bails with a bare `return` when §18 refuses the add — and in this seed §18
ALWAYS refuses — and a bare `return` inside `run()` **increments `passes`**. The
suite read *"4 passing, 0 failing"* with its central property never exercised.
**A green gate is a claim, and this one was empty.**

**WHAT I DID — DISCLOSE IT, DO NOT DELETE IT.** A `skip()` path now separates
"asserted nothing" from "passed", the totals line carries
`N SKIPPED (asserted nothing)` and names each one, and the three bail-outs use
it. The cell is kept so it fires the day a seed reaches an owned add; until then
it says so out loud:

    coach add_session ownership: 5 passing, 0 failing, 1 SKIPPED (asserted nothing)
      cells that asserted nothing this run:
        - an owned coach add survives a §18 repair pass byte-intact — §18 refused
          the add in this seed, so survival was never exercised — and no other
          suite pins it

**The four false citations are corrected in place rather than quietly dropped**,
so the next reader sees what was claimed and what is true.

**STILL OWED, AND IT IS NOT MINE TO SMUGGLE IN:** a real gate that an accepted
athlete addition survives a §18 repair. **I now know a world where the add DOES
land** (the seeded tap-door run above: `ok=true`, pin, overlay) — that is the
missing ingredient the old cell never had, and it is where that gate should be
built. Building it needs the reader question settled first, which is the same
open step.

### ✅ STANDING ORDERS PERFORMED THIS STOP, AND ONE REPO FAULT REMOVED

**1a — MERGE `codex/*`: QUIET, measured myself by merge-base AGE rather than
taken from another seat's report.** Every `codex/*` branch carrying commits not
in `main` forks from **2026-07-19** and is **~1,472 behind**; merging any reverts
a month. **Nothing of Sam's UI work is waiting outside `main`.**

**13 — THE UNENFORCED COUNT IS FALLING, AND I MEASURED IT WITH THE INSTRUMENT
THE ITEM ITSELF CORRECTS.** `npm run test:law-registry` (ROWS, never the grep):
**125 rows, 100 guarded, 25 UNENFORCED** — down from the 27 the item records.
**The standing order is being satisfied, by the seats collectively rather than
by me this stop.**

**I DID NOT START A LAW, AND THE REASON IS NOT SHYNESS.** `audit` holds this
item and has triaged all of them; its two cheapest (`LAW-elegant-two-options`,
`LAW-doc-truth`) both land in **`repoLawGuardsTests.ts`, which is HELD** — the
same wall that stopped my citation guard. Reading the remaining `wouldTake`
lines, most of the mechanisable ones are repo-doc gates that belong in that same
held suite. **Starting a multi-file gate at the tail of a long session is the
documented way the last two nights went wrong** (item 34 says it in as many
words), and duplicating a seat that has already triaged the list is the
eight-minutes-each waste this checkout created status files to stop.

**AND THE BROKEN REF IS GONE — it had already cost two seats.**
`refs/heads/codex/ui-tweaks.lock.stale-seat` was a **ZERO-BYTE file** in
`refs/heads` (a leftover `.lock` artifact from 2026-08-12 09:15, same minute as
the real `ui-tweaks` ref beside it). It named no object, so **there was nothing
behind it to lose** — but git treated it as a broken ref and **aborted every
`--all` walk**. The desktop recorded it; **it then bit me directly**, killing the
history check I needed for the missing-suite finding and forcing me onto a
`HEAD`-only walk.

**Removed** (moved to this session's scratchpad rather than deleted, though a
0-byte file is nothing to keep), after checking `ps` for a neighbour mid-git —
the same rule as a stale `index.lock`. **Verified: `git log --all` walks again,
`git show-ref` reports no broken refs, and `codex/ui-tweaks` still points at
`5f60a41f`, untouched.**

**IT ALSO STRENGTHENED A CLAIM I HAD ALREADY MADE.** The
`sectionOwnershipInvariantTests` finding was hedged to *"never on this branch's
history"* because `--all` was unusable. Re-run across **every ref**: still zero.
**That suite has never existed ANYWHERE, not merely never on `main`.**

**⚠ THIS FIX CANNOT BE COMMITTED — it is a `.git` internal, not a tracked file.**
This paragraph is the only durable record, which is precisely why it is written
here rather than left as a shell command someone ran once. **If it reappears,
the cause is a `.lock` rename during a ref update, not a real branch.**

### THE CLASS, SWEPT — AND IT IS MUCH SMALLER THAN THE FIRST ONE SUGGESTED

**Having found one "covered over there" claim pointing at fiction, I swept for
the class rather than stopping at the case.** Every `*Tests` name cited anywhere
in `src`, checked against every filename in the repo.

**⚠ MY FIRST SWEEP RETURNED 77 AND WAS GARBAGE — the instrument, not the repo.**
The pattern matched after a literal `\n` inside strings (`nJournalWeekTests` and
~60 siblings), and it walked only `src` for existing files while some suites live
in `scripts/`. **Reported here because a 77-item "finding" handed to anyone would
have been a week of chasing nothing.** Corrected pattern
(`(?<![\\A-Za-z0-9_])`), repo-wide filename set, and function-name exclusions →
**6 real candidates.**

**AND THE VERDICT ON THE 6 FLIPPED ONCE I ASKED WHETHER THE COVERAGE EXISTS
UNDER ANOTHER NAME.** It mostly does:

| cited name | verdict |
| --- | --- |
| `sectionOwnershipInvariantTests` | **THE ONLY REAL HOLE** — nothing anywhere covers it (`ac505f52`) |
| `keyboardConventionTests` | **STALE NAME** — the guard is `keyboardConventionContractTests`, 43/43 green |
| `profileMirrorProvenanceTests` | **STALE NAME** — `profileMirrorNarrowingTests` really does pin the fixture↔default identity |
| `shrinkBudgetTests` | **STALE NAME** — `athleteActionWalkerTests` proves BOTH arms, each guarded against vacuity |
| `legacyPowerBlockMigrationTests` | **CORRECTLY ABSENT** — a cell asserts the file is GONE; the absence IS the assertion |
| `thingTests` | **CORRECTLY ABSENT** — a placeholder inside a guard's own fixture data |

**SO: one missing gate, three stale names, two false positives.** The three stale
names now cite the suite that really does the work. **A wrong name is the worse
half of the two to leave** — a reader who greps it finds nothing and concludes
the thing is unenforced, which is exactly the wrong conclusion in all three.

**A GUARD FOR THE CLASS IS THE RIGHT ANSWER AND I COULD NOT LAND IT.**
`repoLawGuardsTests.ts` already holds this exact shape
(`retiredShapesNamingNoGuard` — *"a retirement naming no guard … the claim would
be prose"*), so the citation check belongs beside it. **That file is HELD by
another seat** (`cmp` vs `HEAD`), so it is not mine to enter.
**ONE RULE THE BUILDER WILL NEED, or it will red on my own corrections:** the
three fixes deliberately still NAME the dead suites in their history notes, so
the guard must exempt a mention that sits next to the words *"does not exist"*.
Without that exemption the sweep still returns all six — I re-ran it and it does.

### ✅ WHAT I DID FIND AND FIX: A REFUSED ADD LEFT AN ACTIVE PIN BEHIND

**This one was measured on a LIVE instrument** — the real coach pipeline over a
store-backed seed, where the executor demonstrably ran (it minted a pin, wrote,
verified, and rolled back with a named drift).

Asking the coach for a strength session on the week's rest day is **refused** —
`verification_failed:add_session:other_days_changed:2026-07-13` — because the add
cannot be made without deleting Monday's conditioning row
(`cond-2026-07-13-main`, printed by diffing the cells, not inferred from the
route name). **The executor is behaving well there: it rolls back and reports
`applied: false` rather than silently damaging Monday.**

**BUT THE ROLLBACK WAS INCOMPLETE, AND THAT IS THE DEFECT.**
`RemoveSessionRollbackSnapshot` was written for `remove_session` (an override + a
calendar mark) and is REUSED by `add_session`, which writes a THIRD thing — the
`UserRemovalConstraint` pin minted by
`commitAthleteSessionAdditionTransaction`. `restoreRemoveSessionStores` never
touched it. **Measured: `constraints 0 -> 1`, an ACTIVE pin on a day the app had
just reported it did not change.** Same shape as *a decision is not the only
thing a decision writes*.

**FIXED** — the snapshot captures the pin list and the rollback restores it,
before the override work so no reader sees a restored week under an abandoned
transaction's pin.

**WORKING** — `test:coach-add-session-ownership`, **6 passing / 0 failing** (4
pre-existing + 2 new), non-vacuity first in both new cells.

| cell | holds |
| --- | --- |
| a refused add leaves no pin behind | the residue itself |
| a refused add RESTORES the pin list rather than clearing it | the over-correction |

**MUTATION-PROVEN, and the second mutant is why the second cell exists:**

| mutant | result |
| --- | --- |
| rollback no longer restores the pin list | **killed** by cell 1 |
| snapshot captures `[]` instead of the real list | **SURVIVED cell 1** — then killed by cell 2 |

**THE SURVIVOR WAS THE MORE DANGEROUS BUG.** With an empty snapshot the rollback
would not just drop its own pin, it would **wipe every pin the athlete had
already earned on other days** — and cell 1 could not see it, because the seed
starts with no pins. Cell 2 gives the world a pin to lose.

**NO REGRESSIONS.** All 39 coach/away/program-control/adjustment suites run in
both arms back to back: **13 fail, identically, in BOTH** — pre-existing, named,
not absorbed. `npm run test:compile` PASSES.

### THE UNIT: the authored dose is spent by a layer that had floors and no ceiling

**THE ORDER.** The authored dose is enforced at generation, then
`applyStrengthProgression` re-writes it with floors only and no ceilings — a
beginner is moved to 4 sets after three clean sessions, and reps can drop to 3,
below Sam's minimum of 4.

**BOTH HALVES REPRODUCE. Measured before anything was changed**, by authoring a
lower main lift exactly as generation would for each phase band and running the
real `applyStrengthProgression` over it:

| case | authored band | generation | progression | breach |
| --- | --- | --- | --- | --- |
| early off-season, 3 clean sessions | 2-3 x 8-12 | 3 x 8-12 | **4** x 8-12 | **sets over max** |
| the same, plus the adaptation volume nudge | 2-3 x 8-12 | 3 x 8-12 | **5** x 8-12 | **sets over max** |
| pre-season, deload | 2-4 x **4**-6 | 3 x 4-6 | 1 x **3**-4 | **reps under min** |
| off-season, deload | 2-4 x **6**-8 | 3 x 6-8 | 1 x **4**-6 | **reps under min** |

**AND THE SETS HALF IS NARROWER THAN THE ORDER STATES, WHICH MATTERS.** Three
clean sessions add a set in EVERY phase — but pre-season and off-season author a
maximum of 4, so landing on 4 is legal progression inside Sam's own 2-4. **The
only band with a maximum of 3 is `early_offseason`**, so that is the only place
the fourth set is a breach. It is not an exotic case: `resolveOffseasonSubphase`
**returns `early_offseason` whenever phase-clock context is missing**, by design
("missing phase-clock context must choose the least aggressive policy").

### ⚠ THE REASON IT SURVIVED: THE SUITE NAMED FOR THIS MODULE HAS BEEN DEAD SINCE 2026-07-28

`test:strength-progression-integration` **crashed at import** —
`TypeError: classifyExerciseRole is not a function`. `77ccb6dc` (2026-07-28)
renamed that export to `classifyProgressionEligibility` and did not update the
suite, which calls it 14 times. **693 lines of cells, ZERO assertions executed,
for sixteen days.** Revived by the rename; it then reported **93 passed, 0
failed** — so nothing had rotted behind the crash, and the whole cost of the
outage was that this defect had no guard.

**THE SHAPE TO CARRY FORWARD:** a suite that dies at IMPORT reports no failures,
and a chain that reads exit codes cannot tell it from a suite that has no cells.
`scripts/sweep.sh` counted it among its passes.

### WHAT LANDED

**THE RULE, one sentence:** **the authored band is the boundary — progression
moves within it, and where a row already sits outside it progression may not
push it further out.**

- **`phaseRepSchemes.ts` gains `mainLiftSchemeForSlot`**, moved verbatim out of
  `defaultProgram.ts`. **ONE OWNER, TWO READERS** — generation reads it to WRITE
  the prescription, progression reads it to know the boundary. A copy beside the
  second reader is how two answers to "what is the authored dose" start drifting.
- **`applyDelta` takes the band** and clamps. **The two rules are deliberately
  NOT symmetric:**
  - **sets: a CEILING and no band floor.** Nothing authorises more sets than the
    phase allows. Going BELOW the minimum IS authored — **R-034 halves the
    sets** — so clamping up to `setsMin` would put this function in the deload
    law's way. The 1-set floor is untouched.
  - **reps: held inside the band both ways.** The invented `Math.max(3, …)` is
    gone.
  - **the bound WIDENS to admit a row already outside the band**, so
    `quality_low_volume`'s 2x3 (exempt from the phase scheme by ruling) is not
    "corrected" by a second owner.
- **`band` is null for any row generation did not dose from this table** — the
  condition MIRRORS generation's (`anchor` in a main-lift slot) line for line, so
  a lunge is never bounded by the squat's numbers. Accessories keep the old
  floors, which is the honest answer rather than a borrowed band.
- **The subphase reaches progression with NOTHING NEW STORED OR DERIVED.**
  `ProgramBlockState` already carries `phaseResolution`, and
  `buildProgressionContext` already receives the block state — so it reads the
  CLOCK's answer (the ruled owner of season phase) rather than deriving a second
  one. `sessionResolver.ts` needed no change at all.

**`progressionRules.ts` NEEDED NO CHANGE, and that is a finding, not an
omission.** It is dimensionless — it emits `add_one` / `big_down`, never a
number. The dose is spent in the integration module, so a ceiling written into
the rules file would have been in the wrong layer.

### WORKING — the cells that fail if this breaks

`test:strength-progression-integration`, section 21, **104 passed / 0 failed**
(93 revived + 11 new). Non-vacuity first throughout.

| cell | holds |
| --- | --- |
| `[21a]` | three clean sessions really do ask for a set (else every ceiling cell is vacuous) |
| `[21b]` | sets stay within the authored maximum |
| `[21c]` | **and the ceiling is not a freeze** — a band with room still earns the 4th set |
| `[21d]` | the adaptation volume override cannot cross the ceiling either |
| `[21e]` | reps hold Sam's authored minimum, on a row proven to be on a deload |
| `[21f]` | a row below the band keeps its own reps — the band bounds, never overwrites |
| `[21g]` | **a deload still cuts sets below the authored minimum** — R-034 not broken |
| `[21h]` | the band reaches the LIVE path — real block-state producer, real context assembler |

**MUTATION-PROVEN, five mutants, each killed by the intended cells:**

| mutant | killed by |
| --- | --- |
| sets ceiling removed | `[21b]` `[21d]` `[21h]` |
| reps floor back to the invented 3 | `[21e]` + the overturned deload cell |
| band ignores the off-season subphase | `[21b]` `[21d]` `[21h]` |
| band DRAGS an out-of-band row in | `[21f]` |
| sets clamped UP to `setsMin` | `[21g]` |

**The third mutant is the one worth keeping:** it proves the subphase plumbing is
load-bearing rather than decoration.

### THE WIDER RUN — AND WHY IT IS A TARGETED ARM, NOT `sweep.sh`

**`scripts/sweep.sh` IS NOT A USABLE INSTRUMENT IN THIS CHECKOUT TODAY, AND
THAT IS A MEASUREMENT, NOT AN EXCUSE.** My arm ran at `8205ae36` (51 of 209
red); the control ran after **eight further commits from other seats landed**
and another agent's uncommitted edits appeared in the tree
(`resolverDisplacementSweepTests.ts`, `exercisePoolsStrength.ts`, an untracked
`codProbe.probe.ts`). **The two arms did not see the same world**, so their
totals cannot be differenced — the instrument-fault-in-both-arms shape.
**Twenty-four commits from other seats landed during this unit.**

**REPLACED BY A TARGETED ARM RUN BACK TO BACK WITH NO COMMITS IN BETWEEN**, over
every suite that imports the three modules I changed, plus the deload and dose
suites the rule touches. **The two arms differ in my four files and nothing
else. ONE LINE OF DIFFERENCE:**

    < FAIL test:strength-progression-integration     (control: crashes at import)
    > PASS test:strength-progression-integration     (mine: 104/0)

`test:strength-progression-inputs` · `test:variation` · `test:block-rollover` ·
`test:row-counting` · `test:bible-anchors` · **`test:deload-law`** ·
`test:deload-week` · `test:game-feedback` · `test:recovery-template` ·
`test:rules-kernel` · `test:session-template` — **all green in BOTH arms.**

**TWO SUITES ARE RED IN BOTH ARMS AND ARE NOT MINE** — they red identically with
my four files at `HEAD`: `test:block-state` (*"legacy feedback survives
hydration unchanged"*) and `test:session-outcome-parity` (100/1). **Named, not
absorbed, and not claimed as fixed.**

**`npm run test:compile` PASSES** — no file regressed; the tests scope came back
**one better** than baseline (373 against 374).

### ⚠ ONE EXISTING CELL WAS OVERTURNED — NOT RELAXED, AND NOT EDITED TO MATCH MY CHANGE

Section 7 asserted `prescribedRepsMin === 3`: **a deload cuts main-lift reps by
two.** It reds under the fix. It was replaced by the OPPOSITE claim with its
authority attached, rather than loosened:

**`DELOAD_LAW` (`rules/deloadWeekRules.ts:35`, R-034, held by `test:deload-law`)
is the signed transformation and it HAS NO REP TERM.** It halves sets
(`mainLiftSetMultiplier: 0.5`), drops RPE to 5-6, and **HOLDS load** unless the
athlete is beat up. A rep cut is a reduction no door authored — the exact class
that law exists to end — and `deloadPowerDose` says so in as many words: *"it is
the volume that drops"*. **The cell had not executed since 2026-07-28, so it was
never a guard holding that behaviour in place.**

### ⚠ WHAT IS NOT FIXED — NAMED SO IT IS NOT MISTAKEN FOR CLOSED

**`applyStrengthProgression` IS A SECOND OWNER OF DELOAD DOSING, AND IT
DISAGREES WITH THE LAW IT IS SHADOWING.** Bounding the band does not settle
this, and it is bigger than this unit:

| | `DELOAD_LAW` (R-034) | `applyStrengthProgression` |
| --- | --- | --- |
| sets | HALF (`0.5`), floor 1 | `drop_two` — **a 3-set day goes to 1, the law says 2** |
| load | **HOLDS**; 0.9 only if beat up | flat `0.7`, unconditional |
| reps | **no term at all** | `-2` on `big_down` |

The law's own comment on `beatUpLoadMultiplier` says the drop *"is not an
unconditional multiplier — which is what the code did before this law"*. **That
sentence describes this module today.**

**A visible consequence that remains:** a deload still pulls `repsMax` down to
the band floor, so a 4-6 pre-season lift deloads to 4-4 and is shown as "4"
rather than "5" (R-016 shows one middle number). Inside the band, so not a
breach — but it is the rep term that R-034 does not have.

**NOT SENT TO SAM. Nothing here needs a ruling** — R-034 already decided it; the
question is which module obeys it.

### FOR WHOEVER TAKES THE NEXT ONE

1. **The deload second-owner unit above.** One module should dose a deload.
2. **`test:qa` and `test:scenarios` CANNOT SEE THIS CODE.** A probe at the top of
   `applyStrengthProgression` fired **ZERO** times under both, while the same
   probe fired 9 times under `test:strength-progression-inputs`. **The corpus
   suites do not reach the live progression path at all**, so "scenarios green"
   is not evidence about anything in this lane. Same shape the terminal recorded
   for item 34's drift branch.
3. **`sed -i` SILENTLY NO-OPS IN THIS CHECKOUT.** It exits 0 and changes nothing
   (the `.fuse_hidden*` files are the tell — it is a FUSE mount). Use an editor
   that reads the file back. This cost one wrong "the suite is still broken".
4. **`git status` lied again**, exactly as recorded: it showed
   `sessionResolver.ts` as `MM` while the file was **byte-identical to HEAD**.
   `cmp` against `git show HEAD:<path>` before believing you are blocked.
