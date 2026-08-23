import { displayReps } from '../../rules/prescriptionDisplay';
import { EXERCISE_TAGS } from '../../data/exerciseTags';
import { getExerciseCue } from '../../data/exerciseCues';
import { canonicalExerciseName } from '../../utils/exerciseCanonicalisation';
import { logger } from '../../utils/logger';
import { cueFitsImplement } from '../../data/cueImplement';
import type { EquipmentTag } from '../../data/exercisePools';

/**
 * Pure helpers extracted from DayWorkoutScreen so Classic and V2 render
 * layers can share them verbatim. No state, no side-effects (beyond a
 * __DEV__-only warn in buildCueText when the fallback cue is hit).
 */

/**
 * Join two independent cue clauses so they read as two sentences rather than a
 * run-on. The primary and secondary cues are authored separately; the sentence
 * boundary between them belongs to the join, not the author — so a primary that
 * ends without terminal punctuation (or with a dangling comma/semicolon/colon)
 * is promoted to a full stop before the secondary begins.
 */
export function joinCueClauses(primary: string, secondary: string): string {
  const first = (primary ?? '').trim();
  const second = (secondary ?? '').trim();
  if (!first) return second;
  if (!second) return first;
  // Drop a dangling clause separator, then ensure a terminal stop.
  const trimmed = first.replace(/[\s,;:]+$/, '');
  const terminated = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return `${terminated} ${second}`;
}

/**
 * ── THE CUE MUST FIT THE IMPLEMENT IN THE ATHLETE'S HANDS ──────────────────
 *
 * Sam, 2026-08-18 (R-104). `RDLs` is authored for **barbell OR dumbbells** and
 * its cue is *"Push hips back, bar slides down leg."* An athlete who unticks the
 * barbell correctly KEEPS the RDL — it is legal on dumbbells — and was still
 * told to slide a bar down their leg.
 *
 * **THE ANSWER IS SUPPRESSION, NOT SUBSTITUTION.** There is no authored dumbbell
 * RDL cue, and `EXERCISE_CUES` is equality-gated to Sam's master sheet in both
 * directions, so one cannot be written here. His ruling covers exactly this:
 * *"flag missing authored technique guidance rather than invent coaching copy."*
 * So the row renders NO cue and `missingCueForImplement` says why — which is the
 * same loud failure the generic-fallback branch below already chose over filler.
 *
 * `selectedImplement` is optional so every existing caller keeps its behaviour
 * unchanged: an undefined implement is "not asked", and a cue is never
 * suppressed for a question nobody put.
 */
export function cueForImplement(
  exerciseName: string,
  selectedImplement?: EquipmentTag | null,
): { text: string | null; missingCueForImplement: boolean } {
  const name = canonicalExerciseName(exerciseName);
  if (selectedImplement && !cueFitsImplement(name, selectedImplement)) {
    return { text: null, missingCueForImplement: true };
  }
  return { text: buildCueText(exerciseName), missingCueForImplement: false };
}

/** Build a display string from exercise cues. Returns null if no cue available. */
export function buildCueText(exerciseName: string): string | null {
  // Canonicalise onto the curated vocabulary FIRST — the generator name may be
  // an off-vocabulary spelling ("Farmers Carry"). Reading the cue/tag off the
  // raw name is the bug this boundary retires (Part B / Stage 3).
  const name = canonicalExerciseName(exerciseName);
  const movement = EXERCISE_TAGS[name]?.movement ?? null;
  const cue = getExerciseCue(name, movement);

  // The curated layer owns every athlete-visible word. If a name does not land
  // on a real curated (or family) cue, render NOTHING rather than the generic
  // filler — the generic branch is unreachable in product (Part B / Stage 3
  // B5.5). This also absorbs the two non-pool `defaultProgram` fallbacks
  // (`Hamstring Curl`, `Mobility Flow`) and any off-vocabulary AI-backend name.
  const isGenericFallback =
    cue.primaryCue === 'Control the movement.' &&
    cue.secondaryCue === 'Stay tight through the full range.';
  if (isGenericFallback) {
    // `typeof` guard, not a bare `__DEV__`: buildCueText now also runs in the
    // program-build path (the cue contract), which some harnesses enter without
    // defining the RN `__DEV__` global.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      logger.debug(`[exerciseCues] No curated cue for: ${exerciseName} (canonical: ${name}) — rendering none`);
    }
    return null;
  }

  if (!cue.primaryCue && !cue.secondaryCue) return null;
  if (cue.primaryCue && cue.secondaryCue) return joinCueClauses(cue.primaryCue, cue.secondaryCue);
  return cue.primaryCue || cue.secondaryCue || null;
}

// Progression note patterns to strip from display
const PROGRESSION_PATTERNS: RegExp[] = [
  /\[maintain\]/gi,
  /\[build\]/gi,
  /\[hold\]/gi,
  /\[deload\]/gi,
  /\[progress\]/gi,
  /\[regress\]/gi,
  /Building back to base \d+-rep range(?:\s+for\s+\w+\s+work)?/gi,
  /Building volume(?:\s+on\s+\w+)?,?\s*add reps/gi,
  /Hit \d+ reps,?\s*(?:increase|bump) weight,?\s*reset to \d+-rep range/gi,
  /Continue with current weight and reps/gi,
];

/** Strip progression-system notes from exercise notes for display. */
export function cleanNotes(raw?: string | null): string | null {
  if (!raw) return null;
  let cleaned = raw;

  // 1. Strip progression patterns
  for (const pattern of PROGRESSION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  /* 2. Strip orphan separators: | and •
   *
   * ⚠ **A DASH IS NOT A SEPARATOR HERE, AND TREATING IT AS ONE WAS A DEFECT
   * ON GLASS.** This line used to read `[|•–—]`, which matches a dash with
   * ZERO whitespace on either side — so `90–100% MAS` reached the athlete as
   * `90 100% MAS`, and Sam rejected the card for it. Every em dash Sam wrote
   * into a cue went the same way.
   *
   * The rule was right for the world it was written in: notes were once six
   * authored FIELDS pasted together with ` – ` between them, so a dash really
   * was structure. `rules/conditioningDisplay` ended that — notes are now
   * labelled lines joined by newlines, and a dash is the author's punctuation
   * or a range. `|` and `•` never appear in authored copy, so they stay.
   *
   * A dash that has genuinely lost its words is still removed: step 3 collapses
   * a doubled one and step 4 strips it from either end. */
  cleaned = cleaned.replace(/\s*[|•]\s*/g, ' ');

  // 3. Collapse repeated punctuation (e.g. ",," or ". ." or "– –")
  cleaned = cleaned.replace(/([,;.:–—])\s*\1+/g, '$1');

  // 4. Remove leading/trailing punctuation and separators
  cleaned = cleaned.replace(/^[\s,;:.!?|•–—]+/, '').replace(/[\s,;:|•–—]+$/, '');

  // 5. Collapse multiple spaces into one
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // 6. Remove space before punctuation (e.g. "sets ." → "sets.")
  cleaned = cleaned.replace(/\s+([,;.!?:])/g, '$1');

  // 7. Final trim
  cleaned = cleaned.trim();

  // 8. If only punctuation or whitespace remains, hide entirely
  if (!cleaned || /^[\s,;:.!?|•–—]+$/.test(cleaned)) return null;

  return cleaned;
}

/** Descriptive session types — rendered as phase cards, not numbered exercises. */
export const DESCRIPTIVE_CONDITIONING_TYPES: ReadonlySet<string> = new Set([
  'Conditioning',
  'Flush-Out',
  'Sprint-Intervals',
  'Hill-Sprints',
  'MAS-Training',
  'Quality-Sprints',
  'MetCon',
  'Flog-Friday',
  'Long-Run',
  '6x1km',
  'Tempo-Run',
]);

/** Legacy conditioning tail heuristic — used when a combined day has no `conditioningBlock`. */
export const LEGACY_CONDITIONING_KEYWORDS =
  /finisher|zone\s*2|aerobic|tempo|interval|conditioning|repeat\s*effort|threshold|MAS|sprint/i;

export const LEGACY_FLAVOUR_TITLE: Record<string, string> = {
  aerobic: 'Aerobic Conditioning',
  tempo: 'Tempo Conditioning',
  'high-intensity': 'High-Intensity Conditioning',
};

/** Day name lookup — `workout.dayOfWeek` is 0-indexed Sunday. */
export const DAY_NAMES: ReadonlyArray<string> = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Format a rest-seconds number as "Xs" or "M:SS" for display. */
export function formatRest(seconds: number | null | undefined, suffix: 'rest' | 'recovery' = 'rest'): string | null {
  if (!seconds || seconds <= 0) return null;
  const str = seconds >= 60
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    : `${seconds}s`;
  return `${str} ${suffix}`;
}

/**
 * Infer a recovery prescription type from explicit field or fallback heuristics.
 *
 * Legacy AI-generated exercises may lack `prescriptionType`. If repsMin ≥ 20
 * and the name/notes suggest a time-based movement (roll, stretch, hold,
 * breathing, walk, bike), treat as duration. Otherwise default to reps.
 */
export function inferRecoveryPrescriptionType(
  exercise: any,
  exerciseName: string,
): 'reps' | 'duration' | 'duration_minutes' | 'distance' {
  if (exercise.prescriptionType) return exercise.prescriptionType;
  const nameAndNotes = `${exerciseName} ${exercise.notes || ''}`.toLowerCase();
  const minuteHints = /walk|bike|treadmill|cardio|skip/;
  if (minuteHints.test(nameAndNotes) && exercise.prescribedRepsMin <= 30) return 'duration_minutes';
  const durationHints = /roll|stretch|hold|breath|plank|pose/;
  if (exercise.prescribedRepsMin >= 20 && durationHints.test(nameAndNotes)) return 'duration';
  return 'reps';
}

/** Format a recovery prescription label based on its type. */
export function formatRecoveryPrescription(
  exercise: any,
  pType: 'reps' | 'duration' | 'duration_minutes' | 'distance',
): string {
  const minVal = exercise.prescribedRepsMin;
  const maxVal = exercise.prescribedRepsMax;
  const withPerSide = (s: string) => (exercise.perSide ? `${s} per side` : s);

  if (pType === 'duration_minutes') {
    const str = minVal === maxVal ? `${minVal} min` : `${minVal}-${maxVal} min`;
    return withPerSide(str);
  }
  if (pType === 'duration') {
    const formatTime = (s: number) =>
      s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
    const str = minVal === maxVal ? formatTime(minVal) : `${formatTime(minVal)}-${formatTime(maxVal)}`;
    return withPerSide(str);
  }
  if (pType === 'distance') {
    const str = minVal === maxVal ? `${minVal}m` : `${minVal}-${maxVal}m`;
    return withPerSide(str);
  }
  const repStr = minVal === maxVal ? `${minVal}` : `${minVal}-${maxVal}`;
  return exercise.perSide ? `${repStr} reps per side` : `${repStr} reps`;
}

/**
 * The ordinary exercise-card dose for standalone Mobility and Recovery rows.
 * These sessions share the strength card, but their units can be seconds or
 * minutes. The athlete sees one target — the high end of the authored mobility
 * or recovery range — rather than being asked to choose inside a range.
 */
export function formatLowLoadSetsReps(exercise: any): string {
  const exerciseName = String(exercise?.exercise?.name ?? exercise?.name ?? '');
  const pType = inferRecoveryPrescriptionType(exercise, exerciseName);
  const sets = Math.max(1, Number(exercise?.prescribedSets ?? 1));
  const target = Number(exercise?.prescribedRepsMax ?? exercise?.prescribedRepsMin ?? 0);
  const perSide = exercise?.perSide ? ' / side' : '';
  if (pType === 'duration_minutes') return `${sets} × ${target} min${perSide}`;
  if (pType === 'duration') return `${sets} × ${target}s${perSide}`;
  if (pType === 'distance') return `${sets} × ${target}m${perSide}`;
  return `${sets} × ${target}${perSide}`;
}

/**
 * Build display labels for a list of exercises, handling supersets:
 *   standalone → "1", "2"
 *   superset   → "1a", "1b"
 *
 * Returns an array of strings parallel to the input array.
 */
export function buildStrengthLabels(exercises: any[]): string[] {
  const groupMap = new Map<string, number>();
  let counter = 0;
  const labels: string[] = [];
  for (const ex of exercises) {
    if (ex.supersetGroup) {
      if (!groupMap.has(ex.supersetGroup)) {
        counter++;
        groupMap.set(ex.supersetGroup, counter);
      }
      const num = groupMap.get(ex.supersetGroup)!;
      const letter = String.fromCharCode(96 + (ex.supersetOrder ?? 1));
      labels.push(`${num}${letter}`);
    } else {
      counter++;
      labels.push(`${counter}`);
    }
  }
  return labels;
}

/** Group consecutive strength exercises by supersetGroup for paired wrappers. */
export type StrengthGroup = { groupId: string | null; indices: number[] };

export function groupStrengthExercises(exercises: any[]): StrengthGroup[] {
  const groups: StrengthGroup[] = [];
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const gid = ex.supersetGroup ?? null;
    if (gid && groups.length > 0 && groups[groups.length - 1].groupId === gid) {
      groups[groups.length - 1].indices.push(i);
    } else {
      groups.push({ groupId: gid, indices: [i] });
    }
  }
  return groups;
}

/**
 * Format a "sets × reps" prescription string for strength exercises.
 *
 * ONE APPROVED REP TARGET, NOT A RANGE — Sam's prescription-display law, Bible
 * `:770`: *"ranges remain the generation source, the athlete sees a single
 * approved rep target, logging assumes it."* His example: "3x8-12 is written
 * as 3x10". This rendered the RANGE, so the athlete picked a number themselves —
 * the exact ambiguity the law exists to end (census A3).
 *
 * The number comes from `rules/prescriptionDisplay`, not from arithmetic here,
 * because the law binds display and logging to the same middle.
 */
export function formatStrengthSetsReps(exercise: any): string {
  /**
   * ⚠ **A ROW WHOSE UNIT IS NOT REPS DOES NOT GO THROUGH THE REP SNAPPER.**
   *
   * `displayReps` collapses a range onto `APPROVED_REP_TARGETS` — the right
   * thing for a lift, because the athlete gets ONE number to hit instead of a
   * range to choose inside. It is nonsense for a timed hold: **`Deep Squat Hold`
   * is authored `30-45 SECONDS`, no rep target exists in that range, so the
   * snapper fell back to the nearest approved target and rendered `2 × 20`** —
   * a rep count, for a stretch, in seconds' clothing. Sam, 2026-08-23: *"deep
   * squat hold says 2x20 - but doesn't say 20 seconds? it's a timed thing not a
   * rep thing"*, and again for Couch and Pigeon Stretch.
   *
   * The unit-aware formatter already existed one function up, written for
   * exactly this case — its own words: *"These sessions share the strength card,
   * but their units can be seconds or minutes."* R-129's Primer is the first
   * session to put timed holds, a distance and heavy lifts on that card
   * together, so it is the first to need the card to ask per ROW rather than
   * per SESSION.
   *
   * Delegation, not duplication: seconds, minutes, metres and per-side all keep
   * their single owner, and nothing about this is Primer-specific — any session
   * carrying a timed row through the strength card is fixed by it.
   */
  const pType = (exercise as { prescriptionType?: string }).prescriptionType;
  if (pType && pType !== 'reps') return formatLowLoadSetsReps(exercise);
  // An EXACTLY AUTHORED dose is shown as authored. `displayReps` simplifies a
  // range; there is nothing to simplify where the author wrote one number, and
  // snapping it would overwrite the decision — see `WorkoutExercise.exactDose`.
  if ((exercise as { exactDose?: boolean }).exactDose) {
    return `${exercise.prescribedSets} × ${exercise.prescribedRepsMin}`;
  }
  const shown = displayReps(exercise.prescribedRepsMin, exercise.prescribedRepsMax);
  return `${exercise.prescribedSets} × ${shown ?? exercise.prescribedRepsMin}`;
}

/**
 * Format a conditioning-row prescription (time-based only). Returns empty
 * string for rep-based rows — their notes already describe work/rest/intensity,
 * and showing "1 reps" would be confusing filler.
 */
export function formatConditioningRowPrescription(exercise: any): string {
  const pType = (exercise as any).prescriptionType;
  const unit =
    pType === 'duration_minutes' ? 'min' : pType === 'duration' ? 'sec' : null;
  if (!unit) return '';
  if (exercise.prescribedSets > 1) {
    return `${exercise.prescribedSets} × ${exercise.prescribedRepsMin}-${exercise.prescribedRepsMax} ${unit}`;
  }
  const base =
    exercise.prescribedRepsMin !== exercise.prescribedRepsMax
      ? `${exercise.prescribedRepsMin}-${exercise.prescribedRepsMax}`
      : `${exercise.prescribedRepsMin}`;
  return `${base} ${unit}`;
}
