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
import { useCalendarStore, applyCalendarMarkedDaysWrite } from '../store/calendarStore';
import { athleteActionLogEntries } from '../utils/athleteActionLog';
import { useReadinessStore, applyReadinessSignalsWrite } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import {
  useAthletePreferencesStore,
  applyAthletePrefsWrite,
  INITIAL_ATHLETE_PREFS,
} from '../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { applyPlanChange, listPlanChangeOptionsForDay } from '../utils/planChangeProducer';
import {
  executeProgramControlAction,
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
  scheduleFactScopeForAction,
} from '../utils/programControlActions';
import {
  buildRolloverAcknowledgment,
  buildScheduleAcknowledgment,
} from '../utils/readinessAcknowledgment';
import {
  composeTemporarySourceFactCompatibility,
  createTemporaryScheduleFact,
  temporarySourceFactId,
} from '../rules/temporarySourceFact';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { getProgramBlockRolloverStatus } from '../utils/programBlockState';
import { rolloverProgramBlock } from '../utils/programBlockRollover';
import { getSessionComponents, getSessionComponentRows } from '../utils/sessionComponents';
import {
  dayIsPracticeMatch,
  isComposedPrescriptionRow,
  project,
  projectParts,
} from '../rules/projectVisibleWeek';
import { buildSessionTemplate, type SessionTemplateItem } from '../utils/sessionTemplate';
import { projectDayDetail } from '../rules/visibleDayDetail';
import type { VisibleWeek } from '../rules/visibleProjection';
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

/** The async twin. The schedule doors are awaited, so the cell that walks them
 *  cannot be synchronous — and driving them below the await was the whole
 *  defect the review found. */
async function runAsync(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
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
    readonly capabilities: {
      readonly canRemoveWholeDay: boolean;
      readonly canMoveWholeDay: boolean;
    };
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
/** Did THIS walk ever fail to roll a block? The liveness check asks. */
let rolloverFailedThisWalk = false;

function freshInstall(): void {
  todayISO = INSTALL_DAY;
  weekStart = INSTALL_DAY;
  onboarded = false;
  generated = false;
  lastChange = null;
  rolloverFailure = null;
  rolloverFailedThisWalk = false;
  localStorageData.clear();
  useProfileStore.setState({ onboardingData: {} as OnboardingData, isOnboardingComplete: false });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  // A FRESH INSTALL IS TOTAL OR IT IS NOT A FRESH INSTALL.
  //
  // These two were missing, and the gap is not theoretical: adding two doors to
  // the vocabulary on 2026-07-31 re-aimed which walk hit which state, and a walk
  // whose shrunk history was `[answer onboarding, generate]` crashed inside
  // generation — while the SAME two actions replayed on their own did not. The
  // difference was preference state an earlier walk had left behind, which the
  // generator reads. A reset that leaves a door open makes every reproduction in
  // this file a coin toss, and the shrinker's minimal history a lie.
  // Through the store's own reset door — the armour refuses a raw default
  // write over answered prefs, and freshInstall must not bypass the owner.
  useAthletePreferencesStore.getState().clear();
  useCoachPreferencesStore.setState({ modalityPreferences: {} } as never);
  // THE LR-23 IN-MEMORY STORES (unit 6, 2026-08-01). The order probe proved
  // today's vocabulary cannot vary them (nine targets byte-identical solo vs
  // pre-walked, carrier columns constant) — but they demonstrably survive
  // this reset, and the first COACH-door action added to the vocabulary would
  // inherit that hazard silently. Reset through their own actions; the
  // totality cell below CHECKS both, so the next tidy-up cannot delete these
  // lines unnoticed. (The `getCoachRevisionTemplateContext` module singleton
  // is the third confirmed carrier — no reset API, re-set per materialisation
  // from live state; DECLARED in the day-shift log rather than reset here.)
  require('../store/pendingCoachClarifierStore').usePendingCoachClarifierStore.getState().reset();
  require('../store/coachContextStateStore').useCoachContextStateStore.getState().clearCoachContext();
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

/** The sentence `temporarySourceFactTransaction` refuses with, and nowhere else. */
const ENGINE_REFUSAL_SENTENCE =
  'The report was not applied because the visible program could not be verified.';

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined;
  console.debug = () => undefined; console.info = () => undefined;
  console.log = () => undefined;
  try { return await body(); } finally {
    console.warn = warn; console.error = error;
    console.debug = debug; console.info = info; console.log = log;
  }
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
//
// TASK 4, 2026-07-31 — THE SAME RULE APPLIED IN THE OTHER DIRECTION. Sam's design
// ruling 9 names the five types the Add/Swap menus offer, and `recovery` is not one
// of them: the sheet stopped offering it, so an athlete can no longer walk through
// that door and the walker must not either. `mobility` takes its place — it was a
// live producer category that `PlanChangeSheet` never rendered, so the walker was
// walking a door the app did not have and not walking one it did. `recovery` stays
// a `PLAN_CHANGE_CATEGORY_ID` (the charter still charters the type, and the
// resolver/G+1 world still places it); it is the MENU that no longer offers it.
//
// SAM CLOSED THE OTHER HALF ON 2026-07-31, and it does not change this list — it
// changes what the list MEANS. Recovery is not an athlete-facing session type at
// all: an empty G+1 Sunday is REST, which is the ruled end state rather than a gap
// awaiting a recovery unit (`surfaceAgreementTests` cells 2 and 4, re-pointed).
// The walker still must not walk a recovery door, for the stronger reason that
// there is no such door to walk. What survives — the `PLAN_CHANGE_CATEGORY_ID`,
// the producer's `CATEGORY_COPY.recovery` row, the charter's recovery row, and
// `applyGameProximity` replacing a PLANNED G+1 session with a derived recovery
// one — is vocabulary the athlete cannot reach through any menu, recorded as
// named follow-up debt in `docs/BUTTONS_UI_UNIT_BOUNDARY_2026-07-31.md` for the
// charter's own unit, not paid here.
const CATEGORIES = ['conditioning_light', 'conditioning_hard', 'strength_upper',
  'strength_lower', 'strength_full', 'gunshow', 'prehab', 'mobility'] as const;
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
      // THE ACCEPT BOUNDARY, NOT `setState` NEXT TO IT.
      //
      // This door used to publish the program with a raw `setState`, which left
      // `blockState`, `acceptedCompositionBase` and `acceptedProfileSnapshot`
      // null — and the deep tier's L6 red was `rebuildLocalWeek` re-evaluating
      // exactly that ledger four weeks later. A harness that writes state the
      // product's accept boundary would have written differently is the
      // `harness-enters-below-the-door` failure this repo has now named four
      // times, and the first suspect for any red that only it can see.
      //
      // `commitRebuiltProgram` is the shared publisher: it derives `blockState`
      // from the program and routes the whole thing through
      // `commitAcceptedStateTransaction`, the same owner the rollover uses. The
      // walker now enters there, so an L6 red means the PRODUCT could not roll a
      // block it accepted — not that the harness handed it a program the product
      // would never have stored.
      quiet(() => commitRebuiltProgram(
        program,
        { preserve: [], clear: [], conflictsRemoved: [] },
        {
          markedDays: useCalendarStore.getState().markedDays ?? {},
          selectedDate: todayISO,
          reason: 'walker:generate',
        },
      ));
      // The walker looks at the SETTLED week, not week one; the accept boundary
      // selects for `selectedDate`, so point the microcycle at what the walk is
      // about to act on.
      useProgramStore.setState({ currentMicrocycle: settled } as never);
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
    // ── THE TWO SCHEDULE DOORS, AS A STATE-REACHER — NOT AS THE DOOR ─────
    //
    // THE DOOR IS WALKED ELSEWHERE, through the real executor, in
    // `walkTheScheduleDoors` at the bottom of this file. These two cases exist
    // for the opposite job: putting the walker's world INTO the state a landed
    // schedule fact creates, so the other laws (L4b screen = domain, the
    // projection checks) run over a week that has one. They cannot be the door
    // because `perform` is synchronous and the executor is awaited — and because
    // the executor currently REFUSES every schedule fact against a real accepted
    // base (declared red 1), so a walker that only entered there would never
    // reach this state at all.
    //
    // They use the real creator and the real scope owner
    // (`scheduleFactScopeForAction`) and the real compatibility composer, so the
    // state is the state, not a hand-drawn version of it. `declare_source_fact`
    // above sets the same precedent for the readiness store. When declared red 1
    // is paid, both of these collapse into the real transaction and this comment
    // goes with them.
    case 'short_on_time_today':
    case 'away_this_week': {
      const dates = action.kind === 'away_this_week' ? [...action.dates].sort() : [];
      const date = action.kind === 'away_this_week' ? (dates[0] ?? todayISO) : action.date;
      const scope = scheduleFactScopeForAction({
        type: 'set_schedule_modifier',
        source: { screen: 'program_tab', surface: action.kind, initiatedBy: 'tap' },
        scope: action.kind === 'short_on_time_today' ? 'today_only' : 'current_week',
        payload: dates.length > 0
          ? { date, todayISO, planChange: { kind: 'clear_days', dates } }
          : { date, todayISO },
        requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
      } as never);
      const fact = createTemporaryScheduleFact({
        observedDate: date,
        scope,
        scheduleKind: dates.length > 0 ? 'travel' : 'busy_week',
        unavailableDates: dates,
        sourceActor: 'athlete',
        sourceSurface: action.kind,
      });
      const accepted = useProgramStore.getState().acceptedMaterialContext;
      const facts = [
        ...accepted.temporarySourceFacts.filter((existing) =>
          temporarySourceFactId(existing) !== temporarySourceFactId(fact)),
        fact,
      ];
      const compatibility = quiet(() => composeTemporarySourceFactCompatibility({
        temporarySourceFacts: facts,
        activeConstraints: accepted.activeConstraints,
        readinessSignalsByDate: accepted.readinessSignalsByDate,
      }));
      useProgramStore.setState({
        acceptedMaterialContext: {
          ...accepted,
          temporarySourceFacts: facts,
          activeConstraints: compatibility.activeConstraints,
          revision: accepted.revision + 1,
          lastTransaction: `walker:${action.kind}`,
        },
      } as never);
      return { ...base, outcome: 'declared' };
    }
    case 'clear_source_facts': {
      useReadinessStore.setState({ signalsByDate: {} } as never);
      // The schedule doors publish into the accepted context, so clearing has to
      // reach there too — otherwise a walk could never get back to a week with
      // no schedule fact on it, and half the state space would be one-way.
      const accepted = useProgramStore.getState().acceptedMaterialContext;
      const kept = accepted.temporarySourceFacts.filter((fact) =>
        'factKind' in fact && fact.factKind !== 'schedule');
      if (kept.length !== accepted.temporarySourceFacts.length) {
        const compatibility = quiet(() => composeTemporarySourceFactCompatibility({
          temporarySourceFacts: kept,
          activeConstraints: [],
          readinessSignalsByDate: accepted.readinessSignalsByDate,
        }));
        useProgramStore.setState({
          acceptedMaterialContext: {
            ...accepted,
            temporarySourceFacts: kept,
            activeConstraints: compatibility.activeConstraints,
            revision: accepted.revision + 1,
            lastTransaction: 'walker:clear_source_facts',
          },
        } as never);
      }
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
          // THE BOUNDARY REFUSES TYPED NOW (Sam's interim ruling, 2026-07-31;
          // built 2026-08-01). A refusal is L6-LEGAL exactly when the athlete
          // is told: the ack owner must produce the sentence, in the
          // athlete's words, with no raw code in it. Silence — a refusal the
          // ack owner answers with nothing — is the defect the ruling
          // retires, and a THROW is the boundary breaking its own contract.
          const rolled = quiet(() => rolloverProgramBlock({
            baseProfile: useProfileStore.getState().onboardingData,
            targetDateISO: todayISO,
          }));
          if (rolled.refusal) {
            const ack = buildRolloverAcknowledgment(rolled);
            if (!ack || ack.tone !== 'error' || ack.message.trim().length === 0) {
              rolloverFailure = 'the rollover refused and the ack owner said '
                + `NOTHING — code ${rolled.refusal.code}`;
            } else if (RAW_CODE.test(ack.message) ||
              ack.message.includes(rolled.refusal.code)) {
              rolloverFailure = `a raw code reached the athlete: "${ack.message}"`;
            }
            rolloverFailedThisWalk = true;
            break;
          }
        } catch (error) {
          rolloverFailure = 'the rollover THREW instead of refusing typed — '
            + (error instanceof Error ? error.message : String(error));
          rolloverFailedThisWalk = true;
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
  // ORDER-PROBE BAND (unit 6, 2026-08-01): the Task-7 contamination was only
  // ever observed with the schedule doors in the RANDOM band, so the probe
  // needs a switch that puts them back there. Never on in the gate — the
  // doors' gate home is the deterministic cell until declared red 1 is paid.
  if (process.env.WALKER_RANDOM_SCHEDULE_DOORS === '1' && roll < 0.24) {
    return rng() < 0.5
      ? { kind: 'short_on_time_today', date: pickFrom(rng, week).date }
      : { kind: 'away_this_week', dates: [pickFrom(rng, week).date] };
  }
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

  // ONE ENTRY PER LAW PER ACTION — BUT A DECLARED RED DOES NOT SPEND THE SLOT.
  //
  // The brevity rule is real: a law that breaks on four days of one week is one
  // defect, and four copies would drown the report. But the first draft applied
  // it BEFORE the declared-red filter, and that combination is a hole, not a
  // trade-off. The first offending day of the week matched a declared entry,
  // spent the law's only slot, and every DIFFERENT-shaped offence in that law on
  // Tuesday through Sunday was dropped without a trace. Review's survey caught
  // it: zero L-P3/L-P4 offences on Thu-Sun across ~1900 day-checks, which is the
  // fingerprint of a dedupe, not of a defect that politely happens on Mondays.
  //
  // So the order is: SURVEY EVERYTHING, then let declared reds through without
  // consuming the slot, then dedupe what is left. A carried debt cannot shadow an
  // undeclared red behind it.
  const reported = new Set<string>();
  const offend = (law: string, detail: string): void => {
    recordOffence(law, detail);
    if (declaredRedFor(law, detail)) return;
    if (reported.has(law)) return;
    reported.add(law);
    broken.push({ law, detail });
  };

  // L6 THE BLOCK ROLLS OVER, OR REFUSES TO THE ATHLETE'S FACE — re-pointed
  // 2026-08-01 to Sam's interim ruling (2026-07-31): "the existing rollover
  // must SUCCEED, or REFUSE HONESTLY with a sentence. The silent stop IS the
  // defect — not the failure."
  //
  // Only the DEEP tier can reach this: the generated block is four microcycles
  // wide, so nothing shallower than four weeks of clock ever asks the lifecycle
  // boundary to do its job. An honest typed refusal (the ack owner's sentence,
  // no raw code) is now L6-LEGAL; what offends is a THROW, or a refusal the
  // athlete would read as nothing. `rolloverFailure` is set by the clock door
  // ONLY for those two shapes.
  if (rolloverFailure) {
    const failure = rolloverFailure;
    rolloverFailure = null;
    offend('L6 THE BLOCK ROLLS OVER',
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
  // STRUCTURE ONCE, WORDS BESIDE IT — never one derived from the other's failure.
  //
  // The structural half is what L-P1/L-P3/L-P4 are judged against, and it is
  // computed ONCE, unconditionally. The words half is asked separately: a week
  // whose words are unsigned is itself a surface defect (L-P2's family — the
  // signed-copy gate exists so planner-internal text cannot reach an athlete, and
  // a throw is that gate firing), but a copy gap must not disarm three structural
  // laws. The first draft read `project()` first and fell back to `projectParts`
  // in the catch, which both evaluated the structure twice on the failing path
  // AND fed the laws a different-shaped canonical depending on whether the words
  // happened to resolve. One shape, one evaluation, always.
  //
  // COST. One structural projection plus one words pass for the week, and one
  // menu per day shared with L5. The bounded tier is inside `test:bible` and
  // every one of these runs after every action, in both tiers.
  let canonical: CanonicalWeek | null = null;
  try {
    canonical = quiet(() => projectParts({ week: projected, weekStart }));
  } catch (structural) {
    offend('L-P0 THE PROJECTION DERIVES',
      'the structural projection threw for a week the athlete walked to — '
      + `${structural instanceof Error ? structural.message : String(structural)}`);
  }
  let words: VisibleWeek | null = null;
  try {
    words = quiet(() => project({ week: projected, weekStart }));
  } catch (error) {
    offend('L-P2 SIGNED WORDS',
      'the projection refused to render the words for a week the athlete walked to '
      + `— ${error instanceof Error ? error.message : String(error)}`);
  }

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

    // L-P3 THE DETAIL SCREEN'S OWN ACCOUNT — from the function the screen renders.
    //
    // This read `composeDayDetail` until Task 6 — `useDayWorkout`'s render-time
    // composition, which had a surface for strength, support and conditioning and
    // none at all for recovery, power or speed, so three kinds of work simply
    // vanished from the athlete's account of his own day. That composition no
    // longer reaches a screen: `projectDayDetail` (`rules/visibleDayDetail.ts`) is
    // what `DayWorkoutScreenV2` renders, and it is what is asked here.
    //
    // It maps `parts`, so the lists agree by construction — which IS the ruled end
    // state ("`parts` is the ONLY plural ... two surfaces reading one list cannot
    // disagree"). The assertion is what keeps it that way: a filter or a `kind`
    // branch added to the detail surface reds on the next walk. Only reachable when
    // the words resolved; a week that threw is already an L-P2 offence above and
    // gets no second, derived one.
    const visibleDay = words?.days.find((candidate) => candidate.date === day.date) ?? null;
    if (visibleDay) {
      const detail = projectDayDetail(visibleDay);
      const detailKinds = Array.from(
        new Set((detail?.sections ?? []).map((section) => String(section.kind)))).sort();
      const projectionKinds = Array.from(
        new Set(visibleDay.parts.map((part) => String(part.kind)))).sort();
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

      // L-P3 TEMPLATE = PROJECTION — the CONTENT the screen is about to draw.
      //
      // The one check here that crosses representations. `buildSessionTemplate` is
      // a separate composition of the same day, owned by D13, and it is what fills
      // the athlete's session list; `visibleDay.parts` is what the projection says
      // is on the day. Neither is derived from the other, so this can actually
      // fail — and it is the successor to the three deleted `L-P3 DETAIL =
      // PROJECTION` entries, which named exactly this defect class one composition
      // earlier. See `sessionTemplateKinds` for the enumerated mapping.
      const templateKinds = sessionTemplateKinds(mirror.workout);
      const contentKinds = Array.from(new Set(visibleDay.parts
        .map((part) => String(part.kind))
        .filter((kind) => !TITLE_ONLY_PART_KINDS.has(kind)))).sort();
      if (JSON.stringify(templateKinds) !== JSON.stringify(contentKinds)) {
        const omits = contentKinds.filter((kind) => !templateKinds.includes(kind));
        const invents = templateKinds.filter((kind) => !contentKinds.includes(kind));
        offend('L-P3 TEMPLATE = PROJECTION',
          `${day.date}: the session list omits ${JSON.stringify(omits)} and invents `
          + `${JSON.stringify(invents)} — template ${JSON.stringify(templateKinds)} / `
          + `projection ${JSON.stringify(contentKinds)}. The list the athlete reads `
          + 'and the projection tell one story or neither is the projection.');
      }

      // L-P3 ROWS CONSERVATION — a part the projection carries must carry its work.
      //
      // NEW IN TASK 6, and it exists because a debt MOVED rather than being paid.
      // `project()` used to compose every row from the workout, including the ones
      // `sessionBuilder.condEx` assembles out of planner nouns and numbers, and it
      // threw `UnsignedCopyError` on them — which, now that the card and the detail
      // both render from `project()`, is a CRASH on the athlete's phone rather than
      // a red in a harness. It stopped carrying composed prescription rows (see
      // `isComposedPrescriptionRow`); the authored words they are owed do not exist
      // yet, and signing the composer's output instead would be the defect the
      // branded type exists to prevent. So the gap is stated here in its own words
      // instead of as a throw: the part is carried, named and capable, and its rows
      // do not add up.
      //
      // EXACT EQUALITY, not "at least one". A part that carried three of its five
      // rows would satisfy a non-empty test while two pieces of the athlete's
      // session had quietly gone missing.
      //
      // TWO LAWS, NOT ONE, and the split is what keeps either of them meaning
      // something. `isComposedPrescriptionRow` is imported from the projection
      // rather than reimplemented here, so what the law counts as owed is exactly
      // what the projection claims it can carry — one predicate, both ends.
      // Counting composed rows as owed would have made every arithmetic shortfall
      // look alike, and the composed-row debt would have been free to hide a real
      // lost strength row behind it (it nearly did: on a combined sprint day the
      // keyword-tail classifier puts composed sprint rows in `strengthRows`, so
      // the shortfall showed up on a STRENGTH part).
      const rowsOwed = getSessionComponentRows(mirror.workout as never);
      const authored = (rows: any[]): number =>
        rows.filter((row) => !isComposedPrescriptionRow(row)).length;
      const owedByKind: Record<string, number> = {
        strength: authored(rowsOwed.strengthRows),
        support: authored(rowsOwed.supportRows),
        conditioning: authored(rowsOwed.conditioningRows),
      };
      for (const part of visibleDay.parts) {
        const owed = owedByKind[String(part.kind)];
        if (owed === undefined || owed === part.rows.length) continue;
        offend('L-P3 ROWS CONSERVATION',
          `${day.date}: the projection carries a "${part.kind}" part with `
          + `${part.rows.length} rows while the day has ${owed} authored ones. A part `
          + 'the athlete is shown must carry the work that is in it.');
      }

      // L-P2, AT ROW LEVEL — the work the projection cannot name.
      //
      // The other half of the split above, stated as what it is rather than as an
      // arithmetic shortfall: these rows exist on the athlete's day and their names
      // were assembled by `sessionBuilder.condEx` out of planner nouns and numbers,
      // so no authored source owns them and no surface reading the projection can
      // say them. Declared, with the conditioning-generation owner named.
      const composedRows = [
        ...rowsOwed.strengthRows, ...rowsOwed.supportRows, ...rowsOwed.conditioningRows,
      ].filter(isComposedPrescriptionRow);
      if (composedRows.length > 0) {
        const example = String(composedRows[0]?.exercise?.name ?? composedRows[0]?.name ?? '');
        offend('L-P2 SIGNED WORDS',
          `${day.date}: ${composedRows.length} rows on this day carry names the builder `
          + `composed, so the projection can name none of them — e.g. "${example}".`);
      }

      // ── THE NAMING LAWS (L-P5/L-P6/L-P7), 2026-08-01 ──────────────────────
      //
      // Sam's combined device pass failed three cells that differ only by
      // SURFACE COORDINATE — a fixture variant, a charter-type part, a deleted
      // type's word — which is L11's stop condition verbatim: the space gets
      // enumerated before any single cell gets fixed. All three are claims
      // about the WORDS the projection resolves, asserted from the branded
      // `SignedCopy` text, never from a surface reading its own composition.

      // L-P5 THE FIXTURE WORD MATCHES THE SEASON. Sam's ruling 6-IV-4 signed
      // "Practice Match" for a practice/trial fixture; the typed predicate for
      // "this fixture is a practice match" is the engine's own
      // (`coachingEngine.section18ModeAndSubphase`: Pre-season + a fixture =
      // practice_match_week). A pre-season fixture rendering "Game Day" is the
      // producer failing to ship the typed variant the signed label reads —
      // device-pass fail 1. The day's own typed variant outranks the phase
      // (a hand-built 'Practice Match' workout reads its word in any season,
      // `projectionOwnershipTests` pins that); the phase decides what the
      // producer should have stamped when the variant channel is empty.
      if (visibleDay.kind === 'game') {
        const phase = quiet(() => buildScheduleStateImperative().seasonPhase);
        const expectedFixtureWord = dayIsPracticeMatch(mirror) || phase === 'Pre-season'
          ? 'Practice Match'
          : 'Game Day';
        if (String(visibleDay.headline) !== expectedFixtureWord) {
          offend('L-P5 FIXTURE VARIANT',
            `${day.date}: a ${phase ?? 'unknown-phase'} fixture reads `
            + `"${String(visibleDay.headline)}" — the signed word for this world is `
            + `"${expectedFixtureWord}" (ruling 6-IV-4).`);
        }
      }

      // L-P6 A CHARTER TYPE NAMES ITSELF. A workout carrying the typed
      // `composedOptionalKind` marker is a Gunshow / Accessories / Mobility
      // session by construction, and one of its parts must carry the charter
      // word — never only the generic kind fallback. Vacuously green until the
      // producer ships the marker; the deterministic cells below carry the
      // pre-producer red so this law cannot be satisfied by deleting the field.
      const optionalKind = (mirror.workout as unknown as {
        composedOptionalKind?: 'gunshow' | 'prehab' | 'mobility';
      } | null)?.composedOptionalKind;
      if (optionalKind) {
        const charterWord = (
          { gunshow: 'Gunshow', prehab: 'Accessories', mobility: 'Mobility' } as const
        )[optionalKind];
        // ONE WORD (ruling 7-e, signed 2026-08-01): the marker guarantees the
        // workout IS one composed session (`stackTemplate` clears it on
        // combining), so its own parts are exactly the door's word. Attached
        // add-on parts ride with the DAY, not the session, and are excluded —
        // they carry their own word by position.
        const ownWords = visibleDay.parts
          .filter((part) => !part.id.endsWith(':recovery_addon'))
          .map((part) => String(part.headline));
        if (JSON.stringify(ownWords) !== JSON.stringify([charterWord])) {
          offend('L-P6 CHARTER TYPE NAMES ITSELF',
            `${day.date}: a typed ${optionalKind} session renders `
            + `${JSON.stringify(ownWords)} — ruling 7-e says exactly `
            + `["${charterWord}"]: the door's name alone, rows are contents not `
            + 'card vocabulary.');
        }
      }

      // L-P8 CARD IDENTITY, ONE NAME (Sam, 2026-08-01 — the queue addition
      // extending ruling 7-e to ALL sessions). Support/midline rows inside a
      // strength or conditioning session are CONTENTS, not card vocabulary: a
      // lower day reads "Lower Body Strength", never "+ Midline Work". A
      // support part may exist ONLY as the identity of a day whose sole
      // content is trunk work — so a support part beside a strength or
      // conditioning part on the same day is the defect, whatever the words.
      // (Team-combo joins are untouched: team_training is an anchor part, not
      // content this law counts. Power rides beside a sole-trunk day
      // unchanged — folding trunk into an invented "Strength" word would be
      // the opposite defect.)
      {
        const kinds = visibleDay.parts.map((part) => String(part.kind));
        if (kinds.includes('support') &&
          (kinds.includes('strength') || kinds.includes('conditioning'))) {
          offend('L-P8 CARD IDENTITY',
            `${day.date}: a support part rides beside content parts `
            + `(${JSON.stringify(kinds)}) — midline rows are contents of the `
            + 'session they are in, not card vocabulary (Sam, 2026-08-01).');
        }
      }

      // L-P7 THE DELETED TYPE'S WORD NEVER RENDERS. Recovery is not an
      // athlete-facing session type (session-type charter; design ruling 9
      // "(type deleted)"; the G+1 Rest ruling closed on the same ground). No
      // door offers it, no menu can act on it — so a day or part headline
      // reading "Recovery" is the projection rendering a type the athlete
      // cannot reach: device-pass fail 3, whichever producer emitted it.
      const renderedWords = [
        String(visibleDay.headline),
        ...visibleDay.parts.map((part) => String(part.headline)),
      ];
      if (renderedWords.includes('Recovery')) {
        offend('L-P7 DELETED VOCABULARY',
          `${day.date}: renders "Recovery" (${JSON.stringify(renderedWords)}) — a `
          + 'charter-deleted type on the athlete\'s glass; the producer that emitted '
          + 'it is the defect, not the label.');
      }
    }

    // L-P4 THE MENU AND THE PROJECTION AGREE ABOUT WHAT IS ON THE DAY.
    //
    // ONE DAY, ONE CAPABILITY STORY — whatever kind of day it is. Cell 4 of
    // `surfaceAgreementTests` asserts the menu's answers about ONE day (the G+1
    // Sunday, which Sam ruled REST on 2026-07-31); this is the same claim
    // generalised by STATE, not by asking less — every day is asked, and the
    // comparison is BOTH directions. A menu that offers less than the projection
    // carries was the original recovery-Sunday defect; a menu that offers MORE
    // than the projection carries is the same split seen from the other end (a
    // door with nothing behind it), and skipping it because the menu had a reason
    // is exactly the "loosen until it passes" move L13 forbids.
    //
    // WHY THIS SURVIVED THE RULING UNCHANGED. The re-pointed cell 4 now expects a
    // rest day to REFUSE swap/move/remove, which is the opposite of what it used
    // to expect — and this law needed no edit for that, because it never encoded
    // an expectation about recovery in the first place. It compares the two
    // answers. A rest day gives `false === false` and agrees.
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
      }
      // THE MOVE CLAUSE, STRICT AND SYMMETRIC. Cell 4 asserts the menu's move
      // answer with no qualification — since the 2026-07-31 re-pointing, that the
      // rest Sunday refuses with the typed cause `no_session` — and the projection
      // has a matching field, `canMoveWholeDay`, which is `editable.length > 0`
      // (`projectVisibleWeek.ts`). So the comparison is the equality, not a
      // hand-picked subset of refusal reasons.
      //
      // The first draft accepted `anchored_day` and `no_destination` as "facts
      // about the week the projection has no opinion about". That was asking less
      // than the reference, which L13 forbids outright: the projection DOES have
      // an opinion — it says the day's work is movable — and a menu that refuses
      // is disagreeing with it whatever reason it gives. If the projection should
      // learn about anchors and full weeks, that is a projection defect, and it
      // gets to be visible as one.
      const menuMovable = !options.move.refusal;
      if (menuMovable !== canonicalDay.capabilities.canMoveWholeDay) {
        offend('L-P4 MENU = PROJECTION',
          `${day.date}: the projection calls this a "${canonicalDay.kind}" day carrying `
          + `${JSON.stringify(canonicalDay.parts.map((part) => String(part.kind)))} and says its `
          + `work ${canonicalDay.capabilities.canMoveWholeDay ? 'CAN' : 'CANNOT'} be moved; the `
          + `move door ${menuMovable ? 'offers a move' : `refuses "${options.move.refusal?.reason}"`}`
          + ` (locked=${options.locked ?? 'null'}). One day, two move stories.`);
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

/** The part list a surface would show. The ONLY plural, per the ruling. */
function partIds(workout: unknown): string[] {
  return getSessionComponents((workout ?? null) as never).map((part) => String(part.id));
}

/**
 * WHAT THE SCREEN'S CONTENT LIST IS ABOUT TO SHOW, in the projection's vocabulary.
 *
 * THE CROSS-REPRESENTATION LAW'S OTHER SIDE, and the reason it is a law rather
 * than an identity. Review caught the first version of Task 6's replacement
 * checks being restatements of `project()` over its own output:
 * `projectDayDetail` maps `parts` one-to-one, so comparing its section kinds to
 * `parts` kinds could only ever agree. Meanwhile the rows the athlete actually
 * reads come from somewhere else entirely — `buildSessionTemplate(workout)`, D13's
 * one-list composition owner (`DayWorkoutScreenV2.tsx:489`, rendered at
 * `:1230-1261`) — and NOTHING compared that to the projection. Which is to say the
 * exact defect class the three deleted declared reds named (the rendered account
 * omitting work the projection carries) was unwatched on the surface that ships.
 *
 * So this asks the D13 owner, on real generated weeks, what kinds of work its
 * items represent, and the law compares it to `visibleDay.parts`. Two
 * compositions, one story, or a red.
 *
 * THE MAPPING IS ENUMERATED, NOT INFERRED. Every arm below is a stated claim
 * about what a template item puts on the glass; a template item shape added later
 * lands in no arm and reds as `unmapped:<kind>` rather than being quietly ignored.
 *
 * `game` is the one part kind the CONTENT list is not responsible for and it is
 * excluded here by name: a fixture's part is the placeholder `getSessionComponents`
 * emits for a workout with no training content (`exercises: []`), so there is
 * nothing for a list to hold and the TITLE speaks it ("Game Day", via
 * `visibleDayLeadHeadline`). This is not a hole — a fixture day carrying real
 * components projects those as real kinds, and they are compared like any other.
 */
const TEMPLATE_ITEM_KIND: Record<string, string> = {
  // A conditioning choice block, and a conditioning phase row on a
  // conditioning-only day, are both the day's conditioning work.
  conditioning_choice: 'conditioning',
  conditioning_phase: 'conditioning',
  // Add-on rows: `recoveryAddons`, rendered as ordinary optional rows since D13.
  addon: 'recovery',
  // The team-training banner.
  team_training: 'team_training',
};

const STRENGTH_ROLE_KIND: Record<string, string> = {
  power: 'power',
  midline: 'support',
  main_lift: 'strength',
  accessory: 'strength',
  prehab: 'strength',
  conditioning: 'conditioning',
};

/** Part kinds the day-detail CONTENT list does not carry — see the header above. */
const TITLE_ONLY_PART_KINDS: ReadonlySet<string> = new Set(['game']);

function sessionTemplateKinds(workout: unknown): string[] {
  const template = quiet(() => buildSessionTemplate((workout ?? null) as never));
  const kinds = new Set<string>();
  if (template.mode === 'recovery') {
    // Sam's §6 item 3 exception: a recovery day keeps its own simple template —
    // `RecoveryBlock` over the workout's rows plus `RecoveryAddonSection`. No
    // items, and the whole day is recovery work.
    kinds.add('recovery');
    return [...kinds].sort();
  }
  for (const item of template.items as SessionTemplateItem[]) {
    if (item.kind === 'team_training') { kinds.add(TEMPLATE_ITEM_KIND.team_training); continue; }
    if (item.kind === 'conditioning_choice') {
      kinds.add(TEMPLATE_ITEM_KIND.conditioning_choice);
      continue;
    }
    if (item.presentation === 'strength') {
      kinds.add(STRENGTH_ROLE_KIND[String(item.role)] ?? `unmapped_role:${String(item.role)}`);
      continue;
    }
    kinds.add(TEMPLATE_ITEM_KIND[item.presentation] ?? `unmapped:${String(item.presentation)}`);
  }
  return [...kinds].sort();
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

/**
 * WALKER_ORDER_PROBE — the cross-walk contamination instrument (unit 6 of the
 * 2026-08-01 day shift; the Task-7 finding: seeds 5-6 passed while 4-6 failed,
 * so something survives `freshInstall`).
 *
 * Band-independent by design: instead of reconstructing the exact action mix
 * that first exposed the ordering, it replays ONE target seed's walk and
 * prints the world fingerprint after every action. Run it twice —
 *
 *   WALKER_ORDER_PROBE=6      — target seed walks on a VIRGIN process
 *   WALKER_ORDER_PROBE=4,5,6  — same seed walks after predecessors
 *
 * — and diff the `[probe 6:N]` lines. Determinism means equal worlds produce
 * equal lines; the FIRST divergent action index names where a predecessor's
 * residue changed this walk's world. Beside each line the three suspected
 * carriers (the two LR-23 in-memory stores and the coach template-context
 * singleton) report whether they hold non-virgin state.
 */
async function runOrderProbe(spec: string): Promise<void> {
  // A malformed spec must refuse loudly — BSD `seq -s,` emits a TRAILING
  // comma, which parsed here as a NaN target, which matched no seed, which
  // printed nothing, which read as "the target's walk vanished" — a whole
  // false-divergence investigation from one quiet parse. An instrument that
  // can silently observe nothing is not an instrument.
  const seeds = spec.split(',').map((value) => value.trim()).filter(Boolean)
    .map((value) => parseInt(value, 10));
  if (seeds.length === 0 || seeds.some((seed) => !Number.isFinite(seed))) {
    throw new Error(`WALKER_ORDER_PROBE spec "${spec}" did not parse to seeds`);
  }
  const target = seeds[seeds.length - 1];
  const carrierState = (): string => {
    const clarifier = require('../store/pendingCoachClarifierStore');
    const context = require('../store/coachContextStateStore');
    const pending = clarifier.usePendingCoachClarifierStore?.getState?.() ?? {};
    const ctx = context.useCoachContextStateStore?.getState?.() ?? {};
    let template = 'unreadable';
    try {
      const mod = require('../utils/coachRevisionTemplateContext');
      template = JSON.stringify(mod.getCoachRevisionTemplateContext?.() ?? null)?.slice(0, 60) ?? 'null';
    } catch { template = 'throws'; }
    return `clarifier=${JSON.stringify(pending.pending ?? null)} ctx=${
      Object.keys(ctx).filter((key) => ctx[key] != null).length}keys template=${template}`;
  };
  for (const seed of seeds) {
    let index = 0;
    const probeHost: WalkerHost = {
      ...host,
      perform: (action) => {
        const result = host.perform(action);
        if (seed === target) {
          index += 1;
          console.log(`[probe ${seed}:${index}] ${action.kind} | ${weekFingerprint()} | rev=${
            useProgramStore.getState().acceptedMaterialContext.revision} | ${carrierState()}`);
        }
        return result;
      },
    };
    walk({ host: probeHost, seed, length: WALK_LENGTH });
  }
}

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
  /**
   * The condition under which this entry must be gone. Written down because
   * `paidBy` names WHO and this names WHEN — an entry whose owner ships without
   * this shape disappearing has not been paid, and one whose shape disappears
   * without its owner shipping was never the debt it claimed to be.
   */
  expiresWhen: string;
  /**
   * Which tiers are REQUIRED to see this shape, for the stale-debt check.
   *
   * Not "where the defect lives" — where it is DETERMINISTICALLY REACHED. The
   * deep tier is three seeds wide; a shape that needs a particular seed's week
   * can be perfectly real and still absent from those three, and demanding it
   * there would make the ratchet fail for a reason that is not debt. The
   * stale-debt cell caught exactly that on the anchored-day entry.
   */
  redsIn: 'bounded' | 'deep' | 'both';
}

const DECLARED_RED: ReadonlyArray<DeclaredRed> = [
  // ── L-P3 TEMPLATE = PROJECTION — FOUR REAL REDS, FOUND BY THE NEW LAW ────
  //
  // These are the deliverable Task 6's first pass owed and did not produce. Its
  // two replacement checks were identities over `project()`'s own output, so the
  // defect class the three deleted `L-P3 DETAIL = PROJECTION` entries named — the
  // rendered account omitting work the projection carries — went unwatched on the
  // surface that ships. `L-P3 TEMPLATE = PROJECTION` compares D13's
  // `buildSessionTemplate` (what fills the athlete's session list) against
  // `visibleDay.parts`, two compositions neither derived from the other, and it
  // reds on real generated weeks in four distinct shapes. Every one of them is
  // work the projection says is on the day and the list does not show.
  //
  // FOUR ENTRIES, NOT ONE. Task 3's review established the rule: a shared id lets
  // an owner fix one shape while the others keep the entry alive, so each notch
  // has to be releasable on its own.
  {
    id: 'session_list_drops_conditioning_attached_to_an_appointment',
    law: 'L-P3 TEMPLATE = PROJECTION',
    matches: /omits \["conditioning"\] and invents \[\] — template \[[^\]]*"team_training"[^\]]*\]/,
    why: 'A TEAM NIGHT CARRYING CONDITIONING SHOWS NONE OF IT. The projection '
      + 'carries a `conditioning` part (the components say so), and '
      + '`buildSessionTemplate` emits nothing for it: its conditioning arms are '
      + '`isConditioningOnly` (a `CONDITIONING_ONLY_TYPES` workoutType) and '
      + '`isCombinedDay` (`hasCombinedConditioning`), and a Team Training day with '
      + 'attached conditioning is neither, so `resolveConditioningOptions` never '
      + 'runs and the rows never enter the one list. This is the same shape as the '
      + 'spec bug D13 was written to fix — "team training hid on conditioning days '
      + 'because `TeamTrainingBlock` only existed inside the strength branch" '
      + '(§2 item 4c) — with the two kinds swapped. Reproduce: bounded seed 5, 5 '
      + 'actions, 2026-07-29; deep seeds reach 2026-08-19 and 2026-09-23.',
    paidBy: 'the D13 session-template owner (`utils/sessionTemplate.ts`, spec '
      + '`docs/SESSION_TEMPLATE_SPEC_2026-07-25.md`). Under the one-projection '
      + 'ruling the list should be driven by the day\'s PARTS rather than by two '
      + 'workoutType predicates; that is a composition-ownership change, not a '
      + 'titling one. NOT paid by the detail-surface task.',
    expiresWhen: 'every conditioning part the projection carries appears in the '
      + 'session list, whatever else is on the day.',
    redsIn: 'both',
  },
  // `conditioning_attached_to_a_composed_optional_day_hides_its_part` (L-P6)
  // — declared and PAID within one session, 2026-08-01. The shape (a typed
  // mobility/prehab day rendering only "Conditioning") was the composed-
  // optional marker LEAKING onto combined days through `stackTemplate`'s base
  // spread; clearing the marker at that composition site removed every
  // reachable instance, and this list's own stale-debt law forced the
  // deletion. The recovery-as-last-resort classifier the shape exposed is
  // still the D13/sessionComponents family's — see
  // `session_list_calls_a_conditioning_day_recovery` below.
  {
    id: 'session_list_calls_a_conditioning_day_recovery',
    law: 'L-P3 TEMPLATE = PROJECTION',
    matches: /omits \["conditioning"\] and invents \["recovery"\]/,
    why: 'THE ONLY SHAPE THAT INVENTS, and it is two classifiers disagreeing about '
      + 'one day. `buildSessionTemplate` short-circuits to `mode: "recovery"` on '
      + '`isRecoveryWorkout` (workoutType `Recovery` OR `sessionTier === '
      + '"recovery"`), which renders `RecoveryBlock` and no items at all; '
      + '`getSessionComponents` looked at the same workout and said conditioning. '
      + 'So the athlete is shown a recovery day over conditioning work. DEEP ONLY: '
      + 'it needs a day whose tier and whose content have come apart, which the '
      + 'bounded tier\'s fourteen actions do not build. Reproduce: deep, '
      + '2026-08-06 — template ["recovery"] / projection ["conditioning"].',
    paidBy: 'the D13 session-template owner, with `sessionComponents` — one of the '
      + 'two has to stop answering, and the answer should come from the PARTS. '
      + "Sam's 2026-07-31 ruling sharpens this rather than closing it: recovery is "
      + 'not an athlete-facing session type at all any more, so a template that '
      + 'shows an athlete a recovery day over conditioning work is now showing them '
      + 'a type no door offers and no menu can act on.',
    expiresWhen: 'the session list never reports a kind of work the projection does '
      + 'not carry.',
    redsIn: 'deep',
  },
  // NOTE 2026-08-01: this entry was briefly deleted as stale and RESTORED the
  // same day — the run that reported it un-reproducing had its deep walks
  // truncated by then-undeclared L-P6 violations, so the seeds never reached
  // this entry's world. A stale-report from a run with undeclared reds in it
  // is not evidence.
  {
    id: 'session_list_badges_a_midline_row_the_projection_has_no_part_for',
    law: 'L-P3 TEMPLATE = PROJECTION',
    matches: /omits \[\] and invents \["support"\]/,
    why: 'THE TRUNK/SUPPORT SPLIT, ANSWERED TWICE. The template badges a row '
      + '`midline` via `classifyExerciseRole(name)` — a NAME classifier — while '
      + '`getSessionComponentRows` decides the same question with '
      + '`isTrunkSupportRow`, put the row in `strengthRows`, and so no `support` '
      + 'component exists for the projection to carry. Nothing is lost from the '
      + 'glass here (the row renders either way); what disagrees is what KIND of '
      + 'work the athlete is being told it is, which is the same defect class from '
      + 'the other end. DEEP ONLY, by survey. Reproduce: deep, 2026-08-24 — '
      + 'template ["strength","support"] / projection ["strength"].',
    paidBy: 'the D13 session-template owner, with `sessionComponents` — role should '
      + 'come from the part the row belongs to, not from a second reading of its '
      + 'name (the name-as-a-data-channel shape this unit exists to remove).',
    expiresWhen: 'the session list never badges work as a kind the projection does '
      + 'not carry on that day.',
    redsIn: 'deep',
  },
  {
    id: 'session_list_has_no_representation_for_speed_work',
    law: 'L-P3 TEMPLATE = PROJECTION',
    matches: /omits \["speed"\] and invents \[\]/,
    why: 'SPEED WORK IS PRESCRIBED AND NEVER RENDERED. `getSessionComponents` emits '
      + 'a `speed` component from `workout.speedBlock`, so the projection carries a '
      + '`speed` part; `buildSessionTemplate` has no arm for it — it reads '
      + '`powerRows`, `strengthRows`, `supportRows`, `conditioningRows` and '
      + '`recoveryAddons`, and the speed block is none of those. The athlete opens '
      + 'the day and the speed work is not in the list. Sibling of the power case, '
      + 'which D13 DID handle ("power joins the one list as an ordinary row"); '
      + 'speed was missed. BOUNDED, by survey — it needs a week the sprint-exposure '
      + 'gate put a speed block in. Reproduce: bounded seed 4, 2 actions, '
      + '2026-07-20 — template ["conditioning","power","recovery","strength"] / '
      + 'projection [... ,"speed", ...].',
    paidBy: 'the D13 session-template owner — the same move that put power in the '
      + 'one list, applied to the block it missed.',
    expiresWhen: 'a projected `speed` part appears in the session list.',
    redsIn: 'bounded',
  },

  {
    id: 'generated_conditioning_rows_have_no_authored_name',
    law: 'L-P2 SIGNED WORDS',
    matches: /rows on this day carry names the builder composed/,
    why: 'THE SUCCESSOR TO `projection_row_names_are_planner_text`, and it names the '
      + 'debt where the debt actually is. That entry said `project()` threw '
      + '`UnsignedCopyError` on row names from real generated weeks. Task 6 traced '
      + 'the whole population and it splits in two. HALF was authored and simply '
      + 'unregistered — every row the add menu places carries a name from '
      + '`coachRevisionTemplates.ts`, "the ONLY source of addable content ... '
      + 'template-derived, never free-form" — and that half is PAID: '
      + '`projectionCopy.ts` registers the set, derived from the registry\'s own '
      + 'emitter. The other half is not a registration gap at all: a generated '
      + 'conditioning row\'s name is COMPOSED by `sessionBuilder.ts` out of planner '
      + 'nouns and numbers ("Aerobic conditioning component (3 x 8min zone 2 Mixed '
      + 'Erg Block)", "Assault Bike warm-up", "Quality speed warm-up (short)") — '
      + 'defect 3 (`surfaceAgreementTests` cell 3) one layer down. Signing those '
      + 'would launder planner scratch into `SignedCopy`, which is the one thing '
      + 'this projection exists to make impossible, and the old entry said so '
      + 'itself: "the sheet cannot contain them and must not be made to". So '
      + '`project()` no longer carries a composed prescription row '
      + '(`isComposedPrescriptionRow`), and the gap is stated as what it is rather '
      + 'than as a throw — a throw being, now that the card and the detail both '
      + 'render from `project()`, a CRASH on his phone rather than a red in a '
      + 'harness. NOT a conditioning-only shape, which is why the predicate is the '
      + 'row\'s own type and not its bucket: the row that exposed it was a sprint '
      + 'micro-dose warm-up the keyword-tail classifier had put in `strengthRows`. '
      + 'Reproduce: bounded seed 4, 2 actions — answer onboarding (Pre-season), '
      + 'generate; also every combined or standalone conditioning day in every seed.',
    paidBy: 'the conditioning-generation owner — `data/conditioningTemplates.ts` is '
      + 'Sam\'s 55 signed doses and its own header says "NOT WIRED YET ... Stage B '
      + 'switches selection onto it". When a conditioning row is named by the '
      + 'authored template it came from, this projection can carry it. NOT a '
      + 'buttons/UI task.',
    expiresWhen: 'a generated conditioning row carries an authored name, so '
      + '`rowsForKind` can return conditioning rows without composing a word.',
    redsIn: 'both',
  },

  // ── L-P3 DETAIL: THREE ENTRIES, PAID IN FULL BY TASK 6, 2026-07-31 ───
  // `detail_has_no_row_surface_for_recovery_power_speed`,
  // `detail_shows_nothing_where_the_projection_has_work` and
  // `detail_swaps_conditioning_for_recovery` lived here. All three were one defect
  // seen three ways: the detail screen composed its own account of the day at
  // render (`composeDayDetail`), and that composition had a row surface for
  // strength, support and conditioning and NONE for recovery, power or speed — so
  // work vanished, an empty day rendered over real work, and on a day carrying
  // both, the added conditioning was folded inside the recovery template.
  //
  // DELETED, NOT SILENCED. What paid them is ownership, not three fixes:
  // `DayWorkoutScreenV2` renders `projectDayDetail(visibleDay)` — the projection's
  // own parts, every one of them, in order — and `useDayWorkout` composes nothing,
  // which `dayDetailCompositionOwnershipTests` pins by naming ONE production
  // caller. The survey (`WALKER_SURVEY=1`) records zero `L-P3 DETAIL = PROJECTION`
  // offences in either tier, and the stale-debt cell below would fail this file if
  // any of the three had been left carrying a debt that is paid.

  // ── L-P4: PAID IN FULL BY TASK 4, 2026-07-31 ────────────────────────────
  // Four entries lived here — two capability shapes and two move shapes, all on
  // `L-P4 MENU = PROJECTION`. They are DELETED, not silenced: the survey
  // (`WALKER_SURVEY=1`) now records zero L-P4 offences in either tier, and the
  // stale-debt cell below would fail this file if any of them were left behind.
  //
  // What paid them was ownership, not four fixes. `partCapabilities` learned the
  // three POSITIONS it was missing (a fixture owns its whole day; an appointment
  // does not travel or trade but can be dropped for one date; an add-on rides
  // with the day), and `listPlanChangeOptionsForDay` stopped deriving
  // `hasSession`/`canRemove`/"is anything movable" for itself and now renders the
  // projection's answers. The two shapes that named the MENU as wrong and the two
  // that named the PROJECTION as wrong all came from the same defect: two owners
  // answering one question.

  // `block_rollover_fails_silently_and_the_program_stops` — PAID 2026-08-01
  // by the block-rollover INTERIM unit (Sam's ruling, TOP of the post-merge
  // queue): the boundary now refuses TYPED instead of throwing, the ack owner
  // (`buildRolloverAcknowledgment`) produces the sentence, `useHomeScreen`
  // renders it with a retry instead of swallowing, and the clock door above
  // holds L6 to the ruling's exact terms — a refusal with no sentence, a raw
  // code in the sentence, or a THROW still reds. The Stage B end state (a
  // rolling ~two-block horizon derived on demand, no rollover event at all)
  // remains queued and is NOT this payment.
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
      // DEPTH IS TWO CLAIMS, NOT ONE. Days elapsed says the clock moved; it says
      // nothing about whether the athlete still has a life to act on. A walk that
      // spends its last fifty actions on a week that projects nothing is as much a
      // lie as one that never left week one — the other half of it. So the final
      // week must still project work somewhere.
      const live = quiet(() => projectParts({ week: projectedWeek(), weekStart }))
        .days.some((day) => day.parts.length > 0);
      const depth = `seed ${seed}: reached ${todayISO} — ${reached} days `
        + `(${(reached / 7).toFixed(1)} weeks) after install, final week `
        + `${live ? 'LIVE' : 'EMPTY'}`;
      if (reached < DEPTH_TIER.minWeeksAdvanced * 7) {
        shallow.push(`${depth} — needs ${DEPTH_TIER.minWeeksAdvanced * 7} days`);
      } else if (!live && !rolloverFailedThisWalk) {
        // Dead world with NO declared cause is a new red, not a known one.
        shallow.push(`${depth} — the walk reached its depth on a week that projects `
          + 'no parts at all, and no rollover failure explains it');
      } else {
        console.log(`      ${depth}${
          live ? '' : ' (explained by the declared L6 rollover red)'}`);
      }
    }
  }
  // REPORTED BEFORE THE ASSERTS, ALWAYS. A survey that only prints on a green run
  // is useless exactly when it is needed: the run that fails is the run whose
  // full offence population someone has to read to write the next declared red.
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
  assert(violations.length === 0,
    `the walker found law violations:\n${violations.join('\n')}`);
  assert(shallow.length === 0,
    'the DEEP tier did not reach the depth it declares — a shallow walk wearing a '
    + `deep label is what L13 forbids:\n    ${shallow.join('\n    ')}`);
});

run('every declared red still reds — stale debt fails, it does not expire quietly', () => {
  // THE RATCHET DIRECTION. A declared red that no longer happens is a cell that
  // went green, and the commit that turned it green owes the deletion of its
  // entry. Nothing here may outlive the defect it names.
  if (process.env.WALKER_HARVEST === '1') return;
  const requiredHere = (entry: DeclaredRed): boolean =>
    entry.redsIn === 'both' || entry.redsIn === (DEEP ? 'deep' : 'bounded');
  const owed = DECLARED_RED.filter((entry) =>
    requiredHere(entry) && !declaredRedHits.has(entry.id));
  assert(owed.length === 0,
    `declared red no longer reds in the ${TIER} tier — delete the entry, do not `
    + `leave it carrying debt that is already paid:\n    ${
      owed.map((entry) => `${entry.id} (${entry.law}, paid by ${entry.paidBy})`).join('\n    ')}`);
});

/**
 * The two schedule doors, driven through the REAL executor.
 *
 * L13: A DOOR THE WALKER CANNOT ACT THROUGH IS A DOOR THE HARNESS CANNOT
 * REGRESS. Sam's ruling 2 (2026-07-31) put "Short on time today" and "Away this
 * week?" on the week screen, so both are in the vocabulary above and both are
 * walked here.
 *
 * THROUGH `executeProgramControlActionDurably`, WITH THE ACTION THE HANDLER
 * BUILDS. The first draft of this cell reached the state by writing the accepted
 * context directly — which meant deleting the executor's whole
 * `set_schedule_modifier` branch would have kept it green. That is the harness
 * entering below the door, in a cell written about a door. It now sends the same
 * shape `useHomeScreen` sends, awaits it, and asserts what the athlete actually
 * gets.
 *
 * WHAT THE LAW IS WHILE DECLARED RED 1 STANDS. The door is REFUSED against a
 * real accepted base, so "it applies" is not assertable and pretending otherwise
 * would be the lie. What IS assertable, and is asserted: the refusal comes from
 * the fact transaction (a sentence only that layer writes — proving the branch
 * ran and built a fact), the athlete is told in the athlete's own words, and the
 * world is BYTE-UNCHANGED. That last one is L3 CONSERVATION, and it is the whole
 * law for a refusal.
 *
 * DRIVEN HERE RATHER THAN PROPOSED RANDOMLY, and that is a finding, not a
 * preference. Putting them in the random band (same bands, same draw count, five
 * doors instead of three) turns seed 6 red with an L1 crash inside generation —
 * `Section 18 final-week rejection (pattern_restore_failure |
 * planner_selected_target_miss | required_minimum_shortfall)` — whose shrunk
 * history is `[answer onboarding, generate the program]`, two actions that do
 * not crash when replayed on their own (seeds 5-6 pass, seeds 4-6 fail).
 * Something a walk leaves behind survives `freshInstall`, and until that is
 * found neither the crash nor the shrinker's minimal history can be trusted. Two
 * resets that WERE missing are fixed in `freshInstall` and do not account for
 * it. Recorded for the boundary report; not paid here, because a buttons unit
 * guessing at §18 generation state is how the next three defects get built.
 */
async function walkTheScheduleDoors(): Promise<void> {
  const worldFingerprint = (): string => {
    const state = useProgramStore.getState();
    return JSON.stringify({
      week: weekFingerprint(),
      facts: state.acceptedMaterialContext.temporarySourceFacts,
      constraints: state.acceptedMaterialContext.activeConstraints,
      revision: state.acceptedMaterialContext.revision,
      overrides: state.dateOverrides,
      overlays: state.weekScopedOverlays,
    });
  };

  // ── THE TAPE'S WORLD (device-export-2026-08-01) — the ack at DEPTH ──────
  //
  // Sam tapped "Short on time today" during the combined pass and got NOTHING
  // — not even the refusal sentence `readinessAcknowledgment.ts` builds for a
  // refused tap. The pass above walks this door three actions from install;
  // his device held a Pre-season profile, a marked Saturday game, and an
  // ACTIVE week-scoped busy_week fact ALREADY covering today (the tape's
  // `temporary-source-fact:v1:schedule:week:2026-07-27:busy_week`, the
  // legacy-migration shape) with its scoped-regen overlay authored. L13: the
  // bounded world proves the sentence is BUILT; only this world can prove the
  // tap still ANSWERS where Sam actually tapped it.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'mark_calendar', date: addDaysISO(weekStart, 5), mark: 'game' });
  // THE TAP'S OWN COORDINATE: Sam's marked game is dated the day he tapped —
  // "Short on time today" was tapped ON the fixture day (tape: markedDays
  // { 2026-08-01: game }, captured 2026-08-01). A today-scoped busy fact
  // landing on a fixture is a combination no bounded world reaches.
  performAction({ kind: 'advance_time', days: 5 });
  {
    // The pre-existing WEEK-scoped busy fact, published the way the
    // state-reacher publishes (the real creator, the real compatibility
    // composer) — the state a landed legacy-migrated fact leaves behind.
    const fact = createTemporaryScheduleFact({
      observedDate: todayISO,
      scope: scheduleFactScopeForAction({
        type: 'set_schedule_modifier',
        source: { screen: 'program_tab', surface: 'busy_this_week', initiatedBy: 'tap' },
        scope: 'current_week',
        payload: { date: todayISO, todayISO },
        requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
      } as never),
      scheduleKind: 'busy_week',
      unavailableDates: [],
      sourceActor: 'athlete',
      sourceSurface: 'busy_this_week',
    });
    const accepted = useProgramStore.getState().acceptedMaterialContext;
    const facts = [...accepted.temporarySourceFacts, fact];
    const compatibility = quiet(() => composeTemporarySourceFactCompatibility({
      temporarySourceFacts: facts,
      activeConstraints: accepted.activeConstraints,
      readinessSignalsByDate: accepted.readinessSignalsByDate,
    }));
    useProgramStore.setState({
      acceptedMaterialContext: {
        ...accepted,
        temporarySourceFacts: facts,
        activeConstraints: compatibility.activeConstraints,
        revision: accepted.revision + 1,
        lastTransaction: 'walker:tape_world_busy_week',
      },
    } as never);
  }

  const beforeTapeTap = worldFingerprint();
  let tapeResult: { ok?: boolean; message?: string | null };
  try {
    tapeResult = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_schedule_modifier',
      source: { screen: 'program_tab', surface: 'short_on_time_today', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: { date: todayISO, todayISO },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { visibleWeek: visibleWeek(), todayISO }));
  } catch (error) {
    throw new Error('L1 NO CRASH — the tape-world short-on-time tap THREW instead of '
      + 'answering (a rejected promise above this layer is exactly the silence Sam '
      + `saw): ${error instanceof Error ? error.message : String(error)}`);
  }

  const tapeAck = buildScheduleAcknowledgment(tapeResult, 'short_on_time');
  assert(tapeAck.message.trim().length > 0,
    'tape world: the tap is acknowledged with nothing');
  assert(tapeAck.tone === (tapeResult.ok ? 'success' : 'error'),
    'tape world: the acknowledgment disagrees with the result');
  assert(!RAW_CODE.test(tapeAck.message),
    `tape world: a raw code reached the athlete: "${tapeAck.message}"`);
  if (!tapeResult.ok) {
    assert(worldFingerprint() === beforeTapeTap,
      'tape world: a refused tap changed the world anyway');
  }

  for (const door of ['short_on_time_today', 'away_this_week'] as const) {
    freshInstall();
    performAction({ kind: 'answer_onboarding', profile: profileFor(makeRng(11)) });
    performAction({ kind: 'generate_program' });
    fingerprintBefore = weekFingerprint();

    const occupied = visibleWeek().filter((day) => day.date >= todayISO && day.workout);
    assert(occupied.length > 0, `${door}: no occupied day — this cell would be vacuous`);

    // THE ACTION `useHomeScreen` BUILDS, field for field. Its scope is pinned at
    // the handler by `programControlDurableOwnershipTests`; what is pinned here
    // is that the executor answers this shape honestly.
    const action = door === 'away_this_week'
      ? {
          type: 'set_schedule_modifier',
          source: { screen: 'program_tab', surface: 'away_this_week', initiatedBy: 'tap' },
          scope: 'current_week',
          payload: {
            date: occupied[0].date,
            todayISO,
            planChange: { kind: 'clear_days', dates: [occupied[0].date] },
          },
          requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
        }
      : {
          type: 'set_schedule_modifier',
          source: { screen: 'program_tab', surface: 'short_on_time_today', initiatedBy: 'tap' },
          scope: 'today_only',
          payload: { date: todayISO, todayISO },
          requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
        };

    const before = worldFingerprint();
    let result: { ok?: boolean; message?: string | null };
    try {
      result = await quietAsync(() => executeProgramControlActionDurably(
        action as never, { visibleWeek: visibleWeek(), todayISO },
      ));
    } catch (error) {
      throw new Error(`L1 NO CRASH — ${door} threw instead of answering: ${
        error instanceof Error ? error.message : String(error)}`);
    }

    // L2 HONEST OUTCOME, at the layer the athlete reads.
    const ack = buildScheduleAcknowledgment(
      result, door === 'away_this_week' ? 'away' : 'short_on_time',
    );
    assert(ack.message.trim().length > 0, `${door}: the tap is acknowledged with nothing`);
    assert(ack.tone === (result.ok ? 'success' : 'error'),
      `${door}: the acknowledgment disagrees with the result`);
    assert(!RAW_CODE.test(ack.message), `${door}: a raw code reached the athlete: "${ack.message}"`);

    if (result.ok) {
      // DECLARED RED 1 IS PAID. Do not let this cell go quietly green on a door
      // that has started working — the laws it should now assert are different.
      throw new Error(
        `${door} now COMMITS. Declared red 1 in programControlDurableOwnershipTests `
        + 'is paid: rewrite this cell to assert what the door DOES (today lightens / '
        + 'the away days clear) instead of that it refuses conservatively.');
    }

    // The refusal came from the fact transaction, not from the synchronous core's
    // "this type needs the durable path" — which is what a deleted executor
    // branch would answer, also with ok:false.
    assert(result.message === ENGINE_REFUSAL_SENTENCE,
      `${door}: the refusal no longer comes from the fact transaction — "${result.message}". `
      + 'If the executor branch was deleted, this is the cell that says so.');

    // L3 CONSERVATION — the whole law for a refusal, asserted byte for byte.
    assert(worldFingerprint() === before,
      `${door}: a refused tap changed the world anyway`);

    // And every other law still holds over the untouched week.
    for (const broken of checkInvariants({ action: { kind: 'clear_source_facts' }, outcome: null, message: null, threw: null })) {
      if (declaredRedFor(broken.law, broken.detail)) continue;
      throw new Error(`${broken.law} after ${door} — ${broken.detail}`);
    }
  }

}

run('freshInstall is total — the two resets it was missing are covered', () => {
  // THE RESETS ADDED ON 2026-07-31 HAVE A CELL, because a reset nothing checks
  // is a reset the next tidy-up deletes. Both stores are read by generation
  // (`getAthletePrefs()`) and by the projection (modality preferences), so a
  // walk that leaves either dirty hands the next walk a different athlete.
  freshInstall();
  // Acted through the real preference doors, not seeded — a state reached by
  // acting is the only kind freshInstall owes a reset for.
  useAthletePreferencesStore.getState().addExclusion('Back Squat');
  useAthletePreferencesStore.getState().addPinned('Bicep Curl (Barbell)');
  useCoachPreferencesStore.setState({
    modalityPreferences: { 'Easy Zone 2 Bike': { from: 'bike', to: 'row' } },
  } as never);
  const clarifierStore = require('../store/pendingCoachClarifierStore').usePendingCoachClarifierStore;
  const contextStore = require('../store/coachContextStateStore').useCoachContextStateStore;
  clarifierStore.setState({ pending: { probe: true } } as never);
  freshInstall();
  const prefs = useAthletePreferencesStore.getState().prefs;
  assert(prefs.excluded.length === 0 && prefs.pinned.length === 0,
    `freshInstall left athlete pool prefs behind: ${JSON.stringify(prefs)}`);
  assert(Object.keys(useCoachPreferencesStore.getState().modalityPreferences ?? {}).length === 0,
    'freshInstall left coach modality preferences behind');
  // Unit 6: the LR-23 in-memory stores are part of TOTAL now, and the check is
  // what keeps their reset lines alive.
  assert(clarifierStore.getState().pending == null,
    'freshInstall left a pending coach clarifier behind');
  assert(contextStore.getState() != null,
    'coach context store unreadable after freshInstall');
});

run('the calendar door refuses the wipe against a walked world', () => {
  // THE STORE-ARMOUR REPLAY (docs/STORE_ARMOUR_RECIPE_2026-08-03.md §6): the
  // state under attack is REACHED BY ACTING through host.perform — onboard,
  // generate, two calendar marks, a week of time — never seeded. Depth stated
  // per L13: this is a SHALLOW-TIER cell (5 actions, one week crossed); the
  // deep tier's block-crossing walks exercise the same door on every mark.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'mark_calendar', date: addDaysISO(weekStart, 5), mark: 'game' });
  performAction({ kind: 'mark_calendar', date: addDaysISO(weekStart, 2), mark: 'rest' });
  performAction({ kind: 'advance_time', days: 7 });
  const marksBefore = JSON.stringify(useCalendarStore.getState().markedDays);
  assert(Object.keys(useCalendarStore.getState().markedDays).length >= 2,
    'precondition: the walk must leave marks to protect');
  // COUNT, not index-slice: a walked world has flooded the 200-entry ring to
  // its cap, where append+trim keeps the length constant and an index taken
  // "before" points past every later entry.
  const refusalsOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'calendar_write' && entry.outcome === 'refused').length;
  const refusalsBefore = refusalsOnTape();

  const outcome = applyCalendarMarkedDaysWrite({ next: {}, writer: 'accepted_transaction' });

  assert(!outcome.ok && outcome.reason === 'default_over_answered_marks',
    `the wipe shape was not refused against a walked world: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCalendarStore.getState().markedDays) === marksBefore,
    'the refused wipe changed the walked marks anyway');
  assert(refusalsOnTape() === refusalsBefore + 1,
    'the refusal left no witness on the tape');
});

run('the prefs door refuses the wipe against a walked world', () => {
  // Same replay for athletePreferencesStore. The walk reaches the world; the
  // prefs are then ACTED through the store's real doors (the walker's own
  // vocabulary has no preference action yet — a declared gap, recorded in the
  // unit's boundary report, not hidden). Shallow tier, depth stated.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'advance_time', days: 3 });
  useAthletePreferencesStore.getState().addExclusion('Back Squat');
  useAthletePreferencesStore.getState().addActiveInjury('hamstring');
  const prefsBefore = JSON.stringify(useAthletePreferencesStore.getState().prefs);
  // COUNT, not index-slice — the walked ring is at cap (see the calendar cell).
  const refusalsOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'athlete_prefs_write' && entry.outcome === 'refused').length;
  const refusalsBefore = refusalsOnTape();

  const outcome = applyAthletePrefsWrite({
    next: INITIAL_ATHLETE_PREFS,
    writer: 'preference_control',
  });

  assert(!outcome.ok && outcome.reason === 'default_over_answered_prefs',
    `the wipe shape was not refused against a walked world: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useAthletePreferencesStore.getState().prefs) === prefsBefore,
    'the refused wipe changed the walked prefs anyway');
  assert(refusalsOnTape() === refusalsBefore + 1,
    'the refusal left no witness on the tape');
});

run('the readiness door refuses the wipe against a walked world', () => {
  // THE STORE-ARMOUR REPLAY, application 3 (docs/STORE_ARMOUR_RECIPE_
  // 2026-08-03.md §6): the state under attack is REACHED through
  // host.perform — onboard, generate, declare a readiness fact, cross days.
  // The walker's `declare_source_fact` is itself a declared state-reacher
  // (a direct signal write standing in for the executor until declared red 1
  // is paid), so the signal is real-shaped but not executor-committed — that
  // gap is the vocabulary's, recorded here, not hidden. Depth stated per
  // L13: SHALLOW tier (4 actions, 3 days crossed); the deep tier's walks
  // exercise the same door on every accepted publish.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'declare_source_fact', date: todayISO, fact: 'poor_sleep' });
  performAction({ kind: 'advance_time', days: 3 });
  const signalsBefore = JSON.stringify(useReadinessStore.getState().signalsByDate);
  assert(Object.keys(useReadinessStore.getState().signalsByDate).length >= 1,
    'precondition: the walk must leave a signal to protect');
  // COUNT, not index-slice — the walked ring is at cap (see the calendar cell).
  const refusalsOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'readiness_write' && entry.outcome === 'refused').length;
  const refusalsBefore = refusalsOnTape();

  const outcome = applyReadinessSignalsWrite({ next: {}, writer: 'accepted_transaction' });

  assert(!outcome.ok && outcome.reason === 'default_over_answered_signals',
    `the wipe shape was not refused against a walked world: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useReadinessStore.getState().signalsByDate) === signalsBefore,
    'the refused wipe changed the walked signals anyway');
  assert(refusalsOnTape() === refusalsBefore + 1,
    'the refusal left no witness on the tape');
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

// ── THE DEVICE-PASS RED CELLS (2026-08-01) — the tape's world, by acting ──
//
// Sam's combined pass failed three cells in one class (projection naming
// lagging the charter). Each cell below reaches the failing world through the
// real doors — never a seed — and asserts the SIGNED word. They are the
// pre-producer reds for laws L-P5/L-P6 above: the laws read typed fields the
// producers do not ship yet, so without these cells the laws could be
// satisfied by never shipping the field.

/** Sam's tape profile shape, deterministic: Pre-season, no usual game day. */
function tapeWorldProfile(overrides?: Partial<Record<string, unknown>>): OnboardingData {
  const profile = {
    ...profileFor(makeRng(11)),
    seasonPhase: 'Pre-season',
    ...overrides,
  } as Record<string, unknown>;
  delete profile.usualGameDay;
  delete profile.gameDay;
  return profile as unknown as OnboardingData;
}

run('a walked pre-season fixture reads "Practice Match" (device-pass fail 1)', () => {
  // The tape: Pre-season profile, markedDays { <Saturday>: 'game' }. Sam's
  // Saturday card read "Game Day" — ruling 6-IV-4 signed "Practice Match", and
  // the engine's own typed predicate (Pre-season + fixture = practice match)
  // has known it since Batch 5. The producer owes the label its typed variant.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  const saturday = addDaysISO(weekStart, 5);
  performAction({ kind: 'mark_calendar', date: saturday, mark: 'game' });
  const week = quiet(() => project({ week: projectedWeek(), weekStart }));
  const day = week.days.find((candidate) => candidate.date === saturday);
  assert(day, 'the marked Saturday is not in the projected week');
  assert(day.kind === 'game', `the marked Saturday resolved kind "${day.kind}", not a fixture`);
  assert(String(day.headline) === 'Practice Match',
    `the tape's world (Pre-season profile, marked Saturday game) reads `
    + `"${String(day.headline)}" on the card — Sam signed "Practice Match" (6-IV-4) `
    + 'and failed the combined pass on this day');
});

run('a door-added charter session names itself (device-pass fail 2)', () => {
  // Sam added Accessories through the five-row menu and the day read
  // "Strength + Midline Work"; his Gunshow read "Strength". The charter types
  // carry their own signed words; the generic strength word is the
  // honest-generic fallback the athlete must never see over a NAMED door's
  // session. Mobility is the same defect wearing the deleted type's word: an
  // added Mobility session renders "Recovery" today.
  const cases = [
    { category: 'gunshow', word: 'Gunshow' },
    { category: 'prehab', word: 'Accessories' },
    { category: 'mobility', word: 'Mobility' },
  ] as const;
  const offences: string[] = [];
  for (const { category, word } of cases) {
    freshInstall();
    performAction({
      kind: 'answer_onboarding',
      profile: tapeWorldProfile({ seasonPhase: 'In-season' }),
    });
    performAction({ kind: 'generate_program' });
    const target = addDaysISO(weekStart, 5);
    const result = performAction({
      kind: 'plan_change',
      change: { kind: 'add_category', category, date: target } as PlanChange,
    });
    assert(result.outcome === 'applied',
      `${category}: the add door refused (${result.outcome}${
        result.message ? ` — ${result.message}` : ''}) — this cell needs the add to land`);
    const week = quiet(() => project({ week: projectedWeek(), weekStart }));
    const day = week.days.find((candidate) => candidate.date === target);
    assert(day, `${category}: the target day vanished from the projection`);
    const words = day.parts.map((part) => String(part.headline));
    // ONE WORD (Sam's 7-e ruling, 2026-08-01, signed with Batch 7): the
    // door's name ALONE — an added Accessories session must never read
    // "Accessories + Midline Work"; its rows are contents, not card
    // vocabulary. Exact equality, not includes: a second part word is the
    // defect the ruling retires.
    if (JSON.stringify(words) !== JSON.stringify([word])) {
      offences.push(`${category}: renders ${JSON.stringify(words)} — ruling 7-e says `
        + `exactly ["${word}"]`);
    }
  }
  assert(offences.length === 0,
    `charter sessions do not read their door's name alone (ruling 7-e):\n    ${
      offences.join('\n    ')}`);
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

// THE ASYNC TAIL. Every cell above is synchronous and has already run by the
// time this executes; the schedule doors are awaited, so they run here and the
// totals wait for them. Printing the totals before an outstanding cell finished
// would be a suite reporting on work it had not done.
void (async () => {
  if (process.env.WALKER_ORDER_PROBE) {
    await runOrderProbe(process.env.WALKER_ORDER_PROBE);
    console.log('\n[order probe] done — diff the [probe N:i] lines between runs');
    // NO process.exit here — Node DISCARDS buffered stdout on exit when piped,
    // which made longer probe runs read as empty and the first sweep report
    // false divergence on every seed. The instrument must be able to observe:
    // let the event loop drain and the process end itself.
    return;
  }
  await runAsync('the two schedule doors are walkable through the REAL door, and the laws hold',
    walkTheScheduleDoors);

  console.log(`\nAction walker totals: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
})();
