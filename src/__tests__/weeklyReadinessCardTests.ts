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
import { useReadinessStore } from '../store/readinessStore';
import {
  loadReductionModifierIdForDate,
  recoveryModeModifierIdForDate,
} from '../utils/tapProgramModifiers';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import { getActiveProgramModifiers } from '../utils/activeProgramModifiers';
import { todayISOLocal } from '../utils/appDate';
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
  useReadinessStore.getState().clear();
  useCoachUpdatesStore.setState((s: unknown) => ({
    ...(s as object),
    activeConstraints: [],
  }) as never);
  useProgramStore.getState().setCurrentProgram(null);
}

const PRESEASON: Partial<OnboardingData> = {
  seasonPhase: 'Pre-season', trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingIntensity: 'Hard', sprintExposure: '2+ times per week',
  conditioningLevel: 'Good', recentTrainingLoad: 'Very consistent', injuries: [],
  motivation: 'Get stronger',
};

type ReadinessOption =
  | 'tired_today'
  | 'poor_sleep_today'
  | 'poor_sleep_week'
  | 'cooked_week'
  | 'sore_today'
  | 'sick_week';

const applyReadiness = (kind: ReadinessOption, anchorISO: string, todayISO: string) =>
  kind === 'sick_week'
    ? executeProgramControlAction({
        type: 'set_recovery_mode',
        source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
        scope: 'current_week',
        payload: { date: anchorISO, todayISO, recoveryScope: 'week' },
        requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
      }, { todayISO })
    : kind === 'poor_sleep_today' || kind === 'poor_sleep_week'
      ? executeProgramControlAction({
          type: 'set_poor_sleep_status',
          source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
          scope: kind === 'poor_sleep_week' ? 'current_week' : 'today_only',
          payload: {
            date: kind === 'poor_sleep_week' ? anchorISO : todayISO,
            todayISO,
            pattern: kind === 'poor_sleep_week' ? 'repeated' : 'single_night',
          },
          requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
        }, { todayISO })
      : executeProgramControlAction({
        type: 'set_fatigue_status',
        source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
        scope: kind === 'cooked_week' ? 'current_week' : 'today_only',
        payload: {
          date: kind === 'cooked_week' ? anchorISO : todayISO,
          todayISO,
          level: kind === 'cooked_week'
            ? 'cooked'
            : kind === 'sore_today'
              ? 'sore'
              : 'low_energy',
        },
        requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
      }, { todayISO });

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Every wellbeing option uses its existing deterministic owner ──');
{
  resetWorld();
  const todayISO = '2026-07-06'; // a Monday
  const futureMonday = addDays(todayISO, 14);

  const tired = applyReadiness('tired_today', futureMonday, todayISO);
  const tiredSignal = useReadinessStore.getState().signalsByDate[todayISO];
  ok('tired today writes the existing today-scoped low-energy signal',
    tired.ok && tiredSignal?.energy === 'low' && !tiredSignal?.soreness,
    JSON.stringify(tiredSignal));
  ok('tired today does not create a week load-reduction modifier',
    !useCoachUpdatesStore.getState().activeConstraints.some((x) => x.id === loadReductionModifierIdForDate(futureMonday)));

  resetWorld();
  const poorSleepToday = applyReadiness('poor_sleep_today', futureMonday, todayISO);
  const oneNight: any = useCoachUpdatesStore.getState().activeConstraints[0];
  ok('poor sleep last night creates a typed today-only readiness constraint',
    poorSleepToday.ok && oneNight?.readinessKind === 'poor_sleep' &&
      oneNight?.readinessPattern === 'single_night' && oneNight?.appliesToDate === todayISO);

  resetWorld();
  const poorSleepWeek = applyReadiness('poor_sleep_week', futureMonday, todayISO);
  const repeated: any = useCoachUpdatesStore.getState().activeConstraints[0];
  ok('repeated poor sleep creates a typed week readiness constraint',
    poorSleepWeek.ok && repeated?.readinessKind === 'poor_sleep' &&
      repeated?.readinessPattern === 'repeated' && repeated?.expiresAt === addDays(futureMonday, 6));

  resetWorld();
  const sore = applyReadiness('sore_today', futureMonday, todayISO);
  const soreSignal = useReadinessStore.getState().signalsByDate[todayISO];
  ok('sore or tight writes the existing today-scoped soreness signal',
    sore.ok && soreSignal?.soreness === 'moderate' && !soreSignal?.energy,
    JSON.stringify(soreSignal));

  resetWorld();
  const res = applyReadiness('cooked_week', futureMonday, todayISO);
  const expectedId = loadReductionModifierIdForDate(futureMonday);
  const c: any = useCoachUpdatesStore.getState().activeConstraints.find((x) => x.id === expectedId);
  ok('cooked creates the existing load-reduction modifier', res.ok && !!c, JSON.stringify(res));
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

  resetWorld();
  const res2 = applyReadiness('sick_week', futureMonday, todayISO);
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
  let awayOverrideRejected = false;
  try {
    useProgramStore.getState().setManualOverride(wk2Mon, {
      id: 'away-mon', microcycleId: 'mc-ai-1', dayOfWeek: 1, name: 'Rest — away',
      description: '', durationMinutes: 0, intensity: 'Light', workoutType: 'Recovery',
      sessionTier: 'recovery', exercises: [], createdAt: '', updatedAt: '',
    } as never, { intent: 'program_adjustment', activeModifierId: awayId });
  } catch (error) {
    awayOverrideRejected = (error as { code?: string }).code === 'section18_week_rejected';
  }
  ok('away override that removes selected core work is rejected atomically',
    awayOverrideRejected && !useProgramStore.getState().dateOverrides[wk2Mon]);

  // Readiness for the same week.
  applyReadiness('cooked_week', wk2Mon, blockStart);
  const readinessId = loadReductionModifierIdForDate(wk2Mon);

  // Add the Saturday practice match through the canonical door.
  const rebuild = rebuildLocalWeek({ baseProfile: PRESEASON as OnboardingData, newGameDay: 'Saturday' });

  const constraints = useCoachUpdatesStore.getState().activeConstraints;
  ok('readiness modifier survives the game rebuild',
    constraints.some((c) => c.id === readinessId));
  ok('busy/away constraint survives alongside readiness (stacking)',
    constraints.some((c) => c.id === awayId));
  ok('rebuild has no rejected away override to preserve',
    !rebuild.sweep.preserve.includes(wk2Mon), JSON.stringify(rebuild.sweep));
  ok('game anchors present in the rebuild context (game preserved)',
    rebuild.context.gameDates.length > 0, JSON.stringify(rebuild.context.gameDates));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Clearing removes ONLY the readiness modifier ──');
{
  const todayISO = '2026-07-06';
  const readinessConstraint = useCoachUpdatesStore.getState().activeConstraints
    .find((constraint) => constraint.id.startsWith('tap-load-reduction:'));
  const readinessId = readinessConstraint?.id ?? loadReductionModifierIdForDate(addDays(todayISO, 7));
  const selectedWeek = readinessConstraint?.weekStartISO ?? readinessId.split(':').at(-1)!;
  const before = useCoachUpdatesStore.getState().activeConstraints.length;
  // Resolve constraint id → active-program-modifier id, exactly as the
  // hook's handleClearWeekReadiness does.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getActiveProgramModifiers } =
    require('../utils/activeProgramModifiers') as typeof import('../utils/activeProgramModifiers');
  const target = getActiveProgramModifiers(selectedWeek).find((m) => m.sourceId === readinessId);
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
console.log('\n── 4. Today-scoped clear removes only wellbeing state ──');
{
  resetWorld();
  const todayISO = todayISOLocal();
  executeProgramControlAction({
    type: 'set_schedule_modifier',
    source: { screen: 'program_tab', surface: 'busy_away_sheet_busy', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: { date: todayISO, todayISO, severity: 5, reasonLabel: 'Busy week' },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { todayISO });
  applyReadiness('tired_today', todayISO, todayISO);
  const readinessModifier = getActiveProgramModifiers(todayISO)
    .find((modifier) => modifier.source === 'readiness_signal');
  ok('today readiness signal has an active modifier for card clear', !!readinessModifier);
  const cleared = executeProgramControlAction({
    type: 'clear_active_modifier',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { modifierId: readinessModifier?.id ?? '' },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
  }, { todayISO });
  ok('today readiness clear succeeds', cleared.ok === true, JSON.stringify(cleared));
  ok('today readiness signal is removed', !useReadinessStore.getState().signalsByDate[todayISO]);
  ok('today readiness clear leaves busy modifier untouched',
    useCoachUpdatesStore.getState().activeConstraints.some((constraint) => constraint.type === 'schedule'));
  resetWorld();
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Program screen source: card, placement, phases, sheet ──');
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
  ok('sheet offers all eight athlete-facing options',
    src.includes('Just a bit tired today') && src.includes('Cooked / need an easier week') &&
    src.includes('Poor sleep last night') && src.includes('Poor sleep for a few nights') &&
    src.includes('Sore or tight') &&
    src.includes('Sick / run down') && src.includes('Niggle or injury') &&
    src.includes('Short on time'));
  ok('sheet maps readiness choices to distinct deterministic routes',
    src.includes("onApply('tired_today')") && src.includes("onApply('cooked_week')") &&
    src.includes("onApply('poor_sleep_today')") && src.includes("onApply('poor_sleep_week')") &&
    src.includes("onApply('sore_today')") && src.includes("onApply('sick_week')") &&
    src.includes('onPress={onInjury}') && src.includes('onPress={onShortTime}'));
  ok('short-on-time hands off to the existing Busy/Away sheet',
    /onShortTime=\{\(\) => \{[\s\S]{0,160}setBusyAwayVisible\(true\)/.test(src));
  ok('active state label + update/clear affordances present',
    src.includes('Not 100% today') && src.includes("Not 100% this week") &&
    src.includes('Recovery mode this week') &&
    src.includes('Clear adjustment'));
  ok('Busy/Away and practice-match cards retain their tap handlers',
    src.includes('home-busy-away-entry') && src.includes('setBusyAwayVisible(true)') &&
    src.includes('preseason-practice-match-entry') && src.includes('onPress={handlePracticeMatchPress}'));
  ok('no coach-chat / LLM in the flow (no askCoach or fetch in readiness paths)',
    !/WeekReadinessSheet[\s\S]{0,4000}onAskCoach/.test(src));

  const hookSrc = fs.readFileSync(`${__dirname}/../screens/home/useHomeScreen.ts`, 'utf8') as string;
  ok('hook keeps today and week scopes distinct',
    hookSrc.includes("scope: kind === 'cooked_week' ? 'current_week' : 'today_only'") &&
    hookSrc.includes("kind === 'poor_sleep_week' ? 'current_week' : 'today_only'") &&
    hookSrc.includes("kind === 'sore_today'") && hookSrc.includes("kind === 'sick_week'"));
  ok('update cleanup is limited to readiness signal and the selected week readiness IDs',
    hookSrc.includes("modifier.source === 'readiness_signal' || weekReadinessIds.has(modifier.sourceId)"));

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
