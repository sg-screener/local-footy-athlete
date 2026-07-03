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
import type { OverrideContext, Workout } from '../types/domain';
import {
  COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  snapshotProjectedDay,
  type CoachRevisionProposal,
  type CoachVisibleDaySnapshot,
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
} from './coachRevisionPolicy';
import { applyCoachRevisionDateOverrides } from './coachRevisionOverrideWriter';

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
  | 'recovery';

export interface PlanChangeCategoryOption {
  id: PlanChangeCategoryId;
  label: string;
  sub: string;
}

const CATEGORY_TO_REGISTRY: Record<
  PlanChangeCategoryId,
  CoachRevisionTemplateDefinition['category']
> = {
  conditioning_light: 'flush',
  conditioning_hard: 'work_capacity',
  recovery: 'recovery',
};

const CATEGORY_COPY: Record<PlanChangeCategoryId, { label: string; sub: string }> = {
  conditioning_light: {
    label: 'Light session',
    sub: 'Easy flush — bike, row or ski. We pick it for you.',
  },
  conditioning_hard: {
    label: 'Hard session',
    sub: 'Work capacity, off legs. Earn your sleep.',
  },
  recovery: {
    label: 'Recovery',
    sub: 'Restorative flow — rolling, mobility, breathing.',
  },
};

export type PlanChange =
  | { kind: 'remove_session'; date: string }
  | { kind: 'swap_template'; date: string; templateId: string }
  | { kind: 'add_template'; date: string; templateId: string }
  | { kind: 'swap_category'; date: string; category: PlanChangeCategoryId }
  | { kind: 'add_category'; date: string; category: PlanChangeCategoryId }
  | { kind: 'move_session'; fromDate: string; toDate: string };

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
  /** Legal move destinations: visible rest days inside the horizon. */
  moveDestinations: string[];
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
    .filter((id) =>
      templates.some((template) => template.category === CATEGORY_TO_REGISTRY[id]))
    .map((id) => ({ id, ...CATEGORY_COPY[id] }));

  const hasSession = snap.workout !== null;
  const moveDestinations = hasSession
    ? args.visibleWeek
        .filter((candidate) =>
          candidate.date !== args.date &&
          isWithinEditHorizon(candidate.date, args.todayISO) &&
          snapshotProjectedDay(candidate).workout === null &&
          !visibleDayLooksLikeGame(snapshotProjectedDay(candidate)))
        .map((candidate) => candidate.date)
    : [];

  return {
    date: args.date,
    locked: null,
    hasSession,
    canRemove: hasSession,
    templates,
    categories,
    moveDestinations,
  };
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
    (template) => template.category === CATEGORY_TO_REGISTRY[args.category],
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
        "Make sure you don't overdo it — we want you fresh for game day.",
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
        "That's a lot of hard work in one week. Adding more risks burnout — keep something in the tank.",
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
    workoutType: definition.category === 'recovery' ? 'Recovery' : 'Conditioning',
    sections: [section],
  };
}

export function buildPlanChangeProposal(
  change: PlanChange,
  ctx: { visibleWeek: ResolvedDay[] },
): CoachRevisionProposal | { error: string } {
  const daySnap = (date: string): CoachVisibleDaySnapshot | null => {
    const day = ctx.visibleWeek.find((d) => d.date === date);
    return day ? snapshotProjectedDay(day) : null;
  };

  const revision = (args: {
    intent: 'add' | 'remove' | 'replace' | 'move';
    targetDomain: 'session' | 'conditioning' | 'recovery';
    dates: string[];
    revisedDays: CoachVisibleDaySnapshot[];
    explanation: string;
  }): CoachRevisionProposal => ({
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    kind: 'revision',
    source: 'semantic',
    confidence: 1,
    userIntent: {
      intent: args.intent,
      targetDomain: args.targetDomain,
      actionScope: 'whole_session',
      targetDates: args.dates,
      protectedRefs: [],
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
      return revision({
        intent: 'remove',
        targetDomain: 'session',
        dates: [change.date],
        revisedDays: [{ date: change.date, workout: null }],
        explanation: 'Sheet: remove session',
      });
    }
    case 'swap_template': {
      const before = daySnap(change.date);
      if (!before?.workout) return { error: 'nothing_to_swap' };
      const workout = templateWorkoutSnapshot(change.templateId, change.date);
      if (!workout) return { error: 'unknown_template' };
      return revision({
        intent: 'replace',
        targetDomain: 'session',
        dates: [change.date],
        revisedDays: [{ date: change.date, workout }],
        explanation: `Sheet: swap in ${workout.title}`,
      });
    }
    case 'add_template': {
      const before = daySnap(change.date);
      if (before === null) return { error: 'not_visible' };
      if (before.workout) return { error: 'day_not_empty' };
      const definition = listCoachRevisionTemplates()
        .find((template) => template.templateId === change.templateId);
      const workout = templateWorkoutSnapshot(change.templateId, change.date);
      if (!definition || !workout) return { error: 'unknown_template' };
      return revision({
        intent: 'add',
        // The validator checks the change landed in the declared domain —
        // recovery templates add recovery, everything else conditioning.
        targetDomain: definition.category === 'recovery' ? 'recovery' : 'conditioning',
        dates: [change.date],
        revisedDays: [{ date: change.date, workout }],
        explanation: `Sheet: add ${workout.title}`,
      });
    }
    case 'move_session': {
      const source = daySnap(change.fromDate);
      const destination = daySnap(change.toDate);
      if (!source?.workout) return { error: 'nothing_to_move' };
      if (!destination) return { error: 'not_visible' };
      if (destination.workout) return { error: 'destination_not_empty' };
      return revision({
        intent: 'move',
        targetDomain: 'session',
        dates: [change.fromDate, change.toDate],
        revisedDays: [
          { date: change.fromDate, workout: null },
          { date: change.toDate, workout: source.workout },
        ],
        explanation: 'Sheet: move session',
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
}

export function applyPlanChange(args: {
  change: PlanChange;
  visibleWeek: ResolvedDay[];
  todayISO: string;
  setManualOverride: (
    date: string,
    workout: Workout | null,
    context?: OverrideContext,
  ) => void;
}): PlanChangeApplyResult {
  const proposal = buildPlanChangeProposal(args.change, {
    visibleWeek: args.visibleWeek,
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
    validationPolicy: {
      ...coachRevisionValidationPolicyForWeek(args.visibleWeek, args.todayISO),
      requireConfirmationForAdds: false,
    },
    setManualOverride: args.setManualOverride,
  });

  if (apply.applied.length === 0 || apply.rejected.length > 0) {
    return {
      ok: false,
      message: "I couldn't safely make that change, so the plan is untouched.",
      appliedDates: apply.applied.map((write) => write.date),
      rejected: apply.rejected.map((entry) => ({
        date: entry.date ?? null,
        code: entry.code,
        reason: entry.reason,
      })),
    };
  }

  // Category picks name what was chosen — the athlete picked a bucket,
  // so the confirmation must say which session the producer put in.
  const pickedTitle =
    proposal.kind === 'revision'
      ? proposal.revisedDays.find((day) => day.workout)?.workout?.title ?? null
      : null;

  return {
    ok: true,
    message: planChangeDoneMessage(args.change, pickedTitle),
    appliedDates: apply.applied.map((write) => write.date),
    rejected: [],
  };
}

function planChangeDoneMessage(change: PlanChange, pickedTitle: string | null): string {
  switch (change.kind) {
    case 'remove_session':
      return `Done. Session removed on ${change.date}.`;
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
  }
}
