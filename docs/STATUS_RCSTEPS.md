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

No fresh full release pass, completed simulator flow, physical install or
physical acceptance yet. Historical receipts are not reused as current proof.
