import { completeWeeklyLegCoverage, isNordicExercise } from '../../rules/weeklyLegCoverage';
import type { ActiveConstraint } from '../../store/coachUpdatesStore';
import { createHash } from 'crypto';
import type { CanonicalWeeklyCompilerResult } from '../../rules/canonicalWeeklyCompiler';
import { evaluateSection18EffectiveWeek } from '../../rules/section18EffectiveWeekEvaluator';
import type { Microcycle, OnboardingData, UserRemovalConstraint } from '../../types/domain';
import type { WeeklyExposureContractV2 } from '../../rules/weeklyExposureContractV2';
import type { ResolvedDay } from '../../utils/sessionResolver';
import { semanticFingerprint, snapshotSemanticResolvedDay } from '../../utils/programSemanticSnapshot';
import { DAY_NAMES, plusDays } from './catalog';
import type { Check } from './results';
import { buildSessionTemplate } from '../../utils/sessionTemplate';
import { project } from '../../rules/projectVisibleWeek';
import { applyConstraintsToTypedComponents } from '../../utils/exposureEngine';
import { compileActiveExposureConstraints } from '../../rules/canonicalWeeklyConstraintCompiler';
import { filterConstraintsForDate } from '../../utils/readinessConstraints';
import { selectMobilityPrehabFlow } from '../../utils/mobilityPrehabFlow';
import { equipmentTagsOnDate } from '../../rules/canonicalWeeklyAvailabilityState';
import { isAdductorIsometric } from '../../rules/footballRobustnessFoundation';

export function compilerChecks(result: CanonicalWeeklyCompilerResult): Check[] {
  if (result.ok === false) return [{ id: 'accepted_compile', ok: false, detail: JSON.stringify(result.refusal) }];
  const days = result.schedule.days;
  const dates = Array.from({ length: 7 }, (_, i) => plusDays(result.schedule.weekStartISO, i));
  return [
    { id: 'compiler_unique_days', ok: days.length === 7 && new Set(days.map((d) => d.dateISO)).size === 7 &&
      new Set(days.map((d) => d.dayOfWeek)).size === 7 && days.every((d) => dates.includes(d.dateISO) &&
        new Date(`${d.dateISO}T12:00:00Z`).getUTCDay() === d.dayOfWeek) },
    { id: 'compiler_fixture_priority', ok: days.filter((d) => d.game).every((d) =>
      d.owner === 'game' && d.purpose === null && d.conditioning === null && !d.sprintComponent && !d.powerEligible) },
    { id: 'compiler_sprint_identity', ok: days.filter((d) => d.conditioning === 'sprint_high_speed' || d.sprintComponent).every((d) => {
      const entry = result.plan.weeklyPlan.find((entry) => entry.dayOfWeek === DAY_NAMES[d.dayOfWeek]);
      return entry?.speedWorkKind === 'true_speed' && entry.speedBlock?.kind === 'true_speed' &&
        (d.conditioning !== 'sprint_high_speed' || !entry.conditioningCategory);
    }) },
  ];
}

// Includes component identity, order, dose, load and presentation. The shared
// snapshot retains creation timestamps inside power metadata; those two audit
// fields are not training instructions and may change during regeneration.
export function visibleSignature(days: readonly ResolvedDay[]): string {
  return semanticFingerprint(JSON.parse(JSON.stringify(days.map((day) => ({ ...snapshotSemanticResolvedDay(day),
    source: day.source, indicator: day.indicator, optionalKind: day.workout?.composedOptionalKind ?? null })),
    (key, value) => key === 'createdAt' || key === 'updatedAt' ? undefined : value)));
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** Prescribed Nordic sets across a visible week (R-394's "a couple of sets"). */
export function nordicSetsIn(workouts: readonly { exercises: readonly { exercise?: { name?: string }; prescribedSets: number; unavailableForInjury?: unknown }[] }[]): number {
  return workouts.flatMap((w) => w.exercises).filter((row) => isNordicExercise(row.exercise?.name ?? '')
    && row.prescribedSets > 0 && !row.unavailableForInjury).reduce((sum, row) => sum + row.prescribedSets, 0);
}

export function signatureDifferences(before: string, after: string): string[] {
  const changes: string[] = [];
  const visit = (a: any, b: any, path: string) => {
    if (semanticFingerprint(a) === semanticFingerprint(b)) return;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) visit(a[key], b[key], `${path}.${key}`);
    } else if (changes.length < 30) changes.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  };
  visit(JSON.parse(before), JSON.parse(after), 'days');
  return changes;
}

export function inspectWeek(args: {
  week: Microcycle; days: ResolvedDay[]; weekStart: string; phase: string; phaseWeek: number;
  profile: OnboardingData; marks: Record<string, string>;
  effectiveContract: WeeklyExposureContractV2;
  activeConstraints?: readonly ActiveConstraint[];
  userRemovalConstraints?: readonly UserRemovalConstraint[];
  /** R-394: "every week, or at minimum every second week" needs the previous in-season week. */
  previousInSeasonNordicSets?: number | null;
}): Check[] {
  const { week, days, weekStart, phase, phaseWeek, profile, marks } = args;
  const dates = Array.from({ length: 7 }, (_, i) => plusDays(weekStart, i));
  const placement = days.length === 7 && new Set(days.map((d) => d.date)).size === 7 &&
    days.every((d) => dates.includes(d.date) && d.dayOfWeek === new Date(`${d.date}T12:00:00Z`).getUTCDay()) &&
    week.workouts.every((w) => Number.isInteger(w.dayOfWeek) && w.dayOfWeek >= 0 && w.dayOfWeek <= 6);
  // Explicit fixtures replace the recurring anchor for this week (a move must
  // not create a second game on the old usual day). An additional game is an
  // explicit second date, not an implicit copy of the recurring anchor.
  const explicitGames = dates.filter((date) => marks[date] === 'game');
  const expectedGames = explicitGames.length ? explicitGames : dates.filter((date) =>
    marks[date] !== 'noGame' && marks[date] !== 'rest' && phase === 'In-season' &&
    DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()] === (profile.usualGameDay ?? profile.gameDay));
  const actualGames = days.filter((d) => d.source === 'game' || d.indicator === 'game');
  const fixtures = semanticFingerprint(expectedGames) === semanticFingerprint(actualGames.map((d) => d.date)) &&
    actualGames.every((d) => !d.workout || (!d.workout.exercises.length && !d.workout.powerBlock && !d.workout.conditioningBlock));
  const workouts = days.flatMap((d) => d.workout ? [d.workout] : []);
  const ids = workouts.map((w) => w.id);
  const unique = new Set(ids).size === ids.length && workouts.every((w) =>
    new Set(w.exercises.map((r) => r.id)).size === w.exercises.length);
  const emptyEnergySessions = days.filter(day => day.workout?.workoutType === 'Conditioning' &&
    !day.workout.conditioningBlock?.options.length && !day.workout.speedBlock);
  const optionalErrors = days.filter((d) => d.workout && (
    (phase === 'Off-season' && phaseWeek <= 2 && d.source !== 'game' && d.indicator !== 'optional' && d.indicator !== 'recovery') ||
    (profile.gender === 'female' && d.workout.composedOptionalKind === 'gunshow')
  )).map((d) => `${d.date}:${d.indicator}:${d.workout?.composedOptionalKind}`);
  const scheduled = phase !== 'In-season' && phaseWeek % 4 === 0 && (phase !== 'Off-season' || phaseWeek > 4);
  const deload = (week.weekKind === 'deload') === scheduled &&
    (!scheduled || (week.deloadDoor === 'scheduled' && Object.keys(week.dosePolicyByDay ?? {}).length > 0));
  const evaluation = evaluateSection18EffectiveWeek({ contract: args.effectiveContract, workouts, weekStart });
  const blocking = evaluation?.blockingViolations ?? [];
  const mispresented = days.flatMap(day => buildSessionTemplate(day.workout).items.filter(item =>
    item.kind === 'exercise' && ['main_strength', 'strength_accessory'].includes(item.row.section18Evidence?.role)
      && item.presentation === 'conditioning_phase').map(item => `${day.date}:${item.kind === 'exercise' ? item.row.exercise?.name : ''}`));
  const landmineStrength = days.flatMap(day => buildSessionTemplate(day.workout).items.filter(item =>
    item.kind === 'exercise' && item.row.exercise?.name === 'Explosive Landmine Press'
      && (item.role !== 'power' || item.row.role !== 'power' || item.row.power?.family !== 'upper'
        || item.row.section18Evidence?.role !== 'power' || item.row.section18Evidence.mainStrengthPattern !== null))
    .map(() => day.date));
  let projectionError = '';
  try { project({ week: days, weekStart }); } catch (error) { projectionError = String(error); }
  const coverage=completeWeeklyLegCoverage({weekStartISO:weekStart,workoutsByDate:Object.fromEntries(days.filter(d=>d.workout).map(d=>[d.date,d.workout!])),profile,activeConstraints:args.activeConstraints,userRemovalConstraints:args.userRemovalConstraints,gameDates:actualGames.map(d=>d.date)});
  // R-394 (Sam, 2026-09-09): in-season, a couple of sets of Nordics every week
  // or at minimum every second week; a curl does not replace them. A reduced
  // week (deload door, illness, readiness) may carry the halved single set.
  const inSeason = phase === 'In-season';
  const nordicSets = nordicSetsIn(workouts);
  const nordicReceipt = coverage.receipts.find(r => r.category === 'nordic');
  const reducedWeek = Object.keys(week.dosePolicyByDay ?? {}).length > 0
    || (args.activeConstraints ?? []).some(c => c.status === 'active' && c.type === 'fatigue');
  const nordicOk = !inSeason || (nordicReceipt?.status !== 'added'
    && (nordicSets >= 2 || (args.previousInSeasonNordicSets ?? 0) >= 2
      || (nordicSets >= 1 && reducedWeek)
      || nordicReceipt?.status === 'unavailable' || nordicReceipt?.status === 'athlete_removed'));
  // R-395 (Sam, 2026-09-09): in an in-season game week the club athlete's
  // strength session that lands on a gym day off club training, outside the
  // fixture window and with a machine, is harder than a flush. The checker
  // reads the delivered week (where strength actually landed), the athlete's
  // club nights, kit and the week's fixtures; the assignment itself is R-391's.
  const clubDays = new Set((profile.teamTrainingDays ?? []).map((day) => DAY_NAMES.indexOf(day)));
  const gameDows = actualGames.map((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay());
  const machine = Object.values(profile.equipmentAnswer?.modalities ?? {}).some((value) => value === 'have');
  const untilGame = (day: number, game: number) => (game - day + 7) % 7;
  const sinceGame = (day: number, game: number) => (day - game + 7) % 7;
  const eligibleHarderDays = days.filter((d) => d.workout?.exercises.some((row) => row.section18Evidence?.role === 'main_strength')
    && !clubDays.has(d.dayOfWeek) && !gameDows.includes(d.dayOfWeek)
    && gameDows.every((game) => ![1, 2].includes(untilGame(d.dayOfWeek, game)) && ![1, 2].includes(sinceGame(d.dayOfWeek, game))))
    .map((d) => d.dayOfWeek);
  const restricted = reducedWeek || (args.activeConstraints ?? []).some(c => c.status === 'active' && c.type === 'injury');
  const harderExpected = inSeason && gameDows.length > 0 && clubDays.size > 0 && machine && !restricted && eligibleHarderDays.length > 0;
  // A flush is typed `optional_flush` at light stress; anything harder is a
  // core conditioning component at moderate/hard stress, or a Speed block.
  const harderDelivered = days.some((d) => d.workout && !clubDays.has(d.dayOfWeek) && !gameDows.includes(d.dayOfWeek)
    && ((!!d.workout.conditioningBlock?.options.length && d.workout.section18ConditioningRole !== 'optional_flush'
      && ['moderate', 'hard'].includes(String(d.workout.section18Evidence?.conditioningStress))) || !!d.workout.speedBlock));
  // R-393 repair (Sam's 2026-09-09 review, item 3): the delivered week is a
  // fixed point of the ONE typed injury exposure filter. A Primer whose jump
  // walked past that filter under a knee is exactly what this catches; an
  // athlete's own additions (R-388) and athlete-placed sessions are theirs.
  const exposureLeaks = days.flatMap((d) => {
    const workout = d.workout;
    if (!workout || workout.athletePlacement || workout.workoutType === 'Game') return [];
    const dated = filterConstraintsForDate([...(args.activeConstraints ?? [])], d.date);
    const filtered = applyConstraintsToTypedComponents(workout, compileActiveExposureConstraints([...dated])).workout;
    const kept = new Set(filtered.exercises.map((row) => row.id));
    const lost = workout.exercises.filter((row) => !kept.has(row.id) && !row.athleteAdditionId).map((row) => row.exercise?.name);
    if (workout.speedBlock && !filtered.speedBlock) lost.push('speedBlock');
    return lost.length ? [`${d.date}:${lost.join('+')}`] : [];
  });
  // R-393 repair (item 5): one adductor isometric per session, counting the
  // prescribed rows AND the derived warm-up flow the athlete actually sees.
  const adductorDoubles = days.flatMap((d) => {
    const workout = d.workout;
    if (!workout || workout.athletePlacement) return [];
    const rowsWithGroin = workout.exercises.filter((row) => row.prescribedSets > 0 && !row.unavailableForInjury
      && isAdductorIsometric(row.exercise?.name ?? '')).map((row) => row.exercise?.name);
    const flow = selectMobilityPrehabFlow({ workout, seasonPhase: profile.seasonPhase, isGameWeek: actualGames.length > 0, date: d.date,
      performedMovementIds: [], athlete: { onboardingData: profile, injuries: profile.injuries ?? [],
        activeConstraints: args.activeConstraints, equipmentTags: equipmentTagsOnDate(profile, d.date, []) } });
    const flowWithGroin = (flow?.movements ?? []).filter((m) => isAdductorIsometric(m.exercise.name)).map((m) => m.exercise.name);
    const all = [...rowsWithGroin, ...flowWithGroin];
    return all.length > 1 ? [`${d.date}:${all.join('+')}`] : [];
  });
  return [
    { id:'weekly_calf_hamstring',ok:!coverage.receipts.some(r=>r.status==='added'),detail:JSON.stringify(coverage.receipts) },
    { id:'injury_exposure_fixed_point', ok: exposureLeaks.length === 0, detail: exposureLeaks.join(' | ') },
    { id:'one_adductor_isometric_per_session', ok: adductorDoubles.length === 0, detail: adductorDoubles.join(' | ') },
    { id:'weekly_inseason_nordic', ok: nordicOk, detail: `phase=${phase} nordicSets=${nordicSets} previous=${args.previousInSeasonNordicSets ?? 'none'} reduced=${reducedWeek} receipt=${JSON.stringify(nordicReceipt ?? null)}` },
    { id:'weekly_inseason_conditioning', ok: !harderExpected || harderDelivered, detail: `expected=${harderExpected} delivered=${harderDelivered} eligibleDays=${eligibleHarderDays.join(',')} conditioning=${days.map(d => `${d.dayOfWeek}:${d.workout?.section18ConditioningRole ?? '-'}/${d.workout?.section18Evidence?.conditioningStress ?? '-'}`).join(' ')}` },
    { id: 'phase_clock', ok: args.effectiveContract.identity.seasonPhase === phase && args.effectiveContract.identity.phaseWeek === phaseWeek,
      detail: `expected=${phase}/${phaseWeek} actual=${args.effectiveContract.identity.seasonPhase}/${args.effectiveContract.identity.phaseWeek}` },
    { id: 'placement', ok: placement, detail: `visible dates=${days.map((d) => d.date).join(',')}` },
    { id: 'fixtures', ok: fixtures, detail: `expected=${expectedGames.join(',')} actual=${actualGames.map((d) => d.date).join(',')}` },
    { id: 'conservation', ok: unique, detail: 'Distinct visible session/row IDs; specialist-to-final row conservation is checked at the compiler boundary and exact persisted reconstruction separately.' },
    { id: 'energy_session_content', ok: emptyEnergySessions.length === 0,
      detail: emptyEnergySessions.map(day => `${day.date}:${day.workout?.name}`).join(',') },
    { id: 'optional', ok: optionalErrors.length === 0, detail: optionalErrors.join(',') },
    { id: 'deload', ok: deload, detail: `phaseWeek=${phaseWeek} expectedScheduled=${scheduled} kind=${week.weekKind} door=${week.deloadDoor}` },
    { id: 'programming', ok: evaluation !== null && blocking.length === 0,
      detail: evaluation ? JSON.stringify(blocking) : 'Missing current typed exposure contract' },
    { id: 'typed_strength_presentation', ok: mispresented.length === 0, detail: mispresented.join(',') },
    { id: 'landmine_power_only', ok: landmineStrength.length === 0, detail: landmineStrength.join(',') },
    { id: 'signed_final_projection', ok: !projectionError, detail: projectionError },
  ];
}
