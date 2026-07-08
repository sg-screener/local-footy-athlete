/**
 * weekRebuildIntegrationTests — canonical Week Rebuild Context.
 *
 * These tests drive the EXACT production entry points, not helpers:
 *   • Busy/Away    → executeProgramControlAction('set_schedule_modifier')
 *   • Bin          → applyPlanChange({ kind: 'remove_session' })
 *   • Swap         → applyPlanChange({ kind: 'swap_category' })
 *   • Move         → applyPlanChange({ kind: 'move_session' })
 *   • Add          → applyPlanChange({ kind: 'add_category' })
 *   • Readiness    → coachUpdatesStore constraint
 * …then rebuild through the ONE canonical door (rebuildLocalWeek) and
 * assert on the RESOLVED week from the live stores.
 *
 * Invariant under test (Sam, 2026-07-08): no rebuild may forget active
 * context. A user-removed day only returns if the user clears the owning
 * adjustment, or the rebuild explicitly reports a game-window conflict.
 *
 * global.fetch is poisoned — any network use fails the whole suite.
 *
 * Run: npm run test:week-rebuild
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — rebuilds must be fully local');
};

import { rebuildLocalWeek } from '../utils/weekRebuild';
import {
  resolveWeekWithConditioning,
  addDays,
  type ScheduleState,
  type ResolvedDay,
} from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import { useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import type { OnboardingData } from '../types/domain';

// Late-bound requires: these modules sit in an import cycle under the CJS
// test runner; their exports resolve only after the graph settles.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { executeProgramControlAction } =
  require('../utils/programControlActions') as typeof import('../utils/programControlActions');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { applyPlanChange } =
  require('../utils/planChangeProducer') as typeof import('../utils/planChangeProducer');

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

const PRESEASON: Partial<OnboardingData> = {
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

const IN_SEASON: Partial<OnboardingData> = {
  ...PRESEASON,
  seasonPhase: 'In-season',
  gameDay: 'Saturday',
  usualGameDay: 'Saturday',
};

// Live calendar marks for the simulated environment.
let markedDays: Record<string, 'game' | 'rest'> = {};

/** Resolve a week Monday from the LIVE stores (as production does). */
function resolveLiveWeek(mondayISO: string, seasonPhase: string, gameDay?: string): ResolvedDay[] {
  const ps = useProgramStore.getState();
  const state: ScheduleState = {
    currentProgram: ps.currentProgram,
    currentMicrocycle: ps.currentMicrocycle,
    manualOverrides: ps.dateOverrides,
    markedDays,
    athleteContext: DEFAULT_ATHLETE_CONTEXT,
    seasonPhase: seasonPhase as ScheduleState['seasonPhase'],
    gameDay: gameDay as never,
    readiness: 'high',
    availableDayNumbers: [1, 2, 3, 4, 5],
  };
  return resolveWeekWithConditioning(mondayISO, state);
}

function resetWorld() {
  useProgramStore.getState().clearManualOverrides();
  useCoachUpdatesStore.setState((s: unknown) => ({
    ...(s as object),
    activeConstraints: [],
  }) as never);
  markedDays = {};
}

/** Seed a no-game program through the canonical door. */
function seed(profile: Partial<OnboardingData>) {
  resetWorld();
  const result = rebuildLocalWeek({
    baseProfile: profile as OnboardingData,
    newGameDay: null,
  });
  return result.program;
}

/** Add the Saturday game through the canonical door (as the tap does). */
function addSaturdayGame(profile: Partial<OnboardingData>, satDate: string) {
  return rebuildLocalWeek({
    baseProfile: profile as OnboardingData,
    newGameDay: 'Saturday',
    commitGameMark: () => { markedDays[satDate] = 'game'; },
  });
}

const dayOf = (week: ResolvedDay[], date: string) => week.find((d) => d.date === date);

// ═════════════════════════════════════════════════════════════════════
function runRemovalMatrix(label: string, profile: Partial<OnboardingData>) {
  console.log(`\n── ${label}: removal/edit paths × add Saturday game ──`);
  const program = seed(profile);
  const blockStart = program.startDate.split('T')[0];
  const todayISO = blockStart;
  const wk2Mon = addDays(blockStart, 7);
  const wk2Wed = addDays(blockStart, 9);
  const wk2Sat = addDays(blockStart, 12);

  // ── A. Busy/Away: remove FUTURE-week Monday via the real action ──
  {
    const visibleWeek = resolveLiveWeek(wk2Mon, profile.seasonPhase!, undefined);
    const result = executeProgramControlAction({
      type: 'set_schedule_modifier',
      source: { screen: 'program_tab', surface: 'busy_away_sheet_away', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: {
        date: wk2Mon,
        todayISO,
        reasonLabel: 'Away',
        planChange: { kind: 'clear_days', dates: [wk2Mon] },
      },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { visibleWeek, todayISO });
    ok(`[A] away action applied (${result.route})`, result.ok === true, JSON.stringify(result));

    const before = resolveLiveWeek(wk2Mon, profile.seasonPhase!, undefined);
    ok('[A] Monday cleared before rebuild',
      !/lower|upper|strength/i.test(dayOf(before, wk2Mon)?.workout?.name ?? ''),
      dayOf(before, wk2Mon)?.workout?.name ?? '(off)');

    const rebuild = addSaturdayGame(profile, wk2Sat);
    const after = resolveLiveWeek(wk2Mon, profile.seasonPhase!, 'Saturday');
    ok('[A] Monday STAYS removed after adding Saturday game',
      !/lower|upper|full body|strength session/i.test(dayOf(after, wk2Mon)?.workout?.name ?? ''),
      `${dayOf(after, wk2Mon)?.source}: ${dayOf(after, wk2Mon)?.workout?.name ?? '(off)'}`);
    ok('[A] Saturday is Game Day', dayOf(after, wk2Sat)?.workout?.workoutType === 'Game');
    const fri = after.find((d) => d.dayOfWeek === 5);
    ok('[A] Friday (G-1) light', !fri?.workout || fri.workout.sessionTier !== 'core',
      `${fri?.workout?.sessionTier}: ${fri?.workout?.name}`);
    ok('[A] away Coach Note still active',
      useCoachUpdatesStore.getState().activeConstraints.some((c) => String(c.id).includes('away')));
    ok('[A] no conflicts reported (away Monday is G-5, safe)',
      rebuild.sweep.conflictsRemoved.length === 0, JSON.stringify(rebuild.sweep.conflictsRemoved));
  }

  // ── B. Bin Monday via the session sheet's real path ──
  {
    seed(profile);
    const visibleWeek = resolveLiveWeek(wk2Mon, profile.seasonPhase!, undefined);
    const res = applyPlanChange({
      change: { kind: 'remove_session', date: wk2Mon },
      visibleWeek,
      todayISO,
      setManualOverride: (d, w, c) => useProgramStore.getState().setManualOverride(d, w!, c),
    });
    ok(`[B] bin applied: ${res.message ?? ''}`, res.ok === true, JSON.stringify(res.rejected));

    addSaturdayGame(profile, wk2Sat);
    const after = resolveLiveWeek(wk2Mon, profile.seasonPhase!, 'Saturday');
    ok('[B] binned Monday does NOT resurrect after adding the game',
      dayOf(after, wk2Mon)?.source === 'manual' &&
      !/lower|upper|full body/i.test(dayOf(after, wk2Mon)?.workout?.name ?? ''),
      `${dayOf(after, wk2Mon)?.source}: ${dayOf(after, wk2Mon)?.workout?.name}`);
  }

  // ── C. Swap Monday to recovery via the sheet's real path ──
  {
    seed(profile);
    const visibleWeek = resolveLiveWeek(wk2Mon, profile.seasonPhase!, undefined);
    const res = applyPlanChange({
      change: { kind: 'swap_category', date: wk2Mon, category: 'recovery' },
      visibleWeek,
      todayISO,
      setManualOverride: (d, w, c) => useProgramStore.getState().setManualOverride(d, w!, c),
    });
    ok(`[C] swap-to-recovery applied: ${res.message ?? ''}`, res.ok === true, JSON.stringify(res.rejected));

    addSaturdayGame(profile, wk2Sat);
    const after = resolveLiveWeek(wk2Mon, profile.seasonPhase!, 'Saturday');
    ok('[C] Monday stays recovery — does not return as lower strength',
      !/lower|squat|hinge/i.test(dayOf(after, wk2Mon)?.workout?.name ?? ''),
      dayOf(after, wk2Mon)?.workout?.name);
  }

  // ── D. Move Monday's session to the empty Sunday (plain move) ──
  {
    seed(profile);
    const wk2Sun = addDays(blockStart, 13);
    const visibleWeek = resolveLiveWeek(wk2Mon, profile.seasonPhase!, undefined);
    const res = applyPlanChange({
      change: { kind: 'move_session', fromDate: wk2Mon, toDate: wk2Sun },
      visibleWeek,
      todayISO,
      setManualOverride: (d, w, c) => useProgramStore.getState().setManualOverride(d, w!, c),
    });
    ok(`[D] move applied: ${res.message ?? ''}`, res.ok === true, JSON.stringify(res.rejected));

    addSaturdayGame(profile, wk2Sat);
    const after = resolveLiveWeek(wk2Mon, profile.seasonPhase!, 'Saturday');
    ok('[D] original Monday does not resurrect (stays rest/moved-away)',
      dayOf(after, wk2Mon)?.source === 'manual' &&
      !/lower|upper|full body/i.test(dayOf(after, wk2Mon)?.workout?.name ?? ''),
      `${dayOf(after, wk2Mon)?.source}: ${dayOf(after, wk2Mon)?.workout?.name}`);
    ok('[D] moved content still on its destination day',
      dayOf(after, wk2Sun)?.source === 'manual', `${dayOf(after, wk2Sun)?.source}: ${dayOf(after, wk2Sun)?.workout?.name}`);
  }

  // ── E. Manually added session: safe one preserved, G-1 hard one resolved ──
  {
    seed(profile);
    const wk2Sun = addDays(blockStart, 13);
    const wk2Fri = addDays(blockStart, 11);
    const visibleWeek = resolveLiveWeek(wk2Mon, profile.seasonPhase!, undefined);
    // Safe addition on the empty Sunday (light conditioning).
    const resSafe = applyPlanChange({
      change: { kind: 'add_category', date: wk2Sun, category: 'conditioning_light' },
      visibleWeek,
      todayISO,
      setManualOverride: (d, w, c) => useProgramStore.getState().setManualOverride(d, w!, c),
    });
    ok(`[E] safe add applied: ${resSafe.message ?? ''}`, resSafe.ok === true, JSON.stringify(resSafe.rejected));
    // Hard conditioning added onto Friday (will be G-1 once the game lands).
    // Either outcome is correct protection: the producer may refuse the add
    // outright (its own menu policy), or accept it — in which case the game
    // rebuild MUST resolve it out loud.
    const resHard = applyPlanChange({
      change: { kind: 'add_category', date: wk2Fri, category: 'conditioning_hard' },
      visibleWeek,
      todayISO,
      setManualOverride: (d, w, c) => useProgramStore.getState().setManualOverride(d, w!, c),
    });

    const rebuild = addSaturdayGame(profile, wk2Sat);
    ok('[E] safe Sunday addition preserved through the game rebuild',
      !resSafe.ok || rebuild.sweep.preserve.includes(wk2Sun), JSON.stringify(rebuild.sweep));
    ok('[E] hard Friday addition never survives silently near the game',
      !resHard.ok || rebuild.sweep.conflictsRemoved.some((c) => c.date === wk2Fri),
      `applied=${resHard.ok} sweep=${JSON.stringify(rebuild.sweep)}`);
  }

  // ── F. Low readiness / reduced load survives the rebuild ──
  {
    seed(profile);
    useCoachUpdatesStore.getState().upsertActiveConstraint({
      id: 'tap-recovery-mode:integration',
      type: 'fatigue',
      severity: 7,
      status: 'active',
      startDate: new Date().toISOString(),
      blockedExposures: [], limitedExposures: [], allowedExposures: [],
      safeFocus: ['Recovery + mobility'],
      label: 'reduced load (integration)',
    } as never);
    addSaturdayGame(profile, wk2Sat);
    ok('[F] readiness/reduced-load constraint survives the rebuild',
      useCoachUpdatesStore.getState().activeConstraints.some((c) => c.id === 'tap-recovery-mode:integration'));
  }

  // ── H. Refresh/rebuild again: preservation is idempotent ──
  {
    seed(profile);
    const visibleWeek = resolveLiveWeek(wk2Mon, profile.seasonPhase!, undefined);
    applyPlanChange({
      change: { kind: 'remove_session', date: wk2Mon },
      visibleWeek,
      todayISO,
      setManualOverride: (d, w, c) => useProgramStore.getState().setManualOverride(d, w!, c),
    });
    addSaturdayGame(profile, wk2Sat);
    const second = addSaturdayGame(profile, wk2Sat); // "refresh" — rebuild again
    ok('[H] second rebuild still preserves the removed Monday',
      second.sweep.preserve.includes(wk2Mon), JSON.stringify(second.sweep));
    const after = resolveLiveWeek(wk2Mon, profile.seasonPhase!, 'Saturday');
    ok('[H] resolved week still shows Monday removed',
      !/lower|upper|full body/i.test(dayOf(after, wk2Mon)?.workout?.name ?? ''),
      dayOf(after, wk2Mon)?.workout?.name);
  }
}

runRemovalMatrix('PRE-SEASON', PRESEASON);
runRemovalMatrix('IN-SEASON (G)', IN_SEASON);
resetWorld();

// ═════════════════════════════════════════════════════════════════════
console.log('\n── Architectural guard: one canonical rebuild door ──');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  const read = (p: string) => fs.readFileSync(`${__dirname}/${p}`, 'utf8') as string;
  const home = read('../screens/home/useHomeScreen.ts');
  ok('useHomeScreen rebuilds ONLY via rebuildLocalWeek (no direct generateProgramLocally)',
    /rebuildLocalWeek\(/.test(home) && !/generateProgramLocally\(/.test(home));
  ok('useHomeScreen never calls the raw store sweep or blanket clear',
    !/clearManualOverridesPreservingActiveModifiers\(/.test(home) &&
    !/\bclearManualOverrides\(\)/.test(home));
  ok('AI rebuild path commits through the shared canonical policy',
    /decideSweepForCurrentStores\(/.test(home) && /commitRebuiltProgram\(/.test(home));
}

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`weekRebuildIntegrationTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n  - ' + failures.join('\n  - '));
process.exit(fail > 0 ? 1 : 0);
