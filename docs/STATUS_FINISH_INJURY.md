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
