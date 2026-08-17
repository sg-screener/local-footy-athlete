/**
 * THE COMPLETE ATHLETE JOURNEY — cold start to Block 2 and back through a relaunch.
 *
 * Sam's mission, 2026-08-17. One real athlete, production doors only, and at
 * every step the same four-way comparison:
 *
 *     athlete action  ->  accepted canonical state  ->  generated program
 *                     ->  athlete-visible projection
 *
 * A successful tap must change the intended state EXACTLY ONCE, and no screen or
 * read-time layer may re-author the program.
 *
 * Run: npm run test:athlete-journey
 *
 * ## WHAT IS REAL HERE
 *
 * All of it. The doors are listed with their production callers in
 * `support/athleteJourney.ts`; nothing in this file writes a store directly,
 * hand-builds a `ScheduleState`, or fabricates a feedback record. The clock is
 * `DevE2EClock` and every simulated day asserts `todayISOLocal()` agrees.
 *
 * ## WHAT IS NOT REAL, STATED SO IT IS NOT MISTAKEN FOR PROOF
 *
 * No pixels. The feedback payloads are built by `buildSessionFeedbackPayload`,
 * the panel's own builder, from answers this file supplies — the same shape the
 * screen produces, not the taps that produce it. A UI regression that breaks the
 * panel's own wiring is out of this suite's reach and belongs to the Maestro
 * flows. Everything downstream of the payload is the app.
 */

// ── Headless bootstrap. MUST precede every app import. ────────────────────
//
// `__DEV__` IS TRUE, unlike most suites here, and it has to be: the journey is a
// simulation of TIME PASSING, and `isDevE2EClockAvailable()` refuses outside dev
// so `setDevE2EClock` would return null *silently* and every door would read the
// wall clock. `setJourneyClock` re-asserts it and then proves it took.
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

import type { OnboardingData } from '../types/domain';
import { addDaysISO } from '../utils/programBlockState';
import { useProgramStore } from '../store/programStore';
import { readBlockHistory, smallestPracticalIncrementKg } from '../rules/blockBoundaryProgression';
import {
  coldStartThroughOnboarding,
  followTheWeek,
  quiet,
  recordDay,
  resolvedDays,
  rolloverIfDue,
  setJourneyClock,
  takeCensus,
  visibleProjection,
  weekdayName,
  type DayIntent,
  type JourneyCensus,
  type VisibleDay,
} from './support/athleteJourney';

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
// THE ATHLETE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ONE ATHLETE, AND THEY ANSWER EVERY QUESTION THE MISSION NAMES: phase, gym
 * availability, equipment, club training and game information.
 *
 * In-season with a Saturday game and two team nights, because that is the shape
 * Sam described as real (*"games are basically only ever on friday saturday
 * sunday"*) and because it is the only phase where the fixture protections and
 * the club-night interactions are live at all. `twoKmTimeTrial` is not optional
 * decoration — §18 refuses every world that cannot be capacity-scored, and a
 * profile without it is one the app would reject from a real person.
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
    // GYM AVAILABILITY — three days they can train, named.
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    // CLUB TRAINING — two nights, with duration and intensity.
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Hard',
    // GAME INFORMATION.
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    // EQUIPMENT — the typed answer (L15), not the legacy list alone.
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
// HOW THE ATHLETE BEHAVES THROUGH BLOCK 1
// ═══════════════════════════════════════════════════════════════════════════

/** The ordinary day: did the work, felt fine, wrote the loads down. */
const DID_THE_WORK: DayIntent = {
  record: true,
  completion: 'full',
  feeling: 'good',
  soreness: 'mild',
  // MIDDLE OF THE 1-10 SCALE. A 1-5 value is silently valid here and lands in
  // `feedbackAdapter`'s `<= 5` EASY arm, which ADDS volume.
  difficulty: 6,
  logWeights: true,
};

/**
 * ONE MISSED SESSION, AND IT LEAVES NO RECORD.
 *
 * A miss is the ABSENCE of a record, not a `skipped` one: recording a skip is
 * answering a question the app never put on the screen. The contract's missed-
 * session clause turns on completion RATE, so a real miss has to be a real gap.
 */
const MISSED: DayIntent = {
  ...DID_THE_WORK,
  record: false,
  absenceReason: 'the athlete did not open the app that day',
};

const BLOCK_ONE_WEEKS = 4;

interface WalkedDay {
  dateISO: string;
  weekday: string;
  sessionName: string | null;
  result: string;
  detail: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 1 — COLD START, ONBOARDING, BLOCK 1
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('\n═══ STAGE 1 — cold start, onboarding, Block 1 ═══\n');

  const install = await coldStartThroughOnboarding({
    profile: theAthlete(),
    installDayISO: INSTALL_DAY,
  });

  ok(
    'onboarding is ACCEPTED — the app would take this athlete from a real person',
    install.onboardingRefusal === null,
    `completeOnboarding refused: ${install.onboardingRefusal}`,
  );

  ok(
    'Block 1 is generated and INSTALLED by the onboarding door',
    useProgramStore.getState().currentProgram != null
      && (useProgramStore.getState().currentProgram?.microcycles.length ?? 0) > 0,
    'no program in the store after the screen\'s own generate + seed pair',
  );

  const blockOneStart = install.blockOneStart;
  console.log(`  block 1 starts ${blockOneStart}, `
    + `${useProgramStore.getState().currentProgram?.microcycles.length} weeks`);
  console.log(`  blockState: ${JSON.stringify(useProgramStore.getState().blockState)}`);
  console.log(`  recorded block selections after install: ${install.recordedSelectionCount}`);

  /**
   * THE FIRST OWNERSHIP CLAIM, AND THE FIRST DEFECT.
   *
   * `seedOnboardingProgram` COMMITS this program — it is the athlete's block 1
   * and every later block is authored against it. A committing caller records
   * what the block selected; five other committing callers in this app say so in
   * a comment beside the argument. The onboarding door does not pass it.
   *
   * Without the record, `blockExerciseSelection` has no history at the next
   * boundary, so block 2 cannot rotate away from block 1 — which is the approved
   * contract's *"Most exercises change when a new block begins"*.
   */
  ok(
    'THE INSTALLED BLOCK 1 RECORDED WHAT IT SELECTED — block 2 has something to rotate from',
    install.recordedSelectionCount > 0,
    'the onboarding door installed block 1 and recorded ZERO selections '
    + '(CompleteScreen.tsx:302 omits recordSelections while seedOnboardingProgram commits '
    + 'the result). Block 2 rotation has no block-1 history to rotate away from.',
  );

  // ── The displayed week must match accepted storage ──────────────────────
  setJourneyClock(blockOneStart);
  followTheWeek(blockOneStart);
  const blockOneVisible = visibleProjection(blockOneStart, blockOneStart);
  printWeek('BLOCK 1, week 1 — what the athlete sees', blockOneVisible.days);

  const storedWeekOne = storedWeekRows(blockOneStart);
  const visibleWeekOne = visibleRowSignature(blockOneVisible.days);

  /**
   * NO READ-TIME LAYER RE-AUTHORS THE PROGRAM.
   *
   * The comparison is IDENTITY and PRESCRIPTION across the projection edge, not
   * full structure: the projection legitimately renames (`Romanian Deadlift` ->
   * `RDLs`) and the resolver legitimately relocates a session onto a date
   * generation never named. What it may not do is invent a row, drop one, or
   * change a dose.
   */
  ok(
    'the DISPLAYED week matches accepted storage — sessions, exercises and doses',
    visibleWeekOne.rowCount === storedWeekOne.rowCount
      && visibleWeekOne.doseSignature === storedWeekOne.doseSignature,
    `visible ${visibleWeekOne.rowCount} rows / ${visibleWeekOne.doseSignature}\n`
    + `  stored  ${storedWeekOne.rowCount} rows / ${storedWeekOne.doseSignature}`,
  );

  // ═════════════════════════════════════════════════════════════════════════
  // STAGE 2 — BLOCK 1 LIVED: four weeks of real days
  // ═════════════════════════════════════════════════════════════════════════

  console.log('\n═══ STAGE 2 — Block 1 lived, one day at a time ═══\n');

  const walked: WalkedDay[] = [];
  const lastDay = addDaysISO(blockOneStart, BLOCK_ONE_WEEKS * 7 - 1);
  let missedOnce = false;

  for (let dateISO = blockOneStart; dateISO <= lastDay; dateISO = addDaysISO(dateISO, 1)) {
    setJourneyClock(dateISO);
    const rolled = rolloverIfDue(dateISO);
    if (rolled.refusal) {
      ok(`no rollover refusal inside block 1 (${dateISO})`, false, rolled.refusal);
    }
    followTheWeek(dateISO);

    // ONE MISS, in week 3, on a Friday. Late enough that the block has real
    // history behind it and early enough that the boundary sees the gap.
    const weekIndex = Math.floor(
      (Date.parse(`${dateISO}T12:00:00Z`) - Date.parse(`${blockOneStart}T12:00:00Z`))
      / (7 * 24 * 3600 * 1000)) + 1;
    const isTheMiss = weekIndex === 3 && weekdayName(dateISO) === 'Wednesday' && !missedOnce;
    if (isTheMiss) missedOnce = true;

    const outcome = await recordDay(dateISO, isTheMiss ? MISSED : DID_THE_WORK);
    walked.push({
      dateISO,
      weekday: weekdayName(dateISO),
      sessionName: outcome.sessionName,
      result: outcome.result,
      detail: 'detail' in outcome ? outcome.detail ?? null : null,
    });
  }

  // COUNTED DURING THE WALK, because after the rollover the store is in block 2
  // and re-resolving a block-1 week returns nothing — the live-state trap.
  const offeredStrengthSessions = walked.filter((day) => day.result === 'recorded'
    || day.result === 'not_recorded').filter((day) => day.sessionName === 'full_body').length;

  const recorded = walked.filter((day) => day.result === 'recorded');
  const refused = walked.filter((day) => day.result === 'refused');
  const threw = walked.filter((day) => day.result === 'threw');
  const notRecorded = walked.filter((day) => day.result === 'not_recorded');

  console.log(`  days walked: ${walked.length}`);
  console.log(`  recorded: ${recorded.length} · missed: ${notRecorded.length} · `
    + `rest: ${walked.filter((d) => d.result === 'no_session').length} · `
    + `REFUSED: ${refused.length} · THREW: ${threw.length}`);
  for (const day of [...refused, ...threw]) {
    console.log(`    ⚠ ${day.dateISO} ${day.weekday} (${day.sessionName}): ${day.detail}`);
  }

  ok(
    'no session the app offered was REFUSED or THREW when the athlete recorded it',
    refused.length === 0 && threw.length === 0,
    `${refused.length} refused, ${threw.length} threw — listed above`,
  );

  ok(
    'the athlete really did miss exactly one session, and it left NO record',
    notRecorded.length === 1,
    `${notRecorded.length} unrecorded days; a miss must be an absence, not a stored skip`,
  );

  const census = takeCensus(addDaysISO(lastDay, 1));
  printCensus(census);

  /**
   * THE ANTI-VACUITY GATE. Everything after this point is a claim about how the
   * app responds to a history; if the app cannot SEE the history, none of it
   * means anything, and a suite that carries on regardless reports green on an
   * athlete the app is blind to.
   */
  ok(
    'THE APP CAN SEE THIS ATHLETE — the progression reader finds their recorded work',
    census.progressionHistoryEntries > 0,
    `${census.storedFeedbackDays} days of feedback stored and the progression reader sees `
    + `${census.progressionHistoryEntries}. Every claim below would be vacuous.`,
  );

  ok(
    'the loads the athlete typed in are stored',
    census.weightOverrideEntries > 0,
    'no weightOverrides — `lastPerformedWeights` has nothing to read, so progression has '
    + 'nothing to progress FROM',
  );

  // Capture block 1's last week WHILE THE STORE IS STILL IN BLOCK 1.
  const blockOneLastWeek = mondayOf(lastDay);
  setJourneyClock(blockOneLastWeek);
  followTheWeek(blockOneLastWeek);
  const blockOneFinal = resolvedDays(blockOneLastWeek);
  printWeek(`BLOCK 1, final week (${blockOneLastWeek})`, blockOneFinal);

  // ═════════════════════════════════════════════════════════════════════════
  // STAGE 3 — THE BOUNDARY
  // ═════════════════════════════════════════════════════════════════════════

  console.log('\n═══ STAGE 3 — the block boundary, through the real rollover door ═══\n');

  const boundaryDay = addDaysISO(blockOneStart, BLOCK_ONE_WEEKS * 7);
  setJourneyClock(boundaryDay);

  // GENERATION'S OWN NUMBER, CAPTURED FROM ITS OWN LOG LINE rather than
  // recomputed here. `generateProgram.ts:1633` already debug-logs
  // `coreSessions`, and that is the value both `readBlockHistory` call sites
  // multiply by `WEEKS_PER_BLOCK` to get the gate's denominator.
  // Sucrase compiles a named import to a property read on the module object, so
  // wrapping the export here is seen by `generateProgram`'s two call sites. This
  // is a HARNESS instrument on a harness run — no production file is touched.
  const boundaryModule = require('../rules/blockBoundaryProgression') as {
    readBlockHistory: typeof readBlockHistory;
  };
  const realReadBlockHistory = boundaryModule.readBlockHistory;
  const requiredSeen: number[] = [];
  boundaryModule.readBlockHistory = ((callArgs: Parameters<typeof readBlockHistory>[0]) => {
    requiredSeen.push(callArgs.requiredStrengthSessions);
    return realReadBlockHistory(callArgs);
  }) as never;
  const rollover = rolloverIfDue(boundaryDay);
  boundaryModule.readBlockHistory = realReadBlockHistory;
  console.log('  the gate denominator generation actually used: '
    + `${JSON.stringify([...new Set(requiredSeen)])}`);
  console.log(`  ${boundaryDay}: fired=${rollover.fired} `
    + `block ${rollover.fromBlock} -> ${rollover.toBlock} `
    + `nextStart=${rollover.nextBlockStart} refusal=${rollover.refusal ?? 'none'}`);

  ok(
    'THE REAL ROLLOVER DOOR FIRED — block 2 exists because the block ended',
    rollover.fired && rollover.refusal === null,
    `fired=${rollover.fired} refusal=${rollover.refusal}`,
  );

  ok(
    'the athlete is now in block 2',
    useProgramStore.getState().blockState?.blockNumber === 2,
    `blockState says ${JSON.stringify(useProgramStore.getState().blockState)}`,
  );

  const blockTwoStart = rollover.nextBlockStart ?? boundaryDay;
  followTheWeek(blockTwoStart);
  const blockTwoVisible = visibleProjection(blockTwoStart, blockTwoStart);
  printWeek(`BLOCK 2, week 1 (${blockTwoStart}) — what the athlete sees`, blockTwoVisible.days);
  console.log(`  explanations shown: ${JSON.stringify(blockTwoVisible.explanations)}`);

  // ── STORED vs SHOWN, so a silence is attributed to the right owner ──────
  const storedExplanations = (useProgramStore.getState().currentProgram
    ?.blockBoundaryExplanation ?? []) as unknown[];
  console.log(`  block-boundary explanation rows STORED: ${storedExplanations.length}`);
  for (const row of storedExplanations.slice(0, 8)) {
    console.log(`      ${JSON.stringify(row)}`);
  }

  reportRotation(blockOneFinal, blockTwoVisible.days);

  // ── THE GATE, MEASURED UNDER BOTH DENOMINATORS ──────────────────────────
  //
  // Both arms are printed beside each other rather than one being asserted
  // alone, because "the athlete does not qualify" and "the app asked the wrong
  // question" look identical from inside a single run.
  const feedbackMap = (useProgramStore.getState() as unknown as {
    sessionFeedback: Record<string, unknown>;
  }).sessionFeedback;
  const blockOneEnd = addDaysISO(blockOneStart, BLOCK_ONE_WEEKS * 7 - 1);
  for (const [label, required] of [
    ['what the app PROGRAMMED', offeredStrengthSessions],
    ['what the athlete ASKED for', 3 * BLOCK_ONE_WEEKS],
  ] as [string, number][]) {
    const signal = quiet(() => readBlockHistory({
      feedbackByDate: feedbackMap as never,
      blockStartISO: blockOneStart,
      blockEndISO: blockOneEnd,
      requiredStrengthSessions: required,
    }));
    console.log(`  gate with required=${required} (${label}): `
      + `completed=${signal.completedStrengthSessions} `
      + `recorded=${signal.recordedStrengthSessions} `
      + `verdict=${signal.recoveryVerdict} qualifies=${signal.qualifies} `
      + `reduces=${signal.reduces}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PROOF 1 — THE COMPLETION GATE COUNTS WHAT THE APP PROGRAMMED
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * THE DENOMINATOR IS THE DEFECT, AND IT HAS TWO OWNERS.
   *
   * `readBlockHistory`'s completion gate is
   * `completed >= ceil(requiredStrengthSessions * 0.75)`, and both callers state
   * that number as `plan.coreSessions * WEEKS_PER_BLOCK`
   * (`generateProgram.ts:1660`, `:1813`) — the athlete's stated weekly INTENT.
   * The week the app actually laid out carries its own count, which the
   * scheduler already owns (`weeklyScheduler.ts:1189`, read at
   * `schedulerExposureContract.ts:91`).
   *
   * For this athlete they disagree by a third: they asked for three gym days,
   * Friday is protected as G-1 before a Saturday game, so the app programmed
   * TWO. Intent says 12 sessions a block; the app offered 8.
   *
   * ⚠ **THE CONSEQUENCE IS NOT A ROUNDING ERROR.** An in-season athlete who does
   * every single session the app puts in front of them completes 8 of 8 and is
   * measured against 12, so they never reach 75% and NO lift may ever rise. The
   * approved contract's first progression rule — *"When training is being
   * completed and recovery is good: increase load by the smallest practical
   * increment"* — is unreachable for them, and it fails silently: the boundary
   * runs, reads their real 125 kg, and holds it.
   */
  ok(
    'THE COMPLETION GATE IS MEASURED AGAINST THE SESSIONS THE APP PROGRAMMED',
    requiredSeen.length > 0 && requiredSeen.every((seen) => seen === offeredStrengthSessions),
    `the boundary asked for ${JSON.stringify([...new Set(requiredSeen)])} sessions but the `
    + `app only ever programmed ${offeredStrengthSessions}. An athlete who does everything `
    + 'offered is judged against work they were never given.',
  );

  // ═════════════════════════════════════════════════════════════════════════
  // PROOF 2 — A CONTINUING LIFT PROGRESSES FROM ITS OWN HISTORY
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * THE TRACKED LIFT IS DERIVED, NEVER NAMED.
   *
   * Sam, 2026-08-17: *"Replace brittle exercise-name assumptions with derived
   * identities where the identity itself is not the test subject."* The subject
   * is whether a continuing lift rises; which lift carries it is incidental and
   * a hardcoded name silently stops being block 2's anything the moment rotation
   * or phase preference moves.
   */
  const boundaryHistory = quiet(() => readBlockHistory({
    feedbackByDate: feedbackMap as never,
    blockStartISO: blockOneStart,
    blockEndISO: blockOneEnd,
    requiredStrengthSessions: offeredStrengthSessions,
  }));
  const carriedAndRaisable = [...new Set(blockTwoVisible.days
    .flatMap((day) => day.rows.map((row) => row.name)))]
    .filter((name) => typeof boundaryHistory.lastRecordedLoadByExercise[name] === 'number')
    .filter((name) => smallestPracticalIncrementKg(
      name, boundaryHistory.lastRecordedLoadByExercise[name]!,
    ) !== null);

  console.log(`  lifts in block 2 with the athlete's OWN recorded load and a known `
    + `increment: ${JSON.stringify(carriedAndRaisable)}`);

  ok(
    'at least one lift continues into block 2 carrying the athlete\'s own recorded load',
    carriedAndRaisable.length > 0,
    'no continuing loadable lift — proof 2 would be vacuous, and the rotation policy '
    + 'or the history read is the thing to look at, not the progression',
  );

  const storedDecisions = ((useProgramStore.getState().currentProgram
    ?.blockBoundaryExplanation ?? []) as { exerciseName?: string; kind?: string;
      previousLoadKg?: number; nextLoadKg?: number }[])
    .filter((row) => carriedAndRaisable.includes(String(row.exerciseName)));
  const progressedRows = storedDecisions.filter((row) => row.kind === 'history_progressed');

  ok(
    'THE STORED DECISION PROGRESSES a completed, well-recovered continuing lift',
    progressedRows.length > 0,
    `every continuing lift stored \`history_held\`: ${JSON.stringify(
      [...new Set(storedDecisions.map((row) => `${row.exerciseName}:${row.kind}`))])}`,
  );

  /**
   * AND THE NUMBER THE ATHLETE READS IS THE NUMBER THAT MOVED.
   *
   * A stored decision the projection does not deliver is the delivery break
   * `blockTwoExplanationDeliveryTests` was written for; asserting storage alone
   * would pass on an app that decides correctly and shows the old weight.
   */
  const visibleLoadFor = (name: string): number | null => {
    for (const day of blockTwoVisible.days) {
      for (const row of day.rows) if (row.name === name) return row.weightKg;
    }
    return null;
  };
  const raisedAndVisible = progressedRows.filter((row) =>
    visibleLoadFor(String(row.exerciseName)) === row.nextLoadKg
    && (row.nextLoadKg ?? 0) > (row.previousLoadKg ?? 0));

  ok(
    'THE ATHLETE SEES THE RAISED LOAD — visible prescription equals the decided load',
    progressedRows.length > 0 && raisedAndVisible.length === progressedRows.length,
    progressedRows.map((row) => `${row.exerciseName}: decided ${row.previousLoadKg}`
      + `->${row.nextLoadKg}kg, visible ${visibleLoadFor(String(row.exerciseName))}kg`).join('; '),
  );

  console.log(`\nComplete athlete journey: ${pass} passed, ${fail} failed`);
  totalsPrinted(fail);
  if (fail > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function mondayOf(dateISO: string): string {
  const parsed = new Date(`${dateISO}T12:00:00Z`);
  return addDaysISO(dateISO, -((parsed.getUTCDay() + 6) % 7));
}

function printWeek(heading: string, days: VisibleDay[]): void {
  console.log(`\n  ── ${heading} ──`);
  for (const day of days) {
    if (!day.sessionName) {
      console.log(`  ${day.weekday.padEnd(9)} ${day.dateISO}  —  rest`);
      continue;
    }
    console.log(`  ${day.weekday.padEnd(9)} ${day.dateISO}  —  ${day.sessionName}`);
    for (const row of day.rows) {
      const reps = row.repsMin != null && row.repsMax != null
        ? (row.repsMin === row.repsMax ? `${row.repsMin}` : `${row.repsMin}-${row.repsMax}`)
        : '?';
      console.log(`        · ${row.name} — ${row.sets ?? '?'} × ${reps}`
        + `${row.weightKg != null ? ` @ ${row.weightKg}kg` : ''}`);
    }
  }
  console.log('');
}

function printCensus(census: JourneyCensus): void {
  console.log('\n  ── what the history actually became ──');
  console.log(`  days of feedback stored ................ ${census.storedFeedbackDays}`);
  console.log(`  of those, with a strength log .......... ${census.feedbackWithStrengthLogs}`);
  console.log(`  soreness answers above "none" .......... ${census.storedSorenessAnswers}`);
  console.log(`  days a load was typed in ............... ${census.weightOverrideDays} `
    + `(${census.weightOverrideEntries} loads)`);
  console.log(`  entries the progression reader SEES .... ${census.progressionHistoryEntries}`);
  console.log(`  recorded block selections .............. ${census.recordedSelectionCount}`);
  console.log(`  active exclusions ...................... ${census.activeExclusions}`);
  console.log('');
}

/** The rows as ACCEPTED STORAGE holds them, for the read-time-authorship check. */
function storedWeekRows(weekStartISO: string): { rowCount: number; doseSignature: string } {
  const program = useProgramStore.getState().currentProgram;
  const microcycle = program?.microcycles
    .find((m) => m.startDate.slice(0, 10) === weekStartISO);
  const rows: string[] = [];
  for (const workout of microcycle?.workouts ?? []) {
    for (const row of workout.exercises ?? []) {
      rows.push(`${row.prescribedSets}/${row.prescribedRepsMin}-${row.prescribedRepsMax}`);
    }
  }
  return { rowCount: rows.length, doseSignature: rows.slice().sort().join(';') };
}

function visibleRowSignature(days: VisibleDay[]): { rowCount: number; doseSignature: string } {
  const rows: string[] = [];
  for (const day of days) {
    for (const row of day.rows) rows.push(`${row.sets}/${row.repsMin}-${row.repsMax}`);
  }
  return { rowCount: rows.length, doseSignature: rows.slice().sort().join(';') };
}

/**
 * ROTATION, REPORTED BEFORE IT IS ASSERTED.
 *
 * The approved contract says most exercises change at a block boundary and a
 * main lift may stay for at most two consecutive blocks. Printing the overlap
 * first means the assertion that follows in the next slice is calibrated against
 * what the app really does, not against a number chosen in advance.
 */
function reportRotation(blockOneWeek: VisibleDay[], blockTwoWeek: VisibleDay[]): void {
  const names = (days: VisibleDay[]): Set<string> =>
    new Set(days.flatMap((day) => day.rows.map((row) => row.name)));
  const before = names(blockOneWeek);
  const after = names(blockTwoWeek);
  const kept = [...after].filter((name) => before.has(name));
  console.log('  ── rotation across the boundary ──');
  console.log(`  block 1 final week: ${before.size} distinct exercises`);
  console.log(`  block 2 week 1 ...: ${after.size} distinct exercises`);
  console.log(`  carried over .....: ${kept.length} — ${JSON.stringify(kept)}`);
  console.log('');
}

main().catch((error) => {
  console.error(`\nJOURNEY FAILED — ${
    error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

// Keep the storage map reachable for the relaunch stage in the next slice.
export { localStorageData };
