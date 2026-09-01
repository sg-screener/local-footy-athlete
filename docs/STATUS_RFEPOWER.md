# RFE Split Squat Jump — 2 September 2026

Owner: `rfepower`

## What changed

`RFE Split Squat Jump` moved from the retired `power_pool_pending` exemption into the existing canonical lower-body Power pool. It now has one ordinary automatic route rather than a special exercise-specific programmer:

- Off-season and Pre-season only.
- Minimum experience: `consistent` (the app's 2+ years rung).
- Requires a Bench.
- Not available In-season or near games.
- Uses Sam's pinned video: `https://youtube.com/shorts/EY3bzgv2SYo?si=niQWD9Thz0mUex1d`.

The workbook note, selectable vocabulary, equipment requirement, video catalogue and power-pool source now agree. `Speed Bench` and `Speed Trap Bar Deadlift` remain pending and unchanged.

## Design choice

Two options were checked:

1. Add an RFE-specific programming branch.
2. Put the exercise into the existing typed lower-body Power selector.

Option 2 was used. It gives the exercise the same eligibility, rotation, equipment and block-history rules as every other automatic Power exercise and avoids creating another programming owner.

## Verification

- Red-first: adding the approved exercise to the expected pool made the pool-membership and reachability cells fail before implementation.
- `test:power-pool`: 99/99 passed.
- Direct `powerPrimerPolicyTests.ts`: 57/57 passed.
- `test:content-reconciliation`: 20/20 passed.
- `test:equipment-vocabulary`: 95/95 passed.
- `test:quick-exercise-actions`: 64/64 passed.
- The old deload comparison was corrected to compare one identical calendar week with deload on versus off. It previously compared two separate programming blocks and only passed because their old selections happened to match.

## Existing unrelated red checks

- The combined `test:power-primer-policy` command continues into `generatedPowerDeliveryTests.ts`, which currently stops on the separate missing-team-training-days onboarding requirement. The power-primer suite itself is green.
- `test:locked-list` retains its existing no-load-classification failure for seven unrelated exercises.
- `test:compile` retains seven unrelated test-only errors in `sessionWorkOwnershipJourneyTests.ts`; product and devtools typechecks are green.
- Concurrent exercise-intake work owns current Sleeper Stretch catalogue changes.

## NOT COVERED

- A fresh full-year program or PDF audit.
- Physical iPhone installation or acceptance.
- Every athlete/equipment/fixture combination beyond the focused selector cells.
- Clinical validation of the supplied injury and near-game guidance.
