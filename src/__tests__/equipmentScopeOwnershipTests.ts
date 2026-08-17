/**
 * THREE EQUIPMENT SCOPES, AND ONLY THE PERMANENT ONE REACHES THE RECORD.
 *
 * Sam's model (R-072, R-018, R-019): **PROFILE** is permanent, **SESSION** is
 * this session only, **AWAY** is a dated span that lifts itself on the return
 * date. The mission's derivation in one line: *"permanent profile → minus active
 * dated-away removals → minus current-session removals, for that session only"*.
 *
 * ## WHY THESE CELLS RUN THE REAL GENERATOR
 *
 * The property is a PIPELINE property — *"a temporary substitution never becomes
 * permanent rotation history"* — and a cell that asserted it against
 * `composeWeek` alone would be satisfied by a composer nobody calls with the
 * right arguments. That is the documented shape of the 116-green-cells defect
 * (2026-08-10: every cell named the FUNCTION and the bug was an ARGUMENT).
 *
 * So every cell here drives **`generateProgramLocally`** and reads what the live
 * `composeWeek` was actually handed and actually returned, through the single
 * observer in `scripts/trace-equipment-scopes.ts`. **The guard and the trace read
 * the same tap**, so they cannot drift into two answers about one run.
 *
 * ## THE CONTROLS ARE HALF THE SUITE, AND THEY ARE NOT DECORATION
 *
 * *"A green gate is a claim."* A guard that only asserts "the record did not
 * change" is satisfied completely by an app that has stopped reading equipment
 * at all. So `[6]` changes the athlete's PERMANENT answer and REQUIRES the record
 * to move, and `[1]` asserts the temporary removal genuinely reached the composer
 * before asking what it did there. Neither can pass on an inert kit.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  runBoundary, athlete, travelFact, awayEquipmentFact,
  type BoundaryResult,
} from '../../scripts/trace-equipment-scopes';

armTotalsOrRed();

let passed = 0;
let failed = 0;
const failures: string[] = [];
function run(name: string, fn: () => void): void {
  try { fn(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) { failed += 1; failures.push(`${name}: ${(e as Error).message}`); console.log(`  FAIL ${name}`); console.log(`      ${(e as Error).message}`); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

console.log('\n-- Equipment scopes: only the permanent answer reaches the record --');

const WEEK_MONDAY = '2026-08-10';
const TRIP_UNTIL = '2026-08-16';
const RETURN_DATE = '2026-08-17';

/** A hotel gym: dumbbells and bands survive, everything else comes off HIS list. */
const REMOVED = [
  'barbell', 'cables', 'machine', 'bench', 'pullup_bar', 'kettlebell',
  'plyo_box', 'rack', 'trap_bar', 'swiss_ball', 'ab_wheel',
  'back_extension_bench', 'dip_bars', 'rings_trx', 'foam_roller',
];
const REMOVED_MODALITIES = ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'];

const base = athlete();

function week(args: {
  profile?: ReturnType<typeof athlete>;
  facts?: readonly unknown[];
  todayISO?: string;
  weekMondayISO?: string;
}): BoundaryResult {
  return runBoundary({
    id: 'cell', title: 'cell',
    profile: args.profile ?? base,
    todayISO: args.todayISO ?? WEEK_MONDAY,
    weekMondayISO: args.weekMondayISO ?? WEEK_MONDAY,
    phaseWeek: 8,
    blockStartISO: args.weekMondayISO ?? WEEK_MONDAY,
    blockNumber: 1,
    facts: args.facts ?? [],
    selectionHistory: [],
  });
}

/** The trip, marked and live from the week's own Monday. */
const AWAY_FACTS = [
  travelFact(WEEK_MONDAY, TRIP_UNTIL),
  awayEquipmentFact({
    from: WEEK_MONDAY, until: TRIP_UNTIL,
    removedTags: REMOVED, removedModalities: REMOVED_MODALITIES,
  }),
];

const home = week({});
const away = week({ facts: AWAY_FACTS });

const recordOf = (result: BoundaryResult): Record<string, string> =>
  Object.fromEntries((result.observation?.selections ?? [])
    .map((entry) => [entry.slot, entry.identity]));

// ── [1] NON-VACUITY FIRST. ────────────────────────────────────────────────
run('[1] NON-VACUITY — the dated removal actually reaches the composer', () => {
  assert(!!home.observation && !!away.observation, 'the composer did not run');
  assert(home.observation!.kit.length > away.observation!.rows.length * 0
    && home.observation!.kit.length >= 15,
    `the control athlete reached the composer with only ${home.observation!.kit.length} tags — `
    + 'that is not a commercial gym and every comparison below would be meaningless');
  const substitutions = away.observation!.substitutions;
  assert(substitutions.length > 0,
    'the away week produced ZERO substituted rows. Either the removal never reached '
    + 'the composer, or the composer is not distinguishing today\'s kit from the '
    + 'permanent one — and every cell below would pass vacuously');
});

// ── [2] THE RECORD IS THE PERMANENT ANSWER. ───────────────────────────────
run('[2] a dated removal changes NOTHING the block records', () => {
  const before = recordOf(home);
  const after = recordOf(away);
  const changed = Object.keys(before).filter((slot) => after[slot] !== before[slot]);
  assert(changed.length === 0,
    `${changed.length} slot(s) recorded the TRIP's answer as the athlete's block selection: `
    + changed.map((slot) => `${slot} ${before[slot]} -> ${after[slot]}`).join('; ')
    + '. A five-day holiday has become their permanent rotation history.');
});

run('[3] a slot the trip empties still records its permanent base', () => {
  const before = Object.keys(recordOf(home));
  const after = Object.keys(recordOf(away));
  const lost = before.filter((slot) => !after.includes(slot));
  assert(lost.length === 0,
    `the away week recorded ${after.length} slots against the home week's ${before.length}; `
    + `${lost.join(', ')} vanished from the athlete's history because a hotel room `
    + 'has no bar. The slot is theirs; only today\'s row is missing.');
});

// ── [4] THE SUBSTITUTE IS TYPED, AND IT NAMES WHAT IT REPLACED. ───────────
run('[4] every substituted row carries its base identity and a kit cause', () => {
  const substitutions = away.observation!.substitutions;
  for (const sub of substitutions) {
    assert(sub.base !== sub.shipped,
      `${sub.slot} claims to substitute ${sub.base} with itself`);
    assert(sub.cause === 'kit_today' || sub.cause === 'excluded_today',
      `${sub.slot} carries an unknown substitution cause '${sub.cause}'`);
  }
  const kitCaused = substitutions.filter((sub) => sub.cause === 'kit_today');
  assert(kitCaused.length > 0,
    'no row named the KIT as the reason it was swapped, though the only thing that '
    + 'changed is the kit — the cause is being mis-stamped');
  /* ⚠ **THE BASE IS NOT ALWAYS THE RECORDED IDENTITY, AND ASSERTING THAT WAS
   * WRONG.** A week can owe the same slot twice — a main lift on Monday and a
   * support row on Wednesday — and only the FIRST is recorded, because the
   * record is one row per slot per block. The support row's base is legitimately
   * a different exercise drawn from the support pool.
   *
   * The property that IS true of every substitute is the one this suite exists
   * for: **the base it names is an answer the athlete's PERMANENT kit could
   * perform.** A base the trip chose would be the trip writing the record. */
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { exerciseIsAvailableWith: availableWith } = require('../data/exerciseEquipmentRequirement');
  const permanentKit = home.permanentTags as string[];
  for (const sub of kitCaused) {
    assert(availableWith(sub.base, permanentKit),
      `${sub.slot} names ${sub.base} as its base, and the athlete's own permanent kit `
      + 'cannot perform it — the trip has chosen what the block calls its base');
  }
  const record = recordOf(away);
  for (const slot of Object.keys(record)) {
    assert(availableWith(record[slot], permanentKit),
      `the block recorded ${record[slot]} for ${slot}, which the athlete's PERMANENT `
      + 'kit cannot do. That row can only have come from the trip.');
  }
});

run('[5] the shipped substitute is legal on the day the athlete trains it', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { exerciseIsAvailableWith } = require('../data/exerciseEquipmentRequirement');
  const kit = ['bodyweight', 'dumbbells', 'bands'];
  for (const sub of away.observation!.substitutions) {
    if (sub.cause !== 'kit_today') continue;
    // eslint-disable-next-line no-continue
    assert(exerciseIsAvailableWith(sub.shipped, kit),
      `${sub.slot} swapped ${sub.base} for ${sub.shipped}, which this kit still cannot do`);
  }
});

// ── [6] THE CONTROL THAT MAKES ALL OF THE ABOVE MEAN SOMETHING. ───────────
run('[6] CONTROL — a PERMANENT profile change DOES move the record', () => {
  const permanentlyLimited = athlete({
    equipmentAnswer: {
      tags: { dumbbells: 'have', bands: 'have' },
      modalities: {},
      answeredOn: '2026-08-01',
    },
  } as never);
  const limited = week({ profile: permanentlyLimited });
  const before = recordOf(home);
  const after = recordOf(limited);
  const changed = Object.keys(before).filter((slot) => after[slot] && after[slot] !== before[slot]);
  assert(changed.length > 0,
    'an athlete who PERMANENTLY owns only dumbbells and bands recorded the identical '
    + 'block selection as a commercial-gym athlete. Equipment has stopped reaching '
    + 'the base selection at all, which would make every cell above pass on an inert app.');
  assert(limited.observation!.substitutions.filter((entry) => entry.cause === 'kit_today').length === 0,
    'a PERMANENT kit change produced temporary kit substitutions. A permanent answer '
    + 'must move the base itself, not ship a substitute against it forever.');
});

// ── [7] THE RETURN DATE, WITH NOTHING FOR THE ATHLETE TO CLEAR. ───────────
run('[7] on the return date the base selection is back, by expiry alone', () => {
  const returned = week({
    facts: AWAY_FACTS, todayISO: RETURN_DATE, weekMondayISO: RETURN_DATE,
  });
  assert(returned.activeTags.length === home.activeTags.length,
    `the athlete is home on ${RETURN_DATE} and the resolver still answers `
    + `${returned.activeTags.length} tags against their ${home.activeTags.length}`);
  assert(returned.observation!.substitutions.filter((entry) => entry.cause === 'kit_today').length === 0,
    'the trip is over and rows are still being substituted for a kit reason');
});

console.log(`\nEquipment scope ownership: ${passed} passed, ${failed} failed`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  - ${f}`); }
totalsPrinted(failures.length);
process.exit(failed === 0 ? 0 : 1);
