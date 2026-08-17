/**
 * DAY-PLACEMENT PROBE — is the "week SHAPE is untouched" red an identity change
 * or a DAY change?
 *
 * The assertion it belongs to keys rows by `week:workoutName:EXERCISE NAME`, so a
 * pure exercise rotation reddens it even though its label says "same sessions on
 * the same days". This probe separates the two: it compares the day/session
 * skeleton with the exercise names REMOVED, against the same control the suite
 * uses. If the skeletons match, no day moved and the red is identity only.
 *
 * Run: npx sucrase-node scripts/probe-day-shape.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import { generateProgramLocally } from '../src/services/api/generateProgram';
import { fullKitEquipmentAnswer } from '../src/__tests__/support/equipmentAnswerFixture';
import type { SessionFeedback } from '../src/store/programStore';
import type { OnboardingData, TrainingProgram } from '../src/types/domain';

function athlete(): OnboardingData {
  return {
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    equipmentAnswer: fullKitEquipmentAnswer(),
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: 'Intermediate',
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    weightKg: 85,
  } as unknown as OnboardingData;
}

const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];

function feedback(completedDates: readonly string[]): Record<string, SessionFeedback> {
  // The suite's OWN fixture shape — `dateStr` and the strength log the real
  // materialiser reads. A hand-shortened one throws inside `sessionResolver`.
  const out: Record<string, SessionFeedback> = {};
  for (const dateStr of BLOCK_1_DATES) {
    const done = completedDates.includes(dateStr);
    out[dateStr] = {
      dateStr,
      completion: done ? 'full' : 'skipped',
      feeling: 'good',
      soreness: 'mild',
      strength: done ? [{
        exerciseId: 'ex-0', workoutExerciseId: 'wex-0',
        exerciseName: 'Deadlift', prescribedSets: 4,
        prescribedRepsMin: 5, prescribedRepsMax: 5,
        weightKg: 100, completion: 'full' as const,
      }] : [],
    } as unknown as SessionFeedback;
  }
  return out;
}

function build(fb: Record<string, SessionFeedback>): TrainingProgram {
  return generateProgramLocally(athlete(), {
    todayISO: '2026-08-03',
    blockNumber: 2,
    progressionHistory: { sessionFeedback: fb, weightOverrides: {}, blockState: null },
  });
}

/** The DAY SKELETON — week, weekday, session name and type. NO exercise names. */
function skeleton(program: TrainingProgram): string[] {
  const out: string[] = [];
  for (const [wi, mc] of program.microcycles.entries()) {
    for (const w of (mc as unknown as { workouts: Record<string, unknown>[] }).workouts) {
      out.push(`w${wi + 1}:day${w.dayOfWeek}:${w.name}:${w.workoutType}`);
    }
  }
  return out.sort();
}

/** Row COUNT per day — a day that gained or lost work without moving. */
function rowCounts(program: TrainingProgram): string[] {
  const out: string[] = [];
  for (const [wi, mc] of program.microcycles.entries()) {
    for (const w of (mc as unknown as { workouts: Record<string, unknown>[] }).workouts) {
      const rows = (w.exercises as unknown[] | undefined)?.length ?? 0;
      out.push(`w${wi + 1}:day${w.dayOfWeek}:${rows}`);
    }
  }
  return out.sort();
}

const wellRecovered = build(feedback(BLOCK_1_DATES));
const missed = build(feedback(BLOCK_1_DATES.slice(0, 6)));

const skelGood = skeleton(wellRecovered);
const skelMissed = skeleton(missed);
const countsGood = rowCounts(wellRecovered);
const countsMissed = rowCounts(missed);

console.log('\n=== DAY SKELETON (no exercise names) ===');
console.log('well-recovered sessions:', skelGood.length);
console.log('missed-block sessions:  ', skelMissed.length);
console.log('SKELETONS IDENTICAL:', JSON.stringify(skelGood) === JSON.stringify(skelMissed));
if (JSON.stringify(skelGood) !== JSON.stringify(skelMissed)) {
  const onlyGood = skelGood.filter((s) => !skelMissed.includes(s));
  const onlyMissed = skelMissed.filter((s) => !skelGood.includes(s));
  console.log('  only in well-recovered:', onlyGood);
  console.log('  only in missed-block:  ', onlyMissed);
}

console.log('\n=== ROWS PER DAY ===');
console.log('ROW COUNTS IDENTICAL:', JSON.stringify(countsGood) === JSON.stringify(countsMissed));
if (JSON.stringify(countsGood) !== JSON.stringify(countsMissed)) {
  for (let i = 0; i < Math.max(countsGood.length, countsMissed.length); i++) {
    if (countsGood[i] !== countsMissed[i]) {
      console.log(`  ${countsGood[i]}  vs  ${countsMissed[i]}`);
    }
  }
}

console.log('\n=== WHICH EXERCISES DIFFER (the identity change) ===');
function names(program: TrainingProgram): Set<string> {
  const out = new Set<string>();
  for (const mc of program.microcycles) {
    for (const w of mc.workouts) {
      for (const e of w.exercises ?? []) out.add(e.exercise?.name ?? String(e.exerciseId));
    }
  }
  return out;
}
const nGood = names(wellRecovered);
const nMissed = names(missed);
console.log('only well-recovered:', [...nGood].filter((n) => !nMissed.has(n)));
console.log('only missed-block:  ', [...nMissed].filter((n) => !nGood.has(n)));
