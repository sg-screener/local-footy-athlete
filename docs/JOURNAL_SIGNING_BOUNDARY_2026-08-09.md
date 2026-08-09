# BOUNDARY — THE SIGNING SESSION LANDS (2026-08-09)

**Commits:** `09c29fb7` (items i–v) · `646116d3` (the copy-gate compression that
fell out of item iv's mutation test).
**Order:** SEAT_INBOX item 1, against docs/JOURNAL_SIGNING_SESSION_2026-08-09.md,
committed as authored at `b4335d2a` before a line was built.

**GATE, both commits:** full `test:bible` **UNPIPED `GATE_EXIT=1` at
`test:program-control-durable`, 1 FAIL line** — main's declared red, same
assertion text (*"a move committed durably reaches the visible week"*).
`test:compile` PASSED, no file regressed. **Sweep 2 of 169 = the declared set
exactly.** 11 mutations, 11 red.

---

## 1. WHAT THE ATHLETE NOW SEES THAT THEY DID NOT BEFORE

The order asked for this in plain words, so it goes first.

**FOUR SURFACES THAT HAD NEVER RENDERED, AND NOT ONE LINE OF `JournalScreen.tsx`
WAS EDITED TO PRODUCE THEM.**

| Surface | What it says now |
| --- | --- |
| The hero's **load band** | "Load vs your normal" + one of three spoken verdicts, with the track, the shaded sweet spot and the athlete's marker on it |
| The **load stat tile** | the week's load as a percentage of their own normal — the ratio spoken, never a raw AU |
| The **"ran hot" card** | a muscle region that beat its own previous best by more than 15% |
| The **"balance drifting" card** | a pattern whose completed share ran more than 25 points from what the week planned |

Each was written, tested and DARK since its slice. `signedValue` returned null
because each was downstream of a PROPOSED constant. **Sam signed eight constants
and they appeared.** That is the load slice's mechanism paying out exactly as it
was designed to: *"Sam's signature alone turns the lines on — no code change."*

**AND TWO THINGS HE ASKED FOR DIRECTLY:**

- **After a session the app now asks "How did that go?"** instead of "How did it
  compare with what was planned?" — the same three answers, none of the work of
  holding the plan in your head first (C2).
- **A week with no weighted lifts says so again** — "No lifts recorded with a
  weight this week." (C3).

**AND ONE THING NOBODY ASKED FOR BECAUSE NOBODY HAD SEEN IT:** the month drawer's
collapsed row read **"Trap Bar Deadlift +12.5kg since 2026-04-06"**. It now reads
**"since April"** (C5).

---

## 2. THE FIVE ITEMS, AS ORDERED

### (i) The eight constants — `0 PROPOSED of 10`

`streamWeighting` · `sweetSpotBand` · `tonnageModulatedByEffort` ·
`regionNormalWindowWeeks` · `regionSecondaryShare` · `regionHotRatio` ·
`patternDriftThreshold` · `minimumWeekCoverage`. Each carries
`source: 'Sam 2026-08-09, signing session'`, and a cell asserts the set moved is
**exactly the eight the order names** — the two signed earlier (the 2/1/0 rung,
the four-week stream window) are asserted absent from it, so the batch cannot
quietly grow or shrink.

**`tonnageModulatedByEffort` IS SIGNED AS *OFF*, WHICH IS NOT THE SAME AS OFF BY
DEFAULT.** Turning it on is now a ruling rather than a flipped default.

### (ii) Copy batches 15–26 SIGNED

Twelve status lines, twelve headings. Amended by batch 26's withdrawals and its
one replacement, as the order says.

### (iii) C2 — "How did that go?"

**THE ANSWERS ARE UNCHANGED, AND THAT IS WHAT MAKES IT A WORDING CHANGE RATHER
THAN A NEW QUESTION.** `as_expected` / `harder_than_expected` /
`easier_than_expected` / `stopped_early` keep their keys and their labels, so **no
stored value moves and every session already recorded still means what it meant.**
Had the answers moved with the question this would have needed a read lift.

### (iv) C3 — the lifts empty state, restored

Back in its original form: one quiet line where the card would have been,
unconditional, exactly as 26-e recommended.

**THE FLAG PAID FOR ITSELF AND IT IS WORTH SAYING WHY.** The withdrawal was
correct against Sam's ruling and wrong against the athlete. Nothing in any gate
could have caught that — a retired string reads as a retired string. The only
instrument was **naming the cost out loud in the batch that made it**, and it
turned around inside a day.

### (v) C5 — the month word

**HIS PREMISE WAS ONE WORD OFF AND CHECKING IT WAS THE WORK.** C5 says *"the
closed-twelve month table already exists on the screen"*. It did — holding
`Mar`, not `March`. One table of full words now, with **the abbreviations DERIVED
from it** rather than a second literal twelve that agrees until somebody edits
one, and a cell asserts the derived twelve are byte-identical to the twelve batch
26 shipped, so **the week label provably did not move.**

**FOUR SITES WERE RENDERING THE ISO WHILE A COMMENT THREE LINES UP CLAIMED THEY
RENDERED "since 6 Apr".** The claim and the code disagreed for a whole slice and
nothing was watching the difference. One is now.

---

## 3. THE FINDING OF THE PASS — A SIGNATURE TAKES THE PROOF WITH IT

**Before this commit, section [2] of `journalLoadTests` proved the whole
provenance mechanism for free.** Real constants were proposed, so real outputs
were dark; asserting the darkness asserted the wiring.

**Signing every constant took that evidence away and left the assertions
looking fine.** Every remaining proof of the refusal ran over hand-built
`Derived` values — which prove `signedValue` and say *nothing* about whether
`buildJournalLoadModel` still wires its constants into what it returns.

**The gap is not theoretical.** The next author adds a constant, writes
`{ value, provenance: 'signed' }` by hand instead of `derived(value, …)`, and
nothing reds — everything is signed today, so a hardcoded `'signed'` and a live
combination are indistinguishable. **The mechanism would be dead while reading
green**, which is the exact failure the load slice's own comment warned about
(*"a cell that only checked 'the headline is hidden today' would pass forever
after someone marked a constant signed without Sam"*). It warned about the
constant being marked signed **without** Sam. It did not anticipate Sam.

**SO [2b] UN-SIGNS A CONSTANT AT RUNTIME AND REBUILDS THE REAL MODEL**, asserting
the darkening in both directions for all seven wired constants, with the mutation
**proven applied before its result is read** and the table **proven restored**
afterwards. Mutation M4 — hardcoding `provenance: 'signed'` on the headline —
reds it four ways.

**LOOP CHECK: `a cell that reds when its own unit lands` — and this is a new
face of it.** The known form is a cell that reds because your change arrived. The
form here is **a cell that goes on passing while quietly ceasing to test
anything**, because the world moved into the branch it was written to watch.
**PROPOSED COMPRESSION: when a gate's subject changes state, ask not only "which
cells red?" but "which cells are now vacuous?"** The eleven that reddened
announced themselves; the ones that silently emptied did not, and they were the
dangerous half.

### The same shape, twice more in the same commit

- **`every PROPOSED constant says so in its source` is now VACUOUS** — zero
  proposed entries. Kept, because it is the guard the next constant needs, and
  **labelled vacuous at the cell** with a non-vacuous counterpart beside it
  (every SIGNED constant names who signed it and no longer reads `PROPOSED`).
- **The cells asserting `provenance === 'proposed'` on the CONSTANTS became TYPE
  ERRORS**, seven of them: `as const` narrowed each entry to the literal
  `'signed'`. **Both easy answers cost something** — deleting the cells removes
  the guard, dropping `as const` loosens the values Sam just signed. The READ is
  widened to `JournalLoadConstant`, the type the table already declares it
  satisfies, and the table keeps its literals.

---

## 4. A CONFLATION IN THE DOOR, CAUGHT BY THE NEW CELL ON ITS FIRST RUN

`signedValue` returns null for an **UNSIGNED** value and for an **ABSENT** one
alike. [2b]'s first draft read the darkening through it, and `cameBack` came back
false for `conditioningStream` on a strength-only fixture — where the comparison
is legitimately null.

**Reading a refusal through a door that conflates two answers cannot tell them
apart.** The wiring is asserted on `provenance`; `signedValue` is asserted
separately, over a headline **proven present** while dark — without that
`!== null` half the cell would pass against a model that computed nothing at all.

---

## 5. THE UNPLANNED FINDING — A COMMENT IS NOT A SHIPPED STRING (`646116d3`)

**FOURTH SIGHTING, AND THIS EXACT GATE WAS FILED AS LATENT DEBT YESTERDAY.**

Mutation-testing C3 — deleting the restored line again — reddened both journal
suites and left `copyRulingsBindingTests` **green**, because the sentence also
lives in a docblock four hundred lines up explaining that Sam restored it. **The
gate would have reported a signed string as shipping while the app did not say
it, kept green by a comment about the very ruling being violated.**

Stripped once at the source reader rather than at each of the four cells that
read `SOURCES`. **It is wrong in both directions**: a RETIRED string quoted in a
comment documenting its retirement reads as the old wording surviving — a false
RED, and a false red is how a gate gets weakened by whoever next has to make it
pass.

**IT FOUND FOUR STRINGS THE SHEET CLAIMED WERE SHIPPING AND THAT THE APP HAS NOT
SAID FOR AT LEAST A UNIT:**

- **`"Niggles"` — a genuine omission in yesterday's batch 26, fixed here.** 26-a's
  own extraction attribution counts it among its six retired headings and the
  heading did leave the app, but neither 21-a's row nor 26-a's table said so.
- **`"Ask Coach"`, `"Edit this session"`, `"Edit exercises"` — NAMED, NOT FIXED.**
  Pre-existing debt from batches 6 and 11, surfaced by a new instrument during a
  signing session about the Journal. Each sits in `KNOWN_ABSENT` **citing the
  record that already ruled on it**, and a cell requires that citation — an
  exception list nobody pays to extend is a place to hide things.
  **`"Ask Coach"` must NOT be withdrawn:** batch 11-e rules it DORMANT for the
  beta cut and says in so many words that its absence from the UI is not a
  retirement anybody signed. Withdrawing it would BE that retirement.

Mutation-proven in both states: deleting the C3 line leaves the OLD gate green
and reds the new one.

---

## 6. A NUMBER IN THE LAST TWO REPORTS WAS WRONG

They said **"sweep 2 of 167"**. The chain has held **169** since `73232293` —
measured at `73232293`, `b6509f02` and HEAD with a byte-identical script list
(168 npm-run suites + `runSlice1`). **The failure count was right and the
denominator was not.**

`a count taken for a record`, in its plainest form: the claim that mattered
survived, and the total beside it did not. Corrected here rather than carried.

---

## 7. NORTH STAR

**TOWARD, and this commit is unusually clean on it.** **ZERO new stored state.**
Two representations REMOVED: the second literal month table (derived now), and
seven `provenance === 'proposed'` assertions that had become the compiler's
business rather than the test's. One derivation added (`monthWordSince`), pure,
reading nothing.

---

## 8. NOT COVERED

**FIRST LINE: NO DEVICE EVIDENCE, AND IT MATTERS MORE THIS PASS THAN ANY BEFORE
IT.** Four surfaces rendered for the first time today and **not one of them has
ever been seen.** The band's track, the shaded sweet spot and the marker are
GEOMETRY — percentages fed to `left`/`right` — and no cell mounts them. **DEPTH
(L13): 0.** Sam's eye is the only instrument and it has not run. This is the pass
where "the mechanism worked" and "it looks right" are furthest apart.

- **THE C5 CELLS ARE SOURCE SCANS, AND THAT IS A REAL LIMIT.** `monthWordSince`
  lives in a `.tsx` no node test can import, and moving it to `rules/` would take
  athlete-visible words out of the copy gates' scope — `a green gate watching
  nothing`, already paid for three times in this unit. So the table is parsed out
  of the source and computed over, which proves the twelve and the derivation but
  **never actually calls the function.** "since March" is argued, not rendered.
- **THE RESTORED C3 LINE APPEARS ON A WEEK THE ATHLETE NEVER LIFTED AT ALL** — a
  rest week, a holiday — where it is true and says nothing. See §9.
- **NO CELL PROVES THE FOUR LIT SURFACES ARE LEGIBLE TOGETHER.** The hero now
  carries a status line, a job line, a credit line AND a band; the stat strip now
  has three tiles where it often had one. **Nothing has ever drawn that.**
- **`KNOWN_ABSENT` IS THREE STRINGS OF PRE-EXISTING DEBT, SIZED AND NOT PAID.**
  Whether "Edit this session" and "Edit exercises" should be formally withdrawn
  is batch 6's business, not this unit's.
- The `~150 label strings across 20+ `utils`/`rules` modules` invisible to both
  copy gates is **still open** and still its own unit.
- Week navigation is still NOT built.

---

## 9. PARKED FOR SAM — four, none blocking

1. **C4, HIS OWN OPEN ITEM: the week bars' colours** — the app's red/orange/green
   intensity tokens as built, or the mock's calmer single-accent ramp. He judges
   on the phone after this lands. **No change made.**
2. **THE RESTORED LIFTS LINE ON A NON-LIFTING WEEK.** Built unconditional because
   that is what "restore" says and what 26-e recommended. Making it conditional
   on *lifted but recorded no weight* would need the trend module to report a
   fact it currently only consumes — **a narrowing of his ruling rather than an
   implementation of it, so it is flagged, not done.**
3. **"March 2025" — the year rider on C5, and it is mine.** His example is "since
   March". The load model's history is UNBOUNDED, so a first entry from last March
   would render "since March" and be read as this March. The year is spoken
   exactly when omitting it would be false; **the phrasing is the terminal's.**
4. **Batch 27's twelve month words are PROPOSED.** The decision is signed, the
   words are not.
