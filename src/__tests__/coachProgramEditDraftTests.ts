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
  const routerIdx = source.indexOf('const routedProgramEdit = interpretCoachMessageToProgramEdit', draftIdx);
  ok('controller logs draft seam', draftIdx >= 0);
  ok('draft seam precedes old router compatibility', draftIdx >= 0 && routerIdx >= 0 && draftIdx < routerIdx, {
    draftIdx,
    routerIdx,
  });
}

console.log('\n-- Summary --');
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('\n-- Failures --');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
