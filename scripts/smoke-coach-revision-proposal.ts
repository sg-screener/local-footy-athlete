/**
 * Direct smoke check for the CoachRevisionProposal edge endpoint.
 *
 * Run:
 *   npm run smoke:coach-revision-proposal
 *
 * This does not mutate the program. It only verifies that the deployed edge
 * function is reachable and returns strict CoachRevisionProposal JSON that can
 * be diffed and validated against a compact visible-program snapshot.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { Workout } from '../src/types/domain';
import type { ResolvedDay } from '../src/utils/sessionResolver';
import {
  buildCoachRevisionWeekSnapshotFromProjectedDays,
} from '../src/utils/coachRevisionProposal';
import {
  LLMSemanticCoachRevisionProposalAdapter,
  coachRevisionProposalFunctionNameFromEndpoint,
} from '../src/utils/llmSemanticCoachRevisionProposalAdapter';
import {
  buildSemanticCoachRevisionProposal,
} from '../src/utils/semanticCoachRevisionProposal';

type EnvMap = Record<string, string>;

const TODAY = '2026-07-01';
const TARGET_DATE = '2026-07-06';

function loadDotEnv(path: string): EnvMap {
  if (!existsSync(path)) return {};
  const env: EnvMap = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function getEnv(name: string, envFile: EnvMap): string {
  const value = process.env[name] ?? envFile[name] ?? '';
  if (!value.trim()) {
    throw new Error(`${name} is required for coach revision proposal smoke test`);
  }
  return value.trim();
}

function buildEndpoint(envFile: EnvMap): string {
  const functionsBase = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL ??
    envFile.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL;
  if (functionsBase?.trim()) {
    return `${functionsBase.trim().replace(/\/+$/, '')}/coach-revision-proposal`;
  }
  const supabaseUrl = getEnv('EXPO_PUBLIC_SUPABASE_URL', envFile).replace(/\/+$/, '');
  return `${supabaseUrl}/functions/v1/coach-revision-proposal`;
}

function ex(name: string, id: string, sets: number): any {
  return {
    id,
    workoutId: 'workout-next-mon-lower-strength',
    exerciseId: id,
    exerciseOrder: 0,
    prescribedSets: sets,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    restSeconds: 120,
    exercise: { id, name },
  };
}

function workout(): Workout {
  return {
    id: 'workout-next-mon-lower-strength',
    microcycleId: 'mc',
    dayOfWeek: 1,
    name: 'Lower Body Strength',
    description: '',
    durationMinutes: 75,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    conditioningCategory: 'aerobic_base',
    conditioningBlock: {
      intent: 'aerobic',
      options: [{
        title: 'Easy Aerobic Flush',
        description: '25min zone 2 bike',
        exerciseIds: ['next-easy-flush-item'],
      }],
    },
    exercises: [
      ex('Back Squat', 'next-back-squat', 4),
      ex('Romanian Deadlift', 'next-rdl', 3),
      {
        ...ex('Easy Aerobic Flush', 'next-easy-flush-item', 1),
        prescriptionType: 'duration_minutes',
        prescribedRepsMin: 25,
        prescribedRepsMax: 25,
        notes: '25min zone 2 bike',
      },
    ],
    createdAt: '',
    updatedAt: '',
  };
}

function visibleWeek(): ResolvedDay[] {
  return [{
    date: TARGET_DATE,
    dayOfWeek: 1,
    short: 'MON',
    isToday: false,
    source: 'template',
    indicator: null,
    workout: workout(),
  } as any];
}

function bigWorkout(args: {
  id: string;
  dayOfWeek: number;
  name: string;
  workoutType: string;
  exerciseNames: string[];
  withConditioning?: boolean;
}): Workout {
  const conditioningId = `${args.id}-flush`;
  const exercises = args.exerciseNames.map((name, index) => ({
    ...ex(name, `${args.id}-ex-${index}`, 4),
    workoutId: args.id,
    exerciseOrder: index,
    notes: `Cue ${index + 1}: controlled tempo, leave 1-2 reps in reserve, full rest between sets.`,
  }));
  if (args.withConditioning) {
    exercises.push({
      ...ex('Easy Aerobic Flush', conditioningId, 1),
      workoutId: args.id,
      prescriptionType: 'duration_minutes',
      prescribedRepsMin: 25,
      prescribedRepsMax: 25,
      notes: '25min zone 2 bike, nasal breathing, conversational pace throughout.',
    });
  }
  return {
    ...workout(),
    id: args.id,
    dayOfWeek: args.dayOfWeek,
    name: args.name,
    workoutType: args.workoutType,
    hasCombinedConditioning: !!args.withConditioning,
    conditioningBlock: args.withConditioning
      ? {
          intent: 'aerobic',
          options: [{
            title: 'Easy Aerobic Flush',
            description: '25min zone 2 bike',
            exerciseIds: [conditioningId],
          }],
        }
      : undefined,
    exercises,
  } as Workout;
}

/** App-scale snapshot mirroring a real generated program week: 5 workouts,
 *  6 exercises each with notes. The toy single-day scenario missed failures
 *  that only appear at real payload/echo size (e.g. output truncation). */
function appScaleWeek(): ResolvedDay[] {
  const days: Array<{ date: string; dayOfWeek: number; short: string; workout: Workout | null }> = [
    {
      date: '2026-07-06', dayOfWeek: 1, short: 'MON',
      workout: bigWorkout({
        id: 'workout-mon-lower', dayOfWeek: 1, name: 'Lower Body Strength', workoutType: 'Strength',
        exerciseNames: ['Box Squat', 'Single Leg RDL', 'Nordic Lowers', 'Copenhagen Plank', 'Tib Raises'],
        withConditioning: true,
      }),
    },
    {
      date: '2026-07-07', dayOfWeek: 2, short: 'TUE',
      workout: bigWorkout({
        id: 'workout-tue-team', dayOfWeek: 2, name: 'Team Training + Upper Pull', workoutType: 'Team Training',
        exerciseNames: ['Weighted Chin Up', 'Chest Supported Row', 'Face Pull', 'Hammer Curl'],
      }),
    },
    { date: '2026-07-08', dayOfWeek: 3, short: 'WED',
      workout: bigWorkout({
        id: 'workout-wed-flush', dayOfWeek: 3, name: 'Aerobic Flush + Trunk Prehab', workoutType: 'Conditioning',
        exerciseNames: ['Zone 2 Bike', 'Pallof Press', 'Side Plank'],
      }),
    },
    {
      date: '2026-07-09', dayOfWeek: 4, short: 'THU',
      workout: bigWorkout({
        id: 'workout-thu-team', dayOfWeek: 4, name: 'Team Training + Upper Push', workoutType: 'Team Training',
        exerciseNames: ['Incline DB Press', 'Half Kneeling Landmine Press', 'Dips', 'Lateral Raise'],
      }),
    },
    {
      date: '2026-07-10', dayOfWeek: 5, short: 'FRI',
      workout: bigWorkout({
        id: 'workout-fri-arms', dayOfWeek: 5, name: 'Upper Arms Pump', workoutType: 'Strength',
        exerciseNames: ['EZ Bar Curl', 'Rope Pushdown', 'Incline Curl', 'Overhead Extension'],
      }),
    },
  ];
  return days.map((day) => ({
    ...day,
    isToday: false,
    source: 'template',
    indicator: null,
  })) as any;
}

async function runScenario(args: {
  name: string;
  adapter: LLMSemanticCoachRevisionProposalAdapter;
  days: ResolvedDay[];
  message: string;
}) {
  const result = await buildSemanticCoachRevisionProposal({
    userMessage: args.message,
    visibleSnapshot: buildCoachRevisionWeekSnapshotFromProjectedDays(args.days),
    adapter: args.adapter,
    todayISO: TODAY,
    nowISO: `${TODAY}T12:00:00.000Z`,
    timezone: 'Australia/Melbourne',
  });

  console.log(`[coach-revision-smoke] [${args.name}] result`, result.kind);
  console.log(
    `[coach-revision-smoke] [${args.name}] diagnostic`,
    JSON.stringify(result.diagnostic, null, 2),
  );

  // POST 200 + schema-valid proof: 'revision'/'needs_confirmation' means the
  // full diff validation pipeline accepted the proposal; 'clarify' is a
  // schema-valid clarification and still proves endpoint + schema + parsing.
  // 'invalid' (adapter_failed / schema_validation_failed / diff failure) fails.
  if (result.kind === 'clarify') {
    console.log(`[coach-revision-smoke] [${args.name}] clarify reply`, result.reply);
    console.log(`[coach-revision-smoke] [${args.name}] endpoint reachable and schema-valid (clarification path)`);
    return;
  }
  if (result.kind !== 'revision' && result.kind !== 'needs_confirmation') {
    if (result.kind === 'invalid') {
      console.error(`[coach-revision-smoke] [${args.name}] issues`, result.issues.join(' | '));
    }
    throw new Error(`[${args.name}] coach revision endpoint returned ${result.kind}`);
  }
  console.log(
    `[coach-revision-smoke] [${args.name}] validatorStatus`,
    result.kind === 'revision' ? 'valid' : 'needs_confirmation',
  );
}

async function main() {
  const envFile = loadDotEnv(resolve(process.cwd(), '.env'));
  const endpoint = buildEndpoint(envFile);
  const authToken = getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', envFile);
  const adapter = new LLMSemanticCoachRevisionProposalAdapter({
    endpoint,
    authToken,
    timeoutMs: 45000,
  });

  console.log('[coach-revision-smoke] endpoint', endpoint);
  console.log('[coach-revision-smoke] functionName', coachRevisionProposalFunctionNameFromEndpoint(endpoint));

  // Deployment proof, independent of LLM behavior: the function answers
  // OPTIONS with 204 (CORS preflight). A 404 here means the function is not
  // deployed or the base URL is wrong -- stop and fix wiring, not app logic.
  const preflight = await fetch(endpoint, { method: 'OPTIONS' });
  console.log('[coach-revision-smoke] OPTIONS status', preflight.status);
  if (preflight.status !== 204) {
    throw new Error(
      `expected OPTIONS 204 from ${endpoint}, got ${preflight.status} - ` +
        'function not deployed or wrong base URL',
    );
  }

  // Scenario 1: minimal single-day snapshot (fast wiring proof).
  await runScenario({
    name: 'single-day',
    adapter,
    days: visibleWeek(),
    message: 'Can you drop the lower work Monday but keep the flush',
  });

  // Scenario 2: app-scale week. This is what the live app actually sends;
  // it catches payload-size failures (e.g. truncated model output) that the
  // toy scenario cannot.
  await runScenario({
    name: 'app-scale-week',
    adapter,
    days: appScaleWeek(),
    message: 'Can you drop the lower work Monday but keep the flush',
  });
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[coach-revision-smoke] failed', message);
  process.exit(1);
});
