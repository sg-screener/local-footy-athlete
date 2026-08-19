# STATUS — seat `rebuild`

Branch `rebuild/session-change-owner`, cut from `demolition/burn-the-boats`
`907a6de6`. Rollback tag `pre-full-burn-boats-2026-08-19`. **Not merged.**

---

# 2026-08-19 — CLEAN REBUILD, VERTICAL SLICE 1: THE SESSION EQUIPMENT ANSWER

## THE HEADLINE, AND IT IS NOT WHAT THE ORDER EXPECTED

**The slice already worked on the demolition tip. Nothing held it.** Every one of
the thirteen acceptance criteria passes on `907a6de6` with no product change.
What was missing was the half that keeps it working: **there was no guard, on any
part of it.** So this mission is a measurement and a gate, not a rebuild — and
saying otherwise would be claiming work that did not happen.

Two things WERE changed, both small, both measured first:

1. `.maestro/visible/equipment-today.yaml` asserted a receipt that is
   **unreachable** and had been failing on glass.
2. That same file recorded `RDLs` surviving as a **gap**. It is the rule, not a
   gap. Corrected in place with the reason.

## THE WORLD, STATED, BECAUSE A CONCLUSION DOES NOT OUTLIVE IT

Headless cells and probes: **Off-season, 3 training days (Mon/Wed/Fri),
commercial gym, 5+ years, installed 2026-07-13.** On 2026-07-22 that athlete is
programmed `RDLs / Bulgarian Split Squats / Landmine Press / Barbell Row /
Banded Dead Bug`. Removing the barbell takes `Landmine Press` and `Barbell Row`
and must leave `RDLs`, which Sam's sheet authors as **barbell OR dumbbells**.

Simulator: the `standard-in-season-week` seed, Mon 13/7.

## BEFORE AND AFTER — THE REAL DOOR, THE REAL RESOLVER

```
BEFORE  ::  full_body
      RDLs                     3 sets   67.5 kg
      Bulgarian Split Squats   3 sets   25 kg
      Landmine Press           3 sets   35 kg      <- needs a barbell
      Barbell Row              3 sets   72.5 kg    <- needs a barbell
      Banded Dead Bug          2 sets   0 kg

DOOR   ok=true changedProgram=true
       "The equipment restriction is active and the visible program was safely recomposed."

AFTER   ::  full_body
      RDLs                     3 sets   67.5 kg    <- KEPT: dumbbells are legal for it
      Bulgarian Split Squats   3 sets   25 kg
      DB Shoulder Press        3 sets   20 kg      <- own load owner answers 20
      Chest Supported Row      3 sets   30 kg      <- own load owner answers 30
      Banded Dead Bug          2 sets   0 kg

visible rows illegal on today's kit : 0
untouched rows kept, in order       : 3 of 3
```

## THE STORED CANONICAL FACT

```
factId  temporary-source-fact:v1:equipment:date:2026-07-22
kind    equipment      mode  without      tags  ["barbell"]
scope   { kind: "date", date: "2026-07-22", from: "2026-07-22", until: "2026-07-22" }
surface session_equipment_sheet     actor  athlete
```

Dated and session-scoped: `from === until === the session's own day`, so
`equipmentConstraintAppliesToDate` admits it on exactly that day and
`expireTemporarySourceFacts` retires it the next. **"For this session only" is
true of the stored fact, not merely of the sentence the athlete was shown.**

## RESTART AND EXPIRY

Through `relaunchApp` — stores emptied, their writes settled, disk restored,
registry rehydrated, `runQuiescentBoot`. **The program is never persisted**, so
this is a full regeneration plus a ledger replay.

```
[9] RELAUNCH ok=true
[9] equipment facts after boot: 1  scope=date 2026-07-22
[9] pre  ["RDLs@67.5","Bulgarian Split Squats@25","DB Shoulder Press@20","Chest Supported Row@30","Banded Dead Bug@0"]
[9] post ["RDLs@67.5","Bulgarian Split Squats@25","DB Shoulder Press@20","Chest Supported Row@30","Banded Dead Bug@0"]
[9] identical: true
```

Expiry, measured on later dates rather than asserted:

```
2026-07-23 (no session)
2026-07-27 full_body  ... Bench Press ...              rows needing barbell = 1
2026-07-29 full_body  ... Landmine Press, Barbell Row  rows needing barbell = 2
same week, other sessions: 2026-07-20 still needs the barbell
```

## THE CENSUS — 2,038 REAL DOOR WALKS

`npm run census:equipment-recompose`. Five worlds (off-season 3d and 4d,
in-season 5d and 3d, pre-season 4d), every session date in the first two weeks,
**every non-empty subset of that session's removable implements up to size three
plus the whole set.** Each row is a fresh install, a real generation and a real
`set_equipment_modifier` walk.

| question | answer |
| --- | --- |
| a visible row still illegal on the kit the athlete kept | **0 of 2,038** |
| the door refused | **2** — both the all-kit-gone in-season world, with a typed reason |
| a replacement carrying a load its own owner cannot produce | **0** |
| **the SCREEN's residual `buildSessionEquipmentReplacementPlan` had work to do** | **0 of 2,038** |
| a row count that fell | 98 — all multi-implement, all disclosed (below) |

## ⚠ THREE FINDINGS AGAINST MY OWN INSTRUMENTS, AND TWO WERE FALSE ALARMS

**1. "THE REPLACEMENT INHERITED THE OUTGOING LOAD" — REFUTED, AND I ALMOST
SHIPPED IT.** The census flagged 54 cases like `Bulgarian Split Squats (25 kg)
-> Goblet Squat (25 kg)`. `startingWeightForAthlete` says Goblet Squat is 27.5,
so it read as a transfer. **It is not one.** Traced by instrumenting the load
owner through a real door walk: `resolveComposedLoad(Goblet Squat, main=true)`
returns **25** for this athlete, because the off-season main-lift cut applies.
The two numbers agreeing is a coincidence. **Equality is not provenance**, and a
census that tests equality is a coincidence detector.

**2. "A ROW VANISHES WITH NO TYPED GAP" — REFUTED. I READ THE WRONG CHANNEL.**
I measured week-level `explanations` and got zero. Gaps are **per-day**. On the
bodyweight-only world the athlete is shown, in words:

```
No vertical push today — that would need Kettlebell.
No horizontal pull today — that would need Resistance bands.
No vertical pull today — that would need Pull-up bar.
```

Plus the modifier `Equipment restriction active — Your sessions are avoiding the
equipment you marked unavailable.` The composer's `attributeGap` reaches the
athlete through `materialiseComposedWeek` -> `projectVisibleWeek` ->
`projectionCopy`. Acceptance 13 holds.

**3. A SECOND SELECTION AUTHORITY LIVES IN THE SCREEN, AND IT IS DEAD — REAL,
AND NOT FIXED HERE.** `DayWorkoutScreenV2` writes the dated fact and then
computes `buildSessionEquipmentReplacementPlan` and commits `swap_exercise`
actions from it. **In 2,038 cases it produced zero replacements**, because the
fact-driven recompose has already made the day legal. It is confirmed dead **on
glass**: the flow's `"2 exercises were replaced for this session only."` branch
is unreachable and the zero-replacement receipt is what the athlete gets.

**NOT REMOVED IN THIS MISSION, deliberately.** Deleting it reaches into
`getTapSwapChoices` and the tap-swap ladder, which is ordinary swap and removal —
work this mission is told not to start. It is on the rebuild list below with its
evidence.

## THE GATE — `npm run test:session-equipment-owner`, 27 CELLS, 0 FAILED

Real cold start, real generation, real door, real resolver, real process death.
Nothing hand-builds a `ScheduleState`. Predicates are **class-level** — asked of
`exerciseAllowedByEquipment` and `resolveComposedLoad` — except cell [0], whose
only job is to shout when the fixture world moves.

Four controls carry non-vacuity: [1] two rows really need the implement,
[5-control] one row is an OR group and must survive, [10-control] a later session
exists and another session shares the week.

### MUTATION-PROVEN SIX WAYS — tree restored byte-identical after each

| mutation | site | cells reddened |
| --- | --- | --- |
| the dated fact is never written | `temporarySourceFactTransaction.ts` | **9** |
| an OR equipment group read as AND | `exerciseEquipmentRequirement.ts` | [5-control] |
| the outgoing load is transferred | `composeWeek.ts` load argument | [6] |
| the projection authors a replacement | `visibleProgramProjection.ts` import | [12] |
| the illegal original is restored | `composeWeek.ts` substitute choice | **3** |
| today's restriction leaks into the week | `programControlActions.ts` scope | [8] [9] [10] |

`shasum -a 256 -c` clean on all five files after the run.

**⚠ THE FIRST [10] MISSED THE LEAK IT WAS WRITTEN FOR.** A week-scoped fact ends
on the Sunday and that probe landed the following Wednesday, so the scope
mutation left it green. It now looks where a leak actually spills — the
athlete's **other sessions in the same week** — and the mutation reddens it.

**⚠ AND [6] WAS WRONG TWICE BEFORE IT WAS RIGHT.** "Not the outgoing row's load"
manufactures findings (see finding 1). Re-deriving the composer's exact arguments
produced the opposite error and reddened on `DB Shoulder Press@20`, a load the
owner produces perfectly well once the governed cut applies — and it would have
been a second copy of the composer besides. The cell asks the reachable question:
is the delivered number one this identity can produce for **this** athlete
anywhere in the owner's governed argument space.

## ON GLASS — `.maestro/visible/equipment-today.yaml`, GREEN

Metro `:8095` from this worktree, simulator `LFA Explorer 4c8535f`.
Screenshots in `artifacts/visible/`: `c6-before`, `c6-barbell-unticked`,
`c6-receipt`, `c6-after-session`.

The athlete unticks **Barbell** on Mon 13/7 and the session comes back as:

```
1  RDLs                90 kg   "Dumbbells today — no barbell"
2  Leg Press        137.5 kg   "Swapped from Back Squat — equipment today"
3  Single-Leg RDL      20 kg
4  Band Pallof Press      BW
```

Receipt: *"Saved for this session only. Your session was rebuilt using the
equipment you have today — your saved gym setup is unchanged."*

**⚠ THE CURRENT ICON LAYOUT IS TEMPORARY AND STILL VIOLATES SAM'S SAVED UI
ACCEPTANCE NOTE** (`docs/STATUS_DESKTOP.md`, 2026-08-19). The screenshots show
exactly what he rejected: an **unlabelled `+` / dumbbell / cross strip** under
the session heading, and **Swap and Remove icons beside every exercise**. The
note's replacement — one labelled **"Need to make a change?"** hub carrying
**Equipment · Injury · Add · Remove · Swap** — is NOT built here, on purpose:
half a hub with dead buttons is what the note forbids. It belongs to the separate
complete UI slice.

## REBUILD LIST — WHAT THIS SLICE LEAVES OWED

| capability | owner to rebuild at | evidence |
| --- | --- | --- |
| ~~Remove the screen's dead second selection authority~~ — **DONE 2026-08-19, own commit.** 615 lines out, 124 in; session output byte-identical, simulator pixel-identical, `test:compile` unchanged at 665. Recorded in `docs/STATUS_DEMOLITION.md` session 5. | — | 0 of 2,038 census cases |
| Conditioning-modality replacement (`sessionConditioningReplacementName` went with the planner at 0 production callers) — nothing proves a missing rower becomes a bike now | the composer's modality owner | its only cells were in the deleted planner's suite |
| The equipment checklist over-reports: `deriveSessionEquipmentRequirements` flat-maps display labels, so re-opening the sheet still OFFERS `Barbell` on a day whose only barbell row is an OR-group one | `sessionEquipment.ts`, against `equipmentRequiredFor` | the row is right, the checklist is not |
| The labelled "Need to make a change?" hub | the session screen, as one complete UI slice | Sam's 2026-08-19 note |
| A glass proof of restart preserving the equipment change | a Maestro flow using the checkpoint protocol | headless proof exists; a plain icon-relaunch white-screens by design |
| Injury and ordinary removal through the same boundary | not started, by instruction | the causes are kept distinct: equipment asks what is legal with today's kit |

## PRE-EXISTING REDS AT BASE `907a6de6` — RECORDED, NOT REPAIRED

Measured in this worktree at the branch point, before anything was written.

| suite | state |
| --- | --- |
| `test:equipment-scopes` | **dead at import** — `Cannot find module '../../scripts/trace-equipment-scopes'`; that script lives on the unmerged `feat/equipment-scopes` branch |
| `test:temporary-source-facts` | throws — `migrateLegacyTemporarySourceFacts is not a function` (deleted by the demolition's migrate sweep) |
| `test:accepted-state-transactions` | 25 failures, `regressions=0/17 properties=0/7 mutations=7/8` |
| `test:conditioning-equipment-consistency` | throws |
| `test:edge-generation-equipment` | 37 passed, 1 failed — "live full-generation request uses the shared payload builder" |
| `test:visible-program-projection` | prints no totals line |

Green at base and still green: `test:dated-equipment-fact` 3/0,
`test:equipment-answer` 41/0, `test:equipment-vocabulary` 87/0,
`test:projection-ownership` 13/0, `test:session-execution-checklist` 5/0.

## NOT COVERED

- Sam's physical iPhone.
- A glass proof of close/reopen (headless only — see the rebuild list).
- Conditioning modality removal end to end. The census removes **tags**, not
  machines; `sessionConditioningReplacementName` is exercised by the existing
  suites and not by the new gate.
- The `mode: 'only'` equipment fact (*"I have only these"*). This slice proves
  `mode: 'without'`.
- Injury, ordinary removal, game-day rules, power, away substitution, optional
  sessions and the UI hub — all out of scope by instruction.
- Whether the two all-kit-gone in-season refusals are the RIGHT refusal. They are
  typed and honest; nobody has ruled what that athlete should be shown.

Agent: rebuild
