# Finisher Variety & Erg-Default Investigation — 2026-07-09

READ-ONLY investigation. No code changed. Companion to `ROOT_CAUSE_OFF_SEASON_BASELINE_2026-07-08.md` (which confirmed the "Full Body" labels were a display bug — Codex is fixing that separately). This report covers the REAL remaining issue: conditioning finisher monotony and the 20min-straight-erg default.

---

## A. Plain-English root cause

On a 4-day off-season week the engine books all 4 days as strength (core = 4, off-season high readiness). The conditioning target is `max(core, 4) = 4` and the hard floor is 2 — but there are **zero free slots** for standalone conditioning. The only way the engine can put conditioning anywhere is to bolt a finisher onto a strength day. Each finisher only counts 0.75 toward the target, so 4 finishers = 3.0 < 4 — **the deficit never clears, so the S+C bonus stays switched on for every single slot and every strength day gets a finisher.** There is no "skip finisher" outcome anywhere: even when the eligibility law DENIES a finisher, the main loop attaches an easy aerobic one anyway.

Then the safety rules funnel almost every finisher into the same bucket: lower/hinge/full-body days are always downgraded to easy off-feet aerobic; low readiness, game windows, and team-day adjacency also end at easy aerobic; denied sprint requests ladder to tempo. So the realistic finisher menu is **aerobic_base (most days) and tempo (some upper days)**.

Finally, the aerobic_base finisher has exactly **one template shape**: a single continuous 20–25min zone-2 block on one erg. No interval variant, no feel variation (the `feel` parameter is ignored for aerobic_base), no participation in the mini-cycle template rotation that standalone conditioning enjoys. Modality rotates (bike/row/ski) and duration flips 20↔25 — that's the entire variety budget. Hence: "every strength day ends with 20min steady on an erg."

## B. Current code paths

**Engine — who decides a finisher exists and what category it is** (`src/utils/coachingEngine.ts`):

| Thing | Location |
|---|---|
| core = {4,4} off-season high readiness | 414–417 (`getCoreSessionCount`) |
| condTarget = max(core, 4), clamped 3–5 | 1279–1299 |
| MIN_COND_FLOOR = 2 (1 pre-season w/ team days) | 1306 |
| Scorer: S+C mandatory bonus when floor unreachable via standalone; penalty on pure strength | 2503–2536 |
| `finisherEligibility()` — shared law, 4A/4B | 1867–1973 |
| — sprint→tempo downgrade ladder | 1887–1892 |
| — lower/hinge/full → easy aerobic always | 1930–1936 |
| — hard upper allowed only readiness ≥ medium AND high-days < 4, else tempo | 1964–1970 |
| — allow:false only for: G0/G-1, pre-season team day, standalone sprint denials | 1896–1908, 1942–1947 |
| In-loop S+C placement (attach point 1) | 3230–3295 |
| — **denied finisher still attaches easy aerobic**: `decision.allow ? decision.category : 'aerobic_base'` | **3240** |
| H5a floor rescue: converts pure strength → S+C (attach point 2; respects allow:false) | 3435–3506 |
| H5b: promotes ACC/REC → standalone conditioning (attach point 3) | 3508–3624 |
| Sprint Rescue (standalone-only, never a finisher) | 3626–3766 |
| `buildCondLabel` — ONE hardcoded label string per category | 2961–2991 |
| — "easy off-feet aerobic finisher (bike/row/ski, 15-20min)" | 2966–2969 |
| Zone category priorities (early sprint/vo2, late aerobic; tempo deliberately absent — downgrade-ladder only) | 2204–2232 |

**Templates — what the finisher actually contains** (`src/utils/sessionBuilder.ts`):

| Thing | Location |
|---|---|
| Combined-day duration cap (target 22, max 30) | 1147–1150 |
| `buildCombinedConditioningTemplate` | 1182–1444 |
| — **aerobic_base: single shape, 20 or 25min continuous zone 2 erg** | **1227–1238** |
| — tempo: 2 shapes (30:30 blocks / 1min-on-1min-easy), feel-driven | 1239–1274 |
| — sprint: erg power sprints (lower pairing) or 3 running variants | 1276–1345 |
| — vo2: 3 feel variants | 1346+ |
| `buildReducedAerobicBase` — 20/25/30min easy erg flush | 1152–1172 |
| Standalone pool per category + mini-cycle block rotation — **aerobic_base is 1:1 'Long Nasal Run', no pool** | 939–995 |
| Legacy easy templates: 'Easy Bike' = 20min easy bike, 'Easy Row' = 15-20min easy row | 1955–1965 |
| `switchToOffFeetModality` (run→erg conversions) | 2101+ |

**Week assembly — modality/feel rotation** (`src/data/defaultProgram.ts`):

- 1026–1144: weekly erg-repeat-avoidance (bike/row/ski/mixed pool, avoids same erg twice per week and yesterday's erg) + per-session feel assignment (grindy/sharp/flowing by hash when engine leaves it blank). **This rotation works — but for aerobic_base finishers it only changes which machine you sit on for the same 20–25min steady block.**
- 1067–1073: forced 'Bike/Row/Ski Tempo Intervals' when engine ruled tempo off-feet.
- Run-load guard: 3rd consecutive run-exposure day converts to off-feet (another source of erg days).

**Whether every eligible strength day automatically gets a finisher: effectively yes on short weeks.** Scorer bonus (2503–2536) keeps firing while the deficit is open (it can never close on a 4-day week), H5a mops up anything the loop missed, and line 3240 attaches even denied finishers. Off-feet fallback: `useNonRunning = isLower(strength)` (3248–3249, 3486–3489) — every lower/full finisher is erg by construction, plus tempo finishers are erg-based always (defaultProgram 1099–1105).

## C. What is genuinely wrong

1. **No skip path.** `finisherEligibility` has no "deny because the week already has enough conditioning" rule, and the in-loop S+C path (3240) overrides even the denials that do exist by silently substituting easy aerobic. Downgrade-before-drop was the 4A design intent, but "drop" was never built.
2. **Unreachable target = permanent attach pressure.** `condTarget = max(core, 4)` with 0 standalone slots and 0.75 credit per finisher is mathematically unsatisfiable on a 4-day all-strength week. The scorer treats "can't reach target" as "add more finishers" forever, instead of recognising a structural ceiling.
3. **aerobic_base has one shape.** One continuous zone-2 block. The `feel` parameter is accepted and ignored for this category (sessionBuilder 1227–1238). Standalone conditioning got a 5-axis rotation (template pool × mini-cycle × feel × erg × duration); the most common finisher category got none of it except erg + 20/25.
4. **Label/template mismatch.** Label says "15-20min" (coachingEngine 2968); the template builds 20 or 25min (sessionBuilder 1229). Small, but it's the kind of dishonesty the 4A label-honesty pass was meant to kill.
5. **Category funnel.** The protective rules are individually correct, but their composition means finishers can essentially only ever be aerobic_base or tempo. Nothing wrong with the safety — what's wrong is that within those two categories there's no menu.

## D. What is just unfinished (not wrong)

- **Finisher template pools / rotation** — never built; 4A/4B explicitly deferred this ("finisher variety pool BLOCKED on Sam's Bible rulings", 2026-07-08 baseline report).
- **Carries / trunk conditioning / mobility-prehab as finisher types** — `CondCategory` is 5 energy systems only; there is no "non-energy-system finisher" concept. ACC days have "trunk, calves, groin, shoulder prehab" copy but that's a standalone optional day, not a finisher.
- **Off-feet-first everywhere outside pre-season** (`standaloneTempoOffFeet`, engine 1851–1865) — deliberate v1 conservatism, documented, awaiting a real block/subphase model.
- **Tempo pool depth** — 2 combined shapes / 4 standalone templates is thin but new (4B shipped yesterday); it's seed stock, not a bug.
- **Mini-cycle rotation not threaded to combined days** — standalone gets `miniCycleNumber` rotation; finishers don't. Extension, not repair.

## E. Bible — status and proposed wording

**The Bible is NOT in the repo.** Confirmed by search: "LFA Programming Rules" appears only in `DEV_DIARY.md:504`; `src/rules/` encodes caps/taxonomy/stress but contains **no rule about finisher variety, erg monotony, long-steady-state limits, or when to skip a finisher**. Nothing currently forbids a 20min straight erg on every day — the engine is compliant with every written rule we have encoded.

Proposed wording for Sam to adapt (new Bible section, "Conditioning Finishers"):

> **F1 — A finisher is a garnish, not a meal.** Finishers are 8–20 minutes. Anything longer is a conditioning session and must justify its own slot.
>
> **F2 — No default. Every finisher must earn its place.** A strength day gets a finisher only when the week's conditioning need calls for it. When weekly conditioning exposures (standalone + finishers + team training + game) already meet the week's need, strength days end after the lift — finishing a session with nothing is a valid prescription.
>
> **F3 — Long easy aerobic (15min+ continuous) is allowed at most TWICE per week across all finishers, and never on consecutive training days.** Its jobs are: flush after a heavy lower day, easy volume for a poor aerobic base, or deload/low-readiness weeks. It is not filler.
>
> **F4 — Prefer short intervals over long steady state when the goal is stimulus, not recovery.** On upper days with normal readiness, a 10–15min interval finisher (tempo 30:30s, 1min on/offs, short erg repeats) beats 20min steady. Steady state wins only when the goal is recovery/flush or aerobic-base building.
>
> **F5 — Rotate conditioning MODE across the week, not just the machine.** Across any week the finisher set must include at least two distinct modes from: continuous easy, tempo/controlled intervals, short hard intervals (readiness permitting), loaded carries / trunk circuit, mobility-prehab. Bike→row→ski on the same 20min steady block is machine rotation, not mode rotation, and does not satisfy this rule.
>
> **F6 — Bike/row/ski are tools for leg-sparing, not the identity of conditioning.** Off-feet is mandatory after heavy lower work and when protecting running load; on upper days with fresh legs and no running conflict, running-based or mixed-mode finishers are preferred so the week doesn't feel like an erg subscription.
>
> **F7 — Skip / downgrade ladder.** Order of preference when a finisher request can't be granted as asked: downgrade the category one rung → shorten it → convert it to carries/trunk or mobility → **skip it**. Skipping is the correct outcome on: G-1/G0 (already law), the day before the week's hardest lower day, low readiness after two+ hard days, and any day where the finisher would be the week's 5th+ conditioning exposure.
>
> **F8 — Lower/hinge days:** off-feet only, easy or short-controlled, ≤ 15min — or a 8–10min flush / nothing. Never intervals that turn a lower day into a mixed high day.
>
> **F9 — Upper days:** carry the week's quality finishers (tempo or short hard intervals) when readiness and hard-day headroom allow; otherwise tempo; otherwise skip rather than steady-state by default.
>
> **F10 — Full-body days:** treat as lower for finisher purposes (F8).
>
> **F11 — Game weeks:** max ONE finisher in the week, easy only, no finisher G-2/G-1/G0 (G-2 easy-only is already law; this adds the weekly cap).
>
> **F12 — Team-training-adjacent days:** nothing hard (already law); prefer carries/trunk/mobility over yet another easy erg when a finisher is warranted at all.
>
> **F13 — Phase defaults:** Off-season = the variety showcase (rotate modes weekly; erg steady ≤ 2/week). Pre-season = field/team days carry conditioning; gym finishers short and mostly skipped. In-season = finishers are recovery flushes or trunk work only; conditioning stimulus comes from games + team training.

## F. Recommended fix order

1. **E (Bible)** — Sam finalises wording above. Everything else keys off it. (No code.)
2. **B (skip-finisher rule)** — highest behaviour-per-line: kills "finisher on literally every day", fixes the line-3240 override. Small, testable.
3. **A (template pool / label variety)** — aerobic_base finisher gets 3–4 shapes + feel support; labels come from the pool; fixes 15-20 vs 20-25 mismatch.
4. **C (mode rotation)** — week-level memory so the same finisher shape doesn't repeat across days; thread mini-cycle rotation into combined days.
5. **D (carries/trunk + mobility finishers)** — new finisher kinds outside the 5 energy systems; biggest type-surface change, do last.
6. **F (tests)** — grown alongside each slice, plus a final week-level variety QA assertion.

## G. What Codex can implement after approval

**Slice A — finisher template pool & label variety.** In `buildCombinedConditioningTemplate` aerobic_base case: pool of shapes (continuous 15-20min; 3×5min w/ 1min easy; 20-30s on / 90s off "flush intervals"; mixed-erg 2×8-10min), selected by feel + hash/mini-cycle. `buildCondLabel` derives duration text from the same source the template uses (single source, no drift). Tempo pool +1–2 shapes. Touches: sessionBuilder.ts, coachingEngine.ts labels, finisherEligibilityTests.

**Slice B — skip-finisher rule.** `finisherEligibility` gains a week-context arg (conditioning exposures so far incl. team days/game) and a new outcome `{ allow:false, reason:'week_covered' }` per Bible F2/F7; fix line 3240 so `allow:false` means NO finisher (strength session stands alone); cap attach pressure by treating condTarget as satisfiable-at-ceiling on all-strength weeks (floor stays enforced — the fix must NOT reopen the "0 conditioning" hole H5a exists to close; keep floor ≥ 2 exposures counting team days per current kernel rules). Touches: coachingEngine.ts only.

**Slice C — mode rotation.** Week-level `usedFinisherShapes` set (mirror of `usedErgs` at defaultProgram 1032) threaded into template building; mini-cycle rotation for combined days; assertion that a week never carries 3+ identical finisher shapes. Touches: defaultProgram.ts, sessionBuilder.ts.

**Slice D — carries/trunk + mobility finishers.** New finisher kind alongside CondCategory (e.g. `finisherKind: 'energy' | 'carry_trunk' | 'mobility'`) so it doesn't pollute energy-system coverage counting or stress classification (carry/trunk = low-medium stress, never a hard exposure). Eligible: upper days, team-adjacent days, in-season. Templates: farmer/suitcase carry circuits, sled push if available, trunk circuit. Touches: types, sessionBuilder templates, finisherEligibility ladder (insert above "skip"), taxonomy so kernel doesn't misclassify.

**Slice E — Bible rule additions.** Encode F1–F13 constants in `src/rules/` (weekly steady-erg cap, weekly finisher cap in game weeks, mode-variety minimum) + validator findings (findings-only first, per the Phase-2 pattern).

**Slice F — tests.** See H.

## H. Tests to add

1. `finisherEligibilityTests`: week-covered denial — 4-day off-season week where team days/game already satisfy conditioning → at least one strength day has NO finisher.
2. Regression on line-3240 fix: a denied decision never yields `hasCombinedConditioning: true` from the in-loop path; floor still met via H5a when genuinely short (the S6 "0 conditioning" case must stay green).
3. Template pool: aerobic_base combined builder returns ≥3 distinct shapes across feels/hashes; every shape ≤ CONDITIONING_DURATION_CAP.combined.max; label duration text matches built template duration.
4. Week variety invariant (weekPlanQA): no week with ≥3 finishers has all finishers with identical shape+category; steady-continuous erg finishers ≤ 2/week and non-consecutive (Bible F3).
5. Mode rotation: two consecutive weeks (mini-cycle N, N+1) produce different aerobic finisher shapes for the same weekday.
6. Carry/trunk finisher (slice D): never on lower/hinge days after heavy lower... actually allowed post-lower per Sam's ruling — gate per final Bible text; never counts as hard exposure; kernel taxonomy classifies it as gym_support not conditioning.
7. Game week: ≤1 finisher total, easy only (extends existing H-GAME tests).
8. Label honesty: buildCondLabel output text and built template agree on duration and modality for every category × useNonRunning combination.

---
*Sources: coachingEngine.ts (finisherEligibility 1867, buildCondLabel 2961, S+C loop 3230, H5a 3435, H5b 3508, Sprint Rescue 3626), sessionBuilder.ts (buildCombinedConditioningTemplate 1182, pools 939, caps 1147), defaultProgram.ts (erg/feel rotation 1026–1144). Bible absent from repo — confirmed via full-text search.*
