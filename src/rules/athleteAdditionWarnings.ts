import type { Workout } from '../types/domain';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { classifyExerciseRole } from '../utils/sessionRoles';
import { registerSignedCopy, signedCopy } from './signedCopy';

registerSignedCopy([
  { id: 'athlete.add.near_game', source: 'sam_ruling', provenance: 'R-387: Sam authorised athlete Add with these two warnings and permission to continue.',
    text: 'Your game is within two days. Extra work could leave you tired for it. You can still add this.' },
  { id: 'athlete.add.repeat_heavy', source: 'sam_ruling', provenance: 'R-387: Sam authorised athlete Add with these two warnings and permission to continue.',
    text: 'This heavy lift is already in your week. Repeating it adds more fatigue. You can still add this.' },
  { id: 'athlete.add.anyway', source: 'sam_ruling', provenance: 'R-387: Sam authorised athlete Add with these two warnings and permission to continue.', text: 'Add anyway' },
]);
export type AthleteAdditionWarning = 'near_game' | 'repeat_heavy';
export function athleteAdditionWarningText(warning: AthleteAdditionWarning): string {
  return signedCopy(`athlete.add.${warning}`);
}
export const ATHLETE_ADD_ANYWAY = signedCopy('athlete.add.anyway');

/** R-387: advice never becomes an admission check. Explicit dates, no device clock. */
export function athleteAdditionWarnings(args: {
  dateISO: string;
  exerciseName: string;
  gameDates: readonly string[];
  week: readonly { date: string; workout?: Workout | null }[];
}): AthleteAdditionWarning[] {
  const warnings: AthleteAdditionWarning[] = [];
  const date = new Date(`${args.dateISO.slice(0, 10)}T12:00:00Z`);
  if (args.gameDates.some(game => {
    const days = (new Date(`${game.slice(0, 10)}T12:00:00Z`).getTime() - date.getTime()) / 86400000;
    return days >= 0 && days <= 2;
  })) warnings.push('near_game');
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6);
  const name = canonicalExerciseName(args.exerciseName);
  if (classifyExerciseRole(name) === 'main_lift' && args.week.some(day =>
    day.date >= monday.toISOString().slice(0, 10) && day.date <= sunday.toISOString().slice(0, 10)
    && day.workout?.exercises.some(row => canonicalExerciseName(row.exercise.name) === name))) {
    warnings.push('repeat_heavy');
  }
  return warnings;
}
