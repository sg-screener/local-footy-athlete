/**
 * Readiness never sets structure — the census and the ratchet.
 *
 * SAM'S RULING (2026-07-28) closes an exemption the previous readiness law
 * wrote on purpose. That law held "counts are STRUCTURE, and the deload law
 * holds structure constant while the work inside shrinks" — but scoped itself
 * to the readiness DECLARATION and exempted the CAPACITY score computed from
 * onboarding answers. Three sites argued for that exemption in their own
 * comments. The exemption is now closed: capacity/readiness affects DOSE only,
 * "dose down, never block" extends to weekly session counts, and injury acts
 * only through its own law family.
 *
 * WHY THIS FILE EXISTS. 65 readiness edges across 14 files, 48 of them in
 * violation on the day the ruling landed. A gate that failed on all 48 would be
 * switched off by the first person it blocked — the precise failure the
 * provenance inventory predicted for any all-at-once gate, and the reason the
 * load-ratio work grew one cluster at a time.
 *
 * So the debt is DECLARED rather than banned, and the gate ratchets in three
 * directions at once:
 *
 *   - each file's actual edge count must match its declared count, so a new
 *     edge fails until someone classifies it;
 *   - the structure debt may never exceed its baseline, so it only shrinks;
 *   - the baseline must equal the current debt, so paying debt down tightens
 *     the ratchet instead of leaving re-spendable slack.
 *
 * A census must also be able to die. When a file's last edge goes, its entry is
 * deleted — a list that keeps naming problems it has already fixed rots into
 * the `LOAD_RULING_PENDING` shape from the other side, where the contents stop
 * describing reality but still read as a considered position.
 *
 * PREFERENCE VS HISTORY (Sam, 2026-07-28). Paying the last contract-V2 edge
 * produced a law worth stating on its own, because it decides HOW several of
 * the remaining edges should land rather than merely whether they go:
 *
 *   A preference changes the shape of FUTURE planning. It never invalidates
 *   accepted history.
 *
 * The edge that taught it raised a bye-build strength target from 3 to 4. Doing
 * that as a planner-SELECTED target made §18 reject every stored week built at
 * 3, and program hydration answered the rejection by falling back to in-memory
 * defaults — an athlete's accepted week silently emptied on read. As a
 * preferred MAXIMUM the same intent costs nothing: new weeks aim higher, and
 * weeks already accepted stay exactly as the athlete accepted them.
 *
 * When a remaining edge is removed by RAISING something, check which of the two
 * it raises. The distinction is invisible in the number and total in the effect.
 */

export const READINESS_STRUCTURE_LAW = {
  ruledOn: '2026-07-28',
  where: 'docs/BATCH0_RULING_APPLIED_2026-07-28.md',
  quote:
    'Structure comes from phase + schedule facts; capacity/readiness affects DOSE only — '
    + '"dose down, never block" extends to weekly session counts. The contract varies by '
    + 'schedule inputs (available days, team days, game anchors) as Sam-authored columns; '
    + 'readiness and injury never set structure — injury flows through its own law family.',
} as const;

/**
 * A readiness EDGE: a comparison of a readiness value against one of its three
 * levels. That is the shape in which readiness reaches a decision — a bare
 * reference (`const r = deriveReadiness(x)`) decides nothing until it is
 * compared.
 *
 * Deliberately not a parser. It matches this repo's single idiom and is pinned
 * from both sides by `readinessStructureCensusTests` block [7], so a change in
 * what it counts fails loudly rather than silently re-baselining the census.
 */
export function readinessEdgesIn(source: string): number {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*');
    })
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n');
  return [...code.matchAll(/\breadiness\b[^;{}\n]{0,30}?(?:===?|!==?)\s*'(?:low|medium|high)'/gi)]
    .length;
}

export type ReadinessEdgeVerdict =
  /** Readiness changes how much or what form — the ruling permits it. */
  | 'dose'
  /** Readiness sets a count, a mode or a block — scheduled for removal. */
  | 'structure_pending_removal';

export interface ReadinessEdgeSite {
  /** Path relative to `src/`. */
  readonly file: string;
  readonly edges: number;
  readonly verdict: ReadinessEdgeVerdict;
  /** What readiness currently decides here. */
  readonly what: string;
  /** For `dose`, why it is dose. For the debt, what replaces it. */
  readonly disposition: string;
  /** Required for `structure_pending_removal`. */
  readonly owningBatch?: string;
}

export const READINESS_EDGE_CENSUS: readonly ReadinessEdgeSite[] = [
  /* ── Dose: survives the ruling ── */
  {
    file: 'utils/progressionRules.ts',
    edges: 9,
    verdict: 'dose',
    what: 'Week-to-week load and volume steps; hold / maintain / build.',
    disposition: 'Pure dose. The session happens either way; only its size moves. '
      + 'This is also why the rubric keeps three levels rather than two.',
  },
  {
    file: 'utils/conditioningProgressionRules.ts',
    edges: 3,
    verdict: 'dose',
    what: 'Pauses conditioning progression on low readiness.',
    disposition: 'Pauses PROGRESSION, not the exposure. The session is still prescribed, '
      + 'it simply does not get harder this week.',
  },
  {
    file: 'utils/recoveryRules.ts',
    edges: 2,
    verdict: 'dose',
    what: 'Selects recovery category: passive / active / extended.',
    disposition: 'Chooses the FORM of a session that exists regardless. No count moves.',
  },
  {
    file: 'rules/recoveryAddonCoverage.ts',
    edges: 1,
    verdict: 'dose',
    what: 'Widens optional recovery add-on recommendations on low readiness.',
    disposition: 'Adds optional work, never removes required work — the permitted direction.',
  },
  {
    file: 'utils/tapSwapHierarchy.ts',
    edges: 1,
    verdict: 'dose',
    what: 'Ranks athlete-initiated day-level swap options.',
    disposition: 'Offers alternatives to an athlete who asked. Programs nothing.',
  },
  {
    file: 'components/dev/ScheduleDebugPanel.tsx',
    edges: 1,
    verdict: 'dose',
    what: 'Dev-only display of the resolved readiness level.',
    disposition: 'Renders a value; decides nothing.',
  },

  /* ── Structure debt: scheduled for removal ── */
  {
    file: 'utils/coachingEngine.ts',
    edges: 18,
    verdict: 'structure_pending_removal',
    what: 'Conditioning frequency and its early off-season target, sprint permission '
      + '(`readiness !== \'high\'` denies a standalone sprint outright), the bye-week '
      + 'lighter flag, off-feet tempo forcing, and the power/sprint loading gates.',
    disposition: 'The STRENGTH half is paid: Batch 0 deleted the phase x readiness core '
      + 'and hard-exposure tables, the three override floors and the optional/recovery '
      + 'split, and the contract now owns the weekly strength count outright. What is '
      + 'left is conditioning, sprint and power — which the Batch 0 reassessment listed '
      + 'under Not Covered ("the same two-authority shape is likely, and was not swept... '
      + 'that is an assertion to test, not one to assume"). Two of them are BLOCKS, not '
      + 'doses, so the sprint floor in Bible Section 2 already bears on them.',
    owningBatch: 'Batch 0 follow-on — the conditioning/sprint/power dose sweep',
  },
  {
    file: 'rules/weeklyExposureContractBuilders.ts',
    edges: 1,
    verdict: 'structure_pending_removal',
    what: '`byeRecoveryMode` selects a whole week mode with different structure '
      + '(strength 2/2/2 against a build week\'s 2/3/4) on low readiness.',
    disposition: 'Sam ruled bye_recovery is SCHEDULE-TRIGGERED ONLY (ruling 4): the '
      + 'scheduled deload is the intended entry condition. Fatigue routes through the '
      + 'deload law, which shrinks the dose, not through a mode that cuts a session.',
    owningBatch: 'Batch 2 — the week-mode contract sheet',
  },
  {
    file: 'utils/conditioningRules.ts',
    edges: 1,
    verdict: 'structure_pending_removal',
    what: '`inferFresh` feeds bye build-vs-recovery from readiness AND injury.',
    disposition: 'Violates both halves of the ruling at once. Dies with the bye-mode '
      + 'trigger; injury reaches the week through its own law family.',
    owningBatch: 'Batch 2 — the week-mode contract sheet',
  },
  {
    file: 'rules/powerPrimerPolicy.ts',
    edges: 3,
    verdict: 'structure_pending_removal',
    what: 'Low readiness returns `null` — no power block at all. Not-high blocks the '
      + 'G-2 primer and withholds contrast eligibility.',
    disposition: 'Sam ruled (2): low readiness gives a SHRUNK SHARP PRIMER via the deload '
      + 'power dose, never `null`. Consistent with the deload law and the cut detrained '
      + 'gate — the exposure survives at a smaller size.',
    owningBatch: 'Batch 0 — power dose follow-on',
  },
  {
    file: 'utils/workoutCanonicalisation.ts',
    edges: 2,
    verdict: 'structure_pending_removal',
    what: 'Low readiness emits `power_removed`; not-high blocks the G-2 primer.',
    disposition: 'The readiness trigger for `power_removed` dies with ruling (2). The '
      + 'game-proximity and early-off-season triggers are unaffected — they are phase and '
      + 'schedule facts, which the ruling explicitly keeps.',
    owningBatch: 'Batch 0 — power dose follow-on',
  },
  {
    file: 'rules/offseasonSubphasePolicy.ts',
    edges: 1,
    verdict: 'structure_pending_removal',
    what: 'One edge gates a whole low-readiness branch that BLOCKS running and speed '
      + '(`allowedBySubphase: false`), sets `hardSessionCap: 0` and biases core to reduced.',
    disposition: 'The blocks and the zero cap die. `strength.targetRpeMax -> 7` and the '
      + 'off-feet modality bias are dose and MUST BE PRESERVED — removing the branch '
      + 'wholesale would delete a legitimate dose-down along with the violation.',
    owningBatch: 'Batch 1 — readiness rubric and its dose consumers',
  },
  {
    file: 'rules/preseasonSubphasePolicy.ts',
    edges: 1,
    verdict: 'structure_pending_removal',
    what: 'Caps strength `coreSessionCap` to 2, conditioning `targetCap` to 1, and sets '
      + 'sprint `targetExposures` to 0 on low readiness.',
    disposition: 'The count caps die. The sprint zero dies twice over: Bible Section 2 '
      + 'sets a year-round floor of 1 sprint/high-speed exposure and requires an explicit '
      + 'typed authorised reason for any reduction below it — low readiness was never one, '
      + 'and Sam confirmed the floor stands. `volumeBias` and `hardDose` are dose and stay.',
    owningBatch: 'Batch 1 — readiness rubric and its dose consumers',
  },
];

/**
 * The structure debt on the day the ruling landed.
 *
 * This number may only ever go DOWN, and the gate requires it to equal the
 * current debt — so paying debt down tightens the ratchet rather than leaving
 * slack that a later change could quietly spend.
 *
 * 48 -> 45 (2026-07-28): `weeklyExposureContractV2` paid all three. The third
 * went through 46 first, held for a session while Sam ruled how it should land —
 * the ratchet caught the held edge returning after its entry had already been
 * deleted, which is the direction that is easy to get wrong.
 *
 * 45 -> 27 (2026-07-28): Batch 0's weekly-dose deletion paid EIGHTEEN of
 * `coachingEngine`'s thirty-six, not all thirty-six. The unit was scoped and
 * approved as the STRENGTH dose — the core-session and hard-exposure tables,
 * the three override floors, the early off-season target and the optional/
 * recovery split — and that is exactly what it deleted.
 *
 * The other eighteen are conditioning, sprint and power. They were counted
 * against this file because the census classifies at FILE level, which the
 * reassessment said in its own Not Covered section: "per-edge verdicts inside
 * coachingEngine.ts... most sit in code Batch 0 deletes, so per-edge work there
 * would be written against code that is about to disappear." That turned out to
 * over-estimate the overlap — the strength deletion and the readiness edges are
 * largely disjoint sets in this file. Recording the real number rather than the
 * predicted one is the whole point of a ratchet that must EQUAL current debt.
 */
export const STRUCTURE_DEBT_BASELINE = 27;

export interface SupersededExemptionClaim {
  /** Path relative to `src/`. */
  readonly file: string;
  /** Text that must no longer appear. */
  readonly supersededText: string;
  readonly why: string;
}

/**
 * Comments that argue FOR the exemption Sam has now closed.
 *
 * Left in place they would read as an unresolved disagreement: a reader hitting
 * "this law does not govern the capacity score" while the law now plainly does
 * has no way to tell which of the two is current. Sam asked for them to be
 * corrected alongside the code, and the gate keeps them corrected.
 */
export const SUPERSEDED_EXEMPTION_CLAIMS: readonly SupersededExemptionClaim[] = [
  {
    file: 'rules/weeklyExposureContractBuilders.ts',
    supersededText: 'is the CAPACITY score, a different',
    why: 'Argued that the capacity score could keep selecting the bye recovery mode.',
  },
  {
    file: 'utils/workoutCanonicalisation.ts',
    supersededText: "STAYS and is not the same signal",
    why: 'Argued that the capacity score could keep removing the power block.',
  },
  {
    file: 'rules/powerPrimerPolicy.ts',
    supersededText: 'the `readiness` homonym',
    why: 'Cited the homonym to justify keeping a capacity-score gate on power.',
  },
  {
    // Found while correcting the three above: the same file's header safety
    // model stated the superseded behaviour a FOURTH time, as current policy.
    // A gate that only watched the argument would have left the summary of it
    // standing — which is the version most readers actually read.
    file: 'rules/powerPrimerPolicy.ts',
    supersededText: 'no power (quality would be poor)',
    why: 'The header safety model asserted low readiness removes power outright.',
  },
];
