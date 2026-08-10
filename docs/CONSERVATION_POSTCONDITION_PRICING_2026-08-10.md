# PRICING — CONTENT CONSERVATION AS A DOOR-LEVEL POST-CONDITION

**Seat order (item 1):** *"content conservation becomes a DOOR-LEVEL
post-condition ... Price it before building; if a door-level post-condition is
wrong for a reason the price reveals, say which and stop."*

**VERDICT: IT IS WRONG, AND THE PRICE REVEALED WHY. STOPPING AS ORDERED.**

The unit as ordered would build a second copy of something that already exists,
aimed at a defect it cannot distinguish from correct behaviour.

## FINDING 1 — THE DOOR-LEVEL POST-CONDITION ALREADY EXISTS AND ALREADY RAN

`commitAthleteSessionMoveTransaction` (`acceptedStateTransaction.ts:3396`) calls
`detectAthleteMoveContentLoss` (`:3338`) on **every** move, including the absorb
path — the code explicitly handles `placedSessionAbsorbsTarget` and reasons about
it in its own comment. On violation it **rolls back in-memory and throws**, with
typed codes `athlete_move_content_not_conserved` /
`athlete_move_duplicated_session`.

The generic machinery exists too: `commitVerifiedAgainstVisibleWeek`
(`planChangeProducer.ts:2535`) commits, re-resolves the week the athlete sees,
and on failure restores the exact prior surfaces and returns a typed refusal.

**So the law is not unguarded. It is guarded at a granularity the defect slips
under.** Its unit is **session identity** (`planEntryId ?? id`) — *did the
session survive as an object*. In an absorb, the surviving object is the combined
day, and it survived. **A power ROW inside it was deleted, and a multiset of
session identities cannot see inside a session.**

This corrects the sixty-third boundary, which recorded attribution as open
between `stackTemplate` and §18. It also corrects my registry row
`LAW-conservation`, whose `UNENFORCED` state was right about the defect and wrong
about the reason — the row is updated rather than left standing.

## FINDING 2 — THE DELETION IS ATTRIBUTED ALREADY, AND THE REASON IS THROWN AWAY

`power_removed` is not a silent drop. `workoutCanonicalisation.ts` pushes a
**typed, reasoned action** every time — `{ kind: 'power_removed', item, reason }`
— with reasons like `early_offseason_power_blocked`,
`section18_safety_power_blocked`, `game_proximity_power_blocked:G-2`, or
`alignPowerToFinalWorkoutContent`'s own reason at `:573`.

**Who consumes it:** `postGenerationConstraintValidation.ts` (generation-time
only) and three test suites. **Who shows it to the athlete: NOBODY.** No screen,
no component, no coach sentence reads a canonicalisation action.

In the measured case the destination is not game-proximate (this world's only
game is 2026-08-01; the move was 2026-08-11 → 2026-08-10) and the phase is
Pre-season, so the likely path is `alignPowerToFinalWorkoutContent` — power no
longer aligning with a day that became `Team Training + Lower Hinge`.
**NOT PINNED: the exact reason string was not captured; that is one instrumented
run away and it is the first thing the next pass should do.**

## WHY A ROW-LEVEL CONSERVATION POST-CONDITION IS THE WRONG UNIT

**A door cannot tell an authorised transformation from an unauthorised deletion,
because at the door they are byte-identical: rows went in, fewer came out.**

Legitimate, signed, row-deleting transformations already in the product:

- **G-1 routes** — `accessories_only` is *documented* as "drop the main lifts and
  the conditioning"; `take_the_gunshow` sets `hasCombinedConditioning: false`.
- **Deload** — trims accessories by design.
- **§18 safety** — removes prohibited power families.
- **Game proximity** — G-1/G-2 power blocks.

A blanket row-conservation check would red on all of them. That is exactly why
the existing check chose identity and says so in its own docstring: *"so a
legitimate §18 repair that alters a session's prescription is not read as a
loss."* **Rebuilding it one level down would re-open the problem that comment
records having already solved.**

## THE UNIT THIS ACTUALLY WANTS

**Not conservation — ATTRIBUTION.** The reasons already exist and are typed; they
are discarded on the mutation path. So:

1. **Carry the canonicaliser's `actions` out of the mutation path** instead of
   dropping them — the producer already threads results through
   `commitVerifiedAgainstVisibleWeek`.
2. **The post-condition reds on UNATTRIBUTED loss only:** content disappeared and
   no action explains it. Authorised transformations declare themselves and pass;
   `stackTemplate` silently dropping a field does not.
3. **The athlete is told.** *"Done. Session moved — your power work came off,
   you're two days out from a game."* That is the same sentence the seat's
   L-C2/truth-gate work is about, and it is the part Sam would actually feel.

**AND THE TRUTH GATE STILL CANNOT DO THIS, AS ORDERED TO STATE PLAINLY.**
`FORBIDDEN_WHEN_NO_APPLIED` is a list of PHRASES. *"Done. Session moved."* is
**TRUE** — a session did move. The lie is the omission beside it. **No phrase list
can see a deletion.** An attribution ledger is structural, so it can.

## PRICE

| step | size | note |
|---|---|---|
| Capture the actual `power_removed` reason for the measured case | **XS** | one instrumented run; do this first, it may re-aim everything |
| Thread `actions` out of `finaliseWorkoutAfterMutation` on the mutation path | **M** | **73 call sites** — the real cost, and the reason this is not S |
| Unattributed-loss post-condition beside the identity one | **S** | the seam, rollback and typed-refusal shape all exist |
| Athlete-facing sentence for an attributed change | **S–M** | signed copy required, so it is Sam's to word |

**Recommended order: XS first, alone.** If the reason turns out to be
`alignPowerToFinalWorkoutContent` reacting to the combined day, the honest fix may
be in the absorb path's day composition rather than anywhere in this pricing —
and building the M-sized threading first would be building in the dark, which is
what the seat's own item 0 just told us not to do.

**STOPPING HERE PER THE ORDER.** No guard written, no threading started.
