/** POWER TRACE — where does authorised power disappear? One eligible world. */
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { weeklyScheduler } from '../src/rules/weeklyScheduler';
import { powerRows, budgetedPowerSession } from '../src/rules/sessionRowCounting';

const profile: any = {
  trainingLocation: 'Commercial gym', equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average', gameDay: 'Saturday',
  seasonPhase: process.env.PHASE || 'In-season', trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday','Tuesday','Thursday','Friday'],
  equipment: ['Full Gym'], teamTrainingDays: [],
};
const p: any = generateProgramLocally(profile, { todayISO:'2026-07-13', blockNumber:1, microcycleLimit:1 } as never);
const mc = p.microcycles[0];
const c = mc.exposureContractV2;
console.log('[1] SCHEDULER/CONTRACT AUTHORISATION');
console.log('    power.eligible                    =', c?.power?.eligible);
console.log('    power.plannerSelectedWeeklyBudget =', c?.power?.plannerSelectedWeeklyBudget);
console.log('    power.achievedPrimerCount         =', c?.power?.achievedPrimerCount);
console.log('    power.removalReason               =', c?.power?.removalReason);
console.log('    prohibitedPower (safety)          =', c?.safety?.prohibitedPower);
console.log('[4] PRE-S18 AUTHORED WEEK (as returned)');
for (const w of mc.workouts) {
  const pr = powerRows(w);
  console.log(`    day ${w.dayOfWeek} ${String(w.name).slice(0,34).padEnd(34)} rows=${(w.exercises??[]).length} powerRows=${pr.length} budgeted=${budgetedPowerSession(w)}`);
}
const roles = new Set<string>();
for (const w of mc.workouts) for (const r of (w.exercises??[])) roles.add(String(r.role));
console.log('    distinct row roles present        =', [...roles].sort().join(','));
