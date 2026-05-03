// Demo: future-week resolution with and without activeInjury.
import { resolveWeek } from './src/utils/sessionResolver';
import type { ScheduleState } from './src/utils/sessionResolver';
import type { Workout } from './src/types/domain';

function ex(name: string): any {
  return { id:`we-${name}`, workoutId:'wk', exerciseId:`ex-${name}`, exerciseOrder:0, prescribedSets:3, prescribedRepsMin:6, prescribedRepsMax:8, prescribedWeightKg:0, restSeconds:0,
    exercise:{ id:`ex-${name}`, name, description:name, exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' },
    createdAt:'', updatedAt:'' };
}
function wk(name: string, dow: number, opts: any = {}): Workout {
  return { id:`w-${dow}`, microcycleId:'mc', dayOfWeek:dow, name, description:'', durationMinutes:60, intensity:'Moderate', workoutType: opts.workoutType || 'Strength', sessionTier: opts.sessionTier || 'core', exercises: opts.exercises || [], createdAt:'', updatedAt:'' } as any;
}

const NEXT_MONDAY = '2026-05-04';
const microcycle: any = {
  id:'mc', macrocycleId:'macro', weekNumber:1,
  startDate: NEXT_MONDAY, endDate:'2026-05-10',
  workouts: [
    wk('Team Training', 4, { workoutType: 'Team Training' }),
    wk('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] }),
    wk('Sprint Intervals', 6, { workoutType: 'Conditioning', exercises: [ex('10m Sprint')] }),
  ],
  createdAt:'', updatedAt:'',
};
const program: any = {
  id:'p', userId:'u', name:'T', startDate: NEXT_MONDAY, endDate:'2026-12-31',
  macrocycles:[{ id:'m', programId:'p', name:'M', startDate: NEXT_MONDAY, endDate:'2026-12-31', microcycles:[microcycle], createdAt:'', updatedAt:'' }],
  createdAt:'', updatedAt:'',
};
function makeState(activeInjury: any = null): ScheduleState {
  return {
    currentProgram: program, currentMicrocycle: microcycle,
    manualOverrides: {}, markedDays: {}, athleteContext: {} as any,
    seasonPhase: null, readiness: 'medium', activeInjury,
  };
}
function dump(label: string, state: ScheduleState) {
  const week = resolveWeek(NEXT_MONDAY, state);
  console.log(`\n--- ${label} ---`);
  for (const d of week) {
    if (!d.workout) continue;
    const exNames = (d.workout.exercises || []).map((e: any) => e.exercise?.name).filter(Boolean);
    const notes = d.workout.coachNotes ?? [];
    console.log(`  ${d.short} (${d.date}) [${d.source}] ${d.workout.name}: ex=${JSON.stringify(exNames)} notes=${JSON.stringify(notes)}`);
  }
}

console.log('=== NEXT WEEK — before/after activeInjury ===');
dump('BEFORE — no injury', makeState(null));
dump('AFTER — hammy 6/10 active', makeState({
  bodyPart:'hammy', bucket:'hamstring', severity:6, status:'active',
}));
dump('AFTER — hammy 4/10 improving (relaxed tier)', makeState({
  bodyPart:'hammy', bucket:'hamstring', severity:4, status:'improving',
}));
dump('AFTER — hammy 1/10 light', makeState({
  bodyPart:'hammy', bucket:'hamstring', severity:1, status:'improving',
}));
dump('AFTER — resolved', makeState({
  bodyPart:'hammy', bucket:'hamstring', severity:0, status:'resolved',
}));
console.log('=== END ===');
process.exit(0);
