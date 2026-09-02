/**
 * Two of the six-athlete cohort's findings, approved by Sam on 2026-09-03
 * ("approve 1 and 2"):
 *
 *  1. EVERY WEEK ANSWERS FOR ITS LOWER-BODY FRONTAL PLANE (R-327). The
 *     completion that already runs inside the injury compiler runs for every
 *     canonical week, so a Monday lost to G+1 after a Sunday game, or a
 *     deload cut, no longer leaves a healthy week with no side-to-side leg
 *     work and no written exception. The deload keep-order treats the
 *     frontal row as important, so the cut keeps the plane.
 *  2. A RECORDED LOAD BY NAME OUTRANKS ANY ESTIMATE. A row a re-derived week
 *     gains (bye recovery, G+1 coverage) and a row the injury block adds read
 *     the athlete's own last logged load before the onboarding estimate.
 *
 * Measured 2026-09-03 on the cohort: 3-day athlete weeks 30/36/48 (frontal),
 * 2-day week 15 deload (frontal), DB Shoulder Press 15 -> 9 after a bye
 * (load), Trap Bar Deadlift 50 -> 25 as an injury addition (load).
 *
 * Run: npm run test:plane-and-load-memory
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { ARCHETYPES, athleteAnswers, YEAR_START, yearTimeline, plusDays } from './compilerYear/catalog';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { applyPhaseShift } from '../utils/profileMutations';
import {
  coldStartThroughOnboarding, quiet, quietAsync, setJourneyClock, rolloverIfDue, followTheWeek, recordDay,
} from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { exerciseSuppliesLowerBodyFrontal } from '../rules/movementPlaneProgramming';
import { muscleMetadataFor } from '../data/muscleExperienceMetadata';
import { resolveExerciseName, estimateStartingWeight } from '../utils/loadEstimation';
import { applyStrengthDeloadToExercises, resolveDeloadWeekPolicy } from '../rules/deloadWeekRules';
import { resolveSeasonPhaseWeekKind } from '../rules/seasonPhaseClock';
import { resolveComposedLoad } from '../rules/composedDose';
import { chooseInjurySessionAdditions } from '../utils/injurySessionAdjustment';
import { resolveTapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { readBlockHistory } from '../rules/blockBoundaryProgression';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

type Row = { exercise?: { name?: string }; prescribedWeightKg?: number; section18Evidence?: { role?: string; slot?: string } };
type Day = {
  date: string; source?: string;
  workout?: { name: string; workoutType?: string; exercises: Row[]; weeklyMovementPlaneExceptions?: { kind: string }[] } | null;
};
type Archetype = { id: string; days: string[]; clubDays: string[]; gameDay: string | null };

const contributionOf = (name: string): 'prehab' | 'power' | 'strength' => {
  const pool = muscleMetadataFor(resolveExerciseName(name))?.pool;
  return pool === 'Lower prehab' ? 'prehab'
    : pool === 'Lower plyometric' || pool === 'Power' ? 'power'
    : 'strength';
};
const suppliesFrontal = (name: string): boolean =>
  exerciseSuppliesLowerBodyFrontal(resolveExerciseName(name), contributionOf(name));
const names = (day: Day | undefined): string[] => (day?.workout?.exercises ?? []).map((row) => row.exercise?.name ?? '').filter(Boolean);
const week = (weekStart: string): Day[] => quiet(() => deriveVisibleWeekLive(weekStart, weekStart)) as unknown as Day[];
const frontalVerdict = (days: Day[]) => {
  const supplied = days.flatMap(names).filter(suppliesFrontal);
  const exceptions = days.flatMap((day) => day.workout?.weeklyMovementPlaneExceptions ?? [])
    .filter((exception) => exception.kind === 'lower_body_frontal_unavailable');
  return { supplied, exceptions, honest: supplied.length > 0 || exceptions.length > 0 };
};
const describe = (days: Day[]) => days.map((day) => `${day.date.slice(5)} ${day.workout?.name ?? 'rest'}: ${names(day).join(', ')}`).join(' | ');

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

/** Walk the archetype's year to a phase week; `liveEveryDay` records every session with its loads typed. */
async function walkTo(archetypeId: string, phase: string, phaseWeek: number, liveEveryDay = false): Promise<{ weekStart: string; archetype: Archetype }> {
  resetStoresToFreshInstall(`plane-and-load-memory:${archetypeId}:${liveEveryDay ? 'live' : 'walk'}`);
  const archetype = (ARCHETYPES as unknown as Archetype[]).find((entry) => entry.id === archetypeId)!;
  const installed = await quietAsync(() => coldStartThroughOnboarding({
    profile: athleteAnswers(archetype as never), installDayISO: YEAR_START,
  }));
  check(`${archetypeId}: real onboarding accepted`, installed.onboardingRefusal === null, String(installed.onboardingRefusal));
  for (const entry of yearTimeline(archetype as never)) {
    setJourneyClock(entry.weekStart);
    if (entry.phaseWeek === 1 && entry.index > 0) await quietAsync(() => shiftPhase(archetype, entry.phase, entry.weekStart));
    const roll = quiet(() => rolloverIfDue(entry.weekStart)) as { refusal?: string | null };
    if (roll.refusal) throw new Error(`rollover refused at ${entry.weekStart}: ${roll.refusal}`);
    if (entry.phase === phase && entry.phaseWeek === phaseWeek) return { weekStart: entry.weekStart, archetype };
    if (liveEveryDay) await liveTheWeek(entry.weekStart);
    else quiet(() => followTheWeek(entry.weekStart));
  }
  throw new Error(`${archetypeId}: ${phase} week ${phaseWeek} not reached`);
}

async function liveTheWeek(weekStart: string): Promise<void> {
  for (let offset = 0; offset < 7; offset += 1) {
    const date = plusDays(weekStart, offset);
    setJourneyClock(date);
    await quietAsync(() => recordDay(date, {
      record: true, completion: 'full', feeling: 'good', soreness: 'none', difficulty: 6,
      logWeights: true, conditioningRpe: 6,
    }));
  }
  quiet(() => followTheWeek(weekStart));
}

async function fixture(id: string, action: 'move' | 'remove', weekStart: string, sourceDate: string, targetDate?: string) {
  return quietAsync(() => executeFixtureMutationTransaction({
    action, fixtureKind: 'game', sourceDate, targetDate,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab', commandId: `plane-load:${id}:${weekStart}:${action}` },
    todayISO: weekStart,
  } as never)) as Promise<{ outcome: string }>;
}

(async () => {
  // ── 1a. The deload keep-order, at the unit: the frontal row survives the cut ──
  {
    const row = (name: string, slot: string, sets: number, role = 'strength_accessory') => ({
      id: name, exerciseId: name, workoutId: 'w', exerciseOrder: 0, prescribedSets: sets,
      prescribedRepsMin: 8, prescribedRepsMax: 10, prescribedWeightKg: 20, exercise: { name },
      section18Evidence: { role, slot },
    });
    const rows = [
      row('Back Squat', 'squat', 3, 'main_strength'),
      row('Bench Press', 'horizontal_push', 3, 'main_strength'),
      row('Pull-Ups', 'vertical_pull', 3, 'main_strength'),
      row('SL 45° Back Extension', 'single_leg_hip', 3),
      row('Long-Lever Copenhagen', 'football_robustness', 2),
    ];
    const policy = resolveDeloadWeekPolicy('Pre-season', 'deload')!;
    check('CONTROL: the pre-season scheduled deload policy exists', !!policy);
    const kept = applyStrengthDeloadToExercises(rows as never, policy).map((exercise) => exercise.exercise?.name);
    check('CONTROL: the deload cut removed an accessory (two accessories -> one)',
      kept.filter((name) => name === 'SL 45° Back Extension' || name === 'Long-Lever Copenhagen').length === 1, kept.join(', '));
    check('1a: the deload cut keeps the frontal-plane row (the 2-day athlete\'s week-15 Copenhagen)',
      kept.includes('Long-Lever Copenhagen'), kept.join(', '));
  }

  // ── 2a. The composed base load, at the unit: recorded outranks estimate ──
  {
    const archetype = (ARCHETYPES as unknown as Archetype[]).find((entry) => entry.id === 'male-3-experienced-gym')!;
    const profile = athleteAnswers(archetype as never) as unknown as { availableEquipment?: string[] };
    const kit = [...(profile.availableEquipment ?? []), 'dumbbells', 'barbell', 'bench'];
    const common = {
      identity: 'DB Shoulder Press', isMainLift: false, poolSlot: 'vertical_push' as never,
      seasonPhase: 'In-season' as const, offseasonSubphase: null, profile: profile as never, kit,
    };
    const estimate = estimateStartingWeight('DB Shoulder Press', profile as never);
    const fresh = resolveComposedLoad(common);
    check('CONTROL: with no record the composed load is the onboarding estimate', estimate !== null && fresh === estimate, `${fresh} vs ${estimate}`);
    const remembered = resolveComposedLoad({ ...common, recordedLoads: { 'DB Shoulder Press': 15 } } as never);
    check('2a: with a recorded 15 kg the composed load is 15, not the estimate', remembered === 15, `${remembered}`);
  }

  // ── 2b. The injury block's added row, at the unit: recorded outranks estimate ──
  {
    resetStoresToFreshInstall('plane-and-load-memory:chooser');
    const archetype = (ARCHETYPES as unknown as Archetype[]).find((entry) => entry.id === 'female-3-novice-home')!;
    const profile = athleteAnswers(archetype as never);
    const date = '2026-09-14';
    const constraint = buildGuidedInjuryConstraint({
      region: 'lower_body', area: 'knee', severity: 7, severityBand: 'moderate',
      adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false,
    } as never, { todayISO: date });
    const environment = resolveTapSwapEnvironment({
      date, profile, activeConstraints: [constraint] as never,
      primaryInjury: { bucket: (constraint as { bucket?: string }).bucket ?? 'knee', severity: 7, triggers: ['running'], seriousSymptoms: false } as never,
    });
    const paused = ['Bodyweight Squat', 'Glute Bridge', 'Reverse Lunges', 'Single-Leg RDL', 'Groin Squeeze'];
    const common = {
      environment, profile, keptRowNames: [] as string[], pausedRowNames: paused,
      excludedByAthlete: [] as string[], pausedCount: paused.length, originalRowCount: paused.length,
      injuredHalf: 'lower' as const, keptSets: 0, dateISO: date, weekExerciseNames: [] as string[],
    };
    const fresh = chooseInjurySessionAdditions(common) as { name: string; weightKg: number | null }[];
    const loaded = fresh.filter((row) => typeof row.weightKg === 'number' && row.weightKg > 0);
    check('CONTROL: the block adds at least one loaded row from the estimate', loaded.length > 0, JSON.stringify(fresh));
    const recordedLoads = Object.fromEntries(loaded.map((row) => [row.name, 33]));
    const remembered = chooseInjurySessionAdditions({ ...common, recordedLoads } as never) as { name: string; weightKg: number | null }[];
    const carried = remembered.filter((row) => row.name in recordedLoads);
    check('2b: an added row carries the athlete\'s recorded load (33), not the estimate',
      carried.length > 0 && carried.every((row) => row.weightKg === 33), JSON.stringify(remembered));
  }

  // ── 1b. The week after a Sunday game: G+1 takes Monday, the plane is still answered ──
  {
    const { weekStart, archetype } = await walkTo('male-3-experienced-gym', 'In-season', 3);
    const moved = await fixture(archetype.id, 'move', weekStart, plusDays(weekStart, 5), plusDays(weekStart, 6));
    check('CONTROL: the Saturday game moved to Sunday', moved.outcome === 'accepted', JSON.stringify(moved));
    quiet(() => followTheWeek(weekStart));
    const next = plusDays(weekStart, 7);
    setJourneyClock(next);
    const roll = quiet(() => rolloverIfDue(next)) as { refusal?: string | null };
    check('CONTROL: the following week rolled over', !roll.refusal, String(roll.refusal));
    const days = week(next);
    const monday = days.find((day) => day.date === next);
    check('CONTROL: Monday after the Sunday game carries no main lift (G+1)',
      !(monday?.workout?.exercises ?? []).some((row) => row.section18Evidence?.role === 'main_strength'), describe(days));
    const verdict = frontalVerdict(days);
    check('1b: the week after a Sunday game has a lower-body frontal row or a written exception',
      verdict.honest, describe(days));
  }

  // ── 1c. A scheduled pre-season deload week keeps its frontal plane ──
  {
    const { weekStart } = await walkTo('male-3-experienced-gym', 'Pre-season', 4);
    check('CONTROL: pre-season week 4 is the phase clock\'s scheduled deload', resolveSeasonPhaseWeekKind('Pre-season', 4) === 'deload');
    const days = week(weekStart);
    const verdict = frontalVerdict(days);
    check('1c: the deload week has a lower-body frontal row or a written exception', verdict.honest, describe(days));
  }

  // ── 2c. The bye-recovery week: a re-derived row carries the athlete's record ──
  {
    const { weekStart, archetype } = await walkTo('male-3-experienced-gym', 'In-season', 3, true);
    const before = week(weekStart).flatMap(names);
    const bye = await fixture(archetype.id, 'remove', weekStart, plusDays(weekStart, 5));
    check('CONTROL: the game was removed (bye week)', bye.outcome === 'accepted', JSON.stringify(bye));
    const days = week(weekStart);
    const recorded = readBlockHistory({
      feedbackByDate: (useProgramStore.getState() as unknown as { sessionFeedback: Record<string, never> }).sessionFeedback ?? {},
      blockStartISO: '0000-01-01', blockEndISO: '9999-12-31', requiredStrengthSessions: 0,
    }).lastRecordedLoadByExercise;
    check('CONTROL: the athlete has recorded loads for lifts', Object.keys(recorded).length >= 5, Object.keys(recorded).join(', '));
    const rows = days.flatMap((day) => (day.workout?.exercises ?? []).map((row) => ({
      date: day.date, name: row.exercise?.name ?? '', kg: row.prescribedWeightKg ?? 0,
      role: row.section18Evidence?.role,
    })));
    const gained = rows.filter((row) => !before.includes(row.name) && row.kg > 0);
    check('CONTROL: the bye week re-derived at least one loaded row the week did not have', gained.length > 0, describe(days));
    const withRecord = rows.filter((row) => row.kg > 0 && typeof recorded[resolveExerciseName(row.name)] === 'number');
    const lighter = withRecord.filter((row) => row.kg < recorded[resolveExerciseName(row.name)]!);
    check('2c: no row in the bye week is lighter than the athlete\'s own last logged load for that lift',
      withRecord.length > 0 && lighter.length === 0,
      lighter.map((row) => `${row.name} ${row.kg} < ${recorded[resolveExerciseName(row.name)]}`).join(', ') || describe(days));
  }

  console.log(`\nWeekly plane + load memory: ${passed} passed, ${failures.length} failed`);
  totalsPrinted(failures.length);
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).message}`);
  process.exit(1);
});
