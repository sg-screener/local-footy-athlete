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


---

## THE GLASS RUN CONTRADICTED THE SLICE-2 CELLS, AND THE CELLS WERE NOT WRONG

**MEASURED 2026-08-13, on the simulator, after `9f4f243c`.** Away 13/7 → 20/7
with normal equipment. The flow ran end to end and the acknowledgment appeared.
**The week did not move.** Tue 14 and Thu 16 still read *"Strength + Team
Training, 3 exercises"*; Sat 18 still read *"Game Day"*.

**THE CELLS ARE HONEST AND SO IS THE SCREEN — they are measuring different
moments.** `test:away-flow` [8]–[12] call
`validateWorkoutAgainstActiveConstraints` directly, and that function does
exactly what those cells say. **What it does NOT do is run over a week that is
already accepted.** Its only production callers are:

- `generateProgram.ts` — at GENERATION, and
- `validateLiveWorkoutWrite` — on an individual edit.

Adding a temporary source fact recomposes the accepted state through
`canonicaliseAcceptedStateCandidate`, which applies the §18 safety contract and
`canonicaliseHydratedSafetyWorkout` — **not the active-constraint validation.**
`validateProgramAgainstActiveConstraints` and `validateWeekAgainstActiveConstraints`
have NO production caller at all; only suites reach them.

**SO, IN THE THREE WORDS THIS REPO ALLOWS:**

| | |
| --- | --- |
| The away flow's four questions and both facts | **WORKING** — `test:away-flow`, seen on glass |
| The equipment span lifting itself on the return date | **WORKING** — [3], [4] |
| **Away removing club-bound work from the visible week** | **BUILT** — the rule exists at the seam and is held by [8]–[12]; it does not reach a week the athlete is already looking at |

**THE SAME DOUBT FALLS ON THE EQUIPMENT HALF, and it is recorded rather than
assumed away:** the modifier appears and says *"Exercises substituted"*, but the
visible session's exercises were NOT re-checked on glass and travel by the same
recomposition path. **Treat "the sessions change" as OPEN-UNKNOWN for the
current week until a cell or a device pass says otherwise.**

**WHAT IT WOULD TAKE, named so the next pass does not re-find it:** the accepted
recomposition would have to run active-constraint validation over the composed
week, which is a change inside the accepted-state transaction — the
one-owner-of-derivation area — and not a change to this flow. **It is not
started, and starting it at the end of a long session is the thing this item was
twice deferred to avoid.**


---

## THE REFUSAL HUNT, archived from the inbox 2026-08-13

Kept verbatim because two of its steps are instrument lessons, not away lessons.

    - **CAPTURED 2026-08-13 ON A SECOND METRO** (`npx expo start --dev-client
      --port 8082` with its console to a file, then the flow with
      `E2E_METRO_URL=…:8082` — the running Metro belongs to a human-started
      `expo run:ios` whose console is unreadable from here). **The scoped regen
      DOES run on device:** Metro shows `[ProgramGen] … completing from
      deterministic plan` and `[WorkoutCanonicalisation] Generated workout
      finalised` for days 2, 3 and 4 of the away week.
    - **AND THE REFUSAL IS SILENT.** Nothing in Metro's output mentions
      verification, the ledger, the candidate or §18 — no error, no warning.
      **So generation succeeds and the commit is rejected afterwards without
      saying why.** That puts it in `verifyCandidate` /
      `assertAcceptedVisibleLedgerEquivalence` inside
      `temporarySourceFactTransaction` — the only step between a finished regen
      and the athlete's sentence. **The next act is to make that step SAY its
      reason** (it returns a typed `reason` already; nothing logs it), then read
      it. **THAT is the reading job — and a refusal with no reason on the wire
      is itself the defect underneath this one.**
    - **THE LOGGING IS BUILT (`247eb6d3`) AND THE RE-RUN WITHDREW THE PREMISE.**
      With it in, the flow was run again and **the refusal did not reproduce —
      it committed, and the week MOVED.** So the refusal is STATE-DEPENDENT, not
      structural, and *"the §18 gate refuses a club-less week"* is WITHDRAWN.
    - **⚠ WHAT THE WEEK DID INSTEAD IS WRONG, AND DIAGNOSABLY SO. Seen on glass
      2026-08-13:** Tuesday lost its team night correctly (*"Strength + Team
      Training"* → *"Strength"*); **Thursday became a Rest Day; WEDNESDAY GAINED
      a team night it never had; Saturday kept its game.** The club MOVED rather
      than left.
    - ~~THE SUSPECT IS THE `availabilityDateISO` ANCHOR~~ **— REFUTED below.**


---

## ITEM 30's WORKING NOTES, archived from the inbox 2026-08-13

The inbox keeps the conclusions; this is the trail that produced them.

30. **THE AWAY RULING IS CARRIED OUT WHEN A WEEK IS BUILT — and NOT YET on a
    week already on screen. Both halves of that sentence are measured.**
    **WORKING:** a week planned inside a trip loses the team night and the
    fixture and keeps every row of his own training (21 rows either way;
    `test:away-flow` [13]-[13e], non-vacuity first).
    **NOT WORKING, and seen on glass rather than reasoned about:** putting travel
    on the DERIVING lane so it re-authors the CURRENT week made the athlete's tap
    fail — *"That didn't save — your week is unchanged."* The scoped regen
    re-authors the week without the club and the §18 gate refuses the result, so
    the whole transaction rolls back. **A door that refuses is worse than a door
    that records**, so travel is back on the record-only lane and the sentence
    the athlete reads was rewritten to promise exactly that and no more.
    **THE REFUSAL WAS HUNTED 2026-08-13 AND TWO REPRODUCTION ROUTES ARE RULED
    OUT — so the next pass does not spend the same hour.**
    - **The durable-suite world does NOT refuse.** With travel on the deriving
      lane, `reachHisWorldByActing()` + the away door returns
      `ok: true, changedProgram: true` and the message *"the visible program was
      safely recomposed"*. So the lane is not refusing in general.
    - **The dev seed rebuilt in NODE does not refuse either** — it returns
      `ok: true, changedProgram: FALSE`, *"No visible session needed changing"*:
      the scoped regen never fires there, because that harness has no
      microcycles to regen into (`canScopedRegen`).
    - **Only the SIMULATOR refuses**, so the refusal needs the real app's boot
      and hydrated state. **The OS log is the wrong instrument** — React
      Native's console goes to METRO, not `simctl log`, and a filtered
      `log stream` over the away tap returned nothing but network and installd
      noise. **Capture it from Metro's output** (`/tmp/qa-metro.log` when
      `lfa:dev` starts it; the current Metro belongs to an `expo run:ios` a
      human started, so its console is in that terminal).
    - **THE REFUSAL HUNT IS ARCHIVED to `docs/AWAY_FLOW_BOUNDARY_2026-08-13.md`**
      — a second Metro on its own port is how you read this app's console;
      `simctl log` is not.
    - **⚠ THE ANCHOR THEORY IS REFUTED, MEASURED ON DEVICE.** A probe printed
      `anchor 2026-07-13, span 07-13..07-19, before ["Tuesday","Thursday"],
      after []`. **The plan half is CORRECT — do not go back to it.**
    - **TWO OWNERS, NEITHER A GUESS. (1) THE WEDNESDAY TEAM NIGHT IS NOT FROM THE
      PLAN** — the plan carried none; a regenerated week is built with
      `previousProgram`, so a CARRIED-OVER session keeps its old name,
      *"+ Team Training"* included. **The leak is SESSION REUSE.**
      **(2) THE SATURDAY GAME IS A CALENDAR MARK**, not the profile's game day
      (`devE2ESeedRegistry.ts:773`), and marks reach the week through
      `targetWeekFixtures` — **which Sam's bye-week ruling now tells us exactly
      what to do with (see `## AWAITING SAM`).**

    Two guesses were
    already wrong today: narrowing L4b (broke two more cells, and was loosening a
    law to fit a change) and filtering travel out of the read-time projection
    (fixed L4b and broke the commit's ledger-equivalence, which is what produced
    the refusal on glass). **The real defect L4b found IS fixed in kind: away was
    being applied twice, authored into the week and projected onto it again.**
    **EVERYTHING BUILT TODAY MAY BE INVISIBLE — CHANGES ONLY REACH A WEEK THAT
    HAS NOT BEEN BUILT YET. THIS IS THE CENSUS DEFECT, IN TODAY'S WORK.**

    **OWNED BY THE DESKTOP AGENT, and it found this itself by putting the away
    flow on a PHONE rather than trusting a green suite.** That is the only reason
    anyone knows.

    **WHAT IT MEASURED:** the away flow is built and tested — team night comes
    off a "Strength + Team Training" day and the gym half survives, a team-only
    night or a game becomes rest, a normal session is untouched, and it all
    returns on the return date. **On the phone, nothing changed.** Tuesday and
    Thursday still read "Strength + Team Training"; Saturday still read "Game
    Day". **Because the code that does it runs only when a week is FIRST BUILT,
    and never re-runs over a week already sitting there.**

    **SAM'S RULING IS THEREFORE UNMET.** Item 22(c): *"the plan should change
    until their return date"*. **Changing what WOULD be built is not changing the
    plan.**

    **⚠ AND THE SAME DOUBT NOW COVERS THE REST OF TODAY. The desktop agent said
    so about its own equipment work — "the note shows up, but I did not confirm
    the exercises changed" — and that honesty is the model. EVERY change landed
    today that is supposed to alter an EXISTING week is now UNVERIFIED, not
    done:** the equipment substitution, the dated equipment span, the modifier
    effects, and anything in the census fixes that reshapes a live week rather
    than a freshly generated one. **Do not report any of them as delivered until
    each has been seen on a week that already existed.**

    **THIS IS THE CENSUS DEFECT WEARING TODAY'S CLOTHES.** Twenty findings said:
    the app holds Sam's logic and does not read it. **This says: the app now
    RUNS his logic and the athlete's week does not receive it.** Same shape, one
    layer later. **The rebuild path is the reader.**

    **BUILD — and it is a real unit, not a tail:** the pass that rebuilds a week
    when something changes must apply the away/equipment/modifier facts to a week
    that ALREADY EXISTS. The desktop agent has written down what it takes.
    **Start it fresh, not at the end of a session — half-doing this is how the
    last two nights went wrong.**

    **⚠ IN FLIGHT BY ITS OWNER RIGHT NOW — DO NOT START A SECOND ONE.**
    **Measured 2026-08-13 05:45 by the terminal, read-only, nothing touched.**

    **ANSWERED IN PART, AND ONE OF MY OWN CLAIMS IS WITHDRAWN. Desktop,
    2026-08-13.** The acceptance this item asks for now EXISTS as a cell:
    `test:program-control-durable` "ITEM 30: an equipment fact reaches a week
    that ALREADY EXISTS" — walk to a world, assert it holds barbell rows, apply
    a `missing_this_week` fact, assert none survive. **It is GREEN**, so the
    equipment substitution does reach an existing week.
    **BUT IT IS NOT MY LANE CHANGE THAT DELIVERS IT.** Putting equipment back on
    the inert lane leaves the cell GREEN — measured by mutation — so that
    substitution was already arriving by another route, and `0f31219d`'s claim
    that the lane fix is what made it land is WITHDRAWN. The lane fix is still
    right (a ruled fact must author its weeks, and it mints the adjustment the
    undo needs); it is not the reader this item was looking for.
    **STILL UNMET: the AWAY half.** The week does move, but the club work does
    not come off, because a day is a team day via the PLAN's `isTeamDay` and the
    name enforcement re-derives it after the constraint seam runs.

    **THE NEXT ACT IS MEASURED TO ITS LINE, so the next pass builds instead of
    hunting.** `coachingEngine.ts:1792` reads
    `teamDayNums = inputs.teamTrainingDays.map(dayNameToNumber)` and `:1798`
    stamps `isTeamDay` from it. Its ONE owner is `onboardingToCoachingInputs`,
    called from exactly TWO places (`generateProgram.ts:939` and `:1469`), both
    of which already hold the week's date and the active constraints. **The
    build: drop a weekday from `teamTrainingDays` when that weekday's DATE in
    the week being planned falls inside a live `travel` span.**
    **THE BLAST RADIUS IS SMALL AND THE REASON IS CHECKABLE: the filter is
    INERT unless a travel fact is live, and no scenario or QA week has one** —
    so the 120-session distribution and the 17 QA weeks cannot move. Run them
    either side anyway and report both numbers.
    **A FIXTURE INSIDE THE SPAN IS THE SECOND HALF and is NOT the same shape** —
    a game is an anchor the week is built around, not a plan flag, so it needs
    its own measurement before anyone touches it.
    **BUILT, MEASURED, AND THEN BACKED OUT — 2026-08-13, and both reasons are
    worth more than the code was.**
    **IT WORKS.** With the filter in, a week planned inside a live trip has NO
    team day at all: Tue "Team Training + Upper Pull" and Thu "Team Training +
    Upper Push" become "Lower Body Strength" and "Upper Push", **and the athlete
    still trains the same five days.** Three cells held it, non-vacuity first,
    and removing the filter reds the middle one. `test:qa`'s team-day check
    stayed green and its failure count did not move (84 either side).
    **REASON 1 — MY OWN RED, AND IT IS A REAL FINDING, NOT A NUISANCE:**
    `test:action-walker` L4b *"SCREEN = DOMAIN after away_this_week"* goes red —
    *the resolver says "Hard Conditioning", the screen says "Hard Intervals"*.
    Proven mine by neutralising only the filter (walker returns to 23/23). **A
    week without team days is a week shape those two namers had never both been
    asked about**, so this is a latent naming disagreement the away filter
    UNCOVERED. **It must be fixed, not suppressed, and it is the first act of
    the next pass.**
    **REASON 2 — THE FILE IS NOT FREE.** `coachingEngine.ts` carries the other
    seat's uncommitted `[COD_STAGE]`/`[COD_ELIG]` probes and their two type
    errors (`FinisherDecision.category`/`.downgraded`, `:3797`), so
    `test:compile` cannot pass and my change cannot be committed without
    carrying their unfinished work. **Backed out rather than left sitting in a
    shared generator file another agent is mid-edit in.**
    **NOTHING IS LOST: the build is four edits and all four are named above.**
    The desktop agent has UNCOMMITTED edits in `temporarySourceFactTransaction.ts`
    (last write 05:10) plus four more files, and a `.git/index.lock` stale since
    05:31. **The edit is exactly this item's fix:** `isRuledDerivingConstraint`
    gains `type === 'equipment'` and `scheduleKind === 'travel'`, moving both off
    the INERT lane and onto the DERIVING one.

    **AND THE CHAIN CLOSES — VERIFIED, so its owner does not have to re-find it.**
    The deriving lane calls `commitDerivingSourceFactScopedRegen`
    (`temporarySourceFactTransaction.ts:438`), which calls `generateProgramLocally`
    (`:531`) with the constraints threaded; that is `generateProgram.ts:909`, and
    at `:683-697` it builds `hardPostGenerationConstraints` — **`type ===
    'equipment'` plus any `schedule` kind except `busy_week` and `max_sessions`,
    so travel and equipment BOTH pass the filter** — and runs
    `validateWorkoutAgainstActiveConstraints` over every workout. **That is the
    away rule, reaching a week that already exists.** The boundary report's
    "what it would take" is the shape being built.

    **STILL UNPROVEN AND STILL THE ONLY THING THAT COUNTS: the phone.** No device
    pass has been run on this. **Two green suites have now agreed with a screen
    that had not moved** — do not report it delivered on a suite.

    **THE ACCEPTANCE TEST IS NOT A SUITE. It is a phone, a week that already
    exists, and the change appearing on it.** Nothing else counts as done for
    this item. **A green suite has now twice agreed with a screen that had not
    moved.**


---

## THE CARD HUNT, archived from the inbox 2026-08-13

  **THE INSTRUMENT WAS FIXED AND IT FOUND THE REAL LINE. 2026-08-13.**
  **THE INSTRUMENT FAULT WAS THREE ORPHANED METRO PROCESSES ON ONE PORT** — the
  app connected to one holding an old cache, so edits compiled and never landed.
  `pkill -f "expo start --dev-client"`, ONE fresh `--clear` start, then a CONTROL
  (change an existing log's text) and the TEST in the same edit: control 18 hits,
  so the bundle is fresh. **Every "it never fired" conclusion taken before that
  is void.**
  **AND THE REAL DEFECT: `resolveWeekWithConditioning` HAS THREE EXITS, NOT TWO.**
  The no-season guard, **`return section18TierFour({...})` at `:1894`**, and the
  final line. **A real week has a stored §18 contract, so it leaves at the middle
  one** — which is why every filter added at the BOTTOM of that function over two
  days never ran. Wrapped: `return applyAwayPass(section18TierFour({...}), state)`.
  **SEEN ON GLASS, and it is the first athlete-visible win of this item: the
  Saturday card changed from "Game Day" to "Training Day".**
  **STILL SHOWING: the team night.** "Strength + Team Training" survives, because
  the card's words come from the visible projection's PARTS and a team part is
  emitted by `getSessionComponents` from `teamState.hasTeamTraining ||
  workoutNameHasTeamTraining(workout)` — the club is in the NAME, and
  `getTeamTrainingWorkoutState().displayName` does NOT rewrite a composed name
  when the day carries no team-training ROWS (measured: it returns
  "Strength + Team Training" unchanged).
  **TWO BLIND FIXES FOR THAT WERE TRIED AND REVERTED** — setting `isTeamDay:
  false` and stripping the name segment — and together they made it WORSE on
  glass: the day lost its strength half and read "Team Training" alone. **Do not
  patch the name. The next act is to make the away pass remove the team PART at
  the component owner (`getSessionComponents`), which is where the card's words
  actually come from.**
  **THE PASS IS KEPT** — it is correct, tested and live for the resolver's other
  callers — but **the athlete's week is unchanged by it, and the screenshots
  still show the club.**
- **ANSWERED 2026-08-13 — a game inside the trip DISAPPEARS.** Sam: ***"yes it
  should disappear OBVIOUSLY YOU'RE NOT GOING TO BE THERE"***. **Built the same
  day** — the fixture is dropped at the plan, so the week loses its taper and
  its G+1 with it. **Do not re-ask.**
- **ANSWERED 2026-08-13, NOW PART OF ITEM 28 — away and the club.** Sam:
  ***"yes clear team training and games while away"***. **Do not re-ask.** Built
  the same day; see item 28 for what is WORKING and what is only BUILT.
- **ANSWERED 2026-08-13, NOW ITEM 21 — the team-night size question is
  CLOSED and its premise refused.** Sam: a team night's strength session is
  **a normal strength session**; the only difference is ORDER (prefer not to
  put lower body or sprint work before training, but allow it when that is
  the only room). **No team-night floor, in either direction. Do not
  re-ask.**
- **RULINGS-CHECKED: NONE — and this is not a question, it is a waiting-list.**
  Nothing here asks Sam anything; it records what is built and needs his phone.
  The Wednesday game-day check (`06401d92`), the Renee UI pass, and the craft
  tier's hydration relocation are all **BUILT, awaiting device acceptance**.
  When he rebuilds, the white screen after a refused dev launch is expected and
  now names its own cause (`docs/WHITE_SCREEN_BOUNDARY_2026-08-10.md`).
- **⚠ STALE, CORRECTED 2026-08-13 — THE FILES ARE CLEAR AND ITEM 3 IS CLOSED.**
  This entry said item 9's four-answer collapse and item 3's remaining step were
  waiting on files another agent held. **`section18CraftTier.ts` and
  `projectVisibleWeek.ts` are both clean, unedited since 2026-08-12.** Item 3
  owed nothing — both its laws are `guarded` and green — and is archived.
  **Item 9 is workable whenever someone picks it up; it is not blocked.**
- **ANSWERED 2026-08-12, NOW ITEM 16 — the day/week modifier indicator.**
  Sam: *"yes — one line on week, small card on day, read-only both"*. Moved
  out of this section into the queue. **Do not re-ask.**
- **ANSWERED 2026-08-13 — BUILT. Sam: *"add the popup"*.** `ModifiersSheet` now
  stands between the notice and My Status on both Program shapes, with his
  prototype's five strings signed verbatim. **Do not re-ask.** One follow-up
  question it raised is the entry directly below.
- **ANSWERED 2026-08-13, NOW ITEM 23 — the short phrase per modifier kind is
  SIGNED and the column question is closed with it.** Sam: *"i'd rather them
  shortened"*, then ***"signed"*** on the four phrases in item 23. **It was FOUR,
  not the three every doc said** — excluded and pinned are opposites sharing one
  builder. The rows become two columns for every kind that HAS a phrase; soreness
  and the generated programme-effect notes keep their own sentence on purpose and
  stay one column. **Do not re-ask.**
   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 22).

### The card, finished on glass

**GAME: OFF.** Saturday went from "Game Day" to "Training Day" after the third
exit was wrapped.

**TEAM NIGHT: STILL SHOWING, and shipping the fix would have been worse.** The
card's words come from `getSessionComponents`, which reads the team part from the
NAME and the strength part from `isTeamDay`. On a SYNTHETIC day, clearing both
gives `["strength"]` — the right answer, pinned by `test:away-flow` [16]-[16d].
**On the REAL day it does not:** the card came back reading "Team Training"
ALONE, his gym session gone from it. That is the name-only outcome, so the real
workout carries its team identity somewhere those two fields do not reach — its
`sections`, most likely. **Reverted: taking his session off the card to hide a
label is a worse app than the label.**


---

## ITEM 28's INBOX BODY, archived 2026-08-13

28. **THE AWAY FLOW IS BUILT — AND AWAY STOPPED DELETING THE ATHLETE'S WEEK.**
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 28).**
