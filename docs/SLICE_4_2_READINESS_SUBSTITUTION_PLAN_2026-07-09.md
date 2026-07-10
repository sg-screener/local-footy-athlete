# Slice 4.2 — Readiness Tiers + Substitution-Before-Removal Plan (2026-07-09)

Read-only plan. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md` (§8 swap hierarchy + per-body-part rules, §9 fatigue/sickness/readiness + load-reduction ladder). Out of scope by instruction: deloads, progression, block/week state, conditioning components, rebuild architecture, coach chat/LLM, Coach Notes implementation (creation hooks inspected only).

**4.1 status check (verified at HEAD):** `injurySeverityBands.ts` is still unwired — only `rules/index.ts` re-export and kernel tests import it. Live thresholds remain exposureEngine 4/7, programAdjustmentEngine 5/6/7/8, readinessConstraints 5/6/7. The plan below sequences 4.2 so its first slice (readiness side) does NOT depend on 4.1, and its injury-side slices consume the bands once 4.1 lands.

## A. Plain-English problem

When an athlete says "I'm flat", "I'm sore", or reports an injury, the app censors instead of coaches. The pipeline can only keep, restrict, or **remove** exercises — there is no "reduce" and no real "swap". `visibleProgramProjection` runs three removal passes and its own design rule says "never substitutes"; when everything is stripped, `collapseEmptyVisibleWorkoutShell` turns the day into rest. "Flat today" maps to severity 7 (`readinessConstraints.ts`), which crosses the exposure engine's `>=7 ⇒ remove` line and deletes main lifts — the Bible says trim accessories and keep the main lift. The only substitution mechanism is a static name-map that includes a Bible-listed bad swap (hamstring sprint → **Hard Assault Bike Intervals** — max-effort repeat sprint stimulus, exactly what the Bible forbids). The Bible's core promise — "do as much useful work as possible", reduce before deleting, swap before resting — has no machinery.

## B. Current code gaps (verified at HEAD)

- **No 'reduce' decision.** `exposureEngine.scoreExerciseAgainstConstraints` (~:862 `maxSeverity >= 7 ⇒ 'remove'`) yields keep/restrict/remove only. Volume-reduction mechanics exist (`coachActions.ts` `lightenSession` halves `prescribedSets`; `lighten_session`/`reduce_strength_block` event types) but are reachable only from manual coach actions — never from readiness constraints.
- **Readiness severities are a hack.** flat=7, low energy=5, soreness=6/7, short-time=5/7, hardcoded in `readinessConstraints.ts:38-101`; severity numbers were chosen to trip removal thresholds, not to express Bible tiers.
- **No substitution ladder.** `REPLACEMENT_BY_BUCKET` (`injurySessionClassifier.ts:128-191`) is a static exact-name map; miss ⇒ `remove_exercise`. Everything hamstring-hinge maps to Goblet Squat regardless of context; sprint work maps to hard assault bike (bad swap). No pattern→muscle→unaffected logic despite the metadata existing.
- **Raw materials are ready but unused.** Every exercise in `exerciseTags.ts` carries `movement` (13 patterns), `region`, `load`, `fatigue`, `unilateral`, `eccentric`, and a 10-bucket `InjuryProfile` (good/caution/avoid). Nothing anywhere queries "same pattern, rated good for bucket X".
- **Collapse-to-rest is unconditional.** `shouldCollapseEmptyVisibleWorkout`/`collapseEmptyVisibleWorkoutShell` (`visibleProgramProjection.ts:~138-154`) turn any gutted session into `workout: null, source: 'rest'` regardless of whether the athlete could do safe alternate work.
- **Recovery shell too eager.** `lightenSession(level='recovery')` empties the session (`exercises: []`); programAdjustmentEngine falls back to recovery at sev ≥7 even when unaffected work exists.

## C. Proposed 4.2 model

### C1. Readiness reduction tiers (Bible §9 load-reduction ladder, lines ~2652-2710)

New kernel module `src/rules/readinessReductionTiers.ts` — data + pure classifier, mirroring `injurySeverityBands.ts` style:

| Tier | Bible triggers | Program response |
|---|---|---|
| `slight` | tired today, mild soreness, one bad sleep, 1-3/10 niggle, "session feels a bit much" | remove 1-2 accessories; keep main lift, don't push (RPE cap); swap hard finisher → easy; day stays intact |
| `moderate` | cooked, multi-night poor sleep, 4-5/10 issue, hard week | remove hard conditioning; reduce sets across session; lower-stress swaps; one hard session → recovery; keep the most important work |
| `major` | sick, very cooked, 6-7/10 issue, multiple missed sessions | remove most hard work; keep recovery/easy aerobic/unaffected training; no sprinting, hard conditioning, heavy lower |
| `pause` | bedridden, 8-10/10, severe sickness, cannot train normally | rest/recovery only; the one tier where collapse-to-rest is legal |

Signal→tier mapping replaces the severity hack: flat today ⇒ `slight` (not 7); energy low ⇒ `slight`; soreness moderate ⇒ `moderate` scoped to body part, high ⇒ `major` scoped; sick ⇒ `major`/`pause` by degree (producer arrives with 4.3 — the tier vocabulary lands now so it's ready). Injury severities map through `injurySeverityBands` once 4.1 wires them: 1-3⇒slight, 4-5⇒moderate, 6-7⇒major, 8-10⇒pause — one shared response vocabulary for both readiness and injury.

### C2. Substitution-before-removal ladder (Bible §8 swap hierarchy, lines ~1811-1826)

New helper `findSubstitute(exercise, bucket, tier)` in a new `src/utils/exerciseSubstitution.ts`:

1. **Curated Bible swaps first.** Keep `REPLACEMENT_BY_BUCKET` entries that match the Bible's good-swap lists (RDL→hip thrust, deep squat→box squat, barbell bench→DB floor press, bent-over row→chest-supported row…), corrected where wrong: hamstring sprint work → **easy bike** (Bible: "Sprinting → easy bike"; current hard-assault-bike target is a listed bad swap).
2. **Same movement pattern**, injury rating `good` for the bucket, load/fatigue ≤ original (e.g. squat-pattern knee issue ⇒ box/reduced-range squat variant tagged good-for-knee).
3. **Same region**, rating `good` (pattern not tolerated ⇒ pull-ups→chest-supported row class).
4. **Unaffected region** exercise from the day's complementary pool (shoulder issue ⇒ lower/core; hamstring ⇒ upper/core), respecting "don't overload areas already working that week" by preferring low-fatigue tags.
5. **Recovery/easy conditioning** block.
6. **Remove** — only at `pause` tier, or when 1-5 produce no candidate rated `good`.

Bad-swap guard: a substitute is invalid if its own InjuryProfile rating for the trigger bucket is not `good`, or if it reproduces the trigger exposure class (sprint→shuttle, hinge→swing, press→press-variant for shoulder).

### C3. Session rescue (no more silent rest)

In `visibleProgramProjection`, before `collapseEmptyVisibleWorkoutShell`: if a session lost ≥N exercises and the governing tier < `pause`, rebuild the remainder as safe alternate work — unaffected-region mini-session (2-3 exercises via ladder step 4) or an easy-conditioning/recovery block (step 5) — with the existing note hook reporting what happened. `workout: null` rest is reserved for `pause` tier and genuinely-empty shells.

### C4. Expected behaviour (Bible-derived examples)

- **Tired today:** Upper Push keeps bench (RPE-capped), loses last two accessories, finisher becomes easy bike/nothing. Never loses the main lift.
- **Cooked this week:** hard conditioning removed across the week, sets reduced, one hard session becomes recovery; most important strength session survives. (Week-scope producer is 4.3; the tier response is defined now.)
- **Hamstring 5/10:** RDL/deadlift → hip thrust (curated); sprint/hard running → easy bike; upper strength, core, quad-dominant tolerated lower work untouched. Session never becomes rest.
- **Knee 6/10:** deep squat → box squat; lunges → hip thrust; jumping/COD removed; running → bike/ski; upper + hip-dominant work preserved; physio advice recommended (4.1 owns the ≥6 nudge).
- **Shoulder 4/10:** barbell bench → DB floor press (same pattern); overhead → landmine; lower body, bike, core untouched.
- **Lower back 7/10:** hinge/axial loading removed, bent-over row → chest-supported row, McGill-style core kept, bike conditioning kept; session rescued as supported-upper + easy bike, not rest.
- **Sick (not bedridden):** major tier — no hard conditioning/max sprint/heavy lower; easy bike, mobility, very light strength remain.
- **General soreness (no body part):** moderate — max-effort work restricted, volume trimmed, easy aerobic kept; with body part, scoped like a mild injury.

### C5. Current code path summary (question 4)

Reduced: only via manual `lightenSession`/`lighten_session` events (halve sets) — never from constraints. Filtered: Pass 1 `applyInjuryFilterToWorkout` (tag-based), Pass 2 `applyConstraintsToSession` (exposure engine, sev≥7 remove), Pass 3 validator sweep (`Removed: <name>`), all in `visibleProgramProjection.ts:~274-319`. Deleted/rest: `collapseEmptyVisibleWorkoutShell` (workout→null) + `lightenSession(level='recovery')` empty shell + programAdjustmentEngine `set_session_recovery` (sev≥7 fallback, shell at ≥8). Coach Note: `appendCoachNote` inside `applyAdjustmentEvents.ts` event application; constraint cards derived in `activeProgramModifiers` (inspect only — not touched by 4.2).

## D. Proposed slices and files

- **4.2A — Readiness tier mapper + 'reduce' decision (first slice, no 4.1 dependency).** New `src/rules/readinessReductionTiers.ts`; rewrite `readinessConstraints.ts` signal mapping to tiers (kill flat=7); extend exposure scoring with a `reduce` decision consumed by projection (accessory trim + set reduction reusing the `lightenSession` halving mechanics, main-lift protection). Readiness signals only — injury constraint paths byte-identical.
- **4.2B — Substitution ladder (after 4.1 lands for injury-side thresholds).** `src/utils/exerciseSubstitution.ts` + curated-map cleanup in `injurySessionClassifier.ts` (incl. bad-swap fix) + wire into `injuryWorkoutFilter.ts` and `programAdjustmentEngine` replace-path so removal happens only when the ladder is exhausted.
- **4.2C — Session rescue.** Projection-level gutted-session rebuild; collapse-to-rest gated on `pause` tier; recovery-shell fallback in programAdjustmentEngine respects unaffected-work rule.
- **4.2D — Test matrix + QA scenarios.** Body-part × severity × session-type grid; readiness tier grid; QA personas with active constraints and snapshot diffs.

Files: `src/rules/readinessReductionTiers.ts` (new), `src/utils/readinessConstraints.ts`, `src/utils/exposureEngine.ts` (~:383-386, :664-703, :862, :982-995), `src/utils/visibleProgramProjection.ts` (~:102-154, :274-319), `src/utils/exerciseSubstitution.ts` (new), `src/utils/injurySessionClassifier.ts` (:128-212), `src/utils/injuryWorkoutFilter.ts` (:161-233), `src/utils/programAdjustmentEngine.ts` (:1390-1512), `src/utils/applyAdjustmentEvents.ts`, `src/utils/coachActions.ts` (:387-427 reuse), `src/data/exerciseTags.ts` (read-only source), tests as below.

## E. Tests needed

1. **Tier mapping table-driven:** each Bible trigger row (tired/mild sore/one bad sleep ⇒ slight; cooked/4-5 ⇒ moderate; sick/6-7 ⇒ major; bedridden/8-10 ⇒ pause).
2. **Flat-today contract:** main lift present and prescribed, accessories trimmed ≤2, hard finisher gone, session NOT rest, session count unchanged.
3. **Reduce decision:** slight/moderate constraints produce set reductions (floor ≥1... floor ≥2 for main lifts) and never `remove` on main-lift exercises below major tier.
4. **Ladder order:** for each bucket, a session fixture asserts step order — curated hit; else same-pattern good; else same-region; else unaffected; else recovery; removal only at pause/exhausted. Substitute's own rating must be `good` (bad-swap guard: hamstring sprint fixture must yield easy bike, never assault-bike intervals; shoulder bench must not yield another press unless rated good).
5. **Session rescue:** lower-back 7/10 on a hinge-heavy day ⇒ session survives with supported-upper/core + easy bike; knee 8/10 lower day ⇒ pause semantics — affected work paused, rest allowed; no scenario below pause yields `workout: null`.
6. **Unaffected work preserved:** shoulder constraint week ⇒ lower/bike/core sessions byte-identical; hamstring ⇒ upper sessions byte-identical.
7. **Regressions:** injury paths unchanged after 4.2A (snapshot); manual `lightenSession` unchanged; Coach Note hooks fire with accurate removal/replacement text; existing exposure-engine conservative-wins semantics preserved; full board + QA before/after week-shape diffs.

## F. Codex-ready first prompt (4.2A only)

> **Task: Slice 4.2A — readiness reduction tiers + 'reduce' decision (readiness signals only; injury paths must be byte-identical). READ `docs/LFA_PROGRAMMING_BIBLE.md` §9 "Fatigue, sickness and readiness rules" incl. the Load reduction rules ladder (~lines 2493-2710) and `docs/SLICE_4_2_READINESS_SUBSTITUTION_PLAN_2026-07-09.md` first.**
>
> 1. New kernel module `src/rules/readinessReductionTiers.ts` (style-match `injurySeverityBands.ts`): `ReductionTier = 'slight' | 'moderate' | 'major' | 'pause'`, a data table with Bible triggers + program response per tier (slight: drop 1-2 accessories, keep main lift unpushed, swap hard finisher to easy; moderate: remove hard conditioning, reduce sets across session, keep most important work; major: remove most hard work, keep recovery/easy aerobic/unaffected; pause: rest/recovery only), and a pure classifier from readiness signal fields to tier.
> 2. Rewrite the mapping in `src/utils/readinessConstraints.ts:32-104`: constraints carry `reductionTier` from the classifier; **kill the severity hack** — `flatToday` becomes tier `slight` (currently severity 7, which crosses exposureEngine's `>=7 ⇒ remove` line and deletes main lifts); `energy==='low'` ⇒ slight; soreness moderate ⇒ moderate (body-part-scoped when bucket known), high ⇒ major; short-time constraints keep current schedule semantics untouched. Keep constraint object shape backward-compatible (severity field may remain for legacy readers but must no longer drive removal for readiness-source constraints).
> 3. Teach the pipeline 'reduce': in `src/utils/exposureEngine.ts`, readiness-source constraints score to decisions `keep | reduce | remove` where slight/moderate yield `reduce` (remove only for hard-conditioning/max-effort items per tier rules) and only major/pause may `remove` main strength work. In `src/utils/visibleProgramProjection.ts`, apply `reduce`: trim the last 1-2 accessories (slight) or reduce `prescribedSets` across the session reusing the halving/floor mechanics from `coachActions.ts` `lightenSession` (moderate); NEVER remove the session's first/main lift below `major`; a readiness-adjusted session must never reach `collapseEmptyVisibleWorkoutShell`.
> 4. **Scope fences:** do NOT touch injury constraint scoring/thresholds (4/7, 5/6/7/8 stay exactly as-is — Slice 4.1 owns them), `injuryWorkoutFilter`, `injurySessionClassifier`, the replacement map, deload/progression/block-state code, conditioning components, rebuild paths, coach chat, or Coach Notes implementation (existing note hooks may fire with existing copy only).
> 5. **Tests.** New `src/__tests__/readinessTierTests.ts`: table-driven trigger→tier per the Bible ladder; flat-today contract (main lift present + prescribed, ≤2 accessories trimmed, no rest collapse, session count unchanged); moderate-tier set reduction with floors (main lift ≥2 sets); tier `reduce` never removes main lifts below major; injury-path snapshot — a week with an active injury constraint and no readiness signal is byte-identical before/after this slice; manual `lightenSession` behaviour unchanged. Run the full test board + QA before/after week-shape diff in the PR (expect diffs ONLY in scenarios with readiness signals; known pre-existing failures per roadmap — do not chase).

**Behaviour risk.** 4.2A: medium — most user-visible surface ("I'm flat" days change for every athlete), but injury paths are snapshot-fenced and the change direction is strictly less destructive. 4.2B: high (substitutions appear on cards; wrong swaps are worse than removals — mitigated by the good-rating guard and curated-first ordering). 4.2C: medium (rest days becoming work days surprises users — but that is the Bible's explicit intent).
