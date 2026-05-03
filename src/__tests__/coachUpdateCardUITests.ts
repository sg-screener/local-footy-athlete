/**
 * coachUpdateCardUITests — source-level UI contract for the Program tab
 * Coach Update card. This repo does not currently ship a React Native
 * renderer test harness, so these tests pin the component structure that
 * controls the collapsed/expanded MVP behavior.
 *
 * Run: npm run test:coach-update-card-ui
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  \u2713 ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`);
  }
}
function section(label: string) { console.log(`\n${label}`); }

const CARD = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'CoachUpdateCard.tsx'),
  'utf8',
);

section('[1] Default collapsed render keeps only compact essentials visible');
{
  ok('card eyebrow renders COACH UPDATE', />\s*COACH UPDATE\s*</.test(CARD));
  ok('active issue list renders from issueLines(update)', /const issues = issueLines\(update\)/.test(CARD));
  ok('collapsed issue container exists', /testID="coach-update-issues"/.test(CARD));
  ok('Update coach button is on the card', /testID="coach-update-update-coach"/.test(CARD));
  ok('Show details button is on the card', /testID="coach-update-toggle-details"/.test(CARD));
  ok('details state starts collapsed', /React\.useState\(false\)/.test(CARD));
}

section('[2] Default render hides detail sections');
{
  ok('Avoid section is gated by showDetails', /showDetails && hasPlanLayer && avoid\.length > 0/.test(CARD));
  ok('Do instead section is gated by showDetails', /showDetails && hasPlanLayer && substituteWith\.length > 0/.test(CARD));
  ok('Keep section is gated by showDetails', /showDetails && hasPlanLayer && keep\.length > 0/.test(CARD));
  ok('Advice section is gated by showDetails', /showDetails && hasAdvice/.test(CARD));
  ok('truth-gate Avoid guidance is gated by showDetails', /showDetails && hasTruthGate && guidance\.length > 0/.test(CARD));
  ok('unchanged/advice text is gated by showDetails', /showDetails && hasTruthGate && update\.unchangedReason/.test(CARD));
}

section('[3] Toggle expands and collapses details');
{
  ok('toggle flips showDetails', /setShowDetails\(\(v\) => !v\)/.test(CARD));
  ok('collapsed button says Show details', /showDetails \? 'Hide details' : 'Show details'/.test(CARD));
  ok('expanded button says Hide details', /showDetails \? 'Hide details' : 'Show details'/.test(CARD));
}

section('[4] Multiple active issues remain visible while collapsed');
{
  ok('reason fallback splits multiple issues on bullet separator', /\.split\(\s*\/\\s\+\u2022\\s\+\|\\n\+\/\s*\)/.test(CARD));
  ok('issue lines map to visible Text rows', /issues\.map\(\(issue, i\) =>/.test(CARD));
}

section('[5] Expanded copy avoids misleading Sub in label');
{
  ok('plan suggestions render as Do instead', />\s*Do instead\s*</.test(CARD));
  ok('component does not render Sub in label', !/>\s*Sub in\s*</.test(CARD));
  ok('legacy sub-in testID was renamed', !/coach-update-sub-in/.test(CARD));
}

section('[6] Program-tab card stays compact by layout');
{
  ok('Update coach and Show details share an action row', /testID="coach-update-actions"/.test(CARD));
  ok('action row supports wrapping on tight screens', /flexWrap:\s*'wrap'/.test(CARD));
  ok('Update coach is primary filled', /backgroundColor:\s*'#C8FF00'/.test(CARD));
  ok('Show details is secondary outline', /secondaryButton:[\s\S]*backgroundColor:\s*'transparent'/.test(CARD));
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
