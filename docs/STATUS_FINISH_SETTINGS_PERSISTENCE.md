# STATUS — seat `finish-settings-persistence`

**One name, one file, one writer.** Opened 2026-08-20.
`ls docs/STATUS_*.md` before the first commit returned 39 files — ARMS, AUDIT,
BASELINE, BIBLE, BLOCKTWO, BLOCKTWO_DIFFICULT, CAP, CLUBNIGHT_BOOT, COMPOSER,
CONDITIONING, CORE, DEMOLITION, DESKTOP, DEVICE, ELEGANCE, EQUIP, EXCLUSIONS,
FINISH_JOURNEY, FINISH_PROGRAMMING, GUNSHOW, JOURNEY, LADDER, LAWS,
ORCHESTRATOR, PACE, PATTERNS, PRINTER, PROGRESSION, PROJECTION, READINESS,
REBUILD, RESTART, ROTATION, SESSIONUI, SIM, TERMINAL, TRACER, VISIBLE, VOCAB —
and **`FINISH_SETTINGS_PERSISTENCE` was free.**

**Base:** `main @ 9f081efa` (clean commit; the shared checkout carried four
other agents' uncommitted files, which is why this seat branched from the
COMMIT and works in its own worktree).
**Branch:** `feat/finish-settings-persistence`.
**Worktree:** `scratchpad/wt-settings` (session-scoped).
**Control worktree:** `scratchpad/wt-control`, detached at the same `9f081efa`,
same `node_modules` (symlinked to the shared checkout's, as every prior seat's
control has been).
**Stamp:** `Agent: finish-settings-persistence`. Commits by explicit pathspec.
**NOT MERGED, and this seat does not merge.**

## THE MISSION

Finish the broader athlete SETTINGS and PERSISTENCE journeys through real
production doors: season phase, game information, club-training information,
permanent gym equipment, and Coach/program edits — each written through one
canonical transaction owner, rebuilt through the current runtime owners,
preserving unrelated accepted state, surviving close/reopen, and affecting only
the dates and blocks they are supposed to affect.

## OWNERSHIP BOUNDARY, STATED BEFORE ANY CODE MOVED

**MINE:** settings/domain persistence, boot hydration/replay, transaction tests,
journey harnesses.
**NOT MINE, and not edited:** `HomeScreenV2`, `DayWorkoutScreenV2`, the active
Session UI, the Coach UI, injury fallback rules. An athlete-visible
wording/layout need is exposed as typed state and written up as a HANDOFF.

## WHAT I READ BEFORE TOUCHING ANYTHING

`docs/CODEX_HANDOFF_2026-08-11.md`, `CLAUDE.md`, `AGENTS.md` (both halves,
LAW ZERO through the seat-coordination laws), `.claude/rules/suites-and-fixtures.md`,
`docs/NORTH_STAR.md`, `docs/RULINGS_REGISTRY.md` (gate + the rows this mission
touches), `docs/SEAT_INBOX.md` `## Unprocessed`, and the 39 status files.

**REGISTRY-GREP performed before any question was framed:** `season phase`,
`phase change`, `equipment`, `club`, `restart`, `persist`, `relaunch`,
`onboard`, `exclusion`, `settings`, `profile edit`. The rows that bind this
mission: **R-072** (three equipment scopes and no fourth), **R-018/R-019**
(away is a dated subtraction, not a fourth scope), **R-001** (the CALENDAR
holds fixtures; `gameDay` is only a DEFAULT), **R-091** (one generation door),
**R-097** (one generation-time owner; projection displays, never recalculates),
**R-105** (the weekly-reduction prompt belongs to the coach).

## THE DOORS THIS MISSION WALKS — read from production callers, not recalled

| setting | canonical transaction owner | the app's own caller |
| --- | --- | --- |
| season phase | `commitProfileProgramTransaction({kind:'profile_setup'})` | `useSeasonPhaseControl.execute` (My Status) and `ProfileScreen.executeSetupUpdate` |
| game information | the same door, same change kind | `decideProfileSetupChange` -> `ProfileScreen.executeSetupUpdate` |
| club-training information | the same door, same change kind | the same two callers |
| permanent gym equipment | `commitProfileProgramTransaction({kind:'equipment_answer'})` | `ProfileScreen` -> `EquipmentEditorSheet.onSave` |
| SESSION-ONLY equipment | `executeProgramControlActionDurably({type:'set_equipment_modifier', scope:'today_only'})` | `DayWorkoutScreenV2.applySessionEquipment` |
| coach/program edit | `executeProgramControlActionDurably` | every program-control surface |
| close/reopen | `runQuiescentBoot` after a real store death | `appHydrationGate.ts:190` |

**The patch is not hand-written.** `decideProfileSetupChange`
(`rules/profileSetupChange.ts`) is the ONE decision behind the Save button —
it owns "what changed" and "may this be saved at all" — so a harness that built
its own patch would be a second author of exactly the comparison that door
exists to own.

## MEASURED AT BASE, BEFORE ANY CHANGE

| instrument | result |
| --- | --- |
| `npm run test:athlete-journey` @ `9f081efa` | **64 passed, 0 failed** |

