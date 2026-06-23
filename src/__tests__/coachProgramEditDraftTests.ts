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
  type ProgramEditDraft,
} from '../utils/coachProgramEditDraft';

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
  const routerIdx = source.indexOf('const routedProgramEdit = interpretCoachMessageToProgramEdit', draftIdx);
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
  ok('draft front door marks legacy blocked', /legacyBlocked:\s*true/.test(source));
}

section('[10] Stage 3B front door blocks unsafe strength-block edits');
{
  const removeStrength = draft('remove lower body strength');
  const removeDecision = decideProgramEditDraftFrontDoor(removeStrength);
  eq('remove strength decision is unsupported', removeDecision.kind, 'unsupported');
  ok('remove strength does not enter compatibility executor', removeDecision.kind !== 'allow_compatibility', removeDecision);
  ok('remove strength reply preserves conditioning concept', /conditioning alone/i.test((removeDecision as any).reply), removeDecision);

  const reduceStrength = draft('make lower body easier');
  const reduceDecision = decideProgramEditDraftFrontDoor(reduceStrength);
  eq('reduce strength decision is unsupported', reduceDecision.kind, 'unsupported');
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

console.log('\n-- Summary --');
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('\n-- Failures --');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
