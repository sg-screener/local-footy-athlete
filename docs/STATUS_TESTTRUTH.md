# STATUS — TEST TRUTH

Owner: `testtruth`

## 2026-08-27 — step 1: red tests no longer author product changes

Scope is test tooling only. The scheduler/compiler files already being edited by
another seat are untouched.

### Two options weighed

1. Incremental: keep reading red lists by hand and annotate individual failures
   in reports. This preserves the second, drifting list and still lets an old
   assertion be mistaken for a product instruction.
2. Source-of-truth redesign: derive the fleet from `test:bible`, automatically
   classify structural faults, and require a small evidence-bearing decision
   before any failed assertion may direct a product-code change.

Option 2 landed. There is one empty decision register ready for the actual
census; it does not pretend any of the old failures have already been reviewed.

### What the first run measured

Instrument: `npm run audit:test-truth -- --failures
.sweep/fails-audit-2026-08-27-postfix.txt`.

- 353 chain units: 352 `npm run` units plus the leading Bible conformance unit.
- 167 failure-label records from that saved sweep.
- 2 records are missing commands, 2 are aggregate runners, and 163 are
  unreviewed assertion failures.
- 0 of those 167 failure records currently has authority to direct a product
  change. This does not say none is a real product defect; it says none has yet
  paid for that claim.
- 6 distinct test files remain unrunnable, held by the existing ratchet that is
  now part of the same first gate.

### Guard and liveness

`npm run test:test-truth`: 11/11 new cells green, followed by the existing
unrunnable-suite ratchet at 4/4. The truth audit is the first unit in the
official Bible chain. Its mutation arm adds a nonexistent chain command to an
in-memory copy of the real package and observes the audit turn red with the
exact new command named. A second negative control attempts to promote an
unreviewed failure without product, contract and witness receipts and is
refused; a positive control carrying all three is accepted.

### Wider gates observed, not repaired

- `npm run test:compile`: 470 errors in its instrument (25 product, 49 devtools,
  396 tests), red on 63 worsened file/scope pairs. The new test-truth file is not
  among them.
- `npm run test:repo-law-guards`: 52/63 cells green, 11 red; every named red is
  pre-existing repo/report/flow/writer/anchor debt and none names this unit.
- `npm run test:totals-or-red-law`: 1/4 cells green; the new suite is armed and
  is not in any of its three failure lists.
- `npm run test:bible-anchors`: 292/295 cells green, 3 red; none names this unit.

### North star and visibility

Neutral on stored product state: no athlete decision, fact, result or derived
program shape changed. This makes verification converge on one derived list
instead of creating another hand-copied fleet. **NOT-VISIBLE:** this is test
infrastructure; there is deliberately no app or simulator change.

### NOT COVERED

- The 163 unreviewed failures are not yet classified as KEEP / REWRITE / DELETE;
  that is step 2.
- The two missing commands, two aggregate runner entries and six unrunnable
  files are named but not repaired or removed.
- No product code, weekly compiler, coach behaviour, UI, simulator or physical
  iPhone path was changed or tested.
- The full Bible chain was not claimed green; it remains structurally invalid
  and broadly red beyond this first gate.
