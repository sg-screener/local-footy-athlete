/**
 * THE TEAM-NIGHT CONTENT ASK — R-226 (Sam, 2026-08-26, answering launch-audit
 * finding #10): *"give them the option of swapping to the safer team night
 * versions. But allow them to say no and keep the regular ones. If they choose
 * the regular ones then they should again be given a warning about it. Nothing
 * long just a clear warning about added risk."*
 *
 * The collision this settles: conservation (a moved session keeps its content)
 * vs the Bible's TT-day rule (`docs/LFA_PROGRAMMING_BIBLE.md:156`): *"On a TT
 * day, avoid high-soreness picks - RFE split squats, Nordics, back squats,
 * heavy RDLs - and avoid heavy low-back and groin loading."* Neither law wins
 * alone — the ATHLETE decides, at move time, through the same ask funnel the
 * G-1 landing and the team-night move already use (destination asks, typed
 * routes, one funnel; an unanswered route is a question, not a refusal).
 *
 * ⚠ THIS MODULE IS THE ONE VOCABULARY for "team-night-flagged pick" and its
 * safer counterpart. Measured 2026-08-26 before building: the composer reads
 * `isTeamDay` ONLY for the full-body shape decision — Bible :156 had no
 * enforcement anywhere. When generation gains the same filter, it consumes
 * THESE functions; a second list would be the drift this repo keeps paying for.
 *
 * THE FOUR FAMILIES ARE THE BIBLE'S OWN, named in its own line — this is a
 * transcription, not an invented list. The RDL entry is DOSE-qualified by the
 * Bible's very next line (*"Low-rep RDLs are fine"*, :157), and Sam re-stated
 * it 2026-08-26: *"the swap is dose, not exercise: 2–3 heavy-ish reps instead
 * of heavy sets of many."* Every replacement below is in the selectable
 * vocabulary and shares the flagged exercise's slot family — held by
 * test:team-night-content, which asks the vocabulary itself.
 *
 * Copy: SIGNED VERBATIM by Sam, 2026-08-26 (he rewrote the proposed set —
 * title, body, both routes, the keep warning and the done sentence are his
 * words). The dynamic slots are the flagged exercise names and the landing
 * weekday; nothing else may drift without a new signature.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { compileCanonicalExerciseEditOnWorkout } from './canonicalWeeklyExerciseEditCompiler';

export const TEAM_NIGHT_CONTENT_ROUTE_IDS = ['swap_safe', 'keep_regular'] as const;
export type TeamNightContentRouteId = (typeof TEAM_NIGHT_CONTENT_ROUTE_IDS)[number];

/** Bible :156's named exercise families, by canonical identity, with the
 *  safer same-family counterpart Sam confirmed on 2026-08-26. */
const EXERCISE_SWAPS: Readonly<Record<string, string>> = {
  [canonicalExerciseName('Back Squat')]: 'Box Squat',
  [canonicalExerciseName('Bulgarian Split Squats')]: 'Reverse Lunges',
  [canonicalExerciseName('Nordic Lower')]: 'Hamstring Curl',
};

/** RDLs are flagged by DOSE, not identity: reps above this are the "heavy
 *  sets of many" the Bible warns about; 2–3 reps is its own "fine" tier. */
const RDL_IDENTITY = canonicalExerciseName('RDLs');
const LOW_REP_MAX = 3;

function rowName(row: WorkoutExercise): string {
  return String(
    (row as { exercise?: { name?: string } }).exercise?.name
    ?? (row as { name?: string }).name ?? '',
  ).trim();
}

export interface TeamNightFlaggedRow {
  readonly name: string;
  /** 'swap' — replaced by a safer exercise; 'dose' — kept, trimmed to low reps. */
  readonly action: 'swap' | 'dose';
  readonly replacement: string | null;
}

/** The rows Bible :156 flags for a team night, in session order. */
export function teamNightFlaggedRows(
  workout: Workout | null | undefined,
): TeamNightFlaggedRow[] {
  const flagged: TeamNightFlaggedRow[] = [];
  for (const row of (workout?.exercises ?? []) as WorkoutExercise[]) {
    const name = rowName(row);
    if (!name) continue;
    const identity = canonicalExerciseName(name);
    const replacement = EXERCISE_SWAPS[identity];
    if (replacement) {
      flagged.push({ name, action: 'swap', replacement });
      continue;
    }
    if (identity === RDL_IDENTITY && (row.prescribedRepsMax ?? 0) > LOW_REP_MAX) {
      flagged.push({ name, action: 'dose', replacement: null });
    }
  }
  return flagged;
}

/**
 * The safer version of the session, pure. Swap rows change exercise and keep
 * their dose; the heavy-RDL row keeps its exercise and weight and drops to the
 * Bible's low-rep tier. Rows the Bible does not flag are byte-identical.
 */
export function applyTeamNightSafeSwaps(
  workout: Workout,
): { workout: Workout; changes: string[] } {
  const changes: string[] = [];
  const exercises = ((workout.exercises ?? []) as WorkoutExercise[]).map((row) => {
    const name = rowName(row);
    const identity = canonicalExerciseName(name);
    const replacement = EXERCISE_SWAPS[identity];
    if (replacement) {
      changes.push(`${name} → ${replacement}`);
      const swapped = compileCanonicalExerciseEditOnWorkout(workout, {
        kind: 'swap', decisionId: `team-night-safe:${workout.id}:${row.id ?? identity}`,
        occurredAt: workout.updatedAt ?? '', dateISO: '', targetName: name,
        targetComponentId: row.id ?? null,
        replacement: { name: replacement, sets: row.prescribedSets,
          repsMin: row.prescribedRepsMin, repsMax: row.prescribedRepsMax,
          weight: row.prescribedWeightKg, restSeconds: row.restSeconds,
          prescriptionType: row.prescriptionType, perSide: row.perSide,
        },
      }).exercises.find(candidate => candidate.id === row.id && candidate.exercise?.name === replacement);
      if (!swapped) throw new Error(`Team-night replacement could not resolve ${name}`);
      return {
        ...swapped,
        ...('name' in row ? { name: replacement } : {}),
      } as WorkoutExercise;
    }
    if (identity === RDL_IDENTITY && (row.prescribedRepsMax ?? 0) > LOW_REP_MAX) {
      changes.push(`${name} → low-rep (2–3)`);
      return { ...row, prescribedRepsMin: 2, prescribedRepsMax: LOW_REP_MAX };
    }
    return row;
  });
  if (changes.length === 0) return { workout, changes };
  return { workout: { ...workout, exercises } as Workout, changes };
}

/* ── THE ASK'S WORDS — functional copy, PROPOSED (not Sam-signed) ─────────── */

/** "Back Squat and Nordic Lower" / "A, B and C" — Sam's body reads as a
 *  sentence, so the list joins with "and" before the last name. */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export const TEAM_NIGHT_CONTENT_ASK = {
  title: 'Team training tonight',
  body: (flagged: readonly TeamNightFlaggedRow[]): string => {
    const names = joinNames(flagged.map((row) => row.name));
    return `This session includes ${names}, which may leave your legs heavy for team training. Want to swap them for lower-fatigue options?`;
  },
  routes: {
    swap_safe: {
      label: 'Use lower-fatigue options',
      sub: 'Keep the session, change the leg exercises.',
    },
    keep_regular: {
      label: 'Keep as is',
      sub: 'Move the session without changing anything.',
    },
  },
  /** Shown when the athlete keeps the regular exercises — through the
   *  existing confirm-warning step. */
  keepWarning: 'Doing heavy leg work before team training may affect how your legs feel and perform. Continue anyway?',
  /** The done sentence names the landing WEEKDAY, per Sam's signed example
   *  ("Done. Moved to Thursday with lower-fatigue leg options."). */
  swappedDone: (weekday: string): string =>
    `Done. Moved to ${weekday} with lower-fatigue leg options.`,
} as const;
