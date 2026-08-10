# Publish roadmap — Sam's ordering, 2026-08-05

Sam's ruled sequence to App Store. The review seat maintains this doc;
check items off with commit refs. Supersedes any earlier sequencing where
they disagree (notably: coach rebuild, journal, and day-first UI now land
BEFORE the beta — Sam moved them ahead of TestFlight, and day-first UI is
thereby IN scope for v1, not parked).

## Phase 1 — the rebuild era — **CLOSES 2026-08-07, except the four items
## marked DEFERRED / STILL OPEN below**

**The rebuild era's engine work is on `main`.** Stage B stages 1 + 2 passed
Sam's L10 device pass and merged (`89b540f9`); R5 landed partial-and-honest;
V3 is banked at the one-door boundary. What is left under this heading is
listed openly rather than being closed by rounding — three items were never
started this era, and one is re-slotted by Sam into Phase 2's neighbourhood.

- [ ] **STILL OPEN** — 1a/1b — off-season + in-season derived weeks conform to
      Bible structures (:107/:108/:81). *1a merged earlier (`518a7109`); 1b is
      not claimed here on memory — it is left unticked deliberately.*
- [ ] **STILL OPEN** — Injury substitution — relocate → substitute → reduce
      (:4688, :4755, :1917), matrix-authored only. Not started this era.
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
- [x] **STAGE B STAGES 1 + 2 → MAIN. MERGED 2026-08-07 (`89b540f9`).** The L10
      combined device pass — the gate main waited on — was run by Sam and
      **PASSED**: taps 1/2/3 correct, tap 4 N/A (no coach override exists in
      his state to exercise), tap 5 = programming-quality findings that Sam
      explicitly DEFERRED in the same breath. The gate judged MECHANICS and
      mechanics passed.
      docs/DEVICE_PASS_TAP_LIST_STAGES_1_2_2026-08-07.md
      **Full `test:bible` UNPIPED on main both sides: BEFORE `TRUE_EXIT=0`**
      (green to its last suite, 0 FAIL lines); **AFTER `TRUE_EXIT=1`** at
      `program-control-durable`, 1 FAIL line, same text. Sweep at `89b540f9`:
      **2 of 156 = `program-control-durable` + `fixture-identity` — the
      branch's declared set exactly.**
      **Stated plainly: a green main went to a 2-red main, knowingly.** Payer
      of `fixture-identity` 3/5/6 = the LR-29 replay unit, measured.
- [ ] **DEFERRED, NOT DROPPED** — **THE LR-29 REPLAY UNIT** — the V3 remainder.
      **RE-SLOTTED by Sam 2026-08-07: its measured DEPENDENCY LIST is produced
      now; the unit itself builds AFTER day-first UI, before beta.** It remains
      the named payer of main's declared `fixture-identity` reds.
      Opening law unchanged: the FULL MEASURED DEPENDENCY LIST before any build
      or scaffold. docs/REPLAY_UNIT_KICKOFF_2026-08-07.md
- [ ] **STILL OPEN** — R6 — Release-class measurements, TestFlight build

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
- [x] PARALLEL GATE **STAGE 2 — REFUSED** 2026-08-07, ruled from the
      measurement: ~2 min does not buy a timing-sensitive failure mode on the
      gate that guards everything. The runner is kept as a **NON-OFFICIAL fast
      pre-check** — agents may use it mid-work, **no official verdict ever
      cites it**; the agreement law stays in the chain guarding the shadow.
      **Unit CLOSED, delivered.**
- [ ] SMALL MAINTENANCE (filed 2026-08-07, not now): `runSlice1` runs 21.2s
      against its own 18s warning and 30s hard ceiling — the official gate is
      closer to that wall than the record reflected.

## Phase 2 — the full app (Sam's reorder: before beta)
Order RULED by Sam 2026-08-07: day-first UI → journal → coach.
- [ ] 1. Day-first UI — per docs/DAY_FIRST_UI_DIRECTION_2026-08-01.md
      **KICKED OFF 2026-08-07 (Sam's overnight order), and it now runs BEFORE
      the LR-29 replay unit** — the replay unit was re-slotted behind it.
      Binding alongside the direction doc: docs/HOME_SCREEN_REDESIGN_
      RULINGS_2026-07-30.md (13 Sam rulings — the file is in `docs/`, not
      `artifacts/`) and the signed copy sheet.
      First deliverable: the unit plan with its FULL measured dependency list.
      - [x] Unit plan + measured dependency list —
            docs/DAY_FIRST_UI_UNIT_PLAN_2026-08-07.md
      - [x] **SLICE 1 BUILT AND LANDED 2026-08-08** — the today-first Program
            view: week strip with the game-day anchor, today leading, the day's
            session as a tappable component timeline, **completion SHOWN not
            written** (Sam's fork A), no clock times, a Today/Week zoom control.
            docs/DAY_FIRST_SLICE1_BOUNDARY_2026-08-08.md. **Awaiting Sam's veto
            and a device pass — no device evidence exists yet.**
      - [x] **SLICE 2 + buckets landed** (the projection owns the bucket;
            a day is named by EVERY bucket it carries). Compound day names
            and the chip row are on main.
      - [ ] Later slices — rulings 1-12 remain owed: the repeat-week DELETION
            (1), the bottom button stack split into the icon shortcut row (2-5),
            the intermediate menu's death and the four-action menu (7-9),
            inline exercise editing (12). Ruling 13 is MOOT (R5.7 cut it).
      - [ ] Ruling 11 — the injury "Other" free-text data path. **Its own
            INVESTIGATION, not a UI slice:** Sam asked where a free-text injury
            answer goes, and a stored answer that affects nothing is the worst
            class. Traced with receipts, reported.
- [~] 2. Journal — **BUILT COMPLETE, THEN HIDDEN THE SAME DAY. NOT
      "to be finished".** (Refreshed 2026-08-10 against measured state.)
      Ten slices, all gated, landed 2026-08-08/09; Sam's eye pass killed the
      surface — *"looks really bad... keep the data because it might be
      useful for the coach"* (docs/JOURNAL_HIDDEN_RULING_2026-08-09.md,
      `7f9e54ab`). The tab is removed at the navigation owner; **the data
      layer and every journal suite stay LIVE as coach fuel**, and the two
      data-creating taps ("How did that go?", post-game legs/energy) are
      still athlete-visible. **Sam, 2026-08-10: *"the journal should be
      built but not shown anywhere - we are coming back to that."***
      So this line is neither open nor done: it is BUILT-AND-DELIBERATELY-
      UNREACHABLE, and a sweep must not delete it as dead weight.
      - [ ] The return: redesigned mock-first, post-coach, Sam's call.
      - [ ] LR-18 journal-store retirement still rides that return.
- [~] 3. Coach rebuild — **SLICES 1, 2 AND 3 ARE LANDED; S4 NOT STARTED.**
      (Refreshed 2026-08-10.) The tab talks (`test:coach-tab-slice1`), it
      answers (`test:coach-tab-slice2`, 76 cells), and **it changes things**
      (`test:coach-tab-slice3`, 137 cells) — one action kind, `move_session`,
      through the athlete's own door with undo. `COACH_PROPOSABLE_ACTION_TYPES`
      is `['move_session']` (`src/rules/coachProposal.ts:82`).
      - [ ] **THE GAP IS MEASURED, NOT ESTIMATED: 1 of 26.**
            docs/COACH_PARITY_CENSUS_2026-08-10.md counts the coach against
            the athlete's own 26 action types (`LAW-LC4-parity`). That census
            is the build order, and it is the honest size of "coach rebuild".
      - [ ] S4 — *it knows how you're tracking*. Not started. The journal's
            record (load, regions, feel, niggles) is its input, which is why
            the journal data layer stayed live.
      - [ ] LR-6 lifts, MetCon rename, free text — all still owed.
      - [ ] **NOTHING IS ON GLASS.** No coach slice has been seen on a
            device; the scope chooser has never been tapped and the undo
            toast over a coach move is OPEN-UNKNOWN.

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
