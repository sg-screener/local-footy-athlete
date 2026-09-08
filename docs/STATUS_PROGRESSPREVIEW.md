# Progress preview — owner progresspreview

## 2026-09-08 — Sam's wording and lift-card revision

Scope: change sweet-spot guidance to “without overdoing it or undertraining”; use “Main lifts (Estimated 1 rep max)”; put the weight below each lift name in place of the repeated last-set caption; show actual below/above-range screens in the isolated demo.

Options compared: (1) change the existing copy owner and card presentation; (2) introduce a separate presentation model for chart labels/values. Choose (1): all required data already belongs to one history owner; this request changes presentation only. Keep the existing calculation and separate historical series.

Coordination: read progressmetrics and timeline status; no active claim on this small follow-up found. Existing demo belongs to this task: LFA Progress Preview, E9BF1E00-EFD4-4776-844A-5D5FD10530FD, Metro 8091. Other edits in the shared checkout remain with their owners.

Verification pending. NOT COVERED: physical-iPhone Release acceptance and release readiness.

## Verification receipt

- R-280/R-281 received dated revisions at their existing registry entries; their existing law rows retain the same guards with the revised wording.
- Three revised/new Progress cells failed before the presentation change (46/49 passed), then all 49/49 cells passed. The underlying estimates and separate series remain unchanged; the visible card value is now beneath the name with a compact kg suffix. Historical method remains available in the value's accessibility label.
- Three in-memory faults each killed exactly its corresponding cell: old guidance, old heading and visible series caption in place of the weight. Each produced 48/49 passing cells with one failure. Source files were not mutated on disk. Receipts: output/progress-preview-2026-09-08/copy-{red,green}.log and mutation-*.log.
- `npm run test:compile` passed with zero product, devtools and test errors against the baseline. Diff whitespace checks passed for the four focused implementation/test files.
- Mounted simulator inspection verified the revised explanation and heading, compact 34kg/96kg/91kg values, and no visible Last-set estimate caption.
- Below and above scenarios each updated six distinct current-week session dates through the original session outcome transaction. Lighter/heavier fictional working weights, durations and effort were used; estimate observations retained matching weights. Both kept all six current-week sessions measured. The below screen displayed Potentially undertraining in yellow (384 weekly AU); above displayed Potentially overtraining in red (5760 weekly AU). These are screenshot examples, not universal AU thresholds. The continuum still uses its existing main-lift/conditioning comparison; varying strength duration alone did not move it.
- Screenshots: 03-revised-sweet-spot.png, 04-below-sweet-spot.png, 05-above-sweet-spot.png. The normal demo restoration was requested after capture. All state changes were isolated to LFA Progress Preview; Sam's phone and other simulators were untouched.
- No commit or Release installation made: the shared checkout contains extensive other-agent changes, including both registries. This task's application diff is ProgressTabScreen.tsx, progressTabCopy.ts, snapshotDashboardCopy.ts and progressTabOwnershipTests.ts, plus the scoped ruling/law text and this status file.

What catches recurrence: the existing in-chain Progress copy/presentation cells reject all three deliberately restored old forms; mounted screenshots verify their actual placement. No new load calculation or training policy was introduced.

NOT COVERED:
- Physical-iPhone Release acceptance, a new Release build, and full release-gate verification.
- VoiceOver speech, Dynamic Type, months/years of history, and all legacy/mixed-series visual arrangements.
- Back Squat still has no records in this five-week demonstration.

## 2026-09-08 — Progress period selector

Sam requests the top 4 weeks / 12 weeks / Year toggle from his reference, with the display actually reflecting the selection. Scope is the period control and its existing chart/results readers; other reference-image surfaces are later work.

Options compared: filter each chart independently, or share one pure period range and apply it to every history reader and horizontal chart axis. Choose the shared range: it prevents mismatched boundaries and falsely stretching sparse history over a year. No history writes or coaching calculation changes. Existing full weekly load history is already available; no alternate load model is needed.

Implementation assumptions: default 4 weeks; four/twelve calendar-week buckets including the current week through today; Year is the trailing calendar year through today. Display a full range including year labels when crossing years. Keep weekly load values weekly, and preserve all in-range weekly lift points. The existing sweet-spot comparison remains current-week versus four-week normal. Performance results are filtered for display only; saves retain the complete result history. Current height/weight remain current measurements.

Verification pending. NOT COVERED: remainder of the reference redesign, physical iPhone.

### Period-selector verification

- New pure owner: `src/rules/progressPeriod.ts`. Its writer is local React selection state; readers are the existing load/lift/performance presentation and the chart geometry. No stored field or second calculation owner was introduced. North-star direction: derive a view from existing records.
- Before UI/axis implementation, three named cells failed: actual selected axis, functioning buttons, and shared period delivery. After implementation, the focused Progress tape is 59/59. The Snapshot tape is 38/38; its existing hero-position mutation was updated to target the new range-bearing call and still fails when Load is moved below lifts.
- Eight in-memory faults were caught by the intended cells: remove date filtering, make twelve weeks equal four, make Year equal twelve, stretch sparse history to the chart edge, make the toggle inert, lose the individual series filter, reset the live status, and save from the filtered performance history. Outputs: `period-mutation-*.log`.
- Final `npm run test:compile` is green: zero errors in product/devtools/tests against the baseline. Focused diff whitespace checks are clean. No repeated whole-app test sweep or Release claim.
- Actual simulator taps: 4 weeks => 20 Jul–16 Aug and four weekly points; 12 weeks => 25 May–16 Aug and five weekly points; Year => 17 Aug 2025–16 Aug 2026 and the same five points at the appropriate far-right dates. The five-week demo does not pretend to contain a year. Performance comparison changes from a single in-period result on 4 weeks to its prior/latest comparison on 12 weeks/Year. Returning to 4 weeks restores the original view. Sweet-spot headline remains In the sweet spot throughout.
- Screenshots: `06-period-4-weeks.png`, `07-period-12-weeks.png`, `08-period-year.png` under `output/progress-preview-2026-09-08/`. Demo left on 4 weeks.
- R-392 and LAW-progress-period-selection were added with the existing in-chain Progress guard. Both shared registries already contain unrelated uncommitted work; this task made scoped additions and did not commit other seats' changes.

What catches the next defect of this class: one explicit range is passed to every history reader and geometry; tests distinguish records older than four/twelve weeks, calendar-year/leap-day boundaries, invalid/future dates, missing history, empty series, preserved source inputs, and the full selected axis. Fault injection proves those controls can reject broken implementations.

NOT COVERED:
- Physical-iPhone Release acceptance, a full release gate, and process-restart acceptance.
- Dense year-long history on a native screen, real VoiceOver speech and large accessibility text sizes. The pure range/filter tests include records older than twelve weeks; native review uses five weeks of accumulated accepted history.
- Training-history navigation, personal-bests cards, chart axes/extra comparisons and the remaining design in Sam's reference. This requested slice is the functional period selector.

## 2026-09-08 — Sam corrects sparse-chart scaling and shifting selector layout

Sam explicitly rejects my full-selected-window axis: sparse records must fill each chart, expanding naturally as new records arrive. He also rejects the period toggle/date row resizing between selections.

Options: conditional compact dates to squeeze Year into the prior horizontal row, or a stable full-width selector with a dedicated date row in every mode. Choose the stable two-row layout: the longest date no longer competes with the controls. Restore the shared chart owner's first/last recorded-date scaling after period filtering; retain elapsed-time spacing between actual records. Chart captions name recorded dates; the top date row names the selected period. This supersedes the prior axis assumption in R-392. No data or load-status calculation changes.

### Sparse-fit/layout correction receipt

- Four red-first cells caught the original cramped axis, growing-history scale, wrapping period row and selected-period chart captions. After the correction, Progress is 62/62.
- Three in-memory faults were caught: restore the fixed-window axis, restore horizontal wrapping controls, and restore selected-window dates beneath the fitted chart. Outputs: `fit-mutation-*.log`.
- Final compile gate passes with zero product/devtools/test errors against baseline; focused whitespace checks clean.
- Mounted taps 4 weeks -> 12 weeks -> Year confirm the graphs fill the area. Both 12-week/Year contain the same five recorded weeks in this demo, and draw the same full-width shapes with captions 13 Jul–10 Aug. The top row still states each chosen lookback window. Buttons remain three equal-width controls; dates always occupy their separate fixed-height line, so the Load and lift cards stay put.
- Single-point chart geometry remains centered. A date-caption line is reserved even without a two-date span; long cross-year chart captions are one line and can shrink to fit rather than enlarging the card.
- Evidence: `09-fitted-12-weeks.png`, `10-fitted-year.png`, `fit-{red,green,compile}.log`. Demo is left on Year for Sam to inspect. R-392 and its guarded law row reflect his correction. No source changes outside the existing chart, screen, focused tests and scoped documentation/law update in this turn.

NOT COVERED: physical-iPhone Release acceptance, a Release build, large accessibility font sizes and the remaining reference redesign. Older full-window-axis screenshots 06–08 and their receipt describe the now-superseded implementation.


## 2026-09-08 — Reference top-section layout; preserve LFA logo

Owner: progresspreview. Sam requested the reference layout above Main lifts and then explicitly retained the LFA logo. Scope is the Progress header, inline period/date controls, split load card and its read-only load-history sheet. Main-lift appearance and training calculations are retained.

Options compared: rearrange separate labels with screen-local date exceptions, or keep one existing load-card owner with two stable columns and a shared pure available-history range helper. Chose the latter: one range helper clamps the start for every selected mode and retains today as the end, without touching stored facts or inventing points. Dates draw from the filtered load/lift/performance history. The graph measures its narrow column to fill that space; the original geometry remains for lift charts. Fixed 3:2 selector/date allocation avoids selection-dependent layout changes. New percentage comparisons from the reference are not invented as part of this layout request.

Verification: first run failed at the not-yet-written range helper. Then 67/67 Progress cells passed, including empty/first-day histories, available-start clamping, source filtering, two-column allocation, logo retention and functional history-sheet wiring. Five in-memory faults failed their intended cells: dates before available history, wrapping selector, stacked card, cramped time axis and inert history button. The native flow `header-capture.yaml` tapped all three periods, checked 20 Jul–16 Aug for four weeks and 13 Jul–16 Aug for twelve weeks/Year, opened load history and checked the 10 Aug week at 1,992 AU. `header-close.yaml` exercises dismissal. Screenshots 11–14 capture the actual native layout. Existing Coach Snapshot checks remain 38/38.

What catches the next defect of this class: range tests distinguish available history from the selected maximum window, geometry tests cover sparse/growing histories, fixed-allocation checks reject wrapping and stacking, and the native flow exercises the actual period and history buttons. Mutations prove these checks detect their named faults.

NOT COVERED: physical-iPhone Release acceptance, a full release gate/cold-start sweep, dense year-long native history, and large accessibility text settings. This is a simulator layout preview with accumulated fictional records entered through the app's accepted transaction path. No commit or phone build from this shared dirty checkout.


Follow-up: the first close-only native flow failed because Fast Refresh had already dismissed the sheet (missing close control in the setup state). The corrected flow opens the sheet explicitly before exercising Close. This was a flow setup failure, not evidence of a working or broken Close action. Below/above sample records were then applied through the existing accepted transaction scripts: screenshots 15/16 show the complete longer status wording in the left column. Normal sample records were restored afterward. Final compile gate: zero product/devtools/test errors. Focused whitespace check is clean.


Final receipt: the corrected open → assert weekly history → Close → assert dismissed native flow completed. The accepted-transaction receipt confirms six distinct current-week demo dates restored with zero transaction errors (`mode: normal`, `status: complete`). Screenshot `17-final-progress-header.png` is the restored four-week preview. All 67 Progress cells and 38 Coach Snapshot cells are green; five injected faults are caught; compilation has zero errors.

NOT COVERED: physical-iPhone Release acceptance, dense year-long native data and enlarged accessibility text; no whole-app release claim.


## 2026-09-08 — Wider period controls and Program-selected styling

Owner: progresspreview. Sam requests a wider selector, larger date and the Program Day/Week active treatment. Compared extending the current Progress styles with those existing Program values versus extracting a shared control across the two screens. Chose the local style change: it keeps the scope to this requested surface and avoids restructuring the concurrently edited Program screen for three small visual values. The date now reserves 112 points at font size 13; the selector takes the remaining row width with font size 13, Program's `rgba(216,216,0,0.14)` active fill and `#D8D800` text, and the same inactive text/pill background. Long cross-year dates use compact numeric dates without shrinking; expanded dates remain in the accessibility label.

Red first: the stable-row and selected-style cells fail before the change. Green: 68/68 Progress cells; compilation has zero errors. Six injected faults are caught, including removing the yellow selected fill. Native `selector-capture.yaml` checks all period taps and date text, captures 18/19/20 screenshots and returns to four weeks. The LFA logo, history calculations and load-card layout remain unchanged in this refinement.

What catches the next defect: the existing fixed-row check rejects changing allocations/wrapping, and the selected-style cell rejects loss of the Program yellow treatment. Both are exercised against deliberate faults.

NOT COVERED: physical-iPhone acceptance, enlarged accessibility text and a whole-app release gate.


## 2026-09-08 — Main-lift calculation popup

Owner: progresspreview. Sam requests an info icon and simple popup describing the actual calculation. Read the existing last-set estimator and weekly-series builder before writing the copy. Compared an inline expanded explanation/new modal with the existing shared Sheet. Reused Sheet so opening, dismissal and scrolling follow the existing app pattern. No calculation or data changes.

The text explains weight, reps and spare reps from the final set; six reps plus two left means an eight-rep capacity; the existing table estimates one-rep max. It explains best estimate each week and latest plotted-week value. Pull-Up added-weight, Bulgarian non-dominant-leg and older-method notes are conditional on the selected histories. The popup has a Got it button.

Verification: two red-first popup cells; then 71/71 Progress cells and 38/38 Coach Snapshot cells. The example executes the real estimator: 80 kg at 6 reps plus 2 spare reps gives the same estimate as 8 reps plus 0 spare reps (rounded 98 kg). Three injected faults are rejected: inert info action, hidden popup and ignored spare reps. Native `calculation-capture.yaml` opens the actual control, checks the definition/Pull-Up note, captures screenshot 22, closes with Got it and confirms dismissal. Screenshot 21 shows the inline icon and label. Compilation has zero errors.

What catches the next defect: the info control is anchored beside the Main lifts heading; tests hold its open/close wiring and execute the example against the real estimator. The native flow verifies the mounted popup and dismissal. All three fault injections fail their intended cells.

NOT COVERED: physical-iPhone Release acceptance, enlarged accessibility text, native popup variants for legacy/Bulgarian selected histories, and physiological calibration. No whole-app release claim.


## 2026-09-08 — Sam’s popup wording and parallel-work coordination

Owner: progresspreview. Only product edit this turn: three literal strings in `src/rules/progressTabCopy.ts`. Introduction now ends “weight you could lift for 1 rep.” Inputs no longer begins “your last set:”. The graph paragraph is exactly “The graph updates each time you perform that exercise, and is based on your feedback from the session.” This describes recalculation from session feedback; the weekly-best aggregation and the estimator are unchanged. The example, Pull-Up line and closing guide are retained. Existing Progress checks: 71/71.

Read-only isolation check: other checkout is `/private/tmp/lfa-programming-coverage-20260908`, branch `codex/programming-coverage-20260908`; it has its own working files/index and shares the original Git common directory. Its progress copy/screen were clean on inspection. The latest turn in “Review football programming rules” shows commands running there after Sam’s approval, not in this UI working directory. Sent a coordination message identifying Progress-owned files, Metro 8091 and the preview simulator; flagged shared node_modules as no-install/no-mutation and the two shared registry paths for deliberate future integration. No programming source edits, branch switch, merge or source copying by this task.

NOT COVERED: eventual integration/conflict resolution, the other task’s programming correctness and physical-iPhone acceptance. No guarantee about future concurrent commands; the inspected source commands use the isolated worktree.


## 2026-09-08 — Remove load coverage count; add arrow/percentage

Owner: progresspreview. Sam requests removal of the measured-session line and the reference arrow/percentage against earlier weeks, presented live in Simulator without a chat screenshot. Compared doing arithmetic inside the card versus one pure comparison helper alongside the existing period helper. Chose `progressLoadComparison` in the UI-owned progressPeriod module: it takes full recorded history, the latest displayed week and the selected period. No programming/calculation-owner file was edited.

The baseline is the mean of up to 4/12/52 earlier measured calendar weeks, excluding the latest week itself and future records. Short contiguous history labels its actual count; gaps say recorded weeks. Missing/zero baselines return no percentage. Positive/negative/unchanged rounded changes use up/down/flat arrows. The UI retains the separate existing sweet-spot calculation and removes only the session coverage text.

Verification: first run failed because the new helper was absent; final Progress 77/77 and Coach Snapshot 38/38. Four injected faults fail their intended cells: wrong averaging divisor, ignoring selected period, claiming sparse history is complete, and inverted arrows. Compile has zero product/devtools/test errors. The native flow checks the actual 1,992 AU value, the comparison control and previous-four-weeks label, absence of session counts, and Year/four-week switching. Native accessibility reads 28 percent higher; recorded earlier weeks average 1,555 AU. No screenshot is returned in chat.

Preview note: a simulator reload had advanced the fictional program to September while the recorded July/August sessions remained. Only the dev clock was restored to Aug 16 to expose those records in four-week view; no session data was reset or regenerated. The live status currently reads Building your load history because the current program is the September block; this slice does not fabricate an in-range status. The initial clock restore used the journey display label instead of its registered seed and was refused without changing data; it succeeded with the existing standard-in-season-week identity. The unrelated pre-existing reload diagnostic says clock receipt has no active checkpoint. This is confined to the demo harness and has not been hidden or patched here.

What catches the next comparison defect: tests distinguish all three periods, current/future exclusion, sparse and missing/zero baselines, negative/flat directions and the UI connection to full source history. Deliberate faults demonstrate the checks reject these broken cases.

NOT COVERED: physical-iPhone Release acceptance, full release gates, native dense-year/gapped data and repair of the pre-existing demo checkpoint/reload mismatch. The live percentage preview is verified; no whole-app claim.


## 2026-09-08 — Green upward comparison, aligned info label and restored reloadable demo

Owner: progresspreview. Sam requests the up arrow/percentage in green and the calculation info label aligned with Main lifts. The upward comparison now uses the existing green `successLight` (#81C784); down/flat retain neutral text. Main lifts uses an inline heading variant with no inherited top margin, aligning it to the adjacent info control. No calculation change. Existing Progress 77/77 and Coach Snapshot 38/38; compilation zero errors.

Restored the dedicated simulator via its original accumulated demo journey with complete recorded session inputs, then restored the same six fictional performance results. No other simulator or task was touched. The earlier reload problem was a saved clock without a checkpoint; the September program came from advancing at real device time. The corrected demo has an Aug 10 program and Aug 16 test date. Captured real semantic fingerprints, waited for all seven stores to persist, and wrote the actual clock/checkpoint/unfinished-trace receipts through existing owners. Triggered an actual React Native reload. The app reported `e2e-reload-ready-standard-in-season-week`, and the native flow verified 1,992, In the sweet spot, the percentage, and no seed error. The first native tap was too early during startup navigation; the corrected flow waits for the reload-ready marker before tapping Progress. Scripts and receipts: save-preview-checkpoint.js, reload-preview.js, colour-alignment-native.log. This resolves the previously recorded missing-checkpoint preview issue; no product harness code was changed.

## 2026-09-08 — Stack the full-width load sections

Sam changed his preference from side-by-side to two full-width levels. Compared separate cards with the current single card holding two sections; kept one card, stacked its sections and changed the divider to horizontal. The continuum now spans the card; weekly label sits opposite 1,992/green percentage, with the full-width graph below. No data or comparison changes.

Red first: the revised full-width layout cell failed against the old columns. After the change Progress is 77/77; returning to side-by-side fails the intended cell. Compilation has zero errors. The existing live comparison flow exercises period switches and returns to four weeks. No chat screenshot is provided, per Sam’s preference.

What catches the next layout regression: the existing in-chain layout cell holds vertical stacking and full widths, with a fault proving it rejects side-by-side. The native check covers the rendered controls and values; the previous reload check proves this saved demo can reopen with its clock and data.

NOT COVERED: physical-iPhone acceptance, enlarged accessibility text and arbitrary edits to demo data after its saved checkpoint. No whole-app release claim.


## 2026-09-08 — Compact weekly section, even padding and selected-period comparisons

Owner: progresspreview. Weekly chart height reduced from 88 to 52 points through an optional chart-height parameter; lift charts retain 88. Weekly heading now uses the same labelSmall/kicker style as Training load. Reduced header gaps and positioned the history label at the bottom of its existing 44-point tap area, leaving the card’s 16-point outer padding instead of adding half the tap area beneath the text.

Sam then reported that 12 weeks/Year still labelled the comparison as four weeks. Compared merely relabelling the partial baseline against requiring the actual selected baseline. Chose complete 4/12/52 prior weekly values, excluding the displayed week and future values; gaps/short history now show More history needed. The weekly AU remains the latest week, independent of the selected lookback. Updated the existing registered rule and its in-chain cells. First run: 75/77 with the intended selected-period and incomplete-history cells red. Final: 77/77; compilation zero product/devtools/test errors. Dense 52-week arithmetic checks distinguish the three baselines; duplicate/gap inputs cannot stand in for missing weeks. This replaces the earlier partial-history comparison decision.

Native flow selected-load-native.yaml verifies the fictional five-week history: 1,992 and previous-four-weeks percentage; twelve-week/year selections show More history needed with no percentage; returning to four weeks restores the comparison. The live accessibility tree confirms matching uppercase headings. No chat screenshot. What catches the next defect: complete-period, gap/duplicate, future exclusion, direction and zero-baseline cells plus the native period-switching flow.

NOT COVERED: physical-iPhone Release acceptance, enlarged accessibility text and dense-year data in the native simulator (dense arithmetic is checked in the pure helper). No whole-app release claim.


## 2026-09-08 — Balance space around the weekly graph

Owner: progresspreview. Sam requested the graph sit slightly lower between the comparison caption and View load history. Compared redistributing section heights against moving just the graph within existing blank space; chose a 12-point vertical graph offset, preserving the card height, bottom inset and existing 44-point history tap area. Progress checks remain 77/77. Simulator brought forward; live accessibility confirms the populated four-week screen and history control.

NOT COVERED: pixel-distance measurement, enlarged accessibility text and physical-iPhone acceptance.


## 2026-09-08 — Main lifts reference cards

Owner: progresspreview. Compared restyling existing values alone against one pure lift-chart presentation model supplying both labels and coordinates. Chose the shared model alongside the existing timeline helpers to prevent axis/line disagreement. Cards have larger white kg values, positive green changes from first to latest in-period points, labelled horizontal weight grid, endpoint dates, and a barbell/recording prompt for empty data. Existing series remain separate; no estimator, record write or selector ownership changed. Sam’s immediate follow-up removes “(added weight)” from the Pull-Up title; the popup still explains added weight.

Progress 80/80, Coach Snapshot 38/38, compilation zero errors before the final title-only edit; Progress rerun after that edit. Native flow verifies populated Bench value/change and empty Back Squat prompt. Inspected a simulator capture internally: both grid columns, wrapped title, large values, graph/axis alignment and complete empty card are visible; no screenshot delivered in the final response. New delta/axis cells are killed by wrong-delta and wrong-axis faults in memory. What catches the next arithmetic/axis defect: the shared model tests compare coordinates to labelled scale and exclude older/future values; one point cannot produce a change.

NOT COVERED: physical-iPhone Release acceptance, enlarged accessibility text and multiple legacy/current series rendered together on device. No whole-app release claim.


## 2026-09-08 — Tighten lift name-to-weight spacing

Owner: progresspreview. Sam requested the exercise name sit closer to the large weight as in the reference. Compared shifting the value visually against removing the oversized header allocation. Removed the redundant header wrapper and reduced the name button’s layout minimum from 44 to 28 points; an 8-point touch extension above/below keeps the short-label touch area 44 points within the card. Multi-line names can still grow. Existing Progress checks: 80/80.

NOT COVERED: physical-iPhone acceptance and enlarged accessibility text.


## 2026-09-08 — Personal bests entry and page

Owner: progresspreview. Sam requests the reference trophy button in place of the inline three tests, opening a page with those tests. Compared adding a shared navigator route against a full-screen page owned by Progress; selected the latter to retain the existing result-entry state/accepted writer and avoid touching the other task’s navigation or program work. Personal bests is an 88-point trophy entry between lifts and measurements. Its full-screen page has Back, the three current test choices, all-time best through today, clearly separate latest result/comparison, and the existing entry sheet with Cancel. The dashboard period does not restrict all-time bests. A pure helper chooses the lowest valid timed result or highest calorie result without changing history.

Sam’s follow-up places “(electronically timed)” on a second line below “20m sprint”, for the option and selected test label. Stored test identity and the spoken label stay intact.

Verification: Progress 83/83, Coach Snapshot 38/38, compilation zero product/devtools/test errors. Deliberate reversed-best and inert-entry faults fail the intended cells. Updated the existing visible performance journey to enter the new page and return before measurements. New native flow verifies all three rows, an older 400m personal best of 1:08 alongside latest 1:10, all three entry sheets/options, Cancel and Back. First native assertion incorrectly looked for a standalone 1:08 instead of the row’s grouped accessibility label; corrected after inspecting the actual captured label. Visual inspection then caught a real top safe-area overlap; added a modal-local SafeAreaProvider, reran the full native flow, and inspected the corrected page. The button and complete page are captured internally; no final chat screenshot. Existing result-save transaction is unchanged; no demo records changed this turn.

What catches the next defect: best-direction/isolation/empty-history tests and the open/page-map/back guard, mutation-proven; native navigation exercises the nested modal and all three forms.

NOT COVERED: physical-iPhone Release acceptance, enlarged accessibility text, new save/reload from the moved result form and Android back behavior. No whole-app release claim.


## 2026-09-08 — Restore inline tests at Sam’s request

Owner: progresspreview. Sam first requested the My Status icon-only back treatment, then rejected the Personal bests entry and asked to restore the earlier layout. Removed the button, full-screen page and temporary all-time-best helper; restored inline Aerobic/Anaerobic/Sprint rows with the dashboard period and their prior latest-result comparisons. Retained the explicitly approved 20m sprint line break and result-entry Cancel control. Existing Progress checks: 80/80. The existing native performance journey again targets the inline rows.

NOT COVERED: physical-iPhone acceptance and enlarged accessibility text.


## 2026-09-08 — Routed Load history and recorded summaries

Owner: progresspreview. Sam requests a full Load history page matching the supplied bar-chart reference. Compared retaining a full-screen modal against a Progress-owned native stack; chose the stack so the app tab bar, native Back and recorded-session routes remain consistent. AppNavigator now mounts ProgressNavigator; the dashboard keeps its existing hook/data owners and sends only the selected period into LoadHistory. No shared program/coach calculation module was edited. New UI-owned hook maps saved feedback into a pure history presenter that calls deriveSessionLoad once per recorded date; all four component AUs and combined days remain conserved. Future/invalid dates are filtered. Each day opens a read-only summary with recorded duration/effort, component AU, available lift details and notes. Unknown measured inputs are never filled from a prescription. The rejected session-count caption is not restored.

The bar chart fits recorded dates, preserves calendar gaps, selects real weeks, and displays the selected week’s preceding complete four-week AU average. Period selection uses available history and restores the latest visible week. Previous/next-week buttons supplement small bars. Missing prior weeks suppress the average and percentage. Sam asked why the line disappears on 27 July; explained that the demo only has two earlier recorded weeks, so its preceding-four-week baseline does not exist. No baseline semantics changed in response to that question.

Verification: Progress 84/84, Coach Snapshot 38/38, compilation zero product/devtools/test errors. The first compiler check rejected accessibilityRole on an SVG Rect; replaced the interactive overlay with native Pressables. Updating the load call’s props exposed the old hierarchy mutation’s exact-string dependency; repaired that mutation and verified it again. Deliberate lost-component and included-future faults fail their intended cells. The full native flow passed: open Load history; 1,992/1,000 weekly stepping; July 13 bar selection showing 1,440; twelve-week/year selection; opening the Aug 10 combined session; navigating back twice and reopening. Inspected page and session captures internally. A later attempt to capture the session again did not reach the summary; the current week was subsequently changed while Sam explored the live simulator. Stopped further UI automation; the later attempt is not counted as a pass. Primary full-flow receipt: load-page-native.log.

What catches the next defect: canonical total equality, four-part conservation, missing/future/empty records and baseline exclusion tests; route and native selection checks. No fake entries or mutations to saved history were used for this page.

NOT COVERED: physical-iPhone Release acceptance, enlarged accessibility text, dense-year native bar tapping and a fresh save/reopen of session data in this turn. Existing populated recorded-data navigation is covered; no whole-app release claim.
