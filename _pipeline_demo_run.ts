// Pipeline log demo with visible_diff_detected + coach_update.
import * as sessionResolver from './src/utils/sessionResolver';
import { useProgramStore } from './src/store/programStore';
import { useCoachUpdatesStore } from './src/store/coachUpdatesStore';
import { applyAdjustmentEvents } from './src/utils/applyAdjustmentEvents';
import { applyProgramAdjustment, buildInjuryPolicy, resolveInjuryBucket, eventToBullet } from './src/utils/programAdjustmentEngine';
import { snapshotVisibleWorkout, computeVisibleDiff } from './src/utils/visibleWorkoutDiff';

const FIXED_TODAY = '2026-04-29';
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0); dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

(sessionResolver as any).resolveWeekWithConditioning = (monday: string, state: any) => {
  const out: any[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const dow = isoToDow(date);
    const override = state.manualOverrides?.[date];
    let wk: any = null;
    if (dow === 4) wk = { id:'t', microcycleId:'mc', dayOfWeek: 4, name:'Team Training', description:'', durationMinutes:60, intensity:'Moderate', workoutType:'Team Training', sessionTier:'core', exercises:[], createdAt:'2026-01-01', updatedAt:'2026-01-01' };
    out.push({ date, dayOfWeek:dow, short:SHORT[dow], isToday: date===FIXED_TODAY, workout: override ?? wk, source: override ? 'manual' : (wk ? 'template' : 'rest'), indicator: null });
  }
  return out;
};

function buildState() {
  return {
    currentProgram: null, currentMicrocycle: null,
    manualOverrides: useProgramStore.getState().dateOverrides || {},
    markedDays: {}, athleteContext: {}, seasonPhase: null, readiness: 'medium',
  };
}

console.log('=== HAMMY 6/10 PIPELINE — visible_diff + coach_update ===');

// BEFORE snapshot
const monday = FIXED_MONDAY;
const beforeWeek = (sessionResolver as any).resolveWeekWithConditioning(monday, buildState());
const beforeByDate: any = {};
for (const d of beforeWeek) beforeByDate[d.date] = snapshotVisibleWorkout(d.workout);

const result = applyProgramAdjustment(
  { intent:'injury', todayISO: FIXED_TODAY, payload:{ bodyPart:'hammy', severity: 6 }, source:'client_guard' } as any,
  buildState() as any,
);
console.log('[pipeline] uae result', { applied: result.applied, eventCount: result.events.length });

const apply = applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState } as any);

// AFTER snapshot
const afterWeek = (sessionResolver as any).resolveWeekWithConditioning(monday, buildState());
const afterByDate: any = {};
for (const d of afterWeek) afterByDate[d.date] = snapshotVisibleWorkout(d.workout);

const datesToCheck = Array.from(new Set([
  ...apply.applied.map((a) => a.date),
  ...result.events.map((e) => e.date),
]));
const diff = computeVisibleDiff(datesToCheck, beforeByDate, afterByDate);
const visibleDiffDetected = diff.length > 0;

console.log('[pipeline] visible_diff_detected:', visibleDiffDetected, {
  changedDates: diff.map((v) => `${v.date}[${v.changedFields.join(',')}]`),
});

if (apply.applied.length > 0 && visibleDiffDetected) {
  const cardBucket = resolveInjuryBucket('hammy');
  const policy = buildInjuryPolicy(cardBucket, 6);
  const update = useCoachUpdatesStore.getState().upsertCoachUpdate(monday, {
    source: 'uae',
    reason: 'Hammy pain — 6/10',
    rules: [...policy.globalRules],
    changes: result.events.map(eventToBullet),
  });
  console.log('[pipeline] coach_update written', {
    weekStartISO: update.weekStartISO,
    reason: update.reason,
    ruleCount: update.rules.length,
    changeCount: update.changes.length,
    rules: update.rules,
    changes: update.changes,
  });
}
console.log('=== END ===');
process.exit(0);
