# COACH REBUILD SLICE 3 — BOUNDARY

Branch `main`. Order: docs/SEAT_INBOX.md item 1, 2026-08-09 night — *"SAM RULED
(a): CHANGES FIRST — SLICE 3 OPENS."* Kickoff:
docs/COACH_REBUILD_KICKOFF_2026-08-09.md. Slice 2:
docs/COACH_SLICE2_BOUNDARY_2026-08-10.md.

---

## ONE LINE

The coach proposes a change as a `ProgramControlAction`, the card the athlete
says yes to is **rendered from that action and from nothing else**, the
athlete's own tap door executes it, the ledger records it inside the door, undo
covers it because it already covered the door — and the confirmation sentence is
one the truth gate can refuse, which it could not have been yesterday because
**the gate had no vocabulary for a move at all**.

## SCOPE — ONE KIND, FULL CHAIN, STOPPED BEFORE S4

`move_session` end to end. Not built, deliberately: every other action kind, the
other two chips, follow-up conversation context, and S4's journal layer.

LOOP CHECK `kind-by-kind-behind-one-card` — sighting 1 — **iterate**, and the
first kind already produced the evidence the check exists to collect: the card
did NOT need a variant, because `changeCardFor` renders labelled fields from the
action rather than a sentence about a move. A second kind that needs its own
card variant is the compression trigger; nothing here presumes it will not.

## THE ONE ARCHITECTURAL DECISION, AND IT WAS THE SEAT'S OWN WARNING

The order carried the S2 resolver class forward: *"two-marker messages beat a
table-ordered resolver … build the matrix before the resolver, not after its
first survivor."*

The obvious S3 shape is a `CoachRequestReader` beside slice 2's
`CoachQuestionReader`, tried in some order. **That order is a table**, and the
message that exposes it is the first one anybody would type: *"can you move
Friday's session to Sunday?"* carries an interrogative marker AND a move verb.
Question-reader-first answers a question nobody asked.

So there is **ONE reading seam** (`rules/coachRead.ts`). A message is read once
and comes out as a question (slice 2's reader, unchanged, still owning every
answer it owned) or as a typed change request. The families cannot be tried in
an order because there is no order to try.

**AND THE PRECEDENCE FAVOURS THE CHANGE, WHICH IS SAFE ONLY BECAUSE OF L-C2.** A
change request produces a CARD, never a mutation. Mis-reading a question as a
request costs the athlete a card they decline; mis-reading a request as a
question costs them the feature. The change card is doing structural work here,
not decorative work — it is what makes the aggressive reading the correct one.

The matrix is section [1] of the gate and it was written first: nine rows, five
of them matching three marker families at once, both readings represented so a
constant resolver cannot pass it.

## THE CHAIN, AND EVERY LINK OWNS ONE THING

```
message → readCoachMessage()   → question | change request
        → coachProposal()      → ProgramControlAction + card | ask | refusal
        → the athlete's YES
        → executeProgramControlActionDurably()    (the athlete's own door)
        → coachChangeOutcome() → what the coach may claim, against the visible
                                 week before and after, through the truth gate
```

No coach command, no coach event, no coach writer, no adapter. The only value
that leaves the thinking layer is the door's own type.

## THE REFUSAL RUNG CAME FREE, EXACTLY AS THE ORDER HOPED

The order made it conditional: *"the cheap refusal rung … rides S3 only if it
costs a day nothing."*

It cost nothing, and the reason is the check ORDER rather than a feature. The
proposal asks the source day's `capabilities.canMoveWholeDay` **before** it asks
for a destination — it has to, because L-C1 forbids proposing what the door
would refuse without showing the refusal honestly. So *"why can't I move
Saturday?"* names one day, gets its capability checked, and is answered with the
refusal instead of being asked where to. **Where the projection carries a
recorded refusal (`DayCapabilities.refusal`, already a signed sentence) the coach
speaks it VERBATIM**; its own floor (*"I can't move Saturday."*) is used only
where the projection has none, and it says what the coach cannot do rather than
why — the why for a fixture is coaching policy and L-C1 forbids inventing it.

## THE TRUTH GATE HAD NO VOCABULARY FOR A MOVE, AND THAT IS THIS PASS'S KEYSTONE

Slice 2's boundary: *"it is also the piece that does not move at S3: only the
input changes."* The wiring claim held exactly. The **content** claim did not.

`FORBIDDEN_WHEN_NO_APPLIED` is fourteen patterns and every one of them came out
of the substitution incident — *"subbed in"*, *"I adjusted"*, *"lighter loads"*.
**Not one of them could catch a coach claiming it had MOVED a session it had not
moved**, which is the first thing the rebuilt coach learns to say. A
confirmation reading *"Moved Friday to Sunday."* would have passed the gate over
an empty communication, and slice 2's keystone would have been decorative for the
one sentence slice 3 adds.

Three patterns were added (`I moved`, `I've/I have moved`, `moved your`) and the
confirmation is worded in the first person so the gate can read it. **Measured,
not assumed**: `test:coach-truth-gate` 61/61 green, and `test:coach-command-router`
— the frozen suite whose replies say *"Done — I moved Wednesday's session to
Friday"* — reproduces its pre-existing failure **byte-identically** against a
restored baseline copy of the module, so the one red there is not mine.

A forbidden phrase is INPUT DATA to that gate, not wiring: extending the list
makes it strictly stricter, so it can red an unverified claim and can never
permit one it used to refuse.

**AND THE GATE IS PROVEN TO BITE ON THE REAL CASE, NOT ON THE VALIDATOR.** The
door is handed `{ ok: true, outcome: 'applied' }` over a week that did not move;
`appliedChanges` comes back empty, `canSayProgramUpdated` is false, and the reply
is the honest *"That left your week the same."* The control beside it is the same
call over a week that DID move, which must claim it — a gate that refuses
everything is not a gate.

## WHAT THE COACH IS ALLOWED TO CLAIM IS THE PROJECTION'S ANSWER, NOT THE DOOR'S

`executeProgramControlActionDurably` returns `ok`, `changedProgram` and a typed
`outcome`, and every one of those is the door's account of ITSELF. The incident
that produced the truth gate was a layer believing exactly such an account. So
the door's result selects which SITUATION the athlete is in — refused, no-op,
applied — and `appliedChangesFromVisibleWeeks` decides whether the coach may
claim it, by comparing the day the athlete READ before against the day they read
now, through `describeVisibleDay`.

That comparison forced the one piece of screen mechanics in this slice: the
coach speaks from a `useEffect` after the week comes back, never from inside the
confirm handler, because a claim made there would be measured against the week
captured before the door ran.

## ONE ACCOUNT OF A DAY, STILL

`describeVisibleDay` was extracted from `coachAnswer` and is now used by the
answer, the card's From line, the card's To line and the applied-changes diff.
Four consumers, one function. Composing the card's day description separately
would have been ruling 1's `summariseDay` defect returning inside the same
screen, one slice after *"what's on this week"* declined it.

## ITEM 0 — THE L-C3 GATE FAILURE SAM'S DEVICE FOUND, FIXED AT THE OWNER

The seat's item 0 arrived mid-slice with Sam's screenshots and his words: *"the
chat history is stuck - it gets hidden behind the keypad and it doesn't scroll
down - so when I'm typing a new question after a few questions I can't see the
answers."*

**THE CAUSE WAS A HOLE IN THE SHARED KEYBOARD OWNER, NOT IN THE COACH SCREEN.**
`KeyboardStickyView` lifts the footer and **nothing ever moved the body**: it is
`flex: 1` inside a root that does not shrink, so its frame runs to the true
screen bottom and its last content sits behind the keypad. A
`KeyboardAwareScrollView` body hid that for every other screen, because it
scrolls the FOCUSED INPUT clear — **and a screen whose input lives in the FOOTER
has no focused input inside the body at all, so nothing was ever adjusted.** The
bare `View` branch owned nothing. The coach tab is simply the first screen shaped
that way.

So the fix is in `KeyboardSafeArea`: the non-scrollable body reserves the
keyboard's height, read from the **same shared value `KeyboardStickyView` itself
rides** — one native keyboard frame, read twice, because the slice-1 boundary
named the alternative by name (two animations on two clocks). The scrollable
branch is deliberately left alone and a cell says so: adding a second adjustment
to content `KeyboardAwareScrollView` is already moving is the stacked-primitives
defect that file was rewritten to end.

The pin-to-bottom half is the coach screen's, because it is a property of a
conversation rather than of keyboards: the list follows new content **only when
the athlete is already at the bottom** (yanking a reader back to the newest turn
is the same disrespect pointing the other way), with a non-zero tolerance because
an exact equality is never true on a device, and the keypad opening re-pins on
`keyboardDidShow` — not `willShow`, because the body's inset rides the native
frame and scrolling to a bottom that is about to move is scrolling to the wrong
place.

**All four of the order's required end-states are cells** ([6], numbered as the
order numbers them). `test:keyboard-convention` **43/43 green** — the owner's own
gate, including its *"does not stack two avoidance primitives"* law.

LOOP CHECK `keyboard-cases-deferred-then-bitten` sighting 1 — **iterate**, and
the honest reading is that L-C3 predicted this in writing at slice 1 and two
slices shipped without keyboard cells anyway. The compression the seat named (a
keyboard matrix harness as a standing pre-device gate) is **not built**; what
exists is four cells on one screen.

## AND THE FREE DEVICE EVIDENCE CONTAINED A DEFECT NOBODY WAS LOOKING FOR

The order banked Sam's answers as evidence the coach was right. Probing the third
one by hand found the opposite:

**`"why is friday heavy?"` WAS NOT REFUSED. It answered `"Friday: Lower Squat."`**

The slice-2 boundary says it is refused. NOW.md told Sam it is refused. **Both
were wrong, and no cell held the claim — it lived in prose only.** The message
carries a day marker, the day beat the week by slice 2's own specificity rule,
and the coach answered with the session list. **The athlete asks WHY and is told
WHAT, with nothing to signal the question was missed** — which is worse than a
refusal, and is exactly the failure L-C1 exists to prevent.

Fixed as a SUBJECT rather than a filter, because the reader recognises
positively: `reason` is a real, well-formed question about something the visible
week cannot answer, so it is placed and then answered honestly. A reason marker
outranks every entry in the subject table — a reason question that also names a
day is still a reason question, which is the two-marker shape a third time — and
it does **not** swallow *"why can't I move Saturday?"*, which reaches the change
path on its move verb and is answered by attempting the move. Both are matrix
rows now. **The Bible-grounded "why" layer lands on this arm: it is a seam
instead of a hole.**

Sam's own typo'd sentence (*"Why do we do strength before team traininh"*) now
places as a reason question too. **The reply is the same honest sentence either
way** — what changed is that it reaches the arm the Bible layer will fill instead
of falling off the end of the reader.

## FINDINGS

**A REAL DEFECT IN SLICE 2's SHIPPED CODE, AND IT IS THE SAME CLASS A THIRD
TIME.** `namedDate` walked `WEEKDAY_INDEX` and returned the first weekday whose
word appeared anywhere — so the day the coach picked was decided by the order of
`WEEKDAY_NAMES` (Sunday first), not by the order of the sentence. *"Am I
training friday or monday?"* answered about Monday. **An ordered table answering
a question about specificity, for the third time in this reader**, and slice 3 is
what forced it out because a move needs TWO days and their order is the whole
difference between "from" and "to". Fixed at the resolver — day resolution is now
by position in the message — with a control cell that reverses the two days and
requires the answer to reverse.

**A DEDUP THAT LOOKED LIKE TIDYING WAS A BEHAVIOUR CHANGE.** The first version of
the ordered day resolver deduped markers that resolved to the same date.
*"Move today to monday"* on a Monday names one day twice, and that is a request
with a source AND a destination — the coach has to see both to say *"it's
already on that day."* Deduping left it holding one day and asking where to.
Two markers are two slots; whether they point at the same day is the proposal's
question.

**THE ANCHOR MOVED OFF THE FUNCTION BODY, AT THE SECOND SIGHTING.** Slice 2 added
`visibleWeek` to a dependency array and slice 1's turn-producer anchor became
unfindable; slice 1's fix re-anchored on the producer's closing brace; slice 3
split `handleSend` into a delegating one-liner plus a branching `send`, and the
brace anchor missed too. **An anchor on a function BODY is coupled to the body,
and the body is the thing every slice edits.** The claim is now expressed where
it is stable: there is ONE appender of coach turns, it takes its text as an
ARGUMENT, and every call to it is enumerated and must be a rule call. Adding a
branch cannot break it and adding a SENTENCE cannot pass it.

**TWO SCREEN BRANCHES WERE CHOOSING THEIR OWN WORDS, AND THE CELL ABOVE IS WHAT
FOUND THEM.** The decline path read a copy constant, and the null-card path read
another. Both are gone: `coachProposal` now returns the action and its card
together — so *"a proposed action without a card"* is unrepresentable rather than
handled — and declining is `coachChangeDeclined()` in `rules/`. **Every sentence
the coach says now comes out of `rules/`, with no exception to state.**

**THE ANCHORING LAW FIRED INSIDE THE NEW GATE ON ITS FIRST RUN, AS DESIGNED.**
`function ChangeCard\(\{[\s\S]*?\n\}` stopped at the destructured parameter
list's own `}: {` at column 0 and returned 56 characters. The prove-the-region
cell reddened first and four claims reddened behind it. Re-anchored on a line
that is exactly `}`.

**AND `a count taken for a record` IN ITS SUBSTRING FORM, ALSO IN THE NEW GATE.**
A cell asserting the card rule reads no `message`, `request`, `turn` or `draft`
reddened a correct module, because **`return` contains `turn`**. Word boundaries,
and the vocabulary changed to identifiers the module could actually hold.

**TWO MUTATIONS SURVIVED, AND BOTH WERE MY CELLS PASSING FOR THE WRONG REASON.**
Neither was recorded as a survivor and neither was written off; both were
re-probed after the cell was re-aimed, and both then reddened.

- **M3 — deleting the sort that puts named days in MESSAGE order left 97/97
  green.** Every two-day message in the suite carries *"to"*, and the
  preposition rule picks the destination by POSITION, so it returned the same
  answer from an unsorted list. **A cell set in which one rule always decides
  cannot observe a second rule** — the slice-2 class a fourth time, this time
  inside the gate written to honour it. Two inputs where the sort is the only
  thing deciding now exist: a two-day move with no preposition, and *"am I
  training friday or monday?"*, which is the question path where the defect
  actually shipped.
- **M8 — deleting the card's kind guard left 97/97 green**, because the probe
  was a `bin_session` action whose payload has no `fromDate`. The card came back
  null because a FIELD was missing, not because the KIND was refused, and the
  cell read as proof of a guard that was no longer there. Re-probed with
  `move_team_night`, whose payload fits the card exactly — the only probe that
  can tell the guard from the accident.

## THE LEDGER RECORDS THE CHANGE AND NOT THE COACH — MEASURED, NAMED, NOT PATCHED

A landed move appends `{ kind: 'plan_change', change }` inside `applyPlanChange`
with `provenance: 'athlete_tap'` and `writer: 'program_control'`
(`planChangeProducer.ts:2392-2401`). The append carries the **PlanChange**, which
has no author field — so `source.screen: 'coach_tab'`, which this slice added to
`ProgramControlScreen` precisely so authorship could be written down, **does not
reach the ledger for this kind.**

The reading that makes it correct is L-C2's own: no coach mutation without the
athlete's yes, therefore every coach change IS an athlete tap, and
`provenance: 'athlete_tap'` is true. It is true and incomplete, and the question
of whether the ledger should distinguish *drafted by the coach* from *chosen by
the athlete* is a design question for the seat — **it is also the other half of
the parked item that says an athlete tap on their own session screen is
attributed to the coach.** Not patched: threading a source through the athlete's
own door for a coach concern is the special case CLAUDE.md names.

## GATE

- Full unpiped chain `GATE_EXIT=1`: exits at `test:program-control-durable` with
  **1 FAIL cell** — *"a move committed durably reaches the visible week"*,
  **main's declared red**, 92 suites reached. **Run twice**, once at the slice
  and once after the two cells the mutation run re-aimed; identical both times.
- `test:compile` **PASSED**, totals **35 / 51 / 373 — byte-identical to
  baseline.**
- **Sweep 2 of 174 = the declared set exactly** (`program-control-durable`,
  `fixture-identity`). **The denominator moved 173 → 174 in the commit that
  earned it** (`test:coach-tab-slice3`, which sits past the chain's exit — the
  sweep is what proves it).
- New gate `test:coach-tab-slice3`, **116 cells, 19 mutations 19 red** (12 red on
  the first run of the first 14; the two survivors are recorded above and
  reddened after their cells were re-aimed; five more cover item 0's fix and the
  reason subject). Added to the chain after `test:coach-tab-slice2`.
- `test:keyboard-convention` **43/43** — the shared owner's own gate, run because
  item 0's fix is in that owner and not in the coach screen.
- `test:coach-tab-slice1` **80 cells** (73 → 80), 4 cells re-aimed, none deleted:
  the `programControlActions` ban became a ONE-DOOR assertion (the imported
  writer SYMBOLS are compared to a declared set, so a second door reds it and a
  rename reds it), and three producer cells were re-anchored off the function
  body.
- `test:coach-tab-slice2` **76 cells, unchanged and green** — the day-resolution
  fix moved no answer it asserts.
- `test:coach-truth-gate` **61/61**, and `test:coach-command-router`'s single red
  reproduced byte-identically at a restored baseline.
- Copy extraction ceiling **UNCHANGED** — batch 31 lives in `rules/`, which the
  extractor does not walk.

## NOT COVERED

**FIRST LINE: NO DEVICE EVIDENCE, DEPTH 0, AND THE DOOR HAS NEVER RUN.** No
screen is mounted, no store is touched, `executeProgramControlActionDurably` is
not called by any cell in this suite. **The claim that a coach-proposed
`move_session` lands, records a decision and survives a relaunch is a
type-level and source-level reading, not a measurement** — and it is the
likeliest place this slice is wrong, exactly as the overnight pass said of its
own union reading. The instrument that would close it is a tape in the shape of
`tape:lr29-undo-durability`: propose, confirm, photograph the week, relaunch,
photograph again. **It is the first thing the next pass owes.**

**L-C3 IS FIXED IN SHAPE AND NOT PROVEN ON GLASS, AND THE SEAT'S ORDER SAID IT
BLOCKS THIS BOUNDARY.** Item 0's four end-states are cells and the reported cause
is repaired at the owner — **but every one of those cells reads SOURCE.** No
keyboard has been raised in this repo, no scroll measured, no tap made.
`Math.abs(reanimated.height.value)` as a `paddingBottom` is a Reanimated LAYOUT
animation on the UI thread, and whether it lands smoothly beside the footer's
transform is a device question this pass cannot answer. **Sam's phone is the only
instrument that closes item 0**, and until it does, the fix is a claim.
The composer-overshoot symptom named at slice 1 is unchanged and unwatched, and
the card now adds height to the strip that rides the keypad — **if anything
overshoots, this is the slice that will show it.**

**NO FOLLOW-UP CONTEXT, AND THE ASKS ARE SHAPED AROUND ITS ABSENCE.** A reply of
*"friday"* to a bare *"which day?"* carries no move verb and would be read as a
question about Friday's work. **An ask whose answer the asker cannot understand
is a dead end**, so both asks teach the whole shape (*"Say the whole thing — like
'move Friday to Sunday'"*) and a cell reds if the example is removed. That is
survivable, not good: AGENTS.md asks for follow-ups resolved from structured
recent context, and this slice does not do it. It is the largest thing left
undone inside S3's own scope, and it deserves its own matrix rather than a merge
rule bolted onto this one.

**ONE KIND OF TWENTY-SIX.** `swap`, `add`, `remove`, everything readiness and
everything injury: unbuilt, unrecognised, `unknown`. The two held chips stay
held.

**THE READER HAS STILL NEVER SEEN A SENTENCE SAM WROTE.** Its matrix is nine
messages I chose. **The likeliest failure remains a refused good request** — a
phrasing that reads as a question and gets an answer instead of a card.

**NO ACCUMULATED WORLD (L13 DEPTH 0).** Every week is hand-built. A real
`project()` over a worn athlete may hold day shapes these fixtures do not — a
combined day whose parts dedupe, a practice match, a day the athlete already
edited — and the card's From/To lines are measured over days with at most two
parts.

## PARKED FOR SAM

1. **BATCH 31 IS NOW LARGER AND STILL PROPOSED**, one signing sitting as ordered.
   The five from slice 2, plus slice 3's: the card's frame (`Move a session`,
   `From`, `To`, `Why`, `Make the change`, `Not now`), the why line (*"You asked
   me to."*), the two asks, the chip label, and the sentences for a change that
   cannot be made, was declined, was refused, or changed nothing.
2. **THE WHY LINE IS THE ONE TO READ TWICE.** *"You asked me to."* is the true
   reason for an athlete-requested move and it is deliberately not a coaching
   reason — anything more would be the coach inventing a rationale for your own
   decision. If you want the card to say something more useful there, that is a
   Bible-grounded "why" and it is the wow-list's item 4.
3. **DOES THE LEDGER NEED TO KNOW THE COACH DRAFTED IT?** See the section above.
   The seat's reading is no — the yes is yours, so the decision is yours — but
   it is a ruling, not an implementation detail, and it is the other half of the
   athlete-tap-attributed-to-coach item already parked.
4. **WHICH REQUEST DID IT REFUSE THAT IT SHOULD HAVE PROPOSED?** The slice-2 ask
   in its S3 form, and worth more than any cell here.
5. Carried, unchanged: the frozen coach tree's 41,220 lines rooted at a protected
   module; the ledger's three unbuilt fact destinations; the journal/copy items;
   the two remaining chips.

## THE CONVERGENCE RULE

**TOWARD.** Zero new stored state. The conversation, the pending card and the
settling change are all component state and die with the screen; a proposal is
not a record and a card is not a decision. The one thing this slice persists it
persists **through the athlete's own door**, which appends a typed decision and
nothing else — so the coach gets undo, replay and relaunch-durability by NOT
having a writer, which is the reassessment's whole ruling arriving as behaviour.
The one place it could have gone the other way was the ledger authorship
question, and declining to add a provenance field is the north star choosing
against new stored state.

## L12 — WHAT CATCHES THE NEXT DEFECT OF THIS CLASS

**Three classes, and two of them have a fix in this commit.**

**(1) A RESOLVER ORDERED BY A TABLE.** Third sighting in this one reader
(week-vs-day at S2, weekday-name order here, and question-vs-change avoided by
construction). The fix is the practice, and it is now written into the gate as a
SECTION rather than a habit: **for any resolver that returns the first match,
the cell set contains at least one input matching two rules, per pair that can
co-occur** — and section [1] is that matrix, built before the resolver. What
would catch the next one: apply the same section shape to S4's context resolver
before it ships.

**(2) A GATE ANCHORED ON A FUNCTION BODY.** Second sighting, fixed by moving the
claim off the body entirely — one appender, its argument enumerated. General
form: *an anchor on the thing every slice edits is an anchor every slice
breaks.* Anchor on the smallest declaration that carries the claim, never on the
region that carries the work.

**(3) A SALVAGE GATE WHOSE VOCABULARY PREDATES THE CLAIM IT NOW GUARDS —
UNFIXED AS A CLASS.** `FORBIDDEN_WHEN_NO_APPLIED` is a list of PHRASES, so it
guards the sentences somebody thought of. It had no move; it has no *"I added"*
for `add_exercise`, no *"I binned"* for `bin_session`. **Every future kind
arrives with the same hole, silently**, and the pattern that catches it is not
another phrase — it is a cell that requires each proposable kind's confirmation
sentence to match at least one forbidden pattern. That cell exists for
`move_session` ([4], *"the claim is one the gate could have caught"*) and is
**not yet generalised over `COACH_PROPOSABLE_ACTION_TYPES`**, because there is
one member. **Generalising it is the price of the second kind**, and it is named
here so the next slice extends it rather than trusting it.
