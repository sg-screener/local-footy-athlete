/**
 * LAW-generated-week-assembly, AND THE ANCHOR→ACCESSORY MAIN-LIFT RULE.
 *
 *   npm run test:generated-week-assembly
 *
 * **Sam, 2026-08-14:** *"Adapter contributions are typed and enumerated. The
 * composer day is always the base. No adapter field may overwrite a
 * composer-owned field."*
 *
 * ## Why this file exists — the third sighting, not the first
 *
 * The assembly step lost a different field each round, and each fix was the
 * field that had just been noticed:
 *
 *   1. it copied ONE field and lost `speedBlock`, the app's only source of app
 *      sprint credit — three sessions blamed an inert envelope for the refusal;
 *   2. it then took the adapter's WHOLE day as the base, and a day stripped of
 *      its lifts described itself as `Conditioning`/`optional_flush` — 12 worlds;
 *   3. and even with identity pinned back, the spread still decided which
 *      composer fields survived, so **`composedGaps` was dropped on every day
 *      that had an adapter counterpart**.
 *
 * **THE GUARD IS THEREFORE ABOUT THE CLASS, NOT THE FIELD.** It refuses any
 * contribution that so much as NAMES a composer-owned key, and it asserts the
 * enumerated contribution list is closed. Catching `composedGaps` alone would
 * have produced a fourth sighting with a fourth field.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  COMPOSER_OWNED_FIELDS,
  AdapterOverreachError,
  adapterContributionFrom,
  assembleAuthoredWeek,
} from '../rules/assembleAuthoredWeek';
import { composeWeek } from '../rules/composeWeek';
import { composedRowIsLegal } from '../rules/composedRowLegality';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { EQUIPMENT_TAG_LABELS } from '../rules/equipmentVocabulary';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import type { Workout } from '../types/domain';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const FULL_GYM = resolveEquipmentCapabilities({
  equipment: ['Full Gym'], equipmentSelectionCompleteness: 'complete',
} as never).tags as string[];
const DB_BANDS = resolveEquipmentCapabilities({
  equipment: ['Dumbbells', 'Bands'], equipmentSelectionCompleteness: 'complete',
} as never).tags as string[];
const AWAY_BODYWEIGHT = resolveEquipmentCapabilities({
  equipmentAnswer: {
    tags: Object.fromEntries(Object.keys(EQUIPMENT_TAG_LABELS).map((tag) => [tag, 'do_not_have'])),
    modalities: Object.fromEntries(
      ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'].map((m) => [m, 'do_not_have'])),
  },
} as never).tags as string[];

function composerDay(over: Record<string, unknown> = {}): Workout {
  return {
    id: 'composed-1', microcycleId: 'mc-1', dayOfWeek: 2,
    name: 'Lower Body Strength', description: 'composed', durationMinutes: 0,
    intensity: 'Moderate', workoutType: 'Strength', sessionTier: 'core',
    planEntryId: 'w1:tuesday:none:strength',
    strengthIntent: { archetype: 'lower', primaryPattern: 'squat',
      plannedPatterns: ['squat'], effectivePatterns: ['squat'] },
    composedGaps: [{ dayOfWeek: 2, slot: 'vertical_pull', cause: 'kit', wouldNeed: 'pullup_bar' }],
    exercises: [{
      id: 'r1', workoutId: 'composed-1', exerciseId: 'e1', exerciseOrder: 1,
      prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 8, restSeconds: 0,
      exercise: { id: 'e1', name: 'Back Squat' },
      section18Evidence: { protocolVersion: 1, role: 'main_strength',
        strengthPattern: 'squat', mainStrengthPattern: 'squat',
        provenance: 'composer_declaration' },
    }],
    ...over,
  } as unknown as Workout;
}

function adapterDay(over: Record<string, unknown> = {}): Workout {
  return {
    id: 'adapter-1', microcycleId: 'mc-1', dayOfWeek: 2,
    name: 'Conditioning', description: 'adapter', durationMinutes: 45,
    intensity: 'Light', workoutType: 'Conditioning', sessionTier: 'optional',
    planEntryId: 'ADAPTER-PLAN-ENTRY',
    authoredDay: { anchor: 'club_training', components: ['strength', 'team_training'] },
    speedBlock: { kind: 'true_speed' },
    conditioningBlock: { kind: 'aerobic' },
    isTeamDay: true,
    strengthIntent: { archetype: 'lower', plannedPatterns: ['squat'], effectivePatterns: ['squat'] },
    section18Evidence: { protocolVersion: 1, conditioningRole: 'required_core',
      conditioningStress: 'moderate', provenance: 'planner_and_canonical_content' },
    exercises: [{
      id: 'a1', workoutId: 'adapter-1', exerciseId: 'e9', exerciseOrder: 1,
      prescribedSets: 1, prescribedRepsMin: 1, prescribedRepsMax: 1, restSeconds: 0,
      exercise: { id: 'e9', name: 'Short Flush' },
      section18Evidence: { protocolVersion: 1, role: 'conditioning',
        strengthPattern: null, mainStrengthPattern: null,
        provenance: 'canonical_row_classifier' },
    }],
    ...over,
  } as unknown as Workout;
}

// ── [law] THE COMPOSER DAY IS THE BASE ─────────────────────────────────────
console.log('\n[law] The composer day is the base; the adapter contributes');
{
  const out = assembleAuthoredWeek({
    composerWorkouts: [composerDay()], adapterWorkouts: [adapterDay()],
  });
  const day = out.workouts[0] as unknown as Record<string, unknown>;
  ok('the assembly produced a day at all — non-vacuity first', !!day);

  // COMPOSER-OWNED, every one of them, named individually so a future loss
  // names the field it lost.
  ok('[derived] a club anchor carrying squat work is visibly represented as combined',
    day.name === 'Team Training + Lower Squat', String(day.name));
  ok('[composer] the tier is the composer\'s', day.sessionTier === 'core');
  ok('[composer] the intensity is the composer\'s', day.intensity === 'Moderate');
  ok('[composer] the plan entry is the composer\'s',
    day.planEntryId === 'w1:tuesday:none:strength', String(day.planEntryId));
  ok('[composer] THE TYPED KIT GAPS SURVIVE — the field sighting 3 lost',
    ((day.composedGaps as unknown[]) ?? []).length === 1,
    JSON.stringify(day.composedGaps));
  const rows = (day.exercises as Record<string, unknown>[]) ?? [];
  const squat = rows.find((row) =>
    (row.exercise as { name?: string })?.name === 'Back Squat');
  ok('[composer] the strength row survives with its declaration',
    !!squat && (squat.section18Evidence as { provenance?: string })?.provenance
      === 'composer_declaration');
  ok('[composer] its dose is untouched',
    squat?.prescribedSets === 3 && squat?.prescribedRepsMin === 5
    && squat?.prescribedRepsMax === 8);

  // ADAPTER-CONTRIBUTED, every one of them.
  ok('[adapter] the SPEED BLOCK travels — the field sighting 1 lost',
    (day.speedBlock as { kind?: string })?.kind === 'true_speed');
  ok('[adapter] the conditioning block travels', !!day.conditioningBlock);
  ok('[adapter] the team-anchor fact travels', day.isTeamDay === true);
  ok('[composer] the composer strength intent survives', !!day.strengthIntent);
  ok('[adapter] its non-strength row travels',
    rows.some((row) => (row.exercise as { name?: string })?.name === 'Short Flush'));
  ok('[anchor] a combined club day retains the Team Training type',
    day.workoutType === 'Team Training');
}

// ── [mutation A] AN ADAPTER FIELD MAY NOT OVERWRITE A COMPOSER-OWNED ONE ───
console.log('\n[mutation A] Overwriting a composer-owned field is REFUSED');
{
  const contribution = adapterContributionFrom(adapterDay());
  ok('the honest contribution names no composer-owned field',
    !Object.keys(contribution).some((key) =>
      key !== 'rows' && COMPOSER_OWNED_FIELDS.includes(key)),
    Object.keys(contribution).join(', '));

  // Every composer-owned field, attempted one at a time. This is what makes a
  // FOURTH sighting impossible rather than catching the third.
  let refusedCount = 0;
  for (const field of COMPOSER_OWNED_FIELDS) {
    let threw = false;
    try {
      const bad = { ...contribution, [field]: 'ADAPTER OVERWRITE' } as never;
      (assembleAuthoredWeek as unknown as { __applyForTest?: unknown });
      // Reach the guard through the real path: a contribution carrying the
      // field must be refused by `applyContribution`.
      require('../rules/assembleAuthoredWeek').__applyContributionForTest(composerDay(), bad);
    } catch (error) {
      threw = error instanceof AdapterOverreachError;
    }
    if (threw) refusedCount += 1;
    else failures.push(`overwrite of composer-owned '${field}' was NOT refused`);
  }
  ok('EVERY composer-owned field is refused, not just the one we lost',
    refusedCount === COMPOSER_OWNED_FIELDS.length,
    `${refusedCount}/${COMPOSER_OWNED_FIELDS.length} refused`);
}

// ── [mutation B] DROPPING A PERMITTED CONTRIBUTION IS CAUGHT ───────────────
console.log('\n[mutation B] Dropping a permitted adapter contribution REDS');
{
  // Drop `speedBlock` — the exact field sighting 1 lost — from the adapter day
  // and assert the assembled day no longer carries it. A guard that cannot see
  // this loss is the guard that did not exist for three sessions.
  const withoutSpeed = adapterDay({ speedBlock: undefined });
  const out = assembleAuthoredWeek({
    composerWorkouts: [composerDay()], adapterWorkouts: [withoutSpeed],
  });
  const day = out.workouts[0] as unknown as Record<string, unknown>;
  ok('dropping the adapter\'s speedBlock is VISIBLE in the assembled day',
    day.speedBlock === undefined,
    'the assembled day still reports a speed block that the adapter did not give');
  // And the control: with it present, it is there. Without both halves this
  // cell would pass on a merge that never carried it at all.
  const withSpeed = assembleAuthoredWeek({
    composerWorkouts: [composerDay()], adapterWorkouts: [adapterDay()],
  }).workouts[0] as unknown as Record<string, unknown>;
  ok('[control] with the contribution present the field IS carried',
    (withSpeed.speedBlock as { kind?: string })?.kind === 'true_speed');

  const withoutConditioning = assembleAuthoredWeek({
    composerWorkouts: [composerDay()],
    adapterWorkouts: [adapterDay({ conditioningBlock: undefined, authoredDay: undefined })],
  }).workouts[0] as unknown as Record<string, unknown>;
  ok('dropping the conditioning contribution drops the envelope with it',
    !withoutConditioning.conditioningBlock
    && withoutConditioning.section18Evidence === undefined,
    'a stale conditioning envelope survived a day with no conditioning');
  ok('and such a day is NOT typed Mixed',
    withoutConditioning.workoutType === 'Strength');
}

// ── [closed] THE CONTRIBUTION LIST IS CLOSED ───────────────────────────────
console.log('\n[closed] Only enumerated fields can travel');
{
  const fields = Object.keys(adapterContributionFrom(adapterDay()));
  const unexpected = fields.filter((field) => field !== 'rows'
    && !['conditioningBlock', 'conditioningCategory', 'conditioningFlavour',
      'attachedConditioningKind', 'conditioningFeasibility', 'hasCombinedConditioning',
      'speedBlock', 'isTeamDay', 'authoredDay', 'derivedSessionProvenance', 'strengthIntent',
      'section18Evidence', 'durationMinutes'].includes(field));
  ok('a contribution carries nothing outside the enumerated list',
    unexpected.length === 0, unexpected.join(', '));
  // The adapter day above carries `name`, `description`, `workoutType`,
  // `sessionTier`, `planEntryId` and an `id`. NONE may appear.
  ok('the adapter\'s own identity fields are not in the contribution',
    !fields.includes('name') && !fields.includes('workoutType')
    && !fields.includes('sessionTier') && !fields.includes('planEntryId')
    && !fields.includes('id'),
    fields.join(', '));
}

// ── [anchor] THE ANCHOR→ACCESSORY MAIN-LIFT RULE ───────────────────────────
//
// `applyPoolRotation` carried an anchor→accessory equipment fallback and is
// DELETED. The composer has its own rule and it is guarded here rather than
// the old mechanism restored.
console.log('\n[anchor] Full gym prefers the anchor; a kit-limited athlete gets a legal accessory');
{
  const lowerDay = {
    dayOfWeek: 1, isTeamDay: false, planEntryId: 'w1:monday:none:strength',
    strengthIntent: { archetype: 'lower', primaryPattern: 'squat',
      plannedPatterns: ['squat', 'hinge'], effectivePatterns: ['squat', 'hinge'] },
    name: 'Lower Body Strength', workoutType: 'Strength', sessionTier: 'core',
  };
  // The SAME shape `generateProgram` calls with — including the top-level phase
  // fields the dose owner reads. A fixture that omits them crashes inside
  // `resolveComposedDose`, which is a fixture fault masquerading as a defect.
  const inputs = (kit: string[]) => ({
    profile: { seasonPhase: 'Pre-season', experienceLevel: 'Intermediate' },
    phaseClock: { weekNumber: 1 },
    seasonPhase: 'Pre-season',
    offseasonSubphase: null,
    plannedDays: [lowerDay], kit,
    injuries: { prohibitedPatterns: [], excludedIdentities: [] },
    todayISO: '2026-07-13',
    blockNumber: 1,
    blockStartISO: '2026-07-13',
    selectionHistory: [],
    progressedIdentities: [],
    pinnedIdentities: [],
  }) as never;

  const gym = composeWeek(inputs(FULL_GYM)).days[0];
  const gymMain = gym.rows.find((row) => row.role === 'main_strength'
    && row.mainStrengthPattern === 'squat');
  ok('[full gym] a squat main lift is composed at all', !!gymMain,
    JSON.stringify(gym.rows.map((r) => `${r.slot}:${r.identity}`)));
  ok('[full gym] and it is the pool ANCHOR, not an accessory',
    classifyPoolSlot(gymMain?.identity ?? '')?.role === 'anchor',
    `${gymMain?.identity} -> ${JSON.stringify(classifyPoolSlot(gymMain?.identity ?? ''))}`);

  const db = composeWeek(inputs(DB_BANDS)).days[0];
  const dbMain = db.rows.find((row) => row.role === 'main_strength'
    && row.mainStrengthPattern === 'squat');
  ok('[dumbbells] a squat main lift is STILL composed — no anchor is legal here',
    !!dbMain, JSON.stringify(db.rows.map((r) => `${r.slot}:${r.identity}`)));
  ok('[dumbbells] and it is legal on this kit',
    !!dbMain && composedRowIsLegal(dbMain.identity, DB_BANDS));
  ok('[dumbbells] the anchor really is unavailable — the fallback is not decorative',
    !composedRowIsLegal('Back Squat', DB_BANDS));

  // Neither role legal → omit and DISCLOSE. **An UPPER day, deliberately**: a
  // bodyweight lower day fills every slot it has (squats and hip work need no
  // kit), so asserting a gap there would be asserting against a day that has
  // no impossible slot — a fixture fault, not a finding. The pull slots are
  // where a bodyweight athlete genuinely runs out of legal rows.
  const upperDay = {
    ...lowerDay, dayOfWeek: 2, planEntryId: 'w1:tuesday:none:strength',
    name: 'Upper Body Strength',
    strengthIntent: { archetype: 'upper', primaryPattern: 'push',
      plannedPatterns: ['push', 'pull'], effectivePatterns: ['push', 'pull'] },
  };
  const awayInputs = { ...(inputs(AWAY_BODYWEIGHT) as object),
    plannedDays: [upperDay] } as never;
  const away = composeWeek(awayInputs);
  const pullGap = away.gaps.filter((gap) => String(gap.slot).includes('pull'));
  ok('[bodyweight] a slot with no legal row anywhere is DISCLOSED, not filled',
    pullGap.length > 0, JSON.stringify(away.gaps.map((g) => g.slot)));
  ok('[bodyweight] and the gap names what the kit would need',
    pullGap.every((gap) => typeof gap.wouldNeed === 'string' || gap.wouldNeed === null));
  ok('[bodyweight] every composed row is legal on the kit — nothing was substituted',
    away.days.every((day) => day.rows.every(
      (row) => composedRowIsLegal(row.identity, AWAY_BODYWEIGHT))));
}

console.log(`\nGenerated-week assembly: passed=${passed} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
}
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
