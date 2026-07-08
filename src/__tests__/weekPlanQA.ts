/**
 * Week Plan QA Harness
 *
 * Structural test harness for manual QA of weekly plan generation.
 * Tests both the coaching engine (buildCoachingPlan) and the full
 * resolver pipeline (resolveWeekWithConditioning).
 *
 * Run:  npm run test:qa
 *
 * Outputs compact per-scenario summaries with automatic assertions
 * for all structural rules.
 */

// Node harness: define __DEV__ like every other suite. Some resolver
// branches (reached once availability filtering is active) reference it.
declare global {
  var __DEV__: boolean;
}

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingInputs,
  type CoachingPlan,
  type SessionAllocation,
} from '../utils/coachingEngine';
import {
  resolveWeekWithConditioning,
  type ScheduleState,
  type ResolvedDay,
  formatDate,
  addDays,
  computeGameDatesForBlock,
} from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import {
  validateProgramWeek,
  deriveWeekValidationFlags,
  validatorDaysFromResolvedWeek,
} from '../rules/weekStructureValidator';
import { isTeamTrainingSession } from '../utils/teamTraining';
import type { DayOfWeek, OnboardingData, Workout, Microcycle, TrainingProgram, SeasonPhase } from '../types/domain';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface Scenario {
  name: string;
  /** Onboarding data for buildCoachingPlan */
  onboarding: Partial<OnboardingData>;
  /** If set, override markedDays for resolver (game/rest calendar marks) */
  calendarOverrides?: Record<string, 'game' | 'rest'>;
  /** For edit-driven scenarios: base scenario name to derive from */
  editFrom?: string;
  /** Edit operations: what changed from the base scenario */
  editOps?: string[];
}

interface AssertionResult {
  rule: string;
  passed: boolean;
  detail: string;
}

type Region = 'upper' | 'lower' | 'neutral';

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const DAY_NAMES: readonly DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER_MON_FIRST: readonly DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Block: Mon 2026-03-23 to Sun 2026-04-19 (4 weeks)
const BLOCK_START = '2026-03-23';
const BLOCK_END = '2026-04-19';
const TEST_MONDAY = '2026-03-23'; // Week 1 Monday

function isDayOfWeek(value: string | undefined): value is DayOfWeek {
  return !!value && (DAY_NAMES as readonly string[]).includes(value);
}

function dayIndex(value: string | undefined): number {
  return isDayOfWeek(value) ? DAY_NAMES.indexOf(value) : -1;
}

function monFirstDayIndex(value: string | undefined): number {
  return isDayOfWeek(value) ? DAY_ORDER_MON_FIRST.indexOf(value) : -1;
}

// ═══════════════════════════════════════════════════
// REGION CLASSIFICATION (mirrors coachingEngine)
// ═══════════════════════════════════════════════════

function classifyRegion(session: SessionAllocation | Workout | null, focusOverride?: string): Region {
  if (!session) return 'neutral';
  const focus = (focusOverride || ('focus' in session ? session.focus : '') || ('name' in session ? session.name : '')).toLowerCase();
  const tier = 'tier' in session ? session.tier : ('sessionTier' in session ? (session as Workout).sessionTier : '');

  if (tier === 'recovery') return 'neutral';
  if (focus.includes('full body') || focus.includes('conditioning') || focus.includes('aerobic')) return 'neutral';
  if (focus.includes('game') || focus.includes('sprint') || focus.includes('mas ') || focus.includes('metcon')) return 'neutral';
  if (focus.includes('flush') || focus.includes('easy ') || focus.includes('tempo')) return 'neutral';
  if (focus.includes('flog') || focus.includes('circuit')) return 'neutral';
  if (focus.includes('6x1km') || focus.includes('row interval') || focus.includes('ski') || focus.includes('bike')) return 'neutral';

  if (focus.includes('lower body') || focus.includes('squat') || focus.includes('hinge') || focus.includes('leg')) return 'lower';

  if (focus.includes('upper body') || focus.includes('pull') || focus.includes('push')) return 'upper';
  if (focus.includes('arm') || focus.includes('pump') || focus.includes('bicep') || focus.includes('tricep')) return 'upper';
  if (focus.includes('accessor') || focus.includes('prehab') || focus.includes('trunk') || focus.includes('shoulder')) return 'upper';
  if (focus.includes('hypertrophy')) return 'upper';

  if (focus.includes('mobility') || focus.includes('foam') || focus.includes('recovery') || focus.includes('rest')) return 'neutral';

  return 'neutral';
}

function regionLabel(r: Region): string {
  return r === 'upper' ? 'UPR' : r === 'lower' ? 'LWR' : '---';
}

// ═══════════════════════════════════════════════════
// G-OFFSET HELPER
// ═══════════════════════════════════════════════════

function gOffsetLabel(dayName: string, gameDay: string | undefined): string {
  if (!gameDay) return '    ';
  const dayNum = dayIndex(dayName);
  const gameNum = dayIndex(gameDay);
  if (dayNum < 0 || gameNum < 0) return '    ';
  let diff = dayNum - gameNum;
  if (diff > 0) diff -= 7;
  if (diff === 0) return 'GAME';
  if (diff === -6) return 'G+1 ';
  return `G${diff} `;
}

// ═══════════════════════════════════════════════════
// ASSERTIONS
// ═══════════════════════════════════════════════════

function runAssertions(
  plan: CoachingPlan,
  resolvedWeek: ResolvedDay[] | null,
  scenario: Scenario,
): AssertionResult[] {
  const results: AssertionResult[] = [];
  const sorted = [...plan.weeklyPlan].sort(
    (a, b) => monFirstDayIndex(a.dayOfWeek) - monFirstDayIndex(b.dayOfWeek)
  );
  const gameDay = scenario.onboarding.gameDay;
  const gameDayNum = dayIndex(gameDay);
  const isInSeason = scenario.onboarding.seasonPhase === 'In-season';
  const teamDaysConfigured = new Set(scenario.onboarding.teamTrainingDays || []);

  // ── Rule 0: Team-day invariant — isTeamDay flag matches dayOfWeek ──
  // Guards against cross-boundary day swaps (e.g. adjacency Strategy 2)
  // leaving a session flagged isTeamDay=true after moving it off its
  // original team-day slot. The flag must always agree with the config.
  if (teamDaysConfigured.size > 0) {
    const invariantViolations: string[] = [];
    for (const s of sorted) {
      const onTeamDay = isDayOfWeek(s.dayOfWeek) ? teamDaysConfigured.has(s.dayOfWeek) : false;
      const flagged = !!s.isTeamDay;
      if (onTeamDay && !flagged) {
        invariantViolations.push(`${s.dayOfWeek} is a team day but isTeamDay=false`);
      }
      if (!onTeamDay && flagged) {
        invariantViolations.push(`${s.dayOfWeek} is NOT a team day but isTeamDay=true (stale flag)`);
      }
    }
    results.push({
      rule: 'Team-day flag matches config (no stale isTeamDay)',
      passed: invariantViolations.length === 0,
      detail: invariantViolations.length === 0
        ? 'all team-day flags consistent'
        : `VIOLATION: ${invariantViolations.join('; ')}`,
    });
  }

  // ── Rule 1: No >2 consecutive same-region exposures ──
  {
    let maxRun = 0;
    let currentRun = 0;
    let currentRegion: Region = 'neutral';
    let prevDayIdx = -99;
    let worstRun = '';

    for (const s of sorted) {
      const dayIdx = monFirstDayIndex(s.dayOfWeek);
      const region = classifyRegion(s);

      if (region !== 'neutral' && region === currentRegion && dayIdx - prevDayIdx === 1) {
        currentRun++;
      } else if (region !== 'neutral') {
        currentRegion = region;
        currentRun = 1;
      } else {
        currentRun = 0;
        currentRegion = 'neutral';
      }

      if (currentRun > maxRun) {
        maxRun = currentRun;
        worstRun = `${currentRun}× ${currentRegion} ending ${s.dayOfWeek}`;
      }
      prevDayIdx = dayIdx;
    }

    results.push({
      rule: 'Max 2 consecutive same-region',
      passed: maxRun <= 2,
      detail: maxRun <= 2 ? `max run: ${maxRun}` : `VIOLATION: ${worstRun}`,
    });
  }

  // ── Rule 2: No heavy lower within 72h of game ──
  // ANY phase with a game (2026-07-08): H-GAME protects pre-season game
  // weeks too — S11 previously put a full lower session on G-1.
  if (gameDay && gameDayNum >= 0) {
    const g1 = DAY_NAMES[(gameDayNum + 7 - 1) % 7]; // G-1
    const g2 = DAY_NAMES[(gameDayNum + 7 - 2) % 7]; // G-2
    // 72h = G-1 and G-2 should not have heavy lower
    const violations: string[] = [];
    for (const s of sorted) {
      if (s.dayOfWeek === g1 || s.dayOfWeek === g2) {
        const region = classifyRegion(s);
        if (region === 'lower' && s.tier === 'core' && s.isHardExposure) {
          violations.push(`${s.dayOfWeek} (${s.focus})`);
        }
      }
    }
    results.push({
      rule: 'No heavy lower within 72h of game',
      passed: violations.length === 0,
      detail: violations.length === 0 ? 'clean' : `VIOLATION: ${violations.join(', ')}`,
    });
  }

  // ── Rule 3: No conditioning within 48h of game ──
  // This checks resolved week (pass 2 conditioning placement)
  if (isInSeason && gameDay && resolvedWeek) {
    const violations: string[] = [];
    for (const day of resolvedWeek) {
      if (day.source === 'conditioning' && day.workout) {
        // Check distance to game
        const dayDate = new Date(day.date + 'T12:00:00');
        // Find nearest game date in the week
        const gameDateStr = resolvedWeek.find(d => d.source === 'game')?.date;
        if (gameDateStr) {
          const gameDate = new Date(gameDateStr + 'T12:00:00');
          const diffMs = gameDate.getTime() - dayDate.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 2) {
            violations.push(`${day.date} "${day.workout.name}" (${diffDays}d before game)`);
          }
        }
      }
    }
    results.push({
      rule: 'No conditioning within 48h of game',
      passed: violations.length === 0,
      detail: violations.length === 0 ? 'clean' : `VIOLATION: ${violations.join(', ')}`,
    });
  }

  // ── Rule 4: G-1 arms/pump only ──
  // ANY phase with a game (2026-07-08): G-1 must be light regardless of phase.
  if (gameDay && gameDayNum >= 0) {
    const g1Day = DAY_NAMES[(gameDayNum + 7 - 1) % 7];
    const g1Session = sorted.find(s => s.dayOfWeek === g1Day);
    if (g1Session) {
      const focus = g1Session.focus.toLowerCase();
      // Bible Section 17.C G-1 accepted content: rest, recovery, gunshow,
      // LIGHT ACCESSORIES, mobility, very easy flush. The resolver's G-1
      // pass converts optional accessories to Gunshow for display, but the
      // plan-level label is already compliant.
      const isArmsOrPump = focus.includes('arm') || focus.includes('pump') || focus.includes('bicep') || focus.includes('tricep')
        || focus.includes('accessor') || focus.includes('prehab') || focus.includes('mobility') || focus.includes('low-fatigue');
      const isRecovery = g1Session.tier === 'recovery' || g1Session.tier === 'optional' && focus.includes('gunshow');
      // Captain's run / walkthrough is a low-load G-1 team session — acceptable
      // when the club schedules team training the day before a game.
      const isCaptainsRun = focus.includes('captain') || focus.includes('walkthrough');
      const ok = isArmsOrPump || isRecovery || isCaptainsRun;
      results.push({
        rule: 'G-1 = arms/pump or recovery only',
        passed: ok,
        detail: ok ? `${g1Day}: ${g1Session.focus.substring(0, 50)}` : `VIOLATION: ${g1Day} has "${g1Session.focus}"`,
      });
    }
  }

  // ── Rule 5: G+1 recovery ──
  if (isInSeason && gameDay && resolvedWeek) {
    const gameDateStr = resolvedWeek.find(d => d.source === 'game')?.date;
    if (gameDateStr) {
      const g1DateStr = addDays(gameDateStr, 1);
      const g1Day = resolvedWeek.find(d => d.date === g1DateStr);
      if (g1Day) {
        const isRecovery = g1Day.workout?.sessionTier === 'recovery' ||
                           g1Day.workout?.workoutType === 'Recovery' ||
                           g1Day.source === 'rest' ||
                           g1Day.source === 'none';
        results.push({
          rule: 'G+1 = recovery or rest',
          passed: isRecovery,
          detail: isRecovery
            ? `${g1DateStr}: ${g1Day.source}`
            : `VIOLATION: ${g1DateStr} is ${g1Day.source} — "${g1Day.workout?.name}"`,
        });
      }
    }
  }

  // ── Rule 6: No-game week Saturday = core ──
  if (isInSeason && !gameDay) {
    const satSession = sorted.find(s => s.dayOfWeek === 'Saturday');
    if (satSession) {
      results.push({
        rule: 'No-game week: Saturday = core',
        passed: satSession.tier === 'core',
        detail: satSession.tier === 'core'
          ? `Saturday: ${satSession.focus.substring(0, 60)}`
          : `VIOLATION: Saturday tier = ${satSession.tier}`,
      });
    } else {
      // Saturday not in selected days — not a violation
      results.push({
        rule: 'No-game week: Saturday = core',
        passed: true,
        detail: 'Saturday not in selected training days (OK)',
      });
    }
  }

  // ── Rule 7: No empty conditioning sessions ──
  if (resolvedWeek) {
    const emptyCondSessions: string[] = [];
    for (const day of resolvedWeek) {
      if (day.source === 'conditioning' && day.workout) {
        if (!day.workout.exercises || day.workout.exercises.length === 0) {
          emptyCondSessions.push(`${day.date} "${day.workout.name}"`);
        }
      }
    }
    results.push({
      rule: 'No empty conditioning sessions',
      passed: emptyCondSessions.length === 0,
      detail: emptyCondSessions.length === 0
        ? `all conditioning sessions populated`
        : `EMPTY: ${emptyCondSessions.join(', ')}`,
    });
  }

  // ── Rule 8: No empty DERIVED sessions ──
  // Template strength sessions are intentionally empty at this stage —
  // they get populated by the AI coach. Only derived sessions (conditioning,
  // game proximity, recovery placement) should have content at resolve time.
  if (resolvedWeek) {
    const empties: string[] = [];
    for (const day of resolvedWeek) {
      if (day.workout && day.source !== 'game' && day.source !== 'rest' && day.source !== 'none' && day.source !== 'template') {
        if ((!day.workout.exercises || day.workout.exercises.length === 0) &&
            day.workout.workoutType !== 'Recovery' &&
            day.workout.sessionTier !== 'recovery') {
          empties.push(`${day.date} "${day.workout.name}" (${day.source})`);
        }
      }
    }
    results.push({
      rule: 'No empty derived sessions',
      passed: empties.length === 0,
      detail: empties.length === 0 ? 'all derived sessions populated' : `EMPTY: ${empties.join(', ')}`,
    });

    // Info-only: count template sessions awaiting AI population
    const templateEmpty = resolvedWeek.filter(
      d => d.source === 'template' && d.workout &&
           (!d.workout.exercises || d.workout.exercises.length === 0) &&
           d.workout.workoutType !== 'Recovery' && d.workout.sessionTier !== 'recovery'
    );
    if (templateEmpty.length > 0) {
      results.push({
        rule: 'Template sessions awaiting AI (info)',
        passed: true, // info only, not a failure
        detail: `${templateEmpty.length} strength sessions need AI population`,
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════
// SCHEDULE STATE BUILDER
// ═══════════════════════════════════════════════════

function buildScheduleState(
  inputs: CoachingInputs,
  plan: CoachingPlan,
  gameDayOverride?: string,
  calendarOverrides?: Record<string, 'game' | 'rest'>,
  preferredTrainingDays?: string[],
): ScheduleState {
  const now = new Date().toISOString();

  // Build workouts from the coaching plan (simplified — no AI content).
  // FIDELITY (2026-07-08): carry isTeamDay + full focus as the name so the
  // stub week matches what production renders. Truncated names + dropped
  // team flags previously caused false validator positives (S13/S14
  // "sprint on G-2" was actually team training).
  const workouts: Workout[] = plan.weeklyPlan.map((s, idx) => {
    const dayNum = dayIndex(s.dayOfWeek);
    const w: Workout = {
      id: `w-test-${idx}`,
      microcycleId: 'mc-test',
      dayOfWeek: dayNum >= 0 ? dayNum : 0,
      name: s.focus,
      description: s.focus,
      durationMinutes: s.tier === 'recovery' ? 30 : s.tier === 'optional' ? 35 : 50,
      intensity: s.isHardExposure ? 'High' as const : s.tier === 'optional' ? 'Light' as const : 'Moderate' as const,
      workoutType: s.tier === 'recovery' ? 'Recovery' as const : 'Strength' as const,
      sessionTier: s.tier,
      // FIDELITY (2026-07-08, part 2): carry the engine's combined-day
      // conditioning metadata. Dropping these made S6 look like a
      // zero-conditioning week when the engine had actually planned three
      // S+C finishers — the validator/counters never saw them.
      hasCombinedConditioning: s.hasCombinedConditioning,
      conditioningFlavour: s.conditioningFlavour,
      conditioningCategory: s.conditioningCategory,
      exercises: [],
      createdAt: now,
      updatedAt: now,
    };
    if (s.isTeamDay) (w as Workout & { isTeamDay?: boolean }).isTeamDay = true;
    return w;
  });

  const microcycle: Microcycle = {
    id: 'mc-test',
    programId: 'prog-test',
    weekNumber: 1,
    startDate: BLOCK_START,
    endDate: addDays(BLOCK_START, 6),
    miniCycleNumber: 1,
    intensityMultiplier: 1.0,
    workouts,
    createdAt: now,
    updatedAt: now,
  };

  const program: TrainingProgram = {
    id: 'prog-test',
    userId: 'user-test',
    name: 'Test Program',
    description: 'QA test',
    programPhase: 'In-Season' as any,
    startDate: BLOCK_START,
    endDate: BLOCK_END,
    microcycles: [microcycle],
    primaryFocus: 'Strength',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  // Build markedDays from game day
  const markedDays: Record<string, 'game' | 'rest'> = {};
  const effectiveGameDay = gameDayOverride !== undefined ? gameDayOverride : inputs.gameDay;
  if (effectiveGameDay) {
    const gameDates = computeGameDatesForBlock(effectiveGameDay, BLOCK_START, BLOCK_END);
    for (const gd of gameDates) {
      markedDays[gd] = 'game';
    }
  }

  // Apply calendar overrides
  if (calendarOverrides) {
    for (const [date, type] of Object.entries(calendarOverrides)) {
      markedDays[date] = type;
    }
  }

  // FIDELITY (2026-07-08): mirror production useSchedule — the resolver's
  // availability hard-filter comes from raw preferredTrainingDays (NOT the
  // engine's selectedDays union). Without this the QA sweep let pass-2/3
  // place sessions on days real athletes never made available (S6/S7).
  const DAY_NAME_TO_NUMBER: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const availableDayNumbers = preferredTrainingDays && preferredTrainingDays.length > 0
    ? preferredTrainingDays
        .map((name) => DAY_NAME_TO_NUMBER[name])
        .filter((n): n is number => n !== undefined)
    : undefined;

  return {
    currentProgram: program,
    currentMicrocycle: microcycle,
    manualOverrides: {},
    markedDays,
    athleteContext: DEFAULT_ATHLETE_CONTEXT,
    seasonPhase: inputs.seasonPhase,
    readiness: plan.readiness,
    availableDayNumbers,
  };
}

// ═══════════════════════════════════════════════════
// OUTPUT FORMATTER
// ═══════════════════════════════════════════════════

function printScenario(
  scenario: Scenario,
  plan: CoachingPlan,
  resolvedWeek: ResolvedDay[] | null,
  assertions: AssertionResult[],
) {
  const gameDay = scenario.onboarding.gameDay || 'none';
  const teamDays = (scenario.onboarding.teamTrainingDays || []).join(', ') || 'none';

  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  ${scenario.name}`);
  console.log(`${'═'.repeat(72)}`);
  console.log(`  Season: ${scenario.onboarding.seasonPhase}  |  Game: ${gameDay}  |  Team: ${teamDays}`);
  if (scenario.editOps) {
    console.log(`  Edit: ${scenario.editOps.join(' → ')}`);
  }
  console.log(`  Readiness: ${plan.readiness}  |  Core: ${plan.coreSessions}  Optional: ${plan.optionalSessions}  Recovery: ${plan.recoverySessions}`);
  console.log(`${'─'.repeat(72)}`);

  // ── Coaching Plan table ──
  console.log('  COACHING PLAN:');
  console.log('  Day        Tier       Region  G     Focus');
  console.log('  ' + '─'.repeat(68));

  const sorted = [...plan.weeklyPlan].sort(
    (a, b) => monFirstDayIndex(a.dayOfWeek) - monFirstDayIndex(b.dayOfWeek)
  );

  for (const s of sorted) {
    const region = classifyRegion(s);
    const gLabel = gOffsetLabel(s.dayOfWeek || '', scenario.onboarding.gameDay);
    const focusTrunc = s.focus.length > 45 ? s.focus.substring(0, 42) + '...' : s.focus;
    console.log(
      `  ${(s.dayOfWeek || '?').padEnd(10)} ${s.tier.padEnd(10)} ${regionLabel(region).padEnd(7)} ${gLabel.padEnd(5)} ${focusTrunc}`
    );
  }

  // ── Resolved Week table (if available) ──
  if (resolvedWeek) {
    console.log('');
    console.log('  RESOLVED WEEK:');
    console.log('  Date        Day   Source         Indicator    Session');
    console.log('  ' + '─'.repeat(68));

    for (const day of resolvedWeek) {
      const dayShort = day.short;
      const source = (day.source || '').padEnd(13);
      const indicator = (day.indicator || '').padEnd(12);
      let session = '(off)';
      if (day.workout) {
        session = day.workout.name;
        if (day.workout.exercises && day.workout.exercises.length > 0) {
          session += ` [${day.workout.exercises.length} ex]`;
        } else if (day.source !== 'game' && day.workout.workoutType !== 'Recovery' && day.workout.sessionTier !== 'recovery') {
          session += ' ⚠ EMPTY';
        }
      }
      const sessionTrunc = session.length > 40 ? session.substring(0, 37) + '...' : session;
      console.log(`  ${day.date}  ${dayShort}   ${source} ${indicator} ${sessionTrunc}`);
    }

    // ── Conditioning detail ──
    const condDays = resolvedWeek.filter(d => d.source === 'conditioning' && d.workout);
    if (condDays.length > 0) {
      console.log('');
      console.log('  CONDITIONING DETAIL:');
      for (const cd of condDays) {
        console.log(`  ${cd.date} — ${cd.workout!.name} (${cd.workout!.durationMinutes}min, ${cd.workout!.intensity})`);
        for (const ex of cd.workout!.exercises || []) {
          const exName = ex.exercise?.name || ex.exerciseId;
          const notes = ex.notes ? `: ${ex.notes.substring(0, 70)}${ex.notes.length > 70 ? '...' : ''}` : '';
          console.log(`    ${ex.exerciseOrder}. ${exName}${notes}`);
        }
      }
    }
  }

  // ── Assertions ──
  console.log('');
  console.log('  ASSERTIONS:');
  let allPassed = true;
  for (const a of assertions) {
    const icon = a.passed ? '✅' : '❌';
    console.log(`  ${icon} ${a.rule}: ${a.detail}`);
    if (!a.passed) allPassed = false;
  }
  console.log(`\n  ${allPassed ? '✅ ALL PASSED' : '❌ FAILURES DETECTED'}`);
}

// ═══════════════════════════════════════════════════
// SCENARIOS
// ═══════════════════════════════════════════════════

const BASE_PROFILE: Partial<OnboardingData> = {
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingIntensity: 'Hard',
  sprintExposure: '2+ times per week',
  conditioningLevel: 'Good',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Get stronger, Run faster',
};

const scenarios: Scenario[] = [
  // ── Game day permutations ──
  {
    name: 'S1: In-season, Saturday game (baseline)',
    onboarding: { ...BASE_PROFILE, seasonPhase: 'In-season', gameDay: 'Saturday' },
  },
  {
    name: 'S2: In-season, Sunday game',
    onboarding: {
      ...BASE_PROFILE,
      seasonPhase: 'In-season',
      gameDay: 'Sunday',
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      trainingDaysPerWeek: 6,
    },
  },
  {
    name: 'S3: In-season, Friday night game',
    onboarding: {
      ...BASE_PROFILE,
      seasonPhase: 'In-season',
      gameDay: 'Friday',
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
      trainingDaysPerWeek: 5,
    },
  },
  {
    name: 'S4: In-season, NO game (bye week)',
    onboarding: {
      ...BASE_PROFILE,
      seasonPhase: 'In-season',
      gameDay: undefined,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      trainingDaysPerWeek: 6,
    },
  },

  // ── Off-season ──
  {
    name: 'S5: Off-season, 5 days, team Tue+Thu',
    onboarding: { ...BASE_PROFILE, seasonPhase: 'Off-season', gameDay: undefined },
  },
  {
    name: 'S6: Off-season, 4 days, no team training',
    onboarding: {
      seasonPhase: 'Off-season',
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
      teamTrainingDaysPerWeek: 0,
      teamTrainingDays: [],
      conditioningLevel: 'Good',
      recentTrainingLoad: 'Pretty consistent',
      injuries: [],
      motivation: 'Get stronger',
      gameDay: undefined,
    },
  },
  {
    name: 'S7: Off-season, 6 days, team Mon+Wed+Fri',
    onboarding: {
      seasonPhase: 'Off-season',
      trainingDaysPerWeek: 6,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      teamTrainingDaysPerWeek: 3,
      teamTrainingDays: ['Monday', 'Wednesday', 'Friday'],
      teamTrainingIntensity: 'Moderate',
      conditioningLevel: 'Good',
      recentTrainingLoad: 'Very consistent',
      injuries: [],
      motivation: 'Get stronger',
      gameDay: undefined,
    },
  },

  // ── Team training combos ──
  {
    name: 'S8: In-season Sat game, team Mon+Wed (not typical Tue+Thu)',
    onboarding: {
      ...BASE_PROFILE,
      seasonPhase: 'In-season',
      gameDay: 'Saturday',
      teamTrainingDays: ['Monday', 'Wednesday'],
    },
  },
  {
    name: 'S9: In-season Sat game, team Tue only',
    onboarding: {
      ...BASE_PROFILE,
      seasonPhase: 'In-season',
      gameDay: 'Saturday',
      teamTrainingDaysPerWeek: 1,
      teamTrainingDays: ['Tuesday'],
    },
  },
  {
    name: 'S10: In-season Sat game, team Tue+Wed+Thu (3 consecutive)',
    onboarding: {
      ...BASE_PROFILE,
      seasonPhase: 'In-season',
      gameDay: 'Saturday',
      teamTrainingDaysPerWeek: 3,
      teamTrainingDays: ['Tuesday', 'Wednesday', 'Thursday'],
    },
  },

  // ── Pre-season ──
  {
    name: 'S11: Pre-season, Sat game, 5 days',
    onboarding: { ...BASE_PROFILE, seasonPhase: 'Pre-season', gameDay: 'Saturday' },
  },
  {
    name: 'S12: Pre-season, no game, 5 days',
    onboarding: { ...BASE_PROFILE, seasonPhase: 'Pre-season', gameDay: undefined },
  },

  // ── Edit-driven: remove game ──
  {
    name: 'E1: Remove game — Sat game → no game',
    onboarding: {
      ...BASE_PROFILE,
      seasonPhase: 'In-season',
      gameDay: undefined, // game removed
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      trainingDaysPerWeek: 6,
    },
    editFrom: 'S1',
    editOps: ['Removed Saturday game from calendar', 'Saturday now available for training'],
  },

  // ── Edit-driven: move game ──
  {
    name: 'E2: Move game — Sat → Sun',
    onboarding: {
      ...BASE_PROFILE,
      seasonPhase: 'In-season',
      gameDay: 'Sunday',
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      trainingDaysPerWeek: 6,
    },
    editFrom: 'S1',
    editOps: ['Moved game from Saturday to Sunday', 'Saturday now available for training'],
  },

  // ── Edit-driven: add game back ──
  {
    name: 'E3: Add game back — no game → Sat game',
    onboarding: { ...BASE_PROFILE, seasonPhase: 'In-season', gameDay: 'Saturday' },
    editFrom: 'E1',
    editOps: ['Re-added Saturday game to calendar', 'Saturday returns to game day'],
  },

  // ── Edge cases ──
  {
    name: 'S13: In-season, 3 days only (Mon/Wed/Fri), Sat game',
    onboarding: {
      seasonPhase: 'In-season',
      trainingDaysPerWeek: 3,
      preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Tuesday', 'Thursday'],
      teamTrainingIntensity: 'Hard',
      conditioningLevel: 'Average',
      recentTrainingLoad: 'Pretty consistent',
      injuries: [],
      motivation: 'Get stronger',
      gameDay: 'Saturday',
    },
  },
  {
    name: 'S14: In-season, low readiness, injuries',
    onboarding: {
      seasonPhase: 'In-season',
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Tuesday', 'Thursday'],
      teamTrainingIntensity: 'Hard',
      conditioningLevel: 'Poor',
      recentTrainingLoad: 'Hardly at all',
      injuries: [
        { bodyArea: 'Knee', description: 'Knee pain when running', severity: 'Moderate', whenItHurts: 'Running' },
        { bodyArea: 'Shoulder', description: 'Mild shoulder niggle', severity: 'Mild', whenItHurts: 'Lifting' },
      ],
      motivation: 'Get stronger',
      gameDay: 'Saturday',
    },
  },
];

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

let totalPassed = 0;
let totalFailed = 0;

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║              WEEK PLAN QA HARNESS — STRUCTURAL TESTS               ║');
console.log('║              Testing coaching engine + resolver pipeline            ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`\nScenarios: ${scenarios.length}`);
console.log(`Block: ${BLOCK_START} → ${BLOCK_END}`);
console.log(`Test week: ${TEST_MONDAY} (Mon)`);

for (const scenario of scenarios) {
  const inputs = onboardingToCoachingInputs(scenario.onboarding as OnboardingData);
  const plan = buildCoachingPlan(inputs);

  // Build schedule state and resolve week with conditioning
  let resolvedWeek: ResolvedDay[] | null = null;
  try {
    const schedState = buildScheduleState(inputs, plan, undefined, scenario.calendarOverrides, scenario.onboarding.preferredTrainingDays);
    resolvedWeek = resolveWeekWithConditioning(TEST_MONDAY, schedState);
  } catch (err: any) {
    console.log(`\n⚠️ Resolver error for "${scenario.name}": ${err.message}`);
  }

  const assertions = runAssertions(plan, resolvedWeek, scenario);

  // ── Phase 2 rules kernel: Bible validator findings (REPORT-ONLY) ──
  // Findings never affect QA pass/fail — observability only. Two FIDELITY
  // assertions below DO count: they guard against harness-induced false
  // positives, not against genuine findings.
  const findingLines: string[] = [];
  if (resolvedWeek) {
    try {
      const validatorDays = validatorDaysFromResolvedWeek(resolvedWeek);
      const validatorProfile = {
        seasonPhase: scenario.onboarding.seasonPhase,
        teamTrainingIntensity: scenario.onboarding.teamTrainingIntensity,
        conditioningLevel: scenario.onboarding.conditioningLevel,
        experienceLevel: scenario.onboarding.experienceLevel,
      };
      const report = validateProgramWeek({
        days: validatorDays,
        profile: validatorProfile,
        weekFlags: deriveWeekValidationFlags({ days: validatorDays, profile: validatorProfile }),
      });
      if (report.findings.length > 0) {
        findingLines.push('  📖 Bible validator findings (report-only, not failures):');
        for (const f of report.findings) {
          findingLines.push(`     [${f.severity}] ${f.ruleId}: ${f.message}`);
        }
      } else {
        findingLines.push('  📖 Bible validator: no findings');
      }

      // Fidelity assertion 1: no game-proximity finding may target the team
      // training session itself (normal club load is exempt by the Bible).
      const ttDates = new Set(
        resolvedWeek
          .filter((d) => d.workout && isTeamTrainingSession(d.workout as never))
          .map((d) => d.date),
      );
      const ttFalsePositives = report.findings.filter(
        (f) =>
          ['g2_sprint_cod', 'g2_hard_conditioning', 'g1_not_light', 'g_plus1_hard_work'].includes(f.ruleId) &&
          f.dates.some((dt) => ttDates.has(dt)) &&
          f.sessions.every((s) => /^\s*team training/i.test(s)),
      );
      assertions.push({
        rule: 'No validator false positives on team-training sessions',
        passed: ttFalsePositives.length === 0,
        detail: ttFalsePositives.length === 0
          ? 'clean'
          : `FALSE POSITIVE: ${ttFalsePositives.map((f) => `${f.ruleId}@${f.dates.join(',')}`).join('; ')}`,
      });

      // Conditioning coverage floor: an off-season athlete must never get a
      // ZERO/near-zero conditioning week just because strength fills every
      // preferred day — the engine's S+C combined-day machinery (H5a +
      // in-loop scorer) must deliver at least the MIN_COND_FLOOR of 2.
      // (On-feet sprint finishers count as sprint exposure, not
      // conditioning, so the floor here is 2, not the 3-5 Bible range.)
      if (scenario.onboarding.seasonPhase === 'Off-season') {
        const condCount = report.counts.conditioningExposures;
        assertions.push({
          rule: 'Off-season conditioning floor (≥2 exposures incl. S+C finishers)',
          passed: condCount >= 2,
          detail: `conditioning exposures: ${condCount}`,
        });
      }
    } catch (err: any) {
      findingLines.push(`  📖 Bible validator error (non-fatal): ${err?.message ?? err}`);
    }

    // Fidelity assertion 2: pass-2/3 placements (conditioning/recovery)
    // must land on preferred training days only — mirrors production's
    // availability hard-filter.
    const prefDays = scenario.onboarding.preferredTrainingDays;
    if (prefDays && prefDays.length > 0) {
      const allowed = new Set(prefDays);
      const violations = resolvedWeek
        .filter((d) => d.workout && (d.source === 'conditioning' || d.source === 'recovery'))
        .filter((d) => !allowed.has(DAY_NAMES[d.dayOfWeek]))
        .map((d) => `${DAY_NAMES[d.dayOfWeek]} (${d.source}: ${d.workout?.name?.slice(0, 30)})`);
      assertions.push({
        rule: 'Availability: pass-2/3 placements on preferred days only',
        passed: violations.length === 0,
        detail: violations.length === 0 ? 'clean' : `VIOLATION: ${violations.join('; ')}`,
      });
    }
  }

  printScenario(scenario, plan, resolvedWeek, assertions);
  for (const line of findingLines) console.log(line);

  for (const a of assertions) {
    if (a.passed) totalPassed++;
    else totalFailed++;
  }
}

// ── Summary ──
console.log(`\n${'═'.repeat(72)}`);
console.log(`  SUMMARY: ${totalPassed} passed, ${totalFailed} failed across ${scenarios.length} scenarios`);
console.log(`${'═'.repeat(72)}`);

if (totalFailed > 0) {
  console.log('\n  ❌ FAILURES:');
  // Re-run assertions just for failures
  for (const scenario of scenarios) {
    const inputs = onboardingToCoachingInputs(scenario.onboarding as OnboardingData);
    const plan = buildCoachingPlan(inputs);
    let resolvedWeek: ResolvedDay[] | null = null;
    try {
      const schedState = buildScheduleState(inputs, plan, undefined, scenario.calendarOverrides, scenario.onboarding.preferredTrainingDays);
      resolvedWeek = resolveWeekWithConditioning(TEST_MONDAY, schedState);
    } catch { /* skip */ }
    const assertions = runAssertions(plan, resolvedWeek, scenario);
    const failures = assertions.filter(a => !a.passed);
    if (failures.length > 0) {
      console.log(`  ${scenario.name}:`);
      for (const f of failures) {
        console.log(`    ❌ ${f.rule}: ${f.detail}`);
      }
    }
  }
}

process.exit(totalFailed > 0 ? 1 : 0);
