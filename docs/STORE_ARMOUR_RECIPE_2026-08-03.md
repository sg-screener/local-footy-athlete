# The Store Armour Recipe — 2026-08-03

> **PROVEN 2026-08-03** against `calendarStore` and `athletePreferencesStore`
> (branch `feat/store-armour-calendar-prefs`). Every deviation the two
> applications forced is recorded in "What the two applications taught" at the
> bottom — read that section before armouring the next store; it is the part
> a fresh agent cannot derive from the recipe alone.

**What this is.** The transferable form of the protections the profile-wipe
saga (`docs/LOST_ONBOARDING_DIAGNOSIS_2026-07-30.md`) and the hydration wipe
(`docs/HYDRATION_WIPE_DIAGNOSIS_2026-07-30.md`) forced onto `profileStore` and
`programStore` — distilled so a fresh agent can armour any of the remaining
persisted stores cold. It is the working form of LR-1/LR-2 (census
`docs/LEGACY_RECKONING_CENSUS_2026-07-30.md`), under laws L-A2 (one door),
L-D1 (every writer on the tape), L-E2 (declared debt only goes down), and the
standing wipe law: **a refusal must never persist the state it refused into.**

**Why this shape and not another.** Both wipes had the same anatomy: nothing
between a destructive write and the athlete's only copy. The profile fix
proved the counter-shape — one owner that can refuse, a tape that names every
writer, and a build failure on any writer around the owner. The hydration fix
added the fourth piece: a quarantine at the persistence boundary, because the
wipe that killed the program was legal *in memory* and only lethal at the
disk. Four protections, one recipe.

Fidelity sources (read them before armouring a store — they are the recipe's
precedents, and every deviation needs a reason):

- Door + refusals + reset acts + tape: `src/store/profileStore.ts:216-380`
- Static writer sweep: `src/__tests__/profileMirrorNarrowingTests.ts:519-553`
- Quarantine boundary: `src/store/programStore.ts:256-360`,
  `src/store/refusedPayloadQuarantine.ts`
- Writer-audit ratchet: `src/__tests__/storedStateWriterAuditTests.ts`
- Census ratchet: `src/data/legacyReckoningCensus.ts`

---

## 1. The door

One exported owner function per store, in the store's own file:

```ts
apply<Store>Write(args: {
  next: <MaterialSlice>;
  writer: <Store>WriterId;          // a CLOSED string union — every writer named
  resetActionId?: string;
}): { ok: boolean; reason?: <RefusalReason> }
```

- **Every write of the material slice goes through it** — including the
  store's own zustand actions, which become thin builders of `next`.
- **The material slice** is the part an athlete would lose: `markedDays`, not
  `selectedDate`; `prefs`, not a loading flag. UI-only state may keep its
  plain `set`, and the sweep (§4) asserts those sets never carry the slice.
- **Two refusal shapes, verbatim from the profile door:**
  - `default_over_answered_*` — writing the store's built-in default over
    material state, with no reset act. The default is not a value.
  - `reset_action_not_in_flight` — a reset id that is stale. An in-flight
    reset, not a reset that happened: a deferred write belonging to a
    finished reset is exactly the suspected shape of the profile loss.
- **Reset acts:** `begin<Store>ResetAction(source): string` /
  `end<Store>ResetAction(id)`, a module-level in-flight `Set`. The store's
  `clear()` opens one around its own door call — erasure is the one write
  that may empty the store, and it says so.

## 2. The tape

The door records **applied and refused alike**, before returning:

```ts
emitAthleteActionEvent(beginAthleteActionTrace({
  source: /* 'tap' for the athlete-facing writer, 'system' otherwise */,
  actionType: 'program_change',
  route: 'apply<Store>Write',
}, undefined, { forceRoot: true }), '<store>_write', {
  writer, outcome,                      // 'applied' | 'refused'
  /* material COUNTS before and after — never values */
  ...(reason ? { internalResultCode: reason } : {}),
  ...(resetActionId ? { resetActionId } : {}),
});
```

- **The event name joins `DECISION_EVENTS`** in
  `src/utils/athleteActionLog.ts` — otherwise one §18 repair search can evict
  it from the ring (export 6's lesson).
- **Counts and labels only, never answers.** Exercise names, injury keys,
  dates and profile values are answers. The ownership suite asserts the
  serialized entries carry none of them.

## 3. The quarantine

At module load, in the store file:

```ts
registerQuarantineBoundary('<persist-key>', {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as { state?: ... }).state;
      return /* does the parsed slice hold ≥1 athlete-material item? */;
    } catch { return false; }          // unreadable bytes prove nothing
  },
});
```

The persist `storage` is wrapped so the store has **one writer boundary**:

```ts
setItem: async (name, value) => {
  const decision = decideQuarantinedWrite(name, value);
  if (!decision.allowed) { /* tape a persistence_result failure; return */ }
  releaseQuarantine(name);             // a material write IS the lift succeeding
  await base.setItem(name, value);
},
```

The door's refusal path captures the disk copy, best-effort and async —
the DISK copy, not memory; memory rolled back correctly in both wipes:

```ts
void base.getItem('<persist-key>')
  .then((v) => quarantineRefusedPayload('<persist-key>', v))
  .catch(() => {});
```

In memory only, deliberately — a fresh install has no quarantine by
construction, and `storedStateWriterAuditTests` proves the empty-payload
no-arm property on the owner.

## 4. The gates — one ownership suite per store

`src/__tests__/<store>OwnershipTests.ts`, wired into `test:bible`. Six cells:

1. **The door refuses the default over answered state** — act real material
   in, write the default with no reset act, assert the typed refusal and the
   state unchanged.
2. **A stale reset id is refused** — begin + end, then write with the dead id.
3. **An in-flight reset erases, and says so** — `clear()` empties the store;
   the tape entry says `writer: 'reset'`, `outcome: 'applied'`.
4. **Every write is on the tape, refused or not** — one refused + one applied,
   counts correct either side, and the serialized entries carry no answer
   values (assert with the real values you acted in).
5. **No writer can reach the slice around the owner** — static sweep:
   exactly one `use<Store>.setState(`/material `set(` in the store file,
   inside the owner's body; zero in every other `src/` file.
6. **The writer boundary refuses a bare payload over a held one** — quarantine
   a material envelope, attempt a bare write through the wrapped storage,
   assert disk unchanged; then a material write passes and releases.

Then **mutation-test the gate** (L-E4; commit first): door bypass, refusal
deleted, tape silenced, boundary unregistered — each must turn exactly the
cell built to see it red.

## 5. The ratchets — same commit, both of them

- **Writer audit:** delete the store from `UNPROTECTED_STORES_DEBT` in
  `storedStateWriterAuditTests.ts`. The audit's stale-check fails until you
  do, so this cannot be forgotten — that is the ratchet working.
- **Census:** in `src/data/legacyReckoningCensus.ts`, set the store's
  registry entry to `owner: 'apply<Store>Write'`, `taped: true`; decrement
  LR-2's `declared` by 1 per store; decrement `LEGACY_DEBT_BASELINE` by the
  same total. `foundingCount` records a measurement — never edit it.

## 6. The walker replays the refusal

One cell per store in `athleteActionWalkerTests.ts`: walk a real history to
accumulated state (through `host.perform`, never seeded), snapshot the slice,
call the door with the wipe shape, assert the typed refusal, byte-identical
survival, and the refused entry on the tape. State the depth the walk reached
(L13) — a shallow cell must say it is shallow.

---

## The remaining stores (the fleet phase applies this recipe to each)

| Store | Persist key | Material slice |
|---|---|---|
| `readinessStore` | `readiness-store` | `signalsByDate` |
| `coachUpdatesStore` | `coach-updates` | update cards |
| `coachMutationHistoryStore` | `coach-mutation-history-store` | mutation history |
| `coachPreferencesStore` | `coach-preferences-store` | modality preferences |
| `coachStore` | `coach-store` | chat history |
| `coachMemoryStore` | `coach-memory-store` | coach notes |
| `uiStore` | `ui-store` | (decide: likely nothing material) |
| `authStore` | `auth-store` | session identity |
| `profileStore` | `profile-store` | **quarantine only** — door, tape and sweep already exist |
| `programStore` | `program-store` | **door only** — quarantine and tape exist; the door is LR-1 proper (`setManualOverride`, 27 refs) |

Coach-store doors are LR-2 store-ownership work and allowed under Sam's
sequencing ruling; changing what any coach path DOES stays behind the LR-6
STOP.

---

## What the two applications taught (2026-08-03)

Deviations and discoveries, each with its reason — a fresh agent follows the
recipe THEN this list:

1. **A transaction-written store needs a reset-act fallback at the door.**
   `calendarStore.clear()` erases through `commitCalendarStateTransaction`,
   and the door's write happens deep inside the commit, which cannot thread
   an id without changing the transaction's API. The door therefore falls
   back to `activeCalendarResetActionId()` — the act currently in flight —
   when no id is passed. The property that matters (a write belonging to a
   FINISHED reset is refused) survives, because the fallback also finds
   nothing once the act ends.
2. **A rollback restore is a legitimate erasure — under a reset act.** The
   coach-mutation rollback may restore "no marks yet" over the failed
   transaction's own marks. Unlike the profile default (a state that was
   almost certainly a wipe), an empty calendar is a common real state, so
   the restore opens a reset act (`coach_mutation_rollback`) rather than
   being refused. The profile door refuses its rollback-to-default instead;
   both choices are deliberate and the difference is the store's default.
3. **Reduction is not the wipe.** `clearAllGames` writes FEWER marks (rest
   marks survive a phase change). The refusal fires only on the bare
   default over material state. Refusing reduction would refuse the athlete.
4. **The sweep's scope is a per-store decision, declared in the cell.**
   Prefs: repo-wide including tests (3 seeding sites converted to doors —
   cheap, and the fixture law prefers it). Calendar: product-code only,
   because 31 established suites seed `markedDays` as fixture state and
   converting them is the walker's arc. The asymmetry is stated in the
   cell's comment, never silent.
5. **Tape witnesses are COUNTED, not index-sliced.** A walked world floods
   the 200-entry ring to its cap, where append+trim keeps the length
   constant and an index taken "before" points past every later entry.
6. **The suite's own sweep matches its own literals.** A repo-wide sweep
   finds the search string in the suite that performs it; self-exempt the
   suite file as the law statement (the writer-audit precedent).
7. **The raw-`AsyncStorage` base moves to `asyncStorageCompat`** when
   wrapping (prefs had the raw import). Compat is what every armoured store
   uses: durable-write tracking (`flushPendingStorageWrites`, which the
   quarantine cells need to await) and the node fallback for plain suites.
8. **Check the neighbours, and prove pre-existing reds at `main`.** The
   fixture-mutation suite (13 fails, equipment `ProgramGenError`) and
   `programControlActionsTests` fail IDENTICALLY on a clean detached
   worktree of `main` — recorded, not inherited silently. Method:
   `git worktree add --detach <scratch> main` + symlinked `node_modules`.
9. **The audit's stale-check schedules the debt paydown for you.** The
   moment the boundary registers, `test:stored-state-writer-audit` fails
   until the store leaves `UNPROTECTED_STORES_DEBT` — do it in the same
   commit as the boundary.
10. **The census pays in the same commit as the second store**, or the
    tree crosses a red gate between commits: `declared` and
    `LEGACY_DEBT_BASELINE` move together (directions 1 and 3).
11. **Removing the last answer is the athlete's change, not the wipe**
    (found by the coach-store application). A remove/clear action whose
    result happens to be the empty default is an attributed erasure —
    refusing it strands the athlete with an answer they cannot take back.
    The action declares the erasure with its own named reset act
    (`applyRemovalThroughDoor` in the prefs store is the template), and a
    cell pins it. The refusal stays aimed at UNATTRIBUTED default writes.
12b. **A `field:` regex sweep is blind to ES6 shorthand** (found by the
    tail's mutation 6): `set({ theme })` has no colon, so a sweep matching
    `theme:` never sees it. Sweep on the word, not the `word:` form.
12. **`resetActionId` never reaches the tape** — the diagnostics
    forbidden-key filter (`FORBIDDEN_EVENT_KEYS`) drops any field whose
    key contains "set", and "re**set**ActionId" does. Emit the act's name
    under the filter-safe key **`erasureActId`**. (The profile door's
    `resetActionId` field has been silently stripped since it shipped;
    known, not repaired here.)

## The five mutations, and who caught them (this unit's pass)

| # | Mutation | Caught by |
|---|---|---|
| 1 | Raw `useCalendarStore.setState` in `acceptedStateTransaction` | calendar sweep cell |
| 2 | Prefs refusal check deleted | 3 cells: refusal, stale-id, tape |
| 3 | Calendar refusal tape silenced | taped-either-way cell |
| 4 | Prefs quarantine boundary unregistered | writer audit (protected-or-declared) |
| 5 | Census un-paid (`declared` 9→11) | 4 census cells (directions 1/2/3 + detector completeness) |
