import { isHardMetabolicConditioningCategory } from '../rules/conditioningDemand';
/**
 * THE WEEKLY SCHEDULER + CONTRACT, GUARDED BEHAVIOURALLY.
 *
 *   npm run test:weekly-scheduler
 *
 * **THE REGISTRY IS WALKED, NOT RETYPED.** Every cell declares which contract
 * clause ids it exercises; the final block asserts that the set of guarded ids
 * EQUALS `WEEKLY_CONTRACT_CLAUSES`. **A clause added to the contract without a
 * guard reds this suite, and a guard naming an id the contract does not have reds
 * it too.** The mission forbade a hand-written duplicate row list and this is why:
 * a second list is a second authority that drifts silently.
 *
 * **EVERY CELL RUNS THE SCHEDULER.** Source-text presence checks are explicitly
 * insufficient here, and this repo has shipped 116 green cells that asserted which
 * function was called while the defect sat in an argument. Each cell below builds
 * inputs, schedules a week, and reads the dated output.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  BASE_LAYOUTS,
  CONTRACT_SOURCE,
  DEFAULT_SET_BUDGET,
  FOURTH_SESSION_AGE_CEILING,
  GLOBAL_RULES,
  INSEASON_OVERLAY,
  OFFSEASON_OVERLAYS,
  AUTOMATIC_WEEKLY_MAIN_SEAT_ALLOWANCE,
  PATTERN_PLANE,
  PATTERNS_FOR_PURPOSE,
  PRESEASON_OVERLAY,
  PURPOSE_IS_LOWER,
  REQUIRED_PATTERNS,
  WEEKLY_CONTRACT_CLAUSES,
  baseLayoutFor,
  inSeasonUsesFourSessions,
  slotCountsTowardSetBudget,
  type ContractPhase,
  type SessionPurpose,
} from '../rules/weeklyProgrammingContract';
import { materialiseAuthoredSessions } from '../rules/materialiseAuthoredSessions';
import type { OnboardingData } from '../types/domain';
import { resolveProfileTargetWeekAvailability } from '../rules/fixtureConditionedAvailability';
import { ownSeasonPhaseForGeneration } from '../rules/seasonPhaseOwner';
import { weeklySchedulerInputsFrom } from '../rules/weeklySchedulerInputs';
import {
  canonicalFixtureStateFrom,
  schedulerInputsWithFixtureState,
} from '../rules/canonicalWeeklyFixtureState';
import {
  scheduleRefused,
  scheduleWeek,
  type WeeklySchedule,
  type WeeklySchedulerInputs,
} from '../rules/weeklyScheduler';
import { poolForCategoryPublic } from '../rules/conditioningSelection';
import {
  isGeneratedConditioningDay,
  isRunningSpeedDay,
  summarizeWeeklyEnergySystemAudit,
} from '../rules/energySystemExposureEvidence';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
/** Every clause id any cell claims to exercise. Compared to the registry below. */
const guardedClauseIds = new Set<string>();

function ok(name: string, clauses: readonly string[], condition: unknown, detail?: string): void {
  for (const id of clauses) guardedClauseIds.add(id);
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const MON = 1; const TUE = 2; const WED = 3; const THU = 4;
const FRI = 5; const SAT = 6; const SUN = 0;
const WEEK_START = '2026-07-13';   // a Monday

function inputs(over: Partial<WeeklySchedulerInputs> = {}): WeeklySchedulerInputs {
  return {
    weekStartISO: WEEK_START,
    phase: 'In-season',
    offseasonBlock: null,
    gymAccessDays: [MON, WED],
    clubNights: [],
    gameDay: null,
  fixtureRecurrence: 'recurring',
    age: 30,
    readiness: {
      lowReadiness: false, highReadiness: false,
      lowFatigue: false, consistentlyCompletesThree: false,
    },
    unavailableDays: [],
    ...over,
  };
}

function built(over: Partial<WeeklySchedulerInputs> = {}): WeeklySchedule {
  const result = scheduleWeek(inputs(over));
  if (scheduleRefused(result)) {
    throw new Error(`expected a schedule, got refusal ${result.finding}: ${result.detail}`);
  }
  return result;
}

const strengthDays = (week: WeeklySchedule) =>
  week.days.filter((d) => d.owner === 'strength');
const purposesOf = (week: WeeklySchedule): SessionPurpose[] =>
  strengthDays(week).map((d) => d.purpose as SessionPurpose);
const composedOptionalKinds = (week: WeeklySchedule): string[] => week.days
  .flatMap((day) => day.composedOptional ? [day.composedOptional] : []);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[source] The contract is pinned to the document Sam approved');
// ═══════════════════════════════════════════════════════════════════════════
{
  ok('the contract names its source document and approval', [],
    CONTRACT_SOURCE.path.endsWith('WEEKLY_PROGRAMMING_SOURCE_REVIEW_2026-08-14.md')
    && CONTRACT_SOURCE.sha256.length === 64
    && CONTRACT_SOURCE.approvedBy.includes('okay i approve it'),
    JSON.stringify(CONTRACT_SOURCE));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[matrix] Every phase x gym-availability case, 2 through 6');
// ═══════════════════════════════════════════════════════════════════════════
{
  const ACCESS: Record<number, number[]> = {
    2: [MON, WED],
    3: [MON, WED, FRI],
    4: [MON, TUE, THU, FRI],
    5: [MON, TUE, WED, THU, FRI],
    6: [MON, TUE, WED, THU, FRI, SAT],
  };
  // Expected REQUIRED session counts, straight off the contract's §6 table.
  const EXPECTED: Record<ContractPhase, Record<number, number>> = {
    'In-season': { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3 },     // age 30, selector not met
    'Pre-season': { 2: 2, 3: 3, 4: 4, 5: 4, 6: 4 },
    'Off-season': { 2: 2, 3: 3, 4: 4, 5: 4, 6: 4 },
  };
  for (const phase of ['In-season', 'Pre-season', 'Off-season'] as ContractPhase[]) {
    for (const dayCount of [2, 3, 4, 5, 6]) {
      const week = built({
        phase,
        offseasonBlock: phase === 'Off-season' ? 'normal_build' : null,
        gymAccessDays: ACCESS[dayCount],
      });
      const expected = EXPECTED[phase][dayCount];
      ok(`[${phase}/${dayCount}d] requires ${expected} strength session(s)`,
        ['WC-142', week.layoutClauseId],
        week.requiredStrengthSessions === expected
        && strengthDays(week).length === expected,
        `got ${week.requiredStrengthSessions} (${week.layoutClauseId}), `
        + `days=${JSON.stringify(purposesOf(week))}`);
    }
  }
  // ⚠ THE QUOTA RULE, ASSERTED AS ITS OWN PROPERTY. §6: "Six available days never
  // means six required strength sessions."
  for (const phase of ['In-season', 'Pre-season', 'Off-season'] as ContractPhase[]) {
    const four = built({ phase, offseasonBlock: 'normal_build', gymAccessDays: ACCESS[4] });
    const six = built({ phase, offseasonBlock: 'normal_build', gymAccessDays: ACCESS[6] });
    ok(`[${phase}] 5-6 gym days never create a fifth required session`,
      ['WC-063'],
      six.requiredStrengthSessions === four.requiredStrengthSessions
      && six.requiredStrengthSessions <= 4,
      `4d=${four.requiredStrengthSessions} 6d=${six.requiredStrengthSessions}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[layouts] The approved purposes, per layout row');
// ═══════════════════════════════════════════════════════════════════════════
{
  const inSeason3 = built({ phase: 'In-season', gymAccessDays: [MON, WED, FRI] });
  ok('[WC-101] In-season 3 = Lower + Upper Pull + Upper Push',
    ['WC-101'],
    new Set(purposesOf(inSeason3)).size === 3
    && purposesOf(inSeason3).includes('lower')
    && purposesOf(inSeason3).includes('upper_pull')
    && purposesOf(inSeason3).includes('upper_push'),
    JSON.stringify(purposesOf(inSeason3)));

  const inSeason2 = built({ phase: 'In-season', gymAccessDays: [MON, WED] });
  ok('[WC-100] In-season 2 = Full Body x2', ['WC-100'],
    purposesOf(inSeason2).every((p) => p === 'full_body')
    && purposesOf(inSeason2).length === 2, JSON.stringify(purposesOf(inSeason2)));

  const pre3NoWeekend = built({ phase: 'Pre-season', gymAccessDays: [MON, WED, FRI] });
  ok('[R-390] Pre-season three available gym days use full body regardless of weekend access',
    ['WC-111'], purposesOf(pre3NoWeekend).length===3
    && purposesOf(pre3NoWeekend).every(p=>p==='full_body'),
    JSON.stringify(purposesOf(pre3NoWeekend)));

  const pre3Weekend = built({ phase: 'Pre-season', gymAccessDays: [MON, WED, SAT] });
  ok('[WC-112] Pre-season 3, weekend AVAILABLE = Full Body x3', ['WC-112'],
    purposesOf(pre3Weekend).length === 3
    && purposesOf(pre3Weekend).every((p) => p === 'full_body'),
    JSON.stringify(purposesOf(pre3Weekend)));

  const pre4 = built({ phase: 'Pre-season', gymAccessDays: [MON, TUE, THU, FRI] });
  ok('[WC-113] Pre-season 4 = Upper x2 + Lower x2', ['WC-113'],
    purposesOf(pre4).filter((p) => PURPOSE_IS_LOWER[p]).length === 2
    && purposesOf(pre4).filter((p) => !PURPOSE_IS_LOWER[p]).length === 2,
    JSON.stringify(purposesOf(pre4)));

  const off3 = built({ phase: 'Off-season', offseasonBlock: 'normal_build',
    gymAccessDays: [MON, WED, FRI] });
  ok('[WC-121] Off-season 3 = Lower + Upper + Full Body', ['WC-121', 'WC-120', 'WC-122'],
    new Set(purposesOf(off3)).size === 3 && purposesOf(off3).includes('full_body'),
    JSON.stringify(purposesOf(off3)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[selector] The in-season fourth session');
// ═══════════════════════════════════════════════════════════════════════════
{
  const FOUR = [MON, TUE, THU, FRI];
  const young = built({ gymAccessDays: FOUR, age: 25 });
  ok('[WC-141] age 25 with four gym days gets FOUR sessions', ['WC-141', 'WC-103'],
    young.requiredStrengthSessions === 4, JSON.stringify(purposesOf(young)));

  const ceiling = built({ gymAccessDays: FOUR, age: FOURTH_SESSION_AGE_CEILING });
  ok('[WC-140] the age ceiling 27 is INCLUSIVE', ['WC-140'],
    ceiling.requiredStrengthSessions === 4, `age 27 -> ${ceiling.requiredStrengthSessions}`);

  const older = built({ gymAccessDays: FOUR, age: 28 });
  ok('[WC-102] age 28 without the earned arm stays on THREE', ['WC-102'],
    older.requiredStrengthSessions === 3, JSON.stringify(purposesOf(older)));

  // R-349 (Sam, 2026-09-02, "2b"): a readiness DELOAD keeps the sessions the
  // athlete has and halves the sets; the low-readiness veto is about earning.
  const deloadedKeeps = built({ gymAccessDays: FOUR, age: 25,
    readiness: { lowReadiness: true, highReadiness: false, lowFatigue: false,
      consistentlyCompletesThree: false, deloadKeepsSessions: true } });
  ok('[R-349] a readiness deload keeps the four-session in-season week', ['WC-141'],
    deloadedKeeps.requiredStrengthSessions === 4, JSON.stringify(purposesOf(deloadedKeeps)));
  const deloadedVetoed = built({ gymAccessDays: FOUR, age: 25,
    readiness: { lowReadiness: true, highReadiness: false, lowFatigue: false,
      consistentlyCompletesThree: false } });
  ok('[WC-141] without the deload flag low readiness still vetoes the fourth session', ['WC-141'],
    deloadedVetoed.requiredStrengthSessions === 3, JSON.stringify(purposesOf(deloadedVetoed)));

  const earned = built({ gymAccessDays: FOUR, age: 34,
    readiness: { lowReadiness: false, highReadiness: true, lowFatigue: true,
      consistentlyCompletesThree: true } });
  ok('[WC-141] age 34 EARNS four on consistency + high readiness + low fatigue',
    ['WC-141'], earned.requiredStrengthSessions === 4,
    `${earned.requiredStrengthSessions}`);

  // ⚠ THE SECOND ARM IS A CONJUNCTION. Reading it as an OR would hand a fourth
  // session to a fatigued 34-year-old.
  const partial = built({ gymAccessDays: FOUR, age: 34,
    readiness: { lowReadiness: false, highReadiness: true, lowFatigue: false,
      consistentlyCompletesThree: true } });
  ok('[WC-141] ...and NOT on two of the three — high readiness but fatigued',
    ['WC-141'], partial.requiredStrengthSessions === 3,
    `${partial.requiredStrengthSessions}`);

  // ⚠ LOW READINESS IS AN ABSOLUTE VETO — it overrides the AGE arm too.
  const youngButFlat = built({ gymAccessDays: FOUR, age: 22,
    readiness: { lowReadiness: true, highReadiness: false, lowFatigue: false,
      consistentlyCompletesThree: true } });
  ok('[WC-141] LOW READINESS NEVER ADDS WORK — a 22-year-old stays on three',
    ['WC-141'], youngButFlat.requiredStrengthSessions === 3,
    `${youngButFlat.requiredStrengthSessions}`);

  ok('[WC-141] the selector is false below four gym days regardless of age',
    ['WC-141'],
    !inSeasonUsesFourSessions({ gymDayCount: 3, age: 20, consistentlyCompletesThree: true,
      highReadiness: true, lowFatigue: true, lowReadiness: false }));

  // R-342 killed WC-031's 10-set exception: the split lower days are ordinary.
  ok('[R-342] the split Lower Squat/Hinge sessions use the ordinary 12-15 set budget',
    ['WC-030'],
    strengthDays(young).filter((d) => PURPOSE_IS_LOWER[d.purpose as SessionPurpose])
      .every((d) => d.setBudget?.hardCeiling === DEFAULT_SET_BUDGET.hardCeiling
        && d.setBudget?.preferredMin === DEFAULT_SET_BUDGET.preferredMin
        && d.setBudget?.preferredMax === DEFAULT_SET_BUDGET.preferredMax),
    JSON.stringify(strengthDays(young).map((d) => [d.purpose, d.setBudget])));

  ok('[R-342] the loaded lower accessory counts toward the set budget; robustness and core do not',
    ['WC-030'],
    slotCountsTowardSetBudget('loaded_lower_accessory')
      && !slotCountsTowardSetBudget('lower_accessory')
      && !slotCountsTowardSetBudget('football_robustness')
      && !slotCountsTowardSetBudget('core'));

  ok('[WC-030] every other session prefers 12-15 with a hard ceiling of 16',
    ['WC-030'],
    DEFAULT_SET_BUDGET.preferredMin === 12 && DEFAULT_SET_BUDGET.preferredMax === 15
    && DEFAULT_SET_BUDGET.hardCeiling === 16
    && strengthDays(older).every((d) => d.setBudget?.hardCeiling === 16),
    JSON.stringify(strengthDays(older).map((d) => d.setBudget)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[spacing] Lower spacing, planes, hard days and rest');
// ═══════════════════════════════════════════════════════════════════════════
{
  const lowerConsecutive = (week: WeeklySchedule): boolean => {
    const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
    const lower = strengthDays(week)
      .filter((d) => PURPOSE_IS_LOWER[d.purpose as SessionPurpose])
      .map((d) => order.indexOf(d.dayOfWeek)).sort((a, b) => a - b);
    return lower.some((v, i) => i > 0 && v - lower[i - 1] === 1);
  };
  const planeRepeat = (week: WeeklySchedule): boolean => {
    const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
    const days = strengthDays(week)
      .map((d) => ({ i: order.indexOf(d.dayOfWeek), p: d.purpose as SessionPurpose }))
      .sort((a, b) => a.i - b.i);
    for (let k = 1; k < days.length; k += 1) {
      if (days[k].i - days[k - 1].i !== 1) continue;
      const prev = new Set(PATTERNS_FOR_PURPOSE[days[k - 1].p].map((x) => PATTERN_PLANE[x]));
      if (PATTERNS_FOR_PURPOSE[days[k].p].some((x) => prev.has(PATTERN_PLANE[x]))) return true;
    }
    return false;
  };

  // Swept across every world the matrix builds — one violation anywhere reds.
  const worlds: WeeklySchedulerInputs[] = [];
  for (const phase of ['In-season', 'Pre-season', 'Off-season'] as ContractPhase[]) {
    for (const access of [[MON, WED], [MON, WED, FRI], [MON, TUE, THU, FRI],
      [MON, TUE, WED, THU, FRI], [MON, TUE, WED, THU, FRI, SAT]]) {
      for (const club of [[], [TUE, THU], [WED, FRI]]) {
        for (const game of [null, SAT, SUN]) {
          worlds.push(inputs({
            phase, offseasonBlock: phase === 'Off-season' ? 'normal_build' : null,
            gymAccessDays: access, clubNights: club, gameDay: game, age: 24,
          }));
        }
      }
    }
  }
  const schedules = worlds.map((w) => scheduleWeek(w))
    .filter((r): r is WeeklySchedule => !scheduleRefused(r));
  ok('[non-vacuity] the spacing sweep actually built weeks', [],
    schedules.length >= 100, `${schedules.length} of ${worlds.length} built`);
  ok('[WC-043] lower sessions are NEVER on consecutive days, in any swept world',
    ['WC-043', 'WC-024'],
    schedules.every((w) => !lowerConsecutive(w)),
    `${schedules.filter(lowerConsecutive).length} violating weeks`);
  ok('[WC-022] the same movement plane never repeats on consecutive days',
    ['WC-022', 'WC-023'],
    schedules.every((w) => !planeRepeat(w)),
    `${schedules.filter(planeRepeat).length} violating weeks`);

  // WC-041 — five consecutive hard days only when followed by two full rest days.
  const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
  const worstRun = (week: WeeklySchedule, world: WeeklySchedulerInputs): number => {
    const hard = new Set<number>([...strengthDays(week).map((d) => d.dayOfWeek),
      ...world.clubNights, ...(world.gameDay !== null ? [world.gameDay] : [])]);
    let run = 0; let longest = 0;
    for (const d of order) { run = hard.has(d) ? run + 1 : 0; longest = Math.max(longest, run); }
    return longest;
  };
  const fiveRunsAreLegal = worlds.every((world) => {
    const result = scheduleWeek(world);
    if (scheduleRefused(result)) return true;
    const run = worstRun(result, world);
    if (run < 5) return true;
    const hard = new Set<number>([...strengthDays(result).map((d) => d.dayOfWeek),
      ...world.clubNights, ...(world.gameDay !== null ? [world.gameDay] : [])]);
    return order.filter((d) => !hard.has(d)).length >= 2;
  });
  ok('[WC-041] a five-day hard run only ever appears with two full rest days left',
    ['WC-041', 'WC-040'], fiveRunsAreLegal);
  ok('[WC-042] the contract never programs six hard days', ['WC-042'],
    worlds.every((world) => {
      const r = scheduleWeek(world);
      if (scheduleRefused(r)) return true;
      return worstRun(r, world) <= GLOBAL_RULES.hardDays.permittedMaximum;
    }));
}

// R-303: every exact two-through-six-day availability answer, crossed with
// ordinary/deload weeks and representative zero/one/two club-night facts. The
// instrument counts accepted schedules, app-programmed energy-system DAYS and
// distinct violating schedule-input coordinates; it does not count rows.
{
  const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
  const availabilityPatterns = Array.from({ length: 1 << order.length }, (_, mask) =>
    order.filter((_, index) => (mask & (1 << index)) !== 0))
    .filter((days) => days.length >= 2 && days.length <= 6);
  const coordinates = availabilityPatterns.flatMap((gymAccessDays) =>
    ([
      { clubNights: [] as number[], weekKind: 'build' as const },
      { clubNights: [TUE] as number[], weekKind: 'build' as const },
      { clubNights: [TUE, THU] as number[], weekKind: 'build' as const },
      { clubNights: [] as number[], weekKind: 'deload' as const },
    ]).map((variant) => inputs({
      phase: 'Off-season', offseasonBlock: 'normal_build', gymAccessDays,
      clubNights: variant.clubNights, gameDay: null, weekKind: variant.weekKind,
    })));
  const accepted = coordinates.map((coordinate) => ({
    coordinate, result: scheduleWeek(coordinate),
  })).filter((entry): entry is { coordinate: WeeklySchedulerInputs; result: WeeklySchedule } =>
    !scheduleRefused(entry.result));
  const appDays = (week: WeeklySchedule) => week.days.filter((day) =>
    (day.conditioning !== null && day.conditioningCategory !== 'recovery_flush')
    || day.sprintComponent);
  const threeConsecutive = (week: WeeklySchedule): boolean => {
    const present = new Set(appDays(week).map((day) => day.dayOfWeek));
    return order.some((day) => present.has(day)
      && present.has((day + 1) % 7) && present.has((day + 2) % 7));
  };
  const buildNoClub = accepted.filter(({ coordinate }) =>
    coordinate.weekKind === 'build' && coordinate.clubNights.length === 0);
  const wrongNormalShape = buildNoClub.filter(({ result }) => {
    const energy = appDays(result);
    const categories = energy.map((day) => day.conditioningCategory);
    return energy.length !== 4
      || energy.filter((day) => day.conditioning === 'sprint_high_speed'
        || day.sprintComponent).length !== 1
      || categories.filter((category) => category === 'vo2' || category === 'glycolytic').length !== 1
      || categories.filter((category) => category === 'tempo').length < 1
      || categories.filter((category) => category === 'aerobic_base').length > 1;
  });
  console.log(`  R-303 matrix: ${accepted.length} accepted schedules / ${coordinates.length} distinct input coordinates across ${availabilityPatterns.length} exact availability sets`);
  ok('[R-303 matrix non-vacuity] exact availability sweep reaches hundreds of accepted schedules',
    ['WC-132'], accepted.length >= 300,
    `${accepted.length} accepted of ${coordinates.length} coordinates across ${availabilityPatterns.length} exact availability sets`);
  ok('[R-303 matrix] no accepted Off-season coordinate exceeds four app energy-system days',
    ['WC-132'], accepted.every(({ result }) => appDays(result).length <= 4),
    `${accepted.filter(({ result }) => appDays(result).length > 4).length} distinct violating coordinates`);
  ok('[R-303 matrix] no accepted Off-season coordinate contains three consecutive app energy-system days',
    ['WC-040', 'WC-132'], accepted.every(({ result }) => !threeConsecutive(result)),
    JSON.stringify(accepted.filter(({ result }) => threeConsecutive(result)).slice(0, 5)
      .map(({ coordinate, result }) => ({ gym: coordinate.gymAccessDays,
        club: coordinate.clubNights, weekKind: coordinate.weekKind,
        energy: appDays(result).map((day) => [day.dayOfWeek, day.conditioningCategory]) }))));
  ok('[R-303 matrix] every accepted normal no-club build has Speed + hard + tempo + at most one easy aerobic',
    ['WC-132', 'WC-136', 'WC-138'], wrongNormalShape.length === 0,
    JSON.stringify(wrongNormalShape.slice(0, 5).map(({ coordinate, result }) => ({
      gym: coordinate.gymAccessDays,
      energy: appDays(result).map((day) => [day.dayOfWeek, day.conditioningCategory]),
    }))));
  // R-337: every coordinate here has at least three legal receivers besides
  // the Speed day, so stacking Speed onto metabolic work is never the answer.
  const stackedSpeed = accepted.filter(({ coordinate, result }) =>
    coordinate.clubNights.length === 0 && result.days.some((day) =>
      day.sprintComponent && day.conditioning !== 'sprint_high_speed'));
  ok('[R-337 matrix] no accepted no-club coordinate stacks Speed onto a metabolic conditioning day',
    ['WC-132', 'WC-138'], stackedSpeed.length === 0,
    JSON.stringify(stackedSpeed.slice(0, 5).map(({ coordinate, result }) => ({
      gym: coordinate.gymAccessDays, weekKind: coordinate.weekKind,
      energy: appDays(result).map((day) => [day.dayOfWeek, day.conditioningCategory, day.sprintComponent]),
    }))));
  ok('[R-303 matrix] club anchors remain separate and reduce rather than inflate app-programmed work',
    ['WC-045', 'WC-062'], accepted.filter(({ coordinate }) => coordinate.clubNights.length > 0)
      .every(({ coordinate, result }) =>
        result.demand.anchorConditioning === new Set(coordinate.clubNights).size
        && appDays(result).length + result.demand.anchorConditioning <= 4),
    `${accepted.filter(({ coordinate, result }) => coordinate.clubNights.length > 0
      && (result.demand.anchorConditioning !== new Set(coordinate.clubNights).size
        || appDays(result).length + result.demand.anchorConditioning > 4)).length} distinct violating coordinates`);
}

// R-303 remainder liveness: Friday's Clear cannot reinterpret four delivered
// energy-system days as four fresh seats and append a Thu/Fri/Sat triple.
{
  const pureSpeedEvidence = {
    protocolVersion: 1 as const,
    source: 'session_classification_adapter' as const,
    conditioningCredits: 1,
    appProgrammedConditioningCredits: 1,
    sprintHighSpeedCredits: 1,
    qualifyingSpeed: true,
    independentConditioning: false,
    speedTemplateName: '20 m Acceleration Reps',
  };
  ok('[audit semantics] typed pure Running Speed is not relabelled generated conditioning',
    ['WC-132'],
    isRunningSpeedDay(pureSpeedEvidence) && !isGeneratedConditioningDay(pureSpeedEvidence));
  const independentConditioning = {
    ...pureSpeedEvidence,
    sprintHighSpeedCredits: 0,
    qualifyingSpeed: false,
    independentConditioning: true,
    speedTemplateName: null,
  };
  const teamEvidence = {
    ...independentConditioning,
    appProgrammedConditioningCredits: 0,
  };
  const auditCounts = summarizeWeeklyEnergySystemAudit([
    { kind: 'training', type: 'Mixed', energySystem: pureSpeedEvidence },
    { kind: 'training', type: 'Conditioning', energySystem: independentConditioning },
    { kind: 'training', type: 'Team Training', energySystem: teamEvidence },
    { kind: 'game', type: 'Game', energySystem: teamEvidence },
  ]);
  ok('[audit semantics] all six energy-system units remain separate', ['WC-132'],
    JSON.stringify(auditCounts) === JSON.stringify({
      explicitFixtureDays: 1,
      generatedConditioningDays: 1,
      runningSpeedDays: 1,
      teamTrainingCreditDays: 1,
      totalEnergySystemCredits: 4,
      appProgrammedExposureDays: 2,
    }), JSON.stringify(auditCounts));
  const result = built({
    phase: 'Pre-season',
    offseasonBlock: null,
    gymAccessDays: [MON, TUE, WED, THU, FRI, SAT],
    clubNights: [TUE, THU],
    governedFromISO: '2026-07-18',
    deliveredEnergySystemDays: [
      { dayOfWeek: MON, appProgrammed: true, anchorConditioning: false, sprintHighSpeed: true },
      { dayOfWeek: TUE, appProgrammed: true, anchorConditioning: false, sprintHighSpeed: false },
      { dayOfWeek: WED, appProgrammed: false, anchorConditioning: false, sprintHighSpeed: false },
      { dayOfWeek: THU, appProgrammed: true, anchorConditioning: false, sprintHighSpeed: false },
      { dayOfWeek: FRI, appProgrammed: true, anchorConditioning: false, sprintHighSpeed: false },
    ],
  });
  const appDays = result.days.filter((day) =>
    (day.conditioning !== null && day.conditioningCategory !== 'recovery_flush')
    || day.sprintComponent).map((day) => day.dayOfWeek);
  ok('[R-303 remainder] delivered Thu/Fri prevents a catch-up exposure on Saturday',
    ['WC-040', 'WC-132'],
    !appDays.includes(SAT) && result.demand.coreConditioning === 4,
    JSON.stringify({ appDays, demand: result.demand }));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[anchors] Real club nights and real game days — never assumed');
// ═══════════════════════════════════════════════════════════════════════════
{
  // ⚠ NOT Tuesday/Thursday/Saturday. The mission required real weekdays.
  // ⚠ SATURDAY IS IN THE GYM SET ON PURPOSE. It is G-1 for the Sunday game, so
  // if the proximity rule stopped excluding it the scheduler COULD place strength
  // there. Without Saturday in the set the cell is unfalsifiable — the mutation
  // harness proved it by removing the rule and reddening nothing.
  const week = built({ phase: 'In-season', gymAccessDays: [MON, TUE, WED, THU, FRI, SAT],
    clubNights: [WED, FRI], gameDay: SUN, age: 24 });
  // ⚠ READ THE FLAG, NOT THE OWNER. A club night that is also a gym day is BOTH,
  // and the contract's own reference week pairs an upper session with each club
  // night. This cell found the bug: `owner` was exclusive, so a Wed/Fri club
  // athlete whose gym days included Wed and Fri reported ZERO club days.
  const clubDays = week.days.filter((d) => d.clubTraining).map((d) => d.dayOfWeek);
  ok('[WC-062] a Wednesday/Friday club athlete gets club days there, not Tue/Thu',
    ['WC-062'],
    clubDays.includes(WED) && clubDays.includes(FRI)
    && !clubDays.includes(TUE) && !clubDays.includes(THU),
    JSON.stringify(clubDays));
  ok('[WC-062] a club night that is also a gym day carries BOTH', ['WC-062'],
    week.days.some((d) => d.clubTraining && d.owner === 'strength'),
    JSON.stringify(week.days.map((d) => [d.dayOfWeek, d.owner, d.clubTraining])));
  const gameDays = week.days.filter((d) => d.owner === 'game').map((d) => d.dayOfWeek);
  ok('[WC-050] a SUNDAY game is anchored on Sunday', ['WC-050'],
    gameDays.length === 1 && gameDays[0] === SUN, JSON.stringify(gameDays));
  // ⚠ G-1 IS SATURDAY, AND G+1 IS OUTSIDE THIS WEEK. In a Monday-first week a
  // Sunday game is the LAST day, so Monday is G-6, not G+1. An earlier draft of
  // this cell asserted Monday was excluded and was wrong about the calendar, not
  // about the rule.
  ok('[WC-050] no strength on G-1 (Saturday) for a Sunday game', ['WC-050'],
    !strengthDays(week).some((d) => d.dayOfWeek === SAT),
    JSON.stringify(strengthDays(week).map((d) => d.dayOfWeek)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[unavailable] Explicit unavailable days are never used, for anything');
// ═══════════════════════════════════════════════════════════════════════════
{
  const week = built({ phase: 'Pre-season',
    gymAccessDays: [MON, TUE, WED, THU, FRI], unavailableDays: [SAT, SUN, WED] });
  ok('[WC-061] no day the athlete marked unavailable appears in the week at all',
    ['WC-061'],
    !week.days.some((d) => [SAT, SUN, WED].includes(d.dayOfWeek)),
    JSON.stringify(week.days.map((d) => d.dayOfWeek)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[running] Required equipment-free running may leave the gym days');
// ═══════════════════════════════════════════════════════════════════════════
{
  // Two gym days, no club, no game: the running minimum cannot be met on gym
  // days alone, so the contract permits other legal days.
  const week = built({ phase: 'Pre-season', gymAccessDays: [MON, WED], clubNights: [] });
  const runningDays = week.days.filter((d) => d.conditioning === 'running'
    || d.conditioning === 'sprint_high_speed' || d.sprintComponent);
  const offGym = runningDays.filter((d) => ![MON, WED].includes(d.dayOfWeek));
  ok('[WC-060] required running is placed on non-gym days when needed',
    ['WC-060', 'WC-046'],
    runningDays.length >= GLOBAL_RULES.running.min && offGym.length > 0,
    `running on ${JSON.stringify(runningDays.map((d) => d.dayOfWeek))}`);
  ok('[WC-044] and never more than three running days consecutively',
    ['WC-044'],
    (() => {
      const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
      const set = new Set(runningDays.map((d) => d.dayOfWeek));
      let run = 0; let longest = 0;
      for (const d of order) { run = set.has(d) ? run + 1 : 0; longest = Math.max(longest, run); }
      return longest <= GLOBAL_RULES.runningStreakMaximum;
    })());
  // And it still respects explicit unavailability.
  const fenced = built({ phase: 'Pre-season', gymAccessDays: [MON, WED],
    unavailableDays: [TUE, THU, FRI, SAT, SUN] });
  ok('[WC-061] off-gym running still never lands on an unavailable day',
    ['WC-061'],
    !fenced.days.some((d) => [TUE, THU, FRI, SAT, SUN].includes(d.dayOfWeek)),
    JSON.stringify(fenced.days.map((d) => [d.dayOfWeek, d.owner])));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[overlays] Off-season blocks, pre-season and in-season');
// ═══════════════════════════════════════════════════════════════════════════
{
  const early = built({ phase: 'Off-season', offseasonBlock: 'early_optional',
    gymAccessDays: [MON, WED, FRI] });
  ok('[WC-130] early off-season: every strength session is OPTIONAL',
    ['WC-130'],
    strengthDays(early).length > 0 && strengthDays(early).every((d) => d.optional),
    JSON.stringify(strengthDays(early).map((d) => d.optional)));
  ok('[WC-130] early off-season requires no running', ['WC-130'],
    !OFFSEASON_OVERLAYS.early_optional.runningRequired
    && OFFSEASON_OVERLAYS.early_optional.loadAdjustment === 0.75
    && OFFSEASON_OVERLAYS.early_optional.maxRestDays === 3);

  const transition = built({ phase: 'Off-season', offseasonBlock: 'transition',
    gymAccessDays: [MON, WED, FRI] });
  ok('[WC-131] transition off-season: the skeleton is REQUIRED again, at 90%',
    ['WC-131'],
    strengthDays(transition).every((d) => !d.optional)
    && OFFSEASON_OVERLAYS.transition.loadAdjustment === 0.90
    && OFFSEASON_OVERLAYS.transition.sessionsRequired);

  ok('[WC-132] normal build: normal load, and a sprint exposure is required',
    ['WC-132'],
    OFFSEASON_OVERLAYS.normal_build.loadAdjustment === null
    && OFFSEASON_OVERLAYS.normal_build.sprintExposureRequired
    && OFFSEASON_OVERLAYS.normal_build.conditioningTarget.max === 4);

  ok('[WC-133] pre-season targets four conditioning exposures', ['WC-133'],
    PRESEASON_OVERLAY.conditioningTarget.min === 4
    && PRESEASON_OVERLAY.sessionsRequired);
  ok('[WC-134] in-season has NO scheduled calendar deload', ['WC-134'],
    INSEASON_OVERLAY.loadAdjustment === null
    && INSEASON_OVERLAY.statement.includes('No scheduled calendar deload'));

  // WC-135 — the in-season sprint is only added when there is NO club training.
  // The contract's OWN in-season reference week: club nights ARE gym days, which
  // is what "Gym may share a club-training day" means in practice.
  const withClub = built({ phase: 'In-season', gymAccessDays: [MON, TUE, THU],
    clubNights: [TUE, THU], gameDay: SAT });
  ok('[WC-135] in-season, no app sprint is added when club training exists',
    ['WC-135'],
    !withClub.days.some((d) => d.conditioning === 'sprint_high_speed'),
    JSON.stringify(withClub.days.map((d) => d.conditioning)));
  // ⚠ THE POSITIVE CASE, AND IT IS THE ONE THAT WAS MISSING. Without it the cell
  // above was GREEN AND EMPTY: the scheduler emitted no sprint under any
  // conditions, so "no sprint when club training exists" could not fail. The
  // mutation harness found it — flipping the rule reddened nothing.
  const noClub = built({ phase: 'In-season', gymAccessDays: [MON, TUE, THU],
    clubNights: [], gameDay: SAT });
  // WC-143 (Sam's Q2 ruling, 2026-08-26) changed this exposure's SHAPE, not
  // its existence: the no-club game week's sprint now OPENS the fast session
  // — "a short sprint workout into ... glycolytic" — so it appears as a
  // `sprintComponent` on the hard day, or as a standalone sprint day when no
  // hard day could be authored. Either way the week carries EXACTLY ONE.
  const sprintDays = noClub.days.filter((d) =>
    d.conditioning === 'sprint_high_speed' || d.sprintComponent);
  ok('[WC-135] ...and a sprint IS added when there is no club training',
    ['WC-135', 'WC-143'], sprintDays.length === 1,
    JSON.stringify(noClub.days.map((d) => [d.dayOfWeek, d.conditioning, d.sprintComponent])));
  const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
  ok('[WC-135] ...placed G-3 or earlier', ['WC-135'],
    sprintDays.every((d) => order.indexOf(d.dayOfWeek) <= order.indexOf(SAT) - 3),
    JSON.stringify(sprintDays.map((d) => d.dayOfWeek)));

  // ── WC-136: the PHASE owns the count and the hard quality ────────────────
  //
  // The behavioural weight of this clause is in
  // `test:conditioning-phase-authorship`, which reads real generated programs.
  // These cells hold the SCHEDULER's half — that the overlay is what it reads.
  const preseasonWeek = built({ phase: 'Pre-season',
    gymAccessDays: [MON, TUE, THU, FRI], clubNights: [], gameDay: null });
  const preseasonHard = preseasonWeek.days.filter(
    (d) => d.conditioningCategory !== null && isHardMetabolicConditioningCategory(d.conditioningCategory));
  ok('[WC-136] a pre-season week authors a HARD conditioning quality, not just capacity',
    ['WC-136'], preseasonHard.length === 1,
    JSON.stringify(preseasonWeek.days.map((d) => [d.dayOfWeek, d.conditioningCategory])));
  ok('[WC-136] the pre-season conditioning demand follows the PHASE target, '
    + 'not the global minimum', ['WC-136'],
    preseasonWeek.demand.coreConditioning === PRESEASON_OVERLAY.conditioningTarget.min,
    `demand=${preseasonWeek.demand.coreConditioning} `
    + `target=${PRESEASON_OVERLAY.conditioningTarget.min} `
    + `global=${GLOBAL_RULES.conditioning.min}`);
  // ⚠ THE DISCRIMINATING PAIR. In-season is the one overlay whose hard quality
  // is gated on the week having NO game, so the same athlete must differ.
  const inseasonGame = built({ phase: 'In-season',
    gymAccessDays: [MON, TUE, THU, FRI], clubNights: [], gameDay: SAT });
  const inseasonClubGame = built({ phase: 'In-season',
    gymAccessDays: [MON, TUE, THU, FRI], clubNights: [TUE, THU], gameDay: SAT });
  const inseasonBye = built({ phase: 'In-season',
    gymAccessDays: [MON, TUE, THU, FRI], clubNights: [], gameDay: null });
  const hardIn = (week: WeeklySchedule) => week.days.filter(
    (d) => d.conditioningCategory !== null && isHardMetabolicConditioningCategory(d.conditioningCategory)).length;
  // WC-143 (Sam's Q2 ruling, 2026-08-26) SUPERSEDED the unqualified form of
  // this cell for the no-club athlete: their only fast work all week was the
  // game, and Sam ruled that is not enough. The CLUB game week keeps the
  // 2026-07-29 credit — its two club nights supply the fast running.
  ok('[WC-136/WC-143] a CLUB athlete\'s in-season game week authors no hard '
    + 'conditioning — the game and club nights carry it', ['WC-136', 'WC-143'],
    hardIn(inseasonClubGame) === 0,
    JSON.stringify(inseasonClubGame.days.map((d) => [d.dayOfWeek, d.conditioningCategory])));
  ok('[WC-143] the NO-CLUB game week authors exactly ONE hard exposure, and it '
    + 'is GLYCOLYTIC — Sam: "a short sprint workout into ... glycolytic '
    + 'sessions in the 30 second to 2 min interval range"', ['WC-143'],
    hardIn(inseasonGame) === 1
    && inseasonGame.days.some((d) => d.conditioningCategory === 'glycolytic'),
    JSON.stringify(inseasonGame.days.map((d) => [d.dayOfWeek, d.conditioningCategory])));
  {
    const fastDay = inseasonGame.days.find((d) => d.conditioningCategory === 'glycolytic');
    const gameIdx = order.indexOf(SAT);
    const speedDay = inseasonGame.days.find((d) =>
      d.conditioning === 'sprint_high_speed' || d.sprintComponent);
    ok('[WC-143/R-330] the early fast quality remains and Speed is placed by '
      + 'freshness instead of being forced onto the hard session', ['WC-143'],
      fastDay !== undefined && speedDay !== undefined
      && order.indexOf(fastDay.dayOfWeek) <= gameIdx - 4
      && ![THU, FRI, SAT, SUN].includes(speedDay.dayOfWeek),
      JSON.stringify({ fast: fastDay?.dayOfWeek, speed: speedDay?.dayOfWeek }));
    // R-338 + P15 (2026-09-03): in-season the contract counts Speed as
    // conditioning inside the game-week caps (three app exposures including the
    // flush offer), so a Speed day of its own made hard + Speed + moderate +
    // flush = four and the generated week was refused at Section 18 — a blank
    // program for the six-day no-club athlete. Sam's Q2 shape is ONE session:
    // "a short sprint workout into ... flying runs or glycolytic sessions".
    ok('[WC-143/R-338] the NO-CLUB game week\'s Speed rides its early fast session — '
      + 'one exposure, not a Speed day of its own', ['WC-143'],
      fastDay !== undefined && speedDay !== undefined && speedDay.dayOfWeek === fastDay.dayOfWeek,
      JSON.stringify({ fast: fastDay?.dayOfWeek, speed: speedDay?.dayOfWeek }));
    const g2 = inseasonGame.days.find((d) => order.indexOf(d.dayOfWeek) === gameIdx - 2);
    ok('[WC-143] ...and the SECOND app exposure sits at G-2 at moderate '
      + 'intensity — "then later in the week on say a g-2 ... keep this '
      + 'moderate"', ['WC-143'],
      g2 !== undefined && g2.conditioningCategory === 'tempo',
      JSON.stringify(inseasonGame.days.map((d) => [d.dayOfWeek, d.conditioningCategory])));
  }
  ok('[WC-136] ...and the same athlete\'s BYE week authors one hard exposure', ['WC-136'],
    hardIn(inseasonBye) === 1,
    JSON.stringify(inseasonBye.days.map((d) => [d.dayOfWeek, d.conditioningCategory])));
  // ── R-340: repeat-sprint ability is a hard CONDITIONING demand (R-311) ──
  // Sam, 2026-09-02: *"why are there no repeat sprint sessions? i have them
  // planned as templates in the app"*. It rotates with aerobic power from
  // late Pre-season (phase week 4) and in the in-season bye week; it is never
  // reachable through the Speed slot.
  const hardOf = (week: WeeklySchedule) => week.days
    .map((d) => d.conditioningCategory).filter((c) => c !== null && isHardMetabolicConditioningCategory(c));
  const latePreCycle1 = built({ phase: 'Pre-season', offseasonBlock: null, phaseWeekNumber: 5, miniCycleNumber: 1,
    gymAccessDays: [MON, TUE, THU, FRI, SAT], clubNights: [], gameDay: null });
  const latePreCycle2 = built({ phase: 'Pre-season', offseasonBlock: null, phaseWeekNumber: 6, miniCycleNumber: 2,
    gymAccessDays: [MON, TUE, THU, FRI, SAT], clubNights: [], gameDay: null });
  const earlyPreCycle2 = built({ phase: 'Pre-season', offseasonBlock: null, phaseWeekNumber: 2, miniCycleNumber: 2,
    gymAccessDays: [MON, TUE, THU, FRI, SAT], clubNights: [], gameDay: null });
  ok('[R-340] late Pre-season rotates aerobic power with repeat-sprint by mini-cycle', ['WC-136'],
    JSON.stringify(hardOf(latePreCycle1)) === '["vo2"]' && JSON.stringify(hardOf(latePreCycle2)) === '["repeat_sprint"]',
    JSON.stringify({ cycle1: hardOf(latePreCycle1), cycle2: hardOf(latePreCycle2) }));
  ok('[R-340] early Pre-season keeps aerobic power only', ['WC-136'],
    JSON.stringify(hardOf(earlyPreCycle2)) === '["vo2"]', JSON.stringify(hardOf(earlyPreCycle2)));
  const byeCycle1 = built({ phase: 'In-season', miniCycleNumber: 1,
    gymAccessDays: [MON, TUE, THU, FRI], clubNights: [TUE, THU], gameDay: null });
  const byeCycle2 = built({ phase: 'In-season', miniCycleNumber: 2,
    gymAccessDays: [MON, TUE, THU, FRI], clubNights: [TUE, THU], gameDay: null });
  const gameCycle2 = built({ phase: 'In-season', miniCycleNumber: 2,
    gymAccessDays: [MON, TUE, THU, FRI], clubNights: [TUE, THU], gameDay: SAT });
  ok('[R-340] an in-season bye week carries the small repeat-sprint dose; a game week still authors no hard work', ['WC-136'],
    JSON.stringify(hardOf(byeCycle1)) === '["repeat_sprint"]' && JSON.stringify(hardOf(byeCycle2)) === '["repeat_sprint"]'
    && hardOf(gameCycle2).length === 0,
    JSON.stringify({ bye1: hardOf(byeCycle1), bye2: hardOf(byeCycle2), game: hardOf(gameCycle2) }));
  ok('[R-311/R-340] the Speed pool never offers repeat-sprint work', ['WC-135'],
    poolForCategoryPublic('sprint').every((template) => template.quality !== 'repeat_sprint')
    && poolForCategoryPublic('repeat_sprint').length === 5
    && poolForCategoryPublic('repeat_sprint').every((template) => template.quality === 'repeat_sprint'),
    JSON.stringify(poolForCategoryPublic('sprint').map((t) => t.name)));

  // ── WC-138 + R-330: Speed uses the earliest genuinely fresh receiver ─────
  const offRef = built({ phase: 'Off-season', offseasonBlock: 'normal_build',
    gymAccessDays: [MON, TUE, THU, FRI], clubNights: [], gameDay: null });
  const offSprint = offRef.days.filter((d) =>
    d.conditioning === 'sprint_high_speed' || d.sprintComponent);
  ok('[WC-138/R-330] the off-season week has exactly one budgeted Speed receiver', ['WC-138'],
    offSprint.length === 1,
    JSON.stringify(offSprint.map((d) => [d.dayOfWeek, d.owner, d.conditioningRole, d.sprintComponent])));
  // R-338 (Sam, 2026-09-02): a fresh existing strength day beats opening a new
  // day, and any fresh day beats an upper day immediately after heavy lower.
  ok('[WC-138/R-330/R-338] the earliest fresh existing strength day beats a new standalone day and '
    + 'beats upper days immediately after heavy lower work', ['WC-138'],
    offSprint[0]?.dayOfWeek === MON,
    JSON.stringify(offSprint.map((d) => [d.dayOfWeek, d.purpose])));
  ok('[WC-138/R-330] selection no longer defaults to the last upper day', ['WC-138'],
    offSprint[0]?.dayOfWeek !== FRI,
    JSON.stringify(offRef.days.map((d) => [d.dayOfWeek, d.conditioning])));
  ok('[R-303/WC-138] the revised off-season reference: 4 strength and 4 app energy-system days', ['WC-138'],
    offRef.demand.mainStrength === 4
    && offRef.demand.coreConditioning === 4,
    JSON.stringify(offRef.demand));
  const offEnergyDays = offRef.days.filter((day) =>
    (day.conditioning !== null && day.conditioningCategory !== 'recovery_flush')
    || day.sprintComponent);
  const offCategories = offEnergyDays.map((day) => day.conditioningCategory);
  ok('[R-303] normal build contains Speed, one hard exposure, tempo and at most one easy aerobic',
    ['WC-132', 'WC-136', 'WC-138'],
    offEnergyDays.length === 4
    && offEnergyDays.filter((day) => day.conditioning === 'sprint_high_speed'
      || day.sprintComponent).length === 1
    && offCategories.filter((category) => category === 'vo2' || category === 'glycolytic').length === 1
    && offCategories.filter((category) => category === 'tempo').length >= 1
    && offCategories.filter((category) => category === 'aerobic_base').length <= 1,
    JSON.stringify(offEnergyDays.map((day) => [day.dayOfWeek, day.conditioningCategory])));
  const offEnergySet = new Set(offEnergyDays.map((day) => day.dayOfWeek));
  ok('[R-303] normal build has no three consecutive app-programmed energy-system days',
    ['WC-040', 'WC-132'],
    ![MON, TUE, WED, THU, FRI, SAT, SUN].some((day) =>
      offEnergySet.has(day)
      && offEnergySet.has((day + 1) % 7)
      && offEnergySet.has((day + 2) % 7)),
    JSON.stringify([...offEnergySet]));
  ok('[WC-138/R-330] the fresh Speed day remains inside the four-exposure budget', ['WC-138'],
    (offRef.days.find((d) => d.dayOfWeek === MON)?.sprintComponent === true
      || offRef.days.find((d) => d.dayOfWeek === MON)?.conditioning === 'sprint_high_speed')
    && offRef.demand.coreConditioning === 4,
    JSON.stringify(offRef.days.map((d) => [d.dayOfWeek, d.owner])));
  ok('[WC-138] ...and Sunday carries nothing before Monday\'s lower day', ['WC-138'],
    offRef.days.find((d) => d.dayOfWeek === SUN)?.conditioning === null,
    JSON.stringify(offRef.days.map((d) => [d.dayOfWeek, d.conditioning])));
  // ── R-337: THE WEEK IS BUDGETED IN STIMULI, NOT DAYS ─────────────────────
  // Sam, 2026-09-02: *"count stimulus"*. Speed is one of the four required
  // energy-system stimuli. When the week has room it earns its own day; it
  // shares a day with metabolic work only when the legal receivers are short.
  const sixDay = built({ phase: 'Off-season', offseasonBlock: 'normal_build',
    gymAccessDays: [MON, TUE, WED, THU, FRI, SAT], clubNights: [], gameDay: null });
  const sixDayEnergy = sixDay.days.filter((day) =>
    (day.conditioning !== null && day.conditioningCategory !== 'recovery_flush')
    || day.sprintComponent);
  const sixDaySpeed = sixDay.days.find((day) =>
    day.conditioning === 'sprint_high_speed' || day.sprintComponent);
  ok('[R-337] a six-day normal build delivers four stimuli on four distinct days and leaves Sunday empty',
    ['WC-132', 'WC-138'],
    sixDayEnergy.length === 4
    && sixDay.days.find((day) => day.dayOfWeek === SUN)?.conditioning === null
    && sixDayEnergy.filter((day) => day.conditioning === 'sprint_high_speed'
      || day.sprintComponent).length === 1
    && sixDayEnergy.map((day) => day.conditioningCategory)
      .filter((category) => category === 'vo2' || category === 'glycolytic').length === 1,
    JSON.stringify(sixDay.days.map((day) => [day.dayOfWeek, day.owner, day.conditioning,
      day.conditioningCategory, day.sprintComponent])));
  // ── R-338: flys count as conditioning AND speed in a club pre-season week ──
  // Sam, 2026-09-02: two team nights + the hard session + the fly are the
  // four; no aerobic session is owed. R-391/R-393 allow a separate Speed day.
  const clubPre = built({ phase: 'Pre-season', offseasonBlock: null,
    gymAccessDays: [MON, TUE, WED, THU, FRI, SAT], clubNights: [MON, WED], gameDay: null });
  const clubPreApp = clubPre.days.filter((day) =>
    (day.conditioning !== null && day.conditioningCategory !== 'recovery_flush') || day.sprintComponent);
  const clubPreSpeed = clubPre.days.find((day) =>
    day.conditioning === 'sprint_high_speed' || day.sprintComponent);
  ok('[R-338] a two-club-night pre-season week authors the hard session and the fly only — no extra aerobic',
    ['WC-133', 'WC-138'],
    clubPreApp.length === 2 && clubPre.demand.coreConditioning === 4
    && clubPreApp.some((day) => day.conditioningCategory === 'vo2' || day.conditioningCategory === 'glycolytic')
    && clubPreSpeed !== undefined && clubPreSpeed.conditioning === 'sprint_high_speed'
    && clubPreSpeed.sprintComponent === false,
    JSON.stringify(clubPre.days.map((day) => [day.dayOfWeek, day.owner, day.purpose, day.conditioning,
      day.conditioningCategory, day.sprintComponent])));
  ok('[R-391/R-393] the fly can use a separate available day without an assumed lifting order',
    ['WC-138'], clubPreSpeed!==undefined && ![MON,WED].includes(clubPreSpeed.dayOfWeek)
    && clubPreSpeed.conditioning==='sprint_high_speed',
    JSON.stringify(clubPre.days.map(day=>[day.dayOfWeek,day.owner,day.purpose])));

  ok('[R-337] the Speed day carries no metabolic conditioning when the week has room',
    ['WC-138'],
    sixDaySpeed !== undefined && sixDaySpeed.conditioning === 'sprint_high_speed'
    && sixDaySpeed.sprintComponent === false,
    JSON.stringify(sixDaySpeed));
  // The same selector now governs every phase; phase-specific quality and
  // exposure-count rules remain separate.
  const inSeasonRef = built({ phase: 'In-season',
    gymAccessDays: [MON, TUE, THU, FRI], clubNights: [], gameDay: SAT });
  ok('[WC-138/R-330] in-season Speed also uses one legal ranked receiver', ['WC-138'],
    inSeasonRef.days.filter((d) => d.conditioning === 'sprint_high_speed' || d.sprintComponent).length === 1,
    JSON.stringify(inSeasonRef.days.filter((d) => d.conditioning === 'sprint_high_speed' || d.sprintComponent)
      .map((d) => [d.dayOfWeek, d.owner, d.conditioningRole, d.sprintComponent])));

  ok('[WC-136] no hard exposure ever lands on a club night', ['WC-136'],
    built({ phase: 'Pre-season', gymAccessDays: [MON, TUE, THU, FRI],
      clubNights: [TUE], gameDay: null })
      .days.filter((d) => d.clubTraining).every((d) => d.conditioningCategory === null));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[patterns] Weekly movement coverage and automatic main-seat allowance');
// ═══════════════════════════════════════════════════════════════════════════
{
  const week = built({ phase: 'Pre-season', gymAccessDays: [MON, TUE, THU, FRI] });
  ok('[WC-020] the eight named patterns are the contract\'s required set',
    ['WC-020'], REQUIRED_PATTERNS.length === 8);
  ok('[WC-021] the automatic weekly main-seat allowance is one', ['WC-021'],
    AUTOMATIC_WEEKLY_MAIN_SEAT_ALLOWANCE === 1);
  ok('[WC-023] a four-session pre-season week intends both lower pairs',
    ['WC-023'],
    week.intendedPatterns.includes('squat') && week.intendedPatterns.includes('hinge')
    && week.intendedPatterns.includes('single_leg_knee')
    && week.intendedPatterns.includes('single_leg_hip'),
    JSON.stringify(week.intendedPatterns));
  // ⚠ AND A WEEK THAT ACTUALLY CONTAINS A FULL-BODY SESSION. The cell above uses
  // Upper x2 + Lower x2, so gutting `full_body`'s pattern list changed nothing in
  // it — the harness found the blind spot.
  const withFullBody = built({ phase: 'Off-season', offseasonBlock: 'normal_build',
    gymAccessDays: [MON, WED, FRI] });
  ok('[WC-023] a full-body session intends the lower patterns too', ['WC-023'],
    withFullBody.days.filter((d) => d.purpose === 'full_body')
      .every((d) => d.movementIntention.includes('squat')
        && d.movementIntention.includes('hinge')),
    JSON.stringify(withFullBody.days.map((d) => [d.purpose, d.movementIntention])));
  ok('[WC-047] and 2-3 upper exposures', ['WC-047'],
    strengthDays(week).filter((d) => !PURPOSE_IS_LOWER[d.purpose as SessionPurpose])
      .length >= GLOBAL_RULES.upperExposures.min);
  ok('[WC-048] the daily movement ceiling is 7, and it is a ceiling', ['WC-048'],
    GLOBAL_RULES.dailyMovementCeiling === 7);
  ok('[WC-045] conditioning targets 3-5 with a fifth off-leg', ['WC-045'],
    GLOBAL_RULES.conditioning.min === 3 && GLOBAL_RULES.conditioning.max === 5
    && GLOBAL_RULES.conditioning.fifthIsOffLeg);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[refusal] A schedule that cannot be built stays a TYPED refusal');
// ═══════════════════════════════════════════════════════════════════════════
{
  // ⚠ GENUINELY UNBUILDABLE, NOT MERELY REDUCED. The contract SCALES a week that
  // has fewer legal days than its layout wants (§8: *"Scale honestly to two or
  // three strength sessions when that is all the athlete can do"*), so a fixture
  // that only loses a day now correctly builds a smaller week. This athlete has
  // Friday and Saturday only, with a Saturday game: Friday is G-1 and Saturday is
  // the game, leaving ZERO legal days and nothing to scale to.
  const impossible = scheduleWeek(inputs({
    phase: 'Pre-season', gymAccessDays: [FRI, SAT], gameDay: SAT, age: 24,
  }));
  // ⚠ THE FINDING IS NAMED, NOT JUST ITS EXISTENCE. Asserting only "it refused"
  // passed even when the not-enough-days branch was skipped entirely and a
  // DIFFERENT refusal answered — the harness caught that by removing the branch
  // and reddening nothing.
  ok('[WC-142] an unbuildable week REFUSES with the RIGHT typed finding',
    ['WC-142'],
    scheduleRefused(impossible)
    && (impossible as any).finding === 'not_enough_legal_gym_days'
    && typeof (impossible as any).clauseId === 'string',
    JSON.stringify(impossible));
  ok('[WC-142] ...and it is never silently repaired into a smaller week',
    ['WC-142'],
    scheduleRefused(impossible) && !('days' in impossible));

  // One gym day is BELOW the smallest approved layout, and the contract has
  // nothing to scale to — a different fact from "this phase has no layout", so it
  // carries its own finding.
  const oneDay = scheduleWeek(inputs({ gymAccessDays: [MON] }));
  ok('[WC-142] one gym day is below every approved layout and refuses', ['WC-142'],
    scheduleRefused(oneDay)
    && (oneDay as any).finding === 'not_enough_legal_gym_days',
    JSON.stringify(oneDay));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[boundary] Specialists materialise; they never redesign the week');
// ═══════════════════════════════════════════════════════════════════════════
//
// Sam's boundary, 2026-08-15: a specialist *"may never add, remove, move or
// repurpose a session."* Those are four separate properties and each gets a cell,
// asserted against the REAL specialists over every world the matrix builds.
{
  const facts = {
    weekStartISO: WEEK_START, miniCycleNumber: 1, capacity: 'moderate' as never,
    isBeginner: false, experienced: true, powerGoalNudge: false,
    injuries: [] as never, runOnly: false,
    phase: 'In-season' as never, offseasonSubphase: null,
  };
  const cases: { label: string; over: Partial<WeeklySchedulerInputs> }[] = [
    { label: 'in-season 3d club', over: { phase: 'In-season',
      gymAccessDays: [MON, TUE, THU], clubNights: [TUE, THU], gameDay: SAT, age: 30 } },
    { label: 'in-season 4d young', over: { phase: 'In-season',
      gymAccessDays: [MON, TUE, WED, THU], clubNights: [TUE, THU], gameDay: SAT, age: 24 } },
    { label: 'pre-season 5d no club', over: { phase: 'Pre-season',
      gymAccessDays: [MON, TUE, WED, THU, FRI], age: 24 } },
    { label: 'off-season early 2d', over: { phase: 'Off-season',
      offseasonBlock: 'early_optional', gymAccessDays: [MON, THU], age: 24 } },
  ];
  let checked = 0;
  const violations: string[] = [];
  for (const c of cases) {
    const week = built(c.over);
    const out = materialiseAuthoredSessions({
      schedule: week,
      facts: { ...facts, phase: (c.over.phase ?? 'In-season') as never },
      gameDay: c.over.gameDay ?? null,
    });
    checked += out.length;
    // ADD / REMOVE — exactly one entry per authorised day, same count.
    if (out.length !== week.days.length) violations.push(`${c.label}: count ${week.days.length} -> ${out.length}`);
    // MOVE — same weekdays, same order.
    const before = week.days.map((d) => d.dayOfWeek).join(',');
    const after = out.map((d) => d.dayOfWeek).join(',');
    if (before !== after) violations.push(`${c.label}: days ${before} -> ${after}`);
    // REPURPOSE — same purpose and owner on every day.
    week.days.forEach((d, i) => {
      if (out[i].purpose !== d.purpose) violations.push(`${c.label}: purpose ${d.purpose} -> ${out[i].purpose}`);
      if (out[i].owner !== d.owner) violations.push(`${c.label}: owner ${d.owner} -> ${out[i].owner}`);
    });
  }
  ok('[boundary non-vacuity] the materialiser actually produced sessions', [],
    checked >= 20, `${checked} sessions materialised`);
  ok('[boundary] a specialist can neither ADD nor REMOVE a session', [],
    !violations.some((v) => v.includes('count')), violations.join(' | '));
  ok('[boundary] a specialist can never MOVE a session', [],
    !violations.some((v) => v.includes('days')), violations.join(' | '));
  ok('[boundary] a specialist can never REPURPOSE a session', [],
    !violations.some((v) => v.includes('purpose') || v.includes('owner')),
    violations.join(' | '));

  // ⚠ POWER IS STRENGTH-SIDE AND NEVER CONDITIONING (Sam, 2026-08-15).
  const inSeason = built({ phase: 'In-season', gymAccessDays: [MON, TUE, WED, THU],
    clubNights: [TUE, THU], gameDay: SAT, age: 24 });
  const materialised = materialiseAuthoredSessions({
    schedule: inSeason, facts, gameDay: SAT });
  ok('[boundary] power is only ever attached to a strength session', [],
    materialised.filter((session) => session.powerPrimer !== null)
      .every((session) => session.owner === 'strength'),
    JSON.stringify(materialised.map((s) => [s.owner, s.powerPrimer !== null])));
  // ⚠ §3 G-2: "No heavy lower-body or added speed work." A jump primer is
  // explosive lower-body work AT ANY DOSE.
  //
  // ⚠⚠ THE FIRST VERSION OF THIS CELL COULD NOT FAIL, AND THE MUTATION FOUND IT.
  // It reused the four-day world above, whose G-2 Thursday is an UPPER day — so
  // there was never a lower-body primer there to forbid. Removing BOTH G-2
  // defences left it green. **A cell aimed at a rule needs a world where the rule
  // can be broken.** This world puts a FULL BODY day (a lower purpose) on the
  // Thursday before a Saturday game.
  // ⚠⚠⚠ **2026-08-16: THIS WORLD NO LONGER EXISTS, AND THAT IS THE FIX.**
  //
  // §3 G-2 says "**No** heavy lower-body work". That was only SCORED (-25), so a
  // week short of legal days simply paid the penalty and placed the lower session
  // anyway — measured on a recurring-Sunday athlete who was handed Deadlift and
  // Bulgarian Split Squats two days before the game. It is LEGALITY now.
  //
  // So a lower purpose can no longer REACH G-2, and this world — which existed
  // purely to put one there — is refused. **The guarantee got stronger: the
  // question "is a lower-body primer offered on a G-2 lower day?" can no longer
  // arise, because the day cannot exist.** The cell asserts the stronger fact
  // rather than being deleted or re-fixtured onto something weaker.
  const g2Attempt = scheduleWeek(inputs({ phase: 'In-season', gymAccessDays: [MON, THU],
    clubNights: [], gameDay: SAT, age: 24 }));
  ok('[WC-050] a LOWER purpose cannot be scheduled on G-2 AT ALL', ['WC-050'],
    scheduleRefused(g2Attempt)
      || !g2Attempt.days.some((d) => d.dayOfWeek === THU
        && d.owner === 'strength' && PURPOSE_IS_LOWER[d.purpose as never]),
    JSON.stringify(g2Attempt));
  // The specialist's own typed refusal is retained in `materialiseAuthoredSessions`
  // as defence in depth. It is now unreachable from the scheduler by construction,
  // which is why it is no longer asserted through one — a cell that routes through
  // an impossible world proves nothing, which is exactly what the FIRST version of
  // this cell did.
  // ── THE POSITIVE CONTROL — WC-051 ────────────────────────────────────────
  //
  // **Sam, 2026-08-15: *"should not rule out upper body power"*.** The lower-body
  // ban above is only half the ruling; without this cell a future tightening that
  // banned ALL G-2 power would pass every test in this file. The four-day world's
  // G-2 Thursday IS an upper day, which is exactly why it could not host the
  // negative case — and exactly what makes it the right positive one.
  const g2Upper = materialised.find((session) => session.dayOfWeek === THU);
  ok('[WC-051 non-vacuity] the four-day G-2 Thursday is an UPPER strength day',
    ['WC-051'],
    !!g2Upper && g2Upper.owner === 'strength'
    && g2Upper.purpose === 'upper_push',
    JSON.stringify([g2Upper?.purpose, g2Upper?.owner]));
  ok('[WC-051] UPPER-body power SURVIVES on G-2 — it is not ruled out',
    ['WC-051'],
    !!g2Upper?.powerPrimer && g2Upper.powerPrimer.family === 'upper',
    JSON.stringify(g2Upper?.powerPrimer ?? null));
  ok('[WC-051] ...and it rides the strength session already authorised there',
    ['WC-051'],
    !!g2Upper && g2Upper.owner === 'strength' && g2Upper.purpose !== null,
    JSON.stringify([g2Upper?.owner, g2Upper?.purpose]));

  // The "no other day gained a primer in its place" cell went with the world it
  // was measured in: a lower purpose cannot reach G-2 now, so there is no
  // omission to displace. The displacement question is still asked, on the UPPER
  // G-2 world above, by the WC-051 pair.

  ok('[boundary] power never appears on the game day or G-1', [],
    !materialised.some((session) => session.powerPrimer !== null
      && (session.game || session.dayOfWeek === FRI)),
    JSON.stringify(materialised.filter((s) => s.powerPrimer).map((s) => s.dayOfWeek)));
  ok('[boundary] power does not change the week\'s conditioning count', [],
    inSeason.demand.coreConditioning
      === built({ phase: 'In-season', gymAccessDays: [MON, TUE, WED, THU],
        clubNights: [TUE, THU], gameDay: SAT, age: 24 }).demand.coreConditioning);

  // A refusal is TYPED and the day survives it.
  ok('[boundary] an unmaterialised session is typed, and its day still exists', [],
    materialised.every((session) => session.unmaterialised === null
      || typeof session.unmaterialised === 'string'));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[optional G-1] gender, phase, fixture count and reduced-week law');
// ═══════════════════════════════════════════════════════════════════════════
{
  const gameWeek = {
    phase: 'In-season' as const,
    gymAccessDays: [MON, TUE, WED, THU, FRI],
    clubNights: [TUE, THU],
    gameDay: SAT,
    gameDays: [SAT],
    age: 24,
  };
  const male = built({ ...gameWeek, athleteGender: 'male' });
  const female = built({ ...gameWeek, athleteGender: 'female' });
  ok('one-game in-season male receives only the optional G-1 Gunshow', [],
    JSON.stringify(composedOptionalKinds(male)) === JSON.stringify(['gunshow']));
  ok('one-game in-season female receives only the optional G-1 Primer', [],
    JSON.stringify(composedOptionalKinds(female)) === JSON.stringify(['primer']));
  // F8 (everyday acceptance, 2026-09-09): the Gunshow is a gym session. G−1
  // that is not a gym-access day has no barbell, cable or dumbbell arm work to
  // compose, and the builder returned an empty session the phone still showed.
  // The placer asks the day first: no gym on G−1, no Gunshow offer. (Primer is
  // bodyweight-legal and keeps its seat.)
  ok('the automatic male Gunshow is not offered when G-1 is not a gym-access day', [],
    composedOptionalKinds(built({
      ...gameWeek, athleteGender: 'male', gymAccessDays: [MON, TUE, THU],
    })).length === 0);
  ok('the female Primer keeps its G-1 seat on a non-gym day (bodyweight-legal)', [],
    JSON.stringify(composedOptionalKinds(built({
      ...gameWeek, athleteGender: 'female', gymAccessDays: [MON, TUE, THU],
    }))) === JSON.stringify(['primer']));
  ok('a scheduled deload removes the automatic male Gunshow', [],
    composedOptionalKinds(built({
      ...gameWeek, athleteGender: 'male', weekKind: 'deload',
    })).length === 0);
  ok('a fatigue-triggered low-readiness week removes the automatic female Primer', [],
    composedOptionalKinds(built({
      ...gameWeek,
      athleteGender: 'female',
      readiness: {
        lowReadiness: true, highReadiness: false,
        lowFatigue: false, consistentlyCompletesThree: false,
      },
    })).length === 0);
  ok('a pre-season practice-match week may use the same G-1 gender rule', [],
    JSON.stringify(composedOptionalKinds(built({
      ...gameWeek, phase: 'Pre-season', athleteGender: 'male',
    }))) === JSON.stringify(['gunshow']));
  ok('a multi-game in-season week receives no automatic Gunshow', [],
    composedOptionalKinds(built({
      ...gameWeek, athleteGender: 'male', gameDays: [FRI, SAT],
    })).length === 0);
  ok('an in-season bye receives no automatic Primer', [],
    composedOptionalKinds(built({
      ...gameWeek, athleteGender: 'female', gameDays: [],
    })).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[cross-week] A MOVED GAME PROTECTS THE ADJACENT WEEK (launch audit #5)');
// ═══════════════════════════════════════════════════════════════════════════
//
// Bible: G+1 is rest or recovery only, and a Sunday fixture protects the
// FOLLOWING Monday. Measured on the simulator 2026-08-25: moving this week's
// game to Sunday left next Monday's full CORE strength session in place — the
// morning after the game. The cause is in `weeklySchedulerInputsFrom`: for an
// explicit target week it synthesised adjacent-week fixture proximity as the
// USUAL game day ±7 (a fabrication, the same ±7-invention pattern the craft
// tier was cured of), so the real marked Sunday game next door was invisible
// and Monday computed G+2 against a phantom Saturday. The availability owner
// (`targetWeekFixtures`, which already knows explicit marks beat byes beat
// the recurring day) now derives the adjacent weeks' REAL fixtures, and the
// inputs builder consumes them.
{
  const profile = {
    seasonPhase: 'In-season',
    gender: 'male',
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDaysPerWeek: 2,
    trainingDaysPerWeek: 3,
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    ageRange: '22-26',
  } as unknown as OnboardingData;
  // The athlete moved this week's game from Sat 29 Aug to Sun 30 Aug. Week
  // under audit: the FOLLOWING week, Mon 31 Aug.
  const markedDays = { '2026-08-30': 'game' as const };
  const availability = resolveProfileTargetWeekAvailability({
    profile,
    weekStart: '2026-08-31',
    markedDays,
    ownedPhase: ownSeasonPhaseForGeneration(profile),
  });
  const baseline = weeklySchedulerInputsFrom({
    profile,
    weekStartISO: '2026-08-31',
    offseasonSubphase: null,
  });
  const built = schedulerInputsWithFixtureState(baseline, canonicalFixtureStateFrom({
    weekStartISO: '2026-08-31',
    availability,
    seasonPhase: profile.seasonPhase,
  }));
  ok('the REAL adjacent Sunday game reaches fixture proximity', [],
    (built.fixtureProximityDates ?? []).includes('2026-08-30'),
    `fixtureProximityDates=${JSON.stringify(built.fixtureProximityDates)}`);
  ok('the phantom usual-day date the move vacated does NOT', [],
    !(built.fixtureProximityDates ?? []).includes('2026-08-29'),
    `fixtureProximityDates=${JSON.stringify(built.fixtureProximityDates)}`);
  const week = scheduleWeek(built);
  const mondayStrength = !scheduleRefused(week) && week.days.some((day) =>
    day.dayOfWeek === MON && day.owner === 'strength');
  ok('Monday after the moved Sunday game carries NO strength session (G+1)', [],
    !scheduleRefused(week) && !mondayStrength,
    scheduleRefused(week)
      ? `schedule refused: ${JSON.stringify(week)}`
      : `Monday owner=${JSON.stringify(week.days.find((day) => day.dayOfWeek === MON))}`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[registry] EVERY typed clause is represented and guarded');
// ═══════════════════════════════════════════════════════════════════════════
{
  const registryIds = new Set(WEEKLY_CONTRACT_CLAUSES.map((c) => c.id));
  ok('[registry non-vacuity] the contract has clauses and cells claimed some', [],
    registryIds.size >= 25 && guardedClauseIds.size >= 20,
    `${registryIds.size} clauses, ${guardedClauseIds.size} guarded`);

  const unguarded = [...registryIds].filter((id) => !guardedClauseIds.has(id)).sort();
  ok('every contract clause is exercised by at least one behavioural cell', [],
    unguarded.length === 0,
    `UNGUARDED: ${JSON.stringify(unguarded)}\n      `
    + 'Add a cell that RUNS the scheduler for this clause — a source-text check '
    + 'is not a guard.');

  const phantom = [...guardedClauseIds].filter((id) => !registryIds.has(id)).sort();
  ok('no cell claims a clause id the contract does not have', [],
    phantom.length === 0, `PHANTOM: ${JSON.stringify(phantom)}`);

  // Every clause carries provenance back to the approved document.
  const noProvenance = WEEKLY_CONTRACT_CLAUSES
    .filter((c) => !c.provenance.startsWith('§')).map((c) => c.id);
  ok('every clause names the document section it comes from', [],
    noProvenance.length === 0, JSON.stringify(noProvenance));

  // Every base layout row is reachable through the ONE entry point.
  const unreachable = BASE_LAYOUTS.filter((row) => !row.gymDays.some((n) =>
    [2, 3, 4, 5, 6].includes(n)));
  ok('every base layout row answers for a real availability count', [],
    unreachable.length === 0, JSON.stringify(unreachable.map((r) => r.clauseId)));
  ok('baseLayoutFor is total over phase x 2-6 gym days', ['WC-142'],
    (['In-season', 'Pre-season', 'Off-season'] as ContractPhase[]).every((phase) =>
      [2, 3, 4, 5, 6].every((n) =>
        baseLayoutFor({ phase, gymDayCount: n, weekendAvailable: false }) !== null
        && baseLayoutFor({ phase, gymDayCount: n, weekendAvailable: true }) !== null)));

  console.log(`\n  CONTRACT REGISTRY: ${registryIds.size} clauses, `
    + `${guardedClauseIds.size} guarded, ${unguarded.length} unguarded`);
}

for (const offseasonBlock of ['transition', 'normal_build'] as const) {
  const week = built({ phase: 'Off-season', offseasonBlock, gymAccessDays: [MON, TUE, WED, THU, FRI, SAT],
    offLegAvailableDays: [MON, TUE, WED, THU, FRI, SAT],
    miniCycleNumber: 1, gameDay: null, clubNights: [] });
  const receivers = week.days.filter(d => d.conditioning !== null).map(d => d.dayOfWeek);
  ok(`P21/${offseasonBlock}: full-week receivers do not exhaust the budget Mon/Tue/Wed`, [],
    (offseasonBlock === 'transition'
      ? receivers.length === 2 && week.days.filter(d => d.conditioning !== null).every(d => d.conditioningRole === 'finisher' && d.conditioningCategory === 'recovery_flush' && d.owner === 'strength')
      : receivers.length >= 3)
    && receivers.some(day => [THU, FRI, SAT, SUN].includes(day)), JSON.stringify(receivers));
  const ordered = receivers.map(day => [MON, TUE, WED, THU, FRI, SAT, SUN].indexOf(day)).sort((a, b) => a - b);
  const gaps = ordered.map((day, i) => (ordered[(i + 1) % ordered.length] - day + 7) % 7);
  ok(`P21/${offseasonBlock}: unconstrained three-exposure week has no adjacent conditioning pair`, [],
    receivers.length !== 3 || gaps.every(gap => gap >= 2), JSON.stringify({ receivers, gaps }));
  for (const lower of [false, true]) {
    const family = week.days.filter(day => day.owner === 'strength' && day.purpose
      && PURPOSE_IS_LOWER[day.purpose] === lower).map(day => [MON, TUE, WED, THU, FRI, SAT, SUN].indexOf(day.dayOfWeek)).sort((a, b) => a - b);
    const familyGaps = family.map((day, i) => (family[(i + 1) % family.length] - day + 7) % 7);
    ok(`P10/${offseasonBlock}/${lower ? 'lower' : 'upper'}: repeated weekly family is separated including Sunday to Monday`, [],
      family.length === 2 && familyGaps.every(gap => gap >= 2), JSON.stringify({ family, familyGaps }));
  }
}

{
  const week = built({ phase: 'In-season', gymAccessDays: [MON, TUE, THU],
    clubNights: [TUE, THU], gameDay: SAT });
  ok('P10/WC-101: general spacing cannot displace upper work from either club night', ['WC-101'],
    [TUE, THU].every(day => week.days.some(session => session.dayOfWeek === day
      && session.owner === 'strength' && session.purpose && !PURPOSE_IS_LOWER[session.purpose])),
    JSON.stringify(week.days.map(day => [day.dayOfWeek, day.purpose])));
}

const total = passed + failures.length;
console.log(`\nWeekly scheduler: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
