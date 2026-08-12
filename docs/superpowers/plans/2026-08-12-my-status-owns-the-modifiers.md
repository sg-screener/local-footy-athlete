# My Status Owns The Modifiers — Implementation Plan (SEAT_INBOX item 8)

> **NOT A PLAN in the governing sense — this is ONE TASK's checklist.** The
> governing plan is `docs/PUBLISH_ROADMAP_2026-08-05.md` and nothing here
> competes with it. Added 2026-08-12 because `test:repo-law-guards`' cell *'no
> second document ships an unmarked status checklist'* went red the moment this
> file landed: it carries 20+ status boxes, and a status surface that does not
> say what it is can be handed to the next reader AS the plan. The banner is
> what the law asks for, not a workaround for it.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Coach / My Status the owner of the program modifiers — its seven
inert actions become live in the chevron shape it already has — and retire the
Program-side duplicates the caption currently sends athletes to.

**Architecture:** The coach-note writers are EXTRACTED from `useHomeScreen` into
a hook both screens mount, with the action's **source injected as a parameter**
rather than hard-coded. Then (a)+(b) land as one commit; then (c) deletes the
Program-side leftovers. No new writer is created: My Status mounts the existing
doors, exactly as `dismiss_note` already does.

**Tech Stack:** React Native + TypeScript, zustand stores, `sucrase-node` test
cells, Maestro golden flows, iOS Simulator.

## Global Constraints

- **ORDER IS RULED AND MAY NOT BE REORDERED.** (a)+(b) in ONE commit; (c) after.
  **(c) before (a)+(b) strands athletes** — the caption sends them to the very
  screen (c) removes.
- **Finishing (a) without (b) FAILS a guard.** `repoLawGuardsTests.ts` cell
  *'a partly-blocked set disables only the blocked part'* reads
  `src/components/ActiveModifiersSection.tsx` for `liveActionKinds`,
  `disabled={notYet}` and `note.actions.some(`. When no action is inert any
  more, that machinery goes — and the cell must go **in the same commit**.
- **PROVENANCE IS EVIDENCE, NOT DECORATION.** `screen`/`surface` land in the
  action tape and the decision ledger. A writer lifted to My Status while still
  saying `screen: 'program_tab'` forges the record of where the athlete acted,
  and **nothing goes red**. The source must become a parameter.
- **Sam's design:** Day and Week are READ-ONLY indicators. My Status owns the
  detail, as **a row with a chevron** — not inline buttons.
- Generator stand-down D: nothing here touches generation or the anchor.

## What the order gets wrong (verified 2026-08-12, keep both)

1. **The chevron already exists.** `CoachStatusScreen.tsx:103-133` renders each
   modifier as a `Pressable` row with `<Chevron open={expanded} />` that expands
   to `ActiveModifiersSection`. **(a) is not a redesign — it is only "make the
   seven live".** Smaller than priced.
2. **Nine sites hard-code `screen: 'program_tab'`** in `useHomeScreen.ts`
   (:1046, :1138, :1203, :1236, :1296, :1340, :1427, :1474, :1491), with
   surfaces like `coach_notes_injury_resolved` / `coach_notes_status_update`.
   Bigger than priced, and the reason this is an extraction rather than a move.
3. `equipmentFactIds={EMPTY_EQUIPMENT_FACT_IDS}` (`CoachTabScreen.tsx:464`) is
   not separable — the Coach tab has **no** `equipmentFacts` source; the Program
   side takes it from `useHomeScreen`. It is fixed BY the extraction.

## THE STATED BLOCKER IS LIFTED (2026-08-12)

The item says *"NOT STARTED — no device verification is possible while Sam's
phone is un-rebuilt, and this unit is entirely glass."* **That is no longer
true.** This session ran the app repeatedly on the `LFA Explorer` simulator
(iOS 26.3), took screenshots of real screens, and drove seeded worlds through
Maestro (`common/reset-seed.yaml`, `SEED_ID: standard-in-season-week`). A glass
unit can be looked at now.

**Two instrument limits found the same day, and any plan here must route around
them rather than rediscover them:**
- **The setup sheet's committing CTA is below the fold on every iPhone**
  (content ~937pt in a ~736pt frame) and synthetic drags do not scroll it.
  Maestro's `scrollUntilVisible` with `visibilityPercentage: 40` does.
- **ALL-CAPS labels are `textTransform` styling.** The accessibility text keeps
  its original casing, so `IN-SEASON` is not findable — match the literal
  subtitle, or tap by point. Avoid `&` in Maestro text selectors; it did not
  match.

## File Structure

| File | Responsibility |
|---|---|
| `src/screens/coach/useCoachNoteActions.ts` (**create**) | The extracted writers, source-injected. One home for `clearCoachNote`, `updateCoachNoteStatus` and the injury/confirm sheet state that both screens mount. |
| `src/screens/home/useHomeScreen.ts` (**modify**) | Stops owning the coach-note writers; mounts the new hook with `screen: 'program_tab'`. |
| `src/screens/coach/CoachTabScreen.tsx` (**modify**) | Mounts the new hook with `screen: 'coach_tab'`; real `equipmentFactIds`; routes all eight kinds. |
| `src/screens/coach/CoachStatusScreen.tsx` (**modify**) | `LIVE_ACTION_KINDS` grows to all eight; `actionsNotYet` retired. |
| `src/components/ActiveModifiersSection.tsx` (**modify**) | Not-yet machinery removed once nothing is inert. |
| `src/rules/projectionCopy.ts` (**modify**) | Caption at `:378` retired. |
| `src/__tests__/repoLawGuardsTests.ts` (**modify**) | The `NOT_YET_SURFACE` cell retired **in the same commit as (a)**. |
| `src/__tests__/coachNoteActionSourceTests.ts` (**create**) | The provenance cell — the one thing nothing else catches. |
| `src/screens/home/HomeScreenV2.tsx` (**modify**, task 3) | Leftovers deleted. |

---

### Task 1: Extract the coach-note writers with the source INJECTED

**Files:**
- Create: `src/screens/coach/useCoachNoteActions.ts`
- Create: `src/__tests__/coachNoteActionSourceTests.ts`
- Modify: `src/screens/home/useHomeScreen.ts:1331-1500` (the two writers and
  their nine provenance sites)
- Modify: `package.json` (add `test:coach-note-action-source`)

**Interfaces:**
- Produces: `useCoachNoteActions({ screen }: { screen: 'program_tab' | 'coach_tab' })`
  returning `{ clearCoachNote(noteId: string, resolved?: boolean): Promise<void>;
  updateCoachNoteStatus(noteId: string, next: CoachNoteStatusUpdate): Promise<void>;
  injurySheet: InjurySheetState; confirmSheet: ConfirmSheetState }`.
- Consumes: the existing store doors unchanged — no new writer is introduced.

- [ ] **Step 1: Write the failing provenance cell**

The cell that makes the lift safe. It asserts the recorded surface follows the
screen the athlete actually used, which no existing test checks.

```ts
// src/__tests__/coachNoteActionSourceTests.ts  (shape; follow the repo's
// harness idiom — window.localStorage shim, armTotalsOrRed, run()/assert())
run('a note cleared from My Status records the coach tab, not the program tab', async () => {
  const seen: Array<{ screen: string; surface: string }> = [];
  captureAthleteActionEvents((event) => {
    if (event.source) seen.push({ screen: event.source.screen, surface: event.source.surface });
  });
  const actions = createCoachNoteActions({ screen: 'coach_tab' });
  await actions.clearCoachNote(noteId);
  assert(seen.length > 0, 'the clear recorded nothing at all');
  assert(seen.every((s) => s.screen === 'coach_tab'),
    `a note cleared on My Status was recorded as ${seen.map((s) => s.screen).join(',')} — `
    + 'the ledger would say the athlete acted on a screen they never opened');
});

run('the program tab still records the program tab', async () => {
  // non-vacuity: the same door, the other source, must still say program_tab
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:coach-note-action-source`
Expected: FAIL — `createCoachNoteActions` does not exist yet.

- [ ] **Step 3: Create the hook, moving the bodies verbatim and parameterising only the source**

Move `handleClearCoachNote` (`useHomeScreen.ts:1331`) and
`handleUpdateCoachNoteStatus` (`:1456`) plus the injury/confirm sheet state.
Every `screen: 'program_tab'` inside the moved code becomes `screen`, taken from
the hook's argument. **Do not change any other behaviour in this task.**

- [ ] **Step 4: Re-point `useHomeScreen` at the hook**

`useHomeScreen` mounts `useCoachNoteActions({ screen: 'program_tab' })` and
re-exports the same names it exports today (`:1683`, `:1685`), so no caller
changes in this task.

- [ ] **Step 5: Run the cell and the neighbours**

Run: `npm run test:coach-note-action-source && npm run test:action-log && npm run test:coach-tab-slice3 && npm run test:decision-ledger-ownership`
Expected: all PASS.

- [ ] **Step 6: Mutation-test the parameter**

Hard-code `screen: 'program_tab'` back inside the hook. Expected: the My Status
cell REDS and the program-tab cell stays green. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/screens/coach/useCoachNoteActions.ts src/__tests__/coachNoteActionSourceTests.ts src/screens/home/useHomeScreen.ts package.json
git commit -m "refactor(coach-notes): THE WRITERS TAKE THEIR SOURCE AS A PARAMETER — a lift to My Status can no longer forge the surface"
```

---

### Task 2: (a) + (b) — the seven go live and the caption retires, IN ONE COMMIT

**Files:**
- Modify: `src/screens/coach/CoachTabScreen.tsx:464` (real `equipmentFactIds`), `:466-474` (route all eight kinds)
- Modify: `src/screens/coach/CoachStatusScreen.tsx:168` (`LIVE_ACTION_KINDS`), `:125-131` (drop `actionsNotYet`)
- Modify: `src/components/ActiveModifiersSection.tsx` (remove the not-yet machinery)
- Modify: `src/rules/projectionCopy.ts:378` (retire the caption)
- Modify: `src/__tests__/repoLawGuardsTests.ts:1595-1625` (retire the `NOT_YET_SURFACE` cell)
- Modify: `src/__tests__/coachTabSlice3Tests.ts:1394` (asserts the caption text)

**Interfaces:**
- Consumes: `useCoachNoteActions` from Task 1.

- [ ] **Step 1: Write the failing cell — every kind is live on My Status**

```ts
run('My Status offers no dead controls', () => {
  const source = read('src/screens/coach/CoachStatusScreen.tsx');
  for (const kind of ALL_ACTION_KINDS) {   // the 8 in activeProgramModifiers.ts:62-70
    assert(LIVE_ACTION_KINDS.includes(kind),
      `${kind} is still inert on the screen that owns the modifiers`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail** — seven kinds missing.

- [ ] **Step 3: Wire the seven through the hook** in `CoachTabScreen`'s
  `onAction`, mounting `useCoachNoteActions({ screen: 'coach_tab' })`, and pass
  its real `equipmentFactIds` instead of `EMPTY_EQUIPMENT_FACT_IDS`.

- [ ] **Step 4: Grow `LIVE_ACTION_KINDS` to all eight** and drop `actionsNotYet`
  at `CoachStatusScreen.tsx:129`.

- [ ] **Step 5: Retire the caption and its guard IN THIS SAME COMMIT** —
  `projectionCopy.ts:378`, the not-yet machinery in `ActiveModifiersSection`,
  the `NOT_YET_SURFACE` cell, and the `coachTabSlice3Tests` assertion. Record in
  the guard's place WHY it went (its founding case is preserved in
  `lawRegistry.ts:541`).

- [ ] **Step 6: Run the chain**

Run: `npm run test:coach-tab-slice3 && npm run test:repo-law-guards && npm run test:copy-rulings-binding && npm run test:approved-icons && npm run test:coach-note-action-source`

- [ ] **Step 7: LOOK AT IT.** Seed and photograph — this unit is glass and a
  green id proves presence, not placement.

```bash
E2E_METRO_URL=http://127.0.0.1:8081 ~/.maestro/bin/maestro test -e E2E_METRO_URL=http://127.0.0.1:8081 .maestro/golden/coach-status-modifiers.yaml
```

The flow: seed `standard-in-season-week`, open Coach → My Status, expand a
modifier, screenshot the expanded row, tap one freed action, screenshot the
result. Use `visibilityPercentage: 40` when scrolling; match literal subtitles,
never ALL-CAPS titles.

- [ ] **Step 8: Commit (a)+(b) together — never separately.**

---

### Task 3: (c) — delete the Program-side leftovers

**Files:**
- Modify: `src/screens/home/HomeScreenV2.tsx` — `handleCoachNoteAction` (`:350`),
  its state (`:238`, `:242`), `clearCopyForNote` (`:2583`), `CoachNoteSheet`
  (`:2634`, mount `:1190`), the DUPLICATE injury mount (`:1198`) —
  **keep `:1148`, it is live** — and the false comment (`:2578`).

- [ ] **Step 1: Write the failing cell** asserting the Program tab mounts the
  injury sheet exactly ONCE and no longer defines a coach-note handler.
- [ ] **Step 2: Run it and watch it fail** (two mounts today).
- [ ] **Step 3: Delete the leftovers**, keeping `:1148`.
- [ ] **Step 4: Run** `npm run test:coach-tab-slice3 && npm run test:athlete-door-matrix && npm run test:action-walker`
- [ ] **Step 5: Photograph the Program tab** — the modifier strip must still
  render as a READ-ONLY indicator with no dead buttons.
- [ ] **Step 6: Commit.**

---

## Self-review

- **Spec coverage:** (a) Task 2 · (b) Task 2, same commit · (c) Task 3 ·
  `EMPTY_EQUIPMENT_FACT_IDS` Task 2 · the extraction Task 1 · both pricing
  findings carried into Global Constraints.
- **Ordering:** (a)+(b) one commit, (c) after — enforced by task order.
- **Names:** `useCoachNoteActions` / `createCoachNoteActions` (hook and its
  testable factory), `clearCoachNote`, `updateCoachNoteStatus`,
  `LIVE_ACTION_KINDS`, `ALL_ACTION_KINDS` — used consistently across tasks.
- **Known gap, stated:** the exact bodies of the two writers are not reproduced
  here; Task 1 moves them verbatim from the cited line ranges rather than
  retyping them, which is the safer instruction for this particular refactor.
