# Speed / Late Off-Season Sprint Model Plan (2026-07-09)

Read-only plan. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md` §7 (lines ~1535-1796). Out of scope by instruction: injury/readiness implementation (this plan only *consumes* its gates), Coach Notes, rebuild architecture, deload/progression, conditioning component model.

## A. Plain-English model

Sprint work is quality work, not conditioning: "true speed work should be high quality, low fatigue and done with enough rest… if the athlete is gassed… it has probably turned into conditioning" (Bible :1539). Team training and games ARE sprint exposure — the app's job is to count what footy already provides and top up only the shortfall, fresh and early in the week, never near games, never after heavy lower work, never with an active lower-limb issue. In-season: 2×TT + game ⇒ add nothing. Pre-season: target ~2 sprint/COD exposures/week, mostly from TT; 0 TT ⇒ app adds a session, 1 TT ⇒ one top-up (standalone or warm-up dose), 2+ ⇒ none. Off-season: no sprinting from week 1 — speed enters at the tail end to prepare for pre-season, progressing hills → acceleration → max velocity ("should not start absolutely flat out if they haven't trained speed since footy finished" :1729; "Starting with hill sprints can be best. Can't run as fast and good for mechanics" :1738). COD is deliberately a minor category: occasional, tail-end off-season, simple shuttle format, counted as a hard lower-body exposure (:1616-1648).

## B. Current code gaps (from the verified HEAD audit; line refs approximate)

- **Off-season blanket deny:** `sprint_offseason_no_late_flag` (`coachingEngine.ts:~1984`) with the honest comment "no late-block model yet"; the placement pool also strips sprint pre-emptively (:~2391-2393). No `subPhase` concept exists anywhere in the engine.
- **Pre-season binary deny:** `sprint_covered_by_team_or_game` (:~1985) denies if ANY TT or game exists — no 1-TT exception, no exposure counting. The kernel counts correctly (`weeklyExposureCounts.ts:174-176`: TT/game = 1 each, on-feet sprint = 1, off-feet sprint = conditioning) but the engine never reads it.
- **Built-but-unreachable rescue tiers:** `buildSprintMicroDose` / `buildSprintReducedVolume` (`sessionBuilder.ts:1637-1704`) and Sprint Rescue tier logic (:~3958-3968) never fire — the deny rules empty `rescueEligible` first.
- **No warm-up attachment:** micro-dose exists only as a standalone retrofit; no mechanism prepends it to a strength-day warm-up.
- **Templates:** 3 sprint templates × 3 feels exist ('Free Sprint Session', 'Flying Sprints', 'Max Effort Sprint Accumulation'; accel ladder embedded in the 'flowing' feel) — no hills template, no deceleration/landing work, no progression ordering.
- **No positive tests:** the only sprint tests assert absence (no sprint finishers, rescue drops sprint honestly). Nothing verifies sprint can ever be placed.
- **Good already:** no-sprint-finisher law enforced; G-window/TT-day/TT-adjacent vetting solid; readiness-high gate on standalone sprint; kernel's off-feet-sprint-is-conditioning rule matches the Bible.

## C. Proposed speed/subphase model

### C1. Late off-season detection — MVP recommendation

Options considered: (a) block/week state — knows how long training has run, not how close pre-season is; (b) weeks-until-pre-season — correct signal, needs a date; (c) explicit subphase enum — needs the same information; (d) date relative to phase start — phase start timestamp isn't recorded; (e) onboarding question.

**Recommendation (simplest honest MVP): one profile field, `preSeasonStartDate`** — asked at onboarding when phase = Off-season and editable in profile ("When does pre-season roughly start?"). Derive: `weeksUntilPreSeason`; `subPhase = 'late_offseason'` when ≤5 weeks out (Bible: "tail end… last 3-4 weeks" — 5 gives the ramp a lead-in), `'mid_offseason'` otherwise, `'early_offseason'` for the first ~2 weeks after the phase is set. Unknown date ⇒ default `mid` (sprint stays off — fail conservative), and the profile card can prompt for it. This is a pure read-only derivation — no block/week state changes — and the same field later feeds pre-season early/late (roadmap 3.2) without rework. **Boundary decision for Sam: the ≤5-week threshold and the question wording.**

### C2. Sprint vs hard conditioning — typed taxonomy

A `speedWorkKind` on speed templates/allocations so counters, eligibility and display stop conflating four different things:

| Kind | Nature | Counts as |
|---|---|---|
| `true_speed` (accel, max velocity, hills) | quality, full-ish rest, low fatigue, stop when speed drops | sprint/COD exposure; NOT hard-conditioning credit; still a hard exposure for freshness spacing |
| `repeated_sprint` | incomplete rest, "closer to conditioning" (:1651) | hard conditioning + sprint/COD when on-feet (:1687-1688) |
| `cod` | hard lower-body exposure (:1647), occasional small finisher-style block only | hard lower exposure |
| off-feet "sprint" (assault bike/erg repeats) | off-feet repeat effort, not running speed | conditioning only (kernel already correct) |

In-season nuance preserved: "Prioritise ergo sprints over sprint running in season" (:1708) — in-season top-ups prefer the off-feet form (which therefore does NOT satisfy sprint/COD exposure; it's a freshness-safe substitute, per Bible intent).

### C3. Pre-season exposure counting

Target 2 sprint/COD exposures/week. Count with kernel definitions: TT = 1, game/practice match = 1, on-feet sprint session = 1. Shortfall logic: 0 counted ⇒ up to 2 placements (1 standalone + 1 warm-up dose max); 1 counted ⇒ 1 top-up; ≥2 ⇒ none. Vetoes (all already exist, consumed not rebuilt): readiness gate, injury gate (active hamstring/groin/calf/Achilles/knee/ankle/hip issue denies — supplied by the injury system Codex is wiring; this plan only calls it), G-window, not adjacent to hard TT, not after heavy lower.

### C4. Late off-season progression

When `subPhase === 'late_offseason'`, one speed slot/week (two only if no TT-equivalent exists and readiness is high), progressing by block week (read-only consumption of existing week state): weeks 1-2 hills/acceleration intro (hill sprints or short accels 6-10×10-20m, "crisp not grindy"); weeks 2-3 acceleration volume + deceleration/landing primer; weeks 3-4+ max velocity (flying 20s, 3-5 reps, 2-4min rest) layered on maintained accel; COD only as an occasional small finisher-style block (up-back shuttle, 10-15min) when fresh (:1626-1632); repeated sprint only if the athlete's goal is conditioning (:1741) — and then it books as hard conditioning, not speed. First-time sprinters start smaller: 3-6 accels / 2-4 flyings (:1755-1758).

## D. Placement rules

Fresh and first: speed before any fatigue work, before or well clear of lifting; standalone preferred, warm-up micro-dose acceptable ("can be used at the end of warm-ups before other sessions" :1795). Pairs acceptably before/with upper-body strength; never same-day-after or day-after heavy lower; never G-1/G-2 (48h hard rule, care at 72h :1681-1682); not adjacent to hard team training (:1714); never as a conditioning finisher (existing law stays absolute — COD's occasional finisher-style block is the single, explicitly-typed exception and counts as hard lower); early-week bias in any game week; deny when sore/sick/cooked/low readiness or lower-limb issue active (existing gates).

## E. Implementation slice order

- **SP-A — Pre-season exposure-counted gate.** Replace binary TT/game deny with kernel-counted shortfall logic (§C3); makes rescue tiers reachable. No new inputs needed. **First slice — Codex-ready now.**
- **SP-B — Warm-up sprint micro-dose.** Attachment point prepending `buildSprintMicroDose` to an eligible fresh strength day when the target can't fit a standalone; typed as warm-up `true_speed` (not finisher) so counters/validators classify it correctly.
- **SP-C — Late off-season subphase (MVP).** `preSeasonStartDate` profile field + pure `deriveOffSeasonSubPhase()`; lift the off-season deny only when `late_offseason`; placement pool includes sprint conditionally. Needs Sam's sign-off on threshold + wording first.
- **SP-D — Speed progression templates.** Hills template, deceleration/landing primer, progression selector keyed on block week (read-only); COD occasional block; `speedWorkKind` taxonomy landed here (or split out if SP-A needs it earlier for counting).
- **SP-E — Tests/validator.** Positive-placement suite, taxonomy counting assertions, validator check that any placed speed work satisfies placement rules (fresh-day, spacing, G-window) — validator stays log-only per current policy.

Dependency note: SP-A/SP-B touch only pre-season and are independent. SP-C/SP-D are sequential. Nothing here touches injury/readiness internals — sprint eligibility *consumes* the injury gate that Codex's 4.x work provides; if 4.3B lands first, sprint slots will already be suppressed at generation for lower-limb buckets, and SP slices must not duplicate that check locally.

## F. Tests needed

1. Pre-season 0-TT, no game, high readiness ⇒ 2 speed exposures placed (≤1 standalone + ≤1 warm-up dose); 1-TT ⇒ exactly 1 top-up, not TT-adjacent; 2-TT ⇒ 0; game week ⇒ 0 beyond game.
2. Micro-dose fires: sandwiched-slot fixture reaches the `micro_dose`/`reduced` tiers (currently dead code).
3. Warm-up dose classified `true_speed`, counts 1 sprint/COD exposure, never counts as finisher or conditioning credit; no-sprint-finisher grep-guard stays green.
4. Off-season: early/mid ⇒ sprint still denied (regression); `late_offseason` ⇒ 1 speed session placed; progression order across simulated weeks (hills → accel → max velocity); unknown `preSeasonStartDate` ⇒ mid behaviour.
5. Taxonomy counting: on-feet repeated sprint = hard conditioning + sprint/COD; assault-bike sprints = conditioning only; COD block = hard lower exposure; kernel and engine agree (single-definition assertion).
6. Placement laws: speed never after heavy lower day, never G-1/G-2, early-week bias in game weeks; low readiness / active lower-limb injury ⇒ deny (consume-gate regression, not reimplementation).
7. In-season byte-identical except the ergo-preference top-up path if/when enabled; full board + QA before/after week-shape diffs (expect pre-season and late-off-season diffs only).

## G. Codex-ready first prompt (SP-A)

> **Task: SP-A — pre-season sprint exposure target (exposure-counted gate). READ `docs/LFA_PROGRAMMING_BIBLE.md` §7 (lines ~1535-1796, esp. Pre-season rules ~1709-1724 and Simple rules ~1783-1796) and `docs/SPEED_MODEL_PLAN_2026-07-09.md` first.**
>
> In `src/utils/coachingEngine.ts`, replace the binary standalone-sprint deny `sprint_covered_by_team_or_game` (~:1985) with exposure-counted logic. Compute the week's sprint/COD exposure count using the SAME definitions as `src/rules/weeklyExposureCounts.ts:174-176` (each TT = 1, each game/practice match = 1, each planned on-feet sprint session = 1; off-feet sprint work counts 0) — import/share the definition, do not re-implement it. Pre-season target = 2. Placement rule: if count < 2 AND readiness gate passes AND no active lower-limb injury gate fires (consume the existing injury/readiness gates exactly as-is — do NOT add new injury logic; that system is being wired by another workstream), allow ONE standalone sprint placement via the existing Sprint Rescue path, never TT-adjacent, never in the G-window. This should make the existing `micro_dose`/`reduced` rescue tiers (~:3958-3968) reachable — do not change their internals. Keep every other deny unchanged: off-season blanket deny (`sprint_offseason_no_late_flag` stays — late off-season is slice SP-C), readiness, G-window, TT-day, TT-adjacent, and the absolute no-sprint-finisher law.
>
> **Do NOT touch:** injury/readiness modifier code, Coach Notes, rebuild paths, deload/progression/block-state, conditioning component enum, off-season or in-season sprint behaviour, kernel counter definitions, sessionBuilder templates.
>
> **Tests.** New `src/__tests__/sprintPlacementTests.ts`: (1) pre-season 0-TT no-game high-readiness ⇒ 1 sprint session placed, on a fresh day, not adjacent to heavy lower; (2) 1-TT ⇒ exactly 1 top-up, not TT-adjacent; (3) 2-TT ⇒ none; (4) game + 1 TT ⇒ none; (5) low-readiness ⇒ none (gate regression); (6) sandwiched-slot fixture reaches the micro_dose/reduced tier; (7) grep-guard: no sprint finishers anywhere; (8) off-season and in-season QA scenarios byte-identical (commit snapshots). Full test board + QA before/after week-shape diff in the PR (expect pre-season diffs only); known pre-existing failures per roadmap — do not chase.

## H. Behaviour risk

SP-A: medium — pre-season weeks gain a hard exposure, bounded by the count target and untouched freshness/adjacency laws; off/in-season snapshot-fenced. SP-B: low-medium — warm-up dose is tiny by design, but taxonomy misclassification would corrupt counters (fenced by test 3). SP-C: medium — a new profile input changing generation; fail-conservative default (unknown date = no sprint) and Sam signs the threshold. SP-D: highest content risk — new session types entering a phase that never had them; progression keyed to week state read-only, and each step is low volume by Bible design ("better to do too little than too much" :1614). Cross-workstream risk: double-gating with Codex's 4.3B injury pool suppression — resolved by the consume-don't-reimplement rule in SP-A and a single-definition assertion test.
