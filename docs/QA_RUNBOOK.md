# QA Runbook — one page, no exceptions

**Test surface:** `docs/SUPPORTED_ATHLETE_ACTIONS.md`. Nothing else.

## Start everything (one command)

```bash
bash scripts/qa-start.sh
```

Boots the simulator, checks `.env`, starts Metro from THIS checkout on
port 8081. Then reset to a deterministic week:

```bash
E2E_METRO_URL=http://127.0.0.1:8081 scripts/dev-e2e/run-maestro-ios.sh \
  .maestro/common/reset-seed.yaml -e SEED_ID=standard-in-season-week
```

(Seeds: see `src/dev/e2e/devE2ESeedIds.ts`. All anchor to Mon 2026-07-13.)

## Session rules (for human AND agent)

1. One app area per session. One findings file:
   `docs/audits/AREA_YYYY-MM-DD.md` (screen, action, expected, actual,
   PASS/FAIL/BLOCKED, screenshot path for failures only).
2. Tap within 30 seconds. Record. Move on. NO diagnosis during audit.
3. Known gaps in FLOW_AUDIT / SUPPORTED_ATHLETE_ACTIONS = pre-logged. Skip.
4. Group failures after the area is done: crash / wrong-data / dead-control
   / navigation / visual / rules-engine.
5. One fix chat per group. Rules-engine groups go through the CLAUDE.md
   escalation rule first.
6. Retest = rerun affected golden flows + re-tap the failed items. Nothing
   broader.
7. NO new worktrees, NO harness additions (`src/dev/e2e/` is frozen), NO
   temporary scripts, NO trusting a marker over the visible screen.
8. Both lanes share one checkout. Lane 1 owns the current branch and may
   switch it. Lane 2 never switches branches — commit docs wherever HEAD
   happens to be, note the branch in the report, and let doc commits ride
   feature branches into main at merge.

## Audit order

1. Program (seeds + golden flows exist — validates the loop)
2. Workout
3. Home V2
4. Onboarding (needs fresh-install path)
5. Profile/Settings
6. Journal
7. Auth
8. Coach — questions only; mutations blocked pending reassessment

## Environment facts (hard-won, do not relearn)

- Worktrees do NOT inherit `.env` — copy it from the main repo or Metro
  bundles without Supabase vars and CoachScreen dies.
- Maestro `launchApp` arguments never reach UserDefaults — do not gate
  anything on launch-arg detection.
- The RN DevTools banner ("Open debugger to view warnings.") overlays the
  tab bar and eats taps; suppressed via `LogBox.ignoreLogs` in `App.tsx`
  (commit pending on `codex/final-verification-unblock`). If it ever
  reappears, that fix regressed.
- Plain icon-relaunch after a seed session white-screens (dev-harness
  cold-start gate fails closed). Relaunch only through the checkpoint
  protocol or reseed. This blocks naive persistence testing — known issue.
- Simulator ignores synthetic keystrokes from screen-control agents; use
  clipboard paste. (Irrelevant inside Claude Code — Maestro types fine.)
- **Headless device-exact seed repro: durable-restore `capturedAt` epoch-0
  artifact (known gap, no fix).** When a headless test installs a seed the
  device-exact way (`seedOnboardingProgram` + `commitAcceptedStateTransaction`,
  `preserveExactAcceptedWorkouts`) and then drives a durable source-fact commit
  that rolls back, the rollback can fail with
  `accepted_state_rollback_mismatch` because the restored
  `acceptedProfileSnapshot.capturedAt` normalises to `1970-01-01` (epoch-0) while
  the captured pre-state holds the install timestamp. This is a
  localStorage-mock persistence-fidelity gap on the *restore* side — NOT the
  `new Date()` drift (that was fixed 2026-07-22: the accepted-profile snapshot
  now uses `appDateNow()`, and a frozen test clock makes the install-side
  `capturedAt` deterministic). It masks the real rejection reason in
  device-exact repros. The normal suite seed (R1-style: normalized context, no
  profile snapshot) does NOT hit it. Freeze the clock and prefer the R1-style
  seed for repros; don't re-diagnose the epoch-0 as a product bug.
  See `docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md`.

## Known pre-existing reds (do not re-investigate)

Suites that fail for known, accepted reasons, unrelated to whatever this
session is working on. If one of these comes up red, confirm the signature
matches below and move on — don't re-diagnose it as a new regression.

- **`coachBehaviourScenarioTests`**
  (`npm run test:coach-behaviour-scenarios`) — weekend date-rot. Scenarios
  built around a "Friday" reference date fail whenever the suite is run on
  a Saturday or Sunday (the scenario's relative-day math rots over the
  weekend). Only the "fridays" scenarios are affected; weekday runs are
  unaffected. Known, not fixed, not blocking.

- **`programControlActionsTests`**
  (`TZ=Australia/Melbourne npx sucrase-node
  src/__tests__/programControlActionsTests.ts`) — coach-notes/recovery
  failure, present on the pre-stage-1 baseline (predates the §18 ownership
  migration work). Exact signature as captured 2026-07-22:
  - `[1] recovery modifier creation through ProgramControlAction` → FAIL
    "Coach Notes includes recovery mode"
  - `[2] no duplicate recovery status modifiers` → FAIL "one active
    recovery constraint" (expected 1, actual 0); FAIL "one Coach Note"
    (expected 1, actual 0)
  - `[3] multiple modifiers stack` → FAIL "recovery note appears"
  - `[5] clear recovery modifier removes linked program override` → the
    script never reaches its pass/fail summary or `process.exit` — it dies
    with an uncaught `TypeError: Cannot read properties of undefined
    (reading 'id')` at `programControlActionsTests.ts:369` (`noteId:
    note.id`), because scenario 5 depends on a Coach Note that scenarios
    1–3 already show never gets created.
  - Shape: recovery-mode Coach Notes/constraints aren't being created or
    surfaced by the recovery-modifier path in this baseline; scenario 5's
    crash is a downstream symptom of that, not a separate bug. Not
    diagnosed further here — record only.
