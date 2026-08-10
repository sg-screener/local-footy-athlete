# THE XS: CAPTURE THE REASON — AND THERE IS NO REASON, BECAUSE NOTHING FIRES

**LOOP CHECK:** `attribution-asserted-without-a-probe` — **sighting 3** (the
coach-move "likeliest explanation" retracted when Sam answered; the conservation
order priced WRONG-UNIT; this tape's own two named suspects, both refuted
tonight). **COMPRESS: a tape that prints an ATTRIBUTION it did not probe is
making the same claim-without-a-cell the registry exists to forbid — the tape's
suspects belong behind a probe or behind the word OPEN-UNKNOWN.**

Seat inbox item 1, 2026-08-10. Ordered: *"Capture the actual reason string for
the measured `power+strength → team night` case, and NOTHING ELSE. Then re-price
the M work (73 call sites) against what the string turns out to say."*

## THE ANSWER: THERE IS NO STRING. NOT ONE PRODUCER RUNS.

The case reproduces exactly as reported:

```
source 2026-08-11 Tuesday: power+strength   rows[power:1 -:6]
dest   2026-08-10 Monday:  strength+team_training   ← TEAM NIGHT (absorb)
AFTER  dest 2026-08-10:    strength+team_training   rows[-:6]
✗✗ PARTS THAT DID NOT ARRIVE: power
```

Four probes were installed, the tape run under each, and every probe removed
again. **All four counted ZERO hits on the run that loses the row:**

| probe | what it watches | hits |
|---|---|---|
| `POWER-STRIP-PROBE` | the §18 **weekly power budget** strip (`section18AcceptedWeekGateway.ts:537`) | **0** |
| `CANON-PROBE` | both `power_removed` pushes in `workoutCanonicalisation.ts` (:526, :573) | **0** |
| `S18-PROBE` | both `power_removed` pushes in `section18SafetyFinaliser.ts` (:254, :262) | **0** |
| `STACK-PROBE` | `stackSessionOntoTeamAnchor` / `stackTemplate`, the absorb path | **0** |

Then the widest probe of all, wrapping **the single canonical entry** every
mutation is supposed to pass through — `finaliseWorkoutAfterMutation`, all 73
call sites at once — reporting any call where power rows go in and fewer come
out:

| `ENTRY-PROBE` | power rows lost across the canonical owner | **0** |

**THE POWER ROW LEAVES WITHOUT PASSING THE CANONICAL OWNER AT ALL.**

## WHAT THIS DOES TO THE ORDER

**The seat's premise for row 21 is refuted for this case.** The premise was:
*the reason EXISTS and is typed (`power_removed`, reasoned
`game_proximity_power_blocked:G-2`), and only the TELLING is missing.* That is
true of `workoutCanonicalisation` as a module. **It is not true of the measured
defect**, because that module never runs on this row.

**THE M WORK IS RE-PRICED TO: DO NOT BUILD IT.** Threading the canonicaliser's
typed `actions` out through 73 call sites would have cost a pass and **would not
have caught this defect**, because the deletion never reaches a call site. The
XS was worth doing for exactly the reason item 1 gave — building the M first
would have been building in the dark, and the dark turned out to be a different
room.

**AND THE TAPE'S OWN ATTRIBUTION WAS WRONG IN BOTH HALVES.** Its comment offers
two suspects — *"either `stackTemplate` carries an ALLOW-LIST of fields and this
one is not on it, or the §18 finaliser's `power_removed` budget path re-decided
the day"*. Probed: `stackTemplate` copies **every** exercise from both sides
(`cloneRows(base.exercises), cloneRows(template.exercises)`) and is not reached
on this route anyway; the budget path is not reached either. **A tape that
prints suspects it never probed reads as attribution, and two readers took it as
one.**

## WHAT IS NOW KNOWN, AND WHAT IS OPEN

**KNOWN (measured tonight):** the row is absent from the projected destination
day; no `power_removed` action is produced anywhere in the run; the canonical
mutation owner never loses a power row; the absorb/stack path is not on the
coach's route.

**OPEN-UNKNOWN, and the next unit's whole job — TWO HYPOTHESES, NEITHER
PROBED:**

1. **The row never left the source.** The move may carry a scoped or
   re-composed workout that already excludes the power row, so nothing is
   "deleted" — it is never handed over. The coach's route runs through
   `coachCommandExecutor.ts:3646`, not `planChangeProducer`'s absorb branch.
2. **The row survives in stored state and dies at the PROJECTION.**
   `roleCensusFor` — the instrument that produced *"8 rows in, 7 out"* — reads
   `buildProgramTabProjectedWeek`, **a projection, not stored content.**
   `a count taken for a record`, **sighting 15**: the number names PROJECTED
   rows and the claim was about the athlete's work. **Until stored state is read
   directly, "the power work was deleted" is not established.**

**The next probe is cheap and settles which:** read the destination day's stored
workout rows beside the projected ones, in the same run. One line of the same
tape.

## NOT COVERED

One world, one seed, one route (the coach's). The athlete's own tap onto a team
night was not probed tonight. Nothing here says whether Sam's real Wednesday took
this path — his case was **conditioning**, and conditioning survives this route
in every seed generated so far. **His case is still not closed.**
