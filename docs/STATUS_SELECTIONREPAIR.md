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

Steps 1–3 complete; Step 4 next.

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
