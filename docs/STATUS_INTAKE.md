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
