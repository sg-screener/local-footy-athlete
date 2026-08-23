import {
  COACH_LAB_CASES,
  coachLabFixtureSnapshot,
} from '../src/dev/coachLab/coachLabCases';
import { runCoachLab } from '../src/dev/coachLab/coachLab';
import { currentReadOnlyCoachCandidate } from '../src/dev/coachLab/currentReadOnlyCoachCandidate';

const report = runCoachLab({
  cases: COACH_LAB_CASES,
  snapshot: coachLabFixtureSnapshot(),
  candidate: currentReadOnlyCoachCandidate,
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log('\nCOACH LAB — CURRENT READ-ONLY BASELINE\n');
for (const result of report.results) {
  const mark = result.verdict === 'automatic_fail' ? 'FAIL' : 'REVIEW';
  const failedChecks = Object.entries(result.automaticChecks)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  console.log(`[${mark}] ${result.caseId}`);
  console.log(`Athlete: ${result.athleteMessage}`);
  console.log(`Coach:   ${result.response.message}`);
  console.log(`Checks:  ${failedChecks.length > 0 ? failedChecks.join(', ') : 'automatic boundaries clear'}`);
  console.log('Owner:   pending\n');
}

console.log(`Cases: ${report.summary.cases}`);
console.log(`Automatic failures: ${report.summary.automaticFail}`);
console.log(`Waiting for owner review: ${report.summary.needsOwnerReview}`);
console.log(`Approved answers: ${report.summary.approved}`);
