/**
 * illness_recovery §18 WEEK-MODE invariants.
 *
 * A first-class Section18WeekMode sibling of in_season_bye_recovery, derived
 * ONLY from an active SEVERE illness source fact by a single pure
 * composition-boundary function (deriveIllnessRecoveryWeekMode). The gateway /
 * contract consumes the MODE and never inspects facts.
 *
 * Four recorded invariants (spec, Sam sign-off 2026-07-23):
 *   1. mode derivable ONLY from an active severe illness fact
 *   2. clearing the fact restores the normal week BYTE-IDENTICAL (cascade)
 *   3. a normal week's §18 validation is completely unaffected
 *   4. the mode's own week still validates structurally
 *
 * Run: npm run test:illness-recovery-mode
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { deriveIllnessRecoveryWeekMode } from '../rules/illnessRecoveryWeekMode';
import {
  createTemporaryIllnessFact,
  createTemporaryFatigueFact,
  composeTemporarySourceFactCompatibility,
} from '../rules/temporarySourceFact';
import { buildWeeklyExposureContract } from '../rules/weeklyExposureContractBuilders';
import { runSection18AcceptedWeekGateway } from '../rules/section18AcceptedWeekGateway';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { addDaysISO } from '../utils/programBlockState';

const WEEK = '2026-07-13';
const NEXT_WEEK = addDaysISO(WEEK, 7);

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  console.warn = () => undefined;
  console.error = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
    teamTrainingIntensity: 'Hard',
    sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: 'Advanced',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    ...overrides,
  } as OnboardingData;
}

/** Seed the live stores with an optional active severe illness week-fact, then
 *  generate a program the athlete would see. Mirrors production: the fact is in
 *  acceptedMaterialContext and its composed constraint drives the readiness
 *  pipeline; the mode derivation reads the raw fact. */
function generateWithIllness(severe: boolean, withGame = true) {
  const athlete = profile();
  const facts = severe
    ? [createTemporaryIllnessFact({
        observedDate: WEEK, scope: weekScope(WEEK), severity: 'severe',
        sourceSurface: 'week_readiness_sheet',
      })]
    : [];
  const compat = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: facts, activeConstraints: [], onDate: WEEK,
  });
  const markedDays = withGame ? { '2026-07-18': 'game' } : {};
  useCalendarStore.setState({ markedDays, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: compat.activeConstraints, activeInjury: null } as never);
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  useProgramStore.setState({
    acceptedMaterialContext: {
      markedDays,
      readinessSignalsByDate: {},
      activeConstraints: compat.activeConstraints,
      activeInjury: null,
      temporarySourceFacts: facts,
      revision: 1,
      lastTransaction: 'illness-recovery-test:seed',
    },
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as never);
  const program = quiet(() => generateProgramLocally(athlete, {
    todayISO: WEEK,
    previousProgram: null,
    activeConstraints: compat.activeConstraints,
    readinessSignal: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'In-season',
      phaseEntryWeekStartISO: WEEK,
      originProvenance: 'explicit_user_phase_change',
    },
  }));
  return program.microcycles[0];
}

type GenWorkout = { dayOfWeek: number; workoutType?: string; sessionTier?: string };
type GenMicro = { exposureContract?: { identity?: { mode?: string } }; workouts: GenWorkout[] };

/** Sam 2026-07-24: in an optional-only week mode, EVERY surviving session (any type that
 *  isn't a bare Rest and isn't the game fixture) is tier 'optional' — team days included. */
function assertEverySurvivingSessionOptional(mc: GenMicro, label: string): void {
  const mode = mc.exposureContract?.identity?.mode ?? '(none)';
  const worked = mc.workouts.filter((w) => w.workoutType !== 'Rest' && w.workoutType !== 'Game');
  assert(worked.length > 0, `${label}: expected surviving worked sessions to assert on (mode=${mode})`);
  const notOptional = worked.filter((w) => w.sessionTier !== 'optional');
  assert(notOptional.length === 0,
    `${label} (mode=${mode}): surviving sessions NOT stamped optional: ` +
    notOptional.map((w) => `dow${w.dayOfWeek}:${w.workoutType}/${w.sessionTier}`).join(', '));
}

function inSeasonContractInput(weekModeOverride?: 'illness_recovery') {
  return {
    seasonPhase: 'In-season' as const,
    readiness: 'high' as const,
    selectedDayNumbers: [1, 2, 3, 4, 5],
    teamTrainingDayNumbers: [2, 4],
    hasGame: true,
    gameDay: 6,
    weekModeOverride,
  };
}

let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passes += 1;
    console.log(`  PASS [invariant] ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`);
  }
}

const weekScope = (weekStart: string) => ({
  kind: 'week' as const,
  weekStart,
  from: weekStart,
  until: addDaysISO(weekStart, 6),
});
const dateScope = (date: string) => ({
  kind: 'date' as const,
  date,
  from: date,
  until: date,
});

const severeIllness = (weekStart = WEEK) => createTemporaryIllnessFact({
  observedDate: weekStart, scope: weekScope(weekStart), severity: 'severe',
  sourceSurface: 'week_readiness_sheet',
});

// ── Invariant 1 — the mode is derivable ONLY from an active severe illness fact.
// A severe illness fact covering the week derives illness_recovery; a minor
// illness fact, a severe FATIGUE fact, no fact, a resolved fact, and a fact for
// a different week all leave the mode unset (existing bye logic decides).
run('1 illness-recovery derivable ONLY from an active severe illness fact', () => {
  assert(
    deriveIllnessRecoveryWeekMode({ temporarySourceFacts: [severeIllness()], weekStartISO: WEEK }),
    'an active severe illness fact covering the week must derive illness_recovery',
  );

  assert(
    !deriveIllnessRecoveryWeekMode({
      temporarySourceFacts: [createTemporaryIllnessFact({
        observedDate: WEEK, scope: dateScope(WEEK), severity: 'minor',
        sourceSurface: 'week_readiness_sheet',
      })],
      weekStartISO: WEEK,
    }),
    'a MINOR illness fact must NOT derive illness_recovery (inert)',
  );

  assert(
    !deriveIllnessRecoveryWeekMode({ temporarySourceFacts: [], weekStartISO: WEEK }),
    'no illness fact must NOT derive illness_recovery',
  );

  assert(
    !deriveIllnessRecoveryWeekMode({
      temporarySourceFacts: [createTemporaryFatigueFact({
        observedDate: WEEK, scope: weekScope(WEEK), athleteReportedLevel: 'high',
        sourceSurface: 'week_readiness_sheet',
      })],
      weekStartISO: WEEK,
    }),
    'a severe FATIGUE fact must NOT derive illness_recovery (ONLY from illness)',
  );

  const resolved = { ...severeIllness(), status: 'resolved' as const };
  assert(
    !deriveIllnessRecoveryWeekMode({ temporarySourceFacts: [resolved], weekStartISO: WEEK }),
    'a resolved severe illness fact must NOT derive illness_recovery',
  );

  assert(
    !deriveIllnessRecoveryWeekMode({
      temporarySourceFacts: [severeIllness(NEXT_WEEK)], weekStartISO: WEEK,
    }),
    'a severe illness fact for a DIFFERENT week must NOT derive illness_recovery for this week',
  );
});

// ── Invariant 3 — a normal week's §18 contract is completely unaffected by the
// illness_recovery machinery. With no override, the in-season game-week contract
// keeps its mode and §18 minimums exactly as before the feature.
run('3 normal week unaffected: no override leaves the in-season contract identical', () => {
  const normal = buildWeeklyExposureContract(inSeasonContractInput(undefined));
  assert(normal.identity.mode === 'in_season_game_week',
    `normal in-season game week must stay in_season_game_week, got ${normal.identity.mode}`);
  assert(normal.strength.required === 2,
    `normal game-week strength minimum must be unchanged (2), got ${normal.strength.required}`);
  assert(normal.conditioning.required >= 3,
    `normal game-week conditioning minimum must be unchanged (>=3), got ${normal.conditioning.required}`);
});

// ── Invariant 4 — the mode's own generated week validates structurally. A severe
// illness fact makes the week illness_recovery, its §18 minimums are lifted, and
// the generated recovery week is ACCEPTED by the gateway (never rejected for a
// minimum it no longer requires).
run('4 mode validates structurally: illness_recovery contract lifts minimums', () => {
  const contract = buildWeeklyExposureContract(inSeasonContractInput('illness_recovery'));
  assert(contract.identity.mode === 'illness_recovery',
    `weekModeOverride must mint illness_recovery, got ${contract.identity.mode}`);
  assert(contract.strength.required === 0,
    `illness_recovery must lift the strength minimum to 0, got ${contract.strength.required}`);
  assert(contract.conditioning.required === 0,
    `illness_recovery must lift the conditioning minimum to 0, got ${contract.conditioning.required}`);
  assert(contract.sprintCod.required === 0,
    `illness_recovery must lift the sprint minimum to 0, got ${contract.sprintCod.required}`);
});

run('4b mode validates structurally: the generated illness_recovery week is accepted', () => {
  const week = generateWithIllness(true);
  assert(week.exposureContract?.identity.mode === 'illness_recovery',
    `a seeded severe illness fact must derive an illness_recovery week, got ${week.exposureContract?.identity.mode}`);
  const result = quiet(() => runSection18AcceptedWeekGateway({
    contract: week.exposureContractV2!, workouts: week.workouts, weekStart: WEEK,
    profile: profile(), resolveVisibleWorkouts: (workouts) => [...workouts], maxRepairAttempts: 1,
  }));
  assert(result.status !== 'impossible',
    `the mode's own generated week must validate structurally, got status=${result.status} (${result.failureSignature ?? ''})`);
});

// ── Invariant 2 — the mode is a pure cascade off the fact: clearing the fact
// restores the normal §18 contract BYTE-IDENTICAL, with ZERO residue. Tested at
// the deterministic composition boundary this unit owns (the derived mode is the
// sole injection). The full generated-week store restore is the device-pass gate.
run('2 cascade: clearing the severe illness fact restores the normal contract byte-identical', () => {
  const baseline = buildWeeklyExposureContract(inSeasonContractInput(undefined));
  const withIllness = buildWeeklyExposureContract(inSeasonContractInput('illness_recovery'));
  assert(withIllness.identity.mode === 'illness_recovery',
    'precondition: the override must mint illness_recovery');
  assert(JSON.stringify(withIllness) !== JSON.stringify(baseline),
    'precondition: illness_recovery must actually change the contract');
  // Clearing the fact clears the override (deriveIllnessRecoveryWeekMode → false).
  const cleared = buildWeeklyExposureContract(inSeasonContractInput(undefined));
  assert(JSON.stringify(cleared) === JSON.stringify(baseline),
    'clearing the fact must restore the normal contract byte-identical (no residue)');

  // And the derivation cascade itself: fact present → override; fact gone → none.
  const facts = [createTemporaryIllnessFact({
    observedDate: WEEK, scope: weekScope(WEEK), severity: 'severe',
    sourceSurface: 'week_readiness_sheet',
  })];
  assert(deriveIllnessRecoveryWeekMode({ temporarySourceFacts: facts, weekStartISO: WEEK }),
    'fact present must derive the mode');
  assert(!deriveIllnessRecoveryWeekMode({ temporarySourceFacts: [], weekStartISO: WEEK }),
    'fact cleared must derive no mode (cascade back to normal)');
});

// ── Invariant 5 — MODE-LEVEL optional tier (finding #3, Sam 2026-07-24). In an
// optional-only week mode, every surviving session is stamped tier 'optional' at
// authoring, regardless of session type (strength, team-training, conditioning) —
// "nothing will be required this week", no carve-outs. Games are fixtures, untouched.
// This is the same everywhere: game week AND non-game week (it is NOT the finding #4
// game-proximity re-tiering — that was projection; this is authoring).
run('5 illness_recovery GAME week: every surviving session is optional (team days included)', () => {
  const mc = generateWithIllness(true, true) as unknown as GenMicro;
  assert(mc.exposureContract?.identity?.mode === 'illness_recovery',
    `precondition: illness_recovery mode, got ${mc.exposureContract?.identity?.mode}`);
  assertEverySurvivingSessionOptional(mc, 'illness_recovery game');
});

run('5b illness_recovery NON-game week: every surviving session is optional', () => {
  const mc = generateWithIllness(true, false) as unknown as GenMicro;
  assert(mc.exposureContract?.identity?.mode === 'illness_recovery',
    `precondition: illness_recovery mode, got ${mc.exposureContract?.identity?.mode}`);
  assertEverySurvivingSessionOptional(mc, 'illness_recovery non-game');
});

// ── Invariant 6 — TYPE-AGNOSTIC (this is what makes the fix mode-level, and what the
// sibling optional-only modes rely on). The stamp is a single unconditional pass over the
// surviving plan inside `if (optionalOnlyMode)` (coachingEngine.ts, one branch shared by
// illness_recovery / in_season_bye_recovery / early_offseason, no per-mode or per-type
// branching). Prove it carves out NO session type: the illness_recovery week keeps sessions
// of different types (a strength/Mixed day AND a team-training day) and BOTH are optional —
// so the same guarantee holds for the siblings that share the branch. (Full generation of
// bye_recovery / early_offseason needs multi-week/season-model context not built here — see
// the diagnosis doc / report NOT-COVERED.)
run('6 mode-level stamp is type-agnostic: strength AND team sessions both render optional', () => {
  const mc = generateWithIllness(true, true) as unknown as GenMicro;
  const worked = mc.workouts.filter((w) => w.workoutType !== 'Rest' && w.workoutType !== 'Game');
  const strengthLike = worked.filter((w) => w.workoutType === 'Mixed' || w.workoutType === 'Strength');
  const teamLike = worked.filter((w) => w.workoutType === 'Team Training');
  assert(strengthLike.length > 0 && teamLike.length > 0,
    `precondition: the reduced week must keep a strength-type AND a team session to prove ` +
    `type-agnosticism; got types ${worked.map((w) => w.workoutType).join(', ')}`);
  assert(strengthLike.every((w) => w.sessionTier === 'optional'),
    `a surviving STRENGTH session was not optional: ${strengthLike.map((w) => `${w.workoutType}/${w.sessionTier}`).join(', ')}`);
  assert(teamLike.every((w) => w.sessionTier === 'optional'),
    `a surviving TEAM session was not optional: ${teamLike.map((w) => `${w.workoutType}/${w.sessionTier}`).join(', ')}`);
});

console.log(`\nillness_recovery week-mode invariants: ${passes} passing, ${failures.length} failing`);
if (failures.length > 0) {
  console.log('Currently RED (expected pre-implementation):');
  for (const name of failures) console.log(`  - ${name}`);
}
process.exit(failures.length > 0 ? 1 : 0);
