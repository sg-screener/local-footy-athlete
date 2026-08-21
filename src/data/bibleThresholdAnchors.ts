/**
 * Bible threshold anchors — CITATIONS, not rulings.
 *
 * Some engine thresholds never needed a ruling: the Programming Bible already
 * states them. What was missing was the citation. The provenance inventory found
 * 276 code comments attributing a decision to Sam and exactly ONE citing a
 * document — every other number is self-certifying, where the code is both the
 * claim and the only evidence for it.
 *
 * This registry is the evidence, and `bibleThresholdAnchorTests` makes it
 * falsifiable in both directions:
 *
 *   Bible -> registry   the quoted sentence is still in the Bible, verbatim,
 *                       and still states the numbers it is cited for.
 *   registry -> code    the cited site still exists and carries a
 *                       `BIBLE_ANCHOR: <id>` marker naming this entry.
 *
 * One direction alone rots. A quote with no marker lets the code drift away
 * from a sentence that stays true; a marker with no quote check lets an edit to
 * the Bible withdraw the support for a number nobody re-reads. This is the same
 * lesson the cue library taught: the gate read one document, authored-ness was
 * spread across several, and nothing reconciled them.
 *
 * SCOPE. Entries here are quotations. If a number is merely CONSISTENT with the
 * Bible rather than stated by it, it does not belong in this file — it belongs
 * in the ruling queue. Where the Bible states a range and the code pins one end
 * of it, `meaning` says so explicitly, because that pin is a choice inside a
 * citation and a later reader must be able to see it.
 */

/** The document every anchor in this file quotes. */
export const BIBLE_SOURCE = 'docs/LFA_PROGRAMMING_BIBLE.md';

export interface BibleAnchorSite {
  /** Path relative to `src/`. */
  readonly file: string;
  /** An identifier that must still exist in that file. */
  readonly symbol: string;
}

export interface BibleThresholdAnchor {
  /** Stable id. Code sites name this in a `BIBLE_ANCHOR: <id>` marker. */
  readonly id: string;
  /** Where in the Bible, for a human reader. */
  readonly section: string;
  /** VERBATIM Bible sentence. The gate asserts it is still present. */
  readonly quote: string;
  /** The whole numbers the quote must state. Empty only for categorical rules. */
  readonly states: readonly number[];
  /**
   * Set ONLY for a categorical rule that licenses an exclusion rather than a
   * magnitude. The string is the reason, so the exemption is typed and visible
   * rather than an empty array that reads like an oversight.
   */
  readonly statesNoNumbers?: string;
  /** What the number governs, in athlete terms. */
  readonly meaning: string;
  readonly sites: readonly BibleAnchorSite[];
}

export const BIBLE_THRESHOLD_ANCHORS: readonly BibleThresholdAnchor[] = [
  {
    id: 'last_high_stress_g3',
    section: 'Section 3 — Hard exposure rules',
    quote: 'How close can high stress be to game day: well there is generally team training '
      + 'on G-2 (thursday for saturday game) so last high stress would be then along with '
      + 'upper body (medium stress really) - so last additional high stress is G-3',
    states: [2, 3],
    meaning: 'The app may not place additional high-stress work closer to the fixture than '
      + 'G-3. Team training at G-2 is the athlete\'s own commitment, not something the app adds.',
    sites: [
      { file: 'utils/coachingEngine.ts', symbol: 'gOffset' },
      // MOVED 2026-08-19. Was `postGenerationConstraintValidation.distanceBeforeFixture`,
      // which lived inside the §18 fallback-week builder — a second authority
      // applying this law while authoring a replacement week. That builder is
      // deleted; the scheduler decides the days and now carries the citation.
      { file: 'rules/weeklyScheduler.ts', symbol: 'sprintDayIsLegal' },
      { file: 'utils/sessionExplanation.ts', symbol: 'buildUpperPushSentence' },
    ],
  },
  {
    id: 'lower_strength_g3',
    section: 'Section 3 — Hard exposure rules',
    quote: 'How close can lower strength be to game day: g-3 (g-2 if it\'s low range of '
      + 'motion, low reps, high quality i.e. 2x3 box squats to high box + 2x3 vertical jumps) '
      + '- low volume, not many exercises',
    states: [3, 2],
    meaning: 'Lower-body strength stops at G-3, with a named G-2 exception for low-volume, '
      + 'high-quality work. Governs which day slots may host a heavy lower session.',
    // BOTH DECLARED STATES NOW CITE A SITE. Until 2026-08-06 this anchor listed
    // only `midWeek` — state 3 alone — while `states` declared [3, 2], and the
    // registry gate passed because it only asks whether each number appears in
    // the QUOTE. State 2 had an authored shape (`looksLikeNeuralPrimer`, and its
    // example in `weekStructureValidatorTests`) and no producer anywhere, for
    // six days, reading as covered. The producer is now cited alongside the
    // validator that licenses it. The general gap — a numeric anchor may still
    // declare a state no site implements — is recorded in
    // `docs/G2_CONDITIONS_5_AND_6_2026-08-06.md` §1 and is its own unit.
    sites: [
      { file: 'utils/coachingEngine.ts', symbol: 'midWeek' },
      { file: 'utils/coachingEngine.ts', symbol: 'g2QualityLowerAllocation' },
      { file: 'rules/weekStructureValidator.ts', symbol: 'looksLikeNeuralPrimer' },
      { file: 'data/defaultProgram.ts', symbol: 'fallbackExercisesForPlanEntry' },
    ],
  },
  {
    id: 'g_minus_2_no_heavy_lower_or_speed',
    section: 'Section 2 — Weekly structure rules',
    quote: 'Rules around G-2: no heavy lower body work or speed work (TT will often be 2 days '
      + 'before game)',
    states: [2],
    meaning: 'G-2 is excluded as a placement day for app sprint/COD work and heavy lower work.',
    sites: [
      { file: 'rules/weeklyExposureContractBuilders.ts', symbol: 'sprintPlacementDays' },
      { file: 'utils/coachingEngine.ts', symbol: 'lateWeek' },
    ],
  },
  {
    id: 'injury_severity_bands',
    section: 'Section 17.G — Injury severity',
    quote: '1-3 / 10: keep most training, avoid exact painful range/trigger.',
    states: [1, 3],
    meaning: 'The 1-10 severity scale and its four bands. RULED (Sam, 2026-07-28, '
      + 'Batch 4) to serve FATIGUE as well as injury: one scale, one set of band '
      + 'edges, so a fatigue cut point may only sit where an injury cut point sits.',
    sites: [
      { file: 'rules/injurySeverityBands.ts', symbol: 'BIBLE_INJURY_SEVERITY_BANDS' },
      { file: 'utils/activeProgramModifiers.ts', symbol: 'severityIsLimiting' },
    ],
  },
  {
    /**
     * SAM'S PRECEDENCE RULING, 2026-08-20. Added with the Bible line it quotes,
     * in the same commit, because `test:bible-coverage` counts a rule line with
     * no named enforcer as debt — and correctly reddened when the line landed
     * without this entry.
     */
    id: 'injury_sheet_outranks_swap_examples',
    section: 'Section 8 — Exercise swap hierarchy / WHICH AUTHORITY WINS',
    quote: 'From 6-7 / 10 upward, never offer an exercise the sheet marks risky for that area, '
      + 'even where a swap example in this section names it.',
    states: [6, 7],
    meaning: 'Which authority decides whether an exercise may be used with an injured area. '
      + 'The typed injury matrix wins over the section\'s named swap examples from the 6-7 band '
      + 'up, so hip thrust for a 6-7 knee and supported pulling for a 6-7 shoulder are '
      + 'illustrations of the ORDER to walk, not licences for those exercises.',
    sites: [
      { file: 'rules/injuryExerciseRisk.ts', symbol: 'injuryPermitsExerciseAtSeverity' },
      { file: 'rules/injuryFallbackLadder.ts', symbol: 'buildInjuryFallbackLadder' },
    ],
  },
  {
    id: 'g_minus_1_optional_only',
    section: 'Section 2 — Weekly structure rules',
    quote: 'Rules around G-1: same as above, no heavy lfiting of any sort, no conditioning, '
      + 'only gunshow, accessories or recovery = all optional as well.',
    states: [1],
    meaning: 'G-1 hosts no required conditioning and no heavy lifting — only optional '
      + 'accessory/recovery work. Excluded as a conditioning placement day.',
    sites: [
      { file: 'rules/weeklyExposureContractBuilders.ts', symbol: 'conditioningPlacementDays' },
      { file: 'utils/coachingEngine.ts', symbol: 'preGame' },
    ],
  },
  {
    id: 'game_day_no_programmed_sessions',
    section: 'Section 2 — Weekly structure rules',
    quote: 'Rules around game day: no rules, just play, no programmed sessions',
    states: [],
    statesNoNumbers: 'Categorical: the rule excludes game day from placement entirely rather '
      + 'than bounding a magnitude. There is no number to drift.',
    meaning: 'Game day never counts as capacity for a programmed strength session.',
    sites: [
      { file: 'rules/weeklyExposureContractBuilders.ts', symbol: 'safeStrengthCapacity' },
    ],
  },
  {
    id: 'g_plus_1_rest_or_recovery',
    section: 'Section 2 — Weekly structure rules',
    quote: 'Rules around G+1: complete rest or recovery',
    states: [1],
    meaning: 'The day after a fixture carries rest or recovery only — it is never a slot for '
      + 'core or hard work.',
    sites: [
      { file: 'utils/coachingEngine.ts', symbol: 'postGame' },
    ],
  },
  {
    id: 'offseason_first_four_weeks_no_deload',
    section: 'Section 1 — Off-season deload rules',
    quote: 'Weeks 1-2 (early off-season) are the OPTIONAL block - everything optional, zero '
      + 'completed sessions is a valid honest week, and no deload applies because nothing is '
      + 'compulsory. Weeks 3-4 are the TRANSITION block - normal training returns, but week 4 '
      + 'does not automatically deload. From week 5 onward, normal 3-4 week deload cycles begin.',
    states: [1, 2, 3, 4, 5],
    meaning: 'A scheduled deload inside the first four off-season phase weeks is illegal: '
      + 'weeks 1-2 have nothing compulsory to deload from, and week 4 is explicitly exempt.',
    sites: [
      { file: 'rules/section18EffectiveWeekEvaluator.ts', symbol: 'illegal_first_offseason_deload' },
    ],
  },
  {
    id: 'capacity_rubric_ladders',
    section: 'Section 9 — Training capacity score',
    quote: '* Recent training consistency: Very consistent 3, Pretty consistent 2, A bit 1, '
      + 'Hardly at all 0. \n* Current conditioning level: Elite 3, Good 2, Average 1, Poor 0. ',
    states: [3, 2, 1, 0],
    meaning: 'The two equal-weight ladders that score standing capacity. Sam authored this '
      + 'section in the same sitting he ruled the values, so unusually the Bible text and '
      + 'the code were written together rather than the code being retro-fitted to a quote.',
    sites: [
      { file: 'data/capacityRubric.ts', symbol: 'CONSISTENCY_SCORES' },
    ],
  },
  {
    id: 'capacity_rubric_bands',
    section: 'Section 9 — Training capacity score',
    quote: 'Total runs 0-6. Bands: 0-2 low, 3-4 medium, 5-6 high.',
    states: [0, 6, 2, 3, 4, 5],
    meaning: 'The band edges on the 0-6 capacity score. Capacity affects DOSE only — '
      + 'progression steps, recovery category, RPE ceiling, power dose — never session counts.',
    sites: [
      { file: 'data/capacityRubric.ts', symbol: 'CAPACITY_BANDS' },
    ],
  },
  {
    id: 'deload_block_length_weeks',
    section: 'Section 5 — Strength programming rules',
    quote: 'Deload rule: new program every 3-4 weeks.',
    states: [3, 4],
    meaning: 'Block length before a new program. NOTE: the Bible states a RANGE (3-4) and the '
      + 'code pins the top of it with a fixed 4-week modulo. That pin is consistent with the '
      + 'citation but is not itself stated by it — if the choice of 4 over 3 ever matters to '
      + 'an athlete, it is a ruling, not a citation.',
    sites: [
      // MOVED 2026-08-19 (burn-the-boats demolition). The citation used to point
      // at `postGenerationConstraintValidation.ts`, where the 4-week modulo sat
      // INSIDE the persisted v1 -> v2 contract migration — a legacy compatibility
      // path, deleted in area 4, which took the citation with it. The LAW is
      // current and approved; only that implementation of it was legacy. The
      // live owner of the block position a week declares is the accepted-state
      // transaction, which stamps `weekInBlock` on the contract identity.
      { file: 'store/acceptedStateTransaction.ts', symbol: 'weekInBlock' },
    ],
  },
  // ── THE SIGNED LAWS OF 2026-07-30 (Bible Section 20) ──
  //
  // Six amendments Sam signed on 2026-07-30, each cited in both directions. These
  // are the first anchors whose Bible text was WRITTEN from a ruling rather than
  // quoted from Sam's original prose, so the discipline matters more, not less: the
  // registry quotes Section 20 verbatim and every site below carries its marker.
  {
    id: 'optional_placement_five_conditions',
    section: 'Section 20.1 — The Optional Placement Law',
    quote: 'The app may place optional work only when all five of these hold: there is a '
      + 'placement rule Sam has authored, the composition is one Sam has authored, it is '
      + 'rendered visibly optional, it is binnable in one tap, and it is never counted '
      + 'toward compliance, load or rest. Optional work that fails any of the 5 conditions '
      + 'is not placed at all.',
    states: [5],
    meaning: 'The app may not fill a spare day because the day is spare. Every optional '
      + 'placement needs an authored rule and authored composition, and must count toward '
      + 'nothing. Recovery fails three of the five, so the app does not place it.',
    sites: [
      { file: 'rules/sessionTypeCharter.ts', symbol: 'PlacementAuthority' },
      { file: 'rules/optionalTopUp.ts', symbol: 'computeOptionalTopUps' },
      { file: 'utils/optionalTopUpPlacement.ts', symbol: 'applyOptionalTopUps' },
      { file: 'utils/sessionResolver.ts', symbol: 'resolveWeekWithConditioning' },
    ],
  },
  {
    id: 'rest_quota_counts_no_required_work',
    section: 'Section 20.2 — The Rest Law',
    quote: 'The rest quota counts days on which nothing was REQUIRED of the athlete. '
      + 'Athlete-added optional work — recovery, mobility, prehab, gunshow — never breaks a '
      + 'rest day. A day may be both rested and active, and the week reports both.',
    statesNoNumbers: 'Categorical: the law defines WHICH days the quota counts, not how '
      + 'many. The quota itself (1-2, or 3 in bye-recovery and early off-season) is '
      + 'Section 2 and is unchanged by this law.',
    states: [],
    meaning: 'A day holding only optional work is still a rested day. The rest quota is '
      + 'computed from required work, never from whether a day has a session on it.',
    sites: [
      { file: 'rules/section18EffectiveWeekEvaluator.ts', symbol: 'trueRestDays' },
    ],
  },
  {
    id: 'gunshow_two_two_two',
    section: 'Section 20.3 — Gunshow',
    quote: 'A gunshow is 2 biceps + 2 triceps + 2 shoulder, 2-3 sets each. "Shoulder" means '
      + 'the pump delts pool, not shoulder health — shoulder health stays with Accessories. '
      + 'Gunshow is normal gym work and its authored composition has all six movements. There are no '
      + 'cross-family top-ups. Its 23 candidates are '
      + '8 biceps, 7 triceps and 8 shoulders, and the signed do-not-pair list prevents '
      + 'same-pattern pairings inside those families.',
    states: [2, 3, 7, 8, 23],
    meaning: 'The signed normal-gym Gunshow structure: six movements from three exact '
      + 'pools with pair-aware selection and no fourth-pool top-up.',
    sites: [
      { file: 'utils/sessionBuilder.ts', symbol: 'SESSION_SLOTS' },
      { file: 'utils/sessionBuilder.ts', symbol: 'pickFromPool' },
      { file: 'data/exercisePools.ts', symbol: 'GUNSHOW_DO_NOT_PAIR_IDS' },
    ],
  },
  {
    id: 'mobility_composed_from_pool',
    section: 'Section 20.4 — Mobility',
    quote: 'A mobility session is COMPOSED from the mobility pool: 5-8 movements at their '
      + 'authored warm-up doses, spread across lower, hips, midline and upper. No pre-built '
      + 'flow sits between the pool and the athlete. It counts toward nothing — never a hard '
      + 'day, no exposure credit, and it never breaks rest.',
    states: [5, 8],
    meaning: 'A mobility session is composed from Sam\'s twenty authored movements at his '
      + 'authored doses, spread across the four signed regions. The ten flow bundles that '
      + 'used to sit between the pool and the athlete are deleted.',
    sites: [
      { file: 'rules/mobilitySessionComposition.ts', symbol: 'composeMobilitySession' },
    ],
  },
  {
    id: 'seven_strength_sessions',
    section: 'Section 20.5 — The Seven Strength Sessions',
    quote: 'There are 7 strength sessions: Lower Squat, Lower Hinge, Lower Body Strength, '
      + 'Upper Push, Upper Pull, Upper Body Strength, Full Body Strength. The athlete picks '
      + 'Upper, Lower or Full Body; the app resolves the variant.',
    states: [7],
    meaning: 'The authored set of strength sessions. A variant the generator can build is a '
      + 'variant a door can reach, because both derive from the same seven.',
    sites: [
      { file: 'data/strengthSessionVariants.ts', symbol: 'STRENGTH_SESSION_VARIANTS' },
    ],
  },
  {
    id: 'four_questions_signed_rule',
    section: 'Section 20.6 — The Four Questions',
    quote: 'No session type exists until 4 questions are answered: who may place it, who '
      + 'chooses it, what it counts as, and who authored its contents.',
    states: [4],
    meaning: 'The shape of the session-type charter. For any type the app may place, "who '
      + 'may place it" is answered by a signed placement rule and never by naming a layer.',
    sites: [
      { file: 'rules/sessionTypeCharter.ts', symbol: 'SESSION_TYPE_CHARTER' },
    ],
  },
  {
    id: 'weak_point_off_season_focus',
    section: 'Section 1 — Season phase rules (off-season)',
    quote: 'Weak point work: KEY thing in off season is working on weakness - may be '
      + 'mobility and injury prevention, or strength and size, or conditioning, or speed. '
      + 'What the user said is their weakness is the focus here. If they don\'t really say '
      + 'they have a weakness then strength and size should be prioritised early, then '
      + 'building work capacity, then increasing speed and intensity as we get closer to '
      + 'pre season.',
    statesNoNumbers: 'Categorical: the line names four weakness CATEGORIES and a default '
      + 'ORDER over the off-season. It states no dose, count or threshold — which is the '
      + 'whole of Sam\'s reading A, that a weakness changes what fills the week and never '
      + 'how much of it.',
    states: [],
    meaning: 'The athlete\'s stated weakness biases exercise and template SELECTION in the '
      + 'off-season, through the four categories the line names. With no stated weakness the '
      + 'default order applies — strength and size early, then work capacity, then speed and '
      + 'intensity toward pre-season — which is the shape of the off-season subphase tables.',
    sites: [
      { file: 'rules/weakPointFocus.ts', symbol: 'WEAK_POINT_FOCUS_BY_ANSWER' },
      { file: 'rules/testingBias.ts', symbol: 'computeTestingBias' },
    ],
  },
];

/* ══ Injury severity: one owner for the band edges ══ */

/**
 * Files that read injury severity and must NOT restate its band edges.
 *
 * The bands (1-3 / 4-5 / 6-7 / 8-10) are Bible Sections 8 and 17.G and are owned
 * by `rules/injurySeverityBands.ts`, whose own header says consumers "should not
 * own their own numeric thresholds". Seven literals across these five files did
 * exactly that — a second representation of an already-ruled fact, which is not
 * a pending decision but a drift waiting to happen.
 *
 * The gate asserts each file carries no numeric severity threshold of its own
 * AND reads the owner. Both halves matter: removing the literal without reading
 * the owner would just be deleting the behaviour.
 */
export const INJURY_SEVERITY_THRESHOLD_CONSUMERS: readonly string[] = [
  'rules/weeklyExposureContractBuilders.ts',
  'rules/conditioningFeasibility.ts',
  'screens/home/DayWorkoutScreenV2.tsx',
  'utils/generationConstraints.ts',
  'utils/coachingEngine.ts',
  // Moved off MERGED_SEVERITY_SCALE_DEFERRALS by Batch 4 (Sam, 2026-07-28): one
  // 1-10 scale serves injury and fatigue, so a fatigue threshold is no longer a
  // different kind of number and these files read the band owner like any other.
  'utils/activeProgramModifiers.ts',
  'rules/temporarySourceFact.ts',
  'utils/constraintPlan.ts',
  'utils/programEditRiskAssessment.ts',
  'utils/tapSwapHierarchy.ts',
];

export interface MergedSeverityScaleDeferral {
  /** Path relative to `src/`. */
  readonly file: string;
  readonly reason: string;
  /** Which batch of the engine-thresholds unit owns the decision. */
  readonly owningBatch: string;
}

/**
 * Sites deliberately NOT collapsed, and why.
 *
 * `ActiveConstraint.severity` is a single 1-10 field carrying BOTH an injury
 * severity and a fatigue severity. A threshold on it is therefore neither
 * cleanly injury nor cleanly fatigue, and collapsing it onto the injury owner
 * would silently rule that the two scales are the same thing — a decision
 * nobody has made.
 *
 * Recorded rather than omitted. A file quietly missing from the enforced list
 * is indistinguishable from a file that was checked and found clean; that is
 * the `LOAD_RULING_PENDING` defect, where an empty park read as a completed
 * review. The gate asserts every matching site is in one list or the other.
 */
export const MERGED_SEVERITY_SCALE_DEFERRALS: readonly MergedSeverityScaleDeferral[] = [
  // PAID IN FULL by Batch 4 (Sam, 2026-07-28).
  //
  // All five files sat here because `ActiveConstraint.severity` carries an
  // injury severity and a fatigue severity on ONE 1-10 field, so a threshold on
  // it was neither cleanly injury nor cleanly fatigue and could not be collapsed
  // onto the injury owner without first deciding whether the two scales are the
  // same thing. Nobody had decided it, so the deferral was honest.
  //
  // Sam decided it: ONE 1-10 scale serves both, bands 1-3 / 4-5 / 6-7 / 8-10.
  // The question the deferral was waiting on is answered, so all five moved to
  // INJURY_SEVERITY_THRESHOLD_CONSUMERS and this list is empty.
  //
  // The list stays as a TYPE with an empty body rather than being deleted: the
  // next merged-scale threshold needs somewhere to be declared, and the gate
  // over it now asserts emptiness, so an entry reappearing is loud rather than
  // silent. An empty list is only dangerous when nothing asserts why it is
  // empty — that is the `LOAD_RULING_PENDING` defect, and the assertion in
  // `bibleThresholdAnchorTests` block [7] is what keeps this one different.
];
