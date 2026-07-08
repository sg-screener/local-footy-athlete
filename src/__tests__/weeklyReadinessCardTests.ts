/**
 * weeklyReadinessCardTests — visible weekly "I'm not 100%" card.
 *
 * Proves (Sam's list, 2026-07-08):
 *   1. The card + sheet exist on the Program screen with the shared
 *      busy/away card treatment, in ALL phases, above the practice-match
 *      card and below busy/away (source-level checks — RN rendering has
 *      no harness in this repo; the repo's established pattern is static
 *      assertions à la profileResetUITests).
 *   2. Applying readiness creates the correct WEEK-SCOPED modifier via
 *      the existing tap-modifier system (no second readiness system).
 *   3. It stacks with busy/away + game anchors and survives the
 *      canonical weekRebuild (no coach-chat / OpenAI — fetch poisoned).
 *   4. Clearing removes ONLY the readiness modifier.
 *   5. The day-level wellbeing flow is untouched.
 *
 * Run: npm run test:weekly-readiness
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — readiness flows must be fully local');
};

import { rebuildLocalWeek } from '../utils/weekRebuild';
import { addDays } from '../utils/sessionResolver';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useProgramStore } from '../store/programStore';
import {
  loadReductionModifierIdForDate,
  recoveryModeModifierIdForDate,
} from '../utils/tapProgramModifiers';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import type { OnboardingData } from '../types/domain';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { executeProgramControlAction, scheduleModifierIdForDate, buildTapScheduleModifier } =
  require('../utils/programControlActions') as typeof import('../utils/programControlActions');

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

function resetWorld() {
  useProgramStore.getState().clearManualOverrides();
  useCoachUpdatesStore.setState((s: unknown) => ({
    ...(s as object),
    activeConstraints: [],
  }) as never);
}

const PRESEASON: Partial<OnboardingData> = {
  seasonPhase: 'Pre-season', trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingIntensity: 'Hard', sprintExposure: '2+ times per week',
  conditioningLevel: 'Good', recentTrainingLoad: 'Very consistent', injuries: [],
  motivation: 'Get stronger',
};

const applyReadiness = (kind: 'tired' | 'sick', anchorISO: string, todayISO: string) =>
  kind === 'sick'
    ? executeProgramControlAction({
        type: 'set_recovery_mode',
        source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
        scope: 'current_week',
        payload: { date: anchorISO, todayISO, recoveryScope: 'week' },
        requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
      }, { todayISO })
    : executeProgramControlAction({
        type: 'set_fatigue_status',
        source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
        scope: 'current_week',
        payload: { date: anchorISO, todayISO, level: 'cooked' },
        requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
      }, { todayISO });

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Week-scoped modifier creation (existing system reused) ──');
{
  resetWorld();
  const todayISO = '2026-07-06'; // a Monday
  const futureMonday = addDays(todayISO, 14);
  const res = applyReadiness('tired', futureMonday, todayISO);
  const expectedId = loadReductionModifierIdForDate(futureMonday);
  const c: any = useCoachUpdatesStore.getState().activeConstraints.find((x) => x.id === expectedId);
  ok('low readiness creates the existing load-reduction modifier', res.ok && !!c, JSON.stringify(res));
  ok('modifier is scoped to the SELECTED week (id keyed by that Monday)',
    expectedId === `tap-load-reduction:${futureMonday}`, expectedId);
  ok('modifier expires at the end of the selected week',
    c?.expiresAt === addDays(futureMonday, 6), c?.expiresAt);
  ok('Coach Note reflects the adjustment',
    selectActiveCoachNotes({
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
      todayISO,
    } as never).some((n: any) => /load reduced/i.test(n.title ?? n.modifierTitle ?? '')),
    JSON.stringify(selectActiveCoachNotes({
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
      todayISO,
    } as never)));

  // Sick replaces with the recovery-mode modifier (different id, same week).
  const res2 = applyReadiness('sick', futureMonday, todayISO);
  const recId = recoveryModeModifierIdForDate(futureMonday);
  ok('sick creates the existing recovery-mode modifier (week scope)',
    res2.ok && useCoachUpdatesStore.getState().activeConstraints.some((x) => x.id === recId));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Stacks with busy/away + game; survives canonical rebuild ──');
{
  resetWorld();
  const seedRes = rebuildLocalWeek({ baseProfile: PRESEASON as OnboardingData, newGameDay: null });
  const blockStart = seedRes.program.startDate.split('T')[0];
  const wk2Mon = addDays(blockStart, 7);

  // Busy/away constraint + owned Monday override (as the away flow writes).
  const awayId = scheduleModifierIdForDate(wk2Mon, 'away');
  useCoachUpdatesStore.getState().upsertActiveConstraint(
    buildTapScheduleModifier({
      date: wk2Mon, todayISO: blockStart, variant: 'away', linkedOverrideDates: [wk2Mon],
    }),
  );
  useProgramStore.getState().setManualOverride(wk2Mon, {
    id: 'away-mon', microcycleId: 'mc-ai-1', dayOfWeek: 1, name: 'Rest — away',
    description: '', durationMinutes: 0, intensity: 'Light', workoutType: 'Recovery',
    sessionTier: 'recovery', exercises: [], createdAt: '', updatedAt: '',
  } as never, { intent: 'program_adjustment', activeModifierId: awayId });

  // Readiness for the same week.
  applyReadiness('tired', wk2Mon, blockStart);
  const readinessId = loadReductionModifierIdForDate(wk2Mon);

  // Add the Saturday practice match through the canonical door.
  const rebuild = rebuildLocalWeek({ baseProfile: PRESEASON as OnboardingData, newGameDay: 'Saturday' });

  const constraints = useCoachUpdatesStore.getState().activeConstraints;
  ok('readiness modifier survives the game rebuild',
    constraints.some((c) => c.id === readinessId));
  ok('busy/away constraint survives alongside readiness (stacking)',
    constraints.some((c) => c.id === awayId));
  ok('away Monday override preserved by the rebuild sweep',
    rebuild.sweep.preserve.includes(wk2Mon), JSON.stringify(rebuild.sweep));
  ok('game anchors present in the rebuild context (game preserved)',
    rebuild.context.gameDates.length > 0, JSON.stringify(rebuild.context.gameDates));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Clearing removes ONLY the readiness modifier ──');
{
  const todayISO = '2026-07-06';
  const wk2Mon = addDays(todayISO, 7);
  const readinessId = loadReductionModifierIdForDate(wk2Mon);
  const before = useCoachUpdatesStore.getState().activeConstraints.length;
  // Resolve constraint id → active-program-modifier id, exactly as the
  // hook's handleClearWeekReadiness does.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getActiveProgramModifiers } =
    require('../utils/activeProgramModifiers') as typeof import('../utils/activeProgramModifiers');
  const target = getActiveProgramModifiers().find((m) => m.sourceId === readinessId);
  ok('active modifier resolvable for the week readiness constraint', !!target, readinessId);
  const res = executeProgramControlAction({
    type: 'clear_active_modifier',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: { modifierId: target?.id ?? readinessId },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
  }, { todayISO });
  const constraints = useCoachUpdatesStore.getState().activeConstraints;
  ok('clear action succeeds', res.ok === true, JSON.stringify(res));
  ok('readiness modifier removed', !constraints.some((c) => c.id === readinessId));
  ok('other constraints (busy/away) untouched by the clear',
    constraints.some((c) => String(c.id).includes('away')) &&
    constraints.length === before - 1,
    constraints.map((c) => c.id).join(', '));
  resetWorld();
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Program screen source: card, placement, phases, sheet ──');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  const src = fs.readFileSync(`${__dirname}/../screens/home/HomeScreenV2.tsx`, 'utf8') as string;

  ok('card exists with testID home-week-readiness-entry',
    src.includes('home-week-readiness-entry'));
  ok('card reuses the busy/away card styles (shared treatment)',
    /home-week-readiness-entry[\s\S]{0,400}styles\.busyAwayEntry/.test(src) &&
    /home-week-readiness-entry[\s\S]{0,600}styles\.busyAwayIcon/.test(src) &&
    /home-week-readiness-entry[\s\S]{0,800}styles\.busyAwayText/.test(src));
  const busyIdx = src.indexOf('home-busy-away-entry');
  const readinessIdx = src.indexOf('home-week-readiness-entry');
  const practiceIdx = src.indexOf('preseason-practice-match-entry');
  ok('card sits below busy/away and above the practice-match card',
    busyIdx > -1 && readinessIdx > busyIdx && practiceIdx > readinessIdx,
    `busy=${busyIdx} readiness=${readinessIdx} practice=${practiceIdx}`);
  // Phase visibility: the card render is gated on isNormal only — no
  // seasonPhase / showPracticeMatchCTA condition on its Pressable block.
  const cardBlock = src.slice(src.indexOf('Weekly readiness ("I\'m not 100%") — all phases'), readinessIdx + 200);
  ok('card is visible in all phases (gated on isNormal only)',
    cardBlock.includes('{isNormal && (') && !cardBlock.includes('showPracticeMatchCTA') && !cardBlock.includes('currentPhase'));
  ok('tapping opens the readiness sheet (state wiring present)',
    src.includes('setReadinessVisible(true)') && src.includes('home-week-readiness-sheet'));
  ok('sheet offers the wellbeing options',
    src.includes('Feeling sore / tight') && src.includes('Low energy / tired') &&
    src.includes('Sick / run down') && src.includes('Niggle or injury') &&
    src.includes('Need an easier week'));
  ok('active state label + update/clear affordances present',
    src.includes("Not 100% this week") && src.includes('Recovery mode this week') &&
    src.includes('Clear adjustment'));
  ok('no coach-chat / LLM in the flow (no askCoach or fetch in readiness paths)',
    !/WeekReadinessSheet[\s\S]{0,4000}onAskCoach/.test(src));

  // Day-level wellbeing flow untouched.
  const planSheet = fs.readFileSync(`${__dirname}/../screens/home/PlanChangeSheet.tsx`, 'utf8') as string;
  ok('day-level "How are you today?" flow still present',
    planSheet.includes("pick_wellbeing") && planSheet.includes("I'm not 100%"));
}

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`weeklyReadinessCardTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n  - ' + failures.join('\n  - '));
process.exit(fail > 0 ? 1 : 0);
