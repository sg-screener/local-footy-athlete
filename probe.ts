import { buildCoachingPlan } from './src/utils/coachingEngine';

const inputs: any = {
  seasonPhase: 'In-season',
  gameDay: 'Saturday',
  hasGame: true,
  selectedDays: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
  availableDays: 5,
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday','Thursday'],
  readiness: 'medium',
};
const plan = buildCoachingPlan(inputs);
console.log('\n=== RESULT ===');
plan.weeklyPlan.forEach((s: any) => console.log(s.dayOfWeek, '| tier=' + s.tier, '| isTeamDay=' + !!s.isTeamDay, '| focus=' + s.focus.slice(0,80)));
