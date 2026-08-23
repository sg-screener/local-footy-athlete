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

- Product compile: the full `tsc --noEmit` check is green at the cost-and-brevity
  checkpoint.
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
- The Lab's first dev/test type error was found and cleared. The full product
  compile is now green at the later cost-and-brevity checkpoint.

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
  returns no provider error details to the caller. A server-side
  `COACH_LAB_ENABLED` kill switch is false between controlled runs, so the public
  Supabase client credential cannot create unattended OpenAI spend. A deployed
  synthetic probe now returns the expected `503 coach_lab_disabled` without
  reaching OpenAI.
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
  Coach Lab 37/37 and Coach clean-room 59/59. The clean-room guard now permits
  exactly `coach-lab` and mutation-proves that a retired `coach-chat`
  registration remains forbidden.
- The repo-law guard still reports its ten pre-existing shared-checkout failures;
  none names a file in this connection slice.

### First canonical-source OpenAI run

Sam explicitly approved sending the private LFA knowledge pack and the
identifier-free Snapshot to OpenAI in this task. One controlled case ran, then
the server switch returned to false; a post-run synthetic probe proves the
deployed endpoint again returns `503 coach_lab_disabled` before OpenAI.

- Case: `rooted-but-wants-to-train` — *"legs are rooted but dont wanna skip"*.
- Model: `gpt-5.6-sol`; prompt `coach-lab-openai-v1`; provider storage false.
- Measured request: 213,109 total tokens and 22,706 ms for one answer. This is a
  deliberate full-source quality benchmark, not a viable per-message production
  cost. Retrieval/compression must be measured before chat release.
- Automatic result: 6/6 boundaries green — schema, usefulness, read-only,
  program grounding, LFA grounding and judgement transparency. It remains
  `needs_owner_review`; automatic checks cannot approve coaching quality or
  Sam's voice.
- The model cited *LFA Programming Bible §9 — Tired today; Sore; Slight
  reduction*. Direct source reading verified all three headings and the claimed
  actions: reduce rather than delete, keep the main lift if movement is good,
  reduce sets, remove 1–2 accessories and avoid pushing. The citation label was
  not trusted merely because the model emitted it.

### Cost-and-brevity slice

Sam judged the benchmark answer as talking to the athlete well, while also
being too long and far too expensive. Two paths were compared:

1. Keep sending the whole knowledge pack and rely on prompt caching plus a
   cheaper model.
2. Retrieve exact current-source excerpts for each question, then use model and
   caching choices only after the context itself is no longer wasteful.

Selected option 2. Caching alone would discount repeated waste but would not
remove it, and changing models before protecting the accepted voice would mix
two variables. The full-source Sol run remains the quality benchmark.

- The local retriever reads the current Bible, Rulings Registry and four
  canonical exercise/conditioning sources on every run. It selects exact line
  slices with exact source coordinates; it creates no summary or persisted
  mini-Bible, so a source edit reaches the next request immediately.
- Across the ten current Lab questions, the available source measured 811,981
  characters. Selected knowledge measured 18,710–28,094 characters in 11 exact
  chunks per case; complete instructions measured 22,088–31,482 characters.
  The selected knowledge is 2.3–3.5% of the available source, before tokenisation.
- The contract now aims for 60–90 words and the evaluator automatically fails
  any answer over 100 words. Routine requests use low current-turn reasoning,
  low verbosity and a 1,800-output-token safety cap.
- Every provider response now records six explicit token units: input,
  cached-input, cache-write, output, reasoning and total. The runner also prints
  answer words plus selected/available knowledge characters, so the next paid
  comparison cannot collapse cost into one unexplained number.
- Sol remains the default benchmark. The isolated endpoint permits only
  `gpt-5.6-sol`, `gpt-5.6-terra` and `gpt-5.6-luna`, enabling a controlled
  same-question comparison after deployment without allowing arbitrary models.
- `test:coach-lab` is green: baseline Lab 18/18, retrieval and length 18/18,
  OpenAI request/receipt/transport 41/41. The request-shape cell was first seen
  red against the prior medium-reasoning request; the retrieval suite was first
  red before its source owner existed, and the 101-word mutation turns the
  concise boundary red.
- No paid request was made in this slice. After Supabase authentication became
  available, the exact committed function deployed successfully as remote
  `coach-lab` version 11 with JWT verification on. A post-deploy synthetic probe
  returns the expected `503 coach_lab_disabled`, proving the new remote version
  is live while its spend switch remains off.

### First retrieved-context Sol run

Sam approved one controlled paid comparison on the same case as the full-source
benchmark. The spend switch was set true for that request only, returned false
immediately afterwards, and a post-run synthetic probe returned
`503 coach_lab_disabled` before OpenAI.

- Case: `rooted-but-wants-to-train` — *"legs are rooted but dont wanna skip"*.
- Model/prompt: `gpt-5.6-sol` / `coach-lab-openai-v2-retrieval`; provider
  storage false; low current-turn reasoning; low verbosity.
- Measured request: 7,352 input tokens, 0 cached-input tokens, 7,349
  cache-write tokens, 339 output tokens including 142 reasoning tokens, and
  7,691 total tokens in 10,042 ms. Against the same case's 213,109-token
  full-source benchmark, total tokens fell 96.4% (27.7 times smaller).
- Retrieval selected 21,765 of 813,045 available canonical-source characters in
  11 exact line-named chunks. The 80-word answer passed all seven automatic
  boundaries, including the new concise boundary, and remains
  `needs_owner_review` rather than approving its own coaching quality.
- The answer is materially cheaper and within the signed length range. Seat
  review still finds a quality question for Sam: it leads safely and uses live
  schedule/readiness facts, but spends much of the short answer on injury triage
  and a compound follow-up instead of giving the practical reduced-session shape
  that the retrieved `Sore` / `Slight reduction` rules support. No cheaper-model
  comparison should obscure that prompt-quality question.

### Practical-before-triage correction and rerun

Sam *"completeky agree[d]"* with that quality verdict. R-135 now binds the
general answer contract: ordinary fatigue/soreness gets practical LFA-backed
training guidance first; injury triage remains brief and proportionate; one
follow-up cannot hide a scale plus symptom checklist. The old prompt was seen
red against the new cell before the corrected prompt returned it green.

One same-case Sol rerun followed the committed correction. The spend switch was
true for that request only, false immediately afterwards, and a post-run
synthetic probe again returned `503 coach_lab_disabled` before OpenAI.

- The 72-word answer leads with `Don’t skip automatically`, then gives the
  retrieved LFA shape: warm up and reassess, reduce lower-body volume, avoid
  extra sets/grinders, and keep the main lift only while movement is good. The
  pain/physio boundary is one final sentence rather than the answer's subject.
- Measured request: 7,444 input tokens, 0 cached-input tokens, 7,441 cache-write
  tokens, 391 output tokens including 150 reasoning tokens, and 7,835 total in
  9,645 ms. That remains 96.3% below the 213,109-token full-source benchmark.
- All seven automatic boundaries pass. It remains `needs_owner_review` pending
  Sam's direct judgement of this corrected answer; the model and seat do not
  approve his voice for him.

### Sol approval and same-case Terra/Luna comparison

Sam approved the corrected Sol answer and ordered the same question through
Terra and Luna. Approval is stored as an exact three-part tape — message, model
and prompt version — after a new regression exposed that the old case-wide flag
would otherwise approve a competitor merely because Sol had passed. The old
shape was seen red; the exact-tape and competing-model cells are now green.

All three calls used the same 7,444 input-token payload, including 7,441
cache-write tokens, and the same exact 21,765-character retrieved knowledge.
USD estimates use each official model page's 2026-08-24 per-million token rates
and its 1.25× cache-write rule; they are request estimates, not an invoice:

- **Sol:** 391 output / 7,835 total tokens; 9,645 ms; estimated **$0.0583**.
  Sam-approved 72-word benchmark.
- **Terra:** 323 output / 7,767 total tokens; 6,692 ms; estimated **$0.0225**.
  Its 73-word answer is the strongest seat-reviewed competitor on this case:
  direct, practical, proportionate, and about 61% cheaper than Sol.
- **Luna:** 424 output / 7,868 total tokens; 6,578 ms; estimated **$0.00237**.
  Automatic boundaries all passed, but seat review rejects the tape: it added
  broader restrictions (avoid sprinting/hard conditioning) and declared all six
  Snapshot fields used despite the message not using load, progress or active
  restrictions. The cheapest candidate is therefore not the truthful winner.

No production tier is selected from one question. Terra earns advancement to
the wider messy-question bench; Luna does not. The spend switch returned false
after the two calls, and a post-run synthetic probe returned
`503 coach_lab_disabled` before OpenAI.

### Terra wider bench

After Sam ruled *"okay terra it is"*, Terra became the guarded default while
the exact Sol tape stayed the approved quality benchmark. A pending-only runner
cell prevents rebuying the approved case. The first nine-case attempt stopped on
the first case after the provider's 120-second timeout and returned no response
receipt. No later case ran. The runner now emits a complete paid checkpoint
after every case, so a later failure cannot erase earlier answer/token evidence.

The retry and remaining eight cases all returned. Nine successful requests
measured 68,858 input tokens (23,121 cached, 45,710 cache-write, 27 ordinary),
2,037 output tokens, 70,895 total tokens and 33,448 ms summed latency (3,716 ms
mean per successful request). Estimated successful-request spend is USD $0.1434
under the dated official Terra rates and 1.25× cache-write rule; the unreceipted
timed-out attempt is excluded. Exact messages and per-case receipts live in
`docs/COACH_LAB_TERRA_TAPES_2026-08-24.md`.

The wider bench found three answer corrections for Sam to rule on: future team
training was phrased in the past, the after-footy clarification offered a prior
game the Snapshot did not establish, and the deload answer forced a
`wrecked`/`absolutely cooked` choice instead of giving the present practical
option. Six other tapes are seat-pass, never owner-approved by implication.

It also found three false automatic failures from one evaluator defect: any case
marked as needing live program facts was forced to cite `visibleWeek`, even when
it honestly asked a question without making a program claim or grounded its
answer in Progress/Load/Readiness instead. The replacement rule permits a
no-claim focused question with no fabricated receipt, or requires at least one
real Snapshot field when athlete facts are claimed. Both new cells were seen red
against the old evaluator before returning green. The recorded nine tapes pass
the corrected mechanical boundary; human quality review still owns the three
content defects above.

The spend switch returned false immediately after the last case, and a post-run
synthetic probe returned `503 coach_lab_disabled` before OpenAI.

## NOT COVERED

- Populated React Native glass and the same-screen readiness rerender are covered
  on the simulator. The earlier honest empty state remains covered by its prior
  receipt.
- Sam accepted the populated Coach dashboard in this task on 2026-08-24.
- The Coach Lab runner, Bible-grounded OpenAI candidate, isolated endpoint and
  synthetic end-to-end provider connection are covered. A visual review/editor
  is not built yet.
- The full-source and retrieved Sol benchmarks, same-case Terra/Luna comparison,
  and nine wider Terra tapes are covered. Sam has not reviewed the nine wider
  tapes or ruled on the three seat-proposed corrections.
- The committed Edge Function changes are deployed as version 11. The remote
  kill switch is independently proven off by a post-deploy zero-spend `503`
  probe.
- No answer is approved yet; Sam has not supplied the ideal answer set.
- No program-change path is added or altered by the dashboard.

## 2026-08-24 — shared-context correction and live read-only cutover

The three Terra failures had one architectural cause: the model received domain
facts without the meanings the app already knew. Dates were bare strings, a
pronoun had no typed conversation owner, and today's quick check looked like an
invitation to choose a stronger status label. The correction is one shared
model-input boundary used by Lab and production: deterministic day timing,
bounded recent turns plus an explicit active target, and typed readiness
provenance/scope. Three deliberate mutations each killed the new guard before
restoration. The exact paid reruns and receipts are recorded in
`docs/COACH_LAB_TERRA_TAPES_2026-08-24.md`; all three passed.

The live Coach tab now awaits a dedicated `coach-chat` client instead of the
local phrase reader. The production Edge Function fixes `gpt-5.6-terra`
server-side, retrieves exact canonical sources from one generated manifest,
accepts no client model or instructions, and returns a strict empty-action
schema. The server rejects any model action and the client rejects one again.
The old conversational proposal/card/program door is disconnected; separate
athlete-owned My Status and system-raised commitment controls remain.

### NOT COVERED

- Local source, context mutation, canonical-source parity, client execution and
  empty-action guards are green.
- Production deployment and a real provider smoke are still owed at this point
  in the record.
- The React Native simulator and Sam's physical iPhone are still owed; by L10
  this is gates-green work, not an athlete-facing completion claim.

### Deployment and mounted execution receipt

The dedicated `coach-chat` Edge Function deployed ACTIVE as version 2 with JWT
verification, and `COACH_CHAT_ENABLED=true` was set separately from the disabled
Lab switch. A production smoke through the real app client returned Thursday's
future Upper Push plus Conditioning session and an empty action list.

The first mounted populated-state flow found a real layout defect: the dashboard
was fixed above the conversation and could consume the whole available body,
leaving chat turns present but unreachable. The source-of-truth correction is
one scroll owner containing Snapshot then conversation, with the composer still
fixed above the keyboard. A liveness mutation moving the dashboard back outside
the scroll now kills the Snapshot guard.

The final iPhone 17 Pro simulator flow reset through the depth-35 populated
journey, opened Coach, typed `whats on thurs?`, received a visible Terra answer,
kept the composer reachable with the keyboard up, and proved no AI change card
exists. It also caught the now-false greeting promise that Coach could change
the program; R-138 removes that clause and retains Sam's exact first sentence,
`G'day, I'm your S&C coach.` The final flow asserts the truthful greeting and
the old promise absent. Screenshot:
`artifacts/ui-walk/coach-terra-read-only.png`.

### NOT COVERED AFTER DEPLOYMENT

- Sam's physical iPhone acceptance remains owed; this is deployed and simulator
  green, not L10-complete.
- Production rate limiting beyond Supabase JWT verification is not added; this
  remains a local/private v1 endpoint, not a public-release abuse boundary.
- The model remains read-only. Existing My Status and system-raised commitment
  controls are tested separately and are not model tools.
