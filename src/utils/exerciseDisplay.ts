import { conditioningDisplayTitleForName } from '../rules/conditioningDisplay';

const KNOWN_EXERCISE_TERMS: Record<string, string> = {
  amrap: 'AMRAP',
  atg: 'ATG',
  bb: 'BB',
  bbs: 'BBs',
  bw: 'BW',
  cod: 'COD',
  db: 'DB',
  dbs: 'DBs',
  emom: 'EMOM',
  hiit: 'HIIT',
  iso: 'ISO',
  kb: 'KB',
  kbs: 'KBs',
  mas: 'MAS',
  ohp: 'OHP',
  rdl: 'RDL',
  rdls: 'RDLs',
  rom: 'ROM',
  rpe: 'RPE',
  ssb: 'SSB',
  trx: 'TRX',
  vo2: 'VO2',
  skierg: 'SkiErg',
};

const LOWERCASE_UNIT_SUFFIXES = new Set([
  'kg',
  'km',
  'lb',
  'lbs',
  'm',
  'min',
  'mins',
  's',
  'sec',
  'secs',
]);

const EXERCISE_DISPLAY_ALIASES: Readonly<Record<string, string>> = {
  'single-leg squat (to box)': 'Single-Leg Box Squat',
  'single-arm db bench press': '1-Arm DB Bench Press',
  'single-arm db floor press': '1-Arm DB Floor Press',
  'half-kneeling single-arm overhead press': 'Half-Kneeling 1-Arm Press',
  'inverted row (bodyweight)': 'Inverted Row',
  'single-arm lat pulldown': '1-Arm Lat Pulldown',
  'banded tricep pushdown': 'Band Tricep Pushdown',
  'chin-up negative (slow)': 'Slow Chin-Up Negative',
  'bicep curl (barbell)': 'Barbell Bicep Curl',
  'bicep curl (dumbbell)': 'Dumbbell Bicep Curl',
  'copenhagen plank (half)': 'Half Copenhagen',
  'woodchop (half kneeling)': 'Half-Kneeling Woodchop',
  'banded external rotation': 'Band External Rotation',
  'swiss ball hamstring curl': 'Swiss Ball Ham Curl',
  'foam roll — hip flexor, quad, adductors': 'Foam Roll: Thighs',
  'foam roll — calves & outer shins': 'Foam Roll: Calves & Shins',
  'lacrosse ball glute release': 'Glute Ball Release',
  'open book thoracic rotation': 'Open Book Rotation',
  'chest / pec stretch (doorway)': 'Doorway Pec Stretch',
  'pissing dog against wall': 'Wall Hip Opener',
  'light walk or stationary bike': 'Light Walk / Bike',
  "child's pose with breathing": "Child's Pose + Breathing",
};

function formatExerciseToken(token: string): string {
  if (!/[A-Za-z]/.test(token)) return token;

  const lower = token.toLowerCase();
  const known = KNOWN_EXERCISE_TERMS[lower];
  if (known) return known;

  const measured = lower.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
  if (measured && LOWERCASE_UNIT_SUFFIXES.has(measured[2])) {
    return `${measured[1]}${measured[2]}`;
  }

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * User-facing exercise title formatter.
 *
 * This is display-only: do not feed the output back into exercise matching,
 * lookup keys, preference stores, cue lookup, or video lookup.
 */
export function formatExerciseDisplayName(name: string | null | undefined): string {
  const raw = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!raw) return '';

  const displayAlias = EXERCISE_DISPLAY_ALIASES[raw.toLowerCase()];
  if (displayAlias) return displayAlias;

  const conditioningTitle = conditioningDisplayTitleForName(raw);
  if (conditioningTitle !== raw) return conditioningTitle;

  return raw.replace(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g, formatExerciseToken);
}
