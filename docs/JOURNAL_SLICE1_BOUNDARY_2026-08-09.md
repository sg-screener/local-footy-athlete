# JOURNAL SLICE 1 — BOUNDARY REPORT (2026-08-09)

LOOP CHECK: **the source-scan half of `a-count-taken-for-a-record` — SIGHTING 6,
and it fired inside a gate I had just written, on its first mutation test.**
Same family as sightings 4 and 5 (day-first slices 1 and 2). Not a new rule —
AGENTS.md already carries the exact wording that would have prevented it
("prove the region was found") — so this is an ITERATION of a compressed law,
and §7 records why the law did not fire at authoring time. Secondary:
**`a-cell-that-reds-when-its-own-unit-lands`**, inverted — the legacy census red
below was MINE, caught by an existing gate rather than by a new one.

Commit `1659d664`. Built on the plan at `bdef6a00` and Sam's rulings at
`65bff3b3`.

---

## §1 WHAT IS ON HIS PHONE

A **Journal tab**, third of three, between Program and Profile. It shows:

- **The week-shape strip** — Mon–Sun, one mark per day: Hard / Moderate / Easy /
  Game / Rest, derived, nothing stored.
- **Did the work happen** — sessions done of sessions planned, partials, missed,
  still-to-log, and **"no reason recorded"** where the app does not know why.
- **How the week felt** — effort and soreness counts, or an honest line when
  the athlete recorded nothing.
- **Load** — the honest building state. The number is derivable; the comparison
  is not built, and slice 1 shows words rather than a number with nothing to
  compare it to.

**It opens no door.** No transaction, no store write, no mutation. A cell holds
that line by scanning the screen for five writer idioms and requiring zero.

---

## §2 SAM'S RULINGS, BUILT AS RULED

**The week shape** (his §2): flagged hard day → Hard; any other training day →
Moderate; recovery/mobility → Easy; Rest and Game → themselves. Derived from the
projection and the classifier; **no new stored state**, no daily questionnaire.

**The load weights** (his §1, signed same day): **Hard 2 / Moderate 1 / Easy 0**,
asserted as VALUES because a ruling stated as numbers is checked as numbers.

### ONE PREDICATE READ TWICE — his "two questions, one store", made structural

Shape and load read the same two facts. Shape short-circuits on Rest and Game
because he ruled they show as themselves; **load does not short-circuit**, and
that asymmetry is the whole design:

- **A GAME TAKES THE HARD WEIGHT THROUGH THE EXISTING OWNER.**
  `stressClassification.ts:59` returns `'high'` for a game, so a game day is
  already a hard day. **The ruling never priced a game and did not need to** —
  there is deliberately no `game` key in `JOURNAL_LOAD_WEIGHTS`, and a cell
  asserts its absence. No unauthored number reaches an athlete.
- **Easy days weigh zero and still count as sessions.** Written the obvious way
  — `isSession = loadWeight > 0` — the session count would have silently dropped
  every recovery day, which is the one place he said they must appear. A cell
  asserts the two answers **DISAGREE** on that day, so it passes only if the two
  questions are genuinely separate.

---

## §3 OWNERSHIP — WHAT THIS UNIT REFUSED TO RE-DERIVE

`isHardDay` is owned by `countWeeklyExposures` (`units.some(u => u.stress ===
'high')`). The Journal **asks** it. A second hardness authority is the defect
class this repo has paid for twice, and the projection already carries
`countsTowardLoad` for the same stated reason — *"carried, not derived by the
surface"*.

The cell that holds it takes the **same** projection twice, differing only in
what the classifier says, and requires the answer to move. A Journal that
re-derived hardness from the day's parts would answer identically both times and
a whole-week fixture would never notice. **That is the cell that catches the next
`intensity-never-feeds-identity`.**

---

## §4 THE GATE

- Full `test:bible` **UNPIPED**: `GATE_EXIT=1` at `test:program-control-durable`
  — main's declared red, **1 FAIL line in the whole run**, same assertion text
  (*"a move committed durably reaches the visible week"*).
- **Sweep: `failures=2 of 158`** = `program-control-durable` + `fixture-identity`
  — **the declared set EXACTLY**. 158 is 157 + this unit's suite.
- `test:compile` **PASSED, no file regressed** (product 35, unchanged).
- New suite `test:journal-week`: **46 cells, 46 pass**, joined to the official
  chain beside its day-first sibling.

### TWELVE MUTATIONS, TWELVE REDS — AND ONE SURVIVED FIRST

Seven against the derivation (hard flag ignored; load short-circuiting on game;
easy weight moved to 1; the session/load collapse; unexplained sessions
uncounted; unanswered folded into skipped; the data-state boundary off by one).
Five against the surface (tab unregistered; a writer added to the screen; an
honest state unrendered; the tab reordered; the strip re-deriving).

**The survivor is the finding.** The tab-order cell compared three `indexOf`
results directly. `indexOf` returns **−1** when the anchor is MISSING, and −1 is
less than everything — so renaming `ProgramTab` satisfied *"Program comes before
Journal"* **vacuously**, while the tab it anchors on had vanished. The cell now
proves all three anchors present before any order is claimed; a rename and a
genuine reorder both red it.

---

## §5 A RED THAT WAS MINE, CAUGHT BY AN EXISTING GATE

The first full chain stopped **earlier than the declared set**, at
`test:legacy-census`: LR-4's `mirrorDecisionReads` detector went **71 → 72**.

The cause was mine and one line long — the screen selected `onboardingData`
straight off `useProfileStore`, i.e. off the profile **MIRROR**. The detector's
own failure text is unambiguous: *"an undeclared hit means a new violation, not a
miscount"*, and *"do not retune the number"*.

**So the violation was fixed, not the number.** The screen reads through
`useAthleteContext`, the consolidated owner the census itself names as LR-4's
destination. The declared count is untouched and this era's debt did not ratchet
up for a brand-new file.

Worth stating plainly: **nothing in my model of "what a read-only UI slice
touches" contained the legacy census.** That is the argument for the full chain
over the suites I thought were related — the same lesson day-first slice 1
learned from `profileMirrorNarrowing`, in a different gate.

---

## §6 NORTH STAR — TOWARD, AND A CONVERGENCE STEP

**Zero new stored state.** The entire slice is a derivation over inputs the app
already keeps.

Unlike day-first slice 1, this is **not merely a new window**: it converts facts
the app has stored for months and never showed anyone — per-session completion,
skip reasons, effort, soreness — into a surface, without minting a copy of any
of them. `countWeeksOfHistory` is derived from the recorded dates rather than
kept as a counter, for the same reason.

The Journal is the derive-don't-store thesis as a feature, which is what the
kickoff asked every boundary report to answer.

---

## §7 WHY THE LAW DID NOT FIRE AT AUTHORING TIME (loop-audit)

AGENTS.md carries the source-scan law in the exact words that would have
prevented §4's survivor. It did not fire because **the law is written about
counts** ("count with a word boundary", "a count is never the whole assertion"),
and my cell was an **ORDER** assertion, not a count. I read the section, applied
it to the cell that counted `<Tab.Screen` — which is why THAT cell was written
correctly — and did not recognise `indexOf` comparison as the same shape.

**Proposed compression (sighting 6, so it is offered, not deferred): the law's
subject is not counting, it is ANCHORING.** Any assertion that locates something
in source by position — `indexOf`, `slice` between two markers, "appears
before", a regex with `[\s\S]*?` between anchors — must prove every anchor was
FOUND before it claims anything about their relationship. A missing anchor
returns a value that compares fine (−1, `''`, an empty slice) and reads as a
pass. One line in AGENTS.md beside the counting half would cover both.

---

## §8 NOT COVERED

- **NO DEVICE EVIDENCE.** The strip's one-letter marks, the dot sizing, the tab
  icon and how a five-mark row scans are unverified by eye. This repo has no
  render-level test, so the surface cells read source SHAPE and the derivation
  cells read projection OUTPUT.
- **No cell mounts the screen.** The honest states are asserted by testID
  presence in source, not by rendering a component in a state that produces them.
- **The load COMPARISON is not built.** `comparisonAvailable` is asserted as a
  gate and never as a number. The rolling four-week average must derive from
  RECORDED HISTORY (past weeks can no longer be projected), and that derivation
  is its own slice — named, not started.
- **`weeksOfHistory` counts weeks with ANY recorded session**, which is a proxy
  for "weeks trained" and will over-count a week with a single logged rest day.
  Stated because the data-state schedule keys off it.
- **The exposure counts (Group 1.1), week status line, this-week's-job, and
  observation lines are NOT built** — slice 1 is the tab and the shape, not the
  whole Monday card.
- **Copy is PROPOSED and unsigned** (journal batch 13). The one-letter
  abbreviations H/M/E/G are a presentation choice of mine, not a Sam ruling.
- **Multi-workout days are read through `ResolvedDay.workout` (singular)**, the
  same input the rest of the app classifies with. A stacked double day would be
  classified on its first workout. Consistent with the app, not proven correct.
- **Depth (L13): 0.** Hand-built projection days; no athlete was walked through
  a real week.

## §9 L12 — WHAT CATCHES THE NEXT DEFECT OF THIS CLASS

The class is **a Journal sentence true of the data and false about the athlete**.
Three cells already exist against it and are the ones to extend, not replace:
the honest-absence cells ([5]), the ownership-moves-with-its-owner cell ([3]),
and the data-state boundary cells ([6]).

What is still owed when the observation lines are built: a **causation gate** over
the template module's vocabulary (`because`, `caused`, `due to`, `led to`) —
written as an anchored source scan per §7, not a count.
