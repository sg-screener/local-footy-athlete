// Ad-hoc demo file — DO NOT add to package.json test scripts.
// Captures the AFTER state for the canonical hammy 6/10 case (Wed Recovery
// + Thu Team Training + Fri Upper Push). Safe to delete.
import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay } from '../utils/sessionResolver';

const FIXED_TODAY = '2026-04-29';
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

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

(sessionResolver as any).resolveWeekWithConditioning = (): ResolvedDay[] => {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    let workout: any = null;
    if (dow === 3) {
      workout = { id:'r', name:'Recovery Session', workoutType:'Recovery', sessionTier:'recovery', exercises: [] };
    } else if (dow === 4) {
      workout = { id:'t', name:'Team Training', workoutType:'Team Training', sessionTier:'core', exercises: [] };
    } else if (dow === 5) {
      workout = { id:'u', name:'Upper Push', workoutType:'Strength', sessionTier:'core', exercises: [
        { exercise: { name: 'Bench Press' } }, { exercise: { name: 'Overhead Press' } }
      ]};
    }
    out.push({ date, dayOfWeek:dow, short:SHORT[dow], isToday: date===FIXED_TODAY, workout, source:'template', indicator:null } as any);
  }
  return out;
};

import { applyProgramAdjustment } from '../utils/programAdjustmentEngine';

const result = applyProgramAdjustment(
  { intent:'injury', todayISO: FIXED_TODAY, payload:{ bodyPart:'hammy', severity: 6 }, source:'client_guard' } as any,
  {} as any,
);

console.log('--- HAMMY 6/10 (Wed Recovery + Thu Team Training + Fri Upper Push) ---');
console.log('applied:', result.applied);
console.log('events:');
for (const ev of result.events) {
  console.log(`  ${ev.kind} @ ${ev.date}: ${ev.before ?? '-'} -> ${ev.after ?? '-'}  // ${ev.reason}`);
}
console.log('\nreply:');
console.log(result.reply);
