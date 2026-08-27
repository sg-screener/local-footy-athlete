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
