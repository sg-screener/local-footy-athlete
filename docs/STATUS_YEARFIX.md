# YEARFIX — Sam's six-item review of the three-day 52-week book (2026-09-09)

Seat: yearfix (Fable). Worktree `/private/tmp/lfa-yearfix-20260909`, branch
`yearfix/three-day-year-20260909` from `integrate/2026-09-09-combined` @ 326ef8ab
(app code identical to 017818cc, the code on Sam's phone). node_modules symlinked
from the original folder; the original folder, its servers and simulators were not
touched. Evidence: `/private/tmp/lfa-yearfix-evidence/` (suite logs, fault-control
logs) and `output/three-day-program-2026-09-09-yearfix/` (regenerated year, book,
PDF, proofs; untracked like every other output folder).

REGISTRY-GREP before building: R-393, R-389, R-390, R-386, R-378, R-354, R-337,
R-312, R-233, R-266, R-290, R-129, R-288, R-388, plus R-036 (illness law) and
R-303/R-391 found while diagnosing items 4 and 6.

## Root causes, one per family (verified in the 017818cc book by date)

- **Item 3, Primer Pogo Hops under a knee.** The knee filter that strips every
  lower jump is `applyConstraintsToTypedComponents`, which reads
  `role === 'power'`. The Primer's Pogo Hops is an AUTHORED row
  (`authoredSlotRowToWorkoutExercise`) and carried no role, so it walked past the
  one filter; the exercise-level matrix separately permits Pogo Hops at knee 4/10.
  Fix at the composition owner: the authored jump slot declares `power: 'lower'`
  and the builder types it exactly like a pool-drawn jump. No second reading.
- **Item 5, two adductor isometrics on 2027-03-05.** Two causes. ("Isometric" is
  read from the groin pool's duration-authored entries — Copenhagen variants and
  Groin Squeeze; a Cossack Squat or Lateral Lunge is dynamic adductor work and is
  not counted. A first, broader reading counted them and the early eight-athlete
  annual run reddened 65 weeks on it; narrowed before the release run.) (a) The warm-up
  flow is derived from the session but only excluded the same exercise/variation;
  it drew Groin Squeeze beside a prescribed Half Copenhagen on six dates. Fix: the
  flow yields any groin/adductor candidate when the session's rows already supply
  that robustness category. (b) The 3 x 30 s on a deload: the frontal-plane
  completion built its row at authored sets with no dated dose (the leg coverage
  already took one), and `reduceDemandingPrehab` read only the useful-strength
  contract, which a Mixed day does not carry. Fix: the completion takes the same
  `dosePolicyForDate` in all three callers, and the reducer also reads the dated
  deload policy. Result: one Copenhagen at one set.
- **Item 1 (R-394).** `weeklyLegCoverage` in-season now answers a typed Nordic
  category first (R-312's `nordicCurlVariant`), before the R-393 pair.
- **Item 2 (R-395).** `weeklyScheduler` adds one off-feet tempo finisher on the
  first strength-owned gym day off club training outside G-2..G+2 with a machine,
  outside the game-week budget; the V2 in-season game-week contract permits that
  one extra for two-or-more-night club athletes (`max` only; `preferred` and
  `required` unchanged, because the planner selects from `preferred`).
  `wholeWeekPlacementCost` excludes it from the metabolic count so the strength
  assignment cannot move to chase it (found by `spare-day-options` case [2]).
- **Item 4 — NOT a code inconsistency, stopped.** The reduced dose on 2027-07-19
  is stage 2 of the KNEE return (knee 2027-06-22 to 07-06 = 14 days, sprint
  blocking; stage 1 shown 07-10). Neither illness (03-23..27, 07-14..17, both
  under 7 days, tier MODERATE) triggers R-393's return, and R-036 rules a
  MODERATE illness eases training only while active. Making a short illness carry
  a return dose would be a new ruling, not a repair.
- **Item 6 — NOT buildable without a ruling, stopped.** Replayed week 16 through
  the live scheduler (`probe-w16-replay.cjs`): Friday already counts 11 lower
  working sets, so the four-day run IS visible. Thursday is the only legal
  standalone day because (a) the week owes two running days (Bible 17.B), all
  three lifting days are full-body so their metabolic work is off-feet, hence a
  standalone running day is required; (b) Tuesday makes Mon-Tue-Wed three
  consecutive energy-system days, refused by R-303 (kept by R-337); (c) Sunday
  makes Fri-Sat-Sun-Mon four; (d) Speed stays Saturday (R-389/R-391). Every
  spacing fix reverses one of those.

## WORKING / BUILT / WRITTEN (receipts in /private/tmp/lfa-yearfix-evidence/)

**WORKING** (the test that reds if it breaks is named):
- Primer Pogo Hops typed power and removed by a knee restriction —
  `test:leg-programming` case "The Primer's authored Pogo Hops is typed power…";
  fault `untype-primer-pogo` caught. `test:primer-session` 25/25 unchanged.
- One adductor isometric per session (flow yields) — case "One adductor
  isometric per session…"; fault `ignore-session-adductor-in-flow` caught.
- Frontal completion + prehab reducer read the dated deload policy — case "The
  frontal-plane completion consumes the dated deload dose…"; faults
  `drop-frontal-completion-dose`, `ignore-dated-policy-for-prehab-reduction`.
- R-394 in-season Nordic — case "In-season a curl does not replace the Nordic…"
  (added, credited, pre-season silent, G-1 refused); fault `nordic-satisfied-by-curl`.
- R-395 in-season harder-than-flush day — case "In-season game week: the
  off-club gym day…" (Sat/Sun fixture, deload, low readiness, no machine, no
  club, no eligible day, pre-season); fault `drop-inseason-moderate-conditioning`.
- Annual verdict: `weekly_inseason_nordic`, `weekly_inseason_conditioning`,
  `injury_exposure_fixed_point`, `one_adductor_isometric_per_session` are
  required weekly checks; `scripts/test-compiler-year.js` 53/53 controls
  including missing/failed variants of each.

**Exact results (command · exit · counts):**
- `npm run test:compile` · 0 · 0 errors against baseline (run twice, after every edit batch).
- `node src/__tests__/legProgrammingTests.cjs` · 0 · 42/42 (37 existing + 5 new).
- `node scripts/test-leg-programming-mutations.cjs` · 0 · 36/36 faults caught
  (30 existing + 6 new; three existing anchors re-pointed after my edits made
  them non-unique — fault behaviour unchanged).
- `npm run test:leg-programming` chain: journey 137 assertions, injury-energy and
  no-equipment journeys inside the chain green (release run below is the receipt).
- `npm run test:exercise-intake` · 0 · intake 2142/0, B-Stance 18/0, equipment
  vocabulary 98/0, Primer 25/0, power pool 57/0, quick actions 64/0.
- `npm run test:annual-audit-repairs` · 0 · controlled-2/3/4/5 each 364 dates,
  20 history comparisons, 52 reopens.
- `npm run test:rest-day-reason` · 0 · 144/144.
- `npm run test:weekly-writer-zero` · 0 · 1192/1192 reviewed, 0 unresolved
  (seven owners re-recorded with dated reasons).
- `npm run test:section18-v2` · 0 · 142/0. `npm run test:weekly-scheduler` · 0
  (spare-day-options 22/0 after the whole-week-cost fix). `node
  scripts/test-compiler-year.js` · 0 · 53/0.
- Baseline reds, NOT mine (reproduced on an untouched 326ef8ab worktree):
  `test:section18-planner` (Pre-season no-club phaseWeek 2, expected 4 actual 3;
  classified rewrite_test in test-truth-decisions), `test:clause-enforcement`
  (WC-138, WC-136 unclassified; WC-031, WC-064 orphaned).

**Regenerated three-day year** (`output/three-day-program-2026-09-09-yearfix/`,
same pipeline as the 017818cc book): annual-audit-evidence exit 0; prepare: 52
weeks, 364 days, 2,045 rows, 443 numeric feedback comparisons, 364/364 reopens
identical, 0 findings, 0 driver failures; PDF 280 pages, 2,045/2,045 printed rows
in order, 0 mismatches, 0 week-finder errors, sha256
c4f3d9db765fe9d738f718875eb399ad9c5e233578d9983d85c72d2785b9cfb2
(`output/pdf/three-day-athlete-full-52-week-program-2026-09-09-yearfix.pdf`).
prepare exit 0, 0 source changes against the manifest taken before the run
(third run, after the adductor-hold narrowing below).

**Dated proofs (`tools/proofs.py`, red on the 017818cc book, green here):**
- item 1: in-season Nordic sets w27–w52 = 2 every week except w42 = 1 (illness
  week, halved) and w45 = 0 (two fatigue reports, readiness deload; w44 = 2).
- item 2: Wednesday 2027-03-31 carries `tempo_intervals` beside Monday's flush,
  and so does every in-season game week except w45 (reduced); bye weeks keep
  their own hard session.
- item 3: Primers 2027-06-25 and 2027-07-02 (knee active) carry no Pogo Hops.
- item 5: 2027-03-05 carries one adductor isometric, Half Copenhagen 1 x 30 s.
- item 4 (report): 2027-03-28 still five Fly 20s — ruled by R-036/R-393, see above.
- item 6 (report): week 16 longest leg-loading run stays 4 — ruled, see above.
