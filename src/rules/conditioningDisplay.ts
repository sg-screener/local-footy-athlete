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
 * The signed template remains the owner of physiology, eligibility and dose
 * bands. This projection resolves those bands to the one concrete, clock-easy
 * instruction Sam approved for the athlete. It does not participate in
 * template selection, safety caps or the stored execution recovery.
 */

import type { ConditioningQuality, ConditioningTemplate } from '../data/conditioningTemplates';
import { doseMidpoint, parseConditioningDose } from './conditioningDose';
import type { ConditioningOption } from '../types/domain';
import { CONDITIONING_ATHLETE_COPY } from './conditioningAthleteCopy';

/** Wording only: the selected mode owns movement instructions, never dose.
 * Walking/spinning remain ACTIVE recovery; complete rest is never rewritten.
 * Running distances on time-based machine variants remain visible as equivalents.
 */
export function conditioningWordingForModality(text: string, modality?: ConditioningOption['modality']): string {
  if (!modality) return text;
  const active = text.replace(/\beasy spin\/paddle\b/gi, 'easy active recovery');
  if (modality === 'running') return active;
  const movementWording = active
    .replace(/\bwalk(?:-back)?\b/gi, match => /^[A-Z]/.test(match) ? 'Easy active recovery' : 'easy active recovery')
    .replace(/\((\d+(?:[–-]\d+)?\s*(?:km|m))\)/g, '($1 running equivalent)')
    .replace(/\bper (\d+\s*m)\b/g, 'per effort ($1 running equivalent)');
  return movementWording.replace(/^Intensity:\s*(.+)$/gim, (_line, intensity: string) => {
    const projected = conditioningIntensityDisplayForModality(intensity.trim(), modality);
    return projected ? `${projected.label}: ${projected.text}` : '';
  }).replace(/\n{3,}/g, '\n\n').trim();
}

export interface ConditioningDisplayLine {
  /** `Work`, `Recovery`, `Rounds`, `Intensity`, `Effort`, or an unlabelled cue. */
  readonly label: string | null;
  readonly text: string;
}

/**
 * The session card's visual hierarchy. These are athlete-facing concepts, not
 * the workbook's field names: the screen renders them directly and never has
 * to rearrange `Work:`, `Recovery:` or `Rounds:` strings itself.
 */
export interface ConditioningCardPresentation {
  readonly modality: string | null;
  readonly structure: string;
  readonly workRecovery: string | null;
  readonly recoveryDetail: string | null;
  readonly intensity: string;
  readonly cue: string;
  readonly total: string | null;
  readonly supportsPersonalTarget: boolean;
}

function compactSecondUnits(text: string): string {
  return text.replace(/(\d(?:[\d.–—-]*\d)?)\s+s\b/g, '$1s');
}

function structureText(line: ConditioningDisplayLine, raw: string): string {
  const withoutRedundantBlockDuration = raw
    .replace(/\s*\([^)]*\bper\s+(?:block|set)\)\s*$/i, '')
    .trim();
  if (/\b(?:reps?|rounds?|blocks?|sets?)\b/i.test(withoutRedundantBlockDuration)) {
    return withoutRedundantBlockDuration;
  }
  return `${withoutRedundantBlockDuration} ${line.label!.toLowerCase()}`;
}

/**
 * One universal conditioning-card projection.
 *
 * The persisted row remains the canonical newline projection for compatibility
 * and history. This reader lifts those known lines back into named display
 * concepts once, outside React, so every card path gets the same hierarchy.
 */
export function conditioningCardPresentation(
  lines: readonly ConditioningDisplayLine[],
  modality?: string | null,
): ConditioningCardPresentation {
  const labelled = (label: string) => lines.find((line) => line.label === label);
  const work = labelled('Work')?.text.trim() ?? '';
  const recovery = labelled('Recovery')?.text.trim() ?? '';
  const count = lines.find((line) =>
    line.label === 'Rounds' || line.label === 'Reps' || line.label === 'Blocks');
  const authoredIntensity = labelled('Intensity')?.text.trim() ?? '';
  const effort = labelled('Effort')?.text.trim() ?? '';
  const intensity = effort ? `Effort: ${effort}` : authoredIntensity;
  const cue = lines.filter((line) => line.label === null).map((line) => line.text.trim())
    .filter(Boolean).join(' ');
  const total = labelled('Total')?.text.trim() || null;

  const continuous = /\bcontinuous\b/i.test(work)
    && /^(?:none\s*\(continuous\)|no recovery)$/i.test(recovery);
  if (continuous) {
    return {
      modality: modality || null,
      structure: work,
      workRecovery: null,
      recoveryDetail: null,
      intensity,
      cue,
      total,
      supportsPersonalTarget: modality === 'Run',
    };
  }

  const recoveryParts = recovery.split(';').map((part) => part.trim()).filter(Boolean);
  const countParts = (count?.text ?? '').split(/,\s*(?=[^,;]*\bbetween\b)/i)
    .map((part) => part.trim()).filter(Boolean);
  const primaryRecovery = recoveryParts[0] ?? '';
  const detail = [...recoveryParts.slice(1), ...countParts.slice(1)].join('; ') || null;

  return {
    modality: modality || null,
    structure: count && countParts[0] ? structureText(count, countParts[0]) : work,
    workRecovery: work
      ? [compactSecondUnits(work), compactSecondUnits(primaryRecovery)].filter(Boolean).join(' / ')
      : null,
    recoveryDetail: detail,
    intensity,
    cue,
    total,
    supportsPersonalTarget: modality === 'Run',
  };
}

/** Lift the stored compatibility text into the universal card projection. */
export function conditioningCardPresentationFromText(
  copy: string,
  modality?: string | null,
): ConditioningCardPresentation {
  const lines: ConditioningDisplayLine[] = copy.split('\n').map((raw) => {
    const match = /^(Work|Recovery|Rounds|Reps|Blocks|Intensity|Effort|Total):\s*(.*)$/.exec(raw.trim());
    return match
      ? { label: match[1], text: match[2] }
      : { label: null, text: raw.trim() };
  }).filter((line) => line.text.length > 0);
  return conditioningCardPresentation(lines, modality);
}

export interface ConditioningDisplayInput {
  readonly template: ConditioningTemplate;
  /** Selected typed delivery mode. Omitted while writing generic stored copy. */
  readonly modality?: ConditioningOption['modality'];
  /** The concrete count materialised on this row; absent callers use the same midpoint rule. */
  readonly resolvedSetsRounds?: number | null;
  /**
   * The athlete's measured Maximal Aerobic Speed, km/h, from
   * `data/twoKmTimeTrial.deriveMas`. Absent when they have not recorded a time
   * trial — the pace line is then OMITTED rather than guessed.
   */
  readonly masKmh?: number | null;
}

/**
 * One deterministic bridge from the template's intended intensity to the
 * signed 1–10 effort scale used elsewhere in the app. It reads intensity only:
 * never template name, description, cue or catalogue position.
 *
 * The ordered branches are semantic. Explicit /10 copy wins; truly maximal
 * work is 10; MAS bands retain their distinct easy/tempo/power intent; then the
 * authored plain-language scale supplies the remaining hard/easy cases.
 */
export function conditioningEffortRating(intendedIntensity: string): number | null {
  const intensity = stripAuthoringNotes(intendedIntensity).trim();
  if (!intensity) return null;

  const explicit = /(\d+)(?:\s*[–-]\s*(\d+))?\s*\/\s*10\b/.exec(intensity);
  if (explicit) {
    const low = Number(explicit[1]);
    const high = explicit[2] ? Number(explicit[2]) : low;
    const midpoint = Math.round((low + high) / 2);
    return midpoint >= 1 && midpoint <= 10 ? midpoint : null;
  }

  if (/\b(?:all[- ]out|maximal intent|maximal repeat|maximal)\b/i.test(intensity)
    && !/\bnot maximal\b/i.test(intensity)) return 10;

  const percentage = /(approximately\s*)?(\d+)\s*(?:[–-]\s*(\d+)\s*)?%\s*(MAS)?/i.exec(intensity);
  if (percentage) {
    const low = Number(percentage[2]);
    const high = percentage[3] ? Number(percentage[3]) : low;
    const isMas = !!percentage[4];
    if (!isMas) {
      if (low >= 95) return 10;
      if (low >= 90) return 9;
      if (low >= 70) return 6;
      if (low >= 65 && high <= 75) return 5;
      if (low >= 65) return 6;
    } else {
      if (high >= 110) return 9;
      if (low >= 90) return 8;
      if (low >= 70) return 6;
      if (low >= 65 && high <= 75) return 5;
      if (low >= 65) return 6;
    }
  }

  if (/\bvery hard\b/i.test(intensity)) return 8;
  if (/\bhard\b/i.test(intensity)) return 7;
  if (/\bcontrolled\b/i.test(intensity)) return 6;
  if (/\b(?:very easy|low intensity|easy)\b/i.test(intensity)) return 3;
  return null;
}

/** The one intensity-unit display rule, keyed only by selected typed mode. */
export function conditioningIntensityDisplayForModality(
  intendedIntensity: string,
  modality?: ConditioningOption['modality'],
): ConditioningDisplayLine | null {
  const cleaned = stripAuthoringNotes(intendedIntensity).trim();
  if (!cleaned) return null;
  if (!modality || modality === 'running') return { label: 'Intensity', text: cleaned };
  const rating = conditioningEffortRating(cleaned);
  return rating === null ? null : { label: 'Effort', text: `${rating}/10` };
}

/**
 * The workbook keeps classification shorthand and a handful of merged source
 * variants. The athlete gets neither: one plain title and one actionable dose.
 *
 * These are DISPLAY decisions only. Selection still keys the authored name,
 * dated-sheet equality remains explicit through the test's narrow re-authored
 * field registry, and `workToRest` remains available to the physiology checks.
 * This boundary is intentionally the same one that already owns Work /
 * Recovery / Rounds wording.
 */
export interface ConditioningAthletePrescription {
  readonly title: string;
  readonly work: string;
  readonly recovery: string;
  readonly setsRounds: string;
  readonly totalSessionTime: string;
}

/** A display title never doubles as the template's lookup identity. */
export function conditioningDisplayTitleForName(name: string): string {
  return CONDITIONING_ATHLETE_COPY[name]?.title ?? name;
}

/** One complete reviewed projection for the authored catalogue. Synthetic test
 * templates and unread legacy rows fall back to their own signed fields. */
export function conditioningAthletePrescription(
  template: ConditioningTemplate,
  resolvedSetsRounds?: number | null,
  modality?: ConditioningOption['modality'],
): ConditioningAthletePrescription {
  const approved = CONDITIONING_ATHLETE_COPY[template.name];
  const authoredCount = approved?.setsRounds ?? stripAuthoringNotes(template.setsRounds ?? '');
  const simpleCount = /^(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s+(reps?|rounds?|blocks?)(?:\s*\([^)]*\))?$/i
    .exec(authoredCount);
  const parsedCount = parseConditioningDose(authoredCount);
  const chosenCount = resolvedSetsRounds
    ?? (parsedCount.ok ? Math.max(1, Math.round(doseMidpoint(parsedCount.quantity))) : null);
  const setsRounds = simpleCount && chosenCount !== null
    ? `${chosenCount} ${simpleCount[3]}`
    : authoredCount;
  return {
    title: conditioningDisplayTitleForName(template.name),
    work: conditioningWordingForModality(approved?.work ?? stripAuthoringNotes(template.workPeriod ?? ''), modality),
    recovery: conditioningWordingForModality(approved?.recovery ?? stripAuthoringNotes(template.restPeriod ?? ''), modality),
    setsRounds,
    totalSessionTime: approved?.totalSessionTime ?? stripAuthoringNotes(template.totalSessionTime ?? ''),
  };
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
  const prescription = conditioningAthletePrescription(
    template,
    input.resolvedSetsRounds,
  );
  const lines: ConditioningDisplayLine[] = [];

  const work = prescription.work;
  if (work) lines.push({ label: 'Work', text: work });

  const recovery = prescription.recovery;
  if (recovery) lines.push({ label: 'Recovery', text: recovery });

  const rounds = roundsLine({ ...template, setsRounds: prescription.setsRounds });
  if (rounds) lines.push(rounds);

  /* The sheet's intensity field sometimes carries an HR clause after a
   * semicolon. Sam removed heart-rate copy from conditioning cards on
   * 2026-08-26, so that internal monitoring note is filtered here and the
   * actionable intensity target is the only one rendered. */
  const approved = CONDITIONING_ATHLETE_COPY[template.name];
  const clauses = stripAuthoringNotes(approved?.intensity ?? template.intensity ?? '')
    .split(';').map((clause) => clause.trim()).filter(Boolean);
  const intensityClauses = clauses.filter((clause) => !isHeartRateClause(clause));

  const intensityLine = conditioningIntensityDisplayForModality(
    intensityClauses.join('; '),
    input.modality,
  );
  if (intensityLine) lines.push(intensityLine);
  const cue = athleteSentence(approved?.cue ?? template.effortCue ?? '');
  if (cue) lines.push({ label: null, text: cue });
  if (template.quality === 'flush') lines.push({ label: 'Total', text: prescription.totalSessionTime });

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
