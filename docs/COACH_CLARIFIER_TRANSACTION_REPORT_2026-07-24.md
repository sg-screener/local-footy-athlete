# Coach clarifier → owned multi-field transaction — build report (2026-07-24)

Executes `COACH_CLARIFIER_TRANSACTION_PLAN_2026-07-24.md` (L10 run-3 Finding 2,
escalation-approved) exactly as staged. Status: **gates green, awaiting Sam
device acceptance** (Process Law L2 — no "done" claim before device).

## What shipped (4 commits, tests-first)

1. **Stage A — RED tests** (`coachClarifierAdvanceTests.ts`, gate
   `test:coach-clarifier-advance`, added to the `test:bible` chain).
   Drives `handleCoachTurn` through the exact reported transcript and
   reproduced the freeze in-harness before any fix: "Yes" resolved
   Next-Wednesday, executor returned not-applied, pending stayed frozen on
   `targetDate`, "what detail" re-emitted the date question verbatim.
   9 RED / 3 green at birth; 12/12 green at Stage D.
2. **Stage B** — the add_session date-rejection capture site seeds a
   `PendingAddToDateTransaction` (`target_date` outstanding; `add_type`
   outstanding for generic wording — "a session" is not an add-type answer).
   The schedule-transaction resolver runs before every single-slot resolver,
   so it owns the resume; this alone killed the loop (REG + INV green).
3. **Stage C** — `resolvePendingScheduleTransactionAnswer` now receives
   `pendingAnswerClassification` (it was the only classifying resolver
   without it). The add resolver consumes an `accept_proposed`/
   `choose_candidate` **date** candidate instead of re-parsing the raw
   "Yes" (the drop that discarded Next-Wednesday); a definitive reject
   while the target is outstanding cancels. On every transaction clarify,
   the stored clarification slot is rebuilt to describe the CURRENT
   outstanding field (`scheduleTransactionClarificationSlot`) so the next
   turn's classification never runs against an answered question.
4. **Stage D** — both advance-only-on-`applied` clears retired (draft
   resume + program-edit resume — the plan's `:4905` class; the transcript
   proved the draft-resume twin at `:4860` is the same class). Rule now:
   a completed resume has consumed the slot's answer, so the pending is
   spent whatever the executor said. The transaction owns advance-vs-clear
   via its own `currentStep`/`missingFields`.

The verified Q7 behaviour end-to-end: date question once → "Yes" advances to
"What would you like to add: conditioning, strength, recovery, or a named
session?" → "An easy conditioning session" completes as an owned
`add_conditioning` through the §18-gated executor.

## Resolver consolidation state (Stage D, per plan "one at a time")

- add_session under-specification: fully owned by the transaction; the
  single-slot re-ask (`coachProgramEdit.ts` `resolvePendingTargetDateAnswer`
  fallback) is unreachable for it.
- All four classifying resolvers (revision / schedule / draft / legacy
  program-edit) are fed `pendingAnswerClassification`.
- `resumeFromPending` is deliberately NOT fed: it never classifies, and any
  pending reaching it without a clarification slot has a null classification
  by construction — threading the param would be dead surface.

## Sibling trace (move / swap / readiness — same freeze class)

- **move_session**: date-rejection pendings build a
  `PendingMoveSessionTransaction` on resume; resolver-level probe of the
  exact "Yes"-after-past-date shape shows it asks its own NEW week-context
  question ("currently viewed week or next upcoming?") — never the answered
  date question. Residual (verified, staged by the plan): the move resolver
  does not yet consume the accepted date candidate, so the athlete answers
  the same semantic content twice in different words. No freeze possible
  after Stage D. This is the plan's "(and, staged, move_session)" work.
- **swap / readiness**: multi-turn probes run byte-identical on `main` and
  on this branch — their routing quirks (e.g. "Swap Monday and Wednesday" →
  whole-session clarifier with no pending; "I'm feeling flat today" landing
  in an add flow under the deterministic-stub classifier) are PRE-EXISTING
  and unchanged by this unit. Neither exhibits the freeze class: no pending
  survives an answered field. Reported here so they are never misattributed
  to this merge (Process Law, F-section discipline).

## Gates (all green at merge)

`test:coach-clarifier-advance` 12/12 · `coachPendingClarifierTests` 153 ·
`test:coach-command-router` 597 · `test:coach-program-edit` 347 ·
`test:chained-mutation-continuity` 32 · `test:coach-failure-copy` 6 ·
`test:coach-add-session-ownership` 4 · full `test:bible` chain (incl.
`test:compile` ratchet) end-to-end.

## NOT COVERED (L2 mandatory)

- Device acceptance: NOT run. The Q7 transcript on Sam's phone is the gate.
- The live/semantic classifier path: harness uses the deterministic
  classifier stub; the semantic pending-answer classifier fallback
  (`classifyPendingAnswerForController` semantic branch) is exercised only
  as far as existing suites cover it.
- move_session candidate-consumption (see sibling trace) — staged, not built.
- Remaining resolver collapse (revision / draft / legacy program-edit →
  transaction owner) — staged per plan, one resolver per unit.
- The pre-existing routing quirks the probes surfaced on `main` (swap
  whole-session refusal loop with no pending; flat-readiness phrase landing
  in an add flow under the stub classifier) — out of scope, unowned.
- `resolvePendingAddToDateTransactionAnswer` line-941 behaviour (any
  non-conditioning add-type re-asks the same add-type list; strength /
  recovery / named-session adds are not yet executable through the
  transaction) — pre-existing resolver semantics, unchanged by this unit;
  the athlete's add-type answer "conditioning" is the only completable path.
