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
import type { BlockExerciseSelection } from '../rules/blockExerciseSelection';

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
  /* ⚠ **THE HISTORY IS PART OF THE WORLD, AND LEAVING IT EMPTY HID THE DEFECT.**
   * The trace feeds each boundary what the HOME week recorded, because that is
   * what the athlete's store holds on the morning they leave. A cell that passes
   * `[]` composes a different block, lands different days, and the mid-week
   * Gunshow that carried the illegal row never appears — measured: the combined
   * mutant left this suite 19/0 while the trace it mirrors reported the illegal
   * row correctly. */
  selectionHistory?: readonly BlockExerciseSelection[];
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
    selectionHistory: args.selectionHistory ?? homeHistory,
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

// The block the athlete actually has on the morning they leave, recorded by the
// home week — the same history the trace threads through every boundary.
let homeHistory: readonly BlockExerciseSelection[] = [];
const home = week({ selectionHistory: [] });
homeHistory = (home.observation?.selections ?? []).map((sel) => ({
  blockNumber: 1, blockStartISO: sel.blockStartISO, slot: sel.slot,
  group: null, role: sel.role, identity: sel.identity,
})) as unknown as readonly BlockExerciseSelection[];
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

// ═══════════════════════════════════════════════════════════════════════════
// THE TRIP TAKES THE CLUB'S WORK AND LEAVES THE ATHLETE'S
// ═══════════════════════════════════════════════════════════════════════════
//
// R-018 *"if yes, follow same program"*, R-020 *"yes clear team training and
// games while away"*. Both halves are one rule and neither is optional.
//
// ⚠ THESE CELLS EXIST BECAUSE THE OPPOSITE SHIPPED. Measured 2026-08-17 on
// `6b617847`: a travel fact with a FULL commercial gym and no equipment change
// collapsed Tuesday and Thursday to REST while they carried six of the
// athlete's own lifts, and §18 then refused the entire week.

/** Travel only — the kit is untouched, so a failure here is the TRIP's doing. */
const travelOnly = week({ facts: [travelFact(WEEK_MONDAY, TRIP_UNTIL)] });
/** The same trip as the constraints generation actually receives. */
const travelConstraints = (() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { composeTemporarySourceFactCompatibility } = require('../rules/temporarySourceFact');
  return composeTemporarySourceFactCompatibility({
    temporarySourceFacts: [travelFact(WEEK_MONDAY, TRIP_UNTIL)],
    onDate: WEEK_MONDAY,
  }).activeConstraints;
})();

run('[8] a trip with a full gym still PUBLISHES A WEEK', () => {
  assert(travelOnly.error === null,
    `the athlete marked a trip, kept every piece of his own kit, and got NO WEEK: `
    + `${travelOnly.error}`);
  assert(travelOnly.visible.length > 0, 'the week published nothing at all');
});

run('[9] NON-VACUITY — the control week really does carry club anchors', () => {
  assert(home.anchors.length > 0,
    'the HOME week shows no team training or game at all, so cell [10] could not '
    + 'tell a working trip from an athlete who never had a club');
});

run('[10] the club\'s work inside the span is gone', () => {
  assert(travelOnly.anchors.length === 0,
    `the trip runs ${WEEK_MONDAY}..${TRIP_UNTIL} and the week still shows `
    + `${travelOnly.anchors.join(' | ')} — the athlete is a thousand kilometres away`);
});

run('[11] the athlete\'s OWN sessions survive the trip', () => {
  const strengthDays = (result: BoundaryResult): number =>
    result.visible.filter((day) => day.lines.some((line) => /Strength|Gunshow/.test(line))).length;
  const homeDays = strengthDays(home);
  const awayDays = strengthDays(travelOnly);
  assert(homeDays > 0, 'the home week has no strength days — the counter is dead');
  assert(awayDays >= homeDays,
    `the athlete trained on ${homeDays} day(s) at home and ${awayDays} away. The club `
    + 'is shut; his own gym work is not, and R-018 says the program keeps running.');
});

/* ⚠ **CELL [10] SURVIVED THE MUTANT THAT DISABLES THIS FIX, AND THAT IS WHY
 * [10b] EXISTS.** Disabling the plan-side removal left [10] green, because the
 * READ side (`sessionResolver`'s away pass) hides club work from the projection
 * whatever the plan did. So [10] holds a real athlete-visible property and holds
 * NOTHING about this change. The distinctive property of the plan-side fix is
 * that the week is BUILT for an athlete with no club night at all — never
 * allocated around a phantom one and repaired afterwards — and only the
 * scheduler's own inputs can say that. `[8]` and `[11]` hold the pipeline half
 * through the real generator; this holds the owner's contract. */
run('[10b] the SCHEDULER is told about no club night inside the span', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { weeklySchedulerInputsFrom } = require('../rules/weeklySchedulerInputs');
  const inputsFor = (facts: readonly unknown[]) => weeklySchedulerInputsFrom({
    profile: base,
    weekStartISO: WEEK_MONDAY,
    offseasonSubphase: null,
    activeConstraints: facts.length === 0 ? [] : travelConstraints,
  });
  const atHome = inputsFor([]);
  const onTrip = inputsFor([1]);
  assert(atHome.clubNights.length > 0 && atHome.gameDay !== null,
    'the control athlete has no club night or no fixture, so this cell could not '
    + 'tell a working trip from an athlete who never had a club');
  assert(onTrip.clubNights.length === 0,
    `the plan is still being built around ${onTrip.clubNights.length} club night(s) `
    + 'the athlete cannot attend. The week gets allocated around a session that is '
    + 'not happening, and something downstream has to delete it afterwards — which '
    + 'is exactly what deleted six of his own lifts.');
  assert(onTrip.gameDay === null,
    'the plan is still anchored to a fixture inside the trip');
});

run('[12] a fixture OUTSIDE the span is untouched', () => {
  // The trip ends on the 16th; the following Saturday is the 22nd. Sam:
  // *"the game on the 15th should be removed … but the next saturday the 22nd
  // game is still alive"*.
  const nextWeek = week({
    facts: [travelFact(WEEK_MONDAY, TRIP_UNTIL)],
    todayISO: RETURN_DATE, weekMondayISO: RETURN_DATE,
  });
  assert(nextWeek.error === null, `the week after the trip did not generate: ${nextWeek.error}`);
  assert(nextWeek.anchors.length > 0,
    'the trip ended before this week began and its club nights and fixture are '
    + 'still missing — the span is leaking past its own end date');
});

// ═══════════════════════════════════════════════════════════════════════════
// THE SANDBAG — A REQUIREMENT NO ATHLETE COULD ANSWER
// ═══════════════════════════════════════════════════════════════════════════
//
// `EXERCISE_EQUIPMENT_REQUIREMENT["Bear Carry"] = ['sandbag']` is Sam's own
// answer, and `sandbag` was in no tag union, no label map and no checklist. So
// `exerciseIsAvailableWith` asked every athlete for a thing none of them could
// own: **Bear Carry was refused on every kit, forever, in silence.**
//
// ⚠ THE CAUSE IS AN AUTHORITY, NOT A MISSING ENTRY, and these cells are aimed
// at the authority. `deriveEquipmentVocabulary` read FIVE authored sources and
// Sam's sheet was not one of them, so the both-directions gate — whose whole
// job is "nothing authored may require an unaskable tag" — was blind to it. The
// sheet is now read FIRST for any exercise it knows.

run('[13] Bear Carry is legal ONLY when a sandbag is actually present', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { exerciseIsAvailableWith: availableWith } = require('../data/exerciseEquipmentRequirement');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { FULL_GYM_EQUIPMENT } = require('../utils/equipmentAvailability');
  const full = [...FULL_GYM_EQUIPMENT] as string[];
  const withoutBag = full.filter((tag) => tag !== 'sandbag');
  assert(full.includes('sandbag'),
    'the commercial-gym preset does not carry a sandbag, so this cell cannot tell '
    + 'a working answer from the silence it exists to remove');
  assert(availableWith('Bear Carry', full),
    'a commercial-gym athlete who ticked every askable item STILL cannot be given '
    + 'Bear Carry — the requirement is still unanswerable');
  assert(!availableWith('Bear Carry', withoutBag),
    'Bear Carry is legal for an athlete who owns everything EXCEPT a sandbag. '
    + 'That is a Full-Gym exception or a name whitelist, and Sam ruled out both.');
  assert(!availableWith('Bear Carry', ['bodyweight', 'dumbbells']),
    'Bear Carry is legal on dumbbells alone — it is a sandbag carry');
  assert(availableWith('Farmer Carry', withoutBag),
    'CONTROL: Farmer Carry needs dumbbells and became illegal too, so the change '
    + 'has broken carries generally rather than answered one requirement');
});

run('[14] the checklist ASKS about a sandbag, and gained nothing else', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { derivedEquipmentChecklistTags } = require('../rules/equipmentVocabulary');
  const checklist = derivedEquipmentChecklistTags() as string[];
  assert(checklist.includes('sandbag'),
    'the athlete still cannot say they own a sandbag, so the requirement is still '
    + 'unanswerable and Bear Carry is still dead');
  // The 17 that were askable before, so a widening shows up here rather than in
  // a screen nobody reads.
  const before = ['ab_wheel', 'back_extension_bench', 'bands', 'barbell', 'bench',
    'cables', 'dip_bars', 'dumbbells', 'foam_roller', 'kettlebell', 'machine',
    'plyo_box', 'pullup_bar', 'rack', 'rings_trx', 'swiss_ball', 'trap_bar'];
  const gained = checklist.filter((tag) => !before.includes(tag));
  const lost = before.filter((tag) => !checklist.includes(tag));
  assert(lost.length === 0, `the checklist LOST ${lost.join(', ')}`);
  assert(gained.length === 1 && gained[0] === 'sandbag',
    `the checklist gained ${gained.join(', ')} — reading Sam's sheet was supposed `
    + 'to add exactly the one question it had been silent about');
});

run('[15] the club and home presets did NOT gain a sandbag', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EQUIPMENT_LOCATION_PRESETS } = require('../rules/equipmentLocationPresets');
  for (const id of ['club_gym', 'home_gym']) {
    const preset = EQUIPMENT_LOCATION_PRESETS.find((p: any) => p.id === id);
    assert(preset && !preset.preTickedTags.includes('sandbag'),
      `the ${id} preset now pre-ticks a sandbag. Those lists carry Sam's signature `
      + 'and only the commercial preset is "all askable equipment".');
  }
  const commercial = EQUIPMENT_LOCATION_PRESETS.find((p: any) => p.id === 'commercial_gym');
  assert(commercial?.preTickedTags.includes('sandbag'),
    'commercial gym means all askable equipment, and it is missing the sandbag');
});

// ═══════════════════════════════════════════════════════════════════════════
// THE LEGALITY CENSUS — EVERY VISIBLE ROW, AGAINST THAT DAY'S OWN KIT
// ═══════════════════════════════════════════════════════════════════════════
//
// The mission's flat rule: *"Never program an exercise requiring unavailable
// equipment."* Not "never compose one" — never PROGRAM one, which means the row
// the athlete reads on the day they read it.
//
// ⚠ **THIS CELL EXISTS BECAUSE THE COMPOSER WAS INNOCENT AND THE WEEK WAS STILL
// WRONG.** Measured 2026-08-17 on a mid-week trip with dumbbells and bands:
// every composed STRENGTH row was legal, and the Gunshow on the Friday shipped
// `Tricep Pushdown` — which needs cables — in a hotel room. It is authored at
// READ time by `sessionResolver`'s `applyGameProximity`, from an
// `AthleteContext` whose kit was resolved once for the whole week.
//
// So the census walks the PROJECTION, not the composer: it is the only place
// that sees every producer's output at once, and it cannot be satisfied by
// fixing one of them.

/* ⚠ **THE CENSUS MUST INCLUDE A MID-WEEK TRIP, AND THE FIRST VERSION DID NOT.**
 * Every world above departs on the week's own Monday, which means the WEEK-level
 * kit `useScheduleState` resolves (at `todayISO`) already equals the DAY's kit —
 * so the read-side day resolution has nothing to correct and reverting it
 * changes nothing. Measured: the combined mutant that reverts BOTH read-side
 * fixes left this suite 17/0.
 *
 * The defect only exists when the two disagree: leave on WEDNESDAY, and Monday's
 * week-level answer is a full commercial gym while Friday's is a hotel room.
 * That is the world the `Tricep Pushdown` was found in, and it is the world the
 * census has to walk. */
const MID_WEEK_TRIP = [
  travelFact('2026-08-12', TRIP_UNTIL),
  awayEquipmentFact({
    from: '2026-08-12', until: TRIP_UNTIL,
    removedTags: REMOVED, removedModalities: REMOVED_MODALITIES,
  }),
];
const midWeekAway = week({ facts: MID_WEEK_TRIP });

const censusOf = (result: BoundaryResult): string[] =>
  result.visible.flatMap((day) => day.lines.filter((line) => /ILLEGAL ON/.test(line)));

run('[16b] NON-VACUITY — the mid-week trip really does split the week\'s kit', () => {
  const kits = new Set(midWeekAway.visible.map((day) => day.day.replace(/^.*\[kit: /, '')));
  assert(kits.size > 1,
    `every day of the mid-week trip resolved to the same kit (${[...kits].join(', ')}). `
    + 'The week is not split, so the census below cannot see the defect it exists for.');
});

run('[17] a trip removes the FIXTURE from the read side too, not just the plan', () => {
  assert(home.anchors.some((anchor) => /game|match/i.test(anchor)),
    'the control week shows no fixture at all, so this cell cannot fail');
  const inside = midWeekAway.visible.filter((day) => {
    const date = day.day.slice(0, 10);
    return date >= '2026-08-12' && date <= TRIP_UNTIL;
  });
  const fixtureDays = inside.filter((day) => /game|match/i.test(day.title));
  assert(fixtureDays.length === 0,
    `the athlete is away and the week still shows ${fixtureDays.map((d) => d.day).join(', ')} `
    + 'as a fixture. A virtual game re-derived from `gameDay` reappears every '
    + 'Saturday forever, including Saturdays he is a thousand kilometres away — '
    + 'and it then anchors a G-1 session that displaces a composed strength day.');
});

run('[16] NO visible row is illegal on the kit the athlete has that day', () => {
  const worlds: Array<[string, BoundaryResult]> = [
    ['home', home],
    ['away (kit removed)', away],
    ['away, DEPARTING MID-WEEK', midWeekAway],
    ['away (travel only)', travelOnly],
    ['home again, return date', week({
      facts: AWAY_FACTS, todayISO: RETURN_DATE, weekMondayISO: RETURN_DATE,
    })],
  ];
  let rows = 0;
  const offences: string[] = [];
  for (const [name, world] of worlds) {
    assert(world.error === null, `${name} did not generate: ${world.error}`);
    rows += world.visible.reduce((sum, day) => sum + day.lines.length, 0);
    for (const line of censusOf(world)) offences.push(`${name}: ${line.trim()}`);
  }
  assert(rows > 40,
    `the census only saw ${rows} lines across four weeks — that is not a full `
    + 'program and an empty census proves nothing');
  assert(offences.length === 0,
    `${offences.length} row(s) require kit the athlete does not have that day:\n      `
    + offences.join('\n      '));
});

console.log(`\nEquipment scope ownership: ${passed} passed, ${failed} failed`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  - ${f}`); }
totalsPrinted(failures.length);
process.exit(failed === 0 ? 0 : 1);
