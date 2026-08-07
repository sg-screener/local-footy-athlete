# R5.3 — THE FLIP, MOVE (i): THE WRITER IS NAMED BY TAPE, AND THE PREMISE IS CORRECTED (2026-08-07)

LOOP CHECK: **§8 SECOND-WALL LAW fires, and it fires against me.** The same
SHAPE of wall was hit FOUR times in this pass — *install `derive()` at the site
I believe authors the declaration → measure → the stored declaration is
byte-unchanged → find another site*. §8 (added to the seat handoff mid-pass, in
Sam's words, binding) forbids a third attempt down that path without an elegant
alternative on the table. There is one, and it is §5 below. **Attempt five was
NOT made.**

Twenty-fifth pass. Answers inbox item 1 (THE FLIP), move (i) only.
**NOTHING BUILT into the branch** — the whole arm is preserved in
`stash@{0}` ("flip-move-i-wip"), inert. The branch is byte-identical to
`411881eb` apart from this report and the NOW pointer.

## THE HEADLINE

| question | answer |
|---|---|
| is move (i) buildable as written? | **NOT AT THE SITES ANY CENSUS NAMES** |
| how many publication sites were taught to derive? | **four** — all measured, all insufficient |
| did the stored declaration move? | **NO — 56 of 191 leaves from the derived one, every run, every world** |
| what actually costs the Monday power row? | **the PAYLOAD, not the declaration.** The declared parity entry's attribution is REFUTED |
| who authors the stored week? | **`programStore.ts:1449-1462`** — the accepted-snapshot repair, a FIFTH site |
| parity gate | **EXIT 0, 16/16, declared diff STILL CARRIED** in all three worlds — nothing was proven green |

## THE FOUR SITES, AND WHY EACH WAS INSUFFICIENT

Each was installed, the parity gate re-run UNPIPED, and the stored declaration
re-measured leaf-by-leaf against `publishedWeekDeclaration(base)`:

| # | site | result |
|---|---|---|
| 1 | `weekRebuild.ts:571` — the fixture door's commit | stored declaration unchanged |
| 2 | `acceptedStateTransaction.ts` — `buildFixtureProjection`'s overlay | **taped as firing 30×, publishing the derived declaration** — and still unchanged in the store |
| 3 | `postGenerationConstraintValidation.ts:1710` — `validateLiveWeekOverlayWrite` | **never runs in this world** (taped: 0 calls) |
| 4 | `postGenerationConstraintValidation.ts:1341` — `validateWeekOverlayAgainstActiveConstraints` | **never runs in this world** (taped: 0 calls) |

## THE TAPE THAT SETTLED IT

Three seams instrumented at once (`LFA_TAPE_DECLARATION=1`, `process.stdout`
deliberately — the gate wraps its doors in `quiet()`, which replaces the
console, and a `console.log` tape reads as "the site never fired"; that cost one
whole run and is worth recording):

```
  24 [TAPE buildFixtureProjection]   week=2026-08-10 base=globalWeek=2 anchors=2 fixture=none
                                     published=globalWeek=2 anchors=3 fixture=unknown
  18 [TAPE commitWeekScopedOverlay]  week=2026-08-10 anchors=3 fixture=unknown
   6 [TAPE buildFixtureProjection]   week=2026-08-10 base=… published=globalWeek=2 anchors=2 fixture=none
```

**The derived declaration reaches `commitWeekScopedOverlay` intact** — three
anchors, the practice match present, participation `unknown`. The store then
ends up holding `participation: normal_unrestricted` and 56 differing leaves.
Neither overlay validator fires at all. So the author is downstream of the
commit call, inside the accepted-state transaction.

## THE WRITER, NAMED

`src/store/programStore.ts:1449-1462`, the accepted-snapshot repair:

```ts
weekScopedOverlays[weekStart] = {
  ...(overlay ?? { … 'accepted_week_repair' … }),
  workoutsByDate: overlayWorkouts,      // ← from accepted.canonicalWorkouts
  exposureContractV2: accepted.contract, // ← the GATEWAY'S OUTPUT
  updatedAt: now,
};
```

It re-authors **both halves** of the stored week from
`runSection18AcceptedWeekGateway`'s result, after every door's projection has
already been derived. It is not in the declaration reader census
(`R53_DECLARATION_READER_CENSUS_2026-08-06.md`), not in the leg (v) writer
scaffold's two publication sites, and not in the five-writer mirror census. It
is the fifth site, and it is the one that decides.

## THE PREMISE THAT IS REFUTED

The declared parity entry `stored_declaration_costs_mondays_power_row` states,
and the seat's move (i) rests on:

> What costs the row is the stored DECLARATION being present at READ.

**Measured false.** The declaration was replaced with the derived one at four
sites and the diff did not move by a single row. What costs the row is the
stored **PAYLOAD**: `workoutsByDate` is materialised from
`accepted.canonicalWorkouts` — the week *before* the visible resolver runs — and
a stored day OUTRANKS the base at read (`rules/dayPrecedence.ts`), so the
resolver has nothing left to re-add the missing work to. The entry's `why` is
right about the direction (STORED-WRONG, the derivation ships) and wrong about
the mechanism. `a-ruling-premise-is-a-claim-too`, sighting 2 — right OUTCOME,
wrong MECHANISM, and this time the premise was the seat's *and* mine.

This also means the parity gate cannot go green "BY CONSTRUCTION" by filling the
declaration. Filling the declaration is not sufficient in any world measured.

## §5 — THE ELEGANT ALTERNATIVE §8 REQUIRES

**The wall's precondition is the assumption that the writer is a PLACE.** Every
one of the four attempts assumed the declaration has a publication site that can
be taught to derive. The tape shows the stored week is re-authored by whichever
gateway pass runs LAST, and there are at least five such passes across three
modules. Hunting them is unbounded discovery — the `remove-then-discover-the-
lean` shape the seat's own LOOP CHECK named this morning, now in its fifth
sighting.

**The alternative removes the precondition rather than the wall: DO MOVE (ii)
AND (iii) AND DELETE MOVE (i).**

Move (i) exists only to make what storage holds *correct*. But (iii) makes what
storage holds *unread*. Once every read goes through one accessor and that
accessor derives, **what any writer stores is irrelevant by construction** — all
five writers, and any sixth nobody has found, become harmless in the same
commit. Storage becomes write-only immediately instead of after an unbounded
writer hunt, and the seat's stated endpoint ("after (iii), derived is the sole
authority, proven") arrives by a shorter path with fewer representations
touched. This is the Elegant Solution Requirement applied to the seat's own
plan, exactly as §8 orders.

**What it costs, stated honestly, because it is the seat's call and not mine:**

1. **The parity gate changes role.** Move (i) promised green-BY-CONSTRUCTION and
   a permanent guard. Under the alternative there is no longer a stored week for
   the gate to compare against, so `lawful-5` goes **VACUOUS**, not green. The
   gate would need re-aiming at the property that still matters — *no read
   answers from storage* — which is a one-door assertion, not a week diff. That
   is a smaller and stronger gate, but it is a different gate.
2. **The declared-diff entry expires by a different route.** Not "the diff stops
   happening" but "the comparison stops existing". Under the stale-debt
   ratchet's own law that is a MOVED-not-PAID deletion unless the entry is
   rewritten — the same trap `debt-deletions-are-writer-coupled` recorded this
   morning on the second entry.
3. **The Vertical Jump Monday still lands**, and by the shorter route: the
   derived week already IS the 8-row Monday (`2026-08-10=Lower Squat|8`,
   reported by `lawful-4` in all three worlds, on the branch, today).
4. **Ordering risk moves to (ii).** With no (i) ahead of it, the census tape
   re-run after (ii) becomes the only thing standing between a mechanical
   refactor and a silent behaviour change. It has to be exact.

## WHAT IS MEASURED AND WHAT IS NOT

**MEASURED.** Four sites installed and priced against the parity gate
(`test:derived-week-lawfulness`, UNPIPED, exit code read, never a totals line);
the stored declaration diffed leaf-by-leaf against the derived one in all three
gate worlds (W2, W2r, W3-fixture-only) at every step; the three-seam write tape;
`buildFixtureProjection` fires 30×, both validators 0×.

**NOT MEASURED, and nothing here rests on it.** No full `test:bible` was run —
the arm never reached a state worth pricing, so the branch's 2-of-156 stands
un-rechallenged. The alternative in §5 is **NOT priced**: its cost is argued
from the tape, not measured, and the seat should treat the four costs above as
claims until (ii) is taped. No device evidence. The fifth writer is named but
its other callers are not enumerated — that enumeration is the first thing (ii)
owes.

## THE STOP

Move (i) is **NOT BUILDABLE AS WRITTEN** and §8 forbids attempt five. The seat's
three-move unit stands, but its first move needs either a new target (the fifth
writer, with its own census) or deletion in favour of §5. **That is a ruling,
not a re-price** — it changes what the gate proves and how the declared debt
retires. V3 is NOT closed.
