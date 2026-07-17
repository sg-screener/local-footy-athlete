/**
 * Protected-domain verifier invariants for stacked mixed sessions.
 * Run: npm run test:coach-visible-domain-verifier
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { ResolvedDay } from '../utils/sessionResolver';
import type { ProgramEditDraft } from '../utils/coachProgramEditDraft';
import {
  fingerprintVisibleProgramDay,
  verifyProgramEditDraftVisibleState,
  type CoachVisibleDomainSnapshotMap,
} from '../utils/coachVisibleDomainVerifier';

const DATE = '2026-07-20';
let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  fail += 1;
  failures.push(`${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  console.error(`  FAIL ${name}`, detail ?? '');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function row(args: {
  id: string;
  name: string;
  order: number;
  conditioning?: boolean;
}): any {
  return {
    id: args.id,
    workoutId: 'stacked-workout',
    exerciseId: args.id,
    exerciseOrder: args.order,
    prescribedSets: args.conditioning ? 6 : 3,
    prescribedRepsMin: args.conditioning ? 30 : 5,
    prescribedRepsMax: args.conditioning ? 30 : 8,
    prescribedWeightKg: args.conditioning ? null : 60,
    restSeconds: args.conditioning ? 60 : 120,
    prescriptionType: args.conditioning ? 'duration' : 'reps',
    intensity: args.conditioning ? 'Hard' : 'Moderate',
    exercise: {
      id: args.id,
      name: args.name,
      description: args.name,
      equipmentRequired: [args.conditioning ? 'Assault Bike' : 'Barbell'],
    },
    createdAt: '',
    updatedAt: '',
  };
}

function mixedWorkout(args: {
  scenario?: string;
  fixture?: boolean;
  strength?: boolean;
  conditioning?: boolean;
  power?: boolean;
  recovery?: boolean;
} = {}): any {
  const strength = args.strength ?? true;
  const conditioning = args.conditioning ?? true;
  const conditioningRows = conditioning
    ? [
        row({ id: 'bike-left', name: 'Assault Bike Sprint Left', order: 4, conditioning: true }),
        row({ id: 'bike-right', name: 'Assault Bike Sprint Right', order: 5, conditioning: true }),
      ]
    : [];
  return {
    id: 'stacked-workout',
    planEntryId: 'stacked-plan-entry',
    microcycleId: 'stacked-week',
    dayOfWeek: 1,
    name: strength ? 'Lower Body Strength' : 'Assault Bike Sprints',
    description: `Mixed ${args.scenario ?? 'in-season'} ${args.fixture ? 'fixture' : 'no-fixture'} session`,
    durationMinutes: 70,
    intensity: 'Moderate',
    strengthIntensity: strength ? 'Moderate' : undefined,
    workoutType: strength ? 'Strength' : 'Conditioning',
    sessionTier: 'core',
    strengthIntent: strength ? `${args.scenario ?? 'in-season'}-strength` : undefined,
    strengthPatternContributions: strength ? ['squat', 'hinge'] : undefined,
    conditioningBlock: conditioning
      ? {
          intent: `${args.scenario ?? 'in-season'}-${args.fixture ? 'fixture' : 'no-fixture'}`,
          attachedKind: 'post_strength',
          options: [{
            title: 'Assault Bike Sprints',
            description: '6 x 30 sec hard, 60 sec easy',
            exerciseIds: conditioningRows.map((item) => item.id),
            durationMinutes: 18,
            intensity: 'Hard',
          }],
        }
      : undefined,
    powerBlock: args.power === false
      ? undefined
      : { kind: 'primer', intensity: 'Fast', durationMinutes: 8, sets: 2 },
    recoveryAddons: args.recovery === false
      ? undefined
      : [{ focus: 'adductors', intensity: 'Light', durationMinutes: 8 }],
    exercises: [
      ...(strength
        ? [
            row({ id: 'back-squat', name: 'Back Squat', order: 0 }),
            row({ id: 'romanian-deadlift', name: 'Romanian Deadlift', order: 1 }),
          ]
        : []),
      ...conditioningRows,
    ],
    createdAt: '',
    updatedAt: '',
  };
}

function day(workout: any): ResolvedDay {
  return {
    date: DATE,
    dayOfWeek: 1,
    short: 'MON',
    isToday: false,
    workout,
    source: 'template',
    indicator: null,
  } as any;
}

function visibleMap(workout: any): CoachVisibleDomainSnapshotMap {
  return { [DATE]: fingerprintVisibleProgramDay(day(workout)) };
}

function draft(args: {
  remove: 'strength' | 'conditioning';
  protect?: Array<'strength' | 'conditioning' | 'recovery'>;
}): ProgramEditDraft {
  const targetDomain = args.remove;
  const actionScope = targetDomain === 'strength' ? 'strength_block' : 'conditioning_block';
  const protectedDomains = args.protect ?? [targetDomain === 'strength' ? 'conditioning' : 'strength'];
  return {
    intent: 'remove',
    targetDomain,
    actionScope,
    targetDate: DATE,
    targetSessionId: 'stacked-plan-entry',
    targetItemId: null,
    sourceTarget: null,
    explicitDateRole: 'referent',
    explicitUserWording: `remove ${targetDomain}`,
    missingFields: [],
    confidence: 1,
    protectedTargets: protectedDomains.map((domain) => ({
      targetDomain: domain,
      actionScope: domain === 'strength'
        ? 'strength_block'
        : domain === 'conditioning'
          ? 'conditioning_block'
          : undefined,
      targetDate: DATE,
      targetItemId: null,
      reason: `preserve_${domain}`,
    })),
    constraints: protectedDomains.map((domain) => `keep ${domain}`),
    proposedActions: [{
      intent: 'remove',
      targetDomain,
      actionScope,
      targetDate: DATE,
      targetSessionId: 'stacked-plan-entry',
      targetItemId: null,
      sourceTarget: null,
      reason: `remove_${targetDomain}`,
    }],
    verifierExpectations: [
      {
        kind: 'domain_changed',
        targetDomain,
        actionScope,
        targetDate: DATE,
        reason: `remove_${targetDomain}`,
      },
      ...protectedDomains.map((domain) => ({
        kind: 'domain_unchanged' as const,
        targetDomain: domain,
        actionScope: domain === 'strength'
          ? 'strength_block' as const
          : domain === 'conditioning'
            ? 'conditioning_block' as const
            : undefined,
        targetDate: DATE,
        reason: `preserve_${domain}`,
      })),
    ],
    isCompound: false,
    reason: `remove_${targetDomain}_preserve_other_domains`,
  };
}

function verify(args: {
  before: any;
  after: any;
  remove: 'strength' | 'conditioning';
  protect?: Array<'strength' | 'conditioning' | 'recovery'>;
}) {
  return verifyProgramEditDraftVisibleState({
    draft: draft({ remove: args.remove, protect: args.protect }),
    finalEdit: {
      intent: 'remove',
      targetDomain: args.remove,
      editScope: args.remove === 'strength' ? 'remove_strength_block' : 'remove_conditioning_item',
      targetDate: DATE,
    } as any,
    result: {
      kind: 'mutated',
      applied: true,
      route: `remove_${args.remove}:applied`,
      reply: 'Done.',
    },
    before: visibleMap(args.before),
    after: visibleMap(args.after),
  });
}

console.log('\n[1] symmetric protected-domain removal');
const mixed = mixedWorkout();
check('strength removal preserves identical conditioning after global renumbering',
  verify({
    before: mixed,
    after: mixedWorkout({ strength: false }),
    remove: 'strength',
  }).ok);
check('conditioning removal preserves identical strength',
  verify({
    before: mixed,
    after: mixedWorkout({ conditioning: false }),
    remove: 'conditioning',
  }).ok);
check('earlier strength removal preserves later recovery after global renumbering',
  verify({
    before: mixed,
    after: mixedWorkout({ strength: false }),
    remove: 'strength',
    protect: ['conditioning', 'recovery'],
  }).ok);

console.log('\n[2] genuine protected-conditioning changes fail closed');
const protectedChangeCases: Array<[string, (candidate: any) => void]> = [
  ['identity', (candidate) => {
    candidate.conditioningBlock.options[0].exerciseIds[0] = 'different-bike';
    candidate.exercises[0].id = 'different-bike';
    candidate.exercises[0].exerciseId = 'different-bike';
  }],
  ['exercise', (candidate) => { candidate.exercises[0].exercise.name = 'Rower Intervals'; }],
  ['duration', (candidate) => { candidate.conditioningBlock.options[0].durationMinutes = 20; }],
  ['intensity', (candidate) => { candidate.conditioningBlock.options[0].intensity = 'Easy'; }],
  ['metadata', (candidate) => { candidate.conditioningBlock.options[0].description = 'Changed work'; }],
  ['modality', (candidate) => { candidate.exercises[0].exercise.equipmentRequired = ['Rower']; }],
  ['prescription', (candidate) => { candidate.exercises[0].restSeconds = 45; }],
  ['exercise-order', (candidate) => {
    candidate.exercises[0].exerciseOrder = 5;
    candidate.exercises[1].exerciseOrder = 4;
  }],
];
for (const [name, mutate] of protectedChangeCases) {
  const after = mixedWorkout({ strength: false });
  mutate(after);
  const result = verify({ before: mixed, after, remove: 'strength' });
  check(`${name} change is rejected`,
    result.ok === false && result.reason === 'protected_domain_changed',
    result);
}

console.log('\n[3] cross-phase and fixture matrix');
const scenarios = [
  { name: 'in-season fixture week', fixture: true },
  { name: 'in-season no-fixture week', fixture: false },
  { name: 'early pre-season', fixture: false },
  { name: 'mid pre-season', fixture: true },
  { name: 'late pre-season', fixture: true },
  { name: 'early off-season', fixture: false },
  { name: 'mid off-season', fixture: false },
  { name: 'late off-season', fixture: false },
] as const;
for (const scenario of scenarios) {
  const before = mixedWorkout({ scenario: scenario.name, fixture: scenario.fixture });
  const after = mixedWorkout({
    scenario: scenario.name,
    fixture: scenario.fixture,
    strength: false,
  });
  check(`${scenario.name} preserves stacked conditioning`,
    verify({ before, after, remove: 'strength' }).ok);
}

console.log(`\ncoachVisibleDomainVerifierTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
