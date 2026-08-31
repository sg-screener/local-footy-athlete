# Programming selection-system repair

Owner: `selectionrepair`

## Boundary

- Start from the current shared checkout; never reset to audit checkpoint
  `b2f927ee1b5f67dde3790b65fe7205c0697ec446`.
- Preserve unrelated tracked and untracked work, including the active Progress/UI
  changes already present when this seat started.
- Work the user's numbered steps 1–9 in order, with one path-scoped checkpoint
  per completed step. If a step is blocked, record its completed portion,
  blocker and exact Sam question, then continue later independent steps.
- Repair the automatic selection/compiler system. Do not force catalogue items
  to appear and do not use catalogue coverage as a programming objective.
- Do not install, reset or wipe either phone. Compiler tests and the full-year
  audit come first.

## Starting state

- Branch: `codex/failure-only-state-export`.
- HEAD observed before edits: `72d9ab6a`.
- Existing dirty paths were read with `git status --short` and remain outside
  this seat's ownership.
- Unique commit stamp: `Agent: selectionrepair`.

## Current step

Steps 1–4 and 6 complete; Step 5 is checkpointed with one product decision
blocked; Step 7 next.

## Step 1 — compiler-owned automatic selection trace

Compared two designs:

1. Re-run pool filters inside the year audit after generation. Rejected: that
   is the exact separate audit recreation which made the 96 zero placements
   unclassifiable.
2. Emit observation rows beside each decision from the canonical compiler and
   let audits consume them. Chosen: selection remains pure/deterministic and the
   trace cannot disagree about which decision actually ran.

The compiler now emits one typed stream covering strength, power and
conditioning. Each row records the dated need, movement/quality, phase, kit,
experience, injury/proximity context, the complete candidate set, eligibility
and typed rejection causes, rank, recent/annual/weekly usage fields, selected
identity and reason. Conditioning traces enumerate all 55 authored templates,
including the routes rejected before a category pool is entered. Callers can
receive the exact stream via `selectionTracesOut`; no store or second selector
was added.

Verification:

- `test:programming-selection-trace`: 5 passed / 0 failed. It compiles a real
  week twice and proves observing decisions changes no finished program; all
  three decision kinds are present; every winner is eligible/rank 1; all 55
  conditioning rows are classified at each choice; selected identities appear
  in final session rows.
- `test:weekly-strength-variety`: 5 / 0.
- `test:power-pool`: 90 / 0.
- `test:compile`: shipped product and devtools remain 0 errors. The gate remains
  red on four pre-existing test-scope errors in three untouched test files.
- Existing diagnostic debt was not hidden: `test:conditioning-rotation` remains
  178 / 58 and `test:composer-b1` remains 46 / 4. Their failures are stale-route
  expectations already present before this trace and are not Step 1 regressions.

Mutation/liveness: removing the `selectionTracesOut` handoff makes the new test
fail its non-vacuity and all-three-kinds cells; selecting a candidate without an
eligible rank makes the winner cell fail. The traced and untraced final programs
are compared structurally, so an observer that changes selection fails.

NOT COVERED at this checkpoint: zero-placement classification, catalogue-order
independence, new ranking policy, composition repairs, conditioning modality
persistence, deload quality ownership, release-gate integration and the fresh
male/female lived-year rerun. Those are Steps 2–9 and remain open.

## Step 2 — exhaustive zero-placement classification

The preserved male/female 52-week lived driver ran against the current app with
the compiler observer installed: 104 athlete-weeks, 104 restart checks and
3,182 distinct athlete + compiler-decision identities after rebuild/restart
de-duplication. The raw 189 MB trace stays in ignored audit output; the tracked
report records its SHA-256 and the reproducible commands.

All 96 distinct zero-placement catalogue identities from the completed audit
(denominator: 215 distinct exercise-tag/template catalogue identities) are now
classified, with no unknown class:

- not eligible for the audited athletes: 30
- eligible but out-ranked: 24
- missing automatic programming route: 2
- incorrectly tagged/classified (compiler-selected but absent from the final
  audit): 16
- intentionally manual/special-use only: 24

The exhaustive per-identity evidence is in
`docs/PROGRAMMING_ZERO_PLACEMENT_CLASSIFICATION_2026-08-31.md`. Counts named
`candidateDecisions`, `eligibleDecisions` and `selectedDecisions` use distinct
athlete + `decisionId` pairs, not observer occurrences. The classifier gives
compiler evidence precedence: a selected identity cannot be described as
out-ranked merely because the old final-program audit counted it as absent.

Compared two designs:

1. Infer eligibility from the final rows and catalogue metadata. Rejected: this
   recreates the audit's original unclassifiable B-vs-C gap.
2. Install a scoped no-op observer at `compileCanonicalProgram`, run the exact
   preserved lived driver, de-duplicate compiler decisions, then use catalogue
   metadata only for identities the compiler never considered. Chosen.

Verification:

- lived trace driver: both 52-week years completed, including all 104 restart
  checks.
- `test:programming-selection-trace`: 6 / 0, including observer disposal and
  structural non-interference.
- `test:catalogue-reachability-classification`: 5 / 0 across all five classes.
- classifier invariant: exactly 96 / 215 audit identities classified; zero
  unclassified rows.

NOT COVERED at this checkpoint: fixing the 16 selection/final-delivery
mismatches or two missing routes; those findings feed the later selection and
composition repairs. The trace observer records compiler attempts and the
lived output records accepted final weeks, but the existing driver does not tag
which individual rebuild attempt became the accepted block. Catalogue-order
independence, ranking policy, composition, modality persistence, deload
ownership, release gates and final corrected audit remain Steps 3–9.

## Step 3 — catalogue order is not selection policy

The completed audit's mutation reversed `CONDITIONING_TEMPLATES` and
`EXERCISE_TAGS` and changed 66 athlete-days. The same full lived run now yields
**0 differing athlete-days / 728 athlete-days compared** (2 athletes × 52 weeks
× 7 days), with 104 / 104 restart checks green on both sides.

The selection fix is one shared rendezvous-style owner,
`stableDecisionDiversity`: after legality, explicit preference, phase policy,
role and recorded history have formed an otherwise-equal candidate cohort, the
decision identity plus candidate identity resolves diversity. Reordering,
adding or removing an unrelated catalogue row cannot move the winner. This is
not a second global alphabetical/random carousel and it does not outrank a
programming fact.

That owner replaced all discovered position/index paths in:

- block exercise first-selection and least-recently-used ties;
- conditioning history ties and no-history rotation;
- power rotation; and
- off-feet conditioning fallback.

A stronger diagnostic also reversed every strength-pool array. It exposed two
additional positional reads outside ordinary selection: sibling progression
took the first recorded pool member, and the generic substitute helper kept a
score tie in pool order. The progression source now prefers the same authored
group and closest load ratio; substitute ties use the same decision-keyed
diversity owner. A remaining stronger-mutation difference sits specifically in
the injury-recomposition path (Bodyweight Squat vs Goblet Squat at the same
score). It is recorded, not hidden, and Step 5 owns injury-replacement
coherence. It does not affect the exact audit mutation proved by this step.

Compared two designs:

1. Sort equal candidates alphabetically or encode the old position as a numeric
   priority. Rejected: both replace one arbitrary global order with another.
2. Keep every semantic rank where it is and resolve only an exact equal cohort
   from the stable decision + candidate identities. Chosen: deterministic
   diversity is local to the decision and independent of catalogue position.

Verification:

- `test:programming-catalogue-order`: 3 / 0 — strength, conditioning and power
  each survive an in-memory reversal.
- full lived-year order mutation: 2 / 2 athlete years, 52 / 52 weeks each,
  0 / 728 differing athlete-days.
- `test:block-selection-authority`: 5 / 0.
- `test:power-pool`: 90 / 0.
- `test:weekly-strength-variety`: 5 / 0. The founding check now asserts the
  semantic property (distinct horizontal presses including a dumbbell press,
  plus a vertical pull) rather than requiring one incidental spelling.
- `test:conditioning-templates`: 152 / 0.
- `test:programming-selection-trace`: 6 / 0.
- `test:compile`: product 0, devtools 0; still red only on the same four
  inherited test-scope errors in the three untouched files recorded in Step 1.
- `test:strength-progression-integration`: 104 / 1, with its pre-existing
  “Conditioning/recovery still placed on empty days” failure unchanged.

Mutation/liveness: reversing all 55 conditioning templates, all exercise-tag
object entries, the power pool, and the focused strength candidates leaves the
named selector tests green. Removing the stable order makes the conditioning
and power reversal cells select a different identity. The two complete lived
runs are preserved under `output/programming-order-step3-final/` with driver
receipts and selected-decision evidence.

NOT COVERED at this checkpoint: the stronger strength-pool/injury-recomposition
tie above; contextual scoring beyond the existing legality/phase/history
policy; all composition findings; modality persistence; deload ownership;
release integration; final corrected audit. These remain Steps 4–9.

## Step 4 — contextual selection, including accepted power history

The selection system now uses every requested programming input at the layer
that owns it. Movement/quality, phase, equipment, experience, injury and game
proximity remain hard eligibility or policy rules in the strength, power and
conditioning specialists. Variety cannot make an unsafe or unsuitable row
eligible. Strength and conditioning already consumed accepted block history,
weekly seats and athlete preference; the uncovered route was power, whose
identity still came from a block hash with no accepted past.

Power now has the same explicit domain boundary as strength/conditioning: one
small `BlockPowerSelection` fact per block + family + weekly seat. The compiler
passes prior accepted facts in, records the current compilation's distinct
seats out, and persists them beside the other selection histories. A current
seat restores exactly. A new seat ranks equally suitable candidates by weekly
use, recent use, longer-term use and time since last use, then applies the
catalogue-order-independent decision tie-breaker. Its real compiler trace now
reports those same history facts rather than placeholder zeroes.

Compared two designs:

1. Give each selector a new weighted points score. Rejected: safety gates and
   phase rules would become tradeable, and three weight tables would drift.
2. Keep legality/phase/explicit preference as ordered programming rules, then
   apply exposure facts only inside the remaining suitable cohort. Chosen.

Verification:

- `test:power-pool`: 94 / 94. Added live cells for long-term anti-dominance,
  second-seat weekly spacing, current-seat restoration and non-zero trace use.
- `test:block-selection-authority`: 5 / 5, including author/replay/probe
  persistence boundaries.
- `test:programming-selection-trace`: 6 / 6.
- product TypeScript scope: 0 errors.
- The pre-existing selection paths continue to provide: strength athlete pins,
  phase hinge policy, progression continuity, weekly identity/group spacing and
  block history; conditioning requested quality, role, modality feasibility,
  weekly seat, recent quality/template history and accepted restoration.

Mutation/liveness: flooding one otherwise-suitable power identity through eight
accepted blocks makes the selector move away from it; removing the exposure
ordering makes that cell fail. Recording the first weekly seat makes the second
choose another suitable identity; removing the weekly count makes that cell
fail. A current-block record is restored and the trace states 8 annual / 3
recent uses for the deliberately dominant candidate.

NOT COVERED at this checkpoint: composition repairs, explicit conditioning
modality persistence, deload quality ownership, release-chain integration and
the corrected lived-year audit. These remain Steps 5–9.

## Step 5 — final-composition repairs (one blocked product decision)

Compared two designs for the implausible Bottoms-Up KB Press progression:

1. Add a load cap or special progression increment for that spelling. Rejected:
   the 49.5 kg x 15 output was a route/identity failure, not an arithmetic one.
2. Make automatic strength seats draw only from the pool that owns that route,
   and stop special-only shoulder-health rows at `shoulder_prehab`. Chosen.

`Bottoms-Up KB Press` lived only in the shoulder-health pool, but its accurate
`vertical_push` movement tag also gave it ordinary `vertical_push` and
`arm_or_shoulder` strength seats. It therefore inherited the normal strength
load/dose/progression system. Pool-backed strength seats are now closed over
their authored anchor/accessory pool, and shoulder-health rows with no separate
strength-pool membership stop at the typed prehab route. Dual-authored rows such
as Band Pull-Apart retain both legitimate routes.

The other completed composition findings:

- a canonical Commercial-gym generation reaches a squat main and does not use
  Leg Press while the appropriate squat anchors are legal; the old audit's
  108 Leg Press / zero Back Squat result came from its stale hand-authored
  "full kit" fixture omitting `rack` and `trap_bar`, not from production's
  Commercial-gym answer;
- a club anchor carrying composed strength remains typed `Team Training` but is
  now visibly named `Team Training + <canonical strength identity>` rather than
  silently hiding the gym prescription behind plain `Team Training`;
- a 6/10 shoulder adjustment selects a nonempty lower-body/midline block, every
  selected exercise is rated `good`, and no triceps row is used; and
- injury block diversity now uses the same decision-keyed stable order as the
  other selectors, so reversing strength-pool arrays cannot flip the final
  replacement block.

Verification:

- `test:programming-final-composition`: 2 / 2 (shoulder safety/coherence and
  full strength-catalogue reversal).
- `test:programming-selection-trace`: 7 / 7, including final commercial-gym
  squat-main survival and the absence of Bottoms-Up KB Press from every
  ordinary strength candidate set.
- `test:generated-week-assembly`: 30 / 30, including the final combined club
  identity.
- `test:slot-coverage`: 84 / 84.
- `test:injury-recomposition`: 186 / 186.
- `test:programming-catalogue-order`: 3 / 3.
- `test:compile`: product 0 and devtools 0; still red on the same four inherited
  test-scope errors recorded in Steps 1 and 3.

Concurrent/baseline reds were not hidden: `test:injury-session-adjustment` is
50 / 4 on its moving real-world witness (its expected conditioning change and
pre-existing safe row are absent in the current generated week),
`test:injury-fallback-journey` is 181 / 1 on its trunk-pattern coverage census,
and `test:session-naming` has the existing early-off-season expectation plus a
composer-severance fixture failure. The focused final-content and accumulated
injury tapes above are green.

BLOCKED product decision — Primer length. R-129 explicitly signs seven checked
rows plus three optional rows (Acceleration, one heavy lower lift and Bench),
and `test:primer-session` guards that exact athlete-visible composition. The new
request says Primers must remain short, but does not say which signed work to
remove or whether automatic female G-1 and athlete-added Primers may diverge.
The exact question for Sam is: **should a short Primer (A) keep the seven checked
rows and omit the three R-129 optional rows everywhere, or (B) omit those rows
only from the automatically placed female G-1 Primer while retaining the full
athlete-added Primer?** No signed row was silently deleted while that answer is
open.

NOT COVERED at this checkpoint: the blocked Primer decision, physical-iPhone
acceptance, the full corrected lived-year rerun, modality persistence,
deload-quality ownership and release-chain integration. Those continue in
Steps 6–9; the phone remains untouched.

## Step 6 — explicit conditioning modality through restart

The current compiler already carries modality as typed data at each required
boundary; no title/notes inference or new production writer was needed:

- every authored template has an explicit `permittedModalities` field;
- conditioning feasibility resolves the available/safe delivery into typed
  `ergModality` / `conditioningFeasibility.resolvedModality` fields;
- final composition writes `ConditioningOption.modality` and, for mixed work,
  the exact `modalitySequence`; and
- the visible session reads that option field into its separate mode label.

The same-turn `29784175` conditioning-identity checkpoint removed the remaining
name overwrite at the delivery boundary: equipment may select the mode but can
no longer rename the selected authored template. That work was inspected only
after its owner committed and cleared the shared paths.

The missing proof was persistence. The general lived-year `visibleSignature`
does not include `ConditioningOption.modality`, so its restart equality could
remain green if every mode disappeared. `test:conditioning-modality-persistence`
now drives a real onboarding/generation, requires every final option to carry a
typed mode, proves that mode is allowed by the template's explicit modality
set, requires the session renderer to expose a mode label, then closes/reopens
the app and compares title + modality + mixed round sequence exactly.

Verification:

- `test:conditioning-modality-persistence`: 3 / 3.
- `test:conditioning-templates`: 152 / 152 (recorded by the conditioning
  identity owner at `29784175`).
- `test:projection-ownership`: 13 / 13 and `test:signed-copy-extraction`: 7 / 7
  (same checkpoint receipt).

Mutation/liveness: the persistence tape is non-vacuous on a generated option;
removing `option.modality` fails the typed-mode cell and changing it to a mode
outside the selected template fails the explicit-permission cell. Dropping or
changing it only during rehydration fails the exact post-restart receipt.

NOT COVERED at this checkpoint: physical-iPhone rendering/VoiceOver, genuinely
multi-option "Choose one" blocks, Step 5's blocked Primer decision,
deload-quality ownership, release-chain integration and the corrected lived
year. Those remain open; the phone remains untouched.

## Step 7 — one weekly deload-quality owner

This was a real ownership defect, not duplicated copy. The full-year audit
contained 28 sentence occurrences across 12 distinct athlete-weeks (14 rows in
6 male weeks and 14 rows in 6 female weeks) saying each row was "the week's one
quality exposure". Within a single week there were two or three such rows.
`applyConditioningDeloadToExercises` held a local `qualityKept` counter, and the
adapter invoked it separately for every session, so the counter restarted for
every day.

Compared two repairs:

1. Deduplicate the athlete-facing sentence after composition. Rejected: it
   would hide the contradictory ownership while leaving each session free to
   classify itself as quality.
2. Make the canonical weekly compiler elect one chronological typed
   conditioning plan entry, then hand every governed session an explicit
   `weekly_quality_owner` or `easy_aerobic` role. Chosen: the row transformer
   still owns the signed half-work/easy treatment, but no row can become a
   week-level owner by regex-reading its own template name or notes.

The focused tape proves that an aerobic row containing `MAS` cannot self-promote,
two tempo candidates produce exactly one final quality row and one ownership
sentence, and reversing plan storage order leaves the chronological owner
unchanged. Its liveness mutation removes the typed roles and recreates two
self-elected owners immediately.

Verification:

- `test:deload-quality-owner`: 11 / 11.
- `test:deload-law`: 68 / 68.
- `test:compile`: product 0 and devtools 0; the new Step 7 test has 0 type
  errors. The same four current test-scope errors remain in
  `canonicalWeeklyCompilerSliceTests.ts`, `fatiguePlumbingTests.ts` (2) and
  `fixtureMutationTransactionTests.ts`.

The broader canonical compiler tape is red on four Pre-season-persona restart
checks: the selected conditioning template changes after relaunch (for example
`2 min On / 1 min Easy` to `30:30 Controlled Tempo Blocks`, and `Fly 20` to
`20 m Shuttle Repeats`). Reverting Step 7's only possible template-category
change left those exact four failures unchanged; the focused Step 7 coordinate
is green. The wider red is recorded, not presented as Step 7 coverage.

NOT COVERED at this checkpoint: the existing conditioning-template rotation
restart red, physical-iPhone copy, Step 5's blocked Primer decision,
release-chain integration and the corrected lived-year rerun. These continue
in Steps 8–9; the phone remains untouched.

## Step 8 — release-blocking programming-selection gate

The release guard now exercises the finished compiler output, not a sample or
an isolated selector. `test:programming-catalogue-order-year` generates the
same complete 52-week male and female athlete programs twice from a corrected
commercial-gym onboarding fixture: once with every automatic catalogue in its
authored order and once with all four catalogue families reversed. It compares
728 final athlete-days after every adapter, repair and projection step.

The guard proved its own liveness on its first run. It failed on 24 / 728 final
days, all female weeks 29–52. The first differing day was the automatic G-1
Primer on 2027-04-16: authored order selected `Explosive Landmine Press` and
`Box Jumps`, reversed order selected `Explosive Push-Up` and `Lateral Jump`.
The existing compiler traces were byte-identical across that difference,
showing that `sessionBuilder.pickPowerEntries` was a second, untraced power
picker using filtered array position.

The repair routes that derived Primer choice through the shared power selector,
the same accepted block history, and the compiler's trace/output sinks. It does
not sort the catalogue in place or weaken the mutation. The rerun is green:
reversing every automatic catalogue changes **0 / 728 final athlete-days across
2 complete athlete-years**.

The named release gate is `test:programming-selection-release`. It joins the
full-year order mutation to compiler trace integrity, catalogue reachability,
power-pool policy, conditioning modality persistence, weekly deload ownership,
block-two progression, final injury composition and generated-week assembly.
`test:programming-hierarchy`, already in `test:bible`, now invokes this release
gate, so it cannot remain a green side script nobody runs.

Verification:

- `test:programming-catalogue-order-year`: PASS, 0 / 728 differing final days.
- `test:programming-selection-release`: PASS, including 7 / 7 trace cells,
  5 / 5 reachability cells, 94 / 94 power-pool cells, 3 / 3 modality-restart
  cells, 11 / 11 deload-owner cells, 41 / 41 block-two cells, 2 / 2 final
  composition cells and 30 / 30 generated-assembly cells.
- `test:primer-session`: 27 / 27 after the shared-selector repair.
- `test:compile`: product 0 and devtools 0; the same four inherited test-scope
  errors remain in `canonicalWeeklyCompilerSliceTests.ts`,
  `fatiguePlumbingTests.ts` (2) and `fixtureMutationTransactionTests.ts`.

NOT COVERED at this checkpoint: physical-iPhone execution, native onboarding
taps, athlete profiles outside the audited male/female inputs, Step 5's blocked
Primer-length decision, and the final corrected lived-year classification and
strange-session review in Step 9. The phone remains untouched.
