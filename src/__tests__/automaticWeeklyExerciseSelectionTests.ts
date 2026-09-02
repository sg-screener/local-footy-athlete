/** R-318 — final automatic weekly exercise selection, judged by delivered names. */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';
const durableStorage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => durableStorage.get(key) ?? null,
  setItem: (key: string, value: string) => { durableStorage.set(key, value); },
  removeItem: (key: string) => { durableStorage.delete(key); },
  clear: () => durableStorage.clear(),
} };

import { generateProgramLocally } from '../services/api/generateProgram';
import {
  auditFinalAutomaticWeek,
  automaticExerciseIsKneeDominant,
  automaticExerciseRouteForIdentity,
  automaticExerciseSuppliesPosteriorChain,
  automaticIsolationSupportCandidatesForSlot,
  automaticMainFamilyForExercise,
  createAutomaticWeeklyExerciseSelector,
  dedicatedLowerDayConflict,
  workoutExerciseWasAutomaticallySelected,
  type FinalAutomaticSelectionDay,
} from '../rules/automaticWeeklyExerciseSelection';
import { minimumUsefulStrengthApplies } from '../rules/minimumUsefulStrengthSession';
import { strengthExerciseClassification } from '../data/exerciseTags';
import { slotDayKindForPatterns } from '../rules/sessionSlotCoverage';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { coldStartThroughOnboarding, quietAsync, relaunchApp } from './support/athleteJourney';
import { athleteAnswers, ARCHETYPES } from './compilerYear/catalog';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { visibleSignature } from './compilerYear/invariants';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { compileCanonicalInjuryWeek } from '../rules/canonicalWeeklyInjuryCompiler';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import type { OnboardingData, SeasonPhase, TrainingProgram, Workout } from '../types/domain';
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}
async function runAsync(name: string, body: () => Promise<void>): Promise<void> {
  try { await body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}
function assert(value: unknown, detail: string): asserts value {
  if (!value) throw new Error(detail);
}
function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

const automatic = (identity: string) => ({ identity, authorship: 'automatic' as const,
  route: 'strength' as const, requestedAsMain: false });
const audit = (days: readonly FinalAutomaticSelectionDay[]) => auditFinalAutomaticWeek(days);

run('Back Squat plus later High Box Squat fails by real squat family despite labels', () => {
  const result = audit([
    { dayKind: 'lower_squat', exercises: [{ ...automatic('Back Squat'), requestedAsMain: true }] },
    { dayKind: 'full_body_a', exercises: [automatic('High Box Squat')] },
  ]);
  assert(result.repeatedMainFamilies.some((item) => item.family === 'squat'),
    JSON.stringify(result));
  const selector = createAutomaticWeeklyExerciseSelector();
  selector.accept({ identity: 'Back Squat', requestedSlot: 'squat',
    dayKind: 'lower_squat', route: 'strength', requestedAsMain: true });
  assert(!selector.canUse({ identity: 'High Box Squat', requestedSlot: 'squat',
    dayKind: 'full_body_a', route: 'strength', requestedAsMain: true }),
  'live selector admitted a second real squat family');
});

run('any two bilateral squat variations fail one weekly family', () => {
  const result = audit([{ dayKind: 'lower', exercises: [
    { ...automatic('Front Squat'), requestedAsMain: true }, automatic('Box Squat'),
  ] }]);
  assert(result.repeatedMainFamilies.length === 1
    && result.repeatedMainFamilies[0]?.family === 'squat', JSON.stringify(result));
  const selector = createAutomaticWeeklyExerciseSelector();
  selector.accept({ identity: 'Front Squat', requestedSlot: 'squat',
    dayKind: 'lower', route: 'strength', requestedAsMain: true });
  assert(!selector.canUse({ identity: 'Box Squat', requestedSlot: 'squat',
    dayKind: 'lower', route: 'strength', requestedAsMain: true }),
  'live selector admitted two squat variations');
});

run('any two bilateral hinge variations fail one weekly family', () => {
  const result = audit([{ dayKind: 'lower', exercises: [
    { ...automatic('Deadlift'), requestedAsMain: true }, automatic('RDLs'),
  ] }]);
  assert(result.repeatedMainFamilies.length === 1
    && result.repeatedMainFamilies[0]?.family === 'hinge', JSON.stringify(result));
  const selector = createAutomaticWeeklyExerciseSelector();
  selector.accept({ identity: 'Deadlift', requestedSlot: 'hinge',
    dayKind: 'lower', route: 'strength', requestedAsMain: true });
  assert(!selector.canUse({ identity: 'Trap Bar Deadlift', requestedSlot: 'hinge',
    dayKind: 'lower', route: 'strength', requestedAsMain: true }),
  'live selector admitted two hinge variations');
});

run('Bulgarian Split Squats fail dedicated Lower Hinge ownership', () => {
  const result = audit([{ dayKind: 'lower_hinge', exercises: [
    { ...automatic('RDLs'), requestedAsMain: true }, automatic('Bulgarian Split Squats'),
  ] }]);
  assert(result.dedicatedDayOwnership.some((item) => item.identity === 'Bulgarian Split Squats'),
    JSON.stringify(result));
  const selector = createAutomaticWeeklyExerciseSelector();
  assert(!selector.canUse({ identity: 'Bulgarian Split Squats',
    requestedSlot: 'single_leg_knee', dayKind: 'lower_hinge', route: 'strength',
    requestedAsMain: false }), 'live selector admitted single-leg knee on Lower Hinge');
});

/* ── R-336: dedicated Lower Hinge admits only hinge-purpose support ────────── */
const KNEE_DOMINANT_SUPPORT = [
  // typed movement: squat / lunge / step family
  'Step Ups', 'Walking Lunges', 'Goblet Squat', 'Single-Leg Leg Press',
  // typed movement on a prehab-authored drill
  'Slant Board Step-Down',
  // typed primary muscle: quad/knee-led isolation and prehab
  'Leg Extension', 'Reverse Nordic Curl', 'Spanish Squat Hold', 'Banded TKE',
  'Standing Knee Extension',
] as const;
const HINGE_PURPOSE_SUPPORT = [
  'Nordic Lower', 'Hamstring Curl', 'Back Extension', 'Single-Leg Hip Thrust',
  'Swiss Ball Hamstring Curl', 'Bosch Hold', 'SL 45° Back Extension Hold', 'Crab Walks',
] as const;
const HINGE_GENERAL_SUPPORT = [
  'Copenhagen Plank (Half)', 'Groin Squeeze', 'Calf Raises', 'Tib Raises', 'Seated Calf Raise',
] as const;

run('every knee-dominant strength or prehab exercise is refused on a dedicated Lower Hinge by typed metadata', () => {
  for (const identity of KNEE_DOMINANT_SUPPORT) {
    const route = automaticExerciseRouteForIdentity(identity);
    assert(automaticExerciseIsKneeDominant(identity), `${identity} not classified knee-dominant`);
    assert(dedicatedLowerDayConflict(identity, 'lower_hinge', route) !== null,
      `${identity} (${route}) has no typed hinge-day conflict`);
    const selector = createAutomaticWeeklyExerciseSelector();
    assert(!selector.canUse({ identity, requestedSlot: 'football_robustness',
      dayKind: 'lower_hinge', route, requestedAsMain: false }),
    `live selector admitted ${identity} (${route}) on Lower Hinge`);
    const result = audit([{ dayKind: 'lower_hinge', exercises: [
      { ...automatic('RDLs'), requestedAsMain: true }, { ...automatic(identity), route },
    ] }]);
    assert(result.dedicatedDayOwnership.some((item) => item.identity === identity),
      `final audit missed ${identity}: ${JSON.stringify(result.dedicatedDayOwnership)}`);
  }
});

run('hinge-purpose and general robustness support remain admitted on Lower Hinge; Lower Squat is unchanged', () => {
  const admitted = (identity: string, dayKind: 'lower_hinge' | 'lower_squat'): void => {
    const route = automaticExerciseRouteForIdentity(identity);
    assert(dedicatedLowerDayConflict(identity, dayKind, route) === null,
      `${identity} (${route}) refused on ${dayKind}`);
    assert(createAutomaticWeeklyExerciseSelector().canUse({ identity,
      requestedSlot: 'football_robustness', dayKind, route, requestedAsMain: false }),
    `live selector refused ${identity} (${route}) on ${dayKind}`);
  };
  for (const identity of [...HINGE_PURPOSE_SUPPORT, ...HINGE_GENERAL_SUPPORT]) {
    assert(!automaticExerciseIsKneeDominant(identity), `${identity} wrongly classified knee-dominant`);
    admitted(identity, 'lower_hinge');
  }
  // Lower Squat keeps R-318 exactly: general robustness and genuine prehab stay
  // legal there, while strength-route single-leg hip work stays refused.
  for (const identity of HINGE_GENERAL_SUPPORT) admitted(identity, 'lower_squat');
  for (const identity of HINGE_PURPOSE_SUPPORT) {
    if (automaticExerciseRouteForIdentity(identity) === 'prehab') admitted(identity, 'lower_squat');
  }
  for (const identity of HINGE_PURPOSE_SUPPORT) {
    assert(automaticExerciseSuppliesPosteriorChain(identity), `${identity} is not posterior-chain`);
  }
  for (const identity of HINGE_GENERAL_SUPPORT) {
    assert(!automaticExerciseSuppliesPosteriorChain(identity), `${identity} is not general support`);
  }
  // Lower Squat is unchanged: knee work stays legal there and hip work stays refused.
  assert(dedicatedLowerDayConflict('Slant Board Step-Down', 'lower_squat', 'prehab') === null,
    'Lower Squat lost its knee-capacity prehab');
  assert(dedicatedLowerDayConflict('Single-Leg RDL', 'lower_squat', 'strength') === 'hip_dominant_movement',
    'Lower Squat admitted single-leg hip work');
});

run('a hinge-day robustness fallback skips knee-dominant prehab and spends posterior-chain work before calf', () => {
  const selector = createAutomaticWeeklyExerciseSelector();
  // Frontal and transverse are already supplied this week, so the movement-plane
  // tie-break is silent and only the hinge purpose orders the bench.
  selector.accept({ identity: 'Crab Walks', requestedSlot: 'football_robustness',
    dayKind: 'lower_squat', route: 'prehab', requestedAsMain: false });
  const bench = ['Slant Board Step-Down', 'Banded TKE', 'Tib Raises', 'Swiss Ball Hamstring Curl'];
  const hinge = selector.chooseFallback({ sameCategory: [], accessories: [], prehab: bench,
    requestedSlot: 'football_robustness', dayKind: 'lower_hinge', requestedAsMain: false });
  assert(hinge?.identity === 'Swiss Ball Hamstring Curl', JSON.stringify(hinge));
  const squat = selector.chooseFallback({ sameCategory: [], accessories: [], prehab: bench,
    requestedSlot: 'football_robustness', dayKind: 'lower_squat', requestedAsMain: false });
  assert(squat?.identity === 'Slant Board Step-Down', JSON.stringify(squat));
  const exhausted = selector.chooseFallback({ sameCategory: [], accessories: [],
    prehab: ['Slant Board Step-Down', 'Spanish Squat Hold'],
    coreOrRobustness: ['Band Pallof Press'],
    requestedSlot: 'football_robustness', dayKind: 'lower_hinge', requestedAsMain: false });
  assert(exhausted?.identity === 'Band Pallof Press' && exhausted.tier === 'core_or_robustness',
    JSON.stringify(exhausted));
});

run('repeated Single-Leg RDL falls to an unused hip/hamstring accessory', () => {
  const selector = createAutomaticWeeklyExerciseSelector();
  selector.accept({ identity: 'Single-Leg RDL', requestedSlot: 'single_leg_hip',
    dayKind: 'full_body_a', route: 'strength', requestedAsMain: false });
  const selected = selector.chooseFallback({
    sameCategory: ['Single-Leg RDL'],
    accessories: ['Hip Thrusts', 'Hamstring Curl'],
    prehab: ['Nordic Lower'],
    requestedSlot: 'single_leg_hip', dayKind: 'lower_hinge', requestedAsMain: false,
  });
  assert(selected?.identity === 'Hamstring Curl' && selected.tier === 'accessory',
    JSON.stringify(selected));
});

run('repeated upper main work falls to unused upper accessory before prehab', () => {
  const selector = createAutomaticWeeklyExerciseSelector();
  selector.accept({ identity: 'Bench Press', requestedSlot: 'horizontal_push',
    dayKind: 'upper_full', route: 'strength', requestedAsMain: true });
  const selected = selector.chooseFallback({
    sameCategory: ['Bench Press'],
    accessories: automaticIsolationSupportCandidatesForSlot('push_accessory_1'),
    prehab: ['Banded External Rotation'], requestedSlot: 'horizontal_push',
    dayKind: 'upper_split_push', requestedAsMain: false,
  });
  assert(selected && strengthExerciseClassification(selected.identity) === 'isolation'
    && selected.tier === 'accessory',
    JSON.stringify(selected));
});

run('upper fallback reaches real prehab only after strength options are exhausted', () => {
  const selector = createAutomaticWeeklyExerciseSelector();
  selector.accept({ identity: 'Bench Press', requestedSlot: 'horizontal_push',
    dayKind: 'upper_full', route: 'strength', requestedAsMain: true });
  const selected = selector.chooseFallback({
    sameCategory: ['Bench Press'], accessories: ['High Box Squat'],
    prehab: ['Banded External Rotation'], requestedSlot: 'horizontal_push',
    dayKind: 'upper_split_push', requestedAsMain: false,
  });
  assert(selected?.identity === 'Banded External Rotation'
    && selected.tier === 'prehab' && selected.route === 'prehab'
    && selected.requestedSlot === 'shoulder_prehab', JSON.stringify(selected));
  assert(!selector.canUse({ identity: 'Tricep Pushdown',
    requestedSlot: 'horizontal_push', dayKind: 'upper_split_push',
    route: 'strength', requestedAsMain: true }),
  'unrelated arm work pretended to be the missing main push');
});

run('genuine mobility/prehab may repeat and can never satisfy a main family', () => {
  const selector = createAutomaticWeeklyExerciseSelector();
  const mobility = { identity: 'Crab Hold', requestedSlot: 'core' as const,
    dayKind: 'lower_squat' as const, route: 'mobility' as const, requestedAsMain: false };
  assert(selector.canUse(mobility), 'first mobility row refused'); selector.accept(mobility);
  assert(selector.canUse(mobility), 'repeated genuine mobility row refused'); selector.accept(mobility);
  assert(automaticMainFamilyForExercise('Bottoms-Up KB Press', {
    route: 'prehab', requestedAsMain: true,
  }) === null, 'prehab pretended to satisfy a main family');
});

const DAYS: Readonly<Record<number, readonly string[]>> = {
  2: ['Monday', 'Thursday'], 3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Sunday'],
};
function athlete(gender: 'male' | 'female', phase: SeasonPhase, gymDays: number,
  club: boolean): OnboardingData {
  return {
    gender, seasonPhase: phase, gameDay: phase === 'Off-season' ? undefined : 'Saturday',
    trainingDaysPerWeek: gymDays, preferredTrainingDays: [...DAYS[gymDays]],
    teamTrainingDaysPerWeek: club && phase !== 'Off-season' ? 2 : 0,
    teamTrainingDays: club && phase !== 'Off-season' ? ['Tuesday', 'Thursday'] : [],
    equipmentAnswer: presetEquipmentAnswer('commercial_gym'), injuries: [],
    goals: ['Get stronger'], experienceLevel: '2-5 years', sprintExposure: 'Occasionally',
    conditioningLevel: 'Good', recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight',
    weightKg: gender === 'female' ? 65 : 85,
  } as unknown as OnboardingData;
}
function finalDays(program: TrainingProgram): FinalAutomaticSelectionDay[][] {
  return program.microcycles.map((week) => week.workouts.map((workout: Workout) => ({
    dayKind: slotDayKindForPatterns(workout.strengthIntent?.plannedPatterns ?? []),
    exercises: (workout.exercises ?? [])
      .filter((row) => row.section18Evidence?.provenance === 'composer_declaration')
      .map((row) => ({
        identity: String(row.exercise?.name ?? ''), authorship: 'automatic' as const,
        route: automaticExerciseRouteForIdentity(String(row.exercise?.name ?? '')),
        requestedAsMain: row.section18Evidence?.role === 'main_strength',
      })),
  })));
}

function allAutomaticGymDays(program: TrainingProgram): FinalAutomaticSelectionDay[][] {
  return program.microcycles.map((week) => week.workouts.map((workout: Workout) => ({
    dayKind: slotDayKindForPatterns(workout.strengthIntent?.plannedPatterns ?? []),
    exercises: (workout.exercises ?? []).flatMap((row) => {
      const role = row.section18Evidence?.role;
      if (!workoutExerciseWasAutomaticallySelected(row)) return [];
      const identity = String(row.exercise?.name ?? '');
      return [{
        identity,
        authorship: 'automatic' as const,
        route: row.role === 'power' ? 'power' as const
          : automaticExerciseRouteForIdentity(identity),
        requestedAsMain: role === 'main_strength',
      }];
    }),
  })));
}

function automaticRepeatsInWorkouts(workouts: readonly Workout[]) {
  return audit(workouts.map((workout) => ({
    dayKind: slotDayKindForPatterns(workout.strengthIntent?.plannedPatterns ?? []),
    exercises: workout.exercises.flatMap((row) => {
      if (!workoutExerciseWasAutomaticallySelected(row)) return [];
      const identity = row.exercise?.name ?? '';
      return [{ identity, authorship: 'automatic' as const,
        route: row.role === 'power' ? 'power' as const
          : automaticExerciseRouteForIdentity(identity),
        requestedAsMain: row.section18Evidence?.role === 'main_strength' }];
    }),
  }))).repeatedExact;
}

const worlds: { id: string; program: TrainingProgram }[] = [];
for (const phase of ['In-season', 'Pre-season', 'Off-season'] as const) {
  for (const gymDays of [2, 3, 4, 5, 6]) {
    for (const gender of ['male', 'female'] as const) {
      for (const club of phase === 'Off-season' ? [false] : [false, true]) {
        worlds.push({ id: `${gender}/${phase}/${gymDays}d/${club ? 'club' : 'noclub'}`,
          program: quiet(() => generateProgramLocally(athlete(gender, phase, gymDays, club), {
            todayISO: '2026-08-03', blockNumber: 1, selectionHistory: [], recordSelections: false,
          })) });
      }
    }
  }
}

run('50 real generated worlds have no non-prehab identity, family or ownership breach', () => {
  const findings: string[] = [];
  for (const world of worlds) for (const [index, days] of finalDays(world.program).entries()) {
    const result = audit(days);
    if (result.repeatedExact.length || result.repeatedMainFamilies.length
      || result.dedicatedDayOwnership.length) findings.push(`${world.id}/week${index + 1}: ${JSON.stringify(result)}`);
  }
  assert(findings.length === 0, `${findings.length} invalid athlete-weeks\n${findings.slice(0, 20).join('\n')}`);
});

run('no dedicated Lower Hinge in 50 generated worlds carries knee-dominant automatic work and each stays useful', () => {
  const findings: string[] = [];
  let hingeDays = 0;
  for (const world of worlds) for (const [index, week] of world.program.microcycles.entries()) {
    for (const workout of week.workouts as Workout[]) {
      const dayKind = workout.composedDayShape
        ?? slotDayKindForPatterns(workout.strengthIntent?.plannedPatterns ?? []);
      if (dayKind !== 'lower_hinge') continue;
      hingeDays += 1;
      const rows = (workout.exercises ?? []).filter(workoutExerciseWasAutomaticallySelected)
        .filter((row) => row.role !== 'power');
      const knee = rows.map((row) => row.exercise?.name ?? '')
        .filter((identity) => automaticExerciseIsKneeDominant(identity));
      if (knee.length) findings.push(`${world.id}/week${index + 1}: knee-dominant ${knee.join(', ')}`);
      const contract = workout.usefulStrengthSessionContract;
      if (minimumUsefulStrengthApplies(dayKind)
        && (!contract || contract.status === 'unexplained_shortfall')) {
        findings.push(`${world.id}/week${index + 1}: useful-session ${JSON.stringify(contract)}`);
      }
    }
    const repeats = automaticRepeatsInWorkouts(week.workouts as Workout[]);
    if (repeats.length) findings.push(`${world.id}/week${index + 1}: repeats ${JSON.stringify(repeats)}`);
  }
  assert(hingeDays > 0, 'no dedicated Lower Hinge day was generated');
  assert(findings.length === 0, `${findings.length} findings across ${hingeDays} hinge days\n${findings.slice(0, 20).join('\n')}`);
});

run('male Gunshow accessories do not repeat an earlier automatic upper-session exercise', () => {
  const program = worlds.find((world) => world.id === 'male/In-season/5d/noclub')?.program;
  assert(program, 'male one-game world missing');
  const gunshowRows = program.microcycles.flatMap((week) => week.workouts
    .filter((workout) => workout.composedOptionalKind === 'gunshow')
    .flatMap((workout) => workout.exercises)
    .filter((row) => automaticExerciseRouteForIdentity(row.exercise?.name ?? '') === 'strength'));
  assert(gunshowRows.length > 0 && gunshowRows.every((row) => row.automaticSelection === true),
    `automatic Gunshow rows lost typed authorship: ${JSON.stringify(gunshowRows)}`);
  const failures = allAutomaticGymDays(program).flatMap((days, weekIndex) => {
    const finding = audit(days).repeatedExact;
    return finding.length ? [{ week: weekIndex + 1, finding }] : [];
  });
  assert(failures.length === 0, JSON.stringify(failures));
});

run('female Primer power does not repeat automatic power used earlier in the week', () => {
  const program = worlds.find((world) => world.id === 'female/In-season/5d/noclub')?.program;
  assert(program, 'female one-game world missing');
  const primerGymRows = program.microcycles.flatMap((week) => week.workouts
    .filter((workout) => workout.composedOptionalKind === 'primer')
    .flatMap((workout) => workout.exercises)
    .filter((row) => row.role === 'power'
      || automaticExerciseRouteForIdentity(row.exercise?.name ?? '') === 'strength'));
  assert(primerGymRows.length > 0 && primerGymRows.every((row) => row.automaticSelection === true),
    `automatic Primer rows lost typed authorship: ${JSON.stringify(primerGymRows)}`);
  const failures = allAutomaticGymDays(program).flatMap((days, weekIndex) => {
    const finding = audit(days).repeatedExact;
    return finding.length ? [{ week: weekIndex + 1, finding }] : [];
  });
  assert(failures.length === 0, JSON.stringify(failures));
});

run('every automatic gym session family has zero exact weekly repeats across 50 generated worlds', () => {
  const failures = worlds.flatMap((world) => allAutomaticGymDays(world.program)
    .flatMap((days, weekIndex) => {
      const finding = audit(days).repeatedExact;
      return finding.length ? [{ world: world.id, week: weekIndex + 1, finding }] : [];
    }));
  assert(failures.length === 0, `${failures.length} repeated athlete-weeks\n${JSON.stringify(failures.slice(0, 20))}`);
});

run('an unshipped bodyweight support choice cannot block a later legal main push', () => {
  const profile = athlete('male', 'Off-season', 5, false) as OnboardingData & {
    seasonFinishedOn?: string; equipment?: string[];
  };
  profile.seasonFinishedOn = '2026-06-15';
  profile.equipment = ['Bodyweight Only'];
  profile.equipmentAnswer = { tags: {}, modalities: {}, answeredOn: '2026-07-13' } as never;
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
    selectionHistory: [], recordSelections: false,
  }));
  const names = program.microcycles[0]?.workouts.flatMap((workout) =>
    (workout.exercises ?? []).filter((row) =>
      row.section18Evidence?.provenance === 'composer_declaration')
      .map((row) => row.exercise?.name)) ?? [];
  assert(names.includes('Push-ups'), `discarded earlier session spent Push-ups: ${names.join(', ')}`);
  const result = audit(finalDays(program)[0] ?? []);
  assert(result.repeatedExact.length === 0 && result.repeatedMainFamilies.length === 0
    && result.dedicatedDayOwnership.length === 0, JSON.stringify(result));
});

run('mid-week remainder starts with earlier delivered automatic choices spent', () => {
  const selector = createAutomaticWeeklyExerciseSelector([
    'Back Squat', 'DB Shoulder Press', 'Band Pallof Press',
  ]);
  assert(!selector.canUse({ identity: 'High Box Squat', requestedSlot: 'squat',
    dayKind: 'full_body_a', route: 'strength', requestedAsMain: true }),
  'earlier Back Squat did not spend the real squat family');
  assert(!selector.canUse({ identity: 'DB Shoulder Press', requestedSlot: 'vertical_push',
    dayKind: 'upper_split_push', route: 'strength', requestedAsMain: true }),
  'earlier exact upper exercise did not seed the remainder');
  assert(!selector.canUse({ identity: 'Band Pallof Press', requestedSlot: 'core',
    dayKind: 'upper_split_push', route: 'strength', requestedAsMain: false }),
  'earlier exact support exercise did not seed the remainder');
});

run('injury rebuilding spends earlier automatic choices instead of repeating them', () => {
  const stampedAt = '2026-08-03T00:00:00.000Z';
  const automaticWorkout = (id: string, dayOfWeek: number, identity: string): Workout => ({
    id, microcycleId: 'injury-selector-week', dayOfWeek, name: 'Lower',
    description: '', durationMinutes: 45, intensity: 'Moderate', workoutType: 'Strength',
    exercises: [{
      id: `${id}-row`, workoutId: id, exerciseId: identity.toLowerCase().replace(/\W+/g, '-'),
      exerciseOrder: 1, prescribedSets: 2, prescribedRepsMin: 5, prescribedRepsMax: 5,
      restSeconds: 60, notes: '', automaticSelection: true,
      section18Evidence: { protocolVersion: 1,
        role: 'strength_accessory', strengthPattern: null, mainStrengthPattern: null,
        provenance: 'canonical_row_classifier' },
      exercise: { id: identity.toLowerCase().replace(/\W+/g, '-'), name: identity,
        description: '' }, createdAt: stampedAt, updatedAt: stampedAt,
    }],
    createdAt: stampedAt, updatedAt: stampedAt,
  });
  const injury: ActiveInjuryConstraint = {
    id: 'weekly-selector-quad', type: 'injury', bodyPart: 'Quadriceps', bucket: 'quad',
    severity: 6, status: 'active', startDate: '2026-08-05', lastUpdatedAt: '2026-08-05',
    triggers: ['lunging'], rules: [], safeFocus: [], advice: [],
  };
  const result = quiet(() => compileCanonicalInjuryWeek({
    workoutsByDate: {
      '2026-08-03': automaticWorkout('earlier-lower', 1, 'Glute Bridge'),
      '2026-08-05': automaticWorkout('later-lower', 3, 'Walking Lunges'),
    },
    profile: athlete('male', 'Pre-season', 3, false), constraints: [injury],
    exclusions: [], recordedLoads: {},
  }));
  const laterStage = result.stagesByDate['2026-08-05']?.[0];
  assert(laterStage?.plan.unsafeRows.includes('Walking Lunges'),
    `injury rebuild never reached the unsafe automatic row: ${JSON.stringify(laterStage?.plan)}`);
  const rebuilt = Object.values(result.workoutsByDate);
  assert(automaticRepeatsInWorkouts(rebuilt).length === 0,
    `injury rebuild repeated an earlier automatic choice: ${JSON.stringify(automaticRepeatsInWorkouts(rebuilt))}`);
  assert(!result.workoutsByDate['2026-08-05']?.exercises
    .some((row) => row.exercise?.name === 'Glute Bridge'),
  'injury rebuild reused Glute Bridge after the earlier automatic session spent it');
});

run('athlete-authored duplicates are outside the automatic selector and do not create refills', () => {
  const result = audit([{ dayKind: 'lower_squat', exercises: [
    { ...automatic('Back Squat'), requestedAsMain: true },
    { identity: 'Back Squat', authorship: 'athlete', route: 'strength', requestedAsMain: false },
  ] }]);
  assert(result.repeatedExact.length === 0 && result.repeatedMainFamilies.length === 0,
    JSON.stringify(result));
});

async function durableProofs(): Promise<void> {
  await runAsync('final automatic choices and athlete-added duplicate survive restart without refill', async () => {
    durableStorage.clear();
    const profile = athleteAnswers({ ...ARCHETYPES[6], gender: 'male', extraGame: false });
    profile.seasonPhase = 'Pre-season';
    profile.equipmentAnswer = presetEquipmentAnswer('commercial_gym', '2026-11-16');
    const install = await quietAsync(() => coldStartThroughOnboarding({
      profile, installDayISO: '2026-11-16',
    }));
    assert(!install.onboardingRefusal, String(install.onboardingRefusal));
    const read = () => quiet(() => deriveVisibleWeekLive(install.blockOneStart, '2026-11-16'));
    const automaticRows = () => read().flatMap((day) => (day.workout?.exercises ?? [])
      .filter((row) => row.section18Evidence?.provenance === 'composer_declaration')
      .map((row) => `${day.date}:${row.id}:${row.exercise?.name}`));
    const beforeAutomatic = automaticRows();
    const source = read().flatMap((day) => (day.workout?.exercises ?? [])
      .map((row) => ({ date: day.date, name: row.exercise?.name ?? '' })))
      .find((row) => row.name.length > 0);
    assert(source, 'no automatic exercise reached the final visible week');
    const target = read().find((day) => day.workout
      && day.date !== source.date
      && !day.workout.exercises.some((row) => row.exercise?.name === source.name));
    assert(target, `no second session can receive athlete duplicate ${source.name}`);
    const added = await quietAsync(() => executeProgramControlActionDurably({
      type: 'add_exercise',
      source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: { date: target.date, exercise: {
        name: source.name, sets: 2, repsMin: 8, repsMax: 10,
      } },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
    }, { todayISO: '2026-11-16' }));
    assert(added.ok, JSON.stringify(added));
    const duplicateCount = read().flatMap((day) => day.workout?.exercises ?? [])
      .filter((row) => row.exercise?.name === source.name).length;
    assert(duplicateCount >= 2, `athlete duplicate was rejected: ${source.name}`);
    assert(read().flatMap((day) => day.workout?.exercises ?? [])
      .some((row) => row.exercise?.name === source.name
        && !workoutExerciseWasAutomaticallySelected(row)),
    'athlete-added duplicate was incorrectly entered into automatic history');
    assert(automaticRepeatsInWorkouts(read().flatMap((day) => day.workout ? [day.workout] : [])).length === 0,
      'automatic weekly history contains a repeat after the athlete addition');
    assert(JSON.stringify(automaticRows()) === JSON.stringify(beforeAutomatic),
      'athlete addition caused automatic rows to refill or move');
    const beforeRestart = visibleSignature(read());
    const restarted = await quietAsync(() => relaunchApp({
      storage: durableStorage, todayISO: '2026-11-16',
    }));
    assert(restarted.ok && visibleSignature(read()) === beforeRestart,
      JSON.stringify(restarted));
    assert(automaticRepeatsInWorkouts(read().flatMap((day) => day.workout ? [day.workout] : [])).length === 0,
      'automatic weekly history contains a repeat after restart');
  });

  console.log(`\nAutomatic weekly exercise selection: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
  totalsPrinted(failures.length);
  if (failures.length) process.exit(1);
}

durableProofs().catch((error) => {
  console.error(error); totalsPrinted(1); process.exit(1);
});
