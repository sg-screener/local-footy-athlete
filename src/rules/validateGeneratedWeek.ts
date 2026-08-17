/**
 * THE PURE GENERATED-WEEK VALIDATOR — judges, and does nothing else.
 *
 * ## Its whole contract with the rest of the app
 *
 * In:  a generated week, and the `GeneratedWeekContract` it answers to.
 * Out: `accepted`, `accepted_with_disclosed_gaps`, or `refused` with typed
 *      findings.
 *
 * **IT NEVER REPAIRS, RESTORES, SUBSTITUTES, REGENERATES OR CANONICALISES.**
 * That is not a style preference: the old acceptance path could answer a week
 * with a DIFFERENT week (regenerate/safeFallback arms, whole-week repair
 * search, offer placement, safety fallback rows), which is why a composer could
 * never tell whether its week was accepted or quietly replaced. A judge that
 * can rewrite the evidence is not a judge.
 *
 * **IT NEVER INSPECTS BUILDER IDENTITY.** It reads no `provenance`, no
 * `planEntryId`, no session name, no row position — only what the week's
 * content declares about itself. Two weeks with identical meaning and different
 * origins get the same verdict, and `test:generated-week-validator` proves it
 * by mutating provenance and asserting the verdict does not move.
 *
 * ## Where the counting rules come from
 *
 * The counts mirror `section18EffectiveWeekEvaluator`'s semantics wherever
 * those semantics are a coaching rule, and **deliberately depart from them
 * wherever the evaluator was reading residue.** Every departure is listed here
 * and each one is measured world-by-world in the slice report:
 *
 *  1. **No `strengthIntent` pattern fallback.** The evaluator credits patterns
 *     from `workout.strengthIntent` when a day has untyped rows. That shim
 *     exists because rows predating typed roles were never stamped. A generated
 *     week's rows always declare their own role (R-092), so a day with no
 *     declared main lift genuinely has no main lift.
 *  2. **No name inference.** Day stress is never read from `workout.name`.
 *  3. **No row-position inference.** A row's index never affects its identity.
 *  4. **`conditioningRole: 'none'` and an absent envelope are one statement.**
 *     They are already identical in the evaluator; here there is nothing to be
 *     identical about, because the envelope is not consulted for presence —
 *     the day's actual conditioning content is.
 */
import type { Workout, WorkoutExercise } from '../types/domain';
import type { MainStrengthPattern } from './strengthPatternContributions';
import type { GeneratedWeekClauseId, GeneratedWeekContract } from './generatedWeekContract';

export type GeneratedWeekVerdict =
  | 'accepted'
  | 'accepted_with_disclosed_gaps'
  | 'refused';

export interface GeneratedWeekFinding {
  readonly clause: GeneratedWeekClauseId;
  readonly severity: 'blocking' | 'disclosed_gap';
  readonly detail: string;
  readonly expected: number | string;
  readonly actual: number | string;
}

export interface GeneratedWeekAnchor {
  readonly dayOfWeek: number;
  /** Only `normal_unrestricted` earns sprint and hard-day credit. */
  readonly participation: string;
  readonly attended: boolean;
}

export interface ValidateGeneratedWeekInput {
  readonly workouts: readonly Workout[];
  readonly contract: GeneratedWeekContract;
  readonly anchors: readonly GeneratedWeekAnchor[];
  /**
   * Patterns the composer itself declared unreachable on this kit, with the
   * reason already typed. A required pattern named here is DISCLOSED, never
   * refused — R-083: a pattern the kit cannot train is not owed.
   */
  readonly declaredKitGaps?: readonly MainStrengthPattern[];
}

export interface GeneratedWeekValidation {
  readonly verdict: GeneratedWeekVerdict;
  readonly findings: readonly GeneratedWeekFinding[];
  readonly disclosedGaps: readonly GeneratedWeekFinding[];
  /** What the week was measured to contain. Reported, never re-derived by callers. */
  readonly ledger: GeneratedWeekLedger;
}

export interface GeneratedWeekLedger {
  readonly mainStrengthSessions: number;
  readonly mainLiftsByPattern: Readonly<Record<string, number>>;
  readonly sprintNights: number;
  readonly coreConditioningExposures: number;
  readonly fullRestDays: number;
  readonly hardDays: number;
  readonly prohibitedPatternBreaches: readonly string[];
  readonly prohibitedPowerBreaches: readonly string[];
  readonly appPrescribedSprintDays: readonly number[];
  readonly undeclaredStrengthRows: number;
}

function rows(workout: Workout): readonly WorkoutExercise[] {
  return workout.exercises ?? [];
}

/** A row states its own role. Nothing is inferred from its name or position. */
function declaredRole(row: WorkoutExercise): string | null {
  const evidence = (row as unknown as { section18Evidence?: { role?: string } }).section18Evidence;
  return evidence?.role ?? (row as unknown as { role?: string }).role ?? null;
}

function declaredMainPattern(row: WorkoutExercise): MainStrengthPattern | null {
  const evidence = (row as unknown as {
    section18Evidence?: { mainStrengthPattern?: MainStrengthPattern | null };
  }).section18Evidence;
  return evidence?.mainStrengthPattern ?? null;
}

function declaredStrengthPattern(row: WorkoutExercise): MainStrengthPattern | null {
  const evidence = (row as unknown as {
    section18Evidence?: { strengthPattern?: MainStrengthPattern | null };
  }).section18Evidence;
  return evidence?.strengthPattern ?? null;
}

/**
 * DOES THIS DAY CARRY APP-AUTHORED SPRINT / HIGH-SPEED WORK?
 *
 * ⚠ **`speedBlock` WAS THE ONLY ANSWER, AND IT MISSES THE SCHEDULER'S OWN
 * SPRINT.** WC-135/WC-124 place the app sprint as a STANDALONE CONDITIONING
 * DAY with `conditioningCategory: 'sprint'` — an authored sprint template, a
 * real conditioning block, no `speedBlock` anywhere on it. So the athlete with
 * no club night and no fixture, whose sprint the app had correctly authored and
 * stored, was counted as having ZERO sprint nights and their week was refused
 * `sprint_high_speed_required_minimum:0`.
 *
 * Every OTHER world hid it: a club night or a game supplies anchor sprint
 * credit, so the app's own session never had to be counted. **Only the
 * no-anchor athlete exposed it, which is exactly the athlete the conditioning
 * work was for.**
 *
 * This COUNTS WORK THAT GENUINELY EXISTS — it is not a relaxation of the
 * minimum. The category alone is not enough: a day is only credited when it
 * carries the conditioning to go with it, so a stray category on an empty day
 * cannot mint a sprint night.
 */
function isTrueSpeedDay(workout: Workout): boolean {
  const speed = (workout as unknown as { speedBlock?: { kind?: string } }).speedBlock;
  if (speed?.kind === 'true_speed') return true;
  const category = (workout as unknown as { conditioningCategory?: string }).conditioningCategory;
  return category === 'sprint' && carriesConditioning(workout);
}

/**
 * DOES THIS DAY CARRY CONDITIONING AT ALL?
 *
 * **PRESENCE, NOT THE STORED ROLE — and getting this wrong cost 42 worlds in
 * one measurement.** The stored `conditioningRole` is an INPUT, not the answer:
 * the authored owner (`deriveConditioningRoles`) assigns core and flush roles
 * positionally at judgement time, up to the capacity the contract leaves after
 * anchor credit. A day the planner stamped `optional_flush` is promoted to core
 * when core capacity remains — so reading the stamp literally under-counts a
 * week that genuinely covers its conditioning.
 *
 * An absent envelope and an explicit `'none'` are the same statement here, as
 * they are everywhere else.
 */
function carriesConditioning(workout: Workout): boolean {
  const evidence = (workout as unknown as {
    section18Evidence?: { conditioningRole?: string };
  }).section18Evidence;
  const role = evidence?.conditioningRole;
  if (role && role !== 'none' && role !== 'legacy_unknown') return true;
  const typed = workout as unknown as {
    conditioningBlock?: unknown; hasCombinedConditioning?: boolean;
  };
  return !!typed.conditioningBlock || typed.hasCombinedConditioning === true;
}

function conditioningStressOf(workout: Workout): string | null {
  const evidence = (workout as unknown as {
    section18Evidence?: { conditioningStress?: string };
  }).section18Evidence;
  return evidence?.conditioningStress ?? null;
}

function powerFamilies(workout: Workout): readonly string[] {
  return rows(workout)
    .filter((row) => (row as unknown as { role?: string }).role === 'power')
    .map((row) => (row as unknown as { power?: { family?: string } }).power?.family ?? '')
    .filter((family) => family.length > 0);
}

/**
 * A day on which NOTHING WAS REQUIRED of the athlete — the Bible's own words.
 * Optional work does not spend the rest quota.
 */
function requiresNothing(workout: Workout | undefined): boolean {
  if (!workout) return true;
  if (workout.workoutType === 'Rest') return true;
  if (workout.sessionTier === 'optional' || workout.sessionTier === 'recovery') return true;
  const hasContent = rows(workout).length > 0
    || !!(workout as unknown as { conditioningBlock?: unknown }).conditioningBlock
    || isTrueSpeedDay(workout);
  return !hasContent;
}

export function measureGeneratedWeek(
  input: ValidateGeneratedWeekInput,
): GeneratedWeekLedger {
  const { workouts, anchors } = input;
  const mainLiftsByPattern: Record<string, number> = {};
  const prohibited = new Set(input.contract.targets.prohibitedPatterns);
  const prohibitedPatternBreaches: string[] = [];
  const prohibitedPowerBreaches: string[] = [];
  const prohibitedFamilies = new Set(input.contract.targets.prohibitedPowerFamilies);
  const sprintDays = new Set<number>();
  const appPrescribedSprintDays: number[] = [];
  const hardDays = new Set<number>();
  let mainStrengthSessions = 0;
  let appConditioningDays = 0;
  let anchorCoreCredits = 0;
  let undeclaredStrengthRows = 0;

  for (const workout of workouts) {
    const day = workout.dayOfWeek;
    let dayHasMainLift = false;

    for (const row of rows(workout)) {
      const role = declaredRole(row);
      if (role === 'main_strength') {
        const pattern = declaredMainPattern(row);
        // A main lift with no declared pattern earns no credit. It is not
        // guessed at from the exercise name.
        if (pattern) {
          mainLiftsByPattern[pattern] = (mainLiftsByPattern[pattern] ?? 0) + 1;
          dayHasMainLift = true;
          if (prohibited.has(pattern)) prohibitedPatternBreaches.push(`${day}:${pattern}`);
        } else {
          undeclaredStrengthRows += 1;
        }
      } else if (role === 'strength_accessory') {
        const pattern = declaredStrengthPattern(row);
        if (pattern && prohibited.has(pattern)) {
          prohibitedPatternBreaches.push(`${day}:${pattern}`);
        }
      } else if (role === undefined || role === null || role === 'legacy_unknown') {
        // Only strength-shaped rows count as undeclared; a conditioning or
        // power row legitimately has no strength role.
        const looksStrength = !!declaredStrengthPattern(row);
        if (looksStrength) undeclaredStrengthRows += 1;
      }
    }
    if (dayHasMainLift) mainStrengthSessions += 1;

    for (const family of powerFamilies(workout)) {
      if (prohibitedFamilies.has(family)) prohibitedPowerBreaches.push(`${day}:${family}`);
    }

    if (isTrueSpeedDay(workout)) {
      sprintDays.add(day);
      appPrescribedSprintDays.push(day);
      hardDays.add(day);
    }

    if (carriesConditioning(workout)) {
      appConditioningDays += 1;
      if (conditioningStressOf(workout) === 'hard') hardDays.add(day);
    }

    if (dayHasMainLift && (workout.intensity === 'High' || workout.intensity === 'Maximal')) {
      hardDays.add(day);
    }
  }

  for (const anchor of anchors) {
    // Attendance is the identity half and claims conditioning; sprint and
    // hard-day credit are INTENSITY and stay behind full participation. Same
    // split as `anchorAttendanceClaimsConditioning`.
    if (anchor.attended) anchorCoreCredits += 1;
    if (anchor.participation === 'normal_unrestricted') {
      sprintDays.add(anchor.dayOfWeek);
      hardDays.add(anchor.dayOfWeek);
    }
  }
  // THE APP TOPS UP WHAT THE ANCHORS DID NOT ALREADY COVER — Bible §18 C,
  // "Add only the remaining requirement after genuine anchor credit." Days
  // carrying conditioning are counted toward core up to that remaining
  // capacity, which is what `deriveConditioningRoles` does positionally.
  const coreCapacity = Math.max(
    0,
    Math.max(
      input.contract.targets.coreConditioningRequiredMinimum,
      input.contract.targets.coreConditioningPlannerTarget
        ?? input.contract.targets.coreConditioningRequiredMinimum,
    ) - anchorCoreCredits,
  );
  const coreConditioningExposures =
    anchorCoreCredits + Math.min(appConditioningDays, coreCapacity);

  const byDay = new Map(workouts.map((workout) => [workout.dayOfWeek, workout]));
  let fullRestDays = 0;
  for (let day = 0; day <= 6; day += 1) {
    if (requiresNothing(byDay.get(day))) fullRestDays += 1;
  }

  return {
    mainStrengthSessions,
    mainLiftsByPattern,
    sprintNights: sprintDays.size,
    coreConditioningExposures,
    fullRestDays,
    hardDays: hardDays.size,
    prohibitedPatternBreaches,
    prohibitedPowerBreaches,
    appPrescribedSprintDays,
    undeclaredStrengthRows,
  };
}

/**
 * JUDGE. Pure: same inputs, same verdict, no side effects, nothing rewritten.
 */
export function validateGeneratedWeek(
  input: ValidateGeneratedWeekInput,
): GeneratedWeekValidation {
  const ledger = measureGeneratedWeek(input);
  const { targets } = input.contract;
  const findings: GeneratedWeekFinding[] = [];
  const disclosedGaps: GeneratedWeekFinding[] = [];
  const kitGaps = new Set(input.declaredKitGaps ?? input.contract.kitUnachievablePatterns);

  const block = (
    clause: GeneratedWeekClauseId,
    detail: string,
    expected: number | string,
    actual: number | string,
  ): void => {
    findings.push({ clause, severity: 'blocking', detail, expected, actual });
  };
  const disclose = (
    clause: GeneratedWeekClauseId,
    detail: string,
    expected: number | string,
    actual: number | string,
  ): void => {
    disclosedGaps.push({ clause, severity: 'disclosed_gap', detail, expected, actual });
  };

  // ── SAFETY FIRST. A paused week requires nothing, and nothing else is asked.
  if (targets.trainingPaused) {
    const stillRequired = input.workouts.filter((workout) => !requiresNothing(workout));
    if (stillRequired.length > 0) {
      block('training_paused_means_no_training',
        'training is paused but the week still requires work',
        0, stillRequired.length);
    }
    return {
      verdict: findings.length > 0 ? 'refused' : 'accepted',
      findings, disclosedGaps: [], ledger,
    };
  }

  if (ledger.prohibitedPatternBreaches.length > 0) {
    block('prohibited_patterns_absent', 'a prohibited pattern survived in the week',
      0, ledger.prohibitedPatternBreaches.join(', '));
  }
  if (ledger.prohibitedPowerBreaches.length > 0) {
    block('prohibited_power_absent', 'a prohibited power family survived in the week',
      0, ledger.prohibitedPowerBreaches.join(', '));
  }
  if (targets.prohibitedSprintHighSpeed && ledger.appPrescribedSprintDays.length > 0) {
    block('prohibited_sprint_absent',
      'sprint work is prohibited but app-prescribed sprint work survived',
      0, ledger.appPrescribedSprintDays.join(', '));
  }

  // ── EVERY STRENGTH ROW DECLARES ITSELF (R-092).
  if (ledger.undeclaredStrengthRows > 0) {
    block('row_role_is_declared',
      'a strength row reached validation without declaring its role and pattern',
      0, ledger.undeclaredStrengthRows);
  }

  // ── WEEK SHAPE.
  if (ledger.mainStrengthSessions < targets.mainStrengthRequiredMinimum) {
    block('main_strength_required_minimum', 'not enough main-strength sessions',
      targets.mainStrengthRequiredMinimum, ledger.mainStrengthSessions);
  } else if (
    targets.mainStrengthPlannerSelectedTarget !== null
    && ledger.mainStrengthSessions < targets.mainStrengthPlannerSelectedTarget
  ) {
    block('main_strength_planner_selected_target',
      "the planner's own selected main-strength target is not met",
      targets.mainStrengthPlannerSelectedTarget, ledger.mainStrengthSessions);
  }
  if (
    targets.mainStrengthPermittedMaximum !== null
    && ledger.mainStrengthSessions > targets.mainStrengthPermittedMaximum
  ) {
    block('main_strength_permitted_maximum', 'main-strength sessions exceed the ceiling',
      targets.mainStrengthPermittedMaximum, ledger.mainStrengthSessions);
  }
  if (ledger.coreConditioningExposures < targets.coreConditioningRequiredMinimum) {
    block('core_conditioning_required_minimum', 'not enough core conditioning exposures',
      targets.coreConditioningRequiredMinimum, ledger.coreConditioningExposures);
  }
  if (ledger.sprintNights < targets.sprintHighSpeedRequiredMinimum) {
    block('sprint_high_speed_required_minimum', 'not enough sprint / high-speed nights',
      targets.sprintHighSpeedRequiredMinimum, ledger.sprintNights);
  }
  if (ledger.fullRestDays < targets.fullRestRequiredMinimum) {
    block('full_rest_required_minimum', 'not enough days on which nothing is required',
      targets.fullRestRequiredMinimum, ledger.fullRestDays);
  }
  if (ledger.hardDays > targets.hardDayPermittedMaximum) {
    block('hard_day_permitted_maximum', 'too many hard days',
      targets.hardDayPermittedMaximum, ledger.hardDays);
  }

  // ── PATTERNS. A kit-unachievable requirement is disclosed, never refused.
  for (const pattern of targets.requiredSafePatterns) {
    const count = ledger.mainLiftsByPattern[pattern] ?? 0;
    if (count > 0) continue;
    if (kitGaps.has(pattern)) {
      disclose('required_safe_patterns_present',
        `this athlete's equipment cannot train ${pattern}`, 1, 0);
      continue;
    }
    // NAME THE PATTERN IN THE SIGNATURE, not only in the prose. A refusal
    // reading `required_safe_patterns_present:0` says a pattern is missing and
    // not WHICH — and the constrained matrix hit exactly that: an equipment-
    // constrained athlete refused for an ACHIEVABLE pattern while `pull` was
    // correctly disclosed, and the two were indistinguishable from the outside.
    block('required_safe_patterns_present',
      `the week trains no ${pattern}`, 1, pattern);
  }

  if (targets.balanceExpected) {
    const judged = targets.requiredSafePatterns.filter((pattern) => !kitGaps.has(pattern));
    const counts = judged.map((pattern) => ledger.mainLiftsByPattern[pattern] ?? 0);
    if (counts.length > 1) {
      const spread = Math.max(...counts) - Math.min(...counts);
      if (spread > targets.permittedCountDifference) {
        block('pattern_balance', 'main lifts are unbalanced across the required patterns',
          targets.permittedCountDifference, spread);
      }
    }
  }

  const verdict: GeneratedWeekVerdict = findings.length > 0
    ? 'refused'
    : disclosedGaps.length > 0 ? 'accepted_with_disclosed_gaps' : 'accepted';
  return { verdict, findings, disclosedGaps, ledger };
}

/** A stable one-line signature for reporting, like the old failure signatures. */
export function generatedWeekFailureSignature(
  validation: GeneratedWeekValidation,
): string {
  return validation.findings
    .map((finding) => `${finding.clause}:${finding.actual}`)
    .join('|');
}
