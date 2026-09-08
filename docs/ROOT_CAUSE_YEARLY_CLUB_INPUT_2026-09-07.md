# Week-eight club sessions: input provenance

Owner: scopebridge. Diagnosis only; no app, test, runner or configuration changes.

The attached 63-page PDF prints an initial Off-season profile with zero team
sessions, then shows club sessions on 16 and 18 November 2026, week eight.
Its stated revision, 709bf14083a309636f291e635d29611ecb5cc624, contains the
same explicit audit-input injection as the current runner.

## Verified boundary

`athleteAnswers` in `src/__tests__/compilerYear/catalog.ts:64` sets Off-season
team days/count to empty/zero. `run` in
`scripts/run-programming-selection-trace-year.cjs:103` retains that initial
profile for reporting. `scripts/athlete-cohort-year.cjs:92–95` moves the scripted
phase transition to week eight and supplies Monday/Wednesday club days.
`run:115–117` passes those answers through `applyPhaseShift` and the real
`commitProfileProgramTransaction`. The input changes before scheduling.

The actual app sheet asks which days the team trains and allows a blank answer
(`SeasonPhaseShiftSheet.tsx:288–315`). `applyPhaseShift`
(`profileMutations.ts:168–171`) uses the supplied days/count; it does not create
two automatic preseason club nights.

Two executable controls used seven logged weeks, the week-eight transaction,
and reopening: explicit empty days produced zero club sessions; Monday/Wednesday
produced the PDF's two dates. Both were accepted. Zero was not rejected by a
selector. Receipt: `/private/tmp/lfa-team-input-probe.json`.

## Proposed correction

A wording-only fix would expose the assumption but leave duplicated inputs.
Prefer one explicit, dated audit schedule shared by cohort/pair runners,
`programming-final-year-audit-rules`, their checkers/fixtures and PDF summaries.
Confirm whether this athlete should remain at zero or deliberately start two.
Do not alter production scheduling for this finding.

Tests: zero and explicit club days across phase changes, save/reopen, dated
profile/header consistency, omission/injected-default mutation controls, then
all relevant gates and the complete 52-week athlete run.

NOT COVERED: Sam's intended club schedule; locating the exact original
63-page exporter; new full-year run or PDF regeneration. No phone test required
for Sam's requested audit verification.
