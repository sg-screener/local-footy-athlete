/**
 * CENSUS — WHAT DOES THE INJURY LADDER ACTUALLY OFFER, PER PATTERN, PER REGION,
 * PER AUTHORED SEVERITY BAND?
 *
 * The mission's question stated as a measurement: for every strength row the app
 * can program, under every one of Sam's 13 injury regions and all four of his
 * authored severity bands, **which rung does the ladder land on** — and how often
 * does it land on nothing, or on something that abandons the movement pattern?
 *
 * It reads the ladder through `getTapSwapChoices(reason: 'injury_or_pain')`, the
 * same door `planInjuryRecomposition` uses, so a census row is a claim about the
 * REAL ladder and not about a table beside it.
 *
 * Two units, reported separately and never added together:
 *   OCCURRENCES     — (exercise x region x band) cells. The size of the grid.
 *   ATHLETE WORLDS  — (region x band) worlds. What an athlete can actually be in.
 *
 * Run: `npm run census:injury-fallback`
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;

import { STRENGTH_POOLS, type PoolSlotKey } from '../src/data/exercisePoolsStrength';
import { INJURY_REGIONS, type InjuryRegion } from '../src/data/injuryRegions';
import { getExerciseTags } from '../src/data/exerciseTags';
import { resolveExerciseName } from '../src/utils/loadEstimation';
import {
  assessTapSwapCandidateSafety,
  getTapSwapChoices,
  type TapSwapEnvironment,
} from '../src/utils/tapSwapHierarchy';
import type { InjuryBucket } from '../src/utils/programAdjustmentEngine';
import { severityHasModerateEffect } from '../src/rules/injurySeverityBands';

/** One representative severity per authored Bible band. */
const BANDS: ReadonlyArray<{ label: string; severity: number }> = [
  { label: '1-3 mild', severity: 2 },
  { label: '4-5 moderate', severity: 4 },
  { label: '6-7 limiting', severity: 6 },
  { label: '8-10 severe', severity: 9 },
];

/**
 * A full-gym athlete with the injury LIVE in `activeInjuries`, exactly as
 * `resolveTapSwapEnvironment` builds it — the census must be measuring INJURY
 * legality and nothing else.
 *
 * ⚠ **POSITIVE AND NEGATIVE CONTROLS ARE PRINTED BEFORE THE GRID.** The first
 * cut of this census guessed the `EquipmentClass` vocabulary, so `Pull-Ups` and
 * every cable row read as "unsafe" on an EQUIPMENT miss and squat/hinge/push
 * read as 0 unsafe under a severe injury. It reported a confident, wrong 468.
 */
function fullGymEnvironment(
  bucket: InjuryBucket,
  severity: number,
): TapSwapEnvironment {
  const level: 'caution' | 'avoid' = severityHasModerateEffect(severity) ? 'avoid' : 'caution';
  return {
    /* BOTH SHAPES, ON PURPOSE. The control tree reads `activeInjuries` and the
     * candidate tree reads `injurySeverities`; carrying both lets ONE script
     * measure both, which is the only way the two numbers are comparable. The
     * controls below prove the right one is being read on whichever tree ran. */
    activeInjuries: { [bucket]: level } as never,
    injurySeverities: { [bucket]: severity } as never,
    primaryInjury: { bucket, severity },
    availableEquipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell'],
    availableEquipmentTags: [
      'barbell', 'dumbbells', 'cables', 'machine', 'bands', 'bench', 'pullup_bar',
      'kettlebell', 'foam_roller', 'plyo_box', 'rack', 'trap_bar', 'swiss_ball',
      'ab_wheel', 'back_extension_bench', 'dip_bars', 'rings_trx', 'sandbag',
      'bike_or_treadmill', 'bodyweight',
    ],
    capacity: 'high',
    hasEquipmentConstraint: false,
    medicalStop: false,
  };
}

/**
 * THE CONTROLS. A census that cannot tell "safe" from "the instrument is
 * broken" is a coincidence detector.
 *
 *   NEGATIVE — with NO injury, not one strength row may read unsafe. Anything
 *              that does is an equipment or readiness miss in the harness.
 *   POSITIVE — `Back Squat` under a 9/10 knee MUST read unsafe. If it does not,
 *              the injury never reached the predicate.
 */
function controls(): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  const healthy: TapSwapEnvironment = {
    ...fullGymEnvironment('knee' as InjuryBucket, 9),
    activeInjuries: {} as never, injurySeverities: {}, primaryInjury: null,
  };
  const falseUnsafe = allPooledExercises()
    .filter((e) => !assessTapSwapCandidateSafety(e.name, healthy).safe)
    .map((e) => e.name);
  lines.push(`POSITIVE CONTROL — ladder answers Bench Press under shoulder/4: ${JSON.stringify(
    getTapSwapChoices({
      originalExercise: 'Bench Press', reason: 'injury_or_pain',
      environment: fullGymEnvironment('shoulder' as InjuryBucket, 4),
      primaryInjury: { bucket: 'shoulder' as InjuryBucket, severity: 4 },
      existingExerciseNames: [], recoveryAllowed: true,
    }).slice(0, 2).map((c) => c.name))}`);
  lines.push(`NEGATIVE CONTROL — healthy athlete, rows reading unsafe: ${falseUnsafe.length} ${JSON.stringify(falseUnsafe)}`);
  const positive = !assessTapSwapCandidateSafety('Back Squat', fullGymEnvironment('knee' as InjuryBucket, 9)).safe;
  lines.push(`POSITIVE CONTROL — Back Squat unsafe under knee/9: ${positive}`);
  return { ok: falseUnsafe.length === 0 && positive, lines };
}

function allPooledExercises(): Array<{ slot: PoolSlotKey; name: string }> {
  const out: Array<{ slot: PoolSlotKey; name: string }> = [];
  for (const slot of Object.keys(STRENGTH_POOLS) as PoolSlotKey[]) {
    for (const role of ['anchor', 'accessory'] as const) {
      for (const entry of STRENGTH_POOLS[slot][role].entries) out.push({ slot, name: entry.name });
    }
  }
  return out;
}

interface Row {
  slot: PoolSlotKey;
  exercise: string;
  region: InjuryRegion;
  band: string;
  /** Was the row unsafe at all in this world? Only unsafe rows need a fallback. */
  unsafe: boolean;
  /** The chosen replacement's name, or null for an omission. */
  replacement: string | null;
  /** Did the replacement keep the athlete in the same pool slot (pattern+plane)? */
  samePattern: boolean;
  tier: string | null;
}

function slotOf(name: string): PoolSlotKey | null {
  for (const slot of Object.keys(STRENGTH_POOLS) as PoolSlotKey[]) {
    const pool = STRENGTH_POOLS[slot];
    if (pool.anchor.entries.some((e) => e.name === name)) return slot;
    if (pool.accessory.entries.some((e) => e.name === name)) return slot;
  }
  return null;
}

function main(): void {
  const check = controls();
  for (const line of check.lines) console.log(line);
  if (!check.ok) { console.log('CONTROLS FAILED — the grid below would be a coincidence detector. Stopping.'); process.exit(1); }
  console.log('');
  const exercises = allPooledExercises();

  const rows: Row[] = [];
  for (const { slot, name } of exercises) {
    for (const region of INJURY_REGIONS) {
      for (const band of BANDS) {
        const environment = fullGymEnvironment(region as InjuryBucket, band.severity);
        /* ⚠ **THE "NEEDS A FALLBACK" QUESTION IS ASKED FROM SAM'S RATINGS AND
         * BANDS DIRECTLY, NOT FROM THE CODE UNDER TEST.** The whole finding is
         * that the app moved that edge; a census that asked the app would move
         * its own denominator with the fix and the two runs would not be
         * comparable. `avoid` always needs one; `caution` needs one from the 4-5
         * band up (*"swap obvious aggravators"*). */
        const rating = getExerciseTags(resolveExerciseName(name))?.injury[region];
        const unsafe = rating === 'avoid'
          || (rating === 'caution' && severityHasModerateEffect(band.severity));
        if (!unsafe) {
          rows.push({ slot, exercise: name, region, band: band.label, unsafe: false, replacement: null, samePattern: false, tier: null });
          continue;
        }
        const choices = getTapSwapChoices({
          originalExercise: name,
          reason: 'injury_or_pain',
          environment,
          primaryInjury: { bucket: region as InjuryBucket, severity: band.severity },
          existingExerciseNames: [],
          recoveryAllowed: true,
        });
        const chosen = choices.find((c) => Boolean(c.name)) ?? null;
        const replacement = chosen?.name ?? null;
        rows.push({
          slot, exercise: name, region, band: band.label, unsafe: true,
          replacement,
          samePattern: replacement ? slotOf(resolveExerciseName(replacement)) === slot : false,
          tier: chosen?.hierarchyTier ?? null,
        });
      }
    }
  }

  const unsafeRows = rows.filter((r) => r.unsafe);
  const kept = unsafeRows.filter((r) => r.samePattern);
  const abandoned = unsafeRows.filter((r) => r.replacement && !r.samePattern);
  const omitted = unsafeRows.filter((r) => !r.replacement);

  console.log('══ INJURY FALLBACK CENSUS ══');
  console.log(`grid: ${exercises.length} strength exercises x ${INJURY_REGIONS.length} regions x ${BANDS.length} bands = ${rows.length} OCCURRENCES`);
  console.log(`distinct ATHLETE WORLDS (region x band): ${INJURY_REGIONS.length * BANDS.length}`);
  console.log('');
  console.log(`OCCURRENCES where the row is unsafe and needs a fallback: ${unsafeRows.length}`);
  console.log(`  kept in the same pattern+plane : ${kept.length}`);
  console.log(`  replaced OUTSIDE the pattern   : ${abandoned.length}`);
  console.log(`  omitted (no replacement)       : ${omitted.length}`);
  console.log('');

  // Per-pattern breakdown — the mission's unit.
  console.log('── PER MOVEMENT PATTERN (unsafe occurrences) ──');
  console.log('slot                 unsafe   same-pattern   outside   omitted');
  for (const slot of Object.keys(STRENGTH_POOLS) as PoolSlotKey[]) {
    const mine = unsafeRows.filter((r) => r.slot === slot);
    if (mine.length === 0) { console.log(`${slot.padEnd(20)} ${String(0).padStart(6)}`); continue; }
    console.log(
      `${slot.padEnd(20)} ${String(mine.length).padStart(6)}   ${String(mine.filter((r) => r.samePattern).length).padStart(12)}   ${String(mine.filter((r) => r.replacement && !r.samePattern).length).padStart(7)}   ${String(mine.filter((r) => !r.replacement).length).padStart(7)}`,
    );
  }
  console.log('');

  // Per-band: how restrictive is each authored band?
  console.log('── PER AUTHORED SEVERITY BAND ──');
  console.log('band              unsafe   same-pattern   outside   omitted');
  for (const band of BANDS) {
    const mine = unsafeRows.filter((r) => r.band === band.label);
    console.log(
      `${band.label.padEnd(17)} ${String(mine.length).padStart(6)}   ${String(mine.filter((r) => r.samePattern).length).padStart(12)}   ${String(mine.filter((r) => r.replacement && !r.samePattern).length).padStart(7)}   ${String(mine.filter((r) => !r.replacement).length).padStart(7)}`,
    );
  }
  console.log('');

  // WORLDS, not occurrences: how many (region x band) worlds keep NOTHING in pattern?
  const worlds: string[] = [];
  for (const region of INJURY_REGIONS) {
    for (const band of BANDS) {
      const mine = unsafeRows.filter((r) => r.region === region && r.band === band.label);
      if (mine.length > 0 && mine.every((r) => !r.samePattern)) {
        worlds.push(`${region}/${band.label}`);
      }
    }
  }
  console.log(`ATHLETE WORLDS in which NOT ONE unsafe row keeps its pattern: ${worlds.length} of ${INJURY_REGIONS.length * BANDS.length}`);
  console.log(`  ${JSON.stringify(worlds)}`);
  console.log('');
  console.log(`getExerciseTags coverage of pooled strength exercises: ${exercises.filter((e) => getExerciseTags(resolveExerciseName(e.name))).length}/${exercises.length}`);
}

if (require.main === module) main();
