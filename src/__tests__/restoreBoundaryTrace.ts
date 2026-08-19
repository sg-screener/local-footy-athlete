/**
 * THE RESTORE BOUNDARY, PRINTED AT EVERY SEAM. Diagnostic, not a suite.
 *
 * Route traced:
 *   Restore exercise -> clearActiveProgramModifier -> restoreExcludedExercise
 *   -> ledger reversal -> accepted-state rebuild -> visible day projection
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData } from '../types/domain';
import { useProgramStore } from '../store/programStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { decisionLedgerEntries } from '../store/decisionLedgerStore';
import { replayableEntries } from '../rules/decisionLedgerReplay';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { applyExerciseExclusionDecision } from '../utils/exerciseExclusionOwner';
import { getActiveProgramModifiers } from '../utils/activeProgramModifiers';
import { clearActiveCoachNote } from '../utils/activeCoachNotes';
import {
  coldStartThroughOnboarding, resolvedDays, relaunchApp, setJourneyClock, quiet, quietAsync,
} from './support/athleteJourney';
import { profileForDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';

const INSTALL_DAY = '2026-07-13';
const SUBJECT = 'Back Squat';

function unusedAthlete(): OnboardingData {
  return {
    firstName: 'Jordan', ageRange: '22-26', position: 'inside_mid',
    heightCm: 182, weightKg: 84, motivation: 'Dominate your level',
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '90 minutes', teamTrainingIntensity: 'Hard',
    usualGameDay: 'Saturday', gameDay: 'Saturday',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine',
      'hamstring_curl', 'knee_extension', 'bands'],
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have', bands: 'have',
        bench: 'have', pullup_bar: 'have', kettlebell: 'have', foam_roller: 'have',
        plyo_box: 'have',
      },
      modalities: {
        bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have',
      },
      answeredOn: INSTALL_DAY,
    },
    injuries: [], goals: ['Get stronger'], experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good', sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
  } as unknown as OnboardingData;
}

function boundary(label: string, dayISO: string, weekStartISO: string): void {
  const prog = useProgramStore.getState() as any;
  const prefs = useAthletePreferencesStore.getState().prefs as any;
  const ledger = decisionLedgerEntries();
  const replayable = replayableEntries(ledger);
  const accepted = prog.acceptedMaterialContext ?? {};
  const base = accepted.acceptedCompositionBase ?? null;

  console.log(`\n──────── ${label} ────────`);
  console.log('  [1] ACTIVE EXCLUSION IDENTITIES: ' + JSON.stringify(
    (prefs.exclusions ?? []).map((e: any) => `${e.exercise}/${e.scope}/${e.status ?? 'n/a'}`)));
  console.log('      legacy prefs.excluded: ' + JSON.stringify(prefs.excluded ?? []));
  console.log('  [2] LEDGER (all): ' + JSON.stringify(ledger.map((e: any) =>
    `${e.id}:${e.decision.kind}${e.decision.kind === 'program_control'
      ? '/' + e.decision.action.type : ''}${e.decision.kind === 'reversal'
      ? '->' + e.decision.reversedEntryId : ''}`)));
  console.log('      REPLAYABLE: ' + JSON.stringify(replayable.map((e: any) =>
    `${e.id}:${e.decision.kind}${e.decision.kind === 'program_control'
      ? '/' + e.decision.action.type : ''}`)));
  console.log('  [3] DATE OVERRIDES: ' + JSON.stringify(Object.keys(prog.dateOverrides ?? {})));
  const dayOverride = (prog.dateOverrides ?? {})[dayISO];
  console.log('      override@' + dayISO + ' rows: ' + JSON.stringify(
    dayOverride ? (dayOverride.exercises ?? []).map((r: any) => r.exercise?.name ?? r.name) : null));
  console.log('      overrideContexts: ' + JSON.stringify(Object.keys(prog.overrideContexts ?? {})));
  console.log('      weekScopedOverlays: ' + JSON.stringify(Object.keys(prog.weekScopedOverlays ?? {})));
  console.log('  [3b] userRemovalConstraints: ' + JSON.stringify(
    (prog.userRemovalConstraints ?? []).map((c: any) =>
      `${c.date ?? c.dateISO ?? '?'}:${c.exerciseName ?? c.exercise ?? c.componentId ?? '?'}`)));
  console.log('  [3c] reversibleAdjustmentLedger entries: ' + JSON.stringify(
    ((prog.reversibleAdjustmentLedger ?? {}).entries ?? []).map((e: any) =>
      `${e.id}:${e.kind ?? '?'}:${e.status ?? '?'}`)));

  // ACCEPTED PROGRAM identities for the day
  const acceptedProgram = base?.program ?? base?.currentProgram ?? null;
  let acceptedRows: string[] | null = null;
  if (acceptedProgram) {
    for (const mc of acceptedProgram.microcycles ?? []) {
      for (const w of mc.workouts ?? []) {
        if (String(w.date ?? '').slice(0, 10) === dayISO) {
          acceptedRows = (w.exercises ?? []).map((r: any) => r.exercise?.name ?? r.name);
        }
      }
    }
  }
  console.log('  [4] ACCEPTED base present: ' + Boolean(base)
    + ' | accepted program rows@' + dayISO + ': ' + JSON.stringify(acceptedRows));
  // currentProgram (the live source program) for the same day
  // A Workout has dayOfWeek, NOT a date: locate the microcycle by startDate,
  // then the workout by day-of-week offset.
  let currentRows: string[] | null = null;
  const dow = new Date(dayISO + 'T12:00:00').getDay();
  for (const mc of (prog.currentProgram?.microcycles ?? [])) {
    const start = String(mc.startDate ?? '').slice(0, 10);
    if (!start) continue;
    const end = new Date(new Date(start + 'T12:00:00').getTime() + 6 * 864e5)
      .toISOString().slice(0, 10);
    if (dayISO < start || dayISO > end) continue;
    for (const w of (mc.workouts ?? [])) {
      if (Number(w.dayOfWeek) === dow) {
        currentRows = (w.exercises ?? []).map((r: any) => r.exercise?.name ?? r.name);
      }
    }
  }
  console.log('      currentProgram rows@' + dayISO + ': ' + JSON.stringify(currentRows));
  console.log('      currentProgram id=' + (prog.currentProgram?.id ?? null)
    + ' generatedAt=' + (prog.currentProgram?.generatedAt ?? null)
    + ' microcycles=' + (prog.currentProgram?.microcycles?.length ?? 0));

  // VISIBLE
  const days = quiet(() => resolvedDays(weekStartISO));
  const visible = days.find((d) => d.dateISO === dayISO);
  console.log('  [5] VISIBLE rows@' + dayISO + ' ('
    + (visible?.sessionName ?? 'no session') + '): '
    + JSON.stringify((visible?.rows ?? []).map((r) => r.name)));

  const { useBlockSelectionHistoryStore } = require('../store/blockSelectionHistoryStore');
  const sel = (useBlockSelectionHistoryStore.getState().selections ?? []) as any[];
  console.log('  [7] BLOCK SELECTION HISTORY (' + sel.length + '): ' + JSON.stringify(
    sel.slice(0, 12).map((x: any) =>
      `b${x.blockNumber ?? '?'}:${x.slot ?? x.pattern ?? x.role ?? '?'}=${x.exerciseName ?? x.exercise ?? x.name ?? '?'}`)));
  const squatSel = sel.filter((x: any) => JSON.stringify(x).toLowerCase().includes('squat'));
  console.log('      SQUAT-BEARING SELECTION ROWS: ' + JSON.stringify(squatSel));
  const mods = quiet(() => getActiveProgramModifiers());
  console.log('  [6] ACTIVE MODIFIERS: ' + JSON.stringify(mods.map((m: any) =>
    `${m.id}|src=${m.source}|kind=${m.payload?.kind ?? '-'}|ex=${m.payload?.exercise ?? '-'}`)));
}

async function main(): Promise<void> {
  const install = await coldStartThroughOnboarding({
    profile: profileForDevE2ESeed('exercise-removal-restart' as never),
    installDayISO: INSTALL_DAY,
  });
  console.log('block one start: ' + install.blockOneStart
    + ' | refusal: ' + install.onboardingRefusal);

  const weekStart = install.blockOneStart;
  // Find the day that actually carries Back Squat.
  const days = quiet(() => resolvedDays(weekStart));
  for (const d of days) {
    console.log(`  ${d.dateISO} ${d.weekday} :: ${d.sessionName ?? '-'} :: `
      + JSON.stringify(d.rows.map((r) => r.name)));
  }
  const target = days.find((d) => d.rows.some((r) => r.name === SUBJECT));
  if (!target) {
    console.log('\n!! NO DAY CARRIES ' + SUBJECT + ' — pick another subject');
    return;
  }
  const dayISO = target.dateISO;
  console.log('\nSUBJECT DAY: ' + dayISO + ' (' + target.weekday + ')');
  setJourneyClock(dayISO);

  boundary('A. BEFORE ANY REMOVAL', dayISO, weekStart);

  // ══ CONTROL ARM ═══════════════════════════════════════════════════════════
  // A RESTART WITH NO REMOVAL AT ALL. If Back Squat does not survive THIS, the
  // removal is not the cause of anything and the whole finding changes.
  if (process.env.CONTROL_ARM === '1') {
    const c1 = await relaunchApp({ storage: localStorageData, todayISO: dayISO });
    console.log('\ncontrol relaunch ok=' + c1.ok + ' err=' + c1.error);
    boundary('A2. AFTER A RESTART WITH NO REMOVAL (CONTROL)', dayISO, weekStart);
    return;
  }

  // ── THE REMOVAL, through HomeScreenV2.applyRemoveFlowScope's two owners ──
  const rawWeek = quiet(() => resolvedDays(weekStart));
  const removal = await quietAsync(() => executeProgramControlActionDurably({
    type: 'remove_exercise',
    source: { screen: 'program_tab', surface: 'home_change_card', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { date: dayISO, exercise: SUBJECT },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  } as never, { todayISO: dayISO } as never)) as any;
  console.log('\nremove_exercise -> ok=' + removal?.ok + ' msg=' + (removal?.message ?? ''));
  const decision = quiet(() => applyExerciseExclusionDecision({
    exercise: SUBJECT, scope: 'today_only' as never, decidedOnISO: dayISO,
  })) as any;
  console.log('applyExerciseExclusionDecision -> ok=' + decision?.ok);
  void rawWeek;

  boundary('B. AFTER REMOVAL', dayISO, weekStart);

  // ── THE REAL RESTART ──
  const relaunch = await relaunchApp({ storage: localStorageData, todayISO: dayISO });
  console.log('\nrelaunch ok=' + relaunch.ok + ' err=' + relaunch.error);

  boundary('C. AFTER RESTART', dayISO, weekStart);

  // ── THE RESTORE DOOR, exactly as the coach note routes it ──
  const mods = quiet(() => getActiveProgramModifiers()) as any[];
  const mod = mods.find((m) => m.payload?.kind === 'excluded'
    && m.payload?.exercise === SUBJECT);
  if (!mod) { console.log('!! NO EXCLUSION MODIFIER FOUND'); return; }
  console.log('\nRESTORE targets modifier: ' + mod.id);
  const cleared = quiet(() => clearActiveCoachNote(mod.id)) as any;
  console.log('clearActiveCoachNote -> cleared=' + (cleared.cleared?.id ?? null)
    + ' rebuildRequired=' + cleared.rebuildRequired);

  boundary('D. AFTER RESTORE (no rebuild yet)', dayISO, weekStart);

  // ── WHAT THE SCREEN DOES NEXT: handleProgramControlResult -> runRebuild ──
  // ── E1: WHAT THE SCREEN ACTUALLY DOES — useProgramRebuild.runRebuild's body,
  // call for call (generateProgramFromProfile -> decideSweepForCurrentStores ->
  // commitRebuiltProgram). This is the production continuation of Restore.
  console.log('\n(the screen calls runRebuild(); reproducing its body exactly)');
  const { generateProgramFromProfile } = require('../services/api/generateProgram');
  const { decideSweepForCurrentStores, commitRebuiltProgram } = require('../utils/weekRebuild');
  const { getCurrentBlockNumberForGeneration } = require('../store/programStore');
  const { useProfileStore } = require('../store/profileStore');
  const liveProfile = useProfileStore.getState().onboardingData;
  const rebuilt = await quietAsync(() => generateProgramFromProfile(liveProfile, {
    weekAcceptance: 'forward_decision',
    blockNumber: getCurrentBlockNumberForGeneration(),
  }));
  const sweep = quiet(() => decideSweepForCurrentStores(rebuilt, liveProfile)) as any;
  quiet(() => commitRebuiltProgram(rebuilt, {
    preserve: sweep.preserve, clear: sweep.clear, conflictsRemoved: sweep.conflictsRemoved,
  }));
  boundary('E1. AFTER runRebuild() — THE SCREEN\'S OWN CONTINUATION', dayISO, weekStart);

  // ── E2: the settle door undo uses, for comparison.
  const { rebuildDerivedWorld } = require('../store/quiescentBoot');
  await quietAsync(() => rebuildDerivedWorld());

  boundary('E2. AFTER rebuildDerivedWorld() (the settle door undo uses)', dayISO, weekStart);

  // ── THE DECISIVE CONTROL: a SECOND restart with the ledger already annulled.
  // If the replay of dl-1 is what wrote Front Squat into currentProgram, a boot
  // whose replay set is EMPTY must regenerate a program that still has Back
  // Squat. If Back Squat is still absent, the source program itself is spoiled
  // and no re-derivation can recover it.
  const relaunch2 = await relaunchApp({ storage: localStorageData, todayISO: dayISO });
  console.log('\nsecond relaunch ok=' + relaunch2.ok + ' err=' + relaunch2.error);
  boundary('F. AFTER SECOND RESTART (replay set empty)', dayISO, weekStart);
}

void main().then(() => console.log('\n=== TRACE COMPLETE ==='))
  .catch((e) => { console.error('TRACE THREW:', e); process.exit(1); });
