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
import { doseMidpoint, parseConditioningDose } from './conditioningDose';

export interface ConditioningDisplayLine {
  /** `Work`, `Recovery`, `Rounds`, `Intensity`, or an unlabelled cue. */
  readonly label: string | null;
  readonly text: string;
}

export interface ConditioningDisplayInput {
  readonly template: ConditioningTemplate;
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

const CONDITIONING_DISPLAY_TITLES: Readonly<Record<string, string>> = {
  'Classic 4×4': '4×4 VO₂ Max',
  'MAS 15:15 Blocks': '15-Second MAS Blocks',
  '30:30 Hard Intermittent': '30-Second Hard Intervals',
  '30:30 Controlled Tempo Blocks': '30-Second Tempo Blocks',
  'Flush Intervals 30:30': '30-Second Flush Intervals',
  'Flush Intervals 1:1 (1 min / 1 min)': 'One-Minute Flush Intervals',
  'Flush Intervals 2:1 (2 min / 1 min)': 'Two-Minute Flush Intervals',
  'Steady Blocks (3×8 min or 4×6 min)': 'Steady Blocks',
  'Bodyweight Circuit (no-equipment fallback)': 'Bodyweight Circuit',
};

/** Reviewed display copy, not a second dose catalogue. Intensity targets and
 * unique safety/recovery instructions are retained; Work/Recovery/counts are
 * still read from the authored prescription below. R-240, reviewed 2026-08-28. */
export const CONDITIONING_COACHING_COPY: Readonly<Record<string, {
  intensity: string;
  cue: string;
}>> = {
  '10 m Acceleration Reps': { intensity: '95–100% maximal', cue: 'Quick, light contacts and a crisp first step.' },
  '20 m Acceleration Reps': { intensity: '95–100% maximal', cue: 'Keep the drive phase consistent. Stop if it deteriorates.' },
  '30 m Acceleration Reps': { intensity: '95–100% maximal', cue: 'Accelerate through the rep; this is not a top-speed drill.' },
  'Hill Acceleration': { intensity: '95–100% maximal uphill', cue: 'Drive forward up the hill.' },
  'Air Bike Accelerations': { intensity: '95–100% maximal', cue: 'If power drops about 5%, extend recovery or stop.' },
  'Team-Training Warm-Up Dose': { intensity: '95–100% maximal', cue: 'Include these reps in your club warm-up, not a separate session.' },
  'Return-to-Speed Ladder': { intensity: '90–95%', cue: 'First exposure back: favour controlled mechanics over extra speed.' },
  'Fly 20 (20+20)': { intensity: '95–100% max velocity', cue: 'Build smoothly into the fly zone; do not force top speed.' },
  'Fly 30 (30+30)': { intensity: '95–100% max velocity', cue: 'Build smoothly. Stop if speed drops.' },
  'Progressive Sprint Exposure': { intensity: '90–100%, smooth build to top speed', cue: 'Keep your mechanics smooth; this is not a time trial.' },
  'Off-Season Speed Reintroduction': { intensity: '90–95%', cue: 'Prioritise mechanics as you rebuild speed.' },
  '20 m Shuttle Repeats': { intensity: 'Maximal repeat efforts', cue: 'Walk between reps; keep moving during recovery.' },
  '30 m Repeats': { intensity: 'Maximal repeat efforts', cue: 'Walk between reps; keep moving during recovery.' },
  'Sprint Sets (3×5×6 s)': { intensity: 'Maximal', cue: 'Keep the sets consistent. Stop if the final set falls apart.' },
  '10 s Max Sprint Repeats': { intensity: 'Maximal', cue: 'Reset fully before the next effort.' },
  '10 s Repeat Efforts': { intensity: 'Very hard', cue: 'Commit to each short effort.' },
  'Up-Back Shuttle': { intensity: 'Hard but controlled', cue: 'Plant cleanly at the turn; do not slide.' },
  'Low-Intensity Deceleration Drills': { intensity: 'Low intensity', cue: 'Brake under control rather than stopping abruptly.' },
  'Deceleration and Landing Work': { intensity: 'Controlled', cue: 'Land quietly and hold your position.' },
  '45-Degree Cut Reps': { intensity: 'Maximal intent', cue: 'Keep the plant foot under you. Stop if the knee caves inward.' },
  '20 s Max Sprint — Small Dose': { intensity: 'Maximal', cue: 'Recover fully between efforts.' },
  'Erg Short-Burst Repeats (15–20 s)': { intensity: 'Very hard', cue: 'Keep each effort sharp rather than grinding.' },
  'Tabata Finisher': { intensity: 'Maximal', cue: 'Expect the final two rounds to feel very hard.' },
  '30 s Very Hard Repeats': { intensity: 'Very hard, not maximal', cue: 'Set a pace you can sustain for the full effort.' },
  '45 s Hard Repeats': { intensity: 'Hard', cue: 'Keep the effort honest as fatigue builds.' },
  '60 s Max Sustained Effort': { intensity: 'All-out sustained', cue: 'Expect marked fatigue by 45 seconds into each effort.' },
  '150–200 m Hard Repeats': { intensity: 'Hard', cue: 'Match your pace across reps.' },
  'Hill Repeats — hard sustained': { intensity: 'Hard, not maximal', cue: 'Keep a consistent effort up the hill.' },
  'Bodyweight Circuit (no-equipment fallback)': { intensity: 'Hard, sustained', cue: 'Maintain a steady effort through the circuit.' },
  'Classic 4×4': { intensity: '90–100% MAS', cue: 'Choose a pace you can repeat across all 4 rounds.' },
  'Three-Minute Intervals': { intensity: '90–100% MAS', cue: 'Keep your output consistent across rounds.' },
  'Two-Minute Repeats': { intensity: '≈100% MAS', cue: 'Use your target effort rather than starting too fast.' },
  'MAS 15:15 Blocks': { intensity: '110% MAS', cue: 'Commit to each short effort.' },
  '30:30 Hard Intermittent': { intensity: '100–110% MAS', cue: 'Repeat the same effort throughout each block; do not sprint.' },
  'Footy Shuttles': { intensity: 'Hard, controlled', cue: 'Keep the final set as consistent as the first.' },
  '1 km Repeats': { intensity: '90–100% MAS', cue: 'Aim for even splits rather than a fast first rep.' },
  '400 m Repeats': { intensity: 'Hard, controlled', cue: 'Keep the pace consistent even as the later reps become uncomfortable.' },
  'Erg EMOM': { intensity: 'Hard', cue: 'Start promptly at the beginning of each minute.' },
  'Continuous Aerobic Run': { intensity: '65–80% MAS; conversational', cue: 'Hold a steady pace throughout; avoid a fast finish.' },
  'Long Aerobic Intervals': { intensity: '70–80% MAS', cue: 'Aim for near-identical output across rounds, not a race.' },
  'Steady Blocks (3×8 min or 4×6 min)': { intensity: '65–75% MAS, easy-moderate', cue: 'Hold a steady pace for the whole block without surging.' },
  'Controlled 10–20 min Blocks': { intensity: '70–80% MAS, controlled tempo', cue: 'Maintain the target effort through the end of each block.' },
  'Steady 5 min Blocks': { intensity: '65–80% MAS, steady-moderate', cue: 'Keep this below a hard interval effort.' },
  'Aerobic Shuttles': { intensity: '65–75% MAS', cue: 'Keep the shuttles controlled rather than using maximal cuts.' },
  'Extensive Tempo (100 m repeats)': { intensity: '65–75%', cue: 'Find a game-speed rhythm and repeat the same pace.' },
  '2 min On / 1 min Easy': { intensity: '70–80% MAS', cue: 'Expect effort to build; the short recovery is intentional.' },
  '30:30 Controlled Tempo Blocks': { intensity: '65–80% MAS', cue: 'Stay controlled; you should still manage a few words at the end.' },
  '1 min On / 1 min Easy Tempo': { intensity: '65–80% MAS, controlled tempo', cue: 'Settle into a consistent rhythm.' },
  'Short Flush': { intensity: 'Easy', cue: 'Finish feeling better than you started.' },
  'Easy Aerobic Flush': { intensity: 'Easy', cue: 'Stay comfortable throughout.' },
  'Nasal-Paced Easy': { intensity: 'Easy', cue: 'Slow down if you need to open your mouth to breathe.' },
  'Erg Flush Blocks': { intensity: 'Easy', cue: 'Keep the effort gentle throughout.' },
  'Flush Intervals 30:30': { intensity: 'Easy', cue: 'Finish feeling better than you started.' },
  'Flush Intervals 1:1 (1 min / 1 min)': { intensity: 'Easy', cue: 'Finish feeling better than you started.' },
  'Flush Intervals 2:1 (2 min / 1 min)': { intensity: 'Easy', cue: 'Finish feeling better than you started.' },
};

/** A display title never doubles as the template's lookup identity. */
export function conditioningDisplayTitleForName(name: string): string {
  return CONDITIONING_DISPLAY_TITLES[name] ?? name;
}

/**
 * Merged workbook rows that contain two possible prescriptions. Each override
 * selects one dose already contained in the authored row; no number is added.
 * The chosen Steady Blocks branch is the workbook's all-modality 4×6 rendering.
 * The other three remove a parenthetical alternate while retaining the base
 * prescription exactly as authored.
 */
const CONCRETE_DISPLAY_PRESCRIPTIONS: Readonly<Record<
  string,
  Partial<Omit<ConditioningAthletePrescription, 'title'>>
>> = {
  'Steady Blocks (3×8 min or 4×6 min)': {
    work: '6 min',
    recovery: '1–2 min easy',
    setsRounds: '4 rounds',
    totalSessionTime: '26–30 min',
  },
  'Hill Repeats — hard sustained': {
    work: '40–60 s hill effort',
    recovery: 'Walk-down, 2–3 min',
    setsRounds: '4–6 reps',
  },
};

export function conditioningAthletePrescription(
  template: ConditioningTemplate,
  resolvedSetsRounds?: number | null,
): ConditioningAthletePrescription {
  const override = CONCRETE_DISPLAY_PRESCRIPTIONS[template.name] ?? {};
  const authoredCount = override.setsRounds
    ?? stripAuthoringNotes(template.setsRounds ?? '');
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
    work: override.work ?? stripAuthoringNotes(template.workPeriod ?? ''),
    recovery: override.recovery ?? stripAuthoringNotes(template.restPeriod ?? ''),
    setsRounds,
    totalSessionTime: override.totalSessionTime
      ?? stripAuthoringNotes(template.totalSessionTime ?? ''),
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
  const reviewedCopy = template.quality === 'flush' ? undefined : CONDITIONING_COACHING_COPY[template.name];
  const clauses = stripAuthoringNotes(reviewedCopy?.intensity ?? template.intensity ?? '')
    .split(';').map((clause) => clause.trim()).filter(Boolean);
  const intensityClauses = clauses.filter((clause) => !isHeartRateClause(clause));

  if (intensityClauses.length > 0) {
    lines.push({
      label: 'Intensity',
      text: intensityClauses.join('; '),
    });
  }
  const cue = athleteSentence(reviewedCopy?.cue ?? template.effortCue ?? '');
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
