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

Measured evidence: `test:coach-chat-integration` 52/0 and `test:coach-lab`
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

- `coach-chat` is ACTIVE as version 7 with JWT verification on.
- A live `whats on thurs?` smoke crossed the deployed database limiter, called
  Terra, returned `Thursday (27 Aug) is Upper Push plus Conditioning.`, and
  carried zero program actions.
- The linked database then reported `private.coach_rate_limits` with two
  distinct rows: the one opaque client window and the separate global window.
  The instrument's unit is database rows after one live Edge request, not
  athletes or paid calls.
- A truth-contract refusal now logs only its violation names before returning
  the typed refusal; it never logs the athlete question or model answer.

## Pending in this same order

- Apply Sam-approved distinct outage/refusal copy and the accurate Privacy line.
- Run the full focused chain and simulator before asking Sam to connect his
  phone.

## NOT COVERED

- Athlete-facing copy is waiting on Sam's exact wording approval.
- No simulator or physical phone build has been made in this order.
