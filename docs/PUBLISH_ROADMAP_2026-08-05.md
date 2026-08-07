# Publish roadmap — Sam's ordering, 2026-08-05

Sam's ruled sequence to App Store. The review seat maintains this doc;
check items off with commit refs. Supersedes any earlier sequencing where
they disagree (notably: coach rebuild, journal, and day-first UI now land
BEFORE the beta — Sam moved them ahead of TestFlight, and day-first UI is
thereby IN scope for v1, not parked).

## Phase 1 — the rebuild era (in flight)
- [ ] 1a/1b — off-season + in-season derived weeks conform to Bible
      structures (:107/:108/:81)
- [ ] Injury substitution — relocate → substitute → reduce (:4688, :4755,
      :1917), matrix-authored only
- [x] R5 — delete the ~11k legacy machinery, census closures, structural
      sweep. **PARTIAL AND HONEST (2026-08-07):** R5.1/5.2/5.7/5.8 landed;
      **R5.4/R5.5/R5.6 are DEFERRED to the LR-29 replay unit** by Sam's
      Option B carve-out (they touch the stored-declaration read path and
      its writers). V3 is **BANKED at the one-door boundary, not closed**.
      Census: declared debt 77 at a tightened baseline, founding 120.
      docs/R5_BOUNDARY_REPORT_2026-08-07.md
- [x] Sam's combined device pass = THE MERGE GATE. **MET 2026-08-07** —
      5/5 testable taps passed, four items converted to WATCH-FORS.
      **MERGED** into feat/stage-b-stage2 (`75fb71df`); the target's
      declared set after = the boundary report's exactly (2 of 156).
      Known-imperfect stands: `fixture-identity` 3/5/6, payer = the
      replay unit.
- [ ] **THE LR-29 REPLAY UNIT** — the V3 remainder; next ENGINE unit.
      Opening law: the first act is the FULL MEASURED DEPENDENCY LIST,
      before any build. docs/REPLAY_UNIT_KICKOFF_2026-08-07.md
- [ ] R6 — Release-class measurements, TestFlight build

## Phase 1.5 — first post-merge unit (Sam approved 2026-08-07)
- [x] PARALLEL GATE **STAGE 1 DONE** 2026-08-07 — gate.sh (item 1, already
      landed) + `test:bible:parallel` + the AGREEMENT LAW, mutation-checked
      6/6. **4 agreement runs, all AGREE** (jobs 8/4/10/8) at the branch's
      declared 2-of-158 set. `test:bible` untouched and still the only
      official gate. docs/PARALLEL_GATE_SHADOW_UNIT_2026-08-07.md
      **THE "20 min → 3-5 min" PREMISE IS REFUTED BY MEASUREMENT:** the full
      158-unit serial set is **257.7s**, parallel **111-128s**, speedup
      **2.0-2.3x**; the chain as felt today is **115s** (it short-circuits at
      the declared red). The saving is ~2 min, not ~16.
      **NOT "suites are independent" either** — the agreement law caught
      `runSlice1` asserting on its own WALL-CLOCK runtime (43.5s under load vs
      a 30s hard ceiling). It now runs exclusive; the ceiling was not raised.
- [ ] PARALLEL GATE **STAGE 2 — STOPPED FOR SAM.** Flipping the official gate
      to the parallel runner was scoped as the first commit after the merge,
      but its stated payoff was the refuted 20-minute figure. Worth ~2 min per
      commit against a new failure mode (timing-sensitive suites). Sam's call.

## Phase 2 — the full app (Sam's reorder: before beta)
Order RULED by Sam 2026-08-07: day-first UI → journal → coach.
- [ ] 1. Day-first UI — per docs/DAY_FIRST_UI_DIRECTION_2026-08-01.md
- [ ] 2. Journal — finished to JOURNAL_DESIGN_2026-07-23 (storage proven
      in R4; LR-18 journal-store retirement rides this unit)
- [ ] 3. Coach rebuild — free-text coach on the clean shell (LR-6 lifts;
      propose decision → diff → accept → derive; MetCon rename lands
      here)

## Phase 3 — beta
- [ ] Renee + 2-3 trusted athletes on TestFlight
- [ ] Sam trains off the app for a real week
- [ ] Beta findings fixed (size unknowable until it happens)

## Phase 4 — App Store
- [ ] v1 accounts decision: local-only vs sign-in (old roadmap: local-only
      AU/NZ v1)
- [ ] Listing: screenshots (SCREENSHOT_STORYBOARD), description, privacy
      labels + policy page
- [ ] Submit for review (1-3 days, allow a rejection round)

## Sam's signing queue (non-blocking, any time)
- [ ] 23 pending conditioning cues + Easy Swim
- [ ] Per-quality warm-up copy
- [ ] Beta-prompted rewording
