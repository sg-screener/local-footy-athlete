import {
  buildDevE2ESeed,
  validateDevE2EWitnesses,
  type DevE2EWitnessState,
} from '../dev/e2e/devE2ESeedRegistry';
import { buildDevE2EWitnessState } from './devE2ESeedTestSupport';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// totals. This suite sits in test:bible; unarmed, it exits 0 on a drained loop
// and the chain calls that green.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.log(`  ✗ ${name}`);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function failuresFor(
  seedId: Parameters<typeof buildDevE2ESeed>[0],
  state: DevE2EWitnessState,
): string[] {
  const seed = buildDevE2ESeed(seedId);
  return validateDevE2EWitnesses(seedId, seed.witnesses, state);
}

const fixtureSeed = buildDevE2ESeed('fixture-move');
const fixtureState = buildDevE2EWitnessState(fixtureSeed);
const fixtureTarget = fixtureSeed.witnesses.find((witness) =>
  witness.kind === 'eligible_target_date');
if (!fixtureTarget || fixtureTarget.kind !== 'eligible_target_date') {
  throw new Error('fixture target witness missing');
}
const corruptedFixture = clone(fixtureState);
const saturday = fixtureSeed.witnesses.find((witness) =>
  witness.kind === 'fixture_identity');
if (!saturday || saturday.kind !== 'fixture_identity') {
  throw new Error('fixture identity witness missing');
}
const saturdayWorkout = {
  id: saturday.workoutId,
  microcycleId: 'calendar',
  dayOfWeek: 6,
  name: 'Game Day',
  description: 'Match day',
  durationMinutes: 120,
  intensity: 'High' as const,
  workoutType: 'Game' as const,
  sessionTier: 'core' as const,
  exercises: [],
  createdAt: '2026-07-13T12:00:00.000Z',
  updatedAt: '2026-07-13T12:00:00.000Z',
};
corruptedFixture.dateOverrides = {
  ...corruptedFixture.dateOverrides,
  [fixtureTarget.date]: {
    ...saturdayWorkout,
    id: 'corrupt-conflicting-sunday-fixture',
    dayOfWeek: 0,
  },
};
const fixtureFailures = failuresFor('fixture-move', corruptedFixture);
ok(
  'fixture-move witnesses reject a conflicting Sunday overlay',
  fixtureFailures.some((failure) => failure.includes('eligible_target')) &&
    fixtureFailures.some((failure) => failure.includes('absent_overlay')),
  fixtureFailures.join(', '),
);

const stackedSeed = buildDevE2ESeed('stacked-team-training-upper-pull');
const corruptedStacked = buildDevE2EWitnessState(stackedSeed);
const stackedWorkout = corruptedStacked.program?.microcycles[0]?.workouts.find((workout) =>
  workout.dayOfWeek === 2);
if (!stackedWorkout) throw new Error('stacked workout missing');
stackedWorkout.strengthIntent = undefined;
stackedWorkout.strengthPatternContributions = [];
const stackedFailures = failuresFor(
  'stacked-team-training-upper-pull',
  corruptedStacked,
);
ok(
  'stacked witnesses reject loss of the separate Upper Pull component',
  stackedFailures.some((failure) => failure.includes('component_identity')),
  stackedFailures.join(', '),
);

const feedbackSeed = buildDevE2ESeed('feedback-progression-case');
const corruptedFeedback = buildDevE2EWitnessState(feedbackSeed);
const feedbackWitness = feedbackSeed.witnesses.find((witness) =>
  witness.kind === 'session_feedback');
const progressionWitness = feedbackSeed.witnesses.find((witness) =>
  witness.kind === 'future_progression_target');
if (!feedbackWitness || feedbackWitness.kind !== 'session_feedback' ||
  !progressionWitness || progressionWitness.kind !== 'future_progression_target') {
  throw new Error('feedback witnesses missing');
}
corruptedFeedback.sessionFeedback[feedbackWitness.date]!.outcomeReceipt!.sessionIdentity.workoutId =
  'corrupt-feedback-source';
const sourceWorkout = corruptedFeedback.program?.microcycles
  .flatMap((week) => week.workouts)
  .find((workout) => workout.id === progressionWitness.sourceWorkoutId);
const sourceExercise = sourceWorkout?.exercises.find((exercise) =>
  exercise.id === progressionWitness.sourceExerciseRowId);
if (!sourceExercise) throw new Error('feedback source exercise missing');
sourceExercise.prescribedSets += 1;
const feedbackFailures = failuresFor('feedback-progression-case', corruptedFeedback);
ok(
  'feedback witnesses reject source identity and baseline prescription corruption',
  feedbackFailures.some((failure) => failure.includes('feedback:')) &&
    feedbackFailures.some((failure) => failure.includes('future_progression_target')),
  feedbackFailures.join(', '),
);

const injurySeed = buildDevE2ESeed('injury-case');
const corruptedInjury = buildDevE2EWitnessState(injurySeed);
corruptedInjury.temporarySourceFacts = [];
corruptedInjury.injuryEpisodes = [];
corruptedInjury.activeConstraints = corruptedInjury.activeConstraints.map((constraint) => ({
  ...constraint,
  injuryEpisodeId: undefined,
}));
const injuryFailures = failuresFor('injury-case', corruptedInjury);
ok(
  'injury witness rejects a compatibility-only injury constraint',
  injuryFailures.some((failure) => failure.includes('injury:')),
  injuryFailures.join(', '),
);

const coachSeed = buildDevE2ESeed('coach-production-replay');
const corruptedCoach = buildDevE2EWitnessState(coachSeed);
if (!corruptedCoach.coachState) throw new Error('Coach state witness missing');
corruptedCoach.coachState.pendingProposal = { type: 'program_adjustment' };
const visibleWitness = coachSeed.witnesses.find((witness) =>
  witness.kind === 'visible_card_detail_equality');
if (!visibleWitness || visibleWitness.kind !== 'visible_card_detail_equality') {
  throw new Error('visible equality witness missing');
}
corruptedCoach.visibleDetailDays![visibleWitness.date] = {
  date: visibleWitness.date,
  workout: { id: 'corrupt-detail' },
};
const coachFailures = failuresFor('coach-production-replay', corruptedCoach);
ok(
  'Coach seed rejects pending proposal and card/detail divergence',
  coachFailures.some((failure) => failure.includes('coach_state:not_empty')) &&
    coachFailures.some((failure) => failure.includes('visible_equality')),
  coachFailures.join(', '),
);

const multiSeed = buildDevE2ESeed('multi-reload-fixture-chain');
const corruptedMulti = buildDevE2EWitnessState(multiSeed);
corruptedMulti.acceptedRevision = (corruptedMulti.acceptedRevision ?? 0) + 1;
const multiFailures = failuresFor('multi-reload-fixture-chain', corruptedMulti);
ok(
  'multi-reload seed rejects an inexact accepted revision',
  multiFailures.some((failure) => failure.includes('accepted_revision')),
  multiFailures.join(', '),
);


/* ── F8 (everyday acceptance, 2026-09-09): NO SEED DAY CARRIES AN EMPTY SESSION.
 * The R-130 optional Gunshow was placed on the day before the game whether or
 * not that day had gym kit; on a bodyweight day the arm pools filter to
 * nothing and the builder returned a named, optional, zero-exercise workout
 * that the phone showed as "Gunshow — Start optional session" with no rows.
 * `spent-week-friday` (Mon/Tue/Thu athlete, Saturday game) had it on every
 * Friday with no athlete action at all. A day with nothing in it is a rest
 * day, never an empty card. */
{
  const { DEV_E2E_SEED_IDS } = require('../dev/e2e/devE2ESeedIds') as { DEV_E2E_SEED_IDS: readonly string[] };
  const empties: string[] = [];
  for (const seedId of DEV_E2E_SEED_IDS) {
    const seed = buildDevE2ESeed(seedId as never);
    for (const microcycle of seed.program.microcycles) {
      for (const workout of microcycle.workouts) {
        const rows = workout.exercises?.length ?? 0;
        const composed = (workout as { composedOptionalKind?: string }).composedOptionalKind;
        const isSession = workout.workoutType !== 'Rest' && (workout.workoutType === 'Strength' || workout.workoutType === 'Mixed'
          || workout.workoutType === 'Mobility' || Boolean(composed) || workout.sessionTier === 'optional');
        if (isSession && rows === 0) empties.push(`${seedId}/${microcycle.id}/day${workout.dayOfWeek}:${workout.name}`);
      }
    }
  }
  ok('no dev seed carries a zero-exercise session (an empty composition is a rest day, not an empty card)',
    empties.length === 0, empties.join(' | '));
}

console.log(`\nDev E2E witnesses: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`  • ${failure}`));
  process.exit(1);
}
