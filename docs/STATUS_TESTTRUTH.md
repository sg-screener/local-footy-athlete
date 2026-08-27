# STATUS — TEST TRUTH

Owner: `testtruth`

## 2026-08-27 — step 1: red tests no longer author product changes

Scope is test tooling only. The scheduler/compiler files already being edited by
another seat are untouched.

### Two options weighed

1. Incremental: keep reading red lists by hand and annotate individual failures
   in reports. This preserves the second, drifting list and still lets an old
   assertion be mistaken for a product instruction.
2. Source-of-truth redesign: derive the fleet from `test:bible`, automatically
   classify structural faults, and require a small evidence-bearing decision
   before any failed assertion may direct a product-code change.

Option 2 landed. There is one empty decision register ready for the actual
census; it does not pretend any of the old failures have already been reviewed.

### What the first run measured

Instrument: `npm run audit:test-truth -- --failures
.sweep/fails-audit-2026-08-27-postfix.txt`.

- 353 chain units: 352 `npm run` units plus the leading Bible conformance unit.
- 167 failure-label records from that saved sweep.
- 2 records are missing commands, 2 are aggregate runners, and 163 are
  unreviewed assertion failures.
- 0 of those 167 failure records currently has authority to direct a product
  change. This does not say none is a real product defect; it says none has yet
  paid for that claim.
- 6 distinct test files remain unrunnable, held by the existing ratchet that is
  now part of the same first gate.

### Guard and liveness

`npm run test:test-truth`: 11/11 new cells green, followed by the existing
unrunnable-suite ratchet at 4/4. The truth audit is the first unit in the
official Bible chain. Its mutation arm adds a nonexistent chain command to an
in-memory copy of the real package and observes the audit turn red with the
exact new command named. A second negative control attempts to promote an
unreviewed failure without product, contract and witness receipts and is
refused; a positive control carrying all three is accepted.

### Wider gates observed, not repaired

- `npm run test:compile`: 470 errors in its instrument (25 product, 49 devtools,
  396 tests), red on 63 worsened file/scope pairs. The new test-truth file is not
  among them.
- `npm run test:repo-law-guards`: 52/63 cells green, 11 red; every named red is
  pre-existing repo/report/flow/writer/anchor debt and none names this unit.
- `npm run test:totals-or-red-law`: 1/4 cells green; the new suite is armed and
  is not in any of its three failure lists.
- `npm run test:bible-anchors`: 292/295 cells green, 3 red; none names this unit.

### North star and visibility

Neutral on stored product state: no athlete decision, fact, result or derived
program shape changed. This makes verification converge on one derived list
instead of creating another hand-copied fleet. **NOT-VISIBLE:** this is test
infrastructure; there is deliberately no app or simulator change.

### NOT COVERED

- The 163 unreviewed failures are not yet classified as KEEP / REWRITE / DELETE;
  that is step 2.
- The two missing commands, two aggregate runner entries and six unrunnable
  files are named but not repaired or removed.
- No product code, weekly compiler, coach behaviour, UI, simulator or physical
  iPhone path was changed or tested.
- The full Bible chain was not claimed green; it remains structurally invalid
  and broadly red beyond this first gate.

## 2026-08-27 — step 2: the saved red fleet is classified

### LOOP CHECK

This is the second sighting of old red suites being mistaken for instructions
to restore old product behaviour. Step 1 stopped that authority leak. Step 2
compresses the saved failure set into an executable decision register so the
same failures cannot be reinterpreted from scratch by the next seat.

### Two options weighed

1. Incremental: delete every currently red test or edit its expected values
   until the chain turns green. This would erase useful subjects and make test
   output dictate the product again.
2. Ownership redesign: run the entire saved red set at one stable checkpoint,
   classify the evidence before changing a test, retire only suites whose
   production owner is gone, and keep every surviving subject explicitly red
   for rewrite against the current compiler.

Option 2 landed. The classifier is deliberately conservative: an assertion
failure is a `rewrite_test` until a production path, current contract and
witness prove it is a `current_contract`.

### Stable census and exact units

Instrument: `TEST_TRUTH_CENSUS_REPO=/tmp/lfa-testtruth-census.qF9Bfg node
scripts/test-truth-census-runner.js --failures
.sweep/fails-audit-2026-08-27-postfix.txt --out
/tmp/testtruth-census-aa2167e2.json --jobs 4 --timeout-ms 180000` against a
clean detached `aa2167e2` tree. The checkpoint stayed unchanged for the run.

- 167 distinct saved failure labels.
- 136 reached assertions or a later runtime failure.
- 13 died at startup; 11 died at another runtime seam.
- 2 are green now and carry current-contract receipts.
- 1 printed its assertions and then held an open handle for 180 seconds.
- 2 were aggregate runners, and 2 were missing command aliases.

The reviewed decision register has 175 distinct command rows: the 167 saved
labels, the two corrected canonical commands, and six test files that formerly
had no command. Its disposition is 166 `rewrite_test`, 2 `current_contract`, 2
`retire_test`, 3 `test_infrastructure`, and 2 `aggregate`.

The six formerly unreachable suites now all execute as commands: one startup
failure and five assertion/late-runtime failures. They remain rewrite work and
cannot direct product changes.

### Removed only when the owner was actually retired

- `coachPromptContractTests.ts` asserted the deleted static `SYSTEM_PROMPT`.
  Current ownership is retrieved canonical knowledge plus the automatic coach
  response contract (`test:coach-chat-integration`, `test:coach-lab`).
- `persistentInjuryStateTests.ts` asserted the retired `activeInjury` snapshot
  and read-time injury filtering. Current ownership is injury episodes plus the
  fallback journey and latest-severity authority
  (`test:injury-fallback-journey`, `test:injury-latest-severity`).

The retirement guard refuses a row while its old file still exists or when it
does not name existing replacement commands. The current replacement fleet is
not claimed green: Coach Lab and latest-severity are green; Coach integration
has 1 generated-artifact parity failure; injury fallback has 27 failures.

### Test infrastructure repaired

- The two missing aliases now point at the existing canonical commands:
  `test:exposure-engine` and `test:in-season-midweek-row`.
- Recursive `test:bible:parallel` and `test:bible:serial-set` entries were
  removed from inside `test:bible`; the commands remain available as tools.
- Six unowned test files received commands, taking the runnable-suite ratchet
  from 6 files to 0.
- The parallel runner's wall-clock detector no longer mistakes strength copy
  containing “hard ceiling” for a timing assertion. Its mutation self-check is
  2/2 and its derived list is 349 units.

### Verification

- `npm run test:test-truth`: 14/14 census/authority cells and 5/5 runnable-suite
  cells green.
- `node scripts/test-truth-audit.js --failures
  .sweep/fails-audit-2026-08-27-postfix.txt`: 167/167 reviewed; 2 may direct
  product changes; 0 missing commands; 0 recursive aggregates.
- `node scripts/bible-runner.js --self-check`: 2/2 green.
- `node scripts/bible-runner.js --list`: 349 derived units, exit 0.
- `npm run test:repo-law-guards`: 52/63 green, 11 pre-existing repository debts;
  removal of the obsolete coach-prompt suite lowered its anchor-debt registry.
- `npm run test:totals-or-red-law`: 1/4 green; its three fleet-wide debts remain.
- `npm run test:compile`: 473 recorded errors and 63 regressed file/scope pairs
  across the shared dirty tree. The new test-truth file was fixed to zero
  TypeScript errors; no baseline was rewritten around the wider failures.

### North star and visibility

No product behaviour, athlete fact, accepted week or UI was changed. The
change removes dead test ownership and makes every remaining old failure name
what it is allowed to influence. **NOT-VISIBLE:** this is test architecture;
there is deliberately no simulator or phone change.

### NOT COVERED

- The 166 rewrite rows have been classified, not individually rebuilt. Their
  subjects remain work for the compiler/test migration stage.
- `test:stage-b-generation-differential` still retains an open handle after its
  assertions; it is named test-infrastructure debt, not repaired here.
- The full `test:bible` chain is not green and no such claim is made.
- The wider repo-law, totals-or-red, typecheck, Coach integration and injury
  fallback failures named above were measured but not silently fixed.
- No product code, weekly compiler, coach behaviour, UI, simulator or physical
  iPhone path was changed or tested.

## 2026-08-27 — step 3: one small green release gate

### LOOP CHECK

This is the third sighting of a test list acquiring authority because it is
large rather than because its members are current. The compression is now
mechanical: release authority is derived from validated `current_contract`
rows, while the 349-unit Bible fleet remains diagnostic evidence.

### Two options weighed

1. Incremental: write a new three-command shell chain. It would be green today,
   but it would immediately become another list that can drift from the census.
2. Source-of-truth redesign: keep one bootstrap command, derive every product
   witness from the existing validated decision register, and refuse the gate
   before execution if any promoted row lacks its production path, current
   contract and witness receipts.

Option 2 landed as `npm run test:release`. The agent command table names it as
the release gate and explicitly names `test:bible` as historical diagnostic
evidence with no release authority.

### Gate shape and guard

The gate currently derives three executable units:

1. `test:test-truth` — validates the census, release-gate architecture and
   runnable test roster.
2. `test:deriving-device-commit` — the first validated current product witness.
3. `test:fact-horizon` — the second validated current product witness.

`releaseGateContractTests` has 11 cells. It proves the command has one owner,
the agent instructions point to it, all current contracts enter automatically,
all rewrite/retirement/tooling/aggregate rows stay out, and execution stops on
the first red. Its mutations remove the documented command, promote an old red
without evidence, substitute release itself as a witness, redirect release to
the diagnostic fleet, and inject a red second unit; each mutation is detected.

The governing row is
`LAW-release-gate-runs-only-validated-current-contracts`, guarded by the
in-fleet `test:test-truth` bootstrap. No hand-written product-suite list was
added.

### Verification

- `npm run test:release`: 3/3 derived units green and
  `RELEASE_GATE_EXIT=0`.
- Bootstrap: 14/14 test-truth cells, 11/11 release-contract cells and 5/5
  runnable-roster cells.
- Product witnesses: 9/9 deriving-device invariants and 14/14 durable-horizon
  invariants.
- `npm run test:law-registry`: the new law row is well formed, its guard exists
  and its in-chain declaration is truthful. The suite remains red on three
  inherited fleet-wide debts: one missing guard command, LR-18 without a law
  row, and 21 older UNENFORCED laws.

### North star and visibility

This removes a second release-authority list rather than adding one. Promoting
a compiler slice later is a census decision with receipts, and the gate picks
it up automatically. **NOT-VISIBLE:** no product behaviour or athlete screen
changed.

### NOT COVERED

- The canonical weekly compiler vertical slice is not built yet; it is the next
  unit.
- The 349-unit diagnostic fleet remains broadly red and is not claimed green.
- The gate currently covers two current product contracts, not the whole app.
- Full-year archetypes, rival-author deletion, derived-output-writer counts,
  simulator and physical-iPhone acceptance are not part of this step.

## 2026-08-27 — step 4: first canonical weekly compiler slice

### Two options weighed

1. Incremental: put a `compileWeek` name around `buildGeneratedMicrocycles`
   while leaving its initial-plan prebuild, two scheduler runs per actual week,
   and downstream conditioning rewrite intact.
2. Ownership redesign: add one pure typed orchestration boundary, route every
   live schedule/materialise/connect call through it, consume that exact schedule
   during composition, remove the initial prebuild from product generation, and
   make the retained adapter stand down after the compiler owns conditioning
   feasibility.

Option 2 landed. The scheduler and specialists keep their existing policy jobs;
the compiler owns their ordering and the one output passed downstream.

### Exact first slice

The slice is one ordinary, healthy, full-commercial-gym Off-season athlete:

profile/availability -> scheduler inputs -> one schedule -> specialist content
-> connected coaching plan -> conditioning feasibility -> composed workouts ->
generated-week validation -> accepted-state transaction -> visible resolver.

The product generator no longer calls `buildInitialGeneratedCoachingPlan` before
building the block. Each actual week is scheduled once. Diagnostics and prompt
previews still use `buildInitialGeneratedCoachingPlan`, but that function itself
now enters the canonical compiler instead of carrying a private orchestration.

The retained workout adapter used to call conditioning feasibility again over
the compiler result. `conditioningFeasibilityResolved: true` is now a typed
writer/reader handover: the generator writes it, the adapter reads it, and the
compiler witness holds both. A deload intentionally does not take this shortcut
yet because its category transformation is the next fact family, not part of
the healthy slice.

### Ownership counts and liveness

Instrument unit: distinct production source files containing an executable call
site, excluding the function declaration and all tests.

- `scheduleWeek`: 1 caller / 1 distinct file —
  `src/rules/canonicalWeeklyCompiler.ts`.
- `materialiseAuthoredSessions`: 1 / 1 — the same compiler.
- `scheduleToCoachingPlan`: 1 / 1 — the same compiler.
- Rival author count for those three stages inside this slice: **0**.
- Downstream healthy-slice conditioning-plan writers after the compiler: **0**;
  the retained adapter reads the typed handover and stands down.

Mutation: replacing the compiler's scheduler call makes the ownership census
report zero callers and turns the named cell red. Removing the adapter handover
marker kills its ownership cell.

### Verification

- `npm run test:canonical-weekly-compiler`: 18/18 green. The journey enters
  through production onboarding, advances the accepted revision, carries an
  exposure contract, authors real rows, and visible exercise prescriptions are
  exactly equal to accepted prescriptions.
- `npm run test:weekly-scheduler`: scheduler 102/102; generated fixture ownership
  11/11; travel zero-equipment 10/10; Off-season continuity 9/9; spare-day
  options 20/20.
- `npm run test:test-truth`: 14/14 census, 11/11 release architecture and 5/5
  runnable-suite cells.
- `npm run test:release`: 4/4 derived units green and
  `RELEASE_GATE_EXIT=0`; the compiler witness entered automatically as the third
  validated current contract.
- `npm run test:law-registry`: the new compiler law is well formed, its command
  exists and its chain membership is truthful. The gate remains red on the same
  inherited missing `test:game-feedback`, LR-18 and 21 UNENFORCED-law debts.
- `npm run test:totals-or-red-law`: the new suite is armed and clears correctly;
  the gate remains 1/4 on its inherited fleet-wide lists.
- `npm run test:compile`: 468 recorded errors and 62 worsened file/scope pairs
  in the shared dirty tree; none names the compiler module, generator, handover
  type or compiler witness. The gate remains red on concurrent/inherited files.

### North star and visibility

The source-of-truth direction improved: the same compiler-authored schedule now
feeds validation, accepted state and the visible read for the first slice. This
is a product-generation architecture change with no intended copy or UI-layout
change. **WORKING at guarded headless scope; physical-phone acceptance is not
claimed.**

### NOT COVERED

- Fixture, readiness, illness, injury, travel and athlete-edit fact families
  still need to move through this compiler one family at a time.
- The old dead `coachingEngine.buildWeeklyPlan` body still exists with zero
  production callers. It is retirement debt, not an author in this slice.
- Deload conditioning still re-enters feasibility after its category transform;
  that is explicitly outside the healthy slice.
- Full-year archetype acceptance, global rival-author/output-writer zero counts,
  pixels, simulator and physical iPhone are not covered.

## 2026-08-27 — step 5: readiness is the first complete fact family

### Two options weighed

1. Incremental: leave readiness as a flag interpreted independently by the
   scheduler-input translator, generator and retained workout adapter, then add
   a compiler marker so those answers are expected to agree.
2. Ownership redesign: translate the athlete action into one typed readiness
   directive, let the compiler author schedule mode, the rolling per-day dose
   policy and the conditioning-plan transform, and delete every downstream
   readiness author in the same change.

Option 2 landed. It removes the disagreement class rather than documenting it.

### What moved, and what was deleted

The production readiness action still owns the athlete-language decision. Its
typed output now enters `compileCanonicalWeek`; raw severity does not. The
compiler alone applies low-readiness scheduling, optional-week mode, the
seven-day window, per-day strength dose and the plan-level conditioning deload
before conditioning feasibility.

The scheduler-input translator no longer reads readiness. The retained adapter
no longer has `deloadPlanEntry`, no longer receives or resolves a readiness
window, and consumes the compiler's per-day dose handover. The generator no
longer resolves that window or applies the plan transform.

Instrument unit: distinct executable production authors of this weekly
readiness family.

- Rival readiness-policy authors outside the compiler: **0**.
- Derived readiness plan writers outside the compiler: **0**.
- The existing scheduler/materialiser/connector ownership remains **1 distinct
  caller each**, all in `canonicalWeeklyCompiler.ts`.

This is a family-level statement, not the prohibited global “one owner
complete” claim.

### Tests-first and liveness

Before production changes, the expanded compiler witness printed **18 green / 7
red**: the new ownership and athlete-action cells failed against the old
architecture. After the migration it prints **36/36 green**.

The behaviour witness uses the real production door: ordinary generated week →
`cooked_week` → accepted readiness overlay → visibly reduced prescriptions only
inside the rolling window → clear that exact fact → original visible
prescriptions restored exactly. It authors real rows and proves the window
reaches a real training day.

Mutations remove the compiler scheduler call, the feasibility ownership marker
and the per-day dose handover; each kills its named cell.

### The release gate caught a real semantic collision

The first release run failed the durable fact-horizon contract: illness uses a
legacy `fatigue` transport shape with `readinessKind: 'illness'`, and the new
readiness slice initially swallowed it. That would have shortened illness's
open horizon to a readiness window and removed the illness-owned optional week.
The fix respects the typed discriminator: illness is excluded from readiness
translation and remains with the illness family until that slice moves.

### Verification

- `npm run test:canonical-weekly-compiler`: **36/36**.
- `npm run test:readiness-illness-law`: **121/121**.
- `npm run test:fact-horizon`: **14/14**.
- `npm run test:release`: **4/4 units green**, `RELEASE_GATE_EXIT=0`.
- Adjacent scheduler group: scheduler **102/102**, generated fixture **11/11**,
  travel zero-equipment **10/10**, Off-season continuity **9/9**, spare-day
  options **20/20**.
- `npm run test:compile`: inherited/shared fleet remains **468 errors** and red;
  none of this slice's changed compiler, generator, adapter, policy or witness
  files appears in the worsened list.

### North star and visibility

Readiness is now one compiler-owned fact family, with one typed input and one
accepted output. This changes generated prescriptions but adds no UI or copy.
**WORKING at guarded headless scope; physical-phone acceptance is not claimed.**

### NOT COVERED

- Illness remains deliberately separate and is the next clean family candidate.
- Fixture, injury, travel and athlete-edit families have not moved.
- The global rival-author and derived-output-writer counts are not zero and are
  not claimed zero.
- Full-year archetype acceptance, pixels, simulator and physical iPhone are not
  covered.

## 2026-08-27 — step 6: illness is the second complete fact family

### Two options weighed

1. Keep the combined `weekMode` / `weekDeloaded` compatibility outputs and let
   generation, the retained adapter and the visible reader repair one another.
2. Translate the strongest active illness fact once, pass its typed two-flag
   directive into the compiler, and delete every later illness author in the
   same change.

Option 2 landed. The compiler now owns both illness consequences: dose reduction
for moderate/severe illness, and optional sessions for severe illness.

### Ownership result

Instrument unit: distinct executable production authors of weekly illness dose,
mode or optionality.

- Rival illness authors outside the compiler: **0**.
- Production callers of the retired illness-mode selector: **0**.
- The combined compatibility outputs, generator illness policy, retained
  adapter illness door, derived-contract illness rewrite and session-view
  illness rewrite were removed.

This is an illness-family result only. It is not the prohibited global
one-owner-complete claim.

### Tests-first and the real action journey

Before production changes, the expanded compiler witness printed **46 green / 11
red**. After migration it prints **60/60 green**.

The witness cold-starts a real in-season athlete, then uses the production action
and accepted-overlay transaction for mild, moderate, severe and clear. Mild is
record-only and leaves the visible week exact. Moderate reduces real prescribed
sets while preserving the normal contract. Severe preserves offered sessions,
makes every surviving session optional, and authors the optional-week contract.
Clearing each exact fact restores the original visible prescriptions exactly.

The first version of this witness inspected the immutable base microcycle after
the action. It correctly stayed normal: accepted fact mutations live in the
week-scoped overlay. The instrument was corrected to inspect the accepted
overlay rather than treating the right base behaviour as a product failure.

### Verification

- `npm run test:canonical-weekly-compiler`: **60/60**.
- `npm run test:readiness-illness-law`: **121/121**.
- `npm run test:illness-recovery-mode`: **17/17**.
- `npm run test:fact-horizon`: **14/14**.
- `npm run test:deload-law`: **68/68**.
- Adjacent scheduler group remains green, including scheduler **102/102** and
  spare-day options **20/20**.
- `npm run test:release`: **4/4 units green**, `RELEASE_GATE_EXIT=0`.
- The repository-wide typecheck remains inherited red; raw typecheck output has
  no error in any file changed by this slice.

### NOT COVERED

- Fixture, injury, travel, athlete-edit and scheduled-deload families have not
  moved.
- Global rival-author and derived-output-writer counts are not zero and are not
  claimed zero.
- Full-year archetype acceptance, pixels, simulator and physical iPhone are not
  covered.

## 2026-08-27 — step 7: fixtures and games are the third complete fact family

### Two options weighed

1. Keep target-game overrides in the scheduler translator, let generation
   restate the same game fields for the connector, rebuild fixture identity when
   reading the accepted contract, and leave the transaction calling its final
   replan specialist directly.
2. Translate accepted target-week availability into one semantic fixture state,
   pass it into the compiler, and make the compiler the only owner of the
   scheduler inputs, connector fields, accepted fixture identity and final
   specialist call.

Option 2 landed. It removes four opportunities for the same game move to mean
different things.

### Ownership result

Instrument unit: distinct executable production authors of target-week fixture
identity, fixture-conditioned schedule fields or final fixture replan.

- Rival weekly-fixture authors outside the compiler: **0**.
- Production callers of the final fixture specialist: **1**, the canonical
  compiler.
- Scheduler, materialiser and connector remain **1 distinct production caller
  each**, also the canonical compiler.

The scheduler translator no longer accepts target fixture day or target-week
availability. Generation no longer restates game/club/selected-day fields into
the connector. The accepted-contract reader no longer reads calendar fixture
facts to rebuild identity. The fixture publisher no longer derives a second
contract, and the accepted transaction no longer invokes the specialist around
the compiler.

This is a fixture-family result only. It is not a claim that every compiler
family has one owner yet.

### Tests-first and the real action journey

Before production changes, the expanded compiler witness printed **66 green / 10
red**. One red was an invalid instrument assumption that Game Day needed a
particular presentation component; it was corrected to test the semantic Game
Day and zero training rows. The final witness prints **80/80 green**.

The witness cold-starts a real in-season athlete with a Saturday game. It moves
the game through the production transaction onto an occupied Wednesday. The
accepted visible Wednesday becomes Game Day with no training rows, Saturday is
no longer a game, and the accepted contract has exactly one Wednesday fixture
anchor. Moving the game back through the same door restores the complete visible
week exactly.

The Off-season acceptance cells also prove a standing game answer, released
fixture and adjacent fixture dates stay dormant. Fixture occupancy is released
back into availability, while genuine unavailable blocks remain blocked.

Mutations remove the typed fixture handover and bypass the compiler's final
specialist call; each kills its named ownership cell.

### Verification

- `npm run test:canonical-weekly-compiler`: **80/80**.
- Scheduler group: scheduler **102/102**, generated fixture **11/11**, travel
  zero-equipment **10/10**, Off-season continuity **9/9**, spare-day options
  **20/20**.
- `npm run test:fixture-identity`: **7/7**.
- `npm run test:g-plus1-dependent-week`: **3/3**.
- `npm run test:derived-week-ownership`: **6/6**.
- `npm run test:release`: **4/4 units green**, `RELEASE_GATE_EXIT=0`.
- The old `test:fixture-mutation-transaction` suite remains exactly **10/14**:
  its four pre-existing failures are unchanged. The test-truth register marks
  it `rewrite_test`, so those old assertions remain diagnostic evidence and
  cannot direct product changes.

### NOT COVERED

- Injury, travel, athlete-edit and scheduled-deload families have not moved.
- Global rival-author and derived-output-writer counts are not zero and are not
  claimed zero.
- The full-year archetype compiler acceptance gate has not been built.
- Pixels, simulator and physical iPhone are not covered.

## 2026-08-27 — step 8: injury is the fourth complete compiler family

### Two options weighed

1. Keep merging injury copy into the profile and let power, exposure-contract,
   conditioning and exercise-pool code each interpret it again.
2. Translate onboarding injuries plus accepted injury facts once into a semantic
   weekly injury state, then make every weekly specialist consume that state.

Option 2 landed. It removes the disagreement class: one policy now carries the
prohibited strength patterns, app-sprint block, lower/upper conditioning limits,
power inputs and typed exercise-pool keys.

### Ownership result

Instrument unit: distinct production sites which graduate raw injury severity,
infer a weekly restriction from body-area copy, or write the injury-derived
weekly contract outside the compiler.

- Rival weekly-injury authors in the guarded production path: **0**.
- Conditioning severity/body-area classifiers outside the semantic state: **0**.
- Exposure-contract severity/body-area classifiers outside the semantic state:
  **0**.
- Contract v2 receives its injury policy from the compiler; it no longer stays
  healthy while the visible rows are injured.
- The existing session-level injury recomposition specialist remains intact. It
  answers which rows are swapped/withheld; it does not author weekly policy.

### Tests-first and findings caught before acceptance

The first expanded run stopped red because the semantic state did not exist.
After the first implementation it printed **86 green / 3 red**. The real action
journey then found two additional product defects:

1. Contract v2 was never given the compiler's injury policy, so a 7/10 knee
   changed visible rows while the accepted contract still published zero
   prohibited patterns.
2. onboarding generated the healthy block but did not record its exercise
   selections. The first later temporary injury replay therefore became the
   first selection-history author; clearing the injury kept its Hamstring Curl
   substitute instead of restoring Single-Leg RDL.

Both are now closed. Onboarding and an athlete-requested rebuild explicitly
author block selections. The witness cold-starts a real athlete, reports a 7/10
knee through `set_injury_modifier`, observes one semantic policy and the accepted
contract agree on squat/hinge plus app-sprint restrictions, verifies unaffected
work remains, clears the exact episode, and gets the original visible week back
byte-for-byte.

Mutations remove the compiler injury handoff and the separate Contract-v2
handoff; each kills its named cell.

### Verification

- `npm run test:canonical-weekly-compiler`: **102/102**.
- `npm run test:injury-latest-severity`: **48/48**.
- `npm run test:injury-recomposition`: **41/41**.
- `npm run test:off-feet-walking`: **6/6**.
- `npm run test:release`: **4/4 units green**, `RELEASE_GATE_EXIT=0`.
- `test:section18-v2` is independently unrunnable because its imported
  `src/utils/section18ProgramObservation` module is absent. Per the test-truth
  rule, that obsolete diagnostic did not direct product changes.
- The repository-wide typecheck remains red from shared/inherited files. Raw
  compiler output reports no error in any product file changed by this slice.

### NOT COVERED

- Travel, athlete-edit and scheduled-deload families have not moved.
- Global rival-author and derived-output-writer counts across those unmigrated
  families are not zero and are not claimed zero.
- The full-year archetype compiler acceptance gate has not been built.
- Pixels, simulator and physical iPhone are not covered.

## 2026-08-27 — step 9: availability is the fifth complete compiler family

### Two options weighed

1. Keep travel, club closure, explicit unavailability and dated-equipment
   interpretation split across the scheduler translator, fixture translator,
   profile translator and generator.
2. Translate accepted availability facts once into a semantic weekly state,
   then let the compiler project that state into scheduling, coaching,
   conditioning and composition.

Option 2 landed. One `CanonicalWeeklyAvailabilityState` now answers what the
athlete can attend and what equipment they can reach for each date in the week.

### Ownership result

Instrument unit: distinct production sites that independently interpret a
weekly travel, club-closure, explicit-unavailability or dated-equipment fact.

- Rival weekly-availability authors in the guarded generation path: **0**.
- Scheduler, materialiser and connector remain **1 distinct production caller
  each**, the canonical compiler.
- The scheduler translator no longer reads active constraints.
- The fixture translator no longer removes away fixtures itself.
- The profile translator no longer removes club or game days from travel spans.
- Generation no longer owns a second dated-equipment window or club-closure
  span translator.

This is an availability-family result. Global rival-author zero is not claimed
while athlete-edit and scheduled-deload families remain outside the compiler.

### Tests-first and the real action journey

The ownership block first printed ten red cells before the semantic state and
handoffs existed. The first journey instrumentation also exposed a temporal
dead-zone error in the test itself; that was corrected before reading product
behaviour. The final witness prints **125/125 green**.

The witness cold-starts a real in-season athlete, commits a Wednesday-to-Sunday
trip through the production schedule door, and observes club and game anchors
removed only inside that span while the athlete's own work remains. It then
commits reduced equipment for the same dates through the production equipment
door. Days before the fact remain exact, governed output changes, and real
training remains available. Resolving both exact source facts and settling the
derived world restores the complete visible week byte-for-byte.

Separate semantic cells prove the important non-equivalence: a club shutdown
removes team nights but preserves a game the athlete entered, while an explicit
unavailable date blocks only its own weekday. Mutations remove the generator
handoff and bypass the compiler projection; each kills its named cell.

### Verification

- `npm run test:canonical-weekly-compiler`: **125/125**.
- Scheduler group: scheduler **102/102**, generated fixture **11/11**, travel
  zero-equipment **10/10**, Off-season continuity **9/9**, spare-day options
  **20/20**.
- `npm run test:dated-equipment-fact`: **3/3**.
- `npm run test:generated-week`: **36/36**.
- `npm run test:release`: **4/4 units green**, `RELEASE_GATE_EXIT=0`.
- Raw typecheck output reports no error in any product file changed by this
  slice. The repository-wide typecheck remains red from shared/inherited files.
- The old away, Christmas-break, equipment-scope and conditioning-equipment
  diagnostics are classified `rewrite_test` in the test-truth census. Their old
  harness or contract failures did not direct product changes.
- The law registry remains independently red: **21 of 198 laws** are still
  unguarded, one unrelated guard names a missing script, and one chain rule has
  no registry row. This slice did not hide or expand that debt.

### NOT COVERED

- Athlete-edit and scheduled-deload families have not moved.
- Global rival-author and derived-output-writer counts are not zero and are not
  claimed zero.
- The full-year archetype compiler acceptance gate has not been built.
- Pixels, simulator and physical iPhone are not covered.

## 2026-08-27 — step 10: athlete-edit placement is the sixth compiler family

### Two options weighed

1. Keep the accepted-week, live-precedence, hydration and transaction-today
   paths applying add, swap, move and remove constraints independently.
2. Translate accepted edit records once into a semantic per-date placement
   state, then let one final-workout compiler project that state everywhere.

Option 2 landed. The incremental option would have preserved four places where
the same accepted decision could become a different visible workout.

### Ownership result

Instrument unit: distinct production sites that turn accepted athlete-edit
fields into final workout placement.

- Athlete-edit placement rival authors: **0**.
- Athlete-placement stamp writers: **1 distinct production caller**,
  `canonicalWeeklyAthleteEditState.ts`.
- Accepted effective week, live day precedence, hydration, the compatibility
  adapter and the accepted transaction's today projection all delegate to
  `compileCanonicalAthleteEditedWeek`.
- Add, swap, move-source, move-target and remove are represented by one typed
  `CanonicalWeeklyAthleteEditState` before any reader sees them.

This count is placement-specific. The transaction doors still own creation of
accepted edit facts, and contract reduction still consumes them; neither is
misreported as a rival placement author.

### Acceptance journey and liveness

The semantic compiler cells cover all four edit families. The real journey
cold-starts an Off-season athlete, removes a real training day through
`applyPlanChange`, observes the typed ledger decision plus active accepted
constraint, and sees the compiler-owned empty placement on the visible week.
Undo annuls that exact decision and restores the full visible prescription
signature byte-for-byte.

The new acceptance cells were added after the first production extraction had
already begun, so this slice does **not** claim a tests-first red count. The
guards were instead proven live with three source mutations: bypass accepted
projection, remove the compiler placement loop, and restore the old
transaction-local today projection. Each kills its named cell.

### Verification

- `npm run test:canonical-weekly-compiler`: **144/144**.
- `npm run test:placement-ownership`: **22/22**.
- `npm run test:deletion-calendar-ownership`: **4/4**.
- `npm run test:undo-reversal`: **25/25**.
- `npm run test:door-ledger-append`: **5/5**.
- `npm run test:day-precedence-ownership`: **6/6**.
- The old accepted-state, hydration, deletion, move, sequence and durability
  suites remain `rewrite_test` in the test-truth census. Their mixed fixture,
  retired-contract and real boot-replay failures were recorded but did not
  drive this placement slice.
- Repository typecheck remains red only in shared/inherited files; it reports
  no error in a file changed by this slice.

### NOT COVERED

- Add/swap **session** durability had not yet been measured on the current
  contract. The old red durability suite exercises exercise-row edits and has
  a stale onboarding fixture; it is not evidence that session edits disappear.
- Athlete-edit contract reduction has not moved into the compiler.
- Scheduled-deload is still outside the compiler.
- Global rival-author zero and full-year archetype acceptance are not claimed.
- Pixels, simulator and physical iPhone are not covered.

## 2026-08-27 — step 11: athlete-edit contract reduction joins the compiler

### Two options weighed

1. Keep `userRemovalConstraints` as the arithmetic owner and let derived-week,
   temporary-fact and fixture-repair loops call it independently.
2. Translate active accepted constraints into semantic reduction requests beside
   their placements, then let the athlete-edit compiler own the one contract
   transform while the old API becomes a compatibility delegation.

Option 2 landed. It removes the class where the same removal can be visible in
the week but interpreted differently by one of three contract consumers.

### Ownership and acceptance result

Instrument unit: distinct production call sites invoking the retired contract
reducer, plus distinct semantic compiler consumers.

- Production callers of `applyAthleteRemovalTypedReduction`: **3 before, 0
  after**.
- Contract-reduction rival authors: **0**. Derived-week contract projection,
  temporary-source-fact reconciliation and fixture repair all call
  `compileCanonicalAthleteEditedContract`.
- `CanonicalWeeklyAthleteEditState` now carries typed, week-scoped reduction
  requests using the accepted constraint id, target date and scope.
- Reduction identity now uses the exact accepted constraint id instead of
  matching prose containing a date. This keeps two removals on one date
  independently reversible; the historical deletion diagnostic gained one
  passing regression cell after the move.
- Current-contract cold-start witnesses prove session Add and session Swap each
  change a real generated week and survive process death byte-for-byte. The
  earlier session-durability concern is closed as a misclassification: the old
  red suite covers exercise-row changes, not session changes.

Tests-first ownership cells began **6 red** before the extraction. After the
move, `test:canonical-weekly-compiler` is **154/154**. Source mutations remove
the semantic request mapping, contract loop and consumer delegation and kill
their named cells.

### Verification

- `npm run test:canonical-weekly-compiler`: **154/154**.
- `npm run test:placement-ownership`: **22/22**.
- `npm run test:deletion-calendar-ownership`: **4/4**.
- `npm run test:day-precedence-ownership`: **6/6**.
- `npm run test:section18-delivered-remaining`: **8/8**.
- `npm run test:athlete-session-deletion`: historical diagnostic remains red,
  but improves from **7/24 to 8/24 regression cells**; properties remain 4/5
  and mutations 3/3.
- Repository typecheck remains red only in shared/inherited files and reports no
  error in a file changed by this slice.
- `test:derived-week-lawfulness` is blocked before the slice by a stale fixture
  missing required gender. `test:temporary-source-facts` reaches its existing
  call to the removed `migrateLegacyTemporarySourceFacts` export and stops.

### NOT COVERED

- Exercise-row add/swap/remove and their durable replay are a separate edit
  family and have not entered this compiler.
- Accepted decision-ledger replay is still procedural rather than one pure
  compiler fold.
- Scheduled-deload remains outside the compiler.
- Global rival-author zero and full-year archetype acceptance are not claimed.
- Pixels, simulator and physical iPhone are not covered.

## 2026-08-27 — step 12: exercise edits compile instead of acting again at boot

### Two options weighed

1. Keep boot re-entering `executeProgramControlAction` once for every accepted
   Swap, Add and Remove decision, relying on the live door to make the same
   choices again.
2. Translate accepted exercise decisions once into typed weekly semantic state,
   fold each ordered group through one pure compiler, and make both the live
   Swap/Add writers and derived-row readers delegate to that owner.

Option 2 landed. Startup now reconstructs accepted output; it does not pretend
the athlete tapped every exercise action again.

### Finding exposed by the pure fold

The first compiler run was correctly red. The live Swap resolved **17.5 kg**
for the replacement, but the accepted ledger action stored only name, sets and
reps. Procedural replay hid that omission by recalculating the load at startup.
The durable boundary now resolves the replacement load once and records it in
the accepted action. Boot consumes that value without guessing.

### Ownership result

Instrument unit: distinct production sites constructing final exercise rows or
interpreting accepted exercise-action kinds.

- Final Swap/Add row constructors outside
  `canonicalWeeklyExerciseEditCompiler.ts`: **0**.
- Boot calls back into the live program-control action interpreter for accepted
  exercise edits: **0**.
- Derived mobility/recovery action classifiers outside
  `canonicalWeeklyExerciseEditState.ts`: **0**.
- Current tapped Swap/Remove uses the component id. A pure duplicate-name
  witness proves that id selects exactly the intended row; names remain only as
  compatibility ingress for old accepted actions.
- Remove remains a projection through the canonical exclusion owner rather than
  being baked into the compiled override, preserving exact Restore semantics.

### Acceptance and verification

- Tests-first ownership run: red because both new compiler files were absent.
- First behavioral compiler run: **160/161**, with the one failure naming the
  missing accepted 17.5 kg load.
- `npm run test:canonical-weekly-compiler`: **166/166** after the input fix,
  missing-id refusal witness and stable added-component identity witness.
- The current-contract cold-start journey performs Remove → Swap → Add on one
  real multi-row session, proves all three coexist, kills the process and
  returns to the exact visible prescription byte-for-byte.
- `npm run test:undo-reversal`: **25/25**.
- `npm run test:injury-recomposition`: **41/41**.
- Direct `mobilityPrehabFlowTests`: **74/74**.
- `npm run test:placement-ownership`: **22/22**.
- `npm run test:day-precedence-ownership`: **6/6**.
- `npm run test:release`: **4/4 units green**.
- Repository typecheck remains red only on inherited temporary-fact union
  errors; no new compiler, boot, derived-reader or coach-action error remains.

The census-classified `rewrite_test` suite `test:program-control-decisions`
still asserts that boot must contain the procedural action-door branch this
slice deliberately deleted. `test:session-change-sequence` still boots an old
fixture into an empty week. Neither directed product changes; the current
contract acceptance journey above is the authority.

### NOT COVERED

- Non-exercise decision families still replay through their historical
  procedural interpreters.
- Exercise exclusions are still a persisted input beside their undo ledger
  record; this slice preserves that ruled owner and does not claim one global
  ledger representation.
- Scheduled-deload remains outside the compiler.
- Global rival-author zero and full-year archetype acceptance are not claimed.
- Pixels, simulator and physical iPhone are not covered.

## 2026-08-27 — step 13: whole-session edits compile from accepted effects

### Two options weighed

1. Keep boot re-entering `applyPlanChange` for every accepted Add, Swap, Move
   and Remove, asking warnings, placement and template selection to reach the
   same answer again.
2. Record the exact accepted semantic constraint delta with the decision, fold
   that typed delta through one pure constraint compiler, and use the same
   semantic staging body live and at boot to derive repair overlays and active
   restoration ownership.

Option 2 landed. Current-format boot has zero calls into the live plan-change
producer. It compiles the accepted effect, rather than pretending the athlete
tapped the action again.

### Exact ownership result

Instrument unit: distinct current-format production paths authoring the
accepted constraint state for a whole-session edit.

- Current-format boot calls into `applyPlanChange`: **0**.
- Constraint-list folds outside
  `compileCanonicalSessionConstraintEffects`: **0** in the live/boot session
  transaction boundary.
- New plan-change rows without an exact accepted effect: **0** by type and the
  only production writer.
- The accepted effect contains typed constraints, affected dates, restoration
  flips and calendar-mark deltas. It contains no guessed session label or
  exercise name.
- Repair overlays and reversible-adjustment records remain derived outputs;
  boot reconstructs them through the same semantic staging body rather than
  persisting a second snapshot.

Pre-effect ledger rows are real existing input and cannot honestly be decoded
from bytes that were never stored. They cross one named compatibility ingress:
the old request executes once, then an append-only
`legacy_plan_change_effect_upgrade` attaches its accepted semantic effect to
the original entry id. The original decision keeps its ledger position, the
metadata is never replayable or undoable, and subsequent boots are canonical.

### Acceptance and liveness

- Tests-first run: **166/171**, with all five new ownership cells red.
- The first restart expansion exposed the missing active adjustment record:
  visible Remove and Move were exact after restart, but the restoration surface
  had zero active records. The compiler now rebuilds that derived ownership.
- `npm run test:canonical-weekly-compiler`: **184/184**.
- The current-contract journey proves Add and Swap individually, Remove and
  Move with active restoration plus Undo, then composes Swap → Add → Move →
  Remove in one accumulated world, kills the process, restores it byte-exact,
  and undoes only the last action.
- A real old-format Remove row upgrades exactly once, survives a second
  canonical boot, and Undo still targets the athlete decision.
- Liveness mutation: making the upgrade metadata replayable/undoable made the
  suite red **179/181** on both the source ownership cell and the real Undo
  journey; restoring the exclusion returned **184/184**.
- `npm run test:release`: **4/4 units green**.
- `npm run test:undo-reversal`: **25/25**.
- `npm run test:deletion-calendar-ownership`: **4/4**.
- Repository typecheck is green for every file in this slice; its remaining
  errors are in concurrent temporary-fact/profile work.

The diagnostic fleet was observed, not used as a product to-do list:
`test:athlete-session-deletion`, `test:athlete-session-move`,
`test:plan-change-producer`, `test:quiescent-boot` and
`test:decision-ledger-ownership` remain red in their previously classified
historical/fixture or concurrent shared-work areas. The current release gate
and the production cold-start acceptance journey above are green.

### NOT COVERED

- Fixture decision replay is still procedural and is the next compiler family.
- Exercise exclusions remain a separate persisted input beside their decision
  ledger entry; this slice preserves that ruled owner.
- Scheduled deload remains outside the compiler.
- Full-year archetype acceptance has not yet been promoted into this gate.
- Pixels, simulator and physical iPhone are not covered.

## 2026-08-27 — step 14: fixture Add, Move and Remove compile from accepted effects

### Two options weighed

1. Keep boot replaying `fixture_add`, `fixture_move` and `fixture_remove` by
   entering `executeFixtureMutationInMemory`, relying on the current resolver
   and current recurring-game materialisation to rediscover the old result.
2. Resolve an exact typed fixture-week effect once when the decision lands,
   fold that effect through one pure calendar compiler, and make both live
   publication and boot call the same accepted-effect commit boundary.

Option 2 landed. Current-format boot does not enter the live fixture request
transaction and therefore cannot ask today's resolver to reinterpret an old
accepted decision.

### Exact ownership result

Instrument unit: distinct current-format executable boot branches and decision
writers for fixture Add, Move and Remove.

- Boot branches calling `executeFixtureMutationInMemory`: **0 of 1 boot replay
  modules**.
- Current fixture decision writers omitting `acceptedEffect`: **0 of 1 fixture
  decision writer sites**, held by the required type and source ownership cell.
- Pure ordered fixture-effect folds: **1**, in
  `canonicalWeeklyFixtureEditCompiler`.
- Live and boot accepted-effect commit boundaries: **1**, in
  `commitCanonicalAcceptedFixtureEditEffect`.
- The effect stores the complete seven-day fixture layer for its week. It does
  not store repaired sessions or an overlay.
- Repair overlays and reversible-adjustment rows remain derived and are rebuilt
  through the existing deterministic weekly-rebuild body.

The complete seven-day layer was required by the first accumulated restart
witness. Live accepted state carried only Wednesday's explicit game after a
Saturday-to-Wednesday move, while fresh boot had first re-derived the profile's
usual Saturday game. A delta containing only Wednesday therefore produced two
games after restart. Recording the accepted fixture layer clears any re-derived
fixture marks first, while preserving non-fixture calendar facts such as rest.

Pre-effect fixture rows cross one append-only compatibility ingress. The old
row keeps its original ledger position; `legacy_fixture_effect_upgrade`
attaches the accepted effect once and is neither replayable nor undoable.

### Acceptance and liveness

- Tests-first ownership run: **184/189**, with the five new ownership cells red.
- First expanded restart run: **200/201**. The one red was the portable
  Saturday-to-Wednesday move described above; the fix returned the suite green.
- Final `npm run test:canonical-weekly-compiler`: **208/208**.
- Add, Move and Remove each make a non-vacuous visible change, survive process
  death byte-exact and retain one exact Undo after restart.
- The accumulated Remove-base → Add → Move → Remove world survives restart in
  ledger order; one Undo removes only the last Remove.
- The occupied destination is a real multi-part day, and the fixture replaces
  it while active and restores it on Undo.
- `practice_match` Add uses the same typed effect and restart path.
- A real pre-effect fixture row upgrades exactly once across two boots; Undo
  still targets the athlete decision.
- Liveness mutation: replacing the real fixture-effect loop with an empty loop
  made **20 of 208 cells red**, including live verification, all three action
  families, accumulated ordering, practice match and legacy ingress. Restoring
  the loop returned **208/208**.
- `npm run test:release`: **4/4 release units green**.
- `npm run test:undo-reversal`: **25/25**.
- `npm run test:fixture-identity`: **7/7**.
- `npm run test:day-precedence-ownership`: **6/6**.
- `npm run test:placement-ownership`: **22/22**.

### NOT COVERED

- `migrated_day_placement` remains its separate legacy content ingress; this
  fixture slice did not change it.
- Scheduled deload remains outside the compiler.
- The global rival-author/derived-output-writer census is not yet run and zero
  is not claimed beyond this fixture decision family.
- The full-year archetype compiler acceptance gate is not built yet.
- Pixels, simulator and physical iPhone are not covered.

## 2026-08-27 — step 15: retired `migrated_day_placement` is one read ingress

### Two options weighed

1. Leave the retired content row inside `AthleteDecision` and make boot's
   direct `applyProgramOverrideWrite` branch quieter.
2. Remove it from the current writer vocabulary, retain it only as a persisted
   compatibility type, lift it at one named ingress into a typed accepted
   placement effect, and compile that effect at the old row's ledger position.

Option 2 landed. A current appender accepts `AthleteDecision`, whose union no
longer contains `migrated_day_placement`; the old payload remains readable only
as `LegacyMigratedDayPlacementDecision`.

### Exact ownership result

Instrument unit: distinct executable production sites, with type declarations
reported separately.

- Current decision writers able to construct `migrated_day_placement`: **0 of
  1 ledger appender boundaries**.
- Runtime interpreters of the retired payload's `date` and `workout`: **1**,
  `legacyMigratedDayPlacementIngress`.
- Boot branches directly writing from the retired payload: **0**.
- Pure typed day-placement effect folds: **1**, in
  `canonicalDayPlacementEffect`.
- Append-only placement-upgrade writers: **1**, in `decisionLedgerStore`.
- Persisted legacy type declarations: **1**, retained so old athletes remain
  readable without putting the old kind back into the current action union.

`legacy_day_placement_effect_upgrade` records the typed effect against the old
entry id. It is not replayable or undoable. Boot encounters the old row through
`bootReplayableEntries`, compiles its effect at that exact point, and appends
upgrade metadata only after the replay latch ends. The old row remains
byte-identical and stays before every decision that originally followed it.

### Acceptance and liveness

- Tests-first run: **211/219 passed**, with six ownership cells and two upgrade
  journey cells red.
- Final `npm run test:canonical-weekly-compiler`: **219/219**.
- A real old placement row is inserted before a later current-format session
  removal. On first and second restart the later removal still wins; one Undo
  reverses only that removal and reveals the older migrated workout.
- The old row is byte-identical after upgrade, retains its original index, and
  receives exactly one metadata row across repeated boots.
- Liveness mutation: replacing the real effect loop with an empty loop made
  **5 of 219 cells red** — the fold ownership cells plus first boot, second boot
  and Undo behavior. Restoring the loop returned **219/219**.
- `npm run test:release`: **4/4 release units green**.
- `npm run test:undo-reversal`: **25/25**.
- `npm run test:journal-changes`: **13/13**.
- Owned production and acceptance files report no TypeScript errors.

Observed diagnostic reds were not used as product instructions:
`test:decision-ledger-ownership` is **8/9** because four historical test files
write the store in its source census; `test:quiescent-boot` is **5/6** because
concurrent profile/coach hydration changes alter two persisted envelopes;
`test:program-control-decisions` is **9/11** because its source assertions still
expect the retired procedural exercise replay and deleted migration appender.

### Questions

- None. The persisted row contains the exact workout, date, entry id and ledger
  position needed for a deterministic lift.

### NOT COVERED

- Scheduled deload remains outside the compiler.
- The global rival-author/derived-output-writer census has not yet been run.
- The full-year archetype compiler acceptance gate is not built yet.
- Pixels, simulator and physical iPhone are not covered.

## 2026-08-27 — step 16: scheduled dose is compiler input; acceptance still partial

Owner: `testtruth`. This is user chunk 3, after fixture effects and legacy
placement ingress. **Not declared complete:** the late-Off-season lifecycle
still refuses before entering its deload. No phone build is authorised by this
checkpoint's evidence.

### Two options weighed

1. Keep the generator/adapter scheduled branch and add exceptions around
   fixture repair, restart and readiness overlap.
2. Lift the existing phase-clock answer into one exact-week typed fact, compile
   the per-date dose once, and make materialisation/progression consume it.

Option 2 implemented. The existing `DELOAD_LAW` arithmetic and the phase clock's
cadence are unchanged. This is ownership migration, not a new training policy.

### Authoritative fact and precedence

- `seasonPhaseClock.resolveSeasonPhaseWeekKind` remains WHEN: Pre-season every
  fourth phase week; Off-season only after the first four phase weeks, then
  every fourth late-phase week; no scheduled In-season deload.
- `CanonicalWeeklyScheduledDeloadState` names the exact target Monday and the
  existing semantic policy. It is derived from the persisted phase clock, not
  another mutable store or ledger action.
- `compileCanonicalWeeklyDosePolicies` chooses exactly one policy per day:
  illness, then readiness, then scheduled. Outside an applicable live window,
  the scheduled fact remains effective. No stacking of multipliers.
- Generated training consumes that output. Fixtures still own their occupied
  days; accepted edits still fold over generated training. Undo removes an
  athlete action, not the phase clock.
- Compiler-authored `dosePolicyByDay` travels with each microcycle. Fixture
  replacement materialisation consumes it, including the rejected-candidate
  repair envelope's existing base-week metadata.

### Retired authors and the defect found by extending the check

Removed the generator and retained adapter's `resolveDeloadWeekPolicy` calls,
the adapter's alternate readiness resolver, and the old scheduled fallback
handoff. Materialisers still execute the existing dose arithmetic; they no
longer decide whether a week is scheduled for deload.

The production-wide resolver scan then found **one additional distinct caller**,
`progressionRules`. Its private six-week-with-fatigue timer was removed; the
phase clock now owns scheduled cadence. A real recorded very-hard session
showed the later progression pass also changed already-deloaded rows: Leg
Press went from 2 sets at 4–6 reps/127.5 kg to 1 set at 3–4 reps/90 kg. The
progression pass now stands down on dates carrying compiler-authored dose.
Other progression decisions on ordinary build days are unchanged.

Instrument: `test:canonical-weekly-compiler`. Distinct executable production
callers of `resolveDeloadWeekPolicy`: **1**, the typed scheduled-state ingress.
Independent scheduled resolvers in the generator and retained adapter: **0
across those 2 modules**. This is NOT a global rival-author/derived-writer count.

### Acceptance, depth and liveness

- Initial scheduled ownership additions: **219/227 cells passed**, eight red.
- The expanded progression check: **238/241 passed**, three red, including
  a real recorded feedback witness (not a synthetic store seed).
- Final `npm run test:canonical-weekly-compiler`: **241/241 cells green**.
  The new Pre-season journey spans build week 3, deload week 4 and next-block
  week 1. It exercises Remove → restart → Undo, then practice-match Add onto
  an occupied day → restart → Undo. These are two distinct accepted edit
  decisions plus their reversals, not a full-year accumulated-state claim.
- The per-date overlap cell reaches all seven dates: scheduled Mon/Tue,
  readiness Wed/Thu, illness Fri/Sat/Sun.
- Mutation: removing the exact-week check from the scheduled-state reader
  produces **240/241**, with the leakage cell red. Restoring it returns green.
- `npm run test:release`: **4/4 release units green**.
- `test:deload-law`: **68/68**; `test:deload-coach-notes`: **18/18**;
  `test:strength-progression-inputs`: **18/18**.
- Production and test TypeScript checks remain globally red; neither reports
  an error in this checkpoint's changed files.

The next defect of this class is caught by the per-date precedence and boundary
cells, the real restart/Undo journeys, the progression double-dose witness and
the production-wide scheduled-resolver scan. They protect different subjects;
a single green source count is not being substituted for behavior.

### Open blocker and questions recorded, not silently waived

`npm run test:canonical-weekly-compiler -- --late-offseason` is intentionally a
still-red diagnostic. Real onboarding with the ordinary 3-gym-day athlete,
install 13 July and last game 14 June, fails in its first build week with
`required_minimum_shortfall:sprint_high_speed:0`, before reaching 3 August's
deload. Normal release execution prints this lifecycle as NOT COVERED.

Read-at-source cause: a sprint in the scheduler's primary conditioning slot
does not receive the `speedBlock` identity that a separate sprint component
receives. An experimental identity repair exposed a second disagreement:
the scheduler counts sprint toward its conditioning target but the typed speed
block carries no conditioning credit (`planner_selected_target_miss:conditioning:4`).
**That experiment was reverted.** No speed or conditioning programming change
is included in this checkpoint. The existing Bible sprint-quality distinction
and scheduler's WC-139 exposure comment need reconciling at their shared owner,
not another local identity patch. Owner for follow-up: `testtruth`.

No new deload policy answer is required from Sam (registry checked: R-034,
R-035, R-036). The question to resolve before calling this family complete is
whether the sprint and conditioning targets describe the same exposure unit;
the current two owners disagree. Re-run the red lifecycle after that correction
and move it into the always-on compiler acceptance gate.

Other diagnostic observations, not a product to-do list:

- `test:phase-clock` reaches the same sprint-credit refusal after its
  season-finish-date sub-suite; not a newly inferred deload cadence problem.
- `test:fixture-conditioned-replan`: **21/34**. Failures include restored
  semantic-fingerprint mismatches and profile inputs reaching capacity
  validation errors. They have not been triaged as regressions in this slice;
  the current real fixture journey above is this change's narrower evidence.
- Earlier `test:deload-week`: **50 passed, 9 failed**. Its January season-finish
  profile is tested as though July starts phase week 1, and it has a stale
  declared-gap expectation. It has not been rewritten to force a product fix.
- `test:law-registry`: **11/14 cells**, with 21 existing UNENFORCED rows out
  of 201 registry rows, missing historical commands and unregistered historical
  citations. The new scheduled-dose row has its in-chain guard; this does not
  turn the historical registry or diagnostic fleet green.

### NOT COVERED

- Late-Off-season full onboarding → deload → restart lifecycle: blocked above.
- Cross-week session relocation and every fixture-repair rejection combination
  have not been newly exercised; the covered transition is calendar navigation
  plus actual block rollover, and the fixture journey is an accepted Add.
- Existing optional top-up content and unrelated progression/repair families
  were not redesigned. No global zero-writer claim is made.
- Full-year archetype acceptance, simulator, UI pixels and physical iPhone.

## 2026-08-27 — step 17: executable writer census, zero NOT established

Owner: `testtruth`. User step 4 is **PARTIAL**, not complete. The user explicitly
allowed unresolved chunks to be recorded and the queue to continue. No current
author is being exempted merely to get the release gate green.

### Options compared and what landed

1. Keep a filename/regex allowlist of the obvious writers. This misses new files,
   renamed imports and delegated mutations, and would repeat the narrow-zero
   claim that prompted this work.
2. Discover executable capabilities with the TypeScript syntax tree/type checker,
   follow symbol references and import/require aliases, and require exact-body
   classification reviews. New or changed candidates fail closed.

Option 2 is implemented in `scripts/weekly-writer-census.js`. It discovers
domain object construction/assignment/returns, collection updates, reflected
writes, publication and persistence sinks, opaque mutations and possible callers.
Comments and type-only declarations are not writer occurrences. Anonymous
callbacks belong to their enclosing named executable owner. CommonJS bindings
matter here: production boot uses them, so ES imports alone were insufficient.

`scripts/weekly-writer-ownership.json` contains explicit reviews, rationales and
body-plus-callee fingerprints. It is not a filename whitelist. A changed body,
missing reviewed owner, invalid registry, parse error, new candidate, reviewed
rival or reviewed derived-output writer makes the gate red.

`test:weekly-writer-zero` runs the detector's mutation checks and the actual
census. It is now a current contract in `test:release`, and is also linked from
the historical Bible chain. No old diagnostic assertion was promoted. The new
requirement is `LAW-weekly-writer-zero-proof`.

### Measured scope and units — not an app-wide zero claim

Instrument: `npm run audit:weekly-writers`; full reproducible detail:
`node scripts/weekly-writer-census.js --json --report`.

- Scope: **592 JS/TS source files** in App/index, src (including dev), and
  deployable edge functions. Tests, mocks, declarations and dependencies excluded.
- **2,263 direct operation occurrences in 649 distinct direct-owner functions**.
- Including possible callers: **1,252 distinct executable capability owners**.
  Dedup key: source path plus named function; anonymous callbacks are grouped
  with the owner. This is a conservative STATIC capability set, not 1,252
  runtime-executed authors, independent policies, athlete actions or defects.
- **34/1,252 owners reviewed; 1,218 unresolved**. Reviewed classifications:
  9 canonical compiler, 3 canonical input writer, 5 persistence boundary,
  3 projection/display, 2 legacy ingress, **11 rival author**, and **1
  derived-output writer**. Zero is not proven. Confirmed counts are LOWER BOUNDS.
- The derived-output writer identified here is **in-memory overlay publication**,
  not evidence that overlays are written to disk. Program persistence already
  projects its ordinary envelope to inputs. A global durable-writer zero is
  still unproven; transport primitives and atomic rollback are not automatically
  classified as illicit output writers.

### Confirmed unfinished ownership, not a new programming policy

The 11 reviewed rival functions are:

- `generateProgram.buildGeneratedMicrocycles`: final row composition, assembly,
  history pinning and power/top-up orchestration still live after plan compilation.
- `generateProgram.generateProgramLocally`: post-compiler block orchestration.
- `sessionResolver.materialiseWeekStrengthProgression` and
  `bakeMicrocycleStrengthProgression`: normal build-day dose and its week writer.
- `blockBoundaryProgression.applyBlockBoundaryProgression`,
  `applyBlockBoundaryVolume`, `applyBlockBoundarySetAdditions`,
  `applyBlockBoundaryConditioning`, `applyBlockBoundaryConditioningAdvance`:
  generator-invoked post-passes for load, sets and conditioning.
- `lighterDayTrim.applyLighterDayTrim` and
  `lighterDayTransaction.applyLighterDayForToday`: separate live day-dose author
  and orchestration, called from HomeScreenV2.

`programStore.setWeekScopedOverlay` is the reviewed derived-output publisher:
it accepts externally computed overlay content and hands it to the transaction,
instead of requiring a typed accepted input and deriving that content.

These are distinct executable FUNCTIONS, including wrappers, not 11 distinct
training policies. Classification is read from executable source and call
references, not a claim that every branch ran on a device. Each reviewed row
names its reason; other candidates remain unresolved rather than guessed safe.

### Safe retirement completed

Removed **2 distinct unused raw store authors**, `addExerciseToWorkout` and
`replaceExerciseInWorkout`, including their public method declarations. A full
source search found zero product callers; only one old diagnostic called Add.
That diagnostic now invokes the existing pure canonical exercise edit transform
and does not fabricate a direct store write. A stale usage comment was updated.
No athlete data, ledger, report or file was deleted; the removed source is
recoverable from git. No active training policy was changed to force zero.

### Verification and liveness

- New detector: **19/19 cells green**. The retirement cell first failed with
  the two raw implementations present, then passed after their deletion.
- Mutations add a fake writer in a new source file (green fixture becomes red),
  explicitly classify a rival and a derived writer (each independently red),
  change an approved function body, rename imports, alias CommonJS calls,
  mutate through an array alias/computed key, use Object.assign/Reflect,
  capture a store setter, and inject invalid source/registry. Each is asserted
  against the discovered owner/site, not just a nonzero whole-repo exit.
- First detector runs also caught two flaws in the instrument: local array
  aliases lost their initializer and dynamic element-access calls looked like
  literal method names. Both mutation cells are green after fixing discovery.
- `test:canonical-weekly-compiler`: **241/241**. Real onboarding/accepted edit,
  fixture, deload, restart and Undo witnesses still pass after the removals.
- `test:test-truth`: **14/14**, release contract **11/11**, unrunnable-suite
  ratchet **5/5**. The current-contract census now has four contracts, with
  the newly requested writer proof deliberately red.
- `test:deriving-device-commit`: **9/9**; `test:fact-horizon`: **14/14**.
- `test:release`: **RED**. It reaches the bootstrap and the new writer gate,
  then stops (1/5 release units green, three not run by that invocation).
  Those other three witnesses were run separately above; do not call this
  a green release. The reported unresolved set is not a product-fix todo list.
- `test:compile`: globally red, 464 diagnostic occurrences across product,
  devtools and tests (21 / 45 / 398). No reported regression names a changed
  TypeScript file in this checkpoint. Baselines were not changed.
- The retained `direct-add-pallof` diagnostic cannot start: its existing
  `buildStrengthTrace` import of `../support/coachingPlanForTests` is missing.
  This is recorded as harness debt, not repaired by restoring the retired
  store writer. Its pure transform is covered by the current compiler suite.

The next same-class mistake is caught by automatically rediscovering candidates
and expiring reviews, plus the standing alias/mutation tests. Static discovery
does NOT replace the real accumulated-state acceptance journeys.

### Remaining work / questions before zero can be accepted

Owner for this follow-up: `testtruth`.

1. Move final row composition and progression/block-boundary decisions into the
   compiler's explicit input/output contract, deleting the generator post-passes
   in the same slice. Preserve retained versus rotated lift rules, earned sets,
   conditioning ladders and recorded history. A new wrapper name is not enough.
2. Record the accepted today-only lighter-day effect and compile it. Establish
   its existing signed precedence against an already-active readiness/illness/
   scheduled dose before changing any arithmetic. Question: when both apply,
   which existing signed rule governs main-lift protection versus global dose?
   Do not silently halve twice or erase the athlete's opt-in. Prove live,
   accumulated edits, restart and Undo before retiring the overlay door.
3. Finish reviewing the remaining capability set, distinguishing policy authors,
   innocent reads, input writers, transports and compatibility. Review mutable
   argument/return types and indirect paths; do not bulk-label entire modules.
4. Re-run the census after each deletion and mutation-test any new detection
   shape. The step-16 sprint-versus-conditioning credit disagreement remains
   open and still blocks the late-Off-season lifecycle/full-year acceptance.

No new product choice was silently made; the policy question above must first
be resolved against the existing signed contracts. If they conflict, ask Sam.

### NOT COVERED

- Full classification, removal of all active rivals, or either global zero.
- A sound whole-language call graph: the scan follows statically resolvable
  symbols and flags several opaque writes, but does not establish dynamic
  dispatch/eval/native/dependency implementation coverage or runtime reachability.
  The 592-file scope is explicit; do not describe it as every platform path.
- Full proof of every durable envelope, rollback shape, remote writer or
  derived adjustment reconstruction path. No global persistence-zero claim.
- New behavior acceptance for the remaining progression/lighter-day migrations;
  those implementations were inspected, not changed or accepted by this pass.
- Late-Off-season blocked lifecycle, full-year archetypes, full action matrix,
  simulator, UI pixels and physical iPhone. No phone build or release approval.

## 2026-08-27 — step 18: year gate wired; steps 3–5 remain partial

Owner: `testtruth`. Sam added the outstanding step-3/4 issues to this round.
This checkpoint includes fixes, not only measurement, but **neither global
one-owner acceptance nor full-year acceptance is complete**. Unfinished work
is named below; it has not been silently excluded from the release gate.

### Options compared

1. Patch restart symptoms separately and keep the annual HTML as a standalone
   audit, with another list of expected results.
2. Move progression ownership into an explicit-input compiler family, use one
   executable year verdict for release and HTML, and expose unresolved ownership
   and lifecycle failures as release blockers.

Option 2 implemented. Existing load/set/conditioning policies were moved, not
replaced with new training prescriptions. No athlete ledger or data was deleted.

### Step 3: fixes and the unresolved policy question

- Primary sprint sessions now carry the same typed `true_speed` block as
  attached sprint components. They no longer acquire a second ordinary
  conditioning identity. The actual compiler-output mutation arm strips that
  block and observes `compiler_sprint_identity` fail.
- The phase-change journey exposed backdating: selecting In-season on
  2 November settled into a phase clock starting 5 October. The generation
  anchor was only propagated by `commitRebuiltProgram`, while Profile called
  its surface builder directly. The builder now carries the generated anchor
  for both callers; the commit's duplicate assignment was removed.
- Live settling now reads the same clock projection as persistence: current
  accepted program first, hydrated clock only when no live program exists.
  The same 17-week journey's `phase_clock` checks changed from red to green.
- Scheduled-dose precedence and progression stand-down remain as in step 16.
  The scheduled-deload family is not being declared complete while its
  late-Off-season entry still fails the conditioning contract.

**Question sent to Sam, unanswered at this checkpoint:** should a proper sprint
session count toward the weekly conditioning total, or sit on top of it?
The scheduler counts it toward the total, while `SpeedBlockCountingFence`,
`speedBlockForTemplate` and the classification tests explicitly grant no
conditioning credit. A temporary evaluator experiment counted it and made the
late-Off-season probe pass, but that change was **reverted** because it chose
between conflicting meanings. No evaluator allowance was left behind.

### Step 4: progression migrated; global ownership remains unproven

`canonicalWeeklyProgressionCompiler` now owns strength materialisation and the
ordered boundary load → earned sets → conditioning reduction/advance → volume
pipeline. It works on a private program copy with stated history, profile,
block coordinates and generation date. The resolver's three progression
implementations and the generator's procedural boundary loop were removed;
callers delegate to the compiler family. The five boundary transforms now
have that family as their sole production caller.

The year repeatability check first found hidden `new Date()` writes in strength
progression metadata. They were removed: a derived prescription retains its
input metadata. More importantly, restart used logs recorded **after** the
accepted build to progress the same block again. The compiler now bounds
history by its recorded generation date. Later results still enter the next
acceptance; merely reopening the app does not accept another progression.
The real 17-week experienced-athlete probe changed to zero restart differences
across all 17 reached weeks. This does not claim every full-year fixture replay
is fixed. Recurring and explicit fixture display also now share one stub
identity; the duplicate virtual-stub implementation was removed.

Latest census: **593 source files**, **2,263 operation occurrences** in
**649 distinct direct-owner functions**; including candidate callers,
**1,252 distinct executable capability owners** (path + function), of which
**36 reviewed / 1,216 unresolved**. **4 confirmed rival functions and 1
confirmed derived-output publisher remain**. The prior checkpoint had 11
confirmed rival functions. These are lower-bound static function counts,
including wrappers, not counts of independent policies or executed branches.

The four confirmed rivals are final row composition in
`buildGeneratedMicrocycles`, orchestration in `generateProgramLocally`,
`applyLighterDayTrim`, and `applyLighterDayForToday`. The derived publisher is
`programStore.setWeekScopedOverlay` (in-memory publication, not proof of a disk
write). Full row composition, lighter-day accepted input, remaining candidate
classification and durable-boundary proof are still work, not questions Sam
needs to answer. No classification was relaxed to make zero appear.

### Step 5: one executable year verdict and its presentation

`test:compiler-year` is a current release contract, not an optional HTML audit.
It uses eight athlete-answer archetypes, availability 2–6 days, all three
phases, both genders, novice/experienced and commercial/home/bodyweight kit.
Each required timeline contains 52 weeks; the total denominator is **416
athlete-weeks from 8 distinct athletes**. Different starting phases prevent
one onboarding refusal from concealing every other phase.

The harness uses real onboarding, generation, session removal, Undo, fixture
changes, phase changes, logging, rollover, and storage flush → empty stores →
rehydration → production boot. Compiler inputs/outputs are observed, not
substituted with handmade programs. Every reached week checks dated placement,
phase clock, fixture priority, identity duplication, optional behavior,
scheduled dose, existing typed programming constraints, ledger preservation
and exact visible reconstruction. Only audit creation/update timestamps are
excluded from visible equivalence; load, sets, rest, content and identity stay.

Missing athletes, weeks, checks, actions or restart depth remain red. A refused
action marks subsequent weeks NOT REACHED, never passed. The separate
`canonical_only` prerequisite remains red while the ownership census is
unresolved: the current canonical compiler still returns before final row
composition. This gate therefore does **not** pretend it has achieved exclusive
canonical compilation yet. Plan-to-final-row conservation is also still an
explicit blocking ownership gap, not proven by duplicate-ID checks alone.

`outputs/compiler-year-acceptance/result.json` holds the results and
`index.html` renders the same `yearVerdict`; there is no HTML scoring engine.
Incomplete runs write incomplete red evidence. The first broad run's oracle
was corrected where it counted a moved game's old recurring date as a second
game and judged athlete removals against the unadjusted base contract. Those
were instrument mistakes, not product fixes. Remaining Section-18 violations
must be reconciled with authorized forward-decision shortfalls before anyone
uses the red list as instructions to change training policy.

### Verification receipts

- `test:canonical-weekly-compiler`: **241/241 cells green** after migration,
  clock/anchor changes and the shared fixture stub. The new year suite does
  not replace those real edit, fixture, deload and Undo witnesses.
- `test:strength-progression-inputs`: **18/18**; `test:deload-law`: **68/68**;
  `test:deload-coach-notes`: **18/18**.
- Additional diagnostic subjects checked without promoting the old fleet:
  `test:block-two-ladder`: **59/59**, including four real rollovers with load
  and set increases; `test:block-two-boot-preservation`: **20/20**.
- `test:deriving-device-commit`: **9/9**; `test:fact-horizon`: **14/14**.
- `test:test-truth`: **14/14**, release contract **11/11**, unrunnable
  ratchet **5/5**. Five current product contracts plus the bootstrap now make
  six release units; the historical red fleet remains excluded.
- Year-detector controls: **24/24**. They explicitly distinguish synthetic
  verdict inputs from athlete journeys. Actual compiler output is separately
  mutated: injecting a duplicate day is rejected, and removing the actual
  primary sprint's typed block is rejected. The release runner accepts a
  synthetic complete control and fails when its weekly invariant is broken.
  This is not a claim that the still-red full production year was first green.
- Writer-detector controls: **19/19**, including a fake new executable writer
  and changed approved bodies. The real census remains red as stated above.
- `test:compile`: globally red at **464 diagnostic occurrences** across its
  three scopes (21 product / 45 devtools / 398 tests), matching the prior
  checkpoint. No new TypeScript errors remain in this round's changed files;
  no baseline was edited. `git diff --check` is clean.

What catches the next defect: every week is compared across actual persistence
and boot, accepted phase dates are checked independently against the scripted
athlete action, progression inputs are checked for immutability and repeatable
output, and the writer census invalidates changed or new executable owners.
The prior-generation-history cutoff is additionally exercised across worn
blocks; passing restart alone is not taken as proof that progression advances.

Final `npm run test:release`: **RED**, exit 1; bootstrap green, year gate red,
four later units not executed by that invocation (**1/6 units green**, not six
failed units). Those later witnesses were run separately as recorded above.
The year reached **281/416 athlete-weeks**, **212/281** passing all weekly
checks; **5/8 distinct athletes** completed all 52 weeks. The other 135 weeks
are NOT REACHED. **229 distinct failing keys** include missing coverage/action
requirements and prerequisite failures; they are not 229 product defects.
There are **63 failed programming-check occurrences across 7 distinct
athletes** and **10 restart-check failures across 5 distinct athletes**.
Phase-clock, progression repeatability, input immutability and recorded-anchor
checks hold across the reached weeks. The restart failures left are fixture
history/reconstruction, not permission to declare those paths accepted.

The earlier broad run had 28 green of 281 reached weeks. The change to 212
includes BOTH product repairs and corrected audit expectations, so it is not
a count of 184 fixed athlete bugs. Report and JSON are generated by the same
final gate. No phone build was made; release and Sam-device acceptance remain
blocked.

### NOT COVERED

- Physical iPhone, simulator/UI, remote persistence and true OS process death.
- Full ownership classification, final-row compiler migration, lighter-day
  migration, all durable writers or either global zero.
- Resolution of the sprint/conditioning credit conflict; late-Off-season
  onboarding still refuses under the current typed contract.
- All accumulated fixture replay combinations. The year run exposes lost
  moves/removals after earlier fixture history, a second-game Add refusal, and
  the two-day athlete's practice match leaving only one permitted gym day.
  These are not waived and block acceptance; no new replay workaround landed.
- A full injury/illness/travel/equipment/action Cartesian product or exact
  every-week plan-to-final-row conservation. The existing targeted compiler
  witness still owns the exact dose arithmetic and overlap matrix.

## 2026-08-27 — step 19: agreed sprint/conditioning credit (chunk 1)

Owner: testtruth. R-261 is Sam's approval after step 18, not another open
programming question. Scope is chunk 1 of the seven-part re-audit preparation.
Fixture replay, final-row compiler ownership and lighter-day migration stay
in their existing subsequent chunks.

Two options compared: add a local exception to Section 18, or put authored
speed qualification at one pure boundary consumed by the speed builder,
visible classifier and evaluator. The shared boundary landed. No dose or
template was invented or changed. The existing canonical compiler still owns
placement; there is no new post-generation repair pass.

- A proper speed session contributes one conditioning exposure and retains
  its speed quality. A combined speed/interval session earns ONE conditioning
  credit, not two; the interval quality and speed requirement remain separate.
- The catalog key and existing typed template properties distinguish full
  work from warm-up riders. Primers and unnamed/unregistered legacy speed
  blocks do not acquire full conditioning credit by inference. Old authored
  blocks carrying the retired derived `none` fence read their typed source;
  no ledger rewrite or athlete-data deletion occurs.
- Conditioning blocks referencing the same sprint rows are not independent
  work. Equivalent options still count once. Typed component ownership lets
  repeat-sprint intervals plus speed retain one credit of each kind.
- The scheduler no longer adds a conditioning credit for a sprint component
  inside an already counted session. Required running shares the same budget:
  an off-gym run reserves its slot before gym components are materialised,
  instead of becoming an automatic fifth exposure.
- An explicit zero club-session answer (`0` plus `[]`) is accepted at the
  onboarding completion boundary. Missing answers still fail. This is not a
  claim that the screen currently offers a zero-day choice (see below).

First-run findings were exposed before acceptance: late-Off-season generation
rejected its own conditioning count; after that was fixed, the no-team
Pre-season journey was refused for missing team days despite an explicit
zero; the wider three-day witness exposed a fifth exposure from the separate
running top-up. A two-component-credit intermediate was rejected in favour of
Sam's one-combined-session credit rule. It is not a shipped alternative.

Verification (implementation checkpoint `0c4cad0b`, final receipt below):

- `test:canonical-weekly-compiler`: **324/324 assertion cells**, including
  seven real onboarding profiles: late-Off-season/3 gym days; Pre-season/3,
  4, 5 and 6; In-season/3 and 6 with a Saturday game; all no-team-training.
  Both genders occur in the Pre-season set. Scheduled deload is reached on
  3 August for the five non-In-season profiles and restart preserves exact
  visible prescriptions. In-season restarts its ordinary game week.
- A quality-requirement negative control removes the interval component from
  a generated mixed session. This uses an explicitly constructed one-hard-
  conditioning contract to test quality separation; it does NOT change the
  athlete's actual Pre-season target. The real generated control passes and
  speed alone fails that typed quality requirement.
- `test:compile`: **464 diagnostic occurrences**, unchanged from step 18:
  product 21 / devtools 45 / tests 398. No baseline was weakened.
- The historical classification diagnostics remain red: session classifier
  38/40 (light-team-stress expectations); generation classifier 25/27
  (generated stress expectations). They are not the release contract and
  were not used to change product semantics.
- Full-year release and deliberate runtime-source mutations are recorded below.
  The global writer proof is still open, not zero.

What catches the next defect: the release-linked real-life compiler witness
checks shared frequency counting, retained quality, duplicate references,
legacy reads, missing-versus-zero answers and deload restart across the named
availability profiles. The year gate continues testing the accumulated lives;
it is not replaced by the focused witness.

### Final verification receipt

- Runtime-source mutations were made only after the implementation checkpoint
  and restored by exact patches, never checkout/reset. Removing proper-speed
  credit failed **13/267 reached assertions** (the refused onboarding journeys
  correctly could not reach their later cells). Allowing warm-up riders failed
  **7/324 assertions**. Letting the speed unit claim a second credit in a mixed
  session failed **14/306 reached assertions**, including the combined-count
  and quality-control cells. Restoring the source returned **324/324 green**.
- `test:deriving-device-commit`: **9/9**; `test:fact-horizon`: **14/14**;
  `test:deload-law`: **68/68**; `test:deload-coach-notes`: **18/18**;
  year-detector infrastructure controls: **24/24**.
- The historical `test:block-two-ladder` diagnostic is **58/59**, versus 59/59
  in step 18. Its failed cell requires an example landing EXACTLY at the
  16-set ceiling; the newly generated sessions top out at 15 in that sample.
  No sample exceeds the ceiling and progression assertions still pass. This
  is a lost boundary witness, not a requirement to increase athlete volume.
  It remains diagnostic test debt; no expectation or product target was
  altered merely to green it.
- Full-year gate: **280 green / 297 measured / 416 required athlete-weeks**,
  compared with **212 / 281 / 416** before chunk 1. **17 measured weeks fail
  one or more checks; 119 are not completed/reached**. Five of eight distinct
  archetypes complete all 52 weeks. The seven-profile focused witness above
  and this eight-archetype annual corpus are different denominators.
- The year has **11 failed programming-check occurrences across 7 distinct
  archetypes**, and **10 restart-check failures across 5 distinct archetypes**.
  The no-team six-day athlete now completes 16 weeks, including four scheduled
  deloads, rather than refusing at onboarding. Its first In-season week passes
  live checks, then boot refuses `core_conditioning_required_minimum:2`.
  Exact cause remains OPEN-UNKNOWN; this is a concrete accumulated phase/
  reconstruction gap for the remaining work, not a successful full-year life.
- Fixture-compressed two-day refusal and second-game Add refusal remain.
  They are chunk 2's existing scope. The new annual result has **156 distinct
  failure keys**, including missing coverage and prerequisites, NOT 156 bugs.
- Writer census: **594 scanned files**, **2257 direct operation occurrences**
  in **650 distinct direct owners**. Of **1253 capability owners**, 36 are
  reviewed and 1217 unresolved. **4 confirmed rival authors and 1 confirmed
  derived-output publisher** remain. Neither global zero is claimed.
- `test:release` remains **RED**, exit 1, **1/6 release units green** in that
  invocation: bootstrap passed, year failed, the four subsequent units were
  not reached. The relevant later witnesses were run separately above.
  JSON and HTML at `outputs/compiler-year-acceptance/` come from that same
  verdict; the recorded revision is the pre-commit tree plus working changes.
  `git diff --check` is clean. No phone build, data wipe or athlete-data
  deletion occurred. This is not whole-app or device acceptance.

### NOT COVERED

- Physical iPhone, simulator/UI, OS process death and remote persistence.
  The restart witness flushes, resets and rehydrates the real store adapters.
- The existing TeamTrainingDays screen still disables Continue with zero
  selected days. The backend zero-answer defect is fixed; that separate UI
  affordance needs completion before claiming a no-team athlete can walk the
  onboarding screens. This is a concrete pre-device gap, not waived acceptance.
- Accumulated fixture repair/replay, second-game Add, final-row compiler
  ownership, lighter-day ownership and the global writer-zero proof.
- The full injury/travel/illness/equipment Cartesian product, every possible
  availability-day combination, and the remaining legacy test fleet.

## 20. Chunk 2 — accumulated fixture and phase restart (2026-08-27)

Owner: `testtruth`. Sam explicitly requested fixture/restart handling and the
missing onboarding No team training option. Existing compiler and transaction
boundaries retained; no new replay engine, persisted program snapshot or schema.

### Diagnosis and design choice

Compared (1) catching/retrying individual historical fixture failures with (2)
separating the complete dated fixture-fact fold from its currently materialised
week horizon. Chose (2). Source truth remains accepted profile inputs, ordered
accepted fixture effects and block exercise-selection history. Calendar marks
and repaired workout overlays remain derived output, not independent history.

Measured through the real full-year action runner before editing:

- An old Pre-season practice match on 2026-08-17 was replayed against a later
  block that no longer contained its contract. `AcceptedEffectiveWeekUnavailableError`
  aborted the whole fixture group, including later Move/Remove decisions. The
  existing accepted-effect route now always folds its marks, while only the
  current program's affected weeks are materialised (including adjacent weeks).
- Add explicitly refused any second fixture. The accepted-effect resolver also
  cleared all other games. Add now retains existing games, Move changes only
  its source/target, and Remove suppresses the standing fixture only after the
  last explicit game is gone. Existing accepted effects are not rewritten.
- Fixture availability stripped the occupied date out of the athlete's access
  answer, making a valid two-day athlete appear to have an invalid one-day
  answer. Typed compiler input now keeps `gymAccessDayNumbers` separate from
  fixture occupancy; the existing scheduler still owns legal-day reduction.
- Generated-week validation still omitted proper speed conditioning, although
  the effective-week evaluator counted it. The six-day no-team athlete's
  Pre-season → In-season live transition accepted, then cold boot refused.
  Both now read the shared conditioning-credit predicate. A later full-year
  rotation exposed authored `repeat_sprint` templates (20 m Shuttle Repeats)
  omitted from that predicate; these also count once under R-261.
- A fixture repair was calling generation with `recordSelections: 'author'`.
  Its one-week/changed-layout selections overwrote the accepted block's seats;
  week 7 of the two-fixture archetype swapped two pulldown identities on boot.
  Scoped fixture projections no longer write block selection history. Block
  acceptance remains its owner. Year checks now require unchanged selection
  history on every restart; missing that check is itself a failed verdict.
- Onboarding now renders the shared selectable tile labelled **No team
  training**. `null` is unanswered, `[]` is an explicit answer. Picking a day
  replaces none; unticking the last day requires an explicit answer. Continue
  uses the existing durable commit door with numeric zero and an empty list;
  reopening restores the saved answer.

### Checkpoint measurements (before final year/UI/mutation completion)

- Canonical compiler: **352/352 named assertions**. New actual-action sequence:
  prior-block Move → rollover → second-game Add → restart → Move one → restart
  → Remove one → restart → Undo → restart. Exact visible contents, fixture
  precedence, ledger, old fixture facts and block-selection history are checked.
  Separate real two-day practice-match acceptance/restart and 17-week, >90-log
  six-day phase-transition witnesses execute. Earlier 324 assertions still pass.
- Onboarding presentation: **109/109**; generated-week validator: **36/36**;
  source-fact device-commit: **9/9**; fact-horizon: **14/14**.
- Year detector infrastructure: **26/26**, including missing/rewritten
  selection-history check mutations. These are detector controls, not athletes.
- All-scope typecheck remains **464 diagnostic occurrences**: 21 product,
  45 devtools, 398 tests. No baseline changed. Onboarding reliability remains
  **23/24**, its unrelated D1 hydration-registry enumeration fails.
- Intermediate year: **396 green / 412 measured / 416 required athlete-weeks**,
  before the repeat-sprint and selection-history fixes. Final run is in progress;
  no green-release claim is made from this intermediate result.
- Writer census: **4 confirmed rival authors and 1 derived publisher across
  1,253 candidate capability owners**, 36 reviewed and 1,217 unresolved. Same
  distinct-owner denominator as chunk 1. Global zero is NOT claimed.

### NOT COVERED at this checkpoint

- Physical iPhone, remote persistence and actual OS process death. Headless
  restart flushes, empties and rehydrates real stores before production boot.
- Simulator tape is being completed; no UI acceptance claim yet.
- Final-row composition and the programming-quality failures it exposes;
  lighter-day ownership and global writer-zero proof remain later chunks.
- Every arbitrary fixture/edit/injury/equipment combination and fixture moves
  across week boundaries (the existing explicit scope restriction is retained).

### Final chunk-2 verification

Implementation checkpoint: `900b6c59`. Owner remains `testtruth`.

- Final annual run: **401 green / 416 measured / 416 required athlete-weeks**,
  eight distinct archetypes each completing 52 weeks. Before this chunk it was
  **280 / 297 / 416**. Every measured week has a passing restart, fixture,
  placement, ordered-ledger and selection-history check: **0 failures / 416
  checks for each of those five check kinds**, not a claim about every possible
  athlete. All 54 recorded actions accepted: 16 phase shifts, 8 practice matches,
  6 game moves, 6 game removals, 2 game adds, 8 session removals and 8 session
  Undos. The focused fixture witness separately checks Undo after restart.
- **15 distinct athlete-weeks across all 8 archetypes still fail programming**.
  Missing main-lift pattern coverage occurs in all 15. Other failures overlap:
  excessive conditioning in 6, insufficient conditioning in 4, insufficient
  strength in 1, missed selected strength targets in 5, missed selected
  conditioning targets in 2, intensity mismatch in 4, pattern imbalance in 2.
  These are failed weekly constraints, not 15 newly isolated root causes. They
  remain visible in the unchanged acceptance gate; this pass does not redefine
  their targets. Final-row composition is the next implementation boundary.
- `test:release` exits 1: **1/6 units green**, year red, four later units not
  reached by that invocation. The year verdict has 16 distinct failure keys:
  those 15 programming-week failures plus the canonical-only prerequisite.
  Ownership is still 4 confirmed rival authors / 1 derived publisher, with
  1,217 unresolved out of 1,253 candidate owners. Neither global zero nor a
  release-ready app is claimed. Current verdict code re-read the final JSON and
  returned the same 401/416 result; HTML is its presentation, not another audit.
- Restored `test:canonical-weekly-compiler`: **355/355 assertions**. The three
  extra assertions exercise eight real logged weeks of the two-fixture athlete,
  including accepted game Add/Move/Remove, exact visible restart contents and
  selection-history preservation. `scripts/test-compiler-year.js`: **26/26**.
- Four in-process product mutations were injected and confirmed reached:
  disable the historical-fact horizon branch (**9 failed assertions**);
  clear the other game on Add/Move (**4**); omit the shared speed credit from
  generated-week validation (**1**); re-enable fixture-repair selection-history
  writing (**1**, exact visible contents in the eight-week journey). The first
  three ran against the 352-assertion checkpoint, the last against 355. No
  product source or running simulator bundle was changed for these mutations.
  Logs: `/tmp/testtruth-chunk2-mutation-{historical,multi,credit}.log` and
  `/tmp/testtruth-chunk2-mutation-selections-confirmed.log`.
- Test liveness finding: the original short fixture sequence survived the
  selection-history mutation because it did not reach the logged block state
  that changes exercise order. The added eight-week journey fails on the real
  mutation. Its first reachability assertion incorrectly asked this In-season
  athlete for a practice match; corrected to its actual Add/Move/Remove events,
  then reran both mutation and clean control. No product change was made to
  satisfy the mistaken assertion. This longer witness and the annual exact
  restart comparison catch the next instance of this class, not just a source
  call-site spelling.
- `.maestro/visible/onboarding-no-team-training.yaml`: **exit 0**, fresh
  non-seeded simulator onboarding through Team training days, none/day/none
  selection, Continue, app Back, retained none answer and Continue again.
  Screenshot `/tmp/testtruth-no-team-selected.png` inspected. Earlier runner
  failures were selector mistakes (including Maestro's integer-only percentage
  points), not accepted UI evidence; the final tape uses the actual app Back.
  Only the simulator test app was cleared. No physical phone or production
  athlete data was wiped, and no phone build was delivered.

### NOT COVERED / next boundary

- Physical iPhone acceptance, remote persistence, true OS process death and a
  full screen-driven onboarding-to-season-change journey. UI verification here
  reaches the no-team answer and its back-navigation persistence; headless
  production transactions cover generation, accumulated actions and phases.
- Final-row composition, lighter-day ownership, the remaining 15 programming
  weeks, and the global executable-owner census. This is not ready for Fable's
  final re-audit. Next owner: `testtruth`, subject to Sam starting that chunk.
- Every arbitrary fixture/edit/injury/travel/illness/equipment combination and
  cross-week fixture moves. The existing same-week move restriction remains.
- When a release checkpoint is ready for Sam's phone, verify No team training
  → Continue → Back retains the answer; add a second game onto training, move
  one game, restart, remove it, restart and Undo; switch phase after accumulated
  training and confirm the week remains the same after relaunch. Local gates
  and the simulator do not substitute for that physical-device acceptance.

## 21. Final-row composition — 2026-08-27

Owner: `testtruth`. User requested this chunk after the 401/416 annual result.
Implementation checkpoint: `8e7afd5a`. Annual artifacts record the pre-commit
working tree at parent `78dddbf3`; that verified code is captured in this commit.
LOOP CHECK: a scheduled plan passing while its final rows fail is the existing
split-ownership failure. This slice moves the actual final-row author, not just
another wrapper around the scheduler. Global ownership is still NOT complete.

### Options and implemented boundary

- Incremental option: fix the practice-match budget and fixture fallback in
  place. That addresses the 15 measured weeks but leaves generation composing,
  excluding and progressing rows outside the compiler boundary.
- Selected option: move that complete pipeline into `compileCanonicalProgram`
  and `compileCanonicalProgramWeeks`, retaining the established scheduler,
  selection, dose, adapter, exclusion and optional-session specialists. The
  service captures accepted inputs and metadata, records returned selection
  decisions at the existing boundary, and returns the compiler's program.
  Its former row-building implementation is removed; the old exported
  `buildGeneratedMicrocycles` is a compatibility delegate only. Warnings return
  as diagnostics for the service to log. Old debug-only alignment/capacity
  logging was not carried into the domain owner.
- No new programming targets, replacement exercise catalogue, AI call or
  persisted output format. The canonical path still compiles accepted facts
  and uses the same selection-history and progression rules.

### Measured causes and fixes

1. A Pre-season practice-match week was scheduled against the Pre-season
   conditioning overlay while its Section 18 game-week contract imposed the
   game-week maximum. The scheduler now uses the existing In-season workload
   overlay for that fixture week, including the existing no-club game-week
   conditioning choice. The athlete's Pre-season phase/clock remains unchanged.
2. After minimal fixture repair exhausted its candidates, the branch labelled
   `full_regeneration` submitted the failed source split again, not the complete
   target the compiler had already built. It now submits that target. The old
   pattern roles are NOT relabelled to fake coverage, and targets are not lowered.
3. An added combination witness found a separate real restart defect: Swap an
   exercise, then Move a game. Boot rebuilt the swapped workout but omitted its
   athlete-ownership context. Fixture cleanup then treated it as system residue.
   Live Add/Swap and boot now share `canonicalExerciseEditOverrideContext`; the
   exercise compiler returns that context with each materialised date.

VISIBLE: fixture-adjusted training now receives the complete rebuilt split and
the game-week conditioning allowance; an exercise swap survives subsequent
fixture reconstruction. These claims are held by the named tests below, not a
physical-phone claim. No screen layout changed in this chunk.

### Verification and what catches the next defect

- `test:canonical-weekly-compiler`: **375/375 named assertions**, up from 355.
  Added actual-action Remove-session / Swap-session / Swap-exercise → game Move
  → restart → Undo witnesses, plus a non-vacuity assertion that the complete
  regeneration fallback ran with an athlete edit present. The eight-week
  logged two-fixture journey now asserts programming and the full compiler
  boundary as well as restart/selection history. A six-week novice/home
  Pre-season journey reaches an occupied-day practice match and validates its
  patterns and conditioning budget without changing phase identity.
- `test:release` completed the strengthened annual gate: **416 green / 416
  measured / 416 required athlete-weeks**, eight distinct archetypes × 52.
  Before: **401/416** and 15 distinct programming-failing weeks. Now: **0/416
  failed programming checks**. Each of phase clock, placement, fixtures,
  conservation, optional behaviour, deload, restart, ordered ledger, selection
  history, logging and compiler-boundary checks also has **0 failures / 416**.
  The eight next-week-edit and eight exact-Undo checks pass. **55 distinct
  recorded actions** are accepted, including the new exercise-swap-before-game
  coordinate; **416 actual store-rehydration/production-boot restarts** ran.
- Year observations now intercept the real materialiser and conditioning
  adapter, clone their row receipts, then compare identity/day/semantic role
  with the complete compiler return after exclusions and progression. Explicit
  pinned history and exclusions are respected. Compiler input immutability,
  semantic repeatability for each encountered phase, and actual reachability
  of the complete compiler are checked. This catches dropped final rows rather
  than merely proving a seven-day schedule exists. No derivative HTML oracle:
  `outputs/compiler-year-acceptance/index.html` presents the same JSON verdict.
- Mutations injected into real executable modules, without editing product
  files: restore the old fixture fallback (**2 failed assertions**); restore
  the Pre-season budget (**1**); omit boot ownership context (**2**, including
  the accumulated journey). Each mutation reported its injection as reached;
  the restored control passes 375/375. Logs:
  `/tmp/testtruth-finalrows-mutation-{fallback,budget,context}.log`.
- The year mutation also removes a real specialist row from the full compiler
  return: clean output passes, row removal is reached and rejected. The prior
  duplicate-day and missing-speed mutations still reject. Detector controls:
  **28/28**, including an assembly call injected into live generation and a
  missing exercise-before-fixture action. Writer detector: **19/19**.
- Scheduler verification: **102/102** scheduler, **11/11** generated-fixture,
  **10/10** travel-zero-equipment, **9/9** off-season-continuity and **20/20**
  spare-day assertions. Generated-week validator: **36/36**.
- First-run coverage findings were not hidden: relocation initially broke ten
  source-location assertions, which were rebound to the actual row compiler.
  The first session-edit witness did not reach full regeneration; it failed its
  reachability assertion. The exercise-swap combination reached it and exposed
  the missing ownership context. Source-reading anchor/participation/block-state
  guards were also redirected to the moved implementation rather than left
  passing against an empty old location.

### Release status and ownership accounting

- **2 confirmed distinct rival author functions / 1,257 candidate capability
  owners**, down from 4/1,253. The two retired service authors are now delegates;
  the new compiler/private helpers are explicitly classified. **1 confirmed
  derived-output publisher**, **40 reviewed**, **1,217 unresolved**. The remaining
  confirmed rival functions are `applyLighterDayTrim` and
  `applyLighterDayForToday`. These are candidate-owner counts from the executable
  source census, NOT proof that the unresolved set contains no further authors.
- Annual verdict still exits **1**, solely on the global canonical-only
  prerequisite. Release remains **1/6 units green**: bootstrap passes, year
  ownership prerequisite fails, four later units are not reached. No global
  zero, green release, or Fable re-audit readiness is claimed.
- All-scope typecheck still reports **464 diagnostic occurrences**: 21 product,
  45 devtools, 398 tests. No baseline was changed. The touched production files
  add no diagnostic occurrences.
- Existing census-classified rewrite suites were inspected, not used as product
  orders: assembly stops on its old missing-selection-history fixture;
  anchor-participation is 19/20 (old hard-day expectation); game-anchor is 11/15
  (stale readers/UI and assertions); block-state is 30/31 (old rollover view).
  Repo-law guards remain 52/63 on unrelated report/inbox/flow/store/anchor debt.
  Their source-location bindings were preserved where this move affected them;
  no training policy was changed to satisfy an obsolete expectation.

### NOT COVERED / next boundary

- Physical iPhone, simulator UI, remote persistence and actual OS process death.
  Headless journeys empty/rehydrate stores and execute production boot; this
  does not replace Sam's physical-device acceptance. No device build or wipe.
- Global one-owner proof, the lighter-day family, the derived-output publisher,
  remaining unresolved source-census entries and existing release/typecheck debt.
  Next owner: `testtruth`, when Sam starts the lighter-day ownership chunk.
- Transitive clock-purity of legacy helpers: audit `createdAt`/`updatedAt` fields
  are excluded from semantic repeatability. The new boundary receives its
  authoring stamp explicitly, but not every retained helper's audit timestamp
  has been converted. No stronger purity claim is made.
- Every injury/illness/travel/equipment/action cross-product, cross-week fixture
  moves and screen-driven full-year interaction. The eight archetypes and named
  accumulated-action witnesses are the measured denominator, not the whole app.

## 22. Lighter-day input, ownership cleanup and type debt — 2026-08-27

Owner: `testtruth`. Sam requested all three. **This checkpoint does NOT complete
the global ownership proof or all historical test debt.** No device build/wipe.

### Choice and implementation

- Compared retaining the live lighter-day overlay writer with recording the
  opt-in as a typed input. Keeping the overlay would preserve the separate live
  author and would not explain how restart should reproduce the decision.
- Chose `lighter_day` / `slight_v1`, linked to one date and source-fact id, in
  the existing decision ledger. The pure
  `canonicalWeeklyLighterDayCompiler` owns the retained trim policy. The old
  utility is only a re-export. Live acceptance and ordered boot reconstruction
  share the same publication adapter; no workout snapshot is saved with the
  decision. Undo annuls the decision; clearing its source fact makes it inert.
- Removed `programStore.setWeekScopedOverlay`, whose last production caller was
  the old lighter-day transaction. Existing test-only setup uses store fixtures;
  no replacement public derived-output setter was added.
- The old private `buildWeeklyPlan` and its nine private rewriting helpers had
  no production caller. Removed those ten definitions and unused imports from
  `coachingEngine`; all six previously exported functions remain. This removes
  6,319 net source lines, not 6,319 independently executing authors.

### Behaviour and failure evidence

- `test:canonical-weekly-compiler`: **402/402 named assertions**, including real
  onboarding, accepted lighter-day policy, protected main lifts, actual accessory
  changes, duplicate refusal, persisted-store rehydration/production boot,
  exact Undo, clear, Off-season/In-season, occupied-day fixture Move, and an
  actual scheduled Pre-season deload week. The deload witness initially selected
  an ordinary week and failed its non-vacuity check; corrected the witness to
  reach the actual scheduled deload, not the policy.
- New lighter-day assertions were red before the migration: policy recording,
  repeat availability/repeated halving, restart, exact Undo. Four executable
  in-memory mutations were then injected into real modules, with a mandatory
  injection marker (no source edits left behind): omit boot application ->
  401/402; permit duplicate acceptance -> 398/402; ignore cleared-fact
  eligibility -> 399/402; trim protected main rows -> 401/402. Clean rerun is
  402/402. Logs `/tmp/testtruth-lighter-mut-{boot,duplicate,cleared,main}.log`;
  runner `/tmp/testtruth-lighter-mutations.cjs`.
- `test:readiness-ownership`: **24/24 cases**. Its old R5/R6/R12 explicitly
  demanded the retired overlay/reversible-snapshot format. Replaced those three
  with actual onboarding and current decision-ledger actions, retaining their
  real contracts: next week's prescription unchanged; Undo only the accepted
  trim; linked-fact clear retains a later unrelated session Remove across
  restart. A first removal tried a protected Tuesday club day and was refused;
  the witness now explicitly reaches Wednesday training. Content comparison
  excludes rehomed workout-container ids and audit times, but preserves row
  identities and every prescription. The original other 21 cases remain.
- `test:compiler-year`: **416/416 green athlete-week observations across eight
  distinct athletes x 52 weeks**, each with 52 persisted-store restarts. The
  five-day/two-fixture archetype now also accepts a lighter day. Missing that
  action is a verdict-engine mutation. Existing real compiler mutations still
  catch duplicate placement, lost speed identity and lost final rows.
- **Year command exit 1; release exit 1 (1/6 release units green).** The single
  failing year prerequisite is global ownership. The remaining release units
  are not all reached by the fail-fast runner; focused witnesses were run
  separately. Generated HTML still derives this same RED verdict.

### Ownership accounting — not a zero claim

`test:weekly-writer-zero` exits 1. Detector controls are **21/21**, including
actual fake-writer insertion, changed fingerprint, missing owner, alias/callback
edges, opaque writes and the newly retired planner. A new control proves a
type-only `Parameters<typeof fn>` reference is not an executable call edge;
runtime call/callback edges remain observed.

Current scan unit: **distinct executable capability owners (file + named
function; anonymous callbacks grouped with their enclosing owner)**. Scope:
App/index, all production/dev JS/TS and deployable edge functions; not tests,
mocks, dependencies or declarations.

- 597 source files; 1,996 direct operation occurrences in 624 distinct direct
  owners; 1,200 candidate owners including transitive callers.
- 48 reviewed; **1,152 unresolved**. No stale/invalid registry rows.
- **4 confirmed rival functions**, all in one remaining projection-rewrite
  pipeline: `projectVisibleDay`, `applyConstraintsToSession`,
  `applyConstraintsToTypedComponents`, `recoverySubstitution`.
- **0 confirmed derived publishers**, with global zero **NOT PROVEN** while
  those candidates remain unresolved. The old public setter was removed, not
  reclassified to hide it.

The projection finding is **read at executable source, not a newly reproduced
phone incident**: after its adjudication bypasses, the display path can filter
rows/components, replace a workout with recovery, then filter validator
violations again. It cannot be signed off as display-only. These four functions
were already present; this is discovery, not four newly introduced regressions.

Compared with step 21: candidate owners 1,257 -> 1,200; direct owners 652 -> 624;
direct sites 2,262 -> 1,996. The old two lighter-day rivals are migrated; the four
projection functions are newly reviewed findings. Do not read those numbers as
counts of distinct athlete actions or affected athletes.

### Test/type debt

Raw TypeScript diagnostic occurrences by scope (not unique product defects):

| Scope | Before | Now |
| --- | ---: | ---: |
| Product | 21 | 0 |
| Devtools | 45 | 0 |
| Test harness | 398 | 312 |
| Total scope occurrences | 464 | 312 |

The remaining **312 occurrences are in 102 distinct test files**. The existing
per-file ratchet is still red on 59 file/scope pairs. Baseline ceilings were
only lowered, never raised: product/devtools now allow zero; old test regressions
were not absorbed, and no tsconfig exclusions or suppressions were added.

Fixes include exact readiness-fact narrowing, result-union narrowing, E2E seed
id validation, real session-id witness shape, equipment date/window scope,
callback action narrowing and timer portability. Removed the unused Classic
Home standalone-game banner referencing a hook flag that no longer exists;
the active V2 UI was not redesigned.

Focused harness runs: coach revision 141/141; Explorer ingress 13/13; Explorer
production bindings 19/19; Explorer scenario session 36/36; Explorer live wiring
15/15; active-time budget 20/20; deriving-fact commit 9/9; fact horizon 14/14.
Replaced stale Repeat Week manifest/action counts with the actual current
registry (Sam removed Repeat Week in `eefc9c98`). Coach template tests now supply
real onboarding answers including bodyweight, not a store-less default athlete.
The test-truth bootstrap is green. These results do not promote the whole old
diagnostic fleet into product authority.

The typecheck gate itself also had a laundering hole: `--update` could absorb
regressions, and an unparseable compiler failure could appear as zero errors.
It now refuses both. Six mock-compiler controls, including an actual conditional
mutation that re-enables the bad update, run inside the release bootstrap.
They test the instrument, not product code. `test:repo-law-guards` remains
52/63 on existing report/inbox/flow/store/source-anchor debt (same totals as the
preceding checkpoint); no baseline allowance was raised to hide that result.

### What catches the next defect / remaining work

The canonical witness and full-year gate now exercise the accepted lighter-day
input through the same reconstruction as session/game edits. The negative
mutations demonstrate those checks can reject lost replay, duplicate trimming,
cleared-fact leakage and main-lift reduction. The fingerprinted source census
continues to fail closed on unreviewed or changed executable owners; it is not
whitelisted by filename or a `compile` prefix.

Still owned by `testtruth`, not blocked on a new Sam ruling:

1. Reproduce/classify the remaining projection fallback against current and
   legacy accepted sessions, then remove/reroute its content policy through the
   compiler without weakening injury withholding or resurrecting deleted rows.
2. Complete the remaining executable-path reviews and migrations. **The global
   zero proof is unfinished**; 1,152 unresolved entries are not harmless by
   assumption. Uncalled exported legacy interpreters also need retirement review.
3. Repair/rewrite the remaining 312 test type diagnostics against current
   contracts, not by restoring retired product APIs or raising baseline ceilings.
4. Existing lighter-day hard-conditioning logic only retags block intent; the
   migration deliberately retained it. Whether the actual authored rows become
   easy is **NOT VERIFIED**. Finisher row ownership also needs a real combined
   session witness. This is a blocking content gap before claiming the entire
   lighter-day experience complete, not permission to invent a new dose.

### NOT COVERED

- Physical iPhone/simulator UI, remote persistence and actual OS process death.
  No athlete-facing completion/device acceptance claim; headless rehydration is
  the measured restart mechanism.
- Full injury/illness/travel/equipment/action cross-product and every historical
  test suite. Global ownership and the remaining test debt above are unfinished.
- Newly correct hard-conditioning replacement prescriptions or all combined
  finisher rows; this checkpoint migrates the existing policy and tests the
  listed strength/ledger contracts, not unmeasured conditioning semantics.

## 23. Remaining lighter-day content and shared final constraints — 2026-08-27

Owner: `testtruth`. Sam: "do stilll unfinished". **Partial checkpoint, not global
one-owner completion.** No device build, wipe, athlete-ledger deletion or remote
write. Existing diagnostic outputs and unrelated untracked files were preserved.

### Options and findings

- Compared another screen-side patch with moving the existing final constraint
  transformation behind the shared public resolver. Chose the shared boundary:
  day/week readers no longer independently author exposure-filtered sessions.
  This preserves existing injury adjudication, recovery and modality behaviour;
  it does not replace the remaining name-based legacy exposure classifier.
- Confirmed the Step 22 content gap: lighter-day hard conditioning only changed
  metadata, and dropping a finisher did not remove its owned prescription rows.
  New real onboarding witnesses cover a commercial-gym man and home-equipment
  woman, both reaching generated hard conditioning alongside strength.
- The first real replacement then hit a real validation refusal:
  `planner_selected_target_miss:conditioning:3`. The compiler now changes the
  exact conditioning target delta alongside the accepted lighter prescription,
  not a blanket validation bypass. Strength policy and unrelated targets remain
  unchanged; the reduction is linked to the accepted date/source fact.
- The global census missed a legacy clear function calling a store action
  through an interface signature. A new detector test was **21 green / 1 red**
  before the detector fix. Domain callable references with unresolved concrete
  implementations now require review, including ordinary calls, callbacks,
  destructured aliases and computed property access. The larger candidate count
  below is an instrument correction, not newly introduced application writers.
- A second detector control exposed stale review inheritance when type information
  reveals a new operation without changing the function text (**22 green / 1 red**
  before the fix). Fingerprints now include the detected operation inventory as
  well as code and call edges. Existing reviews were migrated only after verifying
  their exact operations and calls matched the reviewed snapshot; new/unknown
  capabilities were not approved by the fingerprint migration.

### Implemented boundaries

- `canonicalWeeklyLighterDayCompiler`: actual hard rows become an existing
  authored recovery-flush prescription; selected equipment modality is retained.
  Finisher removal drops its owned rows and conditioning identity together.
  Main strength rows remain byte-identical. Replay supplies stable audit stamps.
- `commitCanonicalAcceptedLighterDayEffect`: shared live/boot publication of
  compiler-produced rows and contract through the existing accepted transaction.
  Only the source-linked opt-in policy is ledger input; outputs remain ephemeral.
  It reads the unfiltered accepted base so temporary injury/exclusion display
  filters do not become the new accepted prescription.
- `canonicalWeeklyConstraintCompiler`: former projector's complete final policy
  now runs inside `resolveWeekWithConditioning`; public date reads share it.
  The compatibility projector delegates to that same policy. The day/week
  read-model functions are single-return adapters, with no second content loop.
- `useScheduleState` now collects reactive inputs for `assembleScheduleState`,
  instead of retaining a second assembly implementation. Preferences, exclusions
  and contexts are explicit inputs. Pure preference lookup was separated from
  its persistence adapter; its matching policy was preserved.
- Ownership guards check found executable bodies, direct returns, actual input
  days and shared assembly. Controls kill a bypass, a dead conditional, an empty
  day loop, a second assembler and a missing daily reader. These are scoped
  source-edge checks, complemented by real accepted-world reader comparisons;
  they do not certify the entire repo's ownership.

### Verification receipts and next-defect protection

- `test:canonical-weekly-compiler`: **440/440 named assertions**. Added actual
  authored flush content, removed finisher rows, unchanged main lifts, input
  immutability, exact contract deltas, live acceptance, restart and Undo for both
  equipment witnesses. Existing accumulated fixture/edit/phase/deload journeys
  remain. Day/week/direct-result agreement now also runs with active and cleared
  injury, readiness, and lighter-day restart.
- Executable in-memory mutations, each with a mandatory injection marker:
  retain finisher rows -> **2 failures / 431 assertions**; leave hard rows
  unchanged -> **9 failures / 438 assertions**; omit the matching contract delta
  -> **4 failures / 438 assertions**. The first contract mutation survived the
  weaker checks; new non-vacuous generated-contract assertions caught it. No
  mutated source was written. Current clean suite includes two subsequent
  injury reader-agreement assertions, hence 440 rather than 438.
- Census detector: **23/23 controls**, including the new interface-call blind
  spot and the existing fake rival writer insertion. Unknown owners, changed
  reviews and explicit derived writers still fail closed.
- Focused suites: readiness/source facts **24/24**; compatibility projection
  **83/83**; derived assembly **6/6**; preference ownership **7/7**; classification
  **25/25**; Explorer runtime **17/17**; scenario runner **6/6**; logger **11/11**.
- Remaining focused release witnesses: deriving-fact commit **9/9** and fact
  horizon **14/14**. The current type ratchet remains RED on **58 file/scope
  pairs**, all test harness; product/devtools allow and report zero errors.
- Final release/year rerun: **416/416 green athlete-week observations across
  8 athletes x 52 weeks**, with all 52 persisted-store restarts per athlete.
  Year exit **1**, solely the `canonical_only` ownership prerequisite. Release
  exit **1**: bootstrap green, year prerequisite red, four later units not
  reached by the fail-fast runner (not four additional product failures).
  Later units were exercised separately as listed above. Final detector and
  bootstrap reruns also include the operation-fingerprint guard added during
  the annual run; domain code did not change during that run.
  HTML and JSON present the same RED gate result in
  `outputs/compiler-year-acceptance/`, not a separate verdict.

### Ownership accounting — still RED

Unit: distinct executable capability owners, keyed by file plus named function;
anonymous callbacks belong to their enclosing owner. Denominator includes
transitive callers. Scope: App/index, all production/dev JS/TS and deployable
edge functions; excludes tests, mocks, declarations and dependencies.

- **599 source files; 2,904 direct operation occurrences in 789 distinct direct
  owners; 1,345 candidate capability owners.**
- **61 reviewed; 1,284 unresolved; zero stale/invalid reviews.**
- **2 confirmed rival entry points**, both exported legacy capabilities in
  `applyAdjustmentEvents.ts`: `applyAdjustmentEvents` and `applyMoveSession`.
  No non-test callers were found for those two exports; historical diagnostics
  still invoke them. They are retained executable capabilities, not reproduced
  current-UI incidents. Retire/isolate them instead of calling them canonical.
- **1 confirmed derived-output writer**: `removeInjuryOverridesFromDate`, called
  by the legacy injury branch of `clearActiveProgramModifier`. It directly
  clears future injury-tagged overrides through a store action. Current injury
  episodes bypass that branch; old-format compatibility still needs migration
  proof, not deletion by assumption.
- The four previously confirmed projection functions now belong to the shared
  final compiler path. This does **not** turn the unresolved entries into zero.

### Test/type debt

Raw compiler diagnostic occurrences: product **0**, devtools **0**, test harness
**259 in 97 distinct files**, down from **312 in 102 test files** at Step 22.
No suppressions or config exclusions were added. Allowed test-error ceilings
were lowered from 162 to 135; existing regressions were not absorbed.

Repairs: explicit exposure constraints instead of the retired single-injury
argument; discriminated exact-seed witness narrowing; current logger options;
typed adjacency fixtures; correct synthetic-runtime dependency type and complete
artifact mock; current smoke registry counts (Repeat Week was retired). Removed
two obsolete assertions against stored `session.stressLevel`, which the current
compiler does not author: final-row stress is covered at the compiler/year
boundary. No product policy was changed to satisfy those stale assertions.

### Remaining work — owner `testtruth`

1. Retire or diagnostic-isolate the two unused exported event/move authors,
   preserving the still-live legacy injury-clear compatibility until its source
   input migration is proven. Do not delete old-athlete compatibility blindly.
2. Replace that legacy output-clear path with a typed input/ingress and shared
   compiler reconstruction, proving legacy load, clear, restart and Undo.
3. Continue executable ownership reviews, especially accepted-state publication,
   raw resolver/fixture repair, store actions and legacy modifier paths. The
   1,284 unresolved capabilities are **not** 1,284 proven bugs or harmless reads.
4. Repair or retire remaining diagnostic suites against current contracts;
   there are still 259 test type diagnostics. Keep the ratchet and release red
   until their actual prerequisites pass.

### NOT COVERED

- Mounted React/native UI, physical iPhone acceptance, remote persistence and
  OS process death. Restart here means emptied/rehydrated stores plus production
  boot, not a device build. Do not send this as a release-ready phone checkpoint.
- Global one-owner/zero-writer proof, full legacy-ledger/old-injury compatibility,
  every historical test and every injury/illness/travel/equipment combination.
- Exhaustive modality and legacy speed-only lighter-day shapes. The two named
  generated equipment witnesses plus existing phase/fixture/deload journeys are
  the measured scope, not an assertion about every possible athlete session.

## 24. Retired event authors and injury persistence — restart remains RED

Owner: `testtruth`. 2026-08-27. Continuation of Sam's “keep going”.

### Changes and scope

Compared keeping the legacy event engine reachable behind another compatibility
wrapper with removing its runtime entry points and retaining only diagnostic
evidence. Chose the latter: current injury actions already have a durable owner;
the unused event/move author should not survive as a second programming API.

- Moved `src/utils/applyAdjustmentEvents.ts` into the test-only
  `src/__tests__/legacy/applyAdjustmentEventsSnapshot.ts`. Its two historical
  test importers follow it. The old module is absent from runtime. After
  normalising the header/import relocation, every original line is preserved.
  This is isolation of historical evidence, not deletion of athlete data.
- Removed the sync injury writer's empty-world exception. It now refuses just
  like other injury calls outside the durable transaction. Generic modifier
  Clear refuses every injury, including an unowned legacy constraint, instead
  of deleting injury-tagged overrides. Native resolution remains
  `resolveInjuryEpisode` through `executeProgramControlActionDurably`.
- `projectProgramPersistedInputs` writes injury history only inside canonical
  `temporarySourceFacts`. Both live saves and already-reduced outgoing envelopes
  drop the redundant `injuryEpisodes` field. The existing ingress still reads
  older episode encoding, preserving real episode ids/history; canonical facts
  beat a stale duplicate. In-memory compatibility projections remain available.
- No unowned constraint is converted into invented episode provenance. The
  earlier demolition intentionally removed that backfill; this pass does not
  resurrect it or rewrite the athlete's decision ledger.
- The executable census now rejects runtime imports of excluded test/mock code,
  including re-exports, literal CommonJS loads and dynamic imports. It also
  rejects resurrection of the retired production module. Type-only references
  are not counted as runtime edges. Unknown dynamic capabilities remain part of
  the conservative unresolved census, not an exemption.

### Newly exercised failure — NOT fixed

`test:canonical-weekly-compiler` now reaches real onboarding, an accepted session
removal, a knee injury, persistence, restart, resolution, restart and Undo. It
tests current source-fact encoding and an older episode encoding made from the
same real accepted record, not a fabricated workout.

**Three failed assertions, one distinct restart failure class:** current-format
boot fails, older-format boot fails, and the older boot's visible-week equality
fails. Error: `main_strength_required_minimum`, expected 3, actual 2.

Baseline control: the same isolated injury journey was executed against the
pre-change HEAD versions of the three changed production modules (in-memory
loader only). Both restart encodings fail there too. The two additional reds
there are the duplicate-persistence cells fixed here: **18/23 baseline cells
green**, versus the remaining three restart reds. Receipt:
`/tmp/testtruth-injury-baseline-head.log`. This is an existing defect newly
covered, not a restart regression introduced by dropping the duplicate field.

Read-at-source cause, with the disagreement reproduced by the journey: live
`commitDerivingSourceFactScopedRegen` authors a dated sparse overlay and preserves
the pre-boundary week. Boot feeds the facts into base generation, with no same
dated overlay fold. Live forward acceptance can disclose the reduced week; boot
restoration rejects it. Switching boot to permissive acceptance would mask this
split and is NOT the fix. No production generation/validation policy was changed
in this checkpoint.

The older encoding retains its exact episode/history during hydration, but that
does NOT mean its whole boot succeeds. Resolution restores the edited healthy
week; resolution survives restart; Undo reverses the earlier session edit while
preserving the resolved injury history. These are named cells in the canonical
suite. Injury status is a recorded fact, not an undoable program decision. An
initial probe expecting injury-resolution Undo was corrected against that
existing contract, not implemented as a new product behaviour.

### Evidence and liveness

- Canonical compiler journey: **453 passing / 456 executed assertions; 3 red**
  as named above. Log: `/tmp/testtruth-injury-canonical-verified.log`.
- Persisted input projection: **12/12**, including two new checks observed RED
  before the production change (duplicate history and already-reduced output).
- Persisted schema inventory: **8/8**, measuring **22 distinct persisted keys in
  10 envelopes**. Declared signup date and selected band resistance; removed nine
  stale coach-era/retired-injury declarations. **Seven carried debt entries
  remain**: four coach keys, two transient keys, one unregistered envelope. The
  coach-key ceiling fell 13 -> 4, not an expanded allowance or a zero claim.
- Census detector: **26/26**. Mutations add a retired production author and
  runtime imports/re-exports/require/dynamic imports of test-only code; each is
  rejected. Type-only imports/exports remain a clean control.
- Injury shortcut mutations execute the new boundary cells with in-memory
  source mutations: control **4/4**, restoring the generic-clear bypass reds its
  unowned-injury refusal cell, restoring the sync writer reds its no-write cell.
  Each mutant exited 1 for its named reason. No working-tree mutation left behind.
  Receipt: `/tmp/testtruth-injury-shortcut-mutations.log`.
- Annual release run: **416/416 athlete-weeks**, eight distinct athletes × 52,
  with their restart comparisons. This catalog does not exercise the active
  injury failure above. Full release **1/6 units green**, exit 1 on the year
  ownership prerequisite; four later units are not reached by fail-fast, not
  four new product failures. Canonical/census/type units were run separately.
  Receipt: `/tmp/testtruth-injury-release.log`; HTML remains the presentation
  of the same RED result, not separate approval.
- Historical event snapshot: **99 passing / 101 assertions, 2 existing power
  shape failures**. It is still diagnostic, not current release truth. Its
  content was preserved, not repaired to dictate modern programming.
- Historical `programControlActionsTests` still stops at obsolete recovery
  section [5], before its injury sections. The latter no longer expect success
  from the retired sync writer; live injury coverage is in the canonical suite.
  Do NOT report that whole historical file green.
- Product type diagnostics **0**, devtools **0**. Test diagnostics **256
  occurrences across 96 distinct files**, down from 259/97 at §23. Three invalid
  test fixture values were repaired; their baseline allowance dropped 3 -> 0.
  Total allowed test ceilings are now 132, down from 135. Existing regressions
  remain red; no suppression, exclusion or raised allowance was added.

### Ownership accounting — zero still NOT proven

Instrument unit: distinct executable capability owners, keyed by file/function;
anonymous callbacks belong to their enclosing owner. Scope: App/index, runtime
and dev source, deployable edge functions; excluded diagnostics cannot be
imported by that runtime. Counts are not counts of bugs or athlete decisions.

**598 files; 2,801 direct operation occurrences in 761 distinct direct owners;
1,316 candidate capability owners; 60 reviewed and 1,256 unresolved.**

The two prior dormant event/move authors and injury-clear writer are retired
from runtime. Two newly reviewed, already-existing paths remain confirmed:

1. Rival author: `commitDerivingSourceFactScopedRegen`, the live dated-fact
   overlay/contract/adjustment author that boot does not share.
2. Derived-output writer: `removeOverridesForModifierSource`, still used by
   non-injury generic modifier Clear. This is a direct **volatile** derived
   output writer; it does not establish that workout overrides are persisted.

Therefore **1 confirmed rival and 1 confirmed derived-output writer / 1,316
candidate owners**, plus the unresolved reviews. The reduction from §23 is
retirement plus new inspection, not a claim that all unnamed paths are safe.

### Next concrete work — owner `testtruth`, nothing needed from Sam

1. Replace the live dated-fact overlay author and boot's separate fact handling
   with one pure compiler fold of the recorded facts, their date horizons,
   accepted base inputs and athlete edits. Preserve pre-fact history, fixtures,
   selection history and accepted edit order. Delete the procedural author in
   the same slice. Do not lower strength requirements merely to accept output.
2. Make the three current injury-restart assertions green; extend the year
   lifecycle catalog with active injury/update/resolve plus accumulated edits.
   Preserve the existing rule that Undo does not erase recorded injury facts.
3. Route remaining supported non-injury generic Clear inputs through compiler
   reconstruction, then delete `removeOverridesForModifierSource`.
4. Continue the executable ownership reviews and current-contract test debt.
   No “one owner complete” or Fable re-audit-ready claim while these are red.

### NOT COVERED

- Native/mounted UI, physical iPhone acceptance, remote persistence and OS crash
  recovery. No phone build or athlete data wipe was performed.
- Successful active-injury boot: explicitly measured RED in both encodings,
  not merely untested. Other injury regions/severities, overlapping injury facts
  and their complete fixture/phase matrix remain outside this pass.
- Full historical test fleet and the remaining 1,256 executable ownership
  reviews. The annual healthy-archetype result is not whole-app approval.

## 25. Five-step continuation PAUSED at Sam's reinstall request — 2026-08-27

Owner: `testtruth`. Sam interrupted implementation to wipe/reinstall Renee's
app. The in-progress code remains uncommitted; it was NOT built onto a phone.
No question for Sam is blocking the implementation at this point.

### Working-tree progress, not an accepted checkpoint

- Extracted generation-input capture into `canonicalProgramInputFromProfile`.
- Added pure `canonicalWeeklySourceFactCompiler` and `canonicalWeekOverlay`;
  the latter replaces the old overlay helper's content author, retaining a
  clock-capturing compatibility wrapper in `weekRebuild`.
- Added `sourceFactCompilation` as input-capture/publication boundary. Live
  fact transactions now call the same synchronous reconstruction as boot;
  removed `commitDerivingSourceFactScopedRegen` and its snapshot-Undo author.
- Boot builds the healthy base without deriving facts, reconstructs accepted
  edits with fact identities available, then compiles dated fact overlays.
  Non-deriving availability facts remain base-generation inputs.
- Baseline canonical suite: 453/456; three injury-restart failures.
  First modified run made those injury assertions green but exposed lost
  lighter-day effects because boot hid their source fact during ledger folding.
  Restoring fact identity before that fold fixed the lighter-day cases.
  Second run: 455/456; remaining failure was the source guard still requiring
  the now-deleted transaction-local contract author. Its assertion now points
  at the pure compiler, but that final assertion edit has NOT been rerun.
- Product typecheck initially found one discriminated-union narrowing error
  in the new compiler. Corrected to explicit `ok === false`; NOT rerun yet.
- Logs: `/tmp/testtruth-all-baseline-canonical.log`,
  `/tmp/testtruth-all-canonical-first.log`,
  `/tmp/testtruth-all-canonical-second.log`,
  `/tmp/testtruth-all-types-product.log`.

### Resume before claiming step 1 complete

Run fresh product types and canonical suite. Clean the retired transaction's
unused imports. Verify time-cap fixture-day acknowledgments (the old inert
reason plumbing was removed with the old transaction body and must be retained
through input-derived classification). Expand overlapping/date-boundary injury,
fixture, history, update/resolve and post-injury edit coverage. Review boot's
outer replay catch: a source-fact compilation error must not silently discard
the fact or return an apparently valid partial world. Audit the remaining
`reapplyActiveInjuryRecompositions` / live row recomposition writers during
ownership convergence. Then proceed through steps 2–5 without stopping at the
first slice: generic Clear, complete executable ownership, relevant test debt,
expanded annual acceptance. No counts have been refreshed for the new tree.

### Renee clean reinstall receipt

Sam explicitly authorized uninstall and local-data removal. Installed the
existing signed Release product from clean commit `5e7caee7`, NOT this dirty
working tree: `/private/tmp/lfa-release-testtruth-20260827.oBnVPP/Build/Products/Release-iphoneos/LocalFootyAthlete.app`.

Renee's exact paired device `C1972DB0-5B63-562E-81C2-368BBBF1A5AB`:
uninstall exit 0; reinstall exit 0; launch exit 0. JSON receipts beside the
build: `uninstall-renee-clean.json`, `install-renee-clean.json`,
`launch-renee-clean.json`. Sam's phone was not modified in this reinstall.
Sam subsequently confirmed Renee's app is working. No device data backup was
made before the explicitly authorized uninstall.

## 26. Resumed five-part completion — in progress, not a release claim

Owner: `testtruth`. Sam confirmed Renee's clean installation works and asked to
continue the entire five-item assignment. No new phone build is requested here.

Implemented in the working tree:

- Dated source facts compile through `canonicalWeeklySourceFactCompiler` on both
  live acceptance and reconstruction. Input capture is separate; timestamp and
  progression/load inputs are explicit at the pure boundary. The old
  `commitDerivingSourceFactScopedRegen` is deleted.
- Injury row substitutions now use `canonicalWeeklyInjuryCompiler` and the
  established safety ladder/canonical row transform. Deleted the imperative
  `recomposeSessionForInjury`/`reapplyActiveInjuryRecompositions` passes. Injury
  transactions no longer run a second settle outside their rollback boundary.
- Fixed an accumulated fixture/injury ordering defect exposed by the expanded
  annual journey: fixture replay was reading the new injury before its dated
  fold, changing earlier days. Replay now sees base facts; lighter-day effects
  receive their fact lookup explicitly. The fact fold pins earlier days.
- Deleted `removeOverridesForModifierSource` and the unused exported
  `clearManualOverridesPreservingActiveModifiers`. Generic Clear resolves exact
  facts through the durable owner; ambiguity refuses. Trip + its linked equipment
  answer resolve together in one transaction, not snapshot restoration followed
  by separate writes.
- Added real-onboarding injury/update/overlap/resolve/restart/Undo journeys in
  both injury orders; annual phase-week 8 requires them for every archetype.
  Added shared-fact Clear, ambiguity, readback-failure rollback, independent
  resolution and restart checks, also required by the annual verdict.
- Added a real compiler-output mutation deleting a pre-injury day; the journey
  catches it. Annual verdict requires this mutation and the lifecycle checks;
  removing either is red in the verdict-engine controls.
- Retired `gameChangeLocalRebuildTests.ts` / `test:game-local-rebuild`: it tested
  the deleted profile/override-sweep paths and name inference. Replacement
  witnesses are the canonical and annual transaction journeys. Removed its
  package command/old-chain link, recorded the retirement in test-truth. The file
  is recoverable from git. Kept other diagnostic suites while repairing their
  typed fixtures; did not restore deleted runtime helpers to satisfy them.
- Updated the stale main-lift inference control to require typed declarations;
  deload fixtures explicitly declare their hinge rather than rely on its name.

Verification receipts so far (working tree, not phone acceptance):

- `/tmp/testtruth-canonical-clearing-expanded.log`: **538/538 assertions** in
  the canonical slice, including both injury and generic-clear journeys.
- `/tmp/testtruth-year-clearing-expanded.log`: **416/416 measured athlete-weeks
  green across 8 distinct athletes × 52** with injury/clear checks in each phase.
  Overall gate remains RED on the ownership prerequisite, not a year PASS.
- `/tmp/testtruth-fact-mutation.log`: real prior-day deletion injected and caught;
  healthy control green. `/tmp/testtruth-year-detectors.log`: **32/32** detector
  controls (before the later clear check requirements; rerun before checkpoint).
- `/tmp/testtruth-current-fact-tests.log`: **40/40** source-fact transaction checks.
  `/tmp/testtruth-deload-current.log`: **68/68** deload-law assertions.
- `/tmp/testtruth-full-types-progress.log`: product **0**, devtools **0** errors;
  test errors still exceed the existing per-file ratchet. Latest raw tests are
  `/tmp/testtruth-types-retirement.log` (**193 errors**, before subsequent fixes).
  No exclusions, baseline increases or type suppressions were added.
- Writer gate now derives zero-operation callers only when every callee is
  verified. Unknown/changed/opaque/direct-writing functions cannot inherit a
  pass; inherited rejected callers do not inflate the distinct author count.
  `/tmp/testtruth-census-delegation-final.log`: **27/27** detector controls.
  Latest reviewed census: **2,804 direct operation occurrences in 757 distinct
  direct owners across 602 files; 1,309 capability owners incl. callers; 70 explicit
  reviews + 16 verified caller delegations, 1,223 unresolved**. This is NOT 1,223
  proven bugs. Zero rival/derived writers is NOT PROVEN. The two deleted known
  writers' stale review records were removed, and the new fact boundaries were
  reviewed individually with fingerprints.

Remaining work, no question for Sam currently:

1. Finish trip/equipment atomic-clear regression coverage and fresh verification
   after the final source cleanup; checkpoint only scoped reviewed files.
2. Continue executable ownership review, routing/deleting actual rivals. Do not
   bulk-approve by filename or mistake unresolved candidates for writers.
3. Finish relevant test/typecheck debt; current test-only edits are uncommitted
   alongside the compiler work. Remaining deleted-API references need current
   witnesses/retirement, not runtime resurrection.
4. Run the complete release gate after ownership/type work; keep the annual
   prerequisite red until zero is actually proven. No all-five-complete claim.

NOT COVERED: physical-device acceptance of these edits; global single-owner
proof; complete typecheck/release gate; every possible injury/equipment/action
cross-product; active injury carried across a block rollover. The latter needs
an accumulated acceptance coordinate, not an assumption from same-week restart.

## 27. Carried injuries, Clear and remaining census — continuing 2026-08-27

Owner: `testtruth`. Still uncommitted; neither phone has these changes. No new
question for Sam. This is a continuation of all five items, not completion.

New measured findings and changes:

- Expanded the annual witness to carry a real knee report for three elapsed
  weeks, across block/phase rollover, then verify actual resolution and restart.
  Corrected the witness's phase-local week-13 clear: Off-season ends at week 12,
  so that test had failed to issue its own clear. This was a TEST defect, not
  evidence of a resolved injury reactivating in the app.
- Source-fact generation now keeps the accepted block's progression anchor.
  The old week-local cutoff re-spent logs during restart and changed loads.
- Injured lower/full-body days use the composer's safe upper ladder before
  row selection; the safety contract filters its existing required patterns
  instead of overriding equipment exclusions. Sprint/running permission reaches
  the scheduler, including its reservation of standalone running days. Off-feet
  conditioning can remain attached to strength instead of consuming a rest day.
- The first full carried-injury run reached all 416 athlete-weeks: 401 passed,
  15 failed across two distinct three-day profiles. The failures exposed full-body
  days retaining prohibited lower patterns or losing strength frequency. After
  extending the same safe-ladder substitution to full-body days, BOTH affected
  profiles reached 52/52 weeks each with zero failed checks in
  `/tmp/testtruth-three-day-fullbody-fixed.log`. Full eight-profile rerun is
  currently `/tmp/testtruth-year-final-fullbody.log`, not yet a receipt.
- Trip Clear now resolves its exact paired equipment report in the same atomic
  input transaction; an unrelated equipment report with the same dates survives.
  Failure/readback rollback and restart are executable checks, not prose.
- Deleted the remaining `reversibleAdjustmentTransaction` snapshot restoration.
  Public Clear resolves an exact source fact or routes the exact latest accepted
  decision through existing Undo. Orphan/older unmatched presentation records
  are refused, never used to overwrite derived sessions. The old synchronous
  inspection exports cannot publish anything. Canonical suite exercises the
  actual Clear entry after injury resolution and restart: **553/553 assertions**,
  `/tmp/testtruth-canonical-no-snapshots.log` (before later full-body extension).
- Deleted unused Coach lighten/move/optional/weekly-rewrite functions and their
  unused dispatcher, after checking runtime references. Existing live exercise
  helpers remain; their publication boundary still needs ownership review.
- Census detector now distinguishes native read-only Array methods from opaque
  domain methods; callbacks/mutators/lookalikes remain detected. Detector controls
  **28/28** in `/tmp/testtruth-census-builtins.log`. Denominator changed because
  the instrument corrected false opaque calls, not because writers were approved.
  Last scan BEFORE latest deletions: **1,192 capability owners / 602 source files;
  667 distinct direct owners, 2,293 operation occurrences; 60 reviewed, 1,132
  unresolved**. Unresolved candidates are NOT 1,132 demonstrated bugs. Zero is
  still NOT PROVEN; do not bulk-refresh changed fingerprints.

Next work, still owned here:

1. Read final full-year result and rerun canonical verification after latest changes.
2. Finish source-input Clear for reachable stale-override controls: `programStore`
   `removeManualOverride` still deletes an output; used by `StaleOverrideBanner`
   and reset helpers. Do not simply classify it as a compiler. Review live
   exercise publication and exact reset boundaries too.
3. Finish the executable ownership review, including unresolved candidates.
4. Continue test/type debt. Product/dev scopes were zero before latest dead-code
   removal; test debt remains. Current fixes repair concrete types without casts
   or baseline increases. `workoutCanonicalisationTests` section 8 now verifies
   retired writer APIs are absent instead of demanding those writers return.
5. `sessionChangeSequenceTests` reached 19 passing / 3 failing checks through an
   obsolete installer/read path. It now uses real onboarding (including the
   required season-finished answer) and `deriveVisibleWeekLive`; rerun underway.
   Preserve its combined removal/swap/add/injury/restart subject, do not retire it.
6. Retire/rebind the old `coachActionsTests` dispatcher expectations and update
   `exerciseRemovalOwnerTests` to prove the dispatcher is absent. The production
   dispatcher has been deleted; do not reintroduce it to satisfy old tests.

What catches the next defect: annual carried-fact rollover coordinates, exact
fact/edit/ledger restart comparisons, Clear rollback/paired-report checks, plus
the fail-closed executable census. The global census/type prerequisites still
block release even when athlete-week checks pass.

NOT COVERED: device acceptance; global zero-owner proof; complete typecheck and
release gate; every possible injury/equipment/action combination; legacy orphan
adjustment Clear beyond truthful refusal. Current work is NOT a phone release.

## 28. Continued five-part compiler audit — 2026-08-27 (uncommitted)

Owner: testtruth. Sam confirmed Renee's clean install and resumed the complete
five-part request. No changes below are on either phone. No user decision blocks
the independent work. Do not report global ownership or the release gate green.

Measured progress since §27:

- Annual full-year run reached **416/416 green athlete-weeks**, eight distinct
  archetypes × 52 weeks, including carried injuries and phase/block rollover.
  `/tmp/testtruth-year-intent-owner.log` and later
  `/tmp/testtruth-year-acceptance-readonly.log`. Both overall gates remain red
  on the global ownership prerequisite. These receipts PRECEDE the newest
  atomic-Undo failure checks; a fresh full run is still required.
- Composer-owned strength intent now survives final assembly. The adapter no
  longer overrides it. Final-row acceptance includes intent conservation,
  missing-specialist detection and non-vacuous row-loss mutations.
- Found and fixed the onboarding severity-9 upper-body policy gap using the
  existing severity-band owner. `test:injury-severity-bands`: 35/35.
- Removed raw `removeManualOverride`, `clearManualOverrides`, warning dismissal
  that overwrote override ownership, unused rollback-constraint writer, unused
  surgical reset, and unused post-acceptance provenance repair. Stale warnings
  may offer Clear only for a uniquely identified current accepted adjustment;
  they no longer delete generated output. Unknown/orphan ownership is not
  guessed. This UI path has not been exercised on a device.
- Found a live second repair path in ProgramStore acceptance: it rewrote week
  overlays and compatibility workout fields after compilation. Acceptance now
  validates without those rewrites. The source assertion requiring the old
  second compilation was obsolete and replaced; real accumulated-world checks
  compare all candidate material before/after acceptance. An executable
  acceptance row-erasure mutation is now mandatory in the annual verdict.
- `test:canonical-weekly-compiler` reached **565/565**, followed by the new
  `test:reset-coach` **16/16** (`/tmp/testtruth-canonical-reset-gate.log`). This
  receipt predates the newest atomic-Undo change. The reset witness uses real
  onboarding, decisions, injury, logs, persisted data and restart; it caught
  generationAnchorISO/hydratedSeasonPhaseClock surviving reset. Both are now
  cleared by the existing full-reset owner. The diagnostic must flush pending
  storage writes before inspecting disk; an early read was not persistence loss.
- Earlier relevant receipts: injury journeys 127/127 after acceptance became
  read-only; combined exercise/session journey 22/22; §18 boundary 225/225 with
  28 real invalid-week mutations. These are scoped results, not app acceptance.

Current work / findings requiring follow-through:

1. Undo previously appended its reversal outside rollback. The remaining move
   test's persistence-failure subject is still relevant even though its old
   snapshot-restoration expectations are not. `coachMutationTransaction` now
   stages, snapshots, acknowledges and rolls back decision-ledger and athlete-
   preference inputs through their existing owners. Undo uses that same
   transaction plus synchronous `rebuildDerivedWorldNow`. Program rollback now
   also captures generation clocks, accepted block declarations and weight/band
   inputs. Verify all callers and regressions before calling this finished.
2. Annual source-fact journeys now inject failed writes at program, ledger and
   athlete-preference persistence, requiring exact memory/disk rollback and the
   same pending Undo target. Current logs: `/tmp/testtruth-injury-undo-faults.log`,
   `/tmp/testtruth-move-clock-fixed.log`, `/tmp/testtruth-product-atomic-undo2.log`.
3. Old move diagnostics: 12 checks passed; nine failures were in legacy Restore,
   migration and async Clear. Removed seven obsolete synchronous snapshot cases,
   retained live durable Clear/failure cases and rebound them to reversal
   acknowledgement. Their old fixture also omitted the app clock; Undo correctly
   used real August while the test asserted July. It now sets the journey clock.
4. Old deletion diagnostics: 16 failures, not 16 established product defects.
   Many demand automatic relocation after Bin, or exact old Monday/stacked seed
   layouts; others demand deleted snapshot restoration. Preserve relevant
   component/deletion guarantees through current real journeys while retiring
   those expectations explicitly. Do not restore the old author to green them.
5. Test types were 79 diagnostics on the last complete test-scope run, before
   latest cleanup. Product typecheck was zero before atomic Undo (a new union
   narrowing error was corrected). No baseline increases or excluded tests.
6. Global executable census is still unfinished. Latest saved scan before these
   deletions: `/tmp/testtruth-census-latest.json`. Remove retired review entries,
   review live writers individually and refresh fingerprints only after review.
   In particular `applyProgramOverrideWrite` also restores removal constraints;
   inspect whether that input effect is captured/reproduced canonically. Do not
   bulk-classify unknown functions or claim zero from the number of known bugs.

What catches the next defect: real compiler-output preservation at acceptance,
full reset/restart with a missing-reset mutation, actual persistence-failure
injection across the accepted input stores, accumulated annual journeys and the
fail-closed executable ownership census. No new product policy was inferred.

NOT COVERED: global zero-owner proof; final complete release gate; all diagnostic
test/type debt; native stale-warning Clear/Keep and full reset UX; physical-device
acceptance. No phone build should be made from this unfinished working tree.

## 29. Full request resumed — current verification, ownership still open

Owner: testtruth. Renee's clean reinstall was accepted by Sam; resumed the five
requested workstreams. No changes in this worktree have been installed or committed.

- All three typecheck scopes now report zero diagnostics, with no suppression,
  exclusion or baseline increase. Ratcheted scripts/typecheck-baseline.json to
  zero. Receipt: /tmp/testtruth-zero-type-baseline-update.log.
- Current compiler compound gate: 565 compiler checks, 16 reset checks, 139
  deletion checks and 69 hydration checks pass. Deletion reaches 17 distinct
  actual actions across eight onboarded archetypes (six strength, three
  conditioning, eight whole-day). Receipt: /tmp/testtruth-expanded-compiler-gate.log.
- Hydration found a real extra author: calendar rehydration independently
  published a repaired program before quiescent boot. Removed that callback;
  the guard now witnesses zero program publications while loading calendar
  inputs. Before: 68/69; after: 69/69.
- Program override publication no longer implicitly clears removal constraints
  or calendar marks. Those effects belong to accepted edit inputs, not saves.
- Undo persistence-fault checks pass (133 injury transaction assertions), covering
  program, decision ledger and athlete-preference write failures and exact rollback.
- Continuity diagnostic now drives two real archetypes through 20 reached weeks
  each, including accumulated edits and restart: 615 checks pass. The release
  witness remains the full eight-archetype annual gate, not this shorter run.
- Equipment/travel journey: 20 checks pass, including a real illegal-kit negative
  control, exact scoped clear and restart. Its first oracle wrongly treated RDL's
  old barbell metadata as exclusive; switched to authored exercise availability
  and verified the selected implement is dumbbells. No product rule changed.
- Explicitly retired obsolete snapshot restore, post-generation repair, retired
  recovery-addon author and hand-seeded layout expectations. Rebound relevant
  deletion/hydration/continuity tests to current compiler contracts; census now
  has eight current contracts, still the same six deduplicated release units.
  Other rewritten diagnostics are not automatically claimed current or green.

Remaining: executable ownership review (last scan: 83 reviewed, 1087 unresolved
capability owners); remove remaining calendar compatibility authors; verify
relevant rewritten diagnostics; rerun annual and complete release gate. Last
annual reached 416/416 required athlete-weeks with programming checks green,
but the complete gate is red on ownership. No user decision currently blocks us.

Next-defect protection: real removal/restart journeys, calendar hydration
publication counter, acceptance row-erasure mutation, durable Undo fault injection,
authored equipment oracle with a real negative control, and fail-closed ownership
reviews. Unknown owners are not treated as product bugs or approved implicitly.

NOT COVERED: complete ownership proof, final release gate on latest changes,
all legacy diagnostic runtime expectations, native stale-warning UX and physical
device acceptance of this unfinished worktree.

## 30. Calendar/snapshot retirements and current-contract test rebinding

Owner: testtruth. Removed five unused calendar/program-setup repair functions,
the calendar fixture action methods, their rebuild fallback, and the arbitrary
post-rebuild calendar callback. Weekly fixture rebuild now requires the exact
accepted typed effect. Calendar reset clears inputs without repairing a partial
world; its suite is 19/19 including a real fixture and publication mutation.

Removed three unused explicit-load snapshot/delta helpers. Replaced their old
hand-built test world with real fact and lighter-day decisions: 66/66 checks,
including independent report Clear preserving the linked lighter decision across
restart, and resolving the linked report restoring the original dose.

Fixture suite is now real onboarding: 14/14. Fixed obsolete expectations that
equated an explicit calendar mark with an effective standing fixture, required a
no-game mark without a standing fixture, read generated output from disk, and
counted every system diagnostic root as another athlete action. Coach-note
metadata now reaches an actual occupied-day move; a same-layout fixture move
legitimately need not create an explanatory training-change note.

Exposure suite is 160/160 after retiring nine demands for fatigue-driven exercise
removal, explicitly prohibited by the existing July readiness rule. Override
boundary suite is 7/7 after selecting the actual target-day generated workout
instead of assuming it is the first array element. No product policy changed.

The two rewritten fixture/fact suites join the canonical compiler release witness.
Test-truth: 10 current contracts, 159 rewrite-test rows, unchanged six deduplicated
release units. All product/dev/test type scopes remain zero; baseline remains zero.
Latest completed compiler compound run before adding these two witnesses: 568
compiler, 19 reset, 139 removal and 69 hydration assertions green.

Ownership review: 22 more individual accepted-transaction/projection/input owners
reviewed. Last pre-detector-update census: 1153 candidate owners, 108 reviewed,
1045 unresolved. A narrow AST proof recognizes only existing-reference readers;
it does not infer that an immutable transform is harmless. Its mutation checks
found a detector hole: a spread-only object loses the Workout type alias, so it
could escape the previous return-type check. Added explicit semantic spread
inventory; now rerunning mutation controls and reviewing changed inventories.
Do not refresh fingerprints wholesale or claim zero while unresolved owners remain.

Receipts: /tmp/testtruth-fixture-real-final.log,
/tmp/testtruth-facts-real-lighter-clear.log, /tmp/testtruth-exposure-current3.log,
/tmp/testtruth-override-current2.log, /tmp/testtruth-fixture-ingress-guard.log,
/tmp/testtruth-no-snapshot-types.log, /tmp/testtruth-ten-contracts.log.

NOT COVERED: complete ownership proof, latest complete release gate, all legacy
diagnostic runtime expectations, native/device acceptance. Current changes are
not committed or installed. No unresolved user question; continue the five steps.

## 31. Compiler/view injury ownership finding (2026-08-27, continuing)

The new compiler-to-visible comparison caught a real second author: after one
of two injuries was cleared, rendering added a Bodyweight Squat absent from
compiler output. Receipt: /tmp/testtruth-injury-view-boundary-before.log.
Moved session-level injury adjustment into canonicalWeeklyInjuryCompiler and
removed that author from sessionResolver. Facts now pass 73/73 assertions,
including injected render-only row and dose mutations; two accumulated journeys
pass 667/667 assertions across 40 reached athlete-weeks. The annual checker now
requires the same compiler/view invariant every week. Verdict controls: 39/39.

The next relevant check is preview-to-acceptance consistency. Existing injury
review and adjustment diagnostics are red (10 and 6 assertions respectively),
and both install generated data by bypassing real onboarding. Rebinding the
review to real onboarding before deciding which expectations are stale. No
claim yet that its preview promises exactly what the compiler accepts.

Ownership controls now pass 31/31, including the spread-only mutation. Latest
completed census before moving injury rendering: 239 reviewed of 1163 distinct
capability owners; 924 unresolved. These are candidate executable functions,
not 924 confirmed alternative authors. Source changes require fresh reviews.

NOT COVERED: injury preview acceptance, final ownership zero, fresh full-year
and complete release pass, current-source device acceptance. The annual run
was deliberately stopped when the render-author defect was found; its partial
log is not a passing receipt. No user choice is blocking independent work.

## 32. Shared injury stage and full-year findings (2026-08-27, continuing)

Preview and accepted injury folds now call the same pure injury stage. Injury
preserves accepted safe strength rows instead of regenerating the entire session.
Real-onboarding review checks pass 76/76, including row/dose agreement and no
preview publication. Adjustment checks pass 54/54, including specific injury
region mapping and conditioning-change disclosure. These are targeted receipts,
not proof of every injury-update preview: severity decreases and future-day
preview ordering still need measurement.

Replacement compounds now declare typed main roles and balance across the week;
blocked conditioning uses the existing capability-substitution owner. Two
accumulated journeys pass 667/667 assertions across 40 reached athlete-weeks.
The full-year run reached all 416 athlete-weeks, with 372 green; remaining
programming failures are conditioning shortfalls and promotion of lighter days
to main-strength days. The latter has a subsequent source fix not included in
that annual process. Lost sprint-only conditioning is a hypothesis to measure,
not yet an established cause. Restart comparisons passed throughout that run.

Removed two unused authors: coachingEngine.enforceInSeasonPushPullBalance and
programHydrationProjection. Replacement generated-program balance checks pass
42/42; current hydration checks pass 75/75. The old slice4 hydration probe now
explicitly refuses as retired rather than testing unreachable production code.
Deleted tracked files remain recoverable from HEAD. No athlete data deleted.

Latest completed ownership census: 319 reviewed / 1151 distinct executable
capability owners, 832 unresolved. Zero confirmed rivals is NOT a zero-owner
proof while those candidates remain unreviewed. All-scope types were zero at
the last completed check; subsequent edits require a fresh check.

Receipts: /tmp/testtruth-review-conditioning-disclosure.log,
/tmp/testtruth-injury-conditioning-disclosed.log,
/tmp/testtruth-continuity-injury-conditioning.log,
/tmp/testtruth-year-injury-owned-components.log,
/tmp/testtruth-retired-balance-author.log,
/tmp/testtruth-hydration-retired-author.log,
/tmp/testtruth-owner-round4.json.

NOT COVERED: complete ownership proof, remaining annual failures, complete
release pass, severity-decrease/future-date preview matrix, native/device QA.
Current work is uncommitted and not installed on either phone. Renee's earlier
clean reinstall was confirmed by Sam; that interruption is finished. No user
decision is currently blocking independent work.

## 33. Accumulated injury edits and refusal safety (2026-08-27, continuing)

The real annual probe established why conditioning vanished: the injury overlay
kept whole old sessions and discarded the canonical planner's replacement for
lost field/sprint exposure. It now combines accepted strength with that planned
conditioning, protecting athlete-owned dates and fixtures. The next full run
passed 398/416 athlete-weeks; the remaining 18 were main-strength overcounts on
two high-frequency female archetypes, not conditioning failures.

Those overcounts were traced to an unchanged Primer bench press being
reclassified from accessory to main during injury compilation. Existing typed
row roles now survive the evidence-envelope refresh. A real ten-week female-5
probe reports no failed checks. Full annual rerun is still running; it predates
the following accumulated-edit transaction change and is not a final receipt.

Preview now executes the same pure source-fact compiler from a captured
pre-fact continuation, then the normal visible projection. Severity decreases
previously failed four measured previews; restored/withdrawn rows are now
disclosed. The continuation is ephemeral, excluded from persistence, and part
of transaction rollback. A new injury-then-exercise-edit witness found the
continuation was cleared without reconstruction. Exercise decisions now append
inside the durable transaction and rebuild through the same compiler before
success, with ledger failure rolling back instead of leaving an unrecorded edit.

A real no-equipment, overlapping upper/lower restriction witness also caught
conditioning feasibility returning the rejected original. Refusal now strips
conditioning through the shared component remover, retaining other safe rows.
The expanded preview matrix passes 116/116 assertions across six real profile/
day coordinates plus four generated conditioning days, including accumulated
edits, severity reduction, restart, role preservation and dose mutation controls.
Receipt: /tmp/testtruth-preview-accumulated-final.log.

Latest completed ownership scan before the last 27 explicit reviews: 457
reviewed / 1156 distinct capability owners, 699 unresolved. Actual diagnostic
writers found in devE2ESeedRegistry (one-set prescription, stacked identity,
layout name/row copying) and the removable-component seed branch still require
routing through accepted inputs. They are not exempt merely for being dev code.
No zero-owner claim. Prior compound compiler witness passed; a fresh compound
run is /tmp/testtruth-compiler-atomic-edits.log. No commits or phone installs.

NOT COVERED: final full-year/release gate, complete ownership proof, final
all-scope typecheck after these edits, native UI/device acceptance. No user
choice is blocking the independent work.

## 34. Seed authors retired; fresh annual exposed improving-injury gap (2026-08-27)

The one-set and layout diagnostic seeds now use accepted program-control actions,
not prescription/name/row copying. Their real-onboarding witness passes 12/12:
missing-action negative controls, one ledger append, exact visible target,
restart, and latest-action Undo. Stacked-team seed uses the real generated
identity. Identity-preserving seeds retain deterministic timestamps/date bounds.
The unused substituteExercise builder was deleted. No athlete data was deleted.

Removed the unused hard-coded DEFAULT_PROGRAM and its three private builders
from runtime. Three historical fallback probes now explicitly exit as retired,
and obsolete fallback sequencing assertions were removed. Onboarding failure
still uses the existing no-fallback outcome owner. Writer detector controls pass
32/32, including four negative controls reintroducing the retired builders.
Source is recoverable from HEAD. No changes committed or installed on phones.

Rebound the two current fact-release suites to real cold onboarding and current
compiler semantics. They no longer demand stored adjustment snapshots or erase
an athlete edit when clearing an illness. Latest receipts: deriving 9/9 and
horizon 14/14. All-scope typecheck reports zero product/devtools/test errors.

The initial full-year run after the injury-row role fix reached 416/416 green
athlete-weeks, but it predated the added severity-decrease journey. The fresh
complete release attempt reached only 371/416: the low-availability bodyweight
athlete stopped in week eight at knee 9 -> 3. This is one reached failing
journey, not 45 independent programming failures. The other 45 athlete-weeks
were NOT REACHED. Overall release was 1/6 units green (fail-fast after annual).

The captured scheduler input proved a double-reservation: with sprint restricted,
two gym days and a deload, the running-floor pass exchanged both off-leg gym
slots for runs despite already budgeting standalone runs. It attempted five
running days and was correctly refused by WC-046. The scheduler now counts its
already-budgeted standalone conditioning before reserving extra running slots.
No running ceiling or programming target was relaxed. A 12-coordinate pure-input
matrix (2/3/4 gym days x build/deload x sprint allowed/restricted) plus the injury
preview journeys passes 152 assertions. The exact accumulated annual athlete
now reaches all 52 weeks; the remaining full-year run is still in progress.
Improving-injury identity and restart are now mandatory annual gate cells.

Latest completed census before the last 15 reviews: 675 reviewed / 1149 distinct
executable capability owners, 474 unresolved. Zero confirmed rivals remains NOT
a zero-owner proof. Further review includes the unused section18OfferPlacement
author, fixture candidate helpers and transaction boundaries. Prior seat rulings
explicitly protect built-but-unwired mobilityPairing/timeTrialSession work from
deletion; these remain intact and unclassified pending the appropriate ownership
decision, not silently deleted to lower the count.

Receipts: /tmp/testtruth-seed-actions-final.log,
/tmp/testtruth-owner-controls-default-retired.log,
/tmp/testtruth-release-complete-round.log,
/tmp/testtruth-severity-probe.log, /tmp/testtruth-severity-probe-fixed.log,
/tmp/testtruth-running-reservation-after.log,
/tmp/testtruth-types-running-budget-fixed.log,
/tmp/testtruth-deriving-after-budget.log, /tmp/testtruth-horizon-after-budget.log,
/tmp/testtruth-year-running-budget-fixed.log, /tmp/testtruth-owner-round10.json.

NOT COVERED: completed ownership proof, final full-year and complete release
pass, historical diagnostic-suite rewrites, native UI/device acceptance. Renee's
earlier clean reinstall is already confirmed; do not repeat that interruption.
The current dirty work is not on either phone. Continue the full five-part task.

## 35. Injury relocation, durable derived edits and travel ownership (2026-08-27)

The next annual run reached all 416 required athlete-weeks, 415 green. The one
failing week was the two-day bodyweight athlete's pre-season deload: injury
planning moved restricted sprint work to a previously empty Tuesday, and the
source-fact merge discarded that new day. The merge now retains planned injury
conditioning on unowned empty dates while preserving explicit athlete placements,
removals and games. A real accumulated 24-week probe reached that exact case.
That probe then exposed a stranded conditioning warm-up on the old Sunday. A
standalone energy session now moves with its warm-up; the annual invariant
energy_session_content rejects Conditioning containers with no energy component.
Before/after probe receipts demonstrate both failures and their corrections.

Derived warm-up/add-on edits had bypassed the durable mutation transaction.
Injecting a failure in decision-ledger-store yielded false success and a changed
in-memory session (9 checks passed, 2 failed). The existing shared transaction
now contains the exact decision append and recompilation; 11/11 checks pass,
including real onboarding, restart, latest-action Undo and failed-save rollback.

The ownership review found travel filtering still authored inside sessionResolver.
It now runs in the canonical final-constraint compiler; the resolver only selects
accepted surfaces. Two real athletes (male three-day, female four-day) pass 12/12
travel/restart/clear checks. Disabling the canonical span input fails four checks.
The detector rejects reintroducing the retired read-side writer (34/34 controls).
A combined club/gym day also now clears its club identity when travel removes
the club component, instead of retaining a ghost team-training anchor.

Team-night safer substitutions changed display names without changing exercise
IDs. They now use the shared canonical exercise-edit transform. The added identity
check fails before the change (9/1) and passes afterward (10/0). This is a unit
receipt, not a claim that the full safer-move/restart journey has been measured.

Latest completed census: 827 reviewed of 1143 distinct executable capability
owners, 316 unresolved; further explicit reviews are in progress. This is not a
zero-rival proof. All three type scopes report zero errors. The fresh annual run
and full canonical compound are in progress. The first compound run exposed a
stale source assertion after moving travel; its boundary/mutation guard was updated
and passes 8/8 directly. No tests or baselines were relaxed to absorb product red.

Receipts: /tmp/testtruth-year-running-budget-fixed.log,
/tmp/testtruth-orphan-invariant-before.log,
/tmp/testtruth-orphan-invariant-after.log,
/tmp/testtruth-derived-durable-before.log,
/tmp/testtruth-derived-durable-after.log,
/tmp/testtruth-travel-owned.log, /tmp/testtruth-travel-mutant.log,
/tmp/testtruth-writer-controls-travel.log,
/tmp/testtruth-team-identity-before.log, /tmp/testtruth-team-identity-after.log,
/tmp/testtruth-owner-round13.json, /tmp/testtruth-types-current.log.

NOT COVERED: complete ownership proof, completed fresh annual and release gate,
real safer-team-night move/restart, native UI and device acceptance. No user
choice currently blocks the independent work. No commits or phone installs of
this dirty work have been made; Renee's confirmed reinstall remains complete.

## 36. Annual green weeks; picker author retired; fixture-save fault fixed (2026-08-27)

The annual run in /tmp/testtruth-year-compilation-final.log completed 416 green /
416 reached / 416 required athlete-weeks across eight distinct athletes. Its
single failure key is the unresolved executable-owner prerequisite. This is NOT
a green release. The run predates the subsequent picker and fixture-durability
changes below. The later canonical compound completed with exit 0 in
/tmp/testtruth-canonical-templates-final.log (also predates the fixture-save fix).

Ownership review found manually added strength sessions using the independent
tag selector. The picker now invokes compileCanonicalStrengthTemplate, which
uses the same composeWeek/materialiseComposedWeek as generated rows. The input
adapter carries the requested date, actual phase clock/block identity, dated kit,
injury prohibitions, exclusions, pins and recorded selections. No name-derived
intent or hard-coded generic 3x8-10 recipe remains in that path.

Removed buildTagAwareSession and the runtime exerciseScorer module. The historical
scorer is retained ONLY under tests/support/legacyExerciseScorer.ts for old
diagnostics; no runtime imports it, and the census rejects importing excluded
test code. The standalone old tagSystemTests entry now runs the current real-
onboarding picker witness. Historical strength-intent/counting/main-pattern
diagnostics explicitly import the test-only snapshot and are not product to-dos.
These removals are recoverable from HEAD; no athlete data was deleted.

The new picker witness first failed 22 checks (21 template builds + old selector
call). It now passes 59 checks: all seven variants for three real athlete profiles
(all phases; bodyweight/gym; male/female), canonical row identity/roles, legal kit,
Add/restart/Undo, future-date equipment/restart/clear, injury/restart, and a runtime
mutation proving a broken shared composer cannot be bypassed. Three intermediate
restart failures were timestamp-only, not changed exercises or dose. The shared
materializer now stamps the explicit session date, including embedded exercise
metadata, instead of the device clock. The exact serialized checks now pass.
Receipts: /tmp/testtruth-strength-template-before.log,
/tmp/testtruth-strength-template-matrix.log,
/tmp/testtruth-strength-template-diff.log,
/tmp/testtruth-strength-template-final.log. All-scope typecheck was zero after
these changes: /tmp/testtruth-types-templates-final.log.

Further save-fault testing found Add/Move/Remove fixture decisions were appended
AFTER the durable transaction. Injecting a write failure only when the new fixture
decision appears produced six failures: each action reported success and retained
changed memory while restart discarded it. The append is now inside the existing
atomic mutation. /tmp/testtruth-fixture-durable-before.log is 20/6;
/tmp/testtruth-fixture-durable-after.log is 26/0. The existing fixture family also
passes 14/14 (/tmp/testtruth-fixture-family-after.log). The shared derived-edit
durability suite now includes all three fixture failure coordinates.

Removed the unreachable buildConditioningSession read-side author and its private
duration/intensity defaults. It has no runtime or test callers; its old resolver
placement loop was already retired on 2026-08-19. The actual template builder
used by canonical generation remains intact. The independent conditioning ease
policy remains intact too; its old wrapper was not a live feature. Runtime guard
controls now reject restoring both retired strength paths and this conditioning
wrapper (latest run still in progress at this checkpoint).

Latest completed census before the last reviews: 889 reviewed / 1147 distinct
executable capability owners, 258 unresolved. More explicit reviews followed;
/tmp/testtruth-owner-round15.json is running. Review queue round11 is stable;
read-through now reached index172. Newly read but not yet registered:159–164,
166,168–171;165 changed for fixture durability;172 was deleted. New/changed
helpers must use a fresh census fingerprint, not the old queue. The unresolved
protected timeTrialSession/mobilityPairing work remains intact. Do not claim zero.

NOT COVERED: completed ownership proof and final complete release gate, a fresh
annual run after picker/fixture changes, real safer-team-night move/restart,
remaining historical diagnostic rewrites, native UI/device acceptance. No new
phone build or commit. Continue the whole five-part task, not just a first slice.

## 37. Executable ownership green; final complete release run pending (2026-08-27)

The resumed task is ALL five parts, not another isolated compiler slice. Renee's
reinstall is already confirmed by Sam; no further install or wipe was performed.

The executable census now reports 1137 reviewed / 1137 distinct capability owners,
with 2353 direct operation occurrences across 629 direct owners in 602 source
files. There are 0 unresolved owners, 0 confirmed rival authors and 0 direct
derived-output writers. Receipt: /tmp/testtruth-writer-zero-final.log. Reviews
include module initialisers, persistence adapters, UI retry cycles, source-fact
compilation, the canonical scheduler/composer/materialiser, and their callers.
This is a static executable-capability proof, not a claim that all UI behaviour
has been exercised.

Four capabilities in TWO protected, never-wired modules remain in that denominator:
data/timeTrialSession and rules/mobilityPairing. They are explicitly classified
dormant_quarantined, NOT canonical compiler helpers. Two options were compared:
activate/delete that authored work during ownership cleanup, or preserve it with
an enforced runtime boundary. The latter was chosen. Any runtime import, export,
require, alias loader or lazy import of either module now fails the release gate;
unresolvable dynamic module loaders fail closed. Arbitrary functions cannot be
assigned the quarantine classification. Their source remains fingerprinted, and
the inventory prints their separate count. This does not ship either feature.
The new controls first failed three checks; all 41 detector controls now pass.
Receipts: /tmp/testtruth-quarantine-before.log, /tmp/testtruth-quarantine-after.log.

Other completed work since section 36:

- Removed the unused buildPlanChangeProposal author (no app callers, only an old
  synthetic test) and its private helper. The old test command now imports the
  real canonical action/restart matrix; 604/604 checks pass in
  /tmp/testtruth-plan-change-current.log. The census rejects restoring the author.
- Removed diagnostic seed identity/timestamp rewriting. All 17 seed programs
  retain EXACT canonical output; two real accepted seed-edit journeys additionally
  survive restart and Undo: 29/29 checks in /tmp/testtruth-seed-identity-after.log
  and the later weekly-writer gate. No athlete data was deleted; removed code is
  recoverable from git.
- Rebound the seed registry's stale empty-day, fabricated arms-session ID,
  conditioning-profile and manifest assumptions. Zero team nights is now valid;
  the conditioning showcase uses real pre-season/no-fixture/no-club answers.
  The timezone diagnostic measured only metadata/local-noon differences; its
  observation now compares ALL training data and calendar days, with a mutation
  proving prescription/identity changes remain detectable. 87/87 checks in
  /tmp/testtruth-seeds-current.log. No production output is normalised by that test.
- Rebound derivedRepairOwnershipTests to actual onboarding plus accepted Add,
  legacy rest-input compilation, and restart. It preserves the accepted ledger,
  does not fabricate manual overrides, and rejects acceptance-boundary rewriting.
  13/13 in /tmp/testtruth-derived-ownership-real.log. Added to the canonical gate.
- Added real occupied-team-night move/restart/Undo across male/female and both
  swap_safe/keep_regular choices. Initial six failures were fixture reachability
  assumptions (the selected archetypes did not contain the presumed Back Squat),
  not six product defects; the corrected real profiles reach the named shape.
  32/32 pass, even with the old live swap resolver poisoned during restart.
  /tmp/testtruth-team-move-final.log; included in test:team-night-content and the
  canonical compiler gate.
- All three typecheck scopes are zero: /tmp/testtruth-types-final.log. Baseline
  remains empty. The canonical compound passed with exit 0 in
  /tmp/testtruth-canonical-complete-final.log (the newly added team-night/repair
  witnesses were also run separately and will run in the final full command).
- Test-truth bootstrap passes. Historical proposal tests are an aggregate alias;
  repaired seed fidelity is test infrastructure. Neither can dictate restoration
  of old programming. The remaining historical rewrite labels are not app bugs.

Final release is STILL PENDING at this checkpoint. The annual run that began
before the last ownership reviews is completing in
/tmp/testtruth-release-full-final.log; its prerequisite correctly remains red
for the older snapshot. Run the complete release command again against the final
state and record its actual exit. Do not turn that earlier report green by editing
its result. Annual HTML is still generated solely from the gate result.

NOT COVERED: physical UI/OS process-death/device acceptance; three older Maestro
tapes (readiness-holds-load, conditioning-one-prescription, swap-load) still carry
obsolete seed/content assumptions and were not run or claimed current; the wider
historical diagnostic fleet; integration of the two quarantined features; full
transitive clock purity (training semantics are checked, audit timestamps are not).
The picker carries real selection history, but progressedIdentities remains empty
in its context adapter; no new history-nudge equivalence claim is made. No commits
or phone builds of these working-tree changes have been made.

## 38. All five compiler steps verified; complete release gate green (2026-08-27)

`npm run test:release` completed with process exit 0 and `RELEASE_GATE_EXIT=0`:
**7/7 executable gate units green**, covering ten current product contracts plus
test-truth bootstrap and real all-scope typechecking. The actual typecheck was
missing from the earlier release runner (it ran only the typecheck-tool controls).
That gap is now closed: missing/redirected typechecking and a real typecheck failure
each block release. The three new controls first failed; releaseGateContractTests
now passes 14/14. Receipts: /tmp/testtruth-release-types-before.log and
/tmp/testtruth-release-types-after.log.

Durable receipts in `outputs/compiler-year-acceptance/`:

- `release-testtruth-2026-08-27.log`: the complete seven-unit command output.
- `result.json` and `index.html`: 416 green / 416 reached / 416 required
  athlete-weeks, eight distinct profiles x 52 weeks, zero distinct failure keys.
  All four real-production mutation witnesses are green (each caught its injected
  defect); HTML is a presentation of this same result, not another audit author.
- `verified-source-testtruth-2026-08-27.json`: 1330 code, test, script, config and
  Maestro files hashed; start and end hashes matched exactly:
  `09b5bda50b5fc169c2c69e90ee8f83c90d2e3b5d3c9455e0df041287d7756b0a`.
  This identifies the tested working-tree source; HEAD remains 5e7caee7.

Five-part outcome:

1. Injury/source-fact changes and reopening share canonical compilation. Real
   injuries, dates, clear/resolve, accumulated athlete edits and restart are in
   the current gate rather than a detached report.
2. Adjustment clearing no longer independently edits generated content. The
   canonical source-fact/clear/Undo paths and input-only compatibility persistence
   passed the complete command, including the real rest-ingress/Add/restart case.
3. Executable ownership gate passed: 0 rival authors, 0 direct derived-output
   writers, 0 unresolved / 1137 reviewed capability owners. The FOUR protected
   dormant functions remain counted and guarded against runtime imports; they
   are not falsely described as integrated compiler helpers.
4. Actual app, devtools and test typecheck scopes each report zero errors; baseline
   remains empty. Test-truth census reports 351 diagnostic units, zero missing
   commands and zero unrunnable files. Historical assertion failures are still
   diagnostics, not permission to restore obsolete app behaviour.
5. Annual acceptance and the COMPLETE release command passed. The old six-unit
   command also passed; the seven-unit run above is the final authority.

Next defect of these classes: changing an executable owner's body/callee graph or
adding a writer invalidates its review; prohibited imports and retired authors
fail even if someone attempts to classify them as approved. Full-year invariants,
real live/restart/Undo comparisons, save-fault rollback checks and compiler mutation
controls run through the same release command. Type failures now block it too.

Questions for Sam: none blocks these five compiler steps. The preserved accessory-
mobility pairing and 2 km assessment-session features still need deliberate compiler
integration if they are to ship; this task did not silently activate them. Recommend
reviewing this compiler checkpoint before adding those feature integrations.

NOT COVERED: physical-phone/OS-process-death acceptance, remote persistence, the
three older Maestro tapes named in section 37, the wider historical diagnostic
fleet, integration of the two runtime-quarantined features, and transitive metadata
clock purity. Those caveats have not been converted into passing claims. No new
phone installation or commit; gates green, awaiting device acceptance. `git diff
--check` passes, and no athlete data was removed by this resumed work.

## 39. Verified checkpoint and Sam clean-install request (2026-08-28)

Sam explicitly authorized saving/committing this work, rebuilding, and wiping
LFA on HIS phone for fresh onboarding. Scope is the LFA app and its local data,
not a device erase, cloud-data deletion, or any change to Renee's phone.

Before committing, re-ran the source fingerprint over 1330 files: exactly
09b5bda50b5fc169c2c69e90ee8f83c90d2e3b5d3c9455e0df041287d7756b0a, matching
the start/end fingerprint of the complete 7/7 release run recorded in section 38.
Re-read its exit-0 receipt; git diff --check is clean. No application code was
changed for this deployment. The completed work is this seat's accumulated
five-part compiler task; unrelated outputs and .fuse_hidden files remain intact
and outside the commit. Other seats' latest status records were checked.

Compared updating the existing install with a clean install. Sam expressly asked
to start fresh, so build and verify the signed product BEFORE uninstalling LFA.
Apple device discovery identifies Sam's paired iPhone 16 Pro Max as
AFA21856-881E-587B-96D5-60817FD11018; Renee's distinct device is not targeted.

Removed-author replacement map remains sections 25–38: injury/clear/travel use
canonical source-fact/constraint compilation; seed edits use accepted actions;
strength templates use the canonical row composer; old synthetic diagnostic
authors are current compiler witnesses or test-only historical support. No
authored pairing/time-trial feature is deleted or activated. Verification of
the next defect class remains the complete release gate and its mutation arms,
not this native packaging step.

NOT COVERED: installation/launch still pending here, Sam's physical acceptance,
the three old Maestro tapes, protected feature integration, remote persistence
and transitive metadata clock purity. No new programming or UI changes in this
deployment task. The build/install receipts will be appended after execution.

### Installed checkpoint and receipts

Committed the reviewed paths as `3a8a3bd654c0cc0b5b40bdeddaf21be1df398aee`.
The tracked working tree was clean before and after the native build; only the
unrelated outputs and two .fuse_hidden files remained untracked. The 1330-file
source fingerprint still matched the verified release source after native build.

Built from scratch into `/private/tmp/lfa-release-testtruth-20260828.4Y6cTa`:
Xcode Release build exit 0, `** BUILD SUCCEEDED **`, signed bundle
`Build/Products/Release-iphoneos/LocalFootyAthlete.app`, bundle identifier
`com.localfootyathlete.app`. Embedded main.jsbundle is present, SHA-256
`0df72a31061b969a1bbc8bca2ba5f555107d280fd4e636d74ed82f92d4d87bd4`.
Strict/deep codesign verification passed with macOS trust services accessible;
the initial sandboxed trust check could not access them and was rerun outside
the sandbox. No signature or trust policy was bypassed or changed.

Sam's identified device reported transport `localNetwork`. At 06:41 Melbourne:
LFA uninstall exit 0, clean install exit 0, foreground launch exit 0. Receipt
JSONs in the build directory: uninstall-sam.json, install-sam.json,
launch-sam.json. The app's process 44480 remained running at 06:42:16, confirmed
by process-sam-verified.json. An earlier diagnostic filter attempted CONTAINS
on Apple's URL-valued executable property and failed; filtering by the exact
launched PID succeeded. This was a diagnostic command error, not an app crash.

Only LFA's local app container was removed under Sam's express authorization;
no backup of that old container was taken and this task cannot recover it.
No device erase, remote data deletion or changes to Renee's installation.
No UI automation filled onboarding or altered the fresh athlete setup.

Sam's suggested acceptance: onboard normally, inspect the week, add/move a
session or game, declare/clear an injury, fully close/reopen, and check those
choices remain. Native launch success is not visual acceptance of those flows.

NOT COVERED: Sam's physical UX acceptance and new non-seeded on-phone journey,
three older Maestro tapes, dormant accessory-mobility/2 km feature integration,
remote persistence and transitive metadata clock purity. Release gates remain
green for this exact source; awaiting Sam's device acceptance.

### Sam's week-edit/reopen acceptance (2026-08-28)

Sam reported: "yep i changed the week exited the app and it was still the same".
Accepted on his physical iPhone: the week changes he made remained after exiting
and reopening the installed app. This is a user-observed check, not a newly run
automated tape. The exact edits and OS termination method were not specified;
do not turn this into a claim that every action or true process-death route was
tested. No code, app state or phone installation changed in recording this.

NOT COVERED by this confirmation: fixture/injury/Undo combinations individually,
the full fresh-onboarding/phase-change journey, broader UX and compiler re-audit,
or the previously listed unintegrated features and older Maestro flows.

## 40. All active modifier sources share the Program/My Status projection (2026-08-28)

Owner: testtruth. Sam: "anything that effects the program should be listed - as
a modifier that pops up and shows up in my status". R-262 and
LAW-all-program-effects-visible bind this to `test:modifier-lifecycle`, a new
current contract in the small release gate. R-249's direct navigation remains:
the Program notice opens My Status, with no restored intermediate popup.

Compared separately patching each screen's filters with one read-only snapshot
of canonical facts, accepted edits and typed week metadata. Chose the shared
snapshot: Home passes the displayed week; My Status receives that week in its
route and uses the existing visible-week resolver. The count is the length of
the same list. Neither screen writes generated sessions or a persisted list of
modifiers. Existing compiler, fact transactions, preference owners and Undo
remain the only mutation mechanisms.

### Measured gaps and replacement map

- Time caps were explicitly filtered from Program. They now have the visible
  `session_time_limited` effect; creation UI/programming policy is unchanged.
- Injury/readiness/equipment visibility depended on matching workout prose.
  Removed those inference helpers; canonical active facts now supply identity
  and visibility even when descriptions are absent or change.
- Mild readiness reports were correctly record-only, but choosing the existing
  lighter-day opt-in changed training without a clearable Status row. The row
  now comes from the accepted lighter-day effect and its exact source fact.
- Composed same-kind constraints hid individual accepted reports. Display now
  projects each accepted fact separately; the compiler still combines their
  effects exactly as before. Clear addresses the selected fact ID, not an
  ambiguous shared constraint or displayed note ID.
- Old dismissed-note IDs could conceal effects still changing the program.
  They no longer filter active notes; active rows have no Dismiss action. Old
  saved IDs and ledger records are preserved, not rewritten or deleted.
- An accepted practice-match change survived restart but its transient
  adjustment note vanished. Status derives the fixture row from the stable
  decision ID and matches the reconstructed adjustment through the existing
  identity helper. Latest fixture-layer decision per affected week is shown;
  it is not an event-history list of superseded fixture resolutions.
- Manual session constraints lacked modifier rows. Current active session
  constraints are now joined to accepted edit identities for Add/Move/Swap/
  Remove copy. Only the exact latest undoable change exposes existing Undo;
  older active edits remain visible without inventing an out-of-order Undo.
- Scheduled deload comes from typed `deloadDoor`/`dosePolicyByDay`, read-only,
  rather than guessing from a week label or a phrase in workout notes.

Test-first receipts include `/private/tmp/testtruth-modifiers-session-before.log`
(215 assertions passed, 2 failed: accepted removal row absent live and after
restart). The fixture restart and time-cap/prose/opt-in defects were likewise
observed in the preceding lifecycle runs before their projection changes.

The simulator restart checkpoint also failed for a different, test-only reason:
it expected fact-derived readiness/constraint mirrors to exist on disk. Fixed
the TWO existing descriptor selectors in `devE2EPersistence.ts` to call the
same `readinessInputsForPersistence` and `constraintInputsForPersistence` owners
used by app persistence. No duplicate saved output, new harness, seed author or
store descriptor was introduced. A new executable control confirms the
checkpoint agrees with canonical disk inputs AND rejects a removed program
store. The observed failing checkpoint is in
`/private/tmp/testtruth-modifiers-ui.log`.

### Verification and next-defect protection

`test:modifier-lifecycle` drives real onboarding and production apply/Status-
clear/restart doors. Targeted run: 223 assertions passed, 0 failed in the main
lifecycle suite, plus 10 My Status, 10 Program-route and 4 effect-phrase cells
passed (`/private/tmp/testtruth-modifiers-final-targeted.log`). Scope:

- 16 distinct restriction journeys: six automatic readiness choices, equipment,
  time cap, all seven temporary schedule kinds and a limiting knee injury.
- Three distinct record-only readiness choices followed by real lighter-day
  opt-in; independent overlapping reports including two same-kind source facts.
- Actual changed training, list/count agreement, stable IDs, persistence,
  exact-fact clear and restart-after-clear for every restriction journey.
- Typed scheduled deload, accumulated prior session removal, exclusion restore,
  latest session Undo after restart, conditioning preference persistence/clear,
  fixture Undo after restart, upcoming restrictions and expiry.
- Mutation controls hide a real time-cap row and remove real persisted program
  inputs: the same visibility/checkpoint assertions reject both mutations, then
  pass again after restoration. No fake stored program is substituted.

The initial new test coordinates also found test mistakes, not product defects:
a normal game in pre-season (the supported variant is practice match), treating
moderate `sore_today` as a record-only choice, expecting two identical stable-ID
readiness taps to make two separate facts, and using `running` instead of the
modality input enum `run`. Corrected those expectations/inputs; no training law
was changed to satisfy them.

Simulator iPhone 17 Pro, iOS 26.3, B8B2C7B0-0558-448A-896D-EAB9C2C6C326:
fresh Debug build installed for these checks, neither physical phone touched.
`.maestro/golden/modifier-cold-onboarding.yaml` passed real non-seeded onboarding,
generation, week navigation, cooked apply/Status clear, and off-season change
including last-game calendar and no team-training prompt. Receipt:
`/private/tmp/testtruth-modifiers-cold-ui3.log`; screenshot:
`artifacts/ui-walk/modifiers-cold-onboarding-phase.png`. Two earlier runs stopped
on exact-text selectors for grouped title/subtitle labels; updated the test to
match the real accessibility labels, without changing the controls.

Expanded session-edit coverage also passes all six variants: Add/Swap by category
or template, Move, and Remove. Each accepted edit has a row, stable restart
identity, exact rebuilt training and eligible Status Undo. Receipt:
`/private/tmp/testtruth-modifiers-all-edits2.log`: final main-suite total
248 passed, 0 failed, plus the same 24 view/copy cells. The first Move probe selected
a team-training day as "empty" because it had no exercise rows; corrected the
test to select an actual empty/Rest day, without altering placement policy.

Final seeded tape `.maestro/golden/program-modifier-notice.yaml` passed on final
runtime source: apply cooked, Day/Week notice and My Status count 1, real
stop/relaunch, exact Status clear, notice absent in both views, second real
stop/relaunch and Status still empty. Receipt:
`/private/tmp/testtruth-modifiers-ui-final.log`; screenshots:
`artifacts/ui-walk/modifier-active-status.png` and
`artifacts/ui-walk/modifier-cleared-after-restart.png`.

Final `npm run test:release` completed exit 0, **8/8 executable units green**,
covering 11 current contract rows plus bootstrap/typecheck. Receipt:
`/private/tmp/testtruth-modifiers-release-final.log`. Annual acceptance reached
and passed all 416 required athlete-weeks (8 distinct archetypes × 52); canonical
compiler slice 604 assertions passed; modifier lifecycle 248 passed plus 24
view/copy assertions. The release command's other existing witnesses also
completed successfully. Runtime code stayed unchanged throughout this final
run; the test-only Add/Swap/Move cases added during the year run were executed
by its final modifier unit and separately typechecked after addition. Rule
wording/receipt refinements did not change runtime behavior.

Final standalone ownership census (`testtruth-modifiers-ownership-final.log`):
602 runtime source files, 2365 direct-operation occurrences in 631 distinct
direct owners; all 1135 executable capability owners reviewed (644 explicit,
3 structurally proven readers, 488 inherited callers), 0 unresolved, 0 distinct
rival authors, 0 distinct direct derived-output writers. Four dormant builder
capabilities remain inventoried and runtime-quarantined. Final typecheck
(`testtruth-modifiers-typecheck-complete.log`) reports 0 product, 0 devtools,
0 test-scope errors. Test-truth bootstrap also passes on the finished registry
(`testtruth-modifiers-test-truth-final.log`), 0 unrunnable of 392 inventoried
suites; this is an inventory claim, not 392 passing suites.
The first release run reached 416/416 green athlete-weeks, then correctly stopped
at the ownership gate when the just-added session-display readers needed fresh
review. Only the five changed direct capabilities were reviewed, not a blanket
fingerprint refresh: shared hook, selector, imperative selector, Home reader and
existing exact-fact Clear caller. Fixture-map mutation and reversed ledger
COPY are local presentation work, not program/ledger writes.

The separate historical `test:law-registry` remains red: 11 cells pass, 3 fail;
21 of 205 law rows UNENFORCED, missing `test:game-feedback` reference and
unregistered LR-18 citation. R-262 itself is registered, gated and in-chain.
This is not a claim that the entire old Bible fleet is green, and its old red
expectations are not being used as a product-change backlog.

NOT COVERED: physical iPhone installation/acceptance of this modifier change;
every modifier/action combination individually on glass (the wider matrix here
is headless); standing preference/profile editing flows beyond the tested
exclusion and modality controls; device expiry at midnight; remote persistence;
the two preserved runtime-quarantined features and remaining legacy test debt.
No blocking question for Sam. New simulator tests are not physical acceptance.

Concurrent audit seat committed only `docs/STATUS_AUDIT.md` as `0837ce6a` while
this work ran; reviewed its latest findings and preserved its work. Its reported
exercise-removal Undo/exclusion regression, changedProgram reporting mismatch
and arithmetic mutation blind spots are separate from this modifier-visibility
checkpoint and are NOT claimed fixed here. The Status exclusion-restore path
tested above is not the same operation as generic latest-decision Undo of an
exercise removal. No code from the other seat was modified or swept into this
change; its findings remain in that seat's report.

NOT COVERED additionally: resolving those separate re-audit findings. Passing
the current release contract does not override that report.
## 41. Re-audit follow-up — Undo, injury reporting and dose arithmetic (2026-08-28)

Sam requested all three findings on 2026-08-28. Baseline 6c1ef72c; no unrelated
untracked files are in scope. Reproduced `test:undo-reversal` 24/25 cells and
`test:injury-recomposition` 37/41 cells; existing arithmetic diagnostics pass.
Undo cell 19 is a timing-dependent synchronous probe of an async queued door:
it does not await completion. Product failure is NOT YET ESTABLISHED by it.

Options compared before implementation: (1) correct the existing transaction's
reporting and bind its actual completed/restarted outcome; (2) redesign Undo or
add a second injury/program writer. Choose (1): current canonical compiler and
atomic transaction already own these changes. A parallel author would duplicate
decisions without addressing the measurement gaps. Reuse existing arithmetic
contracts, adding independent numeric compiler observations and live mutations,
instead of inventing progression/deload policy or another report-only audit.

### What the completed action actually showed

- **Undo finding corrected, not a new product rewrite.** The previous cell read
  exclusions immediately after `void undoLastDecision()`. Its premise that all
  writes happen before the first await became obsolete when Undo entered the
  queued durable transaction. The replacement awaits the real owner after real
  onboarding and two real removals. All three scopes × live/restarted Undo
  preserve the earlier removal, clear only the latest exclusion/action, restore
  the current/future visible week and survive another restart. The production
  Undo owner already does that; it was not changed to satisfy an obsolete timing
  assertion. The test runner now awaits async cells rather than silently losing
  their assertions. `test:undo-reversal`: **26/26 cells**, including the six
  journey coordinates, three injected durable-store failures and a missing-
  exclusion-reversal mutant.
- **Injury reporting fixed at its existing acknowledgement owner.** Previously
  the selected-day result was ORed with a block-wide transaction change. Before
  and after could also refer to different dates (onset versus selected day).
  Both now measure the same visible prescription. The existing semantic diff
  counts exercise/component changes and sets/load-only changes, but not a new
  warning, skip annotation or regenerated audit timestamp. The restriction is
  still recorded even when that session needs no prescription change. Unsafe
  work still receives the existing honest skip/refusal text. The new dose-only
  acknowledgement is used only when actual work changed and no unsafe work is
  left. `test:injury-recomposition`: **70/70 cells**; four original scenarios,
  three real-onboarding/report/repeat/restart coordinates (including an actually
  changed session), and independent sets/load/presentation controls. The suite
  is now totals-or-red so a drained async run cannot silently pass.
- **Arithmetic now has release authority.** Added six explicitly adjudicated
  `current_contract` rows: Undo, injury reporting, deload law, block-two load
  authority, progression inputs and training logging. These already-existing
  scripts are in the historical chain too; no duplicate program author or new
  progression policy was introduced. The four arithmetic/input diagnostics
  remain 68/68, 41/41, 18/18 and 14/14 assertions respectively. Release is now
  **17 declared current contracts / 14 distinct executable units** (shared
  witnesses counted once); unrelated diagnostic failures still have no release
  authority.
- **The annual compiler instrument now measures numbers.** It observes raw
  composed main-lift sets, governed deload output, exact-exercise recorded
  history, earned/held load decisions, their application and the complete
  compiler return. Receipts retain before/expected/actual numbers. Every reached
  week requires an arithmetic observation, the verdict independently checks
  numeric receipts, and a full result must actually reach both a reduced-set
  and an increased-load coordinate. The two new arithmetic mutations run
  against a real block-two input captured after onboarding and four weeks of
  logged training, and are mandatory prerequisites. The HTML remains a
  presentation of this same result.

### Failing controls, corrections and what catches the next defect

Actual production-source mutations were compiled in isolated child processes,
without modifying checkout files. Each ran the witness selected by the actual
release registry through `runUnits`; all four returned a failing release result:

1. Delete `restoreExcludedExercise(exercise)` from Undo: awaited journey fails
   on the remaining exclusion (not merely a source-string assertion).
2. Restore `visible.changed || result.changedProgram`: nine injury-reporting
   assertions fail, including real unchanged-day/repeated-report cases.
3. Replace `previousLoadKg + increment` with `previousLoadKg`: four load-
   progression assertions fail, including the club-night lift.
4. Change `mainLiftSetMultiplier` from 0.5 to 1: four numeric deload assertions
   fail. The permanent annual mutations separately reject both arithmetic
   failures on complete compiler returns, then prove the restored controls green.

The first new home-kit probe exposed an **instrument identity error**, not a
load regression: adapter row IDs repeat across different weeks. It matched a
High Box Squat receipt to a Trap Bar Deadlift in another week. Final checks now
match exact exercise identity as well as row ID, honour the date of a deload,
and inspect every matching placement. The home-kit five-week probe moved from
4/5 to 5/5 green reached weeks with **no product arithmetic change**. Limited
probes correctly exit red for missing annual coverage and are not release passes.
An initial failed-save probe also compared unrelated diagnostic storage; it now
checks the eight accepted-state persistence keys plus exact visible state,
exclusions and ledger, matching the existing transaction boundary. All three
injected failures leave those inputs/outputs unchanged.

Ownership review changed exactly one explicit fingerprint: the existing durable
program-control dispatcher. Its only change is acknowledgement reads; no new
program writer. Measured **0 rivals / 0 derived-output writers / 0 unresolved
across 1,136 executable capability owners**, from 602 runtime files, 2,365 direct
operation occurrences and 631 distinct direct owners. Review basis: 644 explicit,
3 AST-proven reference readers, 489 inherited call-graph owners. Four dormant
builders remain protected, not activated.

### Checkpoint verification (full release running)

First complete numeric run: **374/416 reached athlete-weeks green**, with 42
weeks failing the new numeric observer on one athlete (`female-5-home`). The
193 distinct verdict keys included repeated downstream receipt failures; these
were not 193 distinct program defects. Inspection found a second instrument
scope error: load decisions for an exercise used as strength/prehab were also
expected on the same exercise in standalone Mobility/Recovery workouts, which
the existing application owner intentionally does not touch. The observer now
measures the owner's Strength/Mixed/Team Training workout scope. No production
load policy changed. The affected five-week journey is **5/5 reached weeks
green** after this correction, and the permanent real arithmetic mutations
still pass; its overall diagnostic verdict remains red for missing annual
coverage. The first isolated run at 490385e8 was stopped because it carried the
same observer defect; neither run is claimed as a green release. The completed
shared run's failure was this measurement error, not the concurrent UI edits.

All three TypeScript scopes are zero. Signed-copy extraction passes. The older
session-change sequence remains 22/22 with both prior and updated runtime code;
session-injury-review completes at 76/76. Additional historical probes are
**not green evidence**: session-change durability still cannot construct its
incomplete-profile fixture; injury-fallback completes at 119/156 cells (37 red).
The same 37 named failures reproduce with this task's two runtime modules loaded
from 6c1ef72c. An initial baseline import did not invoke these suites' main guards
and produced no output; it was rejected as no measurement and rerun as main.
These old failures are not counted as fixed or newly regressed, and their
rewrite/measurement debt is not permission to change current product semantics.

Concurrent UI work in HomeScreenV2, GuidedInjuryFlowSheet, DayWorkoutScreenV2,
useDayWorkout, SessionCompleteMoment and its source tests belongs to another
seat and is excluded from this checkpoint's pathspec. It changed while the full
run was underway and introduced eight unresolved ownership reviews unrelated
to this task. The saved task checkpoint will be verified in a separate temporary
worktree; no other seat's code will be reverted or absorbed to get a green gate.
No generated reports or athlete data were deleted.

Evidence logs: `/private/tmp/testtruth-audit-{undo-protected2,injury-real3,
typecheck-final,dose-mutants,year-home-probe2,ownership-reviewed}.log` and
`testtruth-audit-mutation-{undo,injury,progression,deload}.log`. Full release:
`/private/tmp/testtruth-audit-release-final.log` (pending completion).

NOT COVERED: physical iPhone installation/acceptance, a fresh simulator tape in
this turn, the rest of the historical diagnostic fleet, and activation of the
protected dormant builders. The annual numeric receipts cover main-lift deload
sets and held/earned strength loads; promoted deload-law cells cover accessory,
conditioning and power arithmetic without claiming an exhaustive annual numeric
cross-product. No product decision is currently blocked on Sam.
