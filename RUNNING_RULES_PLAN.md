# Engine Running Rules — Plan for Sign-off

**Status: PROPOSAL — no code written. Approve, adjust, or reject before any
implementation.** This touches the program-generation engine (scheduler), so
per our working rules it gets a written plan first.

---

## 1. The rules we're encoding (Sam, 2026-07-03)

1. **Never more than 4 running sessions per week**, any phase of the year.
2. **In-season, running happens where footy happens**: team training days and
   game day carry the running load. The only standalone run the engine may
   schedule in-season is an **optional light Monday run**.
3. Everything else (engine-placed conditioning on empty days in-season)
   should be **off-feet** (bike/row/ski) so legs are fresh for footy.

---

## 2. What the engine already has (verified, file:line)

Good news: more exists than we thought.

- **Modality is real metadata, not name-guessing.** `CONDITIONING_META`
  (`src/data/exerciseTags.ts:99–137`) classifies all 34 conditioning
  templates with `modality: 'run' | 'bike' | 'row' | 'ski' | 'swim' |
  'mixed'` — 15 are runs. `isRunningBasedConditioning()`
  (`sessionBuilder.ts:1860`) reads it, **but falls back to a name regex**
  for unknown names (a small phrase-matching liability).
- **A 4-run cap already exists** — `MAX_RUNNING_SESSIONS = 4`
  (`sessionResolver.ts:1251`) inside Pass 2 of
  `resolveWeekWithConditioning()`. Over-cap runs are converted off-feet via
  `switchToOffFeetModality()` with the stimulus preserved and a coach note
  stamped ("Shifted off-feet to manage run load"). **Flying Sprints are
  exempt from conversion** (top-end speed must stay on grass) but still
  count.
- **In-season already caps standalone conditioning** to 1 primary session
  per week (`inSeasonPrimaryCap`, `sessionResolver.ts:1243`), flushes
  excluded.
- **Pre-season team-day guard** already blocks standalone conditioning on
  team training days (`sessionResolver.ts:1255–1270`).

## 3. The actual gaps

1. **The 4-run counter is blind to most of the week.** `runningSessionCount`
   starts at 0 and only counts sessions Pass 2 itself places on empty days.
   It never sees: runs already on the board from templates/AI plan (e.g.
   strength days with an aerobic finisher), team training days, game day,
   manual sessions, or future coach-added run templates. Today that mostly
   works by luck (coach templates are all ergs; strength finishers are
   modality-flexible), but the cap is enforced against a partial count —
   one representation of "how many runs this week" that doesn't match the
   week the athlete sees.
2. **No in-season placement rule.** In-season, Pass 2's single primary
   conditioning session can be a run on any empty available day — nothing
   says "off-feet unless it's the Monday light run".
3. **No tests** reference the running cap at all (grep confirms), and no
   post-generation verification exists — every constraint is inline and
   nothing checks the finished week.

---

## 4. Two options (as required before scheduler surgery)

### Option A — incremental patch inside Pass 2
Seed `runningSessionCount` by scanning the whole week's existing board
before the placement loop; add an in-season branch that forces off-feet
except Monday-light. Smallest diff (~40 lines in `sessionResolver.ts`).
**Weakness:** the count and the rules stay buried mid-pass; team/game
running exposure is still invisible to it; the next source of running
sessions (coach templates, new features) bypasses it again. Same class of
bug returns later — this is exactly the "one more guard" pattern the repo
rules warn about.

### Option B — one owner for the week's running budget (RECOMMENDED)
Create a single pure function as the **only authority** on running load:

```
assessWeekRunningLoad(weekDays, context) → {
  runsOnBoard,          // counted from EVERYTHING visible: placed sessions,
                        // team training days, game day, manual/marked days
  standaloneRunsAllowed,// 4 − runsOnBoard (floored at 0)
  inSeasonRunDays,      // in-season: team days + game day (+ Monday if enabled)
}
```

- **Pass 2 consults it** instead of keeping its private counter: a run may
  be placed only if the budget allows AND (in-season → the day is in
  `inSeasonRunDays`). Otherwise `switchToOffFeetModality()` as today.
- **Post-generation verification** (new, small): after Pass 4, re-run the
  assessor on the finished week and log/fail-loud in dev if the invariant
  is violated. First verification step the generator has ever had — same
  philosophy as the coach pipeline's projection verification.
- **Retire the name-regex fallback**: unknown conditioning names become a
  loud dev warning instead of a silent guess, making `CONDITIONING_META`
  the sole modality authority.

Why B: it removes representations (one "what is a run" authority, one
"this week's run count" authority), it covers every current and future
source of running sessions including the coach registry, and the whole
class of "counter didn't see X" bugs dies rather than one instance of it.
Estimated ~120 lines + tests, all in the generation layer — the coach
revision pipeline is untouched.

---

## 5. Decisions needed from you before coding

1. **Do team training days and game day count toward the 4?** Your wording
   suggests yes (it's total leg load): e.g. 2 team sessions + 1 game = 3,
   leaving room for 1 standalone run. Confirm, or is the cap for
   standalone conditioning runs only?
2. **Monday light run — on by default in-season, or opt-in?** And "light"
   = which template(s)? (Suggest: Flush Run / Long Nasal Run tier only.)
3. **Flying Sprints in-season**: currently never converted off-feet. Keep
   that exemption in-season even if it lands outside team/game/Monday days,
   or should in-season pin it to a team-training day?
4. **Off-season/pre-season**: rule 1 only (cap 4, current behavior), no
   placement restriction — correct?

## 6. Test plan

Unit: assessor counts runs from mixed sources (placed + team + game +
manual); cap math; unknown-name warning. Resolver e2e (extend
`conditioningRotationTests.ts` + `weekPlanQA.ts` harness): in-season week
with Tue/Thu team + Sat game → zero standalone runs (or Monday-light only);
off-season week where rotation wants 5 runs → 4 run + 1 converted with the
shift note; bye week unchanged; Flying Sprints behavior per your answer to
Q3. Regression: full existing suite must stay green — rotation stability
contracts especially (already-generated weeks must not reshuffle).

## 7. Risks

- **Board churn:** weeks already generated could re-resolve differently if
  counting changes what converts. Mitigation: rotation-stability tests are
  the gate; if any existing-week snapshot changes, we stop and reassess.
- **Pass 2 blast radius:** changes stay additive (consult the assessor,
  don't restructure the loop).
- **Live verification requires a Metro restart per round** (known
  limitation) — will batch the whole change and request one restart.
