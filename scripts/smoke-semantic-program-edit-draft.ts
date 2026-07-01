/**
 * Direct smoke check for the semantic ProgramEditDraft edge endpoint.
 *
 * Run:
 *   npm run smoke:semantic-program-edit-draft
 *
 * This does not mutate the program. It only verifies that the deployed edge
 * function is reachable and returns strict ProgramEditDraft JSON for a compact
 * visible-program context.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  LLMSemanticProgramEditDraftAdapter,
  semanticProgramEditDraftFunctionNameFromEndpoint,
} from '../src/utils/llmSemanticProgramEditDraftAdapter';
import {
  parseSemanticProgramEditDraftResponse,
} from '../src/utils/semanticProgramEditDraft';
import type { CoachTargetFrame } from '../src/utils/coachTargetFrame';
import type { ResolvedDay } from '../src/utils/sessionResolver';

type EnvMap = Record<string, string>;

const TODAY = '2026-07-01';
const TARGET_DATE = '2026-06-29';

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
    throw new Error(`${name} is required for semantic endpoint smoke test`);
  }
  return value.trim();
}

function buildEndpoint(envFile: EnvMap): string {
  const functionsBase = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL ??
    envFile.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL;
  if (functionsBase?.trim()) {
    return `${functionsBase.trim().replace(/\/+$/, '')}/coach-semantic-program-edit-draft`;
  }
  const supabaseUrl = getEnv('EXPO_PUBLIC_SUPABASE_URL', envFile).replace(/\/+$/, '');
  return `${supabaseUrl}/functions/v1/coach-semantic-program-edit-draft`;
}

function visibleWeek(): ResolvedDay[] {
  return [
    {
      date: TARGET_DATE,
      dayOfWeek: 1,
      short: 'MON',
      isToday: false,
      source: 'template',
      indicator: null,
      workout: {
        id: 'workout-mon-lower-strength',
        name: 'Lower Body Strength + Easy Aerobic Flush',
        workoutType: 'Strength',
        sessionTier: 'main',
        exercises: [
          {
            id: 'back-squat',
            exerciseId: 'back-squat',
            prescriptionType: 'sets_reps',
            prescribedSets: 4,
            prescribedRepsMin: 5,
            prescribedRepsMax: 5,
            exercise: { id: 'back-squat', name: 'Back Squat' },
          },
          {
            id: 'easy-flush-item',
            exerciseId: 'easy-flush-item',
            prescriptionType: 'duration',
            prescribedRepsMin: 25,
            prescribedRepsMax: 25,
            notes: '25 min zone 2 bike',
            exercise: { id: 'easy-flush-item', name: 'Easy Aerobic Flush' },
          },
        ],
        conditioningBlock: {
          options: [
            {
              title: 'Easy Aerobic Flush',
              description: '25 min zone 2 bike',
              exerciseIds: ['easy-flush-item'],
            },
          ],
        },
      },
    } as any,
    {
      date: '2026-07-06',
      dayOfWeek: 1,
      short: 'MON',
      isToday: false,
      source: 'template',
      indicator: null,
      workout: {
        id: 'workout-next-mon-lower-strength',
        name: 'Lower Body Strength + Easy Aerobic Flush',
        workoutType: 'Strength',
        sessionTier: 'main',
        exercises: [
          {
            id: 'next-back-squat',
            exerciseId: 'next-back-squat',
            prescriptionType: 'sets_reps',
            prescribedSets: 4,
            prescribedRepsMin: 5,
            prescribedRepsMax: 5,
            exercise: { id: 'next-back-squat', name: 'Back Squat' },
          },
          {
            id: 'next-easy-flush-item',
            exerciseId: 'next-easy-flush-item',
            prescriptionType: 'duration',
            prescribedRepsMin: 25,
            prescribedRepsMax: 25,
            notes: '25 min zone 2 bike',
            exercise: { id: 'next-easy-flush-item', name: 'Easy Aerobic Flush' },
          },
        ],
        conditioningBlock: {
          options: [
            {
              title: 'Easy Aerobic Flush',
              description: '25 min zone 2 bike',
              exerciseIds: ['next-easy-flush-item'],
            },
          ],
        },
      },
    } as any,
  ];
}

function targetFrame(): CoachTargetFrame {
  return {
    resolvedTarget: {
      kind: 'session',
      date: TARGET_DATE,
      sessionName: 'Lower Body Strength + Easy Aerobic Flush',
      itemId: 'workout-mon-lower-strength',
      domain: 'session',
      stillVisible: true,
    },
    confidence: 0.88,
    targetSource: 'explicit_message',
    missingFields: [],
    candidateOptions: [],
    reason: 'semantic_endpoint_smoke',
    explicitDateRole: 'referent',
  };
}

async function main() {
  const envFile = loadDotEnv(resolve(process.cwd(), '.env'));
  const endpoint = buildEndpoint(envFile);
  const authToken = getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', envFile);
  const adapter = new LLMSemanticProgramEditDraftAdapter({
    endpoint,
    authToken,
    timeoutMs: 20000,
  });
  const message = 'Can you drop the lower work Monday but keep the flush';
  const contextInput = {
    userMessage: message,
    targetFrame: targetFrame(),
    visibleWeek: visibleWeek(),
    todayISO: TODAY,
    nowISO: `${TODAY}T12:00:00.000Z`,
    timezone: 'Australia/Melbourne',
    currentProgramContext: { nextWeek: visibleWeek() },
  };

  console.log('[semantic-smoke] endpoint', endpoint);
  console.log('[semantic-smoke] functionName', semanticProgramEditDraftFunctionNameFromEndpoint(endpoint));

  const raw = await adapter.buildDraft(contextInput);
  const parsed = parseSemanticProgramEditDraftResponse({
    raw,
    targetFrame: contextInput.targetFrame,
    visibleWeek: contextInput.visibleWeek,
    minConfidence: 0.45,
  });

  if (parsed.kind !== 'draft') {
    if ('issues' in parsed) {
      console.error('[semantic-smoke] issues', parsed.issues.join(' | '));
    }
    if (process.env.SEMANTIC_SMOKE_PRINT_RAW === '1') {
      console.error('[semantic-smoke] raw', JSON.stringify(raw, null, 2).slice(0, 4000));
    }
    throw new Error(`semantic endpoint returned ${parsed.kind}: ${parsed.reason}`);
  }

  console.log('[semantic-smoke] status draft');
  console.log('[semantic-smoke] intent', parsed.draft.intent);
  console.log('[semantic-smoke] targetDomain', parsed.draft.targetDomain);
  console.log('[semantic-smoke] actionScope', parsed.draft.actionScope);
  console.log('[semantic-smoke] targetDate', parsed.draft.targetDate);
  console.log('[semantic-smoke] protectedTargets', parsed.draft.protectedTargets.map((target) =>
    `${target.targetDomain}:${target.title ?? target.actionScope}`,
  ).join(', '));
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[semantic-smoke] failed', message);
  process.exit(1);
});
