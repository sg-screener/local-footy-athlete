import {
  useCoachUpdatesStore,
  type ActiveConstraint,
  type ActiveConstraintModifierAffect,
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
import { removeInjuryOverridesForWeek } from './applyAdjustmentEvents';
import { getMondayStr } from './sessionResolver';
import { decideOverrideSweep } from './weekRebuild';
import { buildReadinessActiveConstraints } from './readinessConstraints';
import { todayISOLocal } from './appDate';
import { formatExerciseDisplayName } from './exerciseDisplay';
import { logger } from './logger';
import type { AthletePoolPrefs } from '../data/exercisePoolsStrength';
import type {
  OnboardingData,
  ProgramAvailabilityConstraint,
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
  | 'readiness_signal';

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

function isBeforeISO(left: string | undefined, right: string): boolean {
  if (!left) return false;
  return left < right;
}

function isAffect(value: unknown): value is ActiveProgramModifierAffect {
  return value === 'current_day' ||
    value === 'current_week' ||
    value === 'future_generation';
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
  return parsed.length > 0 ? parsed : fallback;
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
    affects: c.modifierAffects ?? ['current_week', 'future_generation'],
    actions: [
      { kind: 'clear_injury', label: isSerious ? "I've been cleared" : "I'm all good now" },
      { kind: 'update_injury', label: isSerious ? 'Update issue' : 'Update injury' },
    ],
    payload: {
      constraintId: c.id,
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
  const fallbackAffects: ActiveProgramModifierAffect[] =
    'appliesToDate' in c && c.appliesToDate ? ['current_day'] : ['current_week'];
  const sourceConstraint = c as ActiveConstraint;

  return {
    id: modifierId(source, c.id),
    source,
    sourceId: c.id,
    type: isCoachRestriction ? 'coach_restriction' : 'temporary_status',
    title: modifierString(sourceConstraint, 'modifierTitle') ?? fallbackTitle,
    body: modifierString(sourceConstraint, 'modifierBody') ?? fallbackBody,
    severity: 'severity' in c ? c.severity : undefined,
    affects: modifierAffects(sourceConstraint, fallbackAffects),
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
      date: 'appliesToDate' in c ? c.appliesToDate : undefined,
      expiresAt: expiresAt(sourceConstraint),
      overrideDates: linkedOverrideDates(sourceConstraint),
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
  if (!modifier || seen.has(modifier.id)) return;
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
      injuryModifier(
        legacyActiveInjuryConstraint(snapshot.activeInjury),
        'legacy_active_injury',
      ),
    );
  }

  const activePreferenceExercises = new Set<string>();
  const activePreferenceAlternatives = new Set<string>();

  for (const constraint of activeConstraints) {
    if (!constraint || constraint.status === 'resolved') continue;
    if (constraint.type === 'injury') {
      addUnique(out, seen, injuryModifier(constraint, 'active_constraint'));
    } else if (constraint.type === 'preference') {
      if (constraint.exercise) activePreferenceExercises.add(constraint.exercise);
      if (constraint.alternative) activePreferenceAlternatives.add(constraint.alternative);
      addUnique(out, seen, preferenceModifier(constraint));
    } else {
      addUnique(out, seen, statusModifier(constraint, 'active_constraint'));
    }
  }

  const todaySignal = snapshot.readinessSignalsByDate?.[todayISO];
  for (const constraint of buildReadinessActiveConstraints(todaySignal)) {
    addUnique(out, seen, statusModifier(constraint as any, 'readiness_signal'));
  }

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
      if (existing.type === 'injury') removeInjuryOverridesForWeek(getMondayStr(0));
    } else if (store.activeInjury) {
      clearedOverrideDates = removeOverridesForModifierSource(modifier.sourceId, null);
      store.setActiveInjury(null);
      removeInjuryOverridesForWeek(getMondayStr(0));
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
    removeInjuryOverridesForWeek(getMondayStr(0));
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
