/**
 * THE PAPER PHONE — SEAT_INBOX item 65, seat `printer`, 2026-08-13.
 *
 *   npm run print:week          (or: npx sucrase-node scripts/print-week.ts)
 *
 * Runs the REAL generator offline and writes six plain-English markdown files
 * to `docs/printed-weeks/`. Sam reads them on his phone and says "that week is
 * wrong because X". That is the whole point: every ruling this repo landed was
 * verified by a suite, and a suite can tell you a slot is empty but it cannot
 * tell you a week is shit.
 *
 * ## IT PRINTS THE APP'S OWN CHAIN, NOT A SECOND ONE
 *
 * `useSchedule.ts:projectWeekFor` is the app's read path. This mirrors it:
 *
 *   1. `generateProgramLocally` — the deterministic, no-network generator the
 *      app itself runs for every rebuild. Not a test fixture, not a plan
 *      builder called directly: the same function the Rebuild button calls.
 *   2. `buildProgramTabProjectedWeek` — the resolver + projection the Program
 *      tab reads.
 *   3. `project()` — THE ONE CANONICAL PROJECTION. Every athlete-visible string
 *      it returns is `SignedCopy`.
 *
 * ## ⚠ NOT ONE WORD IN THE OUTPUT IS WRITTEN BY THIS SCRIPT
 *
 * The SignedCopy law says athlete-facing words come from an authored source or
 * a Sam ruling, and `signedCopy()` THROWS rather than falling back. This script
 * does not catch that and paper over it — it catches it, records the id, and
 * prints `[NO COPY — the app has no words here]` in that slot. The count and the
 * id list at the foot of every file are the most valuable thing here: they are
 * exactly the words Sam still owes the app, measured rather than guessed.
 *
 * The one thing the script chooses is LAYOUT — headings, indentation, the order
 * of the days. Layout is not vocabulary.
 *
 * READ-ONLY AND OFFLINE. It generates, projects and writes markdown. It touches
 * no store, no network and no app file.
 *
 * ## ⚠ IF YOU ARE IMPORTING THIS MODULE, READ THIS FIRST
 *
 * `renderWeekAsPlainEnglish`, `projectWithGapsMarked` and `scheduleStateFor` are
 * exported for reuse (item 66 uses the first two;
 * `scripts/print-composer-completion-weeks.ts` — seat `core`, 2026-08-14 — uses
 * all three, and `scheduleStateFor` was made public FOR it rather than copied,
 * because a second hand-built `ScheduleState` is how the two harness bugs in the
 * docstring below were born the first time). Two things happen to the PROCESS
 * when you import them, and neither is visible to the compiler:
 *
 *   1. **`__DEV__` IS SET TO `false`**, below, at module scope — so it happens
 *      during your import and OVERWRITES an importer that set it `true`. That is
 *      correct for this script's own run and it is what the node suites do, but
 *      it is not correct for everyone: seat `sim` needs `__DEV__` true because
 *      `isDevE2EClockAvailable()` gates on it, and with it false `setDevE2EClock`
 *      returns null SILENTLY and every door reads the wall clock instead of the
 *      simulated one. **If you need it true, re-assert it after importing.**
 *   2. Nothing else. `main()` is guarded by `require.main === module`, so the
 *      import writes no files — see the guard at the foot for why that had to be
 *      said out loud.
 *
 * Both of those, and the missing `export` before them, were found by a SECOND
 * CALLER rather than by this file's own run or by the type system. That is the
 * standing hazard of a script that becomes a seam, and it is why this note is
 * here rather than in a status file.
 */

/* eslint-disable import/first */
// ⚠ **THE `declare global { var __DEV__ }` BLOCK IS GONE, AND NOTHING MOVED —
// IT WAS A DUPLICATE.** The tests project already declares `__DEV__`
// (`src/__tests__/sprintCreditEvidenceTests.ts:22` says so in as many words),
// so a second declaration is `TS2451: Cannot redeclare block-scoped variable`.
// It could not surface while this script was reachable only from its own run;
// `test:equipment-scopes` (2026-08-17) pulled it into the tests scope and the
// compiler found it immediately. The assignment below is the whole behaviour
// and is untouched.
//
// See the header: this WINS over an importer's own assignment. Deliberate for
// this script's run; re-assert on your side if you need it true.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import { generateProgramLocally } from '../src/services/api/generateProgram';
import { buildProgramTabProjectedWeek } from '../src/utils/visibleProgramReadModel';
import { project } from '../src/rules/projectVisibleWeek';
import { ownSeasonPhase, ownSeasonPhaseForGeneration } from '../src/rules/seasonPhaseOwner';
import { resolveProfileTargetWeekAvailability } from '../src/rules/fixtureConditionedAvailability';
import { profileCapacityBandOrNull } from '../src/utils/readiness';
import { resolveEquipmentAvailability } from '../src/utils/equipmentAvailability';
import {
  equipmentRequirementLabel,
  exerciseIsAvailableWith,
} from '../src/data/exerciseEquipmentRequirement';
import { displayReps } from '../src/rules/prescriptionDisplay';
import { weekRefusalSentences } from '../src/rules/projectionCopy';
import {
  UnsignedCopyError,
  registerSignedCopy,
  signedCopyEntry,
} from '../src/rules/signedCopy';
import {
  createTemporaryScheduleFact,
  composeTemporarySourceFactCompatibility,
  temporaryFactScope,
} from '../src/rules/temporarySourceFact';
import type { SeasonPhaseClock } from '../src/rules/seasonPhaseClock';
import type { VisibleDay, VisiblePart, VisibleWeek } from '../src/rules/visibleProjection';
import type { ResolvedDay } from '../src/utils/sessionResolver';
import type { DayOfWeek, OnboardingData, TrainingProgram } from '../src/types/domain';

// ═══════════════════════════════════════════════════════════════════════════
// THE GAP MARKER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WHAT GOES IN A SLOT THE APP HAS NO WORDS FOR.
 *
 * Item 65, verbatim: *"If the app shows nothing, print `[NO COPY — the app has
 * no words here]` and count how many times you had to."*
 *
 * ## WHY THIS IS REGISTERED INTO THE SHEET RATHER THAN CAUGHT PER FIELD
 *
 * `project()` composes a whole week and throws on the FIRST unsigned id, so a
 * try/catch around it yields one gap and hides every other. The ids themselves
 * are computed inside `project`'s private helpers — re-deriving them out here
 * would be a second naming authority, which is the exact defect the projection
 * exists to prevent.
 *
 * So the loop below runs `project()`, reads the id out of the `UnsignedCopyError`
 * it threw, registers THAT id — and only that id — carrying this marker, and
 * runs again. It converges on the full gap list, one id per pass, and the list
 * is printed. Nothing invents a word: the registered text says, in the output,
 * that there is no word.
 *
 * This mutation is process-local to a script that only writes markdown. Nothing
 * it registers is ever persisted, and the app is not changed.
 */
const NO_COPY = '[NO COPY — the app has no words here]';

const MAX_GAP_PASSES = 400;

/**
 * Run `project()`, filling every gap it hits with the marker. Returns both.
 *
 * EXPORTED FOR ITEM 66 (seat `sim`). Callers must use THIS rather than
 * `project()` directly: `project()` throws on the FIRST unsigned id, so a plain
 * try/catch yields one gap and hides the rest, and two callers counting gaps two
 * ways is two [NO COPY] numbers that disagree.
 */
export function projectWithGapsMarked(args: {
  week: Parameters<typeof project>[0]['week'];
  weekStart: string;
  /** Surface 5: the stored program, for its block-boundary explanation. */
  program?: Parameters<typeof project>[0]['program'];
}): { visibleWeek: VisibleWeek; gapIds: string[] } {
  const gapIds: string[] = [];
  for (let pass = 0; pass < MAX_GAP_PASSES; pass += 1) {
    try {
      return { visibleWeek: project(args), gapIds };
    } catch (err) {
      if (!(err instanceof UnsignedCopyError)) throw err;
      const id = /"([^"]+)"/.exec(err.message)?.[1];
      if (!id) throw err;
      if (signedCopyEntry(id)) {
        // Registered and still throwing means the throw was not this id — bail
        // rather than loop, because a silent spin is worse than a loud stop.
        throw err;
      }
      gapIds.push(id);
      registerSignedCopy([{
        id,
        source: 'sam_ruling',
        provenance:
          'NOT A WORD. scripts/print-week.ts marks a slot the signed-copy sheet '
          + 'does not cover, so the gap is printed and counted instead of being '
          + 'invented. Never persisted; process-local to the printer.',
        text: NO_COPY,
      }]);
    }
  }
  throw new Error(
    `print-week: still hitting unsigned copy after ${MAX_GAP_PASSES} passes — `
    + 'the gap list is not converging, which is itself the finding.',
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SIX ATHLETES
// ═══════════════════════════════════════════════════════════════════════════

const WEEK_MONDAY = '2026-08-10';

/**
 * A FULL GYM, so a thin week is never explained away by a missing rack. The
 * bodyweight scenario is the one that removes it, deliberately and alone.
 */
const FULL_GYM = {
  tags: {
    barbell: 'have', dumbbells: 'have', bench: 'have', rack: 'have',
    pullup_bar: 'have', bands: 'have', kettlebell: 'have', plyo_box: 'have',
    foam_roller: 'have', cables: 'have', machine: 'have', trap_bar: 'have',
  },
  // ⚠ `row`, NOT `rower`. `ConditioningEquipmentModality` is
  // `bike_erg | air_bike | row | ski | treadmill`, and the equipment resolver
  // passes an unrecognised word straight through rather than refusing it — so
  // `rower` reached selection as a machine that matches no authored template.
  // The athlete silently owned no rower, every off-leg candidate tied at one
  // machine (the bike), and a heavy lower day was paired with
  // `Continuous Aerobic Run`. A one-word fixture typo, and it read exactly like
  // a selection bug.
  modalities: { bike_erg: 'have', row: 'have', treadmill: 'have' },
  answeredOn: '2026-08-01',
} as const;

/**
 * DUMBBELLS AND A BENCH, NOTHING ELSE — the away athlete's real kit.
 *
 * Added 2026-08-17 for Sam's surface 4, and it exists because the week that was
 * ALREADY called "away" does not test it. `5-away-trip` writes a travel
 * SCHEDULE fact with a span and no unavailable dates — which is the right shape
 * for "I am away", and carries NO equipment subtraction at all, so that athlete
 * keeps a full gym including a rack and a leg press while supposedly living out
 * of a hotel. Measured, not assumed: `resolveEquipmentAvailability` returns all
 * fourteen tags for every day of that week.
 *
 * R-019 is the rule this encodes, verbatim: *"the athlete just removes the
 * equipment they don't have while on the trip"* — away is a SUBTRACTION from the
 * existing answer, so this is `FULL_GYM` minus the things a hotel does not have,
 * written out rather than computed so the week is reproducible.
 */
const DUMBBELLS_AWAY = {
  tags: {
    dumbbells: 'have', bench: 'have', bands: 'have', foam_roller: 'have',
  },
  modalities: { treadmill: 'have' },
  answeredOn: '2026-08-01',
} as const;

/** Bodyweight only. `tags: {}` IS the answer — see `equipmentAnswerTests` [3]:
 *  "an athlete who owns nothing gets bodyweight and nothing else". */
const BODYWEIGHT_ONLY = {
  tags: {},
  modalities: {},
  answeredOn: '2026-08-01',
} as const;

function athlete(overrides: Partial<OnboardingData>): OnboardingData {
  return {
    firstName: 'Sam',
    ageRange: '22-26',
    position: 'Midfielder',
    heightCm: 183,
    weightKg: 84,
    experienceLevel: 'Intermediate',
    squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
    twoKmTimeTrial: { seconds: 420, testedOn: '2026-07-20' },
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    goals: ['Get stronger', 'Run faster'],
    trainingLocation: 'Commercial gym',
    equipmentAnswer: FULL_GYM,
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Hard',
    ...overrides,
  } as unknown as OnboardingData;
}

const WEEKDAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** A clock that puts the target week at `phaseWeekNumber` inside its phase. */
function clockAtPhaseWeek(
  selectedPhase: 'Off-season' | 'Pre-season' | 'In-season',
  phaseWeekNumber: number,
): SeasonPhaseClock {
  const entry = new Date(`${WEEK_MONDAY}T12:00:00`);
  entry.setDate(entry.getDate() - (phaseWeekNumber - 1) * 7);
  return {
    protocolVersion: 1,
    selectedPhase,
    phaseEntryWeekStartISO: `${entry.getFullYear()}-${String(entry.getMonth() + 1)
      .padStart(2, '0')}-${String(entry.getDate()).padStart(2, '0')}`,
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  };
}

const DAY_NAME_TO_NUMBER: Readonly<Record<string, number>> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

/**
 * THE SAME `ScheduleState` `useScheduleState` HANDS THE PROJECTION.
 *
 * ⚠ THIS WAS THE PRINTER'S FIRST REAL BUG AND IT IS WORTH THE COMMENT. The
 * first run passed only `currentProgram` + `currentMicrocycle`, and Saturday came
 * out EMPTY on an in-season athlete whose answer was "Saturday". It read like the
 * generator had lost the game. It had not: the recurring fixture is derived by
 * `effectiveGameDatesAround` from `state.gameDay` / `state.usualGameDay` /
 * `state.seasonPhase`, and a state missing those three says "no games" rather
 * than failing. **An under-fed harness manufactures a defect that looks exactly
 * like a real one.** Every field the live adapter sets is set here, from the
 * app's own owners — the phase from `ownSeasonPhase`, the capacity band from
 * `profileCapacityBandOrNull`, the equipment from `resolveEquipmentAvailability`
 * — so nothing in the output is this script's idea of a default.
 */
export function scheduleStateFor(args: {
  profile: OnboardingData;
  program: TrainingProgram;
  todayISO: string;
  activeConstraints: readonly unknown[];
  temporarySourceFacts: readonly unknown[];
  markedDays: Readonly<Record<string, string>>;
}) {
  const preferred = args.profile.preferredTrainingDays ?? [];
  return {
    currentProgram: args.program,
    currentMicrocycle: args.program.microcycles[0] ?? null,
    manualOverrides: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    removalDecisions: [],
    temporarySourceFacts: args.temporarySourceFacts,
    markedDays: args.markedDays,
    athleteContext: {
      injuries: args.profile.injuries ?? [],
      equipmentTags: resolveEquipmentAvailability(
        args.profile, args.activeConstraints as never, args.todayISO,
      ),
      onboardingData: args.profile,
    },
    seasonPhase: ownSeasonPhase({ program: args.program, profile: args.profile }).phase,
    usualGameDay: args.profile.usualGameDay,
    gameDay: args.profile.gameDay,
    capacity: profileCapacityBandOrNull(args.profile),
    blockState: undefined,
    sessionFeedback: {},
    weightOverrides: {},
    availableDayNumbers: preferred.length > 0
      ? preferred.map((name) => DAY_NAME_TO_NUMBER[name]).filter((n) => n !== undefined)
      : undefined,
    activeInjury: null,
    activeConstraints: args.activeConstraints,
    modalityPreferences: {},
  };
}

export interface PrintScenario {
  readonly slug: string;
  readonly title: string;
  /** What Sam is being asked to judge in THIS week, in his words not the code's. */
  readonly whatToLookFor: string;
  readonly profile: OnboardingData;
  readonly phaseWeek: number;
  /** undefined = the profile's game day; null = a bye, no fixture at all. */
  readonly targetFixtureDay?: DayOfWeek | null;
  /**
   * The athlete's calendar marks. A BYE IS A MARK, not just a generation option
   * — `effectiveGameDatesAround` re-derives a virtual recurring fixture from
   * `gameDay` + In-season unless the day carries `'noGame'` or `'rest'`. Telling
   * generation `targetFixtureDay: null` and leaving the calendar empty produced
   * a week that was PLANNED as a bye and DISPLAYED with a Game Day on it — the
   * printer's second harness bug, and the second one that would have been filed
   * as an app defect.
   */
  readonly markedDays?: Readonly<Record<string, string>>;
  readonly awaySpan?: { from: string; until: string };
}

export const SCENARIOS: PrintScenario[] = [
  {
    slug: '1-early-off-season',
    title: 'Early off-season — week 1 back, no club, full gym',
    whatToLookFor:
      'Nothing here comes from the club. Is this a sane first week back — '
      + 'enough lifting, not too much running, and does it look like something '
      + 'you would actually walk into a gym and do?',
    profile: athlete({
      seasonPhase: 'Off-season',
      gameDay: undefined,
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      teamTrainingDaysPerWeek: 0,
      teamTrainingDays: [],
    }),
    phaseWeek: 1,
  },
  {
    slug: '2-deep-pre-season',
    title: 'Deep pre-season — six weeks in, three club nights, full gym',
    whatToLookFor:
      'This is the heaviest week the app ever writes. Is the running hard '
      + 'enough for six weeks into pre-season, and is there any day here you '
      + 'would refuse to do on top of three club nights?',
    profile: athlete({
      seasonPhase: 'Pre-season',
      gameDay: undefined,
      trainingDaysPerWeek: 6,
      preferredTrainingDays: [...WEEKDAYS, 'Saturday'],
      teamTrainingDaysPerWeek: 3,
      teamTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    }),
    phaseWeek: 6,
  },
  {
    slug: '3-in-season-two-team-nights',
    title: 'In-season — Saturday game, Tuesday and Thursday at the club',
    whatToLookFor:
      'The ordinary week, and the one that has to be right. Tuesday and '
      + 'Thursday are club nights and Saturday is the game. Is there anything '
      + 'on those days you would not do, and is Friday light enough?',
    profile: athlete({
      seasonPhase: 'In-season',
      gameDay: 'Saturday',
      trainingDaysPerWeek: 5,
      preferredTrainingDays: [...WEEKDAYS],
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Tuesday', 'Thursday'],
    }),
    phaseWeek: 8,
  },
  {
    slug: '4-bye-week',
    title: 'In-season bye — no game this Saturday',
    whatToLookFor:
      'Same athlete as file 3, with the game taken off. Does the week USE the '
      + 'bye — more work, a proper session on the Saturday — or does it just '
      + 'leave a hole where the game was?',
    profile: athlete({
      seasonPhase: 'In-season',
      gameDay: 'Saturday',
      trainingDaysPerWeek: 5,
      preferredTrainingDays: [...WEEKDAYS],
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Tuesday', 'Thursday'],
    }),
    phaseWeek: 8,
    targetFixtureDay: null,
    markedDays: { '2026-08-15': 'noGame' },
  },
  {
    slug: '5-away-trip',
    title: 'In-season, away all week — Wednesday to Sunday',
    whatToLookFor:
      'Same athlete as file 3, away from Wednesday. The club nights and the '
      + 'game are meant to come off and his OWN sessions are meant to stay. '
      + 'Compare it to file 3 side by side: what actually changed?',
    profile: athlete({
      seasonPhase: 'In-season',
      gameDay: 'Saturday',
      trainingDaysPerWeek: 5,
      preferredTrainingDays: [...WEEKDAYS],
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Tuesday', 'Thursday'],
    }),
    phaseWeek: 8,
    awaySpan: { from: '2026-08-12', until: '2026-08-16' },
  },
  {
    slug: '6-bodyweight-only',
    title: 'In-season with nothing but a floor — no gym at all',
    whatToLookFor:
      'The athlete owns no equipment. Every exercise here has to be doable in '
      + 'a hotel room or a park. Is any of it impossible without kit, and is '
      + 'there enough of it to be worth opening the app for?',
    profile: athlete({
      seasonPhase: 'In-season',
      gameDay: 'Saturday',
      trainingDaysPerWeek: 5,
      preferredTrainingDays: [...WEEKDAYS],
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Tuesday', 'Thursday'],
      equipmentAnswer: BODYWEIGHT_ONLY as unknown as OnboardingData['equipmentAnswer'],
    }),
    phaseWeek: 8,
  },
  {
    slug: '10-dumbbell-away',
    title: 'Away all week with dumbbells and a bench — the kit gap week',
    whatToLookFor:
      'Same athlete as file 3, away from Wednesday, and this time he has told '
      + 'the app what he actually has with him: dumbbells, a bench and bands. '
      + 'No barbell, no rack, no machines. Does the week still give him '
      + 'something worth doing, and does it TELL him what it could not give him '
      + 'because of the kit — or does it just quietly hand him different '
      + 'exercises and hope he does not notice?',
    profile: athlete({
      seasonPhase: 'In-season',
      gameDay: 'Saturday',
      trainingDaysPerWeek: 5,
      preferredTrainingDays: [...WEEKDAYS],
      teamTrainingDaysPerWeek: 2,
      teamTrainingDays: ['Tuesday', 'Thursday'],
      equipmentAnswer: DUMBBELLS_AWAY as unknown as OnboardingData['equipmentAnswer'],
    }),
    phaseWeek: 8,
    awaySpan: { from: '2026-08-12', until: '2026-08-16' },
  },
  // ── WC-136: the three weeks the conditioning-completion mission owes Sam ──
  {
    slug: '7-no-club-pre-season',
    title: 'Pre-season, NO club training — the app supplies all four exposures',
    whatToLookFor:
      'Nobody is running this athlete but us. Four conditioning exposures is '
      + 'the target and the game counts as one, so we owe three. One of them is '
      + 'meant to be genuinely HARD and to sit on an upper-body day, well clear '
      + 'of Saturday. Is the hard session hard enough, is it on the right day, '
      + 'and is the rest of the week easy enough to let you do it properly?',
    profile: athlete({
      seasonPhase: 'Pre-season',
      gameDay: 'Saturday',
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      teamTrainingDaysPerWeek: 0,
      teamTrainingDays: [],
    }),
    phaseWeek: 6,
  },
  {
    slug: '8-no-club-in-season',
    title: 'In-season, NO club training — sprint at G-3, nothing hard near the game',
    whatToLookFor:
      'Same athlete in-season. Because there is no club night, we owe the '
      + 'sprint ourselves, and it has to be Wednesday or earlier. Everything '
      + 'else stays easy — no hard running in a game week at all. Is Saturday '
      + 'still a day you would arrive fresh for?',
    profile: athlete({
      seasonPhase: 'In-season',
      gameDay: 'Saturday',
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      teamTrainingDaysPerWeek: 0,
      teamTrainingDays: [],
    }),
    phaseWeek: 6,
  },
  {
    slug: '9-later-off-season',
    title: 'Later off-season — the hard running comes back',
    whatToLookFor:
      'Week six of the off-season, no fixture. This is where real hard '
      + 'conditioning is supposed to reappear after the easy first fortnight. '
      + 'Is there a genuine hard session in here, is it the right kind of hard '
      + 'for this time of year, and is the rest of the week aerobic?',
    profile: athlete({
      seasonPhase: 'Off-season',
      gameDay: undefined,
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      // ⚠ ZERO CLUB NIGHTS. This fixture carried a Tuesday club night, which is
      // phantom team training in an off-season week and quietly supplied an
      // anchor the contract then counted. The approved off-season contract has
      // no club training in it; the app must supply the whole week itself, and
      // that is the only honest control for "later off-season".
      teamTrainingDaysPerWeek: 0,
      teamTrainingDays: [],
    }),
    phaseWeek: 6,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// RUNNING ONE SCENARIO THROUGH THE APP'S CHAIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The away trip, built the way the AWAY DOOR builds it.
 *
 * `HomeScreenV2`'s away sheet writes a `set_schedule_modifier` action, whose
 * executor calls `createTemporaryScheduleFact` with a WINDOW scope and
 * `scheduleKind: 'travel'` and NO unavailable dates (a span-shaped trip marks
 * no day unavailable — that is the difference between it and the door it
 * replaced). Generation then reads it back through
 * `composeTemporarySourceFactCompatibility`, which is the ONLY route a fact
 * takes into generation. Both halves here are the app's, so what prints is what
 * the athlete would get.
 */
function awayConstraintsFor(span: { from: string; until: string }, todayISO: string) {
  const fact = createTemporaryScheduleFact({
    observedDate: span.from,
    scope: temporaryFactScope({ kind: 'window', from: span.from, until: span.until }),
    scheduleKind: 'travel',
    unavailableDates: [],
    unavailableWeekdays: [],
    maxSessions: null,
    sourceActor: 'athlete',
    sourceSurface: 'away_this_week',
  } as Parameters<typeof createTemporaryScheduleFact>[0]);
  const compatibility = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: [fact],
    onDate: todayISO,
  });
  return { fact, compatibility };
}

export interface PrintedWeek {
  readonly scenario: PrintScenario;
  readonly program: TrainingProgram;
  /**
   * THE STORED ACCEPTED WEEK — what `project()` was actually handed.
   *
   * Exported 2026-08-17 for the athlete-visible projection guards, and the
   * distinction it carries is the whole reason they needed it: `program` is what
   * GENERATION produced, `weekDays` is what the RESOLVER accepted, and they are
   * not the same list. A bye week relocates a session, so a row can sit in the
   * resolved week under a date the generated microcycle never mentioned. A
   * conservation guard that compares the projection against `program` reads that
   * relocation as the projection inventing a row — measured, not imagined; it is
   * how the first draft of `athleteVisibleProjectionTests` failed.
   *
   * Sam's words are "stored accepted program -> visible projection". This is the
   * left-hand side.
   */
  readonly weekDays: readonly ResolvedDay[];
  readonly visibleWeek: VisibleWeek;
  readonly gapIds: readonly string[];
  /** What the athlete actually owns, resolved by the app's own equipment owner. */
  readonly equipmentTags: readonly string[];
}

export function runScenario(scenario: PrintScenario): PrintedWeek {
  const todayISO = WEEK_MONDAY;
  const away = scenario.awaySpan ? awayConstraintsFor(scenario.awaySpan, todayISO) : null;
  const activeConstraints = away ? [...away.compatibility.activeConstraints] : [];
  const temporarySourceFacts = away ? [away.fact] : [];
  const targetWeekAvailability = scenario.markedDays
    ? resolveProfileTargetWeekAvailability({
        profile: scenario.profile,
        weekStart: WEEK_MONDAY,
        markedDays: scenario.markedDays as never,
        activeConstraints: activeConstraints as never,
        ownedPhase: ownSeasonPhaseForGeneration(scenario.profile),
      })
    : undefined;

  const program = generateProgramLocally(scenario.profile, {
    todayISO,
    seasonPhaseClock: clockAtPhaseWeek(
      scenario.profile.seasonPhase as 'Off-season' | 'Pre-season' | 'In-season',
      scenario.phaseWeek,
    ),
    activeConstraints,
    temporarySourceFacts,
    previousProgram: null,
    ...(scenario.targetFixtureDay !== undefined
      ? { targetFixtureDay: scenario.targetFixtureDay }
      : {}),
    ...(targetWeekAvailability ? { targetWeekAvailability } : {}),
  } as Parameters<typeof generateProgramLocally>[1]);

  const weekDays = buildProgramTabProjectedWeek({
    mondayISO: WEEK_MONDAY,
    todayISO,
    state: scheduleStateFor({
      profile: scenario.profile,
      program,
      todayISO,
      activeConstraints,
      temporarySourceFacts,
      markedDays: scenario.markedDays ?? {},
    }) as unknown as Parameters<typeof buildProgramTabProjectedWeek>[0]['state'],
    overrideContexts: {},
    modalityPreferences: {},
  });

  const { visibleWeek, gapIds } = projectWithGapsMarked({
    week: weekDays,
    weekStart: WEEK_MONDAY,
    program,
  });
  const equipmentTags = resolveEquipmentAvailability(
    scenario.profile, activeConstraints as never, todayISO,
  );
  return { scenario, program, weekDays, visibleWeek, gapIds, equipmentTags };
}

/**
 * The signed refusal lines for a thrown error, or `[]` when it is not a typed
 * week refusal. Reads `findings` off `GeneratedWeekRefusedError`; every other
 * error is a real crash and is not dressed up as an athlete message.
 */
function refusalSentencesFor(err: unknown): readonly string[] {
  const findings = (err as { findings?: readonly { clause: string; severity: string }[] })?.findings;
  if (!Array.isArray(findings)) return [];
  return weekRefusalSentences(findings).map(String);
}

/** A refused week's page. Layout is the printer's; every sentence is signed. */
function renderRefusedWeek(args: {
  heading: string;
  intro: string;
  refusal: readonly string[];
  diagnostic: string;
}): string {
  const lines: string[] = [];
  lines.push(`# ${args.heading}`);
  lines.push('');
  lines.push(`**Week of ${dayHeading(WEEK_MONDAY)}.**`);
  lines.push('');
  lines.push(`**What to look for:** ${args.intro}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## THE APP REFUSED TO BUILD THIS WEEK');
  lines.push('');
  lines.push('This is exactly what the athlete is shown. There is no week behind it —');
  lines.push('not an empty one, not a rest week. Nothing was built.');
  lines.push('');
  for (const line of args.refusal) lines.push(`> ${line}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('**The typed reason underneath, for the seat — not shown to the athlete:**');
  lines.push('');
  lines.push('```');
  lines.push(args.diagnostic);
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// THE PAGE
// ═══════════════════════════════════════════════════════════════════════════

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function dayHeading(dateISO: string): string {
  const date = new Date(`${dateISO}T12:00:00`);
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * SOMETHING THE ATHLETE COULD NOT DO, OR COULD NOT READ.
 *
 * Item 65: *"If a value cannot be rendered in words an athlete would use, THAT
 * IS A FINDING — print it loudly rather than prettifying it."* So these are not
 * swallowed and they are not silently fixed. They print beside the line that
 * caused them and again at the foot of the page.
 */
interface PrintFinding {
  readonly date: string;
  readonly kind:
    | 'impossible_without_kit'
    | 'unreadable_prescription'
    | 'named_block_with_nothing_in_it';
  readonly line: string;
}

/**
 * PARTS THAT ARE ALLOWED TO CARRY NO EXERCISES.
 *
 * Team training and the fixture are APPOINTMENTS — the club runs them and the
 * app has nothing to list, so an empty row list is the correct answer. Every
 * other kind is work the plan chose for the athlete, and a plan that names a
 * block and then puts nothing in it has given them a heading to look at. The
 * distinction is the projection's own (`APPOINTMENT_COMPONENTS` in
 * `projectVisibleWeek`), read here by part kind rather than re-guessed.
 */
const PARTS_THAT_MAY_BE_EMPTY: ReadonlySet<string> = new Set(['team_training', 'game']);

/**
 * IS THIS EXERCISE POSSIBLE WITH WHAT THE ATHLETE OWNS?
 *
 * Asked of `exerciseIsAvailableWith` — the app's OWN equipment owner, the same
 * one generation filters with — never of a list this script keeps. It already
 * knows that Walking Lunges are fine unloaded (`BODYWEIGHT_CAPABLE`) and that a
 * Face Pull is not, so the answer is the app's, not the printer's opinion.
 */
function impossibleWithKit(name: string, equipmentTags: readonly string[]): string | null {
  if (equipmentTags.length === 0) return null;
  if (exerciseIsAvailableWith(name, equipmentTags as string[])) return null;
  // `equipmentRequirementLabel` and not a `join` here: the sheet now carries
  // OR-groups (Sam, 2026-08-14), and a raw join renders one as `barbell,dumbbells`.
  const label = equipmentRequirementLabel(name);
  return label && label !== 'nothing'
    ? `needs ${label}, which this athlete does not have`
    : 'the app says this athlete cannot do it with their equipment';
}

/**
 * A RANGE WHERE SAM'S OWN LAW SAYS ONE NUMBER.
 *
 * The prescription-display law (`rules/prescriptionDisplay.ts`, Bible `:4936`):
 * *"ranges remain the generation source, the athlete sees a single middle
 * number, logging assumes it."* His example: "3x8-12 is written as 3x10".
 *
 * `DayWorkoutScreenV2:2213` obeys it — `formatStrengthSetsReps` runs the numbers
 * through `displayReps`. `project()`, the projection that is supposed to be the
 * ONE authority, emits `row.prescription.sets_reps_range` instead. So the two
 * surfaces show the same set two different ways.
 *
 * Counted per page rather than marked per line: it is true of nearly EVERY
 * strength row, and a warning on all of them would bury the findings that are
 * about one exercise. The midpoint shown is `displayReps`'s own, so the "should
 * read" figure is the app's answer and not the printer's arithmetic.
 */
function rangeAgainstTheLaw(prescription: string): string | null {
  const match = /^(\d+)\s*×\s*(\d+)-(\d+)$/.exec(prescription.trim());
  if (!match) return null;
  const shown = displayReps(Number(match[2]), Number(match[3]));
  return shown === null ? null : `${match[1]} × ${shown}`;
}

function renderPart(
  part: VisiblePart,
  ctx: {
    date: string;
    equipmentTags: readonly string[];
    findings: PrintFinding[];
    ranges: { count: number; example: string | null };
  },
): string[] {
  const lines: string[] = [];
  lines.push(`**${part.headline}**`);
  if (part.detail) lines.push(part.detail);
  if (part.rows.length === 0) {
    lines.push('');
    if (PARTS_THAT_MAY_BE_EMPTY.has(part.kind)) {
      lines.push('_(the club runs this one — the app lists nothing for it)_');
    } else {
      lines.push(
        '_(no exercises listed)_  ⚠ **THIS BLOCK HAS A NAME AND NOTHING IN IT.**',
      );
      ctx.findings.push({
        date: ctx.date,
        kind: 'named_block_with_nothing_in_it',
        line: `"${part.headline}" is on the day with no exercises under it`,
      });
    }
    return lines;
  }
  lines.push('');
  for (const row of part.rows) {
    // `prescription` is nullable since 2026-08-17: a conditioning row shows its
    // AUTHORED dose lines instead, and a warm-up shows neither (R-049). The
    // printer renders what the projection carries and still invents nothing.
    let line = row.prescription ? `- ${row.name} — ${row.prescription}` : `- ${row.name}`;
    const impossible = impossibleWithKit(String(row.name), ctx.equipmentTags);
    if (impossible) {
      line += `  ⚠ **CANNOT BE DONE — ${impossible}.**`;
      ctx.findings.push({
        date: ctx.date,
        kind: 'impossible_without_kit',
        line: `${row.name} — ${impossible}`,
      });
    }
    // `1 × 1` is not a prescription an athlete can act on. The day screen
    // suppresses it deliberately (`formatConditioningRowPrescription` returns
    // '' for rep-based conditioning rows: "showing '1 reps' would be confusing
    // filler"); the projection prints it. Flagged, not tidied away.
    if (row.prescription && /^\s*1\s*×\s*1\s*$/.test(String(row.prescription))) {
      line += '  ⚠ **"1 × 1" IS NOT A PRESCRIPTION — how much of this, and how hard?**';
      ctx.findings.push({
        date: ctx.date,
        kind: 'unreadable_prescription',
        line: `${row.name} — the app says "1 × 1"`,
      });
    }
    const shouldRead = row.prescription
      ? rangeAgainstTheLaw(String(row.prescription))
      : null;
    if (shouldRead) {
      ctx.ranges.count += 1;
      if (!ctx.ranges.example) {
        ctx.ranges.example = `"${row.prescription}" should read "${shouldRead}"`;
      }
    }
    lines.push(line);
    // THE AUTHORED DOSE, ONE LINE EACH — Sam's chosen layout, 2026-08-17:
    // work, rest, sets/rounds and how long it takes, each on its own line. Every
    // one is `SignedCopy` off `data/conditioningTemplates.ts`; the printer
    // supplies the indentation and nothing else.
    for (const doseLine of row.dose) lines.push(`  - ${doseLine}`);
    if (row.cue) lines.push(`  - ${row.cue}`);
  }
  return lines;
}

function renderDay(
  day: VisibleDay,
  ctx: {
    equipmentTags: readonly string[];
    findings: PrintFinding[];
    ranges: { count: number; example: string | null };
  },
): string[] {
  const lines: string[] = [];
  lines.push(`## ${dayHeading(day.date)}`);
  lines.push('');
  lines.push(`### ${day.headline}`);
  lines.push('');
  // WHAT'S MISSING, AND WHY — Sam's surface 4. Every line is `SignedCopy` off
  // the day's own typed `composedGaps`; the printer supplies the eyebrow, which
  // is the same one `ComposedGapNotice` puts above these sentences on the day
  // screen. Printed BEFORE the work, because a week that could not train
  // something should say so before the athlete reads what it did give them.
  if (day.gaps.length > 0) {
    lines.push("**WHAT'S MISSING**");
    lines.push('');
    for (const gap of day.gaps) lines.push(`- ${gap}`);
    lines.push('');
  }
  if (day.parts.length === 0) {
    if (day.capabilities.refusal) lines.push(day.capabilities.refusal);
    else lines.push('_(nothing on this day)_');
    lines.push('');
    return lines;
  }
  for (const part of day.parts) {
    lines.push(...renderPart(part, { date: day.date, ...ctx }));
    lines.push('');
  }
  return lines;
}

/**
 * THE ONE RENDERER — projected week in, plain-English markdown out.
 *
 * EXPORTED BECAUSE ITEM 66 ASKED FOR IT, and item 66's order says so directly:
 * *"Pairs with item 65 — reuse its printer, do not write a second one."* The
 * synthetic athlete (seat `sim`) arrives at a projected week a different way —
 * out of lived-in accepted state rather than a fresh generation — and from
 * `project()` onward it is this exact function. Two renderers would produce two
 * [NO COPY] counts, and neither would be worth reading.
 *
 * IT TAKES A PROJECTED WEEK, NOT A PROFILE. Everything upstream — which athlete,
 * which week, how the state was reached — is the caller's. This owns layout and
 * the two loud checks, and nothing else.
 */
export function renderWeekAsPlainEnglish(args: {
  projected: VisibleWeek;
  heading: string;
  /** One line telling Sam what to judge in this week. Optional. */
  intro?: string;
  /** Gap ids from `projectWithGapsMarked`. Counted and listed at the foot. */
  noCopyIds?: readonly string[];
  /**
   * The athlete's resolved equipment, from `resolveEquipmentAvailability`. Pass
   * it and every row is checked against what they own; omit it and the check is
   * skipped rather than guessed.
   */
  equipmentTags?: readonly string[];
}): { markdown: string; noCopyCount: number; findings: readonly PrintFinding[] } {
  const gapIds = args.noCopyIds ?? [];
  const equipmentTags = args.equipmentTags ?? [];
  const findings: PrintFinding[] = [];
  const ranges = { count: 0, example: null as string | null };
  const lines: string[] = [];

  lines.push(`# ${args.heading}`);
  lines.push('');
  lines.push(`**Week of ${dayHeading(args.projected.weekStart)}.**`);
  lines.push('');
  if (args.intro) {
    lines.push(`**What to look for:** ${args.intro}`);
    lines.push('');
  }
  // WHAT CHANGED SINCE LAST BLOCK — surface 5. Signed sentences off the stored
  // `blockBoundaryExplanation`; empty (and silent) when the block moved no load,
  // which is the correct answer for a first block.
  if (args.projected.explanations.length > 0) {
    lines.push('**What changed since your last block:**');
    lines.push('');
    for (const sentence of args.projected.explanations) lines.push(`- ${sentence}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  for (const day of args.projected.days) {
    lines.push(...renderDay(day, { equipmentTags, findings, ranges }));
  }
  lines.push('---');
  lines.push('');

  lines.push('## Words the app does not have');
  lines.push('');
  if (gapIds.length === 0) {
    lines.push('None. Every word on this page came out of the app.');
  } else {
    const counts = new Map<string, number>();
    for (const id of gapIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    lines.push(
      `**${gapIds.length} thing${gapIds.length === 1 ? '' : 's'} on this week has `
      + `no wording written for it yet.** Wherever you see \`${NO_COPY}\` above, `
      + 'it is one of these:',
    );
    lines.push('');
    for (const id of [...counts.keys()].sort()) lines.push(`- \`${id}\``);
  }
  lines.push('');

  lines.push('## Things wrong with this week');
  lines.push('');
  if (ranges.count > 0) {
    lines.push(
      `**Every set on this page is written as a range — ${ranges.count} of them.** `
      + 'Your rule is that the athlete sees one middle number, not a range '
      + `(${ranges.example}). The day screen inside the app follows that rule; `
      + 'this list does not, so the same set is written two different ways '
      + 'depending on where you look at it.',
    );
    lines.push('');
  }
  if (findings.length === 0 && ranges.count === 0) {
    lines.push('Nothing the printer could detect. Judge the training itself.');
  } else if (findings.length > 0) {
    const impossible = findings.filter((f) => f.kind === 'impossible_without_kit');
    const unreadable = findings.filter((f) => f.kind === 'unreadable_prescription');
    if (impossible.length > 0) {
      lines.push(
        `**${impossible.length} exercise${impossible.length === 1 ? '' : 's'} the `
        + 'athlete has no equipment for:**',
      );
      lines.push('');
      for (const f of impossible) lines.push(`- ${dayHeading(f.date)} — ${f.line}`);
      lines.push('');
    }
    if (unreadable.length > 0) {
      lines.push(
        `**${unreadable.length} line${unreadable.length === 1 ? '' : 's'} that does `
        + 'not say how much work to do:**',
      );
      lines.push('');
      for (const f of unreadable) lines.push(`- ${dayHeading(f.date)} — ${f.line}`);
      lines.push('');
    }
    const empty = findings.filter((f) => f.kind === 'named_block_with_nothing_in_it');
    if (empty.length > 0) {
      lines.push(
        `**${empty.length} block${empty.length === 1 ? '' : 's'} with a name and no `
        + 'exercises:**',
      );
      lines.push('');
      for (const f of empty) lines.push(`- ${dayHeading(f.date)} — ${f.line}`);
      lines.push('');
    }
  }

  return { markdown: lines.join('\n'), noCopyCount: gapIds.length, findings };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE INDEX
// ═══════════════════════════════════════════════════════════════════════════

/**
 * THE FRONT PAGE, AND EVERY NUMBER ON IT IS DERIVED.
 *
 * ⚠ THIS EXISTS BECAUSE THE DELIVERABLE DID NOT CARRY ITS OWN HEADLINE. The
 * index was hand-written and listed the six files and nothing else, so *"0 [NO
 * COPY] across six weeks"* and *"seven exercises a bodyweight athlete cannot
 * do"* lived only in a status file, a commit message and the console — none of
 * which Sam opens. The most important thing the run found was reachable only by
 * opening file 6 and scrolling to its foot.
 *
 * Seat `sim` hit the identical defect on item 66 the same afternoon: their
 * cross-athlete headline could not be stated by any single per-athlete file, and
 * Sam had already been sent two of those files. **The class is: a finding that
 * lives beside the deliverable instead of inside it.**
 *
 * SO NOTHING HERE IS PROSE. Every count is computed from the run that just
 * happened, which is also why the blind-instrument arm below is worth having: a
 * hand-typed total stays confident after the thing it counted stops working.
 */
function renderIndex(printed: readonly {
  scenario: PrintScenario;
  noCopyCount: number;
  findings: readonly PrintFinding[];
}[]): string {
  const lines: string[] = [];
  const sessions = printed.length;
  const totalNoCopy = printed.reduce((n, p) => n + p.noCopyCount, 0);
  const all = printed.flatMap((p) => [...p.findings]);
  const impossible = all.filter((f) => f.kind === 'impossible_without_kit');

  lines.push('# Six real weeks, printed');
  lines.push('');
  lines.push('These are not mock-ups. Every word came out of the app\'s own program');
  lines.push('generator and the one projection the Program tab reads. Nothing was written');
  lines.push('by hand.');
  lines.push('');
  lines.push('```');
  lines.push('npm run print:week');
  lines.push('```');
  lines.push('');

  // THE BLIND-INSTRUMENT ARM. A zero here means the run produced nothing, and
  // every other number on the page would be a confident zero about nothing.
  if (sessions === 0) {
    lines.push('## ⚠ THE PRINTER PRODUCED NO WEEKS AT ALL');
    lines.push('');
    lines.push('Nothing below can be trusted. The run failed — do not read the');
    lines.push('counts as findings.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## What the run found');
  lines.push('');
  lines.push(`**${sessions} weeks printed.**`);
  lines.push('');
  if (totalNoCopy === 0) {
    lines.push(
      '**The app had words for everything — 0 blanks across all '
      + `${sessions} weeks.** Every name, heading and instruction an athlete `
      + 'would read came out of the app. Nothing was missing and nothing was '
      + 'invented to cover a gap.',
    );
  } else {
    lines.push(
      `**${totalNoCopy} places across ${sessions} weeks where the app has no `
      + 'wording yet.** Each one is marked in its own file and listed at the '
      + 'foot of that page.',
    );
  }
  lines.push('');
  if (impossible.length > 0) {
    lines.push(
      `**⚠ THE WORST THING HERE: ${impossible.length} exercises the athlete has no `
      + 'equipment for.** An athlete who says they own nothing is still told to '
      + 'do them. The app\'s own equipment check says no to every one:',
    );
    lines.push('');
    for (const f of impossible) lines.push(`- ${f.line}`);
    lines.push('');
  }
  lines.push(
    `**${all.length} problems in total** that the printer could detect by itself. `
    + 'Each file lists its own at the foot, under "Things wrong with this week".',
  );
  lines.push('');
  lines.push('It cannot tell whether the training is any GOOD. That is the reading.');
  lines.push('');

  lines.push('## The six');
  lines.push('');
  lines.push('| | Week | What it is testing | Problems |');
  lines.push('| --- | --- | --- | --- |');
  printed.forEach((p, i) => {
    lines.push(
      `| ${i + 1} | [${p.scenario.title.split(' — ')[0]}](${p.scenario.slug}.md) `
      + `| ${p.scenario.title.split(' — ')[1] ?? ''} | ${p.findings.length} |`,
    );
  });
  lines.push('');
  lines.push('Read 3 first — it is the week most athletes get most weeks. Then read 3');
  lines.push('and 5 side by side, and 3 and 4 side by side; those pairs are the same');
  lines.push('athlete with one thing changed.');
  lines.push('');
  lines.push('## ⚠ What these six weeks CANNOT tell you');
  lines.push('');
  lines.push('Every week here is freshly generated for an athlete with NO history. So');
  lines.push('none of it passes through progression, feedback or weight logging, and');
  lines.push('nothing here says whether the app responds to an athlete over time.');
  lines.push('That question is answered in `docs/simulated-changeover/`.');
  lines.push('');
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

const OUT_DIR = resolve(__dirname, '..', 'docs', 'printed-weeks');

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const printed: PrintedWeek[] = [];
  const failures: { slug: string; error: string }[] = [];

  let totalFindings = 0;
  const forIndex: {
    scenario: PrintScenario;
    noCopyCount: number;
    findings: readonly PrintFinding[];
  }[] = [];
  for (const scenario of SCENARIOS) {
    try {
      const result = runScenario(scenario);
      printed.push(result);
      const rendered = renderWeekAsPlainEnglish({
        projected: result.visibleWeek,
        heading: scenario.title,
        intro: scenario.whatToLookFor,
        noCopyIds: result.gapIds,
        equipmentTags: result.equipmentTags,
      });
      totalFindings += rendered.findings.length;
      forIndex.push({
        scenario,
        noCopyCount: rendered.noCopyCount,
        findings: rendered.findings,
      });
      writeFileSync(resolve(OUT_DIR, `${scenario.slug}.md`), rendered.markdown, 'utf8');
      console.log(
        `  wrote ${scenario.slug}.md — ${result.visibleWeek.days.length} days, `
        + `${rendered.noCopyCount} missing words, ${rendered.findings.length} findings`,
      );
      for (const f of rendered.findings) console.log(`      ${f.date}  ${f.line}`);
    } catch (err) {
      const error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      failures.push({ slug: scenario.slug, error });
      // A REFUSED WEEK IS A PAGE, NOT A MISSING FILE (Sam, 2026-08-17). The
      // printer used to log `FAILED <signature>` and write nothing, so the
      // athlete's side of a refusal could not be read at all — which is exactly
      // how the surface came to have no words. Now it writes what the athlete
      // would be shown, and the refusal's own diagnostic underneath it for the
      // seat.
      const refusal = refusalSentencesFor(err);
      if (refusal.length > 0) {
        writeFileSync(
          resolve(OUT_DIR, `${scenario.slug}.md`),
          renderRefusedWeek({ heading: scenario.title, intro: scenario.whatToLookFor, refusal, diagnostic: error }),
          'utf8',
        );
        console.error(`  REFUSED ${scenario.slug} — wrote the athlete's page — ${error}`);
      } else {
        console.error(`  FAILED ${scenario.slug} — NO WORDS FOR THIS REFUSAL — ${error}`);
      }
    }
  }

  writeFileSync(resolve(OUT_DIR, 'README.md'), renderIndex(forIndex), 'utf8');

  const totalGaps = printed.reduce((sum, p) => sum + p.gapIds.length, 0);
  const allIds = new Set(printed.flatMap((p) => [...p.gapIds]));
  console.log(`\nSix weeks asked for, ${printed.length} written.`);
  console.log(`[NO COPY] total: ${totalGaps} across ${allIds.size} distinct ids.`);
  for (const id of [...allIds].sort()) console.log(`  ${id}`);
  console.log(`Findings across the six weeks: ${totalFindings}.`);
  if (failures.length) {
    console.error(`\n${failures.length} scenario(s) did not generate at all.`);
    process.exitCode = 1;
  }
}

/**
 * ONLY WHEN RUN, NEVER WHEN IMPORTED.
 *
 * This was a bare `main()`, which meant `import { renderWeekAsPlainEnglish }`
 * generated six weeks and rewrote `docs/printed-weeks/` as a side effect of the
 * import. Seat `sim` tried the import for item 66, saw it republish this seat's
 * output, and backed out rather than ship it. **A module that does its work on
 * import is not a reusable seam — it is a script wearing one**, and the whole
 * point of exporting the renderer was that item 66 could call it without
 * inheriting item 65's run.
 */
if (require.main === module) main();
