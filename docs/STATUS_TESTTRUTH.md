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
