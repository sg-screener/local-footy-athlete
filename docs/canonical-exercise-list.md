# Canonical Exercise List — Local Footy Athlete

> Extracted from all source files on 2026-03-24.
> Purpose: single source of truth for the upcoming exercise tagging system.

---

## 1. Clean Canonical Exercise List (Grouped)

### A. Lower Body — Compound

| # | Canonical Name | Sources |
|---|---------------|---------|
| 1 | Back Squat | rulesEngine, defaultProgram, exerciseDb, generate-program, sync-exercises, coach-chat |
| 2 | Front Squat | rulesEngine, exerciseDb, generate-program |
| 3 | Box Squat | rulesEngine, exerciseDb, generate-program |
| 4 | Goblet Squat | defaultProgram, exerciseDb, coach-chat |
| 5 | Bulgarian Split Squats | rulesEngine, defaultProgram, exerciseDb, generate-program |
| 6 | Walking Lunges | defaultProgram, exerciseDb, coach-chat |
| 7 | Lunges | exerciseDb, coach-chat |
| 8 | Single-Leg Squat (to box) | sync-exercises, coach-chat |
| 9 | Leg Press | defaultProgram, exerciseDb, sync-exercises |
| 10 | Step Ups | exerciseDb |
| 11 | Cossack Squats | exercisePools |
| 12 | Sumo Goblet Squats | exercisePools |

### B. Lower Body — Hinge

| # | Canonical Name | Sources |
|---|---------------|---------|
| 13 | Deadlift | rulesEngine, exerciseDb, generate-program, sync-exercises |
| 14 | Trap Bar Deadlift | rulesEngine, defaultProgram, exerciseDb, generate-program |
| 15 | RDLs (Romanian Deadlifts) | rulesEngine, defaultProgram, exerciseDb, generate-program |
| 16 | Single-Leg RDL | exercisePools (light variant), coach-chat |
| 17 | Hip Thrusts | rulesEngine, defaultProgram, exerciseDb, generate-program |
| 18 | Leg Curls | defaultProgram, exerciseDb, sync-exercises, coach-chat |
| 19 | Nordic Curls | defaultProgram, exerciseDb, sync-exercises, coach-chat |
| 20 | Nordic Curl Negatives | exercisePools |
| 21 | Stability Ball Hamstring Curls | exercisePools |
| 22 | Banded Hamstring Curls | exercisePools |
| 23 | Slider Leg Curls | exercisePools |
| 24 | Back Extension | coach-chat |
| 25 | Reverse Hyper | coach-chat |
| 26 | Kettlebell Swings | exerciseDb |

### C. Lower Body — Power / Plyometric

| # | Canonical Name | Sources |
|---|---------------|---------|
| 27 | Power Clean | exerciseDb, sync-exercises |
| 28 | Power Snatch | exerciseDb |
| 29 | Hang Power Clean | exerciseDb |
| 30 | Box Jumps | exerciseDb, sync-exercises |
| 31 | Broad Jumps | exerciseDb, coach-chat |
| 32 | Jump Squats | exerciseDb, coach-chat |
| 33 | Depth Jumps | exerciseDb |
| 34 | Lateral Bounds | sync-exercises |

### D. Lower Body — Accessory / Prehab

| # | Canonical Name | Sources |
|---|---------------|---------|
| 35 | Calf Raises | defaultProgram, exerciseDb, coach-chat |
| 36 | Single-Leg Calf Raise | exercisePools, exerciseDb |
| 37 | Seated Calf Raise | exercisePools, coach-chat |
| 38 | Calf Raise (Barbell) | exercisePools |
| 39 | Tib Raises | exercisePools, coach-chat |
| 40 | Banded Ankle Dorsiflexion | exercisePools |
| 41 | Leg Extension | exerciseDb, coach-chat |
| 42 | Copenhagen Planks | exercisePools, coach-chat |
| 43 | Side-Lying Adduction | exercisePools |
| 44 | Banded Lateral Walks / Crab Walks | exercisePools, coach-chat |
| 45 | Wall Sits | coach-chat |
| 46 | Bosch Hold | coach-chat |
| 47 | Hip Flex Lifts | coach-chat |

### E. Upper Body — Push (Horizontal)

| # | Canonical Name | Sources |
|---|---------------|---------|
| 48 | Bench Press | rulesEngine, defaultProgram, exerciseDb, generate-program |
| 49 | DB Bench Press | rulesEngine, exerciseDb, generate-program, sync-exercises |
| 50 | Incline Bench Press | rulesEngine, exerciseDb, generate-program |
| 51 | Incline DB Bench | defaultProgram, exerciseDb |
| 52 | Close Grip Bench | rulesEngine, exerciseDb, generate-program |
| 53 | Push-ups | exerciseDb, coach-chat |
| 54 | Explosive / Clap Push-ups | coach-chat |
| 55 | Speed Bench | coach-chat |
| 56 | Cable Flyes | exerciseDb, sync-exercises |
| 57 | Dips | rulesEngine, defaultProgram, exerciseDb, generate-program |

### F. Upper Body — Push (Vertical)

| # | Canonical Name | Sources |
|---|---------------|---------|
| 58 | Overhead Press | rulesEngine, defaultProgram, exerciseDb, generate-program |
| 59 | DB Shoulder Press | rulesEngine, exerciseDb, generate-program, coach-chat |
| 60 | Landmine Press | rulesEngine, exerciseDb, generate-program |
| 61 | Explosive Landmine Press | coach-chat |
| 62 | Z Press | coach-chat |
| 63 | Single-Arm Half-Kneeling OH Press | coach-chat |

### G. Upper Body — Pull (Horizontal)

| # | Canonical Name | Sources |
|---|---------------|---------|
| 64 | Barbell Rows | rulesEngine, defaultProgram, exerciseDb, generate-program |
| 65 | DB Rows | rulesEngine, defaultProgram, exerciseDb, generate-program |
| 66 | Pendlay Rows | rulesEngine, exerciseDb, generate-program |
| 67 | Cable Rows / Seated Row | exerciseDb, generate-program, sync-exercises |
| 68 | Chest Supported Rows / Incline DB Row | exercisePools, exerciseDb, coach-chat |
| 69 | Single-Arm DB Row | coach-chat |

### H. Upper Body — Pull (Vertical)

| # | Canonical Name | Sources |
|---|---------------|---------|
| 70 | Pull-ups | rulesEngine, defaultProgram, exerciseDb, generate-program |
| 71 | Weighted Pull-ups | coach-chat |
| 72 | Chin-ups | rulesEngine, exerciseDb, generate-program |
| 73 | Lat Pulldown | exerciseDb, generate-program |

### I. Accessories / Isolation — Arms

| # | Canonical Name | Sources |
|---|---------------|---------|
| 74 | Barbell Curls | defaultProgram, exerciseDb, exercisePools, coach-chat |
| 75 | DB Bicep Curls | exercisePools, exerciseDb |
| 76 | Hammer Curls | exercisePools, exerciseDb |
| 77 | Incline DB Curls | exercisePools, coach-chat |
| 78 | Cable Curls | exercisePools, sync-exercises |
| 79 | Skull Crushers | exercisePools, exerciseDb |
| 80 | Rope Pushdowns | exercisePools, exerciseDb, sync-exercises |
| 81 | Overhead Tricep Extension | exercisePools |
| 82 | Close Grip Push-ups | exercisePools |
| 83 | Dips (Tricep Focus) | exercisePools |

### J. Accessories / Isolation — Shoulders & Upper Back

| # | Canonical Name | Sources |
|---|---------------|---------|
| 84 | Lateral Raises | defaultProgram, exerciseDb, exercisePools, coach-chat |
| 85 | Cable Lateral Raises | exercisePools |
| 86 | Front Raises | exerciseDb, exercisePools |
| 87 | Face Pulls | defaultProgram, exerciseDb, exercisePools, coach-chat |
| 88 | Face Pulls (Light / Shoulder Health) | exercisePools |
| 89 | Reverse Pec Deck | exerciseDb, exercisePools |
| 90 | Band Pull-aparts | exercisePools, exerciseDb |
| 91 | Banded Pull-aparts | exercisePools |
| 92 | DB Shrugs | exercisePools |
| 93 | Prone Y Raises / Prone I-Y-T Raises | exercisePools |
| 94 | Cuban Press | exercisePools, coach-chat |
| 95 | Band External Rotations | exercisePools |

### K. Core / Trunk

| # | Canonical Name | Sources |
|---|---------------|---------|
| 96 | Pallof Press | exercisePools, exerciseDb, coach-chat |
| 97 | Cable Woodchops | exercisePools, exerciseDb, sync-exercises |
| 98 | Half-Kneeling Landmine Press (core) | exercisePools |
| 99 | Anti-Rotation Band Walks | exercisePools |
| 100 | Single-Arm Farmer Carry | exercisePools |
| 101 | Farmer Carries | rulesEngine, exerciseDb, generate-program, coach-chat |
| 102 | Suitcase Carries | rulesEngine, exerciseDb, generate-program |
| 103 | Ab Wheel | exerciseDb, coach-chat |
| 104 | Hanging Leg Raises | exerciseDb, coach-chat |
| 105 | Russian Twists | exerciseDb |
| 106 | Dragon Flag | coach-chat |
| 107 | GHD Sit-ups | coach-chat |
| 108 | Side Plank | coach-chat |
| 109 | Weighted Side Plank | coach-chat |

### L. Conditioning

| # | Canonical Name | Sources |
|---|---------------|---------|
| 110 | Sprint Intervals | defaultProgram, exerciseDb |
| 111 | Tempo Run | defaultProgram, exerciseDb |
| 112 | Rowing Machine | exercisePools (easy), exerciseDb |
| 113 | Assault Bike | exerciseDb |
| 114 | Jump Rope | exerciseDb |

### M. Recovery / Mobility

| # | Canonical Name | Sources |
|---|---------------|---------|
| 115 | Foam Roll Quads | exercisePools |
| 116 | Foam Roll Glutes | exercisePools |
| 117 | Foam Roll Lats | exercisePools |
| 118 | Lacrosse Ball Pec Release | exercisePools |
| 119 | Foam Roll Adductors | exercisePools |
| 120 | 90/90 Hip Switches | exercisePools |
| 121 | World's Greatest Stretch | exercisePools |
| 122 | Deep Squat Hold | exercisePools |
| 123 | Bretzel Stretch | exercisePools |
| 124 | Hip Flexor Stretch with Reach | exercisePools |
| 125 | Walk (easy) | exercisePools |
| 126 | Light Cycle | exercisePools |
| 127 | Elliptical (easy) | exercisePools |
| 128 | Swimming (easy) | exercisePools |
| 129 | Box Breathing | exercisePools |
| 130 | Crocodile Breathing | exercisePools |
| 131 | 90/90 Breathing | exercisePools |
| 132 | Diaphragmatic Breathing | exercisePools |
| 133 | Physiological Sigh | exercisePools |
| 134 | TRX Suspension (recovery variant) | sync-exercises |

**Total: 134 canonical exercises**

---

## 2. Duplicates & Inconsistencies Found

### Naming Collisions (same exercise, different strings)

| Canonical Name | Variants Found | Where |
|---------------|----------------|-------|
| **RDLs** | "RDLs", "Romanian Deadlifts" (in exerciseDb comments), "Single leg RDL" (different exercise) | rulesEngine, exerciseDb, coach-chat |
| **Nordic Curls** | "Nordic Curls", "Nordic Hamstring Curl", "Nordic lowers", "Nordic Curl Negatives" | defaultProgram, sync-exercises, coach-chat, exercisePools |
| **DB Rows** | "DB Rows", "Dumbbell Rows", "single arm DB row", "incline DB row (chest supported)" | rulesEngine, sync-exercises, coach-chat |
| **Calf Raises** | "Calf Raises", "Single-Leg Calf Raise", "Seated Calf Raise", "Calf Raise (Barbell)", "Calf raises (standing)", "bent leg calf raises (seated)" | defaultProgram, exercisePools, coach-chat |
| **Face Pulls** | "Face Pulls", "Face Pulls (Light)", "Cable Face Pulls", "face pulls" | defaultProgram, exercisePools, coach-chat |
| **Band Pull-aparts** | "Band Pull-aparts", "Banded Pull-aparts" | exercisePools (two separate pools reference these) |
| **Incline Bench** | "Incline Bench", "Incline Bench Press", "Incline DB Bench" | rulesEngine, exerciseDb, defaultProgram |
| **Chest Supported Rows** | "Chest Supported Rows", "incline DB row (chest supported)" | exercisePools, coach-chat |
| **Prone Y Raises** | "Prone Y Raises", "Prone I-Y-T Raises" | exercisePools (two separate pools) |
| **Farmer Carries** | "Farmer Carries", "Farmers carry", "Single-Arm Farmer Carry" | rulesEngine, coach-chat, exercisePools |
| **Cable Rows** | "Cable Rows", "Seated Row" | exerciseDb, sync-exercises |
| **Lateral Walks** | "Banded Lateral Walks", "Crab Walks" | exercisePools, coach-chat |
| **Woodchops** | "Cable Woodchops", "Woodchops", "Cable Woodchop" | exercisePools, exerciseDb, sync-exercises |
| **Dips** | "Dips" (compound), "Dips (Tricep Focus)" (isolation) | rulesEngine, exercisePools — same movement, different intent |
| **Leg Curls** | "Leg Curls", "hamstring curls (lying machine)", "hamstring curl on Bosu ball", "Stability Ball Hamstring Curls", "Banded Hamstring Curls", "Slider Leg Curls" | Multiple — these are genuinely different variants but naming is inconsistent |
| **Landmine Press** | "Landmine Press", "Half-Kneeling Landmine Press", "explosive landmine press" | rulesEngine, exercisePools, coach-chat — different variants |
| **Push-ups** | "Push-ups", "Close Grip Push-ups", "explosive push ups", "clap push ups" | exerciseDb, exercisePools, coach-chat |
| **Bicep Curls** | "Barbell Curls", "DB Bicep Curls", "Hammer Curls", "Incline DB Curls", "Cable Curls", "Bicep curls", "Cable Bicep Curl" | Scattered everywhere — some are genuinely different, but "Bicep curls" vs "DB Bicep Curls" vs "Barbell Curls" vs "Cable Bicep Curl" needs normalizing |
| **Leg Extension** | "Leg Extension", "Knee extensions" | exerciseDb, coach-chat |
| **Overhead Press** | "Overhead Press", "DB Shoulder Press", "seated DB overhead press", "single arm half kneeling overhead press" | Multiple — different exercises but naming lineage is messy |

### Structural Inconsistencies

1. **exercisePools.ts uses `id` strings** like `'db_bicep_curls'` that don't match exerciseDb lookup keys (`'DB Bicep Curls'`). No shared ID system.

2. **exerciseDbService.ts maps display names → ExerciseDB slugs** but the mapping is one-directional. If an exercise exists in coach-chat's prompt but not in exerciseDbService, it has no animated GIF.

3. **coach-chat system prompt uses lowercase free-text** exercise names (e.g., "incline DB row (chest supported)") that don't match any canonical key elsewhere.

4. **generate-program's EXERCISE_VARIATION_GROUPS** defines substitution families but only covers a subset of exercises. Many valid swaps aren't captured.

5. **sync-exercises AFL_PRIORITY_EXERCISES** uses "Barbell Back Squat" while everywhere else it's just "Back Squat".

6. **Recovery/mobility/breathing exercises** in exercisePools have no presence in exerciseDbService — no GIF mapping exists for any of them.

7. **Conditioning types** (Sprint Intervals, Tempo Run, etc.) appear in defaultProgram and exerciseDb but are also defined as `WorkoutType` in domain.ts. They're simultaneously "exercises" and "session types" with no clear boundary.

---

## 3. Suggested Additions (Not Currently in the System)

These are common AFL S&C exercises that are absent from all sources but would be expected in a complete footy program:

### Lower Body
- **Barbell Hip Thrust** (current "Hip Thrusts" is generic — specify barbell vs banded)
- **Banded Hip Thrust** (common warm-up/activation)
- **Glute Bridge** (regression of hip thrust, useful for beginners)
- **Single-Leg Leg Press** (unilateral variant)
- **Sled Push / Sled Pull** (common in AFL programs)
- **Prowler Push** (conditioning + leg strength)

### Upper Body
- **Inverted Rows / Ring Rows** (pull-up regression)
- **Single-Arm Lat Pulldown** (unilateral variant)
- **Arnold Press** (shoulder variation)

### Power / Speed
- **Medicine Ball Slam** (upper body power)
- **Medicine Ball Rotational Throw** (rotational power — AFL-specific)
- **Sled Sprint** (resisted sprint — very common in AFL prep)
- **Banded Broad Jump** (resisted plyometric)
- **Single-Leg Bounds** (more specific than "Lateral Bounds")
- **Hurdle Hops** (plyometric progression)

### Core / Trunk
- **Dead Bug** (very common core exercise, surprisingly absent)
- **Bird Dog** (stability staple)
- **Plank** (basic — currently only side plank exists)
- **Suitcase Deadlift** (anti-lateral flexion)
- **Turkish Get-up** (full-body stability)

### Prehab / Activation
- **Glute Med Clams** (very common hip activation)
- **Mini-Band Monster Walks** (hip activation)
- **Thoracic Spine Rotation** (mobility — common warm-up)
- **Ankle Mobility Drill (knee-to-wall)** (common prehab)
- **Banded External Rotation at 90° Abduction** (shoulder prehab for overhead athletes)

### Conditioning
- **Shuttle Runs / Beep Test** (AFL-specific)
- **Repeated Sprint Ability (RSA) Drill** (AFL match simulation)
- **Fartlek Run** (common endurance variant)
- **Bike Intervals (Wattbike/Assault)** (low-impact conditioning)

---

## Summary Stats

| Category | Count |
|----------|-------|
| Lower Body — Compound | 12 |
| Lower Body — Hinge | 14 |
| Lower Body — Power / Plyo | 8 |
| Lower Body — Accessory / Prehab | 13 |
| Upper Body — Push (Horiz) | 10 |
| Upper Body — Push (Vert) | 6 |
| Upper Body — Pull (Horiz) | 6 |
| Upper Body — Pull (Vert) | 4 |
| Accessories — Arms | 10 |
| Accessories — Shoulders & Upper Back | 12 |
| Core / Trunk | 14 |
| Conditioning | 5 |
| Recovery / Mobility | 20 |
| **Total** | **134** |

Sources scanned: `exercisePools.ts`, `rulesEngine.ts`, `defaultProgram.ts`, `exerciseDbService.ts`, `sessionBuilder.ts`, `coach-chat/index.ts`, `generate-program/index.ts`, `sync-exercises/index.ts`
