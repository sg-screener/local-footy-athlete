import { calendarActionsForTest } from './support/calendarActionsForTest';
/**
 * THE SESSION-LIST COMBINATION MATRIX — day type × domains carried.
 *
 * WHY THIS EXISTS (2026-08-04). The walker's `L-P3 TEMPLATE = PROJECTION` law
 * had four declared reds, each pinning ONE shape of disagreement. Then a deep
 * walk found a day exhibiting TWO AT ONCE — a team night carrying conditioning
 * AND strength, rendering as `support` and the team banner — and it matched
 * none of them, because the offence string names the whole per-day
 * disagreement and no single-shape regex can match a compound one.
 *
 * That is L11's stop-rule verbatim: **the moment two defects differ only by
 * their combination coordinates, the space needs enumerating rather than
 * another single fix.** Four single shapes were declared; nobody had asked
 * which COMBINATIONS of them are reachable. This matrix asks.
 *
 * WHAT IT IS NOT. Not a fix. It changes no classifier and widens no regex —
 * L13 stands, cells go red by walking further, never by asking less. Its whole
 * job is to name coordinates, so the owners who eventually pay
 * `buildSessionTemplate`/`sessionComponents` know the full shape of the bill
 * rather than one instance of it.
 *
 * FIXTURE LAW. Every world here is REACHED BY ACTING — real onboarding, real
 * generation, the real accept boundary, and the real `applyPlanChange` door.
 * No hand-built workouts (AGENTS.md: "a fixture whose input could never have
 * existed proves something false").
 *
 * COVERAGE HONESTY. The census at the end prints every coordinate REACHED and
 * every declared coordinate NOT reached. A matrix that quietly covers less
 * than it claims is the failure it exists to prevent.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

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
  throw new Error('the combination matrix never reaches the network');
};

import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { generateProgramLocally } from '../services/api/generateProgram';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { applyPlanChange, type PlanChange } from '../utils/planChangeProducer';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { project } from '../rules/projectVisibleWeek';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import {
  sessionTemplateKinds,
  projectionContentKinds,
  templateProjectionDisagreement,
  templateProjectionOffence,
  rowCompositionCoordinate,
} from './support/sessionListKinds';
import type { OnboardingData } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { VisibleWeek, VisibleDay, VisiblePart } from '../rules/visibleProjection';

// ── Harness plumbing ──────────────────────────────────────────────────────

let passed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL ${name}`);
    console.log(`      ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function quiet<T>(body: () => T): T {
  const log = console.log;
  const warn = console.warn;
  const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

const INSTALL_DAY = '2026-07-13';

function addDaysISO(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${
    String(parsed.getDate()).padStart(2, '0')}`;
}

// ── Reaching worlds by acting ─────────────────────────────────────────────

interface WorldSpec {
  id: string;
  seasonPhase: string;
  teamTrainingDays: string[];
  /** Day offset from the settled Monday to mark as a game, or null. */
  gameOffset: number | null;
}

const WORLDS: readonly WorldSpec[] = [
  {
    id: 'preseason-two-team-nights',
    seasonPhase: 'Pre-season',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    gameOffset: null,
  },
  {
    id: 'inseason-team-and-game',
    seasonPhase: 'In-season',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    gameOffset: 5,
  },
  {
    id: 'offseason-solo',
    seasonPhase: 'Off-season',
    teamTrainingDays: [],
    gameOffset: null,
  },
];

function profileFor(world: WorldSpec): OnboardingData {
  return {
    firstName: 'Matrix',
    gender: 'male',
    age: '24',
    position: 'Midfielder',
    experienceLevel: '2-5 years',
    heightCm: 184,
    weightKg: 90,
    motivation: 'Dominate your level',
    seasonPhase: world.seasonPhase,
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDays: world.teamTrainingDays,
    teamTrainingDaysPerWeek: world.teamTrainingDays.length,
    ...(world.gameOffset !== null ? { gameDay: 'Saturday' } : {}),
    trainingLocation: 'Full Gym',
    equipmentAnswer: {
      protocolVersion: 1,
      tags: {
        barbell: 'have', rack: 'have', dumbbells: 'have', bench: 'have',
        pullup_bar: 'have', cable: 'have', erg_bike: 'have',
      },
      modalities: {},
    },
    conditioningLevel: 'Elite',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.5x bodyweight+',
    squatConfidence: 'Confident',
    benchConfidence: 'Confident',
    twoKmTimeTrial: {
      seconds: 420,
      recordedOn: INSTALL_DAY,
      source: 'onboarding',
    },
    injuries: [],
    recentTrainingLoad: 'Very consistent',
    sprintExposure: 'Regularly',
    ...(world.seasonPhase === 'Off-season' ? { seasonFinishedOn: '2026-06-20' } : {}),
  } as unknown as OnboardingData;
}

let weekStart = INSTALL_DAY;
let todayISO = INSTALL_DAY;

function freshInstall(): void {
  localStorageData.clear();
  // The shared owner — see `support/freshInstallStores`. The first draft of
  // this suite wrote its own weaker reset and the second `commitRebuiltProgram`
  // of the run threw `AcceptedStateLedgerMismatchError` off leftover accepted
  // state, which is precisely why that owner exists.
  resetStoresToFreshInstall('combination_matrix:fresh-install');
  weekStart = INSTALL_DAY;
  todayISO = INSTALL_DAY;
}

/** Onboard + generate + accept, exactly as the walker's own doors do. */
function reachWorld(world: WorldSpec): void {
  freshInstall();
  const profile = profileFor(world);
  useProfileStore.getState().updateOnboardingData(profile);
  const completion = useProfileStore.getState().completeOnboarding();
  assert(!(completion && typeof completion === 'object'
    && (completion as { ok?: boolean }).ok === false),
  `${world.id}: matrix fixture no longer completes onboarding — ${JSON.stringify(completion)}`);
  const program = quiet(() => generateProgramLocally(
    useProfileStore.getState().onboardingData,
    {
      todayISO: INSTALL_DAY,
      previousProgram: null,
      seasonPhaseClock: {
        protocolVersion: 1,
        selectedPhase: world.seasonPhase as never,
        phaseEntryWeekStartISO: INSTALL_DAY,
        originProvenance: 'explicit_user_phase_change',
        persistenceProvenance: 'preserved_persisted_state',
      },
    },
  )) as { microcycles: { startDate: string }[] };
  const settled = program.microcycles[1] ?? program.microcycles[0];
  weekStart = settled.startDate.slice(0, 10);
  todayISO = weekStart;
  if (world.gameOffset !== null) {
    calendarActionsForTest().setGameDay(addDaysISO(weekStart, world.gameOffset), todayISO);
    useProgramStore.setState({
      acceptedMaterialContext: {
        ...useProgramStore.getState().acceptedMaterialContext,
        markedDays: useCalendarStore.getState().markedDays ?? {},
      },
    } as never);
  }
  quiet(() => commitRebuiltProgram(
    program as never,
    { preserve: [], clear: [], conflictsRemoved: [] },
    {
      markedDays: useCalendarStore.getState().markedDays ?? {},
      selectedDate: todayISO,
      reason: 'combination_matrix:generate',
    },
  ));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
}

function visibleWeek(): ResolvedDay[] {
  return quiet(() => buildProgramTabProjectedWeek({
    todayISO,
    mondayISO: weekStart,
    state: buildScheduleStateImperative() as never,
  })) as ResolvedDay[];
}

// ── The coordinate space ──────────────────────────────────────────────────

type DayType = 'plain' | 'team_night' | 'game_day' | 'g_minus_1' | 'g_plus_1';

/**
 * The day's TYPE — its anchor situation, which is what decides who composes it.
 * Read from the projection's own parts, never from a title regex.
 */
function dayTypeOf(parts: readonly VisiblePart[], date: string, gameDate: string | null): DayType {
  const kinds = new Set(parts.map((part) => String(part.kind)));
  if (kinds.has('game')) return 'game_day';
  if (kinds.has('team_training')) return 'team_night';
  if (gameDate && date === addDaysISO(gameDate, -1)) return 'g_minus_1';
  if (gameDate && date === addDaysISO(gameDate, 1)) return 'g_plus_1';
  return 'plain';
}

/** The domains the day CARRIES, per the projection (the day-type marker removed). */
function domainsOf(parts: readonly VisiblePart[]): string[] {
  return projectionContentKinds(parts)
    .filter((kind) => kind !== 'team_training')
    .sort();
}

function coordinateOf(dayType: DayType, domains: string[]): string {
  return `${dayType} × [${domains.join(',')}]`;
}

/**
 * Coordinates whose disagreement is ALREADY OWNED by a declared red on the
 * walker's `L-P3 TEMPLATE = PROJECTION` law. Listed here so this matrix can be
 * gated green while the classifiers still owe the fix — the same discipline
 * the walker's DECLARED_RED list uses, and subject to the same ratchet: a
 * containment that stops being needed FAILS this suite (block [3]).
 *
 * Each entry names the walker entry that owns it. Nothing is contained here
 * that is not already declared there.
 */
interface ContainedCoordinate {
  /** Matches `coordinateOf(...)`. */
  coordinate: string;
  ownedBy: string;
  why: string;
}

const CONTAINED: readonly ContainedCoordinate[] = [
  // RETIRED 2026-08-06 — `team_night × [conditioning]`, owned by
  // `session_list_drops_conditioning_attached_to_an_appointment`.
  //
  // The owning declared red was PAID and deleted by the D13 composition unit:
  // `buildSessionTemplate` is driven by the day's PARTS rather than by two
  // `workoutType` predicates, so a team night carrying conditioning emits its
  // conditioning rows and `isCombinedDay` is gone. The coordinate now AGREES,
  // and block [2] is precisely the ratchet that says so — a containment that
  // stops being needed FAILS rather than lingering as false debt.
  //
  // Retired here one commit late: the payment deleted the walker entry and left
  // its two dependants (this containment and the blind spot below) pointing at
  // a red that no longer exists, which is what block [3] caught.

  // RETIRED 2026-08-24 — every Midline/support containment. Midline now maps
  // to the Strength session on both sides of this comparison, and this
  // matrix's stale-debt cell proved the former declarations no longer held.
];

/**
 * DEFECTS THIS COORDINATE SYSTEM CANNOT NAME.
 *
 * The honest limit of `day type × domains carried`. Listed so the next owner
 * knows the axes are incomplete rather than discovering it the way this run
 * did.
 */
interface BlindSpot {
  declaredRed: string;
  coordinate: string;
  /**
   * The THIRD-AXIS coordinate (`rowCompositionCoordinate`) the defect actually
   * lives at — measured, not inferred. The non-vacuity contract below holds
   * this honest: while the matrix cannot build this composition the entry is a
   * blind spot; the moment it builds it, the entry must either promote to
   * CONTAINED (it disagrees, cell [5]) or be re-measured (it agrees, cell [6]).
   */
  failingComposition: string;
  why: string;
}

const BLIND_SPOTS: readonly BlindSpot[] = [
  // RETIRED 2026-08-06 — `team_night × [conditioning,strength]`, which named
  // `session_list_drops_conditioning_attached_to_an_appointment`.
  //
  // The blind spot described a `block_no_flag` team night: a `conditioningBlock`
  // naming the rows while `hasCombinedConditioning` was off, which the template
  // dropped because it keyed conditioning emission off the FLAG while the
  // component owner keyed off the BLOCK ids. The D13 composition unit removed
  // that divergence at its source — the template now reads the day's PARTS, so
  // there is no flag-vs-block disagreement left for the composition to expose —
  // and the declared red this entry pointed at was deleted with it.
  //
  // Its former support sibling was paid and retired on 2026-08-24 when
  // Midline ceased to be a session identity.
];


interface Observation {
  world: string;
  date: string;
  coordinate: string;
  /** The third axis — `rowCompositionCoordinate` of the day's resolved workout. */
  composition: string;
  offence: string | null;
}

const observations: Observation[] = [];

function observeWorld(world: WorldSpec): void {
  reachWorld(world);
  const gameDate = world.gameOffset === null ? null : addDaysISO(weekStart, world.gameOffset);
  const week = visibleWeek();
  const words = quiet(() => project({ week: week as never, weekStart })) as VisibleWeek;
  for (const day of week) {
    const visibleDay = words.days.find((candidate) => candidate.date === day.date);
    if (!visibleDay) continue;
    const domains = domainsOf(visibleDay.parts);
    const dayType = dayTypeOf(visibleDay.parts, day.date, gameDate);
    const disagreement = templateProjectionDisagreement(
      quiet(() => sessionTemplateKinds(day.workout)),
      projectionContentKinds(visibleDay.parts),
    );
    observations.push({
      world: world.id,
      date: day.date,
      coordinate: coordinateOf(dayType, domains),
      composition: quiet(() => rowCompositionCoordinate(day.workout)),
      offence: disagreement ? templateProjectionOffence(day.date, disagreement) : null,
    });
  }
}

/**
 * WIDEN BY ACTING. Generation alone reaches the combinations it happens to
 * build; the athlete reaches more by stacking. For every day the week offers,
 * try each add category through the REAL door and re-observe whatever the day
 * became. Refusals are expected and are not failures — a door that refuses is
 * a coordinate the athlete cannot reach, which is exactly what this matrix
 * wants to know.
 */
const ADD_CATEGORIES = [
  'strength_full', 'conditioning_hard', 'conditioning_light', 'gunshow', 'mobility',
] as const;

function widenByStacking(world: WorldSpec): void {
  const gameDate = world.gameOffset === null ? null : addDaysISO(weekStart, world.gameOffset);
  for (const category of ADD_CATEGORIES) {
    reachWorld(world);
    const week = visibleWeek();
    for (const day of week) {
      const outcome = quiet(() => applyPlanChange({
        change: { kind: 'add_category', date: day.date, category } as PlanChange,
        visibleWeek: visibleWeek() as never,
        todayISO,
        applyOverride: () => {
          throw new Error('the matrix never routes an athlete add through the override surface');
        },
      }));
      if (outcome.outcome !== 'applied') continue;
      const after = visibleWeek();
      const words = quiet(() => project({ week: after as never, weekStart })) as VisibleWeek;
      const visibleDay = words.days.find((candidate) => candidate.date === day.date);
      const resolved = after.find((candidate) => candidate.date === day.date);
      if (!visibleDay || !resolved) continue;
      const disagreement = templateProjectionDisagreement(
        quiet(() => sessionTemplateKinds(resolved.workout)),
        projectionContentKinds(visibleDay.parts),
      );
      observations.push({
        world: `${world.id}+add:${category}`,
        date: day.date,
        coordinate: coordinateOf(
          dayTypeOf(visibleDay.parts, day.date, gameDate),
          domainsOf(visibleDay.parts),
        ),
        composition: quiet(() => rowCompositionCoordinate(resolved.workout)),
        offence: disagreement ? templateProjectionOffence(day.date, disagreement) : null,
      });
    }
  }
}

// ── The matrix ────────────────────────────────────────────────────────────

console.log('-- Session-list combination matrix (day type × domains carried) --');

for (const world of WORLDS) {
  observeWorld(world);
  widenByStacking(world);
}

const reached = new Map<string, Observation[]>();
for (const observation of observations) {
  const bucket = reached.get(observation.coordinate) ?? [];
  bucket.push(observation);
  reached.set(observation.coordinate, bucket);
}

const containedFor = (coordinate: string): ContainedCoordinate | undefined =>
  CONTAINED.find((entry) => entry.coordinate === coordinate);

run('[1] every reached coordinate agrees, except the declared ones', () => {
  const undeclared = [...reached.entries()]
    .filter(([coordinate, entries]) =>
      entries.some((entry) => entry.offence) && !containedFor(coordinate))
    .map(([coordinate, entries]) => {
      const example = entries.find((entry) => entry.offence)!;
      return `\n      ${coordinate}\n        (${example.world}) ${example.offence}`;
    });
  assert(undeclared.length === 0,
    'coordinates disagree with no declared owner — declare them or fix the owners, '
    + `never widen a regex to swallow them:${undeclared.join('')}`);
});

run('[2] every declared coordinate that was reached still disagrees', () => {
  // The stale-debt ratchet. A containment whose coordinate now AGREES is debt
  // that was paid without the list being updated, and it must not go on
  // claiming the space.
  const stale = CONTAINED
    .filter((entry) => {
      const entries = reached.get(entry.coordinate);
      return !!entries && entries.length > 0 && entries.every((seen) => !seen.offence);
    })
    .map((entry) => `${entry.coordinate} (owned by ${entry.ownedBy})`);
  assert(stale.length === 0,
    `a contained coordinate now AGREES — retire the containment: ${stale.join('; ')}`);
});

run('[3] every containment and blind spot names a walker declared red that still exists', () => {
  // No containment may invent its own excuse. Each must point at an entry on
  // the walker's DECLARED_RED list, which carries the why/paidBy/expiresWhen.
  // Blind spots are held to the same standard: an unnameable coordinate is
  // only honest if the defect it cannot name is declared somewhere real.
  const walkerSource = require('fs').readFileSync(
    require('path').join(__dirname, 'athleteActionWalkerTests.ts'), 'utf8') as string;
  const orphans = [
    ...CONTAINED.map((entry) => ({ label: entry.coordinate, id: entry.ownedBy })),
    ...BLIND_SPOTS.map((entry) => ({ label: `blind spot ${entry.coordinate}`, id: entry.declaredRed })),
  ]
    .filter((entry) => !walkerSource.includes(`id: '${entry.id}'`))
    .map((entry) => `${entry.label} → ${entry.id}`);
  assert(orphans.length === 0,
    `containment points at no declared red: ${orphans.join('; ')}`);
});

run('[5] a blind spot is a coordinate that AGREES here — not a silent failure', () => {
  // Guards the honesty of the list above. If a blind-spot coordinate starts
  // disagreeing in this matrix, it is no longer a blind spot: it is reachable,
  // and it must move to CONTAINED with its own entry.
  const nowReachable = BLIND_SPOTS
    .filter((entry) => (reached.get(entry.coordinate) ?? []).some((seen) => seen.offence))
    .map((entry) => entry.coordinate);
  assert(nowReachable.length === 0,
    'a blind-spot coordinate now disagrees here — promote it to CONTAINED: '
    + nowReachable.join('; '));
});

run('[6] a blind spot states the composition it cannot build — and is held to it', () => {
  // THE NON-VACUITY CONTRACT (stage 1 report §4a proposal 2, implemented
  // stage 2). A blind spot is only honest while the world this matrix builds
  // genuinely cannot exhibit the defect. Each entry now states the MEASURED
  // third-axis composition its defect lives at, and this cell checks the claim
  // against the world actually built: if the failing composition was reached
  // and AGREED, the blind spot's characterisation is falsified — re-measure it
  // (the walker seam is `WALKER_LOG_LP3=1`), do not leave a stale claim
  // standing. (Reached-and-disagreeing is cell [5]'s promotion.)
  const falsified = BLIND_SPOTS
    .filter((entry) => (reached.get(entry.coordinate) ?? []).some((seen) =>
      seen.composition === entry.failingComposition && !seen.offence))
    .map((entry) => `${entry.coordinate} @ ${entry.failingComposition}`);
  assert(falsified.length === 0,
    'a blind spot\'s declared failing composition was reached here and AGREED — '
    + `the characterisation is stale, re-measure it: ${falsified.join('; ')}`);
  // And the claim must be a real third-axis coordinate, not free prose.
  const malformed = BLIND_SPOTS
    .filter((entry) => !/^roles=\[.*\] buckets=\[.*\] cond=\w+$/.test(entry.failingComposition))
    .map((entry) => entry.coordinate);
  assert(malformed.length === 0,
    `a blind spot's failingComposition is not a rowCompositionCoordinate: ${malformed.join('; ')}`);
});

run('[4] the matrix actually reached a spread of coordinates', () => {
  // Non-vacuity. A matrix that reached one day type proves nothing about a
  // combination space.
  const dayTypes = new Set([...reached.keys()].map((key) => key.split(' × ')[0]));
  assert(reached.size >= 6,
    `only ${reached.size} coordinates reached — the matrix is not exploring`);
  assert(dayTypes.size >= 3,
    `only ${dayTypes.size} day types reached (${[...dayTypes].join(', ')})`);
});

// ── Coverage census — printed, never silently capped ──────────────────────

console.log(`\n  Coordinates reached: ${reached.size}`);
for (const [coordinate, entries] of [...reached.entries()].sort()) {
  const disagreeing = entries.filter((entry) => entry.offence).length;
  const contained = containedFor(coordinate);
  const verdict = disagreeing === 0
    ? 'agrees'
    : contained
      ? `DISAGREES (contained → ${contained.ownedBy})`
      : 'DISAGREES — UNDECLARED';
  console.log(`    ${coordinate.padEnd(46)} ${String(entries.length).padStart(3)} obs  ${verdict}`);
}

const declaredButUnreached = CONTAINED
  .filter((entry) => !reached.has(entry.coordinate))
  .map((entry) => entry.coordinate);
if (declaredButUnreached.length > 0) {
  console.log(`\n  NOT REACHED this run (declared, unproven here): ${
    declaredButUnreached.join('; ')}`);
}

console.log('\n  BLIND SPOTS — declared defects whose composition this matrix cannot build:');
for (const spot of BLIND_SPOTS) {
  const entries = reached.get(spot.coordinate) ?? [];
  console.log(`    ${spot.coordinate} (${entries.length} obs, all agreeing) → ${spot.declaredRed}`);
  console.log(`      defect lives at: ${spot.failingComposition}`);
  const compositions = new Map<string, number>();
  for (const entry of entries) {
    compositions.set(entry.composition, (compositions.get(entry.composition) ?? 0) + 1);
  }
  for (const [composition, count] of [...compositions.entries()].sort()) {
    console.log(`      reached instead: ${composition}  (${count} obs)`);
  }
}

console.log('\n  NOT COVERED: this matrix reaches day types and domain sets that '
  + 'GENERATION plus the ADD door produce. Move, swap and bin compose further '
  + 'combinations; bye weeks and optional weeks are not reached at all.');

console.log(`\nSession-list combination matrix totals: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) console.log(`FAILURES:\n  ${failures.join('\n  ')}`);
totalsPrinted(failures.length);
