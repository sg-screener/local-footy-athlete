# STATUS — progressmetrics

## 2026-08-31 — Sweet-spot Load hero and weekly AU history

Owner: `progressmetrics`

Scope and existing authority:

- The load engine already owns a signed 0.8–1.3 sweet-spot band against the athlete's rolling four-week normal.
- R-277 already owns one reconstructable weekly AU total across strength, conditioning, team training and games using actual minutes × session RPE.
- The accepted microcycle already records scheduled/readiness/illness deload dose; the surface does not infer a deload from a low number.

Options compared before implementation:

1. Re-group feedback and calculate an acute:chronic chart inside Progress.
2. Extend the existing live Snapshot with the load owner's weekly AU totals and one typed current-deload answer, leaving all calculation in the existing domain owners.

Choice: option 2. It prevents the screen from becoming a second workload model. The relative continuum answers whether this week sits around the athlete's normal; the chart shows the underlying weekly AU history. Absolute AU is not given a universal good/bad cutoff.

Verification:

- Red first: six focused cells failed for the missing exact statuses, deload exception, explanation, AU history chart, two-point refusal and typed deload handoff.
- After implementation: Progress ownership is 48/48, the pure Snapshot/ownership arm is 38/38, and TypeScript compile is green.
- The AU history is chronological, comes directly from `JournalLoadModel.history` plus this week, and includes only weeks with measured load.
- Mutation: restoring the old in-range wording, reversing historical order, allowing a one-point chart and inverting the deload-door check changed Progress from 48/0 to 45/3 and Snapshot from 38/0 to 36/2. Restoration returned both focused tapes to green.
- The complete load chain is green: 138/138 pure load cells plus 28/28 real onboarding, accepted-save, restart and phase-change history cells.
- The law registry resolves R-281 and its revised guard; it remains red only on the inherited 21 UNENFORCED rows.

NOT COVERED:

- Physical-iPhone Release acceptance, Dynamic Type and real VoiceOver traversal.
- Mounted simulator pixels; the shared simulator lane is currently owned by the active lived-year audit preflight and was not interrupted.
- A production athlete with four fully measured prior weeks; the existing coverage refusal remains the authority for when the status is available.
- Any automatic program change from the monitoring result. R-277 keeps this read-only.

## 2026-08-31 — Main-lift card simplification and plain comparisons

Owner: `progressmetrics`

Options compared before implementation:

1. Keep the two permanent inline choices and only reduce their type size.
2. Make the selected lift the card's single identity and open one shared two-option sheet when it is tapped.

Choice: option 2. The selected lift already owns the card's graph, value and persisted slot; using it as the selector removes duplicated copy and gives all four slots one interaction. “Estimated 1RM” moves to the section heading so it is stated once. Pull-Up gets the explicit Progress-only label “Pull-Up (added weight)” without changing exercise matching elsewhere.

Verification:

- Red first: three named cells failed for the repeated estimate captions, permanent inline alternatives and ambiguous Pull-Up label. A fourth pinned removal of the lime empty-value dash. After Sam removed direction glyphs entirely, the comparison-copy cell stayed red until the UI showed only green percentage + better or red percentage + worse.
- Focused Progress result: 42/42 cells green; TypeScript compile is green.
- Liveness: removing and renaming the former trend component exposed that the selector source guard used it as an end anchor. Re-anchoring to the stable `categoryLabel` boundary made the instrument observe the card region independently of whichever comparison glyph exists; this is an anchoring repair, not an application fix.
- Mutation: reintroducing an SVG glyph in the comparison row and changing `better` back to `improved` changed the focused tape from 42/0 to 41/1, naming the exact plain-comparison cell; restoration returned 42/0.
- The in-chain Coach Snapshot ownership arm is 35/35 before its inherited populated-history failure. The law registry resolves the revised rulings and remains at its inherited 21 UNENFORCED rows.

NOT COVERED:

- Physical-iPhone Release acceptance, Dynamic Type and real VoiceOver traversal.
- Completed isolated simulator interaction through all four lift sheets; the shared simulator lane was occupied while this change was authored.
- Visual calibration of the trend-chart glyph at every supported text/display scale.

## 2026-08-31 — Progress performance tests and measurements

Owner: `progressmetrics`

Scope:

- Replace the oversized 2km-only Progress card with three compact, athlete-selected performance tests below Main Lifts.
- Persist a result history and compare the newest result with the previous result for the same test.
- Make a selected 2km or 3km aerobic result the measured source for running paces, preserving the legacy 2km answer as read fallback.
- Add editable height and weight using the accepted profile/program transaction and the existing measurement bounds.

Options compared before implementation:

1. Incremental: add five more optional profile fields beside `twoKmTimeTrial` and special-case each card and pace consumer.
2. Source-of-truth redesign: one typed performance-testing owner containing category selections and result history, with one derived trend function and one aerobic-to-MAS adapter.

Choice: option 2. Six sibling fields would duplicate history, comparison direction, display, and selection rules. One owner makes every test use the same persistence and comparison path while allowing aerobic tests alone to feed pace derivation.

Starting boundary:

- Progress currently owns a large one-result 2km chart above Main Lifts.
- The persisted profile already owns height, weight, and a legacy 2km answer.
- The accepted profile transaction already atomically republishes profile and program after profile edits.
- Physical-device acceptance remains outstanding until Sam verifies the final surface on his iPhone.

Verification:

- Red first: the existing Progress tape reported 6 named failures for the missing compact sections, old 2km retirement, exact choices, order and accepted saves. Adding the pure behavior arm before its owner failed with module-not-found.
- Focused result: 37/37 Progress cells green. They cover all six choices, lower-is-better timed direction, higher-is-better air-bike direction, parser/formatter units, m:ss keyboard reachability, spoken values, the existing 2km bound, baseline, persisted category selection, 3km pace authority and legacy 2km fallback.
- TypeScript compile is green.
- Existing `test:time-trial` returns to its measured 10 inherited stale cells (onboarding Gender ordering, retired profile editor location and the pre-R-202 km/h copy expectations); this change adds no failure there.
- Existing `test:coach-snapshot` now passes its 35/35 ownership cells after the intentional surface change. The command then reaches one inherited populated-fixture load-ratio failure before later chained suites.
- Registry rows resolve and this law is guarded in-chain. The law registry remains at the inherited 21 UNENFORCED laws; the ruling registry retains its existing missing R-070 file, UNENFORCED ceiling and uncited-question failures.
- Liveness: changing only the exact label to `20-m sprint (electronically timed)` killed the exact-choice cell at 33/34; restoring `20m sprint (electronically timed)` returned the tape to green.
- Simulator, iPhone 17 Pro / iOS 26.3: the old 2km card is absent; Main Lifts is followed by one compact three-row Performance tests card and a two-field Measurements card. The mounted flow saved 3km results of 12:00 then 11:30 and observed the accessible row as `11:30, 4.2% improved`. It also submitted 181 cm / 81 kg through the accepted transaction. The final post-save text-input assertion was interrupted by the repository's shared Maestro-driver collision with another active seat, so the mounted flow remains a partial pass rather than a complete tape.

NOT COVERED:

- Physical-iPhone Release acceptance, Dynamic Type and real VoiceOver speech.
- A Supabase/account round trip. Profile persistence uses the existing accepted profile store and transaction, but this pass did not log out and restore from a remote account.
- Physiological calibration of 2km/3km average speed as MAS; the app applies the already-ruled 1.00 field-proxy derivation.
