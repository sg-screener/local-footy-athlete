/**
 * selectableExerciseVocabulary — the single owner of "which exercises exist".
 *
 * ONE CIRCLE (Sam's locked-list changeset, 2026-07-24):
 *
 *   AI generation vocabulary ≡ SELECTABLE POOL MEMBERSHIP, exactly.
 *
 * Before this, three different sets claimed to answer the question:
 *   1. `EXERCISE_CUES` keys — what the prompt offered ("has a cue" ⇒ selectable).
 *   2. the pools — what a builder could actually select.
 *   3. `coach-chat`'s hand-copied `MOVEMENT PATTERNS` list in the system prompt.
 *
 * Three representations means three ways to drift, and each drift renders as
 * the same athlete-visible failure: a card the app cannot cue, or a movement
 * Sam curated that nothing can ever prescribe. The census (2026-07-24) counted
 * 42 orphans across those seams.
 *
 * So membership of a pool a live builder selects from is now the ONLY
 * definition of "this exercise exists", and everything else derives from it:
 * the generation prompt (`curatedExerciseVocabulary`), and the completeness
 * invariants that fail the build in BOTH directions —
 *   - a selectable pool entry with no cue or no video, and
 *   - a curated cue no pool can prescribe
 * are both build failures unless a TYPED EXEMPTION KIND covers the specific
 * field. A typed kind states WHY a name is exempt, so the build can check the
 * reason still holds; a bare name whitelist rots silently into a hiding place.
 *
 * The four selectable systems are the ones the census proved a live builder
 * selects from (`selectPoolEntry`/`getPool`, `POOL_REGISTRY`,
 * `attachRecoveryAddonsToWeek`, `resolveConditioning`, `sessionBuilder`):
 *
 *   STRENGTH_POOLS         anchors + accessories, per (slot, role)
 *   POOL_REGISTRY          arms / prehab / core / mobility / recovery
 *   MOBILITY_FLOW_TEMPLATES recovery flow movements
 *   CONDITIONING_META      conditioning formats
 *
 * Enforced by: exerciseLockedListTests §5, exerciseContentReconciliationTests,
 * generationVocabularyContractTests §1.
 */

import { POOL_REGISTRY } from './exercisePools';
import { STRENGTH_POOLS, type PoolSlotKey, type PoolRole } from './exercisePoolsStrength';
import { MOBILITY_FLOW_TEMPLATES } from './mobilityFlowTemplates';
import { CONDITIONING_META } from './exerciseTags';

// ─── Typed exemption kinds ───

/**
 * Why a name is allowed to be incomplete. There are exactly four reasons, each
 * a recorded Sam ruling. Adding a fifth is a design decision, not a whitelist
 * edit — which is the point of typing them.
 */
export type ContentExemptionKind =
  | 'conditioning_format'
  | 'zone1_recovery'
  | 'mobility_untagged'
  | 'power_pool_pending'
  | 'load_ruling_pending';

/** The completeness fields an exemption kind can waive. */
export type ContentField = 'cue' | 'video' | 'tags' | 'pool' | 'load';

export interface ExemptionKindSpec {
  waives: readonly ContentField[];
  ruling: string;
}

export const EXEMPTION_KINDS: Record<ContentExemptionKind, ExemptionKindSpec> = {
  conditioning_format: {
    waives: ['cue', 'video', 'tags'],
    ruling:
      'A session format, not a movement. Nothing to demo (Sam, locked-list NOTES: '
      + '"Conditioning formats: no videos by design"), and it renders the '
      + 'conditioning family cue rather than a per-movement one.',
  },
  zone1_recovery: {
    waives: ['video', 'tags'],
    ruling:
      'Zone-1 cyclical recovery — walking, skipping, easy cycling. Not movements '
      + 'to demo, and they carry none of the strength taxonomy\'s properties.',
  },
  mobility_untagged: {
    waives: ['tags'],
    ruling:
      'EXERCISE_TAGS is the STRENGTH taxonomy (movement pattern, load, fatigue, '
      + 'DOMS, injury ratings). Stretching, breathing and tissue work carry none '
      + 'of those properties. Sam 2026-07-24: by design, not an orphan.',
  },
  power_pool_pending: {
    waives: ['pool', 'cue', 'video'],
    ruling:
      'Power exercise. Its pool placement is owned by '
      + 'docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md, which is APPROVED but NOT '
      + 'BUILT (selectPowerExercise does not exist; buildPowerBlock still '
      + 'hardcodes identity). Sam, locked-list: wire it where that spec is built, '
      + 'do not invent placement here. Excluded from the AI vocabulary until '
      + 'placed — the app names these, the generator does not.',
  },
  load_ruling_pending: {
    waives: ['load'],
    ruling:
      'A genuinely loaded addition from Sam\'s locked list whose load NUMBERS he '
      + 'rules on line by line. The pool entry ships; the ratio does not. '
      + 'estimateStartingWeight falls through to the tag heuristic meanwhile, so '
      + 'the card is never blank — just not yet anchored to a Sam-approved '
      + 'ratio. Mirrored by the changeset\'s "PROPOSED — awaiting Sam" table; '
      + 'exerciseLockedListTests §8 fails if the two diverge in either direction.',
  },
};

/**
 * Loaded additions awaiting Sam's line-by-line load ruling.
 *
 * EMPTY as of 2026-07-25 — Sam ruled all seven (High Box Squat at 1.2 x Box
 * Squat, Glute Bridge as bodyweight-with-optional, the rest as proposed). The
 * kind stays declared on purpose: emptiness is the PROOF, not a comment.
 * `exerciseLockedListTests` §8 fails the build the moment anything is parked
 * here without a RULED row in the changeset, and the reconciliation suite's
 * load assertion no longer has anything to forgive.
 *
 * It lives with the other typed kinds rather than in a test file because two
 * suites need it (content reconciliation and the canonicalisation anchor
 * check). A second copy would be a second thing to forget.
 */
export const LOAD_RULING_PENDING = new Set<string>([]);

/**
 * Zone-1 cyclical recovery. Selectable (EASY_CARDIO_POOL) and cued, but not
 * movements to demo.
 */
const ZONE_1_RECOVERY = new Set<string>([
  'Light Walk or Stationary Bike',
  'Incline Treadmill Walk',
  'Outdoor Walk',
  'Light Skipping',
]);

/**
 * Mobility / breathing / tissue work — cued and demoed, outside the strength
 * taxonomy.
 */
const MOBILITY_UNTAGGED = new Set<string>([
  '90/90 Breathing', 'Adductor Rockback', 'ATG Split Squat', 'Box Breathing',
  'Calf Stretch', 'Cat-Cow', 'Chest / Pec Stretch (Doorway)',
  "Child's Pose with Breathing", 'Couch Stretch', 'Crocodile Breathing',
  'Dead Hang', 'Deep Squat Hold', 'Elephant Walks',
  'Foam Roll — Calves & Outer Shins', 'Foam Roll — Hip Flexor, Quad, Adductors',
  'Foam Roll — IT Band', 'Foam Roll — Lats', 'Foam Roll — T-Spine',
  'Hip 90/90 Stretch', 'Lacrosse Ball Glute Release', 'Lat Stretch',
  'Open Book Thoracic Rotation', 'Pigeon Stretch', 'QL Back Extension',
  'Toe Stretch', "World's Greatest Stretch",
]);

/**
 * The power block's vocabulary. `buildPowerBlock` names these directly; the
 * pool that should own them is specified and approved but not built, so their
 * placement — and therefore their presence in the AI vocabulary — waits for
 * that unit rather than being guessed here.
 *
 * Mirrored by the POWER — STAGED table in
 * docs/EXERCISE_LOCKED_LIST_CHANGESET_2026-07-24.md; exerciseLockedListTests §6
 * fails if the two diverge.
 */
export const POWER_POOL_PENDING = new Set<string>([
  'Vertical Jump',
  'Explosive Push-up',
  'Pogo Hops',
  'Kneeling Jump',
  'Lateral Jump',
  'Speed Trap Bar Deadlift',
  'Speed Bench',
  'RFE Split Squat Jump',
]);

/**
 * Every exemption kind covering a name — a LIST, because the reasons compose:
 * `Speed Trap Bar Deadlift` is both awaiting pool placement (power) and
 * awaiting a load ruling, and collapsing those to one kind would silently drop
 * whichever came second.
 *
 * Conditioning is derived from `CONDITIONING_META` rather than listed, so a
 * conditioning format Sam adds is exempt the moment it becomes selectable —
 * the same derive-don't-copy rule the vocabulary itself follows.
 */
export function exemptionsFor(name: string): ContentExemptionKind[] {
  const kinds: ContentExemptionKind[] = [];
  if (CONDITIONING_META[name]) kinds.push('conditioning_format');
  if (ZONE_1_RECOVERY.has(name)) kinds.push('zone1_recovery');
  if (POWER_POOL_PENDING.has(name)) kinds.push('power_pool_pending');
  if (MOBILITY_UNTAGGED.has(name)) kinds.push('mobility_untagged');
  if (LOAD_RULING_PENDING.has(name)) kinds.push('load_ruling_pending');
  return kinds;
}

/** True when any recorded exemption waives `field` for `name`. */
export function isExempt(name: string, field: ContentField): boolean {
  return exemptionsFor(name).some((kind) => EXEMPTION_KINDS[kind].waives.includes(field));
}

/** True when `name` carries the specific exemption `kind`. */
export function hasExemption(name: string, kind: ContentExemptionKind): boolean {
  return exemptionsFor(name).includes(kind);
}

// ─── Selectable pool membership ───

export interface VocabularyGroup {
  /** Human-readable movement group, used to structure the generation prompt. */
  label: string;
  names: string[];
}

/** The prompt's group order — compounds first, then accessories, then support. */
const STRENGTH_GROUP_LABELS: Record<PoolSlotKey, string> = {
  squat: 'Lower squat',
  hinge: 'Lower hinge',
  horizontal_push: 'Upper push horizontal',
  vertical_push: 'Upper push vertical',
  horizontal_pull: 'Upper pull horizontal',
  vertical_pull: 'Upper pull vertical',
  plyo: 'Lower plyometric',
  carry: 'Carries',
  isolation_upper: 'Accessories upper',
  isolation_lower: 'Accessories lower',
};

const STRENGTH_GROUP_ORDER: PoolSlotKey[] = [
  'squat', 'hinge', 'horizontal_push', 'vertical_push',
  'horizontal_pull', 'vertical_pull', 'plyo', 'carry',
  'isolation_upper', 'isolation_lower',
];

/**
 * `POOL_REGISTRY` categories, grouped for the prompt. The registry's own
 * category keys are the grouping — no second taxonomy.
 */
const REGISTRY_GROUP_LABELS: Record<string, string> = {
  biceps: 'Arms — biceps',
  triceps: 'Arms — triceps',
  delts: 'Shoulders',
  upper_back_pump: 'Upper back',
  groin_adductors: 'Groin / adductors',
  calves: 'Calves',
  lower_prehab: 'Lower prehab',
  trunk_anti_rotation: 'Core / trunk',
  shoulder_health: 'Shoulder health',
  hamstring_light: 'Hamstring (light)',
  tissue_quality: 'Tissue quality',
  mobility: 'Mobility',
  easy_cardio: 'Easy cardio (zone 1)',
  breathing_reset: 'Breathing reset',
};

function strengthPoolNames(slot: PoolSlotKey): string[] {
  const names: string[] = [];
  for (const role of ['anchor', 'accessory'] as PoolRole[]) {
    for (const entry of STRENGTH_POOLS[slot][role].entries) names.push(entry.name);
  }
  return names;
}

/**
 * Selectable pool membership, grouped by the pool that owns each name.
 *
 * The grouping is what lets the generation prompt teach movement patterns AND
 * names from one derived source — which is why `coach-chat`'s hand-copied
 * MOVEMENT PATTERNS list could be deleted rather than kept in sync.
 */
export function selectableVocabularyGroups(): VocabularyGroup[] {
  const groups: VocabularyGroup[] = [];
  const seen = new Set<string>();

  const push = (label: string, names: readonly string[]) => {
    const fresh = names.filter((name) => !seen.has(name));
    for (const name of fresh) seen.add(name);
    if (fresh.length > 0) groups.push({ label, names: fresh });
  };

  for (const slot of STRENGTH_GROUP_ORDER) {
    push(STRENGTH_GROUP_LABELS[slot], strengthPoolNames(slot));
  }
  for (const [category, pool] of Object.entries(POOL_REGISTRY)) {
    push(REGISTRY_GROUP_LABELS[category] ?? category, pool.map((e) => e.name));
  }
  push(
    'Recovery flows',
    MOBILITY_FLOW_TEMPLATES.flatMap((t) => t.movements.map((m) => m.name)),
  );
  push('Conditioning', Object.keys(CONDITIONING_META));

  return groups;
}

/**
 * Every selectable exercise name, de-duplicated and alphabetical.
 *
 * THIS is the vocabulary. `curatedExerciseVocabulary()` returns it verbatim,
 * so the prompt can only ever offer what a pool can actually select.
 */
export function selectableExerciseNames(): string[] {
  const names = new Set<string>();
  for (const group of selectableVocabularyGroups()) {
    for (const name of group.names) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Fast membership test over the same set. */
export function isSelectable(name: string): boolean {
  return selectableNameSet().has(name);
}

let cachedSet: Set<string> | null = null;
function selectableNameSet(): Set<string> {
  if (!cachedSet) cachedSet = new Set(selectableExerciseNames());
  return cachedSet;
}
