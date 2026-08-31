# Programming selection-system repair

Owner: `selectionrepair`

## 2026-08-31 current-findings handoff — Step 1: Going Away selection is stable

Going Away's dated equipment substitute no longer consumes the head of a pool.
After today's equipment, exclusions, experience and same-day collision filters
have produced the legal candidate set, the temporary row now asks the same typed
block exercise selector that owns normal automatic choice. Its result is shown
for that day only; the permanent block record remains the base selection.

Two designs were compared:

1. Hash `legal` locally inside the composer. Rejected because it would create a
   second exercise-selection policy beside the block selector.
2. Ask the shared typed selector with today's legal candidates and empty
   temporary history, without recording its result. Chosen because legality and
   athlete preference remain upstream, catalogue order cannot decide the row,
   and the existing temporary-history boundary remains intact.

Regression and liveness receipts:

- Red first: the enriched `test:programming-catalogue-order-year` Going Away
  tape changed 28 of 728 final athlete-days under catalogue reversal. The unit
  is final athlete-date presentations across two athletes × 52 weeks; the first
  four causal athlete-dates were male/female 2027-02-01 and 2027-02-04, with 24
  later saved-load/prescription differences in this tape.
- Corrected run: 0 / 728 final athlete-days differ. All four direct Going Away
  athlete-date rows are present and equal, and every later logged/restarted day
  is equal.
- The tape uses the accepted Going Away action after accumulated history and a
  cold restart, limits Monday–Friday to dumbbells/bands/bench, logs offered
  sessions, clears the trip through the accepted action and reconstructs every
  week after restart.
- `test:equipment-scopes`: 20 / 20. Dated kit changes the real visible week,
  every row is kit-legal, permanent selections are byte-stable, and the travel
  world plus restoration survive restart.
- `test:programming-catalogue-order`: 3 / 3.
- Mutation: restoring `substitutedToday ? legal[0] : selection.identity`
  returned the enriched tape to 28 / 728 changed athlete-days. Restoring the
  shared selector returned it to 0 / 728.
- The broader `test:exercise-rotation` remains blocked before its first
  rotation cell by an inherited hand-built profile that omits newly required
  onboarding fields, beginning with gender. It supplies no result for this
  change and was not repaired in this scoped checkpoint.

NOT COVERED at this checkpoint: physical iPhone presentation; native Going Away
sheet taps; athlete profiles beyond the audited male/female inputs; Erg Flush
modality preservation; and the two unique weight-progression concerns. No PDFs
were generated and no whole-job completion is claimed.

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

Original Steps 1–9 and all six 2026-08-31 follow-up steps are complete at
scoped checkpoints. The final isolated audit and release chain are green for
their named surfaces. Athlete-facing completion remains awaiting Sam's physical
iPhone acceptance under L10.

## 2026-08-31 follow-up 1 — every Primer is seven low-fatigue rows

Sam superseded R-129's three optional exercises. The one shared
`SESSION_SLOTS.primer` composition now ends after its seventh row: two hip
mobility drills, one upper mobility drill, one lower/midline mobility drill,
Pogo Hops, upper power and lower power. Acceleration, Trap Bar Deadlift / High
Box Squat and Bench Press are absent from both generator-placed and
athlete-added Primers. Extra work remains available by adding Strength; no
Strength composition was changed.

Two designs were compared:

1. Filter the three names after generation in each placement/write route.
   Rejected because generated, athlete-added and coach-template Primers could
   drift and the removed exercises would still be authored upstream.
2. Remove the optional slots at `SESSION_SLOTS.primer`, the common composition
   owner. Chosen because every existing route already calls this source.

Regression and liveness receipts:

- Red first: `test:primer-session` reported 22 passed / 3 failed. S7 observed
  10 rows on a real date; W1 and W2 observed the same 10-row coach-template and
  canonical write path.
- After the source correction: `test:primer-session` reported 25 / 25 across 40
  dates, the visible session template and the write canonicaliser.
- Mutation: restoring only the Acceleration slot produced eight rows and killed
  S7, W1 and W2; restoring the corrected source returned 25 / 25.
- `test:programming-final-composition`: 6 / 6.
- `test:law-registry`: the new R-288 row is well formed, resolves and names a
  chained guard. The suite remains red only on its measured inherited backlog:
  21 `UNENFORCED` rows among 221 total laws.
- Wider diagnostic truth was not hidden: `test:exercise-intake` reached and
  passed the complete Primer suite, then remained red on the pre-existing power
  deload identity cell (`Vertical Jump` versus `Broad Jumps`). `test:release`
  stopped in its bootstrap because the existing `exercise-removal-restart`
  seed could not find a Back Squat. Neither failure names Primer composition.

The correction moves toward the north star: one composition decision was
removed at the source instead of being stored or filtered separately by route.

NOT COVERED at this checkpoint: physical-phone presentation; the high
calf/Achilles conditioning case; injury-adjusted session naming; the two Seated
Good Morning routes; 32 conditioning-duration labels; the 29 classification
entries; and the fresh two-athlete, 52-week final audit. These are the remaining
follow-up steps and no whole-job completion is claimed.

## 2026-08-31 follow-up 3 — both Seated Good Mornings have an automatic route

The old audit called `Seated Good Morning` and `Seated Good Morning (Barbell)`
automatic exercises with no programming route. There were three distinct
causes rather than one catalogue-count problem:

- the compiler trace represented strength, power and conditioning only, so the
  two real automatic mobility owners could not supply evidence;
- both exercise policies said `warmup: false`, contradicting the signed intake
  statement `Availability: Automatic in mobility`; and
- the Barbell version carries a G-1 limit, while the shared gate treated a real
  off-season caller's absent `daysToGame` as an exclusion rather than as no
  upcoming game.

The typed compiler evidence now includes the composed Mobility-session route
and the in-session mobility/prehab flow. Both exercise policies admit the
warm-up route, remain excluded from ordinary strength and Primer seats, retain
their experience/equipment/injury/G-minus boundaries, and an absent or null
game distance means no G-minus restriction. Audit classification now names
`automatic_mobility_top_up` instead of inventing a missing route from the old
three-kind trace.

Compared two designs:

1. Mark both rows manual/special-use in the report. Rejected because it would
   rewrite the intake promise to fit an incomplete instrument.
2. Repair the existing mobility route and observe its real decisions. Chosen
   because the app already owns automatic mobility in two places and the trace
   can now answer from the decision that actually ran.

Regression and liveness receipts:

- Red first: the direct intake gate reported 634 / 636, with both named
  in-session mobility selection cells failing while `warmup` was false.
- Corrected direct intake: 642 / 642 across all eleven submitted exercises.
- Six-week commercial lived trace: both identities were eligible and the real
  in-session route selected bodyweight 4 times and Barbell 3 times (distinct
  selected compiler decisions for the one audited male athlete).
- `test:programming-selection-trace`: 8 / 8, including both candidate
  identities and selected-final-row survival for compiler-composed mobility.
- `test:catalogue-reachability-classification`: 5 / 5.
- Mutation 1: setting both policies back to `warmup: false` produced 636 / 640
  and killed the two no-game warm-up cells plus both actual-route selection
  cells; restoring the policies returned green.
- Mutation 2: restoring the null-only game-distance comparison produced
  640 / 642 and killed the Barbell automatic and warm-up absent-distance cells;
  restoring nullish no-game semantics returned green.

The first attempted direct test command used `npx`, which tried the network and
failed with `ENOTFOUND`. No dependency or file changed; the local
`node -r sucrase/register` runner then executed the same test successfully.

NOT COVERED at this checkpoint: the physical phone; the 32 conditioning-label
occurrences; reconciliation of the 29 old `incorrectly_tagged_or_classified`
entries; and the fresh two-athlete, 52-week final audit. No whole-job completion
is claimed.

## 2026-08-31 follow-up 4 — all 32 duration labels repaired

The initial shared-file block was cleared without overwriting anyone: the live
conditioning-copy owner checkpointed `8a313ec7`, then source inspection proved
those card-copy files were an upstream input, not the defective owner. The
broken `doseLabel` belongs to `conditioningVisibleIdentity.ts`, which was free.

The defect was a unit substitution. Authored conditioning rows require numeric
sets/reps fields in the generic Workout schema. They are placeholders, and
deload/injury transforms may change them legitimately. The visible-identity
projector nevertheless multiplied those transformed placeholders by an
authored duration, producing `41 × 50 min`, `16 × 20 min` and siblings.

Compared two designs:

1. Cap or hide a dose label when its implied minutes exceed 120. Rejected: that
   suppresses evidence while leaving the projector's source wrong.
2. For an authored conditioning row, derive structure from the same concrete
   55-template athlete prescription the card renders; retain numeric-row/text
   fallback only for legacy and user-authored rows. Chosen because selection,
   stored execution and transforms remain untouched while visible dose has one
   authored source.

Direct red-first witnesses now resolve as follows:

- transformed `Continuous Aerobic Run` (`41` placeholder sets, `50` placeholder
  minutes) → `40 min steady`;
- transformed `Controlled 10–20 min Blocks` (`16`, `20`) → `2 × 15 min`.

The complete two-athlete, 52-week diagnostic rerun has **0 implausible
conditioning dose labels**, down from 32. Its only emitted time-dose labels and
occurrence counts are: `4 × 6 min` 26, `5 × 5 min` 24, `2 × 15 min` 20,
`5 × 1 min` 14, `10 × 1 min` 12, `7 × 2 min` 10, `4 × 2 min` 10,
`6 × 3 min` 6 and `6 × 1 min` 6. Count unit is visible identity occurrences
across two athletes × 52 weeks, not sets performed or distinct templates.

Regression and liveness receipts:

- the two focused cells pass in `test:conditioning-identity`;
- the full-year audit's `implausibleConditioningDoses` array is empty;
- mutation: bypassing authored-template structure reproduced exactly
  `41 × 50 min` and `16 × 20 min` and killed both focused cells; restoration
  returned them green;
- the wider identity suite is 65 / 8: its eight existing failures are the
  legacy four-week generation fixture failing to find its expected workouts,
  while all visible-identity, persistence, modality and new duration cells pass.

NOT COVERED at this checkpoint: the final isolated catalogue-order mutation,
release chain and male/female report; physical-iPhone acceptance. No whole-job
completion is claimed.

## 2026-08-31 follow-up 5 — the 29 classification entries reconciled

The old audit did not preserve catalogue identity. Its year exporter formatted
`row.exercise.name` into athlete-facing copy and the audit then compared that
copy directly with catalogue keys; it also omitted the visible mobility/prehab
flow. Separately, it counted a winner from any compiler attempt as though that
winner had reached accepted final rows. Those are instrument-unit defects, not
29 exercise-tag defects.

The exporter now carries `catalogueIdentity` beside display `name` on every
session, Speed and mobility-preparation row. The audit refuses rows missing the
raw identity, counts visible presentation under display copy, counts catalogue
reachability under canonical raw identity, and correlates an attempt-selected
trace with accepted final rows on the same athlete-date before calling it a
final selection.

A diagnostic two-athlete, 52-week rerun (104 athlete-weeks and 104 restart
checks) reconciled the old 29 exactly. Twenty-five have real final placements:

- `SL 45° Back Extension Hold` 99; `SL 45° Back Extension` 40;
  `Single-Leg Squat (to Box)` 14; `Banded TKE` 17;
  `Copenhagen Plank (Half)` 34; `Swiss Ball Hamstring Curl` 121.
- `Single-Arm DB Floor Press` 24; `Single-Arm DB Bench Press` 29;
  `Half-Kneeling Single-Arm Overhead Press` 24;
  `Single-Arm Lat Pulldown` 40; `Explosive Push-up` 61;
  `Woodchop (Half Kneeling)` 32; `Stir the Pot` 23;
  `McGill Sit Up` 34; `Banded External Rotation` 141;
  `Bicep Curl (Barbell)` 19; `Bicep Curl (Dumbbell)` 17;
  `Banded Tricep Pushdown` 21.
- `30 s Very Hard Repeats` 8; `400 m Repeats` 4;
  `Controlled 10–20 min Blocks` 20; `Steady 5 min Blocks` 24;
  `Extensive Tempo (100 m repeats)` 6; `2 min On / 1 min Easy` 10;
  `1 min On / 1 min Easy Tempo` 12.

Count unit above: visible raw-catalogue row placements across mobility
preparation, session template and Speed components; denominator is the two
audited athletes × 52 weeks. These are not sets or selector calls.

The other four had zero accepted final placements and are now named truthfully
as `selected_only_in_nonfinal_compilation`, not as tagging errors:

- `Lateral Bounds`: 8 power-selector attempt wins, 0 accepted-final matches;
  finalisation produced lower sessions without that power row.
- `Suitcase Carry`: 3 strength-selector attempt wins, 0 accepted-final matches;
  the accepted dates contained different final session composition.
- `Two-Minute Repeats`: 4 conditioning-selector attempt wins, 0 accepted-final
  matches; accepted dates held `30 s Very Hard Repeats` or no session.
- `1 km Repeats`: 2 conditioning-selector attempt wins, 0 accepted-final
  matches; accepted dates held `45 s Hard Repeats`.

No exercise identity or tag was changed to make the report pass. The corrected
diagnostic audit has **0 `incorrectly_tagged_or_classified` rows**. Its four
non-final rows carry every athlete/date/decision owner and the accepted final
identities in JSON, so the explanation is evidence rather than a relabel.

Regression and liveness receipts:

- `test:programming-selection-trace`: 10 / 10, including all 29 former rows,
  display/identity independence and a hard refusal when raw identity is lost.
- `test:catalogue-reachability-classification`: 6 / 6, including attempt-only
  selection as distinct from accepted-final selection.
- The generated year contained 5,461 inspected warm-up/session rows and zero
  missing `catalogueIdentity` values.
- Mutation 1: falling back to display `name` when raw identity is absent killed
  the hard-refusal cell.
- Mutation 2: removing the attempt-only branch misclassified it as out-ranked
  and killed the named classifier cell.
- Product and devtools TypeScript remain at 0; the compile gate retains the
  same four inherited test-scope errors in three unrelated test files.

This was a diagnostic rerun, not the final audit: the catalogue-order receipt
was a previously green zero-difference placeholder and follow-up 4's live
conditioning files were still dirty. The final isolated run remains pending.

NOT COVERED at this checkpoint: follow-up 4's 32 duration occurrences; a fresh
catalogue-order mutation on the final saved revision; physical-iPhone
acceptance; and the final isolated male/female audit. No whole-job completion
is claimed.

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

## Step 5 audit correction — prehab dose/load route

The first Step 9 rerun proved the original Bottoms-Up diagnosis was only half
closed. The identity no longer entered an ordinary strength candidate set, but
when the legitimate `shoulder_prehab` route selected it, the composer still
discarded the shoulder-health pool's authored 2 × 6–8 dose in favour of the
generic 2 × 15 accessory band. At block boundaries the same row was then read
as an ordinary progressable strength accessory: the corrected year showed 8 kg
on its first occurrence and 36 kg for 2 × 15 by the final block.

Compared two repairs:

1. Cap `Bottoms-Up KB Press` by name. Rejected again: a spelling-specific cap
   leaves every later shoulder-prehab identity exposed to the same route leak.
2. Let the typed `shoulder_prehab` selection slot retain the dose authored by
   its own pool, and make block progression hold exact recorded load on that
   route instead of applying the main/secondary lift increment policy. Chosen.

Red-first evidence: the new final-composition cells initially received 2 × 15
instead of 2 × 6–8 and a qualifying 8 kg history produced
`history_progressed`. They now pass with the authored dose and
`history_held: 8 → 8`.

The corrected year then found a second progression owner: weekly strength
progression looked only at the movement name, classified the typed
`shoulder_prehab` row as a secondary vertical press, and changed an 8 kg test
row to 7.5 kg. A third red-first cell reproduced that exact route (`8 → 7.5`).
The shared row predicate now requires both an eligible exercise identity and an
eligible compiler route; typed shoulder prehab is excluded from weekly overload
without naming or capping an exercise.

That real leak was not the audit's remaining 20 kg value. A female-only 18-week
journey kept every Bottoms-Up occurrence and logged performance at 8 kg. The
value became 20 kg only when the male athlete ran first in the same process:
`resetStoresToFreshInstall` cleared program feedback and weight overrides but
not `workoutLogStore.loggedSets`, whose stable row ids let the second synthetic
athlete inherit the first one's performed sets. The total fresh-install owner
now calls the workout-log store's own `clear()` door. Its red-first cell was
`loggedSets.size 1 !== 0`; it is now zero after reset.

Verification:

- `test:programming-final-composition`: 6 / 6.
- `test:block-two-progression`: 41 / 41.
- `test:pools`: the same 478 / 4 baseline as clean checkpoint `959a9b87`; its
  four stale caution/pin expectations are unrelated to dose or progression.
- `test:compile`: product 0 and devtools 0; the same four inherited test-scope
  errors remain.

NOT COVERED at this correction: Step 5's Primer-length decision and the
injury-adjusted part-name decision discovered by the final audit. The latter
currently says `Lower Squat` after a 6/10 calf/Achilles injury correctly pauses
all lower patterns and replaces them with upper/core work; Sam must choose
whether that part should use its actual `Upper Pull` identity or a generic
injury-adjusted identity. The full corrected audit is rerun in Step 9; no phone
was touched.

## Step 9 — corrected male/female lived-year audit

Completed against exact compiler checkpoint
`672d4c197ea5e45f41ed47d472ec0335ef639f71` in an isolated worktree. The
preserved real-onboarding driver SHA-256 remained
`bb1dd5729aa32e179c0c0d57ebc1d034f0bbb1ee152d628684be347f6fb13bd4`.
The run contains two 52-week athlete-years, 728 athlete-days, 3,905 displayed
row placements and 3,348 distinct athlete/compiler decision ids. All 104
restart checks completed without a mismatch.

Final evidence:

- 150 exercise display names and 16 conditioning display names appeared.
- 99 / 215 catalogue identities received zero displayed placements. Every one
  has an exhaustive classified row in the report: 26 eligible but outranked,
  29 selected/name-classification disagreements, 24 intentional manual or
  special-use identities, 2 missing automatic routes, and 18 ineligible for
  the two audited athletes.
- Reversing every automatic strength, power and conditioning catalogue changed
  0 / 728 final athlete-days.
- No projection errors, restart failures, missing conditioning modalities,
  silent Team-Training gym rows, or duplicate weekly quality-owner sentences.
- The shoulder-injury window contains 0 triceps-named rows / 114 trainable rows.
- Bottoms-Up KB Press tops out at 8 kg for 2 × 6. The initially reported 20 kg
  was proved to be a two-athlete audit-harness contamination and disappeared
  after the fresh-install owner began clearing logged sets.
- Two `Lower Squat` identities remain on one injury-adjusted date (male and
  female). Every lower pattern was correctly paused for a 6/10 calf/Achilles
  constraint and coherent upper/core work was supplied; only the visible part
  identity requires Sam's product-language decision.
- 24 Primers each contain seven checked rows plus three optional rows. No signed
  row was deleted; the length remains the previously recorded product decision.
- 32 conditioning identity dose labels imply over 120 minutes (`41 × 50 min`,
  `16 × 20 min`, and siblings). Their underlying row prescriptions are bounded;
  this is a projection/display-owner defect in files being edited by another
  active seat, not a programming-selection result.

Release evidence at the same checkpoint:

- `npm run test:programming-selection-release`: exit 0. It includes the 0 / 728
  finished-year order mutation, trace 7 / 7, reachability classification 5 / 5,
  power pool 94 / 94, modality persistence 3 / 3, deload owner 11 / 11,
  block-two progression 41 / 41, final composition 6 / 6, and generated-week
  assembly 30 / 30.
- `npm run test:compile`: product 0, devtools 0; the same four inherited test
  scope errors remain in `canonicalWeeklyCompilerSliceTests.ts`,
  `fatiguePlumbingTests.ts` (2), and `fixtureMutationTransactionTests.ts`.

Durable receipts:

- `docs/PROGRAMMING_SELECTION_FINAL_AUDIT_2026-08-31.md`
- `docs/PROGRAMMING_SELECTION_FINAL_AUDIT_2026-08-31.json`

BLOCKED product decisions for Sam:

1. Primer length: keep the seven checked rows and omit all three optional rows
   everywhere, or omit the optional rows only from automatic female G-1 while
   retaining them in the athlete-added full Primer?
2. Injury-adjusted part identity: when every lower pattern is paused and the
   replacement is upper/core work, should the part use its actual `Upper Pull`
   identity or a generic injury-adjusted identity?

NOT COVERED: physical-iPhone execution or acceptance, native onboarding taps,
athlete profiles outside the preserved male/female inputs, clinical validation
of injury programming, the two Sam decisions above, and the separately owned
conditioning dose-label projection fix. The phone was not installed, wiped or
otherwise touched.

## Follow-up step 2 — honest injury-adjusted identity and calf/Achilles conditioning

Completed at the exact audited male 2027-03-01 coordinate.

The old output was not physically running: it paired the authored title
`Continuous Aerobic Run` with typed delivery `Bike`. That was safe off-leg
delivery under a dishonest identity, so retaining it or merely teaching the
audit to ignore the title was rejected. Two implementation options were
compared:

1. Patch the composed injured workout after selection, rebuilding one row and
   its block locally.
2. Make the shared selector refuse a run-named template whenever the scheduler
   explicitly requests off-feet work, then let the existing authored-template
   and feasibility owners select or remove it. Chosen because it prevents the
   whole class and authors no new dose.

The same naming comparison rejected deriving `Upper Pull` from the replacement
rows. The existing typed strength-intent ledger now names a session
`Injury-Adjusted Session` only when an injury adjustment exists, planned
patterns are nonempty and effective original patterns are empty. Partial injury
adjustments keep their surviving original-pattern identity. The canonical
injury compiler writes that result to the workout and the signed visible
projection reads the same owner.

Red-first and liveness evidence:

- `test:session-naming` returned `Lower Squat` for the fully replaced typed
  lower-squat witness. That cell now returns `Injury-Adjusted Session`; the
  partial squat+hinge control still returns `Lower Hinge`.
- `test:conditioning-templates` selected `Continuous Aerobic Run` in the
  20-position explicit off-feet sweep. It now reaches all four honestly named
  aerobic machine templates and zero run-named templates (157 / 157).
- Disabling the injury predicate killed the exact naming cell. Removing the
  off-feet identity filter killed P14 and printed `Continuous Aerobic Run` in
  the selected set. Both mutations were restored.

Exact lived-year receipt, 23 weeks from real onboarding through the high 6/10
calf/Achilles constraint:

- Before: strength part `Lower Squat`; conditioning row
  `Continuous Aerobic Run`, modality `Bike`, dose label `41 × 50 min`.
- After: workout and strength part `Injury-Adjusted Session`; conditioning row
  `Steady Blocks`, modality `Bike`, dose label `3 × 8 min`.
- The modifier still says `Limits: limit running`; no running identity remains.

Verification:

- `test:conditioning-templates`: 157 / 157.
- `test:session-naming`: both new cells pass; the suite retains its pre-existing
  S6 plan-label mismatch and severed legacy-builder stop.
- `test:compile`: product 0, devtools 0; the same four inherited test-scope
  errors remain in three files.

NOT COVERED: the complete male/female 52-week rerun (step 6), physical-iPhone
Release acceptance, clinical validation, every possible injury/kit combination,
and the other 31 broken conditioning-duration occurrences. The exact corrected
case is evidence for step 2 only; step 4 still owns the duration class.

## 2026-08-31 follow-up 6 — final isolated audit and exact remainder

Completed against exact implementation checkpoint
`b4f53a55332fb26bf96cd6a137bd79205d0b962f`. The preserved driver generated
two real-onboarding athlete journeys, one male and one female, for 52 weeks / 364
athlete-days each. The denominator is 728 final athlete-days, 104 athlete-weeks
and 5,493 visible row placements. All 104 weekly restart checks completed
without mismatch.

Sam's requested coordinates are closed in the final evidence:

- 24 Primers have zero optional rows and zero Acceleration, Trap Bar Deadlift,
  High Box Squat or Bench Press rows.
- On 2027-03-01 both athletes have workout and strength-part identity
  `Injury-Adjusted Session`, with `Steady Aerobic Blocks`, raw identity
  `Steady Blocks (3×8 min or 4×6 min)`, modality Bike and dose `4 × 6 min`.
  The high calf/Achilles modifier still says running is limited; no run-named
  row remains.
- `Seated Good Morning (Barbell)` has 77 visible final placements and
  `Seated Good Morning` has 74. Neither remains in a missing-route class.
- Conditioning labels implying more than 120 minutes: 0, down from 32.
- `incorrectly_tagged_or_classified`: 0, down from 29. Twenty-five old entries
  have actual final raw-identity placements. Four are proved attempt-only:
  Lateral Bounds 8 attempt wins / 0 accepted-final, Suitcase Carry 3 / 0,
  Two-Minute Repeats 4 / 0 and 1 km Repeats 2 / 0.

The exact remaining zero-placement catalogue result is 71 / 215 identities:
25 eligible but out-ranked, 24 intentionally manual/special-use, 18 ineligible
for these two athletes, and the four named attempt-only identities. Zero
placement is not used as a programming objective and none is called a tag
defect merely for not appearing.

Final named-surface verification:

- `test:programming-selection-release`: exit 0. It includes the fresh 0 / 728
  catalogue-order mutation, trace 10 / 10, reachability 6 / 6, power pool
  94 / 94, modality persistence 3 / 3, weekly deload owner 11 / 11, block-two
  progression 41 / 41, final composition 6 / 6 and generated-week assembly
  30 / 30.
- `test:compile`: product 0, devtools 0. The same inherited test-harness scope
  remains red with four errors in three unrelated test files.
- `test:law-registry`: 224 total rows, 203 guarded and 21 inherited
  `UNENFORCED`; the new follow-up rulings are guarded. The existing registry
  debt remains honestly red.

Durable final report:

- `docs/PROGRAMMING_SELECTION_FOLLOWUP_FINAL_AUDIT_2026-08-31.md`
- Full dated local JSON:
  `output/programming-selection-followup-final/report/programming-selection-final-audit.json`

BLOCKED-BY: sam — physical-iPhone acceptance only. Exact question for Sam:
after a clean Release build is installed, can you confirm on the phone that an
added Primer contains only the seven short/low-fatigue rows, a fully replaced
injury day is visibly named `Injury-Adjusted Session`, and the off-feet
conditioning card shows a sensible Bike duration? No build was installed or
phone state changed by this seat.

NOT COVERED: physical-iPhone execution/acceptance, native onboarding taps,
athlete profiles beyond the preserved male/female inputs, clinical validation
of injury programming, and a whole-app PASS. Every requested implementation and
audit step is complete; athlete-facing DONE remains blocked only on Sam's L10
device acceptance.

## 2026-08-31 — latest Release rebuilt and installed on Sam's phone

Sam explicitly requested the latest build on his phone. Device discovery found
two paired devices and targeted only the available iPhone 16 Pro Max owned by
Sam (`AFA21856-881E-587B-96D5-60817FD11018`). Renee's iPhone was unavailable
and was not targeted.

- Product checkpoint: `bf97b1790e51cae2f321f9cee9ce6237422749df`.
  Product source (`src`, `ios`, `package.json`, `app.json`) was clean before and
  after the build; unrelated shared docs/untracked files were untouched.
- Fresh `xcodebuild clean build`, Release/iphoneos, with isolated DerivedData:
  exit 0 and `BUILD SUCCEEDED`.
- Artifact:
  `/private/tmp/lfa-phone-bf97b179.IrTKQl/DerivedData/Build/Products/Release-iphoneos/LocalFootyAthlete.app`.
- Bundle: `com.localfootyathlete.app`, version `1.0.0 (1)`. Embedded standalone
  `main.jsbundle`: 8,396,475 bytes, SHA-256
  `15b06c87977a2d08b4841d7a65dc869427cc68c9ac91ab4f96d50780117d77eb`.
- Executable SHA-256:
  `73e64e798fde57535fe999b104723f305a4a8367e1792aefc7cb1d84a2feb61d`.
- Strict/deep code-sign verification passed. The bundle is signed by Apple
  Development: Samuel Geurts for team `66M7FZ6G37`.
- `devicectl device install app` returned success and installed bundle container
  `6D1165A9-9B6C-4B8C-9F0D-789A11674A25` as an in-place upgrade. No uninstall,
  reset, app-data clearing or data-container operation was performed.
- Launch returned success with PID 36315. A later device process snapshot still
  contained the exact installed `LocalFootyAthlete` executable, so it did not
  crash immediately on boot. The installed-app query reports version 1.0.0,
  bundle version 1.

BLOCKED-BY: sam — glass acceptance. Exact question: can you confirm that your
existing profile/week is intact, then check an added Primer contains only seven
short/low-fatigue rows and that the affected injury day reads
`Injury-Adjusted Session` with sensible off-feet conditioning?

NOT COVERED: Sam's visual/tap acceptance, native onboarding, clinical
validation, Dynamic Type/VoiceOver, or any whole-app device sweep. Build,
in-place installation, installed-version query and launch were covered.

## 2026-08-31 — `ATG Split Squat` display copy

Sam corrected the athlete-facing casing from `Atg Split Squat` to
`ATG Split Squat`. The catalogue, cue and video sources already carried the
approved canonical identity; only the shared display formatter was changing
the acronym into an ordinary title-cased word.

Two fixes were compared:

1. Add a one-name alias for `ATG Split Squat`. This would correct the current
   row but leave the formatter ignorant of the acronym on any other surface.
2. Add `ATG` to the shared formatter's known exercise-term owner. Chosen
   because every existing screen and projection route already uses that owner,
   and canonical matching remains untouched.

Red-first evidence: the new exact `test:exercise-display` cell returned
`Atg Split Squat` and the suite reported 29 / 1. After the acronym owner was
corrected it reports 30 / 30. Removing that one mapping recreates the original
named failure, so the cell is live.

R-291 is recorded in `docs/RULINGS_REGISTRY.md` and registry row
`LAW-atg-exercise-display-acronym` names the chained guard. The law-registry
gate accepts the new row and reports 225 total / 204 guarded; it remains red on
the same 21 inherited `UNENFORCED` laws. `test:compile` reports product 0 and
devtools 0, retaining the same four inherited test-harness errors in three
unrelated files.

NOT COVERED at this checkpoint: the new physical-iPhone Release, visual glass
acceptance, Dynamic Type/VoiceOver, and unrelated display-copy acronyms. The
canonical programming identity, selection, cues and videos were not changed.

### Physical Release receipt for R-291

- Product checkpoint: `99af5ff8ce1e3b63318431748df98ebe7c5c5144`.
- Fresh isolated `xcodebuild clean build`, Release/iphoneos: exit 0 and
  `BUILD SUCCEEDED`.
- Artifact:
  `/private/tmp/lfa-phone-atg-99af5ff8.oVii8Z/DerivedData/Build/Products/Release-iphoneos/LocalFootyAthlete.app`.
- Bundle: `com.localfootyathlete.app`, version `1.0.0 (1)`. Standalone
  `main.jsbundle`: 8,396,427 bytes, SHA-256
  `12ea5ee4a8b2a088108db3df677a086f0c2fe2ae2fb866560fece57ae256fe18`.
- Executable SHA-256:
  `b9967b56984d001681b406e2507076ec3a9e160cf74b808d14b237b6066dbbe1`.
- Strict/deep signature verification passed under Apple Development: Samuel
  Geurts, team `66M7FZ6G37`.
- Fresh device discovery selected only Sam's available paired iPhone 16 Pro Max
  (`AFA21856-881E-587B-96D5-60817FD11018`); Renee's phone was unavailable and
  not targeted.
- In-place installation succeeded into bundle container
  `03BC38B2-D88A-46A7-BCAF-69775B7569B1`. No uninstall, reset, app-data clearing
  or data-container operation occurred.
- Launch succeeded. The later process snapshot still contained the exact newly
  installed executable as PID 36436, and the device reports version 1.0.0,
  bundle version 1.

BLOCKED-BY: sam — glass acceptance only. Exact question: does the exercise now
read `ATG Split Squat` on your phone?

NOT COVERED: visual acceptance of the corrected letters, Dynamic Type,
VoiceOver and unrelated exercise-name copy. Build, signature, in-place install,
version query and launch were covered.

## 2026-08-31 — warm-up repeated an exercise from the main session

Sam opened a generated session whose warm-up contained `Crab Walks` and whose
main strength work contained the same exercise. This was a real selection defect,
not a copy-only defect. The derived Mobility/Warm-up selector filled its own menu
without excluding canonical exercise identities already prescribed in the visible
session.

The completed two-athlete full-year instrument (2 athletes x 52 weeks, 728
athlete-days) contained 53 affected athlete-days and 53 duplicate occurrences,
covering 10 distinct canonical identities: `Banded External Rotation`,
`Bottoms-Up KB Press`, `Cossack Squat`, `Crab Walks`, `Lateral Lunge`,
`SL 45° Back Extension Hold`, `Scap Pull Ups`, `Scap Push-Up`,
`Slant Board Step-Down`, and `Swiss Ball Hamstring Curl`. The exact male and
female 2026-09-30 witness contained `Crab Walks` in both sections.

Two fixes were compared:

1. Hide a duplicate while rendering the warm-up. Rejected because it silently
   shrinks the menu and leaves the selector and its trace claiming the duplicate.
2. Make session identities an input to the selector and take the next legal
   same-slot candidate. Chosen because the selection owner now enforces the rule
   and every consumer receives an honest, complete menu.

The selector now compares canonical identities across all visible session-row
buckets before filling a warm-up slot. It also preserves R-213's completed-row
retention except at the precise collision boundary: if an athlete completed a
warm-up row and that identity later becomes load-bearing session work, it yields
instead of being restored as a duplicate.

Red-first evidence named three failures: the exact `Crab Walks` witness, the
224-composition collision matrix (4 session shapes x 56 dates), and the performed
warm-up collision. All three are green after the selection fix. The focused
mobility-flow suite reports 75 passing cells and 3 inherited UI source-shape
failures that were already red before this change. Quick exercise actions report
62 / 62; programming-selection trace 10 / 10; and the complete
`test:programming-selection-release` chain exits 0.

A fresh real-onboarding two-athlete 52-week generation now reports 0 affected
athlete-days, 0 duplicate occurrences, and 0 distinct duplicate identities.
Its year-program JSON SHA-256 is
`1b34317da8c24fe8da3c287c5ed5f166b4e2504757404ada9a6ca443fe5188f5`.
R-292 and registry row `LAW-warmup-never-repeats-session-exercise` bind the rule
to `test:mobility-flow` in `test:bible`.

Compile reports product 0 and devtools 0, with the same four inherited test-only
errors in three unrelated harness files. The law-registry gate accepts R-292 and
reports 226 total / 205 guarded, remaining red only on the inherited 21
`UNENFORCED` rows.

NOT COVERED at this checkpoint: physical-iPhone installation and visual
acceptance, athlete profiles beyond the preserved male/female year inputs,
performed-collision execution on glass, Dynamic Type/VoiceOver, and a whole-app
PASS. The programming defect and its full-year class are covered; L10 acceptance
still requires Sam's phone.

### Physical Release receipt for R-292

- Product checkpoint: `608706211bbba8caf38ebcc9662ff1d73ddb07f7`.
- Fresh isolated `xcodebuild clean build`, Release/iphoneos: exit 0 and
  `BUILD SUCCEEDED`. Product source was clean before and after the build;
  unrelated shared docs and untracked files were untouched.
- Artifact:
  `/private/tmp/lfa-phone-warmup-60870621.FheNVJ/DerivedData/Build/Products/Release-iphoneos/LocalFootyAthlete.app`.
- Bundle: `com.localfootyathlete.app`, version `1.0.0 (1)`. Standalone
  `main.jsbundle`: 8,397,308 bytes, SHA-256
  `cfac0971a95742309adc3e6f9165726d52a28f78f3b0e876863da92724a0540d`.
- Executable SHA-256:
  `f23301304fc95876db5f3caa5c84ff2d1a6014426049b924a7041807800065b9`.
- Strict/deep signature verification passed under Apple Development: Samuel
  Geurts, team `66M7FZ6G37`.
- Fresh device discovery selected only Sam's available paired iPhone 16 Pro Max
  (`AFA21856-881E-587B-96D5-60817FD11018`); Renee's phone was unavailable and
  was not targeted.
- In-place installation succeeded into bundle container
  `F291E496-0341-456F-9CBD-5E87C5A49822`. No uninstall, reset, app-data clearing,
  or data-container operation occurred.
- Two parallel post-install queries briefly collided while CoreDevice was
  reconnecting. No reinstall followed. Sequential discovery, launch and version
  queries then succeeded; the device reports version 1.0.0, bundle version 1,
  and the later process snapshot contains the exact installed executable as PID
  36527.

BLOCKED-BY: sam — glass acceptance only. Exact question: when you reopen the
same session, does `Crab Walks` now appear in only one section, with the warm-up
slot replaced by a different legal movement?

NOT COVERED: Sam's visual/tap acceptance of that exact session, a performed-row
collision on device, Dynamic Type/VoiceOver, and a whole-app device sweep.
Build, signature, in-place install, installed-version query and persistent launch
were covered.

## 2026-08-31 — conditioning intensity units follow typed modality

Sam reported a Bike `30:30 Controlled Tempo Blocks` card whose selected mode
was correctly Bike while its intensity still read `65–80% MAS`. The stored row
copy was generic, but the shared read-time modality projection changed only
movement/recovery words and left the running intensity unit behind.

The red-first instrument counted 46 distinct non-running
template-by-permitted-modality projections containing MAS, across the complete
55-template catalogue and its typed permitted modes. Its denominator was all
55 authored templates; its counted unit was one template plus one permitted
non-running modality, not one athlete session. The exact Bike, RowErg, SkiErg
and mixed-ergo tempo cards all reproduced `Intensity: 65–80% MAS`.

Two designs were compared:

1. Rewrite stored row notes when a machine is selected. Rejected because swaps,
   injury substitutions and restart could leave stale derived copy, and every
   writer would have to repeat the rule.
2. Keep the generic prescription and derive the visible intensity unit at the
   shared read boundary from the selected typed modality. Chosen because every
   current conditioning card already crosses that boundary and modality remains
   one typed fact.

The shared display owner now retains `Intensity` for Running and emits
`Effort: X/10` for Bike, Air Bike, RowErg, SkiErg and mixed work. The effort
number is derived only from the template's intended-intensity field—not its
name, description, cue or catalogue position. The mapping does not collapse:
`Short Flush` is 3/10, `30:30 Controlled Tempo Blocks` is 6/10, `Classic 4×4`
is 8/10 and `Air Bike Accelerations` is 10/10. Work, recovery, rounds, cues,
dose, selection and placement are unchanged.

Athlete-added conditioning exposed a second source defect: its eight template
definitions had no typed modality. Those definitions now explicitly declare
Bike, RowErg, SkiErg or mixed plus their authored intensity intent. No mode is
inferred from the label or prose. The actual standalone Add and attached Add
journeys now render typed effort wording and retain their existing content and
restart behaviour.

Regression and liveness receipts:

- Red first: `test:conditioning-intensity-modality` reported 7 passed / 10
  failed and named all 46 non-running MAS projections.
- Final `test:conditioning-intensity-modality`: 19 / 19 across all 55 authored
  templates, every permitted modality, all eight athlete-addable conditioning
  templates, exact Bike/RowErg/SkiErg/mixed cards, running MAS and pace, JSON
  reconstruction, reversed catalogue order and the one shared display path.
- Mutation: bypassing the typed-modality branch recreates
  `Intensity: 65–80% MAS` on Bike while the production branch remains
  `Effort: 6/10`; the named liveness cell passes.
- `test:conditioning-intensity-routes`: 3,298 / 3,298. It covers the complete
  template-by-machine display matrix, real generated sessions and real modality
  swaps while preserving every non-intensity prescription number.
- `test:conditioning-modality-persistence`: 7 / 7 after its chained 19-cell and
  3,298-cell guards. Real generation, injury adjustment, process restart and
  running reconstruction preserve the exact typed mode and wording.
- `test:conditioning-copy-census`: 35 / 35.
- Direct `sessionSectionAddTests.ts`: the new standalone and attached
  conditioning checks pass; the suite reports 272 / 274 only because its two
  old `primer/optional` expectations still ask for the three Primer extras Sam
  removed under R-288.
- `test:session-template`: 87 / 88; the conditioning-card hierarchy checks pass
  and the inherited source-shape check for the numeric row index remains red.
- `test:programming-selection-release` exited 0, including the two-athlete
  catalogue-order year (0 changed of 728 athlete-days), the new release-blocking
  intensity/persistence gates and the remaining selection chain.
- `test:compile`: product 0 errors and devtools 0 errors; the command remains red
  on four inherited test-harness errors in `canonicalWeeklyCompilerSliceTests`,
  `fatiguePlumbingTests` and `fixtureMutationTransactionTests`.
- `test:law-registry`: the R-293 row is well formed, names an existing chained
  guard and resolves its ruling. The gate remains red only on the inherited 21
  `UNENFORCED` rows: 227 total / 206 guarded.

R-293 and `LAW-conditioning-intensity-unit-follows-typed-modality` bind this
rule to the chained `test:conditioning-identity` gate; the programming release
chain also runs the full route and persistence guard. This work is saved as one
path-scoped checkpoint stamped `Agent: selectionrepair`.

NOT COVERED at this checkpoint: native layout/glass, Dynamic Type, VoiceOver,
historic conditioning records that genuinely predate typed modality metadata,
athlete profiles outside the two release profiles, and a whole-app PASS. Per
Sam's instruction, neither physical phone was discovered, built for, installed
to, launched or otherwise touched.

## 2026-08-31 — Movement Prep label and flame identity (R-294)

Changed only the derived warm-up identity: it now projects as `Movement Prep`
with the flame icon on the Day and active Session surfaces. A typed standalone
or athlete-added Mobility section still projects as `Mobility` with the existing
mobility-person icon. The split is owned by the typed `composedOptionalKind` at
the execution-plan boundary; no name or description inference was added.

Two options were compared before coding: rename and replace the icon separately
inside each screen, or make the contextual identity a projection owned where the
typed composed kind is still available. The shared projection landed because it
keeps Day, Session, Add and feedback vocabulary aligned while preserving the
separate standalone Mobility identity without screen-level title guessing.

Regression and liveness receipts:

- Red first: `test:session-execution` named both defects—the embedded flow was
  still `Mobility / Warm-up` + person, and standalone Mobility inherited that
  same shared label.
- Final target cells pass for a real derived flow and a typed standalone
  Mobility workout. The same suite binds the Day row to `flame`, the embedded
  section map to `flame`, and the composed Mobility map to `mobility`.
- `test:movement-prep-identity`: 10 / 10.
- Direct `dayFirstTimelineTests.ts`: 56 / 56.
- Direct `exerciseIntakeTests.ts`: 642 / 642; the Add hierarchy consumes the
  renamed shared section label.
- `test:approved-icons`: 26 / 26.
- `test:signed-copy-extraction`: 7 / 7.
- `test:compile`: product 0 errors and devtools 0 errors; the gate remains red
  on four inherited test-harness errors in `canonicalWeeklyCompilerSliceTests`,
  `fatiguePlumbingTests` and `fixtureMutationTransactionTests`.
- The governing `test:session-execution` command remains red only on two
  inherited shared-checkout source-shape cells: `[10] exercise names are
  upright in every shared session row` and `[10] choice and phase cards use the
  one trailing completion owner — never the title header`. They failed before
  this edit and neither owning product file was changed here.
- The remaining composite constituents are also inherited red: `test:mobility-flow`
  has three stale source-shape assertions around the concurrent `SessionList`
  mobility-content refactor; `test:results-persist` has five fixture refusals
  because its diagnostic world lacks an accepted profile/program.
- `test:copy-rulings-binding` remains red on one unrelated missing signed string
  and seven old proposed strings; the new `Movement Prep` copy introduces no
  missing-copy failure.
- `test:law-registry`: the R-294 row is well formed, names an existing chained
  guard and resolves its ruling. The gate remains red only on the inherited 21
  `UNENFORCED` rows: 228 total / 207 guarded.
- `test:ruling-registry` and `test:repo-law-guards` retain their documented
  shared-checkout debts; neither reports a malformed R-294 row or missing guard.

R-294 and `LAW-movement-prep-and-mobility-have-distinct-identities` bind the
rule to the chained `test:session-execution-checklist` gate.

NOT COVERED at this checkpoint: native pixels, physical-phone acceptance,
Dynamic Type, VoiceOver pronunciation, and a whole-app PASS. Neither physical
phone was built for, installed to, launched or otherwise touched.

## 2026-08-31 — false “equipment today” on automatic RDL de-dup (R-295)

Root cause confirmed. In a healthy full-kit world, the block selected
`Single-Leg RDL`, then R-233 correctly replaced it with `Hamstring Curl` because
the same session already contained another RDL-family lift. That is ordinary
programming de-duplication. The cause classifier checked only whether the exact
`Single-Leg RDL` identity was already present and otherwise defaulted the reason
to `kit_today`, producing the false explainer Sam saw despite zero equipment
limitations.

Two options were compared before coding: make the screen join every replacement
against today's live equipment facts before showing a badge, or correct the
typed cause where the substitution is authored and let the shared badge owner
hide automatic causes. The source correction landed because it prevents false
equipment provenance from reaching reviews, saved rows or any future surface;
the renderer still shows real equipment, injury and athlete-exclusion causes.

The composer now classifies exact and RDL-family collisions as
`already_on_day`, proves `kit_today` by checking the base exercise against the
actual day kit, and throws if any automatic substitution has no attributable
cause. `already_on_day` remains available as internal provenance but produces no
athlete-facing `Swapped from` line.

For an already-materialised row carrying the old false `kit_today` cause, the
shared display owner now rechecks the base exercise against today's typed kit.
If it is legal, the stale line is suppressed immediately; genuine equipment
substitutions remain visible.

Regression and liveness receipts:

- Red first: the new real-generation cell reached `Single-Leg RDL -> Hamstring
  Curl` in a healthy full-kit Off-season world and reported its cause as
  `kit_today`.
- After the correction, that same cell reports `already_on_day` and the shared
  badge owner returns no explainer.
- `test:session-injury-review`: 80 / 80, including automatic de-duplication,
  stale persisted equipment provenance, and existing real
  injury/equipment/exclusion copy.
- `test:equipment-scopes`: 20 / 20; actual dated equipment substitutions,
  clearing and restart remain intact.
- `test:rdl-family`: the new founding-case cell passes. The suite remains 6 / 8
  because of two inherited generation expectations: Pre-season 4-day is now
  refused at `hard_day_permitted_maximum:6`, and the old In-season 3-day fixture
  no longer produces its expected standalone Single-Leg RDL.
- `test:compiler-year`: detector 45 / 45 and all 416 required athlete-weeks were
  reached across eight distinct athletes without an unattributed-substitution
  error. The existing annual acceptance gate remains red at 236 green weeks and
  365 distinct failure keys.
- `test:compile`: product 0 errors and devtools 0 errors; the gate remains red on
  four inherited test-harness errors in `canonicalWeeklyCompilerSliceTests`,
  `fatiguePlumbingTests` and `fixtureMutationTransactionTests`.
- `test:visible-surfaces`: the real materialised `kit_today` provenance cells
  pass; the suite remains 67 / 81 on its inherited shared-checkout fixture and
  source-shape failures.
- `test:composer-b1`: the new fail-closed attribution branch introduces no new
  failure; the suite retains four inherited failures (46 / 50).
- `test:law-registry`: R-295 is well formed, resolved and guarded. The registry
  remains red only on the inherited 21 `UNENFORCED` rows: 229 total / 208
  guarded.

R-295 and `LAW-automatic-variety-has-no-constraint-explainer` bind the rule to
the chained `test:rdl-family + test:session-injury-review` guards.

NOT COVERED at this checkpoint: the exact affected session on Sam's phone,
native pixels, and a whole-app PASS. No physical phone was touched.

## 2026-08-31 — one Medicine ball answer across onboarding and equipment editing (R-296)

Sam retired the separate `Ball suitable for slams`, `Suitable throwing wall`
and `Impact-safe floor and clear space` answers. One `Medicine ball` answer now
permits the three approved throws/slams; the athlete changes the exercise or
removes Medicine ball if their ball or surroundings are unsuitable.

Two options were compared: hide the three rows only in the UI while retaining
four internal capabilities, or collapse the authored equipment model to one
capability. The source-of-truth collapse landed because every surface is already
derived from the catalogue; a UI-only filter would leave generation, Add/Swap
and temporary equipment facts disagreeing with onboarding.

Implemented:

- `EquipmentTag`, the authored exercise-requirement sheet and the power pool now
  use only `medicine_ball` for all three approved medicine-ball movements.
- The shared label is exactly `Medicine ball`. Onboarding, Profile and the
  temporary-equipment sheet all derive from that same vocabulary and icon map.
- Commercial gym pre-ticks Medicine ball, so onboarding follows its existing
  “untick what you do not have” contract.
- New answers write only the canonical tag. A shared read-ingress lift maps old
  medicine-ball/wall/slam/space answers and dated facts to `medicine_ball`;
  onboarding and Profile use that lift when reopening old answers.

Regression and liveness receipt:

- Red first: `test:equipment-vocabulary` reported the four old labels plus
  three demanded split capabilities; `test:power-pool` showed the throw and
  slams still required those split tags.
- `test:equipment-vocabulary`: 95 / 95, including the single onboarding label,
  commercial preset, legacy saved-answer lift and legacy temporary-fact lift.
- `test:power-pool`: 94 / 94; all three restored movements require only
  `medicine_ball`.
- `test:exercise-intake`: its primary intake journey is 636 / 636 and all
  medicine-ball equipment cells pass. The composite remains red only when it
  reaches the inherited `test:power-primer-policy` deload identity failure
  named below.
- `test:onboarding-presentation`: 109 / 109.
- `test:equipment-answer`: the new onboarding/Profile lift cells pass; the
  suite remains 49 / 50 on its inherited interrupted-flow expectation
  (`SeasonFinished` is now the next required step).
- `test:power-primer-policy`: the new no-ball/with-ball route passes; the suite
  remains 56 / 57 on its inherited deload identity expectation (normal
  `Vertical Jump`, deload `Broad Jumps`).
- `test:equipment-scopes`: 20 / 20; temporary kit, clearing and restart remain
  intact after the canonical tag lift.
- `test:compile`: product 0 and devtools 0 errors; the gate retains four
  inherited test-harness errors in `canonicalWeeklyCompilerSliceTests`,
  `fatiguePlumbingTests` and `fixtureMutationTransactionTests`.
- `test:law-registry`: R-296 is well formed, resolved and guarded. The registry
  remains red only on the inherited 21 `UNENFORCED` rows: 230 total / 209
  guarded.

R-296 and `LAW-one-medicine-ball-equipment-answer` bind the rule to the chained
`test:equipment-vocabulary + test:equipment-answer + test:exercise-intake +
test:power-pool` gates.

NOT COVERED at this checkpoint: native onboarding pixels/taps, the exact saved
answer on Sam's phone, Android, remote sync, and a whole-app PASS. Neither
physical phone was touched.

## 2026-08-31 — one Session / Day / Week section order (R-297)

Root cause confirmed. The active Session plan already used an explicit section
order, but `projectVisibleWeek` emitted the component extractor's arrival order.
That extractor intentionally returned Speed before Strength, so both the Day
timeline and expanded Week card showed the wrong order while Session was right.
Movement Prep was already mounted before the projected parts.

Two options were compared: add a local sort in the Day/Week projection, or move
the existing active-Session order into one pure typed owner used by both the
execution plan and visible projection. The shared owner landed because a second
comparator would allow the same three surfaces to drift again.

Implemented:

- `sessionSectionOrder.ts` now owns the typed section order and the mapping from
  stored session component kind to execution section.
- The active Session execution plan consumes that owner rather than keeping its
  own array and rowless-component mapping.
- The pure Day/Week projection orders components through the same owner before
  it mints visible parts. Membership, rows, dose, programming and completion are
  unchanged.
- Derived Movement Prep remains first and keeps the flame. Typed standalone or
  athlete-added Mobility remains Mobility with its person icon.

Regression and liveness receipt:

- Red first: the pure typed component boundary received the extractor's
  `Speed / Strength / Conditioning` arrival order; `test:projection-ownership`
  then failed on the Day/Week structural order with exactly that sequence.
  Sam's photographed session is the reachability witness, rather than a
  hand-seeded athlete state.
- After: `test:projection-ownership` is 14 / 14 and requires the exact typed
  Day/Week projection to return `Strength / Speed / Conditioning`, preserving
  all three part identities.
- `test:day-first-timeline` is 56 / 56 and proves the Day renderer mounts its
  owned Movement Prep before every projected part and preserves projection
  order without filtering or re-sorting.
- `test:week-board` passes every ordering/part-conservation cell; the command
  remains 84 / 85 on one inherited adapter-plan assertion unrelated to this
  change.
- The active Session regressions jointly require derived Movement Prep first
  and `Strength / Speed / Conditioning` for the programmed sections; the
  existing speed fixture remains unchanged.
- `test:session-execution` retains two inherited source-shape failures unrelated
  to this change: upright exercise-name typography and the conditioning card's
  trailing completion owner. All section-order cells pass.
- `test:session-execution-checklist` reaches and passes
  `test:movement-prep-identity` 10 / 10, then stops on those same two inherited
  `test:session-execution` failures; because the script is an `&&` chain it does
  not reach `test:mobility-flow` or `test:results-persist` in this run.
- `test:session-template` passes every Speed/order cell and remains 87 / 88 on
  one inherited numeric-index source assertion.
- `test:surface-agreement` remains 3 / 5 on two inherited G+1-rest projection
  assertions; neither failure involves section order.
- `test:compile`: product 0 and devtools 0 errors. The gate remains red on four
  inherited test-harness errors in `canonicalWeeklyCompilerSliceTests`,
  `fatiguePlumbingTests` and `fixtureMutationTransactionTests`.
- `test:law-registry`: R-297 is well formed, resolved and guarded. The registry
  remains red only on the inherited 21 `UNENFORCED` rows: 231 total / 210
  guarded.
- `test:ruling-registry` finds no R-297-specific defect and retains its inherited
  missing R-070 file, UNENFORCED ceiling and uncited-question failures.

R-297 and `LAW-one-session-section-order-on-session-day-and-week` bind the rule
to the chained `test:projection-ownership + test:session-execution-checklist`
gates.

NOT COVERED at this checkpoint: native pixels, physical-phone acceptance,
Dynamic Type, VoiceOver reading order, a standalone speed-only day, and a
whole-app PASS. Neither physical phone was touched.

## 2026-08-31 — Erg Flush final modality and restart

The handoff's proposed cause was disproved by the exact enriched journey. The
finished 2027-04-12 workout already retained a typed mixed modality and the
selected `bike / air_bike / ski / row` sequence in its conditioning block,
including after the cold restart. The final card lost the label because
`Aerobic Flush` deliberately presents its conditioning row in the Recovery
section, while the final session-template adapter only projected typed
conditioning identity onto rows presented in Conditioning or Speed sections.

Two designs were compared: reclassify the whole optional Recovery session as a
Conditioning section, or leave its honest Recovery identity in place and make
the shared final-card adapter apply the typed conditioning option to every row
that option owns. The second landed. It changes no session membership,
selection, dose, placement, completion group or saved data; the existing typed
conditioning block remains the sole source for the visible machine and effort
wording.

Regression and liveness receipt:

- Red first: the exact recovery-shaped `Erg Flush Blocks` final adapter input
  retained `mixed` plus `bike / air_bike / ski / row`, but the final card had
  no modality label. After the change it displays
  `Bike → Air Bike → SkiErg → RowErg` and retains `Effort: 3/10`.
- JSON save/reconstruction preserves that exact sequence and display copy.
- Mutation: restoring the old presentation-only guard makes the exact cell fail
  on the missing all-machine sequence; restoring the shared owner makes it
  green again.
- `test:conditioning-modality-persistence` is green: 19 / 19 authored modality
  cells, 3,298 / 3,298 displayed-route cells, 7 / 7 real generated save/restart
  cells, and the two exact final Erg Flush cells.
- The existing real accepted flush journey now checks the final card both
  before and after a real storage relaunch. All 112 new cells pass: two genders
  × four single-machine profiles × seven genuinely rolled-over flush dates ×
  final-card plus restart. The full canonical slice reaches 11,891 passes and
  remains red on six inherited failures: four pre-season speed identities
  changing across restart and two full-kit Primer-heavy-option expectations.
- The exact enriched 29-week replay was rerun for both athletes. The two final
  athlete-cards on 2027-04-12 show the full four-machine sequence, and both
  week-29 cold-restart receipts are `ok: true`.
- `test:session-template` retains its inherited 87 / 88 numeric-index
  source-shape failure; all conditioning and Recovery cells pass.
- `test:compile` reports product 0 and devtools 0 errors. It retains four
  inherited test-harness errors in `canonicalWeeklyCompilerSliceTests`,
  `fatiguePlumbingTests` and `fixtureMutationTransactionTests`.

The next defect of this class is caught at two boundaries: the exact pure final
adapter cell covers a typed conditioning row presented outside the Conditioning
section, while the acted flush journey covers actual accepted history, storage
and relaunch across every supported single-machine profile.

NOT COVERED at this checkpoint: native pixels, physical-phone acceptance,
remote sync, a no-machine flush fallback, the pending load-progression finding,
PDF generation, and a whole-app PASS. Neither physical phone was touched.

## 2026-08-31 — four load flags investigated to their two ruled owners

The four occurrences are two duplicated male/female changes. The proposed
shared production defect was not confirmed, so no prescription code was
changed:

- `Leg Press 92.5 kg 3×10 -> 110 kg 3×8` is the exact result of Sam's U-2
  ruling, `Keep the cut (75% / 90%)`. The initial four-week program is authored
  before those sessions occur: early Off-season applies 75% to the 122.5 kg
  base and rounds to 92.5 kg; mid Off-season applies 90% and rounds to 110 kg,
  while the authored target drops from 10 to 8 reps. It is a pre-authored
  subphase transition, not an unexplained history progression or athlete edit.
- `Kettlebell Swings 22.5 kg -> 26.5 kg` comes from a different owner. The
  athlete's exact recorded 22.5 kg remains the base under R-096's explicit
  `never round, rewrite or correct the athlete's recorded number` clause. The
  same ruling then adds the authored kettlebell increment of 4 kg. The result is
  unusual on a fixed-bell rack, but changing it would require either rewriting
  the athlete's number or replacing Sam's ruled increment semantics.

The audit correctly called these review concerns rather than proven unsafe
progressions. The implementation trace establishes that they do not share a
cause and that both currently follow explicit Sam rulings. Reclassifying either
as a product defect would silently overturn those rulings, which this seat did
not do.

Regression and liveness receipt:

- `test-audited-load-concerns.cjs` adds four exact source-tracing cells to the
  release-blocking programming-selection chain: the literal 92.5/110 Leg Press
  outputs, its 3×10/3×8 authored schemes, the literal 4 kg kettlebell
  increment, and the exact `22.5 + 4 = 26.5` history decision.
- `test:block-two-progression` is 41 / 41 and retains the broader real stored =
  visible = reloaded load-authority protection.
- Mutation 1 changed the mid-Off-season multiplier from 90% to 85%; the exact
  Leg Press cell went red with 105 kg.
- Mutation 2 changed the kettlebell lattice step from 4 kg to 6 kg; the exact
  increment cell went red. Both production mutations were restored before the
  final 4 / 4 green run.

The next false-positive load report is caught by requiring each flagged number
to name its producing owner and accepted base before calling it an automatic
progression. A detector that only compares consecutive display values cannot
distinguish a pre-authored phase prescription or a return to exact athlete
history from an unexplained jump.

NOT COVERED at this checkpoint: clinical appropriateness for an individual
athlete, changing Sam's 75/90 Off-season ruling, changing the never-rewrite-own-
load ruling, physical-phone acceptance, PDF regeneration, and a whole-app PASS.
Neither physical phone was touched.

## 2026-08-31 — final implementation verification after all three checkpoints

Scoped checkpoints, in the requested order:

1. Going Away stable selection: `8dede52e`.
2. Erg Flush final modality and restart: `df2758b5`.
3. Load-concern source investigation: `e967a073`.

Final commands and exact relevant results:

- `npm run test:programming-selection-release` — green. Its full-year
  catalogue reversal changed 0 / 728 final athlete-days across two 52-week
  athlete-years; all four direct Going Away athlete-date rows and every later
  saved/restarted day are identical. The same chain passed all 55 authored
  conditioning templates (19 / 19 modality cells), 3,298 / 3,298 displayed
  conditioning-route cells, 7 / 7 generated modality persistence cells, the
  two exact recovery-shaped Erg Flush cells, deload quality 11 / 11, block-two
  progression 41 / 41, audited load tracing 4 / 4, final composition 6 / 6,
  and generated-week assembly 30 / 30.
- `npm run test:programming-catalogue-order` — 3 / 3: strength,
  conditioning and power selection all ignore catalogue array order.
- `npm run test:equipment-scopes` — 20 / 20: dated kit/travel, permanent
  answers, accepted selection history, Clear and restart remain intact.
- The exact enriched replay used during Step 2 reached both athlete-cards on
  2027-04-12 with `Bike → Air Bike → SkiErg → RowErg`, and both week-29
  cold-restart receipts were `ok: true`.
- `npm run test:canonical-weekly-compiler` reached the entire canonical slice.
  All 112 new final-flush/save/relaunch cells pass; the slice remains
  11,891 / 11,897 on six inherited failures already named in the Step 2
  checkpoint, so the command's later `&&` children did not run.
- `npm run test:compile` remains product 0 / devtools 0 and retains its four
  inherited test-harness errors in three files.

Verification strategy for the next defect of each class:

- Selection stability is a final athlete-day comparison over normal/reversed
  catalogues, real accepted Going Away facts and later restarts, not a selector
  unit test alone.
- Conditioning identity is checked both at the exact final-card adapter and in
  the acted storage/relaunch journey, including Recovery-shaped cards.
- A load flag must identify its accepted base and the exact producer before it
  is called an unexplained progression; the literal producer cells are now in
  the release chain.

NOT COVERED in this final implementation pass: physical-phone acceptance,
native layout/glass, remote sync, Android, full 52-week enriched event replays
after the Erg Flush display-only fix, the corrected audit/PDF exporters, PDF
generation or page inspection, clinical load appropriateness, and a whole-app
PASS. Per Sam's request no PDF was generated, modified or inspected, and
neither physical phone was touched.
