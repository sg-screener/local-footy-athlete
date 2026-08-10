# THE 2KM LEAD — REFUTED; AND THE SEED-CONSUMER CENSUS — 21 OF 332

**Both halves of the seat's order, answered. The lead is refuted, which the
order itself calls a good outcome, and the census is a count and a list rather
than "some".**

---

## PART A — THE LEAD: REFUTED

**THE QUESTION AS ASKED:** *does a profile with no 2km time generate weeks with
less conditioning, or conditioning that never shares a day with strength?*

**THE ANSWER: NO, TO BOTH. Measured, not argued.** `_twoKmLead.ts` generates the
same seed twice — same anchor, same acceptance, same block, same everything —
with `twoKmTimeTrial` as the **only** difference:

| | conditioning-carrying workouts | strength AND conditioning on one day |
| --- | --- | --- |
| WITH the 2km time (today's seed) | 4 of 20 | **4** |
| WITHOUT it (every seed before 2026-08-10) | 4 of 20 | **4** |

Week 1 is identical field for field in both arms:

```
dow 1  Mixed          Lower Body Strength        combined=true kind=component flavour=aerobic role=optional_flush
dow 2  Team Training  Team Training + Upper Pull combined=false
dow 4  Team Training  Team Training + Upper Push combined=false
dow 5  Strength       Gunshow                    combined=false
dow 3  Strength       Prehab & Accessories       combined=false
```

**THE IMPOSSIBLE PROFILE AND THE DAY-SHAPE DEFECT ARE SEPARATE THREADS.** They
do not tie into one root, and the month of not reproducing Sam is not explained
by the missing time. Not stretched to fit.

### THE FIRST VERSION OF THIS PROBE WAS VACUOUS, AND SAYING SO IS THE POINT

It read **0 conditioning days in BOTH arms** — and reported "REFUTED" on that
basis. It would have been the right verdict from an instrument that could not
have produced any other one. **The device screenshot taken an hour earlier
(`artifacts/ui-walk/walk-1-day.png`) shows that same Monday reading "Strength +
Conditioning"**, which is what exposed it.

The generator does not carry conditioning as a component row. It rides the
workout as `hasCombinedConditioning` / `attachedConditioningKind` /
`conditioningFlavour` / `conditioningBlock` — **the fields the day card itself
reads**. The first probe counted its own unit and called it the domain's:
`a-count-taken-for-a-record`, and `a-control-red-belongs-to-the-instrument-only-
if-removing-it-helps`. **A measurement that reads the same in both arms has not
compared them.** The refutation above stands on the corrected probe only.

### A SECOND OBSERVATION, OFFERED AS A QUESTION AND NOT AN ANSWER

**The standard seed DOES produce a Monday carrying strength and conditioning
together — but the conditioning is an attached `optional_flush` aerobic
component, not a standalone conditioning session.**

Sam's open defect is recorded as *"0 of 11 seed worlds reach his day shape"*.
This world reaches a combined day on the definition used here. **So either the
census counted standalone conditioning sessions, or "his day shape" means
something narrower than combined-on-one-day.** Those two measurements may be
counting different things — the same law, one level up.

**IT CANNOT BE SETTLED FROM WHAT IS ON DISK.**
`device-export-2026-08-10-sam-monday-wednesday.json` is a SUMMARY
(`hasProgram`, `microcycleCount`, `markedDays`, …) and carries no workouts, so
Sam's real Monday cannot be compared against this. **Naming the gap rather than
guessing across it.**

---

## PART B — THE CENSUS: 21 SUITES OF 332

**Method:** transitive import closure over `src`, from every file mentioning
`DEV_E2E_STANDARD_PROFILE` outward — so a suite that reaches the impossible
athlete through a helper is counted, not just direct callers. 25 files reach it;
4 are helper modules (`devE2ESeedTestSupport`, `deviceExactSeed`,
`spentWeekFridayTestSupport`, `support/armedMirrorDeviceFixture`), leaving **21
runnable suites**. Every one maps to a script:

```
test:accept-boundary-contract          test:explorer-live-wiring
test:athlete-move-occupied-content-loss test:explorer-production-bindings
test:capacity-render-safety            test:explorer-scenario-runner
test:deriving-device-commit            test:illness-clear-game-week
test:dev-e2e-reset-hydration           test:injury-authority
test:dev-e2e-default-installation      test:onboarding-cold-start
test:dev-e2e-scenario-session          test:profile-mirror-narrowing
test:dev-e2e-seeds                     test:profile-reset-ui
test:dev-e2e-witnesses                 test:readiness-ownership
test:dev-onboarding-skip               test:reset-coach
test:fact-horizon
```

**21 of 332 — 6%.** Their green, for every run before 2026-08-10, was green over
a profile the app would have refused from a real athlete. **It does not follow
that any of them was WRONG**: Part A shows the missing field changed nothing
about the generated week, so for anything downstream of generation the worlds
were the same worlds. **What it does mean is that their green never covered the
completeness gate** — no seeded run had ever reached the screen that enforces
it, which is exactly why the defect survived.

**The other 311 scripts are unaffected**: they build their inputs by hand or
from other fixtures, and never touch the standard profile.

---

## WHAT THIS DOES NOT COVER, STATED

- **Whether Sam's real Monday matches the seed's combined day** — the export on
  disk is a summary and cannot answer it. This needs either a fuller export or
  his eye on a screenshot.
- **The other 10 seeds.** Part A ran the standard seed's generation path.
  Different seeds carry different anchors and microcycle limits; the census's
  claim is about the PROFILE, which they share, and the refutation is about that
  profile's effect on generation.
