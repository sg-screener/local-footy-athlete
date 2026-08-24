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

- `coach-chat` is ACTIVE as version 8 with JWT verification on.
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

## Simulator acceptance

- The populated production-Terra Coach flow crossed the live backend, rendered
  the athlete question and grounded answer, exposed no change card, and kept
  the read-only introduction.
- The Privacy flow navigated from Profile and found both complete approved
  disclosure paragraphs on screen.
- Visual receipts: `artifacts/ui-walk/coach-terra-read-only.png` and
  `artifacts/ui-walk/coach-hardening-privacy.png`.

## NOT COVERED

- The physical iPhone rebuild and Sam's device acceptance have not been run;
  that is the next and only remaining step in this order.
- The repository-wide law gate still has its pre-existing unrelated reds: one
  missing `test:game-feedback` script, LR-18 without a registry row, and 21
  existing UNENFORCED rows. This order added one guarded row and did not change
  the UNENFORCED count.
- The broad compile baseline is stale across unrelated shared-checkout files.
  Raw TypeScript output contains no error in a file changed by this order; the
  baseline was not widened.
