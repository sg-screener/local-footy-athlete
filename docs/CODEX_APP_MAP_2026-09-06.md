# LFA app map and inspection — 6 September 2026

Owner: Codex, inspection only. This is the only project file created or edited for this review. No fixes, new tests, changed expectations, commits, branch changes, live AI calls, simulator resets, screenshots or recordings were authorised or performed.

## Assessment

LFA has a substantial working core. Its current design is much closer to “save the athlete's decisions and rebuild the program from them” than several of its own architecture documents suggest. Generation, accepted changes, recorded training and restart have meaningful executable journeys. Replacing the whole app would discard useful work.

The remaining difficulty is carrying the same meaning through every stage. An injury can reach the compiler while its explanation fails to reach the card. A one-session equipment decision can coincide with another week changing. The Coach's separate bundle of reference material has fallen behind the program's rules. Some tests now measure obsolete assumptions, while useful checks are outside the release selection. These are concrete connection and verification problems, not an objection to long files or coding style.

This is a breadth-first source review with selected behavioural investigations, not a completed launch audit. No native interaction or layout was verified. “Confirmed” below means confirmed within the named instrument and scope; it does not mean accepted on Sam's iPhone.

## 1. Repository state and authority

### Exact review target

- Branch: `integrate/2026-09-04-morning`.
- HEAD: `8d06bbde17390aa6532b9eabb3cfbb68294e1dc5`.
- `git log 5b9210ad..HEAD` contains **four distinct commits**: `cb9e4cdb`, `0dfef003`, `85f27613`, and `8d06bbde`. The first three are the implementation commits in the handoff; the fourth adds the handoff. Both counts can therefore be explained without inventing an extra implementation.
- `git diff --stat 5b9210ad..HEAD`: **29 changed file paths, 1,552 inserted lines, 239 deleted lines**. Excluding the 227-line handoff gives its stated 28 files and 1,325 insertions. These are diff-line/file counts, not feature counts.
- The only tracked working-tree modification on arrival was `docs/NOW.md`, five added and five removed lines. Existing untracked items were `.fuse_hidden0000001900000001`, `.fuse_hidden0000001b00000002`, `.maestro/visible/gminus1-add-undo-reopen.yaml`, the two August 28 handoffs, `docs/STATUS_LIVEDYEAR.md`, and `output/`, `outputs/`, `tmp/`.
- None of those was changed deliberately. Temporary command results and year output live under `/private/tmp/lfa-inspection-*`, outside the project. End-of-review state is recorded below.

The actual handoff filename is `docs/HANDOFF_VARIETY_2026-09-05.md`; that file was read in full. No file named `HANDOFF_VARIETY_20260905.md` was substituted from memory.

### Reading and precedence

Read the entry handoff, `CLAUDE.md`, `AGENTS.md`, `docs/NORTH_STAR.md`, current `docs/NOW.md`, the active inbox context, other seats' status headers, and the relevant current rule sections before investigating changes. Used the Bible's section map, core principles, seasonal rules, strength/equipment policy, injury authority/severity, readiness, progression/edit policy, Section 17 hierarchy and Section 18 tables. This was targeted authoritative reading, not a claim to have read every line of every historical document.

Authority used:

1. Sam's present inspection brief controls this task, including the one-report-only edit limit. Older instructions to update NOW, write an inbox order, commit or implement do not authorise those actions here.
2. Explicit applicable approved rulings in `docs/RULINGS_REGISTRY.md` and the governing laws. Code and old tests cannot overturn an approved change.
3. Within `docs/LFA_PROGRAMMING_BIBLE.md`: Section 18, then Section 17, then earlier sections. The authored conditioning framework and spreadsheet named in Section 6 own conditioning doses. Their names/pointers and consuming code were traced; the spreadsheet was not independently audited cell by cell.
4. Tests are evidence of the contract they actually assert. Source shows what is built. Handoffs and comments are claims to check.

Specific current principles: distinguish minimum/default/maximum; preserve safe useful work rather than fill empty days with junk; credit actual team/game participation; protect fixture-relative days across week boundaries; reduce dose before frequency where required; preserve completed history; keep athlete removals and chosen loads; no automatic Off-season-to-Pre-season transition; no scheduled In-season deload; respect equipment and training-age eligibility before selecting exercises. The injury-risk sheet outranks illustrative swap examples from severity 6 upward. R-095 bans High Box Squat and Vertical Jump on G-2. R-378 permits filling an injury-emptied G-2 day only for a genuine safe weekly gap. R-379 puts the reason on the empty day.

### Outdated guidance that matters

- `docs/NOW.md:66` points to `codex/failure-only-state-export` and `0bcc3353`, not the reviewed branch/HEAD. Much of its open-work prose is from August 10–13.
- `src/ARCHITECTURE.md` describes auth stores, Supabase login and service modules absent from the current runtime tree. It is not a reliable current wiring map.
- `docs/LFA_PRODUCT_ARCHITECTURE.md` retains an old mutable Coach and projection model, while `CoachTabScreen` now calls a read-only endpoint. The current read-only intent is also recorded in R-140 and the later Coach rulings; this is not an unfinished command feature to restore unasked.
- Older AGENTS/NOW language gives `test:bible` release authority. Current `CLAUDE.md`, `scripts/release-gate.js` and `scripts/test-truth-decisions.json` explicitly select current contracts and treat the old fleet as diagnostic. This report follows the current tool for identifying release coverage, while preserving the fact that old process-law prose remains inconsistent. It does not treat excluded laws as satisfied.
- The August entry handoff's compiler-error backlog and branch are historical. Current `test:compile` measures **zero diagnostics in each of its three scopes**.
- The variety handoff calls the omission/gap ruling R-379 in its first section; the actual registry puts that decision in **R-378**, and the day-copy placement in **R-379**.

## 2. Architecture and feature map

Coverage key: **M** = entry points/state mapped; **T** = important source path traced; **R** = current local execution. **No area below has native interaction or visual acceptance.** Test names in the final column are relevant existing coverage; only tests listed in Section 7 were executed in this review.

| Area | What it does and important entry points | Authority, reads, writes and dependencies | Coverage / existing checks |
| --- | --- | --- | --- |
| Launch and onboarding | `App.tsx` → `RootNavigator` → `useInitializeApp`/`appHydrationGate`; `OnboardingNavigator`, `onboardingSteps`, Review and `CompleteScreen.generateProgram` | Profile answers in `profileStore`; completeness checked before generation. Completion installs generated state, rather than substituting an arbitrary default on failure. Boot waits for storage and exposes a retry on failure. | M/T/R through onboarding helpers in annual, settings and injury journeys. `onboarding-cold-start`, `onboarding-reliability`, `onboarding-generation-outcome`. No taps through every question. |
| Profile/settings | `ProfileScreen`, `ProfileFieldSheet`, `EquipmentEditorSheet`; `decideProfileSetupChange`, `commitProfileProgramTransaction` | Permanent answers belong to profile; accepted program regeneration and rollback are coordinated. Tracked lift choices also rebuild the derived world. Separate from dated session equipment. | M/T/R `settings-persistence` across fresh and lived state; eight failed assertions analysed below. |
| Full program and calendar | `generateProgramFromProfile`/`generateProgramLocally` in `services/api/generateProgram.ts` → `compileCanonicalProgram` → `compileCanonicalProgramWeeks` | Profile, explicit dates/phase clock, equipment, accepted selections, previous results and facts. Canonical compiler authors the block; `weeklyScheduler` chooses legal purposes/days; row compiler and progression produce workouts/contracts. | M/T/R annual drivers and canonical compiler slice. No paid generation; generation exercised locally. |
| Seasons, blocks, deload and progression | `seasonPhaseClock`, subphase policies, `canonicalWeeklyScheduledDeloadState`, `blockBoundaryProgression`, `canonicalWeeklyProgressionCompiler`, `programBlockState`, rollover/rebuild utilities | Phase decision and original generation date are inputs. Progression reads accepted training history with a cutoff so relaunch does not spend the same history again. Selection/block records preserve identity. | M/T/R multi-phase annual runs, settings rollover and 1RM chain. All phase/input combinations not enumerated. |
| Exercise selection/rotation | `automaticWeeklyExerciseSelection`, `blockExerciseSelection`, `weeklyStrengthBudget`, `composeWeek`, `materialiseAuthoredSessions` | Catalogue pools, movement/family evidence, equipment requirements, training age, weekly uniqueness, accepted selections, exclusions and current injury limits. Rulings about the weekly main seat and rotation outrank old fixed-name examples. | M/T/R final annual rows and canonical suite. Four limited-kit bilateral coverage assertions fail. |
| Conditioning, speed, power, core, mobility | Authored `conditioningTemplates`, `conditioningDose`, `conditioningSelection`, speed/power pools, `mobilityPrehabFlow`, `canonicalWeeklyPlaneCompletion` | Section 18 exposure ownership and authored dose sources. Genuine speed may also earn conditioning credit; optional flush is not a core substitute. Warm-up flows and session rows have distinct display paths. | M/T/R sampled final rows, canonical suite and logged outcomes. Full authored spreadsheet, every video and every exercise not audited. |
| Injuries | `GuidedInjuryFlowSheet`/home and My Status handlers → `buildGuidedInjuryConstraint` → program-control/injury fact transaction → source-fact and injury compilers | Typed injury episodes/facts; risk sheet and severity bands; injury session ladder, omissions/withholding, affected-date boundary. `canonicalWeeklyInjuryCompiler` protects history and validates final rows. | M/T/R injury-authority, injury-recomposition, canonical journeys, explicit explanation trace. Separate explanation and I6 conclusions in Section 4. |
| Fatigue, illness, readiness, travel/time limits | Quick-action/status sheets; `weekReadinessActions`, `temporarySourceFactTransaction`, `fatigueSequencePolicy`, `canonicalWeeklyConstraintCompiler` | Dated facts own windows; standing capacity is a separate profile-derived concept. Travel and equipment are composed with other facts; clearing one must preserve the rest. | M/T/R annual fatigue/illness, canonical fact overlap/clear, settings scopes. Explanation support is incomplete. |
| Session/exercise changes and Undo | `PlanChangeSheet`, `WeekBoard`, active-session sheets → `planChangeProducer`, `programControlActions`, `acceptedStateTransaction`, `undoLastDecision` | Typed decisions/accepted effects recorded in `decisionLedgerStore`; validation, accepted publication, replay and reversal. Athlete-added/removed work must not be silently undone by the generator. | M/T/R canonical add/remove/move/Undo, settings edit and restart cases. Touch/drag/keyboard behaviour not checked. |
| Games/team training | Home fixture controls → `fixtureMutationTransaction`; `canonicalWeeklyFixtureEditCompiler`, fixture-conditioned availability, `dayPrecedence`, participation/game feedback | Calendar overrides and usual-game profile input; explicit fixture effects are replayed. Same-day and cross-week protection; travel suppresses only governed anchors. | M/T/R canonical fixture sequences and year bye/Sunday-game actions. No club attendance inferred beyond supplied inputs. |
| Program/day/exercise display | Mounted Home selects V2; `useHomeScreen` → `useResolvedWeek` → `buildProgramTabProjectedWeek`; day route → V2; `projectVisibleWeek`, `sessionTemplate`, checklist and feedback components | Uses resolved accepted state and final constraint compilation. Program hook adds rest metadata, while `deriveVisibleWeekLive` goes directly through the resolver. This difference matters for tests. | M/T/R headless rows/identities; no layout, animation, accessibility or native sheet claims. Classic Home source still exists behind a constant V2 choice; it is not evidence of two active UIs. |
| Logging/history | `SessionFeedbackPanel` → `createRecordSessionOutcomeIntentFromFeedback` → `commitSessionOutcomeTransaction`; strength/conditioning logging helpers | Durable session feedback and outcome receipts live in program input persistence; weight/band choices also persist. `workoutLogStore` holds transient in-session sets, not completed history. | M/T/R annual recorded sessions, settings history, 1RM save/reopen. Killing the app mid-set was not tested. |
| Progress, training load and predicted 1RM | `ProgressTabScreen`, `liveAthleteSnapshot`, `progressMainLiftStrength`, `estimatedOneRepMax`, journal calculation modules, performance tests | Reads recorded results and selected tracked lifts; missing evidence stays absent. Current last-set estimate records actual load/reps/RIR, handles pull-up bodyweight and selected unilateral side. Performance-test changes use profile transactions. | M/T/R `estimated-1rm` chain. Estimate implementation/ownership checked, not independent scientific validation. Two block-completion discrepancies remain unresolved. |
| Coach | `CoachTabScreen` → `askCoachReadOnly` → Supabase `coach-chat`; Snapshot → `coachModelContext`; server retrieval → response contract | Current snapshot derived from program/results/modifiers; reduced payload; server owns model and instructions. Model-produced changes and false change claims are rejected. Conversation turns are transient. Deterministic commitment buttons are distinct from AI authority. | M/T/R mocked client/response/rate-limit checks. Bundled knowledge freshness fails. No provider call, live deployment or answer-quality assessment. |
| Storage/reload | `programStore.projectProgramPersistedInputs`, `profileStore`, preferences, selection history and decision ledger; `asyncStorageCompat`, `quiescentBoot` | AsyncStorage adapters on device, in-memory localStorage in reviewed tests. Inputs survive; program, overlays and overrides are reconstructed. Compatibility mirrors and accepted in-memory views still exist, but are not all independently durable copies. | M/T/R repeated input-store rehydrate/production boot. Not OS process death, backup restoration or storage-pressure testing. |
| Accounts, backend, subscriptions | Local-only navigator; `config/env`; Coach edge functions and private rate-limit SQL | No mounted account/login/subscription flow found. Shared public app credential is transport configuration, not per-athlete login. Server uses opaque IP-derived rate keys and a global spend ceiling. Training records stay local in the traced paths. Old SQL/account types and purchase dependencies do not establish an active product feature. | M/T; mocked rate-limit tests only. No production data, RLS deployment, credentials or live billing inspection. Local-only/iPhone-only are already decided scope, not new bugs. |
| Demos, support and policies | `exerciseVideoService`, `ExerciseVideoModal`, Profile FAQ/privacy/terms/support actions | Canonical exercise → pinned video URL; explicit absent-demo handling. Contact/environment settings. | M/T. No video playback, link availability or legal review. |
| Developer tools and release | Dev E2E seeds/clock/coordinator, Maestro flows, annual runners, writer census, test-truth registry, typecheck gate; `app.json`, `eas.json`, iOS project | Release app separates dev seed/clock imports. Current gate derives selected contracts; debug flows may reseed the simulator. EAS submit iOS entry is empty configuration awaiting publishing details. | M/T/R selected safe checks. No build/install/deploy. Annual diff tool depends on an untracked driver. |

### Simplified data map

```text
Onboarding/settings ──> profile + phase/date + equipment/selection inputs
Injury/life reports ──> dated facts
Session/fixture edits ──> accepted decisions and reversals
Training completed ──> recorded results and chosen loads
                              │
                      canonical compilation
                   schedule → rows → progression
                              │
                  accepted in-memory program/views
                 + dated overlays + accepted effects
                              │
                   resolver/final constraints
                              │
                 Program / Session / Progress / Snapshot

Reload: stored inputs → production boot → same compilation/replay → views
Coach: reduced Snapshot + separately bundled rules → read-only server answer
```

This deliberately distinguishes in-memory “stored program” language from bytes saved to disk. The handoff frequently uses “stored” for the former.

## 3. Important end-to-end flows

### Onboarding, settings and reopening

`CompleteScreen` checks required answers, calls `runOnboardingProgramGeneration`, and asks local canonical generation to author selections. `profileStore.completeOnboarding` and the accepted installation path publish the initial program. Profile edits use `commitProfileProgramTransaction` and the existing settling/rebuild owner. Disk carries inputs; boot rehydrates them, regenerates the accepted block from its original date/history cutoff, and folds decisions. Tested indirectly through real onboarding functions and explicitly through settings and annual relaunch helpers. These helpers clear in-memory stores and read the isolated saved map; they do not restart iOS.

### Injury → accepted fact → rebuilt remainder → display → reopening

1. Guided injury selection constructs a typed constraint; `executeProgramControlActionDurably` reaches injury/source-fact ownership rather than writing a display-only warning.
2. `sourceFactRequiresCompilation` explicitly recognises injury. `captureSourceFactCompilerInput` captures the healthy/base generation inputs and accepted context.
3. `compileCanonicalSourceFactWeeks` sorts applicable facts and recompiles relevant weeks. At lines 89–116 it calculates `governedFromISO` and supplies `pinnedHistoryWorkouts` for dates behind that boundary.
4. `compileCanonicalProgram`/row compiler generates a schedule and workouts. Further injury handling deliberately preserves accepted strength where appropriate, brings across planned conditioning, runs the injury ladder and final row restriction stage. The scheduler's intermediate empty-day decision is not sufficient to establish the final day is empty.
5. `compileWeekOverlay` creates the dated replacement view. `compileAcceptedSourceFacts` publishes it through the accepted transaction. **`restDayReasonByDay` is not copied.**
6. `useResolvedWeek` → `buildProgramTabProjectedWeek` resolves workouts but asks **the base microcycle only** for the reason. An overlay's replacement day and the base week's reason can therefore describe different decisions.
7. `HomeScreenV2:2972` renders the signed reason only in its no-workout rest branch. Otherwise ordinary rest copy remains.
8. Persistence saves facts, not this overlay. Boot repeats the same compilation, so adding an overlay field to the disk schema would be the wrong repair direction.

Measured trace: generated showcase week contains `{4:"injury"}`. Calling the actual `compileWeekOverlay` loses that property. A separate local onboarding → shoulder 9/10 → knee 9/10 → reopen journey observed compiler reasons for four distinct weeks, but base reasons were `{}`, all four overlay reasons absent, and no rendered-day reason before or after boot. Both injury actions succeeded and boot returned `ok:true`. **That journey did not reproduce the phone's empty Thursday:** final Thursday retained an Injury-Adjusted Session. It proves the data loss and its recurrence on boot, not that the proposed overlay change alone repairs the reported phone screen. The showcase and this lived journey have different injury/base histories; they must not be conflated.

### Equipment/session edit → other weeks

Existing settings Stage 3 creates a real four-week lived athlete, rolls into the next block, then sends `missing_for_session` for 10 August with barbell/machine/cables missing. The input decision is one day; permanent equipment remains separate. Today's week changes, but the visible 31 August week also loses `Close Grip Bench` at 75 kg from Monday. Other printed rows remain unchanged. This is a confirmed unrelated-week visible change in the current test. Whether the cause is scope propagation, rebuilding accepted selections, or applying an existing exclusion at a different stage remains unresolved; the test does not justify naming one yet.

### Training → results → Progress → reopening

The checklist feeds actual performance into `SessionFeedbackPanel`, which builds a typed outcome and waits for `commitSessionOutcomeTransaction`. Failure is shown instead of an unconditional success. The outcome has an identity/receipt; durable feedback and load inputs feed block progression and the Snapshot/Progress calculations. The 1RM chain exercises saved last-set evidence and reopening. In-progress `workoutLogStore` data is transient; its mere absence of persistence does **not** show that finished sessions are lost.

### Coach question → answer

The mounted screen supplies the current derived Snapshot and recent conversation to `askCoachReadOnly`. The client selects allowed fields through `buildCoachModelInput`. The server validates request shape, checks durable client/global limits, retrieves from `canonicalCoachKnowledge.generated.ts`, requests a structured answer and rejects program actions or false update claims. Client validation repeats the no-action boundary. The current defect is stale bundled knowledge, independent of the program mutation system. Remote deployed bytes and live response quality remain unknown.

## 4. Verification of the variety handoff

| Claim or judgement | Current evidence and verdict |
| --- | --- |
| Three commits above `5b9210ad` | **Verified for implementation; four total with the documentation commit.** Diff arithmetic reconciles exactly. |
| Injury reaches the scheduler; substitute/drop occurs after the ladder | **Source-traced and supported by current tests.** `canonicalWeeklyCompiler` derives prohibited patterns; `weeklyScheduler:1001–1052` substitutes legal purposes then drops impossible ones. Injury-recomposition passes 186 assertions. This is not proof of every injury/input combination. |
| Injuries never re-plan the current week | **Withdrawn and contradicted.** Injury facts explicitly trigger forward compilation; pinned history and current action/reload journeys exist. Do not revive the claim. |
| Reasons are dropped at the overlay boundary | **Confirmed at source and by executing the actual boundary.** However final phone emptiness and the complete proposed fix remain unverified. |
| Showcase proves the reason reaches the phone | **Not established.** It produces reason metadata; building a seed is not installing it and opening the actual card. `dev-e2e-seeds` tests build/witness state without proving native rendering. |
| G2/G3/G4 changed from quality-lower to omission | **Consistent with R-095 and R-378.** Restoring the old High Box Squat/Vertical Jump expectations would restore a prohibited exception. Current injury-authority scenarios pass. |
| G7 changed equality to no shortfall | **Meaningfully weaker for the upper bound, reasonable for its no-husk question only.** The spent-week scenario compares completed history against a newly reduced future target. Completed sessions should not be removed to force equality. But `>=` cannot prove absence of excess future work. Preserve historical rows and separately count future prescription against the remaining requirement. Injury-recomposition provides other non-inflation coverage; it does not make G7's inequality an equality check. |
| Removed Coach Note assertion | **The old sentence should not return.** It described the cancelled lower session and its note kind has no product writer. The replacement check only bans the cancelled sentence; it does not prove a new explanation exists. R-379 now specifies on-day placement, so creating an obsolete note writer is not automatically the right fix. |
| I6 remains quarantined and shows pressing in the current week | **The quarantine label is stale; current I6 runs and passes in the default 26-scenario suite.** Its actual assertion checks the rebased contract contains push/pull prohibitions, not the rendered exercise list. Thus I6 alone never proves either presence or absence of pressing. The independent 186-assertion recomposition suite checks painful pressing removal through current/future views, clear and restart. No current pressing defect was reproduced by this inspection. Do not report universal injury safety from either result. |
| Changed year baseline | **Exactly four exercise-role count entries changed:** for each of two athletes, `4 × 4 VO₂ Max` 3→4 and `5-Minute Aerobic Intervals` 4→3. Total rows unchanged. The current rerun matches the revised baseline in all counted fields. It is a descriptive baseline, not a coaching approval or reason-visibility test. I did not run the old revision to independently reproduce the causal before/after change. No automatic reversal recommended. |
| Four canonical release failures are the whole current set | **Contradicted by the current direct slice:** 10,615 assertions pass and five fail. Four are the named limited-kit bilateral cases; the fifth is the new reader-wrapper ownership assertion. The latter dislikes the new rest metadata map. Full release gate was not executed. |
| Other reds were controlled at `5b9210ad` | **Reported by Claude only.** No historical control checkout was created. Copy-binding/visible-surface/session-template failures were not independently rerun. This report does not label them pre-existing. |
| Full compiler year: 416/416 | **Handoff-only for that exact full command.** This review runs the preserved two-athlete year driver and selected existing annual-runner archetypes; it does not overwrite the canonical report directory or claim the full release-year verdict. |

## 5. Major findings, ranked by consequence

### 1. A one-session equipment decision changes another week

**Confirmed visible drift; root cause unresolved.** The existing settings Stage 3 reproduction above removes a 75 kg Close Grip Bench row from 31 August after an equipment report scoped to 10 August. That is a tangible athlete-facing effect, not a source-style preference. Evidence: `settingsPersistenceJourneyTests:954–1003`, `support/settingsJourney.declareSessionEquipmentMissing:301`, `programControlActions`, `sourceFactCompilation`, `quiescentBoot`, and `/private/tmp/lfa-inspection-settings.log`.

Smallest sensible direction: trace the first changed accepted selection/exclusion/row across that one existing journey, then correct the owner applying it outside the intended date. A general rebuild redesign is not yet justified: much of the same restart path passes. Preserve explicit exclusions, previously completed blocks, chosen loads and permanent equipment answers. Acceptance: today's valid substitutions remain; every other date's accepted rows/doses/loads remain identical before settling, after settling, after reopen and after clearing/Undo. Include accumulated exclusions and block selection history in the case so a fresh-only test cannot miss it.

### 2. The empty-day explanation feature is incomplete beyond one missing field

**Confirmed data-path and producer gaps; native symptom not independently reproduced.** The compiler carries a reason, the overlay constructor drops it, and the Program reader only checks the original week. Separately, the only assignment to the scheduler's reason map is `injury`; `game_proximity`, `illness`, `away` and `deload` have vocabulary/copy but no corresponding producer through this map. Later fatigue logic can set a day to `null` without recording a rest reason. The generic injury key resolves to a shoulder-specific sentence; game copy assumes Saturday and Monday. Those sentences were approved, so this review does not rewrite them or assume approval of new wording.

Evidence: `restDayReason.ts:31–80`, `weeklyScheduler:1001–1052,2040`, `canonicalWeeklySourceFactCompiler:121,176–199`, `canonicalWeekOverlay:24–84`, `visibleProgramReadModel:54–83`, `projectionCopy:640–671`, `HomeScreenV2:2972`.

Direction: compare (a) carrying metadata through the existing effective-week overlay and reader, and (b) a single final effective-day result containing workout plus applicable reason after all changes. Prefer the existing effective-result owner that prevents stale reasons after refill/clear; do not add persisted derived output or a second explanation engine. Preserve all signed wording until Sam approves any genuinely necessary generalisation, ordinary rest copy, fixture bans and completed history. Acceptance: each supported cause reaches an actually empty final day; ordinary/refilled days have no false explanation; non-shoulder injuries and non-Saturday fixtures cannot receive inaccurate context; verify live selection, My Status relationship, clear, regeneration and reopen. The current source-only 19 tests are insufficient.

### 3. Coach reference material is stale, and its freshness check is outside the selected release gate

**Confirmed in the checkout; deployed endpoint unresolved.** `test:coach-chat-integration` has 63 passing assertions and one failure: bundled source equality. All **six of six distinct manifest source files** differ: Bible, rulings registry, strength pool, tags, equipment requirements and conditioning templates. The bundled registry lacks R-378 and R-379. The current server imports that bundle. No claim is made that these local bytes are the deployed version, or that a particular live answer is wrong.

Evidence: `coachKnowledgeManifest.ts`, `canonicalCoachKnowledge.generated.ts`, `coach-chat/index.ts:140–152`, `coachChatIntegrationTests:115–136`; `release-gate.js --list` and package-script expansion do not include this check. `test:coach-snapshot` is classified `rewrite_test`, not a current release witness.

Direction: use the existing bundle generator, verify its six inputs and enforce freshness in the existing release selection; separately verify the deployed version when authorised. This is better than maintaining another manual Coach rule list. Preserve read-only actions, payload minimisation, rate limits and response checks. Acceptance: all six sources match, the freshness check demonstrably rejects a stale bundle, and the build/deploy path cannot silently skip it. Live answer quality remains a separate review.

### 4. Limited-equipment weeks fail the current bilateral-squat coverage check

**Confirmed test failure in four distinct scenarios; corrective selection not decided here.** `support/unilateralPriorityJourney.ts` onboards male/female commercial-gym athletes with either rack or barbell marked unavailable. All four fail to contain a row tagged as a bilateral squat, while the existing check requires one. The journeys do exercise real generation and restart. This should not be dismissed because the broader year sample passes; it reaches different equipment inputs.

Direction: inspect the compiler's honest required seat, available legal bilateral options and any typed exception for these exact four cases. Repair selection/credit if required coverage is missing; correct the witness only if a newer approved rule demonstrably changes its requirement. Preserve unilateral work, no-repeat rules, equipment restrictions, injury eligibility and the compound/session caps. Acceptance: supported limited-kit profiles receive their required safe coverage or an explicitly authorised reduction, and the final visible rows and restart agree. Do not force an arbitrary exercise simply to satisfy the test.

### 5. Test success/failure sometimes answers a different question from the feature

**Confirmed verification weakness, with unresolved product signals retained.** Examples:

- `restDayReasonTests` can pass all 19 assertions without executing the injury transaction, overlay or native card. Its position comparison does not establish both anchors exist. It does not prove that all five causes have writers.
- I6's title promises materialised no-pressing behaviour but checks contract metadata. G7's no-shortfall test no longer holds an upper bound or a positive disclosure.
- `canonicalConstraintOwnership` requires a wrapper to contain exactly one return statement. The new metadata attachment fails that structural rule despite still calling the same final workout compiler. It is an ownership-location disagreement, not proof of harmful workout changes. Reconcile the new metadata placement with the existing single-reader design rather than deleting the guard to make it green.
- The settings test has **eight failed assertions out of 183**. One is the concrete cross-week change above. The “equipment change must change the week” cases need to first prove that the affected equipment is used. Its Leg Press return case reaches no recorded Leg Press load and no returning Leg Press; three red assertions there do not establish loss of a real recorded load. Two completion assertions read 12 required vs 10 recorded strength sessions after a scripted missed session; that remains an accounting/fixture reachability investigation, not proven history deletion.

Direction: strengthen/rebind these existing witnesses to their current approved questions, not build a new framework. Preserve negative tests and historical evidence. Acceptance: each witness states the real subject it reached, fails when that behaviour breaks, and makes no success claim about a later stage it did not execute. For completion, compare required dated sessions, actual completed strength outcomes, omissions and logging failures individually before changing any denominator.

### 6. The year-difference tool is not reproducible from tracked source alone

**Confirmed tool dependency.** `scripts/run-programming-selection-trace-year.cjs:17–20` reads `outputs/release-candidate-0bcc3353-rcsteps/current-shoulder-review/generate-year.cjs`. `git ls-files --error-unmatch` confirms that driver is untracked. The wrapper also rewrites exact source strings in memory. A clean clone or cleanup of outputs would remove an input needed by `year:diff`. The tracked compiler-year runner is a separate instrument and does not erase this issue.

Direction: preserve this driver as ordinary tracked test/tool source, or make the difference tool consume the existing tracked annual runner's equivalent data. Prefer one supported runner over additional wrappers. Preserve the lived events, output meaning and baseline counts; verify equivalence before retiring anything. Acceptance: a clean checkout with dependencies can reproduce the difference report into a fresh output folder without any old output directory. Never let ordinary diff execution delete another audit's evidence.

### 7. Current navigation notes lead reviewers toward retired work

**Confirmed documentation discrepancy.** The branch, auth, mutable Coach and typecheck-backlog examples in Section 1 are wrong for this checkout. Home's dormant Classic implementation and retained old account types/dependencies make a filename-only inspection even more misleading. This costs investigation time and invites fixes to code the athlete never reaches; it is not proof that two active account/program systems are fighting.

Direction: update the existing current-entry pointers and architecture map after this inspection is approved, marking historical descriptions in place. No new registry or governance system. Preserve signed rulings and history. Acceptance: following the entry documents reaches the actual branch/status owner, mounted screens, local-only storage and current release/Coach boundaries without needing archived audits to disprove them.

## 6. Sound areas to preserve

- **Input persistence and shared reconstruction.** `projectProgramPersistedInputs` is an explicit durable boundary; current output views are rebuilt. Annual and settings restart checks give this design real evidence. Do not solve the rest-reason gap by persisting entire generated weeks again.
- **Canonical local generation.** The full compiler has an identifiable entry and shared selection/progression owners. Initial generation, source facts and replay reuse them. Preserve that direction rather than add a parallel V3 builder.
- **Forward-only injury changes and accepted history.** Current recomposition and annual journeys exercise these; the old “injuries never re-plan” explanation should stay withdrawn.
- **The Coach's limited authority.** Read-only response/action guards, reduced payload, no raw conversation logging in the traced client, and durable spend-limit support are useful boundaries. Stale knowledge needs repairing without expanding AI authority.
- **Recorded-load/estimate separation.** The 1RM and progression chain passes, including rejected incomplete inputs and saved evidence. Do not make estimated maximums overwrite actual recorded training.
- **Real action/restart test helpers.** They cover meaningful lived states and expose the scope issue. Preserve these helpers while correcting assumptions in individual cases.
- **Current type checking is clean.** Product, development tools and tests all returned zero diagnostics. The old “green only because of hundreds of tolerated errors” criticism is unsupported here.
- **Planned or deliberately absent features are not defects.** No account/subscription/native Journal is required by the current local-only scope. Missing demo footage has explicit handling. Unwired assessment-session/pairing capabilities named by the annual runner are not certified here and should not silently become scope.

## 7. Commands, outcomes and limits

No command used production storage or a paid provider. Scripts were inspected for output writes, mutation helpers and network behaviour before execution. Local action tests use independent in-memory storage. Existing mutation helpers compile altered source strings into isolated modules or replace functions temporarily in the test process; they do not edit checkout files.

| Command / existing instrument | Current result | What it establishes |
| --- | --- | --- |
| `git status --short`, branch/HEAD/log, `git diff --stat 5b9210ad..HEAD` | State and arithmetic in Section 1 | Exact local review target; not deployment state. |
| `npm run test:compile` | 0 product, 0 devtools, 0 test diagnostics; exit 0 | All three configured compiler scopes. |
| `npm run test:injury-authority` | 26 scenario verdicts pass; exit 0 | Includes G2–G4/G7/G9 and I6. Assertions have the limits described above. |
| `npm run test:injury-recomposition` | 186 assertions pass; exit 0 | Real injury changes, rows, clear/restart and rollover samples. |
| `npm run test:rest-day-reason` | 19 assertions pass; exit 0 | Copy/lookup/source structure, not full user flow. |
| `npm run test:dev-e2e-seeds` | 109 assertions pass; exit 0 | Builds seeds and checks witnesses; no simulator install. |
| `TZ=Australia/Melbourne node -r sucrase/register src/__tests__/canonicalWeeklyCompilerSliceTests.ts` | 10,615 pass / 5 fail; exit 1 | Direct first suite of the canonical npm chain. Following `&&` suites not implied. Four limited-kit cases plus wrapper ownership. |
| `npm run test:settings-persistence` | 175 pass / 8 fail; exit 1 | Fresh/lived settings, accepted edits, scope, history and isolated reopen. |
| `npm run test:coach-chat-integration` | 63 pass / 1 fail; exit 1 | Mocked transport and response/rate limits; six-source bundle equality fails. |
| `npm run test:estimated-1rm` | 34 tracked-anchor + 181 estimate + 48 Progress + 37 wiring + 54 effort assertions pass; exit 0 | Five constituent suites, not 354 distinct athletes. Saved evidence/ownership, no scientific or visual certification. |
| `node scripts/release-gate.js --list` | 34 current contract entries selected; exit 0 | Lists coverage only. Does not run release gate. |
| `node scripts/run-programming-selection-trace-year.cjs --output=/private/tmp/lfa-inspection-20260906-year` | Two distinct athletes × 52 weeks complete; 52 successful reopen comparisons each; exit 0 | Experienced male/female, six available days then five in-season, commercial kit, two club nights. 12 Off-season + 16 Pre-season + 24 In-season weeks; 25 actions and 314 recorded days per athlete. Includes injuries, illness, tiredness, byes, Sunday games and phase changes. |
| Existing `summariseYearDirectory`, `diffAthlete`, `render` called read-only on that output | Male 1,706 printed rows; female 1,700 printed rows; no differences from current baseline | Counts printed year-summary rows, not sets, unique exercises or clinical quality. No projection errors in the 728 sampled day records. Does not count rest explanations. |
| Existing `compilerYear/run.runAthlete` invoked with isolated memory, 52 weeks each for `male-2-novice-home` and `female-5-home` | Both reach 52 measured weeks, 52 restarts and no failed check records; invocation exits 0 | Male novice: 228 logged sessions / 5 recorded actions; female home-kit: 315 logged sessions / 7 recorded actions. Adds low availability, home kit and training-age contrasts; no full 416-week gate claim. |
| Inline calls to existing showcase/overlay constructors and production injury/reopen helpers | Reason loss confirmed; live probe did not reach the phone's empty Thursday | Exact scope in Section 3. No new persisted test fixture or audit framework. |

Commands intentionally not run: ordinary `year:diff` deletes/recreates `outputs/year-diff`; `test:compiler-year` writes `outputs/compiler-year-acceptance`; full `test:release` reaches output-producing work and a directly measured failing canonical slice. Their safe constituent/alternate-output executions are named above. `qa:audit-flows` reseeds the shared simulator, conflicting with this task. No build or native reset was attempted. No baseline-update flags were used.

Temporary logs: `/private/tmp/lfa-inspection-compile.log`, `-injury-authority.log`, `-injury-recomposition.log`, `-canonical.log`, `-settings.log`, `-coach.log`, `-1rm.log`, `-rest-path.log`, `-contrasting-years.log`, and `/private/tmp/lfa-inspection-20260906-year.log`. These are working evidence; this report preserves conclusions because temporary files may later disappear.

## 8. Three best next tasks

These are recommendations for Sam's approval, not instructions already started.

1. **Close the current program-integrity failures.** Proposed owner: next implementation agent. Start with the one-session equipment → later-week drift and the four limited-kit coverage cases. Use existing action journeys to identify the actual owner, preserve approved programming, and separate stale assumptions from genuine missing coverage. Acceptance: only governed dates change; required safe coverage or an approved reduction is explicit; accepted history/loads survive clear, Undo and reopen; relevant current release witnesses pass. Do not rebuild the whole app or change test expectations to match unexplained output.
2. **Finish the empty-day explanation through the actual final day.** Proposed owner: next implementation agent. Carry accurate reason/context through the existing effective-state path, account for later refill/clear and all approved causes, and retain current copy until Sam approves any context-safe wording adjustment. Acceptance: a local journey actually reaches an empty affected day and shows the correct reason after change and reopen; an ordinary/restored/refilled day has the correct default or no empty-day explanation. Then obtain native verification before asking Sam for final physical acceptance.
3. **Make the existing verification and Coach reference chain reliable.** Proposed owner: next tooling/Coach agent. Refresh and gate the existing Coach bundle, preserve the year driver in tracked source or consolidate it into the tracked runner, and rebind the identified misleading witnesses. Acceptance: a clean checkout can run the same evidence tools; stale Coach sources block the appropriate release path; tests prove their named behaviour; current entry docs describe the actual runtime. No additional governance framework.

## Review completion

All launched processes finished and their exit statuses were collected. The annual sample comprises **208 measured athlete-weeks across four distinct synthetic athletes**, with **208 successful reopen comparisons**. Two use the preserved lived-year display driver; two use the tracked compiler-year runner. Those instruments have different event sets and verdicts, so their results are not presented as a single full-release acceptance score.

Final `git status --short` differs from arrival only by this new report path at its displayed tracked/untracked-path level. HEAD remains `8d06bbde17390aa6532b9eabb3cfbb68294e1dc5` on `integrate/2026-09-04-morning`. The sole pre-existing tracked diff remains `docs/NOW.md` (5 additions / 5 removals); its diff SHA-256 was `a1e5422e6d8b046d8aa6595dea173f19cd3f7971e657a6665af2a30c780ecae9` at the pre-report and final comparisons. No other tracked file changed. Existing untracked directory contents were not byte-inventoried; no command intentionally wrote into them. No baseline, test, application, dependency, configuration or database changes were made. No fixes were started.

## NOT COVERED

- Physical iPhone, native cold install/onboarding taps, OS process death, layout, drag behaviour, keyboards, animations, accessibility, notifications and video playback.
- Production Coach deployment, real AI quality, network timeout behaviour against a real provider, live rate-limit/RLS configuration, billing or account migration.
- Every supported athlete/equipment/injury/fixture combination; annual sampling and many passing assertions do not establish exhaustive coverage.
- Full `test:release`, full eight-archetype `test:compiler-year`, the entire diagnostic/Bible fleet, independent historical control runs, or Claude's other reported red suites.
- Independent validation of conditioning spreadsheet cells, the injury workbook, all approved copy, medical/scientific policy, or store-publishing compliance.
- Root cause and persistence of the observed cross-week equipment drift beyond the current before/after journey; block-completion denominator discrepancies; the phone's exact empty-day state. These remain explicit next checks, not quiet passes.
