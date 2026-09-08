# Release handoff — finish UI, close QA gaps, then phone acceptance

Prepared for Sam's next chat on 28 August 2026. Owner of the next work: the agent
Sam starts with this handoff. This handoff itself changes documentation only.

## The brief

The core rebuild is not the main job. Finish and verify the existing app before
adding more features. Work through **all of steps 1–3**, not just one subtask and
then claim the step is finished. Record a genuine blocker and the question for
Sam, then continue with independent work. Never carry a known release blocker
onto his phone as a supposedly verified candidate.

Preserve the canonical compiler and accepted-state transaction architecture.
Do not start another compiler rebuild, demolish working code, or treat the old
red test fleet as a product specification. Product/programming decisions remain
Sam's; ask when a real ambiguity requires changing them.

First read `AGENTS.md`, `CLAUDE.md`, `docs/NORTH_STAR.md`, and relevant current
status files. The older `docs/CODEX_HANDOFF_2026-08-11.md` supplies repo context,
not the current work queue. Read `.claude/rules/suites-and-fixtures.md` before
changing athlete-facing tests, and the coach/plan-edit rules for relevant work.

## Start with the actual version, not an old green receipt

At handoff: branch `codex/failure-only-state-export`, HEAD `abe168cf`.
Tracked files were clean before this documentation change. Untracked `outputs/`
and two `.fuse_hidden...` files already existed: preserve them and other agents'
work. Recheck status and active ownership before editing or committing.

| Version | What the evidence actually covers |
| --- | --- |
| `3a8a3bd6` | Last recorded clean Release install on Sam's phone. Sam confirmed one week edit survived exiting/reopening. Not comprehensive phone acceptance. |
| `86efeadb` | Last complete release-gate receipt: core fixes and arithmetic protection, before the latest UI commit. Not installed on either phone in this record. |
| `abe168cf` | Current combined source, including those fixes and the latest UI changes. No complete release-gate receipt for this exact version was established in this handoff. |

The latest UI is **already committed on this branch**, not awaiting a merge.
Do not cherry-pick the same fixes again. Inspect the diff from the verified
checkpoint and any changes made after this handoff.

Historical evidence is in `docs/STATUS_TESTTRUTH.md` sections 37–41, especially
41, and `outputs/compiler-year-acceptance-86efeadb/{release.log,result.json,index.html}`:

- 14/14 executable release units green on `86efeadb`.
- 416/416 athlete-week checks: 8 distinct archetypes × 52 weeks, zero distinct
  failure keys. Canonical compiler: 604/604 assertions.
- Undo: 26/26 assertions; injury recomposition/reporting: 70/70 assertions.
- All three TypeScript scopes had zero errors; the typecheck baseline was empty.
- Ownership: zero distinct rival authors and zero distinct derived-output writers
  across 1,136 reviewed capability owners at that checkpoint.
- Six permanent annual mutation checks, including dose arithmetic; four
  task-specific release-witness mutations were also rejected.

These are historical, scoped receipts—not a fresh pass on HEAD or the whole app.

## Known blocker discovered after that checkpoint: injury output

The requested male/female year export ran actual app paths at `abe168cf` and
exposed invalid injury substitutions. **Fix this before physical acceptance.**

- Week 8, Tuesday 17 November 2026: shoulder injury, 4/10, pressing trigger,
  during a deload week after seven weeks of accumulated training.
- Generated strength rows included **“Barbell Bike”** and
  **“Chest-Supported DB Bike”**, with strength prescriptions.
- Visible-week projection threw: `"exercise.name.Barbell Bike" is not in the signed-copy sheet.`
- Six of 364 daily projection attempts failed per athlete: 12/728 snapshots
  across two athletes, **one distinct reported error message**, not 12 bugs.
- Weekly restart comparisons still matched: 52/52 per athlete. Identical live
  and restarted output can still be invalid output.

Receipts and driver are outside the repo, under:

`/Users/samgeurts/.codex/visualizations/2026/08/26/01a03b69-9022-7041-b909-ca28d5e0d275/`

Read `year-generation-receipt.json`, `year-programs.json`, `generate-year.cjs`,
and `full-year-programs.html`. The export retained generated rows and disclosed
projection errors; it did not repair the program to make a green report.

For a shorter reproduction, the driver accepts `--weeks=8 --gender=male`.
**Copy the driver to a new task-specific temporary directory before running it:**
it writes beside itself, so running a partial probe in its original location
would overwrite the preserved full-year artifacts. Inspect its imports first.

Root cause is not yet established. Trace the injury/substitution path into
`src/rules/projectVisibleWeek.ts`, including strength versus conditioning
identity. Do not add bogus exercise names to signed copy, hide the exception,
or cosmetically rename them to claim a fix. Use the existing typed identity and
compiler boundaries. Preserve unaffected rows and intended injury constraints.

## 1. Finish current UI and freeze a release candidate

### Inspect and finish

Review `abe168cf` (owner `template`, R-263) and current UI ownership/status before
touching shared files. Its changes include:

- Conditioning items use the existing execution checkbox; a conditioning choice
  gets one header checkbox, not multiple independent completions.
- Expanded form cues move the load control below; collapsed layout stays intact.
- Session-completion feedback is an overlay, displayed for four seconds.
- “Consistency starts here.” was removed; readiness/injury icon colours changed.

Principal files: `DayWorkoutScreenV2.tsx`, `useDayWorkout.ts`, `HomeScreenV2.tsx`,
`GuidedInjuryFlowSheet.tsx`, and `SessionCompleteMoment.tsx`. Review the actual
diff, `docs/STATUS_TEMPLATE.md`, and applicable signed copy/rulings rather than
inventing replacement UI. Old in-flight notes are not proof of current defects.

Check these screens in the simulator, including scrolling, expanded cues,
conditioning selection/completion, logging and the completion overlay. Establish
which tests genuinely fail on the combined version. The UI commit's statement
that targeted tests returned to “pre-existing reds” is not release acceptance.

### Freeze and verify

Fix the known injury blocker and relevant step-2 defects before the final phone
candidate. An initial candidate may expose more work; any subsequent source
change invalidates its receipt and requires a new exact-version verification.

Use explicit-path commits with the required `Agent:` stamp; never sweep up
another agent's staged work. Build from a clean, identified checkpoint, using
an isolated checkout if shared work prevents that. Do not reset the shared repo.

Record candidate commit, reviewed changes, release results/log paths and remaining
acceptance items together. **Step 1 is complete only when the combined candidate,
not its ancestor, passes the current release gate.**

## 2. Close the testing gaps without resurrecting old behaviour

### Update and execute these three simulator flows

| Flow | Preserve the real contract; replace stale assumptions |
| --- | --- |
| `.maestro/visible/readiness-holds-load.yaml` | Appropriate readiness reduction, retained load where policy requires, visible modifier/explanation, clear and restart. Do not depend on stale row IDs or fixed squat/RDL numbers. |
| `.maestro/visible/conditioning-one-prescription.yaml` | One coherent session title and prescription, correct work/recovery, no contradictory options, functional completion. Reach the intended template explicitly instead of expecting the old “Classic 4×4” fixture. |
| `.maestro/visible/swap-load.yaml` | Replacement gets its own load/bodyweight prescription; unaffected rows stay unchanged; edit survives restart. Do not assume the first offer is always Glute Bridge. |

Start with `npm run lfa:dev`. Run flows through
`scripts/dev-e2e/run-maestro-ios.sh`, with `E2E_METRO_URL` set to the actual
running Metro URL. For example, if Metro is on port 8081:

```sh
E2E_METRO_URL=http://127.0.0.1:8081 scripts/dev-e2e/run-maestro-ios.sh .maestro/visible/readiness-holds-load.yaml
```

`npm run qa:audit-flows` runs the separate `.maestro/audit/` pack; it does not
replace running these three `.maestro/visible/` files. Inspect the newer
`.maestro/golden/modifier-cold-onboarding.yaml` and
`.maestro/golden/program-modifier-notice.yaml` for applicable current contracts.

### Review relevant older tests

- `test:injury-fallback-journey`: the prior comparison recorded 119/156 assertions
  passing, 37 red on both compared versions. It is classified `rewrite_test`.
  This does not prove all failures obsolete; separate invalid fixtures from real
  current injury defects, especially the new week-8 failure.
- `test:session-change-durability`: previously failed to construct an incomplete
  profile fixture. Repair setup before treating it as evidence about the app.
- `test:session-change-sequence` and `test:session-injury-review`: previously
  green at 22/22 and 76/76 respectively; retain useful contracts.
- Coach commitment changes: inspect `test:coach-weekly-reduction`,
  `test:block-two-extra-session`, and `src/__tests__/support/coachCommitment.ts`.
  Exercise real accepted block/history inputs and offer → preview → accept or
  decline → restart. A mere offer must not alter the program. Verify supported
  restoration behaviour without inventing an unsupported control.
- Revisit UI diagnostics `test:session-execution`, `test:day-first-timeline`,
  `test:approved-icons`, and applicable copy/ruling bindings against current UI.

Classify each failure: genuine defect, obsolete expectation, fixture/harness
defect, or unresolved product question. Preserve protection for current behaviour;
do not weaken tests just to get green. Route classification changes through the
test-truth registry, not an ad hoc skip list. Do not expand into an AI chat rebuild.

### Protect the newly exposed class and rerun the complete gate

Add the injury scenario through real onboarding and accumulated state: week 8,
shoulder restriction plus deload, both sexes, mixed session content, live change,
restart and clearing. Assert valid final exercise identities **and actual visible
projection**, appropriate prescriptions and unaffected-row preservation. A restart
equality assertion alone missed this. Prove the new protection fails when its
subject is deliberately broken; restore the mutation before final verification.

Current release authority is `scripts/release-gate.js` and
`scripts/test-truth-decisions.json`, not the historical `test:bible` fleet:

```sh
node scripts/release-gate.js --list
npm run test:test-truth
npm run test:compile
npm run test:release
```

`--list` is discovery only, not a passing run. At handoff it lists 17 product
contracts executed through 14 deduplicated/bootstrap units. Relevant targeted
commands include `test:compiler-year`, `test:weekly-writer-zero`, and
`test:canonical-weekly-compiler`. Record actual units/results after any additions.

If UI edits invalidate ownership-review hashes, review the changed executable
paths and callees; never blindly refresh hashes. Preserve zero rival authors and
derived-output writers, with the measured unit and denominator stated.

**Step 2 is complete when the three named flows run successfully, relevant reds
are dispositioned with evidence, current defects are fixed and protected, and the
entire release gate passes on the exact final candidate.** No fresh results are
claimed by this handoff.

## 3. Install that candidate and complete physical-phone acceptance

Build a clean Release from the verified commit, check signing and embedded JS,
rediscover the connected device, and install over Wi-Fi where available. Bundle:
`com.localfootyathlete.app`. Do not reuse the old `3a8a3bd6` build artifact.

Preserve existing athlete data for the upgrade/restart journey. Separately run
real cold onboarding with an explicitly authorised app reset or a suitable test
device. Build successfully before uninstalling anything. Previous wipe permissions
were for earlier installs, not a standing instruction to erase current data.
Never erase a whole phone. Renee's earlier reinstall is not latest-build evidence.

Record results against the candidate and device, not just “tested on phone”:

| Journey | What to check |
| --- | --- |
| Real onboarding | No seeded shortcut; back/forward navigation, equipment, no-team-training option, availability, generation and first visible week. |
| Session and logging | Strength loads/sets, form cues and controls, conditioning prescription/tick, completion overlay, saved log and progress after reopening. |
| Injury | Add/change severity and restriction on a populated week, validate exercises and actual change reporting, reopen, resolve/clear and verify restoration. Include the repaired shoulder/deload case. |
| Readiness and sickness | Tired/cooked and illness changes, intended scope/expiry, modifier visibility, removal and restart. |
| Equipment | Supported equipment change and resulting substitutions, valid names/loads, reopen and restore; unrelated choices stay intact. |
| Exercise removal | Remove → Undo, and separately remove → My Status Restore. Exercise must not remain excluded; other accepted changes remain. |
| Weekly editing | Add/move/remove with occupied and multi-part days; save confirmation, undo where supported, and persistence. Movement remains a Week-view action. |
| Fixtures | Add/move/remove, occupied-day precedence, byes and Sunday games, day-before-game options, accumulated changes and reopening. |
| Season changes | Build/completion feedback, off-season last-game calendar, no off-season team-day request, correct new phase and reopening. |
| Modifiers | Every active program-affecting modifier appears consistently in Program and My Status; clearing removes only its effect, not unrelated athlete edits. |
| Accumulated state | Multiple edits plus modifiers, more than one week, a phase change and app termination/relaunch—not just a fresh single-action fixture. |

Use simulator/transaction coverage first; Sam's phone is final acceptance, not the
first bug-finding tool. Report exactly what Sam should check and record his
confirmation. His earlier week-edit/reopen confirmation covers only that older
version and one unspecified edit. Do not stretch it into acceptance of this table.

**Step 3 remains “awaiting Sam device acceptance” until he confirms the relevant
journeys.** If he is unavailable, finish independent verification and leave an
explicit checklist rather than claiming completion.

## Finish this work with a short receipt

Tell Sam: candidate commit; installed device/build; tests and flows actually run;
what he confirmed; remaining defects/questions; and what was not covered. Keep
historical receipts separate from fresh measurements. For each fixed defect,
name the guard that catches the next defect of the same class.

No new product decision is needed merely to begin this list. Ask only when a
specific behaviour conflict, reset permission or other genuine blocker appears.

## Deliberately later

Steps 4–6 are small real-training beta, App Store material/setup, and final
submission. They remain later work, not silently completed. No verified completed
TestFlight-beta receipt is carried here. Store privacy copy still needs a fresh
review against actual architecture before publication.

AI program editing, monthly reviews, accessory–mobility pairing, automatic 2 km
assessment scheduling, accounts and Android are not automatically launch blockers.
Do not activate dormant builders or expand scope without Sam asking.

## NOT COVERED by this handoff

- No app code, test implementation, phone data or release configuration changed.
- No fresh full gate, simulator acceptance, phone install or beta was run here.
- The year export is a headless diagnostic, not a passing clinical/programming
  audit or phone-UI acceptance receipt; its injury defect remains unresolved.
- Live Coach service, App Store Connect, privacy compliance and submission status
  were not verified here.
