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

For the visual revision, two shapes were compared:

1. Restyle the original single dashboard card while keeping five stacked rows.
2. Give the weekly result one clear hero card and separate the four supporting
   signals into a compact two-by-two tile grid.

Selected option 2. It establishes hierarchy instead of decorating a list. A
first pass put lime markers on every tile; the simulator showed those markers
could falsely imply that empty states were positive, so they were removed.

## Current shape

- `buildCoachSnapshot`: pure, store-free and clock-free; carries one visible
  week plus the existing Journal/readiness/restriction answers.
- `useLiveAthleteSnapshot`: the only input adapter; recomputes from existing facts.
- `CoachDashboard`: one weekly hero and four compact Snapshot tiles, no AI and
  no writes.
- `CoachTabScreen`: constructs one Snapshot, hands it to the dashboard, and
  supplies its visible week to all existing conversation readers.
- `test:coach-snapshot`: domain, ownership, persistence-absence and liveness
  guard, included in `test:bible`.

## Measurements

- Product compile: no error names a new or modified Step-3 file. The compile
  remains red on unrelated shared-checkout files that were already red before
  this slice.
- Pure/ownership Snapshot guard: 36/36 green, including the redesigned layout
  anchors, glass-flow anchors and two mutations that break the protected
  ownership shapes.
- Clean-room: 58/58. Current Coach slice 2: 72/72. Journal week/load/strength:
  42/42, 125/125 and 17/17. Copy extraction/binding: 7/7 and 9/9. Feature and
  dead-affordance registries: 6/6 each.
- Glass: the redesigned screen passed every focused command on iPhone 17 Pro /
  iOS 26.3: deterministic seed, Coach navigation, weekly progress track, four
  signal tiles, the existing conversation and screenshot. The screenshot was
  inspected after the final neutral-state marker removal. Evidence:
  `artifacts/ui-walk/coach-snapshot-dashboard.png`.
- The Coach phrase-handler clean-room ratchet is 8/8 after the generic Snapshot
  modules were moved out of Coach-named files. The gate was not re-baselined or
  weakened.
- Existing reds remained calibrated: Coach slice 1 has its pre-existing
  HomeScreen naming assertion; slice 3 has its pre-existing tape/phase-review
  assertions; the law registry has its pre-existing missing game-feedback
  script, LR-18 row and 21 UNENFORCED laws. The Maestro element census has 16
  pre-existing stale ids; none is in the new flow.
- The five dashboard labels and states are Batch 38 SIGNED by Sam's direct
  ruling: *"the wording is fine"*. The first visual treatment was not signed;
  this checkpoint is its replacement.

## NOT COVERED

- Base/empty React Native glass is covered. Non-empty readiness, recorded
  load/progress, an active restriction and same-screen live updates are not yet
  walked on glass.
- Sam has not yet accepted the redesigned layout on his physical phone.
- No AI provider, Bible-grounded answer system or Coach Lab work belongs to
  this step.
- No program-change path is added or altered by the dashboard.
