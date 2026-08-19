# STATUS — seat `finish-injury`

**Branch:** `feat/finish-injury-fallback` (worktree, off `main` `9f081efa`).
**Owner:** this seat only. Nobody else writes this file.
**Mission:** finish the injury fallback system across every strength movement
pattern. Injury is not ordinary Remove.

---

## THE BASELINE, MEASURED BEFORE ANY CHANGE

`npm run probe:injury-recompose` on `9f081efa`, real athlete, real off-season
week, real `set_injury_modifier` door, target day `2026-07-22` (an UPPER day):

```
BEFORE: Bench Press, Barbell Row, DB Shoulder Press, Lat Pulldown, Band Pull-Apart

Shoulder/4  ("slight")  ->  Goblet Squat, Easy Bike
            door: ok=true changedProgram=true
            "2 exercises swapped for a safe option; DB Shoulder Press,
             Lat Pulldown, Band Pull-Apart left out — nothing safe was available."
```

**A 4/10 shoulder niggle deleted horizontal push, vertical push, horizontal
pull and vertical pull from the athlete's week and replaced two of them with a
SQUAT.** Sam's own Bible, `docs/LFA_PROGRAMMING_BIBLE.md:2198`, says of that
exact band: *"4-5 / 10: reduce pressing volume/load, **use shoulder-friendly
variations**."* And `:1858`: *"keep safe training in the program where
possible"*; `:1868`: *"Default: an injury pauses AFFECTED-REGION work only."*

Knee/6 and Hamstring/8 on the same day correctly changed nothing (an upper day
is genuinely unaffected) — so the honest-message work already on `main` holds.

---

## THE THREE DEFECTS BEHIND THAT LINE

**D1 — THE FOUR AUTHORED BANDS ARE COLLAPSED TO TWO, AT THE WRONG EDGE.**
`tapSwapHierarchy.injuryLevel()` = `severityHasModerateEffect(severity) ? 'avoid'
: 'caution'` — the **4+** edge. `assessTapSwapCandidateSafety` then treats every
`caution`-rated exercise as ILLEGAL once the level is `avoid`. The Bible removes
risky work at **6-7**, not at 4-5. Measured: `Bench Press`, `Barbell Row`,
`DB Shoulder Press`, `Lat Pulldown` and `Band Pull-Apart` are all
`shoulder: 'caution'`, so a 4/10 shoulder makes an entire upper day illegal.
**Two owners of one fact** — `injurySeverityBands` is the authored table and the
ladder re-derives its own edge.

**D2 — THE INJURY LADDER IS A NAME-KEYED TABLE, SO RUNGS 1-3 ARE UNREACHABLE
FOR ALMOST EVERY ROW.** `injurySessionClassifier.REPLACEMENT_BY_BUCKET` is a
hand-authored map of ~40 exercise names across 9 of 13 buckets. Any row not
listed falls straight to `GENERIC_SAFE_BY_BUCKET`, which is `unaffected_body_area`
+ recovery — i.e. **rung 4**. Rungs 1, 2 and 3 are never attempted. That is the
edge-case table Sam's standing instruction forbids.

**D3 — SO WHOLE MOVEMENT PATTERNS ARE DELETED RATHER THAN SUBSTITUTED**, which
is what the probe line above actually is.

---

## LOG

- 2026-08-20 — worktree created, baseline measured, defects named. Nothing built yet.

---

## WHAT LANDED

### 1. THE LADDER IS DERIVED — `src/rules/injuryFallbackLadder.ts` (NEW, the owner)

`REPLACEMENT_BY_BUCKET` and `GENERIC_SAFE_BY_BUCKET` are **deleted**. The
behaviour is derived from typed metadata that already existed and that Sam
authored — `EXERCISE_TAGS.movement` (which carries the PLANE), `patternToSlot`,
`STRENGTH_POOLS[slot][role]` (anchor vs accessory, `group`, `loadRatio`), and
his ruled 2026-07-28 injury matrix, which this code READS and never edits.

Six rungs, each projecting onto the signed `SAFE_TRAINING_FALLBACK_TIERS`:

| rung | what | keeps the pattern? |
| --- | --- | --- |
| 1 | same movement, same role — another main lift in the same plane | yes |
| 2 | same movement other role, or the slot's other movement (squat ↔ lunge) | yes |
| 3 | authored isolation/trunk work for the same muscles | no — disclosed |
| 4 | the authored adjacent plane/pattern | no — disclosed |
| 5 | work the region is rated `good` for | no — disclosed |
| 6 | Sam's tier-C recovery conditioning | no — disclosed |
| — | nothing legal → the row is OMITTED and NAMED | — |

**R-103's recorded plane obstacle is answered.** It noted that `push`/`pull` as
`MainStrengthPattern` values carry no plane. The ladder never goes through that
type — it goes through `MovementPattern`, which has the plane. No mapping was
invented and no ruling pre-empted.

### 2. ONE PREDICATE, ONE BAND OWNER

`injuryPermitsExerciseAtSeverity` (`src/rules/injuryExerciseRisk.ts`) is now the
only place the four bands are read. `assessTapSwapCandidateSafety` and the
classifier both call it. Before, the tap surface decided from a two-value level
and the classifier decided again from the severity, so the coarser answer simply
overruled the finer one.

`TapSwapEnvironment.activeInjuries` is **deleted** — it was a stored projection
of `injurySeverities`, and the census's negative control read 32 exercises as
unsafe for a healthy athlete the moment both existed. It is projected at the
point of use now.

### 3. THE MEDICAL-STOP GATE IS SCOPED TO ITS OWN SUBJECT

`activeConstraintHardStops` refused every write while a `training_paused` injury
was live, including the injury's own recomposition. **Measured: the stronger the
injury, the less the app did about it** — 8/10 hamstring left four forbidden
lifts on the day; 6/10 recomposed correctly. The exemption is typed
(`substitutedFrom.cause === 'injury'`), reachable only by a FACT displacing a
row, never by an athlete's own swap.

---

## THE NUMBERS

**`npm run census:injury-fallback`** — one script, both trees, controls printed
on each run. 86 pooled strength exercises × 13 regions × 4 authored bands.
1569 occurrences need a fallback on BOTH trees (the denominator is read from
Sam's ratings and bands, not from the code under test).

| | control `9f081efa` | candidate |
| --- | --- | --- |
| kept in the same pattern+plane | **6** | **479** |
| replaced outside the pattern | 1563 | 1090 |
| worlds keeping nothing in pattern | **38 of 52** | **16 of 52** |
| same-pattern by band 1-3 / 4-5 / 6-7 / 8-10 | 0 / 2 / 2 / 2 | **8 / 447 / 12 / 12** |

The band row is the finding: **three of Sam's four bands used to behave
identically.** The 16 worlds that still keep nothing are exactly 6-7 and 8-10,
where his Bible removes risky work through the area and pauses affected
training — correct there, not a gap.

Per pattern (unsafe occurrences → same-pattern answers): squat 346→121,
hinge 171→43, horizontal_push 114→42, vertical_push 126→36, horizontal_pull
78→19, vertical_pull 72→12, carry 84→28, isolation_upper 270→94,
isolation_lower 170→39, plyo 138→45.

**Through the real door** (`npm run seed:injury-fallback`), the headline case:

```
hamstring 4/10, Monday 2026-07-20
  BEFORE  Leg Press@105, RDLs@67.5, Bulgarian Split Squats@25,
          Single-Leg RDL@20, Band Pallof Press@0
  AFTER   Leg Press@105, Glute Bridge@-, Bulgarian Split Squats@25,
          Single-Leg RDL@20, Band Pallof Press@0
  "Injury restrictions are active. 1 exercise swapped for a safe option."
```

One swap, not a session rewrite — `RDLs` is the only `avoid`-rated row, and
`Glute Bridge` is Sam's verbatim answer for it. That is *"swap obvious
aggravators, keep safe work in"* behaving as written.

---

## AN AUTHORED CONFLICT I DID NOT RESOLVE

`test:tap-swap-hierarchy` has three cells red on `main` and still red here:

- *"knee-blocked squat selects the curated posterior-chain option"* → `Hip Thrusts`
- *"same muscle group is used when safe same-pattern knee work is unavailable"*
- *"shoulder issue selects supported pulling before recovery"* → `Chest Supported Row`

They encode Sam's per-region **prose** (*"Heavy knee-dominant work -> hip
thrust"*, *"Usually okay: some pulling if tolerated"*). His ruled **matrix**
rates both `caution` for those regions, and his 6-7 band removes `caution` work
through the area. So two things he authored disagree, and the cells have been
red since the matrix landed.

**I tried the reading that would reconcile them and it was refuted by
measurement.** Admitting `caution` work at 6-7 unless it is heavy or
high-fatigue shipped three of his own bad swaps — `Broad Jumps` for a 7/10 knee,
`Single-Leg RDL` for a 7/10 hamstring, `Close Grip Bench` for a 6/10 shoulder —
and took `test:tap-swap-hierarchy` from 3 fails to 8. Reverted, and the
refutation is written into `injuryPermitsExerciseAtSeverity` so it is not
re-bought. **This is question 1 for Sam.**

---

## THE ONE DEFECT I MEASURED AND DID NOT FIX

**AN INJURY OMISSION LANDS IN THE ATHLETE'S OWN REMOVE LEDGER, AND RESTORE
CANNOT UNDO IT.**

Measured in a medical-stop world (`seriousSymptoms: true`, hamstring 9/10), on
this branch:

```
rows BEFORE          Leg Press, RDLs, Bulgarian Split Squats,
                     Single-Leg RDL, Band Pallof Press
exclusions BEFORE    []
rows AFTER           []
exclusions AFTER     5 entries — one per row, scope today_only
clear_injury         ok
rows RESTORED        []
exclusions RESTORED  the same 5 entries
```

An injury OMISSION is written through `remove_exercise`, which lands in
`athletePreferencesStore.exclusions` — the athlete's own decisions. Restore works
by RE-DERIVING (`settleDerivedWorldAfterDecision`), so it replays those
exclusions as if the athlete had chosen them. Substitutions restore correctly
because nothing durable holds them.

That is the mission's *"injury decisions and ordinary Remove decisions remain
owned separately"*, and they are not. It is **pre-existing** — the same
exclusions are written on `main` — but this branch does not fix it, because
fixing it means changing who owns a removal, and another lane signed *"No second
removal authority survives"* when `removeExerciseAtDate` was deleted.

**WHAT I DID DO:** the resolve no longer lies about it. It used to answer
*"Injury resolved. Affected sessions were safely recomposed."* over an empty
day — the same false-success claim this whole unit exists to delete, arriving
from the resolution end. It now says *"Injury cleared, but this session is still
empty — the exercises taken out for the injury have not come back."* Both the
defect and the honesty are pinned by cells in section [10] of
`test:injury-fallback-journey`, so neither can drift while it waits for a ruling.

**AN OMISSION IS ONLY REACHABLE THERE.** Measured across four kits (full gym,
bodyweight-only, dumbbells + bench, bands-only): **0 omissions out of 1049
unsafe occurrences in every kit.** Rungs 5 and 6 always have something
bodyweight-legal, so an ordinary injury never drops a row. Only a red-flag
medical stop, where the ladder returns REST, produces one.

**This is question 2 for Sam.**

---

## QUESTIONS FOR SAM — TWO, AND ONLY TWO

**REGISTRY-GREP: R-103, R-102, R-104, R-087, R-092, R-100, R-098, R-096.**
Neither question is answered by any of those rows: R-103 rules the ORDER of the
ladder and says nothing about which rating is legal at which band; nothing in
the registry rules who owns an injury-caused removal.

**1. Your Bible and your injury matrix disagree at 6-7/10.** Your knee section
says *"Heavy knee-dominant work -> hip thrust"* and your shoulder section says
*"some pulling if tolerated"*, but your ruled matrix rates `Hip Thrusts` and
`Chest Supported Row` as `caution` for those regions, and your 6-7 band removes
risky work through the area. Three cells have been red on `main` since the matrix
landed because of it. I tried the reading that would reconcile them — only
HEAVY caution work goes at 6-7 — and it shipped three of your own bad swaps
(`Broad Jumps` for a 7/10 knee, `Single-Leg RDL` for a 7/10 hamstring), so I
reverted it. **Which wins at 6-7: the matrix rating, or the region's named good
swap?**

**2. A red-flag injury empties the session and it never comes back.** Should a
red-flag injury (8-10 plus serious symptoms) TAKE the exercises off the day, or
leave them showing with *"skip these and check with a physio"*? Today it takes
them off, and because it does that through the same door as your own Remove,
clearing the injury cannot put them back.

---

## LOG

- 2026-08-20 — worktree created, baseline measured, defects named.
- 2026-08-20 — `f1e3eeea` the derived ladder + the band split.
- 2026-08-20 — `dc4356de` the journey, the mutations, the registry row, the seed.
- 2026-08-20 — the medical-stop world measured; the resolve stops claiming
  success over an empty day; the omission-ownership defect pinned, not patched.
