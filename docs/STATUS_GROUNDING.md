# STATUS — seat `grounding`

Opened 2026-08-24 for the live Coach truth/grounding checkpoint.

## Options compared

1. Wire the old false-change validator into the app client, then copy the Coach
   Lab checks into the server. This closes today's two holes but creates two
   automatic-quality owners that can drift again.
2. Extract one pure response contract from Coach Lab, run it in both Coach Lab
   and the production server, and keep the app's existing false-change gate as
   the final device-side refusal. This makes a Lab pass and a production pass
   mean the same thing while retaining defence in depth.

Selected: option 2. It removes the class of Lab-only production checks instead
of adding another endpoint-specific checklist.

## Baseline

- `test:coach-chat-integration`: 30 green / 0 red.
- `test:coach-lab`: 94 green / 0 red across its three suites.
- `test:coach-tab-slice2`: 72 green / 0 red.
- The live client returns an empty-action answer without running the existing
  false-change truth gate.
- The production endpoint discards the model's basis, Snapshot-field, source
  and judgement receipts and runs none of Coach Lab's automatic checks.

## Checkpoint

- One pure `coachResponseContract` now owns the response shape and all automatic
  checks: useful, read-only, Snapshot receipts, retrieved-source receipts,
  labelled judgement, answer length and false program-change claims.
- Coach Lab delegates to that contract before applying its separate owner-review
  status. The production endpoint runs the same contract against the exact ids
  it retrieved and returns `502` before exposing a failed answer.
- The app client runs the existing communication truth gate after confirming the
  action list is empty, so a server regression still cannot put a false change
  claim on screen.
- `test:coach-chat-integration`: 38 green / 0 red, up from 30 / 0.
- `test:coach-lab`: 94 green / 0 red across its three suites.
- `test:coach-tab-slice2`: 72 green / 0 red.
- The complete `test:coach-snapshot` chain is green, including the shared live
  Snapshot, Progress ownership, Coach Lab and production chat integration.
- Changed-file TypeScript diagnostics: zero. The repository compile census still
  has unrelated existing failures outside this checkpoint.
- Three liveness mutations died for the intended reasons: bypassing the server
  refusal killed two cells; bypassing the app truth refusal killed the executed
  false-claim tape; accepting unlabelled judgement killed the shared-contract
  cell. All three mutations were restored.

NOT COVERED: the changed Edge Function is committed locally but not deployed;
deployment is batched with the remaining server hardening. No paid provider call
or physical-iPhone rebuild was made; Sam asked to rebuild at the end.
