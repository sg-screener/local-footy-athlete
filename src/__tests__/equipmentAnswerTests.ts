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

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { EquipmentAnswer, OnboardingData } from '../types/domain';
import {
  equipmentAnswered,
  resolveEquipmentCapabilities,
  buildActiveEquipmentConstraint,
  temporaryEquipmentConstraintIdForDate,
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
    modalities: { bike_erg: 'have', ski: 'never' },
  });
  const resolved = resolveEquipmentCapabilities(profile, null, DATE);
  ok('tags are bodyweight + HAVE tags + the derived coarse tag, exactly',
    JSON.stringify([...resolved.tags].sort()) ===
      JSON.stringify(['barbell', 'bench', 'bike_or_treadmill', 'bodyweight', 'dumbbells'].sort()),
    resolved.tags);
  ok('modalities are the HAVE modalities, exactly',
    JSON.stringify(resolved.conditioningModalities) === JSON.stringify(['bike_erg']),
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
  // Built the way the retired preset used to: a this-week 'without' over the
  // athlete's own barbell. The presets are gone (ruling 5); the constraint
  // shape they produced is unchanged.
  const constraint = buildActiveEquipmentConstraint({
    id: temporaryEquipmentConstraintIdForDate(DATE),
    mode: 'without',
    tags: ['barbell'],
    source: 'tap',
    startDate: DATE,
    nowISO: `${DATE}T09:00:00.000Z`,
    scope: 'this_week',
    modifierAffects: ['current_week'],
    reasonLabel: 'Missing this week',
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
  const unansweredButOtherwiseDone: OnboardingData = {
    // R-130: every OTHER step answered, gender included — the cell's whole
    // claim is that Equipment is the ONE unanswered step.
    firstName: 'A', gender: 'male', heightCm: 180, weightKg: 80, position: 'inside_mid',
    goals: ['stay_consistent'], seasonPhase: 'Off-season', seasonFinishedOn: '2026-07-01',
    trainingDaysPerWeek: 3, preferredTrainingDays: ['Monday'],
    experienceLevel: '2-5 years', squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
    twoKmTimeTrial: { seconds: 480, recordedOn: '2026-07-31', source: 'onboarding' },
    conditioningLevel: 'Good', sprintExposure: 'Occasionally',
    recentTrainingLoad: 'Pretty consistent', injuries: [],
  };
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

console.log('\n[8] THE DELETIONS — nothing infers a kit, and generation refuses true silence');
{
  // Behaviour pins first: the shapes that used to inherit the fantasy gym.
  const emptyProfile = resolveEquipmentCapabilities({} as OnboardingData, null, DATE);
  ok('an empty profile resolves to the bodyweight floor, source unanswered_floor',
    JSON.stringify(emptyProfile.tags) === JSON.stringify(['bodyweight']) &&
      emptyProfile.conditioningModalities.length === 0 &&
      emptyProfile.source === 'unanswered_floor',
    emptyProfile);

  const eightTag = resolveEquipmentCapabilities({
    trainingLocation: 'Commercial gym',
    equipment: [
      'barbell', 'dumbbells', 'squat_rack', 'pullup_bar',
      'cable_machine', 'hamstring_curl', 'knee_extension', 'bands',
    ],
  } as OnboardingData, null, DATE);
  ok('the legacy 8-tag profile lifts its OWN tags — no bench, kettlebell, foam roller or cardio from anywhere',
    eightTag.source === 'legacy_positive_lift' &&
      !eightTag.tags.includes('bench') && !eightTag.tags.includes('kettlebell') &&
      !eightTag.tags.includes('foam_roller') && !eightTag.tags.includes('bike_or_treadmill') &&
      eightTag.conditioningModalities.length === 0,
    eightTag);
  ok('the lift keeps what the athlete actually recorded',
    ['barbell', 'dumbbells', 'pullup_bar', 'cables', 'machine', 'bands']
      .every((tag) => eightTag.tags.includes(tag as never)),
    eightTag.tags);

  // Generation refuses true silence (ruling 2: refused, never defaulted) and
  // accepts both real inputs.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { generationEquipmentInputOrThrow } =
    require('../services/api/generateProgram') as typeof import('../services/api/generateProgram');
  let refused: unknown = null;
  try {
    generationEquipmentInputOrThrow({} as OnboardingData, emptyProfile);
  } catch (error) { refused = error; }
  ok('generation REFUSES a profile with no equipment input of any kind',
    !!refused && (refused as { kind?: string }).kind === 'missing_required_profile',
    refused);
  ok('generation accepts the lifted legacy checklist (existing installs keep working)',
    generationEquipmentInputOrThrow({} as OnboardingData, eightTag) === eightTag);
  ok('generation accepts the typed answer',
    generationEquipmentInputOrThrow(
      answered({}),
      resolveEquipmentCapabilities(answered({ tags: { dumbbells: 'have' } }), null, DATE),
    ).source === 'athlete_answer');

  // The ban: the deleted identifiers stay deleted. Source-scan, the same
  // mechanism that keeps the deleted cue-fallback table deleted — a
  // re-introduction is a red gate, not a compatibility feature (L15).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  const src = path.resolve(__dirname, '..');
  const banned = [
    'LOCATION_EQUIPMENT', 'LOCATION_CONDITIONING_MODALITIES', 'inferEquipment(',
    // The legacy baseline save door (L15 retirement, 2026-07-31): it wrote the
    // retired `equipment` + completeness shape and had no product caller.
    'saveBaselineEquipmentSelection', 'buildBaselineEquipmentSavePlan',
    // The seven unsigned temporary presets (ruling 5).
    'TEMPORARY_EQUIPMENT_PRESETS',
  ];
  const offenders: string[] = [];
  const walkDir = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walkDir(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      // Strip comments so the deletion markers explaining the ban don't trip it.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      for (const identifier of banned) {
        if (code.includes(identifier)) offenders.push(`${full.slice(src.length + 1)}: ${identifier}`);
      }
    }
  };
  walkDir(src);
  ok('the deleted location-inference identifiers appear nowhere in product code',
    offenders.length === 0, offenders);
}

console.log('\n[9] THE PROFILE SURFACE — one canonical write, through the owned transaction');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  const src = path.resolve(__dirname, '..');
  const read = (rel: string): string => fs.readFileSync(path.join(src, rel), 'utf8');

  const transaction = read('store/profileProgramTransaction.ts');
  ok('the transaction owns an equipment_answer change kind',
    /kind: 'equipment_answer';/.test(transaction) &&
      /change\.kind === 'equipment_answer'/.test(transaction));

  const profileScreen = read('screens/profile/ProfileScreen.tsx');
  ok('the profile surface commits equipment_answer through the owned transaction',
    /kind: 'equipment_answer'/.test(profileScreen) &&
      /commitProfileProgramTransaction/.test(profileScreen));
  ok('the profile surface never writes the legacy baseline shape',
    !/baseline_equipment/.test(profileScreen));

  // ── ITEM 24: THE EXIT IS AN INPUT, AND IT DEFAULTS THE RIGHT WAY ──
  //
  // Sam ruled the away flow must REUSE this screen, so "continue" stopped being
  // hard-coded to the next onboarding step. The direction of the default is the
  // ruling itself: onboarding passes NOTHING and behaves exactly as before.
  // A REQUIRED param would make onboarding's behaviour a caller's
  // responsibility, which is how a signed screen quietly changes — so these
  // cells red on that inversion, not merely on the prop going missing.
  const equipmentScreen = read('screens/onboarding/EquipmentScreen.tsx');
  ok('onboarding lifts older slam-specific answers into its one Medicine ball tick',
    /canonicalEquipmentAnswerTags\(existingOnEntry\?\.tags \?\? \{\}\)/.test(equipmentScreen)
      && /Object\.entries\(canonicalExistingTags\)/.test(equipmentScreen)
      && /canonicalExistingTags\[tag\] === 'never'/.test(equipmentScreen));
  ok('the equipment screen takes an OPTIONAL exit',
    /onDone\?: \(\) => void/.test(equipmentScreen),
    'the exit is no longer optional. Onboarding passes nothing, so a required '
      + 'param makes its behaviour depend on a caller remembering to supply the '
      + 'old one — the exact inversion item 24 forbids.');
  ok('the default exit is the onboarding navigate it replaced',
    /onDone \?\? \(\(\) => navigation\.navigate\('GymExperience'\)\)/.test(equipmentScreen),
    'the fallback is no longer the original `GymExperience` navigate, so an '
      + 'onboarding athlete who ticks their equipment lands somewhere new');
  ok('fresh-entry Back semantics cannot change after the equipment answer is saved',
    /const \[existingOnEntry\] = useState\(\(\) => savedEquipmentAnswer\(\)\)/.test(equipmentScreen)
      && /useState<boolean>\(!!existingOnEntry\)/.test(equipmentScreen)
      && /existingOnEntry \? navigation\.goBack\(\) : setShowChecklist\(false\)/.test(equipmentScreen)
      && !/const existing = savedEquipmentAnswer\(\)/.test(equipmentScreen),
    'the screen is re-reading the answer it just saved, so Back changes from '
      + 'return-to-location to leave-Equipment while the athlete is still in the same flow');
  ok('Commercial gym copy only asks the athlete to untick the all-selected preset',
    /const checklistSubtitle = location === 'commercial_gym'\s*\? "Everything is ticked\. Untick anything your gym doesn't have\."/.test(equipmentScreen)
      && /: `We've ticked the usual kit\$\{location \? ` for a \$\{equipmentLocationPreset\(location\)\.label\.toLowerCase\(\)\}` : ''\}\. Untick anything your place doesn't have, and tick anything extra it does\.`/.test(equipmentScreen)
      && /\{checklistSubtitle\}/.test(equipmentScreen),
    'Commercial gym preselects the complete checklist, but its subtitle still '
      + 'tells the athlete to tick additional equipment when nothing is left');
  ok('onboarding still passes no exit of its own',
    !/onDone=/.test(read('navigation/OnboardingNavigator.tsx')),
    'the onboarding navigator now supplies an exit. It must pass NOTHING — that '
      + 'is what keeps the signed onboarding flow byte-identical.');
  ok('the outdated checklist footnotes are absent',
    !/Train somewhere else\?|Nothing ticked\?|bodyweight program/.test(equipmentScreen));
  ok('the deleted footnote leaves no hidden Pressable or footNote style behind',
    !/Pressable|styles\.footNote|footNote:/.test(equipmentScreen));

  const equipmentEditor = read('screens/profile/EquipmentEditorSheet.tsx');
  ok('Profile equipment editing uses the same saved-answer lift as onboarding',
    /canonicalEquipmentAnswerTags\(existing\.tags\)/.test(equipmentEditor));

  // ── R-230 (Sam, 2026-08-26): bodyweight-only is NOT a supported athlete ──
  // "Continuing with nothing ticked is a real answer" is retired: the step
  // requires at least one piece of strength kit, and the disabled Continue
  // states its reason (the layout's footerHelperText law — never a silent
  // lock-out). The away/holiday window is the only bodyweight span, and it
  // is not this screen's question.
  ok('R-230: no strength kit ticked disables Continue',
    /continueDisabled=\{tickedTags\.size === 0\}/.test(equipmentScreen),
    'the equipment step completes bodyweight-only again');
  ok('R-230: the disabled Continue states its reason',
    /footerHelperText=\{tickedTags\.size === 0/.test(equipmentScreen) &&
      /strength kit/.test(equipmentScreen),
    'a silent disabled Continue is the dead-affordance defect #9 already paid for');
  ok('R-230: the retired bodyweight-only sentence is gone',
    !/nothing ticked is a real answer/.test(equipmentScreen)
      || /RETIRED the "nothing ticked/.test(equipmentScreen));

  const editor = read('screens/profile/EquipmentEditorSheet.tsx');
  ok('NEVER lives on the profile editor (the tri-state cycle), not onboarding',
    /'never'/.test(editor) &&
      !/'never'/.test(read('screens/onboarding/EquipmentScreen.tsx').replace(
        // The onboarding screen PRESERVES an existing never on save; it never
        // creates one. Strip the preservation branch before asserting.
        /^\s*else if .* === 'never'\) .* = 'never';$/gm, '')));
}

console.log(`\n${failures.length === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
