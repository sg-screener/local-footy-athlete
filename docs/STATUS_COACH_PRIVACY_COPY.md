# STATUS — seat `coachprivacy`

Opened 2026-08-24 for audit finding MED-11 and Sam's ruling: Coach may receive
concise, whitelisted progress summaries but remains completely read-only.

## Options compared

1. Add another explanation to the Coach screen. This would put the disclosure
near the send action, but conflicts with Sam's accepted simple Coach layout.
2. Correct the existing reachable Profile → Privacy screen and leave Coach's
   conversation layout alone.

Selected: option 2.

## Checkpoint

- The Privacy page now names concise whitelisted Coach summaries and the
  completely read-only boundary.
- It states that name, body measurements, internal IDs, buttons and the full
  saved profile are not in the Coach AI payload.
- It states that the app does not save Coach conversations and requests AI
  responses with provider storage off.
- The retired claim that persisted `coach state` exists is removed.
- `test:profile-reset-ui`: 171 green / 0 red.
- `test:signed-copy-extraction`: 7 green / 0 red; 567 distinct-per-file strings
  across 50 files, below the guarded 580 ceiling.
- `test:copy-rulings-binding`: 9 green / 0 red.
- Liveness: weakening `completely read-only` killed the named privacy boundary
  cell. The mutation was restored.

NOT COVERED: this is factual disclosure using Sam's approved boundary, not a
lawyer-reviewed production privacy policy. It was not mounted in the simulator
or accepted on a physical phone.
