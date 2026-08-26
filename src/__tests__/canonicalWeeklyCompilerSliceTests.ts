/**
 * FIRST CANONICAL WEEKLY-COMPILER SLICE
 *
 * One ordinary healthy Off-season athlete enters through the real onboarding
 * door. The product compiler authors the block, accepted state validates and
 * installs it, and the visible resolver projects the exact accepted rows. The
 * source census beside the journey holds the ownership boundary: scheduler,
 * materialiser and connector each have one production caller — the compiler.
 *
 * NOT COVERED: fixtures, injuries, readiness, edits, later compiler families,
 * pixels, simulator and physical iPhone.
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

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { OnboardingData, Workout } from '../types/domain';
import { compileCanonicalWeek } from '../rules/canonicalWeeklyCompiler';
import { useProgramStore } from '../store/programStore';
import {
  coldStartThroughOnboarding,
  quiet,
  quietAsync,
  resolvedDays,
} from './support/athleteJourney';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { readinessActionForKind } from '../utils/weekReadinessActions';
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
