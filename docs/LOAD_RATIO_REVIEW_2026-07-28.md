# Load ratios + equipment — AUTHORED FINAL

**Date:** 2026-07-28  
**Ruled by:** Sam  
**Workbook:** `docs/LOAD_RATIO_REVIEW_2026-07-28.xlsx` — **the source of truth. Edit that, not this.**  
**Gate:** `test:load-ratio-rulings` holds workbook and code equal in BOTH directions.

Every value below is ruled. This is no longer a review sheet.

## The chain

```
anchor 1RM     = bodyweight x multiplier
working weight = anchor 1RM x exercise ratio
prescribed     = round DOWN to the lattice, floored at the minimum
```

**Rounding is always DOWN** — conservative by construction. The lattices bound the
**estimate** only: an athlete’s own entered weight is never rounded, snapped or
corrected. Their number is their number.

## 1. Anchor multipliers

| Kind | Onboarding answer | Multiplier | Note |
|---|---|---|---|
| squat | I don't squat | 0.5 |  |
| squat | Less than bodyweight | 0.75 |  |
| squat | Around bodyweight | 1 |  |
| squat | 1.5x bodyweight | 1.5 |  |
| squat | 2x bodyweight+ | 2 |  |
| squat | Not sure | 0.75 | tied to "Less than bodyweight" |
| bench | I don't bench | 0.5 |  |
| bench | Less than bodyweight | 0.75 |  |
| bench | Around bodyweight | 1 |  |
| bench | 1.25x bodyweight | 1.25 |  |
| bench | 1.5x bodyweight+ | 1.5 |  |
| bench | Not sure | 0.75 | tied to "Less than bodyweight" |
| fallback | (no bodyweight recorded) | **FAIL LOUD** | no default — nothing prescribed |

`Not sure` is **derived** from `Less than bodyweight` in code, never a second literal.

## 2. Equipment lattices

| Equipment | Lattice | Rounding | Minimum | Minimum ruled? |
|---|---|---|---|---|
| barbell | 2.5 kg steps | DOWN | 20 kg | yes |
| cable | 2.5 kg steps | DOWN | 2.5 kg | yes |
| machine | 2.5 kg steps | DOWN | 10 kg | yes |
| kettlebell | 4 kg steps (8, 12, 16, 20, 24 …) | DOWN | 8 kg | yes |
| dumbbell | 1–10 kg by 1, then 2.5 kg steps | DOWN | 1 kg | yes |

**Every equipment kind is ruled** — minimum and lattice both, in one owner.
The dumbbell minimum of 1 kg matches its lattice start: before Sam ruled it the
minimum was 5 kg while the ladder began at 1, so 1–4 kg dumbbells were loadable
and never prescribed. Closing that gap changes 17 cards for a 55 kg beginner and
none for a typical 80 kg athlete — exactly the population it should serve.

## 3. Equipment-minimum prescriptions — 4

These prescribe the equipment minimum rather than a ratio. Each previously carried a
ratio that computed **below** its minimum, so the athlete always received the minimum
and the ratio never applied — a number shaped like a decision that decided nothing.

| Exercise | Equipment | Prescribed |
|---|---|---|
| Bicep Curl (Barbell) | barbell | 20 kg |
| Bottoms-Up KB Press | kettlebell | 8 kg |
| Explosive Landmine Press | barbell | 20 kg |
| Incline Y Raise | dumbbell | 5 kg |

## 4. Load ratios — 72

| Exercise | Anchor | Ratio | Equipment |
|---|---|---|---|
| Back Extension | squat | 0.15 | dumbbell |
| Back Squat | squat | 0.8 | barbell |
| Barbell Row | bench | 0.7 | barbell |
| Bear Carry | squat | 0.3 | dumbbell |
| Bench Press | bench | 0.8 | barbell |
| Bicep Curl (Dumbbell) | bench | 0.15 | dumbbell |
| Bodyweight Squat | squat | 0 | bodyweight |
| Box Squat | squat | 0.9 | barbell |
| Bulgarian Split Squats | squat | 0.2 | dumbbell |
| Cable Face Pull | bench | 0.2 | cable |
| Calf Raises | squat | 0.5 | machine |
| Chest Supported Row | bench | 0.3 | dumbbell |
| Chest-Supported DB Row | bench | 0.2 | dumbbell |
| Close Grip Bench | bench | 0.75 | barbell |
| Concentration Curl | bench | 0.1 | dumbbell |
| DB Bench Press | bench | 0.3 | dumbbell |
| DB Shoulder Press | bench | 0.2 | dumbbell |
| Deadlift | squat | 0.75 | barbell |
| Dumbbell Kickback | bench | 0.1 | dumbbell |
| Dumbbell Skull Crusher | bench | 0.15 | dumbbell |
| Face Pull | bench | 0.2 | cable |
| Farmer Carry | bench | 0.4 | dumbbell |
| Front Squat | squat | 0.5 | barbell |
| Goblet Squat | squat | 0.22 | dumbbell |
| Half-Kneeling Single-Arm Overhead Press | bench | 0.2 | dumbbell |
| Hammer Curl | bench | 0.15 | dumbbell |
| Hamstring Curl | squat | 0.25 | machine |
| Hanging Leg Raise | bench | 0 | bodyweight |
| High Box Squat | squat | 1.08 | barbell |
| Hip Thrusts | squat | 0.7 | barbell |
| Incline Bench | bench | 0.7 | barbell |
| Incline DB Bench | bench | 0.3 | dumbbell |
| Incline Dumbbell Curl | bench | 0.1 | dumbbell |
| Kettlebell Swings | squat | 0.2 | kettlebell |
| Landmine Press | bench | 0.35 | barbell |
| Lat Pulldown | bench | 0.55 | cable |
| Lateral Raise | bench | 0.1 | dumbbell |
| Leg Extension | squat | 0.3 | machine |
| Leg Press | squat | 1 | machine |
| Lying Dumbbell Curl | bench | 0.1 | dumbbell |
| Neutral-Grip Pulldown | bench | 0.5 | cable |
| Overhead Carry | bench | 0.2 | dumbbell |
| Overhead Press | bench | 0.6 | barbell |
| Overhead Tricep Extension | bench | 0.15 | cable |
| RDLs | squat | 0.65 | barbell |
| Rear Delt Fly | bench | 0.1 | dumbbell |
| Reverse Lunges | squat | 0.2 | dumbbell |
| Seated Cable Row | bench | 0.5 | cable |
| Seated DB Press | bench | 0.2 | dumbbell |
| Shrugs | bench | 0.3 | dumbbell |
| Single-Arm DB Bench Press | bench | 0.3 | dumbbell |
| Single-Arm DB Floor Press | bench | 0.22 | dumbbell |
| Single-Arm DB Row | bench | 0.3 | dumbbell |
| Single-Arm Lat Pulldown | bench | 0.3 | cable |
| Single-Arm Shrug | bench | 0.2 | dumbbell |
| Single-Leg Hip Thrust | squat | 0.2 | dumbbell |
| Single-Leg Leg Press | squat | 0.6 | machine |
| Single-Leg RDL | squat | 0.15 | dumbbell |
| Single-Leg Squat (to Box) | squat | 0.15 | dumbbell |
| Skull Crushers | bench | 0.2 | dumbbell |
| Speed Bench | bench | 0.55 | barbell |
| Speed Trap Bar Deadlift | squat | 0.45 | barbell |
| Step Ups | squat | 0.2 | dumbbell |
| Suitcase Carry | bench | 0.4 | dumbbell |
| Trap Bar Deadlift | squat | 0.9 | barbell |
| Tricep Circuit (Dirty 30) | bench | 0.1 | dumbbell |
| Tricep Pushdown | bench | 0.2 | cable |
| Walking Lunges | squat | 0.2 | dumbbell |
| Weighted Dead Bug | bench | 0.1 | dumbbell |
| Woodchop (Half Kneeling) | bench | 0.1 | cable |
| Woodchop (Standing) | bench | 0.15 | cable |
| Z-Press | bench | 0.35 | barbell |

## A known stopgap

A ratio bakes in a rep-range discount, so it silently assumes **one** rep scheme. When
the Sam-authored rep-max continuum lands (Master Plan 4.1a), estimates become rep-aware
and most per-exercise ratios become candidates to collapse into relative-strength ratios
plus that one table. **These are first-session values, not permanent law.**
