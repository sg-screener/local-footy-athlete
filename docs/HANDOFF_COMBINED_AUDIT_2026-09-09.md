# Combined app — audit handoff

Owner of completed integration: uifixjoin. Next audit owner: the new chat (choose its own unique status name). Sam explicitly deferred the final audit to that chat. Do not start it from the old source snapshot.

## Exact candidate

- Worktree: `/private/tmp/lfa-ui-programming-integration-20260909`
- Branch: `codex/ui-programming-integration-20260909`
- App-source checkpoint: `a75a25879017cf612a97b88f198fece2111e5067`; later commits only document this handoff. Verify HEAD and tracked changes before testing.
- UI snapshot commit: `1e90ed5f`; integration: `51d641cc`; email correction: `a75a2587`.
- Original UI folder: `/Users/samgeurts/Documents/local-footy-athlete`, `integrate/2026-09-04-morning`, `8d06bbde`, same 302 uncommitted entries preserved and verified after work. DO NOT edit, switch, reset, merge into it, restart its server, or touch its simulator.
- Saved programming: only `0505e3bb..9cc19db1` was applied. NEVER merge the old `0505e3bb` snapshot wholesale. All app-code changes applied cleanly; only appended rulings conflicted, and both histories were retained.
- Separate spacing `8059c65f` was absent and is now included exactly.
- Both Feedback and Ask a Human now default to `hello@localfootyathlete.app`. Local ignored `.env` has no email override; copied for build parity, never committed.

## Evidence before doing more work

Read `docs/STATUS_UIFIXJOIN.md`, especially its final stop/results. Raw logs/manifests/scripts: `/private/tmp/lfa-integration-evidence-20260909/`. Verify actual logs and source applicability. Historical `STATUS_LEGPROGRAM.md` and `BOUNDARY_LEGPROGRAM_2026-09-08.md` are retained but stale; do not repeat their finished investigations or promote their results to this candidate.

Completed combined checks: Progress npm witness exit 0 (34 anchors, 181 estimate assertions, 84 Progress, 37 wiring, 54 effort); 37 programming cases; all 30 fault controls; compilation zero errors in all scopes; Coach integration 73; email configuration 13; spacing six style assertions plus one detected fault. Full release infrastructure, ownership and programming groups also exited 0. See focused-results.json and release-units.json.

The full release sequence was STOPPED BY SAM at 4/44 command groups. `test:canonical-weekly-compiler` was interrupted in its first subcommand, `canonicalWeeklyCompilerSliceTests.ts`, while the accumulated pre-season/in-season history was running. It has no completed result and must not be credited as passed. At stop its last progress was the six-session no-standing-fixture profile at week four. Stop process tree and reason: verification-stopped.json. No audit was running at handoff.

The final eight-profile annual audit was NOT STARTED on this combined source. Old output/outputs/tmp artifacts were deliberately cloned to preserve all UI changes: their existence proves NOTHING about the new candidate. In particular, old outputs/compiler-year-acceptance/result.json is not fresh evidence.

## Next work (new chat owns execution)

1. Verify candidate source is unchanged; if only handoff docs differ from a75a2587, code receipts remain applicable. Inspect processes before starting, and run one expensive sequence at a time. The 12-minute Progress suite need not be repeated for documentation-only changes. Only inbox defaults changed during its run, and email/compile/coach checks were completed afterward; see focused-source-reuse.json.
2. Resume the unchanged release witness list with `node scripts/release-gate.js --list`. Resume the interrupted canonical group once, then the remaining groups. The repository exports `deriveReleaseGate` and `runUnits`; these were used with verified exact successful npm receipts rather than restarting already completed expensive groups. Preserve every required witness and the fail-fast ordering, record each exit/log, and do not turn a skipped or interrupted group green. The complete release covers 47 contracts in 44 command groups. The old release-sequence.cjs starts from the beginning and auto-runs annual after early failure: do not blindly rerun it.
3. Run the required final eight-profile audit exactly once. `test:compiler-year` is already a release witness (`node scripts/test-compiler-year.js && node scripts/run-compiler-year.js`). If release reaches it, do not launch a duplicate standalone annual run. If release is blocked earlier, finish/fix the blocker or explicitly run the year audit separately, with no overlap. Give a new explicit output path when running the driver directly, or verify that its result was freshly overwritten.
4. Audit completion means eight distinct profiles × 52 weeks = 416 distinct athlete-weeks, all required weekly checks, 416 exact reopens, calf/hamstring checks, six annual fault controls, and passing ownership prerequisite. Read all failed/not-reached keys, not just a totals line. Verify source revision and process exit. The supplied summarize-annual.py reads the default result path and currently expects the a75a2587 source stamp; adapt the stamp/output path if later changes are documented, without weakening assertions.
5. Report actual failures and fix those within Sam's existing programming rulings; do not weaken gates, invent coaching decisions or rerun old investigations. If code changes, rerun affected checks with clear source provenance.
6. Report completed release/year results and remaining limits. No deployment, install, live-folder merge, or simulator disruption without Sam's approval. Once verification passes, prepare a clean Release build for approval; the saved successful native build command is in output/whole-week-planner-2026-09-08/phone/build-final.log. Its old app artifact is NOT this candidate.

## Outstanding requests / NOT COVERED

- Feedback/support destination is corrected and tested as configuration/URL construction. Mail-app launch, sending, inbox ownership and delivery are unmeasured. Do not send a message without explicit authorization.
- Signup/account recovery/profile email are absent in live navigation/screens. Old AuthStackParamList names and UserProfile.email/default data are placeholders, not a built account system. No auth/backend work was included in integration.
- Native padding pixels, complete release/year verification, fresh native build, physical iPhone, cloud sync and true OS process death remain uncovered. No new three-day audit was run: the saved three-day result at 9cc19db1 was verified as historical only.
