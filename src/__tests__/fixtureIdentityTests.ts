/**
 * THE FIXTURE IDENTITY LAW — R1 spine invariant, from Sam's 2026-08-05
 * fresh-install device pass.
 *
 *   ADD A FIXTURE, THEN REMOVE IT, AND THE WEEK IS WHAT IT WAS.
 *
 * Sam added a game to a rest Saturday and removed it again; the Saturday came
 * back as a strength-and-conditioning day. The pass otherwise PASSED — five
 * checks good, instant delete, fast identical relaunches — so this is the one
 * finding standing between R1 and R2.
 *
 * WHAT THE CELLS BELOW ESTABLISHED (all three reached by ACTING through the
 * real doors from a fresh install — no seeds, per the 2026-07-30 ruling):
 *
 * - It is NOT the deriver re-deciding a free Saturday against the rest law.
 *   Cell 2 drives the life-fact alone — markedDays game on, then off — with no
 *   stored week anywhere, and derivation returns the pre-add week BYTE FOR
 *   BYTE, rest Saturday included. The rest quota is correct and the engine is
 *   innocent. Derivation from the fact alone also produces the RIGHT fixture
 *   week going in (Game Day on the Saturday, the Friday session demoted), so
 *   the stored week is not carrying anything derivation cannot.
 *
 * - It is NOT ledger residue from the add/remove pair. The ledger holds
 *   exactly `fixture_add` then `fixture_remove`, and the quiescent boot
 *   replays them to the same wrong week the live world already had — boot is
 *   faithful, the defect is upstream of it.
 *
 * - It IS the stored week. `rebuildLocalWeek(scope:'weekOverlay')` publishes a
 *   materialised week into `weekScopedOverlays`, and the NEXT fixture
 *   mutation rebases from that same overlay (`buildFixtureProjection` ->
 *   `rebaseAcceptedEffectiveWeek({ surfaces: sourceSurfaces })`, where
 *   `sourceSurfaces` is the whole program store). So the remove does not
 *   restore the week; it re-repairs the week the ADD built, whose repair state
 *   then fills the freed Saturday. Dropping the week's own prior overlay
 *   before the remove — and changing nothing else — returns the pre-add week
 *   byte for byte. That single input is the whole defect.
 *
 * WHY THE REBASE EXISTS, so the fix is not mistaken for a simplification: it
 * is how a fixture change CONSERVES the athlete's other decisions in that week
 * (an added session, a swapped template). The overlay carries two things the
 * rebase cannot tell apart — the athlete's other decisions, which must
 * survive, and the previous fixture's own repair product, which must not.
 * That is an OWNERSHIP question, not a guard: under the north star the
 * conservation should come from replaying DECISIONS (the ledger, R1.1/R1.4a),
 * not from rebasing a stored OUTPUT. Cells 1 and 3 stay declared-red until
 * that owner is ruled; see docs/FIXTURE_IDENTITY_REASSESSMENT_2026-08-05.md.
 *
 * L12 — WHAT CATCHES THE NEXT ONE. Cell 3 is the general law behind cell 1's
 * instance: a published week must EQUAL the week derived from the same inputs.
 * Any future stored week that disagrees with derivation reds there, whether or
 * not a fixture is involved and whichever day it lands on.
 *
 * Run: npm run test:fixture-identity
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
  throw new Error('NETWORK DISABLED — this suite runs entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { OnboardingData, TrainingProgram } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { executeFixtureMutationInMemory } from '../store/fixtureMutationTransaction';

// ── The reproduction ledger ──────────────────────────────────────────────
interface DeclaredRed {
  id: string;
  finding: string;
  matches: RegExp;
  why: string;
  paidBy: string;
}

const DECLARED_RED: ReadonlyArray<DeclaredRed> = [
  {
    id: 'fixture-identity-1',
    finding: 'Add a game to a rest Saturday, remove it, and the Saturday '
      + 'comes back as a strength-and-conditioning day',
    matches: /add-then-remove is not identity/,
    why: 'The fixture door publishes a materialised week into '
      + '`weekScopedOverlays`, and the next fixture mutation rebases from that '
      + 'same overlay. The remove therefore re-repairs the week the add built '
      + 'instead of restoring the week that preceded it, and the carried-'
      + 'forward repair state fills the freed Saturday. Proven by isolation: '
      + 'dropping the week\'s own prior overlay before the remove, changing '
      + 'nothing else, returns the pre-add week byte for byte.',
    paidBy: 'the ownership ruling on what a fixture mutation may rebase from — '
      + 'the athlete\'s other decisions for that week must be conserved by '
      + 'REPLAYING the decision ledger, not by rebasing a stored week. '
      + 'docs/FIXTURE_IDENTITY_REASSESSMENT_2026-08-05.md.',
  },
  {
    id: 'fixture-identity-3',
    finding: 'A published week disagrees with the week derived from the same inputs',
    matches: /published week disagrees with derivation/,
    why: 'The general law behind cell 1. The add\'s published overlay and the '
      + 'week derived from the same inputs disagree on days the fixture never '
      + 'touched (the Monday session and the two team-night pairings), so the '
      + 'stored week is already an unfaithful copy of derivation BEFORE any '
      + 'second mutation compounds it.',
    paidBy: 'the same ruling; structurally by R5, when derive() has no rivals '
      + 'and there is no published week left to disagree.',
  },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];
const declaredRedHits = new Set<string>();

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const declared = DECLARED_RED.find(
      (entry) => name.startsWith(entry.id) && entry.matches.test(message),
    );
    if (declared) {
      declaredRedHits.add(declared.id);
      passed += 1;
      console.log(`  RED (declared: ${declared.id}) ${name}`);
      console.log(`      ${message.split('\n').slice(0, 3).join('\n      ')}`);
      return;
    }
    failed += 1;
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.debug = () => {}; console.info = () => {};
  try { return body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.debug = debug; console.info = info;
  }
}

function addDaysISO(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${
    String(parsed.getDate()).padStart(2, '0')}`;
}

const INSTALL_DAY = '2026-08-05';
let todayISO = INSTALL_DAY;
let weekStart = INSTALL_DAY;

/**
 * The walker's own profile shape (a completed onboarding — the product gates
 * the app on one, so a world that failed completion would be acting below the
 * door). Pre-season, five preferred training days Monday–Friday: the SATURDAY
 * IS A REST DAY BY DERIVATION, which is Sam's coordinate exactly.
 */
function restSaturdayProfile(): OnboardingData {
  return {
    firstName: 'Walker', heightCm: 184, weightKg: 90,
    seasonPhase: 'Pre-season',
    position: 'inside_mid',
    motivation: 'Dominate your level',
    goals: ['Build strength'],
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Moderate',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar',
      'cable_machine', 'hamstring_curl', 'knee_extension', 'bands'],
    experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.5x bodyweight+',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
        bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
        foam_roller: 'have', plyo_box: 'have',
      },
      modalities: {
        bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have',
      },
      answeredOn: INSTALL_DAY,
    },
  } as unknown as OnboardingData;
}

/** The visible week, as the athlete sees it, one line per day. */
function derivedWeek(): string[] {
  return quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()))
    .map((day) => `${day.date}=${day.workout?.name ?? 'REST'}|${
      day.workout?.exercises?.length ?? 0}`);
}

function diffWeeks(before: readonly string[], after: readonly string[]): string[] {
  const width = Math.max(before.length, after.length);
  const changed: string[] = [];
  for (let index = 0; index < width; index++) {
    if (before[index] !== after[index]) {
      changed.push(`${before[index] ?? '(absent)'}  ->  ${after[index] ?? '(absent)'}`);
    }
  }
  return changed;
}

/**
 * A FRESH INSTALL, ONBOARDED AND GENERATED — through the product's own accept
 * boundary (`commitRebuiltProgram`), never a raw setState beside it. A harness
 * that publishes state the accept boundary would have written differently is
 * the `harness-enters-below-the-door` failure this repo has named five times.
 */
function freshWorld(): void {
  todayISO = INSTALL_DAY;
  weekStart = INSTALL_DAY;
  localStorageData.clear();
  resetStoresToFreshInstall('fixture-identity:fresh-install');
  useProfileStore.getState().updateOnboardingData(restSaturdayProfile());
  const completion = useProfileStore.getState().completeOnboarding();
  if (completion && typeof completion === 'object'
    && (completion as { ok?: boolean }).ok === false) {
    throw new Error('world-builder: onboarding completion REFUSED — '
      + JSON.stringify((completion as { missingAnswers?: unknown }).missingAnswers));
  }
  const program = quiet(() => generateProgramLocally(
    useProfileStore.getState().onboardingData,
    {
      todayISO, previousProgram: null,
      seasonPhaseClock: {
        protocolVersion: 1,
        selectedPhase: 'Pre-season' as never,
        phaseEntryWeekStartISO: weekStart,
        originProvenance: 'explicit_user_phase_change',
        persistenceProvenance: 'preserved_persisted_state',
      },
    },
  )) as TrainingProgram;
  const settled = program.microcycles[1] ?? program.microcycles[0]!;
  weekStart = settled.startDate.slice(0, 10);
  todayISO = weekStart;
  quiet(() => commitRebuiltProgram(
    program,
    { preserve: [], clear: [], conflictsRemoved: [] },
    {
      markedDays: useCalendarStore.getState().markedDays ?? {},
      selectedDate: todayISO,
      reason: 'fixture-identity:generate',
    },
  ));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
}

/** The real fixture door — the one the game-day sheet calls. */
function fixtureDoor(
  action: 'add' | 'remove',
  date: string,
): { outcome: string; reason?: string } {
  const revision = useProgramStore.getState().acceptedMaterialContext.revision;
  return quiet(() => executeFixtureMutationInMemory({
    action,
    fixtureKind: 'practice_match',
    ...(action === 'add' ? { targetDate: date } : { sourceDate: date }),
    expectedAcceptedRevision: revision,
    source: {
      requestedBy: 'athlete',
      producer: 'tap',
      surface: 'program_tab',
      commandId: `fixture-identity:${action}:${date}`,
    },
    todayISO,
  })) as { outcome: string; reason?: string };
}

// ── Cell 1: THE LAW ───────────────────────────────────────────────────────

run('fixture-identity-1 add a fixture to a rest Saturday and remove it — '
  + 'the week is what it was', () => {
  freshWorld();
  const saturday = addDaysISO(weekStart, 5);
  const before = derivedWeek();
  assert(before[5] === `${saturday}=REST|0`,
    `the world-builder did not produce a rest Saturday — got "${before[5]}". `
    + 'This cell asserts nothing until its own coordinate holds.');

  const added = fixtureDoor('add', saturday);
  assert(added.outcome !== 'impossible' && added.outcome !== 'no_change',
    `the fixture ADD did not land (outcome "${added.outcome}": ${added.reason ?? ''}) `
    + '— a different red than the one declared here');

  const removed = fixtureDoor('remove', saturday);
  assert(removed.outcome !== 'impossible' && removed.outcome !== 'no_change',
    `the fixture REMOVE did not land (outcome "${removed.outcome}": ${removed.reason ?? ''}) `
    + '— a different red than the one declared here');

  const after = derivedWeek();
  const changed = diffWeeks(before, after);
  assert(changed.length === 0,
    `add-then-remove is not identity — ${changed.length} of 7 days differ after a `
    + `fixture was added and removed again:\n      ${changed.join('\n      ')}`);
});

// ── Cell 2: THE INNOCENCE PROOF ───────────────────────────────────────────

run('fixture-identity-2 the life-fact alone is identity — the deriver and the '
  + 'rest law are innocent', () => {
  freshWorld();
  const saturday = addDaysISO(weekStart, 5);
  const before = derivedWeek();
  assert(before[5] === `${saturday}=REST|0`,
    `the world-builder did not produce a rest Saturday — got "${before[5]}"`);
  assert(Object.keys(useProgramStore.getState().weekScopedOverlays).length === 0,
    'this cell requires a world with no stored week; one is already published');

  // THE FACT, AND NOTHING ELSE. No door, no rebuild, no overlay — the fixture
  // expressed purely as the life-fact the inputs schema says it is (§2 of the
  // rebuild plan). Set directly and deliberately: the point of this cell is to
  // exclude every writer BUT the fact.
  const markGame = (marks: Record<string, string>) => {
    useCalendarStore.setState({ markedDays: marks } as never);
    useProgramStore.setState({
      acceptedMaterialContext: {
        ...useProgramStore.getState().acceptedMaterialContext,
        markedDays: marks,
      },
    } as never);
  };

  markGame({ [saturday]: 'game' });
  const withFixture = derivedWeek();
  assert(withFixture[5] !== before[5],
    'derivation did not respond to the fixture fact at all — the Saturday is '
    + `unchanged at "${withFixture[5]}". The fact is not reaching the deriver.`);
  assert(/Game|Match/i.test(withFixture[5]),
    `derivation put "${withFixture[5]}" on the fixture Saturday instead of a fixture`);
  assert(Object.keys(useProgramStore.getState().weekScopedOverlays).length === 0,
    'derivation published a stored week; this cell must not write one');

  markGame({});
  const afterFact = derivedWeek();
  const changed = diffWeeks(before, afterFact);
  assert(changed.length === 0,
    'the life-fact alone is NOT identity — with no stored week anywhere, adding '
    + `and removing the fixture fact left ${changed.length} of 7 days changed:\n      `
    + `${changed.join('\n      ')}\n      If this cell ever reds, the deriver or the `
    + 'rest quota really did break, and cell 1 is no longer diagnosed.');
});

// ── Cell 3: THE GENERAL LAW (what catches the next one) ───────────────────

run('fixture-identity-3 a published week equals the week derived from the '
  + 'same inputs', () => {
  freshWorld();
  const saturday = addDaysISO(weekStart, 5);

  const added = fixtureDoor('add', saturday);
  assert(added.outcome !== 'impossible' && added.outcome !== 'no_change',
    `the fixture ADD did not land (outcome "${added.outcome}") — a different red`);
  const published = derivedWeek();

  // The same inputs, derived with the stored week removed. Life-facts, profile
  // and program are untouched; only the published OUTPUT is dropped.
  const overlays = useProgramStore.getState().weekScopedOverlays;
  assert(Object.keys(overlays).length > 0,
    'the fixture door published no week at all — this cell has nothing to compare');
  useProgramStore.setState({ weekScopedOverlays: {} } as never);
  const derived = derivedWeek();

  const changed = diffWeeks(published, derived);
  assert(changed.length === 0,
    `the published week disagrees with derivation over the same inputs on `
    + `${changed.length} of 7 days:\n      ${changed.join('\n      ')}\n      `
    + 'A stored week that is not what derivation would produce is a second truth, '
    + 'and cell 1 is what happens when a later decision rebases from it.');
});

console.log(`\nFixture identity totals: ${passed} passed, ${failed} failed`);

// THE RATCHET DIRECTION: a declared red that no longer reds is a cell that
// went green, and the commit that turned it green owes the deletion.
const stale = DECLARED_RED.filter((entry) => !declaredRedHits.has(entry.id));
if (stale.length > 0) {
  console.error(`DECLARED RED NO LONGER REDS — delete the entry:\n  ${
    stale.map((entry) => `${entry.id} (paid by ${entry.paidBy})`).join('\n  ')}`);
  totalsPrinted(failed + stale.length);
  process.exit(1);
}

totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
