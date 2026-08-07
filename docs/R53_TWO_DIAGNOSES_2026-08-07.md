# R5.3 TWO DIAGNOSES — (a) CLOSED, (b) HYPOTHESIS REFUTED — 2026-08-07

Answers the inbox ruling committed at `1e363e72`. Diagnosis only —
**nothing built, nothing merged.** All measurement on
`scratch/r53-pricing-7`; probes reverted, scaffold unchanged.

## (a) MOVE CELL 19 — CLOSED. Leg (iii) INVENTS the anchor that destroys the move

The chain, measured end to end.

**The destroyer.** The composed week places the athlete's moved session
correctly; `resolveFinalVisibleSection18Week` then overwrites it:

```
lost:      w2:monday:none:strength      marks: []      anchorState: game
composed:  1:calendar-game-2026-07-25  3:w2:wednesday  5:derived-arms_pump
           6:w2:monday:none:strength          <-- the move, correctly placed
visible:   1:derived-prehab_accessories 3:w2:wednesday 5:derived-arms_pump
           6:calendar-game-2026-07-25          <-- overwritten by the game
```

The conservation guard is RIGHT to refuse. `detectAthleteMoveContentLoss`
is not the defect; it is the only thing that noticed.

**The producer, and it is leg (iii) itself.** Instrumenting stored vs
derived identity on that week:

```
storedMode: early_offseason   storedAnchor: "none"   storedAnchorKinds: []
derivedAnchor: "game"         marks: 0               profilePhase: "In-season"
```

The stored contract declares **`anchorState: none` with no anchors at
all**, the calendar has **zero marks**, and leg (iii) derives **`game`**.
`fixtureIdentityForWeek` asks `targetWeekFixtures`, which synthesises a
projected fixture from the profile's `usualGameDay` when the calendar is
silent. On a week whose own contract says "no fixture", that projection
invents one — and it lands on Saturday, exactly where the athlete moved
their session.

**This IS the ninth sighting of the named class** — a later layer
destroys what a decision established — but the root sits one layer
EARLIER than the destroyer: **leg (iii) treats a profile DEFAULT as a
week FACT**, with the same authority as a calendar mark and above the
week's own stored declaration of no fixture.

**Why it is not built under the standing rules.** The rules named in the
ruling (derive / one-owner / resolved-authority) do cover the *shape* —
this is an authority ordering. But the fix changes what
`usualGameDay` means for a week with no marks, and that projection is
how EVERY future in-season week is planned before its fixtures are
entered. That is product behaviour with a blast radius far outside this
unit, so it goes back to the seat rather than being decided here.

**One residual, stated rather than hidden.** The world exhibiting this
has `profilePhase: In-season` against `storedMode: early_offseason` —
mutually contradictory. Cell 19 seeds an Off-season athlete and `seed()`
resets `markedDays` to `{}`, so this state is either the suite's shared
store carrying a profile across cells, or a genuine phase/mode
divergence. **Which it is decides whether the fix is the authority rule
above or seed isolation in the witness** — and that distinction was not
closed. It does not change the attribution: leg (iii) produces the
anchor from a profile default in a world where nothing else declares one.

## (b) THE FREED DAY'S CONTENT — the named hypothesis is REFUTED

The ruling named the hypothesis to CHECK, not assume: the gateway's
repair candidates (`presentRequiredCoreConditioning`) and/or allocation
reading the published contract. Checked, on the bye-build week itself:

| world | core repair, `in_season_bye_build` |
|---|---|
| published contract present (passing) | `shortfall: 0` / `shortfall: 1` |
| leg (v), published contract gone | `shortfall: 0` / `shortfall: 1` |

**Byte-identical.** Same `unresolvedMinimumShortfall`, same
`plannerSelectedTarget`, same firing pattern. The core-conditioning
placer behaves the same in both worlds, so **it is not the producer of
day 6's `Hard Conditioning`.** The migration the ruling pre-authorised
(the owed-core placement into tier 4) would therefore NOT unblock
step 2 — building it on this hypothesis would have been a whole unit
spent on the wrong owner.

**And the premise underneath needs re-examining too.** The seed probe
reports `contractSource: overlay` in BOTH worlds — that is, with leg (v)
on, the week-scoped overlay still carries an `exposureContractV2`. So
the difference between the passing and failing worlds is **not simply
the presence of the published contract**, which is what step 2 and the
leg (v) refutation both assumed. Something else about leg (v)'s
publication changes the freed day.

Per the ruling's own terms — *"if the producer is something else, STOP
with it named"* — the producer is **not named**, and this is the STOP.
What is established: it is not the core-conditioning placer, and it is
not (only) the contract's presence. The next probe should start from
`commitWeekScopedOverlay`'s merge behaviour when a published field is
explicitly `undefined`, since that is where the two worlds stop agreeing.

## (c) Carried forward unchanged

The basis fix (`LFA_BASIS=visible`) ships WITH leg (iii), as measured.
Cell 22's re-pin still waits for leg (i). Cell 23 remains
diagnosed-before-ruled, and is still undiagnosed.

## Standing

**STOP.** Nothing built into the main build, nothing merged. Both
tracked debts (hydration snapshot-vs-live pin; the 146/172-stamp
`todayISO` clock fix) remain owed and NOT started. The queued
snapshot-to-reference unit remains queued. The parallel-gate stage 1
remainder is untouched. The run home is not begun. STOP at R5 close.

Loop-audit counters: measurement-harness lies 2 of 3 (`gate.sh` is the
compression, already landed). Diagnosis (b) took two rounds and both
changed their outcome, so the loop is earning its keep — no compression
owed.
