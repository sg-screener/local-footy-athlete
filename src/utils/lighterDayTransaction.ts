/**
 * Readiness opt-in records a policy; compiler reconstruction owns its output.
 * No overlay or before/after workout is persisted. Clear the linked fact or
 * Undo the decision and the compiler rebuilds the remaining accepted inputs.
 */
import { useProgramStore, applyProgramOverrideWrite } from '../store/programStore';
import { appendDecisionEntry, decisionLedgerEntries } from '../store/decisionLedgerStore';
import { replayableEntries } from '../rules/decisionLedgerReplay';
import { resolveDateWithConditioning } from './sessionResolver';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { selectReadinessFactForDate } from '../rules/temporarySourceFact';
import {
  compileCanonicalLighterDayWorkout, lighterDayTrimAvailable, lighterDayEffectActive,
  type CanonicalAcceptedLighterDayEffect, type LighterDayTrimResult,
} from '../rules/canonicalWeeklyLighterDayCompiler';
import { settleDerivedWorldAfterDecision } from '../store/quiescentBoot';
import { runCoachMutationTransaction } from '../store/coachMutationTransaction';

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
): LighterDayTrimResult | null {
  const facts = useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts;
  if (!lighterDayEffectActive(effect, facts)) return null;
  const workout = resolveDateWithConditioning(effect.dateISO, buildScheduleStateImperative())?.workout;
  if (!workout) return null;
  const compiled = compileCanonicalLighterDayWorkout(workout);
  if (!compiled.changes.length) return null;
  const write = applyProgramOverrideWrite({
    date: effect.dateISO, workout: compiled.workout, writer: 'program_control',
    context: { intent: 'dismissed', label: 'Lighter day' },
  });
  if (!write.ok) throw new Error('The accepted lighter-day output could not be published.');
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
  if (!transaction.ok || !transaction.value) return unchanged;
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
