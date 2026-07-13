import fs from 'node:fs';
import path from 'node:path';
import type { OnboardingData } from '../../types/domain';
import type { ActiveConstraint } from '../../store/coachUpdatesStore';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingInputs,
  type CoachingPlan,
} from '../../utils/coachingEngine';
import { generateProgramLocally } from '../../services/api/generateProgram';
import {
  evaluateAllocationExposureContract,
  evaluateEffectiveWeekExposureContract,
  evaluateWeeklyExposureContract,
  ledgerFromAllocations,
  type WeeklyExposureContract,
  type WeeklyExposureLedger,
} from '../../rules/weeklyExposureContract';

export interface YearRoundExposureConformanceTotals {
  scenarios: number;
  rules: number;
  properties: number;
  mutations: number;
}

const ALL_DAYS: OnboardingData['preferredTrainingDays'] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ALL_DAYS,
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: 'Hard',
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    motivation: 'Build strength and football fitness',
    ...overrides,
  };
}

function planFor(
  athlete: OnboardingData,
  overrides: Partial<CoachingInputs> = {},
): CoachingPlan {
  const inputs = onboardingToCoachingInputs(athlete, {
    availabilityDateISO: '2026-07-13',
    weekNumber: 2,
    miniCycleNumber: 2,
    weekInBlock: 2,
    weekKind: 'build',
    offseasonSubphase: overrides.offseasonSubphase,
    preseasonSubphase: overrides.preseasonSubphase,
    generationConstraints: overrides.generationConstraints,
    appConditioningFeasible: overrides.appConditioningFeasible ?? true,
  });
  return buildCoachingPlan({ ...inputs, ...overrides });
}

function requireAcceptedAllocation(name: string, plan: CoachingPlan): void {
  if (!plan.weeklyExposureContract) throw new Error(`${name}: missing weekly exposure contract`);
  const result = evaluateAllocationExposureContract(
    plan.weeklyExposureContract,
    plan.weeklyPlan,
  );
  if (!result.accepted) {
    throw new Error(`${name}: ${JSON.stringify(result.unresolvedShortfalls)}`);
  }
}

function requireFinalAccepted(
  name: string,
  contract: WeeklyExposureContract | undefined,
  workouts: Parameters<typeof evaluateEffectiveWeekExposureContract>[1],
  weekStart: string,
): void {
  if (!contract) throw new Error(`${name}: missing final contract`);
  const result = evaluateEffectiveWeekExposureContract(contract, workouts, weekStart);
  if (!result.accepted) throw new Error(`${name}: ${JSON.stringify(result.unresolvedShortfalls)}`);
}

function activeMajorReadinessConstraint(): ActiveConstraint {
  return {
    id: 'bible:major-readiness',
    type: 'fatigue',
    severity: 8,
    status: 'active',
    startDate: '2026-07-13',
    lastUpdatedAt: '2026-07-13T00:00:00.000Z',
    reasonLabel: 'Very cooked',
    source: 'coach',
    rules: ['recovery mode'],
    safeFocus: ['Recovery + mobility'],
    advice: [],
  };
}

function activeHamstringConstraint(): ActiveConstraint {
  return {
    id: 'bible:hamstring-restriction',
    type: 'injury',
    bodyPart: 'hamstring',
    bucket: 'hamstring',
    severity: 7,
    status: 'active',
    startDate: '2026-07-13',
    lastUpdatedAt: '2026-07-13T00:00:00.000Z',
    adjustmentLevel: 'moderate',
    seriousSymptoms: false,
    rules: ['No high-speed running or loaded hinge work'],
    safeFocus: ['Upper body and pain-free recovery work'],
    advice: [],
  };
}

function reducedLedger(
  contract: WeeklyExposureContract,
  ledger: WeeklyExposureLedger,
  domain: 'main_strength' | 'conditioning',
): WeeklyExposureLedger {
  const required = domain === 'main_strength'
    ? contract.strength.required
    : contract.conditioning.required;
  return {
    ...ledger,
    achieved: {
      ...ledger.achieved,
      [domain]: Math.max(0, required - 1),
    },
  };
}

/** Permanent executable coverage for the shared year-round protocol. */
export function runYearRoundExposureConformance(
  repoRoot: string,
): YearRoundExposureConformanceTotals {
  let scenarios = 0;
  let properties = 0;
  let mutations = 0;

  const phasePlans: Array<[string, CoachingPlan, string]> = [
    ['in-season game week', planFor(profile({
      seasonPhase: 'In-season',
      usualGameDay: 'Saturday',
      preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'],
      trainingDaysPerWeek: 5,
      teamTrainingDaysPerWeek: 1,
      teamTrainingDays: ['Monday'],
    }), { weekNumber: 1, weekInBlock: 1 }), 'in_season_game_week'],
    ['in-season bye build', planFor(profile({ seasonPhase: 'In-season' }), {
      hasGame: false, gameDay: undefined, weekNumber: 1, weekInBlock: 1,
    }), 'in_season_bye_build'],
    ['in-season bye recovery', planFor(profile({
      seasonPhase: 'In-season', recentTrainingLoad: 'Hardly at all', conditioningLevel: 'Poor',
    }), { hasGame: false, gameDay: undefined, weekNumber: 4, weekInBlock: 4, weekKind: 'deload' }), 'in_season_bye_recovery'],
    ['early off-season', planFor(profile(), { offseasonSubphase: 'early_offseason', weekNumber: 1, weekInBlock: 1 }), 'early_offseason'],
    ['mid off-season', planFor(profile(), { offseasonSubphase: 'mid_offseason', weekNumber: 2, weekInBlock: 2 }), 'mid_offseason'],
    ['late off-season', planFor(profile({
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
    }), { offseasonSubphase: 'late_offseason', weekNumber: 3, weekInBlock: 3 }), 'late_offseason'],
    ['early pre-season', planFor(profile({ seasonPhase: 'Pre-season' }), { preseasonSubphase: 'early_preseason', weekNumber: 1, weekInBlock: 1 }), 'early_preseason'],
    ['mid pre-season', planFor(profile({ seasonPhase: 'Pre-season' }), { preseasonSubphase: 'mid_preseason', weekNumber: 2, weekInBlock: 2 }), 'mid_preseason'],
    ['late pre-season', planFor(profile({ seasonPhase: 'Pre-season' }), {
      preseasonSubphase: 'late_preseason', weekNumber: 4, weekInBlock: 4, weekKind: 'build',
    }), 'late_preseason'],
    ['late pre-season deload', planFor(profile({ seasonPhase: 'Pre-season' }), {
      preseasonSubphase: 'late_preseason', weekNumber: 4, weekInBlock: 4, weekKind: 'deload',
    }), 'late_preseason'],
  ];
  for (const [name, plan, mode] of phasePlans) {
    requireAcceptedAllocation(name, plan);
    if (plan.weeklyExposureContract?.identity.mode !== mode) {
      throw new Error(`${name}: expected mode ${mode}, got ${plan.weeklyExposureContract?.identity.mode}`);
    }
    scenarios++;
  }

  // Corrected policy: healthy no-anchor early/mid/late pre-season all own
  // and finish the same 4 strength / 4 conditioning / 1 sprint frequency.
  for (const name of ['early pre-season', 'mid pre-season', 'late pre-season']) {
    const plan = phasePlans.find(([candidate]) => candidate === name)?.[1];
    if (!plan?.weeklyExposureContract) throw new Error(`${name}: missing corrected contract`);
    const validation = evaluateAllocationExposureContract(plan.weeklyExposureContract, plan.weeklyPlan);
    const contract = plan.weeklyExposureContract;
    if (
      contract.strength.targetCount !== 4 ||
      contract.conditioning.targetCount !== 4 ||
      contract.sprintCod.targetCount !== 1
    ) throw new Error(`${name}: expected corrected 4/4/1 contract`);
    if (
      validation.ledger.achieved.main_strength !== 4 ||
      validation.ledger.achieved.conditioning !== 4 ||
      validation.ledger.achieved.sprint_cod < 1
    ) throw new Error(`${name}: final allocation did not finish 4/4/1`);
    if (contract.reductions.some((entry) => entry.metric === 'weekly_exposure_count')) {
      throw new Error(`${name}: healthy normal availability received an unauthorised frequency reduction`);
    }
    scenarios++;
  }

  const preSeasonWithTeam = planFor(profile({
    seasonPhase: 'Pre-season',
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
  }), { preseasonSubphase: 'early_preseason', weekNumber: 1, weekInBlock: 1 });
  requireAcceptedAllocation('pre-season with team anchors', preSeasonWithTeam);
  const preTeamContract = preSeasonWithTeam.weeklyExposureContract!;
  const preTeamLedger = evaluateAllocationExposureContract(
    preTeamContract,
    preSeasonWithTeam.weeklyPlan,
  ).ledger;
  if (
    preTeamContract.conditioning.targetCount !== 4 ||
    preTeamContract.conditioning.creditedTeamTrainingCount !== 2 ||
    preTeamContract.conditioning.additionalRequiredCount !== 2 ||
    preTeamLedger.achieved.conditioning !== 4 ||
    preTeamContract.sprintCod.targetCount !== 1 ||
    preTeamContract.sprintCod.additionalRequiredCount !== 0 ||
    preTeamLedger.additionalSprintCodCount !== 0
  ) throw new Error('pre-season anchor credit changed the total target or added unnecessary app sprint');
  scenarios++;

  const earlyOff = phasePlans.find(([name]) => name === 'early off-season')![1];
  const midOff = phasePlans.find(([name]) => name === 'mid off-season')![1];
  const lateOff = phasePlans.find(([name]) => name === 'late off-season')![1];
  for (const [name, plan, expected] of [
    ['early off-season', earlyOff, 0],
    ['mid off-season', midOff, 1],
    ['late off-season', lateOff, 1],
  ] as const) {
    const validation = evaluateAllocationExposureContract(plan.weeklyExposureContract!, plan.weeklyPlan);
    if (plan.weeklyExposureContract!.sprintCod.targetCount !== expected) {
      throw new Error(`${name}: incorrect sprint floor`);
    }
    if (expected === 0 ? validation.ledger.achieved.sprint_cod !== 0 : validation.ledger.achieved.sprint_cod < 1) {
      throw new Error(`${name}: final sprint allocation did not match its floor`);
    }
    scenarios++;
  }

  const constrainedMidOff = planFor(profile({
    trainingDaysPerWeek: 2,
    preferredTrainingDays: ['Monday', 'Tuesday'],
  }), { offseasonSubphase: 'mid_offseason', weekNumber: 2, weekInBlock: 2 });
  requireAcceptedAllocation('two-day mid off-season', constrainedMidOff);
  const constrainedMidOffResult = evaluateAllocationExposureContract(
    constrainedMidOff.weeklyExposureContract!,
    constrainedMidOff.weeklyPlan,
  );
  if (
    constrainedMidOff.weeklyExposureContract!.sprintCod.targetCount !== 1 ||
    constrainedMidOffResult.ledger.achieved.sprint_cod < 1 ||
    !constrainedMidOff.weeklyPlan.some((session) => session.speedBlock?.placement === 'pre_lift')
  ) throw new Error('two-day mid off-season did not consolidate its sprint floor onto an existing session');
  scenarios++;

  const gameWeek = phasePlans.find(([name]) => name === 'in-season game week')![1];
  const byeBuild = phasePlans.find(([name]) => name === 'in-season bye build')![1];
  const byeRecovery = phasePlans.find(([name]) => name === 'in-season bye recovery')![1];
  const gameSprint = evaluateAllocationExposureContract(gameWeek.weeklyExposureContract!, gameWeek.weeklyPlan).ledger;
  if (
    gameWeek.weeklyExposureContract!.sprintCod.targetCount !== 1 ||
    gameWeek.weeklyExposureContract!.sprintCod.additionalRequiredCount !== 0 ||
    gameSprint.additionalSprintCodCount !== 0 ||
    gameSprint.achieved.sprint_cod < 1
  ) throw new Error('in-season game/team anchor did not satisfy the one-exposure floor cleanly');
  const byeBuildSprint = evaluateAllocationExposureContract(
    byeBuild.weeklyExposureContract!,
    byeBuild.weeklyPlan,
  ).ledger;
  if (
    byeBuild.weeklyExposureContract!.sprintCod.targetCount !== 1 ||
    byeBuild.weeklyExposureContract!.sprintCod.additionalRequiredCount !== 1 ||
    byeBuildSprint.additionalSprintCodCount < 1
  ) throw new Error('in-season no-anchor bye build omitted its app sprint exposure');
  if (!byeRecovery.weeklyExposureContract!.reductions.some((entry) =>
    entry.domain === 'sprint_cod' && entry.reason === 'bye_recovery_mode' &&
    entry.metric === 'weekly_exposure_count' && entry.from === 1 && entry.to === 0
  )) throw new Error('bye recovery mode omitted its explicit sprint reduction');
  const deload = phasePlans.find(([name]) => name === 'late pre-season deload')![1];
  const deloadSprint = evaluateAllocationExposureContract(
    deload.weeklyExposureContract!,
    deload.weeklyPlan,
  ).ledger;
  if (
    deload.weeklyExposureContract!.sprintCod.targetCount !== 1 ||
    deloadSprint.achieved.sprint_cod < 1 ||
    deload.weeklyExposureContract!.reductions.some((entry) =>
      entry.domain === 'sprint_cod' && entry.reason === 'deload_policy' &&
      entry.metric === 'weekly_exposure_count')
  ) throw new Error('deload deleted the sprint floor instead of preserving reduced-dose exposure');
  scenarios += 4;

  // Fixed reproduction: the previous warning-only in-season placement now
  // has one additional conditioning exposure or an explicit reduction.
  const inSeason = phasePlans[0][1];
  const inSeasonValidation = evaluateAllocationExposureContract(
    inSeason.weeklyExposureContract!,
    inSeason.weeklyPlan,
  );
  if (
    inSeasonValidation.ledger.achieved.conditioning <
      inSeason.weeklyExposureContract!.conditioning.required
  ) throw new Error('fixed in-season placement accepted a conditioning shortfall');
  scenarios++;

  // Fixed reproduction: identical early-off-season availability counts cannot
  // produce geometry-dependent conditioning totals.
  const earlyGeometryA = planFor(profile({
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
  }), { offseasonSubphase: 'early_offseason', weekNumber: 1, weekInBlock: 1 });
  const earlyGeometryB = planFor(profile({
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  }), { offseasonSubphase: 'early_offseason', weekNumber: 1, weekInBlock: 1 });
  const earlyA = evaluateAllocationExposureContract(earlyGeometryA.weeklyExposureContract!, earlyGeometryA.weeklyPlan);
  const earlyB = evaluateAllocationExposureContract(earlyGeometryB.weeklyExposureContract!, earlyGeometryB.weeklyPlan);
  if (earlyA.ledger.achieved.conditioning !== earlyB.ledger.achieved.conditioning) {
    throw new Error(`early off-season geometry mismatch: ${earlyA.ledger.achieved.conditioning}/${earlyB.ledger.achieved.conditioning}`);
  }
  scenarios++;

  // Fixed reproduction: the constrained late-off-season week is accepted
  // from its canonical effective workouts, not only its allocation rows.
  const constrainedLateBlock = generateProgramLocally(profile({
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
  }), { todayISO: '2026-07-13' });
  const constrainedLateWeek = constrainedLateBlock.microcycles.find(
    (week) => week.exposureContract?.identity.mode === 'late_offseason',
  );
  if (!constrainedLateWeek) throw new Error('constrained late off-season final week missing');
  requireFinalAccepted(
    'constrained late off-season final week',
    constrainedLateWeek.exposureContract,
    constrainedLateWeek.workouts,
    constrainedLateWeek.startDate.slice(0, 10),
  );
  scenarios++;

  // Fixed reproduction: major readiness may produce zero final strength, but
  // the target must say so with a typed low-readiness reason.
  const major = generateProgramLocally(profile({ seasonPhase: 'Off-season' }), {
    todayISO: '2026-07-13',
    activeConstraints: [activeMajorReadinessConstraint()],
  });
  const majorWeek = major.microcycles[0];
  requireFinalAccepted('major readiness final week', majorWeek.exposureContract, majorWeek.workouts, '2026-07-13');
  if (!majorWeek.exposureContract?.reductions.some((entry) => entry.reason === 'low_readiness')) {
    throw new Error('major readiness final week omitted its typed reduction');
  }
  scenarios++;

  const injured = generateProgramLocally(profile({ seasonPhase: 'Off-season' }), {
    todayISO: '2026-07-13',
    activeConstraints: [activeHamstringConstraint()],
  });
  for (const week of injured.microcycles) {
    requireFinalAccepted(
      'injury-restricted final week',
      week.exposureContract,
      week.workouts,
      week.startDate.slice(0, 10),
    );
  }
  if (!injured.microcycles.some((week) =>
    week.exposureContract?.reductions.some((entry) => entry.reason === 'injury_restriction')
  )) throw new Error('injury-restricted block omitted its typed reduction');
  scenarios++;

  // Fixed reproduction: equipment feasibility is an input to the contract,
  // not a post-pass surprise.
  const noCardio = generateProgramLocally(profile({
    seasonPhase: 'Pre-season',
    trainingLocation: 'Outdoor',
    equipment: ['Bodyweight Only'],
    equipmentSelectionCompleteness: 'complete',
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
  }), { todayISO: '2026-07-13' });
  for (const week of noCardio.microcycles) {
    requireFinalAccepted('equipment-restricted pre-season', week.exposureContract, week.workouts, week.startDate.slice(0, 10));
    if (!week.exposureContract?.reductions.some((entry) => entry.reason === 'equipment_infeasibility')) {
      throw new Error('equipment-restricted week omitted equipment_infeasibility');
    }
  }
  scenarios++;

  // Fixed reproduction: no-anchor mid-pre-season owns and places the shared
  // one-exposure sprint floor through the contract.
  const midPre = phasePlans.find(([name]) => name === 'mid pre-season')![1];
  const midPreValidation = evaluateAllocationExposureContract(midPre.weeklyExposureContract!, midPre.weeklyPlan);
  if (
    midPre.weeklyExposureContract!.sprintCod.targetCount !== 1 ||
    midPreValidation.ledger.achieved.sprint_cod < 1
  ) {
    throw new Error('mid pre-season no-anchor week did not place the sprint/COD floor');
  }
  scenarios++;

  // Week 1 edge-normalised output and Weeks 2-4 deterministic construction
  // all pass the identical final validator (phase subphases may own different targets).
  const block = generateProgramLocally(profile({ seasonPhase: 'Pre-season' }), {
    todayISO: '2026-07-13',
  });
  for (const week of block.microcycles) {
    requireFinalAccepted(`generated week ${week.weekNumber}`, week.exposureContract, week.workouts, week.startDate.slice(0, 10));
  }
  scenarios++;

  const propertyContract = phasePlans.find(([name]) => name === 'mid off-season')![1]
    .weeklyExposureContract!;
  for (let optionalRecoveryCount = 0; optionalRecoveryCount < 8; optionalRecoveryCount++) {
    const filler = Array.from({ length: optionalRecoveryCount }, (_, index) => ({
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index % 7],
      tier: index % 2 === 0 ? 'optional' : 'recovery',
      isHardExposure: false,
      stressLevel: 'low' as const,
    }));
    const ledger = ledgerFromAllocations(propertyContract, filler);
    if (evaluateWeeklyExposureContract(propertyContract, ledger).accepted) {
      throw new Error('optional/recovery filler displaced unresolved required exposure');
    }
    properties++;
  }

  // Mutation acceptance: decrementing either required ledger domain must be
  // killed by the validator; it cannot be converted back to warning-only.
  const validPlan = phasePlans.find(([name]) => name === 'mid off-season')![1];
  const validLedger = ledgerFromAllocations(propertyContract, validPlan.weeklyPlan);
  for (const domain of ['main_strength', 'conditioning'] as const) {
    const mutation = evaluateWeeklyExposureContract(
      propertyContract,
      reducedLedger(propertyContract, validLedger, domain),
    );
    if (mutation.accepted || !mutation.unresolvedShortfalls.some(
      (entry) => entry.code === 'required_exposure_shortfall' && entry.domain === domain,
    )) throw new Error(`required-shortfall mutation survived for ${domain}`);
    mutations++;
  }
  const engineSource = fs.readFileSync(path.join(repoRoot, 'src', 'utils', 'coachingEngine.ts'), 'utf8');
  if (engineSource.includes("logger.warn(\n      '[engine] In-season conditioning floor: zero exposures placed")) {
    throw new Error('warning-only in-season acceptance branch was restored');
  }
  mutations++;

  return { scenarios, rules: 12, properties, mutations };
}
