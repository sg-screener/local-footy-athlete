/**
 * semanticProgramEditDraftTests — Stage 3D-1 semantic parser contract.
 *
 * These tests stop at "can an LLM proposal become a safe typed draft?".
 * They deliberately do not wire CoachTurnController, execute mutations,
 * write stores, or compose success replies.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/semanticProgramEditDraftTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { ResolvedDay } from '../utils/sessionResolver';
import type { CoachTargetFrame } from '../utils/coachTargetFrame';
import type { ProgramEditDraft } from '../utils/coachProgramEditDraft';
import {
  MockSemanticProgramEditDraftAdapter,
  SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
  buildSemanticProgramEditDraft,
  parseSemanticProgramEditDraftResponse,
  type SemanticProgramEditDraftAdapter,
} from '../utils/semanticProgramEditDraft';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function section(name: string) {
  console.log(`\n${name}`);
}

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

const TODAY = '2026-06-24';
const TOMORROW = '2026-06-25';
const TEAM_TRAINING = '2026-06-24';

function workout(args: {
  id: string;
  name: string;
  workoutType?: string;
  strengthName?: string | null;
  conditioningName?: string | null;
}): any {
  const exercises: any[] = [];
  const conditioningIds: string[] = [];
  if (args.strengthName) {
    exercises.push({
      id: `${args.id}-strength-1`,
      exerciseId: `${args.id}-strength-1`,
      exercise: { id: `${args.id}-strength-1`, name: args.strengthName },
    });
  }
  if (args.conditioningName) {
    const id = `${args.id}-conditioning-1`;
    conditioningIds.push(id);
    exercises.push({
      id,
      exerciseId: id,
      prescriptionType: 'duration',
      prescribedRepsMin: 25,
      prescribedRepsMax: 25,
      exercise: { id, name: args.conditioningName },
      notes: '25 min easy aerobic work',
    });
  }
  return {
    id: args.id,
    name: args.name,
    workoutType: args.workoutType ?? 'Strength',
    exercises,
    conditioningBlock: args.conditioningName
      ? {
          options: [{
            title: args.conditioningName,
            description: '25 min easy aerobic work',
            exerciseIds: conditioningIds,
          }],
        }
      : undefined,
    createdAt: '',
    updatedAt: '',
  };
}

function day(date: string, visibleWorkout: any | null, isToday = false): ResolvedDay {
  return {
    date,
    dayOfWeek: 3,
    short: 'WED',
    isToday,
    workout: visibleWorkout,
    source: visibleWorkout ? 'template' : 'rest',
    indicator: null,
  } as any;
}

function visibleWeek(): ResolvedDay[] {
  return [
    day(TEAM_TRAINING, workout({
      id: 'workout-team-training',
      name: 'Team Training',
      workoutType: 'Team',
      strengthName: null,
      conditioningName: null,
    }), true),
    day(TOMORROW, workout({
      id: 'workout-lower-strength',
      name: 'Lower Body Strength',
      strengthName: 'Back Squat',
      conditioningName: 'Easy Aerobic Flush',
    })),
  ];
}

function targetFrame(date = TOMORROW): CoachTargetFrame {
  return {
    resolvedTarget: {
      kind: 'session',
      date,
      sessionName: date === TEAM_TRAINING ? 'Team Training' : 'Lower Body Strength',
      itemId: date === TEAM_TRAINING ? 'workout-team-training' : 'workout-lower-strength',
      domain: 'session',
      stillVisible: true,
    },
    confidence: 0.9,
    targetSource: 'explicit_message',
    missingFields: [],
    candidateOptions: [],
    reason: 'test_target',
    explicitDateRole: 'referent',
  };
}

function baseDraft(overrides: Partial<ProgramEditDraft> = {}): ProgramEditDraft {
  const sourceTarget = overrides.sourceTarget ?? targetFrame().resolvedTarget;
  const draft: ProgramEditDraft = {
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
    confidence: 0.88,
    protectedTargets: [{
      targetDomain: 'conditioning',
      actionScope: 'conditioning_block',
      targetDate: TOMORROW,
      targetItemId: 'workout-lower-strength-conditioning-1',
      title: 'Easy Aerobic Flush',
      reason: 'explicit_keep_conditioning',
    }],
    constraints: ['keep conditioning:conditioning_block'],
    proposedActions: [{
      intent: 'remove',
      targetDomain: 'strength',
      actionScope: 'strength_block',
      targetDate: TOMORROW,
      targetSessionId: 'workout-lower-strength',
      targetItemId: null,
      sourceTarget,
      reason: 'semantic_lower_strength_removal',
    }],
    verifierExpectations: [
      {
        kind: 'domain_changed',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate: TOMORROW,
        reason: 'remove_strength_block',
      },
      {
        kind: 'domain_unchanged',
        targetDomain: 'conditioning',
        actionScope: 'conditioning_block',
        targetDate: TOMORROW,
        reason: 'explicit_keep_conditioning',
      },
    ],
    isCompound: false,
    reason: 'semantic_messy_language_remove_strength_keep_conditioning',
  };
  return { ...draft, ...overrides };
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
    status: 'draft',
    confidence: 0.88,
    draft: baseDraft(),
    reason: 'semantic_parser_test',
    ...overrides,
  };
}

async function run() {
  section('[1] valid semantic draft is parsed but not executed');
  {
    const result = await buildSemanticProgramEditDraft({
      userMessage: 'Drop the lower work but keep the flush',
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
      adapter: new MockSemanticProgramEditDraftAdapter(response()),
    });
    ok('valid response returns draft', result.kind === 'draft', result);
    ok('draft keeps strength domain',
      result.kind === 'draft' &&
        result.draft.targetDomain === 'strength' &&
        result.draft.actionScope === 'strength_block',
      result);
    ok('draft protects conditioning',
      result.kind === 'draft' &&
        result.draft.protectedTargets.some((target) => target.targetDomain === 'conditioning'),
      result);
  }

  section('[2] malformed and unsupported LLM output is safe');
  {
    const malformed = parseSemanticProgramEditDraftResponse({
      raw: '{not json',
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
    });
    ok('malformed JSON is invalid', malformed.kind === 'invalid' && malformed.reason === 'malformed_json', malformed);

    const extraTopLevel = parseSemanticProgramEditDraftResponse({
      raw: { ...response(), reply: 'Done — I changed it.' },
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
    });
    ok('top-level success claims are rejected as unsupported fields',
      extraTopLevel.kind === 'invalid' &&
        extraTopLevel.issues.some((issue) => /response\.reply/.test(issue)),
      extraTopLevel);

    const extraDraftField = parseSemanticProgramEditDraftResponse({
      raw: response({
        draft: {
          ...baseDraft(),
          applied: true,
        },
      }),
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
    });
    ok('draft cannot smuggle mutation state',
      extraDraftField.kind === 'invalid' &&
        extraDraftField.issues.some((issue) => /applied/.test(issue)),
      extraDraftField);

    const badEnum = parseSemanticProgramEditDraftResponse({
      raw: response({
        draft: {
          ...baseDraft(),
          targetDomain: 'cardio',
        },
      }),
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
    });
    ok('unsupported enum values are rejected',
      badEnum.kind === 'invalid' &&
        badEnum.issues.some((issue) => /targetDomain/.test(issue)),
      badEnum);
  }

  section('[3] low confidence and clarification statuses do not produce executable drafts');
  {
    const lowConfidence = parseSemanticProgramEditDraftResponse({
      raw: response({
        confidence: 0.41,
        clarificationQuestion: 'Do you mean the lower strength work or the whole session?',
        candidateOptions: ['Lower strength', 'Whole session'],
      }),
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
    });
    ok('low confidence returns clarification, not draft',
      lowConfidence.kind === 'clarify' &&
        /one more detail|lower strength/i.test(lowConfidence.reply),
      lowConfidence);

    const clarify = parseSemanticProgramEditDraftResponse({
      raw: {
        schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
        status: 'clarify',
        confidence: 0.82,
        draft: null,
        clarificationQuestion: 'Which day should I change?',
        candidateOptions: ['Today', 'Tomorrow'],
        reason: 'semantic_missing_date',
      },
      targetFrame: null,
      visibleWeek: visibleWeek(),
    });
    ok('typed clarify status is preserved',
      clarify.kind === 'clarify' &&
        clarify.options?.includes('Tomorrow'),
      clarify);
  }

  section('[4] target ids and dates are validated against visible context');
  {
    const inventedDate = parseSemanticProgramEditDraftResponse({
      raw: response({
        draft: baseDraft({
          targetDate: '2026-07-31',
          proposedActions: [{
            ...baseDraft().proposedActions[0],
            targetDate: '2026-07-31',
          }],
        }),
      }),
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
    });
    ok('invented target date is rejected',
      inventedDate.kind === 'invalid' &&
        inventedDate.issues.some((issue) => /targetDate/.test(issue)),
      inventedDate);

    const inventedItem = parseSemanticProgramEditDraftResponse({
      raw: response({
        draft: baseDraft({
          targetItemId: 'not-a-visible-item',
        }),
      }),
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
    });
    ok('invented target item id is rejected',
      inventedItem.kind === 'invalid' &&
        inventedItem.issues.some((issue) => /targetItemId/.test(issue)),
      inventedItem);
  }

  section('[5] compound semantic drafts validate as drafts only');
  {
    const teamSource = targetFrame(TEAM_TRAINING).resolvedTarget;
    const compoundDraft = baseDraft({
      intent: 'replace',
      targetDomain: 'session',
      actionScope: 'whole_session',
      targetDate: TEAM_TRAINING,
      targetSessionId: 'workout-team-training',
      sourceTarget: teamSource,
      explicitUserWording: "Can't make team training tonight, swap it for easy conditioning",
      protectedTargets: [],
      constraints: [],
      proposedActions: [
        {
          intent: 'remove',
          targetDomain: 'session',
          actionScope: 'whole_session',
          targetDate: TEAM_TRAINING,
          targetSessionId: 'workout-team-training',
          targetItemId: null,
          sourceTarget: teamSource,
          reason: 'semantic_remove_team_training',
        },
        {
          intent: 'add',
          targetDomain: 'conditioning',
          actionScope: 'conditioning_block',
          targetDate: TEAM_TRAINING,
          targetSessionId: 'workout-team-training',
          targetItemId: null,
          sourceTarget: teamSource,
          reason: 'semantic_add_easy_conditioning',
        },
      ],
      verifierExpectations: [
        {
          kind: 'session_removed',
          targetDomain: 'session',
          actionScope: 'whole_session',
          targetDate: TEAM_TRAINING,
          reason: 'remove_team_training',
        },
        {
          kind: 'item_added',
          targetDomain: 'conditioning',
          actionScope: 'conditioning_block',
          targetDate: TEAM_TRAINING,
          reason: 'add_easy_conditioning',
        },
      ],
      isCompound: true,
      reason: 'semantic_compound_remove_and_add',
    });
    const result = parseSemanticProgramEditDraftResponse({
      raw: response({
        draft: compoundDraft,
        reason: 'semantic_compound_test',
      }),
      targetFrame: targetFrame(TEAM_TRAINING),
      visibleWeek: visibleWeek(),
    });
    ok('compound request becomes typed ProgramEditDraft',
      result.kind === 'draft' &&
        result.draft.isCompound &&
        result.draft.proposedActions.length === 2,
      result);
    ok('compound draft still does not execute in parser stage',
      result.kind === 'draft' &&
        result.response.status === 'draft',
      result);
  }

  section('[6] adapter is mockable and receives grounded context');
  {
    let captured: any = null;
    const adapter: SemanticProgramEditDraftAdapter = {
      buildDraft: (input) => {
        captured = input;
        return JSON.stringify(response());
      },
    };
    const result = await buildSemanticProgramEditDraft({
      userMessage: 'My legs are rooted, make tomorrow lighter',
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
      adapter,
    });
    ok('mock adapter can return JSON string', result.kind === 'draft', result);
    ok('adapter receives target frame and visible week',
      captured?.targetFrame?.resolvedTarget?.date === TOMORROW &&
        captured.visibleWeek?.length === 2,
      captured);
  }

  section('[7] non-edit and unsupported statuses are typed outcomes');
  {
    const notEdit = parseSemanticProgramEditDraftResponse({
      raw: {
        schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
        status: 'not_program_edit',
        confidence: 0.9,
        draft: null,
        reason: 'general_training_question',
      },
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
    });
    ok('not_program_edit is not turned into a draft',
      notEdit.kind === 'not_program_edit',
      notEdit);

    const unsupported = parseSemanticProgramEditDraftResponse({
      raw: {
        schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
        status: 'unsupported',
        confidence: 0.86,
        draft: null,
        clarificationQuestion: 'I can understand that setup change, but I cannot apply it safely yet.',
        reason: 'unsupported_semantic_scope',
      },
      targetFrame: targetFrame(),
      visibleWeek: visibleWeek(),
    });
    ok('unsupported is a typed non-mutating result',
      unsupported.kind === 'unsupported' &&
        /cannot apply/i.test(unsupported.reply),
      unsupported);
  }
}

run()
  .then(() => {
    console.log(`\n-- Summary --`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    if (fail > 0) {
      console.log(`\n-- Failures --`);
      for (const failure of failures) console.log(`  - ${failure}`);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    fail++;
    failures.push(err instanceof Error ? err.stack ?? err.message : String(err));
    console.log(`\n-- Summary --`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    console.log(`\n-- Failures --`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  });
