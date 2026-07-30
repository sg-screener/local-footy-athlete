/**
 * THE SESSION TYPE CHARTER — no session type exists until four questions are
 * answered.
 *
 * Sam's ruling, 2026-07-30, after the step-1 survey
 * (`docs/SESSION_TYPE_CHARTER_SURVEY_2026-07-30.md`): his programmable
 * vocabulary is Rest, Recovery, Strength, Conditioning, Mobility, Prehab,
 * Gunshow, and each one must answer, with receipts:
 *
 *   (a) WHO MAY PLACE IT     — the generator, the athlete, or a declared fact
 *   (b) WHO CHOOSES IT       — which athlete door reaches it
 *   (c) WHAT IT COUNTS AS    — load, hard days, and whether it is REQUIRED work
 *   (d) WHO AUTHORED ITS CONTENTS — the sheet, pool or template it is drawn from
 *
 * The survey found the app could not answer all four for FIVE of the seven.
 * Rest was a residue ("nothing was placed here"), Recovery was the only type the
 * app placed uninvited with no authored source at any of eight sites, Mobility
 * was authored and unreachable, and Prehab and Gunshow were classifications with
 * no session behind them. Every one of those gaps is a question that was never
 * asked at the moment the type was introduced.
 *
 * WHY THIS IS DATA AND NOT PROSE. A charter in a document is a description, and
 * a description drifts from the thing it describes silently — which is how the
 * app came to offer five words where Sam has seven. Here the four answers are
 * REQUIRED FIELDS: a type with a missing answer does not compile, so "no session
 * type without four answers" is structural rather than remembered.
 * `sessionTypeCharterTests` then binds every answer to the code that implements
 * it, in BOTH directions — no charter claim the code contradicts, and no code
 * behaviour the charter has not ruled.
 *
 * WHY THERE IS A DEBT LIST. The charter records the RULED end state, and the
 * code has not arrived at it yet — stages 2, 3 and 4 of the handover are what
 * bring it there. The alternative to declaring debt would be a charter that
 * merely mirrors today's behaviour, which cannot fail and therefore cannot
 * move anything. So every place the code deviates from a ruled answer is
 * enumerated below with the stage that pays it, and the gate holds FOUR
 * directions on that list:
 *
 *   1. every ruled answer the code satisfies stays satisfied
 *   2. every deviation the gate observes is declared here
 *   3. every deviation declared here is still real — stale debt fails
 *   4. per-type ceilings hold with EQUALITY, so paying debt means lowering the
 *      ceiling in the same commit and no ceiling ever carries slack a future
 *      regression could hide in
 *
 * Direction 3 is the one that is usually missing, and direction 4 is the one my
 * own notes record as the reason a ratchet fails: a global budget lets one unit
 * spend another unit's savings.
 */

import type { PlanChangeCategoryId } from '../utils/planChangeTypes';

/** Sam's programmable vocabulary. Seven, and only these seven. */
export type SessionTypeId =
  | 'rest'
  | 'recovery'
  | 'strength'
  | 'conditioning'
  | 'mobility'
  | 'prehab'
  | 'gunshow';

export const SESSION_TYPE_IDS = [
  'rest',
  'recovery',
  'strength',
  'conditioning',
  'mobility',
  'prehab',
  'gunshow',
] as const;

/**
 * (a) Who may put this on a day.
 *
 * `generator` is the strong claim and the one the survey found unearned: the app
 * placing something the athlete did not ask for and no authored source called
 * for. A type may only claim it when a Bible line or an authored rule INVITES
 * the placement — that is what "uninvited" means, and it is why deleting
 * Recovery's eight generator sites is a charter consequence rather than a taste.
 */
export type PlacementAuthority =
  /** The app may place it as part of building the week. */
  | 'generator'
  /** Only an athlete decision puts it there. */
  | 'athlete'
  /** A declared fact places it — a game, a bye, an illness shutdown. */
  | 'fact';

/**
 * (b) How the athlete reaches it.
 *
 * Never "there is no door": a type the athlete cannot reach at all is a type the
 * charter refuses. Either it has add/swap categories, or it names the other door
 * that chooses it — Rest is chosen by Remove, not by adding a rest session.
 */
export interface ChooserAnswer {
  /** Add / swap categories in the plan-change sheet. */
  readonly categories: readonly PlanChangeCategoryId[];
  /** A named door that is not a category (e.g. Remove), or null. */
  readonly otherDoor: string | null;
}

/**
 * (c) What it counts as.
 *
 * `required` is the Rest law's own predicate, and it is why the field is here
 * rather than in a comment: Sam's rest quota counts days with no REQUIRED work,
 * so "is this required?" is the single question the rest arithmetic asks of a
 * session. Optional work — recovery, mobility, prehab, gunshow — is never
 * required, which is exactly why an athlete adding it can never break their own
 * rest day.
 */
export interface CountingAnswer {
  /** Does it move a Section 18 exposure total? */
  readonly countsTowardLoad: boolean;
  /** May it consume the week's hard-day budget? */
  readonly canBeHardDay: boolean;
  /** Is it REQUIRED work — the predicate the rest quota tests. */
  readonly required: boolean;
}

/**
 * (d) Who authored its contents.
 *
 * `count` is the authored population, so the gate can bind the charter to the
 * SIZE of the source and not merely to its existence. A source that silently
 * empties is a composition that silently becomes invented.
 */
export interface CompositionAnswer {
  readonly kind: 'authored' | 'no_contents';
  /** Module and export, precisely enough to check. Never "Sam said so". */
  readonly source: string;
  /** Authored entries in the source, or null when the type has no contents. */
  readonly count: number | null;
  /**
   * How many distinct authored SESSIONS the app may build of this type, when
   * Sam has ruled a number. Null means he has not.
   *
   * Separate from `count` because they fail differently. `count` catches a
   * source that empties; this catches an app that offers three sessions where
   * seven were ruled — the gap stage 3 closes for strength, and one no
   * exercise-level check can see, because every exercise in those three
   * sessions is perfectly authored.
   */
  readonly sessionVariants: number | null;
}

export interface SessionTypeCharterRow {
  readonly id: SessionTypeId;
  /** (a) Non-empty by charter rule — something must be allowed to place it. */
  readonly placedBy: readonly PlacementAuthority[];
  /** (b) */
  readonly chosenBy: ChooserAnswer;
  /** (c) */
  readonly counting: CountingAnswer;
  /** (d) */
  readonly composition: CompositionAnswer;
  /** Where all four answers come from. A citation, not an assertion. */
  readonly ruling: string;
}

/**
 * THE CHARTER.
 *
 * These are Sam's RULED answers, not a description of today's code. Where the
 * two differ, `CHARTER_DEBT` says so and names the stage that closes it.
 */
export const SESSION_TYPE_CHARTER: Readonly<Record<SessionTypeId, SessionTypeCharterRow>> = {
  /**
   * REST — a decision, not a residue.
   *
   * The survey's finding 5: rest was "no one placed anything", which is why a
   * deletion door could write a schedule fact and why recovery could consume it.
   * Under the charter a rest day is a real answer with an owner: the plan rests
   * a day, the athlete clears one, or a fact (illness, a bye) rests it.
   *
   * And the quota that measures it counts days with NO REQUIRED WORK, so an
   * athlete who adds a foam-rolling session to their Sunday has still rested.
   */
  rest: {
    id: 'rest',
    placedBy: ['generator', 'athlete', 'fact'],
    chosenBy: {
      categories: [],
      otherDoor: 'Remove — the athlete rests a day by taking the work off it, '
        + 'never by adding a rest session',
    },
    counting: { countsTowardLoad: false, canBeHardDay: false, required: false },
    composition: {
      kind: 'no_contents',
      source: 'a rest day has no contents',
      count: null,
      sessionVariants: null,
    },
    ruling: "Sam's Rest law, 2026-07-30: the quota counts days with no REQUIRED "
      + 'work; athlete-added optional sessions never break rest.',
  },

  /**
   * RECOVERY — the athlete's, and only the athlete's.
   *
   * The Bible says "rest OR recovery" and "the user can always add … as
   * optional" (LFA_PROGRAMMING_BIBLE :79, :81, :122, :134). The app resolved that
   * disjunction on the athlete's behalf at eight generator sites, none of which
   * cited a source. The charter gives the choice back.
   */
  recovery: {
    id: 'recovery',
    placedBy: ['athlete'],
    chosenBy: { categories: ['recovery'], otherDoor: null },
    counting: { countsTowardLoad: false, canBeHardDay: false, required: false },
    composition: {
      kind: 'authored',
      source: 'data/mobilityFlowTemplates.ts MOBILITY_FLOW_TEMPLATES',
      count: 10,
      sessionVariants: null,
    },
    ruling: "Sam's rulings 1 and 3, 2026-07-30: recovery counts toward nothing, "
      + 'and the generator never places optional work uninvited.',
  },

  /**
   * STRENGTH — the most authored of the seven, and the only type whose four
   * answers the survey found already true.
   */
  strength: {
    id: 'strength',
    placedBy: ['generator', 'athlete'],
    chosenBy: {
      categories: ['strength_upper', 'strength_lower', 'strength_full'],
      otherDoor: null,
    },
    counting: { countsTowardLoad: true, canBeHardDay: true, required: true },
    composition: {
      kind: 'authored',
      source: 'data/exercisePoolsStrength.ts STRENGTH_POOLS (slot keys), selected '
        + 'through rules/strengthPatternContributions.ts strengthIntent and gated '
        + 'by the locked-list and cue gates',
      count: 10,
      sessionVariants: 7,
    },
    ruling: 'Contract v2 mainStrength and the Section 18 pattern rules; athlete '
      + 'picker Upper / Lower / Full Body (Sam, 2026-07-30).',
  },

  /** CONDITIONING — 55 signed templates, two doors, counts as load. */
  conditioning: {
    id: 'conditioning',
    placedBy: ['generator', 'athlete'],
    chosenBy: {
      categories: ['conditioning_light', 'conditioning_hard'],
      otherDoor: null,
    },
    counting: { countsTowardLoad: true, canBeHardDay: true, required: true },
    composition: {
      kind: 'authored',
      source: 'data/conditioningTemplates.ts CONDITIONING_TEMPLATES (signed off 5c788bc)',
      count: 55,
      sessionVariants: null,
    },
    ruling: 'Contract v2 conditioning.core; templates signed off 5c788bc.',
  },

  /**
   * MOBILITY — authored for months, and unreachable.
   *
   * The Bible grants it outright: "You can always add a recovery or mobility
   * flow to any day as optional" (:122). Ten authored templates exist and are
   * consumed only as an add-on INSIDE recovery, so the athlete has never been
   * able to choose the thing the Bible says they may always add.
   */
  mobility: {
    id: 'mobility',
    placedBy: ['athlete'],
    chosenBy: { categories: [], otherDoor: 'a Mobility category — NOT BUILT (stage 4)' },
    counting: { countsTowardLoad: false, canBeHardDay: false, required: false },
    composition: {
      kind: 'authored',
      source: 'data/mobilityFlowTemplates.ts MOBILITY_FLOW_TEMPLATES',
      count: 10,
      sessionVariants: null,
    },
    ruling: 'LFA_PROGRAMMING_BIBLE :122; Sam 2026-07-30 — 5-8 exercises, warm-up '
      + 'doses, full-body spread, athlete-add only, never hard, never breaks rest.',
  },

  /**
   * PREHAB — 36 authored exercises across 6 pools, confirmed by Sam exactly.
   *
   * Shoulder HEALTH work (external rotation, scap work) stays here, with
   * Accessories — Sam's ruling of 2026-07-30, separating it from the pump delts
   * a Gunshow draws on.
   */
  prehab: {
    id: 'prehab',
    placedBy: ['generator', 'athlete'],
    chosenBy: { categories: ['accessories'], otherDoor: null },
    counting: { countsTowardLoad: false, canBeHardDay: false, required: false },
    composition: {
      kind: 'authored',
      source: 'data/exercisePools.ts GROIN_ADDUCTORS_POOL, CALVES_POOL, '
        + 'LOWER_PREHAB_POOL, TRUNK_ANTI_ROTATION_POOL, SHOULDER_HEALTH_POOL, '
        + 'HAMSTRING_LIGHT_POOL',
      count: 36,
      sessionVariants: null,
    },
    ruling: 'Sam signed the census as delivered, 2026-07-30: 36 across exactly 6 '
      + 'pools, and shoulder health stays with Accessories.',
  },

  /**
   * GUNSHOW — the Bible names it in all three ideal weekly structures.
   *
   * Sam's structure: 2 biceps + 2 triceps + 2 shoulder, 2-3 sets each, drawn
   * from 16 candidates he signed as delivered. "Shoulder" is the PUMP delts
   * pool, not shoulder health.
   *
   * And the rule that makes it honest under restriction: under thin equipment a
   * gunshow gets SMALLER, never padded. No cross-family top-ups — the app never
   * invents to fill a quota.
   */
  gunshow: {
    id: 'gunshow',
    placedBy: ['generator', 'athlete'],
    chosenBy: { categories: ['accessories'], otherDoor: null },
    counting: { countsTowardLoad: false, canBeHardDay: false, required: false },
    composition: {
      kind: 'authored',
      source: 'data/exercisePools.ts BICEPS_POOL (5) + TRICEPS_POOL (5) + DELTS_POOL (6)',
      count: 16,
      sessionVariants: null,
    },
    ruling: 'Sam signed the candidate list as delivered, 2026-07-30, with '
      + 'DELTS_POOL as the shoulder family and shrink-never-pad under thin equipment.',
  },
};

/** The four questions, as a checkable vocabulary. */
export type CharterQuestion = 'placement' | 'chooser' | 'counting' | 'composition';

export const CHARTER_QUESTIONS = ['placement', 'chooser', 'counting', 'composition'] as const;

/**
 * One place the code does not yet answer the way Sam ruled.
 *
 * `deviation` says what the code does TODAY, so the entry can be checked against
 * behaviour rather than believed. `paidBy` names the stage that closes it — or
 * says plainly that nothing is scoped to, which is the only honest thing to
 * write when a gap has surfaced that no ruling covers yet.
 */
export interface CharterDebtEntry {
  readonly type: SessionTypeId;
  readonly question: CharterQuestion;
  /** What the code does today, in terms the gate can observe. */
  readonly deviation: string;
  /** The stage that closes it, or an explicit statement that none does. */
  readonly paidBy: string;
}

/**
 * THE DEBT, ENUMERATED.
 *
 * Every entry is a promise the gate keeps honest in both directions: an entry
 * whose deviation has been fixed FAILS (stale debt is how a ratchet quietly
 * stops ratcheting), and a deviation with no entry fails too.
 */
export const CHARTER_DEBT: readonly CharterDebtEntry[] = [
  // ── Rest: a residue until stage 2 gives it an owner ──
  {
    type: 'rest',
    question: 'placement',
    deviation: 'rest is a RESIDUE — a day is rest iff nothing was placed on it, so '
      + 'no owner places it and the generator emits no rest session for the gate '
      + 'to observe',
    paidBy: 'stage 2 — Rest as a real decision',
  },

  // ── Recovery: the survey's finding 4, and the whole of stage 2 ──
  {
    type: 'recovery',
    question: 'placement',
    deviation: 'the generator places recovery at eight `tier: recovery` sites in '
      + 'coachingEngine.ts, none of which cites an authored source',
    paidBy: 'stage 2 — the recovery deletion',
  },
  {
    type: 'recovery',
    question: 'counting',
    deviation: 'a day carrying only recovery is excluded from the rest quota, so '
      + 'athlete-added recovery breaks the athlete\'s own rest day',
    paidBy: 'stage 2 — Rest as a real decision',
  },
  {
    type: 'recovery',
    question: 'composition',
    deviation: 'contents are INVENTED — the four rows of RECOVERY_FLOW_ROWS in '
      + 'coachRevisionTemplates.ts are hand-typed names that appear in no authored '
      + 'source, and none of the ten mobility templates is consulted',
    paidBy: 'stage 4 — the recovery door draws on the authored mobility templates',
  },

  // ── Mobility: authored, and unreachable ──
  {
    type: 'mobility',
    question: 'placement',
    deviation: 'unobservable — with no door and no session builder, nothing can '
      + 'place a mobility session for the gate to see',
    paidBy: 'stage 4 — the Mobility door',
  },
  {
    type: 'mobility',
    question: 'chooser',
    deviation: 'no Mobility category exists; the templates are reachable only as '
      + 'an add-on inside Recovery',
    paidBy: 'stage 4 — the Mobility door',
  },
  {
    type: 'mobility',
    question: 'counting',
    deviation: 'unobservable — there is no mobility session builder, so the '
      + 'charter\'s counting answer cannot be checked against behaviour at all',
    paidBy: 'stage 4 — the Mobility door',
  },
  {
    type: 'mobility',
    question: 'composition',
    deviation: 'unobservable — the ten authored templates exist and nothing builds '
      + 'a session from them, so there are no contents to trace',
    paidBy: 'stage 4 — the Mobility door',
  },

  // ── Prehab: authored vocabulary, unattributable placement ──
  {
    type: 'prehab',
    question: 'placement',
    deviation: 'unattributable, and worse than the survey read it — the classifier '
      + 'carries one `gunshow` contribution with no `prehab` counterpart, AND the '
      + 'session the Accessories door actually builds never reaches the '
      + '`gunshow_prehab` category at all: it classifies as `lower_strength`',
    paidBy: 'stage 4 — the Accessories door',
  },
  {
    type: 'prehab',
    question: 'counting',
    deviation: 'a day carrying only prehab is excluded from the rest quota, AND the '
      + 'session the Accessories door builds is classified `lower_strength` at HIGH '
      + 'stress, so it consumes a hard day — against Sam\'s ruling 2',
    paidBy: 'stage 2 (rest quota) and stage 4 (the hard-day misclassification)',
  },

  // ── Gunshow: the app draws a name Sam did not sign ──
  {
    type: 'gunshow',
    question: 'placement',
    deviation: 'unattributable — `gunshow_prehab` is ONE SessionCategory covering '
      + 'both types, there is no `tier: gunshow` anywhere, and the session the '
      + 'Accessories door builds classifies as `upper_strength` instead',
    paidBy: 'stage 4 — the Accessories door',
  },
  {
    type: 'gunshow',
    question: 'counting',
    deviation: 'a day carrying only a gunshow is excluded from the rest quota',
    paidBy: 'stage 2 — Rest as a real decision',
  },
  {
    type: 'gunshow',
    question: 'composition',
    deviation: 'the built session draws "Face Pull" from UPPER_BACK_PUMP_POOL — a '
      + 'seventeenth name outside the sixteen Sam signed, and a CROSS-FAMILY draw '
      + 'against his no-top-ups ruling',
    paidBy: 'stage 4 — the Accessories door',
  },

  // ── Strength and conditioning: authored, placed, counted — and still owed ──
  {
    type: 'strength',
    question: 'composition',
    deviation: 'the registry offers four strength templates where Sam ruled seven '
      + 'variants — every exercise in them is authored, which is exactly why no '
      + 'exercise-level gate can see the gap',
    paidBy: 'stage 3 — seven strength variants',
  },
  {
    type: 'conditioning',
    question: 'composition',
    deviation: 'the athlete\'s conditioning doors build from eight registry '
      + 'templates whose single row is the template\'s own label; none of the 55 '
      + 'signed conditioning templates is consulted',
    paidBy: 'stage 5 — the copy sheet and the conditioning door\'s source',
  },
];

export const CHARTER_DEBT_CEILING: Readonly<Record<SessionTypeId, number>> = {
  rest: 1,
  recovery: 3,
  strength: 1,
  conditioning: 1,
  mobility: 4,
  prehab: 2,
  gunshow: 3,
};

/** Debt entries for one type. */
export function charterDebtFor(type: SessionTypeId): readonly CharterDebtEntry[] {
  return CHARTER_DEBT.filter((entry) => entry.type === type);
}

/** Is this (type, question) pair currently excused? */
export function charterDebtCovers(type: SessionTypeId, question: CharterQuestion): boolean {
  return CHARTER_DEBT.some((entry) => entry.type === type && entry.question === question);
}

/**
 * Every category claimed by a charter row.
 *
 * The chooser side of the both-directions bind: a door that no row claims is a
 * door Sam has not ruled, and a row claiming a door that does not exist is a
 * charter promise nothing keeps.
 */
export function charterClaimedCategories(): readonly PlanChangeCategoryId[] {
  const claimed = new Set<PlanChangeCategoryId>();
  for (const id of SESSION_TYPE_IDS) {
    for (const category of SESSION_TYPE_CHARTER[id].chosenBy.categories) {
      claimed.add(category);
    }
  }
  return Array.from(claimed).sort();
}
