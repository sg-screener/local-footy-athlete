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

/**
 * WHY the week is short, and it decides BOTH sentences and BOTH days.
 *
 * Sam, 2026-08-12, on the single unconditional sentence: *"yeah thats bad
 * wording"*. It read *"Resting {day} means you'll miss …"* whatever the cause,
 * so a week squeezed by the club's draw blamed the athlete for it.
 *
 * `fixture` — the club's game took the room. Sam's sentence, naming the GAME's
 * day. `athlete_rest` — the athlete marked the day themselves. The ORIGINAL
 * sentence survives untouched, naming the RESTED day, because "Resting Friday
 * means you'll miss a strength session this week" is honest when resting Friday
 * is what they chose. Sam ruled fixture-only on 2026-08-13 when asked whether
 * his new sentence should replace both.
 */
export type Section18ShortfallCause = 'fixture' | 'athlete_rest';

export interface Section18Shortfall {
  /**
   * THE DAY THE SENTENCE NAMES, and it BELONGS TO THE CAUSE — the game's day
   * for `fixture`, the rested day for `athlete_rest`.
   *
   * IT USED TO BE THE WEEK START AND THAT WAS A LIVE DEFECT. The one production
   * call site passed `weekStart`, so every Monday-start week told the athlete
   * "Resting Monday" whichever day they rested — and whether or not they rested
   * at all. Measured by rendering it, 2026-08-13. Sam caught the sentence for
   * its CAUSE; it was also naming the wrong DAY and asserting a rest that may
   * never have happened.
   */
  date: string;
  /** Athlete-facing training word, already translated out of contract nouns. */
  type: string;
  /** How many sessions short the week now is. Always >= 1. */
  count: number;
  /** Which sentence the athlete gets, and which day it names. */
  cause: Section18ShortfallCause;
  /**
   * How many DO fit — what Sam's sentence states, where `count` is what is
   * missed. Read from the finding's own `actual`, never by subtracting a target
   * inside the renderer.
   */
  fits: number;
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
 * FIXTURE SENTENCE ONLY: "a" / "two" / "3" — worded at one and two, the digit
 * above, which is how Sam wrote it ("only room for two strength sessions").
 *
 * THE REST SENTENCE KEEPS THE DIGIT. Its signed record has read "2 conditioning
 * sessions" since 2026-07-29 and Sam's ruling was explicit that the rest branch
 * is NOT the defect: *"Do not replace it; it was never the defect."* Re-wording
 * copy he signed, and did not ask to change, is not this unit's to do.
 */
function fixtureCount(n: number, type: string): string {
  if (n === 1) return articleFor(type);
  if (n === 2) return 'two';
  return String(n);
}

/**
 * Sam's TWO signed sentences, rendered — one per cause.
 *
 * FIXTURE: *"With a game Saturday, there's only room for two strength sessions
 * this week."* It states what FITS, so it reads `fits`, and it names the GAME's
 * day. ATHLETE REST: the ORIGINAL sentence, untouched, stating what is MISSED
 * and naming the RESTED day.
 *
 * ONE SENTENCE FOR TWO CAUSES WAS THE DEFECT. The old renderer said "Resting
 * {day}" unconditionally, which blamed the athlete for the club's draw — and,
 * because the day it was handed was the week start, usually named the wrong day
 * as well.
 */
export function renderSection18Shortfall(shortfall: Section18Shortfall): string {
  const day = dayNameFor(shortfall.date);
  const noun = shortfall.count === 1 ? 'session' : 'sessions';
  if (shortfall.cause === 'fixture') {
    const fitsNoun = shortfall.fits === 1 ? 'session' : 'sessions';
    return `With a game ${day}, there's only room for `
      + `${fixtureCount(shortfall.fits, shortfall.type)} ${shortfall.type} ${fitsNoun} this week`;
  }
  const quantity = shortfall.count === 1 ? articleFor(shortfall.type) : String(shortfall.count);
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
  /**
   * The day the GAME is on, when the week carries one. Its presence is what
   * makes a shortfall fixture-caused, so it is the cause input as well as the
   * day input — one fact, not two that could disagree.
   */
  gameDate?: string | null;
  /** The day the ATHLETE marked as rest, when they marked one. */
  restedDate?: string | null;
  findings: readonly { domain: Section18FindingDomain; expected: unknown; actual: unknown }[];
}): Section18Shortfall[] {
  // THE FIXTURE WINS WHEN BOTH ARE PRESENT, and that is Sam's own complaint
  // read straight: on a week that has a game, saying "resting {day}" blames him
  // for the draw. A week with neither fact produces no disclosure at all rather
  // than a sentence about a day nobody chose — see the caller.
  const cause: Section18ShortfallCause = args.gameDate ? 'fixture' : 'athlete_rest';
  const date = args.gameDate ?? args.restedDate ?? null;
  if (!date) return [];
  const byType = new Map<string, { gap: number; fits: number }>();
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
    // `fits` IS THE FINDING'S OWN `actual` — read, never derived by subtracting
    // a target in the renderer, which is what the order forbids.
    const fits = actual ?? 0;
    const seen = byType.get(type);
    if (!seen || gap > seen.gap) byType.set(type, { gap, fits });
  }
  return [...byType.entries()]
    .map(([type, { gap, fits }]) => ({ date, type, count: gap, cause, fits }))
    .sort((left, right) => left.type.localeCompare(right.type));
}

/** The whole disclosure for one accepted-with-shortfall transaction. */
export function renderSection18ShortfallDisclosure(
  shortfalls: readonly Section18Shortfall[],
): string | null {
  if (shortfalls.length === 0) return null;
  return shortfalls.map(renderSection18Shortfall).join('. ') + '.';
}
