# STATUS — seat `primer`

**One name, one file, one writer.** Started 2026-08-23. `ls docs/STATUS_*.md`
before the first commit: `primer` was free (ADDFLOW / ARMS / AUDIT / BASELINE /
BIBLE / BLOCKTWO / BOATS / CAP / CLUBNIGHT_BOOT / COMPOSER / CONDITIONING / CORE
/ DEMOLITION / DESKTOP / DEVICE / ELEGANCE / EQUIP / EXCLUSIONS / FINISH_* /
GUNSHOW / JOURNEY / LADDER / LAWS / ORCHESTRATOR / PACE / PATTERNS / PHONEPASS /
PRINTER / PROGRESSION / PROJECTION / READINESS / REBUILD / RESTART / RESTORE /
ROTATION / SESSIONINJURY / SESSIONUI / SHEETSHELL / SIM / TERMINAL / TRACER /
VISIBLE / VOCAB).

**MY ORDER, from Sam directly (2026-08-23):** add a Primer session — an optional
G-1-style session the athlete can add or swap in, in the Gunshow's clothes, with
a lightning bolt. Composition signed in the same message. Registered as
**R-129**.

---

## 2026-08-23 — THE AUDIT, BEFORE ANY CODE

### WHAT IS FREE, AND WHY

The optional badge, the *"This session is optional — only if you feel like it"*
line, the **Start optional session** button, the day-card part name and the whole
session screen are driven by **two typed facts**, not by a name list:

- `sessionTier: 'optional'` — `HomeScreenV2:2312` `isOptionalSession`.
- `composedOptionalKind` — `projectVisibleWeek.partHeadline` / `partBucket`
  (`part.headline.optional.<kind>`), and `sessionComponents:730`, whose trunk
  split already exempts *any* marker-carrying composed optional session.

Stamp both and the Primer inherits Gunshow's presentation with **no per-surface
edit**. Verified by reading, not assumed.

### WHAT IS NOT FREE — FIVE ITEMS

| # | thing | why |
| --- | --- | --- |
| 1 | `SESSION_TYPE_IDS.length === 7` | `sessionTypeCharterTests.ts:158` asserts SEVEN. An eighth type reds it until R-129's four answers are entered in `rules/sessionTypeCharter.ts`. |
| 2 | day-card word | one signed row `part.headline.optional.primer` in `projectionCopy.ts`, or the card falls through to the honest-generic "Strength". |
| 3 | weekly-row glyph | `HomeScreenV2.displayLabelIconKind` is a table of NAME EQUALITIES. "primer" absent ⇒ grey `activity` glyph. |
| 4 | stress class | `stressClassification.ts:106` lists gunshow/prehab/recovery/rest as always-low. A missing `primer` case falls to `'other'` ⇒ **medium**, inflating hard-day counts in every audit. |
| 5 | no-checkbox rows | `completionPolicy: 'optional_no_penalty'` has **zero readers** outside its own module and suites. A build, not a flag. |

### THE BOLT ALREADY EXISTS AND IS ALREADY SPOKEN FOR

`RowIconKind` already carries `'bolt'` (`rules/sectionIconKinds.ts:32`), drawn at
`SectionIcon.tsx:145`, coloured `#B6D85A`, and mapped from `speed`. **No new
artwork.** Sam signed the bolt for the Primer knowing this; Speed and Primer will
share a glyph until someone rules otherwise.

### "PRIMER" IS FREE AS AN ATHLETE-FACING WORD, AND I CHECKED RATHER THAN ASSUMED

My first report warned Sam of a collision. **It was overstated and I corrected it
to him.** No athlete-facing surface renders the word today — R-110 removed the
`POWER / PRIMER` disclosure on 2026-08-20, and the one surviving `'Power Primer'`
literal (`workoutCanonicalisation.ts:479`) feeds an internal action log that
`lawRegistry.ts:1119` records as having **no athlete-facing reader**. The
collision is in the CODE vocabulary only (`PowerKind`, `powerPrimerPolicy`,
`power_primer_budget`, `looksLikeNeuralPrimer`, `test:power-primer-policy`), so
the internal name will differ from the shipped word — exactly the split that
already lets `arms_pump` read "Gunshow".

### THE THREE MEASURED WALLS ARE IN R-129, NOT REPEATED HERE

No 1RM concept; one explosive-upper candidate (R-118); `SpeedBlock` creates a
hard day so it cannot carry the accelerations.

**Probe files: none. Nothing in `src/` changed by this seat yet.**

---

## 2026-08-23 — BUILT AND HELD. `test:primer-session` 20/0.

**19 files: 17 modified, 3 new** (`rules/sessionLoadEntry.ts`,
`__tests__/primerSessionTests.ts`, this file).

### THE TWO GENERAL ABILITIES, WHICH ARE THE WHOLE POINT

Sam asked whether to special-case it (*"just create the new session type with its
own rules or something?"*) and then ruled *"no do it properly, build it the right
way"*. **Almost nothing about the Primer is special** — multi-pool composition is
what `recovery` already does; optional/no-load/athlete-added is Gunshow exactly.
**Two things genuinely did not exist**, and both shipped as properties, not
branches:

1. **A SLOT NAMES ITS SOURCE.** `SessionSlot` became a union — a category draw
   (now with a `regions` RESTRICTION beside the existing `spread`), a `power`
   family draw, or `authored` rows. Read with `'x' in slot`, never a discriminant
   field: no `strictNullChecks` here, so the false arm of a tagged union does not
   narrow.
2. **A SESSION CAN DECLINE TO ASK FOR A WEIGHT.** `rules/sessionLoadEntry.ts`,
   one function, DERIVED from `composedOptionalKind` — no new stored field.

And one general FIX that was not scoped to the Primer at all: `applyDelta`'s
unbanded rep floor asserted a flat `3` while the banded branch took the lower of
band and authored value, so **any row authored at 1-2 reps was silently raised to
3 by progression**. Sam asked for an exception "just for this session"; the
defect was never session-specific, and a per-row opt-out flag would have been a
writer with no reader for every other row in the app.

### THREE THINGS I DELETED RATHER THAN SHIPPED

- `AuthoredSlotRow.optional` and `.belowRepFloor` — both would have had a WRITER
  AND NO READER (`canOverride`, "written nine times and read zero"). "Optional"
  is COPY now, because the athlete has to READ it; the floor moved to its owner.
- `exclude: ['Pogo Hops']` on the explosive slot — **the surviving mutant.**
  `eligiblePowerExercises` already drops reduced-takeover entries. It was a
  second copy of a guarantee, which reads like the thing enforcing it.

### ⚠ THE DEFECT MY OWN CONTROL RUN CREATED

`git diff --name-only` does not list a NEW file, so the backup step skipped
`sessionLoadEntry.ts` and the control's HEAD-restore **deleted it**. Rewritten
from context; nothing warned. Enumerate with `git status --porcelain` instead —
and note `for f in $VAR` does not word-split in zsh, which is how the first
backup attempt silently copied nothing.

### WHAT IS OWED

**THE SIMULATOR.** Not run. Four things need Sam's eye or a screenshot: the Add
menu's Primer row and its bolt, the week-row glyph, the day card reading
"Primer", and a session screen with **no weight control on any row** — that last
one is the amendment and the one most worth photographing.

**THE EXPLOSIVE-UPPER POOL IS ONE DEEP** (R-118). Every Primer prescribes
`Explosive Push-up`. Sam: *"just use the push ups for now, I will add more power
later"* — so it is his open item, not a defect here, and the slot is a POOL DRAW
precisely so a second candidate rotates in with no edit.

**GENERATOR PLACEMENT IS DELIBERATELY ABSENT.** The charter says `athlete` alone.
The female-pathway default flip is a stated FUTURE order.

---

## 2026-08-23, ON GLASS — THE COMPOSER IS RIGHT AND THE ATHLETE GETS SOMETHING ELSE

**Sam opened a Primer on his phone. Twenty green cells did not see any of this.**
This is the founding case for CLAUDE.md's *"DONE MEANS THE ATHLETE CAN SEE IT"*,
paid in full by the seat that wrote the cells.

### FIRST, TWO REAL DEFECTS THE PHONE CAUGHT AND THE SUITES COULD NOT

**1. A RENDER ERROR — the session could not open at all.**
`"exercise.name.Acceleration" is not in the signed-copy sheet.` The Primer
authors `Acceleration` BY NAME, and no selectable pool holds it, so the signed
copy sheet had nothing to resolve. **FIXED** by registering the id with
`source: 'sam_ruling'` and R-129 provenance — deliberately NOT by adding it to
`POWER_EXERCISE_POOL`, which is one of the four SELECTABLE systems and would have
made a running acceleration eligible for the power slot inside ordinary gym
strength sessions.

**2. WHITE TEXT ON LIME — unrelated to the Primer, and Sam could not read it.**
*"i don't know what this says because i can't fucking read it - why are these
buttons different style to normal?"* `CommitmentCard`'s options and
`CoachTabScreen`'s Confirm are hand-rolled `Pressable`s, not the shared `Button`,
so they never inherited its `getTextColor()` → `colors.button.primaryText`
(`#0C0C0C`). A bare `<Text variant="body">` defaults to `#FFFFFF`. **His second
question is the cause of his first.** Both fixed with the app's own token, and
`test:approved-icons` moved to the new signed state rather than being loosened.

### THE BIG ONE — THE COMPOSER IS CORRECT AND THE SCREEN IS NOT

`buildDerivedSession('primer')`, printed directly, is **exactly R-129**:

```
 1. Couch Stretch      2x30-45     6. Explosive Push-up  2x3-3
 2. Pigeon Stretch     2x30-45     7. Vertical Jump      2x3-3
 3. Lat Stretch        2x30-45     8. Acceleration       3x15-15
 4. Deep Squat Hold    2x30-45     9. High Box Squat     2x2-2
 5. Pogo Hops          2x10-10    10. Bench Press        2x3-3
```

**WHAT THE ATHLETE ACTUALLY READ, same session, on the day screen:**

| defect | detail |
| --- | --- |
| **THREE ROWS GONE** | **Pogo Hops, Explosive Push-up and Vertical Jump are ABSENT.** The whole explosive half of the session — slots 5, 6 and 7 — never reached the screen. |
| **THE DOSE CHANGED** | `High Box Squat` renders **2 × 3**, not the authored **2 × 2**. Sam's rep-floor exception is being undone downstream of the fix. |
| **FOUR ROWS APPEARED** | `Wall Hip Opener`, `Crab Walks`, `Band External Rotation`, `Open Book Rotation` — none composed by the Primer. `Crab Walks` and `Band External Rotation` are PREHAB-pool, not mobility. |
| **THE ORDER IS GONE** | Sam's authored order is the session. His four mobility drills are split across `MOBILITY / WARM-UP`, `STRENGTH` and `OPTIONAL WORK`; `Deep Squat Hold` renders inside STRENGTH. |
| **THE COUNT LIES** | Header reads **"5 exercises"** over a session showing 4 + 5 + 2 = 11 rows. |

**WHAT IS CONFIRMED GOOD ON GLASS:** the Add-menu row with its bolt, in Sam's
signed position under Gunshow; both amended subtitles; the title "Primer" and its
description; tick boxes on every row; and **no weight control anywhere in the
session**, including on `High Box Squat` and `Bench Press` — the amendment holds.

### ⚠ WHY THE CELLS MISSED IT, AND WHAT THE NEXT SUITE MUST DO

**`test:primer-session` drives `buildDerivedSession` and stops there.** Every one
of its 20 cells is about the COMPOSER. The defects above all live between the
composer and the screen — the add/publish path, the warm-up attachment, the
section classifier and whatever rewrote the dose. **A cell that ends at the
composer cannot see a session the app then rewrites**, which is this repo's
`MEASURE WHAT THE ATHLETE READS, NOT THE SHEETS` law with a new example.

**NEXT SUITE: drive the ATHLETE'S DOOR** — add a Primer through the real
plan-change path and assert against `projectVisibleDay` / the session template,
not against the builder's return value. **NOT STARTED.**

---

## 2026-08-23, ROUND 2 — THE ORDER IS FIXED AT ITS OWNER; THE SAVE PATH IS STILL LOSING ROWS

**FIXED AND PROVEN.**

**1. THE ORDER.** `buildSessionTemplate` ends in `orderItems(items, d2Rank)`,
which ranks by ROLE — power, main lift, accessories. Right for a session the app
composed, wrong for one Sam authored slot by slot: D2 classified his two OPTIONAL
heavy lifts as main lifts and sorted them to the TOP of the session. Measured
before the fix: `High Box Squat, Bench Press, Couch Stretch, …`.

**THE FIX IS THE MECHANISM THAT WAS ALREADY THERE.** Standalone Mobility and
Recovery force one shared role so the stable sort cannot reorder them —
`buildSessionTemplate`'s own words: *"Force one common role so their authored
order is preserved."* `sessionOrderIsAuthored` (new, in `sessionComponents`
beside `standaloneLowLoadSessionKind`, which answers the same family of question)
now says which sessions get that treatment. **No second sorting rule was added;
the existing one is given nothing to reorder.** After: all ten rows in Sam's
order, `Couch Stretch … High Box Squat, Bench Press`.

**2. `descriptionSuffix`** — *"short and sharp"*, his correction, live on glass.

**LOCALISED AND NOT FIXED — THE SAVE PATH LOSES THREE ROWS.**
Printed at every stage: `buildDerivedSession('primer')` → **10 rows**;
`buildCoachRevisionTemplateWorkout('primer_session')` → **10 rows**, marker,
tier, 20 min, `High Box Squat 2x2`; `getSessionComponentRows` → **10 of 10**;
`buildSessionTemplate` → **10 items**. **Every read path is correct.** The
session STORED on the day carries 5. `Pogo Hops`, `Explosive Push-up` and
`Vertical Jump` — the whole explosive half — are absent from the saved workout,
and `High Box Squat` reads `2 x 3` there against an authored `2 x 2`.
**Therefore the defect is in the ADD/PUBLISH write, not in composition or
render.** Next probe: the plan-change materialiser and `workoutCanonicalisation`,
which are the two writers between the door and the store.

⚠ **THE INSTANCE ON SAM'S SCREEN WAS ADDED WHILE THE RENDER WAS THROWING** (the
`Acceleration` signed-copy error), so it may be a TRUNCATED save rather than the
steady-state one. **A fresh add on a clean day has NOT been taken** — the day-nav
arrow did not advance in the panel — so the two causes are not yet separated, and
nothing above should be reported as the final diagnosis.

**ALSO OPEN, SEEN ON THE DAY CARD:** `PRIMER` is listed **twice** among the day's
components, once with the strength glyph and once with the blue battery —
`partHeadline` names BOTH a strength part and a recovery part
`part.headline.optional.primer`, so a session whose rows land in two components
says its own name twice. And the header count reads **"5 exercises"** over a
session showing eleven rows.

**SAM ON THE FORCED WARM-UP:** *"the 4 mobility / warm up activation stuff seems
to be forced in there like a normal session but there's no power work … which
actually might be okay"*. **Tolerated, not ruled.** Not to be removed without him.

---

## 2026-08-23, ROUND 3 — FOUR OF SAM'S SIX, AND THE POWER HUNT NARROWED AGAIN

**DONE, HELD BY `test:primer-session` (22 cells, 0 failed).**

1. **The description is his sentence alone** — *"Short and sharp, the day before a
   game"*. `reason` ("Athlete-added session") is builder-internal PROVENANCE and
   was being prefixed onto athlete-facing copy. Scoped via `descriptionIsWhole`,
   with **S12 as the control**: every other composed session KEEPS its prefix, so
   this cannot pass by having been deleted app-wide.
2. **The optional rows are optional.** `AuthoredSlotRow.optional` →
   `WorkoutExercise.optionalNoPenalty` → `sessionTemplate`'s OPTIONAL WORK
   cluster. The accelerations and both heavy lifts now sit below the prescribed
   work. ⚠ **THIS FIELD WAS DELETED THIS MORNING FOR HAVING NO READER AND IS BACK
   THIS AFTERNOON BECAUSE IT HAS ONE.** That is the rule working, not a reversal:
   the first version carried "Optional" in the row NOTES, and Sam's reply —
   *"they should be optional"* — is the proof that copy saying a thing is not the
   screen doing it. **S7 was rewritten to assert the FACT AND THE RENDER instead
   of the words.**
3. **The empty third component is gone.** *"we def don't need the primer card with
   the little blue icon next to it - no other days have that"*. It was a ZERO-ROW
   part rendering as a bare label. The flat presentation already dropped empty
   parts (`if (!canOpen) return null`); the default one now does too, with games
   the deliberate exception — they carry no rows by construction.
4. **Order** (round 2) and **"short and sharp"** confirmed on glass.

**NOT DONE — TWO, AND BOTH ARE HONEST OPEN ITEMS.**

**A. THE DAY-CARD ICON IS STILL A DUMBBELL.** Sam wants the bolt. `PART_ICON_KIND`
is keyed on `VisiblePartKind`, which has no `primer` member, and `DayTimelineEntry`
does not carry the workout — so the screen cannot currently tell a Primer's
strength part from any other. **The fix is to have the projection stamp the fact
on the entry**, not to have the card match on the headline STRING, which is the
`displayLabelIconKind` antipattern this repo already has one of.

**B. THE POWER WORK. NARROWED TWICE MORE, STILL NOT CAUGHT.**
Round 2 proved every READ path returns 10 rows. This round walked the WRITE path:
`add_template` on an empty day and the stacking path both pass
`canonicalizeWorkout: (date, workout) => { assertLiveWorkoutWrite(...); return workout; }`
— **a pass-through. The producer drops nothing.** So the loss is downstream of
the producer: the override writer, the program store write, or the accepted-week
gateway. **Those three are the remaining candidates and none has been probed.**

⚠ **AND THE DOSE EVIDENCE POINTS THE SAME WAY.** `deep-squat-hold` is authored
`2 x 30-45` WITH `prescriptionType: 'duration'` (so it should read `45s`), and
`High Box Squat` is authored `2 x 2`. On Sam's stored day they read **`2 x 20`**
and **`2 x 3`**. Rows re-dosed AND rows missing is one symptom, not two: something
downstream is running this session through a strength pipeline that applies rep
BANDS by exercise name. `strengthProgressionIntegration.authoredBandForRow` is the
strongest single suspect and is where the next probe goes.

---

## 2026-08-23, ROUND 4 — SAM'S RECOVERY/MOBILITY CONFUSION HAS A ROOT CAUSE, AND IT IS A STALE RULING

**HIS REPORT:** *"adding recovery to a day shows a mobility label with a battery
and the badge says recovery; adding mobility day also add a mobility label with a
battery but the badge says recovery; adding accessories lists accessories with
optional badge — what is going on here?"*

**THE BUILDERS ARE ALL CORRECT AND ALL DISTINCT.** Printed directly:

| door | name | workoutType | tier | marker | component |
| --- | --- | --- | --- | --- | --- |
| recovery | `Recovery Flow` | Recovery | recovery | — | `recovery` |
| mobility | `Mobility` | Mobility | recovery | mobility | `mobility` |
| accessories | `Gunshow` | Strength | optional | gunshow | `session` |
| primer | `Primer` | Strength | optional | primer | `strength` |

**THE DEFECT IS ONE WORD, AND IT WAS DELIBERATE WHEN IT WAS WRITTEN.**
`part.headline.recovery` was REWORDED from "Recovery" to **"Mobility"** on
2026-08-01 (Batch 7). Its own provenance states the reasoning: *"Recovery is a
charter-deleted type and its authored contents ARE the mobility flows, so the
`recovery`-KIND parts render the word for what their rows are."*

⚠ **THAT PREMISE DIED TWENTY DAYS LATER AND NOBODY WENT BACK FOR THE WORD.** On
2026-08-21 Sam ruled *"there should be a specific mobility day and a specific
recovery day"*, and Recovery was rebuilt with its OWN authored recipe — 2 tissue
quality, 3 mobility, 1 easy cardio, 1 breathing reset. **Its contents stopped
being "the mobility flows" that day.** The word describing them stayed.

So a Recovery session shipped a card titled **Mobility** wearing a **RECOVERY**
badge — two words for one session, contradicting each other on the same card,
which is exactly what Sam could not make sense of. **RESTORED to "Recovery"**,
with the dead premise recorded at the entry so it cannot be re-reworded on the
old reasoning. `part.headline.recovery_addon` is deliberately LEFT as "Mobility":
an add-on's rows genuinely ARE mobility flows, so that half of Batch 7 still holds.

**THE CLASS, FOR THE NEXT READER:** a ruling that supersedes an earlier one does
not automatically un-write the copy the earlier one justified. **Batch 7's
rewording had a stated premise; the 2026-08-21 ruling falsified it; nothing in
the repo connects those two facts.** This is the second stale-premise defect this
seat has hit today (the first: an `exclude` kept as a guarantee its real owner
already held).

## THE POWER WORK — THREE MORE CANDIDATES ELIMINATED, ONE TEST STILL NOT RUN

- **The producer is clean.** `add_template` on an empty day AND the stacking path
  both pass `canonicalizeWorkout: (d, w) => { assertLiveWorkoutWrite(d, w); return w; }`
  — a pass-through.
- **The exercise cap is not it.** `sessionRowCounting`'s own note: *"nothing
  enforces a cap today"*; `maxExercisesPerStrengthSession` reaches
  `AIConstraints` and is read by no prompt builder, validator or trim (R-013).
- **The §18 accepted-week gateway** carries no row filter or `slice` — it remains
  a candidate but not an obvious one.

⚠ **THE ONE TEST THAT WOULD SETTLE IT HAS STILL NOT BEEN RUN: A FRESH ADD.**
The Primer on Sam's day was added while the render was THROWING and while three
later fixes were absent. **It may simply be a damaged save, not a live defect**,
and every probe since has been chasing a bug that may not exist in the current
build. The day-nav arrow does not respond to taps in the panel, so a clean day
has not been reached. **Nothing above should be read as a diagnosis until a
Primer added on the CURRENT build is inspected.**

---

## 2026-08-23, ROUND 5 — **CAUGHT IT.** THE WRITE PATH WAS EATING THE SESSION.

**`utils/workoutCanonicalisation.finaliseWorkoutAfterMutation`.** It runs on the
ADD/SWAP write (`materializeAthleteSwapSession`), and it is a STRENGTH-SESSION
canonicaliser: it classifies rows, infers what the day was FOR, re-derives the
name and type, and rebuilds the content as
`leadingPower + strengthWithContrast + finalConditioningRows` — **dropping every
row that is none of those**, and diverting mobility rows into a generated
`Optional Mobility Add-on` block.

**MEASURED, CONTROL AND CANDIDATE, ON THE SAME TREE** (the guard toggled with
`if (false && ...)`, tree restored byte-identical after):

| | rows | what happened |
| --- | --- | --- |
| **control** (guard off) | **6 of 10** | `Hip 90/90 Stretch`, **`Pogo Hops`, `Explosive Push-up`, `Lateral Jump`** deleted |
| **candidate** (guard on) | **10 of 10** | authored order and doses intact |

**THE DELETED FOUR ARE THE ENTIRE EXPLOSIVE HALF — the "no power work" Sam
reported FOUR TIMES.** It also explains, as one cause rather than four: the
mobility drills rendering as checkbox-less add-ons (*"some checkboxes and some
not"*), the `2 x 2` heavy lift reading `2 x 3`, and `Deep Squat Hold` reading
`2 x 20` against its authored `2 x 30-45`.

**WHY FOUR ROUNDS MISSED IT.** Every READ path — `buildDerivedSession`,
`buildCoachRevisionTemplateWorkout`, `getSessionComponentRows`,
`buildSessionTemplate`, the projection — returns all ten rows. **Only the write
does not**, and all 22 cells of `test:primer-session` drove the composer. This is
`MEASURE WHAT THE ATHLETE READS, NOT THE SHEETS` with a new face: the sheets were
right every single time.

⚠ **AND MY OWN INSTRUMENT LIED FOR THREE ATTEMPTS.** The probe read
`.exercises` off the RESULT object, which is `{ workout, changed, actions }` —
so it printed `0 rows` no matter what, and I "fixed" the code twice against a
reading that meant nothing. **A green/zero number from an instrument nobody
controlled is not a measurement.** The two narrower fixes attempted on that bad
reading (adding the marker to `supportOnlyTextHint`; making the marker outrank
`ownership`) were BOTH REVERTED — see the comment at the guard, which keeps them
as the evidence for why the fix is an early return rather than another condition.

**THE FIX:** an early return for `composedOptionalKind`. A composed optional
session has no intent to re-derive — **its slots ARE the intent** — and this
file already says so in its own words: *"Filling a pattern is authoring, and
authoring belongs to the composer."* So does keeping one. It covers Gunshow,
Prehab, Mobility and Primer alike; the first three survived only because their
names happened to match the `gunshow|prehab|pump|accessor|low-fatigue` regex.

· **HELD** by `test:primer-session` **W1/W2/W3** (25 cells, 0 failed) — W1 row
conservation AND order, W2 the authored dose including the 2-rep exception, **W3
the control proving an ordinary strength session still goes through the pass**,
so the guard cannot pass by having disabled canonicalisation app-wide.
Typecheck **662 = control 662**. `test:workout-canonicalisation`,
`test:plan-change-producer`, `test:coach-revision-proposal-behavior` and
`test:deload-week` exit 1 **with the guard OFF as well** — pre-existing.

---

## 2026-08-23, ROUND 6 — THE FORMATTERS, THE GLYPHS, AND A CAST THAT INVENTED A FIELD

**THE `2 x 20` HAD TWO CAUSES, BOTH FORMATTERS, NEITHER IN THE DATA.**
`Deep Squat Hold` is authored `2 x 30-45` WITH `prescriptionType: 'duration'`.

1. **A REP SNAPPER RUN OVER A TIMED HOLD.** `formatStrengthSetsReps` called
   `displayReps` unconditionally, and `displayReps` maps a range onto
   `APPROVED_REP_TARGETS` `[3,4,5,6,8,10,15,20]`. **No rep target sits inside
   30-45, so it fell back to the nearest one and printed `20`** — a rep count,
   for a stretch, in seconds' clothing. The unit-aware formatter already existed
   one function above (`formatLowLoadSetsReps`, written for *"sessions [that]
   share the strength card, but their units can be seconds or minutes"*); the
   card simply never asked per ROW. It does now — seconds, minutes, metres and
   per-side all keep their single owner.
2. **THE SAME SNAPPER REVOKED SAM'S 2-REP EXCEPTION.** `2` is not an approved
   target, so the heavy lift read `2 x 3` — the exception honoured in the data
   and undone on the screen.

⚠ **THE FIRST FIX FOR (2) WAS TOO BROAD AND A GATE CAUGHT IT.** Making
`displayReps` skip snapping for ANY exact dose red `test:session-template`'s
*"every rep range resolves to the approved vocabulary"*: a legacy `11 x 11` or
`18 x 18` prescription SHOULD still snap to 10 and 20. **The vocabulary law
stands.** Scoped instead to `WorkoutExercise.exactDose`, stamped only on
`AuthoredSlotRow` rows — exactly-authored by definition — with **S14 as the
control** proving ranges still snap.

**THE BOLT, AND A CAST THAT LIED.** The day card chose its glyph with
`PART_ICON_KIND[entry.kind]`, and `VisiblePartKind` has no `primer` member. The
first fix read `(day as { workout?: … }).workout?.composedOptionalKind` — **and
`VisibleDay` HAS NO `workout` FIELD.** The cast made a real lookup look like one
and silently answered `undefined` forever; the bolt never appeared and nothing
failed. **A cast that invents a field is not a read.** Fixed by passing the
stored workout into `dayTimeline` as an argument. The session screen's section
glyph now comes from the same decision, so the card and the screen cannot draw
different icons for one session.

**THREE PINNED GATES AMENDED CONSCIOUSLY, NONE LOOSENED:** the timeline entry
SHAPE pin (`iconKind` admitted, with the reason; *"a start time still cannot
arrive through here"* unchanged), the one-icon-owner pin (still true — the glyph
is decided in the rules layer FROM that owner), and the rep-vocabulary law
(untouched; the row opts out, the law does not bend).

**ALSO FIXED BY ROUND 5's ROOT CAUSE, not separately:** *"it says it added full
body strength"*. The canonicaliser was RENAMING the workout via
`canonicalStrengthName`, and the confirmation quotes that name. With composed
optional sessions no longer re-decided, it reads *"Done. Primer added"*.

**ON GLASS, VERIFIED BY THE SEAT DRIVING THE SIMULATOR ITSELF** (Sam:
*"cant you just analyse the simulator your self"* — yes, and it should have been
doing so rounds earlier): day card **Primer / OPTIONAL / bolt / 10 exercises**,
no phantom third card; session **MOBILITY / WARM-UP → PRIMER → OPTIONAL WORK**;
`Couch Stretch 2 × 45s / side`, `Acceleration 3 × 15m`, `High Box Squat 2 × 2`,
`Pogo Hops`, `Explosive Push-Up`, `Vertical Jump` all present; every row a tick
box; no weight control anywhere. Typecheck **662 = control 662**.

---

## 2026-08-23, ROUND 7 — TWO GLYPH COLOURS THAT SAM'S OWN RULING HAD ALREADY COVERED

**Sam, seeing the grey day card with one lime bolt on it:** *"the icon is lime
green = should be grey to match everything else - mobility and recovery may need
to be changed to match as well"*.

**HIS 2026-08-20 RULING ALREADY SAID THIS AND TWO CASES WERE LEFT BEHIND BY IT.**
*"icon for conditioning should not be amber - keep same grey as the other logos"*
moved `flame` from `#D9874E` to grey and left the note *"The amber that remains
belongs to `game`, which is a fixture and not a section the athlete trains
through."* **`recovery` (`#3AA7D8`) and `bolt` (`#B6D85A`) never moved with it**,
and nothing noticed until the Primer put a lime bolt beside five grey glyphs.
Both are now grey; `game` keeps its amber, because it is the stated exception.

**`mobility` WAS ALREADY GREY** — Sam raised it, I checked rather than assumed,
and it needed nothing.

⚠ **WHAT WAS DELIBERATELY NOT TOUCHED.** The blue `RECOVERY` pill on the day card
and the blue battery on the Tired status control are **not section glyphs and do
not read `rowIconColor`**. Sam kept that badge on purpose (recorded at
`sessionBuilder` SESSION_META.mobility: *"the blue badge Sam said could stay"*).
Changing the icon colour is not a licence to change the badge.

**This is the THIRD stale-premise defect of the day** — a ruling that superseded
an earlier decision, with the earlier decision's consequences left standing:
`part.headline.recovery` still reading "Mobility"; an `exclude` kept as a
guarantee its real owner already held; and now two glyph colours a grey ruling
had already claimed. **Nothing in this repo connects a new ruling to the code the
old one justified**, and each time it costs Sam a round of finding it on glass.

· Typecheck **662 = control 662**. `test:prototype-typography` 4/1 measured with
the colours RESTORED as a control — **the same 1 failure**, pre-existing.
Verified on glass by the seat: the bolt is grey and matches the mobility glyph
beside it.
