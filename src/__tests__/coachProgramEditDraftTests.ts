/**
 * coachProgramEditDraftTests — Stage 3A draft classification contract.
 *
 * These tests stop at "what should happen?". They deliberately do not
 * execute, apply, or verify program mutations.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/coachProgramEditDraftTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { readFileSync } from 'fs';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { CoachTargetFrame } from '../utils/coachTargetFrame';
import {
  buildProgramEditDraft,
  decideProgramEditDraftFrontDoor,
  isEffectivelyCompoundProgramEditDraft,
  validateProgramEditAgainstDraft,
  type ProgramEditDraft,
  type ProgramEditDraftAction,
} from '../utils/coachProgramEditDraft';
import {
  fingerprintVisibleProgramDay,
  verifyProgramEditDraftVisibleState,
  type CoachVisibleDomainSnapshotMap,
} from '../utils/coachVisibleDomainVerifier';

const TODAY = '2026-06-23';

function workout(name: string, type = 'Strength'): any {
  return {
    id: `workout-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    workoutType: type,
    exercises: [],
    createdAt: '',
    updatedAt: '',
  };
}

function strengthConditioningWorkout(args: {
  strengthName?: string | null;
  conditioningName?: string | null;
  type?: string;
} = {}): any {
  const strengthName = Object.prototype.hasOwnProperty.call(args, 'strengthName')
    ? args.strengthName
    : 'Back Squat';
  const conditioningName = Object.prototype.hasOwnProperty.call(args, 'conditioningName')
    ? args.conditioningName
    : 'Easy Aerobic Flush';
  const exercises: any[] = [];
  const conditioningIds: string[] = [];
  if (strengthName) {
    exercises.push({
      id: 'strength-1',
      exerciseId: 'strength-1',
      exercise: { id: 'strength-1', name: strengthName },
    });
  }
  if (conditioningName) {
    conditioningIds.push('conditioning-1');
    exercises.push({
      id: 'conditioning-1',
      exerciseId: 'conditioning-1',
      prescriptionType: 'duration',
      prescribedRepsMin: 25,
      prescribedRepsMax: 25,
      exercise: { id: 'conditioning-1', name: conditioningName },
      notes: '25 min easy aerobic work',
    });
  }
  return {
    id: 'workout-visible-test',
    name: conditioningName && !strengthName ? conditioningName : 'Lower Body Strength',
    workoutType: args.type ?? 'Strength',
    exercises,
    conditioningBlock: conditioningName
      ? {
          options: [{
            title: conditioningName,
            description: '25 min easy aerobic work',
            exerciseIds: conditioningIds,
          }],
        }
      : undefined,
    createdAt: '',
    updatedAt: '',
  };
}

function emptyWorkoutShell(name: string, type = 'Conditioning'): any {
  return {
    id: `empty-shell-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    workoutType: type,
    exercises: [],
    createdAt: '',
    updatedAt: '',
  };
}

function day(date: string, name: string | null, isToday = false): ResolvedDay {
  return {
    date,
    dayOfWeek: 2,
    short: 'TUE',
    isToday,
    workout: name ? workout(name, name.includes('Conditioning') ? 'Conditioning' : 'Strength') : null,
    source: name ? 'template' : 'rest',
    indicator: null,
  } as any;
}

function visibleDay(
  date: string,
  visibleWorkout: any | null,
  isToday = date === TODAY,
): ResolvedDay {
  return {
    date,
    dayOfWeek: 2,
    short: 'TUE',
    isToday,
    workout: visibleWorkout,
    source: visibleWorkout ? 'template' : 'rest',
    indicator: null,
  } as any;
}

function visibleMap(days: ResolvedDay[]): CoachVisibleDomainSnapshotMap {
  const out: CoachVisibleDomainSnapshotMap = {};
  for (const visible of days) {
    out[visible.date] = fingerprintVisibleProgramDay(visible);
  }
  return out;
}

function visibleWeek(name = 'Lower Body Strength'): ResolvedDay[] {
  return [day(TODAY, name, true)];
}

function frameForSession(name: string): CoachTargetFrame {
  return {
    resolvedTarget: {
      kind: 'session',
      date: TODAY,
      sessionName: name,
      itemId: `session-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      domain: 'session',
      stillVisible: true,
    },
    confidence: 0.92,
    targetSource: 'last_mutation',
    missingFields: [],
    candidateOptions: [],
    reason: 'test_source_target',
    explicitDateRole: 'none',
  };
}

function draft(message: string, targetFrame?: CoachTargetFrame): ProgramEditDraft {
  return buildProgramEditDraft({
    userMessage: message,
    targetFrame,
    visibleWeek: visibleWeek(targetFrame?.resolvedTarget?.sessionName ?? 'Lower Body Strength'),
    currentProgramContext: null,
    pendingTransaction: null,
  });
}

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
    failures.push(`${name}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
    console.log(`  FAIL ${name}`);
    if (detail) console.log(`       ${JSON.stringify(detail)}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function hasProtectedConditioning(value: ProgramEditDraft): boolean {
  return value.protectedTargets.some((target) => target.targetDomain === 'conditioning');
}

function actionDomains(value: ProgramEditDraft): string[] {
  return value.proposedActions.map((action) => `${action.intent}:${action.targetDomain}:${action.actionScope}`);
}

function decisionKind(value: ProgramEditDraft): string {
  return decideProgramEditDraftFrontDoor(value).kind;
}

function finalEdit(args: {
  intent: string;
  targetDomain: string;
  editScope?: string;
  requestedChange?: string;
  targetDate?: string;
  command?: any;
}): any {
  return {
    intent: args.intent,
    targetDomain: args.targetDomain,
    editScope: args.editScope,
    targetDate: args.targetDate ?? TODAY,
    targetSessionId: 'session-lower',
    targetItemId: args.targetDomain === 'session' ? null : `${args.targetDomain}-item`,
    requestedChange: args.requestedChange ?? 'unknown',
    newValue: null,
    missingFields: [],
    confidence: 0.9,
    naturalLanguageReason: 'test final edit',
    command: args.command ?? {
      mode: 'mutate',
      operation: args.targetDomain === 'session'
        ? 'remove_session'
        : args.targetDomain === 'conditioning'
        ? 'remove_conditioning'
        : 'replace_exercise',
      target: { kind: 'date', date: TODAY, sessionName: 'Lower Body Strength' },
      payload: args.targetDomain === 'session'
        ? { operation: 'remove_session' }
        : args.targetDomain === 'conditioning'
        ? { operation: 'remove_conditioning', modality: null, targetItemId: 'conditioning-item' }
        : { operation: 'replace_exercise', fromExercise: 'Back Squat', toExercise: null },
      scope: 'one_off',
      confidence: 0.9,
      needsClarification: false,
      reason: 'test final edit',
    },
  };
}

function mutatedDone(route = 'test:applied'): any {
  return {
    kind: 'mutated',
    applied: true,
    reply: 'Done — test mutation applied.',
    route,
    progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'],
  };
}

section('[1] remove lower body strength preserves conditioning');
{
  const out = draft('remove lower body strength');
  eq('intent', out.intent, 'remove');
  eq('targetDomain', out.targetDomain, 'strength');
  eq('actionScope', out.actionScope, 'strength_block');
  ok('protectedTargets includes conditioning', hasProtectedConditioning(out), out);
}

section('[2] remove conditioning today targets conditioning block');
{
  const out = draft('remove conditioning today');
  eq('intent', out.intent, 'remove');
  eq('targetDomain', out.targetDomain, 'conditioning');
  eq('actionScope', out.actionScope, 'conditioning_block');
  ok('does not protect conditioning from itself', !hasProtectedConditioning(out), out);
}

section('[3] remove whole session today targets whole session');
{
  const out = draft('remove whole session today');
  eq('intent', out.intent, 'remove');
  eq('targetDomain', out.targetDomain, 'session');
  eq('actionScope', out.actionScope, 'whole_session');
}

section('[4] make lower body easier reduces strength block');
{
  const out = draft('make lower body easier');
  eq('intent', out.intent, 'reduce');
  eq('targetDomain', out.targetDomain, 'strength');
  eq('actionScope', out.actionScope, 'strength_block');
}

section('[5] make conditioning easier reduces conditioning block');
{
  const out = draft('make conditioning easier');
  eq('intent', out.intent, 'reduce');
  eq('targetDomain', out.targetDomain, 'conditioning');
  eq('actionScope', out.actionScope, 'conditioning_block');
}

section('[6] keep conditioning but remove lower strength protects conditioning');
{
  const out = draft('keep conditioning but remove lower strength');
  eq('intent', out.intent, 'remove');
  eq('targetDomain', out.targetDomain, 'strength');
  eq('actionScope', out.actionScope, 'strength_block');
  ok('protectedTargets includes conditioning', hasProtectedConditioning(out), out);
  ok('constraint records protected conditioning', out.constraints.includes('keep conditioning:conditioning_block'), out);
}

section('[7] remove lower body and conditioning is compound');
{
  const out = draft('remove lower body and conditioning');
  eq('intent', out.intent, 'remove');
  ok('is compound', out.isCompound, out);
  eq('actions include strength and conditioning', actionDomains(out), [
    'remove:strength:strength_block',
    'remove:conditioning:conditioning_block',
  ]);
}

section('[8] cannot make team training and add conditioning is compound replacement draft');
{
  const targetFrame = frameForSession('Team Training');
  const out = draft("I can't make team training tonight, remove it and add conditioning", targetFrame);
  eq('intent', out.intent, 'replace');
  ok('is compound', out.isCompound, out);
  eq('source target session name', out.sourceTarget?.sessionName, 'Team Training');
  eq('actions include remove session and add conditioning', actionDomains(out), [
    'remove:session:whole_session',
    'add:conditioning:conditioning_block',
  ]);
}

section('[9] controller sees draft before command-router compatibility');
{
  const source = readFileSync('src/utils/coachTurnController.ts', 'utf8');
  const draftIdx = source.indexOf('[coach-program-edit-draft]');
  const frontDoorIdx = source.indexOf('decideProgramEditDraftFrontDoor', draftIdx);
  const guardIdx = source.indexOf('const draftExecutionGuard = validateProgramEditAgainstDraft', draftIdx);
  const routerIdx = source.indexOf(
    'const routedProgramEdit = semanticProgramEditForExecution ?? interpretCoachMessageToProgramEdit',
    draftIdx,
  );
  const executeIdx = source.indexOf('executeProgramEditWithVisibleGuard({', guardIdx);
  const legacyIdx = source.indexOf('[coach-flow] legacy_fallback', routerIdx);
  ok('controller logs draft seam', draftIdx >= 0);
  ok('controller checks draft front door', frontDoorIdx > draftIdx, { draftIdx, frontDoorIdx });
  ok('draft seam precedes old router compatibility', draftIdx >= 0 && routerIdx >= 0 && draftIdx < routerIdx, {
    draftIdx,
    routerIdx,
  });
  ok('draft front door precedes old router compatibility', frontDoorIdx >= 0 && routerIdx >= 0 && frontDoorIdx < routerIdx, {
    frontDoorIdx,
    routerIdx,
  });
  ok('draft execution guard runs before guarded executeProgramEdit', guardIdx > routerIdx && guardIdx < executeIdx, {
    guardIdx,
    executeIdx,
  });
  ok('draft execution guard blocks before legacy fallback', guardIdx > routerIdx && guardIdx < legacyIdx, {
    guardIdx,
    legacyIdx,
  });
  ok('draft front door marks legacy blocked', /legacyBlocked:\s*true/.test(source));
}

section('[10] Stage 3E front door allows typed strength-block edits');
{
  const removeStrength = draft('remove lower body strength');
  const removeDecision = decideProgramEditDraftFrontDoor(removeStrength);
  eq('remove strength decision reaches typed ProgramEdit path', removeDecision.kind, 'allow_compatibility');
  ok('remove strength does not generic fallback', removeDecision.kind !== 'allow_conversation', removeDecision);

  const reduceStrength = draft('make lower body easier');
  const reduceDecision = decideProgramEditDraftFrontDoor(reduceStrength);
  eq('reduce strength decision reaches typed ProgramEdit path', reduceDecision.kind, 'allow_compatibility');
  ok('reduce strength does not generic fallback', reduceDecision.kind !== 'allow_conversation', reduceDecision);
}

section('[11] Stage 3B front door allows supported compatibility paths');
{
  const removeConditioning = draft('remove conditioning today');
  eq('conditioning draft domain', removeConditioning.targetDomain, 'conditioning');
  eq('conditioning front door allows compatibility', decisionKind(removeConditioning), 'allow_compatibility');
  eq('conditioning proposed action only removes conditioning', actionDomains(removeConditioning), [
    'remove:conditioning:conditioning_block',
  ]);

  const removeSession = draft('remove whole session today');
  eq('session draft domain', removeSession.targetDomain, 'session');
  eq('whole-session front door allows compatibility', decisionKind(removeSession), 'allow_compatibility');
  eq('whole-session proposed action removes session', actionDomains(removeSession), [
    'remove:session:whole_session',
  ]);
}

section('[12] Stage 3B ambiguous and compound drafts stop before legacy');
{
  const ambiguousFrame: CoachTargetFrame = {
    resolvedTarget: null,
    confidence: 0,
    targetSource: 'ambiguous',
    missingFields: ['target'],
    candidateOptions: [
      { label: 'Tuesday lower', date: TODAY, sessionName: 'Lower Body Strength' },
      { label: 'Thursday lower', date: '2026-06-25', sessionName: 'Lower Body Strength' },
    ],
    reason: 'test_ambiguous_target',
    explicitDateRole: 'none',
  };
  const ambiguous = draft('remove lower body strength', ambiguousFrame);
  const ambiguousDecision = decideProgramEditDraftFrontDoor(ambiguous);
  eq('ambiguous mutation asks clarification', ambiguousDecision.kind, 'ask_clarification');
  ok('ambiguous draft does not enter compatibility', ambiguousDecision.kind !== 'allow_compatibility', ambiguousDecision);

  const targetFrame = frameForSession('Team Training');
  const compound = draft("I can't make team training tonight, remove it and add conditioning", targetFrame);
  const compoundDecision = decideProgramEditDraftFrontDoor(compound);
  eq('compound draft deferred safely', compoundDecision.kind, 'unsupported');
  ok('compound does not generic fallback', compoundDecision.kind !== 'allow_conversation', compoundDecision);
  ok('compound does not enter compatibility yet', compoundDecision.kind !== 'allow_compatibility', compoundDecision);
}

section('[12b] Resumed draft support gate uses executable action shape');
{
  const baseStrength = draft('keep conditioning but remove lower strength');
  const overMarkedStrength: ProgramEditDraft = {
    ...baseStrength,
    targetDate: '2026-07-06',
    targetSessionId: null,
    targetItemId: null,
    missingFields: ['targetItemId'],
    proposedActions: baseStrength.proposedActions.map((action): ProgramEditDraftAction => ({
      ...action,
      targetDate: '2026-07-06',
      targetSessionId: null,
      targetItemId: null,
    })),
    verifierExpectations: baseStrength.verifierExpectations.map((expectation) => ({
      ...expectation,
      targetDate: '2026-07-06',
    })),
    protectedTargets: baseStrength.protectedTargets.map((target) => ({
      ...target,
      targetDate: '2026-07-06',
    })),
    isCompound: true,
    reason: `${baseStrength.reason}:resumed_semantic_overmarked_compound`,
  };
  eq('over-marked strength draft is not effectively compound',
    isEffectivelyCompoundProgramEditDraft(overMarkedStrength),
    false);
  eq('over-marked strength draft reaches typed finaliser',
    decideProgramEditDraftFrontDoor(overMarkedStrength).kind,
    'allow_compatibility');
  eq('strength targetItemId guard does not ask generic item question',
    decideProgramEditDraftFrontDoor(overMarkedStrength).kind,
    'allow_compatibility');
  const strengthFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'strength',
    editScope: 'remove_strength_block',
    requestedChange: 'unknown',
    targetDate: '2026-07-06',
  });
  eq('over-marked strength draft guard accepts matching strength-block edit',
    validateProgramEditAgainstDraft(overMarkedStrength, strengthFinal).kind,
    'ok');

  const conditioning = draft('remove conditioning today');
  const resumedConditioning: ProgramEditDraft = {
    ...conditioning,
    targetDate: '2026-07-06',
    proposedActions: conditioning.proposedActions.map((action) => ({
      ...action,
      targetDate: '2026-07-06',
    })),
    verifierExpectations: conditioning.verifierExpectations.map((expectation) => ({
      ...expectation,
      targetDate: '2026-07-06',
    })),
    isCompound: false,
  };
  eq('resumed conditioning-block remove reaches finaliser',
    decideProgramEditDraftFrontDoor(resumedConditioning).kind,
    'allow_compatibility');

  const sourceFrame = frameForSession('Team Training');
  const moveAction: ProgramEditDraftAction = {
    intent: 'move',
    targetDomain: 'schedule',
    actionScope: 'whole_session',
    targetDate: '2026-07-06',
    targetSessionId: sourceFrame.resolvedTarget?.itemId ?? null,
    targetItemId: null,
    sourceTarget: sourceFrame.resolvedTarget,
    reason: 'resumed_destination_date',
  };
  const resumedMove: ProgramEditDraft = {
    ...draft('move it to Monday', sourceFrame),
    intent: 'move',
    targetDomain: 'schedule',
    actionScope: 'whole_session',
    targetDate: '2026-07-06',
    targetSessionId: sourceFrame.resolvedTarget?.itemId ?? null,
    targetItemId: null,
    sourceTarget: sourceFrame.resolvedTarget,
    missingFields: [],
    proposedActions: [moveAction],
    verifierExpectations: [{
      kind: 'domain_changed',
      targetDomain: 'schedule',
      actionScope: 'whole_session',
      targetDate: '2026-07-06',
      reason: 'move_session_after_destination_clarification',
    }],
    isCompound: false,
  };
  eq('resumed session move reaches finaliser',
    decideProgramEditDraftFrontDoor(resumedMove).kind,
    'allow_compatibility');

  const reduceDuration = draft('make conditioning easier');
  const resumedReduce: ProgramEditDraft = {
    ...reduceDuration,
    intent: 'reduce',
    targetDomain: 'conditioning',
    actionScope: 'duration',
    targetDate: '2026-07-06',
    missingFields: [],
    proposedActions: [{
      intent: 'edit',
      targetDomain: 'conditioning',
      actionScope: 'duration',
      targetDate: '2026-07-06',
      targetSessionId: reduceDuration.targetSessionId,
      targetItemId: reduceDuration.targetItemId,
      sourceTarget: reduceDuration.sourceTarget,
      reason: 'resumed_reduce_duration',
    }],
    verifierExpectations: [{
      kind: 'domain_changed',
      targetDomain: 'conditioning',
      actionScope: 'duration',
      targetDate: '2026-07-06',
      reason: 'reduce_duration_after_date_clarification',
    }],
    isCompound: false,
  };
  eq('resumed reduce duration reaches finaliser',
    decideProgramEditDraftFrontDoor(resumedReduce).kind,
    'allow_compatibility');

  const actualCompound = draft("I can't make team training tonight, remove it and add conditioning", sourceFrame);
  const resumedCompound: ProgramEditDraft = {
    ...actualCompound,
    targetDate: '2026-07-06',
    proposedActions: actualCompound.proposedActions.map((action) => ({
      ...action,
      targetDate: '2026-07-06',
    })),
    isCompound: true,
  };
  eq('actual resumed compound remains effectively compound',
    isEffectivelyCompoundProgramEditDraft(resumedCompound),
    true);
  eq('actual resumed compound is still safely unsupported',
    decideProgramEditDraftFrontDoor(resumedCompound).kind,
    'unsupported');
}

section('[13] Stage 3C-1 guard blocks draft/final domain mismatches');
{
  const strengthDraft = draft("remove all of today's lower body strength");
  const conditioningFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'conditioning',
    editScope: 'remove_conditioning_item',
    requestedChange: 'type',
  });
  const strengthGuard = validateProgramEditAgainstDraft(strengthDraft, conditioningFinal);
  eq('strength draft cannot finalise as conditioning removal', strengthGuard.kind, 'blocked');
  ok('strength mismatch reply refuses conditioning removal',
    /won't remove conditioning/i.test((strengthGuard as any).reply),
    strengthGuard);
  ok('blocked strength mismatch is not Done',
    !/^Done\b/i.test((strengthGuard as any).reply ?? ''),
    strengthGuard);

  const conditioningDraft = draft('remove conditioning today');
  const strengthFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'strength',
    requestedChange: 'exercise',
  });
  const conditioningGuard = validateProgramEditAgainstDraft(conditioningDraft, strengthFinal);
  eq('conditioning draft cannot finalise as strength removal', conditioningGuard.kind, 'blocked');
  ok('conditioning mismatch reply refuses strength change',
    /won't change strength/i.test((conditioningGuard as any).reply),
    conditioningGuard);
}

section('[14] Stage 3C-1 guard allows matching executable scopes');
{
  const conditioningDraft = draft('remove conditioning today');
  const conditioningFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'conditioning',
    editScope: 'remove_conditioning_item',
    requestedChange: 'type',
  });
  eq('conditioning draft can finalise as conditioning removal',
    validateProgramEditAgainstDraft(conditioningDraft, conditioningFinal).kind,
    'ok');

  const sessionDraft = draft('remove whole session today');
  const sessionFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'session',
    editScope: 'remove_whole_session',
    requestedChange: 'day',
  });
  eq('whole-session draft can finalise as whole-session removal',
    validateProgramEditAgainstDraft(sessionDraft, sessionFinal).kind,
    'ok');
}

section('[15] Stage 3C-1 protected target conflicts block execution');
{
  const keepConditioning = draft('keep conditioning but remove lower strength');
  const conditioningFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'conditioning',
    editScope: 'remove_conditioning_item',
    requestedChange: 'type',
  });
  const guard = validateProgramEditAgainstDraft(keepConditioning, conditioningFinal);
  eq('protected conditioning conflict blocks execution', guard.kind, 'blocked');
  eq('protected conflict route', (guard as any).route, 'program_edit_draft_guard_protected_target_conflict');
  ok('protected conflict does not say Done', !/^Done\b/i.test((guard as any).reply ?? ''), guard);
}

section('[16] Stage 3C-2 visible verifier blocks invisible conditioning removal success');
{
  const conditioningDraft = draft('remove conditioning today');
  const conditioningFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'conditioning',
    editScope: 'remove_conditioning_item',
    requestedChange: 'type',
  });
  const before = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout()),
  ]);
  const after = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout()),
  ]);
  const verification = verifyProgramEditDraftVisibleState({
    draft: conditioningDraft,
    finalEdit: conditioningFinal,
    result: mutatedDone('remove_conditioning:applied'),
    before,
    after,
  });
  eq('conditioning still visible blocks success', verification.ok, false);
  ok('failed verifier reply is not Done', !/^Done\b/i.test((verification as any).reply ?? ''), verification);
}

section('[17] Stage 3C-2 conditioning removal preserves visible strength');
{
  const conditioningDraft = draft('remove conditioning today');
  const conditioningFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'conditioning',
    editScope: 'remove_conditioning_item',
    requestedChange: 'type',
  });
  const before = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout()),
  ]);
  const afterStrengthPreserved = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout({ conditioningName: null })),
  ]);
  const okVerification = verifyProgramEditDraftVisibleState({
    draft: conditioningDraft,
    finalEdit: conditioningFinal,
    result: mutatedDone('remove_conditioning:applied'),
    before,
    after: afterStrengthPreserved,
  });
  eq('conditioning removal with same strength passes', okVerification.ok, true);

  const afterStrengthChanged = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout({
      strengthName: 'Trap Bar Deadlift',
      conditioningName: null,
    })),
  ]);
  const badVerification = verifyProgramEditDraftVisibleState({
    draft: conditioningDraft,
    finalEdit: conditioningFinal,
    result: mutatedDone('remove_conditioning:applied'),
    before,
    after: afterStrengthChanged,
  });
  eq('conditioning removal that changes strength fails', badVerification.ok, false);
  eq('strength protection reason', (badVerification as any).reason, 'protected_domain_changed');
}

section('[18] Stage 3C-2 strength edits must preserve visible conditioning');
{
  const strengthDraft = draft('keep conditioning but remove lower strength');
  const strengthFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'strength',
    requestedChange: 'volume',
  });
  const before = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout()),
  ]);
  const afterConditioningRemoved = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout({
      strengthName: null,
      conditioningName: null,
    })),
  ]);
  const verification = verifyProgramEditDraftVisibleState({
    draft: strengthDraft,
    finalEdit: strengthFinal,
    result: mutatedDone('remove_strength:applied'),
    before,
    after: afterConditioningRemoved,
  });
  eq('strength edit that removes conditioning fails', verification.ok, false);
  eq('empty shell reason wins before protected-domain success', (verification as any).reason, 'empty_session_shell_visible');
}

section('[19] Stage 3C-2 whole-session removal verifies the visible session is gone');
{
  const sessionDraft = draft('remove whole session today');
  const sessionFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'session',
    editScope: 'remove_whole_session',
    requestedChange: 'day',
  });
  const before = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout()),
  ]);
  const afterSessionGone = visibleMap([
    visibleDay(TODAY, null),
  ]);
  const okVerification = verifyProgramEditDraftVisibleState({
    draft: sessionDraft,
    finalEdit: sessionFinal,
    result: mutatedDone('remove_session:applied'),
    before,
    after: afterSessionGone,
  });
  eq('whole session gone passes', okVerification.ok, true);

  const afterOnlyConditioningRemoved = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout({ conditioningName: null })),
  ]);
  const badVerification = verifyProgramEditDraftVisibleState({
    draft: sessionDraft,
    finalEdit: sessionFinal,
    result: mutatedDone('remove_session:applied'),
    before,
    after: afterOnlyConditioningRemoved,
  });
  eq('whole-session draft fails if a session is still visible', badVerification.ok, false);
  eq('whole-session reason', (badVerification as any).reason, 'session_remove_still_visible');
}

section('[20] Stage 3C-2 add conditioning must make conditioning visible');
{
  const addDraft = draft('add conditioning today');
  const addFinal = finalEdit({
    intent: 'add',
    targetDomain: 'conditioning',
    editScope: 'add_conditioning_item',
    requestedChange: 'type',
  });
  const before = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout({ conditioningName: null })),
  ]);
  const afterVisible = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout()),
  ]);
  eq('add conditioning visible passes',
    verifyProgramEditDraftVisibleState({
      draft: addDraft,
      finalEdit: addFinal,
      result: mutatedDone('add_conditioning:applied'),
      before,
      after: afterVisible,
    }).ok,
    true);

  const afterUnchanged = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout({ conditioningName: null })),
  ]);
  const failed = verifyProgramEditDraftVisibleState({
    draft: addDraft,
    finalEdit: addFinal,
    result: mutatedDone('add_conditioning:applied'),
    before,
    after: afterUnchanged,
  });
  eq('add conditioning invisible fails', failed.ok, false);
  eq('add invisible reason', (failed as any).reason, 'domain_add_not_visible');
}

section('[21] Stage 3C-2 move verifies source and destination visible state');
{
  const tomorrow = '2026-06-24';
  const targetFrame = frameForSession('Easy Aerobic Flush');
  const moveDraft = draft('move it to tomorrow', targetFrame);
  const moveFinal = finalEdit({
    intent: 'move',
    targetDomain: 'schedule',
    requestedChange: 'day',
    targetDate: TODAY,
    command: {
      mode: 'mutate',
      operation: 'move_session',
      target: { kind: 'date', date: TODAY, sessionName: 'Easy Aerobic Flush' },
      payload: { operation: 'move_session', toDate: tomorrow },
      scope: 'one_off',
      confidence: 0.9,
      needsClarification: false,
      reason: 'test move final edit',
    },
  });
  const before = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout({
      strengthName: null,
      conditioningName: 'Easy Aerobic Flush',
      type: 'Conditioning',
    })),
    visibleDay(tomorrow, null, false),
  ]);
  const afterMoved = visibleMap([
    visibleDay(TODAY, null),
    visibleDay(tomorrow, strengthConditioningWorkout({
      strengthName: null,
      conditioningName: 'Easy Aerobic Flush',
      type: 'Conditioning',
    }), false),
  ]);
  eq('move with source cleared and destination visible passes',
    verifyProgramEditDraftVisibleState({
      draft: moveDraft,
      finalEdit: moveFinal,
      result: mutatedDone('move_session:applied'),
      before,
      after: afterMoved,
    }).ok,
    true);

  const afterDuplicated = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout({
      strengthName: null,
      conditioningName: 'Easy Aerobic Flush',
      type: 'Conditioning',
    })),
    visibleDay(tomorrow, strengthConditioningWorkout({
      strengthName: null,
      conditioningName: 'Easy Aerobic Flush',
      type: 'Conditioning',
    }), false),
  ]);
  const failed = verifyProgramEditDraftVisibleState({
    draft: moveDraft,
    finalEdit: moveFinal,
    result: mutatedDone('move_session:applied'),
    before,
    after: afterDuplicated,
  });
  eq('move fails when source still shows moved session', failed.ok, false);
}

section('[22] Stage 3C-2 visible verifier blocks empty parent shells');
{
  const conditioningDraft = draft('remove conditioning today');
  const conditioningFinal = finalEdit({
    intent: 'remove',
    targetDomain: 'conditioning',
    editScope: 'remove_conditioning_item',
    requestedChange: 'type',
  });
  const before = visibleMap([
    visibleDay(TODAY, strengthConditioningWorkout({
      strengthName: null,
      conditioningName: 'Easy Aerobic Flush',
      type: 'Conditioning',
    })),
  ]);
  const afterEmptyShell = visibleMap([
    visibleDay(TODAY, emptyWorkoutShell('Easy Aerobic Flush', 'Conditioning')),
  ]);
  const failed = verifyProgramEditDraftVisibleState({
    draft: conditioningDraft,
    finalEdit: conditioningFinal,
    result: mutatedDone('remove_conditioning:applied'),
    before,
    after: afterEmptyShell,
  });
  eq('empty parent shell after conditioning removal fails', failed.ok, false);
  eq('empty shell reason', (failed as any).reason, 'empty_session_shell_visible');
  ok('empty shell failure is not Done', !/^Done\b/i.test((failed as any).reply ?? ''), failed);

  const afterRest = visibleMap([
    visibleDay(TODAY, null),
  ]);
  eq('conditioning-only removal passes when projected day is Rest',
    verifyProgramEditDraftVisibleState({
      draft: conditioningDraft,
      finalEdit: conditioningFinal,
      result: mutatedDone('remove_conditioning:applied'),
      before,
      after: afterRest,
    }).ok,
    true);
}

section('[23] Stage 3C-2 controller visible gate runs before success reply handling');
{
  const source = readFileSync('src/utils/coachTurnController.ts', 'utf8');
  const wrapperIdx = source.indexOf('function executeProgramEditWithVisibleGuard');
  const executeIdx = source.indexOf('const result = executeProgramEdit({', wrapperIdx);
  const visibleGuardIdx = source.indexOf('const verification = verifyDraftVisibleExecution', executeIdx);
  const recordIdx = source.indexOf('recordVerifiedProgramEditMutationFocus', visibleGuardIdx);
  const replyIdx = source.indexOf("return replyAndFinish(input, 'router'", visibleGuardIdx);
  const rawExecuteCalls = (source.match(/executeProgramEdit\(\{/g) ?? []).length;
  const guardedCalls = (source.match(/executeProgramEditWithVisibleGuard\(\{/g) ?? []).length;
  const programTabResolverIdx = source.indexOf('function resolveLiveProgramTabVisibleDayForDate');
  const programTabProjectionIdx = source.indexOf('buildProgramTabProjectedWeek({', programTabResolverIdx);
  const snapshotUsesProgramTabIdx = source.indexOf('resolveLiveProgramTabVisibleDayForDate(date, todayISO)');
  const afterUsesProgramTabIdx = source.indexOf('resolveLiveProgramTabVisibleDayForDate(date, args.todayISO)');
  ok('raw executeProgramEdit only exists inside the guarded wrapper', rawExecuteCalls === 1, {
    rawExecuteCalls,
  });
  ok('controller mutation paths use guarded wrapper', guardedCalls >= 4, {
    guardedCalls,
  });
  ok('visible verifier runs after raw executeProgramEdit inside wrapper', visibleGuardIdx > executeIdx, {
    executeIdx,
    visibleGuardIdx,
  });
  ok('visible verifier runs before mutation focus recording', visibleGuardIdx >= 0 && visibleGuardIdx < recordIdx, {
    visibleGuardIdx,
    recordIdx,
  });
  ok('visible verifier runs before router success reply', visibleGuardIdx >= 0 && visibleGuardIdx < replyIdx, {
    visibleGuardIdx,
    replyIdx,
  });
  ok('visible verifier resolves Program tab projected week', programTabProjectionIdx > programTabResolverIdx, {
    programTabResolverIdx,
    programTabProjectionIdx,
  });
  ok('before snapshot uses Program tab projection', snapshotUsesProgramTabIdx > programTabResolverIdx, {
    snapshotUsesProgramTabIdx,
  });
  ok('after snapshot uses Program tab projection', afterUsesProgramTabIdx > programTabResolverIdx, {
    afterUsesProgramTabIdx,
  });
  ok('visible verifier failure blocks Done replies', /resultReplyWasDone:\s*\/\^Done/.test(source));
}

console.log('\n-- Summary --');
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('\n-- Failures --');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
