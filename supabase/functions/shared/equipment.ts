/**
 * Minimal equipment contract shared by edge-generation code.
 *
 * The client remains the owner of resolving onboarding selections plus active
 * temporary constraints. Edge functions receive that resolved tag set and use
 * this module only to match database `equipment_required` labels against it.
 */

export const CANONICAL_EQUIPMENT_TAGS = [
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
] as const;

export type CanonicalEquipmentTag = typeof CANONICAL_EQUIPMENT_TAGS[number];

export interface LegacyEquipmentProfile {
  has_barbell?: boolean | null;
  has_dumbbells?: boolean | null;
}

const TAG_SET = new Set<string>(CANONICAL_EQUIPMENT_TAGS);

function normalizedLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/&/g, 'and');
}

/** Undefined/null means an old payload; an explicit array is authoritative. */
export function normalizeResolvedEquipmentTags(
  value: unknown,
): CanonicalEquipmentTag[] | null {
  if (!Array.isArray(value)) return null;
  const tags: CanonicalEquipmentTag[] = ['bodyweight'];
  for (const item of value) {
    const normalized = normalizedLabel(String(item ?? ''));
    if (!TAG_SET.has(normalized)) continue;
    const tag = normalized as CanonicalEquipmentTag;
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** Unknown requirement labels intentionally pass instead of deleting work. */
export function canonicalTagForExerciseRequirement(
  requirement: string,
): CanonicalEquipmentTag | null {
  const value = normalizedLabel(String(requirement ?? ''));
  if (!value) return 'bodyweight';
  if (/^(barbell|barbells|trap_bar|rack|squat_rack|barbell_and_rack)$/.test(value)) return 'barbell';
  if (/^(dumbbell|dumbbells|db)$/.test(value)) return 'dumbbells';
  if (/^(cable|cables|cable_machine)$/.test(value)) return 'cables';
  if (/^(machine|machines|leg_press|hamstring_curl|knee_extension)$/.test(value)) return 'machine';
  if (/^(band|bands|resistance_band|resistance_bands)$/.test(value)) return 'bands';
  if (value === 'bench') return 'bench';
  if (/^(pullup_bar|pull_up_bar)$/.test(value)) return 'pullup_bar';
  if (/^(kettlebell|kettlebells|kb)$/.test(value)) return 'kettlebell';
  if (/^(bike|treadmill|cardio_equipment|bike_or_treadmill|rower|ski_erg)$/.test(value)) {
    return 'bike_or_treadmill';
  }
  if (value === 'foam_roller') return 'foam_roller';
  if (/^(bodyweight|body_weight|none|no_equipment)$/.test(value)) return 'bodyweight';
  return null;
}

function legacyRequirementIsAvailable(
  requirement: string,
  profile: LegacyEquipmentProfile,
): boolean {
  const tag = canonicalTagForExerciseRequirement(requirement);
  if (tag === 'barbell') return profile.has_barbell !== false;
  if (tag === 'dumbbells') return profile.has_dumbbells !== false;
  // The old profile has no reliable fields for other equipment classes.
  return true;
}

/**
 * Canonical tags win whenever supplied—even if legacy booleans disagree.
 * Old requests without tags retain the legacy barbell/dumbbell fallback.
 */
export function edgeExerciseRequirementsAreAvailable(args: {
  requirements: readonly string[] | null | undefined;
  resolvedEquipmentTags?: unknown;
  legacyProfile?: LegacyEquipmentProfile | null;
}): boolean {
  const resolved = normalizeResolvedEquipmentTags(args.resolvedEquipmentTags);
  if (resolved) {
    const available = new Set<CanonicalEquipmentTag>(resolved);
    return (args.requirements ?? []).every((requirement) => {
      const requiredTag = canonicalTagForExerciseRequirement(requirement);
      return requiredTag === null || available.has(requiredTag);
    });
  }

  const legacy = args.legacyProfile ?? {};
  return (args.requirements ?? []).every((requirement) =>
    legacyRequirementIsAvailable(requirement, legacy));
}
