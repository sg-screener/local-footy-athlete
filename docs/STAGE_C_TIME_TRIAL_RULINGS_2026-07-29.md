# Stage C — 2km time trial + MAS: Sam's rulings

**Date:** 2026-07-29
**Unit:** Stage C — 2km time trial + MAS (D14)

This document is the attribution target for every authored number in
`src/data/twoKmTimeTrial.ts`. `twoKmTimeTrialTests` asserts that each anchor
sentence below is still present here **and** still states the numbers the code
uses — so the code and the ruling cannot drift apart in either direction.

Do not edit an anchor sentence without a ruling. The gate will fail, and that
failure is the point.

---

## Ruling 1 — accepted range

> "2km time bounds ruled (Sam): accept 5:00–15:00. Out of range = re-ask with a
> plain message, never clamp, never silently accept — same law as bodyweight."
> — Sam, 2026-07-29

**Anchor sentence:** 2km time trial accepted range 5:00–15:00.

This is the bodyweight law (`docs/PROVENANCE_INVENTORY_2026-07-28.md`) applied
to pace. A clamp substitutes the app's number for the athlete's and then
proceeds as though they had agreed to it. An answer nobody can interpret has
exactly one honest response: ask again.

Refusal never carries a suggested value. Offering one is a clamp wearing a
question mark.

## Ruling 2 — MAS derivation

> "MAS formula ruled (Sam): 1.00 — MAS = 2km average speed, no correction.
> Standard field proxy; the %MAS templates were authored against an honest
> average. Fix the self-contradictory comment to state the ruling and its date;
> the derivation becomes ruling_anchor with one authored constant."
> — Sam, 2026-07-29

**Anchor sentence:** MAS = 2km average speed × 1.00, no correction.

`masKmh = 7200 ÷ seconds`.

### What this ruling replaced

`src/utils/masCopy.ts` carried an unauthored derivation justified by a comment
that contradicted itself:

> "Conservative estimate — actual MAS is typically 1-3% higher than TT average
> pace because TTs are run slightly above MAS"

If time trials are run *above* MAS, then MAS is **lower** than time-trial
average pace, not higher. The comment argued for a discount, called that
conservative, and applied neither. The number it produced happens to be the one
Sam ruled — but it was never authored, and its stated reason was incoherent in
both directions at once.

### The ruling checked against its own consequences

| Input | MAS (km/h) |
|---|---|
| 5:00 — fastest accepted | 24.00 |
| 6:30 — `5+ years` default | 18.46 |
| 7:15 — `2-5 years` default | 16.55 |
| 8:00 — `1-2 years` default | 15.00 |
| 8:45 — `Complete beginner` default | 13.71 |
| 15:00 — slowest accepted | 8.00 |

## Ruling 3 — skip defaults by experience level

> "a skipped TT gets Sam's signed default pace by experience level (descending
> experience): advanced 6:30, 2–5yrs 7:15, 1–2yrs 8:00, new to training 8:45 per
> 2km."
> — Sam, 2026-07-25, re-confirmed 2026-07-29

**Anchor sentence:** Skipped 2km time trial defaults: 5+ years 6:30, 2-5 years 7:15, 1-2 years 8:00, Complete beginner 8:45.

The four values map 1:1 onto the existing `ExperienceLevel` enum. There is no
gap and therefore no fallback branch.

The default is applied **at derivation, never written into storage**. Writing it
into the stored answer would erase the difference between the athlete's number
and the app's guess, and would freeze that guess against a later
experience-level change.

## Ruling 4 — naming

> "'TT' is Team Training everywhere in this codebase — name the new session type
> timeTrial / time_trial explicitly, never 'TT', so the two never share a token."
> — Sam, 2026-07-29

`TT` means Team Training in twelve rule files keying on `teamTrainingDays`, and
in `finisherEligibilityTests` ("game window / TT day / TT-adjacent finishers").

## Ruling 5 — input control

> "3(a) keypad: approved. […] the real arguments for the keypad are […] no new
> UI component outside the keyboard contract gate, reuse of the proven
> BodyMeasurementsScreen pattern, and the fact that the ingress must validate
> anyway because coach chat is a fourth, unconstrained producer. The re-ask
> ruling lives at the ingress; the screen is just its politest face. D14's roller
> is superseded by Sam's approval here."
> — Sam, 2026-07-29

Supersedes D14's "min/sec roller"
(`docs/PROGRAMMING_DESIGN_SESSION_2026-07-23.md` §D14).

Sam's correction to the reasoning, recorded because it is the more general law:
making bad input unrepresentable would normally be the **better** design, not a
vacuous one. The keypad wins here on component reuse and gate coverage, not
because a constructive bound would have been wrong.

## Ruling 6 — scope boundary

> "§5 scope boundary: approved as proposed. Stage C delivers the session +
> eligibility facts; the 1–3 pre-season frequency policy, the D15
> time-trial-day selection filter, and deriving per-athlete paces into the %MAS
> template rows are all recorded as explicit Stage B requirements."
> — Sam, 2026-07-29

On the D15 filter's provenance:

> "'TT-day exercise-selection filter' comes from the D15 weekly-assembler design
> session (Sam ruled: filter exercise selection on a time-trial day, not a
> pairing ban) — it is a DESIGN decision, not existing code, and it belongs to
> Stage B's assembler, not Stage C."
> — Sam, 2026-07-29

## Ruling 7 — the %MAS range-vs-binary question is Stage B's to seek

> "the range-vs-binary %MAS disagreement is exactly the two-representations
> shape; write it into the boundary report as a named Stage B day-one question
> (the templates' authored ranges should presumably win over masCopy's
> unauthored binary, but that's Stage B's ruling to seek, not assume)."
> — Sam, 2026-07-29

Explicitly **not** ruled. Stage B must seek it.
