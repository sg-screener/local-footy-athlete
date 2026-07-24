# Durable athlete-state Phase 2 — the partial-week generator (build report, 2026-07-24)

Executes the parked Option B Phase 2 per
`DURABLE_ATHLETE_STATE_FACT_OWNERSHIP_REASSESSMENT_2026-07-24.md` (+ Addendum
A), `SECTION18_DELIVERED_VS_REMAINING_REASSESSMENT_2026-07-24.md` (+ Addendum
B), and the Stage 1/2a reports. Status: **gates green, dual-seed sim pass
clean, awaiting Sam device acceptance** (L4: the phone is the arbiter).
Merged to main `--no-ff`; branch `feat/durable-athlete-state-ownership`.

## The blocker, broken (D1+D2)

`generateProgramLocally` gains `remainderBoundary {governedFromISO,
pinnedHistoryWorkouts}`. The ONE boundary owner
(`stampSection18GovernedBoundary`, weeklyExposureContractV2.ts) stamps the
contract and marks pre-boundary anchors `'delivered_history'` — settled
participation no later safety pass may demote; derived demotions minted after
the day elapsed are undone (D10: retroactive credit withdrawal). The candidate
week pins the athlete's actual days, so §18 acceptance evaluates delivered
history + authored remainder — the remainder is authored AS a remainder. The
scoped regen stamps `firstShapedDateInWeek(fact, weekStart)` and drops
pre-boundary overlay keys (byte-exact preservation via base fallthrough).

Evaluator changes, all one principle (§18 governs what the app prescribes for
the remainder): `prohibitedSprintHighSpeed` and injury/power prohibitions bind
`split.appPrescribed`/`split.prescribed`; `strength_pattern_count` reductions
and `prohibited_pattern_breach` skip history days; weekly pattern coverage is
advisory for boundary-partial weeks. M3 redefined to the B4 mutant
(credit-withdrawal-without-reduction) — its old premise contradicted D10, a
dependence both parked reports flagged.

**T4 ×3 green; the L6 empties-Done defect is dead. `test:fact-horizon` (now
14 invariants) un-quarantined into `test:bible`.**

## Deliverables 3-8

- **D3** — `hasFieldRestriction` no longer includes any injury region: with
  sprint governance app-only, the lower-body coupling that defeated four
  decoupling attempts dissolves. I3 8/8 regions×severities, I4 (B4 atomicity)
  green. Injury gains its rider-1 materialisation owner: new injury
  constraints route through the scoped regen; the committed week visibly
  stops prescribing affected work (I6). Injury horizons start at
  `onsetOrReportedDate`, never the affected week's Monday. Facts still commit
  via projection when no program exists. `test:injury-authority` 17/17,
  un-quarantined into `test:bible`.
- **D4** — A3a materialisation pinned at the real program-tab projection:
  after a Friday severe illness, NEXT week's sessions are visibly optional.
- **D5** — A1 pinned: the sick commit succeeds on a game week; the live game
  day, its marking and content survive byte-identical; the week lands as
  illness_recovery.
- **D6/E6** — pre-signup days are history: `programHistoryBeforeISO`
  (program `createdAt`, LOCAL date) exempts them from missed-session
  accounting and the "Did you do <day>?" prompt. `test:missed-signup` 5/5 in
  `test:bible`.
- **D7/rider 2, DECIDED** — an open horizon survives block rollover and
  season-phase change; boundary weeks generate under the fact
  (generation-at-creation); only the athlete ends it; clearing leaves no
  residue.
- **D8/rider 3** — disclosures derive from the committed diff
  (`changedWeekStarts` from the scoped regen): the severe-illness copy now
  owns its multi-week reach; cooked/poor-sleep recomposed-vs-no-change split
  rides the real transaction diff; R3 pins copy↔diff equivalence.

## Dual-seed sim merge-gate pass (iPhone 17 Pro sim, worktree Metro :8082)

All five scenarios clean, screenshots in session record:

1. `spent-week-friday` + Properly sick: commit SUCCEEDS; Done MON/TUE/THU
   untouched; Friday remainder → Rest; disclosure includes "I've eased the
   weeks ahead the same way — they stay that way until you tell me you're
   better."
2. Next week: coach note carried, Monday card **OPTIONAL** / "Nothing's
   required"; **clear from next week** ("I'm good now" → clear) restores next
   week to CORE and this week to its exact seed shape.
3. 8/10 knee ("avoid" band): recorded — "Training paused for injury… Knee
   issue active… Upper-body, bike or core work stayed in where safe";
   remainder re-authored; Done days untouched.
4. Cooked on the spent week: commits, disclosure matches the committed diff.
5. `standard-in-season-week` signup day: no catch-up prompt.

Sim-lane fix shipped en route: the seed coordinator validated
`seed.anchorDate` as a week start (latent since 2026-07-17; first bitten by
the first non-Monday-anchored seed).

## Gates

Full `test:bible` EXIT=0 on the final tree — now including `test:fact-horizon`
(14), `test:injury-authority` (17), `test:missed-signup` (5) plus all prior
suites (delivered-remaining 6, §18 safety 28 incl. redefined M3,
accepted-state 45, illness/readiness/deriving, coach suites, compile ratchet).

## NOT COVERED (L2)

- **Sam's device acceptance is the gate.** The sim pass is mine, on a
  simulator; nothing here counts as "done" (L4/L10).
- **Stage 2b (ask-the-athlete flow) is not started** — injuries ≥6/10 default
  to region-scoped participation; the athlete is not yet ASKED about anchor
  days. The explicit-`modified` participation gap remains for 2b.
- **`[ENGINE-VALIDATE] In-season weekly plan missing LOWER exposure`** fires
  (log-only, dev surface) when a knee-avoid injury legitimately omits lower
  work — a pre-existing planner advisory unaware of injury-authorised
  reductions. Cosmetic in release; not fixed here.
- The cooked disclosure's honesty is proven at the diff level (R3); which
  intra-session dose changes drove the "recomposed" claim on the sim run was
  not itemised on screen.
- `full_rest_frequency` / `session_volume` split semantics remain as Phase 1
  left them (frequency metrics only were re-specified).
- Multi-fact interaction (open illness + open cooked simultaneously) remains
  untested. `other` region injury untested on device (unit-covered).
- E6's mid-week-signup case is unit-proven; no dev-E2E seed exists for a
  Thursday signup (the E2E clock pins app-date while `createdAt` is real
  time, so a sim assertion would be vacuous — a dedicated seed is the honest
  follow-up).
- The keyboard run-4/run-5 and coach clarifier device gates are unrelated to
  this unit and remain open.
