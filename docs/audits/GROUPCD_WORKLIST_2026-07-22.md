# Group C/D Execution Worklist — 2026-07-22

**Lane:** 2 (audit/docs only — no code changes). **Branch/HEAD:** `main` @
`26de647` (merge: fix group B visible verification, items 1/3/4 — phase-card
single source, anchor-day relocate-first). Findings only, per instructions —
no fixes attempted.

**Purpose:** the 07-21 area audits (`PROGRAM_2026-07-21.md`,
`WORKOUT_2026-07-21.md`, `HOMEV2_2026-07-21.md`, `PROFILE_2026-07-21.md`) and
the resulting `docs/FIX_GROUPS_C_D_WORKLIST.md` are screen-level findings
without source references. Six stage-2/3/4 commits and a Group B fix have
landed on those screens since. This document re-sweeps the current source
(`26de647`) and re-drives the live app (iPhone 17 Pro simulator, iOS 26.3,
seed `standard-in-season-week`, Metro :8081) for every Group C/D item so the
fix lane has `file:line` for each one and does not need to re-search or
re-discover which findings are still current.

**Verification tags:** **LIVE** = re-driven on-device this session via
Maestro MCP (screenshot/hierarchy captured 2026-07-22). **CODE** = confirmed
present in source this session, not independently re-driven on-device this
session (previous audits already established the on-screen symptom for the
same code path).

**Root cause called out up front (Group C):** every item below traces to one
shared pattern: components accept a `testID` prop meant for
E2E/QA automation (`explorerTestId.*` in `src/utils/stableTestId.ts` — ids
like `readiness-option-tired-today`, `plan-change-edit-session`) and then
reuse that same value as `accessibilityLabel` — either directly
(`accessibilityLabel={testID}`) or as the first-choice fallback
(`accessibilityLabel={testID ?? label}`). Whenever a call site supplies a
`testID`, the athlete-facing screen-reader label becomes the internal id
string instead of real copy. This is one class of bug repeated across five
components — fixing the shared pattern (stop feeding `testID` into
`accessibilityLabel`; give each component a real `label`-derived
accessibility string, keep `testID` for automation only) closes the whole
class in one pass rather than patching each call site.

---

## Group C — Accessibility / internal-id labels

- [ ] **`src/components/ui/Sheet.tsx` — NOT the shared root cause it looked
  like on first pass.** The FRI "Gunshow" sheet ("Want to change
  something?") was re-driven live this session and did **not** reproduce
  `PROGRAM_2026-07-21.md`'s "accessibility tree comes back completely
  empty" finding — on a clean open (`tapOn day-row-fri` → `tapOn
  make-change-link`, no race), the sheet's own accessibility tree is
  populated (`rid: "plan-change-sheet"`, all three menu rows present). The
  original empty-tree capture reproduced once on a rushed retry in this
  session (no wait after the prior action) then did not reproduce on a
  clean retry — almost certainly a `Modal animationType="fade"` timing
  artifact in whichever automation captured it 07-21, not a persistent
  defect. **Correcting/retiring that finding.** The real defect on this
  screen is narrower — see the next item.

- [ ] **`src/screens/home/PlanChangeSheet.tsx:640-642`** — the "Edit this
  session" menu option passes an explicit `testID="plan-change-edit-session"`.
  `MenuOption` (`PlanChangeSheet.tsx:1112-1124`) sets
  `accessibilityLabel={testID ?? label}`, so this row's screen-reader label
  is the literal string `plan-change-edit-session`, not "Edit this
  session". The sibling rows on the same sheet ("I'm not 100%", "Something
  else - ask the coach") pass no `testID` and correctly fall back to their
  `label`. **LIVE** — reproduced 2026-07-22 on FRI's sheet:
  `a11y: "plan-change-edit-session"` vs. `a11y: "I'm not 100%"` /
  `"Something else - ask the coach"` on the other two rows, same sheet, same
  render.
  Same component, same bug, not yet driven live: **`PlanChangeSheet.tsx:682-684`**
  ("Move this session" → label becomes `explorerTestId.sessionMoveIngress(id)`)
  and **`PlanChangeSheet.tsx:690-692`** ("Bin this session" → label becomes
  `explorerTestId.sessionDeleteIngress(id)`), both inside the `edit_session`
  step. **CODE.**

- [ ] **`src/screens/home/HomeScreenV2.tsx:695-697`** (weekly "I'm not 100%"
  entry card) and **`HomeScreenV2.tsx:728-730`** ("Missing equipment?" entry
  card) — both set `accessibilityLabel` directly to
  `explorerTestId.readinessSetAction(...)` /
  `explorerTestId.equipmentOption('open')` (or the `*Update(...)` variant
  once a fact exists). **LIVE** — reproduced 2026-07-22:
  `a11y: "readiness-set-action-readiness-2026-07-13"` and
  `a11y: "equipment-preset-open"` on the Program screen, seed
  `standard-in-season-week`.

- [ ] **`src/screens/home/HomeScreenV2.tsx:1968-1974`** (`SheetOption`
  component: `accessibilityLabel={testID}`) — every option in the weekly
  readiness sheet inherits this. **LIVE** — reproduced 2026-07-22, all 7
  options plus the injury entry on `home-week-readiness-sheet`:
  `readiness-option-tired-today`, `readiness-option-poor-sleep-today`,
  `readiness-option-poor-sleep-week`, `readiness-option-cooked-week`,
  `readiness-option-sore-today`, `readiness-option-sick-week`,
  `readiness-option-short-time`, `injury-set-action-new` — every one exposes
  the internal id, not its visible text (e.g. "Just a bit tired today").
  Same component also backs the "still not right / still sick / still
  cooked / worse" follow-up options at `HomeScreenV2.tsx:1852-1876`
  (`readiness-option-still_not_right` etc.) — **CODE**, not re-driven this
  session (same component, already proven live above).

- [ ] **`src/screens/home/HomeScreenV2.tsx:1690-1702`** (active coach-note
  action buttons — approve/dismiss/undo on program-adjustment cards) —
  `accessibilityLabel={actionTestID}` where `actionTestID` is one of
  `explorerTestId.injuryResolveAction/adjustmentRestore/readinessUpdate/
  equipmentClear/equipmentUpdate(...)`, or the inline fallback
  `` `program-active-coach-note-action-${note.constraintId}-${action.kind}` ``
  at line 1690. **CODE.**

- [ ] **`src/screens/home/HomeScreenV2.tsx:650`** (add-fixture entry,
  `explorerTestId.fixtureIngress('add', weekAnchorISO)`) and
  **`HomeScreenV2.tsx:1614`** (move-fixture entry,
  `explorerTestId.fixtureIngress('move', day.workout.id)`) — same direct
  `accessibilityLabel={explorerTestId...}` pattern, this time exposing a raw
  session/fixture id rather than a semantic slug. **CODE.**

- [ ] **`src/screens/home/GuidedInjuryFlowSheet.tsx:274-279`** (injury
  trigger chips — "What brings it on?" step) —
  `accessibilityLabel={\`injury-trigger-${INJURY_TRIGGER_TEST_IDS[trigger]}\`}`,
  and the shared **`FlowOption`** component at
  **`GuidedInjuryFlowSheet.tsx:324-344`** (`accessibilityLabel={testID}`),
  used for the injury flow's other option lists. **CODE.**

- [ ] **`src/screens/home/EquipmentLimitationSheet.tsx:64-80`**
  (`EquipmentOption` component: `accessibilityLabel={testID}`) — every
  equipment preset option in the "Missing equipment?" sheet. **CODE.**

- [ ] **`src/screens/home/DayWorkoutScreenV2.tsx:2600-2606`**
  (`ExerciseSheetOption` component: `accessibilityLabel={testID ?? label}`)
  combined with **`DayWorkoutScreenV2.tsx:2393-2411`** (the `future_scope`
  step's "Today only" / "Future weeks too" buttons) — refines
  `WORKOUT_2026-07-21.md`'s "Remove flow scope buttons have no accessible
  text label at all" finding: for `step.action === 'remove'`, `testID` is
  set to `explorerTestId.componentDeleteScope(sessionId, exerciseId,
  'today'|'future')`, so the label is the internal id, not empty — for
  `step.action === 'swap' | 'add'`, `testID` is `undefined` so these
  correctly fall back to "Today only"/"Future weeks too" (this half matches
  what 07-21 already reported as correctly labeled). The defect is
  internal-id exposure on the **Remove** flow specifically, not a missing
  label. **CODE** (re-derivation of the source, not re-driven live —
  reaching this step requires Workout → Edit exercises → Remove → confirm).

---

## Group D — Dead buttons, raw dates/codes, missing controls

### "Dead" Support buttons — wired in code, silently fail on-device

- [ ] **`src/screens/profile/ProfileScreen.tsx:713-723`** — "Leave Feedback"
  and "Ask a Human" ARE wired (`onPress={() =>
  Linking.openURL(buildMailto(env.feedbackEmail / env.supportEmail, ...))}`,
  `buildMailto` at `src/config/env.ts:209`) — this is **not** a literal dead
  `onPress`, correcting `PROFILE_2026-07-21.md`'s framing. **LIVE** —
  reproduced 2026-07-22: tapping "Leave Feedback" on the simulator produces
  zero visible change (no compose sheet, no toast, no error), matching the
  originally reported symptom exactly. Root cause: `Linking.openURL(...)` at
  lines 717 and 722 has no `.catch()`/fallback and no `Linking.canOpenURL`
  guard — on a simulator (or a device) with no Mail account configured,
  `openURL('mailto:...')` fails silently and the athlete sees nothing at
  all. Fix belongs at these two call sites (or a shared `openMailto` helper
  with a fallback UI), not at "the button doesn't do anything" — it does,
  the failure path is just silent.

### Raw ISO dates in athlete-facing copy

- [ ] **`src/utils/planChangeProducer.ts:2033`** —
  `` `Done. ${change.fromDate} and ${change.toDate} swapped sessions.` `` —
  raw ISO dates (`2026-07-13`) instead of day names. **CODE** (same
  instance `PROGRAM_2026-07-21.md` row 1.5 already reported; still present
  at `26de647`).

- [ ] **`src/utils/coachActions.ts:536-539`** — `replaceExerciseAtDate`'s
  past-date guard: `` `${date} is in the past - I can't change it.` `` — raw
  ISO date in the refusal copy. Per the function comment at
  `coachActions.ts:145-148`, this is "the single place both doors (tap +
  coach) inherit past-date [refusal]", so this one fix point covers both
  doors. **CODE** — not previously logged in `FIX_GROUPS_C_D_WORKLIST.md`;
  new to this sweep, called out explicitly per this session's brief.

### Raw internal error codes on the visible surface

- [ ] **`src/utils/planChangeProducer.ts:1345`** and
  **`planChangeProducer.ts:1662`** —
  `` `That change isn't possible here (${resolution.error}).` `` — the
  `blockedAssessmentForBuildError` gate (`planChangeProducer.ts:1218-1248`)
  only intercepts `protected_anchor_day` and `protected_game_day` and gives
  those the plain-language copy; every other `resolveAthleteMutation` error
  (e.g. `nothing_to_swap`, `no_template_for_category`,
  `athlete_move_identity_missing`) still falls through to the raw code
  string here. **CODE.**

- [ ] **`src/utils/planChangeProducer.ts:1432`** — same pattern for
  `proposal.error` inside the preview path; also gated by
  `blockedAssessmentForBuildError` for the two protected-anchor codes only,
  raw code otherwise. **CODE.**

- [ ] **`src/utils/planChangeProducer.ts:1802-1809`** — the legacy-proposal
  fallback inside `applyPlanChangeWithinTrace` (reached when the typed
  transaction defers to the legacy writer, e.g. `add_defers_to_legacy_stack`,
  no-template swaps). `` `That change isn't possible here (${proposal.error}).` ``
  with **no `blockedAssessmentForBuildError` check at all** on this path —
  every error here renders raw, including `protected_game_day` /
  `protected_anchor_day` if a legacy-deferred change happens to hit an
  anchor. This is the widest-open instance of the four: it has no
  plain-language gate whatsoever. **CODE.**
  (Matches `PROGRAM_2026-07-21.md` rows 1.1/1.2/1.3/1.7×2's
  `section18_week_rejected` example — same defect class, current line
  numbers after the stage 2-4 refactors.)

### Missing swap-to-Rest control

- [ ] **`src/screens/home/PlanChangeSheet.tsx:667-698`** (`edit_session`
  step — "Swap this session" sub-copy: "Change to strength, conditioning or
  recovery") and **`PlanChangeSheet.tsx:882-920`** (`pick_category` step —
  the actual "Swap to:" list, built from `options.categories`/
  `options.addOnTopCategories`, filtered to `conditioning_*`, `strength_*`/
  `accessories`, and `recovery` only) — no `rest` category id exists
  anywhere in the categories the producer offers, so Rest is not a reachable
  Swap-To destination. The only path to a Rest outcome is **"Bin this
  session"** (`PlanChangeSheet.tsx:687-695`, "Remove it - the day becomes
  rest"), which is a destructive-confirm flow, not the "confirm step, then
  rest" the QA contract describes for row 1.4 in
  `docs/SUPPORTED_ATHLETE_ACTIONS.md`. **CODE** (same finding as
  `PROGRAM_2026-07-21.md` row 1.4; re-confirmed against current category
  list at `26de647`).

---

## Explicitly excluded from this worklist (unchanged from `FIX_GROUPS_C_D_WORKLIST.md`)

- **Group B** (visible persistence — session feedback, readiness signal,
  stale phase-status card): tracked separately, re-audited STILL-BROKEN in
  `docs/audits/GROUPB_REAUDIT_2026-07-22.md`. Item 2 (readiness) is the v1
  blocker deferred to its own Q1-Q7 design-only reassessment per
  `MEMORY.md` — do not fold it into this execution worklist.
- **Group A** (§18 ownership / preview-gate refusals as a *cause*): the
  underlying reasons a refusal fires are tracked in
  `docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md`. This worklist only
  covers *presentation* of refusals (raw codes/dates), which is a defect
  regardless of why the refusal fired.
- **Coach-door scope:** "Busy or away this week?" routing into Coach chat
  instead of a native sheet — recorded as BLOCKED per the CLAUDE.md Coach
  Architecture Escalation Rule, not a C/D defect.
- **Already pre-logged:** equipment preset not consumed by generation
  (matches `FLOW_AUDIT_2026-07-07.md`).
