# Store Armour Unit (LR-1+LR-2 opening) Implementation Plan

> **A UNIT RECIPE, SUPERSEDED AS A STATUS SURFACE.** Its boxes are that unit's
> steps, not app status. The governing plan is
> `docs/PUBLISH_ROADMAP_2026-08-05.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distil the transferable store-armour recipe from the profile/program stores' protections and apply it to the two highest-risk unowned persisted stores — `calendarStore` and `athletePreferencesStore` — with walker refusal replays, writer-audit debt paydown, and census ratchet paydown, proving the recipe before the remaining stores are parallelized.

**Architecture:** Each store gets the four protections the profile-wipe and hydration-wipe sagas produced: (1) ONE DOOR — a single exported owner function every write of the material slice goes through, with typed refusals of the wipe shape (the built-in default over answered state, unless a reset act is in flight); (2) THE TAPE — every write, applied or refused, emits a decision event naming its writer and the counts either side (counts and labels, never answers); (3) QUARANTINE — a registered writer boundary at the persistence layer that refuses to persist a bare payload while a refused material payload is held; (4) BUILD FAILURE ON A SECOND WRITER — a static sweep making any `setState`/`set` of the material slice outside the door a red gate. Paying the armour updates the two ratchets in the same commits: `UNPROTECTED_STORES_DEBT` (writer audit) and `PERSISTED_STORE_OWNERSHIP` + LR-2 `declared` + `LEGACY_DEBT_BASELINE` (legacy census).

**Tech Stack:** TypeScript, zustand persist stores, the repo's plain-node test suites (`npm run test:<name>`), `refusedPayloadQuarantine.ts`, `athleteActionDiagnostics`/`athleteActionLog` tape, `athleteActionWalker` harness.

## Global Constraints

- North star: store only decisions, derive everything else. No new stored state — this unit adds only doors, refusals, tape events and gates over EXISTING stored inputs. Boundary report must state the convergence answer.
- `git branch --show-current` immediately before EVERY commit (shared tree).
- Commit before mutation-testing; revert mutations by copying from the session scratchpad, never `git checkout -- <file>`.
- Tape privacy: counts and field labels only — never exercise names, injury detail, dates-as-answers, or profile values.
- LR-6 standing STOP: no coach-pipeline behaviour changes. Routing an existing coach writer through a store door is LR-2 store-ownership work (Sam's sequencing ruling 1) and is allowed; changing what any coach path DOES is not.
- The census ratchet's four directions: per-entry declared must match the detector; total ≤ baseline; baseline == current total; nothing creates headroom. Paying 2 units of LR-2: `declared: 11 → 9`, `LEGACY_DEBT_BASELINE: 114 → 112`. `foundingCount` is a measurement — never edited.
- `test:bible` EXIT=0 before merge; merge `--no-ff`; delete the branch pointer after merge.
- Boundary report per L12 (what catches the NEXT defect of this class) and L13 (state the depth the walker reached).
- Sam questions go to `docs/PARKED_QUESTIONS_2026-08-01.md`; unit summary goes to `docs/DAY_SHIFT_LOG_2026-08-01.md` (the standing day-log instruction).

## Recipe fidelity sources (read before implementing)

- Door + refusals + tape + static sweep: `src/store/profileStore.ts:216-380` (`applyProfileOnboardingWrite`, `beginProfileResetAction`), `src/__tests__/profileMirrorNarrowingTests.ts:492-553`.
- Quarantine boundary: `src/store/programStore.ts:256-360` (`registerQuarantineBoundary`, guarded `setItem`), `src/store/refusedPayloadQuarantine.ts`.
- Writer audit ratchet: `src/__tests__/storedStateWriterAuditTests.ts:113-125` (`UNPROTECTED_STORES_DEBT`).
- Census ratchet: `src/data/legacyReckoningCensus.ts:106-154` (`PERSISTED_STORE_OWNERSHIP`), `:359-375` (LR-2 entry), `:773` (`LEGACY_DEBT_BASELINE = 114`).
- Tape decision events: `src/utils/athleteActionLog.ts:120-142` (`DECISION_EVENTS`).

---

### Task 1: Scratch branch + recipe doc draft

**Files:**
- Create: `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`

**Interfaces:**
- Produces: the recipe doc later tasks follow and Task 8 finalizes with what the two applications taught.

- [ ] **Step 1: Branch.** `git branch --show-current` (expect `main`, clean tree), then `git checkout -b feat/store-armour-calendar-prefs`.
- [ ] **Step 2: Write the recipe doc draft** with the five sections below (full text at Task 8 — the draft carries the same structure with a `DRAFT — being proven against calendarStore and athletePreferencesStore` banner):
  1. **The door.** One exported `apply<Store>Write(args: { next; writer; resetActionId? }): { ok; reason? }` owner per store file. Every store action routes through it. Writers are a closed string union. Refusal shapes: `default_over_answered_state` (writing the built-in default over material state with no reset act) and `reset_action_not_in_flight` (a stale reset id). Reset acts: `begin<Store>ResetAction(source)` / `end<Store>ResetAction(id)` — an in-flight registry, ids die when the reset ends.
  2. **The tape.** The door records applied AND refused through `emitAthleteActionEvent(beginAthleteActionTrace({source, actionType, route}, undefined, {forceRoot: true}), '<store>_write', { writer, outcome, <material counts before/after>, internalResultCode? })`. The event name joins `DECISION_EVENTS` in `athleteActionLog.ts`. Counts and labels only.
  3. **The quarantine.** `registerQuarantineBoundary(persistKey, { carriesMaterial })` at module load; the store's persist storage is wrapped so `setItem` consults `decideQuarantinedWrite` (refuse → tape a `persistence_result` failure and return) and calls `releaseQuarantine` on an allowed write; the door's refusal path best-effort captures the current disk envelope into `quarantineRefusedPayload`.
  4. **The gates.** A per-store ownership suite asserting: door refuses the wipe shapes; reset act admits them; every write on the tape with counts; no value leakage; static sweep — exactly one `setState`/material `set` in the store file, inside the owner, and zero `use<Store>.setState(` in any other file; quarantine refuses bare-over-held and admits material.
  5. **The ratchets, same commit.** Delete the store from `UNPROTECTED_STORES_DEBT` (the audit's stale-check forces this once the boundary registers). Set `owner` + `taped: true` in `PERSISTED_STORE_OWNERSHIP`, decrement LR-2 `declared` and `LEGACY_DEBT_BASELINE` by 1 per store.
- [ ] **Step 3: Commit.** `git add docs/STORE_ARMOUR_RECIPE_2026-08-03.md && git commit` — `docs(store-armour): the recipe draft — five protections, two ratchets, to be proven on two stores`.

### Task 2: athletePreferencesStore armour (TDD)

**Files:**
- Create: `src/__tests__/athletePreferencesOwnershipTests.ts`
- Modify: `src/store/athletePreferencesStore.ts`, `src/utils/athleteActionLog.ts` (DECISION_EVENTS), `package.json` (script + bible chain)

**Interfaces:**
- Produces: `applyAthletePrefsWrite(args: { next: AthletePoolPrefs; writer: AthletePrefsWriterId; resetActionId?: string }): AthletePrefsWriteOutcome`; `beginAthletePrefsResetAction(source: string): string`; `endAthletePrefsResetAction(id: string): void`; `INITIAL_ATHLETE_PREFS`; writer union `'preference_control' | 'coach_action' | 'reset' | 'dev_seed'`; tape event `'athlete_prefs_write'` with fields `writer, outcome, excludedCountBefore/After, pinnedCountBefore/After, activeInjuryCountBefore/After`.

- [ ] **Step 1: Write the failing suite** `athletePreferencesOwnershipTests.ts` (same harness prologue as `storedStateWriterAuditTests.ts`: `__DEV__=false`, TZ, window.localStorage shim, fetch disabled). Cells:
  1. `the door refuses the default over answered prefs` — act `addExclusion('x')` + `addActiveInjury(<a real InjuryKey>)`, then `applyAthletePrefsWrite({ next: INITIAL_ATHLETE_PREFS, writer: 'preference_control' })` → `ok: false, reason: 'default_over_answered_prefs'`, store unchanged.
  2. `a stale reset id is refused` — `begin` + `end`, then write default with the dead id → `reason: 'reset_action_not_in_flight'`.
  3. `an in-flight reset erases, and says so` — `clear()` empties prefs and the tape entry has `writer: 'reset'`, `outcome: 'applied'`.
  4. `every prefs write is on the tape, refused or not` — index the tape, one refused + one applied, counts correct, and `JSON.stringify(entries)` contains neither the excluded exercise name nor the injury key (privacy).
  5. `no writer can reach prefs around the owner` — static sweep of `athletePreferencesStore.ts`: exactly one `set(` whose object carries `prefs`, inside `applyAthletePrefsWrite`; and for every other file under `src/` (walk like `storedStateWriterAuditTests.walkSrc`), zero matches of `useAthletePreferencesStore.setState(`.
  6. `the writer boundary refuses a bare payload over a held one` — `registerQuarantineBoundary` already ran at import; `quarantineRefusedPayload(key, <material envelope>)` then the wrapped storage `setItem` with a bare envelope leaves disk unchanged; a material envelope writes and releases.
- [ ] **Step 2: Run to verify it fails.** `npx ts-node` per repo suite convention — add `"test:athlete-prefs-ownership"` to package.json mirroring an existing suite's command shape first. Expected: FAIL (`applyAthletePrefsWrite` not exported).
- [ ] **Step 3: Implement the door** in `athletePreferencesStore.ts`, recipe-faithful to `applyProfileOnboardingWrite`:

```ts
export type AthletePrefsWriterId = 'preference_control' | 'coach_action' | 'reset' | 'dev_seed';
export interface AthletePrefsWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_prefs' | 'reset_action_not_in_flight';
}
export const INITIAL_ATHLETE_PREFS: AthletePoolPrefs = initialPrefs;

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;
export function beginAthletePrefsResetAction(source: string): string { /* profile pattern */ }
export function endAthletePrefsResetAction(id: string): void { /* profile pattern */ }

function materialCounts(prefs: AthletePoolPrefs) {
  return {
    excluded: prefs.excluded.length,
    pinned: prefs.pinned.length,
    activeInjuries: (prefs.activeInjuries ?? []).length,
  };
}
function isTheBuiltInDefault(prefs: AthletePoolPrefs): boolean {
  const c = materialCounts(prefs);
  return c.excluded === 0 && c.pinned === 0 && c.activeInjuries === 0;
}

export function applyAthletePrefsWrite(args: {
  next: AthletePoolPrefs; writer: AthletePrefsWriterId; resetActionId?: string;
}): AthletePrefsWriteOutcome {
  const before = materialCounts(useAthletePreferencesStore.getState().prefs);
  const record = (outcome: 'applied' | 'refused', reason?: string) => {
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: args.writer === 'preference_control' ? 'tap' : 'system',
      actionType: 'program_change',
      route: 'applyAthletePrefsWrite',
    }, undefined, { forceRoot: true }), 'athlete_prefs_write', {
      writer: args.writer, outcome,
      excludedCountBefore: before.excluded, pinnedCountBefore: before.pinned,
      activeInjuryCountBefore: before.activeInjuries,
      ...(afterCountsSpread()), // counts read after the set (0s on refusal path use `before`)
      ...(reason ? { internalResultCode: reason } : {}),
      ...(args.resetActionId ? { resetActionId: args.resetActionId } : {}),
    });
  };
  const beforeIsMaterial = before.excluded + before.pinned + before.activeInjuries > 0;
  if (isTheBuiltInDefault(args.next) && beforeIsMaterial) {
    if (!args.resetActionId) { record('refused', 'default_over_answered_prefs'); return { ok: false, reason: 'default_over_answered_prefs' }; }
    if (!resetActionsInFlight.has(args.resetActionId)) { record('refused', 'reset_action_not_in_flight'); return { ok: false, reason: 'reset_action_not_in_flight' }; }
  }
  useAthletePreferencesStore.setState({ prefs: args.next });
  record('applied');
  return { ok: true };
}
```

  Route every store action through the door (each builds `next` from `getState().prefs` and calls `applyAthletePrefsWrite({ next, writer: 'preference_control' })`; `clear()` opens/closes a reset act around a `writer: 'reset'` write). On the door's refusal path, best-effort quarantine the disk copy: `void storageBase.getItem('athlete-preferences-store').then((v) => quarantineRefusedPayload('athlete-preferences-store', v)).catch(() => {})`.
- [ ] **Step 4: Wire the quarantine boundary + wrapped storage** in the same file:

```ts
registerQuarantineBoundary('athlete-preferences-store', {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as { state?: { prefs?: AthletePoolPrefs } }).state;
      const p = state?.prefs;
      return !!p && (p.excluded.length > 0 || p.pinned.length > 0 || (p.activeInjuries ?? []).length > 0);
    } catch { return false; }
  },
});
const guardedPrefsStorage = {
  getItem: (name: string) => AsyncStorage.getItem(name),
  setItem: async (name: string, value: string) => {
    const decision = decideQuarantinedWrite(name, value);
    if (!decision.allowed) { /* tape a persistence_result failure like programStore.ts:316 and return */ }
    releaseQuarantine(name);
    await AsyncStorage.setItem(name, value);
  },
  removeItem: (name: string) => AsyncStorage.removeItem(name),
};
// persist config: storage: createJSONStorage(() => guardedPrefsStorage)
```

- [ ] **Step 5: Add `'athlete_prefs_write'` to `DECISION_EVENTS`** in `athleteActionLog.ts`.
- [ ] **Step 6: Run the suite.** Expected: PASS. Also run `npm run test:stored-state-writer-audit` — expected FAIL on the stale-debt cell (boundary now registered): delete `'athlete-preferences-store'` from `UNPROTECTED_STORES_DEBT`, re-run, PASS.
- [ ] **Step 7: Check external writers.** `grep -rn "useAthletePreferencesStore" src --include='*.ts' --include='*.tsx'` — all callers use store actions (which now route through the door); confirm none calls `setState` directly (the static sweep proves it). Dev seeds (`devE2EPersistence.ts`, `defaultDevE2ESeedCoordinator.ts`): if they write prefs raw, route through the door with `writer: 'dev_seed'`.
- [ ] **Step 8: Wire into bible** — add the suite to the `test:bible` chain in `package.json` next to its neighbours.
- [ ] **Step 9: Commit.** Verify branch first. `feat(store-armour): athletePreferencesStore gets the door, the tape, the quarantine and the sweep — exclusions, pins and injuries are refusable answers now`.

### Task 3: calendarStore armour (TDD)

**Files:**
- Create: `src/__tests__/calendarOwnershipTests.ts`
- Modify: `src/store/calendarStore.ts`, `src/store/acceptedStateTransaction.ts:806`, `src/store/coachMutationTransaction.ts:590`, `src/utils/athleteActionLog.ts`, `package.json`

**Interfaces:**
- Consumes: recipe from Task 1; quarantine/tape idioms identical to Task 2.
- Produces: `applyCalendarMarkedDaysWrite(args: { next: Record<string, CalendarDayType>; writer: CalendarWriterId; resetActionId?: string }): CalendarWriteOutcome`; `beginCalendarResetAction` / `endCalendarResetAction`; writer union `'accepted_transaction' | 'coach_mutation_mirror' | 'reset'`; tape event `'calendar_write'` with `markCountBefore/After`; optional `calendarResetActionId` passthrough on `commitCalendarStateTransaction` args.

- [ ] **Step 1: Write the failing suite** `calendarOwnershipTests.ts` — the same six cell shapes as Task 2 translated to marks: refuse `{}` over marked days without a reset act (`default_over_answered_marks`); stale id refused; `clear()` erases through an in-flight reset act and tapes `writer: 'reset'`; every write taped with `markCountBefore/After` and no DATE VALUES beyond counts in the entry (dates are answers here — assert the serialized entries carry no `\d{4}-\d{2}-\d{2}`); static sweep — exactly one `useCalendarStore.setState(` in `calendarStore.ts` inside the owner, zero in `acceptedStateTransaction.ts` and `coachMutationTransaction.ts` (and repo-wide); quarantine boundary refuses bare-over-held, admits material (`carriesMaterial` = parsed `state.markedDays` has ≥1 key).
- [ ] **Step 2: Run to verify it fails.** Expected: FAIL (`applyCalendarMarkedDaysWrite` not exported).
- [ ] **Step 3: Implement the door** in `calendarStore.ts` (same body shape as Task 2's door; material count = `Object.keys(markedDays).length`; refusal `default_over_answered_marks` only when `next` is `{}` over a non-empty map — `clearAllGames`' reduced-but-nonempty write passes untouched). `clear()` opens a reset act and threads it: add optional `calendarResetActionId?: string` to `commitCalendarStateTransaction` args, passed through to the door call. `setSelectedDate` stays a plain `set` — the sweep asserts its object never carries `markedDays`.
- [ ] **Step 4: Rewire the two transaction writers.** `acceptedStateTransaction.ts:806` → `applyCalendarMarkedDaysWrite({ next: staged.context.markedDays, writer: 'accepted_transaction', resetActionId: staged.calendarResetActionId })`; `coachMutationTransaction.ts:590` → `applyCalendarMarkedDaysWrite({ next: clone(mirrors.markedDays), writer: 'coach_mutation_mirror' })` (a rollback restore of a mirror is a restore, not a coach behaviour change — LR-6 untouched).
- [ ] **Step 5: Quarantine boundary + wrapped storage** (identical idiom to Task 2, key `'calendar-storage'`, base `asyncStorageCompat`). Add `'calendar_write'` to `DECISION_EVENTS`.
- [ ] **Step 6: Run the suite → PASS; run `test:stored-state-writer-audit` → delete `'calendar-storage'` from the debt list → PASS.** Also run `test:accepted-state-transactions` and the walker suite — the calendar path is load-bearing for both; fix any breakage at the caller, never by widening the door.
- [ ] **Step 7: Wire into bible; commit** (verify branch). `feat(store-armour): calendarStore's marks get the door, the tape, the quarantine and the sweep — the compatibility writers now answer to one owner`.

### Task 4: Census ratchet paydown

**Files:**
- Modify: `src/data/legacyReckoningCensus.ts`

**Interfaces:**
- Consumes: both doors' names from Tasks 2–3.

- [ ] **Step 1: Update the registry.** In `PERSISTED_STORE_OWNERSHIP`: calendar entry → `owner: 'applyCalendarMarkedDaysWrite'`, `taped: true`, caveat updated to record the compat writers now route through the owner; prefs entry → `owner: 'applyAthletePrefsWrite'`, `taped: true`.
- [ ] **Step 2: Pay the debt.** LR-2 `declared: 11` → `9` (foundingCount stays 11); `LEGACY_DEBT_BASELINE = 114` → `112`.
- [ ] **Step 3: Run `npm run test:legacy-census`.** Expected: PASS (any failure here means a direction fired — read it, do not re-baseline).
- [ ] **Step 4: Commit** (verify branch). `feat(store-armour): the census pays two units of LR-2 — calendar and athlete prefs are owned, taped, and the baseline tightens 114→112`.

### Task 5: Walker refusal replay against each armoured store

**Files:**
- Modify: `src/__tests__/athleteActionWalkerTests.ts`

**Interfaces:**
- Consumes: both doors; the walker host (`freshInstall`, `performAction`, `walk`).

- [ ] **Step 1: Write two cells** (after the `freshInstall is total` cell, which already checks prefs at :2075):
  1. `the calendar door refuses the wipe against a walked world` — `freshInstall()`; drive a real short walk history through `host.perform` (onboard → generate → ≥2 `mark_calendar` actions → `advance_time`); snapshot `JSON.stringify(useCalendarStore.getState().markedDays)`; call `applyCalendarMarkedDaysWrite({ next: {}, writer: 'accepted_transaction' })` → assert `ok: false`, marks byte-identical, and the tape's last `calendar_write` is `outcome: 'refused'`. State the depth in the cell name/comment (L13: this is a shallow-tier cell; the deep tier already crosses block boundaries elsewhere in the suite).
  2. `the prefs door refuses the wipe against a walked world` — same walked world; act `addExclusion` + `addActiveInjury` through the store's real actions; then `applyAthletePrefsWrite({ next: INITIAL_ATHLETE_PREFS, writer: 'preference_control' })` → refused, prefs byte-identical, tape refused entry.
- [ ] **Step 2: Run the walker suite.** Expected: PASS, including the pre-existing cells (the door refactor must not change any walked outcome — if a cell reds, the door changed behaviour and the door is wrong).
- [ ] **Step 3: Commit** (verify branch). `feat(store-armour): the walker replays the wipe against both doors — refusal, byte-identical survival, tape witness`.

### Task 6: Mutation-test the gates

- [ ] **Step 1: Confirm committed** (`git status` clean — mutation-testing law).
- [ ] **Step 2: Apply and revert each mutation** (copy originals to the scratchpad first; restore from scratchpad):
  1. Door bypass: add a raw `useCalendarStore.setState({ markedDays: {} })` in `acceptedStateTransaction.ts` → the static sweep cell must fail.
  2. Refusal deleted: make `applyAthletePrefsWrite` skip the default-over-answered check → ownership cell 1 must fail.
  3. Tape silenced: skip `record('refused', …)` on the calendar door → the taped-either-way cell must fail.
  4. Quarantine boundary unregistered (prefs) → `test:stored-state-writer-audit` must fail (store neither protected nor declared).
  5. Census un-paid: revert `declared: 9` → `11` with baseline at 112 → `test:legacy-census` direction 1/3 must fail.
- [ ] **Step 3: Record results** (which cell caught each) for the boundary report. Any survivor = fix the gate before proceeding.

### Task 7: Full gate + merge

- [ ] **Step 1: `npm run test:bible`** — EXIT=0 required. Known non-bible reds on main (`test:block-state`, `test:row-counting`) are pre-existing and not this unit's.
- [ ] **Step 2: `npm run test:compile`** — no file regresses.
- [ ] **Step 3: Merge.** `git branch --show-current`; `git checkout main && git merge --no-ff feat/store-armour-calendar-prefs`; verify ancestor; delete the branch pointer.

### Task 8: Recipe finalization + day log + boundary report

**Files:**
- Modify: `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`, `docs/DAY_SHIFT_LOG_2026-08-01.md`, `docs/PARKED_QUESTIONS_2026-08-01.md` (only if a Sam question emerged)

- [ ] **Step 1: Finalize the recipe doc** — remove the DRAFT banner; add a `What the two applications taught` section (every deviation the implementation forced); add the cold-start checklist a worktree agent follows per store: door → tape event + DECISION_EVENTS → quarantine + wrapped storage → ownership suite (6 cells) → debt-list deletion → census registry + declared + baseline decrement → walker refusal cell → mutation pass. Name the remaining nine stores and their material slices.
- [ ] **Step 2: Day log entry** under a new `# Store armour unit — 2026-08-03` heading: what merged, the two ratchet paydowns, the walker depth reached, the mutation results, NOT-COVERED (the nine remaining stores; prefs still missing from the walker's action VOCABULARY — reachable in cells by acting, not yet proposed in walks; the two hand-maintained registries not yet collapsed — that is the fleet phase's LR-2 remainder).
- [ ] **Step 3: Commit docs** (verify branch — this lands on main post-merge or on the branch pre-merge; either way verify).

## Self-Review Notes

- Spec coverage: recipe doc (T1/T8), two highest-risk stores (T2/T3), walker refusal replay each (T5), ratchet paydowns (T2/T3 debt list, T4 census), gate-green-always (T6/T7), day log + parked + boundary report (T8). Fleet parallelization is explicitly the NEXT session's work once this recipe is proven — out of scope here by the user's own sequencing.
- Type consistency: `applyAthletePrefsWrite`/`applyCalendarMarkedDaysWrite`, writer unions, and tape event names are used identically across T2–T5.
- The `afterCountsSpread()` sketch in T2 is shorthand — implement as the profile door does: read counts from `getState()` inside `record` after any set, exactly like `answerCountAfter` at `profileStore.ts:344`.
