import assert from 'node:assert/strict';
import { scheduleWeek, scheduleRefused, selectFreshSpeedDay, type WeeklySchedulerInputs } from '../rules/weeklyScheduler';
const base: WeeklySchedulerInputs = {
  weekStartISO: '2027-03-15', phase: 'Pre-season', offseasonBlock: null,
  gymAccessDays: [1,3,5], clubNights: [1,3], gameDay: null, gameDays: [],
  fixtureRecurrence: 'recurring', age: 24, athleteGender: 'female',
  unavailableDays: [], offLegAvailableDays: [1,3,5], phaseWeekNumber: 18,
  miniCycleNumber: 6, sprintExposure: '2+ times per week',
  readiness: {lowReadiness:false, highReadiness:false, lowFatigue:false, consistentlyCompletesThree:false},
};
const candidates = [{dayOfWeek:6,role:'standalone' as const},{dayOfWeek:0,role:'standalone' as const}];
const withSets = (sets: number) => ({...base, lowerBodyWorkloadByDay: {5:{workingSets:sets, unknown:false}}});
for (const sets of [0,6,9]) assert.equal(selectFreshSpeedDay({inputs:withSets(sets),candidates,heavyLowerDays:[5]}),6, `normal dose ${sets}: Saturday remains fresh`);
assert.equal(selectFreshSpeedDay({inputs:withSets(10),candidates,heavyLowerDays:[]}),0,'ten sets is a soft preference');
assert.equal(selectFreshSpeedDay({inputs:{...withSets(14),unavailableDays:[0]},candidates}),6,'high volume does not ban the only legal day');
const result = scheduleWeek({...withSets(6), retainedMetabolicCategoriesByDay:{5:'aerobic_base'}});
assert.ok(!scheduleRefused(result));
if (scheduleRefused(result)) throw Error(JSON.stringify(result));
const speed = result.days.filter(day => day.sprintComponent || day.conditioning === 'sprint_high_speed');
assert.deepEqual(speed.map(day=>day.dayOfWeek),[6],'three-day club athlete gets Saturday Speed');
assert.ok(result.days.some(day=>day.dayOfWeek===5 && day.owner==='strength' && day.conditioning !== null && !day.sprintComponent),'Friday retains lifting and metabolic work');
assert.equal(result.demand.coreConditioning,4,'two club + Speed + metabolic');
assert.equal(result.days.find(day=>day.dayOfWeek===0)?.owner,'rest_or_recovery');
console.log('Saturday Speed placement: all dose, placement and weekly-budget checks passed');
