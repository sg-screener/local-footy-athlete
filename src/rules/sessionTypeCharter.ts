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
import type { AthleteGender } from '../types/domain';

/**
 * Sam's programmable vocabulary. EIGHT, and only these eight.
 *
 * It was seven until 2026-08-23, when R-129 added the Primer. The count is
 * asserted by `sessionTypeCharterTests`, deliberately: an eighth type cannot
 * appear without someone changing that number, and changing it is the moment
 * the four answers below are demanded.
 */
export type SessionTypeId =
  | 'rest'
  | 'recovery'
  | 'strength'
  | 'conditioning'
  | 'mobility'
  | 'prehab'
  | 'gunshow'
  | 'primer';

export const SESSION_TYPE_IDS = [
  'rest',
  'recovery',
  'strength',
  'conditioning',
  'mobility',
  'prehab',
  'gunshow',
  'primer',
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
  /**
   * (a) Non-empty by charter rule — something must be allowed to place it.
   *
   * **PER PATH SINCE R-130** (Sam, 2026-08-23: *"It's one switch. Male or
   * Female."*). The placement answer was ONE list per type for the whole app;
   * the female path needed gunshow and primer to answer differently by WHO THE
   * ATHLETE IS, and the brief's own instruction was to make that shape change
   * HERE, in the charter — never as `if (female)` sprinkled through an engine.
   * Both columns are written out for every type, explicitly: six of eight are
   * identical on purpose, and an identical pair is still two ruled answers,
   * not one answer copied.
   */
  readonly placedBy: Readonly<Record<AthleteGender, readonly PlacementAuthority[]>>;
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
    placedBy: {
      male: ['generator', 'athlete', 'fact'],
      female: ['generator', 'athlete', 'fact'],
    },
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
    placedBy: { male: ['athlete'], female: ['athlete'] },
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
    placedBy: {
      male: ['generator', 'athlete'],
      female: ['generator', 'athlete'],
    },
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
    placedBy: {
      male: ['generator', 'athlete'],
      female: ['generator', 'athlete'],
    },
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
    placedBy: { male: ['athlete'], female: ['athlete'] },
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
    placedBy: {
      male: ['generator', 'athlete'],
      female: ['generator', 'athlete'],
    },
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
    // R-130: *"never program gunshow for females … if they really want to do
    // it then they can add it"*. The Add menu still offers her one — that is
    // the `athlete` authority, kept. The MALE `generator` claim is the ruled
    // state awaiting its rebuild (R-130a: *"bring gunshow back later"*) and is
    // carried as declared placement debt below until that order lands.
    placedBy: {
      male: ['generator', 'athlete'],
      female: ['athlete'],
    },
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

  /**
   * PRIMER — R-129, signed 2026-08-23. Sam's words for what it is FOR:
   * *"a little 20 min session the day before their game to feel good"*.
   *
   * **THE STATED FUTURE ORDER LANDED THE SAME DAY.** R-129 recorded *"when I
   * add in the female pathway, the primer will become the default"* as a
   * future order; R-130 is that order. The FEMALE path places it on G−1 as
   * optional, *"if no other sessions exist there"*, never in a multi-game
   * week — the scheduler's R-130 pass (`weeklyScheduler`), composed through
   * the same `buildDerivedSession('primer')` the athlete's door uses. The
   * MALE column stays `athlete` alone, exactly as R-129 ruled it.
   */
  primer: {
    id: 'primer',
    placedBy: {
      male: ['athlete'],
      female: ['generator', 'athlete'],
    },
    chosenBy: { categories: ['primer'], otherDoor: null },
    counting: { countsTowardLoad: false, canBeHardDay: false, required: false },
    composition: {
      kind: 'authored',
      source: 'utils/sessionBuilder.ts SESSION_SLOTS.primer — four mobility '
        + 'drills drawn BY REGION from data/exercisePools.ts MOBILITY_POOL '
        + '(2 hips, 1 upper, 1 lower-or-midline), authored Pogo Hops, one '
        + 'explosive movement per family from rules/powerExercisePool.ts '
        + 'POWER_EXERCISE_POOL, then two authored skippable rows: three 15m '
        + 'accelerations and a heavy-but-easy lift.',
      // THE POPULATION OF THE CITED SOURCE, not the nine slots — the same
      // meaning `gunshow: 23` carries. 20 mobility drills + 7 explosive pool
      // entries + the 4 movements R-129 authors by name and no pool holds.
      count: 31,
      sessionVariants: null,
    },
    ruling: 'Sam authored the nine slots in order on 2026-08-23 (R-129), amended '
      + 'the same day to keep every tick box and remove the weight control from '
      + 'the whole session, and ruled slot 3 draws the WHOLE signed upper '
      + 'mobility region rather than a narrowed upper-back subset.',
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
  /**
   * R-130: a placement deviation can be one path's alone (the male gunshow
   * debt). Absent means the deviation holds on both paths.
   */
  readonly path?: AthleteGender;
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

  // ── Recovery: the generator places it uninvited, and the owner is untraced ──
  //
  // Observed by this gate's own E1 on `main` (recorded at R-129's registry
  // entry as pre-existing, confirmed after the 2026-08-23 game-anchor fix):
  // generated weeks contain sessions that classify as recovery which no
  // athlete chose. The dead planner's eight recovery sites are gone, so the
  // placer is somewhere on the live scheduler→connector→builder path and has
  // not been traced. Declared rather than left as a bare red so the ratchet
  // can hold everything else while the trace is owed.
  {
    type: 'recovery',
    question: 'placement',
    deviation: 'generated weeks contain recovery-classified sessions the '
      + 'athlete did not choose; the live-path placer is untraced',
    paidBy: 'nothing is scoped to this yet — tracing the live recovery placer '
      + 'is unowned work, and saying so here is the only honest entry',
  },

  // ── Gunshow: the MALE generator claim awaits its ruled rebuild ──
  //
  // The G−1 Gunshow auto-placement was demolished on 2026-08-19 ("reading must
  // not author") with the rebuild assigned to the weekly scheduler, and it has
  // not been rebuilt: no generated week contains a generator-placed gunshow
  // (the stage-b golden records gunshowSessions: 0 throughout). Sam ruled the
  // sequence on 2026-08-23 (R-130a): *"bring gunshow back later"* — males stay
  // exactly as they are for the female-path job, and the restoration is its
  // own later order. The scheduler's R-130 primer pass makes it a small flip
  // when that order comes.
  // ── Gunshow: DEBT PAID 2026-08-26 (R-236). Sam's "bring gunshow back
  // later" order arrived as *"men should be given optional gunshow instead
  // of optional primer"* — the scheduler's G−1 offer pass now stamps
  // `composedOptional: 'gunshow'` for males on the same placement rule the
  // female Primer uses. Entry deleted and ceiling lowered in the same
  // commit, per the ratchet's own instruction.

  // ── Prehab: the generator claim has no living placer either ──
  //
  // The adjacency repair that stamped `composedOptionalKind: 'prehab'` lived
  // inside the demolished planner. Same observation as gunshow (E2), no
  // restoration order exists for it.
  {
    type: 'prehab',
    question: 'placement',
    deviation: 'the charter claims generator placement and no generated week '
      + 'contains a generator-placed prehab session — its placer died with '
      + 'the demolished planner',
    paidBy: 'nothing is scoped to this yet — no ruling has ordered a prehab '
      + 'placement rebuild',
  },

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
  // 0 -> 1 on 2026-08-23 (R-130 build): the uninvited recovery placement E1
  // has observed on `main` is DECLARED above rather than left as a bare red.
  // Raised in the same commit as the entry, per ratchet direction 4.
  recovery: 1,
  strength: 0,
  conditioning: 1,
  mobility: 1,
  // Both 0 -> 1 on 2026-08-23 (R-130 build): the demolished G−1/adjacency
  // placers left both generator claims unearned (E2's standing red). Gunshow's
  // entry is male-path debt awaiting R-130a's restoration order; prehab's has
  // no owner and says so. Raised in the same commit as the entries.
  prehab: 1,
  // 1 -> 0 on 2026-08-26 (R-236): the male G−1 generator placement is live
  // again, so the generator claim is earned and the debt above is deleted.
  gunshow: 0,
  // PRIMER IS BORN AT ZERO, AND THAT IS A CLAIM, NOT A COURTESY. It arrives with
  // all four answers signed in one message (R-129), so there is nothing for a
  // debt entry to excuse — and a new type given slack "to start with" is slack
  // that outlives the reason for it. If a Primer deviation turns up, it is a
  // real entry above and this number moves with it, never quietly.
  primer: 0,
};

/** The placement answer for one athlete path — R-130's one switch, read here. */
export function placedByFor(
  type: SessionTypeId,
  gender: AthleteGender,
): readonly PlacementAuthority[] {
  return SESSION_TYPE_CHARTER[type].placedBy[gender];
}

/** Debt entries for one type. */
export function charterDebtFor(type: SessionTypeId): readonly CharterDebtEntry[] {
  return CHARTER_DEBT.filter((entry) => entry.type === type);
}

/**
 * Is this (type, question) pair currently excused?
 *
 * R-130: placement deviations are per-path, so a caller observing one path
 * passes it — an entry scoped to the OTHER path does not excuse this one. A
 * path-less entry excuses both paths; a path-less query matches any entry.
 */
export function charterDebtCovers(
  type: SessionTypeId,
  question: CharterQuestion,
  path?: AthleteGender,
): boolean {
  return CHARTER_DEBT.some((entry) => entry.type === type && entry.question === question
    && (entry.path === undefined || path === undefined || entry.path === path));
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
