# Injury/Readiness Generation Modifiers — Audit (2026-07-09)

Read-only investigation. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md` (§8 injury rules, §9 fatigue/sickness/readiness rules). Aligned with `docs/BIBLE_IMPLEMENTATION_ROADMAP_2026-07-09.md` (row F, Slices 4.1–4.3) — this audit verifies the roadmap against live code and sharpens the first slice. No overlap with Codex's Slice 3.1 (block/week state).

## A. Plain-English diagnosis

The app understands injuries well at the chat layer but acts on them through five parallel, disagreeing severity systems, none of which is the Bible's 1-3/4-5/6-7/8-10 ladder. The canonical bands exist in `src/rules/injurySeverityBands.ts` but are explicitly unwired ("Phase 1 rules kernel — NOT YET WIRED"). The most user-visible symptoms: severity 1–4 injuries do nothing at all ("no program change required" gate at <5, conflicting with Bible 1-3 avoid-trigger and 4-5 reduce), "flat today" maps to severity 7 which nukes main lifts (Bible says trim accessories, keep the main lift), and neither injuries nor readiness ever re-enter generation — everything is post-hoc censorship of an already-built week. Readiness is today-only, local-only, and half the Bible §9 rules (sick, bedridden, poor sleep, weekly cooked) have no producer at all. Coach Notes are architecturally sound (derived from the same constraint state that changes the program — no note/program divergence risk), though a zero-diff readiness card can show.

## B. Files involved

- `src/rules/injurySeverityBands.ts` — canonical Bible bands, defined but unwired
- `src/utils/programAdjustmentEngine.ts` — thresholds 5/6/7/8; severity gate at line 1340; tier flags at 1400–1403
- `src/utils/exposureEngine.ts:383-387` — tiers 4/7 (also 641-642, 858-870, rebuild-vs-modify at 930)
- `src/utils/injuryProgression.ts:35-41` — tiers 0/2/4/6/7+
- `src/utils/injuryWorkoutFilter.ts:215` — remove 'caution' at ≥6 (resolver-level filter)
- `src/utils/trainAroundEngine.ts:73-77` — tiers 4/7; orphaned (964 lines, roadmap 5.2 deletion candidate)
- `src/utils/readinessConstraints.ts:38-101` — flat=sev 7, soreness=6/7, short-time=5/7, hard-scoped to today
- `src/utils/coachReadinessAdapter.ts` — chat parse of tired/sore/flat/short-time
- `src/utils/coachConstraintProducers.ts` — fatigue/soreness/busy-week producers
- `src/utils/activeProgramModifiers.ts` — Coach Note derivation from constraints (single truth source)
- `src/utils/visibleProgramProjection.ts:102-154` — projection-time constraint filter
- `src/utils/injurySessionClassifier.ts:137-140` — Bible-listed bad swap (hamstring sprint → hard assault bike)
- `src/utils/sessionResolver.ts:114-133` — feeds activeInjury into resolver filter
- `src/data/exerciseTags.ts` — per-body-part good/caution/avoid injury profiles (80+ exercises)
- `src/utils/guidedInjuryControl.ts:74-109` — guided flow tiers; hip→lowerBack mis-bucket
- `supabase/functions/generate-program/index.ts:228-256` — dead hardcoded injuryRestrictions map; generation never reads active injury/readiness state
- `coachingEngine.ts:1282` — `readinessOverride` parameter, producer-less
- `src/utils/planChangeProducer.ts:141-152` — `shutdown_week` plan change exists but unreachable from "I'm sick"
- Stores: `src/store/coachUpdatesStore.ts` (`activeInjury`, `activeConstraints`), `readinessStore.ts` (`signalsByDate`, pruned daily, local-only)

## C. Root causes

1. **Severity ownership never consolidated.** Each engine generation (trainAround → exposure → programAdjustment → injuryWorkoutFilter) added its own thresholds; the Bible bands arrived last and were parked unwired (approved decision 2026-07-08: "Bible bands win long-term").
2. **Injuries/readiness are post-generation filters, not generation inputs.** Generation reads only static onboarding text; `readinessOverride` exists in the engine signature but nothing produces it.
3. **Removal-first adjustment.** Projection removes tagged exercises with no substitution ladder (the Bible's pattern→muscle→unaffected hierarchy is doc-only), so heavy filtering guts sessions toward rest.
4. **Readiness modeled as a single-day ephemeral signal** (Zustand/AsyncStorage, pruned daily) — no week-scope concept, so "cooked this week" cannot exist deterministically.

## D/E. Bible vs code

| Bible rule | Code today | Verdict |
|---|---|---|
| 1-3/10: keep most work, avoid exact trigger | `severity < 5` → "no program change required" (`programAdjustmentEngine.ts:1340`) | **Conflict** |
| 4-5/10: reduce affected work | 4 = nothing; 5 = remove 'avoid'-tagged exercises (removal, not reduction) | **Conflict** |
| 6-7/10: remove risky work + recommend advice | remove 'caution' at ≥6 ✓; physio nudge at ≥7 not ≥6; guided-flow 6-7 behaves like 8-10 | Partial |
| 8-10/10: pause affected training | recovery shell at ≥8 when ≥50% of session risky ✓ | Mostly OK |
| Swap hierarchy pattern→muscle→unaffected→recovery→pause | Removal only; one bad swap codified (hamstring sprint→hard assault bike) | **Conflict** |
| Work-around: keep unaffected work | Tag profiles preserve unaffected exercises ✓; gutted sessions collapse to rest instead of alternate work | Partial |
| Tired today: reduce slightly, keep main lift | flat = severity 7 → blocks max-effort lifts + hard conditioning | **Conflict (too aggressive)** |
| Cooked this week: reduce whole week | LLM-intent path only; no deterministic weekly producer; readiness constraints today-only | Missing |
| Sick / bedridden | No signal, no route (`shutdown_week` exists, unreachable) | Missing |
| Sore by site/severity | Body-part clarify → bucketed constraint, sev 6/7 | OK |
| Poor sleep | Nothing | Missing |
| Busy week / away | Intent + plan change / profile availability | OK / Partial |
| Coach Note only when program actually changes | Notes derived from same constraint state ✓; zero-diff readiness card can show | Mostly OK |
| Injury changes → rebuild (re-enter generation) | Never; generation reads onboarding text only; edge-function restriction map is dead legacy | Missing |

## Gap classification

- **A. Implemented well:** exercise tag profiles (`exerciseTags.ts`), sore-by-site chat flow, Coach Notes single-source derivation, recovery shell at ≥8, "never touch recovery sessions".
- **B. Implemented but not connected:** `injurySeverityBands.ts` (canonical, unwired); `readinessOverride` (no producer); `shutdown_week` plan change (unreachable); volume-reduction mechanics exist in commit path but unreachable from readiness.
- **C. Duplicated/inconsistent:** five threshold systems (bands vs 4/7 vs 0/2/4/6/7+ vs 5/6/7/8 vs filter ≥6); physio advice at ≥7 vs Bible ≥6; hip→lowerBack mis-bucket.
- **D. Missing:** sick, bedridden, poor sleep, deterministic weekly-cooked; substitution-before-removal; readiness/injury into generation.
- **E. Bible conflict:** <5 no-op gate; flat=sev 7; hamstring→hard-assault-bike swap; gutted session→rest.
- **F. Good enough for MVP:** busy week, away/holiday, missed-session handling, injury reintroduction tap flow.

## F. Recommended slice order (aligned with roadmap P4)

1. **4.1 Severity normalization** — wire `injurySeverityBands` as the single classifier into all five consumers; fix physio-at-≥6, guided-flow 6-7, hip mis-bucket, <5 no-op gate (1-3 = avoid trigger, 4 = reduce). Owner: Fable design/verification, Codex mechanical wiring. Risk: high but contained by band-by-band tests. Tests: per-band snapshot of engine actions per body bucket; regression that 4/10 produces a reduce event and 2/10 an avoid-trigger swap, never a no-op reply.
2. **4.2 Readiness tiers + substitution before removal** — Bible §9 slight/moderate/major/pause ladder; flat keeps main lift; projection substitutes pattern→muscle→unaffected before removing; gutted session → safe alternate work, not rest; fix bad swap. Owner: Fable design + Codex sub-parts. Risk: high (most visible surface). Tests: ladder-tier snapshots; "flat today" keeps main lift; no session resolves to rest while safe alternates exist.
3. **4.3 Re-enter generation** — real producers for `readinessOverride` (weekly readiness card, recovery mode, sick/bedridden routes to `shutdown_week`). Blocked by 4.2. Owner: Fable. Risk: medium. Tests: rebuild designs around constraint instead of censoring after.
4. **5.3 Coach Note alignment** — zero-diff card suppression, truth-gated copy. Owner: Codex. Risk: low.
5. **5.2 Cleanup** — delete orphaned `trainAroundEngine.ts` / unimported `rulesEngine.ts` / superseded `injuryAdjustmentEngine` pipeline so thresholds cannot re-diverge. Owner: Codex. Risk: low.

No overlap with Slice 3.1: block/week state, deloads, progression, and conditioning components are untouched by 4.1 (roadmap constraint line 173 reserves live-threshold changes exclusively to 4.1).

## G. Next slice + Codex-ready prompt

**Next slice: 4.1 severity normalization.** Prerequisite for 4.2/4.3 (one severity truth), mechanically scoped, fixes two live Bible conflicts (sub-5 no-op, late physio advice) without touching Codex's block/week territory.

> Slice 4.1 — one injury severity system. Read `docs/LFA_PROGRAMMING_BIBLE.md` §8 severity rules and `docs/BIBLE_IMPLEMENTATION_ROADMAP_2026-07-09.md` Slice 4.1 first. Make `src/rules/injurySeverityBands.ts` (`classifyBibleInjurySeverity`) the ONLY severity classifier. Migrate consumers: `exposureEngine.ts:383-387` (and tier uses at 641-642, 858-870), `injuryProgression.ts:35-41`, `programAdjustmentEngine.ts` (gate at 1340 and flags at 1400-1403), `constraintPlan.ts`, `injuryWorkoutFilter.ts:215`, `guidedInjuryControl.ts:74-109` (also fix the hip→lowerBack mis-bucket). Behaviour targets: 1-3 = avoid exact trigger only (small swaps, no no-op reply); 4-5 = reduce affected work (remove 'avoid'-tagged, keep safe work); 6-7 = also remove 'caution'-tagged + recommendPhysio (nudge moves from ≥7 to ≥6; guided-flow 6-7 must stop behaving like 8-10); 8-10 = pause affected area (recovery shell rules unchanged). Do NOT change: block/week state, progression, deloads, conditioning component model, coach chat/LLM prompts, Coach Notes implementation, readiness constraints (`readinessConstraints.ts` severities are Slice 4.2), or the substitution ladder (also 4.2). Do not delete `trainAroundEngine.ts` (Slice 5.2). Add band-by-band tests: for each body bucket × severity 2/4/6/9, snapshot the emitted adjustment events and reply class; regressions proving 4/10 produces a reduce action (not "no program change") and physio advice first appears at 6. Full test board + QA week-shape diff before/after in the PR, per repo AGENTS.md.

Flag: the roadmap marks 4.1 owner as **Fable** (live behaviour change for every injured athlete, needs Simulator verification matrix with Metro restart). The prompt hands Codex the mechanical wiring; keep final live verification with Fable.
