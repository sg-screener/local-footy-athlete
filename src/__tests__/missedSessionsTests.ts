/**
 * missedSessionsTests — detection of past, unlogged trainable days and the
 * neutral feedback the follow-up records. Pure, store-free.
 *
 * Run: npx sucrase-node src/__tests__/missedSessionsTests.ts
 */

import {
  detectMissedSessions,
  mostRecentMissedSession,
  missedSessionSkippedFeedback,
} from '../utils/missedSessions';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { SessionFeedback } from '../store/programStore';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// totals. Added when this suite was wired into test:bible — an unarmed suite
// in the chain exits 0 on a drained loop and the chain calls that green.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

let pass = 0;
let fail = 0;
function ok(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}`, extra ?? '');
  }
}

function day(date: string, workout: Partial<ResolvedDay['workout']> | null): ResolvedDay {
  return {
    date,
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    short: 'X',
    isToday: false,
    workout: workout as any,
    source: workout ? 'template' : 'none',
    indicator: workout ? 'core' : null,
  };
}

const TODAY = '2026-07-08';
const strength = (name: string) => ({ id: `w-${name}`, name, workoutType: 'Strength', sessionTier: 'core', exercises: [{}, {}] });
const game = { id: 'g', name: 'Game', workoutType: 'Game', sessionTier: 'core', exercises: [] };
const rest = null;
const recovery = { id: 'r', name: 'Recovery', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] };
const team = { id: 't', name: 'Team Training', workoutType: 'Strength', sessionTier: 'core', exercises: [] };

console.log('[1] detects a past unlogged strength session');
{
  const week = [
    day('2026-07-06', strength('Lower')),   // Mon, past, unlogged
    day('2026-07-07', strength('Upper')),   // Tue, past, logged
    day(TODAY, strength('Full')),           // today — not missed yet
    day('2026-07-09', strength('Push')),    // future
  ];
  const feedback: Record<string, SessionFeedback> = {
    '2026-07-07': { dateStr: '2026-07-07', feeling: 'good', completion: 'full' },
  };
  const missed = detectMissedSessions({ weekDays: week, todayISO: TODAY, sessionFeedback: feedback });
  ok('one missed day found', missed.length === 1, missed);
  ok('it is Monday 07-06', missed[0]?.date === '2026-07-06');
  ok('today is not counted', !missed.some((m) => m.date === TODAY));
  ok('future is not counted', !missed.some((m) => m.date === '2026-07-09'));
  ok('logged day is not counted', !missed.some((m) => m.date === '2026-07-07'));
}

// ⚠ **INVERTED 2026-08-22, NOT DELETED.** Sam: *"this will be needed for any
// session that is skipped including games team training and core programmed
// sessions"*. Games and recovery sessions were both filtered out here as "not
// worth chasing" — they are sessions the athlete either did or did not do, and
// an unanswered one leaves the log wrong in the same way. A REST day is still
// never chased, which is the half of this cell that survives unchanged.
console.log('[2] a rest day is never chased; a game and a recovery session are');
{
  const week = [
    day('2026-07-05', game),
    day('2026-07-06', rest),
    day('2026-07-07', recovery),
  ];
  const missed = detectMissedSessions({ weekDays: week, todayISO: TODAY, sessionFeedback: {} });
  ok('rest day not chased', !missed.some((m) => m.date === '2026-07-06'), missed);
  ok('the game is chased, as a game', missed.find((m) => m.date === '2026-07-05')?.kind === 'game');
  ok('the recovery session is chased', missed.some((m) => m.date === '2026-07-07'));
}

console.log('[2b] a day with two doors asks two questions');
{
  // A club night beside a gym session: two components, two forms, two skips.
  // Cast, so this fixture adds no new error to the file's documented typecheck
  // baseline — every fixture above it is a loose literal of the same shape.
  const combined = {
    id: 'w-combined', name: 'Strength + Team Training', workoutType: 'Strength',
    sessionTier: 'core', isTeamDay: true, exercises: [{}, {}],
  } as any;
  const week = [day('2026-07-06', combined)];
  const both = detectMissedSessions({ weekDays: week, todayISO: TODAY, sessionFeedback: {} });
  ok('two items for one day', both.length === 2, both.map((m) => m.kind));
  ok('one of them is the programmed half', both.some((m) => m.kind === 'session'));
  ok('the other is the club night', both.some((m) => m.kind === 'team_training'));

  // AND THE ONE THAT IS ANSWERED STOPS ASKING, ALONE. This is the whole reason
  // the detector stopped keying on the day: reading the day-level completion
  // would silence both halves the moment either one was saved.
  const clubLogged: Record<string, SessionFeedback> = {
    '2026-07-06': {
      dateStr: '2026-07-06',
      completion: 'partial',
      components: [{ componentId: 'team_training', kind: 'team_training', label: 'team training', completion: 'full' }],
      teamTraining: { durationMinutes: 80, effort: 7 },
    } as SessionFeedback,
  };
  const after = detectMissedSessions({ weekDays: week, todayISO: TODAY, sessionFeedback: clubLogged });
  ok('the club night stops asking', !after.some((m) => m.kind === 'team_training'), after);
  ok('the gym session keeps asking', after.some((m) => m.kind === 'session'), after);
}

console.log('[3] most recent missed is the last one');
{
  const week = [
    day('2026-07-04', strength('A')),
    day('2026-07-06', strength('B')),
  ];
  const recent = mostRecentMissedSession({ weekDays: week, todayISO: TODAY, sessionFeedback: {} });
  ok('picks 07-06', recent?.date === '2026-07-06', recent);
}

console.log('[4] team-training-only days are flagged as team');
{
  const week = [day('2026-07-06', team)];
  const missed = detectMissedSessions({ weekDays: week, todayISO: TODAY, sessionFeedback: {} });
  ok('team flag set', missed[0]?.isTeamTraining === true, missed[0]);
}

console.log('[5] skipped prompt response records attendance without invented effort');
{
  const skipped = missedSessionSkippedFeedback('2026-07-06');
  ok('response → skipped', skipped.completion === 'skipped');
  ok('response has no fabricated feeling', !('feeling' in skipped));
}

console.log('[6] a skip answers ONE half and carries the other through');
{
  // The transaction fans a bare day-level completion out to every component, so
  // a whole-day skip from this prompt would mark the club night skipped because
  // the gym was — the mirror image of the 2026-08-21 defect Sam reported.
  const components = [
    { id: 'strength', kind: 'strength', label: 'strength work' },
    { id: 'team_training', kind: 'team_training', label: 'team training' },
  ];
  const existing = {
    dateStr: '2026-07-06',
    completion: 'partial',
    components: [{ componentId: 'team_training', kind: 'team_training', label: 'team training', completion: 'full' }],
    teamTraining: { durationMinutes: 80, effort: 7 },
  } as SessionFeedback;
  const gymSkip = missedSessionSkippedFeedback('2026-07-06', { kind: 'session', components, existing });
  const entries = (gymSkip as any).components as { componentId: string; completion: string }[];
  ok('the gym half is skipped', entries.find((e) => e.componentId === 'strength')?.completion === 'skipped');
  ok('the club night is untouched', entries.find((e) => e.componentId === 'team_training')?.completion === 'full');
  ok('the club measurement survives', (gymSkip as any).teamTraining?.effort === 7);

  const clubSkip = missedSessionSkippedFeedback('2026-07-06', { kind: 'team_training', components, existing: null });
  const clubEntries = (clubSkip as any).components as { componentId: string }[];
  ok('a club skip names only the club', clubEntries.length === 1 && clubEntries[0].componentId === 'team_training');
}

console.log(`\nmissedSessionsTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) process.exit(1);
