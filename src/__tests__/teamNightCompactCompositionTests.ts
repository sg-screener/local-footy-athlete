/**
 * R-314 red-first boundary — compact required gym work on a Team Training day.
 *
 * This drives the real local generator and reads the final stored exercise rows.
 * Movement Prep is projected separately, so every row counted here is the gym
 * portion the athlete sees after it.
 *
 * Run: npm run test:team-night-compact
 */
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { generateProgramLocally } from '../services/api/generateProgram';
import { getExerciseTags } from '../data/exerciseTags';
import { footballRobustnessCategoriesForExercise } from '../rules/footballRobustnessFoundation';
import type { OnboardingData, SeasonPhase, Workout, WorkoutExercise } from '../types/domain';

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: unknown, detail = ''): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function quietly<T>(run: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => undefined; console.warn = () => undefined; console.error = () => undefined;
  try { return run(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

const TODAY = '2026-09-07';
const TEAM_DAYS = ['Tuesday', 'Thursday'] as const;

function profile(
  gender: 'male' | 'female',
  phase: SeasonPhase,
  injured = false,
): OnboardingData {
  return {
    firstName: `${gender}-${phase}`, ageRange: '22-26', gender,
    position: 'inside_mid', heightCm: 178, weightKg: 80,
    motivation: 'Build strength and football fitness', goals: ['stronger_and_fitter'],
    seasonPhase: phase,
    seasonFinishedOn: phase === 'Off-season' ? '2026-09-06' : undefined,
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDays: [...TEAM_DAYS], teamTrainingDaysPerWeek: TEAM_DAYS.length,
    usualGameDay: phase === 'In-season' ? 'Saturday' : undefined,
    gameDay: phase === 'In-season' ? 'Saturday' : undefined,
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'], equipmentSelectionCompleteness: 'complete',
    injuries: injured ? [{
      bodyArea: 'Shoulder', description: 'Pain with upper-body lifting',
      severity: 'Moderate', severityScore: 5, whenItHurts: 'Lifting',
    }] : [],
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight', conditioningLevel: 'Good',
    sprintExposure: '2+ times per week', recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: { seconds: 480, recordedOn: TODAY, source: 'onboarding' },
  } as OnboardingData;
}

function generate(
  gender: 'male' | 'female',
  phase: SeasonPhase,
  phaseWeek: number,
  injured = false,
): Workout[] {
  const phaseEntry = new Date(`${TODAY}T12:00:00Z`);
  phaseEntry.setUTCDate(phaseEntry.getUTCDate() - ((phaseWeek - 1) * 7));
  const athlete = profile(gender, phase, injured);
  return quietly(() => generateProgramLocally(athlete, {
    todayISO: TODAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: phase,
      phaseEntryWeekStartISO: phaseEntry.toISOString().slice(0, 10),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })).microcycles[0]?.workouts ?? [];
}

type GymRowKind = 'explosive' | 'upper' | 'support' | 'other';
function rowKind(row: WorkoutExercise): GymRowKind {
  if (row.role === 'power') return 'explosive';
  const evidence = row.section18Evidence as unknown as {
    slot?: string | null;
    strengthPattern?: string | null;
    mainStrengthPattern?: string | null;
  } | undefined;
  const pattern = evidence?.mainStrengthPattern ?? evidence?.strengthPattern ?? null;
  if (pattern === 'push' || pattern === 'pull') return 'upper';
  const name = row.exercise?.name ?? '';
  const movement = getExerciseTags(name)?.movement;
  if (['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']
    .includes(movement ?? '')) return 'upper';
  if (['football_robustness', 'core', 'midline', 'accessory_or_core']
    .includes(evidence?.slot ?? '')
    || movement === 'core'
    || footballRobustnessCategoriesForExercise(name).length > 0) return 'support';
  return 'other';
}

function compactFinding(workout: Workout): string | null {
  const rows = (workout.exercises ?? []).filter((row) => row.role !== 'conditioning');
  const kinds = rows.map(rowKind);
  const count = (kind: GymRowKind) => kinds.filter((value) => value === kind).length;
  if (count('explosive') > 1 || count('upper') > 2 || count('support') > 2
    || count('other') > 0 || rows.length > 5) {
    return `${workout.name} => ${rows.map((row, index) =>
      `${rowKind(row)}:${row.exercise?.name ?? `row-${index + 1}`}`).join(', ')}`;
  }
  return null;
}

function teamNightFindings(workouts: readonly Workout[]): string[] {
  return workouts
    .filter((workout) => workout.workoutType === 'Team Training'
      && (workout.exercises ?? []).some((row) => row.role !== 'conditioning'))
    .flatMap((workout) => compactFinding(workout) ? [compactFinding(workout)!] : []);
}

console.log('\nR-314 — compact required gym work on team-training nights');

for (const gender of ['male', 'female'] as const) {
  const offseason = generate(gender, 'Off-season', 1);
  check(`${gender} Off-season retires team anchors rather than inventing an attached gym exception`,
    offseason.every((workout) => workout.workoutType !== 'Team Training'),
    offseason.map((workout) => workout.name).join(' | '));

  for (const phase of ['Pre-season', 'In-season'] as const) {
    for (const world of [
      { label: 'build', phaseWeek: 1, injured: false },
      { label: 'scheduled deload', phaseWeek: 4, injured: false },
      { label: 'moderate upper injury', phaseWeek: 1, injured: true },
    ]) {
      const workouts = generate(gender, phase, world.phaseWeek, world.injured);
      const teamGym = workouts.filter((workout) => workout.workoutType === 'Team Training'
        && (workout.exercises ?? []).some((row) => row.role !== 'conditioning'));
      const findings = teamNightFindings(workouts);
      check(`${gender} ${phase} ${world.label} reaches required gym on a team night`,
        teamGym.length > 0,
        workouts.map((workout) => `${workout.dayOfWeek}:${workout.name}`).join(' | '));
      check(`${gender} ${phase} ${world.label} final team-night gym is compact`,
        teamGym.length > 0 && findings.length === 0,
        findings.join(' | '));
      if (world.label === 'build') {
        const healthyShapeFailures = teamGym.flatMap((workout) => {
          const gymRows = (workout.exercises ?? []).filter((row) => row.role !== 'conditioning');
          const upper = gymRows.filter((row) => rowKind(row) === 'upper').length;
          const support = gymRows.filter((row) => rowKind(row) === 'support').length;
          return upper === 2 && support >= 1 && support <= 2
            ? [] : [`${workout.name}: upper=${upper} support=${support}`];
        });
        check(`${gender} ${phase} build keeps two upper lifts plus one or two support rows`,
          healthyShapeFailures.length === 0,
          healthyShapeFailures.join(' | '));
        const declarationFailures = teamGym.flatMap((workout) => {
          const strengthRows = (workout.exercises ?? []).filter((row) =>
            row.role !== 'conditioning' && row.role !== 'power');
          const declared = (workout as unknown as { composedDeclaredSlots?: readonly string[] })
            .composedDeclaredSlots ?? [];
          return declared.length > 0 && declared.length === strengthRows.length
            ? [] : [`${workout.name}: declared=${declared.length} final=${strengthRows.length}`];
        });
        check(`${gender} ${phase} build final rows equal the composer's compact declaration`,
          declarationFailures.length === 0,
          declarationFailures.join(' | '));
      }
    }
  }
}

console.log(`\nTeam-night compact composition: passed=${passed} failures=${failures.length}`);
if (failures.length > 0) process.exitCode = 1;
