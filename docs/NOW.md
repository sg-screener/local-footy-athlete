# NOW — overwrite at every checkpoint (pointer, not history)

- **Branches:** feat/stage-b-stage2 GREEN (merge target, untouched);
  feat/r53-v3-switchover = the live unit, HEAD `766fe81a`;
  scratch/r53-pricing-7 (`a7b49764`) holds legs (iv)/(v) + this unit's
  probes; -6, -5, -5-before preserved.
- **Current unit:** seat answers (`81beac19`). **Answer 2 BUILT AND
  GREEN; answer 3 STOPPED before building.** See
  docs/R53_WITNESS_FIX_BUILT_LEGV_RESCOPE_REFUTED_2026-08-07.md.
- **BUILT — the witness fix + the systemic half** (`6f3a2a7a`): `seed()`
  retires the previous world first and writes through
  `applyProfileOnboardingWrite`, then ASSERTS it holds what it asked for;
  the one-door narrowing gate now walks `src/__tests__` + `src/dev` and
  checks the census in BOTH directions (undeclared fails; a stale
  declaration also fails), mutation-proven both ways + non-vacuity. 54
  files/~75 sites declared as DEBT; fault injection must carry
  `PROFILE-DOOR-BYPASS: fault injection`.
- **BUILT — the deletion seed** (`766fe81a`): reads the DERIVED week
  first, not the published payload. Proven byte-identical
  (`identicalJSON: true`), so 18 cells keep their coordinate.
- **STOP — answer 3 has nothing to narrow.** `workoutsByDate: {}` at
  `weekRebuild.ts:564` is **unconditional**, outside leg (v) entirely;
  leg (v)'s whole delta is `exposureContractV2: undefined`, and
  `commitWeekScopedOverlay` REPLACES wholesale (clause (c)'s merge is
  innocent). The payload loss is a CONSEQUENCE of retiring the
  declaration, not a scope overreach — so the prior refutation may be
  correctly priced, not scaffold-priced.
- **Next probe, sharp:** what fills `workoutsByDate` after a publication
  that writes `{}`, and why does removing `exposureContractV2` stop it?
  That names the freed day's real owner and decides leg (v)'s price.
- **NOT verified:** leg (iii)'s blocker removal is proven only on the
  scaffold's earlier probe — `LFA_SCAFFOLD_LEG_III` does NOT exist on this
  branch, so the "22/0 under leg (iii)" run here was INERT. Re-prove by
  porting the seed fix to the scaffold.
- **Gate this pass:** full test:bible UNPIPED, EXIT 1 on
  test:fixture-identity 3/3 — the branch's pre-existing red, verified at
  HEAD in a clean worktree. Bible stops at first red, so the 18 suites
  after it were run individually: 18/18 pass.
- **Still open:** condition 1's priced-config re-measure (NOT run — the
  premise is in question); cell 22's 2nd assertion (leg (i) not landed);
  cell 23 undiagnosed; parallel-gate stage 1 items 2–4; the other 53
  declared debt files.
- **Tracked debts:** hydration snapshot-vs-live pin; todayISO clock fix
  (146/172 wall-clock stamps); R5.7 whole-or-none; remaining R5 batches;
  condition 4 markedDays proof; the merge.
- **Gate:** Sam's combined device pass = merge gate; review seat writes
  the tap list. Full test:bible UNPIPED before any commit.
