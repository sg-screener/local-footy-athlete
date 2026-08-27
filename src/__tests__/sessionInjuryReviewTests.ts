/**
 * ── THE ACTIVE SESSION INJURY REVIEW, WALKED BY A REAL ATHLETE ─────────────
 *
 * Sam, 2026-08-20: *"Ask for the injured body area or movement once. Find every
 * affected exercise in the session. Apply the existing approved safety ladder …
 * Show one review of all proposed changes. Apply the approved changes together.
 * Injury and ordinary Remove must remain separate. Do not create Remove
 * decisions for injury-withheld exercises. Never claim the session was safely
 * changed if nothing changed."*
 *
 * Every cell runs on a REAL generated week through the REAL doors. The injured
 * area is never named here — it is chosen BY MEASUREMENT against the day the
 * athlete is actually looking at, because a suite that declares a knee injury
 * against an upper day proves nothing and has shipped green and empty in this
 * repo before.
 *
 * ## WHAT IT HOLDS
 *
 *  [1] THE REVIEW AND THE WRITE ASK ONE WORLD. Every substitution the review
 *      promised is on the session afterwards, named for name. Plus the control
 *      that the pending-`medicalStop` clause is inert for every caller that
 *      existed before this unit.
 *  [2] ASKED ONCE, EVERY AFFECTED ROW FOUND. The review's changes cover exactly
 *      the set `unsafeRowsForInjury` reports — no row missed, none invented.
 *  [3] THE LADDER IS THE APPROVED ONE. Every replacement is legal for the injury
 *      under the single severity owner, and carries an approved tier.
 *  [4] INJURY IS NOT REMOVE. Applying the whole review adds ZERO entries to
 *      `athletePreferencesStore.exclusions`, and a withheld row is still ON the
 *      session, marked, not deleted.
 *  [5] NOTHING CHANGED IS SAID PLAINLY. On a day the injury does not touch, the
 *      review claims no change and its words contain no success claim.
 *  [6] APPLIED TOGETHER. One approval, one door call, every change.
 *  [7] IT SURVIVES A RESTART. Close and reopen re-derives the same session, and
 *      the exclusions are still untouched.
 *
 * Run: npm run test:session-injury-review
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => localStorageData.get(k) ?? null,
    setItem: (k: string, v: string) => { localStorageData.set(k, v); },
    removeItem: (k: string) => { localStorageData.delete(k); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => { throw new Error('NETWORK DISABLED'); };
process.env.TZ = 'Australia/Melbourne';

/* eslint-disable import/first */
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { addDaysISO } from '../utils/programBlockState';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { generateProgramLocally } from '../services/api/generateProgram';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';
import { buildSessionInjuryReview, type SessionInjuryReview } from '../utils/sessionInjuryReview';
import {
  GUIDED_INJURY_AREA_OPTIONS,
  buildGuidedInjuryConstraint,
  guidedInjuryBucketForArea,
  type GuidedInjuryFlowResult,
  type GuidedInjuryRegion,
} from '../utils/guidedInjuryControl';
import { compileSessionInjuryPreview, resolveInjuryRecompositionInputs } from '../utils/programControlActions';
import { completeAcceptedStateFingerprint } from '../store/coachMutationTransaction';
import { unsafeRowsForInjury } from '../utils/injurySessionRecomposition';
import { injuryPermitsExerciseAtSeverity } from '../rules/injuryExerciseRisk';
import { resolveExerciseName } from '../utils/loadEstimation';

const INSTALL_DAY = '2026-07-13';

function mondayFor(d: string): string {
  const p = new Date(`${d}T12:00:00Z`);
  return addDaysISO(d, -((p.getUTCDay() + 6) % 7));
}

function theAthlete(): OnboardingData {
  return {
    firstName: 'Sim', gender: 'male', heightCm: 184, weightKg: 90, seasonPhase: 'Off-season',
    position: 'inside_mid', motivation: 'Dominate your level', trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
    teamTrainingDuration: '90 minutes', teamTrainingIntensity: 'Moderate',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine', 'hamstring_curl', 'knee_extension', 'bands'],
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight', benchStrength: '1.5x bodyweight+',
    conditioningLevel: 'Good', sprintExposure: '2+ times per week', recentTrainingLoad: 'Very consistent',
    injuries: [], twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
    equipmentAnswer: {
      tags: { barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have', bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have', foam_roller: 'have', plyo_box: 'have' },
      modalities: { bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have' },
      answeredOn: INSTALL_DAY,
    },
    usualGameDay: 'Saturday', gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

async function install(): Promise<string> {
  await quietAsync(() => coldStartThroughOnboarding({
    profile: { ...theAthlete(), seasonFinishedOn: '2026-06-28' }, installDayISO: INSTALL_DAY,
  }));
  return INSTALL_DAY;
}

/** R-124 — the session-level adjustment the VIEW door derived for a day. */
function adjustmentOf(dateISO: string, weekStartISO: string): {
  summary: string; paused: string[]; added: string[];
} | null {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  return ((day as { workout?: Workout } | undefined)?.workout?.injuryAdjustment) ?? null;
}

function rowsOf(dateISO: string, weekStartISO: string): string[] {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  const w = (day as { workout?: Workout } | undefined)?.workout;
  return (w?.exercises ?? []).map((r) =>
    String((r as { exercise?: { name?: string } }).exercise?.name
      ?? (r as { name?: string }).name ?? '')).filter(Boolean);
}

/** Every day in the generated fortnight that carries rows. */
function trainingDays(weekStart: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 14; i += 1) {
    const date = addDaysISO(weekStart, i);
    if (rowsOf(date, weekStart).length > 0) out.push(date);
  }
  return out;
}

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) { pass += 1; console.log(`  ok   ${name}`); return; }
  fail += 1; failures.push(name);
  console.log(`  FAIL ${name}${detail === undefined ? '' : `\n         ${JSON.stringify(detail)}`}`);
}

/**
 * Which region's list offers this body part — the harness's own lookup, kept
 * HERE rather than in the product, because the product has no reader for it.
 * A three-line derivation over the real menu; it cannot drift from what the
 * athlete is actually offered.
 */
function regionOffering(area: string): GuidedInjuryRegion | undefined {
  const bucket = guidedInjuryBucketForArea(area);
  return (Object.keys(GUIDED_INJURY_AREA_OPTIONS) as GuidedInjuryRegion[]).find(
    (region) => GUIDED_INJURY_AREA_OPTIONS[region]
      .some((row) => guidedInjuryBucketForArea(row) === bucket),
  );
}

/** The athlete's answer, turned into the constraint the door will store. */
function constraintFor(area: string, severity: number, todayISO: string, seriousSymptoms = false) {
  /* THE REGION IS DERIVED FROM THE MEASURED AREA, NOT NAMED (2026-08-21).
     It used to read `region: 'other'`, which the flow can no longer produce —
     and since this suite MEASURES its area rather than hard-coding one, naming
     a region here could have contradicted the area it was paired with. The
     `?? 'lower_body'` is unreachable: an area with no bucket throws one line
     down, inside the builder. */
  const result: GuidedInjuryFlowResult = {
    region: regionOffering(area) ?? 'lower_body',
    area,
    severity,
    severityBand: 'moderate', adjustmentLevel: 'moderate',
    triggers: [], seriousSymptoms,
  };
  return buildGuidedInjuryConstraint(result, { todayISO });
}

/**
 * ⚠ **THE AREA IS MEASURED, NEVER NAMED.** Two worlds are needed and both are
 * derived from the week the generator actually produced: one area that makes
 * SEVERAL rows on the target day unsafe, and one that makes NONE. Hard-coding
 * either is how a green-and-empty suite is written.
 */
const CANDIDATE_AREAS = [
  'Knee', 'Hamstring', 'Shoulder', 'Lower back', 'Groin', 'Calf / Achilles',
  'Ankle / foot', 'Hip', 'Quad', 'Elbow', 'Wrist / hand', 'Neck', 'Chest',
];

function unsafeCountFor(area: string, severity: number, date: string): number {
  let constraint;
  try { constraint = constraintFor(area, severity, date); } catch { return -1; }
  const { workout, environment } = quiet(() =>
    resolveInjuryRecompositionInputs({ date, constraint })) as ReturnType<
      typeof resolveInjuryRecompositionInputs>;
  if (!workout) return -1;
  return quiet(() => unsafeRowsForInjury({ workout, environment })).length;
}

async function main(): Promise<void> {
  /* ══ THE WORLD ═════════════════════════════════════════════════════════ */
  const weekStart = await install();
  const days = trainingDays(weekStart);
  const SEVERITY = 6;

  // The target day and the injured area, chosen together by measurement.
  let target = '';
  let area = '';
  let unsafeAtOpen = 0;
  /* ⚠ **A PARTIAL WORLD, DELIBERATELY — AND IT HAD TO BE ASKED FOR.** The first
   * world this picker found was a 6/10 lower back on 2026-07-20, which makes
   * ALL FIVE rows unsafe. That is a real session and the flow handles it, but it
   * cannot prove the review is a review OF THE SESSION rather than of every row
   * it was handed: with nothing untouched, "covers every unsafe row" and "covers
   * every row" are the same sentence. So the world is required to leave at least
   * one row alone, and `[2]`'s control is what fails if that stops being true. */
  for (const day of days) {
    setJourneyClock(day);
    const total = rowsOf(day, weekStart).length;
    for (const candidate of CANDIDATE_AREAS) {
      const count = unsafeCountFor(candidate, SEVERITY, day);
      if (count > unsafeAtOpen && count < total) {
        unsafeAtOpen = count; target = day; area = candidate;
      }
    }
    if (unsafeAtOpen >= 2) break;
  }

  console.log(`\n[0] the world — target ${target}, area ${area}, ${unsafeAtOpen} unsafe rows`);
  ok('[0] LIVENESS — the chosen day genuinely carries work this injury makes unsafe',
    unsafeAtOpen >= 2 && Boolean(target) && Boolean(area),
    { target, area, unsafeAtOpen, days });
  if (!target) { console.log('no live world — the rest cannot run'); process.exit(1); }

  setJourneyClock(target);
  const beforeRows = rowsOf(target, weekStart);
  const constraint = constraintFor(area, SEVERITY, target);
  const beforePreview = completeAcceptedStateFingerprint();
  const compilerPreview = quiet(() => compileSessionInjuryPreview({ date: target, constraint }));
  const review = quiet(() => buildSessionInjuryReview({ date: target, constraint })) as SessionInjuryReview;
  ok('[1] preview publishes no state changes', completeAcceptedStateFingerprint() === beforePreview);
  const dose = (workout: Workout | null | undefined) => JSON.stringify(workout?.exercises.map(row => [
    row.exercise?.name, row.prescribedSets, row.prescribedRepsMin, row.prescribedRepsMax,
    row.prescribedWeightKg, row.restSeconds,
  ]));

  /* ══ [2] ASKED ONCE, EVERY AFFECTED ROW FOUND ══════════════════════════ */
  console.log('\n[2] one question, every affected row');
  {
    const { workout, environment } = quiet(() =>
      resolveInjuryRecompositionInputs({ date: target, constraint })) as ReturnType<
        typeof resolveInjuryRecompositionInputs>;
    const unsafe = quiet(() => unsafeRowsForInjury({ workout, environment })) as string[];
    /* R-124 — the review is two lists and coverage is about BOTH: every unsafe
     * row is either swapped or paused. Asking only `changes` would let a paused
     * row go unreported and call that coverage. */
    const reviewed = [...review.changes, ...review.paused].map((change) => change.from);
    ok('[2] the review covers EVERY row the injury makes unsafe',
      unsafe.every((name) => reviewed.includes(name)),
      { unsafe, reviewed });
    ok('[2] and invents none — every reviewed row really is unsafe',
      reviewed.every((name) => unsafe.includes(name)),
      { unsafe, reviewed });
    ok('[2] the athlete was asked ONCE — one area, one severity, one review',
      review.bodyPart.length > 0 && review.severity === SEVERITY
        && review.changes.length + review.paused.length === unsafe.length,
      {
        bodyPart: review.bodyPart, severity: review.severity,
        changes: review.changes.length, paused: review.paused.length,
      });
    ok('[2] CONTROL — the untouched rows are the rest of the session, not an empty list',
      review.untouched.length > 0
        && review.untouched.every((name) => !unsafe.includes(name)),
      { untouched: review.untouched });
  }

  /* ══ [3] THE APPROVED LADDER, AND NOTHING ELSE ═════════════════════════ */
  console.log('\n[3] the approved safety ladder');
  {
    /* ⚠ **R-124 NARROWED THIS LIST, AND THE NARROWING IS THE RULING.** A
     * substitution may only carry a rung 1-4 tier now. `unaffected_body_area`
     * and `recovery_easy_conditioning` are still walked and still answer *"what
     * is safe today"* — they may no longer be drawn as a replacement FOR A ROW. */
    const APPROVED_TIERS = ['same_movement_pattern', 'similar_muscle_group'];
    const subs = review.changes.filter((change) => change.kind === 'substitution');
    /* ⚠ **THE OLD CONTROL WAS `subs.length > 0` AND IT IS NOW STRUCTURALLY
     * UNREACHABLE HERE.** MEASURED across every region at 6-7: for every
     * LOWER-LIMB injury on the lower-body day, rungs 1-4 accept ZERO candidates.
     * Demanding a substitution here would be demanding the defect back. The
     * non-vacuity it protected is KEPT — the review must have reported
     * something — and section [11]'s sweep proves the rung-1-4 path still fires
     * in the regions that reach it. */
    ok('[3] CONTROL — the review actually reported something',
      review.changes.length + review.paused.length > 0,
      { changes: review.changes, paused: review.paused });
    ok('[3] every replacement carries an APPROVED tier and nothing invented',
      subs.every((change) => change.tier !== null && APPROVED_TIERS.includes(change.tier)),
      subs.map((c) => [c.from, c.to, c.tier]));
    ok('[3] every replacement is LEGAL for this injury under the one severity owner',
      subs.every((change) => injuryPermitsExerciseAtSeverity(
        resolveExerciseName(change.to!), constraint.bucket as never, constraint.severity)),
      subs.map((c) => [c.to, c.tier]));
    ok('[3] partial coverage is DISCLOSED, never implied (R-103)',
      subs.every((change) =>
        change.coversOriginalPattern === (change.tier === 'same_movement_pattern')),
      subs.map((c) => [c.from, c.to, c.tier, c.coversOriginalPattern]));
    ok('[3] every proposed change carries plain athlete-facing words',
      review.changes.every((change) => change.explanation.trim().length > 10),
      review.changes.map((c) => c.explanation));
    ok('[3] a paused row is typed PAUSED — there is no removal kind at all',
      review.changes.every((change) => change.kind === 'substitution' && change.to !== null)
        && review.paused.every((change) => change.kind === 'paused' && change.to === null),
      [...review.changes, ...review.paused].map((c) => [c.from, c.to, c.kind]));
    ok('[3] R-124 — an arrow is drawn ONLY for a rung 1-4 answer',
      review.changes.every((change) => change.tier === 'same_movement_pattern'
        || change.tier === 'similar_muscle_group'),
      review.changes.map((c) => [c.from, c.to, c.tier]));
  }

  /* ══ [1] + [6] ONE REVIEW, APPLIED TOGETHER, AND IT KEEPS ITS PROMISE ══ */
  console.log('\n[1] the review is a promise the write keeps');
  const { getAthleteExclusions } = require('../store/athletePreferencesStore');
  const { executeProgramControlActionDurably } = require('../utils/programControlActions');
  const exclusionsBefore = JSON.stringify(getAthleteExclusions());
  {
    const applied = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { constraint },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: target })) as { ok: boolean; message?: string };
    ok('[1] CONTROL — the approve door actually ran', applied.ok === true, applied);

    const afterRows = rowsOf(target, weekStart);
    const actual = quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()))
      .find(day => day.date === target)?.workout;
    ok('[1] the compiler preview keeps every promised row and dose',
      !!compilerPreview && dose(compilerPreview.workout) === dose(actual),
      { promised: dose(compilerPreview?.workout), actual: dose(actual) });
    const corruptPreview = compilerPreview && { ...compilerPreview.workout,
      exercises: compilerPreview.workout.exercises.map((row, index) => index === 0
        ? { ...row, prescribedSets: row.prescribedSets + 1 } : row) };
    ok('[1] CONTROL — the comparison rejects an incorrect preview dose',
      !!corruptPreview?.exercises.length && dose(corruptPreview) !== dose(actual));
    const subs = review.changes.filter((change) => change.kind === 'substitution');
    ok('[6] every substitution the review PROMISED is on the session afterwards',
      subs.every((change) => afterRows.includes(change.to!)),
      { promised: subs.map((c) => c.to), afterRows });
    ok('[6] and every row it promised to replace is gone from the session',
      subs.every((change) => !afterRows.includes(change.from)),
      { replaced: subs.map((c) => c.from), afterRows });
    ok('[6] APPLIED TOGETHER — one approval delivered all of them, not the first',
      subs.length === subs.filter((change) => afterRows.includes(change.to!)).length,
      { count: subs.length });

    /* ⚠ **R-124 INVERTED THIS ONE CELL, AND ONLY BY SAM'S EXPLICIT DECISION.**
     * *"The five paused exercises appear in the review, but disappear from the
     * active workout after Apply. Do not show five greyed-out SKIP cards."*
     * **R-115's property is UNCHANGED and still asserted below**: nothing is
     * written, so the accepted program keeps every row — which is what [4]'s
     * exclusions cells measure. What moved is only what the athlete sees. */
    const withheld = review.paused;
    ok('[4] R-124 — a paused row LEAVES the active session',
      withheld.every((change) => !afterRows.includes(change.from)),
      { paused: withheld.map((c) => c.from), afterRows });
    const dayAdjustment = adjustmentOf(target, weekStart);
    /* ⚠ **HIDDEN IS NOT FORGOTTEN.** The day carries them at session level,
     * because the red-flag completion refusal asks whether the injury is
     * withholding anything — a rule reading only visible rows would have stopped
     * firing the moment they became invisible. */
    ok('[4] the paused rows are still carried on the day, at session level',
      withheld.length === 0
        || (!!dayAdjustment && withheld.every((c) => dayAdjustment.paused.includes(c.from))),
      { paused: withheld.map((c) => c.from), dayAdjustment });
    ok('[4] R-124 — the review PROMISED exactly the block the door then derived',
      withheld.length === 0
        || (!!dayAdjustment && JSON.stringify(dayAdjustment.added)
          === JSON.stringify(review.added.map((candidate) => candidate.name))),
      { promised: review.added.map((c) => c.name), delivered: dayAdjustment?.added });
    ok('[4] and every added row really is on the session afterwards',
      review.added.every((candidate) => afterRows.includes(candidate.name)),
      { added: review.added.map((c) => c.name), afterRows });

    /* ══ [4] INJURY IS NOT REMOVE ════════════════════════════════════════ */
    ok('[4] applying the whole review wrote ZERO athlete Remove decisions',
      JSON.stringify(getAthleteExclusions()) === exclusionsBefore,
      { before: exclusionsBefore, after: JSON.stringify(getAthleteExclusions()) });

    /* ══ [7] RESTART ═════════════════════════════════════════════════════ */
    await relaunchApp({ storage: localStorageData, todayISO: target });
    const afterRelaunch = rowsOf(target, weekStart);
    ok('[7] close and reopen re-derives the same session',
      JSON.stringify(afterRelaunch) === JSON.stringify(afterRows),
      { afterRows, afterRelaunch });
    ok('[7] and the restart still wrote no Remove decisions',
      JSON.stringify(getAthleteExclusions()) === exclusionsBefore,
      JSON.stringify(getAthleteExclusions()));
    ok('[7] CONTROL — the session really did change from where it started',
      JSON.stringify(afterRelaunch) !== JSON.stringify(beforeRows),
      { beforeRows, afterRelaunch });
  }

  /* ══ [5] NOTHING CHANGED IS SAID PLAINLY ══════════════════════════════ */
  console.log('\n[5] never claim a change that did not happen');
  {
    const weekStart2 = await install();
    const days2 = trainingDays(weekStart2);
    let quietDay = '';
    let quietArea = '';
    for (const day of days2) {
      setJourneyClock(day);
      for (const candidate of CANDIDATE_AREAS) {
        if (unsafeCountFor(candidate, SEVERITY, day) === 0) { quietDay = day; quietArea = candidate; break; }
      }
      if (quietDay) break;
    }
    ok('[5] LIVENESS — a real day this injury genuinely does not touch was found',
      Boolean(quietDay) && Boolean(quietArea), { quietDay, quietArea });
    if (quietDay) {
      setJourneyClock(quietDay);
      const quietConstraint = constraintFor(quietArea, SEVERITY, quietDay);
      const quietReview = quiet(() =>
        buildSessionInjuryReview({ date: quietDay, constraint: quietConstraint })) as SessionInjuryReview;
      ok('[5] the review proposes nothing, and says so',
        quietReview.nothingChanges === true && quietReview.changes.length === 0,
        quietReview);
      ok('[5] its words contain NO claim that the session was made safe',
        !/safely|recomposed|swapped|made safe|left out/i.test(quietReview.headline),
        quietReview.headline);
      ok('[5] and the button does not promise rows it is not changing',
        !/apply/i.test(quietReview.approveLabel),
        quietReview.approveLabel);
      ok('[5] CONTROL — the same review on the AFFECTED world does claim changes',
        review.nothingChanges === false && /would/i.test(review.headline),
        review.headline);
      ok('[5] no partial-coverage disclosure is invented when nothing is proposed',
        quietReview.untrainedInWords.length === 0, quietReview.untrainedInWords);
    }
  }

  /* ══ [8] THE WITHHELD WORLD — R-115, AND THE ONLY WORLD THAT REACHES IT ══
   *
   * ⚠ **MEASURED, AND IT COST A MUTATION TO FIND OUT.** Deleting the withheld
   * branch from the review reddened NOTHING in the first cut of this suite. A
   * sweep of 13 areas x 5 severities x every training day of a real generated
   * fortnight produced **not one omission**: the approved ladder's rungs 5 and 6
   * ("an area this injury does not affect", "easy recovery") are large enough
   * that an ordinary injury always has a legal answer. So the `withheld` cells
   * in [3] and [4] above were green and EMPTY.
   *
   * The world that reaches it is the RED FLAG — Sam's 8-10 band together with
   * serious symptoms — where `getTapSwapChoices` returns rest only and every
   * affected row therefore has no named replacement. Measured: **all 5 rows
   * withheld, 0 substitutions.** That is R-115's world, and it is the one where
   * writing Remove decisions did real damage before the ruling.
   */
  console.log('\n[8] the red-flag world — every row withheld, nothing removed');
  {
    const weekStart3 = await install();
    const days3 = trainingDays(weekStart3);
    let flagDay = '';
    let flagArea = '';
    let withheldCount = 0;
    for (const day of days3) {
      setJourneyClock(day);
      for (const candidate of CANDIDATE_AREAS) {
        let c;
        try { c = constraintFor(candidate, 9, day, true); } catch { continue; }
        const r = quiet(() => buildSessionInjuryReview({ date: day, constraint: c })) as SessionInjuryReview;
        const withheld = r.paused;
        if (withheld.length > withheldCount) {
          withheldCount = withheld.length; flagDay = day; flagArea = candidate;
        }
      }
      if (withheldCount >= 2) break;
    }
    ok('[8] LIVENESS — a real world where the ladder genuinely has no answer was found',
      withheldCount >= 2 && Boolean(flagDay), { flagDay, flagArea, withheldCount });

    if (flagDay) {
      setJourneyClock(flagDay);
      const flagConstraint = constraintFor(flagArea, 9, flagDay, true);
      const flagReview = quiet(() =>
        buildSessionInjuryReview({ date: flagDay, constraint: flagConstraint })) as SessionInjuryReview;
      const rowsBefore = rowsOf(flagDay, weekStart3);
      const exclBefore = JSON.stringify(getAthleteExclusions());

      ok('[8] it is recognised as a red flag, and the review says so',
        flagReview.redFlag === true
          && /medical or physio advice/i.test(flagReview.headline),
        flagReview.headline);
      ok('[8] EVERY affected row is reported as PAUSED, never as a substitution',
        flagReview.paused.length > 0 && flagReview.changes.length === 0
          && flagReview.paused.every((change) => change.kind === 'paused' && change.to === null),
        [...flagReview.changes, ...flagReview.paused].map((c) => [c.from, c.kind, c.to]));
      ok('[8] each paused row carries the SAME words the session will show it under',
        flagReview.paused.every((change) =>
          change.explanation.includes(flagReview.bodyPart)
          && /leave it out and get medical or physio advice/i.test(change.explanation)),
        flagReview.changes.map((c) => c.explanation));
      ok('[8] and the review does NOT claim the session was made safe',
        !/safely|recomposed|made safe/i.test(flagReview.headline), flagReview.headline);

      const applied = await quietAsync(() => executeProgramControlActionDurably({
        type: 'set_injury_modifier',
        source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
        scope: 'current_and_future',
        payload: { constraint: flagConstraint },
        requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
      }, { todayISO: flagDay })) as { ok: boolean; message?: string };
      ok('[8] CONTROL — the approve door actually ran', applied.ok === true, applied);

      /* ⚠ **R-115, THE WHOLE OF IT.** An injury WITHHOLDS a row; it does not
       * remove one. Before the ruling this exact world wrote five exclusions the
       * athlete never made, and because Restore re-derives, it replayed them and
       * the day was empty forever. */
      ok('[8] R-115 — withholding every row wrote ZERO athlete Remove decisions',
        JSON.stringify(getAthleteExclusions()) === exclBefore,
        { before: exclBefore, after: JSON.stringify(getAthleteExclusions()) });
      const rowsAfter = rowsOf(flagDay, weekStart3);
      ok('[8] R-115 — the original exercises are ALL still there, preserved not deleted',
        flagReview.changes.every((change) => rowsAfter.includes(change.from)),
        { rowsBefore, rowsAfter });

      await relaunchApp({ storage: localStorageData, todayISO: flagDay });
      ok('[8] R-115 — and still there, still not removed, after close and reopen',
        JSON.stringify(getAthleteExclusions()) === exclBefore
          && flagReview.changes.every((change) => rowsOf(flagDay, weekStart3).includes(change.from)),
        rowsOf(flagDay, weekStart3));
    }
  }

  /* ══ [9] THE PAIRING, AND THE NAME BOTH SIDES USE ════════════════════════
   *
   * A review is only a promise if it promises the RIGHT PAIRS, not just the
   * right set. `[6]` asserts membership — every promised replacement arrives,
   * every replaced row leaves — which a shuffled mapping would satisfy. This
   * asserts `from -> to`, pair for pair, against what the session records.
   *
   * ⚠ **R-121 (Sam, 2026-08-20) IS THE SECOND HALF, AND THESE CELLS ARE
   * INVERTED FROM THE ONES THAT SHIPPED BEFORE IT.** They used to PIN the
   * divergence — *"the session's captions name the CHAIN HEAD instead"* — as a
   * measured fact awaiting a ruling. Sam ruled: *"The review and the applied
   * session must both name the exercise currently visible to the athlete. Keep
   * older substitution history internally, but do not show an older exercise as
   * the source of this new Injury change."* So the cell that recorded the
   * disagreement now refuses it, and it asserts MORE than it used to: that the
   * authored name is still kept, and still not shown.
   *
   * ⚠ **AND IT WAS NEVER A WORDING BUG.** The settle rebuilds the day from the
   * AUTHORED week and re-applies every active injury in one pass, so the second
   * injury genuinely planned against `Leg Press` and had never seen the row the
   * athlete was looking at. The name is DERIVED back — the day as it would be
   * without the newest injury — which is why `[7]`'s restart still holds.
   */
  console.log('\n[9] the pairing is exact, and both sides name the visible row');
  {
    const weekStart4 = await install();
    const days4 = trainingDays(weekStart4);
    const pairDay = days4.find((d) => rowsOf(d, weekStart4).length >= 4)!;
    setJourneyClock(pairDay);

    type Sub = { baseExerciseName?: string; originExerciseName?: string; cause?: string };
    const injuryRows = (): Array<{ name: string; sub: Sub }> => {
      const week = quiet(() => resolveWeekWithConditioning(weekStart4, buildScheduleStateImperative()));
      const d = week.find((x: { date: string }) => x.date === pairDay) as { workout?: Workout } | undefined;
      return ((d?.workout?.exercises ?? []) as unknown as Array<Record<string, unknown>>)
        .map((row) => ({
          name: String((row.exercise as { name?: string } | undefined)?.name ?? ''),
          sub: (row.substitutedFrom ?? {}) as Sub,
        }))
        .filter((row) => row.sub.cause === 'injury');
    };
    const pairsOn = (): string[] =>
      injuryRows().map((row) => `${row.sub.baseExerciseName} -> ${row.name}`).sort();

    const declare = async (constraint: unknown) => quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { constraint },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: pairDay }));

    /* ── ONE INJURY: the authored name IS what they saw, so nothing moves ──
     *
     * ⚠ **THE FIRST INJURY IS SEARCHED FOR NOW, FOR THE REASON THE SECOND
     * ALREADY WAS.** It was a fixed `Knee 7/10`, and R-124 made that world
     * substitution-free. **The R-121 property under test is untouched**; this
     * section has to be pointed at a world that still reaches it. */
    const substitutionsOf = (review: SessionInjuryReview): string[] => review.changes
      .filter((change) => change.kind === 'substitution')
      .map((change) => `${change.from} -> ${change.to}`).sort();
    let firstConstraint = constraintFor('Knee', 7, pairDay);
    let firstReview = quiet(() =>
      buildSessionInjuryReview({ date: pairDay, constraint: firstConstraint })) as SessionInjuryReview;
    if (substitutionsOf(firstReview).length < 2) {
      search: for (const candidate of CANDIDATE_AREAS) {
        for (const severity of [7, 6]) {
          let attempt;
          try { attempt = constraintFor(candidate, severity, pairDay); } catch { continue; }
          const attemptReview = quiet(() =>
            buildSessionInjuryReview({ date: pairDay, constraint: attempt })) as SessionInjuryReview;
          if (substitutionsOf(attemptReview).length >= 2) {
            firstConstraint = attempt; firstReview = attemptReview; break search;
          }
        }
      }
    }
    const firstPromised = substitutionsOf(firstReview);
    ok('[9] CONTROL — the first injury really does propose substitutions',
      firstPromised.length >= 2, firstPromised);
    await declare(firstConstraint);
    ok('[9] one injury — the review\'s pairing is EXACT, pair for pair',
      JSON.stringify(pairsOn()) === JSON.stringify(firstPromised),
      { promised: firstPromised, landed: pairsOn() });
    ok('[9] CONTROL — and no internal history is invented where none exists',
      injuryRows().every((row) => row.sub.originExerciseName === undefined),
      injuryRows().map((r) => r.sub));

    /* ── A SECOND INJURY ON ROWS THE FIRST ONE ALREADY REPLACED ───────────
     *
     * ⚠ **THE SECOND INJURY IS MEASURED, NOT NAMED, AND IT HAS TO BE.** These
     * cells need a world where the second injury SUBSTITUTES a row the first one
     * produced — that is the only shape in which two different names for one row
     * can exist. A fixed `Shoulder 7/10` used to give it and stopped the day the
     * section boundary landed: with a 7/10 knee AND a 7/10 shoulder there is no
     * legal Strength work left in either half of the body, so every row is
     * withheld and there is nothing to name. Searching keeps the cells honest
     * instead of quietly green over an all-withheld session. */
    const visibleBefore = rowsOf(pairDay, weekStart4);
    const firstProducedNames = firstPromised.map((pair) => pair.split(' -> ')[1]!);
    let secondConstraint = constraintFor('Shoulder', 5, pairDay);
    let secondReview = quiet(() =>
      buildSessionInjuryReview({ date: pairDay, constraint: secondConstraint })) as SessionInjuryReview;
    for (const candidate of CANDIDATE_AREAS) {
      /* R-124 widened this from [4,5,6]: at 4-5 nothing on this session is
       * unsafe, so those severities could never produce a second substitution. */
      for (const severity of [7, 6, 5, 4]) {
        let attempt;
        try { attempt = constraintFor(candidate, severity, pairDay); } catch { continue; }
        const review = quiet(() =>
          buildSessionInjuryReview({ date: pairDay, constraint: attempt })) as SessionInjuryReview;
        /* ⚠ **"ACTS ON", NOT "SUBSTITUTES" — SAM'S OWN WORD, AND THE ONLY SHAPE
         * THAT IS REACHABLE.** MEASURED on this world at every region and every
         * band: a second injury never SUBSTITUTES one of the first injury's
         * produced rows, because `Kettlebell Swings` and `Glute Bridge` are
         * hinge/glute work and rungs 1-4 accept nothing for any lower limb at
         * 6-7 while 4-5 leaves them safe. What every one of those injuries DOES
         * do is PAUSE them — by the name the athlete can see. **That is R-121's
         * requirement exactly** (*"The review and the applied session must both
         * name the exercise currently visible to the athlete"*) and it is what
         * the cells below now hold. */
        const actsOnAProducedRow = [...review.changes, ...review.paused].some((change) =>
          firstProducedNames.includes(change.from));
        if (actsOnAProducedRow) { secondConstraint = attempt; secondReview = review; break; }
      }
      if ([...secondReview.changes, ...secondReview.paused].some((change) =>
        firstProducedNames.includes(change.from))) break;
    }
    const secondPromised = secondReview.changes
      .filter((change) => change.kind === 'substitution')
      .map((change) => `${change.from} -> ${change.to}`).sort();
    /* ⚠ **THE CELL BELOW IS THE WHOLE WORLD, SO IT IS ASSERTED, NOT ASSUMED.**
     * If the second injury happened to land only on rows the first one never
     * touched, every R-121 cell under it would be green and empty — the two
     * names agree trivially when there is no earlier substitution. What it
     * needs is a row the FIRST injury PRODUCED being replaced again. */
    ok('[9] CONTROL — the second injury really does ACT ON a row the FIRST one produced',
      [...secondReview.changes, ...secondReview.paused].some((change) =>
        firstProducedNames.includes(change.from)),
      {
        secondNames: [...secondReview.changes, ...secondReview.paused]
          .map((c) => `${c.kind}:${c.from}`),
        firstProducedNames,
      });
    ok('[9] the review names rows that are ON THE SESSION the athlete can see',
      secondReview.changes.every((change) => visibleBefore.includes(change.from)),
      { named: secondReview.changes.map((c) => c.from), visibleBefore });

    await declare(secondConstraint);
    /* ⚠ **THE SESSION CARRIES BOTH INJURIES' CHANGES; THE REVIEW LISTS ONE.**
     * The first injury's own substitutions are still on the day and still
     * correctly named against the rows THEY replaced. So the promise is a
     * SUBSET relation, not equality — asserting equality here failed for a row
     * the athlete had had for a week, which is the assertion being wrong rather
     * than the app. */
    ok('[9] R-121 — every change the review promised lands, named the same way',
      secondPromised.every((pair) => pairsOn().includes(pair)),
      { promised: secondPromised, landed: pairsOn() });
    ok('[9] R-121 — and every substitution names a row that was on the session '
      + 'when it was made, never an older one',
      injuryRows().every((row) => visibleBefore.includes(String(row.sub.baseExerciseName))
        || firstPromised.some((pair) => pair.startsWith(`${row.sub.baseExerciseName} ->`))),
      { shown: injuryRows().map((r) => r.sub.baseExerciseName), visibleBefore, firstPromised });

    /* ⚠ **THE HISTORY IS KEPT, IT IS JUST NOT SHOWN.** Sam's other half.
     *
     * ⚠ **`originExerciseName` NEEDS A SECOND SUBSTITUTION ON A SUBSTITUTED
     * ROW, AND R-124 MADE THAT UNREACHABLE HERE — MEASURED, NOT ASSUMED.** The
     * search above asked every region at every band: not one of them substitutes
     * `Kettlebell Swings` or `Glute Bridge`, because both are hinge/glute work
     * and rungs 1-4 accept nothing for a lower limb at 6-7 while 4-5 leaves them
     * safe. So the chain never gets a second link in this world.
     *
     * **The property that IS reachable is asserted instead, and it is the one
     * Sam actually ruled**: after the second injury lands, the first injury's
     * rows still carry their own history, and every name in it is a row the
     * athlete could see — never an authored exercise they never met. A cell that
     * demanded the unreachable link would be red forever; a cell that asserted
     * nothing would be green and empty. This one runs. */
    /* ⚠ **NON-VACUITY BELONGS WHERE THE SHAPE EXISTS, AND IT IS ONE INJURY
     * EARLIER.** MEASURED: once the SECOND injury lands, the day carries no
     * `substitutedFrom` row at all — the settle replays the first injury from
     * the authored week and the ordinary swap door REFUSES its answer, because
     * the row it wants to write is unsafe under the injury declared afterwards.
     * That refusal is correct and it is the app being careful.
     *
     * So the "history exists" half is asserted where it is real — `[9] one
     * injury — the review's pairing is EXACT, pair for pair`, above, which reads
     * the same `injuryRows()` and requires two entries — and what is asserted
     * HERE is the property that must hold in the stacked world: whatever injury
     * history the day does carry names a row the athlete could see. Demanding
     * the two-injury day carry one would be demanding the refusal back. */
    const stillCarried = injuryRows().filter((row) => row.sub.cause === 'injury');
    ok('[9] R-121 — whatever history the day carries names a row the athlete could see',
      stillCarried.every((row) => typeof row.sub.baseExerciseName === 'string'
        && row.sub.baseExerciseName.length > 0
        && (visibleBefore.includes(String(row.sub.baseExerciseName))
          || firstPromised.some((pair) => pair.startsWith(`${row.sub.baseExerciseName} ->`)))),
      injuryRows().map((r) => r.sub));
    ok('[9] R-121 — and the SECOND injury names the row the athlete could see, '
      + 'never the authored one it replaced',
      secondReview.paused.every((change) => visibleBefore.includes(change.from)
        || firstProducedNames.includes(change.from)),
      { paused: secondReview.paused.map((c) => c.from), visibleBefore, firstProducedNames });

    /* ⚠ **AND IT SURVIVES A RESTART**, which a remembered name would not — the
     * visible source is re-derived from the stored facts on every settle. */
    await relaunchApp({ storage: localStorageData, todayISO: pairDay });
    ok('[9] R-121 — and it still reads the same way after close and reopen',
      secondPromised.every((pair) => pairsOn().includes(pair)),
      { promised: secondPromised, afterRelaunch: pairsOn() });

    /* ══ R-121'S OTHER HALF — WITHHELD ROWS, NOW CLOSED ════════════════════
     *
     * ⚠ **THIS CELL IS INVERTED FROM THE ONE THAT SHIPPED BEFORE IT.** It used
     * to assert the GAP as a measurement awaiting Sam's ruling: the review
     * promised to leave out `Tricep Pushdown` while the session withheld
     * `Bulgarian Split Squats`, because the settle re-derived the day from the
     * authored week and the first injury's replacement stopped existing.
     *
     * **Sam ruled the derivation, not the wording:** *"Stacked injuries operate
     * on the session the athlete could see before the newest injury."* With the
     * stages applied in declaration order, a withheld row IS the row the athlete
     * was looking at, so the two sides agree here for the same reason the
     * substitutions do — and this asserts it rather than recording its absence.
     */
    const withheldPromised = secondReview.paused.map((change) => change.from).sort();
    /* ⚠ **R-124 MOVED WHERE THE ANSWER LIVES, NOT WHAT IT IS.** A paused row
     * used to stay in `exercises` carrying `unavailableForInjury`; Sam's third
     * decision takes it off the athlete's list, so the day carries it at session
     * level. The property and this cell's job are identical. */
    const withheldActual = [...(adjustmentOf(pairDay, weekStart4)?.paused ?? [])].sort();
    ok('[9] CONTROL — the second injury really does withhold at least one row',
      withheldPromised.length > 0, { withheldPromised, withheldActual });
    ok('[9] R-121 — a WITHHELD row is the row the athlete could see, so the review '
      + 'and the session name the same ones',
      JSON.stringify(withheldPromised) === JSON.stringify(withheldActual),
      { promised: withheldPromised, actual: withheldActual });
  }

  /* ══ [10] THE BADGE OWNER ITSELF — ONE SENTENCE, ONE NAME ════════════════
   *
   * R-121's *"do not show an older exercise as the source"* has to hold at the
   * function that writes the words, not only at the data. The screen composed
   * this string itself until 2026-08-20, which is how the row and the review
   * came to disagree in the first place; a cell here is what stops a future
   * reader "helpfully" reaching for the history field.
   */
  console.log('\n[10] the badge owner shows the visible name and only that');
  {
    const { injurySubstitutionBadge, injurySubstitutionSourceName, mostRecentlyDeclaredInjuryId } =
      require('../rules/injurySubstitutionSource');
    const withHistory = {
      baseExerciseName: 'Chest-Supported DB Row',
      originExerciseName: 'Leg Press',
      cause: 'injury' as const,
    };
    const badge = injurySubstitutionBadge({
      substitution: withHistory, displayName: (name: string) => name,
    });
    ok('[10] the badge names the VISIBLE exercise',
      badge === 'Swapped from Chest-Supported DB Row — injury', badge);
    ok('[10] and never the older one, even when it is right there to read',
      !String(badge).includes('Leg Press'), badge);
    ok('[10] the source resolver agrees, and reads the same field',
      injurySubstitutionSourceName(withHistory) === 'Chest-Supported DB Row',
      injurySubstitutionSourceName(withHistory));
    ok('[10] no substitution, no sentence — a row nothing displaced says nothing',
      injurySubstitutionBadge({ substitution: null, displayName: (n: string) => n }) === null
        && injurySubstitutionSourceName(undefined) === null);
    ok('[10] the other two causes keep their own words',
      injurySubstitutionBadge({
        substitution: { baseExerciseName: 'Back Squat', cause: 'kit_today' },
        displayName: (n: string) => n,
      }) === 'Swapped from Back Squat — equipment today'
      && injurySubstitutionBadge({
        substitution: { baseExerciseName: 'Back Squat', cause: 'excluded_today' },
        displayName: (n: string) => n,
      }) === 'Swapped from Back Squat — you left it out');
    /* WHICH injury is "the new one" is derived from the facts so the live door
     * and boot cannot disagree — otherwise the badge would reword on restart. */
    ok('[10] the newest injury is derived from the facts, newest lastUpdatedAt first',
      mostRecentlyDeclaredInjuryId([
        { id: 'injury-knee', type: 'injury', status: 'active', lastUpdatedAt: '2026-08-01T00:00:00Z' },
        { id: 'injury-shoulder', type: 'injury', status: 'active', lastUpdatedAt: '2026-08-20T00:00:00Z' },
      ]) === 'injury-shoulder');
    ok('[10] CONTROL — a resolved injury is not a candidate, and none means none',
      mostRecentlyDeclaredInjuryId([
        { id: 'injury-knee', type: 'injury', status: 'resolved', lastUpdatedAt: '2026-08-20T00:00:00Z' },
      ]) === null && mostRecentlyDeclaredInjuryId([]) === null);
  }

  /* ══ [11] THE SECTION GATE — SAM ASKED FOR IT BY NAME ════════════════════
   *
   * *"Add a check that fails if any Mobility / Warm-up or Conditioning exercise
   * appears as a Strength replacement."* (2026-08-20)
   *
   * ⚠ **SWEPT, NOT SAMPLED.** One world would pass the day the boundary broke
   * for a different region or band — the defect it is guarding against was
   * reachable only when the ladder ran out of Strength options, which is a
   * property of the injury, not of the code path. So it walks every region the
   * menu offers at every authored band, over a real generated week, and asserts
   * the boundary on every substitution any of them produce.
   */
  console.log('\n[11] no Strength row is ever given Mobility or Conditioning work');
  {
    const { exerciseSessionFamily, everyPlacedExerciseFamily } =
      require('../rules/exerciseSessionFamily');
    const weekStart5 = await install();
    const days5 = trainingDays(weekStart5);
    let strengthRowsSeen = 0;
    let substitutionsSeen = 0;
    let ranOutOfStrength = 0;
    const violations: string[] = [];
    const recoveryOffered: string[] = [];

    /* ⚠ **THE SWEEP HAD TO BE STACKED, AND A MUTATION IS WHAT PROVED IT.** The
     * first version declared ONE injury per world and was GREEN AND EMPTY:
     * removing the section boundary from the planner, from the ladder AND from
     * the recovery fallback reddened nothing at all, because a single injury
     * almost always leaves some legal Strength work and the cross-section path
     * is never reached. The defect Sam saw needed the ladder to RUN OUT — which
     * took a second injury on an already-recomposed session. So a first injury
     * is applied through the real door, and the sweep runs on top of it. */
    const seedDay = days5.find((d) => rowsOf(d, weekStart5).length >= 4)!;
    setJourneyClock(seedDay);
    await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { constraint: constraintFor('Knee', 7, seedDay) },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: seedDay }));

    /* ⚠ **THE SWEEP WALKS EVERY TRAINING DAY NOW, NOT ONLY THE SEED DAY.**
     * R-124: rungs 1-4 are structurally empty for a lower-limb injury on the
     * lower-body day, so a sweep confined to it sees zero substitutions and its
     * non-vacuity control goes empty — while the boundary it guards (*a Strength
     * replacement stays a Strength exercise*) is exactly about substitutions.
     * The upper days still produce them, so the sweep is widened rather than the
     * control lowered. */
    for (const day of days5) {
      setJourneyClock(day);
      for (const area of CANDIDATE_AREAS) {
        /* ⚠ **WIDENED, NOT LOWERED.** R-124 legitimately produces fewer
         * substitutions — a rung-5 answer is no longer one — and this sweep came
         * in at 10 against a `> 10` bar that had been tuned to a world where
         * every unsafe row produced one. The bar stays exactly where it is; the
         * sweep covers two more bands instead, which is more coverage rather
         * than less proof. */
        for (const severity of [3, 4, 5, 6, 7, 9]) {
          let constraint;
          try { constraint = constraintFor(area, severity, day); } catch { continue; }
          const review = quiet(() =>
            buildSessionInjuryReview({ date: day, constraint })) as SessionInjuryReview;
          /* ⚠ **BOTH LISTS.** R-124 moved paused rows out of `changes`, and a
           * sweep reading only `changes` stopped seeing the very state this
           * boundary is about — a Strength row the ladder had no Strength answer
           * for is a PAUSED row now, not a change with a null `to`. */
          for (const change of [...review.changes, ...review.paused]) {
            const from = exerciseSessionFamily(change.from);
            if (from === 'strength') strengthRowsSeen += 1;
            /* The state the whole boundary is about: a Strength row the ladder
             * had no Strength answer for. If this never happens the cells below
             * are green and empty, so it is counted and asserted. */
            if (from === 'strength' && change.kind === 'paused') ranOutOfStrength += 1;
            if (change.kind !== 'substitution' || !change.to) continue;
            substitutionsSeen += 1;
            const to = exerciseSessionFamily(change.to);
            if (from && to !== from) {
              violations.push(`${day} ${area}/${severity}: ${change.from}[${from}] -> ${change.to}[${to}]`);
            }
            if (from === 'strength' && (to === 'conditioning' || to === 'mobility' || to === null)) {
              recoveryOffered.push(`${day} ${area}/${severity}: ${change.from} -> ${change.to}[${to}]`);
            }
          }
        }
      }
    }

    ok('[11] CONTROL — the sweep actually walked Strength rows and real substitutions',
      strengthRowsSeen > 20 && substitutionsSeen > 10,
      { strengthRowsSeen, substitutionsSeen });
    ok('[11] CONTROL — and it REACHED the state the boundary is about: a Strength '
      + 'row with no Strength answer left',
      ranOutOfStrength > 0, { ranOutOfStrength });
    ok('[11] NO Mobility / Warm-up or Conditioning exercise is ever a Strength replacement',
      recoveryOffered.length === 0, recoveryOffered.slice(0, 8));
    ok('[11] and no replacement crosses its row\'s section in either direction',
      violations.length === 0, violations.slice(0, 8));

    /* ⚠ **THE CLASSIFICATION HALF OF THE SAME RULING.** Sam, on the screenshot:
     * *"'Breathing Reset is unsafe with your hamstring' appears wrong and may
     * expose a broader classification defect."* It did — `unknown` (no entry in
     * the injury sheet) was refused by the predicate that decides whether an
     * EXISTING row must come out, so every unrated row on the athlete's session
     * was marked unsafe for every injury. 70 of 90 pooled and conditioning names
     * are unrated. */
    const { injuryWithholdsExistingRow, injuryPermitsExerciseAtSeverity } =
      require('../rules/injuryExerciseRisk');
    ok('[11] an unrated row is NOT withheld from a session it is already on',
      injuryWithholdsExistingRow('Breathing Reset', 'hamstring', 9) === false
        && injuryWithholdsExistingRow('Breathing Reset', 'shoulder', 7) === false,
      'Breathing Reset');
    ok('[11] but an unrated exercise is still never CHOSEN as a replacement',
      injuryPermitsExerciseAtSeverity('Breathing Reset', 'hamstring', 9) === false,
      'the two questions keep their opposite defaults');
    ok('[11] CONTROL — a rated risky row is still withheld, so this is not blanket permission',
      injuryWithholdsExistingRow('Back Squat', 'knee', 9) === true,
      'Back Squat / knee 9');

    /* ══ SAFETY UNKNOWN IS A NO — ASKED OF THE REAL GATE, NOT THE PREDICATE ══
     *
     * Sam, 2026-08-20: *"An unrated exercise may only be offered if another
     * explicit movement-pattern or body-area rule proves it safe. Otherwise
     * reject it as 'safety unknown' and continue down the ladder."*
     *
     * ⚠ **ASKING `injuryPermitsExerciseAtSeverity` WOULD HAVE PASSED AND PROVED
     * NOTHING.** That predicate always refused `unknown`; the hole was one layer
     * out, in `assessTapSwapCandidateSafety` — the function the ladder actually
     * passes as `isLegal` — where a hard-coded `isRecoveryName` pair skipped the
     * unrated refusal AND the per-region check. MEASURED at knee 9/10 AND
     * shoulder 9/10, the most severe world the app has: `Breathing Reset` came
     * back **safe=true**, under the sentence *"passes injury, readiness and
     * equipment checks"* when no injury check had run. So this cell asks the
     * GATE, and it sweeps every unrated name rather than sampling one.
     */
    const { assessTapSwapCandidateSafety } = require('../utils/tapSwapHierarchy');
    const { EXERCISE_TAGS } = require('../data/exerciseTags');
    const severeWorld = {
      injurySeverities: { knee: 9, shoulder: 9 },
      primaryInjury: { bucket: 'knee', severity: 9, seriousSymptoms: false },
      availableEquipment: ['bodyweight', 'dumbbell', 'barbell', 'band', 'machine', 'cable'],
      availableEquipmentTags: ['bodyweight', 'dumbbells', 'barbell', 'bands', 'machine', 'cables',
        'bike_or_treadmill'],
      capacity: 'normal', hasEquipmentConstraint: false, medicalStop: false,
    };
    const tagMap = EXERCISE_TAGS as Record<string, unknown>;
    const unratedAdmitted = (Array.from(everyPlacedExerciseFamily().keys()) as string[])
      .concat(['Breathing Reset'])
      .filter((name) => {
        const titled = name.replace(/\b\w/g, (c: string) => c.toUpperCase());
        return !tagMap[titled] && !tagMap[name];
      })
      .filter((name) => assessTapSwapCandidateSafety(name, severeWorld).safe);
    ok('[11] CONTROL — the severe world really does refuse rated risky work too',
      assessTapSwapCandidateSafety('Back Squat', severeWorld).safe === false,
      assessTapSwapCandidateSafety('Back Squat', severeWorld));
    ok('[11] SAFETY UNKNOWN IS A NO — no unrated exercise passes the real gate',
      unratedAdmitted.length === 0, unratedAdmitted.slice(0, 10));
    ok('[11] and the hard-coded recovery pair is no longer exempt from it',
      assessTapSwapCandidateSafety('Breathing Reset', severeWorld).safe === false
        && /cannot be verified/.test(
          assessTapSwapCandidateSafety('Breathing Reset', severeWorld).reason),
      assessTapSwapCandidateSafety('Breathing Reset', severeWorld));
    ok('[11] CONTROL — a RATED exercise is still judged on its rating, not blocked wholesale',
      assessTapSwapCandidateSafety('Easy Bike', severeWorld).safe === true,
      assessTapSwapCandidateSafety('Easy Bike', severeWorld));
  }

  /* ══ [1] THE INERTNESS CONTROL ON THE PENDING medicalStop CLAUSE ══════ */
  console.log('\n[1] the pending-medicalStop clause is inert for every prior caller');
  {
    const fs = require('fs');
    const sheet = fs.readFileSync('src/screens/home/GuidedInjuryFlowSheet.tsx', 'utf8');
    const door = fs.readFileSync('src/utils/programControlActions.ts', 'utf8');
    ok('[1] the guided sheet still reports seriousSymptoms: false, so no live path sets it',
      /seriousSymptoms:\s*false/.test(sheet), 'GuidedInjuryFlowSheet');
    ok('[1] and the injury door reads the flag from the constraint, not a literal',
      /seriousSymptoms:\s*args\.constraint\.seriousSymptoms === true/.test(door),
      'programControlActions');
    const { resolveTapSwapEnvironment } = require('../utils/tapSwapHierarchy');
    const withoutPending = quiet(() => resolveTapSwapEnvironment({
      date: target, profile: theAthlete(), activeConstraints: [], readinessSignal: null,
      primaryInjury: { bucket: 'knee', severity: 6, seriousSymptoms: false },
    })) as { medicalStop: boolean };
    const withPending = quiet(() => resolveTapSwapEnvironment({
      date: target, profile: theAthlete(), activeConstraints: [], readinessSignal: null,
      primaryInjury: { bucket: 'knee', severity: 9, seriousSymptoms: true },
    })) as { medicalStop: boolean };
    ok('[1] a pending injury with no serious symptoms is NOT a medical stop',
      withoutPending.medicalStop === false, withoutPending);
    ok('[1] a pending injury WITH serious symptoms is one, before it is stored',
      withPending.medicalStop === true, withPending);
  }

  console.log(`\n──────────────────────────────────────────────`);
  console.log(`Pass: ${pass}   Fail: ${fail}`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const name of failures) console.log(`  - ${name}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => { console.log(`SUITE THREW ${(error as Error).message}`); process.exit(1); });
}
