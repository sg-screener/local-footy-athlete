/**
 * planChangeProducer — deterministic proposal producer for the tap-first
 * plan-change sheet (ATHLETE_CHANGE_VOCABULARY.md, group 1).
 *
 * The sheet is the SECOND door into the revision pipeline. It produces the
 * same CoachRevisionProposal shape the chat coach produces, and applies it
 * through the same writer with the same shared policy
 * (coachRevisionPolicy.ts). No LLM, no interpretation: the athlete tapped
 * the day (no date ambiguity), picked the action (no intent ambiguity), and
 * chose from options this module listed (no illegal content possible).
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
  type CoachVisibleSectionSnapshot,
  type CoachVisibleWorkoutSnapshot,
} from './coachRevisionProposal';
import {
  buildCoachRevisionTemplateSection,
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
import type { ProgramEditRiskAssessment } from './programEditRiskAssessment';
import { assessProgramEditWrites } from './programEditWriteGuard';
import type { ValidateProgramWeekInput } from '../rules/weekStructureValidator';
import {
  commitAthleteSessionDeletionTransaction,
  type AthleteSessionDeletionTransactionInput,
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
export type PlanChangeCategoryId =
  | 'conditioning_light'
  | 'conditioning_hard'
  | 'recovery'
  | 'strength_upper'
  | 'strength_lower'
  | 'strength_full'
  | 'accessories';

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

function protectedSectionsToPreserve(
  snap: CoachVisibleDaySnapshot,
): CoachVisibleSectionSnapshot[] {
  const refs = new Set(
    protectedAnchorsForDaySnapshot(snap)
      .filter((anchor) => anchor.kind === 'team_training')
      .map((anchor) => anchor.ref),
  );
  return (snap.workout?.sections ?? []).filter((section) => refs.has(section.id));
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
export type PlanChangeBinScopeId =
  | 'whole_day'
  | 'strength'
  | 'conditioning'
  | 'recovery'
  | 'team';

export interface PlanChangeBinScope {
  id: PlanChangeBinScopeId;
  label: string;
  sub: string;
}

export type PlanChange =
  | { kind: 'remove_session'; date: string; scope?: PlanChangeBinScopeId }
  | { kind: 'swap_template'; date: string; templateId: string }
  | { kind: 'add_template'; date: string; templateId: string }
  | { kind: 'swap_category'; date: string; category: PlanChangeCategoryId }
  | { kind: 'add_category'; date: string; category: PlanChangeCategoryId }
  | { kind: 'move_session'; fromDate: string; toDate: string }
  /** "I'm not 100%" bed-ridden path: clear every remaining session in the
   *  date's week (today onward, games untouched). One atomic proposal
   *  through the same validate → apply pipeline. */
  | { kind: 'shutdown_week'; date: string }
  /** "Away / holiday" path: clear an EXPLICIT list of days to rest (the
   *  athlete picked exactly which days they're unavailable). Games are
   *  left alone; already-rest days are skipped. Same atomic validate →
   *  apply pipeline as shutdown_week, but scoped to the chosen dates
   *  rather than the whole rest-of-week. */
  | { kind: 'clear_days'; dates: string[] };

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

function templateWorkoutSnapshot(
  templateId: string,
  date: string,
): CoachVisibleWorkoutSnapshot | null {
  const definition = listCoachRevisionTemplates()
    .find((template) => template.templateId === templateId);
  const section = buildCoachRevisionTemplateSection(templateId, date);
  if (!definition || !section) return null;
  return {
    id: `template-${templateId}`,
    title: definition.label,
    // Must match what the writer materializes for this template, or the
    // advertised/written round-trip breaks.
    workoutType:
      definition.category === 'recovery'
        ? 'Recovery'
        : definition.category === 'strength' || definition.category === 'accessories'
        ? 'Strength'
        : 'Conditioning',
    sections: [section],
  };
}

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
      const picked = pickTemplateForCategory({
        category: change.category,
        date: change.date,
        visibleWeek: ctx.visibleWeek,
      });
      if (!picked) return { error: 'no_template_for_category' };
      return buildPlanChangeProposal(
        change.kind === 'swap_category'
          ? { kind: 'swap_template', date: change.date, templateId: picked.templateId }
          : { kind: 'add_template', date: change.date, templateId: picked.templateId },
        ctx,
      );
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
      const workout = templateWorkoutSnapshot(change.templateId, change.date);
      if (!workout) return { error: 'unknown_template' };
      const anchorSections = protectedSectionsToPreserve(before);
      const revisedWorkout = anchorSections.length > 0
        ? {
            ...workout,
            sections: [...workout.sections, ...anchorSections],
          }
        : workout;
      return revision({
        intent: 'replace',
        targetDomain: 'session',
        dates: [change.date],
        revisedDays: [{ date: change.date, workout: revisedWorkout }],
        explanation: `Sheet: swap in ${workout.title}`,
      });
    }
    case 'add_template': {
      const before = daySnap(change.date);
      if (before === null) return { error: 'not_visible' };
      const definition = listCoachRevisionTemplates()
        .find((template) => template.templateId === change.templateId);
      const workout = templateWorkoutSnapshot(change.templateId, change.date);
      if (!definition || !workout) return { error: 'unknown_template' };

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
        return revision({
          intent: 'add',
          targetDomain: addedKind === 'strength' ? 'strength' : 'conditioning',
          dates: [change.date],
          revisedDays: [{
            date: change.date,
            workout: {
              ...before.workout,
              sections: [...before.workout.sections, ...workout.sections],
            },
          }],
          explanation: `Sheet: add ${workout.title} on top`,
        });
      }

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
        revisedDays: [{ date: change.date, workout }],
        explanation: `Sheet: add ${workout.title}`,
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
}): PlanChangeRiskPreviewResult {
  const proposal = buildPlanChangeProposal(args.change, {
    visibleWeek: args.visibleWeek,
    todayISO: args.todayISO,
  });
  if ('error' in proposal) {
    const blocked = blockedAssessmentForBuildError(args.change, proposal.error);
    if (blocked) {
      return {
        ok: true,
        message: blocked.findings[0]?.message ?? "That change can't be applied here.",
        appliedDates: [],
        rejected: [],
        proposedWeek: args.visibleWeek,
        assessment: blocked,
      };
    }
    return {
      ok: false,
      message: `That change isn't possible here (${proposal.error}).`,
      appliedDates: [],
      rejected: [],
      proposedWeek: args.visibleWeek,
      assessment: {
        decision: 'allow',
        highestLevel: 'info',
        findings: [],
        introducedRuleIds: [],
        worsenedRuleIds: [],
      },
    };
  }

  const preview = applyCoachRevisionDateOverrides({
    proposal,
    visibleWeek: args.visibleWeek,
    todayISO: args.todayISO,
    validationPolicy: validationPolicyForPlanChange(args.visibleWeek, args.todayISO),
  });
  if (preview.applied.length === 0 || preview.rejected.length > 0) {
    return {
      ok: false,
      message: "I couldn't safely make that change, so the plan is untouched.",
      appliedDates: preview.applied.map((write) => write.date),
      rejected: rejectedForResult(preview.rejected),
      proposedWeek: args.visibleWeek,
      assessment: {
        decision: 'allow',
        highestLevel: 'info',
        findings: [],
        introducedRuleIds: [],
        worsenedRuleIds: [],
      },
    };
  }

  const proposedWeek = withPreviewWrites(args.visibleWeek, preview.applied);
  const assessment = assessProgramEditWrites({
    writes: preview.applied.map((write) => ({
      date: write.date,
      workout: write.workout,
    })),
    visibleWeek: args.visibleWeek,
    profile: args.profile,
    activeConstraints: args.activeConstraints,
    todayISO: args.todayISO,
  }) ?? {
    decision: 'allow',
    highestLevel: 'info',
    findings: [],
    introducedRuleIds: [],
    worsenedRuleIds: [],
  };

  return {
    ok: true,
    message: 'Preview ready.',
    appliedDates: preview.applied.map((write) => write.date),
    rejected: [],
    proposedWeek,
    assessment,
  };
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
      const firstFailingBoundary = result.rejected.length > 0
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
    return athleteActionDiagnosticsEnabled()
      ? { ...result, traceId: trace.traceId, internalResultCode, uiMessageKey }
      : result;
  });
}

function applyPlanChangeWithinTrace(args: ApplyPlanChangeInput): PlanChangeApplyResult {
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
    visibleWeek: args.visibleWeek,
    todayISO: args.todayISO,
    validationPolicy: validationPolicyForPlanChange(args.visibleWeek, args.todayISO),
    deferWeekAcceptanceToTransaction: args.change.kind === 'remove_session',
    setManualOverride: args.change.kind === 'remove_session'
      ? undefined
      : args.setManualOverride,
  });

  if (apply.applied.length === 0 || apply.rejected.length > 0) {
    return {
      ok: false,
      message: "I couldn't safely make that change, so the plan is untouched.",
      appliedDates: apply.applied.map((write) => write.date),
      rejected: rejectedForResult(apply.rejected),
    };
  }

  if (args.change.kind === 'remove_session') {
    const removal = args.change;
    const source = args.visibleWeek.find((day) => day.date === removal.date)?.workout ?? null;
    const write = apply.applied.find((candidate) => candidate.date === removal.date);
    if (!source || !write) {
      return {
        ok: false,
        message: "I couldn't safely make that change, so the plan is untouched.",
        appliedDates: [],
        rejected: [{
          date: removal.date,
          code: 'athlete_removal_identity_missing',
          reason: 'The accepted source session or component result was unavailable.',
        }],
      };
    }
    const scopeMap: Record<PlanChangeBinScopeId, UserRemovalScope> = {
      whole_day: 'whole_session',
      strength: 'strength_component',
      conditioning: 'conditioning_component',
      recovery: 'recovery_component',
      team: 'team_component',
    };
    try {
      (args.commitAthleteRemoval ?? commitAthleteSessionDeletionTransaction)({
        date: removal.date,
        reason: `tap:remove_session:${removal.date}`,
        source: 'tap',
        scope: scopeMap[removal.scope ?? 'whole_day'],
        originalWorkout: source,
        remainingWorkout: write.workout.workoutType === 'Rest' ? null : write.workout,
        equivalentExposureMayRelocate: true,
      });
    } catch (error) {
      return {
        ok: false,
        message: "I couldn't safely make that change, so the plan is untouched.",
        appliedDates: [],
        rejected: [{
          date: removal.date,
          code: 'athlete_removal_publication_failed',
          reason: (error as Error)?.message ?? String(error),
        }],
      };
    }
  }

  // Category picks name what was chosen — the athlete picked a bucket,
  // so the confirmation must say which session the producer put in.
  const pickedTitle =
    proposal.kind === 'revision'
      ? proposal.revisedDays.find((day) => day.workout)?.workout?.title ?? null
      : null;

  // Moves report differently when the destination was occupied (swap).
  const message =
    args.change.kind === 'move_session'
      ? moveDoneMessage(
          args.change,
          proposal.kind === 'revision' &&
            proposal.revisedDays.every((day) => day.workout !== null),
        )
      : planChangeDoneMessage(args.change, pickedTitle);

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
