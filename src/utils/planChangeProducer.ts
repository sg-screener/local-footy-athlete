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
import {
  effectiveGameDatesAround,
  getMondayForDate,
  resolveWeekWithConditioning,
} from './sessionResolver';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { verifyVisibleDatesChanged } from './coachVisibleDomainVerifier';
import { strengthComponentDisplayName } from './sessionNaming';
import type { OverrideContext, UserRemovalScope, Workout } from '../types/domain';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import {
  COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  snapshotProjectedDay,
  type CoachRevisionProposal,
  type CoachRevisionProtectedAnchorKind,
  type CoachRevisionSectionKind,
  type CoachVisibleDaySnapshot,
} from './coachRevisionProposal';
import { dayIsFixture, projectParts, type ProjectedDayParts } from '../rules/projectVisibleWeek';
import {
  buildCoachRevisionTemplateWorkout,
  listCoachRevisionTemplates,
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
import {
  materializeCanonicalPlanChangeCandidate,
  stackSessionOntoTeamAnchor,
  type CanonicalPlanChangeCandidateInput,
  type CanonicalPlanChangeCandidateResult,
} from './canonicalPlanChangeCandidateMaterializer';
import { g1RouteTemplateTransform } from './g1RouteMaterialisation';
import { getTeamTrainingWorkoutState } from './teamTraining';
import { liveAthleteContext } from './liveAthleteContext';
import { validateLiveWorkoutWrite } from './postGenerationConstraintValidation';
import {
  canonicalContextSubphase,
  finaliseWorkoutAfterMutation,
} from './workoutCanonicalisation';
import { isG1RoutedChange } from './planChangeTypes';
import type {
  G1LandingRouteId,
  PlanChange,
  PlanChangeBinScopeId,
  PlanChangeCategoryId,
  PlanChangeMoveScopeId,
  TemplatePlanChange,
} from './planChangeTypes';
export type {
  PlanChange,
  PlanChangeBinScopeId,
  PlanChangeCategoryId,
  PlanChangeMoveScopeId,
} from './planChangeTypes';
import type { ProgramEditRiskAssessment } from './programEditRiskAssessment';
import { assessProgramEditWrites } from './programEditWriteGuard';
import { classifyProgramMutationRefusal } from '../rules/programMutationRefusal';
import { athleteSafeRefusal } from './planChangeRefusalCopy';
import {
  reduceAcceptedSessionForAthleteRemoval,
  splitAcceptedSessionForAthleteMove,
  strengthComponentRows,
} from './sessionComponents';
import type { ValidateProgramWeekInput } from '../rules/weekStructureValidator';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { isResolverOwnedDerivedSession } from '../rules/derivedSessionProvenance';
import {
  G1_LANDING_WARNING,
  g1LandingRoute,
  placeSessionForRoute,
  resolveG1LandingAsk,
  type G1LandingAskContext,
} from '../rules/g1LandingAsk';
import { fixtureAwareMarkedDaysForWeek } from '../rules/section18AcceptedWeekGateway';
import { strengthVariantByTemplateId } from '../data/strengthSessionVariants';
import type { WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import { useProfileStore } from '../store/profileStore';
import { liveOffseasonSubphaseForDate, useProgramStore } from '../store/programStore';
import {
  commitAthleteSessionMoveTransaction,
  commitAthleteSessionDeletionTransaction,
  commitAthleteSessionAdditionTransaction,
  stageAthleteSessionDeletionTransaction,
  stageAthleteSessionMoveTransaction,
  stageAthleteSessionAdditionTransaction,
  type AcceptedStateTransactionResult,
  type AthleteDeletionPublishedOutcome,
  type AthleteAdditionPublishedOutcome,
  type AthleteSessionDeletionTransactionInput,
  type AthleteSessionAdditionTransactionInput,
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
  mobility: (t) => t.category === 'mobility',
  // THE THREE DOORS ARE A PARTITION OF THE SEVEN (Sam's charter, 2026-07-30).
  //
  // These were three hand-maintained templateId lists, and they were WRONG the
  // moment the seventh variant existed: Lower Body offered ONE template where
  // the generator builds three lower sessions, so Lower Squat and Lower Hinge
  // were unreachable through any door. Derived from the authored set, a new
  // variant reaches its door with no edit here at all.
  strength_upper: (t) => strengthVariantByTemplateId(t.templateId)?.door === 'strength_upper',
  strength_lower: (t) => strengthVariantByTemplateId(t.templateId)?.door === 'strength_lower',
  strength_full: (t) => strengthVariantByTemplateId(t.templateId)?.door === 'strength_full',
  // Each door matches its OWN derived session, so a door cannot offer the other's
  // session. `derivedType` is the typed fact the registry already carries.
  gunshow: (t) => t.category === 'accessories' && t.derivedType === 'arms_pump',
  prehab: (t) => t.category === 'accessories' && t.derivedType === 'prehab_accessories',
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
  // PROPOSED, NOT YET SIGNED — goes to Sam with the stage 5 copy batch
  // (docs/COPY_SHEET_RULINGS_2026-07-30.md). Written in the voice of the
  // six beside it; the Title Case label follows his batch-1 capitalisation rule.
  mobility: {
    label: 'Mobility',
    sub: 'A flow to loosen up - easy ranges only',
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
  // PROPOSED, NOT YET SIGNED — both go to Sam with the copy batch
  // (docs/COPY_SHEET_RULINGS_2026-07-30.md). They replace one row that read
  // "Accessories / Gunshow or prehab - small muscles, big payoff", which was the copy
  // admitting the door was two doors: a sub-label naming two things with "or" is a
  // menu that has not decided what it offers.
  //
  // "Gunshow" is Sam's own word and is already the session's athlete-facing name, so
  // the label is his; the sub describes the signed structure without quoting counts,
  // because a session that shrinks under thin equipment must not promise six.
  gunshow: {
    label: 'Gunshow',
    sub: 'Arms and delts - light pump work',
  },
  prehab: {
    label: 'Prehab',
    sub: 'Groin, calves, midline, shoulders - the armour work',
  },
};

const MAX_VISIBLE_SESSIONS_PER_DAY = 2;

type VisibleSessionKind = CoachRevisionSectionKind;

/**
 * The SECTION kinds the day shows.
 *
 * Deliberately NOT a capability question any more — those are the projection's
 * (`projectVisibleWeek.partCapabilities`) and this module reads them rather than
 * deriving them a second time. What survives here is the section vocabulary the
 * MUTATIONS speak: bin scopes, move scopes and the split machinery all address a
 * day by `CoachVisibleSectionSnapshot.kind`, so the offer has to be expressed in
 * the same words the writer understands.
 *
 * (`visibleSessionKindsForWorkout`, the workout-level twin, is gone. It existed
 * only so this could delegate to it, and a second entry point into one derivation
 * is exactly the shape this unit removes.)
 */
function visibleSessionKindsForSnapshot(
  snap: CoachVisibleDaySnapshot,
): VisibleSessionKind[] {
  return Array.from(
    new Set((snap.workout?.sections ?? []).map((section) => section.kind)),
  );
}

function hasProtectedAnchors(snap: CoachVisibleDaySnapshot): boolean {
  return protectedAnchorsForDaySnapshot(snap).length > 0;
}

/**
 * What KIND of part this category adds. Exported so the SHEET's add guard and
 * the harness that drives it read the same owner instead of each keeping a
 * copy — the copy is what let `mobility` mean `recovery` here and
 * `conditioning` in `templateAddsSessionKind`.
 */
export function planChangeCategoryAddsSessionKind(
  category: PlanChangeCategoryId,
): VisibleSessionKind {
  return categoryAddsSessionKind(category);
}

function categoryAddsSessionKind(category: PlanChangeCategoryId): VisibleSessionKind {
  // Mobility joins recovery as a RECOVERY-kind part: no load, never hard, never
  // breaks rest (Sam's charter). The visible-kind vocabulary has no separate
  // `mobility` member and does not need one — `kind` exists so the ledger can
  // ask what counts, and the two answer that question identically.
  if (category === 'recovery' || category === 'mobility') return 'recovery';
  if (category.startsWith('strength_') || category === 'gunshow' || category === 'prehab') return 'strength';
  return 'conditioning';
}

/**
 * What KIND of part a registry template adds — the template-side twin of
 * `categoryAddsSessionKind`, and it must agree with it.
 *
 * IT DID NOT. `mobility` had no branch here and fell through to the
 * `conditioning` default, while `categoryAddsSessionKind` calls it `recovery`
 * (Sam's charter: mobility is optional, no load, never hard, never breaks rest).
 * One split, two athlete-visible faults: on a conditioning-occupied day the sheet
 * offered Mobility and the writer refused it as a duplicate conditioning session
 * — the sheet's own rule is that it never offers a door with nothing behind it —
 * and on a strength-only day it published with `targetDomain: 'conditioning'`, so
 * the validator was asked to check the change landed in a domain it did not land
 * in. Neither is reachable now that the two agree.
 */
function templateAddsSessionKind(
  category: CoachRevisionTemplateDefinition['category'],
): VisibleSessionKind {
  if (category === 'recovery' || category === 'mobility') return 'recovery';
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

/**
 * Why a day offers no move. Sam's ruling (2026-07-30), direction (b): the
 * refusal travels WITH the list so the surface can never render emptiness as
 * though it were an answer.
 */
export type PlanChangeMoveRefusalReason =
  /** Nothing on the day to move. */
  | 'no_session'
  /** A TEAM ANCHOR holds the day. The sentence may name team training. */
  | 'anchored_day'
  /**
   * The day holds work, and none of it can leave on its own — a club
   * commitment, a recovery add-on that rides with the day. SPLIT OUT of
   * `anchored_day` (2026-07-31) because the two shared one sentence and that
   * sentence named team training: on a Club Session day the athlete read
   * "Team training is fixed to this day" about a day with no team training,
   * and the four-action menu renders this line inline under the disabled Move
   * row rather than only after a tap. A signed sentence must never be able to
   * lie (batch 3), so the CAUSE is typed and the copy follows it, rather than
   * one sentence guessing which cause it is describing.
   */
  | 'nothing_movable'
  /** There is movable content, but nowhere in view it could legally go. */
  | 'no_destination';

export interface PlanChangeMoveRefusal {
  reason: PlanChangeMoveRefusalReason;
  /** Athlete-facing. Never a reason code — the sheet renders this verbatim. */
  message: string;
}

/** One movable part of the day, with the destinations legal FOR THAT PART. */
export interface PlanChangeMoveScope {
  id: PlanChangeMoveScopeId;
  label: string;
  sub: string;
  /** Non-empty by construction — a scope with nowhere to go is never offered. */
  destinations: PlanChangeMoveDestination[];
}

/**
 * The whole answer to "can this day move, and where to?".
 *
 * The device dead end was a picker rendering `[]`, which is indistinguishable
 * from "not computed yet" and says nothing to the athlete. So emptiness is not
 * representable on its own here: `scopes` is empty IF AND ONLY IF `refusal` is
 * set, and `planChangeMoveOptionsAreConsistent` pins that both ways. A surface
 * that reads `scopes` and finds nothing has the sentence sitting next to it.
 *
 * Deliberately NOT a discriminated union on a boolean. Both fields are always
 * present, so no caller has to narrow to read either — narrowing a boolean
 * discriminant behaves differently across this repo's compile scopes, and a
 * refusal that a surface silently cannot see is the bug this type exists to
 * prevent.
 */
export interface PlanChangeMoveOptions {
  /** Movable parts with their destinations. Empty iff `refusal` is set. */
  scopes: PlanChangeMoveScope[];
  /** Why nothing can move. Non-null iff `scopes` is empty. */
  refusal: PlanChangeMoveRefusal | null;
}

/** The invariant above, as a predicate the suites assert in both directions. */
export function planChangeMoveOptionsAreConsistent(move: PlanChangeMoveOptions): boolean {
  return (move.scopes.length === 0) === (move.refusal !== null) &&
    move.scopes.every((scope) => scope.destinations.length > 0);
}

const MOVE_REFUSAL_COPY: Record<PlanChangeMoveRefusalReason, string> = {
  no_session: "There's nothing on this day to move.",
  // TWO PROBLEMS, ONE REWRITE (Batch 6, 2026-07-31). It read "…You can still
  // swap or bin the gym work on it." That second clause used the retired verb
  // (batch 3: Remove everywhere, not Bin) AND it made a claim about state it
  // cannot see — on a team night with no gym work beside it, and now that the
  // four-action menu renders this sentence inline under a disabled Move row
  // rather than only after a tap, it would sit next to a Swap row that is also
  // off. Batch 3's principle is that a signed sentence must never be able to
  // lie, so the clause that can lie is gone rather than qualified.
  anchored_day:
    "Team training is fixed to this day, so it can't be moved from here.",
  nothing_movable:
    "Nothing on this day can be moved to another day.",
  no_destination:
    "There's nowhere to move this in the weeks you can edit — every other day is a game, team training, or already full.",
};

const MOVE_SCOPE_COPY: Record<PlanChangeMoveScopeId, { label: string; sub: string }> = {
  whole_day: { label: 'Move the whole session', sub: 'Pick another day for it' },
  strength: { label: 'Just the gym session', sub: 'Team training stays on this day' },
  conditioning: { label: 'Just the conditioning', sub: 'The rest of the day stays' },
  recovery: { label: 'Just the recovery work', sub: 'The rest of the day stays' },
};

/**
 * THE FOUR-ACTION MENU, PLUS WHAT SITS BEHIND EACH ROW.
 *
 * `hasSession`, `canSwap`, `canAdd`, `canRemove` and the presence of a move
 * refusal are RENDERED, not derived: every one of them is
 * `projectVisibleWeek.projectParts`'s answer for this day, read once here so the
 * sheet never asks "is this a session?" (`visibleProjection.ts` property 3). The
 * menu used to answer those questions itself — `hasSession = workout !== null`,
 * `canRemove = hasSession` — and a second derivation of a capability is a second
 * story about the day: it offered to bin a team night the projection called an
 * anchor, and refused a move on a day the projection called movable.
 *
 * What this module still OWNS is everything the projection has no vocabulary for:
 * which template backs a category, which sections a scope addresses, where a
 * session may legally land, and the edit WINDOW (`locked`) — the projection holds
 * no opinion about how far ahead the plan is firm.
 */
export interface PlanChangeDayOptions {
  date: string;
  /** Why the menu is empty, when it is. */
  locked: null | 'outside_horizon' | 'game_day' | 'not_visible';
  /** Does the projection carry any part on this day? */
  hasSession: boolean;
  /** Projection: is any part on this day the athlete's to trade for another? */
  canSwap: boolean;
  /** Projection: may this day take more work at all? False for a fixture. */
  canAdd: boolean;
  /** Projection: can work be taken off this day? */
  canRemove: boolean;
  /** Registry templates legal for this date (bye gating applied). */
  templates: CoachRevisionTemplateDefinition[];
  /** Sheet-v2 categories legal for this date (derived from `templates`). */
  categories: PlanChangeCategoryOption[];
  /** Movable parts of the day with their legal destinations, or the typed
   *  refusal explaining why nothing can move. Replaces the bare
   *  `moveDestinations` array, whose emptiness the sheet rendered as a dead end. */
  move: PlanChangeMoveOptions;
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

/**
 * This day, as the ONE projection sees it.
 *
 * ONE DAY, NOT THE WEEK, and that is exact rather than an optimisation:
 * `projectParts` maps each day independently — no cross-day derivation, no
 * week-level state — so projecting `[day]` returns byte-identical output to
 * projecting the week and picking this date out of it. The menu is listed once
 * per day per surface render, and per day per action in the walker, so asking
 * for six days nobody reads would multiply the cost of the single most-called
 * function in this file by seven for no extra truth.
 *
 * AND THAT IS NOW CHECKED, NOT CLAIMED. `projectionOwnershipTests`, "projecting
 * ONE day equals projecting the week and picking that day out", asserts the
 * equality over the whole generated horizon. It was a docblock promise and a
 * handover warning aimed at one named future — cross-day RECOVERY derivation —
 * until Sam ruled recovery out as an athlete-facing session type on 2026-07-31
 * and left the warning pointing at a trigger that is not coming. The hazard was
 * misnamed rather than removed: ANY cross-day read added to `projectParts` makes
 * this shortcut project a different day from the one every other surface
 * projects, silently. If that cell reds, the read moves out of `projectParts` or
 * this function stops taking the shortcut.
 */
function projectedDay(day: ResolvedDay): ProjectedDayParts {
  return projectParts({ week: [day], weekStart: day.date }).days[0];
}

export function listPlanChangeOptionsForDay(args: {
  visibleWeek: ResolvedDay[];
  date: string;
  todayISO: string;
}): PlanChangeDayOptions {
  const empty = (locked: PlanChangeDayOptions['locked']): PlanChangeDayOptions => ({
    date: args.date,
    locked,
    hasSession: false,
    canSwap: false,
    canAdd: false,
    canRemove: false,
    templates: [],
    categories: [],
    move: {
      scopes: [],
      refusal: { reason: 'no_session', message: MOVE_REFUSAL_COPY.no_session },
    },
    binScopes: [],
    addOnTopCategories: [],
    visibleSessionCount: 0,
    visibleSessionKinds: [],
  });

  const day = args.visibleWeek.find((d) => d.date === args.date);
  if (!day) return empty('not_visible');
  if (!isWithinEditHorizon(args.date, args.todayISO)) return empty('outside_horizon');

  const projected = projectedDay(day);
  // A FIXTURE IS A TYPED FACT, NOT A TITLE THAT MENTIONS FOOTY. This was
  // `visibleDayLooksLikeGame(snap)` — `/\bgame\b/` over the rendered title, the
  // same title-regex shape `moveOptionsForDay` already complains about two
  // hundred lines below. `dayKind` reads `day.source === 'game' || day.indicator
  // === 'game'`, which is where the athlete's fixture actually lives, and it is
  // the same read that makes the projection call every part of a game day
  // uneditable. Two owners answering "is this a game day?" is how the menu came
  // to lock a day the projection was offering to edit.
  if (projected.kind === 'game') return empty('game_day');

  const snap = snapshotProjectedDay(day);

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

  // THE PROJECTION'S ANSWERS, READ — NOT ASKED AGAIN.
  const hasSession = projected.parts.length > 0;
  const canSwap = projected.parts.some((part) => part.capabilities.canSwap);
  const canRemove = projected.capabilities.canRemoveWholeDay;
  const move = moveOptionsForDay({
    day,
    snapshot: snap,
    projected,
    visibleWeek: args.visibleWeek,
    date: args.date,
    todayISO: args.todayISO,
  });

  // Add-on-top: strength and conditioning can stack until the day has two
  // visible parts. Duplicate strength+strength or conditioning+conditioning
  // is still blocked; rest is owned by bin/remove rather than add.
  const visibleSessionKinds = visibleSessionKindsForSnapshot(snap);
  const visibleSessionCount = visibleSessionKinds.length;
  const canAddOnTop =
    projected.capabilities.canAdd &&
    visibleSessionCount > 0 &&
    visibleSessionCount < MAX_VISIBLE_SESSIONS_PER_DAY;

  return {
    date: args.date,
    locked: null,
    hasSession,
    canSwap,
    canAdd: projected.capabilities.canAdd,
    canRemove,
    templates,
    categories,
    move,
    binScopes: canRemove ? binScopesForSnapshot(snap) : [],
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

/**
 * Movable parts of a day and where each may go.
 *
 * The rule that produced the device dead end was one line: a source day
 * carrying ANY protected anchor returned `[]` for the whole list. A combined
 * day (Team Training + Upper Push) is anchored, so moving the gym session off
 * it was silently impossible. The anchor is a fact about TEAM TRAINING, not
 * about the gym work sitting next to it, so it now removes only `whole_day`
 * and the other components are offered on their own.
 *
 * Destinations are evaluated per scope (Sam's ruling): a whole-day move keeps
 * the historical rest-first-then-swap list, while a SCOPED move offers free
 * days only. Trading one component of a combined day against another day's
 * whole session has no defined meaning, and inventing one here is how the
 * original defect was written.
 */
function moveOptionsForDay(args: {
  day: ResolvedDay;
  snapshot: CoachVisibleDaySnapshot;
  projected: ProjectedDayParts;
  visibleWeek: ResolvedDay[];
  date: string;
  todayISO: string;
}): PlanChangeMoveOptions {
  const refuse = (reason: PlanChangeMoveRefusalReason): PlanChangeMoveOptions => ({
    scopes: [],
    refusal: { reason, message: MOVE_REFUSAL_COPY[reason] },
  });
  // WHETHER ANYTHING MAY LEAVE THIS DAY IS THE PROJECTION'S ANSWER. This door
  // owns the two questions the projection cannot answer — WHICH scopes the
  // mutation machinery can address, and WHERE they may land — and asks neither
  // of them until the owner has said there is something to move. It used to
  // decide for itself, from `snapshot.workout` and the section kinds, and got a
  // different answer on a team night carrying a recovery add-on.
  //
  // WHICH refusal is decided by a typed fact the projection already carries —
  // does this day hold a team anchor? — never by guessing from the reason code.
  const holdsTeamAnchor = args.projected.parts.some((part) => part.kind === 'team_training');
  const refuseImmovable = (): PlanChangeMoveOptions =>
    refuse(holdsTeamAnchor ? 'anchored_day' : 'nothing_movable');
  if (!args.projected.capabilities.canMoveWholeDay) {
    return args.projected.parts.length === 0 ? refuse('no_session') : refuseImmovable();
  }

  // A team night IS a destination (Sam's doubling law, 2026-07-30): the session
  // lands beside the anchor as a combined day. Only game day is excluded.
  const candidates = args.visibleWeek.filter((candidate) =>
    candidate.date !== args.date &&
    isWithinEditHorizon(candidate.date, args.todayISO) &&
    !protectedAnchorsForDaySnapshot(snapshotProjectedDay(candidate))
      .some((anchor) => anchor.kind === 'game'));
  const destinationsFor = (scope: PlanChangeMoveScopeId): PlanChangeMoveDestination[] =>
    candidates
      .map((candidate) => ({
        date: candidate.date,
        occupiedBy: snapshotProjectedDay(candidate).workout?.title ?? null,
      }))
      // A SCOPED MOVE MAY LAND ON AN OCCUPIED DAY — Sam's doubling law
      // (2026-07-30, ruling 3), which this filter predated and quietly
      // contradicted. Moving a session onto a team night is LEGAL and lands as a
      // combined day, "the exact shape generation produces"; the move ABSORBS,
      // the anchor stays put, and nothing travels back to the source.
      //
      // Restricting scoped moves to free days was written when trading one
      // component of a combined day against another day's whole session had no
      // defined meaning. Absorption defines it. Until now the two halves of one
      // ruling disagreed: the whole-day picker offered team nights and the
      // scoped picker did not.
      //
      // On Sam's week that was the whole of finding (2)/(3). His Wednesday is
      // Team Training + Upper Pull, so the only movable part is the gym session;
      // no day in his week is free; every scoped destination was filtered away
      // and the door answered "there's nowhere to move this" about a move his
      // own ruling permits. Game day stays excluded — that is upstream, in
      // `candidates`, and is the one destination still locked.
      .sort((left, right) =>
        (left.occupiedBy === null) === (right.occupiedBy === null)
          ? left.date.localeCompare(right.date)
          : left.occupiedBy === null ? -1 : 1);

  // THE OFFER IS DERIVED FROM THE SAME DECOMPOSITION THE DAY IS COUNTED BY.
  //
  // Sam's finding 3: a day the app renders as two sessions offered only
  // `whole_day`, the sheet auto-skipped the scope picker because there was
  // nothing to pick, and "move the gym session" moved the whole day —
  // commitment included.
  //
  // The cause was two counts of one day. `visibleSessionCount` counts every
  // section kind; the scope list was built from a map that only knows the three
  // MOVABLE kinds, so a `session` commitment was counted as a session and then
  // silently dropped from the offer. Reading both from `visibleSessionKinds`
  // means the offer can never name fewer parts than the athlete can see.
  //
  // WHY NOT LEAN ON THE ANCHOR. A team night already removed `whole_day` via
  // `hasProtectedAnchors` — but that predicate ends in a regex over the
  // rendered title (`/\bteam training\b/`). A commitment section titled
  // anything else is not an anchor, and the day fell straight through to
  // `['whole_day']`. Immovability is a fact about the SHAPE of the day, not
  // about what its rows are called, so it is decided here from the kind and the
  // anchor is left to mean what it means.
  const visibleKinds = visibleSessionKindsForSnapshot(args.snapshot);
  const componentScopes = MOVABLE_COMPONENT_SCOPES.filter((scope) =>
    visibleKinds.includes(MOVE_SCOPE_SECTION_KIND[scope]));
  // Content the athlete cannot reschedule: a commitment is a fixed appointment,
  // binnable for one date (`binScopesForSnapshot` offers exactly that) but not
  // movable to another day. Its presence is what makes a whole-day move wrong —
  // that move would take the commitment with it.
  //
  // AND THIS IS NOT THE PROJECTION'S QUESTION, WHICH IS WHY IT IS STILL ASKED
  // HERE. "Can anything leave this day?" is a capability and belongs to the
  // owner — it is the gate at the top of this function now. "Would a WHOLE-DAY
  // move drag something that must stay?" is a different question with a
  // different answer for the same part: a recovery add-on cannot leave on its
  // own (so `canMove` is false for it) but it TRAVELS with a whole-day move,
  // because the workout moves and the add-on is a field on the workout. Reading
  // `part.capabilities.canMove` here would turn every add-on day into a scoped
  // offer and quietly retire the whole-day move from days that should have it.
  const carriesImmovableContent = visibleKinds.some(
    (kind) => !MOVABLE_SECTION_KINDS.includes(kind));
  const dragsSomethingItShouldNot = carriesImmovableContent ||
    hasProtectedAnchors(args.snapshot);
  // A single-component day has nothing to scope: moving "just the gym session"
  // off a day that is only a gym session IS the whole-day move, and offering
  // both would be two names for one action.
  const offered: PlanChangeMoveScopeId[] = dragsSomethingItShouldNot
    ? componentScopes
    : componentScopes.length > 1
      ? ['whole_day', ...componentScopes]
      : ['whole_day'];
  if (offered.length === 0) return refuseImmovable();

  const scopes = offered
    .map((id) => ({ id, ...MOVE_SCOPE_COPY[id], destinations: destinationsFor(id) }))
    .filter((scope) => scope.destinations.length > 0);
  if (scopes.length === 0) return refuse('no_destination');
  return { scopes, refusal: null };
}

/** Component scopes a Move may take off a day, in the order the sheet shows. */
const MOVABLE_COMPONENT_SCOPES: readonly Exclude<PlanChangeMoveScopeId, 'whole_day'>[] =
  ['strength', 'conditioning', 'recovery'] as const;

const MOVE_SCOPE_SECTION_KIND: Record<
  Exclude<PlanChangeMoveScopeId, 'whole_day'>,
  CoachRevisionSectionKind
> = {
  strength: 'strength',
  conditioning: 'conditioning',
  recovery: 'recovery',
};

/**
 * The section kinds a move may take off a day on their own. Exhaustive against
 * `CoachRevisionSectionKind` by construction — the fourth kind, `session`, is
 * absent because a commitment cannot be rescheduled by the athlete, and a kind
 * added later is absent until someone decides which it is.
 */
const MOVABLE_SECTION_KINDS: readonly CoachRevisionSectionKind[] =
  Object.values(MOVE_SCOPE_SECTION_KIND);

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
  // The G-1 answer travels with the change through the category → template
  // conversion. Dropping it here is invisible: the concrete change materialises
  // perfectly, just without the route the athlete was asked for.
  const g1Route = args.change.g1Route;
  return args.change.kind === 'swap_category'
    ? { kind: 'swap_template', date: args.change.date, templateId: picked.templateId, g1Route }
    : { kind: 'add_template', date: args.change.date, templateId: picked.templateId, g1Route };
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
      // survivors — the strength component named from its OWN typed intent and
      // rows when strength survives, otherwise the surviving section's own
      // title.
      //
      // TASK 11 — this read `splitSessionName(before.workout.title).title`, a
      // parse of the day's composed name. `before` is a snapshot and carries no
      // typed intent, so the real day is fetched from the visible week the
      // caller already handed us: the same object `daySnap` snapshots.
      const strengthSurvives = surviving.some((section) => section.kind === 'strength');
      const beforeWorkout =
        ctx.visibleWeek.find((day) => day.date === change.date)?.workout ?? null;
      const survivorTitle = strengthSurvives
        ? strengthComponentDisplayName({
            strengthIntent: beforeWorkout?.strengthIntent,
            // THE COMPONENT'S OWN ROWS, NOT THE DAY'S. This passed
            // `beforeWorkout.exercises` — the whole pre-removal day — and one
            // unrelated sibling row from a surviving section is enough to widen
            // the inferred pattern set and FABRICATE a canonical label ("Full
            // Body Strength" for a squat-only survivor). Same defect as the Bin
            // remainder in `sessionComponents`; same owner fixes it.
            exercises: beforeWorkout
              ? strengthComponentRows(beforeWorkout, surviving)
              : [],
            fallbackTitle: before.workout.title,
          })
        : surviving[0].title || before.workout.title;
      const survivorWorkoutType =
        surviving.every((section) => section.kind === 'session')
          ? before.workout.workoutType
          : strengthSurvives
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
      const currentDay = ctx.visibleWeek.find((day) => day.date === change.date)!;
      // ONE PREDICATE FOR THE MENU AND THE WRITER. This was
      // `visibleDayLooksLikeGame(before)`, a regex over the snapshot's rendered
      // title, while the menu locked the same day from `dayKind`. Two owners
      // answering "is this a fixture?" is the split this task exists to close,
      // and closing only the menu half narrowed the lock instead.
      if (dayIsFixture(currentDay)) return { error: 'protected_anchor_day' };
      const materialized = materializeAthleteCandidate({
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
        // Same one predicate the menu locks on — see the `swap_template` note.
        const fixtureDay = ctx.visibleWeek.find((day) => day.date === change.date);
        if (fixtureDay && dayIsFixture(fixtureDay)) return { error: 'protected_anchor_day' };
        const kinds = visibleSessionKindsForSnapshot(before);
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
        const materialized = materializeAthleteCandidate({
          change,
          currentDay,
          todayISO: ctx.todayISO ?? change.date,
          canonicalizeWorkout: (date, workout) => validateLiveWorkoutWrite(date, workout),
        });
        if (materialized.ok === false) return { error: materialized.code };
        return revision({
          intent: 'add',
          // The kind the template adds, not a two-way guess at it — a mobility
          // stack is a recovery-domain change and the validator checks the
          // declared domain.
          targetDomain: addedKind,
          dates: [change.date],
          revisedDays: [materialized.projectedDay],
          explanation:
            `Sheet: add ${materialized.projectedDay.workout?.title ?? definition.label} on top`,
        });
      }

      const currentDay = ctx.visibleWeek.find((day) => day.date === change.date)!;
      const materialized = materializeAthleteCandidate({
        change,
        currentDay,
        todayISO: ctx.todayISO ?? change.date,
        canonicalizeWorkout: (date, workout) => validateLiveWorkoutWrite(date, workout),
      });
      if (materialized.ok === false) return { error: materialized.code };

      return revision({
        intent: 'add',
        // The validator checks the change landed in the declared domain. This
        // used to re-spell `templateAddsSessionKind`'s body inline, which is how
        // the mobility branch could be missing from one copy and not the other.
        targetDomain: templateAddsSessionKind(definition.category),
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

/**
 * What actually happened, as three distinct answers rather than one boolean.
 *
 * Sam's ruling #6 (2026-07-30): a stage that applied NOTHING must not be
 * reportable as "Done." `ok` alone could not express that — an
 * `already_applied` short-circuit returned a success-shaped result and the
 * sheet printed "Done. Full Body Strength is now on <date>" over a day that
 * held something else. `no_change` is an OUTCOME with a reason, and the same
 * distinction `rules/programMutationRefusal` already draws for settings.
 */
export type PlanChangeOutcome = 'applied' | 'no_change' | 'refused';

export interface PlanChangeApplyResult {
  /** True only for `applied`. Retained so existing callers keep their meaning. */
  ok: boolean;
  outcome: PlanChangeOutcome;
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
  /**
   * Present when the athlete has put a session on the day before a game and has
   * not yet chosen a route. NOTHING has been applied. The caller must show the
   * warning and the three routes, then re-issue the change with `g1Route` set —
   * or, for "keep the Gunshow", issue nothing at all.
   */
  g1Ask?: G1LandingAskContext | null;
  /** Correlation context reused by the real commit door. */
  trace: AthleteActionTraceContext;
}

function validationPolicyForPlanChange(
  visibleWeek: ResolvedDay[],
  todayISO: string,
  change?: PlanChange,
) {
  return {
    // The athlete's answered G-1 route is part of what the app is authorised to
    // materialise. Without it, "deloaded" would be refused as unknown content —
    // the app asking a question and then rejecting the answer.
    ...coachRevisionValidationPolicyForWeek(
      visibleWeek,
      todayISO,
      change && 'g1Route' in change ? change.g1Route : undefined,
    ),
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
  const route = args.change.g1Route;
  const placedWorkout = route
    ? placeSessionForRoute({
        route,
        landingWorkout: sourceWorkout,
        targetDate: args.change.toDate,
        athlete: liveAthleteContext(),
        profile: useProfileStore.getState().onboardingData,
      })
    : null;
  // Session-scoped move: the day splits into what leaves and what stays, from
  // ONE snapshot, so the two halves cannot disagree about which rows went where.
  const scope = args.change.scope ?? 'whole_day';
  let componentSplit: { movedWorkout: Workout; remainingWorkout: Workout | null } | null = null;
  if (scope !== 'whole_day') {
    const sourceDay = args.visibleWeek.find((day) => day.date === args.change.fromDate);
    if (!sourceDay) return null;
    const split = splitAcceptedSessionForAthleteMove({
      day: sourceDay,
      scope: ATHLETE_REMOVAL_SCOPE[scope],
    });
    if (split.ok === false) return null;
    componentSplit = {
      movedWorkout: split.movedWorkout,
      remainingWorkout: split.remainingWorkout,
    };
  }
  // A team night absorbs the arriving session rather than trading places with
  // it (Sam's doubling law). The anchor stays; the day becomes combined.
  const targetWorkout = args.visibleWeek.find((day) =>
    day.date === args.change.toDate)?.workout ?? null;
  const targetHoldsTeamAnchor = !!targetWorkout &&
    getTeamTrainingWorkoutState(targetWorkout).hasTeamTraining;
  const combinedOntoAnchor = targetHoldsTeamAnchor && targetWorkout
    ? stackSessionOntoTeamAnchor({
      anchorDay: targetWorkout,
      addition: placedWorkout ?? componentSplit?.movedWorkout ?? sourceWorkout,
    })
    : null;
  return {
    sourceDate: args.change.fromDate,
    targetDate: args.change.toDate,
    reason: `${args.source}:move_session:${args.change.fromDate}:${args.change.toDate}`
      + (scope === 'whole_day' ? '' : `:${scope}`)
      + (route ? `:${route}` : ''),
    source: args.source,
    acceptedSourcePlanEntryId: sourceWorkout.planEntryId ?? null,
    sourceWorkoutId: sourceWorkout.id,
    originalSourceWorkout: sourceWorkout,
    existingTargetWorkout: args.visibleWeek.find((day) =>
      day.date === args.change.toDate)?.workout ?? null,
    scope: 'whole_session',
    componentSplit,
    placedSession: combinedOntoAnchor
      ? { ...(route ? { route } : {}), workout: combinedOntoAnchor }
      : route && placedWorkout
        ? { route, workout: placedWorkout }
        : null,
    placedSessionAbsorbsTarget: !!combinedOntoAnchor,
  };
}

/**
 * What would land on the day, whichever door the athlete used.
 *
 * Move brings a session off another day. Swap and Add bring a registry
 * template. The G-1 ask is about the CONTENT that ends up on the day, so this
 * is the one place that question is answered, and the answer feeds both the ask
 * and — through `placeSessionForRoute` — the route the athlete picks.
 */
function landingWorkoutForChange(args: {
  change: AthleteOwnedPlanChange;
  visibleWeek: ResolvedDay[];
}): Workout | null {
  // Bound to a local before narrowing: a union narrowed on `args.change` loses
  // the narrowing inside a callback, which is how this reads `fromDate` off a
  // change that may not have one.
  const change = args.change;
  if (change.kind === 'move_session') {
    return args.visibleWeek.find((day) =>
      day.date === change.fromDate)?.workout ?? null;
  }
  if (change.kind === 'remove_session') return null;
  const template = resolveTemplatePlanChange({
    change,
    visibleWeek: args.visibleWeek,
  });
  if (!template) return null;
  return buildCoachRevisionTemplateWorkout(template.templateId, template.date);
}

/** The day a change puts content ON. Move names it differently; nothing else does. */
function landingDateForChange(change: AthleteOwnedPlanChange): string | null {
  if (change.kind === 'move_session') return change.toDate;
  if (change.kind === 'remove_session') return null;
  return change.date;
}

/**
 * Is this change putting a session on the day before a game, and does that need
 * the ask?
 *
 * ONE CALL SITE (`resolveAthleteMutation`). It used to be Move's alone, which
 * is precisely why a swap onto G-1 reported "Done." and changed nothing: the
 * only layer that knew about the day never ran, so the full session went in and
 * the resolver regenerated over it.
 *
 * Games are read from the resolver's own owner, over marks that already have
 * the week's CONTRACT FIXTURE folded in — a practice match lives in the
 * contract's anchors, and asking `markedDays` alone is blind to it. Returns
 * null when the accepted week cannot be resolved at all; a week with no
 * contract has no fixture to be one day before, so there is nothing to ask
 * about.
 */
export function g1LandingAskForChange(args: {
  change: AthleteOwnedPlanChange;
  visibleWeek: ResolvedDay[];
}): G1LandingAskContext | null {
  const targetDate = landingDateForChange(args.change);
  if (!targetDate) return null;
  const landingWorkout = landingWorkoutForChange(args);
  if (!landingWorkout) return null;
  const profile = useProfileStore.getState().onboardingData;
  const state = useProgramStore.getState();
  const weekStart = getMondayForDate(targetDate);
  let contract: WeeklyExposureContractV2 | null = null;
  try {
    contract = rebaseAcceptedEffectiveWeek({
      surfaces: state,
      weekStart,
      profile,
      markedDays: state.acceptedMaterialContext.markedDays,
    }).contract;
  } catch {
    return null;
  }
  const gameDates = effectiveGameDatesAround({
    markedDays: fixtureAwareMarkedDaysForWeek({
      contract,
      weekStart,
      profile,
      markedDays: state.acceptedMaterialContext.markedDays,
    }),
    usualGameDay: profile?.usualGameDay,
    gameDay: profile?.gameDay,
    seasonPhase: profile?.seasonPhase,
    centerDate: targetDate,
  });
  return resolveG1LandingAsk({
    targetDate,
    landingWorkout,
    existingWorkout: args.visibleWeek.find((day) =>
      day.date === targetDate)?.workout ?? null,
    gameDates,
    sourceDate: args.change.kind === 'move_session' ? args.change.fromDate : null,
  });
}

/**
 * Has the athlete answered the ask with a route that actually applies something?
 *
 * Route (a) commits nothing by design — the sheet answers it by closing, and
 * there is deliberately no value that commits an abandonment. A change that
 * carries it anyway has nothing to apply, so it is treated as unanswered rather
 * than quietly landing the full session.
 */
function committingG1Route(change: AthleteOwnedPlanChange): G1LandingRouteId | null {
  const route = 'g1Route' in change ? change.g1Route : undefined;
  return route && g1LandingRoute(route).commits ? route : null;
}

/**
 * Would this route actually put something on the day?
 *
 * Asked of the same landing content the ask was raised about, through the same
 * transformation the doors apply, so this cannot drift from what would land.
 */
function routeYieldsContent(
  change: AthleteOwnedPlanChange,
  route: G1LandingRouteId,
  visibleWeek: ResolvedDay[],
): boolean {
  const landingWorkout = landingWorkoutForChange({ change, visibleWeek });
  const targetDate = landingDateForChange(change);
  if (!landingWorkout || !targetDate) return false;
  return !!placeSessionForRoute({
    route,
    landingWorkout,
    targetDate,
    athlete: liveAthleteContext(),
    profile: useProfileStore.getState().onboardingData,
  });
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
  { kind: 'swap_category' } | { kind: 'swap_template' } |
  { kind: 'add_category' } | { kind: 'add_template' }>;

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
  | {
      // An add on an empty/rest day: a net-new session owned by the dedicated
      // addition transaction (§18 repaired cross-day, never rejected for an
      // off-target condition). Occupied-day stacks stay on the legacy writer.
      ok: true;
      kind: 'add_session';
      input: AthleteSessionAdditionTransactionInput;
      pickedTitle: string | null;
      appliedDates: string[];
      swapped: false;
    }
  | { ok: false; error: string };

/**
 * Errors from a swap resolution that mean "this stage doesn't own this case —
 * fall through to the legacy registry writer" rather than a user-facing
 * rejection. Team-Training anchor swaps are now owned by the transaction (stage
 * 3); only a category pick with no resolvable template still defers.
 */
const SWAP_DEFERS_TO_LEGACY = new Set<string>([
  'no_template_for_category',
]);

/**
 * Errors from an add resolution that mean "fall through to the legacy writer".
 * Stage 3 owns only the empty/rest-day add; occupied-day STACK adds, a category
 * with no template, and a re-add onto a day emptied by an active removal
 * constraint (the restoration path) stay on the legacy writer.
 */
const ADD_DEFERS_TO_LEGACY = new Set<string>([
  'add_defers_to_legacy_stack',
  'no_template_for_category',
]);

/**
 * Every candidate this module materialises, with the athlete's G-1 answer
 * applied to the landing template.
 *
 * The producer never calls `materializeCanonicalPlanChangeCandidate` directly:
 * a call site that forgot the transform would ask the athlete which route they
 * wanted and then land the untransformed session anyway.
 */
function materializeAthleteCandidate(
  input: Omit<CanonicalPlanChangeCandidateInput, 'transformTemplate'>,
): CanonicalPlanChangeCandidateResult {
  return materializeCanonicalPlanChangeCandidate({
    ...input,
    transformTemplate: g1RouteTemplateTransform(input.change),
  });
}

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
  const materialized = materializeAthleteCandidate({
    change: args.change,
    currentDay: args.currentDay,
    todayISO: args.todayISO,
    canonicalizeWorkout: (date, workout) =>
      finaliseWorkoutAfterMutation(workout, {
        date,
        phase,
        // Read from the live phase clock, not defaulted — see the note in the
        // canonical context type. A swap on an off-season day used to arrive
        // here without the subphase and lose its power block.
        offseasonSubphase: canonicalContextSubphase(
          phase,
          liveOffseasonSubphaseForDate(date),
        ),
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
  // ── The day before a game, once, for every door ──────────────────────────
  //
  // The athlete may claim G-1 from its filler, and only after being asked. A
  // routeless landing answers with the ask instead of applying anything —
  // which is what makes a silent substitution unreachable from ANY door.
  //
  // This sits above every branch on purpose. Under it are refusals that hand
  // work to the legacy writer (`add_defers_to_legacy_stack` is the occupied-day
  // stack — exactly the add Sam hit on G-1), and a gate below them would let
  // that path apply a full session on the day before a game without a word.
  const g1Ask = g1LandingAskForChange({ change, visibleWeek: args.visibleWeek });
  const g1Route = committingG1Route(change);
  if (g1Ask && !g1Route) {
    return { ok: false, error: 'g1_route_required' };
  }
  // A route that would leave nothing on the day is not one of the three
  // answers — it is a bin, and the athlete has a bin. Refused here, before any
  // door applies anything, so no path can publish an empty "Done".
  if (g1Ask && g1Route && !routeYieldsContent(change, g1Route, args.visibleWeek)) {
    return { ok: false, error: 'g1_route_yields_nothing' };
  }
  if (change.kind === 'move_session') {
    const sourceDay = args.visibleWeek.find((day) =>
      day.date === change.fromDate);
    const targetDay = args.visibleWeek.find((day) =>
      day.date === change.toDate);
    if (!sourceDay?.workout) return { ok: false, error: 'nothing_to_move' };
    if (!targetDay) return { ok: false, error: 'not_visible' };
    // A protected anchor on the SOURCE day blocks a whole-day move, because the
    // anchor would travel with it. It says nothing about the gym session beside
    // it — that is the session-scoped move (Sam, 2026-07-30), and refusing it
    // here is what produced the empty picker.
    //
    // THE DESTINATION IS DIFFERENT, AND THE OLD RULE HERE WAS THE DEFECT.
    // "Nothing may land on a team night" was never a law — Sam's doubling law
    // (2026-07-30) says a session moved onto a team night lands as a COMBINED
    // day, which is the exact shape generation itself produces ("Team Training
    // + Upper Push"): one hard day, two sessions. His re-test hit the old rule
    // as a generic "nothing on your plan changed, try again" — advice that
    // could not work, over a move that should simply have happened.
    //
    // Game day stays locked, and every other refusal on such a move belongs to
    // a law that actually bites — the hard-day budget, the G-1 ask — each with
    // its own honest sentence.
    const moveScope = change.scope ?? 'whole_day';
    if (moveScope === 'whole_day' &&
      protectedAnchorsForDaySnapshot(snapshotProjectedDay(sourceDay)).length > 0) {
      return { ok: false, error: 'protected_anchor_day' };
    }
    if (protectedAnchorsForDaySnapshot(snapshotProjectedDay(targetDay))
      .some((anchor) => anchor.kind === 'game')) {
      return { ok: false, error: 'protected_game_day' };
    }
    // A SCOPED MOVE MAY LAND ON AN OCCUPIED DAY — this refusal was the other
    // half of the doubling law, left behind.
    //
    // Last unit the free-days-only filter came off the OFFER
    // (`moveOptionsForDay`) so the picker would stop saying "there's nowhere to
    // move this" about moves the ruling permits. This check stayed, so the menu
    // advertised occupied destinations and the door refused them — an
    // offer/commit disagreement, visible on Sam's tape at 10:28:57 as
    // `scoped_move_destination_occupied`, one build after the offer changed.
    //
    // Absorption defines the meaning the old comment said was missing: the
    // arriving component stacks beside what is already there, exactly as a
    // whole-day move onto a team night does. Game day is still locked above.
    // A resolver-owned game-proximity filler (e.g. G+1 Recovery) on the
    // destination is not a swappable athlete-owned session — it is regenerated
    // every render, so a real session moved onto its day is silently overwritten
    // and the "swapped-back" filler duplicates onto the source day. Refuse rather
    // than classify it as a swap. G-1 is exempt: the athlete has now been asked,
    // and the transaction owner discards the filler rather than relocating it.
    if (isResolverOwnedDerivedSession(targetDay.workout) && !g1Ask) {
      return { ok: false, error: 'move_destination_resolver_owned' };
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
    // Game day is fully locked — no swap, no override. Team Training anchors ARE
    // swappable: the materializer keeps the anchor and replaces only the gym
    // component (a whole-session removal whose remainingWorkout is "Team
    // Training + <new>"), so it rides the transaction like any other swap.
    if (protectedAnchorsForDaySnapshot(snapshotProjectedDay(swapDay))
      .some((anchor) => anchor.kind === 'game')) {
      return { ok: false, error: 'protected_game_day' };
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

  if (change.kind === 'add_category' || change.kind === 'add_template') {
    const addDay = args.visibleWeek.find((day) => day.date === change.date);
    if (!addDay) return { ok: false, error: 'not_visible' };
    // Game day is fully locked — no add, no override.
    if (protectedAnchorsForDaySnapshot(snapshotProjectedDay(addDay))
      .some((anchor) => anchor.kind === 'game')) {
      return { ok: false, error: 'protected_game_day' };
    }
    // OCCUPIED-DAY STACK ADDS COME HOME — the legacy deferral is retired.
    //
    // This line said "out of scope this stage" and deferred to a legacy writer
    // that does not deliver, so every day already holding a session offered
    // `addOnTopCategories` in the sheet and then refused the tap with the
    // generic "that change didn't go through". The athlete-door matrix declared
    // it (`OFFERS_THE_DOOR_REFUSES`) and it is TWO of Sam's five device
    // findings: adding strength to his G+1 Recovery Sunday, and adding
    // conditioning to an occupied day.
    //
    // Nothing needed building. `canonicalPlanChangeCandidateMaterializer`
    // already stacks an `add_template` onto an occupied day — `if (!source)
    // return template; return stackTemplate({ base: source, template, ... })` —
    // and `resolveTemplatePlanChange` already converts `add_category` into
    // exactly that kind. The capability was written, reachable and untested
    // because this early return stood in front of it.
    //
    // The semantics are Sam's doubling law at the add door: what is there stays,
    // the new session stacks beside it, and the day becomes the combined shape
    // generation already produces. Game day is still locked above; a day emptied
    // by an active whole-day removal still defers below, because a re-add is a
    // restoration and not a net-new add.
    // A day emptied by an active whole-DAY removal is a re-add (restoration
    // path), not a net-new add — defer so this primitive never fights it. Only a
    // real removal leaves the day empty with remainingWorkout null; add/swap pins
    // carry a remainingWorkout and leave the day occupied (handled above), so
    // they are excluded here by the remainingWorkout check.
    const hasActiveRemoval = useProgramStore.getState().userRemovalConstraints.some(
      (constraint) => constraint.status === 'active' &&
        constraint.targetDate === change.date &&
        constraint.scope === 'whole_session' &&
        !constraint.remainingWorkout);
    if (hasActiveRemoval) return { ok: false, error: 'add_defers_to_legacy_stack' };
    const template = resolveTemplatePlanChange({ change, visibleWeek: args.visibleWeek });
    if (!template) return { ok: false, error: 'no_template_for_category' };
    // No source workout on an empty day → the materializer yields the bare new
    // session (the empty-day add content), through the pure finaliser boundary.
    const materialized = materializeAthleteSwapSession({
      change: template,
      currentDay: addDay,
      todayISO: change.date,
    });
    if (materialized.ok === false) return { ok: false, error: materialized.error };
    const pickedTitle = listCoachRevisionTemplates().find(
      (definition) => definition.templateId === template.templateId,
    )?.label ?? materialized.title;
    return {
      ok: true,
      kind: 'add_session',
      input: {
        date: change.date,
        reason: `${args.source}:add_session:${change.date}`,
        source: args.source,
        addedWorkout: materialized.workout,
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

/**
 * The athlete-facing sentence for a refusal the domain has no framed copy for.
 *
 * NEVER THE CODE ITSELF (Sam's honest-outcome law; the door matrix asserts it on
 * every cell). `section18_week_rejected` and `day_already_has_strength` are the
 * vocabulary of the rules layer, and they were reaching the athlete inside
 * "That change isn't possible here (…)". The code still travels — on the
 * rejection entry and the tape, where diagnosis reads it — just not in the
 * sentence.
 */
function refusalSentenceFor(code: string): string {
  return athleteSafeRefusal(code);
}

function blockedAssessmentForBuildError(
  change: PlanChange,
  error: string,
): ProgramEditRiskAssessment | null {
  if (error !== 'protected_anchor_day' && error !== 'protected_game_day' &&
    error !== 'move_destination_resolver_owned' &&
    error !== 'g1_route_yields_nothing') return null;
  const date =
    'date' in change
      ? change.date
      : change.kind === 'move_session'
      ? change.fromDate
      : null;
  // Game day is fully locked (product decision): a plain-language refusal, never
  // a raw error code. Other protected anchors keep the generic guard copy. A
  // game-proximity filler day (G-1/G+1) is resolver-managed around the fixture,
  // so a session can't land there — plain-language, game-framed, no raw code.
  const message = error === 'protected_game_day'
    ? "It's game day — sessions can't be changed or added here."
    : error === 'move_destination_resolver_owned'
    ? "That day is kept light around your game, so a session can't be moved onto it. The plan is untouched."
    // A route that would leave the day empty is refused in the words already
    // used for a change that cannot be made safely. No new copy is invented for
    // a case that exists because a classifier is wrong; see the note in
    // rules/g1LandingAsk.placeSessionForRoute.
    : error === 'g1_route_yields_nothing'
    ? "I couldn't safely make that change, so the plan is untouched."
    : 'This would remove or replace a protected game/team anchor, so it cannot be applied from this edit flow.';
  const ruleId = error === 'protected_game_day'
    ? 'game_day_locked'
    : error === 'move_destination_resolver_owned'
    ? 'game_proximity_day_locked'
    : error === 'g1_route_yields_nothing'
    ? 'g1_route_yields_nothing'
    : 'protected_anchor_edit_blocked';
  return {
    decision: 'block',
    highestLevel: 'hard_stop',
    findings: [{
      ruleId,
      level: 'hard_stop',
      message,
      dates: date ? [date] : [],
      sessions: [],
      canOverride: false,
      source: 'program_edit_guard',
      bibleRef: 'Section 16 App / AI rules; Section 17.E',
      data: { error },
    }],
    introducedRuleIds: [ruleId],
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
    const wantsTypedAdd = args.change.kind === 'add_category' ||
      args.change.kind === 'add_template';
    if (args.change.kind === 'move_session' || args.change.kind === 'remove_session' ||
      wantsTypedSwap || wantsTypedAdd) {
      const resolution = resolveAthleteMutation({
        change: args.change,
        visibleWeek: args.visibleWeek,
        source: 'tap',
      });
      // No-template swaps and occupied-day / restoration adds defer to legacy.
      const defersToLegacy = resolution.ok === false && (
        (wantsTypedSwap && SWAP_DEFERS_TO_LEGACY.has(resolution.error)) ||
        (wantsTypedAdd && ADD_DEFERS_TO_LEGACY.has(resolution.error)));
      // The ask is not a refusal and not a risk finding. Nothing is applied and
      // nothing is wrong — the athlete simply has not answered yet. It is
      // checked before `defersToLegacy` because an occupied-day add defers, and
      // the legacy writer would apply it without ever raising the ask.
      if (resolution.ok === false && resolution.error === 'g1_route_required' &&
        isG1RoutedChange(args.change)) {
        const ask = g1LandingAskForChange({
          change: args.change,
          visibleWeek: args.visibleWeek,
        });
        if (ask) {
          return finish({
            ok: true,
            message: G1_LANDING_WARNING.ask.headline,
            appliedDates: [],
            rejected: [],
            proposedWeek: args.visibleWeek,
            assessment: emptyAssessment,
            g1Ask: ask,
          }, { internalResultCode: resolution.error });
        }
      }
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
          message: refusalSentenceFor(resolution.error),
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
            : resolution.kind === 'add_session'
              ? stageAthleteSessionAdditionTransaction(
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
                : resolution.kind === 'add_session'
                  ? 'athlete_addition_preview_failed'
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
        message: refusalSentenceFor(proposal.error),
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
      validationPolicy: validationPolicyForPlanChange(args.visibleWeek, args.todayISO, args.change),
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
  /** Test/host seam; production defaults to the accepted-state addition transaction. */
  commitAthleteAddition?: (input: AthleteSessionAdditionTransactionInput) => unknown;
  /**
   * Test seam for the visible post-condition: supplies the week the producer
   * reads back AFTER committing. Production omits it and the live resolver is
   * used. This exists so the post-condition can be exercised against a REAL
   * transaction — simulating the resolver re-deriving over a committed change,
   * which is the device failure — rather than against a stubbed commit.
   */
  readVisibleWeekAfterCommit?: (dates: readonly string[]) => ResolvedDay[];
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
        args.change.kind === 'swap_template' ||
        args.change.kind === 'add_category' ||
        args.change.kind === 'add_template';
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

/**
 * The session the ACCEPTED state actually holds on `date`, read back after a
 * commit.
 *
 * Sam's ruling #6 (2026-07-30): the confirmation is a projection of the accepted
 * RESULT, never of the request. Naming `pickedTitle` — what the athlete tapped —
 * is what let the sheet say "Done. Lower Body Strength is now on <date>" when
 * the transaction had short-circuited and the day held a Gunshow.
 */
/**
 * The name the ATHLETE will read on that day, for copy that claims a session.
 *
 * The accepted week and the rendered week can name the same day differently —
 * canonicalisation renames from final content, and the resolver composes. The
 * add door reported "Done. Full Body Strength added" over a day the athlete saw
 * as "Lower Squat"; both were true of different projections, and only one of
 * them is on the screen. The door matrix caught it on the G+1 recovery day.
 *
 * Falls back to the accepted name, then to the request, so the sentence never
 * gets less honest than it was.
 */
function visibleSessionNameOn(date: string): string | null {
  try {
    const week = resolveWeekWithConditioning(
      getMondayForDate(date), buildScheduleStateImperative());
    return week.find((day) => day.date === date)?.workout?.name ?? null;
  } catch {
    return null;
  }
}

function acceptedSessionNameOn(date: string): string | null {
  const state = useProgramStore.getState();
  const profile = useProfileStore.getState().onboardingData;
  try {
    const week = rebaseAcceptedEffectiveWeek({
      surfaces: state,
      weekStart: getMondayForDate(date),
      profile,
      markedDays: state.acceptedMaterialContext.markedDays,
    });
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    return week.visibleWorkouts.find((workout) => workout.dayOfWeek === dayOfWeek)?.name ?? null;
  } catch {
    // The read-back is a copy input, not a safety gate. If the accepted week
    // cannot be rebased the caller still reports honestly, just less specifically.
    return null;
  }
}

/**
 * Run a typed athlete commit as a VERIFIED transaction (Sam's ruling #7).
 *
 * The tap door had no visible verification at all. `assertAcceptedVisibleLedgerEquivalence`
 * looks like it, and is not: its "visible" side is the accepted-week projection,
 * which never runs game proximity against live schedule state, so it structurally
 * cannot see a later precedence layer re-deriving over a committed change. And
 * it compares ledger COUNTS, not identity. The sheet's own render observer is
 * dev-only telemetry that returns silently on a mismatch.
 *
 * So this asks the coach door's question with the coach door's consequences:
 * commit, re-resolve the week the ATHLETE sees, and if the days the mutation
 * claimed did not move, restore the exact prior surfaces and report a refusal.
 * Rolling back is what makes "so the plan is untouched" true rather than a
 * second lie — the same post-condition shape `commitAthleteSessionMoveTransaction`
 * already uses for content conservation.
 */
interface VisibleVerificationFailure {
  unchangedDates: string[];
  missingDates: string[];
}

function commitVerifiedAgainstVisibleWeek<T>(args: {
  before: readonly ResolvedDay[];
  dates: readonly string[];
  commit: () => T;
  /**
   * The host replaced publication with its own function, so the post-condition
   * is theirs too. Verifying a caller's stub against the live store compares
   * two unrelated things and would "pass" or "fail" for reasons that have
   * nothing to do with the stub. No production caller supplies these seams.
   */
  hostOwnsCommit: boolean;
  /** Test seam: where the AFTER week is read from. Defaults to the live one. */
  readVisibleWeek?: (dates: readonly string[]) => ResolvedDay[];
}): { ok: true; value: T; failure: null }
  | { ok: false; value: null; failure: VisibleVerificationFailure } {
  const priorState = { ...useProgramStore.getState() };
  const value = args.commit();
  if (args.hostOwnsCommit) return { ok: true, value, failure: null };
  // A stage that published nothing has its own answer (ruling #6) and is not
  // the case this post-condition is about.
  if (publicationNoChange(value)) return { ok: true, value, failure: null };
  const verification = verifyVisibleDatesChanged({
    before: args.before,
    after: (args.readVisibleWeek ?? liveVisibleWeekFor)(args.dates),
    dates: args.dates,
  });
  if (verification.ok) return { ok: true, value, failure: null };
  useProgramStore.setState(priorState);
  return {
    ok: false,
    value: null,
    failure: {
      unchangedDates: verification.unchangedDates,
      missingDates: verification.missingDates,
    },
  };
}

/** The week the athlete would see right now, covering every claimed date. */
function liveVisibleWeekFor(dates: readonly string[]): ResolvedDay[] {
  const weekStarts = Array.from(new Set(dates.map((date) => getMondayForDate(date))));
  const state = buildScheduleStateImperative();
  return weekStarts.flatMap((weekStart) => resolveWeekWithConditioning(weekStart, state));
}

function visibleVerificationFailedResult(
  failure: VisibleVerificationFailure,
): PlanChangeApplyResult {
  return {
    ok: false,
    outcome: 'refused',
    message: "I couldn't safely make that change, so the plan is untouched.",
    appliedDates: [],
    rejected: [{
      date: failure.unchangedDates[0] ?? failure.missingDates[0] ?? null,
      code: 'visible_change_unverified',
      reason: `The committed change did not reach the visible week (unchanged: ${
        failure.unchangedDates.join(', ') || 'none'}; missing: ${
        failure.missingDates.join(', ') || 'none'}).`,
    }],
  };
}

/** A stage that published nothing. Not a success, not a failure — ruling #6. */
function noChangeResult(
  noChange: { reason: string },
): PlanChangeApplyResult {
  return {
    ok: false,
    outcome: 'no_change',
    message: classifyProgramMutationRefusal({ reason: noChange.reason }).userMessage,
    appliedDates: [],
    rejected: [],
  };
}

/** The `noChange` a commit reports, when it reports one. */
function publicationNoChange(transaction: unknown): { reason: string } | null {
  if (!transaction || typeof transaction !== 'object') return null;
  const noChange = (transaction as { noChange?: unknown }).noChange;
  if (!noChange || typeof noChange !== 'object') return null;
  const reason = (noChange as { reason?: unknown }).reason;
  return typeof reason === 'string' ? { reason } : null;
}

function applyPlanChangeWithinTrace(args: ApplyPlanChangeInput): PlanChangeApplyResult {
  // Commit through the same typed owner used by preview. This is intentionally
  // before proposal/template policy construction and before the legacy
  // revision override writer.
  const wantsTypedSwap = args.change.kind === 'swap_category' ||
    args.change.kind === 'swap_template';
  const wantsTypedAdd = args.change.kind === 'add_category' ||
    args.change.kind === 'add_template';
  if (args.change.kind === 'move_session' || args.change.kind === 'remove_session' ||
    wantsTypedSwap || wantsTypedAdd) {
    const resolution = resolveAthleteMutation({
      change: args.change,
      visibleWeek: args.visibleWeek,
      source: 'tap',
    });
    if (resolution.ok === false) {
      // No-template swaps and occupied-day / restoration adds are not owned by
      // this stage — fall through to the legacy registry writer below.
      const defersToLegacy =
        (wantsTypedSwap && SWAP_DEFERS_TO_LEGACY.has(resolution.error)) ||
        (wantsTypedAdd && ADD_DEFERS_TO_LEGACY.has(resolution.error));
      if (!defersToLegacy) {
        // Defence in depth for the ask. The sheet holds the change back until
        // the athlete answers; a caller that commits anyway is refused in the
        // domain's own words rather than getting a silent full-session landing
        // on the day before a game.
        if (resolution.error === 'g1_route_required') {
          return {
            ok: false,
            outcome: 'refused',
            message: `${G1_LANDING_WARNING.ask.headline} The plan is untouched.`,
            appliedDates: [],
            rejected: [{
              date: isG1RoutedChange(args.change)
                ? landingDateForChange(args.change)
                : null,
              code: resolution.error,
              reason: 'The athlete has not chosen a route for the day before their game.',
            }],
          };
        }
        // Game day is locked — surface the plain-language block, never a raw code.
        const blocked = blockedAssessmentForBuildError(args.change, resolution.error);
        return {
          ok: false,
          outcome: 'refused',
          message: blocked
            ? blocked.findings[0]?.message ?? "That change can't be applied here."
            : refusalSentenceFor(resolution.error),
          appliedDates: [],
          rejected: [],
        };
      }
    } else if (resolution.kind === 'move_session') {
      if (args.change.kind !== 'move_session') {
        throw new Error('Athlete move resolution did not match its typed intent');
      }
      let moveNoChange: { reason: string } | null = null;
      let moveUnverified: VisibleVerificationFailure | null = null;
      try {
        const verified = commitVerifiedAgainstVisibleWeek({
          before: args.visibleWeek,
          dates: resolution.appliedDates,
          commit: () => (args.commitAthleteMove ?? commitAthleteSessionMoveTransaction)(
            resolution.input,
          ),
          hostOwnsCommit: !!args.commitAthleteMove,
          readVisibleWeek: args.readVisibleWeekAfterCommit,
        });
        if (verified.ok) moveNoChange = publicationNoChange(verified.value);
        else moveUnverified = verified.failure;
      } catch (error) {
        return {
          ok: false,
          outcome: 'refused',
          message: "I couldn't safely make that change, so the plan is untouched.",
          appliedDates: [],
          rejected: [{
            date: args.change.fromDate,
            code: (error as { code?: string })?.code ?? 'athlete_move_publication_failed',
            reason: (error as Error)?.message ?? String(error),
          }],
        };
      }
      if (moveUnverified) return visibleVerificationFailedResult(moveUnverified);
      if (moveNoChange) return noChangeResult(moveNoChange);
      return {
        ok: true,
        outcome: 'applied',
        message: moveDoneMessage(args.change),
        appliedDates: resolution.appliedDates,
        rejected: [],
      };
    } else if (resolution.kind === 'swap_session') {
      // A swap rides the deletion transaction (whole-session removal with the
      // new session as remainingWorkout), so it inherits Bin's authorised-
      // reduction + disclosure ownership.
      let publishedOutcome: AthleteDeletionPublishedOutcome | null = null;
      let swapNoChange: { reason: string } | null = null;
      let swapUnverified: VisibleVerificationFailure | null = null;
      try {
        const verified = commitVerifiedAgainstVisibleWeek({
          before: args.visibleWeek,
          dates: resolution.appliedDates,
          commit: () => (args.commitAthleteRemoval ??
            commitAthleteSessionDeletionTransaction)(resolution.input),
          hostOwnsCommit: !!args.commitAthleteRemoval,
          readVisibleWeek: args.readVisibleWeekAfterCommit,
        });
        if (!verified.ok) {
          swapUnverified = verified.failure;
        } else {
          const transaction = verified.value;
          swapNoChange = publicationNoChange(transaction);
          if (transaction && typeof transaction === 'object' &&
            'deletionOutcome' in transaction) {
            publishedOutcome = (transaction as {
              deletionOutcome: AthleteDeletionPublishedOutcome;
            }).deletionOutcome;
          }
        }
      } catch (error) {
        return {
          ok: false,
          outcome: 'refused',
          message: "I couldn't safely make that change, so the plan is untouched.",
          appliedDates: [],
          rejected: [{
            date: resolution.input.date,
            code: (error as { code?: string })?.code ?? 'athlete_swap_publication_failed',
            reason: (error as Error)?.message ?? String(error),
          }],
        };
      }
      if (swapUnverified) return visibleVerificationFailedResult(swapUnverified);
      if (swapNoChange) return noChangeResult(swapNoChange);
      return {
        ok: true,
        outcome: 'applied',
        message: athleteSwapDoneMessage(
          resolution.input.date,
          // Ruling #6: name what LANDED — and what landed is what the athlete
          // SEES, which the accepted projection can name differently.
          visibleSessionNameOn(resolution.input.date)
            ?? acceptedSessionNameOn(resolution.input.date)
            ?? resolution.pickedTitle,
          publishedOutcome),
        appliedDates: resolution.appliedDates,
        rejected: [],
      };
    } else if (resolution.kind === 'add_session') {
      // An add on an empty/rest day rides the dedicated addition transaction:
      // §18 is repaired cross-day (never rejected for an off-target condition),
      // and any repaired day is disclosed in the confirmation.
      let additionOutcome: AthleteAdditionPublishedOutcome | null = null;
      let addNoChange: { reason: string } | null = null;
      let addUnverified: VisibleVerificationFailure | null = null;
      try {
        const verified = commitVerifiedAgainstVisibleWeek({
          before: args.visibleWeek,
          dates: resolution.appliedDates,
          commit: () => (args.commitAthleteAddition ??
            commitAthleteSessionAdditionTransaction)(resolution.input),
          hostOwnsCommit: !!args.commitAthleteAddition,
          readVisibleWeek: args.readVisibleWeekAfterCommit,
        });
        if (!verified.ok) {
          addUnverified = verified.failure;
        } else {
          const transaction = verified.value;
          addNoChange = publicationNoChange(transaction);
          if (transaction && typeof transaction === 'object' &&
            'additionOutcome' in transaction) {
            additionOutcome = (transaction as {
              additionOutcome: AthleteAdditionPublishedOutcome;
            }).additionOutcome;
          }
        }
      } catch (error) {
        return {
          ok: false,
          outcome: 'refused',
          message: "I couldn't safely make that change, so the plan is untouched.",
          appliedDates: [],
          rejected: [{
            date: resolution.input.date,
            code: (error as { code?: string })?.code ?? 'athlete_addition_publication_failed',
            reason: (error as Error)?.message ?? String(error),
          }],
        };
      }
      if (addUnverified) return visibleVerificationFailedResult(addUnverified);
      if (addNoChange) return noChangeResult(addNoChange);
      return {
        ok: true,
        outcome: 'applied',
        message: athleteAdditionDoneMessage(
          resolution.input.date,
          visibleSessionNameOn(resolution.input.date)
            ?? acceptedSessionNameOn(resolution.input.date)
            ?? resolution.pickedTitle,
          additionOutcome),
        appliedDates: resolution.appliedDates,
        rejected: [],
      };
    } else {
      if (args.change.kind !== 'remove_session') {
        throw new Error('Athlete deletion resolution did not match its typed intent');
      }
      let publishedOutcome: AthleteDeletionPublishedOutcome | null = null;
      let removalNoChange: { reason: string } | null = null;
      let removalUnverified: VisibleVerificationFailure | null = null;
      try {
        const verified = commitVerifiedAgainstVisibleWeek({
          before: args.visibleWeek,
          dates: resolution.appliedDates,
          commit: () => (args.commitAthleteRemoval ??
            commitAthleteSessionDeletionTransaction)(resolution.input),
          hostOwnsCommit: !!args.commitAthleteRemoval,
          readVisibleWeek: args.readVisibleWeekAfterCommit,
        });
        if (!verified.ok) {
          removalUnverified = verified.failure;
        } else {
          const transaction = verified.value;
          removalNoChange = publicationNoChange(transaction);
          if (transaction && typeof transaction === 'object' &&
            'deletionOutcome' in transaction) {
            publishedOutcome = (transaction as {
              deletionOutcome: AthleteDeletionPublishedOutcome;
            }).deletionOutcome;
          }
        }
      } catch (error) {
        return {
          ok: false,
          outcome: 'refused',
          message: "I couldn't safely make that change, so the plan is untouched.",
          appliedDates: [],
          rejected: [{
            date: args.change.date,
            code: (error as { code?: string })?.code ?? 'athlete_removal_publication_failed',
            reason: (error as Error)?.message ?? String(error),
          }],
        };
      }
      if (removalUnverified) return visibleVerificationFailedResult(removalUnverified);
      if (removalNoChange) return noChangeResult(removalNoChange);
      return {
        ok: true,
        outcome: 'applied',
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
      outcome: 'refused',
      message: refusalSentenceFor(proposal.error),
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
    validationPolicy: validationPolicyForPlanChange(args.visibleWeek, args.todayISO, args.change),
    setManualOverride: args.setManualOverride,
  });

  if (apply.applied.length === 0 || apply.rejected.length > 0) {
    return {
      ok: false,
      outcome: 'refused',
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

  // NAME WHAT THE ATHLETE SEES, not what was requested. `pickedTitle` is the
  // registry label for the thing they picked; on a stacked day the day ends up
  // named for its combination, and the door matrix caught this branch claiming
  // "Full Body Strength added" over a day reading "Lower Squat".
  const landedOn = 'date' in args.change ? args.change.date : null;
  const message = planChangeDoneMessage(
    args.change,
    (landedOn ? visibleSessionNameOn(landedOn) : null) ?? pickedTitle,
  );

  return {
    ok: true,

    outcome: 'applied',
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

/**
 * Add copy is a projection of the accepted addition transaction result. Names
 * the session the athlete now has and, when the whole-week §18 repair touched
 * other days, discloses every one (disclosed-repair parity, invariant #4).
 */
function athleteAdditionDoneMessage(
  date: string,
  pickedTitle: string | null,
  outcome: AthleteAdditionPublishedOutcome | null,
): string {
  const label = pickedTitle ?? 'New session';
  const lead = `Done. ${label} added on ${outcomeWeekday(date)}.`;
  if (!outcome || outcome.kind !== 'added_with_repair' || outcome.repairedDates.length === 0) {
    return lead;
  }
  const days = outcome.repairedDates.map(outcomeWeekday);
  const named = days.length === 1
    ? days[0]
    : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
  return `${lead} I rebalanced ${named} to keep your week balanced.`;
}

/**
 * Names any day the whole-week §18 repair touched beyond the target and the
 * already-named relocation destination — disclosed-repair parity with the
 * addition path (invariant #4). Mirrors `athleteAdditionDoneMessage`'s voice so
 * a residual emptied/rebalanced day is never silent.
 */
function residualRepairClause(
  outcome: AthleteDeletionPublishedOutcome,
): string {
  const alreadyNamed = new Set<string>();
  if (outcome.targetDate) alreadyNamed.add(outcome.targetDate.slice(0, 10));
  if (outcome.destinationDate) alreadyNamed.add(outcome.destinationDate.slice(0, 10));
  const residual = outcome.repairedDates
    .map((entry) => entry.slice(0, 10))
    .filter((entry) => !alreadyNamed.has(entry));
  if (residual.length === 0) return '';
  const days = residual.map(outcomeWeekday);
  const named = days.length === 1
    ? days[0]
    : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
  return ` I also rebalanced ${named} to keep your week balanced.`;
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
  const residual = residualRepairClause(outcome);
  if (outcome.kind === 'reduced') {
    const target = outcome.affectedMetric === 'conditioning_core'
      ? 'conditioning target'
      : 'strength target';
    return `${removed} This week’s ${target} has been reduced at your request.${residual}`;
  }
  if (outcome.kind === 'already_satisfied') {
    const base = outcome.affectedMetric === 'session'
      ? removed
      : `${removed} Your remaining sessions already cover this week’s target.`;
    return `${base}${residual}`;
  }
  const day = outcomeWeekday(outcome.destinationDate);
  if (patterns.has('squat') || patterns.has('hinge')) {
    return `${removed} Lower-body strength was moved to ${day} to keep your week balanced.${residual}`;
  }
  if (patterns.size === 1 && patterns.has('pull')) {
    return `${removed} Pulling work was added to ${day}.${residual}`;
  }
  if (patterns.size === 1 && patterns.has('push')) {
    return `${removed} Pushing work was added to ${day}.${residual}`;
  }
  if (outcome.affectedMetric === 'conditioning_core') {
    return `${removed} Conditioning work was added to ${day}.${residual}`;
  }
  return `${removed} Required work was added to ${day}.${residual}`;
}

/**
 * IS THIS RESULT A QUESTION RATHER THAN A REFUSAL?
 *
 * `g1_route_required` is a SENTINEL. It means "this landing needs the athlete's
 * answer", and the ask-flow is the only door onto the day before a game. It has
 * to travel as `outcome: 'refused'` because nothing was applied — but a caller
 * that reads that as a rejection tells the athlete their edit failed, when the
 * app was in the middle of asking them a question.
 *
 * That is exactly what happened on Sam's device: the producer answered
 * `g1_route_required`, `executeProgramControlAction` reported
 * `program_control_move_session_rejected` with `failureCategory:
 * technical_failure`, and the ask never rendered. Three taps, three identical
 * wrong answers.
 *
 * So the OWNER answers the question instead of every caller re-deriving it from
 * a code string. A caller routes on this; it never translates the code.
 */
export function planChangeResultIsLandingAsk(
  result: Pick<PlanChangeApplyResult, 'outcome' | 'rejected'>,
): boolean {
  return result.outcome !== 'applied' &&
    (result.rejected ?? []).some((entry) => entry.code === 'g1_route_required');
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

/**
 * THE CONFIRMATION NARRATES THE ACTION THAT WAS TAKEN.
 *
 * This sentence used to branch on `swapped`, which means nothing more than
 * "the destination day was occupied", and told the athlete that two days
 * "swapped sessions". Under Sam's doubling law (2026-07-30, ruling 3) a move
 * onto an occupied day ABSORBS — the arriving session stacks beside what is
 * already there and NOTHING TRAVELS BACK to the source day. So the swap
 * sentence described behaviour the app had stopped performing: the athlete was
 * told their Wednesday now held Thursday's session, and it did not.
 *
 * The branch is deleted rather than reworded. A move is a move at both
 * destinations, the plain sentence is true in both cases, and inventing a
 * second sentence for a distinction that no longer exists is how the first one
 * survived its own ruling. What else ends up on the day is the disclosure
 * clause's business, and that is already appended by the repair-disclosure law.
 *
 * The walker found this from a fresh install in three actions — onboard,
 * generate, move onto an occupied day — and it is the same class as the device
 * report that an ADD of conditioning was confirmed with "moved Upper Pull".
 */
function moveDoneMessage(change: Extract<PlanChange, { kind: 'move_session' }>): string {
  return `Done. Session moved to ${change.toDate}.`;
}
