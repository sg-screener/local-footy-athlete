# Load ratio review — for Sam to correct and sign

**Date:** 2026-07-28  
**Workbook:** `docs/LOAD_RATIO_REVIEW_2026-07-28.xlsx` — **the signable copy. Edit that, not this.**  
**Unit:** provenance lock, Unit 3  
**Background:** `docs/ANCHOR_CHAIN_WALKTHROUGH_2026-07-28.md` explains the chain in plain English.

## Ruling order

| # | Section | Rows | |
|---|---|---|---|
| 1 | Anchor multipliers | 13 | ✅ **RULED 2026-07-28** |
| 2 | Suspicious ratios | 4 | something specific looks wrong |
| 3 | Plausible ratios | 63 | a skim |
| 4 | Floor-out ratios | 4 | these currently do **nothing** |
| 5 | Already ruled | 6 | context only |

`4 + 63 + 4 + 6 = 77` ratios.

> **Your multiplier rulings changed this sheet.** The bench ladder moved 0.65 → 0.75,
> so the reference bench anchor rose 57.2 → 66 kg and every bench-anchored kg was
> recomputed. Two ratios stopped flooring out as a result (Concentration Curl,
> Dumbbell Kickback), so floor-out is **4 rows, not the 6 flagged before the ruling**.
> Nothing was reclassified by hand — the flags recompute from the ruled anchors.
> This is exactly why the multipliers were ruled first.

---

# 1. Anchor multipliers — ✅ RULED 2026-07-28

Anchor 1RM = **bodyweight × multiplier**. All 77 ratios then multiply that anchor,
so an error here moves every suggested weight in the app at once. Shipped as
`src/data/anchorMultipliers.ts`, held to this ruling by `test:anchor-multipliers`.

"First card weight" applies the representative lift (Back Squat / Bench Press, both
ratio 0.82) so the multiplier is visible in the units an athlete actually reads.

| Kind | Onboarding answer | Anchor | **RULED** | 1RM @ 80 kg | First card weight | Notes |
|---|---|---|---|---|---|---|
| squat multiplier | I don't squat | squat | **0.5** | 40 kg | 32.5 kg |  |
| squat multiplier | Less than bodyweight | squat | **0.75** | 60 kg | 50 kg |  |
| squat multiplier | Around bodyweight | squat | **1** | 80 kg | 65 kg |  |
| squat multiplier | 1.5x bodyweight | squat | **1.5** | 120 kg | 97.5 kg |  |
| squat multiplier | 2x bodyweight+ | squat | **2** | 160 kg | 130 kg |  |
| squat multiplier | Not sure | squat | **0.75** | 60 kg | 50 kg | tied to "Less than bodyweight" |
| bench multiplier | I don't bench | bench | **0.5** | 40 kg | 32.5 kg |  |
| bench multiplier | Less than bodyweight | bench | **0.75** | 60 kg | 50 kg |  |
| bench multiplier | Around bodyweight | bench | **1** | 80 kg | 65 kg |  |
| bench multiplier | 1.25x bodyweight | bench | **1.25** | 100 kg | 82.5 kg |  |
| bench multiplier | 1.5x bodyweight+ | bench | **1.5** | 120 kg | 97.5 kg |  |
| bench multiplier | Not sure | bench | **0.75** | 60 kg | 50 kg | tied to "Less than bodyweight" |
| fallback bodyweight kg | (no bodyweight recorded) | n/a | 82 kg | n/a | n/a |  |

### The missing-bodyweight fallback — ruled FAIL LOUD

No default. With no recorded bodyweight there is no anchor, so nothing is prescribed
and the card shows `—`. `DEFAULT_BODYWEIGHT_KG = 82` ("average AFL player") is gone —
it was a guess about the athlete's body that then prescribed every load in the app.
Rarely reached now, since onboarding requires a bodyweight in 30–200 kg.

### "Not sure" is tied, not copied

Both ladders derive `Not sure` from `Less than bodyweight` by reference. If less-than
ever moves, Not-sure follows automatically — there is no second `0.75` to drift.

### A known stopgap: the baked-in rep assumption

Because a ratio bakes in a rep-range discount, it silently assumes **one** rep scheme.
When the Sam-authored rep-max continuum lands (Master Plan 4.1a), starting estimates
become rep-aware — anchor → implied max → % for the prescribed reps — and most
per-exercise ratios become candidates to collapse into simpler relative-strength
ratios plus that one table. **These rulings are first-session values, not permanent
law.**

---

# 2. Suspicious — 4

| Exercise | Anchor | Ratio | Equipment | kg @ ref | Why flagged | **SAM: ratio** |
|---|---|---|---|---|---|---|
| Deadlift | squat | 1 | barbell | 87.5 kg | working weight at or above the anchor 1RM |   |
| Farmer Carry | bench | 0.355 | dumbbell | 22.5 kg | 3-decimal precision implies a derivation nobody recorded |   |
| Leg Press | squat | 1.3 | machine | 115 kg | working weight at or above the anchor 1RM |   |
| Suitcase Carry | bench | 0.355 | dumbbell | 22.5 kg | 3-decimal precision implies a derivation nobody recorded |   |

---

# 3. Plausible — 63

Nothing looked wrong to me. That is not evidence they are right, only that I had no
specific reason to flag them.

| Exercise | Anchor | Ratio | Equipment | kg @ ref | Why flagged | **SAM: ratio** |
|---|---|---|---|---|---|---|
| Back Squat | squat | 0.82 | barbell | 72.5 kg | — |   |
| Barbell Row | bench | 0.7 | barbell | 45 kg | — |   |
| Bear Carry | squat | 0.3 | dumbbell | 27.5 kg | — |   |
| Bench Press | bench | 0.82 | barbell | 55 kg | — |   |
| Bicep Curl (Dumbbell) | bench | 0.15 | dumbbell | 10 kg | — |   |
| Bodyweight Squat | squat | 0 | bodyweight | 0 kg | — |   |
| Box Squat | squat | 0.75 | barbell | 65 kg | — |   |
| Bulgarian Split Squats | squat | 0.22 | dumbbell | 20 kg | — |   |
| Cable Face Pull | bench | 0.18 | cable | 10 kg | — |   |
| Calf Raises | squat | 0.5 | machine | 45 kg | — |   |
| Chest Supported DB Row | bench | 0.22 | dumbbell | 15 kg | — |   |
| Chest Supported Row | bench | 0.28 | dumbbell | 17.5 kg | — |   |
| Chest-Supported DB Row | bench | 0.22 | dumbbell | 15 kg | — |   |
| Close Grip Bench | bench | 0.75 | barbell | 50 kg | — |   |
| Concentration Curl | bench | 0.08 | dumbbell | 5 kg | — |   |
| DB Bench Press | bench | 0.32 | dumbbell | 20 kg | — |   |
| DB Shoulder Press | bench | 0.22 | dumbbell | 15 kg | — |   |
| Dumbbell Kickback | bench | 0.08 | dumbbell | 5 kg | — |   |
| Dumbbell Skull Crusher | bench | 0.14 | dumbbell | 10 kg | — |   |
| Face Pull | bench | 0.18 | cable | 10 kg | — |   |
| Front Squat | squat | 0.7 | barbell | 62.5 kg | — |   |
| Goblet Squat | squat | 0.22 | dumbbell | 20 kg | — |   |
| Half-Kneeling Single-Arm Overhead Press | bench | 0.18 | dumbbell | 12.5 kg | — |   |
| Hammer Curl | bench | 0.12 | dumbbell | 7.5 kg | — |   |
| Hanging Leg Raise | bench | 0 | bodyweight | 0 kg | — |   |
| Hip Thrusts | squat | 0.7 | barbell | 62.5 kg | — |   |
| Incline Bench | bench | 0.72 | barbell | 47.5 kg | — |   |
| Incline DB Bench | bench | 0.28 | dumbbell | 17.5 kg | — |   |
| Incline Dumbbell Curl | bench | 0.1 | dumbbell | 7.5 kg | — |   |
| Kettlebell Swings | squat | 0.2 | kettlebell | 16 kg | — |   |
| Landmine Press | bench | 0.35 | barbell | 22.5 kg | — |   |
| Lat Pulldown | bench | 0.55 | cable | 35 kg | — |   |
| Lateral Raise | bench | 0.09 | dumbbell | 5 kg | — |   |
| Leg Extension | squat | 0.3 | machine | 25 kg | — |   |
| Lying Dumbbell Curl | bench | 0.1 | dumbbell | 7.5 kg | — |   |
| Neutral-Grip Pulldown | bench | 0.55 | cable | 35 kg | — |   |
| Overhead Carry | bench | 0.2 | dumbbell | 12.5 kg | — |   |
| Overhead Press | bench | 0.58 | barbell | 37.5 kg | — |   |
| Overhead Tricep Extension | bench | 0.15 | cable | 10 kg | — |   |
| RDLs | squat | 0.65 | barbell | 57.5 kg | — |   |
| Rear Delt Fly | bench | 0.09 | dumbbell | 5 kg | — |   |
| Reverse Lunges | squat | 0.2 | dumbbell | 17.5 kg | — |   |
| Seated Cable Row | bench | 0.5 | cable | 35 kg | — |   |
| Seated DB Press | bench | 0.22 | dumbbell | 15 kg | — |   |
| Shrugs | bench | 0.3 | dumbbell | 20 kg | — |   |
| Single-Arm DB Bench Press | bench | 0.28 | dumbbell | 17.5 kg | — |   |
| Single-Arm DB Row | bench | 0.28 | dumbbell | 17.5 kg | — |   |
| Single-Arm Lat Pulldown | bench | 0.3 | cable | 20 kg | — |   |
| Single-Arm Shrug | bench | 0.18 | dumbbell | 12.5 kg | — |   |
| Single-Leg Leg Press | squat | 0.6 | machine | 55 kg | — |   |
| Single-Leg RDL | squat | 0.15 | dumbbell | 12.5 kg | — |   |
| Single-Leg Squat (to Box) | squat | 0.16 | dumbbell | 15 kg | — |   |
| Skull Crushers | bench | 0.18 | dumbbell | 12.5 kg | — |   |
| Speed Bench | bench | 0.55 | barbell | 37.5 kg | — |   |
| Step Ups | squat | 0.2 | dumbbell | 17.5 kg | — |   |
| Trap Bar Deadlift | squat | 0.9 | barbell | 80 kg | — |   |
| Tricep Circuit (Dirty 30) | bench | 0.1 | dumbbell | 7.5 kg | — |   |
| Tricep Pushdown | bench | 0.2 | cable | 15 kg | — |   |
| Walking Lunges | squat | 0.2 | dumbbell | 17.5 kg | — |   |
| Weighted Dead Bug | bench | 0.1 | dumbbell | 7.5 kg | — |   |
| Woodchop (Half Kneeling) | bench | 0.1 | cable | 5 kg | — |   |
| Woodchop (Standing) | bench | 0.12 | cable | 10 kg | — |   |
| Z-Press | bench | 0.35 | barbell | 22.5 kg | — |   |

---

# 4. Floor-out — 4 ratios that currently do nothing

Each computes a weight **below its equipment minimum**, so the athlete always
receives the minimum and the ratio never applies. They look like decisions and have
no effect — changing the number changes nothing until the minimum moves.

So the decision is not "what should the ratio be" but:

- **delete as noise** — the minimum is the right answer for these movements, so
  remove the ratio and stop pretending something decides.
- **re-author** — the minimum is wrong for these movements; give a ratio **and** say
  what the equipment minimum should be.

| Exercise | Anchor | Ratio | Equipment | kg @ ref | Why flagged | **SAM: ratio** |
|---|---|---|---|---|---|---|
| Bicep Curl (Barbell) | bench | 0.3 | barbell | 20 kg | ratio floors out — computes 19.8kg, below the 20kg minimum, so the ratio never applies |   |
| Bottoms-Up KB Press | bench | 0.08 | kettlebell | 8 kg | ratio floors out — computes 5.3kg, below the 8kg minimum, so the ratio never applies |   |
| Explosive Landmine Press | bench | 0.25 | barbell | 20 kg | ratio floors out — computes 16.5kg, below the 20kg minimum, so the ratio never applies |   |
| Incline Y Raise | bench | 0.07 | dumbbell | 5 kg | ratio floors out — computes 4.6kg, below the 5kg minimum, so the ratio never applies |   |

---

# 5. Already ruled — 6

Ruled 2026-07-25. Context only, no action needed.

| Exercise | Anchor | Ratio | Equipment | kg @ ref | Why flagged | **SAM: ratio** |
|---|---|---|---|---|---|---|
| Back Extension | squat | 0.15 | dumbbell | 12.5 kg | — |   |
| Hamstring Curl | squat | 0.25 | machine | 20 kg | — |   |
| High Box Squat | squat | 0.9 | barbell | 80 kg | — |   |
| Single-Arm DB Floor Press | bench | 0.22 | dumbbell | 15 kg | — |   |
| Single-Leg Hip Thrust | squat | 0.2 | dumbbell | 17.5 kg | — |   |
| Speed Trap Bar Deadlift | squat | 0.45 | barbell | 40 kg | — |   |

---

## After sign-off

The workbook becomes the source of truth and the code follows it, held by an equality
test in both directions — the same arrangement as the conditioning templates. A
hand-edited ratio then fails the build.
