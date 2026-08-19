/**
 * THE EQUIPMENT VERTICAL SLICE, DRIVEN THROUGH THE REAL DOORS.
 *
 * Off-season / 3 training days / full commercial gym / 5+ years. The session on
 * 2026-07-22 is `RDLs, Bulgarian Split Squats, Landmine Press, Barbell Row,
 * Banded Dead Bug` — two rows that genuinely need a barbell, one (RDLs) that is
 * authored barbell OR dumbbells OR kettlebells, and two untouched by the answer.
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
import { commitRebuiltProgram } from '../src/utils/weekRebuild';
import { addDaysISO } from '../src/utils/programBlockState';
import { resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';
import { executeProgramControlActionDurably } from '../src/utils/programControlActions';
import { resolveEquipmentCapabilities } from '../src/utils/equipmentAvailability';
import { exerciseAllowedByEquipment } from '../src/data/exercisePoolsStrength';

const INSTALL_DAY = '2026-07-13';
const TARGET_DATE = process.env.TARGET ?? '2026-07-22';
const REMOVED_TAGS = (process.env.REMOVE ?? 'barbell').split(',') as never[];
const REMOVED_TAG = REMOVED_TAGS[0] as never;

const realLog = console.log, realWarn = console.warn, realInfo = console.info, realErr = console.error;
function mute() { console.log = () => {}; console.warn = () => {}; console.info = () => {}; console.error = () => {}; }
function unmute() { console.log = realLog; console.warn = realWarn; console.info = realInfo; console.error = realErr; }
function quiet<T>(f: () => T): T { mute(); try { return f(); } finally { unmute(); } }
async function quietAsync<T>(f: () => Promise<T>): Promise<T> { mute(); try { return await f(); } finally { unmute(); } }

function mondayFor(d: string): string {
  const p = new Date(`${d}T12:00:00Z`);
  return addDaysISO(d, -((p.getUTCDay() + 6) % 7));
}

export function offSeasonThreeDayAthlete(): OnboardingData {
  return {
    firstName: 'Sim', heightCm: 184, weightKg: 90, seasonPhase: 'Off-season',
    position: 'inside_mid', motivation: 'Dominate your level', trainingDaysPerWeek: Number(process.env.DAYS ?? 3),
    preferredTrainingDays: (process.env.PREF ?? 'Monday,Wednesday,Friday').split(','),
    teamTrainingDaysPerWeek: (process.env.TEAM ?? '').split(',').filter(Boolean).length,
    teamTrainingDays: (process.env.TEAM ?? '').split(',').filter(Boolean),
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

export function setClock(dateISO: string): void {
  (global as unknown as { __DEV__: boolean }).__DEV__ = true;
  const ok = setDevE2EClock(createDevE2EClockReceipt({
    seedId: 'standard-in-season-week',
    anchorInstant: devE2EAnchorInstantForDate(dateISO, DEV_E2E_CAMPAIGN_TIME_ZONE),
    timezone: DEV_E2E_CAMPAIGN_TIME_ZONE, createdAt: '2026-08-13T00:00:00.000Z',
  }));
  if (!ok) throw new Error('DevE2EClock REFUSED — __DEV__ is not true, every door below would read the wall clock');
  if (todayISOLocal() !== dateISO) throw new Error(`app clock says ${todayISOLocal()}, simulation is on ${dateISO}`);
}

export function installAndGenerate(): string {
  localStorageData.clear();
  resetStoresToFreshInstall('probe-equipment-slice:fresh');
  const profile = offSeasonThreeDayAthlete();
  useProfileStore.getState().updateOnboardingData(profile);
  const c = useProfileStore.getState().completeOnboarding() as { ok?: boolean; missingAnswers?: unknown } | undefined;
  if (c && c.ok === false) throw new Error('onboarding REFUSED: ' + JSON.stringify(c.missingAnswers));
  setClock(INSTALL_DAY);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: INSTALL_DAY, previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'Off-season' as never,
      phaseEntryWeekStartISO: mondayFor(INSTALL_DAY),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const settled = program.microcycles[1] ?? program.microcycles[0]!;
  const weekStart = settled.startDate.slice(0, 10);
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {}, selectedDate: weekStart, reason: 'probe:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}

export interface VisibleRow { name: string; sets: number | null; reps: string | null; kg: number | null; }

export function visibleSession(dateISO: string, weekStart: string): { name: string | null; rows: VisibleRow[] } {
  const week = quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
  const day: any = week.find((d: any) => d.date === dateISO);
  const w: any = day?.workout;
  return {
    name: w?.name ?? null,
    rows: (w?.exercises ?? []).map((ex: any) => ({
      name: ex.exercise?.name ?? ex.name ?? '(unnamed)',
      sets: ex.sets ?? ex.prescribedSets ?? null,
      reps: ex.reps ?? ex.prescribedReps ?? null,
      kg: ex.weightKg ?? ex.prescribedWeightKg ?? null,
    })),
  };
}

function printSession(label: string, s: { name: string | null; rows: VisibleRow[] }, tags: readonly string[]) {
  console.log(`\n${label}  ::  ${s.name ?? '(no session)'}`);
  for (const r of s.rows) {
    const legal = exerciseAllowedByEquipment(r.name, tags as never);
    console.log(`    ${legal ? ' ' : '✗'} ${r.name.padEnd(34)} sets=${r.sets ?? '-'} reps=${r.reps ?? '-'} kg=${r.kg ?? '-'}`);
  }
}

export function dayGapsAndNotices(weekStart: string, todayISO: string, dateISO: string): { gaps: string[]; rowNotices: string[] } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildProgramTabProjectedWeek } = require('../src/utils/visibleProgramReadModel');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { project } = require('../src/rules/projectVisibleWeek');
  const weekDays = quiet(() => buildProgramTabProjectedWeek({
    mondayISO: weekStart, todayISO,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
  let projected: any;
  try {
    projected = quiet(() => project({
      week: weekDays as never, weekStart,
      program: useProgramStore.getState().currentProgram as never,
    }));
  } catch (e) { return { gaps: [`(project threw: ${(e as Error).message})`], rowNotices: [] }; }
  const day = (projected.days ?? projected.visibleWeek ?? []).find((d: any) => d.dateISO === dateISO || d.date === dateISO);
  const rowNotices: string[] = [];
  for (const r of (day?.rows ?? day?.exercises ?? [])) {
    const sub = r?.substitutedFrom ?? r?.exercise?.substitutedFrom;
    if (sub) rowNotices.push(`${r.name ?? r.exercise?.name}: swapped from ${sub.baseExerciseName} (${sub.cause})`);
  }
  return { gaps: (day?.gaps ?? []).map((g: any) => typeof g === 'string' ? g : JSON.stringify(g)), rowNotices };
}

function explanationsFor(weekStart: string, todayISO: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { visibleProjection } = require('../src/__tests__/support/athleteJourney');
  return quiet(() => visibleProjection(weekStart, todayISO)).explanations as string[];
}

function athleteVisibleModifiers(): { id: string; title: string; body: string }[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { selectActiveCoachNotes } = require('../src/utils/activeCoachNotes');
  const accepted: any = useProgramStore.getState().acceptedMaterialContext ?? {};
  return quiet(() => selectActiveCoachNotes({
    activeConstraints: accepted.activeConstraints ?? [],
  })).map((n: any) => ({ id: String(n.id), title: String(n.title ?? ''), body: String(n.body ?? n.message ?? '') }));
}

function storedEquipmentFacts(): any[] {
  const accepted: any = useProgramStore.getState().acceptedMaterialContext ?? {};
  const facts = accepted.temporarySourceFacts ?? [];
  return facts.filter((f: any) => f?.factKind === 'equipment');
}

export async function main(): Promise<void> {
  const weekStart = installAndGenerate();
  console.log(`WEEK START ${weekStart}   TARGET ${TARGET_DATE}   REMOVING ${JSON.stringify(REMOVED_TAGS)}`);
  setClock(TARGET_DATE);

  const caps = quiet(() => resolveEquipmentCapabilities(
    useProfileStore.getState().onboardingData as never, [] as never, TARGET_DATE));
  const fullTags = caps.tags;
  const afterTags = fullTags.filter((t) => !(REMOVED_TAGS as string[]).includes(t));
  console.log(`\nPROFILE KIT: ${fullTags.join(', ')}`);

  const wkForTarget = TARGET_DATE >= addDaysISO(weekStart, 7) ? addDaysISO(weekStart, 7) : weekStart;
  const before = visibleSession(TARGET_DATE, wkForTarget);
  printSession('BEFORE', before, fullTags);
  const explBefore = explanationsFor(weekStart, TARGET_DATE);
  console.log(`  explanations BEFORE (${explBefore.length}): ${JSON.stringify(explBefore)}`);
  const nextDayBefore = visibleSession(addDaysISO(TARGET_DATE, 2), weekStart);

  const requiringRemoved = before.rows.filter((r) =>
    exerciseAllowedByEquipment(r.name, fullTags) && !exerciseAllowedByEquipment(r.name, afterTags));
  console.log(`\n[1] rows that need ${REMOVED_TAG} and nothing else legal: ${requiringRemoved.length} -> ${requiringRemoved.map((r) => r.name).join(', ')}`);

  // ── THE ATHLETE'S ANSWER, THROUGH THE REAL DOOR ─────────────────────────
  const result = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_equipment_modifier',
    source: { screen: 'session_detail', surface: 'session_equipment_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: {
      date: TARGET_DATE, todayISO: TARGET_DATE,
      decision: { kind: 'missing_for_session', tags: REMOVED_TAGS, conditioningModalities: [] },
    },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: true,
  } as never, { todayISO: TARGET_DATE }));
  console.log(`\n[2] DOOR: ok=${result?.ok} changedProgram=${result?.changedProgram} msg=${JSON.stringify(result?.message ?? null)}`);

  const facts = storedEquipmentFacts();
  console.log(`\n[8] STORED CANONICAL FACTS (${facts.length}):`);
  for (const f of facts) {
    console.log(`      factId=${f.factId} kind=${f.factKind} mode=${f.mode} tags=${JSON.stringify(f.equipmentTags)} scope=${JSON.stringify(f.scope)} observed=${f.observedDate} surface=${f.sourceSurface} actor=${f.sourceActor}`);
  }

  const after = visibleSession(TARGET_DATE, wkForTarget);
  printSession('AFTER', after, afterTags);

  const explAfter = explanationsFor(weekStart, TARGET_DATE);
  console.log(`  explanations AFTER (${explAfter.length}): ${JSON.stringify(explAfter)}`);
  const dropped = before.rows.map((r) => r.name).filter((n) => !after.rows.some((r) => r.name === n));
  console.log(`[13] rows that DISAPPEARED with no replacement: ${before.rows.length - after.rows.length >= 0 ? '' : ''}${JSON.stringify(dropped)}  (before=${before.rows.length} after=${after.rows.length})`);
  const dg = dayGapsAndNotices(wkForTarget, TARGET_DATE, TARGET_DATE);
  console.log(`[13] DAY GAPS the athlete is shown (${dg.gaps.length}):`);
  for (const g of dg.gaps) console.log(`      ${g}`);
  console.log(`[13] PER-ROW SWAP NOTICES (${dg.rowNotices.length}):`);
  for (const n of dg.rowNotices) console.log(`      ${n}`);
  const mods = athleteVisibleModifiers();
  console.log(`[13] ATHLETE-VISIBLE MODIFIERS (${mods.length}):`);
  for (const m of mods) console.log(`      ${m.id} | ${m.title} | ${m.body}`);
  const stillIllegal = after.rows.filter((r) => !exerciseAllowedByEquipment(r.name, afterTags));
  console.log(`\n[3] visible rows still illegal on today's kit: ${stillIllegal.length} ${stillIllegal.map((r) => r.name).join(', ')}`);

  const beforeNames = before.rows.map((r) => r.name);
  const afterNames = after.rows.map((r) => r.name);
  const survivors = beforeNames.filter((n) => afterNames.includes(n));
  console.log(`[4] unchanged rows kept: ${survivors.length}/${beforeNames.length} -> ${survivors.join(', ')}`);
  console.log(`[4] order preserved for survivors: ${JSON.stringify(afterNames.filter((n) => survivors.includes(n)))} vs ${JSON.stringify(beforeNames.filter((n) => survivors.includes(n)))}`);

  const outgoingLoads = new Map(before.rows.map((r) => [r.name, r.kg]));
  const newRows = after.rows.filter((r) => !beforeNames.includes(r.name));
  console.log(`\n[6/7] NEW ROWS AND THEIR LOAD:`);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { startingWeightForAthlete, resolveLoadAuthority } = require('../src/utils/loadEstimation');
  const prof = useProfileStore.getState().onboardingData;
  for (const r of newRows) {
    const own = quiet(() => startingWeightForAthlete(r.name, prof as never));
    const auth = quiet(() => resolveLoadAuthority(r.name));
    const inherited = [...outgoingLoads.values()].includes(r.kg) && r.kg !== own && r.kg !== null && r.kg !== 0;
    console.log(`      ${r.name.padEnd(30)} delivered=${r.kg}  ownAuthority=${auth.kind}  ownStart=${own}  ${inherited ? '<<< INHERITED FROM AN OUTGOING ROW' : ''}`);
  }
  console.log(`      outgoing loads were: ${[...outgoingLoads].map(([n, k]) => `${n}=${k}`).join(', ')}`);

  // [10] the next training date is back on the athlete's normal kit
  const nextTraining = addDaysISO(TARGET_DATE, 2);
  setClock(nextTraining);
  const nextAfter = visibleSession(nextTraining, weekStart);
  printSession(`[10] NEXT DATE ${nextTraining}`, nextAfter, fullTags);
  console.log(`[10] identical to pre-answer reading of that day: ${JSON.stringify(nextAfter.rows.map((r) => r.name)) === JSON.stringify(nextDayBefore.rows.map((r) => r.name))}`);

  // ── [9] CLOSE / REOPEN ────────────────────────────────────────────────
  setClock(TARGET_DATE);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { relaunchApp } = require('../src/__tests__/support/athleteJourney');
  const relaunch = await quietAsync(() => relaunchApp({ storage: localStorageData, todayISO: TARGET_DATE }));
  console.log(`\n[9] RELAUNCH ok=${relaunch?.ok} error=${relaunch?.error ?? 'none'}`);
  const factsAfterBoot = storedEquipmentFacts();
  console.log(`[9] equipment facts after boot: ${factsAfterBoot.length} -> ${JSON.stringify(factsAfterBoot.map((f: any) => ({ tags: f.equipmentTags, scope: f.scope?.kind, date: f.scope?.date })))}`);
  const reWeekStart = weekStart;
  const afterBoot = visibleSession(TARGET_DATE, reWeekStart);
  printSession('[9] AFTER RELAUNCH', afterBoot, afterTags);
  console.log(`[9] identical to pre-relaunch: ${JSON.stringify(afterBoot.rows) === JSON.stringify(after.rows)}`);
  console.log(`[9]   pre : ${JSON.stringify(after.rows.map((r) => `${r.name}@${r.kg}`))}`);
  console.log(`[9]   post: ${JSON.stringify(afterBoot.rows.map((r) => `${r.name}@${r.kg}`))}`);

  // ── [10] THE NEXT TRAINING DATE IS BACK ON THE NORMAL KIT ─────────────
  const nextWeekStart = addDaysISO(weekStart, 7);
  for (const probeDate of [addDaysISO(TARGET_DATE, 1), addDaysISO(TARGET_DATE, 5), addDaysISO(TARGET_DATE, 7)]) {
    setClock(probeDate);
    const ws = probeDate >= nextWeekStart ? nextWeekStart : weekStart;
    const s2 = visibleSession(probeDate, ws);
    const needsRemoved = s2.rows.filter((r) => !exerciseAllowedByEquipment(r.name, afterTags));
    console.log(`[10] ${probeDate}: ${s2.name ?? '(no session)'} rows=${JSON.stringify(s2.rows.map((r) => r.name))} rowsNeeding_${REMOVED_TAG}=${needsRemoved.length}`);
  }

  // [11] no profile equipment answer changed
  const profileNow: any = useProfileStore.getState().onboardingData;
  console.log(`\n[11] profile equipmentAnswer.tags.${REMOVED_TAG} = ${profileNow?.equipmentAnswer?.tags?.[REMOVED_TAG]} (expected 'have')`);
  console.log(`[11] profile.equipment still lists barbell: ${JSON.stringify(profileNow?.equipment ?? []).includes('barbell')}`);
}

if (require.main === module) { main().catch((e) => { unmute(); console.error(e); process.exit(1); }); }
