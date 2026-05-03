# Pool refinements — design pass

**Scope:** three refinements on top of the existing 7-slot strength pool system. Not a rewrite.

  1. Split `upper_push` / `upper_pull` into `h_push` / `v_push` / `h_pull` / `v_pull`
  2. Add `isolation_lower` pool (accessory-only)
  3. Per-athlete overrides seam (exclusion / pinning / injury bias)

---

## 1. Split upper into horizontal vs vertical

### What changes

`PoolSlotKey` gains four slots and loses two. `PATTERN_TO_SLOT` routes each tag-level sub-pattern straight to its own slot:

```
horizontal_push → h_push
vertical_push   → v_push
horizontal_pull → h_pull
vertical_pull   → v_pull
```

`EXERCISE_TAGS` already carries the sub-pattern for every upper exercise (verified by inspection — Bench Press = `horizontal_push`, Overhead Press = `vertical_push`, Pull-Ups = `vertical_pull`, Barbell Row = `horizontal_pull`). So this is purely a slot reshape, not a tag rewrite.

### Pool contents (first-pass, from current tags)

| slot     | anchor pool                                    | accessory pool                                                 |
|----------|------------------------------------------------|----------------------------------------------------------------|
| h_push   | Bench Press, Incline Bench, Close Grip Bench   | DB Bench, Incline DB Bench, Push-ups, Dips                     |
| v_push   | Overhead Press, Landmine Press                 | DB Shoulder Press, Explosive Landmine Press                    |
| h_pull   | Barbell Row, Chest Supported Row, Single-Arm DB Row | Seated Cable Row, Face Pull, Rear Delt Fly, Band Pull-Apart |
| v_pull   | Pull-Ups, Chin-Ups, Lat Pulldown               | (thin — needs new tag entries: Neutral-Grip Pulldown, Scap Pulls, Archer Pull-up) |

`v_push` and `v_pull` accessory pools are thin. Two options:
- **(a) Ship thin pools.** Rotation still works with 2 entries (alternates). Vertical pull accessory would need at least one addition.
- **(b) Add new entries to `EXERCISE_TAGS` first** to bring both sub-accessory pools to ≥3 items.

Recommendation: (b) — same pattern as the carry expansion (added Overhead Carry / Zercher Carry to tags first). Keeps rotation meaningful.

### How sub-pattern gets chosen per session

The engine emits `SessionAllocation.strengthPattern: 'push' | 'pull' | ...` — it does NOT distinguish horizontal vs vertical. Three options for who decides which sub-slot an AI-suggested "push" session lands in:

- **A. AI-driven.** Whatever the AI suggests (Bench Press → h_push, OHP → v_push) determines the sub-slot; rotation just walks within the chosen one. Pro: zero engine/builder work. Con: non-deterministic — athlete's sub-pattern coverage depends on AI consistency.
- **B. Mini-cycle alternation in the rotation layer.** `rotationContext` carries a rule: odd mc → h_push, even mc → v_push (same for pull). `applyPoolRotation` ignores the AI's sub-pattern choice and picks from the mc-active sub-slot. Pro: deterministic, mirrors "anchor stable within block" philosophy, each sub-pattern gets a full 3–4 week exposure. Con: forces the sub-pattern behind the AI's back.
- **C. Engine-level split.** Extend `strengthPattern` to include `horizontal_push | vertical_push | horizontal_pull | vertical_pull`. Engine planner assigns sub-pattern at placement time. Pro: cleanest semantically. Con: touches the engine — bigger blast radius, invariants need updating.

Recommendation: **B with a classify-time guard.** The guard: if the AI's suggestion classifies to the *other* sub-slot (e.g., AI said Overhead Press but mc says h_push turn), we respect the AI's sub-pattern choice for THIS specific exercise (still rewrite within v_push pool), BUT the anchor slot of the session still tracks the mc-active sub-slot for cross-session-within-week consistency.

Simpler refinement: in the first pass, ship **A** (split only, no forced alternation). This delivers the biomechanical accuracy benefit — Pull-Ups will never rotate to Barbell Row again, OHP will never rotate to Bench Press. We can add B later if empirical observation shows sub-pattern drift. This minimises blast radius on the first refinement pass.

### Progression transfer

Today `normalizeLoadAcrossSiblings` transfers load within a (slot, role). Splitting the slots means Bench Press (h_push) → Overhead Press (v_push) **stops transferring load**. This is correct — these are genuinely different movements and their 1RM ratios don't track cleanly. The h_push internal transfers (Bench → Incline Bench) still work. Same for the pull side.

Implication: no code change needed in `normalizeLoadAcrossSiblings` — slot-boundary check already blocks cross-slot transfer. Just document the loss-of-transfer as intentional.

### Volume integrity

Engine still emits one `push` exposure and one `pull` exposure per week in the current cadence. Splitting does not create extra sessions — the `push` allocation consumes one of either h_push or v_push, same count. Verified: the `coachingEngine` never counts sub-patterns, only `push` / `pull`. No volume change.

### Tests

Existing tests:
- `npm run test:pools` — will need classification assertions for each sub-slot, and the sub-slot rotation contract.
- `npm run test:variation` — `SLOTS` array needs to replace `upper_push/upper_pull` with four sub-slots. `BLOCKS = MAX_ANCHOR_POOL` still holds; pool-size-aware assertions already account for variable pool lengths.
- New: cross-sub-pattern-no-transfer assertion (Bench Press → OHP returns input load unchanged).

---

## 2. Add `isolation_lower` pool

### What changes

- `MovementPattern` gains `isolation_lower` (currently only `isolation_upper` exists).
- `EXERCISE_TAGS` gains entries for: Leg Curl, Nordic Curl, Leg Extension, Calf Raise, Tib Raise, Adductor Machine.
- `PoolSlotKey` gains `isolation_lower`.
- `PATTERN_TO_SLOT[isolation_lower] = 'isolation_lower'`.
- `STRENGTH_POOLS.isolation_lower` added — **accessory-only** (respecting Sam's directive).

### Accessory-only shape

To keep the existing `anchor + accessory` shape intact without inventing load-bearing anchors here:

- `anchor` pool is **empty** (`entries: []`).
- All six items live in `accessory`.
- `selectPoolEntry` already throws on empty pools — we never hit it for isolation_lower because:
  - `classifyPoolSlot` for an isolation_lower exercise returns `role='accessory'` (via `findPoolEntry` on the populated accessory pool).
  - The tag-heuristic fallback already needs a guard: when `movement === 'isolation_lower'` or `isolation_upper`, force `role='accessory'` regardless of load tag. (Adds a small branch to `classifyPoolSlot` — low risk.)

This contains the change inside the existing pool system. No type/shape changes to `PoolDefinition`.

### Load ratios

All entries set `loadRatio: 0` by convention for "no meaningful progression transfer" — mirrors the plyo slot. `normalizeLoadAcrossSiblings` already returns input unchanged when either ratio is 0 (the bodyweight guard). So cross-entry "progression" in isolation_lower is a no-op by design. This matches Sam's intent: rehab/prehab/tissue work, not load progression.

### Injury hooks

`EXERCISE_TAGS[name].injury` already carries per-region caution ratings. Nordic Curl should be `hamstring: 'caution'` until rehab complete; Tib Raise is `ankle: 'good'` and sits well for shin-splint prehab; Adductor Machine gets `adductor: 'caution'` when acute. These tags become actionable once refinement 3 (overrides seam) lands — the isolation_lower pool is where they'll matter most.

### Tests

- Classification assertions in `exercisePoolsStrengthTests.ts` (all six items → isolation_lower/accessory).
- Rotation walks the full pool over N mini-cycles (N = 6).
- Integration: AI suggests "Leg Curl" + "Nordic Curl" in same session → within-session avoidance gives distinct picks.
- `test:variation`: isolation_lower added to `SLOTS`. Since anchor is empty, the persona harness needs a branch: skip anchor assertions for slots where anchor pool is empty.

---

## 3. Per-athlete overrides seam

### Data model

Add to `UserProfile` (or a sibling `AthletePreferences` table keyed by userId — preference is separate since these mutate more often than profile basics):

```ts
interface AthletePoolPrefs {
  /** Exercises the athlete never wants to see. Hard exclude. */
  excluded: readonly string[];
  /** Exercises the athlete prefers — bias rotation to pick them when the slot comes up. */
  pinned: readonly string[];
  /** Active injuries drive injury-tag filtering. Existing `UserProfile.injuryHistory` already has the keys. */
  activeInjuries?: readonly InjuryKey[];  // e.g. ['adductor', 'knee']
}
```

`activeInjuries` reuses the `InjuryProfile` keys from `exerciseTags.ts`. `injuryHistory` is historical; `activeInjuries` is the "currently avoiding" list — separate field because a 2022 adductor strain shouldn't permanently block everything.

### Filter semantics

Overrides fold into the rotation pipeline as a **filter layer** inside `applyPoolRotation` / `selectPoolEntryAvoiding`. Specifically:

```
Pool entries
   ↓ filter-out: name ∈ excluded
   ↓ filter-out: EXERCISE_TAGS[name].injury[injKey] ∈ {'avoid'} for any injKey in activeInjuries
   ↓ deprioritize: EXERCISE_TAGS[name].injury[injKey] === 'caution' (sorted after 'good')
   ↓ bias: entries ∈ pinned float to rotation-start position (first pick wins)
   ↓ rotation walk (existing logic: mc index + within-session avoidance)
```

Concretely: extend `selectPoolEntryAvoiding(pool, ctx, avoid, prefs?)` with an optional prefs argument. When unset, behavior is identical to today (all tests pass unchanged). When set, the effective pool is `pool.entries.filter(prefsFilter).sort(prefsBias)`, and the rotation walks that.

### Empty-pool fallback

If overrides filter the pool to zero entries (athlete excluded everything), we have three options:
1. **Fail loud.** Throw — forces correction upstream.
2. **Ignore overrides for this call.** Log a warning, rotate over the raw pool.
3. **Graceful downgrade.** Filter only with excluded + avoid (skip injury filter); if still empty, skip excluded (keep injury filter); if still empty, fall through to raw rotation.

Recommendation: **2** — log and proceed. Matches the "overrides are bias, not a second system" principle. `3` is over-engineered for now.

### Plumbing

- Add optional 6th arg to `buildWorkoutsFromCoach(coachWorkouts, microcycleId, weeklyPlan?, onboardingData?, rotationContext?, athletePrefs?)`.
- Call sites (`generateProgram.ts`, `CoachScreen.tsx`) derive `athletePrefs` from `UserProfile` / `AthletePreferences` and pass through.
- `applyPoolRotation` signature gains optional `prefs?: AthletePoolPrefs` and threads it into `selectPoolEntryAvoiding`.

### Determinism

Filter + bias are both deterministic given the same inputs. Pinned bias uses a stable sort keyed on original pool index so rotation order is preserved inside the pinned / non-pinned partitions. No randomness introduced.

### Progression continuity

Exclusions change the effective pool for anchor rotation too. If mc=1's anchor would have been Back Squat but it's excluded, mc=1 rotates to Front Squat (next in pool). That's correct — progression transfer via `loadRatio` still lands on a sensible exercise. No test regression expected; but **existing variation-persona tests that hard-code "mc=1 squat anchor is Back Squat" would need to be re-phrased** when tests run with non-empty prefs. Easy: default persona tests pass `prefs={}` implicitly, new prefs-aware tests assert override behavior.

### Tests

- Unit: `selectPoolEntryAvoiding` with prefs — exclusion, pinning, injury-avoid, injury-caution-deprioritize.
- Unit: empty-after-filter → falls through cleanly.
- Integration: `buildWorkoutsFromCoach` with prefs → athlete's excluded exercise never appears in output; pinned exercise gets first pick; injury-avoid exercise filtered.

---

## Hidden risks and ambiguity

### Cross-cutting
- **`findOrCreateExercise` guard extends to new names.** When we add Nordic Curl / Neutral-Grip Pulldown etc. to tags, `findOrCreateExercise` exact-match logic (per `project_findorcreate_pool_guard.md`) must handle them. New pool-managed names need the guard — one memo already documents the pattern.
- **.tmp-compiled / .qa-compiled directories** have stale .js siblings per `reference_stale_js_gotcha.md` — sucrase-node should be fine, but Metro bundler for the app may shadow. Delete .tmp-compiled/.qa-compiled if app-level stale behavior shows up.

### Refinement 1 (upper split)
- **Sub-pattern volume ratio.** If we ship Option A (AI-driven sub-pattern), an AI that always picks Bench Press means v_push never fires. Flag for empirical watch post-ship; add Option B (mc alternation) if observed.
- **Test rewrites.** `variedProgramPersonaTests.ts` hardcodes `upper_push` and `upper_pull`. Needs update to 4 slots + pool-size-aware assertions (which it already does).
- **DB Shoulder Press was in `upper_push` accessory.** Today it's classified as `upper_push/accessory`. After split it moves to `v_push/accessory`. Any code that expects DB Shoulder Press in upper_push will silently re-classify. Search for hard-coded references.

### Refinement 2 (isolation_lower)
- **Empty anchor pool edge cases.** `findPoolEntry` and `classifyPoolSlot` both tolerate empty pools by construction, BUT the tag-heuristic fallback currently returns `role='anchor'` for `load='moderate'` items. Nordic Curl is `load='moderate'` → would fall back to anchor for a slot with no anchor pool. Need the `movement === 'isolation_*' → force accessory` guard before the load heuristic fires.
- **AI rarely suggests these exercises today.** The rotation layer is a rewriter; it doesn't inject exercises the AI didn't suggest. If AI prompts never list Nordic Curl, the pool is dead weight. Need to check generate-program prompts to see if isolation_lower is actually suggestable, and update the system prompt if not.
- **`isolation_lower` is NOT a strength exposure.** `coachingEngine.strengthPattern` does not include it. No invariant counts it. Confirmed safe — won't inflate exposure counts.

### Refinement 3 (overrides)
- **Where `AthletePoolPrefs` lives.** Profile vs. a separate preferences store. Separate is cleaner (mutates more often, cleaner audit log) but doubles the write surface. Profile is simpler to start. Lean separate for long-term, but this is a coach's call.
- **Injury model drift.** `UserProfile.injuryHistory: string[]` is free-text today. To filter by injury we need typed keys (`InjuryKey` matching `InjuryProfile` fields). The new `activeInjuries` field does that; `injuryHistory` stays as free-text history.
- **Who edits prefs UX.** Out of scope — architecture supports it but UX is deferred.
- **Excluded + pinned conflict.** If an exercise appears in both, exclusion wins (log warning).

### Ambiguity to resolve with Sam

1. **Sub-pattern alternation rule.** Option A (AI-driven), B (mc alternation), or C (engine-level)? I'm recommending A first for minimal blast radius, but the "athlete progression coverage" question is coach-philosophy.
2. **Where prefs live.** Embedded in `UserProfile` or separate `AthletePreferences`?
3. **Thin v_push / v_pull accessories.** Ship thin (≥2 entries each) or pad with new tag entries first?

---

## Recommended implementation order

1. **Isolation_lower (smallest blast radius)** — purely additive. No existing code paths change. Validates the "accessory-only slot" shape and the tag-heuristic accessory guard. Ship + test before touching upper split.

2. **Upper split (medium, contained)** — touches `PoolSlotKey` / `PATTERN_TO_SLOT` / pool definitions / test files. No engine changes if we pick Option A. Progression transfer automatically narrows to within-sub-slot (correct). Sub-pattern coverage becomes observable post-ship; we can iterate.

3. **Overrides seam (largest, last)** — adds a new parameter threading through the builder pipeline. Lands cleanly on top of a stable 8-slot pool system (4 base + carry + 2 iso + plyo). Starts with the minimal surface: data model + filter logic + tests. UX later.

Each step ends with `npm run test:pools && npm run test:variation && npm run test:conditioning-rotation && npm run qa:athlete` green. No step breaks the previous one's contract.

---

## Non-goals (for this phase)

- Rewriting the conditioning rotation layer. Option B just shipped; it's load-bearing.
- Engine-level split of `strengthPattern` into sub-patterns (deferred — needs coach input first).
- Athlete-facing UX for editing preferences (deferred — architecture only).
- Pool-system composability across regions (e.g., "legs day" as a composite) — different problem.
