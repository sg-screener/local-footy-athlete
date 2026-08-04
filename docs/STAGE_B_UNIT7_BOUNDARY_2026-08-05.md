# Stage B stage 2 — unit 7 + the day-close rulings: boundary report

Branch `feat/stage-b-stage2`, UNMERGED. `main` untouched at `936bbf7`.

**`test:bible` EXIT 0 END TO END** — 138 links started, the last link reached
(`test:stage-b-generation-differential` 3/3), zero failure lines anywhere in the
run. `test:compile` PASS inside that chain, no file regressed.

The eight newly chained suites, as they read INSIDE that run:

| suite | in the run |
|---|---|
| `test:visible-program-projection` | 83 / 0 |
| `test:weekly-plan-display` | 62 / 0 |
| `test:conditioning-identity` | 63 / 0 |
| `test:standalone-conditioning-ownership` | 57 / 0 |
| `test:workout-canonicalisation` | 41 / 0 |
| `test:deload-week` | 42 passed, **3 declared gap(s)**, 0 failed |
| `test:modality-swap` | 199 / 0 |
| `test:coach-revision-proposal-behavior` | 34 / 0 |

**A note on how that number was obtained, because it nearly was not.** The
first full run reported exit 0 to the harness and was NOT green: the shell
line was `npm run test:bible > log; echo EXIT=$?; tail ...`, so the code
captured was `tail`'s. The bible had in fact exited 1 at its FIRST link. The
second run was killed mid-differential by a background timeout. The third was
launched detached with its exit code written to a file, which is the only
form of this that survives both traps. *A green gate is a claim* — and so is
the exit code you think you read.

| # | What | Commit |
|---|---|---|
| — | Sam's day-close rulings + the SIGNED Mixed map row, as authored | `70895b3` |
| 8 | The Mixed — rotating row wired into the modality-map owner | `f4501fa` |
| 9 | D-2 filed as coach-rebuild scope; ceiling 30 ratified | `48e6fae` |
| 7a | Two defects the unchained suites were holding | `4481bbd` |
| 7b | Eight suites chained, totals-or-red, one gap declared | `8da1943` |
| 7c | The bible expectation edited to match the regression, corrected | `28aa170` |
| 7d | The differential golden regenerated, reconciled line by line | `99d2ac9` |

---

## 1. The convergence question, answered first

> **Does this move the app toward "store decisions, derive everything"?**

**Toward, and the recurring shape of this whole stage repeated twice more: a
DERIVATION standing where a DECISION already existed.**

- **The rotating session** had no authored answer, so any code that filled the
  gap would have been inventing one — a union of machine rows, a first-machine
  pick, a default. Sam authored the decision instead. One more signed row, one
  less place for code to decide.
- **The recovery session** was already marked recovery — `optional_recovery_aerobic`,
  tier optional, stress low — and then asked selection for `aerobic_base` and
  got a 50-minute continuous run. The decision existed; two layers below it
  re-derived the answer from something else (a demand category that had lost
  the distinction, and a regex reading "flush" out of athlete-visible copy).
  Both now read the decision.
- **The out-of-block override** is the same class inverted: a stored athlete
  decision being DROPPED by a derivation guard that had no business seeing it.

**Nothing stored was added.** `recovery_flush` is a selection-module word only;
the persisted `Workout['conditioningCategory']` union is untouched, so no §18
counter and no coach path changed meaning.

## 2. What landed

### The Mixed — rotating row (Sam's ruling 3a, `f4501fa`)

The switchover pinned the gap in the gate's own words: four machine rows, and a
session that rotates machines by design had none. Sam authored the fifth row,
whole-body. Wiring:

- `MODALITY_MUSCLE_MAP` gains it verbatim from the sheet — a map row like any
  other, looked up, never composed.
- `MuscleMapModality` is a named type now (the machines plus `mixed`), so the
  map's key vocabulary stops being spelled as a subtraction from the template
  vocabulary, which never had a word for a rotating rendering.
- **The owner takes both spellings at its door.** A generated session says
  `ConditioningOption.modality` (`running`, no `air_bike`); the template
  vocabulary spells them the other way. One normalisation, once, at the door.
  The old pin could only be written as `modality: 'mixed' as never` — and a pin
  that needs a cast to compile is a pin no caller could ever have reached.
- **A build-failing bind**: every rendering `ConditioningOption.modality` can
  carry must key a map row or be the run spelling that defers. Mutation-tested
  — adding `'swim'` to that union fails `test:compile` with 2 new errors in
  `conditioningMuscleMetadata.ts` against a baseline of 0.

`test:conditioning-muscle` 31/31 (was 28). The flipped cell holds the ruling;
a new cell holds the ruling's OTHER half — that the rotating answer is
authored, not composed — and fails if the whole-body row ever becomes a union
of the machine rows.

### D-2 and the ceiling (Sam's rulings 1 and 2, `48e6fae`)

`LEGACY_CENSUS_FOUNDING_UNIT_COUNT = 30` was already the number; it lacked a
ruling. It has one now, in Sam's words, above the constant.

D-2 — the hydration-repair in-place branch — is filed as **scope on LR-6**, the
coach-rebuild unit, carrying the probe's measurements AND the three things the
probe could not settle, so no future rebuild can read the filing as a
clearance. A new `test:legacy-census` cell fails if LR-6 stops carrying that
scope: "ratcheted, not remembered" taken literally, and the precise mechanism
whose absence lost the founding LR-26 for six days.

**The judgement, stated because it is one.** The ledger sits at exactly 30 of a
ceiling ratified three paragraphs earlier in the same document, so an LR-31
would have needed a raise Sam did not give — and direction 4 exists so that
raise cannot be quiet bookkeeping done while filing something else. If he meant
a standalone unit, the ceiling is his to raise and the entry is a small
follow-up; the scope text on LR-6 already says everything an entry would say.
**Parked for Sam (question 1 below).**

### Unit 7 — the two defects (`4481bbd`)

**An override outside the block stopped rendering.** Bisected to stage 1's
precedence unification (`c3639fe`). That commit moved the date override from
Priority 1 — above the calendar mark — down into composed content, which is
right and is what Sam's own device note asked for. But Priority 1 also sat
above the "no block data → nothing to resolve" guard, and the move took it
below. From that commit, an override on any date outside
`[program.startDate, program.endDate]` resolved to nothing: the whole week came
back `(no workout)`, source `none`.

Fixed by composing and constraining first, then answering from the date
override BEFORE the block guard. The guard governs TEMPLATE derivation; an
override is stored content for that date and needs no block. Marks and removal
constraints still outrank it — both resolve above that line — so Task C's
ordering is untouched and `test:day-precedence-ownership` stays 6/6 including
its uncontested-override counter-cell.

**A recovery session stopped selecting recovery work.** `demandCategoryFor` is
the fix: one owner, in the module that already declares which of Sam's tabs
serves which demand. A §18 recovery role asks the Flush tab. And the identity
projector reads the role instead of regexing "flush" out of row copy —
otherwise an authored flush template carrying no such word ('Nasal-Paced Easy')
reads as generic aerobic.

What hid it is worth naming: the retired code-authored name, 'Aerobic Flush',
said *recovery* in a word while the typed demand said *aerobic base*. The
authored names carry no such word, so the mismatch surfaced. Same class as the
switchover's two unpredicted movements.

### The expectation that had been edited to match it (`28aa170`)

`test:bible` stopped at its FIRST link on the fix: slice 1,
ALL-COND-SECTION-01, "LOSS Continuous Aerobic Run — unauthorised". **The
expectation's own comment turned out to be the finding.** It was edited during
the switchover, in these words: *'the composed "Easy Aerobic Flush (2 x 10min
easy Mixed Erg Block)" vocabulary retired'.* The row this scenario used to
produce was a FLUSH. The switchover made it a steady aerobic run and the
expectation was moved to match — the regression recorded as the new truth.

Corrected to the authored 'Short Flush', with the reasoning written at the cell
so the next reader does not have to reconstruct which of the two edits was the
honest one. Slice 1: 71/71 scenarios, 72/72 rules.

**Three suites carried this one defect, and only one of them was in a gate —
the one whose expectation had been edited.** That is the sharpest single lesson
of this unit, and it is why §5 leads with the chaining rather than with any
typed field.

### The differential, reconciled before regenerating (`99d2ac9`)

The chain's last link fired on the same movement. Reconciled first, as its own
instruction requires: the diff is **96 lines in 48 hunks and every one is the
same substitution** in exactly three field shapes (`name`, `title`, the
row-name list). Taking the unique set of changed lines on each side gives one
old value and one new value and nothing else — no dose numbers, no counts, no
structure, no other scenario.

What the athlete actually gets, since the snapshot only carries the name (both
templates are "1 block continuous", so sets/reps/rest are identical):

| | was | now |
|---|---|---|
| work | 30–50 min continuous | 10–20 min continuous easy |
| intensity | 65–80% MAS, conversational | very easy, 3–4/10 |
| cue | "steady the whole way" | "finish better than you started" |

— in a slot the planner had already marked optional, light and low-stress.

### Unit 7 — the chaining (`8da1943`)

Eight suites, each armed with totals-or-red, each exit 0. Three carried the
`process.exit(0)` softener that hard-overrides the arm; deleted, not worked
around. `test:totals-or-red-law` discovers 134 chain suites, 4/4.

Suite migrations, all onto shapes the app actually writes:

- The power cells built a `powerBlock` — a field `domain.ts` calls "LEGACY
  STORED SHAPE — read only ... nothing writes this" — and read it back through
  `powerRows()`, the row-era owner. They could only ever be red. Migrated to
  `role: 'power'` rows.
- `[16b]` asserted that cooked fatigue DELETES power and collapses an all-hard
  day to Rest. Sam retired exactly that on 2026-07-27, in words recorded at
  `buildFatigueConstraint`: "FATIGUE NEVER BLOCKS AN EXPOSURE TYPE ... that is
  a session REMOVAL, which the readiness law forbids." The cells are INVERTED
  onto the law that replaced them, not relaxed.
- The canonicalisation cell used 'Chest Supported Row' at 2×10-12 to stand for
  a "minor balancing row". It is a registry ANCHOR, and Sam's deload law says
  "A ROW'S MAIN-LIFT IDENTITY IS NOT ITS DOSE". 'Face Pull' is a registry pull
  accessory, so the cell now exercises the exemption it is named for — plus a
  new counter-cell that a trimmed pull ANCHOR on a push day is still drift, so
  the exemption cannot widen unnoticed.
- The deload profile predated the equipment door and the suite had been
  CRASHING at module scope ever since.

## 3. THE DEFECT THIS UNIT FOUND AND DID NOT FIX

**Off-season block 2's deload week reshapes the build week instead of shrinking
it.** Measured on the suite's own fixture:

| | week 3 (build) | week 4 (deload) |
|---|---|---|
| day 2 | Lower Body Strength — Front Squat ×3, Trap Bar Deadlift ×3 | Lower Hinge — **no anchor lift at all** |
| day 4 | Upper Pull — Chin-Ups ×3, Chest Supported Row ×3 | Lower Squat — Back Squat ×3 |
| day 5 | Lower Squat — Front Squat ×3 | Upper Pull — Chin-Ups ×2, Chest Supported Row ×3 |

Sam's deload law is "same week, same days; the structure doesn't change, the
work shrinks", and the same law forbids halving from ever removing a lift.
Block 1 is clean — its weeks 3 and 4 are structurally identical — so this is
specific to a block generated from a `previousProgram`.

It needs a ruling before code, so it is DECLARED rather than fixed or hidden,
through the mechanism lifted verbatim from `surfaceAgreementTests`: the
assertion is unchanged, a stale declaration fails the suite, and the totals line
reads `42 passed, 3 declared gap(s), 0 failed`.

## 4. NOT COVERED

- **No device pass.** L10 stands open for stages 1+2 together — the merge gate,
  and the next milestone. Not started; the tap list is Sam's.
- **The deload-week defect above is not fixed**, by choice. Declared.
- **`coachRevisionProposalTests` is not chained.** It crashes identically on
  `main` and here: `accessories_pump` builds a null section and
  `templateIdFromRevisedWorkout` dereferences it. Making that template produce
  a section changes what the coach path DECIDES; adding a null guard is
  literally on the stop-patching red-flag list. **LR-6 holds it.**
- **The coach path is otherwise untouched.** The five coach dose pins stay live.
- **D-2's subject is untouched** — no redirect, no reorder, no implementation,
  per the ruling.
- **Derive-at-render still has no caller.** Sam's ruling closed the mixed gap by
  authorship; no surface renders muscles yet, and building one would have been
  inventing it.
- **`Wrist` was not added** to the muscle vocabulary. Still Sam's to rule.
- **No mutation testing** beyond the one bind above.
- **THE DIFFERENTIAL SNAPSHOT DOES NOT CARRY DOSES.** It projects
  `sets / repsMin / repsMax / restSeconds` and NOT the row's `notes`, which is
  where every authored dose string lives. A change that altered a dose while
  keeping the name and the block shape would pass it silently — and this unit's
  own movement is a live example: the name moved, the block shape did not, and
  the real difference (30–50 min at 65–80% MAS → 10–20 min very easy) is
  invisible in the golden. Not widened here, because widening the snapshot
  mid-unit rewrites the baseline the unit is measured against. **This is the
  most valuable thing in this section.**
- **The out-of-block override fix has no walker cell.** The walker cannot
  currently author an override outside the block, so the regression cell lives
  in `visibleProgramProjectionTests` (fixture-level) rather than in an acted
  world. Named honestly: L13 says a state reachable by an athlete but not by
  the walker is a defect in the harness.

## 5. What catches the next defect of this class (L12)

The class, restated: **a decision exists, and a layer below it re-derives the
answer from something else — a name, a category that lost the distinction, or a
guard that cannot see it.**

- **Eight suites are now in the gate.** Every one of the things this unit found
  had been sitting in a suite nobody ran. That is the single biggest change:
  the class was already caught, just not *watched*.
- **And the sharper half of that.** The one chained cell that DID see the
  recovery defect had its expectation edited to match the new output. So
  chaining alone is not the whole remedy: **when a gate goes red inside a
  switchover, the question is which side moved.** The corrected cell now
  carries that reasoning in its own comment, which is the only durable form —
  a `git blame` does not say whether an expectation edit was a correction or a
  capitulation, and the comment does.
- **`test:totals-or-red-law` now covers 134 suites**, and three softeners that
  could have let a chained suite exit 0 half-run are gone.
- **The declared-gap mechanism is now in a second suite**, with its
  stale-declaration cell. A known defect can be carried in the gate without
  being able to rot into silence.
- **The build-failing bind** on `ConditioningOption.modality` means the next
  rendering word cannot arrive without the SHEET answering for it.
- **The typed-first reads** — `demandCategoryFor`, the identity projector's role
  branch — each sit exactly where a sniff used to be, which is the same
  remedy the switchover applied to its two unpredicted movements. The pattern is
  now consistent enough to be a rule: *when a name stops carrying a decision,
  find the decision and read it, do not widen the regex.*
- **A gate's exit code is a claim too.** The first full run of this unit
  reported success and had failed at its first link, because the shell captured
  `tail`'s exit code instead of the bible's. The remedy that is now in the
  scratchpad recipe: run the chain DETACHED, write `EXIT=$?` to a file as the
  very next command in the same shell, and read that file. Nothing else
  survives both a mis-captured code and a background kill.

## 6. PARKED FOR SAM

1. **D-2's filing.** Filed as scope on LR-6 rather than as an LR-31, because
   the ceiling of 30 was ratified in the same document and the ledger is at
   30 of 30. If you meant a standalone unit, say so and the ceiling rises with
   it.
2. **The off-season block-2 deload defect** (§3). Needs a ruling: should a
   deload week be forbidden from changing the day layout and from dropping an
   anchor lift, or is block-2 re-planning a deliberate re-plan?
3. **`coachRevisionProposalTests`** — the `accessories_pump` null section. Held
   by LR-6; confirm it waits for the coach rebuild.
4. **Should the differential snapshot carry row `notes`?** It is the one gate
   that would have caught this unit's movement as a DOSE change rather than a
   name change, and today it cannot see doses at all. Widening it is a small
   unit with a golden regeneration, and it is worth doing before the next
   conditioning change — but it rewrites the baseline, so it wants your word
   on timing.
5. The five questions from the switchover boundary report are still open, and
   so are the muscle-sheet ones (`Wrist`, the Two-Minute Repeats file citation).
