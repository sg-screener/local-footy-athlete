/**
 * THE DELOAD LAW — Sam's authored transformation (2026-07-27).
 *
 *   docs/LFA_PROGRAMMING_BIBLE.md §14 "When to deload" + §19
 *
 * "Same week, same days — the structure doesn't change, the work shrinks."
 *
 *   Main lifts    half the sets; weight same or slightly down; RPE 5-6,
 *                 fast and clean, nowhere near failure.
 *   Accessories   cut to 2-3, or half, whichever is LESS.
 *   Power/speed   keep a small sharp dose — few reps, full recovery.
 *   Conditioning  half the total work; one quality exposure max; rest easy.
 *
 * Two of those supersede shipped behaviour: conditioning was untouched except
 * for a category downgrade, and power was REMOVED outright on deload weeks.
 *
 * This suite pins the TRANSFORMATION. It is deliberately separate from the
 * trigger, because the readiness (rolling 7 days) and illness (while active)
 * doors apply the same transformation and must not invent their own.
 *
 * Run: npm run test:deload-law
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import {
  DELOAD_LAW,
  resolveDeloadWeekPolicy,
  resolveDoorDeloadPolicy,
  applyStrengthDeloadToExercises,
  applyConditioningDeloadToExercises,
  deloadPowerDose,
  isConditioningExerciseRow,
} from '../rules/deloadWeekRules';
import { withSection18WorkoutEvidence } from '../rules/section18WorkoutEvidence';
import { createStrengthIntent } from '../rules/strengthPatternContributions';
import type { Workout, WorkoutExercise } from '../types/domain';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const NOW = new Date('2026-07-27T00:00:00Z').toISOString();
let seq = 0;

function row(
  name: string,
  sets: number,
  over: Partial<WorkoutExercise> = {},
): WorkoutExercise {
  seq += 1;
  return {
    id: `ex-${seq}`,
    workoutId: 'w',
    exerciseId: `e-${seq}`,
    exerciseOrder: seq,
    prescribedSets: sets,
    prescribedRepsMin: 5,
    prescribedRepsMax: 8,
    restSeconds: 90,
    exercise: {
      id: `e-${seq}`, name, description: '', muscleGroups: [],
      exerciseType: 'Compound', equipmentRequired: [],
      difficultyLevel: 'Intermediate', createdAt: NOW, updatedAt: NOW,
    },
    createdAt: NOW, updatedAt: NOW,
    ...over,
  } as WorkoutExercise;
}

const policy = resolveDeloadWeekPolicy('Off-season', 'deload');
if (!policy) throw new Error('deload policy did not resolve for an off-season deload week');

/* ── The authored numbers ── */

console.log('\n[1] THE LAW — Sam\'s authored values, as data');

ok('main lifts halve their sets', DELOAD_LAW.mainLiftSetMultiplier === 0.5,
  `got ${DELOAD_LAW.mainLiftSetMultiplier}`);
ok('every set sits at RPE 5-6',
  DELOAD_LAW.rpeMin === 5 && DELOAD_LAW.rpeMax === 6,
  `got ${DELOAD_LAW.rpeMin}-${DELOAD_LAW.rpeMax}`);
ok('accessories cut to at most 3', DELOAD_LAW.accessoryMaxKept === 3,
  `got ${DELOAD_LAW.accessoryMaxKept}`);
ok('accessories also halve — whichever is LESS',
  DELOAD_LAW.accessoryKeepMultiplier === 0.5);
ok('conditioning halves its total work',
  DELOAD_LAW.conditioningWorkMultiplier === 0.5,
  `got ${DELOAD_LAW.conditioningWorkMultiplier}`);
ok('at most one quality conditioning exposure survives',
  DELOAD_LAW.maxQualityConditioningExposures === 1,
  `got ${DELOAD_LAW.maxQualityConditioningExposures}`);
ok('power is KEPT, not removed', DELOAD_LAW.keepPower === true);

ok('the law is recorded in the Bible',
  fs.readFileSync(path.join(repoRoot, 'docs/LFA_PROGRAMMING_BIBLE.md'), 'utf8')
    .includes('THE DELOAD LAW (Sam, 2026-07-27)'));

/* ── Main lifts ── */

console.log('\n[2] MAIN LIFTS — half the sets, weight held, RPE 5-6');

{
  const before = [row('Back Squat', 4), row('Bench Press', 4)];
  const after = applyStrengthDeloadToExercises(before, policy);
  const squat = after.find((entry) => entry.exercise?.name === 'Back Squat');

  ok('4 sets become 2 — half, not "one fewer"',
    squat?.prescribedSets === 2, `got ${squat?.prescribedSets}`);

  // ── THE CLUB-NIGHT MAIN LIFT IS NOT A ROWING MACHINE ──────────────────────
  // Measured 2026-08-27 (Sam's deload-not-halving order): the conditioning
  // classifier's regex fallback matched `\brow\b` in "Barbell Row" and
  // "Chest-Supported DB Row", so the deload passed the club-night MAIN LIFT
  // through unhalved while halving the pulldowns beside it. A name the
  // registry knows answers from the registry ONLY — the regex is for
  // unregistered names.
  ok('"Barbell Row" is a strength row, not conditioning',
    !isConditioningExerciseRow(row('Barbell Row', 3)));
  const clubNight = applyStrengthDeloadToExercises(
    [row('Barbell Row', 3), row('Lat Pulldown', 3)], policy);
  const barbellRow = clubNight.find((entry) => entry.exercise?.name === 'Barbell Row');
  ok('the club-night main lift halves like every other lift',
    barbellRow?.prescribedSets === 2, `got ${barbellRow?.prescribedSets}`);
  ok('and carries the deload sentence',
    /RPE 5-6/.test(barbellRow?.notes ?? ''), `got "${barbellRow?.notes}"`);
  ok('an UNREGISTERED rowing-machine name still classifies as conditioning',
    isConditioningExerciseRow(row('Row Ergometer Intervals', 3)));

  const odd = applyStrengthDeloadToExercises([row('Back Squat', 3)], policy);
  ok('3 sets round to 2, never below the 1-set floor',
    odd[0].prescribedSets === 2, `got ${odd[0].prescribedSets}`);

  const single = applyStrengthDeloadToExercises([row('Back Squat', 1)], policy);
  ok('a single set stays a set — halving never reaches zero',
    single[0].prescribedSets === 1, `got ${single[0].prescribedSets}`);

  ok('the deload note carries RPE 5-6, not the old 6-7',
    /RPE 5-6/.test(squat?.notes ?? ''), squat?.notes ?? '(none)');
  ok('the note no longer says RPE 6-7', !/RPE 6-7/.test(squat?.notes ?? ''));
}

{
  // "Weight stays the same or drops slightly if you're beat up." The default is
  // HOLD; the drop is conditional, so an unconditional multiplier is wrong.
  const before = [row('Back Squat', 4, { prescribedWeightKg: 100 })];
  const held = applyStrengthDeloadToExercises(before, policy);
  ok('weight is HELD by default on a deload',
    held[0].prescribedWeightKg === 100, `got ${held[0].prescribedWeightKg}`);

  const beatUp = applyStrengthDeloadToExercises(before, { ...policy, athleteIsBeatUp: true });
  const dropped = beatUp[0].prescribedWeightKg ?? 0;
  ok('weight drops only SLIGHTLY when the athlete is beat up',
    dropped < 100 && dropped >= 85, `got ${dropped}`);
}

/* ── Accessories ── */

console.log('\n[3] ACCESSORIES — 2-3, or half, whichever is less');

{
  // 8 accessories: half is 4, the cap is 3 -> 3 wins (whichever is LESS).
  const many = [
    row('Back Squat', 4),
    ...['Bicep Curl', 'Tricep Pushdown', 'Face Pull', 'Lateral Raise',
        'Leg Extension', 'Calf Raises', 'Hammer Curl', 'Rear Delt Fly']
      .map((name) => row(name, 3)),
  ];
  const after = applyStrengthDeloadToExercises(many, policy);
  const accessoriesKept = after.filter(
    (entry) => entry.exercise?.name !== 'Back Squat' && !isConditioningExerciseRow(entry),
  ).length;
  ok('8 accessories cut to 3 — the cap beats the half', accessoriesKept === 3,
    `kept ${accessoriesKept}`);
}

{
  // 4 accessories: half is 2, the cap is 3 -> 2 wins (whichever is LESS).
  const few = [
    row('Back Squat', 4),
    ...['Bicep Curl', 'Tricep Pushdown', 'Face Pull', 'Lateral Raise']
      .map((name) => row(name, 3)),
  ];
  const after = applyStrengthDeloadToExercises(few, policy);
  const accessoriesKept = after.filter(
    (entry) => entry.exercise?.name !== 'Back Squat' && !isConditioningExerciseRow(entry),
  ).length;
  ok('4 accessories cut to 2 — the half beats the cap', accessoriesKept === 2,
    `kept ${accessoriesKept}`);
}

{
  const one = [row('Back Squat', 4), row('Bicep Curl', 3)];
  const after = applyStrengthDeloadToExercises(one, policy);
  ok('a main lift is never removed as an accessory',
    after.some((entry) => entry.exercise?.name === 'Back Squat'));
}

/* ── Conditioning ── */

console.log('\n[4] CONDITIONING — half the work, one quality exposure max (NEW LAW)');

{
  const conditioning = [
    row('4x4 VO2', 4, { prescribedDurationMinutes: 40 } as Partial<WorkoutExercise>),
    row('Tempo Run', 1, { prescribedDurationMinutes: 30 } as Partial<WorkoutExercise>),
  ];
  const after = applyConditioningDeloadToExercises(conditioning, policy);
  const total = after.reduce(
    (sum, entry) => sum + ((entry as { prescribedDurationMinutes?: number }).prescribedDurationMinutes ?? 0),
    0,
  );
  ok('total conditioning work halves (was untouched before this law)',
    total === 35, `got ${total} of an original 70`);
}

{
  const threeQuality = [
    row('4x4 VO2', 4), row('MAS 15:15 Blocks', 4), row('Sprint Intervals', 4),
  ];
  const after = applyConditioningDeloadToExercises(threeQuality, policy);
  const qualityLeft = after.filter(
    (entry) => (entry as { deloadQualityExposure?: boolean }).deloadQualityExposure,
  ).length;
  ok('at most ONE quality exposure survives', qualityLeft <= 1, `got ${qualityLeft}`);
  ok('the others become easy aerobic rather than disappearing',
    after.length === threeQuality.length, `${after.length} of ${threeQuality.length} rows`);
}

/* ── Power ── */

console.log('\n[5] POWER — kept as a small sharp dose, not removed');

{
  const full = { sets: 4, repsMin: 3, repsMax: 5 };
  const dose = deloadPowerDose(full);
  ok('power survives a deload', dose !== null);
  ok('the dose is SMALLER than the full one', (dose?.sets ?? 99) < full.sets,
    `${dose?.sets} vs ${full.sets}`);
  ok('power keeps at least one working set', (dose?.sets ?? 0) >= 1);
  ok('reps stay few — the dose stays sharp', (dose?.repsMax ?? 99) <= full.repsMax);
}

/* ── Trigger is separate from transformation ── */

console.log('\n[6] SEPARATION — the law is the transformation, not the trigger');

ok('a scheduled deload resolves in off-season',
  resolveDeloadWeekPolicy('Off-season', 'deload') !== null);
ok('a scheduled deload resolves in pre-season',
  resolveDeloadWeekPolicy('Pre-season', 'deload') !== null);
ok('no SCHEDULED deload in-season (D16 — games and byes self-regulate)',
  resolveDeloadWeekPolicy('In-season', 'deload') === null);
ok('a normal week resolves no deload',
  resolveDeloadWeekPolicy('Off-season', 'build') === null);

// The readiness and illness doors deload IN-SEASON too, so the transformation
// must be reachable without the scheduled-week trigger. If this ever fails, those
// units would be forced to reimplement the law — the exact duplication Sam's
// "no door invents its own reductions" forbids.
ok('the law is exported independently of any trigger',
  typeof DELOAD_LAW === 'object' && DELOAD_LAW !== null);

/* ── The doors ── */

// "The same transformation is applied by EVERY door that deloads: a scheduled
// deload week, a low-readiness call (rolling 7 days), and an active moderate-or-
// severe illness. No door invents its own reductions."
//
// The doors do NOT share a phase rule, and that asymmetry is authored. D16: "no
// scheduled in-season deloads; games and byes self-regulate; backing off happens
// through readiness/bye recovery only." So the SCHEDULED door is phase-gated,
// and the readiness/illness doors are precisely the in-season way to back off —
// gating them by phase would leave in-season with no way to deload at all.
//
// Both directions are asserted here. A gate that is merely absent is trusted;
// a gate that is tested is enforced.
console.log('\n[5] THE DOORS — one transformation, and only ONE phase gate');

for (const phase of ['Off-season', 'Pre-season'] as const) {
  ok(`the SCHEDULED door opens in ${phase}`,
    resolveDeloadWeekPolicy(phase, 'deload') !== null);
}

// D16, enforced rather than assumed.
ok('the SCHEDULED door is CLOSED in-season (D16: no scheduled in-season deloads)',
  resolveDeloadWeekPolicy('In-season', 'deload') === null);

for (const door of ['readiness', 'illness'] as const) {
  for (const phase of ['Off-season', 'Pre-season', 'In-season'] as const) {
    const policy = resolveDoorDeloadPolicy({ door, seasonPhase: phase });
    ok(`the ${door} door deloads in ${phase}`, policy !== null);
    ok(`the ${door} door in ${phase} carries the law's transformation, not its own`,
      policy?.weekKind === 'deload');
  }
}

// Sam's default: "Weight stays the same, or drops slightly if the athlete is
// beat up." In-season resolves to 1.0, so the weight is held — the halved sets
// and RPE 5-6 are the whole change.
ok('an in-season door deload HOLDS the weight',
  resolveDoorDeloadPolicy({ door: 'illness', seasonPhase: 'In-season' })
    ?.intensityMultiplier === 1.0,
  String(resolveDoorDeloadPolicy({ door: 'illness', seasonPhase: 'In-season' })
    ?.intensityMultiplier));

/* ── Structure survives the dose ── */

// "Same week, same days — the structure doesn't change, the work shrinks."
//
// Section 18 counts a week's main-strength EXPOSURES, and a row's main-lift
// role is INFERRED from its prescribed dose and its position in the session.
// So the deload transform — which halves main-lift sets and trims accessories
// out from in front of them — can move a lift across that inference boundary
// and delete an exposure the planner selected. That is a count reduction by
// side effect: it never appears as an authorised reduction, so every layer
// that audits reductions reports the week as untouched while §18 sees one
// fewer strength session and rejects the week.
//
// This is the sibling of the readiness law's rule ("readiness never REMOVES
// sessions") on the EVIDENCE side, and it binds every deload door, not just
// readiness — the scheduled deload week reaches the same transform.
//
// Only a MODERATE-load main pattern can be demoted this way. A high-load lift
// (Back Squat, Overhead Press) qualifies on its registry tag alone and is
// dose-independent, which is why this went unseen: the hinge slot is the one
// that carries it.
console.log('\n[7] STRUCTURE HOLDS — a deloaded dose cannot demote a main lift');

const hingeSession = (rows: WorkoutExercise[]): Workout => ({
  id: 'w', microcycleId: 'm', dayOfWeek: 6, name: 'Lower Hinge', description: '',
  durationMinutes: 50, intensity: 'Moderate', workoutType: 'Strength',
  sessionTier: 'core',
  strengthIntent: createStrengthIntent({ archetype: 'lower', plannedPatterns: ['hinge'] }),
  exercises: rows,
  createdAt: NOW, updatedAt: NOW,
} as unknown as Workout);

const mainLiftCount = (workout: Workout): number =>
  (workout.exercises ?? []).filter((entry) =>
    entry.section18Evidence?.role === 'main_strength').length;

const describeRows = (workout: Workout): string =>
  (workout.exercises ?? []).map((entry) =>
    `${entry.exercise?.name}|${entry.section18Evidence?.role}|${entry.prescribedSets}x`).join(' , ');

{
  // Four accessories ahead of the planned hinge lift. The deload keeps two of
  // them ("2-3, or half, whichever is less"), which leaves the main lift at
  // index 2 — past the position clause — at the halved dose of 2 sets, past
  // the set clause. Both of the inference's escape hatches close at once, and
  // the exposure disappears.
  const rows = [
    row('Bicep Curls', 2),
    row('Tricep Pushdowns', 2),
    row('Face Pulls', 2),
    row('Lateral Raises', 2),
    row('RDLs', 3),
  ];

  const full = withSection18WorkoutEvidence(hingeSession(rows), 'infer');
  ok('the planned hinge lift IS a main-strength exposure at full dose',
    mainLiftCount(full) === 1, describeRows(full));

  const deloaded = withSection18WorkoutEvidence(
    hingeSession(applyStrengthDeloadToExercises(rows, policy)), 'infer');

  ok('it is STILL a main-strength exposure after the deload',
    mainLiftCount(deloaded) === 1, describeRows(deloaded));
}

{
  // The same lift under the name the generator actually writes. The deload's
  // own main-lift test reads the raw name against the pool registry, while the
  // §18 evidence classifier resolves the alias first — so one owner calls this
  // row an anchor and the other calls it an accessory, and the accessory trim
  // deletes the session's planned main lift outright.
  //
  // Two classifiers over one row is the defect; the alias is only what exposes
  // it. Any generated name that is not itself a pool key does the same.
  const rows = [
    row('Bicep Curls', 2),
    row('Tricep Pushdowns', 2),
    row('Face Pulls', 2),
    row('Lateral Raises', 2),
    row('Romanian Deadlift', 3),
  ];
  const deloaded = applyStrengthDeloadToExercises(rows, policy);

  ok('the deload never TRIMS a planned main lift as if it were an accessory',
    deloaded.some((entry) => entry.exercise?.name === 'Romanian Deadlift'),
    deloaded.map((entry) => `${entry.exercise?.name}|${entry.prescribedSets}x`).join(' , '));

  ok('and the alias-named lift is still counted as a main-strength exposure',
    mainLiftCount(withSection18WorkoutEvidence(hingeSession(deloaded), 'infer')) === 1,
    describeRows(withSection18WorkoutEvidence(hingeSession(deloaded), 'infer')));
}

/* ── §12: what an athlete-CHOSEN deloaded day says (Sam, signed 2026-08-05) ──
 *
 * docs/METCON_RESIGN_AND_SIGNOFFS_2026-08-05.md §2, option (b):
 *
 *   > Easy day: keep RPE 5-6; every rep fast and clean.
 *
 * Day-scoped, selected by the TYPED CAUSE per the copy law, with "Deload:"
 * RESERVED for scheduled deload weeks. Device finding 6b: adding a session onto
 * G-1 and answering "Deloaded" stamped week-deload words onto a standard week.
 * The dose was the athlete's own choice and correct; the words described a week
 * they were not in.
 */
{
  const scheduled = resolveDeloadWeekPolicy('Off-season', 'deload')!;
  const chosen = resolveDoorDeloadPolicy({ door: 'readiness', seasonPhase: 'In-season' })!;
  const strengthRows = () => [row('Back Squat', 4), row('Bicep Curls', 3)];
  const notesOf = (rows: WorkoutExercise[]) =>
    rows.map((entry) => entry.notes ?? '').join(' ');

  const scheduledNotes = notesOf(applyStrengthDeloadToExercises(strengthRows(), scheduled));
  const chosenNotes = notesOf(applyStrengthDeloadToExercises(strengthRows(), chosen));

  ok('a SCHEDULED deload week still says "Deload:" — the week really is one',
    /Deload: keep RPE 5-6; every rep fast and clean, nowhere near failure\./.test(scheduledNotes),
    scheduledNotes);

  ok('an athlete-CHOSEN easy day says Sam\'s signed day-scoped sentence',
    chosenNotes.includes('Easy day: keep RPE 5-6; every rep fast and clean.'),
    chosenNotes);

  ok('and it never says "Deload:" — that word is reserved for scheduled weeks',
    !/Deload:/i.test(chosenNotes),
    chosenNotes);

  const conditioningRows = () => [
    row('Easy Aerobic Bike', 1, { prescribedDurationMinutes: 40 } as never),
    row('VO2 Intervals', 1, { prescribedDurationMinutes: 20 } as never),
  ];
  const chosenConditioning = notesOf(
    applyConditioningDeloadToExercises(conditioningRows(), chosen));
  ok('the conditioning rows of a chosen easy day carry no week-deload words either',
    !/Deload:/i.test(chosenConditioning),
    chosenConditioning);

  // THE REPEAT GUARD, recorded alongside §12 and paid in the same unit. The
  // guard matched "Deload week:" while the appended sentence began "Deload: ",
  // so it never recognised its own output and a second application appended a
  // duplicate. Notes persist, so a re-derived day could wear the sentence twice.
  const once = applyStrengthDeloadToExercises(strengthRows(), scheduled);
  const twice = applyStrengthDeloadToExercises(once, scheduled);
  const occurrences = (text: string, needle: string) => text.split(needle).length - 1;
  ok('applying the scheduled deload twice does not duplicate its sentence',
    occurrences(notesOf(twice), 'Deload: keep RPE 5-6') === 1,
    notesOf(twice));

  const chosenOnce = applyStrengthDeloadToExercises(strengthRows(), chosen);
  const chosenTwice = applyStrengthDeloadToExercises(chosenOnce, chosen);
  ok('applying the chosen easy day twice does not duplicate its sentence',
    occurrences(notesOf(chosenTwice), 'Easy day: keep RPE 5-6') === 1,
    notesOf(chosenTwice));

  // The typed cause is CARRIED, not inferred downstream from the words. A
  // consumer that had to read the sentence to learn which door opened would be
  // a second representation of the same fact.
  ok('the policy carries the door that minted it',
    scheduled.door === 'scheduled' && chosen.door === 'readiness',
    `scheduled=${(scheduled as { door?: string }).door} chosen=${(chosen as { door?: string }).door}`);

  /* ── §13: the conditioning half, EQUALITY-BOUND TO THE SIGNED RECORD ──
   *
   * Sam signed the conditioning easy-day sentence on 2026-08-05
   * (docs/EASY_DAY_CONDITIONING_COPY_2026-08-05.md), closing the §13 this unit
   * parked: the chosen route shipped conditioning rows with the halved dose and
   * NO sentence, because writing athlete-facing words is his alone.
   *
   * Bound the same way the shortfall sentence is (`test:shortfall-copy`, Sam's
   * regime of 2026-07-29): the DOC is the authority, read at test time rather
   * than transcribed, and equality runs BOTH directions. One direction alone is
   * worthless — "the code contains what he signed" still permits the code to
   * emit three other sentences he never saw.
   */
  const signedSentence = (docFile: string, startsWith: string): string => {
    const text = fs.readFileSync(path.join(repoRoot, 'docs', docFile), 'utf8');
    // Blockquoted, and it may wrap across lines: join the quote's lines back up.
    const quoted = text
      .split('\n')
      .filter((line) => line.startsWith('>'))
      .map((line) => line.replace(/^>\s?/, '').trim())
      .join('\n');
    const found = quoted
      .split(/\n(?=[A-Z])/)
      .map((block) => block.replace(/\s+/g, ' ').trim())
      .find((block) => block.startsWith(startsWith));
    if (!found) {
      throw new Error(`no signed sentence starting "${startsWith}" in docs/${docFile}`);
    }
    return found;
  };

  const SIGNED_CONDITIONING = signedSentence(
    'EASY_DAY_CONDITIONING_COPY_2026-08-05.md', 'Easy day:');
  const SIGNED_STRENGTH = signedSentence(
    'METCON_RESIGN_AND_SIGNOFFS_2026-08-05.md', 'Easy day:');

  const chosenConditioningNotes = notesOf(
    applyConditioningDeloadToExercises(conditioningRows(), chosen));

  ok('the chosen easy day says Sam\'s SIGNED conditioning sentence, verbatim',
    chosenConditioningNotes.includes(SIGNED_CONDITIONING),
    `signed: "${SIGNED_CONDITIONING}"\n      emitted: "${chosenConditioningNotes}"`);

  // Every row of the chosen route carries it — the quality row and the easy
  // one. Sam signed ONE conditioning sentence for this route, so a second
  // wording for the quality exposure would be copy nobody authored.
  const chosenConditioningRows = applyConditioningDeloadToExercises(
    conditioningRows(), chosen);
  ok('every conditioning row of a chosen easy day carries that one sentence',
    chosenConditioningRows.every((entry) => (entry.notes ?? '').includes(SIGNED_CONDITIONING)),
    chosenConditioningRows.map((entry) => `"${entry.notes ?? ''}"`).join(' | '));

  // THE OTHER DIRECTION. Every sentence the chosen route can put in front of an
  // athlete must be carried, verbatim, by a signed record. A sentence the docs
  // do not show is copy that shipped without a signature.
  const chosenEmitted = [
    ...applyStrengthDeloadToExercises(strengthRows(), chosen),
    ...chosenConditioningRows,
  ].flatMap((entry) => (entry.notes ?? '').split(/(?<=\.)\s+(?=Easy day:|Deload:)/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  const SIGNED = [SIGNED_STRENGTH, SIGNED_CONDITIONING];
  ok('the chosen route emits NOTHING that is not in a signed record',
    chosenEmitted.every((sentence) => SIGNED.includes(sentence)),
    `emitted: ${JSON.stringify(chosenEmitted)}\n      signed: ${JSON.stringify(SIGNED)}`);

  ok('and the signed conditioning sentence never appears on a SCHEDULED week',
    !notesOf(applyConditioningDeloadToExercises(conditioningRows(), scheduled))
      .includes(SIGNED_CONDITIONING),
    notesOf(applyConditioningDeloadToExercises(conditioningRows(), scheduled)));

  const condOnce = applyConditioningDeloadToExercises(conditioningRows(), chosen);
  const condTwice = applyConditioningDeloadToExercises(condOnce, chosen);
  ok('applying the chosen conditioning easy day twice does not duplicate it',
    condTwice.every((entry) =>
      occurrences(entry.notes ?? '', 'Easy day: smooth and controlled') === 1),
    condTwice.map((entry) => `"${entry.notes ?? ''}"`).join(' | '));

  // A NOTE IS OUTPUT, NEVER EVIDENCE.
  //
  // Found by wiring Sam's sentence: it contains the word "hard" ("stop well
  // short of hard"), and `isQualityConditioningRow` regex-matches intensity
  // words in `name + notes`. So one pass wrote the sentence and the NEXT pass
  // read it back and reclassified an easy aerobic row as the week's quality
  // exposure — halving its duration a second time. The classifier was reading
  // the applier's own writing.
  //
  // The claim is about CLASSIFICATION, not the dose. Halving a duration twice
  // halves it twice — that is arithmetic, and callers own not re-applying. What
  // must never move is WHICH ROW the law calls the quality exposure, because
  // that is a reading of the athlete's session and not of our own prose.
  for (const [label, appliedPolicy] of [
    ['chosen', chosen] as const,
    ['scheduled', scheduled] as const,
  ]) {
    const first = applyConditioningDeloadToExercises(conditioningRows(), appliedPolicy);
    const second = applyConditioningDeloadToExercises(first, appliedPolicy);
    const quality = (rows: WorkoutExercise[]) => JSON.stringify(rows.map((entry) => [
      entry.exercise?.name,
      (entry as { deloadQualityExposure?: boolean }).deloadQualityExposure,
    ]));
    ok(`the ${label} deload's own note never reclassifies the row that wears it`,
      quality(second) === quality(first),
      `first:  ${quality(first)}\n      second: ${quality(second)}`);
  }
}

/* ── Result ── */

console.log(
  `\nDeload law: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
