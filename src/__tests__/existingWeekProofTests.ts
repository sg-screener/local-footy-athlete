/**
 * R-033 — A CHANGE IS UNVERIFIED UNTIL IT IS SEEN ON A WEEK THAT ALREADY EXISTED.
 *
 * **SAM, verbatim:** *"there has to be a better way than me hand-testing"* /
 * *"my phone is the last instrument"*. **He is never the test rig.** Registry row
 * R-033 read `UNENFORCED as a gate`, pointing at inbox item 30.
 *
 * ## THE DEFECT THIS EXISTS FOR, IN THE QUEUE'S OWN WORDS
 *
 * *"AND IT EXPLAINS WHY BOTH SUITES ARE GREEN: `test:away-flow` [13]-[13e] and
 * `test:christmas-break` [7b]/[9]/[11c] both GENERATE their weeks with the
 * constraint live. **A cell that builds its own world cannot see a week that was
 * built before the athlete answered.**"*
 *
 * That is the whole bug class. `awayFlowTests.ts:478` is the worked example:
 *
 *     const awayWeek = generateProgramLocally(genProfile, {
 *       todayISO: GEN_WEEK, ..., activeConstraints: genTravel });
 *
 * The travel fact is present **before the week is built**. Every assertion under
 * it is true, and none of them is the athlete's situation: the athlete already
 * HAD a week, and then answered. Two days of away-flow work read as done and was
 * invisible on Sam's phone, and the Christmas break reproduced it on glass —
 * `21-27 December, wholly inside the break`, with Tuesday and Thursday still
 * reading *"Strength + Team Training"*.
 *
 * ## THE GATE IS A TWO-ROUTE AGREEMENT, AND THAT IS THE WHOLE IDEA
 *
 * | route | what it is | who proves it today |
 * | --- | --- | --- |
 * | **A — BUILT WITH** | generate the week with the fact already live | every existing suite |
 * | **B — BUILT BEFORE** | generate the week with NO fact, then land the fact on that already-accepted week | **nothing, until now** |
 *
 * Route B is the athlete. It goes through `rebaseAcceptedEffectiveWeek`, which
 * this repo calls *"sole precedence owner for a currently accepted
 * athlete-visible week"* — the read door a real phone goes through — and hands it
 * the same facts.
 *
 * **THE ASSERTION IS THAT A AND B AGREE.** A change that only reaches newly built
 * weeks makes B disagree with A, and this suite reds. That is exactly the
 * mutation Sam asked for, and it is run below rather than described.
 *
 * ## WHAT IT IS NOT
 *
 * It is not an away gate or a Christmas gate — those are its FIXTURES. It is the
 * instrument the ruling was missing, and any future fact door is one row in
 * `DOORS`. A door that cannot be expressed as "the same week, before and after
 * the answer" is a door whose effect nobody can verify without Sam's thumb.
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../services/api/generateProgram');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { rebaseAcceptedEffectiveWeek } = require('../rules/acceptedEffectiveWeek');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getTeamTrainingWorkoutState } = require('../utils/teamTraining');

const WEEK = '2026-07-13';

const PROFILE = {
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
  equipmentSelectionCompleteness: 'complete',
  gender: 'male', // R-130 required; fixture predates the rule
  seasonPhase: 'In-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDays: ['Tuesday', 'Thursday'],
  gameDay: 'Saturday',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
} as any;

/**
 * THE TRAVEL FACT, IN THE CANONICAL `TemporarySourceFact` SHAPE.
 *
 * ⚠ THE FIRST VERSION OF THIS FIXTURE WAS COPIED FROM `awayFlowTests` AND WAS
 * THE WRONG VOCABULARY, AND IT MANUFACTURED A DEFECT. That suite builds the
 * LEGACY `ActiveConstraint` shape — `type: 'schedule'`, `startDate`,
 * `expiresAt` — because it feeds `generateProgramLocally`'s `activeConstraints`.
 * The READ door filters on `factKind: 'schedule'` with `effectiveFrom` /
 * `effectiveUntil` (`derivedWeekContract.ts:85`, `sessionResolver.ts:2333`), so
 * the legacy object matched NOTHING and route B looked inert.
 *
 * **That would have been reported as "two days of away work reaches only new
 * weeks" — the very claim this suite exists to test — when the truth was that my
 * fixture could not be seen by the code under test.** A fixture is a claim too,
 * and a surviving mutation means the gate is blind OR the mutation missed.
 *
 * **THIS FACT FEEDS ROUTE B ONLY.** Deriving route A from it was ATTEMPT TWO and
 * is refuted below — see `TRAVEL_CONSTRAINT`. The two doors genuinely speak two
 * spellings, and the CONTROL cell is what stops that mismatch being read as a
 * breach of the ruling.
 */
const TRAVEL_FACT = [{
  id: 'source-fact:schedule:existing-week-proof',
  factKind: 'schedule',
  scheduleKind: 'travel',
  status: 'active',
  effectiveFrom: WEEK,
  effectiveUntil: '2026-07-19',
  createdAt: `${WEEK}T09:00:00.000Z`,
  lastUpdatedAt: `${WEEK}T09:00:00.000Z`,
  source: 'tap',
}] as any;

/**
 * ROUTE A'S INPUT — THE LEGACY `ActiveConstraint` SPELLING, and it is hand-written
 * DELIBERATELY after a projection was tried and refuted.
 *
 * **ATTEMPT ONE projected this from the fact above via
 * `composeTemporarySourceFactCompatibility`**, on the reasoning that one fact
 * feeding both doors removes vocabulary mismatch as a confound. **The CONTROL
 * cell then failed: the projected constraint does not clear the club nights on
 * the generation path**, while the object `awayFlowTests` hand-builds does. So
 * the projection is NOT a faithful stand-in for what generation is proven to
 * accept, and using it would have measured my own projection rather than the app.
 *
 * **THE APP GENUINELY HAS TWO SPELLINGS AT THE TWO DOORS**, and this suite states
 * that rather than papering over it: generation reads `ActiveConstraint`
 * (`type`/`startDate`/`expiresAt`), the read door reads `TemporarySourceFact`
 * (`factKind`/`effectiveFrom`/`effectiveUntil`). **That divergence is itself a
 * finding and is recorded in `docs/STATUS_PATTERNS.md`** — one athlete answer,
 * two shapes, and only one of them understood at each end.
 *
 * Both objects below describe the SAME trip: away from 13 to 19 July.
 */
const TRAVEL_CONSTRAINT = [{
  id: 'source-fact:schedule:existing-week-proof',
  type: 'schedule', scheduleKind: 'travel', status: 'active', severity: 7,
  startDate: WEEK, expiresAt: '2026-07-19',
  lastUpdatedAt: `${WEEK}T09:00:00.000Z`, source: 'tap',
  unavailableDates: [], unavailableWeekdays: [], modifierAffects: ['current_week'],
  rules: [], safeFocus: [], advice: [],
}] as any;

const teamDayNames = (workouts: readonly any[]): string[] => workouts
  .filter((workout) => getTeamTrainingWorkoutState(workout).hasTeamTraining)
  .map((workout) => String(workout?.name ?? '?'));

const gameDayNames = (workouts: readonly any[]): string[] => workouts
  .filter((workout) => workout?.workoutType === 'Game')
  .map((workout) => String(workout?.name ?? '?'));

/**
 * ROUTE B — THE ATHLETE'S ROUTE. A week is built with NO fact, accepted, and
 * only THEN does the answer land.
 *
 * `carryFacts` exists so the mutation below can withhold the facts from the read
 * door and simulate a producer that only applies its change at generation. That
 * is the defect this whole suite is about, and a switch is the honest way to
 * prove the gate can see it — see block [3].
 */
function weekBuiltBeforeTheAnswer(args: {
  facts: readonly any[];
  carryFacts?: boolean;
}): { visibleWorkouts: any[]; baseTeamDays: string[] } {
  const program = generateProgramLocally(PROFILE, {
    todayISO: WEEK, blockNumber: 1, microcycleLimit: 1,
  });
  const baseMicrocycle = program?.microcycles?.[0] ?? null;
  const surfaces = {
    microcycles: program?.microcycles ?? [],
    currentMicrocycle: baseMicrocycle,
    weekScopedOverlays: {},
    dateOverrides: {},
    removalDecisions: [],
    // THE ONE LINE THE WHOLE RULING TURNS ON.
    temporarySourceFacts: args.carryFacts === false ? [] : args.facts,
  };
  const snapshot = rebaseAcceptedEffectiveWeek({
    surfaces: surfaces as never,
    weekStart: WEEK,
    profile: PROFILE,
    markedDays: {},
  });
  return {
    visibleWorkouts: snapshot?.visibleWorkouts ?? [],
    baseTeamDays: teamDayNames(baseMicrocycle?.workouts ?? []),
  };
}

/** ROUTE A — the week every existing suite proves: built with the fact live. */
function weekBuiltWithTheAnswer(facts: readonly any[]): any[] {
  const program = generateProgramLocally(PROFILE, {
    todayISO: WEEK, blockNumber: 1, microcycleLimit: 1,
    activeConstraints: facts as never,
  });
  return program?.microcycles?.[0]?.workouts ?? [];
}

// ── [1] NON-VACUITY — the week must HAVE what the fact is supposed to remove ──
//
// "No team day" and "no game" are both trivially true of a week that never had
// one, and item 30 records that exact trap being sprung on this very item once
// already. Nothing below means anything without this block.
console.log('\n[1] The week the athlete already had — non-vacuity first');
{
  const before = weekBuiltBeforeTheAnswer({ facts: [], carryFacts: false });
  ok('the pre-existing week HAS team days, so the cells below can fail',
    before.baseTeamDays.length === 2, JSON.stringify(before.baseTeamDays));
  ok('and the read door returns a real week, not an empty one',
    before.visibleWorkouts.length >= 5, `visible workouts: ${before.visibleWorkouts.length}`);
  ok('the read door agrees the untouched week still has its club nights',
    teamDayNames(before.visibleWorkouts).length === 2,
    JSON.stringify(teamDayNames(before.visibleWorkouts)));
}

// ── [2] THE RULING — the two routes must agree ────────────────────────────
console.log('\n[2] R-033 — a week that already existed sees the change');
{
  const routeA = weekBuiltWithTheAnswer(TRAVEL_CONSTRAINT);
  const routeB = weekBuiltBeforeTheAnswer({ facts: TRAVEL_FACT });

  // ROUTE A IS ASSERTED FIRST AND DELIBERATELY. If the fact does not bite even
  // on a freshly built week, route B disagreeing says nothing about R-033 — it
  // says the feature is absent, which is a different finding. Telling those two
  // apart is the whole reason this cell exists before the next one.
  ok('[control] route A — a week BUILT WITH the answer loses its club nights',
    teamDayNames(routeA).length === 0, JSON.stringify(teamDayNames(routeA)));
  ok('[control] route A loses the fixture too',
    gameDayNames(routeA).length === 0, JSON.stringify(gameDayNames(routeA)));

  const teamB = teamDayNames(routeB.visibleWorkouts);
  const gameB = gameDayNames(routeB.visibleWorkouts);
  ok('route B — the week the athlete ALREADY HAD loses its club nights too',
    teamB.length === 0,
    `the pre-existing week still shows ${JSON.stringify(teamB)}. `
    + 'R-033: a change that alters an EXISTING week is unverified until seen on a '
    + 'week that already existed. This change reaches only NEWLY BUILT weeks — '
    + 'which is what Sam saw on his phone while both suites were green.');
  ok('route B loses the fixture too — he is not going to be there',
    gameB.length === 0, JSON.stringify(gameB));

  ok('the two routes AGREE — which is the ruling, stated as one cell',
    teamDayNames(routeA).length === teamB.length
    && gameDayNames(routeA).length === gameB.length,
    `built-with: team=${JSON.stringify(teamDayNames(routeA))} game=${JSON.stringify(gameDayNames(routeA))}\n     `
    + `built-before: team=${JSON.stringify(teamB)} game=${JSON.stringify(gameB)}`);
}

// ── [3] THE GATE'S OWN LIVENESS — Sam asked for this in the order ──────────
//
// **His words: *"prove it with a mutation: a change that only reaches newly built
// weeks must red."*** So the suite runs that mutation on ITSELF rather than
// describing one: `carryFacts: false` withholds the answer from the read door,
// which is precisely a producer that applies its change at GENERATION only.
//
// **A gate that cannot be shown failing is a claim about the code and an
// unproven claim about itself** (L12a). This block is the proof, and it runs on
// every chain run rather than once in a boundary report — an author who breaks
// route B's plumbing gets a red that names this cell.
console.log('\n[3] The gate reds when a change reaches only newly built weeks');
{
  const crippled = weekBuiltBeforeTheAnswer({ facts: TRAVEL_FACT, carryFacts: false });
  const teamCrippled = teamDayNames(crippled.visibleWorkouts);
  ok('[liveness] withholding the answer from the read door DOES leave the club nights',
    teamCrippled.length === 2,
    `expected the crippled route to still show 2 club nights, got ${JSON.stringify(teamCrippled)}. `
    + 'If this is 0, route B is not reading the facts at all and block [2] is '
    + 'passing for a reason that has nothing to do with the ruling.');

  // AND THE TWO MUST DIFFER — ON THE WHOLE WEEK, NOT ON ONE FIELD.
  //
  // ⚠ THIS CELL FIRST COMPARED TEAM DAYS ONLY AND FAILED FOR THE WRONG REASON.
  // The answer DOES reach the pre-existing week — it removes the FIXTURE — and
  // comparing the one field the defect lives in made a working half of the read
  // door look inert. The signature covers both, so "the read door ignores the
  // athlete's answer entirely" and "it half-applies it" are told apart.
  const healthy = weekBuiltBeforeTheAnswer({ facts: TRAVEL_FACT });
  const signature = (workouts: readonly any[]): string =>
    `${teamDayNames(workouts).length}/${gameDayNames(workouts).length}`;
  ok('[liveness] and the healthy route differs from the crippled one',
    signature(healthy.visibleWorkouts) !== signature(crippled.visibleWorkouts),
    `healthy=${signature(healthy.visibleWorkouts)} crippled=${signature(crippled.visibleWorkouts)} `
    + '— the read door produces the same week with and without the athlete\'s '
    + 'answer, so this suite is measuring nothing');
}

// ── [4] WHERE THE DEFECT IS NOT — AND THIS BLOCK EXISTS TO STOP A REBUILD ──
//
// **SAM, 2026-08-13: *"the agents need to read through what we've already fixed
// and find if it's spelt differently or worded differently but stands for the
// same thing."*** This block is that instruction made executable for one fact,
// because this exact thing has now been diagnosed THREE times.
//
// **THE HISTORY, CHECKED BEFORE ANYTHING WAS WRITTEN:**
//   - `ff885cdb` *"THE CLUB IS OFF HIS WEEK, INCLUDING THE WEEK HE IS ALREADY
//     LOOKING AT"* built `applyAwayPass` — game half AND club half.
//   - `b62add9f` deleted it from `main` under a subject that said *"comment
//     only; no assertion changed"* while removing 3,421 lines.
//   - `186c2b1b` restored it.
//   - `8a2f5ef2` *"THE READ FILTER NEVER RUNS ON THE PROGRAM TAB"* then measured,
//     with a probe on a real device, that `applyAwayPass` **never fires once** on
//     the athlete's path: *"I HAVE BEEN FIXING THE READ IN THE WRONG READER."*
//
// **THE RESTORE WAS NOT PARTIAL, AND THAT WAS WORTH CHECKING RATHER THAN
// ASSUMING.** Diffed `ff885cdb`'s `sessionResolver.ts` against today: the
// current `applyAwayPass` is a SUPERSET — 42 lines then, 101 now, three call
// sites where there was one, plus the rest-day fix and the combined-day name
// strip Sam asked for afterwards. All four of `ff885cdb`'s files still carry
// every line it added. **Nothing was dropped, so there is nothing to put back.**
//
// **THE CELL BELOW IS THE PART THAT KEEPS BEING RE-LEARNED**, and it is cheap:
// the accepted-week read door does not import the resolver at all, so the pass
// that handles club nights cannot run on it. The game still disappears because
// `derivedWeekContract` has its OWN travel filter on that path — which is why
// the symptom looks like "half a restore" and is not.
console.log('\n[4] The club-night logic EXISTS — the read door just never calls it');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  const src = path.join(__dirname, '..');
  const resolver = fs.readFileSync(path.join(src, 'utils/sessionResolver.ts'), 'utf8');
  const readDoor = fs.readFileSync(path.join(src, 'rules/acceptedEffectiveWeek.ts'), 'utf8');

  // ANCHOR-FOUND FIRST. An `indexOf` that missed returns -1 and compares fine,
  // and every claim below would then be about a function that is not there.
  const passAt = resolver.indexOf('function applyAwayPass');
  ok('[history] `applyAwayPass` still exists — do NOT rebuild it',
    passAt > 0, 'if this reds, the pass was deleted AGAIN — see b62add9f before rewriting it');

  const body = resolver.slice(passAt, passAt + 4000);
  ok('[history] and it still handles the CLUB half, not only the fixture',
    /isTeamTrainingOnly/.test(body) && /hasTeamTraining/.test(body),
    'the club half of applyAwayPass is missing — THAT would be the partial restore');

  // THE ACTUAL GAP, STATED AS A CELL SO IT IS NEVER RE-DIAGNOSED BY HAND.
  ok('[the gap] the accepted-week read door does NOT reach the resolver',
    !/sessionResolver/.test(readDoor),
    'acceptedEffectiveWeek now imports the resolver — if that is deliberate, the '
    + 'club nights should be coming off a pre-existing week and block [2] should '
    + 'be GREEN. Re-run before assuming this cell is stale.');
}

const total = passed + failures.length;
console.log(`\nExisting-week proof: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
