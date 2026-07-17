import { deriveFutureProgressionRenderTarget } from '../utils/sessionFeedbackRenderWitness';

const program = {
  id: 'program-1',
  microcycles: [
    {
      startDate: '2026-07-13',
      endDate: '2026-07-19',
      workouts: [{
        id: 'session-source',
        planEntryId: 'entry-strength',
        dayOfWeek: 1,
        exercises: [{
          id: 'row-source',
          exerciseId: 'exercise-squat',
          prescribedSets: 3,
          exercise: { id: 'exercise-squat', name: 'Back Squat' },
        }],
      }],
    },
    {
      startDate: '2026-07-20',
      endDate: '2026-07-26',
      workouts: [{
        id: 'session-target',
        planEntryId: 'entry-strength-next',
        dayOfWeek: 1,
        exercises: [{
          id: 'row-target',
          exerciseId: 'exercise-squat',
          prescribedSets: 4,
          exercise: { id: 'exercise-squat', name: 'Back Squat' },
        }],
      }],
    },
  ],
} as any;

const receipt = {
  transactionId: 'feedback-transaction-1',
  date: '2026-07-13',
  sessionIdentity: {
    workoutId: 'session-source',
    planEntryId: 'entry-strength',
  },
} as any;

const target = deriveFutureProgressionRenderTarget({ program, receipt });
if (!target ||
  target.sourceSessionId !== 'session-source' ||
  target.sourceExerciseId !== 'exercise-squat' ||
  target.targetDate !== '2026-07-20' ||
  target.targetSessionId !== 'session-target' ||
  target.targetExerciseId !== 'exercise-squat') {
  console.error('  ✗ feedback receipt did not resolve the exact future programmed target', target);
  process.exit(1);
}
console.log('  ✓ feedback receipt resolves the exact future programmed target');

const missing = deriveFutureProgressionRenderTarget({
  program,
  receipt: {
    ...receipt,
    sessionIdentity: { workoutId: 'missing-session', planEntryId: null },
  },
});
if (missing !== null) {
  console.error('  ✗ missing source session must not guess a future target', missing);
  process.exit(1);
}
console.log('  ✓ missing source session does not guess a progression target');

