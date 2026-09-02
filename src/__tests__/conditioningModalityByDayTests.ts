/** R-339 — "running" means running: attached conditioning runs on upper days outside In-season, stays off-feet on lower days and in-season. */
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import assert from 'node:assert/strict';
import { generateProgramLocally } from '../services/api/generateProgram';
import { combinedConditioningMustBeOffFeet } from '../rules/conditioningSelection';
import { getSessionComponentRows } from '../utils/sessionComponents';
import type { OnboardingData, SeasonPhase, Workout } from '../types/domain';

let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}
function quietly<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => undefined; console.warn = () => undefined; console.error = () => undefined;
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

const TODAY = '2026-09-07';
function profile(phase: SeasonPhase, club: boolean, phaseEntryISO: string): OnboardingData {
  return {
    firstName: `modality-${phase}`, ageRange: '22-26', gender: 'male',
    position: 'inside_mid', heightCm: 180, weightKg: 82,
    motivation: 'Build strength and football fitness', goals: ['stronger_and_fitter'],
    seasonPhase: phase,
    // The off-season subphase is dated from the season's end; enter the phase where the week says.
    seasonFinishedOn: phase === 'Off-season' ? phaseEntryISO : undefined,
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as never,
    teamTrainingDays: club ? (phase === 'Pre-season' ? ['Monday', 'Wednesday'] : ['Tuesday', 'Thursday']) : [],
    teamTrainingDaysPerWeek: club ? 2 : 0,
    usualGameDay: phase === 'In-season' ? 'Saturday' : undefined,
    gameDay: phase === 'In-season' ? 'Saturday' : undefined,
    trainingLocation: 'Commercial gym', equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete', injuries: [],
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight', conditioningLevel: 'Good',
    sprintExposure: '2+ times per week', recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: { seconds: 480, recordedOn: TODAY, source: 'onboarding' },
  } as OnboardingData;
}
function generate(phase: SeasonPhase, phaseWeek: number, club: boolean): Workout[] {
  const phaseEntry = new Date(`${TODAY}T12:00:00Z`);
  phaseEntry.setUTCDate(phaseEntry.getUTCDate() - ((phaseWeek - 1) * 7));
  const phaseEntryISO = phaseEntry.toISOString().slice(0, 10);
  return quietly(() => generateProgramLocally(profile(phase, club, phaseEntryISO), {
    todayISO: TODAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: phase,
      phaseEntryWeekStartISO: phaseEntryISO,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })).microcycles[0]?.workouts ?? [];
}

type Attached = { readonly shape: string; readonly modality: string | undefined; readonly category: string | undefined; readonly title: string };
function attachedConditioning(workouts: readonly Workout[]): Attached[] {
  return workouts.flatMap((workout) => {
    const shape = workout.composedDayShape ?? '';
    if (!/lower|upper|push|pull/.test(shape)) return [];
    const rows = getSessionComponentRows(workout);
    if (rows.strengthRows.length === 0 || rows.conditioningRows.length === 0) return [];
    const option = workout.conditioningBlock?.options[0];
    return [{ shape, modality: option?.modality, category: workout.conditioningCategory, title: option?.title ?? '' }];
  });
}
const isUpper = (shape: string) => /upper|push|pull/.test(shape);

run('the typed policy: lower days off-feet, upper days run outside In-season, everything off-feet in-season, COD never a machine', () => {
  const on = (over: Partial<Parameters<typeof combinedConditioningMustBeOffFeet>[0]>) => combinedConditioningMustBeOffFeet({
    category: 'vo2', strengthRegion: 'upper', hasAvailableMachine: true, seasonPhase: 'Pre-season', ...over,
  });
  assert.equal(on({}), false, 'pre-season upper hard should run');
  assert.equal(on({ seasonPhase: 'Off-season', category: 'tempo' }), false, 'off-season upper tempo should run');
  assert.equal(on({ strengthRegion: 'lower' }), true, 'lower day is off-feet');
  assert.equal(on({ strengthRegion: 'full' }), true, 'full-body day is off-feet');
  assert.equal(on({ seasonPhase: 'In-season' }), true, 'in-season extras are off-feet');
  assert.equal(on({ seasonPhase: 'In-season', category: 'sprint' }), false, 'in-season speed keeps its rider rule');
  assert.equal(on({ category: 'recovery_flush', seasonPhase: 'Off-season' }), true, 'a flush is off-feet');
  assert.equal(on({ category: 'cod_decel', strengthRegion: 'lower' }), false, 'COD is never a machine');
  assert.equal(on({ hasAvailableMachine: false, strengthRegion: 'lower' }), false, 'no machine, no off-feet');
});

for (const [phase, phaseWeek, club] of [['Off-season', 5, false], ['Pre-season', 3, false], ['Pre-season', 9, true]] as const) {
  run(`${phase} week ${phaseWeek}${club ? ' with club nights' : ''}: attached conditioning runs on upper days and stays off-feet on lower days`, () => {
    const attached = attachedConditioning(generate(phase, phaseWeek, club))
      .filter((item) => item.category !== 'sprint' && item.category !== 'cod_decel');
    const upper = attached.filter((item) => isUpper(item.shape));
    const lower = attached.filter((item) => !isUpper(item.shape));
    assert.ok(attached.length > 0, 'no attached conditioning generated');
    for (const item of upper) assert.equal(item.modality, 'running', `upper-day ${item.title} came out ${item.modality}`);
    for (const item of lower) assert.notEqual(item.modality, 'running', `lower-day ${item.title} came out running`);
    assert.ok(upper.length >= 1 || phase === 'Pre-season' && club, `no upper-day attached conditioning to run: ${JSON.stringify(attached)}`);
  });
}

run('In-season with club nights: every attached metabolic exposure is off-feet', () => {
  const attached = attachedConditioning(generate('In-season', 3, true))
    .filter((item) => item.category !== 'sprint');
  assert.ok(attached.length > 0, 'no attached conditioning generated');
  for (const item of attached) assert.notEqual(item.modality, 'running', `in-season ${item.title} came out running`);
});

console.log(`\nConditioning modality by day: ${passed} passed / ${failures.length} failed`);
if (failures.length) process.exit(1);
