# NOW — overwrite at every checkpoint (pointer, not history)

- **Branches:** feat/stage-b-stage2 GREEN (merge target, untouched);
  feat/r53-v3-switchover = the live unit; scratch/r53-pricing-7
  (`9d7d8ddc`) holds legs (iv)/(v), the ported seed fix and this pass's
  probes; -6, -5, -5-before preserved.
- **Current unit:** the upgraded seat order (Sam's sweep-not-serial method
  call). **THE TAPE ran; the drop hop is NAMED; STOP condition met.** See
  docs/R53_TAPE_DROP_HOP_NAMED_2026-08-07.md; tape at `f91ea404` on
  scratch/r53-pricing-7 (`LFA_TAPE`, inert by default). NOTHING BUILT.
- **THE ANSWER — one hop.** Payload is empty in BOTH worlds through
  publication and staging (the deliberate `workoutsByDate: {}`), then
  `H8.rev:store-after-accepted-commit` = **2/2 flags-off vs 0/0 leg (v)**.
  The payload is materialised **inside `commitAcceptedStateTransaction`**.
  Staging does not fill it (H7 identical), ruling out
  `stageReversibleAdjustmentCreationTransaction`.
- **Discriminator:** the published `exposureContractV2` on the PROPOSED
  overlay — the only proposal difference between worlds. Both worlds END
  with a contract in the store (the txn mints/repairs one either way);
  only the world that PROPOSED one gets its payload materialised.
  `LFA_LEGV_SCOPE=both` reproduces the same hop.
- **Five suspects settled in the one run:** the builder is identical in
  both worlds; staged projections byte-identical; no colliding
  `additionalOverlays`; `commitWeekScopedOverlay` replaces wholesale;
  `validateLiveWeekOverlayWrite` never executes.
- **STOP, hop named.** `commitAcceptedStateTransaction` is the signed
  accept-and-reduce owner, so per the order's terms this is the STOP.
  Which LINE inside it fills the payload was deliberately NOT narrowed.
- **For the seat:** this is a WRITE-time materialisation gated on the
  declaration; leg (iii) changes READ-time derivation, so it does not
  obviously supply it. Build-order question is the seat's.
- **Cell-19 retirement ACCEPTED** by the seat (`1eb65683`).
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
