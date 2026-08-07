# R5.3 RESIDUAL CLOSED — and clause (a)(2)'s premise REFUTED — 2026-08-07

Answers `docs/PROJECTED_ANCHOR_PRECEDENCE_RULING_2026-08-07.md` (`d6efec30`),
which ordered the residual closed FIRST. **Probe only — nothing built,
nothing merged.** Probe preserved and reproducible at `1198cb95` on
`scratch/r53-pricing-7`, entirely flag-gated and inert by default.

## (1) The residual CLOSES: store carry-over, through a PRODUCT path

The ruling named two candidates — shared-store carry-over across cells, or
genuine phase/mode divergence. It is **carry-over**, and the vector is not
the harness being sloppy about a variable; it is a product fence doing its
job against a stale input.

`seed()` writes `useProfileStore.setState({ onboardingData: athlete })`
directly. That fires the profile mirror fence
(`profileStore.ts:546`), which reads `canonicalAcceptedProfile()` — the
accepted snapshot on `programStore`. `seed()` sets `programStore` on the
line AFTER, so at that instant the canonical is still the **previous
cell's**. The fence republishes it over the just-written athlete.

Measured at the seed itself, not inferred:

```
in-suite   BEFORE seed {phase: "In-season",  gameDay: "Saturday"}
           AFTER  seed {phase: "In-season",  gameDay: "Saturday", isTheAthleteObject: false}

isolated   BEFORE seed {phase: null,         gameDay: null}
           AFTER  seed {phase: "Off-season", gameDay: null,       isTheAthleteObject: true}
```

In-suite the write **does not take at all**. Cell 19 seeds an Off-season
athlete with `usualGameDay: undefined` and then runs against an
In-season/Saturday profile it never asked for. That is the exact
`profilePhase: In-season` vs `storedMode: early_offseason` contradiction
the diagnosis reported and could not attribute.

At the derivation, both profiles are visible inside the one cell:

```
argPhase: "Off-season"  argUsualGameDay: null       sameObjectAsStore: false  -> derivedAnchor: none
argPhase: "In-season"   argUsualGameDay: "Saturday" sameObjectAsStore: true   -> derivedAnchor: game, day 6
```

The destroying derivation is the one handed the **store's** profile.

## (2) The blocker is DISSOLVED — the 2×2 is clean

Retiring the previous cell's accepted snapshot before the profile write
(`LFA_PROBE_SEED_ISOLATION=1`) is the only variable:

| | no isolation | with isolation |
|---|---|---|
| flags off | 22/0 | 22/0 |
| leg (iii) on | **21/1** | **22/0** |

The isolation is **inert flags-off**, so it is not buying green by asking
less. Cell 19's leg (iii) red is a witness artifact end to end.

**The named blocker is retired.** "Leg (iii) alone regresses
athlete-session-move cell 19, owned by no other leg and present in every
priced config" was never leg (iii)'s. It belonged to the fixture.

## (3) Clause (a)(2)'s premise is REFUTED — the overwrite is UNREACHABLE

The ruling held that the projection stands and the **overwrite** dies, and
ordered a systemic fix: day occupancy in `resolveFinalVisibleSection18Week`
composing under `dayPrecedence`. That reasoning is sound as law. Its
premise is not true of this app.

Probe cell P builds the COHERENT world the ruling reasoned about — profile
In-season, `usualGameDay: Saturday`, **zero** calendar marks — and moves
Monday onto the projected game day through the real door:

```
saturday before  {present: true, type: "Game", name: "Game Day"}
door             {ok: true, rejected: [], g1Ask: false}
commit           {outcome: "refused",
                  message: "It's game day — sessions can't be changed or added here."}
visible AFTER    identical to visible BEFORE
```

**No overwrite. No content loss. A reasoned, athlete-facing refusal.** The
control move (Monday → Sunday, a non-anchor day) is `applied` and lands
correctly in the same world, so the door is live and working here.

The composed-vs-visible overwrite the earlier diagnosis traced — the trace
the whole ruling was built on — exists **only** in the manufactured
contradiction of §1. Building the systemic precedence fix would be building
on coordinates nothing reaches: a fix whose regression test cannot be made
to red by any state an athlete can be in.

This is `gate-passing-on-coordinates-it-never-builds` in its costliest
form — not a narrow fixture under a broad assertion, but a whole ruling
reasoned from a world the harness invented.

## (4) A third finding, named not fixed

AGENTS.md records the ONE DOOR law: every write of `onboardingData` goes
through `applyProfileOnboardingWrite`, and `profileMirrorNarrowingTests`
"fails on any assignment to `onboardingData` outside this function". This
suite assigns it directly at `athleteSessionMoveTests.ts:146` and the
narrowing gate does not fail. The gate does not see test sources. That is a
real hole in a law Sam wrote after a profile-wipe saga, and it is what let
this fixture manufacture an unreachable state in the first place.

Not fixed here — it is its own unit, and it is bigger than this one suite.

## STOP

**Nothing built.** The ruling's clause (b) ordered the residual closed
first and said the precedence fix "builds regardless" — that clause is now
the one in question, so it goes back to the seat rather than being decided
here. What the seat needs to rule on:

1. Clause (a)(2) as written builds a systemic fix with **no witness that
   can red**. Withdraw it, or name the reachable world it protects.
2. The witness fix (seed isolation) IS authorised by clause (b) and is
   measured green — but the proper form is `seed()` respecting the one-door
   law, not the probe's snapshot poke. Ruling wanted on the form.
3. Condition 1's re-measure of the priced configs is now **cheaper and
   different**: leg (iii) no longer carries a cell-19 regression, so the
   pricing that named it as a blocker in every config needs re-running.

Carried forward unchanged: the freed-day producer STOP (clause (c)) is
untouched — next probe still starts at `commitWeekScopedOverlay`'s merge of
an explicitly `undefined` published field. Cell 22's re-pin still waits for
leg (i). Cell 23 remains diagnosed-before-ruled. Both tracked debts
(hydration snapshot-vs-live pin; the 146/172-stamp `todayISO` clock fix)
remain owed and NOT started. Parallel-gate stage 1 remainder untouched.

## NOT COVERED

- The full `test:bible` was not run — this unit committed docs and a
  flag-gated probe on a scratch branch, no product code.
- Only `test:athlete-session-move` and
  `test:athlete-move-occupied-content-loss` were run (both 22/0 and 2/0
  flags-off, unchanged).
- The coherent-world probe tested ONE move (Monday → projected Saturday)
  in ONE phase. It refutes "the overwrite always happens"; it does not
  prove no reachable overwrite exists anywhere.
- Whether the mirror fence republishing a stale canonical can happen on a
  real device — the same ordering, but through real doors — was NOT
  investigated. The harness reaches it; that does not mean only the
  harness can.

## L12 — what catches the NEXT one of this class

The class is: **a ruling reasoned from a world the harness manufactured.**
Fix-by-fix verification cannot catch it, because every layer downstream of
the invented state behaves correctly given that state.

What would catch it: a **fixture-coherence assertion** — after any seed,
the profile the stores hold must equal the profile the fixture asked for,
or the cell fails as a harness defect before its own assertions run. That
is one assertion in `seed()`, and it would have red-flagged cell 19 the
first time it was written rather than after two rounds of diagnosis, one
ruling, and one refutation. It generalises: every seeded surface should
assert it holds what was seeded.

Second, closing §4's hole — extending the narrowing gate to test sources —
removes the ability to manufacture these states at all.
