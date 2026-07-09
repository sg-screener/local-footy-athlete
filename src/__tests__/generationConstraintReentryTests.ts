(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { OnboardingData } from '../types/domain';
import type {
  ActiveConstraint,
  ActiveFatigueConstraint,
  ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
} from '../utils/coachingEngine';
import {
  applyGenerationConstraintsToProfile,
  buildGenerationConstraintContext,
} from '../utils/generationConstraints';
import { generateProgramLocally } from '../services/api/generateProgram';

const TODAY = '2026-07-06';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  fail ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

const BASE_PROFILE: OnboardingData = {
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  sessionDurationMinutes: 60,
  trainingLocation: 'Commercial gym',
  equipment: ['Barbell', 'Dumbbells', 'Bench', 'Cable machine'],
  experienceLevel: '2-5 years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Good',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Strength, speed, repeat efforts',
};

function injury(
  bodyPart: string,
  severity: number,
  triggers: string[] = [],
): ActiveInjuryConstraint {
  return {
    id: `injury-${bodyPart}-${severity}`,
    type: 'injury',
    bodyPart,
    bucket: bodyPart as any,
    severity,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: TODAY,
    triggers,
    rules: triggers,
    safeFocus: [],
    advice: [],
  };
}

function fatigue(
  severity: number,
  label: string,
  rules: string[],
): ActiveFatigueConstraint {
  return {
    id: `fatigue-${severity}`,
    type: 'fatigue',
    severity,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: TODAY,
    reasonLabel: label,
    source: 'tap',
    rules,
    safeFocus: ['Main lift if moving well', 'Easy aerobic conditioning'],
    advice: [],
  };
}

function planFor(constraints: ActiveConstraint[]): CoachingPlan {
  const context = buildGenerationConstraintContext({
    activeConstraints: constraints,
    todayISO: TODAY,
  });
  const profile = applyGenerationConstraintsToProfile(BASE_PROFILE, context);
  return buildCoachingPlan(onboardingToCoachingInputs(profile, {
    availabilityDateISO: TODAY,
    generationConstraints: context,
  }));
}

function planText(plan: CoachingPlan): string {
  return plan.weeklyPlan.map((session) =>
    [
      session.dayOfWeek,
      session.tier,
      session.focus,
      session.strengthPattern,
      session.conditioningCategory,
      session.conditioningVariant,
      session.ergModality,
    ].filter(Boolean).join(' '),
  ).join(' | ');
}

function categories(plan: CoachingPlan): string[] {
  return plan.weeklyPlan
    .map((session) => session.conditioningCategory)
    .filter((value): value is string => !!value);
}

function hasStrength(plan: CoachingPlan, pattern: RegExp): boolean {
  return plan.weeklyPlan.some((session) =>
    pattern.test(`${session.focus} ${session.strengthPattern ?? ''}`),
  );
}

function hasAnyUsefulWork(plan: CoachingPlan): boolean {
  return plan.weeklyPlan.some((session) =>
    session.strengthPattern || session.conditioningCategory || session.tier === 'optional',
  );
}

console.log('\n-- Generation re-entry constraints --');

{
  const healthy = planFor([]);
  ok('healthy week still has strength', healthy.weeklyPlan.some((s) => !!s.strengthPattern), planText(healthy));
  ok('healthy week still has conditioning', categories(healthy).length > 0, planText(healthy));
}

{
  const hamstring = planFor([
    injury('hamstring', 4, ['sprinting', 'heavy hinge', 'nordics']),
  ]);
  const text = planText(hamstring);
  ok('4/10 hamstring changes generation away from sprint/heavy hinge',
    !/\bsprint|hip-dominant|hinge|nordic|hamstring/i.test(text),
    text);
  ok('4/10 hamstring still keeps unaffected upper work',
    hasStrength(hamstring, /upper|push|pull/i),
    text);
}

{
  const severeHamstring = planFor([
    injury('hamstring', 9, ['sprinting', 'heavy hinge', 'nordics']),
  ]);
  const text = planText(severeHamstring);
  ok('9/10 hamstring pauses affected lower area',
    !/lower|squat|hinge|full body|sprint/i.test(text),
    text);
  ok('9/10 hamstring still keeps safe unaffected work',
    hasAnyUsefulWork(severeHamstring),
    text);
}

{
  const shoulder = planFor([
    injury('shoulder', 5, ['pressing', 'overhead', 'dips']),
  ]);
  const text = planText(shoulder);
  ok('shoulder issue avoids painful pressing',
    !/push emphasis|bench|OHP|dips|combined push/i.test(text),
    text);
  ok('shoulder issue preserves lower work',
    hasStrength(shoulder, /lower|squat|hinge/i),
    text);
}

{
  const knee = planFor([
    injury('knee', 5, ['jumping', 'change of direction', 'deep knee work']),
  ]);
  const text = planText(knee);
  ok('knee issue avoids sprint/COD/knee-dominant work',
    !/\bsprint|squat emphasis|combined squat|full body/i.test(text),
    text);
  ok('knee issue preserves upper work',
    hasStrength(knee, /upper|push|pull/i),
    text);
  ok('knee issue keeps conditioning off hard categories',
    categories(knee).every((category) => category === 'aerobic_base' || category === 'tempo'),
    text);
}

{
  const lowReadiness = planFor([
    fatigue(7, 'Load reduced', ['max-effort lifts', 'hard conditioning + sprints']),
  ]);
  const text = planText(lowReadiness);
  ok('low readiness removes hard conditioning/sprint before generation',
    categories(lowReadiness).every((category) => category === 'aerobic_base' || category === 'tempo'),
    text);
  ok('low readiness keeps main strength work',
    lowReadiness.weeklyPlan.some((session) => !!session.strengthPattern),
    text);
}

{
  const hamstringProgram = generateProgramLocally(BASE_PROFILE, {
    todayISO: TODAY,
    blockNumber: 1,
    activeConstraints: [
      injury('hamstring', 6, ['sprinting', 'heavy hinge', 'nordics']),
    ],
    readinessSignal: null,
  });
  const firstWeekText = JSON.stringify(hamstringProgram.microcycles[0]?.workouts ?? []);
  ok('hamstring generated workouts preserve upper work',
    /Upper/.test(firstWeekText),
    firstWeekText);
  ok('hamstring generated workouts include easy off-feet conditioning',
    /Easy Aerobic Flush|bike|row|ski/i.test(firstWeekText),
    firstWeekText);
  ok('hamstring generated workouts avoid Nordics/heavy hinge/sprint',
    !/Nordic|RDL|Flying Sprint|Free Sprint|sprint exposure/i.test(firstWeekText),
    firstWeekText);
}

console.log(`\ngenerationConstraintReentryTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  throw new Error(`generationConstraintReentryTests failed: ${fail} (${failures.join(', ')})`);
}
