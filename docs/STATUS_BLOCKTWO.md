# STATUS — seat `blocktwo`

Required by CLAUDE.md law 3: *"`docs/STATUS_<YOU>.md` — findings, measurements,
what you tried and backed out. Nobody else touches it."* Kept to the durable
receipt only; the session-by-session narrative was removed at product close.

Branch: `feat/block-two-progression`, based on `8c33df58`.

## WHAT IS ENFORCED

`rules/blockBoundaryProgression.ts` — the block-boundary load owner, decided at
generation time and stored. Guarded by `test:block-two-progression` (31 cells,
in the `test:bible` chain). Registry rows **R-096** (canonical load priority) and
**R-097** (one generation-time owner; projection only displays) — both ENFORCED.

## THE FOUR THINGS THAT COST THE MOST, KEPT BECAUSE THEY WILL RECUR

**1. THE IMPORTER OF A MODULE IS NOT THE CALLER OF ITS BEHAVIOUR.** I reported
that progression ran only at projection time. It did not: the authoring-time
freeze `bakeMicrocycleStrengthProgression` already existed and reached the
progression code THROUGH `sessionResolver`, so an importer grep could not see
it. The real defect was that it was FED `sessionFeedback: {}`,
`weightOverrides: {}`, `workoutHistory: []`, `blockState: null` — four empty
arguments, not a missing layer.

**2. A TEST THAT DERIVES ITS EXPECTATION FROM THE VALUE UNDER TEST CANNOT
FAIL.** The increment cell computed its expected number from
`SMALLEST_AUTHORISED_INCREMENT_KG`. Mutating 2.5 → 5.0 moved both sides and
every cell stayed green. Expectations are pinned literals now.

**3. MUTATION FOUND A COVERAGE HOLE READING NEVER WOULD.** A mutation making
unknown equipment guess `2.5` survived — no cell covered the unknown-equipment
hold, which was an explicitly ruled clause.

**4. TWO QUESTIONS SHARED ONE PREDICATE.** `classifyProgressionEligibility`
(the main/secondary test) was gating what the module LOOKED AT as well as what
it could INCREASE, so accessories were invisible to seeding too — a recorded
Bicep Curl load came back as `0`. Seeding and automatic increase are now
separate scopes.

## NOT BUILT, AND WHY — needs Sam, not code

The stored explanation has no RENDER surface. `ActiveProgramModifier.effect` is
the existing program/status explanation surface, and its phrases are a
Sam-signed set of eight covering injury/temporary-status/restriction. A
block-boundary load change is a ninth kind and needs a signed phrase; inventing
one would be both a coaching and a copy ruling. The typed rows are stored and
guarded; only the rendering waits.
