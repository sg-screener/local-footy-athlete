// Demo: hammy 6/10 → "better" → "pain gone" — show how the week evolves.
import * as sessionResolver from './src/utils/sessionResolver';
import { useProgramStore } from './src/store/programStore';
import { useCoachUpdatesStore, getActiveCoachUpdate } from './src/store/coachUpdatesStore';
import { applyAdjustmentEvents, removeInjuryOverridesForWeek } from './src/utils/applyAdjustmentEvents';
import { applyProgramAdjustment, buildInjuryPolicy, resolveInjuryBucket, eventToBullet } from './src/utils/programAdjustmentEngine';
import { classifyInjuryUpdate } from './src/utils/injuryProgression';

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
function ex(name: string, sets = 3): any {
  const id = `ex-${name.toLowerCase().replace(/[^a-z0-9]/g,'-')}`;
  return { id:`we-${id}`, workoutId:'', exerciseId:id, exerciseOrder:0, prescribedSets:sets, prescribedRepsMin:6, prescribedRepsMax:8, prescribedWeightKg:0, restSeconds:0, exercise:{ id, name, description:name, exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' }, createdAt:'', updatedAt:'' };
}

(sessionResolver as any).resolveWeekWithConditioning = (monday: string, state: any) => {
  const out: any[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const dow = isoToDow(date);
    const override = state.manualOverrides?.[date];
    let wk: any = null;
    if (dow === 4) wk = { id:'t', microcycleId:'mc', dayOfWeek:4, name:'Team Training', description:'', durationMinutes:60, intensity:'Moderate', workoutType:'Team Training', sessionTier:'core', exercises:[], createdAt:'', updatedAt:'' };
    if (dow === 5) wk = { id:'l', microcycleId:'mc', dayOfWeek:5, name:'Lower Strength', description:'', durationMinutes:60, intensity:'Moderate', workoutType:'Strength', sessionTier:'core', exercises:[ex('RDLs',4), ex('Goblet Squat',3)], createdAt:'', updatedAt:'' };
    out.push({ date, dayOfWeek:dow, short:SHORT[dow], isToday: date===FIXED_TODAY, workout: override ?? wk, source: override ? 'manual' : (wk ? 'template' : 'rest'), indicator: null });
  }
  return out;
};
(sessionResolver as any).getMondayStr = () => FIXED_MONDAY;

function buildState() {
  return { currentProgram: null, currentMicrocycle: null,
    manualOverrides: useProgramStore.getState().dateOverrides || {},
    markedDays: {}, athleteContext: {}, seasonPhase: null, readiness: 'medium' } as any;
}
function dumpWeek(label: string) {
  const week = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, buildState());
  console.log(`\n--- ${label} ---`);
  for (const d of week) {
    if (!d.workout) continue;
    const exNames = (d.workout.exercises || []).map((e: any) => e.exercise?.name).filter(Boolean);
    const notes = d.workout.coachNotes ?? [];
    console.log(`  ${d.short} (${d.date}) [${d.source}] ${d.workout.name}: ex=${JSON.stringify(exNames)} notes=${JSON.stringify(notes)}`);
  }
  const card = getActiveCoachUpdate(FIXED_MONDAY);
  console.log(`  CARD: ${card ? card.reason : '(none)'}`);
  const inj = useCoachUpdatesStore.getState().activeInjury;
  console.log(`  STATE: ${inj ? `${inj.bodyPart} ${inj.severity}/10 ${inj.status}` : '(none)'}`);
}

function seedInjury() {
  const result = applyProgramAdjustment(
    { intent:'injury', todayISO: FIXED_TODAY, payload:{ bodyPart:'hammy', severity:6 }, source:'client_guard' } as any,
    buildState(),
  );
  applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState });
  const cardBucket = resolveInjuryBucket('hammy');
  const policy = buildInjuryPolicy(cardBucket, 6);
  useCoachUpdatesStore.getState().upsertCoachUpdate(FIXED_MONDAY, {
    source: 'uae', reason: 'Hammy pain — 6/10', rules: [...policy.globalRules],
    changes: result.events.map(eventToBullet),
  });
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart:'hammy', bucket: cardBucket, severity:6, initialSeverity:6,
    status:'active', createdAt:nowISO, lastUpdatedAt:nowISO, history:[],
  });
}
function progress(msg: string) {
  const current = useCoachUpdatesStore.getState().activeInjury as any;
  const outcome = classifyInjuryUpdate(msg, current);
  removeInjuryOverridesForWeek(FIXED_MONDAY);
  if (outcome.kind === 'resolved') {
    useCoachUpdatesStore.getState().deactivateCoachUpdate(FIXED_MONDAY);
    useCoachUpdatesStore.getState().setActiveInjury(null);
    return;
  }
  if (outcome.kind === 'no_match' || outcome.kind === 'unchanged') return;
  const newSev = outcome.newSeverity;
  if (newSev < 5) {
    useCoachUpdatesStore.getState().deactivateCoachUpdate(FIXED_MONDAY);
  } else {
    const result = applyProgramAdjustment(
      { intent:'injury', todayISO: FIXED_TODAY, payload:{ bodyPart: current.bodyPart, severity: newSev }, source:'client_guard' } as any,
      buildState(),
    );
    applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState });
    const policy = buildInjuryPolicy(current.bucket, newSev);
    const trend = outcome.kind === 'improving' ? 'improving' : 'worse';
    useCoachUpdatesStore.getState().upsertCoachUpdate(FIXED_MONDAY, {
      source:'uae', reason:`Hammy ${trend} — ${newSev}/10`, rules:[...policy.globalRules],
      changes: result.events.map(eventToBullet),
    });
  }
  useCoachUpdatesStore.getState().transitionInjuryStatus({
    toStatus: outcome.kind === 'improving' ? 'improving' : 'active',
    severity: newSev, note: msg, timestamp: new Date().toISOString(),
  });
}

console.log('=== INJURY PROGRESSION DEMO ===');
useProgramStore.setState({ currentProgram: null, currentMicrocycle: null, dateOverrides: {}, overrideContexts: {}, sessionFeedback: {}, weightOverrides: {} } as any);
useCoachUpdatesStore.setState({ updatesByWeek: {}, activeInjury: null });
dumpWeek('STAGE 0 — template (no injury)');
seedInjury();
dumpWeek('STAGE 1 — hammy 6/10 reported');
progress('feeling better');
dumpWeek('STAGE 2 — "feeling better" → severity 4 (sub-threshold)');

// Reset and try worse path.
useProgramStore.setState({ currentProgram: null, currentMicrocycle: null, dateOverrides: {}, overrideContexts: {}, sessionFeedback: {}, weightOverrides: {} } as any);
useCoachUpdatesStore.setState({ updatesByWeek: {}, activeInjury: null });
seedInjury();
progress('8/10');
dumpWeek('STAGE 3 — "8/10" → recovery shell');

// Reset and resolve.
useProgramStore.setState({ currentProgram: null, currentMicrocycle: null, dateOverrides: {}, overrideContexts: {}, sessionFeedback: {}, weightOverrides: {} } as any);
useCoachUpdatesStore.setState({ updatesByWeek: {}, activeInjury: null });
seedInjury();
progress('pain is gone');
dumpWeek('STAGE 4 — "pain is gone" → restored');

console.log('=== END ===');
process.exit(0);
