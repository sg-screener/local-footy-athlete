# STATUS — seat `readiness`

**One name, one file, one writer.** Opened 2026-08-13. `ls docs/STATUS_*.md`
before the first commit returned AUDIT / DESKTOP / PACE / PROGRESSION /
TERMINAL — `readiness` was free.

**THE ORDER (Sam, 2026-08-13, verbatim):** *"'Readiness' means two unrelated
things in this app — the athlete's own declaration, and a capacity score from
onboarding — and ten call sites read the wrong one. Give them separate names and
fix the call sites."*

**REGISTRY-GREP:** `docs/RULINGS_REGISTRY.md` for *readiness*, *capacity*,
*homonym*, *launder* → **R-041** (the homonym, `UNENFORCED`), **R-064** (the
homonym restated as a boundary, `UNENFORCED`), R-038 (the declaration's three
tiers), R-040 (raw severity is private to the door), R-063 (counts are
structure). Nothing is owed to Sam — **this is a build.**

---

## 1. THE PREMISE IS HALF RIGHT, AND THE HALF THAT IS WRONG MATTERS

**A ruling premise is a claim too, so it was measured before anything was
touched.**

R-041 says, and the Bible says at `:4964`:

> *"Ten call sites belong to the capacity score and are **deliberately
> untouched**."*

**So the registry's ten are the sites that are CORRECT.** Taken literally,
"ten call sites read the wrong one" would order the reversal of a 2026-07-27
ruling. It does not, and the reason is in the same two rows: **R-041 and R-064
are both `UNENFORCED`** — *"a naming hazard, not a behaviour; **nothing reds if
they re-merge**."*

**They re-merged.** The homonym was cut at two named sites in July
(`calculateReadiness`'s laundering site, Contract v2's `cookedReadiness`) and
nothing has stopped it since. **Ten sites now carry the declaration into the
capacity band or the reverse** — a different ten from the registry's ten, and
the coincidence of the number is why this had to be counted rather than
assumed.

**SO THE ORDER IS BUILT AS WRITTEN AND THE COUNT IS RE-DERIVED FROM THE CODE.**

---

## 2. THE TWO SIGNALS, AND WHICH KEEPS THE NAME

| | CAPACITY | THE DECLARATION |
| --- | --- | --- |
| what it means | *"this athlete's baseline is low"* | *"I am cooked today"* |
| computed from | two onboarding answers (`recentTrainingLoad`, `conditioningLevel`) | the athlete's own words (R-038: tired / wrecked / absolutely cooked) |
| changes when | the PROFILE changes | the athlete speaks |
| reads facts | none | it IS a fact |
| owner | `data/capacityRubric.ts` | `rules/readinessIllnessLaw.ts` |
| may set structure | **never** (`readinessStructureCensus.ts`) | via its own law family |

**THE DECLARATION KEEPS `readiness`.** It is the subject of Sam's law
(*"This law governs the DECLARATION only"*, Bible `:3717`) and of R-038's three
tiers in his own words. `ReadinessSignal`, `GenerationReadinessConstraint`,
`readinessIllnessLaw`, `readinessDeloadFactScope` are unchanged.

**CAPACITY IS RENAMED, and the repo had already started this rename** —
`capacityRubric.ts`, `capacityFor`, `canScoreCapacity`,
`profileCapacityBandOrNull`, `capacityBandFor` all pre-date this seat. **The
type was the last thing still called readiness.** Finishing an in-progress
migration beat inventing a third vocabulary.

---

## 3. SLICE 1 — `ReadinessLevel` -> `CapacityBand`. OUTPUT-INERT.

**64 occurrences, 20 files, one guarded pass.** `sed -i` no-ops in this
checkout, so the rename ran as a node script printing a per-file count and a
total, with a lookbehind guard on the preceding character.

**THE GUARD EARNED ITS KEEP ON THE FIRST RUN.**
`programControlActions.ts` holds `reportedReadinessLevel` — a
`TemporaryAthleteReportedLevel`, which is a **DECLARATION** value whose
identifier merely CONTAINS the type name. A bare replace would have renamed it
`reportedCapacityBand` and mislabelled the athlete's own words as his baseline —
**the exact defect this unit exists to remove, committed by the tool removing
it.** The file printed `0 (SKIPPED)` and was not written.

**ONE COLLISION, AND IT WAS REAL.** `capacityRubric.ts` already had
`export interface CapacityBand { level; min; max }` — a **score RANGE**, not a
band. Renamed `CapacityBandRange`; the scalar took the name it describes.
`CAPACITY_BANDS` itself was left alone deliberately: `bibleThresholdAnchors.ts:198`
anchors that SYMBOL by name, so renaming the constant breaks a Bible anchor for
no gain.

**MEASURED EITHER SIDE, not asserted:**

| | before | after |
| --- | --- | --- |
| `test:compile` failing file/scope pairs | 2 | 1 |
| ...and the survivor | `EquipmentLimitationSheet.tsx` | the same file |

**Both baseline failures belong to the equipment seat** (`exercisePools.ts` and
`equipmentAvailability.ts` are modified in the shared tree, not by me);
`equipmentVocabularyTests.ts` was fixed by that seat mid-run, which is why the
total moved 461 -> 460. **This rename adds ZERO new typecheck failures.**

---

## 4. THE TEN SITES THAT READ THE WRONG SIGNAL — MEASURED

Recorded before any of them is touched, so the fix can be checked against the
list rather than against itself.

### (a) THE LAUNDERING SURVIVED IN THREE FUNCTIONS — LIVE, AND ALL THREE WIRED

Sam deleted this exact shape at `calculateReadiness` on 2026-07-27, and the
comment he left there names it: *"This used to step the CAPACITY score down on
`deloaded`. That converted the law's boolean straight back into a magnitude, and
every `readiness === 'low'` branch in this engine then read it."*

**The same operation is still running in three places the July sweep did not
reach**, each stepping the capacity band DOWN from session feedback:

| # | site | what it does | reached from |
| --- | --- | --- | --- |
| 1 | `utils/feedbackAdapter.ts:298` `applyReadinessBias` | `READINESS_DOWN[band]` on an `AdaptationResult` | 2 |
| 2 | `utils/strengthProgressionIntegration.ts:862` | calls it on the passed-in band | live |
| 3 | `utils/feedbackPatterns.ts:219` `applyPatternBiases` | `biased.readiness = READINESS_DOWN[...]` on `FATIGUE_STREAK` / `MIXED_SIGNALS` | 4 |
| 4 | `utils/strengthProgressionIntegration.ts:897` | calls it on the built context | live |
| 5 | `utils/feedbackPatterns.ts:274` `biasConditioningReadiness` | same step, for conditioning tier selection | 6 |
| 6 | `utils/sessionResolver.ts:1941` | calls it | live |

**A fatigue streak is not a detrained baseline.** These make a fit athlete who
had two hard weeks read as someone whose onboarding said he barely trains.

### (b) THE BLEND — ONE FUNCTION RETURNS BOTH SIGNALS AS ONE VALUE

| # | site | what it does |
| --- | --- | --- |
| 7 | `utils/readiness.ts:86` `deriveScheduleReadiness` | takes the capacity band and LOWERS it by the day's `ReadinessSignal` (pain, soreness, flat, short on time), returning a bare band its consumers cannot tell apart from pure capacity |
| 8 | `utils/tapSwapHierarchy.ts:160` | consumes the blend |
| 9 | `utils/postGenerationConstraintValidation.ts:709` | consumes the blend |

### (c) THE ROUND TRIP — CAPACITY REBUILT FROM A DECLARATION REASON, AND DEAD

| # | site | what it does |
| --- | --- | --- |
| 10 | `rules/derivedWeekContract.ts:337` | `readiness: stored.safety.reasons.includes('low_readiness') ? 'low' : 'medium'` |
| 10b | `rules/section18AcceptedWeekGateway.ts:404` | byte-identical line |

**AND THE MEASUREMENT THAT MAKES THESE WORSE THAN THEY LOOK: NO PRODUCTION SITE
EVER MINTS THAT REASON.** `grep "reason: 'low_readiness'"` across `src`
returns **exactly one hit and it is a test** (`section18ContractV2Tests.ts:473`).
`section18SafetyPolicy.ts:437` writes `low_readiness` to
`power.removalReason` — **a different field**, which never reaches
`safety.reasons`.

**So both lines evaluate to `'medium'` on every real week.** The stored-week
round trip does not merely read the wrong signal — **it discards the athlete's
capacity band entirely and substitutes the middle of the scale**, and it has
been doing so silently because the ternary looks like it is reading something.

---

## 5. SLICE 2 — THE FIELDS. `readiness` -> `capacity`, 154 lines, 78 files.

**COMPILER-DRIVEN, LINE-SCOPED, NEVER GLOBAL.** `readiness` is also the
declaration's name, so a global pass would have renamed the athlete's own words.
Every rewrite was scoped to a line `tsc` itself flagged, and every one printed.

**TWO THINGS THE SCOPING CAUGHT THAT A GLOBAL PASS WOULD HAVE EATEN:**
- `low_readiness` (a §18 reduction reason) and `cookedReadiness` (the
  declaration) both survive untouched — `\breadiness\b` matches neither, one
  because `_` is a word character and one because of the capital R.
- `explorerRuntimeTests` `target: { kind: 'readiness' }` — a **declaration
  discriminant** swept in because its line was flagged for an unrelated error.
  **Reverted by hand TWICE:** the iterating loop re-broke it after the first
  revert. **That is the argument for printing every line a script writes**; a
  silent script would have shipped it.

**TWO FIELDS NOW SIT BESIDE THEIR OPPOSITE AND SAY SO IN THE TYPE:**
`RecoveryAddonCoverageContext` (`capacity` above `readinessDeloaded`) and
`Section18ContractV2Input` (`capacity` above `cookedReadiness` — **the exact two
fields Sam cut the conflation between on 2026-07-27**).

`calculateReadiness` -> `calculateCapacity`; `lowerReadiness` -> `lowerCapacity`;
`CoachingPlan.readinessFactors` -> `capacityFactors`; `WeekLog.readiness` ->
`capacity`.

**GATE: `npm run test:compile` PASSES.** 461 -> 459 errors, **no file
regressed** — including the equipment seat's file that was red at my baseline.

---

## 6. SLICE 3 — THE GATE. R-041 AND R-064 STOP SAYING `UNENFORCED`.

`test:readiness-structure-law` block [8], **86 -> 94 cells, 94/94.**

**THE SHAPE, AND WHY IT IS THIS SHAPE.** After the split the declaration is
never a three-level band — it is `{deloaded, sessionsOptional}`, a
`ReadinessSignal`, or one of R-038's named tiers. **So a `readiness` compared
against `'low'`/`'medium'`/`'high'` can only be the capacity band wearing the
wrong name.** `homonymBandComparisonsIn` is the census's own idiom pointed at
the other word, so the two cannot drift apart: whatever one counts as an edge,
the other counts as a violation.

**NON-VACUOUS BY CONSTRUCTION, THEN MUTATION-PROVEN.** Six pins run either side
BEFORE the sweep, so a detector matching nothing cannot pass by being inert.
Planting `const readiness = capacity;` in `recoveryRules` reds the sweep cell
**and names the file**; restored from my own backup, `git diff` clean.

**⚠ AND THE CENSUS'S OWN DETECTOR WAS NAME-COUPLED — THIS IS WHAT CAUGHT IT.**
`readinessEdgesIn` matched the word `readiness`. It had **always** counted the
CAPACITY score (its own law: *"capacity/readiness affects DOSE only"*), and that
word was the last thing keeping both signals on one instrument. The rename took
**all ten declared files to zero edges at once** and the suite went **20 red**.
Renamed `capacityEdgesIn`. **A detector named after the wrong signal counts the
wrong thing the moment the names diverge** — worth carrying as a class.

**ONE MORE CONFLATION FOUND, IN A FIXTURE.**
`section18SafetyBoundaryTests.baseContract` fed **one** `readiness` argument to
**both** `capacity` and `cookedReadiness` — asking for a detrained athlete
silently also declared him wrecked. Split into two arguments.
**Behaviour-identical, provably: no caller passes the old one**, so both arms
were already `'medium'` and `false`.

---

## 7. FOUR SUITES ARE RED AND NONE ARE MINE — PROVEN, NOT ASSERTED

A **control worktree at `ef38f5e8`** (the commit before my first) runs
byte-identical:

| suite | baseline | my arm |
| --- | --- | --- |
| `tap-swap-hierarchy` | exit 1, 3 fails, `MissingCapacityAnswerError` | identical |
| `readiness` | exit 1, 0 fails, `MissingCapacityAnswerError` | identical |
| `section18-planner` | exit 1, 1 fail | identical |
| `section18-gateway` | exit 1, 0 fails | identical |

`test:ruling-registry` [3] is also red and also not mine: its four offending
questions hit R-009/R-011/R-012/R-078/R-072/R-046/R-055/R-069/R-080/R-014/
R-081/R-074 — **not R-041 and not R-064.**

Green on my side: `readiness-dose-sweep` 104, `section18-safety` 37,
`section18-v2` 135, `capacity-rubric` 55, `capacity-render-safety` 16,
`readiness-illness-law` 121, `readiness-ownership` 22, `weekly-readiness` 30,
`power-primer-policy` 58, `readiness-structure-law` 94.

---

## 8. ⚠ NOT DONE, AND DELIBERATELY NOT STARTED — THE LAUNDERING CUTS

**Section 4(a)'s six sites and 4(b)'s three are RENAMED but NOT REWIRED.** They
still step the capacity band down from session feedback, and
`deriveScheduleReadiness` still returns a blend.

**Cutting them MOVES GENERATED OUTPUT** and owes `test:scenarios` + `test:qa`
either side. SEAT_INBOX item 34 bars starting a generation change at a session
tail, and this is one. **The rename is what makes the next seat's job small:**
every one of those sites now reads `capacity` in its signature while its input
is a fatigue pattern, so the mismatch is visible in one line instead of
requiring the July archaeology this seat had to do.

**The two §18 round-trip sites (4(c)) are renamed and still dead** — they read a
reason no production site mints. Fixing them also moves output. **Both are named
in this file rather than half-built.**

---

## 9. ITEMS 53 AND 54 — TAKEN AT SAM'S DIRECTION, AND ITEM 50's WARNING WAS RIGHT

**Both items read `OWNED BY pace`, and I am `readiness`.** Taken because Sam
directed me to them and **`pace` had been silent two hours while six other seats
committed inside 83 minutes.** Stamped `Agent: readiness` throughout — one name,
one file, one writer. **I did not borrow `pace`'s stamp**; that is the collision
that cost this repo an afternoon on 2026-08-13.

### ITEM 53 — CLOSED. NOTHING WAS BUILT, BECAUSE NOTHING NEEDED BUILDING.

Item 50: *"several say the enforcer could not be NAMED, not that the behaviour is
absent… **if it is enforced, fix the ROW, not the app**."* **This is that case,
for the second time today after R-052.**

| ruling clause | already asserted at |
| --- | --- |
| R-046 three numbers `2/3/4` are DIFFERENT | `rulesKernelTests.ts:447` |
| R-046 team training counts toward running days | `:376` — 2 TT + game = 3, off-feet flush excluded |
| R-046 a 4th is valid, only a 5th breaches | `:461` / `:525` / `:472`, both directions |
| R-046 floor of 2 | `:550`, plus both authored exemptions |
| R-062 one sprint/week, year-round | `:884` |
| R-062 except early off-season | `:886` |
| R-062 the exemptions do not bleed | `:892` — **bye recovery lifts RUNNING and NOT sprint** |
| R-062 a reduction needs a typed reason | `INV_EXPOSURE_REDUCTION_HAS_REASON`, `test:preseason-exposure` |

**MUTATION-PROVEN BEFORE CERTIFYING EITHER ROW**, because certifying off a green
suite nobody probed is how R-052 went wrong in the first place:

| mutation | result |
| --- | --- |
| neuter the running-floor emitter | **4 cells red** |
| `minRunningExposures` 2 -> 1 | **3 cells red** |
| neuter the sprint-floor emitter | **2 cells red** |

Restored from my own backup; `git diff` clean. `UNENFORCED_CEILING` lowered
**9 -> 5** in the same commit — **the ratchet caught this seat on its own work.**

### ITEM 54 — MEASURED, BLOCKED, NOT STARTED. AND ITS HEAD LINE OVERSTATES IT.

**The per-phase counts are BUILT, not unbuilt** — in-season `max: null -> 3` and
late off-season `-> 1` are live in `policyFor`, `test:section18-v2` **135/0**
re-run. Only Christmas is outstanding of the counts, and both remainders are
blocked on vocabulary that does not exist:

- **`Section18WeekMode` has ELEVEN members and none is a Christmas break.**
  R-002 makes the break an off-season inside pre-season and R-004's dated span is
  still `UNENFORCED`. **There is no week identity to hang 1/week on.**
- **`SpeedWorkKind` is `true_speed | repeated_sprint | cod` — no `acceleration`.**
  Sam's ruling turns on precisely that distinction. **The vocabulary cannot
  express the rule, so no amount of gating builds it.**

**⚠ AND ADDING THE MEMBER IS THE `cod_decel` HAZARD, THIRD SIGHTING TODAY.**
Growing a domain union makes every unextended switch return `undefined` —
`categoryToFlavour` did exactly this and generation exited non-zero (28-C1).
**Whoever takes it ships the `satisfies Record<…>` in the same commit.**

### ⚠ WHAT I DID NOT COMMIT, AND WHY

**`docs/SEAT_INBOX.md` carries my marks on 53 and 54 but I did NOT commit it.**
Items **50–59 do not exist in `HEAD` at all** — they are another seat's
uncommitted tranche sitting in the shared tree, and `git commit -- <path>` takes
the whole file. Committing would have landed ~106 lines of their unfinished queue
authoring under my stamp: **rule 2's exact failure mode.** The inbox is committed
every few minutes by whoever owns it; my marks are self-attributed inside the
text, so nothing is lost by waiting. **This section is the durable record.**

---

## 10. A MISS OF MINE, CAUGHT BY ANOTHER SEAT — WORTH MORE THAN THE GATE

**`patterns` mutation-tested my §6 homonym gate the way I did not**, under item
58, and found real vacuity: making `productFiles()` `return []` left the suite
**94/94 GREEN**. Both sweeps standing on it — the undeclared-edge census and my
homonym gate — read "no offenders" off an empty list and reported perfect health.

**I proved the DETECTOR fires; I never proved the SWEEP visits any file.** Those
are different claims and I collapsed them. They added `PRODUCT_FILE_FLOOR` and it
throws rather than asserting. **Left exactly as they wrote it.**

**The lesson generalises past this gate: a pass/fail cell over a COLLECTION has
two failure modes, and mutating the predicate only ever tests one.**

---

## 12. ITEM 57 — MECHANISM THREE, AND A DOOR LEFT AJAR

`patterns` built mechanisms 1 and 2 while I was on 53/54, and named honestly what
its contract comparison cannot see. **This is that arm**, not a duplicate:
`test:fatigue-session-collapse`, **14 cells**, in the `test:bible` chain.

**MEASURED FIRST, as item 50 demands.** The 75% conversion still exists for
injury (`injuryAdjustmentEngine.ts:327`) and that file contains **zero**
occurrences of `fatigue`. The abolition is real.

**⚠ THEN THE PROBE FOUND THE DOOR AJAR:**

```
extractInjuryContext('im absolutely cooked 9/10')
  -> { bodyPart: 'unknown', bucket: null, severity: 9 }
```

**A pure FATIGUE sentence — the verbatim name of R-038's most severe READINESS
tier — enters the INJURY door at the pause band, on a live path**
(`CoachScreen.tsx:1294`). It gets in because "cooked" is a negative descriptor
and body part is deliberately optional.

**AND I NEARLY SHIPPED THAT AS A DEFECT.** The second probe is what stopped it:
with `bucket:null` **every strength row rates `good`**, so `removeNames` is
empty, the `>=50%` swap is unreachable, and **nothing is stripped**. The leak is
real and its harm is zero.

**SO THE GUARD PINS THE INERTNESS, NOT THE LEAK.** That inertness is the whole of
the protection and nothing anywhere stated it — *"no body part? then be cautious
with everything"* is a change a reasonable person would make, and it reinstates
mechanism three for fatigue instantly. The leak is recorded as its own cell so
that closing it **reds** rather than silently invalidating the guard above it.

**I DID NOT CLOSE THE LEAK.** It is a coach-ROUTING change on a live athlete
path. **Fix the routing, never the fallback** — widening the fallback is the
mechanism; narrowing the router is the fix.

**THREE MUTANTS, 2 cells each:** a removal field on `TierDirective`; the `7+`
escalation reinstated; **the null-bucket fallback opened** — which reds the
load-bearing cell AND the asymmetry control. Restored from my own backups,
`git diff` clean.

**⚠ AND `package.json` HAD TO BE REBUILT FROM `HEAD`.** The working tree carried
another seat's `test:ladder-wide` wiring pointing at an **untracked** file;
committing it as found would have put a missing suite into `test:bible` and
broken it on any fresh checkout. Rebuilt from `HEAD` + my two lines, JSON
re-parsed, their line restored to the tree unstaged.

---

## 13. TWO CORRECTIONS TO MY OWN WORK, BOTH FROM OTHER SEATS

**1. HALF MY ITEM-54 BLOCK WAS STALE, AND I MADE THE EXACT MISTAKE I AVOIDED
ELSEWHERE.** I wrote *"blocked on R-004, which item 55 puts on another seat"* —
**quoting R-079's row instead of measuring R-004 myself.** R-004 is `BUILT`; the
dated span ships, held by `test:christmas-break` 44/0 and mutation-proven. **A
ruling premise is a claim too, and I applied that rule to R-041 and R-046 and
then skipped it here.** The half I *did* measure — `Section18WeekMode` has eleven
members and none is a Christmas break — stands, and another seat reached it
independently. **Item 54 stays blocked, on the truth this time.**

**2. MY REGISTRY EDIT LANDED UNDER SOMEONE ELSE'S STAMP.** `dde910c7`
(`patterns`) committed `docs/RULINGS_REGISTRY.md` between my edit and my commit
and swept my R-039 amendment in. The text is self-attributed inside the row, so
nothing is lost — **but the commit stamp Sam asked for does not point at me for
that hunk**, and that is worth recording rather than tidying away.

---

## 14. ⚠ A STANDING RISK NOBODY OWNS: THE INBOX IS 200 LINES UNCOMMITTED

`docs/SEAT_INBOX.md` carries **items 50–59 plus every seat's marks — and none of
it is in `HEAD`.** The delta has grown 164 -> 200 lines while I worked. Several
seats are marking a file nobody is committing.

**I did not commit it, twice, deliberately:** `git commit -- <path>` takes the
whole file, and that would land six seats' unfinished queue authoring under my
stamp — rule 2's exact failure mode. **But an uncommitted shared queue is exactly
the "work nobody can see" risk Sam raised.** My marks on 53, 54, 57 and 58 are on
disk and self-attributed. **This section is their durable copy.**

---

## 16. THE LAUNDERING IS CUT — §4(a)'s SIX SITES, AND §8 IS SUPERSEDED

**§8 said this was "deliberately not started" because it moves generated output
and item 34 bars starting one at a session tail. That was a wall I set myself,
and the one-turn law is explicit: *"a wall you can measure yourself is NOT a
block."* So it was measured and done.**

**THE MEASUREMENT THAT DECIDED THE SHAPE**, and it changed my plan. I had
expected to route the bias into `sessionFeeling`. Then I read the soft-deload
counter:

```
if (input.capacity === 'low') softCount++;
if (rpe >= 8) softCount++;
if (input.missedSessionsThisWeek >= 1) softCount++;
if (input.sessionFeeling === 'Cooked') softCount++;
```

**`capacity` sat there as a PEER of three genuine fatigue signals.** The writers
were lowering the band to buy **one vote** — and paying for it at every other
`capacity` reader: the phase build/hold branches, both high-capacity gates, and
the athlete-visible note *"Pre-season, low capacity - build"*.

Routing to `sessionFeeling` would have been wrong too: `FEELING_UP_ONE` steps
Good -> Sore, and only `'Cooked'` scores, so the vote would have been silently
**lost**. **The honest fix is a named field, not a different borrowed one** —
`recentFatiguePattern`, same writers, same reader, same weight.

`feedbackPatterns`' own comment had already worked this out —
*"This prevents double-stacking: readiness down + feeling up would be two
steps."* **The code knew they were one axis; only the name was wrong.**

**⚠ `test:qa` IS BYTE-IDENTICAL AND THAT IS NOT SAFETY.** 1393 lines, zero diff,
168/10 both ways — **because the 17 scenarios generate from profiles with no
feedback history**, so none of the three flags ever fires in them. **The corpus
is BLIND to this path, and a zero diff would look identical if the change were
wrong.** That is why `test:progression-capacity-laundering` (16 cells) exists,
and why its non-vacuity cells are explicit: the same input *without* the vote
must not deload, and the vote *alone* must not either.

**THREE MUTANTS KILLED:** reinstating the capacity write reds 3; dropping the
vote from the counter reds 2; defaulting the field to `true` reds 2.

### ⚠ A REGRESSION I SHIPPED IN THE RENAME, AND THE HOLE THAT HID IT

`strengthProgressionIntegrationTests` is a **`.js`** file. **The compile gate
reads three tsconfigs and cannot see it.** My compiler-driven rename missed 18
stale `readiness` fields, the gate stayed green, and the suite went **3 red** —
and it stayed that way across two commits before I ran it.

**A COMPILER-DRIVEN RENAME IS ONLY AS COMPLETE AS THE COMPILER'S FILE SET.** I
treated "the gate passes" as "the rename is complete", and those are different
claims — the same collapse as §10, one layer out. Now **104/0, up from 101**, no
cells lost.

**Swept every untyped file afterwards:** the only other seven referencing
`readiness` (`progressionTests.js`, `conditioningTests.js`, and five more) are
**orphans** — they `require('/tmp/lfa-compiled/…')`, a build directory that no
longer exists, and **are wired into nothing**. Red before this session, not
mine, and left for the `audit` seat's orphan unit.

### ✅ THE CONDITIONING ARM IS NOW CUT TOO — ALL THREE WRITERS DONE

**Same cut, third writer.** `biasConditioningReadiness` ->
`conditioningReportsRecentFatigue`; `WeekLog` and `ConditioningProgressionInput`
carry `recentFatiguePattern` beside `capacity`; the conditioning soft-deload
counter reads it as a peer of `recentRPE` and `completionQuality`. **25 cells.**

**I ALMOST SHIPPED IT WITH NO READER CELL.** Block [6] originally tested only the
reporter function — a field with a writer and a test and nothing proving anything
consumes it. **That is the `canOverride` shape, written nine times and read
zero.** Reader cells added, with their own non-vacuity control.

### ⚠ AND ONE MUTANT SURVIVES — NAMED, NOT HIDDEN

Severing the resolver -> input wire (compute the vote correctly, pass `false`)
leaves `test:conditioning-dose` **12/0** and this suite **green**. Four other
mutants in the family were killed; that one is not.

**It survives for the same reason `test:qa` is byte-identical across the whole
change: no suite in the chain generates a week from an athlete with real
session-feedback history**, so the flags never fire in any generated world.
Killing it needs a walker world carrying accumulated feedback — **L13's
territory**, a unit of its own.

**It is recorded in the suite's own NOT-COVERED line, with its receipt**, because
a surviving mutant only the author knows about is the same as no mutation
testing at all.

### THE SUPERSEDED NOTE — WHAT THIS SECTION SAID BEFORE

`biasConditioningReadiness` -> `sessionResolver.ts:1941` still steps the band
down. `conditioningProgressionRules`' counter has **no feeling-equivalent** to
route through — its peers are `recentRPE` and `completionQuality` — so it needs
the same field on that input, and it moves the conditioning arm of generated
output. **A slice of its own, named in the suite rather than half-built.**

---

## 17. WHAT IS NOT MINE, AND WAS NOT TOUCHED

- **`exercisePools.ts` / `equipmentAvailability.ts`** — modified in the shared
  tree by the equipment seat when this unit started. Never opened, never staged.
- **`programControlActions.ts`** — its `reportedReadinessLevel` is declaration
  vocabulary and correct as it stands.
- **The `cookedReadiness: false` cut** at `weeklyExposureContractV2.ts:1133` —
  already correct, already commented, left exactly as found.
