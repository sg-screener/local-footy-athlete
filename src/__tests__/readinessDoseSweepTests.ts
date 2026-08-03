/**
 * THE READINESS DOSE SWEEP — the behaviour behind the census reaching zero.
 *
 * The census (`data/readinessStructureCensus.ts`) counts EDGES. Counting is what
 * makes a new violation impossible to add unnoticed, but it cannot tell the
 * difference between an edge that was deleted and an edge that was moved one
 * line down. This file states the BEHAVIOUR the last 27 edges were paying for,
 * in both directions:
 *
 *   - every structure edge is gone: no count, floor, mode or Bible-floored
 *     exposure moves when capacity drops;
 *   - every dose edge survives: the same drop still shrinks the work, sends it
 *     off-feet, and backs its intensity off.
 *
 * The second half is the one that earns its keep. "Delete every readiness edge"
 * would pass a census at zero and quietly delete a legitimate dose-down with it
 * — which is exactly the trap the census's own `offseasonSubphasePolicy` entry
 * warned about ("removing the branch wholesale would delete a legitimate
 * dose-down along with the violation").
 *
 * Document: docs/READINESS_CENSUS_SWEEP_2026-07-29.md
 * Run: npm run test:readiness-dose-sweep
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import type {
  ConditioningLevel,
  RecentTrainingLoad,
  SeasonPhase,
  WeekKind,
  Workout,
  WorkoutExercise,
} from '../types/domain';
import type { OffseasonSubphase } from '../rules/offseasonSubphase';
import type { PreseasonSubphase } from '../rules/preseasonSubphase';
import { buildCoachingPlan, type CoachingInputs, type CoachingPlan } from '../utils/coachingEngine';
import { decidePowerPrimer } from '../rules/powerPrimerPolicy';
import { DELOAD_LAW, deloadPowerDose } from '../rules/deloadWeekRules';
import { getOffseasonSubphasePolicy } from '../rules/offseasonSubphasePolicy';
import { getPreseasonSubphasePolicy } from '../rules/preseasonSubphasePolicy';
import { evaluateSprintExposureGate } from '../rules/sprintExposureGate';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import { powerRows } from '../rules/sessionRowCounting';
import { getWeeklyCaps, type WeekLog } from '../utils/conditioningRules';
import {
  buildInSeasonExposureContract,
  type WeeklyExposureContractInput,
} from '../rules/weeklyExposureContractBuilders';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}`);
  if (detail !== undefined) console.error(`       ${JSON.stringify(detail)}`);
}

/* ── Engine inputs ───────────────────────────────────────────────────────── */

/** Capacity answers that land on each band: <=2 low, <=4 medium, else high. */
const CAPACITY: Record<'low' | 'medium' | 'high', {
  recentTrainingLoad: RecentTrainingLoad;
  conditioningLevel: ConditioningLevel;
}> = {
  low: { recentTrainingLoad: 'Hardly at all', conditioningLevel: 'Poor' },
  medium: { recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average' },
  high: { recentTrainingLoad: 'Very consistent', conditioningLevel: 'Elite' },
};

interface Combination {
  seasonPhase: SeasonPhase;
  offseasonSubphase?: OffseasonSubphase;
  preseasonSubphase?: PreseasonSubphase;
  capacity: 'low' | 'medium' | 'high';
  teamDayCount: number;
  availableDays: number;
  hasGame: boolean;
  weekKind?: WeekKind;
}

function inputsFor(c: Combination): CoachingInputs {
  const teamTrainingDays = ['Tuesday', 'Thursday', 'Wednesday'].slice(0, c.teamDayCount);
  const ordered = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const selected = new Set<string>(teamTrainingDays);
  if (c.hasGame) selected.add('Saturday');
  for (const day of ordered) {
    if (selected.size >= c.availableDays) break;
    selected.add(day);
  }
  const selectedDays = ordered.filter((d) => selected.has(d));
  return {
    seasonPhase: c.seasonPhase,
    availableDays: selectedDays.length,
    selectedDays,
    teamTrainingDaysPerWeek: teamTrainingDays.length,
    teamTrainingDays,
    sprintExposure: '2+ times per week',
    conditioningLevel: CAPACITY[c.capacity].conditioningLevel,
    recentTrainingLoad: CAPACITY[c.capacity].recentTrainingLoad,
    experienceLevel: '2-5 years',
    injuries: [],
    goals: [],
    hasGame: c.hasGame,
    gameDay: c.hasGame ? 'Saturday' : undefined,
    weekKind: c.weekKind,
    offseasonSubphase: c.offseasonSubphase,
    preseasonSubphase: c.preseasonSubphase,
  };
}

function label(c: Combination): string {
  const sub = c.offseasonSubphase ?? c.preseasonSubphase ?? '-';
  return `${c.seasonPhase}/${sub}/team=${c.teamDayCount}/days=${c.availableDays}`
    + `/${c.hasGame ? 'game' : 'nogame'}${c.weekKind === 'deload' ? '/deload' : ''}`;
}

/** Every week shape, without the capacity axis — capacity is the comparison. */
function weekShapes(): Array<Omit<Combination, 'capacity'>> {
  const out: Array<Omit<Combination, 'capacity'>> = [];
  const phases: Array<Pick<Combination, 'seasonPhase' | 'offseasonSubphase' | 'preseasonSubphase'>> = [
    { seasonPhase: 'In-season' },
    { seasonPhase: 'Off-season', offseasonSubphase: 'early_offseason' },
    { seasonPhase: 'Off-season', offseasonSubphase: 'mid_offseason' },
    { seasonPhase: 'Off-season', offseasonSubphase: 'late_offseason' },
    { seasonPhase: 'Pre-season', preseasonSubphase: 'early_preseason' },
    { seasonPhase: 'Pre-season', preseasonSubphase: 'mid_preseason' },
    { seasonPhase: 'Pre-season', preseasonSubphase: 'late_preseason' },
  ];
  for (const phase of phases) {
    for (const teamDayCount of [0, 1, 2, 3]) {
      for (const availableDays of [3, 4, 5, 6]) {
        for (const hasGame of [false, true]) {
          if (phase.seasonPhase === 'Off-season' && (hasGame || teamDayCount > 0)) continue;
          if (teamDayCount > availableDays) continue;
          out.push({ ...phase, teamDayCount, availableDays, hasGame });
        }
      }
    }
  }
  return out;
}

/** The week's structure, as the athlete sees it: counts and named exposures. */
function structureOf(plan: CoachingPlan): Record<string, number | string> {
  const conditioning = plan.weeklyPlan.filter((allocation) =>
    allocation.conditioningCategory !== undefined || allocation.hasCombinedConditioning);
  return {
    coreSessions: plan.coreSessions,
    optionalSessions: plan.optionalSessions,
    recoverySessions: plan.recoverySessions,
    // WHAT THE APP PRESCRIBES, not how many days it materialised.
    //
    // This was `plan.weeklyPlan.length`, and it was a structural fact only
    // because the generator filled EVERY available day — it put a recovery
    // session on anything it had nothing else for, so the raw length was
    // essentially "available days" and moved with nothing. Sam's charter
    // (2026-07-30) deleted those placements, so the raw length now measures
    // whether the app chose to leave a day free, which is a residue and not a
    // structure.
    //
    // The law it serves — capacity never changes the shape of the week — is
    // unchanged and still asserted over every other key here: the core, optional
    // and recovery BUDGETS, the strength, conditioning and sprint counts, and
    // all four contract targets. Those are what "shape" means, and they must
    // stay byte-identical across capacity. This key now counts allocations
    // carrying actual prescribed work, which is the thing the raw length was
    // standing in for.
    prescribedSessions: plan.weeklyPlan.filter((a) =>
      a.strengthPattern !== undefined || a.conditioningCategory !== undefined ||
      a.hasCombinedConditioning === true || a.speedWorkKind !== undefined).length,
    strengthSessions: plan.weeklyPlan.filter((a) => a.strengthPattern !== undefined).length,
    conditioningSessions: conditioning.length,
    sprintSessions: plan.weeklyPlan.filter((a) =>
      a.conditioningCategory === 'sprint' || a.speedWorkKind !== undefined).length,
    contractMode: plan.weeklyExposureContract?.identity.mode ?? 'none',
    contractStrengthTarget: plan.weeklyExposureContract?.strength.targetCount ?? -1,
    contractConditioningTarget: plan.weeklyExposureContract?.conditioning.targetCount ?? -1,
    contractSprintTarget: plan.weeklyExposureContract?.sprintCod.targetCount ?? -1,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   [1] Power: low capacity shrinks the primer, it never removes it
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[1] Power survives low capacity as a shrunk sharp primer');
{
  const base = {
    phase: 'Pre-season' as const,
    strengthPattern: 'lower' as const,
    hasGame: false,
    gOffset: -99,
    isTeamDay: false,
    isBeginner: false,
    experienced: true,
    injuries: [],
    powerGoalNudge: false,
  };

  const medium = decidePowerPrimer({ ...base, readiness: 'medium' });
  const low = decidePowerPrimer({ ...base, readiness: 'low' });

  ok('low capacity still returns a power spec', low !== null, low);
  ok('the medium-capacity spec is the reference dose', medium !== null, medium);
  if (low && medium) {
    const shrunk = deloadPowerDose(medium)!;
    ok('the low-capacity dose is the deload power dose of the medium one',
      low.sets === shrunk.sets && low.repsMin === shrunk.repsMin && low.repsMax === shrunk.repsMax,
      { low, shrunk });
    ok('the shrunk primer is smaller than the reference', low.sets < medium.sets, { low, medium });
    ok('the reps stay sharp', low.repsMin === medium.repsMin && low.repsMax === medium.repsMax);
    ok('the reason says the capacity shrunk it, not that a gate fired',
      /capacity|readiness/i.test(low.reason) && !/blocked|removed/i.test(low.reason), low.reason);
  }

  // G-2: the WINDOW is a schedule fact and keeps its tiny dose. The readiness
  // half of that gate was a block and shrinks instead.
  const gTwo = { ...base, phase: 'In-season' as const, hasGame: true, gOffset: -2 };
  const gTwoHigh = decidePowerPrimer({ ...gTwo, readiness: 'high' });
  const gTwoMedium = decidePowerPrimer({ ...gTwo, readiness: 'medium' });
  ok('G-2 keeps its tiny neural primer at high capacity', gTwoHigh?.kind === 'primer', gTwoHigh);
  ok('G-2 below high capacity keeps a primer rather than nothing',
    gTwoMedium !== null, gTwoMedium);
  if (gTwoHigh && gTwoMedium) {
    ok('the G-2 primer below high capacity is the shrunk dose',
      gTwoMedium.sets === deloadPowerDose(gTwoHigh)!.sets, { gTwoHigh, gTwoMedium });
  }

  // The dose edge that survives untouched: contrast is the bigger option.
  const offseason = {
    ...base,
    phase: 'Off-season' as const,
    offseasonSubphase: 'late_offseason' as const,
  };
  ok('contrast still needs high capacity',
    decidePowerPrimer({ ...offseason, readiness: 'high' })?.kind === 'contrast' &&
    decidePowerPrimer({ ...offseason, readiness: 'medium' })?.kind === 'primer');

  // Schedule and phase gates are untouched by the ruling.
  ok('game day still removes power',
    decidePowerPrimer({ ...base, phase: 'In-season', hasGame: true, gOffset: 0, readiness: 'high' }) === null);
  ok('early off-season still removes power',
    decidePowerPrimer({ ...base, phase: 'Off-season', offseasonSubphase: 'early_offseason', readiness: 'high' }) === null);
  ok('a moderate same-region injury still removes power',
    decidePowerPrimer({ ...base, readiness: 'high', injuries: [{ area: 'knee', severity: 6 }] }) === null);
}

/* ══════════════════════════════════════════════════════════════════════════
   [2] The finaliser holds the same law for persisted mutations
   ══════════════════════════════════════════════════════════════════════════ */

/*
 * ONE DOSE OWNER. The finaliser does not shrink the power row for capacity; it
 * stops REMOVING it. The dose is decided once, by `decidePowerPrimer`, and the
 * finaliser cannot tell an already-shrunk row from a full one — so a shrink here
 * would compound on every re-canonicalisation. This is the deload precedent
 * exactly: the deload dose is applied where the block is built, and the
 * finaliser holds only the phase/schedule prohibitions.
 */
console.log('\n[2] Canonicalisation no longer removes power for capacity');
{
  function row(name: string, index: number, overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      id: `row-${slug}-${index}`,
      workoutId: 'workout',
      exerciseId: `ex-${slug}`,
      exerciseOrder: index + 1,
      prescribedSets: 3,
      prescribedRepsMin: 6,
      prescribedRepsMax: 8,
      prescribedWeightKg: 100,
      restSeconds: 90,
      exercise: {
        id: `ex-${slug}`,
        name,
        description: name,
        exerciseType: 'Compound',
        muscleGroups: [],
        equipmentRequired: [],
        difficultyLevel: 'Intermediate',
        createdAt: '',
        updatedAt: '',
      },
      createdAt: '',
      updatedAt: '',
      ...overrides,
    };
  }

  function powerRow(): WorkoutExercise {
    return {
      ...row('Broad Jump', -1),
      id: 'power-row',
      exerciseOrder: 0,
      prescribedSets: 3,
      prescribedRepsMin: 3,
      prescribedRepsMax: 3,
      prescribedWeightKg: undefined,
      notes: 'Do this fresh, early in the session — before the main lifts.',
      role: 'power',
      power: { family: 'lower', kind: 'primer' },
      section18Evidence: {
        protocolVersion: 1,
        role: 'power',
        strengthPattern: null,
        mainStrengthPattern: null,
        provenance: 'canonical_row_classifier',
      },
    };
  }

  function workout(rows: WorkoutExercise[]): Workout {
    return {
      id: 'workout',
      microcycleId: 'mc',
      dayOfWeek: 1,
      name: 'Lower Squat',
      description: '',
      durationMinutes: 60,
      intensity: 'Moderate',
      workoutType: 'Strength',
      sessionTier: 'core',
      exercises: rows,
      createdAt: '',
      updatedAt: '',
    };
  }

  const source = () => workout([powerRow(), row('Back Squat', 0, {
    prescribedRepsMin: 3, prescribedRepsMax: 5,
  })]);

  const lateOffseason = {
    phase: 'Off-season' as const,
    offseasonSubphase: 'late_offseason' as const,
    weekKind: 'build' as const,
  };

  const canonicalSource = fs
    .readFileSync(path.resolve(__dirname, '../utils/workoutCanonicalisation.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n');
  ok('the finaliser has no readiness input left',
    !/context\.readiness/.test(canonicalSource),
    'a readiness field on the canonical context is what the removal grows back on');
  ok('the finaliser has no low-readiness removal reason left',
    !/low_readiness_power_blocked/.test(canonicalSource));

  const low = finaliseWorkoutAfterMutation(source(), lateOffseason);
  ok('the power row survives a low-capacity week', powerRows(low.workout).length === 1);
  ok('no power_removed action is emitted for capacity',
    !low.actions.some((action) => action.kind === 'power_removed'), low.actions);

  const gTwo = finaliseWorkoutAfterMutation(source(), {
    phase: 'In-season', offseasonSubphase: 'not_off_season', weekKind: 'build',
    hasGame: true, gOffset: -2,
    profile: { experienceLevel: '2-5 years' } as never,
  });
  ok('G-2 keeps the power row for an experienced athlete at any capacity',
    powerRows(gTwo.workout).length === 1, gTwo.actions);

  // Untouched: the phase and schedule triggers of the same removal.
  const early = finaliseWorkoutAfterMutation(source(), {
    phase: 'Off-season', offseasonSubphase: 'early_offseason', weekKind: 'build',
  });
  ok('early off-season still removes power',
    early.actions.some((a) => a.kind === 'power_removed' && a.reason === 'early_offseason_power_blocked'));
  const gameDay = finaliseWorkoutAfterMutation(source(), {
    phase: 'In-season', offseasonSubphase: 'not_off_season', weekKind: 'build',
    hasGame: true, gOffset: 0,
  });
  ok('game day still removes power',
    gameDay.actions.some((a) => a.kind === 'power_removed' && /game_proximity/.test(a.reason)));
}

/* ══════════════════════════════════════════════════════════════════════════
   [3] Sprint: a Bible-floored exposure readiness may not deny
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[3] Nothing denies a sprint exposure for readiness');
{
  // Comments are stripped: this unit DELETES the inputs and leaves prose saying
  // what they were and why they went. A gate that matched the prose would fail
  // on its own documentation and teach the next person to delete the record.
  const codeOf = (relative: string): string => fs
    .readFileSync(path.resolve(__dirname, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n');

  const gateSource = codeOf('../rules/sprintExposureGate.ts');
  ok('the sprint gate has no readiness input left',
    !/readinessAllowsSprint/.test(gateSource),
    'readinessAllowsSprint is the field a readiness block grows back on');
  ok('the sprint gate has no readiness_denied verdict left',
    !/readiness_denied/.test(gateSource));

  const engineSource = codeOf('../utils/coachingEngine.ts');
  ok('the engine has no sprint_readiness refusal left',
    !/sprint_readiness/.test(engineSource));

  for (const subphase of ['early_preseason', 'mid_preseason', 'late_preseason'] as const) {
    const base = getPreseasonSubphasePolicy(subphase, { teamTrainingExposures: 0 });
    const low = getPreseasonSubphasePolicy(subphase, { readiness: 'low', teamTrainingExposures: 0 });
    ok(`${subphase}: low capacity does not move the sprint target`,
      low.speedSprint.targetExposures === base.speedSprint.targetExposures,
      { base: base.speedSprint.targetExposures, low: low.speedSprint.targetExposures });
  }

  const decision = evaluateSprintExposureGate({
    phase: 'Pre-season',
    preseasonSubphase: 'mid_preseason',
    teamTrainingDays: [],
    gameOrPracticeMatchDays: [],
    plannedOnFeetSprintExposures: 0,
    injuryAllowsSprint: true,
  });
  ok('a week with no sprint exposure yet still allows the standalone top-up',
    decision.allowStandaloneSprint, decision);
}

/* ══════════════════════════════════════════════════════════════════════════
   [4] The subphase policies: dose only
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[4] Low capacity moves the dose fields and nothing else');
{
  for (const subphase of ['early_offseason', 'mid_offseason', 'late_offseason'] as const) {
    const base = getOffseasonSubphasePolicy(subphase, {});
    const low = getOffseasonSubphasePolicy(subphase, { readiness: 'low' });

    ok(`${subphase}: the hard-session cap is unmoved`,
      low.conditioning.hardSessionCap === base.conditioning.hardSessionCap,
      { base: base.conditioning.hardSessionCap, low: low.conditioning.hardSessionCap });
    ok(`${subphase}: running permission is unmoved`,
      low.running.allowedBySubphase === base.running.allowedBySubphase);
    ok(`${subphase}: sprint permission is unmoved`,
      low.speedSprint.allowedBySubphase === base.speedSprint.allowedBySubphase);
    ok(`${subphase}: the core-session bias is unmoved`,
      low.sessions.coreBias === base.sessions.coreBias,
      { base: base.sessions.coreBias, low: low.sessions.coreBias });
    ok(`${subphase}: combined-day policy is unmoved`,
      low.sessions.lowAvailabilityCombinedDays === base.sessions.lowAvailabilityCombinedDays);
    ok(`${subphase}: no policy string claims readiness blocked anything`,
      ![low.running.policy, low.speedSprint.policy].some((p) => /blocked_low_readiness/.test(p)),
      [low.running.policy, low.speedSprint.policy]);

    // The dose-down the census said must be preserved.
    ok(`${subphase}: the RPE ceiling still drops`,
      low.strength.targetRpeMax === Math.min(base.strength.targetRpeMax, 7));
    ok(`${subphase}: the modality still biases off-feet`,
      low.conditioning.modalityBias === 'off_feet');
    ok(`${subphase}: conditioning still defaults to easy aerobic`,
      low.conditioning.defaultCategory === 'aerobic_base');
    ok(`${subphase}: optional support work still widens`,
      low.sessions.optionalSupportBias === 'high');
  }

  for (const subphase of ['early_preseason', 'mid_preseason', 'late_preseason'] as const) {
    const context = { teamTrainingExposures: 2, hasPracticeMatch: false };
    const base = getPreseasonSubphasePolicy(subphase, context);
    const low = getPreseasonSubphasePolicy(subphase, { ...context, readiness: 'low' });

    ok(`${subphase}: the strength core cap is unmoved`,
      low.strength.coreSessionCap === base.strength.coreSessionCap,
      { base: base.strength.coreSessionCap, low: low.strength.coreSessionCap });
    ok(`${subphase}: the conditioning target cap is unmoved`,
      low.conditioning.targetCap === base.conditioning.targetCap);
    ok(`${subphase}: the app conditioning floor is unmoved`,
      low.conditioning.minimumAppExposures === base.conditioning.minimumAppExposures,
      { base: base.conditioning.minimumAppExposures, low: low.conditioning.minimumAppExposures });
    ok(`${subphase}: the hard-session cap is unmoved`,
      low.conditioning.hardSessionCap === base.conditioning.hardSessionCap);
    ok(`${subphase}: combined-day policy is unmoved`,
      low.sessions.combinedStrengthConditioning === base.sessions.combinedStrengthConditioning);

    // The dose-downs the census said must be preserved.
    ok(`${subphase}: the hard dose still reduces`, low.conditioning.hardDose === 'reduced');
    ok(`${subphase}: the strength volume bias still controls`,
      low.strength.volumeBias === 'controlled');
    ok(`${subphase}: conditioning still prioritises easy aerobic`,
      low.conditioning.categoryPriority.length === 1 &&
      low.conditioning.categoryPriority[0] === 'aerobic_base');
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   [5] The bye week's mode belongs to the schedule
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[5] Bye recovery is schedule-triggered, and only the mode decides the caps');
{
  const byeInput: WeeklyExposureContractInput = {
    seasonPhase: 'In-season',
    readiness: 'high',
    selectedDayNumbers: [1, 2, 3, 4, 6],
    teamTrainingDayNumbers: [2, 4],
    gameDay: null,
    hasGame: false,
    weekKind: 'build',
  };
  const build = buildInSeasonExposureContract(byeInput);
  const lowReadiness = buildInSeasonExposureContract({ ...byeInput, readiness: 'low' });
  const injured = buildInSeasonExposureContract({
    ...byeInput,
    activeInjuries: [{ region: 'lower_body', pauseAffectedTraining: true }],
  });
  const deload = buildInSeasonExposureContract({ ...byeInput, weekKind: 'deload' });
  const declared = buildInSeasonExposureContract({ ...byeInput, byeMode: 'recovery' });

  // SAM'S BYE-MODE RULING (2026-07-29). A bye is detected from the fixture gap;
  // build-vs-recovery is the ATHLETE'S choice, carried as a typed schedule-class
  // fact, and that fact is the ONLY producer of `in_season_bye_recovery`. An
  // unanswered bye is a build bye. Facts may inform the ask's COPY; none of them
  // may answer it. So every one of these — capacity, injury, and the scheduled
  // deload that the superseded ruling 4 named — must leave the mode alone.
  ok('a bye week defaults to the build mode', build.identity.mode === 'in_season_bye_build');
  ok('low capacity does not switch the bye into recovery',
    lowReadiness.identity.mode === 'in_season_bye_build', lowReadiness.identity.mode);
  ok('an injury does not switch the bye into recovery',
    injured.identity.mode === 'in_season_bye_build', injured.identity.mode);
  ok('a scheduled deload does not switch the bye into recovery either',
    deload.identity.mode === 'in_season_bye_build', deload.identity.mode);
  ok('the athlete\'s answer is the only thing that selects recovery',
    declared.identity.mode === 'in_season_bye_recovery');
  ok('the athlete can also answer build explicitly',
    buildInSeasonExposureContract({ ...byeInput, byeMode: 'build', weekKind: 'deload' })
      .identity.mode === 'in_season_bye_build');
  ok('low capacity does not cut the bye week\'s strength target',
    lowReadiness.strength.targetCount === build.strength.targetCount,
    { build: build.strength.targetCount, low: lowReadiness.strength.targetCount });

  const weekLog = (overrides: Partial<WeekLog>): WeekLog => ({
    sessions: [],
    strengthSessions: [],
    teamTrainingSessions: 2,
    byeWeek: true,
    missedTeamTraining: false,
    doubleGameWeek: false,
    weeksOffTraining: 0,
    readiness: 'high',
    byeMode: 'build',
    ...overrides,
  });

  const lowOnBuildBye = getWeeklyCaps('In-season', weekLog({ readiness: 'low' }));
  const highOnBuildBye = getWeeklyCaps('In-season', weekLog({}));
  const recoveryBye = getWeeklyCaps('In-season', weekLog({ byeMode: 'recovery' }));

  ok('a build bye keeps its tier-A unlock at low capacity',
    lowOnBuildBye.maxTierA === highOnBuildBye.maxTierA &&
    lowOnBuildBye.maxTierB === highOnBuildBye.maxTierB,
    { lowOnBuildBye, highOnBuildBye });
  ok('a recovery bye is the one that restricts the tiers',
    recoveryBye.maxTierA === 0 && recoveryBye.bLowOnly, recoveryBye);

  // Injury is unrepresentable here now: the caps take no injury input at all.
  // It removes the work it affects by name, one layer down.
  const conditioningSource = fs.readFileSync(
    path.resolve(__dirname, '../utils/conditioningRules.ts'), 'utf8');
  ok('the weekly caps take neither an injury nor a freshness input',
    /function getWeeklyCaps\(\s*phase: SeasonPhase,\s*weekLog: WeekLog,\s*\)/.test(conditioningSource) &&
    !/function inferFresh/.test(conditioningSource),
    'getWeeklyCaps must read phase and schedule facts only');
}

/* ══════════════════════════════════════════════════════════════════════════
   [6] The engine: capacity never changes the shape of the week
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[6] The same week at low capacity has the same structure');
{
  const differences: string[] = [];
  for (const shape of weekShapes()) {
    const reference = structureOf(buildCoachingPlan(inputsFor({ ...shape, capacity: 'medium' })));
    for (const capacity of ['low', 'high'] as const) {
      const actual = structureOf(buildCoachingPlan(inputsFor({ ...shape, capacity })));
      for (const key of Object.keys(reference)) {
        if (reference[key] !== actual[key]) {
          differences.push(`${label(shape as Combination)} @${capacity}: ${key} ${reference[key]} -> ${actual[key]}`);
        }
      }
    }
  }
  /**
   * THE LAW, AS SAM RESTATED IT (2026-07-30, with the repair-capacity ruling):
   *
   *   "Capacity changes dose, and in the rare fallback it may change
   *    attached-vs-standalone PACKAGING of the SAME work — it never changes the
   *    required work itself."
   *
   * That restatement resolves the two differences this block used to carry as
   * PINNED DEFECTS. They were `prescribedSessions 3 -> 4 @low` in two
   * mid-pre-season game-week shapes, and the note beside them described the
   * mechanism exactly: "the tempo conditioning rides on a strength day at medium
   * capacity and takes its own day at low. Same strength count, same conditioning
   * count, different week." Under the restatement that is PACKAGING, and packaging
   * is permitted — the missing conditioning attaches when the contract allows
   * combining at that capacity and takes a free day when it does not.
   *
   * SO THE ASSERTION IS SPLIT RATHER THAN RELAXED, and it is now stricter in the
   * half that matters. Every WORK key — the core/optional/recovery budgets, the
   * strength, conditioning and sprint counts, and all four contract targets — must
   * be byte-identical across capacity, with NO permitted exceptions and no pinned
   * list to hide in. `prescribedSessions` alone may differ, and only when every
   * work key is identical: a session-count change accompanied by any work change is
   * still a violation, because then it is not packaging.
   *
   * What is deliberately NOT here any more is the exception list. An allow-list of
   * two shapes could only ever grow, and it made the law un-checkable for those two
   * shapes in every domain at once — including the ones the packaging rule does not
   * excuse.
   */
  const PACKAGING_KEY = 'prescribedSessions';
  const workDifferences = differences.filter((entry) => !entry.includes(` ${PACKAGING_KEY} `));
  ok(`no week's required WORK changes with capacity (${weekShapes().length} shapes)`,
    workDifferences.length === 0, workDifferences.slice(0, 25));

  // The packaging differences that remain are reported, not asserted away: a
  // reviewer should see how often the fallback fires, because Sam's expectation is
  // on record that it should be rare ("you should be able to find room"), and a
  // week that regularly reaches it is evidence of an allocator bug.
  const packagingDifferences = differences.filter((entry) => entry.includes(` ${PACKAGING_KEY} `));
  console.log(`      packaging-only differences (permitted, ${packagingDifferences.length}):`);
  for (const entry of packagingDifferences.slice(0, 10)) console.log(`        ${entry}`);
;
}

/* ══════════════════════════════════════════════════════════════════════════
   [7] The dose consumers the sweep must NOT have deleted
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[7] Low capacity still shrinks the work it is allowed to shrink');
{
  const shape: Omit<Combination, 'capacity'> = {
    seasonPhase: 'Off-season',
    offseasonSubphase: 'late_offseason',
    teamDayCount: 0,
    availableDays: 5,
    hasGame: false,
  };
  const low = buildCoachingPlan(inputsFor({ ...shape, capacity: 'low' }));
  const high = buildCoachingPlan(inputsFor({ ...shape, capacity: 'high' }));

  ok('low capacity resolves to the low readiness band', low.readiness === 'low', low.readiness);
  ok('high capacity resolves to the high readiness band', high.readiness === 'high', high.readiness);
  ok('low capacity still moderates the conditioning dose',
    low.constraints.conditioningLoading === 'moderate' &&
    high.constraints.conditioningLoading === 'full',
    { low: low.constraints.conditioningLoading, high: high.constraints.conditioningLoading });
  ok('low capacity still asks for a ramp-up',
    low.constraints.rampUp === true && high.constraints.rampUp === false);
  ok('low capacity still sends aerobic conditioning off-feet',
    low.weeklyPlan.filter((a) => a.conditioningCategory === 'aerobic_base')
      .every((a) => a.conditioningOffFeet === true),
    low.weeklyPlan.filter((a) => a.conditioningCategory === 'aerobic_base'));
  ok('low capacity no longer refuses to add speed',
    low.constraints.sprintLoading !== 'do-not-add' || high.constraints.sprintLoading === 'do-not-add',
    { low: low.constraints.sprintLoading, high: high.constraints.sprintLoading });
}

/* ══════════════════════════════════════════════════════════════════════════
   [8] The deload law still owns the deload dose
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[8] The shrink used for low capacity is the authored one');
{
  ok('the deload law still keeps power', DELOAD_LAW.keepPower === true);
  ok('the power shrink has an authored floor', DELOAD_LAW.minPowerSets >= 1);
  const shrunk = deloadPowerDose({ sets: 3, repsMin: 3, repsMax: 5 });
  ok('the authored shrink halves the sets and keeps the reps',
    shrunk !== null && shrunk.sets === 2 && shrunk.repsMin === 3 && shrunk.repsMax === 5, shrunk);
}

const total = passed + failures.length;
console.log(`\nReadiness dose sweep: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
