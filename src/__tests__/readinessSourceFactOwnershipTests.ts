/**
 * Readiness / source-fact OWNERSHIP INVARIANTS (Group-B item 2).
 *
 * Encodes the Q7 invariants from
 * docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md. They describe the
 * CORRECT post-fix behaviour for the "I'm not 100%" → "Just a bit tired today"
 * readiness path, so the behaviour-change invariants are expected to FAIL on the
 * current architecture — that failure is what proves each test pins the bug it
 * targets. The fix (parts a/b/c) turns them green.
 *
 * Ground truth (seed `standard-in-season-week`, anchor Mon 2026-07-13), driven
 * through the REAL durable path `executeProgramControlActionDurably` on a
 * production-faithful accepted context (normalized + a real acceptance commit —
 * this fidelity is load-bearing: an un-normalized seed makes the durable
 * rollback-fidelity check throw a false `accepted_state_rollback_mismatch`, the
 * artifact the reassessment's "characterization correction" withdrew as Defect 3).
 *
 * Run: npm run test:readiness-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { OnboardingData } from '../types/domain';
import type { TemporarySourceFact } from '../rules/temporarySourceFact';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { seedManualOverride } from './support/programOverrideHarness';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { commitAcceptedStateTransaction } from '../store/acceptedStateTransaction';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { isInjurySourceFact, createTemporaryFatigueFact, createTemporaryIllnessFact, composeTemporarySourceFactCompatibility, isTemporarySourceFactConstraint } from '../rules/temporarySourceFact';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import { resolveWeekWithConditioning, addDays } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { applyLighterDayTrim } from '../utils/lighterDayTrim';
import { buildDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { seedOnboardingProgram } from '../utils/onboardingCompletion';
import { deriveStoredBlockStateFromProgram } from '../utils/programBlockState';
import { applyLighterDayForToday } from '../utils/lighterDayTransaction';
import { applyPlanChange, previewPlanChangeRisk } from '../utils/planChangeProducer';

const WEEK = '2026-07-13';
const SATURDAY = '2026-07-18';

/**
 * The week-screen readiness entry, as Sam wrote it.
 *
 * SIGNED BY RULING 4, `docs/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md`:
 * '"I\'m not 100%" becomes "I\'m sick/flat today" on this screen.' The pin is
 * a NAMED constant now rather than a bare literal in two suites, so the next
 * rename is one edit and a red cell rather than a scavenger hunt.
 */
const WEEK_READINESS_ENTRY_LABEL = "I'm sick/flat today";

const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.includes('[ProgramGen]') || first.includes('[WorkoutCanonicalisation]') ||
      first.includes('[Coach') || first.includes('[coach-mutation-transaction]')) return;
  originalWarn(...args);
};

let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passes += 1;
    console.log(`  PASS [invariant] ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`);
  }
}

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

/** Seed `standard-in-season-week` with a PRODUCTION-FAITHFUL accepted context. */
function seed(athlete: OnboardingData = profile()): void {
  const program = quiet(() => generateProgramLocally(athlete, {
    todayISO: WEEK,
    previousProgram: null,
    activeConstraints: [],
    readinessSignal: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: athlete.seasonPhase!,
      phaseEntryWeekStartISO: WEEK,
      originProvenance: 'explicit_user_phase_change',
    },
  }));
  const marks = { [SATURDAY]: 'game' as const };
  useCalendarStore.setState({ markedDays: marks, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: normalizeAcceptedMaterialContext({
      markedDays: marks,
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      revision: 1,
      lastTransaction: 'readiness-ownership-test:seed',
    }),
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as never);
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  // Faithful acceptance — establishes acceptedCompositionBase + profile snapshot
  // exactly as programStore's `program:hydration_acceptance` does.
  quiet(() => commitAcceptedStateTransaction({
    reason: 'readiness-ownership-test:acceptance',
    profile: athlete,
    validateWeekStarts: [WEEK],
  } as never));
}

/** The exact "Just a bit tired today" action (Program screen). */
async function reportTiredToday(scope: 'today_only' | 'current_week' = 'today_only') {
  return executeProgramControlActionDurably({
    type: 'set_fatigue_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope,
    payload: {
      date: WEEK,
      todayISO: WEEK,
      level: scope === 'current_week' ? 'cooked' : 'low_energy',
    },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as never, { todayISO: WEEK });
}

function activeReadinessFacts(): TemporarySourceFact[] {
  const facts = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext).temporarySourceFacts;
  return facts.filter((fact) => !isInjurySourceFact(fact) && fact.status === 'active' &&
    'factKind' in fact &&
    (fact.factKind === 'fatigue' || fact.factKind === 'soreness' ||
      fact.factKind === 'poor_sleep' || fact.factKind === 'illness'));
}

function activeIllnessFacts(): TemporarySourceFact[] {
  const facts = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext).temporarySourceFacts;
  return facts.filter((fact) => !isInjurySourceFact(fact) && fact.status === 'active' &&
    'factKind' in fact && fact.factKind === 'illness');
}

/** DEVICE-EXACT seed install — establishes a real `acceptedCompositionBase` the way
 *  the dev E2E reset does (`seedOnboardingProgram` + `commitAcceptedStateTransaction`,
 *  `preserveExactAcceptedWorkouts`). This fidelity is load-bearing: the device-only
 *  `accepted_composition_base_changed_by_temporary_fact` rejection only reproduces
 *  when a real composition base exists (the R1-style `seed()` leaves it null). */
function seedDeviceExact(): string {
  const dseed = buildDevE2ESeed('standard-in-season-week');
  const validateWeekStarts = dseed.program.microcycles.map((m) => m.startDate.slice(0, 10));
  quiet(() => seedOnboardingProgram({
    onboardingData: dseed.profile,
    program: dseed.program,
    todayISO: dseed.anchorDate,
    programStore: {
      setCurrentProgram: (program) => { commitAcceptedStateTransaction({
        reason: 'readiness-ownership-test:device-exact-install',
        program: { currentProgram: program, currentMicrocycle: null, todayWorkout: null,
          blockState: deriveStoredBlockStateFromProgram(program) },
        profile: dseed.profile, preserveExactAcceptedWorkouts: true, validateWeekStarts,
      } as never); },
      setCurrentMicrocycle: (m) => commitAcceptedStateTransaction({
        reason: 'readiness-ownership-test:device-exact-mc', program: { currentMicrocycle: m },
        profile: dseed.profile, preserveExactAcceptedWorkouts: true,
        validateWeekStarts: m ? [m.startDate.slice(0, 10)] : [],
      } as never),
      setTodayWorkout: (w) => commitAcceptedStateTransaction({
        reason: 'readiness-ownership-test:device-exact-today', program: { todayWorkout: w },
        profile: dseed.profile, preserveExactAcceptedWorkouts: true,
        validateWeekStarts: [dseed.anchorDate],
      } as never),
    },
    calendarStore: { setGameDay: () => undefined },
  } as never));
  useProfileStore.setState({ onboardingData: dseed.profile, isOnboardingComplete: true });
  return dseed.anchorDate;
}

async function main(): Promise<void> {
  // ── Invariant R1 (characterization baseline, part-c scope): the contextual
  // fatigue write is NOT blocked. The reassessment's "characterization
  // correction" withdrew Defect 3; this pins that the fact commits + persists so
  // no regression re-introduces a write-path rejection. Expected GREEN today.
  await run('R1 characterization: a tired-today fatigue fact commits ok:true and persists', async () => {
    seed();
    const result = await reportTiredToday('today_only');
    assert((result as { ok?: boolean }).ok === true,
      `fatigue write was rejected (regression of the withdrawn Defect 3): "${(result as { message?: string }).message}"`);
    const facts = activeReadinessFacts();
    assert(facts.length === 1,
      `fatigue fact did not persist in temporarySourceFacts (count=${facts.length})`);
    assert(facts[0].factKind === 'fatigue', `persisted fact is not fatigue: ${facts[0].factKind}`);
  });

  // ── Invariant R2 (part b — card read-alignment): after a committed fatigue
  // fact, the visible readiness label reflects "tired today" DERIVED FROM THE
  // CANONICAL FACT. RED today: the component reads legacy tap-* ids +
  // `readiness_signal` program modifiers, neither of which a fatigue fact
  // produces, so the label stays "I'm not 100%".
  await run('R2 read-alignment: tired-today flips the card via the canonical fact projection', async () => {
    seed();
    const result = await reportTiredToday('today_only');
    assert((result as { ok?: boolean }).ok === true, 'precondition: fatigue write must commit');
    const readinessFacts = activeReadinessFacts();
    // The new pure seam the fix introduces: label state is a pure projection of
    // the canonical readiness facts (+ legacy recovery-mode constraints), NOT of
    // the tap-* id scheme the fatigue fact never emits.
    const mod = require('../utils/visibleReadinessState') as {
      resolveVisibleReadinessState: (input: unknown) => { id: string; scope: 'today' | 'week'; isRecovery: boolean } | null;
    };
    const state = mod.resolveVisibleReadinessState({
      readinessFacts,
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints ?? [],
      weekAnchorISO: WEEK,
      todayISO: WEEK,
      isThisWeek: true,
    });
    assert(state !== null,
      'card did not flip: resolveVisibleReadinessState returned null for an active tired-today fact');
    assert(state!.scope === 'today',
      `today_only fatigue should read as a today-scoped label, got scope=${state!.scope}`);
    assert(state!.isRecovery === false, 'fatigue is not recovery mode');
  });

  // ── Invariant R3 (part a — unconditional acknowledgment): a readiness report
  // always yields an athlete-facing acknowledgment, independent of
  // `requiresRebuild` and independent of `ok`. RED today: the acknowledgment
  // seam does not exist, and the handler discards `result.message` via the
  // `!requiresRebuild` early-return, so the sheet closes silently.
  await run('R3 unconditional-ack: a readiness report is always acknowledged (ok and not-ok, no rebuild)', async () => {
    seed();
    const okResult = await reportTiredToday('today_only');
    assert((okResult as { ok?: boolean; requiresRebuild?: boolean }).requiresRebuild === false,
      'precondition: the readiness action is requiresRebuild:false (the case the old handler dropped)');
    const mod = require('../utils/readinessAcknowledgment') as {
      buildReadinessAcknowledgment: (r: unknown) => { tone: 'success' | 'error'; message: string } | null;
    };
    const okAck = mod.buildReadinessAcknowledgment(okResult);
    assert(okAck !== null && okAck.message.trim().length > 0,
      'no acknowledgment for a successful tired-today report (silent close)');
    assert(okAck!.tone === 'success', `successful report should acknowledge success, got tone=${okAck!.tone}`);

    // A failed contextual report must be acknowledged honestly, never silence.
    const failResult = {
      ok: false, changedProgram: false, requiresRebuild: false,
      message: 'The report was not applied because the visible program could not be verified.',
    };
    const failAck = mod.buildReadinessAcknowledgment(failResult);
    assert(failAck !== null && failAck.message.trim().length > 0,
      'no acknowledgment for a failed report — the athlete must not be left in silence');
    assert(failAck!.tone === 'error', `failed report should acknowledge honestly, got tone=${failAck!.tone}`);
  });

  // ── Invariant R4 (part c — the Bible §9 "slight" trim transform, verbatim):
  // keep the main lift intact (sets AND weight), halve accessory volume, remove
  // the hard finisher, ease hard conditioning; session stays intact. RED today:
  // the transform does not exist. (Pure-function test — synthetic + real MON.)
  await run('R4 trim-transform: slight-tier lighter day keeps the main lift, trims accessories + finisher + hard conditioning', async () => {
    const mod = require('../utils/lighterDayTrim') as {
      applyLighterDayTrim: (w: unknown) => { workout: any; changes: string[] };
    };

    // Synthetic day: 1 main lift (4 sets @ 100kg), 2 accessories, a hard-conditioning finisher.
    const synthetic = {
      id: 'w-synthetic', name: 'Lower Body Strength', workoutType: 'Strength', sessionTier: 'core',
      dayOfWeek: 1, date: WEEK, hasCombinedConditioning: true,
      conditioningBlock: { intent: 'high-intensity', attachedKind: 'finisher', options: [{ title: 'Hard Bike Finisher' }] },
      exercises: [
        { exerciseId: 'ex-squat', exercise: { name: 'Back Squat' }, prescribedSets: 4, prescribedRepsMin: 3, prescribedRepsMax: 4, prescribedWeightKg: 100, section18Evidence: { role: 'main_strength' } },
        { exerciseId: 'ex-rdl', exercise: { name: 'Romanian Deadlift' }, prescribedSets: 4, prescribedRepsMin: 8, prescribedRepsMax: 10, prescribedWeightKg: 80, section18Evidence: { role: 'strength_accessory' } },
        { exerciseId: 'ex-curl', exercise: { name: 'Bicep Curl' }, prescribedSets: 3, prescribedRepsMin: 10, prescribedRepsMax: 15, prescribedWeightKg: 20, section18Evidence: { role: 'strength_accessory' } },
      ],
    };
    const trimmed = mod.applyLighterDayTrim(synthetic);
    const byId = (w: any, id: string) => (w.exercises ?? []).find((r: any) => r.exerciseId === id);

    // Main lift byte-identical (sets AND weight kept — the locked methodology).
    const mainBefore = byId(synthetic, 'ex-squat');
    const mainAfter = byId(trimmed.workout, 'ex-squat');
    assert(mainAfter && mainAfter.prescribedSets === mainBefore.prescribedSets,
      `main lift sets must be kept: ${mainBefore.prescribedSets} -> ${mainAfter?.prescribedSets}`);
    assert(mainAfter.prescribedWeightKg === mainBefore.prescribedWeightKg,
      `main lift weight must be kept: ${mainBefore.prescribedWeightKg} -> ${mainAfter.prescribedWeightKg}`);
    // Accessories halved (4->2, 3->2), weight kept.
    assert(byId(trimmed.workout, 'ex-rdl').prescribedSets === 2, 'accessory RDL sets should halve 4->2');
    assert(byId(trimmed.workout, 'ex-curl').prescribedSets === 2, 'accessory curl sets should halve 3->2 (ceil)');
    assert(byId(trimmed.workout, 'ex-rdl').prescribedWeightKg === 80, 'accessory weight must be kept');
    // Hard finisher removed.
    assert(!trimmed.workout.conditioningBlock || trimmed.workout.conditioningBlock.attachedKind !== 'finisher',
      'hard finisher must be removed');
    // Session stays intact (not collapsed to rest), main lift still present.
    assert(trimmed.workout.workoutType !== 'Rest', 'session must stay intact (not rest)');
    assert(!!byId(trimmed.workout, 'ex-squat'), 'main lift must remain present');
    // Disclosure names each change.
    assert(Array.isArray(trimmed.changes) && trimmed.changes.length > 0, 'changes must name what was trimmed');

    // Real MON (Back Squat + Deadlift main_strength, Pallof trunk_support accessory).
    seed();
    const mon = useProgramStore.getState().currentProgram!.microcycles[0].days
      ? (useProgramStore.getState().currentProgram as any).microcycles[0].days.find((d: any) => (d.workout ?? d)?.name === 'Lower Body Strength')?.workout
      : undefined;
    const monWorkout = mon ?? (useProgramStore.getState().currentProgram as any).microcycles[0].workouts?.find((w: any) => w.name === 'Lower Body Strength');
    assert(monWorkout, 'precondition: seeded MON Lower Body Strength present');
    const trimmedMon = mod.applyLighterDayTrim(monWorkout);
    const squatBefore = (monWorkout.exercises ?? []).find((r: any) => r.exercise?.name === 'Back Squat');
    const squatAfter = (trimmedMon.workout.exercises ?? []).find((r: any) => r.exercise?.name === 'Back Squat');
    assert(squatAfter.prescribedSets === squatBefore.prescribedSets &&
      squatAfter.prescribedWeightKg === squatBefore.prescribedWeightKg,
      'real MON main lift (Back Squat) must be byte-identical');
    assert(trimmedMon.changes.length > 0, 'real MON trim must name a change (accessory volume)');
  });

  // ── Invariant R5 (part c — progression-baseline guard): a trimmed day must NOT
  // drag the athlete's future progression baseline down. The baseline builder
  // reads ONLY `weightOverrides`; the trim is applied as a `dateOverride`, so
  // next week's strength prescription must be byte-identical, and weightOverrides
  // must stay untouched. This is the "lighter loads are planned, not a
  // performance signal" guarantee, tested structurally.
  await run('R5 progression-guard: a trimmed today leaves next week\'s strength prescription byte-identical', () => {
    const nextMonday = addDays(WEEK, 7);
    const nextWeekStrengthWeights = (): Record<string, number> => {
      const week = resolveWeekWithConditioning(nextMonday, buildScheduleStateImperative());
      const out: Record<string, number> = {};
      for (const day of week) {
        for (const row of (day.workout?.exercises ?? []) as any[]) {
          if (typeof row.prescribedWeightKg === 'number') {
            out[`${day.date}:${row.exerciseId}`] = row.prescribedWeightKg;
          }
        }
      }
      return out;
    };

    seed();
    const control = nextWeekStrengthWeights();

    // Apply the lighter-day trim to TODAY as a dateOverride (the channel the
    // real action uses) — NOT a weightOverride.
    const monVisible = resolveWeekWithConditioning(WEEK, buildScheduleStateImperative())
      .find((day) => day.date === WEEK)?.workout;
    assert(monVisible, 'precondition: MON visible workout present');
    const trimmed = applyLighterDayTrim(monVisible as never);
    assert(trimmed.changes.length > 0, 'precondition: the trim actually changed today');
    seedManualOverride(WEEK, trimmed.workout as never, {
      intent: 'program_adjustment',
    } as never);

    // Guard against a vacuous pass: the override must actually be in effect this
    // week (fewer total strength sets on MON than before).
    const monBeforeSets = ((monVisible as { exercises?: any[] }).exercises ?? [])
      .reduce((sum, r) => sum + Number(r.prescribedSets ?? 0), 0);
    const monAfter = resolveWeekWithConditioning(WEEK, buildScheduleStateImperative())
      .find((day) => day.date === WEEK)?.workout;
    const monAfterSets = ((monAfter?.exercises ?? []) as any[])
      .reduce((sum, r) => sum + Number(r.prescribedSets ?? 0), 0);
    assert(monAfterSets < monBeforeSets,
      `override not in effect this week: MON sets ${monBeforeSets} -> ${monAfterSets}`);

    // The trim must never write the progression baseline channel.
    const weightOverrides = useProgramStore.getState().weightOverrides ?? {};
    assert(Object.keys(weightOverrides).length === 0,
      `trim wrote weightOverrides (would drag the baseline): ${JSON.stringify(Object.keys(weightOverrides))}`);

    // Next week's prescription is byte-identical — the reduced day is planned,
    // not a performance signal.
    const after = nextWeekStrengthWeights();
    const drifted = Object.keys(control).filter((key) => control[key] !== after[key]);
    assert(drifted.length === 0,
      `trimmed day dragged next week's baseline: ${JSON.stringify(drifted.map((k) => ({ k, from: control[k], to: after[k] })))}`);
  });

  // ── Invariant R6 (part c — single-owner, reversible, disclosed): accepting the
  // lighter-day offer applies TODAY's trim through the accepted-state transaction,
  // records ONE reversible-ledger entry, discloses exactly what changed, and undo
  // restores today. A prior tired-today fact + acknowledgment survive the undo
  // (declining/undoing the lighter day never clears the readiness signal).
  await run('R6 single-owner: lighter-day offer is transaction-owned, disclosed, and reversible (undo restores today)', async () => {
    const mod = require('../utils/lighterDayTransaction') as {
      applyLighterDayForToday: (a: { date: string; todayISO: string }) => Promise<{
        ok: boolean; message: string; changes: string[]; adjustmentId?: string;
      }>;
    };

    seed();
    // Report tired first — the offer follows an acknowledged readiness signal.
    const tired = await reportTiredToday('today_only');
    assert((tired as { ok?: boolean }).ok === true, 'precondition: tired-today fact commits');

    const todaySetsBefore = (): number =>
      (resolveWeekWithConditioning(WEEK, buildScheduleStateImperative())
        .find((day) => day.date === WEEK)?.workout?.exercises ?? [] as any[])
        .reduce((sum: number, r: any) => sum + Number(r.prescribedSets ?? 0), 0);
    const before = todaySetsBefore();

    const applied = await mod.applyLighterDayForToday({ date: WEEK, todayISO: WEEK });
    assert(applied.ok === true, `lighter-day apply failed: ${applied.message}`);
    assert(applied.changes.length > 0 && /\S/.test(applied.message),
      'lighter-day result must disclose exactly what changed');
    assert(!!applied.adjustmentId, 'lighter-day must record a reversible adjustment id');

    // Transaction-owned: exactly one reversible-ledger entry for today.
    const ledger = useProgramStore.getState().reversibleAdjustmentLedger.adjustments;
    const owned = ledger.filter((entry) => entry.affectedDates.includes(WEEK));
    assert(owned.length >= 1, 'no reversible adjustment recorded for today (not transaction-owned)');
    // Today is actually lighter now.
    const afterApply = todaySetsBefore();
    assert(afterApply < before, `today not trimmed: sets ${before} -> ${afterApply}`);

    // Undo restores today.
    const revision = useProgramStore.getState().acceptedMaterialContext.revision;
    const undo = await (require('../store/reversibleAdjustmentTransaction') as {
      clearReversibleAdjustment: (id: string, rev: number) => Promise<{ outcome: string }>;
    }).clearReversibleAdjustment(applied.adjustmentId!, revision);
    assert(['restored', 'recomposed'].includes(undo.outcome), `undo did not restore: ${undo.outcome}`);
    const afterUndo = todaySetsBefore();
    assert(afterUndo === before, `undo did not restore today's volume: ${before} -> ${afterUndo}`);

    // The readiness fact survives the lighter-day undo.
    assert(activeReadinessFacts().length === 1,
      'undoing the lighter day must not clear the tired-today readiness fact');
  });

  // ── Invariant R7 (Defect 3 fix, the seam): a minor-tier (severity < 4) fatigue
  // fact is RECORD-ONLY — it composes NO exposure-affecting active constraint,
  // while the readiness witness signal is preserved. Severe tiers (cooked, sev 8)
  // KEEP their constraint (auto-protect unchanged this branch). RED today: current
  // compose emits an ActiveFatigueConstraint for slight, which reaches the
  // exposure engine and perturbs the §18 signature (the device rejection source).
  await run('R7 record-only seam: minor-tier fatigue composes no active constraint; witness preserved; severe unchanged', () => {
    const dateScope = { kind: 'date' as const, date: WEEK, from: WEEK, until: WEEK };
    const slight = createTemporaryFatigueFact({
      observedDate: WEEK, scope: dateScope, athleteReportedLevel: 'slight',
      reportKind: 'fatigue', sourceSurface: 'week_readiness_sheet',
    });
    const composedSlight = composeTemporarySourceFactCompatibility({
      temporarySourceFacts: [slight], activeConstraints: [], readinessSignalsByDate: {},
    });
    const slightFatigueConstraints = (composedSlight.activeConstraints as any[])
      .filter((c) => c.type === 'fatigue');
    assert(slightFatigueConstraints.length === 0,
      `slight fatigue must be RECORD-ONLY (no active constraint), got ${slightFatigueConstraints.length}`);
    assert(!!composedSlight.readinessSignalsByDate[WEEK],
      'the readiness witness signal must still be produced for a record-only slight fact');

    // Severe (cooked, severity 8) keeps its auto-protect constraint — unchanged.
    const weekScope = { kind: 'week' as const, weekStart: WEEK, from: WEEK, until: addDays(WEEK, 6) };
    const cooked = createTemporaryFatigueFact({
      observedDate: WEEK, scope: weekScope, athleteReportedLevel: 'cooked',
      reportKind: 'cooked', sourceSurface: 'week_readiness_sheet',
    });
    const composedCooked = composeTemporarySourceFactCompatibility({
      temporarySourceFacts: [cooked], activeConstraints: [], readinessSignalsByDate: {},
    });
    const cookedFatigueConstraints = (composedCooked.activeConstraints as any[])
      .filter((c) => c.type === 'fatigue');
    assert(cookedFatigueConstraints.length >= 1,
      'severe (cooked) fatigue must KEEP its active constraint (auto-protect unchanged this branch)');
  });

  // ── Invariant R8 (Defect 3 fix, the outcome): committing a minor-tier fatigue
  // fact has ZERO derivation effect — the resolved week is byte-identical before
  // and after. "Just saying I'm tired" must not mutate the program (opt-in only).
  await run('R8 inert-resolution: a committed minor-tier fatigue fact leaves the resolved week byte-identical', async () => {
    seed();
    const signature = (): string => JSON.stringify(
      resolveWeekWithConditioning(WEEK, buildScheduleStateImperative())
        .map((day) => ({
          date: day.date,
          type: day.workout?.workoutType,
          ex: (day.workout?.exercises ?? []).map((r: any) => ({
            id: r.exerciseId, sets: r.prescribedSets, kg: r.prescribedWeightKg,
          })),
          cond: day.workout?.conditioningBlock?.attachedKind ?? null,
        })));
    const before = signature();
    const result = await reportTiredToday('today_only');
    assert((result as { ok?: boolean }).ok === true, 'precondition: fatigue write commits');
    const after = signature();
    assert(before === after,
      'a minor-tier fatigue fact changed the resolved week (it must be record-only / inert)');
  });

  // ── Invariant R9 (Defect 3 part 2 — non-mutation boundary): a contextual/inert
  // fact commit must succeed even when whole-week §18 re-validation WOULD reject the
  // week — the fact commits OFF the mutation boundary. Severe (deriving) facts stay
  // gated. The `beforeEffectiveValidation` test hook stands in for "the §18
  // whole-week gate rejects"; part 2 must not run it (nor the commit-time week
  // re-validation) for an inert fact. RED today: the inert commit runs the gate.
  await run('R9 non-mutation-boundary: an inert fact commits even when §18 validation would reject; severe stays gated', async () => {
    const dateScope = { kind: 'date' as const, date: WEEK, from: WEEK, until: WEEK };
    const weekScope = { kind: 'week' as const, weekStart: WEEK, from: WEEK, until: addDays(WEEK, 6) };
    const wouldReject = { beforeEffectiveValidation: () => { throw new Error('SIMULATED §18 whole-week rejection'); } };

    // Inert (minor-tier) fact: commits OFF the validation boundary despite the
    // would-reject hook.
    seed();
    const slight = createTemporaryFatigueFact({
      observedDate: WEEK, scope: dateScope, athleteReportedLevel: 'slight',
      reportKind: 'fatigue', sourceSurface: 'week_readiness_sheet',
    });
    const inert = await transactTemporarySourceFact({
      operation: 'create', fact: slight, todayISO: WEEK, testHooks: wouldReject,
    });
    assert(!/safely_rejected|conflicted/.test(inert.outcome),
      `inert fact must commit off the §18 mutation gate, got outcome=${inert.outcome}`);

    // Severe (cooked, deriving) fact: still runs validation — the would-reject hook
    // fails it (auto-protect tiers stay gated by §18).
    seed();
    const cooked = createTemporaryFatigueFact({
      observedDate: WEEK, scope: weekScope, athleteReportedLevel: 'cooked',
      reportKind: 'cooked', sourceSurface: 'week_readiness_sheet',
    });
    const severe = await transactTemporarySourceFact({
      operation: 'create', fact: cooked, todayISO: WEEK, testHooks: wouldReject,
    });
    assert(/safely_rejected/.test(severe.outcome),
      `severe fact must stay gated by §18 validation, got outcome=${severe.outcome}`);
  });

  // ── Invariant R10 (injury channel unaffected): the non-mutation-boundary skip
  // keys on source-fact constraints, and an injury constraint IS a source-fact
  // constraint — so an injury delta always changes the composition signature and
  // can never be misclassified as inert. Injury commits stay fully gated + owned by
  // their separate channel. (Guards the R9 inert-detection boundary.)
  await run('R10 injury-unaffected: an injury constraint is source-fact-owned (never inert)', () => {
    const injuryConstraint = {
      id: 'injury:knee:episode-1', type: 'injury', injuryEpisodeId: 'episode-1', status: 'active',
    };
    assert(isTemporarySourceFactConstraint(injuryConstraint as never) === true,
      'an injury constraint must be source-fact-owned so an injury delta is never inert');
    // A fatigue constraint carrying a source-fact id is likewise counted; only a
    // fact composing NO such constraint (minor-tier fatigue) can be inert.
    const fatigueConstraint = {
      id: 'source-fact:global:x:y', type: 'fatigue', temporarySourceFactIds: ['f1'], status: 'active',
    };
    assert(isTemporarySourceFactConstraint(fatigueConstraint as never) === true,
      'a source-fact fatigue constraint must be counted');
  });

  // ── Invariant R11 (device-exact repro of the real device failure): a minor-tier
  // fatigue fact must commit on a REAL accepted composition base. RED before the
  // fix: the commit re-canonicalises the accepted surfaces, changing the composition
  // base, and `verifyCandidate` rejects with
  // `accepted_composition_base_changed_by_temporary_fact` — the exact reason the
  // on-device probe captured. An inert fact must preserve the exact program base.
  await run('R11 device-exact: a slight fatigue fact commits on a real composition base (no base mutation)', async () => {
    const wk = seedDeviceExact();
    const scope = { kind: 'date' as const, date: wk, from: wk, until: wk };
    const slight = createTemporaryFatigueFact({
      observedDate: wk, scope, athleteReportedLevel: 'slight',
      reportKind: 'fatigue', sourceSurface: 'week_readiness_sheet',
    });
    let outcome = 'threw';
    let reason: string | undefined;
    try {
      const result = await transactTemporarySourceFact({ operation: 'create', fact: slight, todayISO: wk });
      outcome = result.outcome;
      reason = result.reason;
    } catch (error) {
      reason = (error as Error).message;
    }
    assert(!/safely_rejected|conflicted|threw/.test(outcome),
      `slight fatigue rejected on a real composition base: outcome=${outcome} reason=${reason}`);
    assert(activeReadinessFacts().length === 1,
      'the fatigue fact did not persist on a device-exact base');
  });

  // ── Invariant R12 (cascade undo): the disclosure promises "undo anytime".
  // Clearing the readiness fact must generically revert ANY reversible adjustment
  // linked to that fact (by RECORDED source-fact id, not heuristic), restoring the
  // accepted week byte-identical to pre-offer state — no lighter-day special case.
  // Also: a clear with no accepted trim is a no-op cascade; and clearing must never
  // touch an unlinked adjustment.
  await run('R12 cascade-undo: clearing the readiness fact reverts the linked trim (by recorded id), byte-identical', async () => {
    const monWeightSig = (): string => JSON.stringify(
      (resolveWeekWithConditioning(WEEK, buildScheduleStateImperative())
        .find((day) => day.date === WEEK)?.workout?.exercises ?? [] as any[])
        .map((r: any) => ({ id: r.exerciseId, sets: r.prescribedSets, kg: r.prescribedWeightKg })));
    const clearFatigue = (factId: string) => executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { modifierId: factId, date: WEEK },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    } as never, { todayISO: WEEK });
    const ledger = () => useProgramStore.getState().reversibleAdjustmentLedger.adjustments;

    // ── (1) main cascade ──────────────────────────────────────────────
    seed();
    const preOffer = monWeightSig();
    assert((await reportTiredToday('today_only') as { ok?: boolean }).ok === true, 'precondition: fact commits');
    const factId = activeReadinessFacts()[0].factId;
    const applied = await applyLighterDayForToday({ date: WEEK, todayISO: WEEK });
    assert(applied.ok && !!applied.adjustmentId, 'precondition: lighter-day trim applied');
    assert(monWeightSig() !== preOffer, 'precondition: the trim changed the week');
    const adj = ledger().find((a) => a.id === applied.adjustmentId);
    assert((adj as { sourceFactId?: string } | undefined)?.sourceFactId === factId,
      `link must resolve by RECORDED source-fact id, got ${(adj as { sourceFactId?: string } | undefined)?.sourceFactId}`);

    const cleared = await clearFatigue(factId);
    assert((cleared as { ok?: boolean }).ok === true, `clear failed: ${(cleared as { message?: string }).message}`);
    assert(activeReadinessFacts().length === 0, '(a) clear must remove the tired fact');
    const adjAfter = ledger().find((a) => a.id === applied.adjustmentId);
    assert(adjAfter && adjAfter.status !== 'active', '(b) linked adjustment must be reverted');
    assert(monWeightSig() === preOffer,
      '(b) accepted week must restore byte-identical to pre-offer state');

    // ── (2) no-op cascade: clear with no accepted trim just clears the fact ──
    seed();
    assert((await reportTiredToday('today_only') as { ok?: boolean }).ok === true, 'precondition');
    const factId2 = activeReadinessFacts()[0].factId;
    const activeAdjBefore = ledger().filter((a) => a.status === 'active').length;
    const cleared2 = await clearFatigue(factId2);
    assert((cleared2 as { ok?: boolean }).ok === true, 'no-op clear must still succeed');
    assert(activeReadinessFacts().length === 0, 'no-op cascade must still clear the fact');
    assert(ledger().filter((a) => a.status === 'active').length === activeAdjBefore,
      'no-op cascade must not create/clear any adjustment');

    // ── (3) unlinked adjustments untouched ───────────────────────────
    seed();
    assert((await reportTiredToday('today_only') as { ok?: boolean }).ok === true, 'precondition');
    const factId3 = activeReadinessFacts()[0].factId;
    await applyLighterDayForToday({ date: WEEK, todayISO: WEEK }); // linked to factId3
    // An UNRELATED reversible adjustment (empty-day add on WED — no source fact).
    const WEDNESDAY = addDays(WEEK, 2);
    const change = { kind: 'add_category' as const, date: WEDNESDAY, category: 'conditioning_light' as const };
    const week = resolveWeekWithConditioning(WEEK, buildScheduleStateImperative());
    const preview = previewPlanChangeRisk({ change, visibleWeek: week, todayISO: WEEK,
      profile: useProfileStore.getState().onboardingData ?? undefined });
    applyPlanChange({ change, visibleWeek: week, todayISO: WEEK, trace: preview.trace,
      applyOverride: (d, w, c) => seedManualOverride(d, w, c) });
    const unlinked = ledger().find((a) => a.affectedDates.includes(WEDNESDAY) && a.status === 'active');
    assert(!!unlinked, 'precondition: an unrelated WED adjustment exists');
    assert(!(unlinked as { sourceFactId?: string }).sourceFactId, 'the WED adjustment is not fact-linked');

    await clearFatigue(factId3);
    const unlinkedAfter = ledger().find((a) => a.id === (unlinked as { id: string }).id);
    assert(unlinkedAfter && unlinkedAfter.status === 'active',
      'clearing the fact must NOT touch an unlinked adjustment');
  });

  // ── Invariant R13 (illness severity doctrine — minor is INERT): a minor illness
  // fact is a sibling health fact that follows the same non-mutation boundary as
  // minor fatigue. It commits OFF the §18 mutation gate (record-only, zero
  // derivation) even when whole-week re-validation WOULD reject. The adjustment is
  // strictly opt-in via the "soften today?" offer.
  await run('R13 illness-inert: a minor illness fact commits off the §18 mutation gate', async () => {
    const dateScope = { kind: 'date' as const, date: WEEK, from: WEEK, until: WEEK };
    const wouldReject = { beforeEffectiveValidation: () => { throw new Error('SIMULATED §18 whole-week rejection'); } };
    seed();
    const minor = createTemporaryIllnessFact({
      observedDate: WEEK, scope: dateScope, severity: 'mild',
      sourceSurface: 'week_readiness_sheet',
    });
    const result = await transactTemporarySourceFact({
      operation: 'create', fact: minor, todayISO: WEEK, testHooks: wouldReject,
    });
    assert(!/safely_rejected|conflicted/.test(result.outcome),
      `minor illness fact must commit off the §18 mutation gate, got outcome=${result.outcome}`);
    assert(activeIllnessFacts().length === 1,
      `minor illness fact did not persist (count=${activeIllnessFacts().length})`);
  });

  // ── Invariant R14 (illness severity doctrine — severe is DERIVING): a severe
  // illness fact composes an auto-protect constraint, so it changes the composition
  // signature and can NEVER be misclassified inert — it stays gated by §18
  // validation exactly as severe fatigue does.
  await run('R14 illness-deriving: a severe illness fact stays gated by §18 validation', async () => {
    const weekScope = { kind: 'week' as const, weekStart: WEEK, from: WEEK, until: addDays(WEEK, 6) };
    const wouldReject = { beforeEffectiveValidation: () => { throw new Error('SIMULATED §18 whole-week rejection'); } };
    seed();
    const severe = createTemporaryIllnessFact({
      observedDate: WEEK, scope: weekScope, severity: 'severe',
      sourceSurface: 'week_readiness_sheet',
    });
    const result = await transactTemporarySourceFact({
      operation: 'create', fact: severe, todayISO: WEEK, testHooks: wouldReject,
    });
    assert(/safely_rejected/.test(result.outcome),
      `severe illness fact must stay gated by §18 validation, got outcome=${result.outcome}`);
    // The severity boundary is the shared one: a severe illness composes a
    // source-fact constraint (deriving), a minor one composes none (inert).
    const composed = composeTemporarySourceFactCompatibility({
      temporarySourceFacts: [createTemporaryIllnessFact({
        observedDate: WEEK, scope: weekScope, severity: 'severe',
        sourceSurface: 'week_readiness_sheet',
      })],
      activeConstraints: [],
    });
    assert(composed.activeConstraints.some((c) => isTemporarySourceFactConstraint(c)),
      'a severe illness fact must compose a source-fact (auto-protect) constraint');
    const inertCompose = composeTemporarySourceFactCompatibility({
      temporarySourceFacts: [createTemporaryIllnessFact({
        observedDate: WEEK, scope: { kind: 'date', date: WEEK, from: WEEK, until: WEEK },
        severity: 'mild', sourceSurface: 'week_readiness_sheet',
      })],
      activeConstraints: [],
    });
    assert(!inertCompose.activeConstraints.some((c) => isTemporarySourceFactConstraint(c)),
      'a minor illness fact must compose NO source-fact constraint (inert)');
  });

  // ── Invariant R15 (bed-ridden = severe illness through the standard deriving
  // path): the readiness sheet's "Sick / run down" tier commits a SEVERE illness
  // week-fact through the durable path — the same one the tap surface calls. On a
  // normal in-season week this is now ACCEPTED (never safely_rejected): the deriving
  // commit AUTHORS a scoped-regen illness_recovery week overlay. Re-pointed (Group D
  // scoped-regen): the assertion is that the COMMITTED accepted week is
  // illness_recovery — not a separate regeneration — proving delivery, not just
  // derivability. No shutdown_week, no recovery-mode writer.
  await run('R15 bed-ridden: the COMMITTED accepted week is authored illness_recovery', async () => {
    seed();
    const result = await executeProgramControlActionDurably({
      type: 'set_illness_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: { date: WEEK, todayISO: WEEK, severity: 'severe' },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    } as never, { todayISO: WEEK });
    assert(result.ok && !/safely_rejected|conflicted/.test(result.message ?? ''),
      `bed-ridden severe illness must be accepted, got ok=${result.ok} message="${result.message}"`);
    assert(/nothing's required|optional/i.test(result.message ?? ''),
      `bed-ridden must disclose the optional/nothing-required recovery week, got "${result.message}"`);
    assert(activeIllnessFacts().some((fact) => 'severity' in fact && fact.severity === 'severe'),
      'a severe illness fact must persist after the bed-ridden commit');
    const committed = rebaseAcceptedEffectiveWeek({
      surfaces: useProgramStore.getState() as never,
      weekStart: WEEK,
      profile: useProfileStore.getState().onboardingData,
      markedDays: useProgramStore.getState().acceptedMaterialContext.markedDays,
    });
    assert(committed.contract.identity.mode === 'optional_week',
      `the COMMITTED accepted week must be illness_recovery, got ${committed.contract.identity.mode}`);
  });

  // ── Invariant R16 (door unification — ONE readiness owner, two doors cannot
  // diverge): after 0.2 the day-card "I'm not 100%" door no longer commits any
  // readiness/illness/recovery fact of its own — it opens the week owner. The
  // tier→action mapping lives in exactly ONE pure function, `readinessActionForKind`,
  // which every tier (incl. the new "Coming down with something"/"Properly sick"
  // groupings) routes through. Two doors + one committer = identical outcome by
  // construction. This replaces the old two-committer risk (R13 era) with a
  // single-owner structural guarantee plus a per-tier mapping equivalence.
  await run('R16 door-unification: one owner maps every readiness tier + the day door holds no committer', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readinessActionForKind } = require('../utils/weekReadinessActions') as
      typeof import('../utils/weekReadinessActions');
    const ANCHOR = '2026-07-13';
    const TODAY = '2026-07-15';
    const ctx = { anchorDateISO: ANCHOR, todayISO: TODAY };

    const cases = [
      { kind: 'tired_today', type: 'set_fatigue_status', scope: 'today_only', date: TODAY, level: 'low_energy' },
      { kind: 'sore_today', type: 'set_fatigue_status', scope: 'today_only', date: TODAY, level: 'sore' },
      { kind: 'cooked_week', type: 'set_fatigue_status', scope: 'current_week', date: ANCHOR, level: 'cooked' },
      { kind: 'poor_sleep_today', type: 'set_poor_sleep_status', scope: 'today_only', date: TODAY, pattern: 'single_night' },
      { kind: 'poor_sleep_week', type: 'set_poor_sleep_status', scope: 'current_week', date: ANCHOR, pattern: 'repeated' },
      { kind: 'illness_mild', type: 'set_illness_status', scope: 'today_only', date: TODAY, severity: 'mild' },
      { kind: 'illness_severe', type: 'set_illness_status', scope: 'current_week', date: ANCHOR, severity: 'severe' },
    ] as const;

    for (const c of cases) {
      const action = readinessActionForKind(c.kind as never, ctx) as {
        type: string; scope: string; source: { surface?: string };
        requiresRebuild: boolean; createsActiveModifier: boolean; oneOffOnly: boolean;
        payload: Record<string, unknown>;
      };
      assert(action.type === c.type, `${c.kind}: type expected ${c.type}, got ${action.type}`);
      assert(action.scope === c.scope, `${c.kind}: scope expected ${c.scope}, got ${action.scope}`);
      assert(action.payload.date === c.date, `${c.kind}: date expected ${c.date}, got ${String(action.payload.date)}`);
      assert(action.payload.todayISO === TODAY, `${c.kind}: todayISO must be threaded`);
      assert(action.source.surface === 'week_readiness_sheet', `${c.kind}: surface must be week_readiness_sheet`);
      assert(action.requiresRebuild === false && action.createsActiveModifier === true && action.oneOffOnly === false,
        `${c.kind}: durable flags must match the owner's`);
      if ('level' in c) assert(action.payload.level === c.level, `${c.kind}: level expected ${c.level}, got ${String(action.payload.level)}`);
      if ('pattern' in c) assert(action.payload.pattern === c.pattern, `${c.kind}: pattern expected ${c.pattern}`);
      if ('severity' in c) assert(action.payload.severity === c.severity, `${c.kind}: severity expected ${c.severity}`);
    }

    // Structural single-owner guarantee: the day-card door commits NOTHING of its
    // own — no readiness/illness/recovery committer, no shutdown_week, no wellbeing
    // subtree — it only opens the week owner via onOpenReadiness.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const planSheet = fs.readFileSync(`${__dirname}/../screens/home/PlanChangeSheet.tsx`, 'utf8') as string;
    for (const forbidden of [
      'pick_wellbeing', 'pick_tired', 'pick_sleep', 'pick_sick', 'confirm_shutdown',
      'shutdown_week', 'set_fatigue_status', 'set_illness_status', 'set_poor_sleep_status',
      'set_recovery_mode',
    ]) {
      assert(!planSheet.includes(forbidden),
        `the day-card door must hold no readiness committer, found "${forbidden}" in PlanChangeSheet`);
    }
    // UPDATED 2026-07-31 — Sam's design ruling 7 (`HOME_SCREEN_REDESIGN_RULINGS`):
    // "I'm not 100%" lives on the WEEK screen only. The day card used to carry a
    // row that handed off to the week owner, and a hand-off is still a door: two
    // places an athlete can start the same thing, one of which had to be kept in
    // sync with the other's copy. The law is now stronger, not weaker — the day
    // card holds no readiness committer AND no readiness door — so this asserts
    // the ABSENCE here and the PRESENCE at the single owner, because "no door on
    // the day card" would be trivially satisfiable by deleting the feature.
    // The literal moved on 2026-07-31 (ruling 4: "I'm not 100%" → "I'm
    // sick/flat today"). The PIN moves with it rather than being deleted: what
    // this cell is about is that exactly one screen carries the week-readiness
    // door, and a renamed door is still a door.
    for (const gone of ['onOpenReadiness', WEEK_READINESS_ENTRY_LABEL, "I'm not 100%"]) {
      assert(!planSheet.includes(gone),
        `the day-card door must hold no readiness door at all, found "${gone}" in `
        + 'PlanChangeSheet');
    }
    const homeV2 = fs.readFileSync(`${__dirname}/../screens/home/HomeScreenV2.tsx`, 'utf8') as string;
    assert(homeV2.includes(WEEK_READINESS_ENTRY_LABEL) && /<WeekReadinessSheet\b/.test(homeV2),
      `the single week-level readiness owner ("${WEEK_READINESS_ENTRY_LABEL}") is gone `
      + 'from HomeScreenV2 — the athlete now has NO door, which is not what ruling 7 '
      + 'asked for');
    assert(!homeV2.includes("I'm not 100%"),
      'HomeScreenV2 still says "I\'m not 100%" — Sam replaced that wording under '
      + 'ruling 4, and both versions cannot ship');
  });

  // ── Invariant R17 (attribution per fact kind): a coach note for an ILLNESS
  // source fact must never read "you said you're cooked" (a fatigue attribution).
  // Severe illness composes a fatigue-typed constraint (post-v1 the constraint
  // type is still shared), so the constraint carries a typed readinessKind:'illness'
  // discriminator and the lead author branches on it — no string special-casing.
  await run('R17 attribution: an illness fact reads as illness, never "you said you\'re cooked"', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readinessBodyLead } = require('../utils/activeProgramModifiers') as
      typeof import('../utils/activeProgramModifiers');
    const weekScope = { kind: 'week' as const, weekStart: WEEK, from: WEEK, until: addDays(WEEK, 6) };
    const composed = composeTemporarySourceFactCompatibility({
      temporarySourceFacts: [createTemporaryIllnessFact({
        observedDate: WEEK, scope: weekScope, severity: 'severe',
        sourceSurface: 'week_readiness_sheet',
      })],
      activeConstraints: [],
    });
    const illness = composed.activeConstraints.find((c) => isTemporarySourceFactConstraint(c)) as
      { type: string; readinessKind?: string; severity: number; reasonLabel?: string } | undefined;
    assert(!!illness, 'a severe illness fact must compose an active constraint');
    assert(illness!.readinessKind === 'illness',
      `the illness constraint must carry the typed readinessKind:'illness' discriminator, got ${String(illness!.readinessKind)}`);
    const lead = readinessBodyLead(illness as never, illness!.reasonLabel ?? '');
    assert(!/cooked/i.test(lead), `illness lead must not read "cooked", got "${lead}"`);
    assert(/sick/i.test(lead), `illness lead must attribute to illness, got "${lead}"`);
    // Fatigue attribution stays intact (no regression): a cooked fatigue constraint
    // still reads cooked; a flat one still reads flat.
    assert(/cooked/i.test(readinessBodyLead({ type: 'fatigue', severity: 8 } as never, '')),
      'a cooked fatigue constraint must still read "cooked"');
    assert(/flat/i.test(readinessBodyLead({ type: 'fatigue', severity: 2 } as never, '')),
      'a flat fatigue constraint must still read "flat"');
  });

  // ── Invariant R18 (ack surfaces the real disclosure): when a readiness report
  // actually CHANGES the program (severe illness → illness_recovery week), the
  // sheet acknowledgment must surface the authored disclosure ("nothing's required
  // this week…"), not a generic "logged how you're feeling". A record-only report
  // (no program change) keeps the generic ack.
  await run('R18 ack-disclosure: a program-changing report surfaces its authored disclosure', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildReadinessAcknowledgment } = require('../utils/readinessAcknowledgment') as
      typeof import('../utils/readinessAcknowledgment');
    const disclosure = "Rest up — nothing's required this week. I've left gentle optional work if you're up to it, at a lighter dose.";
    const changed = buildReadinessAcknowledgment({ ok: true, changedProgram: true, message: disclosure });
    assert(changed?.tone === 'success' && changed?.message === disclosure,
      `a program-changing success must surface its disclosure, got "${changed?.message}"`);
    // Record-only (no program change) keeps the generic acknowledgment.
    const recorded = buildReadinessAcknowledgment({ ok: true, changedProgram: false, message: '' });
    assert(recorded?.tone === 'success' && /logged how you're feeling/.test(recorded?.message ?? ''),
      `a record-only report keeps the generic ack, got "${recorded?.message}"`);
  });

  // ── Invariant R19 (finding #4 root cause — ONE owner of the readiness-active
  // state, illness included): the device intermittent ("fact sometimes unresolved
  // after clear") was a SPLIT representation. The hook's readinessFacts (the
  // readiness-active witness + coach note) INCLUDE illness, but the card-label
  // resolver `resolveVisibleReadinessState` EXCLUDED it (READINESS_FACT_KINDS), so
  // `weekReadiness` was null for illness — the card and its clear never owned the
  // fact. Clearing fell to a decoupled path that reverts the week but leaves the
  // fact active (readiness-active + coach note persist). Fix: the resolver owns
  // illness like its sibling kinds, so the card surfaces it (id = the illness
  // factId) and the card clear resolves the exact fact.
  await run('R19 illness-card-ownership (finding #4): illness IS the week-readiness active state and its clear resolves the fact', async () => {
    seed();
    await executeProgramControlActionDurably({
      type: 'set_illness_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: { date: WEEK, todayISO: WEEK, severity: 'severe' },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: WEEK });
    const illnessBefore = activeIllnessFacts();
    assert(illnessBefore.length === 1, `precondition: one active illness fact, got ${illnessBefore.length}`);
    const factId = illnessBefore[0].factId;

    // 1. The card must surface the illness fact as its active state (same ownership
    //    fatigue/soreness/poor_sleep get) — id === the illness factId, week scope.
    const mod = require('../utils/visibleReadinessState') as {
      resolveVisibleReadinessState: (input: unknown) => { id: string; scope: string; isRecovery: boolean } | null;
    };
    const state = mod.resolveVisibleReadinessState({
      readinessFacts: activeReadinessFacts(),
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints ?? [],
      weekAnchorISO: WEEK, todayISO: WEEK, isThisWeek: true,
    });
    assert(state !== null,
      'card did not surface the illness fact: resolveVisibleReadinessState returned null (split representation)');
    assert(state!.id === factId,
      `card active id must be the illness factId (so its clear resolves the exact fact), got ${state!.id}`);
    assert(state!.scope === 'week', `severe illness is week-scoped, got ${state!.scope}`);

    // 2. Clearing through the card's exact active id resolves the fact — no leftover
    //    active witness / coach note. This is the trust-layer guarantee: the fact
    //    the week reverted for is the fact that gets resolved.
    const clearResult = await executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: { modifierId: state!.id, date: WEEK },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    } as never, { todayISO: WEEK });
    assert((clearResult as { ok?: boolean }).ok === true,
      `clear must succeed, got ok=${(clearResult as { ok?: boolean }).ok} message="${(clearResult as { message?: string }).message}"`);
    assert(activeIllnessFacts().length === 0,
      `the illness fact must be resolved after clear, still ${activeIllnessFacts().length} active (finding #4)`);
  });

  // ── A4 (L10 device finding 2026-07-24) ────────────────────────────────
  // Attribution comes from the FACT KIND, not the constraint type.
  //
  // Every health source fact projects onto one compatibility constraint of
  // `type: 'fatigue'` (illness included — it shares the type until the post-v1
  // split). `statusModifier` titled every such constraint "Recovery mode
  // active", so a severe illness surfaced as "Recovery mode active — 7/10":
  // a domain the athlete never mentioned, at a severity they never gave.
  //
  // The projection already carries the typed `readinessKind` discriminator and
  // the note BODY already reads it (`readinessBodyLead` — "You said you're
  // sick."). The title was never wired to the same source. Pin that it is, and
  // that the card and the note share ONE vocabulary owner.
  await run('R20 fact-kind attribution: a note says what the athlete actually reported', () => {
    const { buildActiveCoachNotes } = require('../utils/activeCoachNotes') as
      typeof import('../utils/activeCoachNotes');
    const factConstraint = (extra: Record<string, unknown>) => ({
      id: 'source-fact:global:2026-07-20:2026-07-26',
      type: 'fatigue',
      severity: 7,
      status: 'active',
      startDate: '2026-07-20T00:00:00Z',
      lastUpdatedAt: '2026-07-20T00:00:00Z',
      rules: ['max-effort lifts'],
      safeFocus: ['Easy aerobic conditioning'],
      advice: [],
      modifierAffects: ['current_week'],
      temporarySourceFactIds: ['temporary-source-fact:v1:illness:week:2026-07-20'],
      ...extra,
    });
    const titleOf = (extra: Record<string, unknown>): string | undefined =>
      buildActiveCoachNotes([factConstraint(extra) as never])[0]?.title;

    const illness = titleOf({ readinessKind: 'illness', reasonLabel: 'Illness' });
    assert(illness !== 'Recovery mode active',
      'an illness fact must never read as "Recovery mode active" (the device defect)');
    assert(illness === 'Under the weather this week',
      `illness title must say illness, got "${illness}"`);
    const sleep = titleOf({ readinessKind: 'poor_sleep', readinessPattern: 'repeated' });
    assert(sleep === 'Poor sleep this week', `poor sleep title, got "${sleep}"`);
    const cooked = titleOf({ severity: 8 });
    assert(cooked === 'Cooked this week', `cooked title, got "${cooked}"`);
    const today = titleOf({
      readinessKind: 'illness', modifierAffects: ['current_day'], appliesToDate: '2026-07-24',
    });
    assert(today === 'Under the weather today', `scope must be respected, got "${today}"`);
  });

  await run('R21 fact-kind attribution: two active facts keep two lines and two clears', () => {
    const { buildActiveCoachNotes } = require('../utils/activeCoachNotes') as
      typeof import('../utils/activeCoachNotes');
    const notes = buildActiveCoachNotes([
      {
        id: 'source-fact:global:2026-07-20:2026-07-26', type: 'fatigue', severity: 7,
        status: 'active', startDate: '2026-07-20T00:00:00Z', lastUpdatedAt: '2026-07-20T00:00:00Z',
        rules: ['max-effort lifts'], safeFocus: ['Easy aerobic'], advice: [],
        modifierAffects: ['current_week'], readinessKind: 'illness',
      },
      {
        id: 'source-fact:soreness:hamstring:2026-07-20:2026-07-26', type: 'soreness',
        bodyPart: 'hamstring', bucket: 'hamstring', severity: 6, status: 'active',
        startDate: '2026-07-20T00:00:00Z', lastUpdatedAt: '2026-07-20T00:00:00Z',
        rules: ['keep hamstring work pain-free'], safeFocus: ['Pain-free strength'], advice: [],
        modifierAffects: ['current_week'], reasonLabel: 'hamstring soreness',
      },
    ] as never);
    assert(notes.length === 2, `two facts must render two notes, got ${notes.length}`);
    assert(new Set(notes.map((note) => note.id)).size === 2, 'notes must be separately identified');
    assert(notes.every((note) => note.actions.some((action) => action.kind === 'clear_status')),
      'each note must carry its own clear');
    assert(new Set(notes.map((note) => note.title)).size === 2,
      'two different facts must not collapse to one label');
  });

  await run('R22 fact-kind attribution has ONE vocabulary owner, read by both surfaces', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const read = (file: string): string =>
      fs.readFileSync(path.resolve(__dirname, '..', 'utils', file), 'utf8');
    const owner = read('readinessFactAttribution.ts');
    assert(/Under the weather/.test(owner) && /Cooked/.test(owner),
      'the vocabulary must live in the owner module');
    assert(/readinessFactAttribution/.test(read('visibleReadinessState.ts')),
      'the card must read the shared owner');
    assert(/readinessFactAttribution/.test(read('activeProgramModifiers.ts')),
      'the coach note must read the shared owner');
    assert(!/'Recovery mode active'/.test(read('activeProgramModifiers.ts')),
      'the derived-title path must no longer mint "Recovery mode active"');
  });

  console.log(`\nReadiness / source-fact ownership invariants: ${passes} passing, ${failures.length} failing`);
  totalsPrinted(failures.length);
  if (failures.length > 0) {
    console.log('Currently RED (expected pre-fix):');
    for (const name of failures) console.log(`  - ${name}`);
  }
// TOTALS-OR-RED (Sam, 2026-08-03): the explicit exit is GONE, not moved.
// `process.exit(0)` hard-overrides `process.exitCode`, so it silently
// un-arms this suite — proven by a surviving mutation during the rollout.
// `totalsPrinted(...)` above already set the correct code from the report.
}

main().catch((error) => {
  console.error('SUITE THREW:', error);
  process.exit(1);
});
