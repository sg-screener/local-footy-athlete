/**
 * Extract the injury matrix state out of exerciseTags.ts + muscleExperienceMetadata.ts
 * into JSON for the sheet writer. Read-only.
 *
 * Step 1 of 2 in regenerating docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx. Run from
 * the repo root:
 *
 *   node scripts/extract-injury-matrix.js /tmp/matrix.json
 *   python3 scripts/build-injury-matrix-sheet.py /tmp/matrix.json \
 *     docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx
 *   npm run verify:injury-matrix-sheet
 *
 * Committed as provenance for how the sheet was built, so nobody has to take on
 * faith that its 1,788 cells were not hand-fiddled. The VERIFY step is the
 * durable artifact — it seeds the Phase 2 equality gate.
 *
 * NOTE: reads the authored keys out of the SOURCE TEXT rather than importing
 * EXERCISE_TAGS. Once `inj()` has run, an omitted key and an authored 'good' are
 * indistinguishable — which is the entire defect the sheet exists to kill.
 */
const fs = require('fs');

const KEYS = ['adductor', 'pubalgia', 'lowerBack', 'knee', 'hamstring', 'calf', 'ankle', 'shoulder', 'elbow', 'wrist'];

// Ratings come from a PINNED PRE-MIGRATION SNAPSHOT, not the live file.
// The rules were reverse-engineered from the ratings as they stood BEFORE the
// migration wrote all 13 regions explicitly. Re-deriving them from the migrated
// file would be circular — every cell is authored now, so "evidence" would just
// be the rules' own output fed back in. The snapshot is the provenance.
const RATINGS_SOURCE = process.argv[3] || 'docs/INJURY_MATRIX_PRE_MIGRATION_RATINGS.ts';
const src = fs.readFileSync(RATINGS_SOURCE, 'utf8');
const mapStart = src.indexOf('export const EXERCISE_TAGS');
const body = src.slice(mapStart);

// Section headers become the group. A header applies to every entry after it.
const headerRe = /^  \/\/ ([A-Z][A-Z /—\-()a-z]*)$/gm;
const headers = [];
for (const m of body.matchAll(headerRe)) {
  const text = m[1].trim();
  // Only the banner headers (wrapped in ═ rules) name a group.
  const before = body.slice(Math.max(0, m.index - 70), m.index);
  if (!/═══/.test(before)) continue;
  headers.push({ index: m.index, name: text });
}

function groupFor(index) {
  let name = 'UNGROUPED';
  for (const h of headers) {
    if (h.index < index) name = h.name;
    else break;
  }
  return name;
}

const blocks = [...body.matchAll(/^  '([^']+)':\s*\{([\s\S]*?)^  \},/gm)];

// Sam's authored muscle data.
const msrc = fs.readFileSync('src/data/muscleExperienceMetadata.ts', 'utf8');
const muscle = {};
// Names may carry an escaped apostrophe (`'World\'s Greatest Stretch'`).
const unescapeName = (raw) => raw.replace(/\\'/g, "'");
for (const m of msrc.matchAll(
  /exercise:\s*'((?:[^'\\]|\\.)+)',\s*\n\s*pool:\s*'([^']+)',\s*\n\s*primary:\s*\[([^\]]*)\],\s*\n\s*secondary:\s*\[([^\]]*)\]/g,
)) {
  const list = (raw) => (raw.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
  muscle[unescapeName(m[1])] = { pool: m[2], primary: list(m[3]), secondary: list(m[4]) };
}

const records = [];
for (const [, name, blockBody, ] of blocks) {
  const full = blocks.find((b) => b[1] === name);
  const idx = full.index;
  const movement = /movement:\s*'([^']+)'/.exec(blockBody)[1];
  const region = /region:\s*'([^']+)'/.exec(blockBody)[1];
  const load = /load:\s*'([^']+)'/.exec(blockBody)[1];

  const injm = /injury:\s*(SAFE|inj\(\{([\s\S]*?)\}\))/.exec(blockBody);
  if (!injm) throw new Error(`no injury profile on "${name}"`);
  const bareSafe = injm[1] === 'SAFE';
  const explicit = {};
  if (!bareSafe) {
    for (const kv of injm[2].matchAll(/(\w+):\s*'(\w+)'/g)) {
      if (!KEYS.includes(kv[1])) throw new Error(`UNKNOWN INJURY KEY "${kv[1]}" on "${name}"`);
      explicit[kv[1]] = kv[2];
    }
  }

  records.push({
    name,
    group: groupFor(idx),
    movement,
    region,
    load,
    bareSafe,
    explicit,
    muscle: muscle[name] || null,
  });
}

/* ── Live code: intake entries the snapshot never held (Sam, 2026-09-03) ──
 *
 * Three kinds of record leave this script:
 *   evidence  — the pinned snapshot; the ONLY rows the rule tally reads. A
 *               snapshot exercise no longer in code stays as evidence, flagged
 *               `retired`, so the rules do not move when a lift leaves.
 *   intake    — a live exerciseTags entry the snapshot never held. Its 13
 *               authored ratings travel as `explicitRegions`; the rules are NOT
 *               re-derived from them (circular), so where an intake rating
 *               disagrees with a rule the derive step lifts it as a named
 *               exception — lift, never re-decide.
 *   untagged  — a pool member with no tags row. No ratings; only Sam's authored
 *               muscles and the pool's own contraindications, so the workbook
 *               can show what the rules say and where his decision is required.
 */
const LIVE_TAGS = 'src/data/exerciseTags.ts';
const live = fs.readFileSync(LIVE_TAGS, 'utf8');
const liveBody = live.slice(live.indexOf('export const EXERCISE_TAGS'));
const liveNames = new Set();
const REGIONS_NOW = ['groin', 'hip', 'quad', 'hamstring', 'knee', 'calf', 'ankle/foot',
  'ribs', 'lowerBack', 'neck', 'shoulder', 'elbow', 'wrist/hand'];
const intakeRecords = [];
for (const [, rawName, blockBody] of liveBody.matchAll(/^  '((?:[^'\\]|\\.)+)':\s*\{([\s\S]*?)^  \},/gm)) {
  const name = unescapeName(rawName);
  liveNames.add(name);
  if (records.some((r) => r.name === name)) continue;
  const injury = /injury:\s*\{([\s\S]*?)\n {4}\}/.exec(blockBody);
  if (!injury) throw new Error(`live entry "${name}" has no explicit injury profile`);
  const explicitRegions = {};
  // Quoted and bare keys are both authored: `'ankle/foot': 'good'`, `groin: 'good'`.
  for (const kv of injury[1].matchAll(/(?:'([^']+)'|(\w+)):\s*'(\w+)'/g)) {
    const key = kv[1] || kv[2];
    if (!REGIONS_NOW.includes(key)) throw new Error(`UNKNOWN INJURY REGION "${key}" on live "${name}"`);
    explicitRegions[key] = kv[3];
  }
  const missingRegions = REGIONS_NOW.filter((key) => !explicitRegions[key]);
  if (missingRegions.length > 0) {
    throw new Error(`live entry "${name}" does not author every region: ${missingRegions.join(', ')}`);
  }
  intakeRecords.push({
    name,
    group: 'INTAKE (after 2026-07-28)',
    movement: /movement:\s*'([^']+)'/.exec(blockBody)[1],
    region: /region:\s*'([^']+)'/.exec(blockBody)[1],
    load: /load:\s*'([^']+)'/.exec(blockBody)[1],
    bareSafe: false,
    explicit: {},
    explicitRegions,
    evidence: false,
    intake: true,
    muscle: muscle[name] || null,
  });
}
for (const r of records) {
  r.evidence = true;
  r.retired = !liveNames.has(r.name);
}

/* ── Pools: members with no tags row at all ── */
const POOLS = 'src/data/exercisePools.ts';
const poolsSource = fs.readFileSync(POOLS, 'utf8');
const QUOTED = `'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"`;
const unquote = (raw) => raw.slice(1, -1).replace(/\\(['"])/g, '$1');
const untaggedRecords = [];
for (const pool of poolsSource.matchAll(/^export const ([A-Z_]+_POOL): PoolExercise\[\] = \[([\s\S]*?)^\];/gm)) {
  const [, poolName, poolBody] = pool;
  const entry = new RegExp(
    `ex\\(\\s*'[^']*',\\s*(${QUOTED})\\s*,\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*,`
    + `\\s*(?:${QUOTED})\\s*,\\s*\\[[^\\]]*\\]\\s*,\\s*\\[([^\\]]*)\\]`,
    'g',
  );
  for (const m of poolBody.matchAll(entry)) {
    const name = unquote(m[1]);
    if (liveNames.has(name)) continue;
    if (untaggedRecords.some((r) => r.name === name)) continue;
    const contraindications = [...m[2].matchAll(/'([^']+)'/g)].map((c) => c[1]);
    untaggedRecords.push({
      name,
      group: (muscle[name] && muscle[name].pool) || poolName,
      pool: poolName,
      movement: null,
      region: null,
      load: null,
      bareSafe: false,
      explicit: {},
      contraindications,
      evidence: false,
      untagged: true,
      muscle: muscle[name] || null,
    });
  }
}
records.push(...intakeRecords, ...untaggedRecords);
// The authored MuscleGroup vocabulary, so a rule naming a real-but-never-primary
// muscle can be told apart from a rule naming a typo.
const vocabularyBlock = /export type MuscleGroup =([\s\S]*?);/.exec(msrc);
const muscleVocabulary = vocabularyBlock
  ? [...vocabularyBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  : [];

fs.writeFileSync(process.argv[2], JSON.stringify(
  { keys: KEYS, records, muscleVocabulary }, null, 2));
console.log(`muscle vocabulary: ${muscleVocabulary.length} groups`);
console.log(`extracted ${records.length} entries, ${new Set(records.map((r) => r.group)).size} groups`);
const explicitPairs = records.reduce((n, r) => n + Object.keys(r.explicit).length, 0);
console.log(`pairs ${records.length * 10}, explicit ${explicitPairs}, defaulted ${records.length * 10 - explicitPairs}`);
console.log(`bare SAFE entries: ${records.filter((r) => r.bareSafe).length}`);
console.log(`no muscle metadata: ${records.filter((r) => !r.muscle).map((r) => r.name).length}`);
console.log(`retired from code, kept as evidence: ${records.filter((r) => r.retired).map((r) => r.name).join(', ') || 'none'}`);
console.log(`intake entries after the snapshot: ${intakeRecords.length}`);
console.log(`untagged pool members: ${untaggedRecords.length}`);
