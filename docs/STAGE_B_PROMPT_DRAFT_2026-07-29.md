# STAGE B — THE GENERATION ENGINE (draft prompt, Fable max effort)

Paste to a fresh Fable session once Sam's device pass is green. Read top to bottom before writing any code.

---

Unit: STAGE B — rebuild program generation so every week is assembled from Sam's authored data. This is the engine the last month cleared ground for. Work tests-first, one stage per commit, boundary report per stage. You have escalation rules in CLAUDE.md/AGENTS.md — they apply with full force here.

## Read first (in this order)
1. AGENTS.md + CLAUDE.md — process law, escalation, environment facts
2. docs/SAM_EXECUTION_ORDER_2026-07-25.md and docs/MASTER_PLAN_2026-07-23.md — where Stage B sits
3. docs/PROGRAMMING_DESIGN_SESSION_2026-07-23.md — D1–D16: the design rulings this engine implements
4. docs/CONDITIONING_TEMPLATES_FINAL_2026-07-25.xlsx + its .md — the 55 authored templates (equality-gated)
5. docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx — muscles, experience gates, cues (equality-gated)
6. docs/EXPOSURE_CONTRACT_REVIEW_2026-07-28.xlsx — the authored week-mode contracts (equality-gated)
7. docs/STAGE_C_TIME_TRIAL_BOUNDARY_REPORT_2026-07-29.md §4 — the five requirements Stage C hands you
8. src/data/ owners: twoKmTimeTrial, equipmentLattice, capacityRubric, injuryRegions, bibleThresholdAnchors, readinessStructureCensus

## Standing laws (non-negotiable, all gated)
- **Contracts own counts.** The week-mode contract is the sole authority on session counts; the engine assembles to it, never re-decides it. Structure comes from phase + schedule facts; capacity/readiness affects dose only.
- **No invented numbers.** The provenance gates fail the build on any athlete-affecting number without bible_anchor/ruling_anchor/equality binding. If the build needs a number nobody authored, STOP and present it for Sam's ruling. New numbers arrive authored or not at all.
- **Ask when no fact answers; derive when one does; never both.**
- **Athlete-placed content outranks derived filler.** Generation fills around accepted athlete content; it never overwrites it.
- **Preference changes never invalidate accepted history.** Aim vs selection: raising an aim must not make §18 reject stored weeks.
- **Names are literal-locked; dose strings stay strings until YOUR one typed parse (below); the athlete's own entries are never rounded, snapped, or corrected.**

## Scope — what Stage B builds
1. **The weekly assembler (D15):** canonical weeks per mode from the authored contracts; day placement honouring hard-day spacing (prefer 4, permit 5, days not sessions, doubles free), game proximity (G−3/G−2/G−1/G+1 anchors), team-day stacking, off-feet-first, the consecutive-day policy, and the **time-trial-day selection filter** (D15, Sam-ruled: filter exercise selection on a day hosting a 2km Time Trial — not a pairing ban; you define the filter FROM his ruling docs and stop if it needs new rulings).
2. **Conditioning from the templates.** The 55 authored templates become the only source of conditioning sessions. **ONE typed dose-string parse at a single ingress** — Sam's law from Stage A; do not scatter parsers. Selection respects the template properties (finisher-only, fallback-only, COD availability-gate, mid-session mixing), intensity classifies, W:R never changes, templates shrink to fit time — never change intensity. Conditioning counts TOTAL incl. team/games, cap 5, max 4 running, 5th session off-legs. **TIER_CAPS and the old conditioning progression machinery DELETE with this stage** — honour every dies_at_stage_b pin; landing is detected by the templates module being imported by the generation path.
3. **Strength/muscle blocks (D11):** selection from the master sheet — muscles, experience gates (the **crosswalk is the ONLY experience bridge**; no other mapping may exist), regressions auto-programmed for new-to-training only. Session order D2: power → main → secondary → accessories → finisher; contrast pairs consistent; ONE main per pattern per session; lower-body ladder squat → hinge → SL-knee → SL-hip. Density band 5–7 exercises, constant across the block (D1). Rep prescriptions display as the single middle number (D9); Bible ranges stay the generation source.
4. **Power as rows.** Power is emitted as normal exercise rows with role:'power' — the block form is retired; do not resurrect it. Pool + selector are authored; dose stays policy-owned; block-stable selection.
5. **Blocks and progression (D1):** 3-week blocks, identical skeleton, athlete-owned load progression — the app updates baselines from the athlete's logged increases; generation is never given history to re-decide (lift, don't re-decide).
6. **MAS everywhere it belongs:** per-athlete paces derived from the ONE owner (twoKmTimeTrial.deriveMas) into the %MAS template rows, rendered on BOTH paths (fresh generation and stored-program rendering), honestly labelled measured vs estimate. **Day-one ruling to seek from Sam: the range-vs-binary %MAS conflict** (template rows carry '90–100% MAS' ranges; masCopy.ts carries a binary ≤30s→110%/'>30s→100%' rule; two representations of one intensity — present the options, Sam picks the owner). Fix MAS_FALLBACK_NOTE copy (athlete-facing — draft for Sam's sign-off).
7. **Time-trial placement:** 1–3 per pre-season (Sam's rule), counts as a run against the 4-cap. The session exists (Stage C); you place it.
8. **The 23 PENDING cues:** template effortCues take over conditioning card text where templates own the session. Easy Swim cannot become a template (no swim modality) — present it for Sam to author its cue. The 15 no-cue conditioning rows must end the stage with authored text or an explicit Sam-signed pending state — never silent.
9. **Session structure (step 3):** one session list — no separate boxes; optional mobility flow at top; primers inline; warm-up matches session type.

## Discipline
- **Differential harness first.** Snapshot current generation output across the scenario matrix BEFORE changing anything; every diff during the build must match a written prediction; unpredicted movement is a stop. The golden discipline from the power unit applies to the whole engine.
- **Generation quality is athlete-visible:** Sam has ruled most days feel thin (~3 exercises) — density 5–7 is a Stage B acceptance criterion, not a nice-to-have.
- **Stop-points that go to Sam, not code:** any unauthored number; any new athlete-facing copy; any conflict between authored artifacts (like the %MAS question); any behaviour the design docs don't specify.
- **L10:** the stage is not done until Sam's device acceptance. Ship with an expected-diff sheet for his pass: what weeks should look like per mode, what changed and why.

## Accruals from the 2026-07-29/30 device saga (all binding)
- **Preconditions:** LR-1 + LR-2 merged (one door + tape on program store and all persisted stores) — Stage B builds only on owned stores. The G-1/ownership branch and the athlete-action matrix are merged and armed in test:bible.
- **L11 applies to this build in full:** the athlete-action matrix is an acceptance gate for every stage; extend its day-state dimension with any new states Stage B introduces IN THE SAME STAGE. Sam's phone is the last instrument — device passes are short lists of matrix-proven taps only.
- **The action tape covers everything new:** any writer, door, or derivation Stage B adds emits to the athlete action log from birth (AGENTS.md instrumentation rule — alive on Sam's build).
- **Route (b)/(c) containments release here:** the DELOAD_LAW/name-regex classifier fix (5D.4 / LR-9) is IN Stage B scope — classification reads the workout's own structure (conditioningBlock, template rows), never name regexes. Tests 23/26/28 flip green and their containments are removed in the same commits.
- **Sam's authored content notes land with session rendering:** per-hand annotation for dumbbell work (Farmer Carry precedent), DB-vs-barbell alternative notes where an exercise supports both ("barbell when grip is the limiter"), and a strength-day header line about 2–3 reps in reserve — all Sam-signed copy before shipping.
- **Combined-day semantics are law:** moving/stacking onto team nights lands as combined days (doubling law); the assembler must produce and preserve combined identities the way the doors now do.
- **Generation quality is the acceptance criterion Sam cares most about:** density 5–7 per session, D2 ordering, real variety — "programming is dogshit" was his verbatim on the current output; Stage B exists to end that.

## Explicitly NOT Stage B
The G-1 primer option (parked for buttons), the buttons themselves (step 5), Journal (5C), coach pass (5B), bodyweight/height edit door (step 5), bye-mode ask UI (step 5, seam already wired).
