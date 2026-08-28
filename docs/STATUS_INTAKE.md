# STATUS — intake

Owner: intake. Started 2026-08-28 from integrated afcc2310.
Scope: Sam's ten saved exercises and explicit equipment/programming routes.
Other seats' NOW changes, handoffs, output and fuse files remain untouched.
Neither phone may be installed, reset or wiped in this task.

## Options compared before implementation

1. Append names to each chooser and repair rows after compilation.
2. Extend the existing typed catalogue, prescription and legality owners, with
   the compiler and manual doors reading the same declarations.

Choose 2. No parallel catalogue or stored derived program is introduced.
Existing bilateral Back Extension and ordinary Bird Dog are not duplicates of
the submitted unilateral movements and remain unchanged.

REGISTRY-GREP: medicine, Seated Good, Reverse Nordic and power-rest; intake is
the newer authorization for the three ball movements. The former blanket ban
does not authorize chest passes or other retired throws to return.
Unresolved supplied variants: Seated Good Morning dumbbell experience threshold;
Reverse Nordic external loading method. Asked Sam, continuing approved versions.

## PDF follow-up and architecture reassessment

Sam added `~/Downloads/Untitled note.pdf` and explicitly requested its fixes.
Read all three rendered pages: misleading add/remove labels, failure to re-add
Mobility after removing it, and session/fixture edits appearing in Active Modifiers.
The labels and modifier projection have independent fixes and regression checks.

Re-add is reproduced through the actual accepted-state doors in the existing
Mobility combination journey: 10 distinct gender/category scenarios, 20 failed
assertions (addition result and visible Mobility), with the other 170 assertions
passing. It is not a missing menu entry.

The reassessment below stays inside the existing transaction and compiler.
The extra approval request was unnecessary: Sam already explicitly authorized
the PDF fixes and requested completion. That request is withdrawn; no new
architecture or alternate write path is introduced.

1. **Source of truth:** persisted canonical source facts and the accepted decision
   ledger. The canonical compiler derives the current day. Stored composed base
   days are not the current accepted day after athlete edits.
2. **Representations:** the typed add intent, its preview workout, the addition's
   whole-session constraint, and its ledger decision. The base placeholder is an
   input to identity, not another user request.
3. **Reinterpretation:** `stageAthleteSessionAdditionTransaction` uses an ID derived
   from the base placeholder. Finding that ID among old active constraints turns
   a valid request for the changed day into `already_applied`, even when a later
   partial removal means the requested component is absent.
4. **Owner:** the existing accepted-state addition transaction must decide whether
   the requested result already matches the current accepted day. UI copy and
   chooser code must not override a refusal or write the missing session.
5. **Simpler architecture:** retain the same facts, ledger and compiler. Compare
   current accepted content for idempotency; when it differs, append a distinct
   accepted decision with its own identity. Keep history so Undo and restart can
   traverse both additions and the removal.
6. **Retirement:** replace the historical-ID-as-current-state shortcut. Do not add
   a resolver, duplicate catalogue, post-compilation rewrite or alternate writer;
   do not delete old decisions to make the guard pass.
7. **Proof:** real onboarding → add on occupied day → remove one component →
   restart → re-add → restart → Undo re-add → Undo removal. Run both component
   orders and the existing 2-gender × 5-category matrix, plus identical accepted-payload retry idempotency,
   the canonical compiler suite, writer ownership gate and final release gate.

Relevant diagnostic cleanup is part of this task, as Sam explicitly directed.
Starting-checkpoint failures establish provenance, not acceptability. Old Add and
Swap action fixtures are superseded by the current compiler/durability and intake
journeys. Their unique menu protections were consolidated into intake and the
old files deleted. The full authored-cue/sheet binding has no equivalent and
is retained with its obsolete source-scan assumptions corrected.

The duplicate-row disclosure proposed for the existing signed-copy registry is:
“No extra {slot} today — the available exercises are already in this session.”
It accompanies typed `already_on_day` gaps at the existing composition owner;
it does not label repeated identity as missing equipment or an athlete exclusion.
R-118 already requires one exercise once per session. No alternate writer or
post-compilation rewriting is introduced.

## Implementation and relevant cleanup receipt

- All ten submissions are in the existing catalogue, with the separate approved
  barbell Seated Good Morning variant. Exact intake ratings, cues and confirmed
  video URLs are bound by the maintained intake test. Equipment answers explicitly
  distinguish a wall-throw ball, suitable wall, slam-rated ball and safe slam area.
  The intake document is preserved as its original historical snapshot; this
  status file records the subsequent authorized implementation.
- Automatic routes use the existing composer/derived-session owners and typed
  experience, fixture and prescription declarations. No conditioning slam template,
  Bird Dogs or Estimated 1RM work was added. Power rest remains hidden.
- Retired `exerciseAddCandidatesTests.ts` and `exerciseSwapChoicesTests.ts`, plus
  their package commands. Replacement: `test:exercise-intake` (real Add/Swap,
  units, total load, equipment/injury/fixture gates, accumulated restart, menu
  counts/labels/grouping and athlete additions past the planner cap), together
  with existing `test:session-change-durability` and `test:canonical-weekly-compiler`.
  The retirement registry rejects reinstating a deleted file or losing its replacement.
- Kept the unique full-workbook cue/video binding. The old production-name scan
  incorrectly scanned negative test fixtures; the current scan excludes tests.
  Approved `Acceleration` comes from the existing session-authored registry.
- Kept unique power delivery/contrast coverage with valid current onboarding.
  Removed obsolete forced-collision and fixed five-strength-row assumptions;
  current dynamic counting remains, and intake now directly exercises both
  collision and non-collision materialisation. Current quick-action checks target
  the R-217 session options sheet and atomic ledger/rebuild transaction.
- All maintained checks above run inside the exercise-intake release witness.
  Existing annual and compiler contracts remain in the release gate unchanged.

### Real bugs exposed and corrected

1. Pike was treated as a hamstring replacement because an ungrouped isolation
   entry was a wildcard. The existing ladder now consults authored primary muscles.
   `test:session-change-durability`: 56/56; `test:injury-fallback-journey`: 182/182.
2. Canonical bodyweight selection repeated Push-ups. Same-day identities are now
   filtered before authorship, with typed gaps/substitutions, leaving the block
   record intact. Updated power delivery: 48/48 (policy portion: 58/58).
3. Manual ball Add/Swap omitted power role/family, which would expose rest and
   miscount power. Six new actual-action assertions failed before the existing
   exercise-edit compiler was corrected; those six then passed. Replacement by
   non-power also clears the inherited role and pairing metadata.
4. The final gate exposed a related manual-power disagreement: Add offered Box
   Jumps in early off-season, while the accepted contract prohibits primers.
   The shared Add/Swap environment now reads the existing accepted weekly
   declaration, including prohibited power families; the weekly policy is not
   changed. All live chooser callers pass that declaration's schedule context.
   The durability test also stopped discarding the actual menu prescription in
   favour of a generic 8–12-rep payload. It retains exact-session/restart checks
   and adds non-vacuous policy and accepted-action controls: 59/59 assertions.
5. PDF Mobility re-add now compares the current accepted day rather than an old
   addition ID, retaining immutable history and distinct accepted revisions.
   The strengthened existing matrix passes 250 assertions over 10 distinct
   gender/category scenarios, including exact-payload retry, another re-add after
   Undo, sibling preservation and repeated restart/Undo.

### Verification state

- Consolidated intake after the manual-power extension: 570/570 assertions,
  ten distinct submitted exercise identities all reached automatically. Six child
  mutations cover experience, fixture, equipment, timed units, exact cue and URL.
- All-scope typecheck: product 0, devtools 0, tests 0 errors.
- Writer census after reviewed composition/template changes: 1,139 distinct
  capability owners; 0 unresolved, 0 rival authors. The manual-power edit owner is fingerprinted and reviewed in the same canonical compiler.
- Original canonical compiler run: 10,296 passed / 20 failed. All 20 failures
  were the valid re-add assertions and were corrected, not retired or weakened.
- Intermediate release run `/tmp/lfa-intake-release3.log` reached 24/24 green,
  including 416 weeks across eight annual archetypes with zero distinct failure
  keys. Source changed during that run, so it is not the final-candidate receipt.
- Final gate `/tmp/lfa-intake-release-candidate.log`: **24/24 execution units
  green**, exit 0 (27 current product contracts, 22 distinct product witness
  commands, plus test-truth infrastructure and all-scope typecheck).
- Final annual matrix: **416/416 athlete-weeks**, eight distinct athletes × 52,
  **zero distinct failure keys**. Every athlete reached all 52 weekly restart
  checks and both season changes; deepest observed ledger: 14 accepted entries.
  All six annual compiler/fact/writer/progression/deload mutations were killed.
- Final canonical compiler main suite: **10,376 passed / 0 failed**, including
  the 250-assertion PDF combination journey. Its chained hydration, fixture,
  injury and repair suites also passed as part of the final release gate.
- Maintained cue/video binding: **55/55**; power policy **58/58**; generated
  power delivery **48/48**; quick actions **62/62**; Add/Swap durability **59/59**.
  Equipment vocabulary **101/101**, Primer **27/27**, power pool **90/90**, and
  muscle/experience equality **93/93**. These ran in the final release gate.
- Checked-source manifest: 1,279 distinct source/test/script/programming-input
  files, SHA-256 `ad1c49deb3432db524da42ae0657085e3068e4c479bc4e20215b784c5270b42c`.
  Rechecked after the successful gate: zero changed files. Receipt prose is
  outside that manifest. No application source changed after final verification.
- One scoped saved checkpoint contains the implementation, maintained tests,
  retirement mapping, master sheet and this receipt. Other-seat NOW changes and
  untracked artifacts are excluded. **Gates green, awaiting Sam device acceptance.**

What catches the next defect: the release witness walks actual current Add/Swap
and restart for every submitted identity, validates exact independent dose/rating
and equipment expectations, proves every automatic route has a reachable case,
checks populated and empty menu partitions, and executes deliberately broken
metadata in isolated child processes. The existing compiler matrix retains the
failing accumulated re-add state rather than substituting a clean-day fixture.

### Separate repository process diagnostics

These are not current-contract release witnesses and were not relabelled green:

- `test:law-registry`: 13 passed / 1 failed; 21 of 213 distinct law rows remain
  UNENFORCED (192 guarded). The same 21 rows were recorded before this task in
  STATUS_PROGRAMMING_REMEDY; both new intake/PDF rows have existing-chain guards.
- `test:repo-law-guards`: 51 passed / 12 failed, matching the twelve assertion
  names already recorded by the prior seat. They concern historical report/inbox
  content, budgets, orphan/golden Maestro receipts, a stopwatch writer, and
  source-anchor/debt bookkeeping. Sam explicitly excluded repairing the entire
  historical test collection; no unrelated assertion or threshold was weakened.
- Its two quick-action anchor warnings are a detector limitation: the maintained
  check proves `start >= 0 && end > start` before using the slice, while the
  diagnostic only recognizes a literal `end >= 0`. Isolated source-read mutations
  of the options-sheet start, options-sheet end, and transaction end all fail
  the corresponding named maintained assertion (3/3 mutations killed). The
  unchanged control passes 62/62; this relevant protection is live, not waived.

## Device acceptance after permission to install

Gates do not substitute for Sam's physical-device acceptance. Check the new ball
and space answers in onboarding and Equipment editing; Add/Swap a ball movement
and a timed/per-side hold; log a chosen load and reopen. Confirm power rest stays
hidden. On a Gunshow day, add Mobility, remove only Mobility, re-add it, reopen,
then Undo. Confirm labels name the affected component and session/game history
does not appear in Active Modifiers while actual athlete restrictions still do.
No installation or wipe is authorized by this task.

## NOT COVERED

- Repairing the unrelated historical repository process failures described above.
- Physical iPhone/simulator installation, native pixel/tap QA and true OS process
  death. Neither phone has been installed, reset or wiped by this seat.
- Live video playback/network availability; exact supplied clickable destinations
  and catalogue lookup are tested.
- Independent clinical validation of Sam's supplied injury ratings.
- Dumbbell Seated Good Morning experience threshold and Reverse Nordic external
  loading method: supplied as unresolved; these variants remain withheld.
- Band-Resisted Bird Dogs, conditioning slams and Estimated 1RM: explicitly out of scope.

## Estimated 1RM — new authorization, 2026-08-29

Owner: intake. This is a separate task after the exercise checkpoint above.
Starting checkpoint: `42ea66268bbb0a52beafbd6341a6b9db646611e5`.
Read the complete feature brief and original pasted proposal. The new user request
authorizes implementation; the brief's historical recording-only header does not
cancel that authorization. Its explicitly unresolved product choices still need
Sam's ruling before those choices are implemented.

### Research verification

Visually checked the proposed general and Bench curve coordinates at 60–95%
against [Nuzzo et al., Figures 2 and 3](https://link.springer.com/article/10.1007/s40279-023-01937-7):
all supplied coordinates match. The 1-rep/100% endpoint is a definition, not a
table result. Linear interpolation, adding RIR, and the 15-effective-rep cutoff
are application choices. The source extracted first sets in non-fatigued tests;
it does not validate the proposed last-set inverse calculation across eight lifts.

[Refalo et al.](https://pubmed.ncbi.nlm.nih.gov/37967832/) studied 1/3-RIR
predictions during two Bench sets at 75% tested 1RM in 24 trained participants.
That supports RIR capture in those conditions, not universal 1RM confidence or
elimination of fatigue effects.

### Integration review and questions for Sam

Read at source, not runtime-measured this turn: existing owners are
`strengthLogging`, `SessionFeedbackPanel`, `estimatedOneRepMax`,
`progressMainLiftStrength`, and the persisted profile/session-outcome stores.
Compared extending those owners with a separate estimate/history owner. Prefer
the existing owners: persist the raw observation and method provenance, derive
the chart, and keep chart choice separate from programming inputs.

R-255 already settles Pull-Up display: estimate with session bodyweight plus
added load, then show the added-load estimate. No need to ask that again.

Recommendations awaiting Sam, not implemented policy:

- Use the proposed curve with exact RIR 0–4 and at most 15 effective reps;
  show approximate estimates without confidence badges or new PB awards.
  Skip/unanswered/5+ create no RIR estimate. Keep legacy method history separate.
- Keep assisted Pull-Up performance loggable, but exclude it from estimated 1RM.
- For Bulgarian Split Squats use total external load and reps for the identified
  last completed leg; keep left/right histories separate, never joining sides.

### NOT COVERED

- No Estimated 1RM application changes, regression tests or release-gate run yet;
  implementation awaits the explicitly open decisions above.
- No native slider verification, save/reopen run, phone installation or wipe.
- No independent validation of last-set 1RM accuracy for the eight tracked lifts.
- Other-seat changes and the prior checkpoint remain untouched.

## Estimated 1RM + section Add implementation — 2026-08-29

Owner: intake. Sam's subsequent explicit decisions supersede the provisional
recommendations above, including the proposed separate Bulgarian leg histories.
R-272 and R-273 record the approved scope and point to maintained release guards.
There is no assisted pull-up workflow and no second-leg selector/history.

### Implementation and ownership

- Extended the existing profile preference, workout-log, session feedback,
  accepted-outcome and Progress owners. Chart choices sit outside onboarding
  programming inputs. No extra store or programming engine.
- Four pairs retain exercise-specific history. Last completed working-set inputs
  are stored with set identity, actual load/reps, optional exact/open-ended RIR,
  session bodyweight, non-dominant-leg convention and calculation version.
- Published general/Bench curves are interpolated only for exact RIR 0–4 and
  at most 15 effective reps. Skip, unanswered and 5+ do not fall back to legacy
  estimates. Legacy/new methods and distinct setup contexts use separate lines.
  This does not establish equivalent accuracy across lifts or remove fatigue.
- The shared section + now reaches the existing Add flow for every editable
  exercise section. The compiler preserves the destination section and the
  exercise's physiological role. Candidate filtering retains equipment, injury,
  experience, fixture and Primer restrictions; empty lists explain the result.
- Completed records retain cues/video access but no exercise edits, load edits,
  Select all or + controls. Derived mobility and manually added mobility render
  together, with authored cues and section-local numbering for added rows.

### Defects found and corrected during this implementation

1. Checklist-mode feedback discarded supplied structured strength records. The
   accepted outcome builder now retains them; the real onboarding/save/reopen
   tests fail without this change.
2. Reapplying an accepted placement snapshot could erase a subsequent exercise
   Add/Swap. The existing compiler now recognizes an exercise-edit receipt for
   that exact placement identity/date. An initial broader condition broke 33
   canonical assertions; it was narrowed, and the canonical aggregate's main
   suite then passed all 10,376 assertions. Move/Undo semantics are preserved.
3. Simulator inspection found the labelled slider thumb clipped at its endpoint.
   The shared control now reserves half a thumb width and aligns number cells.

### Verification receipts so far (not the final release claim)

- `test:estimated-1rm`: 163 new assertions plus the existing Progress ownership
  and 37 logging-wiring assertions passed before the final full-gate run.
- `test:session-section-add`: 188 assertions, over both sexes and seven section
  contexts plus combined-session/restart cases; shared screen contract: 58.
- Existing session-execution suite: 201 assertions; exercise-intake suite: 570
  assertions over ten submitted exercises. The final release run repeats them.
- Mutations execute altered production modules in isolation: selecting the
  first instead of last set; interpreting null RIR as zero; dropping the
  placement receipt; and assigning added mobility to Strength. Each breaks its
  corresponding assertion. No source file is rewritten by these mutations.
- First full release attempt reached 416/416 green athlete-weeks (8 athletes ×
  52 weeks) but correctly failed its ownership prerequisite. Seven changed
  direct owners and one new chart-map owner required explicit review; twelve
  caller reviews then resolved through the existing call graph. Reviewed all
  eight, preserving classifications and the gate; zero unresolved owners,
  zero rival authors and zero derived-output writers after review.
- Simulator: isolated `LFA RIR Section QA`, UUID
  `88997171-28B4-4598-AB38-C842EDD73D5C`. Real male onboarding, actual Mobility +
  (Crab Hold) and Strength + (Pull-Ups), chart choice, slider drag/Skip/Undo,
  saved Bulgarian 40×8 with 2 RIR and Pull-Up +10×6 with 1 RIR at session BW84.
  Reopened charts showed 50 kg / +26 kg respectively and completed rows were
  read-only. The first tape did not reliably retain Bench input during dev
  refresh, so a fresh tape asserts each actual-set summary before saving.

### Maintained tests repaired/replaced

- `workoutLogProgressionWiringTests`: replaced obsolete best/prescribed-set 1RM
  write expectations with raw-last-set capture binding and no new legacy writes.
- `progressTabOwnershipTests`: legacy method remains explicitly labelled;
  current bodyweight can no longer fill historical pull-up measurements.
- `sessionChangeHubTests` and `sessionExecutionChecklistTests`: replaced obsolete
  two-renderer/three-family assumptions with the shared all-section renderer,
  destination context, empty-list explanation and completed-record protection.
- `coachSnapshotTests`: bounded its layout mutation to the lift grid after the
  new choice control introduced another wrapping row. Its direct suite passes.
- Full historical `test:coach-snapshot` also includes an already-classified
  `rewrite_test` for populated load snapshots: two assertions expect a load
  ratio from fixtures lacking measured duration. This is the current measured-
  duration load rule, unrelated to chart estimation; that file is unchanged and
  is not a maintained release contract. No application change was made to satisfy it.
- Test-truth registry counts now include the two new contract witnesses; no
  unrelated test was weakened or promoted merely to hide a failure.

### Open product/safety contradiction

The simulator's first four-day athlete could add a fifth main strength session,
then an exercise edit on it was rejected by Section 18 with
`maximum_breach:main_strength:5`. This is conflicting Add-session and final-week
policy, not permission to increase the maximum or reduce another session.
No programming rule was changed. Subsequent exercise tests use a valid three-day
week plus one manually added strength session. This contradiction still needs
an explicit product ruling if fifth-session behavior is to change.

### NOT COVERED

- Final native female/remaining-section receipts and final release result are
  pending below; the preliminary measurements above are not final acceptance.
- Physical iPhone acceptance, phone installation/wipe, remote/backend sync and
  individual estimated-1RM accuracy. Neither phone was installed or wiped.
- Assisted pull-ups, withheld exercise variants, altered programming loads,
  conditioning slams and a second Bulgarian leg entry are intentionally absent.

### Native combined-section finding and closure (2026-08-29)

Recovery rows were separated correctly; the initial visual suspicion that they
were Strength rows was wrong. The real defect was the Primer section losing its
identity after a Conditioning/Recovery session was attached: the day purity
marker clears, while each original row retains `composedOptionalKind=primer`.
The old section renderer read only the former. That also lost the Primer Add
filter. Accessories had the same whole-container dependency.

Compared retaining a shared Strength bucket with a contextual label against
using the existing typed section system for each authored population. The latter
also handles Primer beside actual Strength without mixing their Add rules.
The checklist now has an explicit Primer section and uses its existing
Accessories section for prehab rows; physiological roles and prescriptions do
not change. Each section carries its own typed source context to the shared Add
flow. Primer ordering remains authored even beside another session. Existing
power rows in ordinary Strength still stay in Strength and hide rest periods.

The real-onboarding Add suite now reaches both sexes × Primer/Accessories ×
Conditioning/Recovery/Strength attachments, then edits and restarts each one.
The first expanded run passed 270 assertions; two further live mutation checks
and a section-context call-site assertion are included in the final gate.
The mutation reroutes typed Primer rows into Strength and must lose the expected
Primer section. This is protection for the next combination, not only the one
seen on glass. The existing 201 session-execution assertions remained green.

A second all-green release run completed 26/26 units before this native finding.
A third run was already underway during the fix and therefore is NOT the final
candidate receipt, even if green. A fresh frozen-candidate run is required below.

### NOT COVERED (this intermediate finding)

- Final frozen-candidate release and complete native replay remain pending.

### Non-default chart preference persistence (2026-08-29)

The native phase-change check retained the estimates but showed Back Squat
instead of the selected Bulgarian chart. Read-only inspection of that QA
simulator's `profile-store` found **no `trackedLiftChoices` field**. This was
not established as a phase-change-only defect: the accepted transaction's
profile serializer omitted the new preference, so any accepted edit could
overwrite its disk value before restart. No history points were deleted.

Compared extending the existing accepted profile envelope with moving chart
choices into another store. Extended the existing envelope; a separate store
would duplicate ownership and violate the requested integration. The preference
remains outside onboarding and programming inputs. No prescription changed.

The old restart assertion selected all defaults first and could not detect a
missing preference. Replaced it with all four **non-default** selections,
accepted session saves, a real Profile phase transaction and cold rehydration.
`/tmp/lfa-rir-preference-red.log` reproduced eight failures (three missing disk
captures and one non-default restart per sex). With the two existing mirror
functions extended, `/tmp/lfa-rir-preference-green.log` reports **175/175**
Estimated 1RM assertions, plus the maintained Progress, logging and effort checks.
The two modified persistence owners were inspected and re-fingerprinted; the
writer gate again reports 1142/1142 reviewed capability owners, zero unresolved,
zero rival authors and zero derived-output writers. All three typecheck scopes
report zero errors.

Final release started against the frozen source/test/script manifest
`/tmp/lfa-rir-final-source-sha.json`; result will be recorded below. Native full
replay is in `/tmp/lfa-native-final-male.log`. Earlier all-green release runs
remain intermediate receipts, not the final-candidate claim.

### NOT COVERED (preference-fix intermediate receipt)

- Full final release and uninterrupted native replay are still running.
- Physical phones, backend synchronization and exercise-specific predictive
  accuracy remain outside this local verification.

## Final verification — Estimated 1RM and section Add, 2026-08-29

This receipt supersedes the intermediate counts and pending statements above.
The candidate extends `42ea6626`; it does not replace that checkpoint. Other
seats' `docs/NOW.md`, handoff documents, outputs and unrelated Maestro flow
were left outside this save. Neither physical phone was installed or wiped.

### Implemented

- Four configurable charts and all eight approved lifts, with separate exercise,
  method and setup histories. Chart choices do not write programming inputs.
- Optional last-working-set feedback in the existing logging/save flow: actual
  weight and reps, unanswered lime slider, live highlight, Skip and open-ended
  5+. Only RIR 0–4 and effective reps up to 15 produce estimates.
- Published general and Bench-specific curve coordinates verified against
  [Nuzzo et al.](https://link.springer.com/article/10.1007/s40279-023-01937-7).
  Their fresh first-set data do **not** validate a fatigue-free last-set
  estimator for every lift. The UI calls the result approximate. No confidence
  badge, PB award or automatic training-load change was added.
- Session-bodyweight pull-up inputs and added-load display; one non-dominant-leg
  Bulgarian input with total external weight. No assisted pull-up or second-leg
  workflow. Raw set identity, measurements, RIR and method version persist.
- One existing shared + and accepted Add flow for every editable exercise
  section. Section identity survives combined sessions, all existing rows and
  reopening. Safety narrows choices, with an explanation when empty. Completed
  records stay read-only; game and team entries get no exercise +.

### Final automated results

`npm run test:release` — `/tmp/lfa-rir-release-verified.log`, process exit **0**:
**26/26 execution units green**, representing 29 current product contracts plus
the infrastructure/typecheck units (some contracts share a witness).

| Maintained check | Result |
| --- | --- |
| Estimated 1RM regression | 175 assertions passed |
| Existing logging wiring / effort controls | 37 / 53 assertions passed |
| Section Add matrix / shared-control contract | 272 / 59 assertions passed |
| Exercise intake | 570 assertions; 10 distinct submitted exercises |
| Annual compiler acceptance | 416/416 athlete-weeks; 8 distinct athletes × 52; 0 distinct failure keys |
| Weekly writer ownership | 1142/1142 capability owners reviewed; 0 unresolved, rival authors or derived-output writers |
| Product, devtool and test typecheck | 0 errors in each scope |

The manifest `/tmp/lfa-rir-final-source-sha.json` covers 1256 application, test,
script and package files. Final comparison after the gate found **zero changed
files**. Native automation selectors were corrected separately; no application
source was changed during the final gate. `git diff --check` passed.

Maintained test repairs/replacements are itemized above. In particular, the
default-only restart assertion was replaced with a non-default accepted-edit /
phase-change / restart journey. The omitted persistence field first produced
eight failing assertions across both sexes; the fix made those same checks
pass. No unrelated test was weakened to obtain this result.

The next defect is caught by the section × sex × combined-context matrix,
existing safety-owner checks, real accepted writes and cold rehydration, plus
production-module mutations for first-set substitution, null-as-zero, lost
placement edits and incorrect section routing. Native field-value assertions
now stop immediately if automation failed to enter an actual measurement.

### Simulator verification

Only isolated simulator `88997171-28B4-4598-AB38-C842EDD73D5C` was used.
Both male and female athletes went through real onboarding and generation.
Across the recorded runs, all seven supported section + controls were tapped:
Strength/Pull-Ups, Mobility/Crab Hold, Primer/Box Jumps, Optional Work/Pull-Ups,
Conditioning/Easy Bike, Recovery/Box Breathing, Accessories/Scap Push-Up.
Combined sections and their added rows were visibly reopened after restart.

The final male journey saved these four distinct set observations (read back
from the canonical persisted program envelope; four occurrences, four set IDs):

| Lift | Actual input | Result shown |
| --- | --- | --- |
| RDL | 90 kg × 6, RIR `5+` | No new estimate |
| Bulgarian Split Squat | 40 kg × 8, RIR 2, non-dominant leg | 50 kg |
| Bench Press | 100 kg × 5, RIR 2 | 120 kg |
| Pull-Up | +10 kg × 6, RIR 1, session bodyweight 84 kg | +26 kg |

All four store `nuzzo_last_set_rir_v1`. Switching Pull-Up → Lat Pulldown →
Pull-Up restored its history. The non-default Bulgarian selection and three
estimates survived accepted section edits, restart, a real Pre-season →
Off-season Profile change, and another restart.

Receipts: `/tmp/lfa-native-final-male.log` (onboarding and first controls),
`/tmp/lfa-native-male-resume2.log` (actual fields, save, charts, restart and
Primer/Optional adds), `/tmp/lfa-native-combined-tail.log` (remaining section
adds, all combined rows reopened, phase change; exit 0), and
`/tmp/lfa-native-post-phase-reopen.log` (post-phase restart; exit 0).
Earlier female cue expansion and demo-modal opening are recorded in
`/tmp/lfa-accessories-native-proof.log`; provider playback was not established.

The top-level native run was resumed after test-navigation failures: a centered
scroll did not enter Bench values; a + obscured by the bottom tab bar caused a
tab tap; iOS reported a visibly focused text field as unfocused. Tests now
assert entered field values, scroll controls clear of tabs, and use the actual
Back button. These were not bypassed by changing expected estimates or the app.
The resumed passes prove the named surfaces, not an uninterrupted wrapper run.

### Genuine unresolved issue

The separately observed fifth-main-strength-session conflict remains: Add
Session permitted the fifth session, then exercise Add refused it under the
existing Section 18 maximum. Its starting-checkpoint status was not established.
No limit was increased and no other session was removed. A product ruling is
needed before changing that contradictory policy; it is not an Estimated 1RM
calculation decision. No other unresolved defect was observed in the verified
feature surfaces.

**Gates green, awaiting Sam device acceptance.** When a phone build is authorized,
check one completed lift's actual-set question, drag/Skip, save/reopen, switching
charts, a section + on a combined day, and completed-record read-only behavior.

### NOT COVERED

- Physical iPhone acceptance or a rebuilt native Release binary; no phone
  installation, wipe or data migration was performed.
- Android, backend/account synchronization, and full external video playback.
- One uninterrupted execution of the assembled top-level Maestro wrapper;
  actual named controls, saves, reopens and the phase change passed in segments.
- Individual predictive accuracy or equal accuracy across the eight lifts;
  fatigue remains a limitation of this approximate metric.
- Assisted pull-ups, withheld exercise variants, new conditioning templates,
  PB awards or automatic training-load changes (deliberately not implemented).
- Physical phones, remote sync and individual lift-estimation accuracy.
