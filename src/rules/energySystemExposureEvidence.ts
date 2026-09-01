/**
 * Canonical read projection for weekly and full-year energy-system evidence.
 *
 * The semantic decision stays in `classifyVisibleSession`, which is also read
 * by weekly counting and Section 18 validation. Annual audits and reports
 * persist this result at compiler time; they never infer credit from display
 * names or append-only evidence rows.
 */
import type { Workout } from '../types/domain';
import {
  hasIndependentConditioningBlock,
  hasQualifyingSpeedConditioning,
} from './conditioningCredit';
import { classifyVisibleSession } from './sessionClassificationAdapter';

export interface EnergySystemExposureEvidence {
  protocolVersion: 1;
  source: 'session_classification_adapter';
  conditioningCredits: number;
  appProgrammedConditioningCredits: number;
  sprintHighSpeedCredits: number;
  qualifyingSpeed: boolean;
  independentConditioning: boolean;
  speedTemplateName: string | null;
}

export type EnergySystemEvidenceFinding =
  | 'missing_energy_system_evidence'
  | 'qualifying_speed_missing_conditioning_credit'
  | 'one_session_received_duplicate_conditioning_credit'
  | 'negative_energy_system_credit';

export type EnergySystemDensityFinding =
  | 'offseason_app_programmed_energy_system_days_above_four'
  | 'three_consecutive_app_programmed_energy_system_days';

export interface DatedEnergySystemExposureEvidence {
  readonly date: string;
  readonly energySystem: EnergySystemExposureEvidence | null | undefined;
}

export function energySystemExposureEvidenceForWorkout(
  workout: Workout | null | undefined,
): EnergySystemExposureEvidence {
  const classification = classifyVisibleSession(workout);
  return {
    protocolVersion: 1,
    source: 'session_classification_adapter',
    conditioningCredits: classification.contributions.conditioning,
    appProgrammedConditioningCredits: classification.contributions.extraConditioning,
    sprintHighSpeedCredits: classification.contributions.sprintCod,
    qualifyingSpeed: !!workout && hasQualifyingSpeedConditioning(workout),
    independentConditioning: !!workout && hasIndependentConditioningBlock(workout),
    speedTemplateName: workout?.speedBlock?.templateName ?? null,
  };
}

/**
 * Audit the projected evidence without recreating its semantics. A qualifying
 * speed session must retain its one conditioning credit, and one app-authored
 * session can never manufacture a second credit from another view of the same
 * work. Anchors are allowed to contribute separately in their own workouts.
 */
export function validateEnergySystemExposureEvidence(
  evidence: EnergySystemExposureEvidence | null | undefined,
): EnergySystemEvidenceFinding[] {
  if (!evidence) return ['missing_energy_system_evidence'];
  const findings: EnergySystemEvidenceFinding[] = [];
  if (
    evidence.conditioningCredits < 0 ||
    evidence.appProgrammedConditioningCredits < 0 ||
    evidence.sprintHighSpeedCredits < 0
  ) findings.push('negative_energy_system_credit');
  if (evidence.qualifyingSpeed && evidence.appProgrammedConditioningCredits !== 1) {
    findings.push('qualifying_speed_missing_conditioning_credit');
  }
  if (evidence.appProgrammedConditioningCredits > 1) {
    findings.push('one_session_received_duplicate_conditioning_credit');
  }
  return findings;
}

export function isAppProgrammedEnergySystemDay(
  evidence: EnergySystemExposureEvidence | null | undefined,
): boolean {
  return (evidence?.appProgrammedConditioningCredits ?? 0) > 0;
}

/** A selected conditioning exposure, distinct from a pure Running Speed seat. */
export function isGeneratedConditioningDay(
  evidence: EnergySystemExposureEvidence | null | undefined,
): boolean {
  return isAppProgrammedEnergySystemDay(evidence)
    && evidence?.independentConditioning === true;
}

/** Typed Running Speed evidence; display-row labels are not an audit source. */
export function isRunningSpeedDay(
  evidence: EnergySystemExposureEvidence | null | undefined,
): boolean {
  return evidence?.qualifyingSpeed === true
    && (evidence.sprintHighSpeedCredits ?? 0) > 0;
}

export interface WeeklyEnergySystemAuditDay {
  readonly kind?: string | null;
  readonly type?: string | null;
  readonly energySystem: EnergySystemExposureEvidence | null | undefined;
}

export interface WeeklyEnergySystemAuditCounts {
  readonly explicitFixtureDays: number;
  readonly generatedConditioningDays: number;
  readonly runningSpeedDays: number;
  readonly teamTrainingCreditDays: number;
  readonly totalEnergySystemCredits: number;
  readonly appProgrammedExposureDays: number;
}

/** One semantic owner for the six separately named annual audit units. */
export function summarizeWeeklyEnergySystemAudit(
  days: readonly WeeklyEnergySystemAuditDay[],
): WeeklyEnergySystemAuditCounts {
  return {
    explicitFixtureDays: days.filter((day) => day.kind === 'game').length,
    generatedConditioningDays: days.filter((day) =>
      isGeneratedConditioningDay(day.energySystem)).length,
    runningSpeedDays: days.filter((day) =>
      isRunningSpeedDay(day.energySystem)).length,
    teamTrainingCreditDays: days.filter((day) => day.type === 'Team Training'
      && (day.energySystem?.conditioningCredits ?? 0) > 0).length,
    totalEnergySystemCredits: days.reduce((sum, day) =>
      sum + (day.energySystem?.conditioningCredits ?? 0), 0),
    appProgrammedExposureDays: days.filter((day) =>
      isAppProgrammedEnergySystemDay(day.energySystem)).length,
  };
}

/** R-303 weekly cap. Team/game anchors remain separate and do not enter this count. */
export function validateWeeklyEnergySystemDensity(args: {
  readonly phase: string;
  readonly phaseWeek: number;
  readonly days: readonly DatedEnergySystemExposureEvidence[];
}): EnergySystemDensityFinding[] {
  const appDays = args.days.filter((day) =>
    isAppProgrammedEnergySystemDay(day.energySystem));
  return args.phase === 'Off-season' && args.phaseWeek >= 5 && appDays.length > 4
    ? ['offseason_app_programmed_energy_system_days_above_four'] : [];
}

/**
 * R-303 spacing over a complete dated run, not a seven-slot display. Sorting
 * ISO dates and walking actual UTC day numbers also catches Sat/Sun/Mon across
 * a week boundary. One date appears at most once in compiler evidence.
 */
export function consecutiveEnergySystemTriples(
  days: readonly DatedEnergySystemExposureEvidence[],
): string[][] {
  const millisPerDay = 86_400_000;
  const appDates = [...new Set(days
    .filter((day) => isAppProgrammedEnergySystemDay(day.energySystem))
    .map((day) => day.date))].sort();
  const triples: string[][] = [];
  for (let index = 2; index < appDates.length; index += 1) {
    const first = Date.parse(`${appDates[index - 2]}T00:00:00.000Z`) / millisPerDay;
    const middle = Date.parse(`${appDates[index - 1]}T00:00:00.000Z`) / millisPerDay;
    const last = Date.parse(`${appDates[index]}T00:00:00.000Z`) / millisPerDay;
    if (middle - first === 1 && last - middle === 1) {
      triples.push(appDates.slice(index - 2, index + 1));
    }
  }
  return triples;
}
