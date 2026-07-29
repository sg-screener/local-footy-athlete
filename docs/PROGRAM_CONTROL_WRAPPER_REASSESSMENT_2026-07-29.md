# The program-control wrapper: three answers to one question

**STATUS: REASSESSMENT. NO FIXES WRITTEN.** Required by CLAUDE.md's escalation
rule, whose second trigger this matches verbatim: *the semantic layer understands
the athlete correctly, but a later layer changes, blocks, downgrades or
reinterprets that intent.* Sam's L11 stop-rule also applies — the walker's action
vocabulary must enter through this route before any fix lands, so that
walker-green means screen-green.

## What the tape says

`device-export-2026-07-29-five-taps.json`, revision 43. Taps 1 and 5 pass. The
same failing sequence appears THREE times (10:27:43, 10:27:54, 10:28:28) —
he retried, and got the identical wrong answer each time:

```
route=program_control:program_tab:plan_change_sheet   selectedRoute=guided_tap_flow
mutation_preview_result        internalResultCode=g1_route_required   appliedDates=[]
athlete_action_route_selected  selectedRoute=plan_change_producer
athlete_action_failed          internalResultCode=g1_route_required
                               failureCategory=bible_contract        outcome=rejected
athlete_action_failed          internalResultCode=program_control_move_session_rejected
                               failureCategory=technical_failure     outcome=rejected
```

The same move on the `plan_change_preview` route (10:27:29, 10:27:52, 10:28:25)
returns `g1_route_required` and then **stops** — the sheet holds the change back
and asks. That is the funnel working. Only the `program_control` route turns it
into a failure.

## The seven questions

**1. What is the current source of truth?**
`applyPlanChange` / `previewPlanChangeRisk`. They return a typed result whose
`rejected[].code` of `g1_route_required` is a SENTINEL — "this landing needs the
athlete's answer" — and explicitly not a refusal. `resolveG1LandingAsk` is its
one owner, and the ask-flow is the only door onto G-1.

**2. How many representations of the user request exist?**
Of the request, two. Of the ANSWER, three, each lossier than the last:

| layer | representation of "ask the athlete" |
|---|---|
| producer | `{ outcome: 'refused', rejected: [{ code: 'g1_route_required' }] }` — a sentinel with meaning |
| `executePlanChangeAction` | `{ ok: false }`, `needsGuidedFollowUp` **not set** — the meaning is gone |
| `executeProgramControlAction` | `program_control_move_session_rejected`, `failureCategory: technical_failure` — now a bug report |

The second layer is where it dies. `executePlanChangeAction`
(`programControlActions.ts:490-503`) maps every non-ok producer result to a bare
`ok: false`, and the outer layer then computes
`` `program_control_${action.type}_${result.needsGuidedFollowUp ? 'needs_input' : 'rejected'}` ``.
The wrapper ALREADY HAS the right vocabulary — `needsGuidedFollowUp`, and a
`guided_follow_up` UI outcome — and nothing on the plan-change path ever sets it.

**3. Where can intent, domain, date, target or scope be reinterpreted?**
Two places, and the second is finding 4:

- **The answer**, as above.
- **The scope.** `planChangeForAction` (`:450`) builds the move's `PlanChange`
  as `{ kind: 'move_session', fromDate, toDate }` — **no `scope`** — while
  `bin_session` on the very next line passes `scope: action.payload.scope`. It
  cannot do otherwise: `ProgramControlActionBase<'move_session', { fromDate:
  string; toDate: string }>` (`:161`) has nowhere to put a component scope. The
  sheet lets the athlete choose "just the gym session", the wrapper re-types the
  request into a payload that cannot express it, and the whole day travels.
  That is exactly what tap 4 did — Upper Pull *and* Continuous Aerobic moved.

**4. Which layer should own the decision?**
The producer, alone. It already owns the ask and the scope. The wrapper's job is
to CARRY a typed request in and route a typed result out. It should interpret
neither.

**5. What simpler architecture removes representations instead of adding guards?**
Sam's instruction is the design: *the sentinel should route to the ask-flow, not
be translated.* Concretely, and in this order of preference:

- The wrapper's move payload carries `scope`, so there is one request shape and
  no re-typing that can drop a field. This is a deletion of a lossy conversion,
  not a new field to remember.
- The wrapper stops classifying producer results at all. A producer answer that
  is "ask the athlete" routes to the ask-flow; a producer answer that is a
  refusal is passed through with the producer's own words. `needsGuidedFollowUp`
  already exists for exactly this and is simply never set on this path.
- `classifyAthleteActionFailure` never sees a sentinel, because a sentinel is not
  a failure and never reaches the failure path.

**6. Which legacy paths should be bypassed or retired rather than patched?**
The wrapper's result-interpretation block. Teaching it "and `g1_route_required`
means needs_input" would be the fourth interpretation of one typed fact and is
the move CLAUDE.md's stop-patching trigger names. The interpretation should go,
not grow.

**7. What tests prove the new ownership boundary?**
None exist today, and that is the finding under L11. Every suite — the matrix,
the walker, the device replay — enters at `applyPlanChange`, which is the layer
BELOW the one that broke. All three were green while the screen was red, which
is the definition of a harness entering through the wrong door.

Before any fix:

- the walker's action vocabulary gains the real UI route
  (`executeProgramControlAction` → producer), so walker-green means screen-green;
- the three findings are red-reproduced from the tape by ACTING;
- and a law that the wrapper never re-categorises a producer answer — asserted
  from the producer's own typed result, never from a string.

## A fourth finding, mine, from the same tape

At 10:28:57 a scoped move `2026-08-03 → 2026-08-05` returned
`scoped_move_destination_occupied`. Last unit I removed the free-days-only filter
from the move OFFER under the doubling law, and did not remove the matching
refusal in the commit path. So the menu now advertises occupied destinations that
the door still refuses — an offer/commit disagreement I introduced, on his phone,
one build later. The matrix's "menu means what it says" law did not catch it
because that law drives `addOnTopCategories` only, not move destinations. That
gap is part of what the walker's new door has to close.
