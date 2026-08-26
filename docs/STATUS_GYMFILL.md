# STATUS — seat `gymfill`

Opened 2026-08-26 for Sam's audit item 2: preserve the optimal core week, then
use genuinely spare capacity for a gendered optional gym session and an
equipment-free optional mobility session instead of drawing unexplained empty
days.

## Acceptance reading

- R-235 remains the controlling count rule: the gym-day answer is a ceiling,
  never a quota. Core strength frequency is still chosen by the phase, fixture,
  spacing and feasibility laws.
- Sam's item-2 follow-up adds what a legal spare day should OFFER: a male
  Gunshow or female Primer on spare gym capacity, plus optional mobility that
  requires no gym equipment. These offers do not become required sessions and
  do not consume the weekly rest arithmetic.
- Equipment-free running already has a separate scheduler path outside gym
  access. This unit must preserve that owner rather than manufacture another
  running placement.

## Options compared before editing

1. Extend the existing owners: the weekly scheduler already owns the gendered
   composed optional, and the post-acceptance top-up pass already owns mobility.
   Generalise those two decisions while keeping composition in the existing
   session builder.
2. Add a new final "fill empty days" pass after generation. Rejected: it would
   become a second day-existence owner beside the scheduler and a second
   optional-placement owner beside the top-up pass, recreating the exact drift
   this architecture has been removing.

Option 1 is the smaller source-of-truth change and is the working direction.

## Baseline

- The scheduler's Gunshow/Primer offer is fixture-relative: In-season, exactly
  one game, empty G-1 only. A spare gym day in any other phase receives neither.
- Mobility is explicitly suppressed in Pre-season and In-season by the 2026-07
  top-up interpretation, even though the Bible permits optional mobility on any
  day and Sam has now directly asked for a bodyweight-only spare-day offer.
- The top-up caller treats preferred gym days as the only optional candidate
  set. That is correct for equipment-using accessories and wrong for the new
  equipment-free mobility offer; widening the one shared list would wrongly let
  accessories leak onto non-gym days.

Measured through real generation before product edits: 8 acceptance cells
passed and 6 failed. The failures were missing in-season, pre-season and
three-day Mobility; missing pre/off-season Gunshow; and the Off-season top-up
path being unable to see empty Rest shells as available.

## Built

- The weekly scheduler now keeps the signed one-game G-1 offer, keeps the
  multi-game refusal, and uses one genuinely spare gym day for the gendered
  optional offer in no-game weeks across all phases.
- The post-acceptance top-up keeps Accessories on gym days and gives
  equipment-free Mobility its own all-governable-day candidate set. Every phase
  offers one; Off-season keeps two total.
- G+1 accepts Mobility because it is recovery-class but still refuses
  Accessories. Game day and G-1 remain protected.
- Auto Mobility deliberately composes with bodyweight-only eligibility even
  for a full-gym athlete.
- One shared explicit-Rest predicate lets an offer replace the placeholder.
  The craft seam removes that placeholder only when it keeps the offer; a
  withheld offer leaves Rest intact.

## Evidence

- Real generation tape: 20/20, covering male three-, four-, five- and six-gym
  answers, both gender arms in a no-game week, female five-day, Pre-season and
  Off-season. Every world has one workout per date.
- Direct optional-owner tape: 30/30, including separate gym/equipment-free
  candidates, G+1, Rest replacement and 28 dated bodyweight compositions.
- Weekly scheduler chain: green, including 99/99 pure scheduler cells, 11/11
  generated fixture cells, zero-equipment and Off-season continuity.
- Session type charter: 44/44. Generated-week contract: 36/36.
- Mutation witnesses: zeroing the every-phase Mobility target killed four real
  generation cells; disabling no-game gendered placement killed Pre-season and
  Off-season cells; removing bodyweight narrowing selected Dumbbell Pullovers
  on 2026-08-03 and killed the equipment cell.
- Simulator, iPhone 17 Pro / iOS 26.3: the focused visible flow is green. The
  week visibly shows Wednesday OPTIONAL Mobility, Friday OPTIONAL Gunshow,
  Saturday Game Day and Sunday Rest Day. The first text-only scroll selector
  missed despite the content being on its failure screenshot; the exact row
  accessibility identities then passed and are the retained instrument.

## Existing red state observed

- The craft-tier tape now reaches its assertions after adding the required
  gender to its stale fixture; it remains red on its inherited M1 mutation
  witness (31/32). The top-up seam cells E1-E3 are green, including Rest-shell
  preservation/replacement.
- Generated-week assembly remains stopped by its inherited undefined slot pool
  in `composeWeek`; the independent generated-week contract is 36/36.
- Law registry remains at its established three reds: nonexistent
  `test:game-feedback`, unregistered LR-18 and 21 UNENFORCED laws. The new law is
  guarded and in-chain.
- Compile sees no reported regression in the product files changed by this
  unit, but the shared checkout is far above its stored baseline from concurrent
  work (481 total errors and 63 worse file/scope pairs).

## NOT COVERED

- Physical-iPhone Release acceptance.
- Every injury/equipment combination and athlete-added multi-game optional
  sessions.
- Long-term adherence or whether athletes choose the optional offers.
