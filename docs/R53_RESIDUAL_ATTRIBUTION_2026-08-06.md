# R5.3 — THE RESIDUAL, ATTRIBUTED — 2026-08-06

Sam's correction ruled the residual **instrumented before fixing**: attribute
why the gateway's repair never reaches the read, then fix at the owner the
attribution names. This is the attribution. The probe is `R53_PROBE=1` in
`programStore.ts`, env-gated and inert otherwise, on the `D2_PROBE` pattern.

## The question was wrong, and the probe says so

The premise was "the gateway repairs the week and the repair does not reach the
read". **It does reach the read.** The probe fires on the freed week, the
write-back loop runs, `hadOverlay: true`. What comes back is:

```
[R53_PROBE] gateway {"weekStart":"2026-08-10","mode":"in_season_bye_build",
  "status":"impossible","attempts":1,
  "repairs":["obsolete_derived_work_expired","weekly_power_budget",
             "safe_fallback_candidate","weekly_power_budget","offer_withdrawn"],
  "blocking":["required_minimum_shortfall"],
  "coreMin":3,"anchors":["team_training@1","team_training@3"],
  "canonicalByDay":["1:Team Training + Upper Pull","2:Lower Body Strength",
                    "3:Team Training + Upper Push","4:Prehab & Accessories",
                    "5:Gunshow"],
  "hadOverlay":true}
```

The gateway is not failing to deliver a repair. **It never built one.**
`attempts: 1` — the whole-week repair search evaluated a single candidate and
stopped. (`offer_withdrawn` confirms option 2's symmetric half firing correctly
in the same pass.)

## Why `attempts: 1`

`section18AcceptedWeekGateway.ts:705`:

```js
function localRepairCandidates(args) {
  const restShort  = args.evaluation.blockingViolations.some((f) => f.domain === 'full_rest');
  const hardBreach = args.evaluation.blockingViolations.some((f) => f.code === 'hard_day_breach');
  return [
    ...(restShort  ? repairOptionalRestCandidates(args) : []),
    ...(hardBreach ? repairByStackingCandidates({...args, requireHardTarget: true }) : []),
    ...(restShort  ? repairByStackingCandidates({...args, requireHardTarget: false }) : []),
  ];
}
```

The blocking violation is **`required_minimum_shortfall`** — neither
`full_rest` nor `hard_day_breach`. So the generator returns `[]`, the search has
nothing to expand, and the verdict is `impossible` on the first candidate.

**And widening that gate alone would not help**, which is the part worth
recording:

- `repairByStackingCandidates` (:659) only **relocates** existing work — it
  merges a source day onto a target and leaves a rest stub behind. It cannot
  create an exposure that is not already in the week.
- `repairOptionalRestCandidates` only **rests** days.

**Nothing in the whole-week repair engine can ADD a required conditioning
session.** The week is one core conditioning session short, the evaluator says
so precisely, and the repair engine has no move that answers it.

## The owner this names

The only thing in the app that builds conditioning content on demand outside
generation is `section18OfferPlacement.buildOfferSession` — and it is scoped to
the **optional flush**.

So the required core conditioning is in exactly the state the offer was in
before it was fixed. That file's own header records the earlier defect verbatim:

> "The offer used to be placed only in `applySection18ConditioningAllocation`'s
> tail, which runs at generation. Measured: delete an unrelated session from an
> in-season game week and the week comes back with no offer at all — the repair
> path never went through the placer, and nothing else could put one back."

Replace "offer" with "core conditioning" and that is this defect, one line down
the same contract. The fixture change is simply the door that exposed it: a
bye-build week declares 3 core conditioning where the game week declared 3 with
the game paying one, so removing the fixture is the cheapest way to make the
week owe an exposure generation never placed.

**Owner: `section18OfferPlacement`, extended from "present the OFFER your
contract declares" to "present the CONDITIONING your contract declares" — core
as well as optional — called from the same normalisation point in the gateway.**

This is the second use of a pattern that already worked once, and it removes a
representation instead of adding a guard: one placer answering to the contract,
rather than a new repair-candidate generator teaching the search a fourth thing.

## What the fix must do, and must not

- Green **all three witnesses** — §18's `required_minimum_shortfall`, cell 8's
  `role=null`, and `athleteSessionDeletionTests`' 16 seed refusals — **without
  editing any of them.**
- Never place on a day the athlete owns, on a club night, or against fixture
  protection: the day selection reuses the offer placer's existing rules rather
  than restating them.
- The `attempts: 1` finding stands on its own regardless: a blocking violation
  the repair engine has no generator for is a silent `impossible`. Whether the
  gate at :705 should also widen is a separate question and is **not** answered
  here.
