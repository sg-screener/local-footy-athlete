# STATUS — seat `arms`

**One name, one file, one writer.** Started 2026-08-13. `ls docs/STATUS_*.md`
before the first commit returned AUDIT / DESKTOP / PACE / PROGRESSION /
TERMINAL — `arms` was free.

**MY ORDER, from Sam directly:** R-052 (the Gunshow composition) and R-054 (the
seven strength sessions) are signed and unenforced — *"Sam's Gunshow is 2 biceps
+ 2 triceps + 2 pump delts at 2-3 sets; the app ships a different shape. And the
athlete's own door reaches only four of his seven strength sessions."*

---

## 2026-08-13 — BOTH ROWS MEASURED. ONE WAS ALREADY HELD, ONE WAS NOT, AND THE HALF NOBODY HAD READ WAS THE DOSE

**I did not take either row's status on trust in either direction.** The desktop
corrected R-052 to `BUILT` earlier today after finding two enforcers a search had
missed, and its own note says the other ten `UNENFORCED` rows were left alone
because each names a real gap on its face. **R-054 is one of those ten, and it is
right.** So the two rows Sam named needed opposite work, and only measuring says
which.

### R-052 — THE COMPOSITION IS HELD. THE DOSE WAS NOT, AND THE SHRINK CELL COULD NOT FAIL

**THE 2 + 2 + 2 IS REAL AND MUTATION-PROVEN.** `SESSION_SLOTS.arms_pump`
(`utils/sessionBuilder.ts:171`) is literally `{biceps 2}, {triceps 2},
{delts 2}`. Reverting it to the old `2 + 2 + 1 delt + 1 upper_back_pump` reds
**three** cells across two suites:

| cell | suite | under the old shape |
| --- | --- | --- |
| A1. a Gunshow is 2 biceps + 2 triceps + 2 shoulder | `test:mobility-accessory-doors` | **FAIL** |
| A2. NO CROSS-FAMILY TOP-UPS | same | **FAIL** |
| R1. the G-1 Gunshow is Sam's SIGNED 2+2+2 | `test:optional-topup` | **FAIL** |

**So the desktop's correction stands, and Sam's "the app ships a different shape"
is not true of the exercise counts.** What it IS true of is the clause beside
them, which is the one he put in his own sentence: **"at 2-3 sets".**

**NOTHING IN THE REPO HAD EVER READ `prescribedSets` ON THIS SESSION.** §20.3 is
*"2 biceps + 2 triceps + 2 shoulder, 2-3 sets each"*. A1/A2/R1 assert the six
exercises and which pools they came from; the dose was unheld end to end. It
ships correctly today only because all sixteen signed rows happen to be authored
at 2 or 3 — **an accident of the data, with no gate under it.**

**MEASURED, through the real builder, four kits × three dates:**

| kit | rows | sets |
| --- | --- | --- |
| commercial gym | **6** — 2 biceps / 2 triceps / 2 delts | all 2 or 3 |
| dumbbells only | **5** | all 2 or 3 |
| bands only | **2** | all 3 |
| **bodyweight only** | **0** | — |

**AND A3 — the cell that carried "shrink, never pad" — CANNOT FAIL.** It reads
POOL SIZES and never builds a session. It stayed **green** through both mutations
above, including one that padded a thin kit straight back to six rows. *A bind
that cannot fail is not holding the law* — the shape this repo keeps finding.

**BUILT, and both mutation-proven:**
- **`A4. every Gunshow row carries Sam's AUTHORED 2-3 sets`** — asserts the band
  on the sixteen signed rows AND that the built session carries the pool's own
  number, so neither a bad authoring nor a rewrite in between can pass. Mutant:
  author Hammer Curl at 4 sets → **FAIL**.
- **`A5. a thin kit really does shrink it — built, not inferred`** — drives the
  athlete's door on a dumbbells-only kit and reads what comes back: fewer than
  six rows, every row inside the signed sixteen, nothing repeated. Mutant: make
  `pickFromPool` fall back to the unfiltered pool when the filtered one is short
  (i.e. PAD) → **FAIL**, while A3 stayed green beside it.

`test:mobility-accessory-doors` **28 → 30**.

**⚠ ONE FINDING I AM NOT BUILDING, BECAUSE IT BELONGS TO AN ITEM WITH A LIVE
OWNER.** A **bodyweight-only athlete gets a Gunshow with ZERO rows** — an empty
session card, silently. Under §20.3 alone that is lawful (shrink, never pad, and
there is nothing to shrink to). Under **R-083, ruled by Sam today** — *the app
must SAY the kit cannot train it rather than quietly shrink* — an empty card is
the extreme case of exactly what he ruled against. **R-083 is SEAT_INBOX item 48,
`OWNED BY terminal`, so I walked past it and did not mark it.** Recorded here so
it is not re-found from scratch. **I did NOT pin the zero-row behaviour green in
a cell** — pinning a defect is how it becomes permanent.

### R-054 — GENUINELY UNENFORCED, EXACTLY AS ITS ROW SAYS

**THE SEVEN AND THE THREE DOORS ARE BUILT** — `data/strengthSessionVariants.ts`
authors the set once, `coachRevisionTemplates` derives one template per variant,
and `test:strength-variants` was **15/0** before I touched it.

**AND THE SUITE COULD NOT SEE THE ATHLETE'S DOOR.** Measured: revert
`CATEGORY_TEMPLATE_MATCH.strength_lower` (`utils/planChangeProducer.ts:185`) to
the hand-written `t.templateId === 'strength_lower'` — **the original defect
verbatim, the Lower Body door able to hand back one of three** — and:

| suite | under the mutation |
| --- | --- |
| `test:strength-variants` D1, D2, E2 | **all PASS** |
| `test:athlete-door-matrix` | 433/0, **PASS** |
| `test:session-type-charter` | 41/0, **PASS** |
| `test:optional-topup`, `test:mobility-accessory-doors` | **PASS** |
| `test:session-list-combinations` | 5/1 — **failure text IDENTICAL with and without the mutation** (`[2] every declared coordinate that was reached still disagrees`), so pre-existing, not mine |

**Nothing in the repo reds.** D1 and D2 ask `strengthVariantsForDoor`, which is
the authored set answering a question about itself. **A partition asserted only
in the file that declares it is a document, not a gate** — and that is precisely
what R-054's row said: *"no suite named for the door's coverage of all seven."*

**BUILT:** **`D3. THE ATHLETE'S OWN DOOR HANDS BACK ALL SEVEN — driven, not
read`**. It drives `pickTemplateForCategory`, the function the athlete's tap
actually lands on (*"Lower body"* → `add_category` → `resolveTemplatePlanChange`
→ here), sweeping 90 real dates because the resolution is date-seeded, and
asserts each door's reachable set equals the variants it owns and that the union
is seven. **Mutant: the revert above → FAIL, naming it in its own words** —
*the "strength_lower" door hands back ["strength_lower"] over 90 days, and the
seven say it owns ["strength_lower","strength_lower_hinge","strength_lower_squat"]*.

---

## ⚠ THE TREE MOVED UNDER ME TWICE WHILE I MEASURED, AND ONE OF MY OWN CONCLUSIONS WAS WRONG BECAUSE OF IT

**Recorded because the next seat will hit it and should not spend the hour I
did.** At session start `git status` listed 6 modified files. Partway through,
another seat's live edits appeared in `utils/coachingEngine.ts`,
`utils/exerciseScorer.ts`, `utils/progressionRules.ts`, `utils/sessionResolver.ts`
and a new `rules/mainLiftPatternLaw.ts` — **and `coachingEngine.ts` was broken
mid-write**, first `ReferenceError: readiness is not defined` (`:1909`), then
`capacity is not defined` (`:1035`). **Every suite that generates a program dies
at that line**, which is the E-section of `test:strength-variants` and the ledger
cells of `test:mobility-accessory-doors`.

**I briefly concluded my own A5 had leaked profile-store state into a later cell,
because the door suite went 30/0 → 29/1 with `D2. NON-VACUITY` red.** A control
run of the COMMITTED suite came back 28/0, which looked like proof it was mine.
**It was not** — the break landed between those two runs. **A control is only a
control if it sees the same tree**, and in this checkout that has to be checked,
not assumed. I hardened A5's restore anyway (it now re-seeds the header's exact
literal rather than a captured `getState()`), because the weaker form was worth
removing whether or not it was the cause.

**BACKUPS BEFORE EVERY MUTATION, RESTORED FROM MY OWN COPY**, never
`git checkout` — `sessionBuilder.ts`, `exercisePools.ts` and
`planChangeProducer.ts` each verified byte-identical to their backup afterwards.
Probe file `src/__scratch__/armsSeatGunshowProbe.ts` deleted after measuring.
