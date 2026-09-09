/**
 * missedSessionsTests — detection of past, unlogged trainable days and the
 * neutral feedback the follow-up records. Pure, store-free.
 *
 * Run: npx sucrase-node src/__tests__/missedSessionsTests.ts
 */

// The door cells below install a real seed through the app's own stores, so the
// storage the stores persist to must exist before any store module loads.
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;
{
  const storage = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
  } };
  (globalThis as unknown as { fetch: () => never }).fetch = () => { throw new Error('NETWORK DISABLED'); };
}
process.env.TZ = 'Australia/Melbourne';
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
const strength = (name: string): Partial<NonNullable<ResolvedDay['workout']>> => ({ id: `w-${name}`, name, workoutType: 'Strength', sessionTier: 'core', exercises: [] });
const game: Partial<NonNullable<ResolvedDay['workout']>> = { id: 'g', name: 'Game', workoutType: 'Game', sessionTier: 'core', exercises: [] };
const rest = null;
const recovery: Partial<NonNullable<ResolvedDay['workout']>> = { id: 'r', name: 'Recovery', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] };
const team: Partial<NonNullable<ResolvedDay['workout']>> = { id: 't', name: 'Team Training', workoutType: 'Strength', sessionTier: 'core', exercises: [] };

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


console.log('[7] "No, skip it" on a club night writes its half through the real door (Sam, 2026-09-09)');
(async () => {
  // Sam's phone: "No, skip it" on 'Did you do Thursday strength?' did nothing.
  // Verified headlessly: on a club night the day has two halves (strength +
  // team training); the helper answers ONE half, and the door demanded an
  // outcome for EVERY half — `incomplete_component_outcomes`, swallowed by a
  // logger.warn. Both chips were inert on exactly the days that show two
  // prompts. The door now accepts a per-half answer.
  const { createDefaultDevE2ESeedCoordinator } = require('../dev/e2e/defaultDevE2ESeedCoordinator') as typeof import('../dev/e2e/defaultDevE2ESeedCoordinator');
  const { deriveVisibleWeekLive } = require('../utils/deriveVisibleWeek') as typeof import('../utils/deriveVisibleWeek');
  const journey = require('./support/athleteJourney') as typeof import('./support/athleteJourney');
  const { getSessionComponents } = require('../utils/sessionComponents') as typeof import('../utils/sessionComponents');
  const { createRecordSessionOutcomeIntentFromFeedback, commitSessionOutcomeTransaction } =
    require('../store/sessionOutcomeTransaction') as typeof import('../store/sessionOutcomeTransaction');
  const { useProgramStore } = require('../store/programStore') as typeof import('../store/programStore');
  const coordinator = createDefaultDevE2ESeedCoordinator(true);
  const seeded = await journey.quietAsync(() => coordinator.reset('standard-in-season-week'));
  ok('CONTROL: the standard seed installs', seeded === true);
  const TODAY = '2026-07-15'; const TUE = '2026-07-14';
  journey.setJourneyClock(TODAY);
  const days = () => journey.quiet(() => deriveVisibleWeekLive('2026-07-13', TODAY)) as unknown as ResolvedDay[];
  const feedback = () => (useProgramStore.getState().sessionFeedback ?? {}) as Record<string, SessionFeedback>;
  const skip = async (kind: 'session' | 'team_training') => {
    const workout = days().find((day) => day.date === TUE)!.workout!;
    const components = journey.quiet(() => getSessionComponents(workout as never));
    const fb = missedSessionSkippedFeedback(TUE, { kind, components, existing: feedback()[TUE] ?? null });
    const intent = createRecordSessionOutcomeIntentFromFeedback({
      date: TUE, feedback: fb, workout: workout as never, todayISO: TODAY,
      source: { entryPoint: 'tap', surface: 'missed_session_prompt' },
    });
    return journey.quietAsync(() => commitSessionOutcomeTransaction(intent, TODAY));
  };
  const before = detectMissedSessions({ weekDays: days(), todayISO: TODAY, sessionFeedback: feedback() });
  ok('CONTROL: Tuesday (club night + upper pull) raises both prompts',
    before.filter((m) => m.date === TUE).map((m) => m.kind).sort().join(',') === 'session,team_training', before);
  const gym = await skip('session');
  ok('7a the gym half is skipped through the door (was incomplete_component_outcomes)', gym.ok === true, gym);
  const afterGym = detectMissedSessions({ weekDays: days(), todayISO: TODAY, sessionFeedback: feedback() });
  ok('7b only the club-night prompt remains for Tuesday',
    afterGym.filter((m) => m.date === TUE).map((m) => m.kind).join(',') === 'team_training', afterGym);
  const stored = feedback()[TUE];
  ok('7b the stored record holds the gym halves skipped and the club half unanswered',
    !!stored && (stored.components ?? []).some((c) => c.kind === 'strength' && c.completion === 'skipped')
      && !(stored.components ?? []).some((c) => c.kind === 'team_training'), stored);
  const club = await skip('team_training');
  ok('7c the club half is skipped through the door afterwards', club.ok === true, club);
  const afterClub = detectMissedSessions({ weekDays: days(), todayISO: TODAY, sessionFeedback: feedback() });
  ok('7c Tuesday raises no prompt once both halves are answered',
    afterClub.every((m) => m.date !== TUE), afterClub);
  const both = feedback()[TUE];
  ok('7c the earlier gym answer survives the club answer',
    !!both && (both.components ?? []).some((c) => c.kind === 'strength' && c.completion === 'skipped')
      && (both.components ?? []).some((c) => c.kind === 'team_training' && c.completion === 'skipped'), both);
  const hook = require('fs').readFileSync(require('path').join(__dirname, '..', 'screens', 'home', 'useHomeScreen.ts'), 'utf8') as string;
  ok('7d the skip handler re-reads the saved feedback (deps carry sessionFeedback)',
    /handleSkipMissedSession[\s\S]{0,1600}\}, \[weekDays, sessionFeedback\]\);/.test(hook));
  console.log(`\nmissedSessionsTests: ${pass} passed, ${fail} failed`);
  totalsPrinted(fail);
  if (fail > 0) process.exit(1);
})().catch((error) => { console.error(error); fail += 1; totalsPrinted(fail); process.exit(1); });
