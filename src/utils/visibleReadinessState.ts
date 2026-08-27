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

import type { TemporarySourceFact, NonInjuryTemporarySourceFact } from '../rules/temporarySourceFact';
import { isInjurySourceFact, selectReadinessFactForDate } from '../rules/temporarySourceFact';
import { factHorizonCoversWeek } from '../rules/durableFactHorizon';
import {
  recoveryModeModifierIdForDate,
  loadReductionModifierIdForDate,
} from './tapProgramModifiers';
import { poorSleepConstraintId } from './readinessConstraints';
import {
  readinessFactTitle,
  type ReadinessFactKind,
} from './readinessFactAttribution';

export interface VisibleReadinessState {
  id: string;
  isRecovery: boolean;
  title: string;
  scope: 'today' | 'week';
  /**
   * Which chip family the active fact belongs to: illness → 'sick',
   * everything else (fatigue / soreness / poor sleep / recovery) → 'flat'.
   * Sam's phone, 2026-08-26 (checklist #9): with a tired fact active, tapping
   * Sick showed the tired fact's manage view instead of the sick options —
   * *"Writing i'm flat today should not effect me or change the steps to
   * filling in I'm sick?"* The sheet needs the KIND to know whether the
   * tapped chip is asking about the same fact or a different report.
   */
  bucket: 'flat' | 'sick';
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

// The card owns EVERY non-injury readiness fact kind the hook surfaces — including
// illness. Excluding illness here (while the hook's readinessFacts + coach note
// included it) split the representation: the card/clear never owned the illness
// fact, so clearing fell to a decoupled path that reverted the week but left the
// fact active (finding #4). Illness is a first-class sibling of fatigue/soreness/
// poor_sleep for the visible active-state.
const READINESS_FACT_KINDS = new Set(['fatigue', 'soreness', 'poor_sleep', 'illness']);

// A4: the card and the coach note read ONE vocabulary owner, so the two
// surfaces cannot drift into naming the same fact differently. The card passes
// no severity — it says "Not 100%" where the note, which has severity, can say
// "Cooked". That is a refinement of one vocabulary, not a second one.
function factKindTitle(factKind: string, scope: 'today' | 'week'): string {
  const kind: ReadinessFactKind =
    factKind === 'poor_sleep' || factKind === 'soreness' || factKind === 'illness'
      ? factKind
      : 'fatigue';
  return readinessFactTitle({ kind, scope });
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

  // 1. Canonical readiness facts — the source the write actually produces.
  //    Whether a fact reaches this week is asked of `durableFactHorizon`, never
  //    recomputed here: this filter used to compare `scope.until` directly and
  //    so silently dropped every OPEN fact, blanking the card for exactly the
  //    reports that matter most (R19).
  const activeFacts = readinessFacts.filter((fact): fact is NonInjuryTemporarySourceFact =>
    !isInjurySourceFact(fact) &&
    fact.status === 'active' &&
    'factKind' in fact &&
    READINESS_FACT_KINDS.has((fact as { factKind: string }).factKind) &&
    factHorizonCoversWeek(fact, weekAnchorISO));
  if (activeFacts.length > 0) {
    // ONE OWNER for "which fact is the fact today" (Sam's D-3 ruling,
    // 2026-08-05). This used to pick prefer-today-else-position-zero while the
    // lighter-day trim picked first-alphabetically, so the Clear button could
    // target a different fact than the trim was linked to — the athlete cleared
    // what they reported and the day stayed trimmed. Both now ask the same
    // function, so they cannot disagree.
    const scopeOf = (fact: NonInjuryTemporarySourceFact): 'today' | 'week' =>
      (fact.scope.kind === 'date' && fact.scope.from === todayISO && isThisWeek) ? 'today' : 'week';
    const chosen = selectReadinessFactForDate({
      facts: activeFacts,
      dateISO: isThisWeek ? todayISO : weekAnchorISO,
      todayISO: isThisWeek ? todayISO : undefined,
    }) ?? activeFacts[0];
    const scope = scopeOf(chosen);
    return {
      id: chosen.factId,
      isRecovery: false,
      title: factKindTitle((chosen as { factKind: string }).factKind, scope),
      scope,
      bucket: (chosen as { factKind: string }).factKind === 'illness' ? 'sick' : 'flat',
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
      bucket: 'flat',
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
      bucket: 'flat',
    };
  }

  // 4. Legacy today readiness program modifier fallback.
  if (isThisWeek && input.todayReadinessModifier) {
    return {
      id: input.todayReadinessModifier.id,
      isRecovery: false,
      title: input.todayReadinessModifier.title,
      scope: 'today',
      bucket: 'flat',
    };
  }

  return null;
}
