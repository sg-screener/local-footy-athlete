/**
 * Sam's locked-list changeset — conformance to the document, not to a summary.
 *
 *   docs/EXERCISE_LOCKED_LIST_CHANGESET_2026-07-24.md
 *
 * The document is parsed here and treated as the source of truth: removals,
 * merges, the Pull-Ups cue edit, every addition's cue / video / pool, the
 * display-name mapping, the power staging table and the pending load rulings.
 * "Apply EXACTLY — cues verbatim, no rewording" is therefore machine-checked.
 * Edit the document first; this suite fails until the code matches it.
 *
 * Nothing below is written as a literal exercise name except where the code
 * under test needs a symbol (the pool objects). Deriving the names from the
 * document is what makes the guard un-disarmable: a blanket rename sweep across
 * `src` would rewrite literals in a test file and silently switch the guard off.
 *
 * Run: npm run test:locked-list
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import { EXERCISE_CUES } from '../data/exerciseCues';
import { PENDING_LISTS } from '../data/provenancePendingLists';
import { isPowerPoolExercise } from '../rules/powerExercisePool';
import { POOL_REGISTRY, type PoolExercise } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { EXERCISE_TAGS, CONDITIONING_META } from '../data/exerciseTags';
import { EXERCISE_DEMO_VIDEOS, lookupExerciseDemo } from '../services/exerciseVideoService';
import {
  EXERCISE_LOAD_MAP,
  TRUE_BODYWEIGHT_EXERCISES,
  isTrueBodyweightExercise,
} from '../utils/loadEstimation';
import { canonicalExerciseName, curatedExerciseVocabulary } from '../utils/exerciseCanonicalisation';
import {
  LOAD_RULING_PENDING,
  POWER_POOL_PENDING,
  exemptionsFor,
  hasExemption,
  isExempt,
  isSelectable,
  selectableExerciseNames,
} from '../data/selectableExerciseVocabulary';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, '..');
const doc = fs.readFileSync(
  path.join(repoRoot, 'docs/EXERCISE_LOCKED_LIST_CHANGESET_2026-07-24.md'), 'utf8');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function okEmpty(name: string, offenders: readonly string[], detail?: string): void {
  ok(name, offenders.length === 0,
    `${detail ? `${detail}\n      ` : ''}${[...offenders].sort().join('\n      ')}`);
}

/* ══ Parse the document ══ */

function section(heading: string): string {
  const after = doc.split(`\n${heading}`)[1] ?? '';
  return after.split(/\n#{2,3} /)[0] ?? '';
}

/**
 * Removal names. `A / B` is two retired names; a trailing "(late ruling)" is
 * Sam's provenance marker, not part of the name.
 */
function parseRemovals(): string[] {
  const names: string[] = [];
  for (const line of section('## REMOVALS').split('\n')) {
    const match = line.match(/^- (.+)$/);
    if (!match) continue;
    const body = match[1].replace(/\s*\(late ruling\)\s*$/, '').trim();
    for (const part of body.split(' / ')) names.push(part.trim());
  }
  return names;
}

/**
 * `- variant → Canonical  (note)`, where `variant` may be `A / B` and the note
 * is separated by TWO spaces. A canonical name can itself carry a parenthetical
 * — "Inverted Row (Bodyweight)" — so the note is stripped on the double space,
 * never on the first `(`. Sam bolds a rename, which wins when present.
 */
function parseMerges(): { variant: string; canonical: string }[] {
  const merges: { variant: string; canonical: string }[] = [];
  for (const line of section('## MERGES / ALIASES').split('\n')) {
    const match = line.match(/^- (.+?) → (.+)$/);
    if (!match) continue;
    const bold = match[2].match(/\*\*(.+?)\*\*/);
    const canonical = bold ? bold[1].trim() : match[2].replace(/\s\s+\(.*$/, '').trim();
    for (const variant of match[1].split(' / ')) {
      merges.push({ variant: variant.trim(), canonical });
    }
  }
  return merges;
}

interface Addition {
  entry: string;
  pool: string;
  cue: { primary: string; secondary: string } | null;
  /** Cue Sam did not author; the doc records what ships instead. */
  cueShipsAs: { primary: string; secondary: string } | null;
  videoUrl: string | null;
}

function splitCue(body: string): { primary: string; secondary: string } {
  const pipe = body.indexOf(' | ');
  if (pipe < 0) return { primary: body.trim(), secondary: '' };
  return { primary: body.slice(0, pipe).trim(), secondary: body.slice(pipe + 3).trim() };
}

function parseAdditions(): Addition[] {
  const block = doc.split('## ADDITIONS')[1]?.split('\n## ')[0] ?? '';
  const additions: Addition[] = [];
  let current: Addition | null = null;
  for (const line of block.split('\n')) {
    const heading = line.match(/^### (.+)$/);
    if (heading) {
      current = { entry: heading[1].trim(), pool: '', cue: null, cueShipsAs: null, videoUrl: null };
      additions.push(current);
      continue;
    }
    if (!current) continue;
    const pool = line.match(/^- Pool: (.+)$/);
    if (pool) { current.pool = pool[1].trim(); continue; }
    const shipsAs = line.match(/^- Cue not authored — ships the existing curated cue: (.+)$/);
    if (shipsAs) { current.cueShipsAs = splitCue(shipsAs[1]); continue; }
    const cue = line.match(/^- Cue:(.*)$/);
    if (cue) {
      const body = cue[1].trim();
      current.cue = body ? splitCue(body) : null;
      continue;
    }
    const video = line.match(/^- Video: (\S+)\s*$/);
    if (video && /^https?:/.test(video[1])) { current.videoUrl = video[1]; continue; }
  }
  return additions;
}

/** `| Sam's entry | Ships as | Pool (Sam) | Placement |` */
function parseFinalNames(): { entry: string; ships: string; pool: string; placement: string }[] {
  const rows: { entry: string; ships: string; pool: string; placement: string }[] = [];
  for (const line of section('## FINAL CANONICAL NAMES').split('\n')) {
    if (!line.startsWith('| ')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 4) continue;
    if (cells[0] === "Sam's entry" || /^-+$/.test(cells[0])) continue;
    rows.push({ entry: cells[0], ships: cells[1], pool: cells[2], placement: cells[3] });
  }
  return rows;
}

/** The POWER — STAGED table's first column. */
/**
 * The names still STAGED, not placed.
 *
 * The POWER section now carries TWO tables — placed entries and still-staged
 * ones — since the pool was built and wired on 2026-07-27. Parsing is anchored
 * to the "Still STAGED" sub-heading so a placed entry can never be miscounted as
 * staged, which would let a real pool member keep a placement exemption.
 */
function parsePowerStaged(): string[] {
  const names: string[] = [];
  const powerSection = section('## POWER — PLACED (2026-07-27), three still staged');
  const stagedTable = powerSection.split('**Still STAGED')[1] ?? '';
  for (const line of stagedTable.split('\n')) {
    if (!line.startsWith('| ')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 4) continue;
    if (cells[0] === 'Name' || /^-+$/.test(cells[0])) continue;
    names.push(cells[0]);
  }
  return names;
}

interface LoadRuling {
  exercise: string;
  /** `1.14`, `0.00`, `0 (slot convention)`, or `n/a — still power-staged`. */
  loadRatio: string;
  /** `{ squat, 0.90, barbell }` or a prose "none — …" / "unchanged" cell. */
  loadMap: string;
}

/**
 * Sam's RULED load table. Parsed rather than transcribed, so a ruling recorded
 * in the document but not shipped (or shipped but not recorded) fails the build.
 */
function parseLoadRulings(): LoadRuling[] {
  const block = doc.split('### RULED — Sam, 2026-07-25, applied')[1]
    ?.split('### RULED — Erg EMOM')[0] ?? '';
  const rulings: LoadRuling[] = [];
  for (const line of block.split('\n')) {
    if (!line.startsWith('| ')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 4) continue;
    if (cells[0] === 'Exercise' || /^-+$/.test(cells[0])) continue;
    rulings.push({ exercise: cells[0], loadRatio: cells[1], loadMap: cells[2] });
  }
  return rulings;
}

/** `{ squat, 0.90, barbell }` → the shape EXERCISE_LOAD_MAP must carry. */
function parseLoadMapCell(cell: string): { anchor: string; ratio: number; equipment: string } | null {
  const match = cell.match(/\{\s*(\w+),\s*([\d.]+),\s*(\w+)\s*\}/);
  if (!match) return null;
  return { anchor: match[1], ratio: Number(match[2]), equipment: match[3] };
}

const removals = parseRemovals();
const merges = parseMerges();
const additions = parseAdditions();
const finalNames = parseFinalNames();
const powerStaged = parsePowerStaged();
const loadRulings = parseLoadRulings();

/** Sam's sheet entry → the name that actually ships. */
const shipsAs = new Map(finalNames.map((r) => [r.entry, r.ships]));

/* ══ Content surfaces ══ */

function strengthPoolNames(): string[] {
  const names: string[] = [];
  for (const slot of Object.values(STRENGTH_POOLS)) {
    for (const definition of [slot.anchor, slot.accessory]) {
      for (const entry of definition.entries) names.push(entry.name);
    }
  }
  return names;
}

function registryPoolNames(): string[] {
  return Object.values(POOL_REGISTRY).flatMap((pool: PoolExercise[]) => pool.map((e) => e.name));
}

const poolNames = new Set([...strengthPoolNames(), ...registryPoolNames()]);

/** Every content surface a name can hide in, keyed by the file that owns it. */
const SURFACES: { surface: string; has: (name: string) => boolean }[] = [
  { surface: 'EXERCISE_CUES', has: (n) => Boolean(EXERCISE_CUES[n]) },
  { surface: 'EXERCISE_TAGS', has: (n) => Boolean(EXERCISE_TAGS[n]) },
  { surface: 'CONDITIONING_META', has: (n) => Boolean(CONDITIONING_META[n]) },
  { surface: 'EXERCISE_DEMO_VIDEOS', has: (n) => n in EXERCISE_DEMO_VIDEOS },
  { surface: 'EXERCISE_LOAD_MAP', has: (n) => Boolean(EXERCISE_LOAD_MAP[n]) },
  { surface: 'TRUE_BODYWEIGHT_EXERCISES', has: (n) => TRUE_BODYWEIGHT_EXERCISES.has(n) },
  { surface: 'pools', has: (n) => poolNames.has(n) },
];

/** Alias targets across both alias maps — a target is an entry by another door. */
function aliasTargets(): { file: string; key: string; target: string }[] {
  const out: { file: string; key: string; target: string }[] = [];
  for (const file of ['services/exerciseVideoService.ts', 'utils/loadEstimation.ts']) {
    const text = fs.readFileSync(path.join(src, file), 'utf8');
    const block = text.split('EXERCISE_NAME_ALIASES')[1] ?? text.split('EXERCISE_ALIASES')[1] ?? '';
    for (const match of block.matchAll(/^\s*'([^']+)':\s*'([^']+)',/gm)) {
      out.push({ file, key: match[1], target: match[2] });
    }
  }
  return out;
}

const aliases = aliasTargets();

function main(): void {
  console.log('\n[0] The document parsed cleanly');
  {
    ok('removals parsed', removals.length >= 55, `parsed ${removals.length}`);
    // 12 lines, one of which ("Pogo Jumps / Pogo Jump") retires two spellings.
    ok('merges parsed', merges.length === 13, `parsed ${merges.length}, expected 13`);
    ok('additions parsed', additions.length === 27, `parsed ${additions.length}, expected 27`);
    ok('the final-name table covers every addition',
      finalNames.length === additions.length
        && additions.every((a) => shipsAs.has(a.entry)),
      `table rows=${finalNames.length} additions=${additions.length}; `
        + `missing: ${additions.filter((a) => !shipsAs.has(a.entry)).map((a) => a.entry).join(', ')}`);
    // Was 8 before the pool was built; five of those are now really placed.
    ok('the power staging table parsed', powerStaged.length === 3, `parsed ${powerStaged.length}`);
    ok('the ruled-load table parsed', loadRulings.length === 7, `parsed ${loadRulings.length}`);
  }

  console.log('\n[1] REMOVALS — gone from every content surface');
  {
    // An exact-key check, not a substring grep: "Floor Press" must not survive as
    // an ENTRY, while "Single-Arm DB Floor Press" (a different, surviving
    // movement) is untouched. Substring bans cannot express that difference and
    // would either miss removals or ban survivors.
    const survivors: string[] = [];
    for (const name of removals) {
      for (const { surface, has } of SURFACES) {
        if (has(name)) survivors.push(`${name} — still in ${surface}`);
      }
    }
    okEmpty('no removed exercise is an entry in any content surface', survivors);

    // TARGETS only. An alias KEY that spells a removed name is not a survival —
    // it is the removal working: "barbell rows" is retired as an ENTRY, and the
    // spelling now resolves onto the surviving "Barbell Row". Banning the key
    // would force the app to forget a spelling athletes and generators still
    // use, which is the opposite of collapsing double-ups.
    const aliasSurvivors = aliases
      .filter((a) => removals.includes(a.target))
      .map((a) => `${a.file}: '${a.key}' → '${a.target}'`);
    okEmpty('no alias resolves to a removed exercise', aliasSurvivors);
  }

  console.log('\n[2] REMOVALS — gone from the live generation prompt vocabulary');
  {
    // The prompt is the sixth surface. The client prompt derives its vocabulary
    // from pool membership, so §1 already covers it; the edge function's
    // hand-copied MOVEMENT PATTERNS list is the one that could drift, and the
    // vocabulary switch deletes it outright rather than keeping it in sync.
    const edge = fs.readFileSync(
      path.join(repoRoot, 'supabase/functions/coach-chat/index.ts'), 'utf8');
    ok('the hand-copied MOVEMENT PATTERNS exercise list is deleted from coach-chat',
      !/MOVEMENT PATTERNS \(every exercise belongs to exactly one\):/.test(edge),
      'a second, hand-maintained vocabulary is exactly the drift the switch retires');

    // Belt and braces for the lowercase prompt-only spellings Sam removed: they
    // exist ONLY as prompt text, so a text check is the honest one for them.
    const promptOnly = ['bent over BB row', 'incline DB row (chest supported)', 'machine curls', 'trap bar DL'];
    okEmpty('the prompt-only removals are gone from the coach-chat prompt',
      promptOnly.filter((n) => edge.includes(n)));
  }

  console.log('\n[3] MERGES — one canonical entry, variants resolve onto it');
  {
    const unresolved: string[] = [];
    const duplicated: string[] = [];
    for (const { variant, canonical } of merges) {
      if (canonicalExerciseName(variant) !== canonical) {
        unresolved.push(`"${variant}" → ${JSON.stringify(canonicalExerciseName(variant))}, expected ${JSON.stringify(canonical)}`);
      }
      // The variant must not ALSO be its own entry — that is the double-up Sam
      // collapsed ("only need one").
      if (variant !== canonical) {
        for (const { surface, has } of SURFACES) {
          if (has(variant)) duplicated.push(`${variant} — still a separate entry in ${surface}`);
        }
      }
    }
    okEmpty('every merged variant canonicalises to its single surviving entry', unresolved);
    okEmpty('no merged variant survives as a second entry', duplicated);
  }

  console.log('\n[4] CUE EDIT — the Pull-Ups weight line');
  {
    const edit = doc.split('## CUE EDIT')[1]?.split('\n## ')[0] ?? '';
    const match = edit.match(/^- (.+?): append secondary line: "(.+?)"/m);
    ok('the cue edit parsed', Boolean(match), edit.trim());
    if (match) {
      const [, name, line] = match;
      ok(`${name} carries the appended secondary line`,
        EXERCISE_CUES[name]?.secondaryCue.includes(line),
        `secondary=${JSON.stringify(EXERCISE_CUES[name]?.secondaryCue)}`);
    }
  }

  console.log('\n[5] ADDITIONS — cue verbatim, video, pool, display name');
  {
    /** Sam's pool label → the pool object that must contain the name. */
    const poolContains: Record<string, (name: string) => boolean> = {
      'Lower prehab': (n) => POOL_REGISTRY.lower_prehab.some((e) => e.name === n),
      'Core': (n) => POOL_REGISTRY.trunk_anti_rotation.some((e) => e.name === n),
      'Trunk/core': (n) => POOL_REGISTRY.trunk_anti_rotation.some((e) => e.name === n),
      'Mobility': (n) => POOL_REGISTRY.mobility.some((e) => e.name === n),
      'Groin/adductors': (n) => POOL_REGISTRY.groin_adductors.some((e) => e.name === n),
      'Squat': (n) => slotHas('squat', n),
      'Hinge': (n) => slotHas('hinge', n),
      'Lower isolation': (n) => slotHas('isolation_lower', n),
      'Upper push': (n) => slotHas('horizontal_push', n),
      'Conditioning': (n) => Boolean(CONDITIONING_META[n]),
      // Sam's note: wire per POWER_EXERCISE_POOL_SPEC where it is built, else
      // stage with pointers. It IS built now (POWER_EXERCISE_POOL +
      // selectPowerExercise, wired 2026-07-27), so "placed" means real pool
      // membership. The speed-lift names that spec's tables do not place remain
      // legitimately staged behind the typed exemption — still never a guessed
      // pool slot.
      'Power': (n) => isPowerPoolExercise(n) || hasExemption(n, 'power_pool_pending'),
    };

    const wrongName: string[] = [];
    const wrongCue: string[] = [];
    const wrongVideo: string[] = [];
    const wrongPool: string[] = [];

    for (const addition of additions) {
      const name = shipsAs.get(addition.entry);
      if (!name) continue;

      // Display-name rule: title-cased, abbreviations expanded. The shipped name
      // must be the one the app actually keys content by.
      if (!EXERCISE_CUES[name] && !CONDITIONING_META[name] && !isExempt(name, 'cue')) {
        wrongName.push(`${addition.entry} → ${name}: no curated cue under the shipped name`);
      }

      const expected = addition.cue ?? addition.cueShipsAs;
      const shipped = EXERCISE_CUES[name];
      if (expected) {
        if (!shipped) {
          wrongCue.push(`${name}: absent from EXERCISE_CUES`);
        } else {
          if (shipped.primaryCue !== expected.primary) {
            wrongCue.push(`${name} primary:\n        doc:  ${JSON.stringify(expected.primary)}\n        code: ${JSON.stringify(shipped.primaryCue)}`);
          }
          if (shipped.secondaryCue !== expected.secondary) {
            wrongCue.push(`${name} secondary:\n        doc:  ${JSON.stringify(expected.secondary)}\n        code: ${JSON.stringify(shipped.secondaryCue)}`);
          }
        }
      }

      if (addition.videoUrl) {
        if (EXERCISE_DEMO_VIDEOS[name] !== addition.videoUrl) {
          wrongVideo.push(`${name}\n        doc:  ${addition.videoUrl}\n        code: ${String(EXERCISE_DEMO_VIDEOS[name])}`);
        }
      } else if (!isExempt(name, 'video') && !lookupExerciseDemo(name).url) {
        // "existing in app" — the doc says the current entry is reused, so one
        // must actually resolve.
        wrongVideo.push(`${name}: doc says the app already has a video, but none resolves`);
      }

      const check = poolContains[addition.pool];
      if (!check) {
        wrongPool.push(`${name}: unmapped pool label ${JSON.stringify(addition.pool)}`);
      } else if (!check(name)) {
        wrongPool.push(`${name}: not in the "${addition.pool}" pool`);
      }
    }

    okEmpty('every addition ships under its final canonical name', wrongName);
    okEmpty('every authored cue ships verbatim (no rewording)', wrongCue);
    okEmpty('every authored video URL is applied verbatim', wrongVideo);
    okEmpty('every addition landed in the pool Sam named', wrongPool);
  }

  console.log('\n[6] POWER — staged with pointers, never invented placement');
  {
    const docSet = new Set(powerStaged);
    okEmpty('the staged set matches the document exactly (code → doc)',
      [...POWER_POOL_PENDING].filter((n) => !docSet.has(n)),
      'staged in code but absent from the POWER table');
    okEmpty('the staged set matches the document exactly (doc → code)',
      powerStaged.filter((n) => !POWER_POOL_PENDING.has(n)),
      'in the POWER table but not staged in code');
    okEmpty('no staged power exercise was quietly given a pool slot',
      [...POWER_POOL_PENDING].filter((n) => poolNames.has(n)),
      'placement is owned by POWER_EXERCISE_POOL_SPEC — remove from the staging set when it lands');
    okEmpty('no staged power exercise leaks into the AI vocabulary',
      [...POWER_POOL_PENDING].filter((n) => isSelectable(n)),
      'the app names these; the generator must not');
  }

  console.log('\n[7] VOCABULARY SWITCH — one circle, both directions fail the build');
  {
    const vocabulary = curatedExerciseVocabulary();
    const selectable = selectableExerciseNames();
    ok('the AI vocabulary IS selectable pool membership, exactly',
      vocabulary.length === selectable.length
        && vocabulary.every((n, i) => n === selectable[i]),
      `vocabulary=${vocabulary.length} selectable=${selectable.length}`);

    okEmpty('pool → cue: every selectable entry has a cue (typed exemptions only)',
      selectable.filter((n) => !EXERCISE_CUES[n] && !isExempt(n, 'cue')));

    okEmpty('pool → video: every selectable entry resolves a video (typed exemptions only)',
      selectable.filter((n) => !isExempt(n, 'video') && !lookupExerciseDemo(n).url));

    const selectableSet = new Set(selectable);
    okEmpty('cue → pool: every curated cue is prescribable (typed exemptions only)',
      Object.keys(EXERCISE_CUES).filter((n) => !selectableSet.has(n) && !isExempt(n, 'pool')));

    okEmpty('every exemption is a TYPED kind, never a bare name',
      [...POWER_POOL_PENDING].filter((n) => exemptionsFor(n).length === 0));
  }

  console.log('\n[8] LOAD HANDLING — Sam\'s rulings applied, queue empty');
  {
    const ruledSet = new Set(loadRulings.map((r) => r.exercise));
    const noLoadAdditions = additions
      .map((a) => shipsAs.get(a.entry))
      .filter((n): n is string => Boolean(n))
      .filter((n) => !ruledSet.has(n))
      .filter((n) => !CONDITIONING_META[n]);

    okEmpty('every unruled addition lands in a no-load class',
      noLoadAdditions.filter((n) => !isTrueBodyweightExercise(n)),
      'band / bodyweight entries must resolve as unloaded, not fall through to a weight estimate');

    // The queue is EMPTY, and emptiness is the proof rather than a comment: the
    // assertion below fails the moment anything is parked again without a
    // ruling in the document.
    okEmpty('nothing is parked awaiting a load ruling', [...LOAD_RULING_PENDING],
      'Sam ruled all seven on 2026-07-25; a new entry here needs a RULED row first');

    // …but emptiness alone proves nothing about WHY the list is empty, and this
    // assertion read as "everything is ruled" while 71 unruled ratios sat in
    // EXERCISE_LOAD_MAP having never been parked (Sam's ruling, 2026-07-28:
    // absence must never render as approval). So the empty set must now be
    // backed by a recorded ruling with attribution — `ruled_empty`, not the
    // indistinguishable `never_populated`.
    ok('the empty queue is a RECORDED ruling, not an unworked list',
      PENDING_LISTS.load_ruling.status === 'ruled_empty',
      `PENDING_LISTS.load_ruling is "${PENDING_LISTS.load_ruling.status}" — an empty `
      + 'LOAD_RULING_PENDING is only meaningful if Sam actually emptied it');
    okEmpty('no exercise still claims the load exemption',
      [...ruledSet].filter((n) => hasExemption(n, 'load_ruling_pending')));

    // Every ruled value SHIPS. Parsed from the document, never transcribed here,
    // so the ruling and the code cannot drift in either direction.
    const wrongRatio: string[] = [];
    const wrongMap: string[] = [];
    for (const ruling of loadRulings) {
      const expectedMap = parseLoadMapCell(ruling.loadMap);
      const shipped = EXERCISE_LOAD_MAP[ruling.exercise];
      if (expectedMap) {
        if (!shipped) {
          wrongMap.push(`${ruling.exercise}: absent from EXERCISE_LOAD_MAP, doc says ${ruling.loadMap}`);
        } else if (
          shipped.anchor !== expectedMap.anchor
          || shipped.ratio !== expectedMap.ratio
          || shipped.equipment !== expectedMap.equipment
        ) {
          wrongMap.push(
            `${ruling.exercise}\n        doc:  ${ruling.loadMap}\n        code: `
            + `{ ${shipped.anchor}, ${shipped.ratio}, ${shipped.equipment} }`);
        }
      } else if (/^none\b/i.test(ruling.loadMap)) {
        // "none — stays TRUE_BODYWEIGHT_EXERCISES": bodyweight-with-optional.
        // A starting-weight entry here would be the fake precision Sam ruled out.
        if (shipped) {
          wrongMap.push(`${ruling.exercise}: doc says no starting suggestion, code carries one`);
        }
        if (!TRUE_BODYWEIGHT_EXERCISES.has(ruling.exercise)) {
          wrongMap.push(`${ruling.exercise}: doc says it stays TRUE_BODYWEIGHT_EXERCISES, it does not`);
        }
      }

      const expectedRatio = ruling.loadRatio.match(/^([\d.]+)$/);
      if (expectedRatio) {
        const entry = findStrengthPoolEntry(ruling.exercise);
        if (!entry) {
          wrongRatio.push(`${ruling.exercise}: doc rules loadRatio ${expectedRatio[1]} but it is in no strength pool`);
        } else if (entry.loadRatio !== Number(expectedRatio[1])) {
          wrongRatio.push(`${ruling.exercise}: doc ${expectedRatio[1]}, code ${entry.loadRatio}`);
        }
      }
    }
    okEmpty('every ruled loadRatio ships exactly', wrongRatio);
    okEmpty('every ruled starting-weight profile ships exactly', wrongMap);
  }

  const total = passed + failures.length;
  console.log(`\nLocked list: passed=${passed}/${total} failures=${failures.length}`);
  if (failures.length > 0) {
    console.error(`Failing: ${failures.join(', ')}`);
    process.exit(1);
  }
}

/** The strength-pool entry for a name, or null when no pool carries it. */
function findStrengthPoolEntry(name: string): { loadRatio: number } | null {
  for (const slot of Object.values(STRENGTH_POOLS)) {
    for (const definition of [slot.anchor, slot.accessory]) {
      const entry = definition.entries.find((e) => e.name === name);
      if (entry) return entry;
    }
  }
  return null;
}

function slotHas(slot: keyof typeof STRENGTH_POOLS, name: string): boolean {
  const definitions = STRENGTH_POOLS[slot];
  return [definitions.anchor, definitions.accessory]
    .some((d) => d.entries.some((e) => e.name === name));
}

main();
