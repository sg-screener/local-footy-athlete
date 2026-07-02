# AI Coach Architecture Review

Date: 2026-07-02. Audited at commit `4cf1c37` (clean tree). Verified locally: `tsc --noEmit` pass, revision-proposal behavior matrix 34/34, truth gate 58/58, env-config 52/52.

---

## 1. Architecture Diagnosis

**The verdict: pivot to CoachRevisionProposal. The old path's failures are structural, not bug-by-bug.**

### Why the old path can't be fixed incrementally

A single user turn in the old path flows through roughly **15 distinct representations of intent** (TargetFrame → deterministic draft → semantic draft → pending clarification payload → operation labels → ProgramEdit → target-item guards → block resolvers → adjustment events → verifier fingerprints → projection). Intent is **rebuilt rather than passed through at ~8 points**, notably:

- Semantic draft → ProgramEdit finalisation (`coachTurnController.ts` ~line 3186): correct semantic understanding is re-derived into an executable form by deterministic code that doesn't share the semantic model.
- Pending clarification resume (~lines 2550–2700): "yes" is classified, then intent is re-derived deterministically from stored labels — the semantic adapter is not re-run. This is the direct cause of failure modes 1 and 4 in the handoff.
- Router fallback (~line 3357): legacy command routing can still re-route.

Every layer added to guard the previous layer (draft guard, visible verifier, block resolvers) added *another* representation that could disagree. That's why each fix moved the bug rather than removing it. The failure pattern "semantic draft understood correctly, later layer downgraded it" is a property of the topology, not of any one file.

### Which layers compete for ownership

`coachCommandRouter.ts` (~32% phrase-specific by volume) and parts of `coachProgramEdit.ts` (~15% phrase-specific) are the main reinterpretation risks. `coachTurnController.ts` itself is well-abstracted (<1% phrase-specific) — the orchestrator is not the problem; the number of executors under it is.

### Why the new path is structurally better

CoachRevisionProposal collapses intent to **one representation**: the visible day snapshot. The same shape is the LLM's input, its output, the diff target, the validation target, and the verification target. There is nothing downstream that can rebuild intent, because there is no second representation to rebuild into. This is the "small number of durable abstractions" the handoff asks for.

### What's genuinely solid already

- Program tab and day detail **do** share a single projection (`projectVisibleDay()`), verified across `src/screens/program/` and `src/screens/home/`. Success verification against projection is meaningful.
- Env gating is production-safe: dev-active modes are behind a compile-time `__DEV__` AND-gate in `src/config/env.ts`. Production cannot resolve active mode.
- The behavior matrix tests assert no legacy fallback after the revision path takes ownership — the ownership latch exists and is tested.
- Override writer and adjustment events don't conflict: both write through `setManualOverride()` with last-writer-wins; separate paths, same store.

---

## 2. Recommended Architecture

### CoachRevisionProposal should own (target state)

All **one-off visible edits** within the visible window:

- remove strength/conditioning/whole session (already supported)
- conservative reductions ("make tomorrow lighter") (already supported)
- moves within the visible week ("move Thursday to Saturday", once)
- replacements per policy ("swap team training for conditioning tomorrow")
- compound single-message edits touching multiple days in the visible week

### ProgramEditDraft / setup pipeline should keep (permanently, not just during migration)

**Program-shape changes** — anything that alters generation inputs rather than visible days:

- "I'm away next week" (availability window)
- "Can only train Mon/Wed/Fri now" (recurring availability)
- "Move Thursday to Saturday every week" (recurring schedule)
- setup/equipment/goal changes that trigger regeneration

The handoff's two-category split is correct, with one refinement: the boundary test is **"does this change generation inputs, or does it change rendered days?"** — not "is this one message or recurring?" A week of date-level overrides is the wrong persistence for "away next week"; that should adjust availability and regenerate, otherwise the program's progression logic never learns the athlete was away.

### Routing between the two

Add a single upstream classification — one-off-visible vs program-shape — made by the LLM as part of the revision proposal call (a `kind: 'out_of_scope_setup'` response), not by regex. The revision path declines with a typed reason; the controller routes to the setup pipeline. Never let both paths process the same turn.

### Answers to the 17 handoff questions (condensed)

1. **Simpler and safer?** Yes — one representation vs fifteen; validation against rendered truth.
2. **Primary path for one-off edits?** Yes, after the hardening in §4.
3. **What stays legacy?** Setup/availability/recurring + generation pipeline. The command router should shrink to non-mutating commands only.
4. **Date-level overrides right?** Yes for one-off edits. Wrong for multi-week absence/availability (regenerate instead).
5. **Schema expressive enough?** For current scope yes; gaps: no new-workout creation, no exercise metadata beyond sets/reps/intensity, no cross-week ops, no block-internal edits. Acceptable for Stage 4; extend deliberately, not preemptively.
6. **Snapshot IDs stable?** Mostly. Risk: `stableWorkoutId` falls back to `workout:${date}:${name}` when `workout.id` is missing — a rename changes the ID mid-conversation. Guarantee real IDs everywhere (see §4).
7. **Diff validator strong enough?** Good foundation, four gaps to close (§4).
8. **Override writer lossy?** Yes, moderately: exercise order not restored, restSeconds untouched, block flavour dropped in conditioning-only case, durationMinutes never applied. Fine for removals/reductions; must be fixed before adds/replacements ship.
9. **Shared projection?** Verified yes.
10/11. **Pending clarification?** Store **original wording + full snapshot envelope + the missing slot only**; on resume, re-run the semantic adapter with original wording plus patched slot. This is what the Stage 4A path already does — it is the right design and the single biggest lesson from the old path's failures. Never store derived operation labels as the resume source.
12. **Compound edits?** Naturally supported — a proposal can revise multiple days in scope. Keep validator per-day; add cross-day conservation checks when moves land.
13. **Week-level/setup?** Route out to setup pipeline (see boundary test above). A "week-level revision proposal" is only worth building for within-week rearrangement, not for availability.
14. **Deletable eventually?** See migration Stage 5.
15. **Biggest risks?** §6 of the migration plan / Code Risk Areas.
16. **Smallest next step?** Deployment + fail-loud wiring (Stage 0 below). Not more schema work.
17. **Live flows?** §7 Test Plan.

---

## 3. Migration Plan

### Stage 0 — Fix the wiring (before any more architecture work)

The most likely current failure isn't logic, it's plumbing:

- `coach-revision-proposal` is **not declared in `supabase/config.toml`** — local serve won't expose it and it signals the remote deploy was never completed. Add it, then `supabase functions list` / `deploy` (confirm project ref + secrets first).
- Endpoint construction resolves to **empty string** if `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL` and `EXPO_PUBLIC_SUPABASE_URL` are both unset → silent adapter failure → silent legacy fallback → "the app looks dumb." Make this **fail loud in dev**: throw or surface a visible diagnostic banner when a dev-active mode is on but the endpoint is unresolvable or returns 404. This one change eliminates handoff failure mode 7 permanently.
- Run `npm run smoke:coach-revision-proposal` against the deployed function.

*Safety check: smoke test passes remotely; dev build shows explicit error (not fallback) on forced 404.*

### Stage 1 — Harden the validator and snapshot contract

Close the four validator gaps (§4) and pin the ID contract:

- Reject added items whose IDs don't originate from a known source when `allowedAddedSectionKinds` is non-empty (ID-invention gap).
- Treat null-after-non-null prescription fields as violations, not "unchanged".
- Bound `targetDates` to the visible window.
- Ensure `workout.id` is always populated so the name-based ID fallback is dead code; add a test that renaming a workout does not change its snapshot ID.

*Safety check: new negative tests in the behavior matrix; all existing suites still green.*

### Stage 2 — Live-simulator the current dev-active scope

Before adding capabilities, verify the four supported edits end-to-end in the simulator with the real LLM (§7 flow list). This is the pivot's go/no-go gate: it tests the one assumption local tests can't — **whether the model reliably echoes snapshot IDs and full revised state**. If it can't, you need retrieval-style output (IDs + ops) rather than full-state echo, and it's much cheaper to learn that now.

*Safety check: ≥ 9/10 clean runs per flow; every failure is a validated rejection + clarification, never a wrong edit.*

### Stage 3 — Expand revision scope

In order: within-week move → replacement-per-policy → visible-week compound. Each addition = schema/validator extension + behavior matrix rows + override-writer support (fix the lossiness items before adds/replacements). Add the `out_of_scope_setup` decline so availability requests route cleanly.

### Stage 4 — Flip default for one-off edits (still dev, then prod flag)

Revision path becomes the primary one-off owner; semantic ProgramEditDraft becomes fallback **only** when the revision path declines with a typed reason. Legacy router can no longer receive one-off mutation turns. Keep a kill switch env flag.

### Stage 5 — Deprecate and delete

Once Stage 4 is stable in prod:

- Delete: phrase-specific branches of `coachCommandRouter.ts` (~1/3 of 3,408 lines), one-off executors in `coachProgramEdit.ts` (block executors, target-item prompts), `coachVisibleDomainVerifier` fingerprints (superseded by projection verification), semantic ProgramEditDraft one-off path + its adapter + edge function.
- Keep: `coachTurnController` (thinner), TargetFrame/reference resolution (still useful as LLM context), setup transaction pipeline, adjustment events (non-coach uses), projection.
- Downgrade: ProgramEditDraft to setup-changes-only; rename accordingly so nobody adds one-off logic back.

Do not delete anything before Stage 4 is stable — the handoff is right that working functionality needs a migration path.

---

## 4. Code Risk Areas

**Validator gaps** (`src/utils/coachRevisionProposal.ts`):

1. **ID invention on adds** (~lines 576–596): when `allowedAddedSectionKinds` is non-empty, only the *kind* is checked — the LLM can fabricate section/item IDs. Low risk today (adds mostly disallowed), blocking for Stage 3.
2. **Null prescription pass-through** (~752–756): `isConservativeReduction` returns true when either prescription is missing, so `{sets:5, repsMin:null}` after `{sets:5, repsMin:8}` silently nullifies reps.
3. **No date-validity bound** (~348–352): `allowedDates` checks scope membership only, not that dates fall in the visible window.
4. **Signature weakness** (~1010–1023): protected-ref signatures are sorted-key JSON, collision-prone for similar items; content hash would be stronger.

**Override writer lossiness** (`src/utils/coachRevisionOverrideWriter.ts`): exercise order follows filter iteration not source order (~211–221); `restSeconds` never carried (snapshot omits it); conditioning-only case clears `conditioningFlavour/Category` (~244–253); `durationMinutes` captured but never applied. Acceptable for remove/reduce; fix before add/replace.

**ID stability** (`coachRevisionProposal.ts` ~989–991): name+date fallback ID. Tests all use explicit IDs, so the fragile path is untested.

**Edge function** (`supabase/functions/coach-revision-proposal/index.ts`): no JSON-mode/structured-output enforcement — schema passed as prose; first-`{...}` regex extraction (~162); no server-side schema validation (client-only — fine given client is the trust boundary, but wasted round trips on garbage); no rate limiting.

**Resume-rebuild bug (legacy)** (`coachTurnController.ts` ~2550–2700): the old pending-clarifier path re-derives from labels instead of re-running semantics. Don't fix it — migrate away from it; it's Stage 5 deletion material.

**Tests needed**: forged-ID adds, null-field reductions, out-of-window dates, workout-rename ID stability, endpoint 404 → loud dev error (not silent fallback), timeout path, first-JSON-extraction with prose-wrapped output.

---

## 5. Immediate Next Steps

1. Add `coach-revision-proposal` to `supabase/config.toml`; confirm project ref/secrets with you; deploy; run the smoke test remotely.
2. Make dev-active + unresolvable/404 endpoint **fail loud** (diagnostic banner/throw) instead of silently falling back.
3. Close validator gaps 1–3 and add the negative tests (small, pure-function changes).
4. Live-simulator the four supported flows (Stage 2 gate) and record pass rates.
5. Decide go/no-go on full-state echo vs ops-based output from the Stage 2 results.

---

## 6. What Not To Do

- Don't expand the schema (moves/adds/weeks) before Stage 2 proves the LLM handles the current scope live. Schema breadth without live validation is how the old path grew.
- Don't fix the legacy resume-rebuild bug or add capabilities to `coachProgramEdit` — every improvement to the old path extends its life and adds a 16th representation.
- Don't persist "away next week" as seven date overrides — route it to availability/regeneration.
- Don't let the edge function validate or mutate; the client-side validation boundary is correct as designed.
- Don't delete legacy paths until Stage 4 is stable; don't keep them past Stage 5.
- Don't add regex phrase handling anywhere, including in the router-vs-revision classification — that decision belongs to the LLM's typed decline.

---

## 7. Test Plan

**Unit (existing + new)**: current suites stay green each stage; add the negative tests from §4.

**Integration**: behavior matrix rows per new capability (move, replace, compound); resume matrix (stale date, "yes"/"yeah"/"that one", topic change mid-clarification, expired 10-min TTL); endpoint failure matrix (404, timeout, malformed JSON, prose-wrapped JSON) each asserting *no mutation + honest reply*.

**Live simulator matrix** (each 10×, real LLM, dev-active):

| # | Flow | Must verify |
|---|------|-------------|
| 1 | "drop the lower work Monday but keep the flush" | strength gone, conditioning intact, both screens match |
| 2 | "remove conditioning from Monday" → "yes" (stale date) | resume preserves intent; correct Monday edited |
| 3 | "bin tomorrow's session" | whole day rest; no empty shell; detail matches |
| 4 | "make tomorrow lighter" | sets/reps reduced, nothing removed, nothing nulled |
| 5 | Ambiguous ("change Monday") | clarification asked, no mutation |
| 6 | Endpoint forced 404 | loud dev diagnostic, no silent legacy fallback |
| 7 | Protected-ref trap ("remove Monday's session but keep the flush") | refusal or partial edit preserving conditioning — never full removal |
| 8 | Out-of-scope ("I'm away next week") | typed decline → setup path (or honest "can't yet"), no override spam |

Pass bar: zero confident-wrong edits. Clarifications and refusals are passes; wrong "Done" is the only hard fail.

---

## 8. Open Questions for You

1. **Supabase project**: which project ref should `coach-revision-proposal` deploy to, and are `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` + model env vars set as function secrets?
2. **Replacement policy**: when a user swaps team training for conditioning, what may the coach add — only template-derived sessions, or free-form? This determines the `allowedAddedSectionKinds` design in Stage 3.
3. **Availability changes**: does the setup/regeneration pipeline already handle "away next week" end-to-end, or is that flow itself unfinished? Determines whether Stage 3's `out_of_scope_setup` decline routes somewhere real or to an honest "can't do that yet" reply.
4. **Model budget**: full-snapshot echo costs more tokens per turn than ops-output. Any latency/cost ceiling per coach turn?
5. **Offline/poor connectivity**: should the coach refuse edits offline (recommended — consistent with "no confident wrong edits"), or attempt deterministic fallback?
