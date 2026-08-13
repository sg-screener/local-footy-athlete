/**
 * R-070 HELD — ONE MAIN PER PATTERN PER SESSION.
 *
 * SAM'S BIBLE `:226`, and the assertions below are his own four sentences:
 *   *"ONE MAIN PER PATTERN PER SESSION. Never two heavy lifts of the same
 *   movement pattern in one session. Deadlift + RDL is two heavy hinges and is
 *   illegal. Box squat + back squat is two heavy squats and is illegal. A second
 *   heavy lift in a session must be a different pattern."*
 *
 * The ruling has stood since before the app existed. Registry row R-070 read
 * `UNENFORCED` — *"no duplicate-pattern validator exists"* — and census A4 said
 * the same. This suite is the guard the row was missing.
 *
 * ## THE SHAPE, AND IT IS THE ONE THE SLOT LAW PAID FOR
 *
 * `sessionSlotCoverageTests` learned this the expensive way and wrote it down:
 * *"EVERY CELL ABOVE FEEDS THIS ORACLE HAND-BUILT ROWS. Not one of them asks
 * whether a week the app GENERATES passes it."* So this suite has both halves —
 * hand-built sessions proving the oracle answers correctly, then the oracle
 * pointed at what the app actually ships, through BOTH producers.
 *
 * ## THE RED THIS WAS SEEN IN, BEFORE THE FIX (L12a — a green gate is a claim)
 *
 * Block [5] failed at **36 of 396 built sessions** on 2026-08-13. Every one was
 * the same shape: `Bench Press + Close Grip Bench`, two heavy horizontal presses
 * in one session, out of `exerciseScorer.selectExercises`. The fix is there;
 * this suite is what saw it, and 36 -> 0 is its receipt.
 *
 * ## FIVE MUTANTS KILLED, AND THE FIFTH REFUTED MY OWN WRITTEN CLAIM
 *
 * - `mainLiftSlot` collapsed to one pattern for everything: **8 cells red**.
 * - `isMainLift` always true (the heaviness test removed): **4 red**.
 * - the unauthored-role fallback deleted, so only `row.role` is read:
 *   **11 red**, both censuses fall to ZERO heavy lifts and both non-vacuity
 *   cells fire. That is the measured 201-of-235 fact biting.
 * - R-070 deleted from `findBestForSlot`'s PREFERRED pass: **red, 36 back**.
 * - R-070 deleted from the RELAX-FALLBACK: **SURVIVED, 23/23 green.** The header
 *   of this suite used to say every breach arrived through that fallback. It
 *   does not: the fallback check is a fence on a door nothing currently walks
 *   through, and the mutation is what said so. Recorded rather than quietly
 *   corrected, because a surviving mutant means "the gate is blind OR the
 *   mutation missed", and here it means neither — the line is simply not the
 *   one doing the work.
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  isMainLift,
  mainLiftPatternConflicts,
  mainLiftSlot,
  mainLiftsSeen,
} from '../rules/mainLiftPatternLaw';
import type { WorkoutExercise } from '../types/domain';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/** A row carrying only what the law reads: a name, and optionally a role. */
function row(name: string, role?: WorkoutExercise['role']): WorkoutExercise {
  return {
    id: `row:${name}`, workoutId: 'w', exerciseId: name, exerciseOrder: 0,
    prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 8, restSeconds: 120,
    ...(role ? { role } : {}),
    exercise: { id: name, name } as WorkoutExercise['exercise'],
  } as WorkoutExercise;
}

const session = (...names: string[]): WorkoutExercise[] => names.map((name) => row(name));
const slotsOf = (conflicts: ReturnType<typeof mainLiftPatternConflicts>): string[] =>
  conflicts.map((conflict) => conflict.slot);

// ── [1] NON-VACUITY — the oracle resolves Sam's own lifts ──────────────────
//
// EVERY "illegal" CELL BELOW IS TRIVIALLY TRUE IF THESE NAMES RESOLVE TO
// NOTHING, and that is not a hypothetical here: `getExerciseTags` had 151 rows
// resolving to nothing until 2026-08-13, and a "no hinge" finding once fired on
// a day that had one. This block is what stops the whole suite being a green
// report about an unreadable vocabulary.
console.log('\n[1] The law reads real exercises — non-vacuity first');
{
  ok('a back squat is a heavy lift', isMainLift(row('Back Squat')));
  ok('a deadlift is a heavy lift', isMainLift(row('Deadlift')));
  ok('an RDL is a heavy lift', isMainLift(row('RDLs')));
  ok('a bench press is a heavy lift', isMainLift(row('Bench Press')));
  ok('a back squat spends the squat pattern',
    mainLiftSlot('Back Squat') === 'squat', String(mainLiftSlot('Back Squat')));
  ok('a deadlift spends the hinge pattern',
    mainLiftSlot('Deadlift') === 'hinge', String(mainLiftSlot('Deadlift')));
  // THE CANONICALISATION THE LAW DEPENDS ON. Sam writes "RDL"; the generator
  // ships "RDLs"; the pools hold another spelling again. If this one resolves,
  // his own worked example is being judged rather than skipped.
  ok('an RDL spends the hinge pattern under the name the app ships',
    mainLiftSlot('RDLs') === 'hinge', String(mainLiftSlot('RDLs')));
}

// ── [2] SAM'S TWO ILLEGAL SESSIONS, IN HIS OWN WORDS ───────────────────────
console.log('\n[2] His own two illegal sessions');
{
  // *"Deadlift + RDL is two heavy hinges and is illegal."*
  const twoHinges = mainLiftPatternConflicts(session('Deadlift', 'RDLs', 'Pallof Press'));
  ok('Deadlift + RDL is ILLEGAL — two heavy hinges',
    slotsOf(twoHinges).includes('hinge'), JSON.stringify(twoHinges));
  ok('and the breach NAMES both lifts, not just the pattern',
    twoHinges[0]?.exercises.join(' + ') === 'Deadlift + RDLs',
    JSON.stringify(twoHinges[0]?.exercises));

  // *"Box squat + back squat is two heavy squats and is illegal."*
  const twoSquats = mainLiftPatternConflicts(session('Box Squat', 'Back Squat', 'Pallof Press'));
  ok('Box Squat + Back Squat is ILLEGAL — two heavy squats',
    slotsOf(twoSquats).includes('squat'), JSON.stringify(twoSquats));

  // *"A second heavy lift in a session must be a different pattern."*
  ok('a squat and a hinge together are LEGAL — his own fill order asks for both',
    mainLiftPatternConflicts(session('Back Squat', 'Trap Bar Deadlift', 'Pallof Press')).length === 0,
    JSON.stringify(mainLiftPatternConflicts(session('Back Squat', 'Trap Bar Deadlift'))));
}

// ── [3] THE TWO GRANULARITY DECISIONS, EACH LOAD-BEARING IN ONE DIRECTION ──
//
// Read the pattern too COARSELY and Sam's own ladders become illegal; read it
// too FINELY and his two illegal sessions become legal. Both errors are one
// vocabulary choice away, so both get a cell.
console.log('\n[3] What counts as the SAME pattern');
{
  // TOO COARSE would break this: his upper ladder asks for a horizontal push AND
  // a vertical push in one day (`:338`). Reading both as "push" would refuse it.
  ok('a bench press and an overhead press are DIFFERENT patterns — his upper ladder asks for both',
    mainLiftPatternConflicts(session('Bench Press', 'Overhead Press')).length === 0,
    JSON.stringify(mainLiftPatternConflicts(session('Bench Press', 'Overhead Press'))));
  // TOO FINE would break this: two different names, same plane, both heavy.
  // THIS IS THE PAIR THE APP WAS ACTUALLY SHIPPING — 36 sessions of it.
  ok('a bench press and a close-grip bench are the SAME pattern — two heavy horizontal presses',
    slotsOf(mainLiftPatternConflicts(session('Bench Press', 'Close Grip Bench')))
      .includes('horizontal_push'));
  // THE UNILATERAL SPLIT, which `sessionSlotCoverage` already paid for: his
  // lower ladder asks for a squat AND single-leg knee work in the same session.
  ok('a bilateral squat and single-leg knee work are DIFFERENT patterns',
    mainLiftPatternConflicts(session('Back Squat', 'Bulgarian Split Squat')).length === 0,
    JSON.stringify(mainLiftPatternConflicts(session('Back Squat', 'Bulgarian Split Squat'))));
}

// ── [4] THE LAW'S SUBJECT IS *HEAVY* LIFTS — AND THIS REFUTES CENSUS A4 ────
//
// Census A4 offered `RDLs + Hip Thrusts` as the app breaching R-070, *"both
// classify as main lifts"*. MEASURED 2026-08-13: `RDLs` is `main_lift`,
// `Hip Thrust` is `accessory` in the app's own pools. One heavy hinge and one
// accessory hinge is not what `:226` forbids — his sentence says HEAVY twice.
//
// The law is real and its guard is real; that particular worked example was
// not, and a cell asserting the census's version would have pinned a false
// claim into the chain.
console.log('\n[4] Two hinges are legal when only ONE of them is heavy');
{
  ok('Hip Thrust is not a heavy lift in the app\'s own pools',
    !isMainLift(row('Hip Thrust')));
  ok('RDLs + Hip Thrust is LEGAL — one heavy hinge, one accessory hinge',
    mainLiftPatternConflicts(session('RDLs', 'Hip Thrust')).length === 0,
    JSON.stringify(mainLiftPatternConflicts(session('RDLs', 'Hip Thrust'))));
  // AND THE AUTHORED ROLE STILL WINS. If a session says a row is accessory work,
  // the law believes it — that is the whole point of the field existing.
  ok('an authored accessory role takes a lift OUT of the law\'s reach',
    mainLiftPatternConflicts([row('Deadlift'), row('RDLs', 'accessory')]).length === 0);
  // THE FALLBACK IS LOAD-BEARING, MEASURED: 201 of 235 generated rows carry no
  // `role` at all. A law reading the field alone would see almost no heavy lifts
  // and report a clean app.
  ok('a row with NO authored role is still judged',
    slotsOf(mainLiftPatternConflicts(session('Deadlift', 'RDLs'))).includes('hinge'));
}

// ── [5] THE ORACLE POINTED AT THE COACH'S SESSION BUILDER ──────────────────
//
// **THIS IS THE BLOCK THAT WAS RED.** `selectExercises` is reached from
// `buildTagAwareSession`, which the coach's revision templates call when the
// athlete adds a strength session. Before the fix it shipped 36 breaches across
// these 396 sessions.
//
// ⚠ WHY IT DRIVES `buildIntent`'S NAME BRANCH TOO, THOUGH PRODUCTION DOES NOT
// REACH IT TODAY: the sole production caller passes `workoutType: 'Strength'`
// with a typed `strengthIntent`, so the typed branch runs and the name branch is
// currently unreachable. Every one of the 36 breaches was in the NAME branch. It
// is covered anyway because it is live code one caller away, and because a fence
// that only guards the reachable half is a fence that regresses the moment a
// template ships without a typed intent.
console.log('\n[5] The coach\'s session builder obeys the law');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getAllTaggedExercises } = require('../data/exerciseTags');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { applyHardFilters, buildFilterContext } = require('../utils/exerciseFilter');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildIntent, selectExercises } = require('../utils/exerciseScorer');

  const PATTERN_SETS = [
    ['squat'], ['hinge'], ['push'], ['pull'],
    ['squat', 'hinge'], ['push', 'pull'], ['squat', 'hinge', 'push', 'pull'],
  ];
  const INJURIES: Array<[string, Array<{ bodyArea: string; severity: string }>]> = [
    ['no injuries', []],
    ['severe lower back', [{ bodyArea: 'lower_back', severity: 'Severe' }]],
    ['severe hamstring', [{ bodyArea: 'hamstring', severity: 'Severe' }]],
    ['severe knee', [{ bodyArea: 'knee', severity: 'Severe' }]],
    ['severe shoulder', [{ bodyArea: 'shoulder', severity: 'Severe' }]],
    ['severe groin', [{ bodyArea: 'groin', severity: 'Severe' }]],
  ];
  const NAME_INTENTS = ['Lower Strength', 'Lower Squat', 'Upper Push', 'Upper Pull'];

  let built = 0;
  let heavyLiftsSeen = 0;
  const breaches: string[] = [];

  const judge = (label: string, picked: string[]): void => {
    built += 1;
    const rows = session(...picked);
    heavyLiftsSeen += mainLiftsSeen(rows).length;
    for (const conflict of mainLiftPatternConflicts(rows)) {
      breaches.push(`${label} | ${conflict.slot} <- ${conflict.exercises.join(' + ')}`);
    }
  };

  for (const [injuryLabel, injuries] of INJURIES) {
    for (const inSeason of [true, false]) {
      const ctx = buildFilterContext('2026-07-13', ['2026-07-18'], injuries, inSeason);
      const candidates = applyHardFilters(getAllTaggedExercises(), ctx);
      const season = inSeason ? 'in' : 'off';
      for (const patterns of PATTERN_SETS) {
        for (const count of [4, 5, 6]) {
          const intent = buildIntent('Lower Strength', 'gym', count, {
            plannedPatterns: patterns, effectivePatterns: patterns,
            primaryPattern: patterns[0], archetype: 'lower',
          });
          judge(`typed[${patterns.join('+')}] n=${count} | ${injuryLabel} | ${season}`,
            selectExercises(candidates, intent, ctx, new Set<string>()));
        }
      }
      for (const name of NAME_INTENTS) {
        for (const count of [4, 5, 6]) {
          judge(`name[${name}] n=${count} | ${injuryLabel} | ${season}`,
            selectExercises(candidates, buildIntent(name, 'gym', count), ctx, new Set<string>()));
        }
      }
    }
  }

  // NON-VACUITY, AND IT IS THE WHOLE RISK IN THIS BLOCK. Probe 2 of this unit
  // built 210 "sessions" that contained ZERO heavy lifts — it passed
  // `workoutType: 'strength'`, which hits `buildIntent`'s conservative core/carry
  // shell before any pattern branch, so every session was five band exercises.
  // It reported 0 breaches and proved nothing. This cell is that mistake, caught.
  ok('[non-vacuity] the built sessions actually contain heavy lifts',
    heavyLiftsSeen >= 100, `heavy lifts across ${built} sessions: ${heavyLiftsSeen}`);
  ok('no session the coach builder composes carries two heavy lifts of one pattern',
    breaches.length === 0,
    `${breaches.length} of ${built} sessions breach R-070\n     ${breaches.join('\n     ')}`);
  console.log(`\n  R-070 BUILDER CENSUS: ${breaches.length} breaches of ${built} built sessions `
    + `(${heavyLiftsSeen} heavy lifts seen)`);
  for (const line of breaches) console.log(`    ${line}`);
}

// ── [6] THE ORACLE POINTED AT THE WEEKLY GENERATOR ─────────────────────────
//
// The other producer, and a DIFFERENT code path — `generateProgramLocally` never
// calls `selectExercises`; it composes from plan entries and `defaultProgram`'s
// fallbacks. Measured clean on 2026-08-13 (58 sessions, 63 heavy lifts, 0
// breaches), so this arm is a ratchet holding a green state, not a repair.
//
// ⚠ IT IS PINNED AT ZERO, NOT AT TODAY'S NUMBER. R-070 is a LAW, and the
// registry forbids a law entering with a dated debt attached. A ceiling above
// zero here would be a knowingly-illegal session shipped under a green cell.
console.log('\n[6] The weekly generator obeys the law');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { generateProgramLocally } = require('../services/api/generateProgram');
  const BASE = {
    trainingLocation: 'Commercial gym', equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete', trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDays: ['Tuesday', 'Thursday'], gameDay: 'Saturday',
    recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
  };
  const WORLDS: Array<[string, unknown]> = [
    ['in-season full gym', { ...BASE, seasonPhase: 'In-season' }],
    ['pre-season full gym', { ...BASE, seasonPhase: 'Pre-season' }],
    ['off-season full gym', { ...BASE, seasonPhase: 'Off-season' }],
    ['in-season no club', { ...BASE, seasonPhase: 'In-season', teamTrainingDays: [] }],
    ['off-season bodyweight', {
      ...BASE, seasonPhase: 'Off-season',
      equipment: ['Bodyweight Only'], teamTrainingDays: [],
    }],
  ];

  let sessionsSeen = 0;
  let heavyLiftsSeen = 0;
  let worldsBuilt = 0;
  const breaches: string[] = [];
  for (const [label, profile] of WORLDS) {
    let program: any;
    try {
      program = generateProgramLocally(profile, {
        todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
      });
    } catch (error) {
      console.log(`    WORLD REFUSED: ${label} — ${String((error as Error).message).slice(0, 200)}`);
      // A world Section 18 REFUSES to build never reaches the athlete, so it
      // cannot breach this law. It is skipped rather than counted — and the
      // non-vacuity cell below is what stops every world being skipped quietly.
      continue;
    }
    worldsBuilt += 1;
    for (const workout of (program?.microcycles?.[0]?.workouts ?? [])) {
      sessionsSeen += 1;
      const rows = workout.exercises ?? [];
      heavyLiftsSeen += mainLiftsSeen(rows).length;
      for (const conflict of mainLiftPatternConflicts(rows)) {
        breaches.push(`${label} | ${workout.name} | ${conflict.slot} <- ${conflict.exercises.join(' + ')}`);
      }
    }
  }

  // NON-VACUITY IN TWO PARTS, AND THE FIRST ONE HAS ALREADY EARNED ITS KEEP.
  // On 2026-08-13 this block reported "0 breaches of 0 sessions" and read as a
  // clean bill of health — every world was refusing to build, because a
  // concurrent seat's half-saved edit had `coachingEngine` throwing
  // `capacity is not defined`. A count of BREACHES cannot tell a lawful corpus
  // from an absent one; a count of WORLDS can.
  ok('[non-vacuity] the generated census actually built worlds',
    worldsBuilt >= 4, `${worldsBuilt} of ${WORLDS.length} worlds built`);
  ok('[non-vacuity] the generated census actually reached heavy lifts',
    heavyLiftsSeen >= 15, `heavy lifts across ${sessionsSeen} sessions: ${heavyLiftsSeen}`);
  ok('no session the app generates carries two heavy lifts of one pattern',
    breaches.length === 0,
    `${breaches.length} of ${sessionsSeen} sessions breach R-070\n     ${breaches.join('\n     ')}`);
  console.log(`\n  R-070 GENERATION CENSUS: ${breaches.length} breaches of ${sessionsSeen} generated `
    + `sessions (${heavyLiftsSeen} heavy lifts seen)`);
  for (const line of breaches) console.log(`    ${line}`);
}

console.log(
  `\nMain lift pattern law: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
