/**
 * COACH UPDATES STORE OWNERSHIP — the store-armour recipe, application 4.
 *
 * `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`. Update cards, active constraints
 * and the legacy activeInjury alias are the athlete's record of WHY their week
 * changed — a wiped card orphans a visible program change, and a wiped
 * constraint un-tells the engine about an injury the athlete reported. This
 * suite holds the four protections: one door (`applyCoachUpdatesWrite`) with
 * typed refusals, every write on the tape, a quarantine boundary at the
 * persistence writer, and a build failure on any product writer around the
 * owner.
 *
 * LR-6 note: this is store-ownership work, allowed under Sam's sequencing
 * ruling. No coach pipeline path changes WHAT it does — the accepted mirror
 * publish, the rollback restore and the constraint-transaction commits become
 * NAMED WRITERS of the door (each under its named reset act, because a
 * constraint set that empties when the last injury resolves is a common real
 * state), behaviour identical. The refusal guards the bare-wipe class.
 *
 * `dismissedCoachNoteIds` is deliberately NON-MATERIAL: the store's own JSDoc
 * calls dismissals presentation-only ("never alter accepted constraints or
 * program surfaces"); losing one re-shows a card, it does not lose an answer.
 * It travels through the door as a rider so the rollback restore stays whole,
 * but never counts toward the wipe decision.
 *
 * Run: npm run test:coach-updates-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};

import fs from 'fs';
import path from 'path';
import {
  useCoachUpdatesStore,
  applyCoachUpdatesWrite,
  beginCoachUpdatesResetAction,
  endCoachUpdatesResetAction,
  coachUpdatesGuardedStorage,
  COACH_UPDATES_PERSISTENCE_KEY,
  type ActiveConstraint,
} from '../store/coachUpdatesStore';
import {
  clearAllQuarantines,
  quarantineBoundaryKeys,
  quarantineRefusedPayload,
} from '../store/refusedPayloadQuarantine';
import { athleteActionLogEntries } from '../utils/athleteActionLog';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

const pendingAsync: Promise<void>[] = [];
function run(name: string, body: () => void | Promise<void>): void {
  const settle = (error?: unknown) => {
    if (error === undefined) {
      passed += 1;
      console.log(`  PASS ${name}`);
    } else {
      failed += 1;
      failures.push(name);
      console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
    }
  };
  try {
    const result = body();
    if (result instanceof Promise) {
      pendingAsync.push(result.then(() => settle(), (error) => settle(error)));
      return;
    }
    settle();
  } catch (error) {
    settle(error);
  }
}

function fatigueConstraint(id: string): ActiveConstraint {
  return {
    id,
    type: 'fatigue',
    severity: 4,
    status: 'active',
    startDate: '2026-08-07',
    lastUpdatedAt: new Date().toISOString(),
    rules: ['No sprinting or high-speed running'],
    safeFocus: ['Easy movement'],
    advice: ['Sleep early tonight'],
  };
}

const materialSnapshot = () => {
  const state = useCoachUpdatesStore.getState();
  return JSON.stringify({
    updatesByWeek: state.updatesByWeek,
    activeConstraints: state.activeConstraints,
    activeInjury: state.activeInjury,
  });
};

/** Empty the material slices through the door with a reset act. */
function resetCoachUpdates(): void {
  const id = beginCoachUpdatesResetAction('test_reset');
  try {
    applyCoachUpdatesWrite({
      next: {
        updatesByWeek: {},
        activeConstraints: [],
        activeInjury: null,
        dismissedCoachNoteIds: [],
      },
      writer: 'reset',
      resetActionId: id,
    });
  } finally {
    endCoachUpdatesResetAction(id);
  }
}

console.log('\n-- Coach updates ownership (store-armour recipe) --');

run('the door refuses the default over answered updates', () => {
  resetCoachUpdates();
  clearAllQuarantines();
  // Acted through the store's own card action (no constraint transaction —
  // upserts never enter the accepted machinery) plus the door for constraints.
  useCoachUpdatesStore.getState().upsertCoachUpdate('2026-08-03', {
    source: 'coach',
    reason: 'Hamstring flared up at training',
    rules: ['No sprinting or high-speed running'],
    changes: ['Tuesday Lower swapped to upper pull'],
  });
  const applied = applyCoachUpdatesWrite({
    next: { activeConstraints: [fatigueConstraint('fatigue-general')] },
    writer: 'constraint_transaction',
  });
  assert(applied.ok, `precondition: acting a constraint in through the door failed: ${JSON.stringify(applied)}`);
  const before = materialSnapshot();

  const outcome = applyCoachUpdatesWrite({
    next: { updatesByWeek: {}, activeConstraints: [], activeInjury: null },
    writer: 'accepted_mirror',
  });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_updates',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(materialSnapshot() === before,
    'the refused write changed the store anyway');
});

run('a reduced-but-nonempty patch passes, and a patch only writes its own keys', () => {
  // Clearing the constraints while a card survives is a decision (the injury
  // resolved), not the wipe. And a patch must not touch slices it does not
  // carry — the accepted mirror publishes constraints WITHOUT the cards.
  const updatesBefore = JSON.stringify(useCoachUpdatesStore.getState().updatesByWeek);
  const outcome = applyCoachUpdatesWrite({
    next: { activeConstraints: [] },
    writer: 'accepted_mirror',
  });
  assert(outcome.ok, `a reduction was refused as if it were the wipe: ${JSON.stringify(outcome)}`);
  assert(useCoachUpdatesStore.getState().activeConstraints.length === 0,
    'the reduction did not land');
  assert(JSON.stringify(useCoachUpdatesStore.getState().updatesByWeek) === updatesBefore,
    'a constraints-only patch rewrote the update cards');
});

run('a stale reset id is refused', () => {
  const id = beginCoachUpdatesResetAction('test_stale');
  endCoachUpdatesResetAction(id);
  const outcome = applyCoachUpdatesWrite({
    next: { updatesByWeek: {}, activeConstraints: [], activeInjury: null },
    writer: 'reset',
    resetActionId: id,
  });
  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id still erased the store: ${JSON.stringify(outcome)}`);
  assert(Object.keys(useCoachUpdatesStore.getState().updatesByWeek).length === 1,
    'the stale-reset write emptied the store');
});

run('an in-flight reset erases, and says so', () => {
  const from = athleteActionLogEntries().length;
  resetCoachUpdates();
  const state = useCoachUpdatesStore.getState();
  assert(Object.keys(state.updatesByWeek).length === 0
    && state.activeConstraints.length === 0 && state.activeInjury === null,
    'the reset did not empty the store');
  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_updates_write');
  assert(writes.length === 1 && writes[0]!.writer === 'reset'
    && writes[0]!.outcome === 'applied',
    `the reset write is not named on the tape: ${JSON.stringify(writes)}`);
});

run('every coach-updates write is on the tape, refused or not — counts, never answers', () => {
  useCoachUpdatesStore.getState().upsertCoachUpdate('2026-08-03', {
    source: 'coach',
    reason: 'Hamstring flared up at training',
    rules: ['No sprinting or high-speed running'],
    changes: ['Tuesday Lower swapped to upper pull'],
  });
  applyCoachUpdatesWrite({
    next: { activeConstraints: [fatigueConstraint('fatigue-general')] },
    writer: 'constraint_transaction',
  });
  const from = athleteActionLogEntries().length;

  const refused = applyCoachUpdatesWrite({
    next: { updatesByWeek: {}, activeConstraints: [], activeInjury: null },
    writer: 'coach_mutation_mirror',
  });
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  applyCoachUpdatesWrite({
    next: { activeConstraints: [] },
    writer: 'constraint_transaction',
  });

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_updates_write');
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 coach-updates writes`);
  assert(writes[0]!.outcome === 'refused'
    && writes[0]!.writer === 'coach_mutation_mirror'
    && writes[0]!.internalResultCode === 'default_over_answered_updates',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied'
    && writes[1]!.constraintCountBefore === 1 && writes[1]!.constraintCountAfter === 0
    && writes[1]!.updateCountBefore === 1 && writes[1]!.updateCountAfter === 1,
    `the tape does not record the counts either side: ${JSON.stringify(writes[1])}`);
  const serialised = JSON.stringify(writes);
  // A card's reason, a rule, an injury's body part and any DATE are answers.
  assert(!/\d{4}-\d{2}-\d{2}/.test(serialised.replace(/"at":"[^"]*"/g, '')),
    `a DATE reached the tape: ${serialised}`);
  assert(!/Hamstring|sprinting|Tuesday|fatigue-general/i.test(serialised),
    `an answer VALUE reached the tape: ${serialised}`);
});

run('no product writer can reach the material slices around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(path.join(srcRoot, 'store', 'coachUpdatesStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyCoachUpdatesWrite');
  assert(ownerStart > 0, 'the coach-updates write owner is gone');

  const setStateCalls = storeSource.split('useCoachUpdatesStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in coachUpdatesStore — exactly one, the owner's, may exist`);
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useCoachUpdatesStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner (${ownerStart}..${ownerEnd})`);

  // The zustand actions may keep a bare `set` only for the NON-MATERIAL
  // dismissal list. A 400-char window after each call is asserted clean of
  // the material keys — wide enough to cover any single set payload here.
  for (const match of storeSource.matchAll(/\bset\(/g)) {
    const window = storeSource.slice(match.index!, match.index! + 400);
    for (const materialKey of ['updatesByWeek:', 'activeConstraints:', 'activeInjury:']) {
      assert(!window.includes(materialKey),
        `a store action assigns ${materialKey.slice(0, -1)} directly around offset ${match.index}: `
        + window.slice(0, 120));
    }
  }

  // PRODUCT CODE ONLY — `__tests__/` is excluded, and that is a DECLARED
  // asymmetry with the prefs sweep, not an oversight: 52 established suites
  // seed this store directly as fixture state. Converting them to act through
  // doors is the walker's arc (hand-built fixtures are deprecated for
  // athlete-facing suites, AGENTS.md), not this unit's. Every writer an
  // athlete can meet — screens, utils, stores, dev/e2e seams — is swept.
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const relative = path.relative(srcRoot, full);
      if (relative === path.join('store', 'coachUpdatesStore.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useCoachUpdatesStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `product file(s) write the coach-updates store around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  resetCoachUpdates();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(COACH_UPDATES_PERSISTENCE_KEY),
    'the coach-updates store never registered its writer boundary');

  const material = JSON.stringify({
    state: {
      updatesByWeek: {},
      activeConstraints: [fatigueConstraint('fatigue-general')],
      activeInjury: null,
      dismissedCoachNoteIds: [],
    },
    version: 0,
  });
  const bare = JSON.stringify({
    state: {
      updatesByWeek: {}, activeConstraints: [], activeInjury: null, dismissedCoachNoteIds: [],
    },
    version: 0,
  });

  await coachUpdatesGuardedStorage.setItem(COACH_UPDATES_PERSISTENCE_KEY, material);
  quarantineRefusedPayload(COACH_UPDATES_PERSISTENCE_KEY, material);
  await coachUpdatesGuardedStorage.setItem(COACH_UPDATES_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await coachUpdatesGuardedStorage.getItem(COACH_UPDATES_PERSISTENCE_KEY) === material,
    'a bare payload overwrote a quarantined one — this is the wipe');

  await coachUpdatesGuardedStorage.setItem(COACH_UPDATES_PERSISTENCE_KEY, material);
  await flushPendingStorageWrites();
  assert(await coachUpdatesGuardedStorage.getItem(COACH_UPDATES_PERSISTENCE_KEY) === material,
    'a material payload was refused while quarantined — that strands the athlete');
  await coachUpdatesGuardedStorage.setItem(COACH_UPDATES_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await coachUpdatesGuardedStorage.getItem(COACH_UPDATES_PERSISTENCE_KEY) === bare,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

void Promise.all(pendingAsync).then(() => {
  console.log(`\nCoach updates ownership totals: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
