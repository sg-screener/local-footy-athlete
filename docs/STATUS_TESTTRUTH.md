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

## 2026-08-27 — step 2: the saved red fleet is classified

### LOOP CHECK

This is the second sighting of old red suites being mistaken for instructions
to restore old product behaviour. Step 1 stopped that authority leak. Step 2
compresses the saved failure set into an executable decision register so the
same failures cannot be reinterpreted from scratch by the next seat.

### Two options weighed

1. Incremental: delete every currently red test or edit its expected values
   until the chain turns green. This would erase useful subjects and make test
   output dictate the product again.
2. Ownership redesign: run the entire saved red set at one stable checkpoint,
   classify the evidence before changing a test, retire only suites whose
   production owner is gone, and keep every surviving subject explicitly red
   for rewrite against the current compiler.

Option 2 landed. The classifier is deliberately conservative: an assertion
failure is a `rewrite_test` until a production path, current contract and
witness prove it is a `current_contract`.

### Stable census and exact units

Instrument: `TEST_TRUTH_CENSUS_REPO=/tmp/lfa-testtruth-census.qF9Bfg node
scripts/test-truth-census-runner.js --failures
.sweep/fails-audit-2026-08-27-postfix.txt --out
/tmp/testtruth-census-aa2167e2.json --jobs 4 --timeout-ms 180000` against a
clean detached `aa2167e2` tree. The checkpoint stayed unchanged for the run.

- 167 distinct saved failure labels.
- 136 reached assertions or a later runtime failure.
- 13 died at startup; 11 died at another runtime seam.
- 2 are green now and carry current-contract receipts.
- 1 printed its assertions and then held an open handle for 180 seconds.
- 2 were aggregate runners, and 2 were missing command aliases.

The reviewed decision register has 175 distinct command rows: the 167 saved
labels, the two corrected canonical commands, and six test files that formerly
had no command. Its disposition is 166 `rewrite_test`, 2 `current_contract`, 2
`retire_test`, 3 `test_infrastructure`, and 2 `aggregate`.

The six formerly unreachable suites now all execute as commands: one startup
failure and five assertion/late-runtime failures. They remain rewrite work and
cannot direct product changes.

### Removed only when the owner was actually retired

- `coachPromptContractTests.ts` asserted the deleted static `SYSTEM_PROMPT`.
  Current ownership is retrieved canonical knowledge plus the automatic coach
  response contract (`test:coach-chat-integration`, `test:coach-lab`).
- `persistentInjuryStateTests.ts` asserted the retired `activeInjury` snapshot
  and read-time injury filtering. Current ownership is injury episodes plus the
  fallback journey and latest-severity authority
  (`test:injury-fallback-journey`, `test:injury-latest-severity`).

The retirement guard refuses a row while its old file still exists or when it
does not name existing replacement commands. The current replacement fleet is
not claimed green: Coach Lab and latest-severity are green; Coach integration
has 1 generated-artifact parity failure; injury fallback has 27 failures.

### Test infrastructure repaired

- The two missing aliases now point at the existing canonical commands:
  `test:exposure-engine` and `test:in-season-midweek-row`.
- Recursive `test:bible:parallel` and `test:bible:serial-set` entries were
  removed from inside `test:bible`; the commands remain available as tools.
- Six unowned test files received commands, taking the runnable-suite ratchet
  from 6 files to 0.
- The parallel runner's wall-clock detector no longer mistakes strength copy
  containing “hard ceiling” for a timing assertion. Its mutation self-check is
  2/2 and its derived list is 349 units.

### Verification

- `npm run test:test-truth`: 14/14 census/authority cells and 5/5 runnable-suite
  cells green.
- `node scripts/test-truth-audit.js --failures
  .sweep/fails-audit-2026-08-27-postfix.txt`: 167/167 reviewed; 2 may direct
  product changes; 0 missing commands; 0 recursive aggregates.
- `node scripts/bible-runner.js --self-check`: 2/2 green.
- `node scripts/bible-runner.js --list`: 349 derived units, exit 0.
- `npm run test:repo-law-guards`: 52/63 green, 11 pre-existing repository debts;
  removal of the obsolete coach-prompt suite lowered its anchor-debt registry.
- `npm run test:totals-or-red-law`: 1/4 green; its three fleet-wide debts remain.
- `npm run test:compile`: 473 recorded errors and 63 regressed file/scope pairs
  across the shared dirty tree. The new test-truth file was fixed to zero
  TypeScript errors; no baseline was rewritten around the wider failures.

### North star and visibility

No product behaviour, athlete fact, accepted week or UI was changed. The
change removes dead test ownership and makes every remaining old failure name
what it is allowed to influence. **NOT-VISIBLE:** this is test architecture;
there is deliberately no simulator or phone change.

### NOT COVERED

- The 166 rewrite rows have been classified, not individually rebuilt. Their
  subjects remain work for the compiler/test migration stage.
- `test:stage-b-generation-differential` still retains an open handle after its
  assertions; it is named test-infrastructure debt, not repaired here.
- The full `test:bible` chain is not green and no such claim is made.
- The wider repo-law, totals-or-red, typecheck, Coach integration and injury
  fallback failures named above were measured but not silently fixed.
- No product code, weekly compiler, coach behaviour, UI, simulator or physical
  iPhone path was changed or tested.
