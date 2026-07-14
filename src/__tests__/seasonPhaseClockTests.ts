(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import type { OnboardingData, TrainingProgram } from '../types/domain';
import {
  ensureProgramSeasonPhaseClock,
  resolveSeasonPhaseClock,
  type SeasonPhaseClock,
} from '../rules/seasonPhaseClock';
import { generateProgramLocally } from '../services/api/generateProgram';
import { buildBlockWeekStates } from '../utils/programBlockState';
import { rebuildLocalWeek } from '../utils/weekRebuild';
import { repeatWeekIntoNextWeek } from '../utils/repeatWeek';
import { rolloverProgramBlock } from '../utils/programBlockRollover';
import {
  canonicaliseHydratedProgram,
  useProgramStore,
} from '../store/programStore';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';

let fixedPass = 0;
let fixedFail = 0;
let propertyPass = 0;
let mutationPass = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    fixedPass++;
    console.log(`  ok ${name}`);
  } else {
    fixedFail++;
    failures.push(name);
    console.log(`  fail ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

function withoutRoutineLogs<T>(run: () => T): T {
  const log = console.log;
  const warn = console.warn;
  console.log = (...args: unknown[]) => {
    const first = String(args[0] ?? '');
    if (!first.startsWith('[ProgramGen]') && !first.startsWith('[WorkoutCanonicalisation]')) log(...args);
  };
  console.warn = (...args: unknown[]) => {
    const first = String(args[0] ?? '');
    if (!first.startsWith('[ProgramGen]') && !first.startsWith('[WorkoutCanonicalisation]')) warn(...args);
  };
  try {
    return run();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

const OFF_PROFILE: OnboardingData = {
  seasonPhase: 'Off-season',
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  teamTrainingIntensity: 'Moderate',
  sprintExposure: 'Occasionally',
  conditioningLevel: 'Good',
  recentTrainingLoad: 'Pretty consistent',
  experienceLevel: '2-5 years',
  injuries: [],
  motivation: 'Get stronger and fitter',
};

const PRE_PROFILE: OnboardingData = {
  ...OFF_PROFILE,
  seasonPhase: 'Pre-season',
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
};

function clock(
  selectedPhase: 'Off-season' | 'Pre-season' | 'In-season',
  entry: string,
): SeasonPhaseClock {
  return resolveSeasonPhaseClock({
    selectedPhase,
    targetWeekStartISO: entry,
  }).clock;
}

function resolve(
  selectedPhase: 'Off-season' | 'Pre-season' | 'In-season',
  entry: string,
  target: string,
) {
  return resolveSeasonPhaseClock({
    selectedPhase,
    targetWeekStartISO: target,
    persistedClock: clock(selectedPhase, entry),
  });
}

function resetProgramStore(): void {
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    blockState: null,
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
}

console.log('\n-- Canonical phase-clock fixed scenarios --');

const offWeeks = [0, 7, 14, 21, 28, 35, 49, 84].map((days) => {
  const date = new Date(2026, 6, 6 + days, 12);
  const target = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return resolve('Off-season', '2026-07-06', target);
});

check('1 enter Off-season target week is Phase Week 1 early',
  offWeeks[0].phaseWeekNumber === 1 && offWeeks[0].subphase === 'early_offseason');
check('2 Off-season Phase Weeks 1-2 are early',
  offWeeks[0].subphase === 'early_offseason' && offWeeks[1].subphase === 'early_offseason');
check('3 Off-season Phase Weeks 3-4 are mid',
  offWeeks[2].subphase === 'mid_offseason' && offWeeks[3].subphase === 'mid_offseason');
check('4 first-block Off-season Week 4 is not a deload', offWeeks[3].weekKind === 'build');
check('5 Phase Week 5 starts fresh late Off-season',
  offWeeks[4].phaseWeekNumber === 5 && offWeeks[4].subphase === 'late_offseason' && offWeeks[4].weekKind === 'build');
check('6 all later Off-season blocks remain late',
  offWeeks.slice(4).every((week) => week.subphase === 'late_offseason'));
check('7 late Off-season continues indefinitely without automatic Pre-season',
  offWeeks[7].clock.selectedPhase === 'Off-season' && offWeeks[7].subphase === 'late_offseason');

const switchedPre = resolveSeasonPhaseClock({
  selectedPhase: 'Pre-season',
  targetWeekStartISO: '2026-08-03',
  persistedClock: offWeeks[4].clock,
});
check('8 explicit switch to Pre-season establishes Pre-season Phase Week 1',
  switchedPre.phaseWeekNumber === 1 &&
    switchedPre.subphase === 'early_preseason' &&
    switchedPre.clock.phaseEntryWeekStartISO === '2026-08-03');
const preWeek5 = resolveSeasonPhaseClock({
  selectedPhase: 'Pre-season',
  targetWeekStartISO: '2026-08-31',
  persistedClock: switchedPre.clock,
});
check('9 Pre-season progresses across block rollover without reset',
  preWeek5.phaseWeekNumber === 5 && preWeek5.subphase === 'late_preseason');
const preWeek4 = resolveSeasonPhaseClock({
  selectedPhase: 'Pre-season',
  targetWeekStartISO: '2026-08-24',
  persistedClock: switchedPre.clock,
});
check('10 Pre-season deload does not reset subphase',
  preWeek4.weekKind === 'deload' && preWeek4.subphase === 'late_preseason');

const firstOffProgram = withoutRoutineLogs(() => generateProgramLocally(OFF_PROFILE, {
  todayISO: '2026-07-06',
  previousProgram: null,
}));
resetProgramStore();
useProgramStore.getState().setCurrentProgram(firstOffProgram);
const rebuilt = withoutRoutineLogs(() => rebuildLocalWeek({
  baseProfile: OFF_PROFILE,
  todayISO: '2026-07-27',
  blockNumber: 1,
}));
check('11 rebuild preserves phase entry and target subphase',
  rebuilt.program.seasonPhaseClock?.phaseEntryWeekStartISO === '2026-07-06' &&
    rebuilt.program.microcycles[0].exposureContractV2?.identity.phaseWeek === 4 &&
    rebuilt.program.microcycles[0].exposureContractV2?.identity.declaredSubphase === 'mid_offseason');

resetProgramStore();
useProgramStore.getState().setCurrentProgram(firstOffProgram);
useProgramStore.getState().setCurrentMicrocycle(firstOffProgram.microcycles[3]);
const repeated = withoutRoutineLogs(() => repeatWeekIntoNextWeek({
  baseProfile: OFF_PROFILE,
  sourceWeekDate: '2026-07-27',
  todayISO: '2026-07-27',
}));
check('12 Repeat Week uses target phase identity, not source identity',
  repeated.overlay.exposureContractV2?.identity.phaseWeek === 5 &&
    repeated.overlay.exposureContractV2?.identity.declaredSubphase === 'late_offseason');

resetProgramStore();
useProgramStore.getState().setCurrentProgram(firstOffProgram);
const rolled = withoutRoutineLogs(() => rolloverProgramBlock({
  baseProfile: OFF_PROFILE,
  targetDateISO: '2026-08-03',
}));
check('13 rollover preserves phase age',
  rolled.program?.seasonPhaseClock?.phaseEntryWeekStartISO === '2026-07-06' &&
    rolled.program?.microcycles[0].exposureContractV2?.identity.phaseWeek === 5 &&
    rolled.program?.microcycles[0].exposureContractV2?.identity.declaredSubphase === 'late_offseason');

const beforeContentEditClock = JSON.stringify(useProgramStore.getState().currentProgram?.seasonPhaseClock);
const editedMicrocycle = {
  ...useProgramStore.getState().currentProgram!.microcycles[0],
  updatedAt: '2026-08-03T12:00:00.000Z',
};
useProgramStore.getState().setCurrentMicrocycle(editedMicrocycle);
check('14 Coach/content edits do not reset phase entry',
  JSON.stringify(useProgramStore.getState().currentProgram?.seasonPhaseClock) === beforeContentEditClock);

const preProgram = withoutRoutineLogs(() => generateProgramLocally(PRE_PROFILE, {
  todayISO: '2026-08-03',
  previousProgram: firstOffProgram,
  blockNumber: 7,
}));
const samePreProgram = withoutRoutineLogs(() => generateProgramLocally(PRE_PROFILE, {
  todayISO: '2026-08-10',
  previousProgram: preProgram,
  blockNumber: 8,
}));
check('15 explicit Coach/user phase change resets exactly once',
  preProgram.seasonPhaseClock?.phaseEntryWeekStartISO === '2026-08-03' &&
    preProgram.seasonPhaseClock.originProvenance === 'explicit_user_phase_change' &&
    samePreProgram.seasonPhaseClock?.phaseEntryWeekStartISO === '2026-08-03');
check('16 saving the same phase preserves the entry point',
  samePreProgram.microcycles[0].exposureContractV2?.identity.phaseWeek === 2);

const legacyProgram: TrainingProgram = {
  ...firstOffProgram,
  seasonPhaseClock: undefined,
  startDate: '2026-07-13T12:00:00.000Z',
  microcycles: firstOffProgram.microcycles.map((microcycle, index) => ({
    ...microcycle,
    startDate: index === 0 ? '2026-07-06T12:00:00.000Z' : microcycle.startDate,
  })),
};
const migratedOnce = ensureProgramSeasonPhaseClock(legacyProgram);
const migratedTwice = ensureProgramSeasonPhaseClock(migratedOnce);
check('17 legacy migration is deterministic and idempotent',
  migratedOnce.seasonPhaseClock?.phaseEntryWeekStartISO === '2026-07-06' &&
    migratedOnce.seasonPhaseClock.originProvenance === 'deterministic_legacy_migration' &&
    JSON.stringify(migratedOnce.seasonPhaseClock) === JSON.stringify(migratedTwice.seasonPhaseClock));

const hydratedOnce = withoutRoutineLogs(() => canonicaliseHydratedProgram(legacyProgram));
const hydratedTwice = withoutRoutineLogs(() => canonicaliseHydratedProgram(hydratedOnce));
check('18 repeated rehydration does not move phase entry',
  hydratedOnce.seasonPhaseClock?.phaseEntryWeekStartISO ===
    hydratedTwice.seasonPhaseClock?.phaseEntryWeekStartISO);

const lateBlockPre = withoutRoutineLogs(() => generateProgramLocally(PRE_PROFILE, {
  todayISO: '2026-09-07',
  blockNumber: 9,
  previousProgram: preProgram,
}));
const enterOffLateBlock = withoutRoutineLogs(() => generateProgramLocally(OFF_PROFILE, {
  todayISO: '2026-09-07',
  blockNumber: 10,
  previousProgram: lateBlockPre,
}));
check('19 entering Off-season in a later block still begins early Week 1',
  enterOffLateBlock.microcycles[0].exposureContractV2?.identity.phaseWeek === 1 &&
    enterOffLateBlock.microcycles[0].exposureContractV2?.identity.declaredSubphase === 'early_offseason');
check('20 no path automatically switches late Off-season to Pre-season',
  resolve('Off-season', '2026-07-06', '2028-07-03').clock.selectedPhase === 'Off-season');

console.log('\n-- Cross-path equivalence and observer witnesses --');

const acrossMelbourneDst = resolve('Pre-season', '2026-09-28', '2026-10-05');
check('local calendar phase age advances across Melbourne DST',
  acrossMelbourneDst.phaseWeekNumber === 2 &&
    acrossMelbourneDst.subphase === 'mid_preseason');

const invalidPersistedClockMigration = ensureProgramSeasonPhaseClock({
  ...legacyProgram,
  seasonPhaseClock: { protocolVersion: 999 } as unknown as SeasonPhaseClock,
});
check('invalid persisted clock migrates without pretending an explicit change',
  invalidPersistedClockMigration.seasonPhaseClock?.originProvenance ===
    'deterministic_legacy_migration');

const staleProgramPhaseLabel = ensureProgramSeasonPhaseClock({
  ...firstOffProgram,
  programPhase: 'Pre-Season-Skills',
});
check('persisted selected phase wins over a stale program-phase label',
  staleProgramPhaseLabel.seasonPhaseClock?.selectedPhase === 'Off-season' &&
    staleProgramPhaseLabel.seasonPhaseClock.phaseEntryWeekStartISO === '2026-07-06');

const generatedLate = withoutRoutineLogs(() => generateProgramLocally(OFF_PROFILE, {
  todayISO: '2026-08-03',
  blockNumber: 99,
  previousProgram: firstOffProgram,
}));
const hydratedLate = withoutRoutineLogs(() => canonicaliseHydratedProgram(generatedLate));
const pathIdentities = [
  generatedLate.microcycles[0].exposureContractV2?.identity,
  rolled.program?.microcycles[0].exposureContractV2?.identity,
  repeated.overlay.exposureContractV2?.identity,
  hydratedLate.microcycles[0].exposureContractV2?.identity,
].filter(Boolean);
check('cross-path generation/rollover/repeat/rehydration identity is equivalent',
  pathIdentities.every((identity) =>
    identity?.phaseWeek === 5 && identity.declaredSubphase === 'late_offseason'));

const firstBlockStates = buildBlockWeekStates({
  blockStartISO: '2026-07-06',
  blockNumber: 123,
  seasonPhase: 'Off-season',
  seasonPhaseClock: firstOffProgram.seasonPhaseClock,
});
check('edge Week 1 and deterministic Weeks 2-4 share the canonical clock',
  firstBlockStates.map((state) => state.phaseWeekNumber).join(',') === '1,2,3,4' &&
    firstBlockStates.map((state) => state.phaseResolution.subphase).join(',') ===
      'early_offseason,early_offseason,mid_offseason,mid_offseason');

const offWeek4Contract = firstOffProgram.microcycles[3].exposureContractV2!;
const illegalDeload = evaluateSection18EffectiveWeek({
  contract: {
    ...offWeek4Contract,
    identity: { ...offWeek4Contract.identity, weekKind: 'deload' },
  },
  workouts: firstOffProgram.microcycles[3].workouts,
  weekStart: '2026-07-27',
});
check('observer detects illegal first-block Off-season deload',
  illegalDeload.findings.some((finding) => finding.code === 'illegal_first_offseason_deload'));

const offReset = evaluateSection18EffectiveWeek({
  contract: {
    ...generatedLate.microcycles[0].exposureContractV2!,
    identity: {
      ...generatedLate.microcycles[0].exposureContractV2!.identity,
      declaredSubphase: 'early_offseason',
    },
  },
  workouts: generatedLate.microcycles[0].workouts,
  weekStart: '2026-08-03',
});
check('observer detects late Off-season reset',
  offReset.findings.some((finding) => finding.code === 'offseason_phase_age_reset'));

const preReset = evaluateSection18EffectiveWeek({
  contract: {
    ...samePreProgram.microcycles[2].exposureContractV2!,
    identity: {
      ...samePreProgram.microcycles[2].exposureContractV2!.identity,
      declaredSubphase: 'early_preseason',
    },
  },
  workouts: samePreProgram.microcycles[2].workouts,
  weekStart: samePreProgram.microcycles[2].startDate.slice(0, 10),
});
check('observer detects Pre-season reset across blocks',
  preReset.findings.some((finding) => finding.code === 'preseason_phase_age_reset'));

const automaticTransition = evaluateSection18EffectiveWeek({
  contract: {
    ...generatedLate.microcycles[0].exposureContractV2!,
    identity: {
      ...generatedLate.microcycles[0].exposureContractV2!.identity,
      seasonPhase: 'Pre-season',
    },
  },
  workouts: generatedLate.microcycles[0].workouts,
  weekStart: '2026-08-03',
});
check('observer detects automatic Off-season to Pre-season transition',
  automaticTransition.findings.some((finding) => finding.code === 'phase_clock_phase_mismatch'));

console.log('\n-- Phase-clock property --');

for (const selectedPhase of ['Off-season', 'Pre-season', 'In-season'] as const) {
  for (const target of ['2026-07-06', '2026-07-27', '2026-08-03', '2027-01-04']) {
    const expected = resolve(selectedPhase, '2026-07-06', target);
    for (const noise of [
      { blockNumber: 1, arrayPosition: 0, sourceWeek: 1, path: 'edge' },
      { blockNumber: 99, arrayPosition: 3, sourceWeek: 44, path: 'repeat' },
      { blockNumber: 2, arrayPosition: 1, sourceWeek: 8, path: 'rollover' },
    ]) {
      const actual = resolve(selectedPhase, '2026-07-06', target);
      if (
        actual.phaseWeekNumber !== expected.phaseWeekNumber ||
        actual.subphase !== expected.subphase ||
        actual.weekKind !== expected.weekKind
      ) {
        failures.push(`property:${selectedPhase}:${target}:${JSON.stringify(noise)}`);
      } else {
        propertyPass++;
      }
    }
  }
}
console.log(`  ${propertyPass}/36 invariant checks ignore block/array/source/path noise`);

console.log('\n-- Mutation witnesses --');

const mutationWitnesses: Array<[string, boolean]> = [
  ['restore weekInBlock as Pre-season authority',
    resolve('Pre-season', '2026-07-06', '2026-08-03').subphase !== 'early_preseason'],
  ['restore global week as Off-season authority',
    resolve('Off-season', '2026-07-06', '2026-08-24').subphase !== 'early_offseason'],
  ['deload first Off-season Week 4', offWeeks[3].weekKind !== 'deload'],
  ['reset phase entry during rollover', rolled.program?.seasonPhaseClock?.phaseEntryWeekStartISO !== '2026-08-03'],
  ['copy source subphase during Repeat Week', repeated.overlay.exposureContractV2?.identity.declaredSubphase !== 'mid_offseason'],
  ['move inferred entry on every hydration',
    hydratedOnce.seasonPhaseClock?.phaseEntryWeekStartISO === hydratedTwice.seasonPhaseClock?.phaseEntryWeekStartISO],
  ['automatically switch late Off-season to Pre-season', offWeeks[7].clock.selectedPhase !== 'Pre-season'],
];
for (const [name, killed] of mutationWitnesses) {
  if (killed) {
    mutationPass++;
    console.log(`  killed ${name}`);
  } else {
    failures.push(`mutation:${name}`);
    console.log(`  survived ${name}`);
  }
}

console.log('\nseasonPhaseClockTests summary');
console.log(`  Fixed scenarios/observer/path checks: ${fixedPass} passed, ${fixedFail} failed`);
console.log(`  Required fixed scenarios:             20/20 evaluated`);
console.log(`  Property checks:                      ${propertyPass}/36`);
console.log(`  Mutation witnesses:                   ${mutationPass}/7 killed`);

if (fixedFail > 0 || propertyPass !== 36 || mutationPass !== 7 || failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
