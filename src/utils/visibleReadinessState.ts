/**
 * visibleReadinessState — the single pure projection behind the Program screen's
 * "I'm not 100%" card label.
 *
 * Ownership boundary (docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md, Q4/Q5):
 * the card label is a PURE projection of the canonical readiness source facts
 * (`temporarySourceFacts`), not of the legacy `tap-*` constraint-id scheme a
 * fatigue fact never emits. This is why "Just a bit tired today" now flips the
 * card (Defect 2). The legacy recovery-mode constraint match is preserved because
 * `set_recovery_mode` is a synchronous tap modifier that creates no source fact.
 */

import type { TemporarySourceFact } from '../rules/temporarySourceFact';
import { isInjurySourceFact } from '../rules/temporarySourceFact';
import { addDaysISO } from './programBlockState';
import {
  recoveryModeModifierIdForDate,
  loadReductionModifierIdForDate,
} from './tapProgramModifiers';
import { poorSleepConstraintId } from './readinessConstraints';

export interface VisibleReadinessState {
  id: string;
  isRecovery: boolean;
  title: string;
  scope: 'today' | 'week';
}

interface LegacyConstraintLike {
  id?: string;
  expiresAt?: string;
  modifierTitle?: string;
  reasonLabel?: string;
}

interface ProgramModifierLike {
  id: string;
  title: string;
  source?: string;
}

export interface ResolveVisibleReadinessStateInput {
  /** Canonical readiness facts (fatigue / soreness / poor_sleep), NEW primary source. */
  readinessFacts: readonly TemporarySourceFact[];
  /** Legacy tap-modifier constraints (recovery mode, load reduction, poor sleep). */
  activeConstraints: readonly LegacyConstraintLike[];
  weekAnchorISO: string;
  todayISO: string;
  isThisWeek: boolean;
  /** Legacy today-only readiness program modifier (retained fallback). */
  todayReadinessModifier?: ProgramModifierLike | null;
}

const READINESS_FACT_KINDS = new Set(['fatigue', 'soreness', 'poor_sleep']);

function factKindTitle(factKind: string, scope: 'today' | 'week'): string {
  if (factKind === 'poor_sleep') return scope === 'today' ? 'Poor sleep today' : 'Poor sleep this week';
  if (factKind === 'soreness') return scope === 'today' ? 'Sore today' : 'Sore this week';
  return scope === 'today' ? 'Not 100% today' : 'Not 100% this week';
}

/**
 * Resolve the visible readiness label state from the canonical facts first, then
 * the preserved legacy constraint/modifier paths. Returns null when the athlete
 * has reported nothing active for the visible week (card shows "I'm not 100%").
 */
export function resolveVisibleReadinessState(
  input: ResolveVisibleReadinessStateInput,
): VisibleReadinessState | null {
  const { readinessFacts, activeConstraints, weekAnchorISO, todayISO, isThisWeek } = input;
  const weekEndISO = addDaysISO(weekAnchorISO, 6);

  // 1. Canonical readiness facts — the source the write actually produces.
  const activeFacts = readinessFacts.filter((fact) =>
    !isInjurySourceFact(fact) &&
    fact.status === 'active' &&
    'factKind' in fact &&
    READINESS_FACT_KINDS.has((fact as { factKind: string }).factKind) &&
    fact.scope.from <= weekEndISO &&
    fact.scope.until >= weekAnchorISO);
  if (activeFacts.length > 0) {
    // Prefer a today-scoped fact so the card reads "today" when that's true.
    const scopeOf = (fact: TemporarySourceFact): 'today' | 'week' =>
      (fact.scope.kind === 'date' && fact.scope.from === todayISO && isThisWeek) ? 'today' : 'week';
    const chosen = activeFacts.find((fact) => scopeOf(fact) === 'today') ?? activeFacts[0];
    const scope = scopeOf(chosen);
    return {
      id: chosen.factId,
      isRecovery: false,
      title: factKindTitle((chosen as { factKind: string }).factKind, scope),
      scope,
    };
  }

  // 2. Legacy week-level tap modifiers (recovery mode / load reduction / poor
  //    sleep week) — recovery mode has no source fact, so this stays.
  const ids = [
    recoveryModeModifierIdForDate(weekAnchorISO),
    loadReductionModifierIdForDate(weekAnchorISO),
    poorSleepConstraintId(weekAnchorISO, 'repeated'),
  ];
  const match = activeConstraints.find((constraint) => {
    if (!constraint.id || !ids.includes(constraint.id)) return false;
    const end = typeof constraint.expiresAt === 'string' ? constraint.expiresAt : undefined;
    return !(end && end < todayISO);
  });
  if (match) {
    return {
      id: match.id as string,
      isRecovery: match.id === ids[0],
      title: String(match.modifierTitle ?? match.reasonLabel ?? 'Readiness adjusted'),
      scope: 'week',
    };
  }

  // 3. Legacy today poor-sleep single-night constraint.
  const todayPoorSleepId = poorSleepConstraintId(todayISO, 'single_night');
  const todayPoorSleep = activeConstraints.find((constraint) =>
    constraint.id === todayPoorSleepId && !(constraint.expiresAt && constraint.expiresAt < todayISO));
  if (isThisWeek && todayPoorSleep) {
    return {
      id: todayPoorSleep.id as string,
      isRecovery: false,
      title: String(todayPoorSleep.modifierTitle ?? 'Poor sleep adjustment active'),
      scope: 'today',
    };
  }

  // 4. Legacy today readiness program modifier fallback.
  if (isThisWeek && input.todayReadinessModifier) {
    return {
      id: input.todayReadinessModifier.id,
      isRecovery: false,
      title: input.todayReadinessModifier.title,
      scope: 'today',
    };
  }

  return null;
}
