const KNOWN_EXERCISE_TERMS: Record<string, string> = {
  amrap: 'AMRAP',
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

  return raw.replace(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g, formatExerciseToken);
}
