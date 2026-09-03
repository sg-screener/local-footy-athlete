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
 *   CONDITIONING_META      conditioning formats
 *   POWER_EXERCISE_POOL    power-block entries (Sam's power spec, wired 2026-07-27)
 *
 * Enforced by: exerciseLockedListTests §5, exerciseContentReconciliationTests,
 * generationVocabularyContractTests §1.
 */

import { POOL_REGISTRY, type ExerciseCategory } from './exercisePools';
import { STRENGTH_POOLS, type PoolSlotKey, type PoolRole } from './exercisePoolsStrength';
import { POWER_EXERCISE_POOL } from '../rules/powerExercisePool';
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
  | 'power_pool_pending'
  | 'load_ruling_pending'
  | 'session_authored_row';

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
    waives: ['video'],
    ruling:
      'Zone-1 cyclical recovery — walking, easy cycling. Not movements to demo. '
      + 'Sam\'s original ruling, formalised with his attribution 2026-07-27 when '
      + 'the reconciliation gate began requiring one for every exemption kind. '
      + 'Sam 2026-09-04 (R-364): the three walks now carry tags and thirteen-region '
      + 'injury ratings through the complete intake; only the video is waived.',
  },
  power_pool_pending: {
    waives: ['pool', 'cue', 'video'],
    ruling:
      'Power exercise with no pool placement. The power pool itself was BUILT and '
      + 'wired on 2026-07-27 (POWER_EXERCISE_POOL + selectPowerExercise), so the '
      + 'seven entries that spec places are no longer exempt. What remains are the '
      + 'speed-lift / contrast names the spec\'s tables do not place: they carry a '
      + 'curated cue and a video, and lack only a pool. Sam: do not invent '
      + 'placement here. Excluded from the AI vocabulary until placed — the app '
      + 'names these, the generator does not.',
  },
  session_authored_row: {
    waives: ['pool', 'tags', 'video'],
    ruling:
      'A row a signed SESSION authors by name — R-129\'s Primer accelerations '
      + '("3 accelerations for 15m at 90%"). Deliberately in NO selectable '
      + 'pool: its signed-copy entry records that pooling it would make a '
      + 'running acceleration eligible inside ordinary gym strength sessions, '
      + 'so it is prescribable only by the session that authors it. It carries '
      + 'a curated cue in Sam\'s own dose words (added when R-130\'s '
      + 'generator-placed Primer made the generation-side cue contract demand '
      + 'one); a 15m run-through has no demo video and none of the strength '
      + 'taxonomy\'s properties, by design.',
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

/** Rows signed sessions author by name — see `session_authored_row`'s ruling. */
export const SESSION_AUTHORED_ROWS = new Set<string>(['Acceleration']);


/**
 * Zone-1 cyclical recovery. Selectable (EASY_CARDIO_POOL) and cued, but not
 * movements to demo.
 */
const ZONE_1_RECOVERY = new Set<string>([
  'Light Walk or Stationary Bike',
  'Incline Treadmill Walk',
  'Outdoor Walk',
]);

/*
 * The `mobility_untagged` kind and its 30-name set were RETIRED on 2026-09-04
 * (Sam, R-364): "mobility must not mean safe for every injury". Every mobility,
 * tissue-quality, breathing and zone-1 recovery exercise now carries tags and
 * thirteen-region injury ratings through the complete intake
 * (docs/EXERCISE_INTAKE_RECOVERY_2026-09-04.md). Nothing waives tags any more.
 */

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
  // Sam's power pool (POWER_EXERCISE_POOL) is now a real selectability source,
  // so the seven entries it places are no longer pending and no longer exempt —
  // Sam authored the two missing cues (2026-07-27) and the completeness gates
  // now cover them like any other selectable exercise.
  //
  // These two are NOT in the spec's pool tables. They are speed-lift and
  // contrast entries whose placement the spec does not decide, so they stay
  // pending. Each HAS a curated cue and video; what they still lack is a pool.
  'Speed Trap Bar Deadlift',
  'Speed Bench',
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
  if (LOAD_RULING_PENDING.has(name)) kinds.push('load_ruling_pending');
  if (SESSION_AUTHORED_ROWS.has(name)) kinds.push('session_authored_row');
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

/**
 * THE POOL A GROUP CAME FROM, AS AN IDENTITY RATHER THAN A SENTENCE.
 *
 * The `label` is prose written for the GENERATION PROMPT — "Upper push
 * horizontal", "Breathing reset". It is the wrong thing for any other reader to
 * match on: it is athlete-hostile, it is free to be reworded for the prompt's
 * benefit, and a `label === 'Mobility'` join breaks silently the day somebody
 * improves the wording.
 *
 * `id` is the pool key itself, so a second reader can ask WHICH POOL this is
 * and be told in the vocabulary's own terms. The Add menu's athlete-facing
 * taxonomy (`utils/addExerciseCandidates`) joins on this, and its map is a
 * TOTAL `Record` over the union — a new pool category stops the build until
 * somebody decides where the athlete finds it.
 */
export type VocabularyGroupId =
  | PoolSlotKey
  | ExerciseCategory
  | 'power'
  | 'conditioning';

export interface VocabularyGroup {
  /** The pool this group IS. Machine identity; never rendered. */
  id: VocabularyGroupId;
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
  trunk_anti_rotation: 'Midline',
  shoulder_health: 'Shoulder health',
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

  const push = (id: VocabularyGroupId, label: string, names: readonly string[]) => {
    const fresh = names.filter((name) => !seen.has(name));
    for (const name of fresh) seen.add(name);
    if (fresh.length > 0) groups.push({ id, label, names: fresh });
  };

  for (const slot of STRENGTH_GROUP_ORDER) {
    push(slot, STRENGTH_GROUP_LABELS[slot], strengthPoolNames(slot));
  }
  for (const [category, pool] of Object.entries(POOL_REGISTRY)) {
    push(
      category as ExerciseCategory,
      REGISTRY_GROUP_LABELS[category] ?? category,
      pool.map((e) => e.name),
    );
  }
  // The 'Recovery flows' group is gone with the flow bundles it enumerated
  // (2026-07-30). Every movement it contributed was a curated pool name — that was
  // the constraint on those bundles — so `POOL_REGISTRY.mobility` above already
  // carries all of them, and the composed flow can only ever draw from there.
  push('power', 'Power', POWER_EXERCISE_POOL.map((entry) => entry.name));
  push('conditioning', 'Conditioning', Object.keys(CONDITIONING_META));

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

// ─── The never-again lock: hardcoded exercise-name literals ───

/**
 * Why a string literal sitting in an exercise-identity position is allowed not
 * to be an exercise name.
 *
 * The census gap Sam caught: the vocabulary switch closed the GENERATOR's
 * naming rights, but said nothing about names hardcoded in CODE. Those bypass
 * every gate — `Medicine Ball Overhead Throw` lived in `buildPowerBlock` for
 * months, and the live "Add exercise" table on the session screen still offers
 * six names the app cannot cue. A literal in a builder is a name the athlete
 * can see, so it must be held to the same vocabulary as a generated one.
 *
 * `hardcodedExerciseNameLockTests` extracts every literal in an exercise
 * identity position and requires it to EITHER resolve to the locked vocabulary
 * OR carry one of these kinds. Nothing silently survives.
 */
export type LiteralExemptionKind =
  | 'not_an_exercise'
  | 'session_label'
  | 'recovery_flow'
  | 'conditioning_prescription'
  | 'dead_mock_fixture'
  | 'awaiting_sam_ruling';

export interface LiteralExemptionSpec {
  ruling: string;
}

export const LITERAL_EXEMPTION_KINDS: Record<LiteralExemptionKind, LiteralExemptionSpec> = {
  not_an_exercise: {
    ruling:
      'A muscle group, category, id or description that happens to sit in an '
      + 'object beside prescription fields. Never rendered as an exercise name.',
  },
  session_label: {
    ruling:
      'The name of a SESSION or block, not a movement — "Upper Body Strength", '
      + '"Conditioning". Rendered as a session title, which has no cue.',
  },
  recovery_flow: {
    ruling:
      'A recovery/mobility FLOW rendered as one card standing for several '
      + 'movements, not a single movement to cue.',
  },
  conditioning_prescription: {
    ruling:
      'A conditioning prescription written as free text ("3 x 8min zone 2 '
      + 'Rower"). Conditioning rows are exempt from the cue contract by render '
      + 'path, so this is a dose, not a name.',
  },
  dead_mock_fixture: {
    ruling:
      'Mock/demo data inside a screen unreachable from App.tsx. UNUSED as of the '
      + 'Phase 1.6 purge (2026-07-25), which deleted every such screen — it held '
      + '"Leg Curl" (a name Sam RETIRED) and "Squat" until then. The kind stays '
      + 'declared because the staleness assertion is what emptied it: the purge '
      + 'removed the files, the sweep stopped finding the literals, and the gate '
      + 'forced the exemptions out. That is the mechanism working, not dead code.',
  },
  awaiting_sam_ruling: {
    ruling:
      'A REAL exercise name that does not resolve to the locked vocabulary. '
      + 'Declared here rather than silently tolerated: each one is listed in the '
      + 'build report with a proposed mapping, and Sam rules. Until then the card '
      + 'renders WITHOUT a cue, which is the defect this kind exists to make loud. '
      + 'UNUSED as of 2026-07-25: the kind surfaced six cueless names in the live '
      + '"Add exercise" table and Sam ruled every one — three as renames onto '
      + 'existing vocabulary, three as redirects onto a different curated movement '
      + 'once it was clear the vocabulary genuinely lacked what they named. The '
      + 'kind stays declared because emptiness is what the gate checks.',
  },
};

/**
 * Every literal the lock has seen, with the kind that excuses it.
 *
 * Kept flat and explicit on purpose: adding a name here is a visible, reviewable
 * act, and `awaiting_sam_ruling` entries are asserted against the report so a
 * real gap cannot be parked and forgotten.
 */
export const LITERAL_EXEMPTIONS: Record<string, LiteralExemptionKind> = {
  // ── Session / block labels ──
  'Conditioning': 'session_label',

  // ── Recovery flows: one card standing for a template ──
  'Mobility Flow': 'recovery_flow',

  // ── Conditioning prescriptions (free-text dose) ──
  '3 x 8min zone 2 Rower': 'conditioning_prescription',
  '3 x 8min zone 2 SkiErg': 'conditioning_prescription',

  /* `'Breathing Reset': 'recovery_flow'` WAS HERE AND IS DELETED (Sam,
   * 2026-08-21: *"delete those 4 things so they never show up again"*).
   *
   * ⚠ **REMOVING THE EXEMPTION IS THE HALF THAT MAKES IT PERMANENT.** The two
   * places that minted the name are gone, but an exemption left behind is a
   * standing permission for the next writer to mint it again and stay green.
   * With the row deleted, the lock now REFUSES `Breathing Reset` — Sam's own
   * `Box Breathing`, `Crocodile Breathing`, `90/90 Breathing` and `Child's Pose
   * with Breathing` are what the app has, and they resolve. */

  // ── REAL exercise names that do not resolve. Sam's ruling owed. ──
  // EMPTY as of 2026-07-25 — Sam ruled all six the lock surfaced. Emptiness is
  // the PROOF, not a comment: `hardcodedExerciseNameLockTests` §4 asserts it, so
  // a name parked here again without a row in the lock report fails the build.
};

/** The exemption kind for a hardcoded literal, or null when none is recorded. */
export function literalExemptionFor(literal: string): LiteralExemptionKind | null {
  return LITERAL_EXEMPTIONS[literal] ?? null;
}

let cachedSet: Set<string> | null = null;
function selectableNameSet(): Set<string> {
  if (!cachedSet) cachedSet = new Set(selectableExerciseNames());
  return cachedSet;
}
