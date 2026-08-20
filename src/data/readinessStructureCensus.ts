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

/** Strip comments so a described edge is never counted as a live one. */
function executableCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*');
    })
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n');
}

/**
 * A CAPACITY EDGE: a comparison of the capacity band against one of its three
 * levels. That is the shape in which capacity reaches a decision — a bare
 * reference (`const c = deriveProfileReadiness(x)`) decides nothing until it is
 * compared.
 *
 * RENAMED from `readinessEdgesIn` (2026-08-13) with the homonym split. It always
 * counted the CAPACITY score — the census's own law says *"capacity/readiness
 * affects DOSE only"* — and matching on the word `readiness` was the last thing
 * keeping the two signals sharing an instrument. **A detector named after the
 * wrong signal counts the wrong thing the moment the names diverge**, which is
 * exactly what happened: the rename took every declared file to zero edges at
 * once and this suite went 20 red.
 *
 * Deliberately not a parser. It matches this repo's single idiom and is pinned
 * from both sides by `readinessStructureCensusTests` block [7], so a change in
 * what it counts fails loudly rather than silently re-baselining the census.
 */
export function capacityEdgesIn(source: string): number {
  return [...executableCode(source)
    .matchAll(/\bcapacity\b[^;{}\n]{0,30}?(?:===?|!==?)\s*'(?:low|medium|high)'/gi)]
    .length;
}

/**
 * THE HOMONYM GATE — R-041 and R-064, enforced at last.
 *
 * Both rows have said `UNENFORCED` since 2026-07-27: *"a naming hazard, not a
 * behaviour; **nothing reds if they re-merge**."* They re-merged. This counts
 * the re-merge.
 *
 * After the split, the DECLARATION is never a three-level band — it is
 * `{deloaded, sessionsOptional}` (`GenerationReadinessConstraint`), a
 * `ReadinessSignal`, or one of R-038's named tiers. **So a `readiness`
 * compared against `'low'`/`'medium'`/`'high'` can only be the capacity band
 * wearing the declaration's name**, and the count must stay at zero.
 *
 * It is the same idiom as `capacityEdgesIn` pointed at the other word, so the
 * two cannot drift apart: whatever one counts as an edge, the other counts as
 * a violation.
 */
export function homonymBandComparisonsIn(source: string): number {
  return [...executableCode(source)
    .matchAll(/\breadiness\b[^;{}\n]{0,30}?(?:===?|!==?)\s*'(?:low|medium|high)'/gi)]
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
  // TWO ROWS DIED HERE, under this file's own rule that a census must be able to
  // die when a file's last edge goes:
  //   `utils/recoveryRules.ts` (2 dose edges) — the whole module is deleted. Its
  //     only call site, the resolver's ninth recovery-placement pass, was removed
  //     under the optional-placement law; nothing imported it afterwards.
  //   `rules/recoveryAddonCoverage.ts` (1 dose edge) — `recommendRecoveryAddonCoverage`
  //     is deleted; the module is now the focus-area union and nothing else, so
  //     its actual edge count is 0.
  // Neither was `structure_pending_removal`, so the debt baseline is untouched.
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

  /* ── Dose: the sweep's survivors, each with the reason it survived ── */
  {
    file: 'rules/scheduleToCoachingPlan.ts',
    edges: 2,
    verdict: 'dose',
    what: 'Low capacity moderates the conditioning loading and asks for a ramp-up.',
    disposition: 'These are the SAME two edges deleted from `buildAIConstraints` with the '
      + 'legacy planner — re-homed onto the connector, not new. They were hardcoded to '
      + '`full`/`false` when the connector was written, which silently dropped both; '
      + '`test:readiness-dose-sweep` found it once it was re-pointed at the live '
      + 'producer. Dose only: capacity changes the loading, never the week\'s shape.',
  },
  {
    file: 'utils/coachingEngine.ts',
    // 8 -> 6 on 2026-08-16. **Reclassified, not retuned**, which is what the
    // guard demands: the two that went were the `conditioningLoading: 'moderate'`
    // prompt hint and the ramp-up note, and BOTH lived inside `buildAIConstraints`
    // — deleted whole with the legacy weekly planner. Neither was moved, reworded
    // or re-homed; the AI-constraints surface they wrote to no longer exists.
    // The six that remain are unchanged and still dose-only.
    edges: 6,
    verdict: 'dose',
    what: 'Off-feet modality forcing for aerobic and standalone tempo (x3) and intensity '
      + 'back-off to easy aerobic for tempo and hard conditioning (x3). The '
      + '`conditioningLoading: \'moderate\'` prompt hint and the ramp-up note were '
      + 'deleted with `buildAIConstraints`.',
    disposition: 'Every one of these keeps the session and changes its size, intensity or '
      + 'modality. The ten structure edges that stood beside them are gone: three sprint '
      + 'blocks, the early off-season conditioning target and its floor, the combined-day '
      + 'suppression, the game-week spacing gate, the withheld aerobic component, the '
      + 'bye-week lighter flag (now read from the contract) and the `do-not-add` sprint '
      + 'loading.',
  },
  {
    file: 'rules/powerPrimerPolicy.ts',
    edges: 3,
    verdict: 'dose',
    what: 'Low capacity, and anything below high at G-2, shrink the primer via '
      + '`deloadPowerDose`; contrast eligibility still asks for high capacity.',
    disposition: 'Sam ruled (2): low readiness gives a SHRUNK SHARP PRIMER via the deload '
      + 'power dose, never `null`. The shrink is applied once, in the wrapper, so the '
      + 'decision body holds no readiness branch that can return null — the same way the '
      + 'deload input was retired rather than inverted. Contrast-vs-primer was always '
      + 'dose: it is the size of a block that exists either way.',
  },
  {
    file: 'rules/offseasonSubphasePolicy.ts',
    edges: 1,
    verdict: 'dose',
    what: 'The low-capacity branch: aerobic-only conditioning categories, off-feet '
      + 'modality bias, an RPE ceiling of 7, and wider optional support work.',
    disposition: 'The census warned that removing this branch wholesale would delete a '
      + 'legitimate dose-down along with the violation, so it was emptied field by field '
      + 'instead. Gone: `hardSessionCap: 0` (which denied the standalone sprint through '
      + '`injuryAllowsSprint`), the `blocked_low_readiness` running/speed policies — that '
      + 'word is retired from both unions — `coreBias: \'reduced\'`, and the combined-day '
      + 'avoidance that suppressed the conditioning floor.',
  },
  {
    file: 'rules/preseasonSubphasePolicy.ts',
    edges: 1,
    verdict: 'dose',
    what: 'The low-capacity branch: aerobic-first category priority, a reduced hard dose, '
      + 'and controlled strength volume.',
    disposition: 'Six structural statements left this branch: `coreSessionCap`, '
      + '`targetCap`, `minimumAppExposures: 0`, `hardSessionCap: 0`, '
      + '`speedSprint.targetExposures: 0` and the combined-day avoidance. The sprint zero '
      + 'died twice over: Bible Section 2 sets a year-round floor of 1 sprint/high-speed '
      + 'exposure and requires an explicit typed authorised reason below it — low '
      + 'readiness was never one, and Sam confirmed the floor stands.',
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
 *
 * 27 -> 0 (2026-07-29): the final sweep, edge by edge, in
 * docs/READINESS_CENSUS_SWEEP_2026-07-29.md. Three files left the census having
 * no readiness edge at all; four keep theirs as declared DOSE.
 *
 * The sweep had to draw the dose/structure line at the consumers rather than by
 * argument, and three fields this census itself described as blocks turned out
 * to be modality switches, while one it never mentioned turned out to be the
 * real block. The rule that fell out:
 *
 *   DOSE   — the session still happens; its size, intensity or modality moves.
 *   STRUCTURE — a session, a required exposure or a count disappears, including
 *   a cap that removes a Bible-floored exposure, and anything that suppresses a
 *   floor.
 *
 * `hardSessionCap: 0` is the worked example. It filters hard categories out of
 * the conditioning priority list and the week keeps every session as easy
 * aerobic — dose, on its face. But the same predicate produces
 * `injuryAllowsSprint`, so a readiness-set zero denied the standalone sprint
 * outright. The block was one call away from the field that looked innocent.
 *
 * THE CENSUS DOES NOT DIE AT ZERO. Its entry-level rule ("a file with no edges
 * left must be removed") is about entries, not the census: blocks [2] and [5]
 * are what stop the NEXT readiness edge arriving unclassified, and they only
 * work while this list exists. A zero debt is the state it is meant to hold, not
 * a signal that it is finished.
 */
export const STRUCTURE_DEBT_BASELINE = 0;

/**
 * DIRECTION 4 — the ceiling the baseline may never exceed. Backported from
 * `data/legacyReckoningCensus.ts` on 2026-07-30, because the first three
 * directions are CIRCULAR and this census had the same hole.
 *
 * Directions 1-3 all compare the debt against `STRUCTURE_DEBT_BASELINE`. So a
 * new readiness->structure edge could be admitted by raising a declared count
 * and the baseline together, and every assertion above would stay green — which
 * is exactly how a violation gets DECLARED into a census instead of fixed. This
 * was not a theory: it was demonstrated against the legacy census on 2026-07-30,
 * where the full suite passed 289/289 while brand-new surface was admitted, and
 * that probe is what sent the fix back here.
 *
 * FROZEN AT ZERO, and that is the whole point. The debt was paid to zero on
 * 2026-07-29 (`docs/READINESS_CENSUS_SWEEP_2026-07-29.md`), so the ruling is
 * fully discharged and there is no headroom to declare into. Where the legacy
 * census grandfathers 116 units of pre-law surface, this one grandfathers
 * nothing: **every future readiness->structure edge must be FIXED.**
 *
 * A NOTE ON WHAT THIS IS NOT. No constant in a file can make an edit
 * impossible — this one is editable like any other. What it does is make the
 * raise-both-numbers move require changing a constant whose name carries its own
 * date and whose comment says a ruling is needed. The escape stops being a
 * plausible edit and becomes a visible one. If that is ever not enough, the
 * stronger form is to compare against the value committed in git rather than a
 * value in the file; that was considered here and judged disproportionate for a
 * census whose ceiling is zero.
 */
export const STRUCTURE_DEBT_FOUNDING_CEILING = 0;

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
