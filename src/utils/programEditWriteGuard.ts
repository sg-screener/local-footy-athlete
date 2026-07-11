import type { Workout } from '../types/domain';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import type { ValidateProgramWeekInput, ValidatorDayInput } from '../rules/weekStructureValidator';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { getMondayForDate, type ResolvedDay } from './sessionResolver';
import { buildProgramTabProjectedWeek } from './visibleProgramReadModel';
import {
  assessProgramEditRisk,
  compareProgramEditRiskFindings,
  type ProgramEditRiskAssessment,
  type ProgramEditRiskFinding,
  type ProgramEditRiskLevel,
} from './programEditRiskAssessment';
import {
  compareProgrammingRiskLevels,
  getProgrammingEditDecision,
} from '../rules/conflictResolutionHierarchy';
import { validateLiveWorkoutWrite } from './postGenerationConstraintValidation';

export interface ProgramEditWrite {
  date: string;
  workout: Workout | null;
}

export interface ProgramEditWriteGuardInput {
  writes: readonly ProgramEditWrite[];
  todayISO: string;
  visibleWeek?: readonly ResolvedDay[];
  profile?: ValidateProgramWeekInput['profile'];
  activeConstraints?: readonly ActiveConstraint[];
  allowProtectedAnchorChanges?: boolean;
}

export type ProgramEditWriteGuardResult =
  | {
      ok: true;
      assessment: ProgramEditRiskAssessment | null;
    }
  | {
      ok: false;
      assessment: ProgramEditRiskAssessment;
      message: string;
    };

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function validatorDaysFromWeek(week: readonly ResolvedDay[]): ValidatorDayInput[] {
  return week.map((day) => ({
    date: day.date,
    workouts: day.workout ? [day.workout] : [],
  }));
}

function workoutLooksLikeGame(workout: Workout | null | undefined): boolean {
  if (!workout) return false;
  if (workout.workoutType === 'Game' || (workout as { sessionTier?: unknown }).sessionTier === 'game') {
    return true;
  }
  return classifyVisibleSession(workout).anchors.game;
}

function gameDatesFromWeek(week: readonly ResolvedDay[]): string[] {
  return week
    .filter((day) => workoutLooksLikeGame(day.workout))
    .map((day) => day.date)
    .sort();
}

function teamTrainingDatesFromWeek(week: readonly ResolvedDay[]): string[] {
  return week
    .filter((day) =>
      day.workout
        ? classifyVisibleSession(day.workout).anchors.teamTraining
        : false,
    )
    .map((day) => day.date)
    .sort();
}

function buildVisibleWeekFromStores(weekStartISO: string, todayISO: string): ResolvedDay[] {
  try {
    const programStore = useProgramStore.getState();
    return buildProgramTabProjectedWeek({
      mondayISO: weekStartISO,
      todayISO,
      state: buildScheduleStateImperative(),
      overrideContexts: programStore.overrideContexts ?? {},
    });
  } catch {
    return [];
  }
}

function visibleWeekForStart(args: {
  visibleWeek?: readonly ResolvedDay[];
  weekStartISO: string;
  todayISO: string;
}): ResolvedDay[] {
  const supplied = (args.visibleWeek ?? []).filter((day) =>
    getMondayForDate(day.date) === args.weekStartISO);
  if (supplied.length > 0) return supplied.map((day) => ({ ...day }));
  return buildVisibleWeekFromStores(args.weekStartISO, args.todayISO);
}

function withWrites(
  week: readonly ResolvedDay[],
  writes: readonly ProgramEditWrite[],
): ResolvedDay[] {
  const byDate = new Map(writes.map((write) => [write.date, write.workout]));
  return week.map((day) => (
    byDate.has(day.date)
      ? {
          ...day,
          workout: byDate.get(day.date) ?? null,
          source: 'manual' as const,
        }
      : { ...day }
  ));
}

function buildProfile(
  profile?: ValidateProgramWeekInput['profile'],
): ValidateProgramWeekInput['profile'] {
  if (profile) return profile;
  const onboarding = useProfileStore.getState().onboardingData as ValidateProgramWeekInput['profile'];
  return {
    ...(onboarding ?? {}),
    seasonPhase: useProgramStore.getState().currentProgram?.programPhase ?? onboarding?.seasonPhase,
  } as ValidateProgramWeekInput['profile'];
}

function buildAnchors(args: {
  currentWeek: readonly ResolvedDay[];
  proposedWeek: readonly ResolvedDay[];
  visibleWeek?: readonly ResolvedDay[];
  weekStartISO: string;
  todayISO: string;
}): ValidateProgramWeekInput['anchors'] {
  const weekDates = new Set(args.currentWeek.map((day) => day.date));
  const currentGames = gameDatesFromWeek(args.currentWeek);
  const proposedGames = gameDatesFromWeek(args.proposedWeek);
  const currentTeamTraining = teamTrainingDatesFromWeek(args.currentWeek);
  const proposedTeamTraining = teamTrainingDatesFromWeek(args.proposedWeek);
  const anchors: ValidateProgramWeekInput['anchors'] = {
    gameDates: Array.from(new Set([...currentGames, ...proposedGames])).sort(),
    teamTrainingDates: Array.from(new Set([...currentTeamTraining, ...proposedTeamTraining])).sort(),
  };

  const previousWeekStart = addDaysISO(args.weekStartISO, -7);
  const previousGames = gameDatesFromWeek(visibleWeekForStart({
    visibleWeek: args.visibleWeek,
    weekStartISO: previousWeekStart,
    todayISO: args.todayISO,
  }));
  const previousGameDate = previousGames
    .filter((date) => weekDates.has(addDaysISO(date, 1)))
    .sort()
    .pop();
  if (previousGameDate) anchors.previousGameDate = previousGameDate;

  const nextWeekStart = addDaysISO(args.weekStartISO, 7);
  const nextGames = gameDatesFromWeek(visibleWeekForStart({
    visibleWeek: args.visibleWeek,
    weekStartISO: nextWeekStart,
    todayISO: args.todayISO,
  }));
  const nextGameDate = nextGames
    .filter((date) => weekDates.has(addDaysISO(date, -1)) || weekDates.has(addDaysISO(date, -2)))
    .sort()[0];
  if (nextGameDate) anchors.nextGameDate = nextGameDate;

  if (
    (anchors.gameDates?.length ?? 0) === 0 &&
    (anchors.teamTrainingDates?.length ?? 0) === 0 &&
    !anchors.previousGameDate &&
    !anchors.nextGameDate
  ) {
    return undefined;
  }
  return anchors;
}

function emptyAssessment(): ProgramEditRiskAssessment {
  return {
    decision: 'allow',
    highestLevel: 'info',
    findings: [],
    introducedRuleIds: [],
    worsenedRuleIds: [],
  };
}

function combineAssessments(assessments: readonly ProgramEditRiskAssessment[]): ProgramEditRiskAssessment | null {
  if (assessments.length === 0) return null;
  const findingsByKey = new Map<string, ProgramEditRiskFinding>();
  const introduced = new Set<string>();
  const worsened = new Set<string>();
  for (const assessment of assessments) {
    for (const id of assessment.introducedRuleIds) introduced.add(id);
    for (const id of assessment.worsenedRuleIds) worsened.add(id);
    for (const finding of assessment.findings) {
      const key = [
        finding.ruleId,
        [...finding.dates].sort().join(','),
        [...finding.sessions].sort().join(','),
      ].join('|');
      const existing = findingsByKey.get(key);
      if (!existing || compareProgramEditRiskFindings(finding, existing) < 0) {
        findingsByKey.set(key, finding);
      }
    }
  }
  const findings = Array.from(findingsByKey.values())
    .sort(compareProgramEditRiskFindings);
  const highestLevel = findings.reduce<ProgramEditRiskLevel>((level, finding) => (
    compareProgrammingRiskLevels(finding.level, level) < 0 ? finding.level : level
  ), 'info');
  const decision = getProgrammingEditDecision(highestLevel);
  return {
    decision,
    highestLevel,
    findings,
    introducedRuleIds: Array.from(introduced).sort(),
    worsenedRuleIds: Array.from(worsened).sort(),
  };
}

export function assessProgramEditWrites(
  input: ProgramEditWriteGuardInput,
): ProgramEditRiskAssessment | null {
  const writes = input.writes
    .filter((write) => /^\d{4}-\d{2}-\d{2}$/.test(write.date))
    .map((write) => ({
      ...write,
      workout: write.workout ? validateLiveWorkoutWrite(write.date, write.workout) : null,
    }));
  if (writes.length === 0) return null;
  const weekStarts = Array.from(new Set(writes.map((write) => getMondayForDate(write.date)))).sort();
  const profile = buildProfile(input.profile);
  const activeConstraints = input.activeConstraints ?? useCoachUpdatesStore.getState().activeConstraints;
  const assessments: ProgramEditRiskAssessment[] = [];

  for (const weekStartISO of weekStarts) {
    const currentWeek = visibleWeekForStart({
      visibleWeek: input.visibleWeek,
      weekStartISO,
      todayISO: input.todayISO,
    });
    if (currentWeek.length === 0) continue;
    const weekWrites = writes.filter((write) => getMondayForDate(write.date) === weekStartISO);
    if (weekWrites.length === 0) continue;
    const proposedWeek = withWrites(currentWeek, weekWrites);
    const anchors = buildAnchors({
      currentWeek,
      proposedWeek,
      visibleWeek: input.visibleWeek,
      weekStartISO,
      todayISO: input.todayISO,
    });
    assessments.push(assessProgramEditRisk({
      current: {
        days: validatorDaysFromWeek(currentWeek),
        profile,
        anchors,
      },
      proposed: {
        days: validatorDaysFromWeek(proposedWeek),
        profile,
        anchors,
      },
      allowProtectedAnchorChanges: input.allowProtectedAnchorChanges,
      activeConstraints,
      todayISO: input.todayISO,
    }));
  }

  return combineAssessments(assessments) ?? emptyAssessment();
}

export function guardProgramEditWritesForHardStops(
  input: ProgramEditWriteGuardInput,
): ProgramEditWriteGuardResult {
  const assessment = assessProgramEditWrites(input);
  if (!assessment || assessment.decision !== 'block') {
    return { ok: true, assessment };
  }
  const message =
    assessment.findings[0]?.message ??
    'That edit would hit a hard-stop programming rule, so it was not applied.';
  return {
    ok: false,
    assessment,
    message,
  };
}
