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
import {
  executeFixtureMutationInMemory,
  executeFixtureMutationTransaction,
} from '../store/fixtureMutationTransaction';
import { runQuiescentBoot } from '../store/quiescentBoot';
import { applyPlanChange } from '../utils/planChangeProducer';

// ── The reproduction ledger ──────────────────────────────────────────────
interface DeclaredRed {
  id: string;
  finding: string;
  matches: RegExp;
  why: string;
  paidBy: string;
}

const DECLARED_RED: ReadonlyArray<DeclaredRed> = [
  // ── PAID BY OPTION A, DELETED 2026-08-05 (the ratchet's own rule) ────────
  //
  // `fixture-identity-1` lived here — the finding itself. Sam ruled option A
  // by existing law: a fixture decision never rebases from the week a
  // previous fixture built, so `buildFixtureProjection` drops the target
  // week's own published overlay from its rebase source. The feedback loop is
  // gone and add-then-remove is identity by construction. The cell stands as
  // a plain law now; a regression FAILS outright instead of wearing a
  // declaration.
  // ── PAID BY R5.3's V3 SWITCHOVER, DELETED 2026-08-06 (the ratchet's rule) ──
  //
  // `fixture-identity-3` and `fixture-identity-5` lived here. Both are now
  // plain laws: a regression FAILS outright instead of wearing a declaration.
  //
  // WHAT PAID THEM, and it took BOTH halves. (i) the fixture door stopped
  // publishing its replan into `weekScopedOverlays` and now deletes the target
  // week's overlay instead; (ii) `materialiseFixtureMarksForCandidate` — the
  // overlay every accepted commit wrote, boot included — is gone. Each half
  // alone was priced by mutation first and each alone was WRONG:
  //
  //   V1 = (i) only   cell 3 RED, cell 5 GREEN, Monday `Lower Body Strength|4`
  //   V2 = (ii) only  cell 3 RED, cell 5 1 of 7 RED, Monday `|7` then `|8`
  //   V3 = both       BOTH GREEN, Monday `Lower Squat|8`
  //
  // V1 IS THE NAMED TRAP: "the door settles by re-deriving" is R5.1's own
  // sentence and it greens cell 5 by moving the TAP DOWN to boot's wrong
  // answer — the athlete's Monday drops from eight exercises to four
  // immediately instead of at the next relaunch. A cell that asks the two
  // sides to AGREE cannot see that; it is `expectation-edited-to-match-the-
  // regression` wearing a green gate. Cells 5 and 6 below therefore pin WHICH
  // ANSWER IS RIGHT, not that the surfaces match each other.
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
    // R-130 made gender required with no default; the fixture predated it.
    firstName: 'Walker', gender: 'male', heightCm: 184, weightKg: 90,
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
  // 2026-08-26: the coordinate is "no fixture and no REQUIRED work on the
  // Saturday". While this suite was dead the optional-placement rules landed
  // and the world-builder's Saturday now carries an OPTIONAL Mobility session —
  // a rested day under THE REST LAW (§20.2), and still exactly the coordinate
  // Sam's finding needs. A literal REST|0 pin would refuse the modern world.
  assert(!before[5].includes('Game'),
    `the world-builder did not produce a fixture-free Saturday — got "${before[5]}". `
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
  // Same modern-world coordinate as cell 1 (optional Mobility is a rested day).
  assert(!before[5].includes('Game'),
    `the world-builder did not produce a fixture-free Saturday — got "${before[5]}"`);
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

// ── Cell 4: THE LIFE-FACT SURVIVES NOTHING IT SHOULD NOT ──────────────────

run('fixture-identity-4 removing the last fixture clears the athlete\'s '
  + 'calendar life-fact', () => {
  freshWorld();
  const saturday = addDaysISO(weekStart, 5);

  const added = fixtureDoor('add', saturday);
  assert(added.outcome !== 'impossible' && added.outcome !== 'no_change',
    `the fixture ADD did not land (outcome "${added.outcome}") — a different red`);
  assert(useCalendarStore.getState().markedDays?.[saturday] === 'game',
    'the fixture add did not record the calendar life-fact at all, so this cell '
    + 'cannot observe whether removing it clears it');

  const removed = fixtureDoor('remove', saturday);
  assert(removed.outcome !== 'impossible' && removed.outcome !== 'no_change',
    `the fixture REMOVE did not land (outcome "${removed.outcome}") — a different red`);

  // THE PERSISTED INPUT, not the accepted mirror. The mirror correctly says
  // the fixture is gone; the calendar store is what survives to R2's migration
  // and outlives the mirror at R5, so a stale mark here is the athlete's
  // removed game coming back later.
  const mark = useCalendarStore.getState().markedDays?.[saturday];
  assert(mark === undefined,
    `the athlete removed the fixture and the calendar life-fact still reads `
    + `"${mark}" on ${saturday}. The accepted mirror says it is gone, so the two `
    + 'owners of this fact disagree — and the mirror is the one that does not '
    + 'survive R5.');
});

// ── Cells 5 and 6: TWO DECISIONS, IN A STATED ORDER, AND A RELAUNCH ───────
//
// Cells 1-4 are synchronous because the in-memory twin is. These need the
// DURABLE door (only it appends to the ledger) and a real relaunch, so they
// get an async runner with the same bookkeeping.
//
// THE AXIS IS DECISION ORDER, NOT DECISION COUNT. The first cut of this cell
// named the missing coordinate as "the NUMBER of simultaneous decisions".
// Measured across five worlds on 2026-08-06, that is refuted: two of them hold
// two decisions and only one diverged.
//
//   W2  removal then fixture   tap vs relaunch 3 of 7   tap vs deriver 1 of 7
//   W2r fixture then removal   tap vs relaunch 0 of 7   tap vs deriver 3 of 7
//
// Same two decisions, different answers. The mechanism is exact: a fixture
// rides a PERSISTED life-fact, so boot applies it inside `commitRebuiltProgram`
// at position zero — before a single ledger entry replays. Boot always composed
// the fixture as the athlete's FIRST decision whatever the ledger said, and W2r
// agreed only because there it really was first. A relaunch does not re-order
// the ledger; it hoisted the one decision that rides a life-fact out of the
// ledger entirely. `quiescentBootTests` asserts this same law and passes,
// because ONE decision cannot express an order.
//
// Both orderings are pinned here permanently, against the deriver, so the
// coordinate can never go missing again.
//
// AND THE CORRECTION THIS COMMIT OWES: the deleted `fixture-identity-5` entry
// said "three engines, three answers". THAT COUNT WAS WRONG. Attribution by
// instrumented stacks (docs/R5_DELETION_SEQUENCE_2026-08-06.md (k)) found TWO
// PRODUCERS. `Lower Squat|8` is `resolveWeekWithConditioning`, the deriver, and
// it is invariant in every world at every stage. `Lower Squat|7` and
// `Lower Body Strength|4` were the SAME ENGINE at two different input states —
// both called `buildFixtureProjection` and both published through the one site
// — differing only in whether `userRemovalConstraints` was populated when the
// projection ran. Two producers, and this unit deleted the second.

async function runAsync(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
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
      console.log(`      ${message.split('\n').slice(0, 4).join('\n      ')}`);
      return;
    }
    failed += 1;
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.debug = () => {}; console.info = () => {};
  try { return await body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.debug = debug; console.info = info;
  }
}

/** The DURABLE fixture door — the only one that appends to the ledger. */
async function durableFixtureAdd(date: string): Promise<{ outcome?: string }> {
  return await quietAsync(async () => executeFixtureMutationTransaction({
    action: 'add',
    fixtureKind: 'practice_match',
    targetDate: date,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: {
      requestedBy: 'athlete',
      producer: 'tap',
      surface: 'program_tab',
      commandId: `fixture-identity:durable-add:${date}`,
    },
    todayISO,
  } as never)) as { outcome?: string };
}

/**
 * THE DERIVER'S OWN ANSWER, PINNED LITERALLY.
 *
 * `resolveWeekWithConditioning` is the deriver and this is its Monday: the
 * athlete's pre-fixture session, untouched, eight exercises. The fixture is on
 * the Saturday and the deriver never moves the Monday — measured invariant in
 * all five worlds of the R5.3 attribution, before and after boot, in both
 * orderings.
 *
 * It is pinned as a LITERAL on purpose. A cell that only asks its surfaces to
 * agree with each other greens when they agree on the WRONG week, which is
 * exactly what V1 was priced doing. This is the value they must agree ON.
 */
// Re-pinned 2026-08-26 while reviving the suite from R-130 fixture rot: the
// composer now names the day by its slug and authors 7 rows here. Verified
// against the pre-fix year-audit record (probe W10, 2026-08-26) so the new
// literal is the world as it stood BEFORE tonight's changes, not a laundered
// regression.
const DERIVED_MONDAY = 'lower_squat|7';

interface OrderedWorld {
  label: string;
  monday: string;
  wednesday: string;
  saturday: string;
  atTheTap: string[];
  deriver: string[];
  afterRelaunch: string[];
}

async function twoDecisionWorld(
  order: 'removal_then_fixture' | 'fixture_then_removal',
): Promise<OrderedWorld> {
  freshWorld();
  const monday = weekStart;
  const wednesday = addDaysISO(weekStart, 2);
  const saturday = addDaysISO(weekStart, 5);
  const label = order === 'removal_then_fixture' ? 'W2' : 'W2r';

  // The athlete clears a day, through the real door (it appends a
  // `plan_change` entry — the ledger needs both decisions in it).
  const clearTheWednesday = (): void => {
    const removal = quiet(() => applyPlanChange({
      change: { kind: 'remove_session', date: wednesday },
      visibleWeek: quiet(() =>
        resolveWeekWithConditioning(weekStart, buildScheduleStateImperative())),
      todayISO,
      applyOverride: () => {
        throw new Error('a removal must not use the single-date writer');
      },
    } as never)) as { ok: boolean; message?: string };
    assert(removal.ok,
      `${label}: the athlete's removal was REFUSED (${removal.message ?? 'no message'}) — `
      + 'this cell asserts nothing until both its own decisions land');
  };
  // A fixture, through the DURABLE door — the only one that appends.
  const addTheFixture = async (): Promise<void> => {
    const added = await durableFixtureAdd(saturday);
    assert(added.outcome !== 'impossible' && added.outcome !== 'no_change',
      `${label}: the fixture ADD did not land (outcome "${added.outcome}") — a different red`);
  };

  if (order === 'removal_then_fixture') {
    clearTheWednesday();
    await addTheFixture();
  } else {
    await addTheFixture();
    clearTheWednesday();
  }

  const atTheTap = derivedWeek();

  // THE DERIVER, ALONE: the same inputs with every stored week dropped. Life
  // facts, profile, program, overrides and removal constraints are untouched —
  // only published OUTPUT goes, which is cell 3's move on this world.
  const published = useProgramStore.getState().weekScopedOverlays;
  useProgramStore.setState({ weekScopedOverlays: {} } as never);
  const deriver = derivedWeek();
  useProgramStore.setState({ weekScopedOverlays: published } as never);

  await quietAsync(async () => { await runQuiescentBoot(); });
  const afterRelaunch = derivedWeek();

  return { label, monday, wednesday, saturday, atTheTap, deriver, afterRelaunch };
}

function assertOneComposer(world: OrderedWorld): void {
  // DECISION LOSS FIRST, so it reds as the worse finding rather than hiding
  // inside a composition diff.
  const wednesdayAfter = world.afterRelaunch[2];
  assert(wednesdayAfter === `${world.wednesday}=REST|0`,
    `${world.label}: the athlete's cleared Wednesday did not survive the relaunch — it `
    + `reads "${wednesdayAfter}". That is decision LOSS, a worse red than composition drift.`);

  // THE TRUTH THIS CELL MEASURES AGAINST, stated rather than inferred. If the
  // deriver itself moves, nothing below means what it says, so this fails
  // first and loudly.
  assert(world.deriver[0] === `${world.monday}=${DERIVED_MONDAY}`,
    `${world.label}: the DERIVER's own Monday reads "${world.deriver[0]}", not the pinned `
    + `"${world.monday}=${DERIVED_MONDAY}". The truth every other surface is measured `
    + 'against has moved; fix that before reading anything else in this cell.');
  assert(world.deriver[2] === `${world.wednesday}=REST|0`,
    `${world.label}: the DERIVER lost the athlete's cleared Wednesday — "${world.deriver[2]}". `
    + 'It cannot be the one composer if it drops a decision.');
  assert(!/=REST\|0$/.test(world.deriver[5] ?? ''),
    `${world.label}: the DERIVER left the athlete's fixture Saturday empty — `
    + `"${world.deriver[5]}". It cannot be the one composer if it drops a decision.`);

  // AND EACH SURFACE AGAINST THE DERIVER — never against the other one.
  const tapDrift = diffWeeks(world.deriver, world.atTheTap);
  assert(tapDrift.length === 0,
    `${world.label}: the week the athlete saw AT THE TAP disagrees with the deriver on `
    + `${tapDrift.length} of 7 days:\n      ${tapDrift.join('\n      ')}\n      `
    + 'A second composer is a second truth even when neither is wrong.');
  const relaunchDrift = diffWeeks(world.deriver, world.afterRelaunch);
  assert(relaunchDrift.length === 0,
    `${world.label}: the week AFTER THE RELAUNCH disagrees with the deriver on `
    + `${relaunchDrift.length} of 7 days:\n      ${relaunchDrift.join('\n      ')}\n      `
    + 'A relaunch decided nothing; it must compose the week the deriver composes.');
}

async function main(): Promise<void> {
  await runAsync('fixture-identity-5 removal THEN fixture: one composer, and it is the '
    + 'deriver', async () => {
    assertOneComposer(await twoDecisionWorld('removal_then_fixture'));
  });

  await runAsync('fixture-identity-6 fixture THEN removal: the same two decisions in the '
    + 'other order, and the same one composer', async () => {
    assertOneComposer(await twoDecisionWorld('fixture_then_removal'));
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
}

main().catch((error) => {
  console.error('fixture identity suite THREW outside a cell', error);
  totalsPrinted(failed + 1);
  process.exit(1);
});
