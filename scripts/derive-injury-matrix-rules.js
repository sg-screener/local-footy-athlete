/**
 * Derive the CANDIDATE RULE TABLE for the injury matrix, on both of Sam's axes.
 *
 * Step 2 of 3 in regenerating docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx:
 *
 *   node   scripts/extract-injury-matrix.js       /tmp/matrix.json
 *   node   scripts/derive-injury-matrix-rules.js  /tmp/matrix.json /tmp/rules.json
 *   python3 scripts/build-injury-matrix-sheet.py  /tmp/rules.json \
 *           docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx
 *   npm run verify:injury-matrix-sheet
 *
 * ── Sam's resolution model, ruled 2026-07-28 ──
 *
 *   Rules live on EITHER axis — movement pattern or primary muscle.
 *   The STRICTEST matching rule wins (avoid > caution > good).
 *   Named exercise exceptions beat all rules.
 *   There is no precedence ordering to author.
 *
 * That is a lattice join plus an override, which is why no ordering is needed:
 * `strictest` is associative and commutative, so the axes cannot disagree about
 * who goes first.
 *
 * ── What this script does ──
 *
 * Reverse-engineers candidate rules from the cells Sam has ALREADY authored,
 * then proves the rule set reproduces every one of those cells. Divergences are
 * not smoothed over — each becomes a named exception, which is exactly the
 * artifact Sam needs to review. A rule table that could not reproduce the
 * authored data would be a guess wearing the costume of a summary.
 */
const fs = require('fs');

/** Sam's final region list, his order and his labels. */
const REGIONS = ['groin', 'hip', 'quad', 'hamstring', 'knee', 'calf',
  'ankle/foot', 'lowerBack', 'neck', 'shoulder', 'elbow', 'wrist/hand'];
/** Regions with no predecessor in the old 10-key vocabulary — no evidence can exist. */
const NEW_REGIONS = ['hip', 'quad', 'neck'];

const OLD_TO_NEW = {
  adductor: 'groin', pubalgia: 'groin', lowerBack: 'lowerBack', knee: 'knee',
  hamstring: 'hamstring', calf: 'calf', ankle: 'ankle/foot', shoulder: 'shoulder',
  elbow: 'elbow', wrist: 'wrist/hand',
};

const RANK = { good: 0, caution: 1, avoid: 2 };
const strictest = (values) => values.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));

const [, , MATRIX_JSON, OUT_JSON] = process.argv;
const data = JSON.parse(fs.readFileSync(MATRIX_JSON, 'utf8'));

/* ── Migrate the old 10 keys onto the 12 ── */

const rows = data.records.map((r) => {
  const authored = {};
  const add = r.explicit.adductor;
  const pub = r.explicit.pubalgia;
  for (const [key, value] of Object.entries(r.explicit)) {
    if (key === 'adductor' || key === 'pubalgia') continue;
    authored[OLD_TO_NEW[key]] = value;
  }
  // adductor + pubalgia -> groin. A disagreement is NEVER auto-picked: it is left
  // unauthored so it reaches Sam on the conflicts tab with both prior values.
  let conflict = null;
  if (add && pub) {
    if (add === pub) authored.groin = add;
    else conflict = { adductor: add, pubalgia: pub };
  } else if (add) authored.groin = add;
  else if (pub) authored.groin = pub;

  return {
    name: r.name,
    group: r.group,
    movement: r.movement,
    load: r.load,
    primary: (r.muscle || {}).primary || [],
    authored,
    conflict,
  };
});

const strength = rows.filter((r) => r.movement !== 'conditioning');
const conditioning = rows.filter((r) => r.movement === 'conditioning');

/* ── Evidence on each axis ── */

const PATTERNS = [...new Set(strength.map((r) => r.movement))].sort();
const MUSCLES = [...new Set(strength.flatMap((r) => r.primary))].sort();

function tally(keysOf) {
  const out = {};
  for (const r of strength) {
    for (const key of keysOf(r)) {
      out[key] = out[key] || {};
      for (const region of REGIONS) {
        const value = r.authored[region];
        if (!value) continue;
        out[key][region] = out[key][region] || {};
        out[key][region][value] = (out[key][region][value] || 0) + 1;
      }
    }
  }
  return out;
}

/**
 * Propose the rule for one cell: the MOST SUPPORTED value.
 *
 * Deliberately not the strictest observed value. Under a strictest-wins model the
 * rule should carry the ordinary case and let the stricter outliers be named
 * exceptions — otherwise one cautious exercise silently drags a whole pattern to
 * 'avoid' and the exception list, which is the part Sam actually reviews, stays
 * empty and uninformative.
 */
function propose(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, c]) => n + c, 0);
  return {
    value: entries[0][0],
    support: entries[0][1],
    total,
    unanimous: entries.length === 1,
    distribution: Object.fromEntries(entries),
  };
}

function rulesFrom(tallied, keys) {
  const out = {};
  for (const key of keys) {
    out[key] = {};
    for (const region of REGIONS) {
      const counts = tallied[key] && tallied[key][region];
      out[key][region] = counts ? propose(counts) : null;
    }
  }
  return out;
}

const patternRules = rulesFrom(tally((r) => [r.movement]), PATTERNS);
const muscleRules = rulesFrom(tally((r) => r.primary), MUSCLES);

/* ── Evaluate Sam's model ── */

function evaluate(row, region, exceptions) {
  const override = exceptions[`${row.name}|${region}`];
  if (override) return override;
  const candidates = [];
  const byPattern = patternRules[row.movement] && patternRules[row.movement][region];
  if (byPattern) candidates.push(byPattern.value);
  for (const muscle of row.primary) {
    const byMuscle = muscleRules[muscle] && muscleRules[muscle][region];
    if (byMuscle) candidates.push(byMuscle.value);
  }
  // No rule matched. Under Sam's model that is 'good' ONLY once he signs the
  // completeness declaration on the rule tab; until then it is unruled.
  return candidates.length ? strictest(candidates) : null;
}

// Round 1 — rules alone. Every divergence from an AUTHORED cell becomes a named
// exception; that list is the review artifact.
const exceptions = [];
for (const row of strength) {
  for (const region of REGIONS) {
    const authored = row.authored[region];
    if (!authored) continue;
    const derived = evaluate(row, region, {});
    if (derived !== authored) {
      exceptions.push({
        exercise: row.name,
        group: row.group,
        region,
        ruleSays: derived === null ? '(no rule matches)' : derived,
        authored,
        direction: derived === null || RANK[authored] > RANK[derived] ? 'stricter' : 'looser',
      });
    }
  }
}

// Round 2 — prove rules + exceptions reproduce every authored cell exactly.
const exceptionMap = Object.fromEntries(exceptions.map((e) => [`${e.exercise}|${e.region}`, e.authored]));
const unreproduced = [];
for (const row of strength) {
  for (const region of REGIONS) {
    const authored = row.authored[region];
    if (!authored) continue;
    if (evaluate(row, region, exceptionMap) !== authored) {
      unreproduced.push(`${row.name}|${region}`);
    }
  }
}
if (unreproduced.length > 0) {
  throw new Error(
    `rule set fails to reproduce ${unreproduced.length} authored cells: `
    + `${unreproduced.slice(0, 5).join(', ')}. The table would be a guess, not a summary.`,
  );
}

/* ── What the rules produce for every strength cell ── */

for (const row of strength) {
  row.derived = {};
  for (const region of REGIONS) {
    row.derived[region] = evaluate(row, region, exceptionMap);
  }
}

/* ── Which rules actually BIND? ──
 *
 * The two axes are derived from the same authored cells, so they mostly agree —
 * which means most rules are currently redundant: remove one and `strictest`
 * returns the same answer via the other axis. That matters for the sitting. A
 * rule that binds nothing can be LOOSENED with no visible effect, which reads as
 * "my edit did nothing" and is the fastest way to lose trust in the table.
 * (Tightening any rule always has effect, so redundancy is asymmetric, not
 * harmless.) Flagged per cell so the workbook can show it.
 */
function bindsAnything(axis, key, region) {
  for (const row of strength) {
    if (axis === 'pattern' && row.movement !== key) continue;
    if (axis === 'muscle' && !row.primary.includes(key)) continue;
    if (exceptionMap[`${row.name}|${region}`]) continue;   // exception wins regardless

    const candidates = [];
    const byPattern = patternRules[row.movement] && patternRules[row.movement][region];
    if (byPattern && !(axis === 'pattern' && key === row.movement)) candidates.push(byPattern.value);
    for (const muscle of row.primary) {
      const byMuscle = muscleRules[muscle] && muscleRules[muscle][region];
      if (byMuscle && !(axis === 'muscle' && key === muscle)) candidates.push(byMuscle.value);
    }
    const without = candidates.length ? strictest(candidates) : null;
    if (without !== row.derived[region]) return true;
  }
  return false;
}

let binding = 0;
for (const [axis, rules] of [['pattern', patternRules], ['muscle', muscleRules]]) {
  for (const [key, byRegion] of Object.entries(rules)) {
    for (const [region, rule] of Object.entries(byRegion)) {
      if (!rule) continue;
      rule.binds = bindsAnything(axis, key, region);
      if (rule.binds) binding += 1;
    }
  }
}

const evidenceCells = (rules) => Object.values(rules)
  .reduce((n, byRegion) => n + Object.values(byRegion).filter(Boolean).length, 0);

const summary = {
  strength: strength.length,
  conditioning: conditioning.length,
  patterns: PATTERNS.length,
  muscles: MUSCLES.length,
  patternGridCells: PATTERNS.length * REGIONS.length,
  muscleGridCells: MUSCLES.length * REGIONS.length,
  patternEvidence: evidenceCells(patternRules),
  muscleEvidence: evidenceCells(muscleRules),
  exceptions: exceptions.length,
  exceptionsStricter: exceptions.filter((e) => e.direction === 'stricter').length,
  exceptionsLooser: exceptions.filter((e) => e.direction === 'looser').length,
  conflicts: rows.filter((r) => r.conflict).length,
  bindingRules: binding,
  redundantRules: evidenceCells(patternRules) + evidenceCells(muscleRules) - binding,
  authoredCells: strength.reduce((n, r) => n + Object.keys(r.authored).length, 0)
    + conditioning.reduce((n, r) => n + Object.keys(r.authored).length, 0),
};

fs.writeFileSync(OUT_JSON, JSON.stringify({
  REGIONS, NEW_REGIONS, PATTERNS, MUSCLES,
  patternRules, muscleRules, exceptions, rows, strength, conditioning, summary,
}, null, 2));

console.log(`patterns ${summary.patterns} x ${REGIONS.length} = ${summary.patternGridCells} grid cells, `
  + `${summary.patternEvidence} evidence-backed`);
console.log(`muscles  ${summary.muscles} x ${REGIONS.length} = ${summary.muscleGridCells} grid cells, `
  + `${summary.muscleEvidence} evidence-backed`);
console.log(`exceptions ${summary.exceptions} `
  + `(${summary.exceptionsStricter} stricter than the rule, ${summary.exceptionsLooser} looser)`);
console.log(`of ${summary.patternEvidence + summary.muscleEvidence} rules, ${summary.bindingRules} BIND today `
  + `and ${summary.redundantRules} are redundant (the other axis already decides)`);
console.log(`rules + exceptions reproduce all ${summary.authoredCells} authored cells — 0 divergences`);
