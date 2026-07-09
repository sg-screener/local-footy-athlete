# Bible Implementation Roadmap — 2026-07-09

Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md` (committed today, verbatim, Section 17 Addendum wins conflicts).
Basis: three parallel code audits (areas A–I) against the Bible, all findings verified with file:line evidence at HEAD.

---

## 1. Plain-English diagnosis: why programming still feels bad

The plumbing fixes worked. The safety layer is real: game protection, team-day rules, finisher pairing laws, caps, atomic rebuilds, truth-gated notes. What's missing is the **value layer** — the parts of the Bible that put *good* work into the week rather than keeping *bad* work out. The engine has strong brakes and a weak engine. Five mechanisms produce the "dogshit" feel:

**1. The week never changes.** One static microcycle is generated and repeated for the whole block. `weekNumber` is always 1, `intensityMultiplier` always 1.0 (`generateProgram.ts:126-137, 886-897`). The scheduled-deload machinery exists but can never fire — its inputs are hardcoded (`weeksSinceDeload: 2` at `strengthProgressionIntegration.ts:597-599`, `workoutHistory: []` at `sessionResolver.ts:1142`). Block-to-block exercise rotation is live machinery with a dead input (`miniCycleNumber: 1` forever, `generateProgram.ts:109, 806`). Week 4 looks identical to week 1. That's a template, not a program.

**2. The hardest, most valuable conditioning is unreachable.** Every conditioning placement round-trips category → 3-value flavour → category. `flavourToSelectedCategory('high-intensity')` returns only `['sprint','glycolytic']` — **vo2 is not in the set** (`coachingEngine.ts:2356-2359`, used at all 5 call sites: 3321, 3347, 3419, 3547, 3649). So 4x4s and 1km repeats — the Bible's flagship hard sessions — can never appear, in any phase, standalone or attached. Off-season "vo2" slots become sprint requests, get denied, and **silently collapse to aerobic_base** (`:3425`). The scorer forever sees an uncovered vo2 category it can never fill. This single bug is a big chunk of "every week is easy erg filler."

**3. Sprinting effectively doesn't exist.** Off-season sprint is blanket-denied because there's no late-block model (`coachingEngine.ts:1947-1948` — honest comment, real gap vs Bible §7 "last 3-4 weeks of off-season"). Pre-season sprint is denied whenever any TT or game exists (`:1949`), missing the Bible's 1-TT exception and warm-up micro-doses. A footy app that never prescribes sprinting is a credibility hole.

**4. Sets/reps ignore the phase.** `phaseRepSchemes.ts` says it itself: "DATA ONLY — not consumed by the engine yet" (`:4-5`). Deterministic sessions prescribe the same 3×5-8 whether it's in-season (Bible: 2-4×2-4) or off-season (Bible: 3×8 base, 8-12 early) — `defaultProgram.ts:645-677`. This is the most concrete, checkable Bible rule an athlete can see violated on every card.

**5. Adjustment is censorship, not coaching.** Injuries and readiness never re-enter generation — they gut sessions after the fact at render/commit. The projection layer "never substitutes" (`visibleProgramProjection.ts:102`); fully-gutted sessions collapse to rest instead of being rebuilt with safe work. "Feeling flat today" maps to severity **7** (`readinessConstraints.ts:42`), which deletes main lifts — the Bible says trim accessories and keep the main lift. Injury thresholds live in **five parallel systems** with different breakpoints while the canonical Bible bands sit unwired (`injurySeverityBands.ts:5-13`).

Underneath all five: the Bible's rules kernel (`src/rules/`) is report-only by design, the validator is log-only at every call site, and the same classifiers are re-implemented in 4-6 layers with drift (e.g. full-body = HIGH stress in `coachingEngine.ts:2038` but MEDIUM in `stressClassification.ts:71-73`). The generation brain and the rulebook are two separate organs that don't share blood.

**One sentence:** the engine converges to the minimum safe week because everything that would make it converge to the *optimal useful* week — periodisation, reachable hard conditioning, a speed model, phase-aware doses, generation-aware adjustment — is either unwired, unreachable, or post-hoc.

---

## 2. Audit scoreboard (areas A–I)

| Area | Well implemented | Partial | Missing / broken |
|---|---|---|---|
| A. Phase templates | 3 phase branches; pre-season game-week (B4); practice-match overlays; game-tap rebuild | Bye = "train harder" only (no deload mode; byeWeek flag never passed by callers); in-season = 1 of 3 ideal structures | Early/late subphase model (off & pre); off-season sprint block |
| B. Weekly structure | 3/4/5/6-day handling; split-by-core-count (FB at 1-2, 2L+2U at 4); team-day anchors; upper-on-TT | Optimal dose intent exists (condTarget=max(core,4), H-IS-3, H-PRE-8) but in-season conditioning under-delivers; free-form ≥5-core path least anchored | In-season optional off-leg flushouts (replaced by accessory filler; 1-cond cap `sessionResolver.ts:1287`) |
| C. Strength | In-week pattern balance; FB consolidation; gunshow excluded from 4-cap | Accessory coverage (adductor/calf/core by pool luck only); one taxonomy fallback hole ("Upper Body Pump") | Cross-week/block balance memory; **phase rep schemes unwired** |
| D. Conditioning | Row/ski ≤10min interval law; ≤2 steady ergs/week; finisher variety pools; mode rotation | Skip-when-covered only emergent; long aerobic capped at 45min (Bible: to 60) | **vo2 unreachable (round-trip bug)**; no finisher-vs-component type (`minCombinedDays` computed then dead, `coachingEngine.ts:1309`); in-season game weeks generate **zero** conditioning |
| E. Sprint | Fresh/midweek placement, no-sprint-finisher law, micro-dose variants (well designed, never fires) | TT counts toward exposure in kernel counters only | Late off-season block; pre-season 2/wk target; 1-TT warm-up sprint rule |
| F. Injury/readiness | Per-region exposure tables; commit-path action ladder; soreness one-tier-milder | Generation sees injuries only via readiness penalty + tempo off-feet; red-flag regexes thin | Bible bands unwired (5 fragmented threshold systems); no substitution-before-removal; collapse-to-rest; "flat"=sev 7 nukes main lifts; `readinessOverride` has no producer; no slight/moderate/major/pause tiers |
| G. Progression | Feedback→next-session engine (6-state, wired live); missed-session handling | "Too easy" side too weak (+1 set max) | **No week-to-week wave, no firing deloads, no block 2+, conditioning progression inert (inputs hardcoded)**; training age ignored (`experienceLevel` never read by engine; `rulesEngine.ts` dead code) |
| H. Coach Notes | All copy deterministic; truth-gated "program updated"; clearing releases overrides | Readiness card shows with zero diff | Game-change copy is canned + not truth-gated (`MakeAChangeScreen.tsx:131`); no deload notes |
| I. Validator vs generator | G-1/G-2/G+1 have full generation counterparts; H-TEAM/H-PRE generation-side | Caps enforced twice with different counting definitions | **No blocking final gate** (all 3 call sites log-only); double-day stack rules validator-only; 6 duplicated classifier families, some inconsistent (FB stress) |

---

## 3. Roadmap — phases and slices

Ordering logic: fix what silently corrupts output first (P1), then the biggest visible-quality wins (P2), then the time dimension (P3), then adjustment quality (P4), then consolidation (P5). Codex = mechanical, well-scoped, test-guarded. Fable = cross-cutting design + wiring requiring judgment.

### P1 — Make the conditioning brain reachable (this week)

**Slice 1.1 — Kill the flavour↔category round-trip (category is the only currency).**
- Goal: vo2 placeable everywhere it's legal; no silent sprint→aerobic collapse; flavour becomes display-only, derived from final category.
- Files: `src/utils/coachingEngine.ts` (call sites 3321/3347/3419/3547/3649, `flavourToSelectedCategory` 2356-2359, `pickCondCategory`/zone logic 2210-2337), tests `finisherEligibilityTests.ts`, `weekPlanQA.ts`.
- Owner: **Codex** (prompt below). Tests: reachability assertions per phase (vo2 standalone off/pre-season; vo2/glyco attached upper-day rules unchanged), full board green, QA scenario diff review.
- Risk: medium — off/pre-season weeks WILL change (that's the point). Game protection, TT rules, lower-day easy-only law untouched (all vetting stays in `finisherEligibility`).
- Expected improvement: hard conditioning finally appears; conditioning variety stops being aerobic/tempo-only; scorer coverage math stops chasing an unfillable category.

**Slice 1.2 — Finisher vs conditioning component (typed).**
- Goal: Bible §6 + §10-addendum distinction. `attachedConditioningKind: 'finisher' | 'component' | 'recovery_addon'`. Component = 20-30min real dose, 1.0 credit, hard-exposure when hard, never skip-laddered; finisher keeps 0.75 credit + skip ladder. 4-day off-season athletes get real S+C days; wire the dead `minCombinedDays` (`coachingEngine.ts:1309`).
- Files: `coachingEngine.ts` (allocation + credit), `sessionBuilder.ts` (component templates beyond the 22-30 cap, `CONDITIONING_DURATION_CAP` 1196-1199), `sessionTaxonomy.ts`/`weeklyExposureCounts.ts` (counting), display labels.
- Owner: **Codex** after Sam approves the enum + dose tiers (investigation doc `CONDITIONING_COMPONENT_INVESTIGATION_2026-07-09.md` already proposes them). Tests: new component-eligibility suite; 4-day off-season scenario asserts ≥1 real component; finisher laws unchanged.
- Risk: medium-high — changes weekly dose upward for low-availability athletes. Guard: components respect hard-day caps and lower-day off-feet pairing law.
- Expected improvement: the #1 persona (4-day off-season) stops getting "conditioning scraps"; weeks read as deliberate S+C doubles per Bible §2.

### P2 — Make the visible prescription match the Bible (next)

**Slice 2.1 — Wire phase rep schemes.**
- Goal: in-season 2-4×2-4 (3×3 base), pre 4-6 (3×5), off 6-8 (3×8), pull-tolerates-more rule, accessory 8-15/10-20 bands — applied to every deterministically generated exercise.
- Files: `src/data/defaultProgram.ts` (645-677 + all hardcoded prescriptions), `src/utils/sessionBuilder.ts`, consume `src/rules/phaseRepSchemes.ts` as single source; delete the divergent table in `supabase/functions/generate-program/index.ts:82-131` or mark legacy.
- Owner: **Codex**. Tests: per-phase prescription assertions in QA; snapshot diffs reviewed.
- Risk: low — content-level, no placement changes. Highest visible-quality-per-unit-risk in the whole roadmap.
- Expected improvement: every session card starts obeying the most checkable Bible rules; in-season stops prescribing hypertrophy reps.

**Slice 2.2 — In-season conditioning floor + bye-week dual mode.**
- Goal: in-season game weeks get the Bible's optional off-leg flushouts (Mon/Wed per ideal structures) instead of zero conditioning; bye week gets both Bible modes (mini-pre-season when readiness good / deload-reset when not), Saturday hard-conditioning slot with real cond metadata; pass `byeWeek` flag at all validator call sites (currently never passed).
- Files: `coachingEngine.ts` (game-week branch 765-963, no-game branch 965-1123), `sessionResolver.ts:1287` (1-cond cap), validator call sites.
- Owner: **Fable** (touches the in-season world model), Codex for the flag-wiring sub-part.
- Risk: medium — in-season is the most protected phase; everything added is optional-tier and off-feet by default.
- Expected improvement: in-season weeks match the Bible's three ideal structures instead of "1 of 3, thinner".

### P3 — Give the program a time dimension (the big one)

**Slice 3.1 — Block plumbing: real weekInBlock/blockNumber through generation.**
- Goal: the existing machinery gets live inputs. `weeksSinceDeload`, `consecutiveBuildWeeks`, `workoutHistory` fed from real data; block 2+ regeneration invokes the already-built exercise rotation; deload threshold corrected to 3-4 weeks off/pre (currently 6, `progressionRules.ts:118-119`).
- Files: `generateProgram.ts` (109, 126-137, 806, 886-897), `strengthProgressionIntegration.ts:597-599`, `sessionResolver.ts:1142`, `blockAdjuster.ts`, a block-state store.
- Owner: **Fable** design + Codex implementation. Tests: 4-week simulation test (week 4 ≠ week 1; deload fires; block 2 rotates variations).
- Risk: high — this is the first time the program changes over time. Ship behind explicit new-block generation, not silent weekly mutation; manual edits/overrides must survive (canonical weekRebuild door already handles this).
- Expected improvement: eliminates the single biggest "this isn't a real program" signal.

**Slice 3.2 — Subphase model: early/late off-season and pre-season.**
- Goal: off-season: early = optional fortnight, no running, 8-12 reps; mid = build; late = speed block (unlocks the sprint denial at `coachingEngine.ts:1947-1948`) + 6-8 reps + harder conditioning ramp. Pre-season: early longer/lighter → late shorter/sharper.
- Files: `coachingEngine.ts` (new `subPhase` input consumed by eligibility, zones, rep scheme selection), profile/season dates for derivation.
- Owner: **Fable** (design doc + Sam sign-off on subphase boundaries first — Sam already rejected the miniCycle proxy; needs a real model).
- Risk: medium-high. Blocked-by: 3.1.
- Expected improvement: off-season stops being one flat 8-week smear; sprint work legally enters the program exactly where the Bible wants it.

**Slice 3.3 — Sprint/speed completion.**
- Goal: pre-season 2/wk sprint exposure target with TT counting inside the engine (not just kernel counters); 1-TT athletes get warm-up sprint micro-doses; late-off-season standalone speed sessions (accel → hills → max-velocity progression per Bible §7).
- Files: `coachingEngine.ts` (eligibility 1944-1952, Sprint Rescue 3758-3767), `sessionBuilder.ts` (speed session templates), `weeklyExposureCounts` integration.
- Owner: Codex once 3.2 lands. Risk: medium. Expected improvement: the app finally prescribes sprinting like a footy S&C coach.

### P4 — Adjustment quality (injury/readiness as coaching, not censorship)

**Slice 4.1 — One severity system: wire `injurySeverityBands` everywhere.**
- Goal: Bible 1-3/4-5/6-7/8-10 bands become the single source; the five parallel threshold systems (exposureEngine 4/7, injuryProgression, programAdjustmentEngine 5/6/7/8, constraintPlan, activeProgramModifiers) consume it; physio nudge at ≥6 (currently ≥7); guided-flow "6-7" stops behaving like 8-10.
- Files: `exposureEngine.ts:383-387/641-642/858-870`, `injuryProgression.ts:35-41`, `programAdjustmentEngine.ts:1400-1403`, `constraintPlan.ts`, `guidedInjuryControl.ts:74-109` (also fix hip→lowerBack mis-bucket), consuming `src/rules/injurySeverityBands.ts`.
- Owner: **Fable** (this is the long-flagged Phase 5; behaviour changes for every injured athlete; needs live verification matrix).
- Risk: high but contained by band-by-band tests. Expected improvement: consistent, Bible-correct injured-athlete weeks; earlier physio advice.

**Slice 4.2 — Graded readiness tiers + substitution before removal.**
- Goal: Bible §9 slight/moderate/major/full-pause ladder. "Flat today" trims accessories/finisher and keeps the main lift (stop mapping to severity 7); "limit" produces actual set/volume reductions (mechanics already exist in commit path — make them reachable from readiness signals); projection substitutes (ordered pattern→muscle→unaffected) before removing, and a fully-gutted session becomes safe alternate work, not rest; fix the Bible-listed bad swap (hamstring sprint→hard assault bike, `injurySessionClassifier.ts:137-140`).
- Files: `readinessConstraints.ts:32-104`, `exposureEngine.ts:664-703/982-995`, `visibleProgramProjection.ts:102-154`, `injurySessionClassifier.ts:128-191`.
- Owner: **Fable** design + Codex sub-parts. Risk: high (most user-visible adjustment surface). Expected improvement: "I'm not 100%" stops deleting training; injured weeks keep useful work per the Bible's core promise.

**Slice 4.3 — Readiness/injury re-enter generation.**
- Goal: give `readinessOverride` (`coachingEngine.ts:1282`, currently producer-less) real producers (weekly readiness card, recovery-mode constraints), so rebuilds *design* around the constraint instead of censoring after. Pairs with Sam's backlog item (visible weekly "I'm not 100%" card).
- Owner: Fable. Blocked-by: 4.2. Risk: medium.

### P5 — One brain, one rulebook (consolidation)

**Slice 5.1 — Blocking final validation gate.**
- Goal: Bible §15 "final validation before anything changes." Promote validator from log-only at the three doors (`coachingEngine.ts:672`, `coachRevisionOverrideWriter.ts:147-151`, rebuild commit) to Addendum-F semantics: soft→note, strong→warn/confirm, hard_stop→block. Add the validator-only rules (double-day stacks) to generation or gate them here.
- Owner: **Fable** (policy decisions per finding). Risk: medium — gate must never brick a rebuild; fallback = warn+proceed+log.

**Slice 5.2 — Deduplicate classifiers onto the rules kernel.**
- Goal: one classification source. Fold `sessionNaming` inference, `defaultProgram` region regexes, QA `classifyRegion`, `weeklyPlanDisplay`, recovery/TT/game detectors onto `sessionTaxonomy`/`stressClassification`; resolve the FB-stress contradiction (engine HIGH vs kernel MEDIUM) with Sam's ruling; unify cap counting definitions; delete dead layers (`trainAroundEngine.ts` 964 lines orphaned, `rulesEngine.ts` unimported, superseded `injuryAdjustmentEngine` pipeline).
- Owner: Codex, mechanical, one classifier family per PR with snapshot tests. Risk: low each, cumulative payoff: every future rule lands once.

**Slice 5.3 — Coach Notes completion.**
- Goal: deterministic game-change copy from the actual rebuild diff ("Added Saturday practice match. Protected Friday…", truth-gated — replaces canned `MakeAChangeScreen.tsx:131`); deload notes when 3.1 lands; suppress zero-diff readiness card.
- Owner: Codex. Risk: low.

**Slice 5.4 — Training age + goals biasing.**
- Goal: `experienceLevel` consumed by generation (dose, exercise complexity gating via pools, progression speed); goals bias 5-15% per Bible §12. Cross-week pattern-balance memory + guaranteed adductor/calf/core coverage slots ride along.
- Owner: Fable design + Codex. Risk: medium. Last because it tunes a brain that must exist first.

---

## 4. Next 3 slices — do these, in order

1. **Slice 1.1 — kill the round-trip.** One mechanical bug is suppressing the entire hard-conditioning tier and silently degrading sprint slots to aerobic. Everything downstream (components, subphases, sprint model) assumes categories are reachable. Codex-ready today; prompt below.
2. **Slice 2.1 — wire phase rep schemes.** Zero placement risk, maximum visible fidelity. After this, every session card obeys the Bible's most concrete rules. Codex-ready immediately after 1.1 lands (independent, but land sequentially to keep QA diffs readable).
3. **Slice 1.2 — conditioning component kind model.** Needs your sign-off on the enum + dose tiers from the investigation doc, then Codex-ready. This is what fixes the 4-day off-season persona for real.

(3.1 block plumbing is the biggest quality unlock overall, but it needs a Fable design pass + your sign-off on how block transitions surface to the athlete — queue it while Codex runs 1.1/2.1/1.2.)

---

## 5. Codex-ready prompt — Slice 1.1

> **Task: make conditioning category the single placement currency; retire the flavour round-trip. READ `docs/LFA_PROGRAMMING_BIBLE.md` section 6 first.**
>
> Repo: local-footy-athlete. All work in `src/utils/coachingEngine.ts` + tests. Do not touch `finisherEligibility` protective branches, game/TT guards, or the lower-day easy-only law.
>
> **Problem.** All five conditioning placement sites derive the category via `flavourToSelectedCategory(pickCondFlavour(pos), pos)` (call sites ~3321, 3347, 3419, 3547, 3649). `pickCondFlavour` internally picks a category with `pickCondCategory` (~2210-2337) then collapses it to a 3-value flavour; `flavourToSelectedCategory` (~2356-2359) maps `'high-intensity'` back to candidates `['sprint','glycolytic']` only. Consequences: (a) `vo2` can never be placed anywhere; (b) off-season high-intensity slots become sprint requests, are denied by the standalone-sprint law (~1947-1952), and silently collapse to `aerobic_base` (~3425); (c) `st.condCategories.vo2` is forever 0 so coverage scoring chases an unfillable category.
>
> **Change.**
> 1. Introduce `pickPlacementCondCategory(pos, st, ...)` that returns a ranked list of concrete `CondCategory` candidates directly from `pickCondCategory`'s logic (phase priority order, zone sequencing, coverage counts) — no flavour intermediary. vo2 must be a first-class candidate wherever `CATEGORY_PRIORITY_OFF/PRE` lists it.
> 2. At each of the five call sites, iterate candidates through `finisherEligibility` (attached) / the standalone vetting path: first ALLOWED candidate wins; if a candidate is denied, fall to the next candidate (and the existing downgrade ladder), recording `condCategoryDowngradeReason` on the allocation instead of silently collapsing. Never place a category eligibility denied.
> 3. Off-season: sprint must not be auto-requested by the zone picker (it's denied by law until the late-block model exists) — exclude it from off-season placement candidates at the picker level so vo2/glycolytic/tempo/aerobic compete honestly.
> 4. `categoryToFlavour` becomes display-only: flavour is always derived from the FINAL placed category (this invariant already exists — keep it) and `flavourToSelectedCategory` is deleted.
> 5. `buildCondLabel` / templates: verify vo2 placement resolves to the existing vo2 templates ('4x4 VO2', '1km Repeats' etc. in sessionBuilder TEMPLATE pools) and that attached vo2 uses the combined-size template path.
>
> **Guards that must remain true (assert in tests):** no sprint finishers ever; lower/hinge/full days get easy off-feet aerobic only; G-window/TT-day/TT-adjacent vetting unchanged; ≤2 steady aerobic erg finishers/week; tempo enters only via ladder (not a coverage category); readiness gates unchanged.
>
> **Tests.** Extend `src/__tests__/finisherEligibilityTests.ts` + add `condCategoryReachabilityTests`: (1) off-season 5-day no-TT high-readiness week places ≥1 vo2 OR glycolytic standalone (not zero forever); (2) pre-season week with 1 TT: vo2 reachable on a non-adjacent day; (3) attached path: upper-day hard finisher can resolve vo2 when headroom rules pass; (4) denied-candidate fallback records a reason and never yields a category that eligibility denied; (5) `flavourToSelectedCategory` no longer exists; grep-guard that no call site converts flavour→category. Run the full board: test:rules-kernel, test:week-validator, test:finisher-eligibility, test:stress-placement, test:game-local-rebuild, test:week-rebuild, and `npx sucrase-node src/__tests__/weekPlanQA.ts` (expect S6/S7 off-season diffs — capture before/after week shapes in the PR description for Sam's review; known pre-existing failures: strengthSequencingTests six-day pre-season Wednesday, test:qa tsc script, coachRevisionProposalControllerTests env-dependent — do not chase these).
>
> **Do not**: add new categories, touch tempo semantics, change credit weights (0.75 finisher credit stays — that's Slice 1.2), or modify sessionResolver/defaultProgram beyond label verification.

---

## 6. Standing constraints (apply to every slice)

Systemic fixes only — no screenshot chasing (project rule). No generation changes without Sam's approval of the slice. Bible Section 17 wins conflicts. Every slice: full test board + QA before/after week-shape diff in the PR. Live Simulator verification requires a Metro restart (Metro is blind to Claude's edits). Legacy ProgramEdit/resolver untouched. Injury live thresholds change only in Slice 4.1, not incidentally.
