# FIXTURE IDENTITY — architecture reassessment, 2026-08-05

**Status: RULED AND LANDED — option A, `7d9d3ee7`.** Sam ruled A by existing
law (NORTH_STAR.md answers it directly; no new ruling needed), C stays
rejected as recorded below. Cell 1 is GREEN and its declared-red entry is
deleted. The document is kept as the diagnosis of record.

**Two things the landing changed about this document, recorded rather than
edited away:**

1. **Cell 3 did NOT go green by A, and cannot.** A removed the feedback loop.
   What remains is that the published week is a materialised REPLAN and the
   derived week is a RESOLVE — two engines, agreeing about the fixture and its
   freed day, disagreeing on three untouched days. No rebase input makes a
   replan equal a resolve. Cell 3 is re-declared against **R5's switchover**,
   where derive() has no rivals and there is no published week left to
   disagree. §7 below said "structurally by R5" and that half was right; the
   "same ruling" half was not.
2. **A was not purely subtractive.** Applied to every caller it broke two
   athlete-DELETION regressions, because `materialiseFixtureMarksForCandidate`
   uses the same projection on every accepted commit to MAINTAIN the accepted
   week's fixture marks — there the overlay is the state being maintained, not
   a previous decision's product. Applying a decision and maintaining a week
   are different operations, so the caller declares which
   (`appliesFixtureDecision`), and inside the rolling horizon the law holds
   only for the PRIMARY weeks. The gate found this, not the reading of the
   code — which is the §9 risk "a new shell will have new bugs" landing
   exactly where it was said it would.

The mutation witness: disabling the one line reds cell 1 and nothing else;
restoring it greens it.

---

*Original document, as put to Sam, follows unchanged.*

**Status: FOR SAM'S RULING. No fix rides with this document.** The red cell
(`npm run test:fixture-identity`, chained into `test:bible`) ships with it;
cells 1 and 3 are DECLARED RED and name this document as what pays them.

Trigger: Sam's fresh-install R1 device pass PASSED on all five checks — instant
delete, fast identical relaunches — with one finding. Adding a game to a rest
Saturday and then removing it derived a strength-and-conditioning day instead
of returning to rest.

This is plan-adjustment work whose defect is a later layer reinterpreting a
landed decision, so CLAUDE.md's escalation rule applies: the seven questions
are answered before any code.

## What the evidence says (all reached by ACTING, fresh install, real doors)

Sam named two candidate causes. **Both are excluded.**

**Not the deriver re-deciding a free Saturday against the rest law.** Driving
the life-fact alone — `markedDays` game on, then off — with no stored week
anywhere, derivation returns the pre-add week BYTE FOR BYTE, rest Saturday
included. Derivation from the fact alone also produces the correct fixture week
going in: Game Day on the Saturday, the Friday session demoted to Gunshow. The
rest quota is right, the engine is right, and the stored week carries nothing
derivation cannot. This is cell 2, and it PASSES.

**Not ledger residue from the add/remove pair.** The ledger holds exactly
`fixture_add` then `fixture_remove` and nothing else. The quiescent boot
replays both to the same wrong week the live world already had — boot is
faithful; the defect is upstream of it.

**It is the stored week.** `rebuildLocalWeek(scope:'weekOverlay')` publishes a
materialised week into `weekScopedOverlays`. The next fixture mutation then
rebases from that same overlay — `buildFixtureProjection` calls
`rebaseAcceptedEffectiveWeek({ surfaces: sourceSurfaces })` where
`sourceSurfaces` is the whole program store, and `acceptedSource.composedWorkouts`
becomes the mutation's structural input. So the remove does not restore the
week; it **re-repairs the week the add built**, and that carried-forward repair
state fills the freed Saturday.

Isolation, changing one input and nothing else: drop the week's own prior
overlay before the remove, and the week returns to the pre-add week byte for
byte. That single input is the whole defect.

Observed on Sam's coordinate (Pre-season, Mon–Fri preferred, Tue/Thu team
nights, Saturday rest):

```
BEFORE       Mon Lower Squat|8   Tue TT+Upper Pull  Thu TT+Upper Push  Fri Lower Hinge|7   Sat REST
AFTER ADD    Mon Lower Body|3    Tue TT+Upper Push  Thu TT+Upper Pull  Fri Gunshow|6       Sat Game Day
AFTER REMOVE Mon Lower Body|3    Tue TT+Upper Push  Thu TT+Upper Pull  Fri Aerobic Cond|2  Sat Lower Hinge + Hard Conditioning|9
```

Five of seven days differ across a pair that must be identity. The Saturday is
the one Sam saw; it is not the only one, and it is not about Saturdays.

## Why the rebase exists — so the fix is not mistaken for a simplification

The rebase is how a fixture change CONSERVES the athlete's other decisions in
that week: an added session, a swapped template, a moved team night. Deleting
it outright would resurrect the content-loss class this repo has already paid
for twice (move conservation, repair capacity).

The overlay carries two things the rebase cannot tell apart:

1. **the athlete's other decisions for that week** — must survive the fixture's
   removal;
2. **the previous fixture's own repair product** — must NOT survive it.

Conserving (1) by rebasing a stored week necessarily conserves (2) as well.
That is the defect, and it is an ownership question rather than a missing
guard.

## The seven answers

**1. What is the current source of truth?** Two, disagreeing. The life-facts
(`markedDays`) plus profile and program are the inputs derivation reads. The
published `weekScopedOverlays[weekStart]` is a stored OUTPUT that outranks them
and is what the next mutation reads. Cell 3 measures the disagreement directly:
the add's published week differs from derivation over the same inputs on three
of seven days, BEFORE any second mutation compounds it.

**2. How many representations of the request exist?** Four for one tap: the
typed `FixtureMutationAction`, the `markedDays` life-fact, the published
overlay, and the `fixture_add`/`fixture_remove` ledger entry. Only the last two
persist, and they can disagree.

**3. Where can the decision be reinterpreted?** At the rebase. The decision
"there is no fixture on this date" is applied to a week whose shape already
encodes the previous decision's repair, so the freed day is filled from
carried-forward state instead of being re-derived as free.

**4. Which layer should own the decision?** `derive()`. A fixture is a
life-fact; the week is a function of inputs. Conservation of the athlete's
other decisions belongs to REPLAYING the decision ledger (R1.1/R1.4a), not to
rebasing a stored output.

**5. What simpler architecture removes representations?** Deleting the
published week for fixtures: the door records the fact, appends the decision,
and the week derives. That takes four representations to two. Cell 2 already
proves derivation alone produces the right week in both directions.

**6. Which legacy paths are bypassed rather than patched?** The overlay
publication in the fixture path, and with it `buildFixtureProjection`'s
`sourceSurfaces` rebase — the R5 deletions, reached early for this door.

**7. What tests prove the new boundary?** `test:fixture-identity` cell 1 (the
instance, add-then-remove is identity) and cell 3 (the general law: a published
week equals the week derived from the same inputs). Cell 2 is the control — if
it ever reds, the engine really did break and the diagnosis above is void.

## The blocker: this cannot be fixed correctly at R1 without a ruling

`deriveVisibleWeek` already ACCEPTS `decisions` as an input, but
`assembleScheduleState` does not read it — the plan says the ledger is consumed
"from R1.4 on", and today it is written but not read. **So the replay machinery
that would conserve the athlete's other decisions does not exist yet.** Three
options, and they are genuinely different sizes:

**A. Consume the ledger for conservation (recommended).** A fixture mutation
rebases from the base program plus the week's non-fixture ledger decisions,
never from the week a previous fixture built. Identity holds by construction,
because the inputs no longer contain the previous decision's output. This is
the north-star answer and it is available today — R1.4a already populates the
ledger for the day doors. It pulls part of R5's derivation switchover forward
into this one door.

**B. Stop publishing a week for fixtures entirely.** Smallest statement,
largest blast radius: the door's contract returns `WeekRebuildResult` and a
`reversibleAdjustmentId` that the coach note, `no_change` detection, the
outcome vocabulary and `verifyAfterPersistence` all depend on. That is R5's
work, not a spine patch.

**C. Clear the target week's overlay before a fixture rebuild.** Three lines,
and it makes cell 1 green. It is also a guard: it silently discards the
athlete's other decisions for that week, so it trades a wrong Saturday for
content loss — the class the rebase exists to prevent. **Recorded to be
rejected, not chosen.**

## What this changes about R2

R2's conformance gate is *"for every device-export fixture and walked world,
the old shell's visible week ≡ derive() over the migrated inputs."* Cell 3
shows the old shell's visible week is **not** derive() over the same inputs —
that is the defect, measured. Gating the migration against the old shell today
would enshrine the contamination as the target.

R2's extraction half (read the parked envelope, emit inputs and ledger
entries, idempotent, non-destructive) does not depend on this ruling and can
proceed. Its conformance half does. Recorded so the coupling is not discovered
late, per the plan's own "migration is where rebuilds die".

## Convergence

Toward the north star, decisively: the finding is a stored output that
disagrees with derivation and then feeds the next decision — the first and
fifth defect classes NORTH_STAR.md names, in one tap. Option A removes a
representation; option C adds a guard and keeps both truths.

## NOT-COVERED

- Whether the same rebase contaminates the OTHER doors that publish week
  overlays (move, delete, swap). Cell 3 is fixture-scoped today; the general
  law is stated so it can be widened, but no other door has been measured.
- The durable path was run end-to-end (durable door + `rebuildDerivedWorld`)
  and reproduces identically, but the cells use the in-memory twin for speed;
  they share `executeCandidate`, which is where the defect lives.
- Multi-fixture weeks, cross-week moves, and worlds with existing athlete
  decisions in the target week — the case option A exists to protect and the
  case option C would break — are unmeasured.
- Accumulated state (L13): the cells run three actions from install. Sam's
  finding was also on a fresh install, so the depth matches the report, but
  depth says nothing about depth 43.
