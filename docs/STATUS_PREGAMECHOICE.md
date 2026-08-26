# Status — pregamechoice

## 2026-08-26 — G-1 session choice and week-management pass

### What landed

- The G-1 warning uses the ruled title, subtitle and boxed choices, with Gunshow
  excluded for female athletes.
- Choosing **Same session but easier** commits from the warning already shown.
  It does not preview again, raise a second warning or end in the generic
  game-tomorrow refusal.
- The easier route keeps the selected exercise list and lowers its dose. The
  accepted workout carries one typed G-1 adjustment so the shared stress reader
  recognises it as low stress without renaming the workout or weakening another
  hard session stacked on the day.
- A one-row conditioning session and every addable work category are pinned as
  regressions: light/hard conditioning and upper/lower/full-body strength.
- The surrounding week-management changes from this pass are retained: Move is
  Week-only; games and training share one board; game add/move replaces the
  target day's training; the popup has no mini-section headings or separators;
  remove copy reflects whether one or multiple sessions are present.

### Measured verification

- Simulator: `.maestro/visible/g1-session-before-game.yaml` passed the real
  Friday-before-Saturday-game Add flow on iPhone 17 Pro simulator. It observed
  exactly one warning, no later refusal, and a Conditioning session on Friday
  after choosing Same session but easier.
- `test:placement-ownership`: 22/22.
- `test:deload-law`: 64/64.
- `test:week-board`: 75/75.
- `test:g1-landing-ask-flow`: 25 passing / 6 inherited stale historical cells.
  The new one-row and five-category easier-route cells pass.
- `test:copy-rulings-binding`: 8 passing / 1 inherited Batch 6 proposal failure.
- TypeScript compilation retains the repo's existing errors in temporary fact,
  fixture transaction, profile transaction, old Home screen and other unrelated
  files. No error is reported in the G-1 materialiser, deload policy, stress
  classifier, PlanChangeSheet or `useHomeScreen` change in this pass.

### Mutation/liveness

- Disabling preserve-selection kills the general, Add, one-row and category
  matrix cells (25/6 becomes 21/10).
- Sending the choice back through preview kills the one-warning UI cell
  (25/6 becomes 24/7).
- Removing the low-stress reader kills the stress cell (25/6 becomes 24/7).
- Dropping the marker during a valid low-stress stack kills the accepted-Add and
  category-matrix cells (25/6 becomes 23/8).

### NOT COVERED

- Physical iPhone Release acceptance.
- VoiceOver reading/order of the warning choices.
- A persisted G-1 choice written by an older app build and reopened after this
  schema addition.
- Every game drag-and-drop combination on simulator; the domain board matrix
  covers empty, training and team-training targets, but this glass pass drove
  the G-1 Add route only.
