# Annual Christmas break correction

Owner: scopebridge. Sam explicitly requested no club sessions from 18 December
through 30 January; this changes the audit scenario, not every athlete's calendar.

Verified cause: `scripts/athlete-cohort-year.cjs` submitted `teamTrainingBreak`
with `to: span.to`, although the shared span has `until`. The app's
`executeProgramControlActionDurably` and `scheduleFactScopeForAction`
(`src/utils/programControlActions.ts`) read `noTeamTrainingSpan`. The malformed
input therefore became a generic schedule fact, not a club-training closure.
The pair runner already used the recognized field.

Options: patch that payload and date literals independently, or share the whole
audit action. Implemented the smaller complete ownership correction:
`auditChristmasBreakAction` in `scripts/programming-final-year-audit-rules.cjs`
owns the accepted interval and valid payload; both annual runners use it. The
existing anchor checker reads the same dates. Its fixtures now include late
January closure and February resumption. Generic onboarding tests using other
athlete-selected dates remain valid and unchanged.

`annualClubBreakJourneyTests.cjs` failed on the original captured year with ten
club dates inside the requested interval. After correction, both cohort presets
and the pair runner passed real 19-week journeys, including reopened state,
lifting during the break and club sessions before/after it. Both fresh 52-week
reports also passed. Four mutations independently caught a club date inside the
break, erased lifting, missing February resumption and a failed reopen.

Remaining findings: two-day week 41 repeats Single-Arm DB Row on 5/8 July,
3 × 5/side at 32.5 kg. The knee clears between those dates; selector causation
remains unknown. The longer club-free period additionally flags missing athletic
transverse exposure in two-day week 16. No programming repair was made.

NOT COVERED: repeated-row/coverage root causes, native UI, clinical sign-off.
Complete run and gate receipts: `output/year-review-2026-09-07-christmas/`.
