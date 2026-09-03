# STATUS — seat `integrate`

Owner: the `integrate` seat (Claude Fable 5.1, Claude Code). One writer.
Worktree: `/private/tmp/lfa-integrate-ed8298af`, branch
`candidate/2026-09-03-integrated`.

## 2026-09-03 — Sam: "start from candidate ed8298af, integrate audit commits 6031df4a and 05f1cc44, run the complete canonical-compiler command and the full release gate, fix only genuine reds family by family, rerun the six simulator flows, report whether it is ready for my phone"

**Acceptance criteria (restated once, checked against every slice).**
1. The candidate `ed8298af` carries both audit commits; the ownership file
   keeps the candidate's newer census reviews where the two sides met.
2. `npm run test:compile`, `npm run test:canonical-weekly-compiler` (the
   whole chain) and `npm run test:release` are green on the merged tree.
3. Only genuine reds are fixed; a demonstrably stale test is re-pinned with
   the ruling that superseded it named.
4. The six `.maestro/audit/` flows PASS on the simulator against the merged
   tree.
**Non-goals.** No features. No side findings (the merged mobility/strength
taxonomy, the double-squat merge). Nothing outside a red's own family.

### Integration
- Fork point `e0788875`. Candidate side: `74ef3174`, `ec0d6d55`, `ed8298af`.
  Audit side: `6031df4a`, `05f1cc44`.
- `git merge --no-ff 05f1cc44` onto `ed8298af`: **no textual conflict.**
  `scripts/weekly-writer-ownership.json` keeps the candidate's four
  re-reviewed rows (`scheduleWeek`, `materialiseAuthoredSessions`,
  `generateProgramLocally`, `selectConditioningTemplateWithTrace`) and takes
  the audit's two (the `useDayWorkout` re-review, the `appSprintDay` row
  dropped with its function). `weeklyScheduler.ts` merged cleanly: the
  candidate's WC-143 Speed-rides-the-fast-session block and the audit's
  deletion of the zero-caller `appSprintDay` do not overlap;
  `appSprintNeedPermitted` keeps its three live callers.
- Merge commit `35fe7f38`.
- `test:compile` on the merge: **PASSED — product 0, devtools 0, tests 0.**

### Canonical compiler chain, first run on the merge (`35fe7f38`)
Slice **10605 / 0**; reset-coach 19/0; athlete-session-deletion 139/0;
program-hydration-ownership 83/0; **fixture-mutation-transaction 20 / 1** —
the chain stops there (cell 17, "Friday school game plus Saturday club game
are two explicit fixtures": `g2_hard_lower:2026-03-25`).

### Family 1 — a fixture add published a full hinge on G-2 (APP, fixed)
REGISTRY-GREP: R-095, R-359, R-009, Section 17.C.

**Bisect (same suite, hard-linked node_modules, control worktrees):**
`e0788875` fork point 21/21 · `74ef3174` (hard-day breach advisory) **20/1**
· `ec0d6d55` 20/1 · `05f1cc44` audit tip 21/21. The audit commits are not the
cause; the candidate's own R-359 addendum commit is.

**Mechanism, measured with a probe on the cell's world** (In-season, five
gym days, club Tue/Thu, Saturday game, athlete adds a Friday game):
- Before `74ef3174`: the hard-day breach was a contract BLOCKER, so both
  minimal candidates (keep every session) were `impossible`; the replan fell
  through to its full regeneration from the compiler's fixture-conditioned
  target — one merged lower day on Monday, club nights without strength,
  Wednesday mobility. No G-2 finding. That is the week cell 17 was green on.
- After: the breach is advisory, the keep-everything candidate is accepted,
  wins on edit size, and publishes Wednesday's hinge (RDLs, hamstring curl)
  two days before the athlete's new Friday game. The Section 17 craft tier
  flags it (`g2_hard_lower`, strong) and the gateway only DISCLOSES; the
  replan rejected on strong G-1 alone and its ranking read contract blockers
  only. Two accepted candidates, both `craftBlockers: 1`, zero rejected.

**Why it is the app, not the test.** Section 17.C G-2 ("no full hard lower
session on G-2") stands; R-095 ranks G-2 above the injury exception. R-359
made the hard-day breach a warning — it never made G-2 one. The green result
before `74ef3174` was a coincidence of the blocker, not a rule.

**Fix (`fixtureMinimalReplan.ts`, `acceptedStateTransaction.ts`):**
1. `FixtureReplanEditCost.craftBlockers` — the gateway's craft-tier blocking
   count on the candidate — ranks directly after `section18Blockers`, ahead
   of every edit-size dimension. Writer: `scoreCandidate`. Readers:
   `compareFixtureReplanEditCost`, the regeneration comparison below, and the
   rolling-horizon score (`craftBlockingWeeks`, after `blockingWeeks`).
2. When the best accepted minimal candidate still carries a craft blocker,
   the compiler's own week for these fixtures (the former inline fallback,
   now `regenerateFromCompilerTarget`) is scored by the same cost and wins if
   it is violation-free; a regeneration that is itself blocked loses on
   `section18Blockers`, an equally flawed one on edit size. The fixture fact
   is never refused (the gateway's "a craft violation may fail a candidate;
   it may never veto a fact" holds).

**Receipts.**
- Cell 17 red-first on `35fe7f38` (the chain run above); with only step 1
  still red (both candidates carry the violation); with step 2 **green**, and
  the published week is byte-equal to the fork point's (Mon `lower` with
  Broad Jumps / Leg Press / RDLs / Cossack / Nordic / Tib / Short Flush; club
  Tue/Thu; Wed Mobility; no strong finding).
- `test:fixture-mutation-transaction` **21 / 0**. `test:compile` PASSED
  (0/0/0 against baseline).
- Blast radius, fix vs control (`35fe7f38`, same node_modules), identical:
  g1-move-durability 35/0 · accumulated-away-transaction 20/0 ·
  move-game-relaunch 10/0 · chained-mutation-continuity 927/0 ·
  session-change-durability 59 · fixture-conditioned-replan 16/34 with the
  **same 18 FAIL lines** (md5 `757b442b…` both sides; inherited, diagnostic).
- Writer census: three owners moved (`scoreCandidate`,
  `buildFixtureMinimalReplan`, new nested
  `buildFixtureMinimalReplan.regenerateFromCompilerTarget`), re-reviewed
  with their prior classifications; **1166/1166, 0 unresolved, 0 rival, 0
  derived-output, gate exit 0.**

North star: TOWARD — no new stored state; the craft verdict the gateway
already derives now ranks the repair instead of being disclosed after it.
