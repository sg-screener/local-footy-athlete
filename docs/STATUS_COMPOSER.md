# COMPOSER — this seat's own status file. ONE WRITER: this seat.

**NAMED 2026-08-13.** Sam sent this seat in on *"patterns → Items 51 and 52.
Sessions composed by pattern, and no two heavy lifts of one pattern."*

**⚠ `patterns` WAS ALREADY TAKEN, BY A SESSION RUNNING AT THE SAME TIME.**
`ls docs/STATUS_*.md` showed `docs/STATUS_PATTERNS.md` already written and
already committed against, and commit `7e0a68a9` is stamped `Agent: patterns` by
that other session — **which is exactly the collision CLAUDE.md's naming rule
exists to prevent, arriving for the second time in one day.** So this seat took
a free name for what it actually does: **it COMPOSES — it makes a session cover
the ladder, where the other seat MEASURES how many do not.** The two halves are
complementary and neither was wasted.

**EVERY COMMIT FROM THIS SEAT ENDS `Agent: composer`.**

---

## ITEM 52 (R-070) — CLOSED, AND THE ONLY THING LEFT WAS THE ROW

The law itself shipped earlier as `70e91a0f` (oracle
`src/rules/mainLiftPatternLaw.ts`, fence in `exerciseScorer`, 23 cells in
`test:main-lift-pattern`, in the `test:bible` chain). **The one debt outstanding
was the registry row**, which still read `UNENFORCED` while the enforcer was
green.

Flipped to `BUILT 70e91a0f`, with the row's own two false examples struck rather
than deleted (RDLs + Hip Thrusts is one heavy hinge and one ACCESSORY hinge;
Overhead Press + Incline DB Bench is vertical + horizontal, which is Sam's own
upper ladder). The third example stands and is now labelled at its line.
`UNENFORCED_CEILING` was AT its lower bound, so paying the debt without lowering
the ceiling would have reddened the ratchet — lowered in the same edit.

**⚠ THE FILE WAS SHARED AT COMMIT TIME AND ANOTHER SEAT CARRIED IT IN.** The
`readiness` seat was mid-flight in `RULINGS_REGISTRY.md` and
`rulingRegistryTests.ts`, building its own comment directly on top of this
seat's ceiling note. Rather than race a shared file, this seat left both edits in
the tree and they landed inside `readiness`'s commit. **Verified afterwards:**
row reads `BUILT 70e91a0f`, `[2] the UNENFORCED ruling count only falls` is
green, ceiling has since fallen to 4. Nothing was lost and nothing was swept —
but the attribution for that one flip lives in another seat's commit, and this
note is the only place that says so.

---

## ITEM 51 (R-014 + R-013) — THE COMPOSER, IN TWO COMMITS

**`da733e30` — the composer. `4c22d4cf` — the instrument.** Split deliberately:
one lowers a numerator, the other grows a denominator, and a widening that rides
in on a narrowing leaves neither number readable afterwards.

### THE THREE NUMBERS, ALL TAKEN IN A FRESH WORKTREE AT A REAL COMMIT

| tree | deficient / laddered | shapes |
| --- | --- | --- |
| before | 50 / 216 | 5 |
| + composer + pool split | **36 / 216** | **3** |
| + instrument | 88 / **318** | 6 |

### WHAT THE COMPOSER FOUND — TWO DEFECTS, ONE UNDOING THE OTHER

1. **`Lower Body Strength` is the commonest strength day the app builds — 20 of
   94 in a 6-world x 4-week sweep — and every one shipped three rows:**
   `Back Squat | Deadlift | Pallof Press`. A squat, a hinge, a core row, and **no
   single-leg work of either kind**, on the day named after the rule. The
   squat-LED and hinge-LED branches had been brought to his five slots earlier;
   **naming BOTH lower patterns had bought FEWER rows than naming one.**

2. **AND THE ROW WENT STRAIGHT BACK OUT.** `Single-Leg RDL` shared a
   (slot, role) pair with `Hip Thrusts`, `Kettlebell Swings` and `Glute Bridge`
   — three BILATERAL hinges — so `applyPoolRotation` swapped the single-leg hip
   lift for a second heavy hinge. **20 days missing `single_leg_hip` and 22
   reporting a doubled `hinge` — one defect wearing two numbers.** Fixing the
   fallbacks alone moved 31 -> 28; the pool split took it to 16 on that corpus.
   **This is R-080 landing on its sibling slot** — R-080 split the SQUAT
   accessory pool for the identical reason and the hinge pool one slot over was
   never looked at.

### WHAT THE INSTRUMENT FOUND — THE DECLARED GAP UNDER-COUNTED ITSELF

`slotDayKindFor` returned NOTHING for `Lower Body Strength`, because the text
owner reads pattern WORDS out of prose and that name is a REGION. **46 of 94
strength days answered to no ladder.** The two cells that recorded this gap
deliberately named `Upper Body Strength` and `Full Body Strength` and **never
mentioned the biggest one, which outnumbers them 5 to 1.** A declared gap is a
claim too, and that one had been reasoned about rather than measured.

Fixed by delegation, not by the regex the declaration refused: those three
strings are rows in the AUTHORED SET, each stating its own `plannedPatterns`.

### THREE MUTANTS, AND ONE EXPOSED A HOLE IN THIS SEAT'S OWN CELLS

| mutation | result |
| --- | --- |
| collapse the hinge pool groups | 2 table cells red — **and the generated census stayed GREEN** |
| revert the combined-lower ladder | narrow census 1 -> 3, ratchet reds |
| blind the authored day-kind lookup | 2 cells red, corpus 7 -> 5 |
| revert the instrument, keep the raised ceiling | **breadth floor AND lower bound both red** |

**The first one is the lesson.** A structural assertion about a table is not an
assertion about what the athlete is handed: the three-world census never reaches
the rotation index that spends the slot. `[7b]` now drives the real rotation over
a full block and dies on that mutant too.

---

## WHAT IS NOT COVERED — named so nobody re-derives it

- **126 of the 216 laddered days STILL ship three rows.** They do not come
  through the branches this seat touched. **That is the next composer unit and
  it is the biggest one left on R-014.**
- **The 36 that remain after the composer are the EQUIPMENT class** —
  `missing: [squat]` with a doubled `single_leg_knee`, and a bodyweight athlete
  handed a Back Squat. Separate owner, separate ratchet (`EQUIPMENT CENSUS`,
  ceiling 5).
- **Team nights miss `arm_or_shoulder`** — `Team Training + Upper Push` is
  `Overhead Press | Dips`, two rows. Team-night SIZE is its own rule and this
  seat did not touch it. **Someone should decide whether a team night answers to
  the full split ladder at all**; judging it against a ladder it is deliberately
  too short for may be the instrument's error, not the app's.
- **`Full Body Strength` answers to no ladder Sam has ruled.** Squat + push +
  pull is a MIXED day and `slotDayKindForPatterns` returns null for mixed. He has
  ruled a lower ladder and an upper ladder and never a full-body one. **4 days of
  94 are unjudged for this reason.** A cell states it as an OPEN QUESTION. **This
  is a real question for Sam and it is NOT in the registry as answered** — but it
  is not urgent enough to interrupt him for on its own.
- **R-013's own claim is still open.** The other `patterns` seat refuted
  *"`maxExercisesPerStrengthSession` has ZERO readers"* (one production reader,
  `coachingEngine.ts:8846`; the dead end is one hop later). This seat did not
  re-measure that and takes no position.
- **No simulator proof.** The law is a REFUSAL and a FILL; its athlete-visible
  proof is a leg day that now has single-leg work. Named **WORKING** — the test
  that fails if it breaks is `npm run test:ladder-wide` and
  `npm run test:slot-coverage`.

---

## THE SHARED TREE COST REAL TIME TODAY — THREE SIGHTINGS IN ONE SESSION

1. **`test:ladder-wide` reported "6 worlds built, 174 refused"** in the live
   tree. A clean worktree at the same commit reported the opposite. Another
   seat's half-saved file.
2. **The live tree said 92 of 318; the worktree at the same commit said 88.**
   Four days of difference, entirely another seat's uncommitted work.
3. **`git status` showed files appearing and disappearing between adjacent
   commands**, and `.git/index.lock` was held by another seat mid-commit.

**EVERY NUMBER IN BOTH COMMIT MESSAGES IS A WORKTREE NUMBER.** Nothing in this
seat's work was calibrated against the shared checkout, and a ratchet calibrated
against a dirty tree pins a figure the chain can never reproduce.
