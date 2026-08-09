# COACH ARCHITECTURE REASSESSMENT — 2026-08-09

**The seven-question reassessment AGENTS.md's Coach Architecture Escalation
Rule requires before any further coach pipeline code.** Written against
`docs/COACH_REBUILD_SURVEY_2026-08-09.md` §5, as the survey's own §8 directed,
rather than re-derived. This is the coach unit's opening law doc.

**LOOP CHECK: `four-sittings-conclude-representation-count` — sighting 5, and
this document IS the compression.** The survey's §8 named the shape: the
clarifier transaction (2026-07-24), the acceptance contract's cross-cutting
review note, LR-6's eight representations, and the survey's own §3.2 have each
independently concluded that the coach's problem is *the number of
representations of one request*. A fifth sitting that re-discovered it would be
the failure the loop-audit law exists to prevent. So the fifth sitting does not
re-discover it — it **rules on it**, and the rule is §9's ownership boundary.
This entry **CLOSES**; the next sighting is a gate going red, not a document.

**MANDATE AND ITS LIMIT.** This reassessment covers the DOORS and the WRITE
model. It makes no ruling on any athlete-visible coach surface — the chat
surface, the privacy opt-in, the coach's voice, or any word an athlete reads.
Those wait on Sam's mock and sign-off and are explicitly not tonight's work.
Nothing here presumes an answer to them.

**STATUS DISCIPLINE.** Every claim is **MEASURED** (with the command or
`file:line` that produced it), **ATTRIBUTED** (cited, not re-measured), or
**OPEN-UNKNOWN**. **COUNT DISCIPLINE:** every number names its instrument's
unit. No completeness claim is made; §12 is the not-covered list.

---

## §0 THE RULING IN ONE PARAGRAPH

The coach has ten representations of one athlete sentence and the ledger is not
one of them. Every mutation it can express already has a typed athlete door —
`executeProgramControlAction`, 26 action kinds — and that door is the only
layer in the app that both the tap surface and the coach could share. So the
coach does not get a ledger adapter, a writer, or a ninth representation: **the
coach's output becomes a `ProgramControlAction`, the door executes it, and the
ledger records the door's own vocabulary verbatim.** That collapses ten
representations to two (the LLM wire shape, which crosses a network and cannot
be avoided; and the door action, which is the decision). Undo, replay and
durability then arrive for the coach because they already exist for the door —
**but only for the destinations that are ON the ledger, which today is two of
five.** Putting the other three on it is engine work, it is not coach work, and
it is the prerequisite this unit must land before a single coach module is
rewritten.

---

## §1 QUESTION 1 — WHAT IS THE CURRENT SOURCE OF TRUTH?

**MEASURED. There are three persisted input channels and one derived world, and
the coach writes to none of the three.**

| channel | what it holds | receipt |
|---|---|---|
| **the decision ledger** | `plan_change`, three `fixture_*` kinds, `reversal`, `migrated_day_placement` | `types/decisionLedger.ts:32-55`; store `decision-ledger-store` |
| **`programStore`'s input slice** | `generationAnchorISO`, `seasonPhaseClock`, `sessionFeedback`, `weightOverrides`, `temporarySourceFacts`, `injuryEpisodes` — and nothing else | `programStore.ts:2371-2379` (`partialize`) |
| **sibling stores** | `readinessStore`, `coachPreferencesStore`, `athletePreferencesStore`, `journalNoteStore`, `calendarStore` | each its own `persist` key |

Everything else is **derived in memory and wiped on every rebuild**:
`rebuildDerivedWorld` sets `currentProgram`, `dateOverrides`, `overrideContexts`,
`weekScopedOverlays`, `userRemovalConstraints`, `exposureContractsByWeek`,
`reversibleAdjustmentLedger`, `markedDays`, `activeConstraints`, `activeInjury`
and `readinessSignalsByDate` to empty, regenerates from profile, then replays
the ledger (`quiescentBoot.ts:378-406`, replay at `:446-465`).

**So the answer has two halves, and the second is the finding.**

1. **For the WEEK: the ledger, plus profile answers and the fact slices.** This
   is settled and correct; R5.1 made it true by construction
   (`quiescentBoot.ts:20-31`).
2. **For a COACH EDIT: nothing.** MEASURED —
   `grep -rln "appendDecisionEntry" src` outside tests returns five files:
   `decisionLedgerStore.ts` (the door), `planChangeProducer.ts`,
   `fixtureMutationTransaction.ts`, `preRebuildEnvelopeMigration.ts`, and
   `undoLastDecision.ts` (new since the survey, from the undo unit). **No module
   named `*coach*` is among them.** The coach's writes land in
   `applyProgramOverrideWrite` under seven of its own writer ids
   (`programStore.ts:2447-2466`), on surfaces that are in neither `partialize`
   nor `merge` and that `rebuildDerivedWorld` empties. A coach edit is
   **erased by the next boot, and by any mid-session re-derivation.**

**This is not a defect somebody introduced. It is what R5.1 was for, arriving at
a pipeline that was frozen before the switchover reached it.** ATTRIBUTED to
survey §3.2, re-measured here at `partialize` and `rebuildDerivedWorld`.

---

## §2 QUESTION 2 — HOW MANY REPRESENTATIONS OF THE USER REQUEST EXIST?

**TEN, and the unit is DECLARED TYPES ON THE PATH FROM ONE SENTENCE TO ONE
STORED FACT.** Each has exactly one declaration site, MEASURED by
`grep -rn "^\s*(export )?(interface|type) <Name>\b" src`:

| # | representation | declared at | lines in owner |
|---|---|---|---|
| 1 | the LLM tool-call JSON | `supabase/functions/coach-chat` (wire shape, untyped in this repo) | 2,605 |
| 2 | `CoachIntentPayload` | `utils/coachIntent.ts:115` | 746 |
| 3 | `CoachMutateOperation` | `utils/coachCommandRouter.ts:107` | 3,409 |
| 4 | `CoachPlanChangeKind` | `utils/coachPlan.ts:16` | 904 |
| 5 | `CoachResolvedTarget` | `utils/coachTargetFrame.ts:35` | 729 |
| 6 | `ProgramEditDraftAction` | `utils/coachProgramEditDraft.ts:47` | 935 |
| 7 | `CoachRevisionIntent` | `utils/coachRevisionProposal.ts:114` | 1,670 |
| 8 | `PlanChange` | `utils/planChangeTypes.ts:109` | — |
| 9 | `ProgramControlAction` | `utils/programControlActions.ts:171` | — |
| 10 | `AthleteDecision` | `types/decisionLedger.ts:32` | — |

**LR-6's census entry named EIGHT** (`data/legacyReckoningCensus.ts:565-611`,
ATTRIBUTED) — rows 1-8 above. **Rows 9 and 10 are post-R5 arrivals**, which is
why that entry does not list them: the door union and the ledger union both
landed after LR-6 was written. **The count went UP while the rebuild was
making things simpler**, and nobody counted, because each addition was correct
on its own terms.

**COUNT DISCIPLINE, stated rather than buried.** This counts DECLARED TYPES.
LR-6's own `whyNotDetectable` says counting type NAMES counts vocabulary, not
representations, and it is right — a re-measure of type-name occurrences gives
2/6/4/4/4/5, which is a different instrument answering a different question.
The claim here is not "ten identifiers exist"; it is **ten places where one
sentence is re-expressed in a shape the previous layer could not carry**, which
is a structural reading of the same tree. Rows 8-10 are re-measured directly;
rows 2-7 are the census's, confirmed to still have exactly one declaration site
each.

---

## §3 QUESTION 3 — WHERE CAN INTENT, DOMAIN, DATE, TARGET OR SCOPE BE REINTERPRETED?

**At every one of the nine boundaries between the ten representations — and the
sharpest example is not in the coach tree at all. It is in the door, it is
recorded in the door's own source, and it already shipped a wrong result.**

**MEASURED, `programControlActions.ts:173-181`**, verbatim:

> `scope` is the COMPONENT the athlete chose to move ("just the gym session"),
> and it had nowhere to live here. The sheet offers the choice, this payload
> could not express it, and `planChangeForAction` therefore built a whole-day
> move — which is what travelled. Note this is a different axis from
> `ProgramControlActionBase.scope` ('today_only'), which is about recurrence;
> two different meanings of the word, one of which was missing.

**One word, `scope`, carries two axes — recurrence and component — and the
representation boundary silently widened a session move into a whole-day
move.** That is the escalation rule's second trigger stated exactly: the layer
above understood "just the gym session", and a later layer, without malice or a
bug, could not carry it and substituted something else.

The general shape, and why guards cannot fix it: **a boundary between two types
reinterprets by OMISSION, not by error.** Every conversion is a total function
into a type that cannot express everything its input could. No guard fires,
because nothing is wrong at either end. The only repair that generalises is to
**remove the boundary**, which is why §5's answer is a deletion and not a
validator.

Where each axis is at risk today, MEASURED at the type level:

- **INTENT** — rows 2→3→4 (`CoachIntentPayload` → `CoachMutateOperation` →
  `CoachPlanChangeKind`): three vocabularies of "what the athlete wants", each
  narrower than the last.
- **TARGET** — row 5 (`CoachResolvedTarget`) resolves a target, and rows 6-7
  re-express it; the ledger's own targeting law (`decisionLedger.ts:9-11`)
  says decisions name DATE + SLOT and never derived session ids, because *"a
  derived id can drift across engine versions, a date cannot"*. Any
  representation carrying an id instead of a date is a drift hazard by that
  law's own statement.
- **DATE** — replay re-runs a decision with `todayISO` set to the day it
  occurred (`quiescentBoot.ts:120`, `occurredAt.slice(0,10)`). A representation
  that resolves a relative date ("Friday") before the ledger sees it records the
  ANSWER; one that records the phrase would re-resolve it against a different
  today. The ledger is on the right side of this and the coach path is not.
- **SCOPE** — the two-axis collision above, plus
  `ProgramControlScope` ('today_only' | 'current_week' | 'future_weeks' |
  'current_and_future') vs `futureWeeksToo?: boolean` on three exercise payloads
  (`programControlActions.ts:201-215`): **the same recurrence question asked
  twice in one union, in two shapes.**
- **DOMAIN** — the survey's §3.3 measured this end to end: 11 of 18 orphaned
  coach suites are green on intent, targets, references, clarifiers, the truth
  gate and the visible-domain verifier, while 7 are red and **every red says the
  same thing** (`at least one override write`, `overrides=[]`). **The
  understanding layers survived the rebuild; the writing layer did not.**
  ATTRIBUTED to survey §3.3, not re-run here.

---

## §4 QUESTION 4 — WHICH LAYER SHOULD OWN THE DECISION?

**`executeProgramControlAction` (`utils/programControlActions.ts`), and the
ledger records ITS vocabulary verbatim.**

Three measured reasons, in order of weight:

1. **It is already the single athlete tap door**, typed, with 26 action kinds
   (`:94-120`) and an explicit `source.screen` field that already includes
   `'coach_notes'` (`:130-137`). The seat for the coach was designed in.
2. **The ledger's own law already says the recorder must not paraphrase**
   (`decisionLedger.ts:29-31`): *"the door vocabulary, verbatim. A ledger entry
   never paraphrases the decision it records."* Today that law is honoured for
   `PlanChange` — which "travels verbatim" (`:11`) — and quietly broken in
   spirit for every other door, because those doors have no ledger kind at all.
3. **Undo already works this way and needs nothing new.** `undoLastDecision`
   appends a `reversal`; `rebuildDerivedWorld` re-derives from the remaining
   decisions (`quiescentBoot.ts:421-425`). **Undo is not a feature that has to
   be extended to each new kind — it is a property of being on the ledger.**

**The corollary is the whole of tonight's item 2.** "Coach acts through the
athlete's doors, so undo covers coach changes free" is **half true, measured**:
`grep appendDecisionEntry src/utils/programControlActions.ts` returns
**nothing**, and only destination (1) reaches the ledger, inside
`applyPlanChange`.

| # | destination | reached via | on the ledger? |
|---|---|---|---|
| 1 | session-level plan changes | `applyPlanChange` (`:575`, `:760`) | **YES** |
| 2 | exercise-level edits | `applyProgramOverrideWrite(writer:'program_control')` (`:423`) | **NO** |
| 3 | injury | `createOrUpdateInjuryEpisode` / `resolveInjuryEpisode` (`:1187`, `:1223`) | **NO** |
| 4 | illness / busy / schedule facts | `transactTemporarySourceFact` (six sites, `:1316`–`:1601`) | **NO** |
| 5 | setup answers | `commitProfileProgramTransaction` (`:1347`) | **NO** |

Fixtures are the second ledger-native path and they reach it through a
different door (`fixtureMutationTransaction.ts:622-637`).

**AND THE THREE OFF-LEDGER DESTINATIONS ARE NOT ALIKE — this is the distinction
the build order turns on, and the survey did not draw it.**

- **Destinations 3, 4 and 5 PERSIST.** `injuryEpisodes` and
  `temporarySourceFacts` are in `partialize` (`programStore.ts:2376-2377`) and
  are **preserved across `rebuildDerivedWorld`**, which wipes only their
  DERIVED projections (`activeInjury`, `readinessSignalsByDate`,
  `activeConstraints` — `quiescentBoot.ts:396-400`). They survive a relaunch
  today. Putting them on the ledger is **representation-collapsing**, and it is
  only an improvement if the fact slices stop being a second input channel at
  the same time. **Adding a ledger kind while keeping the slice would make the
  count worse, not better** — two stored representations of one input, which is
  precisely what the north star forbids.
- **Destination 2 DOES NOT PERSIST.** `dateOverrides` and `overrideContexts`
  appear in neither `partialize` nor `merge`, and `rebuildDerivedWorld` empties
  them. Putting it on the ledger is **a data-loss fix**, not a tidy-up.

**Consequence, stated as a claim to be tested and not as a finding: an
athlete's own today-only exercise swap does not survive a relaunch.** The
survey filed this as an INFERENCE (§9.8) from three separately-measured facts
that have never been observed together, and asked for a tape. **It is
OPEN-UNKNOWN until measured, and measuring it is the first act of item 2** —
with a probe hard enough to distinguish "restored" from "there was nothing to
restore", which is the day LR-29 item 1 lost.

---

## §5 QUESTION 5 — WHAT SIMPLER ARCHITECTURE REMOVES REPRESENTATIONS INSTEAD OF ADDING GUARDS?

**The coach's output IS a `ProgramControlAction`. There is no coach write layer
at all.**

```
athlete sentence
  -> [1] LLM proposes a typed action           (wire shape; crosses a network)
  -> [2] ProgramControlAction                  (the door's own vocabulary)
  -> executeProgramControlAction               (the SAME call the tap makes)
       -> appends ONE AthleteDecision, verbatim
       -> derives the visible week from the ledger
  -> visible verification reads the derived week
```

**Ten representations become two, and the floor is two rather than one for a
stated reason:** the wire shape crosses a process boundary and cannot be the
in-app type. Everything between rows 2 and 9 of §2's table is a translation
between two in-process types, and every one of them is deletable.

**This is CLAUDE.md's own preferred shape, and it now has a receipt rather than
a preference.** CLAUDE.md asks for `visible program snapshot → user message →
proposed revised visible plan → diff → validation → override → visible
verification` over command/resolver/event chains. The measured argument for it
is §1: **the command/resolver/event chain's output is erased by the next boot.**
It is not merely less elegant — it does not survive.

**How the ledger records it, and why this is a deletion and not an eleventh
representation.** One kind, carrying the door's own action:

```ts
| { kind: 'program_control'; action: ProgramControlAction }
```

- It **paraphrases nothing**, which is the ledger's own stated law.
- It **does not grow per capability**: 26 action kinds, one ledger kind. A
  ledger kind per fact type would be the ninth representation wearing a hat.
- Replay is **the door's own interpreter under the existing replay latch** —
  the mechanism `plan_change` and the three `fixture_*` kinds already use
  (`quiescentBoot.ts:119-200`).
- `PlanChange` stays exactly as it is. It is the payload of destination 1 and
  it already travels verbatim; nothing about it changes.

**AND THE FACT SLICES BECOME DERIVED, IN THE SAME MOVE.** This is the half that
makes it a collapse rather than an addition: once a fact declaration is a
decision, `temporarySourceFacts` and `injuryEpisodes` leave `partialize`, are
wiped by `rebuildDerivedWorld` like every other derived surface, and are
reconstructed by replay. **Net stored state goes DOWN** — two persisted slices
become zero, one ledger gains entries it can already store. The one-time
migration of existing installs has an exact precedent in
`preRebuildEnvelopeMigration` (read the result the old world stored rather than
invent the intent it never recorded).

**Compared against the incremental option, per CLAUDE.md's Elegant Solution
Requirement:**

| | incremental | redesign |
|---|---|---|
| shape | teach each of the seven coach writer ids to also append | coach emits a `ProgramControlAction`; door owns the write |
| representations | **11** (adds a ledger adapter, keeps ten) | **2** |
| the §3 `scope` class | survives — every boundary is still there | **removed with the boundaries** |
| the 7 red suites | red until each writer is ported | red until the door is reached, then all at once |
| `coachCommandExecutor` (4,781), `coachRevisionOverrideWriter` (788), `coachUndoEngine` (475) | kept, and now also append | **retired** |
| undo of a coach edit | per-writer work, per kind | free, by being on the ledger |
| durability | per-writer | free |

**The redesign removes whole classes of bug and is recommended, per the
requirement's own instruction to recommend it even when it is the bigger
pivot.**

---

## §6 QUESTION 6 — WHICH LEGACY PATHS SHOULD BE BYPASSED OR RETIRED RATHER THAN PATCHED?

**MEASURED WITH A REAL IMPORT GRAPH, AND IT REFUTES THE SURVEY'S §1.2.**

Instrument: a walk of every `import` / `export … from` / `require()` /
`import()` edge in `src` plus `App.tsx` (the entry `expo/AppEntry.js`
registers), rooted at `App.tsx`. **Value edges only: `import type` is erased by
the compiler and is not a runtime dependency.** Unit: **MODULES with no
surviving import edge.** That is not the same as "code an athlete can run" —
an imported-but-never-called symbol counts as reachable here — and the two are
never conflated below.

**The survey said 31 modules / 28,160 lines are "frozen-only", a lower bound it
guessed was really ~37k. Both numbers were produced by a name scan, and its own
§9.1 flagged them. Measured properly:**

- **57 of 60 `*coach*`-named modules are REACHABLE from `App.tsx`.** The R5.7
  cut removed the `Tab.Screen` and left the `import`
  (`AppNavigator.tsx:10` → `CoachScreen.tsx`), so **one surviving edge holds the
  entire frozen pipeline in the reachable set.** "Frozen" was never a property
  of the modules; it is a property of that one edge.
- **Cutting `CoachScreen.tsx` makes 39 further modules unreachable: 40 modules,
  41,220 lines in total.** That is the frozen tree's real size — **larger than
  the survey's lower bound and above its ~37k estimate.**
- **Eight of the 39 are NOT named `*coach*`** and were invisible to the name
  scan exactly as §9.1 predicted: `semanticProgramEditDraft` (829),
  `sessionExplanation` (688), `programAdjustmentRequests` (583),
  `constraintResolutionDetector` (465), `llmSemanticProgramEditDraftAdapter`
  (423), `smokeVisibleWeekHarnessState` (382), `pendingInjuryResolver` (268),
  `constraintSummary` (241), `visibleWorkoutDiff` (214), `smokeNavState` (170).
- **26 `*coach*`-named modules SURVIVE the cut and must be kept whatever their
  name says**, each with a measured holder outside the coach tree — including
  `coachingEngine` (8,824, the GENERATION engine, held by
  `generateProgram`/`defaultProgram`/`scheduleDebug`), `coachUpdatesStore`
  (1,345, 27 holders), `coachWeekDiff` (347, the boot's own state assembler),
  `deterministicCoachNoteFactory` (382, the live athlete-visible notes) and
  `coachActions` (1,053, held by `programControlActions` itself).

**A SECOND INSTRUMENT DEFECT, CAUGHT MID-RUN AND WORTH THE SAME LAW.** The first
version of this graph counted `import type` as an edge, which alone made
`coachTurnController` (6,296) and most of the pipeline behind it look
load-bearing — held by a single `import type { SemanticProgramEditDraftMode }`
at `config/env.ts:2`. The instrument counted IMPORT STATEMENTS; the domain noun
is CODE THAT SHIPS. **`a count taken for a record`, eleventh sighting, in a
brand-new instrument on its first run.** (An earlier run of the same instrument
reported a reachable set of ONE module, because the root was a relative path
and every edge resolved absolute — that one was obviously false and cost
nothing, which is the argument for anchor proofs printing loudly.)

**WHAT THIS AUTHORISES, AND ITS LIMIT.** 41,220 lines are removable **by
reachability**. They are **not** all deletable, because the order's own rule
reserves SALVAGE, and the salvage is inside the unreachable set: the
understanding layer measured green in survey §3.3 — intent, target resolution,
clarifiers, the truth gate, the 347-cell `coach-program-edit` contract. **Those
layers are what the redesign KEEPS.** The deletion set is therefore the
unreachable set MINUS salvage, it is smaller than 41,220, and naming it
module-by-module with a receipt each is item 3's work, not this document's.
**When in doubt, keep and list.**

Named for retirement on the redesign's own logic, each already measured
unreachable-after-cut: `coachCommandExecutor` (4,781, the parallel write
layer), `coachRevisionOverrideWriter` (788), `coachUndoEngine` (475, retired by
Sam's one-step undo ruling rather than ported — ATTRIBUTED to
`docs/UNDO_SHAPE_RULING_2026-08-09.md`), `legacyCoachActionFilter` (156). Their
suites go with them.

---

## §7 QUESTION 7 — WHAT TESTS PROVE THE NEW OWNERSHIP BOUNDARY?

The boundary is one sentence — **every program mutation is one appended
decision, and the door is the only appender** — so the gates assert that
sentence from both sides. Named here; built with the code they gate.

1. **THE APPENDER IS UNIQUE (source gate, ratchet).** The set of product
   modules calling `appendDecisionEntry` is pinned as a SET, so a new appender
   reds rather than joins. Asserted with word boundaries, and the region is
   located before it is asserted on (AGENTS.md's anchoring law). Today's set:
   the store door, `planChangeProducer`, `fixtureMutationTransaction`,
   `undoLastDecision`, `preRebuildEnvelopeMigration`.
2. **EVERY DESTINATION LANDS A DECISION (behavioural, per destination).** Drive
   each of the five destinations through `executeProgramControlAction` and
   assert the ledger grew by exactly one entry whose payload is the action
   **verbatim** — not merely that it grew. A count-only cell is satisfied by a
   paraphrase, which is the failure this whole document is about.
3. **UNDO IS A PROPERTY, NOT A FEATURE (per kind, in `test:undo-reversal`).**
   For each destination: act, photograph the world, undo, assert the world is
   **byte-identical to before**, then relaunch and assert it is still
   identical. The relaunch half is what the fifty-third pass proved for
   `move_session` and is the only half that catches a non-ledger side-writer.
4. **THE SIDE-WRITER CENSUS (the open class, and this is the cell that closes
   it).** `side-writer-outside-the-ledger` is at sighting 1 and the compression
   rule is a census, not another per-kind fix. The cell: for every destination,
   assert that acting writes **nothing persisted except the ledger entry** —
   diff the whole persisted envelope before and after. **A move writing a
   calendar `rest` mark would have been caught by this cell on the day it was
   written**, four passes before an athlete could have seen it.
5. **NO STORED DERIVED OUTPUT (north-star ratchet).** `partialize` is pinned as
   a SET. A slice entering it reds; a slice LEAVING it (as `temporarySourceFacts`
   and `injuryEpisodes` must) reds too, so the ratchet has to be moved
   deliberately in the commit that earns it.
6. **REPLAY IS TOTAL AND IDEMPOTENT FOR EVERY KIND.** Extends the fifty-fifth
   pass's armour: an unreadable row of any new kind is dropped and counted, not
   thrown; replaying twice yields one world.
7. **THE MIGRATION PRESERVES, NEVER INVENTS.** Facts persisted under the old
   shape must reproduce the athlete's world exactly after migration — asserted
   byte-for-byte against the pre-migration projection, the shape
   `wornWorldBootTests` cell 4 now uses.
8. **THE FROZEN ENTRY STAYS CUT (existing, unchanged).**
   `coachEntrySurfaceContractTests` [4] already sweeps for
   `navigate('CoachTab')`; the import-graph census above is the cell that would
   have noticed the surviving `import`, and belongs in the chain as a gate on
   the reachable set rather than as a one-off script.

**Cells 2, 4 and 5 are the three that would have caught the defects this
document is built on.** Cells 1, 3, 6, 7 protect what is already proven.

---

## §8 WHAT THIS AUTHORISES TONIGHT, IN ORDER

Doors and engine only. **No coach module is rewritten under this document** —
that build needs Sam's kickoff sign-off, and routing an owned door through the
ledger changes no coach decision (LR-6's ratified boundary).

1. **MEASURE §4's OPEN-UNKNOWN FIRST.** A tape in the shape of
   `tape:lr29-boot-replay`: does a today-only exercise swap survive a relaunch?
   The probe must be able to fail — distinguish "restored" from "there was
   nothing to restore". **Build nothing for destination 2 until this reads.**
2. **DESTINATION 2 (exercise-level) — the data-loss fix, and the pattern's
   first proof.** One new ledger kind carrying the action verbatim; replay
   through the door's own interpreter; gates 1-6.
3. **DESTINATIONS 3 AND 4 (injury, illness/readiness) — the collapse.** Ledger
   kind, fact slices out of `partialize`, migration with gate 7. Higher risk
   than 2 and staged behind it deliberately: these persist today, so a mistake
   here **loses athlete facts that currently survive**, where a mistake in 2
   can only fail to fix a loss that is already happening.
4. **DESTINATION 5 (setup answers) is NOT in scope tonight.** Profile answers
   are the generation input the anchor recovery just finished defending; making
   them replayable is a larger question than the others and nothing tonight
   depends on it. **Named, not started.**

**Each step: full unpiped chain, `test:compile`, sweep, and a boundary note.
Any step that cannot land green is reported as not landed rather than
loosened.**

---

## §9 THE OWNERSHIP BOUNDARY, STATED ONCE

> **A program mutation is one appended decision. The door appends it. Nothing
> else appends, and nothing else persists a mutation's effect.**
>
> The coach's job ends at producing the action. Undo, replay, durability and
> visible verification are properties of the ledger, not features of the
> writer — so the coach gets them by not having a writer.

---

## §10 NORTH STAR VERDICT

**TOWARD, and it is the strongest TOWARD any unit in this era can claim,
because it is measured as a REMOVAL rather than argued as a principle.**

- Stored state goes **DOWN**: `temporarySourceFacts` and `injuryEpisodes` leave
  `partialize`; nothing new is persisted; the ledger already exists and already
  stores decisions.
- Representations go **10 → 2**.
- The largest surviving population of stored derived output in the app is the
  coach's override layer, and **the boot already deletes it** — the redesign
  deletes the writer that produces it.

The one honest caveat: **between the ledger kind landing and the fact slices
leaving `partialize`, there is a window in which both exist.** That window is a
migration, not a design, and §7's cell 5 is written so the window cannot be
left open silently.

---

## §11 L12 — WHAT CATCHES THE NEXT DEFECT OF THIS CLASS

The class is **a representation boundary that loses a field by omission**. It
does not throw and no guard fires, so no assertion phrased as "the conversion is
correct" can catch it.

- **What catches it: §7's cell 2, asserting the payload VERBATIM.** A boundary
  that drops a field cannot round-trip. This is the only cell in the set that
  fails on omission rather than on error.
- **What would NOT have caught it, and did not:** every existing coach suite.
  347 cells of `coach-program-edit` are green while the write layer evaporates,
  because they assert the understanding, which is correct.
- **The structural fix is the count, not a cell.** With two representations
  there are one and a half boundaries left to lose a field at. **The gate that
  protects that is §7's cell 1 — the appender set — because a new
  representation always arrives as a new writer first.**

---

## §12 NOT COVERED — read this before treating anything above as settled

**No completeness claim is made.** Worst first:

1. **§4's DURABILITY CLAIM FOR DESTINATION 2 IS UNMEASURED.** It follows from
   `partialize` + `rebuildDerivedWorld` + zero appends, each measured
   separately; **the three have not been observed together**, and §8 makes
   measuring it the first act rather than assuming it.
2. **NO COACH TURN WAS EXECUTED, here or in the survey.** Every statement about
   the coach's behaviour is from source and from suite output. **The claim that
   the coach can express its whole vocabulary as `ProgramControlAction` is a
   TYPE-LEVEL reading of two unions, not a port** — 26 action kinds against a
   pipeline whose own vocabulary is larger. Where they do not line up is
   **unknown, and it is the single most likely place this design is wrong.**
3. **THE IMPORT GRAPH COUNTS EDGES, NOT CALLS.** A module imported and never
   called reads as reachable. The 41,220-line figure is an upper bound on
   removal-by-reachability and says nothing about salvage; **no module is
   proposed for deletion in this document.**
4. **`import type` DETECTION IS HEURISTIC.** It recognises the statement form
   and the all-inline-`type` form. A mixed import (`import { type A, B }`) is
   correctly a value edge; an unusual formatting could be misread. **Not
   mutation-tested.**
5. **THE EDGE FUNCTIONS WERE NOT READ.** 2,605 lines of `coach-chat`; what is
   deployed is unknowable from this repo. Row 1 of §2's table is the only
   representation this document cannot inspect.
6. **THE 7 RED SUITES WERE NOT ROOT-CAUSED** (survey §9.3, unchanged). All seven
   are attributed to one class from failure text plus mechanism. That is a
   reading, not a bisect.
7. **NO RULING IS MADE ON ANY ATHLETE-VISIBLE COACH SURFACE**, by mandate.
8. **DEPTH 0. NO DEVICE EVIDENCE.** Nothing here has been seen on a phone.

---

## §13 PARKED FOR SAM — none of these blocks tonight

1. **The kickoff sign-off itself** — this document is the reassessment
   AGENTS.md requires, and that rule says it must be **approved** before further
   pipeline code. Tonight's item 2 is door/engine work under LR-6's ratified
   boundary and does not need it; **rewriting a coach module does.**
2. **Destination 5 (setup answers) as a decision** — named, not started (§8.4).
3. **Journal notes have zero reachable writer** since the hide (survey §6.4), and
   notes are the entire input of `resurfaced`. Either notes come back on a
   reachable surface or the coach plans for a note store frozen at 2026-08-09.
4. **Coach reading athlete notes = opt-in + App Store label change**, Sam's own
   earlier ruling (ATTRIBUTED, seat handoff §1). §6.5 of the survey names the
   privacy-clean first cut that needs no opt-in.
5. **Two of the acceptance contract's verbatim copy strings do not exist in
   source** (survey §4.3) — owed by this unit whatever else it does, along with
   R5.7's three unsigned fallback sheets and the MetCon rename.
