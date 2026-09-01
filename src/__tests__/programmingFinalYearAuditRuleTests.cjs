'use strict';

const assert = require('node:assert/strict');
const {
  ACCEPTED_AWAY_SPAN,
  ACCEPTED_CHRISTMAS_BREAK,
  acceptedProgrammingInputFindings,
  expectedTeamTrainingWeekdays,
  fixturePlacementFindings,
  fullEquipmentTravelRestoreFindings,
  genderedOptionalFixtureFindings,
  teamTrainingAnchorFindings,
} = require('../../scripts/programming-final-year-audit-rules.cjs');

let passed = 0;
let failed = 0;
function run(name, test) {
  try {
    test();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const fullTags = ['rack', 'barbell', 'trap_bar', 'medicine_ball', 'back_extension_bench'];
const fullModalities = ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'];
const day = (date, extra = {}) => ({ date, ...extra });
const week = (number, start, phase, days, extra = {}) => ({
  number,
  start,
  phase,
  acceptedProgrammingInputs: {
    preferredTrainingDays: phase === 'In-season'
      ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDays: phase === 'Pre-season' ? ['Monday', 'Wednesday']
      : phase === 'In-season' ? ['Tuesday', 'Thursday'] : [],
    usualGameDay: phase === 'In-season' ? 'Saturday' : null,
  },
  days,
  ...extra,
});

run('accepted team schedules are Pre-season Monday/Wednesday and In-season Tuesday/Thursday', () => {
  assert.deepEqual(expectedTeamTrainingWeekdays('Pre-season'), ['Monday', 'Wednesday']);
  assert.deepEqual(expectedTeamTrainingWeekdays('In-season'), ['Tuesday', 'Thursday']);
  assert.deepEqual(expectedTeamTrainingWeekdays('Off-season'), []);
});

run('accepted programming inputs reject the old all-year Tuesday/Thursday assumption', () => {
  const correct = week(8, '2026-11-16', 'Pre-season', []);
  assert.deepEqual(acceptedProgrammingInputFindings([correct]), []);
  const stale = { ...correct, acceptedProgrammingInputs: {
    ...correct.acceptedProgrammingInputs, teamTrainingDays: ['Tuesday', 'Thursday'],
  } };
  assert.equal(acceptedProgrammingInputFindings([stale]).length, 1);
});

run('team anchors follow both phase schedules and the accepted Christmas break', () => {
  const weeks = [
    week(8, '2026-11-16', 'Pre-season', [
      day('2026-11-16', { type: 'Team Training' }),
      day('2026-11-18', { parts: [{ kind: 'team_training' }] }),
    ]),
    week(13, '2026-12-21', 'Pre-season', [
      day('2026-12-21'), day('2026-12-23'),
    ]),
    week(15, '2027-01-04', 'Pre-season', [
      day('2027-01-04'), day('2027-01-06'),
    ]),
    week(16, '2027-01-11', 'Pre-season', [
      day('2027-01-11'), day('2027-01-13', { type: 'Team Training' }),
    ]),
    week(29, '2027-04-12', 'In-season', [
      day('2027-04-13', { type: 'Team Training' }),
      day('2027-04-15', { parts: [{ kind: 'team_training' }] }),
    ]),
  ];
  assert.deepEqual(teamTrainingAnchorFindings(weeks), []);
  const staleChristmas = weeks.map((item) => item.number === 13
    ? { ...item, days: [...item.days, day('2026-12-23', { type: 'Team Training' })] }
    : item);
  assert.equal(teamTrainingAnchorFindings(staleChristmas).length, 1);
  assert.deepEqual(ACCEPTED_CHRISTMAS_BREAK,
    { from: '2026-12-19', until: '2027-01-11' });
});

run('Going Away is 28 December through 1 January and normal kit returns 2 January', () => {
  const restrictedTags = ['bodyweight', 'dumbbells', 'bands', 'bench'];
  const dates = ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01'];
  const days = dates.map((date) => day(date, { resolvedEquipment: {
    tags: restrictedTags, conditioningModalities: [],
  } }));
  days.push(day('2027-01-02', { resolvedEquipment: {
    tags: ['bodyweight', ...fullTags], conditioningModalities: fullModalities,
  } }));
  assert.deepEqual(fullEquipmentTravelRestoreFindings(days, fullTags, fullModalities), []);
  const stale = days.map((item) => item.date === '2027-01-02'
    ? day(item.date, { resolvedEquipment: { tags: restrictedTags, conditioningModalities: [] } })
    : item);
  assert.equal(fullEquipmentTravelRestoreFindings(stale, fullTags, fullModalities).length, 1);
  assert.deepEqual(ACCEPTED_AWAY_SPAN,
    { from: '2026-12-28', until: '2027-01-01', restoredOn: '2027-01-02' });
});

run('two accepted fixtures in one week are legal and each must occupy its accepted date', () => {
  const multi = week(30, '2027-04-19', 'In-season', [
    day('2027-04-23', { kind: 'game' }),
    day('2027-04-24', { kind: 'game' }),
  ], { acceptedFixtures: [
    { date: '2027-04-23', kind: 'game' },
    { date: '2027-04-24', kind: 'game' },
  ] });
  assert.deepEqual(fixturePlacementFindings([multi]), []);
  const missing = { ...multi, days: [day('2027-04-24', { kind: 'game' })] };
  assert.equal(fixturePlacementFindings([missing]).length, 1);
});

run('a gendered optional session may key off one accepted fixture in a multi-fixture week', () => {
  const multi = week(30, '2027-04-19', 'In-season', [
    day('2027-04-22', { name: 'Gunshow' }),
    day('2027-04-23', { kind: 'game' }),
    day('2027-04-24', { kind: 'game' }),
  ], { acceptedFixtures: [
    { date: '2027-04-23', kind: 'game' },
    { date: '2027-04-24', kind: 'game' },
  ] });
  assert.deepEqual(genderedOptionalFixtureFindings([multi], 'male'), []);
});

console.log(`\nProgramming final-year audit rules: passed=${passed}/6 failures=${failed}`);
if (failed) process.exitCode = 1;

