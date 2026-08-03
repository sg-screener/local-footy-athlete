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

/** The surfaces the athlete actually reads. Prose anywhere here is in scope. */
const SURFACE_DIRS = [
  'screens/home',
  'screens/coach',
  'components',
];

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
 */
const OFF_SHEET_DEV_ONLY = ['components/dev/'];

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

function extract(): ExtractedString[] {
  const found: ExtractedString[] = [];
  const fieldPattern = new RegExp(
    `\\b(${VISIBLE_FIELDS.join('|')})\\s*[:=]\\s*(['"\`])((?:\\\\.|(?!\\2).)*)\\2`,
    'g',
  );
  for (const file of walkFiles('')) {
    if (!SURFACE_DIRS.some((dir) => file.startsWith(dir))) continue;
    if (OFF_SHEET_DEV_ONLY.some((dir) => file.startsWith(dir))) continue;
    const source = fs.readFileSync(path.join(SRC, file), 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      let match: RegExpExecArray | null;
      fieldPattern.lastIndex = 0;
      while ((match = fieldPattern.exec(line)) !== null) {
        const [, field, , text] = match;
        if (!looksLikeProse(text)) continue;
        found.push({ file, line: index + 1, field, text });
      }
      // JSX text children: >Some words<
      const jsx = /^[^<>{}]*>([^<>{}]{4,})<\//.exec(line.trim());
      if (jsx && looksLikeProse(jsx[1].trim())) {
        found.push({ file, line: index + 1, field: 'jsx_text', text: jsx[1].trim() });
      }
    });
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
const ATHLETE_VISIBLE_GAP_CEILING = 141;

console.log('\n-- Signed copy extraction (Sam ruling 2: sheet and gaps) --');

const extracted = extract();

run('the dev panel excluded from the sheet is genuinely unreachable', () => {
  // Sam's instruction: verify, do not assume. Both gates must hold, or those 13
  // strings are athlete vocabulary and the exclusion above is a lie.
  const host = fs.readFileSync(path.join(SRC, 'screens/home/HomeScreen.tsx'), 'utf8');
  assert(/const ScheduleDebugPanel = __DEV__/.test(host),
    'ScheduleDebugPanel is no longer __DEV__-gated at its require site — it now '
    + 'ships, so its strings are athlete-visible and belong on the sheet');
  assert(/\{__DEV__ && ScheduleDebugPanel &&/.test(host),
    'ScheduleDebugPanel is no longer __DEV__-gated at its render site');
});

run('the extraction finds athlete-visible prose', () => {
  // Non-vacuity. A broken regex would report a beautifully clean app.
  assert(extracted.length > 50,
    `the extractor found only ${extracted.length} athlete-visible strings across `
    + `${SURFACE_DIRS.join(', ')} — it is broken, not the app clean`);
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
console.log(`  athlete-visible strings found: ${extracted.length} (ceiling ${ATHLETE_VISIBLE_GAP_CEILING})`);
console.log(`  signed so far: ${signedCopyRegistrySize()}`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
