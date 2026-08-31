# Lived-history foundations

Owner: `historyfix`

## Scope

- Preserve the current shared checkout and all work newer than audited commit
  `860e1fccb89a042b5c09bbdcfdb9917e5df906c5`.
- Fix accepted `actualMinutes` persistence and transaction verification through
  the existing session-outcome fact and transaction.
- Establish one completed-session load total across strength, conditioning,
  team training and games.
- Guard Sam's prescribed-repetitions Estimated 1RM ruling and record F002 as an
  intentional product simplification without changing the original audit files.
- Run the requested short lived preflight only. Do not start the 52-week replay
  and do not install or wipe either phone.

## Starting evidence — 2026-08-31

- Current branch: `codex/failure-only-state-export`.
- Starting HEAD: `03079eb338358f888dc92ce8f58026f43dbcfd0f`.
- `git merge-base --is-ancestor 860e1fcc... HEAD` exited 0: the audited revision
  is contained in the current checkout.
- Production source still reproduces the audited code shape: normalized intent
  carries `actualMinutes`; `feedbackFromIntent` omits it; persistence compares
  against the already-rebuilt candidate; `totalsForWeek` sums only
  `conditioningSRPE`.
- F002 is not production work. Current Estimated 1RM inputs are deliberately
  sourced from the saved exercise weight, displayed prescribed reps and the
  reported last-set RIR.

## NOT COVERED (starting boundary)

- No production change, maintained gate, deliberate mutation, mounted UI,
  restart preflight, typecheck or release result yet.
- No 52-week replay and no phone action.

## Finished boundary — 2026-08-31

### LOOP CHECK

This is the same omission-validates-itself class as the stopped audit, not a
new one-off field bug. The fix makes normalized athlete intent the independent
oracle for every accepted session answer, and makes one completed-load owner
sum every completed session kind. The next omitted answer or load kind now
fails the same guard.

### Two options weighed before coding

1. Incrementally add `actualMinutes` to the candidate and patch each weekly
   consumer to add the three omitted session kinds. This repairs today's two
   symptoms but leaves the candidate validating itself and leaves several
   rival total formulas able to drift.
2. Keep the existing canonical feedback fact, but introduce one semantic
   accepted-answer projection shared by intent, idempotency and persisted-state
   verification, plus one completed-load derivation shared by daily, weekly and
   rolling totals. This removes both defect classes without creating a second
   stored history ledger.

Option 2 landed. A separate lived-history store was rejected because the
accepted session feedback, weight overrides and Estimated 1RM history already
own the durable facts; copying them would create a second truth.

### What changed

- `actualMinutes` is written to the existing `SessionFeedback` fact.
- Transaction identity and verification compare the normalized athlete answers
  with the persisted fact. A deliberate source mutation dropping minutes is
  refused and the exact prior accepted outcome is restored.
- Completed load is `actual minutes × session RPE`, measured in AU, for
  strength, conditioning, team training and games. Daily, weekly and four-week
  totals share that owner. Completed optionals contribute; skipped optionals,
  Totally Cooked/rest and removed facts contribute zero.
- F002 is classified as intentional simplification under R-272: saved exercise
  weight + displayed prescribed repetitions + last-set RIR. An incidental
  12-rep log cannot replace a checked 3 × 10 prescription; the killed mutation
  proves the distinction. Pull-Up, Lat Pulldown, Bulgarian, skip/unanswered,
  RIR 5+ and separate chart histories remain covered.
- R-277 and `LAW-accepted-lived-history-integrity` bind the production journey
  into the existing in-chain `test:journal-load` command. The historical audit
  files were not edited.

### Measured verification

- `test:journal-load`: **166 assertions / 166 green** across two suites —
  `journalLoadTests` 138/0 plus `livedHistoryFoundationTests` 28/0.
- Exact preflight values: strength 60 × 7 = **420 AU**; conditioning 30 × 8 =
  **240 AU**; team training 80 × 7 = **560 AU**; game 110 × 9 = **990 AU**;
  completed optional 20 × 6 = **120 AU**; weekly distinct accepted total =
  **2,330 AU**. The skipped optional contributes 0. Restart reconstructs the
  same daily, weekly, four-week and Estimated 1RM histories; a phase change
  leaves those facts unchanged.
- `test:estimated-1rm`: **177/0** in its owning suite; the chained Progress,
  workout-log and effort suites were also green (24/0, 37/0, 54/0).
- `test:journal-month`: **29/0**. `test:session-logging-ui`: **46/0** across
  its two suites. `test:test-truth`: green, including **30 current contracts**,
  **0 unrunnable of 397**, 104/0 seed registry and 9/0 device preflight checks.
- Mounted simulator flow: `.maestro/visible/lived-history-minutes.yaml`, **exit
  0** on explicit iPhone 17 Pro simulator
  `B8B2C7B0-0558-448A-896D-EAB9C2C6C326`. It checked one real execution row,
  opened the real feedback sheet, read `7 — hard`, entered 60 minutes, saved,
  observed `day-complete-mon`, used the canonical checkpoint/reload, observed
  the same completed day and wrote
  `artifacts/lived-history/minutes-rpe-reopened.png`.
- Product typecheck: **0 errors**. Dev/E2E typecheck: **0 errors**. Test-harness
  typecheck: **3 errors in 2 unrelated files**
  (`canonicalWeeklyCompilerSliceTests.ts` 1,
  `fatiguePlumbingTests.ts` 2), so `test:compile` and `test:release` remain red;
  release stopped after 1/27 units as designed.
- Broader pre-existing red was reported, not fixed quietly: law registry
  **13/14** with 21/218 UNENFORCED; accepted-state transactions **18/32 green**
  with 14 unrelated calendar/readiness/rollover failures; Maestro element
  contract has 37 stale IDs in other flows; repo-law guards **51/63 green**;
  ruling registry **5/8 green**. This new flow's IDs are producible; after this
  report references it, it is no longer an orphan.

### Audit preservation receipt

The 11 files under `output/lived-full-year-audit-860e1fcc/` remain the original
audit artifacts and are outside this commit. Representative SHA-256 receipts:
`audit_findings.csv` = `0fe4325272cfcce1169aaebd2ea8dd3347bfff09dffdb960ea5d8567fbf60436`;
`partial-audit-receipt.json` =
`9166e4630e5c09b5e5dc9cdc19fb95d00e2fbfb2e539a22bed9853e488874e79`.

## NOT COVERED

- The stopped 52-week replay was not resumed. This pass deliberately generated
  and inspected four weeks only.
- No physical iPhone was installed, wiped or used. The mounted run reset only
  an isolated simulator seed. Per L10, athlete-facing acceptance on Sam's
  physical phone remains outstanding.
- Remote sync, future-programming adaptation from completed load, fatigue and
  injury-driven programming were not changed or claimed.
- Session-outcome clear/Undo has no supported product door today. Where removal
  is supported by the fact input, the pure load matrix proves the removed fact
  disappears from reconstruction; the transaction mutation proves rollback of
  a refused replacement.
