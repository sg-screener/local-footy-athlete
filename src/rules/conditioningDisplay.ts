/**
 * ── THE ONE ATHLETE-FACING CONDITIONING PROJECTION ─────────────────────────
 *
 * **Sam, 2026-08-20:** *"Clean the entire athlete-facing Conditioning
 * projection, not only this one line … Fix the shared structured
 * formatter/projection rather than patching this card with one literal
 * string."*
 *
 * ## WHAT SHIPPED BEFORE THIS FILE
 *
 * `composeConditioningRows` pasted six authored FIELDS together and called it
 * coaching copy. Measured, `Classic 4×4`:
 *
 * ```
 * Work: 4 min hard
 * Rest: 3 min easy jog
 * Sets: 4 reps
 * Intensity: 90–100% MAS; HR 90–95% max late
 * Hard means honest pace, not a sprint you can't hold for 4 minutes — round 4 …
 * All 5 modalities — 4 min is inside the 8 min erg cap; Air Bike is time-native.
 * ```
 *
 * Four defects in six lines: `Rest`/`Sets` are the wrong words for interval
 * work (`Sets: 4 reps` for something the athlete does in ROUNDS); the intensity
 * field carries two different measurements welded with a semicolon; the cue
 * starts lower-case mid-thought; and **the last line is authoring metadata** —
 * an erg cap, a modality count and the word "time-native" are notes to whoever
 * maintains the sheet, not instructions to a footballer.
 *
 * ## WHAT THIS FILE IS
 *
 * A STRUCTURED projection: authored fields in, labelled athlete-visible lines
 * out. Every consumer renders `conditioningDisplayLines`, so a wording fix lands
 * everywhere at once and no surface can grow its own dialect.
 *
 * ⚠ **IT INVENTS NO PRESCRIPTION.** Every number here is the sheet's own. The
 * pace line is pure arithmetic over the athlete's measured MAS; the labels are
 * vocabulary, not dose; the sentence repairs are capitalisation and full stops.
 * Nothing changes what the athlete is asked to do.
 */

import type { ConditioningQuality, ConditioningTemplate } from '../data/conditioningTemplates';

export interface ConditioningDisplayLine {
  /** `Work`, `Recovery`, `Rounds`, `Intensity`, `Heart rate`, `Your pace`. */
  readonly label: string | null;
  readonly text: string;
}

export interface ConditioningDisplayInput {
  readonly template: ConditioningTemplate;
  /**
   * The athlete's measured Maximal Aerobic Speed, km/h, from
   * `data/twoKmTimeTrial.deriveMas`. Absent when they have not recorded a time
   * trial — the pace line is then OMITTED rather than guessed.
   */
  readonly masKmh?: number | null;
}

/**
 * ⚠ **AUTHORING VOCABULARY THAT MUST NEVER REACH AN ATHLETE.**
 *
 * Each of these is a real word from the sheet's maintenance notes. They are the
 * census's blocklist as well as this file's, so a new authored line carrying one
 * fails a cell rather than shipping.
 */
export const CONDITIONING_INTERNAL_TERMS: readonly string[] = [
  'modality', 'modalities', 'time-native', 'erg cap', 'cap', 'fallback',
  'template', 'framework', 'in band', 'flagged', 'authored',
];

/** `60 / kmh`, to the nearest second, as `m:ss`. */
export function paceMinPerKm(speedKmh: number): string {
  const minutesPerKm = 60 / speedKmh;
  const totalSeconds = Math.round(minutesPerKm * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const EN_DASH = '–';

/** The `lo–hi` of a `NN–NN%` range, or null. */
function percentRange(text: string): { lo: number; hi: number } | null {
  const match = new RegExp(`(\\d+)\\s*[${EN_DASH}\\-]\\s*(\\d+)\\s*%`).exec(text);
  if (!match) return null;
  return { lo: Number(match[1]), hi: Number(match[2]) };
}

/**
 * A sentence an athlete reads: capitalised, punctuated, and free of the
 * sheet's internal attributions.
 *
 * ⚠ It repairs FORM, never meaning. `(Sam)` is an authoring signature and comes
 * out; the words around it are untouched.
 */
/**
 * ── AN AUTHORING NOTE IS NOT COACHING ─────────────────────────────────────
 *
 * The sheet keeps its provenance in the SAME fields the athlete reads:
 * `2 min (Sam's 1:2 ruling)`, `30–50 min continuous (duration menu: … — Sam's
 * D12 convention preserved)`, `… (Cue held identical to the 20 m session per
 * Sam.)`. Those are notes to whoever maintains the sheet, and they were on
 * glass.
 *
 * ⚠ **THE TEST IS THE MARKER, NOT THE BRACKET.** A blanket "strip parentheses"
 * would delete `(1 km)`, `(remainder of the minute)` and `(20+20)` — real
 * prescription. Only a parenthetical CONTAINING an authoring marker comes out,
 * so the dose survives and the provenance stays in the file for the next
 * author.
 */
const AUTHORING_MARKER = /\b(?:Sam|ruling|convention|preserved|census|framework|D\d+|duration menu)\b/i;

export function stripAuthoringNotes(raw: string): string {
  return athleteVocabulary(raw)
    .replace(/\s*\([^()]*\)/g, (match) => (AUTHORING_MARKER.test(match) ? '' : match))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ── JARGON THE SHEET USES AND A FOOTBALLER DOES NOT ───────────────────────
 *
 * `COD` is the change-of-direction shuttle; `ergos` is a typo for ergs. Both are
 * in Sam's authored sheet, and both stay there — `conditioningTemplateEquality`
 * proves the module still ships his spreadsheet byte for byte, and that guard is
 * worth more than the four characters it would cost to "fix" the data. The
 * SHEET is the record of what Sam wrote; the PROJECTION decides what the athlete
 * reads. This map is the second of those, and it changes no meaning.
 */
const ATHLETE_VOCABULARY: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bCOD\b/g, 'change-of-direction'],
  [/\bergos\b/gi, 'ergs'],
];

/**
 * ── A COMMA SPLICE BECOMES TWO SENTENCES ──────────────────────────────────
 *
 * `Hold the pace, don't let it drift into 'easy' by minute 15.` joins two
 * imperatives with a comma and no conjunction. The repair is a full stop and a
 * capital — punctuation only, no word added, removed or reordered.
 *
 * ⚠ It fires ONLY before an unambiguous independent-clause opener, and never
 * when the leading clause is subordinate (`If set 3 falls apart, that's the end
 * point.` is correct and must survive untouched).
 */
const SUBORDINATED = /(?:^|[.;—]\s*)(?:if|when|unless|because|though|although|while|as|after|before|since|once|until|whenever|where)\b[^.;—]*$/i;

function repairCommaSplices(text: string): string {
  return text.replace(
    /,\s+(don't|do not|it's|that's|this is|you're|we're|keep|hold)\b/gi,
    (match, opener: string, offset: number) => {
      if (SUBORDINATED.test(text.slice(0, offset))) return match;
      return `. ${opener.charAt(0).toUpperCase()}${opener.slice(1)}`;
    },
  );
}

/** The sheet's words, in the athlete's vocabulary. Meaning is untouched. */
export function athleteVocabulary(raw: string): string {
  let text = String(raw ?? '');
  for (const [pattern, replacement] of ATHLETE_VOCABULARY) text = text.replace(pattern, replacement);
  return text;
}

export function athleteSentence(raw: string): string {
  let text = athleteVocabulary(stripAuthoringNotes(raw));
  if (!text) return '';
  text = repairCommaSplices(text);
  text = text.replace(/\s+/g, ' ').trim();
  // "round 4 should match round 1" — a round is named, so it is capitalised.
  text = text.replace(/\bround (\d+)\b/g, 'Round $1');
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += '.';
  return text;
}

/**
 * THE HEART-RATE CLAUSE, AS A SENTENCE.
 *
 * The sheet writes `HR 90–95% max late` — three abbreviations and no verb. The
 * athlete is told what to do with it. The RANGE is the sheet's; only the words
 * around it are this function's.
 */
function heartRateSentence(clause: string): string | null {
  const range = percentRange(clause);
  if (!range) return null;
  const band = `${range.lo}${EN_DASH}${range.hi}%`;
  if (/\blate\b/.test(clause)) {
    return `Build toward ${band} of maximum in the later rounds.`;
  }
  return `Keep your heart rate around ${band} of maximum.`;
}

function isHeartRateClause(clause: string): boolean {
  return /\bHR\b|HRmax/i.test(clause);
}

/**
 * ROUNDS, NOT SETS — and a bare number where the sheet wrote `4 reps`.
 *
 * Sam: *"correct labels such as Work, Recovery and Rounds — not 'Sets: 4 reps'
 * for intervals."* A template with a rest period is interval work, and what the
 * athlete counts is rounds. Where the sheet states a compound dose
 * (`3 × 8 min, or 4 × 6 min`) it is rendered verbatim: that IS the prescription
 * and reducing it to a number would lose half of it.
 */
/**
 * ── THE QUALITY NAMES THE UNIT, BECAUSE THE SHEET DOES NOT ────────────────
 *
 * Sam: *"correct labels such as Work, Recovery and Rounds — not 'Sets: 4 reps'
 * for intervals."*
 *
 * ⚠ **THE SHEET'S OWN UNIT WORD IS NOISE.** Measured across all 55 templates it
 * uses `reps` and `rounds` for structurally identical doses inside ONE quality:
 * `aerobic_power` holds both `4 reps` (Classic 4×4) and `8 rounds` (MAS 15:15);
 * `anaerobic` holds both `6 reps` and `8 rounds` (Tabata). Promoting that word
 * to the label would have printed `Reps: 4` on Classic 4×4 — which is the very
 * line Sam rejected, wearing a different word.
 *
 * What the athlete counts is decided by the KIND of work, and the sheet does
 * carry that: sprint qualities are performed in reps, conditioning qualities in
 * rounds. This map is total over `ConditioningQuality`, so an added quality
 * stops the build until somebody chooses its word.
 */
const QUALITY_DOSE_LABEL: Readonly<Record<ConditioningQuality, 'Reps' | 'Rounds'>> = {
  acceleration: 'Reps',
  top_end_speed: 'Reps',
  repeat_sprint: 'Reps',
  cod_decel: 'Reps',
  anaerobic: 'Rounds',
  aerobic_power: 'Rounds',
  aerobic_capacity: 'Rounds',
  flush: 'Rounds',
};

function roundsLine(template: ConditioningTemplate): ConditioningDisplayLine | null {
  const authored = stripAuthoringNotes(template.setsRounds ?? '');
  if (!authored) return null;

  /* A BARE QUANTITY CARRIES NO UNIT WORD, BECAUSE THE LABEL IS THE UNIT.
   * `Rounds: 6–10 reps` said "rounds" and "reps" about one number and left the
   * athlete to pick which. The number is untouched; only the duplicated word
   * goes. `1 block` keeps its own label — a continuous run is neither. */
  const bare = /^([\d\s\u2013-]+?)\s*(reps?|rounds?|sets?|blocks?)$/i.exec(authored);
  if (bare) {
    const unit = bare[2].toLowerCase();
    const label = unit.startsWith('block') ? 'Blocks' : QUALITY_DOSE_LABEL[template.quality];
    return { label, text: bare[1].trim() };
  }

  /* A COMPOUND DOSE (`3 sets × 5 reps, 3 min between sets`) IS RENDERED
   * VERBATIM: there the unit words distinguish two different things, and
   * reducing it to a number would lose half the prescription. */
  return { label: QUALITY_DOSE_LABEL[template.quality], text: authored };
}

/**
 * The athlete-visible projection of one authored conditioning template.
 *
 * ⚠ `modalityNotes`, `frameworkCheck`, `source`, `changeMark`, `workToRest` and
 * `totalSessionTime` are DELIBERATELY ABSENT. The first four are maintenance
 * notes; the last two are derived annotations the athlete never asked for and
 * which Sam's display ruling of 2026-08-05 already keeps off the row.
 */
export function conditioningDisplayLines(
  input: ConditioningDisplayInput,
): ConditioningDisplayLine[] {
  const { template } = input;
  const lines: ConditioningDisplayLine[] = [];

  const work = stripAuthoringNotes(template.workPeriod ?? '');
  if (work) lines.push({ label: 'Work', text: work });

  const recovery = stripAuthoringNotes(template.restPeriod ?? '');
  if (recovery) lines.push({ label: 'Recovery', text: recovery });

  const rounds = roundsLine(template);
  if (rounds) lines.push(rounds);

  /* THE INTENSITY FIELD CARRIES TWO MEASUREMENTS AND THEY ARE SPLIT HERE.
   * `90–100% MAS; HR 90–95% max late` is a speed target AND a heart-rate
   * target welded with a semicolon; an athlete reading one line cannot tell
   * which number applies to what. */
  const clauses = stripAuthoringNotes(template.intensity ?? '')
    .split(';').map((clause) => clause.trim()).filter(Boolean);
  const intensityClauses = clauses.filter((clause) => !isHeartRateClause(clause));
  const heartRateClauses = clauses.filter(isHeartRateClause);

  if (intensityClauses.length > 0) {
    lines.push({
      label: 'Intensity',
      text: intensityClauses.join('; '),
    });
  }
  for (const clause of heartRateClauses) {
    const sentence = heartRateSentence(clause);
    if (sentence) lines.push({ label: 'Heart rate', text: sentence });
  }

  const cue = athleteSentence(template.effortCue ?? '');
  if (cue) lines.push({ label: null, text: cue });

  /* ⚠ **THE PACE LINE IS NOT THIS FILE'S, AND THAT IS DELIBERATE.**
   * `rules/masPace.personalPaceLine` already owns it, already reads the
   * athlete's LIVE time trial, and is already wired to the row renderer. Adding
   * a second pace here would bake a number into the stored row that goes stale
   * the day the athlete re-tests — and give one question two owners. This file
   * owns STRUCTURE and WORDS; `masPace` owns the pace. */

  return lines;
}

/** The same projection as the one string the row's notes carry. */
export function conditioningDisplayText(input: ConditioningDisplayInput): string {
  return conditioningDisplayLines(input)
    .map((line) => (line.label ? `${line.label}: ${line.text}` : line.text))
    .join('\n');
}
