/* Real game/club week -> travel -> restart -> clear, with no stored output fixtures. */
(global as { __DEV__?: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
} };
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { ARCHETYPES, athleteAnswers, YEAR_START, plusDays } from './compilerYear/catalog';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { visibleSignature } from './compilerYear/invariants';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import { createTemporaryScheduleFact, temporaryFactScope } from '../rules/temporarySourceFact';
import { getTeamTrainingWorkoutState } from '../utils/teamTraining';
import { compileCanonicalResolvedWeek } from '../rules/canonicalWeeklyConstraintCompiler';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';

let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) passed++; else failures.push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` ${detail}`}`);
}
async function main() {
  for (const athlete of [ARCHETYPES[2], ARCHETYPES[3]]) {
    const profile = { ...athleteAnswers(athlete), seasonPhase: 'In-season' as const,
      gameDay: 'Saturday' as const, usualGameDay: 'Saturday' as const,
      teamTrainingDays: ['Tuesday', 'Thursday'] as Array<'Tuesday' | 'Thursday'>, teamTrainingDaysPerWeek: 2 };
    await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: YEAR_START }));
    const read = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
    const before = read(); const signature = visibleSignature(before);
    check(`${athlete.id} actual week contains game and team anchors`,
      before.some(day => day.indicator === 'game') && before.some(day => getTeamTrainingWorkoutState(day.workout).hasTeamTraining));
    const until = plusDays(YEAR_START, 5);
    const fact = createTemporaryScheduleFact({ observedDate: YEAR_START,
      scope: temporaryFactScope({ kind: 'window', from: YEAR_START, until }),
      scheduleKind: 'travel', sourceSurface: 'away_this_week', factId: `compiler-travel:${athlete.id}` });
    const state = buildScheduleStateImperative();
    const compilerOnly = compileCanonicalResolvedWeek({ days: before, weekStartISO: YEAR_START, todayISO: YEAR_START,
      state: { ...state, temporarySourceFacts: [fact] } });
    check(`${athlete.id} compiler itself removes away anchors`, compilerOnly.every(day => day.date > until ||
      (day.indicator !== 'game' && !getTeamTrainingWorkoutState(day.workout).hasTeamTraining)),
      JSON.stringify(compilerOnly.map(day => ({ date: day.date, name: day.workout?.name,
        type: day.workout?.workoutType, team: day.workout?.isTeamDay, authored: day.workout?.authoredDay }))));
    const accepted = await quietAsync(() => transactTemporarySourceFact({ operation: 'create', fact, todayISO: YEAR_START }));
    check(`${athlete.id} travel accepted`, !['safely_rejected', 'conflicted'].includes(accepted.outcome), accepted.message);
    const away = read();
    check(`${athlete.id} live week obeys the same travel fact`, away.every(day => day.date > until ||
      (day.indicator !== 'game' && !getTeamTrainingWorkoutState(day.workout).hasTeamTraining)));
    const after = visibleSignature(away);
    const restart = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check(`${athlete.id} travel survives restart exactly`, restart.ok && visibleSignature(read()) === after, restart.error);
    const cleared = await quietAsync(() => transactTemporarySourceFact({ operation: 'resolve', factId: fact.factId, todayISO: YEAR_START }));
    check(`${athlete.id} clearing restores exact accepted week`, !['safely_rejected', 'conflicted'].includes(cleared.outcome) &&
      visibleSignature(read()) === signature, cleared.message);
  }
  console.log(`Canonical travel: ${passed} passed; ${failures.length} failures`);
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
