/* Real accepted move onto a populated team night, both athlete choices. */
(global as { __DEV__?: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
} };
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { YEAR_START } from './compilerYear/catalog';
import { DEV_E2E_STANDARD_PROFILE } from '../dev/e2e/devE2EStandardProfile';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { visibleSignature } from './compilerYear/invariants';
import { applyPlanChange, previewPlanChangeRisk } from '../utils/planChangeProducer';
import { teamNightFlaggedRows } from '../rules/teamNightContentAsk';
import { undoLastDecision } from '../store/undoLastDecision';

let passed = 0;
const failures: string[] = [];
function check(label: string, condition: boolean, detail = '') {
  if (condition) passed++; else failures.push(`${label}: ${detail}`);
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${condition ? '' : ` ${detail}`}`);
}
async function main() {
  for (const gender of ['female', 'male'] as const) {
    for (const route of ['swap_safe', 'keep_regular'] as const) {
      const label = `${gender}/${route}`;
      await quietAsync(() => coldStartThroughOnboarding({ profile: { ...DEV_E2E_STANDARD_PROFILE, gender }, installDayISO: YEAR_START }));
      const read = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
      const before = visibleSignature(read());
      const source = read().find(day => day.workout && !day.workout.isTeamDay && teamNightFlaggedRows(day.workout).length > 0);
      const target = read().find(day => day.workout?.isTeamDay && day.workout.exercises.length > 0);
      check(`${label} reaches flagged strength and a populated club night`, !!source && !!target);
      if (!source?.workout || !target?.workout) continue;
      const change = { kind: 'move_session' as const, fromDate: source.date, toDate: target.date };
      const preview = quiet(() => previewPlanChangeRisk({change, visibleWeek: read(), todayISO: YEAR_START}));
      check(`${label} asks before changing anything`, !!preview.teamNightContentAsk && visibleSignature(read()) === before);
      const flagged = teamNightFlaggedRows(source.workout).find(row => row.action === 'swap');
      const sourceRow = source.workout.exercises.find(row => row.exercise?.name === flagged?.name);
      check(`${label} reaches an actual exercise replacement coordinate`, !!flagged && !!sourceRow,
        JSON.stringify(teamNightFlaggedRows(source.workout)));
      const moved = quiet(() => applyPlanChange({change: {...change, teamNightContentRoute: route},
        visibleWeek: read(), todayISO: YEAR_START, applyOverride: () => undefined }));
      check(`${label} accepted move succeeds`, moved.ok, JSON.stringify(moved));
      const landing = read().find(day => day.date === target.date)?.workout;
      const replacement = landing?.exercises.find(row => row.exercise?.name === (route === 'swap_safe' ? flagged?.replacement : flagged?.name));
      check(`${label} preserves the club anchor and chosen exercise identity`, !!landing?.isTeamDay &&
        !!replacement?.exerciseId && replacement.exerciseId === replacement.exercise?.id &&
        (route === 'swap_safe' ? replacement.exerciseId !== sourceRow?.exerciseId : replacement.exerciseId === sourceRow?.exerciseId),
        JSON.stringify({ flag: flagged, landing: landing?.name, isTeamDay: landing?.isTeamDay, row: replacement }));
      const after = visibleSignature(read());
      check(`${label} visibly changes the week`, after !== before);
      const liveResolver = require('../rules/teamNightContentAsk') as typeof import('../rules/teamNightContentAsk');
      const original = liveResolver.applyTeamNightSafeSwaps;
      liveResolver.applyTeamNightSafeSwaps = () => { throw new Error('old live choice must not be resolved again at boot'); };
      let restarted;
      try { restarted = await quietAsync(() => relaunchApp({storage, todayISO: YEAR_START})); }
      finally { liveResolver.applyTeamNightSafeSwaps = original; }
      check(`${label} restart preserves exact accumulated content and placement`, restarted.ok && visibleSignature(read()) === after, restarted.error);
      const undone = await quietAsync(() => undoLastDecision());
      check(`${label} Undo after restart restores only this move`, undone.outcome === 'undone' && visibleSignature(read()) === before);
    }
  }
  console.log(`Team-night move/restart: ${passed} passed, ${failures.length} failed`);
  if (failures.length) { failures.forEach(failure => console.error(failure)); process.exitCode = 1; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
