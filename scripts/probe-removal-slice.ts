/**
 * THE REMOVE ACTION, DRIVEN THROUGH THE SCREEN'S OWN TWO DOORS.
 *
 * `removeExerciseToday` fires `remove_exercise` (durable, today-only) and THEN
 * asks the scope question, which lands on `applyExerciseExclusionDecision`. The
 * five-actions census only walked the second one. This walks both, separately
 * and together, so the report says which door is broken rather than "Remove".
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => localStorageData.get(k) ?? null,
    setItem: (k: string, v: string) => { localStorageData.set(k, v); },
    removeItem: (k: string) => { localStorageData.delete(k); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => { throw new Error('NETWORK DISABLED'); };
process.env.TZ = 'Australia/Melbourne';

/* eslint-disable import/first */
import type { OnboardingData, TrainingProgram, Workout } from '../src/types/domain';
import { addDaysISO } from '../src/utils/programBlockState';
import { useProgramStore } from '../src/store/programStore';
import { useProfileStore } from '../src/store/profileStore';
import { useCalendarStore } from '../src/store/calendarStore';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { commitRebuiltProgram } from '../src/utils/weekRebuild';
import { resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';
import { quiet, setJourneyClock, walkProgramControlDoor, leaveExerciseOut } from '../src/__tests__/support/athleteJourney';
import { getAthleteExclusions } from '../src/store/athletePreferencesStore';

const INSTALL_DAY = '2026-07-13';
const TARGET = process.env.TARGET ?? '2026-07-22';

function mondayFor(d: string): string {
  const p = new Date(`${d}T12:00:00Z`);
  return addDaysISO(d, -((p.getUTCDay() + 6) % 7));
}
export function theAthlete(): OnboardingData {
  return {
    firstName: 'Sim', heightCm: 184, weightKg: 90, seasonPhase: 'Off-season',
    position: 'inside_mid', motivation: 'Dominate your level', trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
    teamTrainingDuration: '90 minutes', teamTrainingIntensity: 'Moderate',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine', 'hamstring_curl', 'knee_extension', 'bands'],
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight', benchStrength: '1.5x bodyweight+',
    conditioningLevel: 'Good', sprintExposure: '2+ times per week', recentTrainingLoad: 'Very consistent',
    injuries: [], twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
    equipmentAnswer: {
      tags: { barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have', bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have', foam_roller: 'have', plyo_box: 'have' },
      modalities: { bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have' },
      answeredOn: INSTALL_DAY,
    },
    usualGameDay: 'Saturday', gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

export function install(): string {
  localStorageData.clear();
  resetStoresToFreshInstall('removal-probe:install');
  const profile = theAthlete();
  useProfileStore.getState().updateOnboardingData(profile);
  const c = quiet(() => useProfileStore.getState().completeOnboarding()) as { ok?: boolean } | undefined;
  if (c && c.ok === false) throw new Error('onboarding refused');
  setJourneyClock(INSTALL_DAY);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: INSTALL_DAY, previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'Off-season' as never,
      phaseEntryWeekStartISO: mondayFor(INSTALL_DAY),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const settled = program.microcycles[1] ?? program.microcycles[0]!;
  const weekStart = String(settled.startDate).slice(0, 10);
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {}, selectedDate: weekStart,
    reason: 'removal-probe:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}

export interface Row { name: string; kg: number | null; id: string | null; }
export function session(dateISO: string, weekStartISO: string): Row[] {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  const w = (day as { workout?: Workout } | undefined)?.workout;
  return (w?.exercises ?? []).map((r) => ({
    name: String((r as { exercise?: { name?: string } }).exercise?.name ?? (r as { name?: string }).name),
    kg: Number.isFinite((r as { prescribedWeightKg?: number }).prescribedWeightKg)
      ? Number((r as { prescribedWeightKg?: number }).prescribedWeightKg) : null,
    id: (r as { exerciseId?: string }).exerciseId ?? null,
  }));
}
const fmt = (rows: Row[]) => JSON.stringify(rows.map((r) => `${r.name}@${r.kg ?? '-'}`));

async function scopeWalk(scope: 'today_only' | 'this_block' | 'until_changed'): Promise<void> {
  const ws = install(); setJourneyClock(TARGET);
  const before = session(TARGET, ws);
  const victim = before[0]!;
  // The screen's real order: the durable removal, then the scope answer.
  const a = await walkProgramControlDoor({
    type: 'remove_exercise',
    source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
    scope: scope === 'today_only' ? 'today_only' : 'current_and_future',
    payload: { date: TARGET, exercise: victim.name, exerciseId: victim.id },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: scope === 'today_only',
  }, { weekStartISO: ws, todayISO: TARGET });
  const decision = quiet(() => leaveExerciseOut({
    exercise: victim.name, scope, decidedOnISO: TARGET, reason: 'dont_like',
  })) as { ok?: boolean; rebuildRequired?: boolean };
  const today = session(TARGET, ws);
  // The SAME session one week on — does the scope reach it?
  setJourneyClock(addDaysISO(TARGET, 7));
  const nextWeek = session(addDaysISO(TARGET, 7), addDaysISO(ws, 7));
  setJourneyClock(TARGET);
  console.log(`\n${'─'.repeat(72)}\nSCOPE ${scope} — removing "${victim.name}"`);
  console.log(`  door ok=${a.ok} rebuildRequired=${decision?.rebuildRequired}`);
  console.log(`  today  ${fmt(before)}`);
  console.log(`      -> ${fmt(today)}`);
  console.log(`  gone today: ${!today.some((r) => r.name === victim.name)}`);
  console.log(`  replaced by: ${JSON.stringify(today.filter((r) => !before.some((b) => b.name === r.name)).map((r) => r.name))}`);
  console.log(`  rows ${before.length} -> ${today.length}`);
  console.log(`  next week same session: ${fmt(nextWeek)}`);
  console.log(`  still there next week: ${nextWeek.some((r) => r.name === victim.name)}`);

  // RESTORE / UNDO
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { restoreExcludedExercise } = require('../src/utils/exerciseExclusionOwner');
  const undo = quiet(() => restoreExcludedExercise(victim.name)) as { ok?: boolean; rebuildRequired?: boolean };
  const afterUndo = session(TARGET, ws);
  console.log(`  UNDO ok=${undo?.ok} rebuildRequired=${undo?.rebuildRequired}`);
  console.log(`      -> ${fmt(afterUndo)}`);
  console.log(`  back after undo: ${afterUndo.some((r) => r.name === victim.name)}`);
}

async function main(): Promise<void> {
  console.log(`REMOVE — the two doors, ${TARGET}\n`);

  // ── DOOR A: `remove_exercise`, the durable program-control action ────────
  {
    const ws = install(); setJourneyClock(TARGET);
    const before = session(TARGET, ws);
    const victim = before[0]!;
    const res = await walkProgramControlDoor({
      type: 'remove_exercise',
      source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: { date: TARGET, exercise: victim.name, exerciseId: victim.id },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
    }, { weekStartISO: ws, todayISO: TARGET });
    const after = session(TARGET, ws);
    console.log(`DOOR A — remove_exercise "${victim.name}"`);
    console.log(`  ok=${res.ok} "${res.message}"`);
    console.log(`  before ${fmt(before)}`);
    console.log(`  after  ${fmt(after)}`);
    console.log(`  CHANGED: ${fmt(before) !== fmt(after) ? 'YES' : '*** NO ***'}`);
    console.log(`  other days untouched: ${fmt(session('2026-07-20', ws))}`);
  }

  // ── DOOR B: the scope answer alone ──────────────────────────────────────
  {
    const ws = install(); setJourneyClock(TARGET);
    const before = session(TARGET, ws);
    const victim = before[0]!;
    const res = quiet(() => leaveExerciseOut({
      exercise: victim.name, scope: 'today_only', decidedOnISO: TARGET, reason: 'dont_like',
    })) as { ok?: boolean; rebuildRequired?: boolean };
    const after = session(TARGET, ws);
    console.log(`\nDOOR B — exclusion decision "${victim.name}" today_only`);
    console.log(`  ok=${res?.ok} rebuildRequired=${res?.rebuildRequired}`);
    console.log(`  stored: ${JSON.stringify(quiet(() => getAthleteExclusions()))}`);
    console.log(`  before ${fmt(before)}`);
    console.log(`  after  ${fmt(after)}`);
    console.log(`  CHANGED: ${fmt(before) !== fmt(after) ? 'YES' : '*** NO ***'}`);
  }

  for (const scope of ['today_only', 'this_block', 'until_changed'] as const) await scopeWalk(scope);

  // ── BOTH, IN THE SCREEN'S ORDER ─────────────────────────────────────────
  {
    const ws = install(); setJourneyClock(TARGET);
    const before = session(TARGET, ws);
    const victim = before[0]!;
    const a = await walkProgramControlDoor({
      type: 'remove_exercise',
      source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: { date: TARGET, exercise: victim.name, exerciseId: victim.id },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
    }, { weekStartISO: ws, todayISO: TARGET });
    quiet(() => leaveExerciseOut({
      exercise: victim.name, scope: 'today_only', decidedOnISO: TARGET, reason: 'dont_like',
    }));
    const after = session(TARGET, ws);
    console.log(`\nBOTH, screen order — remove then scope "${victim.name}"`);
    console.log(`  door A ok=${a.ok}`);
    console.log(`  before ${fmt(before)}`);
    console.log(`  after  ${fmt(after)}`);
    console.log(`  CHANGED: ${fmt(before) !== fmt(after) ? 'YES' : '*** NO ***'}`);
  }
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
