# THE FIFTH HARD DAY IS APP-SELECTED IN 7 WEEKS OUT OF 8 — measured, not argued

LOOP CHECK `enforcement-deferred-then-forgotten` — sighting 5, NEW ORGAN, and
the seat's widening is CONFIRMED by this measurement. Sightings 1-4 were rules
wired to a **logger**. This one is wired to a **write-only field**:
`contract.restStress.unavoidableAnchorCausedExcess` has ONE write
(`section18EffectiveWeekEvaluator.ts:1047`), ONE type declaration
(`weeklyExposureContractV2.ts:442`), ONE `null` initialiser (`:1343`) and **ZERO
readers** — verified by grep over `src/**/*.ts(x)` with fixtures excluded.
**COMPRESS: a law whose only consumer is a logger OR a field with no readers is
not enforced.** A `noUnusedWrites`-style gate over `contract.*` assignments
would have caught this on the day it was written, and item 7's proposed
`subject: 'doc' | 'behaviour'` check would NOT have.

**Order:** `docs/SEAT_INBOX.md` topmost item, step **(a)** — *"MEASURE FIRST, IN
THIS ORDER … Do not skip (a) — the craft tier shipped on the belief that
`strong` was where the quality lived and its own measurement refuted that."*

**Status: (a) DONE. (b) NOT STARTED, and priced below.**

---

## §1 THE BIBLE'S CLAUSE, AND WHO HOLDS IT

**Line 4812:** *"A fifth hard day may come from an unavoidable anchor or
Bible-required/planner-selected app work, but **unnecessary app-selected stress
is not justified merely because the scalar maximum permits 5**."*
**Line 118:** *"PREFER 4 hard days, PERMIT 5."*

Three owners each decline it, and the seat's reading of all three is confirmed:

| Owner | What it does at exactly 5 | Blocks? |
| --- | --- | --- |
| §18 contract evaluator (`section18EffectiveWeekEvaluator.ts:1529-1537`) | `default_target_miss`, `severity: 'advisory'` | no |
| Section 17 kernel (`weekStructureValidator.ts:493-496`) | `cap_maxHardDays_over`, `soft` | no |
| The craft tier, shipped `2db1b8ce` | declines ON PURPOSE — its ruling 2 gives COUNT to the contract | no |

## §2 THE MEASUREMENT

`LFA_HARD_DAY_PROBE=1 npm run test:qa` — inert without the flag (`test:qa` is
byte-identical at 169 passed / 16 failed either way). It evaluates each
scenario's §18 contract against its own resolved week and prints the three
numbers the Bible's distinction needs.

**Eight of seventeen scenarios sit at 5 hard days. In SEVEN of them the excess
is app-selected. In exactly ONE the club schedule forces it.**

| Scenario | hard | anchor | app | preferred max | `unavoidableAnchorCausedExcess` | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **S1** in-season Sat game, 2 team nights | 5 | 3 | 2 | 4 | **0** | app-selected |
| **S2** in-season Sun game, six-day | 5 | 3 | 2 | 4 | **0** | app-selected |
| **S4** in-season bye | 5 | 2 | 3 | 4 | **0** | app-selected |
| **S10** three club trainings + Sat game | 5 | 4 | 1 | 4 | **1** | **anchor-caused, correctly permitted** |
| **S11** pre-season, Sat practice match | 5 | 3 | 2 | 4 | **0** | app-selected |
| **E1** edit: remove Sat game | 5 | 2 | 3 | 4 | **0** | app-selected |
| **E2** edit: move Sat game to Sun | 5 | 3 | 2 | 4 | **0** | app-selected |
| **E3** edit: add Sat game back | 5 | 3 | 2 | 4 | **0** | app-selected |
| S13 in-season low availability | 5 | 3 | 2 | 4 | **0** | app-selected |

(S13 is the ninth row and the eighth at 5 — S4 and E1 are bye weeks where the
kernel reports `info` rather than `soft`, so the seat's list of six was the
soft-severity subset. **The defect is wider than the order's own list.**)

Scenarios below the line are clean and stay clean: S3 (4), S5/S6 (1), S7 (4),
S8/S9 (4), S12 (3), S14 (4).

**WHY S10 IS DIFFERENT, and why this is a real mechanism rather than a constant:**
`unavoidableAnchorCausedExcess = min(authorisedUnavoidableAnchorExcess,
hardDays − preferredMax, provenAnchorExcess)`. S10 is the only scenario whose
contract carries `authorisedUnavoidableAnchorExcess = 1`, because three
consecutive club trainings plus a game genuinely leave no other shape. **The
arithmetic already distinguishes "the club did this to you" from "the app chose
this", it already gets the answer right, and nothing asks it.**

## §3 SAM'S COMPLAINT, LOCATED

> **In seven of the eight weeks that carry a fifth hard day, the app put it
> there. Not the club, not the fixture — the app.** The Bible refuses exactly
> that, in one sentence, and the number that proves it has been computed on
> every assessment since the field was written and thrown away every time.

That is the other half of "why is the programming shit", and unlike the first
half it is NOT a `strong`-tier question and NOT a shape question. It is a COUNT
question, which is why the craft tier correctly declined it.

## §4 STEP (b), PRICED AND NOT STARTED

**The fix the order names:** at `section18EffectiveWeekEvaluator.ts:1529-1537`,
where `hardDays > preferredHardDayRange.max` and `unavoidableAnchorCausedExcess`
does not account for the excess, emit **blocking** instead of `advisory`. Keep
the anchor-accounted case advisory — an unavoidable fixture is a FACT and may
never be vetoed (gateway §18 ownership ruling D3, and S10 is the live case that
would break if this is got wrong).

**WHY IT IS NOT STARTED IN THIS SESSION, and this is a measurement not an
excuse.** It turns **seven of seventeen** QA scenarios from "advisory" into
"blocking" at the one gate every write door converges on. The craft tier — a
smaller change than this — produced **five athlete-door regressions** that only a
full 189-suite sweep with a verified-clean comparison tree could find, and that
comparison cost roughly three hours of wall clock and three silently-failed
attempts before it was trustworthy. **Shipping a wider blast radius than that
without the same verification would be the exact trade the craft tier's own
§7 was written to warn against.**

**What (b) needs, in order:**
1. The finding flipped, behind the anchor-accounted exemption.
2. The repair search asked whether it CAN answer this class — stacking
   compatible work onto fewer days is `repairByStackingCandidates`, which today
   only runs on `hard_day_breach` and `full_rest` shortfalls, so it would need
   this trigger added. **If it cannot, seven scenarios publish a disclosed
   shortfall and nothing improves** — the same trap the craft tier's
   move-only-onto-empty-days generator fell into.
3. Athlete-placed hard days exempted, by `resolverMayDisplace`, exactly as the
   craft tier now does. **A hard day the athlete chose is not app-selected
   stress**, and the phrase in the Bible is precise about that.
4. Full sweep with a verified-clean baseline, by
   `scripts/sweep.sh` + the parked-revert comparison with its printed
   world-identity line.

## NOT COVERED

- **Nothing here ran on a device or a simulator.** All numbers are node.
- **The probe measures the QA harness's resolved weeks, not `generateProgramLocally`
  output.** They share `buildCoachingPlan` and the same contract builder, but a
  generated program passes through the §18 gateway and the top-up pass
  afterwards, and those were NOT measured here.
- **`authorisedUnavoidableAnchorExcess` is an INPUT** to the contract builder.
  Which doors set it above 0, and whether every genuinely-forced week gets it,
  is unmeasured — S10 is the only observed non-zero. **If that input is
  under-supplied, step (b) would block weeks the club really did force.** This
  is the single largest risk in (b) and it is open.
- The Bible was read at lines 118 and 4812 only.
