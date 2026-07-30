/**
 * THE EQUIPMENT ANSWER — a typed athlete decision, resolved by one derivation.
 *
 * SAM'S RULING 2, 2026-07-31 (`docs/EQUIPMENT_OWNERSHIP_SHEET_2026-07-31.md` §2):
 * equipment becomes an onboarding step + profile surface on the HAVE / NEVER /
 * THIS-WEEK model. HAVE and NEVER are profile answers with different silences
 * (unchecked = "not today", NEVER = "stop offering, permanently"); THIS-WEEK
 * stays the dated life-fact that already exists. Availability is derived:
 *
 *   availableEquipment(date) = derive(HAVE, NEVER, active temporary facts, date)
 *
 * The founding complaint is pinned here as a law: on the answered path, NO
 * location, NO constant and NO union branch may put a ski erg (or anything
 * else) on an athlete who did not say they have one.
 *
 * DEPTH (L13): 0-1 — pure resolver over constructed profiles, plus temporary
 * constraints layered on an answer. Accumulated-state coverage arrives with
 * the walker's onboarding vocabulary in the step stage.
 *
 * Run: npm run test:equipment-answer
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import type { EquipmentAnswer, OnboardingData } from '../types/domain';
import {
  equipmentAnswered,
  resolveEquipmentCapabilities,
  buildTemporaryEquipmentConstraint,
} from '../utils/equipmentAvailability';

let passed = 0; const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail !== undefined ? `\n      ${
    typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

function answered(partial: Partial<EquipmentAnswer>): OnboardingData {
  return {
    equipmentAnswer: {
      tags: {},
      modalities: {},
      answeredOn: '2026-07-31',
      ...partial,
    },
  } as OnboardingData;
}

const DATE = '2026-07-31';

console.log('\n[1] THE ANSWERED PATH — the athlete\'s kit, nothing else');
{
  const profile = answered({
    tags: { barbell: 'have', dumbbells: 'have', bench: 'have', machine: 'never' },
    modalities: { bike: 'have', ski: 'never' },
  });
  const resolved = resolveEquipmentCapabilities(profile, null, DATE);
  ok('tags are bodyweight + HAVE tags + the derived coarse tag, exactly',
    JSON.stringify([...resolved.tags].sort()) ===
      JSON.stringify(['barbell', 'bench', 'bike_or_treadmill', 'bodyweight', 'dumbbells'].sort()),
    resolved.tags);
  ok('modalities are the HAVE modalities, exactly',
    JSON.stringify(resolved.conditioningModalities) === JSON.stringify(['bike']),
    resolved.conditioningModalities);
  ok('the answered path reports itself', resolved.source === 'athlete_answer');
  ok('an answered profile is complete by construction',
    resolved.selectionCompleteness === 'complete');
}

console.log('\n[2] THE FOUNDING COMPLAINT, PINNED — no answer, no ski erg');
{
  // A Commercial-gym location on the profile must be POWERLESS on the
  // answered path: the athlete said what they have, and it did not include
  // a ski erg, a rower, or a treadmill.
  const profile = {
    ...answered({ tags: { dumbbells: 'have' }, modalities: {} }),
    trainingLocation: 'Commercial gym',
  } as OnboardingData;
  const resolved = resolveEquipmentCapabilities(profile, null, DATE);
  ok('no conditioning machine appears from location',
    resolved.conditioningModalities.length === 0, resolved.conditioningModalities);
  ok('no machine tags appear from location',
    !resolved.tags.includes('machine') && !resolved.tags.includes('cables') &&
      !resolved.tags.includes('bike_or_treadmill'),
    resolved.tags);
}

console.log('\n[3] SILENCES — NEVER resolves like absent, and "nothing" is an answer');
{
  const never = answered({ tags: { barbell: 'have', kettlebell: 'never' }, modalities: {} });
  const absent = answered({ tags: { barbell: 'have' }, modalities: {} });
  ok('NEVER and unchecked resolve to the same capabilities (the difference is the asking, not the programming)',
    JSON.stringify(resolveEquipmentCapabilities(never, null, DATE).tags) ===
      JSON.stringify(resolveEquipmentCapabilities(absent, null, DATE).tags));

  const nothing = answered({ tags: {}, modalities: {} });
  const resolved = resolveEquipmentCapabilities(nothing, null, DATE);
  ok('an athlete who owns nothing gets bodyweight and nothing else',
    JSON.stringify(resolved.tags) === JSON.stringify(['bodyweight']) &&
      resolved.conditioningModalities.length === 0,
    resolved);
  ok('owning nothing is still ANSWERED — refusal is for silence, not poverty',
    equipmentAnswered(nothing));
}

console.log('\n[4] ANSWERED — the predicate generation\'s refusal will read');
{
  ok('an empty profile has not answered', !equipmentAnswered({} as OnboardingData));
  ok('null has not answered', !equipmentAnswered(null));
  // The 8-tag store constant is UNAUTHORED — nobody answered it. It must not
  // count, or every existing install inherits the fantasy gym as an "answer".
  ok('the legacy 8-tag store constant is NOT an answer',
    !equipmentAnswered({
      trainingLocation: 'Commercial gym',
      equipment: [
        'barbell', 'dumbbells', 'squat_rack', 'pullup_bar',
        'cable_machine', 'hamstring_curl', 'knee_extension', 'bands',
      ],
    } as OnboardingData));
  // An explicit complete selection was a real decision (the coach baseline
  // door writes this shape) — it lifts, read-ingress only (L15).
  ok('a legacy explicit-complete selection IS an answer',
    equipmentAnswered({
      equipment: ['Dumbbells Only'],
      equipmentSelectionCompleteness: 'complete',
    } as OnboardingData));
  ok('a typed answer IS an answer', equipmentAnswered(answered({})));
}

console.log('\n[5] PRECEDENCE — the typed decision outranks every legacy shape');
{
  const both = {
    ...answered({ tags: { bands: 'have' }, modalities: {} }),
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    trainingLocation: 'Commercial gym',
  } as OnboardingData;
  const resolved = resolveEquipmentCapabilities(both, null, DATE);
  ok('the typed answer wins over a legacy checklist beside it',
    JSON.stringify([...resolved.tags].sort()) === JSON.stringify(['bands', 'bodyweight']) &&
      resolved.source === 'athlete_answer',
    resolved);
}

console.log('\n[6] THIS-WEEK — temporary facts still constrain the answered kit');
{
  const profile = answered({
    tags: { barbell: 'have', dumbbells: 'have' },
    modalities: { row: 'have' },
  });
  const constraint = buildTemporaryEquipmentConstraint({
    presetId: 'no_barbell_rack',
    date: DATE,
    todayISO: `${DATE}T09:00:00.000Z`,
  });
  const resolved = resolveEquipmentCapabilities(profile, [constraint], DATE);
  ok('a without-constraint removes the tag from an answered kit',
    !resolved.tags.includes('barbell') && resolved.tags.includes('dumbbells'),
    resolved.tags);
  ok('the constraint does not resurrect anything unanswered',
    !resolved.tags.includes('cables') && resolved.conditioningModalities.length === 1,
    resolved);
}

console.log('\n[7] THE STEP — required, registered, and answered by the same predicate');
{
  // Imported late so the pure-resolver sections above stay store-free.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    ONBOARDING_STEPS,
    resolveOnboardingResumeStep,
    missingRequiredProfileFields,
  } = require('../utils/onboardingSteps') as typeof import('../utils/onboardingSteps');

  const step = ONBOARDING_STEPS.find((candidate) => candidate.name === 'Equipment');
  ok('the Equipment step exists in the registry', !!step);
  ok('it collects the typed answer and nothing else',
    JSON.stringify(step?.collects) === JSON.stringify(['equipmentAnswer']));
  ok('it is visible for every athlete — required means no skip path',
    !!step && step.visible({} as OnboardingData));
  ok('an unanswered profile leaves the step unsatisfied',
    !!step && !step.satisfied({} as OnboardingData));
  ok('the 8-tag store constant does not satisfy it',
    !!step && !step.satisfied({
      equipment: [
        'barbell', 'dumbbells', 'squat_rack', 'pullup_bar',
        'cable_machine', 'hamstring_curl', 'knee_extension', 'bands',
      ],
    } as OnboardingData));
  ok('the typed answer satisfies it', !!step && step.satisfied(answered({})));
  ok('a legacy explicitly-complete selection satisfies it (no re-march)',
    !!step && step.satisfied({
      equipment: ['Dumbbells Only'], equipmentSelectionCompleteness: 'complete',
    } as OnboardingData));

  // Resume and the generator's required-set both derive from the registry, so
  // one assertion each proves the refusal owner sees the new answer.
  const unansweredButOtherwiseDone = {
    firstName: 'A', heightCm: 180, weightKg: 80, position: 'inside_mid',
    goals: ['stay_consistent'], seasonPhase: 'Off-season',
    trainingDaysPerWeek: 3, preferredTrainingDays: ['Monday'],
    experienceLevel: '2-5 years', squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
    twoKmTimeTrial: { seconds: 480, recordedOn: '2026-07-31', source: 'onboarding' },
    conditioningLevel: 'Good', sprintExposure: 'Weekly',
    recentTrainingLoad: 'Somewhat consistent', injuries: [],
  } as unknown as OnboardingData;
  ok('an interrupted flow resumes onto Equipment when it is the one unanswered step',
    resolveOnboardingResumeStep(unansweredButOtherwiseDone) === 'Equipment',
    resolveOnboardingResumeStep(unansweredButOtherwiseDone));
  ok('the generator required-set names the missing answer',
    missingRequiredProfileFields(unansweredButOtherwiseDone).includes('equipmentAnswer'));
  ok('answering clears it',
    !missingRequiredProfileFields({
      ...unansweredButOtherwiseDone,
      ...answered({}),
    }).includes('equipmentAnswer'));
}

console.log(`\n${failures.length === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
