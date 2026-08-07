/**
 * R2 — THE ENVELOPE → INPUTS EXTRACTION, gated.
 *
 * `docs/SHELL_REBUILD_PLAN_2026-08-05.md` §3 R2. The plan's own warning is
 * that MIGRATION IS WHERE REBUILDS DIE, so the extraction's properties are
 * cells before it is ever pointed at Sam's phone.
 *
 * The four properties:
 *
 *   1. IDEMPOTENT — running twice is running once.
 *   2. NON-DESTRUCTIVE — the parked envelope is byte-identical afterwards.
 *   3. FAITHFUL — removals become real door plan-changes; day placements
 *      carry the athlete's workout verbatim; restored removals do not come
 *      back from the dead.
 *   4. DERIVED CONTENT DOES NOT MIGRATE — `weekScopedOverlays` is not carried,
 *      by the same law the fixture identity unit enforced.
 *
 * The doubling hazard has its own cell (cell 2), because it is the one that
 * costs the athlete their edits twice over and the first implementation had
 * it: day placements are attributed to the coach, so an envelope holding ONLY
 * `dateOverrides` leaves no migration-provenance entry, and an idempotency
 * check reading provenance alone would run again and double everything.
 *
 * Run: npm run test:envelope-migration
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
import { asyncStorageCompat } from '../store/asyncStorageCompat';
import { PRE_REBUILD_ENVELOPE_PARKING_KEY } from '../store/programStore';
import {
  decisionLedgerEntries,
  beginDecisionLedgerResetAction,
  endDecisionLedgerResetAction,
  applyDecisionLedgerWrite,
} from '../store/decisionLedgerStore';
import {
  extractParkedEnvelopeDecisions,
  preRebuildDecisionsAlreadyMigrated,
} from '../store/preRebuildEnvelopeMigration';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => Promise<void> | void): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

/**
 * THROUGH THE DOOR, with a reset act — never `setState`. This store is born
 * under the armour law and `decisionLedgerOwnershipTests` scans the whole
 * repo, tests included: there is no fixture-seeding exemption to claim, and
 * the first draft of this file claimed one anyway and was caught.
 */
function resetLedger(): void {
  const id = beginDecisionLedgerResetAction('envelope-migration-tests');
  try {
    const outcome = applyDecisionLedgerWrite({
      next: [], writer: 'reset', resetActionId: id,
    });
    if (!outcome.ok) throw new Error(`ledger reset refused: ${outcome.reason}`);
  } finally {
    endDecisionLedgerResetAction(id);
  }
}

function workout(name: string): Record<string, unknown> {
  return {
    id: `w-${name}`,
    name,
    dayOfWeek: 3,
    workoutType: 'Strength',
    exercises: [{ id: 'e1', name: 'Back Squat', sets: 3, reps: '5' }],
  };
}

function removalConstraint(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    protocolVersion: 1,
    id: 'rc-1',
    authorship: 'user',
    source: 'tap',
    status: 'active',
    targetDate: '2026-08-12',
    scope: 'whole_day',
    targetPlanEntryId: null,
    targetWorkoutId: 'w-1',
    originalWorkout: workout('Removed'),
    remainingWorkout: null,
    equivalentExposureMayRelocate: false,
    wholeDayRestOwned: true,
    createdAt: '2026-08-04T09:00:00.000Z',
    restoredAt: null,
    restorationReason: null,
    ...overrides,
  };
}

/** Park an old-shape envelope exactly as R1.3's boot would have parked it. */
async function parkEnvelope(state: Record<string, unknown>): Promise<string> {
  const raw = JSON.stringify({ state, version: 1 });
  await asyncStorageCompat.setItem(PRE_REBUILD_ENVELOPE_PARKING_KEY, raw);
  return raw;
}

async function clearParked(): Promise<void> {
  await asyncStorageCompat.removeItem(PRE_REBUILD_ENVELOPE_PARKING_KEY);
}

const main = async (): Promise<void> => {
  console.log('\n-- R2 envelope → inputs extraction --');

  await run('a device with no old world migrates nothing and says so', async () => {
    resetLedger();
    await clearParked();
    const result = await extractParkedEnvelopeDecisions();
    assert(result.outcome === 'no_parked_envelope',
      `a fresh install answered "${result.outcome}"`);
    assert(decisionLedgerEntries().length === 0,
      'a fresh install put entries on the ledger');
  });

  await run('removals and day placements become ledger decisions', async () => {
    resetLedger();
    await parkEnvelope({
      dateOverrides: { '2026-08-11': workout('Athlete Session') },
      userRemovalConstraints: [
        removalConstraint({ id: 'rc-del', targetDate: '2026-08-12' }),
        removalConstraint({
          id: 'rc-move', mutationKind: 'move',
          targetDate: '2026-08-13', moveTargetDate: '2026-08-14',
          createdAt: '2026-08-04T10:00:00.000Z',
        }),
      ],
    });
    const result = await extractParkedEnvelopeDecisions();
    assert(result.outcome === 'migrated', `outcome was "${result.outcome}"`);
    assert(result.skipped.length === 0,
      `the extraction skipped decisions it should express: ${result.skipped.join('; ')}`);
    assert(result.dayPlacements === 1 && result.removals === 1 && result.moves === 1,
      `counts wrong: ${JSON.stringify(result)}`);

    const entries = decisionLedgerEntries();
    assert(entries.length === 3, `expected 3 entries, got ${entries.length}`);

    // THE PLACEMENT CARRIES THE ATHLETE'S WORKOUT VERBATIM — a migration that
    // paraphrases the content loses the very edits it exists to keep.
    const placement = entries.find((entry) =>
      entry.decision.kind === 'migrated_day_placement');
    assert(placement, 'the day placement did not reach the ledger');
    const placed = placement.decision as { date: string; workout: { name: string } };
    assert(placed.date === '2026-08-11', `placement date was ${placed.date}`);
    assert(placed.workout.name === 'Athlete Session',
      `placement lost its workout: ${JSON.stringify(placed.workout).slice(0, 120)}`);
    assert(placement.provenance === 'coach',
      `Sam's ruling attributes migrated dateOverrides to the coach; got `
      + `"${placement.provenance}"`);

    // THE REMOVALS ARE REAL DOOR VOCABULARY, not a migration dialect.
    const changes = entries
      .filter((entry) => entry.decision.kind === 'plan_change')
      .map((entry) => (entry.decision as { change: { kind: string } }).change);
    assert(changes.some((change) => change.kind === 'remove_session'),
      `no remove_session on the ledger: ${JSON.stringify(changes)}`);
    assert(changes.some((change) => change.kind === 'move_session'),
      `no move_session on the ledger: ${JSON.stringify(changes)}`);
  });

  await run('cell 2 — running twice is running once (the doubling hazard)', async () => {
    // THE COORDINATE THAT BROKE THE FIRST IMPLEMENTATION: an envelope whose
    // only decisions are dateOverrides. Those are appended `provenance:
    // 'coach'`, so an idempotency check reading provenance alone finds no
    // migration entry, runs again, and doubles the athlete's edits.
    resetLedger();
    await parkEnvelope({
      dateOverrides: {
        '2026-08-11': workout('Athlete Session'),
        '2026-08-12': workout('Second Session'),
      },
    });
    const first = await extractParkedEnvelopeDecisions();
    assert(first.outcome === 'migrated' && first.dayPlacements === 2,
      `first run wrong: ${JSON.stringify(first)}`);
    const afterFirst = JSON.stringify(decisionLedgerEntries());
    assert(preRebuildDecisionsAlreadyMigrated(),
      'a coach-attributed-only migration left no witness that it ran');

    const second = await extractParkedEnvelopeDecisions();
    assert(second.outcome === 'already_migrated',
      `the second run answered "${second.outcome}" and would migrate again`);
    assert(second.entriesAppended === 0,
      `the second run appended ${second.entriesAppended} entries`);
    assert(JSON.stringify(decisionLedgerEntries()) === afterFirst,
      'the ledger changed on the second run — the athlete\'s edits were doubled');
  });

  await run('the parked envelope is never written, moved or deleted', async () => {
    resetLedger();
    const parked = await parkEnvelope({
      dateOverrides: { '2026-08-11': workout('Athlete Session') },
      userRemovalConstraints: [removalConstraint({})],
    });
    await extractParkedEnvelopeDecisions();
    await extractParkedEnvelopeDecisions();
    const after = await asyncStorageCompat.getItem(PRE_REBUILD_ENVELOPE_PARKING_KEY);
    assert(after !== null,
      'the extraction DELETED the parked envelope — it is deleted in the first '
      + 'post-beta release, never in the release that reads it');
    assert(after === parked,
      'the parked envelope changed bytes; the extraction must be read-only');
  });

  await run('a restored removal does not come back from the dead', async () => {
    resetLedger();
    await parkEnvelope({
      userRemovalConstraints: [
        removalConstraint({ id: 'rc-active', targetDate: '2026-08-12' }),
        removalConstraint({
          id: 'rc-restored', targetDate: '2026-08-13',
          status: 'restored', restoredAt: '2026-08-05T09:00:00.000Z',
          restorationReason: 'explicit_restore',
        }),
      ],
    });
    const result = await extractParkedEnvelopeDecisions();
    assert(result.removals === 1,
      `a removal the athlete already restored was migrated back: ${JSON.stringify(result)}`);
    const dates = decisionLedgerEntries()
      .map((entry) => (entry.decision as { change?: { date?: string } }).change?.date);
    assert(!dates.includes('2026-08-13'),
      'the restored removal reached the ledger and would delete that day again');
  });

  await run('derived content does not migrate — weekScopedOverlays is not carried', async () => {
    resetLedger();
    await parkEnvelope({
      weekScopedOverlays: {
        '2026-08-10': { id: 'ov-1', weekStart: '2026-08-10', workoutsByDate: {} },
      },
      dateOverrides: {},
      userRemovalConstraints: [],
    });
    const result = await extractParkedEnvelopeDecisions();
    assert(result.entriesAppended === 0,
      `a week overlay produced ${result.entriesAppended} ledger entries. It is DERIVED `
      + 'content by the same law the fixture identity unit enforced, and migrating it '
      + 'would import exactly the contamination fixtureIdentityTests cell 3 measures.');
    assert(decisionLedgerEntries().length === 0,
      'the overlay reached the ledger');
  });

  await run('an unreadable envelope is not recorded as migrated', async () => {
    resetLedger();
    await asyncStorageCompat.setItem(PRE_REBUILD_ENVELOPE_PARKING_KEY, '{not json');
    const result = await extractParkedEnvelopeDecisions();
    assert(result.outcome === 'unreadable_envelope',
      `a corrupt envelope answered "${result.outcome}" — an unreadable old world must `
      + 'never look like an empty one, or the athlete silently loses everything');
    assert(decisionLedgerEntries().length === 0, 'a corrupt envelope produced entries');
  });

  console.log(`\nR2 envelope migration totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
};

void main();
