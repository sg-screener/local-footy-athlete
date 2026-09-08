import type { MainStrengthPattern } from '../rules/strengthPatternContributions';
/**
 * coachActions — Scoped, classification-driven program edits.
 *
 * The Coach can ONLY mutate the program through the 8 actions defined here.
 * Each action is scoped (LOCAL = today/tomorrow, WEEKLY = current week,
 * PERMANENT = future programs) and never reaches outside its scope.
 *
 * SCOPE ENFORCEMENT:
 *   - LOCAL/WEEKLY actions write to `dateOverrides` ONLY. The underlying
 *     microcycle template is never mutated. This guarantees that future
 *     weeks (which read from the template, not from overrides) stay
 *     untouched.
 *   - PERMANENT actions write to `athletePreferencesStore` and mirror a typed
 *     active preference constraint in `coachUpdatesStore`. They affect future
 *     program generation, never the current week's dateOverrides directly, and
 *     the mirrored constraint is what makes the ongoing modifier visible in
 *     Coach Notes.
 *
 * WHY date overrides instead of microcycle edits:
 *   `writeCoachOverride(date, workout)` is the resolver's Priority-1 short
 *   circuit (sessionResolver.ts:734). The override fully replaces the day
 *   without touching the underlying template. When the coach lightens
 *   Wednesday or moves Friday's session to Saturday, only those specific
 *   dates flip — every other day, including the same day-of-week in
 *   future weeks, resolves untouched.
 *
 * RETURN SHAPE:
 *   Every action returns { success, reason? } so the caller can:
 *   (a) gate the system message on actual application,
 *   (b) surface the reason ("could not find Bench Press on Tuesday")
 *       in the AI's reply pipeline.
 */

import { applyProgramOverrideWrite, useProgramStore, type ProgramOverrideWriteOutcome } from '../store/programStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { applyExerciseExclusionDecision } from './exerciseExclusionOwner';
import {
  useCoachUpdatesStore,
  type ActivePreferenceConstraint,
} from '../store/coachUpdatesStore';
import {
  addDays,
  getMondayStr,
  resolveDateWithConditioning,
} from './sessionResolver';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { resolveExerciseName } from './loadEstimation';
import { formatExerciseDisplayName } from './exerciseDisplay';
import { assertLiveWorkoutWrite } from './postGenerationConstraintValidation';
import { guardProgramEditWritesForHardStops, type ProgramEditWrite } from './programEditWriteGuard';
import type { OverrideContext, Workout, WorkoutExercise } from '../types/domain';
import {
  compileCanonicalExerciseEditOnWorkout,
  canonicalExerciseEditOverrideContext,
  resolveCanonicalExerciseEditTarget,
} from '../rules/canonicalWeeklyExerciseEditCompiler';

// ─── Types ───

export type CoachActionKind =
  | 'lighten_session'
  | 'move_session'
  | 'make_session_optional'
  | 'replace_exercise'
  | 'remove_exercise'
  | 'add_exercise'
  | 'add_weekly_override'
  | 'ban_exercise_globally'
  | 'set_preferred_alternative'
  | 'save_note';

export type ScopeKind =
  | 'local_adjustment'      // today + next 1-2 days
  | 'weekly_adjustment'     // current week only
  | 'permanent_preference'  // future programs
  | 'injury'                // weekly OR permanent depending on severity
  | 'exercise_swap'         // current session only (escalates to permanent if user implies)
  | 'schedule_change'       // current week — adjust + reflow
  | 'question_only';        // no mutation

export interface ActionResult {
  success: boolean;
  reason?: string;
  /**
   * Populated when the user's exercise query matched more than one exercise
   * in the resolved session. The dispatcher surfaces these to the AI so it
   * can ASK which the user meant rather than silently picking one. Always
   * accompanies success: false.
   */
  ambiguous?: { candidates: string[] };
}

function slugForPreferenceId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function upsertExercisePreferenceConstraint(input: {
  preferenceKind: ActivePreferenceConstraint['preferenceKind'];
  label: string;
  exercise?: string;
  alternative?: string;
  focus?: string;
}) {
  const now = new Date().toISOString();
  const idParts = [
    'preference',
    input.preferenceKind,
    input.exercise,
    input.alternative,
    input.focus,
  ].filter(Boolean);
  useCoachUpdatesStore.getState().upsertActiveConstraint({
    id: idParts.map((part) => slugForPreferenceId(String(part))).join('-'),
    type: 'preference',
    preferenceKind: input.preferenceKind,
    label: input.label,
    exercise: input.exercise,
    alternative: input.alternative,
    focus: input.focus,
    severity: 0,
    status: 'active',
    startDate: now.slice(0, 10),
    lastUpdatedAt: now,
    rules: [input.label],
    safeFocus: [],
    advice: [],
  });
}

export interface LightenSessionInput {
  date: string;
  /** Optional intensity floor — 'recovery' = full conversion to recovery; 'optional' = mark optional + halve volume; default 'optional' */
  level?: 'optional' | 'recovery';
}

export interface MoveSessionInput {
  fromDate: string;
  toDate: string;
}

export interface MakeSessionOptionalInput {
  date: string;
}

export interface ReplaceExerciseInput {
  date: string;
  fromExercise: string;
  /**
   * Today's ISO date. When provided, the owner refuses to edit a past-dated
   * workout — the single place both doors (tap + coach) inherit past-date
   * protection, instead of each door guarding separately.
   */
  todayISO?: string;
  /** Optional exact row identity from a tapped UI exercise. */
  fromExerciseId?: string;
  /**
   * WHY THIS ROW IS NOT THE ONE THE ATHLETE ASKED FOR. Set only when a FACT
   * (an injury, a kit loss) is displacing an earlier choice, so the screen can
   * say whose place this row is taking. An athlete's own swap leaves it absent.
   * See the note on the `swap_exercise` payload.
   */
  substitutedFrom?: {
    baseExerciseName: string;
    originExerciseName?: string;
    cause: 'injury' | 'kit_today';
  };
  toExercise: {
    name: string;
    sets: number;
    repsMin: number;
    repsMax: number;
    weight?: number;
    notes?: string;
    prescriptionType?: WorkoutExercise['prescriptionType'];
    perSide?: boolean;
    restSeconds?: number;
  };
}

export interface RemoveExerciseInput {
  date: string;
  exercise: string;
  /** Optional exact row identity from a tapped UI exercise. */
  exerciseId?: string;
  /**
   * WHY the row is going, typed. Sam, 2026-08-18: *"Do not collapse removal
   * causes."* The three have different fallback behaviour and different §18
   * credit, and the caller is the only layer that knows which this is.
   * Defaults to `'exclusion'` — the removal SCREEN's case, which is an
   * exercise-identity exclusion unless an active injury fact says otherwise.
   *
   * ⚠ THIS FIELD CURRENTLY HAS NO READER (demolition area 2, 2026-08-19). Its
   * only consumer was `legalPatternReplacement`, which chose a legal lift to
   * fill the slot the removal emptied — and it fed the pattern-restore pass,
   * which is deleted. The field is KEPT because the typed cause is Sam's own
   * approved contract and its callers still state it; the FILLING is on the
   * rebuild list, owner = the composer. It is named here rather than left to
   * look wired.
   */
  cause?: 'equipment' | 'exclusion' | 'injury';
}

export interface AddExerciseAtDateInput {
  date: string;
  additionId?: string;
  additionFactVersions?: readonly string[];
  exercise: {
    name: string;
    sets: number;
    repsMin: number;
    repsMax: number;
    weight?: number;
    notes?: string;
    prescriptionType?: WorkoutExercise['prescriptionType'];
    perSide?: boolean;
    restSeconds?: number;
  };
}

export type WeeklyOverrideRule =
  | 'reduce_lower_volume'
  | 'reduce_intensity'
  | 'no_running'
  | 'remove_optional_sessions';

export interface AddWeeklyOverrideInput {
  rule: WeeklyOverrideRule;
}

export interface BanExerciseGloballyInput {
  exercise: string;
}

export interface SetPreferredAlternativeInput {
  exercise: string;
  alternative: string;
}

export interface PinExerciseGloballyInput {
  exercise: string;
}

// ─── Helpers ───

function finitePositiveNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return fallback;
}

/**
 * Decides whether the proposed workout differs from the current one in any
 * way the athlete would notice. The comparator is deliberately narrow — it
 * considers ONLY the fields the user listed as "real change":
 *
 *   • exercise list (by name + sets + reps + weight, in order)
 *   • workout name + type
 *   • session tier (core/optional/recovery)
 *   • workout-level intensity
 *   • combined conditioning presence + intent
 *
 * Description / timestamps / IDs are intentionally ignored — they're not
 * "real changes" for the athlete and would otherwise force every action
 * to write a noisy override.
 *
 * Used by every action handler to short-circuit BEFORE writing an override.
 * If the proposed workout is equivalent to the resolved
 * current one, the action returns success: false (or simply skips for
 * weekly batch ops) and the day stays template-driven.
 */
/**
 * Every override this module writes is the coach acting on the athlete's
 * behalf, so the module names itself once at the door rather than eight times
 * at the call sites (LR-1). Behaviour is the retired primitive's, unchanged —
 * this is store ownership, not a coach-pipeline change (LR-6).
 */
/**
 * R-229 S3 (2026-08-26): THE OUTCOME FLOWS. This wrapper was `void` and every
 * caller returned `{ success: true }` over whatever the writer actually said —
 * the discarded-outcome shape the root-B reassessment named. Today the only
 * returnable refusals are the wipe-guard reasons (unreachable from these
 * callers, which always write a non-empty map) — the propagation is defence:
 * a refusal reason added to the slice write tomorrow surfaces at six doors
 * instead of vanishing at six doors. Failures inside the accepted-state
 * transaction still THROW and were never swallowed here.
 */
function writeCoachOverride(
  date: string,
  workout: Workout,
  context?: OverrideContext,
): ProgramOverrideWriteOutcome {
  return applyProgramOverrideWrite({ date, workout, context, writer: 'coach_action' });
}

/** R-228's signed failure sentence — the writer refused, nothing changed. */
const OVERRIDE_WRITE_REFUSED: ActionResult = {
  success: false,
  reason: "That didn't save — your week is unchanged.",
};

function workoutsAreEquivalent(a: Workout, b: Workout): boolean {
  if (a.name !== b.name) return false;
  if (a.workoutType !== b.workoutType) return false;
  if (a.sessionTier !== b.sessionTier) return false;
  if (a.intensity !== b.intensity) return false;
  if (!!a.hasCombinedConditioning !== !!b.hasCombinedConditioning) return false;
  if (!!a.conditioningBlock !== !!b.conditioningBlock) return false;
  if (a.conditioningBlock && b.conditioningBlock) {
    if (a.conditioningBlock.intent !== b.conditioningBlock.intent) return false;
    const ao = a.conditioningBlock.options?.length || 0;
    const bo = b.conditioningBlock.options?.length || 0;
    if (ao !== bo) return false;
  }
  if (a.exercises.length !== b.exercises.length) return false;
  for (let i = 0; i < a.exercises.length; i++) {
    const ea = a.exercises[i];
    const eb = b.exercises[i];
    if ((ea.exercise?.name || '') !== (eb.exercise?.name || '')) return false;
    if ((ea.prescribedSets || 0) !== (eb.prescribedSets || 0)) return false;
    if ((ea.prescribedRepsMin || 0) !== (eb.prescribedRepsMin || 0)) return false;
    if ((ea.prescribedRepsMax || 0) !== (eb.prescribedRepsMax || 0)) return false;
    if ((ea.prescribedWeightKg || 0) !== (eb.prescribedWeightKg || 0)) return false;
  }
  return true;
}

/** Resolve a date to its currently-effective Workout (or null if rest). */
/**
 * The day as the app AUTHORED it — every row, including ones an exclusion is
 * currently hiding.
 *
 * ⚠ **THIS IS A WRITER'S READ, AND IT MUST NOT CARRY THE ATHLETE'S EXCLUSIONS.**
 *
 * Every caller below clones this day and stores the result as an override
 * (`lightenSession`, `moveSession`, `makeSessionOptional`, `replaceExerciseAtDate`,
 * `addExerciseAtDate`, `addWeeklyOverride` — all six are writers, none is a view).
 * `buildScheduleStateImperative` delegates to `assembleScheduleState`, which
 * attaches `athleteExclusions` because it is one of the two doors that mean
 * *"what the athlete SEES"*. Reading a WRITE base through it meant the filter
 * was applied and then written down.
 *
 * MEASURED 2026-08-19 by `npm run test:session-change-sequence`: an athlete
 * removed `RDLs`, swapped a different row, and Restore had nothing to give back
 * — the swap's stored override had been built from a day `RDLs` was already
 * filtered out of, so the removal stopped being reversible the moment any other
 * row on that day was touched. The row was not hidden; it was destroyed.
 *
 * **A FILTER THAT GETS WRITTEN DOWN IS NOT A FILTER.** The exclusion stays a
 * read-time projection: the authored row remains in the stored program and the
 * VIEW doors hide it, which is what makes Restore able to return the exact item
 * rather than re-derive a replacement for it.
 *
 * `athleteExclusions: []` is STATED rather than defaulted, the same way
 * `liveEvaluationSurfaces.freshGenerationSurfaces` states it — this is a world
 * that deliberately has none, not one that forgot to look.
 */
function resolveDateWorkout(date: string): Workout | null {
  const state = { ...buildScheduleStateImperative(), athleteExclusions: [] };
  const resolved = resolveDateWithConditioning(date, state);
  return resolved?.workout || null;
}

/**
 * Match result for `findExerciseMatch`. The handler is REQUIRED to inspect
 * `kind` before reading any other field — `match` is only present on
 * 'unique', `candidates` only on 'ambiguous'.
 */
export type ExerciseMatchResult =
  | { kind: 'unique'; match: WorkoutExercise }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'not_found' };

/**
 * Resolve an athlete's exercise phrase to a single exercise in the given
 * workout, using a strict priority ladder. The goal is to NEVER silently
 * pick the wrong variant when the phrase could mean two different things.
 *
 * Priority tiers (first non-empty result wins):
 *   1. Case-insensitive exact match against the candidate's own name.
 *      "Back Squat" / "back squat" → Back Squat. Disambiguates immediately
 *      when the user has already typed the canonical name.
 *   2. Alias resolution via `resolveExerciseName(query)` → canonical, then
 *      case-insensitive exact match. "rdl" → "RDLs"; "barbell squat" →
 *      "Back Squat". This is the most common single-mention case.
 *   3. Substring fuzzy match: candidate.name contains query (one direction
 *      only — we never check `query.includes(candidate)` because that
 *      collapses every short query into the first long candidate).
 *
 * If a tier returns:
 *   • exactly one candidate → unique
 *   • two or more         → ambiguous (caller should ask the user which)
 *   • zero                → fall through to the next tier
 *
 * If all tiers return zero → not_found.
 *
 * Examples (workout has Back Squat + Front Squat + Goblet Squat):
 *   "back squat"    → unique(Back Squat)             [tier 1]
 *   "barbell squat" → unique(Back Squat)             [tier 2 alias]
 *   "squat"         → ambiguous([Back, Front, Goblet]) [tier 3 — multiple subs]
 *
 * Examples (workout has RDLs + Single-Leg RDL):
 *   "rdl"           → unique(RDLs)                   [tier 2 alias]
 *   "single leg rdl"→ unique(Single-Leg RDL)         [tier 2 alias]
 *   "RDL"           → unique(RDLs)                   [tier 2 alias]
 */
export function findExerciseMatch(workout: Workout, query: string): ExerciseMatchResult {
  const resolved = resolveCanonicalExerciseEditTarget(workout, {
    targetComponentId: null,
    targetName: query,
  });
  if (resolved.kind === 'found') return { kind: 'unique', match: resolved.row };
  return resolved;
}

/** Build a deep-enough Workout copy that the resolver can render. */
function blockedByHardStopRisk(
  writes: readonly ProgramEditWrite[],
  todayISO?: string,
): ActionResult | null {
  const datedWrites = writes.filter((write) => Boolean(write.date));
  if (datedWrites.length === 0) return null;
  const guard = guardProgramEditWritesForHardStops({
    writes: datedWrites,
    todayISO: todayISO ?? datedWrites.map((write) => write.date).sort()[0],
  });
  if (guard.ok === false) {
    return { success: false, reason: guard.message };
  }
  return null;
}

// ─── Actions ───

/** Retired: lighter-day and move decisions compile from typed ledger effects. */

/** Retired: optional-session decisions compile from typed ledger effects. */

/** Swap one exercise on a single date for another. */

/**
 * THE REPLACEMENT'S OWN LOAD — never the outgoing row's.
 *
 * Delegates to `loadForReplacementExercise`, the one owner of *"the replacement
 * exercise owns its load"* (own recorded history -> authored estimate -> blank).
 * This function's only job is to hand it the athlete's recorded loads and profile
 * from the live store, because the rule itself must stay pure.
 *
 * ⚠ **RECORDED LOADS ARE READ OVER ALL TIME, NOT OVER A BLOCK.** `readBlockHistory`
 * windows the completion/recovery gate but deliberately not the loads, so a
 * movement the athlete last loaded three blocks ago still resumes at their number.
 * The window passed here is therefore deliberately unbounded.
 */
export function loadForReplacementRow(exerciseName: string): number | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readBlockHistory, loadForReplacementExercise } =
      require('../rules/blockBoundaryProgression');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProgramStore } = require('../store/programStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProfileStore } = require('../store/profileStore');
    const history = readBlockHistory({
      feedbackByDate: useProgramStore.getState().sessionFeedback ?? {},
      blockStartISO: '0000-01-01',
      blockEndISO: '9999-12-31',
      requiredStrengthSessions: 0,
    });
    return loadForReplacementExercise({
      exerciseName,
      onboardingData: useProfileStore.getState().onboardingData,
      recordedLoadByExercise: history.lastRecordedLoadByExercise,
    });
  } catch {
    // A load we cannot resolve is UNSET, never the outgoing row's number.
    return undefined;
  }
}

export function replaceExerciseAtDate(input: ReplaceExerciseInput): ActionResult {
  const { date, fromExercise, fromExerciseId, toExercise, todayISO } = input;
  // This is a live-door guard only. Accepted actions never re-enter this
  // function at boot; the weekly compiler reconstructs them without asking a
  // second time whether the already-accepted edit may land.
  if (todayISO && date.slice(0, 10) < todayISO.slice(0, 10)) {
    return { success: false, reason: `${date} is in the past - I can't change it.` };
  }
  const current = resolveDateWorkout(date);
  if (!current) {
    return { success: false, reason: `No session on ${date} to swap exercise on.` };
  }
  const target = resolveCanonicalExerciseEditTarget(current, {
    targetComponentId: fromExerciseId ?? null,
    targetName: fromExercise,
  });
  if (target.kind === 'not_found') {
    return { success: false, reason: `Could not find "${fromExercise}" on ${date}.` };
  }
  if (target.kind === 'ambiguous') {
    return {
      success: false,
      reason: `"${fromExercise}" matches multiple exercises on ${date}: ${target.candidates.join(', ')}. Ask the athlete which one they mean.`,
      ambiguous: { candidates: target.candidates },
    };
  }
  const occurredAt = new Date().toISOString();
  const resolvedWeight = Number.isFinite(Number(toExercise.weight))
    ? Number(toExercise.weight)
    : loadForReplacementRow(toExercise.name);
  const canonicalWorkout = compileCanonicalExerciseEditOnWorkout(current, {
    kind: 'swap', decisionId: `live-swap:${date}:${target.index}`, occurredAt,
    dateISO: date.slice(0, 10), targetName: fromExercise,
    targetComponentId: fromExerciseId ?? null,
    replacement: {
      ...toExercise,
      ...(resolvedWeight !== undefined ? { weight: resolvedWeight } : {}),
    },
    ...(input.substitutedFrom ? { substitutedFrom: input.substitutedFrom } : {}),
  });
  const newWorkout = canonicalWorkout;
  if (workoutsAreEquivalent(current, newWorkout)) {
    return { success: false, reason: `"${fromExercise}" already matches the requested swap on ${date}.` };
  }
  // THE BOUNDARY REFUSES OR ALLOWS; IT NO LONGER RETURNS A DIFFERENT SESSION
  // (demolition area 1). The equivalence check below therefore compares the
  // coach's own edit, not a canonicalised rewrite of it.
  assertLiveWorkoutWrite(date, newWorkout);
  /**
   * ⚠ **THE COLLATERAL-LOSS REFUSAL THAT USED TO LIVE HERE IS GONE, DELIBERATELY.**
   *
   * It refused a swap that would also drop unrelated rows, and it was right about
   * the symptom: a one-row swap really did leave a 5-row day with 2 rows. But the
   * CAUSE was `resolveStrengthOwnershipBoundary` concluding `typed_no_strength` for
   * a day that visibly held five main lifts, so the canonicaliser deleted them all.
   * That is fixed at its own owner and mutation-proven.
   *
   * With the cause fixed the refusal became UNREACHABLE — removing it changed
   * nothing in any world this journey can produce (mutation M11 survived). An
   * authority no test can reach is an untested second opinion about the same
   * question, and two owners of "may this write land" is the defect class this repo
   * fights. The root fix is the single owner; this is not kept as a backstop.
   */
  /* ── THE MEDICAL-STOP GATE DOES NOT APPLY TO THE INJURY'S OWN ANSWER ──────
   *
   * `activeConstraintHardStops` refuses every write while a `training_paused`
   * injury is active, and its own message says why: *"A serious injury or
   * medical-stop constraint is active. **Do not treat this as a normal training
   * edit.**"* That is right about an athlete deciding to move their squat day.
   * It is exactly wrong about the write that makes the session safe, because
   * that write IS the app's response to the constraint that raised the stop.
   *
   * **MEASURED, `npm run test:injury-fallback-journey`.** Declaring a hamstring
   * injury at **8/10 — Sam's pause band** — left the athlete looking at
   * `Leg Press, RDLs, Bulgarian Split Squats, Single-Leg RDL`, every one of them
   * work the injury forbids, under the sentence *"could not be made safe. Skip
   * those and check with a physio."* The ladder had four legal, unaffected-area
   * answers ready; the gate refused all four. The same injury at 6/10 — where
   * no hard stop is raised — recomposed correctly. **So the stronger the injury,
   * the less the app did about it**, which inverts Sam's own bands: *"8-10/10 —
   * Pause affected training. Use rest, recovery, or clearly unaffected training
   * only."* Leaving the affected lifts on the day is not pausing them.
   *
   * The exemption is narrow and typed: `substitutedFrom.cause` is set ONLY by a
   * FACT displacing a row (`injury`, `kit_today`), never by an athlete's own
   * swap, so no ordinary edit can reach it. The gate is unchanged for everything
   * else — this scopes it to its own stated subject rather than weakening it. */
  const isInjuryFactWrite = input.substitutedFrom?.cause === 'injury';
  const blocked = isInjuryFactWrite
    ? null
    : blockedByHardStopRisk([{ date, workout: canonicalWorkout }], date);
  if (blocked) return blocked;
  if (!writeCoachOverride(date, canonicalWorkout, canonicalExerciseEditOverrideContext('swap')).ok) {
    return OVERRIDE_WRITE_REFUSED;
  }
  return { success: true };
}

/**
 * ⚠ **`removeExerciseAtDate` IS DELETED — 2026-08-19, Sam: *"Delete
 * `removeExerciseAtDate` and its coach-override implementation ... No second
 * removal authority survives."***
 *
 * It cloned the day, filtered the row out and wrote the result through
 * `writeCoachOverride`. Three defects followed and all three were structural:
 * the accepted-state transaction was bypassed, so nothing validated the week it
 * published; the removal left no canonical decision, so "this block" and "until
 * restored" had nothing to act on; and Undo deleted the athlete's answer while
 * the patched week stood, so the exercise never came back.
 *
 * THE ONE REMOVAL AUTHORITY IS NOW `utils/exerciseExclusionOwner
 * .applyExerciseExclusionDecision`, reached from `remove_exercise` in
 * `utils/programControlActions`. It writes ONE decision; the read projection
 * hides the row and the composer input keeps it out of unauthored blocks.
 *
 * **THE COACH'S `remove_exercise` COMMAND IS TEMPORARILY BROKEN** and Sam ruled
 * that acceptable in the same breath: *"If Coach still calls it, record Coach
 * Remove as temporarily broken; later it must call the same canonical Remove
 * action."* The dispatcher below returns a typed refusal that says so rather
 * than a silent no-op. NO COMPATIBILITY SHIM — a wrapper that forwarded to the
 * canonical owner would be a second door wearing the deleted one's name.
 */

/** Add one exercise to a single date. */
export function addExerciseAtDate(input: AddExerciseAtDateInput): ActionResult {
  const { date, exercise } = input;
  const current = resolveDateWorkout(date);
  if (!current) {
    return { success: false, reason: `No session on ${date} to add exercise to.` };
  }
  const name = exercise.name.trim();
  if (!name) {
    return { success: false, reason: 'No exercise name provided.' };
  }
  const displayName = formatExerciseDisplayName(name) || name;

  const occurredAt = new Date().toISOString();
  const canonicalWorkout = compileCanonicalExerciseEditOnWorkout(current, {
    kind: 'add',
    additionId: input.additionId,
    additionFactVersions: input.additionFactVersions,
    decisionId: `live-add:${date}:${occurredAt}`,
    occurredAt,
    dateISO: date.slice(0, 10),
    exercise,
  });
  const newWorkout = canonicalWorkout;
  if (workoutsAreEquivalent(current, newWorkout)) {
    return { success: false, reason: `Adding ${displayName} on ${date} produced no change.` };
  }
  assertLiveWorkoutWrite(date, newWorkout);
  if (!writeCoachOverride(date, canonicalWorkout, canonicalExerciseEditOverrideContext('add')).ok) {
    return OVERRIDE_WRITE_REFUSED;
  }
  return { success: true };
}

/** Weekly program rules are compiler inputs; their old output rewriter is retired. */
/**
 * Ban an exercise from ALL future programs.
 *
 * ── IT GOES THROUGH THE CANONICAL EXCLUSION OWNER NOW, AND IT MINTS NO
 *    SECOND STATUS ROW ────────────────────────────────────────────────────
 *
 * It used to do two writes: `addExclusion` (which generation reads) AND an
 * `avoid_exercise` preference constraint (which Status reads). Two stores
 * holding the same decision is two answers to "is this excluded", and Sam's
 * approved Block Two contract forbids exactly that: *"Build ONE canonical
 * exclusion owner ... Do not create separate screen, coach or store meanings."*
 *
 * Status now renders exclusions FROM the canonical list
 * (`activeProgramModifiers.athleteExclusionModifier`), so the mirrored
 * constraint is not a second explanation of one decision — it is a second row
 * for it, and clearing one would leave the other standing.
 *
 * The coach door asks no scope question, so it records the answer it has always
 * meant: `until_changed`. The athlete can narrow it from My Status.
 *
 * The input is alias-resolved to canonical before it travels, so "I never want
 * romanian deadlifts" stores "RDLs" — the name generation actually emits.
 */
export function banExerciseGlobally(input: BanExerciseGloballyInput): ActionResult {
  const { exercise } = input;
  if (!exercise || !exercise.trim()) {
    return { success: false, reason: 'No exercise name provided.' };
  }
  const result = applyExerciseExclusionDecision({
    exercise: resolveExerciseName(exercise.trim()),
    scope: 'until_changed',
  });
  return result.ok
    ? { success: true }
    : { success: false, reason: 'No exercise name provided.' };
}

/**
 * Set a preferred alternative: PIN the substitute. It does not ban the original.
 *
 * ── THE BAN IS GONE, BY SAM'S APPROVED CONTRACT ────────────────────────────
 *
 * *"An ordinary substitution changes the programmed row without banning the
 * original exercise. The substituted movement may rotate normally at the next
 * block boundary."* This function called `addExclusion(canonicalExercise)` — so
 * an athlete swapping a barbell bench for a dumbbell bench once, for one bad
 * shoulder day, permanently banned the barbell bench from every future program
 * they would ever be given. Nothing expired it and nothing told them.
 *
 * A substitution and an exclusion are DIFFERENT ATHLETE DECISIONS and the
 * contract separates them: an exclusion is answered with a scope
 * (`utils/exerciseExclusionOwner`), a substitution is a preference for the
 * alternative. Pinning the alternative already achieves the swap through the
 * rotation — that half always worked — and the preference constraint still
 * explains it on Status.
 *
 * Both inputs are alias-resolved to canonical so the stored pair matches what
 * generation emits, and the same-exercise guard compares the canonical pair —
 * "swap RDL for romanian deadlift" is refused because both resolve to "RDLs".
 */
export function setPreferredAlternative(
  input: SetPreferredAlternativeInput,
): ActionResult {
  const { exercise, alternative } = input;
  if (!exercise || !alternative) {
    return { success: false, reason: 'Both exercise and alternative are required.' };
  }
  const canonicalExercise = resolveExerciseName(exercise.trim());
  const canonicalAlternative = resolveExerciseName(alternative.trim());
  if (canonicalExercise.toLowerCase() === canonicalAlternative.toLowerCase()) {
    return { success: false, reason: 'Original and alternative resolve to the same exercise.' };
  }
  useAthletePreferencesStore.getState().addPinned(canonicalAlternative);
  upsertExercisePreferenceConstraint({
    preferenceKind: 'preferred_alternative',
    label: `Replace ${canonicalExercise} with ${canonicalAlternative} where appropriate.`,
    exercise: canonicalExercise,
    alternative: canonicalAlternative,
  });
  return { success: true };
}

/** Pin a useful exercise so future generation is biased toward including it. */
export function pinExerciseGlobally(input: PinExerciseGloballyInput): ActionResult {
  const { exercise } = input;
  if (!exercise || !exercise.trim()) {
    return { success: false, reason: 'No exercise name provided.' };
  }
  const canonical = resolveExerciseName(exercise.trim());
  useAthletePreferencesStore.getState().addPinned(canonical);
  upsertExercisePreferenceConstraint({
    preferenceKind: 'add_focus',
    label: `Prioritise ${canonical} in future generated sessions where appropriate.`,
    alternative: canonical,
    focus: canonical,
  });
  return { success: true };
}

// ─── Dispatcher ───
