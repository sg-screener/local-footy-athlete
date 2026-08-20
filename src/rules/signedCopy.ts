/**
 * ATHLETE-FACING WORDS HAVE ONE SOURCE, AND IT IS AUTHORED.
 *
 * Sam's ruling, 2026-07-30, one-projection reassessment (2): every athlete-visible
 * string is extracted into one sheet; each either TRACES to an authored source
 * (the exercise master sheet, the cue sheet, a signed sentence) or is a GAP Sam
 * rules himself. Nothing ships as `SignedCopy` without a traced source or a
 * ruling.
 *
 * WHY A BRANDED TYPE AND NOT A CONVENTION. On 2026-07-29 his week card read
 * "Aerobic conditioning component (25m…)". Nothing was broken: the generator
 * appends that phrase to `allocation.focus` (`coachingEngine.ts:1262`, `:6500`)
 * as internal planner scratch, and `resolveSessionDisplayName`'s last precedence
 * rule is "cleaned name/focus pass-through" — so the planner's notes reach the
 * glass through a function whose job is to tidy punctuation. A convention cannot
 * stop that. A type can: `SignedCopy` has no public constructor, so
 * `allocation.focus` cannot be assigned to a headline, and the defect stops
 * COMPILING rather than stopping being reported.
 *
 * This is the exercise-name-literal-lock pattern (`hardcodedExerciseNameLockTests`)
 * applied to sentences instead of exercise names, and for the same reason: a
 * literal in a builder is a word the athlete can see.
 *
 * PROVENANCE TRAVELS WITH THE WORDS. Every entry records where it came from, so
 * the sheet can be audited without reading the code, and so a gap is visibly a
 * gap rather than an unremarkable string.
 */

/**
 * Where an athlete-visible string is allowed to come from.
 *
 * `authored_sheet` — the exercise master sheet or the cue sheet. Sam's data.
 * `signed_sentence` — prose Sam has signed off in chat or a doc, quoted verbatim.
 * `sam_ruling`      — a gap Sam ruled conversationally; the ruling is cited.
 * `derived_number`  — a value formatted into an authored template (a duration, a
 *                     count). The TEMPLATE is authored; the number is data.
 */
export type SignedCopySource =
  | 'authored_sheet'
  | 'signed_sentence'
  | 'sam_ruling'
  | 'derived_number';

declare const SIGNED_COPY_BRAND: unique symbol;

/**
 * A string the athlete may read.
 *
 * Structurally impossible to produce from free text: the brand is a declared
 * unique symbol that no value can carry, so the only way to obtain one is
 * `signedCopy(...)` below, which requires an entry in the sheet.
 */
export type SignedCopy = string & { readonly [SIGNED_COPY_BRAND]: 'signed' };

export interface SignedCopyEntry {
  /** Stable id; what code refers to, so the words can change without a rename. */
  readonly id: string;
  readonly source: SignedCopySource;
  /**
   * Where it came from, precisely enough to check: a sheet name, a doc + date,
   * or the ruling that authorised it. "Sam said so" is not a provenance.
   */
  readonly provenance: string;
  /**
   * The words. `{}` placeholders are filled by `signedCopy`'s params and are the
   * ONLY dynamic part — a template with a free-text placeholder would reopen the
   * hole this module exists to close, so placeholders take numbers and
   * already-signed copy, never arbitrary strings.
   */
  readonly text: string;
  /**
   * THIS ENTRY IS A SEPARATOR, AND SEPARATORS ARE THE ONLY WAY TWO SIGNED
   * STRINGS MAY BECOME ONE.
   *
   * Sam's 2026-08-08 compound-bucket ruling made a day's name a LIST — "Strength
   * + Conditioning" — and a list has to be joined somewhere. Every place that
   * could be was wrong: a surface joining with a `' + '` literal is a surface
   * inventing an athlete-visible character (`DayWorkoutScreenV2` was doing
   * exactly that), and widening `FILLED_PLACEHOLDER` to admit words would let
   * arbitrary text back through the one hole this module leaves open.
   *
   * So joining is a SHEET operation: `joinSignedCopy` puts a signed separator
   * between signed parts, and every character of the result traces to an entry.
   * `isSignedCopyText` knows to split on these, so a compound still reads as
   * signed to the L-P2 runtime law — and still reads as UNSIGNED the moment one
   * of its halves is not in the sheet, which is the property that matters.
   */
  readonly joiner?: true;
}

/**
 * THE SHEET.
 *
 * Deliberately empty at stage 1. It is populated by the extraction pass, which
 * lists every athlete-visible string in the app and marks each traced or gap;
 * Sam then rules only the gaps, conversationally, on the load-ratio-session
 * precedent. Shipping a half-filled sheet with invented wording would be
 * exactly the "nothing ships without a traced source or a ruling" the ruling
 * forbids — so the sheet stays empty until the extraction has been read.
 *
 * `signedCopyRegistrySize` is exported so the gate can assert progress rather
 * than presence, and so an empty sheet cannot be mistaken for a finished one.
 */
const REGISTRY = new Map<string, SignedCopyEntry>();

export function registerSignedCopy(entries: readonly SignedCopyEntry[]): void {
  for (const entry of entries) {
    const existing = REGISTRY.get(entry.id);
    if (existing && existing.text !== entry.text) {
      throw new Error(
        `signed copy id "${entry.id}" registered twice with different words — `
        + 'one id is one sentence, or the sheet stops being the source of truth',
      );
    }
    REGISTRY.set(entry.id, entry);
  }
}

export function signedCopyRegistrySize(): number {
  return REGISTRY.size;
}

export function signedCopyEntries(): readonly SignedCopyEntry[] {
  return Array.from(REGISTRY.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function signedCopyEntry(id: string): SignedCopyEntry | null {
  return REGISTRY.get(id) ?? null;
}

/** A number or already-signed copy. Never a bare string — see `SignedCopyEntry.text`. */
/**
 * ── A FORMATTED FIGURE — SAM, 2026-08-20, FOR THE PACE LINE ────────────────
 *
 * A pace is a figure the app computed, exactly like `{minutes}` — but it is
 * written `4:00`, and a bare `number` cannot carry the colon or the leading zero
 * (`4:0` is not a pace). So the slot admits one more shape, and ONLY one:
 * digits, colons and dots.
 *
 * ⚠ **THE GUARANTEE IS UNCHANGED, WHICH IS WHY THE PATTERN IS THIS TIGHT.** The
 * law exists so athlete-facing WORDS come from the sheet; the pattern below
 * cannot express a word, a space or punctuation that could join two clauses. A
 * caller can produce `4:27`; it cannot produce `4:27 or just go easy`. Widening
 * this to `.+` is what the paragraph above already records as a defect once.
 */
declare const DERIVED_NUMERIC_BRAND: unique symbol;
export type DerivedNumericText = string & { readonly [DERIVED_NUMERIC_BRAND]: true };

const DERIVED_NUMERIC_RE = /^[0-9]+(?:[:.][0-9]+)*$/;

/** Brand a formatted figure. Throws on anything that is not one. */
export function derivedNumericText(text: string): DerivedNumericText {
  if (!DERIVED_NUMERIC_RE.test(text)) {
    throw new UnsignedCopyError(`derived_numeric_text: ${text}`);
  }
  return text as DerivedNumericText;
}

export type SignedCopyParam = number | SignedCopy | DerivedNumericText;

export class UnsignedCopyError extends Error {
  readonly code = 'unsigned_athlete_copy';

  constructor(id: string) {
    super(
      `"${id}" is not in the signed-copy sheet. Athlete-facing words come from an `
      + 'authored source or a Sam ruling — add the entry with its provenance, or '
      + 'the athlete reads something nobody wrote.',
    );
  }
}

/**
 * The one constructor.
 *
 * Throws rather than falling back, and that is the whole point: a fallback here
 * would be a second source of athlete-facing words, which is the defect. A
 * missing entry is a gap for Sam, surfaced loudly at the moment it is needed.
 */
export function signedCopy(
  id: string,
  params: Readonly<Record<string, SignedCopyParam>> = {},
): SignedCopy {
  const entry = REGISTRY.get(id);
  if (!entry) throw new UnsignedCopyError(id);
  const filled = entry.text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = params[key];
    if (value === undefined) return whole;
    return String(value);
  });
  return filled as SignedCopy;
}

/**
 * THE ONE WAY TO MAKE ONE SIGNED STRING OUT OF SEVERAL.
 *
 * Sam ruled a day's name compound on 2026-08-08 — *"on weekly view it should say
 * whatever the bucket is that day i.e. Strength or strength + conditioning"* —
 * and the `" + "` between them is his own, quoted from that sentence.
 *
 * WHY THIS EXISTS RATHER THAN A `.join(' + ')` AT THE CALL SITE. A join is a
 * composition, and a composition is the defect `SignedCopy` was built to stop:
 * the separator is athlete-visible text, so a call site choosing it is a call
 * site authoring words. Here the separator is an ENTRY, with a provenance, and
 * the only inputs are values that already came out of the sheet — so the result
 * is signed in the strict sense, not signed by convention.
 *
 * It refuses a non-separator id rather than joining with whatever that entry
 * says: `part.headline.strength` as a joiner would silently produce
 * "MobilityStrengthConditioning" and every gate downstream would call it signed.
 */
export function joinSignedCopy(
  parts: readonly SignedCopy[],
  joinerId: string,
): SignedCopy {
  const entry = REGISTRY.get(joinerId);
  if (!entry) throw new UnsignedCopyError(joinerId);
  if (!entry.joiner) {
    throw new Error(
      `signed copy id "${joinerId}" is not a separator. Joining with an ordinary `
      + 'entry would paste one athlete-visible sentence between two others and '
      + 'the result would still type as signed — mark the entry `joiner: true` '
      + 'or use an id that is one.',
    );
  }
  if (parts.length === 0) {
    throw new Error(
      `joinSignedCopy("${joinerId}") was given nothing to join. An empty join is `
      + 'an empty string on the glass, which is a caller that has not decided '
      + 'what the athlete reads when there is nothing to say.',
    );
  }
  return parts.join(entry.text) as SignedCopy;
}

/**
 * What a `{placeholder}` is allowed to have been filled with.
 *
 * A NUMBER, and nothing else. Every templated entry in the sheet is a
 * `derived_number` — `{sets} × {reps}`, `{minutes} min`, `{min}-{max}s` — so the
 * only thing a filled slot can honestly contain is a figure the app computed.
 *
 * This was `.+`, and `.+` made the L-P2 runtime law weaker than it reads:
 * "{minutes} min" would accept *literally whatever* min, so a composed string
 * with the right suffix traced to an authored template it never came from. The
 * law is that athlete-facing words come from the sheet; a placeholder is the one
 * sanctioned hole in that, and it should be exactly as wide as the thing it
 * exists for.
 *
 * If a future entry legitimately templates a WORD rather than a number, this
 * pattern is the thing to widen — deliberately, in that entry's commit, with the
 * reason. Widening it to `.+` again to make an unrelated red go away is the
 * loosening this comment exists to make visible.
 */
const FILLED_PLACEHOLDER = '\\d+(?:\\.\\d+)?';

/**
 * Is this value signed?
 *
 * For the walker's L-P2 assertion and `surfaceAgreementTests` cell 5, which check
 * rendered strings against the sheet at runtime. It compares against the FILLED
 * text of every entry, so a string carrying a formatted number still traces to
 * its authored template.
 */
export function isSignedCopyText(value: string): boolean {
  if (matchesOneEntry(value)) return true;
  // A COMPOUND IS SIGNED IFF EVERY PART OF IT IS. Sam's compound bucket name
  // ("Strength + Conditioning") is one string on the glass made of three sheet
  // entries — two words and the separator between them. Splitting on the
  // separator and requiring EVERY piece to be an entry is what keeps this from
  // being a hole: one unsigned word anywhere in the list and the whole compound
  // reads unsigned, which is the answer the L-P2 law needs.
  //
  // ONE LEVEL, DELIBERATELY. The pieces are checked as plain entries, not
  // recursively as further joins — a compound of compounds is not a thing any
  // ruling has asked for, and admitting it would make the split ambiguous.
  for (const entry of REGISTRY.values()) {
    if (!entry.joiner || entry.text.length === 0) continue;
    const pieces = value.split(entry.text);
    if (pieces.length < 2) continue;
    if (pieces.every((piece) => matchesOneEntry(piece))) return true;
  }
  return false;
}

/** One entry, exactly — or one entry's template with its numbers filled in. */
function matchesOneEntry(value: string): boolean {
  for (const entry of REGISTRY.values()) {
    if (entry.text === value) return true;
    if (!entry.text.includes('{')) continue;
    const pattern = new RegExp(
      `^${entry.text
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\{\w+\\\}/g, FILLED_PLACEHOLDER)}$`,
    );
    if (pattern.test(value)) return true;
  }
  return false;
}
