/**
 * MID-BLOCK RESTART CONSERVATION — the accepted block must survive a process death.
 *
 * Sam's order, 2026-08-18: *"A restart inside an accepted block may not re-author
 * that block. With no dated fact change, the visible week before and after
 * restart must be identical."*
 *
 * This is the own unit the journey merge named and did not cover:
 * *"a mid-block restart re-generates conditioning templates and can drop a
 * strength row — reported, own unit."*
 *
 * Run: npm run test:mid-block-restart
 *
 * ## WHAT IS REAL HERE
 *
 * The same production doors `support/athleteJourney.ts` names — cold start,
 * onboarding, install, and `runQuiescentBoot` through a genuine process death
 * (stores emptied, their writes flushed, disk restored, registry rehydrated).
 * Nothing writes a store directly and nothing hand-builds a `ScheduleState`.
 *
 * ## WHAT THE COMPARISON PRINTS, AND WHY EACH COLUMN IS THERE
 *
 * A restart report that prints only exercise names is blind to three of the four
 * ways this class of defect shows up. So every capture carries, per day:
 * exercise IDENTITY (name AND canonical id), ROLE, sets, reps, LOAD, the
 * conditioning TEMPLATE identity (`projectConditioningVisibleIdentity`, the
 * app's own conditioning read), plus the week's EXPLANATIONS, the athlete's
 * EXCLUSIONS, and the ACCEPTED BLOCK-SELECTION identity that generation says it
 * chose. A load that reverts, a template that rotates and a dropped row are then
 * all one diff.
 */

// ── Headless bootstrap. MUST precede every app import. ────────────────────
//
// `__DEV__` IS TRUE: this suite moves the clock, and `isDevE2EClockAvailable()`
// refuses outside dev, so `setDevE2EClock` would return null *silently* and every
// door would read the wall clock.
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
  throw new Error('NETWORK DISABLED — this athlete trains entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import type { OnboardingData, Workout } from '../types/domain';
import { addDaysISO } from '../utils/programBlockState';
import { useProgramStore } from '../store/programStore';
import { useBlockSelectionHistoryStore } from '../store/blockSelectionHistoryStore';
import { readBlockHistory } from '../rules/blockBoundaryProgression';
import { availableTrainingDays } from '../rules/extraSessionOffer';
import { deriveBlockBoundaryPrompts } from '../screens/home/useBlockBoundaryPrompts';
import { acceptBlock, resetBlockSelectionHistory } from './support/acceptBlock';
import type { SessionFeedback } from '../store/programStore';
import type { DayOfWeek, TrainingProgram } from '../types/domain';
import { getAthleteExclusions } from '../store/athletePreferencesStore';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { projectConditioningVisibleIdentity } from '../utils/conditioningVisibleIdentity';
import {
  coldStartThroughOnboarding,
  followTheWeek,
  quiet,
  recordDay,
  relaunchApp,
  setJourneyClock,
  weekdayName,
  type DayIntent,
} from './support/athleteJourney';
import { visibleProjection } from './support/athleteJourney';

let pass = 0; let fail = 0; const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) { pass += 1; console.log(`  PASS ${name}`); }
  else {
    fail += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ATHLETE — the journey's athlete, unchanged, so a finding here and a
// finding there describe the same person.
// ═══════════════════════════════════════════════════════════════════════════

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

const DID_THE_WORK: DayIntent = {
  record: true,
  completion: 'full',
  feeling: 'good',
  soreness: 'mild',
  difficulty: 6,
  logWeights: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// THE CAPTURE — everything the order names, in one comparable shape
// ═══════════════════════════════════════════════════════════════════════════

interface CapturedRow {
  name: string;
  exerciseId: string;
  role: string | null;
  sets: number | null;
  reps: string;
  loadKg: number | null;
}

interface CapturedDay {
  dateISO: string;
  weekday: string;
  sessionName: string | null;
  workoutType: string | null;
  /** The app's OWN conditioning read — family and structure, not the copy. */
  conditioning: string | null;
  rows: CapturedRow[];
}

interface Capture {
  days: CapturedDay[];
  explanations: string[];
  exclusions: string[];
  /** WHICH BLOCK THE ATHLETE IS IN, and what acceptance recorded for it. */
  blockState: unknown;
  acceptedBlocks: unknown;
  /** WHAT GENERATION SAYS THIS BLOCK CHOSE, slot by slot. */
  blockSelections: string[];
}

function num(value: unknown): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

/**
 * THE RESOLVED WEEK, read through the same resolver every app surface reads —
 * then widened past what `resolvedDays` prints, because the three columns this
 * unit is about (identity, role, conditioning template) are exactly the three it
 * does not carry.
 */
function captureWeek(weekStartISO: string, todayISO: string): Capture {
  const week = quiet(() => resolveWeekWithConditioning(
    weekStartISO, buildScheduleStateImperative(),
  ));
  const days: CapturedDay[] = week
    .filter((day) => day.date >= weekStartISO && day.date <= addDaysISO(weekStartISO, 6))
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((day) => {
      const workout = (day as { workout?: Workout | null }).workout ?? null;
      const conditioning = quiet(() => projectConditioningVisibleIdentity(workout as never));
      return {
        dateISO: day.date,
        weekday: weekdayName(day.date),
        sessionName: workout?.name ?? null,
        workoutType: workout ? String(workout.workoutType ?? '') : null,
        conditioning: conditioning ? JSON.stringify(conditioning) : null,
        rows: (workout?.exercises ?? []).map((row) => {
          const nested = (row as { exercise?: { name?: string; id?: string } }).exercise;
          return {
            // The app's own read (`projectVisibleWeek.ts:396`).
            name: String(nested?.name ?? (row as { name?: string }).name ?? '(NO NAME ON ROW)'),
            exerciseId: String(nested?.id ?? (row as { exerciseId?: string }).exerciseId ?? ''),
            role: (row as { role?: string }).role ?? null,
            sets: num((row as { prescribedSets?: number }).prescribedSets),
            reps: `${num((row as { prescribedRepsMin?: number }).prescribedRepsMin)}-`
              + `${num((row as { prescribedRepsMax?: number }).prescribedRepsMax)}`,
            loadKg: num((row as { prescribedWeightKg?: number }).prescribedWeightKg),
          };
        }),
      };
    });

  const projected = quiet(() => visibleProjection(weekStartISO, todayISO));
  const state = useProgramStore.getState() as unknown as {
    blockState: unknown; acceptedBlocks: unknown;
  };
  return {
    days,
    explanations: projected.explanations.slice().sort(),
    exclusions: quiet(() => getAthleteExclusions())
      .map((entry) => `${entry.exercise}:${entry.scope}:${entry.activeThroughISO ?? 'none'}`)
      .sort(),
    blockState: state.blockState,
    acceptedBlocks: state.acceptedBlocks,
    blockSelections: useBlockSelectionHistoryStore.getState().selections
      .map((selection) => JSON.stringify(selection))
      .sort(),
  };
}

function printCapture(heading: string, capture: Capture): void {
  console.log(`\n  ${heading}`);
  for (const day of capture.days) {
    const head = `    ${day.weekday.slice(0, 3)} ${day.dateISO} `
      + `${day.sessionName ?? '(rest)'}${day.workoutType ? ` [${day.workoutType}]` : ''}`;
    console.log(head);
    if (day.conditioning) console.log(`        conditioning: ${day.conditioning}`);
    for (const row of day.rows) {
      console.log(`        ${row.name} (${row.exerciseId}) role=${row.role ?? '-'} `
        + `${row.sets}x${row.reps} @${row.loadKg ?? '-'}`);
    }
  }
  console.log(`    explanations : ${JSON.stringify(capture.explanations)}`);
  console.log(`    exclusions   : ${JSON.stringify(capture.exclusions)}`);
  console.log(`    blockState   : ${JSON.stringify(capture.blockState)}`);
  console.log(`    acceptedBlocks: ${JSON.stringify(capture.acceptedBlocks)}`);
  console.log(`    blockSelections: ${capture.blockSelections.length} rows`);
}

/** Day by day, column by column — what actually differs, never a totals line. */
function reportDifferences(before: Capture, after: Capture): string[] {
  const differences: string[] = [];
  const byDate = new Map(after.days.map((day) => [day.dateISO, day]));
  for (const day of before.days) {
    const other = byDate.get(day.dateISO);
    if (!other) { differences.push(`${day.dateISO}: the day is GONE after restart`); continue; }
    if (day.sessionName !== other.sessionName) {
      differences.push(`${day.dateISO} session: ${day.sessionName} -> ${other.sessionName}`);
    }
    if (day.conditioning !== other.conditioning) {
      differences.push(`${day.dateISO} conditioning: ${day.conditioning} -> ${other.conditioning}`);
    }
    const beforeRows = day.rows.map((row) => JSON.stringify(row));
    const afterRows = other.rows.map((row) => JSON.stringify(row));
    for (const row of beforeRows) {
      if (!afterRows.includes(row)) differences.push(`${day.dateISO} row LOST : ${row}`);
    }
    for (const row of afterRows) {
      if (!beforeRows.includes(row)) differences.push(`${day.dateISO} row NEW  : ${row}`);
    }
  }
  if (JSON.stringify(before.explanations) !== JSON.stringify(after.explanations)) {
    differences.push(`explanations: ${JSON.stringify(before.explanations)} -> `
      + `${JSON.stringify(after.explanations)}`);
  }
  if (JSON.stringify(before.exclusions) !== JSON.stringify(after.exclusions)) {
    differences.push(`exclusions: ${JSON.stringify(before.exclusions)} -> `
      + `${JSON.stringify(after.exclusions)}`);
  }
  if (JSON.stringify(before.blockState) !== JSON.stringify(after.blockState)) {
    differences.push(`blockState: ${JSON.stringify(before.blockState)} -> `
      + `${JSON.stringify(after.blockState)}`);
  }
  if (JSON.stringify(before.acceptedBlocks) !== JSON.stringify(after.acceptedBlocks)) {
    differences.push(`acceptedBlocks: ${JSON.stringify(before.acceptedBlocks)} -> `
      + `${JSON.stringify(after.acceptedBlocks)}`);
  }
  /**
   * ⚠ **THE SELECTION HISTORY IS REPORTED, NOT COUNTED AS A CONSERVATION
   * DIFFERENCE, AND THE REASON IS A SEPARATE DEFECT — see `selectionRewrite`
   * below.** For one of these two athletes acceptance records NOTHING, so boot
   * is the FIRST writer rather than a second one. A first write is not the
   * accepted block being re-authored, which is what this function measures; a
   * REWRITE would be, and that is asserted on its own.
   */
  return differences;
}

/**
 * DID THE RESTART REWRITE A SELECTION THE ACCEPTED BLOCK ALREADY RECORDED?
 *
 * Separate from the week diff because the two failures mean different things: a
 * changed row is the block being re-authored, whereas a row appearing for the
 * first time is acceptance never having written it. Both are wrong; only the
 * first is what this unit fixed.
 */
function selectionRewrite(before: Capture, after: Capture): string[] {
  if (before.blockSelections.length === 0) return [];
  return before.blockSelections.filter((row) => !after.blockSelections.includes(row));
}

// ═══════════════════════════════════════════════════════════════════════════
// THE WORLDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ONE WORLD: install, train into the middle of the accepted block, capture what
 * the athlete sees, kill the process, boot, capture again.
 *
 * ⚠ **NO DATED FACT CHANGES ACROSS THE RESTART.** The clock is held on the same
 * day either side, nothing is recorded between the two captures, and no door is
 * walked. Any difference is the app re-authoring an accepted block.
 */
async function runWorld(args: {
  label: string;
  profile: OnboardingData;
  /** How far into the block the athlete has got. */
  midBlockOffsetDays: number;
}): Promise<number> {
  console.log(`\n═══ ${args.label} ═══`);
  // ⚠ **THE DISK IS PART OF THE WORLD.** `coldStartThroughOnboarding` empties the
  // STORES, not storage — so without this the second world's relaunch rehydrates
  // the first athlete's persisted envelope.
  localStorageData.clear();

  const install = await coldStartThroughOnboarding({
    profile: args.profile, installDayISO: INSTALL_DAY,
  });
  ok(`${args.label}: the athlete is installed with a block`,
    install.onboardingRefusal === null && install.program.microcycles.length > 0,
    `refusal=${install.onboardingRefusal} microcycles=${install.program.microcycles.length}`);
  const blockStart = install.blockOneStart;
  console.log(`  block 1 starts ${blockStart}; ${install.recordedSelectionCount} selections recorded`);

  // ── WALK INTO THE MIDDLE OF THE ACCEPTED BLOCK ──────────────────────────
  //
  // A restart on install day is the trivial case: nothing has happened yet, so a
  // regeneration from the same inputs answers the same. The order is about a
  // restart INSIDE an accepted block, so the athlete trains first.
  const midBlockDay = addDaysISO(blockStart, args.midBlockOffsetDays);
  for (let offset = 0; offset <= args.midBlockOffsetDays; offset += 1) {
    const dateISO = addDaysISO(blockStart, offset);
    setJourneyClock(dateISO);
    quiet(() => followTheWeek(dateISO));
    await recordDay(dateISO, DID_THE_WORK);
  }
  setJourneyClock(midBlockDay);
  quiet(() => followTheWeek(midBlockDay));

  const weekStart = mondayOf(midBlockDay);
  const before = captureWeek(weekStart, midBlockDay);
  printCapture(`BEFORE RESTART — week of ${weekStart}, standing on ${midBlockDay}`, before);

  // ── A GENUINE PROCESS DEATH, then the app's own boot ─────────────────────
  const relaunch = await relaunchApp({ storage: localStorageData, todayISO: midBlockDay });
  ok(`${args.label}: the app boots after a genuine process death`,
    relaunch.ok, `boot failed: ${relaunch.error}`);
  setJourneyClock(midBlockDay);
  quiet(() => followTheWeek(midBlockDay));

  const after = captureWeek(weekStart, midBlockDay);
  printCapture(`AFTER RESTART — week of ${weekStart}, standing on ${midBlockDay}`, after);

  const differences = reportDifferences(before, after);
  console.log(`\n  DIFFERENCES: ${differences.length}`);
  for (const line of differences) console.log(`    ${line}`);

  ok(`${args.label}: MID-BLOCK RESTART CONSERVATION — the visible week is `
    + 'identical, row for row and dose for dose', differences.length === 0,
  `${differences.length} differences:\n    ${differences.join('\n    ')}`);

  const rewritten = selectionRewrite(before, after);
  ok(`${args.label}: the accepted block's recorded selections are not rewritten `
    + 'by a restart', rewritten.length === 0,
  `${rewritten.length} recorded selections changed: ${JSON.stringify(rewritten)}`);

  // ⚠ STATED, BECAUSE IT IS A REAL FINDING THIS UNIT DID NOT FIX.
  if (before.blockSelections.length !== after.blockSelections.length) {
    console.log(`  ⚠ ACCEPTANCE RECORDED ${before.blockSelections.length} block selections and `
      + `the restart wrote ${after.blockSelections.length}. Boot is the FIRST writer here — `
      + 'the install door never recorded what the accepted block chose. Own unit; see '
      + 'docs/STATUS_RESTART.md.');
  }
  return differences.length;
}

function mondayOf(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00`);
  const shift = (date.getDay() + 6) % 7;
  return addDaysISO(dateISO, -shift);
}

/**
 * THE SECOND WORLD, AND WHY IT IS NOT DECORATION.
 *
 * The journey merge reported the admitted defect on THIS shape, not the primary
 * athlete's: *"their week legitimately re-generates with different conditioning
 * templates and one fewer strength row."* Pre-season, two gym days, one club
 * night and no fixture — which is the shape whose gym days carry a conditioning
 * component, so the conditioning template is a visible column at all.
 */
function conditioningAthlete(): OnboardingData {
  return {
    ...theAthlete(),
    firstName: 'Alex',
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 2,
    preferredTrainingDays: ['Monday', 'Wednesday'],
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
    usualGameDay: undefined,
    gameDay: undefined,
  } as unknown as OnboardingData;
}


// ═══════════════════════════════════════════════════════════════════════════
// THE OFFER CARD'S DENOMINATOR — the same accepted block, read by a second surface
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠ **WHY THIS LIVES BESIDE THE RESTART CELLS AND NOT IN THE OFFER'S OWN SUITE.**
 *
 * Two reasons, and the second is measured. First, the subject is the same one:
 * what the accepted block DELIVERED. The restart cells prove that number's week
 * survives a process death; this proves the number itself is read from the one
 * owner by the surface that decides whether to offer the athlete a fourth
 * session. Second, `npm run test:block-two-extra-session` **cannot host it: it
 * is already broken at `main` @ c68b00d7.** Measured in a control worktree at
 * base — 18 passed, 4 failed, and then it THROWS at its section [3]
 * (`BlockBoundaryCards.tsx:164`, `Cannot read properties of null (reading
 * 'sentence')`), so the process exits and nothing after that line runs at all.
 * A guard appended there would have been dead on arrival, which is the exact
 * shape of defect this repo keeps paying for. That breakage is NOT this unit's
 * — it is reported in `docs/STATUS_RESTART.md` and left where it is.
 *
 * ── THE GAP ITSELF ───────────────────────────────────────────────────────────
 *
 * `useBlockBoundaryPrompts` was corrected on 2026-08-17 to read the completion
 * denominator from `acceptedBlocks[previousBlockStart].requiredStrengthSessions`
 * — *"the required strength sessions in the accepted block the athlete actually
 * received"* — rather than `trainingDaysPerWeek * WEEKS_PER_BLOCK`. **Nothing
 * held it.** The offer suite's worlds are all athletes whose stated availability
 * and delivered requirement are the SAME number, and its prompt helper passes no
 * `acceptedBlocks` at all, so the corrected read resolves to 0 and the gate
 * waves everything through. The journey merge recorded this honestly as *"a
 * branch no world this journey builds can discriminate"*.
 *
 * ── THE DISCRIMINATING WORLD ─────────────────────────────────────────────────
 *
 * An in-season athlete with a Saturday fixture. Friday is protected as G-1, so
 * an athlete who asked for three gym days is GIVEN two. Complete every single
 * session they were given and the two calculations disagree:
 *
 *     delivered 8  ->  8 >= ceil(8 x 0.75) = 6   QUALIFIES
 *     stated   12  ->  8 >= ceil(12 x 0.75) = 9  DOES NOT
 *
 * An athlete who missed nothing is told they did not train enough, and never
 * sees the card. Restoring the stated-day calculation reds the cells below.
 */
async function theOfferCardDenominator(): Promise<void> {
  console.log('\n═══ THE OFFER CARD READS THE DELIVERED REQUIREMENT ═══');

  const WEEK_ORDER: readonly DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday'] as readonly DayOfWeek[];
  const BLOCK_1_START = '2026-07-06';
  const BLOCK_2_START = '2026-08-03';

  /**
   * ONE CLUB NIGHT, not two, and it is a measured choice. The offer refuses any
   * world whose larger week generation will not build; the offer suite's own
   * 27-world census found the club night is what carries the exposures that make
   * `n -> n+1` legal. Two club nights would leave Sunday as the only free day and
   * put this cell's outcome on a second, unrelated gate.
   */
  const gated = (): OnboardingData => ({
    ...theAthlete(),
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
  } as unknown as OnboardingData);

  /**
   * FEEDBACK ON THE DAYS THE APP ACTUALLY PROGRAMMED, at their real dates. A
   * fixture that spreads answers over a fixed twelve-date list would erase the
   * very fact under test — that the delivered count is not the stated count.
   */
  function logDeliveredBlock(program: TrainingProgram): {
    feedback: Record<string, SessionFeedback>; strengthDays: number;
  } {
    const feedback: Record<string, SessionFeedback> = {};
    let strengthDays = 0;
    for (const microcycle of program.microcycles) {
      const weekStart = String(microcycle.startDate).slice(0, 10);
      for (const workout of microcycle.workouts) {
        const rows = (workout.exercises ?? [])
          .filter((row) => (row as { role?: string }).role !== 'conditioning'
            && ((row as { exercise?: { name?: string } }).exercise?.name ?? '') !== '')
          .map((row) => ({
            exerciseId: (row as { exerciseId: string }).exerciseId,
            workoutExerciseId: (row as { id: string }).id,
            exerciseName: (row as { exercise?: { name?: string } }).exercise?.name ?? '',
            prescribedSets: (row as { prescribedSets: number }).prescribedSets,
            prescribedRepsMin: (row as { prescribedRepsMin: number }).prescribedRepsMin,
            prescribedRepsMax: (row as { prescribedRepsMax: number }).prescribedRepsMax,
            weightKg: (row as { prescribedWeightKg?: number }).prescribedWeightKg ?? null,
            completion: 'full' as const,
          }));
        if (rows.length === 0) continue;
        // Monday-start weeks: Sunday is day 0 and lands at the END of the week.
        const date = new Date(`${weekStart}T12:00:00`);
        date.setDate(date.getDate() + ((workout.dayOfWeek + 6) % 7));
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          + `-${String(date.getDate()).padStart(2, '0')}`;
        feedback[dateStr] = {
          dateStr, completion: 'full', feeling: 'easy', soreness: 'none', strength: rows,
        } as unknown as SessionFeedback;
        strengthDays += 1;
      }
    }
    return { feedback, strengthDays };
  }

  resetBlockSelectionHistory();
  const blockOne = quiet(() => acceptBlock(gated(), {
    todayISO: BLOCK_1_START, blockNumber: 1,
  } as never)) as TrainingProgram;
  const delivered = logDeliveredBlock(blockOne);
  const stated = (gated().trainingDaysPerWeek ?? 0) * blockOne.microcycles.length;

  console.log(`  delivered=${delivered.strengthDays} stated=${stated} `
    + `free days=${availableTrainingDays({ profile: gated(), weekOrder: WEEK_ORDER }).join(',')}`);

  ok('LIVENESS — the fixture takes a gym day off this athlete, so stated availability '
    + 'and delivered requirement are DIFFERENT numbers',
  delivered.strengthDays > 0 && delivered.strengthDays !== stated,
  `delivered=${delivered.strengthDays} stated=${stated} — equal numbers cannot tell the `
    + 'two calculations apart, and a guard on them would prove nothing');

  const readWith = (required: number) => quiet(() => readBlockHistory({
    feedbackByDate: delivered.feedback as never,
    blockStartISO: BLOCK_1_START,
    blockEndISO: '2026-08-02',
    requiredStrengthSessions: required,
  })) as { qualifies: boolean };

  ok('the athlete who completed EVERY session the app gave them qualifies on the '
    + 'DELIVERED requirement and fails on the STATED one',
  readWith(delivered.strengthDays).qualifies && !readWith(stated).qualifies,
  `delivered(${delivered.strengthDays}).qualifies=${readWith(delivered.strengthDays).qualifies} `
    + `stated(${stated}).qualifies=${readWith(stated).qualifies}`);

  // THE CARD ITSELF, through its own producer, with the accepted record the app
  // holds — `acceptBlock` writes it exactly as both production doors do, so this
  // reads what the athlete's app would read and not a number chosen here.
  const acceptedBlocks = (useProgramStore.getState() as unknown as {
    acceptedBlocks: Record<string, unknown> }).acceptedBlocks ?? {};
  console.log(`  accepted record: ${JSON.stringify(acceptedBlocks)}`);
  const prompts = quiet(() => deriveBlockBoundaryPrompts({
    currentProgram: blockOne,
    blockNumber: 2,
    blockStartISO: BLOCK_2_START,
    sessionFeedback: delivered.feedback,
    onboardingData: gated(),
    ledgerEntries: [],
    weekOrder: WEEK_ORDER,
    acceptedBlocks,
  } as never)) as { extraSession?: { offer?: { currentSessionsPerWeek?: number } } | null };

  ok('THE CARD IS OFFERED to an athlete who completed every session they were given '
    + '— the stated-day calculation would silently refuse exactly this athlete',
  (prompts.extraSession ?? null) !== null,
  'no card was produced; if the denominator has gone back to '
    + 'trainingDaysPerWeek x weeks, this is the athlete it refuses');

  ok('and the offer counts the days the athlete is committed to',
    prompts.extraSession?.offer?.currentSessionsPerWeek
      === (gated().trainingDaysPerWeek ?? 0),
    `card says currentSessionsPerWeek=${prompts.extraSession?.offer?.currentSessionsPerWeek}`);
}

// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('\nMID-BLOCK RESTART CONSERVATION\n');

  await runWorld({
    label: 'IN-SEASON, Saturday game',
    profile: theAthlete(),
    midBlockOffsetDays: 9,
  });

  await runWorld({
    label: 'PRE-SEASON, conditioning on the gym days',
    profile: conditioningAthlete(),
    midBlockOffsetDays: 9,
  });

  /**
   * THE CLAIM THE FIX RESTS ON, HELD BY A CELL RATHER THAN BY ITS OWN COMMENT.
   *
   * The final program-write boundary now runs at `stageAcceptedStateTransaction`,
   * the one owner both acceptance doors reach. The install door still runs it
   * first — it needs the validated program to derive the block state and anchor
   * that ride the same proposal — so the boundary is asked twice on that path.
   * That is only safe because it is IDEMPOTENT, and a boundary that stopped
   * being idempotent would make onboarding and every later republication
   * disagree again without anything else changing.
   */
  {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { validateLiveProgramWrite } = require('../utils/postGenerationConstraintValidation');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generateProgramLocally } = require('../services/api/generateProgram');
    const raw = await quiet(() => generateProgramLocally(conditioningAthlete(), {
      weekAcceptance: 'restoration', todayISO: INSTALL_DAY,
    })) as unknown;
    const once = quiet(() => validateLiveProgramWrite(raw, INSTALL_DAY));
    const twice = quiet(() => validateLiveProgramWrite(once, INSTALL_DAY));
    ok('the final program-write boundary is IDEMPOTENT, which is what makes '
      + 'running it at the shared owner safe on the door that already ran it',
    JSON.stringify(twice) === JSON.stringify(once),
    'validating an already-validated program changed it, so onboarding and every '
      + 'later republication would disagree again');
  }

  await theOfferCardDenominator();

  console.log(`\n  ${pass} passed, ${fail} failed`);
  for (const failure of failures) console.log(`   - ${failure}`);
  totalsPrinted(fail);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
