# Muscle Groups + Experience Level — Review Sheet (2026-07-25)

Read-only sheet generation for Sam's review. Every exercise below is enumerated live from `selectableExerciseVocabulary.ts` (`selectableVocabularyGroups()`), which is the single owner of "which exercises exist" post-census — including this week's three approved Add-exercise swaps. 186 exercises total, grouped by the pool that owns each name.

Every row is a DRAFT pre-fill using standard S&C knowledge (movement pattern, load, fatigue, eccentric demand, stability, and the app's own `InjuryProfile`/`lateWeek` tags in `exerciseTags.ts`, plus `BEGINNER_EXERCISE_PRIORITY` in `trainingAgePolicy.ts` as ground truth for what the app already treats as beginner-safe). Sam's pass overwrites the Primary / Secondary / Experience Level cells directly in the spreadsheet — that overwrite is what makes the row authored rather than draft. This feeds the Phase 4.3 muscle-block mechanism (D11).

**20 of 186 rows are flagged ⚑** (Notes column, highlighted) as genuinely uncertain calls rather than confident pre-fill — those are the ones most worth Sam's attention first. A further 38 rows carry a plain clarifying note (e.g. which plain-language muscle bucket a specific target like tibialis anterior or the QL was mapped to) — those are confident calls, not flags.

Experience-level ladder used (plain labels): `everyone` / `1+ years` / `2+ years` / `advanced only` / `beginner-only`. `beginner-only` was not assigned to any exercise in this pass — every movement in the locked vocabulary is either open to everyone or gated by a minimum, not reserved exclusively for beginners. Flagging that as a NOT-COVERED item below rather than forcing a label onto something.

## Lower squat

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Back Squat | Quads, Glutes | Hips, Trunk/core | 1+ years |  |
| Front Squat | Quads, Glutes | Trunk/core, Upper back | 2+ years | ⚑ rack-position mobility/technique demand is higher than back squat, but could reasonably be 1+ years. |
| Box Squat | Quads, Glutes | Hips | everyone |  |
| High Box Squat | Quads, Glutes | Hips | 1+ years |  |
| Walking Lunges | Quads, Glutes | Hamstrings, Hips | 1+ years |  |
| Bulgarian Split Squats | Quads, Glutes | Hamstrings, Hips | 2+ years |  |
| Reverse Lunges | Quads, Glutes | Hamstrings, Hips | everyone |  |
| Step Ups | Quads, Glutes | Hips | everyone |  |
| Goblet Squat | Quads, Glutes | Trunk/core | everyone |  |
| Leg Press | Quads, Glutes | Hamstrings | everyone |  |
| Single-Leg Leg Press | Quads, Glutes | Hamstrings, Hips | everyone |  |
| Single-Leg Squat (to Box) | Quads, Glutes | Hips | 1+ years |  |
| Bodyweight Squat | Quads, Glutes | Trunk/core | everyone |  |

## Lower hinge

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Deadlift | Hamstrings, Glutes | Upper back, Trunk/core | 2+ years | ⚑ straight-bar technical demand; app's own beginner curriculum substitutes Trap Bar instead, but 1+ years is defensible too. |
| Trap Bar Deadlift | Hamstrings, Glutes | Quads, Upper back | everyone |  |
| RDLs | Hamstrings, Glutes | Upper back, Trunk/core | 2+ years | ⚑ hamstring tagged 'avoid' (highest injury rating) + high eccentric demand, but could arguably be 1+ years. |
| Single-Leg RDL | Hamstrings, Glutes | Hips, Trunk/core | everyone |  |
| Hip Thrusts | Glutes | Hamstrings | everyone |  |
| Kettlebell Swings | Glutes, Hamstrings | Trunk/core | 1+ years |  |
| Glute Bridge | Glutes | Hamstrings | everyone |  |

## Upper push horizontal

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Bench Press | Chest | Triceps, Shoulders | 1+ years |  |
| Incline Bench | Chest, Shoulders | Triceps | 1+ years |  |
| Close Grip Bench | Triceps, Chest | Shoulders | 1+ years |  |
| DB Bench Press | Chest | Triceps, Shoulders | everyone |  |
| Incline DB Bench | Chest, Shoulders | Triceps | everyone |  |
| Push-ups | Chest | Triceps, Shoulders, Trunk/core | everyone |  |
| Dips | Chest, Triceps | Shoulders | 1+ years |  |
| Single-Arm DB Bench Press | Chest | Triceps, Trunk/core | 2+ years | anti-rotation control under unilateral load; low stability + caution lateWeek in the source tags. |
| Single-Arm DB Floor Press | Chest, Triceps | Trunk/core | 1+ years | ⚑ shorter ROM protects the shoulder vs. the bench variant, so this may be gentler than the sibling above — could be 'everyone'. |

## Upper push vertical

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Overhead Press | Shoulders | Triceps, Trunk/core | 1+ years |  |
| Landmine Press | Shoulders, Chest | Triceps | 1+ years | ⚑ SAFE injury profile suggests this could reasonably be 'everyone'; not in the app's own beginner curriculum, so left at 1+ years. |
| DB Shoulder Press | Shoulders | Triceps | 1+ years |  |
| Seated DB Press | Shoulders | Triceps | everyone |  |
| Half-Kneeling Single-Arm Overhead Press | Shoulders | Triceps, Trunk/core | everyone |  |
| Explosive Landmine Press | Shoulders, Chest | Triceps | 1+ years |  |
| Z-Press | Shoulders | Triceps, Trunk/core | 2+ years | ⚑ no leg drive raises the core/shoulder stability demand, but could be 1+ years. |

## Upper pull horizontal

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Barbell Row | Upper back, Lats | Biceps, Trunk/core | 1+ years |  |
| Chest Supported Row | Upper back, Lats | Biceps | everyone | ⚑ not in the app's literal beginner list (Single-Arm DB Row is), but SAFE injury profile reads as beginner-friendly — could be 1+ years instead. |
| Single-Arm DB Row | Upper back, Lats | Biceps, Trunk/core | everyone |  |
| Seated Cable Row | Upper back, Lats | Biceps | everyone |  |
| Face Pull | Shoulders, Upper back | — | everyone |  |
| Rear Delt Fly | Shoulders, Upper back | — | everyone |  |
| Band Pull-Apart | Upper back, Shoulders | — | everyone |  |

## Upper pull vertical

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Pull-Ups | Lats, Upper back | Biceps | 1+ years |  |
| Chin-Ups | Lats, Biceps | Upper back | 1+ years |  |
| Lat Pulldown | Lats, Upper back | Biceps | everyone |  |
| Neutral-Grip Pulldown | Lats, Upper back | Biceps | everyone |  |
| Single-Arm Lat Pulldown | Lats | Biceps, Upper back | everyone |  |
| Single-Arm Pulldown | Lats | Biceps, Upper back | everyone |  |

## Lower plyometric

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Box Jumps | Quads, Glutes | Calves | 1+ years |  |
| Broad Jumps | Quads, Glutes | Hamstrings, Calves | 2+ years |  |
| Jump Squats | Quads, Glutes | Calves | 1+ years |  |
| Lateral Bounds | Quads, Glutes | Groin, Calves | 2+ years | ⚑ adductor tagged 'avoid' (highest injury rating) for a unilateral lateral landing — genuinely borderline vs. advanced-only. |
| Depth Jumps | Quads, Glutes | Calves, Hamstrings | advanced only | knee + ankle both tagged 'avoid'; classic high eccentric-overload drop-jump reserved for qualified athletes. |

## Carries

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Farmer Carry | Trunk/core, Upper back | Shoulders | everyone |  |
| Bear Carry | Trunk/core, Upper back | Shoulders | everyone |  |
| Suitcase Carry | Trunk/core | Upper back, Shoulders | 1+ years |  |
| Overhead Carry | Shoulders, Trunk/core | Upper back | 1+ years |  |

## Accessories upper

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Shrugs | Upper back | — | everyone |  |
| Skull Crushers | Triceps | — | 1+ years | elbow-strain-prone lockout under barbell load vs. the dumbbell version. |
| Bicep Curl (Barbell) | Biceps | — | everyone |  |
| Bicep Curl (Dumbbell) | Biceps | — | everyone |  |
| Hammer Curl | Biceps | — | everyone |  |
| Incline Dumbbell Curl | Biceps | — | everyone |  |
| Lying Dumbbell Curl | Biceps | — | everyone |  |
| Banded Bicep Curl | Biceps | — | everyone |  |
| Concentration Curl | Biceps | — | everyone |  |
| Tricep Pushdown | Triceps | — | everyone |  |
| Banded Tricep Pushdown | Triceps | — | everyone |  |
| Overhead Tricep Extension | Triceps | — | everyone |  |
| Dumbbell Skull Crusher | Triceps | — | 1+ years | same elbow lockout concern as the barbell version, lighter load. |
| Dumbbell Kickback | Triceps | — | everyone |  |
| Tricep Circuit (Dirty 30) | Triceps | — | everyone |  |
| Lateral Raise | Shoulders | — | everyone |  |
| Incline Y Raise | Shoulders, Upper back | — | everyone |  |
| Single-Arm Shrug | Upper back | — | everyone |  |

## Accessories lower

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Nordic Lower | Hamstrings | — | advanced only | hamstring tagged 'avoid'; classic high-eccentric-overload movement — standard guidance is an eccentric-strength base before loading this. |
| Hamstring Curl | Hamstrings | — | everyone |  |
| Leg Extension | Quads | — | everyone |  |
| Calf Raises | Calves | — | everyone |  |
| Tib Raises | Calves | — | everyone | targets tibialis anterior (shin) specifically; 'Calves' is the closest plain-language bucket. |
| Single-Leg Hip Thrust | Glutes | Hamstrings | everyone |  |
| Back Extension | Hamstrings, Glutes | Trunk/core | everyone | targets lower-back extensors specifically; 'Trunk/core' is the closest plain-language bucket. |

## Arms — biceps

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Chin-Up Negative (Slow) | Lats, Biceps | Upper back | 1+ years |  |

## Shoulders

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Cable Face Pull | Shoulders, Upper back | — | everyone |  |

## Upper back

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Chest-Supported DB Row | Upper back, Lats | Biceps | everyone |  |
| Inverted Row (Bodyweight) | Upper back, Lats | Biceps | everyone |  |

## Groin / adductors

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Copenhagen Plank (Half) | Groin | Trunk/core | 1+ years |  |
| Long-Lever Copenhagen | Groin | Trunk/core | 2+ years |  |
| Groin Squeeze | Groin | — | everyone |  |
| Cossack Squat | Groin, Quads | Glutes, Hips | 1+ years |  |
| Lateral Lunge | Groin, Quads | Glutes, Hips | 1+ years |  |

## Calves

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Single-Leg Calf Raise | Calves | — | everyone |  |
| Seated Calf Raise | Calves | — | everyone |  |

## Lower prehab

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Banded TKE | Quads | — | everyone |  |
| Bosch Hold | Hamstrings, Calves | — | everyone |  |
| Spanish Squat Hold | Quads | — | everyone |  |
| Slant Board Step-Down | Quads | Hips | everyone |  |
| Crab Walks | Glutes, Hips | — | everyone |  |

## Core / trunk

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Band Pallof Press | Trunk/core | — | everyone |  |
| Dead Bug | Trunk/core | — | everyone |  |
| Banded Dead Bug | Trunk/core | — | everyone |  |
| Weighted Dead Bug | Trunk/core | Shoulders | 1+ years |  |
| McGill Sit Up | Trunk/core | — | everyone |  |
| Ab Wheel | Trunk/core | Shoulders | 2+ years | ⚑ progressive anti-extension skill move; pubalgia tagged 'avoid' — could arguably be 1+ years depending on how far the rollout range is regressed. |
| Hanging Leg Raise | Trunk/core | Hips | 1+ years |  |
| Bird Dog | Trunk/core | Glutes | everyone |  |
| Side Plank | Trunk/core | — | everyone |  |
| Plank | Trunk/core | Shoulders | everyone |  |
| Hollow Hold | Trunk/core | — | everyone |  |
| Stir the Pot | Trunk/core | Shoulders | everyone |  |
| Dragon Flag | Trunk/core | Shoulders | advanced only | lower back tagged 'avoid'; classic advanced core skill move, high eccentric demand through the full posterior chain. |
| Side Plank Row | Trunk/core | Upper back | everyone |  |
| Woodchop (Standing) | Trunk/core | Shoulders | everyone |  |
| Woodchop (Half Kneeling) | Trunk/core | Shoulders | everyone |  |

## Shoulder health

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Banded External Rotation | Shoulders | — | everyone |  |
| Bottoms-Up KB Press | Shoulders | Trunk/core | everyone | ⚑ wrist/shoulder stabilisation demand is real even at light load — could be 1+ years. |
| Scap Push-Up | Shoulders, Upper back | Trunk/core | everyone |  |

## Hamstring (light)

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Swiss Ball Hamstring Curl | Hamstrings | Trunk/core | everyone |  |

## Tissue quality

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Foam Roll — Hip Flexor, Quad, Adductors | Quads, Groin | Hips | everyone |  |
| Foam Roll — T-Spine | Upper back | — | everyone |  |
| Foam Roll — IT Band | Quads | Hips | everyone |  |
| Foam Roll — Lats | Lats | — | everyone |  |
| Foam Roll — Calves & Outer Shins | Calves | — | everyone |  |
| Lacrosse Ball Glute Release | Glutes | Hips | everyone |  |

## Mobility

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Hip 90/90 Stretch | Hips | Groin | everyone |  |
| Cat-Cow | Trunk/core | — | everyone |  |
| World's Greatest Stretch | Hips, Groin | Trunk/core | everyone |  |
| Deep Squat Hold | Hips, Groin | Calves | everyone |  |
| Couch Stretch | Quads, Hips | — | everyone |  |
| Open Book Thoracic Rotation | Upper back | Trunk/core | everyone |  |
| Pigeon Stretch | Hips, Glutes | Groin | everyone |  |
| Adductor Rockback | Groin | Hips | everyone |  |
| Chest / Pec Stretch (Doorway) | Chest | Shoulders | everyone |  |
| Lat Stretch | Lats | Shoulders | everyone |  |
| Dead Hang | Lats, Shoulders | — | everyone |  |
| Toe Stretch | Calves | — | everyone | targets the foot/ankle specifically; 'Calves' is the closest plain-language bucket. |
| Calf Stretch | Calves | — | everyone |  |
| QL Back Extension | Trunk/core | — | everyone | targets the quadratus lumborum (side of lower back) specifically; 'Trunk/core' is the closest plain-language bucket. |
| ATG Split Squat | Quads, Hips | Groin, Calves | everyone | ⚑ deep ankle/hip mobility demand — some athletes may need to regress the range; could be 1+ years. |
| Elephant Walks | Hamstrings | Calves | everyone |  |

## Easy cardio (zone 1)

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Light Walk or Stationary Bike | — | — | everyone |  |
| Incline Treadmill Walk | — | — | everyone |  |
| Outdoor Walk | — | — | everyone |  |
| Light Skipping | Calves | — | everyone |  |

## Breathing reset

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| 90/90 Breathing | — | — | everyone |  |
| Crocodile Breathing | — | — | everyone |  |
| Box Breathing | — | — | everyone |  |
| Child's Pose with Breathing | — | — | everyone |  |

## Conditioning

| Exercise | Primary | Secondary | Experience | Notes |
|---|---|---|---|---|
| Sprint Intervals | — | — | 1+ years | ⚑ field sprint at top-end speed; hamstring/calf tagged 'avoid'. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all. |
| Hill Sprints | — | — | 1+ years | ⚑ field sprint at top-end speed; hamstring/calf tagged 'avoid'. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all. |
| Quality Sprints | — | — | 1+ years | ⚑ field sprint at top-end speed; hamstring/calf tagged 'avoid'. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all. |
| MAS Training | — | — | 1+ years | ⚑ field sprint at top-end speed; hamstring/calf tagged 'avoid'. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all. |
| Flying Sprints | — | — | 1+ years | ⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all. |
| MAS 15:15 Blocks | — | — | 1+ years | ⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all. |
| Tabata Intervals | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Inverse Tabata | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Max Effort Sprint Accumulation | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Free Sprint Session | — | — | 1+ years | ⚑ field sprint at top-end speed; hamstring/calf tagged 'avoid'. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all. |
| MetCon | — | — | 1+ years | ⚑ mixed high-output format with technical/coordination demand across movements — the training-age ladder is a rough fit for a session format. |
| Long Run | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| 6x1km | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| 1km Repeat Intervals | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| 4x4 VO2 | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| 200m/400m Repeat Runs | — | — | 1+ years | ⚑ sprint-adjacent speed endurance at high impact — the training-age ladder is a rough fit for a session format. |
| Footy Fartlek | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Hard Row Intervals | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Hard SkiErg Intervals | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Hard Assault Bike Intervals | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Erg EMOM | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Tempo Run | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Long Nasal Run | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| 30:30 Tempo Blocks | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Tempo Intervals (1min on / 1min easy) | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Cruise Intervals | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Bike/Row/Ski Tempo Intervals | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Air Bike Sprints | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Row Intervals | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| SkiErg Intervals | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Assault Bike Intervals | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Flush Run | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Easy Bike | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Easy Row | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Easy Ski | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Easy Swim | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |
| Light Circuits | — | — | everyone | session format, not an individual movement — no meaningful muscle group. |

## NOT COVERED

- **`beginner-only` label**: unused. No exercise in the locked vocabulary was judged exclusive to complete beginners — flagging this rather than forcing an assignment.
- **Power-pool-pending exercises**: `Vertical Jump`, `Explosive Push-up`, `Pogo Hops`, `Kneeling Jump`, `Lateral Jump`, `Speed Trap Bar Deadlift`, `Speed Bench`, `RFE Split Squat Jump` are excluded — they carry the `power_pool_pending` exemption and are NOT part of the selectable vocabulary (`docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md` is approved but not built). Re-run this sheet once that spec ships.
- **Session labels / recovery-flow / conditioning-prescription literals** (`Conditioning`, `Mobility Flow`, `Breathing Reset`, the free-text rower/ski prescriptions): not real exercises (`LITERAL_EXEMPTIONS` in `selectableExerciseVocabulary.ts`), so not rows here.
- **Load numbers / cues / videos**: out of scope for this sheet — it covers muscle groups and experience gating only, not the load ratios already ruled on (`exercisePoolsStrength.ts`) or cue/video authoring.
- **Cross-checking against a movement-screen or PT assessment**: this pre-fill is desk research from standard S&C knowledge plus the app's own tags, not a clinical review. Anything Sam flags as wrong should be treated as more authoritative than the tags it was derived from.
- **Device/UI verification**: this is a read-only spreadsheet generation task — no app screens were touched, so there is nothing to device-test here.
