import { performance } from 'node:perf_hooks';
import type { OnboardingData, PowerBlock, Workout, WorkoutExercise } from '../../../types/domain';
import type { ActiveEquipmentConstraint, ActiveInjuryConstraint } from '../../../store/coachUpdatesStore';
import { finaliseWorkoutAfterMutation } from '../../../utils/workoutCanonicalisation';
import { validateWorkoutAgainstActiveConstraints } from '../../../utils/postGenerationConstraintValidation';
import { alignPowerBlockToFinalWorkoutContent } from '../../../rules/powerBlockContentAlignment';
import { decidePowerPrimer, type PowerPrimerContext } from '../../../rules/powerPrimerPolicy';
import { classifyVisibleSession } from '../../../rules/sessionClassificationAdapter';
import { countWeeklyExposures } from '../../../rules/weeklyExposureCounts';
import { buildWeekLog } from '../../../utils/weekLogBuilder';
import { inferModalityFromName } from '../../../utils/coachModalitySwap';
import { deriveVisibleWorkoutIdentity } from '../../../utils/visibleWorkoutIdentity';
import { getSessionComponents } from '../../../utils/sessionComponents';
import { resolveDate, type ResolvedDay, type ScheduleState } from '../../../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../../../utils/sessionBuilder';
import { buildSingleWorkoutFixtureTrace } from './buildStrengthTrace';
import type {
  ComponentGoldenScenario,
  HarnessConditioningEntry,
  HarnessExposureLedger,
  HarnessPowerIntent,
  HarnessSessionComponent,
  HarnessTransformEvidence,
  Slice3GoldenScenario,
  Slice3MutationId,
  Slice3ScenarioTrace,
  Slice3StageObservation,
  Slice3TraceStage,
  StrengthPattern,
} from '../types';

const NOW = '2026-03-23T00:00:00.000Z';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COMPONENT_ORDER: HarnessSessionComponent[] = [
  'strength', 'conditioning', 'team_training', 'power', 'trunk_support', 'recovery',
];
const PATTERN_ORDER: StrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];

function row(
  workoutId: string,
  index: number,
  name: string,
  options: { equipment?: string[]; sets?: number; reps?: number; weight?: number } = {},
): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `${workoutId}:row:${index}`,
    workoutId,
    exerciseId: `${slug}:${index}`,
    exerciseOrder: index,
    prescribedSets: options.sets ?? 3,
    prescribedRepsMin: options.reps ?? 6,
    prescribedRepsMax: options.reps ?? 6,
    prescribedWeightKg: options.weight,
    restSeconds: 120,
    exercise: {
      id: `${slug}:${index}`,
      name,
      description: name,
      muscleGroups: [],
      exerciseType: 'Compound',
      equipmentRequired: options.equipment ?? [],
      difficultyLevel: 'Intermediate',
      createdAt: NOW,
      updatedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function baseWorkout(args: {
  id: string;
  dayOfWeek?: number;
  name: string;
  type?: Workout['workoutType'];
  intensity?: Workout['intensity'];
  patterns?: StrengthPattern[];
  primary?: StrengthPattern | null;
  exercises: WorkoutExercise[];
  conditioning?: {
    intent: 'aerobic' | 'tempo' | 'high-intensity';
    category: Workout['conditioningCategory'];
    ids: string[];
    titles: string[];
    modalities?: Array<'bike' | 'row' | 'ski' | 'running'>;
  };
  powerBlock?: PowerBlock;
  isTeamDay?: boolean;
}): Workout {
  const planned = args.patterns ?? [];
  const archetype = planned.some((pattern) => pattern === 'squat' || pattern === 'hinge') &&
    planned.some((pattern) => pattern === 'push' || pattern === 'pull')
    ? 'full_body'
    : planned.some((pattern) => pattern === 'squat' || pattern === 'hinge')
      ? 'lower'
      : 'upper';
  return {
    id: args.id,
    microcycleId: 'bible:slice3:w1',
    dayOfWeek: args.dayOfWeek ?? 1,
    name: args.name,
    description: args.name,
    durationMinutes: 60,
    intensity: args.intensity ?? 'Moderate',
    workoutType: args.type ?? (args.conditioning && planned.length > 0 ? 'Mixed' : planned.length > 0 ? 'Strength' : 'Conditioning'),
    sessionTier: 'core',
    planEntryId: `slice3:${args.id}`,
    strengthIntent: planned.length > 0 ? {
      archetype,
      primaryPattern: args.primary ?? planned[0] ?? null,
      plannedPatterns: planned,
      effectivePatterns: planned,
    } : undefined,
    strengthPatternContributions: planned,
    hasCombinedConditioning: !!args.conditioning && planned.length > 0,
    attachedConditioningKind: args.conditioning && planned.length > 0 ? 'component' : undefined,
    conditioningCategory: args.conditioning?.category,
    conditioningFlavour: args.conditioning
      ? args.conditioning.intent === 'aerobic'
        ? 'aerobic'
        : args.conditioning.intent === 'tempo' ? 'tempo' : 'high-intensity'
      : undefined,
    conditioningBlock: args.conditioning ? {
      intent: args.conditioning.intent,
      attachedKind: planned.length > 0 ? 'component' : undefined,
      options: args.conditioning.titles.map((title, index) => ({
        title,
        description: title,
        exerciseIds: [args.conditioning!.ids[index]],
        // The fixture carries allocator-owned modality explicitly so the
        // observation does not reconstruct programming intent from copy.
        ...(args.conditioning!.modalities?.[index]
          ? { modality: args.conditioning!.modalities![index] }
          : {}),
      })),
    } : undefined,
    powerBlock: args.powerBlock,
    exercises: args.exercises,
    ...({ isTeamDay: args.isTeamDay } as any),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function powerBlock(spec: NonNullable<ReturnType<typeof decidePowerPrimer>>): PowerBlock {
  const option = spec.family === 'lower' ? 'Vertical Jump' : 'Explosive Push-Up';
  return {
    id: `power:${spec.kind}:${spec.family}`,
    kind: spec.kind,
    family: spec.family,
    title: spec.kind === 'contrast' ? 'Contrast Power' : 'Power Primer',
    prescription: `${spec.sets} x ${spec.repsMin}-${spec.repsMax}`,
    placement: 'pre_lift',
    options: [{
      name: option,
      sets: spec.sets,
      repsMin: spec.repsMin,
      repsMax: spec.repsMax,
      equipmentRequired: [],
    }],
    notes: spec.kind === 'contrast' ? ['Contrast: pair with the heavy lift.'] : ['Stay sharp.'],
    counting: { hardExposure: false, mainStrength: false, conditioningCredit: 'none', isFinisher: false },
  };
}

function powerFor(context: PowerPrimerContext): PowerBlock | undefined {
  const spec = decidePowerPrimer(context);
  return spec ? powerBlock(spec) : undefined;
}

function canonicalPatterns(values: readonly string[] | undefined): StrengthPattern[] {
  const set = new Set(values ?? []);
  return PATTERN_ORDER.filter((pattern) => set.has(pattern));
}

function harnessComponents(workout: Workout | null): HarnessSessionComponent[] {
  if (!workout) return [];
  const mapped = new Set<HarnessSessionComponent>();
  for (const component of getSessionComponents(workout)) {
    if (component.kind === 'strength') mapped.add('strength');
    else if (component.kind === 'conditioning' || component.kind === 'finisher') mapped.add('conditioning');
    else if (component.kind === 'team_training') mapped.add('team_training');
    else if (component.kind === 'power') mapped.add('power');
    else if (component.kind === 'support') mapped.add('trunk_support');
    else if (component.kind === 'recovery' || component.kind === 'recovery_addon') mapped.add('recovery');
  }
  return COMPONENT_ORDER.filter((component) => mapped.has(component));
}

function modality(text: string): HarnessConditioningEntry['modality'] {
  const value = inferModalityFromName(text);
  if (value === 'run') return 'running';
  if (value === 'bike' || value === 'row' || value === 'ski') return value;
  if (value === 'mixed') return 'mixed_off_feet';
  return 'other';
}

function conditioningLedger(workout: Workout | null): HarnessConditioningEntry[] {
  if (!workout?.conditioningBlock) return [];
  return workout.conditioningBlock.options.map((option) => {
    const text = `${option.title} ${option.description}`;
    const typedModality = (option as typeof option & { modality?: string }).modality;
    const actualModality: HarnessConditioningEntry['modality'] =
      typedModality === 'running' ? 'running'
        : typedModality === 'bike' || typedModality === 'row' || typedModality === 'ski'
          ? typedModality
          : modality(text);
    const category = workout.conditioningCategory;
    const intent: HarnessConditioningEntry['intent'] = category === 'aerobic_base'
      ? (/flush/i.test(text) ? 'flush' : 'aerobic_base')
      : category === 'tempo' ? 'tempo'
        : category === 'sprint' ? 'speed'
          : 'intervals';
    const intensity: HarnessConditioningEntry['intensity'] = category === 'aerobic_base'
      ? 'easy' : category === 'tempo' ? 'moderate' : 'hard';
    const minutes = Number(text.match(/(\d+)\s*min/i)?.[1] ?? 0) || undefined;
    return {
      modality: actualModality,
      intent,
      intensity,
      minutes,
      offFeet: actualModality !== 'running',
    };
  });
}

function powerLedger(workout: Workout | null): HarnessPowerIntent {
  const block = workout?.powerBlock;
  if (!block) return { kind: 'none' };
  if (block.kind === 'primer') return { kind: 'primer', explosiveFamily: block.family };
  const aligned = alignPowerBlockToFinalWorkoutContent(workout!);
  return {
    kind: 'contrast',
    explosiveFamily: block.family,
    heavyLiftFamily: block.family,
    heavyLiftPresent: aligned.action === 'unchanged' && aligned.workout.powerBlock?.kind === 'contrast',
  };
}

function evidenceFromActions(actions: Array<{ kind: string; reason: string; item?: string }>): HarnessTransformEvidence[] {
  return actions.map((action) => ({
    domain: action.kind.startsWith('power_') ? 'power' : 'canonicalisation',
    action: action.kind.includes('downgraded') ? 'downgrade' : action.kind.includes('removed') ? 'remove' : 'retain',
    code: action.reason,
    items: action.item ? [action.item] : undefined,
  }));
}

function stageObservation(args: {
  stage: Slice3TraceStage;
  workout: Workout | null;
  date: string;
  evidence?: HarnessTransformEvidence[];
  accounting?: HarnessExposureLedger;
  visible?: { title: string | null; subtitle: string | null; components?: HarnessSessionComponent[]; patterns?: StrengthPattern[] };
}): Slice3StageObservation {
  const workout = args.workout;
  const identity = workout ? deriveVisibleWorkoutIdentity(workout) : { title: null, subtitle: null };
  return {
    stage: args.stage,
    planEntryId: workout?.planEntryId ?? '',
    day: workout ? DAY_NAMES[workout.dayOfWeek] : '',
    date: args.date,
    workoutName: workout?.name ?? null,
    workoutType: workout?.workoutType ?? null,
    intensity: workout?.intensity ?? null,
    components: args.visible?.components ?? harnessComponents(workout),
    plannedPatterns: canonicalPatterns(workout?.strengthIntent?.plannedPatterns),
    effectivePatterns: args.visible?.patterns ?? canonicalPatterns(workout?.strengthIntent?.effectivePatterns),
    exerciseNames: (workout?.exercises ?? []).map((item) => item.exercise?.name ?? '').filter(Boolean),
    conditioning: conditioningLedger(workout),
    power: powerLedger(workout),
    visibleTitle: args.visible?.title ?? identity.title,
    visibleSubtitle: args.visible?.subtitle ?? String(identity.subtitle ?? ''),
    evidence: args.evidence ?? [],
    accounting: args.accounting,
  };
}

function exposureLedger(workouts: Array<{ date: string; workout: Workout | null }>): HarnessExposureLedger {
  const counts = countWeeklyExposures(workouts);
  let squatStrength = 0;
  let hingeStrength = 0;
  let upperPushStrength = 0;
  let upperPullStrength = 0;
  let upperStrengthFatigue = 0;
  let lowerStrengthFatigue = 0;
  let hardConditioning = 0;
  let power = 0;
  const resolved: ResolvedDay[] = workouts.map(({ date, workout }) => ({
    date,
    dayOfWeek: workout?.dayOfWeek ?? new Date(`${date}T12:00:00`).getDay(),
    short: workout ? DAY_NAMES[workout.dayOfWeek].slice(0, 3).toUpperCase() : '',
    isToday: false,
    workout,
    source: workout ? 'template' : 'none',
    indicator: workout?.sessionTier === 'core' ? 'core' : 'optional',
  } as ResolvedDay));
  const weekLog = buildWeekLog(resolved, {}, 'high');

  for (const { workout } of workouts) {
    if (!workout) continue;
    const patterns = canonicalPatterns(workout.strengthIntent?.effectivePatterns);
    if (patterns.includes('squat')) squatStrength++;
    if (patterns.includes('hinge')) hingeStrength++;
    if (patterns.includes('push')) upperPushStrength++;
    if (patterns.includes('pull')) upperPullStrength++;
    const classification = classifyVisibleSession(workout);
    if (classification.contributions.mainStrength > 0) {
      if (classification.strengthRegion === 'upper' || classification.strengthRegion === 'full_body') upperStrengthFatigue++;
      if (classification.strengthRegion === 'lower' || classification.strengthRegion === 'full_body') lowerStrengthFatigue++;
    }
    hardConditioning += classification.units.filter((unit) =>
      unit.conditioningRole === 'hard' && unit.contributions.conditioning > 0).length;
    if (workout.powerBlock) power++;
  }
  return {
    squatStrength,
    hingeStrength,
    upperPushStrength,
    upperPullStrength,
    conditioning: counts.conditioningExposures,
    hardConditioning,
    sprintCod: counts.sprintCodExposures,
    power,
    upperStrengthFatigue,
    lowerStrengthFatigue,
    teamTrainingAnchors: counts.teamTrainingSessions,
    gameAnchors: counts.games,
    recovery: counts.recoverySessions,
    hardDays: counts.hardDays,
    mainStrength: weekLog.strengthSessions.length,
    running: counts.runningExposures,
  };
}

function baseProfile(phase: OnboardingData['seasonPhase']): OnboardingData {
  return {
    seasonPhase: phase,
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    experienceLevel: '2-5 years',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
  } as OnboardingData;
}

interface FixtureResult {
  raw: Workout;
  generated: Workout;
  effective: Workout;
  week: Array<{ date: string; workout: Workout | null }>;
  profile: OnboardingData;
  date: string;
  evidence: HarnessTransformEvidence[];
  generatedEvidence?: HarnessTransformEvidence[];
  proximityPower?: Slice3StageObservation['proximityPower'];
}

function canonical(raw: Workout, context: any): { workout: Workout; evidence: HarnessTransformEvidence[] } {
  const result = finaliseWorkoutAfterMutation(raw, context);
  return { workout: result.workout, evidence: evidenceFromActions(result.actions) };
}

function fixture(scenario: Slice3GoldenScenario): FixtureResult {
  const date = '2026-03-23';
  if (scenario.id === 'early-offseason-healthy') {
    const id = 'early-offseason';
    const raw = baseWorkout({
      id, name: 'Lower Strength + Aerobic Base', patterns: ['squat'], primary: 'squat',
      exercises: [
        row(id, 0, 'Back Squat', { equipment: ['Barbell', 'Rack'], reps: 10 }),
        row(id, 1, 'Broad Jump', { reps: 3 }),
        row(id, 2, '30min zone 2 Assault Bike'),
      ],
      conditioning: { intent: 'aerobic', category: 'aerobic_base', ids: [`${id}:row:2`], titles: ['30min zone 2 Assault Bike'] },
    });
    const generated = canonical(raw, { phase: 'Off-season', offseasonSubphase: 'early_offseason' });
    return { raw, generated: generated.workout, effective: generated.workout, week: [{ date, workout: generated.workout }], profile: baseProfile('Off-season'), date, evidence: generated.evidence };
  }

  if (scenario.id === 'mid-offseason-primer' || scenario.id.startsWith('late-offseason-')) {
    const mid = scenario.id === 'mid-offseason-primer';
    const invalid = scenario.id === 'late-offseason-invalid-contrast';
    const id = scenario.id;
    const specContext: PowerPrimerContext = {
      phase: 'Off-season',
      offseasonSubphase: mid ? 'mid_offseason' : 'late_offseason',
      strengthPattern: 'lower', hasGame: false, gOffset: -7, isTeamDay: false,
      readiness: 'high', isDeload: false, isBeginner: false, experienced: true,
      injuries: [], powerGoalNudge: false,
    };
    const block = powerFor(specContext);
    const raw = baseWorkout({
      id, name: mid ? 'Lower Strength + Power Primer' : 'Lower Strength + Contrast Power',
      patterns: ['squat'], primary: 'squat', powerBlock: block,
      exercises: [row(id, 0, invalid ? 'Goblet Squat' : 'Back Squat', {
        equipment: invalid ? ['Dumbbells'] : ['Barbell', 'Rack'], reps: invalid ? 10 : 4, weight: invalid ? undefined : 100,
      })],
    });
    const generated = canonical(raw, {
      phase: 'Off-season', offseasonSubphase: mid ? 'mid_offseason' : 'late_offseason',
    });
    return { raw, generated: generated.workout, effective: generated.workout, week: [{ date, workout: generated.workout }], profile: baseProfile('Off-season'), date, evidence: generated.evidence };
  }

  if (scenario.id === 'inseason-game-sat-g2-lower') {
    const id = 'g2-lower';
    const raw = baseWorkout({
      id, dayOfWeek: 4, name: 'Renamed Session', intensity: 'High', patterns: ['squat', 'hinge'], primary: 'squat',
      powerBlock: powerFor({
        phase: 'In-season', strengthPattern: 'lower_combined', hasGame: true, gOffset: -2,
        isTeamDay: false, readiness: 'high', isDeload: false, isBeginner: false,
        experienced: true, injuries: [], powerGoalNudge: false,
      }),
      exercises: [
        row(id, 0, 'Back Squat', { equipment: ['Barbell', 'Rack'], reps: 5, weight: 100 }),
        row(id, 1, 'Romanian Deadlift', { equipment: ['Barbell'], reps: 6, weight: 90 }),
      ],
    });
    const profile = { ...baseProfile('In-season'), usualGameDay: 'Saturday', gameDay: 'Saturday' } as OnboardingData;
    const state: ScheduleState = {
      currentProgram: {
        id: 'g2-program', userId: 'bible', name: 'G2', description: '', programPhase: 'In-Season',
        startDate: '2026-03-23', endDate: '2026-03-29', microcycles: [], primaryFocus: '', isActive: true,
        createdAt: NOW, updatedAt: NOW,
      },
      currentMicrocycle: {
        id: raw.microcycleId, programId: 'g2-program', weekNumber: 1, startDate: '2026-03-23', endDate: '2026-03-29',
        miniCycleNumber: 1, intensityMultiplier: 1, workouts: [raw], createdAt: NOW, updatedAt: NOW,
      },
      manualOverrides: {}, markedDays: { '2026-03-28': 'game' }, athleteContext: DEFAULT_ATHLETE_CONTEXT,
      seasonPhase: 'In-season', usualGameDay: 'Saturday', gameDay: 'Saturday',
    };
    const resolved = resolveDate('2026-03-26', state);
    const effective = resolved.workout!;
    const evidence: HarnessTransformEvidence[] = resolved.source === 'gameProximity'
      ? [{ domain: 'spacing', action: 'downgrade', code: 'g2_lower_moderated', day: 4, patterns: ['squat', 'hinge'] }]
      : [];
    const proximityContext: Omit<PowerPrimerContext, 'gOffset'> = {
      phase: 'In-season', strengthPattern: 'lower_combined', hasGame: true,
      isTeamDay: false, readiness: 'high', isDeload: false, isBeginner: false,
      experienced: true, injuries: [], powerGoalNudge: false,
    };
    const proximityKind = (gOffset: number): HarnessPowerIntent['kind'] =>
      decidePowerPrimer({ ...proximityContext, gOffset })?.kind ?? 'none';
    return {
      raw, generated: raw, effective,
      week: [{ date: '2026-03-26', workout: effective }, { date: '2026-03-28', workout: gameWorkout() }],
      profile, date: '2026-03-26', evidence, generatedEvidence: [],
      proximityPower: {
        gMinus1: proximityKind(-1), gameDay: proximityKind(0),
        gPlus1: proximityKind(1), gMinus2: proximityKind(-2),
      },
    };
  }

  if (scenario.id === 'inseason-mixed-team-accounting') {
    const mixed = mixedLowerWorkout('accounting-mixed', 1);
    const team = teamUpperWorkout();
    const game = gameWorkout();
    return {
      raw: mixed, generated: mixed, effective: mixed,
      week: [
        { date: '2026-03-23', workout: mixed },
        { date: '2026-03-24', workout: team },
        { date: '2026-03-28', workout: game },
      ],
      profile: baseProfile('In-season'), date, evidence: [],
    };
  }

  if (scenario.id === 'hamstring-restriction-mixed') {
    const raw = hamstringMixedWorkout();
    const generated = canonical(raw, { phase: 'In-season' });
    const constraint = injuryConstraint('hamstring', 6);
    const result = validateWorkoutAgainstActiveConstraints({
      workout: generated.workout, date, todayISO: date, activeConstraints: [constraint], profile: baseProfile('In-season'),
    });
    const effective = result.workout!;
    const evidence: HarnessTransformEvidence[] = result.changed ? [{
      domain: 'constraint', action: 'remove', code: 'active_injury_filter',
      constraintIds: result.activeConstraintIds, items: result.removedExerciseNames,
      patterns: differencePatterns(generated.workout, effective), components: result.removedComponents,
    }] : [];
    return { raw, generated: generated.workout, effective, week: [{ date, workout: effective }], profile: baseProfile('In-season'), date, evidence: [...generated.evidence, ...evidence], generatedEvidence: generated.evidence };
  }

  if (scenario.id === 'equipment-no-barbell-lower') {
    const id = 'equipment-lower';
    const raw = baseWorkout({
      id, name: 'Lower Squat', patterns: ['squat'], primary: 'squat', exercises: [
        row(id, 0, 'Back Squat', { equipment: ['Barbell', 'Rack'], reps: 6 }),
        row(id, 1, 'Bulgarian Split Squat', { equipment: ['Dumbbells'], reps: 8 }),
      ],
    });
    const generated = canonical(raw, { phase: 'In-season' });
    const constraint = equipmentConstraint();
    const result = validateWorkoutAgainstActiveConstraints({
      workout: generated.workout, date, todayISO: date, activeConstraints: [constraint], profile: baseProfile('In-season'),
    });
    const effective = result.workout!;
    const evidence: HarnessTransformEvidence[] = result.changed ? [{
      domain: 'constraint', action: 'remove', code: 'equipment_unavailable', constraintIds: result.activeConstraintIds,
      items: result.removedExerciseNames, patterns: differencePatterns(generated.workout, effective),
    }] : [];
    return { raw, generated: generated.workout, effective, week: [{ date, workout: effective }], profile: baseProfile('In-season'), date, evidence: [...generated.evidence, ...evidence], generatedEvidence: generated.evidence };
  }

  if (scenario.id === 'low-readiness-downgrade') {
    const raw = mixedLowerWorkout('readiness-mixed', 1, false);
    raw.powerBlock = powerBlock({
      kind: 'primer', family: 'lower', sets: 3, repsMin: 3, repsMax: 3,
      reduced: false, reason: 'pre-readiness candidate',
    });
    const generated = canonical(raw, { phase: 'Pre-season', readiness: 'low' });
    const evidence: HarnessTransformEvidence[] = generated.evidence.some((item) => item.domain === 'power')
      ? [{ domain: 'constraint', action: 'downgrade', code: 'low_readiness_power_blocked', components: ['power'] }]
      : [];
    return { raw, generated: generated.workout, effective: generated.workout, week: [{ date, workout: generated.workout }], profile: baseProfile('Pre-season'), date, evidence: [...generated.evidence, ...evidence] };
  }

  const multi = multiModalityWorkout();
  const generated = canonical(multi, { phase: 'Off-season', offseasonSubphase: 'mid_offseason' });
  return { raw: multi, generated: generated.workout, effective: generated.workout, week: [{ date, workout: generated.workout }], profile: baseProfile('Off-season'), date, evidence: generated.evidence };
}

function differencePatterns(before: Workout, after: Workout): string[] {
  const afterSet = new Set(after.strengthIntent?.effectivePatterns ?? []);
  return (before.strengthIntent?.effectivePatterns ?? []).filter((pattern) => !afterSet.has(pattern));
}

function injuryConstraint(bucket: ActiveInjuryConstraint['bucket'], severity: number): ActiveInjuryConstraint {
  return {
    id: `injury-${bucket}`, type: 'injury', bodyPart: String(bucket), bucket, severity,
    status: 'active', startDate: '2026-03-23', lastUpdatedAt: NOW,
    adjustmentLevel: 'moderate', seriousSymptoms: false, rules: [], safeFocus: [], advice: [],
  };
}

function equipmentConstraint(): ActiveEquipmentConstraint {
  return {
    id: 'equipment-no-barbell', type: 'equipment', mode: 'without', tags: ['barbell'], severity: 0,
    status: 'active', startDate: '2026-03-23', lastUpdatedAt: NOW, source: 'tap',
    modifierAffects: ['current_week', 'future_generation'], rules: [], safeFocus: [], advice: [],
  };
}

function mixedLowerWorkout(id: string, dayOfWeek: number, withPower = false): Workout {
  const bike = `${id}:row:2`;
  return baseWorkout({
    id, dayOfWeek, name: 'Lower Strength + Bike Intervals', intensity: 'High', patterns: ['squat', 'hinge'], primary: 'squat',
    powerBlock: withPower ? powerBlock({ kind: 'primer', family: 'lower', sets: 3, repsMin: 3, repsMax: 3, reduced: false, reason: 'fixture' }) : undefined,
    exercises: [
      row(id, 0, 'Back Squat', { equipment: ['Barbell', 'Rack'], reps: 5, weight: 100 }),
      row(id, 1, 'Romanian Deadlift', { equipment: ['Barbell'], reps: 6, weight: 90 }),
      row(id, 2, withPower ? 'Hard Assault Bike Intervals' : 'Bike Aerobic Base'),
      row(id, 3, 'Pallof Press', { reps: 10 }),
    ],
    conditioning: {
      intent: withPower ? 'high-intensity' : 'aerobic',
      category: withPower ? 'vo2' : 'aerobic_base', ids: [bike],
      titles: [withPower ? 'Hard Assault Bike Intervals' : 'Bike Aerobic Base'],
    },
  });
}

function hamstringMixedWorkout(): Workout {
  const id = 'hamstring-mixed';
  return baseWorkout({
    id, name: 'Upper Push + Hinge + Aerobic Base', patterns: ['hinge', 'push'], primary: 'push', exercises: [
      row(id, 0, 'Romanian Deadlift', { equipment: ['Barbell'], reps: 6 }),
      row(id, 1, 'Bench Press', { equipment: ['Barbell', 'Bench'], reps: 6 }),
      row(id, 2, 'Bike Aerobic Base'),
    ],
    conditioning: { intent: 'aerobic', category: 'aerobic_base', ids: [`${id}:row:2`], titles: ['Bike Aerobic Base'] },
  });
}

function teamUpperWorkout(): Workout {
  const id = 'team-upper';
  return baseWorkout({
    id, dayOfWeek: 2, name: 'Team Training + Upper Pull', type: 'Team Training', intensity: 'High',
    patterns: ['pull'], primary: 'pull', isTeamDay: true,
    exercises: [row(id, 0, 'Pull-Ups', { reps: 6 }), row(id, 1, 'Chest Supported Row', { reps: 8 })],
  });
}

function gameWorkout(): Workout {
  return baseWorkout({ id: 'game', dayOfWeek: 6, name: 'Game Day', type: 'Game', intensity: 'High', exercises: [] });
}

function multiModalityWorkout(): Workout {
  const id = 'multi-modality';
  return baseWorkout({
    id, name: 'Off-Feet Tempo', type: 'Conditioning', intensity: 'Moderate', exercises: [
      row(id, 0, 'Bike Tempo 12min'), row(id, 1, 'RowErg Tempo 3 x 8min'),
    ],
    conditioning: {
      intent: 'tempo', category: 'tempo', ids: [`${id}:row:0`, `${id}:row:1`],
      titles: ['Bike Tempo 12min', 'RowErg Tempo 3 x 8min'],
      modalities: ['bike', 'row'],
    },
  });
}

function projectionObservations(
  scenario: Slice3GoldenScenario,
  workout: Workout,
  profile: OnboardingData,
  date: string,
): { week: Slice3StageObservation; detail: Slice3StageObservation } {
  const day = DAY_NAMES[workout.dayOfWeek];
  // The workout has already crossed the resolved_effective boundary. Disable
  // a second scheduling/fill pass while still exercising the real weekly and
  // detail projection functions over that exact final workout.
  const projectionProfile = {
    ...profile,
    seasonPhase: undefined,
    usualGameDay: undefined,
    gameDay: undefined,
  } as unknown as OnboardingData;
  const fakeScenario = {
    id: 'accessory-gunshow-only', description: scenario.description,
    referenceDate: scenario.referenceDate, timezone: scenario.timezone, profile: projectionProfile,
    ruleIds: ['ALL-COMP-PROJECTION-01'], target: { weekInBlock: 1, day },
    sourceKind: 'direct_accessory_fixture',
  } as ComponentGoldenScenario;
  const allocation: any = {
    tier: workout.sessionTier ?? 'core', focus: workout.name, dayOfWeek: day,
    isHardExposure: workout.intensity === 'High', planEntryId: workout.planEntryId,
    strengthIntent: workout.strengthIntent,
  };
  const trace = buildSingleWorkoutFixtureTrace({ scenario: fakeScenario, allocation, workout });
  const weekly = trace.sessions.visible_week[0];
  const detail = trace.sessions.visible_detail[0];
  const visible = (entry: typeof weekly, stage: 'visible_week' | 'visible_detail') => stageObservation({
    stage, workout, date,
    visible: {
      title: entry?.visibleTitle ?? null,
      subtitle: entry?.visibleSubtitle ?? null,
      components: entry?.components ?? [],
      patterns: entry?.effectivePatterns ?? [],
    },
  });
  return { week: visible(weekly, 'visible_week'), detail: visible(detail, 'visible_detail') };
}

function applyMutation(trace: Slice3ScenarioTrace, mutation?: Slice3MutationId): Slice3ScenarioTrace {
  if (!mutation) return trace;
  const clone = JSON.parse(JSON.stringify(trace)) as Slice3ScenarioTrace;
  const generated = clone.stages.generated_fallback;
  const effective = clone.stages.resolved_effective;
  const week = clone.stages.visible_week;
  const detail = clone.stages.visible_detail;
  const accounting = clone.stages.weekly_accounting?.accounting;
  if (mutation === 'early_power_survives' && generated && effective) {
    generated.power = effective.power = { kind: 'primer', explosiveFamily: 'lower' };
    generated.components.push('power'); effective.components.push('power');
  } else if (mutation === 'contrast_without_heavy' && effective) {
    effective.power = { kind: 'contrast', explosiveFamily: 'lower', heavyLiftFamily: 'lower', heavyLiftPresent: false };
  } else if (mutation === 'offfeet_reported_running') {
    for (const stage of [generated, effective, week, detail]) {
      if (stage?.conditioning[0]) stage.conditioning[0].modality = 'running';
    }
  } else if (mutation === 'drop_second_modality') {
    for (const stage of [effective, week, detail]) if (stage) stage.conditioning = stage.conditioning.slice(0, 1);
  } else if (mutation === 'mixed_strength_fatigue_zero' && accounting) {
    accounting.mainStrength = 1; accounting.lowerStrengthFatigue = 0;
  } else if (mutation === 'team_false_squat_credit' && accounting) {
    accounting.squatStrength += 1;
  } else if (mutation === 'g2_heavy_survives' && effective) {
    effective.intensity = 'High'; effective.evidence = [];
  } else if (mutation === 'constraint_drops_unrelated' && effective) {
    effective.conditioning = []; effective.components = effective.components.filter((item) => item !== 'conditioning');
    effective.evidence = effective.evidence.filter((item) => !item.components?.includes('conditioning'));
  } else if (mutation === 'equipment_incompatible_survives' && effective) {
    effective.exerciseNames.push('Back Squat');
  } else if (mutation === 'trunk_creates_conditioning' && accounting) {
    accounting.conditioning += 1; accounting.hardConditioning += 1;
  }
  return clone;
}

export function buildSlice3ScenarioTrace(
  scenario: Slice3GoldenScenario,
  mutation?: Slice3MutationId,
): Slice3ScenarioTrace {
  const startedAt = performance.now();
  const built = fixture(scenario);
  const projections = projectionObservations(scenario, built.effective, built.profile, built.date);
  const accounting = exposureLedger(built.week);
  const trace: Slice3ScenarioTrace = {
    scenario,
    stages: {
      allocation: stageObservation({ stage: 'allocation', workout: built.raw, date: built.date }),
      generated_fallback: stageObservation({ stage: 'generated_fallback', workout: built.generated, date: built.date, evidence: built.generatedEvidence ?? built.evidence }),
      resolved_effective: stageObservation({ stage: 'resolved_effective', workout: built.effective, date: built.date, evidence: built.evidence }),
      visible_week: projections.week,
      visible_detail: projections.detail,
      weekly_accounting: stageObservation({ stage: 'weekly_accounting', workout: built.effective, date: built.date, evidence: built.evidence, accounting }),
    },
    runtimeMs: performance.now() - startedAt,
  };
  if (trace.stages.resolved_effective && built.proximityPower) {
    trace.stages.resolved_effective.proximityPower = built.proximityPower;
  }
  return applyMutation(trace, mutation);
}
