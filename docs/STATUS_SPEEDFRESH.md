# SPEEDFRESH seat status

Owner: `speedfresh`

Starting commit: `d51a07ccca581f480007b5daf96b179ca41dc7ec`

## Scope

Change only the canonical automatic Speed-day placement decision. Preserve the
existing Speed requirement/quality, conditioning budget, safety, dose,
persistence and athlete-edit owners.

## Two options compared

1. Flip the old `last upper day` lookup to `first upper day`. This is small, but
   it cannot see G+2, the previous day's lower/conditioning/team load, legal
   standalone fallbacks, or candidate-order determinism. It would encode only
   one sentence of the decision.
2. Give the existing weekly scheduler one pure, typed ranking of all legal Speed
   receivers, then make the same scheduler place hard conditioning after the
   selected fresh Speed day when it can. This keeps one placement owner and
   makes every preference and fallback independently testable.

Option 2 is the implementation path because it removes the phase-specific
placement shortcuts instead of adding another one.

## Work log

- Start inspection found the old last-upper preference and separate Pre-season /
  no-club-game shortcuts that forced Speed onto hard conditioning.
- Baseline: the old scheduler's own WC-138 cell required Friday/the last upper
  day. The focused guard was then proven red by restoring that policy in the
  mutation run described below.
- Final focused placement tape: 14/14 green. It covers required placement cases
  1–12, the only-legal fallback and reversed enumeration.
- Real persistence tape: 2/2 green. Cold onboarding/restart reproduced the exact
  week, then Add Mobility + Add Recovery + restart + Undo latest + Undo prior +
  restart preserved the Speed date and restored the exact original week.
- Existing weekly scheduler matrix: 128/128 green. Fortnightly COD: 14/14.
  Generated scheduler fixtures: 11/11. Off-season continuity: 9/9. Spare-day
  options: 22/22. Product and devtools type checks: 0 errors.
- Mutation: replacing the ranking score with the retired upper-first/latest-day
  score made 7 of 14 focused placement cells fail (earliest upper, no-last-
  default, G+2, all three previous-day fatigue sources and later hard work).
  Restoring the ranking returned 14/14.
- Integration check found one subtle existing boundary: a standalone Speed
  allocation renders one Speed block and intentionally ignores a second
  conditioning identity. The scheduler therefore combines Speed plus metabolic
  work only on strength days; a standalone Speed day honestly replaces that
  one conditioning receiver. This preserves the exposure/day count and avoids
  hidden work. No new session type, template or post-generation rewrite was
  added.
- `test:weekly-scheduler` continues past all new and directly related checks but
  stops in inherited `test:travel-zero-equipment` cell 7. An isolated archive of
  the exact starting commit reproduced the same 9/10 result and same finding,
  proving this red predates R-330. The cell receives the
  correct blocking finding `required_safe_patterns_present: the week trains no
  push`, while its assertion requires a different clause name,
  `main_strength_planner_selected_target`. This task does not change that test
  or validator.
- `test:law-registry` recognises the new R-330 guarded row; its standing global
  gate remains red on the repo's existing 21 UNENFORCED laws.

## NOT COVERED

- Full-year PDF audit (explicitly excluded by Sam).
- Simulator or physical-phone installation (explicitly excluded by Sam).
- Full `test:bible`; the narrower in-chain owner was run through its focused and
  adjacent units. The chain already has the 21-law standing red recorded above.
- Physiological field validation of the ranking; this pass verifies the ruled
  deterministic behaviour and app-state boundaries.
