# COACH REBUILD SURVEY — 2026-08-09

**LOOP CHECK: survey-before-build (a measured dependency map delivered before
the unit opens) — sighting 3 — ITERATE.** R5.3 priced every leg on scaffolds
before building; the LR-29 replay unit opened from a measured dependency list
and its opening law held. This is the same shape a third time and it is paying,
so it iterates rather than compresses. What DOES compress is named in §8.

**MANDATE.** Survey only. No src file changed, nothing built, no ruling made.
Written on `main` at `cdea5c6c`. `docs/SEAT_INBOX.md` and `docs/NOW.md`
untouched by this pass. This is the measured map the coach rebuild kickoff is
built from — not the kickoff.

**STATUS DISCIPLINE (§7 of the seat handoff).** Every claim below is filed as
**MEASURED** (with the command or file:line that produced it),
**ATTRIBUTED** (cited to a ruling or doc, not re-measured here), or
**OPEN-UNKNOWN** (stated as unknown, with what bounds it). No completeness
claim is made about any of it. §9 is the not-covered list, and it is not short.

**COUNT DISCIPLINE.** Every number below names its instrument's unit. Where a
source scan counts call sites and the domain noun is something else, both are
given.

---

## §0 THE FIVE QUESTIONS, ANSWERED IN ONE PARAGRAPH EACH

1. **What the frozen pipeline contains** — 60 product modules / 61,202 lines
   with `coach` in the filename, of which **31 modules / 28,160 lines have no
   importer outside the coach tree** (a lower bound — §1). 67 test files /
   42,789 lines. 5 edge functions / 4,523 lines. **12 of the 67 coach test
   files run in `test:bible`; 55 do not.**
2. **What the rebuild made stale** — **the coach never appends a decision, and
   the world is now rebuilt from decisions.** One mutation path out of its whole
   vocabulary reaches the ledger (fixtures). Every other coach write lands in
   surfaces `rebuildDerivedWorld` sets to `{}` and are not persisted at all
   (§3). Measured consequence in the orphaned suites: 7 of 18 red, and the red
   text is `overrides=[]` / "at least one override write".
3. **What the acceptance contract still rules** — all of it, on its own terms;
   its **founding principle is now literally true of the architecture** in a way
   it wasn't in July. Two of Sam's verbatim copy strings do not exist in source
   (§4).
4. **What the coach needs to act like an athlete** — one door,
   `executeProgramControlAction`, already fans out to plan changes, exercise
   edits, injury, illness and readiness. Three of its five destinations are
   **not on the ledger**, so "coach acts through the athlete's doors" does NOT
   by itself give undo coverage of coach edits (§5). That is a fork, not a gap.
5. **What journal context exists to feed it** — seven derivations, richly
   shaped, **with exactly one product caller each: the hidden screen.** Their
   raw inputs are still written except one: **journal notes have zero reachable
   writer** since the hide (§6).

---

## §1 WHAT THE FROZEN COACH PIPELINE CONTAINS — MEASURED

### 1.1 The census

Instrument: `find src -iname "*coach*" -type f ! -path "*__tests__*" ! -path
"*/dev/*"` for the product count; a node walk of `src/**/*.{ts,tsx}` excluding
`__tests__` for the reachability table (which therefore also counts
`src/dev/e2e/coachInterpretationReceipt.ts`, hence 60 vs 59).

| population | files | lines |
|---|---|---|
| product modules named `*coach*` | 59 | 61,202 |
| test files named `*coach*` | 67 | 42,789 |
| edge functions (`supabase/functions/**/*.ts`, all of them) | 9 | 4,523 |

The five largest product modules are `coachingEngine.ts` (8,823),
`coachTurnController.ts` (6,295), `coachProgramEdit.ts` (5,800),
`coachCommandExecutor.ts` (4,780), `coachCommandRouter.ts` (3,408).

**`coachingEngine.ts` IS NOT PART OF THE FROZEN CHAT PIPELINE** and the biggest
number in that list is therefore misleading if read as "the coach chat is 8.8k
lines of engine". It is the GENERATION engine: `services/api/generateProgram.ts`,
`data/defaultProgram.ts`, `rules/conditioningFeasibility.ts` and
`utils/scheduleDebug.ts` all import it, and `rebuildDerivedWorld` runs it on
every boot (`quiescentBoot.ts:309`). It is live, load-bearing, and out of scope
for a chat rebuild. It carries the word "coach" and nothing else.

### 1.2 Frozen vs live — the reachability table

Instrument: for each `*coach*` module, count product files (excluding tests,
`src/dev/`, and other `*coach*` modules) whose source contains the import-path
literal for that module. **The unit is IMPORTING FILES, not call sites**; a file
that imports a symbol and never calls it counts.

| | modules | lines |
|---|---|---|
| **frozen-only** (0 non-coach product importers) | **31** | **28,160** |
| live (≥1 non-coach product importer) | 29 | 34,132 |

The 31 frozen-only modules, largest first:

`coachProgramEdit` (5,801) · `coachCommandExecutor` (4,781) ·
`coachCommandRouter` (3,409) · `coachClarifierResume` (2,295) ·
`coachIntentDispatcher` (1,511) · `coachInterpretationReceipt` (1,031, dev) ·
`coachPlan` (904) · `coachModalitySwapOrchestrator` (821) ·
`coachRevisionOverrideWriter` (788) · `coachLLMCommandAdapter` (701) ·
`llmSemanticCoachRevisionProposalAdapter` (631) · `coachFixtureChange` (604) ·
`coachInjuryTargetResolver` (539) · `verifiedCoachCommunication` (512) ·
`coachUndoEngine` (475) · `coachReplyComposer` (399) ·
`coachContextPacket` (387) · `coachDispatchDeps` (348) ·
`weeklyCoachUpdate` (327) · `coachSessionOutcome` (319) ·
`coachVisibleWeekAutoBind` (252) · `coachStateInspector` (245) ·
`coachReadinessAdapter` (220) · `smokeCoachBikeFlowProgram` (203) ·
`llmCoachIntentClassifier` (187) · `legacyCoachActionFilter` (156) ·
`coachRevisionTemplateContext` (106) · `coachBuildInfo` (80) ·
`coachFixtureReplyObservation` (61) · `coachValueNormalizers` (45) ·
`coachLongRunningProgress` (22).

**28,160 IS A LOWER BOUND, and the instrument's unit is why.** Two frozen-tree
ROOTS score as "live" because something outside still names them:
`CoachScreen.tsx` (2,498) is imported by `AppNavigator.tsx:10` — the R5.7 cut
removed the `Tab.Screen`, not the import — and `coachTurnController.ts` (6,295)
is named in `config/env.ts`. Neither is reachable by an athlete. Counting them
in puts the frozen tree at roughly **37k lines**; the honest statement is that
the frozen population is **at least 28,160 lines and probably ~37k**, and the
exact figure needs an import-graph walk from `App.tsx`, not a name scan. (Repo
law: a source scan counts its own unit — `a-count-taken-for-a-record`.)

### 1.3 The 29 "live" modules are the reason a coach rebuild is not a delete

These are load-bearing OUTSIDE the coach tree, most-depended first (unit:
non-coach product importers):

| module | non-coach importers | notable importers |
|---|---|---|
| `coachUpdatesStore` | 33 | `hooks/useSchedule`, `rules/injuryEpisode`, `rules/acceptedProfileProjection` |
| `coachWeekDiff` | 8 | `store/quiescentBoot`, `store/sessionOutcomeTransaction` |
| `coachPreferencesStore` | 7 | `screens/profile/ProfileScreen`, `store/appHydrationGate` |
| `coachMutationTransaction` | 6 | `store/fixtureMutationTransaction`, `store/profileProgramTransaction` |
| `activeCoachNotes` | 5 | `screens/home/HomeScreenV2`, `store/acceptedStateTransaction` |
| `coachingEngine` | 4 | `services/api/generateProgram` (generation, see 1.1) |
| `deterministicCoachNoteFactory` | 4 | `utils/sessionResolver`, `data/defaultProgram` |

**`coachWeekDiff.buildScheduleStateImperative` is the boot's own state
assembler** (`quiescentBoot.ts:151`). **`coachUpdatesStore.activeConstraints` is
a derive input** (`deriveVisibleWeek.ts:99-100`). **Coach NOTES are a live
athlete-visible surface** rendered on `HomeScreenV2` from
`deterministicCoachNoteFactory` — which is why Sam's undo ruling grounds itself
on them ("you can already undo changes using coaches notes for older things",
`cdea5c6c`). None of this is chat. All of it says "coach" on the tin.

### 1.4 The entry surface — measured, and it is genuinely gone

`grep -rn "CoachTab\|CoachScreen\|CoachStack" src --include='*.ts*' | grep -v
__tests__` returns navigation TYPES, the `CoachStackNavigator` definition
(`AppNavigator.tsx:93-97`), one import, and comments. **No `Tab.Screen`
registers it and no product file navigates to it** — that is what
`coachEntrySurfaceContractTests` section [4] ratchets, and per
`r57-beta-coach-cut-built` it caught a real leftover on its first run.
`src/types/navigation.ts:160-172` still declares a `CoachStackParamList` with
seven routes (`CoachChat`, `CoachConversations`, `CoachTopics` …) that no
navigator registers — type-only debt of the same family as the purged
`JournalStack` entries NOW.md already names.

### 1.5 The LLM layer

Five edge functions exist: `coach-chat` (2,605 lines), `coach-intent` (507),
`coach-send-message` (389), `coach-revision-proposal` (232),
`coach-semantic-program-edit-draft` (173), plus `shared/` (617). They are
two-provider with env-selected models and are **stale on model ids**:
`coach-chat/index.ts:594` defaults `claude-opus-4-7`, `:592` `claude-sonnet-4-6`,
`:589` `claude-haiku-4-5-20251001`; the OpenAI arm defaults `gpt-5.5` / `gpt-5.4`
/ `gpt-5.4-mini`. **OPEN-UNKNOWN:** whether any of these are deployed, and what
the deployed versions contain. Nothing in this repo can answer that.

---

## §2 WHAT IS FROZEN, PRECISELY — THE R5.7 BOUNDARY AS IT STANDS

ATTRIBUTED to `r57-coach-cut-boundary-ruled` + `r57-beta-coach-cut-built` +
`AppNavigator.tsx:193-207`:

- The cut was **the FULL cut** — the tab and all three navigate doors — Sam's
  "MAKE THE CUT", §6 decision C(a), landed `1c41e6d2`, nine product files.
- **LR-6 HOLDS.** The stack, `CoachScreen` and the pipeline stay in the tree,
  frozen. §6's own words: a scope cut, not a retirement.
- **NO DEAD ENDS.** The frozen `coach_fallback` step still renders; it reports
  the refusal and closes. **Three sheets carry PROPOSED, UNSIGNED copy** and
  join Sam's next signing batch. That copy is owed by the coach rebuild whatever
  else it does.
- `StaleOverrideBanner`'s Review became UNCONDITIONAL rather than orphaned.

Two live guards the rebuild must not trip:
`exerciseEditEntrySurfaceContractTests` pins ten guided-flow owners on
`DayWorkoutScreenV2` (`prepareSwap`, `applySwapToday`, `suggestTapSwap`, …) and
nine surviving steps INCLUDING `'coach_fallback'`;
`coachEntrySurfaceContractTests` [4] sweeps every product source for the literal
`navigate('CoachTab')`. **A prose mention of that call in a comment reads to the
gate as a door** — the note yields, not the gate
(`AppNavigator.tsx:200-203`).

---

## §3 WHAT THE ENGINE REBUILD MADE STALE — THE HEADLINE FINDING

### 3.1 The coach appends one decision kind out of its whole vocabulary

**MEASURED.** `grep -rln "appendDecisionEntry" src` outside tests returns
exactly four files: `decisionLedgerStore.ts` (the door itself),
`planChangeProducer.ts:2396`, `fixtureMutationTransaction.ts:635`,
`preRebuildEnvelopeMigration.ts`. **No module named `*coach*` is among them.**

`grep` for `planChangeProducer|applyPlanChange` inside the coach tree returns
two hits, `coachCommandExecutor.ts:3641` and `coachRevisionPolicy.ts:6` — **both
are comments.** No coach module calls `applyPlanChange`. No coach module calls
`executeProgramControlAction`.

**The one exception, and it matters:** `coachFixtureChange.ts:114` calls
`executeFixtureMutationTransaction`, which appends `fixture_add` /
`fixture_remove` / `fixture_move` (`fixtureMutationTransaction.ts:622-637`, "one
site, both doors"). So the coach's **fixture** capability — acceptance contract
§6, "Game moved to Sunday" — is **already written in the ledger-native shape**.
It is not live: `coachFixtureChange` is frozen-only, reached solely through
`coachDispatchDeps` inside the frozen tree. What it proves is that this coach
path needs porting, not redesigning — one existence proof that the shape §5
recommends already fits a coach capability. Everything else does not.

### 3.2 What the coach writes instead, and what happens to it

The coach's mutation writes go to `applyProgramOverrideWrite`
(`programStore.ts:2643`) under seven of its own writer ids —
`coach_action`, `coach_executor`, `coach_program_edit`, `coach_turn_controller`,
`coach_undo`, `coach_modality_swap`, `coach_revision_writer`
(`programStore.ts:2447-2466`) — which lands material in `dateOverrides`,
`overrideContexts`, `weekScopedOverlays`, `userRemovalConstraints` and the
`coachUpdatesStore` mirrors.

**Two measured facts about those surfaces:**

**(a) They are not persisted.** `programStore`'s `partialize`
(`programStore.ts:2370-2379`) writes **inputs only** — `generationAnchorISO`,
`seasonPhaseClock`, `sessionFeedback`, `weightOverrides`, `temporarySourceFacts`,
`injuryEpisodes`. `dateOverrides`, `weekScopedOverlays` and
`userRemovalConstraints` appear in neither `partialize` nor `merge`.

**(b) They are emptied on every rebuild.** `rebuildDerivedWorld`
(`quiescentBoot.ts:339-363`) sets `dateOverrides: {}`, `overrideContexts: {}`,
`weekScopedOverlays: {}`, `userRemovalConstraints: []`,
`exposureContractsByWeek: {}`, `markedDays: {}`, `activeConstraints: []`,
`activeInjury: null`, `readinessSignalsByDate: {}` — then regenerates from
profile and **replays the ledger**.

Put together: **a coach edit made today does not survive a relaunch, because the
boot rebuilds the world from decisions and the coach records none.** It also
does not survive an in-session `settleDerivedWorldAfterDecision`, whose one
product caller is `injuryEpisodeTransaction.ts:622` — so declaring an injury
mid-session re-derives the world over any coach edit standing in it.

This is not a bug someone introduced. It is what R5.1 was FOR
(`quiescentBoot.ts:20-31`: "the doors published a materialised replan and boot
resolved instead … Settling by re-derivation makes the two engines one BY
CONSTRUCTION"). The coach was frozen before that switchover reached it. **Its
whole write model is the model R5.1 retired.**

### 3.3 The measurement in the suites

18 coach suites outside `test:bible` were run. **7 EXIT 1, 11 EXIT 0.**
Instrument: `npm run <suite>` with the exit code captured directly, not through
a pipe (`harness-lies-tail-not-exit-line` — `npm run x | tail` reported EXIT 0
for suites that exit 1).

| suite | exit | pass / fail |
|---|---|---|
| `test:uae-flow` | **1** | 51 / 10 |
| `test:coach-behaviour-scenarios` | **1** | 250 / 24 |
| `test:coach-live-wiring` | **1** | 23 / 5 |
| `test:coach-live-path-v2` | **1** | 79 / 2 |
| `test:coach-command-router` | **1** | 596 / 1 |
| `test:coach-orchestration` | **1** | 36 / 1 |
| `test:coach-mutation-truth` | **1** | 45 / 1 |
| `test:coach-program-edit` | 0 | 347 / 0 |
| `test:coach-live-readiness-priority` | 0 | 152 / 0 |
| `test:coach-pending-clarifier` | 0 | 153 / 0 |
| `test:coach-intent` | 0 | 76 / 0 |
| `test:coach-truth-gate` | 0 | 58 / 0 |
| `test:coach-injury-contracts` | 0 | 51 / 0 |
| `test:coach-reference-resolver` | 0 | 46 / 0 |
| `test:coach-live-send-context` | 0 | 40 / 0 |
| `test:coach-live-modality-path` | 0 | 38 / 0 |
| `test:coach-visible-domain-verifier` | 0 | 19 / 0 |
| `test:coach-fixture-change` | 0 | 10 / 0 |

**THE FAILURE TEXT IS ONE SENTENCE REPEATED.** Verbatim from the runs:
`at least one override write` (×2), `at least one override` (×6),
`override written for exact-trigger protection`,
`at least one protective change written`, `pre-resolve: override exists`,
`swap1 wrote exactly one override on the target date  overrides=[]`,
`fresh persisted state equals committed accepted state`.

**Every red is the same defect class and it is §3.2 exactly:** the suites assert
the coach wrote an override; the override surface no longer holds what the
coach put there. `coach-behaviour-scenarios`' 24 are the visible half of it —
`T3: FRI visible workout contains "Assault Bike Sprints"` against
`Visible name: "Upper Body Strength"`, and `T2: applied = true` against
`got applied=false kind=verified_no_op`.

**The 11 greens say what is NOT stale, and that is the more useful half.**
Intent classification, target resolution, the reference resolver, pending
clarifiers, the truth gate, the visible-domain verifier, readiness priority,
the send-context builder, the injury contracts, the fixture door and the whole
`coach-program-edit` contract (347 cells) all still hold. **The understanding
layers survived the rebuild; the writing layer did not.** That is the exact
shape AGENTS.md's escalation rule was written about — "the AI/semantic layer
understands the user correctly, but a later layer changes, blocks, downgrades,
or reinterprets that intent" — except here the later layer doesn't reinterpret
it, it evaporates it.

### 3.4 The gate coverage, measured

`test:bible` matches **170 `npm run` steps** (instrument: regex
`/npm run [a-z0-9:_-]+/g` over the script string; NOW.md's 171/170/169 triple
names the same chain under three different instruments).

Of the **67 coach test files**: 48 have an npm script, **12 run in
`test:bible`**, 55 do not, and **19 of those 55 have no npm script at all** —
they cannot be run except by invoking ts-node directly.

The 12 in-chain: `coach-add-session-ownership`, `coach-clarifier-advance`,
`coach-entry-surface`, `coach-failure-copy`, `coach-memory-ownership`,
`modality-swap`, `coach-mutation-history-ownership`, `coach-prefs-ownership`,
`coach-revision-proposal-behavior`, `coach-store-ownership`,
`coach-updates-ownership`, `coach-updates`.

**Read the list:** nine of the twelve are STORE-OWNERSHIP suites. The chain
protects the coach's stores from unattributed writes. It does not run one cell
of the coach's behaviour. That is a deliberate consequence of LR-6, not an
oversight — but it means **the 42,789 lines of coach tests are ~85% dark**, and
any rebuild that says "the tests pass" will be saying it about the 12.

### 3.5 LR-6's own census entry, ATTRIBUTED

`src/data/legacyReckoningCensus.ts:565-611`. Tier 2, blast radius
`visible_week`, size XL, status `stop`:

> "CoachIntentPayload -> CoachMutateOperation -> ProgramEditDraftAction ->
> CoachRevisionIntent -> CoachResolvedTarget -> CoachPlanChangeKind, plus the
> LLM tool-call JSON and the tap door's PlanChange, across 49 modules."

Measured today (unit: product modules whose source contains the type name):
`CoachIntentPayload` 2, `CoachMutateOperation` 6, `ProgramEditDraftAction` 4,
`CoachRevisionIntent` 4, `CoachResolvedTarget` 4, `CoachPlanChangeKind` 5. The
census's own `whyNotDetectable` says this correctly: counting type names counts
vocabulary, not representations. The eight-representation finding is an
architectural reading and stands as ATTRIBUTED.

**D-2 IS INHERITED SCOPE AND IT IS NOW LOAD-BEARING.** The census entry
(Sam, 2026-08-05) puts the hydration-repair in-place branch
(`programStore.ts:1216-1219`) inside LR-6, with this reason: *"Its entire
surviving population is COACH writes and restores, which is why it is filed HERE
… the rebuild that reaches those writers is the rebuild that owns this branch."*
Nothing is to be done to it — no redirect, no reorder — until this unit. It also
warns the "just move it" option is secretly a precedence-reordering decision
(`dayPrecedence.ts:151-160`).

---

## §4 WHAT THE ACCEPTANCE CONTRACT STILL RULES

`docs/COACH_ACCEPTANCE_CONTRACT_2026-07-24.md`, v1 COMPLETE, Sam's read-through
done. **All of it still rules.** Nothing in the rebuild refutes a row. Three
observations about how it lands on today's tree:

### 4.1 Its founding principle became architecturally true

> "The coach can do everything the tap buttons can do — nothing more, nothing
> less — in plain text … every program mutation routes through the same
> transaction owners the buttons use."

In July that was a discipline the coach could violate silently. Today, with
`rebuildDerivedWorld` wiping every non-input surface, **a coach mutation that
does not route through the athlete's doors is not merely irregular — it does not
survive.** The contract's principle and the north star have converged on the
same sentence. The rebuild does not have to argue for it; it has to implement it
or the edits vanish.

### 4.2 Row-by-row, against measured doors

| contract capability | door today | ledger? | notes |
|---|---|---|---|
| swap / move / bin / add a session; swap-to-Rest | `applyPlanChange` (9 `PlanChange` kinds) | **YES** | `planChangeTypes.ts:109-140` |
| fixture / game-day change | `executeFixtureMutationTransaction` | **YES** | frozen coach path already calls it (§3.1) |
| swap an EXERCISE (D3 same-job pools) | `executeProgramControlAction` `swap_exercise` | **NO** | §5.2 — the contract's row 1 |
| readiness: cooked / sniffle / sick | `set_fatigue_status` / `set_illness_status` / `set_recovery_mode` → `transactTemporarySourceFact` | **NO** | fact store, persisted |
| injury: region + severity | `set_injury_modifier` → `createOrUpdateInjuryEpisode` | **NO** | fact store, persisted |
| clear any active adjustment ("I'm good now") | `clear_active_modifier` / `clear_fatigue_status` (`useHomeScreen.ts:1296,1528`) | **NO** | |
| mark done / skip / catch-up | `sessionOutcomeTransaction` | **NO** | `sessionFeedback`, persisted |
| conditioning swap with ask-why (D4) | `coachModalitySwap` + `coachPreferencesStore` | **NO** | prefs persisted |
| undo / "put it back" | **none** | — | §5.3 |
| busy week / away days / repeat week | **none, by design** | — | honest refusal required |

**The 2-RUN WEEKLY FLOOR IS BUILT.** The contract's cross-cutting rule
discovered in review — "preference swaps never drop the week below 2 running
sessions" — exists as a kernel invariant, not just coach copy:
`rules/weeklyExposureCounts.ts:72` `minRunningExposures: 2`, enforced at `:323`
with two authored exemptions (early off-season weeks 1-2, bye recovery) and the
message *"needs an authorised typed reduction reason"*. **MEASURED-DONE.** The
contract's own note ("needs a Bible/kernel invariant at build time") is
discharged.

### 4.3 Two of Sam's verbatim copy strings are NOT in the source

**MEASURED** by grep across `src` and `supabase`:

- The unbuilt-feature refusal — *"Sorry, I can't help you with that yet. If
  you'd like to leave me some ideas for future updates, use the feedback form on
  the profile page."* — **zero hits.**
- The 30-minutes answer — *"The session's already in priority order. Start at the
  top, work down, stop when time's up…"* — **zero hits** (`priority order`
  matches only unrelated comments).

`coachFailureCopyContractTests` (in the chain) pins something different and
narrower: that **no raw developer diagnostics reach the athlete**, routing
through `planChangeRefusalCopy`. So the contract's signed copy is authored in
the doc and unbuilt in the app. Whether it was ever built and later cut, or
never built, is **OPEN-UNKNOWN** — the git archaeology was not run.

---

## §5 WHAT THE COACH NEEDS TO ACT THROUGH THE LEDGER DOORS LIKE AN ATHLETE

### 5.1 There is already one door, and it is not the ledger

`utils/programControlActions.ts` — `executeProgramControlAction` — is the single
athlete tap door. Its `ProgramControlActionType` union is 26 kinds
(`:94-120`), and it fans out to five different destinations:

1. session-level plan changes → `applyPlanChange` (`:575`, `:760`) → **ledger**
2. exercise-level edits → `applyProgramOverrideWrite(writer:'program_control')`
   (`:423`) → **no ledger**
3. injury → `createOrUpdateInjuryEpisode` / `resolveInjuryEpisode`
   (`:1187`, `:1223`) → **injuryEpisodes input slice**
4. illness / busy / schedule facts → `transactTemporarySourceFact`
   (six call sites, `:1316`–`:1601`) → **temporarySourceFacts input slice**
5. setup answers → `commitProfileProgramTransaction` → **profile input**

**`grep appendDecisionEntry src/utils/programControlActions.ts` returns
nothing.** Only path (1) reaches the ledger, and it does so inside
`applyPlanChange`, not in this file.

**So "route the coach through the athlete's doors" is a smaller change than it
sounds and a bigger one than it sounds.** Smaller: the door exists, it is typed,
it is already the tap surface's owner, and pointing the coach's executor at it
retires `coachCommandExecutor`'s parallel write layer wholesale. Bigger: **three
of its five destinations are not on the ledger**, so routing through it does NOT
automatically give undo coverage of coach edits. That was the plan Sam liked
("coach acts through the SAME ledger doors as the athlete, so undo covers coach
changes free") and it is **half free, measured**.

### 5.2 The exercise-level gap — the contract's row 1

`PlanChange` has nine kinds and **not one of them is exercise-scoped**
(`planChangeTypes.ts:109-140`: `remove_session`, `swap_template`,
`add_template`, `swap_category`, `add_category`, `move_session`,
`shutdown_week`, `clear_days`, `move_team_night`). Exercise edits go
`DayWorkoutScreenV2.applySwapToday` → `executeProgramControlAction
{type:'swap_exercise', scope:'today_only'}` → override write (`:718-747`).

Consequence, following §3.2 with no extra assumption: **an athlete's own
today-only exercise swap does not survive a relaunch either.** This is not a
coach defect — it is a shared gap, and it belongs to LR-29's vocabulary
question, not to this unit. It is flagged here because the acceptance
contract's very first row is *"Swap the bench press for something else"*, and a
coach rebuild that routes that row through the athlete's door inherits the door's
durability, whatever that turns out to be.

The FUTURE-scope half is different and does persist: `saveFutureExerciseAdjustment`
→ `add_exercise_preference` → `athletePreferencesStore` (`athlete-preferences-store`,
persisted). So "swap it today" is ephemeral and "swap it from now on" is durable,
through two different mechanisms, from one sheet.

### 5.3 Undo — the reversal kind is declared and inert

`AthleteDecision` includes `{ kind: 'reversal'; reversedEntryId }`
(`types/decisionLedger.ts:38`) and `quiescentBoot.ts:120-125` returns early on
it with the comment *"No reversal producer exists yet (undo door lands with
LR-29's heir); a reversal entry is declared, typed, and inert until then."*

`coachUndoEngine.ts` (475 lines, frozen-only, writer id `coach_undo`) is the
old shape: it re-writes an override to restore a prior workout. Sam's ruling
`cdea5c6c` is **one-step "undo last change"**, and the handoff records the
boundary as *"ledger decisions undo via annul+re-derive; recorded facts undo
separately at their own doors."* **`coachUndoEngine` is retired by that ruling,
not ported.** The contract's row *"Undo that / put it back"* is then a phrasing
of the same one-step undo, not a second mechanism.

### 5.4 The fork the kickoff has to open with

This is the same fork LR-29 already measured and named
(`docs/REPLAY_UNIT_DEPENDENCY_LIST_2026-08-07.md` §3: *"Illness authoring has no
kind. Injury, readiness and phase shift have no kind. … That is a design fork,
and it is the largest open decision in this list."*). **The coach rebuild does
not get to re-open it — it INHERITS whichever way the replay unit settles it**,
because "the coach records a decision" and "what a decision is" are the same
question. Stated for the kickoff so nobody prices coach work against an
unsettled vocabulary:

- **(i) Coach consumes ledger + fact stores** (what `gatherDeriveInputs`
  already does, `deriveVisibleWeek.ts:85-112`): coach writes fan out to five
  destinations exactly as taps do; undo covers plan changes and fixtures only;
  facts undo at their own doors.
- **(ii) Ledger vocabulary first gains R3's fact decisions** — the type file
  itself says this was the plan (`decisionLedger.ts:14-15`, *"R3 adds fact
  decisions (phase shift, injury, illness, readiness) as new union members"*) —
  then coach and tap both write one kind of thing and undo is uniform.

**Recommendation, per Sam's RULE-DON'T-ASK: neither is the coach unit's call.**
The coach kickoff should be written to depend on the replay unit's answer and to
state which of its pieces are invariant to it — and most are: intent, target
resolution, context, verification and copy are all unaffected by which way the
fork goes.

### 5.5 What the coach can currently SEE, and it is not the ledger

`CoachContextPacket` (`utils/coachIntent.ts:320-406`) carries: the message,
recent messages, `activeInjury` (declared "compatibility-only … never
authoritative"), `acceptedInjuryContext`, `activeConstraints`, pending
injury/proposal, `coachUpdate`, `currentWeek` + `nextWeek` as `ResolvedDay[]`,
`sessionFeedback` **typed as `Record<string, {completion?: string}>`**, plus six
durable-target fields and the resolved `targetFrame` / `programEditDraft`.

**There is no `decisions` field.** The coach sees the DERIVED week and none of
the decisions that produced it — which is why every one of its edit paths had to
be a re-materialiser. A coach that acts through the ledger doors needs the
ledger in its packet, and `gatherDeriveInputs()` already returns exactly that
bundle in one call.

---

## §6 JOURNAL-RECORD CONTEXT AVAILABLE TO FEED THE COACH

Sam's ruling (`docs/JOURNAL_HIDDEN_RULING_2026-08-09.md` item 2): the data layer
stays live and gated because *"this record is fuel for the COACH REBUILD."*
Measured, here is exactly what that fuel is.

### 6.1 The seven derivations and what each yields

All in `src/rules/`, all pure, all with suites pinned in `test:bible`
(12 journal steps, ratcheted by `journalHiddenContractTests` [5]).

| module | lines | what it yields |
|---|---|---|
| `journalWeek` | 404 | `JournalWeek`: per-day shape (`hard`/`moderate`/`easy`/`rest`/`game`) + load weight; `work` (planned / full / partial / skipped / **notAnswered** / **missingReasons**); `felt`; `kinds` (strength / conditioning / sprint / teamTraining / games / recovery); `dataState` |
| `journalLoad` | 982 | `JournalLoadModel`: main-lift tonnage + conditioning sRPE per session and per week, **`regions` per `MuscleGroup`**, `patternTonnageKg`, `upperLowerTonnageKg`, rolling `StreamComparison`, `headline` ratio + band, `regionObservations`, `patternBalance.drifts`, `coverage` |
| `journalStrengthTrend` | 211 | per-lift top sets, `StrengthLiftTrend` direction `up`/`flat`/`down`/`new` |
| `journalNiggleHistory` | 254 | `NiggleRegion[]` from injury episodes, plus **`resurfaced`** — notes written during a PAST episode in a region flaring again |
| `journalMonth` | 280 | `MonthPoint[]`, `StrengthGain[]`, `MonthConsistency`, `MonthFlags` |
| `journalChanges` | 120 | the ledger read as plain English (`'reversal' → "undid a change"`) |
| `journalWeekStatus` / `journalWeekJob` | 84 / — | blocking §18 violations; the week's exposure-contract job |

**This is a better coach context than the packet has ever had.** `felt` alone
carries `feelingsRecorded`, `sorenessRecorded`, `gameFeelsRecorded`,
**`gameFeelLatest`** (1-5, explicitly the latest and never a mean, with the
reason written in the type), `differedFromPlan`, `nothingRecorded` — against a
packet whose entire feedback view is `{completion?: string}`.

`journalNiggleHistory.resurfaced` is the single most coach-shaped thing in the
repo: *"notes written during a PAST episode in a region that is flaring again."*
That is a coach remembering.

### 6.2 The three constraints the coach must obey when reading them

1. **PROVENANCE TRAVELS WITH THE NUMBER.** `journalLoad` wraps its
   constant-derived outputs in `Derived<T>` with `ConstantProvenance =
   'signed' | 'proposed'`, and `signedValue()` returns `null` for unsigned
   (`journalLoad.ts:71-251`). The type's own comment warns that even DRAWING an
   unsigned band puts an unsigned number in front of the athlete "as a PICTURE".
   **A coach that speaks a load ratio is speaking a number, and unsigned means
   it stays dark.**
2. **THE COVERAGE FIELDS EXIST TO BE SPOKEN.** `coverage.sessionsMeasured` vs
   `sessionsPlanned`, `liftsUnmeasured`, `work.notAnswered`,
   `work.missingReasons`, `load.comparisonAvailable`,
   `felt.nothingRecorded` — the Journal's rider 1 is that it must say so out
   loud rather than inventing a why. The acceptance contract's *"Am I getting
   better?" → never invented numbers* is the same law arriving from the other
   side.
3. **VOCABULARY.** "exposure" is in `ATHLETE_FORBIDDEN_VOCABULARY`
   (`journalWeek.ts:213-214`). The Journal's copy regime and the coach's words
   are the same regime.

### 6.3 THE CALLER PROBLEM — one product caller each, and it is the hidden screen

**MEASURED.** `grep` for `buildJournalWeek|buildJournalLoadModel|buildJournalMonth|
buildJournalNiggleHistory|buildJournalStrengthTrend|buildJournalChanges|
flaggedNiggleRegions` across product source returns **`JournalScreen.tsx` and
nothing else**. Every one of these derivations has exactly one caller, and that
caller is unreachable.

This is not a defect — it is the ruling working as intended (machinery frozen,
not deleted). It is a **dependency**: the coach rebuild is the second caller,
and until it exists, seven derivations run only in their suites.

### 6.4 THE RAW RECORD — what is still being written, and the one that stopped

| stream | store / key | persisted | reachable writer today |
|---|---|---|---|
| session outcomes, feeling, soreness, expectation, **game feel 1-5** | `programStore.sessionFeedback` (`program-store`, in `partialize`) | **YES** | **YES** — `SessionFeedbackPanel` on `DayWorkoutScreenV2`, route `DayWorkout` registered in `ProgramStack` |
| strength / conditioning performance logs | `sessionFeedback.strength` / `.conditioning` | **YES** | YES — same panel |
| injury episodes | `programStore.acceptedMaterialContext.injuryEpisodes` (in `partialize`) | **YES** | YES — `set_injury_modifier` |
| illness / busy / schedule facts | `temporarySourceFacts` (in `partialize`) | **YES** | YES — `set_illness_status` etc. |
| readiness signals | `readinessStore` (`readiness-store`) | **YES** | YES — `set_fatigue_status` |
| decision ledger | `decisionLedgerStore` (`decision-ledger-store`) | **YES** | YES — taps + fixtures |
| **athlete journal NOTES + tags** | `journalNoteStore` (`journal-note-store`) | **YES** | **NO — ZERO** |

**THE ONE THAT STOPPED, MEASURED.** `grep -rn "recordJournalNote"` across
product source returns **only `JournalScreen.tsx:1310`**. The note door has no
other caller. Since the hide, **no athlete can write a journal note.**

This matters more than its size suggests, because notes are half of
`journalNiggleHistory`'s input (`BuildJournalNiggleHistoryInput = { episodes,
notes }`) and **the entire input of `resurfaced`** — the resurfacing feature
reads notes written *during a past episode*, so an empty note store makes that
output permanently empty rather than merely sparse. The eight-tag vocabulary
(`recovery, mobility, injury, diet, work_stress, sleep, illness, travel`) is
closed and authored and currently unreachable.

**Filed as a FINDING, not a defect.** Ruling item 3 kept the two data-CREATING
taps precisely so the record Sam wants kept keeps accruing; the note door is a
third data-creating door that the ruling's list did not name, and the gate
(`journalHiddenContractTests` [4]) proves the two named ones reachable hop by
hop without asking about this one. **Sam's call, and the coach kickoff is the
natural place to put it**, since the coach is the reason notes are being kept:
either notes come back on some reachable surface, or the coach rebuild plans for
a note store that only ever holds what was written before 2026-08-09.

### 6.5 The privacy dependency, ATTRIBUTED

The 2026-08-09 handoff §1 records: *"coach reading athlete NOTES = opt-in + App
Store label change (parked by Sam's own earlier ruling)."* So notes are the one
journal stream with a product-decision gate in front of it. **The derivations
that read notes are `journalNiggleHistory` (episodes + notes) — everything else
in §6.1 reads only logs, feedback, episodes and the ledger, none of which carry
free text.** A first coach context slice that takes load, regions, feel, kinds,
coverage and strength trend but NOT notes is therefore both useful and
privacy-clean, and needs no opt-in. Worth naming in the kickoff as the obvious
first cut.

---

## §7 WHAT THE REBUILD INHERITS AS OWED WORK

Not new findings — items already attributed elsewhere that land on this unit:

1. **Three PROPOSED, UNSIGNED copy sheets** from R5.7's day-menu fallbacks.
2. **MetCon rename** — pinned under LR-6, description live, name waits for this
   unit (seat handoff §4).
3. **D-2 hydration-repair branch** (`programStore.ts:1216-1219`) — LR-6 scope by
   Sam's 2026-08-05 ruling; nothing done to it until this unit; the "just move
   it" option is a precedence decision in disguise.
4. **`src/types/navigation.ts:160-172`** — seven `CoachStackParamList` routes no
   navigator registers.
5. **The generation-quality unit is separate**
   (`COACHING_QUALITY_EXHIBITS_2026-08-07.md`, *"labels are okay but the
   programming is pretty shit"*). It is about `coachingEngine` and §18, not
   about chat. The roadmap already orders it AFTER coach. Do not let the two
   merge: one is what the app SAYS, the other is what it PROGRAMS.

---

## §8 THE NORTH STAR VERDICT, AND THE ONE THING THAT COMPRESSES

**Direction: TOWARD, decisively — and the survey's value is that it says why in
one sentence.**

> The frozen coach pipeline is the largest surviving population of stored
> derived output in the app, and the boot already deletes it.

`rebuildDerivedWorld` empties `dateOverrides`, `weekScopedOverlays`,
`userRemovalConstraints` and the three mirrors on every rebuild. Seven of the
coach's writer ids write nothing else. So the coach rebuild is not "add ledger
support to the coach" — it is **the deletion of a write layer that the engine
already treats as ephemeral**, replaced by decisions the engine already knows
how to replay. Per CLAUDE.md's Elegant Solution Requirement, the two options are
not close:

- **Incremental:** teach each coach writer to also append. Adds a ninth
  representation, keeps eight, keeps `coachCommandExecutor`'s 4,781 lines, and
  leaves every red in §3.3 red until each writer is done.
- **Redesign:** the coach produces an athlete DECISION and hands it to
  `executeProgramControlAction`. Representations go from eight to one; the
  ~28k-line frozen tree loses its executor, router, override writer, undo engine
  and revision writer; undo, replay and durability arrive free for whatever the
  ledger covers; the greens in §3.3 (intent, targets, references, verification)
  are exactly the layers that survive.

**LOOP-AUDIT COMPRESSION (the one thing this survey says should NOT iterate).**
`docs/COACH_CLARIFIER_TRANSACTION_*` (2026-07-24), the acceptance contract's own
"cross-cutting rule discovered in review", LR-6's eight representations, this
survey's §3.2 — **four separate sittings have now concluded that the coach's
problem is the number of representations of one request.** AGENTS.md's
escalation rule requires a written reassessment answering seven questions before
more pipeline code, and CLAUDE.md's preferred shape is already recorded:
`visible program snapshot → user message → proposed revised visible plan → diff
→ validation → override → visible verification`. **The reassessment is the
kickoff's first artefact, and it should be written against §5 of this document
rather than re-derived.** A fifth sitting that re-discovers "there are too many
representations" is the failure §1b of the seat handoff exists to prevent.

---

## §9 NOT COVERED — read this before treating anything above as settled

**No completeness claim is made.** Named limits, worst first:

1. **THE FROZEN LINE COUNT IS A NAME SCAN, NOT AN IMPORT GRAPH.** §1.2's
   instrument matches filenames containing "coach" and import-path literals. It
   misses every frozen module NOT named `*coach*` (`injuryAdjustmentEngine`,
   `pendingInjuryResolver`, `programAdjustmentEngine`, `applyAdjustmentEvents`
   and others all reference `CoachScreen.handleSend` in their headers and were
   not classified), and it misclassified two frozen ROOTS as live. **A real
   reachability answer needs a walk from `App.tsx`.** NOW.md already records
   that no instrument distinguishes "shipped" from "shipped and reachable".
2. **18 OF 55 ORPHANED COACH SUITES WERE RUN. 37 WERE NOT**, including 19 with
   no npm script. The 7-red / 11-green split is a sample, not a census, and it
   was not chosen randomly — it favoured suites whose names suggested live
   paths. The true red count is unknown and bounded below by 7.
3. **NO RED WAS ROOT-CAUSED.** §3.3 attributes all seven to the same class from
   the failure TEXT plus §3.2's mechanism. That is a reading, not a bisect. At
   least one could be an unrelated fixture rot.
4. **THE EDGE FUNCTIONS WERE COUNTED, NOT READ.** 2,605 lines of `coach-chat`
   were not reviewed. What is deployed, whether the model ids resolve, and what
   the prompts currently say are all unknown to this repo.
5. **NO COACH TURN WAS EXECUTED.** Nothing here walked a message through the
   pipeline. Every behavioural statement is from source and from suite output.
6. **THE JOURNAL DERIVATIONS WERE READ AT THEIR TYPES, NOT EXERCISED.** Their
   suites are green in the chain; whether their outputs are USEFUL to a coach on
   a real athlete's data is unmeasured, and `dataState` /
   `comparisonAvailable` / `LOAD_COMPARISON_MIN_WEEKS = 4` /
   `TREND_MIN_WEEKS = 6` mean **most of §6.1 returns null for a new athlete.**
   How much fuel actually exists on Sam's device is unknown.
7. **THE COPY GAP IN §4.3 WAS NOT ARCHAEOLOGISED.** "Zero hits today" is
   measured; "never built" is not claimed.
8. **§5.2's DURABILITY CONSEQUENCE IS AN INFERENCE.** No relaunch was performed.
   It follows from `partialize` + `rebuildDerivedWorld` + zero ledger appends,
   each measured separately; the three have not been observed together. **A
   one-shot tape in the shape of `tape:lr29-boot-replay` would settle it in an
   hour, and the probe must be hard enough to distinguish "restored" from
   "there was nothing to restore" — LR-29 item 1 lost a day to exactly that.**
9. **NO RULING IS MADE HERE.** §5.4's fork, §6.4's note door and §8's
   recommendation are input to the kickoff and to Sam, not decisions.
