/**
 * ── THE INJURY FALLBACK, WALKED BY A REAL ATHLETE ──────────────────────────
 *
 * Every claim this unit makes is made HERE, through the real doors, on a real
 * generated week — never against hand-built state. `npm run census:injury-fallback`
 * measures the LADDER; this measures what the athlete ends up looking at.
 *
 * ## WHAT IT HOLDS
 *
 *  [1] LIVENESS. The chosen day genuinely carries work the injury makes unsafe,
 *      and the chosen unaffected day genuinely carries none. Both are DERIVED
 *      from the generated week, never named here — a suite that declares a knee
 *      injury against an upper day proves nothing, and that is not hypothetical:
 *      `injuryRecompositionTests` has been doing exactly that on `main`, with
 *      its own CONTROL cells red, so every "no unsafe rows left" cell in it has
 *      been green and empty.
 *  [2] EVERY AFFECTED PATTERN IS ANSWERED — squat, hinge, single-leg and trunk
 *      on the lower day; the four upper planes on the upper day — and each
 *      answer is legal, or the row is omitted and NAMED.
 *  [3] EVERY REPLACEMENT CARRIES ITS OWN LOAD. R-096: a replacement must never
 *      inherit the outgoing lift's weight.
 *  [4] UNAFFECTED DAYS AND ROWS DO NOT MOVE, byte for byte.
 *  [5] IT SURVIVES CLOSE AND REOPEN. The fact persists and the week re-derives
 *      to the same rows.
 *  [6] IT IS IDEMPOTENT. `quiescentBoot` re-applies active injuries after every
 *      ledger replay, so a rule that is still true of its own answer rewrites
 *      the session on every launch. Two relaunches, byte-identical rows.
 *  [7] RESTORE RETURNS THE ACCEPTED PROGRAM. Clearing the injury puts the
 *      original rows back, at their original loads.
 *  [8] THE SENTENCE AND THE ROWS AGREE, in both directions.
 *  [9] BLOCK ROTATION IS NOT CORRUPTED. A temporary injury leaves the stored
 *      rotation history exactly as it found it.
 *
 * ## WHAT IT DOES NOT COVER
 *
 * The simulator — another lane owns it today. Everything here is headless and
 * deterministic, and `scripts/seed-injury-fallback.ts` writes the seed a later
 * glass pass needs.
 *
 * Run: npm run test:injury-fallback-journey
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
import { coldStartThroughOnboarding, followTheWeek } from './support/athleteJourney';
import { addDaysISO } from '../utils/programBlockState';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { generateProgramLocally } from '../services/api/generateProgram';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';

const INSTALL_DAY = '2026-07-13';
const TARGET = '2026-07-22';

function mondayFor(d: string): string {
  const p = new Date(`${d}T12:00:00Z`);
  return addDaysISO(d, -((p.getUTCDay() + 6) % 7));
}
function theAthlete(): OnboardingData {
  return {
    firstName: 'Sim', ageRange: '22-26', seasonFinishedOn: '2026-07-12', heightCm: 184, weightKg: 90, gender: 'male', seasonPhase: 'Off-season',
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
  const installed = await quietAsync(() => coldStartThroughOnboarding({ profile: theAthlete(), installDayISO: INSTALL_DAY }));
  if (installed.onboardingRefusal) throw new Error(JSON.stringify(installed.onboardingRefusal));
  const weekStart = addDaysISO(mondayFor(INSTALL_DAY), 7);
  quiet(() => followTheWeek(weekStart));
  return weekStart;
}


function rowsOf(dateISO: string, weekStartISO: string): string[] {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  const w = (day as { workout?: Workout } | undefined)?.workout;
  return (w?.exercises ?? []).map((r) => {
    const n = (r as { exercise?: { name?: string } }).exercise?.name ?? (r as { name?: string }).name;
    const kg = (r as { prescribedWeightKg?: number }).prescribedWeightKg;
    return `${n}@${kg ?? '-'}`;
  });
}
function workoutOn(dateISO: string, weekStartISO: string): Workout | null {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  return ((day as { workout?: Workout } | undefined)?.workout) ?? null;
}





/**
 * ⚠ **THE BANDS AND THE PLANES ARE BOTH COVERED ON PURPOSE.**
 *
 * `hamstring 4` is the case the whole unit turns on: `RDLs` is rated
 * `hamstring: 'avoid'` so it must be swapped even in Sam's mild band, while
 * `Leg Press` and `Bulgarian Split Squats` are `caution` and must be **kept**
 * — *"Swap obvious aggravators. Keep safe work in."* On `main` that world
 * replaced the whole lower day with a bench press and a bike.
 *
 * `shoulder 6` is the only case that reaches the four UPPER planes, because the
 * generated week puts them on their own day. Without it, `horizontal_push`,
 * `vertical_push`, `horizontal_pull` and `vertical_pull` are never walked here.
 */
const CASES = [
  { label: 'hamstring, moderate', area: 'hamstring', region: 'lower_body', severity: 4 },
  { label: 'hamstring, limiting', area: 'hamstring', region: 'lower_body', severity: 6 },
  { label: 'knee, limiting', area: 'knee', region: 'lower_body', severity: 6 },
  { label: 'hamstring, paused', area: 'hamstring', region: 'lower_body', severity: 8 },
  { label: 'lower back, limiting', area: 'lower back', region: 'lower_body', severity: 6 },
  { label: 'shoulder, limiting', area: 'shoulder', region: 'upper_body', severity: 6 },
] as const;

/** Every main-strength plane the mission names, and what has been walked. */
const PATTERNS_SEEN = new Set<string>();

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) { pass += 1; console.log(`  ok   ${name}`); return; }
  fail += 1; failures.push(name);
  console.log(`  FAIL ${name}${detail === undefined ? '' : `\n         ${JSON.stringify(detail)}`}`);
}

function namesOf(rows: string[]): string[] {
  return rows.map((row) => row.slice(0, row.lastIndexOf('@')));
}
function loadOf(rows: string[], name: string): string | null {
  const hit = rows.find((row) => row.slice(0, row.lastIndexOf('@')) === name);
  return hit ? hit.slice(hit.lastIndexOf('@') + 1) : null;
}

/** Every day in the generated fortnight that carries any rows. */
function trainingDays(weekStart: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 14; i += 1) {
    const date = addDaysISO(weekStart, i);
    if (rowsOf(date, weekStart).length > 0) out.push(date);
  }
  return out;
}

async function declareInjury(
  area: string, region: string, severity: number, todayISO: string,
): Promise<{
  ok: boolean; changedProgram: boolean; message?: string; createdModifierIds?: string[];
}> {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { executeProgramControlActionDurably } = require('../utils/programControlActions');
  const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl');
  const constraint = buildGuidedInjuryConstraint({
    region, area, severity,
    severityBand: 'caution', adjustmentLevel: 'reduce_load',
    triggers: ['during'], seriousSymptoms: false,
  } as never, { todayISO });
  return await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_injury_modifier',
    source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { constraint },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { todayISO })) as {
    ok: boolean; changedProgram: boolean; message?: string; createdModifierIds?: string[];
  };
}

function environmentFor(
  area: string, region: string, severity: number, dateISO: string,
): unknown {
  const { resolveTapSwapEnvironment } = require('../utils/tapSwapHierarchy');
  const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl');
  const constraint = buildGuidedInjuryConstraint({
    region, area, severity,
    severityBand: 'caution', adjustmentLevel: 'reduce_load',
    triggers: ['during'], seriousSymptoms: false,
  } as never, { todayISO: dateISO }) as { bucket?: string; severity: number };
  return quiet(() => resolveTapSwapEnvironment({
    date: dateISO, profile: useProfileStore.getState().onboardingData,
    activeConstraints: [], readinessSignal: null,
    primaryInjury: { bucket: constraint.bucket, severity: constraint.severity },
  }));
}

/**
 * ── [0] SAM'S OWN GOOD SWAPS AND BAD SWAPS, ASKED OF THE LADDER DIRECTLY ────
 *
 * The journey below proves the DOOR behaves; this proves the LADDER answers what
 * Sam wrote. Each line is a verbatim example from `LFA_PROGRAMMING_BIBLE.md`
 * Section 8, and the bad-swap half matters as much as the good-swap half — a
 * ladder that offers `Deadlift` for a sore hamstring's `RDLs` has found the
 * worse version of his own *"Hamstring pain from RDL -> lighter RDL"*.
 *
 * These are asked of `buildInjuryFallbackLadder` with the band rule and nothing
 * else, so they hold the ORDER and the CANDIDATE SET rather than one door's
 * output on one generated week.
 */
function ladderFor(exercise: string, region: string, severity: number): Array<{
  name: string; rung: string; coversOriginalPattern: boolean;
}> {
  const { buildInjuryFallbackLadder } = require('../rules/injuryFallbackLadder');
  const { injuryPermitsExerciseAtSeverity } = require('../rules/injuryExerciseRisk');
  return buildInjuryFallbackLadder({
    exercise, region, avoidNames: [],
    isLegal: (name: string) => injuryPermitsExerciseAtSeverity(name, region, severity),
  });
}

function authoredSwapSection(): void {
  console.log('\n[0] Sam\'s authored swap hierarchy, asked of the ladder]');
  const { finerPatternIdentityOf } = require('../rules/injuryFallbackLadder');

  // "RDL -> hip thrust, glute bridge" — and NOT the heavier hinge.
  const rdl = ladderFor('RDLs', 'hamstring', 4);
  ok('RDL/hamstring offers Sam\'s hip thrust or glute bridge in the same pattern',
    rdl.slice(0, 4).some((o) => o.name === 'Hip Thrusts' || o.name === 'Glute Bridge'),
    rdl.slice(0, 4).map((o) => o.name));
  ok('RDL/hamstring never offers a HEAVIER hinge — his own bad swap',
    !rdl.some((o) => o.name === 'Deadlift' || o.name === 'Trap Bar Deadlift'),
    rdl.map((o) => o.name).slice(0, 8));

  // "Barbell bench -> DB floor press" / "Bench -> neutral-grip DB press".
  const bench = ladderFor('Bench Press', 'shoulder', 4);
  ok('bench/shoulder answers with a PRESS, not a squat — Bible :2198',
    bench[0]?.coversOriginalPattern === true
      && finerPatternIdentityOf(bench[0]!.name) === 'horizontal_push',
    bench.slice(0, 3).map((o) => o.name));
  ok('bench/shoulder reaches Sam\'s DB floor press or push-up',
    bench.slice(0, 6).some((o) =>
      o.name === 'Single-Arm DB Floor Press' || o.name === 'Push-ups'),
    bench.slice(0, 6).map((o) => o.name));

  // "Overhead press -> landmine press".
  const ohp = ladderFor('Overhead Press', 'shoulder', 4);
  ok('overhead press/shoulder offers the landmine press first — his verbatim swap',
    ohp[0]?.name === 'Landmine Press', ohp.slice(0, 3).map((o) => o.name));

  // "Bent-over row -> chest-supported row or cable row".
  const row = ladderFor('Barbell Row', 'lowerBack', 4);
  ok('bent-over row/lower back offers the chest-supported or cable row',
    row.slice(0, 4).some((o) =>
      o.name === 'Chest Supported Row' || o.name === 'Seated Cable Row'),
    row.slice(0, 4).map((o) => o.name));

  // "Knee pain from jumping -> more jump contacts" is the BAD swap.
  const jump = ladderFor('Box Jumps', 'knee', 6);
  ok('box jumps/knee never answers with more jumping — his own bad swap',
    !jump.some((o) => finerPatternIdentityOf(o.name) === 'plyo'),
    jump.slice(0, 5).map((o) => o.name));

  // R-087: a split squat is `single_leg_knee`, and a bilateral squat is not it.
  const split = ladderFor('Bulgarian Split Squats', 'knee', 4);
  const kept = split.filter((o) => o.coversOriginalPattern);
  ok('CONTROL: the split squat has same-pattern answers at all',
    kept.length > 0, split.slice(0, 4).map((o) => o.name));
  /* ⚠ **THE CHECK IS AGAINST THE OTHER GROUP, NOT AGAINST "HAS A GROUP".**
   * `Slant Board Step-Down`, `Cossack Squat` and `Lateral Lunge` are genuine
   * single-leg knee work that `STRENGTH_POOLS` does not carry, so they report
   * their SLOT (`squat`) and not a group — an assertion that every covering
   * answer is literally `single_leg_knee` fails on the ladder being RIGHT about
   * them. What must never happen is a BILATERAL squat counting as coverage for
   * a split squat, which is the R-087 distinction. */
  const bilateralSquats = ['Goblet Squat', 'Leg Press', 'Bodyweight Squat', 'Back Squat',
    'Front Squat', 'Box Squat', 'High Box Squat'];
  ok('a bilateral squat does not count as covering the single-leg pattern (R-087)',
    kept.every((o) => !bilateralSquats.includes(o.name)),
    kept.map((o) => `${o.name}:${finerPatternIdentityOf(o.name)}`));

  // "Heavy carry -> Pallof press or dead bug".
  const carry = ladderFor('Farmer Carry', 'lowerBack', 4);
  ok('heavy carry/lower back reaches Sam\'s Pallof press or dead bug',
    carry.some((o) => /Pallof|Dead Bug/i.test(o.name)),
    carry.slice(0, 6).map((o) => o.name));
}

async function main(): Promise<void> {
  const { unsafeRowsForInjury } = require('../utils/injurySessionRecomposition');
  authoredSwapSection();
  const { classifyGeneratedWorkoutRow } = require('../rules/generatedWorkoutRowClassification');
  const { finerPatternIdentityOf } = require('../rules/injuryFallbackLadder');

  for (const testCase of CASES) {
    console.log(`\n[${testCase.label}]`);
    const weekStart = await install();
    if (testCase.area === 'hamstring' && testCase.severity === 6) {
      // Reach the missing single-leg hip coordinate through the actual Add
      // transaction, not by inserting an exercise into a generated workout.
      setJourneyClock(weekStart);
      const added = await quietAsync(() => require('../utils/programControlActions')
        .executeProgramControlActionDurably({
          type: 'add_exercise',
          source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
          scope: 'today_only', payload: { date: weekStart,
            exercise: { name: 'Single-Leg RDL', sets: 2, repsMin: 8, repsMax: 12 } },
          requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
        }, { todayISO: weekStart })) as { ok: boolean; message?: string };
      ok('single-leg hip coverage enters through an accepted Add', added.ok, added.message);
    }
    const days = trainingDays(weekStart);

    /* ── [1] LIVENESS, DERIVED ─────────────────────────────────────────────
     * The day the injury is declared against is the one the generated week
     * actually gives it work to do — chosen by asking, never by naming a date
     * that a generation change can quietly make wrong. */
    let target: string | null = null;
    let targetCount = 0;
    let untouched: string | null = null;
    for (const date of days) {
      setJourneyClock(date);
      const workout = workoutOn(date, weekStart);
      const unsafe = quiet(() => unsafeRowsForInjury({
        workout, environment: environmentFor(testCase.area, testCase.region, testCase.severity, date),
      })) as string[];
      /* ⚠ **THE MOST-AFFECTED DAY, NOT THE FIRST ONE.** Taking the first put the
       * SHOULDER case on the lower day, whose only shoulder-rated row is
       * `Band Pallof Press` — so the four upper planes were never walked and the
       * coverage line read "trunk_support" for a shoulder injury. */
      if (unsafe.length > targetCount) { target = date; targetCount = unsafe.length; }
      // The strength classifier says nothing about mobility/conditioning.
      // Only claim an unaffected strength day after reaching that domain.
      if (unsafe.length === 0 && untouched === null
        && workout.exercises.every(row => ['main_strength', 'strength_accessory', 'trunk_support']
          .includes(row.section18Evidence?.role ?? ''))) untouched = date;
    }
    ok(`${testCase.label} — CONTROL: a day in the real week carries work this injury makes unsafe`,
      target !== null, { days });
    if (target === null) continue;

    setJourneyClock(target);
    const beforeTarget = rowsOf(target, weekStart);
    const beforeUntouched = untouched ? rowsOf(untouched, weekStart) : null;
    const beforeRotation = JSON.stringify(
      (useProgramStore.getState() as unknown as { blockState?: unknown }).blockState ?? null);
    const environment = environmentFor(testCase.area, testCase.region, testCase.severity, target);
    const unsafeBefore = quiet(() => unsafeRowsForInjury({
      workout: workoutOn(target!, weekStart), environment,
    })) as string[];
    /* The FINER identity — see `finerPatternIdentityOf`. `mainPattern` alone
     * cannot separate a split squat from a squat, so a coverage claim built on
     * it would under-report every single-leg world this suite walks. */
    const patternsBefore = new Set(unsafeBefore.map((name) => {
      const identity = finerPatternIdentityOf(name);
      return identity === 'unknown'
        ? String(classifyGeneratedWorkoutRow({ name }).kind)
        : identity;
    }));

    const result = await declareInjury(testCase.area, testCase.region, testCase.severity, target);
    const episodeId = result.createdModifierIds?.[0];
    const afterTarget = rowsOf(target, weekStart);

    /* ── [8] THE SENTENCE AND THE ROWS AGREE ────────────────────────────── */
    const rowsMoved = JSON.stringify(namesOf(beforeTarget)) !== JSON.stringify(namesOf(afterTarget));
    ok(`${testCase.label} — the door does not claim a swap it did not make`,
      !/swapped for a safe option/.test(result.message ?? '') || rowsMoved,
      { message: result.message, before: beforeTarget, after: afterTarget });
    ok(`${testCase.label} — the door does not say "nothing needed changing" over a session that changed`,
      !/[Nn]othing on this session needed changing/.test(result.message ?? '') || !rowsMoved,
      { message: result.message, before: beforeTarget, after: afterTarget });

    /* ── [2] EVERY AFFECTED PATTERN IS ANSWERED ─────────────────────────── */
    const unsafeAfter = quiet(() => unsafeRowsForInjury({
      workout: workoutOn(target!, weekStart), environment,
    })) as string[];
    ok(`${testCase.label} — nothing the injury forbids is left standing on the day`,
      unsafeAfter.length === 0, { unsafeAfter, after: afterTarget });
    const gone = namesOf(beforeTarget).filter((n) => !namesOf(afterTarget).includes(n));
    const arrived = namesOf(afterTarget).filter((n) => !namesOf(beforeTarget).includes(n));
    ok(`${testCase.label} — CONTROL: the injury really did take rows off this day`,
      gone.length > 0, { gone, arrived });

    /* ── R-103's PARTIAL-COVERAGE DISCLOSURE ────────────────────────────────
     * *"a typed, athlete-visible explanation naming what was substituted and
     * what remains untrained."* Both halves, and BOTH DIRECTIONS: a session
     * that lost a pattern must say so, and one that kept everything must not
     * invent a loss. */
    if (rowsMoved) {
      const { untrainedPatternsInWords } = require('../utils/injurySessionRecomposition');
      const untrained = untrainedPatternsInWords({
        before: namesOf(beforeTarget), after: namesOf(afterTarget),
      }) as string[];
      ok(`${testCase.label} — every row that changed is NAMED, not counted`,
        gone.every((name) => (result.message ?? '').includes(name)),
        { message: result.message, gone });
      ok(`${testCase.label} — a pattern that is no longer trained is disclosed in the athlete's words`,
        untrained.every((words) => (result.message ?? '').includes(words)),
        { message: result.message, untrained });
      ok(`${testCase.label} — and no loss is claimed that did not happen`,
        untrained.length > 0 || !/That means no /.test(result.message ?? ''),
        { message: result.message, untrained });
    }

    for (const pattern of patternsBefore) PATTERNS_SEEN.add(String(pattern));
    console.log(`         patterns hit: ${JSON.stringify([...patternsBefore])}`);
    console.log(`         ${JSON.stringify(gone)} -> ${JSON.stringify(arrived)}`);

    /* ── SAM'S 4-5 BAND KEEPS SAFE WORK IN ──────────────────────────────────
     * The band the whole unit turns on. Only the `avoid`-rated row is an
     * "obvious aggravator"; the `caution` rows stay, and they stay in their own
     * movement pattern rather than becoming upper-body work. */
    if (testCase.severity === 4) {
      const { classifyExerciseRiskForBucket } = require('../rules/injuryExerciseRisk');
      // The mild band is only reached by lower-limb worlds today; the region
      // vocabulary conversion stays general so a 'lower back' case can join.
      const bucket = String(testCase.area) === 'lower back' ? 'lowerBack' : testCase.area;
      const cautionKept = namesOf(beforeTarget).filter((name) =>
        classifyExerciseRiskForBucket(name, bucket, testCase.severity) === 'caution');
      ok(`${testCase.label} — CONTROL: the day really does carry caution-rated work at this band`,
        cautionKept.length > 0, { cautionKept });
      ok(`${testCase.label} — the mild band keeps safe work in and swaps only the aggravator`,
        cautionKept.every((name) => namesOf(afterTarget).includes(name)),
        { cautionKept, after: namesOf(afterTarget) });
      const { classifyGeneratedWorkoutRow: classify } = require('../rules/generatedWorkoutRowClassification');
      ok(`${testCase.label} — the swapped aggravator keeps its own movement pattern`,
        gone.every((from) => arrived.some((to) =>
          classify({ name: to }).mainPattern === classify({ name: from }).mainPattern)),
        { gone, arrived });
    }

    /* ── [3] OWN LOAD — PROVENANCE, NOT COINCIDENCE ─────────────────────────
     *
     * ⚠ **THE FIRST CUT OF THIS CELL WAS A COINCIDENCE DETECTOR AND IT FIRED.**
     * It flagged a replacement whose weight happened to EQUAL an outgoing lift's
     * — and `Chest-Supported DB Row@25`, `Tricep Pushdown@25` and
     * `Bulgarian Split Squats@25` are simply three things this athlete does with
     * a 25kg dumbbell. Equality is not provenance.
     *
     * The real question is whether the number came from the replacement's OWN
     * authority, so it is asked of that authority directly:
     * `loadForReplacementExercise` structurally cannot see the outgoing row (it
     * has no parameter for it), so agreeing with it IS the proof. */
    const { loadForReplacementExercise } = require('../rules/blockBoundaryProgression');
    const recordedLoadByExercise = quiet(() => {
      const store = useProgramStore.getState() as unknown as {
        inputs?: { weightOverridesByDate?: Record<string, Record<string, number>> };
      };
      const out: Record<string, number> = {};
      for (const byExercise of Object.values(store.inputs?.weightOverridesByDate ?? {})) {
        for (const [name, weight] of Object.entries(byExercise ?? {})) out[name] = weight;
      }
      return out;
    });
    const wrongLoad = arrived.filter((name) => {
      const shown = loadOf(afterTarget, name);
      const owned = quiet(() => loadForReplacementExercise({
        exerciseName: name,
        onboardingData: useProfileStore.getState().onboardingData,
        recordedLoadByExercise,
      })) as number | undefined;
      if (owned === undefined) return false;  // UNSET — the athlete chooses; nothing to check.
      return shown !== String(owned);
    });
    ok(`${testCase.label} — every replacement wears the load its OWN authority gives it`,
      wrongLoad.length === 0, { wrongLoad, after: afterTarget });

    /* ── [4] UNAFFECTED DAYS DO NOT MOVE ────────────────────────────────── */
    if (untouched && beforeUntouched) {
      ok(`${testCase.label} — the day this injury does not touch is byte-identical`,
        JSON.stringify(rowsOf(untouched, weekStart)) === JSON.stringify(beforeUntouched),
        { day: untouched, before: beforeUntouched, after: rowsOf(untouched, weekStart) });
    }
    const keptRows = namesOf(beforeTarget).filter((n) => namesOf(afterTarget).includes(n));
    ok(`${testCase.label} — rows the injury does not touch keep their own load`,
      keptRows.every((name) => loadOf(beforeTarget, name) === loadOf(afterTarget, name)),
      { keptRows, before: beforeTarget, after: afterTarget });

    /* ── [5] CLOSE AND REOPEN ───────────────────────────────────────────── */
    await relaunchApp({ storage: localStorageData, todayISO: target });
    const afterRelaunch = rowsOf(target, weekStart);
    ok(`${testCase.label} — the injury survives close and reopen`,
      JSON.stringify(afterRelaunch) === JSON.stringify(afterTarget),
      { afterTarget, afterRelaunch });

    /* ── [6] IDEMPOTENT ACROSS A SECOND LAUNCH ──────────────────────────── */
    await relaunchApp({ storage: localStorageData, todayISO: target });
    const afterSecondRelaunch = rowsOf(target, weekStart);
    ok(`${testCase.label} — a second launch does not rewrite the session again`,
      JSON.stringify(afterSecondRelaunch) === JSON.stringify(afterRelaunch),
      { afterRelaunch, afterSecondRelaunch });

    /* ── [9] BLOCK ROTATION UNTOUCHED ───────────────────────────────────── */
    ok(`${testCase.label} — a temporary injury leaves block rotation exactly as it found it`,
      JSON.stringify(
        (useProgramStore.getState() as unknown as { blockState?: unknown }).blockState ?? null,
      ) === beforeRotation,
      { beforeRotation });

    /* ── [7] RESTORE ────────────────────────────────────────────────────── */
    const { executeProgramControlActionDurably } = require('../utils/programControlActions');
    const cleared = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_injury_modifier',
      source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { episodeId },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    }, { todayISO: target })) as { ok: boolean; message?: string };
    /* ⚠ **THE CLEAR NEEDS THE EPISODE ID AND SAYS SO.** Without it the door
     * refuses with "No exact active injury episode matched this action" — so a
     * Restore cell that omits it is testing a refusal, not a restore. */
    ok(`${testCase.label} — CONTROL: the Restore door actually ran`,
      cleared.ok === true, cleared);
    const afterRestore = rowsOf(target, weekStart);
    ok(`${testCase.label} — Restore puts the accepted program back, rows and loads`,
      JSON.stringify(afterRestore) === JSON.stringify(beforeTarget),
      { beforeTarget, afterRestore });
  }

  /* ── [10] THE RED-FLAG WORLD — SAM'S RULING OF 2026-08-20, ALL SEVEN PARTS ─
   *
   * *"An 8-10 injury with serious symptoms must NEVER write into the athlete's
   * Remove list or permanently alter the accepted program. Preserve the original
   * exercises. On that date, show them as unavailable/skip with the explicit
   * injury safety explanation, or block the session if necessary. Clearing or
   * resolving the injury must immediately reveal the original accepted session
   * again, including after close/reopen. Remove remains exclusively
   * athlete-authored Remove."*
   *
   * WHAT IT REPLACED. Before the ruling an injury omission was written through
   * `remove_exercise`, which lands in `athletePreferencesStore.exclusions`.
   * MEASURED: five entries the athlete never made, and because Restore works by
   * RE-DERIVING it replayed them — the day was empty FOREVER. These cells used
   * to pin that defect; they pin the ruling now.
   */
  console.log('\n[10] the red-flag world — Sam, 2026-08-20]');
  {
    const { executeProgramControlActionDurably } = require('../utils/programControlActions');
    const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl');
    const { getAthleteExclusions } = require('../store/athletePreferencesStore');
    const { resolveSessionOutcomeTarget } = require('../store/sessionOutcomeTransaction');
    const { injuryWithholdingsOn, activeInjuryFactsOn } = require('../rules/injuryWithheldRows');

    const weekStart = await install();
    const target = '2026-07-20';
    setJourneyClock(target);
    const before = rowsOf(target, weekStart);
    /** The rows and loads as the STORED program holds them, not as they render. */
    const storedRows = (dateISO: string): string[] => {
      const program = (useProgramStore.getState() as unknown as {
        currentProgram?: { microcycles?: Array<{ startDate?: string; workouts?: Workout[] }> };
      }).currentProgram;
      const out: string[] = [];
      for (const cycle of program?.microcycles ?? []) {
        const cycleStart = String(cycle.startDate ?? '').slice(0, 10);
        for (const workout of cycle.workouts ?? []) {
          const offset = ((workout as unknown as { dayOfWeek: number }).dayOfWeek + 6) % 7;
          if (addDaysISO(cycleStart, offset) !== dateISO) continue;
          for (const row of workout.exercises ?? []) {
            const name = (row as { exercise?: { name?: string } }).exercise?.name;
            const kg = (row as { prescribedWeightKg?: number }).prescribedWeightKg;
            if (name) out.push(`${name}@${kg ?? '-'}`);
          }
        }
      }
      return out;
    };
    const storedBefore = storedRows(target);

    ok('red flag — CONTROL: the day really does carry work first', before.length > 0, before);
    ok('red flag — CONTROL: the accepted program really holds those rows',
      storedBefore.length > 0, storedBefore);
    ok('red flag — CONTROL: the athlete has removed nothing of their own',
      (quiet(() => getAthleteExclusions()) as unknown[]).length === 0);
    ok('red flag — CONTROL: a healthy athlete CAN record this day',
      (() => { try { quiet(() => resolveSessionOutcomeTarget(target, target)); return true; }
        catch { return false; } })());

    const constraint = buildGuidedInjuryConstraint({
      region: 'lower_body', area: 'hamstring', severity: 9,
      severityBand: 'avoid', adjustmentLevel: 'training_paused',
      triggers: ['during'], seriousSymptoms: true,
    } as never, { todayISO: target });
    const set = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { constraint },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: target })) as { message?: string; createdModifierIds?: string[] };
    const afterSet = rowsOf(target, weekStart);

    /* [1] NO REMOVE DECISION IS CREATED. */
    ok('red flag — creates NO Remove decision of any kind',
      (quiet(() => getAthleteExclusions()) as unknown[]).length === 0,
      quiet(() => getAthleteExclusions()));

    /* [2] THE ACCEPTED PROGRAM IS UNTOUCHED — rows AND loads, in storage. */
    ok('red flag — the accepted program keeps every row and load, byte for byte',
      JSON.stringify(storedRows(target)) === JSON.stringify(storedBefore),
      { storedBefore, storedAfter: storedRows(target) });
    ok('red flag — and the athlete still sees those rows, not an emptied day',
      JSON.stringify(afterSet) === JSON.stringify(before), { before, afterSet });

    /* [3] EVERY WITHHELD ROW CARRIES ITS OWN EXPLANATION. */
    const withheld = quiet(() => injuryWithholdingsOn({
      workout: workoutOn(target, weekStart), dateISO: target,
      facts: (useProgramStore.getState() as unknown as {
        acceptedMaterialContext?: { temporarySourceFacts?: unknown[] };
      }).acceptedMaterialContext?.temporarySourceFacts,
    })) as Array<{ exercise: string; explanation: string; redFlag: boolean }>;
    ok('red flag — CONTROL: rows really are withheld', withheld.length > 0, withheld);
    ok('red flag — every withheld row names itself and says why, in plain words',
      withheld.every((entry) => entry.explanation.includes(entry.exercise)
        && /not safe with your hamstring/.test(entry.explanation)
        && /physio/.test(entry.explanation)),
      withheld.map((entry) => entry.explanation));
    const markedDay = workoutOn(target, weekStart) as unknown as {
      exercises?: Array<{ exercise?: { name?: string }; unavailableForInjury?: unknown }>;
    };
    ok('red flag — the marks reach the row the session screen reads',
      (markedDay.exercises ?? []).filter((row) => row.unavailableForInjury).length === withheld.length,
      (markedDay.exercises ?? []).map((row) => [row.exercise?.name, Boolean(row.unavailableForInjury)]));

    /* [4] THE DAY CANNOT BE COMPLETED AS NORMAL, AND FOR THE RIGHT REASON. */
    let refusal: string | null = null;
    try { quiet(() => resolveSessionOutcomeTarget(target, target)); }
    catch (error) { refusal = (error as Error).message; }
    ok('red flag — the injured date cannot be recorded as a normal session',
      refusal !== null, refusal);
    ok('red flag — and the refusal blames the INJURY, not a missing session',
      refusal !== null && /not safe with your hamstring/.test(refusal)
        && !/No visible session/.test(refusal),
      refusal);

    /* [5] THE SENTENCE NAMES WHAT IS WITHHELD AND CLAIMS NO SWAP. */
    ok('red flag — every withheld row is NAMED in what the athlete is told',
      withheld.every((entry) => (set.message ?? '').includes(entry.exercise)),
      { message: set.message });
    ok('red flag — and no swap is claimed, because none was made',
      !/swapped for/.test(set.message ?? ''), set.message);

    /* [6] CLEARING REVEALS THE EXACT ORIGINAL SESSION. */
    const cleared = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_injury_modifier',
      source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { episodeId: set.createdModifierIds?.[0] },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    }, { todayISO: target })) as { ok: boolean; message?: string };
    ok('red flag — CONTROL: the Restore door actually ran', cleared.ok === true, cleared);
    const afterClear = rowsOf(target, weekStart);
    ok('red flag — clearing reveals the EXACT original session, rows and loads',
      JSON.stringify(afterClear) === JSON.stringify(before), { before, afterClear });
    ok('red flag — and nothing is withheld any more',
      ((workoutOn(target, weekStart) as unknown as {
        exercises?: Array<{ unavailableForInjury?: unknown }>;
      }).exercises ?? []).every((row) => !row.unavailableForInjury));
    ok('red flag — the day can be recorded again once the injury is cleared',
      (() => { try { quiet(() => resolveSessionOutcomeTarget(target, target)); return true; }
        catch { return false; } })());

    /* [7] AND THE MESSAGE ONLY CLAIMS A RETURN THAT ACTUALLY HAPPENED. */
    ok('red flag — the resolve never claims a recomposition it did not make',
      !/safely recomposed/.test(cleared.message ?? ''), cleared.message);
    ok('red flag — it says the exercises are available again, and they visibly are',
      /available again/.test(cleared.message ?? '')
        && JSON.stringify(afterClear) === JSON.stringify(before),
      cleared.message);

    /* ⚠ **ONLY A RED FLAG BLOCKS, AND ONLY FROM THE DAY IT WAS REPORTED.**
     * Both halves had no cell until mutations M15 and M16 SURVIVED. An ordinary
     * injury substitutes and the athlete trains, so blocking there would stop
     * training the app exists to keep going; and an injury reported on Friday
     * must not reach back and withhold Monday's finished session. */
    {
      const laterWeekStart = await install();
      const earlier = '2026-07-20';
      const later = '2026-07-24';
      setJourneyClock(later);
      const earlierRowsBefore = rowsOf(earlier, laterWeekStart);
      const ordinary = buildGuidedInjuryConstraint({
        region: 'lower_body', area: 'hamstring', severity: 6,
        severityBand: 'caution', adjustmentLevel: 'reduce_load',
        triggers: ['during'], seriousSymptoms: false,
      } as never, { todayISO: later });
      await quietAsync(() => executeProgramControlActionDurably({
        type: 'set_injury_modifier',
        source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
        scope: 'current_and_future',
        payload: { constraint: ordinary },
        requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
      }, { todayISO: later }));
      ok('an ORDINARY injury does not block the session — the athlete still trains',
        (() => { try { quiet(() => resolveSessionOutcomeTarget(later, later)); return true; }
          catch { return false; } })());
      /* ⚠ **THE FIRST CONTROL HERE WAS WRONG AND SAID SO.** It asserted the
       * ordinary injury WITHHELD something on its own day — and it withholds
       * nothing, because at 6/10 the ladder SUBSTITUTES the unsafe rows, which
       * is the whole point of the unit. The rule mutation M16 actually breaks is
       * `activeInjuryFactsOn`'s onset-date filter, so that is what is asked. */
      const factsNow = (useProgramStore.getState() as unknown as {
        acceptedMaterialContext?: { temporarySourceFacts?: unknown[] };
      }).acceptedMaterialContext?.temporarySourceFacts;
      const liveOnLater = quiet(() => activeInjuryFactsOn(factsNow, later)) as unknown[];
      const liveOnEarlier = quiet(() => activeInjuryFactsOn(factsNow, earlier)) as unknown[];
      ok('CONTROL: the injury really is in force on the day it was reported',
        liveOnLater.length > 0, liveOnLater.length);
      ok('an injury reported today is not in force on a day already past',
        liveOnEarlier.length === 0, liveOnEarlier.length);
      ok('and the earlier day the athlete already trained is untouched',
        JSON.stringify(rowsOf(earlier, laterWeekStart)) === JSON.stringify(earlierRowsBefore),
        { earlierRowsBefore, now: rowsOf(earlier, laterWeekStart) });
    }

    /* [8] AND IT ALL SURVIVES CLOSE AND REOPEN. */
    await relaunchApp({ storage: localStorageData, todayISO: target });
    ok('red flag — the restored session survives close and reopen',
      JSON.stringify(rowsOf(target, weekStart)) === JSON.stringify(before),
      { before, afterReopen: rowsOf(target, weekStart) });
    ok('red flag — and no Remove decision appeared across the restart',
      (quiet(() => getAthleteExclusions()) as unknown[]).length === 0,
      quiet(() => getAthleteExclusions()));
  }

  /* ── [11] ONLY A RED FLAG BLOCKS — ASKED OF THE PREDICATE DIRECTLY ────────
   *
   * ⚠ **THIS IS THE ONE PLACE THIS SUITE HAND-BUILDS AN INPUT, AND THE REASON
   * IS MEASURED.** `injurySessionOutcomeRefusal`'s red-flag filter is
   * UNREACHABLE through a real journey world: an ordinary injury SUBSTITUTES
   * every unsafe row (0 omissions in 1049 unsafe occurrences across four kits),
   * so it never leaves one withheld for the filter to spare — mutation M15
   * survived the whole journey for exactly that reason.
   *
   * A clause no mutation can reach is a clause not doing the work its comment
   * claims, and the answer here is not to delete it — an ordinary injury must
   * keep the athlete training, and a future world that cannot substitute must
   * not silently start blocking sessions. So the rule is asked of the PURE
   * PREDICATE over typed facts, where both sides of the boundary exist.
   */
  console.log('\n[11] only a red flag blocks]');
  {
    const { injurySessionOutcomeRefusal } = require('../rules/injuryWithheldRows');
    const episode = (severity: number, seriousSymptoms: boolean) => ({
      protocolVersion: 1, episodeId: `e-${severity}-${seriousSymptoms}`,
      bodyPart: 'hamstring', bucket: 'hamstring', severity,
      status: 'active', onsetOrReportedDate: '2026-07-20',
      createdAt: '2026-07-20T00:00:00Z', updatedAt: '2026-07-20T00:00:00Z',
      resolvedAt: null, triggers: [], seriousSymptoms,
      transitionHistory: [], sourceActor: 'athlete', sourceSurface: 'test',
      affectedDates: [], affectedWeeks: [], currentRestrictionPolicy: {},
      legacyMigrationStatus: 'native_v1', compatibility: { constraintId: 'c' },
    });
    const dayWithAnUnsafeRow = {
      exercises: [{ exercise: { name: 'RDLs' } }],
    } as unknown as Workout;
    const ask = (severity: number, serious: boolean) => quiet(() => injurySessionOutcomeRefusal({
      workout: dayWithAnUnsafeRow, dateISO: '2026-07-20',
      facts: [episode(severity, serious) as never],
    })) as { code: string } | null;

    ok('CONTROL: the row really is unsafe for this injury, or nothing below means anything',
      ask(9, true) !== null || ask(6, false) !== null, {
        redFlag: ask(9, true), ordinary: ask(6, false),
      });
    ok('serious symptoms block affected work at the severe band',
      ask(9, true)?.code === 'red_flag_injury_session', ask(9, true));
    ok('a LIMITING injury (6-7) does not block — the athlete still trains',
      ask(6, false) === null, ask(6, false));
    ok('a PAUSE-band injury without serious symptoms does not block either',
      ask(9, false) === null, ask(9, false));
    // R-267 supersedes the old numeric-and-symptoms conjunction. Keep this
    // predicate check independent of the UI and exercise every numeric band.
    for (let severity = 1; severity <= 10; severity++) {
      ok(`serious symptoms block affected work independently at severity ${severity}`,
        ask(severity, true)?.code === 'red_flag_injury_session', ask(severity, true));
    }
  }

  /* ── EVERY PATTERN THE MISSION NAMES WAS ACTUALLY WALKED ──────────────────
   * Printed AND asserted: a suite that covers four of eight planes and says
   * "all patterns" is the claim this repo keeps finding. */
  console.log(`\nMAIN PATTERNS WALKED: ${JSON.stringify([...PATTERNS_SEEN].sort())}`);
  /* THE MISSION'S LIST, IN THE POOLS' OWN VOCABULARY.
   *
   * ⚠ **A SLOT AND ITS BILATERAL GROUP ARE THE SAME PATTERN AT TWO
   * GRANULARITIES**, because the pools author `group` only on the entries that
   * SPLIT a slot: `RDLs` is a hinge anchor with no group and reports `hinge`,
   * while `Hip Thrusts` is a hinge accessory and reports `bilateral_hinge`.
   * Requiring the group name alone would have failed on a world that walked the
   * hinge through its main lift — which is the commonest world there is. */
  const REQUIRED_PATTERNS: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['squat', ['squat', 'bilateral_squat']],
    ['hinge', ['hinge', 'bilateral_hinge']],
    ['single-leg knee', ['single_leg_knee']],
    ['single-leg hip', ['single_leg_hip']],
    ['horizontal push', ['horizontal_push']],
    ['vertical push', ['vertical_push']],
    ['horizontal pull', ['horizontal_pull']],
    ['vertical pull', ['vertical_pull']],
    ['trunk', ['core']],
  ];
  for (const [label, accepted] of REQUIRED_PATTERNS) {
    ok(`coverage — a real athlete world exercised the ${label} pattern`,
      accepted.some((name) => PATTERNS_SEEN.has(name)), [...PATTERNS_SEEN].sort());
  }


  /* ── [11] THE VISIBLE SIDE — THE PROJECTION AND THE SCREEN ────────────────
   *
   * Section [10] proves the DOMAIN preserves the day. This section proves the
   * ATHLETE SEES it, because between the two sat the defect this lane owns:
   *
   *   MEASURED, hamstring 9/10 + serious symptoms, 2026-07-20, on `b09626a3`:
   *     resolver           5 rows at their loads, 4 marked withheld
   *     projectVisibleDay  workout: null, source: 'rest'   <- the day vanished
   *
   * Pass 1's exposure engine and Pass 2's validator sweep filtered the marked
   * rows out as violations, and `collapseEmptyVisibleWorkoutShell` turned what
   * was left into a Rest day. Sam's *"preserve the original exercises"* survived
   * the domain and died at the view.
   *
   * ⚠ **NO INJURY RULE IS RE-DERIVED ON THE SCREEN, AND CELLS BELOW ENFORCE
   * THAT.** The projection reads one typed field; the screen reads the same
   * field and renders the sentence the domain composed.
   */
  console.log('\n[11] the visible side — projection and screen');
  {
    const { executeProgramControlActionDurably } = require('../utils/programControlActions');
    const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl');
    const { getAthleteExclusions } = require('../store/athletePreferencesStore');
    const { resolveSessionOutcomeTarget } = require('../store/sessionOutcomeTransaction');
    const { buildProgramTabProjectedWeek } = require('../utils/visibleProgramReadModel');
    const { buildSessionExecutionPlan } = require('../utils/sessionExecutionChecklist');
    const { buildSessionTemplate } = require('../utils/sessionTemplate');
    const fs = require('fs');
    const path = require('path');

    const weekStart = await install();
    const target = '2026-07-20';
    setJourneyClock(target);

    /** THE DAY AS EVERY ATHLETE SURFACE RECEIVES IT — one projection, two readers. */
    const projectedDay = (): { workout?: Workout | null; source?: string } | undefined => {
      const week = quiet(() => buildProgramTabProjectedWeek({
        mondayISO: weekStart, todayISO: target,
        state: buildScheduleStateImperative(),
        overrideContexts: (useProgramStore.getState() as unknown as {
          overrideContexts?: Record<string, unknown> }).overrideContexts ?? {},
      })) as Array<{ date: string; workout?: Workout | null; source?: string }>;
      return week.find((d) => d.date === target);
    };
    const projectedRows = (): string[] => ((projectedDay()?.workout?.exercises ?? []) as Array<{
      exercise?: { name?: string }; prescribedWeightKg?: number }>)
      .map((r) => `${r.exercise?.name}@${r.prescribedWeightKg ?? '-'}`);
    /** The Session screen's own list, built from that same projected workout. */
    const sessionRows = (): string[] => {
      const workout = projectedDay()?.workout ?? null;
      if (!workout) return [];
      const plan = quiet(() => buildSessionExecutionPlan({
        workout, template: buildSessionTemplate(workout), mobilityFlow: null,
      })) as { sections: Array<{ id: string; items: Array<{ label: string }> }> };
      return plan.sections.filter((s) => s.id !== 'mobility')
        .flatMap((s) => s.items.map((i) => i.label));
    };
    const marks = (): string[] => ((projectedDay()?.workout?.exercises ?? []) as Array<{
      exercise?: { name?: string }; unavailableForInjury?: { explanation?: string } }>)
      .filter((r) => !!r.unavailableForInjury).map((r) => String(r.exercise?.name));
    const canRecord = (): boolean => {
      try { quiet(() => resolveSessionOutcomeTarget(target, target)); return true; }
      catch { return false; }
    };

    const projectedBefore = projectedRows();
    ok('[11] CONTROL — the projection carries a real session before any injury',
      projectedBefore.length > 0 && !!projectedDay()?.workout, projectedBefore);
    ok('[11] CONTROL — and it is recordable while healthy', canRecord());

    const constraint = buildGuidedInjuryConstraint({
      region: 'lower_body', area: 'hamstring', severity: 9,
      severityBand: 'avoid', adjustmentLevel: 'training_paused',
      triggers: ['during'], seriousSymptoms: true,
    } as never, { todayISO: target });
    const set = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { constraint },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: target })) as { createdModifierIds?: string[] };

    /* MUTATION TARGET 1 — BLANKING THE RED-FLAG DAY MUST FAIL. */
    ok('[11] the projected red-flag day still HAS a session',
      !!projectedDay()?.workout, { source: projectedDay()?.source });
    ok('[11] and it is not presented as a Rest day',
      projectedDay()?.source !== 'rest', projectedDay()?.source);

    /* MUTATION TARGET 3 — LOSING ROWS OR LOADS MUST FAIL. */
    ok('[11] every original row and load survives into the projection, in order',
      JSON.stringify(projectedRows()) === JSON.stringify(projectedBefore),
      { before: projectedBefore, after: projectedRows() });
    ok('[11] the Session screen lists them too — not an empty failed program',
      sessionRows().length >= projectedBefore.length, sessionRows());
    ok('[11] BOTH SURFACES AGREE — the day summary count and the session list match',
      (projectedDay()?.workout?.exercises ?? []).length > 0
        && sessionRows().length >= (projectedDay()?.workout?.exercises ?? [])
          .filter((r: unknown) => !!(r as { exercise?: { name?: string } }).exercise?.name).length - 1,
      { projectedCount: (projectedDay()?.workout?.exercises ?? []).length, session: sessionRows() });

    /* THE WITHHELD ROWS ARE MARKED, VISIBLY, WITH THE DOMAIN'S OWN WORDS. */
    ok('[11] the withheld rows reach the screen still carrying their typed mark',
      marks().length > 0, marks());
    ok('[11] and each mark carries the sentence the DOMAIN wrote, not one from the screen',
      ((projectedDay()?.workout?.exercises ?? []) as Array<{
        exercise?: { name?: string }; unavailableForInjury?: { explanation?: string } }>)
        .filter((r) => !!r.unavailableForInjury)
        .every((r) => String(r.unavailableForInjury?.explanation ?? '')
          .includes(String(r.exercise?.name ?? ''))),
      marks());

    /* MUTATION TARGET 2 — ENABLING COMPLETION MUST FAIL. */
    ok('[11] the athlete cannot record the red-flag session as normal', !canRecord());

    /* MUTATION TARGET 5 — CREATING A REMOVE DECISION MUST FAIL. */
    ok('[11] and none of this created a Remove decision',
      (quiet(() => getAthleteExclusions()) as unknown[]).length === 0,
      quiet(() => getAthleteExclusions()));

    /* MUTATION TARGET 4 — CLEARING MUST RESTORE, AND SURVIVE A RELAUNCH. */
    await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_injury_modifier',
      source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { episodeId: set.createdModifierIds?.[0] },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    }, { todayISO: target }));
    ok('[11] clearing the injury restores the exact session in the PROJECTION',
      JSON.stringify(projectedRows()) === JSON.stringify(projectedBefore),
      { before: projectedBefore, cleared: projectedRows() });
    ok('[11] and the rows go back to ordinary interactive ones — no marks left',
      marks().length === 0, marks());
    ok('[11] and the day is recordable again', canRecord());

    /* ⚠ **FIXED BY THE INTEGRATOR, 2026-08-20 — THIS RELAUNCH WAS BROKEN TWICE.**
       It read `quiet(() => relaunchApp('injury-visible:relaunch'))`. `relaunchApp` takes
       `{ storage, todayISO }` and returns a PROMISE: the label reached it as
       `args`, so `args.todayISO` was `undefined` and `setJourneyClock` THREW —
       killing the process after 172 cells, so every assertion below this line
       had never run. And un-awaited inside `quiet`, the restart would not have
       happened before the next comparison even with the right argument, which is
       the inert-relaunch shape `test:settings-persistence` M8 was written for.
       Called the way this same file's sections [4] and [8] already call it. */
    await relaunchApp({ storage: localStorageData, todayISO: target });
    setJourneyClock(target);
    ok('[11] close/reopen preserves the RESTORED state',
      JSON.stringify(projectedRows()) === JSON.stringify(projectedBefore)
        && marks().length === 0,
      { rows: projectedRows(), marks: marks() });

    /* AND CLOSE/REOPEN PRESERVES THE WITHHELD STATE TOO. */
    const set2 = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { constraint: buildGuidedInjuryConstraint({
        region: 'lower_body', area: 'hamstring', severity: 9,
        severityBand: 'avoid', adjustmentLevel: 'training_paused',
        triggers: ['during'], seriousSymptoms: true,
      } as never, { todayISO: target }) },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: target })) as { createdModifierIds?: string[] };
    void set2;
    /* ⚠ **FIXED BY THE INTEGRATOR, 2026-08-20 — THIS RELAUNCH WAS BROKEN TWICE.**
       It read `quiet(() => relaunchApp('injury-visible:relaunch-withheld'))`. `relaunchApp` takes
       `{ storage, todayISO }` and returns a PROMISE: the label reached it as
       `args`, so `args.todayISO` was `undefined` and `setJourneyClock` THREW —
       killing the process after 172 cells, so every assertion below this line
       had never run. And un-awaited inside `quiet`, the restart would not have
       happened before the next comparison even with the right argument, which is
       the inert-relaunch shape `test:settings-persistence` M8 was written for.
       Called the way this same file's sections [4] and [8] already call it. */
    await relaunchApp({ storage: localStorageData, todayISO: target });
    setJourneyClock(target);
    ok('[11] close/reopen preserves the WITHHELD state — rows, loads and marks',
      JSON.stringify(projectedRows()) === JSON.stringify(projectedBefore)
        && marks().length > 0 && !projectedDay()?.workout === false,
      { rows: projectedRows(), marks: marks(), source: projectedDay()?.source });
    ok('[11] and it is still refused, and still creates no Remove decision',
      !canRecord() && (quiet(() => getAthleteExclusions()) as unknown[]).length === 0);

    /* ⚠ AN ORDINARY INJURY SUBSTITUTES, AND A SUBSTITUTE IS NOT A WITHHELD ROW.
     *
     * FOUND ON GLASS once the day stopped being blanked: hamstring 8/10 without
     * serious symptoms showed four SKIP markers on the safe REPLACEMENTS, each
     * sentence naming a different exercise than the row it sat on
     * (`Chest-Supported DB Row` -> *"Leg Press is not safe …"*). The mark is
     * written before the substitution renames the row in place. */
    /* ⚠ **FIXED BY THE INTEGRATOR, 2026-08-20 — THIS RELAUNCH WAS BROKEN TWICE.**
       It read `quiet(() => relaunchApp('injury-visible:ordinary'))`. `relaunchApp` takes
       `{ storage, todayISO }` and returns a PROMISE: the label reached it as
       `args`, so `args.todayISO` was `undefined` and `setJourneyClock` THREW —
       killing the process after 172 cells, so every assertion below this line
       had never run. And un-awaited inside `quiet`, the restart would not have
       happened before the next comparison even with the right argument, which is
       the inert-relaunch shape `test:settings-persistence` M8 was written for.
       Called the way this same file's sections [4] and [8] already call it. */
    await relaunchApp({ storage: localStorageData, todayISO: target });
    /* ⚠ **THE ORDINARY INJURY IS SEARCHED FOR NOW, AND R-124 IS WHY.**
     *
     * It was a fixed `hamstring 8/10`, and the cells below need a world where an
     * injury really does SUBSTITUTE a row — that is the whole subject of
     * *"a substitution carries no withheld mark"*. Only rungs 1-4 may produce a
     * substitution now, and MEASURED across every region at the limiting bands,
     * rungs 1-4 accept ZERO for any LOWER-LIMB injury on a lower-body day: Sam's
     * matrix rates 0 of 9 squats, 0 of 7 lunges and 0 of 8 hinges `good` for any
     * lower limb. **The property is untouched and plenty of worlds still reach
     * it** — upper-limb and midline regions get real per-exercise answers — so
     * the world is found rather than the expectation lowered.
     *
     * Every attempt goes through the REAL door on a REAL generated week and
     * re-installs first, so no attempt inherits the last one's injury. */
    const ORDINARY_CANDIDATES = [
      { region: 'lower_body', area: 'hamstring', severity: 8, severityBand: 'avoid', adjustmentLevel: 'training_paused' },
      { region: 'upper_body', area: 'Shoulder', severity: 7, severityBand: 'moderate', adjustmentLevel: 'moderate' },
      { region: 'back_midline', area: 'Lower back', severity: 7, severityBand: 'moderate', adjustmentLevel: 'moderate' },
      { region: 'upper_body', area: 'Elbow', severity: 7, severityBand: 'moderate', adjustmentLevel: 'moderate' },
      { region: 'upper_body', area: 'Neck', severity: 7, severityBand: 'moderate', adjustmentLevel: 'moderate' },
    ];
    type OrdinaryRow = {
      exercise?: { name?: string };
      unavailableForInjury?: { explanation?: string };
      substitutedFrom?: { baseExerciseName?: string; cause?: string };
    };
    let weekStart2 = await install();
    let ordinaryTarget = '2026-07-20';
    let ordinaryRows: OrdinaryRow[] = [];
    for (const candidate of ORDINARY_CANDIDATES) {
      for (const offset of [0, 1, 2, 3, 4, 5, 6]) {
        weekStart2 = await install();
        const day = addDaysISO(weekStart2, offset);
        setJourneyClock(day);
        await quietAsync(() => executeProgramControlActionDurably({
          type: 'set_injury_modifier',
          source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'tap' },
          scope: 'current_and_future',
          payload: { constraint: buildGuidedInjuryConstraint({
            ...candidate, triggers: ['during'], seriousSymptoms: false,
          } as never, { todayISO: day }) },
          requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
        }, { todayISO: day }));
        const week = quiet(() => buildProgramTabProjectedWeek({
          mondayISO: weekStart2, todayISO: day,
          state: buildScheduleStateImperative(),
          overrideContexts: (useProgramStore.getState() as unknown as {
            overrideContexts?: Record<string, unknown> }).overrideContexts ?? {},
        })) as Array<{ date: string; workout?: Workout | null }>;
        const rows = (week.find((d) => d.date === day)?.workout?.exercises ?? []) as OrdinaryRow[];
        if (rows.some((row) => row.substitutedFrom?.cause === 'injury')) {
          ordinaryTarget = day;
          ordinaryRows = rows;
          break;
        }
        if (ordinaryRows.length === 0) ordinaryRows = rows;
      }
      if (ordinaryRows.some((row) => row.substitutedFrom?.cause === 'injury')) break;
    }
    ok('[11] CONTROL — an ordinary injury really did SUBSTITUTE on this day',
      ordinaryRows.some((r) => r.substitutedFrom?.cause === 'injury'),
      ordinaryRows.map((r) => `${r.exercise?.name}<-${r.substitutedFrom?.baseExerciseName ?? '-'}`));
    ok('[11] an ordinary injury substitution carries NO withheld mark',
      ordinaryRows.every((r) => !(r.substitutedFrom?.cause === 'injury' && r.unavailableForInjury)),
      ordinaryRows.filter((r) => !!r.unavailableForInjury)
        .map((r) => `${r.exercise?.name}: ${r.unavailableForInjury?.explanation}`));
    ok('[11] and no row is ever warned about an exercise that is not itself',
      ordinaryRows.every((r) => !r.unavailableForInjury
        || String(r.unavailableForInjury.explanation ?? '')
          .includes(String(r.exercise?.name ?? ''))),
      ordinaryRows.filter((r) => !!r.unavailableForInjury)
        .map((r) => `${r.exercise?.name}: ${r.unavailableForInjury?.explanation}`));

    /* ── THE SCREEN, AT SOURCE. There is no native renderer in this repo, so
     *    these pin the props that decide what the athlete can touch. ── */
    const screen = fs.readFileSync(
      path.resolve(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx'), 'utf8') as string;
    ok('[11] a withheld row has NO checkbox to press — it is replaced, not disabled',
      /withheld \? \([\s\S]{0,400}?session-execution-withheld-[\s\S]{0,200}?\) : \([\s\S]{0,200}?accessibilityRole="checkbox"/.test(screen),
      'ExecutionChecklistItem must swap the Pressable for a static Skip marker');
    ok('[11] the row renders the DOMAIN\'s sentence and composes none of its own',
      /workout-exercise-injury-withheld-\$\{exerciseToken\}/.test(screen)
        && /\{injuryWithholding\.explanation\}/.test(screen));
    ok('[11] the screen derives NO injury rule — it reads one typed field',
      !/injuryPermitsExerciseAtSeverity|injurySeverityPauses|isRedFlagInjury|injuryWithholdingsOn/.test(screen)
        && /unavailableForInjury/.test(screen));
    const projection = fs.readFileSync(
      path.resolve(__dirname, '..', 'utils', 'visibleProgramProjection.ts'), 'utf8') as string;
    /* COMMENTS STRIPPED FIRST. The projection's own comment NAMES the legality
     * owner to say it is not being called here — a raw grep would read that
     * sentence as the call it forbids, which is a cell failing on its own
     * documentation rather than on the code. */
    const projectionCode = projection
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    ok('[11] CONTROL — stripping comments left the projection\'s real code behind',
      projectionCode.includes('return compileCanonicalDayConstraints({ ...input,')
        && projectionCode.includes('export function projectVisibleDay('),
      projectionCode.length);
    ok('[11] and neither does the projection — one field, no classifier, no import',
      !/injuryPermitsExerciseAtSeverity|injurySeverityPauses|isRedFlagInjury|injuryWithholdingsOn/
        .test(projectionCode)
        && !/from '\.\.\/rules\/injuryWithheldRows'/.test(projectionCode),
      projectionCode.split('\n').filter((l: string) => /injury/i.test(l)).slice(0, 6));
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
