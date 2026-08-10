# CENSUS ROW 1 + THE DESTINATION AXIS — BOUNDARY, 2026-08-10 (sixty-third pass)

**ONE LINE:** L-C4's first row is built and the parity break it named is measured
CLOSED in the same tape that measured it broken — and hunting Sam's multi-part
catch found that every tape in this repo had been landing sessions only on EMPTY
days, so the absorb path was untested, and driving it **deletes a part of the
day while the coach says "Done"**.

`ddf285d4` (row 1 + L-C4) · `8be617c6` (the destination axis)

## NORTH STAR

**TOWARD.** Row 1 REMOVES a representation rather than adding a guard: the
coach's private assumption about what an omitted scope means is deleted, and the
one owner (`moveOptionsForDay`) answers for both surfaces. No new stored state —
`CoachChangeCard.choices` is derived from the owner's list at proposal time and
dies with the card.

## WHAT WAS ORDERED AND WHAT HAPPENED

| Inbox item | Outcome |
|---|---|
| 1 — retract the dead hypothesis | **DONE**, in `NOW.md` and the tape's own comment |
| 1 — re-run the multi-part section over a generated week | **DONE, AND THE PREMISE WAS HALF WRONG** — see below |
| 2 — build census row 1 with the scope | **BUILT**, gate 127 → 137 cells |
| 3 — coach-tab undo, folded into the L-C3 run | **NOT DONE — blocked**, see STOP |
| 4 — acknowledgement | no action, as stated |

## ROW 1 — THE OWNERSHIP MOVE

`coachProposal` omitted `payload.scope` deliberately, reasoning *"an omitted
scope is the door's whole-day move, which is what was asked for"*, and **never
read the owner**. On an anchored day the picker offers `strength` and `team` and
NO `whole_day` row, so that scopeless move is refused where the athlete's own tap
carrying the picker's `strength` row applies.

It now takes `PlanChangeMoveOptions` from `listPlanChangeOptionsForDay` — the
sheet's own call — and renders the owner's own rows. The rule stays **pure**: the
screen makes the call and hands the answer over whole, because a rules module
that could reach the producer could grow the second opinion L-C4 forbids.

**MEASURED, in `tape:coach-move-durability`:**

```
anchored Monday   picker offers [strength, team]
                  coach offers  [strength, team]   SAME LIST? YES
                  door: refused ("protected game/team anchor") → APPLIED
plain two-part    picker [whole_day, strength, conditioning]
                  coach  [whole_day, strength, conditioning]  and payload sends
                  NO scope word — absent IS the door's spelling of whole_day
```

## THE DESTINATION AXIS — AND IT IS A FLAW IN OUR INSTRUMENTS

The seat's suspicion was that the fixtures were hand-built. **The source was
already generated.** The hand-built half was the DESTINATION: `chooseMove` and
`choosePartedMove` both pick a target with NO parts, so
`stackSessionOntoTeamAnchor` had never been exercised by any arm of any tape.
Sam moved onto a Wednesday; every Wednesday in this world is a team night.

```
source Tuesday   power+strength          rows[power:1 -:6]
→ team night     strength+team_training  rows[-:6]           ✗ power ROW deleted
→ empty day (control, same run)          rows[power:1 -:6]   ✓ intact
```

Destination-dependent, with the control in the same run. **Rows are printed
beside parts** so content loss is never confused with naming loss.

**ATTRIBUTION IS OPEN AND IS NOT GUESSED AT:** either `stackTemplate` carries an
allow-list of surviving fields and power is not on it, or the §18 finaliser's
`power_removed` weekly-primer path re-decides the day. Both named in the output.
**No cell holds either.**

## WHAT IS *NOT* CLOSED — SAM'S OWN CASE

His symptom was **conditioning**, not power, and conditioning **survives** this
path in every generated seed, because every generated Mixed day carries a
`conditioningBlock` — the field `hasConditioning()` reads. Same defect class,
different part. **His case remains NOT REPRODUCED and is reported as that.**

**A LATENT CONTRADICTION FOUND AND DELIBERATELY NOT SHIPPED AS THE CAUSE:**
`hasConditioning()` omits `'Mixed'` while `hasStrength()` includes it, and the
same file's `combinedWorkoutType` DEFINES `'Mixed'` as strength AND conditioning.
Proved by direct probe that a Mixed session stacked on a team anchor loses every
conditioning field. Unreachable from generation today. **Latent, not the cause.**

## GATE

- `test:coach-tab-slice3` **137/137** (was 127). Section [8] added.
- **MUTATION-TESTED:** blanking the owner read reds exactly the four cells that
  claim the parity, and leaves the branch cells green.
- **TWO CELLS FIRST PASSED VACUOUSLY** (`.every()` over an empty list) and now
  assert the list was exercised — `a bind can be green and empty`.
- **ONE CELL WIDENED, SAID PLAINLY:** *"the composer is still mounted while a
  card is showing"* bounded its regex at 200 chars; two new props pushed the JSX
  past it. The property never changed. Widened to 600, not relaxed.
- **SWEEP: 174 suites, 3 failures** — `program-control-durable`,
  `fixture-identity`, `fact-door-inputs` — **all three byte-identical at
  baseline, verified by stash. Zero regressions.**
- `test:compile` PASSED, totals byte-identical **35/51/373**.

## NOT COVERED — FIRST LINE: NO GLASS

**NO REACT, NO DEVICE, NO KEYBOARD.** The scope chooser is a SHAPE; nobody has
tapped it. `ChangeCard`'s new rows are asserted at SOURCE and by pure cells only.
The simulator rebuild Sam approved was **still running** when this landed.

Also not covered: a THIRD destination shape — a day carrying a full gym session
but no anchor, where the move TRADES rather than absorbs. The power-loss finding
has **no cell**; it is a tape comment and a printed measurement.

## STOP — WHAT THIS PASS COULD NOT DO AND WHY

**ITEMS 3 AND THE L-C3 RUN ARE BLOCKED ON A BUILD THAT HAD NOT FINISHED.**
`npx expo run:ios --configuration Debug` was started as soon as Sam's approval
cleared the hold, and was still compiling at the end of the pass. Everything
needing glass is therefore still owed:

1. the L-C3 keyboard matrix, never executed — treat its first run as AUTHORING;
2. the coach-tab Undo toast — `UndoToast` mounts only at `HomeScreenV2.tsx:1225`,
   `CoachTabScreen` mounts nothing; the "burns its timer behind the tab"
   hypothesis is still **OPEN-UNKNOWN**, exactly as it was;
3. the new scope chooser, unseen — and it is the first coach surface with a
   selectable row, so it is the one most likely to be wrong on a real screen.

**This is a measured stop, not an unstarted one.** The single act that clears it
is the build completing, then
`E2E_METRO_URL=http://127.0.0.1:8081 npm run e2e:maestro:ios -- .maestro/keyboard/coach-tab-keyboard.yaml`.
