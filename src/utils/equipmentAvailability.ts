import type { EquipmentTag } from '../data/exercisePools';
import type {
  ActiveConstraint,
  ActiveConstraintModifierAffect,
  ActiveEquipmentConstraint,
} from '../store/coachUpdatesStore';
import type {
  ConditioningEquipmentModality,
  EquipmentSelectionCompleteness,
  OnboardingData,
  TrainingLocation,
} from '../types/domain';
import type { EquipmentClass } from './loadEstimation';
import {
  athleteActionDiagnosticHash,
  athleteActionErrorCode,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
} from './athleteActionDiagnostics';
import { todayISOLocal } from './appDate';

export type EquipmentAvailabilityProfile =
  Pick<
    OnboardingData,
    'equipment' | 'equipmentSelectionCompleteness' | 'equipmentAnswer'
  > | null | undefined;

// The seven TEMPORARY_EQUIPMENT_PRESETS are RETIRED (Sam's ruling 5,
// 2026-07-31): the this-week flow is expressed against the athlete's OWN kit
// (EquipmentLimitationSheet + the set_equipment_modifier decision payload),
// never a preset menu nobody signed.

export const FULL_GYM_EQUIPMENT: readonly EquipmentTag[] = [
  'bodyweight',
  'dumbbells',
  'barbell',
  'cables',
  'bands',
  'bench',
  'foam_roller',
  'bike_or_treadmill',
  'pullup_bar',
  'kettlebell',
  'machine',
  'plyo_box',
];

const CURRENT_CHECKLIST_OPTION_TAGS: Record<string, readonly EquipmentTag[]> = {
  'Full Gym': FULL_GYM_EQUIPMENT,
  'Home Gym': ['bodyweight', 'dumbbells', 'bands', 'foam_roller', 'kettlebell'],
  'Barbell & Rack': ['barbell'],
  'Dumbbells Only': ['dumbbells'],
  'Bodyweight Only': ['bodyweight'],
  'Resistance Bands': ['bands'],
  Kettlebells: ['kettlebell'],
  'Cable Machine': ['cables'],
  'Pull-up Bar': ['pullup_bar'],
};

const LEGACY_AND_ALIAS_OPTION_TAGS: Record<string, readonly EquipmentTag[]> = {
  'Full gym': FULL_GYM_EQUIPMENT,
  Gym: FULL_GYM_EQUIPMENT,
  Barbell: ['barbell'],
  Dumbbells: ['dumbbells'],
  Bands: ['bands'],
  Kettlebell: ['kettlebell'],
  Machines: ['machine'],
  Machine: ['machine'],
  Bench: ['bench'],
  'Cardio Equipment': ['bike_or_treadmill'],
  'Pullup Bar': ['pullup_bar'],
  'Pull-up bar': ['pullup_bar'],
  barbell: ['barbell'],
  dumbbells: ['dumbbells'],
  squat_rack: ['barbell'],
  pullup_bar: ['pullup_bar'],
  cable_machine: ['cables'],
  hamstring_curl: ['machine'],
  knee_extension: ['machine'],
  bands: ['bands'],
  kettlebell: ['kettlebell'],
  kettlebells: ['kettlebell'],
  machine: ['machine'],
  machines: ['machine'],
  bench: ['bench'],
  cardio_equipment: ['bike_or_treadmill'],
  Bike: ['bike_or_treadmill'],
  'Stationary Bike': ['bike_or_treadmill'],
  RowErg: ['bike_or_treadmill'],
  Rower: ['bike_or_treadmill'],
  SkiErg: ['bike_or_treadmill'],
  Treadmill: ['bike_or_treadmill'],
};

export const EQUIPMENT_CHECKLIST_OPTION_TAGS: Readonly<Record<string, readonly EquipmentTag[]>> = {
  ...LEGACY_AND_ALIAS_OPTION_TAGS,
  ...CURRENT_CHECKLIST_OPTION_TAGS,
};

function addUnique(tags: EquipmentTag[], next: readonly EquipmentTag[]): void {
  for (const tag of next) {
    if (!tags.includes(tag)) tags.push(tag);
  }
}

function normalizedOptionKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/&/g, 'and');
}

function tagsForChecklistOption(raw: string): readonly EquipmentTag[] | null {
  const direct = EQUIPMENT_CHECKLIST_OPTION_TAGS[raw];
  if (direct) return direct;

  const normalized = normalizedOptionKey(raw);
  for (const [option, tags] of Object.entries(EQUIPMENT_CHECKLIST_OPTION_TAGS)) {
    if (normalizedOptionKey(option) === normalized) return tags;
  }

  return null;
}

const LEGACY_POSITIVE_KEYS = new Set([
  'barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine',
  'hamstring_curl', 'knee_extension', 'bands', 'kettlebell', 'kettlebells',
  'machine', 'machines', 'bench', 'cardio_equipment',
]);

const ALL_CONDITIONING_MODALITIES: readonly ConditioningEquipmentModality[] = [
  'bike_erg', 'air_bike', 'row', 'ski', 'treadmill',
];

// LOCATION_CONDITIONING_MODALITIES is DELETED (Sam's ruling 4, 2026-07-31).
// It granted every athlete all four conditioning machines off a location
// nobody was ever asked, which is how a ski erg reached athletes without one.
// Modalities now come only from the athlete's answer or their own checklist.

export type EquipmentCapabilitySource =
  /** The typed `equipmentAnswer` decision — the only path new saves take. */
  | 'athlete_answer'
  /** A legacy explicitly-complete checklist, lifted at read (L15). */
  | 'complete_selection'
  /** A legacy positive-only checklist: its OWN tags lift, nothing is added.
   * The location union that used to ride on this branch is deleted — an
   * athlete's kit is what they said, never what a constant guessed. */
  | 'legacy_positive_lift'
  /** No equipment input of any kind. Bodyweight floor for reads; generation
   * REFUSES rather than programming a kit nobody declared. */
  | 'unanswered_floor';

export interface ResolvedEquipmentCapabilities {
  tags: EquipmentTag[];
  conditioningModalities: ConditioningEquipmentModality[];
  selectionCompleteness: EquipmentSelectionCompleteness;
  source: EquipmentCapabilitySource;
}

function inferredSelectionCompleteness(
  profile: EquipmentAvailabilityProfile,
  checklist: readonly string[],
): EquipmentSelectionCompleteness {
  const explicit = profile?.equipmentSelectionCompleteness;
  if (explicit) return explicit;
  if (checklist.length === 0) return 'legacy_incomplete';
  if (checklist.some((value) => CURRENT_CHECKLIST_OPTION_TAGS[value] !== undefined)) {
    return 'complete';
  }
  return checklist.every((value) => LEGACY_POSITIVE_KEYS.has(normalizedOptionKey(value)))
    ? 'legacy_incomplete'
    : 'complete';
}

function conditioningModalitiesForOption(raw: string): readonly ConditioningEquipmentModality[] {
  const normalized = normalizedOptionKey(raw);
  if (/^(full_gym|gym|fullgym|cardio_equipment)$/.test(normalized)) {
    return ALL_CONDITIONING_MODALITIES;
  }
  // Legacy checklist options predate the bike split (ruling 2, 2026-07-31):
  // an assault/air-bike option lifts to air_bike, every other bike wording to
  // bike_erg — the lift keeps what was said, it does not grant the sibling.
  if (/^(assault_bike|air_bike|airbike)$/.test(normalized)) return ['air_bike'];
  if (/^(bike|stationary_bike|bikeerg|bike_erg)$/.test(normalized)) return ['bike_erg'];
  if (/^(rowerg|row_erg|rower|rowing_erg)$/.test(normalized)) return ['row'];
  if (/^(skierg|ski_erg)$/.test(normalized)) return ['ski'];
  if (/^(treadmill)$/.test(normalized)) return ['treadmill'];
  return [];
}

function applyConditioningModalityConstraints(
  baseline: ConditioningEquipmentModality[],
  constraints: readonly unknown[] | null | undefined,
  dateISO: string,
): ConditioningEquipmentModality[] {
  let modalities = [...baseline];
  for (const constraint of constraints ?? []) {
    if (!isActiveEquipmentConstraint(constraint)) continue;
    if (!equipmentConstraintAppliesToDate(constraint, dateISO)) continue;
    const declared = (constraint as ActiveEquipmentConstraint & {
      conditioningModalities?: ConditioningEquipmentModality[];
    }).conditioningModalities;
    if (constraint.mode === 'only') {
      if (!constraint.tags.includes('bike_or_treadmill')) modalities = [];
      if (declared) modalities = modalities.filter((modality) => declared.includes(modality));
    } else {
      if (constraint.tags.includes('bike_or_treadmill')) modalities = [];
      if (declared) modalities = modalities.filter((modality) => !declared.includes(modality));
    }
  }
  return Array.from(new Set(modalities));
}

/**
 * Resolve one athlete-visible exercise requirement onto the same equipment
 * tags used by generation. Unknown labels deliberately return null so a final
 * safety pass never deletes work it cannot classify confidently.
 */
export function equipmentTagsForRequirement(
  raw: string,
): readonly EquipmentTag[] | null {
  const value = String(raw ?? '').trim();
  if (!value) return [];
  const normalized = normalizedOptionKey(value);

  if (/^(barbell|trap_bar|rack|squat_rack|barbell_and_rack)$/.test(normalized)) {
    return ['barbell'];
  }
  if (/^(dumbbell|dumbbells|db)$/.test(normalized)) return ['dumbbells'];
  if (/^(cable|cables|cable_machine)$/.test(normalized)) return ['cables'];
  if (/^(machine|machines|leg_press|hamstring_curl|knee_extension)$/.test(normalized)) {
    return ['machine'];
  }
  if (/^(band|bands|resistance_band|resistance_bands)$/.test(normalized)) return ['bands'];
  if (/^(bench)$/.test(normalized)) return ['bench'];
  if (/^(pullup_bar|pull_up_bar)$/.test(normalized)) return ['pullup_bar'];
  if (/^(kettlebell|kettlebells|kb)$/.test(normalized)) return ['kettlebell'];
  if (/^(bike|treadmill|cardio_equipment|bike_or_treadmill|rower|ski_erg)$/.test(normalized)) {
    return ['bike_or_treadmill'];
  }
  if (/^(foam_roller)$/.test(normalized)) return ['foam_roller'];
  // Sam's audit ruling 1, 2026-07-31: the box is askable, so the requirement
  // maps instead of being unanswerable.
  if (/^(box|plyo_box|plyometric_box)$/.test(normalized)) return ['plyo_box'];
  if (/^(bodyweight|none|no_equipment)$/.test(normalized)) return ['bodyweight'];

  const mapped = tagsForChecklistOption(value);
  if (!mapped || mapped.length === 0) return null;
  return mapped;
}

/** True when every recognised requirement is present; unknown labels pass. */
export function equipmentRequirementsAreAvailable(
  requirements: readonly string[] | null | undefined,
  available: readonly EquipmentTag[],
): boolean {
  const availableSet = new Set(available);
  for (const requirement of requirements ?? []) {
    const tags = equipmentTagsForRequirement(requirement);
    if (tags === null) continue;
    if (tags.length > 0 && !tags.some((tag) => availableSet.has(tag))) return false;
  }
  return true;
}

function localTodayISO(): string {
  return todayISOLocal();
}

function dateOnly(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function endOfWeekISO(dateISO: string): string {
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = date.getDay();
  const daysToSunday = dow === 0 ? 0 : 7 - dow;
  date.setDate(date.getDate() + daysToSunday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeekISO(dateISO: string): string {
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = date.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  date.setDate(date.getDate() - daysFromMonday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type EquipmentConstraintExpiryScope = 'this_week' | 'date_range' | 'open_ended';

export function buildActiveEquipmentConstraint(args: {
  id: string;
  mode: ActiveEquipmentConstraint['mode'];
  tags: readonly EquipmentTag[];
  conditioningModalities?: readonly ConditioningEquipmentModality[];
  source: ActiveEquipmentConstraint['source'];
  startDate?: string;
  nowISO?: string;
  scope?: EquipmentConstraintExpiryScope;
  rangeEndDate?: string;
  modifierAffects?: readonly ActiveConstraintModifierAffect[];
  reasonLabel?: string;
}): ActiveEquipmentConstraint {
  const startDate = dateOnly(args.startDate ?? args.nowISO ?? localTodayISO()) ?? localTodayISO();
  const scope = args.scope ?? 'open_ended';
  const expiresAt =
    scope === 'this_week'
      ? endOfWeekISO(startDate)
      : scope === 'date_range'
        ? dateOnly(args.rangeEndDate)
        : undefined;

  const tags: EquipmentTag[] = [];
  addUnique(tags, args.tags);

  return {
    id: args.id,
    type: 'equipment',
    mode: args.mode,
    tags,
    ...(args.conditioningModalities
      ? { conditioningModalities: [...args.conditioningModalities] }
      : {}),
    severity: 0,
    status: 'active',
    startDate,
    lastUpdatedAt: args.nowISO ?? `${startDate}T12:00:00.000Z`,
    source: args.source,
    ...(args.reasonLabel ? { reasonLabel: args.reasonLabel } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    modifierAffects:
      args.modifierAffects && args.modifierAffects.length > 0
        ? [...args.modifierAffects]
        : ['current_week', 'future_generation'],
    rules: [],
    safeFocus: [],
    advice: [],
  };
}

export function temporaryEquipmentConstraintIdForDate(dateISO: string): string {
  return `equipment-temporary:${startOfWeekISO(dateISO)}`;
}

export function upsertActiveEquipmentConstraint(
  constraint: ActiveEquipmentConstraint,
): {
  constraint: ActiveEquipmentConstraint;
  modifierId: string;
  rebuildRequired: true;
} {
  // Keep pure equipment/date projection importable without initializing
  // persisted stores; only this mutation adapter needs Zustand.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachUpdatesStore } = require('../store/coachUpdatesStore');
  useCoachUpdatesStore.getState().upsertActiveConstraint(constraint);
  return {
    constraint,
    modifierId: `program-modifier:active_constraint:${constraint.id}`,
    rebuildRequired: true,
  };
}

function isActiveEquipmentConstraint(value: unknown): value is ActiveEquipmentConstraint {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ActiveConstraint).type === 'equipment' &&
    ((value as ActiveEquipmentConstraint).mode === 'only' ||
      (value as ActiveEquipmentConstraint).mode === 'without') &&
    Array.isArray((value as ActiveEquipmentConstraint).tags)
  );
}

function equipmentConstraintAppliesToDate(
  constraint: ActiveEquipmentConstraint,
  dateISO: string,
): boolean {
  if (constraint.status === 'resolved') return false;
  const date = dateOnly(dateISO) ?? dateISO;
  const start = dateOnly(constraint.startDate);
  if (start && start > date) return false;
  const expires = dateOnly(constraint.expiresAt);
  if (expires && expires < date) return false;
  return true;
}

function applyEquipmentConstraints(
  baseline: EquipmentTag[],
  constraints: readonly unknown[] | null | undefined,
  dateISO: string,
): EquipmentTag[] {
  let tags = [...baseline];
  for (const constraint of constraints ?? []) {
    if (!isActiveEquipmentConstraint(constraint)) continue;
    if (!equipmentConstraintAppliesToDate(constraint, dateISO)) continue;

    if (constraint.mode === 'only') {
      tags = ['bodyweight'];
      addUnique(tags, constraint.tags);
    } else {
      const unavailable = new Set(constraint.tags.filter((tag) => tag !== 'bodyweight'));
      tags = tags.filter((tag) => tag === 'bodyweight' || !unavailable.has(tag));
    }
    if (!tags.includes('bodyweight')) tags.unshift('bodyweight');
  }
  return tags;
}

/**
 * Has this athlete ever ANSWERED the equipment question?
 *
 * True for the typed `equipmentAnswer` (the door being built for it is the
 * onboarding step + profile surface), and for a legacy explicitly-complete
 * selection — a real decision written by the coach baseline door, lifted at
 * read under L15. FALSE for the unauthored 8-tag store constant and every
 * other legacy shape: nobody answered those, and counting them would hand
 * every existing install the fantasy gym as an "answer".
 *
 * This is the predicate generation's refusal reads: an unanswered profile is
 * refused, never defaulted (Sam's ruling 2; the `DEFAULT_PROGRAM` precedent).
 */
export function equipmentAnswered(profile: EquipmentAvailabilityProfile): boolean {
  if (profile?.equipmentAnswer) return true;
  return profile?.equipmentSelectionCompleteness === 'complete';
}

function resolveAnsweredCapabilities(
  answer: NonNullable<NonNullable<EquipmentAvailabilityProfile>['equipmentAnswer']>,
  constraints: readonly unknown[] | null | undefined,
  effectiveDate: string,
): ResolvedEquipmentCapabilities {
  const tags: EquipmentTag[] = ['bodyweight'];
  for (const [tag, possession] of Object.entries(answer.tags)) {
    if (possession === 'have') addUnique(tags, [tag as EquipmentTag]);
  }
  const modalities: ConditioningEquipmentModality[] = [];
  for (const [modality, possession] of Object.entries(answer.modalities)) {
    if (possession === 'have') modalities.push(modality as ConditioningEquipmentModality);
  }

  const constrainedTags = applyEquipmentConstraints(tags, constraints, effectiveDate);
  const constrainedModalities = applyConditioningModalityConstraints(
    modalities, constraints, effectiveDate,
  );
  const finalTags = constrainedModalities.length > 0
    ? Array.from(new Set([...constrainedTags, 'bike_or_treadmill' as const]))
    : constrainedTags.filter((tag) => tag !== 'bike_or_treadmill');
  return {
    tags: finalTags,
    conditioningModalities: constrainedModalities,
    selectionCompleteness: 'complete',
    source: 'athlete_answer',
  };
}

export function resolveEquipmentCapabilities(
  profile: EquipmentAvailabilityProfile,
  constraints?: readonly unknown[] | null,
  dateISO?: string,
): ResolvedEquipmentCapabilities {
  const effectiveDate = dateISO ?? localTodayISO();
  // The typed decision outranks every legacy shape. On this path no location,
  // constant or union branch contributes anything — the athlete's answer is
  // the whole input, which is the point of the equipment unit.
  if (profile?.equipmentAnswer) {
    return resolveAnsweredCapabilities(profile.equipmentAnswer, constraints, effectiveDate);
  }
  // THE LEGACY READ-INGRESS LIFT (L15). A stored checklist contributes exactly
  // the tags its own options name — the location union that used to ride on
  // the incomplete branch is DELETED (Sam's ruling 4, 2026-07-31). It put a
  // full commercial-gym kit and all four conditioning machines on 100% of
  // athletes, because nothing ever collected the location it keyed on.
  const checklist = (profile?.equipment ?? [])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  const completeness = inferredSelectionCompleteness(profile, checklist);
  const tags: EquipmentTag[] = ['bodyweight'];
  const modalities: ConditioningEquipmentModality[] = [];

  let recognized = 0;
  for (const option of checklist) {
    const mapped = tagsForChecklistOption(option);
    if (!mapped) continue;
    recognized++;
    addUnique(tags, mapped);
    modalities.push(...conditioningModalitiesForOption(option));
  }

  const source: EquipmentCapabilitySource = recognized === 0
    ? 'unanswered_floor'
    : completeness === 'legacy_incomplete'
      ? 'legacy_positive_lift'
      : 'complete_selection';

  const constrainedTags = applyEquipmentConstraints(tags, constraints, effectiveDate);
  const constrainedModalities = applyConditioningModalityConstraints(
    Array.from(new Set(modalities)), constraints, effectiveDate,
  );
  const finalTags = constrainedModalities.length > 0
    ? Array.from(new Set([...constrainedTags, 'bike_or_treadmill' as const]))
    : constrainedTags.filter((tag) => tag !== 'bike_or_treadmill');
  return {
    tags: finalTags,
    conditioningModalities: constrainedModalities,
    selectionCompleteness: completeness,
    source,
  };
}

export function resolveEquipmentAvailability(
  profile: EquipmentAvailabilityProfile,
  constraints?: readonly unknown[] | null,
  dateISO?: string,
): EquipmentTag[] {
  return resolveEquipmentCapabilities(profile, constraints, dateISO).tags;
}

// The baseline-equipment save door (saveBaselineEquipmentSelection and its
// plan builder) is DELETED under L15. It wrote the legacy `equipment` +
// completeness shape, and no product screen ever called it — the ownership
// sheet's §1.4 finding. The profile surface commits the canonical
// `equipment_answer` change through `commitProfileProgramTransaction`; the
// coach chat's `baseline_equipment` producer is the one remaining legacy
// writer, named and left for the LR-6 unit.

export function equipmentTagsToSubstituteEquipmentClasses(
  tags: readonly EquipmentTag[] | null | undefined,
): EquipmentClass[] {
  const out: EquipmentClass[] = [];
  const add = (klass: EquipmentClass) => {
    if (!out.includes(klass)) out.push(klass);
  };

  for (const tag of tags ?? []) {
    if (tag === 'bodyweight') add('bodyweight');
    else if (tag === 'dumbbells') add('dumbbell');
    else if (tag === 'barbell') add('barbell');
    else if (tag === 'cables') add('cable');
    else if (tag === 'machine') add('machine');
    else if (tag === 'kettlebell') add('kettlebell');
  }

  return out;
}
