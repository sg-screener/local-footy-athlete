# Programming follow-up — conditioning clarity and remaining decisions

Owner: programming-remedy. Verified baseline: `8dbcbc00`; report-only checkpoint
`738090ba`. Neither baseline evidence nor the original examples are overwritten.
Installation remains held; no phone reset, wipe or install is authorised here.

## Decision audit

REGISTRY-GREP: R-014, R-079, R-080, R-089, R-116, R-237–R-241, R-260–R-264.
Also checked Bible sections 7, 13, 14 and 20, the original P01–P22 handoff,
and `OPTIONAL_PLACEMENT_RULINGS_2026-07-30.md`.

Sam answered all five decisions in this task. These answers supersede the
earlier proposals below and the older unresolved-decision list at `8dbcbc00`.
Programming-remedy owns implementation and verification, not new content decisions.

1. P02/P06/P16: unilateral priority with missing rack/barbell is already
   directed. R-089 also settles uncovered-first coverage rather than erasing
   required squat/hinge coverage. The earlier replace-versus-lead question was
   too broad and is withdrawn. Remaining choice: delete Leg Press/conventional
   Deadlift versus keep manual/fallback access, and automatic preference.
   SIGNED: keep both for manual choice and suitable fallbacks. New automatic
   selection prefers legal alternatives; existing accepted selections restore.
2. P15: R-079 explicitly permits preseason flying sprints with club acceleration
   work; that permission is not a new question. Implement it within the existing
   nights, conditioning and safety limits. No new automatic in-season microdose
   is proposed where club work already supplies the need.
3. P17: the Bible lists Box/Broad jumps and example doses but its explicit
   automatic pool excludes them, and limits in-season lower work to vertical
   and lateral jumps. Recommend adding Box/Broad/Jump Squat as rotating
   alternatives in the existing single power slot for developing+ off/preseason,
   with existing doses and equipment/injury limits; keep the in-season pool.
   WITHDRAWN PROPOSAL: Sam rejected the extra age/phase preference above.
   SIGNED: Box/Broad/Jump Squat join the ordinary selectable pool, with no
   invented preference for Vertical Jump. Existing equipment/injury safeguards
   and previously signed Depth/Bounds/Kneeling constraints remain; no extra dose.
4. P18: no-default/spare-day filling is already forbidden. The need-computation
   definition explicitly requires sign-off. Recommend a recent game/hard club
   session plus mild reported soreness as the trigger for at most one safe,
   optional off-leg flush, not illness, injury or an empty day alone. This trigger
   WITHDRAWN PROPOSAL: Sam instead specified an OPTIONAL G+2 off-leg flush unless
   conditioning or team training is already there. Mild reported soreness after
   the recent game/hard club work makes it CORE on G+2. Existing unavailability,
   actual machine access, fixture and safety constraints remain. No spare-day
   filling outside G+2. Recovery work does not earn fitness-conditioning credit.
5. P22: Mobility + the five distinct existing additions is already repaired.
   Recommend merging another Mobility without duplicate exercises, with Recovery
   a separate removable part under the existing limit. WITHDRAWN merge proposal.
   SIGNED: another Mobility or Recovery is a separate added session, composed
   AFTER reading every exercise already programmed on that day. No duplicate
   exercises in the added session, including Mobility added to Strength and
   Mobility/Recovery added to each other. The current daily session limit stays.

P15 clarification: R-079 permits preseason top-end work with club acceleration;
it does not mandate extra app sprinting when club work already meets the floor.
Sam accepted keeping the existing club-floor policy; no new automatic in-season
microdose is authored.

## Implementation history and first failures

- Shared copy reviewed for 55 templates / 110 ordinary-minimum variants. The
  authored catalogue hash remains `27982face1a656ce4f2f93fc3c68ebb77b2c191d7df3f487b33d820e61921c89`.
  Work, recovery and numeric dose are compared against saved pre-edit output.
  Erg Flush Blocks keeps three blocks; machine order now belongs to the actual
  equipment selection, not a hard-coded promise of three machines.
- Bodyweight Circuit has four unnamed movements in its authored prescription.
  Sam has been asked for the missing list; no movements/doses were invented.
- First selection guard: 33 passing / 21 failing assertions, including absent
  automatic Box/Broad/Jump Squat and Leg Press priority. Existing ten-entry power
  suite now checks the approved expansion, retaining every prior safety check.
- Real Add journeys: duplicate exclusion, row identity, Undo and restart passed;
  the added separate-part assertion initially failed for both genders because
  two Mobility sessions shared one displayed component. Existing row workout
  identities now distinguish those sessions; no new store or alternate writer.
- First full-year run stopped at week 39's knee update. The new flush demand
  had leaked `recovery_flush` into the stored energy-system field, which accepts
  `aerobic_base`. Corrected in the existing connector, not by weakening the
  evidence map. A second diagnostic reached both 52-week athletes; it is not
  final candidate acceptance. The same review caught the assembly dropping the
  flush role on combined days; the enumerated conditioning contribution now
  carries that role beside its conditioning block.
- Final candidate checks and reports are still pending. Diagnostic output:
  `outputs/programming-clarity-2026-08-28/`.
- Wider Add witnesses reached 14 actual journeys (male/female × seven base/Add
  combinations), including manual-Mobility repetition and Recovery+Recovery.
  Two first failures showed a repeated Jefferson Curl from the separately derived
  strength warm-up. The existing context seam now reads the same warm-up,
  performed movement IDs and ledger/exclusion projection as the screen. Six
  further assertions exposed duplicate Mobility/Recovery grouping after a manual
  Mobility swap; row-owned kind now takes precedence over the container fallback.
  The resulting 104 assertions pass, including separate completion, session limit,
  exact Undo and restart. No native acceptance is implied.
- G+2's fixture move/back witness initially lost its flush because the existing
  minimal fixture specialist correctly removed stale offers but never reconsidered
  the fresh compiler target's offer. It now does that before acceptance, preserving
  lifting and suppressing conditioning/team collisions. The 11-assertion isolated
  fixture journey passes; complete compiler rerun is pending.
- P16's first real no-rack/no-barbell checks failed in four distinct athlete/kit
  worlds (8 assertions passed, 4 failed). A repeated fallback Leg Press occupied
  both lower days. The existing slot composer now keeps one necessary bilateral
  fallback and the other day's existing single-leg work, without more sets or
  relabelling. Accepted current seats and pins remain protected. All 12 focused
  assertions, including restarts, now pass; annual acceptance remains pending.
- The diagnostic session-checklist chain reached 201/201 checklist assertions
  and 74/74 mobility dose assertions, then failed three source checks in
  `quickExerciseActionsTests`. The test, screen and control source are byte-equal
  to baseline `8dbcbc00`; these are pre-existing diagnostic failures. No test was
  removed or weakened and the full diagnostic chain is not reported green.

## Approach

Compare (a) individual card text patches and (b) the existing shared structured
conditioning formatter and typed mode owner. Use (b): review the actual emitted
copy from all 55 templates and both ordinary/reduced-dose variants, then make
wording-only corrections there. No new writer, scheduler or alternate planner.
Keep authored doses/recovery unchanged and compare identical-input final years
against the verified baseline. New behavioural claims require named guards and
mutations; required-field checks alone do not certify readable instructions.

## Saved candidate and current acceptance

Product candidate: `38457383935fe9bbe5b522c78647f97b94a52c68`.
The earlier pending statements above describe the implementation sequence, not
the final state. Baseline `8dbcbc00` remains intact. No architecture replacement,
new program writer, progression rewrite or test-budget relaxation was made.

Exact `npm run test:release` at this candidate: **20/20 units green, exit 0**,
covering 23 current product contracts plus bootstrap and all-scope typecheck.
Product, devtools and test scopes each have zero type errors. The annual gate
reached 416/416 green athlete-weeks (eight distinct profiles × 52), with 416
weekly restarts and zero distinct failure keys. The canonical compiler slice
passed 1,891 assertions; modifier lifecycle passed 248. These are named-surface
results, not an app-wide or physical-acceptance claim.

Writer census: 1,138/1,138 distinct executable capability owners reviewed;
zero unresolved, rival authors or derived-output writers. No allowance raised.
All 38 named in-memory fault mutations landed and were caught; the original 24
remain included. Undo's existing layer/reversal checks also remain in the gate.
Both isolated release-test and native-build checkouts matched all 2,344 tracked
Git blobs before and after verification. This report/status save changes only
documentation; the verified product candidate remains `38457383`.

[Consolidated verification receipt](/Users/samgeurts/Documents/local-footy-athlete/outputs/programming-clarity-2026-08-28/candidate-38457383/final-verification.json).
Neither phone was touched. The installation hold remains, and the original
22-item list is not closed by a green release gate.

### Conditioning review

All 55 distinct templates were read as emitted prescriptions, not certified by
required-field checks. Both ordinary and minimum-dose variants were compared:
110 variants / 220 rendered rows, with zero changes to numeric sets/reps/rest,
prescription type, Work text or Recovery text. The authored catalogue hash is
unchanged. Air Bike's 5% power-drop recovery/stop instruction and 4×4's complete
rest remain. Repeated intensity/description wording was shortened.

Actual machine labels were additionally captured across four equipment worlds
(220 template/equipment examples; unavailable combinations are diagnostic, not
claims that the scheduler selects them). Multi-machine flushes name the machines
and say to change after each round and repeat that order. Continuous and hard
work choose one actual available machine. Air Bike is distinguished from Bike.
These claims are held by `conditioningClarity`, including real generation,
modality changes and restart; the mutation receipt checks the guards themselves.

**Not complete:** Bodyweight Circuit still says four movements without naming
them. Its mode eligibility also misreads its modality-agnostic prose as allowing
machine renderings, demonstrated in `conditioning/actual-mode-examples.json`.
Question for Sam: which four movements should this fallback contain? Completing
that named prescription and correcting its eligibility are remaining work, not
an approved invented circuit. Existing intensity targets were not silently
converted into new machine targets as a wording fix.

One further reachability limitation is recorded, not silently fixed by changing
a dose: Erg Flush Blocks emits three 8-minute blocks, but its authored text also
contains an 8–10-minute alternative. The existing hard-cap reader takes that
10-minute ceiling and therefore restricts this template to Bike. The actual-mode
examples demonstrate that restriction. Reconciling the resolved prescription
with that eligibility calculation remains technical follow-up; this pass did
not weaken the 8-minute Ski/Row/Air Bike cap or claim that this particular
template now rotates through all machines.

Evidence: `outputs/programming-clarity-2026-08-28/candidate-38457383/conditioning/`
contains `templates.txt`, `templates.json`, `actual-mode-examples.json` and
`review-receipt.json`. This supersedes the earlier report's broad P01/P09 wording.

### Original 22-item ledger

“Automated” means implemented/preserved and covered by the named checks; it does
not mean accepted on Sam's phone. The whole list is **not finished**.

| Item | Current disposition |
| --- | --- |
| P01 | Reviewed all 55 and cleaned emitted copy. **Partial:** Bodyweight Circuit's four named movements and mode eligibility remain open; see question above. `conditioningClarity` and saved before/after copy. |
| P02 | Automated: actual kit and whole-week placement retained; repeated fallback Leg Press removed from the second unpinned no-rack/no-barbell lower seat, retaining that day's single-leg work. `unilateralPriorityJourney`: four real athlete/kit worlds, 12 assertions with restart. |
| P03 | Automated baseline fix retained: automatic Gunshow/female Primer restricted to the existing qualifying fixture opportunity; manual Add and Mobility retained. `spareCapacityOfferTests` and accumulated Add journeys. |
| P04 | Automated: power rest remains in domain doses but is hidden in the screen/report. `programmingInputTruth` and four final-year artifact audits. |
| P05 | Automated baseline spacing, quality/history and in-run selection fixes retained. `programmingInputTruth`, identical-input year comparison. |
| P06 | Answered and automated: Leg Press/conventional Deadlift remain manual/suitable fallbacks. New choices prefer legal alternatives; accepted block choices and pins restore. `programmingSelectionDecisions`. |
| P07 | Automated wording review; explicit authored active-recovery exceptions retained, not renamed complete rest. 4×4 remains complete rest. The 110-variant comparison shows no Recovery-text or numeric-dose change. No further answer needed to retain signed exceptions. |
| P08 | Automated baseline advanced loaded-curl preference retained, with band-only fallback and younger-athlete availability. `programmingInputTruth` and mutation. |
| P09 | Actual machine identity/order implemented and tested, including modality change/restart. **Partial:** the Bodyweight Circuit exception is not correctly classified yet. No bare “Mixed modalities” is presented as a complete new prescription. |
| P10 | Automated baseline whole-week/cyclic spacing retained within fixtures, kit and availability. Annual/canonical gates cover constrained worlds; the unchanged 15 adjacent same-part calendar pairs per illustrated athlete include forced pairs, not a global-optimality claim. |
| P11 | Automated rcsteps fix retained: Row in a lift name is not rewritten to Bike. Mixed-day mode changes preserve non-conditioning rows/doses. |
| P12 | Automated identity/projection protection retained at rollover and in final annual projections. No corrupt-name alias added. |
| P13 | Automated trigger-family fix retained: painful pressing is excluded according to the injury policy, not two bench-name exceptions. Accumulated modifiers, replacement dose, Clear, special sessions, rollover and restart remain covered. Final-year shoulder windows contain zero trainable painful presses. |
| P14 | Automated baseline max-machine preference removal retained; actual available/renderable modes now own the prescription. `programmingInputTruth`, `conditioningClarity`. Erg Flush Blocks' raw-alternative versus resolved-dose cap restriction remains technical follow-up, as recorded above. |
| P15 | Answered: existing R-079 preseason flying-sprint permission with club acceleration is retained; club-floor coverage does not mandate another app speed session. No invented automatic in-season microdose. Existing typed speed/history guards remain. |
| P16 | Automated, following the already-given direction: one necessary bilateral fallback is retained, rather than repeated Leg Press on both lower days; the other day retains real single-leg knee work. No lunge relabelled squat, no extra sets, no accepted seat erased. `unilateralPriorityJourney`. |
| P17 | Automated: Box/Broad/Jump Squat are in the ordinary selectable power pool without the withdrawn age/phase preference. Current kit/injury safeguards and signed Depth/Bounds/Kneeling/Pogo rules remain. Existing pool suite plus selection/kit/restart guards. |
| P18 | Automated: optional off-leg G+2 flush, suppressed by existing conditioning/team work; mild recorded soreness after recent game/hard club work makes it core. Actual kit, availability and safety still apply; no fitness credit or spare-day filling. `gPlusTwoFlushJourney`, real fixture move/back and annual output. COD remains deliberately unforced. |
| P19 | Answered: Explosive Landmine Press remains present as vertical-push strength. No unrequested dedicated-power role/dose introduced. |
| P20 | Cross-cutting implementation and four final-year audits completed; exact release verification recorded below. **Acceptance remains partial** while the content/eligibility exception and physical acceptance are open. |
| P21 | Automated baseline receiver-combination ranking retained; weeks 3/4 are compared with identical athlete inputs, not a new equipment world presented as a code-only improvement. |
| P22 | Automated baseline additions/drag fixes retained. New separate Mobility/Recovery additions exclude the whole day's existing drills, including strength warm-ups. 14 real journeys / 104 assertions cover male/female × seven base/add combinations, separate identity/completion, two-session limit, Undo and restart. Native second-Mobility Add/Undo/Save/restart passed; broader native coverage is listed below. |

### Delivered years and before/after

Four final reports cover male/female × original partial kit/corrected commercial
kit. Each is 52 weeks / 364 distinct dates with 52 successful weekly restarts.
Before/after pairs match profile, dated actions and phase inputs by assertion;
the baseline is `8dbcbc00`, not a different athlete or silently enlarged kit.

- [Male, corrected commercial kit](/Users/samgeurts/Documents/local-footy-athlete/outputs/programming-clarity-2026-08-28/candidate-38457383/corrected-commercial-male-year.html)
- [Female, corrected commercial kit](/Users/samgeurts/Documents/local-footy-athlete/outputs/programming-clarity-2026-08-28/candidate-38457383/corrected-commercial-female-year.html)
- [All four years](/Users/samgeurts/Documents/local-footy-athlete/outputs/programming-clarity-2026-08-28/candidate-38457383/year-comparison.html)
- [Identical-input comparison](/Users/samgeurts/Documents/local-footy-athlete/outputs/programming-clarity-2026-08-28/candidate-38457383/before-after-summary.md)

Frequency units are displayed row placements, choices expanded, excluding warm-up
and separately exported speed; not sets, completions or selection calls. Each
pair has 364 athlete-days. Distinct-name counts are shown alongside placements.

| World / athlete | Placements before → after | Distinct names before → after |
| --- | --- | --- |
| Partial / male | 1830 → 1807 | 131 → 132 |
| Partial / female | 1977 → 1961 | 127 → 129 |
| Commercial / male | 1833 → 1853 | 141 → 141 |
| Commercial / female | 2005 → 2024 | 137 → 138 |

In each partial-kit year Leg Press placements fall 98→55 and conventional
Deadlift 30→0. Commercial Leg Press falls 23→0 male / 19→0 female, Deadlift 7→0
in both. Box/Broad/Jump Squat are now represented. Short Flush appears on 20
distinct dates per athlete/world. These are output observations, not quotas.
Four artifact audits find no projection error, corrupt display name, empty
lifting dose, missing conditioning mode or trainable painful press in the
measured shoulder window. The Bodyweight exception is not reached by these four
years, so their mode check does not close that separate finding.

### What catches the next defect

The checks reach whole visible days, separately derived warm-ups, manual and
generated low-load bases, accumulated facts/edits/logs, fixture move/back and
restart. They compare exact row identities and doses, not just names or function
presence. The machine matrix checks actual selected labels and catalogue
constraints; output review remains necessary because prose-parsed eligibility
can still be semantically wrong, as Bodyweight Circuit demonstrates. In-memory
mutations deliberately remove exclusion, component ownership, warm-up context,
flush restoration, pool reachability and preference branches, plus the retained
P13 and other baseline faults. No shared production files are mutated.

### Native verification and build

Six full simulator flows passed: second Mobility Add/Undo/Save/restart;
Mobility+Gunshow drag/Undo/Save/restart; conditioning/logging;
readiness/load/Clear/restart; swap/load/restart; and non-seeded onboarding with
modifier Clear and phase change. A further non-seeded run reached process
restart and showed Off-season with zero active modifiers. Its exact accessible
label and empty state then passed an in-place continuation without reseeding.

The additional cold run has two retained failed attempts: the first “No current
issues” tap reached the injury-location branch; the retry completed onboarding
and restart but the scratch assertion expected a standalone “Off-season” label,
not the real combined “Season phase Off-season. Review” accessibility label.
The screenshot already showed the correct state; the exact-label continuation
confirmed it. This is not an uninterrupted seven-flow pass, nor proof of reliable
onboarding taps. The original 2 km skip-tap inconsistency remains open.

Clean isolated Release build: succeeded, version 1.0.0 (1), deep/strict signature
verification exit 0. Bundle SHA-256:
`007eeee7740accd023981e313e05fdc78d222e0e3e5641b1649347dc619ff1ad`.
All 2,344 tracked candidate files matched Git blobs before and after the build.
The first sandboxed dependency setup hit DNS denial; its approved retry
completed. No installation was performed, and neither phone was touched.

### Retained diagnostic failures

The optional session-checklist diagnostic chain passed its 201 checklist and 74
mobility-dose assertions, then failed three pre-existing quick-action source
checks. Their test/screen/control sources match `8dbcbc00`. The legacy law gate
still has 21 UNENFORCED rows, its existing missing game-feedback script and LR18
registration issue; the new R265 row is guarded. Existing repo-process checks
also flag an older boundary/inbox format and orphan Maestro flows. None of these
diagnostic chains is claimed green; no test was weakened to hide them.

## NOT COVERED

- The four Bodyweight Circuit movements and its incorrect mode eligibility;
  P01/P09/P20 and the full 22-item list are not closed.
- Erg Flush Blocks' resolved-dose versus raw-alternative eligibility restriction.
- Physical installation/acceptance. Installation remains held; neither phone
  was installed, launched, reset or wiped by this work.
- Onboarding 2 km skip-tap consistency: still unresolved, not proven fixed even
  if the unchanged onboarding flow passes on this attempt.
- Repeat onboarding injury-answer tap reliability; the unexpected branch above
  is retained as QA evidence, not diagnosed as a new programming regression.
- Every native Add permutation, native guided painful-trigger entry, clinical
  validation, remote persistence and true OS-death fault injection.
- Full Cartesian athlete/action coverage and globally optimal spacing.
- HTML visual-layout QA: local-file Browser access was rejected; no bypass or
  unperformed visual verification is claimed.
