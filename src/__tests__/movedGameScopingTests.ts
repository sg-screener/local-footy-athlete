/**
 * Moved-Game Scoping Regression Tests
 *
 * Verifies one-off game marks stay scoped without losing true cross-week
 * protection. A one-off Sunday game must protect the following Monday,
 * while weeks 2+ away remain unchanged.
 *
 * Bug:
 *   getEffectiveGameDates() unconditionally pulled every 'game' mark from
 *   markedDays into its return Set. When Week B's Monday checked
 *   shift(-1) for G+1 recovery, it found Week A's moved Sunday game —
 *   even though the user only intended that move for Week A.
 *
 * Contract:
 *   Explicit one-off 'game' marks are visible to proximity in their own
 *   Mon–Sun week and within ±2 calendar days across a week boundary.
 *   Recurring/virtual Saturday games still behave as the normal anchor.
 *
 * Run:  sucrase-node src/__tests__/movedGameScopingTests.ts
 */

// React Native global used inside sessionResolver.ts; mock for Node.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  resolveWeekWithConditioning,
  type ScheduleState,
  type ResolvedDay,
} from '../utils/sessionResolver';
import type { Workout, IntensityLevel } from '../types/domain';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { classifySessionStress } from '../rules/stressClassification';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function makeWorkout(
  dayOfWeek: number,
  name: string,
  intensity: IntensityLevel,
  tier: 'core' | 'optional' | 'recovery' = 'core',
  workoutType: 'Strength' | 'Recovery' | 'Conditioning' | 'Mixed' = 'Strength',
): Workout {
  return {
    id: `template-${name.toLowerCase().replace(/\s/g, '-')}`,
    microcycleId: 'test-micro',
    dayOfWeek,
    name,
    description: `${name} session`,
    durationMinutes: tier === 'optional' ? 30 : 60,
    intensity,
    workoutType,
    sessionTier: tier,
    exercises: [],
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  } as Workout;
}

/**
 * State scaffold: In-season, Saturday recurring games, 4-week block:
 *   Week A = Mon 2026-04-06 (user moved Sat 04-11 game → Sun 04-12)
 *   Week B = Mon 2026-04-13 (recurring Sat 04-18 game)
 *   Week C = Mon 2026-04-20 (recurring Sat 04-25 game)
 *
 * The microcycle template mirrors what the real engine emits for a
 * 3-core healthy In-season Saturday athlete:
 *   Mon (G-5): Lower Body            (core)
 *   Tue (G-4): Upper Pull            (core)
 *   Wed (G-3): -                     (empty → conditioning/recovery fills)
 *   Thu (G-2): Upper Push            (core)
 *   Fri (G-1): Optional arms/pump    (optional, will be converted to Gunshow by G-1 proximity)
 *   Sat (G):   virtual recurring game
 *   Sun (G+1): empty → resolver places G+1 Recovery via proximity
 */
function makeMovedGameState(): ScheduleState {
  return {
    currentProgram: {
      id: 'test-prog',
      userId: 'u',
      startDate: '2026-04-06',
      endDate: '2026-05-03',
      microcycles: [],
      createdAt: '2026-04-01T00:00:00Z',
    } as unknown as ScheduleState['currentProgram'],
    currentMicrocycle: {
      id: 'test-micro',
      programId: 'test-prog',
      weekNumber: 1,
      startDate: '2026-04-06',
      endDate: '2026-04-12',
      workouts: [
        makeWorkout(1, 'Lower Body', 'High', 'core'),
        makeWorkout(2, 'Upper Pull', 'Moderate', 'core'),
        makeWorkout(4, 'Upper Push', 'Moderate', 'core'),
        // Engine plans Fri G-1 as optional arms/pump — the resolver's G-1
        // proximity rule then converts/keeps it as Gunshow.
        makeWorkout(5, 'Arms / Pump', 'Light', 'optional'),
      ],
    } as unknown as ScheduleState['currentMicrocycle'],
    manualOverrides: {},
    markedDays: {
      '2026-04-12': 'game', // Week A — Sun (one-off override, moved from Sat 04-11)
      '2026-04-18': 'game', // Week B — recurring Sat
      '2026-04-25': 'game', // Week C — recurring Sat
    },
    athleteContext: {
      injuries: [],
      equipmentTags: [
        'bodyweight', 'dumbbells', 'barbell', 'cables', 'bands',
        'bench', 'foam_roller', 'bike_or_treadmill', 'machine',
      ],
      trainingLocation: 'Commercial gym',
    } as ScheduleState['athleteContext'],
    seasonPhase: 'In-season',
    usualGameDay: 'Saturday',
    readiness: 'medium',
  };
}

function makeState(args: {
  seasonPhase: 'In-season' | 'Pre-season';
  usualGameDay?: 'Saturday';
  markedDays: ScheduleState['markedDays'];
  includeSundayLower?: boolean;
}): ScheduleState {
  const workouts = [
    makeWorkout(1, 'Lower Body', 'High', 'core'),
    makeWorkout(2, 'Upper Pull', 'Moderate', 'core'),
    makeWorkout(4, 'Upper Push', 'Moderate', 'core'),
    makeWorkout(5, 'Arms / Pump', 'Light', 'optional'),
  ];
  if (args.includeSundayLower) {
    workouts.push(makeWorkout(0, 'Lower Body', 'High', 'core'));
  }
  return {
    currentProgram: {
      id: 'test-prog',
      userId: 'u',
      startDate: '2026-04-06',
      endDate: '2026-05-03',
      microcycles: [],
      createdAt: '2026-04-01T00:00:00Z',
    } as unknown as ScheduleState['currentProgram'],
    currentMicrocycle: {
      id: 'test-micro',
      programId: 'test-prog',
      weekNumber: 1,
      startDate: '2026-04-06',
      endDate: '2026-04-12',
      workouts,
    } as unknown as ScheduleState['currentMicrocycle'],
    manualOverrides: {},
    markedDays: args.markedDays,
    athleteContext: {
      injuries: [],
      equipmentTags: [
        'bodyweight', 'dumbbells', 'barbell', 'cables', 'bands',
        'bench', 'foam_roller', 'bike_or_treadmill', 'machine',
      ],
      trainingLocation: 'Commercial gym',
    } as ScheduleState['athleteContext'],
    seasonPhase: args.seasonPhase,
    usualGameDay: args.usualGameDay,
    readiness: 'medium',
  };
}

function findDay(week: ResolvedDay[], dateStr: string): ResolvedDay | undefined {
  return week.find((d) => d.date === dateStr);
}

function isRecovery(day: ResolvedDay | undefined): boolean {
  if (!day || !day.workout) return false;
  return day.workout.sessionTier === 'recovery'
      || day.workout.workoutType === 'Recovery';
}

function isGame(day: ResolvedDay | undefined): boolean {
  return !!(day && day.workout && day.workout.workoutType === 'Game');
}

function isHard(day: ResolvedDay | undefined): boolean {
  if (!day?.workout) return false;
  return classifyDaySessions(day.workout).some((unit) =>
    unit.category !== 'team_training' &&
    unit.category !== 'game' &&
    classifySessionStress(unit, day.workout!) === 'high',
  );
}

console.log('\n═════════════════════════════════════════════════════');
console.log('  Moved-Game Scoping Regression Tests');
console.log('═════════════════════════════════════════════════════');

// ─── Cross-week G+1 with next-week bye/noGame ───
console.log('\n=== Cross-week G+1 — Sunday one-off game, next Saturday bye ===');
{
  const state = makeState({
    seasonPhase: 'In-season',
    usualGameDay: 'Saturday',
    markedDays: {
      '2026-04-12': 'game',
      '2026-04-18': 'noGame',
    } as ScheduleState['markedDays'],
  });
  const week = resolveWeekWithConditioning('2026-04-13', state);
  const mon = findDay(week, '2026-04-13');
  const sat = findDay(week, '2026-04-18');

  assert(isRecovery(mon), 'Next-week Monday after Sunday one-off game is recovery/light, not heavy lower');
  assert(mon?.source === 'gameProximity', 'Next-week Monday is protected by shared game proximity');
  assert(sat?.workout?.workoutType !== 'Game', 'Next Saturday noGame/bye suppresses the recurring game');
}

// ─── Cross-week G+1 for pre-season practice match ───
console.log('\n=== Cross-week G+1 — pre-season Sunday practice match ===');
{
  const state = makeState({
    seasonPhase: 'Pre-season',
    markedDays: { '2026-04-12': 'game' } as ScheduleState['markedDays'],
  });
  const week = resolveWeekWithConditioning('2026-04-13', state);
  const mon = findDay(week, '2026-04-13');

  assert(isRecovery(mon), 'Pre-season Sunday practice match protects next Monday as recovery/light');
  assert(mon?.source === 'gameProximity', 'Pre-season cross-week G+1 uses shared proximity');
}

// ─── Removing the one-off mark restores the template ───
console.log('\n=== Removed Sunday one-off game — Monday returns to template ===');
{
  const state = makeState({
    seasonPhase: 'In-season',
    usualGameDay: 'Saturday',
    markedDays: { '2026-04-18': 'noGame' } as ScheduleState['markedDays'],
  });
  const week = resolveWeekWithConditioning('2026-04-13', state);
  const mon = findDay(week, '2026-04-13');

  assert(mon?.workout?.name === 'Lower Body', 'Monday returns to normal lower template when Sunday game mark is removed');
  assert(mon?.source === 'template', 'Removed one-off game leaves Monday as template source');
}

// ─── Mirror direction: Monday one-off protects previous Sunday G-1 ───
console.log('\n=== Cross-week G-1 — one-off Monday game protects previous Sunday ===');
{
  const state = makeState({
    seasonPhase: 'In-season',
    usualGameDay: 'Saturday',
    includeSundayLower: true,
    markedDays: { '2026-04-13': 'game' } as ScheduleState['markedDays'],
  });
  const week = resolveWeekWithConditioning('2026-04-06', state);
  const sun = findDay(week, '2026-04-12');

  assert(!isHard(sun), 'Previous Sunday G-1 before one-off Monday game is not hard');
  assert(sun?.workout?.name !== 'Lower Body', 'Previous Sunday lower template is displaced by game proximity');
}

// ─── Week A (the moved week) ───
console.log('\n=== Week A (2026-04-06 Mon) — moved game Sat→Sun ===');
{
  const state = makeMovedGameState();
  const week = resolveWeekWithConditioning('2026-04-06', state);
  const sat = findDay(week, '2026-04-11');
  const sun = findDay(week, '2026-04-12');

  assert(isGame(sun), 'Week A Sunday is the explicit game (override took effect)');
  assert(!isGame(sat), 'Week A Saturday is NOT a game (virtual Sat suppressed by same-week explicit Sun mark)');
}

// ─── Week B: recurring Sat plus cross-week G+1 from moved Sunday ───
console.log('\n=== Week B (2026-04-13 Mon) — recurring Saturday game, cross-week G+1 ===');
{
  const state = makeMovedGameState();
  const week = resolveWeekWithConditioning('2026-04-13', state);
  const mon = findDay(week, '2026-04-13');
  const tue = findDay(week, '2026-04-14');
  const thu = findDay(week, '2026-04-16');
  const fri = findDay(week, '2026-04-17');
  const sat = findDay(week, '2026-04-18');

  for (const d of week) {
    console.log(`  [debug] ${d.short} ${d.date}: name="${d.workout?.name ?? '-'}" src=${d.source} tier=${d.workout?.sessionTier ?? '-'}`);
  }

  assert(isGame(sat), 'Week B Saturday is the recurring game');

  // The cross-week proximity change: Mon = Recovery
  assert(isRecovery(mon), 'Week B Mon IS recovery (shared proximity — previous day was a one-off Sunday game)');
  assert(mon?.source === 'gameProximity', 'Week B Mon source is gameProximity (shared proximity)');

  // Tue/Wed/Thu/Fri must match the SAME resolution they would in a normal Saturday week.
  // We assert the structural shape (template/proximity sources + matching pattern), not
  // an exact name match — Pass 2/3 may add conditioning/recovery on the empty Wed.
  assert(tue?.workout?.name === 'Upper Pull' && tue?.source === 'template',
    'Week B Tue is template Upper Pull (G-4 core, NOT moved to Friday)');
  assert(thu?.workout?.name === 'Upper Push' && thu?.source === 'template',
    'Week B Thu is template Upper Push (G-2 core, intact)');

  // Friday must NOT be a full Upper Pull or any core strength.
  // G-1 proximity converts the optional arms/pump template to Gunshow.
  const friIsCoreStrength = fri?.workout?.sessionTier === 'core' && fri?.workout?.workoutType === 'Strength';
  assert(!friIsCoreStrength, 'Week B Fri is NOT a core strength session (G-1 protected)');
  assert(fri?.workout?.name !== 'Upper Pull', 'Week B Fri is NOT Upper Pull (the user-reported reshape symptom)');
  assert(fri?.source === 'gameProximity' || fri?.source === 'template',
    'Week B Fri source is gameProximity (Gunshow) or template (optional arms/pump) — not relocated');
}

// ─── Week C: still recurring ───
console.log('\n=== Week C (2026-04-20 Mon) — recurring Saturday game ===');
{
  const state = makeMovedGameState();
  const week = resolveWeekWithConditioning('2026-04-20', state);
  const mon = findDay(week, '2026-04-20');
  const sat = findDay(week, '2026-04-25');

  assert(isGame(sat), 'Week C Saturday is the recurring game');
  assert(!isRecovery(mon), 'Week C Monday is NOT recovery (one-off scoping holds two weeks downstream)');
  assert(mon?.source !== 'gameProximity', 'Week C Monday source is NOT gameProximity');
}

console.log('\n─────────────────────────────────────────────────────');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log('─────────────────────────────────────────────────────\n');

if (failed > 0) process.exit(1);
