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
  // R-275 (Sam, 2026-08-30): a fatigue tap writes ONE dated fact. "Totally
  // cooked" rests that date only; two tired taps on consecutive dates deload
  // from the second date through Sunday, holding every retained lift's own
  // kilograms (R-034). A moderate illness reduces the week while it is active.
  // The earlier shape of this suite expected one cooked tap to reduce the whole
  // week — the pre-R-275 behaviour — and had been red since that ruling.
  const nextDay = '2026-07-14';
  type Scenario = 'cooked_week' | 'tired_pair' | 'illness_moderate';
  for (const gender of ['male', 'female'] as const) {
    for (const kind of ['cooked_week', 'tired_pair', 'illness_moderate'] as Scenario[]) {
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
      const createdIds: string[] = [];
      const taps: { readinessKind: 'cooked_week' | 'tired_today' | 'illness_moderate'; onDate: string }[] =
        kind === 'tired_pair'
          ? [{ readinessKind: 'tired_today', onDate: date }, { readinessKind: 'tired_today', onDate: nextDay }]
          : [{ readinessKind: kind, onDate: date }];
      let accepted = true;
      for (const tap of taps) {
        const action = await quietAsync(() => executeProgramControlActionDurably(
          readinessActionForKind(tap.readinessKind, { anchorDateISO: tap.onDate, todayISO: tap.onDate }),
          { todayISO: tap.onDate }));
        accepted = accepted && action.ok && !!action.createdModifierIds?.length;
        createdIds.push(...(action.createdModifierIds ?? []));
      }
      ok(`${label}: durable fact${taps.length > 1 ? 's' : ''} accepted`, accepted);
      const after = view();
      const retained = after.flatMap(day => (day.workout?.exercises ?? []).flatMap(row => {
        const old = original.get(`${day.date}|${row.exercise.name}`);
        return old && typeof old.prescribedWeightKg === 'number' && old.prescribedWeightKg > 0
          ? [{ date: day.date, old, row }] : [];
      }));
      if (kind === 'cooked_week') {
        const cookedDay = after.find(day => day.date === date);
        ok(`${label}: the cooked date itself is rest`,
          !cookedDay?.workout || (cookedDay.workout.exercises ?? []).length === 0,
          `cooked date still carries ${JSON.stringify((cookedDay?.workout?.exercises ?? []).map(r => r.exercise.name))}`);
        const otherDays = retained.filter(pair => pair.date !== date);
        ok(`${label}: every other day keeps its accepted sets — one cooked tap rests one date, nothing more (R-275)`,
          otherDays.length >= 2 && otherDays.every(pair => pair.row.prescribedSets === pair.old.prescribedSets),
          JSON.stringify(otherDays.filter(pair => pair.row.prescribedSets !== pair.old.prescribedSets)
            .map(pair => ({ date: pair.date, lift: pair.row.exercise.name, before: pair.old.prescribedSets, after: pair.row.prescribedSets }))));
      } else if (kind === 'tired_pair') {
        const fromSecond = retained.filter(pair => pair.date >= nextDay);
        ok(`${label}: from the second tired date at least two loaded lifts carry fewer sets (R-275 deload)`,
          new Set(fromSecond.map(pair => pair.row.exercise.name)).size >= 2
            && fromSecond.every(pair => pair.row.prescribedSets < pair.old.prescribedSets),
          JSON.stringify(fromSecond.map(pair => ({ date: pair.date, lift: pair.row.exercise.name, before: pair.old.prescribedSets, after: pair.row.prescribedSets }))));
        const firstDay = retained.filter(pair => pair.date === date);
        ok(`${label}: the first tired date itself is untouched — the streak starts on the second date`,
          firstDay.every(pair => pair.row.prescribedSets === pair.old.prescribedSets));
      } else {
        ok(`${label}: reaches at least two distinct loaded lifts and reduces sets`,
          new Set(retained.map(pair => pair.row.exercise.name)).size >= 2
            && retained.some(pair => pair.row.prescribedSets < pair.old.prescribedSets));
      }
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
      let clearedOk = true;
      for (const [index, modifierId] of createdIds.entries()) {
        const onDate = taps[index]?.onDate ?? date;
        const cleared = await quietAsync(() => executeProgramControlActionDurably({
          type: 'clear_fatigue_status', source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
          scope: 'current_week', payload: { modifierId, date: onDate },
          requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
        }, { todayISO: date }));
        clearedOk = clearedOk && cleared.ok;
      }
      ok(`${label}: clearing restores the accepted week`, clearedOk && visibleSignature(view()) === baseline);
      await quietAsync(() => relaunchApp({ storage, todayISO: date }));
      ok(`${label}: cleared week survives restart`, visibleSignature(view()) === baseline);
    }
  }
  console.log(`Readiness load retention: ${passed} passed, ${failed} failed; 6 distinct gender/scenario coordinates.`);
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
