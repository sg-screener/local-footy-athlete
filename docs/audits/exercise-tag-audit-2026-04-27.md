# Exercise Tagging System Audit — Coach Substitution Readiness
*Date: 2026-04-27*

## TL;DR

We already have enough tags to build genuinely intelligent Coach substitutions. **The blocker is reachability, not coverage.** `coachActions.ts` and `supabase/functions/coach-chat/index.ts` currently do not import `EXERCISE_TAGS` or any pool, so the substitution ladder lives only as static text in the system prompt. The minimal next step is wiring the existing tag system into the Coach's runtime, not adding new tags.

---

## 1. Existing tags summary (per dimension the user asked about)

### Hinge
- **Where:** `src/data/exerciseTags.ts` — `movement: 'hinge'` on `ExerciseTag`.
- **Examples:** Deadlift, Trap Bar Deadlift, RDL, Single-Leg RDL, Hip Thrust, Glute Bridge, Kettlebell Swings, Good Morning.
- **Pool slot:** `exercisePoolsStrength.ts` `PoolSlotKey: 'hinge'` (anchor + accessory).
- **Status:** Complete. Family ladder is fully expressed.

### Squat / knee-dominant
- **Where:** `exerciseTags.ts` — `movement: 'squat'` and `movement: 'lunge'`.
- **Examples:** Back Squat, Front Squat, Goblet Squat, Bulgarian Split Squat, Step Up, Walking Lunge, Reverse Lunge.
- **Pool slot:** `PoolSlotKey: 'squat'`.
- **Status:** Complete. `lunge` and `squat` together give the full knee-dominant family.

### Unilateral
- **Where:** `exerciseTags.ts` — boolean `unilateral` on every tag entry.
- **Examples (true):** Bulgarian Split Squat, Single-Leg RDL, Step Up, Walking Lunge, Single-Arm DB Row.
- **Status:** Complete. Lets us reliably offer "bilateral → unilateral" downgrades.

### Low spinal load
- **Where:** **Not a direct tag.** Inferable from `injury.lowerBack: 'good' | 'caution' | 'avoid'` on `InjuryProfile`, plus pool `equipment` / `region`.
- **Workable proxy:** `injury.lowerBack === 'good' && movement !== 'hinge' OR exercise is unilateral/anchored`.
- **Status:** Adequate via inference; no need to invent a `spinalLoad` tag yet.

### Fatigue (high / low)
- **Where:** `exerciseTags.ts` — `fatigue: 'low' | 'moderate' | 'high'` and parallel `doms: 'low' | 'moderate' | 'high'`.
- **Examples (high):** Back Squat, Deadlift, Bench Press. **(low):** Pallof Press, Bird Dog, Foam Roll, Calf Raise.
- **Status:** Complete. Two independent axes (systemic vs muscle damage) is exactly what we want.

### Upper push
- **Where:** `exerciseTags.ts` — `movement: 'horizontal_push'` and `movement: 'vertical_push'`.
- **Examples:** Bench Press, DB Bench, Incline DB Press, Push-Up, Overhead Press, Landmine Press, DB Shoulder Press.
- **Pool slots:** `PoolSlotKey: 'horizontal_push'` and `'vertical_push'`.
- **Status:** Complete. Splitting horizontal/vertical is correct for substitution — they're not always interchangeable.

### Upper pull
- **Where:** `exerciseTags.ts` — `movement: 'horizontal_pull'` and `movement: 'vertical_pull'`.
- **Examples:** Pull-Ups, Chin-Ups, Lat Pulldown, Barbell Row, DB Row, Cable Row, Inverted Row.
- **Pool slots:** `PoolSlotKey: 'horizontal_pull'` and `'vertical_pull'`.
- **Status:** Complete.

### Trunk / core
- **Where:** `exerciseTags.ts` — `movement: 'core'` and `region: 'core'`. Plus `exercisePools.ts` `TRUNK_ANTI_ROTATION_POOL`.
- **Examples:** Pallof Press, Dead Bug, Bird Dog, Side Plank, Ab Wheel, Hanging Leg Raise, McGill Sit Up, Woodchop.
- **Status:** Complete; the anti-rotation pool is already a curated ladder.

### Prehab
- **Where:** `exercisePools.ts` `ExerciseCategory` enum: `lower_prehab`, `shoulder_health`, `groin_adductors`, `hamstring_light`.
- **Examples:** Tibialis Raise, Banded External Rotation, Copenhagen Plank, Swiss Ball Hamstring Curl.
- **Status:** Complete on the pool side. Note: prehab exercises are NOT in `EXERCISE_TAGS` — they live only in pools.

### Mobility
- **Where:** `exercisePools.ts` `ExerciseCategory: 'mobility' | 'tissue_quality' | 'breathing_reset'`.
- **Examples:** Hip 90/90, Cat-Cow, World's Greatest Stretch, Couch Stretch, Pigeon, Foam Roll variants.
- **Status:** Complete on the pool side.

### Equipment constraints
- **Where:** Two systems running in parallel.
  - `exercisePools.ts` — `EquipmentTag` enum (11 values: bodyweight, dumbbells, barbell, cables, bands, bench, foam_roller, bike_or_treadmill, pullup_bar, kettlebell, machine).
  - `loadEstimation.ts` — `EXERCISE_LOAD_MAP` has an `equipment` field per exercise.
- **Status:** Complete but split across two files. Both are accurate; neither is reachable from Coach today.

### Injury cautions
- **Where:** Two systems with **different schemas** (this is the only real inconsistency).
  - `exerciseTags.ts` `InjuryProfile`: 10 areas × `'good' | 'caution' | 'avoid'`. Areas: `adductor, pubalgia, lowerBack, knee, hamstring, calf, ankle, shoulder, elbow, wrist`.
  - `exercisePools.ts` `InjuryTag`: 12 string values (different vocabulary): `shoulder, knee, ankle, lower_back, hip, groin, hamstring, wrist, elbow, quad, calf, neck`.
- **Bridge already exists:** `exerciseFilter.ts` has `INJURY_AREA_MAP` that normalises both vocabularies.
- **Status:** Complete + already reconciled in `exerciseFilter.ts`. Coach just needs to call into it.

---

## 2. Gaps found

The list is short because most "gaps" are actually reachability problems.

**Real gaps**
- **Prehab and mobility exercises live only in pools, not in `EXERCISE_TAGS`.** That's fine in practice (pools own those domains), but a Coach asking "can I substitute Bench for something easier on the shoulder?" can find the answer for strength via tags but has to switch data source for prehab. Coach-side adapter can hide this.
- **No `spinalLoad` axis as a first-class tag.** Today inferred from `injury.lowerBack` + pattern. Not a blocker — keep as derived attribute until we have a concrete case it fails on.
- **Naming inconsistency: `lower_back` vs `lowerBack`, `groin` vs `adductor`.** Two different schemas, but the bridge in `exerciseFilter.ts:INJURY_AREA_MAP` already handles this. No code change required, just don't bypass that map.

**Non-gaps (worth saying out loud)**
- Movement family ladder for substitution is already authoritatively encoded in `exercisePoolsStrength.ts` slots (`squat | hinge | horizontal_push | vertical_push | horizontal_pull | vertical_pull`). That's exactly the granularity the substitution rule needs.
- Load ratios on `PoolEntry.loadRatio` already give us a numerical "lighter / heavier" signal for free (Back Squat 1.00 → Goblet ≈ 0.55 → Step Up ≈ 0.40).

---

## 3. Can we build substitution intelligence from current tags?

**Yes — for the strength ladder, today.** Every fact the substitution rule needs is already a typed field somewhere:
- Pattern family → `ExerciseTag.movement` or `PoolSlotKey`.
- Bilateral vs unilateral → `ExerciseTag.unilateral`.
- Heavy vs light → `PoolEntry.loadRatio` (numeric) or `ExerciseTag.fatigue` (categorical).
- Spinal stress → `ExerciseTag.injury.lowerBack`.
- Equipment swap → `EXERCISE_LOAD_MAP.equipment` or pool `EquipmentTag`.
- Injury filtering → `applyInjuryFilters` already exists in `exerciseFilter.ts` and consumes the same shape.

The "meaningfully different along load/structure/stress/equipment/ROM axes" requirement maps cleanly onto these fields: structure = `unilateral`, load = `loadRatio`/`fatigue`, stress = `injury.lowerBack`, equipment = `equipment`, ROM = inferable from anchor-vs-accessory role.

**The blocker is reachability, not coverage.** I grepped and confirmed:
- `coachActions.ts` does **not** import `EXERCISE_TAGS`, `exerciseFilter`, or any pool.
- `supabase/functions/coach-chat/index.ts` does **not** import any of them either — the deno edge function can't reach `src/`.

So the Coach today does substitutions purely by re-stating the pattern ladder in its system prompt. It cannot answer "is there a substitute for Bench Press that respects this athlete's caution-shoulder?" by querying the data — it can only guess.

---

## 4. Minimal next steps (smallest change that unlocks the substitution rule)

In priority order, smallest first.

**Step 1 — Build a single `getSubstituteCandidates(exerciseName, athleteContext)` helper in `src/utils/`.**
- Inputs: exercise name, optional `{ activeInjuries, availableEquipment, allowHeavier? }`.
- Internals: resolve canonical name → look up `ExerciseTag` → identify pattern + region → walk the matching `PoolSlotKey` siblings from `exercisePoolsStrength.ts` → apply `applyInjuryFilters` from `exerciseFilter.ts` → return up to N candidates ranked by load-ratio distance and `unilateral` toggle.
- This lives in app code, not the edge function. No new tags, no schema changes.

**Step 2 — Mirror the helper into the edge function as a callable tool.**
- Add a 9th coach tool, `suggest_substitutes(exercise, constraint?)`, that the edge function dispatches **back to the client** in the same way `replace_exercise` does. The client runs `getSubstituteCandidates` against the live in-memory athlete profile and returns 1–2 names to the model in the next turn.
- This keeps the edge function stateless and avoids cross-bundling `src/` into deno.

**Step 3 — Once Step 2 is shipped, soften the system-prompt ladder.**
- Replace the hard-coded ladders ("Hinge: TB DL → RDL → SL RDL → Hip Thrust → Glute Bridge") with: "When asked to swap, call `suggest_substitutes` first and pick from its return value." Keep the rule about meaningfully-different axes as a selection criterion.
- This is the win condition: the substitution rule stops being a list the prompt tries to memorise and becomes a function call grounded in the athlete's real injuries and equipment.

**Not recommended right now**
- Don't add a `spinalLoad` tag — `injury.lowerBack` covers the only real case (deadlift swap).
- Don't unify `InjuryTag` and `InjuryProfile` schemas — `INJURY_AREA_MAP` already bridges them and unification is a churn cost without a payoff.
- Don't move prehab into `EXERCISE_TAGS` — pools are the right home for that domain, and Coach can adapter over the boundary.

---

## Files referenced

- `src/data/exerciseTags.ts` (1061 lines, 100+ tagged exercises)
- `src/data/exercisePools.ts` (categories, equipment, accessory pools, prehab/mobility/recovery)
- `src/data/exercisePoolsStrength.ts` (anchor/accessory rotation, load ratios)
- `src/utils/exerciseFilter.ts` (`applyHardFilters`, `applyInjuryFilters`, `INJURY_AREA_MAP`)
- `src/utils/loadEstimation.ts` (`EXERCISE_LOAD_MAP`, equipment field, `EXERCISE_ALIASES`)
- `src/utils/coachActions.ts` — **does NOT import any of the above**
- `supabase/functions/coach-chat/index.ts` — **does NOT import any of the above**
