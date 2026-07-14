/**
 * Repeat-week mechanism tests.
 *
 * Run: npx sucrase-node src/__tests__/repeatWeekTests.ts
 *
 * Pure tests cover the overlay transformation + feedback recommender; the
 * store-driven tests drive the real program store through the action and assert
 * on the committed overlay + resolved week (mirrors the weekRebuild harness).
 *
 * global.fetch is poisoned — repeats must be fully local.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — repeat week must be fully local');
};

import type { OnboardingData, Workout } from '../types/domain';
import {
  buildRepeatWeekOverlay,
  shouldRecommendRepeatWeek,
  repeatWeekOverlayId,
  isRepeatWeekOverlay,
  repeatWeekIntoNextWeek,
  clearRepeatWeek,
} from '../utils/repeatWeek';
import { rebuildLocalWeek } from '../utils/weekRebuild';
import { addDays, getMondayForDate, resolveWeekWithConditioning, type ScheduleState, type ResolvedDay } from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import { useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { todayISOLocal } from '../utils/appDate';
import { evaluateEffectiveWeekExposureContract } from '../rules/weeklyExposureContract';
import { observeOverlaySection18 } from '../utils/section18ProgramObservation';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`); }
}

// ─── Workout factory for pure tests ───
let uid = 0;
function w(dow: number, workoutType: Workout['workoutType'], name: string, sets = 3): Workout {
  const id = `src-${dow}-${uid++}`;
  return {
    id,
    microcycleId: 'src-mc',
    dayOfWeek: dow,
    name,
    description: '',
    durationMinutes: 45,
    intensity: 'Moderate',
    workoutType,
    exercises: workoutType === 'Strength'
      ? [{
          id: `we-${id}`, workoutId: id, exerciseId: 'squat', exerciseOrder: 1,
          prescribedSets: sets, prescribedRepsMin: 5, prescribedRepsMax: 5, restSeconds: 120,
          createdAt: '', updatedAt: '',
        }]
      : [],
    createdAt: '', updatedAt: '',
  };
}

const TARGET_WEEK = '2026-07-13'; // a Monday

// ── 1. Basic overlay shape / owner id ──
{
  const source = [w(1, 'Strength', 'Lower'), w(3, 'Strength', 'Upper')];
  const ov = buildRepeatWeekOverlay({ sourceWorkouts: source, targetWeekStart: TARGET_WEEK });
  ok('overlay reason is repeat_week', ov.reason === 'repeat_week');
  ok('overlay id is the deterministic owner id', ov.id === repeatWeekOverlayId(TARGET_WEEK), ov.id);
  ok('isRepeatWeekOverlay recognises it', isRepeatWeekOverlay(ov));
  ok('overlay lands on the target week', ov.weekStart === TARGET_WEEK && ov.weekEnd === addDays(TARGET_WEEK, 6));
  ok('Monday source copied to target Monday', !!ov.workoutsByDate[TARGET_WEEK]);
  ok('Wednesday source copied to target Wednesday', !!ov.workoutsByDate[addDays(TARGET_WEEK, 2)]);
}

// ── 2. Preserves strength prescriptions without increasing load ──
{
  const source = [w(1, 'Strength', 'Lower', 3)];
  const ov = buildRepeatWeekOverlay({ sourceWorkouts: source, targetWeekStart: TARGET_WEEK });
  const copied = ov.workoutsByDate[TARGET_WEEK]!;
  ok('copied strength keeps sets (no load increase)', copied.exercises[0].prescribedSets === 3, String(copied.exercises[0].prescribedSets));
  ok('copied strength keeps reps', copied.exercises[0].prescribedRepsMax === 5);
}

// ── 3. Repeated deload stays lighter (whatever the source carried is preserved) ──
{
  const deload = [w(1, 'Strength', 'Lower (deload)', 2)]; // lighter source
  const ov = buildRepeatWeekOverlay({ sourceWorkouts: deload, targetWeekStart: TARGET_WEEK });
  ok('repeated deload keeps the lighter dose', ov.workoutsByDate[TARGET_WEEK]!.exercises[0].prescribedSets === 2);
}

// ── 4. Does not copy a game / practice match from the source week ──
{
  const source = [w(1, 'Strength', 'Lower'), w(6, 'Game', 'Practice Match')];
  const ov = buildRepeatWeekOverlay({ sourceWorkouts: source, targetWeekStart: TARGET_WEEK });
  const targetSat = addDays(TARGET_WEEK, 5);
  ok('source game is NOT copied into the target week',
    !Object.prototype.hasOwnProperty.call(ov.workoutsByDate, targetSat),
    Object.keys(ov.workoutsByDate).join(','));
}

// ── 5. Target-week anchors win (recurring game/team DOWs fall through) ──
{
  const source = [w(1, 'Strength', 'Lower'), w(2, 'Strength', 'Upper'), w(4, 'Strength', 'Pull')];
  // Target week: Tuesday is a team day, Saturday is the recurring game.
  const ov = buildRepeatWeekOverlay({
    sourceWorkouts: source,
    targetWeekStart: TARGET_WEEK,
    targetAnchorDows: [2, 6], // Tue team, Sat game
  });
  const targetTue = addDays(TARGET_WEEK, 1);
  ok('target team-day DOW is omitted (base team day wins)',
    !Object.prototype.hasOwnProperty.call(ov.workoutsByDate, targetTue));
  ok('non-anchor source days are still copied', !!ov.workoutsByDate[TARGET_WEEK] && !!ov.workoutsByDate[addDays(TARGET_WEEK, 3)]);
}

// ── 6. Explicit target one-off game wins over any copy ──
{
  const source = [w(3, 'Strength', 'Upper')];
  const targetWed = addDays(TARGET_WEEK, 2);
  const targetGame = w(3, 'Game', 'Target one-off game');
  const ov = buildRepeatWeekOverlay({
    sourceWorkouts: source,
    targetWeekStart: TARGET_WEEK,
    targetWinningWorkoutsByDate: { [targetWed]: targetGame },
  });
  ok('target one-off game wins on its date', ov.workoutsByDate[targetWed]?.workoutType === 'Game');
}

// ── 7. Feedback recommender (Bible §13 triggers) ──
{
  ok('recommends repeat when sick', shouldRecommendRepeatWeek({ plannedSessions: 5, completedSessions: 5, wasSick: true }));
  ok('recommends repeat when cooked', shouldRecommendRepeatWeek({ plannedSessions: 5, completedSessions: 5, wasCooked: true }));
  ok('recommends repeat when too hard', shouldRecommendRepeatWeek({ plannedSessions: 5, completedSessions: 5, reportedTooHard: true }));
  ok('recommends repeat when user asks', shouldRecommendRepeatWeek({ plannedSessions: 5, completedSessions: 5, userRequestedRepeat: true }));
  ok('recommends repeat when most of the week missed', shouldRecommendRepeatWeek({ plannedSessions: 5, completedSessions: 1 }));
  ok('does NOT recommend repeat after a good, complete week', !shouldRecommendRepeatWeek({ plannedSessions: 5, completedSessions: 5 }));
}

// ══════════════════ STORE-DRIVEN ══════════════════

let markedDays: ScheduleState['markedDays'] = {};
function resetWorld() {
  useProgramStore.getState().clearManualOverrides();
  useProgramStore.getState().clearWeekScopedOverlays();
  useCoachUpdatesStore.setState((s: unknown) => ({ ...(s as object), activeConstraints: [] }) as never);
  markedDays = {};
}
function resolveLiveWeek(mondayISO: string, seasonPhase: string, gameDay?: string): ResolvedDay[] {
  const ps = useProgramStore.getState();
  const state: ScheduleState = {
    currentProgram: ps.currentProgram,
    currentMicrocycle: ps.currentMicrocycle,
    manualOverrides: ps.dateOverrides,
    weekScopedOverlays: ps.weekScopedOverlays,
    markedDays,
    athleteContext: DEFAULT_ATHLETE_CONTEXT,
    seasonPhase: seasonPhase as ScheduleState['seasonPhase'],
    gameDay: gameDay as never,
    readiness: 'high',
    availableDayNumbers: [1, 2, 3, 4, 5],
  };
  return resolveWeekWithConditioning(mondayISO, state);
}

const OFFSEASON: Partial<OnboardingData> = {
  seasonPhase: 'Off-season',
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  conditioningLevel: 'Good',
  experienceLevel: '2-5 years',
  recentTrainingLoad: 'Very consistent',
  sprintExposure: 'Occasionally',
  injuries: [],
  motivation: 'Build the base',
};

const PRESEASON_NO_ANCHORS: Partial<OnboardingData> = {
  ...OFFSEASON,
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 6,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
  conditioningLevel: 'Elite',
  recentTrainingLoad: 'Very consistent',
};

const today = todayISOLocal();
const thisMonday = getMondayForDate(today);
const nextMonday = addDays(thisMonday, 7);

// ── 8. User can repeat current week into next week (overlay committed) ──
{
  resetWorld();
  rebuildLocalWeek({ baseProfile: OFFSEASON as OnboardingData, newGameDay: null, todayISO: today });
  const before = useProgramStore.getState().currentProgram;
  const beforeBlockLen = before?.microcycles?.length ?? 0;

  const res = repeatWeekIntoNextWeek({ baseProfile: OFFSEASON as OnboardingData, sourceWeekDate: thisMonday, todayISO: today });
  ok('repeat targets next week', res.targetWeekStart === nextMonday, `${res.targetWeekStart} vs ${nextMonday}`);

  const overlay = useProgramStore.getState().weekScopedOverlays?.[nextMonday];
  ok('repeat_week overlay committed to the target week', !!overlay && overlay.reason === 'repeat_week');
  ok('repeat_week overlay carries the target week exposure contract',
    overlay?.exposureContract?.identity.phase === 'Off-season');
  ok('repeat_week overlay carries the target Section 18 contract',
    overlay?.exposureContractV2?.protocolVersion === 2);
  ok('overlay has training-day entries copied from source', Object.keys(overlay?.workoutsByDate ?? {}).length >= 1);

  // Block rollover is NOT advanced: program object + block length unchanged.
  const after = useProgramStore.getState().currentProgram;
  ok('repeat does not advance the block (program unchanged)', after === before && (after?.microcycles?.length ?? 0) === beforeBlockLen);

  // Target week resolves cleanly with the repeated content present.
  const week = resolveLiveWeek(nextMonday, 'Off-season');
  ok('target week resolves and has at least one training session', week.some((d) => d.workout));
}

// ── 9. Repeat-week overlay has owner/id and can be cleared ──
{
  const overlay = useProgramStore.getState().weekScopedOverlays?.[nextMonday];
  ok('overlay id equals the deterministic owner id', overlay?.id === repeatWeekOverlayId(nextMonday));
  clearRepeatWeek(nextMonday);
  ok('clearRepeatWeek removes the overlay', !useProgramStore.getState().weekScopedOverlays?.[nextMonday]);
}

// ── 10. Target-week recurring game anchor still wins after a repeat ──
{
  resetWorld();
  const gameProfile: Partial<OnboardingData> = { ...OFFSEASON, seasonPhase: 'In-season', usualGameDay: 'Saturday' };
  rebuildLocalWeek({ baseProfile: gameProfile as OnboardingData, todayISO: today });
  repeatWeekIntoNextWeek({ baseProfile: gameProfile as OnboardingData, sourceWeekDate: thisMonday, todayISO: today });

  const targetSat = addDays(nextMonday, 5);
  const overlay = useProgramStore.getState().weekScopedOverlays?.[nextMonday];
  ok('repeat overlay does NOT override the target game day (anchor falls through)',
    !Object.prototype.hasOwnProperty.call(overlay?.workoutsByDate ?? {}, targetSat),
    Object.keys(overlay?.workoutsByDate ?? {}).join(','));
}

// ── 11. Sweep policy: system-junk override cleared, user edit preserved ──
{
  resetWorld();
  rebuildLocalWeek({ baseProfile: OFFSEASON as OnboardingData, newGameDay: null, todayISO: today });
  const ps = useProgramStore.getState();
  const junkDate = addDays(thisMonday, 1);
  const userDate = addDays(thisMonday, 3);
  const stub = (name: string): Workout => w(1, 'Strength', name);
  // A system 'gameProximity' override (dead system junk) + a real user edit.
  ps.setManualOverride(junkDate, stub('junk'), { intent: 'gameProximity' });
  ps.setManualOverride(userDate, stub('user edit'), { intent: 'dismissed' });

  const res = repeatWeekIntoNextWeek({ baseProfile: OFFSEASON as OnboardingData, sourceWeekDate: thisMonday, todayISO: today });
  ok('system-junk override is swept (cleared)', res.sweep.clear.includes(junkDate), res.sweep.clear.join(','));
  ok('user manual edit is preserved by the sweep', res.sweep.preserve.includes(userDate), res.sweep.preserve.join(','));
  ok('cleared junk override no longer in store', !useProgramStore.getState().dateOverrides?.[junkDate]);
  ok('preserved user edit still in store', !!useProgramStore.getState().dateOverrides?.[userDate]);
}

// ── 12. Repeat Week preserves the corrected target-week contract ──
{
  resetWorld();
  const rebuilt = rebuildLocalWeek({
    baseProfile: PRESEASON_NO_ANCHORS as OnboardingData,
    newGameDay: null,
    todayISO: today,
  });
  useProgramStore.getState().setCurrentProgram(rebuilt.program);
  const sourceWeekStart = getMondayForDate(rebuilt.program.startDate.slice(0, 10));
  const targetWeekStart = addDays(sourceWeekStart, 7);
  repeatWeekIntoNextWeek({
    baseProfile: PRESEASON_NO_ANCHORS as OnboardingData,
    sourceWeekDate: sourceWeekStart,
    todayISO: today,
  });
  const overlay = useProgramStore.getState().weekScopedOverlays?.[targetWeekStart];
  const contract = overlay?.exposureContract;
  const workouts = Object.values(overlay?.workoutsByDate ?? {})
    .filter((workout): workout is Workout => !!workout);
  const validation = contract
    ? evaluateEffectiveWeekExposureContract(contract, workouts, targetWeekStart)
    : null;
  const fallbackMicrocycle = useProgramStore.getState().currentProgram?.microcycles.find((week) =>
    week.startDate.slice(0, 10) === targetWeekStart);
  const section18 = overlay ? observeOverlaySection18(overlay, fallbackMicrocycle) : null;
  ok('Repeat Week carries and validates the corrected 4/4/1 pre-season policy',
    contract?.strength.targetCount === 4 &&
      contract.conditioning.targetCount === 4 &&
      contract.sprintCod.targetCount === 1 &&
      validation?.accepted === true &&
      validation.ledger.achieved.main_strength === 4 &&
      validation.ledger.achieved.conditioning === 4 &&
      validation.ledger.achieved.sprint_cod >= 1,
    JSON.stringify({ contract, validation }));
  ok('Repeat Week is observable through the shared Section 18 ledger',
    section18?.contract.protocolVersion === 2 &&
      section18.enforcement === 'observe_only' &&
      section18.ledger.mainStrength.achievedCount === validation?.ledger.achieved.main_strength &&
      section18.ledger.conditioning.coreCount === validation?.ledger.achieved.conditioning);
}

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((n) => console.log(`  - ${n}`));
  process.exit(1);
}
