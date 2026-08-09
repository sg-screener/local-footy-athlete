# THE FEEL SLICE — boundary report (2026-08-09)

Built under the standing authorisation (docs/SEAT_INBOX.md item 1). Dependency
list measured first: docs/JOURNAL_FEEL_SLICE_PLAN_2026-08-09.md. Rulings built:
docs/JOURNAL_DESIGN_2026-07-23.md §"Post-game feel rating"; the addendum's item
8; docs/JOURNAL_UNIT_PLAN_2026-08-09.md §4.

Commits: `41d847d7` (the slice), `528e5c67` (the cells two surviving mutations
demanded).

## ONE LINE

**The athlete can say how their legs felt after a game and whether a session
matched the plan — two new inputs on a door that already existed, with zero
derived state and no new transaction.**

## NORTH STAR: TOWARD

Two stored fields, both ANSWERS the athlete gives. Nothing derived is stored, no
new store, no new door, no new transaction. Both ride `SessionFeedback` on the
existing receipt-minting write, for the reason `teamNightSize` already gives in
its own type comment: the app records a completed session per date through a
transaction with a receipt, and a second door for a per-session answer arriving
at the same moment would be a second representation of "what the athlete said
about this session".

## EFFORT-ON-STRENGTH IS THE TAP, NOT A SECOND NUMBER

The load slice measured that `difficulty` is written from exactly one source —
the conditioning RPE field — so a strength session records no effort at all.

The tempting fix is a numeric 1–10 for strength. Sam's ruling already says
otherwise: the effort tap extends to strength "riding the ruled 'felt different'
tap surface — **one tap, no per-set anything**". So the tap is offered on every
performed session, which is the only place a strength effort can be recorded
today, and no second number was minted. The order's item is delivered, not
deferred.

## ASK-FLAG IS SEND-FLAG

The body-feel rating is asked only on a game and stored only on a game. The why
is asked only once the tap says it differed, and tapping back to "as expected"
clears it in **both** the form and the payload. A half-answered pair —
"harder than expected" with no why — is refused at the DRAFT rather than
silently dropped at the payload, because the form will not ask again and the
stored expectation would have a reason nothing could ever supply.

## NO FIFTH SPELLING OF "IS THIS A GAME"

Measured before building: that predicate has **four** spellings and no owner —
`coachCommandRouter.ts:1326`, `scheduleDebug.ts:379`,
`weekStructureValidator.ts:127`, `projectVisibleWeek.ts:137`. A fifth in the
feedback panel is the `one-predicate-grows-copies-in-other-modules` shape.

The panel asks `classifyDaySessions` — the canonical classifier, whose own header
says detection has one home — exactly as it already asks `isTeamTrainingSession`
for the team-night question. Gated by a source sweep that also forbids a bare
`workoutType === 'Game'` appearing there later. **Retiring the other four is
named as census debt, not hunted.**

## A THIRD BOOLEAN TURNED THE FLAGS INTO AN OPTIONS OBJECT

`getVisibleFeedbackSections(completion, true, false, true)` is a call nobody can
read and every caller can get wrong by transposition — and these flags decide
whether a question is ASKED, which decides whether its answer may be stored at
all. The positional form is gone rather than kept beside it. Two call sites
updated; no compatibility overload left behind.

## THE COPY GATES COULD NOT SEE A WORD OF THIS — THIRD SIGHTING, WITH A SIZE

Recording batch 18 turned the binder red for strings **plainly in the app**. The
extraction gate's ceiling did not move at all: it stayed at 566, and would not
have moved if every one of this slice's words had shipped unlisted.

Both gates scope to `screens/`, `components/` and `navigation/`. Every string
this slice adds is authored in `utils/sessionFeedbackForm.ts`, which surfaces
render and no gate reads.

**This is the third time that symptom has named a scope hole rather than a copy
defect** (sighting 1: "Today"/"Week" parked in a bullet list no gate reads;
sighting 2: the hand-maintained scope list that hid a whole screen). The
loop-audit law says the third sighting gets a compression, not a fourth silent
run.

**Done now, using the existing hatch as its own comment intends:**
`utils/sessionFeedbackForm.ts` joins `AUTHORING_MODULES` — *"a screen is not
where copy is AUTHORED; it is where copy is RENDERED"*. Bound strings **84 → 99**.

**Proposed, and SIZED rather than asserted:** the same hole is open at ~20 other
addresses. Measured: **~150 `label:` prose strings across 20+ modules in `utils/`
and `rules/`** are invisible to both gates — including the feedback form's
pre-existing vocabulary ("Busy / no time", "How was training?", every feeling and
soreness option), **none of which has ever appeared on the copy sheet**. That is
a unit of its own and is deliberately NOT folded into this slice; folding it in
would raise the extraction ceiling by a large attributed number in a commit about
something else.

## A RED SUITE FOUND, REPORTED, NOT ABSORBED

`test:session-feedback-form` is **not in `test:bible`**, and measuring it at HEAD
(via a scratchpad copy, not `git stash`) showed **4 pre-existing failures**. All
four assert that a power block is a separately-completable component; probed
directly, `getSessionComponents` returns only `strength` for that workout, so the
power component is no longer emitted at all.

That is almost certainly the power-row redesign's ruling working as intended and
the suite's expectations going stale — but "almost certainly" is not a verdict,
and deciding whether power should be separately completable is a coaching
ownership question, not this slice's. **So it is not gated and not "fixed" by
editing the expectations to match.** My change is failure-neutral on it: 4 before,
4 after.

## EIGHT MUTATIONS, EIGHT REDS — TWO SURVIVED THEIR FIRST RUN, AND THEY WERE THE SAME GAP

Six red immediately. **Two survived, and both were the suite's own headline claim
failing at the seam it is about.** Section [5] proves the payload builder stores
only what it is handed — but every one of its cells hands the builder `null`
itself. Nothing checked that the PANEL decides to hand it null, so deleting both
guards left the suite green while a non-game stored a body-feel rating and a
stale why rode along after a tap-back.

**A builder tested with hand-written nulls proves the builder and says nothing
about the caller that computes them.** New cells anchor to the panel's payload
call and assert both guards; re-run against both mutations: RED.

The other six: `expectationAsksWhy` treating "as expected" as differing; the
half-answered pair no longer refused; the game question asked on every session;
the panel growing a fifth game predicate; the Journal re-spelling the predicate
instead of asking it; and "nothing recorded" forgetting the two new facts.

## WHAT WOULD CATCH THE NEXT DEFECT OF THIS CLASS (L12)

The class is **an answer outliving its question**. The cells are built per
MECHANISM, not per field: the ask-flag/send-flag pair is asserted at the form,
at the builder AND at the panel; `expectationAsksWhy` is asserted as the single
predicate with a source sweep requiring all three readers to call it rather than
re-spell it. So the next field added to this form is covered by the same cells if
it follows the same shape — and reds them if it does not.

## THE GATE

- **Full `test:bible`, UNPIPED: `GATE_EXIT=1` at `test:program-control-durable`,
  1 FAIL line** — main's declared red, same assertion text.
- **Sweep: `failures=2 of 161` = the declared set EXACTLY** —
  `test:program-control-durable`, `test:fixture-identity`, at head `528e5c67`.
- `test:compile` PASSED — no file regressed against the baseline.
- New suite `test:journal-feel` registered in `test:bible`: **54 passed, 0
  failed.**

## NOT COVERED

- **NO DEVICE EVIDENCE.** No cell mounts the feedback panel. Chip wrapping, how
  seven reason chips lay out on a phone, and whether the tap reads as one more
  chore are unverified by eye.
- **DEPTH (L13): 0.** Unit sweep over the form owner, the payload builder and the
  pure Journal derivation. No walked athlete.
- **The rating feeds nothing yet.** The design calls it the linchpin that "powers
  the observation lines"; those lines are the monthly-review slice's, and reading
  a brand-new field into a model in the same slice that mints it would ship the
  second half of a feature nobody has seen work. The Journal COUNTS the answers
  and interprets none of them.
- The four rival game predicates remain. `workoutLogStore`'s deletion (LR-18)
  remains. Resurfacing remains.
- All journal copy is PROPOSED — batches 15, 16, 17 and 18 await Sam.

## SAM'S QUESTIONS (parked, not waited on)

1. **The five body-feel words are entirely mine** — Empty / Heavy / Okay / Good /
   Flying. They are the row of this batch that most wants your eye, because they
   are changing-room register and I am guessing at yours.
2. **Should the tap be required rather than optional?** Built optional: it is a
   new question on a flow athletes already use, and requiring it changes what an
   existing save costs them. One word from you flips it.
3. **Should a power block be separately completable?** Not mine to rule — see the
   red-suite section above.
