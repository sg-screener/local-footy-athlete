/**
 * ONE-TIME INGRESS FOR PRE-EFFECT PLAN-CHANGE ROWS.
 *
 * Old rows stored only the athlete's requested `PlanChange`, so their accepted
 * semantic constraint cannot be recovered from bytes that were never written.
 * This compatibility boundary executes that old request once against the newly
 * generated base world, captures the exact resulting constraint delta, and the
 * boot appends it as `legacy_plan_change_effect_upgrade`. Every later boot uses
 * the canonical effect compiler; this file is never reached again for that row.
 */
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { PlanChange } from '../utils/planChangeTypes';
import type { CanonicalAcceptedSessionEditEffect } from '../rules/canonicalWeeklySessionEditState';
import { canonicalSessionMutationIntentForPlanChange } from '../rules/canonicalWeeklySessionEditState';
import { canonicalAcceptedSessionEditEffectFromDiff } from '../rules/canonicalWeeklySessionEditCompiler';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { applyPlanChange } from '../utils/planChangeProducer';
import { applyProgramOverrideWrite, useProgramStore } from './programStore';

function mondayOf(dateISO: string): string {
  const parsed = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
    + `-${String(parsed.getDate()).padStart(2, '0')}`;
}

function datesFor(change: PlanChange): string[] {
  const row = change as unknown as Record<string, unknown>;
  return [row.date, row.fromDate, row.toDate,
    ...(Array.isArray(row.dates) ? row.dates : [])]
    .filter((value): value is string => typeof value === 'string')
    .map((date) => date.slice(0, 10));
}

export function replayLegacyPlanChangeEntryToEffect(
  entry: DecisionLedgerEntry,
): CanonicalAcceptedSessionEditEffect {
  if (entry.decision.kind !== 'plan_change') {
    throw new Error(`Legacy session migration received ${entry.decision.kind}`);
  }
  const change = entry.decision.change;
  const intent = canonicalSessionMutationIntentForPlanChange(change);
  if (!intent) throw new Error(`Legacy plan-change kind has no session effect: ${change.kind}`);
  const affectedDates = datesFor(change);
  const weeks = [...new Set(affectedDates.map(mondayOf))];
  const before = useProgramStore.getState();
  const beforeConstraints = [...before.userRemovalConstraints];
  const beforeMarkedDays = { ...(before.acceptedMaterialContext.markedDays ?? {}) };
  const visibleWeek = weeks.flatMap((weekStart) => deriveVisibleWeekLive(weekStart));
  const result = applyPlanChange({
    change,
    visibleWeek,
    todayISO: entry.occurredAt.slice(0, 10),
    route: 'legacy_plan_change_effect_migration',
    applyOverride: (date, workout, context) => {
      if (!workout) return;
      applyProgramOverrideWrite({
        date,
        workout,
        context,
        writer: 'program_control',
      });
    },
  });
  if (!result.ok) {
    throw new Error(
      `Legacy plan change no longer applies: ${change.kind}:${result.outcome}:${result.message}`,
    );
  }
  const after = useProgramStore.getState();
  return canonicalAcceptedSessionEditEffectFromDiff({
    beforeConstraints,
    afterConstraints: after.userRemovalConstraints,
    beforeMarkedDays,
    afterMarkedDays: after.acceptedMaterialContext.markedDays ?? {},
    mutationIntent: intent,
    affectedDates: result.appliedDates,
    acceptedAt: entry.occurredAt,
  });
}
