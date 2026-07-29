/** Probe: what does the scoped split actually produce on a combined day? */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => localStorageData.get(k) ?? null,
    setItem: (k: string, v: string) => { localStorageData.set(k, v); },
    removeItem: (k: string) => { localStorageData.delete(k); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => { throw new Error('NO NET'); };
process.env.TZ = 'Australia/Melbourne';

import type { TrainingProgram } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { PlanChange } from '../utils/planChangeTypes';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { applyPlanChange, listPlanChangeOptionsForDay } from '../utils/planChangeProducer';
import { getSessionComponents, splitAcceptedSessionForAthleteMove } from '../utils/sessionComponents';
import { snapshotProjectedDay } from '../utils/coachRevisionProposal';
import {
  samExport8Profile, SAM_EXPORT_8_MARKED_DAYS,
  SAM_EXPORT_8_TODAY_ISO, SAM_EXPORT_8_CURRENT_WEEK,
} from './support/samDeviceExport8Fixture';

const TODAY = SAM_EXPORT_8_TODAY_ISO;
const WEEK = SAM_EXPORT_8_CURRENT_WEEK;

function quiet<T>(b: () => T): T {
  const w = console.warn, e = console.error, d = console.debug, i = console.info, l = console.log;
  console.warn = console.error = console.debug = console.info = console.log = (() => undefined) as never;
  try { return b(); } finally {
    console.warn = w; console.error = e; console.debug = d; console.info = i; console.log = l;
  }
}

function reach(): void {
  localStorageData.clear();
  const profile = samExport8Profile();
  useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13', previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'Pre-season', phaseEntryWeekStartISO: '2026-07-13',
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const his = program.microcycles.find((c) => c.startDate.slice(0, 10) === WEEK) ?? null;
  useProgramStore.setState({
    currentProgram: program, currentMicrocycle: his,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'probe', injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  for (const [date, mark] of Object.entries(SAM_EXPORT_8_MARKED_DAYS)) {
    if (mark === 'game') quiet(() => useCalendarStore.getState().setGameDay(date, TODAY));
    else quiet(() => useCalendarStore.getState().setRestDay(date));
  }
}

function mondayFor(date: string): string {
  const p = new Date(`${date}T12:00:00`);
  p.setDate(p.getDate() - ((p.getDay() + 6) % 7));
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`;
}
function vw(week = WEEK): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(week, buildScheduleStateImperative()));
}
function weekOf(d: string) { return vw(mondayFor(d)); }
function tapAdd(date: string, category: string) {
  return quiet(() => applyPlanChange({
    change: { kind: 'add_category', date, category } as PlanChange,
    visibleWeek: weekOf(date), todayISO: TODAY,
    setManualOverride: (a, b, c) => useProgramStore.getState().setManualOverride(a, b, c),
  }));
}

reach();
// Same scan the device suite uses.
let found: { date: string; scope: string; dests: any[] } | null = null;
outer:
for (const week of ['2026-07-27', '2026-08-03']) {
  for (const day of vw(week)) {
    for (const c of ['strength_full', 'conditioning_light']) tapAdd(day.date, c);
    const parts = getSessionComponents(
      weekOf(day.date).find((e) => e.date === day.date)?.workout ?? null).map((p) => String(p.id));
    if (parts.length < 2) continue;
    const opts = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: weekOf(day.date), date: day.date, todayISO: TODAY }));
    if (opts.move.refusal) continue;
    const scoped = opts.move.scopes.find((s: any) => s.id !== 'whole_day' && s.destinations.length > 0);
    if (!scoped) continue;
    found = { date: day.date, scope: scoped.id, dests: scoped.destinations };
    break outer;
  }
}
console.log('OFFER:', JSON.stringify(found));
if (found) {
  const day = weekOf(found.date).find((d) => d.date === found!.date)!;
  console.log('components:', JSON.stringify(getSessionComponents(day.workout).map((p) => String(p.id))));
  const snap = quiet(() => snapshotProjectedDay(day)) as any;
  console.log('snapshot sections:', JSON.stringify((snap.workout?.sections ?? []).map((s: any) => ({ kind: s.kind, title: s.title, items: s.items?.length }))));
  console.log('source rows:', JSON.stringify((day.workout?.exercises ?? []).map((r: any) => r.exercise?.name ?? r.exerciseId ?? r.name)));

  const split = quiet(() => splitAcceptedSessionForAthleteMove({
    day, scope: 'strength_component' as never })) as any;
  if (split.ok) {
    console.log('MOVED  :', split.movedWorkout?.name, JSON.stringify(getSessionComponents(split.movedWorkout).map((p: any) => String(p.id))));
    console.log('  rows :', JSON.stringify((split.movedWorkout?.exercises ?? []).map((r: any) => r.exercise?.name ?? r.exerciseId ?? r.name)));
    console.log('REMAIN :', split.remainingWorkout?.name ?? 'NULL', JSON.stringify(getSessionComponents(split.remainingWorkout).map((p: any) => String(p.id))));
    console.log('  rows :', JSON.stringify((split.remainingWorkout?.exercises ?? []).map((r: any) => r.exercise?.name ?? r.exerciseId ?? r.name)));
  } else {
    console.log('SPLIT FAILED:', split.code);
  }
}
