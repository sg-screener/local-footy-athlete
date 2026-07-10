# Recovery_addon Model Plan — Carries, Trunk, Mobility, Prehab (2026-07-09)

Read-only plan. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md`. Out of scope by instruction: injury/readiness implementation (addons *consume* existing contraindication/constraint machinery only), progression/deloads, rebuild architecture, Coach Notes, coach chat, speed/sprint.

**HEAD reality check (re-verified today — earlier audits are stale here).** The content layer has moved a lot: `src/data/exercisePools.ts` is now a full categorized catalog (categories incl. `groin_adductors`, `calves`, `lower_prehab`, `trunk_anti_rotation`, `shoulder_health`, `hamstring_light`, `tissue_quality`, `mobility`, `easy_cardio`, `breathing_reset`) with `prescriptionType` reps/duration/distance, `perSide`, equipment, `contraindications`, and fatigue levels; consumed by `sessionBuilder.ts:45`. McGill Big 3 all present (McGill Sit Up, Bird Dog, Side Plank), Copenhagen ×3 levers, Nordic Lower, Tibialis Raise, calf work, Pallof/Dead Bug family, breathing/reset pool, Farmer/Suitcase Carry (with loadRatios in `exercisePoolsStrength.ts` CARRY pool). Gunshow/prehab is a first-class taxonomy category (`sessionTaxonomy.ts:43` `gunshow_prehab`), excluded from main-strength counts (`weeklyExposureCounts.ts:16,112`), G-1-legal (`weekStructureValidator.ts:257`). **What remains unbuilt: the `recovery_addon` kind itself** — `domain.ts:169-175` still marks it a "reserved typed placeholder"; `attachedConditioningKind` is live for `finisher`/`component` only. Nothing produces, renders, places, or counts a recovery add-on.

## A. Plain-English model

A recovery_addon is a small optional block of low-fatigue support work — carries, trunk, mobility, prehab, breathing — that rides on the week without costing anything. It is not strength, not conditioning, not sprint work: it earns zero hard exposure, zero conditioning credit, creates no progression pressure, and skipping it is free. The Bible's framing: "You can always add a recovery or mobility flow to any day as optional" (:119); gunshow/prehab is "low-fatigue accessory, pump, prehab and body-armour work… useful for getting work in without creating major fatigue" (:431-433); it "should not create major soreness or fatigue" (:455); and it never replaces real training — "Gunshow, accessories, prehab, mobility and recovery work are useful, but they do not replace proper upper or lower strength exposure" (:750). The point of the layer is robustness: trunk/carries for bracing and contact armour (:920-945), adductors/calves/hamstrings/shoulders for availability, mobility especially off-season (:102).

## B. Current code gaps

1. **`recovery_addon` kind is inert** — reserved in the enum, no producer, no renderer, no counting semantics, no skip semantics.
2. **No attachment surface** — a Workout has one conditioning block; there is no optional low-fatigue block a day can carry (Bible :119 has no home).
3. **No standalone Mobility Flow session** — MOBILITY_POOL exists and recovery sessions draw from pools, but the Bible's promised off-season "mobility flow sessions" (:102, :4005) have no named optional template (verify at implementation; classify under existing RECOVERY_RX which already matches /mobility/).
4. **No weekly coverage guarantee** — trunk/adductor/calf coverage is still pool-luck; the Bible treats these as the accessory backbone (:780: "trunk anti-rotation, groin adductors, shoulder health, calves, hamstring-light").
5. **Minor content gaps only:** Bear Carry absent (Bible :931 names it); confirm every pool item has an `exerciseTags` entry + cues + video mapping (integrity, not backfill).
6. **Counting edges:** taxonomy handles gunshow days, but an addon attached to a strength day must not flip that day's stress class, duration caps, or exposure counts — those seams don't exist yet.

## C. Proposed recovery_addon structure

A **separate optional block on the Workout**, not an overload of the conditioning block (conditioning kinds keep their credit semantics; addons have none):

- `recoveryAddon?: { kind: 'mobility' | 'trunk' | 'carries' | 'prehab' | 'breathing'; exercises: PrescribedPoolExercise[]; durationMinutes: number; optional: true }`
- **Duration:** yes — 5-15 min target, hard cap enforced by the builder.
- **Exercises:** yes — selected from the existing pools with their native prescriptions (2-4 × 30-60s / 20-60m for carries per Bible :934; Nordic-style items keep low reps).
- **Skippable without penalty:** yes — excluded from completion/feedback progression inputs and from missed-session logic (skip generates no adaptation signal; fence at the feedback-ingestion boundary without touching progression internals).
- **Exposure counting:** zero — `weeklyExposureCounts` ignores addon content; sessionTaxonomy classifies the block as recovery-tier; never counts toward hard days, main strength, conditioning credit, or sprint/COD. An `easy_cardio` pick is deliberately NOT allowed inside an addon — anything aerobic stays in the existing finisher/component lanes so credit accounting has one owner ("not every add-on needs to be conditioning").
- **Hard-day counts:** unaffected by construction; validator check asserts a day's stress class is identical with and without its addon.
- **No progression pressure:** no week-to-week dose escalation; variety rotates picks, dose stays flat.

## D. Placement rules

Allowed: after upper strength (any addon kind); after lower strength only controlled low-fatigue picks (no heavy carries after a big lower day — "be careful not adding too much load to the other areas already working" :1818); gunshow day (native home — the day already is this content plus pump); recovery day (already draws these pools); rest day as optional mobility/breathing only (:114 — "rest days should not secretly become hard training days"); G-1 light mobility/prehab/breathing only ("any recovery stuff or mobility flows are fine" :77); G+1 recovery-focused (mobility/breathing/tissue quality). Avoid: heavy carries after an already huge session; hard trunk circuits near game day (:947); anything that turns the addon into fatigue (fatigue-level filter: addon picks must be tagged `low`, `moderate` allowed only off-season on non-adjacent days); painful prehab on an active injury — enforced by the existing `contraindications` tags + constraint filtering, not new injury logic: shoulder issue ⇒ no shoulder_health picks that press/irritate, offer lower/core instead; groin ⇒ short-lever Copenhagen/squeeze only when mild, none when worse (severity bands own the threshold); calf/Achilles ⇒ controlled calf/tib when mild, never plyometric; lower back ⇒ no loaded carries, McGill-style core preferred (:2166).

## E. Phase rules

Off-season: the richest layer — mobility flow sessions live here (:102), harder carry variants and more volume legal (:944), weak-point bias (athlete's stated weakness steers kind selection). Pre-season: keep, moderate dose; robustness bias (adductor/calf/nordic exposure supports the sprint ramp — no coupling to the speed model, just selection bias). In-season: familiar, low-soreness, short (:943 "in-season core should be familiar, low-soreness and not too fatiguing"); G-1-safe picks only near games; carries lighter. Game week: addons shrink to mobility/breathing near the game; normal early-week. Deload week: addons are the one thing that doesn't shrink — Bible lists recovery work as belonging "during deload weeks" (:472); classification only, no deload-code changes.

## F. Implementation slice order

- **RA-A — Content integrity + gap fill (small, Codex-ready now).** Add Bear Carry; verify every pool exercise has exerciseTags entry, cues, video mapping, sane contraindications; integrity test locks it. No behaviour change.
- **RA-B — Mobility Flow optional session template.** Named recovery-tier template from MOBILITY_POOL + BREATHING_RESET_POOL; off-season optional day + rest-day optional + G-1-legal; classified by existing RECOVERY_RX.
- **RA-C — Weekly coverage rules.** Deterministic guarantee: each week ≥1 trunk, ≥1 adductor, ≥1 calf touch inside existing accessory slots (no new sessions, no duration growth); phase-dosed per §E.
- **RA-D — recovery_addon block.** Type + builder producer (placement rules §D) + rendering (optional label, skip affordance) + counting fences (zero credit) + skip-no-penalty boundary. Needs Sam's sign-off on the UI shape of the optional block before build.
- **RA-E — Tests** woven through each slice; standalone validator check (log-only, matching current validator policy): day stress/exposure identical with and without addon.

Order rationale: A is zero-risk hygiene; B ships visible Bible value with an existing classification lane; C changes weekly content (medium risk) but no structure; D is the new surface and the only slice needing design sign-off.

## G. Tests needed

RA-A: pool↔tags↔cues↔video integrity (every item complete; every contraindication tag valid); no generation diff (QA snapshots byte-identical). RA-B: mobility flow classifies as recovery/low-stress; allowed G-1; never counts toward hard caps or conditioning targets; appears only as optional tier. RA-C: per-phase QA assertion — every generated week has trunk+adductor+calf touches; session count and durations unchanged; picks respect contraindications with an active-injury fixture. RA-D: zero-credit fences (exposure counts, stress class, hard-day count, conditioning credit identical with/without addon); skip produces no progression/missed-session signal; G-1 addon is mobility/breathing only; heavy-carry-after-lower fixture rejected; rest-day addon is mobility/breathing only; injury fixtures (shoulder/groin/calf/lower-back) select per §D. Full board + QA week-shape diffs at every slice.

## H. Codex-ready first prompt (RA-A)

> **Task: RA-A — recovery/prehab content integrity + gap fill (data only, zero behaviour change). READ `docs/LFA_PROGRAMMING_BIBLE.md` core/carry rules (~:918-947) and accessories (~:771-782) first, then `docs/RECOVERY_ADDON_PLAN_2026-07-09.md` §B/§F.**
>
> 1. Add **Bear Carry** to the carry content: entry in the `exercisePoolsStrength.ts` CARRY pool (loadRatio relative to Farmer Carry = 1.00, pick a sensible ratio and comment it), `exerciseTags.ts` entry with full per-bucket InjuryProfile (lower back = caution given loaded carriage; wrist/grip caution consistent with Farmer Carry), `exerciseCues.ts` cues, `exerciseVideoService.ts` mapping (null URL acceptable if no video chosen — follow the file's null convention).
> 2. Integrity sweep across `src/data/exercisePools.ts` + `exercisePoolsStrength.ts`: every exercise must have (a) an `exerciseTags.ts` entry with complete InjuryProfile, (b) an `exerciseCues.ts` entry, (c) an `exerciseVideoService.ts` mapping (or explicit null), (d) non-empty `contraindications` where the tags mark any bucket 'avoid' (consistency between the two systems), (e) a `prescriptionType` that matches the Bible dosing style (carries = distance/duration; breathing = duration/reps; Nordic-style = low reps ≤5). Fix gaps found; list every fix in the PR description.
> 3. Write `src/__tests__/recoveryContentIntegrityTests.ts` locking all of the above so future pool additions fail loudly when incomplete.
> 4. **Zero behaviour change:** no builder, taxonomy, counting, placement, injury, or generation code may be touched. Prove it: QA scenario board snapshots byte-identical before/after (commit snapshots in the PR).
>
> Do NOT: create the recovery_addon block or producer (RA-D), add mobility flow templates (RA-B), change weekly accessory selection (RA-C), or touch injury/readiness, progression/deload, rebuild, Coach Notes, chat, or sprint code. Full test board; known pre-existing failures per roadmap — do not chase.

## I. Behaviour risk

RA-A: near zero (data + tests, snapshot-proven no-op). RA-B: low — new optional session in an existing classification lane; worst case is clutter, not harm. RA-C: medium — every week's accessory content shifts; fenced by no-new-sessions/no-duration-growth assertions and contraindication fixtures. RA-D: medium — new UI surface and new counting fences; the design risk (how the optional block looks and how skip behaves) needs Sam's sign-off; the counting risk is fully testable. Systemic guard for the whole layer: the addon must never be load-bearing — no session may rely on its addon to satisfy any coverage rule or exposure target (assert in RA-C/RA-D tests), or "optional" quietly becomes mandatory.
