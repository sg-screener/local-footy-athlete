/**
 * THE WEEKLY PROGRAMMING CONTRACT — Sam's approved scheduling law, typed once.
 *
 * **SOURCE:** `docs/WEEKLY_PROGRAMMING_SOURCE_REVIEW_2026-08-14.md`,
 * sha256 `0d34e288c23f0654d0163d41dff1a73050697d54219ecf6facd84ef1eb68c190`,
 * 430 lines. Approved by Sam 2026-08-15: *"okay i approve it"*.
 *
 * **THIS FILE IS THE ONLY EXECUTABLE STATEMENT OF THAT DOCUMENT.** Its §10 orders
 * exactly that: *"Encode the contract once in a typed production module … Make the
 * weekly scheduler the only owner that converts the contract into dated days …
 * Remove every other independent session-count, weekday and spacing rule."*
 *
 * ## WHAT IT OWNS, AND WHAT IT MUST NEVER GROW INTO
 *
 * OWNS: required strength-session count and purpose · gym-day selection · running
 * and conditioning placement · club and game anchoring · hard-day, rest-day and
 * lower-session spacing · phase and subphase layouts · movement-exposure
 * distribution · main/secondary set budgets.
 *
 * **NEVER:** which exercise fills a slot, equipment substitution, injury
 * modification, projection, training-history progression, athlete-facing copy.
 * The contract's own §1: *"It does not choose exact exercises, equipment
 * substitutions, injury/readiness reductions, block progression from completed
 * training, or athlete-facing wording."* The composer keeps every one of those.
 *
 * ## EVERY CLAUSE CARRIES A STABLE ID AND ITS PROVENANCE
 *
 * `WEEKLY_CONTRACT_CLAUSES` is the enumerable registry. `test:weekly-contract`
 * walks it mechanically — **there is no hand-written list of rows to drift from
 * it.** A clause added here without a guard reds that suite; a guard naming a
 * clause id that does not exist reds it too.
 *
 * IDs are `WC-nnn` and are STABLE: code, guards and reports refer to the id, never
 * to the prose, so re-wording the source cannot orphan a reader.
 */

/** The three season phases the contract lays out. */
export type ContractPhase = 'In-season' | 'Pre-season' | 'Off-season';

/**
 * What a scheduled strength session is FOR. Purpose, not content — the composer
 * turns a purpose into exercises and this module never names one.
 */
export type SessionPurpose =
  | 'full_body'
  | 'lower'
  | 'lower_squat'
  | 'lower_hinge'
  | 'upper'
  | 'upper_push'
  | 'upper_pull';

/** The eight movement patterns §2 names, and their required partners (§2, §3). */
export type MovementPattern =
  | 'horizontal_push' | 'horizontal_pull'
  | 'vertical_push' | 'vertical_pull'
  | 'squat' | 'hinge'
  | 'single_leg_knee' | 'single_leg_hip';

/** Conditioning that does not load the legs — §3 "Lower + conditioning". */
export type ConditioningKind = 'off_leg' | 'running' | 'sprint_high_speed' | 'aerobic';

/**
 * ── WC-070: THE CONDITIONING CATEGORY IS THE SCHEDULER'S, THE TEMPLATE IS NOT ──
 *
 * **Sam's boundary, 2026-08-15:** the scheduler owns *"whether conditioning,
 * sprint or power is required; its purpose/category; standalone versus combined
 * role; its weekday"*. The specialists own *"exact conditioning template … work,
 * rest, rounds, distance, modality and dose"*.
 *
 * So this maps the contract's own conditioning INTENT onto the app's existing
 * `AthleteConditioningCategory` vocabulary. It names a purpose; it never names a
 * template, and `conditioningSelection` is left as the single authority on which
 * template serves a purpose.
 *
 * §3's rows are the source: *"Lower + conditioning: prefer off-leg work"*,
 * *"Upper + running: hard running/top-end work belongs with upper days"*, and the
 * sprint row's *"at least 1 except early off-season"*.
 */
export type ContractConditioningCategory =
  | 'aerobic_base' | 'tempo' | 'sprint' | 'vo2' | 'glycolytic'
  | 'recovery_flush' | 'cod_decel';

/** Standalone, or riding on a strength session (§3 "Compatible doubles"). */
export type ContractConditioningRole = 'standalone' | 'finisher' | 'component';

/**
 * WC-071. Which category a scheduled conditioning slot asks for.
 *
 * **OFF-LEG PAIRS WITH LOWER, RUNNING WITH UPPER** — §3, verbatim: *"Lower +
 * conditioning: Prefer off-leg work: bike, ski, rower or assault bike"* and
 * *"Upper + running: Hard running/top-end work belongs with upper days where
 * possible."*
 */
export const CATEGORY_FOR_CONDITIONING: Readonly<
  Record<ConditioningKind, ContractConditioningCategory>
> = {
  off_leg: 'aerobic_base',
  running: 'tempo',
  aerobic: 'aerobic_base',
  sprint_high_speed: 'sprint',
};

export interface ContractClause {
  readonly id: string;
  /** Where in the approved document this clause comes from. */
  readonly provenance: string;
  /** Sam's own words where the document quotes them, else the approved wording. */
  readonly statement: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// §2 — MOVEMENT EXPOSURE
// ═══════════════════════════════════════════════════════════════════════════

/** WC-020. The eight patterns a complete week aims to cover at least once. */
export const REQUIRED_PATTERNS: readonly MovementPattern[] = [
  'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
  'squat', 'hinge', 'single_leg_knee', 'single_leg_hip',
];

/**
 * WC-021. Paired-pattern balance, measured across the WEEK and not inside a
 * session. *"a second vertical pull requires a second vertical push. A second
 * squat requires a second hinge."*
 */
export const PATTERN_PARTNER: Readonly<Record<MovementPattern, MovementPattern>> = {
  horizontal_push: 'horizontal_pull',
  horizontal_pull: 'horizontal_push',
  vertical_push: 'vertical_pull',
  vertical_pull: 'vertical_push',
  squat: 'hinge',
  hinge: 'squat',
  single_leg_knee: 'single_leg_hip',
  single_leg_hip: 'single_leg_knee',
};

/**
 * WC-022. The PLANE a pattern belongs to, for the consecutive-day rule (§3,
 * decision 17). **The restriction is the PLANE, not the broad push/pull family** —
 * *"Horizontal push may precede vertical push"* — so the plane is the pattern
 * itself and this map exists to say so explicitly rather than by coincidence.
 */
export const PATTERN_PLANE: Readonly<Record<MovementPattern, MovementPattern>> = {
  horizontal_push: 'horizontal_push',
  horizontal_pull: 'horizontal_pull',
  vertical_push: 'vertical_push',
  vertical_pull: 'vertical_pull',
  squat: 'squat',
  hinge: 'hinge',
  single_leg_knee: 'single_leg_knee',
  single_leg_hip: 'single_leg_hip',
};

/** WC-023. Which patterns a session purpose intends to train. */
export const PATTERNS_FOR_PURPOSE: Readonly<Record<SessionPurpose, readonly MovementPattern[]>> = {
  full_body: ['squat', 'hinge', 'horizontal_push', 'horizontal_pull',
    'single_leg_knee', 'single_leg_hip'],
  lower: ['squat', 'hinge', 'single_leg_knee', 'single_leg_hip'],
  lower_squat: ['squat', 'single_leg_knee'],
  lower_hinge: ['hinge', 'single_leg_hip'],
  upper: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'],
  upper_push: ['horizontal_push', 'vertical_push'],
  upper_pull: ['horizontal_pull', 'vertical_pull'],
};

/** WC-024. Which purposes load the legs, for lower-spacing (§3 "Lower spacing"). */
export const PURPOSE_IS_LOWER: Readonly<Record<SessionPurpose, boolean>> = {
  full_body: true,
  lower: true,
  lower_squat: true,
  lower_hinge: true,
  upper: false,
  upper_push: false,
  upper_pull: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// §5 — WORKING-SET BUDGETS
// ═══════════════════════════════════════════════════════════════════════════

export interface SetBudget {
  readonly preferredMin: number;
  readonly preferredMax: number;
  /** Never exceeded. */
  readonly hardCeiling: number;
}

/**
 * WC-030. *"Prefer 12–15 working sets across main and secondary lifts … 16
 * main/secondary working sets is a hard ceiling"*, and the SAME limit applies to
 * Lower, Upper and Full Body.
 */
export const DEFAULT_SET_BUDGET: SetBudget = {
  preferredMin: 12, preferredMax: 15, hardCeiling: 16,
};

/**
 * WC-031. **The approved exception, and the document calls it that in as many
 * words:** *"The deliberately reduced 10-set Lower Squat and Lower Hinge sessions
 * used in the four-session in-season layout are an approved exception below the
 * preferred range, not a failure to reach it."*
 */
export const SPLIT_LOWER_SET_BUDGET: SetBudget = {
  preferredMin: 10, preferredMax: 10, hardCeiling: 10,
};

// ═══════════════════════════════════════════════════════════════════════════
// §3 — GLOBAL WEEKLY RULES
// ═══════════════════════════════════════════════════════════════════════════

export const GLOBAL_RULES = {
  /** WC-040. *"Prefer 4 hard days; allow 5 … The app does not program 6."* */
  hardDays: { preferred: 4, permittedMaximum: 5, neverProgrammed: 6 },
  /**
   * WC-041. *"Prefer no more than 3. Four is acceptable when availability
   * requires it. Five is allowed only when followed by two complete rest days."*
   */
  consecutiveHardDays: { preferred: 3, acceptable: 4, fiveRequiresTwoFullRestDays: 5 },
  /** WC-042. *"Normally 1–2 full rest days. Early off-season and bye-recovery may have 3."* */
  restDays: { normalMin: 1, normalMax: 2, earlyOffseasonMax: 3 },
  /**
   * WC-043. *"At least one complete day between hard lower sessions; prefer two
   * or more. Never place lower strength sessions on consecutive days."*
   */
  lowerSpacing: { minimumClearDays: 1, preferredClearDays: 2 },
  /** WC-044. *"No more than 3 running days consecutively."* */
  runningStreakMaximum: 3,
  /** WC-045. *"Aim for 3–5 total depending on phase … Total cap 5; a fifth is off-leg."* */
  conditioning: { min: 3, max: 5, fifthIsOffLeg: true },
  /** WC-046. *"Minimum 2, preferred 3, maximum 4. Club training counts."* */
  running: { min: 2, preferred: 3, max: 4 },
  /** WC-047. *"Aim for 2–3 upper exposures per week."* */
  upperExposures: { min: 2, max: 3 },
  /** WC-048. *"Seven app-authored strength movements is a daily ceiling, not a target."* */
  dailyMovementCeiling: 7,
} as const;

/**
 * WC-050. Game-proximity rules, §3. Keyed by days BEFORE the game (G-2, G-1) and
 * after (G+1). **These constrain what a day may hold, never which day the game is
 * on** — the game is an anchor the athlete gives us.
 */
export const GAME_PROXIMITY = {
  /**
   * *"G-2: No heavy lower-body or added speed work."*
   *
   * ⚠ **AND THE DISTINCTION SAM RULED ON 2026-08-15, verbatim: *"should not rule
   * out upper body power"*.**
   *
   * So G-2 prohibits added **LOWER-BODY** sprint, jumping, plyometric and power
   * work. **Upper-body power is PERMITTED**, and only as a COMPONENT of an
   * already-authorised upper-body strength session — it never creates a session,
   * never moves a day and never counts as conditioning.
   *
   * The ruling exists because this seat shipped a G-2 lower-body jump primer
   * reduced to one set and reported the reduction as correct. The fix was right;
   * **the first draft of it would have banned legal upper power too**, which is
   * what Sam corrected.
   */
  minusTwo: {
    noHeavyLower: true,
    /** LOWER-body speed work only — see the docstring. */
    noAddedLowerBodySpeedWork: true,
    upperBodyPowerPermitted: true,
    upperBodyPowerComponentOnly: true,
  },
  /** *"G-1: No heavy lifting or conditioning. Optional Gunshow, accessories or recovery."* */
  minusOne: { noHeavyLifting: true, noConditioning: true, optionalOnly: true },
  /** *"G+1: Rest or recovery."* */
  plusOne: { restOrRecoveryOnly: true },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// §6 + §7 — THE BASE LAYOUTS
// ═══════════════════════════════════════════════════════════════════════════

export interface BaseLayout {
  readonly clauseId: string;
  readonly phase: ContractPhase;
  /** Gym-access days this layout answers for. */
  readonly gymDays: readonly number[];
  /**
   * Weekend availability this row is specific to, when the contract distinguishes
   * them. `null` means the row answers for both.
   */
  readonly weekendAvailable: boolean | null;
  /** The required strength sessions, in the order the contract states them. */
  readonly purposes: readonly SessionPurpose[];
  /** Per-session main/secondary working-set budget. */
  readonly setBudget: SetBudget;
  /** Verbatim-or-approved statement, for the report and the guards. */
  readonly statement: string;
}

/**
 * ⚠ **AVAILABILITY IS PERMISSION, NOT A QUOTA.** §2: *"Five or six available days
 * do not create five or six required strength sessions."* §6: *"Six available days
 * never means six required strength sessions. The phase determines the required
 * count."* Every 5–6 row below therefore repeats its 4-day count deliberately.
 *
 * ⚠ **THE IN-SEASON 4+ ROW IS A SELECTOR, NOT A LAYOUT.** It resolves to three or
 * four sessions via `inSeasonUsesFourSessions`; both arms are listed so the
 * registry can enumerate and guard each.
 */
export const BASE_LAYOUTS: readonly BaseLayout[] = [
  {
    clauseId: 'WC-100', phase: 'In-season', gymDays: [2], weekendAvailable: null,
    purposes: ['full_body', 'full_body'], setBudget: DEFAULT_SET_BUDGET,
    statement: 'Full Body x2 on the best-separated days.',
  },
  {
    clauseId: 'WC-101', phase: 'In-season', gymDays: [3], weekendAvailable: null,
    purposes: ['lower', 'upper_pull', 'upper_push'], setBudget: DEFAULT_SET_BUDGET,
    statement: 'Lower + Upper Pull + Upper Push. With two club nights, pair one '
      + 'upper session with each.',
  },
  {
    clauseId: 'WC-102', phase: 'In-season', gymDays: [4, 5, 6], weekendAvailable: null,
    purposes: ['lower', 'upper_pull', 'upper_push'], setBudget: DEFAULT_SET_BUDGET,
    statement: 'Selector NOT met — the three-session layout is retained. '
      + 'Availability above three never creates another required strength session.',
  },
  {
    clauseId: 'WC-103', phase: 'In-season', gymDays: [4, 5, 6], weekendAvailable: null,
    purposes: ['lower_squat', 'upper_pull', 'lower_hinge', 'upper_push'],
    setBudget: SPLIT_LOWER_SET_BUDGET,
    statement: 'Selector MET — four sessions. The fourth creates separate Lower '
      + 'Squat and Lower Hinge days, each using the 10-set main/secondary budget.',
  },
  {
    clauseId: 'WC-110', phase: 'Pre-season', gymDays: [2], weekendAvailable: null,
    purposes: ['full_body', 'full_body'], setBudget: DEFAULT_SET_BUDGET,
    statement: 'Full Body x2 on the best-separated gym days, never back-to-back.',
  },
  {
    clauseId: 'WC-111', phase: 'Pre-season', gymDays: [3], weekendAvailable: false,
    purposes: ['lower', 'upper', 'full_body'], setBudget: DEFAULT_SET_BUDGET,
    statement: 'Weekend unavailable: Lower + Upper + Full Body.',
  },
  {
    clauseId: 'WC-112', phase: 'Pre-season', gymDays: [3], weekendAvailable: true,
    purposes: ['full_body', 'full_body', 'full_body'], setBudget: DEFAULT_SET_BUDGET,
    statement: 'Weekend available: Full Body x3 on the best-separated days.',
  },
  {
    clauseId: 'WC-113', phase: 'Pre-season', gymDays: [4, 5, 6], weekendAvailable: null,
    purposes: ['upper_pull', 'lower_squat', 'upper_push', 'lower_hinge'],
    setBudget: DEFAULT_SET_BUDGET,
    statement: 'Upper x2 + Lower x2. Pair running/top-end with Upper and off-leg '
      + 'conditioning with Lower. Extra gym availability does not create a fifth.',
  },
  {
    clauseId: 'WC-120', phase: 'Off-season', gymDays: [2], weekendAvailable: null,
    purposes: ['full_body', 'full_body'], setBudget: DEFAULT_SET_BUDGET,
    statement: 'Full Body x2 on the best-separated gym days.',
  },
  {
    clauseId: 'WC-121', phase: 'Off-season', gymDays: [3], weekendAvailable: null,
    purposes: ['lower', 'upper', 'full_body'], setBudget: DEFAULT_SET_BUDGET,
    statement: 'Lower + Upper + Full Body on the best-separated gym days. Full '
      + 'Body fills the movement patterns still missing from the week.',
  },
  {
    clauseId: 'WC-122', phase: 'Off-season', gymDays: [4, 5, 6], weekendAvailable: null,
    purposes: ['lower_squat', 'upper_pull', 'lower_hinge', 'upper_push'],
    setBudget: DEFAULT_SET_BUDGET,
    statement: 'Lower x2 + Upper x2 on the best-spaced four gym days. Extra days '
      + 'may hold optional work; they do not create a fifth required session.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// §8 — PHASE OVERLAYS
// ═══════════════════════════════════════════════════════════════════════════

export type OffseasonBlock = 'early_optional' | 'transition' | 'normal_build';

export interface PhaseOverlay {
  readonly clauseId: string;
  /** Are the base layout's strength sessions REQUIRED, or all optional? */
  readonly sessionsRequired: boolean;
  /** Load adjustment the contract states for this block, or null for normal. */
  readonly loadAdjustment: number | null;
  readonly runningRequired: boolean;
  readonly sprintExposureRequired: boolean;
  readonly maxRestDays: number;
  readonly conditioningTarget: { readonly min: number; readonly max: number };
  readonly statement: string;
}

/**
 * WC-130..132. §8's three off-season blocks. **`early_optional` is the one place
 * in the whole contract where zero completed sessions is a VALID week** — *"Every
 * session is optional; zero completed sessions is valid."*
 */
export const OFFSEASON_OVERLAYS: Readonly<Record<OffseasonBlock, PhaseOverlay>> = {
  early_optional: {
    clauseId: 'WC-130', sessionsRequired: false, loadAdjustment: 0.75,
    runningRequired: false, sprintExposureRequired: false, maxRestDays: 3,
    conditioningTarget: { min: 0, max: 3 },
    statement: 'Off-season weeks 1-2: every session optional, zero completed is '
      + 'valid, 75% load, no required running, light aerobic/off-leg only, up to '
      + 'three full rest days.',
  },
  transition: {
    clauseId: 'WC-131', sessionsRequired: true, loadAdjustment: 0.90,
    runningRequired: true, sprintExposureRequired: false, maxRestDays: 2,
    conditioningTarget: { min: 3, max: 4 },
    statement: 'Off-season weeks 3-4: the normal strength skeleton becomes '
      + 'required again, 90% load, conditioning returns progressively. Week 4 is '
      + 'not automatically a deload.',
  },
  normal_build: {
    clauseId: 'WC-132', sessionsRequired: true, loadAdjustment: null,
    runningRequired: true, sprintExposureRequired: true, maxRestDays: 2,
    conditioningTarget: { min: 3, max: 5 },
    statement: 'Off-season week 5 onward: normal loading, 2-4 required strength '
      + 'sessions by availability, conditioning builds to 3-5, at least one '
      + 'genuine sprint/high-speed exposure.',
  },
};

/** WC-133. §8 Pre-season. */
export const PRESEASON_OVERLAY: PhaseOverlay = {
  clauseId: 'WC-133', sessionsRequired: true, loadAdjustment: null,
  runningRequired: true, sprintExposureRequired: true, maxRestDays: 2,
  conditioningTarget: { min: 4, max: 4 },
  statement: 'Pre-season: prefer four strength sessions when availability '
    + 'permits, scale honestly to two or three, four total conditioning exposures '
    + '(club training counts), no more than two lower sessions.',
};

/** WC-134. §8 In-season. **No scheduled calendar deload.** */
export const INSEASON_OVERLAY: PhaseOverlay = {
  clauseId: 'WC-134', sessionsRequired: true, loadAdjustment: null,
  runningRequired: true, sprintExposureRequired: false, maxRestDays: 2,
  conditioningTarget: { min: 3, max: 5 },
  statement: 'In-season: maintain strength and conditioning while arriving fresh '
    + 'for the game. No scheduled calendar deload. Game, club training, readiness '
    + 'and injury drive reductions.',
};

/** WC-135. §8: *"Only add a sprint when club training is absent, at G-3 or earlier."* */
export const INSEASON_SPRINT_RULE = {
  clauseId: 'WC-135',
  addOnlyWhenNoClubTraining: true,
  earliestGameOffset: -3,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// §6 / §7 / decision 14 — THE IN-SEASON FOURTH-SESSION SELECTOR
// ═══════════════════════════════════════════════════════════════════════════

export interface FourthSessionInputs {
  readonly gymDayCount: number;
  readonly age: number | null;
  /** Has the athlete consistently completed three sessions comfortably? */
  readonly consistentlyCompletesThree: boolean;
  readonly highReadiness: boolean;
  readonly lowFatigue: boolean;
  /** Any authorised low-readiness signal. Never adds work — decision 14. */
  readonly lowReadiness: boolean;
}

/** WC-140. The selector's age boundary, stated once. */
export const FOURTH_SESSION_AGE_CEILING = 27;

/**
 * WC-141 — **THE IN-SEASON FOURTH-SESSION SELECTOR.**
 *
 * Decision 14, verbatim: *"with four or more gym-access days, use four sessions
 * when the athlete is 27 or younger, or when they consistently complete three
 * sessions comfortably with high readiness and low fatigue. The fourth session
 * must still satisfy game-freshness and spacing rules. **Low readiness never adds
 * work.**"*
 *
 * **THE TWO ARMS ARE AN `OR`, AND THE SECOND IS A CONJUNCTION.** An older athlete
 * qualifies only on all three of consistently-completes-three, high readiness AND
 * low fatigue. Reading it as an `or` across those three would give a fourth
 * session to a fatigued 34-year-old.
 *
 * **LOW READINESS IS AN ABSOLUTE VETO, NOT A COUNTERWEIGHT.** It overrides the age
 * arm too — a 22-year-old reporting low readiness does not get a fourth session.
 * *"Low readiness never triggers Option 2; it supports maintaining or reducing
 * workload."*
 */
export function inSeasonUsesFourSessions(inputs: FourthSessionInputs): boolean {
  if (inputs.gymDayCount < 4) return false;
  if (inputs.lowReadiness) return false;           // absolute veto, decision 14
  const youngEnough = inputs.age !== null && inputs.age <= FOURTH_SESSION_AGE_CEILING;
  const earnedIt = inputs.consistentlyCompletesThree
    && inputs.highReadiness && inputs.lowFatigue;
  return youngEnough || earnedIt;
}

/**
 * WC-142. Which base layout answers for this athlete. **The only entry point** —
 * every reader asks here rather than indexing `BASE_LAYOUTS` itself, so the
 * selector cannot be applied twice or skipped once.
 */
export function baseLayoutFor(args: {
  readonly phase: ContractPhase;
  readonly gymDayCount: number;
  readonly weekendAvailable: boolean;
  readonly fourthSession?: FourthSessionInputs;
}): BaseLayout | null {
  const rows = BASE_LAYOUTS.filter((row) =>
    row.phase === args.phase
    && row.gymDays.includes(args.gymDayCount)
    && (row.weekendAvailable === null || row.weekendAvailable === args.weekendAvailable));
  if (rows.length === 0) return null;
  if (args.phase !== 'In-season' || args.gymDayCount < 4) return rows[0];
  // In-season 4+ has two rows; the selector picks between them.
  const four = inSeasonUsesFourSessions(args.fourthSession ?? {
    gymDayCount: args.gymDayCount, age: null, consistentlyCompletesThree: false,
    highReadiness: false, lowFatigue: false, lowReadiness: false,
  });
  return rows.find((row) => (row.purposes.length === 4) === four) ?? rows[0];
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ENUMERABLE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠ **MECHANICALLY DERIVED WHERE IT CAN BE.** The layout and overlay rows are
 * generated from the tables above, not retyped — a hand-written duplicate list is
 * the exact drift this contract exists to end, and the mission forbids it. Only
 * the clauses that are PROSE RULES rather than data carry their own row.
 */
export const WEEKLY_CONTRACT_CLAUSES: readonly ContractClause[] = [
  { id: 'WC-020', provenance: '§2 Strength session versus movement exposure',
    statement: 'Across the complete week, aim for at least one meaningful exposure '
      + 'in each of the eight named patterns.' },
  { id: 'WC-021', provenance: '§2 / §3 Lower balance',
    statement: 'Additional exposures remain balanced with their partner, measured '
      + 'across the whole week, not necessarily inside each session.' },
  { id: 'WC-022', provenance: '§3 Repeated patterns / decision 17',
    statement: 'Do not repeat the same movement plane on consecutive days. '
      + 'Different planes in the same broad family may follow each other.' },
  { id: 'WC-023', provenance: '§6 / §7 session purposes',
    statement: 'Each session purpose intends a stated set of movement patterns.' },
  { id: 'WC-024', provenance: '§3 Lower spacing',
    statement: 'Which session purposes load the legs, for lower spacing.' },
  { id: 'WC-030', provenance: '§5 Total session workload / decision 16',
    statement: 'Prefer 12-15 main/secondary working sets; 16 is a hard ceiling; '
      + 'the same limit applies to Lower, Upper and Full Body.' },
  { id: 'WC-031', provenance: '§5 / decision 13',
    statement: 'Split in-season Lower Squat and Lower Hinge sessions use 10 '
      + 'main/secondary working sets — an approved exception, not a failure.' },
  { id: 'WC-040', provenance: '§3 Hard-day total',
    statement: 'Prefer 4 hard days; allow 5. The app does not program 6.' },
  { id: 'WC-041', provenance: '§3 Consecutive hard days / decision 6',
    statement: 'Prefer no more than 3 consecutive hard days; 4 acceptable when '
      + 'availability requires; 5 only when followed by two complete rest days.' },
  { id: 'WC-042', provenance: '§3 Rest',
    statement: 'Normally 1-2 full rest days; early off-season and bye-recovery may '
      + 'have 3.' },
  { id: 'WC-043', provenance: '§3 Lower spacing / decision 5',
    statement: 'At least one complete day between hard lower sessions; never place '
      + 'lower strength sessions on consecutive days.' },
  { id: 'WC-044', provenance: '§3 Running spacing / decision 7',
    statement: 'No more than 3 running days consecutively.' },
  { id: 'WC-045', provenance: '§3 Conditioning',
    statement: 'Aim for 3-5 conditioning exposures; club training and games count; '
      + 'total cap 5 and a fifth is off-leg.' },
  { id: 'WC-046', provenance: '§3 Running',
    statement: 'Running minimum 2, preferred 3, maximum 4. Club training counts.' },
  { id: 'WC-047', provenance: '§3 Upper frequency',
    statement: 'Aim for 2-3 upper exposures per week.' },
  { id: 'WC-048', provenance: '§3 Session size / decision on full body',
    statement: 'Seven app-authored strength movements is a daily ceiling, not a '
      + 'target. Mobility does not count.' },
  { id: 'WC-050', provenance: '§3 G-2 / G-1 / G+1',
    statement: 'Game proximity constrains the days around the fixture.' },
  { id: 'WC-051', provenance: '§3 G-2 (amended 2026-08-15)',
    statement: 'G-2 prohibits added LOWER-BODY sprint, jumping, plyometric and '
      + 'power work. Upper-body power is permitted as a component of an already '
      + 'authorised upper-body strength session; it never creates a session, '
      + 'moves a day, or counts as conditioning.' },
  { id: 'WC-060', provenance: '§2 Available LFA gym days',
    statement: 'Required strength work is never placed outside gym-access days. '
      + 'Equipment-free running or conditioning may use other legal days.' },
  { id: 'WC-061', provenance: '§2 / §3 / decision 15',
    statement: 'Any work placed outside gym-access days must still respect game and '
      + 'club placement, spacing, and any day the athlete marked unavailable.' },
  { id: 'WC-062', provenance: '§3 Club training',
    statement: "Use the athlete's real club nights; never assume Tuesday/Thursday." },
  { id: 'WC-063', provenance: '§2 / §6 / decision 11',
    statement: 'Availability is permission, not a quota. Five or six available days '
      + 'do not create five or six required strength sessions.' },
  { id: 'WC-140', provenance: '§6 In-season 4 / decision 14',
    statement: 'The in-season fourth-session age ceiling is 27.' },
  { id: 'WC-141', provenance: '§6 / §7 Selection / decision 14',
    statement: 'Use four in-season sessions when the athlete is 27 or younger, OR '
      + 'when they consistently complete three comfortably with high readiness and '
      + 'low fatigue. Low readiness never adds work.' },
  { id: 'WC-142', provenance: '§6 Base layout coverage',
    statement: 'One entry point resolves phase x availability to a base layout.' },
  { id: 'WC-135', provenance: '§3 Sprint/high-speed / §8 In-season',
    statement: 'In-season, only add sprint work when there is no club training, and '
      + 'place it G-3 or earlier.' },
  // Layout rows, derived from BASE_LAYOUTS so the two cannot drift.
  ...BASE_LAYOUTS.map((row) => ({
    id: row.clauseId,
    provenance: `§6 ${row.phase} / ${row.gymDays.join('-')} gym days`,
    statement: row.statement,
  })),
  // Overlay rows, derived likewise.
  ...Object.values(OFFSEASON_OVERLAYS).map((row) => ({
    id: row.clauseId, provenance: '§8 Phase overlays', statement: row.statement,
  })),
  { id: PRESEASON_OVERLAY.clauseId, provenance: '§8 Pre-season',
    statement: PRESEASON_OVERLAY.statement },
  { id: INSEASON_OVERLAY.clauseId, provenance: '§8 In-season',
    statement: INSEASON_OVERLAY.statement },
];

/** The source document this contract encodes, pinned by hash. */
export const CONTRACT_SOURCE = {
  path: 'docs/WEEKLY_PROGRAMMING_SOURCE_REVIEW_2026-08-14.md',
  /**
   * ⚠ **THE HASH MOVED WHEN THE DOCUMENT WAS AMENDED, AND BOTH ARE RECORDED.**
   * A pinned hash that is silently re-pinned proves nothing; the previous value is
   * kept so the amendment is auditable rather than invisible.
   */
  sha256: 'eb914afadde6b201b426113b1e82e0e1f47b5a58ce19bba5afc851e193f4b514',
  supersededSha256: '0d34e288c23f0654d0163d41dff1a73050697d54219ecf6facd84ef1eb68c190',
  approvedBy: 'Sam, 2026-08-15: "okay i approve it"',
  amendedBy: 'Sam, 2026-08-15: "should not rule out upper body power" (§3 G-2)',
} as const;
