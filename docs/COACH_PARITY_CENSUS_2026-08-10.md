# THE L-C4 PARITY CENSUS — every athlete action, and whether the coach can do it

**Ordered by Sam, 2026-08-10 (SEAT_INBOX item 00), verbatim:** *"no usually i am
asked 'just the strengt, just the conditioning, or both?' I CANT UNDERSTAND FOR
THE FUCKING LIFE OF ME WHY YOU WOULDN'T JUST FIND WHAT THE BUTTONS ALL DO AND
MAKE THE FUCKING COACH BE ABLE TO DO THE SAME SHIT AS THEM?"*

**L-C4, THE PARITY LAW.** *The coach can do exactly what the athlete's own
buttons can do, through the same doors, with the same words, and it asks the
same questions the buttons ask.* Coach ability is not designed; it is DERIVED
from the athlete's action surface. A capability the buttons have and the coach
lacks is a DEFECT with a name, not a future slice.

This sheet is the first unit. **Nothing is built on top of it until it is read.**

---

## THE HEADLINE, AND IT IS ONE NUMBER

> **The coach can propose 1 of the 26 typed athlete actions, and the one it can
> propose it does WITHOUT the question the button asks.**

`COACH_PROPOSABLE_ACTION_TYPES = ['move_session']` — `src/rules/coachProposal.ts:78`.

`ProgramControlActionType` has **26 distinct type literals** —
`src/types/programControlAction.ts:58-84`.

**Unit and denominator, stated:** 26 is a count of DISTINCT TYPE LITERALS in one
union, not of athlete-visible buttons and not of doors. One literal can be
reached by several buttons (`set_schedule_modifier` has three call sites) and
some literals are reachable by none. The athlete-surface column below is
measured by `type: '<name>'` occurrences in product source, excluding
`src/__tests__/` and `src/dev/`, then read at each site.

---

## THE SHEET

Legend — **coach column**: `NO` = the coach cannot produce this action at all
(`COACH_PROPOSABLE_ACTION_TYPES` excludes it). `PARTIAL` = it produces the
action but not the athlete's full choice. `—` = nobody can do it.

### A. The coach can propose it — 1 of 26

| # | Action | Athlete button / surface | The question the button asks | Door + argument | Coach |
|---|---|---|---|---|---|
| 1 | `move_session` | Program tab move picker → `PlanChangeSheet`; also `useHomeScreen.ts:1652` | **The four/five scope rows, verbatim** (below) | `executeProgramControlActionDurably`, payload `{fromDate, toDate, scope?}` — `programControlActions.ts:319-329` | **PARTIAL** |

**ROW ONE IS SAM'S OWN CASE AND IT IS THE WORKED EXAMPLE.** The athlete's picker
renders scope rows from `MOVE_SCOPE_COPY` (`planChangeProducer.ts:423-431`) and
the sheet's mapping forwards the athlete's pick —
`...(change.scope ? { scope: change.scope } : {})`
(`programControlActions.ts:326-329`), whose own comment records that this
boundary once dropped it: *"the sheet offered 'just the gym session', the
payload could not say so, and the whole day moved."*

**The coach never sends a scope and never offers the rows.**
`coachProposal.ts:158-171` omits `payload.scope` deliberately, and its comment is
the assumption under test: *"An omitted scope is the door's whole-day move,
which is what was asked for; inventing a component here would be the coach
choosing on their behalf."* It never reads `moveOptionsForDay` — measured: no
import of `planChangeProducer` in `coachProposal.ts`.

**AND THE ASSUMPTION HAS A CONTRADICTION IN THE TYPE'S OWN DOCSTRING.**
`PlanChangeMoveScopeId` (`planChangeTypes.ts`) says **`whole_day` is offered only
on days that carry no anchor, because on a combined day it would take the anchor
with it.** So on a multi-part day the athlete is REQUIRED to pick a component —
there is no whole-day row to pick — while the coach sends the whole-day shape
regardless. That is the parity break in one line, and it is consistent with
Sam's *"it only moved the strength"*.

> Measuring which of the two defects that is (door vs coach) is SEAT_INBOX item
> 0's tape, not this census. This sheet records the parity fact only.

### B. The athlete has a button, the coach cannot — 16 of 26

| # | Action | Athlete button / surface | Ask it makes | Coach |
|---|---|---|---|---|
| 2 | `bin_session` | Program tab bin → `PlanChangeSheet`; `useHomeScreen.ts:1611` | **5 bin scope rows**, verbatim below | NO |
| 3 | `move_team_night` | Program tab, team-night route | `TeamNightMoveRouteId` — `this_week_only` \| `permanent` | NO |
| 4 | `swap_exercise` | Session detail — `DayWorkoutScreenV2.tsx:736` | exercise picker | NO |
| 5 | `add_exercise` | Session detail — `:783` | exercise picker | NO |
| 6 | `remove_exercise` | Session detail — `:723`, `:924` | — | NO |
| 7 | `add_exercise_preference` | Session detail — `:817`, `:848`, `:882` | — | NO |
| 8 | `set_injury_modifier` | Session detail `:679`; Program tab `useHomeScreen.ts:1674` | injury capture | NO |
| 9 | `clear_injury_modifier` | Program tab — `:1718` | — | NO |
| 10 | `set_recovery_mode` | Program tab — `:1852` | — | NO |
| 11 | `set_fatigue_status` | Program tab — `:1869`; `weekReadinessActions.ts` | readiness prompt | NO |
| 12 | `clear_fatigue_status` | Program tab — `:1528`, `:1806` | — | NO |
| 13 | `set_poor_sleep_status` | `weekReadinessActions.ts` via `readinessActionForKind` (`useHomeScreen.ts:31`) | readiness prompt | NO |
| 14 | `set_illness_status` | `weekReadinessActions.ts`, same entry | severity tier | NO |
| 15 | `set_equipment_modifier` | Program tab — `:1424` | equipment picker | NO |
| 16 | `set_schedule_modifier` | Program tab — `:1392`, `:1469`, `:1560` | — | NO |
| 17 | `clear_active_modifier` | Program tab — `:1296` | — | NO |

### C. Typed, but nobody can do it — 9 of 26

Neither athlete nor coach. These are NOT parity defects; they are unbuilt.

| # | Action | State | Receipt |
|---|---|---|---|
| 18 | `swap_session` | No `ProgramControlAction` producer. Exists as a **PlanChange kind** the athlete's sheet does emit, but the mapping drops it (see the frame finding) | `planChangeProducer.ts:1873` |
| 19 | `add_to_day` | Executor arm exists, no producer | `programControlActions.ts:265` |
| 20 | `clear_recovery_mode` | Executor arm exists, no producer | `:652` |
| 21 | `clear_exercise_preference` | Executor arm exists, no producer | `:653` |
| 22 | `update_lfa_days` | **Returns `ok: false`** | `:730-745` |
| 23 | `update_team_training_days` | **Returns `ok: false`** | `:731` |
| 24 | `update_game_day` | **Returns `ok: false`** | `:732` |
| 25 | `update_season_phase` | **Returns `ok: false`** | `:733` |
| 26 | `update_program_setup` | **Returns `ok: false`** | `:734` |

Rows 22-26 share one arm returning
*"This routine setup action is typed, but its guided executor wiring belongs in
Stage 2B."* **`ProgramControlScreen` names `profile` as an entry surface and
`ProfileScreen.tsx` contains ZERO `ProgramControlAction` references** (measured:
`grep -c` = 0). The profile surface in the type is aspirational.

**1 + 16 + 9 = 26.** The partition is exhaustive over the union.

---

## THE EXACT WORDS THE BUTTONS ALREADY OWN

**NO NEW VOCABULARY.** Every option below is an existing signed row read from
its owner. If the coach needs a word that is not here, that is a finding, not a
string anyone writes.

**Move scopes** — `MOVE_SCOPE_COPY`, `planChangeProducer.ts:423-431`, offered by
`moveOptionsForDay` (`:786`):

| id | label | sub |
|---|---|---|
| `whole_day` | Move the whole session | Pick another day for it |
| `strength` | Just the gym session | Team training stays on this day |
| `conditioning` | Just the conditioning | The rest of the day stays |
| `recovery` | Just the recovery work | The rest of the day stays |
| `team` | Team training | Pick the night it's on — we'll ask if it's permanent |

**Bin scopes** — `BIN_SCOPE_FOR_SECTION_KIND` + `WHOLE_DAY_SCOPE`,
`planChangeProducer.ts:822-852`:

| id | label | sub |
|---|---|---|
| `whole_day` | The whole day | Everything - the day becomes rest |
| `strength` | Just the gym session | The rest of the day stays |
| `conditioning` | Just the conditioning | The rest of the day stays |
| `recovery` | Just the recovery work | The rest of the day stays |
| `team` | Just team training | Can't make it tonight - this date only |

**The G-1 landing ask** — `G1_LANDING_WARNING`, `rules/g1LandingAsk.ts:115-119`:
headline *"Big session the day before your game."*, body *"Train hard {g1Day}
and you'll feel it {gameDay}. Pick one:"*.

**Team-night permanence** — `TeamNightMoveRouteId`: `this_week_only` |
`permanent`. **Its option LABELS were not located in this pass** — the scope row
promises the question (*"we'll ask if it's permanent"*) but the two route rows'
signed words were not found under `planChangeProducer.ts`. Recorded as an open
cell of the sheet, not asserted as absent.

---

## THE FRAME ITSELF IS INCOMPLETE — A FINDING, NOT A CAVEAT

The order framed the census as `ProgramControlActionType` × 4 surfaces. That
frame **does not cover the whole athlete action surface**, and the census found
its edge:

`programControlActionForPlanChange` maps exactly **THREE** PlanChange kinds —
`move_session`, `remove_session`, `move_team_night` — and **returns `null` for
everything else** (`programControlActions.ts:304-355`). The producer emits at
least **eight** kinds: `add_session`, `add_template`, `move_session`,
`plan_change`, `remove_session`, `revision`, `swap_session`, `swap_template`.

So the athlete's own sheet can swap and add sessions on the Program tab, and
those changes **never become a `ProgramControlAction`** — they go through
`applyPlanChange` alone. **Any parity work driven only off the 26-member union
would silently omit swap-session and add-session**, which are two of the four
things the Program tab's menu offers. The four-action menu is swap / add / move
/ remove (`planChangeProducer.ts:436+`); this census's union covers two of them.

---

## THE NOs, RANKED BY WHAT AN ATHLETE WOULD TYPE FIRST

Ranked by likelihood of being typed at a coach, **not by build cost**, as ordered.

1. **`move_session` WITH A SCOPE** (row 1, PARTIAL). Sam already typed it. It is
   the only action the coach has and it is the one giving the wrong answer.
2. **`bin_session`** — *"scrap tomorrow's session"*, *"I can't make training
   tonight"*. Has a 5-row ask the coach cannot make; `team`'s sub-line is
   literally *"Can't make it tonight"*, an athlete sentence.
3. **swap-session / add-session** (the frame finding, not in the union) —
   *"swap Friday for conditioning"*, *"add a recovery session Sunday"*. Two of
   the Program tab's four menu actions.
4. **`set_illness_status` / `set_fatigue_status` / `set_poor_sleep_status`** —
   *"I'm sick"*, *"I slept terribly"*. The single most natural thing to tell a
   coach in words rather than taps, and the readiness family is three NOs.
5. **`set_injury_modifier`** — *"my shoulder's cooked"*. Reachable from two
   surfaces by tap, zero by sentence.
6. **`swap_exercise` / `remove_exercise` / `add_exercise`** — *"take squats out
   of today"*. Session-detail actions; the athlete has to be on the right screen.
7. **`move_team_night`** — narrower, and it carries the permanence ask.
8. Modifier clears (`clear_*`) — rarely typed; usually a consequence.
9. Rows 18-26 — **not parity defects.** Do not build coach paths to actions no
   button reaches; five of them return `ok: false` to anyone who calls them.

---

## A PARITY ROW THE CENSUS FOUND OUTSIDE THE ACTION UNION — **HYPOTHESIS**

**The coach tab has no undo surface at all.** `UndoToast` is mounted in exactly
one place — `HomeScreenV2.tsx:1225` — and `CoachTabScreen` mounts nothing. The
component's own docstring: *"This mounts once, on the Program screen."*

Because bottom tabs stay mounted, the likely behaviour is worse than absence:
the toast arms invisibly behind the Coach tab and **burns its own 6-second
timer** (`UndoToast.tsx:31,47`), marking the entry seen, so it is spent before
the athlete could switch tabs to see it. `rules/undoToast.ts:17-19` predicted the
gap in writing: *"A coach-authored change would appear here for free."*

**THIS IS LABELLED HYPOTHESIS AND STAYS THAT WAY UNTIL A CELL HOLDS IT.** No
cell asserts it and no glass has confirmed it; the Maestro rig that would confirm
it is blocked (see NOW.md). It is listed here because it is a parity defect of
exactly the kind this census exists to enumerate: **the athlete's surface has an
undo affordance and the coach's does not.**

---

## WHAT THIS SHEET DOES NOT COVER

- **NO BEHAVIOUR WAS RUN.** Every row is a SOURCE reading. Nothing here was
  measured by executing a door, mounting a screen, or raising a keyboard. The
  coach column is read off one exported constant.
- **The four-surface cross was not completed as a grid.** `profile` has zero
  door references and `coach_notes` is the FROZEN beta surface (LR-6), so the
  live cross is `program_tab` × `session_detail` plus the new `coach_tab`. The
  26 × 4 grid the order describes would be mostly empty cells; the sheet reports
  the surfaces each action is actually reached from instead. **This is a
  deviation from the order's literal shape — flagged, not silently taken.**
- **Team-night route labels not located** (above).
- **Ask-completeness is not proven.** The asks listed are the ones the order
  named plus what the producer holds. There may be asks on session detail
  (exercise pickers) whose signed rows were not enumerated; those cells say
  "exercise picker" rather than quoting words that were not read.
- **Whether an omitted scope means whole-day at the door is UNMEASURED** and is
  item 0's tape.

## NORTH STAR

**NEUTRAL.** This unit stores nothing and derives nothing; it is a measurement.
The build order that comes off it should move TOWARD — deriving coach ability
from the athlete's existing action surface removes the coach's private
vocabulary rather than adding a second one.
