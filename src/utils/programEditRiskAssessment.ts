import type { Workout } from '../types/domain';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import {
  validateProgramWeek,
  type FindingSeverity,
  type ValidateProgramWeekInput,
  type ValidatorDayInput,
  type WeekFinding,
} from '../rules/weekStructureValidator';
import {
  classifyVisibleSession,
  type ClassifiedVisibleSessionUnit,
} from '../rules/sessionClassificationAdapter';
import {
  PROGRAMMING_DECISION_TIERS,
  compareHierarchyTiers,
  compareProgrammingRiskLevels,
  getProgrammingEditDecision,
  getProgrammingRiskRank,
  type ProgrammingHierarchyTier,
} from '../rules/conflictResolutionHierarchy';

export type ProgramEditRiskDecision = 'allow' | 'confirm' | 'block';
export type ProgramEditRiskLevel = FindingSeverity;
export type ProgramEditRiskSource =
  | 'week_structure_validator'
  | 'program_edit_guard'
  | 'active_constraint';

export interface ProgramEditRiskFinding {
  ruleId: string;
  level: ProgramEditRiskLevel;
  message: string;
  dates: string[];
  sessions: string[];
  canOverride: boolean;
  source: ProgramEditRiskSource;
  /** Global §17.K concern that owns this finding. */
  hierarchyTier?: ProgrammingHierarchyTier;
  bibleRef?: string;
  data?: Record<string, unknown>;
}

export interface ProgramEditRiskAssessment {
  decision: ProgramEditRiskDecision;
  highestLevel: ProgramEditRiskLevel;
  findings: ProgramEditRiskFinding[];
  introducedRuleIds: string[];
  worsenedRuleIds: string[];
}

export interface AssessProgramEditRiskInput {
  current: ValidateProgramWeekInput;
  proposed: ValidateProgramWeekInput;
  /** Anchor-specific flows can opt out of the protected-anchor deletion guard. */
  allowProtectedAnchorChanges?: boolean;
  /** Optional live constraints for medical hard-stop parity. */
  activeConstraints?: readonly ActiveConstraint[];
  todayISO?: string;
}

function addDaysISO(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayName(dateISO: string): string {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[new Date(`${dateISO}T12:00:00Z`).getUTCDay()];
}

function normaliseList(values: readonly string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).filter(Boolean))).sort();
}

function findingKey(finding: ProgramEditRiskFinding): string {
  return [
    finding.ruleId,
    normaliseList(finding.dates).join(','),
    normaliseList(finding.sessions).join(','),
  ].join('|');
}

function firstNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function findingMagnitude(finding: ProgramEditRiskFinding): number {
  return (
    firstNumber(finding.data?.observed) ??
    firstNumber(finding.data?.severity) ??
    firstNumber(finding.data?.score) ??
    -getProgrammingRiskRank(finding.level)
  );
}

function isWorseThan(proposed: ProgramEditRiskFinding, current: ProgramEditRiskFinding): boolean {
  const riskOrder = compareProgrammingRiskLevels(proposed.level, current.level);
  if (riskOrder !== 0) return riskOrder < 0;
  return findingMagnitude(proposed) > findingMagnitude(current);
}

function hierarchyTierForWeekFinding(finding: WeekFinding): ProgrammingHierarchyTier {
  if (finding.ruleId.startsWith('g1_') ||
      finding.ruleId.startsWith('g2_') ||
      finding.ruleId.startsWith('g_plus1_')) {
    return PROGRAMMING_DECISION_TIERS.gameAnchor;
  }
  if (finding.ruleId.startsWith('tt_')) {
    return PROGRAMMING_DECISION_TIERS.teamTrainingAnchor;
  }
  if (finding.ruleId.startsWith('cap_') || finding.ruleId.startsWith('double_')) {
    return PROGRAMMING_DECISION_TIERS.weeklyCaps;
  }
  return PROGRAMMING_DECISION_TIERS.aiSuggestion;
}

export function getProgramEditFindingHierarchyTier(
  finding: ProgramEditRiskFinding,
): ProgrammingHierarchyTier {
  if (finding.hierarchyTier) return finding.hierarchyTier;
  if (finding.ruleId === 'active_injury_hard_stop') {
    return finding.data?.seriousSymptoms === true
      ? PROGRAMMING_DECISION_TIERS.redFlagMedicalStop
      : PROGRAMMING_DECISION_TIERS.injurySafety;
  }
  if (finding.ruleId.startsWith('protected_') || finding.ruleId.startsWith('game_day_') ||
      finding.ruleId.startsWith('g1_') || finding.ruleId.startsWith('g2_') ||
      finding.ruleId.startsWith('g_plus1_')) {
    return PROGRAMMING_DECISION_TIERS.gameAnchor;
  }
  if (finding.ruleId.startsWith('tt_')) {
    return PROGRAMMING_DECISION_TIERS.teamTrainingAnchor;
  }
  if (finding.ruleId.startsWith('cap_') || finding.ruleId.startsWith('double_')) {
    return PROGRAMMING_DECISION_TIERS.weeklyCaps;
  }
  return finding.level === 'hard_stop'
    ? PROGRAMMING_DECISION_TIERS.redFlagMedicalStop
    : PROGRAMMING_DECISION_TIERS.aiSuggestion;
}

/** Stronger risk first, then the higher-priority §17.K concern. */
export function compareProgramEditRiskFindings(
  a: ProgramEditRiskFinding,
  b: ProgramEditRiskFinding,
): number {
  const riskOrder = compareProgrammingRiskLevels(a.level, b.level);
  if (riskOrder !== 0) return riskOrder;
  return compareHierarchyTiers(
    getProgramEditFindingHierarchyTier(a),
    getProgramEditFindingHierarchyTier(b),
  );
}

function toRiskFinding(finding: WeekFinding): ProgramEditRiskFinding {
  return {
    ruleId: finding.ruleId,
    level: finding.severity,
    message: finding.message,
    dates: [...finding.dates],
    sessions: [...finding.sessions],
    canOverride: finding.canOverride,
    source: 'week_structure_validator',
    hierarchyTier: hierarchyTierForWeekFinding(finding),
    bibleRef: finding.bibleRef,
    data: finding.data,
  };
}

function workoutsByDate(days: readonly ValidatorDayInput[]): Map<string, Workout[]> {
  const byDate = new Map<string, Workout[]>();
  for (const day of days) {
    byDate.set(
      day.date,
      (day.workouts ?? []).filter((workout): workout is Workout => Boolean(workout)),
    );
  }
  return byDate;
}

function workoutUnits(
  workout: Workout,
  profile: ValidateProgramWeekInput['profile'],
): ClassifiedVisibleSessionUnit[] {
  return classifyVisibleSession(workout, profile ?? {}).units;
}

function observedAnchorDates(input: ValidateProgramWeekInput, category: 'game' | 'team_training'): string[] {
  const dates = new Set<string>();
  for (const day of input.days) {
    if (day.workouts.some((workout) => (
      Boolean(workout) &&
      (category === 'game'
        ? classifyVisibleSession(workout).anchors.game
        : classifyVisibleSession(workout).anchors.teamTraining)
    ))) {
      dates.add(day.date);
    }
  }
  return Array.from(dates).sort();
}

function gameDatesForProximity(input: ValidateProgramWeekInput): string[] {
  return normaliseList([
    ...observedAnchorDates(input, 'game'),
    ...(input.anchors?.gameDates ?? []),
    ...(input.anchors?.nextGameDate ? [input.anchors.nextGameDate] : []),
  ]);
}

function protectedAnchors(input: ValidateProgramWeekInput): Array<{
  kind: 'game' | 'team_training';
  date: string;
}> {
  return [
    ...observedAnchorDates(input, 'game').map((date) => ({ kind: 'game' as const, date })),
    ...observedAnchorDates(input, 'team_training').map((date) => ({ kind: 'team_training' as const, date })),
  ];
}

function hasAnchor(input: ValidateProgramWeekInput, anchor: { kind: 'game' | 'team_training'; date: string }): boolean {
  return protectedAnchors(input).some((candidate) => (
    candidate.kind === anchor.kind &&
    candidate.date === anchor.date
  ));
}

function isHardStopCategory(
  category: ClassifiedVisibleSessionUnit['category'],
  stress: ClassifiedVisibleSessionUnit['stress'],
): boolean {
  return (
    category === 'lower_strength' ||
    category === 'hard_conditioning' ||
    category === 'sprint' ||
    (category === 'full_body_strength' && stress === 'high')
  );
}

function hardStopLabel(category: ClassifiedVisibleSessionUnit['category']): string {
  return category.replace(/_/g, ' ');
}

function protectedAnchorFindings(
  current: ValidateProgramWeekInput,
  proposed: ValidateProgramWeekInput,
  allowProtectedAnchorChanges: boolean,
): ProgramEditRiskFinding[] {
  if (allowProtectedAnchorChanges) return [];
  const findings: ProgramEditRiskFinding[] = [];
  for (const anchor of protectedAnchors(current)) {
    if (hasAnchor(proposed, anchor)) continue;
    findings.push({
      ruleId: `protected_${anchor.kind}_anchor_removed`,
      level: 'hard_stop',
      message: `${anchor.kind === 'game' ? 'Game day' : 'Team training'} on ${dayName(anchor.date)} is a protected anchor and cannot be removed by a normal program edit.`,
      dates: [anchor.date],
      sessions: [anchor.kind === 'game' ? 'Game Day' : 'Team Training'],
      canOverride: false,
      source: 'program_edit_guard',
      hierarchyTier: anchor.kind === 'game'
        ? PROGRAMMING_DECISION_TIERS.gameAnchor
        : PROGRAMMING_DECISION_TIERS.teamTrainingAnchor,
      bibleRef: 'Section 16 App / AI rules; Section 17.E',
      data: { anchorKind: anchor.kind },
    });
  }
  return findings;
}

function gameDayHardStopFindings(input: ValidateProgramWeekInput): ProgramEditRiskFinding[] {
  const findings: ProgramEditRiskFinding[] = [];
  const gameDates = new Set([
    ...observedAnchorDates(input, 'game'),
    ...(input.anchors?.gameDates ?? []),
  ]);
  const byDate = workoutsByDate(input.days);
  for (const gameDate of gameDates) {
    for (const workout of byDate.get(gameDate) ?? []) {
      const units = workoutUnits(workout, input.profile);
      if (units.some((unit) => unit.category === 'game')) continue;
      for (const unit of units) {
        if (!isHardStopCategory(unit.category, unit.stress)) continue;
        findings.push({
          ruleId: 'game_day_hard_work',
          level: 'hard_stop',
          message: `${hardStopLabel(unit.category)} on game day is not a normal editable training slot.`,
          dates: [gameDate],
          sessions: [workout.name],
          canOverride: false,
          source: 'program_edit_guard',
          hierarchyTier: PROGRAMMING_DECISION_TIERS.gameAnchor,
          bibleRef: 'Section 16 Game day / in-season rules; Section 17.C',
          data: { category: unit.category, stress: unit.stress },
        });
      }
    }
  }
  return findings;
}

function gMinusOneHardStopFindings(input: ValidateProgramWeekInput): ProgramEditRiskFinding[] {
  const findings: ProgramEditRiskFinding[] = [];
  const weekDates = new Set(input.days.map((day) => day.date));
  const byDate = workoutsByDate(input.days);
  for (const gameDate of gameDatesForProximity(input)) {
    const gMinusOne = addDaysISO(gameDate, -1);
    if (!weekDates.has(gMinusOne)) continue;
    for (const workout of byDate.get(gMinusOne) ?? []) {
      for (const unit of workoutUnits(workout, input.profile)) {
        if (unit.category === 'game' || unit.category === 'team_training') continue;
        if (!isHardStopCategory(unit.category, unit.stress)) continue;
        findings.push({
          ruleId: 'g1_hard_work',
          level: 'hard_stop',
          message: `${hardStopLabel(unit.category)} on ${dayName(gMinusOne)} is G-1 before the ${dayName(gameDate)} game. Normal edits cannot add hard work there.`,
          dates: [gMinusOne],
          sessions: [workout.name],
          canOverride: false,
          source: 'program_edit_guard',
          hierarchyTier: PROGRAMMING_DECISION_TIERS.gameAnchor,
          bibleRef: 'Section 17.C G-1; Section 17.F Hard stop',
          data: { gameDate, category: unit.category, stress: unit.stress },
        });
      }
    }
  }
  return findings;
}

function expiresBeforeToday(constraint: ActiveConstraint, todayISO: string | undefined): boolean {
  const expiresAt = (constraint as { expiresAt?: unknown }).expiresAt;
  return typeof expiresAt === 'string' && typeof todayISO === 'string' && expiresAt < todayISO;
}

function activeConstraintHardStops(
  constraints: readonly ActiveConstraint[] | undefined,
  todayISO: string | undefined,
): ProgramEditRiskFinding[] {
  const findings: ProgramEditRiskFinding[] = [];
  for (const constraint of constraints ?? []) {
    if (expiresBeforeToday(constraint, todayISO)) continue;
    if (constraint.type !== 'injury') continue;
    const hardStop =
      constraint.seriousSymptoms === true ||
      constraint.severity >= 8 ||
      constraint.adjustmentLevel === 'training_paused';
    if (!hardStop) continue;
    findings.push({
      ruleId: 'active_injury_hard_stop',
      level: 'hard_stop',
      message: 'A serious injury or medical-stop constraint is active. Do not treat this as a normal training edit.',
      dates: [],
      sessions: [],
      canOverride: false,
      source: 'active_constraint',
      hierarchyTier: constraint.seriousSymptoms === true
        ? PROGRAMMING_DECISION_TIERS.redFlagMedicalStop
        : PROGRAMMING_DECISION_TIERS.injurySafety,
      bibleRef: 'Section 17.F Hard stop; Section 17.G',
      data: {
        constraintId: constraint.id,
        bodyPart: constraint.bodyPart,
        severity: constraint.severity,
        seriousSymptoms: constraint.seriousSymptoms === true,
      },
    });
  }
  return findings;
}

function editGuardFindings(
  current: ValidateProgramWeekInput,
  proposed: ValidateProgramWeekInput,
  opts: Pick<AssessProgramEditRiskInput, 'allowProtectedAnchorChanges' | 'activeConstraints' | 'todayISO'> & {
    includeActiveConstraintHardStops?: boolean;
  },
): ProgramEditRiskFinding[] {
  return [
    ...protectedAnchorFindings(current, proposed, opts.allowProtectedAnchorChanges === true),
    ...gameDayHardStopFindings(proposed),
    ...gMinusOneHardStopFindings(proposed),
    ...(opts.includeActiveConstraintHardStops ? activeConstraintHardStops(opts.activeConstraints, opts.todayISO) : []),
  ];
}

function isCoveredByHardStop(
  finding: ProgramEditRiskFinding,
  allFindings: readonly ProgramEditRiskFinding[],
): boolean {
  if (finding.level === 'hard_stop') return false;
  if (finding.source !== 'week_structure_validator') return false;
  return allFindings.some((candidate) => (
    candidate.level === 'hard_stop' &&
    candidate.dates.some((date) => finding.dates.includes(date)) &&
    candidate.sessions.some((session) => finding.sessions.includes(session))
  ));
}

function collectFindings(
  current: ValidateProgramWeekInput,
  proposed: ValidateProgramWeekInput,
  opts: Pick<AssessProgramEditRiskInput, 'allowProtectedAnchorChanges' | 'activeConstraints' | 'todayISO'>,
  side: 'current' | 'proposed',
): ProgramEditRiskFinding[] {
  const target = side === 'current' ? current : proposed;
  const validatorFindings = validateProgramWeek(target).findings.map(toRiskFinding);
  const guardFindings = side === 'current'
    ? editGuardFindings(current, current, opts)
    : editGuardFindings(current, proposed, { ...opts, includeActiveConstraintHardStops: true });
  const combined = [...validatorFindings, ...guardFindings];
  const visible = combined.filter((finding) => !isCoveredByHardStop(finding, combined));
  const deduped = new Map<string, ProgramEditRiskFinding>();
  for (const finding of visible) {
    const key = findingKey(finding);
    const existing = deduped.get(key);
    if (!existing || compareProgramEditRiskFindings(finding, existing) < 0) {
      deduped.set(key, finding);
    }
  }
  return Array.from(deduped.values()).sort(compareProgramEditRiskFindings);
}

function compareFindings(
  current: readonly ProgramEditRiskFinding[],
  proposed: readonly ProgramEditRiskFinding[],
): {
  surfaced: ProgramEditRiskFinding[];
  introducedRuleIds: string[];
  worsenedRuleIds: string[];
} {
  const currentByKey = new Map(current.map((finding) => [findingKey(finding), finding]));
  const surfaced: ProgramEditRiskFinding[] = [];
  const introduced = new Set<string>();
  const worsened = new Set<string>();
  for (const finding of proposed) {
    const existing = currentByKey.get(findingKey(finding));
    if (!existing) {
      surfaced.push(finding);
      introduced.add(finding.ruleId);
      continue;
    }
    if (isWorseThan(finding, existing)) {
      surfaced.push(finding);
      worsened.add(finding.ruleId);
    }
  }
  surfaced.sort(compareProgramEditRiskFindings);
  return {
    surfaced,
    introducedRuleIds: Array.from(introduced).sort(),
    worsenedRuleIds: Array.from(worsened).sort(),
  };
}

function highestLevel(findings: readonly ProgramEditRiskFinding[]): ProgramEditRiskLevel {
  return findings.reduce<ProgramEditRiskLevel>((highest, finding) => (
    compareProgrammingRiskLevels(finding.level, highest) < 0 ? finding.level : highest
  ), 'info');
}

export function assessProgramEditRisk(input: AssessProgramEditRiskInput): ProgramEditRiskAssessment {
  const currentFindings = collectFindings(input.current, input.proposed, input, 'current');
  const proposedFindings = collectFindings(input.current, input.proposed, input, 'proposed');
  const comparison = compareFindings(currentFindings, proposedFindings);
  const level = highestLevel(comparison.surfaced);
  return {
    decision: getProgrammingEditDecision(level),
    highestLevel: level,
    findings: comparison.surfaced,
    introducedRuleIds: comparison.introducedRuleIds,
    worsenedRuleIds: comparison.worsenedRuleIds,
  };
}
