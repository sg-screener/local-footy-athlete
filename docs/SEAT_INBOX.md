# SEAT INBOX — the review seat writes here; terminal reads at every stop

## Unprocessed (newest first)

1. docs/PARALLEL_GATE_SHADOW_UNIT_2026-08-07.md — stage 1 remainder at
   the next natural boundary.

## Processed 2026-08-07 (ninth pass) — BUILD MAY START -> SURVEYED, then STOP

- Ruling committed as authored (`a81cc38a`). Answered in
  docs/R53_LEG_III_SURVEY_AND_SEPARABILITY_STOP_2026-08-07.md.
  NOTHING BUILT into the branch.
- **THE SURVEY: legs (iii)+(iv)+`basis=visible` are BEHAVIOUR-NEUTRAL.**
  All 154 bible suites, flags-off control vs target: **6 failures vs 6,
  identical sets — 0 new, 0 fixed.** The control's 5 scaffold-only reds
  were verified to PRE-DATE this pass's tape (re-run at `1eb65683`); the
  branch's own control is 1 (`fixture-identity`), which leg (iii) does NOT
  fix, as predicted.
- **The module IS separable.** `derivedWeekContract.ts` lands cleanly —
  every import already exists on the branch. Install site 1 of 3
  (`acceptedEffectiveWeek` read + the basis) is separable too; the
  `removalDecisions` field beside it belongs to the removal-record split
  and is NOT required by leg (iii).
- **BLOCKER — install site 2 of 3 requires LEG (ii).** On the scaffold the
  deriver's resolver read lives INSIDE `scaffoldSection18TierFour`, gated
  `if (!legII && !legIII) return`, and that function IS leg (ii)'s tier-4
  host. **The branch has no tier-4 host at all.** Site 3 additionally needs
  `stripConditioningComponent` moved to `sessionRowCounting` — small, not a
  blocker.
- **A partial install is known-wrong**, by the scaffold's own record:
  installing only the read sites left the PUBLISHER composing against the
  stored contract — `Lower Hinge|7` published vs `Lower Squat|8` derived,
  which IS the fixture-identity residual. So 2-of-3 was not done.
- **For the seat — the ruling's step 1 assumed leg (iii) is buildable
  alone; as scaffolded it is not.** Options: (1) land (ii)+(iii)+(iv)
  together per the convergence pairing — RECOMMENDED, removes
  representations rather than adding one, and needs one measurement run for
  leg (ii); (2) author a new leg-(iii)-only resolver install — new code,
  adds a representation; (3) sites 1+3 only — rejected as known-wrong,
  recorded so it is not silently dropped.
- `test:compile` excluded from the survey: +2/+1 vs the scaffold baseline
  is a scaffold-type artifact — branch baselines are identical (5/4) and
  `test:compile` PASSES on the branch (verified).

## Processed 2026-08-07 (ninth pass) — the ruling as the seat wrote it

- LOOP CHECK: tape-hop ruling — sighting 2 of write-side-producer-
   feeds-stored-output in R5.3 — COMPRESS via the standing derivation
   ruling. Read docs/R53_COMMIT_MATERIALISATION_RULING_2026-08-07.md,
   commit as authored. Short form: the materialised payload is OUTPUT
   not decision (recomputable from ledger + facts; records no athlete
   choice), so the standing derivation ruling applies and the signed
   accept-and-reduce rulings are not touched — they sign what accept
   DOES, not where content is produced. Order: leg (iii) builds
   first, corrected grounds (the deriver must supply at read what the
   commit materialises at write); parity gate before leg (v)
   re-prices — derived week == materialised week, byte-equal, on the
   tape's own fixture worlds, tape as instrument; materialisation +
   declaration retire TOGETHER with leg (v) after parity, no
   half-state; condition 1's re-measure unparks after the parity
   gate. BUILD MAY START. Sam holds a veto.

## Processed 2026-08-07 (eighth pass) — THE TAPE

- Answered in docs/R53_TAPE_DROP_HOP_NAMED_2026-08-07.md; tape at
  `f91ea404` on scratch/r53-pricing-7 (`LFA_TAPE`, inert by default).
  NOTHING BUILT. Sam's sweep-not-serial method was applied as ordered.
- **THE TAPES DISAGREE ON PAYLOAD AT EXACTLY ONE HOP.** Sequence identical
  to index 10; payload empty in BOTH worlds through publication and
  staging (the deliberate `workoutsByDate: {}`), then:
  `H8.rev:store-after-accepted-commit` = **2/2 flags-off vs 0/0 leg (v)**.
  The payload is materialised INSIDE `commitAcceptedStateTransaction`.
  Staging does not fill it (H7 identical), ruling out
  `stageReversibleAdjustmentCreationTransaction`.
- **The discriminator is the published declaration.** The only proposal
  difference between worlds is `exposureContractV2` on the proposed
  overlay. Both worlds END with a contract in the store (v2=T at H8 either
  way — the transaction mints/repairs one regardless); only the world
  whose PROPOSED overlay carried it gets its PAYLOAD materialised.
  `LFA_LEGV_SCOPE=both` reproduces the same hop and the same 0/0.
- **Five suspects settled in the one run:**
  `buildWeekScopedWorkoutOverlay` builds identically in both worlds (H1);
  staged rolling-horizon projections byte-identical (H5); no colliding
  `additionalOverlays`; `commitWeekScopedOverlay` replaces wholesale;
  `validateLiveWeekOverlayWrite` never executes.
- **STOP CONDITION MET, hop named.** The drop is inside
  `commitAcceptedStateTransaction` — the signed accept-and-reduce owner
  (`forward_decision`/`restoration`). Per the order's own terms that is
  signed behaviour, so this is the STOP, not a narrowing to build against.
  Which LINE inside it materialises the payload was deliberately NOT
  narrowed.
- **For the seat:** the freed day's content is materialised by the signed
  commit BECAUSE the publication declares a contract. Retiring the
  declaration removes content the commit would otherwise materialise —
  and that is a WRITE-time materialisation, which leg (iii) does not
  obviously supply, since leg (iii) changes READ-time derivation.
  Condition 1's re-measure stays parked; build-order question is yours.

## Processed 2026-08-07 (eighth pass) — the order as the seat wrote it

- SEAT ORDER, UPGRADED per Sam's method call (2026-08-07, his third
   sweep-not-serial instinct — matrix law, batch law, now this):
   STOP hypothesis-at-a-time. ONE instrumented run, BOTH worlds:
   tape EVERY write and transform that touches the freed week's
   workoutsByDate across the whole commit path — build, publication,
   republish, staging, commit — with stack + payload size at each
   hop, flags-off vs leg (v), then DIFF the two tapes. The first hop
   where the tapes disagree is the answer; every suspect is tested
   in the same run, ranked by the diff instead of by guesses. The
   executes-on-path law is satisfied by construction (the tape IS
   execution). Attribution only; nothing built; STOP conditions
   unchanged; condition 1's re-measure stays parked; build-order
   question waits for the diff. Cell-19 retirement (1eb65683)
   ACCEPTED. If the tape shows the drop inside a decision payload or
   signed behaviour, STOP with the hop named.

## Processed 2026-08-07 (seventh pass) — SEAT CORRECTION on answer 3

- Ruling committed as authored (`a375b49f`). Answered in
  docs/R53_SHARP_PROBE_FILLER_NAMED_2026-08-07.md; probes at `1eb65683`
  and `9d7d8ddc` on scratch/r53-pricing-7. NOTHING BUILT.
- **OWED ITEM DONE — cell-19 blocker removal RE-PROVEN with the flag
  live.** The shipped fixture fixes are ported to the scaffold, and both
  sides measured on ONE worktree: scaffold's ORIGINAL seed + leg (iii) =
  **21/1** (cell 19); shipped seed fix + leg (iii) = **22/0**; flags off =
  22/0. The blocker is retired on the branch that can actually test it.
- **THE HYPOTHESIS IS REFUTED.** The filler is NOT a reader of the
  published declaration. `validateLiveWeekOverlayWrite` — which matches the
  hypothesis exactly (reads `exposureContractV2`, early-returns without it,
  writes `workoutsByDate`) — prints **ZERO** times on this path. It reads
  the declaration as described and is simply not on the path.
- **THE FILLER, NAMED:** `buildFixtureProjection`
  (`acceptedStateTransaction.ts:2029`) → `buildWeekScopedWorkoutOverlay`
  (`weekRebuild.ts:217`, reason `one_off_no_game`), reached from
  `stageRollingHorizonFixtureRepair` and `commitProgramSetupRebuildTransaction`.
  It builds the payload from the REPLAN's own workouts, not from the
  declaration — so the publication's deliberate `{}` is overwritten
  afterwards by this rolling-horizon republish.
- **And it is NOT gated on the declaration:** overlays built = 84 flags
  off, 59 under leg (v), 59 under legs (iii)+(iv)+(v). It still runs. What
  leg (v) changes is whether the payload SURVIVES the transaction for that
  week (AFTER-txn `[]`).
- Also excluded: `additionalOverlays` never collide with the primary week
  (zero adjacent overlays here), and `commitWeekScopedOverlay` replaces
  wholesale — clause (c)'s merge re-confirmed innocent.
- **Back to the seat:** the correction's "no new ruling needed — build
  leg (iii)(+iv) first" branch does not apply *on its stated grounds*,
  because the filler never read the declaration. The convergence order may
  still be right; that is the seat's call. **Next question, now sharp:**
  why does the projection's payload fail to survive the COMMIT for that
  week under leg (v), when the projection still produces it? Condition 1's
  re-measure stays parked — the premise it waited on has changed.

## Processed 2026-08-07 (seventh pass) — the correction as the seat wrote it

- SEAT CORRECTION on answer 3 — read
   docs/R53_SEAT_ANSWER3_CORRECTION_2026-08-07.md, commit as authored.
   Short form: the seat's overreach attribution is withdrawn (code
   proved workoutsByDate:{} is landed behaviour; leg (v) was
   declaration-only all along). The leg (v) price was measured OUT OF
   THE RULED ORDER — the convergence ruling already predicted the
   contract dies by leg (iii), not leg (v). Ordered: run the sharp
   probe with the recorded hypothesis — the downstream filler is
   suspected to be the READER of the published declaration (the
   consuming half of the reconcile publishing hand-rolls,
   weekRebuild.ts:550-561 comment + four-leg price doc :180). Name
   it. If confirmed: no new ruling — build leg (iii)(+iv) first per
   the convergence order, leg (v) re-prices only after leg (iii)
   lands. If it is something else: STOP with it named. Condition 1's
   re-measure WAITS for the probe (leg (v)-alone configs measure a
   world the ruled order never produces). Also owed first: re-prove
   the cell-19 blocker removal by porting the seed fix to
   scratch/r53-pricing-7. Sam holds a veto.

## Processed 2026-08-07 (sixth pass) — the ruling as the seat wrote it

- SEAT ANSWERS to the fifth-pass boundary report — read
   docs/R53_SEAT_ANSWERS_2026-08-07.md, commit as authored. Short form:
   (1) clause (a)(2) WITHDRAWN by supersession — no reachable witness;
   dayPrecedence stays law, the conservation guard stays; if a
   REACHABLE world ever reds composed-vs-visible on an athlete
   decision it returns as its own unit. (2) Cell-19 witness fix =
   seed() through the owned doors (fixture-fidelity law), AND the
   one-door narrowing gate learns to scan TEST sources in the SAME
   unit — third fixture-manufactured misdirection this unit (cell-19
   carry-over, seedExactSundayRegression's borrowed fill, scaffold
   defect 4), so the compression ships with the fix, not later.
   seedExactSundayRegression's own fixture-fidelity fix is part of
   this unit's class. (3) Leg (v) RE-SCOPES to the DECLARATION only —
   workoutsByDate keeps publishing. Cited: the standing derivation
   ruling named "a stored representation feeding a computation" = the
   exposureContractV2 declaration, not the payload; R2 deliberately
   kept weekScopedOverlays; the fixture-identity law retires derived
   content only when re-derive-at-read provably reproduces it, and
   the freed-day measurement proves it does not yet. The payload
   emptying is option 2's scope switch reaching past the ruled
   target. Re-price leg (v) on the new scope; the prior refutation is
   SET ASIDE as scaffold-priced. Order: witness fix + gate extension
   -> leg (v) re-scoped re-price -> re-measure priced configs ->
   build per the convergence ruling. Sam holds a veto on all three.

## Processed 2026-08-07 (sixth pass) — SEAT ANSWERS

- Ruling committed as authored (`81beac19`). Answered in
  docs/R53_WITNESS_FIX_BUILT_LEGV_RESCOPE_REFUTED_2026-08-07.md.
- **ANSWER 2 BUILT AND GREEN** (`6f3a2a7a`, `766fe81a`). `seed()` retires
  the previous world first and writes through the one door, then ASSERTS
  it holds what it asked for. The narrowing gate walks `src/__tests__` +
  `src/dev` and checks the census in BOTH directions — undeclared fails,
  and a declared entry that no longer writes ALSO fails, so paying debt
  forces the declaration down in the same commit. Mutation-proven both
  ways, plus non-vacuity. 54 files/~75 sites declared as DEBT; the
  narrowing suite's writes are its INSTRUMENT; fault injection must carry
  `PROFILE-DOOR-BYPASS: fault injection` so the category cannot host a
  seed. `seedExactSundayRegression` now reads the DERIVED week first —
  proven byte-identical (`identicalJSON: true`), coordinate intact.
  Gate: full test:bible UNPIPED, EXIT 1 on test:fixture-identity 3/3 (the
  branch's pre-existing red, verified at HEAD in a clean worktree); the 18
  suites the bible cannot reach were run individually, 18/18 pass.
- **ANSWER 3 STOPPED — the re-scope has nothing to narrow.** The ruling
  held that the empty payload was "option 2's scope switch reaching past
  the ruled target". The code says otherwise: `workoutsByDate: {}` at
  `weekRebuild.ts:564` is **UNCONDITIONAL**, outside leg (v) entirely, and
  its own comment argues for it; leg (v)'s whole product delta is
  `exposureContractV2: undefined`. `commitWeekScopedOverlay` REPLACES
  wholesale, so clause (c)'s merge is innocent too. **Leg (v) is already
  declaration-only.** The payload loss is therefore a CONSEQUENCE of
  retiring the declaration — which means the fixture-identity test the
  ruling itself cited is failing for a REAL reason, and the prior
  refutation should NOT simply be set aside as scaffold-priced.
- **Next probe, now sharp:** what fills `workoutsByDate` after a
  publication that writes `{}`, and why does removing `exposureContractV2`
  stop it? That names the freed day's real owner and decides leg (v)'s
  price. Condition 1's re-measure NOT run — it would measure against a
  premise in question.
- **Correction owed to the record:** leg (iii)'s blocker removal is proven
  only on the scaffold's earlier probe. `LFA_SCAFFOLD_LEG_III` does not
  exist on feat/r53-v3-switchover, so any "leg (iii) green" run on this
  branch is INERT. Re-prove by porting the seed fix to the scaffold.

## Processed 2026-08-07 (fifth pass) — SAM'S LEAD

- Answered in docs/R53_FREED_DAY_PRODUCER_NAMED_2026-08-07.md; probe at
  `a7b49764` on scratch/r53-pricing-7. NOTHING BUILT.
  **The lead was right about the law and narrowed the search correctly,
  and the producer is ONE HOP downstream of the pathway it named.**
  The release pathway is INNOCENT: distinct release records are 52
  flags-off vs 46 leg (v), with **0 present only in leg (v)** — a strict
  subset (leg (v) fails earlier, so raw counts would have lied). Every
  record agrees: `byeUsualGameDay: true`, `releasedFixtures:
  ["2026-07-18:game:bye_usual_game_day"]`, capacity 6.
  THE PRODUCER: the published overlay's **`workoutsByDate`**. The overlay
  is still PUBLISHED in both worlds — which is why the earlier probe saw
  `contractSource: overlay` on both sides and could not attribute the
  difference; the premise that leg (v) removes the overlay was wrong.
  Flags-off it carries `2026-07-18:Hard Conditioning`; under leg (v) it is
  `[]` and the accepted week drops from 6 sessions to 5.
  AND the 16 deletion failures are FIXTURE debt: all run through
  `seedExactSundayRegression`, which reads that Hard Conditioning purely
  as a TEMPLATE to clone into days it then OVERWRITES — depending on the
  very fill Sam ruled a bug on 2026-08-06.
  **Back to the seat:** (i) is leg (v) meant to retire the overlay's
  workout PAYLOAD or only the `exposureContractV2` declaration? That one
  answer re-prices leg (v). (ii) If only the declaration, the emptying is
  a scaffold defect and leg (v)'s refutation was priced against it.
  (iii) `seedExactSundayRegression` needs its own fixture-fidelity fix.
  Clause (c)'s `commitWeekScopedOverlay` probe COLLAPSES into this, as the
  lead anticipated — probe it as one question, not two.

- The lead as the seat wrote it, kept verbatim for the record:
   SAM'S LEAD on the freed-day producer (2026-08-07, coaching knowledge,
   check FIRST before the commitWeekScopedOverlay probe): "if a game is
   removed it can be replaced by hard conditioning." That is the Bible's
   bye/fixture-release law (:164, :4670, :4676 — the released usual game
   day hosts the hard replacement exposure). The producer to check is
   whatever IMPLEMENTS that law — the fixture-release pathway, NOT the
   core-shortfall repair already cleared. Named sites:
   src/rules/fixtureConditionedAvailability.ts (builds releasedFixtures
   + bye_usual_game_day provenance, and itself calls targetWeekFixtures
   — the same projection as diagnosis (a)) and its bye_usual_game_day
   consumer at src/utils/fixtureMinimalReplan.ts:249, consumers in
   sessionResolver/weekRebuild/coachingEngine. Probe: does THIS pathway's
   input differ between the two worlds (via the overlay merge of the
   published field)? If it names the producer, the overlay-merge probe
   collapses into it. Attribution before build, as ruled.

## Processed 2026-08-07 (fourth pass)

- The projected-anchor precedence ruling (`d6efec30`) — committed as
  authored, per (d). Answered in
  docs/R53_RESIDUAL_CLOSED_OVERWRITE_UNREACHABLE_2026-08-07.md; probe
  preserved at `1198cb95` on scratch/r53-pricing-7. NOTHING BUILT.
  (b) RESIDUAL CLOSED: **store carry-over**, and the vector is a product
  path — `seed()` writes `onboardingData` directly, the profile mirror
  fence republishes the PREVIOUS cell's accepted snapshot over it because
  `seed()` sets programStore on the next line. In-suite the write does not
  take at all (`isTheAthleteObject: false`); isolated it does. So cell 19
  ran on an In-season/Saturday profile it never seeded.
  The 2×2, isolation inert flags-off: flags-off 22/0 both ways; leg (iii)
  21/1 without isolation, **22/0 with**. The named blocker "leg (iii)
  alone regresses cell 19 in every priced config" is **DISSOLVED** — it
  was the fixture, not leg (iii).
  (a) PREMISE REFUTED. In the coherent world the ruling reasoned about
  (In-season, `usualGameDay: Saturday`, zero marks) the move onto the
  projected game day is REFUSED — "It's game day — sessions can't be
  changed or added here" — with the visible week unchanged and no content
  loss; the non-anchor control move applies and lands. The
  composed-vs-visible overwrite exists ONLY in the manufactured
  contradiction, so clause (a)(2)'s systemic dayPrecedence fix would build
  on coordinates nothing reaches. **Back to the seat**: withdraw or re-aim
  (a)(2); rule on the FORM of the witness fix (`seed()` through the
  one-door law, not the probe's poke); re-run condition 1's pricing now
  the cell-19 blocker is gone.
  (c) untouched and still owed — now superseded in ORDER by Sam's lead.
  Named not fixed: the one-door narrowing gate does not scan test sources,
  which is what let this fixture manufacture an unreachable state.

## Standing
- Update docs/NOW.md at every checkpoint. Answer inbox items in
  boundary reports.
- FORMAT LAW (2026-08-07, Sam-forced after the seat ignored its own
  sweep rule): every seat order and every boundary report OPENS with
  one line — "LOOP CHECK: <shape of this work> — sighting N — iterate
  or compress". An order or report without that line is malformed and
  gets sent back, by either side. Sighting 2 of any shape = the
  compression is ordered, not the iteration. This line exists because
  reminders don't execute; a required field does.
