# R5.3 — THE ONE-OWNER BOUNDARY, BUILT ON THE SCAFFOLD AND PRICED (2026-08-07)

LOOP CHECK: ruled-structural-fix-priced-on-the-scaffold-before-build — the
standing price-before-build law applied to the fourteenth-pass ruling, ITERATE
(the pricing pattern is already the endorsed standing shape; nothing new to
compress).

Fifteenth pass. Answers the fourteenth-pass ruling's (c). Probe at `c076f53f`
on scratch/r53-pricing-7-probe. **NOTHING BUILT** — the boundary is
scaffold-flag-gated (`LFA_SCAFFOLD_BOUNDARY=1`), inert by default, and the
branch is untouched.

## (a) BUILT AS ORDERED — the boundary is ONE owner, at the assembly

`section18AcceptedWeekGateway.ts`, top of `resolveCandidate` — the one place
every candidate (primary, displaced-capacity-reduced, regenerated, fallback)
has its mutable day-set assembled. The contract's own `governedFromISO`
partitions the candidate week THERE:

- days before the boundary are FACTS — they never enter the normaliser chain
  (removal constraints → derived expiry → **safety finaliser** → power budget
  → **offer placer**) and never enter the repair search;
- reassembly re-attaches the fact days byte-exact, which by construction also
  REFUSES anything a writer tried to place on a fact day — a writer that never
  learned the law cannot over-reach, and cannot smuggle either;
- readers keep the whole week: the visible resolver and the evaluator see the
  assembled week (the evaluator already counts pre-boundary days as delivered
  history, `section18EffectiveWeekEvaluator.ts:518-520`).

No writer was taught anything. The finaliser and the offer placer are
unmodified.

## (b) THE HEADLINE MEASUREMENT — fact-horizon GREENS

| arm | fact-horizon |
|---|---|
| flags off (prior pass, reproduced this pass) | 14/0 |
| `LEG_II=1` (reproduced this pass, before the probe) | **12/2** — both T4 rewrites |
| `LEG_II=1 BOUNDARY=1` | **14/0** |
| `BOUNDARY=1` alone | 14/0 |

Both T4 failures (illness_severe and cooked_week each rewriting completed
2026-07-20 and 2026-07-21 High→Moderate) are gone, and T3's byte-exact
restoration still passes. The suite that named the destroy-class is green with
the boundary in place and leg (ii) live.

## (c) THE OTHER SIX — the boundary touches NONE of them

All six of leg (ii)'s remaining reds were run individually under
`LEG_II=1 BOUNDARY=1` and again under `LEG_II=1` alone in the same worktree,
and their failure text diffed — **all six are byte-identical FAIL lines**, not
just identical totals (the red-count law):

- `accepted-state-transactions` — "Pre-season hydration drifted" +
  "following-week dependency was not committed in the same snapshot"
- `program-control-durable` — "a move committed durably reaches the visible
  week"
- `work-bill` — "add: a category add bills only its decision + declared
  mirrors"
- `session-list-combinations` — "[1] every reached coordinate agrees, except
  the declared ones"
- `device-pass-2026-08-05-evening` — "evening-3-game-day-sheet: the sheet
  opens and its Remove action is honoured"
- `action-walker:deep` — L-P3 TEMPLATE = PROJECTION, same coordinate
  (2026-07-27 omits `["speed"]`, invents `["support"]`)

**The tenth-pass "one root may explain three or four" hypothesis is REFUTED by
measurement.** Bounding tier 4's reach over facts fixes exactly ONE of the
seven: fact-horizon. The masked pair (`session-list-combinations`,
`device-pass-2026-08-05-evening`) is still red under (ii)+boundary — the
boundary is not what (iii)+(iv) were supplying.

## (d) THE FULL RE-PRICE — measured combinations only

All 154 suites per arm via `scripts/sweep.sh` (world-identity preamble printed
in every arm, head `c076f53f`, symbol verified in-tree):

| arm | failures | diffed as sets |
|---|---|---|
| eleventh-pass control (flags off) | 6 | reference |
| `BOUNDARY=1` alone | **6** | **identical set** — 0 new, 0 fixed |
| `LEG_II=1` alone (eleventh pass) | 13 (7 new) | reference |
| `LEG_II=1 BOUNDARY=1` | **12** | **= 13 − fact-horizon, 0 new** |
| (ii)+(iii)+(iv)+basis (eleventh pass) | 11 (5 new) | reference |
| (ii)+(iii)+(iv)+basis + BOUNDARY | **10** | **= 11 − fact-horizon, 0 new** |

Three properties, each measured not argued:

1. **The boundary is free.** Alone it reproduces the control set exactly
   (5 scaffold-only reds + `fixture-identity`).
2. **It fixes fact-horizon in every measured combination** and nothing else,
   anywhere in the 154.
3. **It does not interact.** The (iii)+(iv) masking of
   `session-list-combinations` and `device-pass-2026-08-05-evening` persists
   unchanged beside it (both green in the combo arm, red in the (ii) arm) —
   the boundary neither supplies nor disturbs whatever the masking mechanism
   is. Per-leg prices still do not add; these are combination measurements.

## (e) THE WRITE DOOR'S IMMUNITY, READ AT SOURCE — the boundary FEEDS it

`temporarySourceFactTransaction.ts` enforces the same law three ways: it
STAMPS `governedFromISO` at generation, it PINS history for the generator, and
it POST-FILTERS the overlay (`:565-570` keeps only
`date >= governedFromISO` so resolvers fall through to the untouched base —
byte-exact preservation by construction). Two readings matter for the fix:

1. **The post-filter stays load-bearing.** It is a STORAGE guarantee — it
   keeps overlay keys off history entirely. The read-side boundary cannot
   replace it and does not try.
2. **The pin CONSUMES the tier-4 projection.** `pinnedHistoryWorkouts` is
   `rebaseAcceptedEffectiveWeek(...).visibleWorkouts` filtered to pre-boundary
   dates — the very projection the finaliser was rewriting. Before the
   boundary, the write door could pin SOFTENED history and hand generation a
   lied remainder basis. The one-owner boundary makes the write door's own
   input truthful. The two enforcement sites are not rivals; the read-side
   owner upstream is what the write-side pin was silently depending on.

## (f) FOR THE SEAT

- The §18 signed-behaviour posture is as the ruling stated: no signed sentence
  moved — `section18SafetyBoundaryTests` pins the finaliser's mapping, which is
  untouched; the offer placer still implements the 2026-08-06 offer-survival
  ruling on every governable day. The athlete-visible consequence (a completed
  day that displayed softened intensity now displays what was completed)
  stands flagged for Sam's veto, not signed.
- Build order, decided by the ruling's own condition ("the leg (ii) re-price
  with the boundary in place decides"): with the boundary in the unit,
  leg (ii)'s price in the ruled combination drops from 5 to **4** —
  `accepted-state-transactions` (determinism + atomicity),
  `program-control-durable` (durability), `work-bill` (billing),
  `action-walker:deep` (L-P3) — plus the masked pair that only shows alone.
  Under the standing conditions the unit still cannot land with 4 new reds,
  so the boundary joining the build does not unblock the landing by itself;
  it removes the destroy-class red and the rest queue behind their own roots,
  which remain unnamed. Worst-first among the remainder is the seat's call —
  offered, not taken: `accepted-state-transactions`, whose two failures are
  the unit's only atomicity/determinism laws, the class nearest the
  destroy-class just retired.
- Compression (sighting 4, the `governedFromISO` census gate): still proposed,
  not built — it belongs to the build unit, not the pricing probe.

## NOT COVERED

- The six persisting reds are characterised by failure-text diff, not
  diagnosed; their roots remain unnamed, worst-first order is the seat's call.
- The probe partitions by `governedFromISO` only; it does not consult per-day
  completion state (the tape's `done=false` oddity and the `today=wall-clock`
  reading stay parked, recorded in the fourteenth pass).
- `test:compile` is outside the sweep (scaffold-type artifacts, per the ninth
  pass); the probe was not typechecked beyond execution.
- Repair-search placements aimed at fact days are refused by reassembly, but
  no suite was found that exercises a repair TARGETING a fact day; that class
  is enforced by construction, not witnessed by a test.
