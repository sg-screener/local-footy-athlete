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
import { deriveIllnessWeekDirective } from '../rules/illnessRecoveryWeekMode';
import {
  READINESS_TIERS,
  resolveReadinessDirective,
  type ReadinessTier,
} from '../rules/readinessIllnessLaw';
import type { TemporarySourceFact } from '../rules/temporarySourceFact';
import { constraintAppliesToDate } from './readinessConstraints';

/**
 * RETIRED (Sam's readiness law, 2026-07-27).
 *
 * The four-tier system — slight / moderate / major / full pause, each with its
 * own reductions — is gone down to the type. Readiness says one thing now:
 * DELOADED, or not.
 *
 * Every tier graduated on how much to CUT from the week, and the deload law
 * holds structure constant while the work inside shrinks — so there is nothing
 * left for a magnitude to express. The behavioural flags went with it:
 * avoidSprint and avoidHardConditioning are subsumed by "conditioning half, one
 * quality exposure max"; reduceHardExtras by the accessories rule;
 * preferRecovery died with recovery substitution.
 *
 * NOTE: readiness could also force a full pause. It cannot any more — the app
 * never empties a week on readiness alone. The §18 safety capability that
 * received it still exists as `safety.trainingPaused`, reachable only from
 * serious-injury symptoms or an explicit force.
 */

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

/**
 * The whole readiness answer downstream ever sees: the law's two flags.
 *
 * `severity` is DELIBERATELY ABSENT. Sam, 2026-07-27: "raw readiness severity
 * becomes private to the door that mints the directive. No module outside it
 * may read severity — downstream consumes only the two flags." Keeping the
 * number here "just for display" is exactly how the tier system regrew last
 * time: something graduates on it, then something else copies that.
 *
 * What the flags MEAN is owned by DELOAD_LAW, shared with the scheduled-deload
 * and illness doors, so readiness cannot grow a private dose.
 */
export interface GenerationReadinessConstraint {
  id: string;
  /** Only a fatigue signal reaches this door; time/schedule facts are session-scoped. */
  sourceType: 'fatigue';
  label?: string;
  /** The next 7 days are deloaded. Session COUNTS are untouched. */
  deloaded: boolean;
  /** "Absolutely cooked" — minimums lifted. Still not a removal. */
  sessionsOptional: boolean;
}

export interface GenerationConstraintContext {
  activeConstraintIds: string[];
  injuries: GenerationInjuryConstraint[];
  readiness?: GenerationReadinessConstraint;
  activeInjuryKeys: InjuryKey[];
  /**
   * §18 week mode minted by the single fact-reading owner
   * (`deriveIllnessRecoveryWeekMode`). Only the generation path supplies the
   * facts to derive it; the validation path preserves the mode off the built
   * contract instead of re-reading facts.
   */
  weekMode?: 'optional_week';
  /**
   * THE ILLNESS LAW's FIRST answer: is this week deloaded?
   *
   * Deliberately separate from `weekMode`, which carries the SECOND answer
   * (sessions optional). MODERATE illness sets this WITHOUT setting the mode —
   * it deloads a week whose minimums all stand — so one field could never have
   * carried both. The transformation itself is DELOAD_LAW's, applied through the
   * illness door, which has no phase gate (D16).
   */
  weekDeloaded?: boolean;
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
  /** Raw facts, supplied only by the generation path, to mint the week mode. */
  temporarySourceFacts?: readonly TemporarySourceFact[] | null;
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

  // ONE read of the facts produces BOTH of the law's answers. Asking twice is how
  // the deload and the optional stamp drift apart.
  const illness = args.temporarySourceFacts
    ? deriveIllnessWeekDirective({
        temporarySourceFacts: args.temporarySourceFacts,
        weekStartISO: args.todayISO.slice(0, 10),
      })
    : { deloaded: false, sessionsOptional: false };
  // BOTH doors answer the same two questions, so both feed the same two
  // outputs. "Absolutely cooked" and bed-bound illness produce an identical
  // week — nothing required, everything offered — and routing only one of them
  // through the optional week mode would leave the other with a planner-selected
  // CORE target it can never meet, which §18 rightly rejects.
  //
  // NAMING DEBT, deliberate and recorded: the mode is still called
  // `illness_recovery` while it now means "optional-only week" and can be minted
  // by readiness. Renaming it touches the §18 mode union, the subphase union and
  // the reduction reasons, so it is its own unit — not smuggled into this pass.
  const sessionsOptional = illness.sessionsOptional || readiness?.sessionsOptional === true;
  const weekMode = sessionsOptional ? ('optional_week' as const) : undefined;
  const weekDeloaded = illness.deloaded || readiness?.deloaded === true ? true : undefined;

  if (injuries.length === 0 && !readiness && !weekMode && !weekDeloaded) return undefined;
  return {
    activeConstraintIds: live.map((constraint) => constraint.id),
    injuries,
    readiness,
    activeInjuryKeys,
    weekMode,
    weekDeloaded,
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

/**
 * THE READINESS DOOR — the ONLY place a readiness/fatigue severity is read.
 *
 * "Raw severity is private to the door that mints the directive. No module
 * outside it may read severity — downstream consumes only the two flags."
 * (Sam, 2026-07-27.) Everything past this function sees `deloaded` and
 * `sessionsOptional`, so there is no number left downstream to graduate on and
 * the tier system cannot grow back.
 *
 * The strongest ACTIVE tier wins when several signals overlap, and "strongest"
 * is decided here, on the raw severity, before it goes private.
 */
function strongestReadinessConstraint(
  constraints: readonly ActiveConstraint[],
): GenerationReadinessConstraint | undefined {
  const ranked = constraints
    .map((constraint) => readinessTierFromConstraint(constraint))
    .filter((entry): entry is { constraint: ActiveConstraint; tier: ReadinessTier; rank: number } =>
      !!entry)
    .sort((a, b) => b.rank - a.rank);
  const strongest = ranked[0];
  if (!strongest) return undefined;
  const c = strongest.constraint as ActiveFatigueConstraint | ActiveScheduleConstraint;
  const directive = resolveReadinessDirective(strongest.tier);
  return {
    id: c.id,
    sourceType: 'fatigue',
    label: c.reasonLabel,
    deloaded: directive.deloaded,
    sessionsOptional: directive.sessionsOptional,
  };
}

/**
 * Classify a raw constraint into one of Sam's three readiness tiers.
 *
 * The thresholds are the door's own business and appear nowhere else. They
 * follow the shared health-fact boundary already used by every other signal:
 * below 4 is inert, and the top of the scale is the "absolutely cooked" call
 * that also lifts the minimums.
 */
function readinessTierFromConstraint(
  constraint: ActiveConstraint,
): { constraint: ActiveConstraint; tier: ReadinessTier; rank: number } | null {
  // FATIGUE ONLY. A schedule constraint is not a readiness declaration — "I have
  // 25 minutes on Wednesday" says nothing about how recovered the athlete is, and
  // reading its severity as a readiness magnitude let a busy day deload a whole
  // week. Time is a SESSION fact and shrinks its own session (see
  // `readinessConstraints`, `scheduleKind: 'time_cap'`).
  if (constraint.type !== 'fatigue') return null;
  const c = constraint as ActiveFatigueConstraint | ActiveScheduleConstraint;
  const severity = clampSeverity(c.severity);
  const tier: ReadinessTier = severity >= 8
    ? 'absolutely_cooked'
    : severity >= 4 ? 'wrecked' : 'tired';
  return { constraint, tier, rank: READINESS_TIERS.indexOf(tier) };
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
