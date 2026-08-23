# STATUS — snapshot

Date: 2026-08-24
Branch: `codex/coach-snapshot-dashboard`
Owner: `snapshot`

## Mission

Steps 3-4 of Sam's clean Coach rebuild: one live Coach Snapshot and accepted
dashboard, followed by a local Coach Lab that proves response quality before a
provider or replacement chat is allowed near the app. The current simple Coach
remains in place.

## Options compared before coding

1. Let the dashboard read the Journal, readiness and modifier stores directly,
   while the conversation keeps reading the visible week separately.
2. Put every read behind one adapter and return a pure, ephemeral Snapshot that
   both dashboard and conversation receive.

Selected option 2. It removes the class of bugs where two Coach surfaces are
individually correct about different moments or weeks. The pure builder refuses
a week/date mismatch and the Snapshot is never persisted.

For the first visual revision, two shapes were compared:

1. Restyle the original single dashboard card while keeping five stacked rows.
2. Give the weekly result one clear hero card and separate the four supporting
   signals into a compact two-by-two tile grid.

Selected option 2. It establishes hierarchy instead of decorating a list. A
first pass put lime markers on every tile; the simulator showed those markers
could falsely imply that empty states were positive, so they were removed.

Sam then corrected the hierarchy: training load is the primary coaching signal,
because its signed continuum tells the athlete whether they are below, inside or
above their sweet spot. The weekly completion card moved into the grid under his
word `Consistency`. This reuses the existing signed 0.8–1.3 load band and live
ratio; no score, threshold or second load owner was added.

## Current shape

- `deriveCoachSnapshot` and `buildCoachSnapshot`: pure, store-free and
  clock-free; own the complete Journal/load/progress derivation and carry one
  visible week plus the existing readiness/restriction answers.
- `useLiveAthleteSnapshot`: the only input adapter; recomputes from existing facts.
- `CoachDashboard`: one load-continuum hero and four compact Snapshot tiles —
  Consistency, readiness, progress and My Status — with no AI and no writes.
- `CoachTabScreen`: constructs one Snapshot, hands it to the dashboard, and
  supplies its visible week to all existing conversation readers.
- `test:coach-snapshot`: domain, ownership, persistence-absence and liveness
  guard, included in `test:bible`.

## Measurements

- Product compile: no error names a new or modified Step-3 file. The compile
  remains red on unrelated shared-checkout files that were already red before
  this slice.
- Pure/ownership Snapshot guard: 40/40 green. It carries the signed sweet-spot
  edges, proves the continuum order, anchors the load hero before the tile grid
  and kills a mutation that swaps Load with Consistency.
- Populated journey: 15/15 green after 35 calendar days, 19 real recorded
  session decisions and one production block rollover. It earns five recorded
  weeks, a signed load ratio and movable marker, populated Consistency,
  week-over-week Progress and a durable Restriction. A Sunday cooked-status
  action changes Readiness on the next live derivation without a reset or
  reopened surface. Removing one history week kills the four-week ratio.
- Clean-room: 58/58. Current Coach slice 2: 72/72. Journal week/load/strength:
  42/42, 125/125 and 17/17. Copy extraction/binding: 7/7 and 9/9. Feature and
  dead-affordance registries: 6/6 each.
- Glass: the populated screen and its live refresh passed every focused command
  on iPhone 17 Pro / iOS 26.3. A fresh local athlete earned five weeks through
  real session, load, rollover and exclusion doors. The first screenshot shows
  the signed moving load marker, 5/5 Consistency, week-over-week Progress and
  one active My Status item. A cooked check-in was then accepted while Coach
  stayed mounted; the second screenshot changes Readiness from `No check-in
  today` to `Feeling flat` while the load marker and My Status remain. Evidence:
  `artifacts/ui-walk/coach-snapshot-dashboard.png` and
  `artifacts/ui-walk/coach-snapshot-dashboard-live-refresh.png`.
- The Coach phrase-handler clean-room ratchet is 8/8 after the generic Snapshot
  modules were moved out of Coach-named files. The gate was not re-baselined or
  weakened.
- Existing reds remained calibrated: Coach slice 1 has its pre-existing
  HomeScreen naming assertion; slice 3 has its pre-existing tape/phase-review
  assertions; the law registry has its pre-existing missing game-feedback
  script, LR-18 row and 21 UNENFORCED laws. The Maestro element census has 16
  pre-existing stale ids; none is in the new flow.
- The five dashboard labels and states are Batch 38 SIGNED by Sam's direct
  ruling: *"the wording is fine"*. `Consistency` is signed by his exact word in
  the hierarchy correction, and `My Status` by his exact rename after confirming
  that tile is the same active-modifier list as the full status screen.

## Coach Lab checkpoint

Two starts were compared before coding:

1. Put a model into the app first, then decide whether its answers feel good.
2. Build a provider-free local evaluator first, baseline the living Coach, and
   refuse to count an answer as good until both mechanical boundaries and Sam's
   review clear it.

Selected option 2. It makes provider choice a result of LFA's own questions,
not a generic benchmark, and it cannot change the athlete's program.

- The first corpus holds ten messy athlete questions from the Coach redesign
  brief. Every ideal answer is deliberately `null` and owner review is pending;
  no athlete-facing coaching answer was invented.
- Every candidate returns one versioned response shape carrying its basis,
  Snapshot fields, LFA sources, judgement label, program actions and provider
  diagnostics. The current deterministic Q&A path is the first candidate.
- The evaluator fails a generic refusal, any program action, an ungrounded live
  program claim, an LFA claim with no source, or unlabelled coaching judgement.
  Medical safety, coaching quality and Sam's voice stay mandatory human review
  because a response cannot truthfully certify its own wording.
- The first real run reached ten distinct cases: eight automatic failures, two
  waiting for owner review and zero approved answers. The false-comfort catch is
  visible: *"missed monday. cram it weds?"* receives a grounded Monday schedule
  answer without answering whether Wednesday is wise. The automatic boundary
  clears it, but owner review does not; this is why both halves exist.
- `test:coach-lab` is 18/18 and mutation-proves direct-write, hidden-judgement,
  ungrounded-program, ungrounded-LFA and generic-refusal failures. It runs inside
  `test:coach-snapshot`, so the existing Bible chain reaches the new Lab.
- Snapshot 43/43, populated Snapshot 15/15, Coach clean-room 58/58 and Coach
  phrase ratchet 8/8 remain green. The Lab lives under dev tooling and changes
  no product screen, store, server or provider.
- Compile remains red on the shared baseline. The Lab's one new dev/test error
  was found and cleared; direct dev/test compilers now name no Coach Lab file.

## NOT COVERED

- Populated React Native glass and the same-screen readiness rerender are covered
  on the simulator. The earlier honest empty state remains covered by its prior
  receipt.
- Sam accepted the populated Coach dashboard in this task on 2026-08-24.
- The Coach Lab runner and baseline are covered. A visual review/editor,
  Bible-grounded candidate and provider comparison are not built yet.
- No answer is approved yet; Sam has not supplied the ideal answer set.
- No program-change path is added or altered by the dashboard.
