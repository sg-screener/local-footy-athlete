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

Step 1 complete; Step 2 next.

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
