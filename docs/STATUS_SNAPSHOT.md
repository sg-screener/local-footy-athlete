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

## Fresh OpenAI Coach Lab connection

Two connection shapes were compared:

1. Revive or modify one of the old deployed Coach functions because it already
   knows how to reach an AI provider.
2. Reuse only the existing Supabase-held `OPENAI_API_KEY`, while building a new
   isolated endpoint, prompt, Snapshot payload, strict output contract and Lab
   evaluator from a blank source file.

Selected option 2. The credential and provider account were never the legacy
problem; the old brain and orchestration were. No deleted Coach handler, prompt,
store or mutation path returned.

- Supabase still held the existing `OPENAI_API_KEY`. A new authenticated
  `coach-lab` Edge Function is deployed separately. The remote inventory then
  exposed four frozen functions whose source had been deleted locally but whose
  deployments were still active: `coach-chat`, `coach-intent`,
  `coach-semantic-program-edit-draft` and `coach-revision-proposal`. Sam's prior
  demolition ruling applied; all four were deleted and a second remote listing
  proves `coach-lab` is now the one deployed Coach function. The retired source
  remains recoverable from the repository backup/history. The new endpoint fixes
  the benchmark model, bounds request size, disables OpenAI response storage and
  returns no provider error details to the caller.
- The full Lab brain pack reads the current LFA Programming Bible, active
  Rulings Registry and four canonical exercise/conditioning sources. Athlete
  data is restricted to the one live Coach Snapshot; account, email, user and
  athlete identifiers are absent.
- The structured response schema cannot contain a program action. It records
  answer mode, basis, exact Snapshot fields used, cited LFA sources, labelled
  judgement and provider diagnostics before the existing Lab evaluator sees it.
- The first end-to-end request used synthetic rules and the synthetic fixture
  only. The existing key successfully reached OpenAI and returned a 2,036-token
  structured answer with `athlete_snapshot` plus labelled coaching judgement,
  zero actions and verdict `needs_owner_review`.
- The first provider request found one real incompatibility: OpenAI's strict
  schema subset rejects `uniqueItems`. It was removed. A new guard then proved
  live by reintroducing the keyword and turning the OpenAI Lab suite red 35/1;
  restoring the supported schema returns it to 36/36.
- Final focused gates: Coach Snapshot 43/43, populated Snapshot 15/15, OpenAI
  Coach Lab 36/36 and Coach clean-room 59/59. The clean-room guard now permits
  exactly `coach-lab` and mutation-proves that a retired `coach-chat`
  registration remains forbidden.
- The repo-law guard still reports its ten pre-existing shared-checkout failures;
  none names a file in this connection slice.

## NOT COVERED

- Populated React Native glass and the same-screen readiness rerender are covered
  on the simulator. The earlier honest empty state remains covered by its prior
  receipt.
- Sam accepted the populated Coach dashboard in this task on 2026-08-24.
- The Coach Lab runner, Bible-grounded OpenAI candidate, isolated endpoint and
  synthetic end-to-end provider connection are covered. A visual review/editor
  and provider comparison are not built yet.
- Canonical private LFA sources and a real Snapshot-derived athlete payload were
  not sent to OpenAI; that data-sharing boundary awaits Sam's explicit approval.
- No answer is approved yet; Sam has not supplied the ideal answer set.
- No program-change path is added or altered by the dashboard.
