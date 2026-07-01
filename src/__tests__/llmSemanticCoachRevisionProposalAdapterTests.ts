/**
 * llmSemanticCoachRevisionProposalAdapterTests — Stage 4A-2 transport
 * contract for the CoachRevisionProposal semantic endpoint.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/llmSemanticCoachRevisionProposalAdapterTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  COACH_REVISION_PROPOSAL_SCHEMA,
  COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  buildCoachRevisionWeekSnapshotFromProjectedDays,
} from '../utils/coachRevisionProposal';
import {
  COACH_REVISION_PROPOSAL_FUNCTION_NAME,
  COACH_REVISION_PROPOSAL_SYSTEM_PROMPT,
  LLMSemanticCoachRevisionProposalAdapter,
  buildCoachRevisionProposalLLMContext,
  coachRevisionProposalFunctionNameFromEndpoint,
} from '../utils/llmSemanticCoachRevisionProposalAdapter';
import {
  buildSemanticCoachRevisionProposal,
} from '../utils/semanticCoachRevisionProposal';

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

const MON = '2026-07-06';

function workout(): Workout {
  return {
    id: 'workout-lower-strength',
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
        description: '25 min zone 2 bike',
        exerciseIds: ['easy-flush-item'],
      }],
    },
    privateHeavyField: 'must-not-leak' as any,
    exercises: [
      {
        id: 'back-squat',
        workoutId: 'workout-lower-strength',
        exerciseId: 'back-squat',
        exerciseOrder: 0,
        prescribedSets: 4,
        prescribedRepsMin: 5,
        prescribedRepsMax: 5,
        restSeconds: 120,
        exercise: { id: 'back-squat', name: 'Back Squat' },
      } as any,
      {
        id: 'easy-flush-item',
        workoutId: 'workout-lower-strength',
        exerciseId: 'easy-flush-item',
        exerciseOrder: 1,
        prescribedSets: 1,
        prescribedRepsMin: 25,
        prescribedRepsMax: 25,
        prescriptionType: 'duration_minutes',
        restSeconds: 0,
        notes: '25 min zone 2 bike',
        exercise: { id: 'easy-flush-item', name: 'Easy Aerobic Flush' },
      } as any,
    ],
    createdAt: '',
    updatedAt: '',
  };
}

function visibleWeek(): ResolvedDay[] {
  return [{
    date: MON,
    dayOfWeek: 1,
    short: 'MON',
    isToday: false,
    source: 'template',
    indicator: null,
    workout: workout(),
  } as any];
}

function visibleSnapshot() {
  return buildCoachRevisionWeekSnapshotFromProjectedDays(visibleWeek());
}

function semanticRevisionResponse() {
  const before = visibleSnapshot();
  const monday = before.days[0];
  const conditioning = monday.workout!.sections.find((section) => section.kind === 'conditioning')!;
  return {
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    kind: 'revision',
    source: 'semantic',
    confidence: 0.91,
    userIntent: {
      intent: 'remove',
      targetDomain: 'strength',
      actionScope: 'strength_section',
      targetDates: [MON],
      protectedRefs: [conditioning.id],
      reason: 'remove_strength_keep_conditioning',
    },
    scope: { mode: 'single_day', dates: [MON] },
    revisedDays: [{
      date: MON,
      workout: {
        ...monday.workout!,
        title: conditioning.title,
        workoutType: 'Conditioning',
        sections: [conditioning],
      },
    }],
    explanation: 'remove_strength_keep_conditioning',
  };
}

async function run() {
  console.log('llmSemanticCoachRevisionProposalAdapterTests');

  eq(
    '[0] function name is stable',
    COACH_REVISION_PROPOSAL_FUNCTION_NAME,
    'coach-revision-proposal',
  );
  eq(
    '[0] function name is derived from endpoint',
    coachRevisionProposalFunctionNameFromEndpoint('https://x.supabase.co/functions/v1/coach-revision-proposal'),
    'coach-revision-proposal',
  );

  {
    const context = buildCoachRevisionProposalLLMContext({
      userMessage: 'Drop lower work Monday but keep the flush',
      visibleSnapshot: visibleSnapshot(),
      todayISO: '2026-07-01',
      nowISO: '2026-07-01T12:00:00.000Z',
      timezone: 'Australia/Melbourne',
      recentContext: { selectedDate: MON },
    });
    eq('[1] context carries schema', context.schemaVersion, COACH_REVISION_PROPOSAL_SCHEMA_VERSION);
    ok('[1] context sends exact visible snapshot', context.visibleSnapshot.days[0].workout?.sections.some((section) => section.kind === 'conditioning'), context);
    ok('[1] context excludes raw private workout fields', !JSON.stringify(context).includes('must-not-leak'), context);
    ok('[1] context exposes stable candidates', context.visibleCandidates.some((candidate) => candidate.kind === 'section' && candidate.domain === 'conditioning'), context.visibleCandidates);
  }

  {
    const calls: Array<{ url: string; init: RequestInit; body: any }> = [];
    const adapter = new LLMSemanticCoachRevisionProposalAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-revision-proposal',
      authToken: 'anon-key',
      fetcher: (async (url: string, init: RequestInit) => {
        calls.push({ url, init, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify(semanticRevisionResponse()), { status: 200 });
      }) as typeof fetch,
    });
    const raw = await adapter.buildProposal({
      userMessage: 'Drop lower work Monday but keep the flush',
      visibleSnapshot: visibleSnapshot(),
      todayISO: '2026-07-01',
    });

    eq('[2] adapter posts once', calls.length, 1);
    eq('[2] adapter uses endpoint', calls[0].url, 'https://edge.example.com/functions/v1/coach-revision-proposal');
    ok('[2] adapter sends auth headers',
      (calls[0].init.headers as Record<string, string>).Authorization === 'Bearer anon-key' &&
        (calls[0].init.headers as Record<string, string>).apikey === 'anon-key',
      calls[0].init.headers);
    ok('[2] prompt asks for revised visible state, not commands',
      calls[0].body.systemPrompt === COACH_REVISION_PROPOSAL_SYSTEM_PROMPT &&
        /revised visible day\/week snapshot/i.test(calls[0].body.systemPrompt) &&
        /not a command/i.test(calls[0].body.systemPrompt) &&
        /Preserve stable ids/i.test(calls[0].body.systemPrompt) &&
        /Never claim success/i.test(calls[0].body.systemPrompt),
      calls[0].body.systemPrompt);
    ok('[2] schema sent to endpoint',
      calls[0].body.schema.schemaVersion === COACH_REVISION_PROPOSAL_SCHEMA.schemaVersion,
      calls[0].body.schema);
    ok('[2] adapter returns raw JSON for validator',
      (raw as any).schemaVersion === COACH_REVISION_PROPOSAL_SCHEMA_VERSION &&
        (raw as any).kind === 'revision',
      raw);
  }

  {
    const adapter = new LLMSemanticCoachRevisionProposalAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-revision-proposal',
      fetcher: (async () => new Response('missing', { status: 404 })) as typeof fetch,
    });
    const result = await buildSemanticCoachRevisionProposal({
      userMessage: 'remove conditioning Monday',
      visibleSnapshot: visibleSnapshot(),
      adapter,
    });
    ok('[3] endpoint failure becomes invalid and does not mutate',
      result.kind === 'invalid' && result.reason === 'adapter_failed',
      result);
    ok('[3] issue carries HTTP status for fail-loud messaging',
      result.kind === 'invalid' && result.issues.some((entry) => entry.includes('HTTP 404')),
      result.kind === 'invalid' ? result.issues : result);
  }

  {
    // Timeout: the adapter aborts after timeoutMs; the mock fetch respects
    // the abort signal like the real fetch does.
    const adapter = new LLMSemanticCoachRevisionProposalAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-revision-proposal',
      timeoutMs: 20,
      fetcher: ((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init.signal as AbortSignal | null;
          signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        })) as typeof fetch,
    });
    const result = await buildSemanticCoachRevisionProposal({
      userMessage: 'remove conditioning Monday',
      visibleSnapshot: visibleSnapshot(),
      adapter,
    });
    ok('[3b] timeout becomes invalid adapter_failed',
      result.kind === 'invalid' && result.reason === 'adapter_failed',
      result);
    ok('[3b] issue carries abort detail',
      result.kind === 'invalid' && result.issues.some((entry) => /abort/i.test(entry)),
      result.kind === 'invalid' ? result.issues : result);
  }

  {
    // Malformed JSON: transport succeeds but the payload is not a valid
    // CoachRevisionProposal — must fail schema validation, never mutate.
    const adapter = new LLMSemanticCoachRevisionProposalAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-revision-proposal',
      fetcher: (async () => new Response(JSON.stringify({ kind: 'revision' }), { status: 200 })) as typeof fetch,
    });
    const result = await buildSemanticCoachRevisionProposal({
      userMessage: 'remove conditioning Monday',
      visibleSnapshot: visibleSnapshot(),
      adapter,
    });
    ok('[3c] malformed JSON fails schema validation',
      result.kind === 'invalid' && result.reason === 'schema_validation_failed',
      result);
  }

  {
    // Prose payloads: a JSON-encoded string body parses but is not an object
    // (schema failure); a raw non-JSON body throws in resp.json()
    // (adapter failure). Both end invalid with no mutation.
    const proseAsJsonString = new LLMSemanticCoachRevisionProposalAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-revision-proposal',
      fetcher: (async () => new Response(JSON.stringify('Sure! Happy to help with that.'), { status: 200 })) as typeof fetch,
    });
    const stringResult = await buildSemanticCoachRevisionProposal({
      userMessage: 'remove conditioning Monday',
      visibleSnapshot: visibleSnapshot(),
      adapter: proseAsJsonString,
    });
    ok('[3d] prose-as-JSON-string fails schema validation',
      stringResult.kind === 'invalid' && stringResult.reason === 'schema_validation_failed',
      stringResult);

    const rawProse = new LLMSemanticCoachRevisionProposalAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-revision-proposal',
      fetcher: (async () => new Response('Sure! Happy to help with that.', { status: 200 })) as typeof fetch,
    });
    const proseResult = await buildSemanticCoachRevisionProposal({
      userMessage: 'remove conditioning Monday',
      visibleSnapshot: visibleSnapshot(),
      adapter: rawProse,
    });
    ok('[3e] raw prose body fails as adapter error',
      proseResult.kind === 'invalid' && proseResult.reason === 'adapter_failed',
      proseResult);
  }

  {
    const adapter = new LLMSemanticCoachRevisionProposalAdapter({
      endpoint: 'https://edge.example.com/functions/v1/coach-revision-proposal',
      fetcher: (async () => new Response(JSON.stringify(semanticRevisionResponse()), { status: 200 })) as typeof fetch,
    });
    const result = await buildSemanticCoachRevisionProposal({
      userMessage: 'Drop lower work Monday but keep the flush',
      visibleSnapshot: visibleSnapshot(),
      adapter,
      todayISO: '2026-07-01',
    });
    ok('[4] real adapter output passes strict proposal + diff validation',
      result.kind === 'revision' &&
        result.diagnostic.validatorStatus === 'valid' &&
        result.diagnostic.protectedRefsPreserved.length === 1,
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
    failures.push(err instanceof Error ? err.stack ?? err.message : String(err));
    console.log(`\n- Summary -`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    console.log(`\n- Failures -`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  });
