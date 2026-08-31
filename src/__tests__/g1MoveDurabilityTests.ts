/* Complete G-1 Move answer journey: screen action -> durable transaction -> restart -> Undo. */
(global as { __DEV__?: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
} };

import * as fs from 'fs';
import * as path from 'path';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { YEAR_START } from './compilerYear/catalog';
import { DEV_E2E_STANDARD_PROFILE } from '../dev/e2e/devE2EStandardProfile';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { visibleSignature } from './compilerYear/invariants';
import {
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
} from '../utils/programControlActions';
import { applyPlanChange } from '../utils/planChangeProducer';
import { undoLastDecision } from '../store/undoLastDecision';
import type { G1LandingRouteId, PlanChange } from '../utils/planChangeTypes';

const ROUTES: G1LandingRouteId[] = [
  'deloaded', 'take_the_gunshow', 'take_the_primer', 'accessories_only',
];
let passed = 0;
const failures: string[] = [];
function check(label: string, condition: boolean, detail = ''): void {
  if (condition) passed += 1;
  else failures.push(`${label}: ${detail}`);
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${condition ? '' : ` ${detail}`}`);
}
function addDays(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  // Drag and menu both reach commitPlanChange; the difference ends before the
  // durable action. Pin that shared production dispatch so these runtime rows
  // cannot quietly become tests of a helper no UI calls.
  const sheet = fs.readFileSync(path.join(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx'), 'utf8');
  check('drag and menu share commitPlanChange',
    /initialMove[\s\S]*?commitPlanChange/.test(sheet)
      && /g1-route-\$\{route\.id\}[\s\S]{0,260}?commitPlanChange\([\s\S]{0,160}?g1Route: route\.id/.test(sheet));

  for (let index = 0; index < ROUTES.length; index += 1) {
    const route = ROUTES[index]!;
    const entry = index % 2 === 0 ? 'drag' : 'menu';
    const targetState = index < 2 ? 'occupied' : 'empty';
    await quietAsync(() => coldStartThroughOnboarding({
      profile: DEV_E2E_STANDARD_PROFILE,
      installDayISO: YEAR_START,
    }));
    const read = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
    const fixture = read().find((day) => /Game/i.test(`${day.workout?.name ?? ''} ${day.workout?.workoutType ?? ''}`));
    check(`${entry}/${targetState}/${route} reaches a fixture`, !!fixture);
    if (!fixture) continue;
    const targetDate = addDays(fixture.date, -1);
    const candidates = read().filter((day) => day.date !== targetDate && day.workout
      && !/Game|Practice Match/i.test(`${day.workout.name} ${day.workout.workoutType}`)
      && day.workout.exercises.length > 0);
    const source = index % 2 === 1
      ? candidates.find((day) => day.workout?.isTeamDay) ?? candidates[0]
      : candidates.find((day) => !day.workout?.isTeamDay) ?? candidates[0];
    check(`${entry}/${targetState}/${route} reaches a source`, !!source?.workout);
    if (!source?.workout) continue;

    // Empty rows remove the existing landing through the real producer first;
    // occupied rows retain it. This makes the state accumulated without a
    // hand-built week and gives Undo an earlier decision it must not reverse.
    if (targetState === 'empty' && read().find((day) => day.date === targetDate)?.workout) {
      const removed = quiet(() => applyPlanChange({
        change: { kind: 'remove_session', date: targetDate, scope: 'whole_day' },
        visibleWeek: read(), todayISO: YEAR_START, applyOverride: () => undefined,
      }));
      check(`${entry}/${targetState}/${route} creates empty landing by action`, removed.ok,
        JSON.stringify(removed));
    }
    const before = visibleSignature(read());
    const sourceIsMultiPart = !!source.workout.isTeamDay && source.workout.exercises.length > 0;
    check(`${entry}/${targetState}/${route} source shape is ${sourceIsMultiPart ? 'multi-part' : 'single'}`,
      index % 2 === 1 ? sourceIsMultiPart : !sourceIsMultiPart,
      `${source.workout.name} isTeamDay=${String(source.workout.isTeamDay)}`);
    const change: PlanChange = {
      kind: 'move_session', fromDate: source.date, toDate: targetDate,
      ...(sourceIsMultiPart ? { scope: 'strength' as const } : {}),
      g1Route: route,
    };
    const action = programControlActionForPlanChange(change);
    check(`${entry}/${targetState}/${route} durable payload keeps exact route`,
      action?.type === 'move_session' && action.payload.g1Route === route,
      JSON.stringify(action));
    if (!action) continue;
    const result = await quietAsync(() => executeProgramControlActionDurably(action, {
      visibleWeek: read(), todayISO: YEAR_START,
    }));
    check(`${entry}/${targetState}/${route} commits through production door`,
      result.ok === true && result.changedProgram === true, JSON.stringify(result));
    if (!result.ok) continue;
    const after = visibleSignature(read());
    check(`${entry}/${targetState}/${route} visibly lands`, after !== before);
    const restarted = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check(`${entry}/${targetState}/${route} restart is exact`,
      restarted.ok && visibleSignature(read()) === after, restarted.error);
    const undone = await quietAsync(() => undoLastDecision());
    check(`${entry}/${targetState}/${route} Undo restores pre-move week`,
      undone.outcome === 'undone' && visibleSignature(read()) === before,
      `${undone.outcome}: ${visibleSignature(read())}`);
  }

  console.log(`G-1 Move durability: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((failure) => console.error(failure));
    process.exitCode = 1;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
