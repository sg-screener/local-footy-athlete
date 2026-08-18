/**
 * FIRST TRACE — DOES THE PREVIOUS BLOCK'S EXERCISE IDENTITY SURVIVE BOOT?
 *
 * Ordered before any redesign coding: *"establish whether the exact exercise
 * identities selected for the previous accepted block already survive rollover
 * and boot. Reuse an existing canonical block/program-history owner if one
 * exists."*
 *
 * Driven through the REAL boot (`rebuildDerivedWorld`), the same door
 * `blockTwoBootPreservationTests` uses — not a reasoned argument from the code.
 *
 * Three questions, in order:
 *   A. does a boot with UNCHANGED inputs return the same identities?
 *   B. does a boot with a CHANGED equipment answer return the same identities?
 *   C. is any exercise identity actually written to durable storage?
 *
 * A alone would say "identities survive". A and B together say what actually
 * carries them.
 *
 * Run: npx sucrase-node scripts/trace-selection-history.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — boot runs entirely on-device');
};

import { generateProgramLocally } from '../src/services/api/generateProgram';
import { commercialGymEquipmentAnswer } from '../src/__tests__/support/equipmentAnswerFixture';
import { slotCountsTowardSetBudget } from '../src/rules/weeklyProgrammingContract';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';
import { useProfileStore } from '../src/store/profileStore';
import {
  useProgramStore,
  PROGRAM_STORE_PERSISTENCE_KEY,
  type SessionFeedback,
} from '../src/store/programStore';
import { rebuildDerivedWorld } from '../src/store/quiescentBoot';
import type { OnboardingData, TrainingProgram } from '../src/types/domain';

const BLOCK_2_START = '2026-08-03';
const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];

function athlete(equipmentAnswer: unknown = commercialGymEquipmentAnswer()): OnboardingData {
  return {
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    equipmentAnswer,
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: '2-5 years',
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    weightKg: 85,
  } as unknown as OnboardingData;
}

/** Main/secondary identity per movement slot — what the redesign must preserve. */
function identities(program: TrainingProgram | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const mc of program?.microcycles ?? []) {
    for (const w of mc.workouts) {
      for (const ex of w.exercises ?? []) {
        const slot = ex.section18Evidence?.slot;
        const name = ex.exercise?.name ?? '';
        if (!name || !slotCountsTowardSetBudget(slot)) continue;
        if (!out[String(slot)]) out[String(slot)] = name;
      }
    }
  }
  return out;
}

function feedback(): Record<string, SessionFeedback> {
  const out: Record<string, SessionFeedback> = {};
  for (const dateStr of BLOCK_1_DATES) {
    out[dateStr] = {
      dateStr, completion: 'full', feeling: 'good', soreness: 'mild', strength: [],
    } as unknown as SessionFeedback;
  }
  return out;
}

const quiet = <T,>(fn: () => T): T => {
  const log = console.log;
  const warn = console.warn;
  console.log = () => undefined;
  console.warn = () => undefined;
  try { return fn(); } finally { console.log = log; console.warn = warn; }
};

function install(equipmentAnswer: unknown): Record<string, string> {
  return quiet(() => {
    resetStoresToFreshInstall('trace-selection-history');
    const profile = athlete(equipmentAnswer);
    useProfileStore.setState({
      onboardingData: profile, isOnboardingComplete: true,
    } as never);
    const program = generateProgramLocally(profile, {
      todayISO: BLOCK_2_START,
      blockNumber: 2,
      progressionHistory: { sessionFeedback: feedback(), weightOverrides: {}, blockState: null },
      recordSelections: 'author',
    }) as TrainingProgram;
    useProgramStore.setState({
      currentProgram: program,
      currentMicrocycle: program.microcycles[0],
      sessionFeedback: feedback(),
      weightOverrides: {},
      blockState: { blockStartDate: BLOCK_2_START, blockNumber: 2 },
      generationAnchorISO: BLOCK_2_START,
    } as never);
    return identities(program);
  });
}

async function boot(): Promise<Record<string, string>> {
  await quiet(async () => { await rebuildDerivedWorld(); });
  return identities(useProgramStore.getState().currentProgram ?? null);
}

function diff(a: Record<string, string>, b: Record<string, string>): string[] {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys.filter((k) => a[k] !== b[k]).map((k) => `${k}: ${a[k] ?? '—'} → ${b[k] ?? '—'}`);
}

async function main(): Promise<void> {
  console.log('\n════════ FIRST TRACE — SELECTION HISTORY OWNERSHIP ════════');

  console.log('\n[A] BOOT WITH UNCHANGED INPUTS');
  const beforeA = install(commercialGymEquipmentAnswer());
  const afterA = await boot();
  console.log('  before:', JSON.stringify(beforeA, null, 0));
  console.log('  after :', JSON.stringify(afterA, null, 0));
  const dA = diff(beforeA, afterA);
  console.log(dA.length === 0
    ? '  IDENTICAL — identities came back.'
    : `  DIFFERED: ${dA.join(' | ')}`);

  console.log('\n[B] BOOT AFTER THE ATHLETE\'S EQUIPMENT ANSWER CHANGED');
  console.log('    (the rack is lost between the block being built and the relaunch)');
  const beforeB = install(commercialGymEquipmentAnswer());
  const noRack = {
    tags: {
      barbell: 'have', dumbbells: 'have', machine: 'have',
      bench: 'have', cables: 'have', pullup_bar: 'have',
    },
    modalities: {},
    answeredOn: '2026-07-01',
  };
  quiet(() => {
    useProfileStore.setState({
      onboardingData: athlete(noRack), isOnboardingComplete: true,
    } as never);
  });
  const afterB = await boot();
  console.log('  before:', JSON.stringify(beforeB, null, 0));
  console.log('  after :', JSON.stringify(afterB, null, 0));
  const dB = diff(beforeB, afterB);
  console.log(dB.length === 0
    ? '  IDENTICAL.'
    : `  REWRITTEN BY REPLAY: ${dB.join(' | ')}`);

  console.log('\n[C] IS ANY EXERCISE IDENTITY IN DURABLE STORAGE?');
  const storage = require('../src/store/asyncStorageCompat').asyncStorageCompat;
  const raw = await storage.getItem(PROGRAM_STORE_PERSISTENCE_KEY);
  const persistedKeys = raw
    ? Object.keys((JSON.parse(raw) as { state?: { inputs?: Record<string, unknown> } })
      .state?.inputs ?? {})
    : [];
  console.log('  program-store persists these keys:', persistedKeys.join(', ') || '(nothing)');
  const names = Object.values(afterA);
  const inProgramStore = raw ? names.some((n) => raw.includes(n)) : false;
  console.log(`  ...and any selected exercise NAME in those bytes: ${inProgramStore}`);

  /* The NEW carrier. Before this unit there was nowhere else to look, which is
   * why the original trace only asked the program store. */
  const selectionRaw = await storage.getItem(
    require('../src/store/blockSelectionHistoryStore').BLOCK_SELECTION_HISTORY_KEY,
  );
  const recorded = selectionRaw
    ? (JSON.parse(selectionRaw) as {
      state?: { selections?: { slot: string; identity: string; blockStartISO: string }[] };
    }).state?.selections ?? []
    : [];
  console.log(`  block-selection-history rows persisted: ${recorded.length}`);
  for (const row of recorded.slice(0, 8)) {
    console.log(`    ${row.blockStartISO}  ${row.slot.padEnd(18)} ${row.identity}`);
  }
  const anyNamePersisted = recorded.length > 0;

  console.log('\n════════ CONCLUSION ════════');
  console.log(`  A unchanged-input boot: ${dA.length === 0 ? 'identities returned' : 'identities MOVED'}`);
  console.log(`  B changed-input boot:   ${dB.length === 0 ? 'identities returned' : 'identities MOVED'}`);
  console.log(`  C durable carrier:      ${anyNamePersisted ? 'YES' : 'NONE — nothing stores them'}`);
}

main().catch((error) => {
  console.error('TRACE FAILED:', error);
  process.exit(1);
});
