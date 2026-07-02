import type { Workout } from '../types/domain';
import {
  buildProgramTabProjectedWeek,
  extractVisibleProgramItemsFromResolvedDay,
  type VisibleProgramItem,
} from './visibleProgramReadModel';
import type { ResolvedDay, ScheduleState } from './sessionResolver';
import { logger } from './logger';

export const COACH_REVISION_PROPOSAL_SCHEMA_VERSION = 'coach_revision_proposal.v1';

export const COACH_REVISION_PROPOSAL_SCHEMA = {
  schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  clarifyTopLevelKeys: [
    'schemaVersion',
    'kind',
    'confidence',
    'question',
    'missingField',
    'candidateOptions',
    'partialIntent',
    'reason',
  ],
  revisionTopLevelKeys: [
    'schemaVersion',
    'kind',
    'source',
    'confidence',
    'userIntent',
    'scope',
    'revisedDays',
    'explanation',
  ],
  notAnEditTopLevelKeys: [
    'schemaVersion',
    'kind',
    'confidence',
    'reason',
  ],
  outOfScopeSetupTopLevelKeys: [
    'schemaVersion',
    'kind',
    'confidence',
    'reason',
    'detectedChange',
  ],
  proposalKind: ['clarify', 'revision', 'not_an_edit', 'out_of_scope_setup'],
  intent: ['add', 'edit', 'remove', 'replace', 'move', 'reduce'],
  targetDomain: [
    'strength',
    'conditioning',
    'recovery',
    'session',
    'team_training',
    'schedule',
  ],
  actionScope: [
    'whole_session',
    'strength_section',
    'conditioning_section',
    'recovery_section',
    'session',
    'exercise',
    'duration',
    'intensity',
    'visible_week',
  ],
  sectionKind: ['strength', 'conditioning', 'recovery', 'session'],
  scopeMode: ['single_day', 'visible_week'],
  missingField: [
    'targetDate',
    'targetScope',
    'targetSession',
    'replacement',
    'confirmation',
  ],
} as const;

export type CoachRevisionIntentKind =
  | 'add'
  | 'edit'
  | 'remove'
  | 'replace'
  | 'move'
  | 'reduce';

export type CoachRevisionTargetDomain =
  | 'strength'
  | 'conditioning'
  | 'recovery'
  | 'session'
  | 'team_training'
  | 'schedule';

export type CoachRevisionActionScope =
  | 'whole_session'
  | 'strength_section'
  | 'conditioning_section'
  | 'recovery_section'
  | 'session'
  | 'exercise'
  | 'duration'
  | 'intensity'
  | 'visible_week';

export type CoachRevisionSectionKind =
  | 'strength'
  | 'conditioning'
  | 'recovery'
  | 'session';

export interface CoachRevisionIntent {
  intent: CoachRevisionIntentKind;
  targetDomain: CoachRevisionTargetDomain;
  actionScope: CoachRevisionActionScope;
  targetDates: string[];
  protectedRefs: string[];
  allowedAddedSectionKinds?: CoachRevisionSectionKind[];
  requiresConfirmation?: boolean;
  reason: string;
}

export interface CoachVisibleItemSnapshot {
  id: string;
  title: string;
  domain: CoachRevisionSectionKind;
  source: VisibleProgramItem['source'];
  description: string | null;
  exerciseIds: string[];
  durationMinutes: number | null;
  prescription: {
    sets: number | null;
    repsMin: number | null;
    repsMax: number | null;
    intensity: string | null;
  } | null;
}

export interface CoachVisibleSectionSnapshot {
  id: string;
  kind: CoachRevisionSectionKind;
  title: string;
  items: CoachVisibleItemSnapshot[];
}

export interface CoachVisibleWorkoutSnapshot {
  id: string;
  title: string;
  workoutType: string;
  sections: CoachVisibleSectionSnapshot[];
}

export interface CoachVisibleDaySnapshot {
  date: string;
  workout: CoachVisibleWorkoutSnapshot | null;
}

export interface CoachVisibleWeekSnapshot {
  schemaVersion: typeof COACH_REVISION_PROPOSAL_SCHEMA_VERSION;
  days: CoachVisibleDaySnapshot[];
}

export type CoachRevisionProposal =
  | {
      schemaVersion: typeof COACH_REVISION_PROPOSAL_SCHEMA_VERSION;
      kind: 'clarify';
      confidence: number;
      question: string;
      missingField:
        | 'targetDate'
        | 'targetScope'
        | 'targetSession'
        | 'replacement'
        | 'confirmation';
      candidateOptions: Array<{ id: string; label: string; value: unknown }>;
      partialIntent: CoachRevisionIntent | null;
      reason: string;
    }
  | {
      schemaVersion: typeof COACH_REVISION_PROPOSAL_SCHEMA_VERSION;
      kind: 'revision';
      source: 'semantic';
      confidence: number;
      userIntent: CoachRevisionIntent;
      scope: {
        mode: 'single_day' | 'visible_week';
        dates: string[];
      };
      revisedDays: CoachVisibleDaySnapshot[];
      explanation: string;
    }
  | {
      // Typed decline: the message is not a program-change request at all
      // (question, status check, chit-chat). The revision path releases the
      // turn to normal conversation handling instead of forcing a clarify.
      schemaVersion: typeof COACH_REVISION_PROPOSAL_SCHEMA_VERSION;
      kind: 'not_an_edit';
      confidence: number;
      reason: string;
    }
  | {
      // Typed decline: the message IS a change request, but a program-shape
      // one (recurring schedule, availability window, training-day set,
      // frequency) that must alter generation inputs, not date overrides.
      // The revision path releases the turn to the setup/regeneration
      // pipeline, which owns those changes.
      schemaVersion: typeof COACH_REVISION_PROPOSAL_SCHEMA_VERSION;
      kind: 'out_of_scope_setup';
      confidence: number;
      reason: string;
      detectedChange: string;
    };

export interface CoachRevisionParseResult {
  ok: boolean;
  proposal?: CoachRevisionProposal;
  issues: string[];
}

export interface CoachRevisionSectionDiff {
  kind: 'added' | 'removed' | 'changed' | 'preserved';
  sectionKind: CoachRevisionSectionKind;
  sectionId: string;
  before?: CoachVisibleSectionSnapshot;
  after?: CoachVisibleSectionSnapshot;
}

export interface CoachRevisionItemDiff {
  kind: 'added' | 'removed' | 'changed' | 'preserved';
  sectionKind: CoachRevisionSectionKind;
  itemId: string;
  before?: CoachVisibleItemSnapshot;
  after?: CoachVisibleItemSnapshot;
}

export interface CoachRevisionDateDiff {
  date: string;
  workoutChange:
    | 'unchanged'
    | 'added'
    | 'removed'
    | 'changed'
    | 'replaced';
  before: CoachVisibleDaySnapshot | null;
  after: CoachVisibleDaySnapshot | null;
  sectionDiffs: CoachRevisionSectionDiff[];
  itemDiffs: CoachRevisionItemDiff[];
}

export interface CoachRevisionDiff {
  changedDates: string[];
  dateDiffs: CoachRevisionDateDiff[];
}

export interface CoachRevisionValidationIssue {
  code: string;
  message: string;
  date?: string;
  ref?: string;
}

export type CoachRevisionValidationResult =
  | {
      status: 'valid';
      canApply: true;
      diff: CoachRevisionDiff;
      issues: [];
    }
  | {
      status: 'needs_confirmation';
      canApply: false;
      diff: CoachRevisionDiff;
      issues: CoachRevisionValidationIssue[];
      confirmationQuestion: string;
    }
  | {
      status: 'invalid';
      canApply: false;
      diff: CoachRevisionDiff;
      issues: CoachRevisionValidationIssue[];
    };

export interface CoachRevisionValidationPolicy {
  allowedChangedDates?: string[];
  allowedAddedSectionKinds?: CoachRevisionSectionKind[];
  /** App-side registry authorization: canonical BODY signatures (id-stripped)
   *  of template sections that may be added. The model must echo a template
   *  byte-exactly or the addition is unknown content. */
  allowedTemplateSectionSignatures?: string[];
  requireConfirmationForAdds?: boolean;
}

export function buildCoachRevisionWeekSnapshotFromProgramTabProjection(args: {
  mondayISO?: string;
  todayISO: string;
  state: ScheduleState & { activeConstraints?: any[] };
  overrideContexts?: Record<string, any>;
  modalityPreferences?: Record<string, any>;
}): CoachVisibleWeekSnapshot {
  return buildCoachRevisionWeekSnapshotFromProjectedDays(
    buildProgramTabProjectedWeek(args),
  );
}

export function buildCoachRevisionWeekSnapshotFromProjectedDays(
  visibleWeek: ResolvedDay[],
): CoachVisibleWeekSnapshot {
  return {
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    days: visibleWeek.map(snapshotProjectedDay),
  };
}

export function snapshotProjectedDay(day: ResolvedDay): CoachVisibleDaySnapshot {
  const workout = day.workout ?? null;
  if (!workout) return { date: day.date, workout: null };

  return {
    date: day.date,
    workout: {
      id: stableWorkoutId(day, workout),
      title: cleanText(workout.name) || 'Workout',
      workoutType: cleanText(workout.workoutType) || 'Workout',
      sections: buildVisibleSections(day, workout),
    },
  };
}

export function parseCoachRevisionProposal(raw: unknown): CoachRevisionParseResult {
  const parsed = typeof raw === 'string' ? parseJson(raw) : raw;
  if (!isRecord(parsed)) {
    return { ok: false, issues: ['proposal must be an object'] };
  }

  const issues = validateProposalShape(parsed);
  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    proposal: normalizeParsedProposal(parsed as CoachRevisionProposal),
    issues: [],
  };
}

/**
 * Canonicalize semantically unambiguous representations so downstream diff,
 * validation, and the override writer see one shape per meaning. Models are
 * told "a workout with no visible content must be workout: null", but they
 * still sometimes echo empty shells when removing the last section. An empty
 * shell has exactly one meaning — no visible content — so normalize it here
 * rather than rejecting the whole turn. WRONG empty days (content that should
 * have survived) are still caught after normalization by the protected-ref
 * and target/unrelated-domain checks, which see the content as removed.
 */
function normalizeParsedProposal(proposal: CoachRevisionProposal): CoachRevisionProposal {
  if (proposal.kind !== 'revision') return proposal;
  return {
    ...proposal,
    revisedDays: proposal.revisedDays.map((day) => {
      if (!day.workout) return day;
      const sections = day.workout.sections.filter(
        (section) => section.items.length > 0,
      );
      if (sections.length === 0) return { ...day, workout: null };
      if (sections.length === day.workout.sections.length) return day;
      return { ...day, workout: { ...day.workout, sections } };
    }),
  };
}

export function buildCoachRevisionDiff(args: {
  before: CoachVisibleWeekSnapshot;
  proposal: CoachRevisionProposal;
}): CoachRevisionDiff {
  if (args.proposal.kind !== 'revision') {
    return { changedDates: [], dateDiffs: [] };
  }

  const beforeByDate = new Map(args.before.days.map((day) => [day.date, day]));
  const revisedByDate = new Map(args.proposal.revisedDays.map((day) => [day.date, day]));
  const dates = Array.from(revisedByDate.keys()).sort();
  const dateDiffs = dates.map((date) =>
    diffDay({
      date,
      before: beforeByDate.get(date) ?? null,
      after: revisedByDate.get(date) ?? null,
    }),
  );
  return {
    changedDates: dateDiffs
      .filter((entry) => entry.workoutChange !== 'unchanged')
      .map((entry) => entry.date),
    dateDiffs,
  };
}

export function validateCoachRevisionDiff(args: {
  before: CoachVisibleWeekSnapshot;
  proposal: CoachRevisionProposal;
  policy?: CoachRevisionValidationPolicy;
}): CoachRevisionValidationResult {
  const diff = buildCoachRevisionDiff({
    before: args.before,
    proposal: args.proposal,
  });

  if (args.proposal.kind !== 'revision') {
    return { status: 'valid', canApply: true, diff, issues: [] };
  }

  const issues: CoachRevisionValidationIssue[] = [];
  const confirmationIssues: CoachRevisionValidationIssue[] = [];
  // Two independent date bounds, both required:
  // 1. scope consistency — the diff may only change dates the proposal itself
  //    declared in scope (catches the LLM editing days it didn't claim);
  // 2. app policy — when provided, changed dates must also be inside the
  //    app-side window (the snapshot the LLM was shown), so the proposal can
  //    never define its own outer boundary.
  const scopeDates = new Set(
    args.proposal.scope.dates ?? args.proposal.userIntent.targetDates,
  );
  const policyDates = args.policy?.allowedChangedDates
    ? new Set(args.policy.allowedChangedDates)
    : null;

  for (const date of diff.changedDates) {
    if (!scopeDates.has(date)) {
      issues.push(issue('unrelated_day_changed', `Proposal changed ${date}, which was not in scope.`, date));
    } else if (policyDates && !policyDates.has(date)) {
      issues.push(issue('unrelated_day_changed', `Proposal changed ${date}, which is outside the allowed visible window.`, date));
    }
  }

  for (const day of args.proposal.revisedDays) {
    if (day.workout && day.workout.sections.length === 0) {
      issues.push(issue('empty_workout_shell', `Proposal leaves ${day.date} with an empty workout shell.`, day.date));
    }
  }

  const protectedResult = validateProtectedRefs({
    before: args.before,
    proposal: args.proposal,
  });
  issues.push(...protectedResult);

  // Moves authorize their destination additions through the conservation
  // invariant (validateMoveConservation) — everything added must have left
  // the source identically. The generic added-refs policy would wrongly flag
  // conserved arrivals as unknown content.
  const addResult = args.proposal.userIntent.intent === 'move'
    ? { invalid: [], needsConfirmation: [] }
    : validateAddedRefs({
        proposal: args.proposal,
        diff,
        policy: args.policy,
      });
  issues.push(...addResult.invalid);
  confirmationIssues.push(...addResult.needsConfirmation);

  const intentResult = validateDiffMatchesIntent(args.proposal, diff);
  issues.push(...intentResult.invalid);
  confirmationIssues.push(...intentResult.needsConfirmation);

  if (issues.length > 0) {
    return { status: 'invalid', canApply: false, diff, issues };
  }

  if (confirmationIssues.length > 0) {
    return {
      status: 'needs_confirmation',
      canApply: false,
      diff,
      issues: confirmationIssues,
      confirmationQuestion: 'Confirm this replacement before I change the program?',
    };
  }

  return { status: 'valid', canApply: true, diff, issues: [] };
}

function buildVisibleSections(
  day: ResolvedDay,
  workout: Workout,
): CoachVisibleSectionSnapshot[] {
  const items = extractVisibleProgramItemsFromResolvedDay(day);
  const strengthItems = items.filter((item) => item.domain === 'strength');
  const conditioningItems = items.filter((item) => item.domain === 'conditioning');
  const recoveryItems = items.filter((item) => item.domain === 'recovery');
  const sessionItems = items.filter((item) => item.domain === 'session');
  const workoutId = stableWorkoutId(day, workout);
  const sections: CoachVisibleSectionSnapshot[] = [];

  if (strengthItems.length > 0) {
    sections.push({
      id: `section:${day.date}:strength:${workoutId}`,
      kind: 'strength',
      title: cleanText(workout.name) || 'Strength',
      items: strengthItems.map((item) => snapshotVisibleItem(item, workout)),
    });
  }

  if (conditioningItems.length > 0) {
    sections.push({
      id: `section:${day.date}:conditioning:${workoutId}`,
      kind: 'conditioning',
      title: conditioningSectionTitle(conditioningItems, workout),
      items: conditioningItems.map((item) => snapshotVisibleItem(item, workout)),
    });
  }

  if (recoveryItems.length > 0) {
    sections.push({
      id: `section:${day.date}:recovery:${workoutId}`,
      kind: 'recovery',
      title: recoveryItems.length === 1 ? recoveryItems[0].title : 'Recovery',
      items: recoveryItems.map((item) => snapshotVisibleItem(item, workout)),
    });
  }

  if (sections.length === 0 && sessionItems.length > 0) {
    sections.push({
      id: `section:${day.date}:session:${workoutId}`,
      kind: 'session',
      title: cleanText(workout.name) || 'Session',
      items: sessionItems.map((item) => snapshotVisibleItem(item, workout)),
    });
  } else if (isTeamTrainingWorkout(workout) && sections.length > 0) {
    // Combined team days ("Team Training + Upper Pull") carry a commitment
    // that the athlete sees in the title but that previously had NO removable
    // representation — so "keep only the lifting" had nothing to diff away.
    // Every visible commitment must be a first-class section. The item id is
    // the workout id so that, after other sections are removed, the pure-day
    // projection (which synthesizes a session item with id = workout.id)
    // round-trips to the same contract identity.
    sections.push({
      id: `section:${day.date}:session:${workoutId}`,
      kind: 'session',
      title: 'Team Training',
      items: [{
        id: String((workout as any).id ?? workoutId),
        title: 'Team Training',
        domain: 'session',
        source: 'session',
        description: cleanText(workout.description) || null,
        exerciseIds: [],
        durationMinutes: null,
        prescription: null,
      }],
    });
  }

  return sections;
}

function isTeamTrainingWorkout(workout: Workout): boolean {
  return cleanText(workout.workoutType).toLowerCase() === 'team training';
}

function snapshotVisibleItem(
  item: VisibleProgramItem,
  workout: Workout,
): CoachVisibleItemSnapshot {
  const linkedExercise = findLinkedExercise(workout, item.exerciseIds);
  return {
    id: item.id,
    title: item.title,
    domain: item.domain === 'session' ? 'session' : item.domain,
    source: item.source,
    description: cleanText(item.description) || null,
    exerciseIds: [...item.exerciseIds],
    durationMinutes: item.durationMinutes,
    prescription: linkedExercise
      ? {
          sets: finiteNumberOrNull(linkedExercise.prescribedSets),
          repsMin: finiteNumberOrNull(linkedExercise.prescribedRepsMin),
          repsMax: finiteNumberOrNull(linkedExercise.prescribedRepsMax),
          intensity: cleanText((linkedExercise as any).intensity ?? workout.intensity) || null,
        }
      : null,
  };
}

function diffDay(args: {
  date: string;
  before: CoachVisibleDaySnapshot | null;
  after: CoachVisibleDaySnapshot | null;
}): CoachRevisionDateDiff {
  const before = args.before ?? { date: args.date, workout: null };
  const after = args.after ?? before;
  const workoutChange = classifyWorkoutChange(before, after);
  return {
    date: args.date,
    workoutChange,
    before,
    after,
    sectionDiffs: diffSections(before.workout?.sections ?? [], after.workout?.sections ?? []),
    itemDiffs: diffItems(before.workout?.sections ?? [], after.workout?.sections ?? []),
  };
}

function diffSections(
  before: CoachVisibleSectionSnapshot[],
  after: CoachVisibleSectionSnapshot[],
): CoachRevisionSectionDiff[] {
  const out: CoachRevisionSectionDiff[] = [];
  const beforeById = new Map(before.map((section) => [section.id, section]));
  const afterById = new Map(after.map((section) => [section.id, section]));
  for (const section of before) {
    const next = afterById.get(section.id);
    if (!next) {
      out.push({ kind: 'removed', sectionKind: section.kind, sectionId: section.id, before: section });
    } else if (stableString(section) === stableString(next)) {
      out.push({ kind: 'preserved', sectionKind: section.kind, sectionId: section.id, before: section, after: next });
    } else {
      out.push({ kind: 'changed', sectionKind: section.kind, sectionId: section.id, before: section, after: next });
    }
  }
  for (const section of after) {
    if (!beforeById.has(section.id)) {
      out.push({ kind: 'added', sectionKind: section.kind, sectionId: section.id, after: section });
    }
  }
  return out;
}

function diffItems(
  before: CoachVisibleSectionSnapshot[],
  after: CoachVisibleSectionSnapshot[],
): CoachRevisionItemDiff[] {
  const out: CoachRevisionItemDiff[] = [];
  const beforeById = new Map(flattenItems(before).map((entry) => [entry.item.id, entry]));
  const afterById = new Map(flattenItems(after).map((entry) => [entry.item.id, entry]));
  for (const entry of beforeById.values()) {
    const next = afterById.get(entry.item.id);
    if (!next) {
      out.push({ kind: 'removed', sectionKind: entry.section.kind, itemId: entry.item.id, before: entry.item });
    } else if (stableString(entry.item) === stableString(next.item)) {
      out.push({ kind: 'preserved', sectionKind: entry.section.kind, itemId: entry.item.id, before: entry.item, after: next.item });
    } else {
      out.push({ kind: 'changed', sectionKind: entry.section.kind, itemId: entry.item.id, before: entry.item, after: next.item });
    }
  }
  for (const entry of afterById.values()) {
    if (!beforeById.has(entry.item.id)) {
      out.push({ kind: 'added', sectionKind: entry.section.kind, itemId: entry.item.id, after: entry.item });
    }
  }
  return out;
}

function validateProtectedRefs(args: {
  before: CoachVisibleWeekSnapshot;
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>;
}): CoachRevisionValidationIssue[] {
  const issues: CoachRevisionValidationIssue[] = [];
  for (const ref of args.proposal.userIntent.protectedRefs) {
    const beforeSignature = findRefSignature(args.before.days, ref);
    const afterSignature = findRefSignature(args.proposal.revisedDays, ref);
    if (!beforeSignature) {
      issues.push(issue('protected_ref_missing_before', `Protected ref ${ref} was not visible before the edit.`, undefined, ref));
    } else if (beforeSignature !== afterSignature) {
      issues.push(issue('protected_ref_changed', `Protected ref ${ref} changed or disappeared.`, undefined, ref));
    }
  }
  return issues;
}

function validateAddedRefs(args: {
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>;
  diff: CoachRevisionDiff;
  policy?: CoachRevisionValidationPolicy;
}): {
  invalid: CoachRevisionValidationIssue[];
  needsConfirmation: CoachRevisionValidationIssue[];
} {
  const invalid: CoachRevisionValidationIssue[] = [];
  const needsConfirmation: CoachRevisionValidationIssue[] = [];
  // Authorization for added content comes from app-side policy ONLY. The
  // proposal's own userIntent.allowedAddedSectionKinds is LLM output and must
  // never expand what the app permits — otherwise the model can grant itself
  // permission to invent sections/items. The proposal field remains only a
  // confirmation-flow signal (see requiresConfirmation below).
  const allowedAdded = new Set(args.policy?.allowedAddedSectionKinds ?? []);

  const templateSignatures = new Set(args.policy?.allowedTemplateSectionSignatures ?? []);

  for (const dateDiff of args.diff.dateDiffs) {
    const addedSections = dateDiff.sectionDiffs.filter((entry) => entry.kind === 'added');
    for (const added of addedSections) {
      // Confirmation is governed by APP policy alone: policy false means the
      // athlete has already confirmed (apply-time), and the proposal's own
      // requiresConfirmation flag must not resurrect the gate forever.
      const confirmationRequired = args.policy?.requireConfirmationForAdds !== false;
      const isTemplateMatch =
        !!added.after &&
        templateSignatures.has(coachRevisionSectionBodySignature(added.after));
      if (isTemplateMatch) {
        if (confirmationRequired) {
          needsConfirmation.push(issue(
            'replacement_requires_confirmation',
            `Proposal adds template ${added.sectionKind} on ${dateDiff.date}.`,
            dateDiff.date,
            added.sectionId,
          ));
        }
        continue;
      }
      if (!allowedAdded.has(added.sectionKind)) {
        invalid.push(issue(
          'unknown_section_id',
          `Proposal added unknown ${added.sectionKind} section ${added.sectionId}.`,
          dateDiff.date,
          added.sectionId,
        ));
        continue;
      }
      if (confirmationRequired) {
        needsConfirmation.push(issue(
          'replacement_requires_confirmation',
          `Proposal adds ${added.sectionKind} on ${dateDiff.date}.`,
          dateDiff.date,
          added.sectionId,
        ));
      }
    }

    for (const addedItem of dateDiff.itemDiffs.filter((entry) => entry.kind === 'added')) {
      // Skip only items whose own parent section was added (those are already
      // authorized or flagged with that section above). Items injected into
      // EXISTING sections must always be validated, even when an unrelated
      // section addition happens on the same date.
      const parentAdded = dateDiff.sectionDiffs.some((section) =>
        section.kind === 'added' &&
        section.sectionKind === addedItem.sectionKind &&
        section.after?.items.some((item) => item.id === addedItem.itemId),
      );
      if (parentAdded) continue;
      if (!allowedAdded.has(addedItem.sectionKind)) {
        invalid.push(issue(
          'unknown_item_id',
          `Proposal added unknown ${addedItem.sectionKind} item ${addedItem.itemId}.`,
          dateDiff.date,
          addedItem.itemId,
        ));
      }
    }
  }

  return { invalid, needsConfirmation };
}

function validateDiffMatchesIntent(
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>,
  diff: CoachRevisionDiff,
): {
  invalid: CoachRevisionValidationIssue[];
  needsConfirmation: CoachRevisionValidationIssue[];
} {
  const invalid: CoachRevisionValidationIssue[] = [];
  const needsConfirmation: CoachRevisionValidationIssue[] = [];

  if (diff.changedDates.length === 0 && proposal.userIntent.intent !== 'edit') {
    invalid.push(issue('no_visible_diff', 'Proposal does not change the visible program.'));
    return { invalid, needsConfirmation };
  }

  if (
    proposal.userIntent.intent === 'remove' &&
    proposal.userIntent.actionScope === 'whole_session'
  ) {
    const removed = diff.dateDiffs.some((entry) => entry.workoutChange === 'removed');
    if (!removed) {
      invalid.push(issue('expected_session_removed', 'Intent removes a whole session, but no visible session was removed.'));
    }
    return { invalid, needsConfirmation };
  }

  if (proposal.userIntent.intent === 'move') {
    return validateMoveConservation(diff);
  }

  if (proposal.userIntent.intent === 'replace') {
    // Replace is judged STRUCTURALLY, like reduce and move — the label
    // matrix kept rejecting valid swaps whenever the model picked a domain
    // synonym. Safety comes from: template-only additions (byte-exact,
    // enforced in validateAddedRefs), protected refs, date bounds, and the
    // confirmation gate that shows the athlete exactly what will change.
    const addedSections = diff.dateDiffs.flatMap((entry) =>
      entry.sectionDiffs.filter((section) => section.kind === 'added'),
    );
    if (addedSections.length === 0) {
      invalid.push(issue('replace_missing_addition', 'Replace must add replacement content.'));
    }
    const replacedSomething = diff.dateDiffs.some((entry) =>
      entry.sectionDiffs.some(
        (section) => section.kind === 'removed' || section.kind === 'changed',
      ),
    );
    if (!replacedSomething) {
      invalid.push(issue('replace_nothing_replaced', 'Replace did not remove or change any existing content.'));
    }
    return { invalid, needsConfirmation };
  }

  if (proposal.userIntent.intent === 'reduce') {
    // A reduction must be conservative EVERYWHERE it changes something, not
    // just in the declared target domain — "make today lighter" legitimately
    // touches multiple sections, and the conservative invariant is what makes
    // whole-day reductions safe to allow.
    const badReduction = diff.dateDiffs.some((entry) =>
      entry.itemDiffs.some((itemDiff) =>
        itemDiff.kind === 'changed' &&
        !isConservativeReduction(itemDiff.before, itemDiff.after),
      ),
    );
    if (badReduction) {
      invalid.push(issue('non_conservative_reduction', 'Proposal changes the target instead of making it lighter.'));
    }
    const addedUnderReduce = diff.dateDiffs.some((entry) =>
      entry.sectionDiffs.some((section) => section.kind === 'added') ||
      entry.itemDiffs.some((item) => item.kind === 'added'),
    );
    if (addedUnderReduce) {
      invalid.push(issue('non_conservative_reduction', 'Proposal adds content under a reduce intent.'));
    }
    return { invalid, needsConfirmation };
  }

  const targetKind = targetSectionKind(proposal.userIntent.targetDomain);
  if (targetKind) {
    const targetChanged = diff.dateDiffs.some((entry) =>
      entry.sectionDiffs.some((section) =>
        section.sectionKind === targetKind && section.kind !== 'preserved',
      ) ||
      entry.itemDiffs.some((item) =>
        item.sectionKind === targetKind && item.kind !== 'preserved',
      ),
    );
    if (!targetChanged) {
      invalid.push(issue('target_domain_unchanged', `Proposal did not visibly change ${targetKind}.`));
    }

    const unrelatedChanged = diff.dateDiffs.flatMap((entry) =>
      entry.sectionDiffs.filter((section) =>
        section.kind !== 'preserved' &&
        section.sectionKind !== targetKind &&
        !isAllowedReplacementChange(proposal, section.sectionKind),
      ),
    );
    if (unrelatedChanged.length > 0) {
      invalid.push(issue('unrelated_domain_changed', 'Proposal changes a visible domain outside the requested target.'));
    }
  }

  return { invalid, needsConfirmation };
}

/**
 * CONSERVATION invariant for moves: everything that leaves the source must
 * arrive at the destination byte-identical (same item ids, same content),
 * nothing may be invented, nothing may be modified in flight, and the
 * destination's pre-existing content must be untouched. v1 additionally
 * requires the destination to have been a rest day — merging into an
 * occupied day needs writer row-transplant support (3C v2).
 */
function validateMoveConservation(diff: CoachRevisionDiff): {
  invalid: CoachRevisionValidationIssue[];
  needsConfirmation: CoachRevisionValidationIssue[];
} {
  const invalid: CoachRevisionValidationIssue[] = [];
  const changed = diff.dateDiffs.filter((entry) => entry.workoutChange !== 'unchanged');
  if (changed.length !== 2) {
    invalid.push(issue(
      'move_requires_two_days',
      `A move must change exactly two visible days (source and destination); proposal changed ${changed.length}.`,
    ));
    return { invalid, needsConfirmation: [] };
  }

  const removed = new Map<string, CoachRevisionItemDiff>();
  const added = new Map<string, CoachRevisionItemDiff>();
  for (const entry of changed) {
    const hasRemovals = entry.itemDiffs.some((item) => item.kind === 'removed');
    const hasAdditions = entry.itemDiffs.some((item) => item.kind === 'added');
    if (hasRemovals && hasAdditions) {
      invalid.push(issue(
        'move_mixed_day',
        `Day ${entry.date} both gains and loses content; swaps are not supported yet.`,
        entry.date,
      ));
    }
    if (hasAdditions && entry.before.workout !== null) {
      invalid.push(issue(
        'move_destination_occupied',
        `Destination ${entry.date} already has a session; moving onto occupied days is not supported yet.`,
        entry.date,
      ));
    }
    for (const item of entry.itemDiffs) {
      if (item.kind === 'removed') removed.set(item.itemId, item);
      else if (item.kind === 'added') added.set(item.itemId, item);
      else if (item.kind === 'changed') {
        invalid.push(issue(
          'move_changed_content',
          `Moves must relocate content exactly; item ${item.itemId} was modified.`,
          entry.date,
          item.itemId,
        ));
      }
    }
  }

  if (removed.size === 0) {
    invalid.push(issue('no_visible_diff', 'Move did not relocate any content.'));
    return { invalid, needsConfirmation: [] };
  }
  for (const [id, rem] of removed) {
    const arrival = added.get(id);
    if (!arrival) {
      invalid.push(issue(
        'move_lost_content',
        `Item ${id} left the source but never arrived at the destination.`,
        undefined,
        id,
      ));
    } else if (stableString(rem.before) !== stableString(arrival.after)) {
      invalid.push(issue(
        'move_changed_content',
        `Item ${id} changed while moving; moves must relocate content exactly.`,
        undefined,
        id,
      ));
    }
  }
  for (const id of added.keys()) {
    if (!removed.has(id)) {
      invalid.push(issue(
        'move_invented_content',
        `Item ${id} appeared at the destination without leaving the source.`,
        undefined,
        id,
      ));
    }
  }

  return { invalid, needsConfirmation: [] };
}

function isAllowedReplacementChange(
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>,
  sectionKind: CoachRevisionSectionKind,
): boolean {
  if (proposal.userIntent.intent !== 'replace' && proposal.userIntent.intent !== 'add') {
    return false;
  }
  return (proposal.userIntent.allowedAddedSectionKinds ?? []).includes(sectionKind);
}

function classifyWorkoutChange(
  before: CoachVisibleDaySnapshot,
  after: CoachVisibleDaySnapshot,
): CoachRevisionDateDiff['workoutChange'] {
  if (!before.workout && !after.workout) return 'unchanged';
  if (before.workout && !after.workout) return 'removed';
  if (!before.workout && after.workout) return 'added';
  if (!before.workout || !after.workout) return 'changed';
  if (stableString(before.workout) === stableString(after.workout)) return 'unchanged';
  if (before.workout.id !== after.workout.id) return 'replaced';
  return 'changed';
}

function findRefSignature(days: CoachVisibleDaySnapshot[], ref: string): string | null {
  // Finest granularity wins. An id can legitimately name both an item and
  // its containing workout (session items reuse the workout id so pure-day
  // projections round-trip). "Protect X" refers to the visible content X —
  // the ITEM — not the container, whose signature rightly changes whenever
  // any sibling is edited. Coarse-first resolution refused correct edits
  // (live 2026-07-02: protecting the team-training item resolved as the
  // whole workout and rejected a valid strength removal).
  for (const day of days) {
    for (const section of day.workout?.sections ?? []) {
      for (const item of section.items) {
        if (item.id === ref) return stableString(item);
      }
    }
  }
  for (const day of days) {
    for (const section of day.workout?.sections ?? []) {
      if (section.id === ref) return stableString(section);
    }
  }
  for (const day of days) {
    if (day.workout?.id === ref) return stableString(day.workout);
  }
  return null;
}

function flattenItems(sections: CoachVisibleSectionSnapshot[]): Array<{
  section: CoachVisibleSectionSnapshot;
  item: CoachVisibleItemSnapshot;
}> {
  return sections.flatMap((section) =>
    section.items.map((item) => ({ section, item })),
  );
}

function targetSectionKind(
  domain: CoachRevisionTargetDomain,
): CoachRevisionSectionKind | null {
  if (domain === 'strength') return 'strength';
  if (domain === 'conditioning') return 'conditioning';
  if (domain === 'recovery') return 'recovery';
  if (domain === 'session' || domain === 'team_training') return 'session';
  return null;
}

function isConservativeReduction(
  before: CoachVisibleItemSnapshot | undefined,
  after: CoachVisibleItemSnapshot | undefined,
): boolean {
  if (!before || !after) return false;
  if (before.title !== after.title) return false;
  const beforeRx = before.prescription;
  const afterRx = after.prescription;
  // A reduction may only lower numbers that existed before. If the snapshot
  // had no prescription there is nothing to reduce, but DROPPING an existing
  // prescription (or any of its populated fields) is silent nullification,
  // not a conservative reduction.
  if (!beforeRx) return true;
  if (!afterRx) return false;
  const setsOk = nullableNumberReducedOrSame(beforeRx.sets, afterRx.sets);
  const repsMinOk = nullableNumberReducedOrSame(beforeRx.repsMin, afterRx.repsMin);
  const repsMaxOk = nullableNumberReducedOrSame(beforeRx.repsMax, afterRx.repsMax);
  return setsOk && repsMinOk && repsMaxOk;
}

function nullableNumberReducedOrSame(before: number | null, after: number | null): boolean {
  if (before === null) return true;
  if (after === null) return false;
  return after <= before;
}

function validateProposalShape(value: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (value.schemaVersion !== COACH_REVISION_PROPOSAL_SCHEMA_VERSION) {
    issues.push('schemaVersion must be coach_revision_proposal.v1');
  }
  if (
    value.kind !== 'revision' &&
    value.kind !== 'clarify' &&
    value.kind !== 'not_an_edit' &&
    value.kind !== 'out_of_scope_setup'
  ) {
    issues.push('kind must be revision, clarify, not_an_edit, or out_of_scope_setup');
  }
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) {
    issues.push('confidence must be a number between 0 and 1');
  }

  if (value.kind === 'not_an_edit') {
    assertExactKeys(value, ['schemaVersion', 'kind', 'confidence', 'reason'], 'not_an_edit proposal', issues);
    if (typeof value.reason !== 'string' || value.reason.trim().length === 0) {
      issues.push('not_an_edit.reason is required');
    }
    return issues;
  }

  if (value.kind === 'out_of_scope_setup') {
    assertExactKeys(
      value,
      [...COACH_REVISION_PROPOSAL_SCHEMA.outOfScopeSetupTopLevelKeys],
      'out_of_scope_setup proposal',
      issues,
    );
    if (typeof value.reason !== 'string' || value.reason.trim().length === 0) {
      issues.push('out_of_scope_setup.reason is required');
    }
    if (typeof value.detectedChange !== 'string' || value.detectedChange.trim().length === 0) {
      issues.push('out_of_scope_setup.detectedChange is required');
    }
    return issues;
  }

  if (value.kind === 'clarify') {
    assertExactKeys(value, [...COACH_REVISION_PROPOSAL_SCHEMA.clarifyTopLevelKeys], 'clarify proposal', issues);
    if (typeof value.question !== 'string' || value.question.trim().length === 0) {
      issues.push('clarify.question is required');
    }
    if (!COACH_REVISION_PROPOSAL_SCHEMA.missingField.includes(value.missingField as any)) {
      issues.push('clarify.missingField is invalid');
    }
    if (!Array.isArray(value.candidateOptions)) {
      issues.push('clarify.candidateOptions must be an array');
    } else {
      for (const [index, candidate] of value.candidateOptions.entries()) {
        if (!isRecord(candidate)) {
          issues.push(`clarify.candidateOptions[${index}] must be an object`);
          continue;
        }
        assertExactKeys(candidate, ['id', 'label', 'value'], `clarify.candidateOptions[${index}]`, issues);
        if (typeof candidate.id !== 'string') issues.push(`clarify.candidateOptions[${index}].id is required`);
        if (typeof candidate.label !== 'string') issues.push(`clarify.candidateOptions[${index}].label is required`);
      }
    }
    if (value.partialIntent !== null && !isRevisionIntent(value.partialIntent)) {
      issues.push('clarify.partialIntent must be null or a valid intent');
    }
    if (typeof value.reason !== 'string') {
      issues.push('clarify.reason is required');
    }
    return issues;
  }

  if (value.kind === 'revision') {
    assertExactKeys(value, [...COACH_REVISION_PROPOSAL_SCHEMA.revisionTopLevelKeys], 'revision proposal', issues);
    if (value.source !== 'semantic') issues.push('revision.source must be semantic');
    if (!isRevisionIntent(value.userIntent)) issues.push('revision.userIntent is invalid');
    if (!isRecord(value.scope) || !Array.isArray(value.scope.dates)) {
      issues.push('revision.scope.dates is required');
    } else {
      assertExactKeys(value.scope, ['mode', 'dates'], 'revision.scope', issues);
      if (!COACH_REVISION_PROPOSAL_SCHEMA.scopeMode.includes(value.scope.mode as any)) {
        issues.push('revision.scope.mode is invalid');
      }
      if (!value.scope.dates.every((date) => typeof date === 'string')) {
        issues.push('revision.scope.dates must contain strings');
      }
    }
    if (!Array.isArray(value.revisedDays)) {
      issues.push('revision.revisedDays must be an array');
    } else {
      for (const [index, day] of value.revisedDays.entries()) {
        issues.push(...validateDayShape(day, `revision.revisedDays[${index}]`));
      }
    }
    if (typeof value.explanation !== 'string') {
      issues.push('revision.explanation is required');
    }
  }

  return issues;
}

function isRevisionIntent(value: unknown): value is CoachRevisionIntent {
  if (!isRecord(value)) return false;
  const allowed = [
    'intent',
    'targetDomain',
    'actionScope',
    'targetDates',
    'protectedRefs',
    'allowedAddedSectionKinds',
    'requiresConfirmation',
    'reason',
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return false;
  return (
    COACH_REVISION_PROPOSAL_SCHEMA.intent.includes(value.intent as any) &&
    COACH_REVISION_PROPOSAL_SCHEMA.targetDomain.includes(value.targetDomain as any) &&
    COACH_REVISION_PROPOSAL_SCHEMA.actionScope.includes(value.actionScope as any) &&
    Array.isArray(value.targetDates) &&
    value.targetDates.every((date) => typeof date === 'string') &&
    Array.isArray(value.protectedRefs) &&
    value.protectedRefs.every((ref) => typeof ref === 'string') &&
    (
      value.allowedAddedSectionKinds === undefined ||
      (
        Array.isArray(value.allowedAddedSectionKinds) &&
        value.allowedAddedSectionKinds.every((kind) =>
          COACH_REVISION_PROPOSAL_SCHEMA.sectionKind.includes(kind as any)
        )
      )
    ) &&
    (
      value.requiresConfirmation === undefined ||
      typeof value.requiresConfirmation === 'boolean'
    ) &&
    typeof value.reason === 'string'
  );
}

function validateDayShape(value: unknown, path: string): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return [`${path} must be an object`];
  assertExactKeys(value, ['date', 'workout'], path, issues);
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    issues.push(`${path}.date must be YYYY-MM-DD`);
  }
  if (value.workout === null) return issues;
  if (!isRecord(value.workout)) {
    issues.push(`${path}.workout must be null or an object`);
    return issues;
  }
  assertExactKeys(value.workout, ['id', 'title', 'workoutType', 'sections'], `${path}.workout`, issues);
  if (typeof value.workout.id !== 'string') issues.push(`${path}.workout.id is required`);
  if (typeof value.workout.title !== 'string') issues.push(`${path}.workout.title is required`);
  if (typeof value.workout.workoutType !== 'string') issues.push(`${path}.workout.workoutType is required`);
  if (!Array.isArray(value.workout.sections)) {
    issues.push(`${path}.workout.sections must be an array`);
  } else {
    for (const [index, section] of value.workout.sections.entries()) {
      issues.push(...validateSectionShape(section, `${path}.workout.sections[${index}]`));
    }
  }
  return issues;
}

function validateSectionShape(value: unknown, path: string): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return [`${path} must be an object`];
  assertExactKeys(value, ['id', 'kind', 'title', 'items'], path, issues);
  if (typeof value.id !== 'string') issues.push(`${path}.id is required`);
  if (!['strength', 'conditioning', 'recovery', 'session'].includes(String(value.kind))) {
    issues.push(`${path}.kind is invalid`);
  }
  if (typeof value.title !== 'string') issues.push(`${path}.title is required`);
  if (!Array.isArray(value.items)) {
    issues.push(`${path}.items must be an array`);
  } else {
    for (const [index, item] of value.items.entries()) {
      issues.push(...validateItemShape(item, `${path}.items[${index}]`));
    }
  }
  return issues;
}

function validateItemShape(value: unknown, path: string): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return [`${path} must be an object`];
  assertExactKeys(value, [
    'id',
    'title',
    'domain',
    'source',
    'description',
    'exerciseIds',
    'durationMinutes',
    'prescription',
  ], path, issues);
  if (typeof value.id !== 'string') issues.push(`${path}.id is required`);
  if (typeof value.title !== 'string') issues.push(`${path}.title is required`);
  if (!COACH_REVISION_PROPOSAL_SCHEMA.sectionKind.includes(value.domain as any)) {
    issues.push(`${path}.domain is invalid`);
  }
  if (typeof value.source !== 'string') issues.push(`${path}.source is required`);
  if (value.description !== null && typeof value.description !== 'string') {
    issues.push(`${path}.description must be null or string`);
  }
  if (!Array.isArray(value.exerciseIds) || !value.exerciseIds.every((id) => typeof id === 'string')) {
    issues.push(`${path}.exerciseIds must be string[]`);
  }
  if (value.durationMinutes !== null && typeof value.durationMinutes !== 'number') {
    issues.push(`${path}.durationMinutes must be null or number`);
  }
  if (value.prescription !== null) {
    if (!isRecord(value.prescription)) {
      issues.push(`${path}.prescription must be null or an object`);
    } else {
      assertExactKeys(value.prescription, [
        'sets',
        'repsMin',
        'repsMax',
        'intensity',
      ], `${path}.prescription`, issues);
      for (const key of ['sets', 'repsMin', 'repsMax']) {
        const item = value.prescription[key];
        if (item !== null && typeof item !== 'number') {
          issues.push(`${path}.prescription.${key} must be null or number`);
        }
      }
      const intensity = value.prescription.intensity;
      if (intensity !== null && typeof intensity !== 'string') {
        issues.push(`${path}.prescription.intensity must be null or string`);
      }
    }
  }
  return issues;
}

function findLinkedExercise(workout: Workout, ids: string[]): Workout['exercises'][number] | null {
  const idSet = new Set(ids);
  return (workout.exercises ?? []).find((row: any) =>
    idSet.has(String(row.id ?? '')) ||
    idSet.has(String(row.exerciseId ?? '')) ||
    idSet.has(String(row.exercise?.id ?? '')),
  ) ?? null;
}

function conditioningSectionTitle(
  items: VisibleProgramItem[],
  workout: Workout,
): string {
  if (items.length === 1) return items[0].title;
  return cleanText(workout.coachAddedConditioningLabel) || 'Conditioning';
}

function stableWorkoutId(day: ResolvedDay, workout: Workout): string {
  const explicit = cleanText(workout.id);
  if (explicit) return explicit;
  // Name-based IDs are only stable while the name is stable: a rename changes
  // identity mid-conversation and breaks protected-ref/ID checks. Warn loudly
  // so live testing reveals whether real programs ever reach this branch —
  // if it fires, guaranteeing workout.id at generation becomes a Stage 3
  // prerequisite.
  logger.warn('[coach-revision-snapshot] name_based_workout_id_fallback', {
    date: day.date,
    name: workout.name,
  });
  return `workout:${day.date}:${normaliseKey(workout.name)}`;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function issue(
  code: string,
  message: string,
  date?: string,
  ref?: string,
): CoachRevisionValidationIssue {
  return { code, message, date, ref };
}

/** Body signature of a section: content identity EXCLUDING the section id,
 *  which legitimately varies by date/workout. Used to match added sections
 *  against the app's template registry byte-exactly. */
export function coachRevisionSectionBodySignature(
  section: CoachVisibleSectionSnapshot,
): string {
  return stableString({
    kind: section.kind,
    title: section.title,
    items: section.items,
  });
}

/**
 * Canonical content signature: recursive key-sorted serialization, so two
 * structurally equal values always produce identical strings and any content
 * difference produces different ones. Replaces the old global-key-allowlist
 * replacer (3D hardening gate) — signatures now authorize template additions,
 * so collisions/omissions would let non-registry content through.
 */
function stableString(value: unknown): string {
  return canonicalJson(value);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: string[],
  path: string,
  issues: string[],
): void {
  const allowed = new Set(expected);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push(`${path}.${key} is not allowed`);
  }
  for (const key of expected) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      issues.push(`${path}.${key} is required`);
    }
  }
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normaliseKey(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}
