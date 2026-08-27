/**
 * D13 — the session is ONE list.
 *
 * Spec: `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md` (all ten rulings resolved in
 * §6). Seven separate render boxes (Power Primer, Conditioning Phases, Recovery
 * Block, Strength, combined-day conditioning picker, Trunk/Support, Recovery
 * Add-on) collapse into a single ordered list of typed rows, each carrying one
 * of exactly six role badges.
 *
 * THE STRUCTURAL POINT. Today `DayWorkoutScreenV2` mounts ONE of three
 * mutually-exclusive branches (`isConditioning` / `isRecovery` / default), and
 * `TeamTrainingBlock` only lives inside the default branch — so a conditioning
 * day that also carries team training silently renders none of it (spec §2 item
 * 4c, the found bug). A single composition owner that emits every applicable
 * row unconditionally fixes that BY CONSTRUCTION rather than by adding a fourth
 * mount site. That is what this suite pins: not "team training also renders on
 * conditioning days" as a special case, but "the list is built once, from the
 * whole workout, for every day type".
 *
 * Recovery and standalone Mobility now use this same template too. Their
 * low-load tier remains a programming fact and no longer selects another UI.
 *
 * Run: npm run test:session-template
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import {
  SESSION_ROLE_ORDER,
  classifyExerciseRole,
  type SessionRole,
} from '../utils/sessionRoles';
import {
  buildSessionTemplate,
  sessionListLabels,
  type SessionTemplateItem,
} from '../utils/sessionTemplate';

const src = path.resolve(__dirname, '..');

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

/* ══ Fixtures ══ */

let rowSeq = 0;
function strengthRow(name: string, overrides: Record<string, unknown> = {}): any {
  rowSeq += 1;
  const id = String(overrides.id ?? `row-${rowSeq}`);
  return {
    id,
    exerciseId: `ex-${id}`,
    exerciseOrder: rowSeq,
    prescribedSets: 3,
    prescribedRepsMin: 8,
    prescribedRepsMax: 10,
    restSeconds: 90,
    exercise: { id: `lib-${id}`, name },
    ...overrides,
  };
}

function workoutOf(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'w1',
    microcycleId: 'm1',
    dayOfWeek: 1,
    name: 'Lower Strength',
    description: '',
    durationMinutes: 60,
    intensity: 'moderate',
    workoutType: 'Strength',
    exercises: [],
    ...overrides,
  };
}

function roles(items: SessionTemplateItem[]): Array<SessionRole | null> {
  return items.map((item) => item.role);
}

function names(items: SessionTemplateItem[]): string[] {
  return items.map((item) => {
    if (item.kind === 'exercise') return item.row?.exercise?.name ?? item.row?.name ?? '?';
    if (item.kind === 'conditioning_choice') return `choice:${item.options.length}`;
    return 'team_training';
  });
}

/* ══ 1. The six badges, and the mapping rule behind each ══ */

/**
 * Roles added after D13, each exempt from counting. A role may only appear here
 * if `ROLES_EXEMPT_FROM_COUNTING` agrees — asserted below, so this list cannot
 * become a place to hide a COUNTED role from D13's order.
 */
import { ROLES_EXEMPT_FROM_COUNTING } from '../rules/sessionRowCounting';

import {
  formatConditioningRowPrescription,
  formatStrengthSetsReps,
} from '../screens/home/dayWorkoutHelpers';
import { APPROVED_REP_TARGETS, displayReps } from '../rules/prescriptionDisplay';
import { liftTonnageKg } from '../rules/journalLoad';

const NON_COUNTING_EXTRAS = new Set(['team_training', 'mobility']);

console.log('\n[1] Exactly six roles, with a source-grounded mapping rule');
{
  // Sam ruled 2026-07-27: the roles are INTERNAL DATA, not athlete-facing text.
  // They drive ordering, the mobility flow, and future muscle-block logic — the
  // athlete never reads the word. So this pins the role SET and its D2 order,
  // not a badge vocabulary. There is no longer a role→label map to assert.
  // WIDENED 2026-08-13, NOT LOOSENED, AND I SHOULD HAVE DONE IT IN THE COMMIT
  // THAT BROKE IT. Two roles have joined since D13: `team_training` (Sam,
  // 2026-08-13 — "it's its own component of the day") and `mobility` (his
  // pairing rule 5 — "counts toward nothing"). BOTH are exempt from counting,
  // which is exactly why they are not part of D13's six: D13 ordered the
  // COUNTED work of a session, and neither of these is counted.
  //
  // THE GUARD IS UNCHANGED IN SUBSTANCE: D13's six must still be present, in
  // D2 order, contiguous, with nothing inserted between them. What may vary is
  // only the non-counting roles bracketing them — and a new one of those has to
  // be added here on purpose, which is the decision this cell forces.
  // AND THE LIST CANNOT BECOME A HIDING PLACE. An extra role is only allowed to
  // sit outside D13's order because it is not counted; if one of these ever
  // starts counting, it belongs in D13's order and this reds.
  ok(
    'every extra role is genuinely exempt from counting, not just listed here',
    [...NON_COUNTING_EXTRAS].every((role) =>
      ROLES_EXEMPT_FROM_COUNTING.has(role as never)),
    [...NON_COUNTING_EXTRAS].join(', '));

  ok(
    'D13\'s six are present in D2 order, and every extra role is non-counting',
    JSON.stringify(SESSION_ROLE_ORDER.filter((role) => !NON_COUNTING_EXTRAS.has(role))) ===
      JSON.stringify([
        'power',
        'main_lift',
        'accessory',
        'midline',
        'prehab',
        'conditioning',
      ]),
    `got ${JSON.stringify(SESSION_ROLE_ORDER)}`,
  );

  // §3.2: anchor-role pattern-slot entries are the main lift. A SECOND anchor in
  // the same session reuses this badge — "secondary" is a list position, never
  // its own badge (§6 item 1).
  ok('an anchor pattern-slot entry is Main Lift', classifyExerciseRole('Back Squat') === 'main_lift');
  ok('a second anchor reuses Main Lift', classifyExerciseRole('Romanian Deadlift') === 'main_lift');

  ok(
    'an accessory pattern-slot entry is Accessory',
    classifyExerciseRole('Bulgarian Split Squat') === 'accessory',
  );
  ok('an arms/pump pool entry is Accessory', classifyExerciseRole('Hammer Curl') === 'accessory');
  ok('a delts pool entry is Accessory', classifyExerciseRole('Lateral Raise') === 'accessory');

  ok(
    'a trunk_anti_rotation pool entry is Midline',
    classifyExerciseRole('Band Pallof Press') === 'midline',
  );
  ok('a core-tagged row is Midline', classifyExerciseRole('Dead Bug') === 'midline');

  ok('a lower_prehab entry is Prehab', classifyExerciseRole('Banded TKE') === 'prehab');
  ok(
    'a shoulder_health entry is Prehab',
    classifyExerciseRole('Banded External Rotation') === 'prehab',
  );
  ok(
    'a groin_adductors entry is Prehab',
    classifyExerciseRole('Copenhagen Plank (Half)') === 'prehab',
  );
  ok('a calves entry is Prehab', classifyExerciseRole('Single-Leg Calf Raise') === 'prehab');
  ok(
    'a hamstring_light entry is Prehab',
    classifyExerciseRole('Swiss Ball Hamstring Curl') === 'prehab',
  );

  // Band Pull-Apart sits in BOTH upper_back_pump (arms/pump → Accessory) and
  // shoulder_health (→ Prehab). The classifier must be deterministic about it
  // rather than order-of-iteration dependent; prehab wins because joint-health
  // membership is the more specific claim.
  ok(
    'a name in both the pump and prehab pools resolves deterministically to Prehab',
    classifyExerciseRole('Band Pull-Apart') === 'prehab',
  );

  ok(
    'an unrecognised name falls back to Accessory rather than throwing',
    classifyExerciseRole('Something The Pools Never Heard Of') === 'accessory',
  );
}

/* ══ 2. One list, D2 order ══ */

console.log('\n[2] One list in D2 order — power → main → accessory → midline → prehab → conditioning');
{
  const workout = workoutOf({
    exercises: [
      // Power is a ROW now (Sam, 2026-07-28) — same list, typed role. It is
      // authored LAST here on purpose: D2 order must come from the role the row
      // carries, not from where the fixture happened to put it.
      // Deliberately authored OUT of D2 order so a passing test proves the
      // owner sorts, rather than that the fixture was already sorted.
      strengthRow('Hammer Curl'),
      strengthRow('Band Pallof Press'),
      strengthRow('Back Squat'),
      strengthRow('Banded TKE'),
      strengthRow('Romanian Deadlift'),
      strengthRow('Bulgarian Split Squat'),
      // Power is a ROW now (Sam, 2026-07-28) — same list, typed role. Authored
      // LAST on purpose: D2 order must come from the role the row carries, not
      // from where the fixture happened to put it.
      { ...strengthRow('Broad Jump'), role: 'power' as const,
        power: { family: 'lower' as const, kind: 'primer' as const } },
    ],
  });

  const template = buildSessionTemplate(workout);
  ok('a strength day builds a badged list', template.mode === 'badged_list');
  ok(
    'every exercise is a flat list row — no nested section groupings',
    template.items.every((item) => item.kind !== undefined),
  );
  ok(
    'the list is ordered power → main → main → accessory → accessory → midline → prehab',
    JSON.stringify(roles(template.items)) ===
      JSON.stringify([
        'power',
        'main_lift',
        'main_lift',
        'accessory',
        'accessory',
        'midline',
        'prehab',
      ]),
    `got ${JSON.stringify(roles(template.items))}`,
  );
  ok(
    'the two anchors keep their authored relative order (stable sort)',
    names(template.items).indexOf('Back Squat') <
      names(template.items).indexOf('Romanian Deadlift'),
  );
  ok(
    'Midline and Prehab sit after Accessory (§6 item 5)',
    roles(template.items).indexOf('midline') > roles(template.items).lastIndexOf('accessory'),
  );
}

/* ══ 3. The superset pill survives as an in-list indicator ══ */

console.log('\n[3] Supersets stay contiguous and keep their pairing indicator');
{
  const workout = workoutOf({
    exercises: [
      strengthRow('Back Squat'),
      strengthRow('Hammer Curl', { supersetGroup: 'A', supersetOrder: 1 }),
      strengthRow('Lateral Raise', { supersetGroup: 'A', supersetOrder: 2 }),
      strengthRow('Bulgarian Split Squat'),
    ],
  });
  const template = buildSessionTemplate(workout);
  const listed = names(template.items);
  const first = listed.indexOf('Hammer Curl');
  const second = listed.indexOf('Lateral Raise');

  ok('both superset members are present', first >= 0 && second >= 0);
  ok('superset members are adjacent in the flat list', second === first + 1);
  ok(
    'each superset member carries the pairing indicator, not a badge of its own',
    template.items
      .filter((item) => item.kind === 'exercise' && item.superset)
      .length === 2,
  );
  ok(
    'the pairing indicator names its group and position',
    template.items.some(
      (item) =>
        item.kind === 'exercise' &&
        item.superset?.groupId === 'A' &&
        item.superset?.size === 2,
    ),
  );
  ok(
    'a superset still gets an ordinary role badge per member',
    template.items
      .filter((item) => item.kind === 'exercise' && item.superset)
      .every((item) => item.role === 'accessory'),
  );
}

/* ══ 4. A superset spanning two tiers is not torn apart by the sort ══ */

console.log('\n[4] A cross-tier superset keeps its members together');
{
  const workout = workoutOf({
    exercises: [
      strengthRow('Hammer Curl'),
      strengthRow('Back Squat', { supersetGroup: 'B', supersetOrder: 1 }),
      strengthRow('Band Pallof Press', { supersetGroup: 'B', supersetOrder: 2 }),
    ],
  });
  const template = buildSessionTemplate(workout);
  const listed = names(template.items);

  ok(
    'the pair is contiguous even though its members rank into different tiers',
    listed.indexOf('Band Pallof Press') === listed.indexOf('Back Squat') + 1,
  );
  ok(
    'the group sorts at its highest-ranked member (the main lift leads)',
    listed[0] === 'Back Squat',
    `got ${JSON.stringify(listed)}`,
  );
  ok(
    'each member still shows its OWN role badge',
    roles(template.items).slice(0, 2).join(',') === 'main_lift,midline',
    `got ${JSON.stringify(roles(template.items))}`,
  );
}

/* ══ 5. Conditioning: the picker becomes one expanding row; phases stay in phase order ══ */

console.log('\n[5] Conditioning — combined-day picker and conditioning-only phase order');
{
  const combined = workoutOf({
    workoutType: 'Strength',
    hasCombinedConditioning: true,
    conditioningBlock: {
      intent: 'aerobic_base',
      options: [
        { title: 'Bike', description: '20 min', exerciseIds: ['c1'] },
        { title: 'Run', description: '20 min', exerciseIds: ['c2'] },
      ],
    },
    exercises: [
      strengthRow('Back Squat'),
      strengthRow('Easy Bike', { id: 'c1', prescriptionType: 'duration_minutes' }),
      strengthRow('Tempo Run', { id: 'c2', prescriptionType: 'duration_minutes' }),
    ],
  });
  const combinedTemplate = buildSessionTemplate(combined);

  ok(
    'the "choose one" picker is ONE conditioning-badged list item, not a box',
    combinedTemplate.items.filter((item) => item.kind === 'conditioning_choice').length === 1,
  );
  ok(
    'the picker item carries both options for in-place expansion',
    combinedTemplate.items.some(
      (item) => item.kind === 'conditioning_choice' && item.options.length === 2,
    ),
  );
  ok(
    'conditioning sits last, after the strength content',
    roles(combinedTemplate.items).lastIndexOf('conditioning') ===
      combinedTemplate.items.length - 1,
  );

  const singlePrescription = workoutOf({
    workoutType: 'Strength',
    hasCombinedConditioning: true,
    conditioningBlock: {
      intent: 'high-intensity',
      options: [
        { title: 'Hard Intervals', description: '', exerciseIds: ['only-c1'] },
      ],
    },
    exercises: [
      strengthRow('Back Squat'),
      strengthRow('Classic 4×4', { id: 'only-c1', role: 'conditioning' }),
    ],
  });
  const singleTemplate = buildSessionTemplate(singlePrescription);
  ok(
    'one conditioning prescription renders directly — no fake choice or generic wrapper title',
    !singleTemplate.items.some((item) => item.kind === 'conditioning_choice')
      && singleTemplate.items.some((item) => item.kind === 'exercise'
        && item.presentation === 'conditioning_phase'
        && item.row.exercise.name === 'Classic 4×4'),
    `got ${JSON.stringify(names(singleTemplate.items))}`,
  );

  const conditioningOnly = workoutOf({
    name: 'Tempo Run',
    workoutType: 'Tempo-Run',
    exercises: [
      strengthRow('Easy Bike', { id: 'p1' }),
      strengthRow('Tempo Run', { id: 'p2' }),
      strengthRow('Dead Bug', { id: 'p3' }),
    ],
  });
  const phases = buildSessionTemplate(conditioningOnly);

  ok('a conditioning-only day is still a badged list', phases.mode === 'badged_list');
  ok(
    'conditioning-only days follow phase order, not D2 order (§6 item 4)',
    phases.ordering === 'phase',
  );
  ok(
    'the phases render in the order the conditioning content already carries',
    names(phases.items).slice(0, 2).join(',') === 'Easy Bike,Tempo Run',
    `got ${JSON.stringify(names(phases.items))}`,
  );
  ok(
    'each phase is Conditioning-badged',
    phases.items.slice(0, 2).every((item) => item.role === 'conditioning'),
  );
}

/* ══ 6. The found bug: team training renders on every applicable day type ══ */

console.log('\n[6] Team training renders by construction, on every applicable day type');
{
  const teamRow = () => strengthRow('Team Training', { workoutType: 'Team Training' });

  const strengthDay = buildSessionTemplate(
    workoutOf({ exercises: [strengthRow('Back Squat'), teamRow()] }),
  );
  const conditioningDay = buildSessionTemplate(
    workoutOf({
      name: 'Tempo Run',
      workoutType: 'Tempo-Run',
      exercises: [strengthRow('Tempo Run', { id: 'tp1' }), teamRow()],
    }),
  );

  /**
   * ⚠ **THESE CELLS HELD THE OPPOSITE RULE UNTIL 2026-08-21, AND THE RULE
   * CHANGED — SAM CHANGED IT.**
   *
   * *"remove the club training from the other view of strength / mobility /
   * conditioning days - so it is two separate feedback forms"*. Club training
   * now has its own door (the day card's "Log training" button) and its own
   * form, so a gym session no longer carries a TEAM TRAINING section holding a
   * single "Club session" tick.
   *
   * The cells are re-aimed rather than deleted: the same two days are built,
   * and the assertion is inverted so a re-add is a red rather than a silence.
   */
  ok(
    'club training does NOT ride inside a strength day any more',
    !strengthDay.items.some((item) => item.kind === 'team_training'),
    'it has its own form now — a gym session should not carry a club checkbox',
  );
  ok(
    'nor inside a conditioning day',
    !conditioningDay.items.some((item) => item.kind === 'team_training'),
  );
  ok(
    'and the gym day ends on its own work, not a club banner',
    strengthDay.items[strengthDay.items.length - 1].kind !== 'team_training',
  );

  const teamOnly = buildSessionTemplate(
    workoutOf({ name: 'Team Training', workoutType: 'Team Training', exercises: [teamRow()] }),
  );
  ok(
    'a team-only day is just the banner',
    teamOnly.items.length === 1 && teamOnly.items[0].kind === 'team_training',
  );
}

/* ══ 7. Recovery add-on content is conserved as badged rows, never dropped ══ */

console.log('\n[7] The Recovery Add-on box splits into ordinary badged rows');
{
  const workout = workoutOf({
    exercises: [strengthRow('Back Squat')],
    recoveryAddons: [
      {
        id: 'addon-1',
        label: 'Trunk/Core',
        durationMinutes: 8,
        exercises: [
          { id: 'a1', name: 'Copenhagen Plank (Half)', prescription: '2 × 20-30s / side' },
          { id: 'a2', name: 'Side Plank', prescription: '2 × 30-45s / side' },
        ],
      },
    ],
  });
  const template = buildSessionTemplate(workout);
  const listed = names(template.items);

  ok(
    'no add-on exercise is lost when the box dies',
    listed.includes('Copenhagen Plank (Half)') && listed.includes('Side Plank'),
    `got ${JSON.stringify(listed)}`,
  );
  ok(
    'add-on rows get ordinary role badges',
    template.items.some((item) => item.kind === 'exercise' && item.role === 'prehab') &&
      template.items.some((item) => item.kind === 'exercise' && item.role === 'midline'),
  );
  ok(
    'add-on rows stay marked optional — the no-penalty meaning survives the move',
    template.items
      .filter((item) => item.kind === 'exercise' && item.presentation === 'addon')
      .every((item) => item.kind === 'exercise' && item.optional === true),
  );
  ok(
    'session-prescribed rows are NOT marked optional',
    template.items
      .filter((item) => item.kind === 'exercise' && item.presentation === 'strength')
      .every((item) => item.kind === 'exercise' && item.optional === false),
  );
}

/* ══ 8. Recovery days use the same exercise-list template ══ */

console.log('\n[8] Recovery-type days use the shared list');
{
  const recovery = buildSessionTemplate(
    workoutOf({
      name: 'Recovery',
      workoutType: 'Recovery',
      exercises: [strengthRow('Couch Stretch'), strengthRow('Cat-Cow')],
    }),
  );
  ok('a recovery day reports the ordinary list mode', recovery.mode === 'badged_list');
  ok(
    'the recovery template carries every prescribed row',
    recovery.items.length === 2
      && recovery.items.every((item) => item.kind === 'exercise'
        && item.presentation === 'recovery'),
  );

  const tierRecovery = buildSessionTemplate(
    workoutOf({ workoutType: 'Strength', sessionTier: 'recovery', exercises: [strengthRow('Cat-Cow')] }),
  );
  ok(
    'a recovery SESSION TIER also takes the shared template',
    tierRecovery.mode === 'badged_list'
      && tierRecovery.items.length === 1,
  );
}

/* ══ 9. The screen renders the owner's list, not seven boxes ══ */

console.log('\n[9] DayWorkoutScreenV2 renders one list from the composition owner');
{
  const screen = fs.readFileSync(
    path.join(src, 'screens/home/DayWorkoutScreenV2.tsx'),
    'utf8',
  );

  ok(
    'the screen consumes the composition owner',
    /buildSessionTemplate|sessionTemplate/.test(screen),
  );
  ok(
    'the Power Primer box is gone from the screen entirely',
    !/PowerPrimerSection/.test(screen),
    'power is the first list row now, and Sam ruled it off recovery days too',
  );
  // RE-POINTED. This used to assert `<PowerRow`, an interim component that was
  // still a block renderer wearing a row's name — it took `block={item.block}`
  // and printed the block's own title, prescription and notes. Stage 4 retired
  // it: power now goes through the SAME strength-row path as every other
  // exercise, which is what "power renders as a normal exercise row" actually
  // means. The screen having no power-specific renderer at all is the stronger
  // statement, and the one that stays true.
  ok(
    'the screen has no power-specific renderer — power uses the ordinary row path',
    !/PowerRow|powerBlock|item\.kind === 'power'/.test(screen),
  );
  ok(
    'the Trunk / Support box is gone',
    !/TrunkSupportSection/.test(screen),
    'trunk rows are now Midline-badged list rows',
  );
  ok(
    'the "Strength" section header is gone',
    !/<SectionLabel[^>]*>\s*Strength\s*</.test(screen),
  );
  ok(
    'the combined-day "Choose one:" box header is gone',
    !/<SectionLabel[^>]*>\s*Conditioning\s*</.test(screen),
  );
  ok(
    'the three mutually-exclusive branches are gone',
    !/isConditioning \? \(/.test(screen) && !/: isRecovery \? \(/.test(screen),
    'the branch structure is exactly what hid team training on conditioning days',
  );
  ok(
    'team training is no longer mounted from inside the strength branch',
    !/hasTeamTraining \? <TeamTrainingBlock \/> : null/.test(screen),
  );
  // Sam ruled 2026-07-27: no role TEXT on rows. The D2 ordering already tells
  // the athlete what matters, so a big "MAIN LIFT" label earns nothing.
  ok(
    'no role badge text is rendered on a row',
    !/SessionRoleBadge/.test(screen),
  );
  ok(
    'the numeric index is back in the row header',
    /label=\{labels\[/.test(screen),
  );
}

/* ══ 10. The numeric index, exactly as it read before ══ */

console.log('\n[10] Rows are numbered 1 / 1a / 2 again (Sam, 2026-07-27)');
{
  const workout = workoutOf({
    exercises: [
      strengthRow('Back Squat'),
      strengthRow('Hammer Curl', { supersetGroup: 'A', supersetOrder: 1 }),
      strengthRow('Lateral Raise', { supersetGroup: 'A', supersetOrder: 2 }),
      strengthRow('Band Pallof Press'),
    ],
  });
  const items = buildSessionTemplate(workout).items;
  const labels = sessionListLabels(items);

  ok(
    'a standalone row, then a superset pair, then the next row reads 1 / 2a / 2b / 3',
    JSON.stringify(labels) === JSON.stringify(['1', '2a', '2b', '3']),
    `got ${JSON.stringify(labels)}`,
  );

  // A superset counts as ONE numbered slot with lettered members — the
  // behaviour buildStrengthLabels always had, now driven off list order.
  const paired = sessionListLabels(
    buildSessionTemplate(
      workoutOf({
        exercises: [
          strengthRow('Back Squat', { supersetGroup: 'B', supersetOrder: 1 }),
          strengthRow('Dead Bug', { supersetGroup: 'B', supersetOrder: 2 }),
        ],
      }),
    ).items,
  );
  ok(
    'a leading superset takes slot 1, lettered a/b',
    JSON.stringify(paired) === JSON.stringify(['1a', '1b']),
    `got ${JSON.stringify(paired)}`,
  );

  // Things that were never numbered before must not start being numbered now.
  const mixed = buildSessionTemplate(
    workoutOf({
      powerBlock: {
        id: 'pb1',
        kind: 'primer',
        title: 'Broad Jumps',
        prescription: '3 x 3',
        options: [],
        notes: [],
      },
      exercises: [strengthRow('Back Squat'), strengthRow('Team Training', { workoutType: 'Team Training' })],
      recoveryAddons: [
        {
          id: 'addon-1',
          label: 'Midline',
          durationMinutes: 8,
          exercises: [{ id: 'a1', name: 'Side Plank', prescription: '2 x 30s' }],
        },
      ],
    }),
  );
  const mixedLabels = sessionListLabels(mixed.items);
  ok(
    'power, add-on and team-training rows carry no number',
    mixed.items.every((item, index) =>
      item.kind === 'exercise' && item.presentation === 'strength'
        ? mixedLabels[index] !== null
        : mixedLabels[index] === null),
    `got ${JSON.stringify(mixedLabels)}`,
  );
  ok(
    'the one numbered row is the strength row, numbered 1',
    mixedLabels.filter(Boolean).join(',') === '1',
    `got ${JSON.stringify(mixedLabels)}`,
  );
}

/* ══ 11. The optional cluster: one group, at the end, under one header ══ */

console.log('\n[11] Optional work is ONE contiguous cluster at the end of the list');
{
  // Sam's run-7 ruling 1: "the optional cluster at the session's end gets a
  // single header; the per-row OPTIONAL labels die."
  //
  // A single header is only honest if the rows it heads are actually contiguous
  // and actually last. Before this ruling they were neither: an add-on row was
  // ranked by `classifyExerciseRole(name)` like any other row, so a Side Plank
  // add-on sorted as `midline` and landed BETWEEN prescribed accessories and
  // prescribed prehab. A header over that would have claimed prescribed work was
  // optional. So the clustering belongs to the composition owner — the renderer
  // must not be the thing deciding which rows a header covers.
  const workout = workoutOf({
    hasCombinedConditioning: true,
    conditioningBlock: {
      options: [{ title: 'Bike', description: '', exerciseIds: ['c1'] }],
    },
    exercises: [
      strengthRow('Back Squat', { id: 'r1' }),
      strengthRow('Bulgarian Split Squat', { id: 'r2' }),
      strengthRow('Pallof Press', { id: 'r3' }),
      // Prescribed prehab — ranks equal with the optional prehab add-on below,
      // so before the ruling the two groups genuinely interleaved.
      strengthRow('Copenhagen Plank (Half)', { id: 'r4' }),
      strengthRow('Bike Intervals', { id: 'c1', workoutType: 'Conditioning' }),
      strengthRow('Team Training', { id: 'tt', workoutType: 'Team Training' }),
    ],
    recoveryAddons: [
      {
        id: 'addon-1',
        label: 'Midline',
        durationMinutes: 8,
        exercises: [
          // Classifies `midline` — the row that used to interleave.
          { id: 'a1', name: 'Side Plank', prescription: '2 x 30-45s / side' },
          // Classifies `prehab`.
          { id: 'a2', name: 'Tib Raises', prescription: '2 x 12-15' },
        ],
      },
    ],
  });

  const items = buildSessionTemplate(workout).items;
  const optionalFlags = items.map(
    (item) => item.kind === 'exercise' && item.optional === true,
  );
  const firstOptional = optionalFlags.indexOf(true);
  const lastOptional = optionalFlags.lastIndexOf(true);

  ok(
    'the optional rows are contiguous — nothing prescribed sits between them',
    firstOptional !== -1 &&
      optionalFlags.slice(firstOptional, lastOptional + 1).every(Boolean),
    `optional flags: ${JSON.stringify(optionalFlags)} for ${JSON.stringify(names(items))}`,
  );
  ok(
    'every prescribed row sorts ABOVE the cluster, conditioning finisher included',
    items
      .slice(0, firstOptional)
      .every((item) => !(item.kind === 'exercise' && item.optional)) &&
      items
        .slice(0, firstOptional)
        .some((item) => item.role === 'conditioning'),
    `got ${JSON.stringify(names(items))}`,
  );
  /* Re-aimed with the four in section [6] (Sam, 2026-08-21): a gym day carries
     no club banner at all now, so "absolute last" became "absent". The ordering
     rule it protected — context sorts below work — has nothing left to order on
     this day, and the cells below still hold the optional cluster's own order. */
  ok(
    'no club banner rides this gym day at all',
    !items.some((item) => item.kind === 'team_training'),
    `got ${JSON.stringify(names(items))}`,
  );
  ok(
    'a midline add-on no longer interleaves with prescribed midline work',
    names(items).indexOf('Side Plank') > names(items).indexOf('Pallof Press'),
    `got ${JSON.stringify(names(items))}`,
  );

  // The cluster keeps D2's order INSIDE itself: an optional prehab row still
  // sorts after an optional midline row. Optional changes which GROUP a row is
  // in, not what kind of work it is.
  ok(
    'D2 order still applies within the cluster',
    names(items).indexOf('Tib Raises') > names(items).indexOf('Side Plank'),
    `got ${JSON.stringify(names(items))}`,
  );
}

console.log('\n[12] The screen renders one "Optional work" header, and no per-row label');
{
  const screen = fs.readFileSync(path.join(src, 'screens/home/DayWorkoutScreenV2.tsx'), 'utf8');

  const conditioningPhaseStart = screen.indexOf('function ConditioningPhaseRow(');
  const conditioningPhaseEnd = screen.indexOf('interface ConditioningRowProps', conditioningPhaseStart);
  ok(
    'the standalone conditioning-row source region is present before its rendering contract is checked',
    conditioningPhaseStart >= 0 && conditioningPhaseEnd > conditioningPhaseStart,
    `${conditioningPhaseStart}:${conditioningPhaseEnd}`,
  );
  const conditioningPhaseSource = conditioningPhaseStart >= 0 && conditioningPhaseEnd > conditioningPhaseStart
    ? screen.slice(conditioningPhaseStart, conditioningPhaseEnd)
    : '';
  ok(
    'a standalone conditioning row does not print a second rest line beneath its structured Recovery line',
    conditioningPhaseSource.length > 0
      && !/formatRest\s*\(|styles\.conditioningRest/.test(conditioningPhaseSource),
    conditioningPhaseSource,
  );

  const structuredCopyStart = screen.indexOf('function ConditioningPrescriptionCopy(');
  const structuredCopyEnd = screen.indexOf('function ConditioningPhaseRow(', structuredCopyStart);
  ok(
    'the shared conditioning-copy renderer is present before its emphasis contract is checked',
    structuredCopyStart >= 0 && structuredCopyEnd > structuredCopyStart,
    `${structuredCopyStart}:${structuredCopyEnd}`,
  );
  const structuredCopySource = structuredCopyStart >= 0 && structuredCopyEnd > structuredCopyStart
    ? screen.slice(structuredCopyStart, structuredCopyEnd)
    : '';
  ok(
    'one shared renderer bolds Work, Recovery, count and Intensity labels',
    structuredCopySource.length > 0
      && /CONDITIONING_EMPHASISED_LABELS[\s\S]*Work[\s\S]*Recovery[\s\S]*Rounds[\s\S]*Reps[\s\S]*Blocks[\s\S]*Intensity/.test(screen)
      && /styles\.conditioningPrescriptionLabel/.test(structuredCopySource),
    structuredCopySource,
  );
  ok(
    'both standalone and choice conditioning rows use the shared structured-copy renderer',
    (screen.match(/<ConditioningPrescriptionCopy\b/g) ?? []).length === 2,
    `${(screen.match(/<ConditioningPrescriptionCopy\b/g) ?? []).length} mount(s)`,
  );
  ok(
    'conditioning prescription lines keep readable vertical breathing room in both row paths',
    /conditioningPhaseBody:\s*\{[\s\S]*?lineHeight:\s*23\b/.test(screen)
      && /conditioningRowNotes:\s*\{[\s\S]*?lineHeight:\s*20\b/.test(screen),
  );
  ok(
    'the conditioning title and prescription keep a small visual gap',
    /conditioningPhaseBody:\s*\{[\s\S]*?marginTop:\s*5\b/.test(screen)
      && /conditioningRowNotes:\s*\{[\s\S]*?marginTop:\s*5\b/.test(screen),
  );

  ok(
    'the per-row "Optional" marker is gone from the add-on row',
    !/styles\.optionalMarker/.test(screen),
    'AddonRow must not print its own Optional eyebrow — one group header owns that meaning',
  );
  ok(
    'the recovery branch no longer prints a per-card "Optional" pill',
    !/styles\.recoveryAddonPill/.test(screen),
    'the add-on card pill is a per-row OPTIONAL label by another name',
  );
  ok(
    'one shared header component carries the words',
    /OptionalWorkHeader/.test(screen),
  );
  // Comments stripped: the point is what the athlete READS, and the prose above
  // these components necessarily names the box the ruling retired.
  const code = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok(
    'the header reads "Optional work", and the old section label is gone',
    /Optional work/.test(code) && !/Optional Recovery Add-on/.test(code),
    'the recovery branch keeps its own template but shares the one header',
  );
}

// ── A3: ONE APPROVED REP TARGET, NOT A RANGE ──────────────────────────────
//
// Sam's prescription-display law, Bible :770: ranges remain the generation
// source, while the athlete and assume-prescribed logging use one approved rep
// target. His example remains "3x8-12 is written as 3x10".
//
// The renderer showed the RANGE, so the athlete picked a number themselves —
// the exact ambiguity the law exists to end — while the journal scored their
// load against a midpoint they were never shown. Census A3, found independently
// by two auditors.
{
  const ex = (min: number, max: number, sets = 3) =>
    formatStrengthSetsReps({ prescribedSets: sets, prescribedRepsMin: min, prescribedRepsMax: max });

  ok('a rep RANGE is shown as one approved target (Bible :770)',
    ex(8, 12) === '3 × 10',
    `his own example reads "${ex(8, 12)}", not "3 × 10"`);

  ok('the approved rep vocabulary is exactly Sam\'s eight values',
    JSON.stringify(APPROVED_REP_TARGETS) === JSON.stringify([3, 4, 5, 6, 8, 10, 15, 20]),
    JSON.stringify(APPROVED_REP_TARGETS));

  ok('arbitrary midpoints snap to approved targets, with equal distances going lower',
    ex(6, 8) === '3 × 6'
    && ex(8, 10) === '3 × 8'
    && ex(10, 12) === '3 × 10'
    && ex(15, 20) === '3 × 15',
    JSON.stringify([ex(6, 8), ex(8, 10), ex(10, 12), ex(15, 20)]));

  ok('a fixed prescription is unchanged — nothing to collapse',
    ex(6, 6, 4) === '4 × 6', ex(6, 6, 4));

  ok('every rep range resolves to the approved vocabulary',
    ([[8, 11], [5, 8], [10, 15], [3, 4], [11, 11], [18, 18]] as Array<[number, number]>).every(([a, b]) => {
      const n = displayReps(a, b);
      return n !== null && (APPROVED_REP_TARGETS as readonly number[]).includes(n);
    }));

  ok('assumed-completion workload uses the same rep target the athlete reads',
    liftTonnageKg({
      exerciseId: 'ex-curl', workoutExerciseId: 'we-curl', exerciseName: 'Hammer Curl',
      prescribedSets: 3, prescribedRepsMin: 10, prescribedRepsMax: 12,
      weightKg: 20, completion: 'full',
    }) === 3 * 10 * 20);

  ok('timed prescriptions retain their authored range',
    formatConditioningRowPrescription({
      prescriptionType: 'duration', prescribedSets: 1,
      prescribedRepsMin: 30, prescribedRepsMax: 60,
    }) === '30-60 sec');
}

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
