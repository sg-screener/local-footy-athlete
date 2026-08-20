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
import { useProfileStore } from '../store/profileStore';
import { getAthleteExclusions } from '../store/athletePreferencesStore';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { readBlockHistory, smallestPracticalIncrementKg } from '../rules/blockBoundaryProgression';
import { probeBlock } from './support/acceptBlock';
import {
  coldStartThroughOnboarding,
  followTheWeek,
  leaveExerciseOut,
  quiet,
  acceptExtraSession,
  declineExtraSession,
  extraSessionOfferFor,
  reportFatigue,
  substituteExercise,
  swapOptionsFor,
  recordDay,
  resolvedDays,
  relaunchApp,
  rolloverIfDue,
  setJourneyClock,
  takeCensus,
  visibleProjection,
  weekdayName,
  type DayIntent,
  type JourneyCensus,
  type VisibleDay,
} from './support/athleteJourney';

/** Flush through the real door and report what the persistence OWNER holds. */
async function historyCheckpoint(label: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { flushPendingStorageWrites, asyncStorageCompat } = require('../store/asyncStorageCompat');
  await flushPendingStorageWrites();
  const raw = await asyncStorageCompat.getItem('program-store');
  const inputs = raw
    ? ((JSON.parse(raw) as { state?: { inputs?: Record<string, any> } }).state?.inputs ?? null)
    : null;
  const live = useProgramStore.getState() as unknown as {
    sessionFeedback?: Record<string, unknown>;
  };
  console.log(`  [history @ ${label}] live=${Object.keys(live.sessionFeedback ?? {}).length} `
    + `ON DISK=${Object.keys(inputs?.sessionFeedback ?? {}).length}`);
}

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
  /** Did the app put loggable strength work on this day? Name-independent. */
  hadStrengthRows: boolean;
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

  /**
   * THE LIFT THE ATHLETE EDITS, DERIVED FROM THE PROGRAM, NEVER NAMED.
   *
   * Read off block 1's own first strength day: the subject is whose NUMBER wins,
   * not which exercise carries it, and a hardcoded name stops being block 1's
   * anything the moment selection moves.
   */
  const EDITED_LIFT = (() => {
    for (const day of blockOneVisible.days) {
      for (const row of day.rows) if ((row.weightKg ?? 0) > 0) return row.name;
    }
    throw new Error('block 1 has no loaded strength row — the journey cannot edit a load');
  })();
  /** Deliberately NOT a value progression could reach on its own from 125/80. */
  const EDITED_KG = 111;
  console.log(`  the athlete will edit ${EDITED_LIFT} to ${EDITED_KG}kg in the final week\n`);

  let editedLoadOn: string | null = null;
  let removedForTheDay: {
    dateISO: string; ok: boolean; before: string[]; after: string[];
  } | null = null;
  let soreness: {
    dateISO: string; ok: boolean; message: string; weekStart: string;
    before: string[]; after: string[];
    explanationsBefore: string[]; explanationsAfter: string[];
    modifiers: string[];
  } | null = null;
  let substitution: {
    dateISO: string; ok: boolean; message: string;
    from: string; to: string; outgoingLoadKg: number | null;
    dayBefore: string[]; dayAfter: string[]; replacementLoadKg: number | null;
    selectionsBefore: number; selectionsAfter: number;
    exclusionsBefore: number; exclusionsAfter: number;
    sigBefore: string[]; sigAfter: string[];
  } | null = null;
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

    /**
     * THE ATHLETE EDITS ONE LOAD, in the last week of block 1.
     *
     * Late on purpose: `lastRecordedLoadByExercise` keeps the LAST valid load per
     * exercise over all time, so an edit early in the block would be overwritten
     * by later confirm-the-card days and the cell below would pass or fail for
     * the wrong reason.
     */
    const isTheEdit = weekIndex === BLOCK_ONE_WEEKS
      && weekdayName(dateISO) === 'Monday' && editedLoadOn === null;
    if (isTheEdit) editedLoadOn = dateISO;

    const intent = isTheMiss
      ? MISSED
      : (isTheEdit
        ? { ...DID_THE_WORK, editLoad: { exerciseName: EDITED_LIFT, toKg: EDITED_KG } }
        : DID_THE_WORK);
    /**
     * A TEMPORARY REMOVAL — *"Today only: removed from this session; future
     * sessions and blocks are unaffected."*
     *
     * Applied to a lift that CONTINUES into block 2, because the interesting
     * failure is over-application: an exclusion that leaks past the day it was
     * answered for. A today-only removal of a lift that rotates out anyway could
     * not tell a working scope from a broken one.
     */
    if (weekIndex === 2 && weekdayName(dateISO) === 'Monday' && !removedForTheDay) {
      const before = resolvedDays(mondayOf(dateISO))
        .flatMap((day) => day.rows.map((row) => row.name));
      const decision = leaveExerciseOut({
        exercise: EDITED_LIFT, scope: 'today_only', decidedOnISO: dateISO,
        reason: 'shoulder felt off warming up',
      });
      const after = resolvedDays(mondayOf(dateISO))
        .flatMap((day) => day.rows.map((row) => row.name));
      removedForTheDay = { dateISO, ok: decision.ok, before, after };
    }

    /**
     * ONE ORDINARY SUBSTITUTION — week 2's Wednesday, on a LOADED row.
     *
     * The outgoing row is loaded on purpose: *"the replacement never inherits
     * another exercise's load"* cannot be tested on two bodyweight rows, and no
     * `weight` is supplied to the door, so whatever load the replacement ends up
     * with is the app's decision and not this harness's.
     *
     * The replacement is DERIVED from the app's own programming — a lift it chose
     * for this athlete elsewhere in the block, so it is legal for their kit and
     * phase by construction rather than by my guess. An invented name would be
     * refused by `assessTapSwapCandidateSafety` and the cell would read as a
     * product defect.
     */
    if (weekIndex === 3 && weekdayName(dateISO) === 'Monday' && substitution === null) {
      const weekStart = mondayOf(dateISO);
      const today = resolvedDays(weekStart).find((day) => day.dateISO === dateISO);
      /**
       * THE ATHLETE MAY SWAP ANY ROW, so this tries every row on the day against
       * every option the app offers for it, and keeps the first pairing the door
       * ACCEPTS. Rows are tried from the bottom up: an accessory swap is the
       * commonest real substitution and the least likely to re-shape the session.
       *
       * ⚠ **EVERY REFUSAL IS KEPT.** An earlier cut asserted the load claim after a
       * swap that had been REFUSED — the replacement's load read `null` simply
       * because the exercise was never in the day, so the cell was green and empty.
       * The load claim below is now asserted only on a swap that actually landed.
       */
      const candidateRows = [...(today?.rows ?? [])].reverse();
      const refusals: string[] = [];
      let door: { ok: boolean; message: string } = { ok: false, message: 'nothing offered' };
      let outgoing: typeof candidateRows[number] | null = null;
      let elsewhere: { name: string } | null = null;
      const exclusionsBefore = takeCensus(dateISO).activeExclusions;
      const selectionsBefore = takeCensus(dateISO).recordedSelectionCount;
      const dayBefore = (today?.rows ?? []).map((row) => row.name);
      const sigOf = (rows: { name: string; sets: number | null; repsMin: number | null;
        repsMax: number | null; weightKg: number | null }[]): string[] => rows
        .map((row) => `${row.name}|${row.sets}|${row.repsMin}-${row.repsMax}|${row.weightKg}`);
      const sigBefore = sigOf(today?.rows ?? []);

      for (const row of candidateRows) {
        const offered = swapOptionsFor({
          dateISO,
          originalExercise: row.name,
          existingExerciseNames: dayBefore,
        });
        if (offered.length === 0) { refusals.push(`${row.name}: no option offered`); continue; }
        for (const candidate of offered) {
          const attempt = await substituteExercise({
            dateISO,
            weekStartISO: weekStart,
            fromExercise: row.name,
            toExercise: {
              name: candidate.name,
              sets: row.sets ?? 3,
              repsMin: row.repsMin ?? 5,
              repsMax: row.repsMax ?? 8,
            },
          });
          if (attempt.ok) {
            door = attempt; outgoing = row; elsewhere = { name: candidate.name };
            break;
          }
          refusals.push(`${row.name} -> ${candidate.name}: ${attempt.message}`);
        }
        if (elsewhere) break;
      }
      console.log(`  substitutions the athlete was refused (${refusals.length}):`);
      for (const line of refusals.slice(0, 8)) console.log(`      ${line}`);

      if (outgoing && elsewhere) {
        const afterDay = resolvedDays(weekStart).find((day) => day.dateISO === dateISO);
        substitution = {
          dateISO, ok: door.ok, message: door.message,
          from: outgoing.name, to: elsewhere.name,
          outgoingLoadKg: outgoing.weightKg,
          dayBefore,
          dayAfter: (afterDay?.rows ?? []).map((row) => row.name),
          replacementLoadKg: (afterDay?.rows ?? [])
            .find((row) => row.name === elsewhere.name)?.weightKg ?? null,
          selectionsBefore,
          selectionsAfter: takeCensus(dateISO).recordedSelectionCount,
          exclusionsBefore,
          exclusionsAfter: takeCensus(dateISO).activeExclusions,
          sigBefore,
          sigAfter: sigOf(afterDay?.rows ?? []),
        };
      }
    }

    /**
     * THE ATHLETE SAYS THEY ARE SORE — the readiness door, as its own tap.
     *
     * Late in the block on purpose: the effect has to still be live when the
     * same-block restart below asks whether it survived, and a week-1 answer would
     * have expired by then.
     */
    if (weekIndex === BLOCK_ONE_WEEKS && weekdayName(dateISO) === 'Monday'
      && soreness === null) {
      const weekStart = mondayOf(dateISO);
      const before = resolvedDays(weekStart).find((day) => day.dateISO === dateISO);
      const beforeVisible = visibleProjection(weekStart, dateISO);
      const door = await reportFatigue({ dateISO, weekStartISO: weekStart, level: 'sore' });
      const after = resolvedDays(weekStart).find((day) => day.dateISO === dateISO);
      const afterVisible = visibleProjection(weekStart, dateISO);
      soreness = {
        dateISO, ok: door.ok, message: door.message, weekStart,
        before: (before?.rows ?? []).map((r) =>
          `${r.name}|${r.sets}|${r.repsMin}-${r.repsMax}|${r.weightKg}`),
        after: (after?.rows ?? []).map((r) =>
          `${r.name}|${r.sets}|${r.repsMin}-${r.repsMax}|${r.weightKg}`),
        explanationsBefore: beforeVisible.explanations,
        explanationsAfter: afterVisible.explanations,
        // THE STATUS SURFACE — where a temporary status explains itself to the
        // athlete. The block-boundary `explanations` channel is a different thing
        // (it explains a NEW BLOCK), so asserting there would look for the words in
        // a surface that was never going to carry them.
        modifiers: quiet(() => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { getActiveProgramModifiers } = require('../utils/activeProgramModifiers');
          return (getActiveProgramModifiers(dateISO) as {
            type?: string; title?: string; detail?: string; effect?: string;
            summary?: string; description?: string;
          }[]).map((m) => JSON.stringify(m).slice(0, 400));
        }),
      };
    }

    const outcome = await recordDay(dateISO, intent);
    walked.push({
      dateISO,
      weekday: weekdayName(dateISO),
      sessionName: outcome.sessionName,
      hadStrengthRows: (resolvedDays(mondayOf(dateISO))
        .find((day) => day.dateISO === dateISO)?.rows ?? []).length > 0,
      result: outcome.result,
      detail: 'detail' in outcome ? outcome.detail ?? null : null,
    });
  }

  /**
   * COUNTED DURING THE WALK, because after the rollover the store is in block 2 and
   * re-resolving a block-1 week returns nothing — the live-state trap.
   *
   * ⚠ **COUNTED BY ROWS, NOT BY THE DAY'S NAME.** This filtered on
   * `sessionName === 'full_body'` and silently fell to 0 the moment the athlete
   * substituted an exercise: the canonicaliser legitimately renames a day from its
   * final content (`final_content_owns_name`), so a name-keyed counter measures the
   * app's naming, not the athlete's training. Club nights and the fixture carry no
   * strength rows, so counting rows separates them without naming anything.
   */
  const offeredStrengthSessions = walked.filter((day) => (day.result === 'recorded'
    || day.result === 'not_recorded') && day.hadStrengthRows).length;

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

  await historyCheckpoint('after the 4-week walk');
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

  // ═════════════════════════════════════════════════════════════════════════
  // ACTION 1 — AN ORDINARY SUBSTITUTION
  // ═════════════════════════════════════════════════════════════════════════

  console.log(`\n  substitution on ${substitution?.dateISO}: ${substitution?.from} -> `
    + `${substitution?.to} · ok=${substitution?.ok} ${
      substitution?.message ? `(${substitution.message})` : ''}`);
  console.log(`    that day before: ${JSON.stringify(substitution?.dayBefore)}`);
  console.log(`    that day after : ${JSON.stringify(substitution?.dayAfter)}`);
  console.log(`    outgoing load=${substitution?.outgoingLoadKg}kg `
    + `replacement load=${substitution?.replacementLoadKg}kg`);
  console.log(`    block-selection records: ${substitution?.selectionsBefore} -> `
    + `${substitution?.selectionsAfter}`);

  /**
   * ⚠ **NO ORDINARY SUBSTITUTION CAN LAND ON A GENERATED STRENGTH DAY TODAY.**
   *
   * Every row on the day was offered options by the app and every pairing was
   * refused — measured, 9 attempts across 5 rows. Eight of the nine were refused by
   * the PRE-EXISTING equivalence check (`workoutsAreEquivalent(current,
   * canonicalWorkout)`): `validateLiveWorkoutWrite` UNDOES the swap entirely. The
   * ninth, the main lower lift, is the one that re-shapes the day.
   *
   * This is the composition defect already sized as its own unit — *"removing a row
   * silently re-shapes the day downstream … the kit must be known when the day is
   * COMPOSED, not subtracted from afterwards. Size it as a composition unit, not a
   * guard."* It is NOT this mission, and it is NOT caused by anything here: the
   * eight equivalence refusals come from code this branch never touched.
   *
   * The cells below therefore report ONE red — this one — rather than five, because
   * the four downstream claims cannot be evaluated on a swap that never happened,
   * and asserting them anyway is how a green-and-empty cell is born (an earlier cut
   * of this suite "proved" the load claim on a refused swap: the replacement read
   * `null` because it was never in the day at all).
   */
  ok(
    'ACTION 1 — an ordinary substitution lands through the real door',
    substitution?.ok === true,
    `every offered substitution on ${substitution?.dateISO ?? 'the chosen day'} was refused. `
    + `First reasons: ${String(substitution?.message ?? '(none)').slice(0, 240)}`,
  );

  const substitutionLanded = substitution?.ok === true;
  /**
   * ⚠ **A CONDITIONAL CELL MUST SAY IT WAS NOT EVALUATED.** Without this the four
   * claims below print `PASS` on a world where no substitution happened, which is
   * the same green-and-empty reading the gate was added to prevent — just one layer
   * up. The name carries the condition so no reader can bank an unevaluated claim.
   */
  const suffix = substitutionLanded
    ? ''
    : ' [NOT EVALUATED — no substitution landed; see ACTION 1]';

  ok(
    `SUBSTITUTION CHANGES THE VISIBLE EXERCISE${suffix}`,
    !substitutionLanded ||
    substitution != null
      && !substitution.dayAfter.includes(substitution.from)
      && substitution.dayAfter.includes(substitution.to),
    `after=${JSON.stringify(substitution?.dayAfter)} still contains `
    + `${substitution?.from} or is missing ${substitution?.to}`,
  );

  /**
   * ⚠ AN ORDINARY SUBSTITUTION IS NOT A PIN AND NOT A BAN.
   *
   * The contract: *"An ordinary substitution changes the programmed row without
   * banning the original exercise. The substituted movement may rotate normally at
   * the next block boundary."* So no exclusion may appear, and no preferred
   * alternative may be pinned — `futureWeeksToo` was false, and the executor only
   * calls `setPreferredAlternative` when it is true.
   */
  ok(
    `the substitution created NO exclusion — the original is not banned${suffix}`,
    !substitutionLanded ||
    substitution != null && substitution.exclusionsAfter === substitution.exclusionsBefore,
    `active exclusions went ${substitution?.exclusionsBefore} -> `
    + `${substitution?.exclusionsAfter} across an ordinary substitution; a swap must not ban `
    + 'the exercise it replaced. (Compared BEFORE/AFTER rather than against zero, because '
    + 'the athlete already holds a today-only exclusion from week 2 by this point — a '
    + 'zero-check would fail on unrelated state and read as this defect.)',
  );

  const pinnedAlternatives = quiet(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAthletePreferencesStore } = require('../store/athletePreferencesStore');
    const prefs = useAthletePreferencesStore.getState().prefs as {
      preferredAlternatives?: Record<string, unknown>;
    };
    return Object.keys(prefs.preferredAlternatives ?? {});
  });
  ok(
    `the substitution pinned NOTHING for future weeks${suffix}`,
    !substitutionLanded ||
    pinnedAlternatives.length === 0,
    `pinned ${JSON.stringify(pinnedAlternatives)} — that is the "future weeks too" door, `
    + 'not an ordinary substitution',
  );

  /**
   * AND IT DID NOT CORRUPT BLOCK-SELECTION HISTORY.
   *
   * The history records what each ACCEPTED BLOCK selected. A one-day swap is not a
   * block acceptance, so it must add no records — otherwise the next boundary
   * rotates against a block that never happened.
   */
  ok(
    `the substitution wrote NO block-selection records${suffix}`,
    !substitutionLanded ||
    substitution?.selectionsBefore === substitution?.selectionsAfter,
    `records went ${substitution?.selectionsBefore} -> ${substitution?.selectionsAfter}; a `
    + 'one-day swap is not a block acceptance',
  );

  ok(
    `THE REPLACEMENT DID NOT INHERIT THE OUTGOING EXERCISE'S LOAD${suffix}`,
    !substitutionLanded ||
    substitution != null
      && substitution.replacementLoadKg !== substitution.outgoingLoadKg,
    `the replacement came in at ${substitution?.replacementLoadKg}kg, which is exactly what `
    + `${substitution?.from} was loaded at (${substitution?.outgoingLoadKg}kg)`,
  );

  /**
   * EVERY UNRELATED ROW IS BYTE-IDENTICAL — name, sets, rep range AND load.
   *
   * The earlier version of this compared NAMES only, which would pass while a
   * swap quietly re-dosed the rest of the session. The whole defect this action
   * uncovered was unrelated rows being rewritten, so the claim has to be about the
   * rows' full content, and only the swapped row may differ.
   */
  const untouchedBefore = (substitution?.sigBefore ?? [])
    .filter((sig) => !sig.startsWith(`${substitution?.from}|`));
  const untouchedAfter = (substitution?.sigAfter ?? [])
    .filter((sig) => !sig.startsWith(`${substitution?.to}|`));
  console.log(`    unrelated rows before: ${JSON.stringify(untouchedBefore)}`);
  console.log(`    unrelated rows after : ${JSON.stringify(untouchedAfter)}`);

  ok(
    `EVERY UNRELATED ROW IS BYTE-IDENTICAL across the substitution${suffix}`,
    !substitutionLanded
    || JSON.stringify(untouchedBefore) === JSON.stringify(untouchedAfter),
    `before ${JSON.stringify(untouchedBefore)}\n  after  ${JSON.stringify(untouchedAfter)}`,
  );

  ok(
    `the substitution replaced EXACTLY ONE row${suffix}`,
    !substitutionLanded
    || (substitution!.sigBefore.length === substitution!.sigAfter.length
      && untouchedBefore.length === substitution!.sigBefore.length - 1),
    `${substitution?.sigBefore.length} rows before, ${substitution?.sigAfter.length} after`,
  );

  /**
   * THE REPLACEMENT TOOK ITS OWN AUTHORED ESTIMATE.
   *
   * Sam: *"otherwise its authored starting estimate"*. `startingWeightForAthlete`
   * is the authored owner and reads only the exercise and the athlete's own
   * squat/bench answers — **it cannot see the outgoing exercise**, which is what
   * makes this the opposite of inheritance rather than a coincidence that the two
   * numbers differ.
   */
  const authoredEstimate = quiet(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { startingWeightForAthlete } = require('../utils/loadEstimation');
    return startingWeightForAthlete(String(substitution?.to ?? ''), theAthlete());
  }) as number | null;
  console.log(`    ${substitution?.to} authored estimate for this athlete: ${authoredEstimate}kg`
    + ` · prescribed after the swap: ${substitution?.replacementLoadKg}kg`
    + ` · the outgoing ${substitution?.from} was ${substitution?.outgoingLoadKg}kg`);

  ok(
    `AN UNSEEN REPLACEMENT USES ITS OWN AUTHORED ESTIMATE${suffix}`,
    !substitutionLanded
    || (typeof authoredEstimate === 'number' && authoredEstimate > 0
      ? substitution!.replacementLoadKg === authoredEstimate
      : substitution!.replacementLoadKg === null),
    `prescribed ${substitution?.replacementLoadKg}kg, authored estimate ${authoredEstimate}kg`,
  );

  // ═════════════════════════════════════════════════════════════════════════
  // ACTION 2 — TIRED/SORE FEEDBACK
  // ═════════════════════════════════════════════════════════════════════════

  console.log(`\n  the athlete reported SORE on ${soreness?.dateISO}: ok=${soreness?.ok} `
    + `${soreness?.message ? `(${soreness.message})` : ''}`);
  console.log(`    that day before: ${JSON.stringify(soreness?.before)}`);
  console.log(`    that day after : ${JSON.stringify(soreness?.after)}`);
  console.log(`    explanations before: ${JSON.stringify(soreness?.explanationsBefore)}`);
  console.log(`    explanations after : ${JSON.stringify(soreness?.explanationsAfter)}`);
  console.log(`    active modifiers the athlete can see (${soreness?.modifiers.length}):`);
  for (const m of soreness?.modifiers ?? []) console.log(`      ${m}`);

  ok(
    'ACTION 2 — the tired/sore report is ACCEPTED by the real readiness door',
    soreness?.ok === true,
    `refused: ${soreness?.message}`,
  );

  /** Row name -> its parts, for comparing what changed against what held. */
  const parse = (sig: string) => {
    const [name, sets, reps, weight] = sig.split('|');
    return { name, sets, reps, weight };
  };
  const beforeRows = (soreness?.before ?? []).map(parse);
  const afterRows = (soreness?.after ?? []).map(parse);
  const survivors = afterRows.filter((row) => beforeRows.some((b) => b.name === row.name));

  /**
   * LOAD IS HELD. The approved contract's low-readiness order is explicit —
   * *"retain meaningful load/intensity where safe while performing less total
   * work"*. A reduction that drops the weight is a different (and wrong) answer,
   * and it is the one an athlete notices most.
   */
  ok(
    'SORE HOLDS THE LOAD — every surviving row keeps the weight it had',
    survivors.length > 0 && survivors.every((row) =>
      row.weight === beforeRows.find((b) => b.name === row.name)?.weight),
    survivors.map((row) => `${row.name}: `
      + `${beforeRows.find((b) => b.name === row.name)?.weight} -> ${row.weight}`).join('; '),
  );

  ok(
    'SORE REDUCES THE VOLUME — sets come down on the work that remains',
    survivors.length > 0 && survivors.some((row) =>
      Number(row.sets) < Number(beforeRows.find((b) => b.name === row.name)?.sets)),
    survivors.map((row) => `${row.name}: `
      + `${beforeRows.find((b) => b.name === row.name)?.sets} -> ${row.sets} sets`).join('; '),
  );

  ok(
    'SORE DOES NOT SHORTEN THE REP RANGES — the change is volume, not the prescription',
    survivors.every((row) => row.reps === beforeRows.find((b) => b.name === row.name)?.reps),
    survivors.map((row) => `${row.name}: `
      + `${beforeRows.find((b) => b.name === row.name)?.reps} -> ${row.reps}`).join('; '),
  );

  /**
   * AND THE ATHLETE IS TOLD, ACCURATELY.
   *
   * ⚠ **ASSERTED ON THE STATUS SURFACE, NOT ON `explanations`.** The projection's
   * `explanations` channel explains a NEW BLOCK; a temporary status explains itself
   * through `getActiveProgramModifiers`. Looking for these words in the block
   * channel would have reported a missing explanation that was never going to be
   * there — measured: `explanations` is `[]` either side of this tap, correctly.
   *
   * The `effect` must be the one that actually happened. A modifier claiming
   * `volume_adjusted` beside an unchanged session, or beside a load cut, would be a
   * worse defect than saying nothing.
   */
  ok(
    'SORE PRODUCES AN ACCURATE VISIBLE EXPLANATION — and it names what really changed',
    (soreness?.modifiers.length ?? 0) > 0
      && soreness!.modifiers.some((m) => m.includes('"effect":"volume_adjusted"'))
      && soreness!.modifiers.some((m) => m.includes('"type":"temporary_status"')),
    `the athlete sees ${JSON.stringify(soreness?.modifiers)}`,
  );

  /**
   * ── SAME-BLOCK RESTART, and it has to be same-block ──
   *
   * A temporary status governs the day it was answered for. The journey's other
   * relaunch happens after the rollover, by which time this answer is legitimately
   * historical — so proving it there would prove nothing. This closes the app while
   * the athlete is still standing in the block they reported sore in.
   */
  const sameBlockInputsBeforeRestart = JSON.stringify({
    profile: useProfileStore.getState().onboardingData,
    isOnboardingComplete: useProfileStore.getState().isOnboardingComplete,
    sessionFeedback: useProgramStore.getState().sessionFeedback,
    weightOverrides: useProgramStore.getState().weightOverrides,
    exclusions: getAthleteExclusions(),
    decisions: useDecisionLedgerStore.getState().entries ?? [],
  });
  const soreRelaunch = await relaunchApp({
    storage: localStorageData, todayISO: soreness!.dateISO,
  });
  followTheWeek(soreness!.dateISO);
  const afterSoreRestart = resolvedDays(soreness!.weekStart)
    .find((day) => day.dateISO === soreness!.dateISO);
  const soreRestartRows = (afterSoreRestart?.rows ?? []).map((r) =>
    `${r.name}|${r.sets}|${r.repsMin}-${r.repsMax}|${r.weightKg}`);
  const modifiersAfterRestart = quiet(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getActiveProgramModifiers } = require('../utils/activeProgramModifiers');
    return (getActiveProgramModifiers(soreness!.dateISO) as unknown[]).length;
  });
  console.log(`    after a same-block restart: ${JSON.stringify(soreRestartRows)}`);
  console.log(`    active modifiers after restart: ${modifiersAfterRestart}`);

  ok(
    'the app relaunches cleanly with a live tired/sore report',
    soreRelaunch.ok,
    `boot failed: ${soreRelaunch.error}`,
  );

  ok(
    'SAME-BLOCK RESTART preserves profile, results, exclusions and decisions exactly',
    JSON.stringify({
      profile: useProfileStore.getState().onboardingData,
      isOnboardingComplete: useProfileStore.getState().isOnboardingComplete,
      sessionFeedback: useProgramStore.getState().sessionFeedback,
      weightOverrides: useProgramStore.getState().weightOverrides,
      exclusions: getAthleteExclusions(),
      decisions: useDecisionLedgerStore.getState().entries ?? [],
    }) === sameBlockInputsBeforeRestart,
    'one or more canonical inputs changed during relaunch',
  );

  ok(
    'SORE SURVIVES A GENUINE RESTART — the reduced day and its explanation both return',
    JSON.stringify(soreRestartRows) === JSON.stringify(soreness?.after)
      && (modifiersAfterRestart as number) > 0,
    `before restart ${JSON.stringify(soreness?.after)}\n  after restart  `
    + `${JSON.stringify(soreRestartRows)} · modifiers=${modifiersAfterRestart}`,
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

  // ── A LONGER EXCLUSION, answered before the block turns over ────────────
  //
  // *"Until I change it: excluded from all future programming until the athlete
  // restores it."* Aimed at a lift that WOULD otherwise continue — the exclusion
  // has to beat rotation's own preference for keeping a progressing main lift, so
  // excluding something that rotates out anyway would prove nothing.
  const BANNED_LIFT = (() => {
    for (const day of blockOneFinal) {
      for (const row of day.rows) {
        if ((row.weightKg ?? 0) > 0 && row.name !== EDITED_LIFT) return row.name;
      }
    }
    throw new Error('no second loaded lift in block 1 to exclude');
  })();
  const banned = leaveExerciseOut({
    exercise: BANNED_LIFT, scope: 'until_changed', decidedOnISO: blockOneLastWeek,
    reason: 'it always aggravates my back',
  });
  console.log(`  the athlete asks to leave ${BANNED_LIFT} out until they change it: `
    + `ok=${banned.ok} scope=${banned.exclusion?.scope} `
    + `activeThrough=${JSON.stringify(banned.exclusion?.activeThroughISO ?? null)} `
    + `rebuildRequired=${banned.rebuildRequired}`);

  ok(
    `the longer exclusion is stored as a decision with NO expiry (${BANNED_LIFT})`,
    banned.ok && banned.exclusion?.scope === 'until_changed'
      && (banned.exclusion?.activeThroughISO ?? null) === null,
    `got ${JSON.stringify(banned.exclusion ?? null)} — an "until I change it" answer that `
    + 'carries an expiry is a this-block exclusion wearing the wrong scope',
  );

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
  console.log('  the requirement each accepted block recorded: '
    + `${JSON.stringify((useProgramStore.getState() as unknown as {
      acceptedBlocks: Record<string, { blockNumber: number;
      requiredStrengthSessions: number }> }).acceptedBlocks)}`);
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

  console.log(`  live blockState immediately after the rollover: ${JSON.stringify(
    (useProgramStore.getState() as unknown as { blockState: unknown }).blockState)}`);

  await historyCheckpoint('after the rollover');
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

  /**
   * EVERY ACCEPTANCE RECORDS ITS OWN BLOCK, INCLUDING THE ONE JUST STARTED.
   *
   * ⚠ **THIS CELL EXISTS BECAUSE A MUTATION SURVIVED WITHOUT IT.** Deleting the
   * writer from `weekRebuild.commitRebuiltProgram` — the door the ROLLOVER
   * publishes through — changed nothing anywhere else in this journey, because
   * the journey only ever READS block 1's requirement and block 1 is recorded by
   * the other door. The rollover's write would have shipped unguarded and the
   * failure would surface one block later, at the block-2 -> block-3 boundary,
   * as loads that stop progressing for no visible reason.
   *
   * Sam's ruling is *"one durable owner at block acceptance"* — so the claim is
   * that acceptance records, every time, not that this particular journey
   * happens to read it.
   */
  const recordedRequirements = (useProgramStore.getState() as unknown as {
    acceptedBlocks: Record<string, { blockNumber: number;
      requiredStrengthSessions: number }> }).acceptedBlocks ?? {};

  ok(
    'EVERY ACCEPTED BLOCK RECORDED ITS OWN REQUIREMENT — block 1 AND the block just rolled into',
    typeof recordedRequirements[blockOneStart] === 'object'
      && recordedRequirements[blockOneStart].requiredStrengthSessions > 0
      && typeof recordedRequirements[blockTwoStart] === 'object'
      && recordedRequirements[blockTwoStart].requiredStrengthSessions > 0,
    `recorded ${JSON.stringify(recordedRequirements)} — expected an entry for block 1 `
    + `(${blockOneStart}) and for block 2 (${blockTwoStart}). A missing block-2 entry is a `
    + 'rollover that accepted a block without recording what it required, and the next '
    + 'boundary will silently refuse to progress anyone.',
  );

  /**
   * AND THERE IS NO FALLBACK — proved on the branch where a fallback would fire.
   *
   * Sam, 2026-08-17: *"Do not add a fallback to either of the two refuted
   * numbers."* A cell asserting the denominator on the normal path cannot see a
   * fallback at all: the recorded entry exists there, so `?? something-wrong`
   * never evaluates. **Re-introducing both refuted fallbacks left this suite
   * fully green until this cell existed** — a mutation surviving because its
   * branch is unreachable says nothing about the guard.
   *
   * So this authors with an EMPTY requirements map, which is the state a
   * speculative probe and a block-1 athlete are really in, and asserts the
   * denominator generation used is 0. Only the ARGUMENT matters, so a refusal
   * from the authoring itself is fine and is deliberately swallowed — the wrap
   * has already captured what it needed by then.
   */
  const probeRequired: number[] = [];
  const probeModule = require('../rules/blockBoundaryProgression') as {
    readBlockHistory: typeof readBlockHistory;
  };
  const realProbeReader = probeModule.readBlockHistory;
  probeModule.readBlockHistory = ((callArgs: Parameters<typeof readBlockHistory>[0]) => {
    probeRequired.push(callArgs.requiredStrengthSessions);
    return realProbeReader(callArgs);
  }) as never;
  try {
    quiet(() => probeBlock(theAthlete(), {
      todayISO: blockTwoStart,
      blockNumber: 2,
      progressionHistory: {
        sessionFeedback: feedbackMap as never,
        weightOverrides: {},
        blockState: null,
        // THE POINT OF THE PROBE: nothing recorded, so a fallback would fire.
        acceptedBlocks: {},
      },
    } as never));
  } catch {
    // An authoring refusal is not this cell's subject; the denominator is.
  } finally {
    probeModule.readBlockHistory = realProbeReader;
  }

  console.log(`  denominator with NOTHING recorded: ${JSON.stringify(
    [...new Set(probeRequired)])}`);

  ok(
    'WITH NO RECORDED REQUIREMENT THE DENOMINATOR IS 0 — neither refuted number is a fallback',
    probeRequired.length > 0 && probeRequired.every((seen) => seen === 0),
    `got ${JSON.stringify([...new Set(probeRequired)])}. A non-zero value here is a fallback `
    + 'to requested gym availability or to a recalculated planning target, both of which were '
    + 'measured wrong on this athlete and both of which Sam ruled out.',
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

  // ═════════════════════════════════════════════════════════════════════════
  // PROOF 3 — THE ATHLETE'S OWN EDITED NUMBER IS WHAT BLOCK 2 BUILDS ON
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The approved contract: *"Every suggested load remains editable and the
   * athlete has the final say"*, and *"never round, rewrite or 'correct' the
   * athlete's recorded number; their number remains the base."*
   *
   * So block 2 must start from `EDITED_KG`, not from the load the app had
   * suggested. A cell that only checked "the load went up" would pass on an app
   * that ignored the edit and progressed its own suggestion instead.
   */
  const editedDecision = ((useProgramStore.getState().currentProgram
    ?.blockBoundaryExplanation ?? []) as { exerciseName?: string; kind?: string;
      previousLoadKg?: number; nextLoadKg?: number }[])
    .find((row) => row.exerciseName === EDITED_LIFT);

  console.log(`  the athlete edited ${EDITED_LIFT} to ${EDITED_KG}kg on ${editedLoadOn}`);
  console.log(`  block 2's decision for it: ${JSON.stringify(editedDecision ?? null)}`);

  ok(
    `block 2 builds ${EDITED_LIFT} from the athlete's OWN edited ${EDITED_KG}kg, not the app's suggestion`,
    editedDecision?.previousLoadKg === EDITED_KG,
    `the boundary started from ${JSON.stringify(editedDecision?.previousLoadKg)}kg — the `
    + `athlete typed ${EDITED_KG}kg and has the final say on load`,
  );

  // ═════════════════════════════════════════════════════════════════════════
  // PROOF 4 — ROTATION: an unseen lift never inherits another exercise's load
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The contract: *"When an exercise rotates, the old exercise's load must not be
   * blindly transferred and increased; the athlete selects a safe starting load
   * for the new movement."* And separately: *"unseen lifts use the authored
   * starting estimate where available."*
   *
   * Both are claims about DECISION KIND, so both are read off the kind rather
   * than off the number — a load that merely differs from the outgoing lift's
   * could still have been inherited and then adjusted.
   */
  const allDecisions = ((useProgramStore.getState().currentProgram
    ?.blockBoundaryExplanation ?? []) as { exerciseName?: string; kind?: string;
      previousLoadKg?: number; nextLoadKg?: number }[]);
  const kinds = new Map<string, string>();
  for (const row of allDecisions) kinds.set(String(row.exerciseName), String(row.kind));
  console.log(`  block 2 decision kinds: ${JSON.stringify([...kinds].sort())}`);

  const everRecorded = new Set(Object.keys(boundaryHistory.lastRecordedLoadByExercise));
  const inheritedWithoutHistory = [...kinds].filter(([name, kind]) =>
    !everRecorded.has(name) && (kind === 'history_progressed' || kind === 'history_held'));

  ok(
    'ROTATION: no lift the athlete never recorded carries a from-history load',
    inheritedWithoutHistory.length === 0,
    `${JSON.stringify(inheritedWithoutHistory)} claim a history load with no recorded history `
    + 'under that exact name — that is another exercise\'s number being inherited',
  );

  const rotatedIn = [...kinds].filter(([name]) => !everRecorded.has(name));
  console.log(`  rotated-in lifts and their decision kinds: ${JSON.stringify(rotatedIn)}`);

  ok(
    'UNSEEN LIFTS: every rotated-in lift is decided by estimate, unset or bodyweight — never by history',
    rotatedIn.length === 0 || rotatedIn.every(([, kind]) =>
      kind === 'authored_estimate' || kind === 'unset' || kind === 'bodyweight_default'),
    `got ${JSON.stringify(rotatedIn)}`,
  );

  // ═════════════════════════════════════════════════════════════════════════
  // PROOF 5 — THE TWO EXCLUSION SCOPES KEEP THEIR OWN REACH
  // ═════════════════════════════════════════════════════════════════════════

  const blockTwoNames = new Set(blockTwoVisible.days
    .flatMap((day) => day.rows.map((row) => row.name)));

  /**
   * ⚠ **`today_only` RECORDS THE SCOPE ANSWER; IT DOES NOT REMOVE THE ROW.**
   *
   * `applyExerciseExclusionDecision`'s own comment says so — *"`today_only`
   * changes THIS session, which the removal override already did"* — and it
   * returns `rebuildRequired: false` for exactly that reason. The row leaves the
   * day through a separate `remove_exercise` program-control action; this door
   * answers the *"how long should we leave this out?"* question that follows it.
   *
   * So the print below shows the lift still present in that week AFTER the
   * decision, and that is CORRECT, not a defect. It is printed rather than hidden
   * because the two halves look like one act from the athlete's side, and a
   * reader who assumed this door removes rows would mis-read every cell here.
   * **The row-removal half is NOT walked by this journey — see the not-covered
   * list.**
   */
  console.log(`  today-only scope answer on ${removedForTheDay?.dateISO}: ok=${
    removedForTheDay?.ok} · ${EDITED_LIFT} present in that week before=${
    removedForTheDay?.before.includes(EDITED_LIFT)} after=${
    removedForTheDay?.after.includes(EDITED_LIFT)} `
    + '(after=true is expected: this door records the scope, it does not remove the row)');

  ok(
    'the temporary removal\'s SCOPE ANSWER was accepted by the one exclusion owner',
    removedForTheDay?.ok === true,
    'the day screen\'s Remove button refused',
  );

  /**
   * ⚠ THE TODAY-ONLY SCOPE IS PROVED BY WHAT IT DID **NOT** DO.
   *
   * *"future sessions and blocks are unaffected"*. So the claim is that block 2
   * still programs it — and this is the cell that would catch a scope answer being
   * silently upgraded to a ban, which is the failure that costs an athlete a lift
   * they only wanted to skip once.
   */
  ok(
    `TODAY-ONLY did not leak: block 2 still programs ${EDITED_LIFT}`,
    blockTwoNames.has(EDITED_LIFT),
    `${EDITED_LIFT} is missing from block 2 — a one-day answer became a ban`,
  );

  ok(
    `UNTIL-I-CHANGE-IT holds: block 2 does NOT program ${BANNED_LIFT}`,
    !blockTwoNames.has(BANNED_LIFT),
    `${BANNED_LIFT} is back in block 2 despite an active exclusion — nothing may quietly `
    + 'restore an excluded exercise',
  );

  const liveExclusions = takeCensus(blockTwoStart).activeExclusions;
  ok(
    'the exclusion survives the block boundary as an active decision',
    liveExclusions > 0,
    `${liveExclusions} active exclusions after the rollover — the decision was dropped`,
  );

  /**
   * NEXT BLOCK ROTATES NORMALLY, UNAFFECTED BY THE TEMPORARY SWAP.
   *
   * Sam: a substitution *"does not become a pin, exclusion or future-block
   * selection"*. The pin and exclusion halves are asserted at the moment of the
   * swap; this is the third — block 2 must not be built around the substituted-in
   * exercise just because the athlete used it for one day.
   *
   * The claim is deliberately NOT "the replacement is absent from block 2": normal
   * rotation is free to choose it on its own merits, and asserting absence would
   * make a legitimate rotation look like a defect. What must not exist is a
   * SELECTION RECORD created by the swap — that is what would carry it forward, and
   * the count was already proven unmoved at the moment of the substitution.
   */
  const blockTwoNamesForRotation = new Set(blockTwoVisible.days
    .flatMap((day) => day.rows.map((row) => row.name)));
  console.log(`    block 2 contains the substituted-in ${substitution?.to}? `
    + `${blockTwoNamesForRotation.has(String(substitution?.to))} `
    + `(either answer is legal — what matters is that no selection record carried it)`);

  ok(
    `the temporary swap left NO future-block selection behind${suffix}`,
    !substitutionLanded
    || substitution!.selectionsBefore === substitution!.selectionsAfter,
    `block-selection records moved ${substitution?.selectionsBefore} -> `
    + `${substitution?.selectionsAfter} across a one-day substitution`,
  );

  // ═════════════════════════════════════════════════════════════════════════
  // STAGE 4 — RESTART: a real relaunch, not a JSON round-trip
  // ═════════════════════════════════════════════════════════════════════════

  console.log('\n═══ STAGE 4 — the athlete closes the app and opens it again ═══\n');

  /**
   * **THE PROGRAM IS NEVER PERSISTED.** `programStore.partialize` writes six
   * inputs and no workouts, so a relaunch is a full REGENERATION plus a
   * decision-ledger replay (`quiescentBoot.rebuildDerivedWorld`). That is why
   * "survives restart" here cannot mean "the stored week reads back": there is no
   * stored week. It means the week the app REBUILDS says the same thing.
   *
   * It is also why this stage is the real test of the completion-denominator fix.
   * Boot regenerates with `previousProgram: null` and a nulled `blockState`, so
   * nothing on this path can COUNT what block 1 required — it can only read what
   * acceptance recorded. If that record is not persisted, the boundary silently
   * stops progressing and **the athlete's raised loads are un-raised by the act
   * of reopening the app.**
   */
  const beforeRestart = {
    days: blockTwoVisible.days,
    explanations: blockTwoVisible.explanations,
    requirements: { ...(useProgramStore.getState() as unknown as {
      acceptedBlocks: Record<string, { blockNumber: number;
      requiredStrengthSessions: number }> }).acceptedBlocks },
    profile: JSON.stringify(useProfileStore.getState().onboardingData),
    onboardingComplete: useProfileStore.getState().isOnboardingComplete,
    results: JSON.stringify({
      sessionFeedback: useProgramStore.getState().sessionFeedback,
      weightOverrides: useProgramStore.getState().weightOverrides,
    }),
    exclusions: JSON.stringify(getAthleteExclusions()),
    decisions: JSON.stringify(useDecisionLedgerStore.getState().entries ?? []),
  };

  for (const [key, value] of localStorageData) {
    if (!/program/i.test(key)) continue;
    const inputs = (JSON.parse(value) as { state?: { inputs?: Record<string, unknown> } })
      ?.state?.inputs;
    console.log(`  persisted "${key}" input keys: ${JSON.stringify(Object.keys(inputs ?? {}))}`);
    console.log(`    acceptedBlocks in storage: `
      + `${JSON.stringify(inputs?.acceptedBlocks ?? null)}`);
  }

  await historyCheckpoint('immediately before the relaunch');
  console.log(`  live blockState immediately before the relaunch: ${JSON.stringify(
    (useProgramStore.getState() as unknown as { blockState: unknown }).blockState)}`);

  const relaunch = await relaunchApp({ storage: localStorageData, todayISO: blockTwoStart });
  ok(
    'the app RELAUNCHES from persisted state without refusing',
    relaunch.ok,
    `boot failed: ${relaunch.error}`,
  );

  const afterRequirements = (useProgramStore.getState() as unknown as {
    acceptedBlocks: Record<string, { blockNumber: number;
      requiredStrengthSessions: number }> }).acceptedBlocks ?? {};
  console.log(`  requirements before restart: ${JSON.stringify(beforeRestart.requirements)}`);
  console.log(`  requirements after  restart: ${JSON.stringify(afterRequirements)}`);

  ok(
    'RESTART: each accepted block\'s own strength requirement survived the relaunch',
    JSON.stringify(afterRequirements) === JSON.stringify(beforeRestart.requirements),
    'the denominator the boundary reads is gone after a relaunch, so the next '
    + 'regeneration cannot qualify anyone',
  );

  ok(
    'RESTART: every canonical onboarding/profile answer survived exactly',
    JSON.stringify(useProfileStore.getState().onboardingData) === beforeRestart.profile
      && JSON.stringify(useProfileStore.getState().onboardingData) === JSON.stringify(theAthlete())
      && useProfileStore.getState().isOnboardingComplete === beforeRestart.onboardingComplete,
    'the athlete profile or completed-onboarding decision changed during relaunch',
  );

  ok(
    'RESTART: completed-session results and typed loads survived exactly',
    JSON.stringify({
      sessionFeedback: useProgramStore.getState().sessionFeedback,
      weightOverrides: useProgramStore.getState().weightOverrides,
    }) === beforeRestart.results,
    'the result ledger changed during relaunch',
  );

  ok(
    'RESTART: exclusions and athlete decisions survived exactly',
    JSON.stringify(getAthleteExclusions()) === beforeRestart.exclusions
      && JSON.stringify(useDecisionLedgerStore.getState().entries ?? []) === beforeRestart.decisions,
    'an exclusion or decision-ledger entry changed during relaunch',
  );

  const afterState = useProgramStore.getState() as unknown as {
    blockState: unknown; generationAnchorISO: unknown;
    currentProgram: { microcycles?: { startDate: string; miniCycleNumber?: number }[] } | null;
  };
  console.log(`  after restart — blockState=${JSON.stringify(afterState.blockState)} `
    + `anchor=${JSON.stringify(afterState.generationAnchorISO)}`);
  console.log(`  after restart — weeks=${JSON.stringify(
    (afterState.currentProgram?.microcycles ?? []).map((m) => m.startDate.slice(0, 10)))} `
    + `miniCycleNumbers=${JSON.stringify(
      (afterState.currentProgram?.microcycles ?? []).map((m) => m.miniCycleNumber))}`);

  const afterCensus = takeCensus(blockTwoStart);
  console.log(`  after restart — feedback days=${afterCensus.storedFeedbackDays} `
    + `withStrengthLogs=${afterCensus.feedbackWithStrengthLogs} `
    + `progressionEntries=${afterCensus.progressionHistoryEntries} `
    + `overrideEntries=${afterCensus.weightOverrideEntries}`);
  console.log(`  after restart — rebuilt program's own decisions: ${JSON.stringify(
    [...new Set(((useProgramStore.getState().currentProgram?.blockBoundaryExplanation ?? []) as
      { exerciseName?: string; kind?: string; previousLoadKg?: number;
        nextLoadKg?: number }[])
      .map((r) => `${r.exerciseName}:${r.kind}:${r.previousLoadKg}->${r.nextLoadKg}`))])}`);

  /**
   * ⚠ **THE ATHLETE IS STILL IN BLOCK 2 — Sam's ruling, 2026-08-18.**
   *
   * *"A genuinely new athlete may begin at Block 1. Once Block 2 is accepted,
   * restart must never infer or reset them to Block 1."*
   *
   * This is the cell that reds if the accepted block's identity stops being
   * persisted at acceptance, or stops being restored before boot regenerates.
   * Asserted on the NUMBER and on the authored microcycles, not on the dates: the
   * dates were already right while the number said block 1, and a date-only check
   * passed throughout the whole defect.
   */
  const restartedBlock = (useProgramStore.getState() as unknown as {
    blockState: { blockStartDate?: string; blockNumber?: number } | null }).blockState;
  const restartedMiniCycles = (useProgramStore.getState().currentProgram?.microcycles ?? [])
    .map((microcycle) => (microcycle as { miniCycleNumber?: number }).miniCycleNumber);

  ok(
    'RESTART: the athlete is STILL IN BLOCK 2 — never inferred or reset to block 1',
    restartedBlock?.blockNumber === 2
      && restartedBlock?.blockStartDate === blockTwoStart
      && restartedMiniCycles.length > 0
      && restartedMiniCycles.every((number) => number === 2),
    `blockState=${JSON.stringify(restartedBlock)} miniCycleNumbers=`
    + `${JSON.stringify(restartedMiniCycles)} — an established athlete was rebuilt as a new one`,
  );

  followTheWeek(blockTwoStart);
  const afterRestartVisible = visibleProjection(blockTwoStart, blockTwoStart);
  printWeek(`AFTER RESTART — Block 2, week 1 (${blockTwoStart})`, afterRestartVisible.days);

  const signature = (days: VisibleDay[]): string => days
    .map((day) => `${day.weekday}=${day.sessionName ?? 'rest'}[` + day.rows
      .map((row) => `${row.name}/${row.sets}/${row.repsMin}-${row.repsMax}/${row.weightKg}`)
      .join(',') + ']').join(';');

  ok(
    'RESTART: the VISIBLE program is identical — sessions, exercises, doses and loads',
    signature(afterRestartVisible.days) === signature(beforeRestart.days),
    `before ${signature(beforeRestart.days)}\n  after  ${signature(afterRestartVisible.days)}`,
  );

  /**
   * AND THE RAISED LOAD IS STILL RAISED. Stated as its own cell rather than left
   * to the signature above, because this is the exact failure the persistence
   * exists to prevent and a whole-week comparison would report it as one
   * difference among many.
   */
  const raisedAfterRestart = progressedRows.every((row) => {
    for (const day of afterRestartVisible.days) {
      for (const visible of day.rows) {
        if (visible.name === row.exerciseName) return visible.weightKg === row.nextLoadKg;
      }
    }
    return false;
  });

  ok(
    'RESTART: every load the boundary raised is STILL raised after reopening the app',
    progressedRows.length > 0 && raisedAfterRestart,
    progressedRows.map((row) => `${row.exerciseName} should read ${row.nextLoadKg}kg`).join('; '),
  );

  ok(
    'RESTART: the explanations the athlete reads are unchanged',
    JSON.stringify(afterRestartVisible.explanations)
      === JSON.stringify(beforeRestart.explanations),
    `before ${JSON.stringify(beforeRestart.explanations)}\n  after  `
    + `${JSON.stringify(afterRestartVisible.explanations)}`,
  );

  // ═════════════════════════════════════════════════════════════════════════
  // ACTION 3 — THE OPTIONAL EXTRA-SESSION OFFER, ON A SECOND REAL ATHLETE
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * ⚠ **WHY A SECOND ATHLETE, AND ONLY HERE.**
   *
   * Sam: *"Use a second real athlete only where one journey cannot honestly reach
   * both offer decisions."* The primary athlete cannot: `decideExtraSessionOffer`
   * requires *"everything consistently easy"* — NOT merely "good" — and the primary
   * reports `feeling: good`, `soreness: mild`, effort 6, which is a well-recovered
   * athlete who found their training real work. Making them report everything easy
   * to reach the offer would have changed the athlete the other 47 cells describe.
   *
   * This athlete is REAL in the same sense: onboarded through the same door, trains
   * through the same completion writer, and answers honestly — they simply find it
   * easy. They commit TWO gym days so a third is genuinely available, which is the
   * offer's own `no_available_day` gate.
   *
   * Both answers are run as SEPARATE WORLDS from a cold start, because an offer is
   * *"already answered for this block"* after either one — running decline then
   * accept in one world would test the second answer against a closed question.
   */
  function offerAthlete(): OnboardingData {
    return {
      ...theAthlete(),
      firstName: 'Alex',
      // TWO committed gym days, ONE club night, NO fixture. Measured necessity:
      // an in-season athlete with a Saturday game has Friday protected as G-1 and
      // Sunday as G+1, so `availableTrainingDays` finds nothing free and the offer
      // refuses `no_available_day` — a correct refusal about a real constraint, not
      // a world in which the offer can be exercised at all.
      seasonPhase: 'Pre-season',
      trainingDaysPerWeek: 2,
      preferredTrainingDays: ['Monday', 'Wednesday'],
      teamTrainingDaysPerWeek: 1,
      teamTrainingDays: ['Tuesday'],
      usualGameDay: undefined,
      gameDay: undefined,
    } as unknown as OnboardingData;
  }

  const EASY_DAY: DayIntent = {
    record: true, completion: 'full', feeling: 'easy', soreness: 'none',
    // Bottom of the 1-10 scale, on BOTH qualities: the offer's gate is
    // "everything consistently easy", and strength alone does not open it.
    difficulty: 2, logWeights: true, conditioningRpe: 2,
  };

  async function runOfferWorld(answer: 'accept' | 'decline'): Promise<{
    offer: { offer: boolean; refusal?: string; question?: {
      currentSessionsPerWeek: number; offeredSessionsPerWeek: number;
      trainingDays: readonly string[] } };
    doorOk: boolean; doorMessage: string;
    daysBefore: number; daysAfter: number; daysAfterRestart: number;
    weekBefore: string[]; weekAfter: string[]; weekAfterRestart: string[];
    combinedSections: { sections: string[]; components: string[] };
    cardOffer: unknown;
    secondOffer: { offer: boolean; refusal?: string };
    committedAfter: readonly string[] | undefined;
    committedAfterRestart: readonly string[] | undefined;
    thirdOffer: { offer: boolean; refusal?: string };
  }> {
    const profile = offerAthlete();
    // ⚠ **THE DISK IS PART OF THE WORLD.** `coldStartThroughOnboarding` empties the
    // STORES, not storage — so without this the new athlete's relaunch rehydrates
    // the PREVIOUS athlete's persisted envelope. Measured: the offer world came back
    // holding the primary athlete's 20 feedback days and both their accepted blocks.
    localStorageData.clear();
    const install = await coldStartThroughOnboarding({
      profile, installDayISO: INSTALL_DAY,
    });
    const start = install.blockOneStart;
    const last = addDaysISO(start, BLOCK_ONE_WEEKS * 7 - 1);
    for (let d = start; d <= last; d = addDaysISO(d, 1)) {
      setJourneyClock(d);
      rolloverIfDue(d);
      followTheWeek(d);
      await recordDay(d, EASY_DAY);
    }
    // The card belongs to the NEW block and is shown after rollover. Reading the
    // final week of the old block after rollover is a green-and-empty instrument:
    // that week is no longer in `currentProgram`, so both sides compare `[]`.
    const boundaryISO = addDaysISO(start, BLOCK_ONE_WEEKS * 7);
    const blockEnd = addDaysISO(start, BLOCK_ONE_WEEKS * 7 - 1);
    const feedback = (useProgramStore.getState() as unknown as {
      sessionFeedback: Record<string, unknown> }).sessionFeedback;
    const required = (useProgramStore.getState() as unknown as {
      acceptedBlocks: Record<string, { requiredStrengthSessions: number }> })
      .acceptedBlocks?.[start]?.requiredStrengthSessions ?? 0;
    const history = quiet(() => readBlockHistory({
      feedbackByDate: feedback as never,
      blockStartISO: start, blockEndISO: blockEnd,
      requiredStrengthSessions: required,
    }));
    const liveProfile = useProfileStore.getState().onboardingData;
    console.log(`    [offer world] stated preferred=${
      JSON.stringify((profile as any).preferredTrainingDays)} club=${
      JSON.stringify((profile as any).teamTrainingDays)} game=${
      JSON.stringify((profile as any).gameDay ?? null)}`);
    console.log(`    [offer world] LIVE profile preferred=${
      JSON.stringify((liveProfile as any)?.preferredTrainingDays)} club=${
      JSON.stringify((liveProfile as any)?.teamTrainingDays)} game=${
      JSON.stringify((liveProfile as any)?.gameDay ?? (liveProfile as any)?.usualGameDay ?? null)}`);
    console.log(`    [offer world] availableTrainingDays=${JSON.stringify(quiet(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { availableTrainingDays } = require('../rules/extraSessionOffer');
      return availableTrainingDays({ profile, weekOrder: ['Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday', 'Sunday'] });
    }))}`);
    console.log(`    [offer world] history.qualifies=${(history as any).qualifies} `
      + `strengthEasy=${(history as any).byQuality?.strengthEasy} `
      + `conditioningEasy=${(history as any).byQuality?.conditioningEasy} required=${required}`);
    const offer = extraSessionOfferFor({
      profile, history, forBlockNumber: 1,
      currentSessionsPerWeek: 2,
    });

    const weekOf = (weekStartISO: string): string[] => resolvedDays(weekStartISO)
      .filter((day) => day.rows.length > 0)
      .map((day) => `${day.weekday}:[${day.rows.map((r) => r.name).join(',')}]`);
    const gymDays = (weekStartISO: string): number =>
      resolvedDays(weekStartISO).filter((day) => day.components.includes('strength')).length;

    /**
     * ⚠ **THE ATHLETE-FACING FORM, ASKED THE WAY THE SCREEN ASKS IT.**
     *
     * Sam, 2026-08-18: *"Do not manufacture both answers only in the test harness …
     * The athlete must be able to report strength difficulty and conditioning
     * difficulty separately."* This reads the sections `SessionFeedbackPanel`
     * renders for one of this athlete's COMBINED days, through
     * `getVisibleFeedbackSections` with the panel's own arguments.
     */
    const combinedDay = resolvedDays(mondayOf(addDaysISO(start, 7)))
      .find((day) => day.rows.length > 2);
    const combinedSections = quiet(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { resolveWeekWithConditioning } = require('../utils/sessionResolver');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { buildScheduleStateImperative } = require('../utils/coachWeekDiff');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getSessionComponents } = require('../utils/sessionComponents');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getConditioningLoggingConfig } = require('../utils/conditioningLogging');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getVisibleFeedbackSections } = require('../utils/sessionFeedbackForm');
      const resolved = resolveWeekWithConditioning(
        mondayOf(addDaysISO(start, 7)), buildScheduleStateImperative(),
      ) as { date: string; workout?: unknown }[];
      const workout = resolved.find((d) => d.date === combinedDay?.dateISO)?.workout;
      if (!workout) return { sections: [] as string[], components: [] as string[] };
      const components = (getSessionComponents(workout as never) as { id: unknown }[])
        .map((c) => String(c.id));
      const config = getConditioningLoggingConfig(workout as never) as { level?: string };
      const sections = (getVisibleFeedbackSections('full', {
        includeConditioningPerformance: config.level === 'trackable'
          && components.some((c) => c.includes('conditioning')),
      }) as { id: string }[]).map((section) => section.id);
      return { sections, components };
    }) as { sections: string[]; components: string[] };

    setJourneyClock(boundaryISO);
    rolloverIfDue(boundaryISO);
    followTheWeek(boundaryISO);
    /**
     * THE CARD ITSELF — the surface's own producer, not a re-derivation.
     *
     * ⚠ **RE-AIMED 2026-08-20 FOR R-105**, by seat `finish-coach-product`. Sam:
     * *"This should not be popping up on the main page - it should show up in
     * the coaches chat with a notification"*. The offer left
     * `deriveBlockBoundaryPrompts` for `rules/weeklyCommitmentConversation.ts`,
     * reached through the Coach tab's own assembly. **The cell is re-aimed, not
     * deleted** (`gate-must-watch-the-deleted-surface`): it still asks *"does
     * the athlete's own surface really produce this offer here"*, at the new
     * surface.
     *
     * The offer is a block-boundary offer: it returns null for `blockNumber < 2`
     * because block 1 has no previous block to have found easy. So it is asked
     * where the athlete would really meet it — standing in block 2, about the
     * block they just finished.
     */
    const prompts = quiet(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { deriveWeeklyCommitmentConversation } =
        require('../rules/weeklyCommitmentConversation');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { coachWeeklyCommitmentInputs } =
        require('../screens/coach/useCoachWeeklyCommitment');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useDecisionLedgerStore } = require('../store/decisionLedgerStore');
      const programState = useProgramStore.getState() as unknown as {
        currentProgram: unknown;
        sessionFeedback: Record<string, unknown>;
        acceptedBlocks: Record<string, unknown>;
        weightOverrides: Record<string, unknown>;
        blockState: unknown;
        acceptedMaterialContext: { markedDays: unknown; activeConstraints: unknown };
      };
      const outcome = deriveWeeklyCommitmentConversation(coachWeeklyCommitmentInputs({
        currentProgram: programState.currentProgram,
        blockNumber: 2,
        blockStartISO: boundaryISO,
        todayISO: boundaryISO,
        sessionFeedback: programState.sessionFeedback,
        acceptedBlocks: programState.acceptedBlocks,
        onboardingData: useProfileStore.getState().onboardingData,
        ledgerEntries: useDecisionLedgerStore.getState().entries ?? [],
        weightOverrides: programState.weightOverrides,
        blockState: programState.blockState,
        markedDays: programState.acceptedMaterialContext.markedDays,
        activeConstraints: programState.acceptedMaterialContext.activeConstraints,
      } as never)) as { value: { direction: string } | null };
      return {
        extraSession: outcome.value && outcome.value.direction === 'extra_session'
          ? outcome.value
          : null,
      };
    }) as { extraSession?: unknown };
    const weekBefore = weekOf(mondayOf(boundaryISO));
    const daysBefore = gymDays(mondayOf(boundaryISO));

    let doorOk = false; let doorMessage = '';
    if (offer.offer && offer.question) {
      if (answer === 'accept') {
        const door = await acceptExtraSession({
          profile, forBlockNumber: 1,
          sessionsPerWeek: offer.question.offeredSessionsPerWeek,
          todayISO: boundaryISO,
          availableDays: offer.question.trainingDays,
        });
        doorOk = door.ok; doorMessage = door.message;
      } else {
        declineExtraSession(1);
        doorOk = true; doorMessage = 'declined';
      }
    }

    followTheWeek(boundaryISO);
    const weekAfter = weekOf(mondayOf(boundaryISO));
    const daysAfter = gymDays(mondayOf(boundaryISO));
    const committed = (): readonly string[] =>
      (useProfileStore.getState().onboardingData as unknown as {
        preferredTrainingDays?: readonly string[] }).preferredTrainingDays ?? [];
    const committedAfter = committed();

    // ASKED AGAIN — an answered block must not re-ask.
    const secondOffer = extraSessionOfferFor({
      profile: useProfileStore.getState().onboardingData, history,
      forBlockNumber: 1, currentSessionsPerWeek: answer === 'accept' ? 3 : 2,
    });

    const relaunch = await relaunchApp({ storage: localStorageData, todayISO: boundaryISO });
    if (!relaunch.ok) throw new Error(`offer-world relaunch failed: ${relaunch.error}`);
    followTheWeek(boundaryISO);
    const weekAfterRestart = weekOf(mondayOf(boundaryISO));
    const daysAfterRestart = gymDays(mondayOf(boundaryISO));

    const committedAfterRestart = committed();
    return {
      combinedSections, cardOffer: prompts?.extraSession ?? null,
      offer, doorOk, doorMessage, daysBefore, daysAfter, daysAfterRestart,
      weekBefore, weekAfter, weekAfterRestart, secondOffer, committedAfter,
      committedAfterRestart,
      thirdOffer: extraSessionOfferFor({
        profile: useProfileStore.getState().onboardingData, history,
        forBlockNumber: 1, currentSessionsPerWeek: answer === 'accept' ? 3 : 2,
      }),
    };
  }

  console.log('\n═══ ACTION 3 — the optional extra-session offer ═══\n');

  const accepted = await runOfferWorld('accept');
  console.log(`  ACCEPT world — offer=${JSON.stringify(accepted.offer)}`);
  console.log(`    strength days before=${accepted.daysBefore} after=${accepted.daysAfter} `
    + `afterRestart=${accepted.daysAfterRestart}`);
  console.log(`    week before=${JSON.stringify(accepted.weekBefore)}`);
  console.log(`    week after =${JSON.stringify(accepted.weekAfter)}`);
  console.log(`    week after restart=${JSON.stringify(accepted.weekAfterRestart)}`);
  console.log(`    committed days now=${JSON.stringify(accepted.committedAfter)}`);
  console.log(`    asked again? ${JSON.stringify(accepted.secondOffer)}`);

  /**
   * ⚠ **THE OFFER IS UNREACHABLE FOR EVERY ATHLETE SHAPE I COULD HONESTLY BUILD.**
   *
   * `decideExtraSessionOffer` needs `strengthEasy && conditioningEasy`, and
   * `readBlockHistory` counts a day toward STRENGTH quality only when it
   * `carriesStrength && !carriesConditioning`. This athlete's strength days
   * (Mon:5, Wed:5) also carry a conditioning component, so answering the
   * conditioning question honestly — the app asks it on those days — disqualifies
   * every day from the strength read:
   *
   *   conditioning answered nowhere  -> strengthEasy TRUE,  conditioningEasy FALSE
   *   conditioning answered honestly -> strengthEasy FALSE, conditioningEasy TRUE
   *
   * **The two qualities are counted on disjoint day sets, so for an athlete whose
   * strength days are combined days they cannot both be true.** Every other gate is
   * open and measured so: `qualifies=true`, and `availableTrainingDays` returns
   * Thursday, Friday, Saturday and Sunday.
   *
   * I will not manufacture the offer by leaving a question unanswered that the app
   * put on the screen — that is a fixture whose input could not exist. Reported as
   * ONE red with the measurement, and the seven cells below are NOT EVALUATED.
   */
  ok(
    'ACTION 3 — the app OFFERS an extra session to a consistently-easy athlete',
    accepted.offer.offer === true,
    `no offer: ${accepted.offer.refusal}. Measured: qualifies=true, four days free, but `
    + 'strengthEasy and conditioningEasy are counted on disjoint day sets and this '
    + 'athlete\'s strength days carry conditioning, so both can never be true at once.',
  );

  const offerReached = accepted.offer.offer === true;
  const offerSuffix = offerReached
    ? ''
    : ' [NOT EVALUATED — no offer was reachable; see ACTION 3]';

  ok(
    `the offer is exactly ONE more session than the athlete trains now${offerSuffix}`,
    !offerReached ||
    accepted.offer.question?.offeredSessionsPerWeek
      === (accepted.offer.question?.currentSessionsPerWeek ?? 0) + 1,
    JSON.stringify(accepted.offer.question),
  );

  ok(
    `ACCEPT is taken by the real commitment door${offerSuffix}`,
    !offerReached ||
    accepted.doorOk,
    `refused: ${accepted.doorMessage}`,
  );

  ok(
    `ACCEPT is measured on a non-empty visible block${offerSuffix}`,
    !offerReached || accepted.daysBefore > 0 && accepted.weekBefore.length > 0,
    `before days=${accepted.daysBefore} week=${JSON.stringify(accepted.weekBefore)}`,
  );

  /**
   * ⚠ **MEASURED ON THE COMMITMENT, NOT ON "DAYS THAT HAVE ROWS".**
   *
   * The app already programmed this athlete THREE days on a two-day commitment —
   * the third was a conditioning day. Counting days-with-rows therefore reads
   * 3 -> 3 and calls a correct accept a failure. What the offer actually grows is
   * the athlete's committed `preferredTrainingDays`, which is what
   * `commitmentPatchFor` writes and what the next block is built from.
   */
  ok(
    `ACCEPT adds EXACTLY ONE committed session — not two, not none${offerSuffix}`,
    !offerReached ||
    ((accepted.committedAfter?.length ?? 0)
      === (accepted.offer.question?.currentSessionsPerWeek ?? 0) + 1),
    `committed days are now ${JSON.stringify(accepted.committedAfter)} from a `
    + `${accepted.offer.question?.currentSessionsPerWeek}-day commitment`,
  );

  ok(
    `ACCEPT adds exactly one VISIBLE strength day and keeps it after restart${offerSuffix}`,
    !offerReached || (
      accepted.daysAfter === accepted.daysBefore + 1
      && accepted.daysAfterRestart === accepted.daysAfter
      && JSON.stringify(accepted.weekAfterRestart) === JSON.stringify(accepted.weekAfter)
    ),
    `visible days ${accepted.daysBefore} -> ${accepted.daysAfter} -> `
    + `${accepted.daysAfterRestart}; week after=${JSON.stringify(accepted.weekAfter)} `
    + `after restart=${JSON.stringify(accepted.weekAfterRestart)}`,
  );

  /**
   * ⚠ **SCOPED TO WHAT THE ANSWER OWNS: the commitment, and that it is not asked
   * or applied twice.**
   *
   * Whole-week byte-identity across a MID-BLOCK restart is a different property and
   * this athlete does not have it — measured, their week legitimately re-generates
   * with different conditioning templates and one fewer strength row. That is a
   * real finding and it is reported as its own line, NOT smuggled into the offer's
   * cell, because an offer cell that fails for a reason unrelated to the offer
   * teaches the next reader the wrong thing.
   */
  ok(
    `ACCEPT survives restart WITHOUT DUPLICATION — the commitment is 3, once${offerSuffix}`,
    !offerReached ||
    (JSON.stringify(accepted.committedAfterRestart) === JSON.stringify(accepted.committedAfter)
      && accepted.thirdOffer.offer === false
      && accepted.thirdOffer.refusal === 'already_answered_for_this_block'),
    `committed after=${JSON.stringify(accepted.committedAfter)} afterRestart=`
    + `${JSON.stringify(accepted.committedAfterRestart)} · asked again after restart=`
    + `${JSON.stringify(accepted.thirdOffer)}`,
  );

  ok(
    `an ANSWERED block is not asked again${offerSuffix}`,
    !offerReached ||
    accepted.secondOffer.offer === false
      && accepted.secondOffer.refusal === 'already_answered_for_this_block',
    JSON.stringify(accepted.secondOffer),
  );

  console.log(`    combined day components: ${JSON.stringify(accepted.combinedSections.components)}`);
  console.log(`    feedback sections the SCREEN shows: ${
    JSON.stringify(accepted.combinedSections.sections)}`);
  console.log(`    the offer CARD the screen would render: ${
    JSON.stringify(accepted.cardOffer)}`);

  /**
   * THE REAL SCREEN ASKS BOTH QUESTIONS ON A COMBINED DAY.
   *
   * Sam's ruling is about evidence the athlete can actually give. `feeling` and
   * `soreness` are the strength-side answers and `conditioning` is the conditioning
   * RPE block — both must be on the form for one day, or the independent assessment
   * is a rule about data no athlete can enter.
   */
  ok(
    'THE REAL FEEDBACK SCREEN ASKS STRENGTH AND CONDITIONING SEPARATELY on a combined day',
    accepted.combinedSections.components.some((c) => c.includes('conditioning'))
      && accepted.combinedSections.sections.includes('conditioning')
      && accepted.combinedSections.sections.includes('feeling')
      && accepted.combinedSections.sections.includes('soreness'),
    `components=${JSON.stringify(accepted.combinedSections.components)} `
    + `sections=${JSON.stringify(accepted.combinedSections.sections)}`,
  );

  ok(
    'THE EXTRA-SESSION OFFER IS VISIBLE — the COACH\'s own producer returns it (R-105)',
    accepted.cardOffer != null,
    'the coach\'s own derivation returned no extra-session conversation: '
    + `${JSON.stringify(accepted.cardOffer)}`,
  );

  const declined = await runOfferWorld('decline');
  console.log(`\n  DECLINE world — offer=${JSON.stringify(declined.offer.offer)}`);
  console.log(`    strength days before=${declined.daysBefore} after=${declined.daysAfter} `
    + `afterRestart=${declined.daysAfterRestart}`);
  console.log(`    week after restart=${JSON.stringify(declined.weekAfterRestart)}`);
  console.log(`    asked again? ${JSON.stringify(declined.secondOffer)}`);

  ok(
    'DECLINE adds NO session — the existing commitment stands byte for byte',
    declined.daysAfter === declined.daysBefore
      && JSON.stringify(declined.weekAfter) === JSON.stringify(declined.weekBefore),
    `${declined.daysBefore} -> ${declined.daysAfter}; `
    + `week ${JSON.stringify(declined.weekBefore)} -> ${JSON.stringify(declined.weekAfter)}`,
  );

  ok(
    `DECLINE REMAINS DISMISSED for the block it was answered for${offerSuffix}`,
    !offerReached ||
    declined.secondOffer.offer === false
      && declined.secondOffer.refusal === 'already_answered_for_this_block',
    JSON.stringify(declined.secondOffer),
  );

  ok(
    `DECLINE survives restart — commitment unchanged, still not re-asked${offerSuffix}`,
    !offerReached ||
    (JSON.stringify(declined.committedAfterRestart) === JSON.stringify(declined.committedAfter)
      && (declined.committedAfterRestart?.length ?? 0)
        === (declined.offer.question?.currentSessionsPerWeek ?? 0)
      && declined.thirdOffer.offer === false
      && declined.thirdOffer.refusal === 'already_answered_for_this_block'),
    `committed after=${JSON.stringify(declined.committedAfter)} afterRestart=`
    + `${JSON.stringify(declined.committedAfterRestart)} · asked again after restart=`
    + `${JSON.stringify(declined.thirdOffer)}`,
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
