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

