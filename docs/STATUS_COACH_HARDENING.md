# STATUS — seat `coachhardening`

Opened 2026-08-24 for Sam's order to clear the four real findings from the
fresh Coach checkpoint audit before making another phone build.

## Shared truth contract

Two options were compared:

1. Add the missing flag independently at the Lab and production call sites.
2. Make both grounding inputs mandatory in the shared response-contract type,
   then give each caller its real live-program requirement and exact retrieved
   source ids.

Selected: option 2. Omitting either half is now a TypeScript error. Production
requires a Snapshot receipt for live answers and restricts citations to the
chunks it retrieved. Coach Lab uses each case's live-fact requirement and the
chunk ids attached by the non-model retrieval owner. A fabricated Lab citation
now fails the same shared contract as it does in production.

Measured evidence: `test:coach-chat-integration` 56/0 and `test:coach-lab`
104/0 across its three suites. Changing production's live-program requirement
to false killed the production-policy cell; the mutation was restored.

## Durable paid-call limit

Two options were compared:

1. Keep the bounded per-isolate map and improve its header parsing. This still
   resets on every isolate and cannot bound total OpenAI spend.
2. Put both a per-client window and project-wide spend ceiling in one atomic
   Postgres function shared by every Edge isolate. Store only an HMAC of the
   platform-forwarded address and fail closed if identity or the limiter is
   unavailable.

Selected: option 2. The app-wide public credential is no longer an identity
fallback. A spoofed client identity cannot bypass the separate global ceiling.
The old in-memory limiter is deleted.

Migration history was empty even though the linked database contained the
tables and seed rows from migrations 001-006. Their history rows were repaired
as applied; a dry run then named only migration 007. Migration 007 applied
successfully. A new server-only `COACH_RATE_LIMIT_SECRET` was generated and set
without printing or storing its value in the repo.

Measured evidence: the integration suite executes HMAC key stability/privacy,
the private RPC request and the returned retry/scope verdict. For liveness,
forcing the durable adapter to allow a database refusal killed the runtime
verdict cell; the mutation was restored.

## Live deployment receipt

- `coach-chat` is ACTIVE as version 9 with JWT verification on.
- A live `whats on thurs?` smoke crossed the deployed database limiter, called
  Terra, returned `Thursday (27 Aug) is Upper Push plus Conditioning.`, and
  carried zero program actions.
- The linked database then reported `private.coach_rate_limits` with two
  distinct rows: the one opaque client window and the separate global window.
  The instrument's unit is database rows after one live Edge request, not
  athletes or paid calls.
- A truth-contract refusal now logs only its violation names before returning
  the typed refusal; it never logs the athlete question or model answer.

## Truthful failures and disclosure

Sam approved three distinct athlete-visible outcomes: the existing no-answer
copy for a genuinely empty response, `Coach isn't available right now. Try
again shortly.` for transport/server outages, and `I can't answer that safely.`
for a grounding refusal. One shared closed failure type owns the mapping from
the API boundary to the screen, so the UI cannot silently collapse those
states back together.

The Privacy screen now states exactly which concise, whitelisted summaries may
be sent, that backend and AI services receive them, and that Coach is completely
read-only. Ruling R-140 and its guarded registry row bind both the failure copy
and the disclosure to `test:coach-snapshot + test:profile-reset-ui`.

Measured evidence:

- `test:coach-snapshot`: Snapshot 35/0, populated-state 17/0, Progress 13/0,
  Coach Lab 104/0, Coach integration 56/0.
- `test:profile-reset-ui`: 171/0.
- `test:signed-copy-extraction`: 7/0 and `test:copy-rulings-binding`: 9/0.
- Collapsing the outage copy back into the old no-answer copy killed two Coach
  integration cells. Removing restrictions from the disclosure killed its
  Profile cell. Both mutations were restored.
- A final live deployed request returned `Tomorrow is Team Training.` with zero
  program actions.

## Final falsification-pass fixes

The four findings in the final read-only audit are now fixed at their shared
owners rather than patched as isolated prompts:

- One shared 1,000-character boundary now protects the input, API client,
  history builder and Edge function. Oversize current turns stop before the
  network call and oversize historical turns are excluded from model context.
- Recorded workout completion now reconciles saved execution evidence against
  the current visible plan. Changed or removed rows are not guessed as
  complete; game-only feedback cannot fabricate gym completion; orphaned saved
  evidence remains available in the reconciliation receipt.
- Response-contract failures are typed. Schema, usability and concision
  failures return an invalid-answer outcome; only truth, grounding and
  read-only violations use the safety-refusal outcome.
- The Coach slice guard now recognises the shared typed failure renderer and
  remains coupled to the visible failure states.

Measured evidence:

- `test:coach-snapshot`: Snapshot 35/0, populated 17/0, Progress 13/0, Coach
  Lab 104/0 and Coach integration 64/0.
- `test:coach-tab-slice1`: 75/75; `test:mobility-flow`: 59/0;
  `test:results-persist`: 5/0.
- `test:session-execution`: every new reconciliation cell is green, with the
  same six unrelated pre-existing reds (193/6 total).
- `npx tsc --noEmit -p tsconfig.json --pretty false` exits 0.
- Three mutation runs independently killed the message-boundary cells, the
  invalid-answer/refusal classification cells, and the plan-reconciliation /
  game-feedback cells. Every mutation was restored before the green runs.
- A live version-9 request answered the next-session question from the concise
  Snapshot and returned zero program actions.

## Final scoped audit closure

Checkpoint `dd174b10` closes the two proven audit findings without widening the
work into speculative compatibility changes:

- Home now creates one plan-aware execution reconciliation per rendered day.
  Strength, Conditioning, Mobility and the reopened checklist all read that
  same receipt. A generated-world test logs the original plan, adds a lift, and
  proves the card and reopened checklist both leave the new shape incomplete.
- The benign-invalid-answer client branch, every individual refusal-class
  member, the server/composer length checks and the game callback dependency
  now have targeted guards.
- The real acted fixture route was saved twice through the production
  transaction. The second save replaced the game answer, retained the existing
  execution evidence and retained the fixture's component identities. The
  speculative plan-growth transaction change was therefore not made.

Measured evidence after restoration:

- `test:coach-snapshot` is fully green with Coach integration 64/0.
- `test:day-first-timeline` is 52/2; the two reds are the same unrelated
  mobility-source-shape and Gunshow-fixture gaps present before this order.
- `test:session-execution` is 193/6; the six pre-existing unrelated reds are
  unchanged. `test:mobility-flow` is 59/0 and `test:results-persist` is 6/0.
- TypeScript exits 0.
- Four restored mutations separately killed the invalid-answer client mapping,
  an individual refusal member, the shared day-card reconciliation and the
  game callback dependency.
- Simulator flows passed Progress, the simple Coach shell, live Terra read-only
  chat and the completed Mobility / Warm-up tick.

## Simulator acceptance

- The populated production-Terra Coach flow crossed the live backend, rendered
  the athlete question and grounded answer, exposed no change card, and kept
  the read-only introduction.
- The Privacy flow navigated from Profile and found both complete approved
  disclosure paragraphs on screen.
- Visual receipts: `artifacts/ui-walk/coach-terra-read-only.png` and
  `artifacts/ui-walk/coach-hardening-privacy.png`.
- The final version-9 pass also completed the Progress dashboard, simple Coach
  shell, live Terra read-only conversation, and Mobility completion return with
  the full day tick.

## Physical iPhone release

- A fresh signed Release build from checkpoint `3b64e152` completed with
  `BUILD SUCCEEDED` in the isolated derived-data path
  `/private/tmp/lfa-release-coach-hardening-20260824-1125`.
- The standalone `main.jsbundle` is embedded and strict code-sign verification
  passed.
- `devicectl` installed the build in place on Sam's paired iPhone 16 Pro Max,
  device id `AFA21856-881E-587B-96D5-60817FD11018`. Renee's iPhone was not
  targeted.
- The installed bundle launched successfully without Metro and remained in the
  device process list as PID 7829.
- A second fresh signed Release build from the final scoped checkpoint
  `dd174b10` completed with `BUILD SUCCEEDED` in
  `/private/tmp/lfa-release-coach-final-dd174b10`. Its embedded
  `main.jsbundle` is non-empty and strict code-sign verification passed.
- `devicectl` installed that final build on Sam's exact device id
  `AFA21856-881E-587B-96D5-60817FD11018`; Renee's phone was not targeted. The
  bundle launched successfully and remained in the device process list as PID
  8959.

## NOT COVERED

- Sam's visual acceptance of Coach, Progress, Privacy and the completed
  Mobility / Warm-up tick is still required. Installation and launch prove the
  final package reached the device; they are not presented as visual acceptance.
- The repository-wide law gate still has its pre-existing unrelated reds: one
  missing `test:game-feedback` script, LR-18 without a registry row, and 21
  existing UNENFORCED rows. This order added one guarded row and did not change
  the UNENFORCED count.
- `test:session-execution` retains six pre-existing unrelated red cells named
  in the measured evidence above; this order did not hide or rewrite them.
