# Physical-phone action repair

Owner: `actionrepair`

## Boundary

- Starting branch: `codex/failure-only-state-export`.
- Starting checkpoint: `0cb7a359` (`Fix accepted lived-history foundations`).
- Preserve every unrelated tracked and untracked change in the shared checkout.
- Fix only the three confirmed action defects: G-1 Move answer durability,
  fixture repair publishing a strong G-1 violation, and accumulated Going Away.
- Do not modify the lived-history foundation, start the 52-week audit, or touch
  either physical phone.

## Two options before coding

1. Patch each observed producer: add `g1Route` to drag and menu payloads, add a
   G-1 check to the one relocation loop, and special-case the observed travel
   ledger order.
2. Repair the existing source-of-truth boundaries: make the selected route part
   of the one durable plan-change action; make the accepted fixture gateway
   reject every strong candidate from its existing validator; and make one
   atomic travel/equipment intent compile against the canonical accumulated
   ledger while returning its typed refusal.

Option 2 is the target. It removes the three omission/partial-publication
classes without creating a second move, fixture, or travel system. If current
source already contains part of that design, the smallest completion of the
existing owner wins over adding a parallel abstraction.

## Starting overlap check

- `docs/STATUS_HISTORYFIX.md` owns the lived-history foundation and is finished
  at `0cb7a359`; those production files are out of scope here.
- Existing uncommitted `docs/NOW.md` and
  `src/__tests__/dayFirstTimelineTests.ts` belong to other work and will not be
  staged or edited.

## Implemented

- `g1Route` now crosses both conversions of the existing durable Move action.
  The compiler receives the exact visible route; no parallel G-1 move system was
  added.
- Fixture repair excludes date-exact G-1 from automatic strength and
  conditioning relocation, rejects strong `g1_not_light` alternatives during
  candidate selection, and filters them again at rolling-horizon publication.
  G-2 is still decided by the existing validator/primer rules; there is no
  blanket G-2 exclusion.
- Away now sends one `set_schedule_modifier` intent containing the span and the
  equipment answer. One `commitTemporarySourceFactSet` publishes both facts or
  neither. The existing linked-trip Clear resolves both.
- The sheet now says the athlete is away **through the day before return** and
  that the normal plan resumes on the selected return date. This preserves the
  existing ruling; it does not change date semantics.
- Typed schedule/equipment refusal reasons reach the acknowledgment mapper.
  Away failure copy says why the save failed and explicitly says travel and
  equipment stayed unchanged.

## Complete action matrix

Maintained command: `npm run test:physical-phone-action-matrix`.

| action | proximity/state/route coordinates | production journey result |
| --- | --- | --- |
| Move | drag + menu; occupied + emptied-by-action G-1; single + multi-part source; deloaded + Gunshow + Primer + accessories; restart + Undo | 35/35 green |
| Fixture Add/Move/Remove | Sat→Sun, Sun→Sat, consecutive Sun/Sat fixtures, bye removal, occupied/cross-week repair, G-1/G-2 validation, restart + Undo | 16/16 green |
| Away + Bodyweight | clean moved-Sunday state and accumulated fatigue→poor-sleep→moved-game→restart ledger; 31 Aug through 5 Sep, return 6 Sep; reject/succeed/clear/restart | 20/20 green |

The fixture matrix validates every materialised delivered week with
`validateProgramWeek`: zero strong/hard-stop G-1 findings and zero work
forbidden by the existing G-2 rules. The displaced Monday session identity is
still present after repair, so the safety result is not obtained by deletion.

## Mutation receipts

- Dropped `g1Route` at the screen→durable conversion: G-1 matrix exited 1 with
  8 failures; all four answers reconstructed as unanswered asks.
- Disabled both automatic G-1 placement protection and the final strong-G-1
  publication filter: fixture matrix reddened on a delivered strong G-1
  practice-match Add (`2026-03-27`).
- Injected accumulated Away candidate rejection at the accepted gateway:
  exact typed reason
  `temporary_source_fact_visible_candidate_test_rejection`; neither travel nor
  equipment fact survived and the typed athlete copy was selected.
- Removed the equipment fact from the atomic candidate: accumulated Away
  matrix reddened twice (missing linked equipment fact; Barbell/Rack rows still
  visible). All mutations were restored before the final green matrix.

## Verification

- `npm run test:physical-phone-action-matrix` — green, 71 journey assertions.
- `npm run typecheck` — green.
- `npm run test:temporary-source-facts` — 81/81 green, including linked-trip
  failed-Clear rollback, atomic Clear and restart.
- `git diff --check` — green.

Pre-existing release-gate debt was reproduced unchanged from an isolated
`0cb7a359` archive:

- `test:accepted-state-transactions`: 14 failures at baseline and current.
- `test:g1-landing-ask-flow`: 9 failures at baseline and current (22/31 green).
- `test:week-validator`: 2 failures at baseline and current (47/49 green).
- `test:program-control-durable`: baseline had 4 failures; current has 3. This
  repair turns the Away acknowledgment/conditional-close cell green; the
  durable-move, record-only-away-overlay and busy-copy debts remain.
- Legacy `test:away-flow` now passes the repaired atomic cells and generation
  probes, then reaches its pre-existing removed export
  `weekIdentityForWeekForTest` and stops. It is not part of the green action
  matrix; the new clean/accumulated production suite owns this repair.

## Historical rejection code

The preserved phone database/export itself is not present in this checkout, so
the exact code emitted by that historical failed transaction cannot be
recovered after the fact. The exact relevant action order was reconstructed and
now succeeds. The rejection witness above proves the repaired wire carries the
real typed code and stays atomic for any rejection; a future preserved-state
run will expose its actual reason instead of the generic message.

## NOT COVERED

- No 52-week/lived annual audit was started.
- No simulator or physical-phone pass; neither phone was installed, wiped or
  modified. Athlete-facing completion still awaits Sam's physical-iPhone
  acceptance under L10.
- No attempt was made to repair the separately listed pre-existing red gates.
- The unavailable historical phone database means its original rejection code
  remains forensic-unknown; the reconstructed accumulated state and injected
  typed rejection are covered.
