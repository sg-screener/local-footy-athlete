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
