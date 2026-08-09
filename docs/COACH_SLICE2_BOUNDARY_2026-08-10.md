# COACH REBUILD SLICE 2 — BOUNDARY

`5ff09347` (the seat's parked ideas, as authored) · `24617f53` (batch 30 ruled,
Sam's greeting signed) · `e533f1ec` (the slice) · the precedence fix. Branch
`main`.

Order: docs/SEAT_INBOX.md item 1, 2026-08-09 night — (a) greeting, (b) the
parked file, (c) slice 2. Kickoff: docs/COACH_REBUILD_KICKOFF_2026-08-09.md.
Slice 1: docs/COACH_SLICE1_BOUNDARY_2026-08-09.md.

---

## ONE LINE

The coach answers questions about the week, every word of every answer comes out
of the projection the Program tab renders, and **the frozen pipeline's own truth
gate now holds the coach's mouth shut** — every reply is validated against a
communication with zero applied changes, so "slice 2 changes nothing" is a
property of the sentences as well as of the imports.

## SCOPE — ALL THREE ITEMS PROCESSED, STOPPED BEFORE S3 AS ORDERED

(a) Sam's greeting ships as the first bubble; batch 30 is RULED. (b) The seat's
parked-ideas file is committed unchanged. (c) Slice 2 is built: read-only Q&A,
no mutation paths, grounds returned as data. Not built, deliberately: S3's
change card, S4's journal context, and the mock's three chips (still held with
slice 1's reason).

LOOP CHECK `owner-signs-in-own-words` — sighting 1 at this seam — **iterate, and
it paid immediately in a way worth recording.** The seat's own draft greeting
would have been written to be *safe* about what the coach can do. Sam's is not:
*"I can answer fitness questions and make changes to your program"* is a promise
S3 has not delivered. Getting the words from the owner produced a sentence the
seat would not have dared write, **and a ruling about the gap along with it** —
which is the mechanism, not a side effect. The next seam that needs a voice
should ask before drafting.

## (a) THE GREETING, AND THE HONESTY GAP IS RECORDED WHERE THE WORDS ARE

Sam, verbatim: *"G'day, I'm your S&C coach. I can answer fitness questions and
make changes to your program."* It opens the conversation; the week-shape line
is unchanged, as the second bubble.

**IT IS THE ONE STRING IN BATCH 30 THAT EARNS A REGISTRY ROW.** A verbatim quote
is the strongest provenance `signedCopy.ts` has, so the greeting goes into the
sheet as `signed_sentence` while the rest of batch 30 stays module constants.
`registerSignedCopy` throws on an id re-registered with different words, so the
id is a lock on the sentence rather than a label for it.

**THE CLAIM IS AHEAD OF THE ABILITY AND THAT IS RULED, WITH A CONDITION.** Sam:
*"we aren't releasing the app yet - we are going to build that shit now."* The
app has no users but his devices, so the sentence becomes true before an athlete
reads it. The condition — *if a beta gate arrives before S3, re-check this
sentence* — is written into the module that holds the words and **pinned by a
cell**, because a condition that lives only in a boundary doc is a condition the
next reader never finds.

**THE REST OF BATCH 30 IS RULED, NOT STRICTLY SIGNED, AND THE PRICE IS STATED.**
The opener COMPOSES — a space, `". "`, a trailing full stop — and
`joinSignedCopy` cannot express a suffix at all; the alternative is widening
`FILLED_PLACEHOLDER` to admit WORDS, which `signedCopy.ts` names as a loosening
of the L-P2 runtime law. So section [8] makes the claim at runtime instead:
**strip every fragment the opener may use and every projection-given day name
from each of the week's seven sentences, and nothing may remain.** It carries
its own control — an invented clause must leave a residue, or the cell is a
strip-everything that proves nothing.

## (c) THE ARCHITECTURE — TWO PURE RULES, AND THE SCREEN DECIDES NOTHING

```
message → lexicalQuestionReader.read()  → CoachQuestion   (typed, date-targeted)
        → coachAnswer()                 → CoachAnswer     (text + grounds)
        → validateCoachCommunicationTruth()               (the salvage gate)
        → the turn
```

The screen calls two functions and renders the result. It has **no branch for
"the coach had no answer"** — the answering rule owns that case and returns the
honest sentence itself, because a screen with its own fallback wording is a
second voice one edit away from disagreeing with the first.

## THE SALVAGE RE-POINT, LAYER BY LAYER — INCLUDING THE ONE THAT FAILED

**INTENT — RE-POINTED, AND THE COMPILER PROVES IT.**
`CoachAnswerableKind = Extract<CoachIntentKind, 'program_explanation' |
'session_mismatch_question' | 'general_question'>`. Three matching string
literals satisfy "re-pointed" on day one and stop being true the day somebody
renames one upstream; an `Extract` is a type error that day instead. `import
type` is erased, so **no frozen module enters the runtime graph** — the salvage
layer is consumed as a contract, not as code.

**THE TRUTH GATE — RE-POINTED VERBATIM, AND IT IS THE KEYSTONE.**
`verifiedCoachCommunication` exists because the coach once rendered *"Sub in:
easy aerobic conditioning…"* against a program containing no such session. Its
validator refuses any reply that claims a mutation while `appliedChanges` is
empty. **In slice 2 `appliedChanges` is always empty**, so every answer runs
past it with `canSayProgramUpdated: false` — the flag that arms
`FORBIDDEN_WHEN_NO_APPLIED`. Read-only stops being a claim about the import list
and becomes a claim about the sentences too. It is also the piece that does not
move at S3: when `appliedChanges` stops being empty, only the input changes.

**TARGET RESOLUTION — NOT RE-POINTED, AND THIS IS THE PASS'S REAL FINDING.**
`resolveCoachTargetFrame` (`utils/coachTargetFrame.ts`, 728 lines, green in the
survey's §3.3 measurement) is the salvage resolver and slice 2 does not use it,
for two measured reasons:

1. **Its input is `visibleWeek: ResolvedDay[]`** — the legacy week shape. Feeding
   it means constructing a SECOND representation of the week inside the coach's
   read path, which is exactly the count
   docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md ruled against. *A salvage
   module written against a retired representation cannot be re-pointed without
   restoring the representation.*
2. **It imports `COACH_CONTEXT_TTL_MS` from a zustand store module**, so
   importing it drags a store into a read-only screen's module graph — in a
   place the screen's own import ban was not looking (see the gate finding
   below).

What slice 2 does instead is not a rewrite of that resolver's job. It resolves a
**DATE, looked up in the week the coach was handed** — never computed from a
clock, so the coach can only ever name a day it can see, and *"the coach
answered about a day outside your week"* is unreachable rather than tested for.
`decisionLedger.ts:9-11` says a decision may name a date and never a derived
session id anyway (*"a derived id can drift across engine versions, a date
cannot"*), so this is the shape S3 needs too.

**CLARIFIERS — THE SHAPE, NOT THE STORE.** L-C1's *"asks when no rule answers"*
is honoured, but a `pendingCoachClarifierStore` transaction is PERSISTED state
and slice 2 stores nothing. The ask is a coach turn. Two distinct admissions are
kept distinct because they are different facts about who fell short: *"I can
only see this week"* (the athlete asked well, the coach's horizon is one week)
versus *"I don't have an answer for that yet"* (no rule answers).

## THE READER RECOGNISES POSITIVELY, AND THE DIRECTION IS THE SAFETY

There is no *"is this a mutation request"* test anywhere in slice 2, and there
does not need to be: anything the reader cannot place as an answerable question
becomes `unknown`, and `unknown` is the coach saying it does not know. **A
negative test has to be exhaustive to be safe; a positive one is safe by being
incomplete.** "Move Friday's session to Sunday" is refused because it was never
recognised, not because a pattern caught it.

Six refusals are pinned as hard as the recognitions, including the one that is
easy to get wrong: **"what am I doing?" with no day named is refused**, because
guessing "today" would be the coach answering a question nobody asked.

**AND THE READER IS THE SEAM'S FIRST IMPLEMENTATION, NOT ITS CONTRACT — SAID
PLAINLY.** `CoachQuestionReader` is an interface with one method; the shipped
implementation is LEXICAL. AGENTS.md is right that phrase matching is not an
intelligence layer. What makes it legitimate here is that its OUTPUT is typed
and the ANSWER is derived from the projection, so a better reader (the salvage
layer's own `CoachIntentClassifier` shape, LLM-backed) replaces it without a
single answer changing. It is the same seam the frozen pipeline already has,
re-pointed at data the rebuild actually holds.

## EVERY TRAINING WORD CAME OUT OF THE PROJECTION

Days are named by `visibleDayLeadHeadline` — the same call the week row and the
opener make — and parts by their own `headline`. **There is no branch on day
KIND anywhere in the answering rule:** a day is answered by what it HAS, which
is its parts if it has any and its lead headline otherwise. A rest day answers
*"Friday: Rest Day."* because that is what the projection called it, not because
this module knows what a rest day is.

**"WHAT'S ON THIS WEEK" RETURNS THE OPENER'S OWN SENTENCE, BYTE FOR BYTE.**
Composing a second week summary inside the same screen would be two accounts of
one week — ruling 1's `summariseDay` defect, one slice later.

The one place slice 2 deliberately differs from the opener is the fixture: the
opener suppresses a game that is today or tomorrow because its day clause
already names it, and **an athlete who ASKS must be told anyway**. Both rules
are pinned in the same cell so the difference reads as a decision.

## FINDINGS

**THE IMPORT BAN WAS ONE HOP TOO SHORT, AND SLICE 2 IS WHAT MADE IT VISIBLE.**
Slice 1's read-only claim is a sweep of the SCREEN's import lines. Slice 2 moved
the thinking into `rules/` modules — so from now on the cheapest way to hand the
coach a store is not to import one on the screen, it is to import one from
`rules/coachAnswer`, **where that cell was not looking. The screen's list would
stay spotless and the gate would stay green.** The ban now opens every `rules/`
module the screen imports and sweeps it with the same patterns. One hop, not a
transitive walk, and the cell says so — a claim about a whole graph is one it
cannot honestly make.

**AND THE HOP HAD TO EXCLUDE `import type` OR IT WOULD HAVE LIED THE OTHER WAY.**
A type from a store module is a shape, not a store; counting it as a runtime edge
is the overnight pass's eleventh sighting of `a count taken for a record`, and it
would have reddened `coachQuestion` for a line the compiler erases.

**A CELL OF MINE REDDENED ON A CORRECT EDIT, AND THAT IS A DEFECT IN THE CELL.**
Slice 1's turn-producer anchor was `…\n }, \[draft\]\);` — it named the
DEPENDENCY LIST. Slice 2 correctly added `visibleWeek` to the deps and the region
became unfindable; the prove-the-region cell reddened first and three claims
about the region reddened behind it. **The anchoring law worked exactly as
written** — the region cell fired before anything was asserted about an empty
string — **but a gate coupled to a dependency array is coupled to the wrong
thing.** Re-anchored on the closing brace at the producer's own indentation, and
it still proves its last line is inside the slice.

**A REAL DEFECT, FOUND BY PROBING THE READER BY HAND AND NOT BY ANY RED.**
*"What am I doing on friday this week?"* carries a day marker AND a week marker.
`SUBJECT_MARKERS` was searched in ORDER and `week_shape` sat above `day_work`,
**so the coach answered with the week's shape and never mentioned Friday.** The
gate was 72/72 green throughout, because no message in the cell set carried two
markers — **which is exactly the gap a table-ordered resolver leaves, and the
reason the cell set could not have found it.** Fixed by making the rule
SPECIFICITY rather than table order: a named day is narrower than a week and
wins; `next_game` stays above both, because *"is my next game on saturday?"*
names a day and is still a fixture question. Four regression cells, two of them
controls that stop the fix becoming a blanket *"a day always wins"*.

**The general shape, and it belongs beside the anchoring law:** *a resolver that
picks the FIRST matching rule from an ordered table answers by table order, and
a test set with one marker per message can never observe the ordering.* Any cell
set for such a resolver needs at least one input that matches two rules.

**A COUNT WAS THE WRONG INSTRUMENT FOR "THE IMPORT BLOCK WAS FOUND", TWICE OVER.**
The slice-2 gate's locate-the-block cell required two runtime imports.
`coachQuestion` has exactly ONE, because its other two are `import type` and
erased — so the threshold **failed on a correct module**, and on a module with
more imports it would have passed on an empty match if the regex ever stopped
matching the shape. Re-aimed to prove the block by a KNOWN MEMBER
(`utils/appDate`, `utils/verifiedCoachCommunication`) rather than by size.

**THE TRUTH GATE IS PROVEN TO BITE ON A REAL ANSWER, NOT ON THE VALIDATOR.** A
cell that called `validateCoachCommunicationTruth` directly would prove the
validator works, which was never in doubt — it has 58 cells of its own. The
claim under test is that slice 2's answers GO THROUGH it. So the projection is
handed a part whose headline is a forbidden claim (`"I adjusted your week"`),
the answer is assembled from that headline exactly as it would assemble any
other, and **the reply that comes back is the honest sentence with
`verdict: 'refused'` and the violation named.** The control is the same week
with an ordinary headline, which must answer normally — a gate that refuses
everything is not a gate.

**TWO MUTATIONS WERE INERT BEFORE THEY WERE RED, AND BOTH WERE RE-PROBED RATHER
THAN COUNTED.** M6 (deleting the beta-gate re-check note) did not apply — the
substitution missed and the phrase was still in the file, so the green run was
the INSTRUMENT reporting nothing. N9 (making the fixture question inherit the
opener's suppression) applied but changed no behaviour: it compared
`day.date > todayISO + 'z'`, and `'2026-08-15' > '2026-08-14z'` is still true, so
the same fixture was found. **A mutation that does not move the output is not a
survivor and must not be recorded as one** — both were re-probed with a mutation
proven to bite, and both reddened. Same class as the journal-hidden pass's M6
prefix incident.

## GATE

- Full unpiped chain `GATE_EXIT=1`: exits at `test:program-control-durable`
  with **1 FAIL cell** — *"a move committed durably reaches the visible week"* —
  **main's declared red**, 92 suites reached. Run twice: once at the slice, once
  after the precedence fix.
- `test:compile` **PASSED**, totals **35 / 51 / 373 — byte-identical to
  baseline.**
- **Sweep 2 of 173 = the declared set exactly** (`program-control-durable`,
  `fixture-identity`). **The denominator moved 172 → 173 in the commit that
  earned it** (`test:coach-tab-slice2`, which sits past the chain's exit — the
  sweep is what proves it).
- New gate `test:coach-tab-slice2`, **76 cells, 11 mutations 11 red.**
- `test:coach-tab-slice1` **73 cells** (57 at slice 1 → 66 after the signing →
  73), **8 mutations 8 red.** Three cells re-aimed, none deleted.
- Copy extraction ceiling **UNCHANGED at 576** — batch 31 lives in `rules/`,
  which the extractor does not walk.
- **A PROCESS NOTE, OWNED:** the first sweep ran while a throwaway probe file
  existed for a few seconds under `src/dev/`. It reported 2 of 173, the declared
  set — but a sweep run over a tree that had an extra file in it is not a sweep
  anybody should quote, so it was re-run clean after the fix and the number
  above is the clean one. Recorded rather than quietly replaced; this is a
  shared worktree.

## NOT COVERED

**FIRST LINE: NO DEVICE EVIDENCE, DEPTH 0. NOBODY HAS ASKED THIS COACH A
QUESTION.** No screen is mounted and no athlete is walked; every week in the
slice-2 gate is hand-built. **Not one keyboard case has been exercised, which is
still the half L-C3 declares a GATE failure**, and slice 2 does not close it —
it now matters more, because slice 1's tab could be looked at and slice 2's has
to be typed into. The composer-overshoot symptom named in the slice-1 boundary
(`tabBarHideOnKeyboard` and `KeyboardStickyView` on two clocks) is unchanged and
unwatched.

**THE READER HAS NEVER SEEN A SENTENCE SAM WROTE.** Its refusals are pinned
against six messages I chose, and the messages I chose are the ones I thought
of. **The likeliest failure is not a wrong answer but a refused good question** —
an athlete phrasing that reads as `unknown` and gets the no-answer reply. That
is the safe direction to fail in and it is still a failure, and no instrument
here can estimate how often it happens.

**THE ANSWERS HAVE NEVER RUN OVER A REAL WEEK.** Same limit as slice 1's opener:
`project()` over an accumulated athlete state may hold day shapes these fixtures
do not — a practice match, a combined day, a day whose parts dedupe to one
bucket. **No walker run, no accumulated world — L13 depth 0.** A day with four
parts would produce a longer answer than any cell has seen, and the
under-80-characters cell is measured over a fixture with at most two.

> **CORRECTION, 2026-08-10, from the sixtieth pass — this section's claim below
> that *"why is Friday heavy?" is refused* WAS FALSE.** The message carries a day
> marker, the day beat the week by this slice's own specificity rule, and the
> coach answered *"Friday: Lower Squat."* — the athlete asks WHY and is told
> WHAT. **No cell held the claim; it lived in this paragraph only**, which is
> `a ruling premise is a claim too` applied to a boundary's own words. Slice 3
> adds a `reason` subject so the question is placed and answered honestly, and
> pins it. Corrected here rather than left reading as a fact.

**THE ORDER SAID "THE PROGRAM, THE WEEK, AND RECORDED RULES" AND THIS SLICE
DELIVERS THE WEEK.** That is the largest thing left undone and it is a scope
statement, not an omission: L-C1 says the coach's knowledge IS the Bible plus
recorded rulings, and slice 2's knowledge is the VISIBLE WEEK. Every answer is grounded, none is *"your rule
says…"*. **"Why is Friday heavy?" is refused, not answered** — which is L-C1
running at its boundary, and it is also the largest thing S2's own kickoff line
promised that this slice does not deliver. The wow-list's item 4 (*ASK WHY ABOUT
ANYTHING*) is the shape that would close it and is not ordered.

**BATCH 31 IS UNREAD BY SAM** and lives in `rules/`, invisible to the extractor —
on the module, NOT on the sheet, the same known ~150-string gap batches 29 and 30
sit in. **The copy gates being green is not evidence about these five strings.**

**THE FROZEN SUITES WERE NOT RE-RUN.** The survey's 11 green orphaned coach
suites are the evidence that the salvage layer still holds, and this pass cites
that measurement rather than reproducing it. `test:coach-truth-gate` (58 cells)
in particular is the suite that would catch a change to the module slice 2 now
depends on, **and it is not in `test:bible`.**

## PARKED FOR SAM

1. **BATCH 31 — five strings.** Two are sentences: *"No game in the week I can
   see."* and *"I can only see this week."* The other three are punctuation
   (`": "`, `", "`, `" "`).
2. **THE ANSWERABLE SET.** Slice 2 answers three questions: what's on a day,
   when's the next game, what's on this week. Say which question you tried
   first that it refused — that list is worth more than any cell here.
3. **"WHY IS FRIDAY HEAVY?"** — the Bible-grounded answer is not built and is
   the biggest gap between S2's kickoff line and this slice. It is the wow-list's
   item 4. **Say whether it belongs before S3 or after** — it is a slice-sized
   piece of work (the Bible sheets, provenance-travels-with-the-number, its own
   copy batch), not a finishing touch, and building it badly would put invented
   policy in the coach's mouth, which is the one thing L-C1 forbids outright.
   **One nearer-term half exists and was not taken either:** `VisibleDay`
   already carries a typed `capabilities.refusal`, which is a recorded rule the
   coach could speak — *"why can't I move Saturday?"* — without reaching the
   Bible at all. Named as the cheapest next rung.
4. Carried, unchanged: the frozen coach tree's 41,220 lines rooted at a
   protected module; the athlete-tap-attributed-to-coach writer id
   (`coachActions.ts:246-248`); the ledger's three unbuilt fact destinations;
   the journal/copy items; the chips (still held to S3).

## THE CONVERGENCE RULE

**NEUTRAL, edging TOWARD.** Zero new stored state — the conversation is
component state and dies with the screen, and an answer is not a record. Slice 2
adds a second READER of the projection and, like slice 1, deliberately declines
to add a writer. The one place it could have gone the other way was target
resolution: re-pointing the salvage resolver would have added a second week
representation to the coach's read path, and declining that is the north star
choosing between two things that both looked like reuse.

## L12 — WHAT CATCHES THE NEXT DEFECT OF THIS CLASS

**Two classes, and only one of them has a fix in this commit.**

**(1) A GATE WHOSE SCOPE WAS CORRECT WHEN WRITTEN AND BECAME NARROW WHEN THE
CODE MOVED** — the import ban that swept one file while the thinking migrated to
three. General form: *a ban on a LOCATION expires when the thing it bans can
move to a new location.* The one-hop sweep fixes this instance; the class needs
the ban expressed over the screen's REACHABLE SET rather than its import list,
and that is **not built**. Named here so the next slice, which adds S3's
change-card modules under the same screen, knows the cell it must extend rather
than trust.

**(2) A CELL SET THAT CANNOT OBSERVE THE THING IT IS TESTING** — the precedence
defect. Every cell fed the reader a message matching ONE marker, so the ORDER of
the table was never under test, and a 72/72 green said nothing about it. General
form: *a resolver that returns the first match from an ordered table is answering
by table order, and a test set with one match per input measures the matches
rather than the ordering.* What would catch the next one: **for any
first-match-wins resolver, at least one input that matches two rules, per pair
that can co-occur.** That is a rule about how to write the cells, not a cell, and
it is the thing to apply to S3's change-card resolver before it ships rather than
after — this one was found by hand, and hand-probing does not scale to a table
with more rows.
