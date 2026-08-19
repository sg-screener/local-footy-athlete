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


---

# 2026-08-19 — SWAP OFFERS A MENU, AND THE GROUPS ARE THE LADDER'S OWN TIERS

## THE SHAPE

`SAFE_TRAINING_FALLBACK_TIERS` already ranks exactly the ladder Sam's three
groups describe, and every `TapSwapChoice` already carries its tier. So the
groups are a PROJECTION of a signed ordering, not a second opinion about
closeness — a similarity score of my own would have been a rival answer to a
question the fallback hierarchy already owns.

```
same_movement_pattern                              -> Closest matches
similar_muscle_group                               -> Similar options
unaffected_body_area | recovery_easy_conditioning  -> Other useful options
rest                                               -> NOT A GROUP
```

**Rest is deliberately not offered.** An athlete who wants the work gone uses
Remove; offering rest inside a substitution menu answers a question nobody asked.

## TWO THINGS HAD TO CHANGE IN THE LADDER, AND ONE WAS A LATENT DEFECT

**1. THE LADDER WAS FIRST-SOURCE-WINS.** `registryPatternChoices` ran only when
`getSubstituteCandidates` came back empty — right for a caller that wants one
answer, wrong for a menu. Measured before the change
(`npm run probe:swap-choices`): every row in a real off-season session offered
exactly `2 + 1` and no row ever filled two training groups. Both sources now run
and merge; both already apply the same legality filter.

**2. `dedupeChoices` DEDUPED BEFORE IT SORTED.** Harmless while one source ran at
a time; wrong the moment two do — the same exercise offered by both sources kept
whichever source ran EARLIER, so a genuine closest match could land under
"Similar". It sorts first now.

## WHAT THE ATHLETE ACTUALLY GETS, MEASURED

```
RDLs                     closest:2 other:1
Bulgarian Split Squats   closest:2 similar:2 other:1
Landmine Press           closest:2 other:1
Barbell Row              closest:2 other:1
Banded Dead Bug          other:1
```

*"Show fewer when good legal options do not exist"* is honoured by OMISSION: a
group with no legal member is absent, and a row with no legal option at all gets
a sentence in the athlete's words instead of an empty sheet.

The screen gains one step — `choose_swap` — BEFORE `confirm_swap`, not instead of
it. The athlete picks from the menu and still sees the prescription before
anything is written, and Back returns to the menu.

## THE GATE — `npm run test:exercise-swap-choices`, 24 cells, ALL GREEN

**MUTATION-PROVEN FOUR WAYS**, tree md5-restored after each:

| mutation | reds |
| --- | --- |
| the ladder goes back to first-source-wins | the CONTROL cell — no row fills two training groups |
| the per-group cap is lifted | 2 rows offer 3 and 4 closest matches |
| `rest` becomes an offerable tier | *"not smuggled into Other useful options"* |
| a swap writes an exclusion for the original | *"the swap created NO exclusion"* |

⚠ **THE REST-REFUSAL CELL WAS GREEN AND EMPTY TWICE.** First because the ladder
never emits a rest choice in a healthy off-season world at all, so the mutation
had nothing to smuggle; the refusal is now asked of `groupTapSwapChoices`
directly with every tier on the table. Then AGAIN, because the rest entries sat
last in that input and the per-group CAP absorbed them rather than the tier rule
REFUSING them — **a cap is not a refusal.** They go first now.

## BLAST RADIUS

`test:compile` 665 / 73, unchanged. `exercise-edit-entry-surface` 35/0,
`dead-affordances` 6/0, `ui-picture-manifest` 5/0, `action-walker` 19/0 —
identical at the control worktree. `test:tap-swap-hierarchy` dies at import at
BOTH trees (pre-existing; a suite's exit code is not its pass count).

**NOT COVERED YET:** the simulator.

Agent: rebuild


---

# 2026-08-19 — ADD OFFERS THE APP'S OWN VOCABULARY, NOT A TABLE OF TWELVE

## WHAT WAS THERE

A hand-written table in the day screen: seven "kinds", **two names each**, and
the flow offered whichever of the two the session did not already contain. It
asked **nothing** about the athlete's equipment and **nothing** about their
injuries, and every set/rep band in it was typed by hand. A shoulder-injured
athlete training at home with no barbell was offered the same two upper-body
options as everyone else.

## WHAT IS THERE NOW

`utils/addExerciseCandidates.legalAddCandidateGroups` over
`selectableVocabularyGroups()` — the one vocabulary every generator draws from,
already grouped and already labelled — filtered by `assessTapSwapCandidateSafety`,
**the same function the swap ladder uses**, so Add and Swap cannot disagree about
what is safe today. Load comes from `startingWeightForAthlete`.

Measured on the real athlete: **23 groups**, covering strength slots, arms,
calves, prehab, midline, shoulder health, tissue quality, **Mobility**, easy
cardio, breathing, power and **Conditioning** — Sam's *"any legal exercise,
mobility or conditioning component"*, from data that already existed.

`add_kind`, `ADD_EXERCISE_KINDS`, `ADD_EXERCISE_KIND_ICON`, `suggestAddExercise`
and `prepareAdd` are DELETED. No shim.

## ⚠ THE ONE THING I HAD TO GREP BEFORE BUILDING — `REGISTRY-GREP: R-088`

*"Respect ... genuine session limits"* reads like the 7-exercise cap. **It is
not**, and building it that way would have shipped the opposite of a signed
ruling. R-088, verbatim: *"7 is the max the app should set and **a user should be
able to add as many of their own things on top of it as they choose**"*. The cap
binds the PLANNER. So the limits Add respects are equipment, injury and safety —
the ones that can hurt someone — and there is a cell asserting the athlete's own
adds keep landing past seven, with a control proving the session really was
pushed past it.

## THE GATE — `npm run test:exercise-add-candidates`, 21 cells, ALL GREEN

**MUTATION-PROVEN FOUR WAYS**, tree md5-restored after each:

| mutation | reds |
| --- | --- |
| the safety filter is dropped | both narrowing cells — full/bodyweight/injured all return 112 |
| already-present rows are offered again | *"nothing already on the day is offered"* |
| the load owner is never asked | the CONTROL — 0 loaded candidates |
| an add refuses at seven | *"the athlete's own adds keep landing past the app's cap"* |

## BLAST RADIUS

`test:compile` 665 / 73, unchanged. `dead-affordances` 6/0, `ui-picture-manifest`
5/0, `approved-icons` 14/0, `action-walker` 19/0 — all identical to the control.

`test:exercise-edit-entry-surface` went 35/35 → 33/35 and is now **38/38**: it
pins `prepareAdd` and `add_kind` by name. That file already records the standard
for editing such a list — *"WHICH SIDE MOVED: the RULING, with a date"* — and it
is the ruling that moved, exactly as it did for `prepareConcern`. The two
replacement owners and the two replacement steps are pinned in their place, so
the deletion does not take the Add flow's coverage with it.

**NOT COVERED YET:** the simulator.

Agent: rebuild


---

# 2026-08-19 — THE INJURY DOOR WAS TELLING THE TRUTH ABOUT THE WRONG THING

## THE FALSE SUCCESS, MEASURED BEFORE ANYTHING WAS BUILT

`npm run probe:injury-recompose`, real athlete, real off-season session:

```
Knee/6        "Injury restrictions are active and affected sessions were safely recomposed."
              VISIBLE CONTENT CHANGED: false
              rows STILL UNSAFE: ["RDLs","Bulgarian Split Squats"]

Hamstring/8   training PAUSED — same sentence, same byte-identical week,
              same two unsafe lifts still on the day.

Shoulder/4    same sentence; ["Landmine Press","Barbell Row","Banded Dead Bug"] still there.
```

**The claim was true about the wrong thing.** `visibleProgramChanged` comes from
the accepted-state transaction and reports that STORED STATE moved — a fact
written, an overlay published. The athlete's rows are a different question and it
was never asked.

## WHAT IS THERE NOW

`utils/injurySessionRecomposition` owns the question the claim is about: for THIS
session and THIS injury, which rows are unsafe, what does the approved fallback
ladder offer for each, and what is left over. **It writes nothing** — the door
applies the plan through the SAME action owners an athlete's own taps use, so an
injury substitution is a `swap_exercise` and an injury omission is a
`remove_exercise`. No private injury writer, and `assessTapSwapCandidateSafety`
decides both which rows are unsafe and which replacements are allowed, so there
is no second opinion about safety.

The same three worlds now:

```
Knee/6        "2 exercises swapped for a safe option."   changed=true   unsafe left: []
Hamstring/8   "…but RDLs, Bulgarian Split Squats could not be made safe.
               Skip those and check with a physio."      changed=FALSE  unsafe left: 2, NAMED
Shoulder/4    "2 swapped; Banded Dead Bug left out — nothing safe was available."
                                                          changed=true   unsafe left: []
```

**The paused hamstring is the honest refusal, and it is correct that nothing
moved**: with training paused the swap door's own safety check refuses every
candidate, so the app says so instead of substituting quietly.

**`changedProgram` is now what the ATHLETE can see**, and the count is of what
LANDED — each write goes through the ordinary owner and can be refused by it, and
counting the PLAN would be the same class of claim this unit exists to delete.

## THE GATE — `npm run test:injury-recomposition`, 33 cells, ALL GREEN

Three worlds driven end to end, each checked BOTH ways — what the door said and
what the session actually is. Every world opens with a control proving it really
carried unsafe work.

**MUTATION-PROVEN FOUR WAYS**, tree md5-restored after each:

| mutation | reds |
| --- | --- |
| the old sentence comes back | 2 cells, on the paused hamstring |
| `changedProgram` comes from the transaction again | *"matches what the athlete can see"* |
| a nameless choice is accepted as a replacement | the medical-stop plan cell |
| the duplicate guard is removed | *"nothing is duplicated"* — `Easy Bike` twice |

## THREE INSTRUMENT FAULTS WORTH RECORDING

1. ⚠ **AN UNMUTATABLE CLAUSE.** The first cut filtered on `kind !== 'rest'` AND
   on the name. Inverting the `kind` clause changed nothing in any world —
   `restChoice()` carries `name: null`, so the name check had already refused it.
   **A clause no mutation can reach is not doing the work its comment claims**;
   it is deleted and the property is stated as *a choice with no name is not a
   replacement*.
2. ⚠ **A GREEN-AND-EMPTY REST CELL.** The rest refusal was asked in a knee world,
   where the ladder returns named exercises long before it reaches rest. It is
   asked in a MEDICAL-STOP world now, with a control proving that world really
   does offer a rest fallback.
3. ⚠ **A MUTATION THAT ONLY BROKE THE SYNTAX.** Commenting out the duplicate
   guard left a dangling `&&` and sucrase died at import — zero cells, which is
   not a red about the product. Re-run by replacing the predicate with
   `Boolean(true)`.

## BLAST RADIUS

`test:compile` 665 / 73, unchanged. `injury-authority` 5/0, `injury-guard` 232/0,
`injury-engine` 81/20, `pending-injury` 45/0, `coach-injury-integration` 35/1,
`guided-injury-totality` 25/0, `injury-routing-divergence` 6/0,
`persistent-injury` 5/0, `program-control-durable` 18/0 — **every one identical
at the control worktree**, including the two that were already red.

**NOT COVERED YET:** the simulator, and injury recomposition beyond the athlete's
own dated session — the constraint governs every week the composer authors from
here, and this is the half nothing regenerates.

Agent: rebuild


---

# 2026-08-19 — ONE PLACE TO CHANGE THE SESSION, AND THE WALK THAT FOUND TWO DEFECTS

## THE HUB

Deleted: three unlabelled icons in the sticky header (a plus, a dumbbell, a
plaster — nothing said which was which, and the dumbbell came and went with the
session's equipment needs) and the swap/remove icon pair on EVERY row of every
session.

Built: **"Need to make a change?" — Equipment · Injury · Add · Remove · Swap**,
below the session, in words. Remove and Swap ask which exercise through the
existing `pick_exercise` step, which now serves all three of the doors that need
a row rather than growing a picker each.

**"NO DEAD BUTTONS" IS ENFORCED BY CONSTRUCTION.** `SessionChangeHub` takes the
actions as a LIST and renders exactly what it is handed — it knows nothing about
which doors exist, so it cannot render one with nowhere to go, and there is no
disabled state for a caller to pass. Equipment is the only door that comes and
goes, and it goes by absence.

⚠ **THE INGRESS TEST IDS MOVED WITH THE INGRESS.** `componentSwapIngress` and
`componentDeleteIngress` named the deleted row icons; they are on the picker's
rows now, because the picker IS the swap/remove ingress. Deleting them with the
icons would have left the explorer and the lifecycle witness watching a door that
exists under a new name.

Kept, as ordered and asserted: the play/demo button and its video modal, the
checkboxes, the load controls (`weightControl` / `weightInput`) and the form cues.

**GATE:** `npm run test:session-change-hub`, 35 cells, ALL GREEN — half of them
asserting what SURVIVED, and one CONTROL proving the comment-stripped source
still holds the screen, because every absence cell is a `!includes` and
`!includes` is true of an empty string.

## THE COMBINED WALK — AND IT EARNED ITS KEEP IMMEDIATELY

`npm run test:session-change-sequence`: one athlete, remove → swap → add on one
session, then a real restart, then an injury pass over the top, then Restore.

**20 of 22 cells green. It found THREE defects in one run; I fixed one and named
two.**

### FIXED — SWAP AND ADD WERE HELD IN MEMORY ONLY

The athlete swapped a lift and added an exercise, closed the app, and both were
gone. **The durability was never in the store — it is in the DECISION LEDGER**:
`quiescentBoot` blanks `dateOverrides` on purpose and rebuilds the athlete's
edits by replaying the ledger. Only `executeProgramControlActionDurably` appends
to it. Remove already used it; swap and add used the synchronous twin, so nothing
recorded them and the clean slate erased them. Both doors are durable now, and
**the ADD survives**.

⚠ My first cut added `dateOverrides` to the persisted inputs. It reached disk
correctly and changed nothing, because boot blanks it after hydration by design —
and keeping it would have been a SECOND representation of the athlete's edits
racing the ledger's replay. Reverted, and the reason is recorded at the fix.

### FIXED — THE INJURY PASS WAS RECOMPOSING ROWS THE ATHLETE HAD ALREADY REMOVED

`resolveWorkoutOnDate` returns the AUTHORED day, which still carries every row an
exclusion is hiding. The injury pass "made safe" a row the athlete had already
taken out. It reads the athlete-visible day now: **an exercise the athlete has
removed is not unsafe, it is not there.**

### ⚠ OPEN #1 — A SWAP DOES NOT SURVIVE A RESTART

Removal survives (a decision in athlete preferences) and the ADD survives (its
ledger replay lands), so this is not "the ledger is not replayed" — it is the
SWAP's replay specifically. Remove, swap and add each write a `dateOverride` for
the same day during replay and the later writes appear to compose from a base
that does not carry the earlier one. **The fix is in how one day's overrides
compose during ledger replay — `quiescentBoot`'s ordering, not this mission's
five doors.**

### ⚠ OPEN #2 — RESTORE CANNOT REVEAL A ROW A SWAP HAS WRITTEN OVER

**The same defect this branch fixed twice, one door along.**
`replaceExerciseAtDate` writes the day's override from a read that ALREADY HAS
THE FILTER APPLIED, so a hidden row is baked out of the stored override and
Restore has nothing to give back. Traced: the injury plan correctly excludes the
removed row (`unsafe=["Bulgarian Split Squats","Back Squat"]`, `RDLs` filtered),
and the write still loses it.

The boundary that closed this at the compose owner and the resolver — exclusions
travel on `ScheduleState`, and only VIEW doors carry them — leaks because
`buildScheduleStateImperative` is used by writers as well as views. **The fix is
a writer-side `ScheduleState` that carries no exclusions, and that function has
fourteen callers: its own slice, not a line at the end of this one.**

**BOTH CELLS STAY RED AND NAME THEIR CAUSE.** Editing either expectation to match
would be the `expectation-edited-to-match-the-regression` defect.

## BLAST RADIUS

`test:compile` 665 / 73, unchanged. `exercise-edit-entry-surface` 35/0,
`dead-affordances` 6/0, `action-walker` 19/0, `accessibility-contracts` 33/5,
`dev-e2e-testids` 28/2, `maestro-element-contract` 0/1, `program-control-durable`
18/0, `undo-reversal` 19/0, `athlete-journey` 58/0 — **every one identical at the
control worktree**, including the four already red there.

**NOT COVERED:** the simulator. Nothing in this mission has been seen on glass.

Agent: rebuild

---

# BOTH OPEN DEFECTS CLOSED — 2026-08-19, same seat, next session

## DEFECT 1 — THE SWAP DID NOT SURVIVE A RESTART. THE FIRST DIAGNOSIS WAS WRONG.

The note above said *"the later writes compose from a base that does not carry
the earlier one, so the last write wins"*. That was inferred from the symptom and
the symptom fitted it. **It was not the cause.** Nothing composed badly, because
**the swap's replay never ran.**

The replay's own warning is swallowed by the suite's `quietAsync`. Instrumented
(boot run with the console live) it says, verbatim:

```
[quiescentBoot] a recorded door action no longer applies on replay
  entryId: 'dl-2', actionType: 'swap_exercise',
  message: "2026-07-22 is in the past - I can't change it."
```

`quiescentBoot.replayEntry` passes `entry.occurredAt` as `todayISO`, and
`replaceExerciseAtDate` refuses any date before "today". **Startup was
re-adjudicating a decision the ledger already recorded as accepted, and dropping
it.** The removal survived because it is a durable decision in athlete
preferences; the add survived because it has no such guard — which is exactly why
the symptom read as *"the SWAP specifically"*.

**THE FIX REMOVES THE AUTHORITY, IT DOES NOT COMPENSATE FOR IT.** The staleness
refusal no longer applies while the ledger replay latch is held. The latch is the
app's existing statement of this same idea — *"a replayed interpreter is not the
athlete acting"* — and it carries no imports, so consulting it forms no cycle.

**AND IT IS A PRODUCTION DEFECT, NOT A HARNESS ARTEFACT.** `occurredAt` is
`new Date().toISOString()` — a UTC instant — and replay string-slices it to a
date. In any timezone BEHIND UTC an ordinary evening swap stamps TOMORROW, so the
guard refuses the athlete's own edit on the next launch. Fixing only the clock
would leave the refusal standing for DST, travel and a manual clock change, so
the refusal is what went.

⚠ **NAMED, NOT FIXED:** `occurredOn` is still a UTC-sliced date and is still
passed as `todayISO` to every other replay arm. It no longer causes a refusal on
the five doors; what it does to `plan_change` replay is not measured here.

## DEFECT 2 — RESTORE COULD NOT REVEAL A ROW A SWAP WROTE OVER. NARROWER THAN PRICED.

The diagnosis above was right. The PRICE was wrong. It read *"a writer-side
`ScheduleState` … and that function has fourteen callers"*. The fourteen are
callers of `buildScheduleStateImperative`, and the leak is not there — it is
`coachActions.resolveDateWorkout`, the module-private read those writers actually
use, and **all six of its callers are writers**: `lightenSession`,
`moveSession`, `makeSessionOptional`, `replaceExerciseAtDate`,
`addExerciseAtDate`, `addWeeklyOverride`. Not one is a view.

So the seam is ONE function. It states `athleteExclusions: []` the same way
`liveEvaluationSurfaces.freshGenerationSurfaces` does — a world that deliberately
has none, rather than one that forgot to look.

## THE THIRD DEFECT, FOUND BY THE NEW SUITE, AND NOT FIXED

**INJURY IS THE SAME "MEMORY ONLY" CLASS, ONE DOOR ALONG.** Sequence 6
(injury → remove → restart) is RED. The injury EPISODE is durable
(`activeConstraints` still reads `["injury-knee"]` after hydration) but the
recomposition it performed is written to `dateOverrides`, which boot blanks by
design; the ledger holds only `dl-1 remove_exercise`. Nothing replays it.

**MEASURED BYTE-IDENTICAL WITH BOTH FIXES REVERTED — it is pre-existing.**

Three independent facts each block the small version of the fix, so it is its own
slice with the injury episode owner:

1. `LEDGER_RECORDED_ACTION_TYPES` is deliberately the three EXERCISE-LEVEL types,
   and the door states the rule the list exists to keep — one act must not become
   *"two decisions … which the athlete would feel as an undo that needs two
   taps"*. Recording the injury's component swaps individually is ruled out.
2. `withAcceptedMutationLock` is a strict serial queue and is NOT re-entrant, so
   the injury arm cannot route its component writes through the durable door from
   inside itself — it would deadlock.
3. Recording ONE `set_injury_modifier` decision does not help either: boot replay
   uses the SYNCHRONOUS executor by design, and that executor refuses this action
   outright — *"Injury changes must use the durable injury transaction."*

## THE GATE — `npm run test:session-change-durability`, 35/36

Seven sequences, and every cell compares the WHOLE ordered row list with loads
(`Name@kg`), never a count or a membership test: both defects produced a session
with the right NUMBER of rows and the wrong rows in it.

1 swap→restart (+ a two-swaps-of-one-row ORDER probe) · 2 remove→restart→restore ·
3 remove→swap→restart→restore · 4 swap→remove→restart→undo · 5 equipment→swap→
remove→restart · 6 injury→remove→restart **(RED, above)** · 7 add→swap→restart.

## MUTATIONS — all four the mission named, tree restored byte-identical after each

| # | mutation | what reddened |
| --- | --- | --- |
| M1 | drop the Swap decision from the replay set at boot | **9 cells** across sequences 1,3,4,5,7 + `test:session-change-sequence`'s "the swap survived" |
| M2 | replay the decisions in the wrong order | **3 cells** — the order probe lands the day on `Glute Bridge` (the FIRST swap) instead of `Single-Leg RDL` (the last), and undo-after-restart breaks |
| M3 | writer reads the FILTERED day again (revert defect 2's fix) | the Restore cells in **both** suites |
| M4 | `recordSelections: 'replay'` → `'author'` — startup re-authors the block | **8 cells**, incl. `Deadlift@77.5` walking into the removed slot during boot |

⚠ **TWO EARLIER M4 ATTEMPTS WERE NO-OPS AND ARE REPORTED AS SUCH.** Blanking
`blockState`/`acceptedBlocks` proved nothing (this athlete is in block 1, so those
are already empty), and forcing `generationISO = todayISOLocal()` also changed no
visible row. A mutation that reds nothing is a claim about the instrument only
once you know it actually mutated the world — neither of those did.

## BLAST RADIUS — measured against the same tree, not against memory

Eighteen suites run at base and again with the fix. **Every one identical except
`session-change-sequence`, which went 20/2 → 22/0.** `test:compile` output is
byte-identical (73 pre-existing failures; `coachActions.ts` itself has none).

Pre-existing reds carried, NOT caused here: `exercise-exclusions` 52/1,
`athlete-session-deletion` 2/12, `athlete-session-move` 13/9, `week-rebuild`
THROWS, `decision-ledger-ownership` 7/1, `quiescent-boot` 4/1,
`program-control-durable` 18/2, `program-control-decisions` 10/1,
`tap-swap-hierarchy` throws at import.

Agent: rebuild

---

# THE SIMULATOR PASS — the hub is right, and the RESTART CRITERION FAILS

Run on `LFA Explorer 4c8535f`, Metro :8092 from THIS worktree (`:8081` belongs to
another checkout — verified by an established socket and the app's own logs
streaming into `/tmp/qa-metro.log`, not by assuming). Seed
`exercise-removal-restart`. Screenshots 01-09 in the seat scratchpad.

## WHAT IS RIGHT ON GLASS

**The hub is exactly the ordered surface.** "Need to make a change?" —
**Equipment · Injury · Add · Remove · Swap**, in words, below the session.
**NO old header icons** (back chevron and title only). **NO per-row Swap/Remove
icons** — each row carries only its checkbox, demo ▶ and the load −/+.

**All five actions work, and every message was honest:**

| action | what the app said | true? |
| --- | --- | --- |
| Swap | "RDLs was replaced with Hip Thrusts in today's session." | yes |
| Remove | "Cossack Squat was removed from today's session." + header 5→4 | yes, and nothing filled the hole |
| Add | "Seated Calf Raise was added to today's session." | yes, 4→5 |
| Injury | recomposed the day, then **REFUSED**: "Could not swap exercise — Could not find 'Back Squat' on 2026-07-13." | **honest refusal** |
| Equipment | "Saved for this session only… your saved gym setup is unchanged." | yes |

**COMPOSITION IS VISIBLE**: the Injury picker listed `Hip Thrusts` (the swap) and
`Seated Calf Raise` (the add) and did NOT list `Cossack Squat` (the removal) —
all three decisions live in one list.

⚠ **A STALE OFFER, NOT A LIE.** The guided injury flow performs its own
recomposition and THEN offers "Apply change" for a substitution it has already
made, so applying it refuses. The refusal is honest and nothing is corrupted;
the offer should not be drawn. Named, not fixed.

## ⚠ THE RESTART CRITERION IS NOT MET, AND THIS IS THE HEADLINE

*"Restart produces the same visible session as immediately before shutdown."*
**It does not, in a world where the injury and equipment doors have also run.**

```
BEFORE  Bench Press 3x10 107.5kg · Breathing Reset 1x5 · Band Pallof Press 2x10 BW
AFTER   RDLs 3x3 90kg · Leg Press 3x4 137.5kg · Band Pallof Press 2x10 BW
        ("Dumbbells today — no barbell")  ("Swapped from Back Squat — equipment today")
```

**THE REPLAY RAN — that part of the fix is working.** The boot no longer refuses
the swap for staleness. It refuses it for something else:

```
[quiescentBoot] a recorded door action no longer applies on replay
  swap_exercise   dl-1  "The replacement still loads the active knee issue."
  swap_exercise   dl-1  "barbell equipment is not available."
  remove_exercise dl-2  "Could not find \"Cossack Squat\" on 2026-07-13."
```

**THIS IS THE SAME DEFECT CLASS I REMOVED, ON DIFFERENT GROUNDS.** The swap arm
re-runs `assessTapSwapCandidateSafety` and the equipment legality check during
replay, so startup is again a SECOND authority over an already-accepted decision
— this time refusing on safety/kit rather than on date. The chain:

1. the injury recomposition is **memory-only** (the third defect, above), so it
   does not replay and the boot rebuilds the day from base + the durable
   equipment fact;
2. the athlete's swap is then judged against injury and equipment facts that were
   declared AFTER it, in an order that never existed when they made it, and is
   refused;
3. the removal's replay cannot find its row either — harmless only because the
   exclusion is durable independently of the ledger.

**WHY THE HEADLESS SUITE DID NOT CATCH IT.** Sequence 5 declares equipment
FIRST and then swaps; the device walk swapped first and declared injury and
equipment after. **A replay is only order-safe if no later fact can veto an
earlier decision**, and that is the property neither suite states. The next slice
owns it, with the injury-durability slice: they are one question.

**NOT FIXED HERE, AND NOT HIDDEN.** Removing the safety re-adjudication is not a
line — an accepted swap that is genuinely unsafe under a later injury needs a
ruled answer (honour it, drop it and SAY SO, or re-offer), and that is Sam's
ruling to make, not mine.

Agent: rebuild

---

# SAM'S RULING BUILT — a later fact DISPLACES an accepted decision, it does not veto it

**The ruling (2026-08-19), as acceptance criteria:** a later injury/equipment fact
must (1) displace the athlete's chosen exercise rather than refuse it, (2) via the
approved fallback ladder, omitting only when nothing is legal, (3) tell them
exactly why, (4) keep the Swap preference underneath, (5) apply **when the action
occurs**, never first at startup, (6) leave startup replaying decisions and facts
with **no new choice and nothing discarded**, and (7) stop the injury picker
offering a row the injury pass already handled.

## WHAT CHANGED, AND WHY EACH ONE

| # | change | why |
| --- | --- | --- |
| 1 | the swap arm's safety/kit gate does not run under the replay latch | it was VETOING an accepted decision at startup — the same defect as the staleness guard, on different grounds |
| 2 | `reapplyActiveInjuryRecompositions`, called by `rebuildDerivedWorld` **after** the ledger replay | the injury's recomposition lived in `dateOverrides`, which boot blanks; the FACT is replayed, no ledger entry, no transaction |
| 3 | `substitutedFrom` threaded through the swap payload and writer; the injury pass names whose place a row takes | the athlete is told why their choice is not being used, on the row, through the carrier the screen already renders |
| 4 | `resolveInjuryEpisode` re-derives, exactly as `createOrUpdateInjuryEpisode` already did | **the create path re-derived and the resolve path did not** — so a cleared injury left its displacements on the day forever and the preference could never come back |
| 5 | the injury door's claim is derived from the athlete's ROWS before/after (`describeVisibleInjuryChange`) | change 2 made the door's own pass a no-op, and it then reported *"Nothing on this session needed changing"* over a session that had just lost two rows — the same false claim from the opposite direction |
| 6 | the guided injury flow reads the day LIVE and skips its follow-up offer when the row is already gone | the stale picker; the closure's `workout` predates the recomposition by construction |

## THE GATE — `npm run test:session-change-durability`, 47/47

Sequence 8 is the ruling itself and carries a **non-vacuity control**: if the
ladder ever picks something the injury allows, nothing is displaced and the rest
would pass by not applying — the control fails instead.

## MUTATIONS — four more, tree restored byte-identical after each

| # | mutation | what reddened |
| --- | --- | --- |
| M5 | startup does not replay the injury fact | 3 cells — the restart stops reproducing the session and the reason vanishes |
| M6 | the fact is replayed BEFORE the decisions | 2 cells, and the *shape* is the proof: the row reads `Bench Press<-RDLs` instead of `<-Glute Bridge` — the injury displaced the ORIGINAL row and the athlete's swap landed on top of the safe one |
| M7 | the safety gate vetoes at replay again | 2 cells — the choice is discarded rather than displaced |
| M8 | an ended injury does not re-derive | 2 cells — the preference never comes back |

## BLAST RADIUS — measured against the same tree, twice

`test:compile` byte-identical to baseline (73 pre-existing). The eighteen-suite
battery identical except `session-change-sequence` 20/2 → 22/0. **The ELEVEN
injury suites were then run at HEAD and again with this work, and are identical**
— `injury-engine` 81/20, `injury-authority` 5/20 and three that throw at import
are all pre-existing and are NOT caused here.

Agent: rebuild

---

# SWAP IS ONE QUESTION NOW — and the menu stopped padding itself

**Sam's correction (2026-08-19):** *"Delete the entire 'Why do you want to swap
it?' step. Swap means only: I want a different exercise. … Equipment and Injury
already have separate actions, so do not ask about either inside Swap. Too
hard/easy also does not belong here."* Plus the option-quality list:
`Bodyweight Squat` is not a Back Squat alternative for a full-gym athlete,
`Breathing Reset` is not a Back Squat replacement, up to 2+2+2, **show fewer
rather than pad**, and regressions only when Equipment or Injury justify them.

## THE ROUTE — one question, then the answer

`pick_exercise(swap)` now calls the swap preparer directly. **Deleted:** the
`swap_reason` step kind, its render case, title and subtitle; `SWAP_REASONS`;
`SWAP_REASON_ICON` (six icons for six labels); and four of the six reason values.
`'Injury / pain'` survives ONLY because the separate Injury action routes through
the same suggestion owner and needs the injury ladder — it is set by that flow,
never chosen. Equipment and Injury doors are untouched.

## THE QUALITY — and the ORDERING was the real defect

Three causes, and the first two were the obvious ones:

1. **`recoveryChoice` was appended unconditionally** whenever no recovery-tier
   option was present, so every ordinary swap ended with a breathing drill.
   Now appended only when a constraint justifies it.
2. **Regressions were never filtered.** Now a bodyweight stand-in for a LOADED
   row is dropped unless Equipment/Injury justifies it. ⚠ The first cut tested
   `Boolean(equipmentForExercise(name))` and filtered NOTHING —
   `equipmentClassFor` returns the STRING `'bodyweight'`, not `null`; only
   `Breathing Reset` answers null.
3. ⚠ **THE REGISTRY RANKED SAME-PATTERN OPTIONS EASIEST-FIRST.** It sorted by
   lowest fatigue then lowest load and took the top two, so the default menu was
   the two GENTLEST options in the pattern. `RDLs` offered `Glute Bridge` while
   `Deadlift` and `Trap Bar Deadlift` sat behind the `too_easy` branch a healthy
   athlete could no longer reach. **Filtering the bodyweight result out left ONE
   option; the ordering, not the filter, was the defect.** An unconstrained
   athlete now gets the NEAREST load and fatigue; a constrained one keeps
   easiest-first.

`allowHigherFatigue` also followed the deleted question, so it now follows the
athlete's state — the same predicate as the regression filter, so they cannot
drift apart.

**MEASURED (`npm run probe:swap-choices`), preference, full gym, no injury:**

| row | before | after |
| --- | --- | --- |
| RDLs | `Glute Bridge`, `Single-Leg RDL`, + `Breathing Reset` | `Single-Leg RDL`, `Hip Thrusts`, `Kettlebell Swings` |
| Bulgarian Split Squats | incl. `Bodyweight Squat` | `Walking Lunges`, `Reverse Lunges`, `Back Squat` |
| Barbell Row | incl. `Inverted Row (Bodyweight)` | `Single-Arm DB Row`, `Chest Supported Row` |

## GATES

`test:exercise-swap-choices` 31/31 (six new quality cells, one of them the
control proving the rule is CONDITIONAL — the regressions must still appear once
an injury justifies them, or the rule has become a blanket ban).
`test:exercise-edit-entry-surface` 39/42 — **the three failures are pre-existing**
(header icons and row-actions, deleted by the hub commit); measured identical at
HEAD. Five new route cells added there.

## MUTATIONS

| # | mutation | what reddened |
| --- | --- | --- |
| M9 | the regression filter is disabled | `no BODYWEIGHT regression … for ANY loaded lift` |
| M11 | recovery re-appended unconditionally | `no recovery filler … while real training options exist` |

⚠ **M9 SURVIVED THE FIRST VERSION OF THE GUARD**, which asked only about the
FIRST barbell row — whose alternatives are all loaded anyway. The cell was green
whether the filter ran or not. It now asks about **every** loaded row. A guard
that cannot see its own rule being deleted is not guarding it.

Agent: rebuild

---

# ONE HUB, BOTH SURFACES

**Sam, 2026-08-19:** *"The Need to make a change? section inside an active
session must use the same shared UI component and visual design as the Day
screen — not a separate row of plain text pills … Do not keep separate Day and
Session implementations. Both must render one shared hub and enter the same
canonical action doors."*

**THERE WERE TWO HUBS.** The Day screen had the signed card — heading, sub-line,
a row of 48px tinted icon chips. The session screen had its own row of bordered
text pills, built when the five labelled actions landed. Same heading, same five
doors, two visual languages, and every future change to make twice.

`components/SessionChangeHub` is now the one owner. It carries the CARD, the
heading, the sub-line, the chips, the icons, the tints, the labels and the
pressed state. The session screen's local component and its five pill styles are
DELETED. Both screens import and mount the shared one.

**THE DOORS ARE THE SAME FIVE OWNERS, REACHED WITH THE RIGHT DATE.** Injury and
Remove are the Day screen's own — Remove deliberately, because `UndoToast` mounts
on Home and a removal driven from the pushed screen raised its toast behind it.
Equipment, Add and Swap have exactly one owner each and it is the session screen,
so the Day hub opens today's session ON that door via a new `openChange` route
param, which the session screen consumes once and then clears. A second copy of
those three on the Day screen is the duplication this ruling deletes.

⚠ **"Tired" AND "Sick" WERE NOT DELETED, AND THEY ARE NOT IN THE HUB.** They
shared the old card only because it was the nearest panel. They are readiness
FACTS, they open the readiness sheet rather than any of the five doors, and
folding them in would make a hub whose contract is *"the five actions"* disagree
with itself. They keep their doors, testIDs and tints in their own row.

**TWO LABEL DEFECTS, BOTH SEEN ONLY ON GLASS.** At five chips a 402pt screen
gives each about 68pt: `Equipment` first truncated to `Equipm…`, and when
wrapped it broke mid-word as `Equipmen / t`. It is shrunk to fit one line
instead; the other four are untouched.

**PARITY GUARD:** `test:session-change-hub` section [8], 57/57 — both screens
import the shared module, NEITHER declares one of its own, the pill styles are
gone, both offer all five ids, the component owns the labels/icons/tints, and the
Day surface's three routed doors are asserted against the session screen's
consumer.

Agent: rebuild
