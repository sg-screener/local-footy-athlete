# NOW — overwrite at every checkpoint (pointer, not history)

- **Branches:** feat/stage-b-stage2 GREEN (merge target, untouched);
  feat/r53-v3-switchover = the live unit; scratch/r53-pricing-7
  (`f91ea404`) holds legs (iv)/(v) + the ported seed fix;
  scratch/r53-pricing-7-probe now at `b5918f9d` (and it finally carries
  `271a7be4`, which was dangling); -6, -5, -5-before preserved.
- **Current unit:** the tier-4 WRITE tape, to a FILE, with its positive
  control inside. **Done — the write is NAMED.** See
  docs/R53_TIER4_WRITE_NAMED_SAFETY_FINALISER_2026-08-07.md. NOTHING BUILT.
- **THE WRITE:** `src/rules/section18SafetyFinaliser.ts:265–278` — the
  `lighterStrengthRequired` branch; `:270-274` maps High|Maximal → Moderate,
  `:276` writes it. Reached from the gateway's stage 3
  (`section18AcceptedWeekGateway.ts:1311`) inside tier 4 at READ
  (`sessionResolver.ts:1088`). **A second site in the same chain:**
  `presentDeclaredOffer` (gateway `:1355`) placed a flush offer on Monday
  2026-07-20 and says so in its own repair text.
- **It is a READ-TIME write.** Tier 4's INPUT is identical in both arms —
  the stored week still says High after the commit. Nothing wrote the
  completed days; the projection rewrites them on the way to the screen.
- **THE DECIDING FACT:** the contract already carries
  `governedFromISO: "2026-07-24"`, and both rewritten days are before it.
  The evaluator honours that boundary (`section18EffectiveWeekEvaluator.ts:518`);
  the safety finaliser and the offer placer read it **zero times**.
  Census: 4 files read it (generation, the write door, the stamper, the
  evaluator), the two mutators do not.
- **Why leg (ii) exposed it:** the write door doesn't rely on the
  normalisers — it POST-FILTERS them
  (`temporarySourceFactTransaction.ts:565-570`, keeps only
  `date >= governedFromISO`). Tier 4 at read has no post-filter.
- **STOP, per standing conditions** — the named site is §18 signed
  behaviour (section18SafetyBoundaryTests pins the finaliser; the offer
  placer implements Sam's 2026-08-06 offer-survival ruling).
- **Compression owed (sighting 4 of one-owner-enforces-a-law-siblings-don't):**
  proposed, not built — the `369af59d` both-directions census gate shape,
  aimed at `governedFromISO`: every accepted-week mutator reads it or
  declares an exemption.
- **Next:** the seat rules on §6's placement argument and §7's compression.
  The other four of leg (ii)'s seven reds are still uninstrumented.
- **Parked:** condition 1's re-measure; leg (v) re-price; cell 22's 2nd
  assertion; cell 23 undiagnosed; parallel-gate stage 1 items 2–4; the other
  53 declared profile-write debt files.
- **Tracked debts:** hydration snapshot-vs-live pin; todayISO clock fix
  (the tape saw tier 4 running with today=2026-08-07, the wall clock);
  R5.7 whole-or-none; remaining R5 batches; condition 4 markedDays proof;
  the merge.
- **Gate:** nothing built this pass, so no gate was owed. Last full
  test:bible UNPIPED on this branch exited 1 on test:fixture-identity 3/3 —
  the branch's pre-existing red, verified at HEAD in a clean worktree; the
  18 suites it cannot reach ran 18/18. Sam's combined device pass = merge
  gate. Full test:bible UNPIPED before any commit that touches src.
