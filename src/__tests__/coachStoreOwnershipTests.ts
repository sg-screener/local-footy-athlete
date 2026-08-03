/**
 * COACH STORE OWNERSHIP — the store-armour recipe, fleet wave 2a.
 *
 * `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`. The chat history is the athlete's
 * own words — the injuries they reported, the changes they asked for — and the
 * coach's replies explaining why their week changed. It is restored across
 * relaunches to rebuild conversation context, and AGENTS.md names recent chat
 * as a follow-up target-resolution input, so a wiped `messages` list loses both
 * the athlete's record and the context the next request resolves against. This
 * suite holds the four protections: one door (`applyCoachStoreWrite`) with
 * typed refusals, every write on the tape, a quarantine boundary at the
 * persistence writer, and a build failure on any writer around the owner.
 *
 * LR-6 note: this is store-ownership work, allowed under Sam's sequencing
 * ruling. No coach pipeline path changes WHAT it does — CoachScreen's persist
 * effect becomes a NAMED WRITER of the door, behaviour identical. The refusal
 * guards the bare-wipe class.
 *
 * `activeConversation` is deliberately a RIDER, not material: it is a
 * navigation pointer holding a copy of one conversation, and the copy's
 * originals are the material `conversations`/`messages` slices. It travels
 * through the door so `setActiveConversation` stays one write, but never
 * counts toward the wipe decision. `isStreaming`/`isLoading`/`error` are
 * UI-only and keep their plain `set`.
 *
 * Run: npm run test:coach-store-ownership
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


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';
import {
  useCoachStore,
  applyCoachStoreWrite,
  beginCoachStoreResetAction,
  endCoachStoreResetAction,
  coachStoreGuardedStorage,
  COACH_STORE_PERSISTENCE_KEY,
} from '../store/coachStore';
import type { CoachConversation, CoachMessage } from '../types/domain';
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

/** REAL chat text, so the privacy assertions test the values that matter. */
const ATHLETE_WORDS = 'My hamstring is really tight, can we go easier on Tuesday?';
const COACH_WORDS = 'Done — Tuesday Lower is swapped to an upper pull session.';

function athleteMessage(id: string): CoachMessage {
  return {
    id,
    conversationId: 'conv-hamstring',
    role: 'user',
    content: ATHLETE_WORDS,
    createdAt: new Date().toISOString(),
  };
}

function coachReply(id: string): CoachMessage {
  return {
    id,
    conversationId: 'conv-hamstring',
    role: 'assistant',
    content: COACH_WORDS,
    createdAt: new Date().toISOString(),
  };
}

function conversation(id: string): CoachConversation {
  return {
    id,
    userId: 'athlete-1',
    topic: 'injury',
    title: 'Hamstring tightness',
    messages: [athleteMessage(`${id}-m1`)],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const materialSnapshot = () => {
  const state = useCoachStore.getState();
  return JSON.stringify({
    conversations: state.conversations,
    messages: state.messages,
  });
};

/** Empty the material slice through the door with a reset act. */
function resetCoachChat(): void {
  const id = beginCoachStoreResetAction('test_reset');
  try {
    applyCoachStoreWrite({
      next: { conversations: [], activeConversation: null, messages: [] },
      writer: 'reset',
      resetActionId: id,
    });
  } finally {
    endCoachStoreResetAction(id);
  }
}

console.log('\n-- Coach store ownership (store-armour recipe, wave 2a) --');

run('the door refuses the default over answered chat', () => {
  resetCoachChat();
  clearAllQuarantines();
  // Acted through the store's own actions — the real writers.
  useCoachStore.getState().addMessage(athleteMessage('m1'));
  useCoachStore.getState().addMessage(coachReply('m2'));
  useCoachStore.getState().setConversations([conversation('conv-hamstring')]);
  const before = materialSnapshot();

  const outcome = applyCoachStoreWrite({
    next: { conversations: [], activeConversation: null, messages: [] },
    writer: 'coach_screen',
  });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_chat',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(materialSnapshot() === before,
    'the refused write changed the store anyway');
});

run('a reduced-but-nonempty patch passes, and a patch only writes its own keys', () => {
  // Persisting a shorter message list is a decision, not the wipe (recipe
  // lesson 3), and a messages-only patch must not touch the conversations.
  const conversationsBefore = JSON.stringify(useCoachStore.getState().conversations);
  const outcome = applyCoachStoreWrite({
    next: { messages: [athleteMessage('m1')] },
    writer: 'coach_screen',
  });
  assert(outcome.ok, `a reduction was refused as if it were the wipe: ${JSON.stringify(outcome)}`);
  assert(useCoachStore.getState().messages.length === 1,
    'the reduction did not land');
  assert(JSON.stringify(useCoachStore.getState().conversations) === conversationsBefore,
    'a messages-only patch rewrote the conversations');
});

run('a stale reset id is refused', () => {
  const id = beginCoachStoreResetAction('test_stale');
  endCoachStoreResetAction(id);
  const outcome = applyCoachStoreWrite({
    next: { conversations: [], activeConversation: null, messages: [] },
    writer: 'reset',
    resetActionId: id,
  });
  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id still erased the store: ${JSON.stringify(outcome)}`);
  assert(useCoachStore.getState().messages.length === 1,
    'the stale-reset write emptied the store');
});

run('an in-flight reset erases, and says so', () => {
  const from = athleteActionLogEntries().length;
  useCoachStore.getState().clear();
  const state = useCoachStore.getState();
  assert(state.conversations.length === 0 && state.messages.length === 0
    && state.activeConversation === null,
    'the reset did not empty the store');
  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_store_write');
  assert(writes.length === 1 && writes[0]!.writer === 'reset'
    && writes[0]!.outcome === 'applied',
    `the reset write is not named on the tape: ${JSON.stringify(writes)}`);
  // Lesson 12: the act travels under the filter-safe key `erasureActId` —
  // any key containing "set" is eaten by the diagnostics filter.
  assert(typeof writes[0]!.erasureActId === 'string'
    && String(writes[0]!.erasureActId).includes('coach_store_clear'),
    `the erasure act is not named on the tape: ${JSON.stringify(writes[0])}`);
});

run('every coach-store write is on the tape, refused or not — counts, never the chat', () => {
  useCoachStore.getState().addMessage(athleteMessage('m1'));
  useCoachStore.getState().addMessage(coachReply('m2'));
  const from = athleteActionLogEntries().length;

  const refused = applyCoachStoreWrite({
    next: { conversations: [], activeConversation: null, messages: [] },
    writer: 'coach_screen',
  });
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  applyCoachStoreWrite({
    next: { messages: [athleteMessage('m1')] },
    writer: 'coach_screen',
  });

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_store_write');
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 coach-store writes`);
  assert(writes[0]!.outcome === 'refused'
    && writes[0]!.writer === 'coach_screen'
    && writes[0]!.internalResultCode === 'default_over_answered_chat',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied'
    && writes[1]!.messageCountBefore === 2 && writes[1]!.messageCountAfter === 1
    && writes[1]!.conversationCountBefore === 0 && writes[1]!.conversationCountAfter === 0,
    `the tape does not record the counts either side: ${JSON.stringify(writes[1])}`);

  // PRIVACY, asserted with the real acted-in chat: the athlete's words, the
  // coach's reply, ids and roles are answers and never travel.
  const serialised = JSON.stringify(writes);
  assert(!serialised.includes('hamstring') && !serialised.includes('Tuesday')
    && !serialised.includes(ATHLETE_WORDS) && !serialised.includes(COACH_WORDS),
    `chat text reached the tape: ${serialised}`);
  assert(!serialised.includes('conv-hamstring') && !serialised.includes('upper pull'),
    `a conversation id or reply fragment reached the tape: ${serialised}`);
});

run('no writer can reach the chat slices around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(path.join(srcRoot, 'store', 'coachStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyCoachStoreWrite');
  assert(ownerStart > 0, 'the coach-store write owner is gone');

  const setStateCalls = storeSource.split('useCoachStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in coachStore — exactly one, the owner's, may exist`);
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useCoachStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner (${ownerStart}..${ownerEnd})`);

  // The zustand actions may keep a bare `set` only for the UI-only flags. A
  // 160-char window after each call is asserted clean of the material keys —
  // narrower than the coach-updates suite's 400 because every bare set here
  // is a one-line flag write, and a wider window would false-positive on the
  // DOOR call inside `clear()` that legitimately follows the last flag setter.
  for (const match of storeSource.matchAll(/\bset\(/g)) {
    const window = storeSource.slice(match.index!, match.index! + 160);
    for (const materialKey of ['conversations:', 'messages:', 'activeConversation:']) {
      assert(!window.includes(materialKey),
        `a store action assigns ${materialKey.slice(0, -1)} directly around offset ${match.index}: `
        + window.slice(0, 120));
    }
  }

  // REPO-WIDE INCLUDING TESTS — a DECLARED asymmetry with the calendar and
  // coach-updates sweeps (recipe lesson 4), chosen because zero suites seed
  // this store: there was nothing to convert, so the widest scope is free.
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const relative = path.relative(srcRoot, full);
      if (relative === path.join('store', 'coachStore.ts')) continue;
      // This suite's own sweep carries the search string as a literal — the
      // law statement, not a surviving writer (the audit suite's precedent).
      if (relative === path.join('__tests__', 'coachStoreOwnershipTests.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useCoachStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `file(s) write the coach store around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  resetCoachChat();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(COACH_STORE_PERSISTENCE_KEY),
    'the coach store never registered its writer boundary');

  const material = JSON.stringify({
    state: {
      conversations: [],
      activeConversation: null,
      messages: [athleteMessage('m1')],
      isStreaming: false,
      isLoading: false,
      error: null,
    },
    version: 0,
  });
  const bare = JSON.stringify({
    state: {
      conversations: [], activeConversation: null, messages: [],
      isStreaming: false, isLoading: false, error: null,
    },
    version: 0,
  });

  await coachStoreGuardedStorage.setItem(COACH_STORE_PERSISTENCE_KEY, material);
  quarantineRefusedPayload(COACH_STORE_PERSISTENCE_KEY, material);
  await coachStoreGuardedStorage.setItem(COACH_STORE_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await coachStoreGuardedStorage.getItem(COACH_STORE_PERSISTENCE_KEY) === material,
    'a bare payload overwrote a quarantined one — this is the wipe');

  await coachStoreGuardedStorage.setItem(COACH_STORE_PERSISTENCE_KEY, material);
  await flushPendingStorageWrites();
  assert(await coachStoreGuardedStorage.getItem(COACH_STORE_PERSISTENCE_KEY) === material,
    'a material payload was refused while quarantined — that strands the athlete');
  await coachStoreGuardedStorage.setItem(COACH_STORE_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await coachStoreGuardedStorage.getItem(COACH_STORE_PERSISTENCE_KEY) === bare,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

void Promise.all(pendingAsync).then(() => {
  console.log(`\nCoach store ownership totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
