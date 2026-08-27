import { createHash } from 'crypto';
import type { CanonicalWeeklyCompilerResult } from '../../rules/canonicalWeeklyCompiler';
import { evaluateSection18EffectiveWeek } from '../../rules/section18EffectiveWeekEvaluator';
import type { Microcycle, OnboardingData } from '../../types/domain';
import type { WeeklyExposureContractV2 } from '../../rules/weeklyExposureContractV2';
import type { ResolvedDay } from '../../utils/sessionResolver';
import { semanticFingerprint, snapshotSemanticResolvedDay } from '../../utils/programSemanticSnapshot';
import { DAY_NAMES, plusDays } from './catalog';
import type { Check } from './results';

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
  const optionalErrors = days.filter((d) => d.workout && (
    (phase === 'Off-season' && phaseWeek <= 2 && d.source !== 'game' && d.indicator !== 'optional' && d.indicator !== 'recovery') ||
    (profile.gender === 'female' && d.workout.composedOptionalKind === 'gunshow')
  )).map((d) => `${d.date}:${d.indicator}:${d.workout?.composedOptionalKind}`);
  const scheduled = phase !== 'In-season' && phaseWeek % 4 === 0 && (phase !== 'Off-season' || phaseWeek > 4);
  const deload = (week.weekKind === 'deload') === scheduled &&
    (!scheduled || (week.deloadDoor === 'scheduled' && Object.keys(week.dosePolicyByDay ?? {}).length > 0));
  const evaluation = evaluateSection18EffectiveWeek({ contract: args.effectiveContract, workouts, weekStart });
  const blocking = evaluation?.blockingViolations ?? [];
  return [
    { id: 'phase_clock', ok: args.effectiveContract.identity.seasonPhase === phase && args.effectiveContract.identity.phaseWeek === phaseWeek,
      detail: `expected=${phase}/${phaseWeek} actual=${args.effectiveContract.identity.seasonPhase}/${args.effectiveContract.identity.phaseWeek}` },
    { id: 'placement', ok: placement, detail: `visible dates=${days.map((d) => d.date).join(',')}` },
    { id: 'fixtures', ok: fixtures, detail: `expected=${expectedGames.join(',')} actual=${actualGames.map((d) => d.date).join(',')}` },
    { id: 'conservation', ok: unique, detail: 'Distinct visible session/row IDs; exact persisted reconstruction is checked separately. Plan-to-final-row ownership remains a prerequisite.' },
    { id: 'optional', ok: optionalErrors.length === 0, detail: optionalErrors.join(',') },
    { id: 'deload', ok: deload, detail: `phaseWeek=${phaseWeek} expectedScheduled=${scheduled} kind=${week.weekKind} door=${week.deloadDoor}` },
    { id: 'programming', ok: evaluation !== null && blocking.length === 0,
      detail: evaluation ? JSON.stringify(blocking) : 'Missing current typed exposure contract' },
  ];
}
