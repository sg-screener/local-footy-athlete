/**
 * Current coachUpdatesStore contract.
 *
 * The frozen conversational Coach integration used to live in this suite.
 * Step 2 of the clean-room rebuild deliberately leaves only the durable data
 * owner that the current app, Journal calculations and program-change door use.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const memory = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};

import {
  getActiveCoachUpdate,
  useCoachUpdatesStore,
} from '../store/coachUpdatesStore';

let passed = 0;
let failed = 0;

function check(name: string, condition: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}`);
}

useCoachUpdatesStore.setState({
  updatesByWeek: {},
  activeConstraints: [],
  dismissedCoachNoteIds: [],
});

const week = '2026-04-27';
const update = useCoachUpdatesStore.getState().upsertCoachUpdate(week, {
  source: 'coach',
  reason: 'Hamstring pain — 6/10',
  rules: ['No sprinting'],
  changes: ['Thursday: no sprinting in Team Training'],
});

check('upsert returns an active update', update.active === true);
check('the current week reads the same update', getActiveCoachUpdate(week)?.id === update.id);
check('another week remains empty', getActiveCoachUpdate('2026-05-04') === null);

useCoachUpdatesStore.getState().deactivateCoachUpdate(week);
check('deactivation hides the update', getActiveCoachUpdate(week) === null);
check('deactivation preserves the historical row',
  useCoachUpdatesStore.getState().updatesByWeek[week]?.active === false);

useCoachUpdatesStore.getState().clearAllCoachUpdates();
check('clear removes all update rows',
  Object.keys(useCoachUpdatesStore.getState().updatesByWeek).length === 0);

console.log(`\nCoach updates store: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
