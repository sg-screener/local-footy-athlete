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
 * BUDGETS, AND WHY DEPTH IS ITS OWN DIMENSION (L13, 2026-07-30). Width and depth
 * are different instruments and are DECLARED separately, because a shallow gate
 * wearing the deep one's name is the failure that law exists to prevent:
 *
 *   npm run test:action-walker           bounded  — 10 × 14. `test:bible`'s gate.
 *   npm run test:action-walker:extended  WIDE     — 200 × 60. Nightly/pre-merge.
 *   npm run test:action-walker:deep      DEEP     — 3 × 90, ≥4 weeks of clock per
 *                                                   walk, ASSERTED. Accumulated
 *                                                   life: one program, many edits,
 *                                                   blocks rolling over.
 *
 *   WALKER_SURVEY=1   tally every distinct offence shape instead of the first.
 *   WALKER_HARVEST=1  arm every declared red, so the walk fails, shrinks and
 *                     prints the minimal history an entry has to carry.
 *
 * WHAT THE LAWS ARE. The athlete-door matrix's laws (L1-L5) after EVERY action,
 * plus L6 (the block rolls over) and the SURFACE laws L-P0/L-P1/L-P2/L-P3/L-P4,
 * ported from `surfaceAgreementTests` where they were stated against one world.
 * A law is a law: they run in every tier. Reds that today's code cannot hold are
 * carried in DECLARED_RED with the task that pays each one, and a declared red
 * that stops redding FAILS the suite.
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
  executeProgramControlAction,
  programControlActionForPlanChange,
} from '../utils/programControlActions';
import { getProgramBlockRolloverStatus } from '../utils/programBlockState';
import { rolloverProgramBlock } from '../utils/programBlockRollover';
import { getSessionComponents } from '../utils/sessionComponents';
import { composeDayDetail } from '../utils/dayDetailComposition';
import { project, projectParts } from '../rules/projectVisibleWeek';
import {
  walk, describeHistory, makeRng,
  type WalkerAction, type WalkerHost, type WalkerStepResult,
} from './support/athleteActionWalker';
import {
  SAM_EXPORT_8_CONFORMANCE_SHAPE,
  describeConformanceShape,
  samExport8EquipmentAnswerThroughTheDoor,
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

/**
 * The only shape the surface laws read from the canonical projection. BOTH halves
 * satisfy it — `project()` (words included) and `projectParts()` (structure
 * alone) — which is what lets a copy gap degrade to the structural answer rather
 * than disarming the structural laws.
 */
interface CanonicalWeek {
  readonly days: readonly {
    readonly date: string;
    readonly kind: string;
    readonly parts: readonly { readonly kind: string }[];
    readonly capabilities: { readonly canRemoveWholeDay: boolean };
  }[];
}

function daysBetweenISO(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime())
    / 86400000);
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
    teamTrainingIntensity: 'Moderate',
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
    // The equipment door is a required step now; a walked athlete answers it.
    // Full kit, matching what the retired location union used to resolve, so
    // the walker's worlds keep their capability envelope.
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
        bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
        foam_roller: 'have', plyo_box: 'have',
      },
      modalities: { bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have' },
      answeredOn: INSTALL_DAY,
    },
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
/**
 * How each plan change actually reached the app, counted.
 *
 * The non-vacuity test below proves the walker PROPOSES a move; these prove it
 * ROUTED like the screen. Without them a refactor that made
 * `programControlActionForPlanChange` return null for everything would send the
 * whole vocabulary back down to `applyPlanChange` — the exact layer that was
 * green while Sam's phone was red — and every law would still pass.
 */
let wrapperRoutedChanges = 0;
let directRoutedChanges = 0;
/**
 * The last block rollover that FAILED, if one did. Cleared when a law has seen
 * it, so one broken rollover is one violation and not one per later action.
 */
let rolloverFailure: string | null = null;

function freshInstall(): void {
  todayISO = INSTALL_DAY;
  weekStart = INSTALL_DAY;
  onboarded = false;
  generated = false;
  lastChange = null;
  rolloverFailure = null;
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

// THE VOCABULARY GAINS A DOOR, it does not rename one. Sam split 'accessories' into
// 'gunshow' and 'prehab' on 2026-07-30, and the walker's job is to be able to reach
// every state an athlete can reach — so it now walks BOTH doors. Leaving one out would
// make a reachable state unreachable, which AGENTS.md names as a defect in the harness
// rather than a gap in the app.
//
// It found the split's one real miss on its first run after the change: with
// 'accessories' still in this list, `add accessories` threw "undefined is not a
// function" inside the door, because the id no longer resolves to a category. A door
// that throws is L1, and a stale vocabulary is how a harness manufactures one.
const CATEGORIES = ['conditioning_light', 'conditioning_hard', 'strength_upper',
  'strength_lower', 'strength_full', 'gunshow', 'prehab', 'recovery'] as const;
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
      // THE DOOR THE SCREEN USES, NOT THE ONE UNDERNEATH IT.
      //
      // This entered at `applyPlanChange` — the layer BELOW the sheet's
      // dispatch — which is exactly why the walker, the matrix and the device
      // replay were all green on 2026-07-29 while three of Sam's five taps
      // failed on his phone. `PlanChangeSheet` sends a MOVE or a BIN through the
      // program-control wrapper and everything else straight to the producer,
      // and that split was the failing coordinate nothing enumerated.
      //
      // `programControlActionForPlanChange` IS that dispatch, owned in one place
      // and called by both the sheet and this host — a harness that mirrors a
      // screen drifts from it, one that CALLS it cannot. Null means "the wrapper
      // does not own this kind", which is the sheet's own condition for going
      // direct.
      const screenAction = programControlActionForPlanChange(action.change);
      if (!screenAction) {
        directRoutedChanges += 1;
        const direct = quiet(() => applyPlanChange({
          change: action.change,
          visibleWeek: visibleWeek(),
          todayISO,
          setManualOverride: (date, workout, context) =>
            useProgramStore.getState().setManualOverride(date, workout, context),
        }));
        return { ...base, outcome: direct.outcome, message: direct.message };
      }
      wrapperRoutedChanges += 1;
      const result = quiet(() => executeProgramControlAction(screenAction, {
        visibleWeek: visibleWeek(),
        todayISO,
        setManualOverride: (date, workout, context) =>
          useProgramStore.getState().setManualOverride(date, workout, context),
      }));
      // The wrapper answers in its own vocabulary. A landing ask is a QUESTION,
      // not a refusal, and must not be reported to the laws as one — that
      // conflation is the defect the wrapper reassessment named.
      return {
        ...base,
        outcome: result.outcome
          ?? (result.ok ? 'applied' : result.needsGuidedFollowUp ? 'needs_input' : 'refused'),
        message: result.message ?? null,
      };
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
      // THE APP'S OWN ANSWER TO TIME PASSING — the block rolls over.
      //
      // L13 required a DEEP tier and the first attempt at one proved the
      // vocabulary was incomplete: `generateProgramLocally` emits FOUR
      // microcycles (2026-07-13 .. 2026-08-09 from this install day), so a walk
      // that advanced past four weeks fell off the end of its own program —
      // every day resolved REST, every menu answered `outside_horizon`, and the
      // "deep" walk was a walk through an empty world. That is exactly the
      // shallow-gate-wearing-a-deep-costume this law exists to forbid.
      //
      // The app does not do that. `useHomeScreen` rolls the block forward on
      // render, one block per pass, until today is inside the active window
      // (`useHomeScreen.ts:320-356`). An athlete in week five HAS a week five.
      // So the walker's clock door calls the same coordinator the screen calls,
      // with its own today rather than the wall clock. Per this file's founding
      // rule: a state an athlete can be in that the walker cannot reach is a
      // defect in the harness, and this was one.
      for (let pass = 0; pass < 6; pass++) {
        const store = useProgramStore.getState();
        const status = getProgramBlockRolloverStatus({
          program: store.currentProgram, dateISO: todayISO, blockState: store.blockState,
        });
        if (!status.needsRollover) break;
        try {
          quiet(() => rolloverProgramBlock({
            baseProfile: useProfileStore.getState().onboardingData,
            targetDateISO: todayISO,
          }));
        } catch (error) {
          // THE SCREEN CATCHES, SO THE DOOR CATCHES. `useHomeScreen.ts:346-348`
          // wraps this call in try/catch and logs — an athlete whose rollover
          // fails sees no crash, he sees a program that stopped. Letting it
          // throw here would report a crash he never gets and would hide the
          // failure he does. It is recorded as its own law instead: L6.
          rolloverFailure = error instanceof Error ? error.message : String(error);
          break;
        }
      }
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
  // THE ONLY THING THE DEEP TIER CHANGES ABOUT THE VOCABULARY: how often the
  // athlete reaches for the clock. Same action, same day sizes {1,2,7} — a tier
  // that advanced in bigger jumps would be a different life, not a longer one.
  if (roll < (DEEP ? 0.45 : 0.28)) {
    return { kind: 'advance_time', days: pickFrom(rng, [1, 2, 7] as const) };
  }

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

/**
 * THE SURVEY. Every law offence the walk sees, tallied by its shape rather than
 * by the day it landed on.
 *
 * A declared red has to carry its reproduction, and a regex written from ONE
 * observed message is how a broad entry ends up swallowing the next, different
 * defect in the same law. `WALKER_SURVEY=1` prints the distinct shapes and the
 * first seed that reached each, which is what an entry's `matches` should be cut
 * from — and what Tasks 4-6 re-run to check an entry is still earning its place.
 */
const offenceTally = new Map<string,
  { law: string; detail: string; count: number; firstSeed: number }>();
let currentSeed = 0;

function recordOffence(law: string, detail: string): void {
  const key = `${law}::${detail.replace(/\d{4}-\d{2}-\d{2}/g, '<date>').slice(0, 220)}`;
  const seen = offenceTally.get(key);
  if (seen) seen.count += 1;
  else offenceTally.set(key, { law, detail, count: 1, firstSeed: currentSeed });
}

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

  // L6 THE BLOCK ROLLS OVER — an athlete who keeps opening the app keeps
  // having a program.
  //
  // Only the DEEP tier can reach this: the generated block is four microcycles
  // wide, so nothing shallower than four weeks of clock ever asks the lifecycle
  // boundary to do its job. When it refuses, the screen logs and moves on and
  // the athlete is left standing on the last week of a spent block, every day
  // `outside_horizon`, with no crash and no sentence. That silence is the defect,
  // which is why it is a law here and not a swallowed catch.
  if (rolloverFailure) {
    const failure = rolloverFailure;
    rolloverFailure = null;
    pushOffence(broken, 'L6 THE BLOCK ROLLS OVER',
      `the program block would not roll forward for ${todayISO} and the athlete was `
      + `told nothing — ${failure}`);
  }

  // ── THE SURFACE LAWS (L-P), AS WALKER INVARIANTS ─────────────────────────
  //
  // `surfaceAgreementTests` states these laws against ONE world — his device's
  // shape, three taps from generate — and L13 named what that costs: cells 1 and
  // 4 PASS there, because in a freshly-acted world the G+1 Sunday still resolves
  // a real session and the surfaces agree. The two defects he photographed most
  // directly were the two the harness could not reach. A law that only holds
  // where it was written is not a law, so the COMPARISONS move here, where the
  // walker reaches accumulated worlds by acting. The fixture stays behind.
  //
  // The comparison bodies are ported from `surfaceAgreementTests.ts:250-281`
  // (L-P1, L-P3) and `:350-367` (L-P4). The shape is always
  // surface === projection, never surface_a === surface_b: two surfaces that
  // drifted together satisfy the weaker form, and surfaces agreeing with each
  // other's mistakes is the whole failure being replaced.
  //
  //   CARD      = `resolveWeekWithConditioning`  (what a week card renders)
  //   CANONICAL = `buildProgramTabProjectedWeek` -> `projectParts`
  //
  // WORDS FIRST, STRUCTURE UNDERNEATH. `project()` is the full projection and a
  // week whose words are unsigned is itself a surface defect — L-P2's family:
  // the signed-copy gate exists so planner-internal text CANNOT reach an
  // athlete, and a throw is that gate firing. But a copy gap must not disarm the
  // structural laws, so when it throws the walk falls back to `projectParts` —
  // "one derivation, no vocabulary" (`projectVisibleWeek.ts`) — and L-P1/L-P3/
  // L-P4 are still judged on the same action.
  //
  // COST. One projection for the week and one menu per day, computed ONCE and
  // shared with L5. The bounded tier is inside `test:bible` and every one of
  // these runs after every action, in both tiers.
  let canonical: CanonicalWeek | null = null;
  try {
    canonical = quiet(() => project({ week: projected, weekStart }));
  } catch (error) {
    pushOffence(broken, 'L-P2 SIGNED WORDS',
      'the projection refused to render the words for a week the athlete walked to '
      + `— ${error instanceof Error ? error.message : String(error)}`);
    try {
      canonical = quiet(() => projectParts({ week: projected, weekStart }));
    } catch (structural) {
      pushOffence(broken, 'L-P0 THE PROJECTION DERIVES',
        'even the structural projection threw for a week the athlete walked to — '
        + `${structural instanceof Error ? structural.message : String(structural)}`);
    }
  }

  // One entry per law per action: a law that breaks on four days of one week is
  // one defect, and four copies of it would drown the report.
  const reported = new Set<string>();
  const offend = (law: string, detail: string): void => {
    if (reported.has(law)) return;
    reported.add(law);
    pushOffence(broken, law, detail);
  };

  for (const day of resolved) {
    const options = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: resolved, date: day.date, todayISO,
    }));

    // L5 THE DAY STAYS USABLE — every day, after every action.
    const usable = options.categories.length > 0 || options.addOnTopCategories.length > 0 ||
      options.canRemove || !options.move.refusal || !!options.locked;
    if (!usable) {
      offend('L5 THE DAY STAYS USABLE',
        `${day.date} is DEAD — no door offered and nothing said why`);
    }

    if (!canonical) continue;
    const mirror = projected.find((candidate) => candidate.date === day.date);
    const canonicalDay = canonical.days.find((candidate) => candidate.date === day.date);
    if (!mirror || !canonicalDay) {
      offend('L-P3 PARTS CONSERVATION',
        `${day.date} is on the card and absent from the projection entirely`);
      continue;
    }

    // L-P1 ONE DAY, ONE NAME.
    const cardName = day.workout?.name ?? null;
    const canonicalName = mirror.workout?.name ?? null;
    if (cardName !== canonicalName) {
      offend('L-P1 ONE DAY ONE NAME',
        `${day.date}: card "${cardName}" / projection "${canonicalName}". One day, two stories.`);
    }

    // L-P3 PARTS CONSERVATION — same ids, same order, same count.
    const cardParts = partIds(day.workout);
    const canonicalIds = partIds(mirror.workout);
    if (JSON.stringify(cardParts) !== JSON.stringify(canonicalIds)) {
      offend('L-P3 PARTS CONSERVATION',
        `${day.date}: card ${JSON.stringify(cardParts)} / projection ${JSON.stringify(canonicalIds)}. `
        + '`parts` is the only plural; a surface showing a different list composed its own.');
    }

    // L-P3 THE DETAIL SCREEN'S OWN ACCOUNT — `composeDayDetail` is
    // `useDayWorkout`'s composition, extracted; this is the third story.
    const detailKinds = detailPartKinds(mirror.workout);
    const projectionKinds = Array.from(
      new Set(canonicalDay.parts.map((part) => String(part.kind)))).sort();
    if (JSON.stringify(detailKinds) !== JSON.stringify(projectionKinds)) {
      // The DIFFERENCE is named, not just the two lists. A declared red has to
      // be pinnable to the exact disagreement it carries, or it becomes a regex
      // that swallows the next, different defect in the same law.
      const omits = projectionKinds.filter((kind) => !detailKinds.includes(kind));
      const invents = detailKinds.filter((kind) => !projectionKinds.includes(kind));
      offend('L-P3 DETAIL = PROJECTION',
        `${day.date}: the detail omits ${JSON.stringify(omits)} and invents `
        + `${JSON.stringify(invents)} — detail ${JSON.stringify(detailKinds)} / projection `
        + `${JSON.stringify(projectionKinds)}. The detail composes its own account at render.`);
    }

    // L-P4 THE MENU AND THE PROJECTION AGREE ABOUT WHAT IS ON THE DAY.
    //
    // Ruling 3: recovery is a day type like any other — same menu capabilities,
    // same editing rules. Cell 4 asserts three things about one recovery Sunday;
    // the generalisation is by STATE, not by asking less — every day is asked,
    // and the comparison is BOTH directions. A menu that offers less than the
    // projection carries is the recovery-Sunday defect; a menu that offers less
    // while the projection offers MORE is the same split seen from the other end,
    // and skipping it because the menu had a reason is exactly the "loosen until
    // it passes" move L13 forbids.
    //
    // `not_visible` and `outside_horizon` ARE skipped, and that is not a
    // loosening: both are facts about the editing WINDOW, and the projection
    // holds no opinion about the window at all. `game_day` is not skipped —
    // that is a claim about the day's nature, and the projection has its own.
    const windowLocked = options.locked === 'not_visible' || options.locked === 'outside_horizon';
    if (!windowLocked) {
      const menuRemovable = options.hasSession && options.canRemove;
      const projectionRemovable = canonicalDay.capabilities.canRemoveWholeDay;
      if (menuRemovable !== projectionRemovable) {
        offend('L-P4 MENU = PROJECTION',
          `${day.date}: the projection calls this a "${canonicalDay.kind}" day carrying `
          + `${JSON.stringify(canonicalDay.parts.map((part) => String(part.kind)))} and says its `
          + `work ${projectionRemovable ? 'CAN' : 'CANNOT'} be removed; the menu `
          + `(locked=${options.locked ?? 'null'}, hasSession=${options.hasSession}, `
          + `canRemove=${options.canRemove}) says it ${menuRemovable ? 'CAN' : 'CANNOT'}. `
          + 'One day, two capability stories.');
      } else if (projectionRemovable && options.move.refusal?.reason === 'no_session') {
        // The move clause names only `no_session`, because that is the refusal
        // that CONTRADICTS the projection. `anchored_day` and `no_destination`
        // are facts about the week, not claims that the day is empty, and a walk
        // that fills every other day reaches them honestly. Cell 4's Sunday had
        // destinations, so this narrows nothing that cell asserted.
        offend('L-P4 MENU = PROJECTION',
          `${day.date}: the projection carries work and the move door answers "no_session" — `
          + `"${options.move.refusal.message}"`);
      }
    }
  }

  fingerprintBefore = weekFingerprint();
  // DECLARED REDS ARE CARRIED, NOT TERMINAL. Filtering here rather than on the
  // walk's return is what lets the deep tier BE deep: a violation returned from
  // `walk()` ends that walk at the step it happened, so a cell that reds at step
  // 3 would cap every walk at three actions and the depth the tier declares
  // could never be reached. It also skips the shrink for an already-shrunk red.
  return broken.filter((violation) => !declaredRedFor(violation.law, violation.detail));
}

function pushOffence(
  broken: { law: string; detail: string }[], law: string, detail: string,
): void {
  recordOffence(law, detail);
  broken.push({ law, detail });
}

/** The part list a surface would show. The ONLY plural, per the ruling. */
function partIds(workout: unknown): string[] {
  return getSessionComponents((workout ?? null) as never).map((part) => String(part.id));
}

/**
 * What the DETAIL screen thinks is on a day, in the projection's vocabulary.
 * Ported from `surfaceAgreementTests.detailStory` — same five questions asked of
 * the same composition.
 */
function detailPartKinds(workout: unknown): string[] {
  const composed = quiet(() => composeDayDetail(
    (workout ?? null) as never, (workout ?? null) as never));
  const parts: string[] = [];
  if (composed.strengthExercises.length > 0) parts.push('strength');
  if (composed.supportExercises.length > 0) parts.push('support');
  if (composed.conditioningRowCount > 0) parts.push('conditioning');
  if (composed.isRecovery) parts.push('recovery');
  if (composed.hasTeamTraining) parts.push('team_training');
  return Array.from(new Set(parts)).sort();
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

/**
 * L13: THE DEEP TIER IS DECLARED, NOT A SCALED SHALLOW ONE.
 *
 * Depth is not "the same walk, more of it". It is ACCUMULATED LIFE: one program,
 * many edits, weeks of the clock actually moving, blocks rolling over. The law is
 * explicit that a shallow gate wearing the deep one's name is the exact failure it
 * exists to prevent, so the two tiers are declared side by side here and the deep
 * one carries a MINIMUM DEPTH it must prove it reached.
 *
 *   bounded  — `test:bible`'s budget. Fast, wide, three-ish weeks of clock.
 *   extended — the nightly sweep. Wide, not deep.
 *   deep     — `npm run test:action-walker:deep`. Narrow and long.
 *
 * `minWeeksAdvanced` is asserted, not hoped for: a deep walk that stayed inside
 * one week is a shallow walk with a deep label, and it FAILS the tier.
 */
const EXTENDED = process.env.WALKER_BUDGET === 'extended';
const DEEP = process.env.WALKER_TIER === 'deep';
const DEPTH_TIER = { walks: 3, length: 90, minWeeksAdvanced: 4 } as const;
const WALK_COUNT = DEEP ? DEPTH_TIER.walks : EXTENDED ? 200 : 10;
const WALK_LENGTH = DEEP ? DEPTH_TIER.length : EXTENDED ? 60 : 14;
const TIER = DEEP ? 'DEEP' : EXTENDED ? 'EXTENDED' : 'bounded';

console.log(`\n-- Athlete action-sequence walker (${TIER}: `
  + `${WALK_COUNT} walks × ${WALK_LENGTH} actions${
    DEEP ? `, ≥${DEPTH_TIER.minWeeksAdvanced} weeks of clock per walk` : ''}) --`);

/**
 * DECLARED RED CELLS.
 *
 * The ruling that produced this stands: a defect carved out of a unit is NAMED,
 * reproduced and skipped, never absorbed quietly. An entry is a promise, not a
 * parking space — it carries the reproduction, it names the task that pays it,
 * and it DELETES when that task lands.
 *
 * Two properties make it a ratchet rather than a bin:
 *
 *   1. `redsIn` says which tier the debt is real in, so a bounded run cannot be
 *      quietly credited with a debt only the deep tier ever incurs.
 *   2. STALE DEBT FAILS. If a declared red stops redding across a whole tier,
 *      the suite fails with "declared red no longer reds" — the entry has to be
 *      removed in the commit that turns the cell green. Debt in this repo only
 *      ever moves down.
 *
 * L13, verbatim, on what this must never become: "Loosening an assertion so that
 * it reds in a shallow world. Cells go red by the walker walking FURTHER, never
 * by asking less." Every entry below is a red the walker reached by walking, with
 * the assertion stated exactly as `surfaceAgreementTests` states it.
 */
interface DeclaredRed {
  id: string;
  law: string;
  matches: RegExp;
  why: string;
  /** The task that turns this cell green and deletes this entry. */
  paidBy: string;
  /** Which tier this debt is real in. `both` = the bounded gate carries it too. */
  redsIn: 'both' | 'deep';
}

const DECLARED_RED: ReadonlyArray<DeclaredRed> = [
  {
    id: 'projection_row_names_are_planner_text',
    law: 'L-P2 SIGNED WORDS',
    // Row names ONLY. An unsigned day or part HEADLINE is a different gap and
    // still fails this suite.
    matches: /"exercise\.name\.[^"]*" is not in the signed-copy sheet/,
    why: 'DEFECT 3, ONE LAYER DOWN. `surfaceAgreementTests` cell 3 banned planner '
      + 'vocabulary from a session NAME; the walker finds it in a ROW name two '
      + 'actions from a fresh install, which no fixture in the suite had reached. '
      + 'Reproduce: bounded seed 1, 2 actions — answer onboarding (In-season, team '
      + 'Wednesday), generate the program. 12 distinct unsigned ids across the deep '
      + 'tier, e.g. "Aerobic conditioning component (3 x 8min zone 2 Mixed Erg '
      + 'Block)", "Assault Bike warm-up", "MetCon - Off-Legs", "Erg EMOM - 10-15 '
      + 'cal", "Easy Spin or Walk". The generator composes these strings; the '
      + 'signed sheet cannot contain them and must not be made to.',
    paidBy: 'Task 6 (the detail/row surface migrates to project()\'s rows)',
    redsIn: 'both',
  },
  {
    id: 'detail_screen_omits_projection_parts',
    law: 'L-P3 DETAIL = PROJECTION',
    // Pinned to the OMISSION SET observed. A detail that drops `support` or
    // `team_training`, or invents anything but `recovery`, is a different defect
    // and still fails.
    matches: /omits \["(?:conditioning|power|recovery|speed|strength)"(?:,"(?:conditioning|power|recovery|speed|strength)")*\] and invents (?:\[\]|\["recovery"\])/,
    why: 'THE THIRD STORY, generalised off his one Sunday. `composeDayDetail` has no '
      + 'row-level surface for recovery, power or speed, so the detail screen\'s own '
      + 'account of a day silently drops parts the projection carries — and in one '
      + 'shape it swaps them (omits ["conditioning"], invents ["recovery"]). '
      + 'Reproduce: bounded seed 1, 2 actions — answer onboarding (In-season, team '
      + 'Wednesday), generate the program: 2026-07-20 detail ["strength"] / '
      + 'projection ["recovery","strength"]. Six distinct diff shapes across the '
      + 'deep tier.',
    paidBy: 'Task 6 (the day-detail screen renders project()\'s parts)',
    redsIn: 'both',
  },
  {
    id: 'menu_offers_removal_of_a_team_night',
    law: 'L-P4 MENU = PROJECTION',
    matches: /a "training" day carrying \["team_training"\] and says its work CANNOT be removed; the menu \(locked=null, hasSession=true, canRemove=true\)/,
    why: 'CAPABILITY PARITY, THE DIRECTION CELL 4 DOES NOT LOOK. A team-only night '
      + 'projects one `team_training` part, which `partCapabilities` correctly calls '
      + 'an ANCHOR — not removable. The menu derives `canRemove` from '
      + '`workout !== null` and offers to bin the team night. Reproduce: bounded '
      + 'seed 1, 2 actions — answer onboarding (In-season, team Wednesday), generate '
      + 'the program; 2026-07-22.',
    paidBy: 'Task 4 (the menu derives its capabilities from project())',
    redsIn: 'both',
  },
  {
    id: 'projection_calls_a_game_day_editable',
    law: 'L-P4 MENU = PROJECTION',
    matches: /a "game" day carrying \["strength"\] and says its work CAN be removed; the menu \(locked=game_day, hasSession=false, canRemove=false\)/,
    why: 'THE PROJECTION DOES NOT KNOW A GAME DAY AT PART LEVEL. `dayKind` says '
      + '"game" and `COMPONENT_TO_PART` still maps the day\'s `session` component to '
      + '`strength`, so the projection offers move and remove on a fixture while the '
      + 'menu locks it. One derivation disagreeing with itself is worse than two '
      + 'surfaces disagreeing. Reproduce: bounded seed 2, 3 actions — answer '
      + 'onboarding (Pre-season, team Wednesday), generate the program, mark '
      + '2026-07-26 as game.',
    paidBy: 'Task 4 (the menu derives its capabilities from project())',
    redsIn: 'both',
  },
  {
    id: 'block_rollover_fails_silently_and_the_program_stops',
    law: 'L6 THE BLOCK ROLLS OVER',
    matches: /Accepted-state ledger mismatch/,
    why: 'ONLY DEPTH REACHES THIS, which is the whole argument for the tier. Four '
      + 'weeks after install the block must roll; `rebuildLocalWeek` re-evaluates '
      + 'the accepted-state ledger, finds blockers '
      + '(planner_selected_target_miss, required_minimum_shortfall, '
      + 'pattern_restore_failure) and throws. `useHomeScreen` catches and logs, so '
      + 'the athlete gets no crash and no sentence — he gets a program that stopped, '
      + 'every day outside the edit horizon. Reproduce: DEEP seed 1, 6 actions — '
      + 'answer onboarding (In-season, team Wednesday), generate the program, '
      + 'advance 7, advance 7, mark 2026-08-09 as game, advance 7; fails rolling '
      + 'into 2026-08-10. NOT A SURFACE DEFECT AND NO TASK IN THIS UNIT PAYS IT: '
      + 'carried here so the tier can run, and reported to Sam for a ruling. See '
      + 'the Task 3 report for why a harness artifact is not excluded.',
    paidBy: 'UNASSIGNED — new finding, Task 3 report, awaiting Sam',
    redsIn: 'deep',
  },
];

const declaredRedHits = new Set<string>();

function declaredRedFor(law: string, detail: string): string | null {
  const entry = DECLARED_RED.find((candidate) =>
    candidate.law === law && candidate.matches.test(detail));
  if (!entry) return null;
  // HARVEST MODE arms every declared red so the walk fails, shrinks and reports
  // the minimal history — the evidence an entry has to carry. It can only ever
  // make the suite redder, which is why it is safe to leave reachable.
  if (process.env.WALKER_HARVEST === '1') return null;
  declaredRedHits.add(entry.id);
  return entry.id;
}

run(`${WALK_COUNT} walks of ${WALK_LENGTH} actions hold every law`, () => {
  const violations: string[] = [];
  const shallow: string[] = [];
  for (let seed = 1; seed <= WALK_COUNT; seed++) {
    currentSeed = seed;
    const violation = walk({ host, seed, length: WALK_LENGTH });
    if (violation) {
      // L1 crashes never reach `checkInvariants`, so the declared-red filter has
      // to be offered one more chance here.
      if (declaredRedFor(violation.law, violation.detail)) continue;
      violations.push(
        `\n    SEED ${seed} — ${violation.law}\n    ${violation.detail}\n`
        + `    minimal failing history (${violation.history.length} actions):\n`
        + `${describeHistory(violation.history)}`);
      // Report every distinct law, not just the first seed that trips.
      if (violations.length >= 5) break;
      continue;
    }
    // THE TIER PROVES ITS OWN DEPTH. Only meaningful on a clean walk: a
    // violation is shrunk before `walk` returns, and the replays leave the
    // clock wherever the minimal history ended.
    if (DEEP) {
      const reached = daysBetweenISO(INSTALL_DAY, todayISO);
      if (reached < DEPTH_TIER.minWeeksAdvanced * 7) {
        shallow.push(`seed ${seed} ended ${reached} days after install (needs `
          + `${DEPTH_TIER.minWeeksAdvanced * 7})`);
      } else {
        console.log(`      seed ${seed}: reached ${todayISO} — ${reached} days `
          + `(${(reached / 7).toFixed(1)} weeks) after install`);
      }
    }
  }
  assert(violations.length === 0,
    `the walker found law violations:\n${violations.join('\n')}`);
  assert(shallow.length === 0,
    'the DEEP tier did not reach the depth it declares — a shallow walk wearing a '
    + `deep label is what L13 forbids:\n    ${shallow.join('\n    ')}`);
  for (const id of declaredRedHits) {
    const entry = DECLARED_RED.find((candidate) => candidate.id === id)!;
    console.log(`      (declared red carried: ${id} — paid by ${entry.paidBy})`);
  }
  if (process.env.WALKER_SURVEY === '1') {
    console.log(`\n  -- offence survey (${offenceTally.size} distinct shapes) --`);
    for (const entry of [...offenceTally.values()].sort((a, b) => b.count - a.count)) {
      console.log(`  [${String(entry.count).padStart(5)}x, first seed ${entry.firstSeed}] `
        + `${entry.law}\n        ${entry.detail}`);
    }
  }
});

run('every declared red still reds — stale debt fails, it does not expire quietly', () => {
  // THE RATCHET DIRECTION. A declared red that no longer happens is a cell that
  // went green, and the commit that turned it green owes the deletion of its
  // entry. Nothing here may outlive the defect it names.
  if (process.env.WALKER_HARVEST === '1') return;
  const owed = DECLARED_RED.filter((entry) =>
    (entry.redsIn === 'both' || DEEP) && !declaredRedHits.has(entry.id));
  assert(owed.length === 0,
    `declared red no longer reds in the ${TIER} tier — delete the entry, do not `
    + `leave it carrying debt that is already paid:\n    ${
      owed.map((entry) => `${entry.id} (${entry.law}, paid by ${entry.paidBy})`).join('\n    ')}`);
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

  // AND IT ROUTED LIKE THE SCREEN. Proposing a move is not the same as sending
  // it where the sheet sends one. Every suite in this repo was green on
  // 2026-07-29 while three of Sam's five taps failed, because all of them
  // entered at `applyPlanChange` and the sheet does not — it dispatches moves
  // and bins through the program-control wrapper. Both counts must be non-zero,
  // or the vocabulary has quietly collapsed back onto one door.
  assert(wrapperRoutedChanges > 0,
    'no plan change reached the program-control wrapper — the walker is entering '
    + 'below the layer the sheet uses, which is how it stayed green while the '
    + 'screen was red');
  assert(directRoutedChanges > 0,
    'every plan change went through the wrapper — the sheet sends adds and swaps '
    + 'straight to the producer, so a harness where nothing does is not the sheet');
});

// ── Conformance: can the vocabulary REACH Sam's device? ───────────────────

run('the action vocabulary can reach the shape of Sam\'s real device', () => {
  // device-export-8's ONLY role (Sam's ruling). Not a seed — a target. If no
  // sequence of real actions can produce a state of his shape, the vocabulary
  // is missing an action an athlete really has, and THAT is the defect.
  const shape = SAM_EXPORT_8_CONFORMANCE_SHAPE;
  freshInstall();
  const history: WalkerAction[] = [
    // The export predates the equipment door; today's flow asks, so today's
    // walk answers — see the fixture helper for why this is not in the export.
    {
      kind: 'answer_onboarding',
      profile: {
        ...shape.profile(),
        equipmentAnswer: samExport8EquipmentAnswerThroughTheDoor(),
      },
    },
    { kind: 'generate_program' },
  ];
  for (const [date, mark] of Object.entries(shape.markedDays)) {
    history.push({ kind: 'mark_calendar', date, mark: mark as 'game' | 'rest' });
  }
  for (const action of history) {
    try {
      performAction(action);
    } catch (error) {
      // TWO DIFFERENT FAILURES WEAR THIS SHAPE, and they mean opposite things.
      //
      // If the vocabulary has no action for something a real athlete does, the
      // HARNESS is incomplete — Sam's stated purpose for this assertion. If the
      // vocabulary has the action, attempts it, and the APP throws, the harness
      // is right and the product is broken. Reporting the second as the first
      // would send someone to fix a walker that is working.
      const message = error instanceof Error ? error.message : String(error);
      assert(false,
        `the app THREW performing ${action.kind} — the vocabulary is complete and `
        + `this is a product defect, not a missing action: ${message}`);
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
