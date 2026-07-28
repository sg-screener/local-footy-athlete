/**
 * ONE SEVERITY SCALE — the gate that keeps injury and fatigue on it.
 *
 * SAM'S RULING (2026-07-28, Batch 4):
 * > ONE 1-10 severity scale serves injury and fatigue, ruled deliberately.
 * > Bands are the Bible's: 1-3 / 4-5 / 6-7 / 8-10. All fatigue cut points align
 * > to band edges: record-only <4, moderate effects >=4, strong/limiting
 * > effects >=6 (every stray >=7 moves to >=6), pause >=8.
 *
 * The fatigue path was already using the injury bands' edges by INHERITANCE
 * rather than by decision, plus a scattering of `>= 7` cut points belonging to
 * no band at all. Eleven sites asserted that the two scales were the same thing
 * without anyone having ruled it. Sam has now ruled it, so this gate holds the
 * numbers in one place and keeps the eleven readers numberless.
 *
 * TIME CAPS ARE NOT ON THIS LADDER (Sam, same ruling):
 * > "short on time" = 35 minutes, one owner. The minutes->severity conversion
 * > dies — short time shapes the SESSION, never scores the ATHLETE.
 *
 * Run: npm run test:severity-scale
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  BIBLE_INJURY_SEVERITY_BANDS,
  SHARED_SEVERITY_SCALE_RULING,
  severityIsRecordOnly,
  severityHasModerateEffect,
  severityIsLimiting,
  severityPausesTraining,
} from '../rules/injurySeverityBands';
import { SHORT_ON_TIME_MINUTES } from '../rules/timeAvailabilityPolicy';
import {
  HIGH_IMPACT_REMOVED_SHARE,
  MODERATE_IMPACT_REMOVED_COUNT,
} from '../rules/sessionImpactBands';
import { SUBSTITUTE_LOAD_TOLERANCE } from '../rules/substituteLoadTolerance';

const src = path.resolve(__dirname, '..');
let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}`);
  if (detail !== undefined) console.error(`       ${JSON.stringify(detail)}`);
}

function codeOf(relative: string): string {
  return fs.readFileSync(path.join(src, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n');
}

console.log('severityScaleOwnershipTests');

console.log('\n[1] The ruling is attributed and the bands are the Bible\'s');
{
  ok('the ruling is dated', /^\d{4}-\d{2}-\d{2}$/.test(SHARED_SEVERITY_SCALE_RULING.ruledOn));
  const doc = path.resolve(src, '..', SHARED_SEVERITY_SCALE_RULING.where);
  ok('the attributed document exists', fs.existsSync(doc), SHARED_SEVERITY_SCALE_RULING.where);
  const edges = BIBLE_INJURY_SEVERITY_BANDS.map((b) => `${b.min}-${b.max}`).join(' / ');
  ok('the bands are 1-3 / 4-5 / 6-7 / 8-10', edges === '1-3 / 4-5 / 6-7 / 8-10', edges);
  ok('the recorded band string matches the bands',
    SHARED_SEVERITY_SCALE_RULING.bands === edges, SHARED_SEVERITY_SCALE_RULING.bands);
}

console.log('\n[2] Every cut point sits on a band edge, for BOTH kinds of fact');
{
  // The whole content of the ruling, as arithmetic. If someone re-splits a band
  // — a `>= 7` returning, say — one of these flips.
  const table: Array<[number, boolean, boolean, boolean, boolean]> = [
    // severity, recordOnly, moderate, limiting, pause
    [1, true, false, false, false],
    [3, true, false, false, false],
    [4, false, true, false, false],
    [5, false, true, false, false],
    [6, false, true, true, false],
    [7, false, true, true, false],
    [8, false, true, true, true],
    [10, false, true, true, true],
  ];
  for (const [severity, recordOnly, moderate, limiting, pause] of table) {
    ok(`severity ${severity}: record-only=${recordOnly} moderate=${moderate} `
      + `limiting=${limiting} pause=${pause}`,
      severityIsRecordOnly(severity) === recordOnly &&
      severityHasModerateEffect(severity) === moderate &&
      severityIsLimiting(severity) === limiting &&
      severityPausesTraining(severity) === pause,
      {
        recordOnly: severityIsRecordOnly(severity),
        moderate: severityHasModerateEffect(severity),
        limiting: severityIsLimiting(severity),
        pause: severityPausesTraining(severity),
      });
  }
  // The specific thing Sam ruled away: 7 is the INTERIOR of the 6-7 band, so a
  // cut point there splits a band the Bible draws whole. 6 and 7 must agree on
  // every predicate.
  ok('6 and 7 are indistinguishable — no cut point may sit inside a band',
    severityIsRecordOnly(6) === severityIsRecordOnly(7) &&
    severityHasModerateEffect(6) === severityHasModerateEffect(7) &&
    severityIsLimiting(6) === severityIsLimiting(7) &&
    severityPausesTraining(6) === severityPausesTraining(7));
}

console.log('\n[3] The eleven fatigue readers hold no severity numbers of their own');
{
  // Named individually: a file dropping off this list is a file that stopped
  // being checked, which is the absence-rendered-as-approval defect.
  const READERS = [
    'utils/activeProgramModifiers.ts',
    'rules/temporarySourceFact.ts',
    'utils/constraintPlan.ts',
    'utils/programEditRiskAssessment.ts',
    'utils/tapSwapHierarchy.ts',
  ];
  // A severity compared against a bare number. `severity >= 4`, `c.severity < 8`,
  // `effectiveSeverity <= 3` — the shape the eleven were written in.
  const LITERAL = /\bseverity\b\s*(?:>=|<=|>|<|===|!==)\s*-?\d/i;
  for (const reader of READERS) {
    const code = codeOf(reader);
    const hits = code.split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter((entry) => LITERAL.test(entry.line));
    ok(`${reader} compares severity against no literal`, hits.length === 0,
      hits.map((h) => `${h.number}: ${h.line.slice(0, 90)}`));
  }
}

console.log('\n[4] Time caps are OFF the severity ladder');
{
  ok('there is one authored short-on-time threshold', SHORT_ON_TIME_MINUTES === 35,
    SHORT_ON_TIME_MINUTES);

  // The conversion Sam killed: minutes deciding a severity number. Short time
  // shapes the session; it does not score the athlete.
  for (const reader of ['utils/readinessConstraints.ts', 'utils/readiness.ts',
    'utils/coachReadinessAdapter.ts']) {
    const code = codeOf(reader);
    ok(`${reader} does not convert minutes into a severity`,
      !/timeAvailableMinutes[^;]*\?[^;]*\d[^;]*:[^;]*\d/.test(code) &&
      !/severity:\s*[^,;]*Minutes/i.test(code));
    ok(`${reader} holds no second short-on-time literal`,
      !/timeAvailableMinutes\s*[<>]=?\s*\d/.test(code) &&
      !/minutes\s*[<>]=?\s*(?:35|45)\b/i.test(code));
  }
}

console.log('\n[5] Batch 6 — the display numbers have one owner each');
{
  // Sam blessed the VALUES and ruled the duplicates collapsed. The blessing is
  // the smaller half: two copies of a display rule agree until one is tuned,
  // and then the same change reads "high impact" down one path and "moderate"
  // down the other, with nothing anywhere noticing.
  ok('the impact bands are authored once',
    HIGH_IMPACT_REMOVED_SHARE === 0.5 && MODERATE_IMPACT_REMOVED_COUNT === 2,
    { HIGH_IMPACT_REMOVED_SHARE, MODERATE_IMPACT_REMOVED_COUNT });
  ok('the substitute tolerance is authored once', SUBSTITUTE_LOAD_TOLERANCE === 0.2,
    SUBSTITUTE_LOAD_TOLERANCE);

  for (const reader of ['utils/exposureEngine.ts', 'utils/trainAroundEngine.ts']) {
    const code = codeOf(reader);
    ok(`${reader} holds no impact-band literal`,
      !/removed[A-Za-z]*(?:\.length)?\s*\/\s*[^;]*>=\s*0?\.5\b/.test(code) &&
      !/removed[A-Za-z]*(?:\.length)?\s*>=\s*2\b/.test(code));
  }

  // AND THE 0.75 MUST STAY. Sam ruled it keeps its existing citation, so this
  // asserts its SURVIVAL, not its absence — a collapse that swept it up would
  // move a program decision into a display owner and quietly retire a Bible
  // rule. The two halves of the ruling pull in opposite directions and both
  // need holding.
  ok('the 0.75 program cut point survives in exposureEngine',
    /removedNames\.length \/ totalScored >= 0\.75/.test(codeOf('utils/exposureEngine.ts')));
  {
    const code = codeOf('utils/exerciseSubstitutes.ts');
    // All THREE copies, including the negated `<= -0.2` that reads least like
    // the other two and was the one nearly left behind.
    ok('utils/exerciseSubstitutes.ts holds no load-tolerance literal',
      !/loadRatio[^;\n]*[<>]=?\s*-?0?\.2\b/.test(code) &&
      !/loadDelta\s*[<>]=?\s*-?0?\.2\b/.test(code));
  }

  // The 0.75 keeps its own citation and its own home: it is a PROGRAM decision
  // (session -> recovery or rebuild), not a label, so it must NOT migrate here.
  ok('the 0.75 program cut point stays out of the label owner',
    !/0\.75/.test(codeOf('rules/sessionImpactBands.ts')));
}

console.log(`\n${failures.length === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
