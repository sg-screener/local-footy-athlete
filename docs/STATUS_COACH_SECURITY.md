# STATUS — seat `coachsecurity`

Opened 2026-08-24 for the remaining Coach server-release boundaries.

## Options compared

1. Keep relying on JWT verification and remote kill switches. The app's anon JWT
   is public by design, so when a switch is on it is not an access boundary for
   paid Coach Lab instructions and does not limit live-chat spend.
2. Add a separate non-public Lab secret used only by the local runner, and put a
   small bounded sliding request window before every live provider call. Keep
   the independent kill switches and JWT verification as additional layers.

Selected: option 2. It closes the current open-proxy shape without coupling Lab
to the app or introducing stored athlete data.

## Baseline

- `openAICoachLabTests`: 59 green / 0 red.
- `test:coach-chat-integration`: 39 green / 0 red.
- Coach Lab accepts caller-owned model, instructions and input with the same anon
  credential shipped in the app whenever its switch is enabled.
- Live Coach has request-size limits but no request-frequency boundary.

## Checkpoint

- Coach Lab now requires three independent conditions: its kill switch, Supabase
  JWT verification and a 32+ character `COACH_LAB_SECRET` header. Only the local
  Lab runner reads that non-`EXPO_PUBLIC` variable; it never enters the request
  body or app configuration.
- Live Coach applies a 20-request / 60-second sliding window before parsing the
  athlete payload or constructing the paid OpenAI client. Each client key is an
  ephemeral hash of Supabase's forwarded client address, with the authorization
  credential only as a fallback; no raw address or credential is stored or logged.
- The map is capped at 5,000 opaque keys and evicts expired/oldest entries, so the
  protection itself cannot grow memory without bound. A refusal returns `429`
  with a `Retry-After` receipt.
- `openAICoachLabTests`: 61 green / 0 red, up from 59 / 0.
- `test:coach-chat-integration`: 43 green / 0 red, up from 39 / 0.
- The complete `test:coach-snapshot` chain is green. Changed-file TypeScript
  diagnostics are empty; the repo-wide census remains red outside these files.
- Three liveness mutations died: bypassing the Lab secret killed its guard;
  allowing one request beyond the configured maximum killed the runtime tape;
  and bypassing the live `429` branch killed the endpoint-order guard. All were
  restored.

NOT COVERED: these Edge changes are not deployed yet. The live limiter is
deliberately coarse and per Edge isolate; it is useful immediate spend protection,
not a distributed public-scale quota. Before a broad public launch, use real
Supabase user sessions and a durable atomic limiter (for example Redis), rather
than the current app-wide anon credential. No provider call or phone rebuild has
been made in this checkpoint.
