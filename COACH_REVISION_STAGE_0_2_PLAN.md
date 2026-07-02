# CoachRevisionProposal — Stage 0–2 Implementation Plan

Scope: finish the revision pipeline wiring, harden the validator, live-test. No moves/replacements/compound. No legacy fixes. No phrase patches. No deletions.

All line numbers verified against commit `4cf1c37` on 2026-07-02.

---

## 1. Stage 0 — Wiring / Deployment / Fail-Loud

### 0.1 Declare the function in `supabase/config.toml`

Append after the existing `[functions.*]` blocks (matches siblings — the app calls with the publishable key, not a JWT):

```toml
[functions.coach-revision-proposal]
verify_jwt = false
```

### 0.2 Verify project link and secrets (verify, don't assume)

```bash
supabase link --project-ref ryzoxwcijoqbguduonov
supabase secrets list --project-ref ryzoxwcijoqbguduonov
```

The function reads these env vars (`supabase/functions/coach-revision-proposal/index.ts:22-40,102-104`):

- Provider select: `COACH_LLM_PROVIDER` (optional; defaults to openai if `OPENAI_API_KEY` set, else anthropic)
- Key: `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`)
- Model (first match wins): `ANTHROPIC_COACH_REVISION_PROPOSAL_MODEL` → `ANTHROPIC_SEMANTIC_DRAFT_MODEL` → `ANTHROPIC_INTENT_MODEL` → default `claude-haiku-4-5-20251001` (OpenAI chain: `COACH_REVISION_PROPOSAL_LLM_MODEL` → `COACH_SEMANTIC_DRAFT_LLM_MODEL` → `COACH_INTENT_LLM_MODEL` → `COACH_LLM_FAST_MODEL`)

Pass criterion: the same key `coach-chat`/`coach-semantic-program-edit-draft` use is present. If those functions work in the app today, no new secrets are needed — the chain deliberately reuses them. Only set `ANTHROPIC_COACH_REVISION_PROPOSAL_MODEL` if you want a different model for this function.

### 0.3 Deploy and confirm

```bash
supabase functions deploy coach-revision-proposal --project-ref ryzoxwcijoqbguduonov
supabase functions list --project-ref ryzoxwcijoqbguduonov
```

Expect `coach-revision-proposal` listed with status ACTIVE alongside `coach-chat` etc.

### 0.4 Smoke test proves OPTIONS 204 + POST 200

Edit `scripts/smoke-coach-revision-proposal.ts`. In `main()` after `buildEndpoint` (line 131), insert a raw preflight + reachability check before the adapter flow:

```ts
const preflight = await fetch(endpoint, { method: 'OPTIONS' });
console.log('[coach-revision-smoke] OPTIONS status', preflight.status);
if (preflight.status !== 204) {
  throw new Error(`expected OPTIONS 204, got ${preflight.status} — function not deployed or wrong URL`);
}
```

The function already answers OPTIONS with 204 (`index.ts:76-78`), so a 404 here is unambiguous proof of a deployment/URL problem, independent of any LLM behavior. The existing adapter flow (lines 143-160) then proves POST 200 + schema-valid output end-to-end. Also log the POST outcome explicitly: in `LLMSemanticCoachRevisionProposalAdapter` the success path already logs raw JSON at debug; the smoke's `result.kind` check covers it.

Run:

```bash
npm run smoke:coach-revision-proposal
```

**Expected output before proceeding:**

```
[coach-revision-smoke] endpoint https://ryzoxwcijoqbguduonov.supabase.co/functions/v1/coach-revision-proposal
[coach-revision-smoke] functionName coach-revision-proposal
[coach-revision-smoke] OPTIONS status 204
[coach-revision-smoke] result revision        <- or needs_confirmation
[coach-revision-smoke] diagnostic { ... "validatorStatus": "valid" ... }
```

Any `adapter_failed` / `HTTP 404` / non-204 OPTIONS = stop, fix deployment, do not touch app code.

### 0.5 Fail loud in dev-active — no silent legacy fallback

Two real silent-fallback holes exist today; close both. A third case (endpoint failure) already dead-ends but with a misleading message; make it diagnostic.

**Hole A — adapter null in active mode falls through to legacy.**
`coachTurnController.ts:1327-1329`: `buildCoachRevisionProposalForController` returns `null` when the adapter is missing, and `coachTurnController.ts:3007` (`if (revisionResult && ...)`) then lets the turn continue into the semantic draft/legacy path. Fix in the controller (systemic, not per-callsite): when `revisionMode === 'active'` and `input.coachRevisionProposalAdapter` is null, do NOT fall through — `replyAndFinish` with route `coach-revision-proposal-misconfigured` and reply:
`"[dev] Coach revision mode is active but the endpoint adapter is missing (check EXPO_PUBLIC_SUPABASE_URL / deployment). No changes made."`
This can only occur in dev (active mode is `__DEV__`-gated in `env.ts:106-122`), so a dev-prefixed message is safe.

**Hole B — misconfigured env is only a silent log.**
`CoachScreen.tsx:151-154` builds the adapter only when `clientEnv.isReady`; `env.ts:179-181` yields an empty endpoint when the base URL is missing. Add to the existing dev log block (`CoachScreen.tsx:170-178`): if `coachRevisionProposalMode === 'active'` and (`!liveCoachRevisionProposalAdapter` or `!clientEnv.coachRevisionProposalEndpoint`), call `logger.error('[coach-revision-proposal] ACTIVE MODE MISCONFIGURED', {...})` — error level, not debug, so it's impossible to miss in Metro output. (Hole A is the behavioral backstop; this is the loud early warning.)

**Case C — endpoint 404/timeout/malformed replies with a misleading message.**
Today `adapter throws → semanticCoachRevisionProposal.ts:121-132 → kind 'invalid', reason 'adapter_failed' → controller line 3120-3124` replies *"I couldn't safely validate that revision"* — infra failure masquerading as a coach limitation (this is exactly failure mode 7 from the handoff, one layer deeper). Fix in the controller's `invalid` branch (line 3108): when `revisionResult.reason === 'adapter_failed'`, reply instead with
`"[dev] Coach revision endpoint failed (" + first issue + "). No changes made — check deployment/network."`
The adapter already embeds the status in the thrown error (`llmSemanticCoachRevisionProposalAdapter.ts:231`: `coach revision proposal endpoint HTTP 404`) and the timeout abort surfaces as an AbortError message, so `issues[0]` carries the distinguishing detail with no adapter changes needed. Keep `schema_validation_failed` / `diff_validation_failed` on the existing honest generic reply — those are legitimate "refused safely" outcomes.

**Guard test** (extend `src/__tests__/coachRevisionProposalControllerTests.ts`):
- active mode + null adapter → route `coach-revision-proposal-misconfigured`, no store mutation, semantic draft adapter never invoked;
- active mode + adapter throwing `HTTP 404` → route `coach-revision-proposal-invalid`, reply contains "endpoint failed", `legacyCalled: false`, no mutation.

### Stage 0 constraints honored

No coach wording changes outside the two new dev-diagnostic strings. No ProgramEditDraft edits. No phrase logic anywhere.

---

## 2. Stage 1 — Validator / Snapshot Hardening

All in `src/utils/coachRevisionProposal.ts` unless noted. Each fix = code + negative test.

### 1.1 Forged/invented IDs on adds — remove proposal self-authorization

`validateAddedRefs` lines 571-574 union `proposal.userIntent.allowedAddedSectionKinds` (LLM-controlled output!) into the authorization set. The proposal can currently grant itself permission to add. Fix: the authorization set is `args.policy?.allowedAddedSectionKinds ?? []` **only**. The proposal's own field may still be *read* as a confirmation-flow signal (line 588) but never as authorization.

Second bug in the same function, line 605: `if (parentAdded || addedSectionIds.size > 0) continue;` — if *any* section was added on that date, *all* added items on the date skip validation, including items injected into existing sections. Fix: drop `|| addedSectionIds.size > 0`; skip only items whose own parent section is in `addedSectionIds`.

Tests: proposal sets `userIntent.allowedAddedSectionKinds: ['conditioning']` with empty app policy and adds a section → `unknown_section_id`; proposal adds one new section AND injects a forged item into an existing section → forged item flagged `unknown_item_id`.

### 1.2 Null-after-non-null prescription fields

Two lines make silent nullification pass as "conservative":

- `isConservativeReduction` line 752: `if (!beforeRx || !afterRx) return true;` → change to: `if (!beforeRx) return true; if (!afterRx) return false;` (dropping the whole prescription is not a reduction).
- `nullableNumberReducedOrSame` line 760: `if (before === null || after === null) return true;` → change to: `if (before === null) return true; if (after === null) return false;`

Test: before `{sets:4, repsMin:8, repsMax:10}`, after `{sets:4, repsMin:null, repsMax:10}` → `non_conservative_reduction`.

### 1.3 Target dates outside the visible window

`validateCoachRevisionDiff` lines 348-352: `allowedDates` defaults to `proposal.scope.dates` — LLM-controlled, so the proposal defines its own boundary. The plumbing already exists: `buildSemanticCoachRevisionProposal` accepts `input.validationPolicy` (`semanticCoachRevisionProposal.ts:157,205`) — the controller just never passes it. Fix at the two controller callsites (`coachTurnController.ts:1334-1348` new-message, `:1371-1394` pending-resume):

```ts
validationPolicy: {
  allowedChangedDates: visibleWeek
    .map((d) => d.date)
    .filter((date) => date >= args.input.todayISO),
  allowedAddedSectionKinds: [],   // Stage 4A: adds disabled, app-side
},
```

This simultaneously closes date-bounding AND makes 1.1's app-side-only policy explicit at the callsite. Past dates stay excluded so the stale-date clarification flow (which patches the date and regenerates) is unaffected.

Test: proposal in scope/revisedDays for a date not in the snapshot week → `unrelated_day_changed`; proposal for a past visible date → `unrelated_day_changed`.

### 1.4 Unstable workout IDs / name-based fallback

`stableWorkoutId` lines 989-991 falls back to `workout:${date}:${normalisedName}` when `workout.id` is empty — a rename then changes identity mid-conversation. Minimal, sufficient now (do not over-build):

- Add `logger.warn('[coach-revision-snapshot] name_based_workout_id_fallback', { date, name })` inside the fallback branch, so live testing reveals whether real programs ever hit it.
- Tests: (a) workout with explicit `id` renamed between snapshots keeps its ID; (b) fallback branch produces deterministic output for same date+name.

If Stage 2 logs ever show the fallback firing on real data, guaranteeing `workout.id` at generation becomes a prerequisite before Stage 3 — but don't refactor generation speculatively.

### 1.5 Protected-ref signature weakness — defer, with rationale

`stableString` lines 1010-1023 (sorted-key JSON as the protected-ref signature, used at `validateProtectedRefs`) is weaker than a content hash, but a collision requires two items with identical titles, prescriptions, sources, and IDs *within the same day* — and protected-ref comparison is keyed by ref ID first. With adds/replacements disabled there is no attack surface for signature spoofing. **Defer to the Stage 3 (replacements) entry gate.** Recording it here so it's a listed precondition, not a forgotten one.

### 1.6 Endpoint failure matrix tests

Extend `src/__tests__/llmSemanticCoachRevisionProposalAdapterTests.ts` (mock `fetcher`) + `semanticCoachRevisionProposalTests.ts`, asserting all four end in `kind: 'invalid'`, no mutation, and a distinguishing `issues[0]`:

| Case | Mock | Expected |
|---|---|---|
| 404 | `fetcher` → `{status: 404}` | `adapter_failed`, issue contains `HTTP 404` |
| Timeout | `fetcher` that never resolves + `timeoutMs: 10` | `adapter_failed`, issue contains abort message |
| Malformed JSON | 200 + `{"kind":"revision"}` (missing keys) | `schema_validation_failed` |
| Prose-wrapped JSON | 200 + `"Sure! Here is..."` string body | `schema_validation_failed` |

(True prose-wrapping is stripped server-side by `extractFirstJsonObject` (`index.ts:70-73`); the client test covers the case where extraction fails or returns prose-as-JSON-string.)

---

## 3. Stage 2 — Live Go/No-Go Checklist

Preconditions: Stage 0 + 1 committed, all suites green, smoke test passing remotely.

Env (`.env`, dev build only):

```
EXPO_PUBLIC_COACH_REVISION_PROPOSAL_MODE=active
EXPO_PUBLIC_COACH_REVISION_PROPOSAL_DEV_ACTIVE=1
```

On app launch, confirm in Metro logs (`CoachScreen.tsx:170-178`): `resolvedMode: 'active'`, `adapterPresent: true`, correct endpoint. If you see `ACTIVE MODE MISCONFIGURED` — stop.

For every flow record: reply text, debug `route` (from `setLastCoachDebug`), Program tab state, day-detail state. **Run each flow 10× on fresh state.**

| # | Say | Pass = | Expected route |
|---|---|---|---|
| 1 | "drop the lower work Monday but keep the flush" | strength gone, conditioning intact, tab+detail agree | `coach-revision-proposal-applied` |
| 2 | "remove conditioning from Monday" → (if asked) "yes" | correct Monday, conditioning only; resume preserves intent | `...-stale-target-date` then `...-applied` |
| 3 | "bin tomorrow's session" | whole day rest, no empty shell | `coach-revision-proposal-applied` |
| 4 | "make tomorrow lighter" | sets/reps reduced, nothing removed, nothing nulled (check detail screen numbers) | `coach-revision-proposal-applied` |
| 5 | "change Monday" | clarifying question, zero mutation | `coach-revision-proposal-clarify` |
| 6 | Any edit with endpoint forced to 404 (temporarily point `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL` at a bad path) | explicit `[dev] ... endpoint failed` reply; **no** legacy edit; zero mutation | `coach-revision-proposal-invalid` |
| 7 | "remove Monday's session but keep the flush" | refusal or conditioning-preserving partial edit; NEVER full removal | `...-invalid` (protected_ref) or `...-applied` with conditioning intact |
| 8 | "I'm away next week" | honest decline, zero date overrides written | `coach-revision-proposal-unsupported-scope` or `...-clarify` |
| 9 (added) | "how's my week looking?" | normal conversational answer, revision path does not hijack | not a revision route |

Flow 9 rationale: in active mode `shouldAttemptCoachRevisionProposal` returns true for **every** message (`coachTurnController.ts:1285`), so conversational turns also hit the revision LLM. If flow 9 fails (chat gets "I think that is a program edit…"), the fix is a typed `not_an_edit` decline kind in the proposal schema — an LLM classification, not a phrase gate. Log it; don't fix mid-Stage-2.

**Pass bar (as agreed):** zero confident-wrong edits across all runs; refusals/clarifications acceptable; wrong "Done" = hard fail; any legacy mutation route (`route` not starting `coach-revision-proposal`) on flows 1–8 = hard fail. Also watch Metro for `name_based_workout_id_fallback` warnings (feeds the Stage 3 gate) and note per-turn latency vs your 5–8s production target.

Go = pass bar met → plan Stage 3 (moves, template-derived replacements, `not_an_edit`/`out_of_scope_setup` kinds).
No-go = repeated `unknown_section_id` / `unrelated_day_changed` / echo-drift failures → switch to visible-patch shape (see §5).

---

## 4. Disagreements With Your Answers

None material. Three refinements:

1. **Replacement policy (template-derived only)** — agreed, and note the validator currently can't enforce "template-derived": adds are authorized by section *kind*, not by template identity. Stage 1.1 closes self-authorization; true template-scoped adds need a `templateRef` field in the schema plus an app-side template registry check. That's Stage 3 design work — nothing now, but don't let anyone "enable adds" before it exists.
2. **OPTIONS 204** — kept as specified; it's a good deployment-vs-logic discriminator. One caveat: it proves routing/deployment, not secrets. Only the POST leg proves the key/model config, which is why the smoke does both.
3. **Offline refusal** — agreed and mostly free: with Stage 0's Hole A/C fixes, adapter failure in active mode always dead-ends with an honest no-mutation reply. The only residual is the message wording when offline (fetch fails) — it will read as endpoint failure, which is accurate enough for dev. A user-friendly offline message is a production-polish item, not Stage 0–2.

## 5. Full-State Echo vs Visible-Patch — Recommendation

**Keep full-state echo through Stage 2. Do not switch preemptively.** Reasons: it's what's built and matrix-tested; the diff validator's whole design assumes complete revised days; and Stage 2 exists precisely to measure the one risk (ID/copy fidelity) with real model traffic. Switching now would re-open schema, prompt, validator, and override writer with zero live evidence.

Concrete switch trigger after Stage 2: if >1 in 10 runs on any flow fails validation due to echo drift (`unknown_section_id`, `unrelated_day_changed`, unintended item changes on preserved sections), move to a patch shape — ops over visible IDs (`remove_section`, `reduce_item`, …), applied deterministically app-side to produce revised days, then **the same diff validator runs unchanged** on the result. That keeps every invariant and discards only the echo burden. It also cuts output tokens, which serves your 5–8s production target.

## 6. Files To Touch / Avoid

**Touch (only these):**

| Stage | File | Change |
|---|---|---|
| 0 | `supabase/config.toml` | add function block |
| 0 | `scripts/smoke-coach-revision-proposal.ts` | OPTIONS preflight |
| 0 | `src/utils/coachTurnController.ts` | Hole A dead-end; Case C invalid-reason reply (lines ~3007, ~3108-3124) |
| 0 | `src/screens/coach/CoachScreen.tsx` | error-level misconfig log (~170-178) |
| 0/1 | `src/__tests__/coachRevisionProposalControllerTests.ts` | guard tests |
| 1 | `src/utils/coachRevisionProposal.ts` | 1.1, 1.2, 1.4 |
| 1 | `src/utils/coachTurnController.ts` | 1.3 validationPolicy at both callsites |
| 1 | `src/__tests__/coachRevisionProposalTests.ts`, `semanticCoachRevisionProposalTests.ts`, `llmSemanticCoachRevisionProposalAdapterTests.ts` | negative + failure-matrix tests |

**Avoid (do not touch):** `coachProgramEditDraft.ts`, `semanticProgramEditDraft.ts`, `llmSemanticProgramEditDraftAdapter.ts`, `coachProgramEdit.ts`, `coachCommandRouter.ts`, `applyAdjustmentEvents.ts`, `coachVisibleDomainVerifier.ts`, `coachTargetFrame.ts`, `coachReferenceResolver.ts`, `visibleProgramProjection.ts`/`visibleProgramReadModel.ts`, `pendingCoachClarifierStore.ts`, `coachRevisionOverrideWriter.ts` (its add-limitation is correct for this stage), the edge function (works as-is; server-side changes only if smoke fails), all program/home screens, generation, conditioning templates.

## 7. Commit Boundaries & Messages

Each commit: typecheck + affected suites green before committing.

Stage 0 (3 commits):

```
1. Declare coach-revision-proposal in supabase function config     [config.toml]
2. Prove remote revision endpoint reachability in smoke test       [smoke script]
3. Fail loud on revision endpoint misconfig and transport errors   [controller + CoachScreen + controller tests]
```

Deployment itself (0.2/0.3) is not a commit — record ref + deploy output in your notes.

Stage 1 (4 commits):

```
4. Restrict revision add authorization to app-side policy          [1.1 + tests]
5. Reject prescription nullification in conservative reductions    [1.2 + tests]
6. Bound revision changed dates to visible window policy           [1.3 + tests]
7. Add revision endpoint failure matrix and id-fallback warning    [1.4 + 1.6 tests]
```

Stage 2 produces no commits — only a written results log (flow × 10 runs × route/outcome) checked into `docs/` or your notes if you want it versioned.

## 8. Terminal Commands (in order)

```bash
# Stage 0
git status --short                      # expect clean (plus plan/handoff docs)
supabase link --project-ref ryzoxwcijoqbguduonov
supabase secrets list --project-ref ryzoxwcijoqbguduonov
supabase functions deploy coach-revision-proposal --project-ref ryzoxwcijoqbguduonov
supabase functions list --project-ref ryzoxwcijoqbguduonov
npm run smoke:coach-revision-proposal   # after commit 2
npm run typecheck
./node_modules/.bin/sucrase-node src/__tests__/coachRevisionProposalControllerTests.ts   # after commit 3
npm run test:env-config

# Stage 1 (after each commit; full sweep at end)
npm run typecheck
./node_modules/.bin/sucrase-node src/__tests__/coachRevisionProposalTests.ts
./node_modules/.bin/sucrase-node src/__tests__/semanticCoachRevisionProposalTests.ts
./node_modules/.bin/sucrase-node src/__tests__/llmSemanticCoachRevisionProposalAdapterTests.ts
./node_modules/.bin/sucrase-node src/__tests__/coachRevisionOverrideWriterTests.ts
./node_modules/.bin/sucrase-node src/__tests__/coachRevisionProposalControllerTests.ts
npm run test:coach-revision-proposal-behavior

# Old-path regression sweep (must stay green — proves no legacy behavior changed)
npm run test:coach-program-edit
npm run test:coach-command-router
npm run test:coach-pending-clarifier
npm run test:coach-truth-gate
npm run test:coach-live-send-context

# Stage 2 gate
npm run smoke:coach-revision-proposal   # one final remote proof before simulator
```

## 9. Expected Output Before Testing the Coach

Before opening the simulator, all of the following, in this order:

1. `supabase functions list` shows `coach-revision-proposal` ACTIVE.
2. Smoke test prints: endpoint URL containing `ryzoxwcijoqbguduonov`, `OPTIONS status 204`, `result revision` (or `needs_confirmation`), diagnostic with `"validatorStatus": "valid"` — exit code 0.
3. `npm run typecheck` exits 0.
4. Behavior matrix: `Pass: 34+` (34 existing + new rows), `Fail: 0`; all sucrase suites exit 0; old-path suites at their baselines (347 / 599 / 153 / 58 / 40) or higher, `Fail: 0` everywhere.
5. App launch (dev, flags on) Metro shows the CoachScreen revision log with `resolvedMode: 'active'`, `adapterPresent: true`, endpoint printed — and **no** `ACTIVE MODE MISCONFIGURED` error.

Only then start the Stage 2 table.
