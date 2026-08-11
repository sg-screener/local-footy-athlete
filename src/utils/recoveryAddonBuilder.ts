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
import { composeMobilityFlow } from '../rules/mobilitySessionComposition';
import type { PoolExercise } from '../data/exercisePools';
import {
  dateHash,
  filterMobilityPoolForAthlete,
  type AthleteContext,
} from './sessionBuilder';
import {
  FULL_GYM_EQUIPMENT,
  resolveEquipmentAvailability,
} from './equipmentAvailability';
import type { GenerationConstraintContext } from './generationConstraints';
import { resolveTrainingAgePolicy } from '../rules/trainingAgePolicy';
import {
  applyRecoveryAddonBias,
  composeProgrammingBias,
  computeTestingBias,
} from '../rules/testingBias';
import { computeProgrammingBias } from '../rules/programmingBias';
import { motivationBiasTokens, resolveMotivation } from '../rules/motivationGoals';
import { attachRecoveryAddonEffectEvidence } from './deterministicCoachNoteFactory';
import { enforceCuratedAddonCueContract } from '../rules/curatedCueContract';
import { storedGameAnchor } from '../rules/gameAnchor';

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

/**
 * Attach the week's add-ons, then hold them to the cue contract.
 *
 * The gate has to live HERE rather than beside the strength one. That gate runs
 * inside `buildWorkoutsFromCoach`, which finishes before this function wraps its
 * output — so add-on rows were structurally invisible to it. Sam's run-7 ruling 3
 * asked for the no-uncurated-text invariant to cover add-on rows, and an
 * invariant enforced at a point the content does not yet exist is not enforced at
 * all.
 *
 * It throws for the same reason the strength contract does (device run 5): a
 * violation logged is a violation shipped. A cueless add-on row can only arise
 * from this file naming something the curated layer has never heard of, which is
 * an authoring mistake to fix, not a runtime condition to tolerate.
 */
export function attachRecoveryAddonsToWeek(args: AttachRecoveryAddonsArgs): Workout[] {
  const attached = buildWeekWithRecoveryAddons(args);
  enforceCuratedAddonCueContract(attached, 'attachRecoveryAddonsToWeek');
  return attached;
}

function buildWeekWithRecoveryAddons(args: AttachRecoveryAddonsArgs): Workout[] {
  if (args.workouts.length === 0) return args.workouts;

  const phase = args.profile.seasonPhase ?? 'Pre-season';
  const gameDay = gameDayForWeek(args.workouts, args.profile);
  const plan = recommendRecoveryAddonCoverage({
    phase,
    weekKind: args.weekKind,
    gameDay,
    availabilityDaysPerWeek: availabilityDays(args.profile),
    availableTrainingDays: args.profile.preferredTrainingDays,
    readinessDeloaded: args.generationConstraints?.readiness?.deloaded === true,
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
  const isBeginner = resolveTrainingAgePolicy(args.profile.experienceLevel).level === 'new';
  const testingBias = computeTestingBias({
    phase,
    conditioningLevel: args.profile.conditioningLevel,
    sprintExposure: args.profile.sprintExposure,
    biggestLimitation: args.profile.biggestLimitation,
    injuries: args.profile.injuries,
    isBeginner,
  });
  const roleGoalBias = computeProgrammingBias({
    role: args.profile.position,
    // The second copy of the split, deleted. Same owner as `coachingEngine` now.
    goals: motivationBiasTokens(resolveMotivation(args.profile)),
    phase,
    isBeginner,
  });
  const programmingBias = composeProgrammingBias(roleGoalBias, testingBias);
  const roleGoalRecommendations = applyRecoveryAddonBias(
    sortedRecommendations,
    roleGoalBias.recoveryAddonFocusPreference,
  );
  const biasedRecommendations = applyRecoveryAddonBias(
    sortedRecommendations,
    programmingBias.recoveryAddonFocusPreference,
  );

  const athlete = athleteContextFor(args.profile);
  const next = attachRecommendationsToWeek({
    workouts: args.workouts,
    recommendations: biasedRecommendations,
    targetCount,
    phase,
    weekKind: args.weekKind ?? 'build',
    gameDay,
    athlete,
  });
  if (Object.keys(testingBias.recoveryAddonFocusPreference).length === 0) return next;

  const baseline = attachRecommendationsToWeek({
    workouts: args.workouts,
    recommendations: roleGoalRecommendations,
    targetCount,
    phase,
    weekKind: args.weekKind ?? 'build',
    gameDay,
    athlete,
  });
  const changedIndex = next.findIndex((workout, index) =>
    recoveryAddonShape(workout) !== recoveryAddonShape(baseline[index]),
  );
  if (changedIndex < 0) return next;
  const focusAreas = (next[changedIndex].recoveryAddons ?? []).map((addon) => addon.focusArea);
  if (focusAreas.length === 0) return next;
  next[changedIndex] = attachRecoveryAddonEffectEvidence({
    workout: next[changedIndex],
    seed: {
      kind: 'testing_bias',
      reason: 'testing_robustness',
      ownerKey: 'testing-profile-recovery-support',
    },
    focusAreas,
  });
  return next;
}

/**
 * Equipment and injuries, so a composed mobility draw filters like every other.
 *
 * The tags come from the SAME resolver generation uses — the athlete's own
 * answer, lifted legacy checklist, or the bodyweight floor. The location
 * inference that used to live here is deleted (Sam's ruling 4, 2026-07-31):
 * a mobility draw must not see equipment the athlete never declared.
 */
function athleteContextFor(profile: OnboardingData): AthleteContext {
  return {
    injuries: profile.injuries ?? [],
    equipmentTags: resolveEquipmentAvailability(profile),
    onboardingData: profile,
  };
}

function attachRecommendationsToWeek(args: {
  workouts: Workout[];
  recommendations: readonly RecoveryAddonCoverageRecommendation[];
  targetCount: number;
  phase: SeasonPhase;
  weekKind: WeekKind;
  gameDay: DayOfWeek | null;
  athlete: AthleteContext;
}): Workout[] {
  const next = stripEmptyRecoveryAddons(args.workouts);
  const assignedByWorkout = new Map<string, number>();
  let attached = 0;

  for (const recommendation of args.recommendations) {
    if (attached >= args.targetCount) break;

    const candidate = bestPlacement({
      workouts: next,
      recommendation,
      phase: args.phase,
      weekKind: args.weekKind,
      gameDay: args.gameDay,
      assignedByWorkout,
    });
    if (!candidate) continue;

    const addon = buildRecoveryAddon({
      recommendation,
      phase: args.phase,
      weekKind: args.weekKind,
      daysUntilGame: candidate.daysUntilGame,
      slotIndex: assignedByWorkout.get(candidate.workout.id) ?? 0,
      athlete: args.athlete,
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

function recoveryAddonShape(workout: Workout | undefined): string {
  return JSON.stringify((workout?.recoveryAddons ?? []).map((addon) => ({
    id: addon.id,
    focusArea: addon.focusArea,
    exerciseIds: addon.exercises.map((exercise) => exercise.id),
  })));
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
  return storedGameAnchor(profile);
}

function availabilityDays(profile: OnboardingData): number | undefined {
  if (profile.preferredTrainingDays?.length) return profile.preferredTrainingDays.length;
  return profile.trainingDaysPerWeek;
}

function readinessTierFor(
  generationConstraints: GenerationConstraintContext | undefined,
): RecoveryAddonReadinessTier | undefined {
  return generationConstraints?.readiness?.deloaded;
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
  athlete: AthleteContext;
}): RecoveryAddonBlock | null {
  const { recommendation, phase, weekKind, daysUntilGame, slotIndex, athlete } = args;
  const isGMinusOne = daysUntilGame === 1;
  const exercises = exercisesFor(recommendation, phase, weekKind, isGMinusOne, {
    athlete,
    seed: dateHash(`${recommendation.focusArea}:${slotIndex}:${daysUntilGame ?? 'no-game'}`),
  });
  if (exercises.length === 0) return null;

  const durationMinutes = durationFor(recommendation, exercises);
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
    counting: ZERO_CREDIT,
  };
}

function kindForFocus(focusArea: RecoveryAddonFocusArea): RecoveryAddonKind {
  if (focusArea === 'mobility_reset') return 'mobility';
  if (focusArea === 'trunk_core') return 'trunk';
  if (focusArea === 'carries') return 'carries';
  return 'prehab';
}

/**
 * How long an add-on takes, from the rows it actually has.
 *
 * The bundle branch is gone: `template.durationMinutes` was a number attached to a
 * grouping Sam does not recognise, and the mobility add-on is now composed, so its
 * length varies with what the pool draw returned. Every add-on is now measured the
 * same way — by its own rows — which is one rule instead of two.
 */
function durationFor(
  recommendation: RecoveryAddonCoverageRecommendation,
  exercises: RecoveryAddonExercise[],
): number {
  if (recommendation.focusArea === 'carries') return 8;
  return Math.min(12, Math.max(6, exercises.length * 3));
}

/** Everything the composed mobility draw needs, and nothing the others do. */
interface AddonCompositionContext {
  athlete: AthleteContext;
  seed: number;
}

function exercisesFor(
  recommendation: RecoveryAddonCoverageRecommendation,
  phase: SeasonPhase,
  weekKind: WeekKind,
  isGMinusOne: boolean,
  composition: AddonCompositionContext,
): RecoveryAddonExercise[] {
  if (recommendation.focusArea === 'mobility_reset') {
    return mobilityExercises(composition);
  }

  switch (recommendation.focusArea) {
    case 'trunk_core':
      return [
        exercise('Side Plank', '2 x 30-45s/side'),
        exercise('Bird Dog', '2 x 6-8/side'),
        exercise('McGill Curl-Up', '2 x 5-6/side'),
      ];
    case 'adductors_groin':
      if (recommendation.status !== 'recommended' || isGMinusOne || weekKind === 'deload') {
        return [
          exercise('Groin Squeeze', '2 x 20-30s'),
        ];
      }
      return [
        exercise('Groin Squeeze', '2 x 20-30s'),
        exercise('Copenhagen Plank (Half)', '2 x 15-25s/side'),
      ];
    case 'calves_tib_ankles':
      if (recommendation.status !== 'recommended' || isGMinusOne || weekKind === 'deload') {
        return [
          exercise('Tib Raises', '2 x 10-12'),
        ];
      }
      return [
        exercise('Tib Raises', '2 x 12-15'),
        exercise('Seated Calf Raise', '2 x 10-15'),
      ];
    case 'hamstring_light_prehab':
      if (recommendation.status !== 'recommended' || isGMinusOne || phase === 'In-season' || weekKind === 'deload') {
        return [
          exercise('Glute Bridge', '2 x 8-10'),
        ];
      }
      return [
        exercise('Glute Bridge', '2 x 8-10'),
        exercise('Nordic Lower', '2 x 3-4'),
      ];
    case 'shoulder_scap':
      if (recommendation.status !== 'recommended' || weekKind === 'deload') {
        return [
          exercise('Banded External Rotation', '2 x 8-12/side'),
        ];
      }
      return [
        exercise('Face Pull', '2 x 12-15'),
        exercise('Banded External Rotation', '2 x 8-12/side'),
      ];
    case 'carries':
      if (recommendation.status !== 'recommended' || isGMinusOne || weekKind === 'deload') return [];
      return [
        exercise('Suitcase Carry', '2-3 x 20-40m/side'),
      ];
    default:
      return [];
  }
}

/**
 * THE MOBILITY ADD-ON, COMPOSED — the last bundle read in the app, retired.
 *
 * It used to select one of ten `MOBILITY_FLOW_TEMPLATES` by phase, week kind and
 * G-1 proximity, then take its first four movements. Sam does not recognise those
 * groupings; the trace in `docs/OPTIONAL_PLACEMENT_LAW_SUPERSESSION_2026-07-30.md`
 * agrees. It now draws from `MOBILITY_POOL` — his twenty movements at his authored
 * doses — one per signed region, which is what the four-movement slice was standing
 * in for.
 *
 * THE PHASE / DELOAD / G-1 SELECTION WENT WITH THE BUNDLES, and losing it costs
 * nothing: what it chose between was ten agent-authored groupings of the same
 * twenty exercises, all of them `fatigue: low` mobility work. WHETHER a mobility
 * add-on is appropriate on a given day is still decided — by `placementScore`,
 * which is where that decision lived all along (G-1 in-season admits mobility and
 * nothing else; deload biases toward it).
 */
function mobilityExercises(
  composition: AddonCompositionContext,
): RecoveryAddonExercise[] {
  const movements = composeMobilityFlow({
    seed: composition.seed,
    eligible: filterMobilityPoolForAthlete(composition.athlete),
  });
  // Name and dose only — the row's display text is the curated cue at render
  // (Sam's run-7 ruling 3), and a pool entry cannot carry its own.
  return movements.map((movement) => ({
    id: `recovery-addon-mobility-${slug(movement.name)}`,
    name: movement.name,
    prescription: formatPoolPrescription(movement),
    source: 'exercise_pool',
  }));
}

/** The pool entry's OWN dose. Nothing here picks sets, reps or seconds. */
function formatPoolPrescription(movement: PoolExercise): string {
  const side = movement.perSide ? '/side' : '';
  const unit = movement.prescriptionType === 'duration' ? 's' : ' reps';
  return `${movement.sets} x ${range(movement.repsMin, movement.repsMax)}${unit}${side}`;
}

/**
 * An add-on row: a curated NAME and a DOSE, and nothing else.
 *
 * This helper used to take a third `notes` argument, and fifteen call sites
 * above supplied one — "Quiet tempo, no bouncing.", "Pain-free range only.",
 * "Easy bracing, leave 2-3 reps in reserve." Those strings rendered on the
 * athlete's session screen having never passed through `EXERCISE_CUES`: a second
 * authoring surface sitting beside Sam's curated one, invisible to every gate
 * that guards the first. Several of them paraphrased the very cue they displaced
 * — the curated `Seated Calf Raise` cue already ends "Slow tempo, no bouncing."
 *
 * Sam retired the class on 2026-07-27 (run-7 ruling 3). The parameter is gone
 * rather than merely unused, because the parameter IS the channel: a name and a
 * dose are structure, which the builder owns, and the words are curation, which
 * it does not. The row's display text now comes from `buildCueText(name)` at
 * render, exactly like every other row in the app.
 */
function exercise(name: string, prescription: string): RecoveryAddonExercise {
  return {
    id: `recovery-addon-${slug(name)}`,
    name,
    prescription,
    source: 'exercise_pool',
  };
}

/**
 * Every exercise name this builder can put in front of an athlete.
 *
 * Enumerated by RUNNING the real selection logic across its whole decision space
 * rather than by listing names, so the no-uncurated-text invariant sweeps what
 * the builder actually emits and cannot drift from it. A second hand-maintained
 * list is precisely the failure mode this repo has already paid for once.
 */
/**
 * The widest athlete: no injuries, every equipment tag.
 *
 * The sweep has to see every movement the builder CAN emit, so it must not filter
 * any out — a narrower context would shrink the vocabulary and let an uncurated
 * name through on the athletes it excluded.
 */
const SWEEP_ATHLETE: AthleteContext = {
  injuries: [],
  // Every tag in the vocabulary — the sweep must see every movement the
  // builder CAN emit, and the retired location rows were narrower than this.
  equipmentTags: [...FULL_GYM_EQUIPMENT],
};

export function recoveryAddonExerciseVocabulary(): string[] {
  const focusAreas: RecoveryAddonFocusArea[] = [
    'trunk_core',
    'adductors_groin',
    'calves_tib_ankles',
    'hamstring_light_prehab',
    'shoulder_scap',
    'mobility_reset',
    'carries',
  ];
  const statuses: Array<RecoveryAddonCoverageRecommendation['status']> = [
    'recommended',
    'caution',
    'reduced',
    'avoid',
  ];
  const phases: SeasonPhase[] = ['Off-season', 'Pre-season', 'In-season'];
  const weekKinds: WeekKind[] = ['build', 'deload'];

  const names = new Set<string>();
  // The composed mobility draw rotates by seed, so the sweep walks seeds as well
  // as the decision space. It used to walk the ten flow bundles for the same
  // reason: whatever the builder can reach, this has to reach.
  const seeds = [0, 1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
  for (const focusArea of focusAreas) {
    for (const status of statuses) {
      for (const phase of phases) {
        for (const weekKind of weekKinds) {
          for (const isGMinusOne of [false, true]) {
            for (const seed of seeds) {
              // Only the fields `exercisesFor` reads.
              const recommendation = { focusArea, status } as RecoveryAddonCoverageRecommendation;
              const rows = exercisesFor(recommendation, phase, weekKind, isGMinusOne, {
                athlete: SWEEP_ATHLETE,
                seed,
              });
              for (const row of rows) names.add(row.name);
            }
          }
        }
      }
    }
  }
  return [...names].sort();
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
