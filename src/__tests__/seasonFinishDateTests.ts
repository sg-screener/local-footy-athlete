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

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
import type { OnboardingData } from '../types/domain';
import {
  firstOffseasonWeekStartAfterFinish,
  resolveSeasonPhaseClock,
  validateSeasonFinishDateParts,
} from '../rules/seasonPhaseClock';
import { generateProgramLocally } from '../services/api/generateProgram';
import { applyPhaseShift } from '../utils/profileMutations';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';

let passed = 0;
let failed = 0;

function check(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
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
  try { return run(); } finally { console.log = log; console.warn = warn; }
}

const PROFILE: OnboardingData = {
  firstName: 'Sam', gender: 'male', heightCm: 184, weightKg: 90,
  position: 'inside_mid', seasonPhase: 'Off-season', seasonFinishedOn: '2026-08-01',
  motivation: 'Build strength and football fitness',
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
  equipmentAnswer: fullKitEquipmentAnswer(), experienceLevel: '2-5 years',
  squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight',
  twoKmTimeTrial: { seconds: 450, recordedOn: '2026-08-24', source: 'onboarding' },
  conditioningLevel: 'Good', sprintExposure: 'Occasionally',
  recentTrainingLoad: 'Pretty consistent', injuries: [],
};

console.log('\n[season finish] one date anchors the whole Off-season clock');

check('a Saturday finish starts the following Monday',
  firstOffseasonWeekStartAfterFinish('2026-08-01') === '2026-08-03');
check('a Monday finish starts the next Monday, not the same day',
  firstOffseasonWeekStartAfterFinish('2026-08-03') === '2026-08-10');
check('the ingress rejects an impossible date',
  !validateSeasonFinishDateParts('31', '2', '2026', '2026-08-24').ok);
check('the ingress rejects a future date',
  !validateSeasonFinishDateParts('25', '8', '2026', '2026-08-24').ok);

const mid = resolveSeasonPhaseClock({
  selectedPhase: 'Off-season', seasonFinishedOn: '2026-08-01', targetWeekStartISO: '2026-08-24',
});
check('a mid-Off-season signup derives Phase Week 4',
  mid.phaseWeekNumber === 4 && mid.subphase === 'mid_offseason', mid);

const late = resolveSeasonPhaseClock({
  selectedPhase: 'Off-season', seasonFinishedOn: '2026-08-01', targetWeekStartISO: '2026-08-31',
});
check('the following week derives late Off-season Week 5',
  late.phaseWeekNumber === 5 && late.subphase === 'late_offseason', late);

const staleClock = resolveSeasonPhaseClock({
  selectedPhase: 'Off-season', targetWeekStartISO: '2026-08-24',
}).clock;
const corrected = resolveSeasonPhaseClock({
  selectedPhase: 'Off-season', seasonFinishedOn: '2026-08-01',
  targetWeekStartISO: '2026-08-24', persistedClock: staleClock,
});
check('the athlete answer corrects a stale same-phase clock',
  corrected.phaseWeekNumber === 4 && corrected.clock.originProvenance === 'explicit_season_finish_date');

const unsure = resolveSeasonPhaseClock({
  selectedPhase: 'Off-season', seasonFinishedOn: null, targetWeekStartISO: '2026-08-24',
});
check('not sure falls back to recently finished Week 1',
  unsure.phaseWeekNumber === 1 && unsure.clock.phaseEntryWeekStartISO === '2026-08-24');

const pre = resolveSeasonPhaseClock({
  selectedPhase: 'Pre-season', seasonFinishedOn: '2026-08-01', targetWeekStartISO: '2026-08-24',
});
check('non-Off-season phases ignore the finish-date anchor',
  pre.phaseWeekNumber === 1 && pre.clock.phaseEntryWeekStartISO === '2026-08-24');

const generated = withoutRoutineLogs(() => generateProgramLocally(
  PROFILE,
  { todayISO: '2026-08-24', previousProgram: null },
));
check('real generation reads the saved date and declares Week 4',
  generated.seasonPhaseClock?.phaseEntryWeekStartISO === '2026-08-03' &&
    generated.seasonPhaseClock?.originProvenance === 'explicit_season_finish_date' &&
    generated.microcycles[0].exposureContractV2?.identity.phaseWeek === 4 &&
    generated.microcycles[0].exposureContractV2?.identity.declaredSubphase === 'mid_offseason');

const shifted = applyPhaseShift({ ...PROFILE, seasonPhase: 'In-season' }, {
  targetPhase: 'Off-season', preferredTrainingDays: ['Monday', 'Wednesday'],
  seasonFinishedOn: '2026-08-01',
});
check('the live phase-shift mutation keeps the exact answer', shifted.seasonFinishedOn === '2026-08-01');

const shiftedUnsure = applyPhaseShift({ ...PROFILE, seasonPhase: 'In-season' }, {
  targetPhase: 'Off-season', preferredTrainingDays: ['Monday', 'Wednesday'], seasonFinishedOn: null,
});
check('the phase-shift mutation keeps not sure as an explicit null',
  Object.prototype.hasOwnProperty.call(shiftedUnsure, 'seasonFinishedOn') &&
    shiftedUnsure.seasonFinishedOn === null);

console.log(`\nSeason finish date: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) process.exitCode = 1;
