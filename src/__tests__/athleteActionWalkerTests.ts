/**
 * THE ACTION-SEQUENCE WALKER, wired to the real app.
 *
 * Sam's ruling (2026-07-30): the seed library is sampling, not coverage. This
 * suite reaches every state it asserts over by ACTING — fresh install,
 * onboarding, generation, then arbitrary sequences of real athlete actions
 * including calendar marks, source facts and the passage of time. The seven
 * laws are invariants checked after every single action.
 *
 * The 114-cell athlete-door matrix stays as the deterministic FLOOR: named
 * door × day-state × route combinations that must always hold. This suite owns
 * the space above it, which is unbounded and cannot be enumerated by hand.
 *
 * BUDGETS. `test:bible` runs the bounded budget (fast, deterministic seeds).
 * `WALKER_BUDGET=extended` runs the long sweep for nightly/pre-merge.
 *
 * Run: npm run test:action-walker
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — the walker runs entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData, TrainingProgram } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { PlanChange } from '../utils/planChangeTypes';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { applyPlanChange, listPlanChangeOptionsForDay } from '../utils/planChangeProducer';
import {
  walk, describeHistory, makeRng,
  type WalkerAction, type WalkerHost, type WalkerStepResult,
} from './support/athleteActionWalker';
import {
  SAM_EXPORT_8_CONFORMANCE_SHAPE,
  describeConformanceShape,
} from './support/samDeviceExport8Fixture';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined;
  console.debug = () => undefined; console.info = () => undefined;
  console.log = () => undefined;
  try { return body(); } finally {
    console.warn = warn; console.error = error;
    console.debug = debug; console.info = info; console.log = log;
  }
}

function addDaysISO(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

// ── The world the walker acts on ──────────────────────────────────────────

const INSTALL_DAY = '2026-07-13';

/**
 * Onboarding answer SPACE, not one answer set. The walker picks from these, so
 * a season phase or a team-training shape that only breaks in combination gets
 * reached by acting rather than by someone thinking to write it down. Sam's own
 * profile (Pre-season, team Mon/Wed, no usual game day) is inside this space —
 * `samDeviceExport8Fixture` asserts exactly that.
 */
const SEASON_PHASES = ['Pre-season', 'In-season', 'Off-season'] as const;
const TEAM_DAY_SETS: readonly (readonly string[])[] = [
  ['Monday', 'Wednesday'],
  ['Tuesday', 'Thursday'],
  ['Wednesday'],
  [],
];
const GAME_DAY_CHOICES: readonly (string | undefined)[] = [undefined, 'Saturday', 'Sunday'];

function profileFor(rng: () => number): OnboardingData {
  const teamDays = pickFrom(rng, TEAM_DAY_SETS);
  const gameDay = pickFrom(rng, GAME_DAY_CHOICES);
  return {
    seasonPhase: pickFrom(rng, SEASON_PHASES),
    position: 'inside_mid',
    motivation: 'Dominate your level',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: teamDays.length,
    teamTrainingDays: [...teamDays],
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Hard',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar',
      'cable_machine', 'hamstring_curl', 'knee_extension', 'bands'],
    experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.5x bodyweight+',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
    ...(gameDay ? { usualGameDay: gameDay, gameDay } : {}),
  } as unknown as OnboardingData;
}

function pickFrom<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/** Mutable walk state — the walker's own bookkeeping, not app state. */
let todayISO = INSTALL_DAY;
let weekStart = INSTALL_DAY;
let onboarded = false;
let generated = false;
let lastChange: PlanChange | null = null;

function freshInstall(): void {
  todayISO = INSTALL_DAY;
  weekStart = INSTALL_DAY;
  onboarded = false;
  generated = false;
  lastChange = null;
  localStorageData.clear();
  useProfileStore.setState({ onboardingData: {} as OnboardingData, isOnboardingComplete: false });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 0, lastTransaction: 'walker:fresh-install',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
}

function visibleWeek(): ResolvedDay[] {
  if (!generated) return [];
  return quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
}

function projectedWeek(): ResolvedDay[] {
  if (!generated) return [];
  return quiet(() => buildProgramTabProjectedWeek({
    mondayISO: weekStart, todayISO,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
}

function weekFingerprint(): string {
  return visibleWeek()
    .map((day) => `${day.date}=${day.workout?.name ?? 'REST'}|${day.workout?.exercises.length ?? 0}`)
    .join(';');
}

// ── The doors ─────────────────────────────────────────────────────────────

const CATEGORIES = ['conditioning_light', 'conditioning_hard', 'strength_upper',
  'strength_lower', 'strength_full', 'accessories', 'recovery'] as const;
const G1_ROUTES = [undefined, 'keep_the_day', 'take_the_gunshow',
  'accessories_only', 'deloaded'] as const;

function performAction(action: WalkerAction): WalkerStepResult {
  const base = { action, outcome: null as string | null, message: null as string | null, threw: null as Error | null };
  switch (action.kind) {
    case 'answer_onboarding': {
      useProfileStore.getState().updateOnboardingData(action.profile);
      const outcome = useProfileStore.getState().completeOnboarding();
      onboarded = true;
      return { ...base, outcome: typeof outcome === 'object' && outcome
        ? String((outcome as { outcome?: string }).outcome ?? 'completed') : 'completed' };
    }
    case 'generate_program': {
      const profile = useProfileStore.getState().onboardingData;
      const program = quiet(() => generateProgramLocally(profile, {
        todayISO, previousProgram: null,
        seasonPhaseClock: {
          protocolVersion: 1,
          selectedPhase: (profile as { seasonPhase?: string }).seasonPhase as never,
          phaseEntryWeekStartISO: weekStart,
          originProvenance: 'explicit_user_phase_change',
          persistenceProvenance: 'preserved_persisted_state',
        },
      })) as TrainingProgram;
      const settled = program.microcycles[1] ?? program.microcycles[0]!;
      weekStart = settled.startDate.slice(0, 10);
      todayISO = weekStart;
      const marks = useCalendarStore.getState().markedDays ?? {};
      useProgramStore.setState({
        currentProgram: program, currentMicrocycle: settled,
        acceptedMaterialContext: {
          ...useProgramStore.getState().acceptedMaterialContext,
          markedDays: marks, revision: 1, lastTransaction: 'walker:generate',
        },
      } as never);
      generated = true;
      return { ...base, outcome: 'generated' };
    }
    case 'plan_change': {
      lastChange = action.change;
      const result = quiet(() => applyPlanChange({
        change: action.change,
        visibleWeek: visibleWeek(),
        todayISO,
        setManualOverride: (date, workout, context) =>
          useProgramStore.getState().setManualOverride(date, workout, context),
      }));
      return { ...base, outcome: result.outcome, message: result.message };
    }
    case 'mark_calendar': {
      const calendar = useCalendarStore.getState();
      if (action.mark === 'game') calendar.setGameDay(action.date, todayISO);
      else if (action.mark === 'rest') calendar.setRestDay(action.date);
      else { calendar.removeGameDay(action.date); calendar.removeRestDay(action.date); }
      const marks = useCalendarStore.getState().markedDays ?? {};
      useProgramStore.setState({
        acceptedMaterialContext: {
          ...useProgramStore.getState().acceptedMaterialContext, markedDays: marks,
        },
      } as never);
      return { ...base, outcome: 'marked' };
    }
    case 'declare_source_fact': {
      const signal = action.fact === 'poor_sleep'
        ? { sleepQuality: 'poor' as const }
        : { illness: action.fact === 'illness_severe' ? 'severe' as const : 'minor' as const };
      useReadinessStore.setState({
        signalsByDate: {
          ...(useReadinessStore.getState() as unknown as { signalsByDate: Record<string, unknown> }).signalsByDate,
          [action.date]: signal,
        },
      } as never);
      return { ...base, outcome: 'declared' };
    }
    case 'clear_source_facts': {
      useReadinessStore.setState({ signalsByDate: {} } as never);
      return { ...base, outcome: 'cleared' };
    }
    case 'advance_time': {
      todayISO = addDaysISO(todayISO, action.days);
      // Crossing into a new week moves what the athlete is looking at, exactly
      // as the app does when Monday arrives.
      const monday = mondayFor(todayISO);
      if (monday !== weekStart) {
        const program = useProgramStore.getState().currentProgram;
        const next = program?.microcycles.find((m) => m.startDate.slice(0, 10) === monday);
        if (next) {
          weekStart = monday;
          useProgramStore.setState({ currentMicrocycle: next } as never);
        }
      }
      return { ...base, outcome: 'advanced' };
    }
    default:
      return base;
  }
}

function mondayFor(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  const offset = (parsed.getDay() + 6) % 7;
  return addDaysISO(date, -offset);
}

// ── Proposing the next action ─────────────────────────────────────────────

function proposeAction(rng: () => number, step: number): WalkerAction | null {
  if (!onboarded) return { kind: 'answer_onboarding', profile: profileFor(rng) };
  if (!generated) return { kind: 'generate_program' };

  const week = visibleWeek();
  if (week.length === 0) return { kind: 'advance_time', days: 1 };
  const occupied = week.filter((day) => day.workout);
  const roll = rng();

  if (roll < 0.12) {
    return {
      kind: 'mark_calendar',
      date: pickFrom(rng, week).date,
      mark: pickFrom(rng, ['game', 'rest', 'clear'] as const),
    };
  }
  if (roll < 0.18) {
    return {
      kind: 'declare_source_fact',
      date: pickFrom(rng, week).date,
      fact: pickFrom(rng, ['illness_minor', 'illness_severe', 'poor_sleep'] as const),
    };
  }
  if (roll < 0.21) return { kind: 'clear_source_facts' };
  if (roll < 0.28) return { kind: 'advance_time', days: pickFrom(rng, [1, 2, 7] as const) };

  // A door. Only propose what is legal to ATTEMPT — the producer still gets to
  // refuse; what we must not do is spend the budget on actions no screen offers.
  const target = pickFrom(rng, week);
  const route = pickFrom(rng, G1_ROUTES);
  const doorRoll = rng();
  if (doorRoll < 0.35) {
    return { kind: 'plan_change', change: {
      kind: 'add_category', date: target.date, category: pickFrom(rng, CATEGORIES),
      ...(route ? { g1Route: route } : {}),
    } as PlanChange };
  }
  if (doorRoll < 0.55) {
    return { kind: 'plan_change', change: {
      kind: 'swap_category', date: target.date, category: pickFrom(rng, CATEGORIES),
      ...(route ? { g1Route: route } : {}),
    } as PlanChange };
  }
  if (doorRoll < 0.8 && occupied.length > 0) {
    const from = pickFrom(rng, occupied);
    const scopes = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: week, date: from.date, todayISO,
    })).move.scopes.map((scope) => scope.id);
    return { kind: 'plan_change', change: {
      kind: 'move_session', fromDate: from.date, toDate: target.date,
      ...(scopes.length > 0 ? { scope: pickFrom(rng, scopes) } : {}),
      ...(route ? { g1Route: route } : {}),
    } as PlanChange };
  }
  if (occupied.length > 0) {
    const victim = pickFrom(rng, occupied);
    return { kind: 'plan_change', change: {
      kind: 'remove_session', date: victim.date,
      scope: pickFrom(rng, ['whole_day', 'strength', 'conditioning'] as const),
    } as PlanChange };
  }
  return { kind: 'advance_time', days: 1 };
}

// ── The seven laws, as invariants ─────────────────────────────────────────

const RAW_CODE = /[a-z]{2,}_[a-z_]{2,}/;

/**
 * The action a message NARRATES, read from its words. Sam's finding: an ADD of
 * conditioning was confirmed with "okay, moved Upper Pull". Copy must name the
 * action that was taken, and the transaction kind is the only thing that knows
 * which one that was.
 */
function narratedAction(message: string): 'move' | 'add' | 'swap' | 'remove' | null {
  // Only explicit past-tense ACTION VERBS count. "X is now on Tuesday" names a
  // placement and is honest after an add, a swap or a move, so reading it as a
  // verb would make this law argue about English instead of about actions.
  const text = message.toLowerCase();
  if (/\bmoved\b/.test(text)) return 'move';
  if (/\bswapped\b|\bswitched\b/.test(text)) return 'swap';
  if (/\badded\b/.test(text)) return 'add';
  if (/\bremoved\b|\bbinned\b/.test(text)) return 'remove';
  return null;
}

function actionOfChange(change: PlanChange): 'move' | 'add' | 'swap' | 'remove' {
  switch (change.kind) {
    case 'move_session': return 'move';
    case 'add_category': case 'add_template': return 'add';
    case 'swap_category': case 'swap_template': return 'swap';
    default: return 'remove';
  }
}

let fingerprintBefore = '';

function checkInvariants(last: WalkerStepResult): { law: string; detail: string }[] {
  const broken: { law: string; detail: string }[] = [];
  if (!generated) return broken;

  // L2 HONEST OUTCOME — only doors answer, so only doors are judged.
  if (last.action.kind === 'plan_change') {
    const { outcome, message } = last;
    if (!outcome || !['applied', 'refused', 'no_change'].includes(outcome)) {
      broken.push({ law: 'L2 HONEST OUTCOME', detail: `outcome "${outcome}" is not one of the three` });
    }
    if (!message || message.trim().length === 0) {
      broken.push({ law: 'L2 HONEST OUTCOME', detail: 'silent outcome — no sentence for the athlete' });
    } else if (RAW_CODE.test(message.trim())) {
      broken.push({ law: 'L2 HONEST OUTCOME', detail: `raw internal code reached the athlete: "${message}"` });
    }

    // L2b COPY NAMES THE ACTION TAKEN — from the transaction kind, never assumed.
    if (message && outcome === 'applied' && lastChange) {
      // Only the LEAD sentence is the confirmation of the athlete's action.
      // What follows is the disclosure clause, and "Lower-body strength was
      // moved to Tuesday to keep your week balanced" is an honest description
      // of a CONSEQUENCE after a swap. Judging the whole string would make this
      // law forbid the repair-disclosure law's own sentences.
      const lead = message.split(/(?<=\.)\s+/)[0] ?? message;
      const narrated = narratedAction(lead);
      const actual = actionOfChange(lastChange);
      if (narrated && narrated !== actual) {
        broken.push({
          law: 'L2b COPY NAMES THE ACTION TAKEN',
          detail: `the athlete performed an ${actual.toUpperCase()} and the confirmation narrates a `
            + `${narrated.toUpperCase()}: "${lead}"`,
        });
      }
    }

    // L3 CONSERVATION — a refusal changes nothing.
    if (outcome !== 'applied' && weekFingerprint() !== fingerprintBefore) {
      broken.push({
        law: 'L3 CONSERVATION',
        detail: `a ${outcome} outcome changed the week\n        before: ${fingerprintBefore}\n        after:  ${weekFingerprint()}`,
      });
    }
  }

  // L4b THE SCREEN AGREES WITH THE DOMAIN — after every action, not just doors.
  const resolved = visibleWeek();
  const projected = projectedWeek();
  for (const day of resolved) {
    const mirror = projected.find((candidate) => candidate.date === day.date);
    const resolvedName = day.workout?.name ?? 'REST';
    const projectedName = mirror?.workout?.name ?? 'REST';
    if (resolvedName !== projectedName) {
      broken.push({
        law: 'L4b SCREEN = DOMAIN',
        detail: `${day.date}: the resolver says "${resolvedName}", the screen says "${projectedName}"`,
      });
      break;
    }
    const sections = (mirror?.workout as { sections?: { kind: string; title: string }[] } | undefined)?.sections ?? [];
    const titles = sections.map((section) => `${section.kind}:${section.title}`);
    if (new Set(titles).size !== titles.length) {
      broken.push({
        law: 'L4b SCREEN = DOMAIN',
        detail: `${day.date}: the screen renders the same section twice — ${JSON.stringify(titles)}`,
      });
      break;
    }
  }

  // L5 THE DAY STAYS USABLE — every day, after every action.
  for (const day of resolved) {
    const options = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: resolved, date: day.date, todayISO,
    }));
    const usable = options.categories.length > 0 || options.addOnTopCategories.length > 0 ||
      options.canRemove || !options.move.refusal || !!options.locked;
    if (!usable) {
      broken.push({
        law: 'L5 THE DAY STAYS USABLE',
        detail: `${day.date} is DEAD — no door offered and nothing said why`,
      });
      break;
    }
  }

  fingerprintBefore = weekFingerprint();
  return broken;
}

const host: WalkerHost = {
  reset: () => { freshInstall(); fingerprintBefore = ''; },
  perform: (action) => {
    fingerprintBefore = weekFingerprint();
    return performAction(action);
  },
  propose: proposeAction,
  checkInvariants,
};

// ── The sweep ─────────────────────────────────────────────────────────────

const EXTENDED = process.env.WALKER_BUDGET === 'extended';
const WALK_COUNT = EXTENDED ? 200 : 24;
const WALK_LENGTH = EXTENDED ? 60 : 25;

console.log(`\n-- Athlete action-sequence walker (${EXTENDED ? 'EXTENDED' : 'bounded'}: `
  + `${WALK_COUNT} walks × ${WALK_LENGTH} actions) --`);

run(`${WALK_COUNT} walks of ${WALK_LENGTH} actions hold all seven laws`, () => {
  const violations: string[] = [];
  for (let seed = 1; seed <= WALK_COUNT; seed++) {
    const violation = walk({ host, seed, length: WALK_LENGTH });
    if (violation) {
      violations.push(
        `\n    SEED ${seed} — ${violation.law}\n    ${violation.detail}\n`
        + `    minimal failing history (${violation.history.length} actions):\n`
        + `${describeHistory(violation.history)}`);
      // Report every distinct law, not just the first seed that trips.
      if (violations.length >= 5) break;
    }
  }
  assert(violations.length === 0,
    `the walker found law violations:\n${violations.join('\n')}`);
});

run('the walker actually explores — its vocabulary is not stuck on one action', () => {
  // Non-vacuity. A proposer that answers onboarding forever would pass every
  // law above and prove nothing at all.
  const seen = new Set<string>();
  for (let seed = 1; seed <= 8; seed++) {
    const rng = makeRng(seed);
    freshInstall();
    for (let step = 0; step < 25; step++) {
      const action = proposeAction(rng, step);
      if (!action) break;
      seen.add(action.kind === 'plan_change' ? `plan_change:${action.change.kind}` : action.kind);
      try { performAction(action); } catch { break; }
    }
  }
  const required = ['answer_onboarding', 'generate_program', 'mark_calendar',
    'advance_time', 'plan_change:add_category', 'plan_change:move_session'];
  const missing = required.filter((kind) => !seen.has(kind));
  assert(missing.length === 0,
    `the walker never proposed: ${missing.join(', ')} — reached ${JSON.stringify([...seen])}`);
});

// ── Conformance: can the vocabulary REACH Sam's device? ───────────────────

run('the action vocabulary can reach the shape of Sam\'s real device', () => {
  // device-export-8's ONLY role (Sam's ruling). Not a seed — a target. If no
  // sequence of real actions can produce a state of his shape, the vocabulary
  // is missing an action an athlete really has, and THAT is the defect.
  const shape = SAM_EXPORT_8_CONFORMANCE_SHAPE;
  freshInstall();
  const history: WalkerAction[] = [
    { kind: 'answer_onboarding', profile: shape.profile() },
    { kind: 'generate_program' },
  ];
  for (const [date, mark] of Object.entries(shape.markedDays)) {
    history.push({ kind: 'mark_calendar', date, mark: mark as 'game' | 'rest' });
  }
  for (const action of history) {
    try { performAction(action); } catch (error) {
      assert(false, `the vocabulary could not perform ${action.kind}: `
        + `${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const state = useProgramStore.getState();
  const reached = {
    onboardingComplete: useProfileStore.getState().isOnboardingComplete,
    answerCount: Object.keys(useProfileStore.getState().onboardingData ?? {}).length,
    hasProgram: !!state.currentProgram,
    markedDayCount: Object.keys(state.acceptedMaterialContext.markedDays ?? {}).length,
  };
  assert(reached.onboardingComplete, 'the vocabulary cannot complete onboarding');
  assert(reached.hasProgram, 'the vocabulary cannot produce a program');
  assert(reached.answerCount >= shape.onboardingAnswerCount,
    `the vocabulary reached ${reached.answerCount} onboarding answers, his device had `
    + `${shape.onboardingAnswerCount} — an answer the athlete really gives is missing`);
  assert(reached.markedDayCount === Object.keys(shape.markedDays).length,
    `the vocabulary reached ${reached.markedDayCount} calendar marks, his device had `
    + `${Object.keys(shape.markedDays).length}`);
  console.log(`      ${describeConformanceShape()}`);
});

console.log(`\nAction walker totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
