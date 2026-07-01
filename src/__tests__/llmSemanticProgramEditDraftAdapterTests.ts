/**
 * llmSemanticProgramEditDraftAdapterTests — Stage 3D-3B real adapter
 * request/response contract.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/llmSemanticProgramEditDraftAdapterTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  LLMSemanticProgramEditDraftAdapter,
  SEMANTIC_PROGRAM_EDIT_DRAFT_SYSTEM_PROMPT,
  buildSemanticProgramEditDraftLLMContext,
} from '../utils/llmSemanticProgramEditDraftAdapter';
import type { CoachTargetFrame } from '../utils/coachTargetFrame';
import type { ProgramEditDraft } from '../utils/coachProgramEditDraft';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA,
  SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
  buildSemanticProgramEditDraft,
} from '../utils/semanticProgramEditDraft';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    const suffix = detail == null ? '' : `\n    ${typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)}`;
    failures.push(`${name}${suffix}`);
    console.log(`  FAIL ${name}${suffix}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

const TODAY = '2026-06-24';
const TOMORROW = '2026-06-25';

function workout(): any {
  return {
    id: 'workout-lower-strength',
    name: 'Lower Body Strength',
    workoutType: 'Strength',
    sessionTier: 'main',
    privateHeavyField: 'must-not-leak-to-semantic-context',
    exercises: [
      {
        id: 'back-squat',
        exerciseId: 'back-squat',
        prescriptionType: 'sets_reps',
        prescribedSets: 4,
        prescribedRepsMin: 5,
        exercise: { id: 'back-squat', name: 'Back Squat', unused: 'heavy' },
      },
      {
        id: 'easy-flush-item',
        exerciseId: 'easy-flush-item',
        prescriptionType: 'duration',
        prescribedRepsMin: 25,
        prescribedRepsMax: 25,
        exercise: { id: 'easy-flush-item', name: 'Easy Aerobic Flush' },
        notes: '25 min easy rower',
      },
    ],
    conditioningBlock: {
      options: [
        {
          title: 'Easy Aerobic Flush',
          description: '25 min easy rower',
          exerciseIds: ['easy-flush-item'],
        },
      ],
    },
  };
}

function visibleWeek(): ResolvedDay[] {
  return [
    {
      date: TODAY,
      dayOfWeek: 3,
      short: 'WED',
      isToday: true,
      workout: null,
      source: 'rest',
      indicator: null,
    } as any,
    {
      date: TOMORROW,
      dayOfWeek: 4,
      short: 'THU',
      isToday: false,
      workout: workout(),
      source: 'template',
      indicator: null,
    } as any,
  ];
}

function targetFrame(): CoachTargetFrame {
  return {
    resolvedTarget: {
      kind: 'session',
      date: TOMORROW,
      sessionName: 'Lower Body Strength',
      itemId: 'workout-lower-strength',
      domain: 'session',
      stillVisible: true,
    },
    confidence: 0.88,
    targetSource: 'explicit_message',
    missingFields: [],
    candidateOptions: [],
    reason: 'test_target_frame',
    explicitDateRole: 'referent',
  };
}

function draft(): ProgramEditDraft {
  const sourceTarget = targetFrame().resolvedTarget;
  return {
    intent: 'remove',
    targetDomain: 'strength',
    actionScope: 'strength_block',
    targetDate: TOMORROW,
    targetSessionId: 'workout-lower-strength',
    targetItemId: null,
    sourceTarget,
    explicitDateRole: 'referent',
    explicitUserWording: 'Drop the lower work but keep the flush',
    missingFields: [],
    confidence: 0.9,
    protectedTargets: [
      {
        targetDomain: 'conditioning',
        actionScope: 'conditioning_block',
        targetDate: TOMORROW,
        targetItemId: 'easy-flush-item',
        title: 'Easy Aerobic Flush',
        reason: 'keep_flush',
      },
    ],
    constraints: ['keep conditioning'],
    proposedActions: [
      {
        intent: 'remove',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate: TOMORROW,
        targetSessionId: 'workout-lower-strength',
        targetItemId: null,
        sourceTarget,
        reason: 'remove_lower_strength',
      },
    ],
    verifierExpectations: [
      {
        kind: 'domain_changed',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate: TOMORROW,
        reason: 'remove_strength',
      },
      {
        kind: 'domain_unchanged',
        targetDomain: 'conditioning',
        actionScope: 'conditioning_block',
        targetDate: TOMORROW,
        reason: 'keep_conditioning',
      },
    ],
    isCompound: false,
    reason: 'semantic_adapter_test',
  };
}

function semanticResponse() {
  return {
    schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
    status: 'draft',
    confidence: 0.9,
    draft: draft(),
    reason: 'semantic_adapter_test',
  };
}

async function run() {
  console.log('llmSemanticProgramEditDraftAdapterTests');

  {
    const context = buildSemanticProgramEditDraftLLMContext({
      userMessage: 'Drop the lower work but keep the flush',
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
      todayISO: TODAY,
      nowISO: `${TODAY}T12:00:00.000Z`,
      timezone: 'Australia/Melbourne',
      currentProgramContext: { nextWeek: visibleWeek() },
    });
    eq('[1] context carries schema version', context.schemaVersion, SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION);
    eq('[1] context carries today', context.todayISO, TODAY);
    eq('[1] context carries timezone', context.timezone, 'Australia/Melbourne');
    ok('[1] context summarizes visible items',
      context.visibleCandidates.some((candidate) =>
        candidate.kind === 'item' &&
        candidate.label === 'Easy Aerobic Flush' &&
        candidate.itemId === 'easy-flush-item',
      ),
      context.visibleCandidates);
    ok('[1] context does not include arbitrary full workout fields',
      !JSON.stringify(context).includes('must-not-leak-to-semantic-context'),
      context);
  }

  {
    const calls: Array<{ url: string; init: RequestInit; body: any }> = [];
    const adapter = new LLMSemanticProgramEditDraftAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-semantic-program-edit-draft',
      authToken: 'anon-key',
      fetcher: (async (url: string, init: RequestInit) => {
        calls.push({ url, init, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify(semanticResponse()), { status: 200 });
      }) as typeof fetch,
    });
    const raw = await adapter.buildDraft({
      userMessage: 'Drop the lower work but keep the flush',
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
      todayISO: TODAY,
      nowISO: `${TODAY}T12:00:00.000Z`,
      timezone: 'Australia/Melbourne',
    });

    eq('[2] adapter posts once', calls.length, 1);
    eq('[2] adapter uses configured endpoint', calls[0].url, 'https://edge.example.com/functions/v1/coach-semantic-program-edit-draft');
    ok('[2] adapter sends auth headers',
      (calls[0].init.headers as Record<string, string>).Authorization === 'Bearer anon-key' &&
        (calls[0].init.headers as Record<string, string>).apikey === 'anon-key',
      calls[0].init.headers);
    ok('[2] adapter requests JSON-only parser contract',
      calls[0].body.systemPrompt === SEMANTIC_PROGRAM_EDIT_DRAFT_SYSTEM_PROMPT &&
        /Return JSON only/i.test(calls[0].body.systemPrompt) &&
        calls[0].body.schema.schemaVersion === SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.schemaVersion,
      calls[0].body);
    ok('[2] adapter sends compact context',
      calls[0].body.context.todayISO === TODAY &&
        calls[0].body.context.visibleWeek.length === 2 &&
        !JSON.stringify(calls[0].body.context).includes('must-not-leak-to-semantic-context'),
      calls[0].body.context);
    ok('[2] adapter returns raw JSON for validator',
      (raw as any).schemaVersion === SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION &&
        (raw as any).status === 'draft',
      raw);
  }

  {
    const adapter = new LLMSemanticProgramEditDraftAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-semantic-program-edit-draft',
      fetcher: (async () => new Response('upstream down', { status: 502 })) as typeof fetch,
    });
    let threw = false;
    try {
      await adapter.buildDraft({
        userMessage: 'remove conditioning today',
        targetFrame: targetFrame(),
        visibleWeek: visibleWeek(),
      });
    } catch (_err) {
      threw = true;
    }
    ok('[3] HTTP failure throws for parser safety wrapper to catch', threw);
  }

  {
    const adapter = new LLMSemanticProgramEditDraftAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-semantic-program-edit-draft',
      fetcher: (async () => {
        throw new Error('network offline');
      }) as typeof fetch,
    });
    const result = await buildSemanticProgramEditDraft({
      userMessage: 'remove conditioning today',
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
      adapter,
    });
    ok('[4] adapter/network failure is converted to invalid parser result',
      result.kind === 'invalid' && result.reason === 'adapter_failed',
      result);
  }

  {
    const adapter = new LLMSemanticProgramEditDraftAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-semantic-program-edit-draft',
      fetcher: (async () => new Response(JSON.stringify(semanticResponse()), { status: 200 })) as typeof fetch,
    });
    const result = await buildSemanticProgramEditDraft({
      userMessage: 'Drop the lower work but keep the flush',
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
      adapter,
      todayISO: TODAY,
      nowISO: `${TODAY}T12:00:00.000Z`,
      timezone: 'Australia/Melbourne',
    });
    ok('[5] real adapter output still passes strict ProgramEditDraft validation',
      result.kind === 'draft' &&
        result.draft.targetDomain === 'strength' &&
        result.draft.protectedTargets[0]?.targetDomain === 'conditioning',
      result);
  }
}

run()
  .then(() => {
    console.log(`\n- Summary -`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    if (fail > 0) {
      console.log(`\n- Failures -`);
      for (const f of failures) console.log(`  - ${f}`);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    fail++;
    const detail = err instanceof Error ? err.stack ?? err.message : String(err);
    failures.push(`test runner threw\n      ${detail}`);
    console.log(`\n- Summary -`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    console.log(`\n- Failures -`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  });
