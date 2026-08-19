# STATUS — seat `orchestrator`

Opened 2026-08-19 from `20cb1422`. One writer: `orchestrator`. Name checked free
against `ls docs/STATUS_*.md` before the first commit.

## Mission

Take over integration of the four `codex/finish-*` lanes. Trust no lane's own
completion claim. Independently inspect state, fix or reject candidates, and
prove the two UI contracts on glass before declaring the UI corrected.

## FINDING O-1 — THE DAY-SCREEN DEFECT IS ON `main`, NOT IN ANY CANDIDATE

**No lane reported this.** QA routed the Day/Session contract as future work for
the *product* candidate ("the next tip must prove the two action sets
separately"). It is not future work: `main` @ `20cb1422` already ships the wrong
Day screen, and all three candidates branch from it, so all three inherit it.

Measured at `src/screens/home/HomeScreenV2.tsx` on `20cb1422`:

- lines ~988-1010 — `<SessionChangeHub testID="home-change-card">` renders the
  FIVE session actions (Equipment · Injury · Add · Remove · Swap) inside the
  original "Need to make a change?" card;
- lines ~1020-1055 — a SEPARATE, card-less `View testID="home-life-fact-chips"`
  holds only Tired and Sick;
- the `Injured` `LifeFactChip` (red `#FF7F7F` medical cross,
  `home-injured-entry`) is GONE from the Day screen. Injury is now the hub's
  amber-adjacent warning-triangle glyph.

The authority `1a7e7bd0:src/screens/home/HomeScreenV2.tsx` lines 858-935 has
exactly the contracted shape: one `Card testID="home-change-card"` with
signedCopy heading + subline, containing three chips —

| chip | testID | stroke | glyph |
|---|---|---|---|
| Tired | `home-tired-entry` | `#67D7FF` cyan | battery `M3 8h15v8H3z` + terminal |
| Sick | readiness set/update id | `#FFCA68` amber | thermometer `M10 5a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0Z` |
| Injured | `home-injured-entry` | `#FF7F7F` red | cross `M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z` |

**So the corrective work is a change to `main` itself.** Product `fe6ed715` is
Coach work and does not touch either screen; holding it does not fix this.

## FINDING O-2 — THE HUB HARD-CODES ITS ACTION LIST

`SESSION_CHANGE_ACTION_IDS` in `src/components/SessionChangeHub.tsx` is frozen
at the five session actions, with per-id tints and glyphs in closed `Record`s
and a non-exhaustive-safe `switch`. Sam's contract permits a shared visual
component but forbids a hard-coded action list. The component must carry
`tired`/`sick`/`injured` identities too, and neither surface may reach for a
list it did not pass in.

## Candidate verdicts (independent)

| lane | tip | my verdict | basis |
|---|---|---|---|
| journey | `74c593aa` | MERGE-ELIGIBLE, guards only | `git diff --name-only main...` = 1 doc + 2 test files. Zero production bytes. Ruling conflict raised to Sam, not decided here. |
| programming | `12fac3f1` | HOLD | QA's 84 duplicate identities / 36 bodyweight bench cues / red travel worlds, to be independently reproduced before any ruling. |
| product | `fe6ed715` | HOLD | unreviewed by QA; does not address O-1. |
| qa | `5f94d6e7` | evidence only | consumed as input; its artifacts are not a merge candidate for product code. |

## Log

- 2026-08-19 — seat opened; O-1 and O-2 recorded before any write.

## FINDING O-3 — UNDO IS UNREACHABLE FOR A SESSION-SCREEN REMOVAL

`UndoToast` mounts on the Program screen and nowhere else, by the 2026-08-09
ruling (*"This mounts once, on the Program screen"*). A removal driven from the
pushed session screen therefore raises its toast on the screen BEHIND it, where
its six-second life expires unseen.

The Day-screen Remove chip had been hiding this: it was added on 2026-08-19 with
the explicit reasoning *"UndoToast mounts here, so a removal driven from here
finishes where the toast appears"*. Sam's contract removes that chip, so the gap
is now live for every one of the five session changes, not just Remove.

**NOT FIXED HERE, DELIBERATELY.** A second `<UndoToast />` mount would breach the
one-mount ruling and put two nodes under one `undo-toast` testID. The fix is
either a ruling change (the toast may mount per-surface) or a navigation change
(a session-screen change returns to Program). Both are Sam's, not mine.

Undo's own behaviour stays covered headlessly by `test:undo-reversal`. The Undo
half of `.maestro/visible/remove-hub-labelled.yaml` was removed with this reason
written into the flow, not silently dropped.

## FINDING O-4 — THE APP COULD NOT LAUNCH ON ANY SIMULATOR FROM THIS TIP

`Cannot find native module 'ExpoPushTokenManager'`, thrown from
`journalReminderService.ts:33` through `AppNavigator` before any screen mounts.

`expo-notifications` has been a package.json dependency since `8b12fcdd`
(2026-08-09) and `ios/Podfile.lock` carries `EXNotifications 0.32.17`, but **no
installed simulator binary contained it** — checked across every simulator on
this machine, including the four installed today. The newest DerivedData build
was 2026-08-12 and its `Frameworks` held three entries with no notifications
module.

So every simulator pass on `main` died at boot. Fixed by `pod install` (needs
`LANG=en_US.UTF-8`; CocoaPods 1.16.2 on Ruby 4.0.1 raises
`Encoding::CompatibilityError` otherwise) then `npx expo run:ios`. **No tracked
file changed** — `ios/Podfile.lock` and the xcodeproj are byte-identical after.

⚠ This is why QA's release manifest marks all four simulator cases NOT RUN and
why their isolated clone "exited during seeding without a crash receipt". It was
not an instrument-isolation problem; the binary was stale.

## FINDING O-5 — SHEET ROWS ANNOUNCE THEIR TEST ID INSTEAD OF THEIR WORD

`ExerciseSheetOption` sets `accessibilityLabel={testID ?? label}` on a
`accessibilityRole="button"` Pressable, which makes the row ONE accessibility
leaf. The athlete's word is not in the accessibility tree at all: a screen-reader
user hears `component-delete-action-dev-e2e-standard-in-season-week-2026-07-13-
dow-1-…-ex-squat-1` where the screen plainly reads "Back Squat".

Measured against the live hierarchy: `assertVisible: "Back Squat"` fails on a
screen whose debug screenshot shows "Back Squat" in 34pt type.

Six call sites share the pattern — `DayWorkoutScreenV2`, `PlanChangeSheet`,
`GuidedInjuryFlowSheet`, `HomeScreenV2`, `EquipmentLimitationSheet`,
`StoredStateExportButton`. It is its own unit, not a line in a Maestro flow.

## PROGRAMMING CANDIDATE `12fac3f1` — MEASURED AT BOTH ENDS

QA's own matrix script (`scripts/run-programming-release-matrix.ts` from
`codex/finish-qa`) run by me in two detached worktrees, unchanged:

| | `20cb1422` base | `12fac3f1` candidate |
|---|---:|---:|
| built / refused | 140 / 40 | **180 / 0** |
| findings | **44** | **3** |
| duplicate workout occurrences | 50 | 84 |
| cue-conflict occurrences | 16 | 36 |

**QA'S THREE BLOCKERS ARE ALL PRESENT AT BASE TOO, AND THE CANDIDATE CLEARS 41
FINDINGS THAT ARE NOT.** The 41 are the Off-season anchor class — a base
Off-season week publishes `d2:Team Training, d4:Team Training, d6:Game` in 40
worlds, plus the four-week block control. That is a worse athlete-visible defect
than any of the three that remain.

The duplicate delta, counted exactly rather than in aggregate:

| collision | base | candidate | delta |
|---|---:|---:|---:|
| Outdoor Aerobic Run / Running Intervals `[strength_accessory+conditioning]` | 42 | 48 | +6 |
| Explosive Push-up `[main_strength+strength_accessory]` | 8 | 4 | −4 |
| Explosive Push-up `[power+main_strength]` | 0 | 12 | **+12 NEW** |
| Explosive Push-up `[power+strength_accessory]` | 0 | 20 | **+20 NEW** |

⚠ **THE 32 NEW ONES ARE THE CANDIDATE'S OWN, AND EVERY SINGLE ONE IS A
`Bodyweight Only` WORLD.** Not one occurs in Full Gym or Dumbbells. The
signature is a small legal pool: the candidate's power materialisation picks an
exercise the same day's strength block already holds, and in a zero-equipment
world `Explosive Push-up` is one of very few legal power options. The +6 running
collisions are the pre-existing class reaching six worlds that previously
refused to build at all.

The cue conflicts (16 -> 36) are the same: one content defect
(`Copenhagen Plank (Half)` cues a bench under an empty equipment declaration)
exposed in more worlds because more worlds now build. **The candidate does not
create it.**

The travel partial-trip finding is byte-identical at base and candidate.

**VERDICT: HOLD, WITH ONE NAMED BLOCKER** — the 32 power/strength collisions.
The rest of the candidate is a large net improvement and the other two findings
are `main`'s, not its.

## THE PROGRAMMING BLOCKER, DIAGNOSED TO ITS ROOT AND PARTLY FIXED

Branch `orchestrator/power-primer-yields` @ `a1f91e27`, off `12fac3f1`.
**NOT PROPOSED FOR MERGE** — see the open question below.

`materialiseComposedWeek` drops the power primer when its identity is already
in the day's strength rows, compared with the composer's own
`composedIdentityFor` so it cannot disagree with the census that found the
defect. Re-measured with QA's matrix: **84 -> 52 duplicate occurrences, still
180/180 built, 0 refused, findings unchanged at 3.**

The 52 that remain are 48 running `[strength_accessory+conditioning]` and 4
push-up `[main_strength+strength_accessory]`. **All 52 are `main`'s class**; base
carries 50 of them over 140 built worlds (0.357 per world) against 52 over 180
(0.289). A general row-deduplication pass belongs to the composer and is not
this line's job.

### THE ROOT IS A ONE-MEMBER POOL, NOT THE CANDIDATE

`Explosive Push-up` is the **only** `upper` entry in `POWER_EXERCISE_POOL`. In a
`Bodyweight Only` world it is also a legal main/accessory push, so the power
pool and the strength pool intersect in exactly one exercise and both reach for
it. Full Gym and Dumbbells worlds produced **zero** collisions. The candidate's
`01fa17eb` did not create the overlap; it made the overlap visible by letting a
power row reach an athlete for the first time.

### THE COST, STATED

`generatedPowerDeliveryTests` **7/7 -> 5/7**, both failures in one Bodyweight
world whose strength block is `Explosive Push-up, Scap Push-Up`:
"the composer delivers the complete selected allowance" `{budget:2,rows:1}`, and
the club-night visibility cell.

⚠ **I DID NOT EDIT THOSE CELLS.** In that world the allowance is deliverable
only by printing one exercise twice. The guard and the fix are two answers to a
product question; editing the guard to match my change is the
expectation-edited-to-match-the-regression shape.

### THE OPEN QUESTION — SAM'S

REGISTRY-GREP: **R-076, R-081, R-015.** None rules on power/strength identity
collision or on the size of the upper power pool. R-081 settles how a contrast
partner is chosen (by family, *"similar is right"*); it does not say what happens
when the partner and the lift are the same movement.

Zero-equipment world, the only explosive upper movement is already the athlete's
strength lift that day:

- **(a)** no power primer that day — `a1f91e27`;
- **(b)** the movement appears twice — the candidate today;
- **(c)** the pool gains more upper entries so a non-colliding option exists.

**(c) is almost certainly right and is a content ruling on Sam's own
`docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md`.** A pool with one member for a
whole family is the actual defect. (a) is the floor that stops the athlete
seeing a contradiction while (c) is decided.

## PROGRAMMING VERDICT — HOLD, ONE BLOCKER, DOWN FROM THREE

| finding | candidate's own? | status |
|---|---|---|
| 32 power/strength duplicate sessions | **YES** | fixed on `orchestrator/power-primer-yields`, blocked on the ruling above |
| 48 running-row duplicates | no — 42 at base | `main`'s, composer-owned |
| 36 `Copenhagen Plank (Half)` bench-cue contradictions | no — 16 at base | `main`'s, content ruling |
| travel partial trip leaves in-span anchors | no — identical at base | `main`'s |

**Against that it clears 41 findings**, all Off-season anchor worlds publishing
`Team Training` and `Game` in a phase that has neither. That is a worse
athlete-visible defect than anything it leaves behind.
