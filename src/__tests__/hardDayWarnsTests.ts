/**
 * R-359 — A SIXTH HARD DAY IS WARNED, NEVER REFUSED, AND THE APP NEVER ADDS IT.
 *
 * Sam, 2026-09-03: "go" on the cohort's blank-weeks finding. R-009 already
 * ruled that a refusal survives only when the action is physically
 * impossible and a 6th hard day is not; the generated-week contract still
 * refused it, so a 4-day athlete whose club nights fell on two other days
 * saw a BLANK program for 22 weeks and could not report an injury (measured
 * on the six-athlete cohort, three athletes, weeks 9-30).
 *
 * Two halves, one cell each:
 *  (1) the week PUBLISHES with its warning when the athlete's own choices
 *      make six hard days, and an injury report on that week is accepted;
 *  (2) when the athlete's own days already reach the cap, the scheduler's
 *      speed session rides an existing strength day instead of opening one.
 *
 * Run: npm run test:hard-day-warns
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { athleteAnswers, YEAR_START, yearTimeline, plusDays } from './compilerYear/catalog';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { applyPhaseShift } from '../utils/profileMutations';
import {
  coldStartThroughOnboarding, quiet, quietAsync, setJourneyClock, rolloverIfDue, followTheWeek,
} from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useProgramStore } from '../store/programStore';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import { getAthleteExclusions } from '../store/athletePreferencesStore';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { applyPlanChange } from '../utils/planChangeProducer';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import { resolveTapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { legalAddCandidates, legalAddFamilies } from '../utils/addExerciseCandidates';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

type Row = { exercise?: { name?: string }; section18Evidence?: { role?: string } };
type Day = { date: string; workout?: { name: string; workoutType?: string; exercises: Row[] } | null };
type Archetype = {
  id: string; gender: 'male' | 'female'; days: string[]; experience: string; equipment: string;
  initialPhase: string; clubDays: string[]; gameDay: string | null; extraGame: boolean;
};

const describe = (days: Day[]) => days.map((day) =>
  `${day.date.slice(5)} ${day.workout?.name ?? 'rest'}(${day.workout?.workoutType ?? '-'})`).join(' | ');

async function shiftPhase(archetype: Archetype, phase: string, date: string) {
  const next = applyPhaseShift(useProfileStore.getState().onboardingData, {
    targetPhase: phase, seasonFinishedOn: phase === 'Off-season' ? plusDays(date, -1) : undefined,
    preferredTrainingDays: [...archetype.days], teamTrainingDays: phase === 'Off-season' ? [] : [...archetype.clubDays],
    gameAnchor: phase === 'In-season' ? archetype.gameDay ? { kind: 'usual_day', day: archetype.gameDay } : { kind: 'no_usual_day' } : undefined,
  } as never) as Record<string, unknown>;
  return commitProfileProgramTransaction({ change: { kind: 'profile_setup', patch: {
    seasonPhase: next.seasonPhase, seasonFinishedOn: next.seasonFinishedOn,
    preferredTrainingDays: next.preferredTrainingDays, trainingDaysPerWeek: next.trainingDaysPerWeek,
    teamTrainingDays: next.teamTrainingDays, teamTrainingDaysPerWeek: next.teamTrainingDaysPerWeek,
    usualGameDay: next.usualGameDay, gameDay: next.gameDay,
  } }, todayISO: date, sourceSurface: 'phase_shift' } as never);
}

/** Walks to the phase week; a refused rollover is RETURNED, not thrown — it is the finding. */
async function walkTo(archetype: Archetype, phase: string, phaseWeek: number): Promise<{ weekStart: string; refusal: string | null }> {
  resetStoresToFreshInstall(`hard-day-warns:${archetype.id}`);
  const installed = await quietAsync(() => coldStartThroughOnboarding({
    profile: athleteAnswers(archetype as never), installDayISO: YEAR_START,
  }));
  check(`${archetype.id}: real onboarding accepted`, installed.onboardingRefusal === null, String(installed.onboardingRefusal));
  for (const entry of yearTimeline(archetype as never)) {
    setJourneyClock(entry.weekStart);
    if (entry.phaseWeek === 1 && entry.index > 0) await quietAsync(() => shiftPhase(archetype, entry.phase, entry.weekStart));
    const roll = quiet(() => rolloverIfDue(entry.weekStart)) as { refusal?: string | null };
    if (entry.phase === phase && entry.phaseWeek === phaseWeek) return { weekStart: entry.weekStart, refusal: roll.refusal ?? null };
    if (roll.refusal) return { weekStart: entry.weekStart, refusal: `${entry.phase} ${entry.phaseWeek}: ${roll.refusal}` };
    quiet(() => followTheWeek(entry.weekStart));
  }
  throw new Error(`${archetype.id}: ${phase} week ${phaseWeek} not reached`);
}

function judge(weekStart: string): { rebased: { contract?: unknown } | null; findings: { code: string; severity: string }[]; error: string | null } {
  const state = useProgramStore.getState() as unknown as Record<string, unknown>;
  let rebased: { contract?: unknown } | null = null;
  try {
    rebased = quiet(() => rebaseAcceptedEffectiveWeek({
      surfaces: { ...state, removalDecisions: state.userRemovalConstraints, athleteExclusions: getAthleteExclusions() },
      weekStart, profile: useProfileStore.getState().onboardingData, markedDays: useCalendarStore.getState().markedDays,
    } as never)) as { contract?: unknown };
  } catch (error) {
    return { rebased: null, findings: [], error: (error as Error).message };
  }
  const days = quiet(() => deriveVisibleWeekLive(weekStart, weekStart)) as unknown as Day[];
  const contract = rebased.contract;
  const evaluation = contract
    ? (quiet(() => evaluateSection18EffectiveWeek({
        contract, workouts: days.flatMap((day) => day.workout ? [day.workout] : []), weekStart,
      } as never)) as { findings?: { code: string; severity: string }[]; blockingViolations?: { code: string; severity?: string }[] } | null)
    : null;
  const findings = [...(evaluation?.findings ?? []), ...(evaluation?.blockingViolations ?? []).map((f) => ({ code: f.code, severity: 'blocking' }))];
  return { rebased, findings, error: null };
}

async function reportShoulder(date: string) {
  const constraint = buildGuidedInjuryConstraint({
    region: 'upper_body', area: 'shoulder', severity: 4, severityBand: 'mild',
    adjustmentLevel: 'light', triggers: ['pressing'], seriousSymptoms: false,
  } as never, { todayISO: date });
  return quietAsync(() => executeProgramControlActionDurably({
    type: 'set_injury_modifier',
    source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
    scope: 'current_and_future', payload: { constraint },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  } as never, { todayISO: date })) as Promise<{ ok?: boolean; message?: string }>;
}

(async () => {
  // ── (1) Six hard days by the athlete's own choices: warned, published, and an injury lands ──
  {
    const archetype: Archetype = {
      id: 'four-day-two-far-club-nights', gender: 'male', days: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      experience: '2-5 years', equipment: 'commercial', initialPhase: 'Pre-season',
      clubDays: ['Wednesday', 'Saturday'], gameDay: 'Sunday', extraGame: false,
    };
    const { weekStart, refusal } = await walkTo(archetype, 'Pre-season', 3);
    check('R-359 (1): the week with six hard days is not refused at rollover', refusal === null, String(refusal));
    const days = quiet(() => deriveVisibleWeekLive(weekStart, weekStart)) as unknown as Day[];
    const withRows = days.filter((day) => (day.workout?.exercises ?? []).length > 0).length;
    check('R-359 (1): the athlete sees a week, not a blank one', withRows >= 4, describe(days));
    const judged = judge(weekStart);
    check('R-359 (1): the published week carries its contract (not a contract-less fallback)',
      judged.error === null && !!judged.rebased?.contract, judged.error ?? 'no contract');
    const hardDay = judged.findings.find((finding) => finding.code === 'hard_day_breach' || finding.code === 'default_target_miss');
    check('CONTROL: the week checker still records the hard-day warning', !!hardDay, JSON.stringify(judged.findings.map((f) => f.code)));
    const wednesday = plusDays(weekStart, 2);
    setJourneyClock(wednesday);
    const report = await reportShoulder(wednesday);
    check('R-359 (1): a shoulder report on that week is accepted', report.ok === true, String(report.message));
  }

  // ── (4) The athlete's own sessions take the week PAST the permitted maximum: an exercise edit is still not refused ──
  // Before 2026-09-03 the effective-week evaluator marked `hard_day_breach`
  // blocking, so the accepted-week gateway threw on every exercise edit of a
  // week the app had already published: in test:canonical-weekly-compiler the
  // athlete-added fifth session was refused with "nothing on your plan changed".
  // The breach is a warning: the edit lands and the warning stays.
  {
    const archetype: Archetype = {
      id: 'five-day-club-tue-thu', gender: 'male', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      experience: '5+ years', equipment: 'commercial', initialPhase: 'Pre-season',
      clubDays: ['Tuesday', 'Thursday'], gameDay: null, extraGame: false,
    };
    const { weekStart, refusal } = await walkTo(archetype, 'Pre-season', 2);
    check('CONTROL: the five-day athlete with two club nights rolled over', refusal === null, String(refusal));
    setJourneyClock(weekStart);
    const weekDays = () => quiet(() => deriveVisibleWeekLive(weekStart, weekStart)) as unknown as Day[];
    let editDate = '';
    for (const day of weekDays()) {
      if (judge(weekStart).findings.some((finding) => finding.code === 'hard_day_breach')) break;
      if (day.workout && classifyVisibleSession(day.workout as never).contributions.mainStrength > 0) continue;
      const result = quiet(() => applyPlanChange({
        change: { kind: 'add_category', date: day.date, category: 'strength_full' },
        visibleWeek: weekDays(), todayISO: weekStart, applyOverride: () => undefined,
      } as never)) as { ok?: boolean };
      if (result.ok) editDate = day.date;
    }
    const breachBefore = judge(weekStart).findings.find((finding) => finding.code === 'hard_day_breach');
    check('CONTROL: the athlete\'s own added sessions take the week past the permitted hard-day maximum',
      !!breachBefore && !!editDate, JSON.stringify({ editDate, findings: judge(weekStart).findings.map((f) => f.code), week: describe(weekDays()) }));
    const target = () => weekDays().find((day) => day.date === editDate);
    const names = (target()?.workout?.exercises ?? []).map((r) => r.exercise?.name ?? '').filter(Boolean);
    const environment = quiet(() => resolveTapSwapEnvironment({
      date: editDate, profile: useProfileStore.getState().onboardingData,
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints, readinessSignal: null,
    }));
    const addArgs = { environment, profile: useProfileStore.getState().onboardingData, existingExerciseNames: names };
    const candidate = quiet(() => legalAddFamilies(addArgs)
      .flatMap((family) => family.groups.flatMap((group) => group.leaves.flatMap((leaf) =>
        legalAddCandidates({ ...addArgs, leaf: leaf.id })))))[0];
    check('CONTROL: the athlete-added session has a legal Add candidate', names.length > 0 && !!candidate, describe([target() as Day]));
    const added = candidate
      ? await quietAsync(() => executeProgramControlActionDurably({
          type: 'add_exercise',
          source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
          scope: 'today_only', payload: { date: editDate, exercise: candidate },
          requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
        } as never, { todayISO: weekStart })) as { ok?: boolean; message?: string }
      : null;
    let directError = 'none';
    if (added?.ok !== true && candidate) {
      try { quiet(() => require('../utils/coachActions').addExerciseAtDate({ date: editDate, exercise: candidate })); }
      catch (error) { directError = String((error as Error).message); }
    }
    check('R-359 (4): an exercise Add on the week past the hard-day maximum is not refused',
      added?.ok === true && (target()?.workout?.exercises ?? []).some((r) => r.exercise?.name === candidate?.name),
      JSON.stringify({ added, directError, week: describe(weekDays()) }));
    const breachAfter = judge(weekStart).findings.find((finding) => finding.code === 'hard_day_breach');
    check('R-359 (4): the week checker still carries the hard-day breach, as a warning',
      !!breachAfter && breachAfter.severity === 'advisory', JSON.stringify(breachAfter ?? null));
  }

  // ── (2) At the cap by the athlete's own days: the app opens no sixth day for speed ──
  {
    const archetype: Archetype = {
      id: 'four-day-one-far-club-night', gender: 'male', days: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      experience: '2-5 years', equipment: 'commercial', initialPhase: 'Pre-season',
      clubDays: ['Wednesday'], gameDay: 'Sunday', extraGame: false,
    };
    const { weekStart, refusal } = await walkTo(archetype, 'Pre-season', 3);
    check('CONTROL: the five-committed-day week rolled over', refusal === null, String(refusal));
    const days = quiet(() => deriveVisibleWeekLive(weekStart, weekStart)) as unknown as Day[];
    const committed = new Set([0, 1, 3, 4, 2]);
    const openedDays = days.filter((day, index) => !committed.has(index) && (day.workout?.exercises ?? []).length > 0
      && day.workout?.workoutType !== 'Mobility' && day.workout?.workoutType !== 'Recovery');
    check('R-359 (2): the app opens no hard session on a sixth day when five are already committed',
      openedDays.length === 0, describe(days));
    const judged2 = judge(weekStart);
    const breach = judged2.findings.find((finding) => finding.code === 'hard_day_breach');
    check('R-359 (2): the week checker counts no hard-day breach', !breach, JSON.stringify(breach));
  }

  // ── (3) The cohort's exact shape: club on Monday and Wednesday, gym Mon/Tue/Thu/Fri ──
  // Five committed days (Monday shared), and the app used to open Saturday for
  // speed — six — and refuse the week. Measured: three athletes blank, weeks 9-30.
  {
    const archetype: Archetype = {
      id: 'cohort-four-day-club-mon-wed', gender: 'female', days: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      experience: '2-5 years', equipment: 'commercial', initialPhase: 'Pre-season',
      clubDays: ['Monday', 'Wednesday'], gameDay: 'Saturday', extraGame: false,
    };
    const { weekStart, refusal } = await walkTo(archetype, 'Pre-season', 2);
    check('R-359 (3): the cohort\'s 4-day athlete is not refused at rollover', refusal === null, String(refusal));
    const days = quiet(() => deriveVisibleWeekLive(weekStart, weekStart)) as unknown as Day[];
    const withRows = days.filter((day) => (day.workout?.exercises ?? []).length > 0).length;
    check('R-359 (3): she sees a week, not a blank one', withRows >= 4, describe(days));
    const judged = judge(weekStart);
    check('R-359 (3): the published week carries its contract', judged.error === null && !!judged.rebased?.contract, judged.error ?? 'no contract');
    const breach = judged.findings.find((finding) => finding.code === 'hard_day_breach');
    check('R-359 (3): the app opened no sixth hard day for its own speed session', !breach, JSON.stringify(breach) + ' ' + describe(days));
    const wednesday = plusDays(weekStart, 2);
    setJourneyClock(wednesday);
    const report = await reportShoulder(wednesday);
    check('R-359 (3): her shoulder report is accepted', report.ok === true, String(report.message));
  }

  console.log(`\nHard days warn: ${passed} passed, ${failures.length} failed`);
  totalsPrinted(failures.length);
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).message}`);
  process.exit(1);
});
