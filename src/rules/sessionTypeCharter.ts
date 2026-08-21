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
 *
 * WHAT THE GATE CANNOT SEE YET, stated so nobody reads a green run as more than
 * it is. Placement is observed over the GENERATOR's output — the microcycles a
 * generated program contains. It does not observe the RESOLVER, and the resolver
 * is a second placer.
 *
 * TWO OF THE RESOLVER'S THREE RECOVERY PLACEMENTS ARE NOW GONE. Stage 2 removed its
 * ability to conjure one onto an EMPTY G+1 (that variant made the deletion door
 * lie). The 2026-07-30 placement unit removed the last fill pass —
 * `resolveWeekWithConditioning`'s pass 3, which put a derived recovery session on
 * every remaining empty day. It had survived every earlier sweep because nothing
 * could reach it: the generator filled the spare days first, so the pass never saw
 * an empty one. Deleting the day-based accessory placements (R2-R5) made empty days
 * appear and it claimed one immediately, on a G+1, where the athlete then could not
 * delete it — `athleteSessionDeletionTests` regression 6 again.
 *
 * WHAT IS DELIBERATELY LEFT: `applyGameProximity` still replaces a PLANNED G+1
 * session with a derived recovery session when one is there to replace. Replacing
 * planned work the day after a game is a different and heavier question than filling
 * a blank day, and it is scoped to the recovery door with stage 4. It is prose rather
 * than a `CHARTER_DEBT` entry ONLY because this gate has no observation that would
 * make such an entry checkable — declaring debt the gate cannot verify would be the
 * stale-debt failure with extra steps.
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
// BIBLE_ANCHOR: optional_placement_five_conditions
// BIBLE_ANCHOR: four_questions_signed_rule
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
      // THE CITATION WAS WRONG, and retiring the bundles is what exposed it. It
      // named `MOBILITY_FLOW_TEMPLATES` — ten groupings Sam does not recognise —
      // while `buildDerivedSession('recovery')` has always drawn from the four
      // recovery pools instead. The charter now cites what the code does.
      source: 'data/exercisePools.ts TISSUE_QUALITY_POOL + MOBILITY_POOL + '
        + 'EASY_CARDIO_POOL + BREATHING_RESET_POOL, composed by '
        + "utils/sessionBuilder.ts buildDerivedSession('recovery')",
      /* 34 -> 33 on 2026-08-21: `Light Skipping` deleted from the master sheet
       and every reference (Sam). A no-bike athlete reaches `Outdoor Walk`. */
    count: 33,
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
      source: 'data/strengthSessionVariants.ts STRENGTH_SESSION_VARIANTS (the seven '
        + 'sessions), drawing on data/exercisePoolsStrength.ts STRENGTH_POOLS and '
        + 'gated by the locked-list and cue gates',
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
    chosenBy: { categories: ['mobility'], otherDoor: null },
    counting: { countsTowardLoad: false, canBeHardDay: false, required: false },
    composition: {
      kind: 'authored',
      source: 'data/exercisePools.ts MOBILITY_POOL, composed 5-8 across four '
        + 'regions by rules/mobilitySessionComposition.ts',
      count: 20,
      sessionVariants: null,
    },
    ruling: 'LFA_PROGRAMMING_BIBLE :122; Sam 2026-07-30 — 5-8 movements at authored '
      + 'warm-up doses, spread across lower/hips/midline/upper (region table and '
      + '6-movement target SIGNED), composed from the pool, never hard, never breaks rest.',
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
    chosenBy: { categories: ['prehab'], otherDoor: null },
    counting: { countsTowardLoad: false, canBeHardDay: false, required: false },
    composition: {
      kind: 'authored',
      source: 'data/exercisePools.ts GROIN_ADDUCTORS_POOL, CALVES_POOL, '
        + 'LOWER_PREHAB_POOL, TRUNK_ANTI_ROTATION_POOL, SHOULDER_HEALTH_POOL, '
        + 'HAMSTRING_LIGHT_POOL, shaped one-per-region by '
        + 'utils/sessionBuilder.ts SESSION_SLOTS.prehab_accessories',
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
   * from the 23 candidates he signed on 2026-08-21. "Shoulder" is the PUMP delts
   * pool, not shoulder health.
   *
   * Gunshow is normal gym work. Its signed families author all six movements;
   * no cross-family top-up is permitted.
   */
  gunshow: {
    id: 'gunshow',
    placedBy: ['generator', 'athlete'],
    chosenBy: { categories: ['gunshow'], otherDoor: null },
    counting: { countsTowardLoad: false, canBeHardDay: false, required: false },
    composition: {
      kind: 'authored',
      source: 'data/exercisePools.ts BICEPS_POOL (8) + TRICEPS_POOL (7) + DELTS_POOL (8), '
        + 'composed 2 + 2 + 2 by utils/sessionBuilder.ts SESSION_SLOTS.arms_pump',
      count: 23,
      sessionVariants: null,
    },
    ruling: 'Sam signed the 2 + 2 + 2 shape on 2026-07-30 and replaced its pools '
      + 'and added do-not-pair rules on 2026-08-21; DELTS_POOL remains the shoulder '
      + 'family, and its authored composition is a complete normal-gym session.',
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

  // ── Recovery: the survey's finding 4 — PAID 2026-08-21 ──
  //
  // The entry that stood here described this defect exactly and named its own
  // remedy: *"the four rows of RECOVERY_FLOW_ROWS … are hand-typed names that
  // appear in no authored pool"*, paid by *"the recovery door composes from the
  // recovery pools, as the Mobility door now composes from MOBILITY_POOL"*.
  //
  // ⚠ **IT WAS PAID ONLY WHEN SAM OPENED THE SESSION AND READ IT.** The debt
  // was accurate, the fix was written down, and the four names went on shipping
  // — *"a mobility flow which i have never prescribed … a breathing reset —
  // again i have zero Idea what that is"* (2026-08-21). A debt entry is a
  // record that something is wrong, not a reason it may stay wrong.
  //
  // `recovery`'s ceiling drops 1 -> 0 below, in this same commit, per ratchet
  // direction 4.

  // ── Mobility: authored, and unreachable ──
  {
    type: 'mobility',
    question: 'placement',
    deviation: 'unobservable — with no door and no session builder, nothing can '
      + 'place a mobility session for the gate to see',
    paidBy: 'stage 4 — the Mobility door',
  },

  // ── Prehab and Gunshow: PAID 2026-07-30, both halves ──
  //
  // Their placement debts are gone rather than reworded, and the ceilings below drop
  // with them in the same commit (ratchet direction 4). Both said the same thing —
  // "unattributable" — for the same reason, and it took two fixes:
  //
  //   ONE CATEGORY FOR TWO TYPES. `gunshow_prehab` was a single `SessionCategory`, so
  //   a placed accessory session could not be attributed to either type. Sam ruled the
  //   split (door, taxonomy and contribution), so each placement now names one type
  //   and the classifier carries a `prehab` counterpart to its `gunshow`.
  //
  //   AND THE SESSION CLASSIFIED AS STRENGTH ANYWAY. The prehab debt recorded the
  //   worse half: the session the door actually builds "never reaches the
  //   `gunshow_prehab` category at all: it classifies as `lower_strength`", because the
  //   groin pool holds a Cossack Squat and the exercise tagger read a squat. Fixed by
  //   making the classifier read the typed row role instead of inferring one.
  //
  // `sessionTypeCharterTests` E4 now asserts the split from the other side, so the
  // collapse cannot return quietly.

  // ── Strength and conditioning: authored, placed, counted — and still owed ──
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
  rest: 0,
  // 1 -> 0 on 2026-08-21 with the four invented recovery rows. Lowered in the
  // same commit that paid the debt — a ceiling left at 1 over a paid debt is
  // slack the next invented list could hide in, which is how these four lasted.
  recovery: 0,
  strength: 0,
  conditioning: 1,
  mobility: 1,
  // Both 1 -> 0 on 2026-07-30 with the prehab/gunshow split. Lowered in the same
  // commit that paid the debt, which is the whole of ratchet direction 4: a ceiling
  // left at 1 over a paid debt is slack a future regression could hide in.
  prehab: 0,
  gunshow: 0,
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
