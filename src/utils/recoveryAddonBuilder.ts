import type {
  DayOfWeek,
  OnboardingData,
  RecoveryAddonBlock,
  RecoveryAddonExercise,
  RecoveryAddonKind,
  SeasonPhase,
  WeekKind,
  Workout,
} from '../types/domain';
import {
  recommendRecoveryAddonCoverage,
  type RecoveryAddonActiveInjury,
  type RecoveryAddonCoverageMode,
  type RecoveryAddonCoverageRecommendation,
  type RecoveryAddonFocusArea,
  type RecoveryAddonReadinessTier,
} from '../rules/recoveryAddonCoverage';
import {
  MOBILITY_FLOW_TEMPLATES,
  type MobilityFlowMovement,
  type MobilityFlowTemplate,
} from '../data/mobilityFlowTemplates';
import type { GenerationConstraintContext } from './generationConstraints';

const ZERO_CREDIT = {
  hardExposure: false,
  mainStrength: false,
  conditioningCredit: 'none',
  createsHardDay: false,
  sprintCodExposure: false,
} as const;

const DAY_INDEX_TO_NAME: Record<number, DayOfWeek> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

const DAY_NAME_TO_INDEX: Record<DayOfWeek, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const FOCUS_ORDER: Record<RecoveryAddonCoverageMode, RecoveryAddonFocusArea[]> = {
  broad_support: [
    'trunk_core',
    'adductors_groin',
    'calves_tib_ankles',
    'mobility_reset',
    'hamstring_light_prehab',
    'carries',
    'shoulder_scap',
  ],
  moderate_support: [
    'trunk_core',
    'adductors_groin',
    'calves_tib_ankles',
    'mobility_reset',
    'shoulder_scap',
    'hamstring_light_prehab',
    'carries',
  ],
  minimum_effective: [
    'trunk_core',
    'adductors_groin',
    'calves_tib_ankles',
    'mobility_reset',
    'shoulder_scap',
    'hamstring_light_prehab',
    'carries',
  ],
  deload_recovery: [
    'mobility_reset',
    'trunk_core',
    'shoulder_scap',
    'calves_tib_ankles',
    'adductors_groin',
    'hamstring_light_prehab',
    'carries',
  ],
  minimum_viable: [
    'trunk_core',
    'mobility_reset',
    'adductors_groin',
    'calves_tib_ankles',
    'shoulder_scap',
    'hamstring_light_prehab',
    'carries',
  ],
  readiness_recovery: [
    'mobility_reset',
    'trunk_core',
    'shoulder_scap',
    'calves_tib_ankles',
    'adductors_groin',
    'hamstring_light_prehab',
    'carries',
  ],
};

interface AttachRecoveryAddonsArgs {
  workouts: Workout[];
  profile: OnboardingData;
  weekKind?: WeekKind;
  generationConstraints?: GenerationConstraintContext;
}

interface Candidate {
  workout: Workout;
  index: number;
  score: number;
  daysUntilGame: number | null;
}

export function attachRecoveryAddonsToWeek(args: AttachRecoveryAddonsArgs): Workout[] {
  if (args.workouts.length === 0) return args.workouts;

  const phase = args.profile.seasonPhase ?? 'Pre-season';
  const gameDay = gameDayForWeek(args.workouts, args.profile);
  const plan = recommendRecoveryAddonCoverage({
    phase,
    weekKind: args.weekKind,
    gameDay,
    availabilityDaysPerWeek: availabilityDays(args.profile),
    availableTrainingDays: args.profile.preferredTrainingDays,
    readinessTier: readinessTierFor(args.generationConstraints),
    activeInjuries: activeInjuriesFor(args.generationConstraints),
  });
  const targetCount = Math.min(
    plan.totalTarget.max,
    targetCountFor(plan.mode),
    args.workouts.filter((workout) => workout.workoutType !== 'Game').length,
  );

  if (targetCount <= 0) return stripEmptyRecoveryAddons(args.workouts);

  const sortedRecommendations = [...plan.recommendations]
    .filter((recommendation) => recommendation.status !== 'avoid' && recommendation.target.max > 0)
    .sort((a, b) => focusRank(plan.mode, a.focusArea) - focusRank(plan.mode, b.focusArea));

  const next = stripEmptyRecoveryAddons(args.workouts);
  const assignedByWorkout = new Map<string, number>();
  let attached = 0;

  for (const recommendation of sortedRecommendations) {
    if (attached >= targetCount) break;

    const candidate = bestPlacement({
      workouts: next,
      recommendation,
      phase,
      weekKind: args.weekKind ?? 'build',
      gameDay,
      assignedByWorkout,
    });
    if (!candidate) continue;

    const addon = buildRecoveryAddon({
      recommendation,
      phase,
      weekKind: args.weekKind ?? 'build',
      daysUntilGame: candidate.daysUntilGame,
      slotIndex: assignedByWorkout.get(candidate.workout.id) ?? 0,
    });
    if (!addon) continue;

    next[candidate.index] = {
      ...candidate.workout,
      recoveryAddons: [
        ...(candidate.workout.recoveryAddons ?? []),
        addon,
      ],
    };
    assignedByWorkout.set(
      candidate.workout.id,
      (assignedByWorkout.get(candidate.workout.id) ?? 0) + 1,
    );
    attached++;
  }

  return next;
}

function stripEmptyRecoveryAddons(workouts: Workout[]): Workout[] {
  return workouts.map((workout) => {
    if (!workout.recoveryAddons?.length) return workout;
    return {
      ...workout,
      recoveryAddons: workout.recoveryAddons.filter((addon) => addon.exercises.length > 0),
    };
  });
}

function gameDayForWeek(workouts: Workout[], profile: OnboardingData): DayOfWeek | null {
  const explicitGame = workouts.find((workout) => workout.workoutType === 'Game');
  if (explicitGame) return DAY_INDEX_TO_NAME[explicitGame.dayOfWeek] ?? null;
  if (profile.usualGameDay) return profile.usualGameDay;
  if (profile.gameDay && profile.gameDay !== 'Varies') return profile.gameDay;
  return null;
}

function availabilityDays(profile: OnboardingData): number | undefined {
  if (profile.preferredTrainingDays?.length) return profile.preferredTrainingDays.length;
  return profile.trainingDaysPerWeek;
}

function readinessTierFor(
  generationConstraints: GenerationConstraintContext | undefined,
): RecoveryAddonReadinessTier | undefined {
  return generationConstraints?.readiness?.tier;
}

function activeInjuriesFor(
  generationConstraints: GenerationConstraintContext | undefined,
): RecoveryAddonActiveInjury[] {
  return (generationConstraints?.injuries ?? []).map((injury) => ({
    bodyPart: injury.bodyPart,
    severity: injury.severity,
    severityBand: injury.severityBand,
    injuryKeys: injury.injuryKeys,
    triggers: injury.triggers,
  }));
}

function targetCountFor(mode: RecoveryAddonCoverageMode): number {
  switch (mode) {
    case 'broad_support': return 4;
    case 'moderate_support': return 3;
    case 'minimum_effective': return 3;
    case 'deload_recovery': return 2;
    case 'minimum_viable': return 2;
    case 'readiness_recovery': return 2;
    default: return 2;
  }
}

function focusRank(mode: RecoveryAddonCoverageMode, focusArea: RecoveryAddonFocusArea): number {
  const rank = FOCUS_ORDER[mode].indexOf(focusArea);
  return rank === -1 ? 99 : rank;
}

function bestPlacement(args: {
  workouts: Workout[];
  recommendation: RecoveryAddonCoverageRecommendation;
  phase: SeasonPhase;
  weekKind: WeekKind;
  gameDay: DayOfWeek | null;
  assignedByWorkout: Map<string, number>;
}): Candidate | null {
  const candidates = args.workouts
    .map((workout, index) => {
      const daysUntilGame = daysToGame(workout.dayOfWeek, args.gameDay);
      const score = placementScore({
        workout,
        recommendation: args.recommendation,
        phase: args.phase,
        weekKind: args.weekKind,
        daysUntilGame,
        assignedCount: args.assignedByWorkout.get(workout.id) ?? 0,
      });
      return { workout, index, score, daysUntilGame };
    })
    .filter((candidate) => candidate.score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
}

function placementScore(args: {
  workout: Workout;
  recommendation: RecoveryAddonCoverageRecommendation;
  phase: SeasonPhase;
  weekKind: WeekKind;
  daysUntilGame: number | null;
  assignedCount: number;
}): number {
  const { workout, recommendation, phase, weekKind, daysUntilGame, assignedCount } = args;
  if (workout.workoutType === 'Game') return Number.NEGATIVE_INFINITY;
  if (daysUntilGame === 1 && !recommendation.placement.gMinusOneAllowed) {
    return Number.NEGATIVE_INFINITY;
  }
  if (weekKind === 'deload' && recommendation.focusArea === 'carries') {
    return Number.NEGATIVE_INFINITY;
  }
  if (recommendation.focusArea === 'carries') {
    if (recommendation.status !== 'recommended') return Number.NEGATIVE_INFINITY;
    if (daysUntilGame !== null && daysUntilGame <= 2) return Number.NEGATIVE_INFINITY;
    if (isLowerSession(workout) || isRecoverySession(workout)) return Number.NEGATIVE_INFINITY;
  }
  if (daysUntilGame === 1 && phase === 'In-season' && recommendation.focusArea !== 'mobility_reset') {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 20;
  if (isRecoverySession(workout)) score += recommendation.focusArea === 'mobility_reset' ? 35 : 15;
  if (isUpperSession(workout)) {
    if (recommendation.focusArea === 'shoulder_scap') score += 24;
    if (recommendation.focusArea === 'carries') score += 20;
    if (recommendation.focusArea === 'trunk_core') score += 12;
  }
  if (isLowerSession(workout)) {
    if (recommendation.focusArea === 'adductors_groin') score += 22;
    if (recommendation.focusArea === 'calves_tib_ankles') score += 20;
    if (recommendation.focusArea === 'hamstring_light_prehab') score += 18;
    if (recommendation.focusArea === 'trunk_core') score += 8;
  }
  if (isTeamTrainingSession(workout)) score -= phase === 'Off-season' ? 8 : 18;
  if (workout.hasCombinedConditioning || workout.conditioningBlock) score -= 10;
  if (workout.sessionTier === 'optional') score += 8;
  if (daysUntilGame !== null) {
    if (daysUntilGame >= 4) score += 8;
    if (daysUntilGame === 2) score -= 12;
    if (daysUntilGame === 1) score += recommendation.focusArea === 'mobility_reset' ? 12 : -30;
  }
  if (weekKind === 'deload') {
    score += recommendation.focusArea === 'mobility_reset' ? 20 : 0;
    score += recommendation.focusArea === 'trunk_core' ? 12 : 0;
  }
  if (recommendation.status === 'caution') score -= 4;
  if (recommendation.status === 'reduced') score -= 8;
  score -= assignedCount * 35;
  return score;
}

function daysToGame(dayOfWeek: number, gameDay: DayOfWeek | null): number | null {
  if (!gameDay) return null;
  const gameIndex = DAY_NAME_TO_INDEX[gameDay];
  const diff = (gameIndex - dayOfWeek + 7) % 7;
  return diff;
}

function isRecoverySession(workout: Workout): boolean {
  return workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery';
}

function isTeamTrainingSession(workout: Workout): boolean {
  return workout.workoutType === 'Team Training' || /team training/i.test(workout.name);
}

function isUpperSession(workout: Workout): boolean {
  const text = sessionText(workout);
  return /\b(upper|push|pull|bench|row|arms|shoulder|scap)\b/i.test(text);
}

function isLowerSession(workout: Workout): boolean {
  const text = sessionText(workout);
  return /\b(lower|squat|hinge|leg|hamstring|adductor|groin|calf|ankle)\b/i.test(text);
}

function sessionText(workout: Workout): string {
  return [
    workout.name,
    workout.description,
    workout.workoutType,
    ...workout.exercises.map((exercise) => exercise.exercise?.name ?? exercise.notes ?? ''),
  ].join(' ');
}

function buildRecoveryAddon(args: {
  recommendation: RecoveryAddonCoverageRecommendation;
  phase: SeasonPhase;
  weekKind: WeekKind;
  daysUntilGame: number | null;
  slotIndex: number;
}): RecoveryAddonBlock | null {
  const { recommendation, phase, weekKind, daysUntilGame, slotIndex } = args;
  const isGMinusOne = daysUntilGame === 1;
  const exercises = exercisesFor(recommendation, phase, weekKind, isGMinusOne);
  if (exercises.length === 0) return null;

  const templateId = templateIdFor(recommendation, phase, weekKind, isGMinusOne);
  const durationMinutes = durationFor(recommendation, exercises, templateId);
  return {
    id: `recovery-addon-${recommendation.focusArea}-${slotIndex}`,
    title: 'Optional Recovery Add-on',
    label: recommendation.label,
    kind: kindForFocus(recommendation.focusArea),
    focusArea: recommendation.focusArea,
    optional: true,
    skipPolicy: 'no_penalty',
    durationMinutes,
    exercises,
    placementNote: isGMinusOne
      ? 'Very light only before game day. Skip it if it adds fatigue.'
      : 'Low-fatigue support work. Useful, optional, and safe to skip.',
    restrictions: recommendation.restrictions,
    cautions: recommendation.cautions.map((caution) => caution.action),
    ...(templateId ? { templateId } : {}),
    counting: ZERO_CREDIT,
  };
}

function kindForFocus(focusArea: RecoveryAddonFocusArea): RecoveryAddonKind {
  if (focusArea === 'mobility_reset') return 'mobility';
  if (focusArea === 'trunk_core') return 'trunk';
  if (focusArea === 'carries') return 'carries';
  return 'prehab';
}

function durationFor(
  recommendation: RecoveryAddonCoverageRecommendation,
  exercises: RecoveryAddonExercise[],
  templateId: string | undefined,
): number {
  const template = templateId
    ? MOBILITY_FLOW_TEMPLATES.find((item) => item.id === templateId)
    : null;
  if (template) return template.durationMinutes;
  if (recommendation.focusArea === 'carries') return 8;
  return Math.min(12, Math.max(6, exercises.length * 3));
}

function exercisesFor(
  recommendation: RecoveryAddonCoverageRecommendation,
  phase: SeasonPhase,
  weekKind: WeekKind,
  isGMinusOne: boolean,
): RecoveryAddonExercise[] {
  if (recommendation.focusArea === 'mobility_reset') {
    return mobilityExercises(recommendation, phase, weekKind, isGMinusOne);
  }

  switch (recommendation.focusArea) {
    case 'trunk_core':
      return [
        exercise('Side Plank', '2 x 30-45s/side', 'Easy bracing, leave 2-3 reps in reserve.'),
        exercise('Bird Dog', '2 x 6-8/side', 'Slow controlled reps; keep hips quiet.'),
        exercise('McGill Curl-Up', '2 x 5-6/side', 'Low effort, no grinding.'),
      ];
    case 'adductors_groin':
      if (recommendation.status !== 'recommended' || isGMinusOne || weekKind === 'deload') {
        return [
          exercise('Groin Squeeze', '2 x 20-30s', 'Gentle squeeze only; no pain chase.'),
        ];
      }
      return [
        exercise('Groin Squeeze', '2 x 20-30s', 'Smooth ramp up and down.'),
        exercise('Short-Lever Copenhagen', '2 x 15-25s/side', 'Controlled, short lever, stop well before strain.'),
      ];
    case 'calves_tib_ankles':
      if (recommendation.status !== 'recommended' || isGMinusOne || weekKind === 'deload') {
        return [
          exercise('Tibialis Raise', '2 x 10-12', 'Easy pace; stop if shin/calf/Achilles symptoms flare.'),
        ];
      }
      return [
        exercise('Tibialis Raise', '2 x 12-15', 'Controlled reps.'),
        exercise('Seated Calf Raise', '2 x 10-15', 'Quiet tempo, no bouncing.'),
      ];
    case 'hamstring_light_prehab':
      if (recommendation.status !== 'recommended' || isGMinusOne || phase === 'In-season' || weekKind === 'deload') {
        return [
          exercise('Glute Bridge', '2 x 8-10', 'Easy squeeze; no cramping or hamstring tug.'),
        ];
      }
      return [
        exercise('Glute Bridge', '2 x 8-10', 'Easy activation before hamstring loading.'),
        exercise('Nordic Lower', '2 x 3-4', 'Low-rep only; stop before soreness becomes the point.'),
      ];
    case 'shoulder_scap':
      if (recommendation.status !== 'recommended' || weekKind === 'deload') {
        return [
          exercise('Banded External Rotation', '2 x 8-12/side', 'Pain-free range only.'),
        ];
      }
      return [
        exercise('Face Pull', '2 x 12-15', 'Light, clean shoulder blades.'),
        exercise('Banded External Rotation', '2 x 8-12/side', 'Pain-free range only.'),
      ];
    case 'carries':
      if (recommendation.status !== 'recommended' || isGMinusOne || weekKind === 'deload') return [];
      return [
        exercise('Suitcase Carry', '2-3 x 20-40m/side', 'Tall posture, light-moderate load, no grind.'),
      ];
    default:
      return [];
  }
}

function mobilityExercises(
  recommendation: RecoveryAddonCoverageRecommendation,
  phase: SeasonPhase,
  weekKind: WeekKind,
  isGMinusOne: boolean,
): RecoveryAddonExercise[] {
  const templateId = templateIdFor(recommendation, phase, weekKind, isGMinusOne);
  const template = templateId
    ? MOBILITY_FLOW_TEMPLATES.find((item) => item.id === templateId)
    : null;
  return movementsFromTemplate(template).map((movement) => ({
    id: `recovery-addon-mobility-${slug(movement.name)}`,
    name: movement.name,
    prescription: formatMovementPrescription(movement),
    ...(movement.notes ? { notes: movement.notes } : {}),
    source: 'mobility_flow_template',
  }));
}

function templateIdFor(
  recommendation: RecoveryAddonCoverageRecommendation,
  phase: SeasonPhase,
  weekKind: WeekKind,
  isGMinusOne: boolean,
): string | undefined {
  if (isGMinusOne) return 'game-week-light-mobility';
  if (weekKind === 'deload') return 'post-training-downshift';
  if (phase === 'In-season' && recommendation.templateIds.includes('game-week-light-mobility')) {
    return 'game-week-light-mobility';
  }
  return recommendation.templateIds[0];
}

function movementsFromTemplate(template: MobilityFlowTemplate | null | undefined): MobilityFlowMovement[] {
  return (template?.movements ?? []).slice(0, 4);
}

function formatMovementPrescription(movement: MobilityFlowMovement): string {
  const sets = movement.sets ?? 1;
  const side = movement.perSide ? '/side' : '';
  if (movement.prescriptionType === 'duration') {
    const min = movement.durationSecondsMin ?? 30;
    const max = movement.durationSecondsMax ?? min;
    return `${sets} x ${range(min, max)}s${side}`;
  }
  const min = movement.repsMin ?? 6;
  const max = movement.repsMax ?? min;
  const unit = movement.prescriptionType === 'breathing_reps' ? 'breaths' : 'reps';
  return `${sets} x ${range(min, max)} ${unit}${side}`;
}

function exercise(name: string, prescription: string, notes?: string): RecoveryAddonExercise {
  return {
    id: `recovery-addon-${slug(name)}`,
    name,
    prescription,
    ...(notes ? { notes } : {}),
    source: 'exercise_pool',
  };
}

function range(min: number, max: number): string {
  return min === max ? String(min) : `${min}-${max}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
