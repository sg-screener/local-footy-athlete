# One typed refusal, five handlers, and the one that throws

**STATUS: REASSESSMENT, NOT IMPLEMENTED.** Written under CLAUDE.md's
escalation rule, whose second trigger this matches exactly: *the semantic layer
understands the athlete correctly, but a later layer changes, blocks, downgrades
or reinterprets that intent.* No fifth catch, no guard, no compatibility branch
is to be written before this is approved.

## What the walker found

The action-sequence walker reaches this from a **fresh install in three
actions**, across several season phases and several doors. Minimal histories,
shrunk:

```
seed 4   1. answer onboarding (Pre-season, no team days)
         2. generate the program
         3. mark 2026-07-21 as rest
         → Section 18 final-week rejection
           (pattern_restore_failure:strength_patterns:0
            |planner_selected_target_miss:conditioning:3
            |planner_selected_target_miss:main_strength:3)

seed 5   1. answer onboarding (Pre-season, team Wednesday)
         2. generate the program
         3. advance time 7 days
         4. bin 2026-07-29 (scope strength)
         5. mark 2026-08-02 as rest
         → Section 18 final-week rejection
           (required_minimum_shortfall:conditioning:2|…:main_strength:2)

seed 7   1. answer onboarding (Off-season, team Monday/Wednesday)
         → Section 18 final-week rejection
           (maximum_breach:conditioning:4|maximum_breach:sprint_high_speed:2)
```

`Section18WeekAcceptanceError` escapes `commitAcceptedStateTransaction` and
reaches the caller as an exception. On a phone that is a dead screen, not a
refusal. It is an **L1 violation** — the matrix's first law — and marking a day
as rest is about as ordinary as an athlete action gets.

This is also the class that made the export-as-seed attempt look like a defect
of Sam's, and it is why the walker matters: the seed could not tell a real crash
from a fixture artefact, and the walker settles it by construction — every one
of these states was reached by acting.

## The seven questions

**1. What is the current source of truth?**
`requireSection18AcceptedWeek` (`rules/section18AcceptedWeekGateway.ts:893`). It
owns whether a candidate week is acceptable, and it answers by throwing a typed
error carrying `code = 'section18_week_rejected'` and the full rejection result.

**2. How many representations of the user request exist?**
One request, but the ANSWER has five representations. Four callers catch the
throw and convert it into their own local refusal:

| site | what it does with the rejection |
|---|---|
| `coachRevisionPolicy.ts:51` | converts to a policy refusal |
| `coachRevisionOverrideWriter.ts:322` | converts to a writer refusal |
| `canonicalPlanChangeCandidateMaterializer.ts:288` | converts to a materialiser refusal |
| `onboardingCompletion.ts:39` | converts to an onboarding failure |
| **the tap door** (`setManualOverride` → `commitAcceptedStateTransaction`) | **nothing — it throws** |

A fifth catch is the obvious fix and it is the wrong one. Five handlers of one
typed fact is the defect; a sixth would be the same defect, larger.

**3. Where can intent, domain, date, target or scope be reinterpreted?**
At each of those four conversions independently. The preview boundary already
answers `section18_week_rejected` as an honest refusal — Sam's own device tape
shows it doing so at 07:26:35 — and the commit boundary then throws on the same
fact. **Preview refuses; commit crashes. Same input, same rule, two behaviours.**

**4. Which layer should own the decision?**
The transaction owner. `stageAcceptedStateTransaction` already has refusal
vocabulary (`noChange: { reason }`) and already returns it for other
"this cannot be accepted" cases. A §18 rejection is that fact, not an
exceptional condition. The gateway should hand the transaction owner a typed
*result*, and the owner should publish a refusal — with every existing caller
reading one answer instead of four.

**5. What simpler architecture removes representations instead of adding guards?**
Make the rejection a **return value, not a throw**, at the one boundary that
owns acceptance, and delete the four ad-hoc catches. That converts five
representations to one and removes the possibility of a sixth caller forgetting.
It is also the north-star direction: the rejection is a derived fact about a
candidate week, and it should be *derived and returned*, not thrown and
re-interpreted by whoever happens to be on the stack.

**6. Which legacy paths should be bypassed or retired rather than patched?**
The four catch-and-convert sites, all of which predate the transaction owner
having its own refusal vocabulary. They are the "one more resolver" shape that
CLAUDE.md's stop-patching trigger names, arrived at one caller at a time.

**7. What tests prove the new ownership boundary?**
Already written and currently RED, which is why they are not in `test:bible`:
- `athleteActionWalkerTests` — the seven laws after every action, from fresh
  install, with shrinking. L1 is the assertion that fails today.
- the 114-cell athlete-door matrix stays the deterministic floor.
- a direct assertion that `commitAcceptedStateTransaction` never throws
  `Section18WeekAcceptanceError` to a caller, and that the four existing
  catchers can be deleted without changing behaviour.

## The open product question, which is Sam's and not mine

A refusal is honest, but it is not obviously *right* here. Seed 4 marks a
single day as rest and the week becomes unacceptable to §18. Two readings:

- **Refuse:** "I can't make that change and keep your week valid." Truthful,
  and the athlete is stuck with a calendar they cannot edit.
- **Accept and reduce:** the week takes an authorised reduction, exactly as the
  readiness and illness paths already do, and the athlete is told what shrank.

The second is what the rest of the app does with life-facts, and a rest day IS
a life-fact. But that is a programming ruling, not a refactor, and it decides
whether the fix above is the whole fix or only the floor under it.

**Nothing is implemented pending both answers: the ownership collapse (4), and
the refuse-vs-reduce ruling.**
