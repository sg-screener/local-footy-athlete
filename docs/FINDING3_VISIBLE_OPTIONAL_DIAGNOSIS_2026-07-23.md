# Finding #3 — bed-ridden sessions not visibly optional: mechanism (2026-07-23)

**Status:** DIAGNOSIS ONLY. No fix, no production code. STOP for review. Trigger: the
finding #4 merge-gate device pass (iPhone 17 Pro sim, `standard-in-season-week` game week)
confirmed the predicted defect — the illness_recovery (bed-ridden) week REDUCES load but its
surviving sessions render as **CORE/scheduled, not optional**, contradicting Sam's standing
answer (illness_recovery = minimums lifted, sessions **optional + reduced**, never cleared to
rest). All `file:line` at branch `diagnose/move-occupied-content-loss` HEAD.

**This is a CONTAINED authoring logic gap — NOT an ownership / duplicated-representation case,
and NOT the game-proximity re-tiering from finding #4.** No 7-question reassessment is needed
(criterion in the tasking); the single owner of the optional tier simply never sets it on the
sessions that survive an illness_recovery week.

---

## The chain, traced with evidence (which layer loses the optional tier)

Instrumented the actual authored/projected state on the device-exact game-week seed (canonical
fixture), printing `workoutType/sessionTier` at three layers, game vs non-game:

```
                         MON            TUE                THU                SAT         SUN
[1 AUTHORED overlay ]  Mixed/core   Team Training/core  Team Training/core   (game)     (—)   + WED/FRI Rest/recovery
[2 ACCEPTED effective]  Mixed/core   Team Training/core  Team Training/core  Game/core  Recovery/recovery
[3 VISIBLE resolver  ]  Mixed/core   Team Training/core  Team Training/core  Game/core  Recovery/recovery
```

- **Layers 1 = 2 = 3, identically.** The projection (`rebaseAcceptedEffectiveWeek`,
  `resolveWeekWithConditioning`) changes nothing — it faithfully carries whatever tier the
  overlay holds. So the optional tier is **not dropped in projection**.
- **Game and non-game are identical.** So this is **not** the mode-blind game-proximity
  re-tiering that caused finding #4 — it is the same on every week.
- **The authored overlay itself tags the surviving sessions `core`, never `optional`.** The
  optional marking is **never set at authoring** for these sessions; there is nothing for the
  projection to lose.

The day card is correct: it renders `sessionTier === 'optional'` as optional
(`HomeScreenV2.tsx:1006/1339/1578`) and otherwise shows the tier badge (`SessionTierBadge`
label `CORE`, `SessionTierBadge.tsx:14`). It shows CORE because it is handed `core`. Device
corroborates the trace exactly: on the sim the bed-ridden week showed MON tagged **CORE** +
prominent Start Session and TUE/THU as `scheduled` — no `optional` day state anywhere.

**Correction to the record:** the finding #4 reassessment §3 (and D6) asserted
"`optionalOnlyMode`/`applyOptionalRecovery` run in generation, so 'sessions visibly optional'
is satisfied by the same regen." The device + this trace show that premise is **false** for
the sessions an illness_recovery week actually keeps.

---

## Root cause (the exact site)

`optionalOnlyMode` in `src/utils/coachingEngine.ts:6865-6893` runs for `illness_recovery`, but
the only place it stamps the optional tier — `applyOptionalRecovery` (`:6851-6859`) — sets it
**only for non-strength sessions**:

```
6856:    if (!strength) session.tier = 'optional';
```

And both of `optionalOnlyMode`'s selection loops **exclude team days**:

```
6869:  const existing = plan.filter((session) => hasConditioning(session) && !session.isTeamDay) ...
6879:  const optionalCandidates = plan.filter((session) => !session.isTeamDay && ...)
```

So for an illness_recovery week whose surviving sessions are the strength day (MON, `hasStrength`)
and the team-training days (TUE/THU, `isTeamDay`):

- **MON** enters `applyOptionalRecovery` (it has conditioning) but the `if (!strength)` guard at
  `:6856` skips the tier stamp → stays `tier: 'core'`.
- **TUE/THU** are team days → excluded from both loops entirely → untouched → stay `tier: 'core'`.
- Only the pure-recovery days (WED/FRI) reach `recovery` — which they largely already were.

Net: none of the *worked* days in the reduced week are stamped `optional`; the tier the day card
keys on is never set. The load reduction (removing Upper Pull / Gunshow → rest) is real and
separate — it happens; the **optional marking of what remains** is the gap.

---

## What this is / isn't, and what the fix will need

- **It IS:** a contained gap in a single owner (`applyOptionalRecovery`/`optionalOnlyMode` in
  the generation path). One code region; the projection and the day card are correct.
- **It ISN'T:** a projection or ownership defect, a duplicated representation, or the finding #4
  re-tiering. The tier is authored once and projected faithfully.
- **Sam-gated product decision the fix must resolve (do NOT pre-decide):** what tier should an
  illness_recovery week's surviving **strength** day and **team-training** days carry? Sam's
  standing answer ("sessions optional + reduced, never cleared to rest") points to *optional*,
  but two sub-questions are genuinely his:
  1. **Team days** — a team session is externally scheduled; can the app mark it "optional," or
     should it stay a fixture the athlete negotiates with their team? (Today it is excluded from
     optional marking by design — `!isTeamDay`.)
  2. **A surviving CORE strength day in a "bed-ridden" week** — should Lower Body Strength remain
     at all, or should the reduction be deeper (fewer/lighter worked days) before the optional
     marking even applies? (i.e. is the defect only the *tier*, or also the *degree of
     reduction*?)
  The mechanical fix (extend the optional stamp to the surviving strength/team sessions the
  product wants marked optional) is small and lives at `coachingEngine.ts:6851-6893`; it should
  not ship until those two answers are recorded, and it is generation code (Sam's sign-off per
  CLAUDE.md).

---

## NOT COVERED (L2)

- **The fix.** Diagnosed only; the tier decision (above) is Sam's and unmade.
- **Degree-of-reduction question.** Whether a bed-ridden week should keep a strength day + two
  team days at all is raised but not diagnosed — it is a programming-quality/product call
  (overlaps Phase 4), distinct from the tier-marking gap.
- **Other tiers.** Only the severe-illness (illness_recovery) week was traced. `in_season_bye_
  recovery` and `early_offseason` share `optionalOnlyMode` and the same `!strength`/`!isTeamDay`
  guards, so they likely share the gap — not verified here.
- **Device re-confirmation of any fix** and the paused finding #4 merge-gate items (move chain,
  remaining tiers, cooked) remain outstanding; the merge stays gated on a clean sim pass.
