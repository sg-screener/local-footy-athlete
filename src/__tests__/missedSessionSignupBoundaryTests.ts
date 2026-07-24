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

console.log(`\nMissed-session signup boundary: ${pass} passing, ${fail} failing`);
if (fail > 0) {
  for (const name of failures) console.log(`  FAIL ${name}`);
  process.exit(1);
}
