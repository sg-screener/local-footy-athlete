import {
  EXERCISE_TAGS,
  getExerciseTags,
  type InjuryKey,
  type MovementPattern,
} from '../data/exerciseTags';
import type { EquipmentTag } from '../data/exercisePools';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import type { OnboardingData, CapacityBand } from '../types/domain';
import {
  getReplacementChoicesForBucket,
  type SubstitutionHierarchyTier,
} from './injurySessionClassifier';
import type { InjuryBucket } from './programAdjustmentEngine';
import {
  getSubstituteCandidates,
  type SubstituteCandidate,
} from './exerciseSubstitutes';
import {
  equipmentTagsToSubstituteEquipmentClasses,
  resolveEquipmentAvailability,
} from './equipmentAvailability';
import {
  equipmentClassFor,
  resolveExerciseName,
  type EquipmentClass,
} from './loadEstimation';
import { deriveScheduleReadiness, type ReadinessSignal } from './readiness';
import { filterConstraintsForDate } from './readinessConstraints';
import {
  compareSafeTrainingFallbackTiers,
  type SafeTrainingFallbackTier,
} from '../rules/conflictResolutionHierarchy';
import { severityHasModerateEffect, severityIsLimiting } from '../rules/injurySeverityBands';
import { injuryPermitsExerciseAtSeverity } from '../rules/injuryExerciseRisk';

export type TapSwapReason =
  | 'no_equipment'
  | 'injury_or_pain'
  | 'too_hard'
  | 'too_easy'
  | 'preference'
  | 'other';

export type TapSwapHierarchyTier = SafeTrainingFallbackTier;

export interface TapSwapPrimaryInjury {
  bucket: InjuryBucket;
  severity: number;
  seriousSymptoms?: boolean;
}

export interface TapSwapEnvironment {
  /**
   * THE ONE INJURY FACT ON THIS ENVIRONMENT: what the athlete actually said,
   * per region, 1-10.
   *
   * **`activeInjuries: Record<InjuryKey, 'caution' | 'avoid'>` USED TO SIT
   * BESIDE IT AND IS DELETED.** It was a projection of this, and a stored
   * projection beside its own input is the defect class this app is built to
   * make unrepresentable. It was not theoretical: the moment both existed, a
   * healthy-athlete control that cleared `activeInjuries` and not the severities
   * read **32 pooled exercises as unsafe** — and the same `{...env,
   * activeInjuries: {...}}` shape is written at real call sites, where it would
   * have set a level the safety gate no longer reads and produced a green,
   * empty cell.
   *
   * Both injury questions derive from this field and nothing else:
   * *"may this be a replacement"* (`assessTapSwapCandidateSafety`, Sam's 6-7
   * band) and *"must this row come out"* (`injuryRequiresChange`, his 4-5 band).
   * `injuryLevelsFor` below projects it for the two older readers that still
   * speak the coarse vocabulary, at the point of use.
   */
  injurySeverities: Partial<Record<InjuryKey, number>>;
  primaryInjury: TapSwapPrimaryInjury | null;
  availableEquipment: EquipmentClass[];
  availableEquipmentTags: EquipmentTag[];
  capacity: CapacityBand;
  hasEquipmentConstraint: boolean;
  medicalStop: boolean;
}

export interface TapSwapChoice {
  kind: 'exercise' | 'recovery' | 'rest';
  name: string | null;
  hierarchyTier: TapSwapHierarchyTier;
  source:
    | 'injury_hierarchy'
    | 'pattern_substitute_engine'
    | 'tag_registry_pattern_fallback'
    | 'recovery_fallback'
    | 'rest_fallback';
  reason: string;
  prescription?: {
    sets: number;
    repsMin: number;
    repsMax: number;
    weight?: number;
    prescriptionType?: 'reps' | 'duration' | 'duration_minutes' | 'distance';
    restSeconds?: number;
  };
}

export interface TapSwapSafetyDecision {
  safe: boolean;
  reason: string;
}

const PATTERN_REGISTRY_FALLBACKS = new Set<MovementPattern>([
  'squat',
  'lunge',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
]);

const FATIGUE_RANK = { low: 0, moderate: 1, high: 2 } as const;
const LOAD_RANK = { low: 0, moderate: 1, high: 2 } as const;

function activeConstraint(constraint: ActiveConstraint): boolean {
  return constraint.status !== 'resolved';
}

/**
 * ── ONE FUNCTION WAS ANSWERING TWO QUESTIONS AT THE WRONG EDGE ──────────────
 *
 * `activeInjuries[region]` decides whether a `caution`-rated exercise may be
 * USED — `assessTapSwapCandidateSafety` refuses one when the level is `avoid`.
 * That is the question *"may this be a replacement"*, and Sam's Bible answers it
 * at the **6-7** band: *"6-7/10 — Remove risky work through the area; keep
 * unaffected work"* (`injurySeverityBands`, from `LFA_PROGRAMMING_BIBLE.md`
 * Section 8). The **4-5** band says the opposite: *"Reduce load, volume, range,
 * speed... Swap obvious aggravators. **Keep safe work in.**"*
 *
 * This read `severityHasModerateEffect` — the **4+** edge — so the moment an
 * athlete said 4/10 every `caution` row became illegal.
 *
 * **MEASURED ON `main` 9f081efa, through the real door
 * (`npm run probe:injury-recompose`):** a 4/10 shoulder turned an upper day of
 * `Bench Press, Barbell Row, DB Shoulder Press, Lat Pulldown, Band Pull-Apart`
 * into **`Goblet Squat, Easy Bike`** — because Sam's ruled injury matrix rates
 * every upper-body exercise `shoulder: 'caution'`, so nothing upper was legal
 * and the ladder had to leave the body region entirely. His own line for that
 * band is *"reduce pressing volume/load, **use shoulder-friendly variations**"*.
 *
 * And `npm run census:injury-fallback` showed the collapse directly: bands 4-5,
 * 6-7 and 8-10 produced **identical** numbers (520 unsafe occurrences each),
 * i.e. four authored bands were producing two behaviours.
 *
 * **THE OTHER QUESTION KEEPS THE 4+ EDGE AND HAS ITS OWN NAME NOW** —
 * `injuryRequiresChange` below, which is *"must this row come out"*. Sam swaps
 * obvious aggravators from 4/10, and that is where that edge was right all along.
 */
function injuryLevel(severity: number): 'caution' | 'avoid' {
  return severityIsLimiting(severity) ? 'avoid' : 'caution';
}

/**
 * The coarse two-value vocabulary, projected at the point of use for the one
 * remaining reader that speaks it (`exerciseSubstitutes.getSubstituteCandidates`).
 * DERIVED, never stored — see `TapSwapEnvironment.injurySeverities`.
 */
function injuryLevelsFor(
  environment: TapSwapEnvironment,
): Partial<Record<InjuryKey, 'caution' | 'avoid'>> {
  const levels: Partial<Record<InjuryKey, 'caution' | 'avoid'>> = {};
  for (const [region, severity] of Object.entries(environment.injurySeverities) as Array<
    [InjuryKey, number]
  >) {
    levels[region] = injuryLevel(severity);
  }
  return levels;
}

function lowerCapacity(
  left: CapacityBand,
  right: CapacityBand,
): CapacityBand {
  const rank: Record<CapacityBand, number> = { low: 0, medium: 1, high: 2 };
  return rank[left] <= rank[right] ? left : right;
}

/**
 * Build the live safety context for a tap swap from the same profile,
 * constraint and readiness sources used by the deterministic program.
 */
export function resolveTapSwapEnvironment(args: {
  date: string;
  profile?: OnboardingData | null;
  activeConstraints?: readonly ActiveConstraint[] | null;
  readinessSignal?: ReadinessSignal | null;
  primaryInjury?: TapSwapPrimaryInjury | null;
}): TapSwapEnvironment {
  const constraints = filterConstraintsForDate(
    [...(args.activeConstraints ?? [])].filter(activeConstraint),
    args.date,
  );
  const injurySeverities: Partial<Record<InjuryKey, number>> = {};
  let primaryInjury = args.primaryInjury ?? null;

  for (const constraint of constraints) {
    if (constraint.type !== 'injury' && constraint.type !== 'soreness') continue;
    const bucket = constraint.bucket as InjuryBucket | null;
    if (!bucket) continue;
    // THE WORST THE ATHLETE REPORTED FOR THIS REGION, so neither question is
    // answered from a milder constraint that happens to be listed later.
    if ((injurySeverities[bucket] ?? 0) < constraint.severity) {
      injurySeverities[bucket] = constraint.severity;
    }
    if (!primaryInjury || constraint.severity > primaryInjury.severity) {
      primaryInjury = {
        bucket,
        severity: constraint.severity,
        seriousSymptoms:
          constraint.type === 'injury' && constraint.seriousSymptoms === true,
      };
    }
  }

  if (args.primaryInjury
    && (injurySeverities[args.primaryInjury.bucket] ?? 0) < args.primaryInjury.severity) {
    injurySeverities[args.primaryInjury.bucket] = args.primaryInjury.severity;
  }

  const availableEquipmentTags = resolveEquipmentAvailability(
    args.profile,
    constraints,
    args.date,
  );
  let capacity = deriveScheduleReadiness({
    onboardingData: args.profile,
    signal: args.readinessSignal,
  });
  const fatigueConstraint = constraints.find((constraint) =>
    constraint.type === 'fatigue' && severityIsLimiting(constraint.severity));
  if (fatigueConstraint) capacity = lowerCapacity(capacity, 'low');

  return {
    injurySeverities,
    primaryInjury,
    availableEquipment: equipmentTagsToSubstituteEquipmentClasses(
      availableEquipmentTags,
    ),
    availableEquipmentTags: [...availableEquipmentTags],
    capacity,
    hasEquipmentConstraint: constraints.some((constraint) =>
      constraint.type === 'equipment'),
    medicalStop: constraints.some((constraint) =>
      constraint.type === 'injury' && constraint.seriousSymptoms === true),
  };
}

function equipmentForExercise(name: string): EquipmentClass | null {
  return equipmentClassFor(name);
}

function recoveryChoice(environment: TapSwapEnvironment): TapSwapChoice {
  if (environment.availableEquipmentTags.includes('bike_or_treadmill')) {
    return {
      kind: 'recovery',
      name: 'Easy Bike',
      hierarchyTier: 'recovery_easy_conditioning',
      source: 'recovery_fallback',
      reason: 'No useful safe training substitute remains, so use easy off-feet recovery.',
      prescription: {
        sets: 1,
        repsMin: 15,
        repsMax: 20,
        weight: 0,
        prescriptionType: 'duration_minutes',
        restSeconds: 0,
      },
    };
  }
  return {
    kind: 'recovery',
    name: 'Breathing Reset',
    hierarchyTier: 'recovery_easy_conditioning',
    source: 'recovery_fallback',
    reason: 'No useful safe training substitute remains, so use equipment-free recovery.',
    prescription: {
      sets: 1,
      repsMin: 5,
      repsMax: 5,
      weight: 0,
      prescriptionType: 'duration_minutes',
      restSeconds: 0,
    },
  };
}

function restChoice(reason: string): TapSwapChoice {
  return {
    kind: 'rest',
    name: null,
    hierarchyTier: 'rest',
    source: 'rest_fallback',
    reason,
  };
}

function isRecoveryName(name: string): boolean {
  return name === 'Easy Bike' || name === 'Breathing Reset';
}

/**
 * ── A REGRESSION IS AN ANSWER TO A CONSTRAINT, NOT TO A PREFERENCE ──────────
 *
 * Sam, 2026-08-19, on the swap menu offered for `Back Squat` to a full-gym
 * athlete with no injury: *"Bodyweight Squat is not a normal Back Squat
 * alternative for a moderate or experienced full-gym athlete. Breathing Reset
 * is not a Back Squat replacement. … Regression exercises only appear when an
 * Equipment or Injury constraint justifies them."*
 *
 * **THE LADDER WAS ALREADY RIGHT ABOUT SAFETY AND WRONG ABOUT USEFULNESS.**
 * Everything it offered was legal — that is what `assessTapSwapCandidateSafety`
 * guarantees — and legality is not the same question as *"would this athlete
 * ever choose it instead"*. `Breathing Reset` was appended unconditionally
 * whenever no recovery-tier option was already present, so every ordinary swap
 * ended with a breathing drill as its third option.
 */
function constraintJustifiesRegression(environment: TapSwapEnvironment): boolean {
  return environment.hasEquipmentConstraint
    || environment.medicalStop
    || environment.primaryInjury !== null
    || Object.keys(environment.injurySeverities).length > 0;
}

/**
 * Drop bodyweight stand-ins for a LOADED lift when nothing justifies them.
 *
 * The test is the ORIGINAL row, not the athlete's profile: swapping one
 * bodyweight row (`Band Pallof Press`) for another is an ordinary sideways move
 * and must keep working, while swapping a barbell lift for a bodyweight version
 * of itself is the regression Sam is describing.
 *
 * ⚠ **IT NEVER EMPTIES THE MENU.** If filtering would leave nothing, the
 * unfiltered list stands — at that point the bodyweight options are not padding,
 * they are the only legal answers, and saying so is better than an empty sheet.
 */
function withoutUnjustifiedRegressions(
  choices: readonly TapSwapChoice[],
  originalExercise: string,
  environment: TapSwapEnvironment,
): TapSwapChoice[] {
  const all = [...choices];
  if (constraintJustifiesRegression(environment)) return all;
  /* ⚠ **`equipmentClassFor` RETURNS THE STRING `'bodyweight'`, NOT `null`.**
   * The first cut tested truthiness and therefore filtered NOTHING — the probe
   * still offered `Bodyweight Squat`, which is the exact row Sam named. Only
   * `Breathing Reset` answers `null`. A loaded row is one with a class that is
   * not `'bodyweight'`. */
  const originalClass = equipmentForExercise(originalExercise);
  if (!originalClass || originalClass === 'bodyweight') return all;
  const kept = all.filter((choice) => {
    if (!choice.name) return false;
    if (choice.hierarchyTier === 'recovery_easy_conditioning') return false;
    if (isRecoveryName(choice.name)) return false;
    return equipmentForExercise(choice.name) !== 'bodyweight';
  });
  return kept.length > 0 ? kept : all;
}

/**
 * Final safety check used both while ranking suggestions and immediately
 * before the typed program-control action writes an override.
 */
export function assessTapSwapCandidateSafety(
  name: string,
  environment: TapSwapEnvironment,
): TapSwapSafetyDecision {
  if (environment.medicalStop) {
    return { safe: false, reason: 'A medical-stop constraint is active.' };
  }

  if (name === 'Easy Bike' &&
      !environment.availableEquipmentTags.includes('bike_or_treadmill')) {
    return { safe: false, reason: 'Bike/cardio equipment is not available.' };
  }

  const equipment = equipmentForExercise(name);
  if (equipment && !environment.availableEquipment.includes(equipment)) {
    return { safe: false, reason: `${equipment} equipment is not available.` };
  }
  if (!equipment && environment.hasEquipmentConstraint && !isRecoveryName(name)) {
    return { safe: false, reason: 'The replacement equipment cannot be verified.' };
  }

  const tags = getExerciseTags(resolveExerciseName(name));
  /* ⚠ **THE BAND RULE IS NOT RE-IMPLEMENTED HERE, IT IS ASKED FOR.**
   *
   * This used to decide legality from `activeInjuries`' two-value level while
   * `injurySessionClassifier` decided the same question from the severity — and
   * the coarser answer simply overruled the finer one, so Sam's own
   * *"Heavy knee-dominant work -> hip thrust"* could be selected by the ladder
   * and then refused here. `injuryPermitsExerciseAtSeverity` is the single
   * owner and reads all four of his bands. */
  const activeInjuryEntries = Object.entries(environment.injurySeverities) as Array<
    [InjuryKey, number]
  >;
  if (activeInjuryEntries.length > 0 && !tags && !isRecoveryName(name)) {
    return { safe: false, reason: 'The replacement cannot be verified against the active injury.' };
  }
  for (const [bucket, severity] of activeInjuryEntries) {
    if (isRecoveryName(name)) continue;
    if (!injuryPermitsExerciseAtSeverity(resolveExerciseName(name), bucket, severity)) {
      return { safe: false, reason: `The replacement still loads the active ${bucket} issue.` };
    }
  }

  if (environment.capacity === 'low' && tags?.fatigue === 'high') {
    return { safe: false, reason: 'Low readiness blocks a high-fatigue replacement.' };
  }
  return { safe: true, reason: 'Replacement passes injury, readiness and equipment checks.' };
}

/**
 * ── MUST THIS ROW COME OUT BECAUSE OF THE INJURY? ───────────────────────────
 *
 * The row-level question, asked of the SESSION rather than of a candidate: it is
 * `injuryPermitsExerciseAtSeverity` — the one band owner — over every region the
 * athlete has declared, and nothing else.
 *
 * **IT IS DELIBERATELY THE SAME PREDICATE AS THE LEGALITY ONE, AND THE FIRST CUT
 * SPLIT THEM AT DIFFERENT EDGES.** That version asked *"is this row rated
 * `caution` at 4/10 or worse"*, which is Sam's *"swap obvious aggravators"* read
 * as broadly as it can be read, and it produced two defects at once, both
 * measured through the real door (`npm run probe:injury-recompose`):
 *
 *   1. **A SENTENCE THAT CONTRADICTED THE SESSION.** Every upper row is rated
 *      `shoulder: 'caution'`, so the question stayed TRUE of the replacements —
 *      the door swapped `Bench Press` for `Incline Bench` and then told the
 *      athlete *"Incline Bench ... could not be made safe. Skip those."*
 *   2. **IT WAS NOT IDEMPOTENT.** `quiescentBoot` re-applies active injuries
 *      after every ledger replay, and a predicate that is still true of its own
 *      answer re-swaps the session on every launch. A week that churns is not
 *      "the visible session genuinely changed" — it is the injury quietly
 *      rewriting the athlete's program forever.
 *
 * **SO `avoid` IS "THE OBVIOUS AGGRAVATOR", AND THE MATRIX IS WHERE SAM SAID
 * WHICH.** At 1-5 an `avoid` rating comes out and `caution` work stays (*"keep
 * safe work in"*); at 6-7 and 8-10 `caution` comes out too. After one pass every
 * remaining row is permitted, so the second pass is a no-op — which is what makes
 * the honest claim honest.
 *
 * ⚠ **EQUIPMENT AND READINESS ARE NOT ASKED HERE.** A row the athlete's kit
 * cannot support is a different problem with a different owner (R-102/R-103's
 * equipment ladder); asking it here would make an injury flow report kit
 * failures as injury changes, and would put a kit-blocked row into the
 * *"could not be made safe, check with a physio"* sentence.
 */
export function injuryRequiresChange(
  name: string,
  environment: TapSwapEnvironment,
): boolean {
  if (environment.medicalStop) return true;
  for (const [region, severity] of Object.entries(environment.injurySeverities) as Array<
    [InjuryKey, number]
  >) {
    if (!injuryPermitsExerciseAtSeverity(resolveExerciseName(name), region, severity)) {
      return true;
    }
  }
  return false;
}

function environmentForReason(
  originalExercise: string,
  reason: TapSwapReason,
  environment: TapSwapEnvironment,
): TapSwapEnvironment {
  if (reason !== 'no_equipment') return environment;
  const originalEquipment = equipmentForExercise(originalExercise);
  if (!originalEquipment || originalEquipment === 'bodyweight') return environment;
  return {
    ...environment,
    availableEquipment: environment.availableEquipment.filter(
      (equipment) => equipment !== originalEquipment,
    ),
  };
}

function tierForPatternCandidate(
  originalExercise: string,
  candidate: SubstituteCandidate,
): SubstitutionHierarchyTier {
  const originalMovement = getExerciseTags(
    resolveExerciseName(originalExercise),
  )?.movement;
  return originalMovement && candidate.tags?.movement === originalMovement
    ? 'same_movement_pattern'
    : 'similar_muscle_group';
}

function patternChoices(
  originalExercise: string,
  reason: TapSwapReason,
  environment: TapSwapEnvironment,
  avoidNames: readonly string[],
): TapSwapChoice[] {
  /**
   * ⚠ **FATIGUE PERMISSION FOLLOWS THE ATHLETE'S STATE, NOT A QUESTION WE NO
   * LONGER ASK.**
   *
   * Sam, 2026-08-19: *"Swap means only: I want a different exercise."* With the
   * reason screen deleted, every ordinary swap arrives as `preference`, and
   * `allowHigherFatigue: reason === 'too_easy'` then hid every harder option
   * from the only reason left. MEASURED (`npm run probe:swap-choices`): `RDLs`
   * offered exactly ONE alternative under `preference` while `Deadlift` and
   * `Trap Bar Deadlift` — both barbell, both obvious — sat behind the
   * `too_easy` branch a healthy athlete could no longer reach.
   *
   * An unconstrained athlete may be offered a harder lift; a constrained one may
   * not, and that is the same predicate the regression filter uses, so the two
   * rules cannot drift apart.
   */
  const candidates = getSubstituteCandidates(originalExercise, {
    activeInjuries: injuryLevelsFor(environment),
    availableEquipment: environment.availableEquipment,
    allowHigherFatigue: reason === 'too_easy' || !constraintJustifiesRegression(environment),
  });
  const ordered = reason === 'too_easy'
    ? [...candidates].sort((left, right) =>
        right.loadRatio - left.loadRatio || left.name.localeCompare(right.name))
    : candidates;
  return ordered
    .filter((candidate) => !avoidNames.includes(candidate.name.toLowerCase()))
    .filter((candidate) => assessTapSwapCandidateSafety(candidate.name, environment).safe)
    .map((candidate) => ({
      kind: 'exercise' as const,
      name: candidate.name,
      hierarchyTier: tierForPatternCandidate(originalExercise, candidate),
      source: 'pattern_substitute_engine' as const,
      reason: candidate.reason ?? 'Safe movement-pattern substitute.',
    }));
}

function registryPatternChoices(
  originalExercise: string,
  reason: TapSwapReason,
  environment: TapSwapEnvironment,
  avoidNames: readonly string[],
): TapSwapChoice[] {
  const canonical = resolveExerciseName(originalExercise);
  const originalTags = getExerciseTags(canonical);
  if (!originalTags || !PATTERN_REGISTRY_FALLBACKS.has(originalTags.movement)) return [];

  return Object.entries(EXERCISE_TAGS)
    .filter(([name, tags]) =>
      name !== canonical &&
      tags.movement === originalTags.movement &&
      !avoidNames.includes(name.toLowerCase()) &&
      assessTapSwapCandidateSafety(name, environment).safe)
    .sort((left, right) => {
      const leftTags = left[1];
      const rightTags = right[1];
      if (reason === 'too_easy') {
        return (
          LOAD_RANK[rightTags.load] - LOAD_RANK[leftTags.load] ||
          FATIGUE_RANK[rightTags.fatigue] - FATIGUE_RANK[leftTags.fatigue] ||
          left[0].localeCompare(right[0])
        );
      }
      /**
       * ⚠ **CLOSEST, NOT EASIEST — AND EASIEST-FIRST WAS THE REAL BIAS.**
       *
       * Sam, 2026-08-19: *"Bodyweight Squat is not a normal Back Squat
       * alternative for a moderate or experienced full-gym athlete … Regression
       * exercises only appear when an Equipment or Injury constraint justifies
       * them."*
       *
       * This branch sorted by LOWEST fatigue then LOWEST load and took the top
       * two, so the default same-pattern menu was the two GENTLEST options in
       * the pattern. MEASURED (`npm run probe:swap-choices`): `RDLs` offered
       * `Glute Bridge` and `Single-Leg RDL` while `Deadlift` and
       * `Trap Bar Deadlift` — same pattern, same barbell, obviously closer —
       * were only reachable through the `too_easy` branch. Filtering the
       * bodyweight result out afterwards left ONE option; the ordering, not the
       * filter, was the defect.
       *
       * An unconstrained athlete gets the NEAREST load and fatigue to what they
       * are replacing. A constrained one keeps easiest-first, because for them
       * the gentler option is the useful one — the same predicate the
       * regression filter uses, so the two cannot drift apart.
       */
      if (!constraintJustifiesRegression(environment)) {
        const originalLoad = LOAD_RANK[originalTags.load];
        const originalFatigue = FATIGUE_RANK[originalTags.fatigue];
        return (
          Math.abs(LOAD_RANK[leftTags.load] - originalLoad)
            - Math.abs(LOAD_RANK[rightTags.load] - originalLoad) ||
          Math.abs(FATIGUE_RANK[leftTags.fatigue] - originalFatigue)
            - Math.abs(FATIGUE_RANK[rightTags.fatigue] - originalFatigue) ||
          left[0].localeCompare(right[0])
        );
      }
      return (
        FATIGUE_RANK[leftTags.fatigue] - FATIGUE_RANK[rightTags.fatigue] ||
        LOAD_RANK[leftTags.load] - LOAD_RANK[rightTags.load] ||
        left[0].localeCompare(right[0])
      );
    })
    .slice(0, 2)
    .map(([name]) => ({
      kind: 'exercise' as const,
      name,
      hierarchyTier: 'same_movement_pattern' as const,
      source: 'tag_registry_pattern_fallback' as const,
      reason: 'Safe same-pattern option from the exercise tag registry.',
    }));
}

function dedupeChoices(choices: readonly TapSwapChoice[]): TapSwapChoice[] {
  // ⚠ SORT FIRST, THEN DEDUPE. It used to dedupe then sort, which keeps the
  // entry that happened to arrive FIRST rather than the better-tiered one —
  // harmless while one source ran at a time, and wrong the moment two do: the
  // same exercise offered by both sources would keep whichever source ran
  // earlier and could land in "Similar" while it is genuinely a closest match.
  const seen = new Set<string>();
  return [...choices]
    .sort((left, right) =>
      compareSafeTrainingFallbackTiers(left.hierarchyTier, right.hierarchyTier))
    .filter((choice) => {
      const key = `${choice.kind}:${choice.name ?? ''}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Ordered tap swap ladder. It never forces a mutation: callers show the
 * first safe preference and still commit through ProgramControlAction.
 */
export function getTapSwapChoices(args: {
  originalExercise: string;
  reason: TapSwapReason;
  environment: TapSwapEnvironment;
  existingExerciseNames?: readonly string[];
  primaryInjury?: TapSwapPrimaryInjury | null;
  recoveryAllowed?: boolean;
}): TapSwapChoice[] {
  const primaryInjury = args.primaryInjury ?? args.environment.primaryInjury;
  // A caller may hand this function a primary injury the environment was not
  // resolved with — the day screen does exactly that — so it folds in here.
  const injurySeverities = { ...args.environment.injurySeverities };
  if (primaryInjury && (injurySeverities[primaryInjury.bucket] ?? 0) < primaryInjury.severity) {
    injurySeverities[primaryInjury.bucket] = primaryInjury.severity;
  }
  const environment = environmentForReason(
    args.originalExercise,
    args.reason,
    {
      ...args.environment,
      injurySeverities,
      primaryInjury: primaryInjury ?? null,
      medicalStop:
        args.environment.medicalStop || primaryInjury?.seriousSymptoms === true,
    },
  );
  if (environment.medicalStop) {
    return [restChoice('A medical-stop constraint leaves no normal tap-swap option.')];
  }
  if (args.reason === 'injury_or_pain' && !primaryInjury) {
    return args.recoveryAllowed === false
      ? [restChoice('The injury area is unclassified and no verified recovery option is available.')]
      : [recoveryChoice(environment)];
  }

  const avoidNames = Array.from(new Set([
    resolveExerciseName(args.originalExercise).toLowerCase(),
    ...(args.existingExerciseNames ?? []).map((name) =>
      resolveExerciseName(name).toLowerCase()),
  ]));
  let trainingChoices: TapSwapChoice[] = [];

  if (primaryInjury) {
    /* ⚠ **LEGALITY GOES IN, IT IS NOT APPLIED AFTERWARDS.**
     *
     * This used to take the ladder's answers and then filter them, which is
     * R-103's founding defect in miniature: the ladder ranked a handful of
     * options, the kit refused the top one, and the athlete got a refusal
     * instead of the next rung. Passing `assessTapSwapCandidateSafety` INTO the
     * ladder means it ranks the whole legal space — so a barbell-less athlete
     * with a sore shoulder reaches `Single-Arm DB Floor Press` rather than
     * running out of list. */
    trainingChoices = getReplacementChoicesForBucket(
      args.originalExercise,
      primaryInjury.bucket,
      primaryInjury.severity,
      args.existingExerciseNames ?? [],
      (name) => assessTapSwapCandidateSafety(name, environment).safe,
    )
      .map((choice) => ({
        kind: choice.hierarchyTier === 'recovery_easy_conditioning'
          ? 'recovery' as const
          : 'exercise' as const,
        name: choice.name,
        hierarchyTier: choice.hierarchyTier,
        source: 'injury_hierarchy' as const,
        reason: `Safe ${choice.hierarchyTier.replace(/_/g, ' ')} option from the injury hierarchy.`,
        ...(choice.hierarchyTier === 'recovery_easy_conditioning'
          ? { prescription: recoveryChoice(environment).prescription }
          : {}),
      }));
  } else {
    /* ── BOTH SOURCES, ALWAYS — SAM WANTS UP TO SIX, NOT THE FIRST ONE ─────
     *
     * Sam, 2026-08-19: *"Up to six legal choices: two Closest matches; two
     * Similar options; two Other useful options ... Show fewer when good legal
     * options do not exist."*
     *
     * The registry fallback used to run ONLY when the substitute engine came
     * back empty — a first-source-wins ladder, which is right when a caller
     * wants one answer and wrong when it wants a menu. MEASURED before the
     * change (`npm run probe:swap-choices`): every row in a real off-season
     * session offered exactly `2 + 1` — two from one tier and the recovery
     * fallback — and no row ever filled two training tiers at once.
     *
     * Merging is safe because both sources apply the same legality filter
     * (`assessTapSwapCandidateSafety`) and `dedupeChoices` keeps the
     * BETTER-TIERED entry: the list is sorted by tier and the first occurrence
     * of a name wins. So a name the registry also offers cannot demote itself.
     */
    trainingChoices = [
      ...patternChoices(args.originalExercise, args.reason, environment, avoidNames),
      ...registryPatternChoices(args.originalExercise, args.reason, environment, avoidNames),
    ];
  }

  const choices = withoutUnjustifiedRegressions(
    dedupeChoices(trainingChoices),
    args.originalExercise,
    environment,
  );
  if (choices.length > 0) {
    if (!choices.some((choice) => choice.hierarchyTier === 'recovery_easy_conditioning') &&
        args.recoveryAllowed !== false &&
        constraintJustifiesRegression(environment)) {
      choices.push(recoveryChoice(environment));
    }
    return dedupeChoices(choices);
  }
  if (args.recoveryAllowed !== false) return [recoveryChoice(environment)];
  return [restChoice('No safe useful training or recovery option remains.')];
}

/* ── SAM'S THREE GROUPS, AND THEY ARE THE LADDER'S OWN TIERS ────────────────
 *
 * Sam, 2026-08-19: *"Up to six legal choices: two Closest matches; two Similar
 * options; two Other useful options. Label the groups. Show fewer when good
 * legal options do not exist."*
 *
 * NO NEW VOCABULARY. `SAFE_TRAINING_FALLBACK_TIERS` already ranks exactly this
 * ladder and every choice already carries its tier, so the groups are a
 * PROJECTION of a signed ordering rather than a second opinion about
 * closeness. A separate similarity score would be a rival answer to a question
 * the fallback hierarchy already owns.
 *
 *   same_movement_pattern                        -> Closest matches
 *   similar_muscle_group                         -> Similar options
 *   unaffected_body_area | recovery_easy_conditioning -> Other useful options
 *
 * `rest` is DELIBERATELY not a group. Rest is not a swap — an athlete who wants
 * the work gone uses Remove, and offering "rest" inside a substitution menu is
 * the app answering a question it was not asked.
 */
export type TapSwapGroupId = 'closest' | 'similar' | 'other';

export const TAP_SWAP_GROUP_LABEL: Record<TapSwapGroupId, string> = {
  closest: 'Closest matches',
  similar: 'Similar options',
  other: 'Other useful options',
};

/** How many the athlete is offered per group. Sam's number, stated once. */
export const TAP_SWAP_CHOICES_PER_GROUP = 2;

export interface TapSwapChoiceGroup {
  id: TapSwapGroupId;
  label: string;
  choices: TapSwapChoice[];
}

function groupIdForTier(tier: TapSwapHierarchyTier): TapSwapGroupId | null {
  if (tier === 'same_movement_pattern') return 'closest';
  if (tier === 'similar_muscle_group') return 'similar';
  if (tier === 'unaffected_body_area' || tier === 'recovery_easy_conditioning') return 'other';
  return null;
}

/**
 * THE ATHLETE'S MENU — at most two per group, and **only groups that have
 * something in them**.
 *
 * *"Show fewer when good legal options do not exist"* is honoured by omission,
 * not by padding: a group with no legal member is absent, and a row with no
 * legal option at all returns `[]` so the caller can say so in words rather
 * than open an empty sheet. Measured on a real off-season session
 * (`npm run probe:swap-choices`): `Banded Dead Bug` genuinely has one option and
 * `Bulgarian Split Squats` has five across two training groups.
 */
export function groupTapSwapChoices(
  choices: readonly TapSwapChoice[],
): TapSwapChoiceGroup[] {
  const buckets: Record<TapSwapGroupId, TapSwapChoice[]> = {
    closest: [], similar: [], other: [],
  };
  for (const choice of choices) {
    if (!choice.name) continue;
    const id = groupIdForTier(choice.hierarchyTier);
    if (!id) continue;
    if (buckets[id].length >= TAP_SWAP_CHOICES_PER_GROUP) continue;
    buckets[id].push(choice);
  }
  return (['closest', 'similar', 'other'] as const)
    .filter((id) => buckets[id].length > 0)
    .map((id) => ({ id, label: TAP_SWAP_GROUP_LABEL[id], choices: buckets[id] }));
}
