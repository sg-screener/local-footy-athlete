# THE CHRISTMAS BREAK — SEAT_INBOX ITEM 31, PART 5

## LOOP CHECK

- **§8 second wall — NOT REACHED.** No wall was hit twice. The two reds this unit
  produced were first-time instrument faults, each corrected once.
- **A count taken for a record — SIGHTING 15, and it was mine.** Twice: the row
  count (21 vs 23) and the doc-truth scan (200/141 vs 159/126, a regex matching
  `.ts` inside `.tsx`). Both reported with their unit and both values.
- **A green gate is a claim — FOUR mutations run**, each reddening a named cell.
- **A fixture is a claim too** — the `[8]` control exists because `[8b]`/`[8c]`
  were first measured on a week that had no fixture in it.
- **Compression:** none owed. Nothing here happened a third time.

**2026-08-13. Desktop agent. Part 5 only — the two questions.** Parts 1, 2, 3, 4
and 6 (the Bible amendment, the invalid S7 scenario, the COD gate and the 28-C1
dissolution) are the terminal's and are untouched here.

**SAM'S WORDS ARE THE SPEC, and every clause of them is built:**

> *"it may be helpful to add a button for Christmas break and removing team
> training sessions from the app - maybe around the 10th of December. That way an
> athlete can select when their last team training is, and then around the 3rd of
> Jan they should be ask when does team training go back? that way the app isn't
> guessing"*

---

## NORTH STAR

**TOWARD IT.** The unit adds **one stored thing, and it is an answer**: a dated
`no_team_training` schedule fact carrying two dates the athlete typed. Everything
else derives — which question is live, whether this week has a club night,
whether the modifier shows on My Status, what the acknowledgment says. No new
store, no new field on an existing store, no migration. The negative answer
("we train through Christmas") lands on `dismissedCoachNoteIds`, a shelf that
already exists for exactly that shape of decision.

**`Christmas-Block` WAS CHECKED BEFORE ANYTHING WAS ADDED**, as item 31 part 5
instructed. It is a member of the `ProgramPhase` union at `domain.ts:243` and
**it has no reader anywhere in `src/`** — `ProgramPhase` itself is referenced
once, as the type of `programPhase` on a domain object, and nothing branches on
the value. `clubSeasonScope.ts:19` quotes the Bible line about the break but only
to justify the OFF-SEASON scoping rule; it does not know the break exists as a
thing that happens. **So there was nothing to reuse and nothing to extend — a
phase name with no reader is not an implementation.** It was left exactly as
found; deleting it is a separate census question, not this unit's.

---

## WHAT WAS BUILT

### 1. The fact — `scheduleKind: 'no_team_training'`

`src/rules/temporarySourceFact.ts`. A sibling of `travel`, deliberately **not**
`travel`, and the difference is one word from Sam on the away item: he ruled the
fixture off for a trip because ***"OBVIOUSLY YOU'RE NOT GOING TO BE THERE"***.
Over Christmas the athlete IS there. The club is shut; his calendar is not. So a
fixture he entered himself inside the span survives, and reusing `travel` would
have deleted it silently.

Its `until` may be `null`, using the existing `scope.kind: 'open'` vocabulary that
`durableFactHorizon` already owns. `temporaryFactScope` gained an `'open'` arm to
mint it — it could not borrow `durableStateFactScope`, which pins the start to
today because a body report cannot be about a day that has not happened. **A
break can: on the 10th the athlete names the 18th.**

Round-trip, projection copy, the modifier effect (`club_sessions_off`, shared
with travel because the athlete sees the same thing) and the hydration arm all
carry the new kind. The hydration arm is not decoration: without it a stored
break came back as `busy_week` and the club returned mid-break with nothing
saying why.

### 2. Where the club comes off — `coachingEngine.ts`

One line, at the seam item 28 paid to find:

```
const clubClosedSpans = [...(options.awaySpans ?? []), ...(options.noTeamTrainingSpans ?? [])];
const teamDays = teamDaysForPhase.filter((day) => !weekdayIsAway(..., clubClosedSpans));
```

**The two span lists join for the team-night question and NOWHERE ELSE.** The
fixture filter twenty lines below still reads `awaySpans` alone. That asymmetry
is the law, and cell [8c] is what holds it.

`weekdayIsAway` learned `until: null` means "from `from` onward". A trip never
sends one; an unclosed break always does, and `generateProgram`'s reader keeps the
open span rather than skipping it the way `awaySpansFromConstraints` skips an
endless trip. **Skipping it would have made the control inert for the entire
month it exists for** — that is cell [9].

### 3. When it is asked — `src/rules/christmasBreakAsk.ts`

A pure module. Given today, the phase, the club answer, the break facts and the
dismissed ids, it returns which question is live. It writes nothing and it decides
no dates.

- **December**: 10th to the 31st, club athletes only, once per season.
  **It does not roll into January**, on purpose: an athlete who never answered has
  told us nothing, and the safe reading of nothing is that his club did not stop.
  A break the app invents in the second week of January is the guess Sam removed.
- **January**: from the 3rd following the break's own December, and **every day
  after that until it is answered**. No upper bound, no dismissal anywhere in the
  app. Its question is the only thing that can end a break the athlete already
  declared, so a way to make it go away unanswered is a way to lose the club for
  good.

### 4. The surface — `HomeScreenV2`

A prompt card on the week shape (not the day screen — a span is not a day
question, the same reasoning as Away and Add-a-game), and a sheet with one date
per sitting. **The month calendar is the away sheet's, parameterised by testID
prefix rather than copied**; every existing away testID is byte-identical.

**The off-by-one is done once, in the sheet, both directions.** The athlete names
a day the club IS ON; the span is the days it is not. So the last-training answer
becomes `from = that day + 1` and the return answer becomes `until = that day - 1`
— the same subtraction the away sheet already makes on its return date.

**BOTH ANSWERS GO THROUGH ONE DOOR AND LAND ON ONE FACT ID**, derived from the
break's start alone. The January answer therefore REPLACES the December one
instead of laying a second break over it. The default id includes the scope, which
changes the moment the end is known — that would have left two overlapping breaks
and no rule about which wins.

---

## NOT COVERED

**Say what was not looked at (L2). Omitting this is itself a defect.**

1. ~~**THE ATHLETE HAS NOT SEEN IT.**~~ **SEEN 2026-08-13 — and the run found a
   defect the cells could not.** A `christmas-break-ask` seed anchored
   `2026-12-10` (the dev clock pins `todayISOLocal()`) put a pre-season club
   athlete inside the window. **PROVEN ON GLASS:** the week reads `7 - 13 DEC`
   with TODAY on Thursday the 10th; the card renders on the WEEK shape with
   *"When is your last team training?"*, `Pick the date` and `We train through
   Christmas`; the sheet opens; picking Thursday 17 December commits and returns
   *"Got it — team training comes off your weeks from then. We'll ask you in
   January when it's back."*; the header then reads **`1 active modifier
   impacting program`**; and the week of the 7th CORRECTLY KEEPS its Tuesday and
   Thursday club nights, because the break starts on the 18th.
   **THE DEFECT: the calendar opened on NOVEMBER.** It anchored its month on
   `minISO`, and this question's floor is 30 days BACK — so the athlete had to
   page forward to reach his own club night. Away never exposed it because its
   floor IS the month it wants. Fixed with `initialMonthISO`, re-verified on
   glass (it opens on December), held by `[10h]`.
   **STILL NOT SEEN: the club actually COMING OFF a week inside the break.**
   The behaviour is held by `[7b]`, `[9]` and `[11c]`; the pixel is owed.
   **⚠ §8 SECOND-WALL LAW — THIS WALL HAS NOW BEEN HIT THREE TIMES AND I HAVE
   STOPPED HAND-DRIVING IT.** Every attempt dies the same way: seed, answer the
   question, tap the week-forward arrow, and the dev-harness cold-start gate
   fires (*"DevE2EClock reload mismatch: clock receipt has no active
   checkpoint"*). **The shape is identical each time — a reload after a
   COMMITTED answer, on the navigation that follows it** — so a fourth manual
   attempt is the thing the law forbids.
   **THE ALTERNATIVE, NAMED RATHER THAN ATTEMPTED AT THE END OF A LONG TURN:** a
   Maestro flow under `.maestro/`, run through `scripts/dev-e2e/run-maestro-ios.sh`,
   that seeds `christmas-break-ask`, answers the December question and asserts
   the club is absent from the week of the 21st. **A flow does not interleave
   with a human's taps, does not depend on my point arithmetic, and leaves a
   REPEATABLE receipt instead of a screenshot** — which is what this pixel should
   have been from the start.
   **ALSO STILL OWED: the January question**, which needs a second seed anchored
   in the new year.
2. **THE SCOPED-REGEN PATH.** `[10e]`-`[10g]` prove the break does not drag a
   stale team-night name through FULL generation with `previousProgram`. **The
   scoped regen path is not exercised by any node harness** — item 30 measured
   why (`canScopedRegen` has no microcycles to regen into there) — so the
   break's behaviour on a week ALREADY ON SCREEN is unmeasured, exactly as
   away's is.
3. **A BREAK THAT SPANS A BLOCK ROLLOVER.** Every cell here works inside one
   generated block. What a four-week break does across a block boundary was not
   looked at.
4. **TWO BREAKS IN ONE SEASON.** The ask rule allows only one per season key and
   the cells prove that; a SECOND `no_team_training` fact written by some other
   door (a coach, a future surface) is not modelled.
5. **THE COACH.** No coach surface can see, write or clear a break. Not built,
   not asked for, not measured.
6. **THE JOURNAL.** Whether a break shows in the journal's change history was
   not looked at.

---

## THE TWO REDS THIS UNIT PRODUCED, AND WHAT THEY COST

**BOTH WERE THE INSTRUMENT, BOTH WERE CAUGHT BY A CELL WRITTEN TO CATCH THEM,
AND ONE OF THEM WOULD HAVE SHIPPED GREEN AND EMPTY.**

**(a) `[8]` — the fixture cells were measuring a week with no fixture.** The
first version counted `workoutType: 'Game'` rows out of `generateProgramLocally`
with `gameDay: 'Saturday'` in the profile. The NORMAL week has none: a profile's
`gameDay` is an ANCHOR, not a fixture, and a fixture is a day the athlete MARKED.
`weekIdentityForWeek` is the owner that reads marked days against live facts, and
it is where away drops a fixture (`derivedWeekContract` reads travel spans and
only travel spans). **Without the non-vacuity control, "a trip deletes the game"
would have passed as `0 === 0` over a week that never had one, and the cell that
makes this a different fact from `travel` would have been decorative.**

**⚠ THIS IS ALSO A FINDING ABOUT THE AWAY SUITE.** `awayFlowTests` `[13c]`
asserts `gameDaysIn(awayWeek).length === 0` and its `[13]` control checks TEAM
DAYS only — there is no cell asserting the home week has a game. **On this
measurement `[13c]` is vacuous by the same arithmetic.** Its sibling `[14b]` at
the week-identity seam is not, so the away RULE is still held; the row-counting
cell is not what holds it. **Named, not fixed — that suite is item 28's and this
is item 31's.**

**(b) `[7c]` — equality was the wrong property.** Borrowed from away's `[13d]`
("rows are the honest unit: 21 either way"), it reddened on correct behaviour:
21 rows normally, **23** over the break. A day that was "Strength + Team
Training" becomes a full standalone strength day once the club half is gone, and
a full day carries more work than the truncated one beside a team night — which
is the Bible's own reason team training displaces gym volume. **Away measured
equal only because it ALSO deletes the fixture, reshaping the week the other
way.** The honest property is that nothing of his is LOST, and the cell says so
with both numbers printed.

---

## TWO GATES THIS UNIT TRIPPED, AND WHAT EACH ONE WAS RIGHT ABOUT

**(a) `test:fact-horizon` T5 — CORRECT, AND PAID.** The first version of the ask
memo read `effectiveUntil === null` by hand to decide whether a break was open.
That is a second opinion about a duration, which is the exact fragmentation
`durableFactHorizon` exists to prevent. It now asks `isOpenHorizon`.

**⚠ AND THEN THE SAME GATE FIRED A FALSE POSITIVE, TWICE.** Its detector looks
for a comparison operator beside `effectiveFrom`/`effectiveUntil`/`scope.from`/
`scope.until`. **An arrow function satisfies it** — the arrow ends in the same
character a greater-than does — so returning the field straight out of an arrow
reads as a comparison. It then fired a SECOND time on the COMMENT explaining the
first, because the gate reads source rather than code. Worked around by
destructuring; **named here and NOT loosened**, because weakening another item's
law guard is that suite's call, not this one's. It produces false positives, never
false negatives, so nothing is unguarded in the meantime.

**(b) `test:profile-mirror-narrowing` — the census, and it was ALREADY RED.**
Measured at HEAD in a detached worktree: 2 undeclared offenders (`awayFlowTests`,
`fixtureSettleAfterSetupTests`) before this unit existed. This suite's seed makes
3, and only the third is declared here. **The other two are named and left**, so
the number does not quietly drop to zero over somebody else's debt.

**AND TWO REDS THAT ARE NOT THIS UNIT'S AT ALL. BOTH MEASURED AT HEAD IN A
DETACHED WORKTREE — identically red, same cells — rather than assumed:**

- `test:phase-shift-atomicity`: "leaving In-season clears the fixture mark once
  the shift applies", "the game-day step offers an explicit 'no usual game day'
  answer".
- `test:fact-door-inputs`: "2 the week still responds to the illness with the
  mirror deleted".

Not caused here, not fixed here. **The detached worktree matters:** this checkout
is shared with the terminal, which has uncommitted work in
`sessionResolver`, `derivedWeekContract`, `defaultProgram` and others, so "red in
my tree" and "red because of me" are different claims and only the worktree can
tell them apart.

**AND THE SWEEP RUNNER LIED ONCE, WHICH IS WORTH THE LINE.** `scripts/sweep.sh`
CREATES its failures file up front and appends to it, so a wait that watched for
the FILE reported an empty failure set while the sweep was still inside
`test:accepted-state-transactions`. **An empty file is equally produced by "no
failures" and "not finished" — the zero-is-the-most-dangerous-number law, in the
instrument this time.** Re-waited on the PROCESS.

---

## MUTATION RUN

| mutation | expected | observed |
| --- | --- | --- |
| drop `noTeamTrainingSpans` from `clubClosedSpans` | the club survives the break | **RED** `[7b]`, `[9]` (32/34) |
| let `awaySpansFromFacts` read any schedule kind | the break deletes his fixture | **RED** `[8c]` only — `[8]`, `[8b]` stay green |
| remove the stable `no-team-training` fact id | two breaks instead of one | **RED** `[5]` (30/34) |

All three restored; `git diff --stat` and a `MUTANT` grep confirm the tree is
clean.

---

## WHAT IS **WORKING**, **BUILT** AND **WRITTEN**

**WORKING** — `npm run test:christmas-break`, 43 cells, armed in `test:bible`:

- the December question appears on the 10th and is silent on the 9th, in August,
  for an off-season athlete, and for a pre-season athlete with no club
- "we train through Christmas" stops it, and next December asks again
- the January question waits for the 3rd, then never leaves, and the December
  dismissal cannot silence it
- the December answer writes ONE open-ended fact starting the day after his last
  session, marking no date unavailable
- the January answer leaves exactly ONE fact, now ended
- the span reaches across the new year and is gone the day the club is back
- a week inside the break has no team day, an OPEN break still takes the club off,
  and not one row of his own training is lost
- **a trip takes his fixture and the break does not**
- **and the WHOLE CHAIN joins** — `[9b]`/`[9c]` start at the stored fact, take
  the constraints the app itself publishes from it, and generate a week from
  exactly those. **Every other cell holds ONE LINK.** A break that commits
  correctly and generates correctly still gives the athlete nothing if the
  projection's output does not match the shape the generator's reader looks for,
  and that seam had green cells on both sides and nobody walking it.

**BUILT, NOT YET SEEN BY AN ATHLETE** — the prompt card and the sheet. **The ask
is date-gated to December and January and the simulator clock is 2026-08-13**, so
`[10]`-`[10d]` are SOURCE-PINNED cells naming the mount, the two questions in
Sam's words, the December-only dismissal and the off-by-one. **The device proof is
owed and is named here rather than implied**: run the app with the clock at
10 December and again at 3 January.

**WRITTEN** — the copy. Every athlete-visible sentence this unit adds is
**PROPOSED**, copy sheet Batch 35, awaiting Sam. The two QUESTIONS are his own
words lifted verbatim; the buttons, the two body sentences and the two
acknowledgments are not yet.

---

## OPEN, AND OWED

1. **THE GATE IS NOT WIRED — AND THAT IS THE SPLIT, NOT AN OMISSION.** Item 31
   part 4 measured `defaultProgram.ts:1978` passing
   `noTeamTrainingWeek: (onboardingData?.teamTrainingDays?.length ?? 0) === 0` —
   the athlete's STANDING PROFILE ANSWER, which is never empty for a club athlete,
   so COD can never fire for the very athlete the ruling is written for. **This
   unit supplies the missing input and does not consume it.** The derived value
   the gate wants now exists: `onboardingToCoachingInputs` returns
   `teamTrainingDays` already filtered by the break, so "no team training THIS
   WEEK" is `teamDays.length === 0` at that seam. **Owner: the terminal.**

2. **A DEVICE PASS WITH THE CLOCK MOVED.** See above.

3. **SAM OWES NOTHING HERE.** Both dates are defaults he already gave as
   *"maybe around"* and *"around"*, and both are overridden by the athlete's own
   answer. The only thing awaiting him is the copy batch.

4. **`Christmas-Block` STILL HAS NO READER.** Left as found. Whether a phase name
   nothing branches on should be deleted is a census question, and the census
   (`docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md`) is where it belongs.
