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

## 9. WHAT IS NOT MINE, AND WAS NOT TOUCHED

- **`exercisePools.ts` / `equipmentAvailability.ts`** — modified in the shared
  tree by the equipment seat when this unit started. Never opened, never staged.
- **`programControlActions.ts`** — its `reportedReadinessLevel` is declaration
  vocabulary and correct as it stands.
- **The `cookedReadiness: false` cut** at `weeklyExposureContractV2.ts:1133` —
  already correct, already commented, left exactly as found.
