# PLANNED VS EXPERIENCED — MEASURED. THE STRENGTH HALF HAS NOTHING TO READ

**2026-08-12, unattended session.** Inbox item 6, step 1, which the item ordered
before any code: *"MEASURE FIRST: does a strength session have a start
timestamp? Grep found none and the plan depends on it."* **Measurement only.**

**The answer is worse than "no timestamp", and it changes how Sam's §4 ruling
lands.**

---

## §1 WHAT EACH KIND OF SESSION ACTUALLY STORES

| | conditioning | strength |
|---|---|---|
| athlete's effort rating | **`rpe`** ✓ | **nothing** |
| duration | **`totalTimeMinutes`** ✓ | **nothing** |
| start timestamp | none | **none** |
| what it does store | mode, distance, calories, rounds, intervals, pace | sets, reps, weight, completion |

`ConditioningPerformanceLog` (`utils/conditioningLogging.ts:25`) carries both
halves of sRPE, which is why `conditioningSRPE` (`rules/journalLoad.ts:514`)
exists, is correct, and needs nothing.

`StrengthExercisePerformanceLog` (`utils/strengthLogging.ts:6`) carries
**neither**. No RPE, no minutes, no start time, no end time. Searching the whole
repo for `startedAt` / `startTime` / `beganAt` / `sessionStart` in the domain
and journal types returns **nothing**, confirming the item's own grep.

## §2 SO THE PLAN'S PREMISE IS ONLY HALF SATISFIABLE TODAY

`HOW_THE_ATHLETE_TELLS_US_2026-08-12` asks readiness to read what the athlete
REPORTED rather than what was planned. **For conditioning that is available now.
For strength there is nothing to read** — sRPE needs a rating and a duration and
strength stores neither.

**THIS IS THE FINDING, AND IT IS NOT "ADD A TIMESTAMP".** A start time alone
would not give sRPE: it needs an END time too, and an effort rating that no
strength surface asks for. **Three missing things, not one.**

## §3 WHAT SAM'S §4 RULING DOES TO THAT — and the consequence nobody has stated

**Sam, 2026-08-12:** *"assume they did as planned"* — a missing answer means the
session happened as planned, at the planned effort, **MARKED AS AN ESTIMATE**.

That ruling makes the gap survivable: strength has a defined answer without new
capture. **But it has a consequence that should be said out loud before anything
is built —**

> **for strength, EVERY value would be an estimate, on every session, forever,
> until an RPE is captured. The estimate mark is not an edge case there; it is
> the whole column.**

A design that shows "experienced load" with a small estimate marker reads very
differently when the marker is on 100% of strength sessions and 0% of logged
conditioning ones. **That asymmetry is the thing to design against, and it is
invisible from the ruling alone.**

## §4 WHAT STRENGTH *DOES* HAVE — the honest alternative to inventing sRPE

Strength is not signal-free. It stores `completion` per lift, plus session-level
`feeling` and `soreness` (`RecordSessionOutcomeIntent`, `types/sessionOutcome.ts:240`),
and actual sets/reps/weight when the athlete logs them — which is a real
**volume-load** measure (`sets × reps × weight`, already computed in
`journalLoad.ts` just above `conditioningSRPE`).

**So the choice is not "sRPE or estimate".** It is:

- **(a)** capture an RPE on strength sessions and get true sRPE, or
- **(b)** use VOLUME LOAD as strength's experienced measure — already stored,
  already computed, no new capture — and accept that it is not the same unit as
  conditioning's sRPE, or
- **(c)** Sam's ruling alone: planned, marked estimate, for every strength
  session.

**(b) is not in the plan and is not in the inbox, and it is the only option that
reads real athlete data with nothing new to build.** Mixing units across (b) and
conditioning's sRPE is its cost.

## §5 NOT COVERED

- **Nothing was run.** Static measurement of the stored shapes.
- **No recommendation is made between (a), (b) and (c)** — that is a training
  decision, and §4 of `HOW_THE_ATHLETE_TELLS_US` is already flagged in the inbox
  as a RECOMMENDATION rather than a Sam ruling.
- **Item 6 is ordered AFTER item 4** on Sam's call, and item 4 is measured but
  not built. This does not jump that queue; it answers item 6's own
  measure-first step so the ordering costs nothing.
- **How many stored sessions actually carry a conditioning RPE** is
  OPEN-UNKNOWN — no journal data was read, so the "0% vs 100%" in §3 describes
  what the SHAPES permit, not observed logging behaviour.

**NORTH STAR: neutral.** Nothing stored, nothing derived; this reports.

## §6 RE-MEASURED AFTER THE EFFORT SCALE LANDED — the premise moved, and one kind already stores BOTH halves

**Measured 2026-08-12, after `0a` put every effort input on one 1-10 scale.**
§1 was taken before that landed and is now incomplete in a way that changes what
this item should build.

| session kind | effort/RPE stored | duration stored | sRPE computable | who READS it |
| --- | --- | --- | --- | --- |
| **conditioning** | `ConditioningPerformanceLog.rpe` | `.totalTimeMinutes` | **yes** | `conditioningSRPE` → `deriveSessionLoad` |
| **team training** | `TeamTrainingSessionOutcome.effort` (1-10) | `.durationMinutes` | **yes** | **NOTHING** |
| **game** | `GameSessionOutcome.bodyRpe` (1-10) | `.timeOnGroundMinutes` | **yes** | **NOTHING** |
| **strength** | — | — | no (volume load only) | `liftTonnageKg` |

**TWO OF THE FOUR KINDS ALREADY STORE BOTH HALVES OF sRPE AND NOTHING COUNTS
THEM.** `TeamTrainingSessionOutcome` and `GameSessionOutcome` are written by the
feedback panel through `sessionFeedbackForm`, validated at the transaction
boundary, and `journalLoad.ts` has no path for either — `conditioningSRPE` is its
only sRPE reader, and it takes a `ConditioningPerformanceLog`.

**SO §3'S ASYMMETRY IS SMALLER AND SHARPER THAN IT LOOKED.** It is not
"conditioning has data, everything else is an estimate". It is:

> **three of four kinds have real athlete-reported load, and two of those three
> are thrown away. Only STRENGTH genuinely needs Sam's estimate ruling.**

**WHAT THAT DOES TO THE BUILD.** Option (c) — planned, marked estimate — applies
to strength ALONE, not to the column. Team training and games need **a reader,
not a ruling**, and that reader is the same shape as `conditioningSRPE`: effort ×
minutes, both already validated as present. **This is the same
written-and-never-consumed class as `achievedModerateDayCount` (item 4) and
`canOverride` — third sighting today, and `LAW-computed-must-be-consumed`
(item 10) is the compression that would have caught all three.**

**NOT COVERED:** whether the game's `timeOnGroundMinutes` should count as full
load or be weighted (a game is not a training session, and nobody has ruled a
weighting); and whether mixing strength's VOLUME LOAD unit with sRPE is
acceptable in one column — **§4's open question is still open and still Sam's.**
