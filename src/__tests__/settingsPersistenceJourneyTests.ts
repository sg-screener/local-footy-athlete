/**
 * THE SETTINGS AND PERSISTENCE JOURNEYS — every athlete setting, on top of real
 * accepted state, across a real close and reopen.
 *
 * Sam's mission, 2026-08-20. Five settings — season phase, game information,
 * club training, permanent gym equipment, and a coach/program edit — each of
 * which must:
 *
 *   write through ONE canonical transaction owner
 *   rebuild through the CURRENT runtime owners
 *   preserve unrelated accepted state
 *   survive close/reopen
 *   never silently reset onboarding answers
 *   never overwrite accepted exercise history during boot
 *   never confuse permanent gym equipment with session-only equipment
 *   never invent club/game attendance
 *   display an HONEST refusal when the new setup cannot form a valid week
 *
 * Run: npm run test:settings-persistence
 *
 * ## THE MATRIX — setting × accepted-state shape × restart route
 *
 * **SHAPE** is the dimension a settings suite most easily skips, and skipping it
 * is why an isolated toggle passes on an app that is destroying the athlete's
 * block. Process Law L13 requires the two tiers be DECLARED separately:
 *
 * - **FRESH** — cold start through real onboarding, block 1 installed, nothing
 *   lived. This is also the mission's NON-SEEDED cold-start journey (L3).
 * - **WORN** — the same athlete four weeks on: nineteen days recorded through
 *   the live outcome writer, their own loads typed over the card's, one real
 *   miss, a standing `until_changed` exclusion, and a REAL rollover into
 *   block 2 that raised their loads.
 *
 * **RESTART ROUTE** is two routes and they are compared against each other, not
 * just against the past. Every settings door ends by calling
 * `settleDerivedWorldAfterDecision`, which IS `rebuildDerivedWorld` under the
 * replay latch; a relaunch runs `runQuiescentBoot` after a real process death.
 * *"The week after a tap is the week after a relaunch BY CONSTRUCTION"* is the
 * claim `fixtureSettleAfterSetupTests` states, and every cell below re-asserts
 * it on ITS setting by printing both weeks and comparing them row for row,
 * dose for dose and LOAD for load.
 *
 * ## WHAT IS REAL HERE
 *
 * All of it. Every state change goes through the function the athlete's tap
 * reaches; the doors and their production callers are listed in
 * `support/settingsJourney.ts` and `support/athleteJourney.ts`. Nothing in this
 * file writes a store directly, hand-builds a `ScheduleState`, or seeds a
 * durable envelope. The clock is `DevE2EClock` and every simulated day asserts
 * `todayISOLocal()` agrees.
 *
 * ## WHAT IS NOT REAL, STATED SO IT IS NOT MISTAKEN FOR PROOF
 *
 * No pixels. The sheet's SELECTION is supplied here and handed to
 * `decideProfileSetupChange`, the real decider; the taps that build that
 * selection belong to the Maestro flows. Everything downstream of the selection
 * is the app.
 */

// ── Headless bootstrap. MUST precede every app import. ────────────────────
//
// `__DEV__` IS TRUE: this suite simulates TIME PASSING, and
// `isDevE2EClockAvailable()` refuses outside dev, so `setDevE2EClock` would
// return null *silently* and every door would read the wall clock.
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — this athlete changes their settings entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import type { DayOfWeek, OnboardingData } from '../types/domain';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { readBlockHistory } from '../rules/blockBoundaryProgression';
import { addDaysISO } from '../utils/programBlockState';
import {
  coldStartThroughOnboarding,
  followTheWeek,
  relaunchApp,
  setJourneyClock,
  substituteExercise,
  swapOptionsFor,
} from './support/athleteJourney';
import {
  buildWornWorld,
  censusDelta,
  changePermanentEquipment,
  changeProgramSetup,
  declareSessionEquipmentMissing,
  equipmentAnswerWith,
  programWeekStarts,
  storedRowCount,
  takeSettingsCensus,
  visibleRowCount,
  weekPrint,
  type SettingsCensus,
  type SettingsDoorResult,
  type WornWorld,
} from './support/settingsJourney';

let pass = 0; let fail = 0; const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) { pass += 1; console.log(`  PASS ${name}`); }
  else {
    fail += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/** The weekday name a date falls on — `weekPrint` keys its lines by it. */
function weekdayOf(dateISO: string): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(`${dateISO}T12:00:00Z`).getUTCDay()];
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ATHLETE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ONE ATHLETE, AND THEY ANSWER EVERY QUESTION THIS MISSION CHANGES: phase, gym
 * availability, permanent equipment, club training and game information.
 *
 * In-season with a Saturday game and two club nights, because that is the only
 * phase where fixture protection and club-night interaction are live at all —
 * an Off-season athlete has neither (R-002/R-079), so a settings matrix built on
 * one would be unable to reach three of its own five settings.
 * `twoKmTimeTrial` is not decoration: §18 refuses any world it cannot
 * capacity-score, so a profile without it is one the app would reject from a
 * real person.
 */
const INSTALL_DAY = '2026-07-13';

function theAthlete(): OnboardingData {
  return {
    firstName: 'Jordan',
    ageRange: '22-26',
    position: 'inside_mid',
    heightCm: 182,
    weightKg: 84,
    motivation: 'Dominate your level',
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Hard',
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine',
      'hamstring_curl', 'knee_extension', 'bands'],
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have', bands: 'have',
        bench: 'have', pullup_bar: 'have', kettlebell: 'have', foam_roller: 'have',
        plyo_box: 'have',
      },
      modalities: {
        bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have',
      },
      answeredOn: INSTALL_DAY,
    },
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
  } as unknown as OnboardingData;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE TWO SHAPES, EACH BUILT FRESH FOR EVERY CELL
// ═══════════════════════════════════════════════════════════════════════════

interface Stage {
  shape: 'FRESH' | 'WORN';
  /** The Monday of the week the athlete is currently looking at. */
  weekStartISO: string;
  todayISO: string;
  world: WornWorld | null;
}

/**
 * ⚠ **EVERY CELL GETS ITS OWN WORLD, AND THE COST IS DELIBERATE.**
 *
 * Reusing one world across cells makes each cell's "before" the previous cell's
 * "after", so a change that corrupts state is invisible to the cell that caused
 * it and lands on an innocent one downstream. The sequential case is a
 * SEPARATE, EXPLICIT journey in stage 2, where compounding is the subject rather
 * than an accident of ordering.
 *
 * ⚠ **AND THE PREVIOUS WORLD'S DISK IS EMPTIED.** `coldStartThroughOnboarding`
 * resets the STORES, not storage. A second athlete built without this clear
 * rehydrates the first one's persisted envelope at the next relaunch — a
 * harness fault the journey seat already paid for once.
 */
async function stageFor(shape: 'FRESH' | 'WORN'): Promise<Stage> {
  localStorageData.clear();
  if (shape === 'FRESH') {
    const install = await coldStartThroughOnboarding({
      profile: theAthlete(), installDayISO: INSTALL_DAY,
    });
    setJourneyClock(install.blockOneStart);
    followTheWeek(install.blockOneStart);
    return {
      shape,
      weekStartISO: install.blockOneStart,
      todayISO: install.blockOneStart,
      world: null,
    };
  }
  const world = await buildWornWorld({ profile: theAthlete(), installDayISO: INSTALL_DAY });
  const weekStartISO = world.blockTwoStart ?? world.blockOneStart;
  setJourneyClock(world.todayISO);
  followTheWeek(world.todayISO);
  return { shape, weekStartISO, todayISO: world.todayISO, world };
}

// ═══════════════════════════════════════════════════════════════════════════
// WHAT A SETTINGS CHANGE MAY AND MAY NOT MOVE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The census fields that belong to the ATHLETE, not to the setting.
 *
 * Any of these moving is the mission's *"preserve unrelated accepted state"*
 * breaking, whichever setting was changed. They are listed positively rather
 * than checked by a fingerprint so a red names the fact that was lost.
 */
const ATHLETE_STATE_FIELDS: readonly (keyof SettingsCensus)[] = [
  'acceptedBlockKeys',
  'acceptedBlockNumbers',
  'currentBlockNumber',
  'currentBlockStart',
  'liveBlockNumber',
  'feedbackDays',
  'feedbackWithStrengthLogs',
  'weightOverrideDays',
  'weightOverrideEntries',
  'exclusions',
  'onboardingComplete',
  'identityAnswers',
];

function movedAthleteState(before: SettingsCensus, after: SettingsCensus): string[] {
  return ATHLETE_STATE_FIELDS
    .filter((field) => !same(before[field], after[field]))
    .map(String);
}

/** Every loaded row the athlete can see, by exercise identity — `name@kg`. */
function loadsIn(weekStartISO: string, todayISO: string): string[] {
  return weekPrint(weekStartISO, todayISO)
    .join('\n')
    .split(/[\n,]/)
    .map((cell) => cell.match(/([A-Za-z][^|\]]*)\|\d+\|[^|]+\|([0-9.]+)/))
    .filter((match): match is RegExpMatchArray => Boolean(match) && Number(match![2]) > 0)
    .map((match) => `${match[1].replace(/^.*\[/, '')}@${match[2]}`)
    .sort();
}


/**
 * A RELAUNCH THAT PROVES IT HAPPENED.
 *
 * ⚠ **WRITTEN BECAUSE MUTATION M8 SURVIVED.** Replacing `relaunchApp` with
 * `{ ok: true, error: null }` left **all 112 cells green**: every *"identical
 * after close/reopen"* claim in this file was comparing a week against ITSELF.
 * That is L12a's green-and-empty bind, and `relaunch.ok` cannot catch it —
 * a relaunch that never ran also never fails.
 *
 * The witness is object IDENTITY, not equality. The program is never persisted;
 * `quiescentBoot` nulls `currentProgram` and REGENERATES it, so a real reopen
 * always yields a different object and an inert one yields the same reference.
 * Equality is precisely what the surrounding cells assert, so only identity can
 * tell the two apart.
 */
async function reopenTheApp(label: string, todayISO: string): Promise<void> {
  const before = useProgramStore.getState().currentProgram;
  const relaunch = await relaunchApp({ storage: localStorageData, todayISO });
  setJourneyClock(todayISO);
  followTheWeek(todayISO);
  const after = useProgramStore.getState().currentProgram;
  ok(`${label}: the app REOPENS`, relaunch.ok, relaunch.error ?? 'boot threw');
  ok(`${label}: the restart really destroyed and rebuilt the program`,
    before != null && after != null && after !== before,
    'the store holds the SAME program object after the relaunch — boot did not '
    + 'regenerate, so every "identical after reopen" claim is comparing a week '
    + 'against itself');
}

// ═══════════════════════════════════════════════════════════════════════════
// ONE MATRIX CELL
// ═══════════════════════════════════════════════════════════════════════════

interface CellReport {
  setting: string;
  shape: string;
  committed: boolean;
  movedCensusFields: string[];
  athleteStateLost: string[];
  identicalOverRestart: boolean;
  blockNumberBefore: number | null;
  blockNumberAfter: number | null;
  blockNumberAfterRestart: number | null;
}

const matrix: CellReport[] = [];

/**
 * Run ONE (setting × shape × restart route) cell and assert the four claims the
 * mission makes of every setting.
 *
 * The claims are asserted in this order on purpose: a door that did not commit
 * makes every later claim vacuous, and a cell that reported "state preserved"
 * about a change that never happened is the green-and-empty shape L12a forbids.
 */
async function runCell(args: {
  setting: string;
  stage: Stage;
  /** Fields this setting is ENTITLED to move. Anything else is a red. */
  mayMove: readonly (keyof SettingsCensus)[];
  apply: (stage: Stage) => Promise<SettingsDoorResult | { ok: boolean; message: string }>;
  /** Some settings legitimately change nothing visible; say so rather than assert. */
  expectVisibleChange?: boolean;
}): Promise<void> {
  const { setting, stage } = args;
  const label = `${setting} · ${stage.shape}`;
  const before = takeSettingsCensus();
  const weekBefore = weekPrint(stage.weekStartISO, stage.todayISO);
  const loadsBefore = loadsIn(stage.weekStartISO, stage.todayISO);
  const weeksBefore = programWeekStarts();

  const result = await args.apply(stage);
  const after = takeSettingsCensus();
  const weekAfter = weekPrint(stage.weekStartISO, stage.todayISO);
  const moved = censusDelta(before, after);
  const lost = movedAthleteState(before, after);

  console.log(`\n  ── ${label} ──`);
  console.log(`     door: ${JSON.stringify(result)}`);
  console.log(`     census fields moved: ${moved.join(', ') || '(none)'}`);
  console.log(`     block number: ${before.currentBlockNumber} -> ${after.currentBlockNumber}`
    + ` (live ${before.liveBlockNumber} -> ${after.liveBlockNumber})`);
  console.log(`     loads: ${loadsBefore.join(' ') || '(none)'}`);
  console.log(`         -> ${loadsIn(stage.weekStartISO, stage.todayISO).join(' ') || '(none)'}`);

  ok(`${label}: the canonical door COMMITTED`, result.ok === true,
    `the door refused: ${JSON.stringify(result)}`);

  // ── CLAIM 1: only what this setting owns moved ──────────────────────────
  const notEntitled = moved.filter((field) =>
    !(args.mayMove as readonly string[]).includes(field));
  ok(`${label}: only what this setting OWNS moved in the accepted state`,
    notEntitled.length === 0,
    `moved without entitlement: ${notEntitled.join(', ')} `
    + `(entitled: ${args.mayMove.join(', ')})`);

  // ── CLAIM 2: the athlete's own accepted state is intact ─────────────────
  //
  // The strongest single claim in this mission, and the one that was BROKEN:
  // an established block-2 athlete was reset to block 1 by changing a setting,
  // and every load the block boundary had raised went back down with them.
  ok(`${label}: the athlete's accepted state is INTACT — block, history, exclusions, answers`,
    lost.length === 0,
    `these athlete facts moved: ${lost.join(', ')}\n`
    + `      before: ${JSON.stringify(ATHLETE_STATE_FIELDS.map((f) => [f, before[f]]))}\n`
    + `      after:  ${JSON.stringify(ATHLETE_STATE_FIELDS.map((f) => [f, after[f]]))}`);

  // ── CLAIM 3: close and reopen changes nothing ───────────────────────────
  //
  // TWO ROUTES COMPARED AGAINST EACH OTHER. The week above is the one the door's
  // own in-process settle produced; the week below is the one a real process
  // death plus `runQuiescentBoot` produces. Comparing them is what makes
  // "the week after a tap is the week after a relaunch" a measured property
  // rather than two engines happening to agree.
  await reopenTheApp(label, stage.todayISO);
  const restarted = takeSettingsCensus();
  const weekRestart = weekPrint(stage.weekStartISO, stage.todayISO);
  const identical = same(weekAfter, weekRestart);

  ok(`${label}: the VISIBLE week is identical after close/reopen — rows, doses AND loads`,
    identical,
    `settled:\n      ${weekAfter.join('\n      ')}\n    reopened:\n      `
    + `${weekRestart.join('\n      ')}`);
  ok(`${label}: every accepted fact is identical after close/reopen`,
    censusDelta(after, restarted).length === 0,
    `moved across the restart: ${censusDelta(after, restarted).join(', ')}`);

  // ── CLAIM 4: the change reached only the weeks it should ────────────────
  ok(`${label}: the change did not add or remove WEEKS`,
    same(weeksBefore, programWeekStarts()),
    `${weeksBefore.join(' ')} -> ${programWeekStarts().join(' ')}`);

  /**
   * ⚠ **THE EXCLUDED LIFT STAYS OFF THE SCREEN — ASSERTED ON EVERY DOOR, NOT
   * JUST THE ONE THAT HAPPENED TO BE TESTED.**
   *
   * Stage 2b held this for a PHASE change only. The cross-lane measurement then
   * showed that every settings change puts the excluded lift back into the
   * STORED program — 0 rows -> 4 (6 after a phase change) — and that only the
   * read-time projection keeps it off the athlete's week. That is pre-existing
   * on `main` and it is NOT athlete-visible, so it is recorded as a finding
   * rather than fixed here (see the seat file). But the visible property is the
   * one Sam's exclusion ruling is about, and it was pinned on one door out of
   * eleven, so it is pinned on all of them now.
   */
  if (stage.world?.excludedLift) {
    const excluded = stage.world.excludedLift;
    const visibleRows = visibleRowCount({
      weekStartISO: stage.weekStartISO, todayISO: stage.todayISO, exerciseName: excluded,
    });
    const storedRows = storedRowCount(excluded);
    ok(`${label}: the lift the athlete left out is STILL not on their week`,
      visibleRows === 0,
      `${excluded} is back on the athlete's week (${visibleRows} row(s)) after this `
      + 'settings change, and they never asked for it back');
    /**
     * **Sam, 2026-08-20:** *"A settings change must not re-add an excluded lift
     * to the stored accepted program and rely on projection to hide it. Stored
     * truth and visible truth must agree."*
     *
     * The cell above reads the PROJECTION and was green while storage held the
     * row — 0 visible, 4 stored — which is exactly the shape a screen-only guard
     * cannot see. Both readers, or neither claim means anything.
     */
    ok(`${label}: STORED and VISIBLE agree about the excluded lift`,
      storedRows === visibleRows,
      `${excluded}: ${storedRows} row(s) in the stored accepted program and `
      + `${visibleRows} on the athlete's week. A row kept in storage and hidden on `
      + 'read is two truths, and every reader that goes to the program rather than '
      + 'the projection gets the wrong one.');
  }

  if (args.expectVisibleChange !== undefined) {
    ok(`${label}: the athlete ${args.expectVisibleChange ? 'SEES' : 'sees NO'} change in their week`,
      same(weekBefore, weekAfter) !== args.expectVisibleChange,
      args.expectVisibleChange
        ? 'the week is byte-identical — the setting did not reach the athlete'
        : 'the week changed and this setting should not have touched it');
  }

  matrix.push({
    setting, shape: stage.shape, committed: result.ok === true,
    movedCensusFields: moved, athleteStateLost: lost,
    identicalOverRestart: identical,
    blockNumberBefore: before.currentBlockNumber,
    blockNumberAfter: after.currentBlockNumber,
    blockNumberAfterRestart: restarted.currentBlockNumber,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SUITE
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('\n═══ STAGE 0 — the NON-SEEDED cold start (Process Law L3) ═══\n');

  const cold = await stageFor('FRESH');
  const coldCensus = takeSettingsCensus();
  console.log(`  onboarding accepted: ${coldCensus.onboardingComplete}`);
  console.log(`  block 1 starts ${cold.weekStartISO}, weeks ${programWeekStarts().join(' ')}`);
  console.log(`  phase ${coldCensus.seasonPhase} (owned ${coldCensus.ownedPhase}) · `
    + `game ${coldCensus.gameDay} · club ${coldCensus.teamTrainingDays.join('/')}`);
  console.log(`  kit: ${coldCensus.equipmentTags.length} tags, `
    + `${coldCensus.equipmentModalities.length} machines`);

  ok('a real athlete reaches an installed Block 1 through real onboarding — no seed',
    coldCensus.onboardingComplete && programWeekStarts().length > 0,
    'the non-seeded cold start did not produce an accepted program');
  ok('the cold start records what block 1 SELECTED — rotation has something to work from',
    coldCensus.recordedSelections.length > 0,
    'zero recorded selections after the real install door');
  ok('a genuinely new athlete is in block 1, by having no history rather than by a fallback',
    coldCensus.currentBlockNumber === 1,
    `currentBlockNumber=${coldCensus.currentBlockNumber}`);

  const worn = await stageFor('WORN');
  const wornCensus = takeSettingsCensus();
  console.log(`\n  WORN world: block 1 ${worn.world?.blockOneStart} -> block 2 `
    + `${worn.world?.blockTwoStart}, today ${worn.todayISO}`);
  console.log(`  ${wornCensus.feedbackDays} days recorded, `
    + `${wornCensus.weightOverrideEntries} loads typed, `
    + `${wornCensus.exclusions.length} standing exclusion(s): `
    + `${wornCensus.exclusions.join(', ')}`);
  console.log(`  accepted blocks: ${JSON.stringify(wornCensus.acceptedBlockKeys)} `
    + `numbers ${JSON.stringify(wornCensus.acceptedBlockNumbers)} `
    + `requirements ${JSON.stringify(wornCensus.acceptedBlockRequirements)}`);
  console.log(`  loads the boundary raised: ${loadsIn(worn.weekStartISO, worn.todayISO).join(' ')}`);

  // ⚠ THE ANTI-VACUITY CHECK. Every claim below is about state this world is
  // supposed to be carrying, and a WORN world that is quietly empty would make
  // all of them pass while proving nothing.
  ok('the WORN world is genuinely worn — block 2 accepted, history recorded, an exclusion standing',
    wornCensus.currentBlockNumber === 2
      && wornCensus.feedbackDays > 10
      && wornCensus.weightOverrideEntries > 0
      && wornCensus.exclusions.length === 1
      && worn.world?.rolloverRefusal === null,
    `block=${wornCensus.currentBlockNumber} feedback=${wornCensus.feedbackDays} `
    + `overrides=${wornCensus.weightOverrideEntries} `
    + `exclusions=${wornCensus.exclusions.length} refusal=${worn.world?.rolloverRefusal}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STAGE 1 — THE MATRIX
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n═══ STAGE 1 — setting × accepted-state shape × restart route ═══');

  for (const shape of ['FRESH', 'WORN'] as const) {
    // ── SETTING 1 — SEASON PHASE ──────────────────────────────────────────
    await runCell({
      setting: 'season phase (In-season -> Pre-season)',
      stage: await stageFor(shape),
      // Leaving In-season RETIRES the game anchor — `decideProfileSetupChange`
      // does that deliberately, so `gameDay` moving here is the rule working.
      // `acceptedBlockRequirements` moves because Pre-season delivers a
      // different number of strength sessions, and `recordAcceptedBlock`'s own
      // comment rules that re-accepting a block start overwrites its entry:
      // *"the republished week is what the athlete actually received"*.
      mayMove: ['seasonPhase', 'ownedPhase', 'gameDay', 'recordedSelections',
        'acceptedBlockRequirements'],
      apply: (stage) => changeProgramSetup({
        edit: { seasonPhase: 'Pre-season' }, todayISO: stage.todayISO,
        sourceSurface: 'phase_shift',
      }),
      expectVisibleChange: true,
    });

    // ── SETTING 2 — GAME INFORMATION ──────────────────────────────────────
    await runCell({
      setting: 'game information (Saturday -> Sunday)',
      stage: await stageFor(shape),
      mayMove: ['gameDay', 'recordedSelections', 'acceptedBlockRequirements'],
      apply: (stage) => changeProgramSetup({
        edit: { gameDay: 'Sunday' }, todayISO: stage.todayISO,
      }),
      expectVisibleChange: true,
    });

    // ── SETTING 3 — CLUB TRAINING ─────────────────────────────────────────
    //
    // Tuesday-only, NOT Wednesday-only. Moving the club night onto a gym day is
    // a different subject with a defect of its own, and it is measured on its
    // own in stage 3 rather than smuggled in here where it would red this cell
    // for a reason that has nothing to do with persistence.
    await runCell({
      setting: 'club training (Tue+Thu -> Tue)',
      stage: await stageFor(shape),
      mayMove: ['teamTrainingDays', 'recordedSelections', 'acceptedBlockRequirements'],
      apply: (stage) => changeProgramSetup({
        edit: { teamDays: ['Tuesday'] }, todayISO: stage.todayISO,
      }),
      expectVisibleChange: true,
    });

    // ── SETTING 4 — PERMANENT GYM EQUIPMENT ───────────────────────────────
    //
    // THE MACHINES GO, NOT THE BARBELL. Measured first: this athlete's block 2
    // carries `Leg Press` and `Single-Leg Leg Press` and no barbell-only row, so
    // removing the barbell regenerates a byte-identical week and the cell would
    // be green and EMPTY. Removing `machine` is the change their week can feel.
    await runCell({
      setting: 'permanent equipment (the gym loses its machines)',
      stage: await stageFor(shape),
      mayMove: ['equipmentTags', 'recordedSelections', 'acceptedBlockRequirements'],
      apply: (stage) => changePermanentEquipment({
        answer: equipmentAnswerWith({
          from: useProfileStore.getState().onboardingData.equipmentAnswer,
          tags: { machine: undefined },
          answeredOn: stage.todayISO,
        }),
        todayISO: stage.todayISO,
      }),
      expectVisibleChange: true,
    });

    // ── SETTING 5 — SESSION-ONLY EQUIPMENT (R-072 scope 2) ────────────────
    //
    // This is NOT a settings change and the cell exists to prove the app knows
    // that: *"never confuse permanent gym equipment with session-only
    // equipment"*. The permanent answer may not move a single tag.
    await runCell({
      setting: 'session-only equipment (no barbell TODAY)',
      stage: await stageFor(shape),
      // A dated fact changes today's rows and NOTHING in the accepted answers.
      mayMove: [],
      apply: (stage) => declareSessionEquipmentMissing({
        dateISO: stage.weekStartISO, tags: ['barbell', 'machine'],
      }),
      expectVisibleChange: true,
    });
  }

  // ── SETTING 6 — A COACH/PROGRAM EDIT, AND IT NEEDS THE WORN WORLD ───────
  //
  // An ordinary substitution through `executeProgramControlActionDurably`, the
  // door every program-control surface uses. It is run on WORN only because the
  // claim is *"a coach/program edit survives close and reopen"* and a FRESH
  // world has no accepted history for the reopen to lose.
  console.log('\n  ── coach/program edit · WORN ──');
  {
    const stage = await stageFor('WORN');
    const before = takeSettingsCensus();
    const day = weekPrint(stage.weekStartISO, stage.todayISO);
    const target = (() => {
      for (const line of day) {
        const match = line.match(/^Monday:[^:]*:\[(.*)\]$/);
        if (!match) continue;
        for (const cell of match[1].split(',')) {
          const row = cell.match(/^([^|]+)\|(\d+)\|(\d+)-(\d+)\|([0-9.]+)$/);
          if (row && Number(row[5]) > 0) {
            return {
              name: row[1], sets: Number(row[2]),
              repsMin: Number(row[3]), repsMax: Number(row[4]),
            };
          }
        }
      }
      return null;
    })();
    // THE OPTION LIST IS THE APP'S OWN. Deriving a candidate any other way
    // invents an exercise the door would refuse, and the refusal then reads as
    // a product defect.
    const options = target
      ? swapOptionsFor({
        dateISO: stage.weekStartISO,
        originalExercise: target.name,
        existingExerciseNames: day.flatMap((line) =>
          (line.match(/\[(.*)\]$/)?.[1] ?? '').split(',').map((c) => c.split('|')[0])),
      })
      : [];
    console.log(`     swapping ${target?.name ?? '(none found)'}; `
      + `the app offers ${options.map((o) => o.name).join(', ') || '(nothing)'}`);

    if (!target || options.length === 0) {
      ok('coach/program edit · WORN: the app offered a substitute to walk', false,
        `target=${target?.name ?? 'none'} options=${options.length} `
        + '[NOT EVALUATED — no substitution could be attempted]');
    } else {
      const weekBefore = weekPrint(stage.weekStartISO, stage.todayISO);
      const edit = await substituteExercise({
        dateISO: stage.weekStartISO,
        weekStartISO: stage.weekStartISO,
        fromExercise: target.name,
        toExercise: {
          name: options[0].name, sets: target.sets,
          repsMin: target.repsMin, repsMax: target.repsMax,
        },
      });
      const weekAfter = weekPrint(stage.weekStartISO, stage.todayISO);
      const after = takeSettingsCensus();
      console.log(`     edit: ${JSON.stringify(edit)}`);
      ok('coach/program edit · WORN: the edit LANDS through the durable executor',
        edit.ok, edit.message);
      ok('coach/program edit · WORN: the athlete SEES it', !same(weekBefore, weekAfter),
        'the week is byte-identical after a successful edit');
      ok('coach/program edit · WORN: it did not reset the accepted block or the history',
        movedAthleteState(before, after).length === 0,
        `moved: ${movedAthleteState(before, after).join(', ')}`);

      await reopenTheApp('coach/program edit · WORN', stage.todayISO);
      const weekRestart = weekPrint(stage.weekStartISO, stage.todayISO);
      ok('coach/program edit · WORN: it SURVIVES close and reopen',
        same(weekAfter, weekRestart),
        `settled:\n      ${weekAfter.join('\n      ')}`
        + `\n    reopened:\n      ${weekRestart.join('\n      ')}`);
      matrix.push({
        setting: 'coach/program edit', shape: 'WORN', committed: edit.ok,
        movedCensusFields: censusDelta(before, after),
        athleteStateLost: movedAthleteState(before, after),
        identicalOverRestart: same(weekAfter, weekRestart),
        blockNumberBefore: before.currentBlockNumber,
        blockNumberAfter: after.currentBlockNumber,
        blockNumberAfterRestart: takeSettingsCensus().currentBlockNumber,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STAGE 2 — COMBINED JOURNEYS
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n═══ STAGE 2 — combined journeys, not isolated toggles ═══\n');

  // ── 2a. PERMANENT KIT AND A SESSION-ONLY FACT, BOTH LIVE AT ONCE ────────
  //
  // R-072's three scopes are only really separate if the app can hold two of
  // them at the same time and keep them apart. This is the cell that would
  // catch a session answer being written into the profile, or a profile answer
  // expiring with the day.
  console.log('  ── 2a. permanent kit change + a session-only fact, both live ──');
  {
    const stage = await stageFor('WORN');
    const beforeKit = takeSettingsCensus().equipmentTags;
    await changePermanentEquipment({
      answer: equipmentAnswerWith({
        from: useProfileStore.getState().onboardingData.equipmentAnswer,
        tags: { machine: undefined }, answeredOn: stage.todayISO,
      }),
      todayISO: stage.todayISO,
    });
    const afterKit = takeSettingsCensus().equipmentTags;
    const weekWithPermanent = weekPrint(stage.weekStartISO, stage.todayISO);

    await declareSessionEquipmentMissing({
      dateISO: stage.weekStartISO, tags: ['dumbbells'],
    });
    const afterSession = takeSettingsCensus();
    const weekWithBoth = weekPrint(stage.weekStartISO, stage.todayISO);

    console.log(`     permanent tags: ${beforeKit.length} -> ${afterKit.length}`);
    console.log(`     after the session-only fact: ${afterSession.equipmentTags.length}`);
    console.log(`     week with the permanent change only:\n       `
      + weekWithPermanent.join('\n       '));
    console.log(`     week with BOTH:\n       ${weekWithBoth.join('\n       ')}`);

    ok('2a: the PERMANENT answer changed and the app rebuilt against it',
      !same(beforeKit, afterKit), 'the profile equipment answer did not move');
    ok('2a: the SESSION-ONLY fact wrote NOTHING into the permanent answer',
      same(afterKit, afterSession.equipmentTags),
      `permanent tags moved when a session fact was recorded: `
      + `${afterKit.join(',')} -> ${afterSession.equipmentTags.join(',')}`);
    ok('2a: the session-only fact still reaches TODAY on top of the permanent one',
      !same(weekWithPermanent, weekWithBoth),
      'the day is byte-identical, so the session fact did nothing on top of the '
      + 'permanent change');

    // AND THE TWO SCOPES SURVIVE A RESTART DIFFERENTLY — the permanent one
    // because it is an ANSWER, the dated one because it is a recorded FACT.
    // Both are inputs; neither is a stored week.
    await reopenTheApp('2a', stage.todayISO);
    const restarted = takeSettingsCensus();
    ok('2a: the permanent kit answer survives close/reopen',
      same(afterKit, restarted.equipmentTags),
      `${afterKit.join(',')} -> ${restarted.equipmentTags.join(',')}`);
    ok('2a: BOTH scopes are still in force after close/reopen',
      same(weekWithBoth, weekPrint(stage.weekStartISO, stage.todayISO)),
      `reopened:\n       ${weekPrint(stage.weekStartISO, stage.todayISO).join('\n       ')}`);
  }

  // ── 2b. AN EXCLUSION, THEN A SETTINGS CHANGE, THEN A RESTART ────────────
  console.log('\n  ── 2b. a standing exclusion, then a settings change, then a restart ──');
  {
    const stage = await stageFor('WORN');
    const excluded = stage.world?.excludedLift ?? null;
    const before = takeSettingsCensus();
    await changeProgramSetup({
      edit: { seasonPhase: 'Pre-season' }, todayISO: stage.todayISO,
    });
    const after = takeSettingsCensus();
    const weekAfter = weekPrint(stage.weekStartISO, stage.todayISO);
    await reopenTheApp('2b', stage.todayISO);
    const restarted = takeSettingsCensus();
    const weekRestart = weekPrint(stage.weekStartISO, stage.todayISO);

    console.log(`     the athlete had said to leave out: ${excluded}`);
    console.log(`     exclusions ${JSON.stringify(before.exclusions)} -> `
      + `${JSON.stringify(after.exclusions)} -> ${JSON.stringify(restarted.exclusions)}`);

    ok('2b: the standing exclusion survives the settings change',
      same(before.exclusions, after.exclusions),
      `${before.exclusions.join(',')} -> ${after.exclusions.join(',')}`);
    ok('2b: and it survives the restart after it',
      same(before.exclusions, restarted.exclusions),
      `${before.exclusions.join(',')} -> ${restarted.exclusions.join(',')}`);
    ok('2b: the excluded lift is STILL not programmed after the change and the restart',
      excluded !== null && !weekRestart.some((line) => line.includes(`${excluded}|`)),
      `${excluded} came back:\n       ${weekRestart.join('\n       ')}`);
    ok('2b: the rebuilt week is the same one the restart produces',
      same(weekAfter, weekRestart),
      `settled:\n       ${weekAfter.join('\n       ')}\n     reopened:\n       `
      + weekRestart.join('\n       '));
  }

  // ── 2c. FOUR SETTINGS CHANGED IN A ROW, THEN A RESTART ──────────────────
  //
  // The compounding case. Each change is committed on top of the previous one's
  // result, exactly as an athlete editing their setup would produce, and the
  // question is whether four rebuilds in a row still leave the athlete in the
  // block they earned with the loads they earned.
  console.log('\n  ── 2c. four settings changed in sequence, then a restart ──');
  {
    const stage = await stageFor('WORN');
    const before = takeSettingsCensus();
    const loadsBefore = loadsIn(stage.weekStartISO, stage.todayISO);
    const steps: { label: string; result: SettingsDoorResult }[] = [];

    steps.push({
      label: 'club Tue+Thu -> Tue',
      result: await changeProgramSetup({
        edit: { teamDays: ['Tuesday'] }, todayISO: stage.todayISO,
      }),
    });
    steps.push({
      label: 'game Saturday -> Sunday',
      result: await changeProgramSetup({
        edit: { gameDay: 'Sunday' }, todayISO: stage.todayISO,
      }),
    });
    steps.push({
      label: 'the gym loses its machines',
      result: await changePermanentEquipment({
        answer: equipmentAnswerWith({
          from: useProfileStore.getState().onboardingData.equipmentAnswer,
          tags: { machine: undefined }, answeredOn: stage.todayISO,
        }),
        todayISO: stage.todayISO,
      }),
    });
    steps.push({
      label: 'gym days Mon/Wed/Fri -> Mon/Tue/Thu/Sat',
      result: await changeProgramSetup({
        edit: {
          preferredDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'] as DayOfWeek[],
        },
        todayISO: stage.todayISO,
      }),
    });

    for (const step of steps) {
      console.log(`     ${step.label}: ok=${step.result.ok} `
        + `changedProgram=${step.result.changedProgram} `
        + `reason=${step.result.reason ?? '-'} `
        + `${step.result.ok ? '' : `refusal="${step.result.refusalCopy ?? step.result.message}"`}`);
    }
    const after = takeSettingsCensus();
    const weekAfter = weekPrint(stage.weekStartISO, stage.todayISO);
    await reopenTheApp('2c', stage.todayISO);
    const restarted = takeSettingsCensus();
    const weekRestart = weekPrint(stage.weekStartISO, stage.todayISO);

    console.log(`     block ${before.currentBlockNumber} -> ${after.currentBlockNumber} -> `
      + `${restarted.currentBlockNumber}`);
    console.log(`     feedback ${before.feedbackDays} -> ${after.feedbackDays} -> `
      + `${restarted.feedbackDays}`);
    console.log(`     loads before: ${loadsBefore.join(' ')}`);
    console.log(`     loads after:  ${loadsIn(stage.weekStartISO, stage.todayISO).join(' ')}`);
    console.log(`     answers: phase=${restarted.seasonPhase} game=${restarted.gameDay} `
      + `club=${restarted.teamTrainingDays.join('/')} `
      + `gym=${restarted.preferredTrainingDays.join('/')}`);

    ok('2c: every one of the four changes was accepted or honestly refused',
      steps.every((step) => step.result.ok || Boolean(step.result.refusalCopy)
        || step.result.blockedBy.length > 0),
      steps.filter((step) => !step.result.ok).map((step) =>
        `${step.label}: ${JSON.stringify(step.result)}`).join(' | '));
    ok('2c: after four rebuilds the athlete is STILL in the block they earned',
      after.currentBlockNumber === before.currentBlockNumber
        && restarted.currentBlockNumber === before.currentBlockNumber,
      `${before.currentBlockNumber} -> ${after.currentBlockNumber} -> `
      + `${restarted.currentBlockNumber}`);
    ok('2c: four rebuilds did not touch the recorded history or the exclusions',
      movedAthleteState(before, restarted).length === 0,
      `moved: ${movedAthleteState(before, restarted).join(', ')}`);
    ok('2c: the LAST answer given is the one that survived — every setting, after reopening',
      restarted.gameDay === 'Sunday'
        && same(restarted.teamTrainingDays, ['Tuesday'])
        && !restarted.equipmentTags.some((tag) => tag.startsWith('machine=')),
      `game=${restarted.gameDay} club=${restarted.teamTrainingDays.join('/')} `
      + `kit=${restarted.equipmentTags.join(',')}`);
    ok('2c: the settled week and the reopened week agree after FOUR changes',
      same(weekAfter, weekRestart),
      `settled:\n       ${weekAfter.join('\n       ')}\n     reopened:\n       `
      + weekRestart.join('\n       '));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STAGE 3 — SCOPE: only the dates and blocks it should
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n═══ STAGE 3 — a change reaches only the dates it should ═══\n');
  {
    const stage = await stageFor('WORN');
    const weeks = programWeekStarts();
    const laterWeek = weeks[weeks.length - 1];
    const beforeThis = weekPrint(stage.weekStartISO, stage.todayISO);
    const beforeLater = weekPrint(laterWeek, stage.todayISO);
    const beforeBlockOne = weekPrint(stage.world?.blockOneStart ?? stage.weekStartISO,
      stage.todayISO);

    // A SESSION-ONLY FACT IS DATED. It may reach today and nothing else.
    await declareSessionEquipmentMissing({
      dateISO: stage.weekStartISO, tags: ['barbell', 'machine', 'cables'],
    });
    const afterThis = weekPrint(stage.weekStartISO, stage.todayISO);
    const afterLater = weekPrint(laterWeek, stage.todayISO);

    console.log(`     this week ${stage.weekStartISO}, later week ${laterWeek}`);
    console.log(`     this week changed?  ${!same(beforeThis, afterThis)}`);
    console.log(`     later week changed? ${!same(beforeLater, afterLater)}`);

    ok('3: a session-only equipment fact reaches THE DAY IT WAS ANSWERED FOR',
      !same(beforeThis, afterThis),
      'the day is byte-identical — the dated fact reached nothing');

    /**
     * ⚠ **THE OTHER DAYS OF THE SAME WEEK, AND THIS CELL EXISTS BECAUSE A
     * MUTATION MISSED.**
     *
     * M9 widened the action's `scope` from `today_only` to `current_and_future`
     * and **nothing went red** — because the horizon of an equipment fact is set
     * by the DECISION KIND, not by the action's scope
     * (`programControlActions.ts:1643`: `missing_for_session` -> a one-day
     * window, `missing_this_week` -> a week, `missing_for_span` -> the away
     * window). The mutation changed a field the product does not read here.
     *
     * Telling "the gate is blind" from "the mutation missed" then showed the
     * gate WAS partly blind: the cells around this one compare WEEKS, so a
     * session answer that leaked to every day of its own week would have passed
     * all of them. *"For this session only"* is a claim about a DAY.
     */
    const otherDaysMoved = beforeThis
      .filter((line, index) => !line.startsWith(weekdayOf(stage.weekStartISO))
        && line !== afterThis[index])
      .map((line) => line.split(':')[0]);
    ok('3: and it reaches NO OTHER DAY of the same week — "this session only" is a DAY',
      otherDaysMoved.length === 0,
      `a one-session answer moved ${otherDaysMoved.join(', ')} as well:\n`
      + `       before ${beforeThis.join('\n       ')}\n`
      + `       after  ${afterThis.join('\n       ')}`);
    ok('3: and it reaches NO OTHER WEEK in the block',
      same(beforeLater, afterLater),
      `week ${laterWeek} moved:\n       before ${beforeLater.join('\n       ')}\n`
      + `       after  ${afterLater.join('\n       ')}`);
    ok('3: and the block the athlete has ALREADY FINISHED is untouched',
      same(beforeBlockOne, weekPrint(stage.world?.blockOneStart ?? stage.weekStartISO,
        stage.todayISO)),
      'the completed block moved under a dated fact about today');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STAGE 4 — AN HONEST REFUSAL
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n═══ STAGE 4 — the new setup cannot form a valid week ═══\n');
  {
    const stage = await stageFor('WORN');
    const before = takeSettingsCensus();
    const weekBefore = weekPrint(stage.weekStartISO, stage.todayISO);

    // ONE GYM DAY, IN-SEASON, WITH TWO CLUB NIGHTS AND A GAME. The scheduler
    // refuses this with a typed finding (`not_enough_legal_gym_days`, WC-142) —
    // measured, not assumed. The athlete must be told something true about it.
    const refused = await changeProgramSetup({
      edit: { preferredDays: ['Monday'] as DayOfWeek[] }, todayISO: stage.todayISO,
    });
    const after = takeSettingsCensus();
    console.log(`     result: ${JSON.stringify(refused)}`);

    ok('4: an impossible setup is REFUSED rather than half-applied',
      refused.ok === false, `the door accepted it: ${JSON.stringify(refused)}`);
    ok('4: nothing changed — the athlete keeps the program they had',
      same(weekBefore, weekPrint(stage.weekStartISO, stage.todayISO))
        && censusDelta(before, after).length === 0,
      `moved: ${censusDelta(before, after).join(', ')}`);

    /**
     * ⚠ **THE SENTENCE, NOT THE CODE.** Sam's mission names this outcome
     * explicitly: *"display an honest refusal when the new setup cannot form a
     * valid week."* `programMutationRefusal`'s own header says the disease it
     * exists to cure is *"every mutation refusal reached the athlete as
     * 'Something went wrong. Please try again.'"* — so a refusal that lands in
     * `unknown` is that disease, not a caveat.
     */
    const copy = refused.refusalCopy ?? '';
    ok('4: the athlete is told SOMETHING TRUE about why — not "something went wrong"',
      copy.length > 0 && !/something went wrong/i.test(copy),
      `the athlete reads: "${copy}" (typed reason: ${refused.reason})`);
    ok('4: the refusal names the athlete\'s own setup, and carries no internal identifier',
      /\b(train|training|day|days|week|club|game)\b/i.test(copy)
        && !/WC-\d+|_|refused \(/.test(copy),
      `the athlete reads: "${copy}"`);

    // AND THE SHEET'S OWN GATES — a refusal the athlete never even reaches the
    // transaction with. `decideProfileSetupChange` owns these and the screen
    // returns early on them, so they are asserted as BLOCKS, not as commits.
    const noDays = await changeProgramSetup({
      edit: { preferredDays: [] as DayOfWeek[] }, todayISO: stage.todayISO,
    });
    const noAnchor = await changeProgramSetup({
      edit: { seasonPhase: 'In-season', gameDay: null }, todayISO: stage.todayISO,
    });
    const noop = await changeProgramSetup({
      edit: { gameDay: before.gameDay as DayOfWeek }, todayISO: stage.todayISO,
    });
    console.log(`     no training days  -> ${noDays.blockedBy.join(',')}`);
    console.log(`     no game anchor    -> ${noAnchor.blockedBy.join(',')}`);
    console.log(`     nothing to change -> ${noop.blockedBy.join(',')}`);
    ok('4: "pick at least one day you can train" is caught BEFORE the transaction',
      noDays.blockedBy.includes('no_training_days'), JSON.stringify(noDays));
    ok('4: In-season without a game answer is caught BEFORE the transaction',
      noAnchor.blockedBy.includes('game_day_unanswered'), JSON.stringify(noAnchor));
    ok('4: a Save that would change nothing is REPORTED, never silently swallowed',
      noop.blockedBy.includes('no_changes'), JSON.stringify(noop));
  }


  // ═══════════════════════════════════════════════════════════════════════
  // STAGE 5 — A GYM SESSION ON A CLUB NIGHT KEEPS ITS OWN CREDIT
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n═══ STAGE 5 — the club night IS a gym day ═══\n');
  {
    /**
     * **SAM'S RULING, 2026-08-20, verbatim:** *"A gym session completed on the
     * same date as club training counts as a completed gym session. It remains
     * one calendar training day with two components, but each completed
     * component keeps its own credit. Club training must not erase the completed
     * gym component from the commitment/completion denominator. Guard both sides
     * of that ratio so generation and later block-history evaluation use the
     * same component-aware count."*
     *
     * ⚠ **AGREEMENT ALONE DOES NOT HOLD THIS RULING, AND AN EARLIER CUT OF THIS
     * STAGE ONLY ASSERTED AGREEMENT.** Before the fix the two sides agreed at
     * **4 and 4** — self-consistently crediting a twice-a-week athlete once —
     * so an agreement cell was green on exactly the app Sam ruled against. The
     * subject is CREDIT, so the comparison is between two athletes who train
     * IDENTICALLY and differ only in where the club night falls.
     *
     * **THE THREE PLACES THE CREDIT WAS ERASED**, each reading `workoutType` and
     * accepting only `Strength`/`Mixed` while `getSessionComponents` on the same
     * workout reported `["power","strength","team_training"]`:
     * `buildStrengthPerformanceLogs` (so the lifts were never recorded at all),
     * the numerator that counts days carrying those logs, and
     * `deriveAcceptedBlockStrengthRequirement`. One shared owner now,
     * `carriesStrengthComponent`.
     */
    const shapes: {
      label: string; required: number; recorded: number;
      clubNightStrengthLogDays: number; clubNightDates: string[];
    }[] = [];

    for (const [shapeLabel, clubDays] of [
      ['club nights on their OWN days', ['Tuesday', 'Thursday']],
      ['the club night IS a gym day', ['Wednesday']],
    ] as [string, DayOfWeek[]][]) {
      localStorageData.clear();
      const profile = theAthlete() as unknown as Record<string, unknown>;
      profile.teamTrainingDays = clubDays;
      profile.teamTrainingDaysPerWeek = clubDays.length;
      const world = await buildWornWorld({
        profile: profile as unknown as OnboardingData, installDayISO: INSTALL_DAY,
      });
      const census = takeSettingsCensus();
      const blockOne = world.blockOneStart;
      const blockEnd = addDaysISO(blockOne, 27);
      const required = census.acceptedBlockRequirements[
        census.acceptedBlockKeys.indexOf(blockOne)] ?? 0;
      const feedback = (useProgramStore.getState() as unknown as {
        sessionFeedback?: Record<string, { strength?: unknown[] }>;
      }).sessionFeedback ?? {};
      const history = readBlockHistory({
        feedbackByDate: feedback as never,
        blockStartISO: blockOne,
        blockEndISO: blockEnd,
        requiredStrengthSessions: required,
      }) as unknown as { recordedStrengthSessions?: number; qualifies?: boolean };
      const recorded = history.recordedStrengthSessions ?? -1;

      // THE CLUB NIGHTS THEMSELVES — did the athlete's lifting on those dates
      // reach the record at all? This is the half that was silently zero.
      const clubNightDates = Object.keys(feedback)
        .filter((date) => date >= blockOne && date <= blockEnd)
        .filter((date) => clubDays.includes(weekdayOf(date) as DayOfWeek))
        .sort();
      const clubNightStrengthLogDays = clubNightDates
        .filter((date) => (feedback[date]?.strength?.length ?? 0) > 0).length;

      console.log(`  ── ${shapeLabel} ──`);
      console.log(`     block 1 ${blockOne}: DENOMINATOR ${required} · NUMERATOR `
        + `${recorded} · qualifies ${history.qualifies}`);
      console.log(`     club-night dates in the block: ${clubNightDates.length}, `
        + `of which ${clubNightStrengthLogDays} recorded the athlete's lifting`);

      ok(`5 [${shapeLabel}]: the block required strength sessions and the athlete did them`,
        required > 0 && recorded > 0,
        `required=${required} recorded=${recorded} — every claim below would be `
        + 'vacuous on this world');
      ok(`5 [${shapeLabel}]: both sides of the completion ratio count the same sessions`,
        recorded === required || recorded === required - 1,
        `denominator ${required}, numerator ${recorded}, on an athlete who missed `
        + 'exactly one session');

      shapes.push({
        label: shapeLabel, required, recorded, clubNightStrengthLogDays, clubNightDates,
      });
    }

    const [separated, combined] = shapes;

    /**
     * ⚠ **THE ANTI-VACUITY CHECK FOR THE COMPARISON ITSELF.** If the second
     * athlete's club night never actually landed on a gym day — because the
     * scheduler moved their gym session elsewhere — then the two worlds are the
     * same world and the cells below are green about nothing.
     */
    ok('5: the second athlete really does train in the gym ON their club night',
      combined.clubNightDates.length > 0
        && combined.clubNightDates.length >= 3,
      `only ${combined.clubNightDates.length} club-night dates carry a record — `
      + 'the two worlds may not differ in the way this stage assumes');

    ok('5: THE GYM SESSION ON A CLUB NIGHT IS RECORDED — the lifts are not lost',
      combined.clubNightStrengthLogDays === combined.clubNightDates.length,
      `${combined.clubNightStrengthLogDays} of ${combined.clubNightDates.length} `
      + "club-night dates recorded the athlete's lifting. Sam, 2026-08-20: a gym "
      + 'session completed on the same date as club training counts as a completed '
      + 'gym session. Zero here means the loads were never stored, so the block '
      + 'boundary has nothing to progress those lifts from either.');

    ok('5: THE SAME TRAINING EARNS THE SAME CREDIT wherever the club night falls',
      combined.required === separated.required
        && combined.recorded === separated.recorded,
      `the athlete whose club night is a gym day is credited `
      + `${combined.recorded}/${combined.required} while the athlete who trains `
      + `exactly as much on separate days is credited `
      + `${separated.recorded}/${separated.required}. Club training must not erase `
      + 'the completed gym component from the commitment/completion denominator.');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // THE MATRIX, PRINTED
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n═══ THE MATRIX ═══\n');
  console.log('  setting                                        | shape | committed | block '
    + '| athlete state lost      | identical after reopen');
  for (const cell of matrix) {
    console.log(`  ${cell.setting.padEnd(46)} | ${cell.shape.padEnd(5)} | `
      + `${String(cell.committed).padEnd(9)} | `
      + `${cell.blockNumberBefore}->${cell.blockNumberAfter}->${cell.blockNumberAfterRestart}`
      .padEnd(6) + ' | '
      + `${(cell.athleteStateLost.join(',') || 'nothing').padEnd(23)} | `
      + `${cell.identicalOverRestart}`);
  }

  console.log(`\nSettings and persistence journeys: ${pass} passed, ${fail} failed`);
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    for (const line of failures) console.log(`  - ${line}`);
  }
  totalsPrinted(fail);
  if (fail > 0) process.exit(1);
}

void main().catch((error) => {
  console.error('\nSETTINGS JOURNEY THREW:', error);
  process.exit(1);
});
