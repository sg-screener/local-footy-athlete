/**
 * Exercise-name ownership boundary (Part B / Stage 3, B5 §7).
 *
 * The curated layer owns every athlete-visible word; generation provides
 * structure only. Every athlete-visible reader canonicalises an exercise name
 * onto Sam's vocabulary FIRST (canonicalExerciseName), so an off-vocabulary
 * spelling from the AI backend ("Farmers Carry") can never silently fall through
 * to a generic cue or drop its load anchor.
 *
 * The four B5.7 boundary tests + the "Farmers Carry" regression fixture:
 *   1. Vocabulary-closure — every prescribable name lands on a curated cue key.
 *   2. No-generic-in-product — no prescribable exercise renders the generic cue.
 *   3. Anchor-resolves — every loaded exercise keeps a load profile.
 *   4. Ordering — the curated cue is the always-visible lead; generator
 *      per-exercise notes are not rendered.
 *
 * Run: npm run test:exercise-canonicalisation
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';
import { EXERCISE_CUES, getExerciseCue } from '../data/exerciseCues';
import { CONDITIONING_META } from '../data/exerciseTags';
import { MOBILITY_POOL, POOL_REGISTRY } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import {
  resolveLoadAuthority,
  EXERCISE_LOAD_MAP,
  isTrueBodyweightExercise,
  isAthleteChosenLoadExercise,
  resolveExerciseName,
} from '../utils/loadEstimation';
import {
  canonicalExerciseName,
  hasCuratedCue,
  collectUnresolvedCues,
  assertCuratedExerciseCues,
  ExerciseVocabularyViolation,
  signatureTokens,
  EQUIPMENT_QUALIFIER_TOKENS,
  POSITION_QUALIFIER_TOKENS,
} from '../utils/exerciseCanonicalisation';
import { isExempt } from '../data/selectableExerciseVocabulary';
import { buildCueText } from '../screens/home/dayWorkoutHelpers';
import {
  cuelessSessionCards,
  cuelessStrengthCards,
  enforceCuratedAddonCueContract,
  enforceCuratedCueContract,
} from '../rules/curatedCueContract';
import { recoveryAddonExerciseVocabulary } from '../utils/recoveryAddonBuilder';

const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/** Every exercise the app can actually prescribe (mirrors authoredCueLibraryTests). */
function poolExerciseNames(): string[] {
  const names = new Set<string>();
  for (const pool of Object.values(POOL_REGISTRY)) {
    for (const entry of pool) names.add(entry.name);
  }
  for (const slot of Object.values(STRENGTH_POOLS)) {
    for (const definition of [slot.anchor, slot.accessory]) {
      for (const entry of definition.entries) names.add(entry.name);
    }
  }
  return [...names].sort();
}

/** Pluralise a curated key's final word — the shape a generator actually emits. */
function pluralise(key: string): string {
  return key.replace(/([A-Za-z]+)$/, (word) => (/s$/i.test(word) ? word : `${word}s`));
}

const GENERIC_PRIMARY = 'Control the movement.';
const GENERIC_SECONDARY = 'Stay tight through the full range.';
const pool = poolExerciseNames();

console.log('\n[1] Vocabulary-closure — every prescribable name lands on a curated cue key');
{
  const unresolved = pool.filter((name) => !EXERCISE_CUES[canonicalExerciseName(name)]);
  ok('every prescribable exercise canonicalises to a curated cue key', unresolved.length === 0,
    `no curated key via the boundary: ${unresolved.join(', ')}`);
}

console.log('\n[2] No-generic-in-product — the generic cue is unreachable for prescribable exercises');
{
  const generic = pool.filter((name) => {
    const cue = getExerciseCue(canonicalExerciseName(name));
    return cue.primaryCue === GENERIC_PRIMARY && cue.secondaryCue === GENERIC_SECONDARY;
  });
  ok('no prescribable exercise renders the generic fallback cue', generic.length === 0,
    `fell through to generic: ${generic.join(', ')}`);

  // The stronger product guarantee: buildCueText NEVER returns the generic
  // filler — for a pool name, a non-pool defaultProgram fallback, or an
  // off-vocabulary AI-backend name, it returns a curated cue or nothing.
  const genericText = `${GENERIC_PRIMARY} ${GENERIC_SECONDARY}`;
  const offVocabulary = ['Mobility Flow', 'Hamstring Curl', 'Zerg Rush Deadlift', 'Some Made Up Move'];
  const leaked = [...pool, ...offVocabulary].filter((name) => buildCueText(name) === genericText);
  ok('buildCueText never renders the generic filler (curated cue or none)', leaked.length === 0,
    `buildCueText returned generic for: ${leaked.join(', ')}`);
}

console.log('\n[3] Anchor-resolves — every loaded exercise keeps a load profile');
{
  // Asked of the AUTHORITY, not of the individual sets.
  //
  // This used to enumerate the honest answers by hand — a load-map entry, or
  // bodyweight, then `athlete_chosen` was bolted on as "a third honest answer".
  // Sam's 2026-07-28 ruling added a fourth (`equipment_minimum`, for exercises
  // that prescribe the lightest loadable weight rather than a ratio), and this
  // assertion failed for four exercises that are correctly and explicitly
  // handled — the list of answers had drifted from the resolver that owns them.
  //
  // `resolveLoadAuthority` IS that list. Asking it means a fifth answer needs no
  // edit here, and an exercise nothing covers still fails, which is the actual
  // thing being asserted.
  const unloaded = pool
    .filter((name) => !CONDITIONING_META[name])
    // Sam rules on the locked list's loaded additions line by line; until he
    // does, their ratio is deliberately absent. The typed `load_ruling_pending`
    // exemption is the single record of that queue — see
    // src/data/selectableExerciseVocabulary.ts.
    .filter((name) => !isExempt(name, 'load'))
    .filter((name) => resolveLoadAuthority(name).kind === 'unauthored');
  ok('every loaded exercise resolves a load authority', unloaded.length === 0,
    `no authored load handling: ${unloaded.join(', ')}`);
}

console.log('\n[4] Ownership — the curated cue is the ONLY source of a row\'s coaching text');
{
  const screen = fs.readFileSync(path.join(src, 'screens/home/DayWorkoutScreenV2.tsx'), 'utf8');
  ok(
    'the strength/recovery cards no longer render generator per-exercise notes',
    !/styles\.exerciseNotes/.test(screen.replace(/exerciseNotes:\s*\{[\s\S]*?\},/, '')),
    'exercise.notes (styles.exerciseNotes) must not be rendered on the session screen',
  );
  // SUPERSEDED 2026-07-27 (Sam, run-7 ruling 2). This assertion used to require
  // the cue be ALWAYS VISIBLE, never behind a "Form cues" disclosure. That rule
  // existed for one reason: AI-generated per-exercise notes were rendering
  // alongside the curated cue, and a collapsed cue would have let the generator's
  // words outrank Sam's. The AI notes are dead — assertion 1 above is what keeps
  // them dead — so the reason is gone, and what is left is noise on every row.
  // The cue is now collapsed by default behind a tappable disclosure.
  //
  // The ownership guarantee is UNCHANGED and is what this section still pins:
  // whatever coaching text a row shows comes from EXERCISE_CUES via
  // canonicalisation. Collapsed or expanded is a presentation ruling; the source
  // of the words is the invariant.
  ok(
    'the cue is collapsed behind a "Form cues" disclosure, not always visible',
    /Form cues/.test(screen) &&
      !/cueText \? <Text style=\{styles\.cueText\}>\{cueText\}<\/Text>/.test(screen),
    'run-7 ruling 2 supersedes the always-visible rule — see the comment above',
  );
  ok(
    'the superseded note-gated CueToggle is retired, not left beside the new one',
    !/function CueToggle\b/.test(screen),
    'two disclosure implementations is how the always-visible rule got contradicted in-file',
  );
  ok(
    'one shared disclosure owns the behaviour — strength, recovery and add-on rows alike',
    (screen.match(/<CueDisclosure/g) ?? []).length >= 3,
    'a per-row reimplementation is how the two layers drifted apart last time',
  );
  ok(
    'buildCueText canonicalises before lookup',
    /canonicalExerciseName\(exerciseName\)/.test(
      fs.readFileSync(path.join(src, 'screens/home/dayWorkoutHelpers.ts'), 'utf8')),
  );
}

console.log('\n[5] "Farmers Carry" regression fixture (the AI-backend spelling)');
{
  ok('canonicalExerciseName("Farmers Carry") === "Farmer Carry"',
    canonicalExerciseName('Farmers Carry') === 'Farmer Carry',
    `got ${JSON.stringify(canonicalExerciseName('Farmers Carry'))}`);
  ok('the possessive form resolves too',
    canonicalExerciseName("Farmer's Carry") === 'Farmer Carry');
  ok('"Farmers Carry" has a curated cue (not generic)',
    hasCuratedCue('Farmers Carry'));
  ok('buildCueText("Farmers Carry") equals the curated Farmer Carry cue',
    buildCueText('Farmers Carry') === buildCueText('Farmer Carry') &&
    buildCueText('Farmers Carry') !== `${GENERIC_PRIMARY} ${GENERIC_SECONDARY}`,
    `got ${JSON.stringify(buildCueText('Farmers Carry'))}`);
  ok('resolveExerciseName("Farmers Carry") keeps the curated load anchor',
    Boolean(EXERCISE_LOAD_MAP[resolveExerciseName('Farmers Carry')]),
    `resolved to ${JSON.stringify(resolveExerciseName('Farmers Carry'))}`);
}

console.log('\n[6] Token-order & abbreviation variants resolve (run-3 cue coverage hole)');
{
  // The reported hole: "single-arm half-kneeling OHP" rendered cueless because
  // the whole-string alias table cannot match a reordered/abbreviated spelling.
  // The ingress boundary must be TOTAL — a token-normalised signature so word
  // order and in-compound abbreviations collapse onto the one curated key.
  const CANON = 'Half-Kneeling Single-Arm Overhead Press';
  ok('the reported variant resolves to the curated key',
    canonicalExerciseName('single-arm half-kneeling OHP') === CANON,
    `got ${JSON.stringify(canonicalExerciseName('single-arm half-kneeling OHP'))}`);
  ok('...and therefore has a curated cue (never a silent cueless card)',
    hasCuratedCue('single-arm half-kneeling OHP'));
  ok('...and buildCueText matches the canonical cue',
    buildCueText('single-arm half-kneeling OHP') === buildCueText(CANON) &&
    buildCueText('single-arm half-kneeling OHP') !== null,
    `got ${JSON.stringify(buildCueText('single-arm half-kneeling OHP'))}`);

  for (const variant of [
    'Single Arm Half Kneeling Overhead Press',   // spaces for hyphens
    'half-kneeling SA OHP',                       // both abbreviations
    'Press Overhead Single-Arm Half-Kneeling',    // full reorder
  ]) {
    ok(`variant "${variant}" resolves to the curated key`,
      canonicalExerciseName(variant) === CANON,
      `got ${JSON.stringify(canonicalExerciseName(variant))}`);
  }

  // The general invariant (not one phrase): every curated key resolves from a
  // word-order permutation of itself. This also guards against signature
  // collisions — a permuted key that resolved to a DIFFERENT curated key would
  // fail here.
  const curatedKeys = Object.keys(EXERCISE_CUES);
  const orderBroken = curatedKeys.filter((key) => {
    const reordered = key.split(/[\s-]+/).filter(Boolean).reverse().join(' ');
    return canonicalExerciseName(reordered) !== key;
  });
  ok('every curated key resolves from a word-order permutation of itself',
    orderBroken.length === 0,
    `did not resolve reordered: ${orderBroken.slice(0, 12).join(' | ')}`);
}

console.log('\n[7] Generation contract — an unresolved name is loud, never a silent cueless card');
{
  ok('a genuinely unknown name is reported unresolved',
    JSON.stringify(collectUnresolvedCues(['Zerg Rush Deadlift'])) === JSON.stringify(['Zerg Rush Deadlift']));
  ok('a resolved (even reordered/abbreviated) name is NOT reported',
    collectUnresolvedCues(['single-arm half-kneeling OHP', 'Hip Thrusts']).length === 0,
    `unexpected: ${collectUnresolvedCues(['single-arm half-kneeling OHP', 'Hip Thrusts']).join(', ')}`);
  ok('assertCuratedExerciseCues throws ExerciseVocabularyViolation on an unresolved name', (() => {
    try { assertCuratedExerciseCues(['Some Made Up Move'], 'unit'); return false; }
    catch (e) { return e instanceof ExerciseVocabularyViolation; }
  })());
  ok('assertCuratedExerciseCues passes clean input', (() => {
    try { assertCuratedExerciseCues(['Hip Thrusts', 'Trap Bar Deadlift'], 'unit'); return true; }
    catch { return false; }
  })());
  // The deterministic pool corpus never trips the contract — proves the
  // acceptance wiring cannot brick a normally-generated program.
  ok('no pool exercise trips the contract',
    collectUnresolvedCues(pool).length === 0,
    `pool names without a curated cue: ${collectUnresolvedCues(pool).slice(0, 12).join(', ')}`);
}

console.log('\n[8] Runtime invariant — scoped to the render truth (cued strength cards only)');
{
  // The contract is scoped by the SAME partition the screen renders with
  // (getSessionComponentRows): only rows that become a cued StrengthExerciseCard
  // are checked. Conditioning / recovery sessions have no strength rows, so their
  // freeform "Speed warm-up" / "Brisk Walking" text is exempt by render path, not
  // by a name allow-list. Predicate is buildCueText === null (a family-fallback
  // cue still counts), so only a genuinely blank card is a violation.
  const strengthWk: any = { workoutType: 'Strength', exercises: [
    { id: 'a', exercise: { name: 'Back Squat' } },                    // cued
    { id: 'b', exercise: { name: 'single-arm half-kneeling OHP' } },  // reordered/abbrev → cued
    { id: 'c', exercise: { name: 'Some Made Up Move' } },             // genuinely cueless
  ] };
  const recoveryWk: any = { workoutType: 'Recovery', sessionTier: 'recovery',
    exercises: [{ id: 'd', exercise: { name: 'Brisk Walking' } }] };
  const conditioningWk: any = { workoutType: 'Conditioning',
    exercises: [{ id: 'e', exercise: { name: 'Speed warm-up' } }] };

  ok('a cueless strength card is flagged; cued (incl. reordered/abbrev) are not',
    JSON.stringify(cuelessStrengthCards(strengthWk)) === JSON.stringify(['Some Made Up Move']),
    `got ${JSON.stringify(cuelessStrengthCards(strengthWk))}`);
  ok('conditioning freeform text is exempt by render path (no strength rows)',
    cuelessStrengthCards(conditioningWk).length === 0);
  ok('recovery freeform text is exempt by render path (no strength rows)',
    cuelessStrengthCards(recoveryWk).length === 0);
  // Sam ruling (device run 5): a name that renders no cue is a LOUD
  // generation-contract violation, never a silent cueless card. The previous
  // non-throwing `logger.error` contradicted that ruling — a violation was
  // OBSERVED at render instead of ENFORCED at acceptance, and three superset
  // variants shipped to the device as blank cards. The invariant now refuses.
  ok('enforceCuratedCueContract THROWS on a cueless strength card (enforced, not observed)', (() => {
    try { enforceCuratedCueContract([strengthWk, recoveryWk, conditioningWk], 'unit'); return false; }
    catch (e) { return e instanceof ExerciseVocabularyViolation; }
  })());
  ok('...and the violation names the offending exercise', (() => {
    try { enforceCuratedCueContract([strengthWk], 'unit'); return false; }
    catch (e) {
      return e instanceof ExerciseVocabularyViolation
        && e.unresolved.length === 1
        && e.unresolved[0] === 'Some Made Up Move';
    }
  })());
  ok('a fully-cued week passes acceptance untouched', (() => {
    const cleanWk: any = { workoutType: 'Strength', exercises: [
      { id: 'a', exercise: { name: 'Back Squat' } },
      { id: 'b', exercise: { name: 'single-arm half-kneeling OHP' } },
    ] };
    try { enforceCuratedCueContract([cleanWk, recoveryWk, conditioningWk], 'unit'); return true; }
    catch { return false; }
  })());
}

console.log('\n[9] Plural normalisation — a pluralised spelling is the same movement');
{
  // Device run-5 truth: the generator emitted "Hamstring Curls" and the ingress
  // boundary reported it cueless, because plurals were only handled ad-hoc by
  // whole-string aliases ("Chest Supported Rows" happened to be aliased,
  // "Barbell Rows" was not). Number is not part of a movement's identity, so it
  // is normalised in the token signature — symmetrically on both sides.
  ok('the reported name resolves', canonicalExerciseName('Hamstring Curls') === 'Hamstring Curl',
    `got ${JSON.stringify(canonicalExerciseName('Hamstring Curls'))}`);
  for (const [variant, canon] of [
    ['Barbell Rows', 'Barbell Row'],
    ['Single-Arm DB Rows', 'Single-Arm DB Row'],
    ['Goblet Squats', 'Goblet Squat'],
    ['Nordic Lowers', 'Nordic Lower'],
  ] as const) {
    ok(`"${variant}" resolves to "${canon}"`, canonicalExerciseName(variant) === canon,
      `got ${JSON.stringify(canonicalExerciseName(variant))}`);
  }
  // The plural of a curated key must never be a word that IS singular already:
  // "Press", "Cross", "Dips" must survive normalisation intact.
  ok('an -ss word is not mangled into a false singular',
    canonicalExerciseName('Overhead Press') === 'Overhead Press' &&
    canonicalExerciseName('Bench Press') === 'Bench Press');

  // The general invariant, not the three reported phrases: pluralising ANY
  // curated key still lands on a curated cue.
  const curatedKeys = Object.keys(EXERCISE_CUES);
  const pluralBroken = curatedKeys.filter((key) => !hasCuratedCue(pluralise(key)));
  ok('every curated key still resolves when pluralised', pluralBroken.length === 0,
    `pluralised form went cueless: ${pluralBroken.slice(0, 12).map(pluralise).join(' | ')}`);
}

console.log('\n[10] Bounded superset matching — equipment/position qualifiers are droppable');
{
  // Device run-5 truth: the generator emitted qualifier-decorated supersets of
  // curated keys — "Single Arm Half Kneeling OHP (DB)" and "Incline DB Row
  // (Chest Supported)". Token-sort EQUALITY can never match a superset, so both
  // rendered blank. The boundary now drops equipment/position qualifier tokens,
  // fewest first, and adopts the result ONLY when the remainder resolves to
  // exactly one curated key — bounded, so an ambiguous name still refuses.
  ok('"Single Arm Half Kneeling OHP (DB)" resolves (equipment qualifier dropped)',
    canonicalExerciseName('Single Arm Half Kneeling OHP (DB)') === 'Half-Kneeling Single-Arm Overhead Press',
    `got ${JSON.stringify(canonicalExerciseName('Single Arm Half Kneeling OHP (DB)'))}`);
  ok('"Incline DB Row (Chest Supported)" resolves to the DB row, not the generic row',
    canonicalExerciseName('Incline DB Row (Chest Supported)') === 'Chest-Supported DB Row',
    `got ${JSON.stringify(canonicalExerciseName('Incline DB Row (Chest Supported)'))}`);
  ok('...all three run-5 device names now carry a cue',
    collectUnresolvedCues([
      'Single Arm Half Kneeling OHP (DB)',
      'Incline DB Row (Chest Supported)',
      'Hamstring Curls',
    ]).length === 0,
    `still unresolved: ${collectUnresolvedCues([
      'Single Arm Half Kneeling OHP (DB)',
      'Incline DB Row (Chest Supported)',
      'Hamstring Curls',
    ]).join(', ')}`);

  // Bounded, not open-ended: a name whose remainder is not a curated key stays
  // unresolved, so superset-matching can never invent a cue for a real gap.
  ok('a non-qualifier superset does NOT match (bounded)',
    !hasCuratedCue('Barbell Zercher Front Squat Cluster'),
    `unexpectedly resolved to ${JSON.stringify(canonicalExerciseName('Barbell Zercher Front Squat Cluster'))}`);
  ok('dropping qualifiers off an unknown movement still refuses',
    !hasCuratedCue('Incline DB Zerg Rush'));

  // A CONTRADICTORY decoration must still refuse. "Banded Bicep Curl (DB)"
  // names two different implements, and both "Banded Bicep Curl" and "Bicep
  // Curl (Dumbbell)" are one shed away — genuine ambiguity. Guessing one would
  // be exactly the silent-wrong-cue failure this boundary exists to prevent, so
  // the name stays unresolved and the acceptance gate refuses it.
  ok('a contradictory equipment decoration refuses rather than guessing',
    !hasCuratedCue('Banded Bicep Curl (DB)'),
    `resolved to ${JSON.stringify(canonicalExerciseName('Banded Bicep Curl (DB)'))}`);
  ok('a contradictory position decoration refuses rather than guessing',
    !hasCuratedCue('Incline Lying Dumbbell Curl'),
    `resolved to ${JSON.stringify(canonicalExerciseName('Incline Lying Dumbbell Curl'))}`);

  // The general invariant: decorating any curated key that does NOT already
  // name an implement / position with that class of qualifier keeps it cued.
  const curatedKeys = Object.keys(EXERCISE_CUES);
  const carries = (key: string, tokens: ReadonlySet<string>) =>
    signatureTokens(key).some((token) => tokens.has(token));

  const equipmentBroken = curatedKeys
    .filter((key) => !carries(key, EQUIPMENT_QUALIFIER_TOKENS))
    .filter((key) => !hasCuratedCue(`${key} (DB)`));
  ok('every implement-free curated key survives an appended equipment qualifier',
    equipmentBroken.length === 0,
    `went cueless with "(DB)": ${equipmentBroken.slice(0, 12).join(' | ')}`);

  const positionBroken = curatedKeys
    .filter((key) => !carries(key, POSITION_QUALIFIER_TOKENS))
    .filter((key) => !hasCuratedCue(`Incline ${key}`));
  ok('every position-free curated key survives a prepended position qualifier',
    positionBroken.length === 0,
    `went cueless with "Incline": ${positionBroken.slice(0, 12).join(' | ')}`);
}

console.log('\n[11] The builder-inline text class — add-on and flow rows source from EXERCISE_CUES');
{
  // Sam's run-7 ruling 3, and the found instance:
  // `recoveryAddonBuilder.ts:544` shipped `exercise('Seated Calf Raise', '2 x 10-15',
  // 'Quiet tempo, no bouncing.')`. That string reached the athlete's screen having
  // never passed through Sam's cue library — a second, invisible authoring surface
  // sitting beside the curated one. (The curated Seated Calf Raise cue already ends
  // "Slow tempo, no bouncing." — the inline string was a paraphrase of the very cue
  // it was displacing.)
  //
  // The class is killed by CONSTRUCTION, not by deleting fifteen strings: the
  // `notes` field is gone from `RecoveryAddonExercise`, and the whole
  // `MobilityFlowMovement` type went with the flow bundles on 2026-07-30 — along
  // with `localMeta`, which had let a flow movement ship its own name AND its own
  // text, bypassing the vocabulary entirely. A field that does not exist cannot be
  // repopulated by a future patch, and neither can a module.
  // Comments stripped throughout: retiring a channel means retiring the CODE,
  // and the prose that records why necessarily quotes what it retired.
  const codeOf = (relative: string): string =>
    fs.readFileSync(path.join(src, relative), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  const builder = codeOf('utils/recoveryAddonBuilder.ts');
  const domain = codeOf('types/domain.ts');

  ok(
    'the found instance is gone',
    !/Quiet tempo, no bouncing/.test(builder),
    'recoveryAddonBuilder:544',
  );
  ok(
    'the builder\'s exercise() helper can no longer carry a note argument',
    /function exercise\(name: string, prescription: string\): RecoveryAddonExercise/.test(builder),
    'the third parameter IS the channel — removing it retires every call site at once',
  );
  ok(
    'RecoveryAddonExercise has no notes field left to populate',
    /export interface RecoveryAddonExercise \{[^}]*\}/.test(domain) &&
      !/export interface RecoveryAddonExercise \{[^}]*notes/.test(domain),
  );
  ok(
    'the flow-bundle module is gone, and with it notes and localMeta',
    !fs.existsSync(path.join(src, 'data/mobilityFlowTemplates.ts')),
    'localMeta let a movement bypass the curated vocabulary with its own text; the '
      + 'module that carried it is retired, not merely emptied',
  );

  // The positive half: everything those rows can name must actually HAVE curated
  // text, or retiring the inline strings would have traded uncurated text for no
  // text. Swept over the real content, not a fixture.
  // The composed flow draws from MOBILITY_POOL, so the sweep is over the pool the
  // draw can reach rather than over ten groupings of it. Strictly wider: a bundle
  // only ever named a subset.
  const cuelessFlow = MOBILITY_POOL
    .map((entry) => entry.name)
    .filter((name) => buildCueText(name) === null);
  ok(
    'every composable mobility movement resolves a curated cue',
    cuelessFlow.length === 0,
    `no curated cue: ${cuelessFlow.join(', ')}`,
  );

  // The vocabulary is enumerated BY RUNNING the builder over its whole decision
  // space, not by copying its names into this file. A second list is the thing
  // that drifts — that lesson is already paid for (see the coach-chat second
  // vocabulary list, retired in `3639841`).
  const addonVocabulary = recoveryAddonExerciseVocabulary();
  ok(
    'the enumerator actually reaches the builder\'s content',
    addonVocabulary.length >= 10,
    `only found ${addonVocabulary.length} names`,
  );
  const cuelessAddon = addonVocabulary.filter((name) => buildCueText(name) === null);
  ok(
    'every add-on exercise the builder can emit resolves a curated cue',
    cuelessAddon.length === 0,
    `no curated cue: ${cuelessAddon.join(', ')}`,
  );
}

console.log('\n[12] The invariant extends to add-on rows — the class cannot return');
{
  // `enforceCuratedCueContract` ran inside `buildWorkoutsFromCoach`, which
  // completes BEFORE `attachRecoveryAddonsToWeek` wraps its output — so add-on
  // rows were invisible to it. Extending the same predicate over them is what
  // makes "no uncurated text" true of the whole session rather than of the
  // strength rows only.
  const withCuedAddon: any = {
    workoutType: 'Strength',
    exercises: [{ id: 'a', exercise: { name: 'Back Squat' } }],
    recoveryAddons: [{ id: 'ad', exercises: [{ id: 'x', name: 'Side Plank' }] }],
  };
  const withCuelessAddon: any = {
    workoutType: 'Strength',
    exercises: [{ id: 'a', exercise: { name: 'Back Squat' } }],
    recoveryAddons: [{ id: 'ad', exercises: [{ id: 'x', name: 'Some Made Up Move' }] }],
  };

  ok(
    'a cueless add-on row is a violation',
    JSON.stringify(cuelessSessionCards(withCuelessAddon)) === JSON.stringify(['Some Made Up Move']),
    `got ${JSON.stringify(cuelessSessionCards(withCuelessAddon))}`,
  );
  ok(
    'a cued add-on row is not',
    cuelessSessionCards(withCuedAddon).length === 0,
    `got ${JSON.stringify(cuelessSessionCards(withCuedAddon))}`,
  );
  ok(
    'and it is ENFORCED — a cueless add-on refuses the week, it does not ship blank',
    (() => {
      try { enforceCuratedAddonCueContract([withCuelessAddon], 'unit'); return false; }
      catch (e) { return e instanceof ExerciseVocabularyViolation; }
    })(),
  );
  // Each stage enforces what IT produced. `attachRecoveryAddonsToWeek` runs over
  // workouts whose strength rows were already gated at acceptance, so blaming the
  // attach stage for a strength row would double-report and misattribute.
  ok(
    'the attach-stage gate does NOT re-judge strength rows',
    (() => {
      const cuelessStrength: any = {
        workoutType: 'Strength',
        exercises: [{ id: 'a', exercise: { name: 'Some Made Up Move' } }],
        recoveryAddons: [{ id: 'ad', exercises: [{ id: 'x', name: 'Side Plank' }] }],
      };
      try { enforceCuratedAddonCueContract([cuelessStrength], 'unit'); return true; }
      catch { return false; }
    })(),
  );
  ok(
    'a recovery-type day\'s add-on rows are checked too — they render on that branch',
    cuelessSessionCards({
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [{ id: 'd', exercise: { name: 'Brisk Walking' } }],
      recoveryAddons: [{ id: 'ad', exercises: [{ id: 'x', name: 'Some Made Up Move' }] }],
    } as any).length === 1,
    'the recovery branch keeps the add-on box, so its rows are in render scope',
  );
}

console.log(`\nexercise canonicalisation: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
