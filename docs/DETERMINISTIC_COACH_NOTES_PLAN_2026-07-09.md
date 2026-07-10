# Deterministic Coach Notes Plan (2026-07-09)

Read-only plan. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md` — "What creates Coach Note" / "What clears" / "What should auto-expire" (~lines 2592-2651) plus the canonical copy strings in §9 ("Load reduced this week", "Recovery mode active", "Busy week adjustment active", "Away adjustment active"). Out of scope by instruction: injury/readiness implementation, recovery_addon implementation, progression/deload code, rebuild architecture, coach chat/LLM — notes **read** those systems' outputs (diffs, week kinds, constraints); they never modify them.

## A. Plain-English model

One rule governs everything: **a Coach Note exists if and only if the app can point at the program change it explains.** Every note is derived from a provable source — a rebuild diff, an active constraint that produced ≥1 visible projection change, or a generation decision (deload week, constraint-aware build) recorded at generation time. Copy is assembled deterministically from that source ("Added Saturday practice match. Friday kept light to protect game day"), never canned ("Your program was updated") and never claim-first ("Hamstring adjusted" when nothing changed). Clearing a note releases exactly the program effects it owns; notes expire when their scope ends (day, week, date range) or when the athlete says they're good. Normal profile facts — name, position, season phase, usual game day, usual training days, goals — never produce notes.

## B. Current code gaps (verified at HEAD today)

- **Good foundation:** notes are already derived from constraint state via `activeProgramModifiers` (single truth source, no independent note store); `verifiedCoachCommunication.ts` truth-gates "program updated" claims on a real `visibleDiff`; `clearActiveProgramModifier()` atomically removes constraint + linked overrides.
- **Canned game-change copy:** `MakeAChangeScreen.tsx:~131` hardcodes per-change-type copy with no link to the rebuild result — even though `WeekRebuildResult` carries the actual diff the copy should be derived from. Game-change and week-rebuild paths otherwise produce **no note at all**: the week visibly reshapes and the athlete is never told why.
- **Zero-diff readiness card:** still possible — the card renders constraint rules/guidance even when projection changed nothing (it records an honest `unchangedReason` internally but shows anyway).
- **Deload is silent:** calendar deload generation landed (`deloadWeekRules.ts`) with no constraint type, no card, no copy — the Bible's "tell them it's a deload" (:170) has no implementation.
- **Stale-note paths:** per-workout `coachNotes` strings are baked into overrides by `applyAdjustmentEvents.appendCoachNote`; if the parent constraint clears but the override survives (linkage not recorded), the note text orphans. Notes can also reference sessions later moved/edited.
- **Missing note sources:** generation-time constraint consumption (new `generationConstraints.ts`) surfaces nothing; equipment limitation and future-weeks exercise-preference notes exist as constraint cards but game/practice-match and deload have no note type at all.

## C. Proposed note types

Typed enum, one builder per type, all sharing the same proof interface: `injury` (constraint + its applied changes), `readiness_load` (tired/cooked/recovery-mode; Bible copy strings), `busy_away` (date-ranged schedule constraints), `game_change` (rebuild-diff-derived: added/moved/removed game or practice match + protection consequences), `deload` (week-kind-derived: "Deload week — loads pulled back on purpose"), `equipment` (limitation constraint), `exercise_preference` (future-weeks-too changes), `missed_session_adjustment` (only when it changed the week), `training_paused` (pause-tier states). Each note carries: `type`, `sourceRef` (constraint id / rebuild id / week-kind), `proof` (the diff slice or applied-change list it can display), `scope` (day / week / date-range / until-cleared), `ownedEffects` (override/constraint ids released on clear).

## D. Truth-gating rules

1. **Proof-first construction:** builders receive the proof object (visibleDiff, applied projection changes, generation record) and compose copy from it; a builder with an empty proof returns nothing — there is no "default copy" path.
2. **Claims ≤ proof:** copy may only name sessions/exercises/days present in the proof (the `verifiedCoachCommunication` pattern generalized: extend its gate so every note type passes through it, not just "program updated" replies).
3. **Zero-diff suppression:** a constraint whose projection produced no visible change and whose plan change is empty renders no card; its guidance degrades to the chat reply (already the honest `unchangedReason` — use it to suppress, not just record).
4. **Canned copy demoted:** the MakeAChangeScreen strings survive only as a last-resort fallback when a diff object is genuinely unavailable, and the fallback must claim nothing specific ("Week updated — open the plan to see changes").
5. **Bible negative list enforced:** profile facts never construct notes (assert: no note builder accepts profile-only inputs).

## E. Clear/update/expiry rules (Bible ~2605-2651)

Clear: user tap ("I'm good now" / clear) → `clearActiveProgramModifier` releases exactly `ownedEffects` — existing atomic behaviour kept, extended so per-workout note strings are registered as owned effects at write time (fixes the orphan path). Auto-expire: tired-today/poor-sleep/mild-soreness notes end-of-day; busy week at week end; away/holiday at range end; missed-session prompt once answered; deload note at week end. Never auto-expire: injury, equipment limitation, exercise preference, training paused, ongoing sickness ("if user has not said they are better"). Update: when the underlying proof changes (rebuild rewrites the week, constraint severity updated), the note re-derives from the new proof — never edited in place; a note whose sourceRef no longer resolves (constraint gone, override swept) is removed at the same sweep. Week-scoped notes carry `expiresAt = end of week` (existing mechanism) plus card deactivation at expiry (currently filtering exists but cards aren't deactivated — close that).

## F. Implementation slice order

- **CN-A — Truth-gate generalization + zero-diff suppression.** The typed note model (§C interface), every existing card passes the extended gate, zero-diff readiness card suppressed, canned-copy fallback demoted, profile-facts assertion. **First slice — Codex-ready now.**
- **CN-B — Game/practice-match diff-based notes.** `buildGameChangeNote(WeekRebuildResult)` — reads the rebuild diff (rebuild architecture untouched), names added/moved/removed sessions + protection consequences; wired where MakeAChangeScreen shows canned copy today.
- **CN-C — Injury/readiness deterministic notes.** Copy derived from the applied projection changes ("Hamstring 5/10 active. Removed: RDL Tuesday; running conditioning moved off-feet.") — consumes whatever the injury/readiness workstream applies; no thresholds or adjustment logic in note code.
- **CN-D — Deload notes.** Reads the generated week's kind (read-only) → week-scoped deload note with Bible copy; expires at week end.
- **CN-E — Expiry/clear hardening.** ownedEffects registration (orphan fix), sourceRef resolution sweep, card deactivation on expiry, auto-expiry table per §E.
- **CN-F — Tests** woven through each slice (misbehaving-mock proofs are the backbone).

Order rationale: A is the contract everything else plugs into; B has its proof object already available; C/D depend on other workstreams' outputs but only as readers; E closes the lifecycle; nothing blocks on Codex's current work.

## G. Tests needed

CN-A: zero-diff constraint ⇒ no card, with-diff ⇒ card (fixture pair); every note type rejects empty proof; profile-facts fixture produces zero notes; existing note-clearing regression (clear still releases overrides). CN-B: per change type, note text matches the rebuild diff exactly; **misbehaving-mock rebuild** (does less than requested) ⇒ note describes the lesser reality; no-diff rebuild ⇒ fallback copy claims nothing specific. CN-C: applied-changes fixtures ⇒ copy names exactly those changes; constraint with guidance-only output ⇒ no card. CN-D: deload week ⇒ note present with week scope; build week ⇒ absent; note expires at week end. CN-E: orphan fixture (constraint cleared, override survives) ⇒ note string removed; sourceRef-dangling sweep; auto-expiry table-driven per §E. All slices: full board + QA diffs; note snapshots for the scenario board.

## H. Codex-ready first prompt (CN-A)

> **Task: CN-A — typed Coach Notes with truth-gating + zero-diff suppression. READ `docs/LFA_PROGRAMMING_BIBLE.md` "What creates Coach Note" through "What requires rebuild" (~lines 2592-2651) and `docs/DETERMINISTIC_COACH_NOTES_PLAN_2026-07-09.md` first.**
>
> 1. New `src/utils/coachNoteModel.ts`: typed note model — `CoachNoteType` enum (injury, readiness_load, busy_away, game_change, deload, equipment, exercise_preference, missed_session_adjustment, training_paused) and `DeterministicCoachNote { type, sourceRef, proof, scope, ownedEffects }`. A note builder that receives an empty proof MUST return null — no default-copy path may exist.
> 2. Generalize the existing truth gate: extend the `verifiedCoachCommunication.ts` mechanism (the `visibleDiff`-proved applied-changes pattern) into a `gateNoteClaims(note)` helper used by ALL card/note rendering — copy may only name days/sessions/exercises present in `note.proof`.
> 3. Zero-diff suppression: in the card-creation path (`activeProgramModifiers.ts` modifier selection + the readiness card producer), a constraint whose projection produced no visible change and no plan change renders NO card — use the existing honest `unchangedReason` signal to suppress rather than merely record. Guidance-only content stays available to the chat reply path (do not modify chat code — just don't render a card).
> 4. Demote the canned copy: `MakeAChangeScreen.tsx` (~:131) strings become fallback-only when no diff object exists, and the fallback must claim nothing specific ("Week updated — open your plan to see the changes."). Do NOT build diff-derived game copy yet (that's CN-B) — this slice only stops the canned strings from over-claiming.
> 5. Migrate existing cards (injury, readiness, busy/away, equipment, preference) onto the typed model WITHOUT changing their current copy where it already derives from constraints — this is a re-plumb, not a re-write; snapshot-prove copy is unchanged for with-diff cases.
> 6. **Do NOT touch:** injury/readiness adjustment logic, recovery_addon, progression/deload code, rebuild internals, coach chat/LLM, constraint producers, or clearing semantics (`clearActiveProgramModifier` behaviour must stay byte-identical — keep its tests green).
> 7. **Tests.** New `src/__tests__/coachNoteModelTests.ts`: zero-diff constraint fixture ⇒ no card; same constraint with one applied change ⇒ card whose copy names that change; every note type returns null on empty proof; profile-facts fixture (name/position/phase/game-day/training-days/goals) produces zero notes; gate rejection fixture — a note claiming a session not in its proof fails loudly; existing coachNoteDisplayTests + clearing regressions stay green; QA scenario board note-snapshots committed (expect diffs ONLY where zero-diff cards disappear). Full test board; known pre-existing failures per roadmap — do not chase.

## I. Behaviour risk

CN-A: low-medium — cards disappear for zero-diff cases (that's the point) and no copy changes otherwise (snapshot-fenced); main hazard is over-suppression via an unusual diff shape — covered by fixture pairs. CN-B: low — copy-only, proof object already exists. CN-C: low-medium — reader risk of describing changes wrongly; the misbehaving-mock pattern (proven in the revision migration) fences it. CN-D: low, read-only consumption of week kind. CN-E: medium — lifecycle changes touch clearing paths; fenced by keeping `clearActiveProgramModifier` behaviour identical and only *adding* ownedEffects registration. Systemic guard: the note layer is read-only over program state — any slice that needs to *change* program behaviour to make a note true has left its lane and should stop (escalation rule per AGENTS.md).
