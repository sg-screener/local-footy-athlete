# Bye-Week Generation Cleanup Plan (2026-07-09)

Read-only plan. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md` (:74 bye handling, :131 "train harder mini pre-season OR a really good time to rest and recover i.e. bigger deload week", :1677 repeated sprint "bye week if extra work is appropriate"). Out of scope by instruction: recovery_addon, injury/readiness, speed/sprint, Coach Notes, QA-harness implementations, rebuild architecture. Bye-week generation *consumes* those systems' outputs (readiness tier, sprint gates, note proofs); it changes none of them.

## A. Plain-English bye-week model

A bye week is an **in-season week without a game — not a mini off-season and not an automatic deload.** The athlete stays in season rhythm: team training days remain anchors, in-season caps still apply, and season fatigue is respected. What the bye offers is one degree of freedom the game week doesn't have — the Saturday slot and the G-window disappear — so a healthy athlete can take a modest top-up (a real hard conditioning session on Saturday, or extra lower-body strength, per Bible :74), while a cooked, sore, or injured athlete uses the same week as a genuine breather. The choice is driven by readiness, not by the calendar: "If user is feeling good then training load can increase… Again, this depends on user readiness" (:74). Two modes, one decision input: **top-up bye** (healthy) and **lighter bye** (readiness/injury says back off). Deload stays its own concept — a bye coinciding with a block's deload week is possible later but is the deload system's call, never the bye branch's.

## B. Current code gaps (verified at HEAD)

- **Detection works:** bye = `isInSeason && !hasGameThisWeek`; dedicated no-game branch in `coachingEngine.ts` (~:1047-1206) re-optimizes without game constraints, Sunday forced to recovery, TT days anchor with push/pull pre-assignment.
- **Saturday is a label, not a session:** the no-game Saturday gets lower-body strength with a "conditioning emphasis" **semantic label only** — no conditioning category, duration, or metadata; actual conditioning placement happens downstream and nothing guarantees the Saturday hard-conditioning slot the Bible describes. This is the roadmap's "fake conditioning emphasis" gap, confirmed live.
- **One mode only:** the branch has no readiness input — every bye is the same shape regardless of cooked/sore/injured state. The Bible's dual mode (:131) is unimplemented on the "rest" side.
- **`byeWeek` validator flag declared, never passed by production callers** (only tests); it exists to downgrade overshoot severity and suppress undertraining nags on bye weeks — so today's validator findings on bye weeks are mis-toned in both directions.
- **No sprint/COD awareness:** the branch doesn't consult TT-provided sprint/COD exposure when shaping the week (it doesn't add sprint either — the global gates stop that — but the shape can't take the 1-TT "one useful exposure" option deliberately).
- **Deload interaction correct by accident:** `resolveWeekKind` returns 'build' for in-season (by 3.4a design), so no conflict today — but no precedence rule is written down for when in-season deload arrives (3.4c).
- **Coverage gaps:** QA has S4 (in-season no game) and E1 (remove game) with global assertions only — no bye-specific expected shape; no cooked-bye persona. Overlays are week-scoped with leakage guards tested (`gameChangeLocalRebuildTests`) — good, keep asserting it.
- Watch item (old audit, re-check in slice A): gunshow/accessory occasionally classifiable as main strength via the 'Upper Body Pump' taxonomy fallback — matters more on bye weeks where a third "strength-ish" slot appears.

## C. Proposed bye-week shapes

**A. 2 TT, no game (the common case):** TT Tue/Thu anchors (count as hard + sprint/COD); 2 main strength sessions; optional third low-fatigue slot (gunshow/prehab/recovery — optional tier, never counted as main strength); ≤1 conditioning top-up placed where legal; **no added sprint** (TT covers it); Saturday per §D; Sunday recovery stays.
**B. 1 TT, no game:** as A, plus the week MAY take one extra useful exposure (field conditioning or speed) if healthy — the shape requests it, existing eligibility gates decide; recovery day preserved.
**C. 0 TT, no game:** app may add conditioning/speed exposure carefully — target the in-season dose ceiling, not off-season volume (hard days still ≤4); at least 2 rest/recovery days.
**D. Cooked/injured bye (lighter mode):** consume the week-scope readiness tier / injury band (read-only): no top-up work generated, Saturday becomes recovery/easy aerobic, optional tier widely applied — "byes can be a good time to reset and rest and prepare for future weeks" (:74). Never force top-ups; never generate what the constraint systems would strip.

## D. Saturday/no-game rules

Saturday becomes a **typed slot with real metadata**, chosen by mode and load: (1) healthy + conditioning headroom ⇒ hard conditioning **component** with genuine category/duration metadata (vo2/glycolytic per the Bible's "hard conditioning session is usually a good idea" :74) — placed through the normal category eligibility path; (2) healthy + strength-biased week ⇒ gym top-up (lower-body strength, the Bible's "good time to get in extra… lower body work"); (3) moderate load ⇒ aerobic base; (4) lighter mode ⇒ recovery/mobility. Hard rule: **if the session says conditioning, it carries a conditioning block with category, duration, and exposure credit — no label-only "emphasis"**. The current lower-strength+label Saturday is retired.

## E. Hard-day/exposure rules

Bye-week caps are in-season caps, not off-season: hard days target 3-4; 5 only with explicit justification (high availability + high readiness + low TT load); 6+ = validator strong warning/fail. TT counts as hard and as sprint/COD (kernel already does this — the bye shape must consume those counts, not re-count). Conditioning exposures must be real placements with metadata (they carry credit; labels don't). No extra sprint when TT count ≥2; ≤1 speed exposure at 1 TT; careful additions at 0 TT — all requested through existing gates, never bypassing them. Validator: pass `byeWeek` at the call sites so its overshoot-downgrade/undertraining-suppression semantics finally apply, and add the 6+ hard-day strong warning under the flag.

## F. Implementation slice order

- **BW-A — Classification + flag + shape audit (first, Codex-ready now).** Verify/centralize bye detection (one `isByeWeek` used by engine and validator); pass `byeWeek` at all validator call sites (log-only stays log-only); audit tests snapshotting current bye shapes for S4/E1-style configs (baseline for every later slice); re-check the gunshow-as-main-strength fallback on bye configs and report.
- **BW-B — Saturday metadata fix.** Retire the label-only Saturday; implement the typed slot (§D) for the healthy path only (modes come next); conditioning option goes through normal category eligibility.
- **BW-C — Generation shape cleanup (modes).** Two-mode branch consuming week-scope readiness tier/injury band read-only; shapes per §C A-D; hard-day targets per §E.
- **BW-D — Validator/QA expectations.** Bye-specific expected shapes + allowed findings for the QA scenarios (S4, E1, new cooked-bye persona) — coordinate with the QA cleanup workstream's registry if it has landed; otherwise plain assertions in the existing harness style.
- **BW-E — No-leakage tests.** Extend the week-scoping guarantees: bye-week changes (Saturday slot, mode) provably do not alter adjacent or future game weeks; game re-added onto a bye restores the game-week shape byte-identically.

## G. Tests needed

BW-A: bye detection truth table (in-season no-game ⇒ bye; game week ⇒ not; off-season no-game ⇒ not); validator receives `byeWeek=true` for bye configs (and false otherwise) at every call site; current-shape snapshots committed. BW-B: bye Saturday with conditioning ⇒ real category + duration + exposure credit (kernel counts it); no session anywhere carries a conditioning label without a conditioning block (global assertion — this guards the whole codebase, not just Saturday); strength-Saturday variant counts as strength, not conditioning. BW-C: shapes A-D as fixtures (2TT/1TT/0TT/cooked) — hard-day counts within caps, TT sprint/COD consumed not duplicated, no added sprint at 2TT, lighter mode generates no top-up; reconciliation with constraint systems (cooked bye projected through active constraints ⇒ zero removals). BW-D: 6+ hard days on a bye ⇒ strong warning; undertraining nag suppressed on lighter-mode bye. BW-E: rebuild a bye week ⇒ adjacent game weeks byte-identical; add-game-onto-bye and remove-game round-trips (extend `gameChangeLocalRebuildTests` patterns). All slices: full board + QA week-shape diffs (expect S4/E1 diffs only).

## H. Codex-ready first prompt (BW-A)

> **Task: BW-A — bye-week classification, validator flag pass-through, and shape audit. READ `docs/LFA_PROGRAMMING_BIBLE.md` bye rules (:74, :131) and `docs/BYE_WEEK_CLEANUP_PLAN_2026-07-09.md` first. This slice must not change any generated week — it establishes truth and wiring.**
>
> 1. Centralize detection: extract the existing bye condition (`isInSeason && !hasGameThisWeek`, no-game branch in `src/utils/coachingEngine.ts` ~:1047) into one exported helper (e.g. `isByeWeek(inputs)`) used by the engine branch AND by validator flag derivation — one definition, no duplicates.
> 2. Pass `byeWeek` at every `weekStructureValidator` production call site (the flag is declared and consumed by the validator's overshoot-downgrade/undertraining-suppression logic but never passed by production code — verify and cite each call site in the PR). The validator stays log-only; only the flag wiring changes.
> 3. Shape audit baseline: add `src/__tests__/byeWeekShapeTests.ts` that generates in-season no-game weeks for 2TT/1TT/0TT configs and SNAPSHOTS their current shapes (per-day session kind/tier, hard-day count, conditioning placements with their metadata or lack of it, Saturday session composition). These snapshots intentionally capture today's flaws (label-only Saturday) — do NOT fix them in this slice; they are the baseline the next slices diff against.
> 4. Re-check and report (PR description only, no fix): whether gunshow/accessory sessions can classify as main strength in bye configs via the taxonomy fallback ('Upper Body Pump' hole from the earlier audit).
> 5. **Guarantees:** generated weeks byte-identical before/after (the only behaviour change permitted is validator finding tone on bye weeks from the flag — list every finding whose severity changed in the PR); do NOT touch the no-game branch's allocations, Saturday session, recovery_addon, injury/readiness, sprint, Coach Notes, QA harness internals, or rebuild code. Full test board; known pre-existing failures per roadmap — do not chase.

## I. Behaviour risk

BW-A: near zero — wiring + snapshots; the only visible change is honest validator tone on bye weeks. BW-B: medium — Saturday changes for every bye week; fenced by the BW-A baseline diff and by routing conditioning through existing eligibility (no new placement law). BW-C: medium-high — the most user-visible slice (bye weeks get modes); fenced by fixtures per shape, the reconciliation check against constraint systems, and consuming readiness/injury outputs strictly read-only. BW-D/E: low, test-surface. Cross-workstream guard: three in-flight systems (readiness tiers, sprint gates, deload week-kind) all touch bye weeks — the bye branch must stay a *consumer* (requests exposures, reads tiers/kinds) and never re-implement their rules; if a bye slice needs a rule those systems don't yet expose, stop and flag rather than inline it (AGENTS.md escalation rule).
