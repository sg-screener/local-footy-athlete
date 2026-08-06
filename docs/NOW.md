# NOW — overwrite at every checkpoint (pointer, not history)

- **Branches:** feat/stage-b-stage2 GREEN (merge target, untouched);
  feat/r53-v3-switchover = the live unit; scratch/r53-pricing-7
  (`901ba9b9`) holds legs (iv) and (v); -6, -5, -5-before preserved.
- **Current unit:** V3 four-leg conformance — PRICED, **NOT GREEN,
  STOP**. See docs/R53_FOUR_LEG_PRICE_STOP_2026-08-07.md. Leg (iv)
  built and FREE; leg (v) built and REFUTED (buys fixture-identity
  3 red→1, costs deletion 21/24→13/24). Nothing merged.
- **Residual:** cell 22's 2nd assertion pins the stored contract leg (i)
  retires; cell 23 returns `conflicted` not `safely-rejected`; cell 7
  diagnosed (reduction measured on composedWorkouts, judged on
  visibleWorkouts) with leg (iii) install site 1 as declared payer;
  condition 1 (fixture-identity 6/6) still unmet, cause now NAMED
  (`a13bb51a`, weekRebuild.ts publishing `exposureContractV2`).
- **Next:** parallel-gate stage 1 items 2–4 (test:bible:parallel +
  agreement law + its mutation check). Item 1 (scripts/gate.sh) DONE
  and proven both directions.
- **Tracked debts:** hydration snapshot-vs-live pin; todayISO clock fix
  (146/172 wall-clock stamps); R5.7 whole-or-none; remaining R5
  batches; condition 4 markedDays proof; the merge.
- **Gate:** Sam's combined device pass = merge gate; review seat writes
  the tap list. Full test:bible UNPIPED before any commit.
