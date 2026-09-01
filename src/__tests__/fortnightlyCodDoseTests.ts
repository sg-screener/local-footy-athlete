/**
 * Sam's 2026-09-02 COD ruling:
 * - team training is already the athlete's COD exposure;
 * - when team training is absent, add one SMALL app-authored COD dose every
 *   second week in late off-season and during the Christmas shutdown;
 * - exchange an existing conditioning component rather than adding a day.
 */
import { canonicalWeeklyAvailabilityStateFrom,
  schedulerInputsWithAvailabilityState } from '../rules/canonicalWeeklyAvailabilityState';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { materialiseAuthoredSessions } from '../rules/materialiseAuthoredSessions';
import { combinedConditioningMustBeOffFeet,
  composeConditioningRows } from '../rules/conditioningSelection';
import { scheduleRefused, scheduleWeek,
  type WeeklySchedule, type WeeklySchedulerInputs } from '../rules/weeklyScheduler';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}

const base = (over: Partial<WeeklySchedulerInputs> = {}): WeeklySchedulerInputs => ({
  weekStartISO: '2026-12-21',
  phase: 'Off-season',
  offseasonBlock: 'normal_build',
  phaseWeekNumber: 5,
  christmasBreakWeekNumber: null,
  gymAccessDays: [1, 2, 4, 5],
  clubNights: [],
  gameDays: [],
  gameDay: null,
  fixtureRecurrence: 'recurring',
  age: 24,
  readiness: { lowReadiness: false, highReadiness: false,
    lowFatigue: false, consistentlyCompletesThree: false },
  unavailableDays: [],
  ...over,
});

function built(over: Partial<WeeklySchedulerInputs> = {}): WeeklySchedule {
  const result = scheduleWeek(base(over));
  if (scheduleRefused(result)) throw new Error(`${result.finding}: ${result.detail}`);
  return result;
}

const codDays = (week: WeeklySchedule) => week.days.filter(day =>
  day.conditioningCategory === 'cod_decel');
const authoredWorkDays = (week: WeeklySchedule) => week.days.filter(day =>
  day.owner !== 'rest_or_recovery' && day.owner !== 'club' && day.owner !== 'game').length;

console.log('\n[fortnightly COD dose]');

const lateWeekFive = built();
const lateWeekSix = built({ phaseWeekNumber: 6 });
const lateWeekSeven = built({ phaseWeekNumber: 7 });
ok('late off-season starts with one COD dose in phase week 5',
  codDays(lateWeekFive).length === 1, codDays(lateWeekFive));
ok('late off-season skips phase week 6', codDays(lateWeekSix).length === 0,
  lateWeekSix.days.map(day => day.conditioningCategory));
ok('late off-season returns in phase week 7', codDays(lateWeekSeven).length === 1,
  codDays(lateWeekSeven));
ok('the COD dose replaces conditioning and never adds a work day',
  authoredWorkDays(lateWeekFive) === authoredWorkDays(lateWeekSix)
    && lateWeekFive.demand.coreConditioning === lateWeekSix.demand.coreConditioning,
  { due: authoredWorkDays(lateWeekFive), control: authoredWorkDays(lateWeekSix) });
ok('team training supplies COD, so the app adds none',
  codDays(built({ clubNights: [2], phaseWeekNumber: 5 })).length === 0);
ok('early and mid off-season never receive the automatic COD dose',
  codDays(built({ offseasonBlock: 'early_optional', phaseWeekNumber: 1 })).length === 0
    && codDays(built({ offseasonBlock: 'transition', phaseWeekNumber: 3 })).length === 0);

const christmasOne = built({ phase: 'Pre-season', offseasonBlock: null,
  phaseWeekNumber: 4, christmasBreakWeekNumber: 1 });
const christmasTwo = built({ phase: 'Pre-season', offseasonBlock: null,
  phaseWeekNumber: 5, christmasBreakWeekNumber: 2 });
const ordinaryClublessPreseason = built({ phase: 'Pre-season', offseasonBlock: null,
  phaseWeekNumber: 4, christmasBreakWeekNumber: null });
ok('Christmas shutdown week 1 receives one COD dose', codDays(christmasOne).length === 1,
  codDays(christmasOne));
ok('Christmas shutdown week 2 is the fortnightly gap', codDays(christmasTwo).length === 0,
  christmasTwo.days.map(day => day.conditioningCategory));
ok('an ordinary clubless pre-season week is not mistaken for Christmas',
  codDays(ordinaryClublessPreseason).length === 0);
ok('in-season never receives this automatic COD dose',
  codDays(built({ phase: 'In-season', offseasonBlock: null,
    phaseWeekNumber: 10, christmasBreakWeekNumber: null })).length === 0);

const materialised = materialiseAuthoredSessions({
  schedule: lateWeekFive,
  facts: {
    weekStartISO: lateWeekFive.weekStartISO,
    phaseWeekNumber: 5,
    capacity: 'medium',
    isBeginner: false,
    experienced: true,
    powerGoalNudge: false,
    injuries: [],
    availableMachines: [],
    runOnly: true,
    phase: 'Off-season',
    offseasonSubphase: 'late_offseason',
  },
  gameDay: null,
});
ok('the fortnightly dose resolves to the one Change of Direction session',
  materialised.some(session => session.conditioningTemplate?.name
    === 'Change of Direction'),
  materialised.map(session => session.conditioningTemplate?.name ?? null));

const codTemplates = CONDITIONING_TEMPLATES.filter(template => template.quality === 'cod_decel');
ok('the catalogue contains one programmable COD identity',
  codTemplates.length === 1 && codTemplates[0]?.name === 'Change of Direction',
  codTemplates.map(template => template.name));
ok('retired individual COD sessions cannot be selected or programmed',
  ['Low-Intensity Deceleration Drills', '45-Degree Cut Reps', 'Up-Back Shuttle',
    'Deceleration and Landing Work'].every(name =>
    CONDITIONING_TEMPLATES.every(template => template.name !== name)));

const codRows = codTemplates[0]
  ? composeConditioningRows(codTemplates[0], '2026-10-27') : [];
ok('Change of Direction renders the Speed warm-up then three ordered work sections',
  codRows.map(row => row.exercise.name).join(' | ') === [
    'Warm-up',
    'Low-Intensity Deceleration Drills',
    '45-Degree Cut Reps',
    'Up-Back Shuttle',
  ].join(' | '), codRows.map(row => row.exercise.name));
ok('the three sections preserve Sam\'s exact work, recovery, amount, effort and cues',
  codRows.slice(1).map(row => row.notes).join('\n---\n') === [
    'Work: 20 m build-up + 3 m controlled stop\nRecovery: Start every 30 s\nReps: 10 reps\nIntensity: 4/10\nLower your body and stop under control.',
    'Work: 10 m approach + cut + 10 m exit\nRecovery: Start every 60 s\nReps: 5 reps per side\nIntensity: 10/10\nKeep your plant foot underneath you.',
    'Work: 30 m out + 30 m back\nRecovery: Start every 60 s\nReps: 15 reps\nIntensity: 7/10\nPlant cleanly and accelerate out of the turn.',
  ].join('\n---\n'), codRows.slice(1).map(row => row.notes));
ok('the combined COD session is an explicit on-feet exception on lower-body days',
  combinedConditioningMustBeOffFeet({
    category: 'cod_decel', strengthRegion: 'lower', hasAvailableMachine: true,
  }) === false);

const profile = {
  teamTrainingStopsOverChristmas: true,
  christmasLastTeamTrainingDate: '2026-12-18',
  christmasTeamTrainingReturnDate: '2027-01-12',
  equipment: ['Bodyweight Only'],
  equipmentSelectionCompleteness: 'complete',
  equipmentAnswer: null,
};
const firstBreakWeek = canonicalWeeklyAvailabilityStateFrom({
  profile: profile as never, weekStartISO: '2026-12-21', activeConstraints: [],
});
const secondBreakWeek = canonicalWeeklyAvailabilityStateFrom({
  profile: profile as never, weekStartISO: '2026-12-28', activeConstraints: [],
});
ok('the accepted Christmas dates provide stable break week numbers',
  firstBreakWeek.christmasBreakWeekNumber === 1
    && secondBreakWeek.christmasBreakWeekNumber === 2,
  [firstBreakWeek.christmasBreakWeekNumber, secondBreakWeek.christmasBreakWeekNumber]);

const travelOnly = canonicalWeeklyAvailabilityStateFrom({
  profile: { ...profile, teamTrainingStopsOverChristmas: false } as never,
  weekStartISO: '2026-12-21',
  activeConstraints: [{ id: 'travel', type: 'schedule', severity: 5, status: 'active',
    startDate: '2026-12-21', expiresAt: '2027-01-03', lastUpdatedAt: '2026-12-21',
    scheduleKind: 'travel', rules: [], safeFocus: [], advice: [] }] as never,
});
ok('travel can close team training but is never labelled Christmas',
  travelOnly.clubClosedDayNumbers.length > 0
    && travelOnly.christmasBreakWeekNumber === null,
  travelOnly);

const projected = schedulerInputsWithAvailabilityState(base({
  phase: 'Pre-season', offseasonBlock: null, phaseWeekNumber: 4,
  clubNights: [1, 3], christmasBreakWeekNumber: null,
}), firstBreakWeek);
ok('the canonical availability handover carries the Christmas week number',
  projected.clubNights.length === 0 && projected.christmasBreakWeekNumber === 1,
  projected);

console.log(`\n${passed}/${passed + failures.length} fortnightly COD cells passed`);
if (failures.length > 0) process.exitCode = 1;
