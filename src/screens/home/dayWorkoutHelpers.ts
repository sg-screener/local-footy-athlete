import { EXERCISE_TAGS } from '../../data/exerciseTags';
import { getExerciseCue } from '../../data/exerciseCues';
import { logger } from '../../utils/logger';

/**
 * Pure helpers extracted from DayWorkoutScreen so Classic and V2 render
 * layers can share them verbatim. No state, no side-effects (beyond a
 * __DEV__-only warn in buildCueText when the fallback cue is hit).
 */

/** Build a display string from exercise cues. Returns null if no cue available. */
export function buildCueText(exerciseName: string): string | null {
  const movement = EXERCISE_TAGS[exerciseName]?.movement ?? null;
  const cue = getExerciseCue(exerciseName, movement);

  // DEV-ONLY: warn when absolute fallback is used (no specific cue or family match)
  if (
    __DEV__ &&
    cue.primaryCue === 'Control the movement.' &&
    cue.secondaryCue === 'Stay tight through the full range.'
  ) {
    logger.debug(`[exerciseCues] Missing specific cue for: ${exerciseName}`);
  }

  if (!cue.primaryCue && !cue.secondaryCue) return null;
  if (cue.primaryCue && cue.secondaryCue) return `${cue.primaryCue} ${cue.secondaryCue}`;
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

  // 2. Strip orphan separators: |, •, –, —
  cleaned = cleaned.replace(/\s*[|•–—]\s*/g, ' ');

  // 3. Collapse repeated punctuation (e.g. ",," or ". .")
  cleaned = cleaned.replace(/([,;.:])\s*\1+/g, '$1');

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
 * "3 × 8" when min==max, "3 × 8–10" when range.
 */
export function formatStrengthSetsReps(exercise: any): string {
  const reps = exercise.prescribedRepsMin === exercise.prescribedRepsMax
    ? `${exercise.prescribedRepsMin}`
    : `${exercise.prescribedRepsMin}-${exercise.prescribedRepsMax}`;
  return `${exercise.prescribedSets} × ${reps}`;
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
