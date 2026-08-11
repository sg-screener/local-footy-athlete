# Game feedback ownership reassessment — 2026-08-11

## Why implementation stopped

The current Game Day surface already asks for `gameFeel`, builds it into a
`SessionFeedback` value, and passes that value to the accepted session-outcome
transaction. The transaction adapter does not copy `gameFeel` into
`RecordSessionOutcomeIntent`; the normalizer cannot validate a field it never
receives; `feedbackFromIntent` then rebuilds a persisted `SessionFeedback`
without it.

The surface therefore understands the athlete and the later layer silently
downgrades the answer. This is the Coach Architecture Escalation Rule's second
stop condition. No feature patch is permitted until ownership is reassessed and
approved.

## 1. Current source of truth

The durable source of truth is `programStore.sessionFeedback[date]`, written by
`commitSessionOutcomeTransaction` and persisted in the program envelope.

For game-specific data, the intended source is the same record. There must not
be a second game-results store or a practice-match-only store.

## 2. Current representations

The athlete's post-game answer currently crosses five representations:

1. Local React state in `SessionFeedbackPanel`.
2. A `SessionFeedback` draft built by `buildSessionFeedbackPayload`.
3. A `RecordSessionOutcomeIntent` built by
   `createRecordSessionOutcomeIntentFromFeedback`.
4. A normalized `RecordSessionOutcomeIntent` inside the transaction.
5. A new persisted `SessionFeedback` rebuilt by `feedbackFromIntent`.

The answer is lost between 2 and 3. The same boundary would also drop any new
whole-game, time-on-ground, or game-RPE fields added only to the form.

## 3. Reinterpretation points

- The UI decides whether the visible workout is a game.
- The payload builder decides which form answers are allowed to travel.
- The tap adapter manually copies a subset of `SessionFeedback` into the intent.
- The transaction normalizer manually copies another subset.
- `feedbackFromIntent` manually rebuilds the stored fact.
- The Journal separately reads the legacy `gameFeel` field.
- The strength and conditioning progression readers currently ignore game feel.

Each manual subset is a place where a valid answer can be silently omitted.

## 4. Proposed owner

`types/sessionOutcome.ts` should own one typed `GameSessionOutcome`:

```ts
interface GameSessionOutcome {
  playedWholeGame: boolean;
  timeOnGroundMinutes: number;
  bodyRpe: number;
  feel: FeedbackGameFeel;
}
```

It should also own the parser/validator:

- `playedWholeGame` is a real boolean;
- time on ground is a positive whole number expressed by hours + minutes on the
  surface;
- body effort is an integer from 1 to 5;
- feel is one of the existing five discrete values.

Both `SessionFeedback` and `RecordSessionOutcomeIntent` carry this same type as
`game`. The transaction is the only writer and refuses a partial or invalid
game payload.

## 5. Simpler architecture

### Option A — incremental field copying

Add four top-level fields to `SessionFeedback`, then remember to copy all four
through the adapter, normalizer, persistence reconstruction, Journal, Coach and
progression readers.

This is the smallest diff, but it preserves the exact omission class already
found: every new outcome field depends on several hand-maintained subsets
remaining equal.

### Option B — one typed game payload through the existing transaction

Add one `GameSessionOutcome` value and carry it unchanged through the accepted
transaction. Give the transaction one validation function and one round-trip
cell. Render one dedicated game-feedback form whenever the existing session
taxonomy classifies the day as a game. Scheduled games and pre-season practice
matches already share that classification and route, so no fixture-kind branch
is added.

**Recommendation: Option B.** It removes four independently copied fields and
makes omission of any part of the game result a type/transaction failure.

## 6. Legacy paths to retire or bypass

- The generic session-feedback questions should not render for a game. A game
  gets the dedicated four-question form.
- New writes should stop writing the standalone `gameFeel` field. A read lift
  keeps old Journal data visible as `feedback.game?.feel ?? feedback.gameFeel`.
- The classic and V2 screens should keep routing through the same
  `commitSessionOutcomeTransaction`; neither receives its own save handler.
- Practice matches must not gain a separate action or store. Their existing
  `workoutType: 'Game'` identity is enough.
- Game feedback is recorded for history and future review only. Saving it must
  not create a modifier or change the program.

## 7. Verification boundary

The replacement needs cells that prove:

1. Scheduled games and practice matches open the same game-feedback component.
2. Whole/part game, hours + minutes, 1–5 body effort and five-word feel are all
   required and validate at the domain boundary.
3. The complete typed game payload survives UI draft → intent → normalization →
   persisted feedback byte-for-byte.
4. Removing any one copy at any transaction seam makes the gate red.
5. A non-game outcome cannot store a game payload.
6. Legacy standalone `gameFeel` remains readable but is never newly written.
7. No game result creates a modifier or changes the program.
8. The suite is in `test:bible`, and its governing law has a guarded registry
    row before the feature lands.

## Recording decision

Sam ruled on 2026-08-11 that this form records feedback only and does not make an
automatic program adjustment. The five-point wording is:

- `Flying` = 5;
- `Good` = 4;
- `Normal` = 3;
- `Bad` = 2;
- `Heavy` = 1.

The complete game payload is saved under the same dated `SessionFeedback`
record and through the same accepted session-outcome transaction as the regular
S&C form. It is a typed `game` section on that record, not a second store and not
a second write door.

## LOOP CHECK

`later-layer-drops-valid-intent` — current sighting: the existing game-feel
answer is collected by the form and omitted by the accepted transaction. The
compression is one typed game payload carried unchanged, not another field-by-
field compatibility branch.

## NOT COVERED

- No physical-device interaction has been run.
- No simulator/glass run has mounted the finished form, raised the numeric
  keyboard or proved the five effort chips fit the supported phone widths.
- No program adaptation is covered because Sam explicitly removed it from this
  feature on 2026-08-11.
- Historical records that contain only `gameFeel` cannot reconstruct time on
  ground, whole-game participation, or RPE; those remain honestly absent.
