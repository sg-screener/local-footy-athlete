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
import { quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';
import { buildSessionInjuryReview, type SessionInjuryReview } from '../utils/sessionInjuryReview';
import { buildGuidedInjuryConstraint, type GuidedInjuryFlowResult } from '../utils/guidedInjuryControl';
import { resolveInjuryRecompositionInputs } from '../utils/programControlActions';
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
    firstName: 'Sim', heightCm: 184, weightKg: 90, seasonPhase: 'Off-season',
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

function install(): string {
  localStorageData.clear();
  resetStoresToFreshInstall('session-injury-review:install');
  const profile = theAthlete();
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  setJourneyClock(INSTALL_DAY);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: INSTALL_DAY, previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'Off-season' as never,
      phaseEntryWeekStartISO: mondayFor(INSTALL_DAY),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const settled = program.microcycles[1] ?? program.microcycles[0]!;
  const weekStart = String(settled.startDate).slice(0, 10);
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {}, selectedDate: weekStart,
    reason: 'session-injury-review:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
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

/** The athlete's answer, turned into the constraint the door will store. */
function constraintFor(area: string, severity: number, todayISO: string, seriousSymptoms = false) {
  const result: GuidedInjuryFlowResult = {
    region: 'other', area, severity,
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
  const weekStart = install();
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
  const review = quiet(() => buildSessionInjuryReview({ date: target, constraint })) as SessionInjuryReview;

  /* ══ [2] ASKED ONCE, EVERY AFFECTED ROW FOUND ══════════════════════════ */
  console.log('\n[2] one question, every affected row');
  {
    const { workout, environment } = quiet(() =>
      resolveInjuryRecompositionInputs({ date: target, constraint })) as ReturnType<
        typeof resolveInjuryRecompositionInputs>;
    const unsafe = quiet(() => unsafeRowsForInjury({ workout, environment })) as string[];
    const reviewed = review.changes.map((change) => change.from);
    ok('[2] the review covers EVERY row the injury makes unsafe',
      unsafe.every((name) => reviewed.includes(name)),
      { unsafe, reviewed });
    ok('[2] and invents none — every reviewed row really is unsafe',
      reviewed.every((name) => unsafe.includes(name)),
      { unsafe, reviewed });
    ok('[2] the athlete was asked ONCE — one area, one severity, one review',
      review.bodyPart.length > 0 && review.severity === SEVERITY
        && review.changes.length === unsafe.length,
      { bodyPart: review.bodyPart, severity: review.severity, changes: review.changes.length });
    ok('[2] CONTROL — the untouched rows are the rest of the session, not an empty list',
      review.untouched.length > 0
        && review.untouched.every((name) => !unsafe.includes(name)),
      { untouched: review.untouched });
  }

  /* ══ [3] THE APPROVED LADDER, AND NOTHING ELSE ═════════════════════════ */
  console.log('\n[3] the approved safety ladder');
  {
    const APPROVED_TIERS = [
      'same_movement_pattern', 'similar_muscle_group',
      'unaffected_body_area', 'recovery_easy_conditioning',
    ];
    const subs = review.changes.filter((change) => change.kind === 'substitution');
    ok('[3] CONTROL — the ladder actually answered something',
      subs.length > 0, review.changes);
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
    ok('[3] a withheld row is typed WITHHELD — there is no removal kind at all',
      review.changes.every((change) =>
        (change.kind === 'withheld') === (change.to === null)),
      review.changes.map((c) => [c.from, c.to, c.kind]));
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

    /* ⚠ **A WITHHELD ROW STAYS ON THE SESSION.** R-115: it is marked, not
     * deleted. If it vanished, the review would have been a removal wearing
     * another word. */
    const withheld = review.changes.filter((change) => change.kind === 'withheld');
    ok('[4] a withheld row is still ON the session — marked, never deleted',
      withheld.every((change) => afterRows.includes(change.from)),
      { withheld: withheld.map((c) => c.from), afterRows });

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
    const weekStart2 = install();
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
    const weekStart3 = install();
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
        const withheld = r.changes.filter((change) => change.kind === 'withheld');
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
      ok('[8] EVERY affected row is reported as WITHHELD, never as a substitution',
        flagReview.changes.length > 0
          && flagReview.changes.every((change) => change.kind === 'withheld' && change.to === null),
        flagReview.changes.map((c) => [c.from, c.kind, c.to]));
      ok('[8] each withheld row carries the SAME words the session will show it under',
        flagReview.changes.every((change) =>
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

  /* ══ [9] THE PAIRING, AND THE ONE PLACE THE ROW AND THE REVIEW USE
   *      DIFFERENT NAMES FOR THE SAME THING ═════════════════════════════════
   *
   * A review is only a promise if it promises the RIGHT PAIRS, not just the
   * right set. `[6]` asserts membership — every promised replacement arrives,
   * every replaced row leaves — which a shuffled mapping would satisfy. This
   * asserts `from -> to`, pair for pair, against what the session records.
   *
   * ⚠ **AND IT IS EXACT ONLY UNTIL A ROW IS SUBSTITUTED TWICE.** MEASURED, with
   * two injuries applied in sequence to one session:
   *
   *   after a knee injury   the session records `Leg Press -> Chest-Supported DB Row`
   *   then a shoulder one   the review says   `Chest-Supported DB Row -> Easy Bike`
   *                         the session says  `Leg Press -> Easy Bike`
   *
   * **BOTH ARE TRUE AND NEITHER IS THIS UNIT'S DOING.** `substitutedFrom`
   * preserves the HEAD of the substitution chain — the exercise the athlete
   * originally lost — which is pre-existing behaviour on `main` and is the more
   * useful fact for the athlete ("what happened to my Leg Press?"). The review
   * names the row that is on the session in front of them, which is the only
   * name they can act on. **They disagree only on a row that has already been
   * substituted once, and the disagreement is a NAMING one, never a pairing
   * one** — the same physical row is meant in both.
   *
   * ⚠ **THIS IS A QUESTION FOR SAM, NOT A DEFECT THIS SEAT SHOULD DECIDE.**
   * Making them agree means either the review naming the chain head (and so
   * naming a row the athlete cannot see) or the caption naming the intermediate
   * (and so losing what was originally displaced). It is pinned here so it
   * cannot drift silently while it is undecided.
   */
  console.log('\n[9] the pairing is exact, and where the two names diverge');
  {
    const weekStart4 = install();
    const days4 = trainingDays(weekStart4);
    const pairDay = days4.find((d) => rowsOf(d, weekStart4).length >= 4)!;
    setJourneyClock(pairDay);

    const injuryPairsOn = (): string[] => {
      const week = quiet(() => resolveWeekWithConditioning(weekStart4, buildScheduleStateImperative()));
      const d = week.find((x: { date: string }) => x.date === pairDay) as { workout?: Workout } | undefined;
      return ((d?.workout?.exercises ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          const sub = row.substitutedFrom as { baseExerciseName?: string; cause?: string } | undefined;
          const name = (row.exercise as { name?: string } | undefined)?.name
            ?? (row as { name?: string }).name;
          return sub?.cause === 'injury' ? `${sub.baseExerciseName} -> ${name}` : null;
        })
        .filter((entry): entry is string => entry !== null);
    };

    const firstConstraint = constraintFor('Knee', 7, pairDay);
    const firstReview = quiet(() =>
      buildSessionInjuryReview({ date: pairDay, constraint: firstConstraint })) as SessionInjuryReview;
    const firstPromised = firstReview.changes
      .filter((change) => change.kind === 'substitution')
      .map((change) => `${change.from} -> ${change.to}`).sort();
    ok('[9] CONTROL — the first injury really does propose substitutions',
      firstPromised.length >= 2, firstPromised);

    await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { constraint: firstConstraint },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: pairDay }));

    ok('[9] on a fresh session the review\'s pairing is EXACT, pair for pair',
      JSON.stringify(injuryPairsOn().sort()) === JSON.stringify(firstPromised),
      { promised: firstPromised, landed: injuryPairsOn().sort() });

    /* THE SECOND INJURY — every row it touches has already been substituted. */
    const secondConstraint = constraintFor('Shoulder', 7, pairDay);
    const secondReview = quiet(() =>
      buildSessionInjuryReview({ date: pairDay, constraint: secondConstraint })) as SessionInjuryReview;
    const visibleRows = rowsOf(pairDay, weekStart4);
    ok('[9] the review names rows that are ON THE SESSION the athlete can see',
      secondReview.changes.every((change) => visibleRows.includes(change.from)),
      { named: secondReview.changes.map((c) => c.from), visibleRows });

    const chainHeads = injuryPairsOn().map((pair) => pair.split(' -> ')[0]!);
    ok('[9] MEASURED — and the session\'s captions name the CHAIN HEAD instead, '
      + 'which is why the two disagree on an already-substituted row',
      secondReview.changes.some((change) => !chainHeads.includes(change.from))
        && chainHeads.some((head) => !visibleRows.includes(head)),
      { reviewNames: secondReview.changes.map((c) => c.from), chainHeads, visibleRows });
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
