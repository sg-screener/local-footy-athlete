/** Real onboarding -> reduced week -> projection -> restart -> clear.
 * Readiness holds each retained lift's accepted load, not its starting estimate.
 */
(global as any).__DEV__ = true;
const storage = new Map<string, string>();
(globalThis as any).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
} };
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { profileForDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { readinessActionForKind } from '../utils/weekReadinessActions';
import { visibleSignature } from './compilerYear/invariants';
import { project } from '../rules/projectVisibleWeek';

let passed = 0;
let failed = 0;
function ok(label: string, value: boolean, detail = '') {
  console.log(`${value ? 'PASS' : 'FAIL'} ${label} ${value ? '' : detail}`);
  value ? passed++ : failed++;
}

async function main() {
  const date = '2026-07-13';
  const view = () => quiet(() => deriveVisibleWeekLive(date, date));
  for (const gender of ['male', 'female'] as const) {
    for (const kind of ['cooked_week', 'illness_moderate'] as const) {
      const label = `${gender}/${kind}`;
      const installed = await quietAsync(() => coldStartThroughOnboarding({
        profile: { ...profileForDevE2ESeed('standard-in-season-week'), gender }, installDayISO: date,
      }));
      ok(`${label}: real onboarding accepts`, !installed.onboardingRefusal);
      const before = view();
      const baseline = visibleSignature(before);
      const original = new Map(before.flatMap(day => (day.workout?.exercises ?? [])
        .filter(row => row.section18Evidence?.role === 'main_strength')
        .map(row => [`${day.date}|${row.exercise.name}`, row] as const)));
      const action = await quietAsync(() => executeProgramControlActionDurably(
        readinessActionForKind(kind, { anchorDateISO: date, todayISO: date }), { todayISO: date }));
      ok(`${label}: durable fact accepted`, action.ok && !!action.createdModifierIds?.length);
      const after = view();
      const retained = after.flatMap(day => (day.workout?.exercises ?? []).flatMap(row => {
        const old = original.get(`${day.date}|${row.exercise.name}`);
        return old && typeof old.prescribedWeightKg === 'number' && old.prescribedWeightKg > 0
          ? [{ date: day.date, old, row }] : [];
      }));
      ok(`${label}: reaches at least two distinct loaded lifts and reduces sets`,
        new Set(retained.map(pair => pair.row.exercise.name)).size >= 2
          && retained.some(pair => pair.row.prescribedSets < pair.old.prescribedSets));
      ok(`${label}: every retained loaded lift keeps its own accepted kilograms`,
        retained.length > 0 && retained.every(pair => pair.row.prescribedWeightKg === pair.old.prescribedWeightKg),
        JSON.stringify(retained.filter(pair => pair.row.prescribedWeightKg !== pair.old.prescribedWeightKg)
          .map(pair => ({ date: pair.date, lift: pair.row.exercise.name,
            before: pair.old.prescribedWeightKg, after: pair.row.prescribedWeightKg }))));
      ok(`${label}: actual visible projection reaches seven days`,
        project({ week: after, weekStart: date }).days.length === 7);
      const active = visibleSignature(after);
      const restarted = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
      ok(`${label}: active state survives restart`, restarted.ok && visibleSignature(view()) === active);
      const cleared = await quietAsync(() => executeProgramControlActionDurably({
        type: 'clear_fatigue_status', source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
        scope: 'current_week', payload: { modifierId: action.createdModifierIds![0], date },
        requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
      }, { todayISO: date }));
      ok(`${label}: clearing restores the accepted week`, cleared.ok && visibleSignature(view()) === baseline);
      await quietAsync(() => relaunchApp({ storage, todayISO: date }));
      ok(`${label}: cleared week survives restart`, visibleSignature(view()) === baseline);
    }
  }
  console.log(`Readiness load retention: ${passed} passed, ${failed} failed; 4 distinct gender/fact coordinates.`);
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
