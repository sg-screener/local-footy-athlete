# STATUS — seat `payload`

Opened 2026-08-24 for Sam's approved minimum-data Coach payload checkpoint.

## Options compared

1. Build the full internal Snapshot and recursively delete today's known secret
   keys. This is short, but every future internal field is sent by default until
   somebody remembers to blacklist it.
2. Define the model-facing Snapshot as an explicit positive projection. Only
   athlete-visible program facts and concise coaching summaries cross; adding an
   internal app field changes nothing unless this boundary deliberately selects
   it.

Selected: option 2. It makes minimum data the default rather than a cleanup job.

## Baseline

- `test:coach-chat-integration`: 38 green / 0 red.
- `openAICoachLabTests`: 55 green / 0 red.
- The current builder spreads whole visible days/parts/rows, readiness signals,
  Journal week objects and active restriction records, including internal ids,
  capabilities, owners, timestamps and UI actions.
- Strength history and the recorded 2km fact are withheld even though Progress
  shows them from the same live Snapshot.

## Checkpoint

- One positive `projectCoachSnapshotForModel` boundary now selects every field
  Terra may receive. Visible days retain dates, signed titles, exercises, doses,
  cues and typed gaps; readiness, load and weekly consistency are concise
  summaries rather than internal records.
- Progress now includes current/last-week lift trends, first/latest main-lift
  history summaries with the number of recorded weeks, and the one honest 2km
  fact. It does not manufacture a 2km history.
- Restrictions retain type, effect and athlete-visible words, while note ids,
  constraint ids, lifecycle ids, timestamps and UI actions are absent.
- Conversation targets retain kind/date/label but not the internal part id.
- The server's request guard now refuses a generic `name` key as well as account,
  email and athlete identifiers. Exercise names cross under the explicit
  `exercise` key, so useful workout detail remains available.
- On the current fixture, the raw Snapshot is 3,579 UTF-8 bytes and the projected
  Snapshot is 2,540 UTF-8 bytes: 1,039 bytes removed, with the projection 71.0%
  of the raw input. This is a byte count for that fixture, not a production-token
  estimate; it includes the newly added timing and progress summaries.
- `openAICoachLabTests`: 59 green / 0 red, up from 55 / 0.
- `test:coach-chat-integration`: 39 green / 0 red, up from 38 / 0.
- The complete `test:coach-snapshot` chain is green. Changed-file TypeScript
  diagnostics are empty; the repository census remains red only outside these
  files.
- Three liveness mutations died: bypassing the projection killed six cells;
  withholding 2km from its typed progress field killed the progress cell; and
  removing `name` from the server key refusal killed the server guard. All were
  restored.

NOT COVERED: no provider call was bought, so answer quality against the changed
payload has not been re-taped. The Edge Function remains undeployed until the
remaining server hardening is complete. Physical-iPhone rebuild remains batched
to the end per Sam.
