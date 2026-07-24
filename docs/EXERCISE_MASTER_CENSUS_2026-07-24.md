# Exercise Master Census — Local Footy Athlete

> Generated 2026-07-24. Read-only census for Sam's keep/add/delete review.

## Methodology

Every exercise name below was extracted programmatically from the app's own data modules (via `sucrase-node`, importing the real TypeScript) and canonicalised through the app's own `canonicalExerciseName()` (`src/utils/exerciseCanonicalisation.ts`) — the same boundary the app itself uses to resolve any incoming exercise name onto the curated cue vocabulary. No ad-hoc regex normalisation was used for in-app sources; literal source strings were extracted for the two Deno edge functions (`generate-program`, `sync-exercises`) that `sucrase-node` cannot import cross-runtime, then run through the same canonicalisation function.

**Sources enumerated:** `STRENGTH_POOLS` (strength pool anchors/accessories), `POOL_REGISTRY` (arms/prehab/mobility/recovery pools), `EXERCISE_CUES`, `EXERCISE_TAGS`, `EXERCISE_DEMO_VIDEOS` (video map), `EXERCISE_LOAD_MAP` + `TRUE_BODYWEIGHT_EXERCISES` + `PREHAB_NO_LOAD_EXERCISES` (load layer), `EXERCISE_ALIASES` (the load-alias map — the real "alias map"), `MOBILITY_FLOW_TEMPLATES` (recovery/mobility builder), `CONDITIONING_META` (conditioning templates — confirmed a real selectable pool via `resolveConditioning()`), `DEFAULT_EXERCISES` (onboarding default program), `AddExerciseModal.POPULAR_EXERCISES` (coach quick-pick chips), and the live `coach-chat` edge function's generation system prompt + embedded substitution pools (the generation prompt's exercise vocabulary).

**Reachability verdicts** were derived from the app's own import graph (who actually calls `selectPoolEntry`/`getPool`, `POOL_REGISTRY`, `attachRecoveryAddonsToWeek`, `resolveConditioning`, `sessionBuilder`), not assumption:

- **REACHABLE — selectable pool**: appears in a pool a live builder actually selects from (`STRENGTH_POOLS`, `POOL_REGISTRY`, `MOBILITY_FLOW_TEMPLATES`, `CONDITIONING_META`).
- **REACHABLE — generator-emittable**: only reachable via the live `coach-chat` AI generator's free-text prompt examples — real, but *not* an enforced allow-list (the LLM can emit anything; canonicalisation only bridges spelling back onto curated vocabulary *if* the model happens to land near a known alias).
- **ORPHANED — coverage-map only**: has a cue/tag/load/video/alias-target entry but no pool or generator path reaches it — dead weight in the curated content layer.
- **ORPHANED — dead edge functions**: only appears in `generate-program` or `sync-exercises`, both confirmed (by full-repo grep) to be deployed but never invoked from the live client — the app's legacy `V1_LAUNCH_DEFINITION`-era generator, fully superseded by `coach-chat`.
- **ORPHANED — AddExerciseModal only**: `src/components/AddExerciseModal.tsx` (the coach quick-pick chips) has zero importers anywhere in `src/` — the component itself is unreachable from any screen, independent of which exercises it lists.
- **BANNED**: `coach-chat`'s generation prompt explicitly forbids it (Olympic lifts).

## Summary

**Total canonical exercises across every source: 225**

| Reachability | Count |
|---|---|
| REACHABLE (total) | 182 |
| ORPHANED (total) | 42 |
| BANNED (total) | 1 |

-   1 — BANNED (coach-chat explicitly forbids)
-  21 — ORPHANED — coverage-map only (cue/tag/load/video/alias with no pool or generator path)
-  21 — ORPHANED — only in dead edge functions (generate-program/sync-exercises)
-  18 — REACHABLE — generator-emittable (coach-chat, free-text)
- 164 — REACHABLE — selectable pool

| Category | Count |
|---|---|
| Lower Body — Squat | 10 |
| Lower Body — Hinge | 10 |
| Lower Body — Lunge / Single-Leg | 8 |
| Lower Body — Power / Plyometric | 13 |
| Lower Body — Accessory / Prehab | 18 |
| Upper Body — Push (Horizontal) | 15 |
| Upper Body — Push (Vertical) | 10 |
| Upper Body — Pull (Horizontal) | 13 |
| Upper Body — Pull (Vertical) | 8 |
| Upper Body — Isolation / Shoulders / Arms | 21 |
| Core / Trunk | 12 |
| Carries | 4 |
| Conditioning | 36 |
| Recovery / Mobility / Breathing | 27 |
| Legacy / Dead-Path Only | 20 |

## Bible Cross-Reference — "Good Options" Gap Analysis

`docs/LFA_PROGRAMMING_BIBLE.md` (4712 lines, read in full) was mined for every concrete exercise name it lists as a "good option" / example movement per category. 139 distinct names were checked against the census via the same `canonicalExerciseName()` function. 83 already resolve to an existing app entry. The remainder split into two groups below.

### True gaps — Bible names it, app has no entry anywhere (21)

| Exercise (as the Bible names it) | Category | Why it matters |
|---|---|---|
| **Safety Bar Squat** | Lower Body — Squat | Named as a bilateral squat "good option" alongside Back/Front/Box/Goblet Squat (~line 785). App has none of the equipment-specific SSB variant. |
| **Tempo Squat** | Lower Body — Squat | "Controlled range squat" category example alongside Box/Goblet Squat (~line 790). No tempo-specific squat entry anywhere. |
| **Low Box Squat Jump** | Lower Body — Power / Plyometric | Contrast-training pairing partner for Box Squat (~line 1027). No app entry. |
| **Single-Leg Hip Thrust** | Lower Body — Hinge | Hip-dominant single-leg example (~line 834). App only has bilateral Hip Thrusts. |
| **Lateral Lunge** | Lower Body — Lunge / Single-Leg | Named repeatedly (lateral single-leg category, groin/adductor rules, ~lines 208, 210, 831, 835). No app entry. |
| **Cossack Squat** | Lower Body — Lunge / Single-Leg | Named as a lateral single-leg / adductor exercise (~lines 835, 890). No app entry. |
| **Hip Airplane** | Lower Body — Accessory / Prehab | "Hip airplane style work" — hip-dominant single-leg example (~line 834). No app entry. |
| **Pogo Jump** | Lower Body — Power / Plyometric | Calf/Achilles rules example (~line 902). No app entry (app has Light Skipping but no pogo-hop drill). |
| **Sled Push** | Lower Body — Power / Plyometric | Acceleration-rule "can be used carefully" example (~line 1550) and contrast pairing "Heavy sled push -> short acceleration" (~line 1058). No sled work anywhere in the app — matches the earlier 2026-03-24 canonical-exercise-list.md finding. |
| **Plank** | Core / Trunk | "Anti-extension" core example alongside Dead Bug (~line 923). App has Side Plank but no basic front Plank. |
| **Stir the Pot** | Core / Trunk | Anti-extension core example (~line 923). No app entry. |
| **Hollow Hold** | Core / Trunk | Anti-extension core example (~line 923). No app entry. |
| **Landmine Rotation** | Core / Trunk | Anti-rotation core example (~line 925). App has Woodchop variants but no landmine-specific rotation. |
| **Side Plank Row** | Core / Trunk | Lateral/anti-lateral-flexion example (~line 927). App has Side Plank but not the loaded row variant. |
| **Floor Press (bilateral, barbell/DB)** | Upper Body — Push (Horizontal) | Shoulder-friendly push example (~line 955) and shoulder-injury swap target ("Barbell bench -> DB floor press", ~line 2102). App only has Single-Arm DB Floor Press — no bilateral floor press. |
| **Medicine Ball Throw (rotational)** | Lower Body — Power / Plyometric | Lower-body power example, "if available" (~line 1029). No medicine-ball work anywhere in the app. |
| **Medicine Ball Chest Pass** | Upper Body — Push (Horizontal) | Upper-body power example, "if available" (~line 1034). No app entry. |
| **Medicine Ball Slam** | Upper Body — Push (Horizontal) | Upper-body power example, "if available" (~line 1035). No app entry. |
| **Controlled Shuttle / Up-Back Shuttle** | Conditioning | Named AFL-specific COD drill with a full worked example ("30m out / 180-turn / 30m back", ~lines 607-610, 1627-1631) and referenced repeatedly in sprint/hard-conditioning sections. No shuttle/COD drill anywhere in the app — matches the earlier 2026-03-24 doc's "Shuttle Runs" suggestion. |
| **Erg EMOM** | Conditioning | Named hard-intervals format (~lines 576, 1265). App has MetCon/Tabata-style entries but no EMOM-labelled format. |
| **Bottoms-Up KB Carry** | Carries | Shoulder-stability example paired with Bottoms-Up KB Press (~line 349). App has Bottoms-Up KB Press but not the carry variant. |

### Naming variants — likely already covered under a different app name (8)

Lower-priority: probably not missing content, just a naming mismatch worth Sam confirming.

| Bible name | Category | Possible app equivalent | Note |
|---|---|---|---|
| Split Squat (flat, not rear-foot-elevated) | Lower Body — Lunge / Single-Leg | Bulgarian Split Squats | Bible names plain "split squat" as a distinct, easier regression from "Bulgarian split squat" in several places (new-to-training progression ~line 3055, single-leg category ~line 831). App only has the RFE/Bulgarian variant under this name family. |
| Hamstring Bridge / Hamstring Isometric | Lower Body — Hinge | Bosch Hold / Glute Bridge | Bible's Nordic-injury swap target (~line 1977). Likely already covered by Bosch Hold or Glute Bridge — confirm naming with Sam rather than adding new. |
| Lateral Step-Down | Lower Body — Accessory / Prehab | Step-Down / Slant Board Step-Down | Bible names the lateral variant specifically (~line 835); app's Step-Down entries don't distinguish lateral from straight-ahead. |
| Adductor Squeeze | Lower Body — Accessory / Prehab | Groin Squeeze | Likely the same drill as Groin Squeeze under a different name (~line 1911). |
| Hanging Knee Raise | Core / Trunk | Hanging Leg Raise | Bible distinguishes knee-tuck from straight-leg raise (~line 929); app only has "Hanging Leg Raise". |
| Neutral-Grip DB Press | Upper Body — Push (Horizontal) | DB Bench Press / DB Shoulder Press | Shoulder-friendly push variant and shoulder-injury swap target (~lines 955, 2103). Possibly already covered generically by the DB press family — confirm. |
| Chest-Supported Machine Row | Upper Body — Pull (Horizontal) | Chest Supported Row / Chest Supported DB Row | Elbow-injury swap target (~line 2426); likely the same slot as the app's existing chest-supported row entries under a machine-specific name. |
| Light Cable Curl | Upper Body — Isolation / Shoulders / Arms | Cable Bicep Curl | Elbow-injury swap target (~line 2427); likely a load-reduced variant of the existing Cable Bicep Curl rather than a new movement. |

**Not re-derived here:** the Bible also states extensive injury-specific contraindication and "bad swap" rules (e.g. "RDL pain -> lighter RDL is bad", "Overhead press pain -> DB shoulder press is still overhead"). Checking those against `EXERCISE_TAGS` injury ratings is a rules-conformance audit, not an exercise-inventory question, and the repo already has a dedicated `src/__tests__/bibleConformance/` suite for that surface — out of scope here, flagged as NOT-COVERED below rather than re-derived ad hoc.

## Exercise Inventory by Category

### Lower Body — Squat (10)

⚠️ 1 orphaned/banned entries in this category (listed first below).

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
| ORPHAN | Hack Squat | ORPHANED |  |  |  | Y |  |
|  | Back Squat | REACHABLE | Y | Y | Y | Y | `back squat`, `Barbell Back Squat` |
|  | Bodyweight Squat | REACHABLE |  |  | Y | Y |  |
|  | Box Squat | REACHABLE | Y | Y | Y | Y | `box squat` |
|  | Front Squat | REACHABLE | Y | Y | Y | Y |  |
|  | Goblet Squat | REACHABLE | Y | Y | Y | Y | `goblet squat` |
|  | high box squat | REACHABLE |  |  |  |  |  |
|  | Leg Press | REACHABLE | Y | Y | Y | Y | `leg press` |
|  | Single-Leg Leg Press | REACHABLE | Y | Y | Y | Y |  |
|  | Single-Leg Squat (to Box) | REACHABLE | Y | Y | Y | Y | `single leg squat to box`, `Single Leg Squat` |

### Lower Body — Hinge (10)

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
|  | back extension | REACHABLE |  |  |  |  |  |
|  | Deadlift | REACHABLE | Y | Y | Y | Y | `Barbell Deadlift` |
|  | Glute Bridge | REACHABLE |  |  | Y | Y |  |
|  | Hip Thrusts | REACHABLE | Y | Y | Y | Y | `hip thrusts` |
|  | Kettlebell Swings | REACHABLE | Y | Y | Y | Y |  |
|  | RDLs | REACHABLE | Y | Y | Y | Y | `RDL` |
|  | Single-Leg RDL | REACHABLE | Y | Y | Y | Y | `single leg RDL` |
|  | speed trap bar DL | REACHABLE |  |  |  |  |  |
|  | Trap Bar Deadlift | REACHABLE | Y | Y | Y | Y | `trap bar deadlift` |
|  | trap bar DL | REACHABLE |  |  |  |  |  |

### Lower Body — Lunge / Single-Leg (8)

⚠️ 3 orphaned/banned entries in this category (listed first below).

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
| ORPHAN | Slant Board Step-Down | ORPHANED |  |  | Y |  |  |
| ORPHAN | Step-Down | ORPHANED |  |  | Y |  |  |
| ORPHAN | Tempo Step-Up | ORPHANED |  |  | Y | Y |  |
|  | Bulgarian Split Squats | REACHABLE | Y | Y | Y | Y | `Bulgarian split squats`, `Bulgarian Split Squat` |
|  | Reverse Lunges | REACHABLE | Y | Y | Y | Y |  |
|  | RFE split squats | REACHABLE |  |  |  |  |  |
|  | Step Ups | REACHABLE | Y | Y | Y | Y |  |
|  | Walking Lunges | REACHABLE | Y | Y | Y | Y | `lunges`, `walking lunges` |

### Lower Body — Power / Plyometric (13)

⚠️ 6 orphaned/banned entries in this category (listed first below).

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
| ORPHAN | Countermovement Jump | ORPHANED |  |  | Y |  |  |
| ORPHAN | Kneeling Jump | ORPHANED |  | Y |  |  |  |
| ORPHAN | Lateral Jump | ORPHANED |  | Y |  |  |  |
| BANNED | Olympic lifts (cleans, snatches) | BANNED (coach-chat explicitly forbids) |  |  |  |  |  |
| ORPHAN | RFE Split Squat Jump | ORPHANED |  |  | Y |  |  |
| ORPHAN | Vertical Jump | ORPHANED |  |  | Y |  |  |
|  | Box Jumps | REACHABLE | Y | Y | Y |  | `box jump`, `Box Jump` |
|  | Broad Jumps | REACHABLE | Y | Y | Y |  | `broad jump` |
|  | Depth Jumps | REACHABLE | Y | Y | Y |  |  |
|  | explosive push-ups | REACHABLE |  |  |  |  |  |
|  | Jump Squats | REACHABLE | Y | Y | Y |  | `squat jump`, `jump squats` |
|  | Lateral Bounds | REACHABLE | Y | Y | Y |  |  |
|  | vertical jump | REACHABLE |  |  |  |  |  |

### Lower Body — Accessory / Prehab (18)

⚠️ 5 orphaned/banned entries in this category (listed first below).

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
| ORPHAN | Abductor Machine | ORPHANED | Y | Y | Y |  |  |
| ORPHAN | Banded TKE | ORPHANED |  |  | Y |  |  |
| ORPHAN | Bosch Hold | ORPHANED |  |  | Y |  |  |
| ORPHAN | Hamstring Curl | ORPHANED | Y |  |  |  |  |
| ORPHAN | Spanish Squat Hold | ORPHANED |  |  | Y |  |  |
|  | Adductor Machine | REACHABLE | Y | Y | Y | Y |  |
|  | Calf Raises | REACHABLE | Y | Y | Y | Y | `calf raises` |
|  | Copenhagen Plank (Half) | REACHABLE | Y | Y | Y |  | `Copenhagen plank` |
|  | crab walks | REACHABLE |  |  |  |  |  |
|  | Groin Squeeze | REACHABLE | Y | Y | Y |  |  |
|  | hamstring curls | REACHABLE |  |  |  |  |  |
|  | Leg Extension | REACHABLE | Y | Y | Y | Y | `knee extensions` |
|  | Long-Lever Copenhagen | REACHABLE | Y | Y | Y |  |  |
|  | Nordic Lower | REACHABLE | Y | Y | Y |  | `Nordic lowers`, `Nordic Hamstring Curls`, `Nordic Hamstring Curl` |
|  | Seated Calf Raise | REACHABLE | Y | Y | Y |  |  |
|  | Single-Leg Calf Raise | REACHABLE | Y | Y | Y |  |  |
|  | Swiss Ball Hamstring Curl | REACHABLE | Y | Y | Y |  |  |
|  | Tib Raises | REACHABLE | Y | Y | Y |  | `tib raises` |

### Upper Body — Push (Horizontal) (15)

⚠️ 5 orphaned/banned entries in this category (listed first below).

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
| ORPHAN | Cable Chest Fly | ORPHANED |  |  |  | Y |  |
| ORPHAN | Cable Fly | ORPHANED |  |  |  | Y |  |
| ORPHAN | Explosive Push-Ups | ORPHANED |  |  | Y |  |  |
| ORPHAN | Machine Chest Press | ORPHANED |  |  |  | Y |  |
| ORPHAN | Single-Arm DB Floor Press | ORPHANED | Y | Y | Y | Y |  |
|  | Bench Press | REACHABLE | Y | Y | Y | Y | `bench press` |
|  | Close Grip Bench | REACHABLE | Y | Y | Y | Y |  |
|  | DB Bench Press | REACHABLE | Y | Y | Y | Y | `flat DB press`, `Dumbbell Bench Press` |
|  | Dips | REACHABLE | Y | Y | Y |  | `dips` |
|  | Incline Bench | REACHABLE | Y | Y | Y | Y | `incline bench` |
|  | Incline DB Bench | REACHABLE | Y | Y | Y | Y | `incline DB press` |
|  | Push-ups | REACHABLE | Y | Y | Y |  | `push-ups` |
|  | Scap Push-Up | REACHABLE | Y | Y | Y |  |  |
|  | Single-Arm DB Bench Press | REACHABLE | Y | Y | Y | Y |  |
|  | Speed Bench | REACHABLE | Y | Y | Y | Y | `speed bench` |

### Upper Body — Push (Vertical) (10)

⚠️ 1 orphaned/banned entries in this category (listed first below).

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
| ORPHAN | Half-Kneeling Landmine Press | ORPHANED |  |  | Y | Y |  |
|  | Bottoms-Up KB Press | REACHABLE | Y | Y | Y | Y |  |
|  | DB Shoulder Press | REACHABLE | Y | Y | Y | Y |  |
|  | Explosive Landmine Press | REACHABLE | Y | Y | Y | Y | `explosive landmine press` |
|  | Half-Kneeling Single-Arm Overhead Press | REACHABLE | Y | Y | Y | Y | `single arm half kneeling OHP` |
|  | Landmine Press | REACHABLE | Y | Y | Y | Y | `landmine press` |
|  | Overhead Press | REACHABLE | Y | Y | Y | Y | `overhead press` |
|  | seated DB OHP | REACHABLE |  |  |  |  |  |
|  | Seated DB Press | REACHABLE | Y | Y | Y | Y |  |
|  | Z-Press | REACHABLE | Y | Y | Y | Y | `Z press` |

### Upper Body — Pull (Horizontal) (13)

⚠️ 1 orphaned/banned entries in this category (listed first below).

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
| ORPHAN | Inverted Rows | ORPHANED |  |  |  |  |  |
|  | Band Pull-Apart | REACHABLE | Y | Y | Y |  |  |
|  | Barbell Row | REACHABLE | Y | Y | Y | Y | `Pendlay Rows` |
|  | bent over BB row | REACHABLE |  |  |  |  |  |
|  | Cable Face Pull | REACHABLE | Y | Y | Y | Y |  |
|  | Chest Supported Row | REACHABLE | Y | Y | Y | Y |  |
|  | Chest-Supported DB Row | REACHABLE | Y | Y | Y | Y | `Chest Supported DB Row` |
|  | Face Pull | REACHABLE | Y | Y | Y | Y | `Face Pulls`, `face pulls` |
|  | incline DB row (chest supported) | REACHABLE |  |  |  |  |  |
|  | Inverted Row (Bodyweight) | REACHABLE | Y | Y | Y |  |  |
|  | Rear Delt Fly | REACHABLE | Y | Y | Y | Y |  |
|  | Seated Cable Row | REACHABLE | Y | Y | Y | Y | `Cable Rows`, `Seated Row` |
|  | Single-Arm DB Row | REACHABLE | Y | Y | Y | Y | `single arm DB row`, `DB Rows`, `Dumbbell Rows` |

### Upper Body — Pull (Vertical) (8)

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
|  | Chin-Up Negative (Slow) | REACHABLE | Y | Y | Y |  |  |
|  | Chin-Ups | REACHABLE | Y | Y | Y |  | `chin-ups`, `Chin-ups` |
|  | Lat Pulldown | REACHABLE | Y | Y | Y | Y | `Lat Pulldowns` |
|  | Neutral-Grip Pulldown | REACHABLE | Y | Y | Y | Y |  |
|  | Pull-Ups | REACHABLE | Y | Y | Y |  | `pull-ups`, `Pull-ups` |
|  | Single-Arm Lat Pulldown | REACHABLE | Y | Y | Y | Y |  |
|  | Single-Arm Pulldown | REACHABLE | Y |  | Y |  |  |
|  | weighted pull-ups | REACHABLE |  |  |  |  |  |

### Upper Body — Isolation / Shoulders / Arms (21)

⚠️ 1 orphaned/banned entries in this category (listed first below).

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
| ORPHAN | Pec Deck | ORPHANED |  |  |  | Y |  |
|  | Banded Bicep Curl | REACHABLE | Y | Y | Y |  |  |
|  | Banded External Rotation | REACHABLE | Y | Y | Y |  |  |
|  | Banded Tricep Pushdown | REACHABLE | Y | Y | Y |  |  |
|  | Bicep Curl (Barbell) | REACHABLE | Y | Y | Y | Y |  |
|  | Bicep Curl (Dumbbell) | REACHABLE | Y | Y | Y | Y | `Bicep Curls`, `bicep curls` |
|  | Concentration Curl | REACHABLE | Y | Y | Y | Y |  |
|  | Dumbbell Kickback | REACHABLE | Y | Y | Y | Y |  |
|  | Dumbbell Skull Crusher | REACHABLE | Y | Y | Y | Y |  |
|  | Hammer Curl | REACHABLE | Y | Y | Y | Y |  |
|  | Incline Dumbbell Curl | REACHABLE | Y | Y | Y | Y | `Incline DB Curls` |
|  | Incline Y Raise | REACHABLE | Y | Y | Y | Y |  |
|  | Lateral Raise | REACHABLE | Y | Y | Y | Y | `lateral raises`, `Lateral Raises` |
|  | Lying Dumbbell Curl | REACHABLE | Y | Y | Y | Y |  |
|  | machine curls | REACHABLE |  |  |  |  |  |
|  | Overhead Tricep Extension | REACHABLE | Y | Y | Y | Y |  |
|  | Shrugs | REACHABLE | Y | Y | Y | Y | `DB shrugs` |
|  | Single-Arm Shrug | REACHABLE | Y | Y | Y | Y |  |
|  | Skull Crushers | REACHABLE | Y | Y | Y | Y | `skull crushers` |
|  | Tricep Circuit (Dirty 30) | REACHABLE | Y | Y | Y | Y |  |
|  | Tricep Pushdown | REACHABLE | Y | Y | Y | Y | `Tricep Pushdowns`, `tricep pushdowns` |

### Core / Trunk (12)

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
|  | Ab Wheel | REACHABLE | Y | Y | Y |  | `ab wheel` |
|  | Band Pallof Press | REACHABLE | Y | Y | Y |  | `Pallof press` |
|  | Banded Dead Bug | REACHABLE | Y | Y | Y |  |  |
|  | Bird Dog | REACHABLE | Y | Y | Y |  |  |
|  | Dead Bug | REACHABLE | Y | Y | Y |  |  |
|  | dragon flag | REACHABLE |  |  |  |  |  |
|  | Hanging Leg Raise | REACHABLE | Y | Y | Y | Y | `hanging leg raise` |
|  | McGill Sit Up | REACHABLE | Y | Y | Y |  |  |
|  | Side Plank | REACHABLE | Y | Y | Y |  | `side plank` |
|  | Weighted Dead Bug | REACHABLE | Y | Y | Y | Y |  |
|  | Woodchop (Half Kneeling) | REACHABLE | Y | Y | Y | Y |  |
|  | Woodchop (Standing) | REACHABLE | Y | Y | Y | Y | `Cable Woodchop` |

### Carries (4)

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
|  | Bear Carry | REACHABLE | Y | Y | Y | Y |  |
|  | Farmer Carry | REACHABLE | Y | Y | Y | Y | `farmers carry`, `Farmer Carries` |
|  | Overhead Carry | REACHABLE | Y | Y | Y | Y |  |
|  | Suitcase Carry | REACHABLE | Y | Y | Y | Y | `suitcase carry`, `Suitcase Carries` |

### Conditioning (36)

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
|  | 1km Repeat Intervals | REACHABLE |  |  |  |  |  |
|  | 200m/400m Repeat Runs | REACHABLE |  |  |  |  |  |
|  | 30:30 Tempo Blocks | REACHABLE |  |  |  |  |  |
|  | 4x4 VO2 | REACHABLE |  |  |  |  |  |
|  | 6x1km | REACHABLE |  |  | Y |  |  |
|  | Air Bike Sprints | REACHABLE | Y |  | Y |  |  |
|  | Assault Bike Intervals | REACHABLE |  |  | Y |  |  |
|  | Bike/Row/Ski Tempo Intervals | REACHABLE |  |  |  |  |  |
|  | Cruise Intervals | REACHABLE |  |  |  |  |  |
|  | Easy Bike | REACHABLE | Y |  | Y |  |  |
|  | Easy Row | REACHABLE | Y |  | Y |  |  |
|  | Easy Ski | REACHABLE | Y |  | Y |  |  |
|  | Easy Swim | REACHABLE |  |  | Y |  |  |
|  | Flush Run | REACHABLE | Y |  | Y |  |  |
|  | Flying Sprints | REACHABLE |  |  |  |  |  |
|  | Footy Fartlek | REACHABLE |  |  |  |  |  |
|  | Free Sprint Session | REACHABLE |  |  |  |  |  |
|  | Hard Assault Bike Intervals | REACHABLE |  |  | Y |  |  |
|  | Hard Row Intervals | REACHABLE |  |  | Y |  |  |
|  | Hard SkiErg Intervals | REACHABLE |  |  | Y |  |  |
|  | Hill Sprints | REACHABLE | Y |  | Y |  |  |
|  | Inverse Tabata | REACHABLE |  |  |  |  |  |
|  | Light Circuits | REACHABLE | Y |  | Y |  |  |
|  | Long Nasal Run | REACHABLE |  |  |  |  |  |
|  | Long Run | REACHABLE | Y |  | Y |  |  |
|  | MAS 15:15 Blocks | REACHABLE |  |  |  |  |  |
|  | MAS Training | REACHABLE |  |  | Y |  |  |
|  | Max Effort Sprint Accumulation | REACHABLE |  |  |  |  |  |
|  | MetCon | REACHABLE |  |  | Y |  |  |
|  | Quality Sprints | REACHABLE | Y |  | Y |  |  |
|  | Row Intervals | REACHABLE | Y |  | Y |  |  |
|  | SkiErg Intervals | REACHABLE |  |  | Y |  |  |
|  | Sprint Intervals | REACHABLE | Y |  | Y |  |  |
|  | Tabata Intervals | REACHABLE |  |  |  |  |  |
|  | Tempo Intervals (1min on / 1min easy) | REACHABLE |  |  |  |  |  |
|  | Tempo Run | REACHABLE | Y |  | Y |  |  |

### Recovery / Mobility / Breathing (27)

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
|  | 90/90 Breathing | REACHABLE | Y | Y |  |  | `90-90 Breathing` |
|  | Adductor Rockback | REACHABLE | Y | Y |  |  |  |
|  | Box Breathing | REACHABLE | Y | Y |  |  |  |
|  | Calf Stretch | REACHABLE | Y | Y |  |  |  |
|  | Cat-Cow | REACHABLE | Y | Y |  |  |  |
|  | Chest / Pec Stretch (Doorway) | REACHABLE | Y | Y |  |  |  |
|  | Child's Pose with Breathing | REACHABLE | Y | Y |  |  |  |
|  | Couch Stretch | REACHABLE | Y | Y |  |  |  |
|  | Crocodile Breathing | REACHABLE | Y | Y |  |  |  |
|  | Dead Hang | REACHABLE | Y | Y |  |  |  |
|  | Deep Squat Hold | REACHABLE | Y | Y |  |  |  |
|  | Foam Roll — Calves & Outer Shins | REACHABLE | Y | Y |  |  |  |
|  | Foam Roll — Hip Flexor, Quad, Adductors | REACHABLE | Y | Y |  |  |  |
|  | Foam Roll — IT Band | REACHABLE | Y | Y |  |  |  |
|  | Foam Roll — Lats | REACHABLE | Y | Y |  |  |  |
|  | Foam Roll — T-Spine | REACHABLE | Y | Y |  |  |  |
|  | Hip 90/90 Stretch | REACHABLE | Y | Y |  |  |  |
|  | Incline Treadmill Walk | REACHABLE | Y |  |  |  |  |
|  | Lacrosse Ball Glute Release | REACHABLE | Y | Y |  |  |  |
|  | Lat Stretch | REACHABLE | Y | Y |  |  |  |
|  | Light Skipping | REACHABLE | Y |  |  |  |  |
|  | Light Walk or Stationary Bike | REACHABLE | Y |  |  |  |  |
|  | Open Book Thoracic Rotation | REACHABLE | Y | Y |  |  |  |
|  | Outdoor Walk | REACHABLE | Y |  |  |  |  |
|  | Pigeon Stretch | REACHABLE | Y | Y |  |  |  |
|  | Toe Stretch | REACHABLE | Y | Y |  |  |  |
|  | World's Greatest Stretch | REACHABLE | Y | Y |  |  |  |

### Legacy / Dead-Path Only (20)

⚠️ 20 orphaned/banned entries in this category (listed first below).

| Flag | Canonical Name | Reachability | Cue | Video | Tags | Load | Raw name variants (if different) |
|---|---|---|---|---|---|---|---|
| ORPHAN | Barbell Rows | ORPHANED |  |  |  |  |  |
| ORPHAN | Cable Bicep Curl | ORPHANED |  |  |  |  |  |
| ORPHAN | Deep Lunges | ORPHANED |  |  |  |  |  |
| ORPHAN | Dumbbell Flyes | ORPHANED |  |  |  |  |  |
| ORPHAN | Explosive Movements | ORPHANED |  |  |  |  |  |
| ORPHAN | Full Back Squat | ORPHANED |  |  |  |  |  |
| ORPHAN | Heavy Back Squats | ORPHANED |  |  |  |  |  |
| ORPHAN | Heavy Deadlifts | ORPHANED |  |  |  |  |  |
| ORPHAN | Heavy Sprints | ORPHANED |  |  |  |  |  |
| ORPHAN | Hyperextensions | ORPHANED |  |  |  |  |  |
| ORPHAN | Incline Bench Press | ORPHANED |  |  |  |  |  |
| ORPHAN | Leg Curl | ORPHANED |  |  |  |  |  |
| ORPHAN | Plyometric Drills | ORPHANED |  |  |  |  |  |
| ORPHAN | Power Clean | ORPHANED |  |  |  |  |  |
| ORPHAN | Rows | ORPHANED |  |  |  |  |  |
| ORPHAN | Side to Side Movements | ORPHANED |  |  |  |  |  |
| ORPHAN | Single Leg Work | ORPHANED |  |  |  |  |  |
| ORPHAN | TRX Suspension | ORPHANED |  |  |  |  |  |
| ORPHAN | TRX Suspension Rows | ORPHANED |  |  |  |  |  |
| ORPHAN | Weighted Sits-ups | ORPHANED |  |  |  |  |  |

## NOT-COVERED

Per Process Law (L1-L10), stated explicitly rather than silently omitted:

- **No device/simulator verification.** This is a static, read-only source census — nothing was run on-device or in the simulator. No claim is made about what an athlete actually sees at runtime beyond what the import graph proves is reachable.
- **Bible injury/contraindication conformance not re-checked.** See the note above the naming-variants table — that is `bibleConformance/`'s job, not re-derived here.
- **`coach-revision-proposal` / `coach-semantic-program-edit-draft` prompt vocabulary not audited.** Only `coach-chat`'s `GENERATE_SYSTEM_PROMPT` was read for generation vocabulary (per the task's explicit ask); the newer semantic-edit adapters (`llmSemanticCoachRevisionProposalAdapter.ts`, `llmSemanticProgramEditDraftAdapter.ts`) have their own prompt-construction code that was not mined for exercise-name vocabulary — they consume the same canonicalised pools/tags for substitution, so the exposure is expected to be a subset of what's already covered, but this was not independently verified.
- **`EXERCISE_ALIASES` alias *keys* (the ~440 informal input spellings) are not individually listed** — only alias *targets* (the canonical names they resolve to) were folded into the census, since the keys are spelling variants of names already covered, not new exercises. The full alias table lives at `src/utils/loadEstimation.ts:268`.
- **`exerciseSubstitutes.ts` diff-axis / substitution-scoring logic not audited** for correctness — it was confirmed to introduce no exercise names beyond `STRENGTH_POOLS`/`EXERCISE_TAGS` already captured, but its selection *behaviour* (which substitutes it actually offers) was not tested.
- **`Legacy / Dead-Path Only` category (20 entries)** is dead code by import-graph analysis (confirmed via full-repo grep — `generate-program`/`sync-exercises` are deployed but have zero call sites in `src/`), not by testing every possible admin/cron trigger path; `supabase/config.toml` registers both functions for local `serve`/deploy but that is not an invocation.
