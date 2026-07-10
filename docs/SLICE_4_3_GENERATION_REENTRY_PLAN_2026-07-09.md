# Slice 4.3 — Injury/Readiness Re-enter Generation Plan (2026-07-09)

Read-only plan. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md`. **Prerequisites by design: Slices 4.1 and 4.2.** 4.1 provides the single severity system (1-3 mild / 4-5 moderate / 6-7 limiting / 8-10 pause via `injurySeverityBands.ts`); 4.2 provides the adjustment vocabulary (ReductionTier slight/moderate/major/pause) and the substitution-before-removal model. **4.3 invents no new injury/readiness rules — it defines how generation consumes 4.1/4.2 outputs.** Out of scope by instruction: block/week state, deloads, progression, conditioning components, rebuild architecture (data is threaded through the existing rebuild path, no structural change), Coach Notes implementation, coach chat/LLM.

## A. Plain-English problem

The app builds a "healthy athlete" week first and censors it afterwards. Generation (`buildCoachingPlan`) sees only static onboarding data — `CoachingInputs.injuries` comes from the profile, never from the live injury store, and no readiness state reaches it at all (the one knob, `readinessOverride`, is dead code behind an `(inputs as any)` cast with no producer). Every live constraint is applied at render time by the projection, which can only trim what generation already created. So a hamstring athlete gets a week with RDLs, sprint slots and running conditioning generated in, then watches 4.2 swap/remove them — instead of a week that was designed around the hamstring from the start: upper strength kept whole, safe lower alternatives selected into the plan, bike replacing running at the placement step, sprint slots never allocated. The Bible's rebuild rule is explicit: "Injury changes what sessions/exercises are allowed" requires the week to be rebuilt around the constraint, not shaved after the fact.

## B. Current code gaps (verified at HEAD, commit "Add calendar deload week generation")

- `readinessOverride` is producer-less dead code: single usage `if ((inputs as any).readinessOverride === 'low' || core <= 2) condTarget = Math.max(3, condTarget - 1)` (`coachingEngine.ts:1289`); not in the `CoachingInputs` interface (:35-57); grep finds no setter.
- `CoachingInputs.injuries: OnboardingInjury[]` — onboarding only. `onboardingToCoachingInputs()` (:5686+) reads the profile, never `coachUpdatesStore.activeInjury`/`activeConstraints` or `readinessStore`.
- `weekRebuild.ts:300-312` already reads `activeConstraints` from the store — but only to compute `liveConstraintIds` for the override sweep; it never passes them to `generateProgramLocally()` (`generateProgram.ts:154-162`, profile-only signature).
- Build-time exercise filtering exists and works (`sessionBuilder.applyHardFilters` → `exerciseFilter.passesInjuryFilter`, checking good/caution/avoid per bucket) — but it is fed from **profile injuries**, so an injury reported through coach chat last week filters nothing at the next rebuild.
- Off-feet modality is structural only (`coachingEngine.ts:~3474` "Lower-body S+C always prefers off-feet") — no injury input; an upper-limb injury doesn't steer away from ski/row (Bible ~:1214 says it should).
- Session-type allocation (:788-1120) has zero constraint modulation.
- What already exists and must be reused, not duplicated: `shutdown_week` plan change IS routed at HEAD (bedridden path via `PlanChangeSheet.tsx:588` "I'm not 100%" → confirm_shutdown, clears non-game days); a weekly "Not 100% this week / Recovery mode this week" card renders on `HomeScreenV2` but is **display-only** — it never feeds generation.

## C. Proposed 4.3 model

### C1. One typed context, assembled once

New `GenerationConstraintContext`, built by a single pure assembler at the existing generation entry points (threaded `weekRebuild` → `generateProgramLocally` → `onboardingToCoachingInputs` → `buildCoachingPlan`; no new rebuild machinery):

- `injury?: { bucket: InjuryBucket; band: BibleInjurySeverityBand; region: 'lower' | 'upper' | 'core' }` — from `coachUpdatesStore.activeInjury` classified by **4.1's** `classifyBibleInjurySeverity`. Never a raw severity number: generation speaks bands only.
- `weekReadinessTier?: ReductionTier` — **4.2's** tier vocabulary at week scope, from week-scope constraints (recovery mode, cooked-this-week, sick) — NOT from daily signals.
- `sourceConstraintIds: string[]` — so the override sweep and any later diffing know what the plan was built around.

This kills `readinessOverride`: the dead knob is replaced by the typed field, and its one behaviour (condTarget reduction) becomes a tier rule.

### C2. How bands enter generation (injury)

Generation consumes the band at four existing knobs, applying 4.1's semantics *before* anything is built:

- **Pool pre-filtering (the big one).** Feed the already-working `passesInjuryFilter` from the active injury instead of profile-only: band 1-3 ⇒ exclude only `avoid`-rated exercises for the bucket (avoid the exact trigger, keep most work); 4-5 ⇒ exclude `avoid`, deprioritize `caution` (selection prefers `good`); 6-7 ⇒ exclude `avoid` + `caution` through the area; 8-10 ⇒ exclude the affected region's loading entirely. Because selection now happens among safe candidates, sessions are **born full** — 4.2's ladder becomes the mid-week safety net, not the primary mechanism.
- **Conditioning category/modality eligibility.** Lower-limb bucket at 4-5+ ⇒ running-based categories denied at the placement picker with a typed reason (existing downgrade-ladder mechanics, new deny reason), `conditioningOffFeet` forced true; upper-limb bucket ⇒ erg modality restricted to bike (no ski/row per Bible ~:1214); 6-7 ⇒ no hard conditioning through the area at all.
- **Sprint eligibility.** Existing readiness gate extended with the band: lower-limb bucket ≥4-5 ⇒ sprint slots never allocated (Bible §7 injury rule), rather than allocated-then-denied-then-collapsed.
- **Session-type biasing.** Band 6-7: swap allocation toward unaffected work — lower-limb limiting ⇒ second lower day becomes upper/core + off-feet conditioning; shoulder limiting ⇒ press-day becomes lower/pull-tolerated day; 8-10 ⇒ affected-region days become recovery/unaffected only. Bible per-body-part "usually okay" lists (§8) define the bias targets; the data is 4.1's, the response shape is 4.2's — 4.3 only reorders what generation allocates.

### C3. How readiness tiers enter generation (week scope)

`weekReadinessTier` turns existing week-shape dials, mapped 1:1 from 4.2's tier table — no new reduction rules:

- `slight` ⇒ no generation change (daily/slight is 4.2's projection job).
- `moderate` (cooked this week) ⇒ hard-exposure target −1, hard conditioning categories excluded from placement, conditioning target −1 (the resurrected condTarget rule), most important strength session kept.
- `major` (sick, very cooked) ⇒ hard work not allocated at all: strength days generated as light/technique or unaffected work, conditioning easy-only, extra recovery day; sessions marked optional-tier.
- `pause` (bedridden) ⇒ don't generate: route to the existing `shutdown_week` plan change (already live) — generation only needs to not resurrect cleared days on rebuild.

### C4. What generation must never create (the reconciliation invariant)

The acceptance rule that keeps 4.2 and 4.3 honest: **a freshly generated week, projected through 4.2 with the same constraints, must produce zero removals and zero substitutions.** If projection would change it, generation built the wrong week. This is testable and becomes the permanent contract between the two layers.

### C5. Boundaries: pre-generation vs post-processing

**Moves into generation (week-scope truths):** active injury (bucket + band), recovery mode / cooked-this-week, sick, weekly "not 100%" state, shutdown handling. These are known at rebuild time and shape structure.

**Stays post-processing (4.2, day-scope truths):** tired today, flat, daily soreness, one bad sleep, short time today, mid-week injury reports/updates between rebuilds (projection adjusts immediately; the next rebuild through the existing canonical door then bakes it in), manual overrides. Regenerating the week because of a daily mood would churn the program and violate the Bible's "mild tiredness reduces today only".

**Producers (question 4 status):** active injury — exists (`activeInjury` store), needs only the assembler; bedridden — exists (`shutdown_week`, routed); weekly not-100% card — exists but display-only, becomes a producer of `weekReadinessTier` (its "Recovery mode this week" state maps to major); cooked-this-week — missing deterministic producer (currently LLM-intent only) — added as a card/tap flow writing a week-scope constraint; sick (non-bedridden) — missing, same mechanism, tier major; poor sleep — day-scope, stays 4.2, no producer needed here.

## D. Files likely affected

`src/utils/coachingEngine.ts` (CoachingInputs :35-57, condTarget :1289, sprint/conditioning eligibility, allocation :788-1120, modality :~3474), `src/services/api/generateProgram.ts` (:154-162 signature threading), `src/utils/weekRebuild.ts` (:300-312 — already holds the constraints; passes context through the existing path), new `src/utils/generationConstraintContext.ts` (assembler; consumes `injurySeverityBands` + `readinessReductionTiers`), `src/utils/sessionBuilder.ts` (:504-520 pool filtering fed from context), `src/utils/exerciseFilter.ts` (:150-195 band-aware ratings), `src/utils/coachProgramEdit.ts` (:1940 second generation call site), `src/utils/planChangeProducer.ts` (shutdown reuse, sick route), `src/utils/tapProgramModifiers.ts` / weekly card producer (`useHomeScreen.ts` state → constraint), tests below. Coach Notes, rebuild internals, block state, deload resolver: untouched.

## E. Tests needed

1. **Reconciliation invariant (the headline test):** for each scenario (hamstring 4/10, knee 6/10, shoulder 5/10, lower back 7/10, cooked week, sick week) — generate with context, project with the same constraints ⇒ zero removals, zero substitutions, zero session collapses.
2. **Born-safe weeks:** hamstring 4-5 ⇒ generated week contains no RDL/deadlift/Nordic/sprint slots, upper sessions identical to no-injury baseline, conditioning off-feet; shoulder ⇒ lower days byte-identical to baseline, no painful press pattern selected, bike-only ergs; knee 6-7 ⇒ no jump/COD/deep-knee work generated, hip-dominant + upper preserved.
3. **Tier week shapes:** moderate ⇒ hard-exposure target −1, no hard conditioning placed, key strength session present; major ⇒ no hard work allocated, ≥1 recovery day added, all sessions optional-tier; pause ⇒ rebuild does not resurrect shutdown-cleared days.
4. **No-constraint regression:** empty context ⇒ generation byte-identical to pre-slice snapshots (QA board).
5. **Band boundaries:** 3→4 and 5→6 transitions change pool filtering exactly per 4.1 semantics (no thresholds redefined locally — import assertions that 4.3 contains no numeric severity literals).
6. **Producer tests:** weekly card recovery-mode state produces a week-scope major constraint consumed at next rebuild; sick flow writes tier correctly; bedridden path unchanged (regression on existing shutdown_week tests).
7. **Boundary tests:** daily flat signal does NOT trigger regeneration or enter the context; mid-week injury report adjusts via projection only until a rebuild occurs.

## F. Codex-ready first prompt (4.3A only)

> **Task: Slice 4.3A — typed GenerationConstraintContext + week-tier consumption (no injury pool changes yet). READ `docs/LFA_PROGRAMMING_BIBLE.md` §9 (~2493-2710) and `docs/SLICE_4_3_GENERATION_REENTRY_PLAN_2026-07-09.md` first. PRECONDITIONS (abort if false): `src/rules/injurySeverityBands.ts` is wired as the single injury severity source (Slice 4.1) and `src/rules/readinessReductionTiers.ts` exists with the ReductionTier vocabulary (Slice 4.2A).**
>
> 1. New `src/utils/generationConstraintContext.ts`: pure assembler `buildGenerationConstraintContext({ activeInjury, activeConstraints, todayISO })` returning `{ injury?: { bucket, band, region }, weekReadinessTier?: ReductionTier, sourceConstraintIds: string[] }`. Injury band comes ONLY from `classifyBibleInjurySeverity`; week tier ONLY from week-scope constraints (recovery-mode / schedule-scope fatigue constraints with `expiresAt` beyond today; daily readiness signals are explicitly excluded — assert this in tests). No numeric severity literals anywhere in the new module.
> 2. Thread it through the existing path with no structural change: `weekRebuild.ts` (~:300-312, the constraints are already read there) builds the context and passes it to `generateProgramLocally(onboardingData, { constraintContext })` → `onboardingToCoachingInputs` → typed optional field on `CoachingInputs`. Also thread the second call site (`coachProgramEdit.ts:~1940`). Delete the dead `(inputs as any).readinessOverride` cast (`coachingEngine.ts:~1289`) and replace its condTarget rule with tier logic.
> 3. Consume ONLY the week tier in this slice (injury field is threaded but unused — that's 4.3B): `moderate` ⇒ hard-exposure target −1, exclude hard conditioning categories (vo2/glycolytic/sprint) from placement candidates with a typed deny reason, condTarget −1 (floor 3); `major` ⇒ no hard categories, strength allocations emitted as light/optional tier, conditioning easy-only, +1 recovery day if a slot exists; `pause`/absent ⇒ no generation change (`pause` is handled by the existing `shutdown_week` path — do not touch it).
> 4. **Scope fences:** do NOT touch injury pool filtering, exerciseFilter, projection/4.2 code, sprint eligibility internals beyond candidate exclusion, block/week state, deload resolver, progression, conditioning component enum, rebuild internals (argument threading only), Coach Notes, coach chat. Weekly-card/sick producers are 4.3D — this slice consumes constraints that already exist (recovery mode via tap flow).
> 5. **Tests.** New `src/__tests__/generationConstraintContextTests.ts`: assembler table-driven (injury→band mapping delegated correctly; daily signals excluded; week-scope constraint → tier); moderate week shape (hard-exposure target −1, zero hard conditioning placed, key strength present); major week shape (no hard work, optional tier, easy conditioning only); empty context ⇒ QA board byte-identical (commit snapshots); reconciliation seed test — a moderate-tier generated week projected through existing constraint projection with the same constraint produces zero removals. Full test board; known pre-existing failures per roadmap — do not chase.

## G. Behaviour risk

4.3A: medium — first time live state changes generation output; fenced by empty-context byte-identical snapshots and by consuming only week-scope constraints that today require an explicit user action (recovery-mode tap). 4.3B (injury pools): high — every injured athlete's generated week changes; contained by the reconciliation invariant and per-band born-safe tests, and by the fact that 4.2 remains underneath as the safety net. 4.3C (session-type biasing): highest judgment content — Fable design pass on the bias tables before Codex implements. 4.3D (producers): low-medium, UI flows writing constraints through existing store paths. Sequencing: A → B → C, D parallel with B; the reconciliation invariant lands with A and tightens with each slice.
