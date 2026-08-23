# STATUS — snapshot

Date: 2026-08-24
Branch: `codex/coach-snapshot-dashboard`
Owner: `snapshot`

## Mission

Step 3 of Sam's clean Coach rebuild: build one live Coach Snapshot and a
non-AI dashboard for this week, readiness, load, progress and restrictions.
The current simple Coach remains in place.

## Options compared before coding

1. Let the dashboard read the Journal, readiness and modifier stores directly,
   while the conversation keeps reading the visible week separately.
2. Put every read behind one adapter and return a pure, ephemeral Snapshot that
   both dashboard and conversation receive.

Selected option 2. It removes the class of bugs where two Coach surfaces are
individually correct about different moments or weeks. The pure builder refuses
a week/date mismatch and the Snapshot is never persisted.

## Current shape

- `buildCoachSnapshot`: pure, store-free and clock-free; carries one visible
  week plus the existing Journal/readiness/restriction answers.
- `useLiveAthleteSnapshot`: the only input adapter; recomputes from existing facts.
- `CoachDashboard`: five compact readers of the Snapshot, no AI and no writes.
- `CoachTabScreen`: constructs one Snapshot, hands it to the dashboard, and
  supplies its visible week to all existing conversation readers.
- `test:coach-snapshot`: domain, ownership, persistence-absence and liveness
  guard, included in `test:bible`.

## Measurements

- Product compile: no error names a new or modified Step-3 file. The compile
  remains red on unrelated shared-checkout files that were already red before
  this slice.
- Pure/ownership Snapshot guard: 34/34 green, including the glass-flow anchors
  and two mutations that break the protected ownership shapes.
- Clean-room: 58/58. Current Coach slice 2: 72/72. Journal week/load/strength:
  42/42, 125/125 and 17/17. Copy extraction/binding: 7/7 and 9/9. Feature and
  dead-affordance registries: 6/6 each.
- Glass: the first focused run reached the seeded app but its XCUITest driver
  disconnected at port 7001. The immediate second run passed every command,
  and the final run after the clean-room-compatible file move passed again:
  deterministic seed, Coach navigation, the five section ids, the conversation
  and screenshot. Evidence: `artifacts/ui-walk/coach-snapshot-dashboard.png`.
- The Coach phrase-handler clean-room ratchet is 8/8 after the generic Snapshot
  modules were moved out of Coach-named files. The gate was not re-baselined or
  weakened.
- Existing reds remained calibrated: Coach slice 1 has its pre-existing
  HomeScreen naming assertion; slice 3 has its pre-existing tape/phase-review
  assertions; the law registry has its pre-existing missing game-feedback
  script, LR-18 row and 21 UNENFORCED laws. The Maestro element census has 16
  pre-existing stale ids; none is in the new flow.
- The five dashboard labels and states are Batch 38 PROPOSED. They are not
  treated as Sam-signed copy.

## NOT COVERED

- Base/empty React Native glass is covered. Non-empty readiness, recorded
  load/progress, an active restriction and same-screen live updates are not yet
  walked on glass.
- Batch 38 words await Sam's approval or replacements.
- No AI provider, Bible-grounded answer system or Coach Lab work belongs to
  this step.
- No program-change path is added or altered by the dashboard.
