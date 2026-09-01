import type {
  SeasonPhase,
  WeekKind,
  WorkoutExercise,
} from '../types/domain';
import { CONDITIONING_META, EXERCISE_TAGS } from '../data/exerciseTags';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import { resolveExerciseName } from '../utils/loadEstimation';
import { resolveSeasonPhaseWeekKind } from './seasonPhaseClock';
import type { SessionAllocation } from '../utils/coachingEngine';

export type DeloadConditioningCategory =
  | 'aerobic_base'
  | 'tempo'
  | 'sprint'
  | 'vo2'
  | 'glycolytic'
  | 'cod_decel';

/**
 * THE DELOAD LAW — Sam's authored transformation (2026-07-27, Bible §14).
 *
 * "Same week, same days — the structure doesn't change, the work shrinks."
 *
 * This is the WHAT. It is deliberately separate from the WHEN, because three
 * doors deload — a scheduled deload week, two consecutive dated fatigue
 * reports (from the second report through Sunday), and an active
 * moderate-or-severe illness — and Sam's law says no door invents its own
 * reductions. A door decides IF; this decides WHAT, once.
 *
 * Two entries supersede shipped behaviour:
 *   conditioningWorkMultiplier — conditioning used to be untouched by a deload
 *     apart from a category downgrade. Halving the work is new law.
 *   keepPower — power used to be REMOVED outright on deload weeks. Sam keeps a
 *     small sharp dose: a deload is not a reason to lose sharpness.
 */
export const DELOAD_LAW = {
  /** Main lifts: "half the sets". */
  mainLiftSetMultiplier: 0.5,
  /** Never halve a lift out of existence. */
  minSetsPerExercise: 1,
  /** "Every set easy — RPE 5-6 ... nowhere near failure." */
  rpeMin: 5,
  rpeMax: 6,
  /** "Accessories: cut to 2-3, or half, whichever is less." */
  accessoryMaxKept: 3,
  accessoryKeepMultiplier: 0.5,
  /** "Conditioning: half the total work." */
  conditioningWorkMultiplier: 0.5,
  /**
   * A hard row demoted to a longer easy template needs a smaller row dose so
   * the complete week still falls roughly 30-50%, rather than preserving or
   * increasing duration through the template swap.
   */
  easyAerobicWorkMultiplier: 0.35,
  /** "One quality exposure max, the rest easy aerobic." */
  maxQualityConditioningExposures: 1,
  /** "Power/speed: keep a small sharp dose." Not removed. */
  keepPower: true,
  /** Few reps, full recovery — the dose stays sharp while it shrinks. */
  powerSetMultiplier: 0.5,
  minPowerSets: 1,
  /**
   * "Weight stays the same or drops slightly if you're beat up." The default is
   * HOLD. The drop is CONDITIONAL, so it is not an unconditional multiplier —
   * which is what the code did before this law.
   */
  beatUpLoadMultiplier: 0.9,
} as const;

/**
 * Which door opened this deload. The TRANSFORMATION is the same for all three —
 * "no door invents its own reductions" — but only the scheduled door is
 * phase-gated (see `resolveDoorDeloadPolicy`).
 */
export type DeloadDoor = 'scheduled' | 'readiness' | 'illness';

export interface DeloadWeekPolicy {
  weekKind: 'deload';
  /**
   * WHICH DOOR OPENED THIS — the typed cause, carried rather than re-inferred.
   *
   * Sam's §12 signing (2026-08-05) makes the day's SENTENCE depend on it: a
   * scheduled deload week says "Deload:", an athlete-chosen easy day says the
   * day-scoped sentence, and no consumer may read the words back to work out
   * which door it was. Device finding 6b was exactly this fact going missing —
   * the appliers knew only "deload", so an athlete's chosen easy day wore a
   * week-deload note on a standard week.
   */
  door: DeloadDoor;
  /**
   * In-season is reachable through the readiness and illness doors only; the
   * scheduled door never mints it (D16).
   */
  seasonPhase: SeasonPhase;
  intensityMultiplier: number;
  /**
   * True when the athlete is beat up, which is the ONLY case Sam's law drops
   * the weight. Absent/false means hold the weight.
   */
  athleteIsBeatUp?: boolean;
  /**
   * The G-1 choice is “Same session but easier”: the important movement-plane
   * rows stay and their dose shrinks. Split upper sessions trim low-value
   * accessories before scattering the session across many one-set rows.
   * Other session families retain their established identity-preserving path.
   */
  preserveExerciseSelection?: boolean;
}

export function resolveWeekKind(
  seasonPhase: SeasonPhase | null | undefined,
  phaseWeekNumber: number,
): WeekKind {
  return resolveSeasonPhaseWeekKind(seasonPhase, phaseWeekNumber);
}

export function resolveWeekIntensityMultiplier(
  seasonPhase: SeasonPhase | null | undefined,
  weekKind: WeekKind,
): number {
  if (weekKind !== 'deload') return 1.0;
  if (seasonPhase === 'Off-season') return 0.85;
  if (seasonPhase === 'Pre-season') return 0.9;
  return 1.0;
}

/**
 * The SCHEDULED door: a deload week the block plan laid down in advance.
 *
 * Phase-gated by D16 — "no scheduled in-season deloads; games and byes
 * self-regulate; backing off happens through readiness/bye recovery only." The
 * gate belongs to THIS door alone. Gating the readiness and illness doors the
 * same way would leave in-season with no way to deload at all, which is the
 * opposite of what D16 says.
 */
export function resolveDeloadWeekPolicy(
  seasonPhase: SeasonPhase | null | undefined,
  weekKind: WeekKind | null | undefined,
): DeloadWeekPolicy | null {
  if (weekKind !== 'deload') return null;
  if (seasonPhase !== 'Off-season' && seasonPhase !== 'Pre-season') return null;
  return {
    weekKind: 'deload',
    door: 'scheduled',
    seasonPhase,
    intensityMultiplier: resolveWeekIntensityMultiplier(seasonPhase, weekKind),
  };
}

/**
 * The READINESS and ILLNESS doors: an athlete-driven deload, in ANY phase.
 *
 * These are the doors D16 names as the in-season way to back off, so they carry
 * no phase gate. What they open is the SAME transformation the scheduled door
 * opens — `DELOAD_LAW`, untouched — because "no door invents its own
 * reductions." The only thing that varies by phase is the intensity multiplier,
 * and in-season it resolves to 1.0: the weight is HELD, which is Sam's default
 * ("Weight stays the same, or drops slightly if the athlete is beat up"). The
 * halved sets and RPE 5-6 are the whole change.
 */
export function resolveDoorDeloadPolicy(args: {
  door: Exclude<DeloadDoor, 'scheduled'>;
  seasonPhase: SeasonPhase | null | undefined;
  athleteIsBeatUp?: boolean;
  preserveExerciseSelection?: boolean;
}): DeloadWeekPolicy | null {
  const seasonPhase = args.seasonPhase ?? 'In-season';
  return {
    weekKind: 'deload',
    door: args.door,
    seasonPhase,
    intensityMultiplier: resolveWeekIntensityMultiplier(seasonPhase, 'deload'),
    athleteIsBeatUp: args.athleteIsBeatUp,
    preserveExerciseSelection: args.preserveExerciseSelection,
  };
}

export function isHardDeloadConditioningCategory(
  category: DeloadConditioningCategory | null | undefined,
): boolean {
  return category === 'sprint' || category === 'vo2' || category === 'glycolytic';
}

export function deloadConditioningCategory(
  category: DeloadConditioningCategory | null | undefined,
): DeloadConditioningCategory | null {
  if (category === 'vo2') return 'tempo';
  if (category === 'sprint' || category === 'glycolytic') return 'aerobic_base';
  return category ?? null;
}

export function deloadConditioningFlavour(
  category: DeloadConditioningCategory | null | undefined,
): 'aerobic' | 'tempo' | 'high-intensity' | undefined {
  const deloaded = deloadConditioningCategory(category);
  if (deloaded === 'aerobic_base') return 'aerobic';
  if (deloaded === 'tempo') return 'tempo';
  return undefined;
}

/**
 * Apply the shared deload law to the plan-level conditioning declaration.
 *
 * This used to live privately in the retained workout adapter, after the
 * canonical compiler had already returned. That made the adapter a second
 * author of readiness output and forced conditioning feasibility to run twice.
 * It is exported from the deload owner so the compiler can apply the decision
 * before feasibility and every materialiser can consume the same result.
 */
export function applyDeloadPolicyToSessionAllocation(
  entry: SessionAllocation,
  policy: DeloadWeekPolicy | null,
): SessionAllocation {
  if (!policy) return entry;
  const category = entry.conditioningCategory;
  const isHardConditioning =
    isHardDeloadConditioningCategory(category) ||
    entry.conditioningFlavour === 'high-intensity';
  if (!isHardConditioning) return entry;

  const next: SessionAllocation = { ...entry, isHardExposure: false };
  // Sprint quality survives with reduced volume. VO2/glycolytic work may be
  // downgraded, exactly as the existing deload law already specifies.
  if (category === 'sprint') {
    return {
      ...next,
      conditioningVariant: 'reduced',
      conditioningFeel: undefined,
    };
  }

  if (entry.hasCombinedConditioning) {
    const strengthFocus = entry.focus
      .replace(/\s+\+\s+.*(?:conditioning|finisher|interval|aerobic|tempo|sprint|zone\s*2).*$/i, '')
      .trim();
    return {
      ...next,
      focus: strengthFocus || entry.focus,
      hasCombinedConditioning: false,
      attachedConditioningKind: undefined,
      conditioningFlavour: undefined,
      conditioningCategory: undefined,
      conditioningVariant: undefined,
      conditioningFeel: undefined,
      conditioningOffFeet: undefined,
      ergModality: undefined,
    };
  }

  const safeCategory = deloadConditioningCategory(category) ?? 'aerobic_base';
  const safeFlavour = deloadConditioningFlavour(category) ?? 'aerobic';
  return {
    ...next,
    focus: safeCategory === 'tempo'
      ? 'Tempo conditioning (deload week, controlled 6-7/10)'
      : 'Easy aerobic conditioning (deload week)',
    conditioningCategory: safeCategory,
    conditioningFlavour: safeFlavour,
    conditioningVariant: safeCategory === 'aerobic_base' ? 'reduced' : 'standard',
    conditioningFeel: safeCategory === 'tempo' ? 'flowing' : undefined,
  };
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function planEntryHasConditioning(entry: SessionAllocation): boolean {
  return entry.hasCombinedConditioning === true ||
    entry.conditioningCategory !== undefined ||
    entry.conditioningFlavour !== undefined;
}

function planEntryHasQualityConditioning(entry: SessionAllocation): boolean {
  return entry.conditioningFlavour === 'high-intensity' ||
    entry.conditioningCategory === 'tempo' ||
    entry.conditioningCategory === 'sprint' ||
    entry.conditioningCategory === 'vo2' ||
    entry.conditioningCategory === 'glycolytic' ||
    entry.conditioningCategory === 'cod_decel';
}

/**
 * Apply the deload policy as one WEEK decision.
 *
 * The old caller mapped `applyDeloadPolicyToSessionAllocation` over the week.
 * The row applier then started its `qualityKept` counter at zero for every
 * session, so two or three sessions could each call themselves "the week's one
 * quality exposure". This owner elects one chronological plan entry after the
 * ordinary policy transform and tags every governed conditioning entry before
 * any template row can elect itself from its own prose. The row-level deload
 * transform remains the single owner of the actual half-work/easy treatment.
 */
export function applyDeloadPoliciesToWeeklySessionAllocations(
  entries: readonly SessionAllocation[],
  dosePolicyByDay: Readonly<Partial<Record<number, DeloadWeekPolicy>>>,
): SessionAllocation[] {
  const transformed = entries.map((entry) => {
    const day = entry.dayOfWeek ? WEEKDAY_INDEX[entry.dayOfWeek] : undefined;
    return {
      entry: applyDeloadPolicyToSessionAllocation(
        entry,
        day === undefined ? null : dosePolicyByDay[day] ?? null,
      ),
      day,
      governed: day !== undefined && dosePolicyByDay[day] !== undefined,
    };
  });
  const chronological = [1, 2, 3, 4, 5, 6, 0];
  const ownerIndex = chronological.flatMap((day) => transformed
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.day === day && candidate.governed &&
      planEntryHasQualityConditioning(candidate.entry)))
    .at(0)?.index ?? null;

  return transformed.map(({ entry, governed }, index) => {
    if (!governed || !planEntryHasConditioning(entry)) return entry;
    if (index === ownerIndex) {
      return { ...entry, deloadConditioningRole: 'weekly_quality_owner' };
    }
    return {
      ...entry,
      deloadConditioningRole: 'easy_aerobic',
    };
  });
}

export function isConditioningExerciseRow(exercise: WorkoutExercise): boolean {
  const name = exercise.exercise?.name ?? '';
  const tags = EXERCISE_TAGS[name];
  if (tags?.movement === 'conditioning') return true;
  // Registry consult, not regex widening (LR-9 forbids widening): the 55
  // authored template names answer from CONDITIONING_META — the same
  // registry-first shape as the EXERCISE_TAGS line above.
  if (CONDITIONING_META[name]) return true;
  // A REGISTERED NAME'S ANSWER IS FINAL. The regex below is a fallback for
  // names neither registry knows — asking it about a registered strength lift
  // let `\brow\b` classify "Barbell Row" and "Chest-Supported DB Row" as
  // conditioning (rowing machine), and the deload transform passed the
  // club-night MAIN LIFT through unhalved while halving the rows beside it
  // (measured 2026-08-27, readiness-deload Tuesday club night).
  if (tags) return false;
  return /\b(conditioning|sprint|tempo|aerobic|interval|run|bike|row|ski|swim|vo2|mas|cool-?down|warm-?up)\b/i
    .test(`${name} ${authoredNotesOnly(exercise.notes)}`);
}

export function isMainStrengthRow(exercise: WorkoutExercise): boolean {
  if (isConditioningExerciseRow(exercise)) return false;
  // ── A DECLARATION OUTRANKS AN INFERENCE ABOUT IT (R-092) ─────────────────
  //
  // **MEASURED 2026-08-14: without this, the deload trim DELETED the declared
  // main lift of every kit-limited athlete.** The name test below asks the pool
  // whether a lift is an ANCHOR, and on a dumbbell or bodyweight kit no anchor
  // is legal — the composer deliberately puts a pool ACCESSORY in the main-lift
  // role, which is the anchor→accessory rule. So `isMainStrengthRow` answered
  // false for the day's actual main lift, `isAccessoryStrengthRow` answered
  // true, and the trim removed it. Two Pre-season worlds lost their required
  // pattern and refused `required_safe_patterns_present`.
  //
  // Sam's R-092 is that those rows CARRY the role. A row that states its own
  // role is not a question for the pool table; the table is asked only about
  // rows that never declared anything (legacy and adapter-built rows), which is
  // exactly what it was written for.
  const declared = (exercise as unknown as {
    section18Evidence?: { role?: string };
  }).section18Evidence?.role;
  if (declared === 'main_strength') return true;
  if (declared === 'strength_accessory') return false;
  // The pool registry is keyed by CANONICAL names, and the generator writes
  // display names — "Romanian Deadlift" for the pool's "RDLs". Asking the
  // registry with the raw name returned null for those rows, so this test
  // called a session's anchor lift an accessory and the trim below deleted it.
  //
  // The §18 evidence classifier already resolves the alias before asking, so
  // the two readers of the same row disagreed. One key, asked the same way, is
  // the fix; adding the missing names to the pool would leave the next alias
  // to find the same hole.
  return classifyPoolSlot(resolveExerciseName(exercise.exercise?.name ?? ''))?.role === 'anchor';
}

export function isAccessoryStrengthRow(exercise: WorkoutExercise): boolean {
  if (isConditioningExerciseRow(exercise)) return false;
  return !isMainStrengthRow(exercise);
}

function roundLoad(weightKg: number): number {
  return Math.round(weightKg * 2) / 2;
}

/**
 * Append a signed sentence once, recognising ITS OWN output.
 *
 * The guard used to match `/Deload week:/i` while the sentence it appended
 * began "Deload: ", so it never recognised what it had written and a second
 * application appended a duplicate. Notes persist, so a re-derived day could
 * wear the sentence twice. Comparing against the exact sentence removes the
 * possibility: the guard cannot drift from the text again, because it IS the
 * text.
 */
function appendSignedNote(notes: string | undefined, note: string | null): string | undefined {
  if (!note) return notes;
  if (!notes) return note;
  if (notes.includes(note)) return notes;
  return `${notes} ${note}`;
}

/**
 * The day's strength sentence, SELECTED BY THE TYPED CAUSE.
 *
 * Sam's §12 signing (2026-08-05, docs/METCON_RESIGN_AND_SIGNOFFS_2026-08-05.md
 * §2, option b). Device finding 6b: an athlete who answered the G-1 landing ask
 * with "Deloaded" got week-deload words stamped onto a standard week. The DOSE
 * was theirs and correct; the WORDS described a week they were not in.
 *
 * So "Deload:" is reserved for the scheduled door — a week the block plan
 * really did lay down as a deload — and the athlete-chosen route gets the
 * day-scoped sentence Sam signed. Both are his words, verbatim; nothing here
 * composes athlete-facing copy.
 */
function strengthDeloadNote(policy: DeloadWeekPolicy): string {
  return policy.door === 'scheduled'
    ? DELOAD_SENTENCES.scheduledStrength
    : DELOAD_SENTENCES.chosenStrength;
}

/**
 * A NOTE IS OUTPUT, NEVER EVIDENCE.
 *
 * Every sentence the deload appliers write, named once so the classifiers can
 * refuse to read them back. Found by wiring Sam's §13 conditioning sentence:
 * it contains the word "hard" ("stop well short of hard"), and
 * `isQualityConditioningRow` matches intensity words across `name + notes`.
 * One pass wrote the sentence; the NEXT pass read it and promoted an easy
 * aerobic row to the week's one quality exposure — the app's own prose
 * reclassifying the athlete's session.
 *
 * Stripping is deliberately narrow: it removes exactly these sentences and
 * nothing else, so an intensity word the ATHLETE'S OWN authored note carries
 * still classifies exactly as it always did.
 */
const DELOAD_SENTENCES = {
  scheduledStrength: `Deload: keep RPE ${DELOAD_LAW.rpeMin}-${DELOAD_LAW.rpeMax}; `
    + 'every rep fast and clean, nowhere near failure.',
  chosenStrength: `Easy day: keep RPE ${DELOAD_LAW.rpeMin}-${DELOAD_LAW.rpeMax}; `
    + 'every rep fast and clean.',
  scheduledConditioningQuality:
    'Deload: this is the week\'s one quality exposure — keep it sharp but short.',
  scheduledConditioningEasy: 'Deload: easy aerobic only. Half the usual work.',
  chosenConditioning:
    'Easy day: smooth and controlled — comfortable pace, stop well short of hard.',
} as const;

/** The row's own words, with everything this module wrote removed. */
function authoredNotesOnly(notes: string | undefined): string {
  let text = notes ?? '';
  for (const sentence of Object.values(DELOAD_SENTENCES)) {
    if (text.includes(sentence)) text = text.split(sentence).join(' ');
  }
  return text;
}

/**
 * Apply the deload law to a session's STRENGTH rows.
 *
 * Main lifts halve their sets; accessories are cut to 2-3 or half, whichever is
 * less; weight is HELD unless the athlete is beat up. Conditioning rows pass
 * through untouched here — `applyConditioningDeloadToExercises` owns those,
 * because Sam's conditioning rule is about total WORK rather than sets.
 */
export function applyStrengthDeloadToExercises(
  exercises: WorkoutExercise[],
  policy: DeloadWeekPolicy,
): WorkoutExercise[] {
  const rawAccessoryIndexes = exercises
    .map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => !isConditioningExerciseRow(exercise)
      && isAccessoryStrengthRow(exercise))
    .map(({ index }) => index);
  const slotFor = (exercise: WorkoutExercise): string | null => (
    exercise as unknown as { section18Evidence?: { slot?: string | null } }
  ).section18Evidence?.slot ?? null;
  const importantUpperSlots = new Set([
    'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
  ]);
  const slots = exercises.map(slotFor);
  const isSplitUpper = (
    (slots.includes('horizontal_push') && slots.includes('vertical_push'))
    || (slots.includes('horizontal_pull') && slots.includes('vertical_pull'))
  );
  // Important movement planes lead the keep order. A low-value isolation row
  // never survives merely because it happened to be authored before the other
  // plane that gives an upper split session its structure.
  const accessoryIndexes = [...rawAccessoryIndexes].sort((left, right) => {
    const leftImportant = importantUpperSlots.has(slots[left] ?? '');
    const rightImportant = importantUpperSlots.has(slots[right] ?? '');
    if (leftImportant !== rightImportant) return leftImportant ? -1 : 1;
    const leftDose = Math.round(exercises[left].prescribedSets * DELOAD_LAW.mainLiftSetMultiplier);
    const rightDose = Math.round(exercises[right].prescribedSets * DELOAD_LAW.mainLiftSetMultiplier);
    if ((leftDose > 1) !== (rightDose > 1)) return leftDose > 1 ? -1 : 1;
    return left - right;
  });

  // "cut to 2-3, or half, whichever is LESS" — the cap and the half compete,
  // and the smaller number wins. With 8 accessories the cap (3) wins; with 4
  // the half (2) wins.
  const keepCount = Math.min(
    DELOAD_LAW.accessoryMaxKept,
    Math.floor(accessoryIndexes.length * DELOAD_LAW.accessoryKeepMultiplier),
  );
  const removeIndexes = policy.preserveExerciseSelection && isSplitUpper
    ? new Set(rawAccessoryIndexes.filter((index) => (
        !importantUpperSlots.has(slots[index] ?? '')
        && Math.round(exercises[index].prescribedSets * DELOAD_LAW.mainLiftSetMultiplier) <= 1
      )))
    : policy.preserveExerciseSelection
      ? new Set<number>()
      : new Set(accessoryIndexes.slice(keepCount));

  return exercises
    .filter((_, index) => !removeIndexes.has(index))
    .map((exercise, index) => {
      if (isConditioningExerciseRow(exercise)) {
        return { ...exercise, exerciseOrder: index + 1 };
      }

      const nextSets = Math.max(
        DELOAD_LAW.minSetsPerExercise,
        Math.round(exercise.prescribedSets * DELOAD_LAW.mainLiftSetMultiplier),
      );

      // Weight is HELD by default. Sam's law drops it only when the athlete is
      // beat up, and then only slightly — so this is a conditional, not the
      // unconditional phase multiplier the code used to apply.
      const nextWeight = policy.athleteIsBeatUp
        && exercise.prescribedWeightKg
        && exercise.prescribedWeightKg > 0
        ? roundLoad(exercise.prescribedWeightKg * DELOAD_LAW.beatUpLoadMultiplier)
        : exercise.prescribedWeightKg;

      return {
        ...exercise,
        exerciseOrder: index + 1,
        prescribedSets: nextSets,
        prescribedWeightKg: nextWeight,
        notes: appendSignedNote(exercise.notes, strengthDeloadNote(policy)),
      };
    });
}

/** A conditioning row that trains a hard quality rather than easy aerobic work. */
function isQualityConditioningRow(exercise: WorkoutExercise): boolean {
  const name = exercise.exercise?.name ?? '';
  return /\b(vo2|mas|sprint|interval|repeat|hard|tempo|shuttle|fartlek|emom|tabata)\b/i
    .test(`${name} ${authoredNotesOnly(exercise.notes)}`);
}

function reduceVisibleMinutes(line: string, multiplier: number): string {
  return line.replace(/^(Work|Total):\s*(\d+(?:\.\d+)?)\s+min\b/im,
    (_whole, label: string, raw: string) => {
      const minutes = Number(raw);
      if (!Number.isFinite(minutes) || minutes <= 1) return _whole;
      return `${label}: ${Math.max(1, Math.round(minutes * multiplier))} min`;
    });
}

/**
 * Reduce the numbers the athlete actually reads.
 *
 * Conditioning rows persist the reviewed prescription in `notes`; most do not
 * carry `prescribedDurationMinutes`. The former reducer therefore halved a
 * field that was absent on the real catalogue and left `Rounds: 8` or
 * `Work: 40 min continuous` unchanged. Counts are the preferred lever. A
 * one-round continuous session instead halves its visible work minutes.
 */
function deloadVisibleConditioningCopy(
  notes: string | undefined,
  fullSets: number,
  deloadSets: number,
  multiplier: number,
): string | undefined {
  if (!notes) return notes;
  if (deloadSets < fullSets) {
    return notes.replace(
      /^(Reps|Rounds|Sets|Blocks):\s*\d+(?:\.\d+)?\b/im,
      (_whole, label: string) => `${label}: ${deloadSets}`,
    );
  }
  return reduceVisibleMinutes(notes, multiplier);
}

/**
 * Apply the deload law to a session's CONDITIONING rows.
 *
 * NEW LAW (Sam, 2026-07-27): "Conditioning: half the total work. One quality
 * exposure max, the rest easy aerobic." Before this, a deload left conditioning
 * volume untouched and only downgraded the category.
 *
 * Rows are kept rather than deleted — the structure does not change, the work
 * shrinks — so a demoted quality row becomes easy aerobic work of half the
 * duration rather than disappearing from the athlete's week.
 */
export function applyConditioningDeloadToExercises(
  exercises: WorkoutExercise[],
  policy: DeloadWeekPolicy,
  role?: SessionAllocation['deloadConditioningRole'],
): WorkoutExercise[] {
  let qualityKept = 0;

  return exercises.map((exercise, index) => {
    if (!isConditioningExerciseRow(exercise)) {
      return { ...exercise, exerciseOrder: index + 1 };
    }

    const isQuality = isQualityConditioningRow(exercise);
    const keepAsQuality = role !== 'easy_aerobic' && isQuality
      && qualityKept < DELOAD_LAW.maxQualityConditioningExposures;
    if (keepAsQuality) qualityKept += 1;

    const durationCarrier = exercise as WorkoutExercise & {
      prescribedDurationMinutes?: number;
      deloadQualityExposure?: boolean;
    };
    // A quality row retains half its work. A row already demoted to the
    // week's easy-aerobic remainder is shorter again: changing a 13-minute
    // hard block into a 28-minute steady template and then halving that new
    // template does not deload the athlete at all. The weekly owner carries
    // this role, so the compensation is made here rather than guessed from a
    // template name.
    const workMultiplier = role === 'easy_aerobic' && policy.door !== 'scheduled'
      ? DELOAD_LAW.easyAerobicWorkMultiplier
      : DELOAD_LAW.conditioningWorkMultiplier;
    const minutes = durationCarrier.prescribedDurationMinutes;
    const halved = typeof minutes === 'number' && minutes > 0
      ? Math.round(minutes * workMultiplier)
      : minutes;

    const nextSets = Math.max(
      1,
      Math.round(exercise.prescribedSets * workMultiplier),
    );
    const visibleCopy = deloadVisibleConditioningCopy(
      exercise.notes,
      exercise.prescribedSets,
      nextSets,
      workMultiplier,
    );
    const nextNotes = appendSignedNote(
      visibleCopy,
      conditioningDeloadNote(policy, keepAsQuality),
    );

    return {
      ...exercise,
      exerciseOrder: index + 1,
      prescribedSets: nextSets,
      ...(typeof halved === 'number' ? { prescribedDurationMinutes: halved } : {}),
      deloadQualityExposure: keepAsQuality,
      notes: nextNotes,
      ...(exercise.exercise ? {
        exercise: { ...exercise.exercise, description: nextNotes ?? exercise.exercise.description },
      } : {}),
    } as WorkoutExercise;
  });
}

/**
 * The day's conditioning sentence, SELECTED BY THE SAME TYPED CAUSE.
 *
 * Sam signed the athlete-chosen wording on 2026-08-05
 * (docs/EASY_DAY_CONDITIONING_COPY_2026-08-05.md), closing §13 — which this
 * unit parked precisely because the chosen route had no authored conditioning
 * words and composing some here would have been inventing athlete-facing copy.
 *
 * ONE sentence covers both chosen-route cases. The scheduled week distinguishes
 * its single quality exposure from the easy rest; Sam signed one sentence for
 * the chosen route, so wording a second for the quality row would be copy
 * nobody authored. "Deload:" stays reserved for the scheduled door.
 *
 * `test:deload-law` binds both sentences to their signed records, both
 * directions — the code must say what Sam signed, and must emit nothing else.
 */
function conditioningDeloadNote(
  policy: DeloadWeekPolicy,
  keptAsQuality: boolean,
): string | null {
  if (policy.door !== 'scheduled') return DELOAD_SENTENCES.chosenConditioning;
  return keptAsQuality
    ? DELOAD_SENTENCES.scheduledConditioningQuality
    : DELOAD_SENTENCES.scheduledConditioningEasy;
}

/** A power dose under the deload law: kept, but smaller and still sharp. */
export interface PowerDose {
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
}

/**
 * Shrink a power dose for a deload week.
 *
 * Sam's law: "Power/speed: keep a small sharp dose — few reps, full recovery,
 * stop the moment speed drops." Power used to be REMOVED entirely on deload
 * weeks; returning null here would reinstate exactly that.
 */
export function deloadPowerDose(full: PowerDose): PowerDose | null {
  if (!DELOAD_LAW.keepPower) return null;
  return {
    sets: Math.max(
      DELOAD_LAW.minPowerSets,
      Math.round(full.sets * DELOAD_LAW.powerSetMultiplier),
    ),
    // Reps are already low on power work and the point is SHARPNESS, so the
    // rep range is preserved rather than cut — it is the volume that drops.
    repsMin: full.repsMin,
    repsMax: full.repsMax,
  };
}
