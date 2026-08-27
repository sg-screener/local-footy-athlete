/**
 * Readiness opt-in records a policy; compiler reconstruction owns its output.
 * No overlay or before/after workout is persisted. Clear the linked fact or
 * Undo the decision and the compiler rebuilds the remaining accepted inputs.
 */
import { useProgramStore } from '../store/programStore';
import { appendDecisionEntry, decisionLedgerEntries } from '../store/decisionLedgerStore';
import { replayableEntries } from '../rules/decisionLedgerReplay';
import { resolveDateWithConditioning, resolveWeekWithConditioning, getMondayForDate, addDays } from './sessionResolver';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { selectReadinessFactForDate } from '../rules/temporarySourceFact';
import {
  compileCanonicalLighterDayWorkout, compileCanonicalLighterDayContract, lighterDayTrimAvailable, lighterDayEffectActive,
  type CanonicalAcceptedLighterDayEffect, type LighterDayTrimResult,
} from '../rules/canonicalWeeklyLighterDayCompiler';
import { settleDerivedWorldAfterDecision } from '../store/quiescentBoot';
import { runCoachMutationTransaction } from '../store/coachMutationTransaction';
import { commitAcceptedStateTransaction } from '../store/acceptedStateTransaction';
import { selectMicrocycleForDate } from './programBlockState';
import { selectStoredWeekDeclaration } from '../rules/storedWeekDeclaration';

export interface ApplyLighterDayResult {
  ok: boolean;
  message: string;
  changes: string[];
  adjustmentId?: string;
}

function activeLighterDay(date: string): boolean {
  const facts = useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts;
  return replayableEntries(decisionLedgerEntries()).some((entry) =>
    entry.decision.kind === 'lighter_day' &&
    entry.decision.acceptedEffect.dateISO === date &&
    lighterDayEffectActive(entry.decision.acceptedEffect, facts));
}

/** Existing transaction publication boundary, shared by live acceptance and boot.
 * The compiler alone transforms rows; the adapter neither selects nor trims.
 */
export function commitCanonicalAcceptedLighterDayEffect(
  effect: CanonicalAcceptedLighterDayEffect,
  facts = useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts,
): LighterDayTrimResult | null {
  if (!lighterDayEffectActive(effect, facts)) return null;
  const state = useProgramStore.getState();
  const weekStart = getMondayForDate(effect.dateISO);
  const days = resolveWeekWithConditioning(weekStart, { ...buildScheduleStateImperative(),
    activeConstraints: undefined, temporarySourceFacts: [], athleteExclusions: [] });
  const workout = days.find((day) => day.date === effect.dateISO)?.workout;
  if (!workout) return null;
  const compiled = compileCanonicalLighterDayWorkout(workout);
  if (!compiled.changes.length) return null;
  const priorOverlay = state.weekScopedOverlays[weekStart];
  const contract = selectStoredWeekDeclaration({ overlay: priorOverlay,
    coveringMicrocycle: selectMicrocycleForDate(state.currentProgram, state.currentMicrocycle, effect.dateISO),
    weekStart, reader: 'lighterDayTransaction.acceptedContract' });
  const before = days.flatMap((day) => day.workout ? [day.workout] : []);
  const after = days.flatMap((day) => day.date === effect.dateISO ? [compiled.workout] : day.workout ? [day.workout] : []);
  const adjustedContract = contract ? compileCanonicalLighterDayContract({ contract, before, after,
    weekStartISO: weekStart, effect }) : undefined;
  // The transaction publishes the compiler's prescription and target together.
  // Overlays remain ephemeral reconstruction output, never new ledger input.
  commitAcceptedStateTransaction({
    reason: `canonical_lighter_day:${effect.sourceFactId}`, operation: 'forward_decision',
    todayISO: effect.dateISO, validateWeekStarts: [weekStart],
    program: {
      dateOverrides: { ...state.dateOverrides, [effect.dateISO]: compiled.workout },
      overrideContexts: { ...state.overrideContexts, [effect.dateISO]: { intent: 'dismissed', label: 'Lighter day' } },
      weekScopedOverlays: { ...state.weekScopedOverlays, [weekStart]: {
        ...priorOverlay, id: priorOverlay?.id ?? `lighter-day:${weekStart}`,
        weekStart, weekEnd: addDays(weekStart, 6), anchorDate: priorOverlay?.anchorDate ?? null,
        reason: 'readiness_reduction', exposureContractV2: adjustedContract,
        workoutsByDate: { ...priorOverlay?.workoutsByDate },
        createdAt: priorOverlay?.createdAt ?? effect.dateISO, updatedAt: effect.dateISO,
      } },
    },
  });
  return compiled;
}

export async function applyLighterDayForToday(args: {
  date: string;
  todayISO: string;
  sourceFactId?: string;
}): Promise<ApplyLighterDayResult> {
  const unchanged = { ok: false, message: "Today's already light — nothing to trim.", changes: [] };
  if (activeLighterDay(args.date)) return unchanged;
  const facts = useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts;
  const fact = selectReadinessFactForDate({
    facts: args.sourceFactId ? facts.filter((candidate) =>
      'factId' in candidate && candidate.factId === args.sourceFactId) : facts,
    dateISO: args.date, todayISO: args.todayISO,
  });
  if (!fact) return { ok: false, message: 'That readiness report is no longer active.', changes: [] };
  const effect: CanonicalAcceptedLighterDayEffect = {
    kind: 'lighter_day', policy: 'slight_v1', dateISO: args.date, sourceFactId: fact.factId,
  };
  const transaction = await runCoachMutationTransaction({
    todayISO: args.todayISO, extraDates: [args.date],
    mutate: () => commitCanonicalAcceptedLighterDayEffect(effect),
    didApply: (result) => !!result?.changes.length,
  });
  if (!transaction.ok) return { ok: false, message: 'That lighter session could not be applied safely. Your session is unchanged.', changes: [] };
  if (!transaction.value) return unchanged;
  const recorded = appendDecisionEntry({
    decision: { kind: 'lighter_day', acceptedEffect: effect },
    provenance: 'athlete_tap', writer: 'program_control',
  });
  if (!recorded.ok) {
    await settleDerivedWorldAfterDecision();
    return { ok: false, message: 'That change could not be saved, so nothing changed.', changes: [] };
  }
  await settleDerivedWorldAfterDecision();
  const changes = transaction.value.changes;
  return {
    ok: true, changes, adjustmentId: recorded.entry?.id,
    message: `Kept today's session but made it lighter: ${changes.join(', ')}. You can undo this anytime by clearing "Not 100% today".`,
  };
}

export function lighterDayAvailableForDate(date: string): boolean {
  if (activeLighterDay(date)) return false;
  return lighterDayTrimAvailable(resolveDateWithConditioning(date, buildScheduleStateImperative())?.workout);
}
