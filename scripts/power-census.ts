/** POWER CENSUS — authorised vs delivered, with typed reasons, over the real grid. */
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { powerRows, budgetedPowerSession } from '../src/rules/sessionRowCounting';
const BASE = { trainingLocation:'Commercial gym', equipmentSelectionCompleteness:'complete',
  recentTrainingLoad:'Pretty consistent', conditioningLevel:'Average', gameDay:'Saturday' };
const DAYS: Record<number,string[]> = { 2:['Tuesday','Thursday'], 3:['Monday','Wednesday','Friday'],
  4:['Monday','Tuesday','Thursday','Friday'], 5:['Monday','Tuesday','Wednesday','Thursday','Friday'],
  6:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] };
const KITS = [['Full Gym'],['Bodyweight Only'],['Dumbbells','Bands']];
let worlds=0, built=0, refused=0, authorised=0, receiving=0, rowsDelivered=0, sessionsTotal=0;
const setups = new Set<string>();
const undelivered: Record<string,number> = {};
for (const seasonPhase of ['In-season','Pre-season','Off-season'])
for (const d of [2,3,4,5,6]) for (const club of [true,false]) for (const equipment of KITS)
for (const week of [1,2]) {
  worlds++;
  const preferred = DAYS[d];
  setups.add(`${seasonPhase}/${d}/${club}/${equipment[0]}`);
  const profile:any = { ...BASE, seasonPhase, trainingDaysPerWeek:d, preferredTrainingDays:preferred,
    equipment, teamTrainingDays: club ? ['Tuesday','Thursday'].filter(x=>preferred.includes(x)) : [] };
  let p:any; try { p = generateProgramLocally(profile, { todayISO:'2026-07-13', blockNumber:1, microcycleLimit:week } as never); }
  catch { refused++; continue; }
  built++;
  const mc = p?.microcycles?.[week-1]; const w = mc?.workouts ?? [];
  sessionsTotal += w.filter((x:any)=>(x.exercises??[]).length>0).length;
  const c = mc?.exposureContractV2;
  const budget = c?.power?.plannerSelectedWeeklyBudget ?? 0;
  const eligible = c?.power?.eligible === true;
  const rows = w.reduce((n:number,x:any)=>n+powerRows(x).length,0);
  rowsDelivered += rows;
  if (eligible && budget > 0) {
    authorised++;
    if (rows > 0) receiving++;
    else { const r = String(c?.power?.removalReason ?? 'undelivered_no_typed_reason'); undelivered[r]=(undelivered[r]??0)+1; }
  }
  const sessions = w.filter(budgetedPowerSession).length;
  if (budget > 0 && sessions > budget) { undelivered['OVER_BUDGET']=(undelivered['OVER_BUDGET']??0)+1; }
}
console.log('distinct generated worlds      :', worlds);
console.log('distinct athlete setups        :', setups.size);
console.log('built / refused                :', built, '/', refused);
console.log('total delivered sessions       :', sessionsTotal);
console.log('worlds AUTHORISED for power    :', authorised);
console.log('worlds RECEIVING power         :', receiving);
console.log('power rows delivered           :', rowsDelivered);
console.log('authorised-but-undelivered     :', JSON.stringify(undelivered));
