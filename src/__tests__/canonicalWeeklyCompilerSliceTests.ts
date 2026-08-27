/**
 * FIRST CANONICAL WEEKLY-COMPILER SLICE
 *
 * One ordinary healthy Off-season athlete enters through the real onboarding
 * door. The product compiler authors the block, accepted state validates and
 * installs it, and the visible resolver projects the exact accepted rows. The
 * source census beside the journey holds the ownership boundary: scheduler,
 * materialiser and connector each have one production caller — the compiler.
 *
 * NOT COVERED: athlete edits, scheduled deloads, later compiler families,
 * full-year archetypes, pixels, simulator and physical iPhone.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — canonical compilation is local');
};
process.env.TZ = 'Australia/Melbourne';

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { OnboardingData, Workout } from '../types/domain';
import { compileCanonicalWeek } from '../rules/canonicalWeeklyCompiler';
import { canonicalFixtureStateFrom } from '../rules/canonicalWeeklyFixtureState';
import { canonicalWeeklyInjuryStateFrom } from '../rules/canonicalWeeklyInjuryState';
import {
  canonicalWeeklyAvailabilityStateFrom,
  schedulerInputsWithAvailabilityState,
} from '../rules/canonicalWeeklyAvailabilityState';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { useProgramStore } from '../store/programStore';
import {
  coldStartThroughOnboarding,
  quiet,
  quietAsync,
  resolvedDays,
} from './support/athleteJourney';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { readinessActionForKind } from '../utils/weekReadinessActions';
import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import { settleDerivedWorldAfterDecision } from '../store/quiescentBoot';
import { blockSelectionHistory } from '../store/blockSelectionHistoryStore';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}${detail === undefined ? '' : ` — ${String(detail)}`}`);
  }
}

const ROOT = join(__dirname, '..');
const COMPILER_PATH = 'rules/canonicalWeeklyCompiler.ts';

function productTypeScriptFiles(dir = ROOT): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const absolute = join(dir, name);
    const rel = relative(ROOT, absolute).replace(/\\/g, '/');
    if (rel.startsWith('__tests__/') || rel.startsWith('dev/')) continue;
    if (statSync(absolute).isDirectory()) out.push(...productTypeScriptFiles(absolute));
    else if (/\.tsx?$/.test(name)) out.push(absolute);
  }
  return out;
}

function productionCallers(
  symbol: string,
  overrides: Readonly<Record<string, string>> = {},
): string[] {
  const callers = new Set<string>();
  const call = new RegExp(`\\b${symbol}\\s*\\(`, 'g');
  const declaration = new RegExp(`\\bfunction\\s+${symbol}\\s*\\(`);
  for (const absolute of productTypeScriptFiles()) {
    const rel = relative(ROOT, absolute).replace(/\\/g, '/');
    const source = overrides[rel] ?? readFileSync(absolute, 'utf8');
    for (const line of source.split('\n')) {
      if (declaration.test(line)) continue;
      call.lastIndex = 0;
      if (call.test(line)) callers.add(rel);
    }
  }
  return [...callers].sort();
}

const INSTALL_DAY = '2026-07-13';

function athlete(): OnboardingData {
  return {
    firstName: 'Compiler', ageRange: '22-26', gender: 'male',
    position: 'inside_mid', heightCm: 182, weightKg: 84,
    motivation: 'Get stronger', goals: ['Get stronger'],
    seasonPhase: 'Off-season', seasonFinishedOn: '2026-07-12',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
    usualGameDay: undefined, gameDay: undefined,
    trainingLocation: 'Commercial gym',
    equipment: [
      'barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine',
      'hamstring_curl', 'knee_extension', 'bands',
    ],
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
        bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
        foam_roller: 'have', plyo_box: 'have',
      },
      modalities: {
        bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have',
        treadmill: 'have',
      },
      answeredOn: INSTALL_DAY,
    },
    injuries: [], experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good', sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
  } as unknown as OnboardingData;
}

function illnessAthlete(): OnboardingData {
  return {
    ...athlete(),
    firstName: 'Illness compiler',
    seasonPhase: 'In-season',
    seasonFinishedOn: undefined,
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  };
}

function rowSignature(workout: Workout): string[] {
  return (workout.exercises ?? []).map((row) => [
    row.exercise?.name ?? '',
    row.prescribedSets ?? '',
    row.prescribedRepsMin ?? '',
    row.prescribedRepsMax ?? '',
    row.prescribedWeightKg ?? '',
  ].join(':'));
}

async function main(): Promise<void> {
  console.log('\n[ownership] one orchestration owns the three authoring stages');
  for (const symbol of [
    'scheduleWeek', 'materialiseAuthoredSessions', 'scheduleToCoachingPlan',
  ]) {
    const callers = productionCallers(symbol);
    ok(`${symbol} has one production caller and it is the compiler`,
      callers.length === 1 && callers[0] === COMPILER_PATH,
      JSON.stringify(callers));
  }

  const compilerSource = readFileSync(join(ROOT, COMPILER_PATH), 'utf8');
  ok('the ownership instrument found a real compiler source region',
    compilerSource.length > 1_000 && compilerSource.includes('compileCanonicalWeek'));
  const scheduleMutation = compilerSource.replace(
    'const schedule = scheduleWeek({',
    'const schedule = scheduleWeek_REMOVED({',
  );
  ok('[MUTATION] removing the compiler scheduler call makes ownership red',
    productionCallers('scheduleWeek', { [COMPILER_PATH]: scheduleMutation }).length === 0);

  const generatorSource = readFileSync(join(ROOT, 'services/api/generateProgram.ts'), 'utf8');
  const generationStart = generatorSource.indexOf('export function generateProgramLocally(');
  const generationEnd = generatorSource.indexOf(
    '\nexport function buildProgramGenerationEdgePayload', generationStart,
  );
  ok('the product generation region was found before checking rival authors',
    generationStart >= 0 && generationEnd > generationStart);
  const generationRegion = generatorSource.slice(generationStart, generationEnd);
  ok('product generation does not prebuild an initial rival plan',
    !generationRegion.includes('buildInitialGeneratedCoachingPlan('));
  ok('product generation declares the compiler already resolved conditioning feasibility',
    generatorSource.includes('conditioningFeasibilityResolved: true'));
  const adapterSource = readFileSync(join(ROOT, 'data/defaultProgram.ts'), 'utf8');
  ok('the retained adapter stands down instead of rewriting a healthy compiler plan',
    adapterSource.includes('rotationContext?.conditioningFeasibilityResolved &&') &&
      adapterSource.includes('(rotationContext.canonicalPlanDoseResolved || !deloadPolicy)'));
  ok('[MUTATION] dropping the compiler-to-adapter ownership marker is detected',
    !generatorSource.replace('conditioningFeasibilityResolved: true', '')
      .includes('conditioningFeasibilityResolved: true'));

  console.log('\n[readiness ownership] the fact enters the compiler and no later layer re-decides it');
  const schedulerInputsSource = readFileSync(join(ROOT, 'rules/weeklySchedulerInputs.ts'), 'utf8');
  const constraintsSource = readFileSync(join(ROOT, 'utils/generationConstraints.ts'), 'utf8');
  const illnessModeSource = readFileSync(join(ROOT, 'rules/illnessRecoveryWeekMode.ts'), 'utf8');
  const derivedContractSource = readFileSync(join(ROOT, 'rules/derivedWeekContract.ts'), 'utf8');
  const sessionResolverSource = readFileSync(join(ROOT, 'utils/sessionResolver.ts'), 'utf8');
  const fixtureReplanSource = readFileSync(join(ROOT, 'utils/fixtureMinimalReplan.ts'), 'utf8');
  ok('the scheduler-input translator no longer interprets readiness facts',
    !schedulerInputsSource.includes('generationConstraints?.readiness'));
  ok('the compiler accepts the typed readiness directive',
    compilerSource.includes('readonly readiness?: CanonicalWeeklyReadinessFact | null'));
  ok('the compiler authors the conditioning-plan deload before feasibility',
    compilerSource.includes('applyDeloadPolicyToSessionAllocation'));
  ok('product generation hands readiness to the compiler as a typed fact',
    generatorSource.includes('readiness: canonicalReadinessFactFrom(generationConstraints)'));
  ok('product generation consumes compiler-authored per-day dose policy',
    generatorSource.includes('compiledDosePolicyByDay'));
  ok('the retained adapter has no private readiness plan author',
    !adapterSource.includes('function deloadPlanEntry('));
  ok('the retained adapter consumes the compiler dose handover',
    adapterSource.includes('rotationContext?.canonicalDosePolicyByDay'));
  const readinessRivalAuthors = [
    schedulerInputsSource.includes('generationConstraints?.readiness')
      ? 'weeklySchedulerInputs interprets readiness' : null,
    adapterSource.includes('function deloadPlanEntry(')
      ? 'retained adapter owns a private plan transform' : null,
    adapterSource.includes('readinessDeloadWindow')
      ? 'retained adapter re-resolves the readiness window' : null,
    generatorSource.includes('isDateInReadinessDeloadWindow')
      ? 'generator re-resolves the readiness window' : null,
  ].filter((finding): finding is string => finding !== null);
  ok('weekly-readiness rival-author count is literally zero',
    readinessRivalAuthors.length === 0, JSON.stringify(readinessRivalAuthors));
  const readinessDerivedOutputWritersOutsideCompiler = [
    generatorSource.includes('applyDeloadPolicyToSessionAllocation(')
      ? 'generator writes the plan transform' : null,
    adapterSource.includes('function deloadPlanEntry(')
      ? 'adapter writes the plan transform' : null,
  ].filter((finding): finding is string => finding !== null);
  ok('weekly-readiness derived-plan writer count outside the compiler is literally zero',
    readinessDerivedOutputWritersOutsideCompiler.length === 0,
    JSON.stringify(readinessDerivedOutputWritersOutsideCompiler));
  ok('[MUTATION] dropping the per-day dose handover is detected',
    !generatorSource.replace(
      'canonicalDosePolicyByDay: compiledDosePolicyByDay',
      'canonicalDosePolicyByDay_REMOVED: compiledDosePolicyByDay',
    ).includes('canonicalDosePolicyByDay: compiledDosePolicyByDay'));

  console.log('\n[illness ownership] one typed directive enters the compiler; no read-side rival rewrites it');
  ok('generation context carries illness as its own typed directive',
    constraintsSource.includes('illness?: GenerationIllnessConstraint'));
  ok('the compiler accepts the typed illness directive',
    compilerSource.includes('readonly illness?: CanonicalWeeklyIllnessFact | null'));
  ok('product generation hands illness to the compiler as a typed fact',
    generatorSource.includes('illness: canonicalIllnessFactFrom(generationConstraints)'));
  ok('combined weekDeloaded and weekMode compatibility outputs are retired',
    !constraintsSource.includes('weekDeloaded?:') && !constraintsSource.includes("weekMode?: 'optional_week'"));
  ok('the compiler connector no longer carries a non-readiness compatibility family',
    !compilerSource.includes('nonReadinessDeloaded') &&
      !compilerSource.includes('nonReadinessWeekModeOverride'));
  ok('product generation no longer classifies another deload family',
    !generatorSource.includes('anotherDeloadFamilyIsActive'));
  ok('product generation has no private illness dose policy',
    !generatorSource.includes('legacyOtherDoorPolicy') &&
      !generatorSource.includes("resolveDoorDeloadPolicy({ door: 'illness'"));
  ok('the derived contract no longer re-reads illness facts to rewrite compiler identity',
    !derivedContractSource.includes('deriveIllnessRecoveryWeekMode'));
  ok('the retired illness mode selector has zero production callers',
    productionCallers('deriveIllnessRecoveryWeekMode').length === 0,
    JSON.stringify(productionCallers('deriveIllnessRecoveryWeekMode')));
  const illnessViewRewrite = /fact\.factKind === 'illness'[\s\S]{0,260}sessionsOptional/.test(
    illnessModeSource,
  );
  ok('the session resolver has no illness-specific optional rewrite after compilation',
    !illnessViewRewrite && !sessionResolverSource.includes("factKind === 'illness'"));
  const illnessRivalAuthors = [
    constraintsSource.includes('weekDeloaded?:') ? 'combined context authors illness dose' : null,
    constraintsSource.includes("weekMode?: 'optional_week'") ? 'combined context authors illness mode' : null,
    generatorSource.includes('legacyOtherDoorPolicy') ? 'generator authors illness dose' : null,
    derivedContractSource.includes('deriveIllnessRecoveryWeekMode')
      ? 'derived contract rewrites illness mode' : null,
    illnessViewRewrite ? 'session resolver rewrites illness optionality' : null,
  ].filter((finding): finding is string => finding !== null);
  ok('weekly-illness rival-author count is literally zero',
    illnessRivalAuthors.length === 0, JSON.stringify(illnessRivalAuthors));
  ok('[MUTATION] dropping the typed illness compiler handover is detected',
    generatorSource.includes('illness: canonicalIllnessFactFrom(generationConstraints)') &&
    !generatorSource.replace(
      'illness: canonicalIllnessFactFrom(generationConstraints)',
      'illness_REMOVED: canonicalIllnessFactFrom(generationConstraints)',
    ).includes('illness: canonicalIllnessFactFrom(generationConstraints)'));

  console.log('\n[injury ownership] one semantic policy enters the compiler; specialists do not reclassify it');
  const injuryPolicySource = readFileSync(
    join(ROOT, 'rules/canonicalWeeklyInjuryState.ts'), 'utf8',
  );
  const exposureBuilderSource = readFileSync(
    join(ROOT, 'rules/weeklyExposureContractBuilders.ts'), 'utf8',
  );
  const conditioningSource = readFileSync(
    join(ROOT, 'rules/conditioningFeasibility.ts'), 'utf8',
  );
  const section18SafetySource = readFileSync(
    join(ROOT, 'rules/section18SafetyPolicy.ts'), 'utf8',
  );
  const onboardingCompleteSource = readFileSync(
    join(ROOT, 'screens/onboarding/CompleteScreen.tsx'), 'utf8',
  );
  const journeySupportSource = readFileSync(
    join(ROOT, '__tests__/support/athleteJourney.ts'), 'utf8',
  );
  ok('the compiler accepts one semantic injury policy',
    compilerSource.includes('readonly injury?: CanonicalWeeklyInjuryState | null'));
  ok('the injury policy owns strength, sprint, conditioning, power and exercise-pool outputs',
    injuryPolicySource.includes('prohibitedPatterns:') &&
      injuryPolicySource.includes('blocksAppSprint:') &&
      injuryPolicySource.includes('lowerBodyRestricted:') &&
      injuryPolicySource.includes('upperBodyRestricted:') &&
      injuryPolicySource.includes('powerInjuries:') &&
      injuryPolicySource.includes('activeInjuryKeys:'));
  ok('product generation hands the semantic injury policy to the compiler',
    generatorSource.includes('injury: weeklyInjury'));
  ok('the compiler derives power inputs instead of receiving another injury projection',
    compilerSource.includes("'injuries'") &&
      compilerSource.includes('injuries: [...(input.injury?.powerInjuries ?? [])]'));
  ok('the compiler derives contract injury inputs instead of receiving raw injuries',
    compilerSource.includes("| 'injuryPolicy'") &&
      !compilerSource.includes('profileInjuries') &&
      !compilerSource.includes('activeInjuries') &&
      compilerSource.includes('injuryPolicy: input.injury ?? undefined'));
  ok('the exposure contract consumes semantic injury policy when supplied',
    exposureBuilderSource.includes('injuryPolicy?: CanonicalWeeklyInjuryPolicy') &&
      exposureBuilderSource.includes('new Set(input.injuryPolicy?.prohibitedPatterns ?? [])'));
  ok('the compiler stamps the semantic injury policy onto Contract v2',
    compilerSource.includes('applyGenerationSafetyToSection18Contract({') &&
      compilerSource.includes('injuryPolicy: input.injury'));
  ok('onboarding records the healthy block selections temporary injuries must preserve',
    onboardingCompleteSource.includes("recordSelections: 'author'") &&
      journeySupportSource.includes("recordSelections: 'author'"));
  ok('conditioning consumes semantic restriction flags and does not graduate injury severity',
    conditioningSource.includes('injury?: CanonicalWeeklyInjuryPolicy') &&
      !conditioningSource.includes('onboardingInjurySeverityScore') &&
      !conditioningSource.includes('injurySeverityReducesAffectedWork'));
  const generationInjuryRivalAuthors = [
    generatorSource.includes('applyGenerationConstraintsToProfile(')
      ? 'generator merges raw injury facts into profile' : null,
    generatorSource.includes('mergeAthletePrefsWithGenerationConstraints(')
      ? 'generator separately derives exercise-pool injury keys' : null,
    generatorSource.includes('profileInjuries:')
      ? 'generator hands raw profile injuries to the contract' : null,
    generatorSource.includes('activeInjuries: generationConstraints')
      ? 'generator hands raw active injuries to the contract' : null,
    conditioningSource.includes('onboardingInjurySeverityScore')
      ? 'conditioning graduates profile injury severity' : null,
    conditioningSource.includes('injurySeverityReducesAffectedWork')
      ? 'conditioning graduates active injury severity' : null,
    exposureBuilderSource.includes('onboardingInjurySeverityScore') ||
      exposureBuilderSource.includes('injurySeverityRemovesRiskyWork')
      ? 'exposure contract graduates raw injury severity' : null,
    section18SafetySource.includes('injury.region ===')
      ? 'Contract v2 independently classifies an injury region' : null,
  ].filter((finding): finding is string => finding !== null);
  ok('weekly-injury rival-author count is literally zero',
    generationInjuryRivalAuthors.length === 0,
    JSON.stringify(generationInjuryRivalAuthors));
  ok('[MUTATION] dropping the typed injury compiler handover is detected',
    generatorSource.includes('injury: weeklyInjury') &&
      !generatorSource.replace(/injury: weeklyInjury/g, 'injury_REMOVED: weeklyInjury')
        .includes('injury: weeklyInjury'));
  ok('[MUTATION] dropping the Contract v2 injury handoff is detected',
    /applyGenerationSafetyToSection18Contract\(\{[\s\S]{0,180}injuryPolicy: input\.injury,/
      .test(compilerSource) &&
      !/applyGenerationSafetyToSection18Contract\(\{[\s\S]{0,180}injuryPolicy: input\.injury,/
        .test(compilerSource.replace(
          'injuryPolicy: input.injury,\n        })',
          'injuryPolicy_REMOVED: input.injury,\n        })',
        )));
  ok('[MUTATION] letting onboarding omit its selection authority is detected',
    !onboardingCompleteSource.replace("recordSelections: 'author'", '')
      .includes("recordSelections: 'author'"));

  console.log('\n[fixture ownership] one typed target-week state enters the compiler');
  ok('the compiler accepts a semantic fixture state',
    compilerSource.includes('readonly fixture?: CanonicalWeeklyFixtureState | null'));
  ok('product generation hands the target-week fixture state to the compiler',
    generatorSource.includes('fixture: canonicalFixtureStateFrom('));
  ok('the scheduler translator no longer accepts a second target-fixture input',
    !schedulerInputsSource.includes('readonly targetFixtureDay?:') &&
      !schedulerInputsSource.includes('readonly targetWeekAvailability?:'));
  ok('the compiler derives connector fixture fields from its own resolved schedule',
    compilerSource.includes("| 'selectedDayNumbers' | 'teamTrainingDayNumbers' | 'hasGame' | 'gameDay'") &&
      compilerSource.includes("| 'clubNights'") && compilerSource.includes("| 'gameDays'") &&
      compilerSource.includes('clubNights: scheduler.clubNights') &&
      compilerSource.includes('gameDays: [...scheduler.gameDays]'));
  ok('generation no longer restates fixture fields into the connector',
    !generatorSource.includes('gameDays: scheduledGameDays(schedulerInputs)') &&
      !generatorSource.includes('hasGame: scheduledGameDays(schedulerInputs).length > 0'));
  ok('the accepted contract reader no longer rebuilds identity from calendar fixture facts',
    !derivedContractSource.includes('fixtureIdentityForWeek') &&
      !derivedContractSource.includes('targetWeekFixtures'));
  ok('fixture publication consumes the compiler-authored contract without a read-side rewrite',
    !fixtureReplanSource.includes('deriveWeekContract({'));
  const fixtureReplanCallers = productionCallers('buildFixtureMinimalReplan');
  ok('the final-workout fixture specialist has one production caller: the compiler',
    JSON.stringify(fixtureReplanCallers) === JSON.stringify([COMPILER_PATH]),
    JSON.stringify(fixtureReplanCallers));
  const fixtureRivalAuthors = [
    schedulerInputsSource.includes('readonly targetFixtureDay?:')
      ? 'scheduler translator independently interprets target fixture' : null,
    schedulerInputsSource.includes('readonly targetWeekAvailability?:')
      ? 'scheduler translator independently interprets fixture availability' : null,
    generatorSource.includes('gameDays: scheduledGameDays(schedulerInputs)')
      ? 'generator independently authors connector fixture days' : null,
    derivedContractSource.includes('fixtureIdentityForWeek')
      ? 'accepted reader rewrites fixture identity' : null,
    fixtureReplanSource.includes('deriveWeekContract({')
      ? 'fixture publisher rewrites fixture identity' : null,
    ...fixtureReplanCallers
      .filter((caller) => caller !== COMPILER_PATH)
      .map((caller) => `fixture replan invoked outside compiler: ${caller}`),
  ].filter((finding): finding is string => finding !== null);
  ok('weekly-fixture rival-author count is literally zero',
    fixtureRivalAuthors.length === 0, JSON.stringify(fixtureRivalAuthors));
  ok('[MUTATION] dropping the typed fixture compiler handover is detected',
    generatorSource.includes('fixture: canonicalFixtureStateFrom(') &&
    !generatorSource.replace(
      'fixture: canonicalFixtureStateFrom(',
      'fixture_REMOVED: canonicalFixtureStateFrom(',
    ).includes('fixture: canonicalFixtureStateFrom('));
  ok('[MUTATION] bypassing the compiler-owned final fixture specialist is detected',
    compilerSource.includes('return buildFixtureMinimalReplan(input)') &&
    !compilerSource.replace(
      'return buildFixtureMinimalReplan(input)',
      'return buildFixtureMinimalReplan_REMOVED(input)',
    ).includes('return buildFixtureMinimalReplan(input)'));

  console.log('\n[availability ownership] travel and dated kit enter one compiler state');
  const availabilityPath = join(ROOT, 'rules/canonicalWeeklyAvailabilityState.ts');
  const availabilitySource = existsSync(availabilityPath)
    ? readFileSync(availabilityPath, 'utf8')
    : '';
  const fixtureStateSource = readFileSync(
    join(ROOT, 'rules/canonicalWeeklyFixtureState.ts'), 'utf8',
  );
  const coachingEngineSource = readFileSync(join(ROOT, 'utils/coachingEngine.ts'), 'utf8');
  ok('one semantic weekly availability state exists',
    availabilitySource.includes('export interface CanonicalWeeklyAvailabilityState'));
  ok('the compiler accepts and applies the semantic availability state',
    compilerSource.includes('readonly availability?: CanonicalWeeklyAvailabilityState | null') &&
      compilerSource.includes('schedulerInputsWithAvailabilityState('));
  ok('product generation hands weekly availability to the compiler',
    generatorSource.includes('availability: weeklyAvailability'));
  ok('composition consumes the compiler-authored availability projection',
    compilerSource.includes('compositionAvailability:') &&
      generatorSource.includes('compiled.compositionAvailability'));
  ok('the scheduler translator no longer interprets schedule constraints or travel',
    !schedulerInputsSource.includes('activeConstraints') &&
      !schedulerInputsSource.includes('clubInputsAfterTravel') &&
      !schedulerInputsSource.includes('awaySpansFromConstraints'));
  ok('the fixture translator no longer independently removes away fixtures',
    !fixtureStateSource.includes('activeConstraints') &&
      !fixtureStateSource.includes('awaySpansFromConstraints'));
  ok('the profile translator no longer independently removes club or game days for travel',
    !coachingEngineSource.includes('options.awaySpans') &&
      !coachingEngineSource.includes('options.noTeamTrainingSpans'));
  ok('generation no longer authors its own equipment window or no-club spans',
    !generatorSource.includes('resolveEffectiveEquipmentWindow(') &&
      !generatorSource.includes('function noTeamTrainingSpansFromConstraints('));
  const availabilityRivalAuthors = [
    schedulerInputsSource.includes('activeConstraints')
      ? 'scheduler translator interprets schedule constraints' : null,
    schedulerInputsSource.includes('clubInputsAfterTravel')
      ? 'scheduler translator independently removes club/game anchors' : null,
    fixtureStateSource.includes('awaySpansFromConstraints')
      ? 'fixture translator independently removes away fixtures' : null,
    coachingEngineSource.includes('options.awaySpans')
      ? 'profile translator independently removes away club/game facts' : null,
    generatorSource.includes('resolveEffectiveEquipmentWindow(')
      ? 'generator independently authors the dated equipment window' : null,
    generatorSource.includes('function noTeamTrainingSpansFromConstraints(')
      ? 'generator independently authors club-closure spans' : null,
  ].filter((finding): finding is string => finding !== null);
  ok('weekly-availability rival-author count is literally zero',
    availabilityRivalAuthors.length === 0, JSON.stringify(availabilityRivalAuthors));
  ok('[MUTATION] dropping the typed availability compiler handover is detected',
    generatorSource.includes('availability: weeklyAvailability') &&
      !generatorSource.replace(
        'availability: weeklyAvailability',
        'availability_REMOVED: weeklyAvailability',
      ).includes('availability: weeklyAvailability'));
  ok('[MUTATION] bypassing the compiler availability projection is detected',
    compilerSource.includes('schedulerInputsWithAvailabilityState(') &&
      !compilerSource.replace(
        'schedulerInputsWithAvailabilityState(',
        'schedulerInputsWithAvailabilityState_REMOVED(',
      ).includes('schedulerInputsWithAvailabilityState('));

  const closureAndUnavailable = canonicalWeeklyAvailabilityStateFrom({
    profile: illnessAthlete(),
    weekStartISO: INSTALL_DAY,
    activeConstraints: [
      {
        id: 'club-closed', type: 'schedule', severity: 5, status: 'active',
        startDate: INSTALL_DAY, lastUpdatedAt: INSTALL_DAY,
        scheduleKind: 'no_team_training', rules: [], safeFocus: [], advice: [],
      },
      {
        id: 'wednesday-unavailable', type: 'schedule', severity: 5, status: 'active',
        startDate: INSTALL_DAY, expiresAt: '2026-07-19', lastUpdatedAt: INSTALL_DAY,
        scheduleKind: 'unavailable_dates', unavailableDates: ['2026-07-15'],
        rules: [], safeFocus: [], advice: [],
      },
    ] as never,
  });
  const closureAndUnavailableSchedule = schedulerInputsWithAvailabilityState({
    weekStartISO: INSTALL_DAY,
    phase: 'In-season', offseasonBlock: null,
    gymAccessDays: [1, 3, 5], clubNights: [2, 4],
    gameDays: [6], gameDay: 6, fixtureRecurrence: 'recurring', age: 24,
    readiness: { lowReadiness: false, highReadiness: false, lowFatigue: false,
      consistentlyCompletesThree: false },
    unavailableDays: [],
  }, closureAndUnavailable);
  ok('a club shutdown removes team nights but preserves the athlete-entered game',
    closureAndUnavailableSchedule.clubNights.length === 0 &&
      JSON.stringify(closureAndUnavailableSchedule.gameDays) === JSON.stringify([6]) &&
      closureAndUnavailableSchedule.gameDay === 6,
    JSON.stringify(closureAndUnavailableSchedule));
  ok('an explicit unavailable date blocks only its own weekday',
    JSON.stringify(closureAndUnavailableSchedule.unavailableDays) === JSON.stringify([3]),
    JSON.stringify(closureAndUnavailableSchedule.unavailableDays));
  const offSeasonFixture = canonicalFixtureStateFrom({
    weekStartISO: INSTALL_DAY,
    seasonPhase: 'Off-season',
    targetFixtureDay: 'Saturday',
  });
  ok('standing game answers stay dormant at the Off-season compiler boundary',
    offSeasonFixture?.fixtures.length === 0 &&
      offSeasonFixture.adjacentFixtureDates.length === 0 &&
      offSeasonFixture.releasedFixtureDayNumbers.length === 0,
    JSON.stringify(offSeasonFixture));
  const offSeasonAvailability = canonicalFixtureStateFrom({
    weekStartISO: INSTALL_DAY,
    seasonPhase: 'Off-season',
    availability: {
      proposedFixtures: [{ date: '2026-07-18', kind: 'game' }],
      releasedFixtures: [{
        date: '2026-07-18', kind: 'game', provenance: 'released_game_day',
      }],
      adjacentFixtureDates: ['2026-07-11', '2026-07-25'],
      effectiveAvailableDayNumbers: [1],
      days: [
        {
          dayNumber: 1, provenance: ['explicit_available'], blockedBy: [],
        },
        {
          dayNumber: 6, provenance: ['explicit_available'],
          blockedBy: ['fixture_occupied'],
        },
        {
          dayNumber: 3, provenance: ['explicit_available'],
          blockedBy: ['explicit_unavailable'],
        },
      ],
    } as never,
  });
  ok('Off-season releases only fixture occupancy while preserving real availability blocks',
    JSON.stringify(offSeasonAvailability?.effectiveAvailableDayNumbers) ===
      JSON.stringify([1, 6]),
    JSON.stringify(offSeasonAvailability));

  console.log('\n[refusal] no partial compiler output escapes');
  const refusal = compileCanonicalWeek({
    scheduler: {
      weekStartISO: '2026-07-13', phase: 'Off-season', offseasonBlock: 'transition',
      gymAccessDays: [1], clubNights: [], gameDays: [], gameDay: null,
      fixtureRecurrence: 'recurring', age: 24,
      readiness: { lowReadiness: false, highReadiness: false, lowFatigue: false,
        consistentlyCompletesThree: false },
      unavailableDays: [],
    },
    coaching: {} as never,
    materialisation: {} as never,
    connector: {} as never,
  });
  ok('an impossible week returns the scheduler\'s typed refusal',
    refusal.ok === false && refusal.refusal.finding === 'not_enough_legal_gym_days');
  ok('a refusal contains no schedule, materialisation or plan',
    !('schedule' in refusal) && !('materialised' in refusal) && !('plan' in refusal));

  console.log('\n[vertical slice] onboarding -> compile -> accept -> visible projection');
  const install = await coldStartThroughOnboarding({
    profile: athlete(), installDayISO: INSTALL_DAY,
  });
  ok('the ordinary Off-season athlete installs without refusal',
    install.onboardingRefusal === null, install.onboardingRefusal);
  const accepted = useProgramStore.getState().currentProgram;
  const microcycle = accepted?.microcycles.find((week) =>
    String(week.startDate).slice(0, 10) === install.blockOneStart);
  ok('accepted state contains the compiler-authored week', Boolean(microcycle));
  ok('the accepted week carries its validation contract',
    Boolean(microcycle?.exposureContractV2));
  ok('accepted state advanced through its real transaction',
    useProgramStore.getState().acceptedMaterialContext.revision > 0);

  const visible = quiet(() => resolvedDays(install.blockOneStart, INSTALL_DAY));
  const visibleByDay = new Map(visible.map((day) => [
    new Date(`${day.dateISO}T12:00:00Z`).getUTCDay(),
    day.rows.map((row) => [row.name, row.sets ?? '', row.repsMin ?? '',
      row.repsMax ?? '', row.weightKg ?? ''].join(':')),
  ]));
  const mismatches = (microcycle?.workouts ?? []).filter((workout) =>
    JSON.stringify(rowSignature(workout)) !== JSON.stringify(visibleByDay.get(workout.dayOfWeek) ?? []));
  ok('the visible week projects the exact accepted exercise prescriptions',
    mismatches.length === 0,
    mismatches.map((workout) => `${workout.dayOfWeek}:${workout.name}`).join(','));
  ok('the journey was non-vacuous and authored real training rows',
    (microcycle?.workouts ?? []).some((workout) => (workout.exercises?.length ?? 0) > 0));

  console.log('\n[readiness slice] normal -> cooked rolling window -> recovered');
  const visibleSignature = (days: ReturnType<typeof resolvedDays>): string => JSON.stringify(
    days.map((day) => [day.dateISO, day.rows.map((row) => [
      row.name, row.sets ?? '', row.repsMin ?? '', row.repsMax ?? '', row.weightKg ?? '',
    ])]),
  );
  const baselineSignature = visibleSignature(visible);
  const baselineSetsByDate = new Map(visible.map((day) => [
    day.dateISO,
    day.rows.reduce((sum, row) => sum + Number(row.sets ?? 0), 0),
  ]));
  const declarationDay = '2026-07-15';
  const cooked = await quietAsync(() => executeProgramControlActionDurably(
    readinessActionForKind('cooked_week', {
      anchorDateISO: install.blockOneStart,
      todayISO: declarationDay,
    }),
    { todayISO: declarationDay },
  ));
  ok('the athlete readiness action commits through the production door', cooked.ok === true,
    cooked.message);
  const factId = cooked.createdModifierIds?.[0] ?? null;
  ok('the readiness door returns the exact fact it authored', Boolean(factId),
    JSON.stringify(cooked.createdModifierIds));
  ok('the accepted mutation is a readiness-owned week overlay',
    useProgramStore.getState().weekScopedOverlays[install.blockOneStart]?.reason ===
      'readiness_reduction');
  const cookedVisible = quiet(() => resolvedDays(install.blockOneStart, declarationDay));
  const cookedSetsByDate = new Map(cookedVisible.map((day) => [
    day.dateISO,
    day.rows.reduce((sum, row) => sum + Number(row.sets ?? 0), 0),
  ]));
  const governedStrengthDays = cookedVisible.filter((day) =>
    day.dateISO >= declarationDay &&
    (baselineSetsByDate.get(day.dateISO) ?? 0) > 0);
  ok('the rolling readiness window reaches real authored training days',
    governedStrengthDays.length > 0);
  ok('the compiler-authored readiness week reduces dose inside the window',
    governedStrengthDays.some((day) =>
      (cookedSetsByDate.get(day.dateISO) ?? 0) < (baselineSetsByDate.get(day.dateISO) ?? 0)));
  const beforeWindow = cookedVisible.filter((day) => day.dateISO < declarationDay);
  ok('readiness does not rewrite days before the declaration',
    beforeWindow.every((day) =>
      JSON.stringify(day.rows.map((row) => [row.name, row.sets, row.repsMin, row.repsMax, row.weightKg])) ===
      JSON.stringify(visible.find((base) => base.dateISO === day.dateISO)?.rows
        .map((row) => [row.name, row.sets, row.repsMin, row.repsMax, row.weightKg]) ?? [])));

  const cleared = factId
    ? await quietAsync(() => executeProgramControlActionDurably({
        type: 'clear_fatigue_status',
        source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
        scope: 'current_week',
        payload: { modifierId: factId, date: declarationDay },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: false,
      }, { todayISO: declarationDay }))
    : null;
  ok('the athlete can clear the exact readiness fact', cleared?.ok === true, cleared?.message);
  const recoveredVisible = quiet(() => resolvedDays(install.blockOneStart, declarationDay));
  ok('clearing readiness restores the accepted visible prescriptions exactly',
    visibleSignature(recoveredVisible) === baselineSignature);

  console.log('\n[illness slice] mild -> moderate -> severe -> recovered');
  const illnessInstall = await coldStartThroughOnboarding({
    profile: illnessAthlete(), installDayISO: INSTALL_DAY,
  });
  ok('the illness witness reaches a required in-season week through onboarding',
    illnessInstall.onboardingRefusal === null, illnessInstall.onboardingRefusal);
  const illnessBaseline = quiet(() =>
    resolvedDays(illnessInstall.blockOneStart, INSTALL_DAY));
  const illnessBaselineSignature = visibleSignature(illnessBaseline);
  const clearFact = async (modifierId: string, date: string) => quietAsync(() =>
    executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: { modifierId, date },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: false,
    }, { todayISO: date }));
  const applyIllness = async (kind: 'illness_mild' | 'illness_moderate' | 'illness_severe') =>
    quietAsync(() => executeProgramControlActionDurably(
      readinessActionForKind(kind, {
        anchorDateISO: illnessInstall.blockOneStart,
        todayISO: declarationDay,
      }),
      { todayISO: declarationDay },
    ));
  const landingMicrocycle = () => useProgramStore.getState().currentProgram?.microcycles.find(
    (candidate) => candidate.startDate.slice(0, 10) === illnessInstall.blockOneStart,
  );
  const landingOverlay = () =>
    useProgramStore.getState().weekScopedOverlays[illnessInstall.blockOneStart];

  const mild = await applyIllness('illness_mild');
  ok('mild illness commits through the production door', mild.ok === true, mild.message);
  ok('mild illness is record-only and leaves the visible week exact',
    visibleSignature(quiet(() =>
      resolvedDays(illnessInstall.blockOneStart, declarationDay))) ===
      illnessBaselineSignature);
  const mildId = mild.createdModifierIds?.[0] ?? null;
  if (mildId) await clearFact(mildId, declarationDay);

  const moderate = await applyIllness('illness_moderate');
  ok('moderate illness commits through the production door', moderate.ok === true,
    moderate.message);
  const moderateVisible = quiet(() =>
    resolvedDays(illnessInstall.blockOneStart, declarationDay));
  ok('moderate illness reduces real prescribed dose',
    visibleSignature(moderateVisible) !== illnessBaselineSignature &&
      moderateVisible.reduce((sum, day) =>
        sum + day.rows.reduce((sets, row) => sets + Number(row.sets ?? 0), 0), 0) <
      illnessBaseline.reduce((sum, day) =>
        sum + day.rows.reduce((sets, row) => sets + Number(row.sets ?? 0), 0), 0));
  ok('moderate illness keeps the normal week mode and its required structure',
    landingOverlay()?.exposureContractV2?.identity.mode !== 'optional_week');
  const moderateId = moderate.createdModifierIds?.[0] ?? null;
  if (moderateId) await clearFact(moderateId, declarationDay);
  ok('clearing moderate illness restores the visible week exactly',
    visibleSignature(quiet(() =>
      resolvedDays(illnessInstall.blockOneStart, declarationDay))) ===
      illnessBaselineSignature);

  const severe = await applyIllness('illness_severe');
  ok('severe illness commits through the production door', severe.ok === true, severe.message);
  const severeContext = buildGenerationConstraintContext({
    activeConstraints: useProgramStore.getState().acceptedMaterialContext.activeConstraints,
    temporarySourceFacts:
      useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts,
    todayISO: illnessInstall.blockOneStart,
  });
  ok('the accepted severe fact translates once into both compiler flags',
    severeContext?.illness?.deloaded === true &&
      severeContext.illness.sessionsOptional === true,
    JSON.stringify(severeContext?.illness));
  const severeWeek = landingMicrocycle();
  const severeOverlay = landingOverlay();
  const surviving = Object.values(severeOverlay?.workoutsByDate ?? {})
    .filter((workout): workout is Workout => !!workout)
    .filter((workout) =>
    workout.workoutType !== 'Rest' && workout.workoutType !== 'Game');
  ok('severe illness keeps offered sessions but makes every survivor optional',
    surviving.length > 0 && surviving.every((workout) =>
      workout.sessionTier === 'optional' || workout.sessionTier === 'recovery'));
  ok('severe illness authors the optional-week contract through the compiler',
    severeOverlay?.exposureContractV2?.identity.mode === 'optional_week',
    JSON.stringify({
      base: severeWeek?.exposureContractV2?.identity.mode,
      overlay: severeOverlay?.exposureContractV2?.identity.mode,
      tiers: surviving.map((workout) => [workout.name, workout.sessionTier]),
    }));
  const severeId = severe.createdModifierIds?.[0] ?? null;
  if (severeId) await clearFact(severeId, declarationDay);
  ok('clearing severe illness restores the visible week exactly',
    visibleSignature(quiet(() =>
      resolvedDays(illnessInstall.blockOneStart, declarationDay))) ===
      illnessBaselineSignature);

  console.log('\n[injury slice] healthy -> knee restriction -> recovered');
  const injuryInstall = await coldStartThroughOnboarding({
    profile: athlete(), installDayISO: INSTALL_DAY,
  });
  ok('the injury witness reaches a real generated week through onboarding',
    injuryInstall.onboardingRefusal === null, injuryInstall.onboardingRefusal);
  const injuryBaseline = quiet(() =>
    resolvedDays(injuryInstall.blockOneStart, INSTALL_DAY));
  const injuryBaselineSignature = visibleSignature(injuryBaseline);
  const injurySelectionHistoryBefore = blockSelectionHistory();
  ok('the accepted healthy block recorded the selections injury must preserve underneath',
    injurySelectionHistoryBefore.some((selection) =>
      selection.blockStartISO === injuryInstall.blockOneStart),
    JSON.stringify(injurySelectionHistoryBefore));
  const injuryConstraint = buildGuidedInjuryConstraint({
    region: 'lower_body', area: 'knee', severity: 7,
    severityBand: 'avoid', adjustmentLevel: 'remove_risky',
    triggers: ['running', 'change of direction'], seriousSymptoms: false,
  } as never, { todayISO: declarationDay });
  const injurySet = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_injury_modifier',
    source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { constraint: injuryConstraint },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { todayISO: declarationDay }));
  ok('the athlete injury action commits through the production door',
    injurySet.ok === true, injurySet.message);
  const injuryEpisodeId = injurySet.createdModifierIds?.[0] ?? null;
  ok('the injury door returns the exact episode it authored',
    Boolean(injuryEpisodeId), JSON.stringify(injurySet.createdModifierIds));
  const injuryContext = buildGenerationConstraintContext({
    activeConstraints: useProgramStore.getState().acceptedMaterialContext.activeConstraints,
    temporarySourceFacts:
      useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts,
    todayISO: injuryInstall.blockOneStart,
    periodEndISO: '2026-07-19',
  });
  const acceptedInjuryPolicy = canonicalWeeklyInjuryStateFrom({
    profile: athlete(), generationConstraints: injuryContext,
  });
  ok('one accepted injury policy carries the lower-body decisions for every weekly specialist',
    acceptedInjuryPolicy.lowerBodyRestricted && acceptedInjuryPolicy.blocksAppSprint &&
      acceptedInjuryPolicy.prohibitedPatterns.includes('squat') &&
      acceptedInjuryPolicy.prohibitedPatterns.includes('hinge') &&
      acceptedInjuryPolicy.activeInjuryKeys.includes('knee'),
    JSON.stringify(acceptedInjuryPolicy));
  const injuryOverlay = useProgramStore.getState()
    .weekScopedOverlays[injuryInstall.blockOneStart];
  const prohibitedAfterInjury =
    injuryOverlay?.exposureContractV2?.strengthPatterns.prohibitedPatterns ?? [];
  ok('the accepted compiler contract carries the same prohibited patterns',
    prohibitedAfterInjury.includes('squat') && prohibitedAfterInjury.includes('hinge'),
    JSON.stringify(prohibitedAfterInjury));
  const injuryVisible = quiet(() =>
    resolvedDays(injuryInstall.blockOneStart, declarationDay));
  ok('the affected week retains real unaffected training instead of being emptied',
    injuryVisible.some((day) => day.rows.length > 0));
  const injuryCleared = injuryEpisodeId
    ? await quietAsync(() => executeProgramControlActionDurably({
        type: 'clear_injury_modifier',
        source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
        scope: 'current_and_future',
        payload: { episodeId: injuryEpisodeId },
        requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
      }, { todayISO: declarationDay }))
    : null;
  ok('the athlete can clear the exact injury episode',
    injuryCleared?.ok === true, injuryCleared?.message);
  const injuryRecovered = quiet(() =>
    resolvedDays(injuryInstall.blockOneStart, declarationDay));
  ok('clearing injury restores the visible accepted week exactly',
    visibleSignature(injuryRecovered) === injuryBaselineSignature,
    JSON.stringify({
      before: injuryBaseline.map((day) => [day.dateISO, day.rows.map((row) => row.name)]),
      after: injuryRecovered.map((day) => [day.dateISO, day.rows.map((row) => row.name)]),
      historyBefore: injurySelectionHistoryBefore,
      historyAfter: blockSelectionHistory(),
    }));

  console.log('\n[availability slice] normal -> away with reduced kit -> home');
  const awayInstall = await coldStartThroughOnboarding({
    profile: illnessAthlete(), installDayISO: INSTALL_DAY,
  });
  ok('the travel witness reaches a real club-and-game week through onboarding',
    awayInstall.onboardingRefusal === null, awayInstall.onboardingRefusal);
  const awaySignature = (days: ReturnType<typeof resolvedDays>): string => JSON.stringify(
    days.map((day) => [day.dateISO, day.sessionName, day.components, day.rows.map((row) => [
      row.name, row.sets ?? '', row.repsMin ?? '', row.repsMax ?? '', row.weightKg ?? '',
    ])]),
  );
  const awayBaseline = quiet(() => resolvedDays(awayInstall.blockOneStart, INSTALL_DAY));
  const awayBaselineSignature = awaySignature(awayBaseline);
  const awayFrom = '2026-07-15';
  const awayUntil = '2026-07-19';
  const scheduleAway = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_schedule_modifier',
    source: { screen: 'program_tab', surface: 'away_sheet', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: {
      date: awayFrom, todayISO: awayFrom,
      awaySpan: { from: awayFrom, until: awayUntil },
    },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { todayISO: awayFrom }));
  ok('the athlete travel action commits through the production door',
    scheduleAway.ok === true, scheduleAway.message);
  const scheduleAwayId = scheduleAway.createdModifierIds?.[0] ?? null;
  ok('the travel door returns the exact schedule fact it authored',
    Boolean(scheduleAwayId), JSON.stringify(scheduleAway.createdModifierIds));
  const scheduleAwayVisible = quiet(() => resolvedDays(awayInstall.blockOneStart, awayFrom));
  const governedAwayDays = scheduleAwayVisible.filter((day) =>
    day.dateISO >= awayFrom && day.dateISO <= awayUntil);
  ok('travel removes club and game anchors from the governed dates',
    governedAwayDays.every((day) =>
      day.sessionName !== 'Game Day' && !day.components.includes('club_training' as never)),
    JSON.stringify(governedAwayDays.map((day) =>
      [day.dateISO, day.sessionName, day.components])));
  ok('travel keeps the athlete\'s own authored work alive',
    governedAwayDays.some((day) => day.rows.length > 0));

  const equipmentAway = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_equipment_modifier',
    source: { screen: 'program_tab', surface: 'away_equipment_sheet', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: {
      date: awayFrom, todayISO: awayFrom,
      decision: {
        kind: 'missing_for_span', from: awayFrom, until: awayUntil,
        tags: [
          'barbell', 'dumbbells', 'cables', 'machine', 'bands', 'bench',
          'pullup_bar', 'kettlebell', 'foam_roller', 'plyo_box',
          'bike_or_treadmill',
        ],
        conditioningModalities: ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'],
      },
    },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { todayISO: awayFrom }));
  ok('the dated equipment action commits through the production door',
    equipmentAway.ok === true, equipmentAway.message);
  const equipmentAwayId = equipmentAway.createdModifierIds?.[0] ?? null;
  ok('the equipment door returns the exact fact it authored',
    Boolean(equipmentAwayId), JSON.stringify(equipmentAway.createdModifierIds));
  const reducedKitVisible = quiet(() => resolvedDays(awayInstall.blockOneStart, awayFrom));
  ok('dated kit changes only the governed part of the visible week',
    visibleSignature(reducedKitVisible.filter((day) => day.dateISO < awayFrom)) ===
      visibleSignature(scheduleAwayVisible.filter((day) => day.dateISO < awayFrom)) &&
      visibleSignature(reducedKitVisible.filter((day) => day.dateISO >= awayFrom)) !==
        visibleSignature(scheduleAwayVisible.filter((day) => day.dateISO >= awayFrom)),
    JSON.stringify({
      baseline: awayBaseline.map((day) => [day.dateISO, day.rows.map((row) => row.name)]),
      scheduleAway: scheduleAwayVisible.map((day) =>
        [day.dateISO, day.rows.map((row) => row.name)]),
      reduced: reducedKitVisible.map((day) => [day.dateISO, day.rows.map((row) => row.name)]),
    }));
  ok('reduced kit still leaves real training available while away',
    reducedKitVisible.filter((day) => day.dateISO >= awayFrom && day.dateISO <= awayUntil)
      .some((day) => day.rows.length > 0));

  if (equipmentAwayId) {
    await quietAsync(() => transactTemporarySourceFact({
      operation: 'resolve', factId: equipmentAwayId, todayISO: awayFrom,
    }));
  }
  if (scheduleAwayId) {
    await quietAsync(() => transactTemporarySourceFact({
      operation: 'resolve', factId: scheduleAwayId, todayISO: awayFrom,
    }));
  }
  await quietAsync(() => settleDerivedWorldAfterDecision());
  ok('resolving both availability facts restores the visible week exactly',
    awaySignature(quiet(() =>
      resolvedDays(awayInstall.blockOneStart, awayFrom))) === awayBaselineSignature,
    JSON.stringify({
      baseline: awayBaseline.map((day) =>
        [day.dateISO, day.sessionName, day.rows.map((row) => row.name)]),
      restored: quiet(() => resolvedDays(awayInstall.blockOneStart, awayFrom)).map((day) =>
        [day.dateISO, day.sessionName, day.rows.map((row) => row.name)]),
    }));

  console.log('\n[fixture slice] move onto occupied day -> move back');
  const fixtureInstall = await coldStartThroughOnboarding({
    profile: illnessAthlete(), installDayISO: INSTALL_DAY,
  });
  ok('the fixture witness reaches a real Saturday-game week through onboarding',
    fixtureInstall.onboardingRefusal === null, fixtureInstall.onboardingRefusal);
  const fixtureSignature = (days: ReturnType<typeof resolvedDays>): string => JSON.stringify(
    days.map((day) => [day.dateISO, day.sessionName, day.components, day.rows.map((row) => [
      row.name, row.sets ?? '', row.repsMin ?? '', row.repsMax ?? '', row.weightKg ?? '',
    ])]),
  );
  const fixtureBaseline = quiet(() => resolvedDays(fixtureInstall.blockOneStart, INSTALL_DAY));
  const fixtureBaselineSignature = fixtureSignature(fixtureBaseline);
  const saturday = '2026-07-18';
  const wednesday = '2026-07-15';
  const mutateFixture = async (sourceDate: string, targetDate: string, commandId: string) =>
    quietAsync(() => executeFixtureMutationTransaction({
      action: 'move',
      fixtureKind: 'game',
      sourceDate,
      targetDate,
      expectedAcceptedRevision:
        useProgramStore.getState().acceptedMaterialContext.revision,
      source: {
        requestedBy: 'athlete',
        producer: 'tap',
        surface: 'program_tab',
        commandId,
      },
      todayISO: INSTALL_DAY,
    }));
  const moved = await mutateFixture(saturday, wednesday, 'compiler-fixture:move-to-wed');
  ok('the athlete fixture move commits through the production door',
    moved.outcome === 'accepted', 'reason' in moved ? moved.reason : moved.outcome);
  const movedVisible = quiet(() => resolvedDays(fixtureInstall.blockOneStart, INSTALL_DAY));
  const movedWednesday = movedVisible.find((day) => day.dateISO === wednesday);
  const movedSaturday = movedVisible.find((day) => day.dateISO === saturday);
  ok('the moved game takes precedence over the session formerly on Wednesday',
    movedWednesday?.sessionName === 'Game Day' && movedWednesday.rows.length === 0,
    JSON.stringify(movedWednesday));
  ok('the old Saturday is no longer a game',
    movedSaturday?.sessionName !== 'Game Day', JSON.stringify(movedSaturday));
  const movedContract = useProgramStore.getState()
    .weekScopedOverlays[fixtureInstall.blockOneStart]?.exposureContractV2;
  const movedFixtureDays = movedContract?.anchors
    .filter((anchor) => anchor.kind === 'game' || anchor.kind === 'practice_match')
    .map((anchor) => anchor.dayOfWeek) ?? [];
  ok('the accepted compiler contract carries exactly the moved fixture anchor',
    JSON.stringify(movedFixtureDays) === JSON.stringify([3]),
    JSON.stringify(movedFixtureDays));
  const restoredFixture = await mutateFixture(
    wednesday, saturday, 'compiler-fixture:move-back-to-sat',
  );
  ok('the reverse fixture move commits through the same production door',
    restoredFixture.outcome === 'accepted',
    'reason' in restoredFixture ? restoredFixture.reason : restoredFixture.outcome);
  ok('moving the fixture back restores the visible week exactly',
    fixtureSignature(quiet(() =>
      resolvedDays(fixtureInstall.blockOneStart, INSTALL_DAY))) === fixtureBaselineSignature);

  totalsPrinted(failed);
  console.log(`\nCanonical weekly compiler slice: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`Failures: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
