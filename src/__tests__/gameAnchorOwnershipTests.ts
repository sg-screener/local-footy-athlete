/**
 * A GAME CAN BE ON ANY DAY OF THE WEEK, AND ONE OWNER SAYS WHICH DAY.
 *
 * **Sam, 2026-08-12, verbatim:** *"games should be able to be placed any day of
 * the week - i can't know when every single club in aus is going to play a game
 * so I want to be prepared for everything"*.
 *
 * `LAW-game-anchor-any-day-one-owner`. The guard for it is this file.
 *
 * ## WHAT THE DEFECT WAS — THE WRONG WEEK, NOT A MISSING PREFERENCE
 *
 * A Tuesday game did not merely fail to be offered. `resolveEffectiveGameDay`
 * returned `undefined` for it, so the week was built as if there were **no game
 * at all** — no G-1 taper, no G-2 spacing, no G+1 recovery. An athlete who
 * plays midweek got a week that protected nothing.
 *
 * ## CORRECTION — THE COUNT WAS WRONG, AND THE METHOD IS WHY
 *
 * This suite's first version said EIGHT copies of "which day is the game" and
 * claimed to have collapsed them all. **There were SIXTEEN.** The census found
 * them by grepping for `'Varies'` plus a hand-written list of named readers, so
 * it missed every copy that spells the fallback inline —
 * `profile.usualGameDay || profile.gameDay` — in `coachingEngine`,
 * `rollingHorizonRepair`, `fixtureConditionedAvailability` (x2),
 * `acceptedStateTransaction` (x2) and `generateProgram` (x2).
 *
 * `a-count-taken-for-a-record`: the number named the INSTRUMENT'S unit — "sites
 * mentioning the legacy literal, plus the ones I listed" — and was reported in
 * the DOMAIN'S, "copies of the predicate". The literal was an artefact of how
 * the old code happened to be written. **The shape is the thing**, and
 * `nothing re-implements the anchor fallback inline` now counts the shape.
 *
 * ## WHY A SOURCE SCAN IS PART OF THE INSTRUMENT AND NOT THE WHOLE OF IT
 *
 * The behavioural cells build the week and read what came out. The source cells
 * exist because the class this must stop coming back is a SEVENTEENTH copy, and
 * behaviour cannot see a copy that happens to agree today.
 *
 * Per the count-names-its-instrument law, every source cell asserts the REGION
 * it found is non-trivial before asserting anything about it, and cell 10 reds
 * the checkers against fabricated violations so a passing scan is never a scan
 * that matched nothing.
 *
 * ## NOT COVERED
 *
 * - **Nothing here runs on a device or a simulator.** Whether a real athlete's
 *   phone holds a `'Varies'` profile is still OPEN-UNKNOWN; cell 3 proves such
 *   a profile behaves exactly as it does today, which is why no migration is
 *   owed, but that is an argument from the code and not from a device.
 * - **N games in one week.** This owns the recurring WEEKDAY only.
 *   `derivedWeekContract.ts:90` still collapses a fixture list to its first
 *   entry — `HOW_TO_BUILD_THIS_APP` §5 item 4, untouched here.
 * - **Whether the midweek week is GOOD programming.** Cell 4 asserts the game
 *   is anchored and the day before it is not a hard strength day; it does not
 *   judge the rest of the week's quality.
 * - The ~18 remaining hand-rolled weekday lists elsewhere in the app. This unit
 *   collapsed two of them.
 *
 * Run: npm run test:game-anchor
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
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
  throw new Error('NETWORK DISABLED — the game anchor is an on-device law');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
import * as path from 'path';
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import {
  DAYS_OF_WEEK,
  isDayOfWeek,
  storedGameAnchor,
} from '../rules/gameAnchor';
import {
  resolveEffectiveGameDay,
  computeGameDatesForBlock,
  effectiveGameDatesAround,
} from '../utils/sessionResolver';
import { generateProgramLocally } from '../services/api/generateProgram';
import { PERSONA_SCENARIOS } from './scenarioQA/personas';
import { DEV_TEST_ONBOARDING_DATA } from '../utils/devOnboardingSkip';
import { useCalendarStore } from '../store/calendarStore';
import { useProfileStore } from '../store/profileStore';
import { rebuildDerivedWorld } from '../store/quiescentBoot';
import { commitRebuiltProgram } from '../utils/weekRebuild';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

async function runAsync(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined;
  console.debug = () => undefined; console.info = () => undefined;
  console.log = () => undefined;
  try { return await body(); } finally {
    console.warn = warn; console.error = error;
    console.debug = debug; console.info = info; console.log = log;
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined;
  console.debug = () => undefined; console.info = () => undefined;
  console.log = () => undefined;
  try { return body(); } finally {
    console.warn = warn; console.error = error;
    console.debug = debug; console.info = info; console.log = log;
  }
}

const repoRoot = path.resolve(__dirname, '..', '..');
const srcRoot = path.join(repoRoot, 'src');

function read(relative: string): string {
  const full = path.join(srcRoot, relative);
  assert(fs.existsSync(full), `${relative} is gone — a cell below is reading nothing`);
  return fs.readFileSync(full, 'utf8');
}

/** Every .ts/.tsx under src/, so no reader can hide from the ownership cells. */
function everySourceFile(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(srcRoot);
  return out;
}

// ─────────────────────────────────────────────────────────────────
// 1-4 — BEHAVIOUR
// ─────────────────────────────────────────────────────────────────

run('the owner reads a game on every one of the seven days', () => {
  // THE DEFECT, DIRECTLY. Before this unit `resolveEffectiveGameDay` answered
  // for three of these seven and `undefined` for the other four.
  const unread = DAYS_OF_WEEK.filter((day) =>
    storedGameAnchor({ gameDay: day }) !== day
    || storedGameAnchor({ usualGameDay: day }) !== day
    || resolveEffectiveGameDay(undefined, day) !== day);
  assert(unread.length === 0,
    `these days are stored and then not read back: ${JSON.stringify(unread)}`);
  assert(DAYS_OF_WEEK.length === 7, 'the week stopped having seven days');
});

run('usualGameDay outranks the onboarding field, and neither invents a day', () => {
  assert(storedGameAnchor({ usualGameDay: 'Wednesday', gameDay: 'Saturday' }) === 'Wednesday',
    'the modern field must win — every door except onboarding writes it');
  assert(storedGameAnchor({}) === null, 'an unanswered profile has no anchor');
  assert(storedGameAnchor(undefined) === null, 'no profile has no anchor');
  assert(storedGameAnchor({ gameDay: 'someday' }) === null,
    'an unrecognised stored string is not a day');
  assert(!isDayOfWeek(''), 'the empty string is not a day');
  assert(!isDayOfWeek(3), 'a day NUMBER is a different unit and is not a day name');
});

run("a stored 'Varies' profile behaves exactly as it did — no migration is owed", () => {
  // 'Varies' was never a day. It meant "no usual game day", which is what
  // `undefined` already means. So the owner parses it to null, the athlete's
  // week is unchanged, and there is nothing on any device to migrate.
  assert(storedGameAnchor({ gameDay: 'Varies' }) === null,
    "'Varies' must read as no anchor, not as a day named Varies");
  assert(storedGameAnchor({ gameDay: 'Varies', usualGameDay: 'Wednesday' }) === 'Wednesday',
    'a legacy Varies alongside a real anchor must not suppress the real one — '
    + 'this is the exact shape that lost every game mark on relaunch');
  assert(computeGameDatesForBlock('Varies' as never, '2026-07-13', '2026-08-13').length === 0,
    "'Varies' must seed no fixtures");
});

/**
 * The app's own standard in-season athlete, with the game moved to Wednesday
 * and nothing else touched. Everything else — equipment, availability, team
 * nights — is whatever the app itself ships, so a failure below is about the
 * anchor and not about a fixture that generation would refuse.
 */
function midweekAthlete(): OnboardingData {
  return {
    ...DEV_TEST_ONBOARDING_DATA,
    usualGameDay: 'Wednesday',
    gameDay: 'Wednesday',
  } as OnboardingData;
}

/** Generate one week for a profile and return its workouts. */
function weekFor(profile: OnboardingData): Workout[] {
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13', previousProgram: null, activeConstraints: [],
  })) as TrainingProgram;
  const week = program.microcycles[0];
  assert(week && week.workouts.length > 0,
    'generation produced no week — every assertion after this would be vacuous');
  return week.workouts as Workout[];
}

/** A compact shape of the week: day number → what is on it, in order. */
function weekShape(workouts: Workout[]): string {
  return workouts
    .map((w) => `${w.dayOfWeek}:${w.workoutType}`)
    .sort()
    .join('|');
}

run("the QA persona's midweek game is a real Wednesday on BOTH fields", () => {
  // The app's own declared midweek scenario. It used to carry the legacy
  // 'Varies' beside `usualGameDay: 'Wednesday'` because `gameDay` could not
  // hold a midweek day — the exact split that lost fixtures on relaunch.
  const persona = PERSONA_SCENARIOS.find((s) => s.name === 'in-season-midweek-game');
  assert(persona, 'the midweek-game persona is gone — this cell is reading nothing');
  const profile = persona.profile as OnboardingData;
  assert(storedGameAnchor(profile) === 'Wednesday',
    'the persona no longer describes a Wednesday game');
  assert(profile.gameDay === 'Wednesday' && profile.usualGameDay === 'Wednesday',
    'the persona still splits its answer across two fields that disagree');
});

run('the ONBOARDING field alone puts a game on the calendar, on all seven days', () => {
  // THIS IS THE DEFECT ITSELF, AT THE LAYER THE ATHLETE SEES. An athlete who
  // only ever answered onboarding has `gameDay` and no `usualGameDay`. Before
  // this unit the allowlist answered `undefined` for anything outside
  // Fri/Sat/Sun, so BOTH owners below returned an empty set: no virtual game on
  // the week strip and no seeded fixture in the block. Not a missing
  // preference — no game at all.
  //
  // MEASURED, and it corrected the seat's own framing: generation does not draw
  // a `Game` workout for ANY day, Saturday included. The fixture is virtual and
  // lives here. Asserting on the generated microcycle would have been green
  // against the wrong layer.
  const silent: string[] = [];
  for (const day of DAYS_OF_WEEK) {
    const expectedDow = DAYS_OF_WEEK.indexOf(day) === 6 ? 0 : DAYS_OF_WEEK.indexOf(day) + 1;
    const virtual = [...effectiveGameDatesAround({
      markedDays: {}, usualGameDay: undefined, gameDay: day,
      seasonPhase: 'In-season', centerDate: '2026-07-15', windowDays: 10,
    })];
    const seeded = computeGameDatesForBlock(day, '2026-07-13', '2026-08-02');
    const wrongDay = [...virtual, ...seeded]
      .filter((d) => new Date(`${d}T12:00:00`).getDay() !== expectedDow);
    if (virtual.length === 0) silent.push(`${day}: no virtual game`);
    if (seeded.length === 0) silent.push(`${day}: no seeded fixture`);
    if (wrongDay.length > 0) silent.push(`${day}: landed on ${JSON.stringify(wrongDay)}`);
  }
  assert(silent.length === 0,
    `the onboarding answer produces no game for: ${JSON.stringify(silent)} — the allowlist is back`);
});

run('a midweek anchor changes the week the app builds', () => {
  // THE ANCHOR IS CONSUMED, not merely drawn. Built from the app's own standard
  // world with only the anchor moved — a hand-written profile is a world the
  // app would never build (AGENTS.md).
  const midweek = weekFor(midweekAthlete());
  const unanchored = weekFor({
    ...midweekAthlete(), gameDay: undefined, usualGameDay: undefined,
  } as OnboardingData);
  assert(weekShape(midweek) !== weekShape(unanchored),
    'a Wednesday game produces the same week as no game at all — the anchor is '
    + 'read and then not consumed');

  // AND THE GAME DAY IS KEPT CLEAR — the protection a midweek athlete used to
  // get none of. Wednesday is dayOfWeek 3.
  const onGameDay = midweek.filter((w) => w.dayOfWeek === 3);
  assert(onGameDay.length === 0,
    `the week stacks work onto the Wednesday game itself: `
    + `${JSON.stringify(onGameDay.map((w) => w.workoutType))}`);
});

const relaunchKeepsFixtures = async (): Promise<void> => {
  // `HOW_TO_BUILD_THIS_APP` §5 item 2, THE LIVE LOSS-ON-RELAUNCH, driven through
  // the real boot path rather than argued from the source.
  //
  // THE SHAPE: an athlete told the phase sheet "Wednesday". `usualGameDay`
  // held it; `gameDay` was narrowed on the way into storage and held the legacy
  // 'Varies'. `deriveBootFixtureMarks` wipes every game/noGame mark and then
  // re-seeds from the anchor — and it read `gameDay` ALONE. So the wipe
  // happened, the re-seed found nothing, and the athlete's whole fixture list
  // was gone the next time they opened the app.
  const profile = {
    ...DEV_TEST_ONBOARDING_DATA,
    seasonPhase: 'In-season',
    usualGameDay: 'Wednesday',
    gameDay: 'Varies',
  } as unknown as OnboardingData;

  const TODAY = '2026-07-13';
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  // THROUGH THE OWNED DOOR, never `setState({ onboardingData })`. The one-door
  // law reaches test sources too, and `profileMirrorNarrowingTests` caught this
  // cell doing it the other way on its first sweep — the census is exact and a
  // suite may not quietly join it.
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  assert(useProfileStore.getState().isOnboardingComplete,
    'the world never completed onboarding — the boot below returns immediately '
    + 'and this cell would be vacuous');

  // The boot REFUSES to rebuild without a generation anchor, and is right to —
  // an anchor is a decision, never guessed from today. So the world is reached
  // by generating and committing first, exactly as the app does.
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: TODAY, previousProgram: null, activeConstraints: [],
  })) as TrainingProgram;
  quiet(() => commitRebuiltProgram(
    program, { preserve: [], clear: [], conflictsRemoved: [] },
    { markedDays: {}, selectedDate: TODAY, reason: 'game-anchor:relaunch-cell' },
  ));

  // And the fixtures are wiped before the relaunch, so what comes back can only
  // have come from the boot's own re-seed.
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);

  await quietAsync(async () => { await rebuildDerivedWorld(); });

  const marks = useCalendarStore.getState().markedDays ?? {};
  const games = Object.entries(marks)
    .filter(([, kind]) => kind === 'game')
    .map(([date]) => date);
  assert(games.length > 0,
    'the boot re-seeded NO fixtures for an athlete whose only anchor is '
    + '`usualGameDay` — this is the loss-on-relaunch, back');
  const notWednesday = games.filter((d) => new Date(`${d}T12:00:00`).getDay() !== 3);
  assert(notWednesday.length === 0,
    `the boot seeded fixtures off the athlete's game day: ${JSON.stringify(notWednesday)}`);
};

// ─────────────────────────────────────────────────────────────────
// 5-9 — OWNERSHIP. The class is a NINTH copy of the predicate.
// ─────────────────────────────────────────────────────────────────

/**
 * A COMMENT IS NOT A SHIPPED PREDICATE. The word must survive in the prose that
 * explains what it meant and why no device migration is owed — deleting that
 * history is how the next seat re-discovers it. What may not survive is CODE
 * that parses it, so the scan strips comments and string-literal-free prose
 * first and reads only what runs.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Files allowed to say the legacy word IN CODE, and why. */
const VARIES_ALLOWED_IN_CODE = new Set<string>([
  // This suite, which must name it to prove it parses to null.
  '__tests__/gameAnchorOwnershipTests.ts',
]);

function filesStillParsingVaries(): string[] {
  return everySourceFile()
    .map((full) => ({ rel: path.relative(srcRoot, full), text: fs.readFileSync(full, 'utf8') }))
    .filter(({ rel, text }) =>
      !VARIES_ALLOWED_IN_CODE.has(rel) && /'Varies'|"Varies"/.test(stripComments(text)))
    .map(({ rel }) => rel);
}

/**
 * THE SHAPE, NOT THE LITERAL — and this cell exists because the first version
 * of this suite counted the wrong thing.
 *
 * The founding census claimed EIGHT copies of "which day is the game" and
 * collapsed them. It found them by grepping for `'Varies'` plus a hand-written
 * list of named readers, so it missed **every copy that spells the fallback
 * inline without the legacy literal** — `profile.usualGameDay || profile.gameDay`.
 * There were EIGHT more, in `coachingEngine`, `rollingHorizonRepair`,
 * `fixtureConditionedAvailability` (twice), `acceptedStateTransaction` (twice)
 * and `generateProgram` (twice). **Sixteen, not eight.**
 *
 * `a-count-taken-for-a-record`: the number named the INSTRUMENT'S unit — "sites
 * mentioning 'Varies', plus the ones I listed" — and was reported in the
 * domain's, "copies of the predicate". A literal is an artefact; the SHAPE is
 * the thing. This cell counts the shape.
 *
 * It also catches a real latent defect, not just duplication: a bare
 * `usualGameDay || gameDay` hands a legacy `'Varies'` downstream AS IF IT WERE A
 * DAY. The owner returns null for it.
 */
function inlineAnchorFallbacks(): string[] {
  const shape = /usualGameDay\s*(\|\||\?\?)\s*[A-Za-z.]*gameDay/;
  return everySourceFile()
    .map((full) => ({ rel: path.relative(srcRoot, full), text: fs.readFileSync(full, 'utf8') }))
    .filter(({ rel }) => rel !== 'rules/gameAnchor.ts'
      && rel !== '__tests__/gameAnchorOwnershipTests.ts')
    .flatMap(({ rel, text }) => stripComments(text).split('\n')
      .map((line, index) => ({ rel, line, index }))
      .filter(({ line }) => shape.test(line))
      .map(({ index }) => `${rel}:${index + 1}`));
}

run('nothing re-implements the anchor fallback inline', () => {
  const copies = inlineAnchorFallbacks();
  assert(copies.length === 0,
    `these spell "usualGameDay || gameDay" by hand instead of asking the owner: `
    + `${JSON.stringify(copies)}. Each one is a copy that can disagree, and a bare `
    + "fallback hands a legacy 'Varies' downstream as if it were a day.");
});

run("no code outside the owner knows the word 'Varies'", () => {
  const stragglers = filesStillParsingVaries();
  assert(stragglers.length === 0,
    'these still parse the legacy value themselves instead of asking the owner: '
    + `${JSON.stringify(stragglers)}. Each one is a copy of the predicate that can `
    + 'disagree with the other seven.');
});

run('the three-day enum is gone from the domain', () => {
  const domain = read('types/domain.ts');
  assert(/gameDay\?: DayOfWeek/.test(domain),
    'the profile no longer declares gameDay as a full DayOfWeek');
  assert(!/export type GameDay\b/.test(domain),
    'the GameDay enum is back — a second name for DayOfWeek is a second set of days');
});

/** The readers that must delegate, and the region each one delegates in. */
const DELEGATING_READERS: ReadonlyArray<{ file: string; because: string }> = [
  { file: 'utils/sessionResolver.ts', because: 'the Fri/Sat/Sun allowlist lived here' },
  { file: 'rules/profileSetupChange.ts', because: 'the profile sheet resolved its own anchor' },
  { file: 'screens/profile/ProfileScreen.tsx', because: 'dayFromGameFields was copy 3' },
  { file: 'hooks/useSeasonPhaseControl.ts', because: 'the phase sheet inlined copy 4' },
  { file: 'utils/recoveryAddonBuilder.ts', because: "gameDayForWeek tested !== 'Varies'" },
  { file: 'utils/postGenerationConstraintValidation.ts', because: "tested !== 'Varies'" },
  { file: 'services/api/generateProgram.ts', because: "gameDayOfWeekFor tested !== 'Varies'" },
  { file: 'utils/weekRebuild.ts', because: 'it inlined a seven-name includes' },
  { file: 'utils/fixtureMinimalReplan.ts', because: 'the replan resolved its own anchor' },
  { file: 'utils/onboardingCompletion.ts', because: 'fixture seeding resolved its own anchor' },
  { file: 'utils/coachProgramEdit.ts', because: 'the coach clarifier tested both fields by hand' },
  { file: 'rules/weekContext.ts', because: 'hasUsableGameDay was a ninth spelling' },
  { file: 'store/quiescentBoot.ts', because: 'relaunch re-seeding read ONE field and lost the other' },
  { file: 'dev/e2e/devE2ESeedRegistry.ts', because: 'a seed that resolves differently is a fake world' },
];

run('every reader of the game anchor asks the owner', () => {
  const missing = DELEGATING_READERS.filter(({ file }) =>
    !/\bstoredGameAnchor\b|\bisDayOfWeek\b/.test(read(file)));
  assert(missing.length === 0,
    `these resolve the athlete's game day themselves: `
    + `${JSON.stringify(missing.map((m) => `${m.file} (${m.because})`))}`);
});

run('the owner has no way to grow a cycle back into the app', () => {
  const owner = read('rules/gameAnchor.ts');
  for (const forbidden of ['sessionResolver', 'generateProgram', 'profileStore', 'react-native']) {
    assert(!new RegExp(`from '[^']*${forbidden}'`).test(owner),
      `the anchor owner imports ${forbidden} — it must be readable from a screen, `
      + 'a rule, a store and the node harness alike');
  }
});

run('both game-day pickers offer the whole week', () => {
  // COUNT IS NOT THE ASSERTION (AGENTS.md). The screen must render the shared
  // grid, and the grid must derive its entries from the canonical seven-day
  // list. A hardcoded three-entry array and a seven-entry one otherwise look
  // identical to a scan that only finds a picker component.
  const onboarding = read('screens/onboarding/GameDayScreen.tsx');
  assert(/<DayGrid/.test(onboarding),
    'the onboarding picker does not render the shared day grid');
  assert(!/'Friday', *'Saturday', *'Sunday'/.test(onboarding),
    'the onboarding picker still hardcodes the weekend');
  const onboardingGrid = read('components/onboarding/DayGrid.tsx');
  assert(/DAYS_OF_WEEK\.map\(/.test(onboardingGrid),
    'the shared onboarding grid does not render from the canonical week');

  const profileScreen = read('screens/profile/ProfileScreen.tsx');
  const gameDaySheet = profileScreen.slice(profileScreen.indexOf("step === 'programGameDay'"));
  assert(gameDaySheet.length > 200,
    'the game-day sheet region was not found — this cell is asserting on nothing');
  const grid = gameDaySheet.slice(0, gameDaySheet.indexOf('</>'));
  assert(/days=\{WEEK_DAYS\}/.test(grid),
    'the profile sheet still offers a narrowed day list');
});

run('the canonical week has exactly one definition that the aliases point at', () => {
  const home = read('screens/home/homeScreenConstants.ts');
  const setup = read('rules/profileSetupChange.ts');
  for (const [name, text] of [['homeScreenConstants', home], ['profileSetupChange', setup]] as const) {
    assert(/from '.*gameAnchor'/.test(text),
      `${name} still hand-writes its own copy of the week`);
  }
  assert(!/const WEEK_DAYS: DayOfWeek\[\] = \[\s*'Monday'/.test(home),
    'homeScreenConstants re-declares the week beside the alias');
  assert(!/const SETUP_WEEK_DAYS: readonly DayOfWeek\[\] = \[\s*'Monday'/.test(setup),
    'profileSetupChange re-declares the week beside the alias');
});

// ─────────────────────────────────────────────────────────────────
// 10 — LIVENESS. A scan that cannot red is not a scan.
// ─────────────────────────────────────────────────────────────────

run('the checkers red on fabricated violations (liveness)', () => {
  assert(/'Varies'/.test(stripComments("const x = 'Varies';")),
    'the Varies checker would not see the literal it hunts');
  assert(!/'Varies'/.test(stripComments("// a comment mentioning 'Varies'\n")),
    'the Varies checker reds on prose, so the history cannot be written down');
  assert(!/\bstoredGameAnchor\b|\bisDayOfWeek\b/.test(
    'const day = profile.usualGameDay || profile.gameDay;'),
    'the delegation checker passes a hand-rolled resolution — it holds nothing');
  assert(/\bstoredGameAnchor\b/.test('const day = storedGameAnchor(profile);'),
    'the delegation checker does not see a real delegation');
  assert(!/DAYS_OF_WEEK\.map\(/.test("const OPTIONS = ['Friday', 'Saturday', 'Sunday'];"),
    'the picker checker passes a hardcoded weekend');
  assert(storedGameAnchor({ gameDay: 'Wednesday' }) !== null,
    'the owner itself would answer null for the founding case');
});

const main = async (): Promise<void> => {
  // The one cell that needs the real boot, which is async. Everything above ran
  // at import time; this runs last so the totals below count all of it.
  await runAsync('a legacy split profile keeps its fixtures across a relaunch',
    relaunchKeepsFixtures);

  console.log(`\nGame anchor ownership totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
};

void main();
