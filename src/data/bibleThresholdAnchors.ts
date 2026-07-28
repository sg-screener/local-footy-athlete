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
      { file: 'utils/postGenerationConstraintValidation.ts', symbol: 'distanceBeforeFixture' },
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
    sites: [
      { file: 'utils/coachingEngine.ts', symbol: 'midWeek' },
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
      { file: 'utils/postGenerationConstraintValidation.ts', symbol: 'weekInBlock' },
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
  {
    file: 'utils/activeProgramModifiers.ts',
    reason: 'Thresholds on the merged constraint severity, not on an injury record.',
    owningBatch: 'Batch 4 — fatigue and time-cap bands',
  },
  {
    file: 'rules/temporarySourceFact.ts',
    reason: 'Fatigue-scale bands; the "cooked" cut point is a Batch 4 ruling.',
    owningBatch: 'Batch 4 — fatigue and time-cap bands',
  },
  {
    file: 'utils/constraintPlan.ts',
    reason: 'Thresholds on the merged constraint severity, not on an injury record.',
    owningBatch: 'Batch 4 — fatigue and time-cap bands',
  },
  {
    file: 'utils/programEditRiskAssessment.ts',
    reason: 'Thresholds on the merged constraint severity, not on an injury record.',
    owningBatch: 'Batch 4 — fatigue and time-cap bands',
  },
  {
    file: 'utils/tapSwapHierarchy.ts',
    reason: 'Thresholds on the merged constraint severity, not on an injury record.',
    owningBatch: 'Batch 4 — fatigue and time-cap bands',
  },
];
