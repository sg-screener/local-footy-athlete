/**
 * gameChangeLocalRebuildTests — deterministic game-day tap rebuilds.
 *
 * Product rule (Sam, 2026-07-08): adding / moving / removing a game from
 * the tap/edit UI must never depend on the AI coach or OpenAI.
 *
 * The FIRST line of this suite poisons global.fetch — if anything in the
 * local generation path touches the network, every test here fails.
 *
 * Covers:
 *   1. Pre-season no-game week + add Saturday practice match →
 *      Game Day renders, Friday is protected/light, no hard conditioning
 *      on Friday, S11-style structure for a healthy athlete.
 *   2. Moving the game to Sunday reshapes protection.
 *   3. Removing the game restores a non-game pre-season week.
 *   4. In-season local build keeps regular game-day behaviour.
 *   5. Every generated workout has content (no empty sessions).
 *
 * Run: npm run test:game-local-rebuild
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — tap/edit game rebuilds must be fully local');
};

import { generateProgramLocally } from '../services/api/generateProgram';
import { applyGameDayChange } from '../utils/profileMutations';
import {
  resolveWeekWithConditioning,
  computeGameDatesForBlock,
  type ScheduleState,
} from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import {
  validateProgramWeek,
  validatorDaysFromResolvedWeek,
} from '../rules/weekStructureValidator';
import type { DayOfWeek, OnboardingData, TrainingProgram } from '../types/domain';

// ─── Harness ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

const PRESEASON_PROFILE: Partial<OnboardingData> = {
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingIntensity: 'Hard',
  sprintExposure: '2+ times per week',
  conditioningLevel: 'Good',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Get stronger',
};

const DAY_TO_NUM: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

/** Resolve the program's first week the way production does (marks + availability). */
function resolveFirstWeek(program: TrainingProgram, profile: Partial<OnboardingData>, gameDayName?: DayOfWeek) {
  const micro = program.microcycles[0];
  const blockStart = program.startDate.split('T')[0];
  const blockEnd = program.endDate.split('T')[0];
  const markedDays: Record<string, 'game' | 'rest'> = {};
  if (gameDayName) {
    for (const gd of computeGameDatesForBlock(gameDayName, blockStart, blockEnd)) {
      markedDays[gd] = 'game';
    }
  }
  const availableDayNumbers = (profile.preferredTrainingDays ?? [])
    .map((d) => DAY_TO_NUM[d])
    .filter((n): n is number => n !== undefined);
  const state: ScheduleState = {
    currentProgram: program,
    currentMicrocycle: micro,
    manualOverrides: {},
    markedDays,
    athleteContext: DEFAULT_ATHLETE_CONTEXT,
    seasonPhase: (profile.seasonPhase ?? null) as ScheduleState['seasonPhase'],
    gameDay: gameDayName as never,
    readiness: 'high',
    availableDayNumbers: availableDayNumbers.length ? availableDayNumbers : undefined,
  };
  return resolveWeekWithConditioning(blockStart, state);
}

function dayByDow(resolved: ReturnType<typeof resolveFirstWeek>, dow: number) {
  return resolved.find((d) => d.dayOfWeek === dow);
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Add Saturday practice match (pre-season) — fully local ──');
{
  const withGame = applyGameDayChange(PRESEASON_PROFILE as OnboardingData, 'Saturday');
  const program = generateProgramLocally(withGame);
  ok('local build succeeds with network disabled', program.microcycles[0].workouts.length >= 4,
    `workouts=${program.microcycles[0].workouts.length}`);
  ok('every generated workout has exercises',
    program.microcycles[0].workouts.every((w) => (w.exercises?.length ?? 0) >= 1),
    program.microcycles[0].workouts.map((w) => `${w.name}:${w.exercises?.length}`).join(' | '));

  const resolved = resolveFirstWeek(program, withGame, 'Saturday');
  const sat = dayByDow(resolved, 6);
  const fri = dayByDow(resolved, 5);
  ok('Saturday renders as Game Day', sat?.workout?.workoutType === 'Game', sat?.workout?.name);
  ok('Friday (G-1) is protected/light — no core strength',
    !!fri && (fri.workout === null || fri.workout.sessionTier !== 'core'),
    `${fri?.workout?.sessionTier}: ${fri?.workout?.name}`);
  ok('Friday has no hard conditioning',
    !fri?.workout || !/(metcon|interval|vo2|sprint|hard conditioning|6x1km|mas)/i.test(fri.workout.name),
    fri?.workout?.name);

  const report = validateProgramWeek({
    days: validatorDaysFromResolvedWeek(resolved),
    profile: { seasonPhase: 'Pre-season', teamTrainingIntensity: 'Hard', conditioningLevel: 'Good' },
  });
  ok('no game-proximity findings on the rebuilt week',
    report.findings.every((f) => !/^g1_|^g2_|^g_plus1/.test(f.ruleId)),
    report.findings.map((f) => `${f.severity}:${f.ruleId}`).join(' | '));
  ok('S11-style structure: 3 strength exposures for healthy athlete',
    report.counts.mainStrengthExposures === 3, `got ${report.counts.mainStrengthExposures}`);
  ok('hard days at target (≤4)', report.counts.hardDays <= 4, `got ${report.counts.hardDays}`);
  ok('no strong/hard_stop findings',
    report.findings.every((f) => f.severity !== 'strong' && f.severity !== 'hard_stop'),
    report.findings.map((f) => f.ruleId).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Move the practice match to Sunday ──');
{
  const withSunday = applyGameDayChange(PRESEASON_PROFILE as OnboardingData, 'Sunday');
  const program = generateProgramLocally(withSunday);
  const resolved = resolveFirstWeek(program, withSunday, 'Sunday');
  const sun = dayByDow(resolved, 0);
  const sat = dayByDow(resolved, 6);
  ok('Sunday renders as Game Day', sun?.workout?.workoutType === 'Game', sun?.workout?.name);
  ok('Saturday (new G-1) holds no core strength / hard work',
    !sat?.workout || sat.workout.sessionTier !== 'core',
    `${sat?.workout?.sessionTier}: ${sat?.workout?.name}`);
  const report = validateProgramWeek({
    days: validatorDaysFromResolvedWeek(resolved),
    profile: { seasonPhase: 'Pre-season', teamTrainingIntensity: 'Hard', conditioningLevel: 'Good' },
  });
  ok('moved game: no game-proximity findings',
    report.findings.every((f) => !/^g1_|^g2_|^g_plus1/.test(f.ruleId)),
    report.findings.map((f) => `${f.severity}:${f.ruleId}`).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Remove the practice match — non-game pre-season week ──');
{
  const noGame = applyGameDayChange(
    applyGameDayChange(PRESEASON_PROFILE as OnboardingData, 'Saturday'),
    null,
  );
  ok('applyGameDayChange(null) clears both game fields',
    noGame.usualGameDay === undefined && noGame.gameDay === undefined,
    JSON.stringify({ usualGameDay: noGame.usualGameDay, gameDay: noGame.gameDay }));
  const program = generateProgramLocally(noGame);
  const resolved = resolveFirstWeek(program, noGame /* no game marks */);
  ok('no Game Day rendered anywhere', resolved.every((d) => d.workout?.workoutType !== 'Game'));
  const report = validateProgramWeek({
    days: validatorDaysFromResolvedWeek(resolved),
    profile: { seasonPhase: 'Pre-season', teamTrainingIntensity: 'Hard', conditioningLevel: 'Good' },
  });
  ok('no-game week returns to a fuller structure (≥3 strength exposures)',
    report.counts.mainStrengthExposures >= 3, `got ${report.counts.mainStrengthExposures}`);
  ok('no-game week has no strong/hard_stop findings',
    report.findings.every((f) => f.severity !== 'strong' && f.severity !== 'hard_stop'),
    report.findings.map((f) => `${f.severity}:${f.ruleId}`).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. In-season local rebuild keeps regular game behaviour ──');
{
  const inSeason: Partial<OnboardingData> = {
    ...PRESEASON_PROFILE,
    seasonPhase: 'In-season',
    gameDay: 'Saturday',
    usualGameDay: 'Saturday',
  };
  const program = generateProgramLocally(inSeason as OnboardingData);
  const resolved = resolveFirstWeek(program, inSeason, 'Saturday');
  const sat = dayByDow(resolved, 6);
  const fri = dayByDow(resolved, 5);
  ok('in-season: Saturday renders as Game Day', sat?.workout?.workoutType === 'Game', sat?.workout?.name);
  ok('in-season: Friday (G-1) is light',
    !fri?.workout || fri.workout.sessionTier !== 'core' ||
      /gunshow|arm|pump|recovery/i.test(fri.workout.name),
    `${fri?.workout?.sessionTier}: ${fri?.workout?.name}`);
  const report = validateProgramWeek({
    days: validatorDaysFromResolvedWeek(resolved),
    profile: { seasonPhase: 'In-season', teamTrainingIntensity: 'Hard', conditioningLevel: 'Good' },
  });
  ok('in-season: no game-proximity findings',
    report.findings.every((f) => !/^g1_|^g2_|^g_plus1/.test(f.ruleId)),
    report.findings.map((f) => `${f.severity}:${f.ruleId}`).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
// 5. Busy/Away constraints survive game-day rebuilds.
//    Away days are manual overrides OWNED by the schedule Coach Note
//    (OverrideContext.activeModifierId). The rebuild sweep must clear
//    stale overrides but preserve modifier-owned ones — otherwise the
//    note says "Away this week" while Monday's session comes back.
// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Away-blocked Monday survives adding a practice match ──');

import { useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { clearManualOverridesPreservingActiveModifiers } from '../utils/activeProgramModifiers';
import { addDays } from '../utils/sessionResolver';
import type { Workout } from '../types/domain';

// Late-bound require: programControlActions participates in an import cycle
// with the modules above when loaded eagerly under the CJS test runner —
// its exports are undefined at hoisted-import time but resolved by now.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  buildTapScheduleModifier,
  scheduleModifierIdForDate,
} = require('../utils/programControlActions') as typeof import('../utils/programControlActions');

function makeAwayRestWorkout(date: string): Workout {
  const now = new Date().toISOString();
  return {
    id: `away-${date}`, microcycleId: 'mc-ai-1',
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    name: 'Rest — away', description: 'Cleared while you are away.',
    durationMinutes: 0, intensity: 'Light', workoutType: 'Recovery',
    sessionTier: 'recovery', exercises: [], createdAt: now, updatedAt: now,
  } as Workout;
}

{
  const withGame = applyGameDayChange(PRESEASON_PROFILE as OnboardingData, 'Saturday');
  const program = generateProgramLocally(withGame);
  const blockStart = program.startDate.split('T')[0];

  // Test on a FUTURE week (Sam's repro): week 2 of the block.
  const week2Monday = addDays(blockStart, 7);

  // 1. Athlete marks Monday away: schedule constraint + owned override.
  const awayId = scheduleModifierIdForDate(week2Monday, 'away');
  useCoachUpdatesStore.getState().upsertActiveConstraint(
    buildTapScheduleModifier({
      date: week2Monday,
      todayISO: blockStart,
      variant: 'away',
      linkedOverrideDates: [week2Monday],
    }),
  );
  useProgramStore.getState().setManualOverride(
    week2Monday,
    makeAwayRestWorkout(week2Monday),
    { intent: 'program_adjustment', activeModifierId: awayId },
  );
  // Plus a STALE override (no owner) that SHOULD be wiped by a rebuild.
  const staleDate = addDays(blockStart, 8);
  useProgramStore.getState().setManualOverride(staleDate, makeAwayRestWorkout(staleDate), {
    intent: 'gameProximity', relatedGameDate: addDays(blockStart, 9),
  });

  // 2. Add the practice match → local rebuild → the sweep runs.
  const rebuilt = generateProgramLocally(withGame);
  const sweep = clearManualOverridesPreservingActiveModifiers(blockStart);
  ok('away-day override preserved by the rebuild sweep',
    sweep.preserved.includes(week2Monday), JSON.stringify(sweep));
  ok('stale (unowned) override cleared by the rebuild sweep',
    sweep.cleared.includes(staleDate), JSON.stringify(sweep));

  // 3. Resolve the FUTURE week with the surviving override in place.
  const micro = rebuilt.microcycles[0];
  const markedDays: Record<string, 'game' | 'rest'> = {};
  for (const gd of computeGameDatesForBlock('Saturday', blockStart, rebuilt.endDate.split('T')[0])) {
    markedDays[gd] = 'game';
  }
  const state: ScheduleState = {
    currentProgram: rebuilt, currentMicrocycle: micro,
    manualOverrides: useProgramStore.getState().dateOverrides,
    markedDays, athleteContext: DEFAULT_ATHLETE_CONTEXT,
    seasonPhase: 'Pre-season', gameDay: 'Saturday' as never, readiness: 'high',
    availableDayNumbers: [1, 2, 3, 4, 5],
  };
  const resolved = resolveWeekWithConditioning(week2Monday, state);
  const mon = resolved.find((d) => d.date === week2Monday);
  const sat = resolved.find((d) => d.dayOfWeek === 6);
  const fri = resolved.find((d) => d.dayOfWeek === 5);
  ok('future-week Monday stays blocked (away rest, not Lower Body Strength)',
    mon?.source === 'manual' && /away|rest/i.test(mon?.workout?.name ?? ''),
    `${mon?.source}: ${mon?.workout?.name}`);
  ok('Saturday still renders as Game Day', sat?.workout?.workoutType === 'Game', sat?.workout?.name);
  ok('Friday (G-1) still light', !fri?.workout || fri.workout.sessionTier !== 'core',
    `${fri?.workout?.sessionTier}: ${fri?.workout?.name}`);
  ok('Coach Note constraint still active (note and program agree)',
    useCoachUpdatesStore.getState().activeConstraints.some((c) => c.id === awayId));

  // 4. Athlete clears the away adjustment → next rebuild may restore Monday.
  useCoachUpdatesStore.setState((s: any) => ({
    activeConstraints: s.activeConstraints.filter((c: any) => c.id !== awayId),
  }));
  const sweep2 = clearManualOverridesPreservingActiveModifiers(blockStart);
  ok('after clearing the away note, the override is released on next rebuild',
    sweep2.cleared.includes(week2Monday), JSON.stringify(sweep2));

  // Cleanup for any later suites.
  useProgramStore.getState().clearManualOverrides();
}

// ═════════════════════════════════════════════════════════════════════
// 6. USER MANUAL EDITS survive rebuilds; game-window conflicts are
//    resolved explicitly, never silently.
// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Manual bin/move/swap/add vs game-day rebuild ──');
{
  const withGame = applyGameDayChange(PRESEASON_PROFILE as OnboardingData, 'Saturday');
  const program = generateProgramLocally(withGame);
  const blockStart = program.startDate.split('T')[0];
  const blockEnd = program.endDate.split('T')[0];
  const gameDates = computeGameDatesForBlock('Saturday', blockStart, blockEnd);
  const week2Monday = addDays(blockStart, 7);
  const week2Wednesday = addDays(blockStart, 9);
  const week2Friday = addDays(blockStart, 11); // G-1 for week-2 Saturday game
  const now = new Date().toISOString();

  const mkOverride = (date: string, name: string, extra: Partial<Workout> = {}): Workout => {
    const isRest = /^(?:rest|recovery flow)$/i.test(name);
    const rowName = /metcon/i.test(name)
      ? 'Hard Assault Bike Intervals'
      : /lower/i.test(name)
        ? 'Back Squat'
        : /upper pull/i.test(name)
          ? 'Pull-Ups'
          : /gunshow/i.test(name)
            ? 'Bicep Curls'
            : 'Mobility Flow';
    const rows = isRest ? [] : [{
      id: `row-${date}`,
      workoutId: `manual-${date}`,
      exerciseId: `exercise-${date}`,
      exerciseOrder: 1,
      prescribedSets: 3,
      prescribedRepsMin: 6,
      prescribedRepsMax: 8,
      prescribedWeightKg: 0,
      restSeconds: 60,
      exercise: {
        id: `exercise-${date}`,
        name: rowName,
        description: rowName,
        exerciseType: 'Compound',
        muscleGroups: [],
        equipmentRequired: [],
        difficultyLevel: 'Intermediate',
        createdAt: now,
        updatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    }];
    return {
      id: `manual-${date}`, microcycleId: 'mc-ai-1',
      dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
      name, description: name, durationMinutes: 40, intensity: 'Moderate',
      workoutType: 'Strength', sessionTier: 'core', exercises: rows,
      createdAt: now, updatedAt: now, ...extra,
    } as Workout;
  };

  const ps = useProgramStore.getState();
  // Manual BIN (coachActions writes intent 'dismissed'): Monday cleared.
  ps.setManualOverride(week2Monday,
    mkOverride(week2Monday, 'Rest', { workoutType: 'Recovery', sessionTier: 'recovery' }),
    { intent: 'dismissed', label: 'Removed session' });
  // Manual SWAP (tap sheet / revision writer: 'program_adjustment'): Wednesday.
  ps.setManualOverride(week2Wednesday,
    mkOverride(week2Wednesday, 'Upper Pull (swapped)'),
    { intent: 'program_adjustment', label: 'coach_revision:swap:strength' });
  // Manually ADDED HARD session on G-1 Friday — conflicts with the game.
  ps.setManualOverride(week2Friday,
    mkOverride(week2Friday, 'Off-Feet MetCon', { workoutType: 'MetCon', intensity: 'High' }),
    { intent: 'dismissed', label: 'Added session' });

  const sweep = clearManualOverridesPreservingActiveModifiers(blockStart, { gameDates });
  ok('manual bin survives the game rebuild (Monday does not resurrect)',
    sweep.preserved.includes(week2Monday), JSON.stringify(sweep));
  ok('manual swap survives the game rebuild (safe — midweek)',
    sweep.preserved.includes(week2Wednesday), JSON.stringify(sweep));
  ok('manually added hard session on G-1 is removed as a game conflict',
    sweep.cleared.includes(week2Friday) &&
    sweep.conflictsRemoved.some((c) => c.date === week2Friday),
    JSON.stringify(sweep));
  ok('conflict removal is reported (never silent)',
    sweep.conflictsRemoved.length === 1 && /metcon|hard assault bike/i.test(sweep.conflictsRemoved[0].name),
    JSON.stringify(sweep.conflictsRemoved));

  // Light manual edit NEAR the game (gunshow swap on G-1) is Bible-legal → survives.
  ps.setManualOverride(week2Friday,
    mkOverride(week2Friday, 'Gunshow', { sessionTier: 'optional', intensity: 'Light' }),
    { intent: 'dismissed', label: 'Swapped session' });
  const sweep2 = clearManualOverridesPreservingActiveModifiers(blockStart, { gameDates });
  ok('light manual edit on G-1 (gunshow) survives — only HARD conflicts are removed',
    sweep2.preserved.includes(week2Friday), JSON.stringify(sweep2));

  // Manual override sitting exactly ON the game date always conflicts
  // (manual overrides outrank the game mark and would hide the game).
  const week2Saturday = addDays(blockStart, 12);
  ps.setManualOverride(week2Saturday,
    mkOverride(week2Saturday, 'Extra Session'),
    { intent: 'dismissed', label: 'Added session' });
  const sweep3 = clearManualOverridesPreservingActiveModifiers(blockStart, { gameDates });
  ok('manual override ON the game date is removed (would hide Game Day)',
    sweep3.conflictsRemoved.some((c) => c.date === week2Saturday), JSON.stringify(sweep3));

  // Cross-week G+1: a one-off Sunday game in the selected week protects
  // the following Monday. Heavy user edits there are removed/reported;
  // light recovery edits survive.
  const oneOffSunday = addDays(blockStart, 6);
  ps.setManualOverride(week2Monday,
    mkOverride(week2Monday, 'Lower Body Strength', { intensity: 'High' }),
    { intent: 'dismissed', label: 'Added session' });
  const sweep4 = clearManualOverridesPreservingActiveModifiers(blockStart, { gameDates: [oneOffSunday] });
  ok('high-stress manual override on cross-week G+1 is removed as a game conflict',
    sweep4.cleared.includes(week2Monday) &&
    sweep4.conflictsRemoved.some((c) => c.date === week2Monday),
    JSON.stringify(sweep4));

  ps.setManualOverride(week2Monday,
    mkOverride(week2Monday, 'Recovery Flow', { workoutType: 'Recovery', sessionTier: 'recovery', intensity: 'Light' }),
    { intent: 'dismissed', label: 'Swapped session' });
  const sweep5 = clearManualOverridesPreservingActiveModifiers(blockStart, { gameDates: [oneOffSunday] });
  ok('light recovery override on cross-week G+1 is preserved',
    sweep5.preserved.includes(week2Monday), JSON.stringify(sweep5));

  useProgramStore.getState().clearManualOverrides();
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Readiness constraints survive game-day rebuilds ──');
{
  // "I'm not 100%" / reduced-load lives in coachUpdatesStore constraints —
  // the sweep must never touch that store.
  const fatigueConstraint: any = {
    id: 'tap-recovery-mode:test',
    type: 'fatigue',
    severity: 7,
    status: 'active',
    startDate: new Date().toISOString(),
    blockedExposures: [], limitedExposures: [], allowedExposures: [],
    safeFocus: ['Recovery + mobility'],
    label: 'reduced load (test)',
  };
  useCoachUpdatesStore.getState().upsertActiveConstraint(fatigueConstraint);
  clearManualOverridesPreservingActiveModifiers();
  ok('reduced-load/readiness constraint untouched by rebuild sweep',
    useCoachUpdatesStore.getState().activeConstraints.some((c) => c.id === 'tap-recovery-mode:test'));
  useCoachUpdatesStore.setState((s: any) => ({
    activeConstraints: s.activeConstraints.filter((c: any) => c.id !== 'tap-recovery-mode:test'),
  }));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. No rebuild path uses blanket clearManualOverrides ──');
{
  // Static guard (same pattern as profileResetUITests): the home-screen
  // rebuild code must use the selective sweep; blanket wipes are reserved
  // for intentional resets (ProfileScreen reset, resetCoach).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  const src = fs.readFileSync(
    `${__dirname}/../screens/home/useHomeScreen.ts`,
    'utf8',
  ) as string;
  ok('useHomeScreen never calls blanket clearManualOverrides()',
    !/\bclearManualOverrides\(\)/.test(src));
  ok('useHomeScreen rebuilds through the canonical weekRebuild door',
    /rebuildLocalWeek\(/.test(src) && /commitRebuiltProgram\(/.test(src));
}

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`gameChangeLocalRebuildTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n  - ' + failures.join('\n  - '));
process.exit(fail > 0 ? 1 : 0);
