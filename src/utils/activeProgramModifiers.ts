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
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { decisionLedgerEntries } from '../store/decisionLedgerStore';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import { replayableEntries, lastUndoableEntry } from '../rules/decisionLedgerReplay';
import { adjustmentMatchesDecision } from '../store/reversibleAdjustmentTransaction';
import type { ReversibleAdjustmentRecord } from '../rules/reversibleAdjustmentLedger';
import { lighterDayEffectActive } from '../rules/canonicalWeeklyLighterDayCompiler';
import { composeTemporarySourceFactCompatibility, isTemporarySourceFactConstraint,
  type TemporarySourceFact } from '../rules/temporarySourceFact';
import { useReadinessStore } from '../store/readinessStore';
import { restoreExcludedExercise } from './exerciseExclusionOwner';
import { getMondayForDate, getMondayStr } from './sessionResolver';
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
  exclusionExpiryLabel,
  standingExclusionsOn,
  EXERCISE_EXCLUSION_SCOPE_LABEL,
  type ExerciseExclusion,
} from '../rules/exerciseExclusions';
import type {
  OnboardingData,
  ProgramAvailabilityConstraint,
  WeekKind,
  Microcycle,
  UserRemovalConstraint,
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
 * Time limits carry their own sentence and are visible on all surfaces (R-262).
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
  | 'session_time_limited'
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
  temporarySourceFacts?: readonly TemporarySourceFact[];
  decisionEntries?: readonly DecisionLedgerEntry[];
  reversibleAdjustments?: readonly ReversibleAdjustmentRecord[];
  sessionConstraints?: readonly UserRemovalConstraint[];
  athletePrefs?: AthletePoolPrefs | null;
  modalityPreferences?: Record<string, ModalityPreference> | null;
  onboardingData?: OnboardingData | null;
  readinessSignalsByDate?: Record<string, ReadinessSignal> | null;
  todayISO?: string;
  weekKind?: WeekKind | null;
  compiledWeek?: Pick<Microcycle, 'startDate' | 'deloadDoor' | 'dosePolicyByDay'> | null;
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

function deloadWeekModifier(
  snapshot: ActiveProgramModifierSnapshot,
): ActiveProgramModifier | null {
  const week = snapshot.compiledWeek;
  const scheduled = week?.deloadDoor === 'scheduled'
    || Object.values(week?.dosePolicyByDay ?? {}).some(policy => policy?.door === 'scheduled');
  if (!scheduled) return null;
  const weekStart = weekStartFromVisibleDays(snapshot.visibleWeekDays) ?? week!.startDate.slice(0, 10);
  const body = 'This is a deload week. Main strength patterns stay in. Sets or volume are reduced.';
  return {
    id: modifierId('week_kind', `deload:${weekStart}`),
    source: 'week_kind',
    sourceId: `deload:${weekStart}`,
    type: 'temporary_status',
    title: 'Deload week active',
    body,
    // Sam's phrase: a deload is PLANNED, not a setback.
    effect: 'planned_lighter',
    affects: ['current_week'],
    actions: [],
    payload: {
      weekKind: 'deload',
      weekStart: weekStart,
      lifecycleKey: `week_kind:deload:${weekStart}`,
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

     Time caps share the same visible effect on both ingress paths (R-262).

     SORENESS IS DELIBERATELY UNSIGNED. Sam's row reads "Cooked / tired", and
     soreness is neither; its own sentence names the body part, which is more
     than a short phrase could say. Recorded under `## AWAITING SAM`. */
  const effect: ActiveProgramModifierEffect =
    readinessFactKind === 'illness' ? 'training_eased'
      : readinessFactKind === 'fatigue' || readinessFactKind === 'poor_sleep' ? 'volume_adjusted'
        : readinessFactKind === 'soreness' ? 'unsigned'
          : c.type === 'schedule' && c.scheduleKind === 'time_cap' ? 'session_time_limited'
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
      equipmentModifierBody(c, affects, false),
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
function athleteExclusionModifier(
  exclusion: ExerciseExclusion,
  todayISO: string,
): ActiveProgramModifier {
  const displayExercise = formatExerciseDisplayName(exclusion.exercise);
  const scopeLabel = EXERCISE_EXCLUSION_SCOPE_LABEL[exclusion.scope];
  /* A removal decided IN ADVANCE (launch audit 2026-08-25, finding #7: bin
   * Thursday's exercise on Tuesday) now shows before its day — the row must
   * say it has not started rather than read as active. A one-day span's
   * expiry label would just repeat the start date, so it yields to the
   * `Starts` clause. Copy APPROVED (Sam, 2026-08-26: 'the rest of the
   * wording is good'). */
  const notYetStarted = todayISO.slice(0, 10) < exclusion.decidedOnISO;
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
      notYetStarted ? `Starts ${exclusion.decidedOnISO}.` : null,
      notYetStarted && exclusion.scope === 'today_only'
        ? null
        : `${exclusionExpiryLabel(exclusion)}.`,
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
      effect: 'session_time_limited',
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
  const fixtureEntries = new Map<string, DecisionLedgerEntry>();
  for (const entry of replayableEntries(snapshot.decisionEntries ?? [])) {
    if (entry.decision.kind !== 'fixture_add' && entry.decision.kind !== 'fixture_move' && entry.decision.kind !== 'fixture_remove') continue;
    const effect = entry.decision.acceptedEffect;
    if (!effect) continue;
    const week = getMondayForDate(effect.targetDate);
    if (week >= getMondayForDate(todayISO)) fixtureEntries.set(week, entry);
  }
  // Display each accepted report, not the strongest member of a compiler group.
  // This is a read projection: generation continues to combine facts as before.
  const constraints = snapshot.temporarySourceFacts
    ? [
        ...(snapshot.activeConstraints ?? []).filter(c => !isTemporarySourceFactConstraint(c)),
        ...snapshot.temporarySourceFacts.flatMap(fact =>
          composeTemporarySourceFactCompatibility({ temporarySourceFacts: [fact] }).activeConstraints
            .map(c => c.type === 'injury' ? c : { ...c, id: `source-fact:${c.temporarySourceFactIds![0]}` })),
      ]
    : snapshot.activeConstraints ?? [];
  const activeConstraints = [...constraints]
    .filter((constraint) => !isExpiredActiveConstraint(constraint, todayISO));

  const activePreferenceExercises = new Set<string>();
  const activePreferenceAlternatives = new Set<string>();

  for (const constraint of activeConstraints) {
    if (!constraint || constraint.status === 'resolved') continue;
    if (constraint.type === 'schedule' && constraint.noteProof?.kind === 'game_change' &&
      fixtureEntries.has(constraint.weekStartISO ?? '')) continue;
    if (constraint.type === 'injury') {
      addUnique(
        out,
        seen,
        injuryModifier(constraint, 'active_constraint'),
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
        statusModifier(constraint, 'active_constraint'),
      );
    }
  }

  const todaySignal = snapshot.readinessSignalsByDate?.[todayISO];
  for (const constraint of buildReadinessActiveConstraints(todaySignal)) {
    addUnique(
      out,
      seen,
      statusModifier(constraint as any, 'readiness_signal'),
    );
  }

  addUnique(out, seen, deloadWeekModifier(snapshot));
  const latestUndo = lastUndoableEntry(snapshot.decisionEntries ?? []);
  for (const constraint of snapshot.sessionConstraints ?? []) {
    if (constraint.status !== 'active' ||
      (constraint.targetDate < todayISO && (!constraint.moveTargetDate || constraint.moveTargetDate < todayISO))) continue;
    const entry = [...replayableEntries(snapshot.decisionEntries ?? [])].reverse().find(candidate =>
      candidate.decision.kind === 'plan_change' && candidate.decision.acceptedEffect?.upsertedConstraints
        .some(accepted => accepted.id === constraint.id));
    const kind = entry?.decision.kind === 'plan_change' ? entry.decision.change.kind : undefined;
    const title = kind === 'remove_session' ? 'Session removed'
      : kind === 'add_category' || kind === 'add_template' ? 'Session added'
        : kind === 'swap_category' || kind === 'swap_template' ? 'Session swapped'
          : constraint.mutationKind === 'move' ? 'Session moved' : 'Session changed';
    const adjustment = entry && snapshot.reversibleAdjustments?.find(record =>
      record.status === 'active' && adjustmentMatchesDecision(record, entry));
    const canUndo = !!entry && latestUndo?.id === entry.id && !!adjustment;
    addUnique(out, seen, {
      id: modifierId('program_effect', `session:${constraint.id}`),
      source: 'program_effect', sourceId: `session:${constraint.id}`,
      type: 'exercise_adjustment', title,
      body: constraint.mutationKind === 'move'
        ? `Your session moved from ${constraint.targetDate} to ${constraint.moveTargetDate}.`
        : `${title} on ${constraint.targetDate}.`,
      effect: constraint.mutationKind === 'move' ? 'sessions_moved' : 'unsigned',
      affects: ['current_week'],
      actions: canUndo ? [{ kind: 'restore_adjustment', label: 'Undo session change' }] : [],
      payload: { reversibleAdjustmentId: canUndo ? adjustment!.id : undefined },
    });
  }
  for (const entry of fixtureEntries.values()) {
    if (entry.decision.kind !== 'fixture_add' && entry.decision.kind !== 'fixture_move' && entry.decision.kind !== 'fixture_remove') continue;
    const effect = entry.decision.acceptedEffect!;
    const fixture = effect.fixtureKind === 'practice_match' ? 'Practice match' : 'Game';
    const verb = { add: 'added', move: 'moved', remove: 'removed' }[effect.action];
    const adjustment = snapshot.reversibleAdjustments?.find(record => record.status === 'active' && adjustmentMatchesDecision(record, entry));
    const canUndo = latestUndo?.id === entry.id && !!adjustment;
    addUnique(out, seen, {
      id: modifierId('active_constraint', `fixture:${entry.id}`),
      source: 'active_constraint', sourceId: `fixture:${entry.id}`,
      type: 'coach_restriction', effect: 'week_rebuilt', title: `${fixture} ${verb}`,
      body: effect.action === 'move'
        ? `${fixture} moved from ${effect.sourceDate} to ${effect.targetDate}.`
        : `${fixture} ${verb} on ${effect.targetDate}.`,
      affects: ['current_week'],
      actions: canUndo ? [{ kind: 'restore_adjustment', label: 'Restore fixture' }] : [],
      payload: { reversibleAdjustmentId: canUndo ? adjustment!.id : undefined },
    });
  }
  for (const entry of replayableEntries(snapshot.decisionEntries ?? [])) {
    if (entry.decision.kind !== 'lighter_day') continue;
    const effect = entry.decision.acceptedEffect;
    if (effect.dateISO < todayISO || !lighterDayEffectActive(effect, snapshot.temporarySourceFacts ?? [])) continue;
    if (out.some(modifier => (modifier.payload?.temporarySourceFactIds as string[] | undefined)?.includes(effect.sourceFactId))) continue;
    addUnique(out, seen, {
      id: modifierId('active_constraint', `lighter:${effect.sourceFactId}`),
      source: 'active_constraint', sourceId: effect.sourceFactId,
      type: 'temporary_status', effect: 'volume_adjusted', title: 'Lighter day',
      body: `${effect.dateISO}: your session is lighter after your readiness report.`,
      affects: ['current_day'], actions: [{ kind: 'clear_status', label: "I'm good now" }],
      payload: { temporarySourceFactIds: [effect.sourceFactId], date: effect.dateISO },
    });
  }
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
   * Filtered to STANDING decisions — every exclusion with remaining effect,
   * including one decided in advance whose day has not arrived (launch audit
   * 2026-08-25, finding #7: the removal confirmation promises an undo home
   * here, so hiding the decision until its start day left "0 ACTIVE" and no
   * way back). A `today_only` exclusion still "leaves active Status after
   * that day but remains in history" (Sam's contract) with no sweep to run —
   * the decision stays stored, the arithmetic stops matching, the row goes.
   * `exclusionIsActiveOn` remains the ONE program-effect predicate; standing
   * answers the different question "is there a decision left to change?". */
  for (const exclusion of standingExclusionsOn(snapshot.athletePrefs?.exclusions, todayISO)) {
    if (!activePreferenceExercises.has(exclusion.exercise)) {
      addUnique(out, seen, athleteExclusionModifier(exclusion, todayISO));
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
  const accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  return selectActiveProgramModifiers({
    // ProgramStore's accepted context owns the typed facts. CoachUpdates is a
    // compatibility mirror and must never decide whether My Status can see a
    // saved injury.
    activeConstraints: accepted.activeConstraints,
    temporarySourceFacts: accepted.temporarySourceFacts,
    decisionEntries: decisionLedgerEntries(),
    reversibleAdjustments: useProgramStore.getState().reversibleAdjustmentLedger.adjustments,
    sessionConstraints: useProgramStore.getState().userRemovalConstraints,
    athletePrefs: useAthletePreferencesStore.getState().prefs,
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
    onboardingData: useProfileStore.getState().onboardingData,
    readinessSignalsByDate: useReadinessStore.getState().signalsByDate,
    todayISO,
  });
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
  if (modifier.type === 'injury') {
    return {
      cleared: null,
      remainingActiveCount: modifiers.length,
      rebuildRequired: false,
    };
  }

  let rebuildRequired = false;

  if (modifier.source === 'active_constraint') {
    const store = useCoachUpdatesStore.getState();
    const existing = store.activeConstraints.find((c) => c.id === modifier.sourceId);
    if (existing) {
      // Facts belong to the durable source-fact transaction. This synchronous
      // compatibility helper may clear preferences, never a fact projection.
      if ((existing.temporarySourceFactIds?.length ?? 0) > 0) {
        return { cleared: null, remainingActiveCount: modifiers.length, rebuildRequired: false };
      }
      store.removeActiveConstraint(modifier.sourceId);
      if (useCoachUpdatesStore.getState().activeConstraints.some(c => c.id === modifier!.sourceId)) {
        return { cleared: null, remainingActiveCount: modifiers.length, rebuildRequired: false };
      }
      rebuildRequired = true;
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
        // ── RESTORE'S OTHER HALF MOVED INTO THE OWNER (2026-08-20) ──────────
        // A removal writes TWO facts — the canonical exclusion and the
        // `remove_exercise` action on the ledger — and this call site was the
        // ONLY one that reversed both. `restoreExcludedExercise` annuls the
        // outstanding ledger removal itself now, so every door through the
        // canonical owner gets the whole reversal instead of this one.
        // Nothing about this control's behaviour changed; only where the
        // second write is reversed.
        restoreExcludedExercise(exercise);
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
    remainingActiveCount: remaining.length,
  });

  return {
    cleared: modifier,
    remainingActiveCount: remaining.length,
    rebuildRequired,
  };
}
