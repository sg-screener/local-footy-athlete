/**
 * planChangeProducer — deterministic proposal producer for the tap-first
 * plan-change sheet (ATHLETE_CHANGE_VOCABULARY.md, group 1).
 *
 * The sheet is the SECOND door into program mutation. Registry-backed
 * add/stack/swap actions produce the same CoachRevisionProposal as chat and
 * retain the shared revision writer/policy. Athlete move/delete actions are
 * owned end-to-end by their typed accepted-state transactions. No LLM, no
 * interpretation: the athlete tapped the day (no date ambiguity), picked the
 * action (no intent ambiguity), and chose from listed options.
 *
 * Invariant the tests enforce: EVERY option this module offers builds a
 * proposal that passes validateCoachRevisionDiff under the shared policy.
 * The menu may never show something the validator would reject.
 */

import type { ResolvedDay } from './sessionResolver';
import { getMondayForDate } from './sessionResolver';
import { splitSessionName } from './sessionNaming';
import type { OverrideContext, UserRemovalScope, Workout } from '../types/domain';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import {
  COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  snapshotProjectedDay,
  type CoachRevisionProposal,
  type CoachRevisionProtectedAnchorKind,
  type CoachRevisionSectionKind,
  type CoachVisibleDaySnapshot,
  type CoachVisibleWorkoutSnapshot,
} from './coachRevisionProposal';
import {
  listCoachRevisionTemplates,
  visibleDayLooksLikeGame,
  type CoachRevisionTemplateDefinition,
} from './coachRevisionTemplates';
import {
  byeUnlockedDatesForWeek,
  coachRevisionValidationPolicyForWeek,
  protectedAnchorsForDaySnapshot,
} from './coachRevisionPolicy';
import {
  applyCoachRevisionDateOverrides,
  type CoachRevisionOverrideRejection,
} from './coachRevisionOverrideWriter';
import { materializeCanonicalPlanChangeCandidate } from './canonicalPlanChangeCandidateMaterializer';
import { validateLiveWorkoutWrite } from './postGenerationConstraintValidation';
import { finaliseWorkoutAfterMutation } from './workoutCanonicalisation';
import type {
  PlanChange,
  PlanChangeBinScopeId,
  PlanChangeCategoryId,
  TemplatePlanChange,
} from './planChangeTypes';
export type {
  PlanChange,
  PlanChangeBinScopeId,
  PlanChangeCategoryId,
} from './planChangeTypes';
import type { ProgramEditRiskAssessment } from './programEditRiskAssessment';
import { assessProgramEditWrites } from './programEditWriteGuard';
import { reduceAcceptedSessionForAthleteRemoval } from './sessionComponents';
import type { ValidateProgramWeekInput } from '../rules/weekStructureValidator';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { useProfileStore } from '../store/profileStore';
import {
  commitAthleteSessionMoveTransaction,
  commitAthleteSessionDeletionTransaction,
  stageAthleteSessionDeletionTransaction,
  stageAthleteSessionMoveTransaction,
  type AcceptedStateTransactionResult,
  type AthleteDeletionPublishedOutcome,
  type AthleteSessionDeletionTransactionInput,
  type AthleteSessionMoveTransactionInput,
} from '../store/acceptedStateTransaction';
import {
  athleteActionDiagnosticHash,
  athleteActionDiagnosticsEnabled,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionTraceContext,
  type AthleteActionType,
} from './athleteActionDiagnostics';

// ── Edit horizon ──
// Sam 2026-07-03: athletes change this week and at most the next two —
// matches the 3–4 week rolling coaching model. Beyond that: view-only.
export const PLAN_CHANGE_EDIT_HORIZON_WEEKS = 3;

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function isWithinEditHorizon(dateISO: string, todayISO: string): boolean {
  const startMonday = getMondayForDate(todayISO);
  const endSunday = addDaysISO(startMonday, PLAN_CHANGE_EDIT_HORIZON_WEEKS * 7 - 1);
  return dateISO >= startMonday && dateISO <= endSunday;
}

// ── Change + option types ──

/**
 * Sheet-v2 categories (russian dolls). The athlete picks a CATEGORY; this
 * module picks the concrete session deterministically — policy filters +
 * variety + date-seeded rotation. "AI picks" without an LLM in the path.
 *
 * 'conditioning_sprint' and the strength buckets arrive in later phases
 * (sprint waits on RUNNING_RULES_PLAN.md; strength on generation wiring).
 */
export interface PlanChangeCategoryOption {
  id: PlanChangeCategoryId;
  label: string;
  sub: string;
}

/** Which registry templates back each category. Multi-template categories
 *  ("Upper body", "Accessories") are where the producer's deterministic
 *  pick earns its keep — variety first, date-seeded rotation second. */
const CATEGORY_TEMPLATE_MATCH: Record<
  PlanChangeCategoryId,
  (template: CoachRevisionTemplateDefinition) => boolean
> = {
  conditioning_light: (t) => t.category === 'flush',
  conditioning_hard: (t) => t.category === 'work_capacity',
  recovery: (t) => t.category === 'recovery',
  strength_upper: (t) =>
    t.templateId === 'strength_upper_push' || t.templateId === 'strength_upper_pull',
  strength_lower: (t) => t.templateId === 'strength_lower',
  strength_full: (t) => t.templateId === 'strength_full_body',
  accessories: (t) => t.category === 'accessories',
};

const CATEGORY_COPY: Record<PlanChangeCategoryId, { label: string; sub: string }> = {
  conditioning_light: {
    label: 'Light session',
    sub: 'Easy flush - bike, row or ski',
  },
  conditioning_hard: {
    label: 'Hard session',
    sub: 'Work capacity, off legs',
  },
  recovery: {
    label: 'Recovery',
    sub: 'Rolling, mobility, easy movement, breathing',
  },
  strength_upper: {
    label: 'Upper body',
    sub: 'Push or pull - whichever your week is missing',
  },
  strength_lower: {
    label: 'Lower body',
    sub: 'Squat and hinge strength',
  },
  strength_full: {
    label: 'Full body',
    sub: 'Compound push, pull, squat and carry',
  },
  accessories: {
    label: 'Accessories',
    sub: 'Gunshow or prehab - small muscles, big payoff',
  },
};

const MAX_VISIBLE_SESSIONS_PER_DAY = 2;

type VisibleSessionKind = CoachRevisionSectionKind;

function visibleSessionKindsForWorkout(
  workout: CoachVisibleWorkoutSnapshot | null,
): VisibleSessionKind[] {
  return Array.from(
    new Set((workout?.sections ?? []).map((section) => section.kind)),
  );
}

function visibleSessionKindsForSnapshot(
  snap: CoachVisibleDaySnapshot,
): VisibleSessionKind[] {
  return visibleSessionKindsForWorkout(snap.workout);
}

function hasProtectedAnchors(snap: CoachVisibleDaySnapshot): boolean {
  return protectedAnchorsForDaySnapshot(snap).length > 0;
}

function categoryAddsSessionKind(category: PlanChangeCategoryId): VisibleSessionKind {
  if (category === 'recovery') return 'recovery';
  if (category.startsWith('strength_') || category === 'accessories') return 'strength';
  return 'conditioning';
}

function templateAddsSessionKind(
  category: CoachRevisionTemplateDefinition['category'],
): VisibleSessionKind {
  if (category === 'recovery') return 'recovery';
  if (category === 'strength' || category === 'accessories') return 'strength';
  return 'conditioning';
}

/**
 * Bin scopes (sheet v2 phase 3): multi-session days offer WHICH part to
 * bin. 'team' maps to the snapshot's zero-row 'session' commitment section
 * ("Team Training + Upper Pull" days) — binnable like anything else, for
 * that single date only (Sam 2026-07-03: recurring team schedule and
 * future weeks untouched).
 */
export interface PlanChangeBinScope {
  id: PlanChangeBinScopeId;
  label: string;
  sub: string;
}

export interface PlanChangeMoveDestination {
  date: string;
  /** Name of the session currently on that day, or null for a rest day.
   *  Occupied destinations SWAP with the source day (sheet v2). */
  occupiedBy: string | null;
}

export interface PlanChangeDayOptions {
  date: string;
  /** Why the menu is empty, when it is. */
  locked: null | 'outside_horizon' | 'game_day' | 'not_visible';
  hasSession: boolean;
  canRemove: boolean;
  /** Registry templates legal for this date (bye gating applied). */
  templates: CoachRevisionTemplateDefinition[];
  /** Sheet-v2 categories legal for this date (derived from `templates`). */
  categories: PlanChangeCategoryOption[];
  /** Legal move destinations inside the horizon: every non-game day, rest
   *  days FIRST (they're the cheapest move), then occupied days (swap). */
  moveDestinations: PlanChangeMoveDestination[];
  /** Bin scopes: parts of the day binnable individually. Single-part days
   *  offer only whole_day; multi-session days list each part, whole last. */
  binScopes: PlanChangeBinScope[];
  /** Categories addable ON TOP of this day. Empty when the day already has
   *  two visible parts, has no snapshot sections to preserve, or is locked.
   *  Rest days instead use `categories` via the normal add flow. */
  addOnTopCategories: PlanChangeCategoryOption[];
  /** Visible session parts on this day. The sheet uses this for friendly
   *  add-flow blockers; the producer still enforces the same rules below. */
  visibleSessionCount: number;
  visibleSessionKinds: VisibleSessionKind[];
}

// ── Options listing ──
// The menu IS the policy: bye-only templates appear only on bye-week dates,
// nothing appears outside the horizon, destinations are only rest days.

export function listPlanChangeOptionsForDay(args: {
  visibleWeek: ResolvedDay[];
  date: string;
  todayISO: string;
}): PlanChangeDayOptions {
  const empty = (locked: PlanChangeDayOptions['locked']): PlanChangeDayOptions => ({
    date: args.date,
    locked,
    hasSession: false,
    canRemove: false,
    templates: [],
    categories: [],
    moveDestinations: [],
    binScopes: [],
    addOnTopCategories: [],
    visibleSessionCount: 0,
    visibleSessionKinds: [],
  });

  const day = args.visibleWeek.find((d) => d.date === args.date);
  if (!day) return empty('not_visible');
  if (!isWithinEditHorizon(args.date, args.todayISO)) return empty('outside_horizon');

  const snap = snapshotProjectedDay(day);
  if (visibleDayLooksLikeGame(snap)) return empty('game_day');

  // Athlete override principle: EVERY registry template is offered on
  // every editable day. Game-week / volume caution is expressed as a
  // warning at the point of choice (planChangeWarningForCategory), never
  // by hiding options.
  const templates = listCoachRevisionTemplates();

  // Sheet-v2 categories: a category is offered iff at least one template
  // backs it.
  const categories = (
    Object.keys(CATEGORY_COPY) as PlanChangeCategoryId[]
  )
    .filter((id) => templates.some(CATEGORY_TEMPLATE_MATCH[id]))
    .map((id) => ({ id, ...CATEGORY_COPY[id] }));

  const hasSession = snap.workout !== null;
  const sourceHasProtectedAnchors = hasProtectedAnchors(snap);
  // Every non-anchor day in horizon is a destination. Rest days come first
  // (a plain move); occupied days follow (an atomic two-day swap).
  const moveDestinations: PlanChangeMoveDestination[] =
    hasSession && !sourceHasProtectedAnchors
    ? args.visibleWeek
        .filter((candidate) =>
          candidate.date !== args.date &&
          isWithinEditHorizon(candidate.date, args.todayISO) &&
          !hasProtectedAnchors(snapshotProjectedDay(candidate)))
        .map((candidate) => ({
          date: candidate.date,
          occupiedBy: snapshotProjectedDay(candidate).workout?.title ?? null,
        }))
        .sort((a, b) =>
          (a.occupiedBy === null) === (b.occupiedBy === null)
            ? a.date.localeCompare(b.date)
            : a.occupiedBy === null ? -1 : 1)
    : [];

  // Add-on-top: strength and conditioning can stack until the day has two
  // visible parts. Duplicate strength+strength or conditioning+conditioning
  // is still blocked; rest is owned by bin/remove rather than add.
  const visibleSessionKinds = visibleSessionKindsForSnapshot(snap);
  const visibleSessionCount = visibleSessionKinds.length;
  const canAddOnTop =
    hasSession &&
    visibleSessionCount > 0 &&
    visibleSessionCount < MAX_VISIBLE_SESSIONS_PER_DAY;

  return {
    date: args.date,
    locked: null,
    hasSession,
    canRemove: hasSession,
    templates,
    categories,
    moveDestinations,
    binScopes: hasSession ? binScopesForSnapshot(snap) : [],
    addOnTopCategories: canAddOnTop
      ? categories.filter((category) => {
          const addedKind = categoryAddsSessionKind(category.id);
          if (addedKind === 'recovery') return false;
          return !visibleSessionKinds.includes(addedKind);
        })
      : [],
    visibleSessionCount,
    visibleSessionKinds,
  };
}

// ── Bin scopes ──
// Which parts of a day can be binned individually. Derived from the day
// snapshot's sections: a day with two or more visible parts (strength /
// conditioning / recovery / team commitment) offers each part plus the
// whole day; single-part days offer only the whole day.

const BIN_SCOPE_FOR_SECTION_KIND: Record<
  string,
  { id: PlanChangeBinScopeId; label: string; sub: string }
> = {
  strength: {
    id: 'strength',
    label: 'Just the gym session',
    sub: 'The rest of the day stays',
  },
  conditioning: {
    id: 'conditioning',
    label: 'Just the conditioning',
    sub: 'The rest of the day stays',
  },
  recovery: {
    id: 'recovery',
    label: 'Just the recovery work',
    sub: 'The rest of the day stays',
  },
  session: {
    id: 'team',
    label: 'Just team training',
  sub: "Can't make it tonight - this date only",
  },
};

const WHOLE_DAY_SCOPE: PlanChangeBinScope = {
  id: 'whole_day',
  label: 'The whole day',
  sub: 'Everything - the day becomes rest',
};

function binScopesForSnapshot(
  snap: CoachVisibleDaySnapshot,
): PlanChangeBinScope[] {
  const kinds = Array.from(
    new Set((snap.workout?.sections ?? []).map((section) => section.kind)),
  );
  const parts = kinds
    .map((kind) => BIN_SCOPE_FOR_SECTION_KIND[kind])
    .filter((scope): scope is PlanChangeBinScope => !!scope);
  const anchors = protectedAnchorsForDaySnapshot(snap);
  if (anchors.some((anchor) => anchor.kind === 'team_training')) {
    return parts;
  }
  if (anchors.length > 0) return [];
  if (kinds.length < 2) return [WHOLE_DAY_SCOPE];
  return [...parts, WHOLE_DAY_SCOPE];
}

/** Snapshot section kind a bin scope removes. */
function sectionKindForBinScope(scope: PlanChangeBinScopeId): string | null {
  if (scope === 'whole_day') return null;
  return scope === 'team' ? 'session' : scope;
}

// ── Deterministic category pick ──
// The athlete picked a category; we pick the session. Filters first
// (registry category + bye gating), then variety (avoid a session that's
// already visible this week), then date-seeded rotation so the same day
// always resolves the same pick but different days rotate the registry.

function dateSeed(dateISO: string): number {
  let hash = 0;
  for (let i = 0; i < dateISO.length; i++) {
    hash = (hash * 31 + dateISO.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pickTemplateForCategory(args: {
  category: PlanChangeCategoryId;
  date: string;
  visibleWeek: ResolvedDay[];
}): CoachRevisionTemplateDefinition | null {
  // No bye filter here — athlete override principle. The warning owner
  // below is the only place game-week caution lives.
  const candidates = listCoachRevisionTemplates().filter(
    CATEGORY_TEMPLATE_MATCH[args.category],
  );
  if (candidates.length === 0) return null;

  // Variety: prefer candidates not already sitting on a visible day.
  const weekNames = new Set(
    args.visibleWeek
      .map((day) => day.workout?.name ?? '')
      .filter(Boolean),
  );
  const fresh = candidates.filter((template) => !weekNames.has(template.label));
  const pool = fresh.length > 0 ? fresh : candidates;

  return pool[dateSeed(args.date) % pool.length];
}

/** Resolve category intent once so proposal production and override
 * materialisation consume the identical concrete template change. */
export function resolveTemplatePlanChange(args: {
  change: PlanChange;
  visibleWeek: ResolvedDay[];
}): TemplatePlanChange | null {
  if (args.change.kind === 'swap_template' || args.change.kind === 'add_template') {
    return args.change;
  }
  if (args.change.kind !== 'swap_category' && args.change.kind !== 'add_category') {
    return null;
  }
  const picked = pickTemplateForCategory({
    category: args.change.category,
    date: args.change.date,
    visibleWeek: args.visibleWeek,
  });
  if (!picked) return null;
  return args.change.kind === 'swap_category'
    ? { kind: 'swap_template', date: args.change.date, templateId: picked.templateId }
    : { kind: 'add_template', date: args.change.date, templateId: picked.templateId };
}

// ── Advisory warnings ──
// The athlete can pick anything; the coach still gets a word in first.
// SINGLE owner of the warning copy + trigger rules — the sheet renders
// whatever this returns and never invents its own caution.

export interface PlanChangeWarning {
  code: 'game_week_fresh' | 'burnout_volume';
  message: string;
}

/** Labels of the hard (work-capacity) registry sessions, for counting
 *  how much hard work already sits on a week. */
function hardSessionLabels(): Set<string> {
  return new Set(
    listCoachRevisionTemplates()
      .filter((template) => template.category === 'work_capacity')
      .map((template) => template.label),
  );
}

export function planChangeWarningForCategory(args: {
  category: PlanChangeCategoryId;
  date: string;
  visibleWeek: ResolvedDay[];
}): PlanChangeWarning | null {
  if (args.category !== 'conditioning_hard') return null;

  // Game week (the date's Monday-week contains a game): freshness first.
  const byeDates = new Set(byeUnlockedDatesForWeek(args.visibleWeek));
  if (!byeDates.has(args.date)) {
    return {
      code: 'game_week_fresh',
      message:
        "Make sure you don't overdo it - we want you fresh for game day.",
    };
  }

  // No game, but the week is already loaded with hard work: burnout.
  const monday = getMondayForDate(args.date);
  const hardLabels = hardSessionLabels();
  const hardCount = args.visibleWeek.filter((day) =>
    getMondayForDate(day.date) === monday &&
    !!day.workout &&
    (hardLabels.has(day.workout.name) || day.workout.intensity === 'High'),
  ).length;
  if (hardCount >= 2) {
    return {
      code: 'burnout_volume',
      message:
        "That's a lot of hard work in one week. Adding more risks burnout - keep something in the tank.",
    };
  }

  return null;
}

// ── Proposal building ──

export function buildPlanChangeProposal(
  change: PlanChange,
  ctx: { visibleWeek: ResolvedDay[]; todayISO?: string },
): CoachRevisionProposal | { error: string } {
  const daySnap = (date: string): CoachVisibleDaySnapshot | null => {
    const day = ctx.visibleWeek.find((d) => d.date === date);
    return day ? snapshotProjectedDay(day) : null;
  };

  const protectedRefsForDates = (
    dates: string[],
    excludedKinds: CoachRevisionProtectedAnchorKind[] = [],
  ): string[] => {
    const excluded = new Set(excludedKinds);
    return Array.from(new Set(dates.flatMap((date) => {
      const snap = daySnap(date);
      if (!snap) return [];
      return protectedAnchorsForDaySnapshot(snap)
        .filter((anchor) => !excluded.has(anchor.kind))
        .map((anchor) => anchor.ref);
    })));
  };

  const revision = (args: {
    intent: 'add' | 'remove' | 'replace' | 'move';
    targetDomain: 'session' | 'conditioning' | 'recovery' | 'strength' | 'team_training';
    dates: string[];
    revisedDays: CoachVisibleDaySnapshot[];
    explanation: string;
    protectedRefs?: string[];
    actionScope?:
      | 'whole_session'
      | 'strength_section'
      | 'conditioning_section'
      | 'recovery_section'
      | 'session';
  }): CoachRevisionProposal => ({
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    kind: 'revision',
    source: 'semantic',
    confidence: 1,
    userIntent: {
      intent: args.intent,
      targetDomain: args.targetDomain,
      actionScope: args.actionScope ?? 'whole_session',
      targetDates: args.dates,
      protectedRefs: args.protectedRefs ?? protectedRefsForDates(args.dates),
      requiresConfirmation: false,
      reason: `plan_change_sheet:${change.kind}`,
    },
    scope: {
      mode: args.dates.length > 1 ? 'visible_week' : 'single_day',
      dates: args.dates,
    },
    revisedDays: args.revisedDays,
    explanation: args.explanation,
  });

  switch (change.kind) {
    // Category kinds resolve to a concrete template pick, then delegate to
    // the template cases — one build path, no duplicate proposal logic.
    case 'swap_category':
    case 'add_category': {
      const resolved = resolveTemplatePlanChange({ change, visibleWeek: ctx.visibleWeek });
      if (!resolved) return { error: 'no_template_for_category' };
      return buildPlanChangeProposal(resolved, ctx);
    }
    case 'remove_session': {
      const before = daySnap(change.date);
      if (!before?.workout) return { error: 'nothing_to_remove' };
      const scope = change.scope ?? 'whole_day';
      const removeKind = sectionKindForBinScope(scope);
      const anchors = protectedAnchorsForDaySnapshot(before);
      if (anchors.some((anchor) => anchor.kind === 'game')) {
        return { error: 'protected_anchor_day' };
      }
      if (scope === 'whole_day' && anchors.length > 0) {
        return { error: 'protected_anchor_day' };
      }

      // Whole day (or a partial scope that would leave nothing): rest.
      const surviving = removeKind
        ? before.workout.sections.filter((section) => section.kind !== removeKind)
        : [];
      if (!removeKind || surviving.length === 0) {
        if (anchors.length > 0 && scope !== 'team') {
          return { error: 'protected_anchor_day' };
        }
        return revision({
          intent: 'remove',
          targetDomain: scope === 'team' ? 'team_training' : 'session',
          actionScope: scope === 'team' ? 'session' : 'whole_session',
          dates: [change.date],
          revisedDays: [{ date: change.date, workout: null }],
          protectedRefs: scope === 'team'
            ? protectedRefsForDates([change.date], ['team_training'])
            : protectedRefsForDates([change.date]),
          explanation: 'Sheet: remove session',
        });
      }
      if (surviving.length === before.workout.sections.length) {
        return { error: 'scope_not_on_day' };
      }

      // Partial bin: the day keeps its other parts. Title follows the
      // survivors — the canonical name's strength half when strength
      // survives, otherwise the surviving section's own title.
      const survivorTitle = surviving.some((section) => section.kind === 'strength')
        ? splitSessionName(before.workout.title).title || before.workout.title
        : surviving[0].title || before.workout.title;
      const survivorWorkoutType =
        surviving.every((section) => section.kind === 'session')
          ? before.workout.workoutType
          : surviving.some((section) => section.kind === 'strength')
          ? 'Strength'
          : surviving.some((section) => section.kind === 'conditioning')
          ? 'Conditioning'
          : 'Recovery';

      // scope !== 'whole_day' is guaranteed here (removeKind non-null).
      const partialScope = scope as Exclude<PlanChangeBinScopeId, 'whole_day'>;
      return revision({
        intent: 'remove',
        targetDomain: partialScope === 'team' ? 'team_training' : partialScope,
        actionScope: partialScope === 'team' ? 'session' : `${partialScope}_section`,
        dates: [change.date],
        revisedDays: [{
          date: change.date,
          workout: {
            ...before.workout,
            title: survivorTitle,
            workoutType: survivorWorkoutType,
            sections: surviving,
          },
        }],
        protectedRefs: partialScope === 'team'
          ? protectedRefsForDates([change.date], ['team_training'])
          : protectedRefsForDates([change.date]),
        explanation: `Sheet: bin ${scope} only`,
      });
    }
    case 'swap_template': {
      const before = daySnap(change.date);
      if (!before?.workout) return { error: 'nothing_to_swap' };
      if (visibleDayLooksLikeGame(before)) return { error: 'protected_anchor_day' };
      const currentDay = ctx.visibleWeek.find((day) => day.date === change.date)!;
      const materialized = materializeCanonicalPlanChangeCandidate({
        change,
        currentDay,
        todayISO: ctx.todayISO ?? change.date,
        canonicalizeWorkout: (date, workout) => validateLiveWorkoutWrite(date, workout),
      });
      if (materialized.ok === false) return { error: materialized.code };
      return revision({
        intent: 'replace',
        targetDomain: 'session',
        dates: [change.date],
        revisedDays: [materialized.projectedDay],
        explanation:
          `Sheet: swap in ${materialized.projectedDay.workout?.title ?? change.templateId}`,
      });
    }
    case 'add_template': {
      const before = daySnap(change.date);
      if (before === null) return { error: 'not_visible' };
      const definition = listCoachRevisionTemplates()
        .find((template) => template.templateId === change.templateId);
      if (!definition) return { error: 'unknown_template' };

      // Occupied day: STACK the template on top. The day can carry at most
      // two visible parts, and add never duplicates an existing strength or
      // conditioning part. The day must have real sections to preserve
      // (otherwise this would silently become a pure-template replacement
      // in the writer).
      if (before.workout) {
        if (visibleDayLooksLikeGame(before)) return { error: 'protected_anchor_day' };
        const kinds = visibleSessionKindsForWorkout(before.workout);
        const addedKind = templateAddsSessionKind(definition.category);
        if (before.workout.sections.length === 0 || kinds.length === 0) {
          return { error: 'day_not_stackable' };
        }
        if (kinds.length >= MAX_VISIBLE_SESSIONS_PER_DAY) {
          return { error: 'max_sessions_exceeded' };
        }
        if (definition.category === 'recovery') {
          return { error: 'recovery_stack_not_supported' };
        }
        if (addedKind === 'strength' && kinds.includes('strength')) {
          return { error: 'day_already_has_strength' };
        }
        if (addedKind === 'conditioning' && kinds.includes('conditioning')) {
          return { error: 'day_already_has_conditioning' };
        }
        const currentDay = ctx.visibleWeek.find((day) => day.date === change.date)!;
        const materialized = materializeCanonicalPlanChangeCandidate({
          change,
          currentDay,
          todayISO: ctx.todayISO ?? change.date,
          canonicalizeWorkout: (date, workout) => validateLiveWorkoutWrite(date, workout),
        });
        if (materialized.ok === false) return { error: materialized.code };
        return revision({
          intent: 'add',
          targetDomain: addedKind === 'strength' ? 'strength' : 'conditioning',
          dates: [change.date],
          revisedDays: [materialized.projectedDay],
          explanation:
            `Sheet: add ${materialized.projectedDay.workout?.title ?? definition.label} on top`,
        });
      }

      const currentDay = ctx.visibleWeek.find((day) => day.date === change.date)!;
      const materialized = materializeCanonicalPlanChangeCandidate({
        change,
        currentDay,
        todayISO: ctx.todayISO ?? change.date,
        canonicalizeWorkout: (date, workout) => validateLiveWorkoutWrite(date, workout),
      });
      if (materialized.ok === false) return { error: materialized.code };

      return revision({
        intent: 'add',
        // The validator checks the change landed in the declared domain.
        targetDomain:
          definition.category === 'recovery'
            ? 'recovery'
            : definition.category === 'strength' || definition.category === 'accessories'
            ? 'strength'
            : 'conditioning',
        dates: [change.date],
        revisedDays: [materialized.projectedDay],
        explanation: `Sheet: add ${materialized.projectedDay.workout?.title ?? definition.label}`,
      });
    }
    case 'shutdown_week': {
      // Bed-ridden: everything from today to the end of the date's week
      // becomes rest. Anchors are left alone (their own flows own them),
      // past days are history, rest days need nothing.
      const monday = getMondayForDate(change.date);
      const cutoff = ctx.todayISO ?? change.date;
      const toClear = ctx.visibleWeek.filter((day) => {
        if (getMondayForDate(day.date) !== monday) return false;
        if (day.date < cutoff) return false;
        const snap = snapshotProjectedDay(day);
        return snap.workout !== null && !hasProtectedAnchors(snap);
      });
      if (toClear.length === 0) return { error: 'nothing_to_clear' };
      return revision({
        intent: 'remove',
        targetDomain: 'session',
        dates: toClear.map((day) => day.date),
        revisedDays: toClear.map((day) => ({ date: day.date, workout: null })),
        explanation: 'Sheet: sick - clear the rest of the week',
      });
    }
    case 'clear_days': {
      // Away / holiday: clear the exact days the athlete picked. Only
      // real, non-anchor sessions inside the visible week are cleared —
      // rest days and anchors are skipped. All-or-nothing like every other
      // producer change; an empty result is an honest error, never a
      // silent no-op.
      const wanted = new Set(change.dates);
      const toClear = ctx.visibleWeek.filter((day) => {
        if (!wanted.has(day.date)) return false;
        const snap = snapshotProjectedDay(day);
        return snap.workout !== null && !hasProtectedAnchors(snap);
      });
      if (toClear.length === 0) return { error: 'nothing_to_clear' };
      return revision({
        intent: 'remove',
        targetDomain: 'session',
        dates: toClear.map((day) => day.date),
        revisedDays: toClear.map((day) => ({ date: day.date, workout: null })),
        explanation: 'Sheet: away - clear the chosen days',
      });
    }
    case 'move_session': {
      const source = daySnap(change.fromDate);
      const destination = daySnap(change.toDate);
      if (!source?.workout) return { error: 'nothing_to_move' };
      if (!destination) return { error: 'not_visible' };
      if (hasProtectedAnchors(source) || hasProtectedAnchors(destination)) {
        return { error: 'protected_anchor_day' };
      }
      // Occupied destination = the two days SWAP atomically (sheet v2);
      // empty destination = plain move, source becomes rest.
      return revision({
        intent: 'move',
        targetDomain: 'session',
        dates: [change.fromDate, change.toDate],
        revisedDays: [
          { date: change.fromDate, workout: destination.workout ?? null },
          { date: change.toDate, workout: source.workout },
        ],
        explanation: destination.workout
          ? 'Sheet: swap two days'
          : 'Sheet: move session',
      });
    }
  }
}

// ── Apply ──
// Same writer, same shared policy as the chat door. The tap that chose the
// option IS the confirmation, so requireConfirmationForAdds is satisfied
// exactly the way the chat door's stored-"yes" is.

export interface PlanChangeApplyResult {
  ok: boolean;
  message: string;
  appliedDates: string[];
  rejected: Array<{ date: string | null; code: string; reason: string }>;
  traceId?: string;
  internalResultCode?: string;
  uiMessageKey?: string;
}

export interface PlanChangeRiskPreviewResult {
  ok: boolean;
  message: string;
  appliedDates: string[];
  rejected: Array<{ date: string | null; code: string; reason: string }>;
  proposedWeek: ResolvedDay[];
  assessment: ProgramEditRiskAssessment;
  /** Correlation context reused by the real commit door. */
  trace: AthleteActionTraceContext;
}

function validationPolicyForPlanChange(
  visibleWeek: ResolvedDay[],
  todayISO: string,
) {
  return {
    ...coachRevisionValidationPolicyForWeek(visibleWeek, todayISO),
    requireConfirmationForAdds: false,
  };
}

function rejectedForResult(
  rejected: CoachRevisionOverrideRejection[],
): PlanChangeApplyResult['rejected'] {
  return rejected.map((entry) => ({
    date: entry.date ?? null,
    code: entry.code,
    reason: entry.reason,
  }));
}

function withPreviewWrites(
  visibleWeek: ResolvedDay[],
  writes: Array<{ date: string; workout: Workout }>,
): ResolvedDay[] {
  const byDate = new Map(writes.map((write) => [write.date, write.workout]));
  return visibleWeek.map((day) => (
    byDate.has(day.date)
      ? {
          ...day,
          workout: byDate.get(day.date) ?? null,
          source: 'manual' as const,
        }
      : day
  ));
}

function proposedWeekFromAcceptedStage(args: {
  visibleWeek: ResolvedDay[];
  staged: AcceptedStateTransactionResult;
  profile?: ValidateProgramWeekInput['profile'];
}): ResolvedDay[] {
  const weeks = new Map<string, Map<number, Workout>>();
  for (const day of args.visibleWeek) {
    const weekStart = getMondayForDate(day.date);
    if (weeks.has(weekStart)) continue;
    const accepted = rebaseAcceptedEffectiveWeek({
      surfaces: args.staged.program,
      weekStart,
      profile: args.profile ?? useProfileStore.getState().onboardingData,
      markedDays: args.staged.context.markedDays,
    });
    weeks.set(weekStart, new Map(accepted.visibleWorkouts.map((workout) =>
      [workout.dayOfWeek, workout])));
  }
  return args.visibleWeek.map((day) => {
    const acceptedByDay = weeks.get(getMondayForDate(day.date));
    if (!acceptedByDay) return day;
    return {
      ...day,
      workout: acceptedByDay.get(new Date(`${day.date}T12:00:00`).getDay()) ?? null,
      source: 'manual' as const,
    };
  });
}

function athleteMoveInput(args: {
  change: Extract<PlanChange, { kind: 'move_session' }>;
  visibleWeek: ResolvedDay[];
  source: 'tap' | 'coach';
}): AthleteSessionMoveTransactionInput | null {
  const sourceWorkout = args.visibleWeek.find((day) =>
    day.date === args.change.fromDate)?.workout ?? null;
  if (!sourceWorkout) return null;
  return {
    sourceDate: args.change.fromDate,
    targetDate: args.change.toDate,
    reason: `${args.source}:move_session:${args.change.fromDate}:${args.change.toDate}`,
    source: args.source,
    acceptedSourcePlanEntryId: sourceWorkout.planEntryId ?? null,
    sourceWorkoutId: sourceWorkout.id,
    originalSourceWorkout: sourceWorkout,
    existingTargetWorkout: args.visibleWeek.find((day) =>
      day.date === args.change.toDate)?.workout ?? null,
    scope: 'whole_session',
  };
}

const ATHLETE_REMOVAL_SCOPE: Record<PlanChangeBinScopeId, UserRemovalScope> = {
  whole_day: 'whole_session',
  strength: 'strength_component',
  conditioning: 'conditioning_component',
  recovery: 'recovery_component',
  team: 'team_component',
};

type AthleteOwnedPlanChange = Extract<PlanChange,
  { kind: 'move_session' } | { kind: 'remove_session' } |
  { kind: 'swap_category' } | { kind: 'swap_template' }>;

export type AthleteMutationResolution =
  | {
      ok: true;
      kind: 'move_session';
      input: AthleteSessionMoveTransactionInput;
      appliedDates: string[];
      swapped: boolean;
    }
  | {
      ok: true;
      kind: 'remove_session';
      input: AthleteSessionDeletionTransactionInput;
      appliedDates: string[];
      swapped: false;
    }
  | {
      // A swap is a whole-session removal whose replacement sits on the day.
      // It rides the deletion transaction so the displaced session triggers
      // the same relocation → authorised-reduction → disclosure path as Bin.
      ok: true;
      kind: 'swap_session';
      input: AthleteSessionDeletionTransactionInput;
      pickedTitle: string | null;
      appliedDates: string[];
      swapped: false;
    }
  | { ok: false; error: string };

/**
 * Errors from a swap resolution that mean "this stage doesn't own this case —
 * fall through to the legacy registry writer" rather than a user-facing
 * rejection. Anchor-day swaps (keep-the-anchor, replace-the-gym-component) and
 * category picks with no template are deferred to stage 3.
 */
const SWAP_DEFERS_TO_LEGACY = new Set<string>([
  'swap_defers_to_legacy_anchor',
  'no_template_for_category',
]);

/**
 * Materialise the new session a swap places on the day. Uses the pure
 * finaliseWorkoutAfterMutation boundary — NOT validateLiveWorkoutWrite — so the
 * whole-week §18 gate never runs here; the accepted-state transaction owns
 * week-level §18 (and any authorised reduction it forces).
 */
function materializeAthleteSwapSession(args: {
  change: TemplatePlanChange;
  currentDay: ResolvedDay;
  todayISO: string;
}): { ok: true; workout: Workout; title: string | null } | { ok: false; error: string } {
  const phase = useProfileStore.getState().onboardingData?.seasonPhase ?? undefined;
  const materialized = materializeCanonicalPlanChangeCandidate({
    change: args.change,
    currentDay: args.currentDay,
    todayISO: args.todayISO,
    canonicalizeWorkout: (date, workout) =>
      finaliseWorkoutAfterMutation(workout, {
        date,
        phase,
        planIntentValid: false,
      }).workout,
  });
  if (materialized.ok === false) return { ok: false, error: materialized.code };
  return {
    ok: true,
    workout: materialized.workout,
    title: materialized.projectedDay.workout?.title ?? null,
  };
}

/**
 * Resolve athlete-owned mutation identity and component scope from the
 * accepted visible snapshot. Registry templates and the general revision
 * writer deliberately have no role in this operation-scoped boundary.
 */
export function resolveAthleteMutation(args: {
  change: AthleteOwnedPlanChange;
  visibleWeek: ResolvedDay[];
  source: 'tap' | 'coach';
}): AthleteMutationResolution {
  const change = args.change;
  if (change.kind === 'move_session') {
    const sourceDay = args.visibleWeek.find((day) =>
      day.date === change.fromDate);
    const targetDay = args.visibleWeek.find((day) =>
      day.date === change.toDate);
    if (!sourceDay?.workout) return { ok: false, error: 'nothing_to_move' };
    if (!targetDay) return { ok: false, error: 'not_visible' };
    if (
      protectedAnchorsForDaySnapshot(snapshotProjectedDay(sourceDay)).length > 0 ||
      protectedAnchorsForDaySnapshot(snapshotProjectedDay(targetDay)).length > 0
    ) {
      return { ok: false, error: 'protected_anchor_day' };
    }
    const input = athleteMoveInput({
      change,
      visibleWeek: args.visibleWeek,
      source: args.source,
    });
    if (!input) return { ok: false, error: 'athlete_move_identity_missing' };
    return {
      ok: true,
      kind: 'move_session',
      input,
      appliedDates: [change.fromDate, change.toDate],
      swapped: !!input.existingTargetWorkout,
    };
  }

  if (change.kind === 'swap_category' || change.kind === 'swap_template') {
    const swapDay = args.visibleWeek.find((day) => day.date === change.date);
    if (!swapDay?.workout) return { ok: false, error: 'nothing_to_swap' };
    // Anchor days (Team Training) need a keep-the-anchor, replace-the-gym-
    // component swap — not a whole-session removal. Defer to the legacy writer.
    if (protectedAnchorsForDaySnapshot(snapshotProjectedDay(swapDay)).length > 0) {
      return { ok: false, error: 'swap_defers_to_legacy_anchor' };
    }
    const template = resolveTemplatePlanChange({ change, visibleWeek: args.visibleWeek });
    if (!template) return { ok: false, error: 'no_template_for_category' };
    const materialized = materializeAthleteSwapSession({
      change: template,
      currentDay: swapDay,
      todayISO: change.date,
    });
    if (materialized.ok === false) return { ok: false, error: materialized.error };
    // Name what the athlete picked — the registry label (parity with the legacy
    // confirmation copy), falling back to the materialized session title.
    const pickedTitle = listCoachRevisionTemplates().find(
      (definition) => definition.templateId === template.templateId,
    )?.label ?? materialized.title;
    return {
      ok: true,
      kind: 'swap_session',
      input: {
        date: change.date,
        reason: `${args.source}:swap_session:${change.date}`,
        source: args.source,
        scope: 'whole_session',
        originalWorkout: swapDay.workout,
        remainingWorkout: materialized.workout,
        equivalentExposureMayRelocate: true,
      },
      pickedTitle,
      appliedDates: [change.date],
      swapped: false,
    };
  }

  const sourceDay = args.visibleWeek.find((day) =>
    day.date === change.date);
  if (!sourceDay?.workout) return { ok: false, error: 'nothing_to_remove' };
  const snapshot = snapshotProjectedDay(sourceDay);
  const anchors = protectedAnchorsForDaySnapshot(snapshot);
  const scope = ATHLETE_REMOVAL_SCOPE[change.scope ?? 'whole_day'];
  if (anchors.some((anchor) => anchor.kind === 'game') ||
    (scope === 'whole_session' && anchors.length > 0)) {
    return { ok: false, error: 'protected_anchor_day' };
  }
  const reduction = reduceAcceptedSessionForAthleteRemoval({
    day: sourceDay,
    scope,
  });
  if (reduction.ok === false) return { ok: false, error: reduction.code };
  if (!reduction.remainingWorkout && anchors.length > 0 && scope !== 'team_component') {
    return { ok: false, error: 'protected_anchor_day' };
  }
  return {
    ok: true,
    kind: 'remove_session',
    input: {
      date: change.date,
      reason: `${args.source}:remove_session:${change.date}`,
      source: args.source,
      scope,
      originalWorkout: sourceDay.workout,
      remainingWorkout: reduction.remainingWorkout,
      equivalentExposureMayRelocate: true,
    },
    appliedDates: [change.date],
    swapped: false,
  };
}

function blockedAssessmentForBuildError(
  change: PlanChange,
  error: string,
): ProgramEditRiskAssessment | null {
  if (error !== 'protected_anchor_day') return null;
  const date =
    'date' in change
      ? change.date
      : change.kind === 'move_session'
      ? change.fromDate
      : null;
  return {
    decision: 'block',
    highestLevel: 'hard_stop',
    findings: [{
      ruleId: 'protected_anchor_edit_blocked',
      level: 'hard_stop',
      message: 'This would remove or replace a protected game/team anchor, so it cannot be applied from this edit flow.',
      dates: date ? [date] : [],
      sessions: [],
      canOverride: false,
      source: 'program_edit_guard',
      bibleRef: 'Section 16 App / AI rules; Section 17.E',
      data: { error },
    }],
    introducedRuleIds: ['protected_anchor_edit_blocked'],
    worsenedRuleIds: [],
  };
}

export function previewPlanChangeRisk(args: {
  change: PlanChange;
  visibleWeek: ResolvedDay[];
  todayISO: string;
  profile?: ValidateProgramWeekInput['profile'];
  activeConstraints?: readonly ActiveConstraint[];
  trace?: AthleteActionTraceContext;
}): PlanChangeRiskPreviewResult {
  const source = sourceDate(args.change);
  const target = targetDate(args.change);
  const sourceWorkout = source
    ? args.visibleWeek.find((day) => day.date === source)?.workout ?? null
    : null;
  const trace = beginAthleteActionTrace({
    source: 'tap',
    actionType: diagnosticActionType(args.change),
    route: 'plan_change_preview',
    currentWeekId: getMondayForDate(target ?? args.todayISO),
    sourceDate: source,
    targetDate: target,
    sessionDate: source ?? target,
    planEntryId: sourceWorkout?.planEntryId ?? null,
    workoutId: sourceWorkout?.id ?? null,
    scope: args.change.kind === 'remove_session' ? args.change.scope ?? 'whole_day' : null,
    sessionTier: sourceWorkout?.sessionTier ?? null,
    workoutType: sourceWorkout?.workoutType ?? null,
  }, args.trace);
  return runWithAthleteActionTrace(trace, () => {
    emitAthleteActionEvent(trace, 'athlete_mutation_received', {
      mutationType: args.change.kind,
      door: 'previewPlanChangeRisk',
    });
    const emptyAssessment: ProgramEditRiskAssessment = {
      decision: 'allow',
      highestLevel: 'info',
      findings: [],
      introducedRuleIds: [],
      worsenedRuleIds: [],
    };
    const finish = (
      result: Omit<PlanChangeRiskPreviewResult, 'trace'>,
      fields: Record<string, unknown> = {},
    ): PlanChangeRiskPreviewResult => {
      emitAthleteActionEvent(trace, 'mutation_preview_result', {
        previewOk: result.ok,
        mutationType: args.change.kind,
        appliedDates: result.appliedDates,
        rejectionCodes: result.rejected.map((entry) => entry.code),
        selectedOutcome: result.ok ? 'publishable' : 'rejected',
        rejectingBoundary: result.ok ? null : 'previewPlanChangeRisk',
        proposedStateHash: athleteActionDiagnosticHash(result.proposedWeek.map((day) => ({
          date: day.date,
          identity: day.workout?.planEntryId ?? day.workout?.id ?? null,
        }))),
        ...fields,
      });
      return { ...result, trace };
    };

    // Operation-scoped ownership: athlete move/delete resolves and stages
    // directly from the accepted visible snapshot. This branch is before
    // proposal construction, template-policy construction and the legacy
    // date-override writer by design.
    const wantsTypedSwap = args.change.kind === 'swap_category' ||
      args.change.kind === 'swap_template';
    if (args.change.kind === 'move_session' || args.change.kind === 'remove_session' ||
      wantsTypedSwap) {
      const resolution = resolveAthleteMutation({
        change: args.change,
        visibleWeek: args.visibleWeek,
        source: 'tap',
      });
      // Anchor-day swaps / no-template picks defer to the legacy preview below.
      const defersToLegacy = resolution.ok === false && wantsTypedSwap &&
        SWAP_DEFERS_TO_LEGACY.has(resolution.error);
      if (resolution.ok === false && !defersToLegacy) {
        const blocked = blockedAssessmentForBuildError(args.change, resolution.error);
        if (blocked) {
          return finish({
            ok: true,
            message: blocked.findings[0]?.message ?? "That change can't be applied here.",
            appliedDates: [],
            rejected: [],
            proposedWeek: args.visibleWeek,
            assessment: blocked,
          }, { internalResultCode: resolution.error });
        }
        return finish({
          ok: false,
          message: `That change isn't possible here (${resolution.error}).`,
          appliedDates: [],
          rejected: [],
          proposedWeek: args.visibleWeek,
          assessment: emptyAssessment,
        }, { internalResultCode: resolution.error });
      }

      if (resolution.ok === true) {
        try {
          const staged = resolution.kind === 'move_session'
            ? stageAthleteSessionMoveTransaction(
                resolution.input,
                { purpose: 'preview' },
              )
            : stageAthleteSessionDeletionTransaction(
                resolution.input,
                { purpose: 'preview' },
              );
          const proposedWeek = proposedWeekFromAcceptedStage({
            visibleWeek: args.visibleWeek,
            staged: staged.result,
            profile: args.profile,
          });
          return finish({
            ok: true,
            message: 'Preview ready.',
            appliedDates: resolution.appliedDates,
            rejected: [],
            proposedWeek,
            assessment: emptyAssessment,
          }, {
            selectedOutcome: staged.outcome,
            ownershipBoundary: 'typed_athlete_mutation',
          });
        } catch (error) {
          const code = (error as { code?: string })?.code ??
            (resolution.kind === 'move_session'
              ? 'athlete_move_preview_failed'
              : resolution.kind === 'swap_session'
                ? 'athlete_swap_preview_failed'
                : 'athlete_removal_preview_failed');
          return finish({
            ok: false,
            message: "I couldn't safely make that change, so the plan is untouched.",
            appliedDates: [],
            rejected: [{
              date: source ?? target ?? null,
              code,
              reason: error instanceof Error ? error.message : String(error),
            }],
            proposedWeek: args.visibleWeek,
            assessment: emptyAssessment,
          }, {
            internalResultCode: code,
            rejectingBoundary: 'stageAthleteMutationTransaction',
            ownershipBoundary: 'typed_athlete_mutation',
          });
        }
      }
    }

    const proposal = buildPlanChangeProposal(args.change, {
      visibleWeek: args.visibleWeek,
      todayISO: args.todayISO,
    });
    if ('error' in proposal) {
      const blocked = blockedAssessmentForBuildError(args.change, proposal.error);
      if (blocked) {
        return finish({
          ok: true,
          message: blocked.findings[0]?.message ?? "That change can't be applied here.",
          appliedDates: [],
          rejected: [],
          proposedWeek: args.visibleWeek,
          assessment: blocked,
        }, { internalResultCode: proposal.error });
      }
      return finish({
        ok: false,
        message: `That change isn't possible here (${proposal.error}).`,
        appliedDates: [],
        rejected: [],
        proposedWeek: args.visibleWeek,
        assessment: emptyAssessment,
      }, { internalResultCode: proposal.error });
    }

    const preview = applyCoachRevisionDateOverrides({
      proposal,
      planChange: resolveTemplatePlanChange({
        change: args.change,
        visibleWeek: args.visibleWeek,
      }),
      visibleWeek: args.visibleWeek,
      todayISO: args.todayISO,
      validationPolicy: validationPolicyForPlanChange(args.visibleWeek, args.todayISO),
    });
    if (preview.applied.length === 0 || preview.rejected.length > 0) {
      return finish({
        ok: false,
        message: "I couldn't safely make that change, so the plan is untouched.",
        appliedDates: preview.applied.map((write) => write.date),
        rejected: rejectedForResult(preview.rejected),
        proposedWeek: args.visibleWeek,
        assessment: emptyAssessment,
      }, { internalResultCode: preview.rejected[0]?.code ?? 'proposal_write_build_failed' });
    }

    const proposedWeek = withPreviewWrites(args.visibleWeek, preview.applied);

    const riskWrites = proposedWeek
      .filter((day) => {
        const before = args.visibleWeek.find((candidate) => candidate.date === day.date)?.workout ?? null;
        return JSON.stringify(before) !== JSON.stringify(day.workout);
      })
      .map((day) => ({ date: day.date, workout: day.workout }));
    // Registry-backed revisions still use the existing proposal/materializer
    // risk assessment. Athlete move/delete returned from their typed branch
    // above and never reach this single-date policy path.
    const assessment = assessProgramEditWrites({
      writes: riskWrites,
      visibleWeek: args.visibleWeek,
      profile: args.profile,
      activeConstraints: args.activeConstraints,
      todayISO: args.todayISO,
    }) ?? emptyAssessment;

    return finish({
      ok: true,
      message: 'Preview ready.',
      appliedDates: preview.applied.map((write) => write.date),
      rejected: [],
      proposedWeek,
      assessment,
    }, { selectedOutcome: 'single_date_candidate' });
  });
}

export interface ApplyPlanChangeInput {
  change: PlanChange;
  visibleWeek: ResolvedDay[];
  todayISO: string;
  setManualOverride: (
    date: string,
    workout: Workout | null,
    context?: OverrideContext,
  ) => void;
  /** Test/host seam; production defaults to the accepted-state transaction. */
  commitAthleteRemoval?: (input: AthleteSessionDeletionTransactionInput) => unknown;
  /** Test/host seam; production defaults to the accepted-state move transaction. */
  commitAthleteMove?: (input: AthleteSessionMoveTransactionInput) => unknown;
  trace?: AthleteActionTraceContext;
  route?: string;
}

function diagnosticActionType(change: PlanChange): AthleteActionType {
  if (change.kind === 'remove_session') {
    return change.scope && change.scope !== 'whole_day' ? 'delete_component' : 'delete_session';
  }
  if (change.kind === 'move_session') return 'move_session';
  if (change.kind === 'add_template' || change.kind === 'add_category') return 'add_session';
  return 'program_change';
}

function sourceDate(change: PlanChange): string | undefined {
  return change.kind === 'move_session' ? change.fromDate : 'date' in change ? change.date : undefined;
}

function targetDate(change: PlanChange): string | undefined {
  return change.kind === 'move_session' ? change.toDate : 'date' in change ? change.date : undefined;
}

export function applyPlanChange(args: ApplyPlanChangeInput): PlanChangeApplyResult {
  const source = sourceDate(args.change);
  const target = targetDate(args.change);
  const sourceWorkout = source
    ? args.visibleWeek.find((day) => day.date === source)?.workout ?? null
    : null;
  const trace = beginAthleteActionTrace({
    source: 'tap',
    actionType: diagnosticActionType(args.change),
    route: args.route ?? 'plan_change_producer',
    currentWeekId: getMondayForDate(target ?? args.todayISO),
    sourceDate: source,
    targetDate: target,
    sessionDate: source ?? target,
    planEntryId: sourceWorkout?.planEntryId ?? null,
    workoutId: sourceWorkout?.id ?? null,
    scope: args.change.kind === 'remove_session' ? args.change.scope ?? 'whole_day' : null,
    sessionTier: sourceWorkout?.sessionTier ?? null,
    workoutType: sourceWorkout?.workoutType ?? null,
  }, args.trace);
  return runWithAthleteActionTrace(trace, () => {
    emitAthleteActionEvent(trace, 'athlete_mutation_received', {
      mutationType: args.change.kind,
      door: 'applyPlanChange',
    });
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: args.change.kind,
      beforeStateHash: athleteActionDiagnosticHash(args.visibleWeek.map((day) => ({
        date: day.date,
        identity: day.workout?.planEntryId ?? day.workout?.id ?? null,
      }))),
    });
    emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
      selectedRoute: 'plan_change_producer',
      producer: 'applyPlanChange',
    });
    const result = applyPlanChangeWithinTrace(args);
    const internalResultCode = result.ok
      ? `plan_change_${args.change.kind}_accepted`
      : result.rejected[0]?.code ?? `plan_change_${args.change.kind}_rejected`;
    const uiMessageKey = result.ok
      ? 'plan_change_success'
      : result.message === "I couldn't safely make that change, so the plan is untouched."
        ? 'plan_change_generic_unsafe'
        : 'plan_change_specific_failure';
    if (result.ok) {
      emitAthleteActionEvent(trace, 'athlete_action_completed', {
        outcome: 'accepted',
        appliedDates: result.appliedDates,
        afterStateHash: athleteActionDiagnosticHash({
          dates: result.appliedDates,
          accepted: true,
        }),
        internalResultCode,
        finalUiMessageKey: uiMessageKey,
      });
    } else {
      const originalRejectionCode = result.rejected[0]?.code ?? internalResultCode;
      const athleteOwned = args.change.kind === 'move_session' ||
        args.change.kind === 'remove_session' ||
        args.change.kind === 'swap_category' ||
        args.change.kind === 'swap_template';
      const firstFailingBoundary = athleteOwned
        ? result.rejected.length > 0
          ? 'athlete_session_transaction'
          : 'resolve_athlete_mutation'
        : result.rejected.length > 0
        ? 'applyCoachRevisionDateOverrides'
        : 'buildPlanChangeProposal';
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: 'rejected',
        internalResultCode,
        originalRejectionCode,
        rejectionCodes: result.rejected.map((entry) => entry.code),
        firstFailingBoundary,
        failureCategory: classifyAthleteActionFailure(originalRejectionCode, firstFailingBoundary),
        validCandidateExisted: false,
        previousStateRestored: true,
        genericMessageSelected: uiMessageKey === 'plan_change_generic_unsafe',
        genericMessageSelectionReason: uiMessageKey === 'plan_change_generic_unsafe'
          ? 'shared_safe_failure_copy'
          : null,
        finalUiMessageKey: uiMessageKey,
        terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
      });
    }
    emitAthleteActionEvent(trace, 'athlete_ui_outcome_shown', {
      uiSurface: 'plan_change_result',
      uiOutcome: result.ok ? 'success' : 'failure',
      internalResultCode,
      finalUiMessageKey: uiMessageKey,
      genericMessageSelected: uiMessageKey === 'plan_change_generic_unsafe',
    });
    emitAthleteActionEvent(trace, 'ui_outcome_mapped', {
      uiSurface: 'plan_change_result',
      uiOutcome: result.ok ? 'success' : 'failure',
      internalResultCode,
      finalUiMessageKey: uiMessageKey,
    });
    return athleteActionDiagnosticsEnabled()
      ? { ...result, traceId: trace.traceId, internalResultCode, uiMessageKey }
      : result;
  });
}

function applyPlanChangeWithinTrace(args: ApplyPlanChangeInput): PlanChangeApplyResult {
  // Commit through the same typed owner used by preview. This is intentionally
  // before proposal/template policy construction and before the legacy
  // revision override writer.
  const wantsTypedSwap = args.change.kind === 'swap_category' ||
    args.change.kind === 'swap_template';
  if (args.change.kind === 'move_session' || args.change.kind === 'remove_session' ||
    wantsTypedSwap) {
    const resolution = resolveAthleteMutation({
      change: args.change,
      visibleWeek: args.visibleWeek,
      source: 'tap',
    });
    if (resolution.ok === false) {
      // Anchor-day swaps and category picks with no template are not owned by
      // this stage — fall through to the legacy registry writer below.
      if (!(wantsTypedSwap && SWAP_DEFERS_TO_LEGACY.has(resolution.error))) {
        return {
          ok: false,
          message: `That change isn't possible here (${resolution.error}).`,
          appliedDates: [],
          rejected: [],
        };
      }
    } else if (resolution.kind === 'move_session') {
      if (args.change.kind !== 'move_session') {
        throw new Error('Athlete move resolution did not match its typed intent');
      }
      try {
        (args.commitAthleteMove ?? commitAthleteSessionMoveTransaction)(
          resolution.input,
        );
      } catch (error) {
        return {
          ok: false,
          message: "I couldn't safely make that change, so the plan is untouched.",
          appliedDates: [],
          rejected: [{
            date: args.change.fromDate,
            code: (error as { code?: string })?.code ?? 'athlete_move_publication_failed',
            reason: (error as Error)?.message ?? String(error),
          }],
        };
      }
      return {
        ok: true,
        message: moveDoneMessage(args.change, resolution.swapped),
        appliedDates: resolution.appliedDates,
        rejected: [],
      };
    } else if (resolution.kind === 'swap_session') {
      // A swap rides the deletion transaction (whole-session removal with the
      // new session as remainingWorkout), so it inherits Bin's authorised-
      // reduction + disclosure ownership.
      let publishedOutcome: AthleteDeletionPublishedOutcome | null = null;
      try {
        const transaction = (args.commitAthleteRemoval ??
          commitAthleteSessionDeletionTransaction)(resolution.input);
        if (transaction && typeof transaction === 'object' &&
          'deletionOutcome' in transaction) {
          publishedOutcome = (transaction as {
            deletionOutcome: AthleteDeletionPublishedOutcome;
          }).deletionOutcome;
        }
      } catch (error) {
        return {
          ok: false,
          message: "I couldn't safely make that change, so the plan is untouched.",
          appliedDates: [],
          rejected: [{
            date: resolution.input.date,
            code: (error as { code?: string })?.code ?? 'athlete_swap_publication_failed',
            reason: (error as Error)?.message ?? String(error),
          }],
        };
      }
      return {
        ok: true,
        message: athleteSwapDoneMessage(
          resolution.input.date, resolution.pickedTitle, publishedOutcome),
        appliedDates: resolution.appliedDates,
        rejected: [],
      };
    } else {
      if (args.change.kind !== 'remove_session') {
        throw new Error('Athlete deletion resolution did not match its typed intent');
      }
      let publishedOutcome: AthleteDeletionPublishedOutcome | null = null;
      try {
        const transaction = (args.commitAthleteRemoval ??
          commitAthleteSessionDeletionTransaction)(
            resolution.input,
          );
        if (transaction && typeof transaction === 'object' &&
          'deletionOutcome' in transaction) {
          publishedOutcome = (transaction as {
            deletionOutcome: AthleteDeletionPublishedOutcome;
          }).deletionOutcome;
        }
      } catch (error) {
        return {
          ok: false,
          message: "I couldn't safely make that change, so the plan is untouched.",
          appliedDates: [],
          rejected: [{
            date: args.change.date,
            code: (error as { code?: string })?.code ?? 'athlete_removal_publication_failed',
            reason: (error as Error)?.message ?? String(error),
          }],
        };
      }
      return {
        ok: true,
        message: publishedOutcome
          ? athleteDeletionDoneMessage(args.change, publishedOutcome)
          : planChangeDoneMessage(args.change, null),
        appliedDates: resolution.appliedDates,
        rejected: [],
      };
    }
  }

  const proposal = buildPlanChangeProposal(args.change, {
    visibleWeek: args.visibleWeek,
    todayISO: args.todayISO,
  });
  if ('error' in proposal) {
    return {
      ok: false,
      message: `That change isn't possible here (${proposal.error}).`,
      appliedDates: [],
      rejected: [],
    };
  }

  const apply = applyCoachRevisionDateOverrides({
    proposal,
    planChange: resolveTemplatePlanChange({
      change: args.change,
      visibleWeek: args.visibleWeek,
    }),
    visibleWeek: args.visibleWeek,
    todayISO: args.todayISO,
    validationPolicy: validationPolicyForPlanChange(args.visibleWeek, args.todayISO),
    setManualOverride: args.setManualOverride,
  });

  if (apply.applied.length === 0 || apply.rejected.length > 0) {
    return {
      ok: false,
      message: "I couldn't safely make that change, so the plan is untouched.",
      appliedDates: apply.applied.map((write) => write.date),
      rejected: rejectedForResult(apply.rejected),
    };
  }

  // Category picks name what was chosen — the athlete picked a bucket,
  // so the confirmation must say which session the producer put in.
  const concreteTemplateChange = resolveTemplatePlanChange({
    change: args.change,
    visibleWeek: args.visibleWeek,
  });
  const pickedTitle = concreteTemplateChange
    ? listCoachRevisionTemplates().find(
        (template) => template.templateId === concreteTemplateChange.templateId,
      )?.label ?? null
    : proposal.kind === 'revision'
      ? proposal.revisedDays.find((day) => day.workout)?.workout?.title ?? null
      : null;

  const message = planChangeDoneMessage(args.change, pickedTitle);

  return {
    ok: true,
    message,
    appliedDates: apply.applied.map((write) => write.date),
    rejected: [],
  };
}

const BIN_SCOPE_DONE: Record<Exclude<PlanChangeBinScopeId, 'whole_day'>, string> = {
  strength: 'Gym session binned',
  conditioning: 'Conditioning binned',
  recovery: 'Recovery work binned',
  team: 'Team training binned for this date',
};

function outcomeWeekday(date: string | null): string {
  if (!date) return 'another day';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-AU', {
    weekday: 'long',
  });
}

/**
 * Swap copy is a projection of the accepted transaction result. It names the
 * session the athlete now has and, on an authorised reduction, discloses it
 * with the same ownership as Bin (see athleteDeletionDoneMessage 'reduced').
 */
function athleteSwapDoneMessage(
  date: string,
  pickedTitle: string | null,
  outcome: AthleteDeletionPublishedOutcome | null,
): string {
  const label = pickedTitle ?? 'New session';
  const lead = `Done. ${label} is now on ${date}.`;
  if (!outcome) return lead;
  // Reduction only when the displaced required work is genuinely unrelocatable.
  if (outcome.kind === 'reduced') {
    const target = outcome.affectedMetric === 'conditioning_core'
      ? 'conditioning target'
      : 'strength target';
    return `${lead} This week’s ${target} has been reduced at your request.`;
  }
  // Bible-legal relocation of the displaced required work must be disclosed —
  // name the day it moved to (parity with Bin's deletion copy).
  if ((outcome.kind === 'relocated' || outcome.kind === 'substituted' ||
    outcome.kind === 'stacked') && outcome.destinationDate) {
    const day = outcomeWeekday(outcome.destinationDate);
    const patterns = new Set(outcome.removedPatterns);
    const moved = patterns.has('squat') || patterns.has('hinge')
      ? 'Lower-body strength'
      : outcome.affectedMetric === 'main_strength'
        ? 'Your strength work'
        : outcome.affectedMetric === 'conditioning_core'
          ? 'Conditioning work'
          : 'Required work';
    return `${lead} ${moved} was moved to ${day} to keep your week balanced.`;
  }
  return lead;
}

/** Athlete copy is a projection of the accepted transaction result. */
function athleteDeletionDoneMessage(
  change: Extract<PlanChange, { kind: 'remove_session' }>,
  outcome: AthleteDeletionPublishedOutcome,
): string {
  const scope = change.scope ?? 'whole_day';
  const patterns = new Set(outcome.removedPatterns);
  const component = scope === 'whole_day'
    ? 'Session'
    : scope === 'conditioning'
    ? 'Conditioning'
    : patterns.size === 1 && patterns.has('pull')
      ? 'Upper Pull'
      : patterns.size === 1 && patterns.has('push')
        ? 'Upper Push'
        : scope === 'strength'
          ? 'Gym session'
          : 'Session';
  const removed = component === 'Session'
    ? 'Session removed.'
    : `${component} was removed.`;
  if (outcome.kind === 'reduced') {
    const target = outcome.affectedMetric === 'conditioning_core'
      ? 'conditioning target'
      : 'strength target';
    return `${removed} This week’s ${target} has been reduced at your request.`;
  }
  if (outcome.kind === 'already_satisfied') {
    return outcome.affectedMetric === 'session'
      ? removed
      : `${removed} Your remaining sessions already cover this week’s target.`;
  }
  const day = outcomeWeekday(outcome.destinationDate);
  if (patterns.has('squat') || patterns.has('hinge')) {
    return `${removed} Lower-body strength was moved to ${day} to keep your week balanced.`;
  }
  if (patterns.size === 1 && patterns.has('pull')) {
    return `${removed} Pulling work was added to ${day}.`;
  }
  if (patterns.size === 1 && patterns.has('push')) {
    return `${removed} Pushing work was added to ${day}.`;
  }
  if (outcome.affectedMetric === 'conditioning_core') {
    return `${removed} Conditioning work was added to ${day}.`;
  }
  return `${removed} Required work was added to ${day}.`;
}

function planChangeDoneMessage(change: PlanChange, pickedTitle: string | null): string {
  switch (change.kind) {
    case 'remove_session': {
      const scope = change.scope ?? 'whole_day';
      if (scope !== 'whole_day') {
        return `Done. ${BIN_SCOPE_DONE[scope]} - the rest of ${change.date} stays.`;
      }
      return `Done. Session removed on ${change.date}.`;
    }
    case 'swap_template':
      return `Done. Session swapped on ${change.date}.`;
    case 'add_template':
      return `Done. Session added on ${change.date}.`;
    case 'swap_category':
      return `Done. ${pickedTitle ?? 'New session'} is now on ${change.date}.`;
    case 'add_category':
      return `Done. ${pickedTitle ?? 'New session'} added on ${change.date}.`;
    case 'move_session':
      return `Done. Session moved to ${change.toDate}.`;
    case 'shutdown_week':
      return 'Done. The rest of this week is cleared - rest up, and add sessions back when you\'re better.';
    case 'clear_days':
      return "Done. Those days are cleared - they'll come back when you clear the note.";
  }
}

/** Swap-aware done message needs to know whether the destination was
 *  occupied when the change was built. */
function moveDoneMessage(change: Extract<PlanChange, { kind: 'move_session' }>, swapped: boolean): string {
  return swapped
    ? `Done. ${change.fromDate} and ${change.toDate} swapped sessions.`
    : `Done. Session moved to ${change.toDate}.`;
}
