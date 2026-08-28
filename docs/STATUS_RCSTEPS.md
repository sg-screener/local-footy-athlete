# STATUS — seat `rcsteps`

Owner: `rcsteps`, opened 2026-08-28. Scope: the release handoff's steps 1–3,
in order; canonical compiler and accepted-state transaction ownership preserved.
Name checked against all existing STATUS files. Start: `abe168cf` on
`codex/failure-only-state-export`. Existing NOW edit, untracked handoff, outputs
and fuse files belong to others and are preserved.

## Step 1 — in progress

Reviewed the combined-source changes since `86efeadb`, current template status,
test-truth section 41, current rules and injury Bible sections. No new UI design
or programming rule is authorised by this task.

Reproduction: copied the external driver into `/private/tmp/rcsteps.gdCdyC`
before running `--weeks=8 --gender=male`. Original full-year artifacts untouched.
`repro-before.log` / `year-programs.json`: 56 daily snapshots, six projection
exceptions on 17–22 November, one distinct error string keyed by message.
The 17 November rows contain Barbell Bike (2 × 8, 67.5kg) and Chest-Supported DB
Bike (1 × 10, 22.5kg). The week is reached through onboarding and seven weeks
of logged training, not a manufactured workout fixture.

Source cause: the canonical injury-conditioning stage invokes the shared
modality rewrite, which rewrites every exercise's text without establishing
that the row belongs to conditioning. Strength Row is mistaken for rowing.
Options compared: (1) restrict the existing shared rewrite to the existing typed
conditioning component/registered conditioning identity; (2) replace the rewrite
or build a new conditioning author. Choose (1): the current owner already has
the identity; a new author is unnecessary and outside the architecture brief.
Do not add bogus exercise names to signed copy or swallow projection errors.

Simulator startup initially hit sandbox restrictions; the approved retry of
`npm run lfa:dev` launched the existing iPhone 17 Pro simulator using Metro
8081. No physical-phone data/reset operation has run.

### Fresh injury and UI-review measurements

`injury-new-before.log`: 94/106 assertions green; 12 failures from both sexes,
covering bike/ski strength-row corruption and live/restarted projection.
`injury-fixed.log`: 106/106 assertions green. The shared modality owner now
uses declared component role/IDs or exact authored conditioning identity;
non-conditioning rows, loads and prescriptions are preserved byte-for-byte.
Both eight-week walks reached scheduled deload, mixed rows and >20 logged days,
then injury, actual projection, restart, clear, second restart.

`compile-third.log`: zero product/devtools/tests errors, baseline unchanged.
Initial release attempt correctly stopped at two readonly test-field assignment
errors; corrected by immutable profile-answer copies, not a baseline allowance.
This initial attempt is not a release receipt.

Reviewed exactly three changed ownership capabilities and their callees:
SessionCompleteMoment (conditional support text only), DayWorkoutScreenV2
(the existing completion component moved into Sheet; existing transaction
callbacks retained), shared modality transform (conditioning-only selection).
Updated only their three explicit fingerprints, preserving classifications.
No new program writer or stored output was introduced.

The Coach diagnostic exposed a real missing mobility component copy mapping;
the existing authored Mobility entry is now reused. Its restart failure was
NOT a block-reader defect: its Off-season profile omitted seasonFinishedOn,
so hydration rightly treated onboarding as incomplete. A speculative block-reader
change was fully backed out. Completing that fixture alone yields 64/64
Coach assertions, including offer/no-write, preview, accept, decline and restart.
No Coach architecture change remains.

## Remaining work / blockers

### Step-2 findings and current receipts (28 August, ongoing)

The four relevant failure classes were separated, not restored wholesale:

- Readiness genuinely reset retained loads to starting estimates (squat
  110→107.5kg, RDL 90→87.5kg in one actual onboarding world). The existing
  source-fact compiler now carries the same lift's accepted load when reducing
  readiness/illness dose. Alternative considered: reorder all progression and
  deload authoring; rejected as an unnecessary architecture expansion.
  `readiness-load-before.log`: 28/32 assertions; `readiness-load-fixed.log`:
  32/32 across four distinct gender/fact coordinates. Bypassing the carry
  reproduces four failures. Actual projection, active restart, Clear and second
  restart are checked. This is now `test:readiness-load-retention`.
- Severe hamstring without red flags incorrectly became a global exposure
  pause and removed an unaffected upper-body day. The existing translator now
  calls the shared red-flag predicate. Alternative: restore rows downstream;
  rejected because it would hide the wrong constraint rather than correct it.
  Bible §8 and the current guided label say pause AFFECTED work at 8–10.
  `test:injury-fallback-journey` now uses real complete onboarding and a real
  Add to reach single-leg hip: 173/173 (`fallback-hip.log`). Reinstating the old
  global translation fails the unaffected-upper-day cell (`mutation-severity.log`).
- Durability uses actual typed row IDs, as the UI does, rather than old
  name-only payloads. R-124 reports a named pause when no per-exercise rung is
  legal; it does not invent an unrelated substitute. Eight sequences / 48
  assertions green (`durability-current.log`). Bypassing the canonical swap
  fails the swap/no-inherited-load controls (`mutation-swap.log`).
- Current UI source pins: session execution 201 assertions, approved icons 26,
  primary day-first timeline 56; selected mutations fail each. The chained
  week-board diagnostic retains one obsolete adapter-strengthIntent expectation
  (80/81); the composer ownership law forbids that adapter field. Block-extra
  retains three fixture/obsolete-expectation failures; real commitment behaviour
  is held by the repaired 64-assertion Coach suite. Copy binding retains 7/9:
  retired whole-session Swap text and conditional StaleOverrideBanner wording.
  No replacement copy was signed by this seat. Classifications are explicit in
  `scripts/test-truth-decisions.json`, not a separate skip list.

Simulator (iPhone 17 Pro, iOS 26.3, Metro 8081):

- `flow-readiness-fixed.log` COMPLETE: reduced sets, same own load, Program/My
  Status modifier, active restart, Clear, second restart and restored dose/load.
- `flow-swap-displayname.log` COMPLETE: deliberately seek Front Squat through
  the real ranked choices (not first-offer assumption); its own 67.5kg from
  the load authority, unaffected RDL dose/load, restart. Expanded-cue screenshot
  inspected: controls below the cue, collapsed controls intact.
- Conditioning reaches authored 4×4 VO2 prescription, one checkbox, logged
  completion and completion overlay. Its checkpoint reload reports a persisted
  program-store fingerprint mismatch. Investigating before accepting that flow.
- One swap run hit an iOS accessibility-service `kAXErrorInvalidUIElement`;
  rerun succeeded. Selector failures and the genuine readiness load failure
  are separately retained in the scratch logs.

`release-checkpoint.log` finished 14/14 executable units green, but changes were
still being made while it ran: this is NOT an exact-final-version receipt.
Current registry now has 23 contracts / 20 deduplicated/bootstrap units; final
exact-version run is still required. Zero compile errors in each of the three
scopes (`compile-after-severity.log`), no baseline allowance. One further
source-fact capability was reviewed and its fingerprint refreshed; no new
author or derived-output writer was introduced.

- Owner rcsteps: regression + mutation protection, UI inspection and candidate gate.
- Owner rcsteps: all three named flows and relevant diagnostic dispositions.
- Owner rcsteps: clean verified Release build/install when steps 1–2 permit it.
- BLOCKED-BY: sam — physical acceptance needs Sam's confirmation on the final
  installed candidate. Cold onboarding on a physical device needs a suitable
  test device or fresh explicit permission to reset that app's local data.

## NOT COVERED

No exact-final full release pass, final conditioning flow, physical install or
physical acceptance yet. Historical receipts are not reused as current proof.

### Full-block fixture correction and final source freeze

The conditioning restart mismatch was isolated by reading the simulator's
persisted inputs before/after boot. Exactly one input changed: its accepted
block required-strength-session count, 4→16. The seed generated one week while
boot reconstructed the normal four. Logged completion was retained. This is a
fixture defect, not permission to silence fingerprint comparisons or change
the production block denominator.

Compared extending the seed-specific exception list with making every seed use
the real block length. Removed the exception list; all 17 seeds request the
canonical four-week block and return its unmodified output. New seed assertions
first failed for 8/17 seeds (`seeds-before.log`, 96/104 assertions green), then
passed 104/104 (`seeds-fixed.log`). Targeted in-memory shortening of conditioning
fails exactly its new assertion, 103/104 (`mutation-seeds-targeted.log`). The
broader initial mutation also prevented an adjacent-week seed from constructing;
the targeted mutation establishes the new cell itself is live.

The seed suite now runs as test infrastructure within the release bootstrap;
it is not relabelled a product contract. Reviewed only the changed
`deterministicProgram` capability fingerprint. All three TypeScript scopes are
zero (`compile-final-source.log`). The preceding `2fb87b04` release attempt
stopped in bootstrap on an untyped Add result in the test; that harness typing
is now explicit. No failed or mixed-version run is claimed as a release pass.

The full-block conditioning flow passes the persisted-input restart gate. Its
last obsolete selector expected Start after logging; the actual completed day
offers View summary. Updated that selector and rerunning the entire flow.
Completion overlay screenshot was inspected: overlay above the session, one
conditioning checkbox and coherent work/rest prescription visible beneath it.

NOT COVERED: final exact-commit release and three-flow rerun, clean native build,
data-preserving install, physical cold onboarding and Sam's device acceptance.

### Current receipt and additional installation hold

Candidate `0bcc3353` has all three requested simulator flows completed. Real
non-seeded onboarding, generation, second-week navigation, readiness apply/clear,
off-season transition and process restart were also reached through the UI.
The optional original golden tape's text tap on the 2 km skip did not advance;
a direct tap did. My initial missing-Continue explanation was wrong and is
withdrawn. The failed tape is not reported green; the continued journey and
restart have separate receipts. Full details and log paths are in
`docs/RELEASE_CANDIDATE_RCSTEPS_2026-08-28.md`.

The concurrently written programming-remediation handoff names P13: shoulder
pressing still present. A fresh copy of the original driver, eight-week male
run at `0bcc3353`, confirms two distinct press rows on 18 November under the
active shoulder-4/pressing constraint: Bench Press 2×8 77.5kg, DB Bench Press
1×10 32.5kg. New evidence is in
`/private/tmp/rcsteps.gdCdyC/current-shoulder-review/`; original exports untouched.
The severity-only owner permits `caution` at 4; the Bible separately forbids
merely lighter painful bench and asks for shoulder-friendly variation. Identity
corruption is fixed, but that does not settle this distinct trigger-policy issue.

Owner: programming-remediation implementation seat for P13, coordinated with
rcsteps for the later release. INSTALL HELD pending that resolution or explicit
Sam direction for a diagnostic-only install. No physical app reset or install
has been performed. Independent exact-candidate gate and packaging continue.

NOT COVERED: P01–P22 remediation, P13 corrected trigger policy, final clean
Release packaging, physical install, cold onboarding and Sam acceptance.

### Final independent verification / handoff

Exact candidate `0bcc3353e65d7a80b584925b466af254b1296cdd`: final release gate
20/20 executable units green for 23 current contracts; three TypeScript scopes
zero; annual 416/416 athlete-weeks from eight distinct 52-week archetypes, zero
distinct failure keys, six permanent mutations green. Canonical compiler
604/604, injury recomposition 106/106, fallback 173/173, Coach 64/64, session
execution 201/201. Ownership zero/zero among 1,136 reviewed capability owners.
The three named final simulator flows passed. Real unseeded UI onboarding/phase
and restart observations are separately scoped above.

Clean isolated Release build succeeded, strict/deep signature passed, version
1.0.0 (1), embedded JS SHA-256
`8acfe2c9d83a196ddedd22f0e114fce3f134e77bc16642cacbab6360bd37ffd9`.
All 2,327 tracked files still match the exact candidate after tests and build.
Final artifact/receipts/checklist are in
`docs/RELEASE_CANDIDATE_RCSTEPS_2026-08-28.md`; retained evidence is under
`outputs/release-candidate-0bcc3353-rcsteps/`.

No install, launch, uninstall or reset was performed on either phone. Sam's
phone was rediscovered read-only. Step 3 cannot reach physical acceptance while
P13 remains unresolved; the new pressing evidence is handed to the programming
remediation owner. These current-contract greens do not certify P01–P22 or
override the installation hold. Report-only changes after the candidate do not
change the built source identity.

NOT COVERED: P13 remediation, other P01–P22 changes, physical install/acceptance,
authorised physical cold onboarding, live Coach/remote services, beta/store.
