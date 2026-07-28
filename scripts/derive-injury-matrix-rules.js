/**
 * Derive the injury matrix from Sam's AUTHORED RULING SET.
 *
 *   node    scripts/extract-injury-matrix.js      /tmp/matrix.json
 *   node    scripts/derive-injury-matrix-rules.js /tmp/matrix.json \
 *           docs/INJURY_MATRIX_RULINGS_2026-07-28.json /tmp/rules.json
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
 * A lattice join plus an override: `strictest` is associative and commutative,
 * so the axes cannot disagree about who goes first.
 *
 * ── DECLARATION, signed by Sam 2026-07-28 ──
 *
 *   "Any exercise/region cell with no matching rule and no exception = good.
 *    From here, 'good' is always authored, never assumed."
 *
 * That signature is what makes an unmatched cell mean something. Before it, an
 * unmatched cell was UNRULED and had to fail the build. `declaration.signed`
 * gates that: unsign it and unmatched cells go back to null, which is the
 * correct failure direction rather than a silent 'good'.
 *
 * Evidence rules on the pre-existing 9 regions are reverse-engineered from the
 * ratings already in `exerciseTags.ts`; rules on the 4 NEW regions
 * (hip, quad, neck, ribs) are Sam's, because no evidence for them can exist.
 */
const fs = require('fs');

const RANK = { good: 0, caution: 1, avoid: 2 };
const strictest = (values) => values.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));

const [, , MATRIX_JSON, RULINGS_JSON, OUT_JSON] = process.argv;
const data = JSON.parse(fs.readFileSync(MATRIX_JSON, 'utf8'));
const ruling = JSON.parse(fs.readFileSync(RULINGS_JSON, 'utf8'));

const REGIONS = ruling.regions;
const NEW_REGIONS = ruling.newRegions;
const OLD_TO_NEW = {
  adductor: 'groin', pubalgia: 'groin', lowerBack: 'lowerBack', knee: 'knee',
  hamstring: 'hamstring', calf: 'calf', ankle: 'ankle/foot', shoulder: 'shoulder',
  elbow: 'elbow', wrist: 'wrist/hand',
};

/* ── Migrate the old 10 keys onto Sam's regions, applying his conflict rulings ── */

const resolutions = ruling.conflictResolutions;
const rows = data.records.map((r) => {
  const authored = {};
  for (const [key, value] of Object.entries(r.explicit)) {
    if (key === 'adductor' || key === 'pubalgia') continue;
    authored[OLD_TO_NEW[key]] = value;
  }
  const add = r.explicit.adductor;
  const pub = r.explicit.pubalgia;
  let resolvedConflict = null;
  if (add && pub) {
    if (add === pub) authored.groin = add;
    else {
      // Ruling 1 — Sam picked these by hand. Nothing was auto-merged.
      const ruled = resolutions[r.name];
      if (!ruled) throw new Error(`unruled adductor/pubalgia conflict on "${r.name}"`);
      authored.groin = ruled;
      resolvedConflict = { adductor: add, pubalgia: pub, ruled };
    }
  } else if (add) authored.groin = add;
  else if (pub) authored.groin = pub;

  return {
    name: r.name, group: r.group, movement: r.movement, load: r.load,
    primary: (r.muscle || {}).primary || [],
    authored, resolvedConflict,
  };
});

const strength = rows.filter((r) => r.movement !== 'conditioning');
const conditioning = rows.filter((r) => r.movement === 'conditioning');
const PATTERNS = [...new Set(strength.map((r) => r.movement))].sort();
const MUSCLES = [...new Set(strength.flatMap((r) => r.primary))].sort();

/* ── Evidence rules on the pre-existing regions ── */

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
 * The MOST SUPPORTED value, not the strictest observed one. Under strictest-wins
 * the rule should carry the ordinary case and let stricter outliers be named
 * exceptions — otherwise one cautious exercise drags a whole pattern to 'avoid'
 * and the exception list, the part Sam actually reviews, stays empty.
 */
function propose(counts, source) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    value: entries[0][0],
    support: entries[0][1],
    total: entries.reduce((n, [, c]) => n + c, 0),
    unanimous: entries.length === 1,
    source,
  };
}

/**
 * MINIMUM SUPPORT — Sam's ruling, 2026-07-28: a rule needs at least two authored
 * cells behind it, on BOTH axes.
 *
 * One exercise is not evidence about a category. `Back Squat` authored
 * shoulder='caution' because the bar sits on the back, and `Front Squat`
 * authored wrist='caution' because of the front rack. Both are Quads/Glutes
 * primary, so a single-cell muscle rule generalised those into "any Quads- or
 * Glutes-primary exercise cautions shoulder and wrist" — which cautioned Hip
 * Thrusts and Glute Bridge for a shoulder injury. The grid rendered it
 * "caution ·1/1", so it read as agreement rather than as one data point.
 *
 * Nothing authored is lost when a rule dies: the cell that fed it now diverges
 * from the declaration, so the exception pass below mints a named exception
 * carrying its ORIGINAL rating. Lift, never re-decide.
 */
const MIN_RULE_SUPPORT = 2;

function rulesFrom(tallied, keys) {
  const out = {};
  for (const key of keys) {
    out[key] = {};
    for (const region of REGIONS) {
      const counts = tallied[key] && tallied[key][region];
      const total = counts ? Object.values(counts).reduce((n, c) => n + c, 0) : 0;
      out[key][region] = counts && total >= MIN_RULE_SUPPORT ? propose(counts, 'evidence') : null;
    }
  }
  return out;
}

const patternRules = rulesFrom(tally((r) => [r.movement]), PATTERNS);
const muscleRules = rulesFrom(tally((r) => r.primary), MUSCLES);

/* ── Sam's rules for the NEW regions (no evidence can exist for these) ── */

for (const [region, patterns] of Object.entries(ruling.newRegionPatternRules)) {
  if (region === '_') continue;
  for (const pattern of patterns) {
    if (!patternRules[pattern]) throw new Error(`ruling names unknown pattern "${pattern}"`);
    patternRules[pattern][region] = { value: 'caution', source: 'sam', unanimous: true };
  }
}
/**
 * INERT RULES. A rule may name a muscle that is real in Sam's authored
 * MuscleGroup vocabulary but is never a PRIMARY muscle on any strength exercise.
 * Such a rule can never fire. That is not a typo and must not be silently
 * dropped — it is recorded, flagged, and reported, because a ruling that binds
 * nothing is the same failure mode as `pubalgia`: authored, and unreachable.
 * A muscle absent from the vocabulary entirely IS a typo, and still throws.
 */
const muscleVocabulary = new Set(data.muscleVocabulary || []);
const inertRules = [];
for (const [region, muscles] of Object.entries(ruling.newRegionMuscleRules)) {
  if (region === '_') continue;
  for (const muscle of muscles) {
    if (!muscleRules[muscle]) {
      if (!muscleVocabulary.has(muscle)) {
        throw new Error(`ruling names unknown muscle "${muscle}" — not in the authored vocabulary`);
      }
      inertRules.push({
        axis: 'muscle', key: muscle, region,
        why: `"${muscle}" is in the authored vocabulary but is never a PRIMARY muscle on any `
          + 'strength exercise, so this rule can never fire',
      });
      continue;
    }
    muscleRules[muscle][region] = { value: 'caution', source: 'sam', unanimous: true };
  }
}

/* ── Conditioning, ruled by hand ── */

const conditioningRuling = {};
const lowerBody = ruling.conditioning.lowerBodyRegions;
for (const [family, spec] of Object.entries(ruling.conditioning.families)) {
  if (family === '_') continue;
  const regions = spec.caution.flatMap((r) => (r === '__LOWER_BODY__' ? lowerBody : [r]));
  for (const member of spec.members) {
    if (!conditioning.some((c) => c.name === member)) {
      throw new Error(`conditioning ruling names unknown exercise "${member}"`);
    }
    conditioningRuling[member] = { family, regions };
  }
}
const uncovered = conditioning.filter((c) => !conditioningRuling[c.name]);
if (uncovered.length > 0) {
  throw new Error(`conditioning rows with no ruling: ${uncovered.map((c) => c.name).join(', ')}`);
}

/* ── Evaluate ── */

function ruleCandidates(row, region) {
  const candidates = [];
  const byPattern = patternRules[row.movement] && patternRules[row.movement][region];
  if (byPattern) candidates.push(byPattern.value);
  for (const muscle of row.primary) {
    const byMuscle = muscleRules[muscle] && muscleRules[muscle][region];
    if (byMuscle) candidates.push(byMuscle.value);
  }
  return candidates;
}

function evaluateStrength(row, region, exceptionMap) {
  const override = exceptionMap[`${row.name}|${region}`];
  if (override) return override;
  const candidates = ruleCandidates(row, region);
  if (candidates.length > 0) return strictest(candidates);
  // Unmatched. Only the signed declaration turns that into 'good'.
  return ruling.declaration.signed ? 'good' : null;
}

// Exceptions = where the rules disagree with an authored rating. Sam ruled that
// all 18 stand; any that now AGREE with the rules dissolve into them.
const exceptions = [];
for (const row of strength) {
  for (const region of REGIONS) {
    const authored = row.authored[region];
    if (!authored) continue;
    const candidates = ruleCandidates(row, region);
    const derived = candidates.length > 0
      ? strictest(candidates)
      : (ruling.declaration.signed ? 'good' : null);
    if (derived !== authored) {
      exceptions.push({
        exercise: row.name, group: row.group, region,
        ruleSays: derived === null ? '(no rule matches)' : derived,
        authored,
        direction: derived === null || RANK[authored] > RANK[derived] ? 'stricter' : 'looser',
      });
    }
  }
}
// Sam may author an exception DIRECTLY, rather than it falling out of a
// disagreement with an existing rating. Shrugs/neck is one: nothing in the code
// authored it, so no divergence could surface it.
for (const [key, value] of Object.entries(ruling.extraExceptions || {})) {
  if (key === '_') continue;
  const [exercise, region] = key.split('|');
  const row = strength.find((r) => r.name === exercise);
  if (!row) throw new Error(`extra exception names unknown exercise "${exercise}"`);
  if (!REGIONS.includes(region)) throw new Error(`extra exception names unknown region "${region}"`);
  const candidates = ruleCandidates(row, region);
  const wouldBe = candidates.length > 0 ? strictest(candidates)
    : (ruling.declaration.signed ? 'good' : null);
  exceptions.push({
    exercise, group: row.group, region,
    ruleSays: wouldBe === null ? '(no rule matches)' : wouldBe,
    authored: value,
    direction: wouldBe === null || RANK[value] > RANK[wouldBe] ? 'stricter' : 'looser',
    samAuthored: true,
  });
}

const exceptionMap = Object.fromEntries(exceptions.map((e) => [`${e.exercise}|${e.region}`, e.authored]));

// Fidelity: rules + exceptions must reproduce every authored strength rating.
const unreproduced = [];
for (const row of strength) {
  for (const region of REGIONS) {
    const authored = row.authored[region];
    if (!authored) continue;
    if (evaluateStrength(row, region, exceptionMap) !== authored) {
      unreproduced.push(`${row.name}|${region}`);
    }
  }
}
if (unreproduced.length > 0) {
  throw new Error(`rule set fails to reproduce ${unreproduced.length} authored cells: `
    + `${unreproduced.slice(0, 5).join(', ')}`);
}

/* ── The FINAL matrix ── */

for (const row of strength) {
  row.final = {};
  row.finalSource = {};
  for (const region of REGIONS) {
    const value = evaluateStrength(row, region, exceptionMap);
    row.final[region] = value;
    row.finalSource[region] = exceptionMap[`${row.name}|${region}`] ? 'exception'
      : ruleCandidates(row, region).length > 0 ? 'rule' : 'declaration';
  }
}

// Conditioning: hand ruling joined with whatever is already authored, strictest wins.
const conditioningContradictions = [];
for (const row of conditioning) {
  const spec = conditioningRuling[row.name];
  row.family = spec.family;
  row.final = {};
  row.finalSource = {};
  for (const region of REGIONS) {
    const authored = row.authored[region];
    const ruled = spec.regions.includes(region) ? 'caution' : null;
    let value;
    let source;
    if (authored && ruled) {
      value = strictest([authored, ruled]);
      source = value === authored && authored !== ruled ? 'authored (stricter)' : 'ruling';
      if (RANK[authored] < RANK[ruled]) conditioningContradictions.push(
        `${row.name}.${region}: authored ${authored} loosened by ruling ${ruled}`);
    } else if (authored) { value = authored; source = 'authored'; }
    else if (ruled) { value = ruled; source = 'ruling'; }
    else { value = ruling.declaration.signed ? 'good' : null; source = 'declaration'; }
    row.final[region] = value;
    row.finalSource[region] = source;
  }
}

/* ── Which rules BIND? ──
 *
 * Both axes are derived from the same ratings, so they largely agree and most
 * rules are redundant: remove one and `strictest` returns the same answer via the
 * other. That matters asymmetrically — a non-binding rule can be LOOSENED with no
 * visible effect, which reads as "my edit did nothing", while TIGHTENING any rule
 * always has effect.
 */
function bindCount(axis, key, region) {
  let count = 0;
  for (const row of strength) {
    if (axis === 'pattern' && row.movement !== key) continue;
    if (axis === 'muscle' && !row.primary.includes(key)) continue;
    if (exceptionMap[`${row.name}|${region}`]) continue;

    const candidates = [];
    const byPattern = patternRules[row.movement] && patternRules[row.movement][region];
    if (byPattern && !(axis === 'pattern' && key === row.movement)) candidates.push(byPattern.value);
    for (const muscle of row.primary) {
      const byMuscle = muscleRules[muscle] && muscleRules[muscle][region];
      if (byMuscle && !(axis === 'muscle' && key === muscle)) candidates.push(byMuscle.value);
    }
    const without = candidates.length > 0 ? strictest(candidates)
      : (ruling.declaration.signed ? 'good' : null);
    if (without !== row.final[region]) count += 1;
  }
  return count;
}

let binding = 0;
let ruleCells = 0;
for (const [axis, rules] of [['pattern', patternRules], ['muscle', muscleRules]]) {
  for (const [key, byRegion] of Object.entries(rules)) {
    for (const [region, rule] of Object.entries(byRegion)) {
      if (!rule) continue;
      ruleCells += 1;
      rule.binds = bindCount(axis, key, region);
      if (rule.binds > 0) binding += 1;
    }
  }
}

/* ── Counts ── */

const allRows = [...strength, ...conditioning];
const distribution = {};
for (const row of allRows) {
  for (const region of REGIONS) {
    const value = row.final[region];
    distribution[value ?? 'UNRULED'] = (distribution[value ?? 'UNRULED'] || 0) + 1;
  }
}
const sourceCounts = {};
for (const row of allRows) {
  for (const region of REGIONS) {
    const source = row.finalSource[region];
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  }
}

const summary = {
  regions: REGIONS.length,
  exercises: allRows.length,
  strength: strength.length,
  conditioning: conditioning.length,
  cells: allRows.length * REGIONS.length,
  patterns: PATTERNS.length,
  muscles: MUSCLES.length,
  ruleCells,
  samRuleCells: Object.values(patternRules).concat(Object.values(muscleRules))
    .reduce((n, byRegion) => n + Object.values(byRegion).filter((r) => r && r.source === 'sam').length, 0),
  bindingRules: binding,
  redundantRules: ruleCells - binding,
  exceptions: exceptions.length,
  exceptionsStricter: exceptions.filter((e) => e.direction === 'stricter').length,
  exceptionsLooser: exceptions.filter((e) => e.direction === 'looser').length,
  conflictsResolved: rows.filter((r) => r.resolvedConflict).length,
  distribution,
  sourceCounts,
  conditioningContradictions,
  inertRules,
  declarationSigned: ruling.declaration.signed,
};

fs.writeFileSync(OUT_JSON, JSON.stringify({
  REGIONS, NEW_REGIONS, PATTERNS, MUSCLES,
  patternRules, muscleRules, exceptions, rows, strength, conditioning,
  conditioningRuling, routing: ruling.routing, declaration: ruling.declaration, inertRules,
  principle: ruling.conditioning.principle, summary,
}, null, 2));

console.log(`regions ${REGIONS.length} | exercises ${summary.exercises} | cells ${summary.cells}`);
console.log(`rules ${ruleCells} (${summary.samRuleCells} authored by Sam for the new regions) | `
  + `${binding} bind, ${summary.redundantRules} redundant`);
console.log(`exceptions ${summary.exceptions} `
  + `(${summary.exceptionsStricter} stricter, ${summary.exceptionsLooser} looser)`);
console.log(`conflicts resolved by Sam: ${summary.conflictsResolved}`);
console.log(`final distribution: ${JSON.stringify(distribution)}`);
console.log(`cell sources: ${JSON.stringify(sourceCounts)}`);
if (inertRules.length > 0) {
  console.log(`INERT RULES (recorded, cannot fire): `
    + inertRules.map((r) => `${r.axis} ${r.key}/${r.region}`).join(', '));
}
if (conditioningContradictions.length > 0) {
  console.log(`CONDITIONING CONTRADICTIONS: ${conditioningContradictions.join(' ; ')}`);
}
