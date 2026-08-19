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


---

# 2026-08-19 — CHECKPOINT: THE NEXT SLICE IS **REMOVE**

Measured before choosing, with `npm run census:five-actions` — the four
remaining hub actions driven through their real doors on the real off-season
3-day athlete, session `2026-07-22`
(`RDLs / Bulgarian Split Squats / Landmine Press / Barbell Row / Banded Dead Bug`).

| action | door | what the athlete gets |
| --- | --- | --- |
| **Equipment** | `set_equipment_modifier` | **WORKS** — slice 1, 27-cell gate |
| **Swap** | `swap_exercise` | **WORKS** — 2 options offered, `RDLs -> Glute Bridge` (`same_movement_pattern`), row changes on screen |
| **Remove** | `applyExerciseExclusionDecision` | **STORED, NEVER SEEN** — the decision persists correctly, the session is byte-identical |
| **Injury** | `set_injury_modifier` | **STORED, NEVER SEEN — AND IT CLAIMS OTHERWISE** |
| **Add** | `decideExtraSessionOffer` | **NOT MEASURED** — this driver cannot build the block history the offer reads. A harness limit, not a finding. |

## ⚠ THE INJURY DOOR RETURNS A SENTENCE THAT IS NOT TRUE

```
door ok=true "Injury restrictions are active and affected sessions were safely recomposed."
before : RDLs@67.5, Bulgarian Split Squats@25, Landmine Press@35, Barbell Row@72.5, Banded Dead Bug@0
after  : RDLs@67.5, Bulgarian Split Squats@25, Landmine Press@35, Barbell Row@72.5, Banded Dead Bug@0
```

A moderate hamstring, `train_around`, and **the athlete is told their sessions
were recomposed while every row — the hinge included — stands untouched.** This
is worse than a silent failure: a silent failure invites a second attempt, and
this one closes the question. Recorded here now; it is the injury slice's first
cell, not something to patch at the message.

## WHY REMOVE IS THE NEXT DEPENDENCY, AND NOT INJURY

**Both fail the same way, and Remove is the one that isolates the cause.**

The Remove owner says so in its own comment:

> `today_only` changes THIS session, **which the removal override already did**;
> it does not change what future generation may choose, so it asks for no rebuild.

**That override is gone.** `applyUserRemovalConstraintsToWeek` was cut out of
§18 by the demolition (area A: *"Applying stored athlete deletions -> accepted
state transaction"*, BROKEN). The owner still stores the decision and still
declines to ask for a rebuild, on a premise the demolition retired.

⚠ **AND MY FIRST DIAGNOSIS WAS WRONG.** I read `composerExclusionInput` in
`generateProgram.ts` as having zero callers and nearly reported a dead producer.
A whole-repo grep with a positive control found it called at
`generateProgram.ts:1171`. **The wire exists — at GENERATION.** The athlete's
`prefs.exclusions` reach `composeWeek` the next time a program is generated, and
nothing regenerates when a removal is stored. A `today_only` removal is therefore
invisible until something else triggers generation, by which time its
`activeThroughISO` has passed. It can never be seen.

Remove is the next dependency because:

1. **It is the same missing wire, on the simplest cause.** Equipment already
   proved the spine: a stored decision that triggers a recompose-and-publish
   arrives on screen and survives a restart. Removal has one stored decision
   type, no severity, no body-part ladder, no coach surface.
2. **Injury is strictly downstream of it.** Injury needs that same wire PLUS a
   risk/movement-restriction model PLUS nine items on the demolition's own
   rebuild list. Building injury first means building the wire blind, inside the
   larger problem.
3. **The composer is already waiting.** `composeWeek` carries `excludedToday`,
   `attributeGap({ excluded })` and `substitutedFor.cause = 'excluded_today'` —
   the branch is built and currently unreachable from a live decision. This is a
   rebuild through a current owner, not a new authority.
4. **Its acceptance is already written.** The six red cells in
   `test:visible-surfaces` are removal and injury behaviour, and their words are
   the spec: *"the fallback selector IS asked to fill the removed pattern"*,
   *"the PATTERN is kept by a legal loaded variation"*, *"the screen's case
   defaults to an identity EXCLUSION"*.
5. **It keeps the causes distinct, as ordered.** Equipment asks what is legal
   with today's kit; ordinary removal rotates within the pattern. They must not
   collapse into one exclusion list, and building them one at a time against the
   same spine is what keeps them apart.

## WHAT REMAINS UNBUILT AFTER THIS CHECKPOINT

**Of the five hub actions:** Equipment done; Swap works but has no end-to-end
gate of its own; Remove chosen next; Injury after it; Add unmeasured.

**Carried, unchanged, from the demolition's rebuild list:** power allowance
stamping and delivery; clearing stale derived sessions; safety rewriting of a
week at the composer; optional-session placement/withdrawal; required-safe-pattern
representation; `mainStrengthFrequencyCeiling` enforcement; fixture-replan
alternatives; and the nine injury items.

**Added by slice 1 and still open:** the equipment checklist over-reports
(`deriveSessionEquipmentRequirements` flat-maps display labels, so the sheet
still offers `Barbell` on a day whose only barbell row is an OR-group one);
conditioning-modality replacement is unproven since its only cells went with the
deleted planner; and there is no glass proof of restart preserving an equipment
change.

**Not started, by instruction:** the five-action UI hub, game-day rules,
conditioning, power, away substitution and optional sessions.

Agent: rebuild


---

# 2026-08-19 — REMOVE, DIAGNOSED. AND A CORRECTION TO MY OWN CHECKPOINT.

## ⚠ THE CHECKPOINT ABOVE WAS HALF WRONG — I MEASURED ONE OF TWO DOORS

I reported Remove as *"STORED, NEVER SEEN"*. **The row does leave the session.**
`npm run probe:removal-slice` walks both doors the screen actually uses, and the
five-actions census had only walked the second:

| door | what it is | effect on the visible session |
| --- | --- | --- |
| A `remove_exercise` | `executeProgramControlActionDurably`, fired by `removeExerciseToday` | **the row goes** — 5 rows -> 4, other days byte-identical |
| B `applyExerciseExclusionDecision` | the scope answer that follows it | **nothing** |

Walking B alone and calling Remove broken was the error. Corrected here rather
than quietly.

## WHAT REMOVE ACTUALLY DOES, AND THE FOUR THINGS IT DOES NOT

Real athlete, off-season 3-day, `2026-07-22`, removing `RDLs`:

```
before  RDLs@67.5, Bulgarian Split Squats@25, Landmine Press@35, Barbell Row@72.5, Banded Dead Bug@0
after   Bulgarian Split Squats@25, Landmine Press@35, Barbell Row@72.5, Banded Dead Bug@0
```

1. **NO SAME-PATTERN REPLACEMENT.** The row is deleted, not replaced: `rows 5 -> 4`,
   `replaced by: []`. The hinge is simply lost for the day. Sam's requirement is
   *"same-pattern replacement where legal"*, and `Glute Bridge` — which the SWAP
   door offers for this exact row at `same_movement_pattern` — is legal here.
2. **`this_block` AND `until_restored` REACH NOTHING BEYOND TODAY.** Both return
   `rebuildRequired: true` and nothing acts on it. The same session one week on
   still carries `RDLs@82.5`.
3. **UNDO DOES NOT RESTORE.** `restoreExcludedExercise` returns `ok=true` and the
   row stays gone — the decision is deleted, the patched week is not revisited.
4. **NO TYPED REFUSAL PATH** — nothing is asked, so nothing can refuse.

## ⚠ HIDDEN AUTHORITY FOUND — REMOVE PATCHES THE VISIBLE WEEK

`remove_exercise` -> `coachActions.removeExerciseAtDate` -> **`writeCoachOverride(date, canonicalWorkout, { intent: 'dismissed', label: 'Exercise removed' })`**.

It clones the day's workout with the row filtered out and writes it as a COACH
OVERRIDE. **The composer never runs, so nothing can choose a replacement; the
accepted-state transaction is bypassed, so nothing validates it; and the visible
week is patched directly** — the three things this mission's shared path forbids.
It also explains defect 3: Undo deletes the decision but the override still
stands.

Named for deletion in the Remove build, per the hidden-legacy rule. No
compatibility wrapper.

## THE SHARED BOUNDARY — IT ALREADY EXISTS, AND EQUIPMENT IS ALREADY ON IT

`commitDerivingSourceFactScopedRegen` (`store/temporarySourceFactTransaction.ts:429`)
is the lane every clean session change should ride:

```
generateProgramLocally(profile, { microcycleLimit: 1, previousProgram, blockNumber,
                                  blockStartISO, remainderBoundary, weekAcceptance })
   -> buildWeekScopedWorkoutOverlay   (a SPARSE week overlay; the base microcycle is never touched)
   -> the accepted-state transaction  (validated, atomic, fact-linked, reversible)
```

**One week, not the program** — `microcycleLimit: 1` and a `remainderBoundary`
that pins days already lived. That is exactly *"recompose only the affected
session; do not regenerate the whole program"*.

**And Remove needs no new stored shape to join it.** `generateProgramLocally`
already reads `prefs.exclusions` through `composerExclusionInput`
(`generateProgram.ts:1171` — I checked this twice; my first reading called it
uncalled and was wrong), and `composeWeek` already carries `excludedToday`,
`attributeGap({ excluded })` and `substitutedFor.cause = 'excluded_today'`. Run
that lane with the decision stored and the same-pattern replacement, its own
load, the typed gap and the reversible adjustment all fall out of owners that
already exist.

The lane is currently shaped around a `TemporarySourceFact`. Remove must drive it
from its own cause — **a removal is not a fact kind**; its canonical home is
`athletePreferencesStore.exclusions` via `exerciseExclusionOwner`, which the
demolition kept and named as the owner. Adding a `factKind: 'removal'` would be a
second representation of a decision that already has one.

Agent: rebuild


## ⚠⚠ VOID — THE SECTION BELOW PROVED THE WRONG SEMANTICS

**Sam's correction, 2026-08-19, arrived before this was built and it reverses the
design:** *"Remove means simply remove the selected exercise/component. Nothing
replaces it. The session may have fewer exercises and may lose that movement
pattern. **Do not ask the composer to fill the empty slot.**"*

The experiment below is left in place because it is a true measurement and
because what it proves is now a HAZARD rather than a plan: a one-week scoped
recompose **fills the hole** — `Deadlift@77.5` walked into the hinge slot. That
is exactly what Remove must not do. **The composer-recompose lane is therefore
the wrong owner for Remove**, and is now the thing a guard must forbid.

**It stays right for EQUIPMENT and INJURY**, where a replacement IS the contract.

## THE REMOVE DESIGN, PROVEN BEFORE A LINE OF PRODUCTION CODE (SUPERSEDED)

`npm run probe:removal-design`. Claim under test: with the exclusion STORED, a
**one-week** scoped regeneration makes the composer substitute a legal
same-pattern replacement carrying its own load — with no new owner, no new
stored shape and no change to `composeWeek`.

```
visible before   RDLs@67.5, Bulgarian Split Squats@25, Landmine Press@35, Barbell Row@72.5, Banded Dead Bug@0
decision stored  [{ exercise: RDLs, scope: today_only, activeThroughISO: 2026-07-22 }]
one-week recompose (microcycleLimit: 1, athletePrefs read from the store by default)

regenerated      Deadlift@77.5, Bulgarian Split Squats@25, Landmine Press@35, Barbell Row@72.5, Banded Dead Bug@0
```

- the excluded exercise is **gone**;
- **`Deadlift` takes the hinge** — same movement pattern, the closest legal option;
- it carries **its own load, 77.5**, not `RDLs`' 67.5;
- **row count preserved, 5 -> 5**, and every other row is byte-identical.

**So the whole of Sam's Remove contract falls out of owners that already exist.**
The build is a wire and a deletion, not new programming:

1. the decision already stores (`applyExerciseExclusionDecision`);
2. `generateProgramLocally` already reads `prefs.exclusions` by default
   (`generateProgram.ts:1764`, `athletePrefs: options.athletePrefs ?? getAthletePrefs()`);
3. `composeWeek` already picks the replacement and `resolveComposedLoad` already
   gives it its own load;
4. the scoped lane already publishes one week through the accepted-state
   transaction as a sparse overlay.

**What must be built:** the trigger from (1) to (2), and the deletion of
`writeCoachOverride` from the removal path so the composer's answer is what
ships rather than a patched week.

### ⚠ ONE OPEN QUESTION, PROVISIONALLY ANSWERED — FOR SAM'S END TABLE

`substitutedFrom` is **not** stamped on `Deadlift`, so the athlete would see the
swap with no "Swapped from RDLs — you left it out" line. The cause: at
generation the exclusion moves the BLOCK's base hinge selection rather than
acting as a day-scoped substitution, so `composeWeek` never takes the
`substitutedToday` branch. **Provisional treatment: none — the row is correct and
the badge is absent.** Recorded rather than fixed by widening the composer,
because forcing a day-scoped substitution for a `this_block` or `until_restored`
removal would be the wrong shape, and I will not invent that rule.

### ⚠ TWO INSTRUMENT FAULTS THAT LOOKED LIKE PRODUCT FAILURES

Both recorded because both would have been reported as findings by a less
careful pass:

- **importing one probe from another** ran the headless bootstrap twice and died
  with `Cannot read properties of undefined (reading 'call')`. A probe is not a
  library; the helpers are inlined now.
- **a `Workout` carries `dayOfWeek`, not a date.** The first reader looked for
  `workout.date`, found nothing, and printed `(date not found in generated
  program)` — which reads exactly like the recompose failing. It had not.

Agent: rebuild


---

# 2026-08-19 — REMOVE, RE-DIAGNOSED UNDER SAM'S CORRECTED SEMANTICS

## THE FIVE MEANINGS, AS RULED

| action | meaning | replacement? |
| --- | --- | --- |
| **Remove** | take the exercise out | **NO — nothing replaces it; the pattern may be lost** |
| **Swap** | the athlete wants a different exercise | yes, and they choose it from up to six ranked legal options in three labelled groups |
| **Add** | add a legal exercise/mobility/conditioning item | nothing is removed |
| **Equipment** | cannot be done with today's kit | same exercise on another legal implement, else the fallback ladder |
| **Injury** | the movement is unsafe | closest safe replacement, else an honest omission |

## WHAT THIS CHANGES ABOUT THE DIAGNOSIS

**The visible OUTCOME of today's Remove is already correct.** `5 rows -> 4`,
nothing put back, other days untouched — that is now the specification, not a
defect. My previous checkpoint listed *"no same-pattern replacement"* as
Remove's first defect. **It is not a defect. Struck.**

**What remains wrong is the MECHANISM and everything downstream of it:**

1. **It bypasses the accepted-state transaction.** `remove_exercise` ->
   `removeExerciseAtDate` -> `writeCoachOverride(date, workout-minus-the-row)`.
   The visible week is patched directly. Deleted in this mission regardless of
   semantics — Sam kept this instruction in the correction.
2. **`this_block` and `until_restored` reach nothing past today.** Both return
   `rebuildRequired: true` and nothing acts on it.
3. **Undo does not restore the removed item.** The decision is deleted; the
   override still stands. Sam's requirement is *"Undo restores the exact removed
   item"* — the exact one, which suits a removal that never chose a replacement.
4. **No typed refusal path.**

## THE ONE QUESTION THAT DECIDED BUILDABILITY, ASKED FIRST

*"Validation must not quietly force-fill an athlete-authorised removal."* So
before building: take the real accepted week, drop a row the way a removal would,
and put it through the real write-validation boundary.

```
rows      RDLs, Bulgarian Split Squats, Landmine Press, Barbell Row, Banded Dead Bug
removing  RDLs — 5 rows -> 4, nothing put back
assertLiveWorkoutWrite: returned (no throw)
```

`assertLiveWorkoutWrite` is the exact guard `removeExerciseAtDate` already calls
before it writes, and **it accepts a session with a row gone and a pattern
missing.** The athlete's removal can survive the write boundary.

⚠ **AND THE OTHER SIX "THREW" LINES IN THAT RUN ARE MY ARGUMENT SHAPES, NOT
REFUSALS** — `Cannot read properties of undefined (reading 'microcycles')` is a
probe handing a validator the wrong object, and reporting it as "validation
refuses removals" would have been a manufactured finding. Only the one assertion
that received well-formed arguments carries signal, and it is the relevant one.

## THE BUILD, RESTATED

canonical removal decision (`athletePreferencesStore.exclusions` via
`exerciseExclusionOwner` — scoped today / this block / until restored)
-> **applied as a REMOVAL over the accepted week, not a recompose**
-> the accepted-state transaction
-> the projection displays fewer rows.

⚠ **I WROTE HERE THAT `applyUserRemovalConstraintsToWeek` IS NOT THE OWNER. IT
IS.** I read its first filter line — `workouts.filter(w => w.dayOfWeek !==
dayOfWeek)` — and stopped. Twenty lines further down it **pushes
`remainingWorkout` back**, and its own comment names this exact case: *"a swap's
replacement, an add's new session and **a component-bin's remainder** all arrive
as `remainingWorkout`"*. Reading a function to its first `filter` and concluding
is the same mistake as reading a call site without its arguments.

Agent: rebuild


---

# 2026-08-19 — REMOVE: THE CANONICAL PATH, AND IT IS ALL CURRENT OWNERS

## THE OWNER, FOUND

`stageAthleteSessionDeletionTransaction` already takes a **`remainingWorkout`**,
and its comment says why: *"A swap rides this deletion with a non-null
remainingWorkout ... When content remains on the day it is not a whole-day
rest."* An exercise removal is that shape exactly — the day, minus one row.

```
stageAthleteSessionDeletionTransaction({
  date, scope: 'strength_component',
  originalWorkout:  the day BEFORE the removal,     <- exact-item Undo comes free
  remainingWorkout: the day MINUS that one exercise, <- nothing is chosen to replace it
})
   -> a UserRemovalConstraint, through the accepted-state transaction
   -> applyUserRemovalConstraintsToWeek re-lands the remainder at every read (3 live callers)
   -> athletePlacementFor() stamps it, so no deriver may regenerate over it
```

**The composer never runs, so nothing can refill the slot** — which is now the
requirement rather than the defect. Every piece is a current owner; nothing is
restored, wrapped or invented.

## THE TWO SCOPES ARE COMPLEMENTARY, NOT DUPLICATES

This looked like two rival removal stores. It is not, and the distinction is the
whole of Sam's *"Today / This block / Until restored"*:

| store | what it answers | horizon |
| --- | --- | --- |
| `UserRemovalConstraint` | *what is on THIS dated session* | the day |
| `athletePreferencesStore.exclusions` | *what generation may choose at all* | this block / until restored |

So **Today** = a removal constraint alone. **This block / Until restored** = a
removal constraint for today PLUS the exclusion that future generation already
reads through `composerExclusionInput`.

`UserRemovalScope` (`whole_session | strength_component | conditioning_component |
recovery_component | team_component`) is about WHAT was removed, not for how
long — the two axes are independent and both are needed.

## WHAT IS LEFT TO BUILD

1. Route `remove_exercise` to this transaction instead of `writeCoachOverride`.
2. **Delete the `writeCoachOverride` removal path.**
3. Wire the scope answer: today -> constraint only; block/until -> constraint + exclusion.
4. Undo -> resolve the constraint (its `originalWorkout` is the exact item) and
   drop the exclusion.
5. Typed refusal when the removal cannot be represented.
6. Guard + mutations, including one that forbids a refill, and simulator proof.

Agent: rebuild


---

# 2026-08-19 — REMOVE: THE CLEAN PATH IS BUILT AND THE OVERRIDE IS OFF THE DOOR

`remove_exercise` now routes to `commitAthleteSessionDeletionTransaction`
(`scope: 'strength_component'`, `originalWorkout` = the day as it stood,
`remainingWorkout` = the day minus one row). The `removeExerciseAtDate` import
— and with it `writeCoachOverride` — is gone from this door.

Measured on the real athlete, `2026-07-22`, removing `RDLs`:

```
before  RDLs@67.5, Bulgarian Split Squats@25, Landmine Press@35, Barbell Row@72.5, Banded Dead Bug@0
after   Bulgarian Split Squats@25, Landmine Press@35, Barbell Row@72.5, Banded Dead Bug@0
the exercise is gone      : true
NOTHING replaced it       : true (5 -> 4)
other rows byte-identical : true
other DAY untouched       : true
stored: user-removal:2026-07-22:strength_component:...  originalWorkout rows=5
undoable decisions        : 1
UNDO -> RDLs@67.5, Bulgarian Split Squats@25, Landmine Press@35, Barbell Row@72.5, Banded Dead Bug@0
EXACT item back           : true
day identical to before   : true
```

**The composer never runs on this path, so nothing can refill the slot.** Undo
restores the exact item because `originalWorkout` is the day itself, not a fresh
choice. Typed refusals added for *not found* and *ambiguous*.

`test:compile` **665**, unchanged. `test:session-equipment-owner` 27/0,
`test:undo-reversal` 19/0. `test:athlete-session-deletion` (30 failures) and
`test:program-control-durable` (2) are **identical at a control worktree on
`4142f85d`** — pre-existing, not this change.

Agent: rebuild


---

# 2026-08-19 — REMOVE IS ONE DECISION, AND THE RESTART WAS PUTTING A DIFFERENT LIFT BACK

## THE SHAPE, AFTER SAM'S THREE ANSWERS

One stored decision (`ExerciseExclusion` — exercise, scope, stamped expiry) and
**two projections of it, neither of which writes anything**:

| projection | what it answers | Sam's clause |
| --- | --- | --- |
| `applyExclusionsToAuthoredDay`, at `utils/sessionResolver` | the row is not on any REMAINING already-authored session inside the span | *"this block removes it from every remaining already-authored session in this block"* |
| `composerExclusionInput`, at generation | a block the app has not authored yet never chooses it | *"until restored removes it from current and future sessions/blocks"* |

**Nothing is destroyed, so nothing has to be rebuilt to undo it.** The authored
row stays in the stored program and the decision hides it — which is what makes
*"Undo restores the exact removed item"* a mechanism rather than a repair. And
**the composer never runs on this path, so nothing can refill the slot.**

`removeExerciseAtDate` and its `writeCoachOverride` implementation are DELETED.
The coach's `remove_exercise` returns a typed refusal naming the one real door.
No shim.

## THREE THINGS I GOT WRONG FIRST, EACH CAUGHT BY A MEASUREMENT

**1. I INSTALLED THE FILTER AT THE COMPOSE OWNER, AND IT WAS WRITTEN DOWN.**
`rebaseAcceptedEffectiveWeek` is the obvious site — every accepted-week read goes
through it — and it is also what the WRITE paths compose with.
`commitRebuiltProgram` published the filter's answer, and within ONE boot three
stored microcycles had lost the row permanently while the block before the
decision day kept it. **A filter that gets written down is not a filter**: it
cannot expire and Restore has nothing to give back.

**2. THEN I READ THE LIVE STORE IN THE RESOLVER, AND IT WAS WRITTEN DOWN AGAIN.**
`programStore.canonicaliseAcceptedBoundaryState` composes the accepted week
THROUGH the resolver. So the exclusions travel on `ScheduleState` and only the
two doors that mean *"what the athlete SEES"* carry them —
`deriveVisibleWeek.assembleScheduleState` and `hooks/useSchedule`. The
canonicalisers build their own bare states and compose the week the app
AUTHORED, which is the week that must be stored.

**3. THE RESTART PUT A DIFFERENT LIFT IN THE HOLE — and this is the one that
would have shipped.** Remove `RDLs`, close the app, reopen it:

```
before restart  Bulgarian Split Squats@25, Landmine Press@35, Barbell Row@72.5, Banded Dead Bug@0
after  restart  Deadlift@77.5, Bulgarian Split Squats@25, Landmine Press@35, ...
```

The boot regenerates; the exclusion narrowed the hinge slot's legal candidates;
`decideExerciseForBlock`'s *restore-before-decide* rule could no longer restore
the recorded `RDLs` and made an honest new decision. **The athlete removed a lift
and got a different lift back for closing the app**, and the read filter could
not save them — it removes `RDLs`, and the row was no longer `RDLs`.

This is the SAME defect class the `'author' | 'replay'` distinction was
introduced for on 2026-08-18: a reversible dated decision reaching a layer
entitled to author permanent structure. That fix stopped a replay RECORDING a
re-derived selection; it did not stop a replay MAKING one. `exclusionsForSelectionAuthority`
is the other half — **only an explicit `'replay'` is withheld from**, and only
the DATED decisions are, because `getAthletePrefs` projects them into `excluded`
and clearing `exclusions` alone withheld nothing.

## THE GATE — `npm run test:exercise-removal-owner`, 35 cells, ALL GREEN

Seven cases, every one driving production doors and each opening with a control
that refuses to continue on a world where the exercise was never there.

**MUTATION-PROVEN FOUR WAYS**, tree restored byte-identical from my own backups
after each (md5 checked):

| mutation | reds |
| --- | --- |
| the view state stops carrying the decisions | 9 cells |
| `exclusionIsActiveOn` loses its lower bound | 1 — *"a decision taken LATER does not reach back"* |
| a replay may re-decide the block | 3, and it REPRODUCES `Deadlift@77.5` exactly |
| the filter goes back on the write side | 1 — *"after a restart, Restore still returns every day"* |

⚠ **THE LOWER-BOUND CELL WAS GREEN AND EMPTY AND THE MUTATION SAID SO.** It
first asked about the Monday before the decision — a day that does not carry the
victim at all — so deleting the bound outright left all 32 cells green. It now
asks an EARLIER day that DOES carry it, with the decision taken later.

## BLAST RADIUS — MEASURED AGAINST A CONTROL WORKTREE AT `5ccee7bc`

`test:compile` **665 / 73 pairs**, identical to base. Nine suites run both
sides — `derived-week-ownership`, `day-precedence-ownership`,
`visible-program-projection`, `surface-agreement`, `quiescent-boot`,
`block-two-boot-preservation`, `week-rebuild`, `block-selection-authority`,
`athlete-journey` — **identical pass/fail counts at both trees**.

`test:exercise-exclusions` moved 51/3 → 52/1 and the remaining failure is the
control's own. Four of its cells asked the STORED PROGRAM whether a removal had
happened; under the corrected semantics the program KEEPS the row and the
athlete's screen loses it, so those cells moved to the visible coordinate and one
duplicate boot cell was deleted — its own docstring had already ruled that the
relaunch claim belongs to case [3] alone.

Four cells in `coachActionsTests` are disposed of BY SUBJECT: they asserted that
a removal wrote a coach override, and that write is what was ordered removed.

**NOT COVERED YET:** the simulator. Nothing here has been seen on glass.

Agent: rebuild
