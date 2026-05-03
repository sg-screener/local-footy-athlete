// Ad-hoc demo file — DO NOT add to package.json test scripts. Kept only
// to avoid pollution; produced the before/after output documented in the
// PR description for the unknown-body-part injury fix. Safe to delete.
import { extractInjuryContext } from '../utils/injuryAdjustmentEngine';
import { applyProgramAdjustment } from '../utils/programAdjustmentEngine';
import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay } from '../utils/sessionResolver';

const FIXED_TODAY = '2026-04-29';
const FIXED_MONDAY = '2026-04-27';

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

const SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

(sessionResolver as any).resolveWeekWithConditioning = (): ResolvedDay[] => {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    let workout: any = null;
    if (dow === 4) { // Thu
      workout = { id:'w', name: 'Lower Strength', exercises: [{exercise: {name: 'Goblet Squat'}}], workoutType:'Strength' };
    } else if (dow === 5) { // Fri
      workout = { id:'w', name: 'Upper Strength', exercises: [{exercise: {name: 'Bench Press'}}], workoutType:'Strength' };
    }
    out.push({ date, dayOfWeek:dow, short:SHORT[dow], isToday: date===FIXED_TODAY, workout, source:'template', indicator:null } as any);
  }
  return out;
};

const cases = [
  'Tweaked my hammy 6/10',
  'hammy cooked 6/10',
  'feels off 6/10',
  'I feel sore 6/10',
  'feels off 8/10',
  'feels off 4/10',
  'hammy hurts',
];

for (const msg of cases) {
  const ctx = extractInjuryContext(msg);
  console.log(`\n--- "${msg}" ---`);
  console.log('extractInjuryContext:', ctx);
  if (!ctx) { console.log('SKIPPED — no severity'); continue; }
  const res = applyProgramAdjustment(
    { intent:'injury', todayISO:FIXED_TODAY, payload:{ bodyPart: ctx.bodyPart, severity: ctx.severity }, source:'client_guard' },
    {} as any,
  );
  console.log('applied:', res.applied, '| events:', res.events.length);
  console.log('reply:');
  console.log(res.reply.split('\n').map(l => '  ' + l).join('\n'));
}
