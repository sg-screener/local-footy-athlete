# Load ratio review — for Sam to correct and sign

**Date:** 2026-07-28
**Workbook:** `docs/LOAD_RATIO_REVIEW_2026-07-28.xlsx` (the signable copy — edit that, not this)
**Unit:** provenance lock, Unit 3
**Inventory:** `docs/PROVENANCE_INVENTORY_2026-07-28.md`

## Why this exists

`EXERCISE_LOAD_MAP` decides the kilograms the app suggests for every barbell,
dumbbell, cable and machine lift. It has **77 entries**. **Six** were ruled on
2026-07-25. The other **71 have never been ruled by anyone** — they were written
into code and have been prescribing weight to athletes since.

`LOAD_RULING_PENDING` is empty and its gate passes green, which reads as
"everything is ruled". Nothing was ever parked there, so the emptiness was never
evidence of anything. That is the defect this sheet closes.

## How a ratio works

    working weight = anchor 1RM x ratio, rounded to the equipment increment

The ratio is **not** a percentage of 1RM. It bakes in the rep-range discount, so
the output is a direct working weight.

## The reference athlete

**squat 1RM = 88 kg** — your reference athlete, pinned by
`LOAD_RULINGS_LITERAL_LOCK_PURGE_REPORT_2026-07-25.md`; three of the four figures
in that document fall out of it exactly.

**bench 1RM = 57.2 kg (0.65 × 88)** — **an assumption, not your figure.** That
document never pinned a bench anchor. If it is wrong, every bench-anchored
kilogram below is wrong with it. Worth correcting first.

## What my flags mean

They are a starting point, not a verdict. `plausible` means nothing looked wrong
to me — I am not an S&C coach and it is not evidence the number is right.
`suspicious` means something specific looks off, and the reason is in the row.

---

## Suspicious — 10

| Exercise | Anchor | Ratio | Equipment | kg @ ref | Why flagged | **SAM: ratio** |
|---|---|---|---|---|---|---|
| Bicep Curl (Barbell) | bench | 0.3 | barbell | 20 kg | ratio floors out — computes 17.2kg, below the 20kg minimum, so the ratio never applies |   |
| Bottoms-Up KB Press | bench | 0.08 | kettlebell | 8 kg | ratio floors out — computes 4.6kg, below the 8kg minimum, so the ratio never applies |   |
| Concentration Curl | bench | 0.08 | dumbbell | 5 kg | ratio floors out — computes 4.6kg, below the 5kg minimum, so the ratio never applies |   |
| Deadlift | squat | 1 | barbell | 87.5 kg | working weight at or above the anchor 1RM |   |
| Dumbbell Kickback | bench | 0.08 | dumbbell | 5 kg | ratio floors out — computes 4.6kg, below the 5kg minimum, so the ratio never applies |   |
| Explosive Landmine Press | bench | 0.25 | barbell | 20 kg | ratio floors out — computes 14.3kg, below the 20kg minimum, so the ratio never applies |   |
| Farmer Carry | bench | 0.355 | dumbbell | 20 kg | 3-decimal precision implies a derivation nobody recorded |   |
| Incline Y Raise | bench | 0.07 | dumbbell | 5 kg | ratio floors out — computes 4.0kg, below the 5kg minimum, so the ratio never applies |   |
| Leg Press | squat | 1.3 | machine | 115 kg | working weight at or above the anchor 1RM |   |
| Suitcase Carry | bench | 0.355 | dumbbell | 20 kg | 3-decimal precision implies a derivation nobody recorded |   |

**The "floors out" group is the most interesting finding.** Six ratios compute a
weight below the equipment minimum, so the athlete always receives the minimum and
the ratio never applies at all. Those numbers look like decisions but have no
effect — changing them changes nothing until the minimum moves.

---

## Plausible — 61

| Exercise | Anchor | Ratio | Equipment | kg @ ref | Why flagged | **SAM: ratio** |
|---|---|---|---|---|---|---|
| Back Squat | squat | 0.82 | barbell | 72.5 kg | — |   |
| Barbell Row | bench | 0.7 | barbell | 40 kg | — |   |
| Bear Carry | squat | 0.3 | dumbbell | 27.5 kg | — |   |
| Bench Press | bench | 0.82 | barbell | 47.5 kg | — |   |
| Bicep Curl (Dumbbell) | bench | 0.15 | dumbbell | 7.5 kg | — |   |
| Bodyweight Squat | squat | 0 | bodyweight | 0 kg | — |   |
| Box Squat | squat | 0.75 | barbell | 65 kg | — |   |
| Bulgarian Split Squats | squat | 0.22 | dumbbell | 20 kg | — |   |
| Cable Face Pull | bench | 0.18 | cable | 10 kg | — |   |
| Calf Raises | squat | 0.5 | machine | 45 kg | — |   |
| Chest Supported DB Row | bench | 0.22 | dumbbell | 12.5 kg | — |   |
| Chest Supported Row | bench | 0.28 | dumbbell | 15 kg | — |   |
| Chest-Supported DB Row | bench | 0.22 | dumbbell | 12.5 kg | — |   |
| Close Grip Bench | bench | 0.75 | barbell | 42.5 kg | — |   |
| DB Bench Press | bench | 0.32 | dumbbell | 17.5 kg | — |   |
| DB Shoulder Press | bench | 0.22 | dumbbell | 12.5 kg | — |   |
| Dumbbell Skull Crusher | bench | 0.14 | dumbbell | 7.5 kg | — |   |
| Face Pull | bench | 0.18 | cable | 10 kg | — |   |
| Front Squat | squat | 0.7 | barbell | 62.5 kg | — |   |
| Goblet Squat | squat | 0.22 | dumbbell | 20 kg | — |   |
| Half-Kneeling Single-Arm Overhead Press | bench | 0.18 | dumbbell | 10 kg | — |   |
| Hammer Curl | bench | 0.12 | dumbbell | 7.5 kg | — |   |
| Hanging Leg Raise | bench | 0 | bodyweight | 0 kg | — |   |
| Hip Thrusts | squat | 0.7 | barbell | 62.5 kg | — |   |
| Incline Bench | bench | 0.72 | barbell | 40 kg | — |   |
| Incline DB Bench | bench | 0.28 | dumbbell | 15 kg | — |   |
| Incline Dumbbell Curl | bench | 0.1 | dumbbell | 5 kg | — |   |
| Kettlebell Swings | squat | 0.2 | kettlebell | 16 kg | — |   |
| Landmine Press | bench | 0.35 | barbell | 20 kg | — |   |
| Lat Pulldown | bench | 0.55 | cable | 30 kg | — |   |
| Lateral Raise | bench | 0.09 | dumbbell | 5 kg | — |   |
| Leg Extension | squat | 0.3 | machine | 25 kg | — |   |
| Lying Dumbbell Curl | bench | 0.1 | dumbbell | 5 kg | — |   |
| Neutral-Grip Pulldown | bench | 0.55 | cable | 30 kg | — |   |
| Overhead Carry | bench | 0.2 | dumbbell | 12.5 kg | — |   |
| Overhead Press | bench | 0.58 | barbell | 32.5 kg | — |   |
| Overhead Tricep Extension | bench | 0.15 | cable | 10 kg | — |   |
| RDLs | squat | 0.65 | barbell | 57.5 kg | — |   |
| Rear Delt Fly | bench | 0.09 | dumbbell | 5 kg | — |   |
| Reverse Lunges | squat | 0.2 | dumbbell | 17.5 kg | — |   |
| Seated Cable Row | bench | 0.5 | cable | 30 kg | — |   |
| Seated DB Press | bench | 0.22 | dumbbell | 12.5 kg | — |   |
| Shrugs | bench | 0.3 | dumbbell | 17.5 kg | — |   |
| Single-Arm DB Bench Press | bench | 0.28 | dumbbell | 15 kg | — |   |
| Single-Arm DB Row | bench | 0.28 | dumbbell | 15 kg | — |   |
| Single-Arm Lat Pulldown | bench | 0.3 | cable | 15 kg | — |   |
| Single-Arm Shrug | bench | 0.18 | dumbbell | 10 kg | — |   |
| Single-Leg Leg Press | squat | 0.6 | machine | 55 kg | — |   |
| Single-Leg RDL | squat | 0.15 | dumbbell | 12.5 kg | — |   |
| Single-Leg Squat (to Box) | squat | 0.16 | dumbbell | 15 kg | — |   |
| Skull Crushers | bench | 0.18 | dumbbell | 10 kg | — |   |
| Speed Bench | bench | 0.55 | barbell | 32.5 kg | — |   |
| Step Ups | squat | 0.2 | dumbbell | 17.5 kg | — |   |
| Trap Bar Deadlift | squat | 0.9 | barbell | 80 kg | — |   |
| Tricep Circuit (Dirty 30) | bench | 0.1 | dumbbell | 5 kg | — |   |
| Tricep Pushdown | bench | 0.2 | cable | 10 kg | — |   |
| Walking Lunges | squat | 0.2 | dumbbell | 17.5 kg | — |   |
| Weighted Dead Bug | bench | 0.1 | dumbbell | 5 kg | — |   |
| Woodchop (Half Kneeling) | bench | 0.1 | cable | 5 kg | — |   |
| Woodchop (Standing) | bench | 0.12 | cable | 5 kg | — |   |
| Z-Press | bench | 0.35 | barbell | 20 kg | — |   |

---

## Already ruled — 6

Shown for context. No action needed.

| Exercise | Anchor | Ratio | Equipment | kg @ ref | Why flagged | **SAM: ratio** |
|---|---|---|---|---|---|---|
| Back Extension | squat | 0.15 | dumbbell | 12.5 kg | — |   |
| Hamstring Curl | squat | 0.25 | machine | 20 kg | — |   |
| High Box Squat | squat | 0.9 | barbell | 80 kg | — |   |
| Single-Arm DB Floor Press | bench | 0.22 | dumbbell | 12.5 kg | — |   |
| Single-Leg Hip Thrust | squat | 0.2 | dumbbell | 17.5 kg | — |   |
| Speed Trap Bar Deadlift | squat | 0.45 | barbell | 40 kg | — |   |

---

## Upstream: the anchor multipliers

These convert an onboarding answer into the anchor 1RM that every ratio above
multiplies. They are unauthored too, and they sit **upstream of all 77** — an error
here moves every suggested weight in the app at once. They are on the "Anchor
multipliers" tab of the workbook.

## After sign-off

The workbook becomes the source of truth and the code follows it, held by an
equality test in both directions — the same arrangement as the conditioning
templates. A hand-edited ratio then fails the build.
