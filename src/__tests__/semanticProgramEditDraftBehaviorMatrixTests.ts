/**
 * semanticProgramEditDraftBehaviorMatrixTests — Stage 3D-2 semantic
 * ProgramEditDraft behavior matrix.
 *
 * This is a mocked semantic-parser harness only. It does not wire
 * CoachTurnController, route commands, execute mutations, write stores,
 * or call legacy coach-chat actions.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/semanticProgramEditDraftBehaviorMatrixTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { readFileSync } from 'fs';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { CoachResolvedTarget, CoachTargetFrame } from '../utils/coachTargetFrame';
import type {
  ProgramEditDraft,
  ProgramEditDraftAction,
  ProgramEditDraftActionScope,
  ProgramEditDraftIntent,
  ProgramEditDraftTargetDomain,
  ProgramEditVerifierExpectation,
} from '../utils/coachProgramEditDraft';
import {
  MockSemanticProgramEditDraftAdapter,
  SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
  buildSemanticProgramEditDraft,
  parseSemanticProgramEditDraftResponse,
  type SemanticProgramEditDraftResult,
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
const NEXT_MONDAY = '2026-06-29';
const NEXT_WEDNESDAY = '2026-07-01';
const NEXT_FRIDAY = '2026-07-03';

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

function day(args: {
  date: string;
  workout: any | null;
  dayOfWeek: number;
  short: string;
  isToday?: boolean;
}): ResolvedDay {
  return {
    date: args.date,
    dayOfWeek: args.dayOfWeek,
    short: args.short,
    isToday: !!args.isToday,
    workout: args.workout,
    source: args.workout ? 'template' : 'rest',
    indicator: null,
  } as any;
}

function week(): ResolvedDay[] {
  return [
    day({
      date: TODAY,
      dayOfWeek: 3,
      short: 'WED',
      isToday: true,
      workout: workout({
        id: 'workout-team-training',
        name: 'Team Training',
        workoutType: 'Team',
      }),
    }),
    day({
      date: TOMORROW,
      dayOfWeek: 4,
      short: 'THU',
      workout: workout({
        id: 'workout-lower-strength',
        name: 'Lower Body Strength',
        strengthName: 'Back Squat',
        conditioningName: 'Easy Aerobic Flush',
      }),
    }),
    day({
      date: NEXT_MONDAY,
      dayOfWeek: 1,
      short: 'MON',
      workout: workout({
        id: 'workout-upper-strength',
        name: 'Upper Body Strength',
        strengthName: 'Bench Press',
        conditioningName: null,
      }),
    }),
    day({ date: NEXT_WEDNESDAY, dayOfWeek: 3, short: 'WED', workout: null }),
    day({ date: NEXT_FRIDAY, dayOfWeek: 5, short: 'FRI', workout: null }),
  ];
}

function sessionTarget(args: {
  date: string;
  sessionName: string;
  itemId: string;
  domain?: CoachResolvedTarget['domain'];
  kind?: CoachResolvedTarget['kind'];
  itemTitle?: string;
}): CoachResolvedTarget {
  return {
    kind: args.kind ?? 'session',
    date: args.date,
    sessionName: args.sessionName,
    itemId: args.itemId,
    itemTitle: args.itemTitle,
    domain: args.domain ?? 'session',
    stillVisible: true,
  };
}

function targetFrame(target: CoachResolvedTarget | null): CoachTargetFrame {
  return {
    resolvedTarget: target,
    confidence: target ? 0.9 : 0,
    targetSource: target ? 'explicit_message' : 'ambiguous',
    missingFields: target ? [] : ['target'],
    candidateOptions: [],
    reason: target ? 'matrix_target' : 'matrix_ambiguous',
    explicitDateRole: target ? 'referent' : 'ambiguous',
  };
}

function draft(args: {
  wording: string;
  intent: ProgramEditDraftIntent;
  targetDomain: ProgramEditDraftTargetDomain;
  actionScope: ProgramEditDraftActionScope;
  targetDate: string | null;
  targetSessionId: string | null;
  targetItemId?: string | null;
  sourceTarget?: CoachResolvedTarget | null;
  protectedConditioning?: boolean;
  isCompound?: boolean;
  proposedActions?: ProgramEditDraftAction[];
  verifierExpectations?: ProgramEditVerifierExpectation[];
  missingFields?: string[];
  confidence?: number;
  reason?: string;
}): ProgramEditDraft {
  const sourceTarget = args.sourceTarget ?? null;
  const baseActionIntent = executableIntent(args.intent);
  const proposedActions = args.proposedActions ?? (baseActionIntent
    ? [{
        intent: baseActionIntent,
        targetDomain: args.targetDomain,
        actionScope: args.actionScope,
        targetDate: args.targetDate,
        targetSessionId: args.targetSessionId,
        targetItemId: args.targetItemId ?? null,
        sourceTarget,
        reason: args.reason ?? 'semantic_matrix_action',
      }]
    : []);
  const protectedTargets = args.protectedConditioning
    ? [{
        targetDomain: 'conditioning' as const,
        actionScope: 'conditioning_block' as const,
        targetDate: args.targetDate,
        targetItemId: 'workout-lower-strength-conditioning-1',
        title: 'Easy Aerobic Flush',
        reason: 'semantic_keep_conditioning',
      }]
    : [];
  return {
    intent: args.intent,
    targetDomain: args.targetDomain,
    actionScope: args.actionScope,
    targetDate: args.targetDate,
    targetSessionId: args.targetSessionId,
    targetItemId: args.targetItemId ?? null,
    sourceTarget,
    explicitDateRole: 'referent',
    explicitUserWording: args.wording,
    missingFields: args.missingFields ?? [],
    confidence: args.confidence ?? 0.86,
    protectedTargets,
    constraints: protectedTargets.map((target) => `keep ${target.targetDomain}:${target.actionScope}`),
    proposedActions,
    verifierExpectations: args.verifierExpectations ?? expectationsForActions(proposedActions, protectedTargets),
    isCompound: !!args.isCompound,
    reason: args.reason ?? 'semantic_matrix_draft',
  };
}

function executableIntent(
  intent: ProgramEditDraftIntent,
): ProgramEditDraftAction['intent'] | null {
  if (intent === 'ask_question' || intent === 'explain') return null;
  if (intent === 'reduce') return 'edit';
  return intent;
}

function expectationsForActions(
  actions: ProgramEditDraftAction[],
  protectedTargets: ProgramEditDraft['protectedTargets'],
): ProgramEditVerifierExpectation[] {
  return [
    ...actions.map((action): ProgramEditVerifierExpectation => ({
      kind: action.targetDomain === 'session' ? 'session_removed' : 'domain_changed',
      targetDomain: action.targetDomain,
      actionScope: action.actionScope,
      targetDate: action.targetDate,
      reason: action.reason,
    })),
    ...protectedTargets.map((target): ProgramEditVerifierExpectation => ({
      kind: 'domain_unchanged',
      targetDomain: target.targetDomain,
      actionScope: target.actionScope,
      targetDate: target.targetDate,
      reason: target.reason,
    })),
  ];
}

function responseForDraft(value: ProgramEditDraft, confidence = value.confidence) {
  return {
    schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
    status: 'draft',
    confidence,
    draft: value,
    reason: value.reason,
  };
}

function clarifyResponse(args: {
  question: string;
  options?: string[];
  confidence?: number;
  reason?: string;
}) {
  return {
    schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
    status: 'clarify',
    confidence: args.confidence ?? 0.82,
    draft: null,
    clarificationQuestion: args.question,
    candidateOptions: args.options,
    reason: args.reason ?? 'semantic_matrix_clarify',
  };
}

async function parseCase(input: {
  message: string;
  semanticOutput: unknown;
  frame?: CoachTargetFrame;
}): Promise<SemanticProgramEditDraftResult> {
  return buildSemanticProgramEditDraft({
    userMessage: input.message,
    targetFrame: input.frame ?? targetFrame(lowerTarget),
    visibleWeek: week(),
    adapter: new MockSemanticProgramEditDraftAdapter(input.semanticOutput),
  });
}

const lowerTarget = sessionTarget({
  date: TOMORROW,
  sessionName: 'Lower Body Strength',
  itemId: 'workout-lower-strength',
});

const conditioningTarget = sessionTarget({
  date: TOMORROW,
  sessionName: 'Lower Body Strength',
  itemId: 'workout-lower-strength-conditioning-1',
  itemTitle: 'Easy Aerobic Flush',
  domain: 'conditioning',
  kind: 'conditioning_item',
});

const teamTarget = sessionTarget({
  date: TODAY,
  sessionName: 'Team Training',
  itemId: 'workout-team-training',
});

type MatrixCase = {
  message: string;
  semanticOutput: unknown;
  expectedKind: SemanticProgramEditDraftResult['kind'];
  targetDomain?: ProgramEditDraftTargetDomain;
  actionScope?: ProgramEditDraftActionScope;
  protectedDomain?: ProgramEditDraftTargetDomain;
  isCompound?: boolean;
  frame?: CoachTargetFrame;
};

async function run() {
  section('[1] messy semantic behavior matrix validates typed outcomes');
  const matrix: MatrixCase[] = [
    {
      message: "I'm cooked, bin the leg stuff tomorrow",
      semanticOutput: responseForDraft(draft({
        wording: "I'm cooked, bin the leg stuff tomorrow",
        intent: 'remove',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate: TOMORROW,
        targetSessionId: 'workout-lower-strength',
        sourceTarget: lowerTarget,
        protectedConditioning: true,
        reason: 'semantic_bin_leg_stuff',
      })),
      expectedKind: 'draft',
      targetDomain: 'strength',
      actionScope: 'strength_block',
      protectedDomain: 'conditioning',
    },
    {
      message: 'Drop the lower work but keep the flush',
      semanticOutput: responseForDraft(draft({
        wording: 'Drop the lower work but keep the flush',
        intent: 'remove',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate: TOMORROW,
        targetSessionId: 'workout-lower-strength',
        sourceTarget: lowerTarget,
        protectedConditioning: true,
        reason: 'semantic_drop_lower_keep_flush',
      })),
      expectedKind: 'draft',
      targetDomain: 'strength',
      actionScope: 'strength_block',
      protectedDomain: 'conditioning',
    },
    {
      message: "Can't make team training tonight, swap it for easy conditioning",
      semanticOutput: responseForDraft(draft({
        wording: "Can't make team training tonight, swap it for easy conditioning",
        intent: 'replace',
        targetDomain: 'session',
        actionScope: 'whole_session',
        targetDate: TODAY,
        targetSessionId: 'workout-team-training',
        sourceTarget: teamTarget,
        isCompound: true,
        proposedActions: [
          {
            intent: 'remove',
            targetDomain: 'session',
            actionScope: 'whole_session',
            targetDate: TODAY,
            targetSessionId: 'workout-team-training',
            targetItemId: null,
            sourceTarget: teamTarget,
            reason: 'semantic_remove_team_training',
          },
          {
            intent: 'add',
            targetDomain: 'conditioning',
            actionScope: 'conditioning_block',
            targetDate: TODAY,
            targetSessionId: 'workout-team-training',
            targetItemId: null,
            sourceTarget: teamTarget,
            reason: 'semantic_add_easy_conditioning',
          },
        ],
        reason: 'semantic_team_training_replace',
      })),
      expectedKind: 'draft',
      targetDomain: 'session',
      actionScope: 'whole_session',
      isCompound: true,
      frame: targetFrame(teamTarget),
    },
    {
      message: 'Yeah that one',
      semanticOutput: responseForDraft(draft({
        wording: 'Yeah that one',
        intent: 'remove',
        targetDomain: 'conditioning',
        actionScope: 'conditioning_block',
        targetDate: TOMORROW,
        targetSessionId: 'workout-lower-strength',
        targetItemId: 'workout-lower-strength-conditioning-1',
        sourceTarget: conditioningTarget,
        reason: 'semantic_accept_pending_conditioning_target',
      })),
      expectedKind: 'draft',
      targetDomain: 'conditioning',
      actionScope: 'conditioning_block',
      frame: targetFrame(conditioningTarget),
    },
    {
      message: 'Nah leave it',
      semanticOutput: clarifyResponse({
        question: 'Leave the plan unchanged?',
        options: ['Leave unchanged', 'Choose another change'],
        reason: 'semantic_reject_pending_candidate',
      }),
      expectedKind: 'clarify',
    },
    {
      message: 'Go on then',
      semanticOutput: responseForDraft(draft({
        wording: 'Go on then',
        intent: 'move',
        targetDomain: 'schedule',
        actionScope: 'whole_session',
        targetDate: NEXT_MONDAY,
        targetSessionId: 'workout-upper-strength',
        sourceTarget: sessionTarget({
          date: NEXT_MONDAY,
          sessionName: 'Upper Body Strength',
          itemId: 'workout-upper-strength',
          domain: 'schedule',
        }),
        reason: 'semantic_accept_pending_move',
      })),
      expectedKind: 'draft',
      targetDomain: 'schedule',
      actionScope: 'whole_session',
    },
    {
      message: 'My legs are rooted, make tomorrow lighter',
      semanticOutput: responseForDraft(draft({
        wording: 'My legs are rooted, make tomorrow lighter',
        intent: 'reduce',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate: TOMORROW,
        targetSessionId: 'workout-lower-strength',
        sourceTarget: lowerTarget,
        protectedConditioning: true,
        reason: 'semantic_reduce_lower_strength_load',
      })),
      expectedKind: 'draft',
      targetDomain: 'strength',
      actionScope: 'strength_block',
      protectedDomain: 'conditioning',
    },
    {
      message: "I'm away next week",
      semanticOutput: clarifyResponse({
        question: 'Do you want next week marked unavailable for training, or just move one session?',
        options: ['Mark next week unavailable', 'Move one session'],
        reason: 'semantic_away_next_week_needs_scope',
      }),
      expectedKind: 'clarify',
    },
    {
      message: 'Can only train Mon Wed Fri now',
      semanticOutput: responseForDraft(draft({
        wording: 'Can only train Mon Wed Fri now',
        intent: 'edit',
        targetDomain: 'setup',
        actionScope: 'setup',
        targetDate: null,
        targetSessionId: null,
        sourceTarget: null,
        proposedActions: [{
          intent: 'edit',
          targetDomain: 'setup',
          actionScope: 'setup',
          targetDate: null,
          targetSessionId: null,
          targetItemId: null,
          sourceTarget: null,
          reason: 'semantic_update_training_availability',
        }],
        reason: 'semantic_setup_training_days',
      })),
      expectedKind: 'draft',
      targetDomain: 'setup',
      actionScope: 'setup',
    },
  ];

  for (const item of matrix) {
    const result = await parseCase(item);
    ok(`${item.message} -> ${item.expectedKind}`,
      result.kind === item.expectedKind,
      result);
    if (result.kind === 'draft') {
      ok(`${item.message} targetDomain`,
        !item.targetDomain || result.draft.targetDomain === item.targetDomain,
        result.draft);
      ok(`${item.message} actionScope`,
        !item.actionScope || result.draft.actionScope === item.actionScope,
        result.draft);
      ok(`${item.message} protected targets`,
        !item.protectedDomain ||
          result.draft.protectedTargets.some((target) => target.targetDomain === item.protectedDomain),
        result.draft.protectedTargets);
      ok(`${item.message} compound flag`,
        item.isCompound == null || result.draft.isCompound === item.isCompound,
        result.draft);
    }
    if (result.kind === 'clarify') {
      ok(`${item.message} asks a typed clarification`,
        !!result.reply && result.confidence >= 0.65,
        result);
    }
  }

  section('[2] malformed and low-confidence semantic outputs stay closed');
  {
    const malformed = await parseCase({
      message: 'Drop the lower work but keep the flush',
      semanticOutput: '{ definitely not json',
    });
    ok('malformed output is invalid',
      malformed.kind === 'invalid' && malformed.reason === 'malformed_json',
      malformed);

    const lowConfidence = await parseCase({
      message: 'My legs are rooted, make tomorrow lighter',
      semanticOutput: responseForDraft(draft({
        wording: 'My legs are rooted, make tomorrow lighter',
        intent: 'reduce',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate: TOMORROW,
        targetSessionId: 'workout-lower-strength',
        sourceTarget: lowerTarget,
        protectedConditioning: true,
        confidence: 0.42,
      }), 0.42),
    });
    ok('low-confidence semantic output asks instead of producing a draft',
      lowConfidence.kind === 'clarify' &&
        lowConfidence.reason === 'semantic_draft_low_confidence',
      lowConfidence);

    const inventedTarget = await parseCase({
      message: 'Yeah that one',
      semanticOutput: responseForDraft(draft({
        wording: 'Yeah that one',
        intent: 'remove',
        targetDomain: 'conditioning',
        actionScope: 'conditioning_block',
        targetDate: TOMORROW,
        targetSessionId: 'workout-lower-strength',
        targetItemId: 'not-visible-conditioning',
        sourceTarget: conditioningTarget,
      })),
    });
    ok('invented target id is rejected',
      inventedTarget.kind === 'invalid' &&
        inventedTarget.issues.some((issue) => /targetItemId/.test(issue)),
      inventedTarget);
  }

  section('[3] harness remains validation-only');
  {
    const parserSource = readFileSync('src/utils/semanticProgramEditDraft.ts', 'utf8');
    const testSource = readFileSync('src/__tests__/semanticProgramEditDraftBehaviorMatrixTests.ts', 'utf8');
    ok('semantic parser does not import executor or router mutation paths',
      !/\bexecuteProgramEdit\b|\bexecuteCoachCommand\b|\brouteCoachCommand\b|\bcoach-chat\b|\blegacyCoachActionFilter\b/.test(parserSource),
      parserSource.match(/\bexecuteProgramEdit\b|\bexecuteCoachCommand\b|\brouteCoachCommand\b|\bcoach-chat\b|\blegacyCoachActionFilter\b/g));
    ok('behavior matrix does not execute mutations',
      !/\bexecuteProgramEdit\b|\bexecuteCoachCommand\b|\brouteCoachCommand\b/.test(testSource),
      testSource.match(/\bexecuteProgramEdit\b|\bexecuteCoachCommand\b|\brouteCoachCommand\b/g));
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
