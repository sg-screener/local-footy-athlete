# COACH REBUILD SLICE 1 — BOUNDARY

`ee85c40e` (kickoff + mock as authored) · `c25c8b77` (the slice) ·
`adab18df` (the survivor and the duplicate). Branch `main`.

Order: docs/SEAT_INBOX.md item 1, 2026-08-09. Kickoff:
docs/COACH_REBUILD_KICKOFF_2026-08-09.md. Mock (Sam-approved):
docs/COACH_TAB_MOCK_2026-08-09.html.

---

## ONE LINE

The coach tab is back at the navigation owner and it **speaks from the same
projection the Program tab renders** — the day's name in the coach's mouth is
the same function call the week row makes, not an equivalent rule — and it can
change nothing, structurally, because it imports no writer.

## SCOPE — S1 IN FULL, STOPPED BEFORE S2 AS ORDERED

Built: the tab, the conversation shell to the L-C3 bar, the SHORT real-data
opener, read-only, zero mutation paths, every word PROPOSED (batch 30).
Not built, deliberately: S2's answering layer, S3's change card, S4's journal
context. LR-6 lifted exactly as far as the slice plan says and no further.

LOOP CHECK `kickoff-carries-owner-rulings-as-laws` — sighting 2 (undo's
one-step ruling was 1) — **iterate, and it paid before any code was written.**
L-C1 decided a wording question Sam would otherwise have had to rule: the
mock's opener carried three clauses of *reasoning* ("so this week trains heavy
early… then we back off Friday"), and the reasoning is the part that would have
had to be invented. Ruling 1 asked for shorter; the law said which part to cut.

## THE ARCHITECTURE, AND THE ONE DECISION THAT WAS NOT OBVIOUS

**THE TAB DOES NOT MOUNT THE SCREEN R5.7 CUT.** The R5.7 comment's promise —
*"restoring the tab is one `Tab.Screen` block"* — is true and was the wrong
move. That block would have restored a mutation-capable pipeline with unsigned
copy on the first day of a rebuild whose whole ruling is that ten
representations collapse to two. `CoachScreen` and `CoachStackNavigator` are
**untouched and unreached**; the kickoff's own answer to the parked
41,220-line question is supersession, and supersession starts with a screen
that supersedes something.

**THE OPENER IS A SURFACE IN EVERYTHING BUT NAME.** Sam's ruling 1 already
settled this for prose: *the coach reads the same projection; `summariseDay` is
retired as an independent composition.* So `rules/coachOpener` takes
`VisibleWeek` and today, and names a day through `visibleDayLeadHeadline` —
**the same call `HomeScreenV2` makes**, asserted on both sides, so the day they
disagree is the day somebody deletes the shared owner rather than the day
somebody writes a second rule. It goes stricter than the existing `coachView`,
which drops `bucket` and would therefore have forced exactly that second rule.

**L-C1 IS RETURNED AS DATA, NOT ASSERTED AS PROSE.** `CoachOpener` carries the
`grounds` — every day the sentence was entitled to use. A gate can then ask the
only question that matters: *does every day the coach names exist in the week it
was given, under that day's own projected name?* Two cells ask it.

**READ-ONLY IS AN IMPORT BAN, NOT A PROMISE.** The gate forbids module
FAMILIES (`store/`, transactions, ledger, control actions, the frozen
pipeline, persistence) rather than named symbols — a ban on `programStore` is
one rename from useless. "I wrote no mutation" is a claim about today; an
import ban is a claim about every day after it. The conversation is component
state and dies with the screen: **zero new stored state, north star NEUTRAL.**

**L-C3 AT THE ONE PLACE THE SCREEN CANNOT FIX ITSELF.** The composer is the
`KeyboardSafeArea` footer, so it is positioned against the keyboard rather than
laid out above it; `AppTextInput` keeps the `done` submit key; taps persist
while the keypad is up. But an 84pt tab bar under a `KeyboardStickyView` footer
is a **static bottom inset**, and a sticky footer resting one inset up
overshoots by exactly that inset — the run-3 onboarding finding, in a place a
screen cannot reach because the tab bar is not its layout. `tabBarHideOnKeyboard`
removes the inset instead of compensating for it, at the navigation owner.

## THE MOCK'S CHIPS ARE NOT HERE, AND THAT IS A DECISION

"Move a session", "Something hurts", "Make this week easier" are requests to
CHANGE things. Slice 1 has nowhere to send a change, so three chips would be
three affordances that all answer *"I don't have an answer for that yet"* —
a worse first impression than an honest empty conversation, and a half-alive
surface of exactly the kind this repo keeps paying for. They arrive with S3,
behind the change card L-C2 makes their contract. **Sam's veto is open.**

## FINDINGS

**A MUTATION SURVIVED, AND THE SURVIVOR IS THE INTERESTING ONE.** M10 changed
`'Tuesday'` to `'Tues'` and the gate stayed **56/56 green**. The weekday cell
checked the length and the two ENDS; the derived-abbreviation cell stayed green
beside it because `'Tues'.slice(0, 3)` is still `'Tue'`. **Both cells were true
and the athlete would have read "Game Tues".** The seven words ARE batch 30
copy — copy is pinned by its words, and the abbreviation is the derived thing.
Re-aimed: all seven pinned, plus seven consecutive real dates walked through
the table, because a correct set in the wrong ORDER passes a set comparison.

**THE SWEEP FOUND A DUPLICATE PREDICATE, AND THE CHAIN COULD NOT HAVE.**
Re-aiming "two tabs, not three" in `journalHiddenContractTests` left an
identical cell red in `journalWeekTests` — one predicate, two suites, counted
once. Both sit past the chain's exit. **Censused rather than assumed: four
suites assert on the tab set, all four re-aimed, no fifth exists** — and the
census had to be run twice, because the first grep matched the literal
`Tab.Screen` and missed every suite that spells it `Tab\.Screen` inside a
regex. All four now pin the SET rather than the count: a set reds on an
arrival AND on a silent disappearance; a count reds on one.

**MY OWN INSTRUMENT FAILED THE ANCHORING LAW ON ITS FIRST RUN.**
`<Tab\.Screen\s+name="CoachTab"[\s\S]*?\/>` stopped at the INLINE
`<CoachIcon … />` inside `tabBarIcon` and returned a 140-character slice that
was non-trivial, read as a block, and did not contain the option being
asserted. A length check passed it; a *prove-the-region-contains-its-last-line*
cell reds it. Fixed in both suites that used the pattern.

**`a count taken for a record` — THIRTEENTH SIGHTING**, in the same new gate on
the same first run: a file-wide sweep for `speaker: 'coach'` counted TWO, and
the second was the TYPE DECLARATION `readonly speaker: 'coach' | 'athlete'`.
The instrument counted a character sequence; the claim is about replies the
screen can EMIT. Re-aimed inside the turn producer, with the region proven.

**A RECORD WHOSE STATED REASON CAME TRUE.** Batch 11-e's dormancy record for
"Ask Coach" said the tab was *"one `Tab.Screen` block from returning"*. It has
returned. The ruling is unchanged — the rebuilt tab is a new screen that does
not carry those words, and the frozen one that does is still unreached — but a
record reading as a prediction after the prediction resolves is one the next
reader cannot trust, so it is corrected rather than left.

## ONE OWNER FOR THE WEEKDAYS

The full seven are declared once and the three-letter forms are **derived by
`slice(0, 3)`**, proven byte-identical to the seven `shortWeekdayDateLabel`
shipped before today. The C5 precedent from the journal signing, applied
before the second table existed rather than after it drifted.

## GATE

- Full unpiped chain `GATE_EXIT=1`: exits at `test:program-control-durable`
  with **1 FAIL cell** — *"a move committed durably reaches the visible week"* —
  **main's declared red**, 92 suites reached.
- `test:compile` **PASSED**, totals **35 / 51 / 373 — byte-identical to
  baseline.**
- **Sweep 2 of 172 = the declared set exactly**
  (`program-control-durable`, `fixture-identity`). **The denominator moved
  171 → 172 in the commit that earned it.**
- New gate `test:coach-tab-slice1`, **57 cells**, in the chain (past its exit,
  so the sweep is what proves it). **12 mutations, 12 red** — after M10's
  survivor was re-aimed and re-probed, plus a reorder mutation added because of
  it.
- Re-aimed and green: `coach-entry-surface` 39/39, `journal-hidden` 35/35,
  `journal-week` 53/53, `copy-rulings-binding` 9/9, `keyboard-convention`
  43/43. Copy extraction ceiling **UNCHANGED at 576**.

## NOT COVERED

**FIRST LINE: NO DEVICE EVIDENCE, DEPTH 0. NOBODY HAS SEEN THIS SCREEN.**
Every cell reads source except section [3], which executes the pure derivation
and never the screen. The tab bar has never been seen with three tabs in it,
no bubble has ever rendered, and **not one keyboard case has been exercised** —
which is precisely the half L-C3 declares a GATE failure, and this pass cannot
close it.

**THE KEYBOARD IS THE LIKELIEST THING TO BE WRONG, AND HERE IS WHERE TO
LOOK.** `tabBarHideOnKeyboard` and `KeyboardStickyView` are two animations on
two clocks — the run-4 onboarding finding was exactly a discrete change racing
a continuous lift, and it produced a visible overshoot. The symptom to watch
for: **the composer jumping above the keypad and settling back** as the
keyboard opens. If it appears, the fix is the onboarding one — drive the
composer's inset from `useReanimatedKeyboardAnimation` — not another offset.

**THE OPENER HAS NEVER RUN OVER A REAL WORLD.** Section [3] builds its week by
hand. `visibleDayLeadHeadline` is the real owner and is called for real, but a
week assembled from `project()` over an athlete's accumulated state may hold
day shapes this fixture does not (a fixture that is a practice match, a
combined day, a day whose parts dedupe to one bucket). **No walker run, no
accumulated world — L13 depth 0.**

**THE WORDS ARE UNRULED.** Batch 30 is PROPOSED and lives in `rules/`, which
the extractor does not walk — **on the module, NOT on the sheet**, the same
known ~150-string `utils`/`rules` gap batch 29 sits in. **The copy gates being
green is not evidence about these words.**

**AND THE OPENER'S WORDING IS THE PART I AM LEAST CONFIDENT IN.** `"Game Day
today"` and `"Rest Day tomorrow"` come from applying one uniform rule rather
than from anyone's ear. It is uniform on purpose — a per-kind branch is a
second vocabulary — but it is the first thing Sam will want to change.

## PARKED FOR SAM

1. **BATCH 30 — the coach's first words.** Read them on the phone against your
   "get to the point" ruling. Six fragments and three sentences; the shape is
   `Game Saturday. Strength today. Conditioning tomorrow.`
2. **THE CHIPS.** Held to S3 with a reason above. Say if you want them in slice
   1 anyway and they become three prefills into the same input.
3. **`"I don't have an answer for that yet."`** — slice 1's whole answering
   layer, and L-C1 running at its boundary rather than a stub. Confirm you want
   the coach to say this rather than the tab shipping with a dead input.
4. Carried, unchanged: the frozen coach tree's 41,220 lines (now answered by
   supersession *in plan*, not yet in fact); the athlete-tap-attributed-to-coach
   writer id (`coachActions.ts:246-248`); the ledger's three unbuilt fact
   destinations; the journal/copy items.

## THE CONVERGENCE RULE

**NEUTRAL, edging TOWARD.** Zero new stored state. The slice adds no
representation of an athlete request — it adds a reader of one that already
exists, and it deliberately declines to add a writer, which is the whole
mechanism by which the coach will get undo, replay and durability for free.
