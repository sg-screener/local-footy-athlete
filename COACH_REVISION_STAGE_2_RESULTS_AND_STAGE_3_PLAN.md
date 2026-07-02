# CoachRevisionProposal — Stage 2 Results & Stage 3 Plan

Date: 2026-07-02. Verdict: **Stage 2 GO.** Full-state snapshot echo is validated live at app scale on the production-class model. Zero hard fails (wrong "Done" / silent legacy mutation) across the entire live testing day.

---

## 1. Stage 2 Results

Environment: dev-active (`__DEV__`-gated), Supabase `ryzoxwcijoqbguduonov`, edge fn `coach-revision-proposal` ACTIVE, served by **openai / gpt-5.5** (secret `COACH_REVISION_PROPOSAL_LLM_MODEL`, verified via `served_by` header→log).

| # | Flow | Result | Notes |
|---|------|--------|-------|
| 1 | "drop the lower work Monday but keep the flush" | ✅ PASS | Incl. stale-date clarify → "Yes" resume; strength removed, flush preserved, verified Done |
| 2 | "remove conditioning from Monday" | ✅ PASS | Incl. sequential edit on already-overridden day → rest day via shell normalization |
| 3 | "Bin tomorrows session" | ✅ PASS | Correct date (2026-07-03) first try at 0.96 on gpt-5.5 |
| 4 | "Make today lighter" | ✅ PASS | Whole-day conservative reduce; verified on detail screen (sets reduced, weights/content intact) |
| 5 | Ambiguous "Change Tuesday" → "Only strength" | ◐ MECHANICS PASS | Multi-turn transaction resumed correctly (original wording + answer carried); validator refused safely. Conversion gap on team-training days → Stage 3A |
| 6 | Endpoint failure (404/502/timeout) | ✅ PASS | Fail-loud dev reply, zero mutation, zero legacy fallback |
| 7 | "Remove Mondays session but keep the flush" (protected trap) | ✅ PASS | Partial edit preserving conditioning — never full removal |
| 8 | "remove Monday conditioning every week" (recurring) | ✅ SAFE | Honest refusal (no_visible_diff). Proper routing → Stage 3B |
| 8b | "I'm away next week" → "Clear them" | ✅ SAFE + notable | Model asked a good coaching question, multi-turn resume produced a VALIDATOR-PASSING whole-week clear; the single-day whitelist refused — correctly, per the "away = availability change, not 7 date overrides" decision. Stage 3B must catch this shape and route to setup with a better message |
| 9 | "How's my week looking next week?" (conversation) | ✅ PASS | `not_an_edit` at 0.95 → released to coach-chat → high-quality answer reflecting applied edits |

**Pass bar:** zero confident-wrong edits — met. Every failure mode observed all day ended in a refusal, clarification, or dev diagnostic; the visible program was never wrongly mutated. The legacy sanitizer caught the one leaked legacy reply (exception path, since boundary-fixed) — layered defenses held.

### Fixes landed during Stage 2 (each with a regression test that mimics real model misbehavior)

| Commit | Fix (failure class killed) |
|---|---|
| `10949e1..1383b88` | Stage 0: config.toml declaration, smoke OPTIONS/POST proof, fail-loud on misconfig/transport (no silent legacy fallback) |
| `5528998..e5a487a` | Stage 1: app-side-only add authorization, prescription-nullification rejection, date bounds (diff ⊆ scope ⊆ snapshot), endpoint failure matrix |
| `3f54225` | Clarify results become pending transactions (accumulated Q&A, 3-round cap) — killed the context-reset loop |
| `664ab0d` | Deterministic dateGuide in context; clarify-restraint prompt rules |
| `fa754f6`/`c5dd0de` | Output token budget 3200→8000 (env-tunable), named truncation errors, app-scale smoke scenario |
| `7104148` | Writer verifies the change CONTRACT (identity+prescriptions), not byte-identical LLM echo |
| `0a46bdd` | Parse canonicalization: empty shells → workout null (one shape per meaning) |
| `bc509f3` | Protected refs re-derived when resume changes target date (refs are per-snapshot bindings) |
| `3e87fd0` | No-legacy-on-exception boundary; throw-proof diagnostics |
| `b6a653a` | Confidence-anchor prompt fix; function-scoped provider override knob |
| `1a59e4a` | Global conservative invariant for reduce (any domain) → whole-day "make it lighter"; adapter timeout 12s→45s |
| `5715331` | Immediate send feedback (bubble + spinner before network) |
| `6508f07` | Typed `not_an_edit` decline releases conversation to coach-chat |

### Known gaps (logged, deliberately not patched)

1. **Team-training day representation** (flow 5): "only strength" on a combined Team Training + lift day fails `target_domain_unchanged` — the team-training portion appears not to project as a removable session-kind section. → Stage 3A.
2. **Recurring/availability requests** get generic refusals or conversational answers instead of routed setup changes. → Stage 3B.
3. Intent label vs diff-shape mismatches (model says `reduce`, diff removes) pass when harmless but occasionally refuse legitimate edits; revisit label-free validation once 3A lands.
4. Latency: turns run ~8–15s on gpt-5.5 vs 5–8s production target. → Stage 3E.
5. `name_based_workout_id_fallback` warning has never fired live — ID contract holding; keep watching.

### Autonomous consistency pass (2026-07-02, Claude driving the Simulator)

- "Remove the bike on Monday": first exposed the dev whitelist rejecting a validator-approved diff over label synonyms (remove+conditioning+whole_session). Fixed structurally — support is now single-day + no-adds, labels ignored (`9c20682`) — then re-verified live: applied, Monday renders Rest.
- "Make Thursday lighter": applied to 2026-07-09. Note: asked ON a Thursday, bare "Thursday" resolved to next week — defensible.
- "Bin Fridays session" ×3: run 1 removed NEXT Friday (2026-07-10) instead of tomorrow — mis-resolved bare weekday, honestly reported, target wrong. Added nearest-upcoming tie-break to the date guide (`ac9483e`); run 3 then targeted 2026-07-03 correctly but refused with no_visible_diff. **Open finding → Stage 3A family: current-week optional-tier day (Fri 07-03 Gunshow) appears not to survive into the coach snapshot the way next week's identical session does.** Safety held in all runs (refusals, no wrong mutation beyond the transparent 07-10 removal).
- Invalid diagnostics now include `invalidProposalDates` so refusals name their target (`ac9483e`).

---

## 2. Stage 3 Plan (ordered)

Rules unchanged: no phrase patches, no legacy deletions (that's Stage 4/5), every fix systemic with a misbehaving-mock regression test, live verify per workstream before the next.

### 3A — Team-training/session snapshot representation — **DELIVERED 2026-07-02**

Root cause was two layers of the same gap: the read model only synthesizes a
session item on empty days, and the snapshot builder only emitted session
sections on empty days — so a combined day's team-training commitment had no
removable representation. Fixed in the snapshot layer only (Program tab
untouched): combined team days now expose a session-kind section whose item id
is the workout id, so post-edit pure-day projections round-trip
(`bb2bb44`). Writer gained the session-only survivor direction; Done replies
now describe session removals and the actual surviving sections
(`0685c85`, `743469d`). Protected-ref resolution is finest-granularity-first —
coarse-first refused a correct edit live when the model protected the team
item whose id equals the workout id (`208d87d`).

Live gate (Claude-driven): "Change today to only the strength work" → Done,
today renders "Upper Push Strength", team gone, lifts intact. "Drop the
lifting on Tuesday but keep the team training" → refused once on the ref
collision, fixed, then Done — Tuesday renders "Team Training" only. Optional-
tier snapshot presence locked in as regression [10d] (the earlier Friday
refusal was model echo variance; the refusal was safe).

*(original 3A plan for reference below)*

- Reproduce in harness: seed a combined "Team Training + Upper Pull" workout via the real projection; snapshot it; assert the team-training portion appears as a `session`-kind section with a stable id. Expected to fail — that failure defines the work.
- Fix in the snapshot builder/read model so combined days expose both sections; override writer learns to drop the team-training portion while keeping strength (mirror of the existing keep-flush path).
- Live gate: "Change Tuesday" → "Only strength" applies; "remove team training tomorrow" applies; protected-trap variant on a team day.

### 3B — `out_of_scope_setup` typed decline + routing — **DELIVERED 2026-07-02**

Pipeline audit found the setup path largely WORKING end-to-end
(`programSetupEditFromMessage` → profile patch → regenerate → verify → store
writes, progress UI): MWF-style day replacement, recurring moves, frequency,
time limits all implemented; "away next week" enters its own date-clarify
loop. So routing is a typed RELEASE (like not_an_edit): the revision path
declines with `out_of_scope_setup` {reason, detectedChange} and the
deterministic setup interpreter downstream owns the turn (`fcc0ba2`).
Mid-transaction setup pivots close the one-off transaction with an honest
redirect.

Live gate: "I can only train Mon Wed and Fri now" → typed release at 0.95 →
full regeneration → honest Done; "I'm away next week" → release → setup's own
"What dates are you away?" → "never mind" cancels cleanly with no changes.

**Flagged for product judgment (generation-engine, out of pivot scope): the
MWF rebuild still pairs core lifts with Tue/Thu team sessions rather than
moving gym work onto Mon/Wed/Fri, and the setup pipeline's own rebuild
verifier accepted that. Pre-existing engine semantics — decide whether
"training days" should constrain lifting placement on combined team days.**

*(original 3B plan for reference below)*

- Schema: sibling of `not_an_edit` (`kind: 'out_of_scope_setup'`, reason, detectedChange summary).
- Controller: route to the setup/schedule transaction pipeline when it can handle the request; otherwise honest "I can't change your recurring schedule yet — I can edit specific days."
- Evidence from Stage 2 (flow 8b): the model will happily produce a validator-passing whole-week clear for "I'm away next week" — the single-day whitelist is currently the only thing enforcing the "availability ≠ date overrides" decision. 3B must intercept this shape UPSTREAM (typed decline or scope classification) rather than relying on the whitelist's generic dev message, and decide explicitly whether visible-week one-off clears (e.g. "clear this week") are ever legitimate override material vs always setup.
- Audit the setup pipeline first (it was "not guaranteed complete" — verify before routing into it).
- Live gate: "remove Monday conditioning every week", "I'm away next week", "can only train Mon/Wed/Fri" all get useful outcomes.

### 3C — Within-week moves — **DELIVERED 2026-07-02 (v1: whole-day onto rest days)**

Conservation invariant in the validator (`validateMoveConservation`):
everything leaving the source must arrive at the destination byte-identical
(same item ids + signatures), nothing invented, nothing modified in flight,
no mixed gain/lose days (swaps unsupported), destination must have been rest
(v1 — merging needs writer row-transplants). Moves bypass the generic adds
policy because conservation IS their add authorization. Writer: two-phase
all-or-nothing apply (fixes latent partial-write class for ALL multi-day
proposals) + donor-sourced destination builds with date-correct dayOfWeek
(`50a8ab9`). Whitelist judges moves structurally (2 dates/days); Done
composer has real move wording; prompt carries the destination-vs-source
trap rule and the occupied-destination clarify rule.

Live gate: "Remove Wednesdays session" → rest; "Move Fridays session to
Wednesday" → "Done. I moved Gunshow from 2026-07-03 to 2026-07-08", board
verified (source Rest, destination Gunshow, next week's own Friday Gunshow
untouched); trap "actually can you move it to Sunday instead" → clarify
naming Sunday's Recovery and the occupied-destination rule, zero mutation —
the handoff's destination-became-source failure is structurally dead.

v2 backlog: merge-moves onto occupied days (row transplant), swaps.

*(original 3C plan for reference below)*

- Schema already has `move` intent; add validator cross-day conservation (content removed from source must appear at destination; destination's protected content preserved) and two-day override writes with atomic verify (both project back or neither writes).
- Live gate: "move Thursday to Saturday" (once), destination-vs-source trap from the original handoff ("move it to Sunday").

### 3D — Template-derived replacements — **DELIVERED 2026-07-02**

Entry gate first: canonical deep-sorted signatures replaced the weak
stableString (`48309b7` area). Template registry
(`coachRevisionTemplates.ts`): three approved easy-conditioning templates
whose advertised snapshots are DERIVED from projecting their own built
workouts — round-trip by construction. Authorization is byte-exact body-
signature match against app policy; the model cannot alter template content.
Confirmation is a real transaction: needs_confirmation stores the FULL
validated proposal, "yes" revalidates against current state and applies it
directly (no regeneration — confirm applies in ~2s), "no" cancels.
Replace validation is STRUCTURAL (something template-added, something
replaced) — the fifth and final kill of the label-vs-diff class; the
confirmation gate is the human check on replacement semantics. Writer
materializes registry workouts; policy at apply-time marks confirmation
satisfied (`69541c7`, `48309b7`).

Live gate: "Swap next Fridays gunshow for an easy bike" → "Want me to swap in
Easy Zone 2 Bike on 2026-07-10? (yes / no)" → "yes" → applied instantly,
board shows Easy Zone 2 Bike on Friday. "Replace Mondays session with 6x400m
hill sprints" → honest refusal: only approved templates, options offered.

*(original 3D plan for reference below)*

- Entry gate: protected-ref signature hardening (content hash replacing sorted-key stableString) — deferred from Stage 1.5 to exactly here.
- Schema `templateRef` on added sections; app-side template registry is the ONLY add authorization (policy stays app-side); `needs_confirmation` surfaces as a real confirm UX in chat.
- Live gate: "swap team training tomorrow for an easy bike" → confirmation → applied from template; free-form invention still refused.

### 3E — Latency & production readiness — **MEASURED 2026-07-02; levers need product sign-off**

Instrumentation landed (`76489cf`): client logs totalMs + request/response
bytes per turn; edge function returns upstream-ms + output/reasoning-token
headers (NEEDS REDEPLOY to activate); CoachScreen fires an OPTIONS warm-up on
load to kill cold-start tax.

**Live numbers (gpt-5.5, dev):**

| Turn shape | request | response | total |
|---|---|---|---|
| not_an_edit (tiny output) | 52.8 KB | 118 B | **4.25 s** |
| whole-day reduce (echo output) | 52.9 KB | 2.5 KB | **14.4 s** |

Reading: the FLOOR is ~4.3s (network + 53KB upload + ~13k-token prefill +
edge overhead) — most of the 5–8s budget before any output. Echo generation
adds ~10s for a single-day revision (~700 output tokens ≈ 68ms/token —
suspiciously slow; hidden reasoning tokens are the prime suspect, confirmable
once the deployed headers report usage).

**Levers, all requiring Sam's sign-off (each touches model inputs/behavior):**
1. Deploy the instrumented edge fn → see upstream/reasoning split (zero risk).
2. Request slimming: the `schema` object duplicates shapes already in the
   system prompt (~15–20KB), and `visibleCandidates` duplicates every
   snapshot id (~8–12KB). Removing either shrinks prefill but changes what
   the model sees — A/B against the live gate flows before trusting.
3. If reasoning tokens dominate: env knob for reasoning effort — an explicit
   speed-vs-thinking trade, product owner's call.
4. Patch-shape output (ops over visible IDs, same validator) — the
   pre-designed fallback; would cut the ~10s echo cost to ~2–3s. Largest win,
   real work, revisit if 1–3 don't reach budget.

*(original 3E plan for reference below)*

- Measure per-turn p50/p95 from `served_by`-to-result timestamps; then in order: prompt slimming (schema/prompt are resent every call), snapshot trimming (visible fields only), and only if still over budget: patch-shape output (ops over visible IDs, deterministically applied, SAME diff validator) — the pre-agreed fallback, now optional rather than necessary.
- Production flag design: revision path default-on for one-off edits behind a server-controllable kill switch; offline = polished refusal message.

### Continuous

- Consistency reps during normal use; `invalidIssues`/`apply_rejected`/`projection_mismatch` diagnostics make every anomaly self-describing — paste any WARN that looks off.
- Track refusal rate; if a supported-scope flow refuses >1/10 with echo-drift issues, revisit patch-shape earlier.

## 3. What not to do (standing)

No regex/phrase handlers. No loosening the validator to raise conversion. No LLM-side mutation or success claims. No legacy path deletions until the Stage 4 default-flip has soaked. No schema expansion beyond the active workstream.
