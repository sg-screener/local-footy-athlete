# CONNECTOR AND DELETION — final report, 2026-08-15, seat `core`

**Branch `slice-weekly-scheduler`, base `main @ 0e43fcfd`.** Worktree-isolated.
The shared checkout's five uncommitted onboarding-copy files were never touched.

---

## 0. VERDICT — **DO NOT MERGE. THE CONNECTOR WAS NOT BUILT.**

| condition | state |
| --- | --- |
| G-2 power violation corrected + guard seen red | ✅ **done, mutation-proved** |
| connector built | ❌ **not started** |
| `deterministicCoachNoteEffects` as append-only provenance | ❌ not started |
| production caller replaced | ❌ |
| zero legacy-planner calls and executions | ❌ **572 executions** |
| legacy planner physically deleted | ❌ **0 lines** |
| three remaining new reds cleared | ❌ still 3 |
| complete chained gate without resets | ❌ |
| 180-world accounting, every changed world attributed | ✅ §4 |
| representative final athlete weeks printed | ✅ §5 |

**The session went to the G-2 correction and its guard.** That was ordered FIRST,
it was a real athlete-safety defect, and my first guard for it could not fail — so
it took a rebuild and a mutation to close honestly. **The connector did not start.**

---

## 1. THE G-2 POWER VIOLATION — CORRECTED

§3, G-2: *"No heavy lower-body or added speed work."*

**The branch placed a lower-body power primer on G-2 and reduced it to one set,
and I printed that reduction as evidence the boundary was working.** A reduced
violation is a violation.

Fixed at both ends, as ordered:

- **the scheduler no longer requests it** — `powerEligible` is false on G-2 for any
  lower purpose, alongside game-day/G-1/G+1;
- **the specialist refuses it even if asked** — typed
  `power_refused_lower_body_on_g2`, because a specialist that would serve an
  illegal request is one caller away from serving it again;
- **omitted, never moved or converted** — the day keeps its strength session and no
  other day gains a primer in its place. Both asserted.

### ⚠ My first guard for it could not fail

It reused the four-day world, **whose G-2 Thursday is an UPPER day** — there was
never a lower-body primer there to forbid. Removing both defences left it green.
Rebuilt on a world that puts a full-body (lower) session on the Thursday before a
Saturday game.

**Mutation receipt** — both defences removed:

    FAIL [WC-050] no LOWER-BODY power primer on G-2, at any dose
    FAIL [WC-050] the G-2 day keeps its strength session — power is OMITTED, not moved
    81/84 → restored from my own backup → 84/84

**That red is also the proof the defect was real.**

### An open distinction, flagged not acted on

The instruction scoped this to LOWER-BODY power, and that is what is built. **The
printed week in front of Sam actually shows `family=upper` on that Thursday** — the
primer he was reading was an upper one. §3's *"or added speed work"* arguably
reaches upper explosive work too. **Not widened unilaterally.**

---

## 2. ZERO-EXECUTION RECEIPT — THE EXACT REMAINING CALLERS

Not grepped. `scripts/probe-planner-callers.ts` wraps `buildCoachingPlan`, reads
the STACK of every real execution over the whole 180-world corpus, and attributes
each to the frame that made it.

    worlds: 180
    buildCoachingPlan EXECUTIONS: 572        TARGET: 0

    EXACT REMAINING CALLERS
      392   src/services/api/generateProgram.ts:686:43
      180   src/services/api/generateProgram.ts:452:44

**Two call sites. Both in `generateProgram.ts`. Nothing else in the generation
path executes the planner.** `coachProgramEdit.ts:2067` and `scheduleDebug.ts:145`
hold references but did not execute in this corpus.

**I am not calling this "one connector away."** It is two named call sites with
counts, and the connector that would replace them does not exist.

---

## 3. DELETION CENSUS

**0 lines deleted.** Unchanged, and still gated: `buildCoachingPlan` (727) plus
`enforceInSeasonPushPullBalance` (206), `scoreStrengthSequence` (44) and
`classifyGenerationAdjacencyRegion` (43) — 1,020 lines — each with internal callers
inside the planner. Nothing is unreachable while the two call sites above execute.

---

## 4. 180-WORLD ACCOUNTING

    BEFORE  main @ 0e43fcfd     142 built / 38 refused
    AFTER   this branch         136 built / 44 refused
    LOST 22 · GAINED 16    (never the net −6)

| | lost | gained |
| --- | ---: | ---: |
| Off-season 3d | 2 | — |
| Off-season 4d | 4 | — |
| Off-season 5d | 8 | — |
| Off-season 6d | 8 | — |
| Pre-season 4d | — | 2 |
| Pre-season 5d | — | 7 |
| Pre-season 6d | — | 7 |

**Attribution:** all 44 refusals are one clause family —
`main_strength_planner_selected_target` (22), `main_strength_permitted_maximum`
(16), `main_strength_required_minimum` (6) — every one §18 judging the composed
week against the LEGACY planner's session count, because `schedulerExposureContract`
is built but not wired. The G-2 fix changed no world count.

---

## 5. REPRESENTATIVE FINAL WEEK

`docs/weekly-scheduler-layouts/README.md`, 12 weeks. In-season, 4 gym days,
athlete 24, Tue/Thu club, Saturday game:

| Day | SCHEDULER: session | purpose/category | Sets | Club/Game | SPECIALIST: conditioning | SPECIALIST: power |
| --- | --- | --- | ---: | --- | --- | --- |
| Mon | lower_squat | aerobic_base (component) | 10 | | Continuous Aerobic Run | primer/lower 2x3-3 |
| Tue | upper_pull | tempo (component) | 10 | club | 30:30 Controlled Tempo Blocks | primer/upper 2x3-3 |
| Wed | lower_hinge | aerobic_base (component) | 10 | | Continuous Aerobic Run | primer/lower 2x3-3 |
| Thu | upper_push | tempo (component) | 10 | club | 30:30 Controlled Tempo Blocks | primer/upper 1x3-3 |
| Fri | rest_or_recovery | — | — | | — | — |
| Sat | game | — | — | GAME | — | — |
| Sun | rest_or_recovery | — | — | | — | — |

**Thursday is G-2. Its primer is `family=upper`** — the lower-body refusal has
nothing to bite on in this particular week, which is exactly why the guard needed a
different world. The G-2 lower case is covered in
`[WC-050] no LOWER-BODY power primer on G-2` against a full-body Thursday.

---

## 6. GATES

    test:weekly-scheduler   84 passed, 0 failures, 41/41 clauses guarded
    test:compile            PASSED — no file regressed
    test:bible:parallel     71 red (main) → 68 red, measured before the G-2 fix

**The 68 hides three regressions** — six suites went green while three broke:
`program-override-ownership`, `athlete-door-matrix`, `main-lift-pattern`.
`game-anchor` **cleared** — it was the flake I flagged as unverified.

**The full chained gate was NOT re-run after the G-2 fix.** That fix touches the
scheduler and the materialiser, so the 68 is a pre-fix number and is labelled as
such rather than carried forward as current.

**No ratchet, floor, ceiling or allow-list reset at any point in this mission.**

---

## 7. WHAT REMAINS — with the two callers named

1. Build the pure connector: schedule + materialised content → `SessionAllocation[]`.
   **21 of 22 fields have a named owner**; the 22nd,
   `deterministicCoachNoteEffects`, is to be an append-only provenance record that
   never affects scheduling or selection.
2. Wire `schedulerExposureContract` (built, proven) and drop
   `weekPlan.weeklyExposureContractV2`.
3. Replace **`generateProgram.ts:686`** (392 executions) and
   **`generateProgram.ts:452`** (180 executions).
4. Re-run `probe-planner-callers.ts` and **require 0**.
5. Delete 1,020 lines; clear the 3 reds; run the complete chained gate.

---

## 8. NOT COVERED

- The connector, and therefore zero executions and deletion.
- The three red suites.
- The full chained gate after the G-2 fix.
- Whether *"added speed work"* on G-2 should also exclude UPPER power (§1).
- The 8 boundary cells plus the 3 new G-2 cells are guarded; only the G-2 pair has
  an individual mutation receipt this session.
- No simulator, no phone.

Agent: core
