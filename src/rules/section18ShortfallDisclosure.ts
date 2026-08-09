/**
 * THE SHORTFALL DISCLOSURE — one owner for what the athlete is told when their
 * week cannot meet its contract around a fact they stated.
 *
 * SAM'S RULING (2026-07-29), accept-and-reduce, decided by the north star:
 *
 *   A rest mark is the athlete stating a fact about their life. This app does
 *   not refuse facts — it records them and re-derives. Illness and readiness
 *   already work this way, and "dose down, never block" is standing law. The
 *   mark is accepted as an input; displaced required work relocates when it is
 *   Bible-legal to relocate it; and when the week genuinely cannot meet its
 *   contract around the fact, the app KEEPS THE MARK and discloses the
 *   shortfall in plain words.
 *
 *   Crashing was the worst answer. Refusing was the second worst. The athlete's
 *   calendar wins and the program adapts.
 *
 * THE SIGNED SENTENCE (Sam, 2026-07-29). Equality-bound in both directions by
 * `section18ShortfallCopyTests`, the same regime as the G-1 warning copy — the
 * string here and the string in the design record must agree, and neither may
 * drift without the other.
 *
 *   "Resting [day] means you'll miss [a/n] [type] session(s) this week"
 *
 * THE VOCABULARY RULING, bound as a RULE and not as one string: **the word
 * "exposure" never reaches an athlete.** It is the contract layer's noun for a
 * required dose, and it is meaningless to the person reading it. Athlete-facing
 * copy says "session" or "sessions". `ATHLETE_FORBIDDEN_VOCABULARY` below is the
 * enforceable form; the gate reads it rather than this comment.
 */

import type { Section18FindingDomain } from './section18EffectiveWeekEvaluator';

/**
 * Words that may never appear in athlete-facing copy. A rule, not a blocklist
 * for one sentence: anything rendered to the athlete is checked against this,
 * so the next person to write "exposure" into a string fails the gate rather
 * than shipping it.
 */
export const ATHLETE_FORBIDDEN_VOCABULARY: readonly string[] = [
  'exposure',
  'exposures',
];

/**
 * The athlete's word for each contract domain. `null` means the domain has no
 * athlete-facing rendering and must never be disclosed by name — `identity`,
 * `migration` and `anchor_credit` are bookkeeping about the contract itself,
 * not about anything the athlete would recognise as training.
 *
 * EXPORTED 2026-08-09 for the Journal's "this week's job" line, which needs the
 * same translation and must not grow a second one. A private copy in the Journal
 * would be a rival vocabulary for the words the athlete reads — and the two would
 * disagree the first time either was edited.
 */
export const ATHLETE_WORD_FOR_DOMAIN: Record<Section18FindingDomain, string | null> = {
  main_strength: 'strength',
  strength_patterns: 'strength',
  conditioning: 'conditioning',
  sprint_high_speed: 'sprint',
  power: 'power',
  hard_days: 'hard',
  full_rest: 'rest',
  equipment: null,
  identity: null,
  anchor_credit: null,
  migration: null,
};

export interface Section18Shortfall {
  /** The date whose fact caused the shortfall, ISO `YYYY-MM-DD`. */
  date: string;
  /** Athlete-facing training word, already translated out of contract nouns. */
  type: string;
  /** How many sessions short the week now is. Always >= 1. */
  count: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday'];

function dayNameFor(dateISO: string): string {
  return DAY_NAMES[new Date(`${dateISO}T12:00:00`).getDay()];
}

/** "a" before a consonant sound, "an" before a vowel — the copy asks for both. */
function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/**
 * Sam's signed sentence, rendered. One session reads "a strength session";
 * more than one reads "2 strength sessions" — the `[a/n]` in the signed string
 * is exactly that choice, and the plural moves with it.
 */
export function renderSection18Shortfall(shortfall: Section18Shortfall): string {
  const day = dayNameFor(shortfall.date);
  const quantity = shortfall.count === 1
    ? articleFor(shortfall.type)
    : String(shortfall.count);
  const noun = shortfall.count === 1 ? 'session' : 'sessions';
  return `Resting ${day} means you'll miss ${quantity} ${shortfall.type} ${noun} this week`;
}

/**
 * Turn the contract's blocking findings into what the athlete is told.
 *
 * Findings whose domain has no athlete word are DROPPED rather than rendered
 * with their internal name — a disclosure that says "anchor_credit" is the raw
 * code reaching the athlete, which the honest-outcome law already forbids.
 * Domains are merged so two strength findings read as one strength shortfall
 * instead of two sentences about the same gap.
 */
export function shortfallsFromFindings(args: {
  date: string;
  findings: readonly { domain: Section18FindingDomain; expected: unknown; actual: unknown }[];
}): Section18Shortfall[] {
  const byType = new Map<string, number>();
  for (const finding of args.findings) {
    const type = ATHLETE_WORD_FOR_DOMAIN[finding.domain];
    if (!type) continue;
    const expected = typeof finding.expected === 'number' ? finding.expected : null;
    const actual = typeof finding.actual === 'number' ? finding.actual : null;
    // Only a countable gap is a shortfall the athlete can act on. A structural
    // finding ("at least one meaningful pull main lift") has no number, and
    // inventing one would be the disclosure lying about size.
    const gap = expected !== null && actual !== null ? expected - actual : 1;
    if (gap <= 0) continue;
    byType.set(type, Math.max(byType.get(type) ?? 0, gap));
  }
  return [...byType.entries()]
    .map(([type, count]) => ({ date: args.date, type, count }))
    .sort((left, right) => left.type.localeCompare(right.type));
}

/** The whole disclosure for one accepted-with-shortfall transaction. */
export function renderSection18ShortfallDisclosure(
  shortfalls: readonly Section18Shortfall[],
): string | null {
  if (shortfalls.length === 0) return null;
  return shortfalls.map(renderSection18Shortfall).join('. ') + '.';
}
