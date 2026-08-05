# PARKED — 1b: the threshold the flush ruling supersedes does nothing

**Parked overnight 2026-08-05. Blocks: nothing. 1b's implementation continues
around it; this is a correction to the ruling's premise, not a blocker.**

## What the ruling says

`docs/FLUSH_OFFER_RULING_2026-08-05.md`: "Supersedes the signed game-week
threshold at weeklyExposureContractV2 (optionalFlush min 0 → min 1)."

## What the threshold actually does — measured

**Nothing.** `optionalFlush.min` is not read by any enforcement path in the
repo:

- `weeklyExposureContractV2.ts:1224-1226` publishes it as
  `optionalFlush: { permitted: policy.conditioning.optionalFlush.max > 0,
  preferredRange: policy.conditioning.optionalFlush, … }` — only `.max` is
  consulted, for `permitted`.
- `section18EffectiveWeekEvaluator` reads `optionalFlushCount` (the ACHIEVED
  count) and never compares it against `preferredRange.min`.
- `coachingEngine` ~6999 caps placement with
  `optionalFlushes < contract.conditioning.optionalFlush.preferredRange.max`.
  Again `.max` only.

So flipping `min: 0 → 1` on its own changes no derived week. It documents the
ruling; it does not implement it.

## Where the behaviour actually lives

`coachingEngine` ~6987. The pass only ever **demotes an existing conditioning
candidate** to `optional_flush`:

```
for (const session of plan.filter(hasConditioning && !isTeamDay)) {
  …
  if (session.conditioningCategory === 'aerobic_base' && optionalFixtureSafe
      && optionalFlushes < …max) { session.section18ConditioningRole = 'optional_flush'; … }
  else clearConditioning(session);
}
```

In an in-season game week the core conditioning target (`:127` — "in season a
target of 3 is enough", counting TT and games) is already satisfied by 2 team
trainings + the game, so **no candidate is left to demote and nothing is
offered.** The pass has no ability to CREATE the offer.

## What this terminal is doing about it

Implementing the ruling as an OFFER pass — after the demote loop, if fewer than
`preferredRange.min` flushes exist, place one on a fixture-safe off-leg day
(`:127` "Optional conditioning add-ons land on off-leg days") — and setting
`min: 1` so the pass has an authored number to read rather than a literal.

## The question for Sam (no answer needed to proceed)

The ruling says the offer "does not count toward :127's target arithmetic".
Confirmed implementable: the offer is placed AFTER the contract is satisfied
and carries `section18ConditioningRole: 'optional_flush'`, which the evaluator
counts in `optionalFlushCount`, never in `coreCount`. **So the arithmetic is
already separate and nothing further is needed — flagging only because the
ruling asked for it explicitly and this is the evidence it holds.**
