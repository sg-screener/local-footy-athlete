/**
 * WHAT DOES "TOTALLY COOKED" ACTUALLY DO TO A REAL SESSION?
 *
 * Sam, 2026-08-21: *"Delete the obsolete expectation that fatigue 7/10 collapses
 * the session to Rest. Re-measure 'Totally cooked' through the current visible
 * Tired button on a real generated session. If it genuinely leaves hard work
 * completely unchanged while warning against it, report that current defect —
 * do not restore the old rewrite system."*
 *
 * THE OLD MEASUREMENT WAS THROUGH THE WRONG DOOR. It drove a legacy
 * `fatigue 7/10` intent through a retired dispatcher inside a suite fixture.
 * This drives the CURRENT visible control: the Day/Home Tired sheet's third
 * option, `Totally cooked`, whose `onPress` is `onApply('cooked_week')` ->
 * `readinessActionForKind('cooked_week', …)` -> `set_fatigue_status`,
 * `level: 'cooked'`, `scope: 'current_week'` — the exact action the button
 * commits, through the real durable executor.
 *
 * Run: npm run probe:totally-cooked
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
import { quiet, quietAsync, setJourneyClock } from '../src/__tests__/support/athleteJourney';
import { executeProgramControlActionDurably } from '../src/utils/programControlActions';
import { readinessActionForKind } from '../src/utils/weekReadinessActions';

const INSTALL_DAY = '2026-07-13';
const mondayFor = (d: string) => {
  const p = new Date(`${d}T12:00:00Z`);
  return addDaysISO(d, -((p.getUTCDay() + 6) % 7));
};

function theAthlete(): OnboardingData {
  return {
    firstName: 'Sim', heightCm: 184, weightKg: 90, seasonPhase: 'In-season',
    position: 'inside_mid', motivation: 'Dominate your level', trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Friday'],
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

function install(): string {
  localStorageData.clear();
  resetStoresToFreshInstall('probe-totally-cooked');
  const profile = theAthlete();
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  setJourneyClock(INSTALL_DAY);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: INSTALL_DAY, previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'In-season' as never,
      phaseEntryWeekStartISO: mondayFor(INSTALL_DAY),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const settled = program.microcycles[1] ?? program.microcycles[0]!;
  const weekStart = String(settled.startDate).slice(0, 10);
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {}, selectedDate: weekStart,
    reason: 'probe-totally-cooked:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}

type DaySnapshot = {
  date: string; type: string | null; rows: string[]; sets: number[];
  notes: string[]; source: string | null;
};

function snapshotWeek(weekStartISO: string): DaySnapshot[] {
  const out: DaySnapshot[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDaysISO(weekStartISO, i);
    const resolved = quiet(() => resolveDateWithConditioning(date, buildScheduleStateImperative())) as
      { workout?: Workout | null; source?: string } | null;
    const workout = resolved?.workout ?? null;
    out.push({
      date,
      type: (workout as { workoutType?: string } | null)?.workoutType ?? null,
      rows: ((workout?.exercises ?? []) as { exercise?: { name?: string } }[])
        .map((r) => r.exercise?.name ?? '').filter(Boolean),
      sets: ((workout?.exercises ?? []) as { prescribedSets?: number }[]).map((r) => r.prescribedSets ?? 0),
      notes: ((workout as { coachNotes?: string[] } | null)?.coachNotes ?? []),
      source: resolved?.source ?? null,
    });
  }
  return out;
}

const HARD = /sprint|plyo|jump|box jump|max|acceleration|flying|bound|hill|repeat/i;
function hardRows(day: DaySnapshot) { return day.rows.filter((r) => HARD.test(r)); }

function printWeek(label: string, week: DaySnapshot[]) {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
  for (const d of week) {
    if (!d.rows.length && !d.type) { console.log(`  ${d.date}  (rest)`); continue; }
    console.log(`  ${d.date}  ${String(d.type ?? '-').padEnd(14)} src=${String(d.source).padEnd(9)} `
      + `sets=[${d.sets.join(',')}]`);
    console.log(`             rows: ${JSON.stringify(d.rows)}`);
    if (d.notes.length) console.log(`             notes: ${JSON.stringify(d.notes)}`);
  }
}

async function main(): Promise<void> {
  const weekStart = install();
  setJourneyClock(weekStart);
  const before = snapshotWeek(weekStart);
  printWeek('BEFORE — the week as generated', before);

  const action = readinessActionForKind('cooked_week', {
    anchorDateISO: weekStart, todayISO: weekStart,
  });
  console.log(`\n  the button commits: ${JSON.stringify({
    type: (action as { type?: string }).type,
    scope: (action as { scope?: string }).scope,
    payload: (action as { payload?: unknown }).payload,
  })}`);
  const result = await quietAsync(() => executeProgramControlActionDurably(action as never, { todayISO: weekStart })) as
    { ok?: boolean; message?: string; changedProgram?: boolean };
  console.log(`  executor -> ok=${result?.ok} changedProgram=${result?.changedProgram}`);
  console.log(`  message  -> "${String(result?.message ?? '')}"`);

  const after = snapshotWeek(weekStart);
  printWeek('AFTER — Totally cooked', after);

  console.log(`\n${'═'.repeat(72)}\nVERDICT\n${'═'.repeat(72)}`);
  let anyRowChange = false; let anySetChange = false; let warnedDays = 0; let hardKept = 0;
  for (let i = 0; i < before.length; i += 1) {
    const b = before[i]!; const a = after[i]!;
    const rowsSame = JSON.stringify(b.rows) === JSON.stringify(a.rows);
    const setsSame = JSON.stringify(b.sets) === JSON.stringify(a.sets);
    if (!rowsSame) anyRowChange = true;
    if (!setsSame) anySetChange = true;
    const warns = a.notes.filter((n) => /caution|avoid|skip|easy|focus/i.test(n));
    if (warns.length) warnedDays += 1;
    const hb = hardRows(b); const ha = hardRows(a);
    if (hb.length && JSON.stringify(hb) === JSON.stringify(ha)) hardKept += hb.length;
    if (!rowsSame || !setsSame || warns.length) {
      console.log(`  ${a.date}: rows ${rowsSame ? 'UNCHANGED' : 'CHANGED'}, `
        + `sets ${setsSame ? 'UNCHANGED' : 'CHANGED'}, warnings=${warns.length}`
        + (hb.length ? `, hard rows before=${JSON.stringify(hb)} after=${JSON.stringify(ha)}` : ''));
    }
  }
  console.log(`\n  any row change across the week : ${anyRowChange}`);
  console.log(`  any set change across the week : ${anySetChange}`);
  console.log(`  days carrying a warning        : ${warnedDays}`);
  console.log(`  hard rows kept unchanged       : ${hardKept}`);
  const defect = !anyRowChange && !anySetChange && hardKept > 0;
  console.log(`\n  ${defect
    ? 'DEFECT: hard work is completely unchanged. Whether it is warned about is printed above.'
    : 'NOT the reported defect: the week did change.'}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
