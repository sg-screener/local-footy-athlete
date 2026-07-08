/**
 * missedSessionsTests — detection of past, unlogged trainable days and the
 * neutral feedback the follow-up records. Pure, store-free.
 *
 * Run: npx sucrase-node src/__tests__/missedSessionsTests.ts
 */

import {
  detectMissedSessions,
  mostRecentMissedSession,
  missedSessionFeedback,
} from '../utils/missedSessions';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { SessionFeedback } from '../store/programStore';

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

console.log('[2] games, rest and recovery are never "missed"');
{
  const week = [
    day('2026-07-05', game),
    day('2026-07-06', rest),
    day('2026-07-07', recovery),
  ];
  const missed = detectMissedSessions({ weekDays: week, todayISO: TODAY, sessionFeedback: {} });
  ok('nothing chased', missed.length === 0, missed);
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

console.log('[5] feedback mapping: did_it=full, missed_it=skipped');
{
  ok('did_it → full', missedSessionFeedback('2026-07-06', 'did_it').completion === 'full');
  ok('missed_it → skipped', missedSessionFeedback('2026-07-06', 'missed_it').completion === 'skipped');
}

console.log(`\nmissedSessionsTests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
