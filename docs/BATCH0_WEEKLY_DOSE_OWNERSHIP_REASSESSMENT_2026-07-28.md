# Batch 0 — weekly dose ownership reassessment

**Date:** 2026-07-28
**Unit:** Engine thresholds (Part B of `PROVENANCE_INVENTORY_2026-07-28.md`)
**Ruling being implemented:** Sam, 2026-07-28 — *the week-mode exposure contract is the
single owner of "how many strength sessions this week". `coachingEngine`'s core-session
counts, budget arithmetic and the three override floors become derivations or deletions,
never a second authority.*
**Status:** reassessment only. No product code changed. Required by `CLAUDE.md` before
the deletion.

---

## 1. What is the current source of truth?

There isn't one. There are **two builders and one judge**, and they are set from
different numbers.

| | Owns | Set from | Consumed by |
|---|---|---|---|
| `weeklyExposureContractBuilders` | `strength.targetCount`, `strength.preferred`, `hardDays.preferredCount/permittedCount` | 9 week-mode literals (14 slots each) | the allocator, `weeklyExposureContract` validation, §18 via `restStress` |
| `coachingEngine` | `coreRange` → `actualCore`, `hardCap` → `remainingBudget` | `getCoreSessionCount` (9 phase×readiness pairs), `getHardExposureCap` (9), `countTeamHardExposures` (4), three override floors (8) | `buildWeeklyPlan`, the AI constraint block |

The contract is *already* the nominal owner: `coachingEngine.ts:1124` unconditionally
overwrites `coreRange.min` with `weeklyExposureContract.strength.targetCount`, for every
phase. Twenty-two lines later, three hardcoded floors overwrite it back.

## 2. How many representations of "how much strength this week" exist?

**Five**, in one function, applied in sequence to the same variable:

```
1102  coreRange  = getCoreSessionCount(phase, readiness)        // representation A
1104  coreRange  = early-off-season override (2 or 3)           // representation B
1124  coreRange  = contract.strength.targetCount / preferred    // representation C  ← the owner
1152  coreRange  = {3,4} | {4,4}   shouldTarget4Strength        // representation D
1196  coreRange  = {3,3}           shouldTarget3Strength        // representation D
1220  coreRange  = {3,3}           shouldTarget3StrengthPreSeasonGame
1228  coreRange  = contract.strength.targetCount (pre-season)   // C again, partially
1239  coreRange  = clamp by trainingAgePolicy.maxCoreSessions   // representation E
1251  heavyCoreCap = min(coreRange.max, remainingBudget, availableDays)
1258  + moderateCoreBonus
1260  actualCore = max(coreRange.min, coreSessions)
```

`coreRange` is rewritten **eight times** before it becomes `actualCore`. A reader cannot
answer "why did this athlete get three strength sessions?" without simulating all eight.

Hard days are a **second** two-authority pair on the same page: `coachingEngine` builds
against `hardCap` (phase × readiness, 3–5) while the contract's `hardDays.permittedCount`
(per week-mode, 4–5) is what `weeklyExposureContract.ts:651` and §18's
`permittedHardDayMaximum` **judge** the result against. One number builds the week, a
different number decides whether it was legal.

## 3. Where can the decision be reinterpreted?

- **After the owner has spoken** — lines 1152/1196/1220 discard `contract.strength.targetCount`
  and substitute a literal. This is the single most important seam: the contract wins,
  then three `if`s un-win it.
- **Silently, by budget** — `heavyCoreCap` (1251) clamps by `remainingBudget`, which is
  denominated in hard *days* and spent on gym *sessions*. The code says so itself at
  1169: *"The budget is correct in spirit (hard DAYS per week) but conflates two things."*
- **By an unrelated ceiling** — `getCoreSessionCount`'s only surviving effect after 1124
  is lowering `coreRange.max` (1129). A phase×readiness table nobody cites still caps a
  contract-owned target.
- **Unrecorded** — every reduction the *contract* makes goes through
  `reduceAllocationTarget` and lands in `contract.reductions` with a typed reason. Every
  reduction the *engine* makes is an assignment. The athlete-visible "why is my week
  smaller" story exists for one authority and not the other.

## 4. Which layer should own the decision?

The contract, per Sam's ruling. It already has every input the floors read
(`seasonPhase`, `teamTrainingDayNumbers`, `hasGame`, `selectedDayNumbers`, `readiness`,
`activeInjuries`, `maxStrengthSessions`), it already records reductions with reasons, and
it is already what §18 judges against. What it lacks is **columns**, not information.

## 5. What the contract-owned version deletes

All three are private to `coachingEngine.ts` — verified, no consumer anywhere else in
`src/`, so removal is contained:

| Symbol | Decisions removed |
|---|---|
| `getCoreSessionCount` | 20 |
| `getHardExposureCap` | 9 |
| `countTeamHardExposures` | 4 |
| `shouldTarget4Strength` / `shouldTarget3Strength` / `shouldTarget3StrengthPreSeasonGame` | 8 |
| `moderateCoreBonus` gate | 4 |
| early-off-season core target | 3 |
| **Total deleted rather than ruled** | **48** |

Batch 2's sheet grows by the columns below; Sam's ruling queue shrinks by 48 numbers he
would otherwise have had to rule twice — once in the engine and once in the contract.

Surviving in `coachingEngine`: the readiness capacity rubric (17, Batch 1 — it is an
*input* to the contract, not a second dose authority) and the optional/recovery split
(4, candidate contract columns).

## 6. Behaviour the floors encoded that the contracts must now express

> **SUPERSEDED (Sam, 2026-07-28).** The table below proposed columns keyed on readiness and
> injury (`lowReadinessStrengthTarget`, `severeInjuryStrengthTarget`). Sam's final ruling
> removes both axes: structure comes from phase + schedule facts only, capacity/readiness
> affects dose, and injury flows through its own law family. See
> `BATCH0_RULING_APPLIED_2026-07-28.md` for the reshaped column set. The rest of this
> document stands.

**This is the part that must not be lost.** Each floor exists because a real week came out
wrong; deleting them without expressing what they knew would reintroduce the bug they
fixed. Candidate columns for Sam, for the Batch 2 sheet:

| Candidate column | The behaviour it must preserve | Currently encoded as |
|---|---|---|
| `strengthTargetWithTwoOrMoreAnchors` | Gym work layered on an already-hard team day is not a new hard day, so ≥2 team days should *raise* the strength target, not consume it | `teamTrainingDays.length >= 2` in all three floors |
| `minimumAvailableDaysForPreferredTarget` | The preferred target only applies if the athlete actually has the days | `availableDays >= 5` in all three floors |
| `lowReadinessStrengthTarget` | Low-readiness athletes keep the smaller safety rail | `readiness !== 'low'` in two floors |
| `severeInjuryStrengthTarget` | A severe injury holds the target down regardless of anchors | `!hasSevereInjury` in two floors |
| `moderateStrengthAllowance` | The G−2 upper session is core but low-fatigue and should not consume hard budget | `moderateCoreBonus` (+1) |
| `earlyOffseasonTargetByAvailability` | Early off-season targets 2 when the athlete has ≤3 days, else 3 | lines 1104–1108 |
| `hardDayAccounting` | Whether the budget counts hard *days* or hard *sessions* — **Batch 3's whole question, surfaced as a column** | `getHardExposureCap` + `countTeamHardExposures` |

Note the first four are all the *same shape*: "the target depends on anchors, availability,
readiness and injury." Nine week-mode contracts each declaring one fixed triple cannot say
that. Whether Sam wants per-mode conditional targets or a single shared modifier table is
his call and is the first question Batch 2 should ask him — it decides whether the sheet is
9×14 or 9×21.

## 7. What tests pin the new ownership boundary

Written before the deletion, red first:

1. **Single-authority lock.** `coachingEngine.ts` contains no numeric strength-session
   target of its own: no `getCoreSessionCount`, no `{ min: 3, max: 3 }` literal, no
   `getHardExposureCap`. Source-level, in the mould of `test:single-estimation-owner`.
2. **Derivation, not reinterpretation.** For every phase × week-mode × readiness ×
   team-day-count × available-day combination in a generated matrix, `actualCore` equals a
   value the contract *declared* — either `strength.targetCount` or a value inside
   `strength.preferred`. Never a number that appears in neither.
3. **Every shrink is recorded.** If `actualCore < contract.strength.targetCount`, then
   `contract.reductions` carries a typed entry explaining it. This is the assertion the
   engine path can never satisfy today, and it is the real prize: the athlete's week can no
   longer get smaller without the app being able to say why.
4. **Behaviour conservation.** The three floors' triggering scenarios — pre-season +2 team
   days + no game + 5 days; in-season + game + 2 team days + 5 days; the pre-season game
   analogue — produce the same strength count after the deletion as before. Pinned as
   named scenarios so a regression names the week that broke, not a number.
5. **Hard-day agreement.** The number the engine builds against and the number §18 judges
   against are the same object. Currently they cannot disagree only by luck.
6. **Mutation-proven.** Each of the above shown red by mutation, per the standing rule that
   a guard which has never failed is indistinguishable from one that cannot fail.

## 8. Recommendation

Do not start the deletion until **Batch 2's first question** is answered, because the
column shape decides what the deletion targets. Concretely: ask Sam whether the strength
target varies by anchors/availability/readiness/injury (§6 above) *before* building the
sheet, then delete against the answered shape. Deleting first would mean either
reintroducing the floors as "temporary" contract fields or losing the behaviour they
encode — and a temporary field beside an authored one is the second authority again,
under a new name.

## Not covered

- **The readiness capacity rubric.** It feeds the contract as an input; Batch 1 rules it.
  Nothing here changes what `calculateReadiness` returns.
- **The conditioning and sprint/COD targets.** Same two-authority shape is likely, and was
  not swept for this reassessment. If it holds, it is the same fix and should ride along —
  but that is an assertion to test, not one to assume.
- **`trainingAgePolicy.maxCoreSessions`** (line 1239). A third clamp, from a fourth owner.
  Left in place deliberately: it is a beginner-safety cap, not a phase dose, and folding it
  in would widen this unit past its ruling.
