/**
 * Coach/adjustment failure copy — no raw developer diagnostics reach the athlete.
 *
 * Live-legacy census finding #3: CoachScreen's injury-progression fallback
 * replies spliced raw developer TODOs into the chat bubble ("Investigate event
 * targeting (likely date / session mismatch).", "Investigate the apply layer or
 * visible-diff verifier."). Census finding #8 / addendum (i): the adjustment-undo
 * Alert surfaced `result.reason` (a raw transaction error.message) verbatim.
 *
 * Both must route through the athlete-facing copy owner. Diagnostic detail stays
 * log-side only. This is a source contract (the repo ships no RN renderer), in
 * the same style as keyboardConventionContractTests.
 *
 * Run: npm run test:coach-failure-copy
 */


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';
import {
  athleteSafeRefusal,
  COACH_NO_OVERRIDE_FALLBACK,
  COACH_NO_VISIBLE_DIFF_FALLBACK,
} from '../utils/planChangeRefusalCopy';

const src = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(src, rel), 'utf8');

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

console.log('\n[coach failure copy] no raw developer diagnostics reach the athlete');
{
  const coach = read('screens/coach/CoachScreen.tsx');
  ok(
    'CoachScreen no longer reads a developer TODO to the athlete',
    !/Investigate event targeting/.test(coach) && !/Investigate the apply layer/.test(coach),
    'the injury-progression fallback replies must not embed "Investigate …" diagnostics',
  );
  ok(
    'CoachScreen sources its apply-failure copy from the copy owner',
    /COACH_NO_OVERRIDE_FALLBACK/.test(coach) && /COACH_NO_VISIBLE_DIFF_FALLBACK/.test(coach),
    'the fallback bodies come from planChangeRefusalCopy, not inline prose',
  );

  // RE-AIMED 2026-08-12 AT THE WRITER'S NEW HOME (SEAT_INBOX item 8). The
  // restoration refusal moved out of `useHomeScreen` into
  // `screens/coach/useCoachNoteActions`, which both the Program tab and Coach /
  // My Status now mount — so the property this cell holds got WIDER: one
  // sanitiser covering both screens instead of one screen's copy of it.
  const writer = read('screens/coach/useCoachNoteActions.ts');
  ok(
    'the adjustment-undo refusal routes its reason through athleteSafeRefusal',
    /Couldn.{0,3}t restore this adjustment[\s\S]{0,120}athleteSafeRefusal\(/.test(writer),
    'result.reason (a raw transaction error.message) must not reach the athlete verbatim',
  );
  // AND NO COPY WAS LEFT BEHIND. A second, un-sanitised Alert surviving in the
  // day screen would make the assertion above true and the app still wrong.
  const home = read('screens/home/useHomeScreen.ts');
  ok(
    'the day screen kept no second copy of that Alert',
    !/Couldn.{0,3}t restore this adjustment/.test(home),
    'two restoration refusals means two places to forget the sanitiser',
  );

  // The owner's copy is itself athlete-safe (passes the gate unchanged).
  ok('COACH_NO_OVERRIDE_FALLBACK is athlete-safe',
    athleteSafeRefusal(COACH_NO_OVERRIDE_FALLBACK) === COACH_NO_OVERRIDE_FALLBACK);
  ok('COACH_NO_VISIBLE_DIFF_FALLBACK is athlete-safe',
    athleteSafeRefusal(COACH_NO_VISIBLE_DIFF_FALLBACK) === COACH_NO_VISIBLE_DIFF_FALLBACK);
  ok('neither carries an "Investigate" TODO',
    !/Investigate/i.test(COACH_NO_OVERRIDE_FALLBACK) && !/Investigate/i.test(COACH_NO_VISIBLE_DIFF_FALLBACK));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
