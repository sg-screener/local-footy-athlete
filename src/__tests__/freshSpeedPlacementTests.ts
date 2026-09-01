/** R-330: automatic Speed uses the earliest genuinely fresh legal receiver. */
import {
  scheduleRefused,
  scheduleWeek,
  selectFreshSpeedDay,
  type SpeedPlacementCandidate,
  type WeeklySchedule,
  type WeeklySchedulerInputs,
} from '../rules/weeklyScheduler';
import { PURPOSE_IS_LOWER } from '../rules/weeklyProgrammingContract';
import { materialiseAuthoredSessions } from '../rules/materialiseAuthoredSessions';

const MON = 1; const TUE = 2; const WED = 3; const THU = 4;
const FRI = 5; const SAT = 6; const SUN = 0;
let passed = 0; const failures: string[] = [];
function ok(name: string, condition: unknown, detail = ''): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name); console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}
function base(over: Partial<WeeklySchedulerInputs> = {}): WeeklySchedulerInputs {
  return {
    weekStartISO: '2026-07-13', phase: 'Off-season', offseasonBlock: 'normal_build',
    gymAccessDays: [MON, WED, THU, SAT], clubNights: [], gameDay: null,
    fixtureRecurrence: 'recurring', age: 30, unavailableDays: [],
    readiness: { lowReadiness: false, highReadiness: false, lowFatigue: false,
      consistentlyCompletesThree: false }, ...over,
  };
}
function built(over: Partial<WeeklySchedulerInputs> = {}): WeeklySchedule {
  const result = scheduleWeek(base(over));
  if (scheduleRefused(result)) throw Error(JSON.stringify(result));
  return result;
}
const speedDay = (week: WeeklySchedule) => week.days.find((day) =>
  day.conditioning === 'sprint_high_speed' || day.sprintComponent)?.dayOfWeek ?? null;
const candidates = (...rows: Array<[number, SpeedPlacementCandidate['role']]>): SpeedPlacementCandidate[] =>
  rows.map(([dayOfWeek, role]) => ({ dayOfWeek, role }));
const selected = (input: WeeklySchedulerInputs, rows: SpeedPlacementCandidate[],
  heavyLowerDays: number[] = [], hardConditioningDays: number[] = []) =>
  selectFreshSpeedDay({ inputs: input, candidates: rows, heavyLowerDays, hardConditioningDays });

const earlyUpper = built();
ok('1 earliest fresh upper-body day is selected', speedDay(earlyUpper) === WED,
  JSON.stringify(earlyUpper.days.map(d => [d.dayOfWeek, d.purpose, d.sprintComponent, d.conditioning])));
ok('2 placement no longer defaults to the last upper-body day',
  speedDay(earlyUpper) === WED && earlyUpper.days.some(d => d.dayOfWeek === SAT
    && d.purpose !== null && !PURPOSE_IS_LOWER[d.purpose]), JSON.stringify(speedDay(earlyUpper)));

const saturdayGame = base({ phase: 'In-season', offseasonBlock: null, gameDay: SAT });
ok('3 G+2 loses to a later fresh legal day',
  selected(saturdayGame, candidates([MON, 'upper_strength'], [TUE, 'standalone'])) === TUE);
ok('4 G+2 remains available when it is the only legal option',
  selected({ ...saturdayGame, unavailableDays: [TUE, WED, THU, FRI, SUN] },
    candidates([MON, 'upper_strength'], [TUE, 'standalone'])) === MON);
ok('5 G+1, G-2, G-1 and game day remain prohibited',
  selected(saturdayGame, candidates([SUN, 'upper_strength'], [THU, 'upper_strength'],
    [FRI, 'standalone'], [SAT, 'standalone'])) === null);
ok('6 a day after heavy lower strength loses to a fresh alternative',
  selected(base(), candidates([TUE, 'upper_strength'], [WED, 'standalone']), [MON]) === WED);
ok('7 a day after hard conditioning loses to a fresh alternative',
  selected(base(), candidates([TUE, 'upper_strength'], [WED, 'standalone']), [], [MON]) === WED);
ok('8 a day after team training loses to a fresh alternative',
  selected(base({ clubNights: [MON] }),
    candidates([TUE, 'upper_strength'], [WED, 'standalone'])) === WED);

const materialised = materialiseAuthoredSessions({ schedule: earlyUpper, gameDay: null,
  facts: { weekStartISO: earlyUpper.weekStartISO, phase: 'Off-season', capacity: 'high',
    isBeginner: false, experienced: true, powerGoalNudge: false, injuries: [] } });
const combined = materialised.find(day => day.dayOfWeek === speedDay(earlyUpper));
ok('9 combined session retains a separately typed first Speed component',
  combined?.owner === 'strength' && combined.sprintTemplate !== null
    && earlyUpper.days.find(day => day.dayOfWeek === combined.dayOfWeek)?.sprintComponent === true,
  JSON.stringify(combined));

const pre = built({ phase: 'Pre-season', offseasonBlock: null,
  gymAccessDays: [MON, WED, THU, SAT] });
const preSpeed = speedDay(pre);
const preHard = pre.days.find(day => day.conditioningCategory === 'vo2'
  || day.conditioningCategory === 'glycolytic')?.dayOfWeek ?? null;
ok('10 hard conditioning uses a later day without increasing the exposure count',
  preSpeed !== null && preHard !== null
    && [MON, TUE, WED, THU, FRI, SAT, SUN].indexOf(preHard)
      > [MON, TUE, WED, THU, FRI, SAT, SUN].indexOf(preSpeed)
    && pre.demand.coreConditioning === 4,
  JSON.stringify({ preSpeed, preHard, demand: pre.demand }));

const delivered = built({ deliveredEnergySystemDays: [{ dayOfWeek: TUE,
  appProgrammed: false, anchorConditioning: true, sprintHighSpeed: true }] });
ok('11 a delivered team/game Speed quality prevents a duplicate app Speed exposure',
  speedDay(delivered) === null && delivered.demand.sprintHighSpeed >= 1,
  JSON.stringify(delivered.days.map(d => [d.dayOfWeek, d.conditioning, d.sprintComponent])));

const deload = built({ weekKind: 'deload' });
const low = built({ readiness: { ...base().readiness, lowReadiness: true } });
ok('12 deload and low-readiness weeks retain reduced hard work',
  !deload.days.some(d => d.conditioningCategory === 'vo2' || d.conditioningCategory === 'glycolytic')
  && !low.days.some(d => d.conditioningCategory === 'vo2' || d.conditioningCategory === 'glycolytic'));

const onlyLegal = base({ phase: 'In-season', offseasonBlock: null, gameDay: SAT,
  unavailableDays: [MON, TUE, THU, FRI, SUN] });
ok('13 if only one legal day exists the selector uses it',
  selected(onlyLegal, candidates([MON, 'upper_strength'], [WED, 'standalone'])) === WED);

const ordered = candidates([MON, 'upper_strength'], [TUE, 'standalone'], [WED, 'upper_strength']);
ok('15 reversing candidate enumeration cannot change the chosen day',
  selected(base(), ordered) === selected(base(), [...ordered].reverse()));

console.log(`\nFresh Speed placement: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
