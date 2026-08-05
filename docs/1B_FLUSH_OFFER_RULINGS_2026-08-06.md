# 1B FLUSH OFFER RULINGS — 2026-08-06

Sam's rulings on the two questions in
`docs/1B_FLUSH_OFFER_REASSESSMENT_ADDENDUM_2026-08-06.md`.
Verbatim answer: **"1a, 2a"** (Sam, 2026-08-06, morning).

Both questions were already answered by Sam's recorded laws; they are
recorded here as APPLICATIONS of those laws, not new decisions. Per the
RULE-DON'T-ASK section of `docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md`
(Sam, 2026-08-06), future applications of these laws are ruled by the
review seat with a one-line veto notice, not asked.

## Ruling 1 (1a) — ONE OWNER derives the §18 conditioning role

The role of a conditioning session (required core / planner-selected /
optional flush) is a FUNCTION of the contract plus the week's content.
It is DERIVED, never stored and never re-stamped.

- One owner: the derivation lives at the layer that already evaluates a
  week against the contract (`section18EffectiveWeekEvaluator`, per
  addendum question 5).
- Every other writer stops writing: `fixtureMinimalReplan`'s conditioning
  shortfall + role stamping and `postGenerationConstraintValidation`'s
  `?? 'planner_selected_core'` default RETIRE;
  `canonicalPlanChangeCandidateMaterializer`, `coachRevisionOverrideWriter`
  and the accepted-week gateway stop authoring/copying the field and read
  the derivation.
- The held branch `fix/1b-flush-offer` (`5bf74a8e`) — declare-then-place
  plus core selection refusing a typed `optional_flush` — is approved to
  land on top of this ownership.

Law applied: NORTH_STAR (store only decisions, derive everything else),
L15 (one write format), the one-projection precedent (L-P1–P8).

## Ruling 2 (2a) — a flush does NOT survive a fixture-change rebuild

The flush is the planner's OFFER, not an athlete decision. On a fixture
change the week re-derives clean: a flush appears only if the rebuilt
week's authored policy declares one (bye-build authored min 0 → no offer;
the rebuilt bye week equals baseline: Saturday hard conditioning built,
Monday clean). Athlete results and decisions persist as always (R4).

Law applied: NORTH_STAR / fixture identity law — decisions persist,
derived content re-derives (same reason `weekScopedOverlays` were never
migrated).

## Tests that prove the boundary

- `phaseStructureConformanceTests` cells 5 and 7 go green; their
  declared-red entries are deleted in the greening commit (ratchet law).
- New cell: while the fixture stands, the placed flush stays typed
  `optional_flush` (never re-roled); after removing the game and
  rebuilding, the week matches the no-1b baseline — Saturday hard
  conditioning present, no flush anywhere.
