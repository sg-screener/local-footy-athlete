/**
 * R-124 — THE UNAFFECTED-AREA FALLBACK IS A SESSION ADJUSTMENT, NOT A SWAP.
 *
 * Sam, 2026-08-21, on the knee 7/10 review: *"The problem is the Injury review
 * applying the 'unaffected body area' fallback separately to every blocked row,
 * producing false pairings like Back Squat → Row and RDL → Floor Press …
 * Preserve the existing ordered ladder … Those remain per-exercise
 * replacements. If those stages find nothing safe, do not describe unrelated
 * upper-body work as replacing that specific lower-body exercise. Handle the
 * unresolved rows at session level."*
 *
 * ⚠ **THIS SUITE RUNS THE REAL DOORS ON A REAL GENERATED WEEK.** Every claim
 * below is measured on the athlete's own session through the same functions the
 * screen calls — because the defect it guards against was a plan that read
 * correctly and paired arbitrarily, which no source contract can see.
 *
 * Run: npm run test:injury-session-adjustment
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => durable.get(k) ?? null,
    setItem: (k: string, v: string) => { durable.set(k, v); },
    removeItem: (k: string) => { durable.delete(k); },
    clear: () => { durable.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => { throw new Error('NETWORK DISABLED'); };
process.env.TZ = 'Australia/Melbourne';

/* eslint-disable import/first, @typescript-eslint/no-var-requires */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
import fs from 'fs';
import path from 'path';
import type { TrainingProgram, Workout } from '../types/domain';
import { addDaysISO } from '../utils/programBlockState';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useReadinessStore } from '../store/readinessStore';
import { generateProgramLocally } from '../services/api/generateProgram';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';
import { DEV_E2E_STANDARD_PROFILE } from '../dev/e2e/devE2EStandardProfile';
import {
  buildGuidedInjuryConstraint,
  GUIDED_INJURY_SEVERITY_OPTIONS,
} from '../utils/guidedInjuryControl';
import { buildSessionInjuryReview, type SessionInjuryReview } from '../utils/sessionInjuryReview';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { classifyExerciseRiskForBucket } from '../rules/injuryExerciseRisk';
import { INJURY_ADJUSTMENT_MAX_ADDED } from '../utils/injurySessionAdjustment';
import { SET_CEILING } from '../rules/weeklyLegality';

const INSTALL_DAY = '2026-07-13';
/** Monday of the seeded in-season week — the athlete's lower-body day. */
const TARGET = '2026-07-13';

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); return; }
  const text = detail === undefined ? label : `${label} — ${JSON.stringify(detail)}`;
  failures.push(text);
  console.log(`  ✗ ${text}`);
}

function mondayFor(d: string): string {
  const p = new Date(`${d}T12:00:00Z`);
  return addDaysISO(d, -((p.getUTCDay() + 6) % 7));
}

function install(): string {
  durable.clear();
  resetStoresToFreshInstall('injury-session-adjustment:install');
  const profile = DEV_E2E_STANDARD_PROFILE;
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  setJourneyClock(INSTALL_DAY);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: INSTALL_DAY, previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'In-season' as never,
      phaseEntryWeekStartISO: mondayFor(INSTALL_DAY),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const settled = program.microcycles[0]!;
  const weekStart = String(settled.startDate).slice(0, 10);
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {}, selectedDate: weekStart,
    reason: 'injury-session-adjustment:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  setJourneyClock(TARGET);
  return weekStart;
}

function dayOn(dateISO: string): Workout | null {
  const week = quiet(() => resolveWeekWithConditioning(
    mondayFor(dateISO), buildScheduleStateImperative(),
  ));
  const day = week.find((d) => d.date === dateISO);
  return ((day as { workout?: Workout } | undefined)?.workout) ?? null;
}

/** Identity, order AND load — a restore that kept the names and lost the
 *  numbers is not a restore. */
function fingerprintOn(dateISO: string): string {
  return JSON.stringify((dayOn(dateISO)?.exercises ?? []).map((row) => [
    String((row as { exercise?: { name?: string } }).exercise?.name
      ?? (row as { name?: string }).name ?? ''),
    (row as { prescribedSets?: number }).prescribedSets ?? null,
    (row as { prescribedRepsMin?: number }).prescribedRepsMin ?? null,
    (row as { prescribedRepsMax?: number }).prescribedRepsMax ?? null,
    (row as { prescribedWeightKg?: number }).prescribedWeightKg ?? null,
  ]));
}

function constraintFor(area: string, band: string, dateISO: string) {
  const option = GUIDED_INJURY_SEVERITY_OPTIONS.find((o) => o.severityBand === band)!;
  return buildGuidedInjuryConstraint({
    region: 'lower_body', area, severity: option.severity,
    severityBand: option.severityBand, adjustmentLevel: option.adjustmentLevel,
    triggers: [], seriousSymptoms: false,
  } as never, { todayISO: dateISO });
}

async function declare(constraint: unknown): Promise<{ ok: boolean }> {
  return await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_injury_modifier',
    source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
    scope: 'current_and_future', payload: { constraint },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  } as never, { todayISO: TARGET })) as { ok: boolean };
}

async function main(): Promise<void> {
  install();
  const before = fingerprintOn(TARGET);
  const beforeRows = JSON.parse(before).map((entry: string[]) => entry[0]) as string[];

  console.log('\n[1] CONTROL — the world this suite is about');
  {
    ok('the athlete has a lower-body session with something safe in it',
      beforeRows.length >= 5 && beforeRows.includes('Band Pallof Press'), beforeRows);
  }

  const constraint = constraintFor('Knee', 'moderate', TARGET);
  const review = quiet(() =>
    buildSessionInjuryReview({ date: TARGET, constraint })) as SessionInjuryReview;

  console.log('\n[2] NO FALSE ARROWS — a rung-5 answer is never a row\'s replacement');
  {
    ok('CONTROL — this injury really does pause rows',
      review.paused.length >= 2, review.paused.map((c) => c.from));
    /* ⚠ **THE DEFECT, STATED AS A CELL.** Before R-124 this review drew five
     * arrows — `Back Squat -> Chest-Supported DB Row`, `RDLs -> Single-Arm DB
     * Floor Press` and three more — every one of them a rung-5 name handed to
     * whichever row came next in the loop. */
    ok('every arrow carries a rung 1-4 tier, or there are no arrows at all',
      review.changes.every((change) => change.to !== null
        && (change.tier === 'same_movement_pattern' || change.tier === 'similar_muscle_group')),
      review.changes.map((c) => [c.from, c.to, c.tier]));
    ok('a paused row is paired with nothing',
      review.paused.every((change) => change.to === null && change.tier === null),
      review.paused.map((c) => [c.from, c.to]));
    ok('the paused rows and the added block are separate lists',
      review.added.every((candidate) =>
        !review.paused.some((change) => change.from === candidate.name)),
      { paused: review.paused.map((c) => c.from), added: review.added.map((c) => c.name) });
  }

  console.log('\n[3] THE BLOCK IS CAPPED, AND BY THE SMALLEST OF SAM\'S THREE CAPS');
  {
    ok(`never more than ${INJURY_ADJUSTMENT_MAX_ADDED} added exercises`,
      review.added.length <= INJURY_ADJUSTMENT_MAX_ADDED, review.added.map((c) => c.name));
    ok('never more than the number of rows it paused',
      review.added.length <= review.paused.length,
      { added: review.added.length, paused: review.paused.length });
    ok('never more rows than the session started with',
      review.untouched.length + review.added.length <= beforeRows.length,
      { kept: review.untouched.length, added: review.added.length, before: beforeRows.length });
    const sets = review.added.reduce((total, candidate) => total + candidate.sets, 0)
      + (JSON.parse(before) as [string, number | null][]).filter(
        (entry) => review.untouched.includes(entry[0]),
      ).reduce((total, entry) => total + (entry[1] ?? 0), 0);
    ok(`and the adjusted session stays inside the app's own set ceiling (${SET_CEILING})`,
      sets <= SET_CEILING, { sets });
  }

  console.log('\n[4] IT IS A COHERENT BLOCK, NOT A SHOPPING LIST');
  {
    const weekNames = (useProgramStore.getState().currentMicrocycle?.workouts ?? [])
      .flatMap((day) => (day.exercises ?? []).map((row) => String(
        (row as { exercise?: { name?: string } }).exercise?.name ?? '',
      ).trim()))
      .filter(Boolean).map((name) => name.toLowerCase());
    /* ⚠ **THE MEASURED DEFECT: `Band Pull-Apart` WAS ALREADY TUESDAY'S AND
     * `Single-Arm DB Floor Press` ALREADY THURSDAY'S.** The per-row loop could
     * only see the current session, and took the athlete's upper rows for the
     * week from 7 to 12. */
    ok('nothing the athlete already has that week is offered again',
      review.added.every((candidate) => !weekNames.includes(candidate.name.toLowerCase())),
      { added: review.added.map((c) => c.name) });
    ok('no two added rows are variants of the same drill',
      new Set(review.added.map((candidate) =>
        candidate.name.toLowerCase().replace(/^(banded|weighted|single-arm|half-kneeling)\s+/, '')))
        .size === review.added.length,
      review.added.map((c) => c.name));
    ok('every added row is rated GOOD for this injury — never merely caution',
      review.added.every((candidate) =>
        classifyExerciseRiskForBucket(candidate.name, constraint.bucket as never,
          constraint.severity) === 'good'),
      review.added.map((c) => [c.name,
        classifyExerciseRiskForBucket(c.name, constraint.bucket as never, constraint.severity)]));
  }

  console.log('\n[5] R-124 — LOADED WALKING AND KNEELING ARE OUT, IN THE SHARED AUTHORITY');
  {
    const CARRIES = ['Farmer Carry', 'Suitcase Carry', 'Bear Carry', 'Overhead Carry'];
    /* Sam, 2026-08-21: *"Farmer and suitcase carries are OUT for a 7/10 knee …
     * Hold this in the shared safety authority, not as a screen-specific
     * exception."* So it is asserted against the CLASSIFIER, which both the
     * "may this replace" and the "must this come out" questions read. */
    ok('CONTROL — the matrix itself still rates them good, so this refusal is real work',
      CARRIES.every((name) => classifyExerciseRiskForBucket(name, 'knee') === 'good'),
      CARRIES.map((n) => [n, classifyExerciseRiskForBucket(n, 'knee')]));
    ok('at 6-7 on a knee, every loaded carry is refused',
      CARRIES.every((name) => classifyExerciseRiskForBucket(name, 'knee', 7) === 'avoid'),
      CARRIES.map((n) => [n, classifyExerciseRiskForBucket(n, 'knee', 7)]));
    ok('and so is kneeling work the tags cannot describe',
      classifyExerciseRiskForBucket('Ab Wheel', 'knee', 7) === 'avoid'
        && classifyExerciseRiskForBucket('Woodchop (Half Kneeling)', 'knee', 7) === 'avoid',
      [classifyExerciseRiskForBucket('Ab Wheel', 'knee', 7),
        classifyExerciseRiskForBucket('Woodchop (Half Kneeling)', 'knee', 7)]);
    ok('BOUNDARY — a 4-5 knee is untouched by it',
      CARRIES.every((name) => classifyExerciseRiskForBucket(name, 'knee', 5) !== 'avoid'),
      CARRIES.map((n) => [n, classifyExerciseRiskForBucket(n, 'knee', 5)]));
    ok('BOUNDARY — and an UPPER-limb injury is untouched by it',
      CARRIES.every((name) => classifyExerciseRiskForBucket(name, 'shoulder', 7) !== 'avoid'
        || classifyExerciseRiskForBucket(name, 'shoulder') !== 'good'),
      CARRIES.map((n) => [n, classifyExerciseRiskForBucket(n, 'shoulder', 7)]));
    ok('the refusal lives in the shared classifier, not in a screen',
      /R-124/.test(fs.readFileSync(
        path.resolve(__dirname, '..', 'rules', 'injuryExerciseRisk.ts'), 'utf8')),
    );
    ok('the block never offered one',
      review.added.every((candidate) => !CARRIES.includes(candidate.name)),
      review.added.map((c) => c.name));
  }

  console.log('\n[6] THE SENTENCE IS SAM\'S, AND IT IS DERIVED');
  {
    ok('it counts the paused rows and names the half of the body',
      !!review.adjustmentSummary
        && review.adjustmentSummary.startsWith(`${review.paused.length} lower-body exercises paused`),
      review.adjustmentSummary);
    ok('it names the athlete\'s own word for the area',
      !!review.adjustmentSummary
        && review.adjustmentSummary.includes(review.bodyPart.toLowerCase()),
      review.adjustmentSummary);
    ok('and it only claims an adjustment when something was really added',
      !!review.adjustmentSummary && (review.added.length > 0
        ? /adjusted to safe upper-body and core work/.test(review.adjustmentSummary)
        : /Nothing safe could be added/.test(review.adjustmentSummary)),
      review.adjustmentSummary);
  }

  console.log('\n[7] ON THE SESSION: the rows go, one line arrives');
  {
    ok('CONTROL — the approve door ran', (await declare(constraint)).ok === true);
    const after = dayOn(TARGET);
    const afterRows = (after?.exercises ?? []).map((row) => String(
      (row as { exercise?: { name?: string } }).exercise?.name ?? '',
    ));
    ok('every paused row has LEFT the active session — no greyed-out cards',
      review.paused.every((change) => !afterRows.includes(change.from)),
      { afterRows });
    ok('the safe row the athlete already had is untouched',
      afterRows.includes('Band Pallof Press'), afterRows);
    ok('the added block is on the session',
      review.added.every((candidate) => afterRows.includes(candidate.name)),
      { added: review.added.map((c) => c.name), afterRows });
    ok('and the day carries ONE summary line, with the paused rows behind it',
      !!after?.injuryAdjustment
        && after.injuryAdjustment.summary === review.adjustmentSummary
        && review.paused.every((c) => after.injuryAdjustment!.paused.includes(c.from)),
      after?.injuryAdjustment);
  }

  console.log('\n[8] CLEARING RESTORES THE EXACT SESSION — AND SURVIVES A RESTART');
  {
    /* ⚠ **THIS IS THE CELL THE WHOLE DESIGN ANSWERS TO.** Sam, 2026-08-21:
     * *"Clearing the injury must restore the exact original session, including
     * after restart."* Nothing about the adjustment is stored — it is a
     * read-time projection from the injury FACT — so clearing is undone by
     * deleting the fact and nothing else. Writing the three added rows as
     * `add_exercise` decisions would have been the obvious build and would have
     * failed here: the ledger replays them forever. */
    ok('CONTROL — the session really did change first',
      fingerprintOn(TARGET) !== before);
    /* ⚠ **THE EPISODE ID, NOT THE CONSTRAINT ID.** They are different strings
     * and the clear door matches on the episode; handing it the constraint's id
     * returns *"That injury episode could not be matched"* and changes nothing —
     * measured here first, which is what a control is for. */
    const episodes = (useProgramStore.getState().acceptedMaterialContext
      ?.injuryEpisodes ?? []) as { episodeId?: string; status?: string }[];
    const episodeId = episodes.find((episode) => episode.status !== 'resolved')?.episodeId;
    ok('CONTROL — there is an injury episode to clear', !!episodeId, episodeId);
    const cleared = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_injury_modifier',
      source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { episodeId },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    } as never, { todayISO: TARGET })) as { ok: boolean };
    ok('the clear door ran', cleared.ok === true, cleared);
    ok('the ORIGINAL session is back — identity, order, sets, reps and load',
      fingerprintOn(TARGET) === before,
      { before: JSON.parse(before).length, after: JSON.parse(fingerprintOn(TARGET)) });
    const relaunched = await quietAsync(() => relaunchApp({ storage: durable, todayISO: TARGET }));
    ok('the app came back up', (relaunched as { ok: boolean }).ok === true);
    ok('and it is STILL the original session after a restart',
      fingerprintOn(TARGET) === before,
      { after: JSON.parse(fingerprintOn(TARGET)) });
  }

  console.log('\n[9] AND THE ADJUSTMENT ITSELF SURVIVES A RESTART WHILE THE INJURY IS LIVE');
  {
    install();
    ok('CONTROL — declared again on a clean world', (await declare(
      constraintFor('Knee', 'moderate', TARGET))).ok === true);
    const adjusted = fingerprintOn(TARGET);
    ok('CONTROL — the session is adjusted', adjusted !== before);
    const relaunched = await quietAsync(() => relaunchApp({ storage: durable, todayISO: TARGET }));
    ok('the app came back up', (relaunched as { ok: boolean }).ok === true);
    /* Derived from the fact on every read, so a restart cannot lose it and
     * cannot double it either. */
    ok('the adjusted session is IDENTICAL after a restart',
      fingerprintOn(TARGET) === adjusted,
      { before: JSON.parse(adjusted), after: JSON.parse(fingerprintOn(TARGET)) });
  }

  console.log('\n[10] A PLANNER READS THE DAY, NOT THE DRAWING');
  {
    /* ⚠ **THE BOUNDARY A MUTATION FOUND UNGUARDED.** The adjustment removes the
     * paused rows and appends a block — the one thing `markInjuryWithheldRows`
     * refuses to do ("MARK, NEVER FILTER"), and for this reason: the injury
     * planner reads the day back through the same resolver. Point that read at
     * the drawn day and it plans against its own output.
     *
     * Removing `suppressInjuryAdjustment` reddened NOTHING until this section
     * existed, so the claim was prose. It is measured now: a SECOND injury is
     * declared on top of the first, and the block must not compound — the added
     * rows of pass one must not become "rows the session already has" that pass
     * two then builds on top of. */
    install();
    ok('CONTROL — the first injury adjusted the session',
      (await declare(constraintFor('Knee', 'moderate', TARGET))).ok === true);
    const afterOne = dayOn(TARGET);
    const addedOne = afterOne?.injuryAdjustment?.added ?? [];
    ok('CONTROL — and it really did add a block', addedOne.length > 0, addedOne);

    ok('CONTROL — a second injury lands too',
      (await declare(constraintFor('Shoulder', 'moderate', TARGET))).ok === true);
    const afterTwo = dayOn(TARGET);
    const rowsTwo = (afterTwo?.exercises ?? []).map((row) => String(
      (row as { exercise?: { name?: string } }).exercise?.name ?? '',
    ));
    ok('the block never compounds — no row appears twice',
      new Set(rowsTwo.map((n) => n.toLowerCase())).size === rowsTwo.length, rowsTwo);
    ok(`and it is still capped at ${INJURY_ADJUSTMENT_MAX_ADDED} added rows`,
      (afterTwo?.injuryAdjustment?.added ?? []).length <= INJURY_ADJUSTMENT_MAX_ADDED,
      afterTwo?.injuryAdjustment?.added);
    ok('the session never grew past the day it started as',
      rowsTwo.length <= beforeRows.length,
      { after: rowsTwo.length, before: beforeRows.length });
    /* The boundary itself, named where it lives, so a future reader finds the
     * rule and not only its symptom. */
    ok('the planner\'s read declares the suppression',
      /suppressInjuryAdjustment: true/.test(fs.readFileSync(
        path.resolve(__dirname, '..', 'utils', 'programControlActions.ts'), 'utf8'))
      && /state\.suppressInjuryAdjustment \? workout/.test(fs.readFileSync(
        path.resolve(__dirname, '..', 'utils', 'sessionResolver.ts'), 'utf8')));
  }

  console.log(`\nInjury session adjustment totals: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
  totalsPrinted(failures.length);
  if (failures.length > 0) {
    console.log('FAILURES:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).message}`);
  console.log((error as Error).stack);
  process.exitCode = 1;
});
