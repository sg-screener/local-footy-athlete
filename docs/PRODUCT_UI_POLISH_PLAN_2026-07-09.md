# Product/UI Polish Plan — Readiness Card + Session Logging (2026-07-09)

Read-only plan. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md` (§9 readiness signals, :132 missed-session popup, feedback→progression rules ~:3510-3530). Out of scope by instruction: recovery_addon, injury/readiness, speed/sprint, Coach Notes, QA harness, bye-week implementations, rebuild architecture. This plan changes UI surfaces, copy, and flow ordering — it consumes the existing stores and never adds adjustment logic.

**Headline from the HEAD audit: most of the requested UX already exists.** The plan below is deliberately framed as "polish what's there," because the biggest risk in this area is Codex rebuilding working machinery.

## A. Plain-English UX model

The athlete should reach "tell the coach how I am" in one tap from the home screen, speak in footy language ("bit tired" / "cooked" / "sore" / "sick" / "niggle" / "flat out this week"), and see the app respond visibly and proportionately. After a session, the first and only mandatory question is "Did you complete it?" — everything else is follow-up that appears only when relevant, and a combined session lets them say "did the lifts, skipped the bike" in two taps, not a form. Whatever they report leaves a visible trace (the card shows what's active and how to clear it) and quietly feeds the right stores — which, verified today, it already largely does.

## B. Current code gaps (verified at HEAD — note how much already exists)

**Already built and working (do not rebuild):** the "I'm not 100%" tap flow in `PlanChangeSheet.tsx` with tired split (spark=today / cooked=week), sick split (sniffle=today-recovery / rough=week / bed-ridden=clear-week), sore, and injured→`GuidedInjuryFlowSheet`; correct store writes per option (readinessStore signals + scoped constraints); the weekly card (`HomeScreenV2.tsx:423-506`) tappable → `WeekReadinessSheet` with "Clear adjustment — I'm good now"; `SessionFeedbackPanel.tsx` already completion-FIRST (Fully/Partially/Skipped) with conditional follow-ups, 5 partial reasons + 7 skip reasons; **per-component completion already exists** (`SessionFeedbackComponent[]`, strength vs conditioning vs recovery, aggregate derived); feedback genuinely feeds progression (`recentConditioningFeedback` maps skipped→failed; strength completion derived from sets).

**Actual gaps:**
1. **Discoverability:** no standing readiness entry on the home screen — "I'm not 100%" is buried behind tapping a day; the weekly card renders only AFTER a constraint exists, so it can't be the entry point.
2. **Missing options:** the not-100% menu has no "Busy / short on time" option (busy week currently reachable only via coach chat intent; short-time exists as a readiness signal but no UI writes it); "niggle" is implicit in the injury flow — copy should name it.
3. **Missed-session prompt:** Bible :132's "did you complete this session?" popup doesn't exist — `MissedSessionPrompt` is a passive info card; skipped-yesterday sessions collect no reason and feed nothing.
4. **Combined-session fast path:** per-component logging exists in the data model but the panel presents one form; "lifts done, finisher skipped" should be two taps on component chips, not a re-purposed aggregate flow.
5. **Post-active state:** after clearing a readiness adjustment there's no lightweight "back to normal" confirmation; and while active, the card doesn't show WHAT is being adjusted (that's the Coach Notes workstream's proof copy — this plan only reserves the slot).
6. Watch item: zero-diff readiness card suppression belongs to the Coach Notes plan (CN-A) — don't duplicate it here.

## C. Readiness card proposal

**Placement:** a standing, one-tap "I'm not 100%" entry on the home screen (compact button/row near the week header — always visible, not constraint-dependent). Tapping opens the EXISTING PlanChangeSheet flow (reuse, don't fork).
**Options (copy tune of the existing menu):** "Just a bit tired" (today), "Cooked — need a lighter week" (week), "Sore from training/game" (asks where), "Sick" (existing 3-way split), "Niggle or injury" (existing guided flow), **"Busy / short on time" (new option; writes the existing schedule-constraint path: today's `timeAvailableMinutes` or week busy scope)**.
**Scope/expiry/clear:** unchanged from what's built — today-signals expire end of day, week constraints at week end, injury until cleared; card while active shows scope + "Clear adjustment — I'm good now" (existing). **After active:** on clear, a small transient confirmation ("Back to normal — program restored"), then the standing entry returns to idle. No new stores, no new constraint types — the busy option maps onto the existing schedule constraint producers.

## D. Session logging proposal

Keep the existing completion-first panel; polish ordering and reach: (1) "Did you complete it?" stays first and mandatory — Yes, all of it / Part of it / No, skipped it (copy tune of Fully/Partially/Skipped). (2) Follow-ups stay conditional exactly as built (feel → soreness → reason → note); move the partial/skip REASON immediately after the completion answer (before feel/soreness) so the most diagnostic question isn't last. (3) **Missed-session prompt (new):** when yesterday's session has no feedback, next app open asks Bible :132's question as a dismissible popup — "Did you get yesterday's session done?" Yes → mark full (optional quick feel); Partly / No → the same panel's reason options; Dismiss → ask once more at next open, then stop (never nag). Writes the same `SessionFeedback` record; no new adjustment logic (what the program does about misses stays with the progression/readiness systems).

## E. Combined-session logging proposal

Surface the per-component model the data layer already has: when a workout has >1 component (strength + finisher/component; recovery_addon later — render whatever components exist, no addon-specific logic), the completion step becomes component chips — "Strength ✓ / Conditioning ✗ / (Finisher ✗)" — each tap cycling done/skipped/partial; aggregate stays derived (existing `deriveAggregateCompletion`). Follow-ups ask only for what was touched: reasons attach to the skipped component (existing per-component reason fields), feel/soreness once for the session. Verify (don't change) that component completions keep feeding progression: strength completion from components, conditioning skipped→failed mapping — slice E locks this with tests. Finisher-skipped must never read as session-missed anywhere downstream (assert).

## F. Implementation slice order

- **UI-A — Readiness entry visibility + copy (first, Codex-ready now).** Standing home-screen entry reusing PlanChangeSheet; menu copy per §C; add "Busy / short on time" wired to existing producers; post-clear confirmation. No store/logic changes.
- **UI-B — Feedback ordering cleanup.** Reason question moves up; copy tune ("Yes, all of it / Part of it / No, skipped it"); no data-shape changes.
- **UI-C — Combined-session component chips.** §E presentation over the existing `SessionFeedbackComponent[]` model.
- **UI-D — Missed-session prompt.** §D popup; writes existing SessionFeedback only; ask-twice-then-stop rule.
- **UI-E — Feedback→progression verification.** Test-only slice: component-level fixtures proving skipped finisher ⇒ conditioning progression sees 'failed' while strength progresses; partial strength ⇒ correct completionQuality; no UI change.
- **UI-F — Snapshot/polish tests.** Component snapshots for the card states (idle/active/cleared), panel flows (full/partial/skipped/combined), popup states; copy locked by snapshot.

## G. Tests needed

UI-A: entry renders on home in all states; each menu option writes exactly its existing store target (table-driven: option → readinessStore signal and/or constraint with correct scope/expiry); busy option produces a schedule constraint identical in shape to the chat-produced one; clear flow regression (constraint removed, overrides released — existing behaviour). UI-B/C: form state machine — completion-first enforced; combined workout renders one chip per component; chip states persist to `componentCompletions`; aggregate derivation unchanged (existing tests stay green); reason attaches to the right component. UI-D: popup appears only when yesterday lacks feedback; writes correct SessionFeedback; ask-twice cap honoured; never appears for rest/game days. UI-E: progression fixtures per §E. UI-F: snapshots. All slices: full board; no generation/QA snapshots should change (UI-only guarantee).

## H. Codex-ready first prompt (UI-A)

> **Task: UI-A — readiness entry visibility + copy polish. UI ONLY: no store schemas, no constraint producers, no adjustment logic may change. READ `docs/LFA_PROGRAMMING_BIBLE.md` §9 (~:2493-2572) and `docs/PRODUCT_UI_POLISH_PLAN_2026-07-09.md` first.**
>
> 1. Add a standing "I'm not 100%" entry to `HomeScreenV2.tsx` (compact row/button near the week header, visible in every state — do NOT gate it on an active constraint like the existing weekly card at :423-506, which stays as-is for active-state display). Tapping opens the EXISTING PlanChangeSheet "What's going on?" flow — reuse the component; do not fork or duplicate its steps.
> 2. Copy tune the menu options (labels only, same handlers): "Just a bit tired" / "Cooked — need a lighter week" / "Sore from training or the game" / "Sick" / "Niggle or injury" / plus a NEW option "Busy / short on time" — wire it to the EXISTING schedule-constraint path (`programControlActions` set_schedule_modifier / the timeAvailableMinutes readiness signal for today-scope; follow whichever of the two the existing busy/short-time producers expect — cite your choice in the PR). No new constraint types, no new stores.
> 3. Post-clear confirmation: after "Clear adjustment — I'm good now" succeeds, show a small transient confirmation ("Back to normal — program restored") and return the standing entry to idle.
> 4. **Do NOT touch:** readiness/injury/constraint logic or producers beyond wiring the busy option to an existing one; SessionFeedbackPanel; recovery_addon, sprint, Coach Notes, QA, bye-week, rebuild code; the WeekReadinessSheet contents.
> 5. **Tests.** Extend/add UI tests: entry renders idle + active + post-clear; table-driven option→store-write assertions (each option produces exactly the same writes as today's flow — snapshot the store effects before/after to prove no behaviour change for existing options); busy option produces a schedule constraint matching the chat-produced shape; clearing regression stays green. Full test board; UI-only guarantee: zero diffs in generation/QA snapshots. Known pre-existing failures per roadmap — do not chase.

## I. Behaviour risk

Low overall — this is presentation over existing machinery, and the store writes are snapshot-fenced. Specific risks: UI-A busy-option wiring picks the wrong producer (mitigated: cite-your-choice requirement + shape assertion against the chat-produced constraint); UI-C could accidentally change aggregate completion semantics (fenced by keeping `deriveAggregateCompletion` untouched and its tests green); UI-D nag risk (ask-twice cap is a hard rule); cross-workstream: the card's "what's being adjusted" copy slot belongs to Coach Notes (CN-A proof copy) — UI-A reserves space but renders existing modifier text, and zero-diff suppression stays CN-A's job. Systemic guard: every slice is UI-only by contract — if any slice needs a store schema or producer change to work, stop and flag it (that's a different plan's lane).
