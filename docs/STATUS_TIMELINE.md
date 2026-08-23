# STATUS — seat `timeline`

Opened 2026-08-24 for Sam's approved audit item 2: Progress must retain gapped
lift history and draw time honestly. The repair is one timeline correction, not
separate exceptions for old records and chart rendering.

## Baseline

- `test:journal-strength-trend`: 17 green / 0 red.
- `progressTabOwnershipTests.ts`: 9 green / 0 red.
- The current history caller passes the distinct recorded-week count as a
  contiguous window length. Three recorded weeks spread across three months
  therefore inspect only the latest three calendar weeks.
- `LineChart` receives numbers only and derives x from array index, so the date
  attached to each strength point is discarded before layout.

## Checkpoint

- `journalStrengthTrendTests`: 18 green / 0 red. Every recorded week up to the
  visible week is retained; calendar gaps no longer erase older results.
- `progressTabOwnershipTests`: 13 green / 0 red. Charts keep their dates, space
  points by elapsed days, sort time forwards and show the visible date range.
- `test:coach-snapshot`: green across Snapshot, populated state, Progress
  ownership, Coach Lab and read-only chat integration.
- Two liveness mutations were killed: limiting history to the latest two points
  killed the gapped-history cell; reverting x positions to array indexes killed
  the elapsed-time cell.
- The populated iPhone 17 Pro simulator journey passed. Progress rendered load,
  the saved 2km result and two-column lift charts with their date ranges; the
  existing Coach shell and Mobility completion checks also remained green.
- The repository compile census remains red in unrelated existing files. A
  changed-file diagnostic found no compiler error in this checkpoint's files.

NOT COVERED: physical iPhone acceptance is deliberately batched until the end,
per Sam. Storage currently owns one 2km answer, so this checkpoint does not
invent a historical 2km series.
