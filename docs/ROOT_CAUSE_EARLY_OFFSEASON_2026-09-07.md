# Week-three off-season diagnosis

Owner: scopebridge. Historical diagnosis; Sam approved the proposed scope with
“yep” on 2026-09-07. Implementation receipts: `docs/STATUS_SCOPEBRIDGE.md`.

Reproduced the PDF's week-three power and conditioning in the current three-day
female journey. Four weekly save/restarts preserve the visible program.

## Verified cause

- `seasonPhaseClock.resolveSeasonSubphaseAtPhaseWeek` (line 70) labels weeks
  1–2 early, 3–4 mid. This matches recorded R-173; changing the clock alone
  would also extend optional weeks and alter deload behaviour.
- `powerPrimerPolicy.decideFullPowerPrimer` (194) rejects early only. Mid
  receives primers even with `powerGoalNudge:false`. `weeklyExposureContractV2`
  (1159) independently permits mid-phase power.
- `weeklyProgrammingContract.OFFSEASON_OVERLAYS.transition` (522) requires
  conditioning and running. `weeklyScheduler.scheduleWeek` (1552, 1693)
  reserves a second running exposure, exchanges Friday's off-leg component,
  and adds Saturday under WC-060.
- `offseasonSubphasePolicy` separately describes conditional running and zero
  hard sessions; its conditioning fields do not govern this scheduling path.

## Actual choices

Broad Jumps wins among ten eligible lower-power exercises. Pogo Hops is
rejected because its special reduced-dose role is inactive; upper exercises
are wrong-family. Medicine-Ball Slam wins among five eligible upper choices.
The alternatives are eligible but rank lower, not safety-rejected.
Wednesday selects Extensive Tempo; Saturday selects 1 min On/1 min Easy.
Easy Aerobic Flush is rejected as special-use for these ordinary tempo slots.
Full candidates/reasons: `/private/tmp/lfa-early-offseason-candidates.json`.
No hard-interval selection was verified.

## Proposed correction and verification

Recommend one shared preparation policy across power, running, conditioning,
rep schemes, scheduling and validation, rather than changing only power.
Propose protecting weeks 1–4, retaining optional weeks 1–2: body-armour lifting,
mobility, optional light off-feet aerobic work; no automatic power/running/hard
conditioning or forced conditioning top-ups. This scope needs Sam's approval.
Update all dependent fixtures/checkers, Coach references and accepted-state
regeneration. Preserve logs. Prove the real journey fails before correction,
passes after save/reload, across neighbouring profiles and weeks; mutation-test
all prohibitions and run relevant gates plus release.

NOT COVERED: implementation, native UI, historical PDF rebuild, other profiles.
