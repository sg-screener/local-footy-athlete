# THE MODERATE DAY — MEASURED ACROSS ALL 17 QA SCENARIOS

**2026-08-12, unattended session.** Inbox item 4, step 1: *"MEASURE FIRST: print
the count across all 17 `test:qa` scenarios."* **Measurement only. No rule was
changed, no generation target was moved.**

Sam's shape (`LFA_PROGRAMMING_BIBLE.md:4808`): *"4 hard days plus 1
moderate/easy day"*. Standing stand-down A applies and is respected here: *"5
hard days is okay"* — **five is NOT counted as a defect below.** The question is
only whether the **moderate** half ever happens.

---

## §1 THE NUMBERS

`LFA_HARD_DAY_PROBE=1 npm run test:qa`, `MODERATE_DAY_PROBE` lines.

| scenario | hard | moderate | active rec. | true rest | 4+1 met |
|---|---|---|---|---|---|
| S1 In-season, Sat game (baseline) | 5 | **0** | 1 | 2 | no |
| S2 In-season, Sun game | 5 | **0** | 1 | 2 | no |
| S3 In-season, Fri night game | 4 | 1 | 1 | 3 | **MET** |
| S4 In-season, bye week | 5 | **0** | 0 | 2 | no |
| S5 Off-season, 5 days, team Tue+Thu | 1 | 2 | 0 | 6 | no |
| S6 Early off-season wk1, 4 days | 1 | 2 | 0 | 6 | no |
| S7 Off-season, 6 days, team M/W/F | 4 | 2 | 0 | 3 | **MET** |
| S8 In-season Sat, team Mon+Wed | 4 | **0** | 1 | 3 | no |
| S9 In-season Sat, team Tue only | 4 | **0** | 1 | 3 | no |
| S10 In-season Sat, team Tue+Wed+Thu | 5 | **0** | 1 | 2 | no |
| S11 Pre-season, Sat game, 5 days | 5 | **0** | 1 | 2 | no |
| S12 Pre-season, no game, 5 days | 3 | 2 | 0 | 4 | no |
| E1 Remove game (Sat → none) | 5 | **0** | 0 | 2 | no |
| E2 Move game (Sat → Sun) | 5 | **0** | 1 | 2 | no |
| E3 Add game back | 5 | **0** | 1 | 2 | no |
| S13 In-season, 3 days only | 5 | **0** | 1 | 2 | no |
| S14 In-season, low readiness, injuries | 4 | **0** | 1 | 3 | no |

## §2 WHAT IT SAYS — and it is sharper than "held by nothing"

**2 of 17 scenarios meet Sam's shape.** S3 and S7.

**11 of 17 have ZERO moderate days.** Not "too few" — none at all.

**AND THE SPLIT IS NOT RANDOM. It is SEASONAL, and that is the finding.**

- **Every in-season and pre-season scenario with a fixture has `moderate=0`** —
  S1, S2, S4, S8, S9, S10, S11, S13, S14, E1, E2, E3. Twelve of twelve, with S3
  the single exception (a Friday night game, which moves the whole week).
- **Every moderate day the app produces is in an OFF-SEASON or no-fixture
  week** — S5, S6, S12 (and S7, which is off-season and also the only 4+1 week
  with more than one).

So the moderate tier is not merely unguarded; **in the season the athlete
actually plays in, it effectively does not exist.** A fixture week is built as
hard days plus recovery and full rest, with nothing in between.

**S14 is the one that should worry someone most.** Low readiness AND injuries,
and the week still lands 4 hard / 0 moderate / 1 active recovery. The week that
most obviously wants a moderate day is not given one.

## §3 THE FIELD IS STILL UNREAD — verified, not recalled

`achievedModerateDayCount`: **one write** (`section18EffectiveWeekEvaluator.ts:1034`),
**one type declaration** and **one null initialiser** (`weeklyExposureContractV2.ts:443`,
`:1344`), and **zero readers** across `rules/ utils/ screens/ hooks/ store/
services/ components/`. Every other match in `src/` is a test.

Its hard-day twin has a preferred range, a permitted maximum, an authorised
excess and two findings. **The two halves of one sentence in the Bible are not
built to the same standard**, which is exactly what item 4 says.

## §4 WHAT THIS MEASUREMENT DOES **NOT** SAY

- **It does not say the weeks are wrong.** Sam ruled five hard days acceptable,
  and a fixture week legitimately carries more hard days than an off-season one.
  What it establishes is that the *preference* has no expression and no voice.
- **It does not price the generation change.** Moving 12 fixture weeks from 0 to
  1 moderate day changes what every in-season athlete sees; nothing here says
  which session should become moderate, or at whose expense.
- **`test:qa` is RED and was red before this** — 84 failures, **identical set
  name for name** (diffed, not counted), dominated by a stale `isTeamDay` flag
  that has nothing to do with this. The probe is inert without
  `LFA_HARD_DAY_PROBE=1` and changed no scenario's result.
- **Nothing was measured on a device.**

## §5 THE NEXT STEP, WITH ITS BASELINE NOW IN HAND

Item 4's own prescription, unchanged: **`preferredModerateDayRange` + an
ADVISORY finding, never blocking** (`:4810`), then a generation target toward
4+1. §1 is the before-picture that makes the after-picture checkable — **the
advisory must fire on 11 scenarios the day it lands, and on S3 and S7 it must
stay silent.** A finding that fires everywhere or nowhere is not measuring
Sam's shape.

**One instrument, not two.** The numbers above come from extending the existing
`HARD_DAY_PROBE` seam rather than adding a second flag for the same question.

**NORTH STAR: neutral.** This stores nothing and derives nothing; it reports.
