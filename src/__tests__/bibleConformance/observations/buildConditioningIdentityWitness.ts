import type { Workout, WorkoutExercise } from '../../../types/domain';
import { projectConditioningVisibleIdentity } from '../../../utils/conditioningVisibleIdentity';
import { buildRepeatWeekOverlay } from '../../../utils/repeatWeek';
import { deriveVisibleWorkoutIdentity } from '../../../utils/visibleWorkoutIdentity';
import { weeklyPlanContextLabel, weeklyPlanTitle } from '../../../utils/weeklyPlanDisplay';
import type { ConditioningIdentityWitness } from '../invariants/conditioningIdentityInvariants';

function row(id: string, name: string, sets = 1, restSeconds = 0): WorkoutExercise {
  return {
    id, workoutId: 'identity-witness', exerciseId: id, exerciseOrder: Number(id.replace(/\D/g, '')) || 1,
    prescribedSets: sets, prescribedRepsMin: 1, prescribedRepsMax: 1, restSeconds,
    exercise: {
      id, name, description: name, muscleGroups: [], exerciseType: 'Cardio',
      equipmentRequired: [], difficultyLevel: 'Intermediate', createdAt: '', updatedAt: '',
    },
    createdAt: '', updatedAt: '',
  };
}

function aerobic(rows: WorkoutExercise[], overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'identity-witness', microcycleId: 'identity-witness-mc', dayOfWeek: 2,
    name: 'Generic template', description: '', durationMinutes: 40, intensity: 'Moderate',
    workoutType: 'Conditioning', conditioningCategory: 'aerobic_base', conditioningFlavour: 'aerobic',
    conditioningBlock: {
      intent: 'aerobic',
      options: [{ title: 'Generic template', description: '', exerciseIds: rows.map((value) => value.id) }],
    },
    exercises: rows, createdAt: '', updatedAt: '', ...overrides,
  };
}

export function buildConditioningIdentityWitness(): ConditioningIdentityWitness {
  const continuous = aerobic([row('c1', '40min steady Zone 2 Bike')]);
  const long = aerobic([row('l1', '3 x 8min aerobic RowErg', 3, 120)]);
  const warmupGuard = aerobic([
    row('w1', '5min Bike warm-up'),
    row('w2', '3 x 8min aerobic RowErg', 3, 120),
    row('w3', '5min Bike cool-down'),
  ]);
  const tempo = aerobic([row('t1', '5 x 2min tempo SkiErg', 5, 60)], {
    conditioningCategory: 'tempo', conditioningFlavour: 'tempo',
    conditioningBlock: { intent: 'tempo', options: [{ title: 'Aerobic Base', description: '', exerciseIds: ['t1'] }] },
  });
  const attached = aerobic([row('a1', '3 x 8min aerobic RowErg', 3, 120)], {
    name: 'Upper Push', workoutType: 'Mixed', hasCombinedConditioning: true,
    attachedConditioningKind: 'component',
    conditioningBlock: { intent: 'aerobic', attachedKind: 'component', options: [{ title: 'RowErg', description: '', exerciseIds: ['a1'] }] },
  });
  const modalityIdentities = ['Bike', 'RowErg', 'SkiErg'].map((modality) =>
    projectConditioningVisibleIdentity(aerobic([row('m1', `3 x 8min aerobic ${modality}`, 3, 120)]))!,
  );
  const aerobicSameDose = aerobic([row('s1', '5 x 2min aerobic Bike', 5, 60)]);
  const tempoSameDose = aerobic([row('s1', '5 x 2min aerobic Bike', 5, 60)], {
    conditioningCategory: 'tempo', conditioningFlavour: 'tempo',
    conditioningBlock: { intent: 'tempo', options: [{ title: 'same', description: '', exerciseIds: ['s1'] }] },
  });
  const hydrated = JSON.parse(JSON.stringify(long)) as Workout;
  const repeated = Object.values(buildRepeatWeekOverlay({
    sourceWorkouts: [long], targetWeekStart: '2026-08-10',
  }).workoutsByDate).find(Boolean) as Workout;

  return {
    canonicalLongTitle: weeklyPlanTitle(long),
    continuousTitle: weeklyPlanTitle(continuous),
    continuousFamily: projectConditioningVisibleIdentity(continuous)!.structureFamily,
    longFamily: projectConditioningVisibleIdentity(long)!.structureFamily,
    tempoTitle: weeklyPlanTitle(tempo),
    warmupGuardFamily: projectConditioningVisibleIdentity(warmupGuard)!.structureFamily,
    attachedPrimary: weeklyPlanTitle(attached),
    attachedContext: weeklyPlanContextLabel(attached),
    standalonePrimary: weeklyPlanTitle(continuous),
    modalityFamilies: modalityIdentities.map((value) => value.structureFamily),
    modalityDoses: modalityIdentities.map((value) => value.doseLabel),
    aerobicSameDoseTitle: weeklyPlanTitle(aerobicSameDose),
    tempoSameDoseTitle: weeklyPlanTitle(tempoSameDose),
    mainDose: projectConditioningVisibleIdentity(warmupGuard)!.doseLabel,
    weeklyTitle: weeklyPlanTitle(long),
    detailTitle: deriveVisibleWorkoutIdentity(long).title,
    hydratedTitle: weeklyPlanTitle(hydrated),
    repeatedTitle: weeklyPlanTitle(repeated),
  };
}
