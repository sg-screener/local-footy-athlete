/**
 * FIRST CANONICAL WEEKLY-COMPILER SLICE
 *
 * One ordinary healthy Off-season athlete enters through the real onboarding
 * door. The product compiler authors the block, accepted state validates and
 * installs it, and the visible resolver projects the exact accepted rows. The
 * source census beside the journey holds the ownership boundary: scheduler,
 * materialiser and connector each have one production caller — the compiler.
 *
 * NOT COVERED: fixture decisions still replay procedurally; exercise
 * exclusions remain their own persisted input; scheduled deloads, later
 * compiler families, full-year archetypes, pixels, simulator and physical
 * iPhone.
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
import type { OnboardingData, UserRemovalConstraint, Workout } from '../types/domain';
import { compileCanonicalWeek } from '../rules/canonicalWeeklyCompiler';
import { canonicalFixtureStateFrom } from '../rules/canonicalWeeklyFixtureState';
import { canonicalWeeklyInjuryStateFrom } from '../rules/canonicalWeeklyInjuryState';
import {
  canonicalWeeklyAvailabilityStateFrom,
  schedulerInputsWithAvailabilityState,
} from '../rules/canonicalWeeklyAvailabilityState';
import { canonicalWeeklyAthleteEditStateFrom } from '../rules/canonicalWeeklyAthleteEditState';
import {
  compileCanonicalAthleteEditedWeek,
} from '../rules/canonicalWeeklyAthleteEditCompiler';
import { compileCanonicalWeeklyExerciseEdits } from '../rules/canonicalWeeklyExerciseEditCompiler';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { useProgramStore } from '../store/programStore';
import {
  coldStartThroughOnboarding,
  quiet,
  quietAsync,
  relaunchApp,
  resolvedDays,
} from './support/athleteJourney';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { readinessActionForKind } from '../utils/weekReadinessActions';
import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import { settleDerivedWorldAfterDecision } from '../store/quiescentBoot';
import { blockSelectionHistory } from '../store/blockSelectionHistoryStore';
import { applyPlanChange } from '../utils/planChangeProducer';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { decisionLedgerEntries } from '../store/decisionLedgerStore';
import { DECISION_LEDGER_PERSISTENCE_KEY } from '../store/decisionLedgerStore';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';
import { undoLastDecision } from '../store/undoLastDecision';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  getTapSwapChoices,
  groupTapSwapChoices,
  resolveTapSwapEnvironment,
} from '../utils/tapSwapHierarchy';

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

function preseasonAthlete(): OnboardingData {
  return {
    ...illnessAthlete(),
    firstName: 'Practice-match compiler',
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    usualGameDay: undefined,
    gameDay: undefined,
    recentTrainingLoad: 'Very consistent',
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

  console.log('\n[athlete-edit ownership] add, swap, move and remove project through one compiler');
  const editStateSource = readFileSync(
    join(ROOT, 'rules/canonicalWeeklyAthleteEditState.ts'), 'utf8',
  );
  const editCompilerPath = 'rules/canonicalWeeklyAthleteEditCompiler.ts';
  const editCompilerSource = readFileSync(join(ROOT, editCompilerPath), 'utf8');
  const removalCompatibilitySource = readFileSync(
    join(ROOT, 'rules/userRemovalConstraints.ts'), 'utf8',
  );
  const acceptedEffectiveWeekSource = readFileSync(
    join(ROOT, 'rules/acceptedEffectiveWeek.ts'), 'utf8',
  );
  const dayPrecedenceSource = readFileSync(join(ROOT, 'rules/dayPrecedence.ts'), 'utf8');
  const programStoreSource = readFileSync(join(ROOT, 'store/programStore.ts'), 'utf8');
  const acceptedTransactionSource = readFileSync(
    join(ROOT, 'store/acceptedStateTransaction.ts'), 'utf8',
  );
  const derivedWeekContractSource = readFileSync(
    join(ROOT, 'rules/derivedWeekContract.ts'), 'utf8',
  );
  const temporaryFactTransactionSource = readFileSync(
    join(ROOT, 'store/temporarySourceFactTransaction.ts'), 'utf8',
  );
  const exerciseEditStateSource = readFileSync(
    join(ROOT, 'rules/canonicalWeeklyExerciseEditState.ts'), 'utf8',
  );
  const exerciseEditCompilerSource = readFileSync(
    join(ROOT, 'rules/canonicalWeeklyExerciseEditCompiler.ts'), 'utf8',
  );
  const sessionEditStatePath = join(ROOT, 'rules/canonicalWeeklySessionEditState.ts');
  const sessionEditCompilerPath = join(ROOT, 'rules/canonicalWeeklySessionEditCompiler.ts');
  const sessionEditStateSource = existsSync(sessionEditStatePath)
    ? readFileSync(sessionEditStatePath, 'utf8') : '';
  const sessionEditCompilerSource = existsSync(sessionEditCompilerPath)
    ? readFileSync(sessionEditCompilerPath, 'utf8') : '';
  const fixtureEditStatePath = join(ROOT, 'rules/canonicalWeeklyFixtureEditState.ts');
  const fixtureEditStateSource = existsSync(fixtureEditStatePath)
    ? readFileSync(fixtureEditStatePath, 'utf8') : '';
  const fixtureEditCompilerPath = join(ROOT, 'rules/canonicalWeeklyFixtureEditCompiler.ts');
  const fixtureEditCompilerSource = existsSync(fixtureEditCompilerPath)
    ? readFileSync(fixtureEditCompilerPath, 'utf8') : '';
  const decisionLedgerTypeSource = readFileSync(join(ROOT, 'types/decisionLedger.ts'), 'utf8');
  const quiescentBootSource = readFileSync(join(ROOT, 'store/quiescentBoot.ts'), 'utf8');
  const legacySessionMigrationSource = readFileSync(
    join(ROOT, 'store/legacyPlanChangeEffectMigration.ts'), 'utf8',
  );
  const ledgerReplaySource = readFileSync(
    join(ROOT, 'rules/decisionLedgerReplay.ts'), 'utf8',
  );
  const coachActionsSource = readFileSync(join(ROOT, 'utils/coachActions.ts'), 'utf8');
  const derivedExerciseDecisionSource = readFileSync(
    join(ROOT, 'utils/derivedExerciseDecisions.ts'), 'utf8',
  );
  const todayProjectionStart = acceptedTransactionSource.indexOf(
    'const todayConstraintWorkout =',
  );
  const todayProjectionEnd = acceptedTransactionSource.indexOf(
    '\n  const proposal:', todayProjectionStart,
  );
  const todayProjectionRegion = acceptedTransactionSource.slice(
    todayProjectionStart, todayProjectionEnd,
  );
  ok('the accepted-transaction today projection region was found',
    todayProjectionStart >= 0 && todayProjectionEnd > todayProjectionStart);
  ok('one semantic weekly athlete-edit state exists',
    editStateSource.includes('export interface CanonicalWeeklyAthleteEditState'));
  ok('the edit state translates all accepted placement fields once',
    editStateSource.includes('constraint.remainingWorkout') &&
      editStateSource.includes('constraint.wholeDayRestOwned') &&
      editStateSource.includes("constraint.mutationKind === 'move'") &&
      editStateSource.includes('constraint.movedWorkout'));
  ok('the semantic edit state owns contract-reduction requests too',
    editStateSource.includes('reductionRequests:') &&
      editStateSource.includes('constraintId: constraint.id') &&
      editStateSource.includes('scope: constraint.scope'));
  ok('the athlete-edit compiler owns the contract reduction',
    editCompilerSource.includes('export function compileCanonicalAthleteEditedContract') &&
      editCompilerSource.includes('for (const request of edits.reductionRequests)'));
  ok('the compatibility adapter delegates instead of projecting edits itself',
    removalCompatibilitySource.includes('return compileCanonicalAthleteEditedWeek({') &&
      !removalCompatibilitySource.includes('constraint.remainingWorkout') &&
      !removalCompatibilitySource.includes('constraint.movedWorkout'));
  ok('the retired contract reducer is now only a compatibility delegation',
    removalCompatibilitySource.includes('return compileCanonicalAthleteEditedContract({') &&
      !removalCompatibilitySource.includes('function addFrequencyReduction(') &&
      !removalCompatibilitySource.includes('policy.requiredMinimum ='));
  ok('accepted, live-precedence and hydration readers all use the compiler projection',
    acceptedEffectiveWeekSource.includes('compileCanonicalAthleteEditedWeek({') &&
      dayPrecedenceSource.includes('compileCanonicalAthleteEditedWeek({') &&
      programStoreSource.includes('compileCanonicalAthleteEditedWeek({') &&
      todayProjectionRegion.includes('compileCanonicalAthleteEditedWeek({'));
  const editPlacementRivalAuthors = [
    acceptedEffectiveWeekSource.includes('applyUserRemovalConstraintsToWeek(')
      ? 'accepted reader applies edits itself' : null,
    dayPrecedenceSource.includes('applyUserRemovalConstraintsToWeek(')
      ? 'live precedence applies edits itself' : null,
    programStoreSource.includes('applyUserRemovalConstraintsToWeek(')
      ? 'hydration applies edits itself' : null,
    removalCompatibilitySource.includes('constraint.remainingWorkout') ||
      removalCompatibilitySource.includes('constraint.movedWorkout')
      ? 'compatibility adapter interprets placement fields' : null,
    todayProjectionRegion.includes('constraint.remainingWorkout') ||
      todayProjectionRegion.includes('constraint.movedWorkout')
      ? 'accepted transaction authors today output itself' : null,
  ].filter((finding): finding is string => finding !== null);
  ok('weekly athlete-edit placement rival-author count is literally zero',
    editPlacementRivalAuthors.length === 0, JSON.stringify(editPlacementRivalAuthors));
  ok('athlete-edit contract-reduction rival-author count is literally zero',
    productionCallers('applyAthleteRemovalTypedReduction').length === 0,
    JSON.stringify(productionCallers('applyAthleteRemovalTypedReduction')));
  ok('contract readers and repair loops all call the compiler owner',
    derivedWeekContractSource.includes('compileCanonicalAthleteEditedContract({') &&
      temporaryFactTransactionSource.includes('compileCanonicalAthleteEditedContract({') &&
      fixtureReplanSource.includes('compileCanonicalAthleteEditedContract({'));
  ok('athlete-edit placement stamps have one production writer: the semantic compiler state',
    JSON.stringify(productionCallers('athletePlacementFor')) ===
      JSON.stringify(['rules/canonicalWeeklyAthleteEditState.ts']),
    JSON.stringify(productionCallers('athletePlacementFor')));
  ok('[MUTATION] bypassing the accepted-week compiler projection is detected',
    acceptedEffectiveWeekSource.includes('compileCanonicalAthleteEditedWeek({') &&
      !acceptedEffectiveWeekSource.replace(
        'compileCanonicalAthleteEditedWeek({',
        'compileCanonicalAthleteEditedWeek_REMOVED({',
      ).includes('compileCanonicalAthleteEditedWeek({'));
  ok('[MUTATION] removing the compiler placement loop is detected',
    editCompilerSource.includes('for (const placement of edits.placements)') &&
      !editCompilerSource.replace(
        'for (const placement of edits.placements)',
        'for (const placement of [])',
      ).includes('for (const placement of edits.placements)'));
  ok('[MUTATION] restoring the transaction-local today projection is detected',
    todayProjectionRegion.includes('compileCanonicalAthleteEditedWeek({') &&
      !todayProjectionRegion.replace(
        'compileCanonicalAthleteEditedWeek({',
        'compileCanonicalAthleteEditedWeek_REMOVED({',
      ).includes('compileCanonicalAthleteEditedWeek({'));
  ok('[MUTATION] removing the compiler contract-reduction loop is detected',
    editCompilerSource.includes('for (const request of edits.reductionRequests)') &&
      !editCompilerSource.replace(
        'for (const request of edits.reductionRequests)',
        'for (const request of [])',
      ).includes('for (const request of edits.reductionRequests)'));
  ok('accepted exercise actions translate once into a typed weekly edit state',
    exerciseEditStateSource.includes('export interface CanonicalWeeklyExerciseEditState') &&
      exerciseEditStateSource.includes("action.type === 'swap_exercise'") &&
      exerciseEditStateSource.includes("action.type === 'add_exercise'") &&
      exerciseEditStateSource.includes("action.type === 'remove_exercise'"));
  ok('one pure exercise-edit compiler folds the ordered accepted actions',
    exerciseEditCompilerSource.includes('export function compileCanonicalWeeklyExerciseEdits') &&
      exerciseEditCompilerSource.includes('for (const edit of args.state.edits)'));
  ok('boot delegates exercise edits to the compiler instead of re-entering the action door',
    quiescentBootSource.includes('compileCanonicalWeeklyExerciseEdits({') &&
      !quiescentBootSource.includes("if (decision.kind === 'program_control')"));
  ok('the live Swap/Add writers delegate their row transform to the same compiler',
    coachActionsSource.includes('compileCanonicalExerciseEditOnWorkout(current, {') &&
      !coachActionsSource.includes('const replacement: WorkoutExercise =') &&
      !coachActionsSource.includes('const added: WorkoutExercise ='));
  ok('derived mobility and recovery rows consume the semantic edit state',
    derivedExerciseDecisionSource.includes('canonicalWeeklyExerciseEditStateFrom({') &&
      !derivedExerciseDecisionSource.includes("entry.decision.kind !== 'program_control'") &&
      !derivedExerciseDecisionSource.includes("action.type !== 'swap_exercise'"));
  ok('[MUTATION] removing the weekly exercise-edit fold is detected',
    exerciseEditCompilerSource.includes('for (const edit of args.state.edits)') &&
      !exerciseEditCompilerSource.replace(
        'for (const edit of args.state.edits)',
        'for (const edit of [])',
      ).includes('for (const edit of args.state.edits)'));
  ok('accepted session actions carry their exact semantic constraint effect',
    decisionLedgerTypeSource.includes('acceptedEffect: CanonicalAcceptedSessionEditEffect') &&
      sessionEditStateSource.includes('export interface CanonicalAcceptedSessionEditEffect'));
  ok('accepted session effects translate once into ordered compiler state',
    sessionEditStateSource.includes('export interface CanonicalWeeklySessionEditState') &&
      sessionEditStateSource.includes('canonicalWeeklySessionEditStateFrom'));
  ok('one pure session-edit fold owns constraint state for live actions and boot',
    sessionEditCompilerSource.includes('export function compileCanonicalSessionConstraintEffects') &&
      sessionEditCompilerSource.includes('for (const effect of args.effects)') &&
      acceptedTransactionSource.includes('compileCanonicalSessionConstraintEffects({'));
  ok('boot compiles accepted session effects instead of re-entering applyPlanChange',
    quiescentBootSource.includes('commitCanonicalAcceptedSessionEditEffect(effect)') &&
      quiescentBootSource.includes('Session edits never enter this interpreter') &&
      !quiescentBootSource.includes("require('../utils/planChangeProducer')"));
  ok('old plan-change rows have one append-only semantic upgrade boundary',
    decisionLedgerTypeSource.includes("kind: 'legacy_plan_change_effect_upgrade'") &&
      legacySessionMigrationSource.includes('replayLegacyPlanChangeEntryToEffect') &&
      quiescentBootSource.includes('appendLegacyPlanChangeEffectUpgrade(upgrade)') &&
      ledgerReplaySource.includes(
        "entry.decision.kind !== 'legacy_plan_change_effect_upgrade'",
      ));
  ok('[MUTATION] removing the ordered session-effect fold is detected',
    sessionEditCompilerSource.includes('for (const effect of args.effects)') &&
      !sessionEditCompilerSource.replace(
        'for (const effect of args.effects)',
        'for (const effect of [])',
      ).includes('for (const effect of args.effects)'));
  ok('accepted fixture actions carry their exact semantic calendar effect',
    decisionLedgerTypeSource.includes('acceptedEffect: CanonicalAcceptedFixtureEditEffect') &&
      fixtureEditStateSource.includes('export interface CanonicalAcceptedFixtureEditEffect'));
  ok('accepted fixture effects translate once into ordered compiler state',
    fixtureEditStateSource.includes('export interface CanonicalWeeklyFixtureEditState') &&
      fixtureEditStateSource.includes('canonicalWeeklyFixtureEditStateFrom'));
  ok('one pure fixture-effect fold owns accepted calendar state',
    fixtureEditCompilerSource.includes('export function compileCanonicalFixtureMarkedDays') &&
      fixtureEditCompilerSource.includes('for (const effect of args.effects)'));
  ok('live fixture actions and boot commit the same accepted effect',
    acceptedTransactionSource.includes('commitCanonicalAcceptedFixtureEditEffect') &&
      quiescentBootSource.includes('commitCanonicalAcceptedFixtureEditEffect(effect)'));
  ok('boot compiles fixture effects instead of re-entering the live transaction',
    !quiescentBootSource.includes("require('./fixtureMutationTransaction')") &&
      !quiescentBootSource.includes('executeFixtureMutationInMemory({'));
  ok('old fixture rows have one append-only semantic upgrade boundary',
    decisionLedgerTypeSource.includes("kind: 'legacy_fixture_effect_upgrade'") &&
      quiescentBootSource.includes('appendLegacyFixtureEffectUpgrade(upgrade)') &&
      ledgerReplaySource.includes("entry.decision.kind !== 'legacy_fixture_effect_upgrade'"));
  ok('[MUTATION] removing the ordered fixture-effect fold is detected',
    fixtureEditCompilerSource.includes('for (const effect of args.effects)') &&
      !fixtureEditCompilerSource.replace(
        'for (const effect of args.effects)',
        'for (const effect of [])',
      ).includes('for (const effect of args.effects)'));

  const editWorkout = (id: string, dayOfWeek: number, name: string): Workout => ({
    id, microcycleId: 'edit-week', dayOfWeek, name,
    description: '', durationMinutes: 30, intensity: 'Moderate',
    workoutType: name === 'Rest' ? 'Rest' : 'Strength', exercises: [],
    createdAt: INSTALL_DAY, updatedAt: INSTALL_DAY,
  } as unknown as Workout);
  const editConstraint = (args: {
    id: string; createdAt: string; targetDate: string; original: Workout;
    remaining?: Workout | null; wholeDayRestOwned?: boolean;
    moveTargetDate?: string; moved?: Workout;
  }): UserRemovalConstraint => ({
    protocolVersion: 1, id: args.id, authorship: 'user', source: 'tap',
    mutationKind: args.moveTargetDate ? 'move' : 'deletion', status: 'active',
    targetDate: args.targetDate, scope: 'whole_session',
    targetPlanEntryId: args.original.planEntryId ?? null,
    targetWorkoutId: args.original.id, originalWorkout: args.original,
    remainingWorkout: args.remaining ?? null,
    equivalentExposureMayRelocate: true,
    wholeDayRestOwned: args.wholeDayRestOwned ?? false,
    moveTargetDate: args.moveTargetDate,
    moveTargetPlanEntryId: args.moved?.planEntryId ?? null,
    moveTargetWorkoutId: args.moved?.id,
    movedWorkout: args.moved,
    createdAt: args.createdAt, restoredAt: null, restorationReason: null,
  } as UserRemovalConstraint);
  const mondayBase = editWorkout('base-mon', 1, 'Monday Base');
  const tuesdayBase = editWorkout('base-tue', 2, 'Tuesday Base');
  const wednesdayBase = editWorkout('base-wed', 3, 'Wednesday Base');
  const fridayBase = editWorkout('base-fri', 5, 'Friday Base');
  const sundayBase = editWorkout('base-sun', 0, 'Sunday Base');
  const editConstraints = [
    editConstraint({
      id: 'remove-mon', createdAt: '2026-07-13T01:00:00Z',
      targetDate: '2026-07-13', original: mondayBase, wholeDayRestOwned: true,
    }),
    editConstraint({
      id: 'move-tue-sun', createdAt: '2026-07-13T02:00:00Z',
      targetDate: '2026-07-14', original: tuesdayBase, wholeDayRestOwned: true,
      moveTargetDate: '2026-07-19', moved: editWorkout('base-tue', 0, 'Moved Session'),
    }),
    editConstraint({
      id: 'swap-wed', createdAt: '2026-07-13T03:00:00Z',
      targetDate: '2026-07-15', original: wednesdayBase,
      remaining: editWorkout('swap-wed-workout', 3, 'Swapped Session'),
    }),
    editConstraint({
      id: 'add-fri', createdAt: '2026-07-13T04:00:00Z',
      targetDate: '2026-07-17', original: editWorkout('rest-fri', 5, 'Rest'),
      remaining: editWorkout('added-fri-workout', 5, 'Added Session'),
    }),
  ];
  const semanticEditState = canonicalWeeklyAthleteEditStateFrom({
    weekStartISO: INSTALL_DAY,
    constraints: editConstraints,
  });
  const projectedEdits = compileCanonicalAthleteEditedWeek({
    workouts: [mondayBase, tuesdayBase, wednesdayBase, fridayBase, sundayBase],
    weekStartISO: INSTALL_DAY,
    edits: semanticEditState,
  });
  const editedName = (day: number): string | null =>
    projectedEdits.find((workout) => workout.dayOfWeek === day)?.name ?? null;
  ok('one semantic edit state covers add, swap, move-source, move-target and remove',
    semanticEditState.activeConstraintIds.length === 4 &&
      semanticEditState.placements.length === 5,
    JSON.stringify(semanticEditState));
  ok('the compiler projects removal as athlete-owned emptiness without a calendar fact',
    editedName(1) === 'Rest' &&
      projectedEdits.find((workout) => workout.dayOfWeek === 1)
        ?.athletePlacement?.constraintId === 'remove-mon');
  ok('the compiler projects both halves of a move without losing the moved identity',
    editedName(2) === 'Rest' && editedName(0) === 'Moved Session' &&
      projectedEdits.find((workout) => workout.dayOfWeek === 0)
        ?.athletePlacement?.constraintId === 'move-tue-sun');
  ok('the compiler projects swap and add as the athlete-owned chosen sessions',
    editedName(3) === 'Swapped Session' && editedName(5) === 'Added Session' &&
      projectedEdits.find((workout) => workout.dayOfWeek === 3)
        ?.athletePlacement?.constraintId === 'swap-wed' &&
      projectedEdits.find((workout) => workout.dayOfWeek === 5)
        ?.athletePlacement?.constraintId === 'add-fri');

  const duplicateNameWorkout = {
    ...editWorkout('identity-workout', 1, 'Identity workout'),
    exercises: [
      {
        id: 'component-a', exerciseId: 'exercise-a', exerciseOrder: 0,
        prescribedSets: 3, prescribedRepsMin: 8, prescribedRepsMax: 10,
        prescribedWeightKg: 30,
        exercise: { id: 'exercise-a', name: 'Split Squat' },
      },
      {
        id: 'component-b', exerciseId: 'exercise-b', exerciseOrder: 1,
        prescribedSets: 3, prescribedRepsMin: 8, prescribedRepsMax: 10,
        prescribedWeightKg: 35,
        exercise: { id: 'exercise-b', name: 'Split Squat' },
      },
    ],
  } as Workout;
  const identityCompiled = compileCanonicalWeeklyExerciseEdits({
    workouts: [duplicateNameWorkout],
    state: {
      kind: 'weekly_exercise_edits', weekStartISO: '2026-07-13',
      edits: [{
        kind: 'swap', decisionId: 'identity-swap', occurredAt: INSTALL_DAY,
        dateISO: '2026-07-13', targetName: 'Split Squat',
        targetComponentId: 'component-b',
        replacement: {
          name: 'Reverse Lunge', sets: 3, repsMin: 6, repsMax: 8, weight: 17.5,
        },
      }],
    },
  });
  const identityRows = identityCompiled.workouts[0]?.exercises ?? [];
  ok('typed component identity selects the exact duplicate row without name guessing',
    identityRows[0]?.exercise?.name === 'Split Squat' &&
      identityRows[1]?.exercise?.name === 'Reverse Lunge' &&
      identityRows[1]?.prescribedWeightKg === 17.5,
    JSON.stringify(identityRows));
  const missingIdentityCompiled = compileCanonicalWeeklyExerciseEdits({
    workouts: [duplicateNameWorkout],
    state: {
      kind: 'weekly_exercise_edits', weekStartISO: '2026-07-13',
      edits: [{
        kind: 'swap', decisionId: 'missing-identity-swap', occurredAt: INSTALL_DAY,
        dateISO: '2026-07-13', targetName: 'Split Squat',
        targetComponentId: 'component-that-no-longer-exists',
        replacement: {
          name: 'Reverse Lunge', sets: 3, repsMin: 6, repsMax: 8, weight: 17.5,
        },
      }],
    },
  });
  ok('a missing typed component id never falls back to a duplicate display name',
    JSON.stringify(missingIdentityCompiled.workouts) === JSON.stringify([duplicateNameWorkout]),
    JSON.stringify(missingIdentityCompiled.workouts));

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

  const visibleSignature = (days: ReturnType<typeof resolvedDays>): string => JSON.stringify(
    days.map((day) => [day.dateISO, day.rows.map((row) => [
      row.name, row.sets ?? '', row.repsMin ?? '', row.repsMax ?? '', row.weightKg ?? '',
    ])]),
  );
  const baselineSignature = visibleSignature(visible);

  console.log('\n[athlete-edit slice] accepted remove -> visible projection -> undo');
  const rawEditWeek = quiet(() => deriveVisibleWeekLive(install.blockOneStart, INSTALL_DAY));
  const removableDay = visible.find((day) => day.rows.length > 0);
  const removal = removableDay
    ? quiet(() => applyPlanChange({
        change: { kind: 'remove_session', date: removableDay.dateISO, scope: 'whole_day' },
        visibleWeek: rawEditWeek,
        todayISO: INSTALL_DAY,
        applyOverride: () => undefined,
      }))
    : null;
  ok('the athlete remove action commits through the production edit door',
    removal?.ok === true, removal?.message);
  ok('the accepted action writes one typed edit decision and one active placement constraint',
    decisionLedgerEntries().some((entry) =>
      entry.decision.kind === 'plan_change' &&
      entry.decision.change.kind === 'remove_session' &&
      entry.decision.change.date === removableDay?.dateISO) &&
      useProgramStore.getState().userRemovalConstraints.some((constraint) =>
        constraint.status === 'active' && constraint.targetDate === removableDay?.dateISO));
  const removedVisible = quiet(() => resolvedDays(install.blockOneStart, INSTALL_DAY));
  ok('the visible week consumes the compiler-owned empty placement',
    removedVisible.find((day) => day.dateISO === removableDay?.dateISO)?.rows.length === 0,
    JSON.stringify(removedVisible.find((day) => day.dateISO === removableDay?.dateISO)));
  const undoRemoval = await quietAsync(() => undoLastDecision());
  ok('undo annuls the exact accepted edit decision', undoRemoval.outcome === 'undone',
    JSON.stringify(undoRemoval));
  ok('undoing the edit restores the visible accepted week exactly',
    visibleSignature(quiet(() => resolvedDays(install.blockOneStart, INSTALL_DAY))) ===
      baselineSignature);

  console.log('\n[readiness slice] normal -> cooked rolling window -> recovered');
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
  ok('the occupied fixture target is a real multi-part training day',
    (fixtureBaseline.find((day) => day.dateISO === wednesday)?.components.length ?? 0) > 1,
    JSON.stringify(fixtureBaseline.find((day) => day.dateISO === wednesday)));
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

  console.log('\n[fixture durability] Add, Move and Remove compile across restart and Undo');
  const runFixtureRestartWitness = async (
    action: 'add' | 'move' | 'remove',
  ): Promise<{
    landed: boolean; changed: boolean; restarted: boolean; exact: boolean;
    undoOnlyLast: boolean; detail: string;
  }> => {
    localStorageData.clear();
    const install = await coldStartThroughOnboarding({
      profile: illnessAthlete(), installDayISO: INSTALL_DAY,
    });
    const act = async (args: {
      action: 'add' | 'move' | 'remove'; sourceDate?: string; targetDate?: string;
      commandId: string;
    }) => quietAsync(() => executeFixtureMutationTransaction({
      action: args.action,
      fixtureKind: 'game',
      sourceDate: args.sourceDate,
      targetDate: args.targetDate,
      expectedAcceptedRevision:
        useProgramStore.getState().acceptedMaterialContext.revision,
      source: {
        requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
        commandId: args.commandId,
      },
      todayISO: INSTALL_DAY,
    }));
    const saturdayDate = '2026-07-18';
    const occupiedDate = '2026-07-15';
    let beforeLast = quiet(() => resolvedDays(install.blockOneStart, INSTALL_DAY));
    let result: Awaited<ReturnType<typeof act>>;
    if (action === 'add') {
      const prerequisite = await act({
        action: 'remove', sourceDate: saturdayDate,
        commandId: 'compiler-fixture:add-prerequisite-remove',
      });
      if (prerequisite.outcome !== 'accepted') {
        return {
          landed: false, changed: false, restarted: false, exact: false,
          undoOnlyLast: false, detail: JSON.stringify(prerequisite),
        };
      }
      beforeLast = quiet(() => resolvedDays(install.blockOneStart, INSTALL_DAY));
      result = await act({
        action: 'add', targetDate: occupiedDate,
        commandId: 'compiler-fixture:add-occupied',
      });
    } else if (action === 'move') {
      result = await act({
        action: 'move', sourceDate: saturdayDate, targetDate: occupiedDate,
        commandId: 'compiler-fixture:move-occupied',
      });
    } else {
      result = await act({
        action: 'remove', sourceDate: saturdayDate,
        commandId: 'compiler-fixture:remove',
      });
    }
    const after = quiet(() => resolvedDays(install.blockOneStart, INSTALL_DAY));
    const afterSignature = fixtureSignature(after);
    const restarted = await quietAsync(() => relaunchApp({
      storage: localStorageData, todayISO: INSTALL_DAY,
    }));
    const afterRestart = quiet(() => resolvedDays(install.blockOneStart, INSTALL_DAY));
    const activeAdjustments = useProgramStore.getState()
      .reversibleAdjustmentLedger.adjustments
      .filter((adjustment) => adjustment.status === 'active').length;
    const undo = await quietAsync(() => undoLastDecision());
    const afterUndo = quiet(() => resolvedDays(install.blockOneStart, INSTALL_DAY));
    return {
      landed: result.outcome === 'accepted',
      changed: afterSignature !== fixtureSignature(beforeLast),
      restarted: restarted.ok,
      exact: fixtureSignature(afterRestart) === afterSignature,
      undoOnlyLast: activeAdjustments > 0 && undo.outcome === 'undone' &&
        fixtureSignature(afterUndo) === fixtureSignature(beforeLast),
      detail: JSON.stringify({
        action,
        resultOutcome: result.outcome,
        acceptedEffect: decisionLedgerEntries().find((entry) =>
          entry.decision.kind === `fixture_${action}`)?.decision,
        markedDays: useProgramStore.getState().acceptedMaterialContext.markedDays,
        after: after.map((day) => [day.dateISO, day.sessionName]),
        afterRestart: afterRestart.map((day) => [day.dateISO, day.sessionName]),
        undo,
        afterUndo: afterUndo.map((day) => [day.dateISO, day.sessionName]),
      }),
    };
  };
  for (const action of ['add', 'move', 'remove'] as const) {
    const witness = await runFixtureRestartWitness(action);
    ok(`fixture ${action} reaches a non-vacuous accepted state`,
      witness.landed && witness.changed, witness.detail);
    ok(`fixture ${action} survives process death byte-for-byte`,
      witness.restarted && witness.exact, witness.detail);
    ok(`fixture ${action} keeps one exact Undo after restart`,
      witness.undoOnlyLast, witness.detail);
  }

  console.log('\n[fixture composition] accumulated Add, Move and Remove keep ledger order');
  localStorageData.clear();
  const fixtureCompositionInstall = await coldStartThroughOnboarding({
    profile: illnessAthlete(), installDayISO: INSTALL_DAY,
  });
  const composeFixture = async (args: {
    action: 'add' | 'move' | 'remove'; sourceDate?: string; targetDate?: string;
    commandId: string;
  }) => quietAsync(() => executeFixtureMutationTransaction({
    action: args.action, fixtureKind: 'game',
    sourceDate: args.sourceDate, targetDate: args.targetDate,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: {
      requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
      commandId: args.commandId,
    },
    todayISO: INSTALL_DAY,
  }));
  const compositionRemoveBase = await composeFixture({
    action: 'remove', sourceDate: saturday,
    commandId: 'compiler-fixture:composition-remove-base',
  });
  const compositionAdd = await composeFixture({
    action: 'add', targetDate: wednesday,
    commandId: 'compiler-fixture:composition-add',
  });
  const compositionMove = await composeFixture({
    action: 'move', sourceDate: wednesday, targetDate: '2026-07-17',
    commandId: 'compiler-fixture:composition-move',
  });
  const beforeCompositionRemove = quiet(() =>
    resolvedDays(fixtureCompositionInstall.blockOneStart, INSTALL_DAY));
  const compositionRemove = await composeFixture({
    action: 'remove', sourceDate: '2026-07-17',
    commandId: 'compiler-fixture:composition-remove',
  });
  const compositionAfter = quiet(() =>
    resolvedDays(fixtureCompositionInstall.blockOneStart, INSTALL_DAY));
  const compositionSignature = fixtureSignature(compositionAfter);
  const compositionRestart = await quietAsync(() => relaunchApp({
    storage: localStorageData, todayISO: INSTALL_DAY,
  }));
  ok('accumulated fixture actions all land through one accepted-effect family',
    compositionRemoveBase.outcome === 'accepted' && compositionAdd.outcome === 'accepted' &&
      compositionMove.outcome === 'accepted' && compositionRemove.outcome === 'accepted',
    JSON.stringify({ compositionRemoveBase, compositionAdd, compositionMove, compositionRemove }));
  ok('accumulated fixture effects survive process death in ledger order',
    compositionRestart.ok && fixtureSignature(quiet(() =>
      resolvedDays(fixtureCompositionInstall.blockOneStart, INSTALL_DAY))) ===
      compositionSignature);
  const compositionUndo = await quietAsync(() => undoLastDecision());
  ok('one Undo removes only the latest accumulated fixture effect',
    compositionUndo.outcome === 'undone' && fixtureSignature(quiet(() =>
      resolvedDays(fixtureCompositionInstall.blockOneStart, INSTALL_DAY))) ===
      fixtureSignature(beforeCompositionRemove),
    JSON.stringify(compositionUndo));

  console.log('\n[fixture variant] practice match uses the same accepted-effect compiler');
  localStorageData.clear();
  const practiceInstall = await coldStartThroughOnboarding({
    profile: preseasonAthlete(), installDayISO: INSTALL_DAY,
  });
  const practiceBefore = quiet(() =>
    resolvedDays(practiceInstall.blockOneStart, INSTALL_DAY));
  const practiceMove = await quietAsync(() => executeFixtureMutationTransaction({
    action: 'add', fixtureKind: 'practice_match', targetDate: wednesday,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: {
      requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
      commandId: 'compiler-practice-match:add',
    },
    todayISO: INSTALL_DAY,
  }));
  const practiceAfter = quiet(() =>
    resolvedDays(practiceInstall.blockOneStart, INSTALL_DAY));
  const practiceAfterSignature = fixtureSignature(practiceAfter);
  const practiceRestart = await quietAsync(() => relaunchApp({
    storage: localStorageData, todayISO: INSTALL_DAY,
  }));
  const practiceEffect = decisionLedgerEntries().find((entry) =>
    entry.decision.kind === 'fixture_add')?.decision;
  ok('practice-match Add records the typed variant and takes occupied-day precedence',
    practiceMove.outcome === 'accepted' &&
      practiceEffect?.kind === 'fixture_add' &&
      practiceEffect.acceptedEffect.fixtureKind === 'practice_match' &&
      fixtureSignature(practiceAfter) !== fixtureSignature(practiceBefore) &&
      practiceAfter.find((day) => day.dateISO === wednesday)?.rows.length === 0,
    JSON.stringify({ practiceMove, practiceEffect, practiceAfter }));
  ok('practice-match Add survives process death through the same compiler',
    practiceRestart.ok && fixtureSignature(quiet(() =>
      resolvedDays(practiceInstall.blockOneStart, INSTALL_DAY))) === practiceAfterSignature);

  console.log('\n[fixture migration] a pre-effect fixture decision upgrades once in place');
  localStorageData.clear();
  const legacyFixtureInstall = await coldStartThroughOnboarding({
    profile: illnessAthlete(), installDayISO: INSTALL_DAY,
  });
  const legacyFixtureBefore = quiet(() =>
    resolvedDays(legacyFixtureInstall.blockOneStart, INSTALL_DAY));
  const legacyFixtureMove = await quietAsync(() => executeFixtureMutationTransaction({
    action: 'move', fixtureKind: 'game', sourceDate: saturday, targetDate: wednesday,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: {
      requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
      commandId: 'compiler-fixture:legacy-move',
    },
    todayISO: INSTALL_DAY,
  }));
  const legacyFixtureAfterSignature = fixtureSignature(quiet(() =>
    resolvedDays(legacyFixtureInstall.blockOneStart, INSTALL_DAY)));
  const legacyFixtureEntry = decisionLedgerEntries().find((entry) =>
    entry.decision.kind === 'fixture_move' && entry.decision.toDate === wednesday);
  await flushPendingStorageWrites();
  const legacyFixtureEnvelopeRaw =
    localStorageData.get(DECISION_LEDGER_PERSISTENCE_KEY) ?? '';
  if (legacyFixtureEnvelopeRaw && legacyFixtureEntry) {
    const envelope = JSON.parse(legacyFixtureEnvelopeRaw) as {
      state?: { entries?: Array<{ id?: string; decision?: Record<string, unknown> }> };
    };
    const stored = envelope.state?.entries?.find((entry) =>
      entry.id === legacyFixtureEntry.id);
    if (stored?.decision) delete stored.decision.acceptedEffect;
    localStorageData.set(DECISION_LEDGER_PERSISTENCE_KEY, JSON.stringify(envelope));
  }
  const firstLegacyFixtureRestart = await quietAsync(() => relaunchApp({
    storage: localStorageData, todayISO: INSTALL_DAY,
  }));
  const firstLegacyFixtureUpgradeCount = decisionLedgerEntries().filter((entry) =>
    entry.decision.kind === 'legacy_fixture_effect_upgrade' &&
    entry.decision.sourceEntryId === legacyFixtureEntry?.id).length;
  const firstLegacyFixtureSignature = fixtureSignature(quiet(() =>
    resolvedDays(legacyFixtureInstall.blockOneStart, INSTALL_DAY)));
  const secondLegacyFixtureRestart = await quietAsync(() => relaunchApp({
    storage: localStorageData, todayISO: INSTALL_DAY,
  }));
  const secondLegacyFixtureUpgradeCount = decisionLedgerEntries().filter((entry) =>
    entry.decision.kind === 'legacy_fixture_effect_upgrade' &&
    entry.decision.sourceEntryId === legacyFixtureEntry?.id).length;
  ok('a pre-effect fixture row survives its one compatibility boot',
    legacyFixtureMove.outcome === 'accepted' && firstLegacyFixtureRestart.ok &&
      firstLegacyFixtureSignature === legacyFixtureAfterSignature &&
      firstLegacyFixtureUpgradeCount === 1,
    JSON.stringify({ legacyFixtureMove, firstLegacyFixtureUpgradeCount }));
  ok('the fixture upgrade stays singular on every later boot',
    secondLegacyFixtureRestart.ok && secondLegacyFixtureUpgradeCount === 1 &&
      fixtureSignature(quiet(() => resolvedDays(
        legacyFixtureInstall.blockOneStart, INSTALL_DAY,
      ))) === legacyFixtureAfterSignature);
  const legacyFixtureUndo = await quietAsync(() => undoLastDecision());
  ok('fixture upgrade metadata never becomes the Undo target',
    legacyFixtureUndo.outcome === 'undone' &&
      fixtureSignature(quiet(() => resolvedDays(
        legacyFixtureInstall.blockOneStart, INSTALL_DAY,
      ))) === fixtureSignature(legacyFixtureBefore),
    JSON.stringify({ legacyFixtureUndo, entries: decisionLedgerEntries() }));

  console.log('\n[athlete-edit durability] accepted session Add and Swap survive restart');
  const restartEditWitness = async (
    kind: 'add_category' | 'swap_category',
  ): Promise<{ applied: boolean; changed: boolean; restarted: boolean; exact: boolean; detail: string }> => {
    localStorageData.clear();
    const editInstall = await coldStartThroughOnboarding({
      profile: athlete(), installDayISO: INSTALL_DAY,
    });
    const before = quiet(() => resolvedDays(editInstall.blockOneStart, INSTALL_DAY));
    const target = kind === 'add_category'
      ? before.find((day) => day.rows.length === 0)
      : before.find((day) => day.rows.length > 0);
    if (!target) {
      return {
        applied: false, changed: false, restarted: false, exact: false,
        detail: `${kind}: no reachable target day`,
      };
    }
    const rawWeek = quiet(() => deriveVisibleWeekLive(editInstall.blockOneStart, INSTALL_DAY));
    const result = quiet(() => applyPlanChange({
      change: { kind, date: target.dateISO, category: 'recovery' },
      visibleWeek: rawWeek,
      todayISO: INSTALL_DAY,
      applyOverride: () => undefined,
    }));
    const after = quiet(() => resolvedDays(editInstall.blockOneStart, INSTALL_DAY));
    const afterSignature = visibleSignature(after);
    const restart = await quietAsync(() => relaunchApp({
      storage: localStorageData,
      todayISO: INSTALL_DAY,
    }));
    const restarted = quiet(() => resolvedDays(editInstall.blockOneStart, INSTALL_DAY));
    return {
      applied: result.ok,
      changed: afterSignature !== visibleSignature(before),
      restarted: restart.ok,
      exact: visibleSignature(restarted) === afterSignature,
      detail: JSON.stringify({
        kind, target: target.dateISO, result, before, after, restarted,
      }),
    };
  };
  const addRestart = await restartEditWitness('add_category');
  ok('session Add reaches a non-vacuous accepted state before restart',
    addRestart.applied && addRestart.changed, addRestart.detail);
  ok('session Add survives process death byte-for-byte',
    addRestart.restarted && addRestart.exact, addRestart.detail);
  const swapRestart = await restartEditWitness('swap_category');
  ok('session Swap reaches a non-vacuous accepted state before restart',
    swapRestart.applied && swapRestart.changed, swapRestart.detail);
  ok('session Swap survives process death byte-for-byte',
    swapRestart.restarted && swapRestart.exact, swapRestart.detail);

  console.log('\n[athlete-edit durability] accepted session Remove and Move survive restart and Undo');
  const restartPlacementWitness = async (
    kind: 'remove_session' | 'move_session',
  ): Promise<{
    applied: boolean;
    changed: boolean;
    restarted: boolean;
    exact: boolean;
    undoAvailable: boolean;
    restored: boolean;
    detail: string;
  }> => {
    localStorageData.clear();
    const editInstall = await coldStartThroughOnboarding({
      profile: athlete(), installDayISO: INSTALL_DAY,
    });
    const before = quiet(() => resolvedDays(editInstall.blockOneStart, INSTALL_DAY));
    const source = before.find((day) => day.rows.length > 0);
    const target = before.find((day) => day.rows.length === 0);
    if (!source || (kind === 'move_session' && !target)) {
      return {
        applied: false, changed: false, restarted: false, exact: false,
        undoAvailable: false, restored: false,
        detail: `${kind}: no reachable source or destination`,
      };
    }
    const rawWeek = quiet(() => deriveVisibleWeekLive(editInstall.blockOneStart, INSTALL_DAY));
    const result = quiet(() => applyPlanChange({
      change: kind === 'remove_session'
        ? { kind, date: source.dateISO, scope: 'whole_day' }
        : { kind, fromDate: source.dateISO, toDate: target!.dateISO },
      visibleWeek: rawWeek,
      todayISO: INSTALL_DAY,
      applyOverride: () => undefined,
    }));
    const after = quiet(() => resolvedDays(editInstall.blockOneStart, INSTALL_DAY));
    const beforeSignature = visibleSignature(before);
    const afterSignature = visibleSignature(after);
    const restart = await quietAsync(() => relaunchApp({
      storage: localStorageData,
      todayISO: INSTALL_DAY,
    }));
    const restarted = quiet(() => resolvedDays(editInstall.blockOneStart, INSTALL_DAY));
    const activeAdjustmentCount = useProgramStore.getState()
      .reversibleAdjustmentLedger.adjustments
      .filter((adjustment) => adjustment.status === 'active').length;
    const undo = await quietAsync(() => undoLastDecision());
    const restoredDays = quiet(() => resolvedDays(editInstall.blockOneStart, INSTALL_DAY));
    return {
      applied: result.ok,
      changed: afterSignature !== beforeSignature,
      restarted: restart.ok,
      exact: visibleSignature(restarted) === afterSignature,
      undoAvailable: activeAdjustmentCount > 0 && undo.outcome === 'undone',
      restored: visibleSignature(restoredDays) === beforeSignature,
      detail: JSON.stringify({
        kind, source: source.dateISO, target: target?.dateISO ?? null,
        result, before, after, restarted, activeAdjustmentCount, undo, restoredDays,
      }),
    };
  };
  const removeRestart = await restartPlacementWitness('remove_session');
  ok('session Remove reaches a non-vacuous accepted state before restart',
    removeRestart.applied && removeRestart.changed, removeRestart.detail);
  ok('session Remove survives process death byte-for-byte',
    removeRestart.restarted && removeRestart.exact, removeRestart.detail);
  ok('session Remove still has one working Undo after restart',
    removeRestart.undoAvailable && removeRestart.restored, removeRestart.detail);
  const moveRestart = await restartPlacementWitness('move_session');
  ok('session Move reaches a non-vacuous accepted state before restart',
    moveRestart.applied && moveRestart.changed, moveRestart.detail);
  ok('session Move survives process death byte-for-byte',
    moveRestart.restarted && moveRestart.exact, moveRestart.detail);
  ok('session Move still has one working Undo after restart',
    moveRestart.undoAvailable && moveRestart.restored, moveRestart.detail);

  console.log('\n[athlete-edit migration] a pre-effect session decision upgrades once in place');
  localStorageData.clear();
  const legacyInstall = await coldStartThroughOnboarding({
    profile: athlete(), installDayISO: INSTALL_DAY,
  });
  const legacyBefore = quiet(() => resolvedDays(legacyInstall.blockOneStart, INSTALL_DAY));
  const legacyTarget = legacyBefore.find((day) => day.rows.length > 0);
  const legacyResult = legacyTarget
    ? quiet(() => applyPlanChange({
        change: { kind: 'remove_session', date: legacyTarget.dateISO, scope: 'whole_day' },
        visibleWeek: quiet(() => deriveVisibleWeekLive(
          legacyInstall.blockOneStart, INSTALL_DAY,
        )),
        todayISO: INSTALL_DAY,
        applyOverride: () => undefined,
      }))
    : null;
  const legacyAfterSignature = visibleSignature(quiet(() =>
    resolvedDays(legacyInstall.blockOneStart, INSTALL_DAY)));
  const legacyEntry = decisionLedgerEntries().find((entry) =>
    entry.decision.kind === 'plan_change' &&
    entry.decision.change.kind === 'remove_session' &&
    entry.decision.change.date === legacyTarget?.dateISO);
  await flushPendingStorageWrites();
  const legacyEnvelopeRaw = localStorageData.get(DECISION_LEDGER_PERSISTENCE_KEY) ?? '';
  if (legacyEnvelopeRaw && legacyEntry) {
    const legacyEnvelope = JSON.parse(legacyEnvelopeRaw) as {
      state?: { entries?: Array<{ id?: string; decision?: Record<string, unknown> }> };
    };
    const storedLegacyEntry = legacyEnvelope.state?.entries?.find((entry) =>
      entry.id === legacyEntry.id);
    if (storedLegacyEntry?.decision) delete storedLegacyEntry.decision.acceptedEffect;
    localStorageData.set(DECISION_LEDGER_PERSISTENCE_KEY, JSON.stringify(legacyEnvelope));
  }
  const firstLegacyRestart = await quietAsync(() => relaunchApp({
    storage: localStorageData,
    todayISO: INSTALL_DAY,
  }));
  const firstLegacyRestartSignature = visibleSignature(quiet(() =>
    resolvedDays(legacyInstall.blockOneStart, INSTALL_DAY)));
  const firstUpgradeCount = decisionLedgerEntries().filter((entry) =>
    entry.decision.kind === 'legacy_plan_change_effect_upgrade' &&
    entry.decision.sourceEntryId === legacyEntry?.id).length;
  const secondLegacyRestart = await quietAsync(() => relaunchApp({
    storage: localStorageData,
    todayISO: INSTALL_DAY,
  }));
  const secondLegacyRestartSignature = visibleSignature(quiet(() =>
    resolvedDays(legacyInstall.blockOneStart, INSTALL_DAY)));
  const secondUpgradeCount = decisionLedgerEntries().filter((entry) =>
    entry.decision.kind === 'legacy_plan_change_effect_upgrade' &&
    entry.decision.sourceEntryId === legacyEntry?.id).length;
  ok('a pre-effect session decision survives its one compatibility boot',
    legacyResult?.ok === true && firstLegacyRestart.ok &&
      firstLegacyRestartSignature === legacyAfterSignature && firstUpgradeCount === 1,
    JSON.stringify({ legacyResult, legacyEntry, firstLegacyRestart, firstUpgradeCount }));
  ok('the semantic upgrade preserves the decision on every later canonical boot',
    secondLegacyRestart.ok && secondLegacyRestartSignature === legacyAfterSignature &&
      secondUpgradeCount === 1,
    JSON.stringify({ secondLegacyRestart, secondUpgradeCount }));
  const undoLegacy = await quietAsync(() => undoLastDecision());
  ok('the upgrade is metadata, so Undo still targets and restores the old athlete decision',
    undoLegacy.outcome === 'undone' &&
      visibleSignature(quiet(() => resolvedDays(
        legacyInstall.blockOneStart, INSTALL_DAY,
      ))) === visibleSignature(legacyBefore),
    JSON.stringify({ undoLegacy, entries: decisionLedgerEntries() }));

  console.log('\n[athlete-edit composition] Swap, Add, Move and Remove share one ordered fold');
  localStorageData.clear();
  const composedInstall = await coldStartThroughOnboarding({
    profile: athlete(), installDayISO: INSTALL_DAY,
  });
  const composedBaseline = quiet(() =>
    resolvedDays(composedInstall.blockOneStart, INSTALL_DAY));
  const composedTraining = composedBaseline.filter((day) => day.rows.length > 0);
  const composedEmpty = composedBaseline.filter((day) => day.rows.length === 0);
  const applyCurrentPlanChange = (change: Parameters<typeof applyPlanChange>[0]['change']) =>
    quiet(() => applyPlanChange({
      change,
      visibleWeek: quiet(() => deriveVisibleWeekLive(
        composedInstall.blockOneStart, INSTALL_DAY,
      )),
      todayISO: INSTALL_DAY,
      applyOverride: () => undefined,
    }));
  const composedSwap = composedTraining[0]
    ? applyCurrentPlanChange({
        kind: 'swap_category', date: composedTraining[0].dateISO, category: 'recovery',
      })
    : null;
  const composedAdd = composedEmpty[0]
    ? applyCurrentPlanChange({
        kind: 'add_category', date: composedEmpty[0].dateISO, category: 'primer',
      })
    : null;
  const composedMove = composedTraining[2] && composedEmpty[1]
    ? applyCurrentPlanChange({
        kind: 'move_session',
        fromDate: composedTraining[2].dateISO,
        toDate: composedEmpty[1].dateISO,
      })
    : null;
  const beforeComposedRemove = quiet(() =>
    resolvedDays(composedInstall.blockOneStart, INSTALL_DAY));
  const composedRemove = composedTraining[1]
    ? applyCurrentPlanChange({
        kind: 'remove_session', date: composedTraining[1].dateISO, scope: 'whole_day',
      })
    : null;
  const composedAfter = quiet(() =>
    resolvedDays(composedInstall.blockOneStart, INSTALL_DAY));
  const composedAfterSignature = visibleSignature(composedAfter);
  const composedRestart = await quietAsync(() => relaunchApp({
    storage: localStorageData,
    todayISO: INSTALL_DAY,
  }));
  const composedRestarted = quiet(() =>
    resolvedDays(composedInstall.blockOneStart, INSTALL_DAY));
  ok('all four whole-session actions land in one accumulated athlete world',
    composedSwap?.ok === true && composedAdd?.ok === true &&
      composedMove?.ok === true && composedRemove?.ok === true &&
      composedAfterSignature !== visibleSignature(composedBaseline),
    JSON.stringify({ composedSwap, composedAdd, composedMove, composedRemove }));
  ok('the accumulated Swap, Add, Move and Remove world survives process death exactly',
    composedRestart.ok && visibleSignature(composedRestarted) === composedAfterSignature,
    JSON.stringify({ composedAfter, composedRestarted }));
  const composedUndo = await quietAsync(() => undoLastDecision());
  ok('one Undo after restart removes only the last action from the accumulated fold',
    composedUndo.outcome === 'undone' &&
      visibleSignature(quiet(() => resolvedDays(
        composedInstall.blockOneStart, INSTALL_DAY,
      ))) === visibleSignature(beforeComposedRemove),
    JSON.stringify({ composedUndo, beforeComposedRemove }));

  console.log('\n[exercise-edit durability] Remove, Swap and Add compose across restart');
  localStorageData.clear();
  const exerciseInstall = await coldStartThroughOnboarding({
    profile: athlete(), installDayISO: INSTALL_DAY,
  });
  const exerciseBefore = quiet(() => resolvedDays(exerciseInstall.blockOneStart, INSTALL_DAY));
  const exerciseTarget = exerciseBefore.find((day) => day.rows.length >= 3);
  ok('the exercise-edit witness reaches a real multi-row session',
    Boolean(exerciseTarget), JSON.stringify(exerciseBefore));
  if (exerciseTarget) {
    const initialNames = exerciseTarget.rows.map((row) => row.name);
    const removedName = initialNames[0]!;
    const removed = await quietAsync(() => executeProgramControlActionDurably({
      type: 'remove_exercise',
      source: { screen: 'session_detail', surface: 'compiler_witness', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: { date: exerciseTarget.dateISO, exercise: removedName },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
    }, { todayISO: INSTALL_DAY }));
    const afterRemove = quiet(() =>
      resolvedDays(exerciseInstall.blockOneStart, INSTALL_DAY));
    const targetAfterRemove = afterRemove.find((day) => day.dateISO === exerciseTarget.dateISO);
    const swapName = targetAfterRemove?.rows[0]?.name ?? '';
    const swapEnvironment = quiet(() => resolveTapSwapEnvironment({
      date: exerciseTarget.dateISO,
      profile: athlete(),
      activeConstraints: [],
      readinessSignal: null,
    }));
    const swapChoices = quiet(() => groupTapSwapChoices(getTapSwapChoices({
      originalExercise: swapName,
      reason: 'preference',
      environment: swapEnvironment,
      existingExerciseNames: targetAfterRemove?.rows.map((row) => row.name) ?? [],
    })));
    const replacementName = swapChoices[0]?.choices[0]?.name ?? '';
    const swapped = replacementName
      ? await quietAsync(() => executeProgramControlActionDurably({
          type: 'swap_exercise',
          source: { screen: 'session_detail', surface: 'compiler_witness', initiatedBy: 'tap' },
          scope: 'today_only',
          payload: {
            date: exerciseTarget.dateISO,
            fromExercise: swapName,
            toExercise: { name: replacementName, sets: 3, repsMin: 6, repsMax: 8 },
          },
          requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
        }, { todayISO: INSTALL_DAY }))
      : null;
    const afterSwap = quiet(() =>
      resolvedDays(exerciseInstall.blockOneStart, INSTALL_DAY));
    const targetAfterSwap = afterSwap.find((day) => day.dateISO === exerciseTarget.dateISO);
    const addName = swapChoices.flatMap((group) => group.choices)
      .map((choice) => choice.name)
      .find((name) => name !== replacementName &&
        !targetAfterSwap?.rows.some((row) => row.name === name)) ?? '';
    const added = addName
      ? await quietAsync(() => executeProgramControlActionDurably({
          type: 'add_exercise',
          source: { screen: 'session_detail', surface: 'compiler_witness', initiatedBy: 'tap' },
          scope: 'today_only',
          payload: {
            date: exerciseTarget.dateISO,
            exercise: { name: addName, sets: 2, repsMin: 8, repsMax: 12 },
          },
          requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
        }, { todayISO: INSTALL_DAY }))
      : null;
    const exerciseActed = quiet(() =>
      resolvedDays(exerciseInstall.blockOneStart, INSTALL_DAY));
    const actedTarget = exerciseActed.find((day) => day.dateISO === exerciseTarget.dateISO);
    const actedRawTarget = quiet(() =>
      deriveVisibleWeekLive(exerciseInstall.blockOneStart, INSTALL_DAY))
      .find((day) => day.date === exerciseTarget.dateISO);
    const actedAddedId = actedRawTarget?.workout?.exercises.find((row) =>
      row.exercise?.name === addName)?.id;
    ok('Remove, Swap and Add all land through the production door',
      removed.ok && swapped?.ok === true && added?.ok === true &&
        !actedTarget?.rows.some((row) => row.name === removedName) &&
        actedTarget?.rows.some((row) => row.name === replacementName) &&
        actedTarget?.rows.some((row) => row.name === addName),
      JSON.stringify({ removed, swapped, added, initialNames, actedTarget }));
    const actedExerciseSignature = visibleSignature(exerciseActed);
    const exerciseRestart = await quietAsync(() => relaunchApp({
      storage: localStorageData,
      todayISO: INSTALL_DAY,
    }));
    const exerciseRestarted = quiet(() =>
      resolvedDays(exerciseInstall.blockOneStart, INSTALL_DAY));
    const restartedRawTarget = quiet(() =>
      deriveVisibleWeekLive(exerciseInstall.blockOneStart, INSTALL_DAY))
      .find((day) => day.date === exerciseTarget.dateISO);
    ok('the exercise-edit sequence survives process death byte-for-byte',
      exerciseRestart.ok && visibleSignature(exerciseRestarted) === actedExerciseSignature,
      JSON.stringify({ acted: exerciseActed, restarted: exerciseRestarted }));
    ok('an added exercise keeps the same component identity across process death',
      Boolean(actedAddedId) &&
        restartedRawTarget?.workout?.exercises.find((row) =>
          row.exercise?.name === addName)?.id === actedAddedId,
      JSON.stringify({ actedAddedId, restartedRawTarget }));
  }

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
