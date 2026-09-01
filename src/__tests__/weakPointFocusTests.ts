/**
 * READING A, BOUND TO `:105` — the stated weakness changes what FILLS the week.
 *
 * SAM'S RULINGS, 2026-07-30 (`docs/WEAK_POINT_SHEET_2026-07-30.md`):
 *
 *   1. READING A — DEFINITELY NOT B. "A stated weakness changes WHAT FILLS the week —
 *      exercise and template selection — never counts, never distributions. The phase
 *      tables alone own structure. The existing testingBias mechanism is the vehicle:
 *      bind it to the §1 mapping table and gate its direction against :105 in the same
 *      commit, so A cannot drift from the line it implements."
 *   2. Power-vs-speed DEFERRED, pending a search of the authored record.
 *   3. YES — a mobility/injury-history weakness leans the OPTIONAL top-ups.
 *   4. GATE the no-weakness default order as law.
 *   5. MOOT under A — no region inference, no extra question.
 *
 * WHY A GATE AND NOT A COMMENT. `rules/testingBias.ts` already read the weakness before
 * any of this was ruled, and its originating commit is `3d13477 "Add deterministic
 * testing bias"` — a subject line, no body, no ruling cited. By this repo's own
 * provenance standard the direction table was UNAUTHORED, and it showed: two of the
 * seven answers leaned nothing at all. A mechanism that plausibly implements a Bible
 * line, with nothing binding it to that line, is the shape `:116` cost us — an
 * unenforced Bible line rots, and so does an unbound implementation of one.
 *
 * DEPTH (L13): 0-1 — pure mapping and pure bias for §1-§3; §4 reads the authored phase
 * tables. Nothing accumulates.
 *
 * Run: npm run test:weak-point-focus
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import type { BiggestLimitation } from '../types/domain';
import {
  WEAK_POINT_ACCESSORY_REGION_THRESHOLD,
  WEAK_POINT_FOCUS_BY_ANSWER,
  WEAK_POINT_LEAN,
  weakPointFocusFor,
  weakPointLeansOptionalTopUps,
  weakPointNudgesPower,
  weakPointPrefersAcceleration,
  type WeakPointFocus,
} from '../rules/weakPointFocus';
import { selectLateOffseasonSpeedTemplate } from '../rules/speedTemplates';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { computeTestingBias } from '../rules/testingBias';
import {
  ACCESSORY_REGION_THRESHOLD,
  computeOptionalTopUps,
} from '../rules/optionalTopUp';
import { resolveSection18PhasePlannerSelection } from '../rules/weeklyExposureContractV2';
import type { Workout } from '../types/domain';

const repoRoot = path.resolve(__dirname, '../..');
let passed = 0; const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail !== undefined ? `\n      ${
    typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

const ANSWERS: BiggestLimitation[] = ['Strength', 'Speed', 'Endurance', 'Size',
  'Injury history', 'Mobility', 'Power & explosiveness'];

console.log('\n[1] Every answer maps to a category `:105` actually names');
{
  ok('the map covers all seven onboarding answers',
    ANSWERS.every((answer) => WEAK_POINT_FOCUS_BY_ANSWER[answer] !== undefined),
    ANSWERS.filter((a) => WEAK_POINT_FOCUS_BY_ANSWER[a] === undefined));

  // THE FOUR CATEGORIES ARE QUOTED FROM THE LINE, not invented here: "may be mobility
  // and injury prevention, or strength and size, or conditioning, or speed."
  const bible = fs.readFileSync(
    path.join(repoRoot, 'docs/LFA_PROGRAMMING_BIBLE.md'), 'utf8');
  const line105 = 'may be mobility and injury prevention, or strength and size, or '
    + 'conditioning, or speed';
  ok('`:105` still says the four categories this map is built on',
    bible.includes(line105),
    'the Bible line moved or was reworded — the mapping cites text that is no longer there');

  const allowed: WeakPointFocus[] = ['mobility_and_injury_prevention', 'strength_and_size',
    'conditioning', 'speed', 'power_and_acceleration', 'unresolved'];
  for (const answer of ANSWERS) {
    ok(`"${answer}" maps to a declared focus`,
      allowed.includes(WEAK_POINT_FOCUS_BY_ANSWER[answer]),
      WEAK_POINT_FOCUS_BY_ANSWER[answer]);
  }

  // SIZE IS HALF OF `:105`'s OWN CATEGORY, and it used to lean nothing — it fell through
  // the bias's switch to `default: break`. That silence was a gap, not a decision.
  ok('Size leans with Strength, as `:105` groups them',
    WEAK_POINT_FOCUS_BY_ANSWER.Size === 'strength_and_size' &&
    WEAK_POINT_FOCUS_BY_ANSWER.Strength === 'strength_and_size');

  // POWER IS ITS OWN CATEGORY, RULED (Sam, 2026-07-30) — never grouped with speed. The
  // first draft had it `unresolved` pending a search of the authored record; the search
  // found nothing, the question went back, and this is the answer.
  ok('Power & explosiveness is its own fifth category',
    WEAK_POINT_FOCUS_BY_ANSWER['Power & explosiveness'] === 'power_and_acceleration');
  ok('and it is NOT the speed category',
    WEAK_POINT_FOCUS_BY_ANSWER['Power & explosiveness'] !== WEAK_POINT_FOCUS_BY_ANSWER.Speed);

  // THE SEPARATION, ASSERTED AS A PROPERTY rather than as two rows read side by side:
  // neither category may set the other's flag, so no consumer can collapse them back.
  ok('speed leans speed and NOT power/acceleration',
    WEAK_POINT_LEAN.speed.speed && !WEAK_POINT_LEAN.speed.power &&
    !WEAK_POINT_LEAN.speed.acceleration);
  ok('power leans power AND acceleration, and NOT speed',
    WEAK_POINT_LEAN.power_and_acceleration.power &&
    WEAK_POINT_LEAN.power_and_acceleration.acceleration &&
    !WEAK_POINT_LEAN.power_and_acceleration.speed);

  ok('nothing leans on an unresolved answer — the value is kept for the next one',
    Object.values(WEAK_POINT_LEAN.unresolved).every((value) => value === false));
}

console.log('\n[2] THE BINDING — the bias leans the way `:105` says, for every answer');
{
  // This is the "cannot drift" half of Sam's instruction. The bias's magnitudes stay
  // where they were; what is asserted is DIRECTION, per answer, against the mapping.
  for (const answer of ANSWERS) {
    const focus = weakPointFocusFor(answer)!;
    const lean = WEAK_POINT_LEAN[focus];
    // Off-season, no other signal: the phase scale is 1.0 there, so the weakness is the
    // only thing moving the numbers and a zero means "this answer leaned nothing".
    const bias = computeTestingBias({ phase: 'Off-season', biggestLimitation: answer });
    const aerobic = bias.conditioningCategoryPreference.aerobic_base ?? 0;
    const speed = bias.speedBias;
    const recovery = Object.keys(bias.recoveryAddonFocusPreference).length > 0;

    ok(`"${answer}" leans aerobic exactly when :105 says conditioning`,
      (aerobic > 0) === lean.aerobic, { answer, aerobic, expected: lean.aerobic });
    ok(`"${answer}" leans speed exactly when :105 says speed`,
      (speed > 0) === lean.speed, { answer, speed, expected: lean.speed });
    ok(`"${answer}" leans recovery/prehab exactly when :105 says mobility and injury prevention`,
      recovery === lean.recovery, { answer, recovery, expected: lean.recovery });
  }

  // AND READING A's BOUNDARY: the bias may not move a COUNT. Sam: "never counts, never
  // distributions. The phase tables alone own structure."
  const biasKeys = Object.keys(computeTestingBias({ phase: 'Off-season', biggestLimitation: 'Speed' }));
  const forbidden = biasKeys.filter((key) => /count|sessions|target|days/i.test(key));
  ok('the bias exposes no count, target or session field at all', forbidden.length === 0,
    `${forbidden.join(', ')} — reading A changes what fills the week, never how much of it`);
}

console.log('\n[3] Ruling 3 — a mobility/injury-history weakness leans the OPTIONAL needs');
{
  ok('only the mobility/injury-prevention focus leans the top-ups',
    weakPointLeansOptionalTopUps('mobility_and_injury_prevention') &&
    !weakPointLeansOptionalTopUps('strength_and_size') &&
    !weakPointLeansOptionalTopUps('conditioning') &&
    !weakPointLeansOptionalTopUps('speed') &&
    !weakPointLeansOptionalTopUps('unresolved'));

  ok('the leaned threshold is BELOW FOUR of the six, as ruled',
    WEAK_POINT_ACCESSORY_REGION_THRESHOLD === 4 && ACCESSORY_REGION_THRESHOLD === 3);

  // A week covering exactly three regions: the need does NOT fire normally (three is the
  // threshold) and DOES fire for the athlete who said this is their weak point.
  const rows = ['Copenhagen Plank (Half)', 'Dead Bug', 'Seated Calf Raise'];
  const week = [{
    id: 'w-1', microcycleId: 'm', dayOfWeek: 1, name: 'Session', description: '',
    durationMinutes: 60, intensity: 'Moderate', workoutType: 'Strength',
    exercises: rows.map((name, index) => ({ id: `r-${index}`, exercise: { name } })),
  } as unknown as Workout];
  const base = { workouts: week, seasonPhase: 'In-season' as const,
    candidateDays: [1, 2, 3, 4, 5], gameDayOfWeek: null };

  const without = computeOptionalTopUps(base)
    .filter((placement) => placement.type === 'accessories');
  const with_ = computeOptionalTopUps({ ...base, weakPointFocus: 'mobility_and_injury_prevention' })
    .filter((placement) => placement.type === 'accessories');
  ok('three regions covered: no top-up without the weakness', without.length === 0);
  ok('three regions covered: a top-up WITH it', with_.length === 1, with_);

  // PLACED EARLY, as ruled. Monday leads for this athlete; Wednesday (`:152`) otherwise.
  const early = computeOptionalTopUps({
    ...base, workouts: [], weakPointFocus: 'mobility_and_injury_prevention',
  })[0];
  const normal = computeOptionalTopUps({ ...base, workouts: [] })[0];
  ok('the leaned placement is EARLY in the week', early?.dayOfWeek === 1, early);
  ok('and the unleaned one still prefers Wednesday (`:152`)', normal?.dayOfWeek === 3, normal);

  // READING A's BOUNDARY AGAIN, from the other side: only OPTIONAL work moved. The needs
  // are the only thing the focus reaches, and both place optional sessions.
  const requiredMoved = computeOptionalTopUps({ ...base, weakPointFocus: 'speed' }).length
    !== computeOptionalTopUps(base).length;
  ok('a speed weakness moves no need at all — required work is untouched', !requiredMoved);
}

console.log('\n[4] Ruling 4 — the no-weakness DEFAULT ORDER is law, not coincidence');
{
  // `:105`: "If they don't really say they have a weakness then strength and size should
  // be prioritised early, then building work capacity, then increasing speed and
  // intensity as we get closer to pre season."
  //
  // The off-season subphase tables already run in that direction. Sam ruled it GATED
  // rather than left emergent, because the `:116` lesson stands: an unenforced Bible
  // line rots, and nothing had ever asserted this one.
  const bible = fs.readFileSync(
    path.join(repoRoot, 'docs/LFA_PROGRAMMING_BIBLE.md'), 'utf8');
  ok('`:105` still states the default order verbatim',
    bible.includes('strength and size should be prioritised early, then building work '
      + 'capacity, then increasing speed and intensity as we get closer to pre season'));

  const selection = (mode: 'early_offseason' | 'mid_offseason' | 'late_offseason') =>
    resolveSection18PhasePlannerSelection({
      mode, readiness: 'medium', availableDayCount: 5, teamTrainingCount: 0,
      weekKind: 'build',
    } as never);
  const early = selection('early_offseason');
  const mid = selection('mid_offseason');
  const late = selection('late_offseason');

  // STRENGTH AND SIZE EARLY: strength is present from the first subphase.
  ok('strength is prioritised from early off-season', early.mainStrength >= 2,
    { early: early.mainStrength });
  // THEN WORK CAPACITY: conditioning does not fall as the phase progresses.
  ok('conditioning builds, never falls, across the subphases',
    mid.coreConditioning >= early.coreConditioning &&
    late.coreConditioning >= mid.coreConditioning,
    { early: early.coreConditioning, mid: mid.coreConditioning, late: late.coreConditioning });
  // THEN SPEED AND INTENSITY TOWARD PRE-SEASON: sprint rises and never falls.
  ok('sprint/high-speed rises toward pre-season and never falls',
    mid.sprintHighSpeed >= early.sprintHighSpeed &&
    late.sprintHighSpeed >= mid.sprintHighSpeed,
    { early: early.sprintHighSpeed, mid: mid.sprintHighSpeed, late: late.sprintHighSpeed });
  ok('Off-season weeks 1-4 retain zero automatic Speed',
    early.sprintHighSpeed === 0 && mid.sprintHighSpeed === 0,
    { early: early.sprintHighSpeed, mid: mid.sprintHighSpeed });
  ok('Speed starts only in late Off-season', late.sprintHighSpeed === 1,
    { late: late.sprintHighSpeed });
}

console.log('\n[5] Ruling 0 — the power lean reaches its TWO real consumers');
{
  // Sam: "should focus more on power and accelerations — the lean targets the authored
  // power pool / primer picks AND acceleration-flavoured speed work (accelerations
  // specifically, not top-speed)."
  //
  // Those two live outside `testingBias`, so the focus reaches them directly. That is not
  // a second vehicle for reading A — it is the same reading applied where the choice
  // actually gets made, and both consumers are SELECTIONS between authored options.

  ok('a power weakness nudges the authored power primer',
    weakPointNudgesPower('power_and_acceleration'));
  ok('and a speed weakness does not — they are separate categories',
    !weakPointNudgesPower('speed'));
  ok('no other weakness nudges it',
    !weakPointNudgesPower('conditioning') && !weakPointNudgesPower('strength_and_size') &&
    !weakPointNudgesPower('mobility_and_injury_prevention') &&
    !weakPointNudgesPower('unresolved'));

  ok('a power weakness holds speed selection on accelerations',
    weakPointPrefersAcceleration('power_and_acceleration'));
  ok('and a SPEED weakness does not — it may progress to top-speed',
    !weakPointPrefersAcceleration('speed'));

  // THE REAL SELECTION, through Sam's own templates. Late off-season position 3 is where
  // the progression leaves accelerations for build-ups ("smooth build-ups, not all-out").
  const context = {
    seasonPhase: 'Off-season' as const,
    offseasonSubphase: 'late_offseason' as const,
    weekNumber: 9,
    weekInBlock: 3,
  };
  const normal = selectLateOffseasonSpeedTemplate(context);
  const power = selectLateOffseasonSpeedTemplate({ ...context, preferAcceleration: true });
  // Stage B switchover: selection serves AUTHORED templates by name
  // (docs/STAGE_B_STAGE2_SWITCHOVER_PREDICTION_2026-08-05.md).
  ok('by default the progression reaches the flying reintroduction (toward top-speed)',
    normal?.name === 'Off-Season Speed Reintroduction', normal?.name);
  ok('a power weakness holds the ACCELERATION exposure instead',
    power?.name === '20 m Acceleration Reps', power?.name);
  ok('and both are Sam-authored templates — the lean picks, it does not invent',
    CONDITIONING_TEMPLATES.some((template) => template.name === power?.name) &&
    CONDITIONING_TEMPLATES.some((template) => template.name === normal?.name));

  // READING A's BOUNDARY, once more: only the position that LEAVES accelerations changes.
  // Position is `weekNumber - 3`, so weeks 4 and 5 are positions 1 and 2 — both already
  // acceleration templates, and both identical either way. The lean does not reach back
  // and re-pick something that was already an acceleration.
  for (const [weekNumber, position] of [[4, 1], [5, 2]] as const) {
    const early = selectLateOffseasonSpeedTemplate({ ...context, weekNumber });
    const earlyPower = selectLateOffseasonSpeedTemplate({
      ...context, weekNumber, preferAcceleration: true,
    });
    ok(`late position ${position} is identical either way`, early?.name === earlyPower?.name,
      { position, early: early?.name, earlyPower: earlyPower?.name });
    ok(`late position ${position} is already an acceleration template`,
      /acceleration/i.test(early?.name ?? ''), early?.name);
  }
}

console.log(`\nWeak-point focus: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
console.log('  DEPTH (L13): 0-1 — pure mapping, pure bias, authored phase tables.');
console.log('  Power & explosiveness is RULED as its own category (Sam, 2026-07-30).');
if (failures.length > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
