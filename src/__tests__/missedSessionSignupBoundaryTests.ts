/**
 * E6 — days before program signup are HISTORY: never prompted, never counted.
 *
 * The dogfood finding (docs/DOGFOOD_FINDINGS_2026-07-23.md E6): on a Thursday
 * signup the app asks "Did you do Monday?" about sessions that existed only as
 * plan rows minted for the week's earlier days — days the athlete could never
 * have done, because the program did not exist yet. Counting them missed is a
 * false record (L6).
 *
 * The delivered-vs-remaining principle (Q4): `governedFromISO = signup date;
 * earlier days display for context, exempt from accounting.` The missed-session
 * detector owns the accounting side of that rule.
 *
 * Run: npm run test:missed-signup
 */

process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import {
  detectMissedSessions,
  mostRecentMissedSession,
  programHistoryBoundaryFromCreatedAt,
} from '../utils/missedSessions';
import type { ResolvedDay } from '../utils/sessionResolver';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL ${name}${detail ? `: ${detail}` : ''}`); }
}

function trainableDay(date: string): ResolvedDay {
  return {
    date,
    workout: {
      id: `wk-${date}`,
      name: 'Lower Body Strength',
      workoutType: 'Strength',
      exercises: [{ id: `row-${date}` }],
    },
  } as unknown as ResolvedDay;
}

const WEEK = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23'].map(trainableDay);
const SIGNUP_THURSDAY = '2026-07-23';
const TODAY_FRIDAY = '2026-07-24';

// E6.1 — pre-signup days are exempt from missed accounting.
{
  const missed = detectMissedSessions({
    weekDays: WEEK,
    todayISO: TODAY_FRIDAY,
    sessionFeedback: {},
    programHistoryBeforeISO: SIGNUP_THURSDAY,
  });
  ok('E6.1 days before the signup boundary are never counted missed',
    missed.every((entry) => entry.date >= SIGNUP_THURSDAY),
    JSON.stringify(missed.map((entry) => entry.date)));
  ok('E6.2 the signup day itself, once past, still counts',
    missed.some((entry) => entry.date === SIGNUP_THURSDAY),
    JSON.stringify(missed.map((entry) => entry.date)));
}

// E6.3 — the prompt never targets a pre-signup day.
{
  const prompt = mostRecentMissedSession({
    weekDays: WEEK.slice(0, 3), // Mon-Wed only, all pre-signup
    todayISO: TODAY_FRIDAY,
    sessionFeedback: {},
    programHistoryBeforeISO: SIGNUP_THURSDAY,
  });
  ok('E6.3 "Did you do <day>?" never fires for a day before the program existed',
    prompt === null,
    JSON.stringify(prompt));
}

// E6.4 — without a boundary the detector behaves exactly as before.
{
  const missed = detectMissedSessions({
    weekDays: WEEK,
    todayISO: TODAY_FRIDAY,
    sessionFeedback: {},
  });
  ok('E6.4 no boundary → unchanged legacy accounting (4 candidate days)',
    missed.length === 4,
    JSON.stringify(missed.map((entry) => entry.date)));
}

// E6.5 — the boundary derives from the program's creation instant in LOCAL
// time. A Thursday-morning signup in Melbourne is Wednesday in UTC; slicing
// the raw ISO would exempt one day too few.
{
  const thursdayMorningAEST = '2026-07-22T23:30:00.000Z'; // 09:30 Thu AEST
  ok('E6.5 the boundary is the LOCAL signup date, not the UTC slice',
    programHistoryBoundaryFromCreatedAt(thursdayMorningAEST) === '2026-07-23',
    programHistoryBoundaryFromCreatedAt(thursdayMorningAEST));
}

// ── E6.6 — THE SIGNUP DAY IS STORED, AND IT IS WHAT THE BOUNDARY READS ──
//
// Sam, 2026-08-22: *"yes it should save sign up day"*.
//
// ⚠ **THE RULE ABOVE WAS UNREACHABLE UNTIL THIS EXISTED.** Its input was
// `currentProgram.createdAt`, and this app rebuilds the program on every launch
// — so the boundary was always TODAY, every past day was "history", and the
// follow-up could not fire for anyone. Measured on Sam's device: two unlogged
// past days in the visible week, nothing drawn, and no `currentProgram` in the
// persisted store at all.
//
// WRITER, READER, TEST — the three this field owed on arrival.
{
  const { useProfileStore } = require('../store/profileStore');
  const store = useProfileStore.getState();
  ok('E6.6 a fresh athlete has no signup day yet', store.signupDateISO === null,
    String(store.signupDateISO));

  // WRITER: completing onboarding stamps it, once. The guard refuses an empty
  // profile, so this cell asserts the SHAPE of the write rather than driving 40
  // answers through a store that has its own suite for that.
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, '..', 'store', 'profileStore.ts'), 'utf8');
  ok('E6.6 the writer is completeOnboarding, and only on the accepted path',
    /set\(\{\s*isOnboardingComplete: true,\s*signupDateISO: get\(\)\.signupDateISO \?\? todayISOLocal\(\),/.test(source));
  ok('E6.6 a second completion cannot re-date an athlete',
    /signupDateISO: get\(\)\.signupDateISO \?\?/.test(source));
  ok('E6.6 a reset clears it', /clearsSignupDate \? \{ signupDateISO: null \}/.test(source));
  ok('E6.6 the earliest of disk and memory wins on hydration',
    /signupDateISO: persisted\?\.signupDateISO \?\? currentState\.signupDateISO/.test(source));

  // READER: the boundary prefers it over both fallbacks.
  const hook = require('fs').readFileSync(
    require('path').resolve(__dirname, '..', 'screens', 'home', 'useHomeScreen.ts'), 'utf8');
  ok('E6.6 the boundary reads the signup day FIRST',
    /programHistoryBeforeISO:\s*\n\s*signupDateISO\s*\n\s*\?\? programHistoryBoundaryFromAcceptedBlocks/.test(hook));
  ok('E6.6 and the regenerated program is its LAST resort, never its first',
    /\?\? programHistoryBoundaryFromCreatedAt\(currentProgram\?\.createdAt\),/.test(hook)
      && !/programHistoryBeforeISO: programHistoryBoundaryFromCreatedAt/.test(hook));
}

// E6.7 — and the DETECTOR still honours whatever boundary it is handed, which
// is the half of this that is behaviour rather than wiring.
{
  const missed = detectMissedSessions({
    weekDays: WEEK,
    todayISO: TODAY_FRIDAY,
    sessionFeedback: {},
    programHistoryBeforeISO: SIGNUP_THURSDAY,
  });
  ok('E6.7 a Wednesday signup is never asked about the Monday before it',
    missed.every((entry) => entry.date >= SIGNUP_THURSDAY),
    JSON.stringify(missed.map((entry) => entry.date)));
}

console.log(`\nMissed-session signup boundary: ${pass} passing, ${fail} failing`);
totalsPrinted(fail);
if (fail > 0) {
  for (const name of failures) console.log(`  FAIL ${name}`);
  process.exit(1);
}
