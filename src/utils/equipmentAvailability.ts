import type { EquipmentTag } from '../data/exercisePools';
import {
  useCoachUpdatesStore,
  type ActiveEquipmentConstraint,
} from '../store/coachUpdatesStore';
import type {
  ActiveConstraint,
  ActiveConstraintModifierAffect,
} from '../store/coachUpdatesStore';
import type { OnboardingData, TrainingLocation } from '../types/domain';
import type { EquipmentClass } from './loadEstimation';
import { inferEquipment } from './sessionBuilder';

export type EquipmentAvailabilityProfile =
  Pick<OnboardingData, 'equipment' | 'trainingLocation'> | null | undefined;

export type TemporaryEquipmentPresetId =
  | 'bodyweight_only'
  | 'dumbbells_only'
  | 'home_hotel_gym'
  | 'no_barbell_rack'
  | 'no_machines_cables'
  | 'no_erg_cardio'
  | 'back_to_normal';

export interface TemporaryEquipmentPreset {
  id: TemporaryEquipmentPresetId;
  label: string;
  sub: string;
  mode?: ActiveEquipmentConstraint['mode'];
  tags: readonly EquipmentTag[];
  clearsActiveEquipment?: boolean;
}

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
};

export const EQUIPMENT_CHECKLIST_OPTION_TAGS: Readonly<Record<string, readonly EquipmentTag[]>> = {
  ...LEGACY_AND_ALIAS_OPTION_TAGS,
  ...CURRENT_CHECKLIST_OPTION_TAGS,
};

export const TEMPORARY_EQUIPMENT_PRESETS: readonly TemporaryEquipmentPreset[] = [
  {
    id: 'bodyweight_only',
    label: 'Bodyweight only',
    sub: 'Use bodyweight options this week',
    mode: 'only',
    tags: ['bodyweight'],
  },
  {
    id: 'dumbbells_only',
    label: 'Dumbbells only',
    sub: 'Use dumbbell/bodyweight options this week',
    mode: 'only',
    tags: ['bodyweight', 'dumbbells'],
  },
  {
    id: 'home_hotel_gym',
    label: 'Home / hotel gym',
    sub: 'Use bodyweight, dumbbells and bands this week',
    mode: 'only',
    tags: ['bodyweight', 'dumbbells', 'bands'],
  },
  {
    id: 'no_barbell_rack',
    label: 'No barbell/rack',
    sub: 'Avoid barbell work this week',
    mode: 'without',
    tags: ['barbell'],
  },
  {
    id: 'no_machines_cables',
    label: 'No machines/cables',
    sub: 'Avoid machine and cable work this week',
    mode: 'without',
    tags: ['machine', 'cables'],
  },
  {
    id: 'no_erg_cardio',
    label: 'No erg/cardio machines',
    sub: 'Avoid cardio-machine options this week',
    mode: 'without',
    tags: ['bike_or_treadmill'],
  },
  {
    id: 'back_to_normal',
    label: 'Back to normal',
    sub: 'Clear the temporary equipment limit',
    tags: [],
    clearsActiveEquipment: true,
  },
];

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

function fallbackTrainingLocation(profile: EquipmentAvailabilityProfile): TrainingLocation {
  return profile?.trainingLocation ?? 'Commercial gym';
}

function localTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

export function temporaryEquipmentPresetById(
  presetId: TemporaryEquipmentPresetId,
): TemporaryEquipmentPreset {
  const preset = TEMPORARY_EQUIPMENT_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) {
    throw new Error(`Unknown temporary equipment preset: ${presetId}`);
  }
  return preset;
}

export function buildTemporaryEquipmentConstraint(args: {
  presetId: Exclude<TemporaryEquipmentPresetId, 'back_to_normal'>;
  date: string;
  todayISO?: string;
  source?: ActiveEquipmentConstraint['source'];
}): ActiveEquipmentConstraint {
  const preset = temporaryEquipmentPresetById(args.presetId);
  if (!preset.mode || preset.clearsActiveEquipment) {
    throw new Error(`Temporary equipment preset cannot build a constraint: ${args.presetId}`);
  }
  return buildActiveEquipmentConstraint({
    id: temporaryEquipmentConstraintIdForDate(args.date),
    mode: preset.mode,
    tags: preset.tags,
    source: args.source ?? 'tap',
    startDate: args.date,
    nowISO: args.todayISO,
    scope: 'this_week',
    modifierAffects: ['current_week'],
    reasonLabel: preset.label,
  });
}

export function upsertActiveEquipmentConstraint(
  constraint: ActiveEquipmentConstraint,
): {
  constraint: ActiveEquipmentConstraint;
  modifierId: string;
  rebuildRequired: true;
} {
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

export function resolveEquipmentAvailability(
  profile: EquipmentAvailabilityProfile,
  constraints?: readonly unknown[] | null,
  dateISO?: string,
): EquipmentTag[] {
  const tags: EquipmentTag[] = ['bodyweight'];
  const checklist = (profile?.equipment ?? [])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);

  if (checklist.length === 0) {
    addUnique(tags, inferEquipment(fallbackTrainingLocation(profile)));
    return applyEquipmentConstraints(tags, constraints, dateISO ?? localTodayISO());
  }

  let recognized = 0;
  for (const option of checklist) {
    const mapped = tagsForChecklistOption(option);
    if (!mapped) continue;
    recognized++;
    addUnique(tags, mapped);
  }

  if (recognized === 0) {
    addUnique(tags, inferEquipment(fallbackTrainingLocation(profile)));
  }

  return applyEquipmentConstraints(tags, constraints, dateISO ?? localTodayISO());
}

function sameEquipmentTagSet(
  left: readonly EquipmentTag[],
  right: readonly EquipmentTag[],
): boolean {
  return left.length === right.length && left.every((tag) => right.includes(tag));
}

export interface BaselineEquipmentSavePlan {
  selectedEquipment: string[];
  nextProfile: OnboardingData;
  previousResolvedEquipment: EquipmentTag[];
  nextResolvedEquipment: EquipmentTag[];
  resolvedEquipmentChanged: boolean;
  rebuildRequired: boolean;
  message: 'Equipment updated. Your program was refreshed.' | 'Equipment saved.';
}

export interface BaselineEquipmentSaveResult extends BaselineEquipmentSavePlan {
  profileUpdated: true;
  refreshed: boolean;
}

export function buildBaselineEquipmentSavePlan(
  profile: OnboardingData,
  selectedEquipment: readonly string[],
  dateISO: string = localTodayISO(),
): BaselineEquipmentSavePlan {
  const selected = selectedEquipment.map((item) => String(item));
  const nextProfile: OnboardingData = {
    ...profile,
    equipment: selected,
  };
  const previousResolvedEquipment = resolveEquipmentAvailability(profile, null, dateISO);
  const nextResolvedEquipment = resolveEquipmentAvailability(nextProfile, null, dateISO);
  const resolvedEquipmentChanged = !sameEquipmentTagSet(
    previousResolvedEquipment,
    nextResolvedEquipment,
  );
  return {
    selectedEquipment: selected,
    nextProfile,
    previousResolvedEquipment,
    nextResolvedEquipment,
    resolvedEquipmentChanged,
    rebuildRequired: resolvedEquipmentChanged,
    message: resolvedEquipmentChanged
      ? 'Equipment updated. Your program was refreshed.'
      : 'Equipment saved.',
  };
}

export function saveBaselineEquipmentSelection(args: {
  profile: OnboardingData;
  selectedEquipment: readonly string[];
  dateISO?: string;
  updateOnboardingData: (data: Pick<OnboardingData, 'equipment'>) => void;
  refreshProgram?: (nextProfile: OnboardingData) => void;
}): BaselineEquipmentSaveResult {
  const plan = buildBaselineEquipmentSavePlan(
    args.profile,
    args.selectedEquipment,
    args.dateISO,
  );
  if (plan.rebuildRequired) {
    args.refreshProgram?.(plan.nextProfile);
  }
  args.updateOnboardingData({ equipment: plan.selectedEquipment });
  return {
    ...plan,
    profileUpdated: true,
    refreshed: plan.rebuildRequired && typeof args.refreshProgram === 'function',
  };
}

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
