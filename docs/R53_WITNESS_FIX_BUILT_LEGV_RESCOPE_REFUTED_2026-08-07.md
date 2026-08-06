# R5.3 — WITNESS FIX BUILT; leg (v)'s RE-SCOPE has nothing to narrow — 2026-08-07

Answers `docs/R53_SEAT_ANSWERS_2026-08-07.md` (`81beac19`, committed as
authored). Seat answer 2 is **BUILT AND GREEN**. Seat answer 3 is
**STOPPED before building**: its premise does not hold.

Commits: `6f3a2a7a` (witness fix + gate extension), `766fe81a` (the
deletion seed's fixture debt).

## Answer 2 — BUILT, both halves in one unit as ruled

**The witness fix.** `athleteSessionMoveTests`' `seed()` now retires the
previous world FIRST and writes the profile through
`applyProfileOnboardingWrite` — the one door — in the order the app itself
has: answers land when no accepted program contradicts them. It then
ASSERTS the store holds what the fixture asked for, so this class fails at
the seed rather than three layers downstream as a product diagnosis.

**The systemic half.** The one-door narrowing gate now walks
`src/__tests__` and `src/dev` and checks the census in BOTH directions:

- an **undeclared** file writing the profile directly fails immediately —
  the half that stops the class growing;
- a **declared entry that no longer writes directly ALSO fails**, so
  paying debt forces the declaration down in the same commit and the
  census can never overstate what is owed.

Both directions were mutation-proven (an undeclared write red with the
undeclared message; a bogus declaration red with the stale message), plus
a non-vacuity assertion so a broken walker cannot read as a clean repo.

**54 files / ~75 sites** are declared as DEBT against the fixture-fidelity
law — not permission. Two narrow categories sit outside it: the narrowing
suite's own writes are its INSTRUMENT (proving the fence requires
performing an unowned write), and deliberate **fault injection** must sit
on a line carrying `PROFILE-DOOR-BYPASS: fault injection`, so that
category cannot quietly host a seed. `athleteSessionMoveTests` left the
debt list in the same commit.

**The deletion seed.** `seedExactSundayRegression` read
`overlay.workoutsByDate` FIRST and fell back to the derived week, which
made 18 cells depend on a STORED OUTPUT. It now reads the DERIVED week
first — the north star applied to a fixture. **Proven behaviour-preserving
rather than assumed:** both candidates instrumented at the seed,
`identicalJSON: true`, same name, same `microcycleId`
(`section18-core:2026-07-13`), same row count.

**Gate.** Full `test:bible` UNPIPED, EXIT 1 on `test:fixture-identity`
3/3 — the branch's pre-existing red, verified by running that suite at
HEAD in a clean worktree with no uncommitted changes. Because the bible
stops at the first red, the 18 suites after it were run individually:
**18/18 pass**. Touched suites: narrowing 25/0, move 22/0, deletion
24/24 + 5/5 + 3/3.

## Answer 3 — STOP. Leg (v) is ALREADY declaration-only

The ruling ordered leg (v) re-scoped so "workoutsByDate keeps publishing",
on the reading that the empty payload was "option 2's scope switch
reaching past the ruled target". **Reading the code the ruling is about,
that is not what is there.**

At the publication site (`weekRebuild.ts:564`):

```js
commitWeekScopedOverlay({
  ...projection.overlay,
  workoutsByDate: {},            // UNCONDITIONAL — outside leg (v) entirely
  ...(scaffold.SCAFFOLD.legV
    ? { exposureContractV2: undefined }
    : {}),
}, ...)
```

- `workoutsByDate: {}` is **unconditional, already-landed behaviour**, and
  its own comment argues for it: *"The SESSIONS that express it are
  derived, so the overlay is published with its `exposureContractV2` and
  an EMPTY `workoutsByDate`."*
- **Leg (v)'s entire product delta is one field**: `exposureContractV2:
  undefined`. It never touched the payload.
- `commitWeekScopedOverlay` REPLACES wholesale
  (`overlays[overlay.weekStart] = overlay`) — there is no merge to blame,
  and `weekRebuild.ts:900`/`:926` are the only writers of the store's
  `weekScopedOverlays`.

**So there is no scope to narrow, and the ordered re-scope cannot be
built as described.** Leg (v) is already exactly the ruled target.

**What that means for the price.** The measured payload difference is
real — flags-off the store's overlay carries
`["2026-07-13:Lower Body Strength", "2026-07-18:Hard Conditioning"]`,
under leg (v) it is `[]`. Since the publication writes `{}` in BOTH
worlds, the flags-off content is put there by something DOWNSTREAM of the
proposal, and leg (v) removing the declaration is what stops it. That is a
CONSEQUENCE of retiring the declaration, not an overreach — which means
the fixture-identity law's test the ruling itself cited ("derived content
retires only when re-derive-at-read provably reproduces it") is failing
for a real reason, not a scaffold one.

The prior refutation therefore should NOT simply be set aside as
scaffold-priced. It may be correctly priced against a real dependency.

## The next probe, now sharp

Clause (c)'s `commitWeekScopedOverlay` question resolves — the merge is a
wholesale replace and is innocent. The live question it becomes:

**What fills `workoutsByDate` after a publication that writes `{}`, and
why does removing `exposureContractV2` stop it?** That names the real
owner of the freed day's content and decides leg (v)'s true price.

## STOP

Answer 3 is not built. Nothing on the scaffold branch changed this pass;
`scratch/r53-pricing-7` is at `a7b49764` (probes only). Condition 1's
re-measure of the priced configs is NOT run — it would be measuring
against a premise now in question.

**Also not verified:** the claim that the cell-19 witness fix removes leg
(iii)'s blocker is proven only on the scaffold branch's earlier probe. The
`LFA_SCAFFOLD_LEG_III` flag does **not exist** on
`feat/r53-v3-switchover`, so the "leg (iii) 22/0" run on this branch was
inert and proves nothing. Re-proving it needs the seed fix ported to the
scaffold — part of the re-price step, not done.

## NOT COVERED

- The downstream filler of `workoutsByDate` was NOT identified — named as
  the next probe, not opened.
- Leg (v) was not re-priced; no scaffold measurement this pass.
- The other 53 files on the new debt census were not paid, only declared.
- `test:fixture-identity` 3/3 remains the branch's standing red, untouched.

## L12 — what catches the NEXT one of this class

The class here is **a ruling premise about code that nobody re-read**. The
seat inferred a scope switch from a measured symptom; the symptom was real
and the mechanism was not. One `grep` at the publication site was the
whole refutation.

What would catch it: when a ruling names a MECHANISM (not just an
outcome), the implementing line gets quoted into the boundary report
before any build. A ruling that says "X is doing Y" is a claim like any
other, and quoting X is cheaper than building against it — this is
[[pin-the-already-covered-claim]] applied to rulings rather than to docs.
