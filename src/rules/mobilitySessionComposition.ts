/**
 * THE MOBILITY SESSION IS COMPOSED, NOT PRE-BUILT.
 *
 * Sam's ruling, 2026-07-30, superseding stage 4a: he does not recognise the
 * eleven — in fact ten — flow bundles in `data/mobilityFlowTemplates.ts`. The
 * provenance trace agrees with him and is recorded in
 * `docs/OPTIONAL_PLACEMENT_LAW_SUPERSESSION_2026-07-30.md`: the EXERCISES are
 * his (curated pool vocabulary, gated by the locked list), the GROUPINGS arrived
 * in one commit — `c01a80a "Add mobility flow templates"` — with no ruling
 * cited, no changeset document, and no divergence report, beside a repo whose
 * authored changes always carry all three.
 *
 * So the door composes from the mobility POOL — Sam's authored exercises, each
 * with his authored dose — at 5-8 movements with a full-body spread. No bundle
 * sits between his exercises and the athlete.
 *
 * WHAT IS AUTHORED HERE AND WHAT IS NOT, stated plainly because the distinction
 * is the whole point of the supersession:
 *
 *   AUTHORED (Sam's, already)  the twenty exercises, their names, their doses,
 *                              their equipment and their contraindications.
 *   SIGNED 2026-07-30          which of the four regions each exercise belongs
 *                              to (20/20, as presented), and the 6-movement
 *                              target inside his 5-8 window.
 *
 * The region table below was the only invention in this file. It was written
 * down, sent as `docs/OPTIONAL_PLACEMENT_SHEET_2026-07-30.md` §3, and signed as
 * presented — which is the opposite of how the flow bundles it replaced arrived.
 * `mobilityAccessoryDoorTests` C6 keeps it equal to the pool in both directions.
 */

import { MOBILITY_POOL, type PoolExercise } from '../data/exercisePools';

/**
 * The four regions Sam named: "full-body spread (lower / hips / midline /
 * upper)".
 *
 * `midline` rather than `trunk` or `core` — his D13 stage 3 ruling made that the
 * athlete-facing word app-wide.
 */
export const MOBILITY_REGIONS = ['lower', 'hips', 'midline', 'upper'] as const;
export type MobilityRegion = (typeof MOBILITY_REGIONS)[number];

/**
 * SIGNED 2026-07-30, 20/20 as presented — one region per mobility exercise.
 *
 * Keyed by pool id, so a renamed exercise is a compile-time miss rather than a
 * silent unmapped movement, and `mobilityAccessoryDoorTests` C6 asserts the table
 * and the pool are equal in BOTH directions: a new exercise with no region fails,
 * and a region for an exercise that no longer exists fails.
 *
 * Each assignment follows the movement's own target, and where Sam's authored
 * `contraindications` name a body area they were the strongest evidence
 * available — `couch-stretch` carries `['knee','hip']` and stretches a hip
 * flexor, so it is hips. Nothing was derived automatically, because a derivation
 * would have hidden that this was a judgement he had not yet made. He has now.
 *
 * Signed: `docs/OPTIONAL_PLACEMENT_RULINGS_2026-07-30.md` §3.
 */
export const MOBILITY_REGION_BY_ID: Readonly<Record<string, MobilityRegion>> = {
  'crab-hold': 'upper',
  'seated-good-morning': 'midline',
  'bench-thoracic-extension': 'upper',
  // ── lower (knee, ankle, calf, hamstring) ──
  'deep-squat-hold': 'lower',
  'toe-stretch': 'lower',
  'calf-stretch': 'lower',
  'atg-split-squat': 'lower',
  'elephant-walks': 'lower',
  // ── hips (hip, groin, adductor) ──
  'hip-90-90': 'hips',
  'worlds-greatest': 'hips',
  'couch-stretch': 'hips',
  'pigeon-stretch': 'hips',
  'adductor-rock': 'hips',
  'butterfly-stretch': 'hips',
  'pissing-dog-wall': 'hips',
  'horse-stance-hold': 'hips',
  // ── midline (spine, lower back, trunk) ──
  'cat-cow': 'midline',
  'ql-back-extension': 'midline',
  'jefferson-curl': 'midline',
  // ── upper (shoulder, t-spine, lat, pec) ──
  'thoracic-rotation': 'upper',
  'pec-doorway': 'upper',
  'lat-stretch': 'upper',
  'dead-hang': 'upper',
  'db-pullovers': 'upper',
};

/**
 * SIGNED 2026-07-30 — how many movements a composed session aims for.
 *
 * He ruled the window (5-8) first and the number second. Six is the middle. The
 * session SHRINKS below six when equipment or injury filtering leaves a region
 * short, and never pads to reach it: that is his gunshow ruling, and it does not
 * stop at gunshows.
 */
export const MOBILITY_TARGET_MOVEMENTS = 6;
export const MOBILITY_MIN_MOVEMENTS = 5;
export const MOBILITY_MAX_MOVEMENTS = 8;

/**
 * A FLOW is one movement per region. Not a session, and not a new number.
 *
 * The collapsed in-session flow (`:229`) and the mobility add-on both used to
 * draw from the retired bundles; they now draw from this pool. Neither has an
 * authored count — the Bible authorises that the flow EXISTS and that it is never
 * load-bearing, and says nothing about its length — so rather than invent one,
 * the flow is the region table's own shape: FOUR regions, one movement each.
 *
 * That is a derivation from something Sam signed, not a fifth number. It also
 * happens to equal what the retired path emitted (`movementsFromTemplate` sliced
 * to 4), so the size of an add-on does not change — only where its movements come
 * from, which is the whole point of retiring the bundles.
 *
 * A SESSION is the signed 5-8 window with a target of six. The difference between
 * the two is one pass of the same engine.
 */
export const MOBILITY_FLOW_MOVEMENTS = MOBILITY_REGIONS.length;

/**
 * How long the app says a composed Mobility session takes.
 *
 * NOT A NEW NUMBER: it is the Mobility door's own `durationMinutes`, moved here
 * from `coachRevisionTemplates` so the door and the generator's top-up cannot
 * quote different lengths for the identical composition. Unsigned — a duration is
 * not in the Bible — and now unsigned in exactly one place.
 */
export const MOBILITY_SESSION_MINUTES = 15;

export function mobilityRegionOf(exercise: PoolExercise): MobilityRegion | null {
  return MOBILITY_REGION_BY_ID[exercise.id] ?? null;
}

/**
 * Compose a mobility session.
 *
 * FULL-BODY SPREAD FIRST, THEN DEPTH. One movement from each region before any
 * region gets a second, so a session can never come out as six variations on
 * hips — which is precisely what an unshaped draw from this pool would produce,
 * since hips is its largest region.
 *
 * DETERMINISTIC BY SEED, so the same athlete on the same date gets the same
 * session through every path that builds it — the registry's advertised
 * snapshot, the validation signature and the written workout all have to agree
 * byte-for-byte, and a random draw would break that by construction.
 *
 * @param seed    a date hash; rotates which movement each region contributes
 * @param eligible the pool AFTER equipment and injury filtering, in pool order
 */
// BIBLE_ANCHOR: mobility_composed_from_pool
export function composeMobilitySession(args: {
  seed: number;
  eligible: readonly PoolExercise[];
  target?: number;
}): PoolExercise[] {
  const target = Math.min(
    Math.max(args.target ?? MOBILITY_TARGET_MOVEMENTS, MOBILITY_MIN_MOVEMENTS),
    MOBILITY_MAX_MOVEMENTS,
  );
  return composeRegionSpread({ seed: args.seed, eligible: args.eligible, target });
}

/**
 * The collapsed in-session flow and the mobility add-on: ONE MOVEMENT PER REGION.
 *
 * Same engine, same pool, same authored doses — one pass instead of the session's
 * several. It shrinks below four exactly as the session shrinks below six, because
 * equipment and injury filtering can empty a region, and it never pads.
 */
export function composeMobilityFlow(args: {
  seed: number;
  eligible: readonly PoolExercise[];
}): PoolExercise[] {
  return composeRegionSpread({
    seed: args.seed,
    eligible: args.eligible,
    target: MOBILITY_FLOW_MOVEMENTS,
    // ONE PASS, so "one movement per region" holds even when a region is empty.
    // Without this the draw would take a second movement from another region to
    // reach four — which is the padding the session's own rule forbids, and it
    // would make the count a quota instead of a shape. Caught by
    // `mobilityPrehabFlowTests` §2 on its first run: three regions produced four
    // movements.
    maxPasses: 1,
  });
}

/**
 * The region-spread draw both doses share.
 *
 * Held private-by-contract: callers ask for a SESSION or a FLOW, so the two signed
 * shapes are the only ones reachable and neither can drift into an arbitrary
 * count. It is exported only because the flow and the session live in different
 * modules.
 */
export function composeRegionSpread(args: {
  seed: number;
  eligible: readonly PoolExercise[];
  target: number;
  /** How many times round the regions. The flow takes one; a session takes as
   *  many as its target needs. */
  maxPasses?: number;
}): PoolExercise[] {
  const target = args.target;
  const maxPasses = args.maxPasses ?? MOBILITY_MAX_MOVEMENTS;
  const byRegion = new Map<MobilityRegion, PoolExercise[]>();
  for (const region of MOBILITY_REGIONS) byRegion.set(region, []);
  for (const exercise of args.eligible) {
    const region = mobilityRegionOf(exercise);
    if (region) byRegion.get(region)!.push(exercise);
  }

  const picked: PoolExercise[] = [];
  const taken = new Set<string>();
  // Pass 1..n: one per region per pass, regions in their declared order, so the
  // spread holds at every session length and the extras are distributed rather
  // than stacked.
  for (let pass = 0; picked.length < target && pass < maxPasses; pass += 1) {
    let addedThisPass = false;
    for (const region of MOBILITY_REGIONS) {
      if (picked.length >= target) break;
      const candidates = byRegion.get(region)!;
      if (candidates.length === 0) continue;
      const offset = (args.seed + pass * 31) % candidates.length;
      let chosen: PoolExercise | null = null;
      for (let step = 0; step < candidates.length; step += 1) {
        const candidate = candidates[(offset + step) % candidates.length];
        if (taken.has(candidate.id)) continue;
        chosen = candidate;
        break;
      }
      if (!chosen) continue;
      taken.add(chosen.id);
      picked.push(chosen);
      addedThisPass = true;
    }
    // Every region is exhausted: the session SHRINKS rather than repeating a
    // movement or borrowing from outside the pool.
    if (!addedThisPass) break;
  }
  return picked;
}

/** Which regions a composed session covers. */
export function regionsCovered(session: readonly PoolExercise[]): MobilityRegion[] {
  const seen = new Set<MobilityRegion>();
  for (const exercise of session) {
    const region = mobilityRegionOf(exercise);
    if (region) seen.add(region);
  }
  return MOBILITY_REGIONS.filter((region) => seen.has(region));
}

/** The pool, for consumers that need it without importing the data module. */
export function mobilityPool(): readonly PoolExercise[] {
  return MOBILITY_POOL;
}
