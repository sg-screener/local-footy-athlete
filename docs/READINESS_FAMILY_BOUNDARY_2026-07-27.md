# Readiness law family — closing report, 2026-07-27

Branch `close/readiness-law-family`, merged `--no-ff` to `main`.
`test:bible` **EXIT=0**. `stash@{0}` left untouched.

## The one principle

Sam's ruling, which every fix below is a single application of:

> The deload law changes dose and intensity inside sessions, never session
> identity or count. Counting counts structure; intensity and prescribed volume
> must never feed identity.

The family turned out to be **one defect wearing five costumes**: a number that
describes *how hard* or *how much* was being read to decide *whether something
exists*. Each site was found the same way — a deload softened something, and a
session silently left the week's count.

| where | what read intensity as identity |
|---|---|
| row classifier | main-lift role from prescribed **sets + row position** |
| deload transform | its own main-lift test, keyed on the **raw** name while §18 resolved the alias |
| anchor ledger | one boolean answered "is this an exposure?" *and* "was it hard?" |
| safety policy | a readiness deload demoted the athlete's **game participation**, deleting its credit |
| optional week | `targetCount: 0` lifted the requirement *and* stopped the sessions being built |

## What was diagnosed and fixed

**1. The originally-identified failing case.**
`acceptedStateTransactionTests.ts:846`, the `sore` iteration — moderate soreness,
Wednesday 2026-07-15, Pre-season. All three prior hypotheses were wrong: the
contract was correct (target 4, no reductions) and remainder scoping worked
(`governedFromISO` set, delivered days preserved). Saturday's hinge lift was
still there — it had been **reclassified**. `Romanian Deadlift | main_strength |
3x` → `strength_accessory | 2x` at index 2, because the deload halved its sets
and trimmed the accessories out from in front of it. Only moderate-load lifts
could be demoted this way; high-load lifts qualify on the registry tag alone.
Masked on `main` by the retired `moderate_reduction` tier lowering the target to
2 — the readiness law removed the mask, not the defect.

**2. Four regressions the gate had never reached.** `test:bible` stops at the
first failing suite, so a stash recorded as "RED: 1 property test" was hiding
four more, all passing on `main`. Every one is fixed.

**3. The conditioning count** (Sam's ruling). Anchor credit conflated four
questions behind `participation === 'normal_unrestricted'`. Split at all four
sites together — ledger, claim owner, planner fill, validation guard — because
leaving any one would have restored the conflation from that side. Then the root:
**readiness no longer withdraws field participation**. That clause justified
itself as safe because low readiness "authors matching main-strength,
conditioning and sprint reductions in the same pass" — the readiness law deleted
exactly those, leaving the contract asserting both "the athlete's game produced
no sprint" and "this week requires a sprint exposure". A game is not a session
the app doses; demoting it was the app inventing a fact about the athlete.

**4. The optional stamp.** A pre-season "absolutely cooked" week arrived as six
recovery sessions where the athlete had four strength sessions — "nothing is
required" implemented as "nothing is offered". One number was doing two jobs.
`targetCount` is structure and is now preserved; `plannerSelectionKind:
'optional'` is the single owner of the commitment — which exposed that
`sprintHighSpeed` never passed `selectionKind` at all and silently defaulted to
`'core'`, holding every optional week to a sprint target it has none of by
design. The delivered-day half needed no change: T4 already pins it, green.

**5. Tasks 8 and 9 landed** — 3 structural ratchets + the behavioural
`INV_LOW_READINESS_MAKES_NO_COUNT_REDUCTION` for both acting tiers.

## Authored tests re-pointed — FLAGGED FOR SAM

Four assertions pinned behaviour these laws superseded. Each was re-pointed at
what its own name says, and **strengthened** rather than relaxed. Please confirm:

| test | was | now |
|---|---|---|
| illness invariant 10 | `weekKind === 'deload'` (a retired proxy) | `deloadDoor` recorded **and** the main-lift dose actually shrank |
| gateway 43 / P15 / M15 | restricted anchors get **no** credit of any kind | conditioning credited (attendance) **and** sprint/hard still denied — pins the whole split |
| accepted-state regression 7 | low readiness **deletes** the day's power block | the day is still offered and its dose shrank |
| readiness-illness Bible check | regex demanded quotes the sentence never had | matches the authored wording |

The power one matters most: safety scenario 4 and property P2b both assert a
deloaded week **keeps** power ("a deload is not a reason to lose sharpness").
Regression 7 asserted the opposite and only passed because the week had been
emptied by defect 4.

## Gate state

| | start | end |
|---|---|---|
| `test:bible` | fails at suite 7 of 48 | **EXIT=0** |
| `test:accepted-state-transactions` | 9/10 properties | 25/25, 10/10, 10/10 |
| `test:readiness-ownership` | 20/22 | 22/22 |
| `test:illness-recovery-mode` | 10/16 | 17/17 |
| `test:readiness-illness-law` | 64/71 | 112/112 |
| `test:deload-law` | 47/47 | 50/50 |
| `test:section18-safety` | 30/30 | 32/32 |
| `test:section18-v2` | 57/57 | 69/69 |
| `test:fact-horizon` | 13 failures | 14/14 |
| `test:compile` | — | PASSED; 3 ratchet improvements locked in |

## NOT COVERED

1. **No device or simulator pass.** Per Process Law L10 nothing here is "done"
   until Sam accepts it on a real phone. This is the only gate that matters now.
2. **The four re-pointed assertions** above are mine, not Sam's. If any reading
   is wrong, the fix underneath it needs revisiting, not just the test.
3. **Pattern selection shifts slightly on an optional week.** Pre-season cooked
   keeps all 4 strength sessions on the same days, but two swap emphasis
   (`Upper Pull`→`Upper Push`, `Lower Hinge`→`Lower Squat`) and one Recovery day
   became Rest. Session COUNT and days are preserved, which is the law; the
   pattern rotation inside them was not investigated.
4. **Only `test:bible` was run** (48 suites incl. `test:compile`). The separate
   `test:scenarios`, `test:qa`, `test:bible:extended` and the Maestro E2E lanes
   were not.
5. **Migration fossils left in place**, deliberately out of scope: `if (false)`
   and `true &&` remnants in `coachingEngine.ts`, and the dead
   `readinessDeloaded || readinessDeloaded` branches in `recoveryAddonCoverage.ts`.
   They are inert; a sweep is its own unit.
6. **`optional_week` is still named for illness.** The mode is minted by
   readiness too. Renaming touches the §18 mode union, the subphase union and the
   reduction reasons — recorded as naming debt by the migration, still owed.
