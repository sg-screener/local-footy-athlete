# THE FEEL SLICE — dependency list, measured before a line is written

Next under the standing authorisation (docs/SEAT_INBOX.md item 1, Sam 2026-08-09:
*"i just want to get it all on there"*). Scope, in the order's words: **post-game
body-feel rating + "felt different" tap (+ effort-on-strength)**.

Ruled already, not re-litigated: docs/JOURNAL_DESIGN_2026-07-23.md §"Post-game
feel rating (the linchpin)"; docs/JOURNAL_DESIGN_ADDENDUM_2026-07-28.md item 8;
docs/JOURNAL_UNIT_PLAN_2026-08-09.md §4.

## 1. THE DOOR ALREADY EXISTS, AND THAT IS THE WHOLE REASON THIS SLICE IS SMALL

| Need | Where it already lives |
| --- | --- |
| A game reaches the feedback flow | "Log Game" routes through `startFinished: true` (`HomeScreen.tsx:477`, `useHomeScreen.ts:1931`, `useDayWorkout.ts:66`) |
| One transaction, one receipt | `commitSessionOutcomeTransaction` via `createRecordSessionOutcomeIntentFromFeedback` (`SessionFeedbackPanel.tsx:544`) |
| The payload gate | `buildSessionFeedbackPayload` (`sessionFeedbackForm.ts:437`) — refuses an incomplete draft and is the only builder |
| A per-session answer riding the receipt | `teamNightSize`, ruled onto `SessionFeedback` with the reasoning written into the type (`programStore.ts:1710-1714`) |
| Storage classification | `persistedInputsSchemaTests.ts:102` classifies `program-store.inputs.sessionFeedback` as ONE key — a new field needs no new declared key |

**No new door, no new transaction, no new store.** Both answers ride
`SessionFeedback` on the existing receipt-minting write, exactly as `teamNightSize`
did — and that precedent is the argument, not an analogy.

## 2. THE OWNERSHIP QUESTION THIS SLICE MUST NOT GET WRONG

The panel has to ask "is this a game?" to know whether to show the rating.
**Measured: there is no single owner of that predicate today.** Four spellings:

- `coachCommandRouter.ts:1326` — a local `isGameSession(day)` over a projection ref
- `scheduleDebug.ts:379` — `workout?.workoutType === 'Game'`
- `weekStructureValidator.ts:127` — `workoutType === 'Game' || /^game\b/` on the name
- `projectVisibleWeek.ts:137` — a `FIXTURE_WORKOUT_TYPES` set

**A fifth spelling in the feedback panel is the exact `one-predicate-grows-copies-in-other-modules`
shape this repo has already paid for.** The canonical classifier exists:
`classifyDaySessions(workout)` returns `category: 'game'`
(`sessionTaxonomy.ts:296`), and its own header says detection has ONE home.

**RULING (mine, veto open): the panel asks `classifyDaySessions`, exactly as it
already asks `isTeamTrainingSession` for the team-night question
(`SessionFeedbackPanel.tsx:313`).** The existing team-night line is the precedent
for the shape *and* for the guard that follows it: the flag that decides whether
the question is ASKED is the same flag that decides whether the answer is SENT,
so the app cannot store an answer to a question it did not put on screen
(`sessionFeedbackForm.ts:487-489`).

Retiring the other four spellings is **not** this slice — they are census debt,
converted when their unit comes up (L14's standing rule). Named, not hunted.

## 3. DO NOT OVERLOAD `feeling` — already ruled, restated because it is the trap

`FeedbackFeeling` (`very_easy`…`very_hard`) answers *how hard was it*. "Harder
than expected" answers *did it match the prescription*. **An athlete can have a
`very_hard` session that was exactly as expected.** Overloading one field with
two questions is the two-owners-of-one-fact defect the north star names, and it
would corrupt existing data rather than merely add a bug.

Same for the "why" vocabulary. `FEEDBACK_PARTIAL_REASONS` (`ran_out_of_time`,
`felt_sore_tight`, `too_hard_today`, `equipment_unavailable`, `other`) answers
*why did you do only part of it*. The addendum's list — soreness, energy, sleep,
time, pain, equipment, motivation — answers *why did it differ from expectation*.
They overlap on three words and disagree on the question. **New vocabulary.**

## 4. EFFORT-ON-STRENGTH IS THE TAP, NOT A SECOND NUMBER

The load slice measured that `SessionFeedback.difficulty` is written from exactly
one source — `difficulty: conditioningRpeValue` (`SessionFeedbackPanel.tsx:533`)
— so a strength session stores no rating at all.

The tempting fix is to capture a numeric 1–10 for strength too. **Sam's ruling
already says otherwise**: the effort tap extends to strength "riding the ruled
'felt different' tap surface — **one tap, no per-set anything**". So
effort-on-strength is satisfied by asking the SAME expectation tap on a strength
session, not by minting a second numeric field.

That also keeps `tonnageModulatedByEffort` honest: it is PROPOSED and defaults
OFF, so nothing visible depends on a strength effort number today anyway. If Sam
later signs it ON, the tap's answer is the input it reads — a qualitative one,
which is what he asked for.

## 5. WHAT THIS SLICE ADDS — two inputs, zero derived state

Both are ANSWERS the athlete gives, so the north star allows them; nothing
derived is stored.

1. **Post-game body-feel rating** — 1–5, physical ("how were your legs / energy"),
   asked ONLY on a game, sent only when asked.
2. **The expectation tap** — As expected / Harder / Easier / Stopped early, with a
   reason asked only for the last three.

North-star verdict: **TOWARD** — two inputs, no new stored derivation, no new
door.

## 6. WHAT THE JOURNAL DOES WITH THEM THIS SLICE

**Shows them honestly, derives nothing new from them.** The design calls the
post-game rating "the linchpin… powers the observation lines", but those lines
are the monthly-review slice's. Reading a brand-new field into the load model in
the same slice that mints it would be the second half of a feature nobody has
seen yet work.

So: the Journal's existing "How the week felt" section gains these answers, and
the load model does not read them at all.

## 7. NOT COVERED BY THIS PLAN

- Retiring the four rival game predicates (census debt, named above).
- Niggle history, note resurfacing, progress markers — the slice after.
- Monthly review and the ruled charts — last slice.
- `workoutLogStore`'s deletion (LR-18, ruled in the unit plan, still not started).
- No device evidence; no cell in this repo mounts the feedback panel.
