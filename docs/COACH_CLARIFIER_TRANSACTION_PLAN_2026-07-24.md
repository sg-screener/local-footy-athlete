# Coach clarifier → owned multi-field transaction (L10 run-3, Finding 2)

Escalation-approved redesign (Sam, 2026-07-24). Retire the single-slot clarifier
and the "advance-only-on-applied" branch; one typed multi-field clarifier
transaction that tracks answered/outstanding fields and advances step-by-step;
consolidate the pending-answer resolvers. Tests-first, exactly the Q7 shape.

## The bug this kills (verified mechanism)

1. Athlete: "Add a session on Wednesday" (a past Wednesday).
2. Coach: "…is in the past. Do you mean next Wednesday instead?" — a
   `PendingClarificationSlot` with `missingField: 'targetDate'` is stored
   (`coachTurnController.ts:5812` → `capturePendingDateClarificationFromProgramEditRejection`).
3. Athlete: "Yes" — classified correctly as `accept_proposed` → Next Wednesday
   (`pendingCoachClarifierStore.ts:507`), resolved to a complete `add_session`
   on Next Wednesday (`coachProgramEdit.ts:2596`).
4. The `add_session` still lacks its **add-type**, so the executor returns
   *not-applied* ("I need one more detail").
5. **Freeze:** `coachTurnController.ts:4905` clears/advances the pending only
   `if (result.kind === 'mutated' && result.applied)`. Not-applied ⇒ the pending
   stays frozen as the **original date slot** — never advanced to an add-type slot.
6. Athlete: "what detail" — fails to parse as a date, so
   `coachProgramEdit.ts:2610` re-emits `pending.askedQuestion` **verbatim** (the
   date question). Step 6 = step 2, forever.

Root cause: a **single-field** clarifier representing an intent that has an
**ordered set** of missing fields (which-day, then what-to-add), with resume
branches that only clear/advance on `applied`.

## Target ownership boundary

`add_session` (and, staged, `move_session`) under-specification is owned by ONE
typed transaction — the existing `PendingAddToDateTransaction`
(`pendingCoachClarifierStore.ts:98`), which already models the right shape:
`missingFields: string[]` + an advancing `currentStep`
(`resolve_target → resolve_add_type → resolve_scope → confirm → ready`).

The transaction, not the executor's applied/not-applied result, owns whether the
clarifier advances. Each answered field is removed from `missingFields`; the next
outstanding field is asked. **No branch re-emits an answered field's question.**

## Stages (each tests-first, its own checkpoint)

### Stage A — Q7 tests (RED first) — `coachClarifierAdvanceTests.ts`
Multi-turn, driving `handleCoachTurn`:
- A1 "Add a session on Wednesday" (past) → asks which-Wednesday (date clarifier).
- A2 "Yes" → **advances** to ask the add-type; reply must NOT be the date
  question and must NOT be a bare "one more detail" freeze.
- A3 add-type answer ("an easy conditioning session") → applied (owned add) OR an
  honest §18 refusal — never a re-ask.
- Invariant test: after a field is answered, no subsequent clarifier reply equals
  a previously-answered field's question (assert on `askedQuestion` history).
- Regression: the exact reported transcript ("Yes" then "what detail") never
  reproduces the date question twice.

### Stage B — route add_session under-specification through the transaction
- At the add_session clarification-capture site
  (`capturePendingDateClarificationFromProgramEditRejection` / its add_session
  branch), build a `PendingAddToDateTransaction` seeded with the resolved
  `targetDate` candidate (next-Wednesday) as the `proposedCandidate` for
  `resolve_target`, and `add_type` in `missingFields`.
- Retire the single-slot date re-ask for the add_session case (keep the generic
  slot only for genuinely single-field clarifiers until Stage D).

### Stage C — feed the classification to the transaction resolver
- `resolvePendingScheduleTransactionAnswer` (`coachClarifierResume.ts:802`) is the
  ONLY resolver not passed `pendingAnswerClassification`
  (`coachTurnController.ts:4590`). Thread it through, and in
  `resolvePendingAddToDateTransactionAnswer` (`:857`) consume an
  `accept_proposed`/`choose_candidate` **date** candidate instead of re-parsing
  the raw "Yes" via `parseAddTargetDate` (`:863`). That is the drop that discards
  the correctly-classified Next-Wednesday.
- Advancement: when `targetDate` resolves but `add_type` is still missing, return
  `kind: 'clarify'` with `currentStep: 'resolve_add_type'` and the add-type
  question — never the target question.

### Stage D — retire the freeze + consolidate resolvers
- Remove the "advance-only-on-`applied`" clear at `coachTurnController.ts:4905`;
  the transaction's own `currentStep`/`missingFields` decide advance vs. clear.
- Collapse the five pending-answer resolvers (revision / schedule / draft /
  legacy / `resumeFromPending`) toward the single transaction owner. Do this last
  and incrementally, one resolver at a time, each behind the Stage-A invariant
  tests plus the existing `test:coach-add-session-ownership`,
  `coachPendingClarifierTests`, and `chainedMutationContinuityTests`.

## Gates
`npm run test:coach-add-session-ownership`, the new
`coachClarifierAdvanceTests`, `coachPendingClarifierTests`,
`chainedMutationContinuityTests`, `test:coach-failure-copy`, `test:bible`,
`test:compile`. Athlete-facing ⇒ gates green, then Sam device acceptance (L10).

## Why staged, not one pass
This is the coach pipeline — the escalation rule exists to stop rushed changes to
exactly this surface. Each stage is independently green and revertible; the
single-slot path is retired only after the transaction path is proven to advance.
