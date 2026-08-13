# STATUS — seat `cap`

**One name, one file, one writer.** Started 2026-08-13, 21:16. `ls docs/STATUS_*.md`
before the first commit returned ARMS / AUDIT / COMPOSER / DESKTOP / GUNSHOW /
PACE / PATTERNS / PROGRESSION / READINESS / TERMINAL — `cap` was free.

**MY ORDER:** item 51's sibling — R-013, the exercise cap. *"maxExercises
PerStrengthSession is read at coachingEngine.ts:8846 but dies one hop later at
AIConstraints.maxExercisesPerSession. Find the seven fallback branches handing
out three rows and make them read the cap. Coordinate with composer on item 51 —
same files."*

---

## 2026-08-13 — THE ORDER'S LEVER WAS WRONG, AND SO WAS MY FIRST GUARD. THE REAL DEFECT IS THE CAP'S OWN NUMBER

### THE SEVEN BRANCHES ARE NOT WHERE THE CAP BITES — MEASURED BEFORE BUILDING

Ran all seven through the slot oracle:

| branch | day kind | rows | slots | verdict |
| --- | --- | --- | --- | --- |
| pull-only, push-only, pull-by-text | `upper_split_*` | 3 | **3** | **COVERS — 3 is CORRECT** |
| hinge-by-text | `lower` | 3 | 5 | short, duplicates `hinge` |
| squat-by-text | `lower` | 3 | 5 | short |
| catch-all | `upper_full` | 3 | 5 | short |
| full-body-by-text | — | 3 | — | no ladder classified |

**Three of the seven are the right size** — an upper SPLIT ladder has exactly
three slots. **And all seven sit UNDER the cap**, so making them "read the cap"
would have changed nothing: a maximum cannot bite a session below it. **What they
are short of is SLOT COVERAGE — R-014, `composer`'s item 51, not mine.** Reported
rather than absorbed.

### ⚠⚠ AND MY OWN FIRST CENSUS MANUFACTURED THREE DEFECTS

I shipped `4e9065f0` with a ceiling of **3** — three sessions "over the cap of 6".
**All three were SEVEN-row days, and seven is what Sam authored.** His words,
Bible `:122`, which R-087 restates as unmoved:

> *"I wouldn't stack lower body strength (say **6-7 exercises**) with upper body
> strength (6-7 exercises)… I'd prefer to just make that a full body day i.e.
> **full body strength and 7 exercises**."*

**So I banked three lawful sessions as debt.** Pinning a defect is a known failure
here; **pinning a NON-defect is worse — paying it down would have meant breaking
his own prescription.** Corrected in the same session: the census now judges
against his authored 7 and reports **0 of 43**, ceiling **0**.

**WHAT CAUGHT IT WAS R-087 LANDING MID-UNIT** — a ruling made three commits
before I read it. **The world moved under my conclusion again**, and the only
reason it was caught is that the ruling was in the registry where a grep finds it.

### THE REAL FINDING: THE CAP IS ONE LOW, AND NOTHING EVER SAID SO

`maxExercisesPerStrengthSession` is **6**. Sam authored **6-7, and 7 for a full
body day**. **The number in the code was never authored either** — which is the
exact defect R-013 abolished the beginner's 3 for. **An unenforced number is
never wrong out loud**, and this one has been wrong since it was written.

**NOT CHANGED BY ME.** Moving Sam's number is a product-law edit. **Reported,
with the cell printing an `⚠ AWAITING SAM` banner every run.**

### WHAT LANDED

`test:exercise-cap`, 6/6, wired into `test:bible` beside `test:slot-coverage`.
- The cap is **read from the policy, per world** — never a literal, so a second
  representation of Sam's number cannot drift.
- **It does NOT trim.** The over-size sessions were the bodyweight athlete
  carrying appended barbell lifts; cutting the 7th row would drop one barbell
  lift, keep the rest, and turn a visible equipment defect into a lawful-looking
  six-row session. **Fix the layer that explains the class.**
- **The gap cell is a RATCHET, not a red, for one stated reason:** it sits in
  `test:bible`, and reddening every seat's chain over a number Sam settles in one
  word costs more than it buys. **It cannot widen silently.**

**MUTATION-PROVEN, four mutants, backups restored from my own copies
(`trainingAgePolicy` md5 `d1cadecd…` identical, 0 occurrences of `MUTANT`):**

| mutant | result |
| --- | --- |
| `maxExercisesPerStrengthSession: 3` back on `NEW_ATHLETE_POLICY` | abolition cell **FAILS**, and the census caught 3 beginner sessions — the **per-world** cap is what makes the second half bite |
| authored max 7 → 6 | census cell **FAILS** |
| gap ceiling 1 → 0 | gap cell **FAILS** |
| over-cap ceiling 3 → 2 (against the first version) | census cell **FAILS** |

**BLAST RADIUS:** `exercise-cap` 6/6, `rules-kernel` 122/0, `slot-coverage`
77/77, `main-lift-pattern` 23/23, **`test:compile` PASSED**. `test:ladder-wide`
4/5 is pre-existing — `composer` attributes it to `cf77855f`, and **their note
says that commit edits `sessionSlotCoverage.ts`; it does not** (it edits
`exerciseEquipmentRequirement.ts` and `exercisePoolsStrength.ts`). The
attribution is right, the filename is not — flagged so nobody opens the wrong
file.

**COORDINATION WITH `composer`:** read `docs/STATUS_COMPOSER.md` first; they are
on item 61, and item 51's block is discharged. **I touched neither
`defaultProgram.ts` nor `sessionSlotCoverage.ts`** — the composer's files. My
unit is a census and a new file.

**A 0-byte `.git/HEAD.lock`, 635s old with no git process, was blocking every
seat again** — `STATUS_COMPOSER.md` records the same thing costing an hour.
Removed after confirming no git binary was live; backup kept.

---

## 2026-08-13, 21:35 — MY QUESTION IS LIVE, AND IT REACHED `main` INSIDE ANOTHER SEAT'S COMMIT

**The AWAITING SAM entry (cap 6 vs Sam's authored 7) is committed and intact,
with its REGISTRY-GREP.** It is not in a commit of mine.

**WHAT HAPPENED, AND IT IS THE SHARED-CHECKOUT HAZARD RUNNING BACKWARDS.**
CLAUDE.md warns that a bare commit sweeps up other agents' work. **This is the
mirror image: I wrote my entry into `docs/SEAT_INBOX.md`, and `device` then ran
a commit over that path — picking up MY uncommitted lines as part of
`1e228d9f`.** Nothing was lost or corrupted; the attribution is simply wrong.
**`git commit -- <path>` commits the FILE, not the author's lines**, and that
cuts both ways.

**THREE ATTEMPTS, THREE RACES.** Each time I checked the file was clean, wrote,
and found a foreign hunk had landed in between:

| attempt | what appeared mid-write | what I did |
| --- | --- | --- |
| 1 | `audit` un-striking an answered question | backed my edit out entirely |
| 2 | `device` claiming item 62 + their status file STAGED | waited rather than commit either |
| 3 | — | `device` committed the path and took my lines with it |

**I NEVER COMMITTED ANOTHER SEAT'S CONTENT UNDER MY NAME**, which was the thing
worth protecting, and twice I paid a full back-out to keep that true.

**THE COMPRESSION WORTH NAMING** (not built — the inbox is the seat's file and
this is the seat's call): **a shared append-only section cannot be edited safely
by N writers through whole-file commits.** Every seat racing on
`## AWAITING SAM` is writing to a file whose granularity is the whole file.
**One file per seat is already the rule for STATUS; the same argument applies to
anything N seats append to.** This is a fourth sighting of the shared-file class
today, alongside the two stale `.git` locks.

---

## 2026-08-13 — R-088 RULED AND BUILT. TWO CLAUSES LANDED, ONE DELIBERATELY NOT

**Sam ruled `3e5bd0c6`'s subject in answer to this seat:** *"7 strength exercises
can be a cap - but the mobility pairings dont count at all towards the cap… the
mobility portion does not count so 7 is the max the app should set and a user
should be able to add as many of their own things on top of it as they choose"*.

| clause | state |
| --- | --- |
| **1. The number is 7** | **BUILT** — `trainingAgePolicy` 6 → 7. The census gap cell is an EQUALITY now, ceiling 0. |
| **2. It counts STRENGTH rows only** | **BUILT** — `exerciseBudgetRows` stops delegating to `countingRows` and excludes `prehab`. `mobility` was already exempt via R-015's own rule 5. |
| **3. It binds the app, not the athlete** | **NOT BUILT, DELIBERATELY** — see below. |

**CLAUSE 3 IS NOT A GAP I LEFT, IT IS ONE I REFUSED TO FILL WRONG.** Nothing
enforces a cap anywhere, so **there is no refusal to exempt**; and no row carries
an athlete-added marker, so **there is nothing to exempt it BY.** Building a
provenance field before its reader exists is the dead-weight this repo bans —
`canOverride` written nine times, read zero. **The obligation is written into
`sessionRowCounting`'s docstring, where whoever builds the enforcement will be
standing.**

**R-015 NOT REBUILT**, as ordered. The pairing exists; R-088 only says it is free
of the cap.

### THE TWO FENCES SPLIT, AND THE OLD EXPORT HAD PREDICTED THE DAY

`exerciseBudgetRows` was documented as *"deliberately the SAME predicate as the
taxonomy's… a separate export only so the cap's eventual enforcement site reads
as what it is."* **R-088 made them different questions and that separate export
is why it cost one function.** §18's fence is untouched — moving
`ROLES_EXEMPT_FROM_COUNTING` is the counting change its own comment demands a
golden diff for.

### ⚠ TWO THINGS CAUGHT ME, BOTH BY GUARDS I DID NOT WRITE

1. **My constant name tripped a law.** `ROLES_EXEMPT_FROM_THE_EXERCISE_CAP`
   matched the `EXERCISE_` regex in *"the choke point classifies nothing"* — a
   guard that stops name-based classification creeping into the row fence.
   **RENAMED to `ROLES_EXEMPT_FROM_THE_CAP` rather than weaken the guard.** The
   guard was right and my name was noise.
2. **A cell survived the repeal GREEN.** `sessionRowCountingTests` asserted the
   two fences were identical. R-088 repealed that, and the cell stayed green
   **because its fixture holds no `prehab` row** — the green-and-empty shape this
   repo keeps finding. Re-aimed, plus two cells asserting the split itself.

### WHY CLAUSE 2's FIXTURE IS SYNTHETIC

**Measured, same 5 worlds x 3 weeks: role histogram `UNSET 178, conditioning 19,
power 4` — ZERO `prehab`, ZERO `mobility`.** Generation stamps almost no roles,
so the real corpus **cannot** exercise this rule. A cell waiting for it would be
green and empty forever. **That is also a finding in its own right: the pairing
R-015 built does not appear in this generated corpus at all.** Not chased — it is
the composer's ground.

**MUTATION-PROVEN:** fence stops excluding `prehab` → 3 cells FAIL; cap back to 6
→ 2 cells FAIL and the drift banner fires. Backups restored from my own copies.

**BLAST RADIUS:** `exercise-cap` 12/12, `row-counting` 45/45, `rules-kernel`
122/0, `slot-coverage` 77/77, `main-lift-pattern` 23/23, **`test:compile`
PASSED**. `section18-planner` 35/36 is **pre-existing** — controlled in a clean
worktree at HEAD, byte-identical.
