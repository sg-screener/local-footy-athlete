# R5.3 — THE LANDING SET, BUILT ON THE BRANCH AND PRICED AT TWO (2026-08-07)

LOOP CHECK: control-set-attributed-to-the-instrument-instead-of-the-code —
sighting 3 of the red-count class (the "3 red both sides" diff was 1, the
declared-red-narrower-than-defect lesson was 2) — COMPRESS, and the
compression is the one the seat already endorsed and this pass built: a
measurement is attributed only after the FAILURE TEXT is diffed in both
worlds, and a control's reds are attributed to the instrument only after the
instrument is removed and the control re-run. Four reds this pass had been
written off as scaffold noise for a full day; they were the unit's own code.

Seventeenth pass. Answers inbox item 1 (the two owed rulings + the run home).
**BUILT ON `feat/r53-v3-switchover`** — this is the first pass in this unit
that lands product code. Everything is unflagged; no scaffold flag survives.

## THE HEADLINE

| measure | value |
|---|---|
| sweep, all 155 suites, this branch, HEAD `b72b5574` | **3 failures** |
| branch control (recorded, verified at HEAD in a clean worktree) | 1 (`fixture-identity`) |
| **new reds from the landing set** | **2 — both named, both owned** |

The two are exactly the pair the sixteenth pass predicted:
`program-control-durable` (the move-door basis) and `action-walker:deep` (the
D13 session-template debt). `test:compile` PASSES the 3-scope ratchet and
improved by 3 errors.

## WHAT LANDED

Legs (ii)+(iii)+(iv) + `basis=visible` + the one-owner `governedFromISO`
boundary + the three ruled fixes (`ORDER_OWNER`, `FIXTURE_AUTHORITY`,
`OFFER_PROVENANCE`), all unflagged, plus the endorsed census gate.

**SHELVED as ruled, not lost:** `DERIVED_IDENTITY` stays on
`scratch/r53-pricing-7-probe` (refuted as scoped). **NOT landed:** leg (i) and
leg (v) — neither is in the ruled set; every scaffold door for them is out.
**Also out:** `bounded` and `provenance` (the resolved-authority and
reduction-provenance rulings). They were measured OFF in every priced arm, so
the gateway's reason owner is back to the branch's shape byte for byte —
landing them would have been unruled behaviour riding in on a measured set.

## THE PORT DEFECT THE CONTROL HAD HIDDEN — 4 reds, ONE cause

The first sweep came back **7**, not 3: `hydration-upgrade-path`,
`calendar-ownership`, `readiness-store-ownership` and `coach-updates-ownership`
on top of the expected pair. All four died at the same line with the same
error — `programStore.ts:1877`, `TypeError: Cannot read properties of
undefined (reading 'call')`.

**It is an import cycle, and the unit built it.** Migrating
`stripConditioningComponent` into `rules/sessionRowCounting` (the
deriver-acquires-repair-search ruling's one-owner move) gave that module an
eager import of `utils/visibleWorkoutIdentity`. `sessionRowCounting` is
low-level — `sessionTaxonomy` imports it, and through
`sessionClassificationAdapter` → `section18EffectiveWeekEvaluator` →
`dayPrecedence` → `acceptedEffectiveWeek` it is reachable from `programStore`
at module load. The new edge closed the loop, and a store whose module body
runs mid-cycle reads its own imports as `undefined`:

```
sessionRowCounting -> visibleWorkoutIdentity -> conditioningVisibleIdentity ->
sessionComponents -> coachRevisionProposal -> visibleProgramReadModel ->
programStore -> acceptedEffectiveWeek -> dayPrecedence ->
userRemovalConstraints -> section18EffectiveWeekEvaluator ->
sessionClassificationAdapter -> sessionTaxonomy -> sessionRowCounting
```

**FIXED** — the rule moves to `rules/strengthRelocationTemplate.ts`, its own
module. One owner is preserved (both callers import it); the low-level module
keeps its low-level import set. Cycles through `programStore`: **0**. All four
suites green.

**AND THIS IS THE PASS'S LESSON.** Those four are FOUR OF THE FIVE reds the
ninth-pass survey recorded as "scaffold-only… verified to pre-date this pass's
tape… they are not mine, and they do not exist on the branch." They were the
unit's own code all along, carried in every arm of every price since, and
counted as background. The re-run that established "pre-dating" measured a
scaffold that already contained the cycle. A control's reds belong to the
instrument only when the instrument's removal makes them go away — and that
was never the test that was run.

## THE COMPRESSION, BUILT — `test:gateway-authority-census`

The seat endorsed the gateway-input census gate; it is built inside the
assembly and registered in the bible chain beside the gateway's own suite.

It names the class — *an authority carried on the WRITE path only, while a new
READ path re-derives the same week without it* — and holds all three members
with the mechanism that fits each:

| input | mechanism | cell |
|---|---|---|
| `activeFixtureDates` | DECLARED CENSUS, both directions | every product call site supplies it; no undeclared blind caller; no stale declaration |
| `governedFromISO` | ONE OWNER (rides inside the contract, so no call site can be censused) | exactly one property read inside the gateway |
| `surfaces` | THE COMPILER (required field) | the field stays required |

**6/6, and mutation-proven in three directions**, which is the only reason to
believe it: renaming the key at `sessionResolver` reds it; mentioning the field
in prose only reds it; a declaration for a call site that now supplies the
authority reds it.

Two of those mutations found real holes in the gate as first written — a
substring match called `MUTANT_activeFixtureDates` a supply, and a `key:`-only
pattern called `programStore`'s shorthand `activeFixtureDates,` blind. A third
found a hole in the `governedFromISO` cell: it counted TEXT and so read one
boundary as two owners. All three are fixed and recorded in the file.

The census also states the finding plainly: **every product call site now hands
the gateway its fixture authority.** Before this port, `sessionResolver` did
not — which is root 1b, and three of the six reds.

## THE TWO CARRIED REDS, DECLARED WITH THEIR COORDINATES

### 1. `program-control-durable` — the move-door basis. DECLARED.

`a move committed durably reaches the visible week` FAILS: *"I couldn't safely
make that change, so the plan is untouched." (route=guided_tap_flow)*.

The oracle (`acceptedWorkoutForDate`) reads the MATERIALISED week; under
tier-4-at-read the athlete acts on the DERIVED one, so the identity guard at
`acceptedStateTransaction.ts` can never match and every durable move is
refused. Retiring the oracle to the derived basis was built and **refuted as
scoped** — the door has TWO caller classes on TWO visible bases (sheet route:
`resolveWeekWithConditioning`; G-1 landing: `rebaseAcceptedEffectiveWeek`), and
either basis breaks the other class.

**PAYER: the recorded door-unification debt** — one visible basis for every
door, its own unit, after this one. The two-caller-classes finding is adopted
into that debt's record. The declaration is written at the code site, not only
here. No compatibility branch was built.

### 2. `action-walker:deep` — and the D13 ruling's premise is REFUTED

**This is the genuine STOP.** The ruling ordered the declaration widened "to
the measured coordinate (2026-08-10)". Re-measured on the scaffold that
produced that number, with the same arms:

| arm | walker's first violating day |
|---|---|
| (ii)+(iii)+(iv)+basis | **2026-08-10** |
| + `FIXTURE_AUTHORITY` | **2026-08-10** — identical, the fix does not touch it |
| LANDING SET (3 fixes) | **2026-07-27** |
| LANDING SET (4 fixes) | **2026-07-27** |
| this branch, as built | **2026-07-27** — byte-identical to the scaffold's landing arm |

**2026-08-10 is the PRE-fix coordinate, not the landing one.** The sixteenth-
pass report recorded it the other way round, and stated the coordinate change
as evidence that the red was NOT root 4 returning. The port is faithful — my
branch reproduces the scaffold's landing arm exactly — so the disagreement is
in the record, not in the build.

**And the shape is not the one the ruling names.** The offence text, both
coordinates, is:

> the session list omits `["speed"]` **and invents `["support"]`**

That is the COMBINATION of the two already-declared D13 entries —
`session_list_has_no_representation_for_speed_work` (matches `omits ["speed"]
and invents []`) and `session_list_badges_a_midline_row_the_projection_has_no_
part_for` (matches `omits [] and invents ["support"]`). **Neither regex can
match it**, which is not a surprise: the walker file already documents this
exact failure mode in prose ("THE FIFTH SHAPE IS A COMBINATION, AND THAT IS THE
POINT — a day dropping conditioning AND badging support produces a string no
single-shape regex can match").

So the ruling's OUTCOME survives and its MECHANISM does not. The class rule it
cites applies with more force to the combination reading than to the coordinate
one — but "widen to 2026-08-10" would declare a coordinate the landing set does
not produce, which is the instrument-not-the-defect error the rule exists to
stop, committed in the other direction.

**NOTHING WIDENED, pending the seat.** A ruling premise is a claim too
(recorded law), and this one is refuted by measurement on its own scaffold.

**What the seat now owns:** whether the widening is (a) a THIRD declared entry
for the combination shape at 2026-07-27, (b) a change to how the list matches
so a combination is decomposed into its constituent declared shapes, or (c)
the D13 owner paying both debts and the entries deleting together. Option (b)
is the compression — it retires a gap the file has been carrying in prose since
2026-08-04 — and it is the one this terminal would recommend, but the list is
L13's ratchet and narrowing how it matches is the seat's call, not a judgement
this terminal takes alone.

## STANDING CONDITIONS

- Full `test:bible` UNPIPED run for its exit line; the sweep (155 suites, sets
  diffed) is the price above. `test:compile` PASSED the ratchet.
- Sam's device-pass flag from this unit: **completed-day display** — a
  completed day that previously showed a softened intensity now shows what was
  actually completed. That is the fact-horizon boundary working, and it is the
  only athlete-visible consequence flagged. The re-keyed-move-identity flag is
  DROPPED, as ruled, since `DERIVED_IDENTITY` is shelved.

## NOT COVERED

- The parity gate (derived == materialised, byte-equal), leg (v) on its real
  price, and condition 1's re-measure are the order's remaining steps and are
  **NOT RUN** — the report is filed at the STOP, as the order provides.
- The walker red's identity is settled as *shape* (the declared combination)
  but the coordinate MOVE from 2026-08-10 to 2026-07-27 is characterised, not
  diagnosed: it is one of `BOUNDARY` / `ORDER_OWNER` / `OFFER_PROVENANCE` and
  was not bisected further, because the shape is declared debt either way.
- The four cycle reds are fixed and re-measured; whether the same cycle
  explains the fifth scaffold-only red (`legacy-census`) was not checked — it
  is green on this branch.
- `lastTierFourDerivation` is landed as a write with no reader in the bible
  chain: `derivedWeekLawfulnessProof` was NOT ported. It is the instrument the
  parity gate wants, and it is owed with that step.
