# Lower Prehab consolidation — 2 September 2026

Owner: `lowerprehab`

## Outcome

`SL 45° Back Extension Hold` and `Swiss Ball Hamstring Curl` now live in the
single authored `Lower prehab` pool in both the master workbook and app code.
The separate athlete-visible `Hamstring (light)` pool has been retired.

Hamstring-specific programming seats still select the appropriate entries by
using a derived view of `Lower prehab`; that view is not a second catalogue
pool or a second author.

## Design choice

1. Rename the old heading only — rejected because it would leave duplicate
   ownership and could make the two routes disagree.
2. Use one authored Lower Prehab pool, with a filtered hamstring view only where
   a session specifically asks for hamstring prehab — chosen because it keeps
   one source of truth without removing existing programming routes.

## Verification

- Red-first workbook equality correctly failed on both exercises before code
  followed the workbook.
- `test:muscle-experience`: 97/97 green.
- Mutation witness: removing Swiss Ball Hamstring Curl from Lower Prehab made
  the gate fail two relevant cells; restoring it returned 97/97 green.
- `test:exercise-bible-library`: 164/164 green.
- `test:mobility-accessory-doors`: 33/33 green.
- `test:optional-topup`: 30/30 green.
- `test:automatic-weekly-selection`: 13/13 green.
- Session-type charter's Lower Prehab census is green; four unrelated existing
  Primer/Recovery assertions remain red.
- Product and devtools TypeScript compile with zero errors. The test compile is
  red on seven unrelated errors in `sessionWorkOwnershipJourneyTests.ts`.

## NOT COVERED

- Full-year generation or PDFs.
- Simulator or physical-iPhone acceptance.
- Every injury and equipment combination.
- Existing unrelated red repository suites.
