# Programming remediation — Sam's 22-item review

Written 28 August 2026. Owner of implementation: the next chat Sam assigns to
this handoff. Coordination owner for the already-running release work: `rcsteps`.

**This handoff is planning and evidence only. Sam explicitly said not to fix
anything in the documentation turn. No app code, prescriptions, tests, test
decisions, rule registries or athlete data were changed to produce it.**

## 1. Outcome and boundaries

Improve the actual year the athlete receives: appropriate choices, purposeful
spacing, correct equipment and injury constraints, clear conditioning, and
working additions to Mobility days. Preserve the canonical compiler, accepted
decisions, logging, modifiers, restart and Undo. This is not another architectural
rebuild, an AI programming project, or permission to activate dormant builders.

Sam's list is a strong starting point. It mixes verified selection defects,
reported UI problems, changed product preferences, questions, and defects another
chat has already repaired. Do not flatten these into 22 independent patches.

Compare these implementation options before coding:

1. Local overrides for each bad exercise, date or screen. These may improve the
   two examples but leave conflicting equipment inputs, placement and identity.
2. Repair inputs and policies within the existing owners: resolved equipment,
   typed components, whole-week scheduling, quality-specific selection and final
   projection verification. **Recommended.** It addresses the shared causes
   without adding another program writer or replacing the compiler.

The sections below are a work specification, not a claim that new policies are
already implemented or guarded. Record confirmed new product decisions in the
existing ruling/law registries with behavioural guards in the implementing change.
Do not create a second rule registry or enter new unenforced laws.

## 2. Start here: current work versus the old example

Read the repo entry instructions, `docs/NOW.md`, relevant current status files,
`docs/LFA_PROGRAMMING_BIBLE.md`, and matching `docs/RULINGS_REGISTRY.md` entries.
Check actual branch, HEAD and dirty files; the checkout is shared.

- Observed branch: `codex/failure-only-state-export`; HEAD: `0bcc3353`.
- Original example source: `abe168cffe7576d3b6fd4cca744b3b529c6d4314`.
- `docs/STATUS_RCSTEPS.md` is the current release-work receipt and ownership
  pointer. Re-read its tail before editing shared files.
- Earlier release handoff: `docs/HANDOFF_RELEASE_CANDIDATE_STEPS_1_3_2026-08-28.md`.
  Its open-bug list predates the fixes below. This handoff adds programming work;
  it does not cancel the release acceptance work or roll back those fixes.

### Already repaired by rcsteps; retain and reverify, do not redo

These are owner-reported receipts read from status/history, not fresh test runs
by this documentation turn:

- **“Barbell Bike” / “Chest-Supported DB Bike”:** `4d531b53` restricted modality
  rewriting to actual conditioning identities instead of replacing “Row” inside
  strength names. The real accumulated shoulder/deload journey checks projection,
  restart and Clear for both athletes. This does **not** settle whether shoulder
  pressing choices are appropriate (P13).
- **Readiness load retention and unaffected injury work:** `2fb87b04` preserves
  the accepted load of retained lifts when reducing dose; severe regional injury
  without red flags no longer causes an automatic global exposure pause.
- Injury-fallback, exercise-swap durability and Coach-commitment expectations
  were reviewed against current product behaviour, not blindly restored.
- **Simulator fixture correction:** `feeec3b7` gives all 17 seeds real four-week
  canonical blocks; boot no longer compares a one-week seed with a four-week
  reconstruction. `0bcc3353` updates the completed conditioning selector to the
  actual View summary control.
- New receipt written during this handoff:
  `docs/RELEASE_CANDIDATE_RCSTEPS_2026-08-28.md` now records all three final
  readiness/conditioning/swap simulator flows completed. Its exact-version
  release gate, additional non-seeded flow and native install/physical acceptance
  were still pending. Do not repeat an old “three flows need fixing” claim.

No full-gate or physical-phone pass is claimed for this handoff. A green older
commit is not a receipt for the next candidate.

## 3. Evidence package — preserve the original

All paths below are under:

`/Users/samgeurts/.codex/visualizations/2026/08/26/01a03b69-9022-7041-b909-ca28d5e0d275/`

- `full-year-programs.html`: the original athlete-readable year.
- `year-programs.json`, `male-year.json`, `female-year.json`,
  `year-generation-receipt.json`, `generate-year.cjs`: original output/driver.
- `exercise-frequency-audit/exercise-frequency-report.md` and
  `placement-counts.json`: delivered-row frequency census and raw occurrences.
- `selection-diagnosis/findings.md`, `selector-trace.json`, `trace-original.cjs`:
  selector diagnosis at the original revision. The instrumented male rerun
  matched all 364 original daily snapshots over 52 weeks. A separate speed-row
  capture matched all 728 daily snapshots across both athletes.

The two examples each cover 52 weeks, 28 September 2026–26 September 2027:
12 off-season, 16 pre-season, 24 in-season; six gym days Monday–Saturday outside
in-season and five Monday–Friday in-season; Saturday/Sunday games and byes;
injuries, readiness and illness. They are examples, not universal population
coverage. See the driver/receipt for exact dated inputs.

**The original “commercial gym” example was incompletely specified.** Its
current typed equipment answer omitted the rack, trap bar, dip bars, rings/TRX,
Swiss ball, ab wheel, back-extension bench and sandbag. The older equipment
field included a rack, but the current answer wins for ordinary strength.
The example borrowed `compilerYear/catalog.ts::athleteAnswers`; the label
“commercial” did not establish the resolved kit. This was an error in the
example setup, not evidence that the athlete's real onboarding omits those items.

Keep that original as a regression world. Create a separate correctly equipped
world through current onboarding/preset serialization and assert its resolved
kit before generation. Do not union the preset into an explicit partial answer:
R-260 says an untick is an answer. Missing-kit restrictions must still work.

The original visual export also omitted individual Speed rows. Missing export
detail does not prove missing app work. Compare the current Program projection
and export for Speed, modality, optional rows and recovery before attributing
every omission to the generator.

Count units: one placement is one prescribed row, not sets, completions, or
selector invocations. Optional and warm-up rows are included but identified
separately; distinct athlete-days are in the JSON. The conditioning denominator
is 55 authored templates, with 14 distinct used and 79 delivered template rows
per athlete, including sprint templates. Club/game credits and the female
Primer's separate Acceleration dose are not extra catalogue templates.

## 4. Complete intake map — no item lost

Status terms: **measured** = saved-output/probe receipt above; **source-read** =
code examined, runtime path not freshly instrumented; **reported** = Sam's
observation needing reproduction; **direction** = requested future behaviour;
**choice** = policy question, not authority to invent an answer.

| ID | Sam's issue | Disposition and destination |
| --- | --- | --- |
| P01 | Poor, repetitive conditioning wording | Reported; audit every template's final projection, not only the 4×4 card. Chunk D. |
| P02 | Leg Press twice, no single-leg knee alternative | Measured repetition; incomplete equipment is one contributor. Check weekly slot purpose as well as rotation. Chunks A/C/E. |
| P03 | No automatic Gunshow/female Primer off/preseason or in-season byes; preseason-game exception; manual Add stays | New explicit direction superseding R-237's no-game gendered offer only. Keep other optional Mobility/core rules. Chunk C. |
| P04 | Power rest periods should not appear | Already ruled by R-116: hide the display, preserve domain prescription. Verify actual renderer and report; no new recovery decision needed. Chunk E. |
| P05 | Same 30-second tempo on consecutive days | Measured in original off-season weeks 3/4. Both receiver spacing and selection context matter. Chunks C/D. |
| P06 | Remove Leg Press or last resort? Prefer other hinges over conventional Deadlift | Choice. Recommend retain catalogue/manual access, agree automatic preferences before implementing. Different hinge roles are not all interchangeable. Chunk E. |
| P07 | Recovery should say complete rest unless explicitly otherwise | Direction; 4×4 already signed in R-239. Audit other authored exceptions and match text to actual timing; do not merely relabel active recovery. Chunk D. |
| P08 | Advanced athletes should not default to band curls | Direction for this exercise's automatic eligibility/preference; retain limited-kit fallback and younger training ages. Do not ban all bands or rehab/prehab. Chunk E. |
| P09 | No clear running/off-leg choice/tag | Reported. Distinguish training quality, actual selected modality and export omission; show one actionable prescription and supported modality choices. Chunk D. |
| P10 | Similar session types clustered; lower/upper ordering poor | Measured example; improve feasible spacing across the entire week and week boundaries, respecting fixtures/availability. Chunk C. |
| P11 | Chest-Supported DB Bike | Original defect repaired in `4d531b53`; protect current fix and re-run original world. Chunk B. |
| P12 | Weekly projection fails on Barbell Bike | Same repaired identity class as P11, not a separate new name patch. Chunk B. |
| P13 | Shoulder injury still receives Bench/DB Bench | Reported; severity, painful trigger and typed risk-sheet policy decide legality. Reproduce exact rows before declaring all pressing forbidden or pulling safe. Chunk B. |
| P14 | Conditioning should not prefer the most machines | Measured: max-machine filter starves otherwise eligible templates. Replace narrowing with quality/availability/history-aware choice. Chunk D. |
| P15 | Acceleration versus top-end speed; club attendance credit | Distinction already exists in catalogue/Bible/R-079. Actual request/credit path fails to demonstrate quality coverage; audit existing rules first, isolate any new 0/1/2-night policy choice. Chunk D. |
| P16 | No rack/barbell should favour single-leg knee over repeated Leg Press | Direction. Keep true movement identity; change supported slot policy explicitly rather than tagging a lunge as a bilateral squat. Chunk E. |
| P17 | Depth Jumps uses old kit; Box/Broad/Jump Squats disconnected | Measured selector/input reachability defects. Fix kit and establish approved pool/role/dose routes, not unrestricted plyometric insertion. Chunks A/E. |
| P18 | COD may stay unprogrammed; optional in-season flush and possibly speed missing | Direction with separate eligibility questions. Flush and speed are not the same stress; preserve fatigue/game/injury constraints and meaningful exposure credit. Chunks C/D. |
| P19 | Is Explosive Landmine Press present/considered? | Yes in saved output: 15 male and 4 female placements, on 15/4 distinct days respectively. Currently a vertical-push strength entry, not the dedicated upper-power pool. Chunk E reviews intended route. |
| P20 | Consistent kit, quality/history, reachability, final-year tests; no rebuild/AI cover-up | Cross-cutting acceptance criteria for every chunk, finished by F. |
| P21 | Why weeks 3/4 conditioning only Mon/Tue/Wed? | Output measured; source-read initial receiver list uses weekday order then takes the budget. Detailed explanation below. Chunk C. |
| P22 | Add any screenshot type to a Mobility-only day; Gunshow wrongly blocked as strength; review drag/drop | Reported, not yet runtime-reproduced here. Trace existing typed section/capability mapping end to end; do not create another taxonomy or remove safeguards globally. Chunks A/F. |

### P21: why the front-loading occurs

Original male weeks 3 and 4 both show:

| Day | Delivered program |
| --- | --- |
| Monday | Lower Squat + Steady Blocks |
| Tuesday | Upper Pull + 30-second Tempo Blocks |
| Wednesday | Upper Push + 30-second Tempo Blocks |
| Thursday | Mobility |
| Friday | Gunshow |
| Saturday | Lower Hinge |
| Sunday | Mobility |

Source-read at `weeklyScheduler.ts`, the `conditioningCandidates` /
`conditioningDays` block: the ordinary candidate path uses strength-purpose
days in `WEEK_ORDER`, filters exclusions, then `.slice(0, appConditioningBudget)`.
It does not rank all feasible receiver combinations by spacing. This explains
the observed early-week concentration; instrument the exact world before editing
to prove the branch and downstream survival. Initial Mobility-only days are not
in that strength-purpose list. Other standalone/top-up paths exist, so “the app
can only put conditioning on strength days” would be an overstatement.

Selecting the same category at the same mini-cycle index then gives the same
tempo prescription. Changing its title or adding randomness does not fix either
the receiver problem or the repeated training quality.

## 5. Work chunks and acceptance criteria

Owner: assigned next-chat agent for A–F, except already-owned rcsteps work.
Proceed as complete vertical slices. If a genuinely unresolved product choice
blocks a slice, record the exact question/evidence and continue independent
work. Do not call a slice complete with only its first bullet addressed.

### A. Establish input truth and session compatibility (P17, P20, P22)

1. Capture the exact baseline commit, current tests, two original years and
   corrected-kit scenarios. Retain all other agents' edits.
2. Follow resolved equipment from onboarding/profile/temporary restrictions
   through ordinary strength, power, Primer, Gunshow, replacements and
   conditioning. Every chooser must consume the applicable current answer;
   legacy input is resolved at the existing ingress, not re-read downstream.
3. Reproduce Mobility-only → Add each screenshot type: Strength, Conditioning,
   Gunshow, Primer, Mobility, Recovery, Accessories. Start each case from the
   same real Mobility-only base; do not accidentally test a full day instead.
4. Follow `projectVisibleWeek`/visible snapshots →
   `planChangeProducer.ts::visibleSessionKindsForSnapshot` →
   `PlanChangeSheet.tsx::chooseType` → accepted edit → final projection.
   Source currently maps Mobility additions to `recovery`, but the duplicate
   guard blocks a `strength` addition if the snapshot includes `strength`.
   **That is a diagnostic lead, not proof Mobility is wrongly tagged.**
5. Reuse existing typed component identity and capabilities. Day/session/part
   identity, training quality, load credit and render grouping are different
   questions. A “not conditioning means strength” fallback is not acceptable.
   Review `visibleSessionCount` too: it currently counts distinct section kinds,
   not necessarily distinct user-visible sessions.
6. Preserve existing limits and protected fixtures. Sam asked for these choices
   on a Mobility day, not seven unlimited sessions on one date. If adding a
   second Mobility/Recovery is a merge versus separate-part decision not already
   ruled, document it before changing that policy. Do not use it to block the
   clear Mobility + Gunshow reproduction.

**Proof:** full/partial/no-equipment worlds; conflicting legacy/current kit;
explicit unticks; temporary restriction and Clear; all addition types on the
appropriate actual days; preserve Mobility and the added content; accurate
Day/Week/My Status; drag/drop, Remove, latest Undo and restart. No unexpected
duplicate or missing rows. Mutation: restore the legacy-kit read or the wrong
section classification and see the corresponding behaviour cell fail.

### B. Injury safety and identity continuity (P11–P13)

Run early because an illegal exercise is more serious than boring variation.

1. Re-run the original shoulder/deload world with the existing Bike-name fix.
   Do not replace it with aliases that legitimise corrupted names.
2. For P13, recover the actual injury date, severity, trigger, active constraint,
   affected exercises and selected replacements. Compare those against the
   typed risk sheet and final row, not just an injury banner.
3. Existing Bible §8 already distinguishes 1–3, 4–5, 6–7 and 8–10, painful
   pressing, and affected-region pauses. It explicitly rejects replacing bench
   pain with merely lighter bench. The typed risk sheet overrides illustrative
   swaps at 6–7 and above. Pulling is not automatically permitted for a shoulder
   issue. Use those rules rather than requesting them again or inventing rehab.
4. Apply the same legality to main lifts, accessories, power/contrast, Primer,
   manual additions, swaps and conditioning modalities. If no legal route is
   available, use the existing honest omission/pause behaviour, not a fabricated
   exercise or unannounced overload of another area.

**Proof:** both pathways; severity boundaries and relevant painful triggers;
actual onboarding plus accumulated injury/deload/readiness/equipment/session
edits; unrelated work retained; clear only the chosen restriction; Undo;
restart; no false “program changed” when projection did not change. Mutations
must catch a forbidden press, Row→Bike strength rewrite, and a regional injury
incorrectly suppressing unaffected work. Extend the current injury witnesses.

### C. Whole-week composition and fixture-relative optional work (P02–P05, P10, P18, P21)

1. Correct placement inside the existing scheduler/compiler. Consider feasible
   receivers over the full week, including legal standalone or combined days,
   before consuming a conditioning budget. Do not add a post-compiler rewriter.
2. Spread comparable upper/lower, conditioning-quality and speed stresses
   purposefully, including Sunday→Monday and adjacent blocks/phases. Preserve
   legal hard-day consolidation, fixture precedence, lower-versus-running rules,
   declared unavailable days, dose and recovery constraints. “Maximise spacing”
   is a preference within hard constraints, not a demand that every category
   individually attain its impossible mathematical maximum.
3. Reproduce and improve weeks 3/4 specifically. Explain which inputs forced
   any remaining adjacency. A constrained week must not silently lose required
   work or move a session onto a forbidden date just to make a prettier spread.
4. Implement P03 as a precise replacement of R-237's no-game gendered offer:
   no automatic off/preseason Gunshow or female Primer except the relevant
   preseason-game opportunity; no automatic offer on an in-season bye. Preserve
   current gender, G-1, multi-game, available-day and existing-session rules.
   Keep manual Add and accepted athlete decisions. Removing an automatic offer
   must not erase a manually added or logged session.
5. Reconsider what fills genuinely useful spare capacity after P03. Do not
   force another gym session to satisfy a day quota, and do not remove the
   independently approved equipment-free Mobility offer.
6. Give optional flush an explicit need/placement route using approved doses;
   do not equate it with extra hard conditioning or automatically add speed
   because a free date exists. Apply the existing speed rules in D.

**Proof:** 3/4/5/6-day availability plus constrained 2-day regression worlds;
off/pre/in-season; ordinary, bye, Sunday, midweek, multiple and preseason games;
club attendance variations; fixture Add/Move/Remove and Undo; female/male;
injury/tired/sick; manual extras retained; cross-week gaps; live/restart identity.
Mutation: reintroduce weekday-first budget truncation and demonstrate the
specific unconstrained spacing test fails without weakening the constraints.

### D. Conditioning quality, selection, modality and wording (P01, P05, P07, P09, P14, P15, P18)

1. Select the required training quality before a template. The source diagnosis
   found a broad sprint pool combining acceleration, top-end and repeat sprint,
   indexed by global mini-cycle number. In the original year only blocks 2/3
   requested it, so later entries never received a turn. The categories exist;
   the end-to-end selection/credit policy is what needs attention.
2. Remove max-machine-count narrowing. The original `preferRichestOffLeg`
   reduced five aerobic-base candidates to two despite other eligible options.
   Availability is a feasibility test, not a reason to prefer a template merely
   because it can use more machines.
3. Use deterministic, quality-specific selection history/context through the
   existing compiler inputs/selection authority. Preserve block stability and
   progression where intended; avoid repeated equivalent seats in the same week.
   Reopening, previewing, Clear or unrelated edits must not advance a hidden
   random cursor. Do not persist a second derived plan or consume history merely
   because a selector was called during reconstruction.
4. Separate modality from quality: one actual Run/Bike/RowErg/SkiErg/etc choice
   with a clear running/off-leg indication and eligible alternatives where
   supported. Preserve safe choices across restart. Do not infer rowing from
   the word “Row” in a strength name. Confirm whether missing modality was in
   the export, the app, or both before changing rendering.
5. R-079 and Bible §7 already distinguish acceleration/top-end and discuss
   preseason flying sprints with club training. Audit that current paths honour
   those decisions; don't propose a brand-new speed taxonomy. Resolve any
   conflict between club-night conditioning placement and its top-end rider
   explicitly. A generic club/game credit is not evidence every quality is
   covered. Ask only for the genuinely new policy, if needed: what unreported
   club content may be assumed at 0/1/2 nights, and which extra in-season
   micro-dose is warranted. Do not silently withdraw or inflate existing credit.
6. Preserve R-261: proper sprint sessions count once toward conditioning and
   retain speed quality; warm-up/Primer riders are not automatically full
   conditioning; combined work is not double-counted. Optional speed is not
   automatically recovery. Keep COD special-use/off when appropriate; no quota
   requiring every athlete to receive all 55 templates.
7. Review all 55 templates through the real shared prescription renderer:
   correct approved title; one concrete work/recovery/count/intensity; explicit
   units; complete rest by default under Sam's direction with reviewed authored
   active-recovery exceptions; concise useful coaching cue; supported modality;
   bold labels and existing spacing; no Heart rate line; no duplicate recovery.
   True two-part sessions have two clearly identified parts and coherent totals,
   not an unexplained extra prescription. Retain 4×4 VO₂ Max and its signed rest.
8. Keep internal ratios distinct from duration strings. “30 sec work / 30 sec
   rest” is unambiguous; do not render `1:1` as a second duration prescription.
   Validate displayed rounds, interval arithmetic, total duration and pacing
   against the materialised dose. Copy changes must not silently change training.

**Proof:** table-driven all-template projection plus actual final-year selection;
quality-specific opportunities including skipped block numbers; early/late
season and club-free windows; one-machine/multi-machine/run-only kit; injury
modality restrictions; same-input repeatability and restart; controlled history
advance. Mutations: max-machine filter, first-item/global-index starvation,
missing top-end route, active-recovery text/timing mismatch, double sprint credit.

### E. Strength and power routes, priorities and experience (P02, P04, P06, P08, P16, P17, P19)

1. Diagnose repeated Leg Press after fixing input truth. Distinguish weekly
   slot choice from exercise choice: Single-Leg RDL covers single-leg hip, not
   the missing single-leg knee seat. Preserve R-241's occurrence-specific,
   block-stable variation and existing main-pattern constraints.
2. Recommendation for P06: retain Leg Press and conventional Deadlift in the
   catalogue/manual choices; agree a bounded automatic preference/fallback
   policy instead of deleting them globally. P16 already directs more
   single-leg knee work when rack/barbell is unavailable. Don't falsify a
   movement tag to satisfy an old required-pattern test; explicitly update the
   approved alternative-slot policy and its guard where necessary.
3. Apply P08 to Banded Bicep Curl's automatic choice for advanced athletes with
   alternatives; preserve permitted lower-experience/limited-kit use. Exercise
   safety, purpose and meaningful load come before novelty. Do not convert the
   rule into a ban on all banded exercises.
4. Establish an approved automatic power route or explicit special-use reason
   for Box Jumps, Broad Jumps and Jump Squats. Source/probes show they have no
   ordinary strength slot and are absent from the dedicated power pool. Respect
   training age, phase, impact, dose, injury and contrast-pair rules when seating
   them. A catalogue entry alone does not author those prescriptions.
5. Fix Depth Jumps' legacy-kit path in A and verify actual delivered selection,
   not merely eligibility. Audit the special-session kit exceptions too: the
   original output sometimes placed Trap Bar/High Box/Swiss-ball work despite
   the current answer excluding their equipment.
6. Back Extension already has accessory slots; its missing bench explained
   ineligibility in the old example. Prove its route with corrected kit rather
   than inventing a redundant slot or demanding it appear for everyone.
7. Explosive Landmine Press is present and used (P19). Decide whether it also
   belongs in the dedicated upper-power route using the authored rules, not a
   global retag that removes its existing strength purpose. The old traced
   upper-power pool had only Explosive Push-Up eligible; rotation cannot create
   options from a one-entry pool.
8. Apply R-116 to power rest visibility on the current renderer and exported
   presentation. Keep the underlying rest prescription and other timing logic.

**Proof:** eligible routes exercised through final composition for each approved
auto movement; explicit testable restrictions for special-use items; no-kit and
limited-kit fallbacks; experience/sex/phase/impact constraints; progressive
block-stable loading; no duplicate main pattern; all-types injury legality;
power/contrast ordering and display; Clear/Undo/restart. Mutations: disconnect
an approved pool entry, use stale kit, force band curls with better eligible kit,
erase a unilateral slot, show the power rest line or erase its domain value.

### F. Final-year acceptance and release protection (all items, especially P20)

1. Extend existing `src/__tests__/compilerYear/` acceptance, not a detached HTML
   planner. Test delivered final rows after composition, constraints and edits,
   as well as cold compile versus persisted-ledger reconstruction.
2. Keep the original incomplete-kit pair and add the corrected actual-commercial
   pair. Cover representative sex, role/goal, equipment, experience, gym/club
   availability, fixture and injury cases; use targeted combinations for these
   defects and broader pairwise coverage, not an unpriced giant Cartesian run.
3. Add three distinct protections:
   - **Reachability:** every approved automatic entry is delivered in a suitable
     canonical scenario, or has an explicit special-use restriction. No vacuous
     tests where equipment/phase prevents eligibility for the whole run.
   - **Selection fairness within purpose:** appropriate eligible alternatives
     aren't indefinitely starved, with quality-specific opportunity counts and
     agreed concentration bounds. Not equal usage of everything or 55/55 for
     every athlete. Establish any new numeric limit with Sam, not from a guess.
   - **Placement:** no avoidable same-quality/upper/lower clustering when a
     better legal placement exists, including adjacent weeks. Hold known examples
     and constraint controls so “spread it out” cannot delete or invent work.
4. Preserve existing witnesses for canonical ownership, zero rival/derived
   writers, progression increases, deload reductions, fixture precedence,
   accepted edits, exercise removal/Restore/Undo, modifier visibility,
   readiness-load retention, injury clear/restart, logging and phase transitions.
   Match/remove an old assertion only after identifying its superseded contract
   in `scripts/test-truth-decisions.json`; never weaken tests just to green a run.
5. Review changed ownership-capability fingerprints rather than mass-refreshing
   them. Source-level counts alone do not prove a live writer or route. Mutate
   each new guard's subject in an isolated/restorable copy, prove the mutation
   landed and the behavioural gate fails, then verify restoration. Never reset
   another agent's uncommitted work to undo a mutation.
6. Register validated current-contract witnesses through the existing release
   decision mechanism. Run targeted witnesses during each slice; after the
   shared source is frozen, run `npm run test:compile` and `npm run test:release`
   on the exact candidate. The older red Bible fleet is diagnostic evidence,
   not permission to restore old programming semantics. Do not remove the
   release typecheck or add allowances to hide new errors.
7. Run real simulator flows, including Mobility Add/Move/Remove/Undo/restart,
   conditioning modality/prescription/logging, injury plus retained unaffected
   work, modifiers and fixture/phase changes. Retain rcsteps' repaired seeds and
   readiness/swap/conditioning flows; do not replace them with fabricated stores.
8. Produce versioned male/female HTML years from those same final projections:
   phases, fixtures, modifiers, actual session rows including Speed and modality,
   clear optional labels; no diagnostics clutter. Provide an accompanying
   before/after frequency/spacing summary and input/commit receipt. Do not
   overwrite the original failure evidence or suppress projection errors.
9. Once exact candidate gates and simulator acceptance pass, coordinate a clean
   Release install with the release owner and Sam. Preserve data unless a fresh
   wipe is explicitly authorised. A phone build is not phone acceptance; provide
   a short check list and await Sam's confirmation before claiming athlete-facing
   work complete.

## 6. Existing decisions and genuinely open choices

REGISTRY-GREP performed for Leg Press, deadlift, band curls, shoulder, power rest,
acceleration/top-end, Gunshow/Primer, off-leg and the conditioning rulings.
Relevant existing decisions: R-070, R-079, R-080, R-116, R-124, R-129/R-130,
R-236–R-241, R-257, R-260–R-262. Use current implementation/guards, not historical
`BUILT` or `UNENFORCED` prose as proof of present status.

- **Already decided:** power rest display versus domain prescription (R-116);
  complete 4×4 rest/title (R-239); concise consistent conditioning cards (R-238,
  R-240); unilateral identity (R-080); current equipment/explicit unticks
  (R-260); proper sprint credit (R-261); all program effects visible (R-262).
  Do not ask Sam to rule these again.
- **New clear direction:** P03 supersedes only the no-game Gunshow/Primer offer
  in R-237. P08 sets advanced band-curl preference, P16 sets unilateral priority
  with missing rack/barbell. Implement with precise tests and update the actual
  affected ruling; don't discard the rest of those contracts.
- **Real choice P06:** remove Leg Press entirely versus retain as fallback;
  how restrictive conventional Deadlift automatic preference should be.
  Recommend retaining both, changing automatic preference rather than deleting
  useful/manual options. Confirm only this choice before making it binding.
- **Possible remaining choices, only after existing-rule audit:** exact authored
  routes/doses for disconnected power entries; extra speed when club content is
  unknown; intentionally active conditioning recovery exceptions; any necessary
  numerical spacing/concentration standard or Mobility-on-Mobility merge policy.
  Ask only the unresolved part, with the current rule and concrete conflict.

Do not hold unrelated fixes hostage to those choices. Keep a short ledger in the
implementation owner's status: P-ID, current evidence, changed owner/policy,
test+mutation receipt, outstanding decision and phone-acceptance state.

## 7. Verification strategy and NOT COVERED

The next defect of this class should fail at **resolved inputs → feasible
whole-week placement → actual delivered identities/doses → restart → rendered
Program/export**, not merely at “selector returned two different names.”
Retain the small release gate's structural protections and extend its current
contract witnesses to programming quality. One compiler can reliably deliver
a poorly chosen program; proving ownership and proving choice quality are
complementary, not substitutes.

NOT COVERED in this documentation turn:

- No programming, UI or test implementation; no fresh release-gate run.
- No fresh runtime reproduction of P13 or P22 on the current candidate.
- No complete new 55-template wording review or corrected-kit annual generation.
- No simulator/physical-phone acceptance or install; no real clinical assessment.
- No App Store, beta, AI coach expansion, dormant 2 km builder or accessory–
  mobility pairing work. None is silently included in this handoff.

## Prompt for the new chat

Read `docs/HANDOFF_PROGRAMMING_REMEDIATION_2026-08-28.md` and the current
`docs/STATUS_RCSTEPS.md`. Work through chunks A–F and every P01–P22 item, keeping
the canonical compiler and existing release protections intact. Check what is
already fixed before changing it. Prove each complete slice with real inputs,
final projection, restart and mutation-tested guards. Where a genuine product
choice is missing, record the question and continue independent work. Don't
delete exercises, weaken tests, overwrite other agents' work or rebuild the
architecture just to make the example look better. At the end, provide the new
male/female years, what changed, the exact test/build receipt, questions and
anything still awaiting phone acceptance.
