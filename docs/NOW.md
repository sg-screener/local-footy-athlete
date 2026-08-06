# NOW — overwrite at every checkpoint (pointer, not history)

- **Branches:** feat/stage-b-stage2 GREEN (merge target, untouched);
  feat/r53-v3-switchover = the live unit; scratch/r53-pricing-7
  (`f91ea404`) holds legs (iv)/(v), the ported seed fix and this pass's
  probes; -6, -5, -5-before preserved.
- **Current unit:** the commit-materialisation ruling (`a81cc38a`) said
  BUILD MAY START. **Surveyed, extraction started, STOPPED at a structural
  blocker.** See docs/R53_LEG_III_SURVEY_AND_SEPARABILITY_STOP_2026-08-07.md.
  NOTHING BUILT into the branch.
- **SURVEY — legs (iii)+(iv)+`basis=visible` are BEHAVIOUR-NEUTRAL.** All
  154 bible suites, control vs target: **6 vs 6, identical sets — 0 new, 0
  fixed.** The control's 5 scaffold-only reds pre-date this pass's tape
  (verified at `1eb65683`); the branch's control is 1 (`fixture-identity`),
  which leg (iii) does NOT fix.
- **Module separable; install site 2 of 3 is NOT.** `derivedWeekContract.ts`
  lands cleanly (all imports present). Site 1 (`acceptedEffectiveWeek` +
  basis) separable. **Site 2 lives inside `scaffoldSection18TierFour` —
  leg (ii)'s tier-4 host — and the branch has no tier-4 host at all.**
  Site 3 needs `stripConditioningComponent` moved to `sessionRowCounting`
  (small). A 2-of-3 install is KNOWN-WRONG (publisher composes against the
  stored contract = the fixture-identity residual), so it was not done.
- **For the seat:** step 1 assumed leg (iii) builds alone; as scaffolded it
  does not. Recommended option 1 — land (ii)+(iii)+(iv) together per the
  convergence pairing; leg (ii) needs one measurement run.
- **Next after the ruling:** the parity conformance gate (step 2), then
  condition 1 unparks.
- **Parked:** condition 1's re-measure (the premise it waited on changed);
  leg (v) re-price; cell 22's 2nd assertion (leg (i) not landed); cell 23
  undiagnosed; parallel-gate stage 1 items 2–4; the other 53 declared
  profile-write debt files.
- **Tracked debts:** hydration snapshot-vs-live pin; todayISO clock fix
  (146/172 wall-clock stamps); R5.7 whole-or-none; remaining R5 batches;
  condition 4 markedDays proof; the merge.
- **Gate:** last full test:bible UNPIPED on this branch exited 1 on
  test:fixture-identity 3/3 — the branch's pre-existing red, verified at
  HEAD in a clean worktree; the 18 suites it cannot reach ran 18/18. Sam's
  combined device pass = merge gate. Full test:bible UNPIPED before any
  commit.
