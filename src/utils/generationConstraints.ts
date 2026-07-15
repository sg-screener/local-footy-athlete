import type {
  ActiveConstraint,
  ActiveFatigueConstraint,
  ActiveInjuryConstraint,
  ActiveScheduleConstraint,
  ActiveSorenessConstraint,
} from '../store/coachUpdatesStore';
import type {
  InjurySeverity,
  InjuryTiming,
  OnboardingData,
  OnboardingInjury,
} from '../types/domain';
import type { InjuryKey } from '../data/exerciseTags';
import type { AthletePoolPrefs } from '../data/exercisePoolsStrength';
import {
  classifyBibleInjurySeverity,
  injurySeverityPausesAffectedTraining,
  injurySeverityReducesAffectedWork,
  injurySeverityRemovesRiskyWork,
  type BibleInjurySeverityBand,
} from '../rules/injurySeverityBands';
import { stageReintroductionSeverity } from '../rules/injuryReintroduction';
import { constraintAppliesToDate } from './readinessConstraints';

export type GenerationReadinessTier =
  | 'slight_reduction'
  | 'moderate_reduction'
  | 'major_reduction'
  | 'full_pause';

export type GenerationInjuryRegion =
  | 'lower_body'
  | 'upper_body'
  | 'back_midline'
  | 'other';

export interface GenerationInjuryConstraint {
  id: string;
  sourceType: 'injury' | 'soreness';
  bodyPart: string;
  bucket?: string;
  region: GenerationInjuryRegion;
  /** Reported severity (for display / trend). */
  severity: number;
  /**
   * Severity the restriction pipeline actually uses. Equals `severity` unless
   * the athlete is improving from a higher recent severity, in which case
   * staged reintroduction holds it one band above the reported value.
   */
  effectiveSeverity: number;
  severityBand: BibleInjurySeverityBand;
  onboardingSeverity: InjurySeverity;
  triggers: string[];
  reduceAffectedWork: boolean;
  removeRiskyWork: boolean;
  pauseAffectedTraining: boolean;
  injuryKeys: InjuryKey[];
}

export interface GenerationReadinessConstraint {
  id: string;
  sourceType: 'fatigue' | 'schedule';
  severity: number;
  tier: GenerationReadinessTier;
  label?: string;
  avoidSprint: boolean;
  avoidHardConditioning: boolean;
  reduceHardExtras: boolean;
  preferRecovery: boolean;
  fullPause: boolean;
}

export interface GenerationConstraintContext {
  activeConstraintIds: string[];
  injuries: GenerationInjuryConstraint[];
  readiness?: GenerationReadinessConstraint;
  activeInjuryKeys: InjuryKey[];
}

/** Schedule-history notes describe an accepted mutation; they are not load/readiness inputs. */
export function isStructuralGenerationConstraint(constraint: ActiveConstraint): boolean {
  return !(
    constraint.type === 'schedule' &&
    constraint.severity <= 0 &&
    constraint.noteProof?.kind === 'game_change'
  );
}

export function buildGenerationConstraintContext(args: {
  activeConstraints?: readonly ActiveConstraint[] | null;
  todayISO: string;
  periodEndISO?: string;
}): GenerationConstraintContext | undefined {
  const live = (args.activeConstraints ?? []).filter((constraint) =>
    isStructuralGenerationConstraint(constraint) &&
    constraint.status !== 'resolved' && (
      args.periodEndISO
        ? constraintOverlapsPeriod(constraint as any, args.todayISO, args.periodEndISO)
        : constraintAppliesToDate(constraint as any, args.todayISO)
    ),
  );
  const injuries = live
    .map((constraint) => injuryFromConstraint(constraint))
    .filter((constraint): constraint is GenerationInjuryConstraint => !!constraint);
  const readiness = strongestReadinessConstraint(live);
  const activeInjuryKeys = Array.from(new Set(
    injuries
      .filter((injury) => injury.effectiveSeverity >= 4)
      .flatMap((injury) => injury.injuryKeys),
  ));

  if (injuries.length === 0 && !readiness) return undefined;
  return {
    activeConstraintIds: live.map((constraint) => constraint.id),
    injuries,
    readiness,
    activeInjuryKeys,
  };
}

function constraintOverlapsPeriod(
  constraint: ActiveConstraint | any,
  periodStartISO: string,
  periodEndISO: string,
): boolean {
  const periodStart = periodStartISO.slice(0, 10);
  const periodEnd = periodEndISO.slice(0, 10);
  if (typeof constraint?.appliesToDate === 'string') {
    const exact = constraint.appliesToDate.slice(0, 10);
    return exact >= periodStart && exact <= periodEnd;
  }
  const starts = typeof constraint?.weekStartISO === 'string'
    ? constraint.weekStartISO.slice(0, 10)
    : typeof constraint?.startDate === 'string'
      ? constraint.startDate.slice(0, 10)
      : null;
  const expires = typeof constraint?.expiresAt === 'string'
    ? constraint.expiresAt.slice(0, 10)
    : null;
  return !(starts && starts > periodEnd) && !(expires && expires < periodStart);
}

export function applyGenerationConstraintsToProfile(
  profile: OnboardingData,
  context: GenerationConstraintContext | undefined,
): OnboardingData {
  if (!context?.injuries.length) return profile;

  const merged = new Map<string, OnboardingInjury>();
  for (const injury of profile.injuries ?? []) {
    merged.set(injuryKey(injury.bodyArea), { ...injury });
  }
  for (const injury of context.injuries) {
    const bodyArea = bodyAreaForGenerationInjury(injury);
    const key = injuryKey(bodyArea);
    const current = merged.get(key);
    const next = onboardingInjuryForGenerationConstraint(injury, bodyArea);
    if (!current || onboardingSeverityRank(next.severity) >= onboardingSeverityRank(current.severity)) {
      merged.set(key, current ? { ...current, ...next } : next);
    }
  }

  return {
    ...profile,
    injuries: Array.from(merged.values()),
  };
}

export function mergeAthletePrefsWithGenerationConstraints(
  prefs: AthletePoolPrefs,
  context: GenerationConstraintContext | undefined,
): AthletePoolPrefs {
  if (!context?.activeInjuryKeys.length) return prefs;
  return {
    ...prefs,
    activeInjuries: Array.from(new Set([
      ...(prefs.activeInjuries ?? []),
      ...context.activeInjuryKeys,
    ])),
  };
}

function injuryFromConstraint(
  constraint: ActiveConstraint,
): GenerationInjuryConstraint | null {
  if (constraint.type === 'injury') {
    return buildInjuryLikeConstraint({
      id: constraint.id,
      sourceType: 'injury',
      bodyPart: constraint.bodyPart,
      bucket: constraint.bucket,
      severity: constraint.severity,
      priorSeverity: constraint.priorSeverity,
      region: constraint.region,
      triggers: constraint.triggers ?? triggerTextFromConstraint(constraint),
    });
  }

  if (constraint.type === 'soreness') {
    const soreness = constraint as ActiveSorenessConstraint;
    return buildInjuryLikeConstraint({
      id: soreness.id,
      sourceType: 'soreness',
      bodyPart: soreness.bodyPart,
      bucket: soreness.bucket,
      severity: Math.max(1, soreness.severity - 2),
      region: undefined,
      triggers: triggerTextFromConstraint(soreness),
    });
  }

  return null;
}

function buildInjuryLikeConstraint(args: {
  id: string;
  sourceType: 'injury' | 'soreness';
  bodyPart: string;
  bucket?: string;
  severity: number;
  priorSeverity?: number;
  region?: ActiveInjuryConstraint['region'];
  triggers: string[];
}): GenerationInjuryConstraint {
  const severity = clampSeverity(args.severity);
  // Staged reintroduction: while improving, restrictions are computed from an
  // effective severity that relaxes at most one band per step. No prior
  // severity ⇒ effective === reported (exact no-op for fresh injuries).
  const effectiveSeverity = clampSeverity(stageReintroductionSeverity({
    currentSeverity: severity,
    priorSeverity: args.priorSeverity,
  }));
  const band = classifyBibleInjurySeverity(effectiveSeverity).band;
  const bodyPart = normaliseBodyPart(args.bodyPart || args.bucket || 'injury');
  const bucket = args.bucket ? String(args.bucket) : undefined;
  return {
    id: args.id,
    sourceType: args.sourceType,
    bodyPart,
    bucket,
    region: args.region ?? inferRegion(bodyPart, bucket),
    severity,
    effectiveSeverity,
    severityBand: band,
    onboardingSeverity: onboardingSeverityForNumeric(effectiveSeverity),
    triggers: Array.from(new Set(args.triggers.map((trigger) => trigger.trim()).filter(Boolean))),
    reduceAffectedWork: injurySeverityReducesAffectedWork(effectiveSeverity),
    removeRiskyWork: injurySeverityRemovesRiskyWork(effectiveSeverity),
    pauseAffectedTraining: injurySeverityPausesAffectedTraining(effectiveSeverity),
    injuryKeys: injuryKeysFor(bodyPart, bucket),
  };
}

function strongestReadinessConstraint(
  constraints: readonly ActiveConstraint[],
): GenerationReadinessConstraint | undefined {
  const readiness = constraints
    .map((constraint) => readinessFromConstraint(constraint))
    .filter((constraint): constraint is GenerationReadinessConstraint => !!constraint)
    .sort((a, b) => b.severity - a.severity)[0];
  return readiness;
}

function readinessFromConstraint(
  constraint: ActiveConstraint,
): GenerationReadinessConstraint | null {
  if (constraint.type !== 'fatigue' && constraint.type !== 'schedule') return null;
  const c = constraint as ActiveFatigueConstraint | ActiveScheduleConstraint;
  const severity = clampSeverity(c.severity);
  const text = `${c.reasonLabel ?? ''} ${(c.rules ?? []).join(' ')} ${(c.safeFocus ?? []).join(' ')}`.toLowerCase();
  const bedridden = /\b(bedridden|severe symptoms|can't get out of bed|cannot get out of bed)\b/.test(text);
  const fatigue = constraint.type === 'fatigue' ? constraint as ActiveFatigueConstraint : null;
  const poorSleepPattern = fatigue?.readinessKind === 'poor_sleep'
    ? fatigue.readinessPattern
    : undefined;
  const tier = poorSleepPattern === 'single_night'
    ? 'slight_reduction'
    : poorSleepPattern === 'repeated'
      ? 'moderate_reduction'
      : readinessTierFor(severity, text, bedridden);
  return {
    id: c.id,
    sourceType: constraint.type,
    severity,
    tier,
    label: c.reasonLabel,
    avoidSprint: severity >= 3 || tier !== 'slight_reduction',
    avoidHardConditioning: severity >= 3 || tier !== 'slight_reduction',
    reduceHardExtras: true,
    preferRecovery: tier === 'major_reduction' || tier === 'full_pause',
    fullPause: tier === 'full_pause',
  };
}

function readinessTierFor(
  severity: number,
  text: string,
  bedridden: boolean,
): GenerationReadinessTier {
  if (bedridden || severity >= 9) return 'full_pause';
  if (severity >= 8 || /\b(sick|recovery mode|very cooked|run down)\b/.test(text)) {
    return 'major_reduction';
  }
  if (severity >= 4 || /\b(cooked|poor sleep|load reduced|busy week)\b/.test(text)) {
    return 'moderate_reduction';
  }
  return 'slight_reduction';
}

function onboardingInjuryForGenerationConstraint(
  injury: GenerationInjuryConstraint,
  bodyArea: string,
): OnboardingInjury {
  return {
    bodyArea,
    description: `${injury.bodyPart} active issue ${injury.severity}/10`,
    severity: injury.onboardingSeverity,
    whenItHurts: timingFromTriggers(injury.triggers),
    movementTriggers: injury.triggers.length > 0 ? injury.triggers : undefined,
    notes: classifyBibleInjurySeverity(injury.severity).programResponse,
  };
}

function bodyAreaForGenerationInjury(injury: GenerationInjuryConstraint): string {
  const key = injury.injuryKeys[0];
  if (key === 'lowerBack') return 'Lower back';
  if (key) return capitalise(key);
  if (injury.region === 'upper_body') return 'Shoulder';
  if (injury.region === 'lower_body') return 'Hamstring';
  return capitalise(injury.bodyPart);
}

function triggerTextFromConstraint(
  constraint: ActiveInjuryConstraint | ActiveSorenessConstraint | ActiveFatigueConstraint | ActiveScheduleConstraint,
): string[] {
  return [
    ...((constraint as ActiveInjuryConstraint).triggers ?? []),
    ...(constraint.rules ?? []),
  ];
}

function timingFromTriggers(triggers: readonly string[]): InjuryTiming | undefined {
  const text = triggers.join(' ').toLowerCase();
  if (/\bconstant|always|all the time\b/.test(text)) return 'Constant';
  const running = /\b(run|running|sprint|speed|cod|change of direction|jump|plyo)\b/.test(text);
  const lifting = /\b(lift|lifting|squat|hinge|press|overhead|dip|nordic|deadlift|rdl)\b/.test(text);
  if (running && lifting) return 'Both';
  if (running) return 'Running';
  if (lifting) return 'Lifting';
  return undefined;
}

function onboardingSeverityForNumeric(severity: number): InjurySeverity {
  const band = classifyBibleInjurySeverity(severity).band;
  if (band === 'avoid_trigger_1_3') return 'Mild';
  if (band === 'reduce_affected_4_5') return 'Moderate';
  return 'Severe';
}

function onboardingSeverityRank(severity: InjurySeverity | undefined): number {
  if (severity === 'Severe') return 3;
  if (severity === 'Moderate') return 2;
  if (severity === 'Mild') return 1;
  return 0;
}

function injuryKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function normaliseBodyPart(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, ' ');
}

function inferRegion(bodyPart: string, bucket?: string): GenerationInjuryRegion {
  const text = `${bodyPart} ${bucket ?? ''}`.toLowerCase();
  if (/\b(shoulder|elbow|wrist|pec|chest|neck|upper)\b/.test(text)) return 'upper_body';
  if (/\b(back|spine|lumbar)\b/.test(text)) return 'back_midline';
  if (/\b(hamstring|knee|ankle|calf|achilles|groin|adductor|hip|quad|shin|foot|pubalgia)\b/.test(text)) {
    return 'lower_body';
  }
  return 'other';
}

function injuryKeysFor(bodyPart: string, bucket?: string): InjuryKey[] {
  const text = `${bodyPart} ${bucket ?? ''}`.toLowerCase();
  const keys: InjuryKey[] = [];
  if (/\bhamstring|hammy\b/.test(text)) keys.push('hamstring');
  if (/\bknee|patella|acl|mcl|meniscus\b/.test(text)) keys.push('knee');
  if (/\bshoulder|rotator|pec\b/.test(text)) keys.push('shoulder');
  if (/\bankle|foot\b/.test(text)) keys.push('ankle');
  if (/\bcalf|achilles\b/.test(text)) keys.push('calf');
  if (/\bgroin|adductor\b/.test(text)) keys.push('adductor', 'pubalgia');
  if (/\blower back|lowerback|back|lumbar\b/.test(text)) keys.push('lowerBack');
  if (/\belbow\b/.test(text)) keys.push('elbow');
  if (/\bwrist\b/.test(text)) keys.push('wrist');
  return Array.from(new Set(keys));
}

function clampSeverity(severity: number): number {
  if (!Number.isFinite(severity)) return 1;
  return Math.min(10, Math.max(1, Math.round(severity)));
}

function capitalise(value: string): string {
  if (!value) return value;
  if (value === 'lowerBack') return 'Lower back';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
