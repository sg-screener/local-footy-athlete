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
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';

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

const IN_SEASON_SIX_DAY: Partial<OnboardingData> = {
  ...IN_SEASON,
  trainingDaysPerWeek: 6,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const PRESEASON_NO_TEAM_4_DAY: Partial<OnboardingData> = {
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  teamTrainingIntensity: 'Moderate',
  sprintExposure: 'Occasionally',
  conditioningLevel: 'Good',
  recentTrainingLoad: 'Pretty consistent',
  injuries: [],
  motivation: 'Build the base',
};

// Live calendar marks for the simulated environment.
let markedDays: ScheduleState['markedDays'] = {};

/** Resolve a week Monday from the LIVE stores (as production does). */
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

function resetWorld() {
  useProgramStore.getState().clearManualOverrides();
  useProgramStore.getState().clearWeekScopedOverlays();
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
    scope: 'weekOverlay',
    targetDate: satDate,
    commitGameMark: () => { markedDays[satDate] = 'game'; },
  });
}

const dayOf = (week: ResolvedDay[], date: string) => week.find((d) => d.date === date);

function visibleWeekSignature(week: ResolvedDay[]): string {
  const identityKeys = new Set([
    'id',
    'microcycleId',
    'workoutId',
    'exerciseId',
    'createdAt',
    'updatedAt',
  ]);
  return JSON.stringify(week, (key, value) => identityKeys.has(key) ? undefined : value);
}

function weekShapeSignature(week: ResolvedDay[]): string {
  return JSON.stringify(week.map((day) => ({
    date: day.date,
    source: day.source,
    indicator: day.indicator,
    // A one-off overlay may rebuild a valid deterministic conditioning dose
    // from a different block-local week index. Preserve structural identity
    // here without requiring the same 2x10 vs 3x8 aerobic rotation variant.
    name: day.workout?.workoutType === 'Conditioning'
      ? day.workout.conditioningCategory ?? 'conditioning'
      : day.workout?.name ?? null,
    workoutType: day.workout?.workoutType ?? null,
    sessionTier: day.workout?.sessionTier ?? null,
    conditioningCategory: day.workout?.conditioningCategory ?? null,
    hasCombinedConditioning: day.workout?.hasCombinedConditioning ?? false,
  })));
}

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

  // ── D. Move Monday's session to Sunday; adding a Saturday game makes that
  // destination G+1, so the hard moved session is cleared/reported.
  // Light Sunday additions are covered in E below.
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

    const rebuild = addSaturdayGame(profile, wk2Sat);
    const after = resolveLiveWeek(wk2Mon, profile.seasonPhase!, 'Saturday');
    ok('[D] original Monday does not resurrect (stays rest/moved-away)',
      dayOf(after, wk2Mon)?.source === 'manual' &&
      !/lower|upper|full body/i.test(dayOf(after, wk2Mon)?.workout?.name ?? ''),
      `${dayOf(after, wk2Mon)?.source}: ${dayOf(after, wk2Mon)?.workout?.name}`);
    ok('[D] hard moved content onto G+1 is cleared/reported',
      rebuild.sweep.conflictsRemoved.some((c) => c.date === wk2Sun) &&
      dayOf(after, wk2Sun)?.source === 'gameProximity',
      `${dayOf(after, wk2Sun)?.source}: ${dayOf(after, wk2Sun)?.workout?.name} sweep=${JSON.stringify(rebuild.sweep)}`);
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

// ═════════════════════════════════════════════════════════════════════
console.log('\n── Week-scoped practice match overlay does not pollute future no-game weeks ──');
{
  const program = seed(PRESEASON_NO_TEAM_4_DAY);
  const baseTemplateSignature = (useProgramStore.getState().currentMicrocycle?.workouts ?? [])
    .map((w) => `${w.dayOfWeek}:${w.name}:${w.workoutType}`)
    .sort()
    .join('|');
  const blockStart = program.startDate.split('T')[0];
  const wk2Mon = addDays(blockStart, 7);
  const wk2Sat = addDays(blockStart, 12);
  const wk3Mon = addDays(blockStart, 14);

  const futureBefore = resolveLiveWeek(wk3Mon, 'Pre-season', undefined);
  const futureBeforeSig = futureBefore
    .map((d) => `${d.dayOfWeek}:${d.workout?.name ?? 'OFF'}:${d.workout?.workoutType ?? 'OFF'}`)
    .join('|');

  // Athlete blocks Monday in the selected future week before adding a practice match.
  useProgramStore.getState().setManualOverride(wk2Mon, {
    id: `away-${wk2Mon}`,
    microcycleId: 'manual',
    dayOfWeek: 1,
    name: 'Rest — away',
    description: 'Cleared while away.',
    durationMinutes: 0,
    intensity: 'Light',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    exercises: [],
    createdAt: '',
    updatedAt: '',
  } as never, { intent: 'program_adjustment', label: 'Away' });

  const rebuild = addSaturdayGame(PRESEASON_NO_TEAM_4_DAY, wk2Sat);
  const selected = resolveLiveWeek(wk2Mon, 'Pre-season', 'Saturday');
  const futureAfter = resolveLiveWeek(wk3Mon, 'Pre-season', undefined);
  const futureAfterSig = futureAfter
    .map((d) => `${d.dayOfWeek}:${d.workout?.name ?? 'OFF'}:${d.workout?.workoutType ?? 'OFF'}`)
    .join('|');
  const overlays = useProgramStore.getState().weekScopedOverlays;
  const afterTemplateSignature = (useProgramStore.getState().currentMicrocycle?.workouts ?? [])
    .map((w) => `${w.dayOfWeek}:${w.name}:${w.workoutType}`)
    .sort()
    .join('|');

  ok('selected week gets a week-scoped overlay',
    !!rebuild.overlay && Object.keys(overlays).includes(wk2Mon),
    JSON.stringify({ overlay: rebuild.overlay?.weekStart, keys: Object.keys(overlays) }));
  ok('selected week Saturday renders as Game Day',
    dayOf(selected, wk2Sat)?.workout?.workoutType === 'Game',
    dayOf(selected, wk2Sat)?.workout?.name);
  ok('selected week Monday away override still wins over the overlay',
    dayOf(selected, wk2Mon)?.source === 'manual' &&
    /away|rest/i.test(dayOf(selected, wk2Mon)?.workout?.name ?? ''),
    `${dayOf(selected, wk2Mon)?.source}: ${dayOf(selected, wk2Mon)?.workout?.name}`);
  ok('future no-game week signature is unchanged after adding the match',
    futureAfterSig === futureBeforeSig,
    `before=${futureBeforeSig}\nafter=${futureAfterSig}`);
  ok('future no-game week does not inherit the selected week overlay',
    !Object.keys(overlays).includes(wk3Mon) &&
    futureAfter.every((d) => d.workout?.workoutType !== 'Game') &&
    futureAfter.every((d) => !/gunshow/i.test(d.workout?.name ?? '')),
    futureAfter.map((d) => `${d.short}:${d.workout?.name ?? 'OFF'}`).join(' | '));
  ok('base currentMicrocycle template was not replaced by the with-game candidate',
    afterTemplateSignature === baseTemplateSignature,
    `before=${baseTemplateSignature}\nafter=${afterTemplateSignature}`);

  const remove = rebuildLocalWeek({
    baseProfile: PRESEASON_NO_TEAM_4_DAY as OnboardingData,
    newGameDay: null,
    scope: 'weekOverlay',
    targetDate: wk2Sat,
    commitGameMark: () => { delete markedDays[wk2Sat]; },
  });
  ok('removing the practice match clears the selected-week overlay',
    !remove.overlay && !Object.keys(useProgramStore.getState().weekScopedOverlays).includes(wk2Mon),
    JSON.stringify(useProgramStore.getState().weekScopedOverlays));
  const selectedAfterRemove = resolveLiveWeek(wk2Mon, 'Pre-season', undefined);
  ok('removed match week returns to base no-game shape aside from the manual Monday away edit',
    selectedAfterRemove.every((d) => d.workout?.workoutType !== 'Game') &&
    selectedAfterRemove.every((d) => !/gunshow/i.test(d.workout?.name ?? '')),
    selectedAfterRemove.map((d) => `${d.short}:${d.source}:${d.workout?.name ?? 'OFF'}`).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── Week-scoped bye shape does not leak into adjacent in-season game weeks ──');
{
  resetWorld();
  const seeded = rebuildLocalWeek({ baseProfile: IN_SEASON_SIX_DAY as OnboardingData });
  const blockStart = seeded.program.startDate.split('T')[0];
  const wk1Mon = blockStart;
  const wk2Mon = addDays(blockStart, 7);
  const wk2Sat = addDays(blockStart, 12);
  const wk3Mon = addDays(blockStart, 14);
  const baseTemplateSignature = JSON.stringify(useProgramStore.getState().currentMicrocycle?.workouts ?? []);
  const priorGameBefore = resolveLiveWeek(wk1Mon, 'In-season', 'Saturday');
  const selectedGameBefore = resolveLiveWeek(wk2Mon, 'In-season', 'Saturday');
  const futureGameBefore = resolveLiveWeek(wk3Mon, 'In-season', 'Saturday');

  const remove = rebuildLocalWeek({
    baseProfile: IN_SEASON_SIX_DAY as OnboardingData,
    newGameDay: null,
    scope: 'weekOverlay',
    targetDate: wk2Sat,
    commitGameMark: () => { markedDays[wk2Sat] = 'noGame'; },
  });
  const selectedBye = resolveLiveWeek(wk2Mon, 'In-season', 'Saturday');
  const priorGameAfterRemove = resolveLiveWeek(wk1Mon, 'In-season', 'Saturday');
  const futureGameAfterRemove = resolveLiveWeek(wk3Mon, 'In-season', 'Saturday');
  const overlayKeysAfterRemove = Object.keys(useProgramStore.getState().weekScopedOverlays);

  ok('removing one regular game creates only the selected-week bye overlay',
    remove.overlay?.reason === 'one_off_no_game' &&
      JSON.stringify(overlayKeysAfterRemove) === JSON.stringify([wk2Mon]),
    JSON.stringify({ overlay: remove.overlay, keys: overlayKeysAfterRemove }));
  ok('selected week becomes a bye without a fixture',
    selectedBye.every((day) => day.workout?.workoutType !== 'Game') &&
      (() => {
        const saturday = classifyVisibleSession(dayOf(selectedBye, wk2Sat)?.workout);
        return saturday.contributions.mainStrength === 1 && saturday.strengthRegion === 'lower';
      })(),
    selectedBye.map((day) => `${day.short}:${day.workout?.name ?? 'OFF'}`).join(' | '));
  ok('previous game week is byte-identical after selected-week bye generation',
    visibleWeekSignature(priorGameAfterRemove) === visibleWeekSignature(priorGameBefore));
  ok('future game week is byte-identical after selected-week bye generation',
    visibleWeekSignature(futureGameAfterRemove) === visibleWeekSignature(futureGameBefore));
  ok('adjacent game weeks retain their Saturday game anchors',
    dayOf(priorGameAfterRemove, addDays(blockStart, 5))?.workout?.workoutType === 'Game' &&
      dayOf(futureGameAfterRemove, addDays(blockStart, 19))?.workout?.workoutType === 'Game');
  ok('bye overlay does not replace the shared game-week template',
    JSON.stringify(useProgramStore.getState().currentMicrocycle?.workouts ?? []) === baseTemplateSignature);

  const restore = addSaturdayGame(IN_SEASON_SIX_DAY, wk2Sat);
  const selectedGameAfterRestore = resolveLiveWeek(wk2Mon, 'In-season', 'Saturday');
  const overlayKeysAfterRestore = Object.keys(useProgramStore.getState().weekScopedOverlays);
  ok('restoring the game returns the selected week to its original visible shape',
    weekShapeSignature(selectedGameAfterRestore) === weekShapeSignature(selectedGameBefore),
    `before=${weekShapeSignature(selectedGameBefore)}\nafter=${weekShapeSignature(selectedGameAfterRestore)}`);
  ok('restoring the game replaces rather than duplicates the selected-week overlay',
    restore.overlay?.reason === 'one_off_game' &&
      JSON.stringify(overlayKeysAfterRestore) === JSON.stringify([wk2Mon]),
    JSON.stringify({ overlay: restore.overlay, keys: overlayKeysAfterRestore }));
}

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
