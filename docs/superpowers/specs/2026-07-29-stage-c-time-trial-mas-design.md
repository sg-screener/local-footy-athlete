# Stage C — 2km time trial + MAS (D14)

**Date:** 2026-07-29
**Status:** design approved by Sam 2026-07-29; building
**Sequencing:** inputs-before-engine — Stage C lands before Stage B.

---

## 1. Why this exists

Every `%MAS` prescription in the app is currently a **string**. Fifteen
conditioning template rows carry an intensity like `'90–100% MAS'`, and
`sessionBuilder` renders `masIntensityLabel(15)` plus a standing apology:

> "Don't know MAS? Send your 2km or 3km time trial."

Nothing stores the athlete's pace, so nothing can turn those percentages into a
number they can run to. `masCopy.ts` already contains a calculator
(`estimateMasFromTimeTrial`, `masDistancePerRep`) with **zero consumers** — it
was written against a MAS that never arrived.

D14 (Sam, 2026-07-25) is the input that makes the whole `%MAS` family real. This
stage delivers the input and its owner. Stage B spends it.

## 2. Rulings this stage is built on

| Ruling | Value | Date |
|---|---|---|
| Accepted 2km range | 5:00–15:00 (300–900 s). Out of range = re-ask, plain message, never clamp, never silently accept — same law as bodyweight. | Sam 2026-07-29 |
| MAS derivation | `1.00` — MAS = 2km average speed, no correction. Standard field proxy; the `%MAS` templates were authored against an honest average. | Sam 2026-07-29 |
| Skip defaults by experience | `5+ years` 6:30 · `2-5 years` 7:15 · `1-2 years` 8:00 · `Complete beginner` 8:45 | Sam 2026-07-25, re-confirmed 2026-07-29 |
| Naming | `timeTrial` / `time_trial` explicitly, never `TT` | Sam 2026-07-29 |
| Scope boundary | Stage C delivers the session + eligibility facts. Frequency policy, the D15 selection filter, and per-athlete pace rendering are Stage B. | Sam 2026-07-29 |
| Input control | Keypad, superseding D14's "min/sec roller" | Sam 2026-07-29 |

### The naming collision, recorded

`TT` means **Team Training** in this codebase — twelve rule files key on
`teamTrainingDays`, and `finisherEligibilityTests` documents "game window / TT
day / TT-adjacent finishers". A time trial must never share that token. Every
identifier, type, field, test name and copy string in this stage uses
`timeTrial` / `time_trial` / `two_km`.

## 3. Architecture

### 3.1 Store the time. Derive MAS. Never store MAS.

This is the structural guarantee behind "no second representation of the
athlete's pace". A stored MAS can drift from the time it came from; a derived
one cannot. There is exactly one place in the app that knows what MAS means.

New owner: **`src/data/twoKmTimeTrial.ts`**.

It holds three authored values and one derivation:

```
Accepted range        300–900 s          ruling_anchor, Sam 2026-07-29
Derivation constant   1.00               ruling_anchor, Sam 2026-07-29
Experience defaults   390/435/480/525 s  ruling_anchor, Sam 2026-07-25 + 2026-07-29
```

Derived MAS: `masKmh = 2 ÷ (seconds ÷ 3600)` = `7200 ÷ seconds`.

| Input | MAS (km/h) |
|---|---|
| 5:00 — fastest accepted | 24.00 |
| 6:30 — `5+ years` default | 18.46 |
| 7:15 — `2-5 years` default | 16.55 |
| 8:00 — `1-2 years` default | 15.00 |
| 8:45 — `Complete beginner` default | 13.71 |
| 15:00 — slowest accepted | 8.00 |

Sam's four defaults map **1:1 onto the existing `ExperienceLevel` enum**
(`'Complete beginner' | '1-2 years' | '2-5 years' | '5+ years'`). There is no
gap and therefore no fallback branch — a `satisfies Record<ExperienceLevel, …>`
makes a future enum change fail the build rather than silently pick a default.

### 3.2 The stored answer

```ts
export interface TwoKmTimeTrialAnswer {
  /** Seconds for the 2km. `null` = the athlete answered "haven't tested". */
  readonly seconds: number | null;
  /** ISO date the answer was recorded. */
  readonly recordedOn: string;
  readonly source: 'onboarding' | 'profile_edit' | 'session_log';
}
```

**One shape, not a discriminated union.** This repo does not enable `strict`, so
`strictNullChecks` is off and TypeScript will not narrow on a discriminant — the
reason is already recorded in `onboardingNumericBounds`. A union that does not
narrow buys nothing and costs every caller a cast.

**`null` is a real answer, not an absence.** This follows the `SquatStrength`
precedent, where "I don't squat / not sure" is a first-class enum value rather
than an empty field. It matters mechanically: the onboarding step registry
decides resume position from `satisfied`, so a skipped-but-answered TT must be
distinguishable from a never-seen one. If skipping wrote nothing, an athlete
whose first process died would resume *onto a screen they had already
dismissed*, or — worse, if the step were marked always-satisfied — never see it
at all.

### 3.3 Defaults are applied at derivation, never written into storage

```ts
export interface DerivedMas {
  readonly masKmh: number;
  readonly source: 'measured' | 'experience_default';
  readonly seconds: number;          // the time the MAS was derived from
}

export function deriveMas(
  answer: TwoKmTimeTrialAnswer | undefined,
  experienceLevel: ExperienceLevel,
): DerivedMas;
```

Writing the default into `seconds` at skip time would do two bad things: erase
the difference between the athlete's number and our guess, and freeze that guess
against a later experience-level change. This is the `applyLoadEstimates`
priority ladder — *athlete's actual history beats onboarding estimate* — applied
to pace instead of load.

Every consumer therefore receives the provenance alongside the number and can
say "your MAS" or "our estimate" honestly.

### 3.4 One ingress, four producers

```ts
export function recordTwoKmTime(
  seconds: number | null,
  source: TwoKmTimeTrialAnswer['source'],
  today: string,
): { ok: boolean; answer?: TwoKmTimeTrialAnswer; message?: string };
```

| Producer | Route |
|---|---|
| Onboarding screen | `source: 'onboarding'` |
| ProfileScreen edit | `source: 'profile_edit'` |
| Time-trial session log | `source: 'session_log'` |
| Coach chat ("my 2km is 7:20") | `source: 'profile_edit'` |

The fourth producer is why the law lives at the ingress rather than on a screen:
coach chat is unconstrained free text, so no amount of UI discipline can enforce
the bound. The screen is the ruling's politest face; the ingress is the ruling.

A `session_log` result beats the onboarding answer — the athlete's real run is
real data, same law as weights.

### 3.5 Bounds reuse the existing registry

`twoKmSeconds` joins **`ONBOARDING_NUMERIC_BOUNDS`** rather than starting a
second bounds registry. `NumericBound` gains one optional field:

```ts
/** Renders a bound value for the re-ask message, e.g. 300 → "5:00". */
readonly format?: (value: number) => string;
```

`validateOnboardingMeasurement` uses it when present, producing:

> That time looks off. Enter a time between 5:00 and 15:00.

One validator, one attribution shape, and `onboardingNumericBoundsTests` — which
already asserts the ruling sentence still exists in the attributed document *and*
still states the numbers — extends to cover the new bound for free. The min:sec
rendering becomes a property of the bound rather than a second validator.

## 4. What the athlete sees

Recorded here because Sam device-checks this in the same pass.

### 4.1 Onboarding — new step `TwoKmTimeTrial`

Registered in `ONBOARDING_STEPS`, the single registry from which the navigator,
progress display, resume-after-interrupt, and the generation refusal are all
derived. Placed **after `BenchStrength`, before `ConditioningLevel`** — D14 puts
it "with the squat/bench strength questions".

```
  ← back                              [ step label ]  ▓▓▓▓▓▓░░░░

  What's your recent 2km time?

  Sets your running paces. Skip it and we'll estimate.

     Minutes            Seconds
   ┌──────────┐       ┌──────────┐
   │    7     │       │    15    │
   └──────────┘       └──────────┘

   [ That time looks off. Enter a time between 5:00 and 15:00. ]

   ┌──────────────────────────────────────────────┐
   │  I haven't tested it                         │
   └──────────────────────────────────────────────┘

                                          [ Continue ]
```

- Two keypad fields via `AppTextInput`, mirroring `BodyMeasurementsScreen`'s
  height/weight layout — same component, same inline re-ask, same coverage from
  `keyboardConventionContractTests`.
- The re-ask appears inline under the fields and `Continue` stays disabled while
  the answer is refused. No suggested value is offered: a suggestion is a clamp
  wearing a question mark.
- **"I haven't tested it" is worded as an answer, not an escape.** Tapping it
  writes `seconds: null` and advances. The athlete has answered the question.

### 4.2 Change it later — ProfileScreen

Lives in the existing **Edit player details** sheet, which already owns name /
position / experience and already has the multi-step sheet plumbing, draft
state, and save path. The 2km time becomes a fourth step in that sheet.

It routes through `recordTwoKmTime` with `source: 'profile_edit'`, so the
onboarding path and the update path cannot diverge — the same bound refuses
both, with the same sentence.

*Note for the device pass:* there is currently **no** post-onboarding edit for
bodyweight or height either. This is the first numeric onboarding answer an
athlete can revise without re-onboarding.

## 5. The time-trial session

Stage C makes a 2km time trial schedulable and obedient to the gates that
already exist. It does not teach the assembler when to want one.

- Classified as a **running exposure** by `countWeeklyExposures`, so
  `BIBLE_WEEKLY_CAPS.maxRunningExposures: 4` counts it with no change to the cap
  owner.
- Team-training-day and off-feet placement rules apply unchanged — a time trial
  is a hard run and the existing gates already reason about hard runs.
- Logging a result calls `recordTwoKmTime(seconds, 'session_log', today)`.
- Quality: `aerobic_power`, per D14's "a real aerobic-power session".
- Provenance for the template row: `ruling_anchor` (Sam, D14 2026-07-25) — not
  framework-sourced, and marked as such so the Change Log stays honest.

## 6. Explicitly NOT in this stage

All four recorded as **Stage B requirements**; Sam is carrying the first three
into the Stage B prompt from his side as well.

1. **The 1–3 times pre-season frequency policy.** A frequency rule the weekly
   assembler owns.
2. **The D15 time-trial-day exercise-selection filter.** Sam ruled it as *filter
   selection on a time-trial day, not a pairing ban*. It is a design decision
   from the D15 weekly-assembler session, not existing code, and it belongs to
   Stage B's assembler.
3. **Rendering per-athlete paces into the fifteen `%MAS` template rows.** MAS
   becomes a number in Stage C; turning `'90–100% MAS'` into "run 340 m" is the
   consumer.
4. **The range-vs-binary `%MAS` disagreement — Stage B day-one question.** The
   fifteen template rows carry *ranges* (`'90–100% MAS'`, `'65–80% MAS'`) while
   `masCopy.ts` carries a *binary* rule (≤30 s → 110%, >30 s → 100%). For
   `Classic 4×4` they disagree: the template says 90–100%, `masIntensityForWorkSeconds`
   says exactly 100. Nothing breaks today because both are rendered only as
   text. The moment MAS is a real number they become two representations of one
   intensity and something must own it. The templates' authored ranges
   presumably win over `masCopy`'s unauthored binary — **but that is a ruling
   for Stage B to seek, not to assume.**

## 7. Provenance and gates

Every number in this stage lands authored. The derivation constant, the bounds,
and the four defaults each carry the verbatim ruling sentence and an attribution
naming the document that records it, following `onboardingNumericBounds` and
`anchorMultipliers`.

`masCopy.ts`'s self-contradictory comment — *"actual MAS is typically 1-3%
higher than TT average pace because TTs are run slightly above MAS"*, which
argues for a discount while applying none, and whose two halves contradict each
other in direction — is replaced with Sam's ruling and its date. The derivation
moves to the new owner; `masCopy` keeps the copy and the intensity rule and
imports the number rather than restating it.

Full gates: `npm run test:bible` (which includes `test:compile`), plus the new
suite added to it.
