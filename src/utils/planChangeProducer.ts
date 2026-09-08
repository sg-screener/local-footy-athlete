import { semanticFingerprint } from './programSemanticSnapshot';
import { athleteAdditionWarnings, athleteAdditionWarningText } from '../rules/athleteAdditionWarnings';
import { getEffectiveGameDates } from './sessionResolver';
/**
 * Tap-first plan changes: preview and commit both stage the same typed
 * accepted mutation. The retired parallel CoachRevisionProposal builder had
 * no app callers; current session effects reconstruct through the compiler.
 */

import type { ResolvedDay } from './sessionResolver';
import {
  effectiveGameDatesAround,
  getMondayForDate,
  resolveWeekWithConditioning,
} from './sessionResolver';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { verifyVisibleDatesChanged } from './visibleDatesChangeVerifier';
import type { OverrideContext, UserRemovalScope, Workout } from '../types/domain';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import {
  snapshotProjectedDay,
  type CoachRevisionSectionKind,
  type CoachVisibleDaySnapshot,
} from './coachRevisionProposal';
import {
  dayIsFixture, partHoldsTheDayDown, project, projectParts, type ProjectedDayParts,
} from '../rules/projectVisibleWeek';
import {
  buildCoachRevisionTemplateWorkout,
  listCoachRevisionTemplates,
  type CoachRevisionTemplateDefinition,
} from './coachRevisionTemplates';
import {
  byeUnlockedDatesForWeek,
  protectedAnchorsForDaySnapshot,
} from './coachRevisionPolicy';
import {
  materializeCanonicalPlanChangeCandidate,
  stackSessionOntoTeamAnchor,
  type CanonicalPlanChangeCandidateInput,
  type CanonicalPlanChangeCandidateResult,
} from './canonicalPlanChangeCandidateMaterializer';
import { g1RouteTemplateTransform } from './g1RouteMaterialisation';
import {
  applyTeamNightSafeSwaps,
  teamNightFlaggedRows,
  TEAM_NIGHT_CONTENT_ASK,
  type TeamNightFlaggedRow,
} from '../rules/teamNightContentAsk';
import { weekdayNameForDate } from '../rules/teamNightMoveAsk';
import { deriveVisibleWeekLive } from './deriveVisibleWeek';
import { getTeamTrainingWorkoutState } from './teamTraining';
import { liveAthleteContext } from './liveAthleteContext';
import { assertLiveWorkoutWrite } from './postGenerationConstraintValidation';
import {
  canonicalContextSubphase,
  finaliseWorkoutAfterMutation,
} from './workoutCanonicalisation';
import { isG1RoutedChange } from './planChangeTypes';
import {
  TEAM_NIGHT_MOVE_ASK,
  teamNightMoveAskContext,
} from '../rules/teamNightMoveAsk';
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
import { classifyProgramMutationRefusal } from '../rules/programMutationRefusal';
import { athleteSafeRefusal } from './planChangeRefusalCopy';
import {
  reduceAcceptedSessionForAthleteRemoval,
  splitAcceptedSessionForAthleteMove,
} from './sessionComponents';
import type { ValidateProgramWeekInput } from '../rules/weekStructureValidator';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { storedWorldSurfaces } from './liveEvaluationSurfaces';
import { isResolverOwnedDerivedSession } from '../rules/derivedSessionProvenance';
import {
  G1_LANDING_WARNING,
  g1LandingRoute,
  placeSessionForRoute,
  resolveG1LandingAsk,
  type G1LandingAskContext,
} from '../rules/g1LandingAsk';
import { fixtureAwareMarkedDaysForWeek } from '../rules/section18AcceptedWeekGateway';
import {
  strengthVariantByTemplateId,
  strengthVariantForPatterns,
} from '../data/strengthSessionVariants';
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
import { canonicalAcceptedSessionEditEffectFromDiff } from '../rules/canonicalWeeklySessionEditCompiler';
import { canonicalSessionMutationIntentForPlanChange } from '../rules/canonicalWeeklySessionEditState';

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
  primer: (t) => t.category === 'primer' && t.derivedType === 'primer',
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
  // Both rows replace one that read "Accessories / Gunshow or prehab - small
  // muscles, big payoff", which was the copy admitting the door was two doors: a
  // sub-label naming two things with "or" is a menu that has not decided what it
  // offers.
  //
  // "Gunshow" is Sam's own word and is already the session's athlete-facing name, so
  // the label is his; the sub describes the signed structure without cluttering the
  // menu with its six-exercise count. Still PROPOSED, NOT YET SIGNED
  // (docs/COPY_SHEET_RULINGS_2026-07-30.md §6-II-c).
  gunshow: {
    label: 'Gunshow',
    sub: 'Arms and delts - light pump work',
  },
  // SIGNED — Sam, 2026-07-31, closing §6-IV-1: the fifth Add/Swap row is
  // **"ACCESSORIES"**, ruling 9's own word and the athlete's familiar term. The
  // CATEGORY ID stays `prehab` — a typed id nobody reads — so the door, the
  // template match and every capability are untouched; only the word changed. The
  // sub-line is unchanged and still signed as written: "the armour work" describes
  // what this door places whichever noun heads the row.
  prehab: {
    label: 'Accessories',
    sub: 'Groin, calves, midline, shoulders - the armour work',
  },
  // PRIMER (R-129). "Primer" is the word Sam chose, and it is free on the
  // athlete's screen: R-110 removed the POWER / PRIMER disclosure on 2026-08-20,
  // so no surface renders the word today. The CODE's `primer` (powerPrimerPolicy,
  // power_primer_budget) means the explosive rows INSIDE a strength session and
  // never reaches an athlete — the same split that lets `arms_pump` read
  // "Gunshow". PROPOSED, NOT YET SIGNED as copy.
  primer: {
    label: 'Primer',
    // SIGNED — Sam, 2026-08-23, replacing my proposed line after seeing it on
    // glass: *"change primer subtitle - short, sharp session to feel ready for
    // game day"*. His words say what it is FOR; mine described what is in it.
    sub: 'Short, sharp session to feel ready for game day',
  },
};


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
  // PRIMER joins the STRENGTH kind, as Gunshow and Prehab do. `kind` is the
  // ledger's question — "what sort of slot does this occupy on the day" — not a
  // statement about load; the charter's `countsTowardLoad: false` answers that,
  // and a Primer moves no total for the same reason a Gunshow moves none.
  if (
    category.startsWith('strength_')
    || category === 'gunshow'
    || category === 'prehab'
    || category === 'primer'
  ) return 'strength';
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
  // `primer` sits with strength here for the SAME reason it does in
  // `categoryAddsSessionKind`, and the two must never disagree — a split
  // between these functions is what once let the sheet offer Mobility on a day
  // the writer then refused it on.
  if (category === 'strength' || category === 'accessories' || category === 'primer') {
    return 'strength';
  }
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
   *  `placement` says whether the move lands, combines or trades places. */
  occupiedBy: string | null;
  placement: 'move' | 'combine' | 'swap';
}

/**
 * Why a day offers no move. Sam's ruling (2026-07-30), direction (b): the
 * refusal travels WITH the list so the surface can never render emptiness as
 * though it were an answer.
 */
export type PlanChangeMoveRefusalReason =
  /** Nothing on the day to move. */
  | 'no_session'
  /**
   * `anchored_day` RETIRED (team-night movability, Sam signed 2026-08-02):
   * a team anchor no longer refuses a move — the day offers the `team` scope
   * and the typed ask decides once-or-permanent. The signed sentence "Team
   * training is fixed to this day, so it can't be moved from here." retires
   * with it (copy sheet Batch 10); SWAP keeps its own signed refusal.
   */
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
  /** Past work moves only through the unlogged missed-session prompt. */
  | 'past_not_authorised'
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
  nothing_movable:
    "Nothing on this day can be moved to another day.",
  past_not_authorised:
    "Past sessions can only be moved from an unlogged-session prompt.",
  no_destination:
    "There's nowhere to move this in the weeks you can edit — every other day is a game, team training, or already full.",
};

const MOVE_SCOPE_COPY: Record<PlanChangeMoveScopeId, { label: string; sub: string }> = {
  whole_day: { label: 'Move the whole session', sub: 'Pick another day for it' },
  strength: { label: 'Just the gym session', sub: 'Team training stays on this day' },
  conditioning: { label: 'Just the conditioning', sub: 'The rest of the day stays' },
  recovery: { label: 'Just the recovery work', sub: 'The rest of the day stays' },
  // PROPOSED (Batch 10 table; parked §8): the scope row for the anchor itself.
  // Picking a destination for this scope raises the typed team-night ask —
  // the row promises the question, not the move.
  team: { label: 'Team training', sub: "Pick the night it's on — we'll ask if it's permanent" },
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

/**
 * DOES REMOVING FROM THIS DAY EMPTY IT? — the ONE predicate, and the reason it
 * is here rather than in the sheet.
 *
 * Sam ruled (2026-07-31, copy sheet §6-IV-3) that the Remove row's sub-line is
 * STATE-SELECTED: "Remove it — day becomes rest" on a day whose only content
 * is the thing being removed, "Pick a session to remove" on a day with more on
 * it. Batch 3's principle — a signed sentence must never be able
 * to lie — applied to itself, using this unit's own pattern: a typed cause picks
 * the sentence, nothing guesses.
 *
 * THE HAZARD THIS EXISTS TO REMOVE IS TWO PREDICATES, NOT ONE MISSING SENTENCE.
 * The confirmation one tap later already says "the day becomes rest", selected by
 * `step.label === null`, which `PlanChangeSheet` sets from `binScopes.length`. If
 * the row's sub-line derived that same claim from anything else — a part count, a
 * `visibleSessionCount`, `canRemove` — the row and the confirmation could disagree
 * about the same day, which is a signed sentence lying with a second signed
 * sentence standing next to it saying so. So the sheet asks THIS function three
 * times for one answer: whether to show the scope picker at all, which sub-line
 * the row carries, and (through `label: null`) which confirmation follows.
 *
 * `binScopesForSnapshot` is the fact: it lists a single scope exactly when that
 * scope IS the day (`kinds.length < 2` → `[WHOLE_DAY_SCOPE]`), and lists each part
 * plus a whole-day option when there is more than one. One scope therefore means
 * removing empties the day, and it is the same fact the producer already computed
 * — not a new one derived beside it.
 */
export function removeEmptiesTheDay(options: PlanChangeDayOptions): boolean {
  return options.binScopes.length <= 1;
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
function additionAssessment(date: string, workout: Workout, visibleWeek: ResolvedDay[]): ProgramEditRiskAssessment {
  const existingIds = new Set(visibleWeek.find(day => day.date === date)?.workout?.exercises.map(row => row.id));
  const gameDates = [...getEffectiveGameDates(buildScheduleStateImperative(), date)];
  const warnings = [...new Set(workout.exercises.filter(row => !existingIds.has(row.id)).flatMap(row =>
    athleteAdditionWarnings({ dateISO: date, exerciseName: row.exercise.name, gameDates, week: visibleWeek })))];
  const findings = warnings.map(warning => ({ ruleId: `athlete_add_${warning}`, level: 'soft' as const,
    message: athleteAdditionWarningText(warning), dates: [date], sessions: [workout.name],
    canOverride: true, source: 'program_edit_guard' as const }));
  return { decision: findings.length ? 'confirm' : 'allow', highestLevel: findings.length ? 'soft' : 'info',
    findings, introducedRuleIds: findings.map(finding => finding.ruleId), worsenedRuleIds: [] };
}

function projectedDay(day: ResolvedDay): ProjectedDayParts {
  return projectParts({ week: [day], weekStart: day.date }).days[0];
}

export function listPlanChangeOptionsForDay(args: {
  visibleWeek: ResolvedDay[];
  date: string;
  todayISO: string;
  pastUnloggedMove?: { readonly sourceDate: string; readonly kind: 'session' | 'team_training' | 'game' };
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
    pastMoveKind: args.pastUnloggedMove?.sourceDate === args.date
      ? args.pastUnloggedMove.kind
      : undefined,
  });

  // R-387: another session remains available regardless of existing kinds/count.
  const visibleSessionKinds = visibleSessionKindsForSnapshot(snap);
  const visibleSessionCount = snap.workout?.sections.length ?? 0;
  const canAddOnTop =
    projected.capabilities.canAdd && visibleSessionCount > 0;

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
    binScopes: canRemove ? binScopesForSnapshot(snap, project({ week: [day], weekStart: day.date }).days[0].parts) : [],
    addOnTopCategories: canAddOnTop
      ? categories
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
  pastMoveKind?: 'session' | 'team_training' | 'game';
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
  // WHICH answer is decided by a typed fact the projection already carries —
  // does this day hold a team anchor? Under the team-night movability ruling
  // (signed 2026-08-02) the anchor is movable (the projection's own
  // `team_training` part capability says so — one owner), so a team night
  // passes this gate and offers the `team` scope; picking a destination
  // raises the typed ask.
  const holdsTeamAnchor = args.projected.parts.some((part) => part.kind === 'team_training');
  if (args.date < args.todayISO && !args.pastMoveKind) return refuse('past_not_authorised');
  if (!args.projected.capabilities.canMoveWholeDay) {
    return args.projected.parts.length === 0 ? refuse('no_session') : refuse('nothing_movable');
  }

  // A team night IS a destination (Sam's doubling law, 2026-07-30): the session
  // lands beside the anchor as a combined day. Only game day is excluded.
  const sourceIsPast = args.date < args.todayISO;
  const candidates = args.visibleWeek.filter((candidate) =>
    candidate.date !== args.date &&
    (!sourceIsPast || candidate.date >= args.todayISO) &&
    isWithinEditHorizon(candidate.date, args.todayISO) &&
    !protectedAnchorsForDaySnapshot(snapshotProjectedDay(candidate))
      .some((anchor) => anchor.kind === 'game'));
  const destinationsFor = (scope: PlanChangeMoveScopeId): PlanChangeMoveDestination[] =>
    candidates
      .map((candidate) => {
        const candidateSnapshot = snapshotProjectedDay(candidate);
        const occupiedBy = candidateSnapshot.workout?.title ?? null;
        const combinesWithTeam = scope === 'team' ||
          projectedDay(candidate).parts.some((part) => part.kind === 'team_training');
        return {
          date: candidate.date,
          occupiedBy,
          placement: occupiedBy === null
            ? 'move' as const
            : combinesWithTeam
              ? 'combine' as const
              : 'swap' as const,
        };
      })
      .filter((destination) => {
        if (!sourceIsPast || scope === 'team' || destination.occupiedBy === null) return true;
        const target = args.visibleWeek.find((candidate) => candidate.date === destination.date);
        const targetParts = target ? projectedDay(target).parts : [];
        return targetParts.length > 0 && targetParts.every((part) => part.kind === 'team_training');
      })
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
  // WHAT IS ON THIS DAY IS THE PROJECTION'S ANSWER TOO — Sam's ruling,
  // 2026-08-12. The gate above already asks the owner whether anything may leave;
  // the OFFER used to be built from a second decomposition of the same day
  // (`visibleSessionKindsForSnapshot`, the card's section kinds), and on
  // 2026-08-12 the two disagreed on a real walked day. The card rendered a lone
  // recovery session as a `session` appointment named "Rest"; the projection
  // carried a movable `recovery` part. `session` is correctly absent from the
  // movable section kinds, so the offer came out empty and the door refused
  // `nothing_movable` about work the app itself said could move — walker L-P4,
  // seed 3, 2026-10-15. Asked which decomposition was right, Sam answered
  // "recovery session".
  //
  // So the second reading is DELETED rather than corrected. Both halves of the
  // offer now come from `args.projected`, and the scope ids stay the mutation
  // vocabulary the writer speaks — the ids are what the transaction addresses, the
  // MEMBERSHIP is what the owner decides.
  const componentScopes: PlanChangeMoveScopeId[] = [
    ...MOVABLE_COMPONENT_SCOPES.filter((scope) => args.projected.parts.some(
      (part) => part.kind === scope && part.capabilities.canMove)),
    // The anchor itself, LAST — keyed on the projection's typed anchor fact,
    // never on a section kind (a "Club Session" commitment carries no team
    // anchor and stays immovable).
    ...(holdsTeamAnchor ? (['team'] as const) : []),
  ];
  // Content the athlete cannot reschedule: a commitment is a fixed appointment,
  // binnable for one date (`binScopesForSnapshot` offers exactly that) but not
  // movable to another day. Its presence is what makes a whole-day move wrong —
  // that move would take the commitment with it.
  //
  // NOT `part.capabilities.canMove`, WHICH IS THE NEAR-MISS THIS COMMENT USED TO
  // WARN ABOUT. A recovery add-on also answers `canMove: false` and yet TRAVELS
  // with a whole-day move, because the workout moves and the add-on is a field on
  // the workout; keying on `canMove` would turn every add-on day into a scoped
  // offer and quietly retire the whole-day move from days that should have it.
  // `partHoldsTheDayDown` is the owner's own name for the difference — position 2
  // of `partCapabilities` (does not travel, CAN be dropped for one date) against
  // an add-on's `NOTHING_MAY_BE_DONE` — imported rather than re-stated, so what
  // this door treats as immovable is exactly what the projection means by it.
  const carriesImmovableContent = args.projected.parts.some(partHoldsTheDayDown);
  const dragsSomethingItShouldNot = carriesImmovableContent ||
    hasProtectedAnchors(args.snapshot);
  // A single-component day has nothing to scope: moving "just the gym session"
  // off a day that is only a gym session IS the whole-day move, and offering
  // both would be two names for one action.
  const allOffered: PlanChangeMoveScopeId[] = dragsSomethingItShouldNot
    ? componentScopes
    : componentScopes.length > 1
      ? ['whole_day', ...componentScopes]
      : ['whole_day'];
  const offered = sourceIsPast && args.pastMoveKind === 'team_training'
    ? allOffered.filter((scope) => scope === 'team')
    : sourceIsPast && args.pastMoveKind === 'session'
      ? allOffered.filter((scope) => scope !== 'team')
      : allOffered;
  if (offered.length === 0) return refuse('nothing_movable');

  const scopes = offered
    .map((id) => ({ id, ...MOVE_SCOPE_COPY[id], destinations: destinationsFor(id) }))
    .filter((scope) => scope.destinations.length > 0);
  if (scopes.length === 0) return refuse('no_destination');
  return { scopes, refusal: null };
}

/** Component scopes a Move may take off a day, in the order the sheet shows.
 *  `team` is deliberately absent: the anchor scope is keyed on the projection's
 *  typed team anchor, not on a section kind (see `moveOptionsForDay`). */
const MOVABLE_COMPONENT_SCOPES: readonly Exclude<PlanChangeMoveScopeId, 'whole_day' | 'team'>[] =
  ['strength', 'conditioning', 'recovery'] as const;

// `MOVE_SCOPE_SECTION_KIND` and `MOVABLE_SECTION_KINDS` were DELETED here on
// 2026-08-12, in the commit that stopped this door reading the card's section
// kinds. They mapped a move scope onto a `CoachRevisionSectionKind` and listed
// which of those kinds could travel — the second decomposition of a day that
// disagreed with the projection on a real walked week (see `moveOptionsForDay`).
// The scope ids survive as `MOVABLE_COMPONENT_SCOPES`, because the TRANSACTION
// still speaks them; only the membership test moved to the owner. Nothing else
// read either table.

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
  labels: readonly { kind: string; headline: string }[],
): PlanChangeBinScope[] {
  const kinds = Array.from(
    new Set((snap.workout?.sections ?? []).map((section) => section.kind)),
  );
  const parts = kinds
    .map((kind) => BIN_SCOPE_FOR_SECTION_KIND[kind])
    .filter((scope): scope is PlanChangeBinScope => !!scope)
    .map(scope => ({ ...scope, label: labels
      .filter(part => part.kind === (scope.id === 'team' ? 'team_training' : scope.id))
      .map(part => part.headline).join(' + ') || scope.label }));
  const anchors = protectedAnchorsForDaySnapshot(snap);
  if (anchors.some((anchor) => anchor.kind === 'team_training')) {
    return parts;
  }
  if (anchors.length > 0) return [];
  if (kinds.length < 2) return [WHOLE_DAY_SCOPE];
  return [...parts, WHOLE_DAY_SCOPE];
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
  code: 'game_week_fresh' | 'repeat_heavy';
  message: string;
}

export function planChangeWarningForCategory(args: {
  category: PlanChangeCategoryId;
  date: string;
  visibleWeek: ResolvedDay[];
}): PlanChangeWarning | null {
  const picked = pickTemplateForCategory(args);
  if (!picked) return null;
  const workout = buildCoachRevisionTemplateWorkout(picked.templateId, args.date);
  if (!workout) return null;
  const finding = additionAssessment(args.date, workout, args.visibleWeek).findings[0];
  return finding ? { code: finding.ruleId === 'athlete_add_near_game' ? 'game_week_fresh' : 'repeat_heavy', message: finding.message } : null;
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
   * warning and its gender-appropriate routes, then commit the same change with
   * `g1Route` set and this preview's trace. The warning is already the
   * confirmation, so the caller must not preview the answered change again.
   */
  g1Ask?: G1LandingAskContext | null;
  /**
   * Present when a move lands Bible :156 team-night-flagged lifts on a team
   * night and the athlete has not yet answered swap-or-keep (R-226). NOTHING
   * has been applied. The caller shows the two routes, re-issues the change
   * with `teamNightContentRoute` set — and warns once more on `keep_regular`
   * before committing, per the ruling.
   */
  teamNightContentAsk?: { flagged: TeamNightFlaggedRow[] } | null;
  /**
   * Present when the athlete is moving a TEAM NIGHT and has not yet answered
   * "just this once, or permanent?". NOTHING has been applied. The caller
   * shows the two routes (+ back) and re-issues the change with
   * `teamNightRoute` set; the commit rides the durable program-control door.
   */
  teamNightAsk?: import('../rules/teamNightMoveAsk').TeamNightMoveAskContext | null;
  /** Correlation context reused by the real commit door. */
  trace: AthleteActionTraceContext;
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
      surfaces: storedWorldSurfaces(args.staged.program),
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
  let targetWorkout = args.visibleWeek.find((day) =>
    day.date === args.change.toDate)?.workout ?? null;
  const targetHoldsTeamAnchor = !!targetWorkout &&
    getTeamTrainingWorkoutState(targetWorkout).hasTeamTraining;
  /**
   * ⚠ **THE DOOR REFUSES AN ABSORB THAT WOULD DELETE THE ANCHOR DAY'S OWN GYM
   * WORK — SAM, 2026-08-25, MEASURED (R-220).**
   *
   * `teamTrainingAnchorContainer` builds the absorb base with `exercises: []`.
   * That is right when the target is team training ALONE — the case the
   * doubling law was written for, where nothing can be lost. When the target
   * already holds a gym session it is destruction: a 6-exercise lower day moved
   * onto a Team Training day carrying 8 exercises produced `Team Training +
   * lower` with **6**, reported *"Done. Session moved."*, and lost the other 8.
   *
   * ⚠ **THE OFFER IS ALREADY FILTERED ABOVE, AND THAT IS NOT ENOUGH.** A caller
   * that does not consult `destinationsFor` — a future surface, a coach action,
   * a test — reaches this code with the same date and the same result. **The
   * suite that owns this class says the coverage shape is wrong because it is
   * organised BY PATH**; so the guard goes at the door every path passes, not
   * beside the one offer that happens to exist today.
   *
   * Refusing is not a capability lost. Sam's cap (R-218) is that a day may never
   * hold three, and club night + existing gym session + arrival IS three — the
   * move had no lawful result to produce.
   */
  /**
   * ⚠ **AN ABSORB ONTO A CLUB NIGHT THAT ALREADY HOLDS A GYM SESSION IS A SWAP
   * — SAM, 2026-08-25 (R-220), ANSWERING THE DEFECT HE FOUND.**
   *
   * *"pulling a strength day to a strength day just disappeared the session that
   * was originally there = it didnt swap them."* Measured: a 6-exercise lower
   * day onto a Team Training day carrying 8 exercises produced `Team Training +
   * lower` with 6, said *"Done. Session moved."*, and lost the 8.
   *
   * `teamTrainingAnchorContainer` builds the absorb base with `exercises: []`.
   * Correct when the club night is ALONE — the doubling law's own case, where
   * nothing can be lost. When it is not alone, that strip IS the deletion.
   *
   * **SO THE DAY IS SPLIT FIRST**: its gym session comes off, the arrival takes
   * that place beside the anchor, and the displaced session goes back to the day
   * the arrival came from. Sam's doubling law is kept — the anchor never moves
   * and the day is still combined — and his cap is kept too, because neither day
   * ends up holding three.
   *
   * ⚠ **TWO GYM PARTS ON ONE CLUB NIGHT IS REFUSED RATHER THAN GUESSED AT.**
   * That day is already at Sam's cap; there is no single session to displace and
   * choosing one would be picking something to delete, which is the whole defect
   * this replaces.
   */
  const targetDay = args.visibleWeek.find((day) => day.date === args.change.toDate);
  let displacedFromTarget: Workout | null = null;
  if (targetHoldsTeamAnchor && targetDay && (targetWorkout?.exercises ?? []).length > 0) {
    const targetGymScopes = MOVABLE_COMPONENT_SCOPES.filter((candidateScope) =>
      projectedDay(targetDay).parts.some((part) => part.kind === candidateScope));
    if (targetGymScopes.length !== 1) return null;
    const targetSplit = splitAcceptedSessionForAthleteMove({
      day: targetDay,
      scope: ATHLETE_REMOVAL_SCOPE[targetGymScopes[0]],
    });
    if (targetSplit.ok === false) return null;
    displacedFromTarget = targetSplit.movedWorkout;
    targetWorkout = targetSplit.remainingWorkout;
    if (!targetWorkout) return null;
  }
  /* R-226 swap_safe: the athlete chose the team-night-safe versions, so the
   * ARRIVING content is transformed before it stacks — same seam the G-1
   * route transform uses, and nothing but the arriving rows changes. */
  const arrivingContent = placedWorkout ?? componentSplit?.movedWorkout ?? sourceWorkout;
  const arrivingForAnchor = args.change.teamNightContentRoute === 'swap_safe'
    ? applyTeamNightSafeSwaps(arrivingContent).workout
    : arrivingContent;
  const combinedOntoAnchor = targetHoldsTeamAnchor && targetWorkout
    ? stackSessionOntoTeamAnchor({
      anchorDay: targetWorkout,
      addition: arrivingForAnchor,
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
    ...(displacedFromTarget ? { displacedFromTarget } : {}),
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
  // R-387: deliberate Add uses the shared warning and keeps the chosen dose.
  if (args.change.kind === 'add_category' || args.change.kind === 'add_template') return null;
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
      surfaces: storedWorldSurfaces(state),
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
    // R-130a item 3: her ask names the Primer, his the Gunshow.
    athleteGender: profile?.gender,
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

function isAthleteOwnedPlanChange(change: PlanChange): change is AthleteOwnedPlanChange {
  return change.kind === 'move_session' || change.kind === 'remove_session' ||
    change.kind === 'swap_category' || change.kind === 'swap_template' ||
    change.kind === 'add_category' || change.kind === 'add_template';
}

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
      // An add owned by the dedicated addition transaction (§18 repaired
      // cross-day, never rejected for an off-target condition): empty/rest
      // days, occupied-day stacks, and the re-add restoration onto a binned
      // day (the transaction flips the bin to restored/'explicit_re_add').
      ok: true;
      kind: 'add_session';
      input: AthleteSessionAdditionTransactionInput;
      pickedTitle: string | null;
      appliedDates: string[];
      swapped: false;
    }
  | { ok: false; error: string };

// THE LEGACY DEFERRAL IS RETIRED (Stage B stage 1, Option C item 3).
//
// Two defer-sets stood here, routing resolution errors to the legacy registry
// writer (`applyCoachRevisionDateOverrides`). Measured on main 936bbf7 before
// deletion:
// - `no_template_for_category` was a NO-OP double refusal — the legacy path
//   ran the identical `resolveTemplatePlanChange` lookup and refused with the
//   same code, never reaching the writer
//   (docs/STACK_PRIMITIVE_RETIREMENT_DIAGNOSIS_2026-07-23.md §5 Target 2).
// - `add_defers_to_legacy_stack` (the active-removal re-add) was the last
//   athlete route into the writer; the typed addition transaction now owns
//   the restoration (`stageAthleteSessionAdditionTransaction` flips the bin
//   to restored/'explicit_re_add' in the same staged proposal).
// No athlete surface reaches the legacy override writer any more.

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
    additionFactVersions: useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts.map(semanticFingerprint),
    transformTemplate: g1RouteTemplateTransform(input.change),
  });
}

/**
 * Materialise the new session a swap places on the day. Uses the pure
 * finaliseWorkoutAfterMutation boundary — NOT assertLiveWorkoutWrite — so the
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
  // This sits above every branch on purpose: every landing door answers the
  // ask before anything else gets to refuse or apply, so no path can put a
  // full session on the day before a game without a word. (It once also had
  // to outrank the legacy deferral, which would have applied without asking —
  // that writer is retired, the ordering stays.)
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
    /* ── R-226: FLAGGED CONTENT LANDING ON A TEAM NIGHT ASKS FIRST ─────────
     * The destination asks, typed routes, one funnel — the G-1 shape exactly.
     * The check runs on what MOVES (the scoped split when there is one), so a
     * conditioning-part move past a flagged strength day is not asked about.
     * G-1 outranks this ask (it sits above every branch); a day that is both
     * G-1 and a team night asks G-1 first, then lands here on the re-issue. */
    const movedContentForAsk = (() => {
      const moveScopeForAsk = change.scope ?? 'whole_day';
      if (moveScopeForAsk === 'whole_day') return sourceDay.workout;
      const split = splitAcceptedSessionForAthleteMove({
        day: sourceDay,
        scope: ATHLETE_REMOVAL_SCOPE[moveScopeForAsk],
      });
      return split.ok === false ? null : split.movedWorkout;
    })();
    const targetIsTeamNight = projectedDay(targetDay).parts
      .some((part) => part.kind === 'team_training');
    if (targetIsTeamNight && !change.teamNightContentRoute &&
      teamNightFlaggedRows(movedContentForAsk).length > 0) {
      return { ok: false, error: 'team_night_content_route_required' };
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
    // generation already produces. The game itself stays on its date.
    //
    // A day emptied by an active whole-DAY removal is a RESTORATION, not a
    // net-new add — and that too is typed now (Stage B stage 1): the addition
    // transaction flips the bin to restored/'explicit_re_add' in the same
    // staged proposal. The `add_defers_to_legacy_stack` deferral that stood
    // here handed the case to a legacy writer that could not deliver it.
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

    // THE TEAM-NIGHT ASK (Sam, signed 2026-08-02). The ask appears on a team
    // night EXACTLY — a `move_team_night` change whose source day carries no
    // team anchor is refused, never asked about — and an unanswered route is
    // not a refusal: nothing is applied, the athlete simply has not answered
    // yet (the same absence-raises-the-ask shape as G-1 below). A change WITH
    // a route never commits here: both routes ride the durable
    // program-control door (`move_team_night`), which owns the fact commit
    // and the one setup owner.
    if (args.change.kind === 'move_team_night') {
      const projected = (() => {
        const day = args.visibleWeek.find((candidate) =>
          candidate.date === (args.change as { fromDate: string }).fromDate);
        return day ? projectedDay(day) : null;
      })();
      const holdsAnchor = !!projected?.parts.some((part) => part.kind === 'team_training');
      if (!holdsAnchor) {
        return finish({
          ok: false,
          message: MOVE_REFUSAL_COPY.nothing_movable,
          appliedDates: [],
          rejected: [{
            date: args.change.fromDate,
            code: 'not_a_team_night',
            reason: 'move_team_night requires a team anchor on the source day',
          }],
          proposedWeek: args.visibleWeek,
          assessment: emptyAssessment,
        }, { internalResultCode: 'not_a_team_night' });
      }
      const context = teamNightMoveAskContext({
        fromDate: args.change.fromDate,
        toDate: args.change.toDate,
      });
      return finish({
        ok: true,
        message: TEAM_NIGHT_MOVE_ASK.title(),
        appliedDates: [],
        rejected: [],
        proposedWeek: args.visibleWeek,
        assessment: emptyAssessment,
        teamNightAsk: args.change.teamNightRoute ? null : context,
      }, {
        internalResultCode: args.change.teamNightRoute
          ? 'team_night_route_answered'
          : 'team_night_route_required',
      });
    }

    // Operation-scoped ownership: athlete move/delete resolves and stages
    // directly from the accepted visible snapshot. This branch is before
    // proposal construction, template-policy construction and the legacy
    // date-override writer by design.
    if (isAthleteOwnedPlanChange(args.change)) {
      const resolution = resolveAthleteMutation({
        change: args.change,
        visibleWeek: args.visibleWeek,
        source: 'tap',
      });
      // The ask is not a refusal and not a risk finding. Nothing is applied and
      // nothing is wrong — the athlete simply has not answered yet.
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
      // R-226's ask surfaces the same way G-1's does: not a refusal, not a
      // risk finding — the athlete simply has not answered yet.
      if (resolution.ok === false &&
        resolution.error === 'team_night_content_route_required' &&
        args.change.kind === 'move_session') {
        const moveChange = args.change;
        const flaggedSource = args.visibleWeek.find((day) =>
          day.date === moveChange.fromDate)?.workout ?? null;
        const flagged = teamNightFlaggedRows(flaggedSource);
        if (flagged.length > 0) {
          return finish({
            ok: true,
            message: TEAM_NIGHT_CONTENT_ASK.title,
            appliedDates: [],
            rejected: [],
            proposedWeek: args.visibleWeek,
            assessment: emptyAssessment,
            teamNightContentAsk: { flagged },
          }, { internalResultCode: resolution.error });
        }
      }
      if (resolution.ok === false) {
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
            assessment: resolution.kind === 'add_session'
              ? additionAssessment(resolution.input.date, resolution.input.addedWorkout, args.visibleWeek)
              : emptyAssessment,
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

    // NOTHING BELOW THE TYPED BRANCH OWNS AN ATHLETE CHANGE ANY MORE.
    //
    // The legacy registry writer (`applyCoachRevisionDateOverrides`) is
    // retired from this producer (Stage B stage 1, Option C): the six
    // athlete-owned kinds return from the typed branch above, the week-level
    // kinds (`shutdown_week`, `clear_days`) have no live product caller —
    // away days travel as schedule facts through the deriving lane,
    // bed-ridden is the illness_recovery §18 week mode — and
    // `move_team_night` is owned by the durable door. What reaches here is
    // refused honestly instead of being handed to a writer of a retired
    // shape (L15).
    return finish({
      ok: false,
      message: refusalSentenceFor('plan_change_kind_not_owned'),
      appliedDates: [],
      rejected: [],
      proposedWeek: args.visibleWeek,
      assessment: emptyAssessment,
    }, { internalResultCode: 'plan_change_kind_not_owned' });
  });
}

export interface ApplyPlanChangeInput {
  change: PlanChange;
  visibleWeek: ResolvedDay[];
  todayISO: string;
  /**
   * WHICH DOOR. Minted by `rules/athleteActionSourceLabel` from the action's
   * screen and handed in, because this producer cannot see the screen.
   *
   * It ends up as `lastTransaction`'s prefix, which is why it must be the same
   * value the event log carries: a summary export that says `tap:move_session`
   * while the log says `route: coach_tab` is two opinions about one action, and
   * the seat read exactly that pair backwards on 2026-08-10.
   *
   * Defaults to `'tap'` — every pre-existing caller meant the athlete's own
   * surfaces, and a default of `'coach'` would silently relabel them.
   */
  doorSource?: 'tap' | 'coach';
  applyOverride: (
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
  if (change.kind === 'move_session' || change.kind === 'move_team_night') return 'move_session';
  if (change.kind === 'add_template' || change.kind === 'add_category') return 'add_session';
  return 'program_change';
}

function sourceDate(change: PlanChange): string | undefined {
  return change.kind === 'move_session' || change.kind === 'move_team_night'
    ? change.fromDate : 'date' in change ? change.date : undefined;
}

function targetDate(change: PlanChange): string | undefined {
  return change.kind === 'move_session' || change.kind === 'move_team_night'
    ? change.toDate : 'date' in change ? change.date : undefined;
}

export function applyPlanChange(args: ApplyPlanChangeInput): PlanChangeApplyResult {
  const stateBefore = useProgramStore.getState();
  const constraintsBefore = [...stateBefore.userRemovalConstraints];
  const markedDaysBefore = {
    ...(stateBefore.acceptedMaterialContext.markedDays ?? {}),
  };
  const source = sourceDate(args.change);
  const target = targetDate(args.change);
  const sourceWorkout = source
    ? args.visibleWeek.find((day) => day.date === source)?.workout ?? null
    : null;
  const trace = beginAthleteActionTrace({
    // Same value as `lastTransaction`'s prefix below, and that is the point:
    // the log and the summary export must not hold two opinions about one door.
    source: args.doorSource ?? 'tap',
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
      // R1.4a (shell rebuild): a decision that LANDED is appended to the
      // ledger, verbatim and typed, in the same act. Refusals never reach it.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { appendDecisionEntry } = require('../store/decisionLedgerStore');
      const intent = canonicalSessionMutationIntentForPlanChange(args.change);
      if (!intent) {
        throw new Error(`Accepted plan change has no canonical session intent: ${args.change.kind}`);
      }
      const stateAfter = useProgramStore.getState();
      const acceptedEffect = canonicalAcceptedSessionEditEffectFromDiff({
        beforeConstraints: constraintsBefore,
        afterConstraints: stateAfter.userRemovalConstraints,
        beforeMarkedDays: markedDaysBefore,
        afterMarkedDays: stateAfter.acceptedMaterialContext.markedDays ?? {},
        mutationIntent: intent,
        affectedDates: result.appliedDates,
        acceptedAt: new Date().toISOString(),
      });
      appendDecisionEntry({
        decision: { kind: 'plan_change', change: args.change, acceptedEffect },
        provenance: 'athlete_tap',
        writer: 'program_control',
      });
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
        // The legacy writer is retired: a non-athlete-owned kind is refused at
        // the producer boundary itself (no typed owner for the kind).
        : 'plan_change_kind_not_owned';
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
    const week = deriveVisibleWeekLive(getMondayForDate(date));
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
      surfaces: storedWorldSurfaces(state),
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
  return weekStarts.flatMap((weekStart) => deriveVisibleWeekLive(weekStart));
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
  if (isAthleteOwnedPlanChange(args.change)) {
    const resolution = resolveAthleteMutation({
      change: args.change,
      visibleWeek: args.visibleWeek,
      source: args.doorSource ?? 'tap',
    });
    if (resolution.ok === false) {
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
      const beforeDay = args.visibleWeek.find(day => day.date === resolution.input.date);
      const afterDay = (args.readVisibleWeekAfterCommit ?? liveVisibleWeekFor)(resolution.appliedDates)
        .find(day => day.date === resolution.input.date);
      const beforeParts = beforeDay ? project({ week: [beforeDay], weekStart: beforeDay.date }).days[0].parts : [];
      const addedLabel = afterDay ? project({ week: [afterDay], weekStart: afterDay.date }).days[0].parts
        .filter(part => !beforeParts.some(before => before.kind === part.kind && before.bucket === part.bucket))
        .map(part => part.headline).join(' + ') : '';
      return {
        ok: true,
        outcome: 'applied',
        message: athleteAdditionDoneMessage(
          resolution.input.date,
          addedLabel || resolution.pickedTitle,
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

  // NOTHING BELOW THE TYPED BRANCH OWNS AN ATHLETE CHANGE ANY MORE.
  //
  // The legacy registry writer (`applyCoachRevisionDateOverrides`) is retired
  // from this producer (Stage B stage 1, Option C): the six athlete-owned
  // kinds return from the typed branch above, the week-level kinds
  // (`shutdown_week`, `clear_days`) have no live product caller — away days
  // travel as schedule facts through the deriving lane, bed-ridden is the
  // illness_recovery §18 week mode — and `move_team_night` is owned by the
  // durable door. What reaches here is refused honestly instead of being
  // handed to a writer of a retired shape (L15).
  return {
    ok: false,
    outcome: 'refused',
    message: refusalSentenceFor('plan_change_kind_not_owned'),
    appliedDates: [],
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

const INTERNAL_SESSION_PURPOSE_LABELS: Readonly<Record<string, string>> = {
  full_body: 'Full Body Strength',
  lower: 'Lower Body Strength',
  lower_squat: 'Lower Body Strength',
  lower_hinge: 'Lower Body Strength',
  upper: 'Upper Body Strength',
  upper_push: 'Upper Body Strength',
  upper_pull: 'Upper Body Strength',
};

/**
 * Accepted-state names can retain a scheduler purpose beside the final visible
 * title (for example `upper_pull + Full Body Strength`). Purpose ids are useful
 * internally and must never reach confirmation copy. When a real title is
 * present it wins; when the id is all we have, use its plain-language label.
 */
function athleteSafeSessionLabel(value: string | null): string {
  const raw = value?.trim() || 'New session';
  const parts = raw.split(/\s*\+\s*/).map((part) => part.trim()).filter(Boolean);
  const authored = parts.filter((part) => !INTERNAL_SESSION_PURPOSE_LABELS[part]);
  if (authored.length > 0) return authored.join(' + ');
  return parts.map((part) => INTERNAL_SESSION_PURPOSE_LABELS[part] ?? part).join(' + ');
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
  const label = athleteSafeSessionLabel(pickedTitle);
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
  const label = athleteSafeSessionLabel(pickedTitle);
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
  const upperComponent = patterns.size === 1
    && (patterns.has('pull') || patterns.has('push'))
    ? strengthVariantForPatterns(patterns)?.label ?? null
    : null;
  const component = scope === 'whole_day'
    ? 'Session'
    : scope === 'conditioning'
    ? 'Conditioning'
    : upperComponent
      ?? (scope === 'strength' ? 'Gym session' : 'Session');
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
    // R-228c (Sam, 2026-08-26): a bin result never claims the week is still
    // covered — "that's just untrue". The removal states itself and stops;
    // the reduced-target disclosure above stands, because it names a change
    // the app actually recorded.
    return `${removed}${residual}`;
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
  // R-226: the swap_safe route changed rows, and a change the athlete chose is
  // still a change the sentence names — Sam's SIGNED sentence (2026-08-26),
  // which names the landing weekday. keep_regular was warned BEFORE commit
  // (the confirm-warning step), so its done-sentence stays plain.
  if (change.teamNightContentRoute === 'swap_safe') {
    return TEAM_NIGHT_CONTENT_ASK.swappedDone(weekdayNameForDate(change.toDate));
  }
  return `Done. Session moved to ${change.toDate}.`;
}
