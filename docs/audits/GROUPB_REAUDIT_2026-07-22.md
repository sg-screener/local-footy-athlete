# Fix Group B (Visible Verification) Re-Audit — 2026-07-22

**Lane:** 2 (audit/docs only — no code changes, no branch switching).
**Branch/HEAD:** `main` @ `7795ac4` (merge: §18 ownership migration, fix group A —
one mutation owner, 11 invariants). Per `QA_RUNBOOK.md` §8, lane 2 commits docs
wherever HEAD happens to be; this session stayed on `main` throughout.
**Seed:** `standard-in-season-week` (anchor Mon 2026-07-13), reseeded before
each flow. **Device:** iPhone 17 Pro simulator, iOS 26.3, Metro :8081 from this
checkout (`scripts/qa-start.sh`).
**Method:** on-device Maestro MCP reproduction, screenshots for every result.
Screenshots in `docs/audits/groupb-reaudit-2026-07-22/`. Findings only, per
instructions — no fixes attempted.

Environment facts respected: no plain relaunch after a seed session (used
Coach-tab / next-week↔this-week round-trips for persistence checks instead,
per `QA_RUNBOOK.md`); Maestro launch args don't reach UserDefaults (not
relevant to this pass — no launch-arg gating exercised).

---

## Part 1 — Re-audit of the three 2026-07-21 findings

| # | Finding | Verdict |
|---|---------|---------|
| 1 | `WORKOUT_2026-07-21.md` row 2.1 — session feedback submitted, no visible trace | **STILL-BROKEN** |
| 2 | `HOMEV2_2026-07-21.md` row 3.1 — readiness signal submitted, not reflected | **STILL-BROKEN** |
| 3 | `HOMEV2_2026-07-21.md` row 5.1 — phase-status card stale after season-phase shift | **STILL-BROKEN** |

None of the three shrank. This is consistent with the ownership migration's
own scope: all three live outside the program-mutation pipeline the migration
touched (session feedback, readiness signals, and the phase-status card are a
different subsystem from swap/add/move/bin/replace-exercise). The
reassessment (`docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md`) predicted
"some" of the 2026-07-21 findings would shrink now that the visible week is
transaction-owned — these three were never claimed to be in scope, and the
evidence bears that out: nothing about their behavior changed.

### Finding 1 — session feedback not visibly persisted — STILL-BROKEN

Repro: MON (Lower Body Strength) → Start Session → Finish Session → full
feedback form (Fully/Fully/Fully, Solid, Mild) → Save & Finish.

- Result: returns to the Program screen. MON's day card still reads "Start
  Session" with no completed indicator.
- Re-opening the Workout screen shows "Finish Session" again (not a
  completed/read-only state) — identical to the 2026-07-21 signature.
- Screenshot: `groupb-reaudit-2026-07-22/finding1-workout-feedback-not-persisted.png`.

Automation note (not a product finding): a batched double-tap across
strength/support completion buttons that had just appeared silently missed
the second selection, exactly as the 2026-07-21 audit also observed and
attributed to timing/layout-shift in automation. Re-tapping one at a time
resolved it; recorded here so a future re-run isn't misled by the same
artifact.

### Finding 2 — readiness signal not visibly persisted — STILL-BROKEN

Repro: Program screen → "I'm not 100%" → "Just a bit tired today".

- Sheet closes with no toast/confirmation, same as before.
- `readiness-clear-state-2026-07-13` is still present in the view hierarchy
  afterward — the readiness state for today is still reported "clear," not
  "tired." Identical signature to the 2026-07-21 finding.
- Screenshot: `groupb-reaudit-2026-07-22/finding2-readiness-not-persisted.png`.

### Finding 3 — phase-status card stale after season-phase shift — STILL-BROKEN

Repro: "Shift to Off-season mode" → confirm consequences → available-days
picker → "Shift to Off-season" → wait for "Coach is reviewing your week..." to
complete.

- The week visibly rebuilt for off-season exactly as before: MON "Lower Body
  Strength" → "Full Body Strength" with an "OPTIONAL" badge; TUE/THU →
  "Recovery Conditioning" (team-training tags gone).
  Screenshot: `groupb-reaudit-2026-07-22/finding3-week-rebuilt-offseason.png`.
- The season-phase status card at the bottom of the same screen still reads
  "You're in In-season mode" with "Shift to Off-season mode" still offered —
  the same stale/contradictory label as 2026-07-21.
  Screenshot: `groupb-reaudit-2026-07-22/finding3-phase-card-stale-in-season.png`.

---

## Part 2 — Sweep of the five migrated flows for visible-verification gaps

Re-ran the same five flows the `SECTION18_SMOKE_2026-07-22.md` on-device pass
verified before merge, this time directly against merged `main`, checking
specifically for confirmations claiming days that don't visibly match.

| Flow | Confirmation message | Visible result | Match? |
|---|---|---|---|
| 1. Swap, normal day (MON → conditioning) | "Flush Out - 30:30 Intervals is now on 2026-07-13. Lower-body strength was moved to **Wednesday**..." | MON → Aerobic Flush; **WED → Lower Body Strength** | ✅ exact |
| 2. Anchor-day swap (TUE Team Training → Lower Body) | "Lower Body Strength is now on 2026-07-14. This week's strength target has been reduced at your request." | TUE → **Lower Body Strength + Team Training** (anchor preserved) | ✅ exact |
| 3. Empty-day add (WED Rest → conditioning) | "Flush Out - 2min On / 1min Off added on Wednesday. I rebalanced **Friday**..." | WED → Aerobic Flush (OPTIONAL); **FRI → Rest** (Gunshow rebalanced) | ✅ exact |
| 4. Bin, multi-day repair (TUE gym session) | "Upper Pull was removed. Pulling work was added to **Wednesday**. I also rebalanced **Friday**..." | TUE → Team Training only; **WED → Upper Pull**; **FRI → Rest** | ✅ exact |
| 5. Coach deterministic swap (free-text "Swap Back Squat for Front Squat on Monday") | "I couldn't safely validate that revision, so I left the plan unchanged." | MON unchanged: Back Squat 112.5kg, Deadlift 137.5kg | ✅ honest (no false Done), but **not a demonstration of the fixed deterministic path** — see below |

**No new visible-verification gaps found.** Every disclosed-repair message
named exactly the day(s) that visibly changed, and nothing outside the named
days moved. Flow 3's persistence was additionally checked via a Coach-tab
round-trip and a next-week/this-week navigation round-trip — WED still showed
Aerobic Flush after both, confirming the fix holds outside the immediate
screen.

Screenshots: `sweep-flow1-swap-normal-day.png`, `sweep-flow2-anchor-swap.png`,
`sweep-flow3-empty-day-add-persists.png`, `sweep-flow4-bin-multiday-repair.png`,
`sweep-flow5-coach-swap-refused-unchanged.png`.

### Flow 5 caveat — same open item as the pre-merge smoke pass, not newly found

This checkout's `.env` still has `EXPO_PUBLIC_COACH_REVISION_PROPOSAL_MODE=active`
and `..._DEV_ACTIVE=1`, so free-text coach messages are intercepted by the
**active coach-revision-proposal route** before they can reach the
deterministic `replace_exercise` executor that stage 4's #5 fix actually
unified with the tap door (`runReplaceExercise` → `replaceExerciseAtDate`,
green in `test:bible`). Sending the identical message the smoke pass used
("Swap Back Squat for Front Squat on Monday") reproduced the identical
generic refusal — *"I couldn't safely validate that revision, so I left the
plan unchanged."* — and the plan was genuinely unchanged (verified on the
Workout screen: Back Squat 112.5kg, Deadlift 137.5kg, both untouched). This
is CHANGED in neither direction: it is the same pre-existing, already-tracked
gap (`SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md` "Stage 5 diagnosis"),
not a new regression, and per that document's Q0 finding this route is
dev-gated and does not run in production (`isDev===false` resolves it to
`'off'`). Confirms no false "Done" — the safety property holds — but the tap
door remains the only in-app path that demonstrates the fixed deterministic
swap for this input.

---

## Summary

- **Fix group B is still open.** All three 2026-07-21 visible-verification
  findings (session feedback, readiness signal, phase-status card) reproduce
  identically on merged `main`. None were in scope for the §18 ownership
  migration, so this is expected, not a regression.
- **No new visible-verification gaps** in the five migrated program-mutation
  flows. Every disclosed repair matches the visible week exactly; empty-day
  add persistence holds across navigation.
- **One already-tracked, dev-gated gap reconfirmed unchanged:** the free-text
  coach-revision route still can't demonstrate the fixed exercise-swap
  executor for a legal same-pattern swap; it fails safe (no false Done, no
  raw error code, plan genuinely unchanged) but doesn't apply the change the
  tap door applies. Tracked under "Stage 5" in the reassessment doc; not
  reopened here as a new finding.
