/**
 * THE COPY SHEET, AND THE GAPS — Sam's ruling 2, 2026-07-30.
 *
 * "Extract every athlete-visible string into one sheet; mark which already trace
 * to authored sources (exercise master sheet, cues, signed sentences); Sam rules
 * only the gaps, conversationally via Cowork, load-ratio-session precedent.
 * Nothing ships as SignedCopy without a traced source or a Sam ruling."
 *
 * This suite IS the extraction. It walks the athlete-facing surfaces, pulls every
 * string literal sitting in a position the athlete can read, and sorts each into
 * TRACED (already resolvable to an authored source) or GAP (needs Sam). It writes
 * the sheet to `artifacts/` so it can be read conversationally rather than by
 * scrolling a diff.
 *
 * PRECISION OVER RECALL, on the literal-lock precedent
 * (`hardcodedExerciseNameLockTests`). A string is treated as athlete-visible only
 * when it sits in a rendering position — a JSX text child, or a `label` / `title`
 * / `message` / `sub` / `headline` / `body` field — and is prose rather than a
 * token: contains a space or sentence punctuation, is not an identifier, not a
 * style value, not a route name, not a test id. That keeps the residual list
 * small enough for Sam to READ AND RULE rather than rubber-stamp, which is the
 * whole point of the precedent.
 *
 * WHAT THIS SUITE ASSERTS TODAY — deliberately not "the sheet is complete":
 *   1. The extraction runs and finds a non-trivial number of strings, so a
 *      silently-broken extractor cannot masquerade as a clean app.
 *   2. The sheet is WRITTEN, so the gaps exist as a document Sam can rule on.
 *   3. `SignedCopy` cannot be produced from free text — the structural claim the
 *      whole design rests on.
 *   4. The gap count only ever goes DOWN. A ratchet, so surfaces cannot add new
 *      unauthored words while the migration is in flight.
 *
 * It does NOT assert that every string is signed. That is stage 4's job and it
 * requires Sam's rulings first; asserting it now would either fail the gate or
 * force me to invent wording, and inventing wording is precisely what the ruling
 * forbids.
 *
 * Run: npm run test:signed-copy-extraction
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
import * as path from 'path';
import {
  UnsignedCopyError,
  registerSignedCopy,
  signedCopy,
  signedCopyRegistrySize,
} from '../rules/signedCopy';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

const SRC = path.join(__dirname, '..');

/**
 * THE SURFACES THE ATHLETE READS — DEFAULT-IN, NOT OPT-IN.
 *
 * THIS USED TO BE `['screens/home', 'screens/coach', 'components']`, A
 * HAND-MAINTAINED LIST, AND THAT IS EXACTLY HOW THE JOURNAL SHIPPED UNLISTED.
 * `screens/journal` was created on 2026-08-09 with a screenful of athlete-facing
 * prose, and this extractor never looked at it — the count stayed on the ceiling
 * of 130 and the gate printed PASS. A green gate watching nothing, second
 * sighting (the first was the copy-BINDING gate reading table rows only).
 *
 * An opt-in list fails the same way every time: the person who adds a surface is
 * the person who would have to remember to add it here, and if they remembered
 * they would not have needed the gate. So scope is now DERIVED from the tree —
 * every directory under these roots is in scope the day it is created, and
 * anything excluded must say so BY NAME AND WITH A REASON below.
 */
const SURFACE_ROOTS = ['screens', 'components', 'navigation'];

/**
 * OFF THE SHEET — verified unreachable by an athlete, not merely labelled dev.
 *
 * Sam asked for `ScheduleDebugPanel` to be checked rather than assumed: "dev-only
 * = off the sheet, reachable = vocabulary violation to fix. Record which."
 *
 * VERDICT: dev-only, off the sheet. It is DOUBLE-gated by `__DEV__` — once at the
 * require site (`HomeScreen.tsx:40`, so the module is not even bundled in a
 * production build) and again at the render site (`:936`). Its 13 strings are
 * therefore not athlete-visible and are excluded, which is why the ceiling drops
 * from 200 to 187 rather than being relaxed.
 *
 * The check is repeated as an assertion below, not just recorded here: if either
 * gate is ever removed those 13 strings become athlete-visible vocabulary and must
 * come back onto the sheet.
 *
 * EVERY EXCLUSION NOW CARRIES ITS REASON IN THE DATA, so an exclusion is a claim
 * somebody made rather than a path somebody added. A cell below requires each
 * prefix to exist on disk — an exclusion for a directory that is gone protects
 * nothing, and would silently start protecting something else if the name were
 * ever reused.
 */
const OFF_SHEET: ReadonlyArray<{ readonly prefix: string; readonly why: string }> = [
  {
    prefix: 'components/dev/',
    why: 'Double-gated by __DEV__ at require and render sites (asserted below), '
      + 'so its strings are not bundled into a production build.',
  },
];

/**
 * Fields whose value lands in front of the athlete.
 *
 * `sub`, `label`, `title`, `message`, `headline`, `body`, `placeholder`, `hint`
 * and `copy` are the ones this codebase actually uses for athlete-facing text
 * (`CATEGORY_COPY`, `MOVE_REFUSAL_COPY`, `MOVE_SCOPE_COPY` all use label/sub).
 */
const VISIBLE_FIELDS = [
  'label', 'title', 'message', 'sub', 'headline', 'body',
  'placeholder', 'hint', 'copy', 'subtitle', 'description',
];

const IDENTIFIER = /^[a-z][a-zA-Z0-9_]*$/;
const CONSTANT_CASE = /^[A-Z][A-Z0-9_]*$/;
const STYLE_VALUE = /^(#[0-9a-fA-F]{3,8}|\d+(px|%)?|(flex|center|row|column|absolute|relative|none|auto|bold|normal|solid|hidden|visible|space-between|flex-start|flex-end|contain|cover)([- ]\w+)*)$/;

/** Prose: something with a space or sentence punctuation, that is not a token. */
function looksLikeProse(value: string): boolean {
  if (value.length < 4 || value.length > 400) return false;
  if (IDENTIFIER.test(value) || CONSTANT_CASE.test(value)) return false;
  if (STYLE_VALUE.test(value)) return false;
  if (/^[\w.-]+$/.test(value)) return false;
  if (/^https?:\/\//.test(value)) return false;
  return /\s/.test(value) || /[.?!,:—]/.test(value);
}

interface ExtractedString {
  readonly file: string;
  readonly line: number;
  readonly field: string;
  readonly text: string;
}

function walkFiles(dir: string, out: string[] = []): string[] {
  const full = path.join(SRC, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(rel);
  }
  return out;
}

/** Files in scope: everything under the roots, minus the declared exclusions. */
function surfaceFiles(): string[] {
  return walkFiles('')
    .filter((file) => SURFACE_ROOTS.some((root) => file.startsWith(`${root}/`)))
    .filter((file) => !OFF_SHEET.some(({ prefix }) => file.startsWith(prefix)));
}

/**
 * Blank out comments so prose ABOUT copy is never counted AS copy.
 *
 * The old extractor skipped whole lines starting with `//`, `*` or `/*`, which
 * misses a trailing `// note` and misses the body of a block comment whose lines
 * do not begin with `*`. Replacing comment spans with equal-length whitespace
 * keeps every byte offset intact, so line numbers stay honest.
 */
function blankComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length)));
}

/**
 * THE EXTRACTOR, WIDENED TO SPAN LINES — the fix this file named as owed and
 * deliberately did not do: "widening the field regex to span lines is the honest
 * fix and is NOT done here… a ceiling re-baseline and a unit of its own". This
 * IS that unit, ordered by the seat after the journal shipped unlisted.
 *
 * Four shapes, because the old two missed the dominant React idiom — a `<Text>`
 * whose sentence sits on its own line, so `>` and `</` are never on one line:
 *
 *   1. `field: 'text'` / `field={'text'}`, now allowed to span lines.
 *   2. JSX text children, multi-line, whitespace-collapsed.
 *   3. A JSX expression container holding a bare literal: `{'text'}`.
 *   4. Both arms of a literal ternary: `cond ? 'a' : 'b'`.
 *
 * DISTINCT PER FILE, and the totals report occurrences BESIDE distinct
 * (AGENTS.md's counting law) — one sentence rendered twice in a file is one
 * sentence to author, and a number that never says its unit gets read in the
 * domain's.
 */
function extract(): ExtractedString[] {
  const found: ExtractedString[] = [];
  const fieldPattern = new RegExp(
    `\\b(${VISIBLE_FIELDS.join('|')})\\s*[:=]\\s*\\{?\\s*(['"\`])((?:\\\\.|(?!\\2)[\\s\\S])*?)\\2`,
    'g',
  );
  const jsxTextPattern = />\s*([^<>{}][^<>{}]*?)\s*<\//g;
  const jsxLiteralPattern = /\{\s*(['"])((?:\\.|(?!\1).)*)\1\s*\}/g;
  const ternaryPattern = /\?\s*(['"])((?:\\.|(?!\1).)*)\1\s*:\s*(['"])((?:\\.|(?!\3).)*)\3/g;

  for (const file of surfaceFiles()) {
    const source = blankComments(fs.readFileSync(path.join(SRC, file), 'utf8'));
    const lineAt = (index: number) => source.slice(0, index).split('\n').length;
    const seen = new Set<string>();
    const take = (raw: string, field: string, index: number) => {
      const text = raw.replace(/\s+/g, ' ').trim();
      if (!looksLikeProse(text) || seen.has(text)) return;
      seen.add(text);
      found.push({ file, line: lineAt(index), field, text });
    };

    let match: RegExpExecArray | null;
    fieldPattern.lastIndex = 0;
    while ((match = fieldPattern.exec(source)) !== null) take(match[3], match[1], match.index);
    jsxTextPattern.lastIndex = 0;
    while ((match = jsxTextPattern.exec(source)) !== null) take(match[1], 'jsx_text', match.index);
    jsxLiteralPattern.lastIndex = 0;
    while ((match = jsxLiteralPattern.exec(source)) !== null) take(match[2], 'jsx_literal', match.index);
    ternaryPattern.lastIndex = 0;
    while ((match = ternaryPattern.exec(source)) !== null) {
      take(match[2], 'ternary', match.index);
      take(match[4], 'ternary', match.index);
    }
  }
  return found;
}

/**
 * THE GAP CEILING — a one-way ratchet.
 *
 * The extraction's current count. It may only ever go DOWN: every surface moved
 * onto signed copy in stage 4 lowers it, and a surface adding new unauthored
 * words while the migration is in flight raises it and fails here. Lowering the
 * number is the unit's visible progress; raising it requires a deliberate edit
 * somebody has to justify.
 *
 * 187 -> 182 (Task 1, repeat-week deleted) -> 166 (Task 6) -> 164 (Task 7)
 * -> 151 (Task 8, entry surface) -> 148 (Task 8, retirement pass)
 * -> 141 (Task 10, coach chips).
 * Task 6's drop is two things: the day-workout Classic render layer is deleted
 * outright, and the day-detail header stopped pasting the raw engine
 * `workoutType` onto the glass. Task 7's is the busy/away sheet's menu step —
 * five strings out (its title, its two rows, its Back button, and the readiness
 * entry's old label) against three signed replacements and one new signed
 * button, all four now carried by Sam's rulings 2-4 in the copy sheet. Task 8's
 * first drop is the exercise-edit MENU and exercise_menu steps (ruling 12) —
 * thirteen `ExerciseSheetOption` `label`/`sub` strings plus the sticky header's
 * "Edit exercises" link text, none replaced: the new entry surface is three
 * icons and two per-row buttons, none of which add a new word (icons carry no
 * copy, and the icon-row/row-button accessibility labels are not
 * `VISIBLE_FIELDS` — this extractor never counted `accessibilityLabel` and
 * still does not). Task 8's second drop is a review finding: concern_reason,
 * injury_area and injury_severity had zero forward setters (dead code the
 * first pass left standing rather than retired) — deleting all three removed
 * their three literal `ExerciseSheetOption` labels ("Something hurts", "No
 * equipment", "Too hard / too easy"; injury_area/injury_severity's own rows
 * were `label={area}`/`label={severity}` dynamic expressions, never counted).
 * Task 10's drop is ruling 13 — the Coach screen's seven preset question chips,
 * whose seven `label` strings were the only prose this extractor counted in
 * `CoachScreen.tsx` besides the input's own placeholder. Nothing replaces them:
 * the ruling is "the athlete just talks to the coach via the input", so the
 * surface loses seven strings and gains none. Their seven `prefill` strings
 * retire with them but were never counted (`prefill` is not `VISIBLE_FIELDS`,
 * and a prefill is text the athlete can edit before sending rather than text
 * the app asserts) — recorded so nobody re-derives a false 14-string drop.
 * DROPPED IN THE SAME COMMIT AS THE DELETION — a ceiling left sitting above the
 * real count is not a ratchet, it is headroom.
 *
 * TASK 11 SETTLES IT AT 141, AND THE NON-MOVEMENT IS THE POINT.
 *
 * Task 11 deleted `splitSessionName`, two of `resolveSessionDisplayName`'s
 * inference rules and one orphaned helper. It moved this number by ZERO, and the
 * reason is worth stating so nobody reads a flat ratchet as a task that did
 * nothing, or "re-checks" it later and re-derives a phantom drop:
 *
 *   1. WHAT DIED IS NOT ON THE SHEET. Every deletion is in `utils/` and
 *      `rules/`, and this extractor walks `screens/home`, `screens/coach` and
 *      `components` only (`SURFACE_DIRS`). What it counts is unauthored prose
 *      sitting in a RENDER position; what Task 11 removed is the machinery that
 *      let a name be re-derived from another name.
 *   2. THE STRINGS THOSE RULES PRODUCED WERE NEVER COUNTABLE ANYWAY. They were
 *      not literals in a surface file — they were the engine's `allocation.focus`
 *      arriving at a card through a punctuation tidier, which is precisely the
 *      class of athlete-facing word an extractor of literals CANNOT see. That
 *      gap is closed by the runtime half of the law
 *      (`surfaceAgreementTests` cell 5, L-P2: every string
 *      `athleteVisibleStrings` returns must satisfy `isSignedCopyText`), not by
 *      this count. Two instruments, two kinds of blindness.
 *   3. NOTHING WAS ADDED. Confirmed by the count staying exactly on the ceiling,
 *      so there is no headroom hiding an addition behind a deletion.
 *
 * The 141 that remain, by file, are the unit's residual and are listed in the
 * task-11 report for the boundary report: HomeScreenV2 55, HomeQuickActionSheet
 * 25, DayWorkoutScreenV2 22, PlanChangeSheet 14, SessionFeedbackPanel 7,
 * homeScreenConstants 7, StaleOverrideBanner 5, GuidedInjuryFlowSheet 3,
 * ExerciseVideoModal 1, SessionCompleteMoment 1, CoachScreen 1.
 *
 * SAM'S FINAL RULINGS (2026-07-31) HOLD IT FLAT AT 141 — AND THE REASON IS AN
 * INSTRUMENT LIMIT, NOT AN EMPTY LANDING. Two things landed that a reader would
 * expect to move this number, and neither can:
 *
 *   1. THE FIFTH ADD/SWAP ROW'S LABEL, "Prehab" -> "Accessories" (ruling 6-IV-1).
 *      `CATEGORY_COPY` lives in `utils/planChangeProducer.ts`, which is not in
 *      `SURFACE_DIRS`, so this extractor has never counted it (the binder, which
 *      DOES read that module by name, is what covers it — two instruments, two
 *      kinds of blindness, and this is the pair working as designed). A one-word
 *      Title Case label would not survive `looksLikeProse` in any case.
 *   2. THE REMOVE ROW'S NEW SOLE-CONTENT SUB-LINE (ruling 6-IV-3),
 *      "Remove it — the day becomes rest." — genuinely new athlete-visible prose
 *      in `screens/home/PlanChangeSheet.tsx`, i.e. squarely inside `SURFACE_DIRS`,
 *      and STILL not counted. `extract()` matches `field: 'literal'` on ONE LINE,
 *      and a state-selected sub-line is a multi-line ternary: `sub={` sits on its
 *      own line and each sentence sits on another, so the field name and the
 *      literal are never adjacent. Its two siblings ("Remove it — anything else
 *      on the day stays.", "There's nothing on this day yet.") have been invisible
 *      the same way since Task 4.
 *
 * SO A FLAT 141 HERE IS NOT "no new athlete-visible words" — it is "no new words
 * OF THE SHAPE THIS EXTRACTOR CAN SEE". Stated at the ceiling rather than in a
 * report because the ceiling is what a future reader will trust. The gap is
 * closed elsewhere and only elsewhere: every new sentence above is registered in
 * `docs/COPY_SHEET_RULINGS_2026-07-30.md`, bound both directions by
 * `copyRulingsBindingTests`, and — for anything the projection renders — covered
 * at runtime by `surfaceAgreementTests` L-P2. Widening the field regex to span
 * lines is the honest fix and is NOT done here: it would re-count strings across
 * the whole surface tree in one commit, which is a ceiling re-baseline and a unit
 * of its own, not a side effect of landing a ruling.
 */
/**
 * 141 -> 130, DROPPED IN THE SAME COMMIT THAT EARNED IT (day-first slice 2,
 * 2026-08-08). A ceiling left standing above a real measurement is headroom, and
 * headroom is how the next surface adds words for free.
 *
 * WHERE THE ELEVEN WENT, AND WHAT THAT DOES NOT MEAN. Sam's chip-row ruling
 * turned five stacked bars on the Program screen into five icon chips. The
 * sentences those bars showed ("Short on time today", "Away this week?", "I'm
 * injured", "Missing equipment?", and the readiness door's own line) are no
 * longer JSX text children, so this extractor stops seeing them — they are now
 * each chip's `accessibilityLabel` / `accessibilityHint`, positions this
 * instrument has never counted. So the drop is REAL against the instrument and
 * only PARTLY real against the app: the words still exist, they are still Sam's,
 * they are still the doors' spoken names. What actually left the screen is five
 * visible sentences, replaced by five one-word Title Case labels that
 * `looksLikeProse` correctly does not count.
 *
 * The five new labels are PROPOSED and unsigned; they are recorded in
 * `docs/COPY_SHEET_RULINGS_2026-07-30.md` (batch 12) — which is where the gap is
 * closed, here and always.
 */
/**
 * 130 -> 561: A RE-BASELINE, AND THE NUMBER WENT UP BECAUSE THE INSTRUMENT GOT
 * BETTER, NOT BECAUSE THE APP GOT WORDIER.
 *
 * This is the exact inverse of the 141 -> 130 note above, and it must be read
 * that way. Not one of the 431 newly-counted strings is new: they were written
 * across `screens/onboarding`, `screens/profile` and the multi-line JSX of
 * `screens/home` weeks or months ago. What changed is that the extractor can now
 * SEE them. Attributed, so nobody later reads this as a surface that added 431
 * unauthored sentences:
 *
 *   +102 SCOPE — `screens/onboarding` (74), `screens/profile` (23),
 *        `screens/journal` (2) and `navigation` (3) were never scanned. Scope is
 *        now derived from the tree, so this class of blindness cannot recur.
 *        `navigation` earned its place the hard way: the copy BINDER went red on
 *        "Journal tab" — a string plainly in the app, in `AppNavigator.tsx`,
 *        which neither gate was looking at. Tab labels are athlete-visible words.
 *   +329 SHAPE — multi-line JSX text children, `{'literal'}` expression
 *        containers and literal ternaries. The dominant React idiom in this
 *        codebase, invisible to a single-line regex since the extractor was
 *        written. The old ceiling's own comment named this and deferred it as
 *        "a unit of its own"; this is that unit.
 *
 * A CEILING THAT RISES IS NORMALLY THE FAILURE THIS RATCHET EXISTS TO CATCH. It
 * is allowed exactly here, once, because the measurement changed rather than the
 * app — and the ratchet is STRICTLY STRONGER afterwards: 5 directories instead
 * of 3, 4 string shapes instead of 2, 46 files instead of 11. From this commit
 * the number may only fall again.
 */
/**
 * 561 -> 565 (journal slice 2, same commit that earned it): FOUR GENUINELY NEW
 * SENTENCES, and this rise is the OTHER kind — the app gained words, the
 * instrument did not change.
 *
 * "Your note", the note-box placeholder, "Save note" and "No notes yet this
 * week." They ship PROPOSED and are recorded as batch 16 in
 * docs/COPY_SHEET_RULINGS_2026-07-30.md BEFORE this commit landed, which is the
 * transitional rule exactly: a string may ship PROPOSED, and may never ship
 * unlisted. This comment is the "justify raising the ceiling" the assertion
 * below asks for, and it names the four so a later reader can count them.
 */
/**
 * 565 -> 566 (the load slice, same commit that earned it): the Load section was
 * rewritten, and the net is ONE. The app gained words; the instrument did not
 * change, so this is batch 16's kind of rise, not batch 15's.
 *
 * FOUR IN, TWO OUT, and both halves are named so a later reader can count them
 * rather than trust the arithmetic:
 *
 *   IN  — "Load is measured from the sessions you log.", "Some lifts had no
 *         weight recorded, so they sit outside that.", "Once you have a few more
 *         weeks logged, this shows how the week compared with your normal.",
 *         "Your normal is ready to compare against — that comparison is coming
 *         next."
 *   OUT — "Your Journal is building. Once you have a few weeks logged, this
 *         shows how the week compared with your normal." and "Comparing this
 *         week with your normal is coming next." Both were PROPOSED in batch
 *         15-c and superseded before Sam ruled on either.
 *
 * All four new sentences are recorded as batch 17 in
 * docs/COPY_SHEET_RULINGS_2026-07-30.md BEFORE this commit landed — the
 * transitional rule exactly.
 *
 * WHAT THE COUNT DOES NOT INCLUDE, said out loud because a ceiling is a claim:
 * the headline band's three sentences and the two counted templates are also new
 * athlete-facing words, and this extractor does not see them — the band lines
 * live in a keyed object rather than JSX, and a template literal is not one of
 * the four shapes the extractor matches. They are listed in batch 17 anyway,
 * because being invisible to the instrument is not a reason to be invisible to
 * Sam. Widening the extractor to keyed copy objects is named here as owed.
 */
/**
 * 566 -> 568 (the Monday card's strength line, same commit that earned it): TWO
 * genuinely new sentences the extractor can see — the "Your lifts" section
 * heading and "No lifts recorded with a weight this week." Batch 16's kind of
 * rise: the app gained words, the instrument did not change.
 *
 * RECORDED AS BATCH 19 BEFORE THIS COMMIT LANDED, with the four arrow words and
 * the composed line listed there too even though this extractor cannot see
 * either — they live in a keyed object and a template literal, the two shapes
 * named as owed at the 566 rise below.
 */
/**
 * 568 -> 570 (this week's job, same commit that earned it): TWO genuinely new
 * sentences the extractor can see — the "This week's job" section heading and
 * "No plan recorded for this week." Batch 16's kind of rise: the app gained
 * words, the instrument did not change.
 *
 * IT WAS BRIEFLY THREE. The section also rendered "All of it is done." from the
 * contract's stored achieved tallies, and `section18ShortfallCopyTests` refused
 * that read — a stored tally is derived output and goes stale. The sentence was
 * WITHDRAWN from batch 20 rather than left proposed, and this ceiling is the one
 * the corrected surface earns.
 *
 * Recorded as BATCH 20 before this commit landed, with the counted line listed
 * there in template form — it takes numbers and the athlete's own domain words,
 * so a table row would bind vacuously.
 */
/**
 * 570 -> 572 (niggles + resurfacing, same commit that earned it): TWO genuinely
 * new sentences the extractor can see — the "Niggles" section heading and "No
 * niggles recorded." Batch 16's kind of rise: the app gained words, the
 * instrument did not change.
 *
 * Recorded as BATCH 21 before this commit landed, with the counted lines and the
 * resurfacing introduction listed there in template form — they take the
 * athlete's own region word and a count, so a table row would bind vacuously.
 */
/**
 * 572 -> 576 (the monthly review, same commit that earned it): FOUR genuinely new
 * sentences the extractor can see — the "Your month" heading, the
 * "builds as you train" state, and the two chart labels (one of which is a
 * template whose literal half the extractor still catches). Batch 16's kind of
 * rise: the app gained words, the instrument did not change.
 *
 * Recorded as BATCH 22 before this commit landed, with the satisfaction lines
 * listed there in template form.
 */
/**
 * 576 -> 577 (week status, same commit that earned it): ONE genuinely new
 * sentence the extractor can see — "The week is on track." The outstanding line
 * is a template and is listed in batch 24 rather than counted here.
 *
 * THE SENTENCE BATCH 20 WITHDREW IS NOT THIS ONE. That one read the contract's
 * stored tallies and was refused; this one is derived this turn from a fresh
 * ledger. Same shape, honest source — which is why the wording waited for the
 * derivation rather than shipping with it.
 */
/**
 * 577 -> 580 (what you changed, same commit that earned it): THREE genuinely new
 * sentences the extractor can see — the "What you changed" heading, the honest
 * empty state, and the BOUNDARY line ("Changes the app made for you are not
 * listed here yet.").
 *
 * The boundary sentence is the one that matters: without it the list would imply
 * the app changed nothing, which is a stronger claim than the ledger supports.
 * It is recorded as batch 25-a before this commit landed.
 */
/**
 * 580 -> 572 (the exception-based front page, same commit that earned it): a
 * DROP of eight, and the ratchet's own rule says a ceiling left standing above a
 * real measurement is headroom. Dropped in the commit that earned it.
 *
 * ATTRIBUTED IN FULL, because "the count went down" is the shape a deletion
 * hides behind. It is NOT one movement — it is three, and only the middle one is
 * an athlete losing anything:
 *
 *   OUT, -6 SECTION HEADINGS. Sam's ruling replaces a stack of labelled sections
 *   with a hero, a stat strip and earned cards. "Did the work happen", "How the
 *   week felt", "Your note", "This week's job", "What you changed" and "Niggles"
 *   name nothing that still exists as a section. **No sentence was lost — a
 *   heading is a label on a box, and the boxes are gone.**
 *
 *   OUT, -3 EMPTY STATES. "You made no changes to this week.", "No lifts
 *   recorded with a weight this week." and "No niggles recorded." are retired by
 *   the exception rule; two of the three by Sam's own words. **One of them costs
 *   something and is flagged for him** — batch 26-e — because an athlete who
 *   lifted without logging weights now sees nothing rather than a reason.
 *
 *   OUT, -1 REPLACED. "Save note" became "Save" beside a narrower input.
 *
 *   IN, +2 THE EXTRACTOR CAN SEE. The band's "Load vs your normal" label and the
 *   drawer's "Your trends, charts and totals." Every other new string this slice
 *   authored is a template literal or a keyed object — the stat tile names, both
 *   earned cards, the niggle titles, the week label and the credit overflow —
 *   and they are listed in batch 26-c/26-d anyway, because the extractor's
 *   blindness is not a reason a word escapes a ruling.
 *
 * -6 -3 -1 +2 = -8. The app says less; the instrument did not change.
 *
 * Recorded as BATCH 26 before this commit landed, including its NINE
 * withdrawals — which is also why `copyRulingsBindingTests` grew a `WITHDRAWN:`
 * form this commit: the sheet had a way to record a string that CHANGED and no
 * way to record one that STOPPED.
 */
/**
 * 572 -> 573 (the signing session, same commit that earned it): a rise of ONE,
 * and it is a withdrawal being reversed rather than a new sentence.
 *
 *   IN, +1 RESTORED. "No lifts recorded with a weight this week." Batch 26
 *   retired it and 26-e flagged it as **the one withdrawal of nine that removed
 *   INFORMATION**; Sam's decision C3 put it back. So this is the -3 above
 *   becoming a -2, four hours later, by the owner's own ruling.
 *
 * NOTHING ELSE THIS COMMIT ADDED IS VISIBLE HERE, AND THAT IS MEASURED RATHER
 * THAN ASSUMED. The twelve month words (batch 27) sit in a `const` array, and
 * C2's reworded question is authored in `utils/sessionFeedbackForm.ts` — both
 * outside what this extractor reads. **Both are bound by
 * `copyRulingsBindingTests` instead, which is why that gate's count moved and
 * this one moved by exactly one.** Two instruments, two units; neither number
 * is the other's.
 *
 * THE SIGNING ITSELF MOVED THIS COUNT BY ZERO, WHICH IS THE POINT. Sam signing
 * eight constants lit the load band, the load tile and both earned cards — four
 * surfaces that had never rendered. **Not one of their words is new here**,
 * because 26-g listed every one of them while they were dark. A ceiling that had
 * jumped on the day of a signature would have meant unsigned words shipped on a
 * signature.
 */
/**
 * 573 -> 576 (the Monday notification, same commit that earned it): THREE
 * genuinely new sentences, all of them on the screen.
 *
 *   IN, +3 THE EXTRACTOR CAN SEE — the reminder offer's two lines ("Remind me
 *   on Monday mornings" / "One notification a week, when your week is ready to
 *   look back on.") and the confirmation once it is on.
 *
 * THE NOTIFICATION'S OWN TWO SENTENCES ARE NOT IN THIS NUMBER, and that is the
 * finding worth carrying rather than a footnote. "Last week" and "Your week is
 * in the Journal." are authored in `rules/journalReminderCopy.ts`, which this
 * extractor does not read — **so the one athlete-visible string in this app
 * that nobody will ever review by using the app is also the one this instrument
 * cannot see.** They are bound by `copyRulingsBindingTests` (the module joined
 * its authoring hatch this commit) and gated a third time by the provenance
 * check in the module itself, which refuses to schedule while they read
 * PROPOSED. Three readers, because the usual one — a person looking at a screen
 * — does not exist for a lock screen.
 */
/**
 * 576 -> 580 (the Christmas break, same commit that earned it): NINE genuinely
 * new strings on two files, and the ceiling moves FOUR because the extractor
 * counts distinct-per-file.
 *
 *   IN — the December and January questions (Sam's own words, item 31 part 5),
 *   the two card bodies, the two sheet bodies, the three buttons ("Pick the
 *   date", "Pick the day it is back", "We train through Christmas"), and the
 *   break's three modifier strings ("Team training is off", its sentence, and
 *   the reason label "No team training").
 *
 * **THE NUMBER WAS ATTRIBUTED, NOT ASSUMED, AND THAT MATTERED HERE.** This
 * checkout is shared with another agent who was editing copy files in the same
 * hours. Measured in a detached worktree at HEAD (571), then again with ONLY
 * this unit's two clean files copied in: 580. The other agent's copy work
 * contributes ZERO to this count, so all nine belong to this commit and none of
 * their words are being waved through under this justification.
 *
 * ALL NINE ARE PROPOSED IN COPY SHEET BATCH 35 and bound by
 * `copyRulingsBindingTests`, which asserts each one is actually on the surface.
 * Two of them are Sam's verbatim; the other seven are drafts awaiting him. The
 * ceiling rises because the words are NEW, not because they are approved.
 */
const ATHLETE_VISIBLE_GAP_CEILING = 580;

console.log('\n-- Signed copy extraction (Sam ruling 2: sheet and gaps) --');

const extracted = extract();

/**
 * THE SET IS DERIVED FROM THE DIRECTORY, NOT NAMED — widened 2026-08-09.
 *
 * This cell asserted the double gate for `ScheduleDebugPanel` BY NAME, while
 * the `components/dev/` OFF_SHEET prefix above excludes **every file in that
 * directory**. So the moment a second dev component arrived, its strings would
 * have been excluded from the sheet by a prefix whose justification — "double
 * gated, asserted below" — was not true of it. **The exclusion would have been
 * a lie and the cell would have gone on passing**, which is
 * `a green gate watching nothing` at the seam between two gates rather than
 * inside one.
 *
 * It is the same compression this file already applied to SURFACE_ROOTS and the
 * binder applied to its scope: **derive the set from the tree.** A new dev
 * component is now gated the day it appears rather than the day somebody
 * notices.
 */
function devComponentsOnDisk(): string[] {
  const dir = path.join(SRC, 'components/dev');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.tsx'));
}

/** Every file that could render a dev component, so the host need not be named. */
function possibleHosts(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    const full = path.join(SRC, dir);
    if (!fs.existsSync(full)) return;
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith('.tsx')) {
        out.push({ file: rel, text: fs.readFileSync(path.join(SRC, rel), 'utf8') });
      }
    }
  };
  ['screens', 'components', 'navigation'].forEach(walk);
  return out;
}

run('every dev component excluded from the sheet is genuinely unreachable', () => {
  // Sam's instruction: verify, do not assume. Both gates must hold for EACH of
  // them, or their strings are athlete vocabulary and the exclusion is a lie.
  const components = devComponentsOnDisk();
  assert(components.length > 0,
    'no dev components found — the OFF_SHEET prefix for components/dev/ is now '
    + 'excluding nothing, and should be removed rather than left as decoration');

  const hosts = possibleHosts();
  const offences: string[] = [];
  for (const file of components) {
    const name = file.replace(/\.tsx$/, '');
    // THE REQUIRE SITE — proven present before anything is claimed about it.
    // An `indexOf`-style search that found nothing would otherwise compare
    // perfectly well against nothing (AGENTS.md, the anchoring law).
    const requireSite = new RegExp(`const ${name} = __DEV__`);
    // BOTH RENDER SHAPES ARE ACCEPTED, and that is deliberate rather than lax.
    // `{__DEV__ && X && <X/>}` and `{__DEV__ && X ? <X/> : null}` gate
    // identically; a regex that knew only the first would RED on correct code,
    // and a false red is how a gate gets weakened by whoever next has to make
    // it pass. What is still required is `__DEV__ &&` immediately before the
    // name — an ungated `{X && <X/>}` fails either way.
    const renderSite = new RegExp(`\\{__DEV__ && ${name}\\s*[&?]`);
    const requiredIn = hosts.filter((h) => requireSite.test(h.text));
    const renderedIn = hosts.filter((h) => renderSite.test(h.text));

    if (requiredIn.length === 0) {
      offences.push(`${name}: no __DEV__-gated require site found in any surface`);
    }
    if (renderedIn.length === 0) {
      offences.push(`${name}: no __DEV__-gated render site found in any surface`);
    }
  }
  assert(offences.length === 0,
    'a component under components/dev/ is not double-gated, so it ships and its '
    + `strings belong on the sheet:\n        ${offences.join('\n        ')}`);
  console.log(`      dev components double-gated: ${components.length}`);
});

run('scope is DERIVED from the tree, so a new surface cannot be invisible', () => {
  // THE CELL THAT WOULD HAVE CAUGHT THE JOURNAL. `screens/journal` shipped a
  // screenful of prose while the extractor looked at a hand-written list of two
  // sibling directories and reported PASS.
  //
  // It asserts EQUALITY, not membership: every directory that exists under
  // `screens/` must be scanned, and nothing may be scanned that is not on disk.
  // A future edit that replaces the roots with an enumerated list reds here,
  // which is the point — the defect was the enumeration, not the entries.
  const onDisk = fs.readdirSync(path.join(SRC, 'screens'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `screens/${entry.name}`)
    .sort();
  assert(onDisk.length > 1, `only ${onDisk.length} screen directories found — the read is broken`);

  const scanned = new Set(surfaceFiles().map((file) => file.split('/').slice(0, 2).join('/')));
  const unscanned = onDisk.filter((dir) => !scanned.has(dir)
    && !OFF_SHEET.some(({ prefix }) => dir.startsWith(prefix) || prefix.startsWith(dir)));
  assert(unscanned.length === 0,
    `these screen directories exist but no file in them is scanned: ${unscanned.join(', ')}. `
    + 'Every athlete-facing surface is in scope by default — if one genuinely is not '
    + 'athlete-visible, add it to OFF_SHEET with a reason rather than leaving it unseen.');
});

run('every OFF_SHEET exclusion names a real path and gives a reason', () => {
  // An exclusion is a claim. A stale one protects nothing and would silently
  // start protecting something else if the directory name were reused.
  for (const { prefix, why } of OFF_SHEET) {
    assert(fs.existsSync(path.join(SRC, prefix)),
      `OFF_SHEET excludes '${prefix}', which does not exist — remove the stale exclusion`);
    assert(why.trim().length > 20,
      `OFF_SHEET entry '${prefix}' has no real reason recorded`);
  }
});

run('the extraction finds athlete-visible prose', () => {
  // Non-vacuity. A broken regex would report a beautifully clean app.
  assert(extracted.length > 50,
    `the extractor found only ${extracted.length} athlete-visible strings across `
    + `${SURFACE_ROOTS.join(', ')} — it is broken, not the app clean`);
});

run('the sheet is written for Sam to rule on', () => {
  const artifacts = path.join(__dirname, '..', '..', 'artifacts');
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });
  const byFile = new Map<string, ExtractedString[]>();
  for (const item of extracted) {
    const list = byFile.get(item.file) ?? [];
    list.push(item);
    byFile.set(item.file, list);
  }
  const sheet = {
    __what: 'Every athlete-visible string on a surface, for Sam to rule the gaps.',
    __ruling: "Sam 2026-07-30: extract into one sheet, mark what traces to an authored source, Sam rules only the gaps (load-ratio-session precedent). Nothing ships as SignedCopy without a traced source or a ruling.",
    __status: 'GAPS UNRULED — none of these is SignedCopy yet.',
    __totals: { strings: extracted.length, files: byFile.size, signedSoFar: signedCopyRegistrySize() },
    byFile: Object.fromEntries(
      Array.from(byFile.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .map(([file, items]) => [file, items.map((i) => ({ line: i.line, field: i.field, text: i.text }))]),
    ),
  };
  const out = path.join(artifacts, 'athlete-visible-copy-sheet.json');
  fs.writeFileSync(out, JSON.stringify(sheet, null, 2));
  assert(fs.existsSync(out), 'the copy sheet was not written');
  console.log(`      sheet: artifacts/athlete-visible-copy-sheet.json `
    + `(${extracted.length} strings across ${byFile.size} files)`);
});

run('SignedCopy cannot be produced from free text', () => {
  // THE STRUCTURAL CLAIM THE WHOLE DESIGN RESTS ON. If an unsigned id yielded a
  // string, `allocation.focus` would reach a headline again and the branded type
  // would be decoration. Asserted at runtime as well as in the type system,
  // because a cast can defeat the type and nothing can defeat this.
  let threw: unknown = null;
  try {
    signedCopy('definitely.not.in.the.sheet');
  } catch (error) { threw = error; }
  assert(threw instanceof UnsignedCopyError,
    `signedCopy() returned a value for an unsigned id (threw: ${String(threw)}) — `
    + 'the sheet is not the only source of athlete-facing words');

  // And a registered entry does produce one, or the constructor is useless.
  registerSignedCopy([{
    id: 'extraction.self_test',
    source: 'sam_ruling',
    provenance: 'signedCopyExtractionTests self-test; not athlete-facing',
    text: 'Self test {count}.',
  }]);
  assert(signedCopy('extraction.self_test', { count: 2 }) === 'Self test 2.',
    'a registered entry did not render its authored template');
});

run('the athlete-visible gap count only goes down', () => {
  assert(extracted.length <= ATHLETE_VISIBLE_GAP_CEILING,
    `athlete-visible unauthored strings rose to ${extracted.length}, above the `
    + `ceiling of ${ATHLETE_VISIBLE_GAP_CEILING}. A surface has added words the `
    + 'athlete can read that nobody authored. Move them onto signed copy, or '
    + 'lower nothing and justify raising the ceiling.');
});

console.log(`\nSigned copy extraction totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log(`  athlete-visible strings: ${extracted.length} distinct-per-file across `
  + `${new Set(extracted.map((e) => e.file)).size} files (ceiling ${ATHLETE_VISIBLE_GAP_CEILING}); `
  + `${new Set(extracted.map((e) => e.text)).size} distinct app-wide`);
console.log(`  signed so far: ${signedCopyRegistrySize()}`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
