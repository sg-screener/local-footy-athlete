# STATUS — seat `sim`

Item 66 — THE SYNTHETIC ATHLETE. Claimed 2026-08-13. One writer: `sim`.

Run it: `npm run sim:changeover` (add `--profile <id>` for one).
Output: `docs/simulated-changeover/*.md`, five profiles.

## The order, restated as acceptance criteria

- Walk the clock forward a day at a time, completing sessions through the
  app's **REAL** completion path, to four profiles: does everything / misses
  every Friday / away for week 3 / declares sore in week 2. **DONE.**
- Reuse `DevE2EClock` — do **not** write a second clock. **DONE.**
- Reuse item 65's printer — do **not** write a second printer. **PARTIAL, and
  the blocker is named at F6.** No second renderer was written.
- Writing completed-session records straight into storage is the WRONG answer;
  if the real path cannot be driven headlessly, the blocker IS the finding.
  **The real path CAN be driven headlessly — see F1. Nothing was faked.**
- DONE WHEN week 1 and week 5 print side by side per profile with a statement
  of what changed and whether it should have. **DONE structurally.**

## Non-goals

Not a screen, not a feature, not a product change. No new stored state. No app
file was edited by this seat.

## What was built

`scripts/simulate-changeover.ts`. Fresh install → onboarding → generation, then
five weeks walked ONE DAY AT A TIME. Each day: set the clock, roll the block if
the app says to, walk any scripted door, record the day's session.

Every step is the product's own owner:

| step | owner |
| --- | --- |
| today | `setDevE2EClock` → `appDate.todayISOLocal()`, asserted to agree |
| generation | `generateProgramLocally` |
| publish | `commitRebuiltProgram` → `commitAcceptedStateTransaction` |
| four-week changeover | `getProgramBlockRolloverStatus` + `rolloverProgramBlock` |
| away | `executeProgramControlActionDurably` with an `awaySpan` |
| the weight box | `useWorkoutLogStore.logSet` + `setWeightOverride` |
| the feedback form | `buildStrengthPerformanceLogs` + `buildSessionFeedbackPayload` |
| **recording the session** | **`commitSessionOutcomeTransaction`** |

**NOT the `athleteActionWalker` ENGINE, and its own file says why:** `perform`
is synchronous and this transaction is awaited
(`athleteActionWalkerTests.ts:595`), and its host is an unexported module-scope
const inside a 3,979-line suite. So this reuses the walker's DOORS. No door is
duplicated here.

## Findings

### F1 — THE REAL COMPLETION PATH IS DRIVABLE HEADLESSLY. NO BLOCKER.

`commitSessionOutcomeTransaction` (`sessionOutcomeTransaction.ts:196`) is the one
live writer; its callers are the athlete's doors (`useHomeScreen.ts:1370`,
`SessionFeedbackPanel.tsx:308`/`:927`) and the coach's one
(`coachSessionOutcome.ts:118`). Five existing suites already drive it from node.
**150 sessions were recorded across five profiles with 0 refusals and 0 throws.**
The order's "if the real path cannot be driven headlessly" clause has nothing to
report.

### F2 — THE HEADLINE: FOUR WEEKS OF THE ATHLETE'S TRAINING CHANGES NOTHING ABOUT WEEK 5

Five athletes, same onboarding answers, five genuinely different histories:

| profile | feedback days | loads typed in | soreness answers | week 5 vs the first |
| --- | --- | --- | --- | --- |
| does everything | 30 | 0 | 0 | — |
| does everything **and logs every weight** | 30 | **23 days, 67 loads** | 0 | **IDENTICAL** |
| misses every Friday | 25 | 0 | 0 | **IDENTICAL** |
| away for week 3 | 24 | 0 | 0 | **IDENTICAL** |
| declares sore in week 2 | 30 | 0 | **6** | **IDENTICAL** |

**Week 5 is BYTE-IDENTICAL in all five.** Week 5's content comes from
regeneration at block rollover, not from anything the athlete did.

The 67 loads are the anti-no-op check: the logging really landed, so this is
"logging changed nothing", NOT "no logging happened". Held by the census printed
in every report.

### F3 — WEEK 5 *DOES* DIFFER FROM WEEK 1, BUT BY SUBSTITUTION, NOT PROGRESSION

5 of 7 days differ, and the mechanism is exercise rotation rather than load
moving on a lift the athlete has been doing. Monday: `Deadlift @ 102.5kg` →
`RDLs @ 90kg`, and `Leg Press @ 137.5kg` → **`Bodyweight Squat @ 0kg`**. Week 5
Monday carries a `Bodyweight Squat` AND a `Back Squat`, both unloaded, for an
athlete with a full rack who squats 1.5× bodyweight. The whole Friday Gunshow
list is swapped.

Rotation replacing a loaded lift with an unloaded one is the
[[rotation-undoes-the-composer]] shape seen again.

### F4 — A SESSION TICKED COMPLETE WITH NO WEIGHT ENTERED IS INVISIBLE TO PROGRESSION

`strengthProgressionIntegration.ts:195` keeps a session only when
`feedback.strength` is non-empty or it was skipped. Nothing warns the athlete
that ticking without logging discards the session for progression purposes.
Seat `printer` is right that this is a live product question, not merely the
harness note it started as.

### F5 — EFFORT IS 1-10 AND 1-5 IS SILENTLY VALID ON IT

`difficulty: 3` meaning "middling on a 1-5 scale" is `<= 5` on the real scale,
which is `feedbackAdapter`'s EASY arm and ADDS volume. My "declares sore"
athlete was telling the app the sessions were easy until this was found. Not a
wrong value — a value valid on both scales meaning opposite things, the same
class as `docs/EFFORT_SCALE_INVERSION_2026-08-12.md` when it was a live defect.

### F6 — ITEM 65'S PRINTER: THE SEAM IS EXPORTED, THE MODULE IS NOT IMPORTABLE

Both `projectWithGapsMarked` and `renderWeekAsPlainEnglish` are exported
(`601339fc`, after I reported the first was not). **But `scripts/print-week.ts`
ends in a bare `main();`**, so importing it runs the printer's whole six-week
generation and rewrites `docs/printed-weeks/` as a side effect. Asked `printer`
for `if (require.main === module) main();` rather than editing their live file.

Until then this report is STRUCTURAL and invents no athlete-facing words. The
chain is ready: accepted state → `buildProgramTabProjectedWeek` →
`projectWithGapsMarked` → `renderWeekAsPlainEnglish`.

### F7 — THREE DEFECTS IN MY OWN HARNESS, EACH ONE STEP FROM A FALSE REPORT

Recorded because each would have reached Sam as an app defect:

1. **Completion-only feedback** → first run recorded 30 sessions that
   progression could not see, and produced an identical week 5 across profiles.
   That reads exactly like F2 and was not F2. F2 only became reportable after
   the strength logs, the weight box and the 67-load census.
2. **Effort on the wrong scale** (F5) — inverted the sore athlete.
3. **Printing sets and reps but not WEIGHT** — five days read "unchanged" while
   their loads had moved. Progression lands on `prescribedWeightKg`.

And one caught by `printer`'s output rather than mine: I nearly reported the
0kg loads as athlete-visible. Their plain-English week prints **no weights at
all**, so that number lives below the glass. Quoted in F3 as structural only.

## Cross-checks with seat `printer`

- Their fresh in-season Monday flags `Short Flush — 1 × 1` as "not a
  prescription"; my structural dump shows `1 sets × 1` on the same day. Two
  paths, same defect, so it is in generation and not in either reader.
- Their six weeks are freshly generated with **no history**, so nothing they
  printed passes through the progression paths at all. F2/F3/F4 are only
  reachable from a lived-in week, which is what this item has and theirs
  does not.
- Their warning about hand-built `ScheduleState` does not apply here:
  state comes from `buildScheduleStateImperative()` off live stores. The
  in-season Saturday game does render.

## Not covered — stated rather than implied

- **No bye week in the five.** `markedDays[date] === 'noGame'` is what
  suppresses the virtual fixture (`sessionResolver.ts:707`); untested here.
- **One onboarding profile only** (in-season, full kit, Saturday game, two club
  nights). The five profiles differ in BEHAVIOUR, not in who the athlete is.
- **Five weeks, one block rollover.** A second changeover is unwalked.
- **No injury, illness or coach mutation** in any profile.
- **F2 is measured on this profile.** It is a strong claim on one athlete shape,
  not a proof across all of them.
