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
import { restoreExcludedExercise } from './exerciseExclusionOwner';
import { getMondayForDate, getMondayStr } from './sessionResolver';
import { decideOverrideSweep } from './weekRebuild';
import { buildReadinessActiveConstraints } from './readinessConstraints';
import { todayISOLocal } from './appDate';
import { formatExerciseDisplayName } from './exerciseDisplay';
import { logger } from './logger';
import {
  readinessFactKindOfConstraint,
  readinessFactTitle,
  readinessScopeOfConstraint,
} from './readinessFactAttribution';
import { buildDeterministicCoachNoteDescriptors } from './deterministicCoachNoteFactory';
import type { AthletePoolPrefs } from '../data/exercisePoolsStrength';
import {
  activeExclusionsOn,
  exclusionExpiryLabel,
  EXERCISE_EXCLUSION_SCOPE_LABEL,
  type ExerciseExclusion,
} from '../rules/exerciseExclusions';
import type {
  OnboardingData,
  ProgramAvailabilityConstraint,
  WeekKind,
  Workout,
} from '../types/domain';
import type { ReadinessSignal } from './readiness';
import {
  severityHasModerateEffect,
  severityIsLimiting,
  severityIsRecordOnly,
  severityPausesTraining,
} from '../rules/injurySeverityBands';

export type ActiveProgramModifierType =
  | 'injury'
  | 'temporary_status'
  | 'exercise_adjustment'
  | 'coach_restriction';

export type ActiveProgramModifierSource =
  | 'active_constraint'
  | 'athlete_preferences'
  | 'modality_preferences'
  | 'profile_availability'
  | 'readiness_signal'
  | 'week_kind'
  | 'program_effect';

/**
 * THE ACTION VOCABULARY, AS A VALUE — so a surface can be checked against ALL of
 * it rather than against a copy of it.
 *
 * Added 2026-08-12 with SEAT_INBOX item 8. A type union cannot be iterated at
 * runtime, so every cell asking *"is this control live on that screen?"* had to
 * retype the eight kinds — and a retyped list agrees with the type right up
 * until someone adds a ninth. `satisfies` makes the two sides fail together:
 * a kind added to the union and not to this list stops compiling, and a kind in
 * this list with nowhere to go reds `test:my-status-modifiers`.
 */
export const ACTIVE_PROGRAM_MODIFIER_ACTION_KINDS = [
  'clear_injury',
  'update_injury',
  'clear_status',
  'update_status',
  'clear_adjustment',
  'update_adjustment',
  'restore_adjustment',
  'dismiss_note',
  /**
   * ── THE TWO EXCLUSION CONTROLS (Block Two, Sam's approved contract) ───────
   *
   * *"Status shows every active exclusion with ... controls to change the scope
   * or restore the exercise."*
   *
   * They are NOT `update_adjustment` / `clear_adjustment` wearing new labels,
   * and the difference is the whole reason for two more members. Those two are
   * generic — the sheet routes them to a constraint-clearing path keyed on
   * `constraintId`, and an exclusion has no constraint: it is a decision in
   * `prefs.exclusions`, cleared by the canonical transaction owner and by
   * nothing else. Reusing the generic kinds would have sent the athlete's
   * "Restore" through a door that would find no constraint and silently do
   * nothing, which is the half-alive control this repo already paid for once.
   */
  'change_exclusion_scope',
  'restore_exclusion',
] as const;

export type ActiveProgramModifierActionKind =
  (typeof ACTIVE_PROGRAM_MODIFIER_ACTION_KINDS)[number];

export type ActiveProgramModifierAffect = ActiveConstraintModifierAffect;

export interface ActiveProgramModifierAction {
  kind: ActiveProgramModifierActionKind;
  label: string;
}

/**
 * WHAT THIS MODIFIER DID TO THE PROGRAM, IN SAM'S OWN WORDS — SEAT_INBOX 22(a).
 *
 * He signed eight short phrases for the modifier sheet's right-hand column on
 * 2026-08-13. This union is the discriminator they hang off, and it exists as a
 * FIELD ON THE MODIFIER rather than a lookup in the sheet for one reason: the
 * sheet cannot tell a tired week from a sick one. `type` is four broad kinds
 * (`injury`, `temporary_status`, `exercise_adjustment`, `coach_restriction`)
 * and `source` is where the fact came from; neither separates "cooked" from
 * "sick", or an injury being worked around from an injury that PAUSED
 * training. Only the builder knows, so only the builder can say.
 *
 * WRITER: every builder in this file, one `effect` each. READER:
 * `ModifiersSheet`, through a `Record` over this union so the compiler demands
 * a phrase for every member the day a member is added. TEST:
 * `test:modifier-effect-phrases`.
 *
 * `'not_shown'` IS A DECISION, NOT AN ABSENCE. Sam withdrew time caps on
 * 2026-08-13 — *"i've taken out time caps for now"* — so a time-cap modifier
 * renders no row. Spelling that as a named member rather than `undefined`
 * keeps it a ruling anyone can find, and keeps the `Record` total.
 *
 * `'unsigned'` IS THE HONEST GAP, AND IT DID NOT CLOSE.
 *
 * CORRECTED 2026-08-13 (SEAT_INBOX 23): this comment said "Three live builders
 * — exercise preferences, athlete pool preferences and modality swaps". It was
 * wrong by one, and the missing one mattered. `athletePreferenceModifier` is a
 * SINGLE builder carrying `kind: 'excluded' | 'pinned'`, and those are
 * OPPOSITES — excluded AVOIDS an exercise, pinned PRIORITISES it. Counting the
 * builder instead of the outcomes would have shipped one phrase for both, false
 * every second time it rendered. Sam signed FOUR phrases, not three.
 *
 * TWO SITES STILL CARRY `'unsigned'` AND STAY THAT WAY, by his ruling:
 * SORENESS, whose own sentence names the body part, and the generated
 * PROGRAMME-EFFECT notes, which carry their own authored sentence. A missing
 * phrase is a gap in the WORDS and never a reason to stop telling the athlete
 * their program changed — which is why `isShownOnProgram` still shows them.
 */
export type ActiveProgramModifierEffect =
  | 'volume_adjusted'
  | 'training_eased'
  | 'exercises_swapped'
  | 'training_paused'
  | 'exercises_substituted'
  | 'sessions_moved'
  | 'club_sessions_off'
  | 'planned_lighter'
  | 'week_rebuilt'
  | 'exercise_preference_applied'
  | 'exercise_removed'
  | 'exercise_prioritised'
  | 'conditioning_swapped'
  | 'not_shown'
  | 'unsigned';

export interface ActiveProgramModifier {
  id: string;
  source: ActiveProgramModifierSource;
  sourceId: string;
  type: ActiveProgramModifierType;
  title: string;
  body: string;
  /** See `ActiveProgramModifierEffect`. Required, so a new builder must choose. */
  effect: ActiveProgramModifierEffect;
  severity?: number;
  actions: ActiveProgramModifierAction[];
  affects: ActiveProgramModifierAffect[];
  payload?: Record<string, unknown>;
}

export interface ActiveProgramModifierSnapshot {
  activeConstraints?: readonly ActiveConstraint[] | null;
  athletePrefs?: AthletePoolPrefs | null;
  modalityPreferences?: Record<string, ModalityPreference> | null;
  onboardingData?: OnboardingData | null;
  readinessSignalsByDate?: Record<string, ReadinessSignal> | null;
  todayISO?: string;
  weekKind?: WeekKind | null;
  visibleWeekDays?: readonly ActiveProgramModifierVisibleDay[] | null;
  dismissedCoachNoteIds?: readonly string[] | null;
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
    | 'powerBlock'
    | 'conditioningBlock'
    | 'recoveryAddons'
    | 'deterministicCoachNoteEvidence'
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
  // BIBLE_ANCHOR: injury_severity_bands — one scale, Sam 2026-07-28.
  // `>= 7` split the 6-7 band; the limiting edge is 6.
  if (severityIsLimiting(severity)) return 'High';
  if (severityHasModerateEffect(severity)) return 'Moderate';
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
  const paused = c.adjustmentLevel === 'training_paused' || c.seriousSymptoms === true || severityPausesTraining(c.severity);

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
      ? 'Lower-body, bike or midline work stayed in where safe.'
      : (bucket.includes('hamstring') || bucket.includes('knee') || bucket.includes('adductor') || bucket.includes('groin')) && summary.hasSafeUpperBike
        ? 'Upper-body, bike or midline work stayed in where safe.'
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
  return sentence([readinessBodyLead(c, title), effectSentence(parts)]);
}

/**
 * The lead sentence of a readiness coach note, attributed to the fact KIND — never
 * a fatigue attribution ("you said you're cooked") on an illness or poor-sleep
 * fact. Illness is discriminated by the typed `readinessKind:'illness'` marker the
 * constraint carries (it shares the fatigue constraint type for now), so this
 * branches on typed intent rather than string-matching the title. Exported as the
 * single testable owner of readiness attribution.
 */
export function readinessBodyLead(
  c: {
    type: string;
    readinessKind?: 'poor_sleep' | 'illness';
    readinessPattern?: 'single_night' | 'repeated';
    severity: number;
  },
  title: string,
): string {
  if (c.type === 'fatigue' && c.readinessKind === 'illness') {
    return "You said you're sick.";
  }
  const poorSleepPattern = c.type === 'fatigue' && c.readinessKind === 'poor_sleep'
    ? c.readinessPattern
    : undefined;
  if (poorSleepPattern === 'repeated') return 'Repeated poor sleep adjustment active.';
  if (poorSleepPattern === 'single_night') return 'Poor sleep adjustment active today.';
  const isCooked = c.type === 'fatigue' && (severityIsLimiting(c.severity) || /cooked|load reduced/i.test(title));
  const isFlat = c.type === 'fatigue' && (severityIsRecordOnly(c.severity) || /flat|feeling flat/i.test(title));
  if (isCooked) return "You said you're cooked.";
  if (isFlat) return "You said you're flat today.";
  return 'Readiness adjustment active.';
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
    // Sam's phrase: a deload is PLANNED, not a setback.
    effect: 'planned_lighter',
    affects: ['current_week'],
    actions: [],
    payload: {
      weekKind: 'deload',
      weekStart: evidence.weekStart,
      lifecycleKey: `week_kind:deload:${evidence.weekStart}`,
    },
  };
}

function deterministicProgramEffectModifiers(
  snapshot: ActiveProgramModifierSnapshot,
): ActiveProgramModifier[] {
  return buildDeterministicCoachNoteDescriptors(snapshot.visibleWeekDays).map((descriptor) => ({
    id: modifierId('program_effect', descriptor.sourceId),
    source: 'program_effect',
    sourceId: descriptor.sourceId,
    type: 'temporary_status',
    title: descriptor.title,
    body: descriptor.body,
    // NOT IN SAM'S EIGHT. These are generated programme-effect notes —
    // "Training adaptation active", "Beginner dose active", "Small session
    // before your game". They keep their own authored sentence.
    effect: 'unsigned',
    affects: descriptor.affects,
    actions: [],
    payload: {
      lifecycleKey: descriptor.lifecycleKey,
      generated: true,
    },
  }));
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

function normalizedWorkoutLifecycle(
  workoutName: unknown,
  workoutType: unknown,
): string {
  const name = typeof workoutName === 'string' ? workoutName.trim() : '';
  const type = typeof workoutType === 'string' ? workoutType.trim() : '';
  if (type === 'Game') return 'game';
  if (
    !name && !type ||
    type === 'Rest' ||
    /^(?:rest|off)$/i.test(name)
  ) {
    return 'rest';
  }
  return `training:${type}:${name}`;
}

function visibleWorkoutLifecycle(
  day: ActiveProgramModifierVisibleDay | undefined,
): string {
  return normalizedWorkoutLifecycle(
    day?.workout?.name,
    day?.workout?.workoutType,
  );
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
    return visibleWorkoutLifecycle(visible) === normalizedWorkoutLifecycle(
      row.workoutName,
      row.workoutType,
    );
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
    // BOTH OF SAM'S INJURY ROWS, SPLIT ON THE SAME FLAG THE TITLE USES.
    // `isSerious` is 8-10/10 or an explicit `training_paused` level, and it is
    // the difference between working AROUND an injury and stopping for it.
    effect: isSerious ? 'training_paused' : 'exercises_swapped',
    title: c.modifierTitle ?? (isSerious ? 'Training paused for injury' : `${displayPart} issue active`),
    body: c.modifierBody ?? fallbackBody,
    severity: c.severity,
    affects: modifierAffects(c, []),
    actions: c.injuryEpisodeId
      ? [
          { kind: 'clear_injury', label: 'Injury resolved' },
          { kind: 'update_injury', label: isSerious ? 'Update issue' : 'Update injury' },
          { kind: 'dismiss_note', label: 'Dismiss note' },
        ]
      : [
          { kind: 'clear_injury', label: isSerious ? "I've been cleared" : "I'm all good now" },
          { kind: 'update_injury', label: isSerious ? 'Update issue' : 'Update injury' },
        ],
    payload: {
      constraintId: c.id,
      temporarySourceFactIds: [...(c.temporarySourceFactIds ?? [])],
      injuryEpisodeId: c.injuryEpisodeId,
      lifecycleKey: activeConstraintLifecycleKey(c, source),
      bodyPart: c.bodyPart,
      region: c.region,
      severityBand: c.severityBand,
      adjustmentLevel: c.adjustmentLevel,
      triggers: c.triggers ?? [],
      seriousSymptoms: c.seriousSymptoms ?? false,
      presentationOnlyDismiss: Boolean(c.injuryEpisodeId),
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
  const isLegacyFixtureProjection = c.type === 'schedule' &&
    c.noteProof?.kind === 'game_change' && !c.reversibleAdjustmentId;
  const isSoreness = c.type === 'soreness';
  // A4: the title is attributed to the FACT KIND through the projection's typed
  // `readinessKind` discriminator — the same source the body already reads via
  // `readinessBodyLead`. Branching on the constraint TYPE is what made a severe
  // illness read as "Recovery mode active": every health fact shares the fatigue
  // constraint type. Vocabulary lives in one owner shared with the Program card.
  const readinessFactKind = readinessFactKindOfConstraint(c as never);
  const fallbackTitle = readinessFactKind
    ? readinessFactTitle({
        kind: readinessFactKind,
        scope: readinessScopeOfConstraint(c as never),
        severity: 'severity' in c ? c.severity : undefined,
        bodyPart: isSoreness ? capitaliseWords(displayBodyPart(c)) : undefined,
      })
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
  const sourceFactOwned = (sourceConstraint.temporarySourceFactIds?.length ?? 0) > 0;
  const scheduleClearLabel = c.type === 'schedule' && c.scheduleKind === 'time_cap'
    ? 'End temporary restriction'
    : 'Schedule is back to normal';

  /* SAM'S PHRASES FOR EVERY READINESS AND SCHEDULE FACT (SEAT_INBOX 22a).
     Branched on `readinessFactKind`, the SAME typed discriminator the title
     already reads — not on the constraint type, which is what once made a
     severe illness read as "Recovery mode active" (every health fact shares
     the `fatigue` constraint type).

     TIME CAPS ARRIVE HERE TOO, and this is their SECOND door: a time cap can
     be a `schedule` constraint with `scheduleKind: 'time_cap'` as well as a
     `time_limit` availability constraint. Sam withdrew time caps on
     2026-08-13, so both doors render no row — finding one and missing the
     other would have hidden the row on one path and shown it on the other.

     SORENESS IS DELIBERATELY UNSIGNED. Sam's row reads "Cooked / tired", and
     soreness is neither; its own sentence names the body part, which is more
     than a short phrase could say. Recorded under `## AWAITING SAM`. */
  const effect: ActiveProgramModifierEffect =
    readinessFactKind === 'illness' ? 'training_eased'
      : readinessFactKind === 'fatigue' || readinessFactKind === 'poor_sleep' ? 'volume_adjusted'
        : readinessFactKind === 'soreness' ? 'unsigned'
          : c.type === 'schedule' && c.scheduleKind === 'time_cap' ? 'not_shown'
            : c.type === 'schedule' && c.noteProof?.kind === 'game_change' ? 'week_rebuilt'
              // ── ITEM 28: TRAVEL IS ITS OWN EFFECT NOW ──
              // "Sessions moved" was honest while away marked its dates
              // UNAVAILABLE and the composer shuffled the week. Sam's ruling
              // changed what away does — *"yes clear team training and games
              // while away"* — so nothing moves; club-bound work comes off and
              // the athlete's own sessions stay where they are.
              // AND THE CHRISTMAS BREAK IS THE SAME EFFECT (item 31 part 5).
              // The club is shut rather than unreachable, but what the athlete
              // sees is identical: no team night, everything else untouched.
              : c.type === 'schedule' &&
                (c.scheduleKind === 'travel' || c.scheduleKind === 'no_team_training')
                ? 'club_sessions_off'
                : c.type === 'schedule' ? 'sessions_moved'
                : 'unsigned';

  return {
    id: modifierId(source, c.id),
    source,
    sourceId: c.id,
    type: isCoachRestriction ? 'coach_restriction' : 'temporary_status',
    effect,
    title: modifierString(sourceConstraint, 'modifierTitle') ?? fallbackTitle,
    body: modifierString(sourceConstraint, 'modifierBody') ?? fallbackBody,
    severity: 'severity' in c ? c.severity : undefined,
    affects: modifierAffects(sourceConstraint, []),
    actions: isCoachRestriction
      ? c.reversibleAdjustmentId
        ? [
            { kind: 'restore_adjustment', label: c.noteProof?.kind === 'game_change'
              ? 'Restore fixture' : 'Undo athlete action' },
            { kind: 'dismiss_note', label: 'Dismiss note' },
          ]
        : c.presentationOnlyDismiss || isLegacyFixtureProjection
          ? [{ kind: 'dismiss_note', label: 'Dismiss note' }]
          : sourceFactOwned
            ? [
                { kind: 'clear_adjustment', label: scheduleClearLabel },
                { kind: 'update_adjustment', label: 'Update availability' },
                { kind: 'dismiss_note', label: 'Dismiss note' },
              ]
          : [
              { kind: 'clear_adjustment', label: 'Clear adjustment' },
              { kind: 'update_adjustment', label: 'Update' },
            ]
      : [
          { kind: 'clear_status', label: "I'm good now" },
          { kind: 'update_status', label: 'Update status' },
        ],
    payload: {
      constraintId: c.id,
      temporarySourceFactIds: [...(c.temporarySourceFactIds ?? [])],
      lifecycleKey: activeConstraintLifecycleKey(sourceConstraint, source),
      date: 'appliesToDate' in c ? c.appliesToDate : undefined,
      expiresAt: expiresAt(sourceConstraint),
      overrideDates: linkedOverrideDates(sourceConstraint),
      reversibleAdjustmentId: c.reversibleAdjustmentId,
      presentationOnlyDismiss: c.presentationOnlyDismiss === true || isLegacyFixtureProjection,
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
    effect: 'exercises_substituted',
    title: modifierString(c, 'modifierTitle') ?? title,
    body: modifierString(c, 'modifierBody') ??
      equipmentModifierBody(c, affects, equipmentHasVisibleProof(c, visibleWeekDays)),
    severity: c.severity,
    affects,
    actions: [
      {
        kind: 'clear_adjustment',
        label: (c.temporarySourceFactIds?.length ?? 0) > 0
          ? 'Equipment available again'
          : 'Clear adjustment',
      },
      {
        kind: 'update_adjustment',
        label: (c.temporarySourceFactIds?.length ?? 0) > 0
          ? 'Update equipment'
          : 'Update',
      },
      ...((c.temporarySourceFactIds?.length ?? 0) > 0
        ? [{ kind: 'dismiss_note' as const, label: 'Dismiss note' }]
        : []),
    ],
    payload: {
      constraintId: c.id,
      lifecycleKey: activeConstraintLifecycleKey(c, source),
      mode: c.mode,
      tags: [...c.tags],
      temporarySourceFactIds: [...(c.temporarySourceFactIds ?? [])],
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
    // SIGNED 2026-08-13 (SEAT_INBOX 23) — one phrase covers all three
    // preference kinds (avoid, preferred alternative, added focus), which is
    // what Sam signed: they are the same act from the athlete's side.
    effect: 'exercise_preference_applied',
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
    // SIGNED 2026-08-13 (SEAT_INBOX 23), AND IT BRANCHES BECAUSE THE TWO ARE
    // OPPOSITES. One builder, two outcomes: `excluded` takes an exercise OUT,
    // `pinned` asks for MORE of it. A single phrase here would be wrong every
    // second time it rendered, which is why the item is four phrases and not
    // three.
    effect: kind === 'excluded' ? 'exercise_removed' : 'exercise_prioritised',
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

/**
 * ONE STATUS ROW PER ACTIVE EXCLUSION — exercise, scope, expiry, the athlete's
 * reason when they gave one, and the two controls.
 *
 * Sam's approved contract lists the five things the row must say, and every one
 * of them is DERIVED from the stored decision at render time. Nothing here is a
 * stored sentence: a scope the athlete changes must change the row, and prose
 * saved beside a fact goes stale silently the moment the fact moves.
 *
 * IT REPLACES `athletePreferenceModifier('excluded', name)`. That builder took a
 * bare name and could only ever say "future generated sessions will avoid it" —
 * true for one of Sam's three scopes and wrong for the other two, with no expiry
 * to show and nothing to change the scope with.
 */
function athleteExclusionModifier(exclusion: ExerciseExclusion): ActiveProgramModifier {
  const displayExercise = formatExerciseDisplayName(exclusion.exercise);
  const scopeLabel = EXERCISE_EXCLUSION_SCOPE_LABEL[exclusion.scope];
  return {
    id: modifierId('athlete_preferences', `exclusion:${exclusion.exercise}`),
    source: 'athlete_preferences',
    sourceId: `exclusion:${exclusion.exercise}`,
    type: 'exercise_adjustment',
    // Sam's signed phrase for an exercise the athlete took out. Unchanged: this
    // is the same act, now with a span attached.
    effect: 'exercise_removed',
    title: `${displayExercise} left out`,
    body: sentence([
      `${scopeLabel}.`,
      `${exclusionExpiryLabel(exclusion)}.`,
      exclusion.reason ? `You said: ${exclusion.reason}.` : null,
    ]),
    // `today_only` changes today's session and nothing beyond it; the other two
    // change what future generation may choose. The Program card reads this.
    affects: exclusion.scope === 'today_only' ? ['current_day'] : ['future_generation'],
    actions: [
      { kind: 'change_exclusion_scope', label: 'Change scope' },
      { kind: 'restore_exclusion', label: 'Restore exercise' },
    ],
    payload: {
      kind: 'excluded',
      exercise: exclusion.exercise,
      scope: exclusion.scope,
      decidedOnISO: exclusion.decidedOnISO,
      activeThroughISO: exclusion.activeThroughISO,
      blockNumber: exclusion.blockNumber,
      ...(exclusion.reason ? { athleteReason: exclusion.reason } : {}),
    },
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
    // SIGNED 2026-08-13 (SEAT_INBOX 23) — a conditioning slot swapped.
    effect: 'conditioning_swapped',
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
      // Sam's phrase: a day the athlete cannot train MOVES sessions.
      effect: 'sessions_moved',
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
      // TIME CAPS RENDER NO ROW (SEAT_INBOX 22b). Sam, 2026-08-13: "i've taken
      // out time caps for now". A DISPLAY ruling, not a deletion — the kind
      // still exists and this builder still runs, because other facts write it
      // and My Status still needs to show and clear one.
      effect: 'not_shown',
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
      // TODAY travel REMOVES training on the away dates, so "sessions moved"
      // is what it honestly does. SEAT_INBOX 22(c) reshapes this — away is a
      // different gym, not a rest period — and this effect moves with it.
      effect: 'sessions_moved',
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
  for (const modifier of deterministicProgramEffectModifiers(snapshot)) {
    addUnique(out, seen, modifier);
  }

  for (const [key, pref] of Object.entries(snapshot.modalityPreferences ?? {})) {
    addUnique(out, seen, modalityModifier(key, pref));
  }

  /* ── THE ATHLETE'S EXCLUSIONS, FROM THE ONE CANONICAL LIST ────────────────
   *
   * `athletePrefs.excluded` is now a DERIVED projection and is empty on the
   * stored object this snapshot carries, so reading it here would silently show
   * an athlete with ten exclusions no rows at all. The decisions are the truth.
   *
   * Filtered to the ones ACTIVE TODAY, which is what makes a `today_only`
   * exclusion "leave active Status after that day but remain in history"
   * (Sam's contract) with no sweep to run — the decision stays stored, the
   * arithmetic stops matching, the row goes. */
  for (const exclusion of activeExclusionsOn(snapshot.athletePrefs?.exclusions, todayISO)) {
    if (!activePreferenceExercises.has(exclusion.exercise)) {
      addUnique(out, seen, athleteExclusionModifier(exclusion));
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
    constraint.type === 'injury' && constraint.status !== 'resolved');
}

export function clearActiveProgramModifier(
  modifierIdToClear: string,
): ClearActiveProgramModifierResult {
  const modifiers = getActiveProgramModifiers();
  let modifier = modifiers.find((m) => m.id === modifierIdToClear) ?? null;
  if (!modifier) {
    // A selected future week can surface an active constraint before it is
    // effective for today's program. Resolve that explicit stable modifier id
    // in the constraint's own time window so Clear targets the stored typed
    // source instead of depending on the wall-clock projection.
    const constraint = useCoachUpdatesStore.getState().activeConstraints.find((candidate) =>
      modifierId('active_constraint', candidate.id) === modifierIdToClear);
    if (constraint) {
      const scopedConstraint = constraint as ActiveConstraint & {
        appliesToDate?: string;
        weekStartISO?: string;
      };
      const effectiveDate = scopedConstraint.appliesToDate ?? scopedConstraint.weekStartISO ??
        scopedConstraint.startDate ?? todayISOLocal();
      modifier = getActiveProgramModifiers(effectiveDate)
        .find((candidate) => candidate.id === modifierIdToClear) ?? null;
    }
  }

  if (!modifier) {
    return {
      cleared: null,
      remainingActiveCount: modifiers.length,
      rebuildRequired: false,
    };
  }
  // Canonical injury state is resolved only by resolveInjuryEpisode(id).
  // Generic modifier Clear remains available for the other legacy families,
  // but it must never delete an episode, history, or injury-owned projection.
  if (modifier.type === 'injury' && (
    typeof modifier.payload?.injuryEpisodeId === 'string' ||
    useProgramStore.getState().acceptedMaterialContext.injuryEpisodes?.length > 0
  )) {
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
    }
    if (modifier.type === 'exercise_adjustment') {
      const prefStore = useAthletePreferencesStore.getState();
      const exercise = modifier.payload?.exercise;
      const alternative = modifier.payload?.alternative;
      if (typeof exercise === 'string') prefStore.removeExclusion(exercise);
      if (typeof alternative === 'string') prefStore.removePinned(alternative);
      rebuildRequired = true;
    }
  } else if (modifier.source === 'athlete_preferences') {
    const prefStore = useAthletePreferencesStore.getState();
    const exercise = modifier.payload?.exercise;
    if (typeof exercise === 'string') {
      // THE SAME CANONICAL TRANSACTION OWNER THE DAY SCREEN AND STATUS USE.
      // Sam's contract: *"Changing or restoring must use the same canonical
      // transaction owner"* — so restore goes through it here too, rather than
      // reaching past it into the store's own action.
      if (modifier.payload?.kind === 'excluded') {
        restoreExcludedExercise(exercise);
        // ── RESTORE'S OTHER HALF ────────────────────────────────────────────
        // A removal writes TWO facts. `restoreExcludedExercise` clears the
        // canonical exclusion; the program-control action stays on the ledger
        // and keeps replaying, so without this the exercise never comes back
        // and Restore reports success over an unchanged session. Measured on
        // device 2026-08-19 — exclusions were `[]` and the ledger still held
        // `remove_exercise`.
        //
        // The SAME reversal mechanism undo uses, aimed at the named entry; a
        // world with no outstanding removal (a coach-written exclusion) is the
        // ordinary case and appends nothing.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { annulOutstandingRemovalFor } = require('../store/undoLastDecision');
        annulOutstandingRemovalFor(exercise);
      }
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
