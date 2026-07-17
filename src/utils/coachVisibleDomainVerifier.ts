import type { ExecutionResult } from './coachCommandExecutor';
import type { ProgramEdit } from './coachProgramEdit';
import type {
  ProgramEditDraft,
  ProgramEditDraftAction,
  ProgramEditDraftActionScope,
  ProgramEditDraftTargetDomain,
} from './coachProgramEditDraft';
import type { ResolvedDay } from './sessionResolver';
import {
  extractVisibleProgramItemsFromResolvedDay,
  type VisibleProgramItem,
} from './visibleProgramReadModel';
import {
  diffSemanticDays,
  projectSemanticComponentsForDomain,
  semanticDiffChangesLever,
  semanticDiffHasMaterialReductionForLever,
  semanticFingerprint,
  snapshotSemanticResolvedDay,
  type SemanticDaySnapshot,
} from './programSemanticSnapshot';

export interface CoachVisibleDomainFingerprint {
  date: string;
  semantic: SemanticDaySnapshot;
  session: {
    visible: boolean;
    removedOrRest: boolean;
    emptyShell: boolean;
    name: string | null;
    workoutType: string | null;
    sessionTier: string | null;
    signature: string;
  };
  strength: string;
  conditioning: string;
  recovery: string;
  exercises: string;
  allItems: string;
}

export type CoachVisibleDomainSnapshotMap = Record<
  string,
  CoachVisibleDomainFingerprint | null | undefined
>;

export type CoachVisibleDomainVerificationResult =
  | {
      ok: true;
      route: 'program_edit_draft_visible_guard_ok';
    }
  | {
      ok: false;
      route: string;
      reason: string;
      reply: string;
      details?: Record<string, unknown>;
    };

const SAFE_VISIBLE_FAILURE_REPLY =
  "I couldn't safely apply that change, so I left the plan unchanged.";

export function fingerprintVisibleProgramDay(
  day: ResolvedDay,
): CoachVisibleDomainFingerprint {
  const items = extractVisibleProgramItemsFromResolvedDay(day);
  const workout = day.workout ?? null;
  const semantic = snapshotSemanticResolvedDay(day);
  const removedOrRest = isRemovedOrRestWorkout(workout);
  const emptyShell = isVisibleEmptySessionShell(workout, items);

  return {
    date: day.date,
    semantic,
    session: {
      visible: !!workout && !removedOrRest,
      removedOrRest,
      emptyShell,
      name: clean(workout?.name),
      workoutType: clean(workout?.workoutType),
      sessionTier: clean((workout as any)?.sessionTier),
      signature: semanticFingerprint(semantic.workout),
    },
    strength: semanticFingerprint(projectSemanticComponentsForDomain(semantic.workout, 'strength')),
    conditioning: semanticFingerprint(projectSemanticComponentsForDomain(semantic.workout, 'conditioning')),
    recovery: semanticFingerprint(projectSemanticComponentsForDomain(semantic.workout, 'recovery')),
    exercises: semanticFingerprint(semantic.workout?.exercises ?? []),
    allItems: semanticFingerprint(semantic.workout?.components ?? []),
  };
}

export function compareVisibleDomainBeforeAfter(args: {
  draft: ProgramEditDraft | null | undefined;
  finalEdit?: ProgramEdit | null;
  result?: Pick<ExecutionResult, 'kind' | 'applied' | 'route' | 'reply'> | null;
  before: CoachVisibleDomainSnapshotMap;
  after: CoachVisibleDomainSnapshotMap;
}): CoachVisibleDomainVerificationResult {
  const { draft, finalEdit, result, before, after } = args;
  if (!draft || draft.intent === 'ask_question' || draft.intent === 'explain') {
    return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
  }

  if (result && (result.kind !== 'mutated' || result.applied !== true)) {
    return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
  }

  const moveCheck = verifyMoveExpectation({ draft, finalEdit, before, after });
  if (moveCheck) return moveCheck;

  for (const action of draft.proposedActions) {
    const targetDate = action.targetDate ?? draft.targetDate ?? finalEdit?.targetDate ?? null;
    if (!targetDate) {
      return failVisibleGuard('missing_target_date_for_visible_verifier', {
        action: action.reason,
      });
    }

    const beforeFp = before[targetDate];
    const afterFp = after[targetDate];
    if (!beforeFp || !afterFp) {
      return failVisibleGuard('missing_visible_snapshot', {
        targetDate,
        hasBefore: !!beforeFp,
        hasAfter: !!afterFp,
      });
    }

    const actionCheck = verifyActionDomainChange({
      action,
      before: beforeFp,
      after: afterFp,
    });
    if (!actionCheck.ok) return actionCheck;
  }

  for (const protection of protectedDomainExpectations(draft)) {
    const targetDate =
      protection.targetDate ??
      draft.targetDate ??
      finalEdit?.targetDate ??
      null;
    if (!targetDate) continue;

    const beforeFp = before[targetDate];
    const afterFp = after[targetDate];
    if (!beforeFp || !afterFp) {
      return failVisibleGuard('missing_protected_visible_snapshot', {
        targetDate,
        targetDomain: protection.targetDomain,
      });
    }

    const beforeDomain = domainSignature(beforeFp, protection.targetDomain, protection.actionScope);
    const afterDomain = domainSignature(afterFp, protection.targetDomain, protection.actionScope);
    if (beforeDomain !== afterDomain) {
      return failVisibleGuard('protected_domain_changed', {
        targetDate,
        targetDomain: protection.targetDomain,
        actionScope: protection.actionScope ?? null,
        reason: protection.reason,
      });
    }
  }

  return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
}

export function verifyProgramEditDraftVisibleState(args: {
  draft: ProgramEditDraft | null | undefined;
  finalEdit?: ProgramEdit | null;
  result?: Pick<ExecutionResult, 'kind' | 'applied' | 'route' | 'reply'> | null;
  before: CoachVisibleDomainSnapshotMap;
  after: CoachVisibleDomainSnapshotMap;
}): CoachVisibleDomainVerificationResult {
  return compareVisibleDomainBeforeAfter(args);
}

function verifyActionDomainChange(args: {
  action: ProgramEditDraftAction;
  before: CoachVisibleDomainFingerprint;
  after: CoachVisibleDomainFingerprint;
}): CoachVisibleDomainVerificationResult {
  const { action, before, after } = args;
  const semanticDiff = diffSemanticDays(before.semantic, after.semantic);
  if (action.targetDomain === 'session' && action.actionScope === 'whole_session') {
    if (action.intent === 'remove') {
      if (!before.session.visible) {
        return failVisibleGuard('session_remove_missing_before', {
          targetDate: before.date,
        });
      }
      if (after.session.visible) {
        return failVisibleGuard('session_remove_still_visible', {
          targetDate: after.date,
          afterSession: after.session.name,
        });
      }
      return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
    }

    if (before.session.signature === after.session.signature) {
      return failVisibleGuard('session_unchanged', {
        targetDate: after.date,
        intent: action.intent,
      });
    }
    return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
  }

  const beforeDomain = domainSignature(before, action.targetDomain, action.actionScope);
  const afterDomain = domainSignature(after, action.targetDomain, action.actionScope);
  const beforeCount = domainItemCount(before, action.targetDomain, action.actionScope);
  const afterCount = domainItemCount(after, action.targetDomain, action.actionScope);

  if (action.intent === 'reduce') {
    const lever = action.actionScope === 'duration'
      ? 'duration'
      : action.actionScope === 'intensity'
        ? 'intensity'
        : 'any';
    if (!semanticDiffHasMaterialReductionForLever(semanticDiff, lever)) {
      return failVisibleGuard('no_material_dose_reduction', {
        targetDate: after.date,
        targetDomain: action.targetDomain,
        actionScope: action.actionScope,
        lever,
      });
    }
  }

  if (
    action.intent === 'edit' &&
    action.actionScope === 'duration' &&
    !semanticDiffChangesLever(semanticDiff, 'duration')
  ) {
    return failVisibleGuard('duration_not_changed', { targetDate: after.date });
  }

  if (
    action.intent === 'edit' &&
    action.actionScope === 'intensity' &&
    !semanticDiffChangesLever(semanticDiff, 'intensity')
  ) {
    return failVisibleGuard('intensity_not_changed', { targetDate: after.date });
  }

  if (action.intent === 'add') {
    if (afterDomain === beforeDomain || afterCount <= beforeCount) {
      return failVisibleGuard('domain_add_not_visible', {
        targetDate: after.date,
        targetDomain: action.targetDomain,
        actionScope: action.actionScope,
        beforeCount,
        afterCount,
      });
    }
    return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
  }

  if (action.intent === 'remove') {
    if (beforeCount === 0) {
      return failVisibleGuard('domain_remove_missing_before', {
        targetDate: before.date,
        targetDomain: action.targetDomain,
        actionScope: action.actionScope,
      });
    }
    if (afterDomain === beforeDomain || afterCount >= beforeCount) {
      return failVisibleGuard('domain_remove_not_visible', {
        targetDate: after.date,
        targetDomain: action.targetDomain,
        actionScope: action.actionScope,
        beforeCount,
        afterCount,
      });
    }
    if (after.session.emptyShell) {
      return failVisibleGuard('empty_session_shell_visible', {
        targetDate: after.date,
        afterSession: after.session.name,
        targetDomain: action.targetDomain,
        actionScope: action.actionScope,
      });
    }
    return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
  }

  if (afterDomain === beforeDomain) {
    return failVisibleGuard('domain_change_not_visible', {
      targetDate: after.date,
      targetDomain: action.targetDomain,
      actionScope: action.actionScope,
      intent: action.intent,
    });
  }

  return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
}

function verifyMoveExpectation(args: {
  draft: ProgramEditDraft;
  finalEdit?: ProgramEdit | null;
  before: CoachVisibleDomainSnapshotMap;
  after: CoachVisibleDomainSnapshotMap;
}): CoachVisibleDomainVerificationResult | null {
  const { draft, finalEdit, before, after } = args;
  const payload = (finalEdit?.command as any)?.payload;
  if (
    draft.intent !== 'move' ||
    finalEdit?.intent !== 'move' ||
    payload?.operation !== 'move_session'
  ) {
    return null;
  }

  const sourceDate =
    commandTargetDate((finalEdit.command as any)?.target) ??
    finalEdit.targetDate ??
    draft.targetDate;
  const destDate = typeof payload.toDate === 'string' ? payload.toDate : null;
  if (!sourceDate || !destDate) {
    return failVisibleGuard('move_missing_source_or_destination', {
      sourceDate,
      destDate,
    });
  }

  const beforeSource = before[sourceDate];
  const afterSource = after[sourceDate];
  const beforeDest = before[destDate];
  const afterDest = after[destDate];
  if (!beforeSource || !afterSource || !beforeDest || !afterDest) {
    return failVisibleGuard('move_missing_visible_snapshot', {
      sourceDate,
      destDate,
      hasBeforeSource: !!beforeSource,
      hasAfterSource: !!afterSource,
      hasBeforeDest: !!beforeDest,
      hasAfterDest: !!afterDest,
    });
  }

  if (beforeSource.session.signature === afterSource.session.signature) {
    return failVisibleGuard('move_source_unchanged', { sourceDate });
  }
  if (beforeDest.session.signature === afterDest.session.signature) {
    return failVisibleGuard('move_destination_unchanged', { destDate });
  }

  const movedTitle =
    draft.sourceTarget?.sessionName ??
    (draft.sourceTarget as any)?.title ??
    (finalEdit as any).sourceSessionName ??
    beforeSource.session.name ??
    null;
  if (movedTitle) {
    if (fingerprintContainsTitle(afterSource, movedTitle)) {
      return failVisibleGuard('move_source_still_shows_moved_session', {
        sourceDate,
        movedTitle,
      });
    }
    if (!fingerprintContainsTitle(afterDest, movedTitle)) {
      return failVisibleGuard('move_destination_missing_moved_session', {
        destDate,
        movedTitle,
      });
    }
  }

  return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
}

function protectedDomainExpectations(draft: ProgramEditDraft): Array<{
  targetDomain: ProgramEditDraftTargetDomain;
  actionScope?: ProgramEditDraftActionScope;
  targetDate?: string | null;
  reason: string;
}> {
  const out = draft.protectedTargets.map((target) => ({
    targetDomain: target.targetDomain,
    actionScope: target.actionScope,
    targetDate: target.targetDate,
    reason: target.reason,
  }));

  for (const expectation of draft.verifierExpectations) {
    if (expectation.kind !== 'domain_unchanged' || !expectation.targetDomain) continue;
    if (out.some((target) =>
      target.targetDomain === expectation.targetDomain &&
      target.actionScope === expectation.actionScope &&
      target.targetDate === expectation.targetDate
    )) {
      continue;
    }
    out.push({
      targetDomain: expectation.targetDomain,
      actionScope: expectation.actionScope,
      targetDate: expectation.targetDate,
      reason: expectation.reason,
    });
  }

  const actionDomains = new Set(draft.proposedActions.map((action) => action.targetDomain));
  const hasSessionAction = actionDomains.has('session') || actionDomains.has('schedule');
  const addDefaultProtection = (
    targetDomain: ProgramEditDraftTargetDomain,
    actionScope: ProgramEditDraftActionScope,
    reason: string,
  ) => {
    if (out.some((target) => target.targetDomain === targetDomain && target.actionScope === actionScope)) {
      return;
    }
    out.push({
      targetDomain,
      actionScope,
      targetDate: draft.targetDate,
      reason,
    });
  };

  if (!hasSessionAction && actionDomains.has('conditioning') && !actionDomains.has('strength')) {
    addDefaultProtection('strength', 'strength_block', 'conditioning_edit_preserves_strength_by_default');
  }
  if (!hasSessionAction && actionDomains.has('strength') && !actionDomains.has('conditioning')) {
    addDefaultProtection('conditioning', 'conditioning_block', 'strength_edit_preserves_conditioning_by_default');
  }

  return out;
}

function domainSignature(
  fingerprint: CoachVisibleDomainFingerprint,
  domain: ProgramEditDraftTargetDomain,
  scope?: ProgramEditDraftActionScope,
): string {
  if (domain === 'session' || domain === 'schedule' || scope === 'whole_session') {
    return fingerprint.session.signature;
  }
  if (domain === 'strength') {
    return scope === 'exercise' ? fingerprint.exercises : fingerprint.strength;
  }
  if (domain === 'conditioning') return fingerprint.conditioning;
  if (domain === 'recovery') return fingerprint.recovery;
  return fingerprint.allItems;
}

function domainItemCount(
  fingerprint: CoachVisibleDomainFingerprint,
  domain: ProgramEditDraftTargetDomain,
  scope?: ProgramEditDraftActionScope,
): number {
  const signature = domainSignature(fingerprint, domain, scope);
  if (!signature || signature === '[]') return 0;
  if (domain === 'session' || domain === 'schedule' || scope === 'whole_session') {
    return fingerprint.session.visible ? 1 : 0;
  }
  try {
    const parsed = JSON.parse(signature);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function fingerprintContainsTitle(
  fingerprint: CoachVisibleDomainFingerprint,
  title: string,
): boolean {
  const needle = normalise(title);
  if (!needle) return false;
  return [
    fingerprint.session.name,
    fingerprint.session.signature,
    fingerprint.strength,
    fingerprint.conditioning,
    fingerprint.recovery,
    fingerprint.allItems,
  ].some((value) => normalise(value).includes(needle));
}

function failVisibleGuard(
  reason: string,
  details?: Record<string, unknown>,
): CoachVisibleDomainVerificationResult {
  return {
    ok: false,
    route: `program_edit_draft_visible_verification_failed:${reason}`,
    reason,
    reply: SAFE_VISIBLE_FAILURE_REPLY,
    details,
  };
}

function commandTargetDate(target: unknown): string | null {
  const candidate = target as { date?: unknown } | null | undefined;
  return typeof candidate?.date === 'string' ? candidate.date : null;
}

function isRemovedOrRestWorkout(workout: ResolvedDay['workout'] | null): boolean {
  if (!workout) return true;
  const anyWorkout = workout as any;
  return (
    anyWorkout.removed === true ||
    anyWorkout.isRemoved === true ||
    anyWorkout.sessionTier === 'removed' ||
    anyWorkout.workoutType === 'Removed' ||
    anyWorkout.workoutType === 'Rest'
  );
}

function isVisibleEmptySessionShell(
  workout: ResolvedDay['workout'] | null,
  items: VisibleProgramItem[],
): boolean {
  if (!workout || isRemovedOrRestWorkout(workout)) return false;
  const anyWorkout = workout as any;
  const type = String(anyWorkout.workoutType ?? '').trim();
  if (type === 'Game' || type === 'Team Training' || anyWorkout.isTeamDay === true) {
    return false;
  }
  if ((type === 'Recovery' || anyWorkout.sessionTier === 'recovery') && !/^rest$/i.test(workout.name ?? '')) {
    return false;
  }
  if ((workout.exercises ?? []).length > 0) return false;
  if ((workout.conditioningBlock?.options ?? []).length > 0) return false;
  return items.length === 0 || items.every((item) => item.source === 'session');
}

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalise(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
