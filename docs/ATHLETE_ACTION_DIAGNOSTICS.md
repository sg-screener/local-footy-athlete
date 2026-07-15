# Athlete action diagnostics

This development-only trace follows one athlete action through parsing, routing,
repair, accepted-state verification/publication, persistence, visible projection,
Coach Notes, and the final UI outcome. It is disabled unless explicitly enabled,
and it is always disabled in production builds.

## Start a local trace session

From the repository root, start Metro while saving its terminal output:

```sh
EXPO_PUBLIC_ENABLE_ATHLETE_ACTION_DIAGNOSTICS=true npm run start 2>&1 | tee /tmp/lfa-athlete-actions.log
```

Normal events are prefixed with `[athlete-action-trace]`. Find the request event
for the action and copy its `traceId` (for example, `aa-12ab34cd`):

```sh
rg -n -C 2 "athlete_action_requested|athlete_action_failed" /tmp/lfa-athlete-actions.log
```

Then show only that action's complete reason chain:

```sh
rg -n -C 3 'aa-12ab34cd' /tmp/lfa-athlete-actions.log
```

To select the next non-hydration action for the optional redacted deep snapshot,
restart with:

```sh
EXPO_PUBLIC_ENABLE_ATHLETE_ACTION_DIAGNOSTICS=true \
EXPO_PUBLIC_ATHLETE_ACTION_DEBUG_NEXT_TRACE=true \
npm run start 2>&1 | tee /tmp/lfa-athlete-actions-deep.log
```

Alternatively, a local debugger can call `selectAthleteActionDebugTrace(traceId)`
before the accepted-state transaction. Exercise prescriptions remain redacted.
Only when prescription detail is explicitly required for local diagnosis, add
`EXPO_PUBLIC_ATHLETE_ACTION_INCLUDE_PRESCRIPTIONS=true`.

## Reproduction 1: move future Monday Lower Strength to Wednesday

1. Open the Program tab and navigate to a future week containing `Lower Strength`
   on Monday and an eligible Wednesday destination.
2. Tap Monday, then `Want to change something?`.
3. Tap `Edit this session`, then `Move this session`.
4. Under `Move to:`, tap `Wednesday`.
5. Capture the trace beginning with `actionType: move_session`.
6. Verify it contains source/target dates, candidate and gateway events when a
   repair was needed, publication/persistence, `visible_projection_result`, and
   `athlete_ui_outcome_shown`.

## Reproduction 2: delete future Friday CORE Continuous Aerobic

1. In the Program tab, navigate to the future week and expand Friday
   `CORE Continuous Aerobic`.
2. Tap `Want to change something?`.
3. Tap `Edit this session`, then `Bin this session`.
4. If `Bin what?` appears, choose the conditioning/CORE component required for
   the reproduction; otherwise continue with the whole session.
5. Tap `Yes, bin it`.
6. Capture the `delete_component` or `delete_session` trace and inspect the
   `mutation_constraint_created` identity, repair candidates, exact rejection
   codes (if any), atomic publication, visible result, and UI result.

## Reproduction 3: delete Sunday CORE Hard Intervals

1. Navigate to the relevant future Sunday and expand `CORE Hard Intervals`.
2. Tap `Want to change something?` → `Edit this session` → `Bin this session`.
3. Choose the required scope if `Bin what?` is shown.
4. Tap `Yes, bin it`.
5. Filter the resulting trace and inspect `repair_horizon_selected`, every
   `repair_candidate_rejected`, the selected candidate/gateway result, and the
   final terminal reason chain if the action failed.

## Reproduction 4: remove Saturday Game Day

1. Navigate to a week with Saturday Game Day and expand Saturday.
2. Tap `Move or remove game day`.
3. Tap `Remove Game Day`.
4. Capture the `game_day_change` trace.
5. Inspect the rolling dependency weeks, fixture candidate costs and changes,
   accepted gateway result, Coach Note identities, persistence, and visible/UI
   outcomes.

For a Pre-season practice match, follow the same steps; the action is recorded as
`practice_match_change`.

## Reproduction 5: clear the Game Day adjustment

1. After reproduction 4, locate the corresponding card under `Coach Notes`.
2. Tap its clear action.
3. In `Clear this adjustment?`, tap `Clear and update program`.
4. Capture the `clear_adjustment` trace.
5. Inspect `clearedAdjustmentIds`, `clearedLinkedOverrideDates`,
   `displacedSessionRestorationResult`, removed/preserved note identities, and
   whether visible state equals accepted state.

## Reproduction 6: remove Game Day in another week and inspect Coach Notes

1. Navigate to a different editable week with Game Day.
2. Expand the Game Day and tap `Move or remove game day` → `Remove Game Day`.
3. Return to the Program tab's `Coach Notes` section after the mutation finishes.
4. Capture the new `game_day_change` trace; do not reuse the trace from the
   earlier week.
5. Inspect `coach_notes_result` for active adjustment counts before/after,
   derived, added, preserved, removed and suppressed identities, lifecycle
   deduplication keys, and `noteStateMatchesAcceptedProvenance`.
6. If no card appears, the same event states whether it was suppressed and which
   accepted constraint/provenance identity owned that decision.

## Terminal failure checklist

For the generic unchanged-plan message, the trace should expose:

- `internalResultCode` and `originalRejectionCode`;
- `firstFailingBoundary` and exact candidate rejection codes;
- `failureCategory` and the complete `terminalReasonChain`;
- whether a valid candidate existed;
- whether the previous state was restored;
- why the generic UI message key was selected.

Normal events contain compact identities and hashes only. They do not include raw
Coach requests, profile/health details, or full exercise prescriptions.
