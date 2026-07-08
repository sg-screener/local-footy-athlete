# Claude AI Coach Architecture Handoff

## Claude, Your Job Is...

Claude, your job is to reassess the AI coach architecture in this repo and recommend the simplest reliable path forward.

This is not a request to patch the next bug. Please audit the system as an architecture problem. The core question is whether the new `CoachRevisionProposal` snapshot/diff/override pipeline should replace most one-off coach edit flows, and how to migrate safely without breaking existing app behavior.

Do not implement code unless explicitly asked later. For now, produce an architecture diagnosis, migration plan, and risk assessment.

## Product Goal

The app is Local Footy Athlete, an iOS/Expo app for AFL/local footy strength and conditioning.

The AI coach should let an athlete talk naturally about their training plan and safely update the visible program. The athlete should not need command syntax. They should be able to say things like:

- "I'm cooked, bin the strength tomorrow"
- "Drop the lower work Monday but keep the flush"
- "Can you remove conditioning from Monday?"
- "I can't make team training tomorrow, swap it for conditioning"
- "I'm away next week"
- "Can only train Mon/Wed/Fri now"
- "Make tomorrow lighter"
- "Move Thursday to Saturday"

The coach should:

1. Understand messy natural language.
2. Look at the current visible program.
3. Know what day/session/block/item the user means.
4. Ask a clarification if required.
5. Preserve original intent through follow-up answers like "yes", "yeah", "that one".
6. Safely edit the program.
7. Update the Program tab and workout detail UI.
8. Never claim "Done" unless the visible program actually changed correctly.
9. Never remove protected content. If the user says "keep the flush", conditioning must remain.
10. Avoid endless edge-case phrase patches.

## Repo Snapshot

Workspace:

```text
/Users/samgeurts/Documents/local-footy-athlete
```

Current git status when this handoff was written:

```text
clean
```

Recent commits:

```text
4cf1c37 Add CoachRevisionProposal behavior matrix
531408e Resume CoachRevisionProposal clarifications
b2be3d2 Enable dev-active CoachRevisionProposal one-off path
7dacc55 Add CoachRevisionProposal override writer
d3aace1 Add CoachRevisionProposal semantic shadow adapter
2702815 Add CoachRevisionProposal diff validator prototype
456f2e7 Add semantic active dev script
c68c5d8 Resolve block edits as aggregate sections
887aa86 Add generic block-level target resolver
0dc8376 Derive session display from remaining content
09dd3e5 Route resumed strength drafts to typed executor
95dc8a0 Fix semantic ProgramEditDraft edge endpoint
3ee080a Enable dev-only active semantic ProgramEdit mode
9084c05 Resolve strength block targets without item prompts
e34dca7 Add typed strength-block executor support
fb07486 Preserve semantic draft through pending clarification
73e7170 Add semantic ProgramEditDraft shadow adapter
27bbdec Wire semantic ProgramEditDraft parser behind flag
dcd12c1 Add semantic ProgramEditDraft behavior matrix
f8cdff7 Add semantic ProgramEditDraft parser interface
0661835 Resolve pending clarification answers semantically
98aff0c Collapse empty sessions after block removal
7aaf228 Add visible domain verifier for ProgramEditDraft
be9cc25 Guard ProgramEdit execution against draft mismatch
626d0de Use ProgramEditDraft as mutation front door
25d15db Add ProgramEditDraft classification
0372de1 Add dev post-onboarding reset
9030ebc Suppress duplicate workout context labels
c2a546f Handle add conditioning as one-off rest-day session
4242c8e Complete coach target context state
```

Relevant package scripts include:

```text
npm run typecheck
npm run test:coach-revision-proposal-behavior
npm run test:coach-program-edit
npm run test:coach-command-router
npm run test:coach-pending-clarifier
npm run test:coach-truth-gate
npm run test:coach-live-send-context
npm run test:env-config
npm run smoke:coach-revision-proposal
```

Local tests run before writing this handoff:

```text
npm run typecheck -> pass
npm run test:coach-revision-proposal-behavior -> pass, 34 assertions
npm run test:coach-program-edit -> pass, 347 assertions
npm run test:coach-command-router -> pass, 599 assertions
npm run test:coach-pending-clarifier -> pass, 153 assertions
npm run test:coach-truth-gate -> pass, 58 assertions
npm run test:coach-live-send-context -> pass, 40 assertions
./node_modules/.bin/sucrase-node src/__tests__/semanticCoachRevisionProposalTests.ts -> pass, 22 assertions
./node_modules/.bin/sucrase-node src/__tests__/llmSemanticCoachRevisionProposalAdapterTests.ts -> pass, 14 assertions
./node_modules/.bin/sucrase-node src/__tests__/coachRevisionProposalControllerTests.ts -> pass, 33 assertions
./node_modules/.bin/sucrase-node src/__tests__/coachRevisionProposalTests.ts -> pass, 24 assertions
./node_modules/.bin/sucrase-node src/__tests__/coachRevisionOverrideWriterTests.ts -> pass, 21 assertions
```

Important note: these are local tests. Live simulator testing was intentionally paused until Stage 4A is wired end-to-end in dev.

## Current Main App Structure

Coach screen and orchestration:

- `src/screens/coach/CoachScreen.tsx`
- `src/utils/coachTurnController.ts`

Context, target/reference, and pending state:

- `src/utils/coachContextPacket.ts`
- `src/utils/coachTargetFrame.ts`
- `src/utils/coachReferenceResolver.ts`
- `src/utils/coachVisibleWeekAutoBind.ts`
- `src/store/pendingCoachClarifierStore.ts`
- `src/store/coachContextStateStore.ts`

Old/current command and ProgramEdit path:

- `src/utils/coachCommandRouter.ts`
- `src/utils/coachLLMCommandAdapter.ts`
- `src/utils/coachProgramEditDraft.ts`
- `src/utils/semanticProgramEditDraft.ts`
- `src/utils/llmSemanticProgramEditDraftAdapter.ts`
- `src/utils/coachProgramEdit.ts`
- `src/utils/applyAdjustmentEvents.ts`
- `src/utils/coachVisibleDomainVerifier.ts`

New snapshot/diff/override path:

- `src/utils/coachRevisionProposal.ts`
- `src/utils/semanticCoachRevisionProposal.ts`
- `src/utils/llmSemanticCoachRevisionProposalAdapter.ts`
- `src/utils/coachRevisionOverrideWriter.ts`

Visible program rendering/read model:

- `src/utils/visibleProgramReadModel.ts`
- `src/utils/visibleProgramProjection.ts`
- Program UI screens under `src/screens/program/`
- Home/day display screens under `src/screens/home/`

Config and Edge Functions:

- `src/config/env.ts`
- `supabase/functions/coach-chat/index.ts`
- `supabase/functions/coach-intent/index.ts`
- `supabase/functions/coach-semantic-program-edit-draft/index.ts`
- `supabase/functions/coach-revision-proposal/index.ts`

Relevant tests:

- `src/__tests__/coachRevisionProposalTests.ts`
- `src/__tests__/semanticCoachRevisionProposalTests.ts`
- `src/__tests__/llmSemanticCoachRevisionProposalAdapterTests.ts`
- `src/__tests__/coachRevisionOverrideWriterTests.ts`
- `src/__tests__/coachRevisionProposalControllerTests.ts`
- `src/__tests__/coachRevisionProposalBehaviorMatrixTests.ts`
- `src/__tests__/coachProgramEditContractTests.ts`
- `src/__tests__/coachProgramEditDraftTests.ts`
- `src/__tests__/semanticProgramEditDraftTests.ts`
- `src/__tests__/semanticProgramEditDraftBehaviorMatrixTests.ts`
- `src/__tests__/coachSemanticProgramEditDraftControllerTests.ts`
- `src/__tests__/coachTargetFrameTests.ts`
- `src/__tests__/coachPendingClarifierTests.ts`
- `src/__tests__/coachCommandRouterTests.ts`
- `src/__tests__/coachTruthGateTests.ts`
- `src/__tests__/visibleProgramProjectionTests.ts`
- `src/__tests__/coachScreenLiveSendContextTests.ts`
- `src/__tests__/coachLiveWiringTests.ts`
- `src/__tests__/coachLivePathV2IntegrationTests.ts`

## Old ProgramEditDraft Architecture

The old/current one-off edit path is roughly:

```text
user message
-> CoachTurnController
-> CoachTargetFrame/reference resolution
-> deterministic and/or semantic ProgramEditDraft
-> ProgramEdit finalisation
-> legacy CoachCommand/router compatibility in some cases
-> adjustment events/applyAdjustmentEvents
-> visible verifier
-> reply
```

This path was built in stages to stop whack-a-mole bugs:

- `CoachTurnController` extracted orchestration out of `CoachScreen`.
- `CoachTargetFrame` introduced central target/reference resolution.
- `ProgramEditDraft` introduced typed intent/domain/scope classification.
- Pending clarification store preserves draft context through answers like "yes".
- Semantic ProgramEditDraft parser lets the LLM understand messy language, but not mutate.
- Draft-vs-final guard blocks old command paths from contradicting semantic drafts.
- Visible domain verifier blocks "Done" unless the visible program changed.
- Strength/conditioning block executors and block-level target resolution were added.
- Empty sessions collapse after final content removal.
- Session display is derived from remaining visible content.

This improved many cases, but it also made the path complex. There are still many representations that can reinterpret the user's intent:

- `CoachTargetFrame`
- `ProgramEditDraft`
- pending clarification payloads
- legacy operation labels
- `ProgramEdit`
- target item guards
- block resolvers
- adjustment events
- visible verifier fingerprints
- Program tab/detail projection

The repeated live failure pattern was: the semantic draft understood the user correctly, then a later layer rebuilt, downgraded, or blocked the intent.

## New CoachRevisionProposal Snapshot/Diff/Override Architecture

The proposed pivot for one-off edits is:

```text
visible program snapshot + user message + pending context
-> LLM returns strict CoachRevisionProposal JSON
-> app validates schema
-> app computes old-vs-new visible diff
-> app validates the diff
-> app writes date-level override(s)
-> Program tab/detail render from override
-> visible verifier confirms projected result
-> coach replies Done only if verified
```

Core principle:

- The LLM can propose revised visible state.
- The LLM cannot write stores.
- The LLM cannot claim success.
- The LLM cannot bypass diff validation.
- The LLM cannot edit hidden program internals directly.

Stage 4A pieces now exist:

- `src/utils/coachRevisionProposal.ts`
  - `CoachRevisionProposal` schema
  - visible week/day snapshot serializer
  - pure diff builder
  - pure diff validator
  - protected ref checks
  - unknown ID checks
  - unrelated date checks
  - conservative reduction checks

- `src/utils/semanticCoachRevisionProposal.ts`
  - mockable semantic parser interface
  - schema parser/validator
  - diff validation wrapper
  - shadow diagnostics

- `src/utils/llmSemanticCoachRevisionProposalAdapter.ts`
  - client adapter to Supabase edge function
  - sends exact visible snapshot, schema, current context
  - logs endpoint/function name
  - returns raw JSON to be validated locally

- `supabase/functions/coach-revision-proposal/index.ts`
  - edge function exists locally
  - supports OpenAI or Anthropic via env
  - returns only parsed JSON
  - does not mutate or compose success replies

- `src/utils/coachRevisionOverrideWriter.ts`
  - writes date-level overrides from accepted revised visible days
  - rebuilds workout override from visible proposal
  - verifies projection matches accepted revision

- `src/utils/coachTurnController.ts`
  - dev-active `CoachRevisionProposal` path runs before semantic ProgramEditDraft
  - supports simple single-day one-off edits in dev-active mode:
    - remove strength while keeping conditioning
    - remove conditioning while keeping strength
    - remove whole session
    - conservative strength reduction
  - stores pending stale-date clarification with full revision proposal envelope
  - resumes pending revision by regenerating revised snapshot with original wording plus patched date

- `src/__tests__/coachRevisionProposalBehaviorMatrixTests.ts`
  - matrix covers messy wording, stale-date clarification, protected refs, unknown IDs, unrelated dates, malformed JSON, projection agreement, and no legacy fallback after revision path takes ownership.

## Dev Flags and Endpoint Notes

ProgramEditDraft semantic active mode:

```text
EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_MODE=active
EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_DEV_ACTIVE=1
```

CoachRevisionProposal active mode:

```text
EXPO_PUBLIC_COACH_REVISION_PROPOSAL_MODE=active
EXPO_PUBLIC_COACH_REVISION_PROPOSAL_DEV_ACTIVE=1
```

Both active modes are dev-gated in `src/config/env.ts`. Production should never resolve active mode.

The local repo contains:

```text
supabase/functions/coach-revision-proposal/index.ts
supabase/functions/coach-revision-proposal/deno.json
```

Potential known issue:

- The app or smoke test may still hit HTTP 404 if the remote Supabase edge function is not deployed or the client is pointed at the wrong project/base URL.
- Local adapter tests intentionally include a 404 safety case and assert it becomes invalid/no-mutation.
- Claude should verify local vs remote deployment separately before assuming app logic is wrong.

## Exact Failure Modes We Kept Seeing

The major live/simulator failures that motivated the pivot:

1. Correct semantic intent became wrong executable action.
   - User: "drop lower work Monday but keep the flush"
   - Intended: remove strength/lower work, preserve conditioning/flush.
   - Semantic draft correctly represented strength removal with conditioning protected.
   - Later layers sometimes converted it into conditioning removal or a generic item prompt.

2. Destination became source.
   - User added conditioning, then said "move it to Sunday".
   - Destination Sunday's recovery session was sometimes treated as the thing to move.

3. Block-level edits were treated like item-level edits.
   - User wanted to remove a strength block.
   - System asked "Which visible item should I change?" because child exercises were counted as ambiguous targets.

4. Pending clarification lost original intent.
   - User asked about a past Monday.
   - Coach asked "Do you mean next Monday?"
   - User said "yes".
   - The resumed flow sometimes rebuilt intent from "yes" or stale operation labels instead of preserving original semantic intent.

5. Coach claimed success without visible state matching.
   - Internal mutation removed a child block, but Program tab still showed stale parent/session shell.
   - This led to empty sessions or stale titles/details.

6. Legacy compatibility paths kept resurfacing.
   - Even after semantic parsing, later `ProgramEdit` or router fallback layers could reinterpret the request.

7. Endpoint/wiring confusion.
   - Dev-active semantic mode was enabled, but endpoint 404 meant the app silently fell back to old behavior unless diagnostics were checked.
   - The revision endpoint exists locally but may not be deployed remotely.

## Why Phrase Patches Are Unacceptable

Do not solve this by adding regexes for:

- "drop lower work"
- "bin the strength"
- "keep the flush"
- "next Monday"
- "yeah"
- any other single screenshot phrase

The product requires natural language. Users will say the same intent many ways. Patching phrases just moves the bug to the next wording.

The desired approach is:

- LLM understands language into strict typed JSON or revised visible state.
- Deterministic app code validates and applies.
- Visible program projection is the source of truth for success.
- Pending clarification preserves transaction state.
- Old fallback layers should not reinterpret a valid high-level semantic result.

## What Needs Auditing

Please audit:

1. Whether `CoachRevisionProposal` should become the primary path for one-off edits.
2. Whether `ProgramEditDraft` should remain only for:
   - recurring setup/schedule changes,
   - highly structured operations,
   - fallback compatibility,
   - legacy tests until migration completes.
3. Whether date-level overrides are the right persistence mechanism for one-off visible edits.
4. Whether the `CoachRevisionProposal` schema is sufficient.
5. Whether diff validation is strict enough:
   - protected refs,
   - unknown IDs,
   - unrelated dates,
   - conservative reductions,
   - whole session removal,
   - replacements,
   - added content policy.
6. Whether the override writer can safely rebuild `Workout` objects from visible snapshots.
7. Whether Program tab and detail screens truly render from the same projected visible model.
8. Whether pending clarification should store partial proposal, partial intent, or only regenerate from original user wording.
9. Whether remote edge function deployment/config is complete.
10. Whether old ProgramEdit/command paths can still steal ownership after a valid revision proposal.
11. How to handle broader requests:
    - unavailable next week,
    - can only train Mon/Wed/Fri,
    - moving sessions,
    - replacing team training with conditioning,
    - recurring setup changes.
12. What should be deleted or deprecated to reduce architecture complexity.

## What Claude Should Not Do

Do not:

- Implement code yet.
- Patch the latest live wording failure.
- Add regex phrase handlers.
- Add one-off branches for "Monday", "lower work", "flush", etc.
- Let the LLM mutate stores.
- Let the LLM claim success.
- Bypass diff validation.
- Remove existing working ProgramEdit functionality without a migration plan.
- Touch program generation or conditioning templates unless your architecture review explains why it is required.
- Assume the edge function is deployed just because it exists locally.

## Suggested Mental Model

Think of two distinct product categories:

### One-off visible edits

Examples:

- remove strength tomorrow but keep conditioning
- remove conditioning Monday
- remove whole session
- make tomorrow lighter
- replace tomorrow's team training with easy bike, if policy allows

Candidate owner:

```text
CoachRevisionProposal snapshot/diff/override path
```

### Program/setup/schedule changes

Examples:

- I am away next week
- can only train Mon/Wed/Fri now
- I can train Saturdays now
- move Thursday to Saturday every week
- rebuild setup availability

Candidate owner:

```text
ProgramEditDraft / setup transaction / generation pipeline, or a future week-level revision proposal with stricter policy
```

Please assess whether this split is right.

## Current Known Failing Behaviour

Before Stage 4A completion, live simulator failures included:

- "drop lower work Monday but keep the flush" followed by "yes" could end in:
  - wrong domain action,
  - generic "Which visible item should I change?",
  - executable edit mismatch,
  - or conditioning removal despite protected conditioning.

- "remove conditioning from Monday" followed by "yes" could hit old target-item guards.

- Semantic adapter endpoint failures could make the app look "dumb" because it fell back to deterministic/legacy behavior.

Current local test state after Stage 4A:

- The new Stage 4A behavior matrix passes.
- Live simulator has not yet been re-tested after Stage 4A-6 by design.
- Remote `coach-revision-proposal` endpoint deployment/config may still need verification.

## Files to Inspect First

Please inspect these first, in this order:

1. `src/utils/coachTurnController.ts`
   - controller order
   - pending clarification handling
   - revision proposal active path
   - ProgramEditDraft fallback order

2. `src/utils/coachRevisionProposal.ts`
   - schema
   - snapshot shape
   - diff builder
   - diff validator

3. `src/utils/semanticCoachRevisionProposal.ts`
   - parser contract
   - validation result shape
   - diagnostics

4. `src/utils/llmSemanticCoachRevisionProposalAdapter.ts`
   - prompt
   - context sent to edge function
   - endpoint behavior
   - raw JSON validation boundary

5. `src/utils/coachRevisionOverrideWriter.ts`
   - how revised visible state becomes date overrides
   - projection verification
   - unsupported add/replacement limitations

6. `src/store/pendingCoachClarifierStore.ts`
   - pending ProgramEditDraft envelope
   - pending CoachRevisionProposal envelope
   - semantic answer classification fields

7. `src/screens/coach/CoachScreen.tsx`
   - adapter construction
   - env flags
   - controller wiring

8. `src/config/env.ts`
   - dev-active gating
   - endpoint construction
   - production safety

9. `supabase/functions/coach-revision-proposal/index.ts`
   - provider choice
   - model env vars
   - request/response shape
   - JSON extraction

10. Old path for comparison:
    - `src/utils/coachProgramEditDraft.ts`
    - `src/utils/coachProgramEdit.ts`
    - `src/utils/applyAdjustmentEvents.ts`
    - `src/utils/coachVisibleDomainVerifier.ts`
    - `src/utils/visibleProgramProjection.ts`

11. Tests:
    - `src/__tests__/coachRevisionProposalBehaviorMatrixTests.ts`
    - `src/__tests__/coachRevisionProposalControllerTests.ts`
    - `src/__tests__/coachRevisionProposalTests.ts`
    - `src/__tests__/coachRevisionOverrideWriterTests.ts`
    - `src/__tests__/semanticCoachRevisionProposalTests.ts`
    - `src/__tests__/llmSemanticCoachRevisionProposalAdapterTests.ts`
    - `src/__tests__/coachProgramEditContractTests.ts`
    - `src/__tests__/coachPendingClarifierTests.ts`

## Tests to Run or Ask Me to Run

Start with:

```bash
git status --short
git log --oneline -30
npm run typecheck
npm run test:env-config
npm run test:coach-revision-proposal-behavior
./node_modules/.bin/sucrase-node src/__tests__/coachRevisionProposalTests.ts
./node_modules/.bin/sucrase-node src/__tests__/semanticCoachRevisionProposalTests.ts
./node_modules/.bin/sucrase-node src/__tests__/llmSemanticCoachRevisionProposalAdapterTests.ts
./node_modules/.bin/sucrase-node src/__tests__/coachRevisionOverrideWriterTests.ts
./node_modules/.bin/sucrase-node src/__tests__/coachRevisionProposalControllerTests.ts
```

Then compare old-path safety:

```bash
npm run test:coach-program-edit
npm run test:coach-command-router
npm run test:coach-pending-clarifier
npm run test:coach-truth-gate
npm run test:coach-live-send-context
npm run test:coach-reference-resolver
npm run test:coach-live-wiring
npm run test:coach-live-path-v2
```

For endpoint verification:

```bash
npm run smoke:coach-revision-proposal
```

Also verify remote deployment/config:

```bash
supabase functions list
supabase functions deploy coach-revision-proposal
```

Only do deployment after confirming project/ref/env/secrets with the user.

## Questions for Claude to Answer

Please answer these directly:

1. Is the snapshot/diff/override architecture simpler and safer than continuing to expand `ProgramEditDraft` for one-off edits?
2. Should `CoachRevisionProposal` become the primary path for all simple one-off visible edits?
3. What should stay in the old `ProgramEditDraft`/command path?
4. Is date-level override persistence the right write model for one-off edits?
5. Is the current `CoachRevisionProposal` schema expressive enough?
6. Are visible snapshots stable enough for the LLM to preserve IDs correctly?
7. Is the diff validator strong enough to protect against:
   - protected item removal,
   - unrelated dates,
   - unknown IDs,
   - hidden/internal object invention,
   - unsafe additions,
   - non-conservative reductions?
8. Does the override writer safely preserve workout semantics, or is it too lossy?
9. Does Program tab/detail rendering truly share the same projection source?
10. How should stale-date pending clarification work in the revision model?
11. Should pending clarification store full proposals, partial intents, or only original wording plus missing slot?
12. How should compound edits work in the revision model?
13. How should week-level/setup changes work?
14. What code can eventually be deleted or downgraded after the pivot?
15. What are the biggest risks if we turn dev-active revision path into default?
16. What is the smallest next implementation step?
17. What live simulator flows should be tested after your recommendations?

## Suggested First Response Format

Please respond in this structure:

1. **Architecture Diagnosis**
   - What is hard about the current pipeline.
   - Which layers compete for ownership.
   - What failure modes are structural.

2. **Recommended Architecture**
   - Whether to pivot to `CoachRevisionProposal`.
   - Which flows it should own.
   - Which flows old ProgramEdit should keep.

3. **Migration Plan**
   - Stage-by-stage plan.
   - Safety checks per stage.
   - What to keep/deprecate/delete.

4. **Code Risk Areas**
   - Specific files/functions.
   - Likely bugs.
   - Tests needed.

5. **Immediate Next Steps**
   - Top 3 to 5 actions.
   - Include endpoint/deployment verification if needed.

6. **What Not To Do**
   - Any traps to avoid.

7. **Test Plan**
   - Unit/integration/live simulator matrix.
   - Exact flows to verify.

8. **Open Questions**
   - Anything you need from the product owner before implementation.

## Extra Context For Claude

The most important product requirement is trust. If the coach says "Done", the Program tab and detail screen must show exactly the intended change. A safe clarification or refusal is much better than a confident wrong edit.

The second most important requirement is natural language. The athlete should not need to learn the system's internals. The architecture should let the LLM understand messy phrasing, but the app must remain the source of truth for validation, mutation, and success.

Please optimize for a small number of durable abstractions, not more phrase handlers.
