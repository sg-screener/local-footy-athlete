# Release candidate — rcsteps — 28 August 2026

Owner: rcsteps. Candidate: `0bcc3353e65d7a80b584925b466af254b1296cdd`.
Current status: current release gate **20/20 units green**, three requested
simulator flows completed, clean signed Release built. **INSTALL HELD** for the
separately reproduced P13 shoulder/pressing concern below. Not physical acceptance.

## Source and architecture

The canonical weekly compiler and accepted-state transaction owners are retained.
No new compiler, storage format, prescription authority or Coach route was added.
Reviewed checkpoints: `4d531b53`, `2fb87b04`, `feeec3b7`, `0bcc3353`.
The unrelated shared-checkout `docs/NOW.md` edit and untracked handoff/outputs are
outside this candidate's commits.

Clean build source:
`/private/tmp/lfa-rcsteps-release-0bcc3353.gmYxo6/source`.
All 2,327 tracked files match their candidate Git blobs. Manifest SHA-256:
`f8d576386553fae27b712cf0b9990ef3184fdde4da992e2140bab34405f5a3aa`.
Native dependencies were copied and regenerated using the existing lockfile;
tracked source remained unchanged. The first dependency attempt rejected a
symlink's external paths; local dependency copies resolved that without updating
versions. Old generated scripts pointing to another temporary checkout are not
used for the candidate build.

## Fixed defects and protection against the next one

| Finding | Existing owner corrected | Guard and observed mutation |
| --- | --- | --- |
| Injury modality substitution renamed strength Rows to Bikes | `coachModalitySwap` limits rewrites to typed conditioning rows | `injuryRecompositionTests` accumulated week-8 male/female shoulder/deload projection, restart and clear; bypassing role boundary fails 12 assertions |
| Readiness reduction reset an accepted lift's load to its starting estimate | Source-fact compiler retains the same accepted lift's own load | `readinessLoadRetentionTests`: 32 assertions across 2 genders × 2 facts; bypassing retention fails 4 |
| Severe non-red-flag injury removed unaffected upper work | Constraint translator uses the shared red-flag predicate | `injuryFallbackJourneyTests`: 173 assertions; restoring global pause fails unaffected upper-day assertion |
| One-week simulator seeds changed block requirements on restart | Seed requests the normal four-week canonical block | `devE2ESeedRegistryTests`: 104 assertions; shortening conditioning fails its full-block assertion; all 17 seed IDs exercised |

The accumulated injury guard uses seven weeks of real onboarding/training history,
then actual projection and production boot. It does not compare two invalid
outputs and call that success. The missing mobility headline uses the existing
signed optional-mobility copy; no bogus exercise names or new copy were approved.

Relevant legacy diagnostic decisions are in `scripts/test-truth-decisions.json`.
Real current contracts were repaired/promoted; obsolete adapter-strengthIntent,
whole-session Swap copy, and invalid extra-session fixtures were not reinstated.
Conditional StaleOverrideBanner copy remains a disclosed copy-binding question,
not new copy approved by this seat.

## Final simulator receipts

iPhone 17 Pro simulator, iOS 26.3, Metro 8081. Logs below are in
`/private/tmp/rcsteps.gdCdyC/`.

- `flow-readiness-final.log`: completed; reduced sets and retained own load,
  Program/My Status modifier, restart, clear, second restart and original dose.
- `flow-conditioning-accessible.log`: completed; coherent 4×4 VO2 work/rest,
  one checked row, logged completion overlay, real restart and checked summary.
- `flow-swap-final.log`: completed; Front Squat's own load, unaffected RDL
  dose/load, restart; expanded form cues and load control inspected on screen.
- Additional non-seeded journey reached real onboarding, back/forward and
  no-team-training answers, generation, a second week, readiness apply/clear,
  off-season last-game question/availability and phase completion. A separate
  real process restart retained onboarding and Off-season with zero modifiers
  (`flow-cold-actual-skip.log`, `flow-cold-phase-restart.log`).

The original optional golden tape is NOT reported green: its 2 km text-selector
tap did not advance. An attempted Continue did not help; source inspection shows
the skip itself should advance, and a direct visible-button tap did. The earlier
explanation that Continue was missing is withdrawn. Exact cause of that initial
tap is OPEN-UNKNOWN. The continued unseeded journey and restart are measured;
they do not erase the failed tape. Scratch continuation files are retained beside
the logs, and no source change was made to mask this interaction.

Earlier conditioning failures are retained separately: a real seed denominator
mismatch, then obsolete Start/summary and visual-text/accessibility selectors.
The reopened screenshot visibly retains the check and 1/1; the passing assertion
also verifies the accessible completed header and row. No persistence gate was
removed. One earlier swap attempt hit iOS accessibility-service failure; rerun
completed, separately from product/selector findings.

## Release and install receipt

### Additional finding from the concurrent programming handoff

`docs/HANDOFF_PROGRAMMING_REMEDIATION_2026-08-28.md` arrived during final
verification. It assigns the additional P01–P22 work to a subsequent owner and
explicitly retains this release work. Its reported P13 intersects this task's
injury surface, so rcsteps reran the original eight-week male world on `0bcc3353`
in a new directory, preserving the old evidence:
`/private/tmp/rcsteps.gdCdyC/current-shoulder-review/`.

Measured: after shoulder 4/10 with `pressing` trigger on 17 November, the actual
18 November output still contains Bench Press 2×8 at 77.5kg and DB Bench Press
1×10 at 32.5kg. Two distinct press rows on one athlete-day, not two independent
bugs. Projection now succeeds and Row identities are correct. The repaired
identity guard never claimed to enforce every painful-trigger rule.

The severity-only risk owner returns `caution` and permits both at 4/10. Bible
§8 separately says painful bench must not become merely lighter bench and
calls for shoulder-friendly variations at 4–5. The remaining question is the
end-to-end painful-trigger policy, not whether the names are valid. This is
current P13 reproduction evidence for the programming-remediation owner; no
new rehabilitation or substitution policy is invented here.

**Installation is held pending resolution of P13 or explicit direction from
Sam on a diagnostic-only install.** A green current gate does not prove this
additional programming contract. Independent gate and clean packaging may
finish; this candidate is not presented as ready for training acceptance.

Final gate: `release-0bcc3353-clean.log`, exit 0: **20/20 executable units**
covering **23 current contracts** plus infrastructure/typechecking. All three
TypeScript scopes have zero errors. Annual acceptance: **416/416 athlete-weeks**
across **8 distinct archetypes × 52 weeks**, zero distinct failure keys and all
six permanent mutation controls green. Canonical compiler: 604/604 assertions;
injury recomposition: 106/106; injury fallback: 173/173; Coach commitment: 64/64;
session execution: 201/201. Ownership: zero rival authors and zero derived-output
writers among 1,136 reviewed capability owners, zero unresolved reviews.

This run and the built artifact use the isolated exact `0bcc3353` source;
post-run and post-build Git-blob comparison remained identical. The initial
isolated attempt stopped at missing Git
metadata; metadata for the exact candidate was added, not a synthetic commit.
Historical/mixed-version runs are not the final receipt.

Durable workspace copies of the final logs, selected screenshots, original
mutation evidence, annual result/HTML and fresh P13 reproduction are in
`outputs/release-candidate-0bcc3353-rcsteps/`. Scratch setup/build logs remain in
`/private/tmp/rcsteps.gdCdyC/`; the clean source and binary remain in the native
build directory below.

Native build: fresh `xcodebuild clean build`, Release/iphoneos, exit 0,
`BUILD SUCCEEDED`. No old app artifact was reused. Bundle version **1.0.0 (1)**.
Strict/deep codesign verification passed. Embedded `main.jsbundle` SHA-256:
`8acfe2c9d83a196ddedd22f0e114fce3f134e77bc16642cacbab6360bd37ffd9`.
Post-build source comparison still matches all 2,327 candidate Git blobs and
the manifest hash above. Logs: `native-release-0bcc3353.log`,
`codesign-verify.log`, `codesign-details.log`, `candidate-source-after-build.json`.

Built artifact:
`/private/tmp/lfa-rcsteps-release-0bcc3353.gmYxo6/DerivedData/Build/Products/Release-iphoneos/LocalFootyAthlete.app`.
Install/launch: **NOT PERFORMED — HELD for P13**. This is a packaged diagnostic
candidate, not a claim of training readiness or a release approved for users.
Target: Sam's iPhone 16 Pro Max,
`AFA21856-881E-587B-96D5-60817FD11018`, bundle `com.localfootyathlete.app`.
Renee's device is not a target. No physical app reset is authorised or performed.

## Sam's acceptance checklist — all awaiting confirmation on this candidate

Preserve existing data for upgrade/restart. Do not reset the app for the first
check. Record the exact action and result, not just “the phone works.”

1. Open after upgrade: existing profile, week, logs and accepted edits remain;
   terminate/reopen and check again.
2. Session/logging: inspect sets, loads, expanded cues/control placement, one
   conditioning prescription/tick, completion overlay and saved progress.
3. Injury: on a populated week add/change severity/restriction, reopen, clear
   and verify restoration. Include the repaired shoulder/deload scenario.
4. Readiness/illness: apply, inspect scope and both modifier surfaces, reopen,
   clear; unrelated edits remain and retained lifts keep their intended loads.
5. Equipment: change supported equipment, inspect valid substitutions and own
   loads, reopen and restore without losing unrelated choices.
6. Exercise removal: Remove→Undo; separately Remove→My Status Restore; reopen.
7. Week view: add/move/remove, including occupied and multi-part days; check
   actual content, confirmation, supported Undo and persistence.
8. Fixtures: add/move/remove, occupied precedence, bye/Sunday game and
   day-before-game choices, then reopen accumulated changes.
9. Season: phase change, completion feedback and reopen; off-season last-game
   calendar and no off-season team-day request.
10. Modifiers: Program/My Status agree; clearing one removes only its effect.
11. Accumulated state: combine edits/modifiers, navigate multiple weeks, change
    phase, terminate/relaunch and compare the actual program.
12. Separately, cold onboarding on an authorised test device/reset: real
    back/forward navigation, no-team-training, availability/equipment, generation
    and first week. **BLOCKED-BY: sam — fresh reset permission or test device.**

**BLOCKED-BY: sam — physical acceptance requires his observations.** No earlier
week-edit confirmation is transferred to this version.

## NOT COVERED

P13 is reproduced but unresolved; P01–P22 programming remediation is not completed
by this release task. Physical install is held; physical acceptance and physical
cold onboarding are unverified. Annual coverage is not
every injury/equipment/action permutation or clinical validation. Live Coach
service, remote persistence, beta/TestFlight, App Store/privacy submission,
Android and dormant feature integration are outside this work.
