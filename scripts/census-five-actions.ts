/**
 * THE FIVE ACTIONS, ASKED OF THE REAL FLOW — WHICH ONE IS THE NEXT SLICE?
 *
 * Sam's hub is Equipment · Injury · Add · Remove · Swap, and it may not be built
 * until all five work. Equipment landed 2026-08-19. This driver asks the other
 * four the only question that decides an order: **on a real generated athlete,
 * through the real door, what does the athlete actually get?**
 *
 * It is a chooser, not a gate. It reports; it asserts nothing.
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
import { resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';
import {
  quiet, quietAsync, setJourneyClock, swapOptionsFor, substituteExercise,
  leaveExerciseOut, walkProgramControlDoor, extraSessionOfferFor, acceptExtraSession,
} from '../src/__tests__/support/athleteJourney';
import { buildGuidedInjuryConstraint } from '../src/utils/guidedInjuryControl';
import { getAthleteExclusions } from '../src/store/athletePreferencesStore';

const INSTALL_DAY = '2026-07-13';
const TARGET = '2026-07-22';

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

function install(): string {
  localStorageData.clear();
  resetStoresToFreshInstall('five-actions:install');
  const profile = theAthlete();
  useProfileStore.getState().updateOnboardingData(profile);
  const c = quiet(() => useProfileStore.getState().completeOnboarding()) as { ok?: boolean } | undefined;
  if (c && c.ok === false) throw new Error('onboarding refused');
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
    reason: 'five-actions:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}

function rows(dateISO: string, weekStartISO: string): string[] {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  const w = (day as { workout?: Workout } | undefined)?.workout;
  return (w?.exercises ?? []).map((r) => {
    const n = (r as { exercise?: { name?: string } }).exercise?.name ?? (r as { name?: string }).name;
    const kg = (r as { prescribedWeightKg?: number }).prescribedWeightKg;
    return `${n}@${kg ?? '-'}`;
  });
}

function report(label: string, before: string[], after: string[], extra = '') {
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  console.log(`\n${'─'.repeat(72)}\n${label}`);
  console.log(`  before : ${JSON.stringify(before)}`);
  console.log(`  after  : ${JSON.stringify(after)}`);
  console.log(`  CHANGED: ${changed ? 'YES' : '*** NO — the athlete sees nothing ***'}`);
  if (extra) console.log(`  ${extra}`);
}

async function main(): Promise<void> {
  console.log('THE FIVE ACTIONS ON A REAL ATHLETE — off-season, 3 days, full gym, 5+ years');
  console.log(`target session ${TARGET}`);

  // ── SWAP ────────────────────────────────────────────────────────────────
  {
    const ws = install(); setJourneyClock(TARGET);
    const before = rows(TARGET, ws);
    const victim = before[0]!.split('@')[0]!;
    const options = swapOptionsFor({ dateISO: TARGET, originalExercise: victim,
      existingExerciseNames: before.map((r) => r.split('@')[0]!) });
    let doorMsg = 'no option offered';
    if (options.length > 0) {
      const pick = options[0]!;
      const res = await substituteExercise({
        dateISO: TARGET, weekStartISO: ws, fromExercise: victim,
        toExercise: { name: pick.name, sets: 3, repsMin: 4, repsMax: 6 },
      });
      doorMsg = `door ok=${res.ok} "${res.message}"  chose ${pick.name} (${pick.tier})`;
    }
    report(`SWAP — "${victim}" for something else, today only`, before, rows(TARGET, ws),
      `${options.length} option(s) offered; ${doorMsg}`);
  }

  // ── REMOVE ──────────────────────────────────────────────────────────────
  {
    const ws = install(); setJourneyClock(TARGET);
    const before = rows(TARGET, ws);
    const victim = before[0]!.split('@')[0]!;
    const res = quiet(() => leaveExerciseOut({
      exercise: victim, scope: 'today_only', decidedOnISO: TARGET, reason: 'dont_like',
    })) as { ok?: boolean; reason?: string };
    const stored = quiet(() => getAthleteExclusions());
    report(`REMOVE — leave "${victim}" out today`, before, rows(TARGET, ws),
      `owner ok=${res?.ok} reason=${res?.reason ?? '-'}; stored exclusions=${JSON.stringify(stored)}`);
  }

  // ── INJURY ──────────────────────────────────────────────────────────────
  {
    const ws = install(); setJourneyClock(TARGET);
    const before = rows(TARGET, ws);
    const constraint = quiet(() => buildGuidedInjuryConstraint({
      region: 'lower_body' as never, area: 'Hamstring', severity: 6,
      severityBand: 'moderate' as never, adjustmentLevel: 'train_around' as never,
      triggers: ['sprinting'], seriousSymptoms: false,
    } as never, { todayISO: TARGET }));
    const res = await walkProgramControlDoor({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { constraint },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { weekStartISO: ws, todayISO: TARGET });
    report('INJURY — moderate hamstring, train around', before, rows(TARGET, ws),
      `door ok=${res.ok} "${res.message}"`);
  }

  // ── ADD ─────────────────────────────────────────────────────────────────
  {
    const ws = install(); setJourneyClock(TARGET);
    const before = [...rows('2026-07-20', ws), '||', ...rows(TARGET, ws), '||', ...rows('2026-07-24', ws)];
    // ⚠ **NOT MEASURED, AND SAID SO RATHER THAN SCORED.** `decideExtraSessionOffer`
    // reads `history.qualifies` and this driver has no real block history to give
    // it, so it throws — a fault of THIS harness, not of the Add door. Reporting
    // it as "Add is broken" would be inventing a finding.
    let offer: { offer: boolean; refusal?: string; question?: { offeredSessionsPerWeek: number; trainingDays: readonly string[] } };
    try {
      offer = quiet(() => extraSessionOfferFor({
        profile: useProfileStore.getState().onboardingData as never,
        history: null, forBlockNumber: 1, currentSessionsPerWeek: 3,
      })) as never;
    } catch (e) {
      console.log(`\n${'─'.repeat(72)}\nADD — take an extra session this block`);
      console.log(`  NOT MEASURED — this driver cannot build the block history the offer reads.`);
      console.log(`  (${(e as Error).message})`);
      return;
    }
    let doorMsg = `offer=${offer.offer} refusal=${offer.refusal ?? '-'}`;
    if (offer.offer && offer.question) {
      const res = await acceptExtraSession({
        profile: useProfileStore.getState().onboardingData as never,
        forBlockNumber: 1, sessionsPerWeek: offer.question.offeredSessionsPerWeek,
        todayISO: TARGET, availableDays: offer.question.trainingDays,
      });
      doorMsg += `; door ok=${res.ok} "${res.message}"`;
    }
    const after = [...rows('2026-07-20', ws), '||', ...rows(TARGET, ws), '||', ...rows('2026-07-24', ws)];
    report('ADD — take an extra session this block', before, after, doorMsg);
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
