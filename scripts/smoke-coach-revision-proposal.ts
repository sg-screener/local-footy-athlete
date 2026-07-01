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

async function main() {
  const envFile = loadDotEnv(resolve(process.cwd(), '.env'));
  const endpoint = buildEndpoint(envFile);
  const authToken = getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', envFile);
  const visibleSnapshot = buildCoachRevisionWeekSnapshotFromProjectedDays(visibleWeek());
  const adapter = new LLMSemanticCoachRevisionProposalAdapter({
    endpoint,
    authToken,
    timeoutMs: 30000,
  });

  console.log('[coach-revision-smoke] endpoint', endpoint);
  console.log('[coach-revision-smoke] functionName', coachRevisionProposalFunctionNameFromEndpoint(endpoint));

  const result = await buildSemanticCoachRevisionProposal({
    userMessage: 'Can you drop the lower work Monday but keep the flush',
    visibleSnapshot,
    adapter,
    todayISO: TODAY,
    nowISO: `${TODAY}T12:00:00.000Z`,
    timezone: 'Australia/Melbourne',
  });

  console.log('[coach-revision-smoke] result', result.kind);
  console.log('[coach-revision-smoke] diagnostic', JSON.stringify(result.diagnostic, null, 2));

  if (result.kind !== 'revision' && result.kind !== 'needs_confirmation') {
    if (result.kind === 'invalid') {
      console.error('[coach-revision-smoke] issues', result.issues.join(' | '));
    }
    throw new Error(`coach revision endpoint returned ${result.kind}`);
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[coach-revision-smoke] failed', message);
  process.exit(1);
});
