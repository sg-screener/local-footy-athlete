/**
 * THE EQUIPMENT ANSWER, ACROSS EVERY WORLD IT CAN BE GIVEN IN.
 *
 * One row per (athlete, session date, removed implement). Every row is a REAL
 * install, a REAL generation and a REAL walk of `set_equipment_modifier`.
 *
 * It answers four questions the single probe cannot:
 *   A. does any visible row remain illegal on the kit the athlete kept?
 *   B. does the recompose ever DROP a row without putting anything in its place?
 *   C. does the screen's residual `buildSessionEquipmentReplacementPlan` ever
 *      have anything left to do after the fact-driven recompose? (If never, the
 *      screen is holding selection authority it does not use.)
 *   D. does any replacement carry the OUTGOING row's load?
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => localStorageData.get(k) ?? null,
    setItem: (k: string, v: string) => { localStorageData.set(k, v); },
    removeItem: (k: string) => { localStorageData.delete(k); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => { throw new Error('NETWORK DISABLED'); };

/* eslint-disable import/first */
import type { OnboardingData, TrainingProgram } from '../src/types/domain';
import {
  DEV_E2E_CAMPAIGN_TIME_ZONE, createDevE2EClockReceipt, devE2EAnchorInstantForDate, setDevE2EClock,
} from '../src/dev/e2e/DevE2EClock';
import { todayISOLocal } from '../src/utils/appDate';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { useProgramStore } from '../src/store/programStore';
import { useProfileStore } from '../src/store/profileStore';
import { useCalendarStore } from '../src/store/calendarStore';
import { useCoachUpdatesStore } from '../src/store/coachUpdatesStore';
import { useReadinessStore } from '../src/store/readinessStore';
import { commitRebuiltProgram } from '../src/utils/weekRebuild';
import { addDaysISO } from '../src/utils/programBlockState';
import { resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';
import { executeProgramControlActionDurably } from '../src/utils/programControlActions';
import { resolveEquipmentCapabilities } from '../src/utils/equipmentAvailability';
import { exerciseAllowedByEquipment } from '../src/data/exercisePoolsStrength';
import {
  buildSessionEquipmentReplacementPlan, deriveSessionEquipmentRequirements,
} from '../src/utils/sessionEquipment';
import { resolveTapSwapEnvironment } from '../src/utils/tapSwapHierarchy';

const INSTALL_DAY = '2026-07-13';
const realLog = console.log, realWarn = console.warn, realInfo = console.info, realErr = console.error;
function quiet<T>(f: () => T): T {
  console.log = () => {}; console.warn = () => {}; console.info = () => {}; console.error = () => {};
  try { return f(); } finally { console.log = realLog; console.warn = realWarn; console.info = realInfo; console.error = realErr; }
}
async function quietAsync<T>(f: () => Promise<T>): Promise<T> {
  console.log = () => {}; console.warn = () => {}; console.info = () => {}; console.error = () => {};
  try { return await f(); } finally { console.log = realLog; console.warn = realWarn; console.info = realInfo; console.error = realErr; }
}
function mondayFor(d: string): string {
  const p = new Date(`${d}T12:00:00Z`);
  return addDaysISO(d, -((p.getUTCDay() + 6) % 7));
}
function setClock(dateISO: string): void {
  (global as unknown as { __DEV__: boolean }).__DEV__ = true;
  if (!setDevE2EClock(createDevE2EClockReceipt({
    seedId: 'standard-in-season-week',
    anchorInstant: devE2EAnchorInstantForDate(dateISO, DEV_E2E_CAMPAIGN_TIME_ZONE),
    timezone: DEV_E2E_CAMPAIGN_TIME_ZONE, createdAt: '2026-08-13T00:00:00.000Z',
  }))) throw new Error('clock refused');
  if (todayISOLocal() !== dateISO) throw new Error(`clock ${todayISOLocal()} != ${dateISO}`);
}

interface World { id: string; phase: string; days: number; pref: string[]; team: string[]; }
const WORLDS: World[] = [
  { id: 'off3', phase: 'Off-season', days: 3, pref: ['Monday', 'Wednesday', 'Friday'], team: [] },
  { id: 'off4', phase: 'Off-season', days: 4, pref: ['Monday', 'Tuesday', 'Thursday', 'Friday'], team: [] },
  { id: 'in5', phase: 'In-season', days: 5, pref: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], team: ['Tuesday', 'Thursday'] },
  { id: 'pre4', phase: 'Pre-season', days: 4, pref: ['Monday', 'Tuesday', 'Thursday', 'Friday'], team: ['Tuesday'] },
  { id: 'in3', phase: 'In-season', days: 3, pref: ['Monday', 'Wednesday', 'Friday'], team: ['Tuesday'] },
];

function profileFor(w: World): OnboardingData {
  return {
    firstName: 'Sim', heightCm: 184, weightKg: 90, seasonPhase: w.phase,
    position: 'inside_mid', motivation: 'Dominate your level', trainingDaysPerWeek: w.days,
    preferredTrainingDays: w.pref,
    teamTrainingDaysPerWeek: w.team.length, teamTrainingDays: w.team,
    teamTrainingDuration: '90 minutes', teamTrainingIntensity: 'Moderate',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine', 'hamstring_curl', 'knee_extension', 'bands'],
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight', benchStrength: '1.5x bodyweight+',
    conditioningLevel: 'Good', sprintExposure: '2+ times per week', recentTrainingLoad: 'Very consistent',
    injuries: [], twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
    equipmentAnswer: {
      tags: { barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have', bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have', foam_roller: 'have', plyo_box: 'have' },
      modalities: { bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have' },
      answeredOn: INSTALL_DAY,
    },
    usualGameDay: 'Saturday', gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

function install(w: World): string | null {
  localStorageData.clear();
  resetStoresToFreshInstall('census:fresh');
  const profile = profileFor(w);
  useProfileStore.getState().updateOnboardingData(profile);
  const c = quiet(() => useProfileStore.getState().completeOnboarding()) as { ok?: boolean } | undefined;
  if (c && c.ok === false) return null;
  setClock(INSTALL_DAY);
  let program: TrainingProgram;
  try {
    program = quiet(() => generateProgramLocally(profile, {
      todayISO: INSTALL_DAY, previousProgram: null,
      seasonPhaseClock: {
        protocolVersion: 1, selectedPhase: w.phase as never,
        phaseEntryWeekStartISO: mondayFor(INSTALL_DAY),
        originProvenance: 'explicit_user_phase_change',
        persistenceProvenance: 'preserved_persisted_state',
      },
    })) as TrainingProgram;
  } catch { return null; }
  const settled = program.microcycles[1] ?? program.microcycles[0]!;
  const weekStart = settled.startDate.slice(0, 10);
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {}, selectedDate: weekStart, reason: 'census',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}

interface Row { name: string; kg: number | null; raw: any; }
function session(dateISO: string, weekStart: string): { name: string | null; rows: Row[] } {
  const week = quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
  const day: any = week.find((d: any) => d.date === dateISO);
  const wk: any = day?.workout;
  return {
    name: wk?.name ?? null,
    rows: (wk?.exercises ?? []).map((ex: any) => ({
      name: ex.exercise?.name ?? ex.name ?? '(unnamed)',
      kg: ex.weightKg ?? ex.prescribedWeightKg ?? null,
      raw: ex,
    })),
  };
}

const REMOVABLE = ['barbell', 'dumbbells', 'machine', 'cables', 'bands', 'pullup_bar', 'bench', 'kettlebell'] as const;

interface Finding { world: string; date: string; tag: string; kind: string; detail: string; }
const findings: Finding[] = [];
let cases = 0, doorRefusals = 0, residualPlanNonEmpty = 0, residualRefusals = 0;

async function main(): Promise<void> {
  for (const w of WORLDS) {
    const weekStart0 = install(w);
    if (!weekStart0) { console.log(`WORLD ${w.id}: generation REFUSED — skipped`); continue; }
    // enumerate candidate (date, tag) pairs from the first two weeks
    const candidates: { date: string; tags: string[]; blocked: string[] }[] = [];
    for (let wi = 0; wi < 2; wi += 1) {
      const ws = addDaysISO(weekStart0, wi * 7);
      setClock(ws);
      const caps = quiet(() => resolveEquipmentCapabilities(useProfileStore.getState().onboardingData as never, [] as never, ws));
      const full = caps.tags;
      const week = quiet(() => resolveWeekWithConditioning(ws, buildScheduleStateImperative()));
      for (const day of week as any[]) {
        if (day.date < ws || day.date > addDaysISO(ws, 6)) continue;
        const rows = (day.workout?.exercises ?? []).map((ex: any) => ex.exercise?.name ?? ex.name).filter(Boolean);
        if (!rows.length) continue;
        const usable = REMOVABLE.filter((t) => full.includes(t as never));
        // every non-empty subset of the session's removable implements, up to
        // SIZE 3, plus the whole set — the sheet lets the athlete untick many.
        const subsets: string[][] = [];
        const walk = (start: number, acc: string[]) => {
          if (acc.length > 0 && acc.length <= 3) subsets.push([...acc]);
          if (acc.length === 3) return;
          for (let i = start; i < usable.length; i += 1) { acc.push(usable[i]!); walk(i + 1, acc); acc.pop(); }
        };
        walk(0, []);
        subsets.push([...usable]);
        for (const tags of subsets) {
          const after = full.filter((t) => !tags.includes(t));
          const blocked = rows.filter((n: string) => exerciseAllowedByEquipment(n, full) && !exerciseAllowedByEquipment(n, after));
          if (blocked.length > 0) candidates.push({ date: day.date, tags, blocked });
        }
      }
    }
    console.log(`WORLD ${w.id} (${w.phase}, ${w.days}d): ${candidates.length} (date,implement) cases`);

    for (const cand of candidates) {
      const weekStart = install(w);
      if (!weekStart) continue;
      cases += 1;
      const ws = cand.date >= addDaysISO(weekStart, 7) ? addDaysISO(weekStart, 7) : weekStart;
      setClock(cand.date);
      const caps = quiet(() => resolveEquipmentCapabilities(useProfileStore.getState().onboardingData as never, [] as never, cand.date));
      const full = caps.tags;
      const afterTags = full.filter((t) => !cand.tags.includes(t));
      const before = session(cand.date, ws);

      const result = await quietAsync(() => executeProgramControlActionDurably({
        type: 'set_equipment_modifier',
        source: { screen: 'session_detail', surface: 'session_equipment_sheet', initiatedBy: 'tap' },
        scope: 'today_only',
        payload: {
          date: cand.date, todayISO: cand.date,
          decision: { kind: 'missing_for_session', tags: cand.tags, conditioningModalities: [] },
        },
        requiresRebuild: false, createsActiveModifier: true, oneOffOnly: true,
      } as never, { todayISO: cand.date }));
      if (result?.ok !== true) {
        doorRefusals += 1;
        findings.push({ world: w.id, date: cand.date, tag: cand.tags.join('+'), kind: 'DOOR_REFUSED', detail: String(result?.message ?? '') });
        continue;
      }

      const after = session(cand.date, ws);

      // A. any visible row still illegal on the kit the athlete kept
      const illegal = after.rows.filter((r) => !exerciseAllowedByEquipment(r.name, afterTags));
      if (illegal.length) {
        findings.push({ world: w.id, date: cand.date, tag: cand.tags.join('+'), kind: 'A_ILLEGAL_ROW_VISIBLE', detail: illegal.map((r) => r.name).join(', ') });
      }

      // B. a row dropped with nothing in its place
      if (after.rows.length < before.rows.length) {
        const gone = before.rows.map((r) => r.name).filter((n) => !after.rows.some((r) => r.name === n));
        findings.push({ world: w.id, date: cand.date, tag: cand.tags.join('+'), kind: 'B_ROW_COUNT_FELL', detail: `${before.rows.length}->${after.rows.length} lost=[${gone.join(', ')}]` });
      }

      // C. what the SCREEN's residual plan would still do
      const caps2 = quiet(() => resolveEquipmentCapabilities(
        useProfileStore.getState().onboardingData as never,
        useCoachUpdatesStore.getState().activeConstraints as never, cand.date));
      const editable = after.rows.map((r, i) => ({ key: `k${i}`, name: r.name, targetId: r.raw?.id, raw: r.raw }));
      const requirements = quiet(() => deriveSessionEquipmentRequirements(editable as never));
      const env = quiet(() => resolveTapSwapEnvironment({
        date: cand.date, profile: useProfileStore.getState().onboardingData,
        activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
        readinessSignal: useReadinessStore.getState().signalsByDate[cand.date],
      } as never));
      let plan: any = null;
      try {
        plan = quiet(() => buildSessionEquipmentReplacementPlan({
          exercises: editable as never, requirements, missingKeys: new Set(cand.tags.map((t) => `tag:${t}`) as never),
          capabilities: caps2, environment: env as never,
        }));
      } catch (e) { plan = { thrown: String((e as Error).message) }; }
      if (plan?.ok === false) {
        residualRefusals += 1;
        findings.push({ world: w.id, date: cand.date, tag: cand.tags.join('+'), kind: 'C_RESIDUAL_PLAN_REFUSES', detail: `${plan.exerciseName}: ${plan.reason}` });
      } else if (plan?.ok === true && plan.replacements.length > 0) {
        residualPlanNonEmpty += 1;
        findings.push({ world: w.id, date: cand.date, tag: cand.tags.join('+'), kind: 'C_RESIDUAL_PLAN_HAS_WORK', detail: plan.replacements.map((r: any) => `${r.fromExercise}->${r.toExercise?.name}`).join(', ') });
      } else if (plan?.thrown) {
        findings.push({ world: w.id, date: cand.date, tag: cand.tags.join('+'), kind: 'C_RESIDUAL_PLAN_THREW', detail: plan.thrown });
      }

      // D. a replacement carrying the outgoing load
      const beforeByName = new Map(before.rows.map((r) => [r.name, r.kg]));
      const newRows = after.rows.filter((r) => !beforeByName.has(r.name));
      const goneRows = before.rows.filter((r) => !after.rows.some((a) => a.name === r.name));
      for (const nr of newRows) {
        for (const gr of goneRows) {
          if (nr.kg !== null && nr.kg !== 0 && nr.kg === gr.kg) {
            findings.push({ world: w.id, date: cand.date, tag: cand.tags.join('+'), kind: 'D_LOAD_MATCHES_OUTGOING', detail: `${gr.name}(${gr.kg}) -> ${nr.name}(${nr.kg})` });
          }
        }
      }
    }
  }

  console.log(`\n══ CENSUS ══  cases=${cases}  doorRefusals=${doorRefusals}  residualPlanHasWork=${residualPlanNonEmpty}  residualPlanRefuses=${residualRefusals}`);
  const byKind = new Map<string, Finding[]>();
  for (const f of findings) { const l = byKind.get(f.kind) ?? []; l.push(f); byKind.set(f.kind, l); }
  for (const [kind, list] of [...byKind].sort()) {
    console.log(`\n${kind}: ${list.length}`);
    for (const f of list.slice(0, 12)) console.log(`   ${f.world} ${f.date} -${f.tag}: ${f.detail}`);
    if (list.length > 12) console.log(`   ... and ${list.length - 12} more`);
  }
  if (!findings.length) console.log('\nNO FINDINGS.');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
