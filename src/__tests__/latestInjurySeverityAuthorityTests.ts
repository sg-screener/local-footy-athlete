/**
 * THE LATEST REPORTED SEVERITY IS THE AUTHORITY — the guard for Sam's ruling.
 *
 * SAM, 2026-08-21: *"Trust the athlete's latest reported injury number
 * immediately. Do not stage the return."*
 *
 * WHAT THIS REPLACES. `rules/injuryReintroduction.ts` computed an EFFECTIVE
 * severity that relaxed at most one band per report, so an athlete who came down
 * from 8 and reported 4 was still restricted as a 6. `generationConstraints`
 * carried that answer on a second field, `effectiveSeverity`, and every gate
 * read THAT rather than the number the athlete gave. The rule, the field and the
 * `priorSeverity` input it needed are all deleted.
 *
 * WHAT THIS SUITE HOLDS. Not the absence of a module — that is a grep. It holds
 * the BEHAVIOUR: for any pair of reports, the restrictions the athlete gets are
 * the ones their LATEST number earns, and a history of worse injuries buys the
 * app no extra caution. The strongest cell is the equivalence one — a stepped
 * report and a fresh report of the same number must produce identical gates —
 * because that is the exact thing staging used to break.
 *
 * Run: npm run test:injury-latest-severity
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import {
  classifyBibleInjurySeverity,
  injurySeverityReducesAffectedWork,
  injurySeverityRemovesRiskyWork,
  injurySeverityPausesAffectedTraining,
} from '../rules/injurySeverityBands';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass += 1; console.log(`  ok ${name}`); }
  else { fail += 1; failures.push(name); console.log(`  FAIL ${name}${detail === undefined ? '' : `\n       ${JSON.stringify(detail)}`}`); }
}

const BUCKETS: readonly NonNullable<ActiveInjuryConstraint['bucket']>[] =
  ['hamstring', 'knee', 'adductor', 'calf', 'shoulder'] as never;

function injuryConstraint(over: Partial<ActiveInjuryConstraint>): ActiveInjuryConstraint {
  return {
    id: `injury-${over.bucket ?? 'x'}`, type: 'injury', bodyPart: String(over.bucket ?? 'x'),
    bucket: (over.bucket ?? null) as ActiveInjuryConstraint['bucket'], severity: 6, status: 'improving',
    startDate: '2026-07-01', lastUpdatedAt: '2026-07-01', rules: [], safeFocus: [], advice: [],
    ...over,
  } as ActiveInjuryConstraint;
}

/** The generation gates the athlete's number actually earns. */
function gatesFor(over: Partial<ActiveInjuryConstraint>) {
  const context = buildGenerationConstraintContext({
    activeConstraints: [injuryConstraint(over)],
    todayISO: '2026-07-01',
  });
  const injury = context?.injuries[0];
  if (!injury) return null;
  return {
    severity: injury.severity,
    severityBand: injury.severityBand,
    reduceAffectedWork: injury.reduceAffectedWork,
    removeRiskyWork: injury.removeRiskyWork,
    pauseAffectedTraining: injury.pauseAffectedTraining,
    onboardingSeverity: injury.onboardingSeverity,
    activeInjuryKeys: [...(context?.activeInjuryKeys ?? [])].sort(),
  };
}

console.log('\n[0] NON-VACUITY — the gates move with the number at all');
{
  const mild = gatesFor({ bucket: 'knee', severity: 2 });
  const severe = gatesFor({ bucket: 'knee', severity: 9 });
  ok('a context is built for both ends', !!mild && !!severe);
  ok('2/10 and 9/10 do NOT produce the same gates',
    JSON.stringify(mild) !== JSON.stringify(severe), { mild, severe });
  ok('9/10 pauses affected training, 2/10 does not',
    severe?.pauseAffectedTraining === true && mild?.pauseAffectedTraining === false,
    { mild: mild?.pauseAffectedTraining, severe: severe?.pauseAffectedTraining });
}

console.log('\n[1] THE REPORTED NUMBER IS THE ONE THAT REACHES THE GATES');
{
  for (const severity of [1, 2, 4, 5, 6, 7, 8, 9, 10]) {
    const gates = gatesFor({ bucket: 'knee', severity });
    ok(`knee ${severity}/10: the constraint carries the reported number`,
      gates?.severity === severity, gates?.severity);
    ok(`knee ${severity}/10: every gate is the one that number earns`,
      gates?.reduceAffectedWork === injurySeverityReducesAffectedWork(severity)
      && gates?.removeRiskyWork === injurySeverityRemovesRiskyWork(severity)
      && gates?.pauseAffectedTraining === injurySeverityPausesAffectedTraining(severity),
      gates);
  }
}

console.log('\n[2] ⚠ THE CELL STAGING USED TO BREAK — a history buys no extra caution');
{
  // Staging held a reported 4 that had been an 8 at an effective 6, so these two
  // produced DIFFERENT gates. Under Sam's ruling they must be identical, and the
  // comparison is over every gate at once rather than one field.
  // ⚠ THE STEPPED SIDE MUST CARRY THE HISTORY, OR THIS CELL IS UNKILLABLE.
  // The first cut compared `status: 'improving'` against `status: 'active'`.
  // Staging never keyed on status — it keyed on `priorSeverity` — so restoring
  // staging reddened NOTHING here and the headline cell proved nothing. The
  // stepped side now carries the peak the athlete came down from, which is the
  // exact shape a stored or derived constraint had before the ruling.
  for (const bucket of BUCKETS) {
    const stepped = gatesFor({ bucket, severity: 4, status: 'improving', priorSeverity: 9 } as never);
    const fresh = gatesFor({ bucket, severity: 4, status: 'active' });
    ok(`${bucket}: a reported 4 after a 9 === a fresh reported 4, on every gate`,
      JSON.stringify(stepped) === JSON.stringify(fresh), { stepped, fresh });
    ok(`${bucket}: and a reported 4 does NOT remove risky work`,
      stepped?.removeRiskyWork === false, stepped);
    ok(`${bucket}: the constraint carries 4, not a number held above it`,
      stepped?.severity === 4, stepped?.severity);
  }
  // The same, one band at a time — the step staging was built to make.
  for (const [prior, reported] of [[8, 6], [6, 4], [4, 2], [10, 8]] as const) {
    const stepped = gatesFor({ bucket: 'knee', severity: reported, priorSeverity: prior } as never);
    const fresh = gatesFor({ bucket: 'knee', severity: reported });
    ok(`knee ${prior} -> ${reported}: identical to a fresh ${reported}`,
      JSON.stringify(stepped) === JSON.stringify(fresh), { stepped, fresh });
  }
}

console.log('\n[3] IMPROVEMENT IS IMMEDIATE, IN BOTH DIRECTIONS');
{
  const worse = gatesFor({ bucket: 'hamstring', severity: 9 });
  const better = gatesFor({ bucket: 'hamstring', severity: 2 });
  ok('9/10 removes risky work', worse?.removeRiskyWork === true);
  ok('a later 2/10 does not — the restriction lifts on the report',
    better?.removeRiskyWork === false && better?.pauseAffectedTraining === false, better);
  // ⚠ THE CELL THAT STOOD HERE COMPARED A BAND STRING TO A BOOLEAN and could
  // never fail. It now asserts the band the reported number earns, from the
  // band owner itself.
  ok('and 2/10 lands in the band 2/10 earns, not one held above it',
    better?.severityBand === classifyBibleInjurySeverity(2).band,
    { got: better?.severityBand, expected: classifyBibleInjurySeverity(2).band });

  // Worsening was never staged and must still be immediate.
  const worsened = gatesFor({ bucket: 'hamstring', severity: 8 });
  ok('a later 8/10 pauses affected training immediately',
    worsened?.pauseAffectedTraining === true, worsened);
}

console.log('\n[4] NO SECOND SEVERITY SURVIVES ANYWHERE ON THE CONSTRAINT');
{
  const context = buildGenerationConstraintContext({
    activeConstraints: [injuryConstraint({ bucket: 'knee', severity: 4 })],
    todayISO: '2026-07-01',
  });
  const injury = context?.injuries[0] as unknown as Record<string, unknown> | undefined;
  ok('the generation constraint exists (liveness)', !!injury);
  ok('it carries no `effectiveSeverity`', injury !== undefined && !('effectiveSeverity' in injury),
    injury && Object.keys(injury));
  ok('it carries no `priorSeverity`', injury !== undefined && !('priorSeverity' in injury),
    injury && Object.keys(injury));
  // A stored constraint may still arrive carrying the retired field; it must be
  // IGNORED rather than honoured, which is the durable half of the ruling.
  const withStaleField = gatesFor({ bucket: 'knee', severity: 4, priorSeverity: 9 } as never);
  const withoutIt = gatesFor({ bucket: 'knee', severity: 4 });
  ok('a stored constraint still carrying priorSeverity changes nothing',
    JSON.stringify(withStaleField) === JSON.stringify(withoutIt), { withStaleField, withoutIt });
}

console.log(`\nLatest-injury-severity authority: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) { console.log('\nFailures:'); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
