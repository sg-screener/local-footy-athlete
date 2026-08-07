# R5.3 — THE CONTRACT-TO-FACT RECONCILER REASSESSMENT — 2026-08-06

**STOP. Nothing built. No code changed on this branch by this unit.**

The next unit was ruled and scoped: re-home ruling 2's flush drop from
`fixtureMinimalReplan:294` into the deriver, rewrite cell 8, go green.
Measuring the red before writing the fix found that the re-home as scoped is
**not sufficient and not the defect**, and the real defect trips CLAUDE.md's
escalation rule twice over. So this is the reassessment CLAUDE.md demands
instead of the code.

Written against `feat/r53-v3-switchover` at `735a00ef` (V3 = `bd5a0abb`).

---

## §1 WHAT WAS MEASURED, BEFORE ANY OPINION

`test:phase-structure` cell 8 removes the Saturday fixture through the real
door and reads the week back through the app's own resolver. Probes at four
layers (reverted; the branch is byte-clean) printed:

```
[PROBE cell8] overlay=ABSENT  mode=in_season_game_week
              permitted=true plannerSelected=1 max=1
[PROBE cell8] anchors: team_training@1 team_training@3 game@6
[PROBE cell8] marks:   2026-08-15=noGame
[PROBE cell8] base micro roles: 1:TT  2:Mixed:optional_flush  3:TT  5:Str  4:Str
[PROBE cell8] DERIVER mode=in_season_game_week plannerSelected=1 blocking=0
```

Read those five lines together:

- The overlay is **ABSENT** — leg (i) did its job.
- The calendar fact says **`2026-08-15=noGame`**. The athlete's decision landed.
- The contract the derived week is composed and judged against still says
  **`in_season_game_week`, `game@6`, one flush declared**.
- `blocking=0`. §18 calls this week **fully conformant**.

**The flush is not surviving a fixture change. It is being correctly presented
by a contract that has not heard about the fixture change.** Both derivers
(`resolveWeekWithConditioning` and `rebaseAcceptedEffectiveWeek`) agree with
each other, and both are reading the same stale declaration.

## §2 THE CONSEQUENCE IS MUCH LARGER THAN THE FLUSH

`section18EffectiveWeekEvaluator.ts:526` builds the anchor ledger straight
from `contract.anchors`, with no reference to whether the fixture is still on
the calendar. For every anchor it counts as attended it does:

```
coreConditioning += 1;  anchorCore += 1;          // core conditioning credit
sprintSources.push({...});                        // sprint / high-speed credit
anchorHardDays.push(anchor.dayOfWeek);            // hard-day credit
```

So on this week a **game that the athlete cancelled is still paying the
week's conditioning, sprint and hard-day bills.** That is why `blocking=0`
and why the shortfall reads zero. The freed-day ruling's grounds — "§18
passing with ZERO shortfall on the derived week" — were measured against this
contract. The zero is real arithmetic on a phantom anchor.

This is 1b ruling 2's own stated failure mode, one layer up: the ruling
warned that a laundered offer "quietly satisfied the core floor". The
launderer is not the offer. It is a fixture that is not happening.

I am not re-opening the freed-day ruling here — the empty Saturday may well
still be right for the athlete's pattern. What I am reporting is that the
**evidence cited for it does not currently mean what it says**, and that has
to be re-measured against a correct contract before it can stand as grounds.

## §3 THE 7 QUESTIONS (CLAUDE.md escalation rule)

### 1. What is the current source of truth?

**Two, and they have stopped talking.** The fixture life-fact is
`calendarStore.markedDays` (plus `profile.usualGameDay`). The week's §18
declaration is `exposureContractV2`, stored on the microcycle or an overlay.
The fact is authoritative; the contract is a stored derivative of it that no
longer refreshes.

### 2. How many representations of the user request exist?

Measured, not asserted:

| representation | sites | reads |
|---|---|---|
| "what is this week's contract" | **11** | a STORED contract (`overlay ?? microcycle`) |
| "does this week have a fixture" | **8 modules** | the FACT (`markedDays` / `usualGameDay`) |
| reconcilers between the two | **0** | — |

The eleven are `acceptedEffectiveWeek:102`, `programStore:826,1124,1234`,
`acceptedStateTransaction:450`, `postGenerationConstraintValidation:1148,
1351,1532,1735`, `weekRebuild:234`, `devE2ESeedRegistry:1105`.

### 3. Where can intent, domain, date, target or scope be reinterpreted?

At the contract read. The door records `noGame` correctly; every downstream
layer then asks a stored contract what kind of week this is and is told
"game week". This is exactly the shape CLAUDE.md names — *the semantic layer
understood the athlete, a later layer reinterpreted them* — and it is the
second time ruling 2 has been defeated by a later layer after a supposedly
general fix. Both escalation triggers are lit.

### 4. Which layer should own the decision?

The layer that already owns "does this contract still describe reality".
`section18EffectiveWeekEvaluator` has an `identity` violation domain doing
precisely this comparison — five checks (`:1097, :1117, :1132, :1148,
:1160`), **all of them phase-clock, none of them fixture**. The fixture axis
is the missing member of a family that already exists.

### 5. What simpler architecture removes representations instead of adding guards?

**Leg (ii) deleted the only reconciler the app had, and nothing replaced it.**

`materialiseFixtureMarksForCandidate` — removed at `0d913c1e` — compared
`contract.identity.anchorState` and the fixture anchor's `dayOfWeek` against
`markedDays`, and rebuilt the week when they disagreed. Its
`alreadyMaterialised` check *is* the invariant that is now unenforced. Grep
for `alreadyMaterialised` or `desiredAnchor` today: **zero hits.**

That deletion was right — it was a second composer of the athlete's week.
But it was carrying a second job nobody costed: it was the only thing keeping
the stored contract honest about the fixture. V3 deleted the composer and the
reconciler together and replaced only the composer.

The simplification is therefore not a new guard. It is to finish the
substitution V3 started, and the north star already says which way:
**`markedDays` is the decision; the week's fixture identity is derived from
it, never stored and never trusted from storage.**

### 6. Which legacy paths should be bypassed or retired rather than patched?

None additional. The retirement already happened; this is its unpaid half.
`fixtureMinimalReplan:294`'s `withoutPlannerOffers` still retires as ruled —
it is just not the fix, and moving it alone would ship a false green.

### 7. What tests prove the new ownership boundary?

- `phaseStructureConformanceTests` cell 8, rewritten per the freed-day
  ruling: no flush after the rebuild, and contract totals **ASSERTED** —
  which now means asserting the week is judged as a **bye** week, since a
  `game@6` anchor is the thing manufacturing today's false zero.
- A new cell, two-directional and the one that matters: **a contract whose
  `anchorState` contradicts `markedDays` is never used to judge a week.**
  It must fail in both directions — phantom anchor (mark removed, contract
  says game) and missing anchor (mark added, contract says bye).
- The freed-day ruling's §18-green-zero-shortfall grounds, **re-measured**
  against the corrected contract, and the ruling re-confirmed or revised on
  what that measurement says.

## §4 THE OPTIONS, PRICED (Elegant Solution Requirement)

### Option 1 — move `withoutPlannerOffers` into the deriver, as scoped. REJECTED.

It does not fix cell 8 by arithmetic: declared 1, present 1. To green the
cell it would have to strip the flush *unconditionally on any fixture
change*, which breaks cell 9 (a moved fixture must keep its offer — the week
is still a game week and its policy still declares one). It also leaves the
phantom anchor crediting conditioning, sprint and hard days. This is the
door-patch shape in a different building, and it would ship a green cell over
a live defect.

### Option 2 — the door publishes a CONTRACT-ONLY overlay. RECOMMENDED.

Leg (i) currently throws the whole overlay away, contract included. The
replan already builds the correct rebuilt contract
(`buildFixtureProjection` → `replan.gateway.contract`) and V3 discards it.

Publish the **declaration** and keep discarding the **content**:

- the door commits `markedDays`, the ledger entry, and an overlay carrying
  `exposureContractV2` **and no workouts**;
- the deriver composes base content against that correct contract;
- the offer owner (`section18OfferPlacement`) becomes **symmetric** — the
  week presents exactly what its contract declares, withdrawing surplus as
  well as placing shortfall. That is the honest home for ruling 2: one
  owner, at the layer that already owns the offer, never a door patch.

This is `store only decisions, derive everything else` read literally: the
week's declaration is the decision's product; the week's sessions are
derived. It keeps V3's win (one composer) and pays its unpaid half. It is
also the smallest change that makes the phantom anchor impossible rather than
merely detected.

Cost: `commitWeekScopedOverlay` must accept a contract-only overlay, and the
eleven contract-read sites must be checked for ones that treat "overlay
present" as "overlay has workouts". Not yet measured — see §5.

### Option 3 — re-derive the whole contract at read. REJECTED for this unit.

`buildFixtureProjection` rebuilds a contract by calling
`generateProgramLocally` — full week generation. Re-running that on every
read is not viable. A cheap identity-only re-derivation is possible
(`resolveSection18PhasePlannerSelection` + `buildSection18WeeklyExposureContractV2`
are pure, and `deriveContractlessLegacyContract:695` already composes exactly
that pair), but it would put a **twelfth** representation of the week's
declaration into the app rather than removing one. If Option 2 fails on
measurement, this is the fallback, not the first choice.

### Option 4 — make the evaluator refuse a stale contract. NOT SUFFICIENT ALONE.

Adding the fixture axis to the evaluator's `identity` domain (§3 q4) turns
today's silent false green into a loud blocking violation. That is worth
having **regardless** — it is the tripwire that would have caught this — but
it produces a refusal, not a rebuilt week, and cell 8 wants §18 green with
zero shortfall. Recommended as a companion to Option 2, never as the fix.

## §5 WHAT IS NOT MEASURED, AND IS NOT BEING ASSUMED

- Option 2's blast radius across the eleven contract-read sites. Per the
  design ruling's condition 1, this gets measured **before** the leg lands,
  not after.
- Whether any suite currently depends on a fixture-changed week keeping its
  old contract. Unknown; a mutation run answers it.
- Whether the freed Saturday stays empty once the contract is a bye contract.
  It may now build the hard conditioning the pre-V3 baseline had — in which
  case the freed-day ruling's *conclusion* survives on different grounds, or
  its supersession of 1b ruling 2's baseline half needs revisiting. **This is
  Sam's, not mine, and it is the reason this document exists rather than a
  commit.**

## §6 WHAT THIS COSTS TO IGNORE

If V3 merges as-is: every week the athlete changes a fixture on is judged
against the fixture they cancelled. §18 credits conditioning, sprint and
hard-day exposure for a game that is not being played, reports zero
shortfall, and the week silently under-delivers by exactly one hard session.
It is invisible on every green suite in the bible, because the suites ask the
same stale contract what the week was supposed to be.

**The branch stays held. Nothing merges until this is ruled.**
