# THE PLAN ENTRY ON A MIXED DAY — MEASURED, NOT ARGUED

The seat's question, verbatim: *"on a Mixed day, is there ONE plan entry or more
than one, and does a whole-day move carry the entry or the DAY?"*

**ANSWER: ONE. And its identity names ONE KIND, chosen by a first-match-wins
precedence in which strength beats conditioning.**

## The receipt

`src/rules/strengthPatternContributions.ts:398-413`

```ts
export function stablePlanEntryId(args: {...}): string {
  const week = ...; const day = ...; const kind = ...;
  return `w${week}:${day}:none:${kind}`;
}
```

That is Sam's field character for character: `w2:monday:none:strength`.

`src/utils/coachingEngine.ts:1421-1430` is the only mint:

```ts
allocation.planEntryId = stablePlanEntryId({
  weekNumber: inputs.weekNumber,
  dayOfWeek: allocation.dayOfWeek,
  contributions: allocation.strengthPatternContributions,
  kind: allocation.isTeamDay
    ? 'team'
    : allocation.strengthPattern
      ? 'strength'
      : allocation.conditioningCategory ?? allocation.tier,
});
```

**One id per ALLOCATION SLOT — one slot per day.** And `kind` is a ladder:
`team` → `strength` → `conditioningCategory` → `tier`. **On a day carrying both
strength and conditioning, `strengthPattern` is truthy, so the ladder stops at
`strength` and the conditioning is never named in the identity.**

That is why Sam's Monday — which the app itself labels `workoutType: Mixed` —
carries a plan entry whose identity ends `:strength`.

## What this is an instance of

`LAW-first-match-wins-hides-its-ordering` (registry): **a cell set with one match
per input can never observe the table's ORDER.** Every fixture that reaches this
ladder with only one of strength/conditioning present gets the right answer, and
the ladder's precedence is invisible. Sam's day matches TWO rungs, which is the
input shape that makes the order observable — and the app has never been fed one
here.

It is also `LAW-count-names-instrument` in its label form, which the seat has now
raised: **`planEntryId` names the ALLOCATION'S DOMINANT KIND, not the day's
contents**, and nothing at the field says so.

## WHAT THIS DOES NOT ESTABLISH — and the line matters

**This is where the measurement stops.** It explains why the identity says
`strength`. It does **NOT** yet establish that the door moves the ENTRY rather
than the DAY, and therefore does not yet explain Sam's symptom. That second half
needs the door read, not this file:

- `programControlActions.ts:809` and `planChangeProducer.ts:2075,2361` both pass
  `planEntryId: sourceWorkout?.planEntryId ?? null` into the move — **measured as
  present, NOT measured as load-bearing.** Whether anything downstream selects on
  it is OPEN-UNKNOWN.
- The seat's second fact — `gatewayStatus: "repaired"` **four times** with
  `rejectionCodes: []` — is untouched here. If the §18 repair is what re-lands
  conditioning, the conditioning is being RE-DERIVED, not moved, and the identity
  above is a lead rather than the cause.

**NO CELL HOLDS ANY OF THIS.** It is a source reading over one export, and Sam's
case stays OPEN.
