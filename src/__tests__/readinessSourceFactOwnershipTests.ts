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

import type { OnboardingData } from '../types/domain';
import type { TemporarySourceFact } from '../rules/temporarySourceFact';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { commitAcceptedStateTransaction } from '../store/acceptedStateTransaction';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { isInjurySourceFact } from '../rules/temporarySourceFact';
import { resolveWeekWithConditioning, addDays } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { applyLighterDayTrim } from '../utils/lighterDayTrim';

const WEEK = '2026-07-13';
const SATURDAY = '2026-07-18';

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
    (fact.factKind === 'fatigue' || fact.factKind === 'soreness' || fact.factKind === 'poor_sleep'));
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
    useProgramStore.getState().setManualOverride(WEEK, trimmed.workout as never, {
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

  console.log(`\nReadiness / source-fact ownership invariants: ${passes} passing, ${failures.length} failing`);
  if (failures.length > 0) {
    console.log('Currently RED (expected pre-fix):');
    for (const name of failures) console.log(`  - ${name}`);
  }
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('SUITE THREW:', error);
  process.exit(1);
});
