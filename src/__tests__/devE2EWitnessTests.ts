import {
  buildDevE2ESeed,
  validateDevE2EWitnesses,
  type DevE2EWitnessState,
} from '../dev/e2e/devE2ESeedRegistry';
import { buildDevE2EWitnessState } from './devE2ESeedTestSupport';

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
  workout.id === 'dev-e2e-stacked-team-upper-pull');
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

console.log(`\nDev E2E witnesses: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`  • ${failure}`));
  process.exit(1);
}
