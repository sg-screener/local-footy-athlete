# THE AWAY FLOW — BOUNDARY REPORT, 2026-08-13

**SEAT_INBOX item 28, built by the desktop agent.** The inbox keeps a short
entry and a pointer here; this file is the ceremony — the measurement, the
mutation runs, the premise this item corrected and the leftovers it named.

**LOOP CHECK: `green-and-empty-dated-write` — sighting 2 — COMPRESS.** Sighting 1
was this same item's slice 3 on 2026-08-13: a route and a wrapper compiled,
passed the gate, and wrote `tags: []` — a dated fact asserting nothing — and was
fully reverted (`234f917c`). Sighting 2 is the one this pass caught BEFORE
writing it: an equipment answer dated over days whose sessions the away door had
just removed would have been the same shape wearing different clothes. **The
compression is a cell, not a note:** `test:away-flow` [5b] reds if a schedule
fact or a `clear_days` ever returns to that handler, and [2b]/[2c] red if the
span stops reaching the days it names. A dated write is now guarded by a cell
that asks what it CHANGED, not that it happened.

**Sam asked for it in one line — "build the away flow" — and the ruling it
answers is his, verbatim, from 2026-08-13.**

---

## The item as it stood when the work finished

28. **THE AWAY FLOW IS BUILT — AND AWAY STOPPED DELETING THE ATHLETE'S WEEK.**

    **OWNED BY THE DESKTOP AGENT.** Built 2026-08-13. **Held by
    `test:away-flow` (13 cells), `test:day-first-timeline` and
    `test:program-control-durable`.**

    **Sam's ruling, verbatim, and it is what shipped:** *"I think the away
    button should live on the weekly screen, it should say 'when do you leave?'
    then 'when do you return' thhe leave button should be limited to that week
    in dates, but the return date can be any date in the future / then you are
    asked about the equipment stuff"*.

    **WHAT LANDED:**
    1. The `Away` control is on the WEEK shape (`home-away-entry`), beside
       add-a-game and for the same reason. The day-screen chip
       `home-away-this-week-entry` is GONE; that row is three chips now.
    2. **"When do you leave?"** — the days of the week on screen, today or
       later.
    3. **"When do you return?"** — a month calendar with **no forward stop**.
       There is no date-picker dependency in this app, so it is built from the
       same primitives as everything else (`AwayReturnCalendar`).
    4. **"Do you have your normal equipment?"** — `no` opens
       `EquipmentLimitationSheet` with the span; `yes` stores NOTHING and says
       so, which is his own ruling (*"if yes, follow same program"*).

    **THE ONE BEHAVIOUR CHANGE, AND IT IS THE POINT OF THE ITEM.** The old away
    door wrote a `travel` SCHEDULE fact with the away dates marked
    **unavailable** — it took the sessions away. **That is the opposite of what
    Sam ruled twice** (*"if yes, follow same program"*, *"the plan should change
    until their return date"*) **and it also made step 4 impossible to build
    honestly: an equipment answer dated over days that no longer hold a session
    substitutes nothing.** It would have shipped green and empty, which is
    exactly how slice 3 died. So the away door now writes ONE fact — the dated
    equipment fact — and `test:away-flow` cell [5b] reds if a schedule fact or a
    `clear_days` ever returns to that handler.

    **`until` IS THE LAST DAY AWAY, NEVER THE RETURN DATE**, from his own build
    order: *"on the return date the modifier drops off and the program goes back
    to normal by itself"*. Proven by cells [2c] and [3] on a **ten-day trip that
    crosses two Sundays** — the shape the replaced sheet could not express at
    all, which was the bigger defect this item names.

    **MUTATION-CHECKED, not asserted:** forcing the week scope back reds [1b],
    [2b] and [2c]; setting `until` to the return date reds [3].

    **MEASURED WHILE BUILDING, and it corrects this item's own premise:**
    `EquipmentLimitationSheet` existed but **was mounted NOWHERE** and
    `set_equipment_modifier` had **no product caller at all** — only its icon
    helper was imported. "The door already exists" was true of the sheet and
    false of the door. The away flow is now its first caller.

    **STILL OPEN, NAMED RATHER THAN QUIETLY KEPT:**
    - The `travel` schedule fact, `clear_days`, and their copy (*"Your program
      is avoiding the dates you are away."*) now have **no athlete-facing
      caller**. They are still reachable from the walker and the coach path.
      **A retire pass owns them, not this item.**
    - The diagnostics surface is still named `away_this_week` on a fact that can
      span a fortnight. Kept deliberately — renaming it touches persisted
      `sourceSurface` labels and four test files — **and named here so it is
      fixed on purpose rather than found later.**
    - `MONTH_NAMES` was added to `utils/appDate.ts` (the one date-display
      owner). **Four private `MONTH_SHORT` tables already exist**
      (`staleOverrideDetector`, `sessionResolver`, `teamNightMoveAsk`,
      `JournalScreen`); they are reported, not extended.

28-C1. **C1 CORRECTED — COD IS NOT A MISSING BRANCH. SAM'S CONDITIONING
    VOCABULARY IS NARROWED TWICE, SILENTLY, AND THE CENSUS UNDER-CALLED IT.**

    **OWNED BY THE TERMINAL. This replaces C1's diagnosis in
    `docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md`. The census named the selector;
    the selector was genuinely missing a branch, and that was still the wrong
    place. My error — recorded, not smoothed over.**

    **TWO ATTEMPTS HAVE NOW BEEN REVERTED AND BOTH REVERTS WERE RIGHT.** The
    second one wired all four pieces, measured, got **ZERO COD sessions**, broke
    four passing phase checks, and backed out. **That attempt is the most
    valuable thing produced on this item — it proved the blocker is upstream of
    everything it touched.**

    **HERE IS THE ACTUAL SHAPE. THREE VOCABULARIES, NONE OF THEM AGREE.**
    - **Sam's authored sheet — EIGHT qualities** (`conditioningTemplates.ts:34-43`):
      `acceleration`, `top_end_speed`, `repeat_sprint`, **`cod_decel`**,
      `anaerobic`, `aerobic_power`, `aerobic_capacity`, `flush`.
    - **The selector — SIX categories** (`conditioningSelection.ts:57-63`):
      `aerobic_base`, `tempo`, `sprint`, `vo2`, `glycolytic`, `recovery_flush`.
    - **The domain object — FIVE** (`domain.ts:926`): the same six MINUS
      `recovery_flush`.

    **8 → 6 → 5. Sam's vocabulary is squeezed at two joints, and nothing reports
    the loss.** `cod_decel` has no category AND no domain slot, so the planner
    cannot even ASK for it. Adding a `case` to `poolForCategory` gives a branch
    nothing can ever reach — which is exactly what the second attempt measured.

    **⚠ AND THERE IS A SECOND CASUALTY NOBODY HAS NOTICED.**
    **`recovery_flush` is a real category with no domain slot.** Same waist, one
    joint further along. **Measure what happens to a recovery_flush request
    today before building anything** — it is either silently dropped or it
    throws, and both are findings.

    **THE APP'S OWN COMMENT ALREADY DESCRIBES THE FAILURE MODE**
    (`section18OfferPlacement.ts:501-504`): *"an unknown category silently
    empties `poolForCategory` and the selector throws on it."* **The code knew.
    Nothing enforced it.** And two paths hard-assign the category away
    regardless — `coachingEngine.ts:1267` and `:1350` both set
    `conditioningCategory = 'aerobic_base'` outright.

    **BUILD — AND THE UNIT IS THE WAIST, NOT COD.** Per Sam's standing
    instruction, do not widen one union for one quality. **The three vocabularies
    become ONE, or the two translations become EXPLICIT AND TOTAL** — every
    authored quality maps to something requestable, and a quality with no mapping
    is a RED at build time, not a silent empty pool at runtime. **A `Record<
    ConditioningQuality, ...>` makes the compiler the enforcer; a `switch` with a
    default does not.** COD then falls out of the fix rather than being it.

    **THE FOUR PHASE CHECKS THAT BROKE ARE A REAL SIGNAL, NOT NOISE.** One extra
    pool option moved coverage counting and shuffled unrelated weeks. **That
    means the planner's coverage maths is sensitive to pool SIZE.** Understand
    that before re-landing, or the next attempt reverts for the same reason.

    **WHY THIS IS THE RIGHT ITEM TO SPEND ON:** the census's own headline is that
    nine of twenty findings are one defect — authored truth held and not read.
    **This is that defect with a mechanism attached, and the mechanism is a
    narrowing translation nobody guards.** Fix the waist and the class shrinks.

    **PROVE IT:** the 17 QA scenarios AND the 120-session distribution either
    side. **Report the COD session count explicitly — it is currently zero and
    "still zero" is the failure this item exists to end.**


---

## The gates, either side

| Gate | Result |
| --- | --- |
| `npm run test:compile` | **PASSED** — no file regressed against the baseline |
| `npm run test:away-flow` | **13 / 13**, new suite, in the `test:bible` chain |
| `npm run test:day-first-timeline` | **48 / 48** (was 43 + 4 red mid-build) |
| `npm run test:program-control-durable` | **19 / 19** |
| `npm run test:copy-rulings-binding` | **9 / 9** — two rows WITHDRAWN, batch 34 PROPOSED |
| `npm run test:repo-law-guards` | **46 / 46** |
| `scripts/sweep.sh away-flow` | 20 reds, **19 of them already red at HEAD**; the twentieth was `repo-law-guards` and it is fixed above |

**THE SWEEP RAN IN A SHARED CHECKOUT AND SAID SO.** Two of its reds
(`test:power-counting`, `test:week-budget-placement`) are GREEN at HEAD and
GREEN with only this unit's files applied — they belong to the other seat's
uncommitted generator edits (`defaultProgram.ts`, `conditioningSelection.ts`,
`weekStructureValidator.ts`, `coachingEngine.ts`, `domain.ts`,
`deloadWeekRules.ts`, `offseasonSubphasePolicy.ts`), which were in the tree the
sweep measured. **Every red was re-run in a detached worktree at HEAD with ONLY
this unit's nine files copied in**, which is the only way to answer "is it mine"
in a checkout with two writers.

## The mutation runs

A green cell is a claim. Both of the properties this unit exists for were
broken on purpose and the right cells went red:

| Mutation | Expected red | Result |
| --- | --- | --- |
| Force the equipment fact back to `{ kind: 'week' }` | the span cells | **[1b], [2b], [2c] RED** |
| Set `until` to the return date instead of the day before | the lift cell | **[1b], [3] RED** |


---

## NOT COVERED

**Said out loud, because omitting it is itself a defect (L2).**

- **THE SIMULATOR RUN IS PARTIAL AND IS THE ONE THING STILL OWED.** The day
  screen was photographed with the away chip GONE (three chips: Tired, Sick,
  Injured) — that half is seen. **The week-shape control, the two date
  questions, the equipment question and the modifier afterwards were NOT
  reached on glass**: the dev harness's cold-start clock gate refused on every
  reload, and the cause was measured rather than guessed — `scripts/sweep.sh`
  writes `.sweep/last.log` INSIDE the repo, so Metro re-bundled continuously
  while the sweep ran and every relaunch hit `DevE2EClock reload mismatch`.
  **This is not a product defect and must not be reported as one.** The run is
  owed on a quiet tree.
- **NO GENERATION MEASUREMENT.** Nothing here asserts what the substituted
  sessions LOOK like across the span — only that the constraint reaches those
  days and stops after them. The 120-session distribution and the 17 QA
  scenarios were NOT run for this unit, because no generator file was touched.
- **THE TEAM-NIGHT / GAME QUESTION IS OPEN AND IS SAM'S**, recorded under
  `## AWAITING SAM` in the inbox: away no longer clears anything, so a team
  night and a fixture stay on the week while the athlete is in another city.
  Both can still be binned or moved by hand.
- **THE RETIRE PASS IS NOT DONE.** The `travel` schedule fact, `clear_days` and
  the copy *"Your program is avoiding the dates you are away."* now have no
  athlete-facing caller. They are still reachable from the walker and the coach
  path, so nothing was deleted here.
- **THE DIAGNOSTICS SURFACE IS STILL `away_this_week`** on a fact that can span
  a fortnight. Kept on purpose (persisted `sourceSurface` labels, four test
  files) and named so it is fixed deliberately.


---

## SLICE 2 — WHAT BEING AWAY DOES, ruled the same day

**Sam, 2026-08-13, answering the one question slice 1 left open:** ***"yes clear
team training and games while away"***.

**IT LIVES AT ONE SEAM.** `validateWorkoutAgainstActiveConstraints` is the only
place that knows what a day is MADE OF, so that is where "away" is turned into
an effect. A live `travel` span now:

- removes **team-training rows** from a day and keeps the rest of it, renaming
  the day through `getTeamTrainingWorkoutState` — the one owner of "what part of
  this is the club's", so away and the day card cannot disagree;
- collapses a day that was **only** club work (a team-only night, a game stub, a
  practice match) to rest;
- **touches nothing else.**

**IT MARKS NO DATE UNAVAILABLE, and that is the whole design.** `unavailableDates`
means "there is no training here at all" — it was what the replaced door sent,
and it deleted the athlete's own gym session along with the club's night. The
payload now carries `awaySpan: { from, until }` and nothing else; the executor
writes `unavailableDates: []` for it, and `test:away-flow` [5c]/[5d] red if
either half comes back.

**THE FACT IS WRITTEN IN BOTH BRANCHES.** The club is shut to the athlete
whatever is in his suitcase, so "yes, same as usual" writes the trip too — one
fact, no equipment restriction. *"If yes, follow same program"* stays true of
every session that was ever his to do.

### Mutation runs, and this pair is the point

A rule can be wrong by being ABSENT or by being TOO WIDE, and the second is
exactly how the door this replaced went wrong. One mutation each way:

| Mutation | Expected red | Result |
| --- | --- | --- |
| Disable the travel rule entirely | the club work survives | **[8], [9], [10] RED** |
| Widen it back to the old whole-day collapse | the athlete's own work dies | **[8], [8b], [11] RED** |

### Copy the behaviour change forced

- **WITHDRAWN: "Your program is avoiding the dates you are away."** Nothing is
  avoided now.
- **The short phrase was "Sessions moved"** — signed (item 22(a)) for a day the
  athlete cannot train. Nothing moves any more, so travel gets its own effect
  (`club_sessions_off`) rather than borrowing a signed phrase that stopped being
  true. **"Team training and games off" is PROPOSED, batch 34.**

### A finding the widened copy gate earned

Adding `rules/temporarySourceFact.ts` to `test:copy-rulings-binding`'s scope
(needed for the sentence above) immediately reddened an UNRELATED row: batch
33-a's `WITHDRAWN: "Short on time today"` claimed a whole-app retirement, and the
sentence is still the modifier title a time-cap fact shows on My Status. **That
is correct and stays** — 33-a withdrew the inert Day-screen CONTROL, not the
words the fact uses about itself. The row is re-worded to the surface-scoped form
batch 12 already uses. **The gate got stricter and found a doc that was wrong;
nothing was loosened to pass.**

### Not covered, slice 2

- **NO GENERATION MEASUREMENT BEYOND PARITY.** `test:scenarios` fails on exactly
  one case (`GAME-MOVE-SAT-TO-FRI`) **and fails identically at HEAD** — measured
  in a detached worktree, not assumed. The 120-session distribution and the 17
  QA weeks were NOT re-run: no generator file was touched, and the new branch is
  inert unless a travel fact is live.
- **THE LEGACY `clear_days` AWAY FACT KEEPS ITS BLANKET COLLAPSE** and now also
  gets the club rule. It has no product caller; a retire pass owns it.
- **PARTICIPATION IS NOT MODELLED.** An athlete away who could still do a club
  session remotely has no way to say so. Nothing was invented for it.
