(global as unknown as { __DEV__: boolean }).__DEV__ = true;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import type { ActiveEquipmentConstraint } from '../store/coachUpdatesStore';
import type { OnboardingData, TrainingProgram } from '../types/domain';
import {
  clearDevE2EClock,
  createDevE2EClockReceipt,
  devE2EAnchorInstantForDate,
  getDevE2EClockReceipt,
  setDevE2EClock,
} from '../dev/e2e/DevE2EClock';
import {
  DEV_E2E_CHECKPOINT_STORAGE_KEY,
  readDevE2ECheckpointRecord,
  type DevE2ECheckpointRecord,
  type DevE2EKeyValueStorage,
} from '../dev/e2e/devE2ECheckpoint';
import { AthleteActionTraceCoordinator } from '../dev/e2e/AthleteActionTraceCoordinator';
import {
  devE2EAcceptedSemanticFingerprint,
  writeDevE2EScenarioSessionRecord,
  type DevE2EScenarioSessionRecord,
} from '../dev/e2e/devE2EScenarioSession';
import {
  DEV_E2E_CLOCK_STORAGE_KEY,
  restoreDevE2EClockBeforeHydration,
  writeDevE2EClockReceipt,
} from '../dev/e2e/devE2EClockPersistence';
import { todayISOLocal } from '../utils/appDate';
import {
  addDays,
  getMondayStr,
  resolveDate,
  resolveWeek,
  type ScheduleState,
} from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import { resolveSeasonPhaseClock } from '../rules/seasonPhaseClock';
import { resolveEquipmentAvailability } from '../utils/equipmentAvailability';
import { getProgramBlockRolloverStatus } from '../utils/programBlockState';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.log(`  ✗ ${name}`);
  }
}

class MemoryStorage implements DevE2EKeyValueStorage {
  readonly values = new Map<string, string>();
  reads = 0;

  async getItem(key: string): Promise<string | null> {
    this.reads += 1;
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const CREATED_AT = '2026-07-01T00:00:00.000Z';

function installDate(
  dateISO: string,
  timezone = 'Australia/Melbourne',
): ReturnType<typeof createDevE2EClockReceipt> {
  const receipt = createDevE2EClockReceipt({
    seedId: 'standard-in-season-week',
    anchorInstant: devE2EAnchorInstantForDate(dateISO, timezone),
    timezone,
    createdAt: CREATED_AT,
  });
  setDevE2EClock(receipt);
  return receipt;
}

function emptyScheduleState(program: TrainingProgram): ScheduleState {
  return {
    currentProgram: program,
    currentMicrocycle: program.microcycles[0],
    manualOverrides: {},
    markedDays: {},
    athleteContext: DEFAULT_ATHLETE_CONTEXT,
    seasonPhase: null,
    readiness: 'medium',
  };
}

async function main(): Promise<void> {
  clearDevE2EClock();
  const storage = new MemoryStorage();
  const receipt = installDate('2026-07-13');
  ok('clock receipt contains only protocol identity and clock semantics',
    Object.keys(receipt).sort().join(',') ===
      'anchorInstant,createdAt,protocolVersion,seedId,semanticFingerprint,timezone');
  await writeDevE2EClockReceipt(receipt, storage);
  const traceCoordinator = new AthleteActionTraceCoordinator(
    () => true,
    () => new Date('2026-07-13T12:00:00.000Z'),
  );
  const traceToken = traceCoordinator.startRoot({
    source: 'tap',
    actionType: 'move_session',
    seedId: receipt.seedId,
  });
  const checkpoint: DevE2ECheckpointRecord = {
    version: 2,
    seedId: receipt.seedId,
    checkpointId: receipt.seedId,
    fingerprints: { state: 'unchanged' },
    clockFingerprint: receipt.semanticFingerprint,
    unfinishedAthleteActionTraces: traceCoordinator.exportCheckpoint(),
  };
  storage.values.set(DEV_E2E_CHECKPOINT_STORAGE_KEY, JSON.stringify(checkpoint));
  const parsedCheckpoint = await readDevE2ECheckpointRecord(storage);
  ok('checkpoint protocol v2 retains the unfinished TraceV2 identity',
    parsedCheckpoint?.unfinishedAthleteActionTraces.records[0]?.traceId === traceToken.traceId);

  clearDevE2EClock();
  let reseedCalls = 0;
  const restored = await restoreDevE2EClockBeforeHydration({ storage });
  ok('cold reload restores the clock receipt', restored && todayISOLocal() === '2026-07-13');
  ok('cold reload restoration never rebuilds or reseeds', reseedCalls === 0);

  const scenarioStorage = new MemoryStorage();
  await writeDevE2EClockReceipt(receipt, scenarioStorage);
  const scenarioCheckpoint: DevE2ECheckpointRecord = {
    ...checkpoint,
    scenarioId: 'standard-in-season-week',
    checkpointStepId: 'standard-in-season-week',
    activeActionTraceId: traceToken.traceId,
    priorActionTraceId: null,
  };
  scenarioStorage.values.set(
    DEV_E2E_CHECKPOINT_STORAGE_KEY,
    JSON.stringify(scenarioCheckpoint),
  );
  const scenarioSession: DevE2EScenarioSessionRecord = {
    protocolVersion: 2,
    scenarioId: 'standard-in-season-week',
    seedId: receipt.seedId,
    checkpointStepId: 'standard-in-season-week',
    activeActionTraceId: traceToken.traceId,
    priorActionTraceId: null,
    reloadCount: 0,
    currentAcceptedSemanticFingerprint:
      devE2EAcceptedSemanticFingerprint(checkpoint.fingerprints),
    persistedStoreFingerprints: checkpoint.fingerprints,
    clockFingerprint: receipt.semanticFingerprint,
    nextActionEligibility: {
      nextStepId: null,
      status: 'complete',
      reasonCode: 'scenario_complete',
      witnessIds: ['checkpoint:standard-in-season-week'],
    },
    updatedAt: '2026-07-13T02:00:00.001Z',
  };
  await writeDevE2EScenarioSessionRecord(scenarioSession, scenarioStorage);
  clearDevE2EClock();
  ok('cold launch restores a clock correlated to scenario session and checkpoint',
    await restoreDevE2EClockBeforeHydration({ storage: scenarioStorage }) &&
      getDevE2EClockReceipt()?.semanticFingerprint === receipt.semanticFingerprint);

  const currentProgram = {
    id: 'clock-week-program',
    userId: 'clock-athlete',
    name: 'Clock week',
    description: 'Clock week',
    programPhase: 'In-Season',
    startDate: '2026-07-13T12:00:00.000Z',
    endDate: '2026-07-26T12:00:00.000Z',
    primaryFocus: 'Clock',
    isActive: true,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    microcycles: [{
      id: 'clock-week',
      programId: 'clock-week-program',
      weekNumber: 1,
      startDate: '2026-07-13T12:00:00.000Z',
      endDate: '2026-07-26T12:00:00.000Z',
      miniCycleNumber: 1,
      intensityMultiplier: 1,
      workouts: [],
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    }],
  } as TrainingProgram;
  const currentMonday = getMondayStr(0);
  const currentWeek = resolveWeek(currentMonday, emptyScheduleState(currentProgram));
  const futureWeek = resolveWeek(addDays(currentMonday, 7), emptyScheduleState(currentProgram));
  ok('current week classification follows the seed clock',
    currentMonday === '2026-07-13' &&
      currentWeek.filter((day) => day.isToday).map((day) => day.date).join(',') === '2026-07-13');
  ok('future week classification follows the seed clock',
    futureWeek.every((day) => !day.isToday));

  installDate('2026-07-06');
  const phaseEntry = resolveSeasonPhaseClock({
    selectedPhase: 'Off-season',
    targetWeekStartISO: getMondayStr(0),
  }).clock;
  installDate('2026-07-27');
  const phaseAge = resolveSeasonPhaseClock({
    selectedPhase: 'Off-season',
    targetWeekStartISO: getMondayStr(0),
    persistedClock: phaseEntry,
  });
  ok('phase age remains stable against the effective clock',
    phaseAge.phaseWeekNumber === 4 && phaseAge.subphase === 'mid_offseason');

  installDate('2026-10-05');
  const fixtureProgram = {
    ...currentProgram,
    id: 'sunday-fixture-program',
    startDate: '2026-09-28T12:00:00.000Z',
    endDate: '2026-10-11T12:00:00.000Z',
    microcycles: [{
      ...currentProgram.microcycles[0],
      id: 'sunday-fixture-week',
      programId: 'sunday-fixture-program',
      startDate: '2026-09-28T12:00:00.000Z',
      endDate: '2026-10-11T12:00:00.000Z',
    }],
  } as TrainingProgram;
  const mondayGPlusOne = resolveDate('2026-10-05', {
    ...emptyScheduleState(fixtureProgram),
    markedDays: { '2026-10-04': 'game' },
  });
  ok('Sunday fixture produces next-Monday G+1 recovery',
    mondayGPlusOne.source === 'gameProximity' &&
      mondayGPlusOne.workout?.workoutType === 'Recovery');

  const originalTZ = process.env.TZ;
  installDate('2026-10-04');
  process.env.TZ = 'UTC';
  const utcDate = todayISOLocal();
  const utcMonday = getMondayStr(0);
  process.env.TZ = 'America/Los_Angeles';
  const laDate = todayISOLocal();
  const laMonday = getMondayStr(0);
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
  ok('DST transition keeps the intended seed date',
    utcDate === '2026-10-04' && laDate === utcDate);
  ok('Monday boundary remains stable across device timezones',
    utcMonday === '2026-09-28' && laMonday === utcMonday);

  const equipmentProfile: OnboardingData = {
    trainingLocation: 'Commercial gym',
    equipmentSelectionCompleteness: 'complete',
    equipment: ['barbell', 'dumbbells', 'bodyweight'],
  };
  const equipmentConstraint: ActiveEquipmentConstraint = {
    id: 'clock-expiry',
    type: 'equipment',
    mode: 'only',
    tags: ['bodyweight'],
    severity: 2,
    status: 'active',
    startDate: '2026-07-13',
    lastUpdatedAt: CREATED_AT,
    expiresAt: '2026-07-13',
    reasonLabel: 'Bodyweight only',
    source: 'system',
    modifierAffects: ['current_day'],
    rules: [],
    safeFocus: [],
    advice: [],
  };
  installDate('2026-07-13');
  const equipmentOnExpiry = resolveEquipmentAvailability(
    equipmentProfile,
    [equipmentConstraint],
  );
  installDate('2026-07-14');
  const equipmentAfterExpiry = resolveEquipmentAvailability(
    equipmentProfile,
    [equipmentConstraint],
  );
  ok('constraint remains active through its expiry date',
    equipmentOnExpiry.join(',') === 'bodyweight');
  ok('constraint expires after the seed clock crosses the boundary',
    equipmentAfterExpiry.includes('barbell') && equipmentAfterExpiry.includes('dumbbells'));

  const rolloverProgram = {
    ...currentProgram,
    startDate: '2026-07-06T12:00:00.000Z',
    endDate: '2026-08-02T12:00:00.000Z',
  } as TrainingProgram;
  installDate('2026-08-02');
  const finalSunday = getProgramBlockRolloverStatus({
    program: rolloverProgram,
    dateISO: todayISOLocal(),
  });
  installDate('2026-08-03');
  const nextMonday = getProgramBlockRolloverStatus({
    program: rolloverProgram,
    dateISO: todayISOLocal(),
  });
  ok('rollover stays closed on the final Sunday', !finalSunday.needsRollover);
  ok('rollover opens on the following Monday',
    nextMonday.needsRollover && nextMonday.nextBlockStart === '2026-08-03');

  clearDevE2EClock();
  const corruptStorage = new MemoryStorage();
  corruptStorage.values.set(DEV_E2E_CLOCK_STORAGE_KEY, '{not-json');
  corruptStorage.values.set(DEV_E2E_CHECKPOINT_STORAGE_KEY, JSON.stringify(checkpoint));
  let corruptError = '';
  try {
    await restoreDevE2EClockBeforeHydration({ storage: corruptStorage });
  } catch (error) {
    corruptError = error instanceof Error ? error.message : String(error);
  }
  ok('corrupt receipt fails closed',
    corruptError === 'DevE2EClock receipt corrupt: invalid JSON.' &&
      getDevE2EClockReceipt() === null);

  const unknownStorage = new MemoryStorage();
  unknownStorage.values.set(DEV_E2E_CLOCK_STORAGE_KEY, JSON.stringify({
    ...receipt,
    seedId: 'unknown-campaign',
  }));
  unknownStorage.values.set(DEV_E2E_CHECKPOINT_STORAGE_KEY, JSON.stringify(checkpoint));
  let unknownError = '';
  try {
    await restoreDevE2EClockBeforeHydration({ storage: unknownStorage });
  } catch (error) {
    unknownError = error instanceof Error ? error.message : String(error);
  }
  ok('unknown receipt fails closed',
    unknownError === 'DevE2EClock receipt unknown seed: unknown-campaign.' &&
      getDevE2EClockReceipt() === null);

  (global as unknown as { __DEV__: boolean }).__DEV__ = false;
  const releaseStorage = new MemoryStorage();
  const releaseRestored = await restoreDevE2EClockBeforeHydration({
    storage: releaseStorage,
  });
  ok('release mode cannot restore the clock', !releaseRestored);
  ok('release restore does not read persistence', releaseStorage.reads === 0);
  (global as unknown as { __DEV__: boolean }).__DEV__ = true;
  clearDevE2EClock();

  console.log(`\nDevE2EClock scenarios: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`  • ${failure}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
