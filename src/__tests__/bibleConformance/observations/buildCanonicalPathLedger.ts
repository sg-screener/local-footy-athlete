import type { Microcycle, OnboardingData, PowerBlock, TrainingProgram, Workout, WorkoutExercise } from '../../../types/domain';
import { getSessionComponentRows, getSessionComponents } from '../../../utils/sessionComponents';
import { deriveVisibleWorkoutIdentity } from '../../../utils/visibleWorkoutIdentity';
import { inferModalityFromName } from '../../../utils/coachModalitySwap';
import { alignPowerBlockToFinalWorkoutContent } from '../../../rules/powerBlockContentAlignment';
import { classifyVisibleSession } from '../../../rules/sessionClassificationAdapter';
import { countWeeklyExposures } from '../../../rules/weeklyExposureCounts';
import { buildWeekLog } from '../../../utils/weekLogBuilder';
import { buildSingleWorkoutFixtureTrace } from './buildStrengthTrace';
import type {
  ComponentGoldenScenario,
  HarnessCanonicalWeekLedger,
  HarnessCanonicalWorkoutLedger,
  HarnessConditioningEntry,
  HarnessExposureLedger,
  HarnessPowerIntent,
  HarnessSessionComponent,
  StrengthPattern,
} from '../types';

const NOW = '2026-03-23T00:00:00.000Z';
const PATTERNS: StrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];
const COMPONENTS: HarnessSessionComponent[] = ['strength', 'conditioning', 'team_training', 'power', 'trunk_support', 'recovery'];

export function pathExercise(
  workoutId: string,
  index: number,
  name: string,
  options: { sets?: number; reps?: number; weight?: number; equipment?: string[] } = {},
): WorkoutExercise {
  const id = `${workoutId}:row:${index}`;
  return {
    id, workoutId, exerciseId: id, exerciseOrder: index,
    prescribedSets: options.sets ?? 3,
    prescribedRepsMin: options.reps ?? 6,
    prescribedRepsMax: options.reps ?? 6,
    prescribedWeightKg: options.weight,
    restSeconds: 120,
    exercise: {
      id, name, description: name, muscleGroups: [], exerciseType: 'Compound',
      equipmentRequired: options.equipment ?? [], difficultyLevel: 'Intermediate',
      createdAt: NOW, updatedAt: NOW,
    },
    createdAt: NOW, updatedAt: NOW,
  };
}

export function pathPowerBlock(kind: 'primer' | 'contrast' = 'contrast'): PowerBlock {
  return {
    id: `path-power-${kind}`, kind, family: 'lower',
    title: kind === 'contrast' ? 'Contrast Power' : 'Power Primer',
    prescription: '3 x 3', placement: 'pre_lift',
    options: [{ name: 'Vertical Jump', sets: 3, repsMin: 3, repsMax: 3, equipmentRequired: [] }],
    notes: kind === 'contrast' ? ['Contrast: pair with the heavy lift.'] : ['Stay sharp.'],
    counting: { hardExposure: false, mainStrength: false, conditioningCredit: 'none', isFinisher: false },
  };
}

export function pathWorkout(args: {
  id: string;
  dayOfWeek: number;
  name: string;
  patterns?: StrengthPattern[];
  primary?: StrengthPattern | null;
  workoutType?: Workout['workoutType'];
  sessionTier?: Workout['sessionTier'];
  exercises?: WorkoutExercise[];
  conditioning?: Array<{ title: string; modality: 'bike' | 'row' | 'ski' | 'running'; intent?: 'aerobic' | 'tempo' | 'high-intensity' }>;
  powerBlock?: PowerBlock;
  team?: boolean;
  recoveryAddon?: string;
}): Workout {
  const patterns = args.patterns ?? [];
  const lower = patterns.some((value) => value === 'squat' || value === 'hinge');
  const upper = patterns.some((value) => value === 'push' || value === 'pull');
  const conditioningRows = (args.conditioning ?? []).map((entry, index) =>
    pathExercise(args.id, (args.exercises?.length ?? 0) + index, entry.title));
  const allRows = [...(args.exercises ?? []), ...conditioningRows];
  return {
    id: args.id, microcycleId: 'slice4:mc', dayOfWeek: args.dayOfWeek,
    name: args.name, description: args.name, durationMinutes: 60,
    intensity: args.team ? 'High' : 'Moderate',
    workoutType: args.workoutType ?? (patterns.length && args.conditioning?.length ? 'Mixed' : patterns.length ? 'Strength' : 'Conditioning'),
    sessionTier: args.sessionTier ?? 'core', planEntryId: `slice4:${args.id}`,
    strengthIntent: patterns.length ? {
      archetype: lower && upper ? 'full_body' : lower ? 'lower' : 'upper',
      primaryPattern: args.primary ?? patterns[0] ?? null,
      plannedPatterns: patterns,
      effectivePatterns: patterns,
    } : undefined,
    strengthPatternContributions: patterns,
    exercises: allRows,
    conditioningCategory: args.conditioning?.some((entry) => entry.intent === 'tempo') ? 'tempo' : args.conditioning?.length ? 'aerobic_base' : undefined,
    conditioningFlavour: args.conditioning?.some((entry) => entry.intent === 'tempo') ? 'tempo' : args.conditioning?.length ? 'aerobic' : undefined,
    hasCombinedConditioning: !!patterns.length && !!args.conditioning?.length,
    attachedConditioningKind: patterns.length && args.conditioning?.length ? 'component' : undefined,
    conditioningBlock: args.conditioning?.length ? {
      intent: args.conditioning[0].intent ?? 'aerobic',
      attachedKind: patterns.length ? 'component' : undefined,
      options: args.conditioning.map((entry, index) => ({
        title: entry.title, description: entry.title,
        exerciseIds: [conditioningRows[index].id],
        ...({ modality: entry.modality } as any),
      })),
    } : undefined,
    powerBlock: args.powerBlock,
    recoveryAddons: args.recoveryAddon ? [{
      id: `${args.id}:recovery`, title: 'Recovery Add-on', label: 'Recovery Add-on',
      kind: 'prehab', focusArea: 'general', optional: true, skipPolicy: 'no_penalty',
      durationMinutes: 8,
      exercises: [{ id: `${args.id}:recovery:row`, name: args.recoveryAddon, prescription: '2 rounds easy' }],
      counting: {
        hardExposure: false, mainStrength: false, conditioningCredit: 'none',
        createsHardDay: false, sprintCodExposure: false,
      },
    }] : undefined,
    ...({ isTeamDay: args.team } as any),
    createdAt: NOW, updatedAt: NOW,
  };
}

function canonicalStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function canonicalPatterns(values: readonly string[] | undefined): StrengthPattern[] {
  const set = new Set(values ?? []);
  return PATTERNS.filter((pattern) => set.has(pattern));
}

function components(workout: Workout): HarnessSessionComponent[] {
  const set = new Set<HarnessSessionComponent>();
  for (const component of getSessionComponents(workout)) {
    if (component.kind === 'strength') set.add('strength');
    else if (component.kind === 'conditioning' || component.kind === 'finisher') set.add('conditioning');
    else if (component.kind === 'team_training') set.add('team_training');
    else if (component.kind === 'power') set.add('power');
    else if (component.kind === 'support') set.add('trunk_support');
    else if (component.kind === 'recovery' || component.kind === 'recovery_addon') set.add('recovery');
  }
  return COMPONENTS.filter((component) => set.has(component));
}

function conditioning(workout: Workout): HarnessConditioningEntry[] {
  return (workout.conditioningBlock?.options ?? []).map((option) => {
    const explicit = (option as typeof option & { modality?: string }).modality;
    const inferred = inferModalityFromName(`${option.title} ${option.description}`);
    const modality: HarnessConditioningEntry['modality'] = explicit === 'running' || inferred === 'run'
      ? 'running' : explicit === 'bike' || explicit === 'row' || explicit === 'ski'
        ? explicit : inferred === 'bike' || inferred === 'row' || inferred === 'ski' ? inferred : 'other';
    const category = workout.conditioningCategory;
    return {
      modality,
      intent: category === 'tempo' ? 'tempo' : category === 'sprint' ? 'speed' : 'aerobic_base',
      intensity: category === 'tempo' ? 'moderate' : category === 'aerobic_base' ? 'easy' : 'hard',
      minutes: Number(`${option.title} ${option.description}`.match(/(\d+)\s*min/i)?.[1] ?? 0) || undefined,
      offFeet: modality !== 'running',
    };
  }).sort((a, b) => `${a.modality}:${a.intent}`.localeCompare(`${b.modality}:${b.intent}`));
}

function power(workout: Workout): HarnessPowerIntent {
  if (!workout.powerBlock) return { kind: 'none' };
  if (workout.powerBlock.kind === 'primer') return { kind: 'primer', explosiveFamily: workout.powerBlock.family };
  const aligned = alignPowerBlockToFinalWorkoutContent(workout);
  return {
    kind: 'contrast', explosiveFamily: workout.powerBlock.family,
    heavyLiftFamily: workout.powerBlock.family,
    heavyLiftPresent: aligned.action === 'unchanged' && aligned.workout.powerBlock?.kind === 'contrast',
  };
}

function projectionComponents(workout: Workout): { week: HarnessSessionComponent[]; detail: HarnessSessionComponent[] } {
  const scenario = {
    id: 'strength-plus-trunk-support', description: 'Slice 4 projection observer',
    referenceDate: '2026-03-23', timezone: 'Australia/Melbourne', profile: {},
    ruleIds: ['ALL-COMP-PROJECTION-01'], target: { weekInBlock: 1, day: 'Monday' },
    sourceKind: 'direct_accessory_fixture',
  } as ComponentGoldenScenario;
  const allocation = {
    dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][workout.dayOfWeek],
    tier: workout.sessionTier ?? 'core', focus: workout.name,
    planEntryId: workout.planEntryId, strengthIntent: workout.strengthIntent,
  } as any;
  const trace = buildSingleWorkoutFixtureTrace({ scenario, allocation, workout });
  return {
    week: trace.sessions.visible_week[0]?.components ?? [],
    detail: trace.sessions.visible_detail[0]?.components ?? [],
  };
}

export function canonicalWorkoutLedger(workout: Workout): HarnessCanonicalWorkoutLedger {
  const rows = getSessionComponentRows(workout);
  const identity = deriveVisibleWorkoutIdentity(workout);
  return {
    planEntryId: workout.planEntryId ?? '', dayOfWeek: workout.dayOfWeek,
    archetype: workout.strengthIntent?.archetype ?? null,
    primaryPattern: workout.strengthIntent?.primaryPattern ?? null,
    plannedPatterns: canonicalPatterns(workout.strengthIntent?.plannedPatterns),
    effectivePatterns: canonicalPatterns(workout.strengthIntent?.effectivePatterns),
    components: components(workout),
    strengthRows: canonicalStrings(rows.strengthRows.map((row) => row.exercise?.name ?? row.exerciseId)),
    conditioning: conditioning(workout), power: power(workout),
    supportRows: canonicalStrings(rows.supportRows.map((row) => row.exercise?.name ?? row.exerciseId)),
    recoveryAddons: canonicalStrings((workout.recoveryAddons ?? []).map((addon: any) => addon.name ?? addon.title ?? addon.id)),
    sessionTier: workout.sessionTier ?? null, workoutType: workout.workoutType ?? null,
    visibleTitle: identity.title, visibleSubtitle: String(identity.subtitle ?? ''),
    conditioningHeadline: workout.conditioningBlock?.options[0]?.title ?? null,
  };
}

function exposure(workouts: Workout[]): HarnessExposureLedger {
  const dated = workouts.map((workout) => ({
    date: `2026-03-${String(22 + (workout.dayOfWeek || 7)).padStart(2, '0')}`,
    workout,
  }));
  const counts = countWeeklyExposures(dated);
  const resolved = dated.map(({ date, workout }) => ({
    date, dayOfWeek: workout.dayOfWeek, short: '', isToday: false, workout,
    source: 'template', indicator: workout.sessionTier ?? 'core',
  })) as any;
  const log = buildWeekLog(resolved, {}, 'high');
  let squatStrength = 0; let hingeStrength = 0; let upperPushStrength = 0; let upperPullStrength = 0;
  let upperStrengthFatigue = 0; let lowerStrengthFatigue = 0; let hardConditioning = 0; let powerCount = 0;
  for (const workout of workouts) {
    const patterns = canonicalPatterns(workout.strengthIntent?.effectivePatterns);
    if (patterns.includes('squat')) squatStrength++;
    if (patterns.includes('hinge')) hingeStrength++;
    if (patterns.includes('push')) upperPushStrength++;
    if (patterns.includes('pull')) upperPullStrength++;
    const classified = classifyVisibleSession(workout);
    if (classified.contributions.mainStrength > 0) {
      if (classified.strengthRegion === 'upper' || classified.strengthRegion === 'full_body') upperStrengthFatigue++;
      if (classified.strengthRegion === 'lower' || classified.strengthRegion === 'full_body') lowerStrengthFatigue++;
    }
    hardConditioning += classified.units.filter((unit) => unit.conditioningRole === 'hard' && unit.contributions.conditioning > 0).length;
    if (workout.powerBlock) powerCount++;
  }
  return {
    squatStrength, hingeStrength, upperPushStrength, upperPullStrength,
    conditioning: counts.conditioningExposures, hardConditioning,
    sprintCod: counts.sprintCodExposures, power: powerCount,
    upperStrengthFatigue, lowerStrengthFatigue,
    teamTrainingAnchors: counts.teamTrainingSessions, gameAnchors: counts.games,
    recovery: counts.recoverySessions, hardDays: counts.hardDays,
    mainStrength: log.strengthSessions.length, running: counts.runningExposures,
  };
}

export function canonicalWeekLedger(workouts: Workout[]): HarnessCanonicalWeekLedger {
  const projections = workouts.map(projectionComponents);
  return {
    workouts: workouts.map(canonicalWorkoutLedger).sort((a, b) =>
      `${a.planEntryId}:${a.dayOfWeek}`.localeCompare(`${b.planEntryId}:${b.dayOfWeek}`)),
    exposure: exposure(workouts),
    visibleWeekComponents: COMPONENTS.filter((component) => projections.some((entry) => entry.week.includes(component))),
    visibleDetailComponents: COMPONENTS.filter((component) => projections.some((entry) => entry.detail.includes(component))),
  };
}

export function pathMicrocycle(workouts: Workout[], weekNumber = 1): Microcycle {
  return {
    id: `slice4:mc:${weekNumber}`, programId: 'slice4:program', weekNumber,
    startDate: `2026-0${weekNumber === 1 ? '3-23' : '4-20'}`, endDate: `2026-0${weekNumber === 1 ? '3-29' : '4-26'}`,
    miniCycleNumber: ((weekNumber - 1) % 4) + 1, intensityMultiplier: 1,
    workouts, createdAt: NOW, updatedAt: NOW,
  };
}

export function pathProgram(workouts: Workout[]): TrainingProgram {
  const microcycle = pathMicrocycle(workouts);
  return {
    id: 'slice4:program', userId: 'slice4', name: 'Slice 4', description: '',
    programPhase: 'In-Season', startDate: '2026-03-23', endDate: '2026-04-19',
    microcycles: [microcycle], primaryFocus: 'Strength', isActive: true,
    createdAt: NOW, updatedAt: NOW,
  };
}

export const PATH_PROFILE: OnboardingData = {
  seasonPhase: 'In-season', trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
  usualGameDay: 'Saturday', trainingLocation: 'Commercial gym', equipment: ['Full Gym'],
  experienceLevel: '2-5 years', conditioningLevel: 'Good', sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent', injuries: [],
} as OnboardingData;
