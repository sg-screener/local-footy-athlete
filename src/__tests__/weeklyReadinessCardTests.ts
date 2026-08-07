/**
 * weeklyReadinessCardTests — visible weekly "I'm not 100%" card.
 *
 * Proves (Sam's list, 2026-07-08):
 *   1. The card + sheet exist on the Program screen with the shared
 *      busy/away card treatment, in ALL phases, above the practice-match
 *      card and below busy/away (source-level checks — RN rendering has
 *      no harness in this repo; the repo's established pattern is static
 *      assertions à la profileResetUITests).
 *   2. Health taps route to the durable canonical source-fact transaction.
 *   3. Legacy synchronous readiness-store scenarios remain documented but
 *      retired; permanent composition coverage lives with source facts.
 *   4. The day-level wellbeing surface remains present.
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
import { explorerTestId, stableTestIdToken } from '../utils/stableTestId';
import type { OnboardingData } from '../types/domain';
import { seedManualOverride } from './support/programOverrideHarness';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { executeProgramControlAction, scheduleModifierIdForDate } =
  require('../utils/programControlActions') as typeof import('../utils/programControlActions');

// ─── Harness ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures: string[] = [];

/**
 * The week-screen readiness entry, as Sam wrote it.
 *
 * SIGNED BY RULING 4, `docs/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md`:
 * '"I\'m not 100%" becomes "I\'m sick/flat today" on this screen.'
 */
const WEEK_READINESS_ENTRY_LABEL = "I'm sick/flat today";
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function jsxOpeningTags(source: string, element: string): string[] {
  const tags: string[] = [];
  const opener = `<${element}`;
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf(opener, cursor);
    if (start < 0) break;

    let braceDepth = 0;
    let quote: '"' | "'" | '`' | null = null;
    for (let index = start + opener.length; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (char === quote && source[index - 1] !== '\\') quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        continue;
      }
      if (char === '{') braceDepth += 1;
      if (char === '}') braceDepth -= 1;
      if (char === '>' && braceDepth === 0) {
        tags.push(source.slice(start, index + 1));
        cursor = index + 1;
        break;
      }
    }
    if (cursor <= start) break;
  }

  return tags;
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
  sprintExposure: '2+ times per week',
  conditioningLevel: 'Good', recentTrainingLoad: 'Very consistent', injuries: [],
  motivation: 'Get stronger',
};

type ReadinessOption =
  | 'tired_today'
  | 'poor_sleep_today'
  | 'poor_sleep_week'
  | 'cooked_week'
  | 'sore_today'
  | 'illness_mild'
  | 'illness_moderate'
  | 'illness_severe';

const applyReadiness = (kind: ReadinessOption, anchorISO: string, todayISO: string) =>
  kind === 'illness_severe'
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
// Retired synchronous compatibility-store scenarios. Durable tap/Coach fact
// parity and exact resolution now live in temporarySourceFactTransactionTests.
if (false) {
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
  const res2 = applyReadiness('illness_severe', futureMonday, todayISO);
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
  // The legacy away-modifier SHAPE, written out here rather than built by a
  // production helper. `buildTapScheduleModifier` was deleted on 2026-07-31: no
  // production path had called it since the away flow moved onto canonical
  // schedule FACTS, and a builder kept alive by its only test is a second way to
  // author a constraint that nothing authors. What this cell is about is the §18
  // override rejection below, not the builder — so the shape is a literal.
  useCoachUpdatesStore.getState().upsertActiveConstraint({
    id: awayId,
    type: 'schedule',
    severity: 3,
    status: 'active',
    startDate: blockStart,
    lastUpdatedAt: new Date().toISOString(),
    reasonLabel: 'Away',
    source: 'tap',
    weekStartISO: wk2Mon,
    expiresAt: addDays(wk2Mon, 6),
    linkedOverrideDates: [wk2Mon],
    modifierTitle: 'Away this week',
    modifierBody: "The days you're away are cleared. Clear this note to bring them back.",
    modifierAffects: ['current_week'],
    rules: ['sessions on the days you’re away'],
    safeFocus: ['Short, targeted sessions', 'Skill / technique work', 'Recovery + mobility'],
    advice: [],
  } as never);
  let awayOverrideRejected = false;
  try {
    seedManualOverride(wk2Mon, {
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
    payload: { date: todayISO, todayISO },
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
}

console.log('\n── 5. Program screen source: card, placement, phases, sheet ──');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  const src = fs.readFileSync(`${__dirname}/../screens/home/HomeScreenV2.tsx`, 'utf8') as string;
  /**
   * THE READINESS SHEET'S OWN SOURCE, not the whole screen.
   *
   * "Short on time" was banned from this FILE, which was the same thing as
   * banning it from the sheet right up until 2026-07-31, when Sam's ruling 2
   * gave the week screen a "Short on time today" BUTTON. The law those two
   * cells encode is his 2026-07-27 one — time is a session fact, not a readiness
   * state, so it must not be an option on this sheet or a prop of it — and a
   * week-screen row that writes a SCHEDULE fact is that law being obeyed, not
   * broken. So the ban narrows to the component it was always about.
   */
  const sheetSrc = (() => {
    const start = src.indexOf('function WeekReadinessSheet');
    // The component ends at its own closing brace in column 0 — not at the next
    // `function`, which would swallow the docblock in between.
    const end = src.indexOf('\n}\n', start + 1);
    return start < 0 ? '' : src.slice(start, end < 0 ? undefined : end);
  })();
  const hookSrc = fs.readFileSync(`${__dirname}/../screens/home/useHomeScreen.ts`, 'utf8') as string;
  const witnessSrc = fs.readFileSync(
    `${__dirname}/../components/ExplorerRenderWitness.tsx`, 'utf8',
  ) as string;
  // THE ENTRY IS A CHIP NOW, NOT A ROW (Sam's chip-row ruling, 2026-08-08).
  // The door is unchanged — same onPress, same testID, same accessibility label
  // — but it is rendered through the shared `LifeFactChip`, so the tag this cell
  // reads is a `<LifeFactChip>` and not a bare `<Pressable>`. Both element names
  // are searched: what this cell is about is that the week-readiness entry
  // carries the fact's stable identity, and the element it is drawn with is not
  // the claim. A find over one name only would have gone quietly vacuous ('')
  // the moment the row was restyled — so an empty find is failed explicitly
  // below rather than being allowed to satisfy `.includes` on nothing.
  const readinessEntryTag = [
    ...jsxOpeningTags(src, 'LifeFactChip'),
    ...jsxOpeningTags(src, 'Pressable'),
  ].find((tag) => tag.includes('setReadinessVisible(true)')) ?? '';
  const sheetOptionTags = jsxOpeningTags(src, 'SheetOption');
  const readinessFactId = 'temporary-readiness:fatigue:2026-07-20';
  const readinessFactToken = stableTestIdToken(readinessFactId);
  const factSelectors = [
    explorerTestId.readinessActive(readinessFactId),
    explorerTestId.readinessUpdate(readinessFactId),
    explorerTestId.readinessClearAction(readinessFactId),
    explorerTestId.readinessClear(readinessFactId),
    explorerTestId.readinessProgrammingEffect(readinessFactId),
  ];

  // The button ROLE moved with the element: it is declared once, inside
  // `LifeFactChip`, instead of five times at five call sites. So the role is
  // asserted at its owner and the identity at the call site — which is where
  // each of them actually lives now.
  const lifeFactChipComponent = (() => {
    const start = src.indexOf('function LifeFactChip(');
    return start < 0 ? '' : src.slice(start, src.indexOf('\n}\n', start + 1));
  })();
  ok('readiness entry and lifecycle selectors preserve stable fact identity',
    factSelectors.every((selector) => selector.endsWith(readinessFactToken)) &&
    new Set(factSelectors).size === factSelectors.length &&
    readinessEntryTag.length > 0 &&
    readinessEntryTag.includes('explorerTestId.readinessUpdate(weekReadiness.id)') &&
    readinessEntryTag.includes('explorerTestId.readinessSetAction(`readiness-${weekAnchorISO}`)') &&
    (readinessEntryTag.includes('accessibilityRole="button"') ||
      (readinessEntryTag.startsWith('<LifeFactChip') &&
        lifeFactChipComponent.includes('accessibilityRole="button"'))) &&
    readinessEntryTag.includes('accessibilityLabel={weekReadiness'));

  // Every readiness tier still commits (zero capability loss), now reached via the
  // russian-doll buckets. The Sick bucket has THREE leaves after Sam's 2026-07-27
  // ruling — one per illness tier ("A bit off" / "Properly sick" / "Can't get out
  // of bed"), superseding the two R16 authored. "short_time" is REMOVED from this
  // sheet (returns with the 5.4 busy design) — no dead affordance, no dead prop.
  const readinessActionKinds: ReadinessOption[] = [
    'tired_today',
    'poor_sleep_today',
    'poor_sleep_week',
    'cooked_week',
    'sore_today',
    'illness_mild',
    'illness_moderate',
    'illness_severe',
  ];
  const readinessOptionSelectors = [
    ...readinessActionKinds.map((kind) => explorerTestId.readinessOption(kind)),
    explorerTestId.injuryIngress('set'),
  ];
  ok('every readiness leaf + update/clear controls use semantic identities',
    new Set(readinessOptionSelectors).size === readinessOptionSelectors.length &&
    readinessActionKinds.every((kind) => sheetOptionTags.some((tag) =>
      tag.includes(`explorerTestId.readinessOption('${kind}')`) &&
      tag.includes(`onApply('${kind}')`))) &&
    sheetOptionTags.some((tag) =>
      tag.includes("explorerTestId.injuryIngress('set')") && tag.includes('onInjury')) &&
    sheetOptionTags.some((tag) =>
      tag.includes('explorerTestId.readinessUpdate(active.id)') && tag.includes('setUpdating(true)')) &&
    sheetOptionTags.some((tag) =>
      tag.includes('explorerTestId.readinessClearAction(active.id)') && tag.includes('onClear(active.id)')));

  ok('active readiness and programming-effect witnesses use the canonical fact identity',
    /readinessFacts\.map\(\(fact\)[\s\S]*fact\.status === 'active'[\s\S]*readinessActive\(fact\.factId\)[\s\S]*readinessClear\(fact\.factId\)[\s\S]*readinessProgrammingEffectFactIds\.has\(fact\.factId\)[\s\S]*readinessProgrammingEffect\(fact\.factId\)/.test(src));

  ok('resolved facts and an empty week expose distinct cleared-state witnesses',
    explorerTestId.readinessClear(readinessFactId) !==
      explorerTestId.readinessClearState('2026-07-20') &&
    /fact\.status === 'active'[\s\S]*readinessActive\(fact\.factId\)[\s\S]*readinessClear\(fact\.factId\)/.test(src) &&
    /!weekReadiness && readinessFacts\.every\(\(fact\) => fact\.status !== 'active'\)[\s\S]*readinessClearState\(weekAnchorISO\)/.test(src));

  ok('accepted readiness facts reconstruct accessibility-visible semantic nodes after reload',
    /temporarySourceFacts = useProgramStore\(\(s\) =>[\s\S]*s\.acceptedMaterialContext\.temporarySourceFacts\)/.test(hookSrc) &&
    /readinessFacts = useMemo\(\(\) => temporarySourceFacts\.filter/.test(hookSrc) &&
    /readinessFacts\.map\(\(fact\)[\s\S]*<ExplorerRenderWitness/.test(src) &&
    /<View[\s\S]*accessible[\s\S]*accessibilityLabel=\{accessibilityLabel\}[\s\S]*accessibilityRole="text"[\s\S]*collapsable=\{false\}[\s\S]*testID=\{testID\}/.test(witnessSrc));
  ok('tapping opens the readiness sheet (state wiring present)',
    src.includes('setReadinessVisible(true)') && src.includes('home-week-readiness-sheet'));
  // X2 / R16 redesign: exactly three top-level buckets with russian-doll
  // expansion — "Feeling flat", "Sick", "Something hurts".
  //
  // The Sick bucket's TWO sub-options are SUPERSEDED by Sam's 2026-07-27 ruling
  // (THE THREE SICK DOORS). R16 was authored before the illness law existed, so
  // it had no way to express MODERATE: "Properly sick" mapped to severe and its
  // subtitle absorbed bed-ridden. There are now three leaves, one per tier, and
  // "Properly sick" has MOVED to moderate — it deloads without lifting a single
  // minimum. Re-pinned to the law, not weakened: the bucket count is unchanged
  // and every leaf is still asserted.
  ok('sheet groups readiness under three top-level russian-doll buckets',
    src.includes('Feeling flat') && src.includes('Something hurts') &&
    src.includes('A bit off') && src.includes('Properly sick') &&
    src.includes("Can't get out of bed") &&
    src.includes('Rough sleep') && src.includes('Bit tired today') &&
    !sheetSrc.includes('Short on time') && !src.includes('Sick / run down') &&
    !src.includes('Just a bit tired today') &&
    // The superseded label must be GONE, not merely unused.
    !src.includes('Coming down with something'));
  ok('sheet maps every tier to its deterministic route (zero capability loss)',
    src.includes("onApply('tired_today')") && src.includes("onApply('cooked_week')") &&
    src.includes("onApply('poor_sleep_today')") && src.includes("onApply('poor_sleep_week')") &&
    src.includes("onApply('sore_today')") && src.includes("onApply('illness_mild')") &&
    src.includes("onApply('illness_moderate')") &&
    src.includes("onApply('illness_severe')") && src.includes('onPress={onInjury}'));
  // The "nothing required" framing follows the tier that actually lifts the
  // minimums. It moved with it — leaving it on "Properly sick" would promise an
  // optional week the moderate tier does not deliver.
  ok("Can't get out of bed discloses the illness_recovery framing",
    src.includes("Nothing will be required this week"));

  // ── A2 (L10 device finding 2026-07-24) ─────────────────────────────────
  // Confirming "Properly sick" dropped the athlete straight into the manage
  // view ("Update" / "Clear adjustment — I'm good now"). The sheet had only
  // TWO states and `showOptions` derived both from one overloaded variable, so
  // "this week has an active adjustment" (a fact about the week) and "the
  // athlete came here to manage it" (a fact about this visit) were the same
  // condition — making the moment of confirming indistinguishable from a later
  // visit. Sam's ruling: right after confirming, show the disclosure with a
  // close/return only; clearing belongs to a later visit.
  //
  // The fix adds the missing state rather than a guard on the existing one.
  ok('[A2] the sheet has a distinct just-confirmed state',
    /const \[confirmed, setConfirmed\] = useState/.test(src) &&
    src.includes('home-week-readiness-confirmed'));
  ok('[A2] confirming suppresses BOTH the option list and the manage view',
    /showOptions =[^;]*!justConfirmed/.test(src) &&
    /!showOptions && !lighterDayOffer && !justConfirmed && active/.test(src));
  // Extract the just-confirmed block itself rather than testing source
  // proximity — the manage view follows it in the file, so a windowed regex
  // would happily read the manage view's clear action as belonging to it.
  const confirmedBlock = (() => {
    const start = src.indexOf('{justConfirmed && acknowledgment && (');
    const end = src.indexOf('{!showOptions && !lighterDayOffer && !justConfirmed && active && (');
    return start >= 0 && end > start ? src.slice(start, end) : '';
  })();
  ok('[A2] the just-confirmed state offers a close/return and no clear',
    confirmedBlock.includes('home-week-readiness-confirmed') &&
    confirmedBlock.includes('label="Done"') &&
    !confirmedBlock.includes('readinessClearAction') &&
    !confirmedBlock.includes('readinessUpdate') &&
    !/Clear adjustment/.test(confirmedBlock));
  ok('[A2] the confirmed state carries the authored disclosure, not a new string',
    /home-week-readiness-confirmed[\s\S]{0,700}acknowledgment\.message/.test(src));
  ok('[A2] confirmation resets on reopen and when the athlete taps Update',
    /if \(visible\) \{[^}]*setConfirmed\(false\)/.test(src) &&
    /setUpdating\(true\); setConfirmed\(false\)/.test(src));
  ok('[A2] a FAILED report does not enter the confirmed state',
    /acknowledgment\?\.tone === 'success'/.test(src));
  ok('Short on time removed from the sheet — no dead affordance and no dead prop',
    sheetSrc.length > 0 && !sheetSrc.includes('Short on time') && !/onShortTime/.test(src) &&
    !/readinessOption\('short_time'\)/.test(src));
  ok('top-level buckets use distinct icons (icon cleanup, no repeated-pulse spam)',
    src.includes('flatIcon') && src.includes('sickIcon') &&
    (src.match(/pulseIcon\(/g) || []).length <= 4);

  // Device finding #3: the illness_recovery week keeps its sessions (sessionTier
  // 'optional') rather than clearing to Rest, so the day card must surface an
  // optional-tier session as OPTIONAL (de-emphasised, "only if you're up to it"),
  // not the prominent "Start Session" CORE treatment — the same visibly-optional
  // framing cooked's Rest day already gets.
  ok('an optional-tier session surfaces as optional, not prominent Start Session (finding #3)',
    /isOptionalSession\b/.test(src) &&
    /sessionTier === 'optional'/.test(src) &&
    /Start optional session/.test(src) &&
    /only if you're up to it/i.test(src));
  // A4 (L10 device finding 2026-07-24): this assertion used to REQUIRE the
  // hardcoded labels in HomeScreenV2 — and passed precisely BECAUSE the card
  // ignored its own owner. `resolveVisibleReadinessState` computed
  // "Under the weather this week" for an illness fact and the card threw the
  // title away, re-deriving "Not 100% this week" from scope/isRecovery. The
  // test pinned the defect, so the fix inverts it: the card must hold no
  // readiness labels of its own and must render the owner's title.
  ok('[A4] the card renders the owner\'s title and holds no labels of its own',
    /weekReadiness\.title/.test(src) &&
    !src.includes("'Not 100% today'") &&
    !src.includes("'Not 100% this week'") &&
    !src.includes("'Recovery mode this week'"));
  ok('[A4] the un-set card still invites a report',
    src.includes(`"${WEEK_READINESS_ENTRY_LABEL}"`));
  ok('[A4] the wording Sam replaced under ruling 4 is gone',
    !src.includes("I'm not 100%"));
  ok('active state update/clear affordances present',
    src.includes('Clear adjustment'));

  // INVERTED OUT LOUD, 2026-08-08 — THE RULING MOVED, SO THE PIN MOVED.
  // A4 rider (a) put the active-state surface ABOVE the seven day rows, so it
  // explained the week it preceded. Sam's day-first layout ruling (2026-08-08,
  // `docs/SEAT_INBOX.md`) names the order himself: Today/Week toggle → the week
  // strip → today's card → the life-fact chip row → THEN Coach Notes. Rider (a)'s
  // argument — the explanation sits with the thing it explains — now points the
  // other way, because the screen leads with one day instead of seven rows.
  // Which side moved: the RULING, on a date, by the owner. The cell is not
  // deleted, and it still asserts a POSITION rather than mere presence — an
  // inverted pin that only checked existence would pass on any layout at all.
  ok('[A4] active-state notes render below the day card and its chip row',
    src.indexOf('<CoachNotesSection') > 0 &&
    src.indexOf('<CoachNotesSection') > src.indexOf('{weekDays.map(') &&
    src.indexOf('<CoachNotesSection') > src.indexOf('testID="home-life-fact-chips"'));
  ok('[A4] nothing active means no empty card takes screen space',
    /if \(notes\.length === 0\) return null;/.test(src));
  ok('no coach-chat / LLM in the flow (no askCoach or fetch in readiness paths)',
    !/WeekReadinessSheet[\s\S]{0,4000}onAskCoach/.test(src));

  // Scope distinctness now lives in the single readiness owner (0.2 / R16): the
  // tier→action mapping was extracted from the hook into the pure
  // weekReadinessActions module so both doors route through one testable owner.
  const readinessActionsSrc = fs.readFileSync(`${__dirname}/../utils/weekReadinessActions.ts`, 'utf8') as string;
  ok('the single readiness owner keeps today and week scopes distinct',
    hookSrc.includes('readinessActionForKind') &&
    /kind === 'cooked_week'/.test(readinessActionsSrc) &&
    /kind === 'poor_sleep_week'/.test(readinessActionsSrc) &&
    /kind === 'sore_today'/.test(readinessActionsSrc) &&
    /kind === 'illness_severe'/.test(readinessActionsSrc) &&
    /scope: cooked \? 'current_week' : 'today_only'/.test(readinessActionsSrc) &&
    /scope: week \? 'current_week' : 'today_only'/.test(readinessActionsSrc));
  ok('health taps use the durable canonical source-fact boundary',
    hookSrc.includes('executeProgramControlActionDurably') &&
    !hookSrc.includes('weekReadinessIds.has(modifier.sourceId)'));

  // Door unification, second and final step. 0.2/R16 retired the day card's
  // record-only wellbeing subtree and left a row that HANDED OFF to the week
  // owner; Sam's design ruling 7 (2026-07-31) retires the row too — "I'm not
  // 100%" lives on the week screen only. So the day card must hold neither the
  // committer nor the door, and the week card must hold both.
  const planSheet = fs.readFileSync(`${__dirname}/../screens/home/PlanChangeSheet.tsx`, 'utf8') as string;
  const homeV2Src = fs.readFileSync(`${__dirname}/../screens/home/HomeScreenV2.tsx`, 'utf8') as string;
  ok(`the week card is the ONLY "${WEEK_READINESS_ENTRY_LABEL}" door (the day card no longer has one)`,
    !planSheet.includes(WEEK_READINESS_ENTRY_LABEL) && !planSheet.includes("I'm not 100%") &&
    !planSheet.includes('onOpenReadiness') &&
    !planSheet.includes('pick_wellbeing') && !planSheet.includes('shutdown_week') &&
    homeV2Src.includes(WEEK_READINESS_ENTRY_LABEL) && /<WeekReadinessSheet\b/.test(homeV2Src));
}

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`weeklyReadinessCardTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n  - ' + failures.join('\n  - '));
process.exit(fail > 0 ? 1 : 0);
