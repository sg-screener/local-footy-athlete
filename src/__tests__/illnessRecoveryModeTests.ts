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
import {
  deriveIllnessRecoveryWeekMode,
  deriveIllnessWeekDirective,
} from '../rules/illnessRecoveryWeekMode';
import { resolveDoorDeloadPolicy } from '../rules/deloadWeekRules';
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

// Engine-validate runs regardless of __DEV__ (logger.error always emits — logger.ts
// shouldEmitLog), so a headless suite CAN see the invariants the DEV LogBox surfaces. This
// captures any '[ENGINE-VALIDATE] INVARIANT VIOLATION' while suppressing other console noise,
// so test:bible catches the class that the device red-boxed (closing the __DEV__ gap).
let lastEngineViolations: string[] = [];
function captureEngineValidate<T>(body: () => T): T {
  const warn = console.warn; const error = console.error; const log = console.log;
  lastEngineViolations = [];
  console.warn = () => undefined;
  console.log = () => undefined;
  console.error = (...args: unknown[]) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (/\[ENGINE-VALIDATE\][^]*INVARIANT VIOLATION/i.test(msg)) lastEngineViolations.push(msg);
  };
  try { return body(); } finally { console.warn = warn; console.error = error; console.log = log; }
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
  const program = captureEngineValidate(() => generateProgramLocally(athlete, {
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

type GenRow = {
  prescribedSets?: number;
  section18Evidence?: { role?: string };
};
type GenWorkout = {
  dayOfWeek: number;
  workoutType?: string;
  sessionTier?: string;
  exercises?: GenRow[];
};
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

function inSeasonContractInput(weekModeOverride?: 'optional_week') {
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
        observedDate: WEEK, scope: dateScope(WEEK), severity: 'mild',
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
  const contract = buildWeeklyExposureContract(inSeasonContractInput('optional_week'));
  assert(contract.identity.mode === 'optional_week',
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
  assert(week.exposureContract?.identity.mode === 'optional_week',
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
  const withIllness = buildWeeklyExposureContract(inSeasonContractInput('optional_week'));
  assert(withIllness.identity.mode === 'optional_week',
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
  assert(mc.exposureContract?.identity?.mode === 'optional_week',
    `precondition: illness_recovery mode, got ${mc.exposureContract?.identity?.mode}`);
  assertEverySurvivingSessionOptional(mc, 'illness_recovery game');
});

run('5b illness_recovery NON-game week: every surviving session is optional', () => {
  const mc = generateWithIllness(true, false) as unknown as GenMicro;
  assert(mc.exposureContract?.identity?.mode === 'optional_week',
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

// ── Invariant 7 — the mode-level optional stamp must be CONSISTENT with the in-season
// coverage validation (finding #3 device pass, Sam 2026-07-24). An optional-only week is
// "nothing required", so the in-season game-week coverage validation must not (a) log an
// ENGINE-VALIDATE INVARIANT VIOLATION for missing lower/upper/full-body exposure, nor (b)
// emergency-promote an optional session back to core (that would fight the mode). Engine-
// validate runs headless here (logger.error always emits) — this is the gate that keeps
// DEV-only validation from diverging from test:bible.
run('7 optional-only week: no engine-validate coverage violation AND no emergency promotion', () => {
  const mc = generateWithIllness(true, true) as unknown as GenMicro;
  assert(mc.exposureContract?.identity?.mode === 'optional_week',
    `precondition: illness_recovery mode, got ${mc.exposureContract?.identity?.mode}`);
  assert(lastEngineViolations.length === 0,
    `optional-only week logged engine-validate coverage violation(s): ${lastEngineViolations.join(' | ')}`);
  const promotedCore = mc.workouts.filter((w) =>
    w.sessionTier === 'core' && w.workoutType !== 'Rest' && w.workoutType !== 'Game');
  assert(promotedCore.length === 0,
    `emergency promotion forced a session back to core in an optional-only week: ` +
    promotedCore.map((w) => `dow${w.dayOfWeek}:${w.workoutType}`).join(', '));
});

// ── Invariant 8 (THE ILLNESS LAW, Sam 2026-07-27) — the illness week is THE WEEK
// THE ATHLETE WOULD HAVE HAD, with nothing required.
//
// The mode used to REPLACE the phase contract with a hand-written one carrying its
// own counts (strength max 2, one sprint, four rest days). Those are illness-specific
// numbers, which the law forbids: "severity decides exactly TWO things — deload or
// not, optional or not. No other illness-specific numbers may exist." They are also
// COUNTS, and the deload law holds counts constant — "same week, same days: the
// structure does not change, the work shrinks."
//
// So the mode DECORATES the normal week rather than replacing it. Structure is
// identical to the week that would otherwise have been built; only the minimums drop
// to zero and the selection becomes optional. The work shrinks by DELOAD_LAW, which
// is a dose transformation and does not live here.
run('8 illness week PRESERVES the structure of the week it replaced', () => {
  const normal = buildWeeklyExposureContract(inSeasonContractInput(undefined));
  const ill = buildWeeklyExposureContract(inSeasonContractInput('optional_week'));

  assert(ill.identity.mode === 'optional_week',
    `precondition: illness_recovery mode, got ${ill.identity.mode}`);

  for (const domain of ['strength', 'conditioning', 'sprintCod'] as const) {
    assert(ill[domain].preferred.max === normal[domain].preferred.max,
      `${domain} preferred.max changed: the illness week invented its own count ` +
      `(${ill[domain].preferred.max}) instead of keeping the week's structure ` +
      `(${normal[domain].preferred.max})`);
  }
});

run('8b illness week lifts every minimum — the law\'s "optional" flag', () => {
  const ill = buildWeeklyExposureContract(inSeasonContractInput('optional_week'));
  for (const domain of ['strength', 'conditioning', 'sprintCod'] as const) {
    assert(ill[domain].required === 0,
      `${domain}.required must be 0 in an optional week, got ${ill[domain].required}`);
  }
});

// ── Invariant 9 (THE DELOAD/OPTIONAL OWNER, Sam 2026-07-27) — the week-mode
// subsystem IS the illness law's implementation. It answers the law's two
// questions and nothing else, for all three tiers, and `illness_recovery` is
// DERIVED from the second answer rather than minted beside it.
run('9 the week derivation answers the law\'s two questions, per tier', () => {
  const tierFacts = (severity: 'mild' | 'moderate' | 'severe') => [createTemporaryIllnessFact({
    observedDate: WEEK, scope: weekScope(WEEK), severity,
    sourceSurface: 'week_readiness_sheet',
  })];

  const expected = {
    mild: { deloaded: false, sessionsOptional: false },
    moderate: { deloaded: true, sessionsOptional: false },
    severe: { deloaded: true, sessionsOptional: true },
  } as const;

  for (const tier of ['mild', 'moderate', 'severe'] as const) {
    const directive = deriveIllnessWeekDirective({
      temporarySourceFacts: tierFacts(tier), weekStartISO: WEEK,
    });
    assert(directive.deloaded === expected[tier].deloaded,
      `${tier}.deloaded: expected ${expected[tier].deloaded}, got ${directive.deloaded}`);
    assert(directive.sessionsOptional === expected[tier].sessionsOptional,
      `${tier}.sessionsOptional: expected ${expected[tier].sessionsOptional}, ` +
      `got ${directive.sessionsOptional}`);
  }
});

// The regression this closes: with the illness-private numbers deleted (C2) and
// nothing marking the week deloaded, a severe-illness week would be NORMAL DOSE
// and merely optional. Sam: "never normal-dose optional." MODERATE is the tier
// that proves deload and optional are genuinely independent — it deloads
// without lifting a single minimum.
run('9b an in-season SEVERE illness week is deloaded AND optional', () => {
  const severe = deriveIllnessWeekDirective({
    temporarySourceFacts: [createTemporaryIllnessFact({
      observedDate: WEEK, scope: weekScope(WEEK), severity: 'severe',
      sourceSurface: 'week_readiness_sheet',
    })],
    weekStartISO: WEEK,
  });
  assert(severe.deloaded && severe.sessionsOptional,
    `severe illness must be deloaded AND optional, got ${JSON.stringify(severe)}`);

  // In-season is the phase illness_recovery is minted in, and the door has no
  // phase gate — otherwise this week could never deload at all (D16).
  const policy = resolveDoorDeloadPolicy({ door: 'illness', seasonPhase: 'In-season' });
  assert(policy?.weekKind === 'deload',
    'the illness door must open a deload in-season');
});

run('9c the illness_recovery MODE is derived from the law, not minted beside it', () => {
  const moderate = [createTemporaryIllnessFact({
    observedDate: WEEK, scope: weekScope(WEEK), severity: 'moderate',
    sourceSurface: 'week_readiness_sheet',
  })];
  // Moderate deloads but does NOT lift minimums, so it must NOT mint the
  // optional-only week mode. This is the pair coming apart, exactly as authored.
  assert(!deriveIllnessRecoveryWeekMode({ temporarySourceFacts: moderate, weekStartISO: WEEK }),
    'moderate illness must not mint the optional-only illness_recovery mode');
  assert(deriveIllnessWeekDirective({ temporarySourceFacts: moderate, weekStartISO: WEEK }).deloaded,
    'moderate illness must still deload the week');
});

// ── Invariant 10 — the deload REACHES the generated week, not just the
// derivation. Sam: "never normal-dose optional." Deriving `weekDeloaded` and
// then failing to consume it looks identical to not deriving it at all, which
// is exactly the failure this pins.
run('10 an in-season severe-illness week GENERATES as a deload', () => {
  const mc = generateWithIllness(true, true) as unknown as GenMicro & {
    weekKind?: string; deloadDoor?: string;
  };
  assert(mc.exposureContract?.identity?.mode === 'optional_week',
    `precondition: illness_recovery mode, got ${mc.exposureContract?.identity?.mode}`);
  // RE-POINTED at the owner, not the proxy. This asserted `weekKind === 'deload'`,
  // which was how a door deload used to be carried: generation overwrote the
  // block plan's `weekKind`. That is the week's STRUCTURE — the block's own
  // statement of what this week is — and an athlete-declared deload is not a
  // schedule change; overwriting it also collided with the approved
  // first-four-Off-season-weeks no-deload rule. The door is now carried as
  // `deloadDoor`, which is what `resolveDoorDeloadPolicy` reads to apply the
  // dose.
  //
  // What the invariant is FOR is unchanged and is what it now asserts directly:
  // "normal-dose optional is the regression this pins." So it checks the door is
  // recorded AND that the dose actually shrank, rather than trusting either
  // proxy to imply it.
  assert(mc.deloadDoor === 'illness',
    `severe illness must record the deload door, got deloadDoor=${String(mc.deloadDoor)} ` +
    '(normal-dose optional is the regression this pins)');
  const healthy = generateWithIllness(false, true) as unknown as GenMicro;
  const mainLiftSets = (week: GenMicro): number => Math.max(0, ...(week.workouts ?? [])
    .flatMap((workout) => (workout.exercises ?? [])
      .filter((entry) => entry.section18Evidence?.role === 'main_strength')
      .map((entry) => entry.prescribedSets ?? 0)));
  assert(mainLiftSets(mc) < mainLiftSets(healthy),
    `the illness week must arrive at a DELOADED dose, got ${mainLiftSets(mc)} ` +
    `main-lift sets vs ${mainLiftSets(healthy)} healthy`);
});

run('10b a healthy in-season week is NOT deloaded', () => {
  const mc = generateWithIllness(false, true) as unknown as GenMicro & { weekKind?: string };
  assert(mc.weekKind !== 'deload',
    `a healthy week must not be deloaded, got weekKind=${String(mc.weekKind)}`);
});

console.log(`\nillness_recovery week-mode invariants: ${passes} passing, ${failures.length} failing`);
if (failures.length > 0) {
  console.log('Currently RED (expected pre-implementation):');
  for (const name of failures) console.log(`  - ${name}`);
}
process.exit(failures.length > 0 ? 1 : 0);
