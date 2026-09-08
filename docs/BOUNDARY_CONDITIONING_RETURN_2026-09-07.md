# Conditioning return: approved correction

Owner: scopebridge. Sam approved implementation on 2026-09-07.

Weeks 3–4 now offer existing light aerobic finishers on gym days. Lifting stays
required; skipping the aerobic add-on carries no completion penalty. The
existing week-five speed/COD cadence and authored doses remain unchanged.

`weeklyScheduler.scheduleWeek` reads the shared preparation range and exchanges
tempo before the last aerobic-base receiver when COD is due.
`canonicalWeeklyAvailabilityState.conditioningEquipmentOnDate` owns machine
access by date. Weekly compilation, the display adapter and injury substitution
consume it; the fixture adapter also consumes it when no weekly map is supplied.
Equipment answers and completed history are preserved.

`sessionTemplate` marks the optional rows; `sessionExecutionChecklist` uses that
flag for display and completion. Both annual exporters now read that flag,
without their former independent optional-label inference. Coach references,
R-381/R-382, the preparation sheet/generator and affected checks were updated.

Regression evidence: missing offers, off-gym machines, displaced aerobic base,
optional display/completion and the in-season fixture fallback failed before
their respective corrections. Preparation now passes 457 assertions, including
actual optional-skip save/reopen, plus eight mutation controls. Dated access has
105 profile/date cases, a fixture fallback check and four mutation controls.

Both requested 52-week runs completed with 104/104 successful weekly reopens.
Their 728 distinct athlete/date records contain no off-gym machine conditioning.
The PDFs retain every generated row and were visually checked.

Broader compiler year: **416/416 athlete-weeks, exit 0**. Release: **37/37 groups
verified across recorded runs**; complete weekly-program group rerun exits 0.
Stale preparation expectations and a full-stop injury fixture were corrected;
injury policy and full-stop assertions remain unchanged. Full receipts:
`output/conditioning-correction-2026-09-07/verification-receipt.json`.

The next defect is guarded across access dates, equipment sets, preparation,
COD exchange, injury/fixture routes, display, actual saving and reopening.

NOT COVERED: native phone taps/layout/install; live Coach deployment; different
speed/COD timing; unrelated existing repeated-row, coverage and diagnostic failures.
