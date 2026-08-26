# Launch-audit regression flows

**Run them all:** `npm run qa:audit-flows` (needs `npm run lfa:dev` running
first). One PASS/FAIL line per flow, no screenshots except on the flows' own
checkpoint frames.

Born from the 2026-08-25 launch-readiness audit
(`docs/LAUNCH_READINESS_AUDIT_2026-08-25.md`): each flow is the on-glass proof
of one fixed finding, so a regression shows up as a one-line FAIL instead of a
re-audit. The unit-suite guard for each fix lives in the `test:bible` chain;
these flows prove the athlete-visible half only.

| flow | audit finding | fix commit | unit guard |
| --- | --- | --- | --- |
| `removal-undo-home.yaml` | #7a — "undo" promised in My Status but not findable | `789f8448` | `test:exercise-exclusions` [12] |
| `bin-undo-toast.yaml` | #7b — no undo toast on bin | `574343f7` (root: #6 ledger ids) | `test:undo-reversal` 11b |
| `readiness-ack-never-silent.yaml` | #8 — record-only report claimed an adjustment | `7174a6b6` | `test:readiness-acknowledgment` |
| `full-reset-lands-clean.yaml` | #2 — full reset inherited the old athlete's edits | `fb878e98` | `test:reset-coach` [13] |

Deliberately NOT flows (and why): #1A/#5 (generation-level, need authored
fixture worlds — headless suites `test:forward-decision-acceptance` and
`test:g-plus1-dependent-week` own them); #9 club-training save gate (today in
the standard seed is not a team night; `test:session-feedback-form` owns the
decision); #4 profile-setup scroll (keyboard family, `.maestro/keyboard/`
owns that surface).

## block-rollover.yaml
The block changeover, on glass (2026-08-26, Sam: "do the rollover test
world now"). Seeds the first TWO-DATE world — a four-week block that ended
yesterday with today pinned to the next Monday — and asserts the app's own
boot rolls it over: today carries a real session, the week view shows the
new block's first week with the R-236 Friday Gunshow, and a checkpoint
cold-reload lands on the same week. Closes the audit blind spot "block 2
rolling into block 3 has never been watched on a device".
