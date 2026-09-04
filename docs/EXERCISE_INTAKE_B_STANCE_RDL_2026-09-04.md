# Exercise Intake — B-Stance RDL

Signed by Sam, 2026-09-04. Owner: seat `variety`.

Asked for in his own words: *"add this into the exercise list as well - so we
have another single leg hip dominant lift"*. The app owned exactly TWO
single-leg hip lifts before this — `Single-Leg RDL` and `SL 45° Back
Extension` — the thinnest group in the whole strength catalogue, and the reason
`Single-Leg RDL` repeats for most of a season. This is the third.

## 1. B-Stance RDL

- **Video:** https://youtube.com/shorts/5fUAdAXu3PI?si=7zXA5P6Mvng5UFjY
- **Category:** Lower-body strength — single-leg hip-dominant
- **Primary plane:** Sagittal
- **Secondary planes:** Frontal and transverse
- **Main muscles:** Hamstrings, Glutes
- **Secondary muscles:** Low back
- **Primary cue:** Load the front leg and push your hips straight back.
- **Secondary cue:** Keep hips square; use the rear foot only for balance.
- **Equipment:** Barbell OR dumbbell
- **Dosing:** Single-sided — repetitions are per side
- **Experience:** Everyone
- **Use:** Same as Single-Leg RDL
- **Selection:** Automatic programming and manual Add/Swap wherever Single-Leg
  RDL is eligible
- **Season / game:** Same season and game-day restrictions as Single-Leg RDL
- **Prescription:** Same sets, repetitions and rest as Single-Leg RDL
- **Loading:** Same loading rules and progression as Single-Leg RDL
- **Demand:** Moderate loading, moderate fatigue, moderate soreness, moderate
  balance demand, high eccentric demand
- **Near-game suitability:** Caution
- **Restrictions:** Loaded hip hinging, hamstring lengthening, asymmetrical
  lower-body loading, gripping or maintaining spinal position under load.

| Region | Rating |
| --- | --- |
| Groin | Caution |
| Hip | Caution |
| Quad | Good |
| Hamstring | **Avoid** |
| Knee | Good |
| Calf | Caution |
| Ankle/foot | Caution |
| Ribs | Caution |
| Lower back | Caution |
| Neck | Good |
| Shoulder | Caution |
| Elbow | Caution |
| Wrist/hand | Caution |

## HOW "SAME AS SINGLE-LEG RDL" WAS IMPLEMENTED, FIELD BY FIELD

"Same as" is not a licence to copy a row. Each field was resolved against the
authority that already owns it, so the two lifts stay equal because the same
owner answers for both — not because two tables happen to agree today.

| what | how it is the same |
| --- | --- |
| dose | `doseCategory: 'loaded_lower_secondary_compound'`, the identical authored category. `resolveComposedDose` is the one reader; no second prescription is written. |
| loading + progression | `loadEstimation`: `anchor 'squat'`, `ratio 0.15`, `equipment 'dumbbell'` — the identical row. |
| slot | `hinge` accessory, `group 'single_leg_hip'`. `slotsForExerciseName` derives it from `movement: 'hinge'` + `unilateral: true`, exactly as it does for Single-Leg RDL. |
| season / game restriction | `lateWeek: 'caution'`, the same rating. |
| route | pool membership only. No new route, no name list, no special case. |

## WHERE IT DELIBERATELY DIFFERS FROM SINGLE-LEG RDL

These are Sam's authored numbers, not inherited ones, and they are the reason
the two lifts are not interchangeable:

- **Hamstring: Avoid** (Single-Leg RDL is Caution). A B-stance loads the front
  hamstring harder because the rear leg is not sharing the work.
- **Knee: Good** (Single-Leg RDL is Caution) and **balance: moderate**
  (Single-Leg RDL is `stability: 'low'`). The rear foot is a kickstand.
- **Eccentric: high** (Single-Leg RDL is moderate).
- **Load: moderate** (Single-Leg RDL is low).
- **Equipment: barbell or dumbbell** — no kettlebell, and it is **NOT**
  `BODYWEIGHT_CAPABLE`. Single-Leg RDL is both. Sam's sheet says "Barbell OR
  dumbbell" and nothing was widened past it.

## SAME-SESSION IDENTITY

`B-Stance RDL` joins the `romanian_deadlift` variation family alongside `RDLs`
and `Single-Leg RDL`. That table's own docstring is *"whether two separately
named rows are effectively the same variation for ONE SESSION"* — and an RDL
with a kickstand plainly is. R-233's *one RDL variant per day* therefore covers
it on arrival rather than being discovered later by an athlete reading two RDLs
on one page.

**THE CONSEQUENCE IS STATED, NOT HIDDEN.** In-season, R-093 puts an RDL on every
hinge day, so the single-leg hip seat already drops the whole RDL family there
and the hamstring pair takes the row. B-Stance RDL is excluded in exactly the
same places Single-Leg RDL is. **The variety it buys is real but it is
off-season and pre-season variety**, where the group goes from one usable
option to two.

## NOT COVERED

- **Per-side rendering.** Sam's sheet says the repetitions are per side. They do
  not render that way, and *neither does Single-Leg RDL*: measured on the
  preserved 52-week driver, `Single-Leg RDL`, `Walking Lunges` and
  `Bulgarian Split Squats` all ship as plain `3 × 8` with no `/ side`, because
  `perSide` is only ever read off an authored prehab/carry pool entry and never
  derived from `unilateral: true`. **This is a class-wide gap, not a B-Stance
  gap.** Fixing it for this one lift would be the name-special-case the
  coach-and-plan-edit rules forbid, and fixing it for the class changes what
  three shipping lifts prescribe (8 per side is not 8). Raised with Sam
  2026-09-04; B-Stance ships matching Single-Leg RDL exactly until he rules.
- **Beginner priority.** `BEGINNER_EXERCISE_PRIORITY.hinge` lists Single-Leg RDL
  and B-Stance RDL is not added to it. That list is a preference ORDER for
  beginners, not a legality gate, and inserting into it changes what beginners
  are programmed — which Sam did not ask for.
- Independent clinical validation of the supplied ratings and restrictions.
- Physical-iPhone acceptance or external video playback.

Guard: `LAW-b-stance-rdl-intake` through chained `test:exercise-intake`, which
invokes `test:b-stance-rdl`. Receipts: `docs/STATUS_VARIETY.md`.
