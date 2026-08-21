/**
 * DOES THE CURRENT SYSTEM COVER WHAT THE DELETED READ-TIME INJURY FILTER DID —
 * ACROSS APPLYING, CLEARING AND REOPENING AN INJURY?
 *
 * Sam, 2026-08-21: *"Do not rebuild the old read-time injury filter. Measure
 * whether the current Injury and Status owners cover its useful safety
 * behaviour across reopening and clearing an injury."*
 *
 * `utils/injuryWorkoutFilter.applyInjuryFilterToWorkout(workout, injuryState)`
 * was deleted by the 2026-08-19 burn. Its own suites claimed four things:
 *   1. risky work for the injured area is taken off the session;
 *   2. limited-but-permitted work SURVIVES at moderate severity;
 *   3. safe unaffected work is untouched;
 *   4. a reintroduction (severity coming DOWN from a high) is treated
 *      differently from a fresh injury at the same number.
 *
 * This probe drives the REAL doors on a REAL generated week —
 * `executeProgramControlActionDurably({ set_injury_modifier })` and its
 * `clear_injury_modifier` twin — and reads what the ATHLETE can see, through
 * the same two reads the durable door itself uses for its honesty claim.
 *
 * Run: npm run probe:injury-filter-coverage
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
process.env.TZ = 'Australia/Melbourne';

/* eslint-disable import/first */
import type { OnboardingData, TrainingProgram, Workout } from '../src/types/domain';
import { addDaysISO } from '../src/utils/programBlockState';
import { useProgramStore } from '../src/store/programStore';
import { useProfileStore } from '../src/store/profileStore';
import { useCalendarStore } from '../src/store/calendarStore';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { commitRebuiltProgram } from '../src/utils/weekRebuild';
import { resolveDateWithConditioning, resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';
import { quiet, setJourneyClock } from '../src/__tests__/support/athleteJourney';
import { buildGuidedInjuryConstraint, type GuidedInjuryFlowResult } from '../src/utils/guidedInjuryControl';
import { injuryWithholdingsOn } from '../src/rules/injuryWithheldRows';
import { applyExclusionsToAuthoredDay } from '../src/rules/exerciseExclusions';
import { liveAthleteExclusions } from '../src/utils/liveEvaluationSurfaces';
import { executeProgramControlActionDurably } from '../src/utils/programControlActions';
import { getActiveProgramModifiers } from '../src/utils/activeProgramModifiers';
import { buildCoachNotesFromModifiers } from '../src/utils/activeCoachNotes';

const INSTALL_DAY = '2026-07-13';

function mondayFor(d: string): string {
  const p = new Date(`${d}T12:00:00Z`);
  return addDaysISO(d, -((p.getUTCDay() + 6) % 7));
}

function theAthlete(): OnboardingData {
  return {
    firstName: 'Sim', heightCm: 184, weightKg: 90, seasonPhase: 'Off-season',
    position: 'inside_mid', motivation: 'Dominate your level', trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
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

function install(tag: string): string {
  localStorageData.clear();
  resetStoresToFreshInstall(tag);
  const profile = theAthlete();
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  setJourneyClock(INSTALL_DAY);
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
  const weekStart = String(settled.startDate).slice(0, 10);
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {}, selectedDate: weekStart,
    reason: `${tag}:generate`,
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}

/** The day as the ATHLETE sees it — the same read the durable door claims on. */
function visibleNames(dateISO: string): string[] {
  const resolved = quiet(() => resolveDateWithConditioning(dateISO, buildScheduleStateImperative()));
  const workout = applyExclusionsToAuthoredDay({
    workout: (resolved?.workout as Workout | undefined) ?? null,
    dateISO,
    exclusions: liveAthleteExclusions(),
  });
  return ((workout?.exercises ?? []) as { exercise?: { name?: string } }[])
    .map((row) => row.exercise?.name ?? '').filter((n) => n.length > 0);
}

/** Rows still ON the day but withheld — shown to the athlete as unavailable. */
function withheldNames(dateISO: string): string[] {
  const state = { ...buildScheduleStateImperative(), suppressInjuryAdjustment: true };
  const resolved = quiet(() => resolveDateWithConditioning(dateISO, state));
  try {
    return injuryWithholdingsOn({
      workout: (resolved?.workout as Workout | undefined) ?? null,
      dateISO,
      facts: useProgramStore.getState().acceptedMaterialContext?.temporarySourceFacts,
    }).map((entry) => entry.exercise);
  } catch { return []; }
}

function constraintFor(area: string, severity: number, todayISO: string, serious: boolean) {
  const answer: GuidedInjuryFlowResult = {
    region: 'other', area, severity,
    severityBand: serious ? 'severe' : 'moderate',
    adjustmentLevel: serious ? 'training_paused' : 'moderate',
    triggers: [], seriousSymptoms: serious,
  };
  return buildGuidedInjuryConstraint(answer, { todayISO });
}

async function setInjury(area: string, severity: number, todayISO: string, serious: boolean) {
  return executeProgramControlActionDurably({
    type: 'set_injury_modifier',
    source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { constraint: constraintFor(area, severity, todayISO, serious) },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  } as never, { todayISO });
}

/**
 * ⚠ FEED THE DOOR THE WAY THE SCREEN DOES. An empty payload makes
 * `clear_injury_modifier` return `ok=false, "No exact active injury episode
 * matched this action."` — a REFUSAL, not a restore failure. Measuring the
 * session after that refusal would have manufactured a defect. The real
 * surface reads the note off `buildCoachNotesFromModifiers` and hands back its
 * `injuryEpisodeId`, so this does the same.
 */
function activeInjuryEpisodeId(todayISO: string): string | null {
  const notes = buildCoachNotesFromModifiers(getActiveProgramModifiers(todayISO), []);
  const note = notes.find((candidate: any) => typeof candidate.injuryEpisodeId === 'string');
  return (note as any)?.injuryEpisodeId ?? null;
}

async function clearInjury(todayISO: string) {
  const episodeId = activeInjuryEpisodeId(todayISO);
  console.log(`  (clearing episodeId=${episodeId ?? 'NONE FOUND'})`);
  if (!episodeId) return { ok: false, message: 'PROBE COULD NOT FIND AN EPISODE ID — instrument fault, not a product result' };
  return executeProgramControlActionDurably({
    type: 'clear_injury_modifier',
    source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { episodeId },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
  } as never, { todayISO });
}

function show(label: string, date: string) {
  const v = visibleNames(date);
  const w = withheldNames(date);
  console.log(`  ${label.padEnd(26)} visible(${String(v.length).padStart(2)}) ${JSON.stringify(v)}`);
  console.log(`  ${''.padEnd(26)} withheld(${String(w.length).padStart(2)}) ${JSON.stringify(w)}`);
  return { visible: v, withheld: w };
}

const same = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

async function lane(tag: string, area: string, severity: number, serious: boolean) {
  console.log(`\n${'═'.repeat(78)}`);
  console.log(`LANE ${tag} — ${area} ${severity}/10, seriousSymptoms=${serious}`);
  console.log('═'.repeat(78));
  const weekStart = install(`probe-filter-${tag}`);
  let target = '';
  for (let i = 0; i < 14 && !target; i += 1) {
    const date = addDaysISO(weekStart, i);
    const week = quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
    const day = week.find((d) => d.date === date);
    const rows = ((day as { workout?: Workout } | undefined)?.workout?.exercises ?? []).length;
    if (rows >= 4) target = date;
  }
  if (!target) { console.log('  NO SESSION WITH >=4 ROWS — lane skipped'); return null; }
  setJourneyClock(target);
  console.log(`  session date: ${target}\n`);

  const before = show('[0] BEFORE any injury', target);
  const setRes: any = await setInjury(area, severity, target, serious);
  console.log(`\n  set_injury_modifier -> ok=${setRes?.ok} "${String(setRes?.message ?? '').slice(0, 90)}"`);
  const applied = show('[1] INJURY ACTIVE', target);

  const clearRes: any = await clearInjury(target);
  console.log(`\n  clear_injury_modifier -> ok=${clearRes?.ok} "${String(clearRes?.message ?? '').slice(0, 90)}"`);
  const cleared = show('[2] AFTER CLEARING', target);

  const reRes: any = await setInjury(area, severity, target, serious);
  console.log(`\n  set_injury_modifier (REOPEN) -> ok=${reRes?.ok} "${String(reRes?.message ?? '').slice(0, 90)}"`);
  const reopened = show('[3] AFTER REOPENING', target);

  const verdict = {
    lane: tag,
    protectedOnApply: !same(applied.visible, before.visible) || applied.withheld.length > 0,
    restoredOnClear: same(cleared.visible, before.visible) && cleared.withheld.length === 0,
    protectedOnReopen: !same(reopened.visible, before.visible) || reopened.withheld.length > 0,
    lostForever: before.visible.filter((n) => !cleared.visible.includes(n)),
  };
  console.log(`\n  VERDICT ${JSON.stringify(verdict, null, 2).replace(/\n/g, '\n  ')}`);
  return verdict;
}

/**
 * CLAIM 4 OF THE DELETED FILTER: a REINTRODUCTION — severity coming DOWN from a
 * high — is treated differently from a fresh injury at the same number. Driven
 * on the real door: set 9, then set 4 on the same day, and compare with a fresh
 * install that only ever saw 4.
 */
async function reintroductionLane() {
  console.log(`\n${'═'.repeat(78)}`);
  console.log('LANE REINTRODUCTION — 9/10 then 4/10, vs a fresh 4/10');
  console.log('═'.repeat(78));

  const readAt = async (steps: readonly { severity: number; serious: boolean }[], tag: string) => {
    const weekStart = install(`probe-filter-${tag}`);
    let target = '';
    for (let i = 0; i < 14 && !target; i += 1) {
      const date = addDaysISO(weekStart, i);
      const week = quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
      const day = week.find((d) => d.date === date);
      if (((day as { workout?: Workout } | undefined)?.workout?.exercises ?? []).length >= 4) target = date;
    }
    setJourneyClock(target);
    for (const step of steps) await setInjury('Hamstring', step.severity, target, step.serious);
    return { target, visible: visibleNames(target), withheld: withheldNames(target) };
  };

  const stepped = await readAt([{ severity: 9, serious: true }, { severity: 4, serious: false }], 'reintro');
  const fresh = await readAt([{ severity: 4, serious: false }], 'fresh4');
  console.log(`  9 -> 4  visible(${stepped.visible.length}) ${JSON.stringify(stepped.visible)}`);
  console.log(`          withheld(${stepped.withheld.length}) ${JSON.stringify(stepped.withheld)}`);
  console.log(`  fresh 4 visible(${fresh.visible.length}) ${JSON.stringify(fresh.visible)}`);
  console.log(`          withheld(${fresh.withheld.length}) ${JSON.stringify(fresh.withheld)}`);
  const differs = !same(stepped.visible, fresh.visible) || !same(stepped.withheld, fresh.withheld);
  console.log(`\n  VERDICT reintroduction differs from a fresh injury at the same number: ${differs ? 'YES' : 'NO'}`);
  return { lane: 'REINTRODUCTION', differs, stepped, fresh };
}

async function main(): Promise<void> {
  const results = [];
  results.push(await lane('ORDINARY', 'Hamstring', 6, false));
  results.push(await lane('RED-FLAG', 'Hamstring', 9, true));
  results.push(await lane('SHOULDER', 'Shoulder', 6, false));
  console.log(`\n${'═'.repeat(78)}\nSUMMARY\n${'═'.repeat(78)}`);
  const reintro = await reintroductionLane();
  for (const r of results.filter(Boolean) as any[]) {
    console.log(`${r.lane.padEnd(10)} apply=${r.protectedOnApply ? 'PROTECTED' : 'NOT PROTECTED'}  `
      + `clear=${r.restoredOnClear ? 'RESTORED' : 'NOT RESTORED'}  `
      + `reopen=${r.protectedOnReopen ? 'PROTECTED' : 'NOT PROTECTED'}  `
      + `lostForever=${JSON.stringify(r.lostForever)}`);
  }
  console.log(`${'REINTRO'.padEnd(10)} 9->4 differs from a fresh 4: ${reintro.differs ? 'YES' : 'NO'}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
