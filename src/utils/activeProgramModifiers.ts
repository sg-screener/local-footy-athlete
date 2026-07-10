import {
  useCoachUpdatesStore,
  type ActiveConstraint,
  type ActiveConstraintModifierAffect,
  type ActiveEquipmentConstraint,
  type ActiveInjuryConstraint,
  type ActivePreferenceConstraint,
  type ActiveSorenessConstraint,
} from '../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import {
  useCoachPreferencesStore,
  type ModalityPreference,
} from '../store/coachPreferencesStore';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { useReadinessStore } from '../store/readinessStore';
import { removeInjuryOverridesFromDate } from './applyAdjustmentEvents';
import { getMondayForDate, getMondayStr } from './sessionResolver';
import { decideOverrideSweep } from './weekRebuild';
import { buildReadinessActiveConstraints } from './readinessConstraints';
import { todayISOLocal } from './appDate';
import { formatExerciseDisplayName } from './exerciseDisplay';
import { logger } from './logger';
import type { AthletePoolPrefs } from '../data/exercisePoolsStrength';
import type {
  OnboardingData,
  ProgramAvailabilityConstraint,
  WeekKind,
  Workout,
} from '../types/domain';
import type { InjuryState } from './injuryProgression';
import type { ReadinessSignal } from './readiness';

export type ActiveProgramModifierType =
  | 'injury'
  | 'temporary_status'
  | 'exercise_adjustment'
  | 'coach_restriction';

export type ActiveProgramModifierSource =
  | 'active_constraint'
  | 'legacy_active_injury'
  | 'athlete_preferences'
  | 'modality_preferences'
  | 'profile_availability'
  | 'readiness_signal'
  | 'week_kind';

export type ActiveProgramModifierActionKind =
  | 'clear_injury'
  | 'update_injury'
  | 'clear_status'
  | 'update_status'
  | 'clear_adjustment'
  | 'update_adjustment';

export type ActiveProgramModifierAffect = ActiveConstraintModifierAffect;

export interface ActiveProgramModifierAction {
  kind: ActiveProgramModifierActionKind;
  label: string;
}

export interface ActiveProgramModifier {
  id: string;
  source: ActiveProgramModifierSource;
  sourceId: string;
  type: ActiveProgramModifierType;
  title: string;
  body: string;
  severity?: number;
  actions: ActiveProgramModifierAction[];
  affects: ActiveProgramModifierAffect[];
  payload?: Record<string, unknown>;
}

export interface ActiveProgramModifierSnapshot {
  activeConstraints?: readonly ActiveConstraint[] | null;
  activeInjury?: InjuryState | null;
  athletePrefs?: AthletePoolPrefs | null;
  modalityPreferences?: Record<string, ModalityPreference> | null;
  onboardingData?: OnboardingData | null;
  readinessSignalsByDate?: Record<string, ReadinessSignal> | null;
  todayISO?: string;
  weekKind?: WeekKind | null;
  visibleWeekDays?: readonly ActiveProgramModifierVisibleDay[] | null;
}

export interface ActiveProgramModifierVisibleDay {
  date: string;
  dayOfWeek?: number;
  workout?: Pick<
    Workout,
    | 'name'
    | 'description'
    | 'workoutType'
    | 'sessionTier'
    | 'coachNotes'
    | 'exercises'
    | 'conditioningCategory'
    | 'conditioningFlavour'
    | 'hasCombinedConditioning'
    | 'speedBlock'
    | 'conditioningBlock'
    | 'recoveryAddons'
  > | null;
}

export interface ClearActiveProgramModifierResult {
  cleared: ActiveProgramModifier | null;
  remainingActiveCount: number;
  rebuildRequired: boolean;
}

function modifierId(source: ActiveProgramModifierSource, sourceId: string): string {
  return `program-modifier:${source}:${sourceId}`;
}

function capitaliseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function displayBodyPart(c: ActiveInjuryConstraint | ActiveSorenessConstraint): string {
  const raw = (c.bodyPart && c.bodyPart !== 'unknown' ? c.bodyPart : c.bucket) || 'injury';
  if (raw === 'adductor') return 'groin';
  if (raw === 'lowerBack') return 'lower back';
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function severityLabel(severity: number): string {
  if (severity >= 7) return 'High';
  if (severity >= 4) return 'Moderate';
  return 'Mild';
}

function sentence(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join(' ');
}

function listPreview(values: readonly string[] | undefined, fallback: string): string {
  if (!values || values.length === 0) return fallback;
  const preview = values.slice(0, 2).join('; ');
  return values.length > 2 ? `${preview}; more` : preview;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function equipmentLabel(tag: string): string {
  switch (tag) {
    case 'bodyweight':
      return 'bodyweight';
    case 'dumbbells':
      return 'dumbbell';
    case 'barbell':
      return 'barbell';
    case 'machine':
      return 'machine';
    case 'cables':
      return 'cable';
    case 'bands':
      return 'band';
    case 'kettlebell':
      return 'kettlebell';
    case 'bench':
      return 'bench';
    case 'bike_or_treadmill':
      return 'cardio machine';
    case 'foam_roller':
      return 'foam roller';
    default:
      return tag.replace(/[_-]+/g, ' ');
  }
}

function equipmentList(tags: readonly string[]): string {
  const labels = uniqueStrings(tags.map(equipmentLabel));
  if (labels.length === 0) return 'available equipment';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]}/${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function dayName(dateISO: string | undefined): string | null {
  if (!dateISO) return null;
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(y, m - 1, d, 12).getDay()
  ];
}

function isBeforeISO(left: string | undefined, right: string): boolean {
  if (!left) return false;
  return left < right;
}

function isAffect(value: unknown): value is ActiveProgramModifierAffect {
  return value === 'current_day' ||
    value === 'current_week' ||
    value === 'future_generation';
}

export function shouldCreateCoachNote(
  modifier: Pick<ActiveProgramModifier, 'affects'>,
): boolean {
  return modifier.affects.some(isAffect);
}

function modifierString(c: ActiveConstraint, key: 'modifierTitle' | 'modifierBody'): string | null {
  const value = (c as ActiveConstraint & Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function modifierAffects(
  c: ActiveConstraint,
  fallback: ActiveProgramModifierAffect[],
): ActiveProgramModifierAffect[] {
  const value = (c as ActiveConstraint & { modifierAffects?: unknown }).modifierAffects;
  if (!Array.isArray(value)) return fallback;
  const parsed = value.filter(isAffect);
  return parsed;
}

interface VisibleEffectSummary {
  changedNotes: string[];
  changedText: string;
  visibleText: string;
  hasRemoved: boolean;
  hasReplacement: boolean;
  hasCaution: boolean;
  hasSprint: boolean;
  hasCod: boolean;
  hasHinge: boolean;
  hasNordic: boolean;
  hasPressing: boolean;
  hasKneeDominant: boolean;
  hasJump: boolean;
  hasGroinAdductor: boolean;
  hasHardConditioning: boolean;
  hasAccessoryOrFinisher: boolean;
  hasRecoveryChange: boolean;
  hasSafeLowerBikeCore: boolean;
  hasSafeUpperBike: boolean;
}

function visibleEffects(days: readonly ActiveProgramModifierVisibleDay[]): VisibleEffectSummary {
  const notes = days.flatMap((day) => day.workout?.coachNotes ?? []);
  const changedNotes = notes.filter((note) =>
    /\b(Removed:|Replaced|Caution:|Lightened|Switched to recovery|Rebuilt for|limited|reduced)/i.test(note),
  );
  const changedText = changedNotes.join(' ').toLowerCase();
  const visibleText = days.map((day) => {
    const workout = day.workout;
    const exerciseNames = (workout?.exercises ?? [])
      .map((row: any) => row?.exercise?.name)
      .filter(Boolean)
      .join(' ');
    return [
      workout?.name,
      workout?.workoutType,
      workout?.sessionTier,
      exerciseNames,
      ...(workout?.coachNotes ?? []),
    ].filter(Boolean).join(' ');
  }).join(' ').toLowerCase();
  return {
    changedNotes,
    changedText,
    visibleText,
    hasRemoved: /\bremoved:/.test(changedText),
    hasReplacement: /\breplaced\b/.test(changedText),
    hasCaution: /\bcaution:|limited|reduced/.test(changedText),
    hasSprint: /\b(sprints?|speed|high[-\s]?speed|flying\s*\d|running)\b/.test(changedText),
    hasCod: /\b(change of direction|cod|cutting|agility)\b/.test(changedText),
    hasHinge: /\b(hinge|deadlift|rdl|trap bar|posterior chain)\b/.test(changedText),
    hasNordic: /\b(nordic|hamstring curl|hamstring)\b/.test(changedText),
    hasPressing: /\b(press|bench|overhead|dip|push[-\s]?up|push)\b/.test(changedText),
    hasKneeDominant: /\b(squat|lunge|split squat|step[-\s]?down|knee)\b/.test(changedText),
    hasJump: /\b(jump|plyo|bound|hop)\b/.test(changedText),
    hasGroinAdductor: /\b(groin|adductor|copenhagen|lateral|cutting|change of direction|cod)\b/.test(changedText),
    hasHardConditioning: /\b(hard conditioning|conditioning|interval|metcon|sprint|speed|hard erg|assault bike)\b/.test(changedText),
    hasAccessoryOrFinisher: /\b(accessor|finisher|extra|optional|volume|sets|lightened|caution:)\b/.test(changedText),
    hasRecoveryChange: /\b(recovery|switched to recovery|rest|easy aerobic|easy conditioning|mobility)\b/.test(changedText),
    hasSafeLowerBikeCore: /\b(lower|squat|hinge|bike|core|trunk)\b/.test(visibleText),
    hasSafeUpperBike: /\b(upper|bench|row|pull|press|bike|off[-\s]?feet|core|trunk)\b/.test(visibleText),
  };
}

function hasLinkedProgramEffect(c: ActiveConstraint): boolean {
  return linkedOverrideDates(c).length > 0;
}

function hasAnyVisibleEffect(summary: VisibleEffectSummary): boolean {
  return summary.changedNotes.length > 0;
}

function effectSentence(parts: string[]): string {
  return parts.map((part) => `${part}.`).join(' ');
}

function deterministicInjuryBody(
  c: ActiveInjuryConstraint,
  summary: VisibleEffectSummary,
): string | null {
  if (!hasAnyVisibleEffect(summary)) return null;
  const bucket = String(c.bucket || c.bodyPart || '').toLowerCase();
  const bodyPart = capitaliseWords(displayBodyPart(c));
  const effects: string[] = [];
  const paused = c.adjustmentLevel === 'training_paused' || c.seriousSymptoms === true || c.severity >= 8;

  if (paused && (summary.hasRemoved || summary.hasRecoveryChange)) {
    effects.push('affected training was paused or reduced');
  }
  if (bucket.includes('hamstring')) {
    if (summary.hasSprint) effects.push('sprinting was reduced');
    if (summary.hasHinge || summary.hasNordic) effects.push('heavy hinging or Nordics were reduced');
  } else if (bucket.includes('adductor') || bucket.includes('groin')) {
    if (summary.hasCod || summary.hasGroinAdductor) effects.push('COD, adductor or lateral work was reduced');
  } else if (bucket.includes('shoulder')) {
    if (summary.hasPressing) effects.push('pressing or overhead work was reduced or swapped');
  } else if (bucket.includes('knee')) {
    if (summary.hasKneeDominant || summary.hasCod || summary.hasJump) {
      effects.push('knee-dominant, jumping or COD work was reduced');
    }
  }

  if (summary.hasReplacement && effects.length === 0) {
    effects.push('affected exercises were swapped');
  }
  if ((summary.hasRemoved || summary.hasCaution) && effects.length === 0) {
    effects.push('affected work was reduced');
  }
  if (effects.length === 0) return null;

  const safeLine =
    bucket.includes('shoulder') && summary.hasSafeLowerBikeCore
      ? 'Lower-body, bike or core work stayed in where safe.'
      : (bucket.includes('hamstring') || bucket.includes('knee') || bucket.includes('adductor') || bucket.includes('groin')) && summary.hasSafeUpperBike
        ? 'Upper-body, bike or core work stayed in where safe.'
        : '';

  return sentence([
    `${bodyPart} issue active.`,
    effectSentence(effects),
    safeLine,
  ]);
}

function deterministicReadinessBody(
  c: Exclude<ActiveConstraint, ActiveInjuryConstraint | ActivePreferenceConstraint>,
  summary: VisibleEffectSummary,
): string | null {
  const linkedEffect = hasLinkedProgramEffect(c as ActiveConstraint);
  if (!hasAnyVisibleEffect(summary) && !linkedEffect) return null;
  if (c.type === 'missed_session') return null;
  if (linkedEffect && !hasAnyVisibleEffect(summary)) {
    return modifierString(c as ActiveConstraint, 'modifierBody') ?? 'Your program was changed for recovery or load management.';
  }

  const parts: string[] = [];
  if (summary.hasRecoveryChange) {
    parts.push('training was changed to recovery or easy work');
  }
  if (summary.hasHardConditioning || summary.hasSprint) {
    parts.push('hard conditioning or sprint work was reduced');
  }
  if (summary.hasAccessoryOrFinisher || summary.hasCaution) {
    parts.push('extras, accessories or intensity were trimmed');
  }
  if (summary.hasRemoved && parts.length === 0) {
    parts.push('hard work was reduced');
  }
  if (parts.length === 0) return null;

  if (c.type === 'soreness') {
    return sentence([
      `${capitaliseWords(displayBodyPart(c))} soreness active.`,
      effectSentence(parts),
      'Pain-free work stayed in where possible.',
    ]);
  }

  const title = modifierString(c as ActiveConstraint, 'modifierTitle') ?? c.reasonLabel ?? '';
  const isFlat = c.type === 'fatigue' && (c.severity <= 3 || /flat|feeling flat/i.test(title));
  const isCooked = c.type === 'fatigue' && (c.severity >= 7 || /cooked|load reduced/i.test(title));
  const lead = isCooked
    ? "You said you're cooked."
    : isFlat
      ? "You said you're flat today."
      : 'Readiness adjustment active.';
  return sentence([lead, effectSentence(parts)]);
}

function proofGateInjuryModifier(
  modifier: ActiveProgramModifier,
  c: ActiveInjuryConstraint,
  visibleWeekDays: readonly ActiveProgramModifierVisibleDay[] | null | undefined,
): ActiveProgramModifier | null {
  if (!visibleWeekDays) return modifier;
  const body = deterministicInjuryBody(c, visibleEffects(visibleWeekDays));
  if (!body) return null;
  return { ...modifier, body };
}

function proofGateReadinessModifier(
  modifier: ActiveProgramModifier | null,
  c: Exclude<ActiveConstraint, ActiveInjuryConstraint | ActivePreferenceConstraint>,
  visibleWeekDays: readonly ActiveProgramModifierVisibleDay[] | null | undefined,
): ActiveProgramModifier | null {
  if (!modifier) return null;
  if (!visibleWeekDays || (c.type !== 'fatigue' && c.type !== 'soreness')) return modifier;
  const body = deterministicReadinessBody(c, visibleEffects(visibleWeekDays));
  if (!body) return null;
  return { ...modifier, body };
}

interface DeloadVisibleEvidence {
  weekStart: string;
  proofText: string;
  hasReductionProof: boolean;
  hasMainStrengthPreserved: boolean;
  hasSetsReduced: boolean;
  hasLoadOrIntensityReduced: boolean;
  hasAccessoriesTrimmed: boolean;
  hasHardConditioningRemoved: boolean;
  hasSprintIntensityRemoved: boolean;
  hasEasyRecoveryPreserved: boolean;
}

function workoutText(day: ActiveProgramModifierVisibleDay): string {
  const workout = day.workout;
  if (!workout) return '';
  const exerciseText = (workout.exercises ?? []).map((row: any) => [
    row?.exercise?.name,
    row?.exerciseId,
    row?.notes,
    row?.prescriptionType,
    typeof row?.prescribedSets === 'number' ? `${row.prescribedSets} sets` : null,
    typeof row?.prescribedWeightKg === 'number' ? `${row.prescribedWeightKg} kg` : null,
  ].filter(Boolean).join(' '));
  const conditioningText = [
    workout.conditioningCategory,
    workout.conditioningFlavour,
    workout.hasCombinedConditioning ? 'combined conditioning' : null,
    workout.speedBlock?.title,
    workout.speedBlock?.label,
    workout.speedBlock?.prescription,
    ...(workout.speedBlock?.notes ?? []),
    ...(workout.conditioningBlock?.options ?? []).flatMap((option) => [
      option.title,
      option.description,
    ]),
    ...(workout.recoveryAddons ?? []).flatMap((addon) => [
      addon.title,
      addon.label,
      addon.focusArea,
      addon.placementNote,
    ]),
  ];
  return [
    workout.name,
    workout.description,
    workout.workoutType,
    workout.sessionTier,
    ...(workout.coachNotes ?? []),
    ...exerciseText,
    ...conditioningText,
  ].filter(Boolean).join(' ');
}

function visibleDeloadEvidence(
  days: readonly ActiveProgramModifierVisibleDay[],
): DeloadVisibleEvidence {
  const proofText = days.map(workoutText).join(' ').toLowerCase();
  const weekStart = days[0]?.date ?? todayISOLocal();
  const hasDeloadMarker = /\bdeload\b|lighter week|lower fatigue/.test(proofText);
  const hasMainStrengthPreserved =
    /\b(squat|deadlift|trap bar|rdl|hinge|bench|press|row|pull[-\s]?up|split squat|lunge|hip thrust)\b/.test(proofText) &&
    !/\b(training paused|full pause|bedridden)\b/.test(proofText);
  const hasSetsReduced =
    /\b(sets?|volume)\b[^.]*\b(reduced|trimmed|lowered|pulled back|dropped)\b/.test(proofText) ||
    /\b(reduced|trimmed|lowered|pulled back|dropped)\b[^.]*\b(sets?|volume)\b/.test(proofText);
  const hasLoadOrIntensityReduced =
    /\b(load|intensity|rpe|effort)\b[^.]*\b(reduced|lowered|capped|controlled|pulled back|6-\d|leave reps in reserve)\b/.test(proofText) ||
    /\b(reduced|lowered|capped|controlled|pulled back)\b[^.]*\b(load|intensity|rpe|effort)\b/.test(proofText) ||
    /\bdeload week:\s*keep rpe\b/.test(proofText);
  const hasAccessoriesTrimmed =
    /\b(accessor(?:y|ies)|finisher|extras?|optional)\b[^.]*\b(removed|trimmed|reduced|dropped|pulled back)\b/.test(proofText) ||
    /\b(removed|trimmed|reduced|dropped|pulled back)\b[^.]*\b(accessor(?:y|ies)|finisher|extras?|optional)\b/.test(proofText);
  const hasHardConditioningRemoved =
    /\b(hard conditioning|conditioning|intervals?|metcon|assault bike)\b[^.]*\b(removed|trimmed|reduced|dropped|out)\b/.test(proofText) ||
    /\b(removed|trimmed|reduced|dropped|no)\b[^.]*\b(hard conditioning|conditioning|intervals?|metcon|assault bike)\b/.test(proofText);
  const hasSprintIntensityRemoved =
    /\b(sprint|speed|cod|change of direction|vo2|glycolytic|repeated sprint)\b[^.]*\b(removed|trimmed|reduced|dropped|out)\b/.test(proofText) ||
    /\b(removed|trimmed|reduced|dropped|no)\b[^.]*\b(sprint|speed|cod|change of direction|vo2|glycolytic|repeated sprint)\b/.test(proofText);
  const hasEasyRecoveryPreserved =
    /\b(easy|recovery|mobility|flush|zone 2|aerobic|tempo)\b/.test(proofText);

  return {
    weekStart,
    proofText,
    hasReductionProof: hasDeloadMarker && (
      hasSetsReduced ||
      hasLoadOrIntensityReduced ||
      hasAccessoriesTrimmed ||
      hasHardConditioningRemoved ||
      hasSprintIntensityRemoved
    ),
    hasMainStrengthPreserved,
    hasSetsReduced,
    hasLoadOrIntensityReduced,
    hasAccessoriesTrimmed,
    hasHardConditioningRemoved,
    hasSprintIntensityRemoved,
    hasEasyRecoveryPreserved,
  };
}

function deloadBody(evidence: DeloadVisibleEvidence): string | null {
  if (!evidence.hasReductionProof) return null;
  const lines: string[] = ['This is a deload week.'];
  if (evidence.hasMainStrengthPreserved) {
    lines.push('Main strength patterns stay in.');
  }
  if (evidence.hasSetsReduced) {
    lines.push('Sets or volume are reduced.');
  }
  if (evidence.hasLoadOrIntensityReduced) {
    lines.push('Load or intensity is pulled back.');
  }
  if (evidence.hasAccessoriesTrimmed) {
    lines.push('Accessories or finishers are trimmed.');
  }
  if (evidence.hasSprintIntensityRemoved) {
    lines.push('Sprint, VO2 or glycolytic work is out this week.');
  } else if (evidence.hasHardConditioningRemoved) {
    lines.push('Hard conditioning is out this week.');
  }
  if (evidence.hasEasyRecoveryPreserved) {
    lines.push('Easy recovery work stays in.');
  }
  return lines.join(' ');
}

function deloadWeekModifier(
  snapshot: ActiveProgramModifierSnapshot,
): ActiveProgramModifier | null {
  if (snapshot.weekKind !== 'deload' || !snapshot.visibleWeekDays?.length) return null;
  const evidence = visibleDeloadEvidence(snapshot.visibleWeekDays);
  const body = deloadBody(evidence);
  if (!body) return null;
  return {
    id: modifierId('week_kind', `deload:${evidence.weekStart}`),
    source: 'week_kind',
    sourceId: `deload:${evidence.weekStart}`,
    type: 'temporary_status',
    title: 'Deload week active',
    body,
    affects: ['current_week'],
    actions: [],
    payload: {
      weekKind: 'deload',
      weekStart: evidence.weekStart,
      lifecycleKey: `week_kind:deload:${evidence.weekStart}`,
    },
  };
}

function linkedOverrideDates(c: ActiveConstraint | null | undefined): string[] {
  const value = (c as any)?.linkedOverrideDates;
  if (!Array.isArray(value)) return [];
  return value.filter((date): date is string => typeof date === 'string' && !!date);
}

function expiresAt(c: ActiveConstraint | null | undefined): string | undefined {
  const value = (c as any)?.expiresAt;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isExpiredActiveConstraint(c: ActiveConstraint, todayISO: string): boolean {
  const end = expiresAt(c);
  return Boolean(end && end < todayISO);
}

function weekStartFromVisibleDays(
  days: readonly ActiveProgramModifierVisibleDay[] | null | undefined,
): string | null {
  const firstDate = days?.find((day) => typeof day.date === 'string' && day.date.trim())?.date;
  return firstDate ? getMondayForDate(firstDate) : null;
}

function workoutLifecycleLabel(day: ActiveProgramModifierVisibleDay | undefined): string {
  const workout = day?.workout;
  if (!workout) return 'Off';
  if (workout.workoutType === 'Game') return 'Game Day';
  return workout.name?.trim() || 'Off';
}

function gameChangeProofStillVisible(
  c: ActiveConstraint,
  days: readonly ActiveProgramModifierVisibleDay[] | null | undefined,
): boolean {
  const proof = (c as any)?.noteProof;
  if (!days || proof?.kind !== 'game_change' || !Array.isArray(proof.after)) return true;
  const visibleByDate = new Map(days.map((day) => [day.date, day]));
  return proof.after.every((row: any) => {
    if (typeof row?.date !== 'string') return false;
    const visible = visibleByDate.get(row.date);
    if (!visible) return false;
    const expectedLabel = row.workoutType === 'Game'
      ? 'Game Day'
      : (typeof row.workoutName === 'string' && row.workoutName.trim() ? row.workoutName.trim() : 'Off');
    if (workoutLifecycleLabel(visible) !== expectedLabel) return false;
    const visibleType = visible.workout?.workoutType ?? null;
    return (row.workoutType ?? null) === visibleType;
  });
}

function activeConstraintVisibleInSnapshot(
  c: ActiveConstraint,
  snapshot: ActiveProgramModifierSnapshot,
): boolean {
  const weekStartISO = (c as any)?.weekStartISO;
  const visibleWeekStart = weekStartFromVisibleDays(snapshot.visibleWeekDays);
  if (typeof weekStartISO === 'string' && weekStartISO.trim() && visibleWeekStart && weekStartISO !== visibleWeekStart) {
    return false;
  }
  return gameChangeProofStillVisible(c, snapshot.visibleWeekDays);
}

function activeConstraintLifecycleKey(
  c: ActiveConstraint,
  source: ActiveProgramModifierSource,
): string {
  const proofKey = (c as any)?.noteProof?.lifecycleKey;
  if (typeof proofKey === 'string' && proofKey.trim()) return `${source}:${proofKey}`;
  const weekStartISO = (c as any)?.weekStartISO;
  if (c.type === 'schedule' && typeof weekStartISO === 'string' && weekStartISO.trim()) {
    const owner = String((c as any).source ?? c.type);
    return `${source}:${owner}:${weekStartISO}`;
  }
  return `${source}:${c.id}`;
}

export interface RebuildOverrideSweepResult {
  cleared: string[];
  preserved: string[];
  /** User edits removed because they conflicted with new game protection. */
  conflictsRemoved: Array<{ date: string; name: string }>;
}

/**
 * Rebuild-safe manual-override sweep — thin store-mutating wrapper around
 * the ONE canonical, pure sweep policy in `weekRebuild.decideOverrideSweep`
 * (preserve modifier-owned + user manual edits; clear system junk; resolve
 * game-window conflicts out loud). Kept for existing callers; new rebuild
 * code should go through `weekRebuild.rebuildLocalWeek` instead.
 */
export function clearManualOverridesPreservingActiveModifiers(
  todayISO: string = todayISOLocal(),
  opts: { gameDates?: string[] } = {},
): RebuildOverrideSweepResult {
  const program = useProgramStore.getState();
  const decision = decideOverrideSweep({
    gameDates: opts.gameDates ?? [],
    overrides: program.dateOverrides ?? {},
    overrideContexts: program.overrideContexts ?? {},
    activeConstraintIds: new Set(
      (useCoachUpdatesStore.getState().activeConstraints ?? [])
        .filter((c) => !isExpiredActiveConstraint(c, todayISO))
        .map((c) => c.id),
    ),
  });
  for (const date of decision.clear) {
    program.removeManualOverride(date);
  }
  logger.debug('[active-program-modifiers] rebuild override sweep', decision);
  return {
    cleared: decision.clear,
    preserved: decision.preserve,
    conflictsRemoved: decision.conflictsRemoved,
  };
}

function isActiveAvailabilityConstraint(
  constraint: ProgramAvailabilityConstraint,
  todayISO: string,
): boolean {
  if (constraint.active === false) return false;
  if (constraint.scope === 'temporary' && isBeforeISO(constraint.endDate, todayISO)) {
    return false;
  }
  return true;
}

function legacyActiveInjuryConstraint(injury: InjuryState): ActiveInjuryConstraint {
  return {
    id: `injury-${(injury.bucket || injury.bodyPart || 'unknown').toLowerCase()}`,
    type: 'injury',
    bodyPart: injury.bodyPart,
    bucket: injury.bucket,
    severity: injury.severity,
    status: injury.status,
    startDate: injury.startDate,
    lastUpdatedAt: injury.lastUpdatedAt,
    rules: Array.isArray(injury.rules) ? [...injury.rules] : [],
    safeFocus: [],
    advice: [],
    modifierAffects: ['current_week', 'future_generation'],
  };
}

function injuryModifier(
  c: ActiveInjuryConstraint,
  source: ActiveProgramModifierSource,
): ActiveProgramModifier {
  const bodyPart = displayBodyPart(c);
  const displayPart = capitaliseWords(bodyPart);
  const limits = listPreview(c.rules, 'training around this area');
  const isSerious = c.seriousSymptoms === true || c.adjustmentLevel === 'training_paused';
  const fallbackBody = isSerious
    ? "You rated this as 8-10 / 10, so affected training is paused until you're ready or cleared to train."
    : sentence([
        'Your program is being adjusted around this injury.',
        `${severityLabel(c.severity)} ${c.severity}/10.`,
        `Limits: ${limits}.`,
      ]);
  return {
    id: modifierId(source, c.id),
    source,
    sourceId: c.id,
    type: 'injury',
    title: c.modifierTitle ?? (isSerious ? 'Training paused for injury' : `${displayPart} issue active`),
    body: c.modifierBody ?? fallbackBody,
    severity: c.severity,
    affects: source === 'legacy_active_injury'
      ? ['current_week', 'future_generation']
      : modifierAffects(c, []),
    actions: [
      { kind: 'clear_injury', label: isSerious ? "I've been cleared" : "I'm all good now" },
      { kind: 'update_injury', label: isSerious ? 'Update issue' : 'Update injury' },
    ],
    payload: {
      constraintId: c.id,
      lifecycleKey: activeConstraintLifecycleKey(c, source),
      bodyPart: c.bodyPart,
      region: c.region,
      severityBand: c.severityBand,
      adjustmentLevel: c.adjustmentLevel,
      triggers: c.triggers ?? [],
      seriousSymptoms: c.seriousSymptoms ?? false,
    },
  };
}

function statusModifier(
  c: Exclude<ActiveConstraint, ActiveInjuryConstraint | ActivePreferenceConstraint>,
  source: ActiveProgramModifierSource,
): ActiveProgramModifier | null {
  if (c.type === 'missed_session') return null;
  const rules = 'rules' in c ? c.rules : [];
  const focus = 'safeFocus' in c ? c.safeFocus : [];
  const isCoachRestriction = c.type === 'schedule';
  const isSoreness = c.type === 'soreness';
  const fallbackTitle = c.type === 'fatigue'
    ? 'Recovery mode active'
    : isSoreness
      ? `${capitaliseWords(displayBodyPart(c))} soreness active`
      : c.reasonLabel || 'Program adjustment active';
  const fallbackBody = c.type === 'fatigue'
    ? sentence([
        'Your training load is reduced while you recover.',
        `Limits: ${listPreview(rules, 'extra hard work')}.`,
      ])
    : isSoreness
      ? sentence([
          `Your program is managing soreness around ${displayBodyPart(c)}.`,
          `Keep: ${listPreview(focus, 'pain-free work')}.`,
        ])
      : sentence([
          `Your program is being adjusted around this constraint.`,
          `Limits: ${listPreview(rules, 'normal loading')}.`,
        ]);
  const sourceConstraint = c as ActiveConstraint;

  return {
    id: modifierId(source, c.id),
    source,
    sourceId: c.id,
    type: isCoachRestriction ? 'coach_restriction' : 'temporary_status',
    title: modifierString(sourceConstraint, 'modifierTitle') ?? fallbackTitle,
    body: modifierString(sourceConstraint, 'modifierBody') ?? fallbackBody,
    severity: 'severity' in c ? c.severity : undefined,
    affects: modifierAffects(sourceConstraint, []),
    actions: isCoachRestriction
      ? [
          { kind: 'clear_adjustment', label: 'Clear adjustment' },
          { kind: 'update_adjustment', label: 'Update' },
        ]
      : [
          { kind: 'clear_status', label: "I'm good now" },
          { kind: 'update_status', label: 'Update status' },
        ],
    payload: {
      constraintId: c.id,
      lifecycleKey: activeConstraintLifecycleKey(sourceConstraint, source),
      date: 'appliesToDate' in c ? c.appliesToDate : undefined,
      expiresAt: expiresAt(sourceConstraint),
      overrideDates: linkedOverrideDates(sourceConstraint),
    },
  };
}

function equipmentHasVisibleProof(
  c: ActiveEquipmentConstraint,
  visibleWeekDays: readonly ActiveProgramModifierVisibleDay[] | null | undefined,
): boolean {
  if (!visibleWeekDays?.length) return false;
  const equipmentText = uniqueStrings([
    ...c.tags.map(equipmentLabel),
    c.mode === 'without' ? 'without' : 'only',
  ]).join('|');
  const tagPattern = equipmentText ? new RegExp(`\\b(${equipmentText})\\b`, 'i') : null;
  return visibleWeekDays.some((day) => {
    const text = workoutText(day);
    if (!text) return false;
    const hasAdjustment = /\b(replaced|swapped|removed|limited|available equipment|bodyweight|dumbbell|barbell|machine|cable|band)\b/i.test(text);
    return hasAdjustment && (!tagPattern || tagPattern.test(text));
  });
}

function equipmentModifierBody(
  c: ActiveEquipmentConstraint,
  affects: readonly ActiveProgramModifierAffect[],
  visibleProof: boolean,
): string {
  const endDay = dayName(expiresAt(c));
  const hasFuture = affects.includes('future_generation');
  const hasCurrent = affects.includes('current_week') || affects.includes('current_day');
  const until = endDay ? ` until ${endDay}` : '';

  if (c.mode === 'only') {
    const allowed = uniqueStrings(['bodyweight', ...c.tags]);
    const bodyweightOnly = allowed.length === 1 && allowed[0] === 'bodyweight';
    if (bodyweightOnly) {
      return endDay
        ? `Bodyweight-only training active until ${endDay}.`
        : 'Bodyweight-only training stays active until you clear this.';
    }

    const options = equipmentList(allowed);
    if (visibleProof) {
      return `Limited equipment active. Visible sessions are using ${options} options where needed.`;
    }
    if (hasFuture && !hasCurrent) {
      return `Limited equipment active. Future sessions will use ${options} options until you clear this.`;
    }
    return `Limited equipment active. Sessions will use ${options} options${until || ' this week'}.`;
  }

  const unavailable = uniqueStrings(c.tags.filter((tag) => tag !== 'bodyweight'));
  const blocked = equipmentList(unavailable);
  if (visibleProof) {
    return `Limited equipment active. Visible sessions are avoiding ${blocked} where needed.`;
  }
  if (hasFuture && !hasCurrent) {
    return `Limited equipment active. Future sessions will avoid ${blocked} until you clear this.`;
  }
  if (unavailable.length === 1) {
    const label = equipmentLabel(unavailable[0]);
    return `No ${label} available. ${capitaliseWords(label)} lifts will be swapped where needed.`;
  }
  return `Limited equipment active. Sessions will avoid ${blocked} where needed${until || ' this week'}.`;
}

function equipmentModifier(
  c: ActiveEquipmentConstraint,
  source: ActiveProgramModifierSource = 'active_constraint',
  visibleWeekDays?: readonly ActiveProgramModifierVisibleDay[] | null,
): ActiveProgramModifier {
  const affects = modifierAffects(c, []);
  const unavailable = uniqueStrings(c.tags.filter((tag) => tag !== 'bodyweight'));
  const allowed = uniqueStrings(['bodyweight', ...c.tags]);
  const title = c.mode === 'only' && allowed.length === 1 && allowed[0] === 'bodyweight'
    ? 'Bodyweight-only training active'
    : c.mode === 'without' && unavailable.length === 1
      ? `No ${equipmentLabel(unavailable[0])} available`
      : 'Limited equipment active';

  return {
    id: modifierId(source, c.id),
    source,
    sourceId: c.id,
    type: 'coach_restriction',
    title: modifierString(c, 'modifierTitle') ?? title,
    body: modifierString(c, 'modifierBody') ??
      equipmentModifierBody(c, affects, equipmentHasVisibleProof(c, visibleWeekDays)),
    severity: c.severity,
    affects,
    actions: [
      { kind: 'clear_adjustment', label: 'Clear adjustment' },
      { kind: 'update_adjustment', label: 'Update' },
    ],
    payload: {
      constraintId: c.id,
      lifecycleKey: activeConstraintLifecycleKey(c, source),
      mode: c.mode,
      tags: [...c.tags],
      expiresAt: expiresAt(c),
      rebuildRequired: true,
    },
  };
}

function preferenceModifier(
  c: ActivePreferenceConstraint,
  source: ActiveProgramModifierSource = 'active_constraint',
): ActiveProgramModifier {
  const exercise = formatExerciseDisplayName(c.exercise);
  const alternative = formatExerciseDisplayName(c.alternative);
  const focus = formatExerciseDisplayName(c.focus);
  const title = c.preferenceKind === 'avoid_exercise' && c.exercise
    ? `${exercise} adjustment active`
    : c.preferenceKind === 'preferred_alternative' && c.exercise
      ? `${exercise} adjustment active`
      : c.preferenceKind === 'add_focus' && c.focus
        ? `Extra ${focus} preference active`
        : 'Exercise adjustment active';
  const body = c.preferenceKind === 'avoid_exercise' && c.exercise
    ? `Similar sessions will avoid ${exercise}.`
    : c.preferenceKind === 'preferred_alternative' && c.exercise
      ? `Similar sessions will avoid or replace ${exercise}${alternative ? ` with ${alternative}` : ''}.`
      : focus
        ? `Future generated sessions can prioritise ${focus}.`
        : c.label || 'Future generated sessions will use this preference.';

  return {
    id: modifierId(source, c.id),
    source,
    sourceId: c.id,
    type: 'exercise_adjustment',
    title,
    body,
    affects: ['future_generation'],
    actions: [
      { kind: 'clear_adjustment', label: 'Clear adjustment' },
      { kind: 'update_adjustment', label: 'Update' },
    ],
    payload: {
      constraintId: c.id,
      lifecycleKey: activeConstraintLifecycleKey(c, source),
      exercise: c.exercise,
      alternative: c.alternative,
      focus: c.focus,
    },
  };
}

function athletePreferenceModifier(
  kind: 'excluded' | 'pinned',
  exercise: string,
): ActiveProgramModifier {
  const sourceId = `${kind}:${exercise}`;
  const displayExercise = formatExerciseDisplayName(exercise);
  return {
    id: modifierId('athlete_preferences', sourceId),
    source: 'athlete_preferences',
    sourceId,
    type: 'exercise_adjustment',
    title: kind === 'excluded'
      ? `${displayExercise} adjustment active`
      : `${displayExercise} preference active`,
    body: kind === 'excluded'
      ? `Future generated sessions will avoid ${displayExercise}.`
      : `Future generated sessions can prioritise ${displayExercise}.`,
    affects: ['future_generation'],
    actions: [
      { kind: 'clear_adjustment', label: 'Clear adjustment' },
      { kind: 'update_adjustment', label: 'Update' },
    ],
    payload: { kind, exercise },
  };
}

function prettyModality(value: string | null | undefined, bikeLabel?: string | null): string {
  if (!value) return 'conditioning';
  if (value === 'bike') return bikeLabel || 'bike';
  if (value === 'ski') return 'SkiErg';
  if (value === 'row') return 'rower';
  return value;
}

function prettySessionKey(key: string): string {
  return capitaliseWords(key.replace(/[-_]+/g, ' '));
}

function modalityModifier(
  key: string,
  pref: ModalityPreference,
): ActiveProgramModifier {
  const to = prettyModality(pref.to, pref.bikeLabel);
  const from = pref.from ? prettyModality(pref.from) : null;
  return {
    id: modifierId('modality_preferences', key),
    source: 'modality_preferences',
    sourceId: key,
    type: 'exercise_adjustment',
    title: `${prettySessionKey(key)} adjustment active`,
    body: from
      ? `Similar sessions will use ${to} instead of ${from}.`
      : `Similar conditioning slots will use ${to}.`,
    affects: ['current_week', 'future_generation'],
    actions: [
      { kind: 'clear_adjustment', label: 'Clear adjustment' },
      { kind: 'update_adjustment', label: 'Update' },
    ],
    payload: { sessionKey: key },
  };
}

function availabilityModifier(
  constraint: ProgramAvailabilityConstraint,
): ActiveProgramModifier | null {
  if (constraint.kind === 'unavailable_day' && constraint.dayOfWeek) {
    return {
      id: modifierId('profile_availability', constraint.id),
      source: 'profile_availability',
      sourceId: constraint.id,
      type: 'coach_restriction',
      title: `${constraint.dayOfWeek} unavailable`,
      body: `Your program is avoiding training on ${constraint.dayOfWeek}.`,
      affects: ['future_generation'],
      actions: [
        { kind: 'clear_adjustment', label: 'Clear' },
        { kind: 'update_adjustment', label: 'Update' },
      ],
      payload: { availabilityConstraintId: constraint.id },
    };
  }
  if (constraint.kind === 'time_limit' && constraint.dayOfWeek && constraint.maxSessionMinutes) {
    return {
      id: modifierId('profile_availability', constraint.id),
      source: 'profile_availability',
      sourceId: constraint.id,
      type: 'coach_restriction',
      title: `${constraint.dayOfWeek} time cap active`,
      body: `${constraint.dayOfWeek} sessions are capped at ${constraint.maxSessionMinutes} minutes.`,
      affects: ['future_generation'],
      actions: [
        { kind: 'clear_adjustment', label: 'Clear' },
        { kind: 'update_adjustment', label: 'Update' },
      ],
      payload: { availabilityConstraintId: constraint.id },
    };
  }
  if (constraint.kind === 'travel') {
    return {
      id: modifierId('profile_availability', constraint.id),
      source: 'profile_availability',
      sourceId: constraint.id,
      type: 'coach_restriction',
      title: 'Travel adjustment active',
      body: "Your program is reducing or avoiding sessions while you're away.",
      affects: ['future_generation'],
      actions: [
        { kind: 'clear_adjustment', label: 'Clear' },
        { kind: 'update_adjustment', label: 'Update' },
      ],
      payload: { availabilityConstraintId: constraint.id },
    };
  }
  return null;
}

function addUnique(
  out: ActiveProgramModifier[],
  seen: Set<string>,
  modifier: ActiveProgramModifier | null,
) {
  if (!modifier || seen.has(modifier.id) || !shouldCreateCoachNote(modifier)) return;
  seen.add(modifier.id);
  out.push(modifier);
}

export function selectActiveProgramModifiers(
  snapshot: ActiveProgramModifierSnapshot,
): ActiveProgramModifier[] {
  const todayISO = snapshot.todayISO ?? todayISOLocal();
  const out: ActiveProgramModifier[] = [];
  const seen = new Set<string>();
  const activeConstraints = [...(snapshot.activeConstraints ?? [])]
    .filter((constraint) => !isExpiredActiveConstraint(constraint, todayISO));

  if (
    snapshot.activeInjury &&
    snapshot.activeInjury.status !== 'resolved' &&
    !activeConstraints.some((c) => c.type === 'injury' && c.status !== 'resolved')
  ) {
    addUnique(
      out,
      seen,
      proofGateInjuryModifier(
        injuryModifier(
          legacyActiveInjuryConstraint(snapshot.activeInjury),
          'legacy_active_injury',
        ),
        legacyActiveInjuryConstraint(snapshot.activeInjury),
        snapshot.visibleWeekDays,
      ),
    );
  }

  const activePreferenceExercises = new Set<string>();
  const activePreferenceAlternatives = new Set<string>();

  for (const constraint of activeConstraints) {
    if (!constraint || constraint.status === 'resolved') continue;
    if (!activeConstraintVisibleInSnapshot(constraint, snapshot)) continue;
    if (constraint.type === 'injury') {
      addUnique(
        out,
        seen,
        proofGateInjuryModifier(
          injuryModifier(constraint, 'active_constraint'),
          constraint,
          snapshot.visibleWeekDays,
        ),
      );
    } else if (constraint.type === 'preference') {
      if (constraint.exercise) activePreferenceExercises.add(constraint.exercise);
      if (constraint.alternative) activePreferenceAlternatives.add(constraint.alternative);
      addUnique(out, seen, preferenceModifier(constraint));
    } else if (constraint.type === 'equipment') {
      addUnique(out, seen, equipmentModifier(constraint, 'active_constraint', snapshot.visibleWeekDays));
    } else {
      addUnique(
        out,
        seen,
        proofGateReadinessModifier(
          statusModifier(constraint, 'active_constraint') as ActiveProgramModifier,
          constraint,
          snapshot.visibleWeekDays,
        ),
      );
    }
  }

  const todaySignal = snapshot.readinessSignalsByDate?.[todayISO];
  for (const constraint of buildReadinessActiveConstraints(todaySignal)) {
    addUnique(
      out,
      seen,
      proofGateReadinessModifier(
        statusModifier(constraint as any, 'readiness_signal') as ActiveProgramModifier,
        constraint as any,
        snapshot.visibleWeekDays,
      ),
    );
  }

  addUnique(out, seen, deloadWeekModifier(snapshot));

  for (const [key, pref] of Object.entries(snapshot.modalityPreferences ?? {})) {
    addUnique(out, seen, modalityModifier(key, pref));
  }

  for (const exercise of snapshot.athletePrefs?.excluded ?? []) {
    if (!activePreferenceExercises.has(exercise)) {
      addUnique(out, seen, athletePreferenceModifier('excluded', exercise));
    }
  }
  for (const exercise of snapshot.athletePrefs?.pinned ?? []) {
    if (!activePreferenceAlternatives.has(exercise)) {
      addUnique(out, seen, athletePreferenceModifier('pinned', exercise));
    }
  }

  for (const constraint of snapshot.onboardingData?.availabilityConstraints ?? []) {
    if (isActiveAvailabilityConstraint(constraint, todayISO)) {
      addUnique(out, seen, availabilityModifier(constraint));
    }
  }

  return out;
}

export function getActiveProgramModifiers(todayISO: string = todayISOLocal()): ActiveProgramModifier[] {
  return selectActiveProgramModifiers({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    activeInjury: useCoachUpdatesStore.getState().activeInjury,
    athletePrefs: useAthletePreferencesStore.getState().prefs,
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
    onboardingData: useProfileStore.getState().onboardingData,
    readinessSignalsByDate: useReadinessStore.getState().signalsByDate,
    todayISO,
  });
}

function removeOverridesForModifierSource(
  sourceId: string,
  existing: ActiveConstraint | null | undefined,
): string[] {
  const programStore = useProgramStore.getState();
  const dates = new Set(linkedOverrideDates(existing));
  for (const [date, context] of Object.entries(programStore.overrideContexts ?? {})) {
    if ((context as any)?.activeModifierId === sourceId) dates.add(date);
  }
  const cleared: string[] = [];
  for (const date of Array.from(dates).sort()) {
    programStore.removeManualOverride(date);
    cleared.push(date);
  }
  return cleared;
}

function mergeClearedOverrideDates(...groups: readonly string[][]): string[] {
  return Array.from(new Set(groups.flat())).sort();
}

function hasLiveInjurySource(): boolean {
  const store = useCoachUpdatesStore.getState();
  return store.activeConstraints.some((constraint) =>
    constraint.type === 'injury' && constraint.status !== 'resolved') ||
    (!!store.activeInjury && store.activeInjury.status !== 'resolved');
}

export function clearActiveProgramModifier(
  modifierIdToClear: string,
): ClearActiveProgramModifierResult {
  const modifiers = getActiveProgramModifiers();
  const modifier = modifiers.find((m) => m.id === modifierIdToClear) ?? null;
  if (!modifier) {
    return {
      cleared: null,
      remainingActiveCount: modifiers.length,
      rebuildRequired: false,
    };
  }

  let rebuildRequired = false;
  let clearedOverrideDates: string[] = [];

  if (modifier.source === 'active_constraint') {
    const store = useCoachUpdatesStore.getState();
    const existing = store.activeConstraints.find((c) => c.id === modifier.sourceId);
    if (existing) {
      clearedOverrideDates = removeOverridesForModifierSource(modifier.sourceId, existing);
      store.removeActiveConstraint(modifier.sourceId);
      if (existing.type === 'injury' && !hasLiveInjurySource()) {
        clearedOverrideDates = mergeClearedOverrideDates(
          clearedOverrideDates,
          removeInjuryOverridesFromDate(todayISOLocal()),
        );
      }
      if (existing.type === 'equipment') rebuildRequired = true;
    } else if (store.activeInjury) {
      clearedOverrideDates = removeOverridesForModifierSource(modifier.sourceId, null);
      store.setActiveInjury(null);
      clearedOverrideDates = mergeClearedOverrideDates(
        clearedOverrideDates,
        removeInjuryOverridesFromDate(todayISOLocal()),
      );
    }
    if (modifier.type === 'exercise_adjustment') {
      const prefStore = useAthletePreferencesStore.getState();
      const exercise = modifier.payload?.exercise;
      const alternative = modifier.payload?.alternative;
      if (typeof exercise === 'string') prefStore.removeExclusion(exercise);
      if (typeof alternative === 'string') prefStore.removePinned(alternative);
      rebuildRequired = true;
    }
  } else if (modifier.source === 'legacy_active_injury') {
    useCoachUpdatesStore.getState().setActiveInjury(null);
    clearedOverrideDates = removeInjuryOverridesFromDate(todayISOLocal());
  } else if (modifier.source === 'athlete_preferences') {
    const prefStore = useAthletePreferencesStore.getState();
    const exercise = modifier.payload?.exercise;
    if (typeof exercise === 'string') {
      if (modifier.payload?.kind === 'excluded') prefStore.removeExclusion(exercise);
      if (modifier.payload?.kind === 'pinned') prefStore.removePinned(exercise);
    }
    rebuildRequired = true;
  } else if (modifier.source === 'modality_preferences') {
    useCoachPreferencesStore.getState().clearModalityPreference(modifier.sourceId);
  } else if (modifier.source === 'profile_availability') {
    const profile = useProfileStore.getState().onboardingData;
    useProfileStore.getState().updateOnboardingData({
      availabilityConstraints: (profile.availabilityConstraints ?? []).filter(
        (constraint) => constraint.id !== modifier.sourceId,
      ),
    });
    rebuildRequired = true;
  } else if (modifier.source === 'readiness_signal') {
    const date = String(modifier.payload?.date ?? todayISOLocal());
    useReadinessStore.getState().clearReadinessSignal(date);
  }

  const remaining = getActiveProgramModifiers();
  if (remaining.length === 0) {
    useCoachUpdatesStore.getState().deactivateCoachUpdate(getMondayStr(0));
  }

  logger.debug('[active-program-modifiers] cleared', {
    modifierId: modifier.id,
    source: modifier.source,
    sourceId: modifier.sourceId,
    rebuildRequired,
    clearedOverrideDates,
    remainingActiveCount: remaining.length,
  });

  return {
    cleared: modifier,
    remainingActiveCount: remaining.length,
    rebuildRequired,
  };
}
