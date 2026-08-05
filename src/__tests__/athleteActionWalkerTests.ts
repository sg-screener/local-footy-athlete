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


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { flushPendingStorageWrites, pendingStorageWriteCount } from '../store/asyncStorageCompat';
import { seedManualOverride } from './support/programOverrideHarness';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { OnboardingData, TrainingProgram } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { PlanChange } from '../utils/planChangeTypes';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore, applyProgramOverrideSliceWrite } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore, applyCalendarMarkedDaysWrite } from '../store/calendarStore';
import { athleteActionLogEntries } from '../utils/athleteActionLog';
import { useReadinessStore, applyReadinessSignalsWrite } from '../store/readinessStore';
import { useCoachUpdatesStore, applyCoachUpdatesWrite } from '../store/coachUpdatesStore';
import {
  useCoachMutationHistoryStore,
  applyCoachMutationHistoryWrite,
} from '../store/coachMutationHistoryStore';
import {
  useAthletePreferencesStore,
  applyAthletePrefsWrite,
  INITIAL_ATHLETE_PREFS,
} from '../store/athletePreferencesStore';
import {
  useCoachPreferencesStore,
  applyCoachModalityPrefsWrite,
} from '../store/coachPreferencesStore';
import { useCoachStore, applyCoachStoreWrite } from '../store/coachStore';
import { useCoachMemoryStore, applyCoachMemoryWrite } from '../store/coachMemoryStore';
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
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import {
  sessionTemplateKinds as sessionTemplateKindsOwned,
  projectionContentKinds,
  templateProjectionDisagreement,
  templateProjectionOffence,
  rowCompositionCoordinate,
} from './support/sessionListKinds';
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
  // A FRESH INSTALL IS TOTAL OR IT IS NOT A FRESH INSTALL.
  //
  // The store list moved to `./support/freshInstallStores` on 2026-08-04 when a
  // second suite needed the same reset — see that module's header for the full
  // reasoning, including the 2026-07-31 walk whose shrunk history was a lie
  // because preference state survived. The totality cell below still CHECKS
  // this, so a door left open by the shared owner reds here.
  resetStoresToFreshInstall('walker:fresh-install');
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

// (The store-layer refusal sentence used to be pinned here to prove the real
// branch refused; the schedule doors COMMIT since the 2026-08-03 lanes, so the
// cells now pin what each door DOES instead.)

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
//
// AND THE CHOOSE DOOR CAME BACK ON 2026-08-05 (docs/DISPLAY_TIMES_RULING §1,
// after device-pass finding 3): the charter still forbids the app PLACING
// recovery uninvited — both halves above stand — but the ATHLETE choosing one
// is the chartered grant the menu had lost ("you can always add a recovery or
// mobility flow to any day as optional"). `PlanChangeSheet` now renders the
// recovery row from `planChangeTypeMenu`, so there IS a door, and the walker
// walks it like any other category.
const CATEGORIES = ['conditioning_light', 'conditioning_hard', 'strength_upper',
  'strength_lower', 'strength_full', 'gunshow', 'prehab', 'mobility',
  'recovery'] as const;
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
          applyOverride: (date, workout, context) =>
            seedManualOverride(date, workout, context),
        }));
        return { ...base, outcome: direct.outcome, message: direct.message };
      }
      wrapperRoutedChanges += 1;
      const result = quiet(() => executeProgramControlAction(screenAction, {
        visibleWeek: visibleWeek(),
        todayISO,
        applyOverride: (date, workout, context) =>
          seedManualOverride(date, workout, context),
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
    // because `perform` is synchronous and the executor is awaited.
    //
    // They use the real creator and the real scope owner
    // (`scheduleFactScopeForAction`) and the real compatibility composer, so the
    // state is the state, not a hand-drawn version of it. `declare_source_fact`
    // above sets the same precedent for the readiness store.
    //
    // 2026-08-03, the paid lanes: these reachers mint the UNRULED record-only
    // shapes (busy_week / travel), which since the approved lanes is exactly
    // the state a landed inert commit leaves behind — fact + constraint, no
    // program change — so the stand-in is now faithful by construction. The
    // RULED short-on-time state (time-cap fact + scoped-regen overlay) cannot
    // be minted synchronously without hand-drawing the overlay, so the real
    // door is walked in `walkTheScheduleDoors`, end to end, instead.
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
  // doors' gate home is the deterministic `walkTheScheduleDoors` cell.
  // (Declared red 1 paid 2026-08-03; promoting these reachers into the random
  // band is a separate walker-vocabulary decision, recorded NOT-COVERED in the
  // day log rather than smuggled in with the lanes.)
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
      const disagreement = templateProjectionDisagreement(
        sessionTemplateKinds(mirror.workout),
        projectionContentKinds(visibleDay.parts),
      );
      if (disagreement) {
        // WALKER_LOG_LP3=1 — the row-level coordinate of every template =
        // projection disagreement, printed BEFORE the offence is filtered
        // against the declared reds. This is stage 2 priority A's instrument:
        // the declared combination red's coordinates (day type × domains) do
        // not characterise it, and this seam is how its TRUE coordinates (row
        // roles carried, conditioning wiring) get measured rather than
        // inferred. Env-gated, inert on green runs and on unflagged red runs.
        if (process.env.WALKER_LOG_LP3 === '1') {
          const workoutRows = (mirror.workout as { exercises?: unknown[] } | null)?.exercises ?? [];
          const rowLines = (workoutRows as Array<{
            exercise?: { name?: unknown }; name?: unknown; role?: unknown;
          }>).map((row) => {
            const name = String(row?.exercise?.name ?? row?.name ?? '').trim();
            return `        row "${name}" authoredRole=${
              row?.role === undefined ? 'NONE' : JSON.stringify(row.role)}`;
          });
          console.log(`      [lp3] ${day.date} ${rowCompositionCoordinate(mirror.workout)}\n`
            + `        workoutType=${JSON.stringify((mirror.workout as {
              workoutType?: unknown } | null)?.workoutType)} template=${
              JSON.stringify(disagreement.templateKinds)} projection=${
              JSON.stringify(disagreement.contentKinds)}\n${rowLines.join('\n')}`);
        }
        offend('L-P3 TEMPLATE = PROJECTION',
          templateProjectionOffence(day.date, disagreement));
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
/**
 * The kind mapping and the offence format moved to
 * `./support/sessionListKinds` on 2026-08-04, when the day-type × domains
 * matrix became a second consumer. The DECLARED_RED regexes below match the
 * offence string that module now owns.
 */
function sessionTemplateKinds(workout: unknown): string[] {
  return quiet(() => sessionTemplateKindsOwned(workout));
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
  // `session_list_calls_a_conditioning_day_recovery` — ENTRY DELETED
  // 2026-08-05, MOVED NOT PAID. The defect is OPEN: `buildSessionTemplate`
  // still short-circuits to `mode: "recovery"` on `isRecoveryWorkout`
  // (sessionTemplate.ts:248) while `getSessionComponents` can answer
  // conditioning for the same workout — the athlete shown a recovery day
  // over conditioning work. What changed is REACH, not the defect: adding
  // 'recovery' to CATEGORIES (the 2026-08-05 choose-door ruling) shifted
  // every seeded path, and neither tier now deterministically builds the
  // tier/content-divergence coordinate (suspected: a G+1 derived-recovery
  // replacement keeping attached conditioning — the athlete-door recovery
  // add was probed and does NOT diverge: template and components both say
  // recovery). Deletion is what the stale-debt cell demands of a VALID run
  // (unlike the 2026-08-01 restore, no undeclared reds truncated these
  // walks). Owner unchanged: the D13 session-template owner, with
  // `sessionComponents` — the answer should come from the PARTS. Recorded in
  // docs/RECOVERY_CHOOSE_DOOR_REPORT_2026-08-05.md.
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

  // ── THE FIFTH SHAPE IS A COMBINATION, AND THAT IS THE POINT (2026-08-04) ──
  //
  // The four entries above each pin ONE shape. This one pins a day that
  // exhibits TWO AT ONCE, which is why it matched none of them: the offence
  // string names the whole disagreement per day, so a day dropping
  // conditioning AND badging support produces a string no single-shape regex
  // can match. That is a gap in how this list is written, not only a gap in
  // the classifiers — a combination is reachable long before anyone declares
  // it, and the walker found this one the first time a re-add put strength
  // onto a team night already carrying conditioning.
  //
  // The matrix that enumerates this coordinate space is
  // `sessionListCombinationMatrixTests` (day type × domains carried), added
  // with this entry. L11's rule is the reason both exist: the moment two
  // defects differ only by their combination coordinates, the space needs
  // enumerating rather than another single fix.
  {
    id: 'session_list_drops_a_team_night_stack_and_badges_support',
    law: 'L-P3 TEMPLATE = PROJECTION',
    matches: /omits \["conditioning","strength"\] and invents \["support"\]/,
    why: 'A TEAM NIGHT CARRYING BOTH GYM DOMAINS RENDERS AS NEITHER. The '
      + 'projection carries `conditioning`, `strength` and `team_training`; the '
      + 'session list shows `support` and `team_training` — so the athlete opens '
      + 'a day holding a conditioning piece and a strength piece and reads '
      + 'neither, plus a badge for work the projection has no part for. '
      + 'MEASURED 2026-08-05 (stage 2 priority A, `WALKER_LOG_LP3=1`): the '
      + 'failing day is `roles=[midline] buckets=[conditioning,strength] '
      + 'cond=block_no_flag` — rows ["Dragon Flag" (no authored role), '
      + '"Erg EMOM - 10-15 cal"], workoutType "Team Training". Two mechanisms, '
      + 'one day, and each is an entry already on this list: (1) the '
      + 'conditioning is wired `conditioningBlock`-without-'
      + '`hasCombinedConditioning` — the shape `stackTemplate` builds when a '
      + 'session stacks onto a team anchor with no strength owner '
      + '(`canonicalPlanChangeCandidateMaterializer.ts:198`) — and the template '
      + 'emits conditioning off the FLAG (`sessionTemplate.ts:257`) while the '
      + 'component owner reads the BLOCK ids, so the list drops it '
      + '(`session_list_drops_conditioning_attached_to_an_appointment`). '
      + '(2) with conditioning present the sole trunk row is not sole content '
      + '(`sessionComponents.ts:658`), so it buckets `strength` for the '
      + 'projection while the template\'s name classifier badges it `midline` → '
      + '`support` (`session_list_badges_a_midline_row_the_projection_has_no_'
      + 'part_for`) — and being the ONLY gym row, `strength` vanishes from the '
      + 'template entirely. The defect is PRE-EXISTING composition code on both '
      + 'sides; stage 1 Task A only made the world reachable. The combination '
      + 'matrix carries this as its one blind spot with the same composition '
      + 'string, held by its cells [5] and [6]. DEEP ONLY: the composition '
      + 'needs a worn world (bye-week work-capacity stacked onto a team night '
      + 'whose gym half is down to one trunk row). Reproduce: deep, step 63, '
      + '2026-08-19 — template ["support","team_training"] / projection '
      + '["conditioning","strength","team_training"]; `WALKER_LOG_LP3=1` prints '
      + 'the row-level coordinate.',
    paidBy: 'the D13 session-template owner with `sessionComponents` — the same '
      + 'two owners named by the two entries this decomposes into. Paying '
      + 'either one alone does NOT retire this entry, which is what makes it '
      + 'worth declaring separately rather than widening either regex.',
    expiresWhen: 'a day carrying team training plus both gym domains lists both '
      + 'of them, and badges nothing the projection has no part for.',
    redsIn: 'deep',
  },

  // RETIRED 2026-08-05 — `generated_conditioning_rows_have_no_authored_name`.
  //
  // Its own `expiresWhen` was "a generated conditioning row carries an authored
  // name, so `rowsForKind` can return conditioning rows without composing a
  // word", and its `paidBy` named the owner: "`data/conditioningTemplates.ts`
  // is Sam's 55 signed doses ... Stage B switches selection onto it". Stage B
  // did (`149cc4d`): the headline row carries the authored template name and
  // the warm-up carries Sam's signed sentence (ruling 4,
  // docs/SWITCHOVER_PARKED_RULINGS_2026-08-05.md). Both are marked
  // `nameProvenance: 'authored'` by the emitter, so `project()` carries them
  // and the offence no longer reproduces. Deleted rather than left to rot —
  // the ratchet cell below fails a declared red that has stopped reding.

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
  const tapeWeekBefore = weekFingerprint();
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
  // SAM'S §7 ANSWER LANDED (2026-08-03), and §10 gave it its second signed
  // variant the same day. THIS WORLD IS SAM'S REAL EXPORT — PRE-SEASON — so
  // its card reads "Practice Match" (6-IV-4) and the fixture's own kind
  // selects "It's a practice match — nothing to shorten. Go play." The
  // in-season MARKED counterpart (game-day wording) is pinned in
  // `programControlDurableOwnershipTests`, so both variants stay covered.
  // This coordinate — the tap ON
  // the fixture day, the exact tap from his 2026-08-01 tape — no longer rides
  // the pre-existing §18 refusal family: the lane owner is date-aware through
  // the fixture owner, so a time-cap fact whose every target date is a
  // fixture day commits INERT. The laws this cell now owns: the tap COMMITS
  // (a refusal here is the retired behaviour back), the fact records with the
  // typed WHY, the program bytes do not move, the anchor survives, and the
  // athlete hears the signed sentence — selected by the committed result.
  assert(tapeResult.ok === true,
    `tape world: the fixture-day tap is refused again ("${tapeResult.message}") — `
    + 'the §7 inert lane regressed');
  assert((tapeResult as { inertReason?: string }).inertReason === 'fixture_day',
    'tape world: the committed result does not carry the typed fixture-day reason');
  assert(weekFingerprint() === tapeWeekBefore,
    'tape world: a nothing-to-shorten commit changed the visible week');
  const tapeGameDay = visibleWeek().find((day) => day.date === todayISO);
  assert(tapeGameDay?.workout,
    'tape world: the commit removed the fixture-day session — the anchor law broke');
  assert(useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts
    .some((fact) => 'factKind' in fact && fact.factKind === 'time_cap'),
    'tape world: the fixture-day fact did not record — the coach lost the context');
  assert((tapeResult as { inertFixtureVariant?: string }).inertFixtureVariant === 'practice_match',
    'tape world: the fixture kind did not travel with the committed result — the '
    + "sentence would be picked by something other than the card label's owner");
  assert(tapeAck.message === "It's a practice match — nothing to shorten. Go play.",
    `tape world: the athlete does not hear the signed sentence for THIS fixture's `
    + `kind — got "${tapeAck.message}"`);
  void beforeTapeTap;

  for (const door of ['short_on_time_today', 'away_this_week'] as const) {
    freshInstall();
    performAction({ kind: 'answer_onboarding', profile: profileFor(makeRng(11)) });
    performAction({ kind: 'generate_program' });
    // The short-on-time cell asserts TODAY's compression, so today must hold a
    // session — walk the clock forward (a real athlete action) until it does.
    if (door === 'short_on_time_today') {
      for (let hop = 0; hop < 10; hop += 1) {
        if (visibleWeek().find((day) => day.date === todayISO)?.workout) break;
        performAction({ kind: 'advance_time', days: 1 });
      }
      assert(visibleWeek().find((day) => day.date === todayISO)?.workout,
        `${door}: no occupied today within ten days — this cell would be vacuous`);
    }
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

    // DECLARED RED 1 IS PAID (2026-08-03): the doors COMMIT through the real
    // executor, each on its ruled lane (approved reassessment, option 2).
    assert(result.ok === true,
      `${door}: the door is refused again ("${result.message}") — the paid lanes `
      + 'regressed to the dead third lane');

    if (door === 'away_this_week') {
      // UNRULED → RECORD-ONLY, HONEST. The fact and constraint land; the
      // program bytes do not move; no overlay, no adjustment.
      assert(weekFingerprint() === fingerprintBefore,
        `${door}: a record-only away fact changed the visible week`);
      const accepted = useProgramStore.getState().acceptedMaterialContext;
      assert(accepted.temporarySourceFacts.some((fact) =>
        'factKind' in fact && fact.factKind === 'schedule'),
        `${door}: the away fact did not land in the accepted context`);
      assert(Object.keys(useProgramStore.getState().weekScopedOverlays ?? {}).length === 0,
        `${door}: a record-only fact authored a week overlay`);
    } else {
      // RULED → DERIVING. Today's session is compressed under the 35-minute
      // owner (Sam 2026-08-02: main lift kept, cut to essentials); the other
      // days of the week are untouched; the adjustment is fact-linked.
      const today = visibleWeek().find((day) => day.date === todayISO);
      assert(today?.workout, `${door}: the compressed today lost its session entirely`);
      assert((today.workout.durationMinutes ?? 0) <= 35,
        `${door}: today still runs ${today.workout.durationMinutes} minutes over the cap`);
      assert(useProgramStore.getState().reversibleAdjustmentLedger.adjustments.some(
        (adjustment) => adjustment.kind === 'deriving_source_fact' &&
          adjustment.status === 'active'),
        `${door}: the deriving commit minted no fact-linked adjustment`);
    }

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
  useCoachPreferencesStore.getState().setModalityPreference('Easy Zone 2 Bike', {
    from: 'bike',
    to: 'row',
  });
  const clarifierStore = require('../store/pendingCoachClarifierStore').usePendingCoachClarifierStore;
  const contextStore = require('../store/coachContextStateStore').useCoachContextStateStore;
  clarifierStore.setState({ pending: { probe: true } } as never);
  // The wave-2a stores, acted through their own doors so the reset lines in
  // freshInstall cannot be deleted unnoticed.
  useCoachStore.getState().addMessage({
    id: 'totality-m1', conversationId: 'totality-conv', role: 'user',
    content: 'leftover chat the next walk must never see',
    createdAt: new Date().toISOString(),
  });
  useCoachMemoryStore.getState().addNote('leftover note the next walk must never see');
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
  assert(useCoachStore.getState().messages.length === 0
    && useCoachStore.getState().conversations.length === 0,
    'freshInstall left coach chat history behind');
  assert(useCoachMemoryStore.getState().notes.length === 0,
    'freshInstall left coach memory notes behind');
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

run('the coach prefs door refuses the wipe against a walked world', () => {
  // THE STORE-ARMOUR REPLAY, fleet phase (docs/STORE_ARMOUR_RECIPE_2026-08-03
  // §6). The world is reached by acting through host.perform; the preference
  // is then ACTED through the store's own action — the walker's vocabulary has
  // NO coach-door action, and under the LR-6 standing STOP this unit may not
  // add one (a coach action changes what the walk exercises in the coach
  // pipeline). That gap is DECLARED here, not hidden: when LR-6 lifts, the
  // vocabulary gains the coach doors and this cell's act-in line becomes a
  // walked action. Shallow tier, depth stated per L13: 3 actions, 3 days.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'advance_time', days: 3 });
  useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', {
    from: 'row',
    to: 'bike',
  });
  const prefsBefore = JSON.stringify(useCoachPreferencesStore.getState().modalityPreferences);
  assert(Object.keys(useCoachPreferencesStore.getState().modalityPreferences).length >= 1,
    'precondition: the acted-in preference must exist to protect');
  // COUNT, not index-slice — the walked ring is at cap (see the calendar cell).
  const refusalsOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'coach_prefs_write' && entry.outcome === 'refused').length;
  const refusalsBefore = refusalsOnTape();

  const outcome = applyCoachModalityPrefsWrite({ next: {}, writer: 'coach_pipeline' });

  assert(!outcome.ok && outcome.reason === 'default_over_answered_preferences',
    `the wipe shape was not refused against a walked world: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCoachPreferencesStore.getState().modalityPreferences) === prefsBefore,
    'the refused wipe changed the walked preferences anyway');
  assert(refusalsOnTape() === refusalsBefore + 1,
    'the refusal left no witness on the tape');
});

run('the mutation history door refuses the wipe against a walked world', () => {
  // Same replay for coachMutationHistoryStore — the record AGENTS.md requires
  // for follow-up target resolution. The entry is ACTED through the store's
  // own `recordMutation` action for the same declared reason as above: the
  // walker has no coach vocabulary, and LR-6 forbids adding one in this unit.
  // Shallow tier, depth stated per L13: 3 actions, 3 days.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'advance_time', days: 3 });
  useCoachMutationHistoryStore.getState().recordMutation({
    operation: 'swap_conditioning_modality_once',
    mutationKind: 'modality_swap_once',
    userMessage: 'swap my Tuesday row for a bike',
    appliedReply: 'Done — Tuesday is on the bike this week.',
    affectedDates: [addDaysISO(weekStart, 1)],
    scope: 'one_off',
    revertPlan: { kind: 'restore_snapshot', dateOverrides: [] },
  });
  const entriesBefore = JSON.stringify(useCoachMutationHistoryStore.getState().entries);
  assert(useCoachMutationHistoryStore.getState().entries.length >= 1,
    'precondition: the acted-in history entry must exist to protect');
  // COUNT, not index-slice — the walked ring is at cap (see the calendar cell).
  const refusalsOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'coach_mutation_history_write'
      && entry.outcome === 'refused').length;
  const refusalsBefore = refusalsOnTape();

  const outcome = applyCoachMutationHistoryWrite({ next: [], writer: 'undo_engine' });

  assert(!outcome.ok && outcome.reason === 'default_over_answered_history',
    `the wipe shape was not refused against a walked world: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCoachMutationHistoryStore.getState().entries) === entriesBefore,
    'the refused wipe changed the walked history anyway');
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

run('the coach-updates door refuses the wipe against a walked world', () => {
  // THE STORE-ARMOUR REPLAY, application 4 (docs/STORE_ARMOUR_RECIPE_
  // 2026-08-03.md §6): the world is REACHED through host.perform; the update
  // card is then ACTED through the store's own action (the walker's
  // vocabulary has no coach-update action yet — a declared gap, recorded in
  // the unit's boundary report, not hidden; `upsertCoachUpdate` never enters
  // the constraint transaction, so the act is cheap and real). Depth stated
  // per L13: SHALLOW tier (3 actions + one card, 3 days crossed).
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'advance_time', days: 3 });
  useCoachUpdatesStore.getState().upsertCoachUpdate(weekStart, {
    source: 'coach',
    reason: 'Hamstring flared up at training',
    rules: ['No sprinting or high-speed running'],
    changes: ['Tuesday Lower swapped to upper pull'],
  });
  const cardsBefore = JSON.stringify(useCoachUpdatesStore.getState().updatesByWeek);
  assert(Object.keys(useCoachUpdatesStore.getState().updatesByWeek).length >= 1,
    'precondition: the walk must leave a card to protect');
  // COUNT, not index-slice — the walked ring is at cap (see the calendar cell).
  const refusalsOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'coach_updates_write' && entry.outcome === 'refused').length;
  const refusalsBefore = refusalsOnTape();

  const outcome = applyCoachUpdatesWrite({
    next: { updatesByWeek: {}, activeConstraints: [], activeInjury: null },
    writer: 'accepted_mirror',
  });

  assert(!outcome.ok && outcome.reason === 'default_over_answered_updates',
    `the wipe shape was not refused against a walked world: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCoachUpdatesStore.getState().updatesByWeek) === cardsBefore,
    'the refused wipe changed the walked cards anyway');
  assert(refusalsOnTape() === refusalsBefore + 1,
    'the refusal left no witness on the tape');
});

run('the coach chat door refuses the wipe against a walked world', () => {
  // THE STORE-ARMOUR REPLAY, fleet wave 2a (docs/STORE_ARMOUR_RECIPE_
  // 2026-08-03.md §6). The world is REACHED through host.perform; the chat is
  // then ACTED through the store's own actions — the walker's vocabulary has
  // NO coach action, and under the LR-6 standing STOP this unit may not add
  // one. That gap is DECLARED here, not hidden: when LR-6 lifts, the
  // vocabulary gains the coach doors and these act-in lines become walked
  // actions. Shallow tier, depth stated per L13: 3 actions, 3 days.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'advance_time', days: 3 });
  useCoachStore.getState().addMessage({
    id: 'walk-m1', conversationId: 'walk-conv', role: 'user',
    content: 'my hamstring is tight, can Tuesday be easier?',
    createdAt: new Date().toISOString(),
  });
  useCoachStore.getState().addMessage({
    id: 'walk-m2', conversationId: 'walk-conv', role: 'assistant',
    content: 'Done — Tuesday is now an easy movement day.',
    createdAt: new Date().toISOString(),
  });
  const chatBefore = JSON.stringify(useCoachStore.getState().messages);
  assert(useCoachStore.getState().messages.length >= 2,
    'precondition: the acted-in chat must exist to protect');
  // COUNT, not index-slice — the walked ring is at cap (see the calendar cell).
  const refusalsOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'coach_store_write' && entry.outcome === 'refused').length;
  const refusalsBefore = refusalsOnTape();

  const outcome = applyCoachStoreWrite({
    next: { conversations: [], activeConversation: null, messages: [] },
    writer: 'coach_screen',
  });

  assert(!outcome.ok && outcome.reason === 'default_over_answered_chat',
    `the wipe shape was not refused against a walked world: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCoachStore.getState().messages) === chatBefore,
    'the refused wipe changed the walked chat anyway');
  assert(refusalsOnTape() === refusalsBefore + 1,
    'the refusal left no witness on the tape');
});

run('the coach memory door refuses the wipe against a walked world', () => {
  // Same replay for coachMemoryStore — the note is ACTED through the store's
  // own `addNote` for the same declared reason as above: the walker has no
  // coach vocabulary, and LR-6 forbids adding one in this unit. Shallow tier,
  // depth stated per L13: 3 actions, 3 days.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'advance_time', days: 3 });
  useCoachMemoryStore.getState().addNote('hamstring niggle — keep sprint volume low this week');
  const notesBefore = JSON.stringify(useCoachMemoryStore.getState().notes);
  assert(useCoachMemoryStore.getState().notes.length >= 1,
    'precondition: the acted-in note must exist to protect');
  // COUNT, not index-slice — the walked ring is at cap (see the calendar cell).
  const refusalsOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'coach_memory_write' && entry.outcome === 'refused').length;
  const refusalsBefore = refusalsOnTape();

  const outcome = applyCoachMemoryWrite({ next: [], writer: 'coach_screen' });

  assert(!outcome.ok && outcome.reason === 'default_over_answered_notes',
    `the wipe shape was not refused against a walked world: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCoachMemoryStore.getState().notes) === notesBefore,
    'the refused wipe changed the walked notes anyway');
  assert(refusalsOnTape() === refusalsBefore + 1,
    'the refusal left no witness on the tape');
});

run('the override door refuses the wipe against a walked world', () => {
  // THE STORE-ARMOUR REPLAY for the LAST store (recipe §6, LR-1).
  //
  // WHAT THIS CELL FOUND ON ITS FIRST RUN, and it is the unit's most useful
  // finding: **no walked athlete door writes `dateOverrides` any more.** The
  // cell was written to bin a session and went red with `{}` — correctly. A
  // whole-day removal records a `UserRemovalConstraint`; an add or a swap
  // lands in `weekScopedOverlays`. That is the §18 ownership migration having
  // WORKED: the tap doors were moved off the raw override surface one unit at
  // a time, and nobody had asked what was left on it.
  //
  // NARROWED 2026-08-04, and this is now the whole claim: what is left is the
  // COACH pipeline (`coachActions`, the undo engine, the modality-swap
  // orchestrator, the revision writer) and NOTHING ELSE. Stage B stage 1
  // retired the last two non-coach writers — Task A took LR-3's athlete re-add
  // residual into the typed constraint lane, and Task B moved the lighter-day
  // trim onto the `readiness_reduction` week overlay and deleted
  // `'lighter_day'` from the closed writer union. **No athlete-reachable door
  // writes `dateOverrides` any more**, by construction rather than by
  // convention: the union is closed and the ids that remain are coach ids.
  // The walker has NO coach vocabulary
  // and the LR-6 STOP forbids this unit adding one, so the decision is ACTED
  // IN through the door itself after the walk — the same declared gap the
  // coach-prefs and coach-memory cells carry, for the same reason. When LR-6
  // lifts, the vocabulary gains the coach doors and this line becomes walked.
  //
  // Depth stated per L13: SHALLOW tier — 3 walked actions, 10 days crossed,
  // one authored decision. The deep tier drives the same door with more banked.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'advance_time', days: 3 });
  const week = visibleWeek();
  const occupied = week.filter((day) => !!day.workout);
  assert(occupied.length > 0, 'precondition: the generated week must hold a session');
  const target = occupied[0]!;
  seedManualOverride(
    target.date,
    { ...target.workout!, name: 'Assault Bike Sprints' } as never,
    { intent: 'program_adjustment', label: 'Swapped session' } as never,
  );
  performAction({ kind: 'advance_time', days: 7 });

  const overridesBefore = JSON.stringify(useProgramStore.getState().dateOverrides);
  assert(Object.keys(useProgramStore.getState().dateOverrides).length >= 1,
    'precondition: the walk must leave an authored decision to protect — '
    + `it left ${overridesBefore}`);
  // COUNT, not index-slice — the walked ring is at cap (see the calendar cell).
  const refusalsOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'program_override_write'
      && entry.outcome === 'refused').length;
  const refusalsBefore = refusalsOnTape();

  const outcome = quiet(() => applyProgramOverrideSliceWrite({
    next: { dateOverrides: {}, overrideContexts: {} },
    writer: 'coach_action',
    reason: 'walker:wipe_replay',
    validateWeekStarts: [weekStart],
  }));

  assert(!outcome.ok && outcome.reason === 'default_over_answered_overrides',
    `the wipe shape was not refused against a walked world: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useProgramStore.getState().dateOverrides) === overridesBefore,
    'the refused wipe changed the walked decisions anyway');
  assert(refusalsOnTape() === refusalsBefore + 1,
    'the refusal left no witness on the tape');
});

run('a re-add onto a binned day restores through the typed lane, never the override surface', () => {
  // STAGE B STAGE 1 (Option C item 3, measured): the LAST athlete route into
  // the legacy override writer is the active-removal re-add. Binning a whole
  // day records an active whole-session constraint with no remainingWorkout;
  // adding onto that day then deferred (`add_defers_to_legacy_stack`) to
  // `applyCoachRevisionDateOverrides`, whose write un-pinned the removal as a
  // side effect (`applyProgramOverrideWrite`) and left a materialised Workout
  // on `dateOverrides` under the athlete's own writer.
  //
  // The typed lane owns both halves now: the bin flips to
  // restored/'explicit_re_add' (the decision survives, superseded), the new
  // session pins as a constraint, and the override surface is untouched.
  //
  // Depth stated per L13: shallow tier — walked onboarding + generation +
  // 3 days of clock, then two authored decisions on one day.
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'advance_time', days: 3 });
  const week = visibleWeek();
  const occupied = week.filter((day) => !!day.workout);
  assert(occupied.length > 0, 'precondition: the generated week must hold a session');
  let binnedDate: string | null = null;
  for (const day of occupied) {
    const binned = performAction({ kind: 'plan_change', change: {
      kind: 'remove_session', date: day.date, scope: 'whole_day',
    } as PlanChange });
    if (binned.outcome === 'applied') { binnedDate = day.date; break; }
  }
  assert(!!binnedDate, 'precondition: at least one occupied day must accept a whole-day bin');
  const activeBin = useProgramStore.getState().userRemovalConstraints.find((entry) =>
    entry.status === 'active' && entry.targetDate === binnedDate &&
    entry.scope === 'whole_session' && !entry.remainingWorkout);
  assert(!!activeBin,
    'precondition: the bin must record an active whole-session constraint with no remainder');
  // COUNT, not index-slice — the walked ring can be at cap (see the calendar cell).
  const decisionsOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'mutation_constraint_created').length;
  const decisionsBefore = decisionsOnTape();

  // Direct `applyPlanChange`, exactly the route the sheet takes for an add
  // (`programControlActionForPlanChange` returns null for add/swap kinds) —
  // called directly so the assert can name the rejection codes.
  const readd = quiet(() => applyPlanChange({
    change: {
      kind: 'add_category', date: binnedDate!, category: 'strength_full',
    } as PlanChange,
    visibleWeek: visibleWeek(),
    todayISO,
    applyOverride: (date, workout, context) =>
      seedManualOverride(date, workout as never, context as never),
  }));

  assert(readd.outcome === 'applied',
    `the re-add did not land: ${String(readd.outcome)} — ${String(readd.message)}`
    + ` — rejected ${JSON.stringify(readd.rejected)}`);
  const constraints = useProgramStore.getState().userRemovalConstraints;
  const flipped = constraints.find((entry) => entry.id === activeBin!.id);
  assert(!!flipped && flipped.status === 'restored' &&
    flipped.restorationReason === 'explicit_re_add',
    'the bin decision must survive as restored/explicit_re_add — got '
    + JSON.stringify(flipped
      ? { status: flipped.status, reason: flipped.restorationReason }
      : null));
  assert(constraints.some((entry) => entry.status === 'active' &&
    entry.targetDate === binnedDate && !!entry.remainingWorkout),
    'the re-added session must pin as an active constraint (remainingWorkout)');
  const dayAfter = visibleWeek().find((day) => day.date === binnedDate);
  assert(!!dayAfter?.workout, 'the day must show the re-added session');
  assert(!Object.prototype.hasOwnProperty.call(
    useProgramStore.getState().dateOverrides, binnedDate!),
    'the re-add must not touch the override surface — dateOverrides carries the date');
  assert(decisionsOnTape() >= decisionsBefore + 1,
    'the re-add left no constraint decision witness on the tape');
});

// The auth refusal-replay cell RETIRED with authStore (Sam's §6 ruling,
// 2026-08-03): the store it replayed persisted only never-written defaults —
// no sign-in flow ever existed on a reachable screen. A rebuilt auth store
// arrives armoured (docs/STORE_ARMOUR_RECIPE_2026-08-03.md §6) and brings its
// replay cell back with it. uiStore had no cell by decision even before the
// retirement — its door had no refusal to replay.

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


/**
 * THE LIGHTER-DAY DOOR — L11's obligation for Stage B stage 1 Task B.
 *
 * The walker had NO lighter-day vocabulary at all: zero hits for "lighter"
 * under `src/dev/e2e/`, no explorer binding for the accept button, no action
 * kind. A state an athlete can reach that the walker cannot is a defect in the
 * harness, not a gap in the app (L13).
 *
 * DETERMINISTIC RATHER THAN PROPOSABLE, and the unit sheet named this fallback
 * in advance rather than discovering it: `applyLighterDayForToday` is AWAITED
 * and `perform` is synchronous, exactly as with the two schedule doors — and
 * the offer is gated on a COMMITTED today-scoped readiness fact, which the
 * random proposer would reach so rarely that listing it in the non-vacuity
 * required-proposals set would assert an action the proposer almost never
 * emits. The same precedent `walkTheScheduleDoors` sets, for the same reason.
 * Stated here rather than left for a reader to infer.
 *
 * WHAT IT PROVES, and the third assertion is the unit's whole point:
 *   1. the door still works — today gets lighter, disclosed, with a reversible
 *      adjustment id (the athlete's experience is unchanged by the conversion);
 *   2. the trim lands on the `readiness_reduction` WEEK OVERLAY;
 *   3. `dateOverrides` is untouched — with the athlete re-add routes retired by
 *      Task A and `'lighter_day'` gone from the closed writer union, NO
 *      athlete-reachable door writes that surface any more;
 *   4. clearing the fact cascade-reverts it byte-identical, so R12's promise
 *      ("Cleared — today's back to its original session") survives the channel
 *      change;
 *   5. every walker law still holds over the resulting world.
 *
 * Depth stated per L13: this is a walked world, not a seeded one — onboarding,
 * generation and time advance through the real doors before the fact is
 * declared, and the laws run over the result.
 */
/**
 * Clear every active readiness fact THROUGH THE ATHLETE'S OWN DOOR.
 *
 * `clear_fatigue_status` is the door: it reverts the reversible adjustments
 * linked by `sourceFactId` and then resolves the fact, which is what makes
 * "Cleared — today's back to its original session" true. The walker's
 * `clear_source_facts` move is a world reset, not that door — it empties the
 * readiness SIGNAL store and drops schedule facts, and touches neither the
 * cascade nor a readiness fact's status. Cells that pin the clear PROMISE have
 * to use the promise's own door, or they pass on a world where nothing was
 * authored to put back.
 */
async function clearEveryActiveReadinessFactThroughItsDoor(date: string): Promise<void> {
  for (let guard = 0; guard < 8; guard += 1) {
    const facts = (useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts ?? [])
      .filter((fact) => 'factKind' in fact
        && fact.factKind !== 'schedule'
        && (fact as { status?: string }).status === 'active') as Array<{ factId?: string }>;
    const factId = facts[0]?.factId;
    if (!factId) return;
    const result = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: { date, modifierId: factId },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: false,
    } as never, { todayISO: date }));
    assert(result.ok,
      `the clear door refused to resolve ${factId}: "${result.message}" — the athlete `
      + 'cannot take back what they reported');
  }
  assert(false, 'the clear door never emptied the active readiness facts');
}

async function walkTheLighterDayDoor(): Promise<void> {
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });
  performAction({ kind: 'advance_time', days: 3 });

  const dayWithASession = visibleWeek().find((day) => (day.workout?.exercises ?? []).length > 0);
  if (!dayWithASession) {
    // NOT a silent skip. A walked world with nothing to trim cannot exercise
    // this door, and saying so is the honest outcome; a pass here would be the
    // vacuous kind this suite exists to refuse.
    throw new Error('the walked world holds no session with exercises to trim — '
      + 'the lighter-day door is unreachable from it and this cell proves nothing');
  }
  const date = dayWithASession.date;

  const declared = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_fatigue_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date, todayISO: date, level: 'low_energy' },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as never, { todayISO: date }));
  assert((declared as { ok?: boolean }).ok === true,
    `precondition: the readiness fact must commit — ${JSON.stringify(declared)}`);

  const setsOn = (target: string): number =>
    ((visibleWeek().find((day) => day.date === target)?.workout?.exercises ?? []) as unknown[])
      .reduce<number>((sum, row) => sum + Number((row as { prescribedSets?: number }).prescribedSets ?? 0), 0);
  const before = setsOn(date);
  const weekBefore = weekFingerprint();

  // THE TAP IS THE DECISION (Sam's D-3 ruling, 2026-08-05). The door returns
  // the id of the fact it just authored, and the offer carries it into the
  // trim — so the walk passes it exactly as the screen does.
  const tappedFactId = (declared as { createdModifierIds?: string[] })
    .createdModifierIds?.[0];
  assert(!!tappedFactId,
    'the readiness door returned no fact id — there is no decision to carry, '
    + 'and the trim would be back to guessing which fact owns the day');

  const applied = await quietAsync(() => (require('../utils/lighterDayTransaction') as {
    applyLighterDayForToday: (a: {
      date: string; todayISO: string; sourceFactId?: string;
    }) => Promise<{
      ok: boolean; message: string; changes: string[]; adjustmentId?: string;
    }>;
  }).applyLighterDayForToday({ date, todayISO: date, sourceFactId: tappedFactId }));

  assert(applied.ok, `the lighter-day door refused a walked world: ${applied.message}`);
  assert(applied.changes.length > 0 && /\S/.test(applied.message),
    'the door applied a trim and disclosed nothing');
  assert(!!applied.adjustmentId, 'the door recorded no reversible adjustment id');
  assert(setsOn(date) < before,
    `the door reported success and the day did not get lighter: ${before} -> ${setsOn(date)}`);

  // THE CHANNEL.
  const overlays = useProgramStore.getState().weekScopedOverlays ?? {};
  const overlay = overlays[require('../rules/dayPrecedence').mondayForDate(date) as string];
  assert(overlay && Object.prototype.hasOwnProperty.call(overlay.workoutsByDate, date),
    `the trim did not land on the week overlay: ${JSON.stringify(Object.keys(overlays))}`);
  assert(overlay!.reason === 'readiness_reduction',
    `the overlay wears the wrong reason: ${overlay!.reason}`);

  // THE SURFACE THAT MUST STAY EMPTY.
  const overrides = useProgramStore.getState().dateOverrides ?? {};
  assert(Object.keys(overrides).length === 0,
    'a walked athlete door wrote `dateOverrides`: '
    + `${JSON.stringify(Object.keys(overrides))}. After Task A and Task B the `
    + 'surface is coach-pipeline-only, and the walker has no coach vocabulary.');

  for (const broken of checkInvariants({
    action: { kind: 'declare_source_fact', date, fact: 'poor_sleep' },
    outcome: 'lighter_day_applied', message: applied.message, threw: null,
  })) {
    assert(false, `${broken.law}: ${broken.detail}`);
  }

  // PIN (i), Sam's D-3 ruling: TAP -> factId -> DAY OWNERSHIP, end to end.
  // The id the athlete's tap created must be the id the trim is linked by.
  // Before the ruling this was re-derived from the date by taking the first
  // match in an ALPHABETICALLY sorted array, so the link could name a fact the
  // athlete never tapped — and nothing in the tree checked.
  const ledgerAdjustments = ((useProgramStore.getState() as unknown as {
    reversibleAdjustmentLedger?: { adjustments?: Array<{ id: string; sourceFactId?: string }> };
  }).reversibleAdjustmentLedger?.adjustments) ?? [];
  const trimRecord = ledgerAdjustments.find((entry) => entry.id === applied.adjustmentId);
  assert(!!trimRecord,
    `the trim recorded no ledger entry to own: ${applied.adjustmentId}`);
  assert(trimRecord!.sourceFactId === tappedFactId,
    'the trim is linked to a fact the athlete did not tap — '
    + `tapped ${tappedFactId}, linked ${trimRecord!.sourceFactId}`);

  // THE PROMISE: clearing the fact puts today back, byte-identical.
  await clearEveryActiveReadinessFactThroughItsDoor(date);
  assert(weekFingerprint() === weekBefore,
    'clearing the readiness fact did not restore the week byte-identical — '
    + 'the cascade-undo keys on `sourceFactId`, not on the surface, so the '
    + 'channel change must not have touched it');

  // PIN (ii), Sam's D-3 ruling: the SAME world with TWO OVERLAPPING FACTS.
  //
  // This is the world the old code got wrong and no test built. An open
  // fatigue window plus a today-scoped illness both cover today; the
  // alphabetical order put `fatigue` first, so the trim linked to fatigue
  // while the card's Clear button — which preferred the today-scoped fact —
  // resolved the illness. The athlete cleared what they reported, read
  // "Cleared — today's back to its original session", and the day stayed
  // trimmed. Both surfaces now ask one owner, and the tap wins outright.
  const weekBeforePair = weekFingerprint();
  const setsBeforePair = setsOn(date);

  const fatigueDeclared = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_fatigue_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: { date, todayISO: date, level: 'cooked' },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as never, { todayISO: date }));
  const illnessDeclared = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_illness_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date, todayISO: date, tier: 'mild' },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as never, { todayISO: date }));

  const illnessFactId = (illnessDeclared as { createdModifierIds?: string[] })
    .createdModifierIds?.[0];

  // Only meaningful if the world really does hold TWO distinct active facts
  // covering the day. Read from the store rather than from either door's
  // return: what matters is the WORLD's shape, and a door that updates an
  // existing fact instead of adding one would otherwise pass this silently.
  const activeReadinessFacts = (require('../rules/temporarySourceFact') as {
    activeTemporarySourceFacts: (
      f: readonly unknown[], d?: string,
    ) => Array<{ factId?: string; factKind?: string }>;
  }).activeTemporarySourceFacts(
    (require('../store/acceptedStateColdStart') as {
      normalizeAcceptedMaterialContext: (c: unknown) => { temporarySourceFacts: unknown[] };
    }).normalizeAcceptedMaterialContext(
      useProgramStore.getState().acceptedMaterialContext).temporarySourceFacts,
    date,
  ).filter((fact) => fact.factKind && fact.factKind !== 'injury');

  assert(activeReadinessFacts.length >= 2 && !!illnessFactId,
    'the two-fact world did not materialise — this cell proves nothing without '
    + `two overlapping facts: ${JSON.stringify(activeReadinessFacts.map((f) => f.factId))}`);
  assert(activeReadinessFacts.some((fact) => fact.factId !== illnessFactId),
    'both active facts are the tapped one — there is no competing fact to get wrong');

  const pairApplied = await quietAsync(() => (require('../utils/lighterDayTransaction') as {
    applyLighterDayForToday: (a: {
      date: string; todayISO: string; sourceFactId?: string;
    }) => Promise<{ ok: boolean; message: string; adjustmentId?: string }>;
  }).applyLighterDayForToday({
    date, todayISO: date, sourceFactId: illnessFactId,
  }));

  // WHICH BRANCH THIS TOOK IS PRINTED, not assumed. A refusal is legitimate on
  // an already-light day, but a cell that silently took the refusal path proves
  // less than it reads — so it says which one ran.
  console.log(`      two-fact world: trim ${pairApplied.ok ? 'APPLIED' : 'refused'}`
    + ` — ${pairApplied.message}`);
  if (pairApplied.ok) {
    assert(setsOn(date) < setsBeforePair,
      'the two-fact trim reported success and the day did not get lighter');
    // CLEARING THE FACT THE ATHLETE TAPPED restores the session. The old
    // behaviour linked the trim to the OTHER fact, so this clear left the day
    // trimmed while telling the athlete it had been put back.
    //
    // THROUGH THE REAL CLEAR DOOR, not the walker's world-reset move. This read
    // `performAction({ kind: 'clear_source_facts' })`, which wipes the readiness
    // SIGNAL store and drops schedule facts — it never resolves a readiness fact
    // and so never runs the `sourceFactId` cascade this pin is named after. It
    // agreed with the promise only because the fatigue door in this world was
    // being REFUSED by the §18 gate, so there was no authored week to put back.
    // Once that door landed (§18 ownership reassessment 2026-08-05, D3), the
    // difference between the reset and the door became the whole question. The
    // cell asks the door.
    await clearEveryActiveReadinessFactThroughItsDoor(date);
    assert(weekFingerprint() === weekBeforePair,
      'clearing the tapped fact did not restore the original session in a world '
      + 'that held two overlapping facts — the trim is owned by a fact the '
      + 'athlete did not tap, which is the lie D-3 was ruled to kill');
  } else {
    // An already-light day is a legitimate refusal, not a pass to hide behind.
    assert(/already light/i.test(pairApplied.message),
      `the two-fact world refused for an unexpected reason: ${pairApplied.message}`);
    await clearEveryActiveReadinessFactThroughItsDoor(date);
  }
}


/**
 * THE L16 SLICE, END TO END: load → display → change → repair → approve →
 * persist → RELAUNCH-IDENTICAL.
 *
 * > L16 (Sam ratified 2026-07-30): "A rebuilt system proves one complete loop
 * >  before anything else builds on it… Stage B is held to this shape
 * >  explicitly: the engine's first acceptance is one clean slice through the
 * >  walker, not breadth."
 *
 * WHY THIS CELL DID NOT EXIST. The last hop was proven NOWHERE. `freshInstall`
 * CLEARS storage rather than reading it back, and this file had no hydrate call
 * at all — so every cell above proves what the app does within one process and
 * nothing about what it shows the athlete on the next launch. The precedent
 * copied here is `simulateProcessRelaunch` in
 * `onboardingReliabilityTests.ts:188-204`, whose unit found that a relaunch
 * defect can hide behind a perfectly green in-process suite.
 *
 * THE RELAUNCH IS A REAL ONE, not a re-read of live memory:
 *   1. every pending durable write is flushed and drained (the armoured stores
 *      queue cross-store cascades on later turns, so the drain loops);
 *   2. in-memory store state is reset — WITHOUT clearing the storage stub, the
 *      one difference from `freshInstall` and the whole point;
 *   3. the stores rehydrate from those persisted bytes via `persist.rehydrate()`.
 * A snapshot that survived because the object was still in memory would prove
 * nothing, so the reset is what makes the assertion mean anything.
 *
 * ONE MODE PER LOOP, NAMED — the slice's honest scope. Two seeds, two loops:
 * an OFF-SEASON world and an IN-SEASON GAME-WEEK world. Every other week mode
 * (bye, bye_recovery, deload, optional, illness_recovery, full pause) is
 * NOT reached by this cell and is declared not-covered in the boundary report
 * rather than implied by a passing gate.
 *
 * Depth stated per L13: onboarding → generation → accept boundary → a door
 * change through the real dispatch → 10 days crossed → relaunch. That is the
 * slice's depth, and it is SHALLOW on purpose: this cell proves the loop
 * CLOSES. The deep tier proves it closes in a worn world, and both tiers run it.
 */
/**
 * THE D-2 WORN-WORLD PROBE — an INSTRUMENT, not a gate (D2_PROBE=1).
 *
 * Sam's D-2 ruling, 2026-08-05: "measure first, LR-27 method. No
 * implementation, no redirect, no reorder until a probe on a WORN acted world
 * (long life, overrides authored, hydrate + accepted-commit cycles) brings
 * back receipts on what the hydration-repair in-place branch actually does and
 * stamps."
 *
 * The gap this fills, named by the Priority D survey: the branch at
 * `programStore.ts` (in-place repair of an athlete-authored `dateOverrides`
 * entry) is reached constantly and asserted NOWHERE, and the only
 * relaunch-proof world in the repo — `walkTheL16Slice` — never authors an
 * override, so its `hasOwnProperty` guard is never true across a relaunch.
 * Nobody knows whether the branch churns, grows, or is a no-op on a worn phone.
 *
 * IT ASSERTS NOTHING, deliberately. Receipts go back to Sam before any D-2
 * ruling; a probe that failed a build would be the implementation he declined.
 */
async function probeTheWornWorld(): Promise<void> {
  const relaunch = async (): Promise<void> => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await flushPendingStorageWrites().catch(() => undefined);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (pendingStorageWriteCount() === 0) break;
    }
    const disk = new Map(localStorageData);
    useProgramStore.setState({
      currentProgram: null, currentMicrocycle: null, todayWorkout: null,
      dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
      userRemovalConstraints: [], exposureContractsByWeek: {},
      blockState: null,
    } as never);
    useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
    await flushPendingStorageWrites().catch(() => undefined);
    localStorageData.clear();
    for (const [key, value] of disk) localStorageData.set(key, value);
    await useProgramStore.persist.rehydrate();
    await useCalendarStore.persist.rehydrate();
    await useProfileStore.persist.rehydrate();
    await useCoachUpdatesStore.persist.rehydrate();
  };

  const overrideReceipt = (): {
    keys: string[]; bytes: number; fingerprints: Record<string, string>;
  } => {
    const overrides = (useProgramStore.getState().dateOverrides ?? {}) as Record<string, unknown>;
    const fingerprints: Record<string, string> = {};
    for (const [date, value] of Object.entries(overrides)) {
      const workout = value as { name?: string; exercises?: unknown[] } | null;
      fingerprints[date] = `${workout?.name ?? 'null'}/${(workout?.exercises ?? []).length}`
        + `/${JSON.stringify(value ?? null).length}b`;
    }
    return {
      keys: Object.keys(overrides).sort(),
      bytes: JSON.stringify(overrides).length,
      fingerprints,
    };
  };

  console.log('\n=== D-2 WORN-WORLD PROBE (receipts only, asserts nothing) ===');
  freshInstall();
  performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
  performAction({ kind: 'generate_program' });

  // WEAR THE WORLD IN. Author overrides through the real doors, mark a fixture,
  // and let time pass — the three things the L16 slice never does together.
  const week = visibleWeek();
  const targets = week.filter((day) => (day.workout?.exercises ?? []).length > 0).slice(0, 3);
  for (const day of targets) {
    performAction({ kind: 'plan_change', change: {
      kind: 'add_category', date: day.date, category: 'conditioning_light',
    } as never });
  }
  const saturday = week.find((day) => day.date.length === 10 && new Date(`${day.date}T12:00:00`).getDay() === 6);
  if (saturday) performAction({ kind: 'mark_calendar', date: saturday.date, mark: 'game' });
  performAction({ kind: 'advance_time', days: 3 });

  const authored = overrideReceipt();
  console.log(`  after wearing in: ${authored.keys.length} override(s), `
    + `${authored.bytes} bytes`);
  console.log(`    ${JSON.stringify(authored.fingerprints)}`);
  if (authored.keys.length === 0) {
    console.log('  NO OVERRIDES AUTHORED — the probe cannot reach the branch from this '
      + 'world, and that is itself a receipt: the door the walker drives does not '
      + 'write `dateOverrides`. Report it as such rather than as a clean result.');
  }

  // FIVE RELAUNCH + ACCEPTED-COMMIT CYCLES. LR-27 doubled per launch; if this
  // branch churns or grows, five is enough to see the shape.
  let previous = authored;
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    await relaunch();
    const now = overrideReceipt();
    const changedKeys = now.keys.join('|') !== previous.keys.join('|');
    const changedContent = Object.entries(now.fingerprints)
      .filter(([date, print]) => previous.fingerprints[date] !== print)
      .map(([date, print]) => `${date}: ${previous.fingerprints[date] ?? 'ABSENT'} -> ${print}`);
    console.log(`  relaunch ${cycle}: ${now.keys.length} override(s), ${now.bytes} bytes`
      + ` (${now.bytes - previous.bytes >= 0 ? '+' : ''}${now.bytes - previous.bytes})`
      + `${changedKeys ? ' KEYS CHANGED' : ''}`);
    if (changedContent.length > 0) {
      console.log(`    CONTENT CHANGED: ${changedContent.join(' ; ')}`);
    }
    previous = now;
  }
  console.log('=== END D-2 PROBE — no assertions were made ===\n');
}

async function walkTheL16Slice(): Promise<void> {
  const relaunch = async (): Promise<void> => {
    // 1. PERSIST — drain, do not assume. Cross-store persist cascades queue
    //    further writes on later turns (the onboarding-reliability precedent).
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await flushPendingStorageWrites().catch(() => undefined);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (pendingStorageWriteCount() === 0) break;
    }
    // 2. KILL MEMORY, KEEP DISK — and the disk must be the disk AS OF THE KILL.
    //
    //    A process that dies does not get to write on its way out. Zustand
    //    persists on EVERY `setState`, so blanking the stores in step 2 wrote
    //    the blanked state straight over the bytes step 1 had just flushed, and
    //    step 3 then faithfully rehydrated the emptiness. The first draft of
    //    this cell failed with "the program did not survive the relaunch at
    //    all" for exactly that reason — the harness, not the app.
    //
    //    So the persisted bytes are photographed BEFORE memory is cleared and
    //    restored after, which is what "the disk survives, the heap does not"
    //    actually means.
    const disk = new Map(localStorageData);
    useProgramStore.setState({
      currentProgram: null, currentMicrocycle: null, todayWorkout: null,
      dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
      userRemovalConstraints: [], exposureContractsByWeek: {},
      blockState: null,
    } as never);
    useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
    await flushPendingStorageWrites().catch(() => undefined);
    localStorageData.clear();
    for (const [key, value] of disk) localStorageData.set(key, value);
    // 3. HYDRATE from what was actually written.
    await useProgramStore.persist.rehydrate();
    await useCalendarStore.persist.rehydrate();
    await useProfileStore.persist.rehydrate();
    await useCoachUpdatesStore.persist.rehydrate();
  };

  const loops: { mode: string; drive: () => void }[] = [
    {
      mode: 'off-season / pre-season, no fixture marked',
      drive: () => {
        performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
        performAction({ kind: 'generate_program' });
        performAction({ kind: 'advance_time', days: 3 });
      },
    },
    {
      mode: 'in-season game week (Saturday fixture marked through the calendar door)',
      drive: () => {
        performAction({ kind: 'answer_onboarding', profile: tapeWorldProfile() });
        performAction({ kind: 'generate_program' });
        performAction({ kind: 'mark_calendar', date: addDaysISO(weekStart, 5), mark: 'game' });
        performAction({ kind: 'advance_time', days: 3 });
      },
    },
  ];

  for (const loop of loops) {
    freshInstall();
    loop.drive();

    // ── CHANGE — through the real dispatch, and it must actually land ──
    const occupied = visibleWeek().filter((day) => !!day.workout);
    assert(occupied.length > 0, `${loop.mode}: the loaded week holds no session to change`);
    // Not every occupied day accepts a whole-day bin — §18 refuses one that
    // would breach the week's contract, which is the contract working. Walk the
    // days until one applies, exactly as the LR-3 cell above does.
    const before = weekFingerprint();
    let changedDate: string | null = null;
    for (const day of occupied) {
      const outcome = performAction({ kind: 'plan_change', change: {
        kind: 'remove_session', date: day.date, scope: 'whole_day',
      } as PlanChange });
      if (outcome.outcome === 'applied') { changedDate = day.date; break; }
    }
    assert(!!changedDate,
      `${loop.mode}: no occupied day accepted a bin, so the loop has no CHANGE step`);
    assert(weekFingerprint() !== before,
      `${loop.mode}: the door reported applied and the visible week did not move — this `
      + 'cell would then be asserting that a relaunch preserves nothing');

    // ── APPROVE + PERSIST are the door's own commit; capture what the athlete sees ──
    const seenBefore = weekFingerprint();
    const projectedBefore = JSON.stringify(projectedWeek());
    const overlaysBefore = JSON.stringify(useProgramStore.getState().weekScopedOverlays);
    const constraintsBefore = JSON.stringify(useProgramStore.getState().userRemovalConstraints);
    assert(seenBefore.length > 0 && projectedBefore.length > 2,
      `${loop.mode}: nothing to compare — a vacuous relaunch proof is worse than none`);

    await relaunch();

    // ── RELAUNCH-IDENTICAL ──
    assert(!!useProgramStore.getState().currentProgram,
      `${loop.mode}: the program did not survive the relaunch at all — the loop is `
      + 'broken at PERSIST, not at display');
    assert(weekFingerprint() === seenBefore,
      `${loop.mode}: the athlete sees a different week after relaunch.\n`
      + `      before: ${seenBefore}\n      after:  ${weekFingerprint()}`);
    // ── THE PROJECTION, with a DECLARED red carved out of it (LR-27) ────────
    //
    // WHAT THE FIRST RUN OF THIS CELL FOUND, and it is the argument for L16.
    // The athlete-visible week survives byte-identical, but the projection does
    // not: `derivedSessionProvenance[0].dependency.displacedSession.workout`
    // carries a full `Workout`, which carries its OWN
    // `derivedSessionProvenance`, recursively. Measured across ONE relaunch of
    // the in-season Friday Gunshow: chain depth 3 -> 4, and that day's payload
    // 66,947 -> 139,331 bytes. It roughly DOUBLES per launch, and a phone
    // launches many times. 3,056 leaves differed; only 404 were timestamps.
    //
    // NOT FIXED HERE, and not quietly widened past either. It is LR-26's twin —
    // a full workout snapshot stored inside a provenance record, which Sam has
    // already ruled the principle for on the OTHER record (delete the snapshot,
    // keep the reference, re-derive at read) but has NOT ruled for this one.
    // Filed as census LR-27.
    //
    // So the assertion splits rather than loosens (L13: cells go red by walking
    // further, never by asking less). Everything the athlete can see is still
    // compared byte-for-byte; the declared field is compared for GROWTH, so the
    // known defect cannot get worse — or spread to a second field, or be
    // silently fixed while the declaration goes on claiming it — without this
    // cell reding.
    // TWO NORMALISATIONS, both measured before being applied rather than
    // assumed, because a normaliser is how a relaunch proof goes vacuous:
    //
    //  - `derivedSessionProvenance` — the declared LR-27 red above.
    //  - `createdAt`/`updatedAt` on a DERIVED session. A Gunshow is composed at
    //    READ time, so its stamps are the moment of derivation, not content the
    //    relaunch was meant to preserve; the two runs were 19 ms apart. (That
    //    they exist at all is the L14 impurity noted in the stage-0 measurements
    //    — `new Date().toISOString()` inside generation — and it is reported,
    //    not fixed here.) Nothing else was excluded: with these two removed the
    //    residual was measured at exactly ZERO differing leaves.
    //
    // Both sides are JSON round-tripped so the comparison is like-for-like: a
    // live object carries explicitly-undefined keys that a parsed snapshot has
    // dropped, and that is a harness artifact, not a divergence.
    const semantic = (value: unknown): string => {
      const walk = (node: unknown): unknown => {
        if (Array.isArray(node)) return node.map(walk);
        if (node && typeof node === 'object') {
          const out: Record<string, unknown> = {};
          for (const [key, entry] of Object.entries(node as object)) {
            if (key === 'derivedSessionProvenance') continue;
            if (key === 'createdAt' || key === 'updatedAt') continue;
            out[key] = walk(entry);
          }
          return out;
        }
        return node;
      };
      return JSON.stringify(walk(JSON.parse(JSON.stringify(value))));
    };
    assert(semantic(projectedWeek()) === semantic(JSON.parse(projectedBefore)),
      `${loop.mode}: the PROJECTION differs after relaunch in a field the athlete can `
      + 'see, though the resolved week matches — two surfaces disagreeing across a '
      + 'process boundary. This is NOT the declared LR-27 provenance nesting, which is '
      + 'excluded above.');

    const provenanceDepth = (workout: unknown): number => {
      let depth = 0;
      let node = workout as Record<string, unknown> | undefined;
      while (node) {
        const chain = node.derivedSessionProvenance as {
          dependency?: { displacedSession?: { workout?: Record<string, unknown> } };
        }[] | undefined;
        const next = chain?.[0]?.dependency?.displacedSession?.workout;
        if (!next) break;
        depth += 1;
        node = next;
      }
      return depth;
    };
    const beforeDepths = (JSON.parse(projectedBefore) as { workout?: unknown }[])
      .map((day) => provenanceDepth(day.workout));
    const afterDepths = (projectedWeek() as unknown as { workout?: unknown }[])
      .map((day) => provenanceDepth(day.workout));
    // ── LR-27, PAID 2026-08-05 — the pin reverses direction ─────────────────
    //
    // This pin used to REQUIRE the chain to grow (a declared red, contained so
    // it could not get worse). The defect is now fixed at its root: a
    // resolver-owned filler is no longer snapshotted into its own successor
    // (`sessionResolver.applyGameProximity`), so the chain cannot deepen across
    // a relaunch at all. The assertion therefore flips from "grows by exactly
    // one" to "does not grow", in the same commit that pays the census entry —
    // the ratchet's own rule.
    //
    // ZERO, not "small". A cap would have accepted the premise that a workout
    // belongs inside its own provenance; Sam's ruling is that it does not.
    for (let index = 0; index < afterDepths.length; index += 1) {
      const grew = afterDepths[index]! - beforeDepths[index]!;
      assert(grew <= 0,
        `${loop.mode}: LR-27 REGRESSED — day ${index}'s displaced-session provenance `
        + `chain grew by ${grew} across one relaunch (${beforeDepths[index]} -> `
        + `${afterDepths[index]}). A derived filler is being snapshotted into its own `
        + 'successor again; the chain must not deepen across a process boundary.');
    }
    // ── THE OVERLAYS, and the second thing this cell found ──────────────────
    //
    // `weekScopedOverlays` is PERSISTED state, so a relaunch should read it
    // back, not rebuild it. It rebuilds it. Two measured deltas, both from the
    // hydration re-canonicalisation pass, neither fixed here:
    //
    //  1. LR-27 again, and WORSE than the projection reading suggested: the
    //     provenance nesting is not merely a read-time artifact, it is written
    //     to disk. The stored overlay's session gains a provenance level per
    //     launch, so the growth is durable and compounds on the athlete's phone.
    //  2. The stored overlay GAINS a legacy v1 `exposureContract` it did not
    //     have in memory — 38 leaves, every one `undefined -> <value>`
    //     (protocolVersion, identity.phase/subphase/mode/weekKind,
    //     strength.requiredPatterns, targetCount…). `validateLiveWeekOverlayWrite`
    //     attaches it (`exposureContractsByWeek[weekStart] ?? overlay.exposureContract
    //     ?? baseMicrocycle.exposureContract`) and hydration runs that path. A
    //     SUPERSEDED format being written on every launch is L15's subject —
    //     "old formats exist only as read-ingress lifts at the boundary; a
    //     writer of a retired shape is a red-gate defect, not a compatibility
    //     feature". Reported for Sam with the hydration-repair in-place branch
    //     already parked from stage 0 (`programStore.ts:1216-1219`), not
    //     adjudicated inside a slice proof.
    //
    // What the slice DOES claim, and what is asserted: the content the athlete
    // sees — `workoutsByDate` — survives byte-identical under the same two
    // declared normalisations used for the projection.
    const overlayContent = (value: string): string => {
      const overlays = JSON.parse(value) as Record<string, { workoutsByDate?: unknown }>;
      return semantic(Object.fromEntries(Object.entries(overlays)
        .map(([week, overlay]) => [week, overlay.workoutsByDate ?? null])));
    };
    assert(overlayContent(JSON.stringify(useProgramStore.getState().weekScopedOverlays))
      === overlayContent(overlaysBefore),
      `${loop.mode}: the week overlays' CONTENT did not survive the relaunch — this is `
      + 'not the declared provenance nesting or the legacy-contract materialisation, '
      + 'both of which are normalised out above.');
    assert(JSON.stringify(useProgramStore.getState().userRemovalConstraints) === constraintsBefore,
      `${loop.mode}: the athlete's removal decisions did not survive the relaunch `
      + 'byte-identical — a bin that does not outlive a relaunch is not a decision');

    // ── And every law still holds on the hydrated world ──
    for (const broken of checkInvariants({
      action: { kind: 'advance_time', days: 0 }, outcome: null, message: null, threw: null,
    })) {
      if (declaredRedFor(broken.law, broken.detail)) continue;
      throw new Error(`${loop.mode}: ${broken.law} after relaunch — ${broken.detail}`);
    }
    console.log(`      L16 loop closed — ${loop.mode}`);
  }
}

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
  if (process.env.D2_PROBE === '1') {
    await probeTheWornWorld();
    return;
  }
  await runAsync('the two schedule doors are walkable through the REAL door, and the laws hold',
    walkTheScheduleDoors);
  await runAsync('accepting a lighter day derives from the fact and never touches the athlete\'s surface',
    walkTheLighterDayDoor);
  await runAsync('THE L16 SLICE: load, display, change, repair, approve, persist, relaunch-identical',
    walkTheL16Slice);

  console.log(`\nAction walker totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
})();
