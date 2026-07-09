import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import type { InjuryBucket } from './injuryAdjustmentEngine';
import {
  classifyBibleInjurySeverity,
  injurySeverityPausesAffectedTraining,
  injurySeverityRecommendsPhysio,
} from '../rules/injurySeverityBands';

export type GuidedInjuryRegion = 'upper_body' | 'lower_body' | 'back_midline' | 'other';
export type GuidedInjurySeverityBand = 'mild' | 'slight' | 'moderate' | 'avoid';
export type GuidedInjuryAdjustmentLevel =
  | 'minimal'
  | 'slight'
  | 'moderate'
  | 'avoid_affected'
  | 'training_paused';

export interface GuidedInjuryFlowResult {
  region: GuidedInjuryRegion;
  area: string;
  severity: number;
  severityBand: GuidedInjurySeverityBand;
  adjustmentLevel: GuidedInjuryAdjustmentLevel;
  triggers: string[];
  seriousSymptoms: boolean;
  seriousSymptom?: string;
}

export const GUIDED_INJURY_REGION_OPTIONS: Array<{ id: GuidedInjuryRegion; label: string }> = [
  { id: 'upper_body', label: 'Upper body' },
  { id: 'lower_body', label: 'Lower body' },
  { id: 'back_midline', label: 'Back / midline' },
  { id: 'other', label: 'Other' },
];

export const GUIDED_INJURY_AREA_OPTIONS: Record<Exclude<GuidedInjuryRegion, 'other'>, string[]> = {
  upper_body: ['Neck', 'Shoulder', 'Elbow', 'Wrist / hand', 'Chest / ribs', 'Other upper body'],
  lower_body: ['Hip / groin', 'Hamstring', 'Quad', 'Knee', 'Calf / Achilles', 'Ankle / foot', 'Other lower body'],
  back_midline: ['Lower back', 'Upper back', 'Abs / side', 'Neck', 'Other midline'],
};

export const GUIDED_INJURY_TRIGGER_OPTIONS = [
  'Sprinting',
  'Change of direction',
  'Kicking',
  'Running',
  'Jumping / landing',
  'Heavy lifting',
  'Squatting / lunging',
  'Hinging / bending',
  'Pressing',
  'Pulling',
  'Contact / games',
  'Always there',
  'Other',
] as const;

export const GUIDED_INJURY_SEVERITY_OPTIONS: Array<{
  label: string;
  sub: string;
  severity: number;
  severityBand: GuidedInjurySeverityBand;
  adjustmentLevel: GuidedInjuryAdjustmentLevel;
}> = [
  {
    label: '1-3 / 10',
    sub: 'Mild - I can train through it',
    severity: 2,
    severityBand: 'mild',
    adjustmentLevel: 'minimal',
  },
  {
    label: '4-5 / 10',
    sub: 'Annoying - needs a slight adjustment',
    severity: 5,
    severityBand: 'slight',
    adjustmentLevel: 'slight',
  },
  {
    label: '6-7 / 10',
    sub: 'Limiting - needs a moderate adjustment',
    severity: 7,
    severityBand: 'moderate',
    adjustmentLevel: 'moderate',
  },
  {
    label: '8-10 / 10',
    sub: 'Bad - avoid affected work',
    severity: 9,
    severityBand: 'avoid',
    adjustmentLevel: 'training_paused',
  },
];

function normaliseKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

export function guidedInjuryBucketForArea(area: string): InjuryBucket | null {
  const key = area.trim().toLowerCase();
  if (/shoulder|neck|chest|rib|pec/.test(key)) return 'shoulder';
  if (/elbow/.test(key)) return 'elbow';
  if (/wrist|hand/.test(key)) return 'wrist';
  if (/groin|adductor/.test(key)) return 'adductor';
  if (/hip/.test(key)) return 'adductor';
  if (/hamstring|hammy/.test(key)) return 'hamstring';
  if (/knee|quad/.test(key)) return 'knee';
  if (/calf|achilles/.test(key)) return 'calf';
  if (/ankle|foot/.test(key)) return 'ankle';
  if (/lower back|upper back|back|midline|abs|side/.test(key)) return 'lowerBack';
  return null;
}

function guidedSeverityBandForSeverity(severity: number): GuidedInjurySeverityBand {
  switch (classifyBibleInjurySeverity(severity).band) {
    case 'avoid_trigger_1_3':
      return 'mild';
    case 'reduce_affected_4_5':
      return 'slight';
    case 'restrict_and_refer_6_7':
      return 'moderate';
    case 'pause_affected_8_10':
      return 'avoid';
  }
}

function guidedAdjustmentForSeverity(severity: number): GuidedInjuryAdjustmentLevel {
  switch (classifyBibleInjurySeverity(severity).band) {
    case 'avoid_trigger_1_3':
      return 'minimal';
    case 'reduce_affected_4_5':
      return 'slight';
    case 'restrict_and_refer_6_7':
      return 'moderate';
    case 'pause_affected_8_10':
      return 'training_paused';
  }
}

function displayArea(area: string): string {
  return area.trim().replace(/\s*\/\s*/g, ' / ').toLowerCase();
}

function severityDescriptor(result: GuidedInjuryFlowResult): string {
  if (result.adjustmentLevel === 'training_paused') return '8-10 / 10';
  if (result.severityBand === 'mild') return 'mild';
  if (result.severityBand === 'slight') return 'annoying';
  if (result.severityBand === 'moderate') return 'moderate';
  return 'high-limitation';
}

function triggerClause(triggers: readonly string[]): string {
  const clean = triggers.map((trigger) => trigger.toLowerCase()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return ` triggered by ${clean[0]}`;
  return ` triggered by ${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
}

function rulesFor(result: GuidedInjuryFlowResult): string[] {
  if (result.adjustmentLevel === 'training_paused' || result.seriousSymptoms) {
    return ['affected training until reviewed', 'hard work around the affected area'];
  }
  const rules = result.triggers.length > 0
    ? result.triggers.map((trigger) => trigger.toLowerCase())
    : [`training that aggravates ${displayArea(result.area)}`];
  if (result.severityBand === 'mild') {
    return rules.map((rule) => `monitor ${rule}`);
  }
  if (result.severityBand === 'slight') {
    return rules.map((rule) => `reduce ${rule}`);
  }
  if (result.severityBand === 'moderate') {
    return rules.map((rule) => `limit ${rule}`);
  }
  return rules.map((rule) => `avoid ${rule}`);
}

function safeFocusFor(region: GuidedInjuryRegion, serious: boolean): string[] {
  if (serious) return ['Stop affected training', 'Seek medical or physio advice'];
  if (region === 'upper_body') return ['Lower body training where suitable', 'Easy conditioning', 'Unaffected core work'];
  if (region === 'lower_body') return ['Upper body training where suitable', 'Low-impact conditioning', 'Unaffected core work'];
  if (region === 'back_midline') return ['Supported upper body work', 'Easy conditioning', 'Unaffected low-risk work'];
  return ['Unaffected training only', 'Recovery work'];
}

function modifierBody(result: GuidedInjuryFlowResult): string {
  if (result.adjustmentLevel === 'training_paused' || result.seriousSymptoms) {
    return "You rated this as 8-10 / 10, so affected training is paused until you're ready or cleared to train.";
  }
  const area = displayArea(result.area);
  return `Your program is being adjusted around a ${severityDescriptor(result)} ${area} issue${triggerClause(result.triggers)}.`;
}

export function buildGuidedInjuryConstraint(
  result: GuidedInjuryFlowResult,
  opts: { todayISO: string; existingId?: string } = { todayISO: new Date().toISOString().slice(0, 10) },
): ActiveInjuryConstraint {
  const now = new Date().toISOString();
  const bucket = guidedInjuryBucketForArea(result.area);
  const key = bucket ?? normaliseKey(result.area);
  const bandFromSeverity = guidedSeverityBandForSeverity(result.severity);
  const adjustmentFromSeverity = guidedAdjustmentForSeverity(result.severity);
  const trainingPaused = injurySeverityPausesAffectedTraining(result.severity) || result.seriousSymptoms;
  const effectiveResult: GuidedInjuryFlowResult = {
    ...result,
    severityBand: trainingPaused ? 'avoid' : bandFromSeverity,
    adjustmentLevel: trainingPaused ? 'training_paused' : adjustmentFromSeverity,
  };
  return {
    id: opts.existingId ?? `injury-${key}`,
    type: 'injury',
    bodyPart: displayArea(result.area),
    bucket,
    severity: trainingPaused ? Math.max(8, result.severity) : result.severity,
    status: 'active',
    startDate: opts.todayISO,
    lastUpdatedAt: now,
    source: 'guided_injury_flow',
    region: result.region,
    severityBand: effectiveResult.severityBand,
    adjustmentLevel: effectiveResult.adjustmentLevel,
    triggers: [...result.triggers],
    seriousSymptoms: result.seriousSymptoms,
    seriousSymptom: result.seriousSymptom,
    modifierTitle: trainingPaused ? 'Training paused for injury' : undefined,
    modifierBody: modifierBody(effectiveResult),
    modifierAffects: ['current_week', 'future_generation'],
    rules: rulesFor(effectiveResult),
    safeFocus: safeFocusFor(result.region, trainingPaused),
    advice: trainingPaused
      ? ['Stop affected training and get proper medical or physio advice.']
      : injurySeverityRecommendsPhysio(result.severity)
        ? ['Get medical or physio advice if this is not already being managed.']
        : [],
  };
}

export function guidedInjuryResultFromConstraint(
  constraint: ActiveInjuryConstraint | null | undefined,
): Partial<GuidedInjuryFlowResult> | undefined {
  if (!constraint) return undefined;
  return {
    region: constraint.region,
    area: constraint.bodyPart,
    severity: constraint.severity,
    severityBand: constraint.severityBand,
    adjustmentLevel: constraint.adjustmentLevel,
    triggers: constraint.triggers ?? [],
    seriousSymptoms: constraint.seriousSymptoms ?? false,
    seriousSymptom: constraint.seriousSymptom,
  };
}
