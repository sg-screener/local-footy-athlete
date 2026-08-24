# STATUS — seat `coachretrieval`

Opened 2026-08-24 for audit finding MED-13: a hand-tuned athlete-phrase table
had become part of the production Coach brain.

## Options compared

1. Keep adding slang aliases to the phrase table. This can rescue a bench case,
   but every new athlete wording becomes another branch and repeats the retired
   Coach architecture.
2. Use general lexical retrieval: structured Snapshot facts, stemmed terms,
   corpus rarity, strict heading detection and overlapping exact-source chunks.
3. Add embeddings. This is the right escalation if the general lexical bench
   regresses, but needs a versioned vector artifact plus query cost and was not
   justified by the measured result.

Selected: option 2. The `QUERY_EXPANSIONS` and `queryPhrases` tables are deleted.
The athlete message is never expanded through a per-word answer map. Readiness
enum facts contribute their canonical domain terms, while the original question
still reaches Terra unchanged.

## Checkpoint

- IDF-style rarity weighting replaces raw term-count dominance.
- Heading boosts apply only to heading-shaped lines, not every short sentence.
- Source chunks overlap, so one policy section is not lost at an arbitrary
  36-line boundary.
- Program/load/progress facts no longer pollute knowledge retrieval; Terra still
  receives them through the separate whitelisted Snapshot projection.
- The ten messy-question bench retains at least six distinct retrieval sets.
- Coach Lab retrieval: 21 green / 0 red, up from 18 / 0 because the architecture
  itself is now guarded.
- Full `test:coach-snapshot` chain is green.
- Liveness: zeroing structured-readiness weight killed three named retrieval
  cells, including the no-keyword readiness case. The mutation was restored.

## Deployment and paid smoke receipt

- `coach-chat` is ACTIVE as version 5 at 2026-08-24 00:12:14 UTC.
- `coach-lab` is ACTIVE as version 27 at 2026-08-24 00:12:22 UTC.
- One production smoke asked `legs are rooted but dont wanna skip`. Terra advised
  a reduced lower session, used the live low-energy/moderate-soreness facts,
  returned zero actions and made no program-change claim.

NOT COVERED: no embedding benchmark or full nine-answer paid rerun was needed or
run. Simulator acceptance and physical-iPhone acceptance remain owed.
