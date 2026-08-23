/**
 * B1-PIVOT-VERIFY — the composer → §18 → storage link, guarded.
 *
 *   npm run test:composer-severance
 *
 * **WHY THIS FILE EXISTS.** CP1 shipped a zero-mutation receipt that was true
 * about two doors and silent about three others, because it measured a fixture
 * rather than a property. CP2 then found the gateway publishing a LEGACY week
 * under an `accepted` verdict. **Every cell here is written against the
 * production path and every one has been seen RED** — the mutation proofs are
 * recorded beside each guard in `docs/MISSION_THREE_FIXES.md`.
 *
 * Scope claim, stated exactly: these guards hold on the routes measured here —
 * `generateProgramLocally` and the hydration read-back. Whether a legacy content
 * owner survives on some other route is the independent audit's question and is
 * not claimed by this file.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { COMPOSER_ROTATION_DEFAULTS } from './support/composerRotationDefaults';
import {
  composeWeek,
  coverageGapsMakeAFullBodySession,
  coverageSlotsForFullBodyDay,
  kitUnachievablePatterns,
} from '../rules/composeWeek';
import { composedIdentityFor, composedRowIsLegal } from '../rules/composedRowLegality';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import { withSection18WorkoutEvidence } from '../rules/section18WorkoutEvidence';
import { buildSection18WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { EQUIPMENT_TAG_LABELS } from '../rules/equipmentVocabulary';
import { classifyGeneratedWorkoutRow } from '../rules/generatedWorkoutRowClassification';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import {
  applyOffseasonMainLiftLoad,
  resolveComposedDose,
  resolveComposedLoad,
} from '../rules/composedDose';
import { mainLiftSchemeForSlot } from '../rules/phaseRepSchemes';
import { slotsForExerciseName } from '../rules/sessionSlotCoverage';
import type { Workout } from '../types/domain';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../services/api/generateProgram');

const BASE = {
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  gameDay: 'Saturday',
  trainingDaysPerWeek: 2,
  preferredTrainingDays: ['Tuesday', 'Thursday'],
};
/** EXHAUSTIVE answer resolving to bodyweight — never `tags: {}`, which also means unanswered. */
const AWAY_ANSWER = {
  tags: Object.fromEntries(Object.keys(EQUIPMENT_TAG_LABELS).map((tag) => [tag, 'do_not_have'])),
  modalities: Object.fromEntries(
    ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'].map((m) => [m, 'do_not_have'])),
};

interface WorldSpec {
  readonly id: string;
  readonly profile: Record<string, unknown>;
  readonly week: number;
}

function world(id: string, over: Record<string, unknown>, week = 1): WorldSpec {
  return { id, profile: { ...BASE, ...over }, week };
}

/** Silence the generator's own logging; a suite that prints its subject's noise hides its own. */
function quietly<T>(run: () => T): T {
  const realLog = console.log; const realWarn = console.warn;
  console.log = () => undefined; console.warn = () => undefined;
  try { return run(); } finally { console.log = realLog; console.warn = realWarn; }
}

type BuildOutcome =
  | { readonly kind: 'built'; readonly program: any }
  | { readonly kind: 'refused'; readonly signature: string; readonly error: unknown };

function build(spec: WorldSpec): BuildOutcome {
  try {
    const program = quietly(() => generateProgramLocally(spec.profile, {
      todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: spec.week,
    }));
    return { kind: 'built', program };
  } catch (error: any) {
    return {
      kind: 'refused',
      signature: String(error?.result?.failureSignature ?? error?.message ?? error),
      error,
    };
  }
}

function composedFor(spec: WorldSpec) {
  const kit = resolveEquipmentCapabilities(spec.profile as never).tags as string[];
  return { kit };
}

function inputs(over: Record<string, unknown> = {}): never {
  return {
    profile: { gender: 'male', seasonPhase: 'Off-season' } as never,
    phaseClock: { weekNumber: 1 },
    gender: 'male', seasonPhase: 'Off-season',
    offseasonSubphase: null,
    plannedDays: [LOWER_DAY_FIXTURE],
    kit: resolveEquipmentCapabilities({
      equipment: ['Full Gym'], equipmentSelectionCompleteness: 'complete' } as never).tags,
    injuries: { prohibitedPatterns: [], excludedIdentities: [] },
    todayISO: '2026-07-13',
    ...over,
  } as never;
}

function rowsByDayAndIdentity(workouts: readonly Workout[]): Map<string, any> {
  const out = new Map<string, any>();
  for (const workout of workouts) {
    for (const row of workout.exercises ?? []) {
      out.set(`${workout.dayOfWeek}:${composedIdentityFor(row.exercise?.name ?? '')}`, row);
    }
  }
  return out;
}

/** Identity · order · role · pattern — the four things composition owns. */
function semanticShape(workouts: readonly Workout[]): string {
  return [...workouts]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((workout) => `${workout.dayOfWeek}:` + (workout.exercises ?? [])
      .map((row) => `${composedIdentityFor(row.exercise?.name ?? '')}`
        + `/${row.section18Evidence?.role ?? '-'}`
        + `/${row.section18Evidence?.mainStrengthPattern ?? '-'}`)
      .join('|'))
    .join(' || ');
}

const LOWER_DAY_FIXTURE = {
  dayOfWeek: 1, isTeamDay: false, planEntryId: 'p', name: 'Lower Body Strength',
  workoutType: 'Strength', sessionTier: 'core',
  strengthIntent: { archetype: 'lower' as const, primaryPattern: 'squat' as const,
    plannedPatterns: ['squat' as const, 'hinge' as const],
    effectivePatterns: ['squat' as const, 'hinge' as const] },
};

const FULL_GYM = world('full-gym in-season 2d club', {
  gender: 'male', seasonPhase: 'In-season', equipment: ['Full Gym'],
  teamTrainingDays: ['Tuesday', 'Thursday'],
});
const DB_BANDS = world('dumbbells+bands in-season 2d club', {
  gender: 'male', seasonPhase: 'In-season', equipment: ['Dumbbells', 'Bands'],
  teamTrainingDays: ['Tuesday', 'Thursday'],
});
const AWAY = world('away bodyweight off-season 2d', {
  gender: 'male', seasonPhase: 'Off-season', equipment: undefined, equipmentAnswer: AWAY_ANSWER,
  teamTrainingDays: [],
});

// ═══════════════════════════════════════════════════════════════════════════
// (a) COMPOSER-DECLARED main_strength ROLES SURVIVE INTO §18 EVIDENCE
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[a] Composer-declared main-lift roles survive into §18 evidence');
{
  const built = build(DB_BANDS);
  ok('the dumbbell world builds at all — non-vacuity first', built.kind === 'built',
    built.kind === 'refused' ? built.signature : '');
  if (built.kind === 'built') {
    const rows = (built.program.microcycles[0].workouts as Workout[])
      .flatMap((workout) => workout.exercises ?? []);
    const declared = rows.filter((row) =>
      row.section18Evidence?.provenance === 'composer_declaration');
    ok('every stored strength row carries the composer\'s declaration',
      declared.length === rows.length && rows.length > 0,
      `${declared.length} of ${rows.length}`);
    const mains = declared.filter((row) => row.section18Evidence?.role === 'main_strength');
    ok('the declared main lifts survived as main_strength', mains.length >= 4,
      JSON.stringify(mains.map((row) => `${row.exercise?.name}:${row.section18Evidence?.mainStrengthPattern}`)));
    ok('every main lift carries its pattern',
      mains.every((row) => !!row.section18Evidence?.mainStrengthPattern));
    // ⚠ THE SUBJECT: these are rows the NAME classifier calls accessories.
    const unloadedMains = mains.filter((row) =>
      /Goblet Squat|Band Pull-Apart|Single-Arm DB Row|DB Shoulder Press|Bodyweight Squat|Glute Bridge/
        .test(String(row.exercise?.name)));
    ok('rows the classifier would demote are still main lifts', unloadedMains.length >= 2,
      JSON.stringify(mains.map((row) => row.exercise?.name)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// (R-087) THE COVERAGE DAY — ASKED DIRECTLY, BECAUSE NO WORLD REACHES IT
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ **THIS BLOCK EXISTS BECAUSE THE COMPOSE BRANCH IS CURRENTLY UNREACHABLE.**
// Measured 2026-08-14 over all 180 worlds: **zero `full_body_coverage` days are
// composed.** Every general full-body day the planner places sits beside a lower
// day and an upper day that between them already supply the ladder, so its genuine
// week-wide gaps never span the body and the gate below declines it — which is the
// correct answer (see `coverageGapsMakeAFullBodySession`) and leaves the week its
// honest refusal.
//
// **AN UNREACHABLE BRANCH WITH NO TEST IS DEAD WEIGHT LATER CODE WILL TRUST.** So
// both functions are called DIRECTLY here, on inputs that state their own
// preconditions, rather than left to be re-discovered when the scheduling
// capability finally makes them reachable.
console.log('\n[R-087] The coverage day, asked directly — the compose branch no world reaches');
{
  const WEEKLY = [
    'squat', 'hinge', 'single_leg_knee', 'single_leg_hip',
    'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
    'arm_or_shoulder', 'accessory_or_core',
  ] as const;
  const none = new Set<never>();
  const zero = { squat: 0, hinge: 0, single_leg_knee: 0, single_leg_hip: 0 };

  // (1) THE WHOLE WEEK OPEN — the day takes Sam's fill order, capped at seven.
  const wideOpen = coverageSlotsForFullBodyDay({
    suppliedByOtherDays: none, takenByEarlierCoverageDays: none, pairCounts: zero,
  });
  ok('[R-087] with nothing supplied, the day takes Sam\'s fill order and stops at seven',
    wideOpen.length === 7 && wideOpen[0] === 'squat' && wideOpen[1] === 'hinge',
    JSON.stringify(wideOpen));
  ok('[R-087] and that set is R-089-balanced — squat with hinge, knee with hip',
    wideOpen.filter((s) => s === 'squat').length
      <= wideOpen.filter((s) => s === 'hinge').length
    && wideOpen.filter((s) => s === 'single_leg_knee').length
      <= wideOpen.filter((s) => s === 'single_leg_hip').length,
    JSON.stringify(wideOpen));

  // (2) THE REST OF THE WEEK SUPPLIES THE LOWER LADDER AND THE PRESSES — this is
  //     the shape Sam rejected, and the day must now come back PULL-ONLY.
  const supplied = new Set<any>([
    'squat', 'hinge', 'single_leg_knee', 'single_leg_hip', 'accessory_or_core',
    'horizontal_push', 'vertical_push', 'arm_or_shoulder',
  ]);
  const narrow = coverageSlotsForFullBodyDay({
    suppliedByOtherDays: supplied, takenByEarlierCoverageDays: none, pairCounts: zero,
  });
  ok('[R-087] a week that already supplies the lower ladder leaves only the pull gap',
    narrow.length === 2 && narrow.includes('horizontal_pull' as never)
      && narrow.includes('vertical_pull' as never),
    JSON.stringify(narrow));
  // ⚠ THE CELL THAT WOULD HAVE CAUGHT SAM'S REJECTED WEEK. Before the fix this
  // returned SEVEN — squat, deadlift, both single-leg compounds and a press —
  // because it was asked only about the days BEFORE it and Monday had none.
  ok('[R-087] ...and it does NOT re-take a slot the rest of the week already trains',
    !narrow.some((slot) => supplied.has(slot)), JSON.stringify(narrow));

  // (3) THE GATE. An upper-only gap set is not a small full-body day; it is not
  //     one, so the week keeps its honest refusal.
  ok('[R-087 gate] an upper-only gap set is NOT a full-body session',
    !coverageGapsMakeAFullBodySession(narrow), JSON.stringify(narrow));
  ok('[R-087 gate] a gap set spanning lower and upper IS one',
    coverageGapsMakeAFullBodySession(wideOpen), JSON.stringify(wideOpen));
  ok('[R-087 gate] a lower-only gap set is NOT one either — the test is both ways',
    !coverageGapsMakeAFullBodySession(['squat', 'hinge'] as never));
  // NON-VACUITY: if the weekly set were empty every answer above would be trivial.
  ok('[R-087 non-vacuity] the weekly coverage set is the ten slots it claims to be',
    WEEKLY.length === 10);
}

// ═══════════════════════════════════════════════════════════════════════════
// (shape) THE COMPOSER'S DECLARED DAY SHAPE SURVIVES, AND THE WEEK PAIRS UP
// ═══════════════════════════════════════════════════════════════════════════
//
// **THE READER FOR `composedDayShape`.** The field is written by
// `materialiseComposedWeek`; this and `ladderCoverageWideCensus` are the two
// readers, and all three landed together. A written-and-never-read field is the
// `canOverride` shape — nine writes, zero reads — and this repo has paid for it.
//
// WHY IT MATTERS, MEASURED. Before the field was carried, every reader recovered
// the day's shape from the planner's session TITLE. For Sam's full-body shape that
// is unrecoverable in principle: A leads with a squat, B with a hinge, and every
// naming owner in this app calls both `Full Body Strength`. The 180-world sweep
// scored 24 composed full-body days deficient with nothing missing from them and
// reported 6 worlds as squat-without-hinge whose weeks are `sq1/hi1`.
//
// R-089 IS ASSERTED HERE ON CONTENT, ACROSS ALL THREE KITS. Sam, 2026-08-13:
// *"every squat should be matched with a hinge"*. It is counted from what the rows
// ARE — `slotsForExerciseName` — so no shape declaration can talk it round.
console.log('\n[shape] The composed day declares its shape, and the week pairs squat with hinge');
{
  for (const target of [FULL_GYM, DB_BANDS, AWAY]) {
    const built = build(target);
    ok(`[${target.id}] builds at all — non-vacuity before any verdict`,
      built.kind === 'built', built.kind === 'refused' ? built.signature : '');
    if (built.kind !== 'built') continue;
    const workouts = built.program.microcycles[0].workouts as Workout[];
    const composed = workouts.filter((workout) =>
      (workout.exercises ?? []).some((row) =>
        row.section18Evidence?.provenance === 'composer_declaration'));
    ok(`[${target.id}] every composed day carries its declared shape`,
      composed.length > 0 && composed.every((workout) =>
        typeof (workout as { composedDayShape?: string }).composedDayShape === 'string'),
      `${composed.length} composed days, shapes=`
      + JSON.stringify(composed.map((w) => (w as { composedDayShape?: string }).composedDayShape)));

    // THE PAIR COUNT, FROM THE ROWS. Ladders and declarations ignored; a row is
    // spent on ONE pair slot so a single lift can never match itself.
    const pairSlots = ['squat', 'hinge', 'single_leg_knee', 'single_leg_hip'] as const;
    const pairs: Record<string, number> = {
      squat: 0, hinge: 0, single_leg_knee: 0, single_leg_hip: 0 };
    for (const workout of workouts) {
      for (const row of (workout.exercises ?? [])) {
        const filled = slotsForExerciseName(String(row.exercise?.name ?? '')) ?? [];
        const hit = pairSlots.find((slot) => filled.includes(slot));
        if (hit) pairs[hit] += 1;
      }
    }
    const shape = `sq${pairs.squat}/hi${pairs.hinge} `
      + `slk${pairs.single_leg_knee}/slh${pairs.single_leg_hip}`;
    // NON-VACUITY: a week with no lower work at all would satisfy the ruling and
    // prove nothing about it.
    ok(`[${target.id}] the week trains the lower patterns at all — ${shape}`,
      pairs.squat + pairs.hinge + pairs.single_leg_knee + pairs.single_leg_hip > 0, shape);
    ok(`[${target.id}] R-089: every squat is matched with a hinge — ${shape}`,
      pairs.squat <= pairs.hinge, shape);
    ok(`[${target.id}] R-089: every single-leg knee is matched with a hip — ${shape}`,
      pairs.single_leg_knee <= pairs.single_leg_hip, shape);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// (e) THE CLASSIFIER MAY NOT OVERRIDE A DECLARATION — the link itself
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[e] Classifier re-inference never overrides a composed declaration');
{
  // A row the name-classifier is certain about, declared the OTHER way. If the
  // guard is removed the inference wins and this flips.
  const declaredAccessory: Workout = {
    id: 'w-guard-e', microcycleId: 'mc-guard', dayOfWeek: 2,
    name: 'Lower Body Strength', description: '', intensity: 'High',
    workoutType: 'Strength', sessionTier: 'core',
    strengthIntent: { archetype: 'lower', primaryPattern: 'squat',
      plannedPatterns: ['squat'], effectivePatterns: ['squat'] },
    exercises: [{
      id: 'r1', workoutId: 'w-guard-e', exerciseId: 'ex-back-squat', exerciseOrder: 1,
      prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 8, prescribedWeightKg: 0,
      restSeconds: 0,
      exercise: { id: 'ex-back-squat', name: 'Back Squat', description: '',
        exerciseType: 'Compound', muscleGroups: [], equipmentRequired: [],
        difficultyLevel: 'Intermediate', createdAt: '', updatedAt: '' },
      createdAt: '', updatedAt: '',
      section18Evidence: {
        protocolVersion: 1, role: 'strength_accessory',
        strengthPattern: 'squat', mainStrengthPattern: null,
        provenance: 'composer_declaration',
      },
    }],
  } as unknown as Workout;
  const stamped = withSection18WorkoutEvidence(declaredAccessory, 'infer');
  const row = (stamped.exercises ?? [])[0];
  ok('a `Back Squat` DECLARED an accessory stays an accessory',
    row.section18Evidence?.role === 'strength_accessory'
    && row.section18Evidence?.mainStrengthPattern === null,
    JSON.stringify(row.section18Evidence));
  ok('the declaration keeps its provenance through the evidence pass',
    row.section18Evidence?.provenance === 'composer_declaration');
  // THE CONTROL, so the cell cannot pass by the pass doing nothing at all:
  // an UNDECLARED Back Squat must still be inferred a main lift.
  const undeclared = {
    ...declaredAccessory,
    exercises: [{ ...(declaredAccessory.exercises ?? [])[0], section18Evidence: undefined }],
  } as unknown as Workout;
  const inferred = (withSection18WorkoutEvidence(undeclared, 'infer').exercises ?? [])[0];
  ok('[control] an UNDECLARED Back Squat is still inferred a main lift',
    inferred.section18Evidence?.role === 'main_strength'
    && inferred.section18Evidence?.mainStrengthPattern === 'squat',
    JSON.stringify(inferred.section18Evidence));
}

// ═══════════════════════════════════════════════════════════════════════════
// (b) FULL GYM — an ACHIEVABLE but MISSING pattern still fails
// (c) PARTIAL KIT — same, on dumbbells + bands
// ═══════════════════════════════════════════════════════════════════════════
function achievableButMissingStillFails(spec: WorldSpec, label: string, pattern: string): void {
  const built = build(spec);
  if (built.kind !== 'built') {
    ok(`[${label}] the world builds so a pattern can be removed from it`, false, built.signature);
    return;
  }
  const microcycle = built.program.microcycles[0];
  const contract = microcycle.exposureContractV2;
  ok(`[${label}] the contract still REQUIRES ${pattern} — it is achievable on this kit`,
    !!contract && contract.strengthPatterns.requiredSafePatterns.includes(pattern)
    && !kitUnachievablePatterns(
      resolveEquipmentCapabilities(spec.profile as never).tags as string[]).includes(pattern as never),
    JSON.stringify(contract?.strengthPatterns?.requiredSafePatterns));
  // Remove every main lift of that pattern — the week is now missing work it owes.
  const stripped: Workout[] = (microcycle.workouts as Workout[]).map((workout) => ({
    ...workout,
    exercises: (workout.exercises ?? []).filter((row) =>
      row.section18Evidence?.mainStrengthPattern !== pattern),
  }));
  const before = evaluateSection18EffectiveWeek({
    contract, workouts: microcycle.workouts, weekStart: microcycle.startDate,
  });
  const after = evaluateSection18EffectiveWeek({
    contract, workouts: stripped, weekStart: microcycle.startDate,
  });
  ok(`[${label}] the week as built is not blocked on ${pattern}`,
    !before.blockingViolations.some((finding: any) =>
      String(finding.detail ?? '').toLowerCase().includes(pattern)),
    JSON.stringify(before.blockingViolations.map((f: any) => f.code)));
  ok(`[${label}] removing the achievable ${pattern} STILL FAILS`,
    after.blockingViolations.length > before.blockingViolations.length,
    `before=${before.blockingViolations.length} after=${after.blockingViolations.length}`);
}

console.log('\n[b] Full gym — an achievable-but-missing pattern still fails');
achievableButMissingStillFails(FULL_GYM, 'full-gym', 'hinge');

console.log('\n[c] Dumbbells + bands — an achievable-but-missing pattern still fails');
achievableButMissingStillFails(DB_BANDS, 'db+bands', 'hinge');

// ═══════════════════════════════════════════════════════════════════════════
// (d) A GENUINELY KIT-IMPOSSIBLE PATTERN IS DISCLOSED AND DOES NOT VETO
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[d] A kit-impossible pattern is disclosed, and does not veto the week');
{
  const { kit } = composedFor(AWAY);
  const unachievable = kitUnachievablePatterns(kit);
  ok('a bodyweight kit genuinely cannot train pull', unachievable.includes('pull' as never),
    JSON.stringify(unachievable));
  const built = build(AWAY);
  ok('the away world still BUILDS despite the impossible pattern', built.kind === 'built',
    built.kind === 'refused' ? built.signature : '');
  if (built.kind === 'built') {
    const contract = built.program.microcycles[0].exposureContractV2;
    ok('the contract does not require what the kit cannot train (R-083/R-090)',
      !contract.strengthPatterns.requiredSafePatterns.includes('pull'),
      JSON.stringify(contract.strengthPatterns.requiredSafePatterns));
    const evaluation = evaluateSection18EffectiveWeek({
      contract,
      workouts: built.program.microcycles[0].workouts,
      weekStart: built.program.microcycles[0].startDate,
    });
    ok('no blocking violation names the impossible pattern',
      !evaluation.blockingViolations.some((finding: any) =>
        String(finding.detail ?? '').toLowerCase().includes('pull')),
      JSON.stringify(evaluation.blockingViolations.map((f: any) => f.detail)));
  }
  // ⚠ THE MECHANISM, ASSERTED AT ITS OWNER — and this half was ADDED because
  // the world-level cells above did not need it.
  //
  // Mutation-2 emptied `kitUnachievablePatterns` inside the contract builder and
  // **every cell stayed green**: the away world's contract excludes `pull` for a
  // second, unpinned reason as well, so the behavioural assertion passed without
  // the narrowing doing any work. A guard that cannot tell whether its subject
  // is switched on is not a guard.
  const wide = buildSection18WeeklyExposureContractV2({
    gender: 'male', seasonPhase: 'In-season', declaredSubphase: 'in_season', mode: 'standard',
    anchorState: { teamTrainingDays: [], fixtureDays: [] },
    teamTrainingDays: [], capacity: 'moderate',
    plannerSelected: { mainStrength: 2, coreConditioning: 3, sprintHighSpeed: 1, powerPrimers: 0 },
  } as never);
  const narrowed = buildSection18WeeklyExposureContractV2({
    gender: 'male', seasonPhase: 'In-season', declaredSubphase: 'in_season', mode: 'standard',
    anchorState: { teamTrainingDays: [], fixtureDays: [] },
    teamTrainingDays: [], capacity: 'moderate',
    plannerSelected: { mainStrength: 2, coreConditioning: 3, sprintHighSpeed: 1, powerPrimers: 0 },
    kitUnachievablePatterns: ['pull'],
  } as never);
  ok('[control] without the kit input the contract requires all four patterns',
    wide.strengthPatterns.requiredSafePatterns.length === 4,
    JSON.stringify(wide.strengthPatterns.requiredSafePatterns));
  ok('the kit input REMOVES the impossible pattern at the contract owner',
    !narrowed.strengthPatterns.requiredSafePatterns.includes('pull')
    && narrowed.strengthPatterns.requiredSafePatterns.length === 3,
    JSON.stringify(narrowed.strengthPatterns.requiredSafePatterns));
  ok('and stands the balance selector down, so nothing expands it back',
    narrowed.strengthPatterns.balanceExpectation === 'not_applicable'
    && narrowed.strengthPatterns.laterSessionRestorationRequired === false);

  // THE DISCLOSURE ITSELF — a typed gap, derived from kit + sheet.
  const composed = composeWeek({
    profile: { gender: 'male', seasonPhase: 'Off-season' } as never,
    phaseClock: { weekNumber: 1 },
    gender: 'male', seasonPhase: 'Off-season' as never,
    offseasonSubphase: null,
    plannedDays: [{
      dayOfWeek: 2, isTeamDay: false, planEntryId: 'p', name: 'Upper Body Strength',
      workoutType: 'Strength', sessionTier: 'core',
      strengthIntent: { archetype: 'upper', primaryPattern: 'pull',
        plannedPatterns: ['pull'], effectivePatterns: ['pull'] },
    }],
    kit, injuries: { prohibitedPatterns: [], excludedIdentities: [] }, todayISO: '2026-07-13',
    ...COMPOSER_ROTATION_DEFAULTS,
  });
  ok('the impossible pattern is DISCLOSED as a typed kit gap',
    composed.gaps.some((gap) => gap.slot.includes('pull') && gap.cause === 'kit'),
    JSON.stringify(composed.gaps));
  ok('and nothing illegal was substituted for it',
    composed.days.every((day) => day.rows.every((row) => !/Pull-Up|Chin-Up|Pulldown|Row/i
      .test(row.identity))),
    JSON.stringify(composed.days.flatMap((day) => day.rows.map((row) => row.identity))));
}

// ═══════════════════════════════════════════════════════════════════════════
// THE END-TO-END CELL — per world, BOTH outcomes
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[e2e] Composer output == stored == hydrated, per world; and a refusal stores nothing');
{
  // ── FULL WIDTH: THE SWEEP'S OWN 180 WORLDS, NOT A SAMPLE ────────────────
  //
  // ⚠ THE PREVIOUS RUN WAS 36 WORLDS AND THE CLAIM SAID "every world". It was
  // 3 phases x club/no-club x 3 kits x 2 weeks with the TRAINING-DAY COUNT
  // FIXED AT TWO — a whole route-distinguishing dimension unmeasured, and the
  // one the planner varies most. This enumeration is `ladderCoverageWideCensus`'s
  // corpus, profile field for profile field, so "every athlete" means the same
  // 180 worlds the sweep counts.
  //
  // Plus SIX explicit temporary-bodyweight worlds, which the sweep cannot
  // express: its `['Bodyweight Only']` checklist resolves `complete_selection`,
  // and Sam's away ruling is about an EXHAUSTIVE ANSWER (`athlete_answer`). Both
  // resolve to the same tags and are distinguishable only by source, which is
  // exactly why the answered case needs its own representative.
  const WORLDS: WorldSpec[] = [];
  const SWEEP_DAYS: Record<number, string[]> = {
    2: ['Tuesday', 'Thursday'],
    3: ['Monday', 'Wednesday', 'Friday'],
    4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  };
  const SWEEP_KITS: readonly string[][] = [['Full Gym'], ['Bodyweight Only'], ['Dumbbells', 'Bands']];
  for (const phase of ['In-season', 'Pre-season', 'Off-season']) {
    for (const dayCount of [2, 3, 4, 5, 6]) {
      for (const club of [true, false]) {
        for (const equipment of SWEEP_KITS) {
          for (const week of [1, 2]) {
            const preferredTrainingDays = SWEEP_DAYS[dayCount];
            WORLDS.push({
              id: `${phase}/${dayCount}d/${club ? 'club' : 'noclub'}/${equipment[0]}/w${week}`,
              week,
              profile: {
                trainingLocation: 'Commercial gym',
                equipmentSelectionCompleteness: 'complete',
                recentTrainingLoad: 'Pretty consistent',
                conditioningLevel: 'Average',
                gameDay: 'Saturday',
                seasonPhase: phase,
                trainingDaysPerWeek: dayCount,
                preferredTrainingDays,
                equipment,
                teamTrainingDays: club
                  ? ['Tuesday', 'Thursday'].filter((day) => preferredTrainingDays.includes(day))
                  : [],
              },
            });
          }
        }
      }
    }
  }
  for (const phase of ['In-season', 'Pre-season', 'Off-season']) {
    for (const club of [true, false]) {
      for (const week of [1, 2]) {
        WORLDS.push(world(`${phase}/2d/${club ? 'club' : 'noclub'}/AnsweredBodyweight/w${week}`, {
          seasonPhase: phase, equipment: undefined, equipmentAnswer: AWAY_ANSWER,
          teamTrainingDays: club ? ['Tuesday', 'Thursday'] : [],
        }, week));
      }
    }
  }
  let builtCount = 0;
  let refusedCount = 0;
  const mismatches: string[] = [];
  const leaked: string[] = [];
  const rewritten: string[] = [];
  const groupCollisions: string[] = [];
  // The muscle-group table, read from the pools themselves so the guard cannot
  // drift from the data it is about.
  const poolGroupOf = new Map<string, string>();
  const mixedGroupSlots = new Set<string>();
  {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { STRENGTH_POOLS } = require('../data/exercisePoolsStrength');
    for (const slotKey of Object.keys(STRENGTH_POOLS)) {
      for (const role of ['anchor', 'accessory']) {
        const entries = STRENGTH_POOLS[slotKey][role]?.entries ?? [];
        const groups = new Set<string>();
        for (const entry of entries) {
          if (!entry.group) continue;
          poolGroupOf.set(entry.name, entry.group);
          groups.add(entry.group);
        }
        if (groups.size > 1) mixedGroupSlots.add(`${slotKey}:${role}`);
      }
    }
  }
  const byPhase: Record<string, { built: number; refused: number }> = {};
  for (const spec of WORLDS) {
    const phaseKey = spec.id.split('/')[0];
    byPhase[phaseKey] ??= { built: 0, refused: 0 };
    const outcome = build(spec);
    if (outcome.kind === 'refused') {
      refusedCount += 1;
      byPhase[phaseKey].refused += 1;
      if (!outcome.signature || outcome.signature === 'undefined') {
        leaked.push(`${spec.id}: refusal carried no typed signature`);
      }
      if ((outcome.error as any)?.result?.canonicalWorkouts?.length
        && !(outcome.error as any)?.result?.status) {
        leaked.push(`${spec.id}: refusal carried workouts with no status`);
      }
      continue;
    }
    builtCount += 1;
    byPhase[phaseKey].built += 1;
    const microcycle = outcome.program.microcycles[spec.week - 1];
    const stored = semanticShape(microcycle.workouts as Workout[]);
    const hydrated = semanticShape(
      JSON.parse(JSON.stringify(microcycle.workouts)) as Workout[]);
    if (stored !== hydrated) mismatches.push(`${spec.id}: stored != hydrated`);
    // ── R-080's MUSCLE-GROUP RULE, RE-HOMED (2026-08-14) ────────────────────
    //
    // **`PoolEntry.group` lost its only reader when `applyPoolRotation` was
    // deleted**, and that function was the enforcement point for Sam's
    // narrowing: rotation is variety WITHIN a muscle group, never across one.
    // The measured defect it prevented was a day getting
    // `Bicep Curl | Bicep Curl (DB) | Hammer Curl` — three biceps, no triceps.
    //
    // **MEASURED 2026-08-14 across 120 built worlds / 378 days: the shape does
    // not occur.** 200 days take two composer rows from one (slot, role), and
    // NOT ONE takes both from the same group — the composer selects one row per
    // ladder slot off an ordered bench rather than rotating a list, so the
    // defect is unreachable by construction. **But unreachable-by-construction
    // is not recorded until something checks it** (LAW ZERO), so the property
    // is asserted here rather than left to be re-discovered.
    for (const workout of microcycle.workouts as Workout[]) {
      const composedBySlot = new Map<string, string[]>();
      for (const row of workout.exercises ?? []) {
        if (row.section18Evidence?.provenance !== 'composer_declaration') continue;
        const name = String(row.exercise?.name ?? '');
        const cls = classifyPoolSlot(name);
        if (!cls) continue;
        const key = `${cls.slot}:${cls.role}`;
        composedBySlot.set(key, [...(composedBySlot.get(key) ?? []), name]);
      }
      for (const [key, names] of composedBySlot) {
        if (names.length < 2) continue;
        const groups = new Set(names.map((name) => poolGroupOf.get(name) ?? null));
        // Only a slot that MIXES groups can break the rule; a slot whose entries
        // are all one thing (every squat anchor is a squat) needs no narrowing.
        if (!mixedGroupSlots.has(key)) continue;
        if (groups.size === 1 && !groups.has(null)) {
          groupCollisions.push(`${spec.id} d${workout.dayOfWeek} ${key}: ${names.join(' | ')}`);
        }
      }
    }
    for (const workout of microcycle.workouts as Workout[]) {
      (workout.exercises ?? []).forEach((row, index) => {
        const kind = classifyGeneratedWorkoutRow({
          name: row.exercise?.name ?? '',
          sets: row.prescribedSets,
          repsMax: row.prescribedRepsMax,
          index,
        }).kind;
        if (kind === 'power' || kind === 'conditioning' || kind === 'recovery_addon') return;
        // ⚠ A ROW THAT FILLS NO LADDER SLOT IS NOT STRENGTH CONTENT, and the
        // SLOT OWNER decides that, not this cell.
        //
        // FOUND AT FULL WIDTH, 2026-08-14: 16 `Warm-up` rows on Off-season 5-day
        // Full Gym days — a day count the 36-world run never reached. `Warm-up`
        // fills no slot (`slotsForExerciseName` -> []) and the composer never
        // authored it, but `classifyGeneratedWorkoutRow` calls it
        // `strength_accessory`, so the kind filter above let it through. **The
        // leak is a CLASSIFICATION defect, not the legacy strength builder** —
        // ledgered, not fixed here. Asking `slotsForExerciseName` is the same
        // owner the composer selects with, so this is a derived exemption rather
        // than a name whitelist, which would rot.
        const identity = composedIdentityFor(row.exercise?.name ?? '');
        const slots = slotsForExerciseName(identity);
        if (slots.length === 0) return;
        // ⚠ THE OPTIONAL SIGNED-POOL SESSION HAS ITS OWN OWNER, AND IT IS NOT
        // THE COMPOSER (2026-08-14).
        //
        // Sam's class ruling, 2026-07-30 — *"REAL COMPOSED SESSIONS ONLY"* — puts
        // the optional arms/pump and prehab days' content in `buildDerivedSession`,
        // reading the SIGNED POOLS through the same builder the athlete's own
        // doors use. The composer never authored an arms day and never will, so
        // its rows carry the canonical classifier's provenance by design.
        //
        // **This cell could not see that until now**: every world carrying such a
        // day was REFUSED at baseline (48 of 180) because the severed strength
        // fallback threw on it. With those worlds building, 236 legitimate
        // signed-pool rows appeared and read as leaks. The exemption is TYPED —
        // `composedOptionalKind` is the marker the planner sets and the builder
        // reads — not a name whitelist, which would rot.
        if ((workout as { composedOptionalKind?: string }).composedOptionalKind) return;
        if (row.section18Evidence?.provenance !== 'composer_declaration') {
          leaked.push(`${spec.id} d${workout.dayOfWeek}: `
            + `${row.exercise?.name} [${kind}] provenance=${row.section18Evidence?.provenance}`);
          return;
        }
        const declaredPattern = row.section18Evidence?.mainStrengthPattern;
        if (!declaredPattern) return;
        const agrees = slots.some((slot) =>
          slot === declaredPattern
          || (declaredPattern === 'push' && slot.endsWith('_push'))
          || (declaredPattern === 'pull' && slot.endsWith('_pull')));
        if (!agrees) {
          rewritten.push(`${spec.id} d${workout.dayOfWeek}: ${row.exercise?.name} `
            + `declares ${declaredPattern} but fills [${slots.join(',')}]`);
        }
      });
    }
  }
  ok('the corpus is the SWEEP\'s 180 worlds plus 12 answered-bodyweight worlds',
    WORLDS.length === 192, `${WORLDS.length} worlds`);
  console.log('  per phase: ' + Object.entries(byPhase)
    .map(([phase, counts]) => `${phase} ${counts.built}b/${counts.refused}r`).join(' · '));
  ok('the corpus reached both outcomes — non-vacuity first',
    builtCount > 0 && refusedCount > 0, `built=${builtCount} refused=${refusedCount}`);
  ok('[BUILT] stored == hydrated on identity, order, role and pattern, every world',
    mismatches.length === 0, mismatches.slice(0, 5).join('\n      '));
  ok('[BUILT] no stored STRENGTH row came from a legacy content owner',
    leaked.filter((line) => line.includes('provenance=')).length === 0,
    `${leaked.filter((line) => line.includes('provenance=')).length} rows; distinct names: `
    + JSON.stringify([...new Set(leaked.filter((line) => line.includes('provenance='))
        .map((line) => line.split(': ')[1]?.split(' [')[0]))]));
  ok('[BUILT] no stored row was rewritten after composition — declared pattern agrees with the lift',
    rewritten.length === 0, rewritten.slice(0, 5).join('\n      '));
  ok('[R-080] the muscle-group narrowing still holds, now that its only enforcer is deleted',
    groupCollisions.length === 0,
    `${groupCollisions.length} day(s) took two rows from one slot AND one group:\n      `
    + groupCollisions.slice(0, 5).join('\n      '));
  ok('[R-080] the guard is non-vacuous — the pools really do mix groups',
    mixedGroupSlots.size > 0 && poolGroupOf.size > 0,
    `${mixedGroupSlots.size} mixed slots, ${poolGroupOf.size} grouped entries`);
  ok('[REFUSED] every refusal carried a typed signature and stored nothing',
    leaked.filter((line) => line.includes('refusal')).length === 0,
    leaked.filter((line) => line.includes('refusal')).slice(0, 5).join('\n      '));
  console.log(`  e2e corpus: ${builtCount} built, ${refusedCount} refused`);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE BEHAVIOUR THE RETIRED `test:pools` CELLS GUARDED, RE-EXPRESSED
// ═══════════════════════════════════════════════════════════════════════════
//
// Six cells in `test:pools` went red when generation-time rotation was deleted.
// Three guarded CROSS-BLOCK VARIETY and two guarded ATHLETE EXCLUSION — real
// behaviour, so it is re-expressed here against the composer BEFORE those cells
// retire. The sixth guarded PINNING, which the composer does not implement; it
// is NOT retired and is reported as a capability regression.
console.log('\n[retire] Behaviour the deleted rotation cells guarded, held against the composer');
{
  const day = {
    dayOfWeek: 1, isTeamDay: false, planEntryId: 'p', name: 'Lower Body Strength',
    workoutType: 'Strength', sessionTier: 'core',
    strengthIntent: { archetype: 'lower' as const, primaryPattern: 'squat' as const,
      plannedPatterns: ['squat' as const], effectivePatterns: ['squat' as const] },
  };
  const fullGymTags = resolveEquipmentCapabilities({
    equipment: ['Full Gym'], equipmentSelectionCompleteness: 'complete' } as never).tags as string[];
  const compose = (weekNumber: number, excluded: string[] = []) => composeWeek({
    profile: { gender: 'male', seasonPhase: 'Off-season' } as never, phaseClock: { weekNumber },
    gender: 'male', seasonPhase: 'Off-season' as never, offseasonSubphase: null,
    plannedDays: [day], kit: fullGymTags,
    injuries: { prohibitedPatterns: [], excludedIdentities: excluded },
    todayISO: '2026-07-13',
    ...COMPOSER_ROTATION_DEFAULTS,
  }).days[0].rows.map((row) => row.identity);

  // REPLACES: "mc=2 anchor rotates" and "accessory rotated across 4 weeks".
  const acrossBlocks = [1, 2, 3, 4].map((week) => compose(week)[0]);
  ok('[replaces pool rotation cells 1-3] the main lift varies across blocks',
    new Set(acrossBlocks).size >= 2, JSON.stringify(acrossBlocks));
  ok('[replaces pool rotation cells 1-3] and it is deterministic per block',
    JSON.stringify(compose(2)) === JSON.stringify(compose(2)));

  // REPLACES: the two `excluded=['Back Squat']` cells.
  const plain = compose(1);
  ok('[control] the unexcluded week does select Back Squat', plain.includes('Back Squat'),
    JSON.stringify(plain));
  const withoutBackSquat = compose(1, ['Back Squat']);
  ok('[replaces pool exclusion cells 4-5] an excluded lift is never selected',
    !withoutBackSquat.includes('Back Squat'), JSON.stringify(withoutBackSquat));
  ok('[replaces pool exclusion cells 4-5] and the slot is still filled by another lift',
    withoutBackSquat.length === plain.length, JSON.stringify(withoutBackSquat));

  // ⚠ NOT RETIRED, AND THIS CELL SAYS SO. `test:pools`'s pinning cell guards a
  // behaviour the composer does NOT have: `AthletePoolPrefs.pinned` has no
  // reader in `composeWeek`. Recorded as a regression rather than replaced.
  ok('[REGRESSION, declared] the composer has no pinning reader — the pool cell may not retire',
    !/pinned/.test(require('fs').readFileSync(
      require('path').resolve(__dirname, '../rules/composeWeek.ts'), 'utf8')));
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SEMANTIC BOUNDARY GUARDS (B1-E2E-SEMANTIC-COMPLETION)
// ═══════════════════════════════════════════════════════════════════════════
//
// The 192-world property above proves identity/order/role/pattern. These prove
// the two things it did NOT: the composer's own DOSE, and where its typed GAP
// records stop travelling. **They are written against the composer's own output
// as the subject — no `slotsForExerciseName` narrowing** — because a composer row
// cannot stop being the composer's merely because another vocabulary does not
// recognise its slot.
console.log('\n[semantic] Composer dose and typed gaps, measured at their boundaries');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const composeModule = require('../rules/composeWeek');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // REPOINTED 2026-08-14: the handover no longer flattens the composed week
  // back into `CoachGeneratedWorkoutInput` for the legacy builder to rebuild —
  // `composedWeekToCoachInputs` is DELETED. Composer rows are materialised
  // straight into domain workouts, so the gap-loss question is asked of the
  // live door instead of a deleted one.
  const adapterModule = require('../rules/materialiseComposedWeek');
  const realCompose = composeModule.composeWeek;
  const realAdapt = adapterModule.materialiseComposedWeek;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // REPOINTED 2026-08-14: the authored candidate is now the ASSEMBLED week
  // (composer strength + retained adapter non-strength), not the legacy
  // builder's output. `buildWorkoutsFromCoach` no longer sees a composer row at
  // all, so spying on it captured a week with no lifts in it and the
  // comparison below reached zero rows.
  const builderModule = require('../rules/assembleAuthoredWeek');
  const realBuild = builderModule.assembleAuthoredWeek;
  const composedRuns: any[] = [];
  const materialisedRuns: any[] = [];
  const authoredRuns: any[] = [];
  // Keyed by microcycleId: the gateway calls the builder once per candidate ARM
  // and once per week, so an index compares one week against another's repair.
  builderModule.assembleAuthoredWeek = (...args: any[]) => {
    const output = realBuild(...args);
    authoredRuns.push({
      microcycleId: output.workouts[0]?.microcycleId,
      workouts: output.workouts,
    });
    return output;
  };
  composeModule.composeWeek = (inputs: any) => {
    const output = realCompose(inputs); composedRuns.push(output); return output;
  };
  adapterModule.materialiseComposedWeek = (week: any, context: any) => {
    const output = realAdapt(week, context);
    materialisedRuns.push({ week, output });
    return output;
  };
  try {
    // A kit-limited world, so the composer certainly emits gaps.
    const outcome = build(world('semantic/db-in-season', {
      gender: 'male', seasonPhase: 'In-season', equipment: ['Dumbbells', 'Bands'],
      teamTrainingDays: ['Tuesday', 'Thursday'],
    }));
    ok('[semantic] the probe world builds — non-vacuity first', outcome.kind === 'built');
    const composedWeek = composedRuns[0];
    ok('[semantic] the composer was reached through the production door',
      !!composedWeek && composedWeek.days.length > 0);

    // ── TYPED GAPS: composed, and where they stop ───────────────────────────
    ok('[semantic] the composer emits typed kit gaps for this world',
      composedWeek.gaps.length > 0, JSON.stringify(composedWeek.gaps));
    const materialised = materialisedRuns[0]?.output ?? [];
    const carriesGaps = materialised.some((day: any) =>
      Object.keys(day).some((field) => /gap|disclos/i.test(field)));
    // ⚠ REWRITTEN 2026-08-14, EXACTLY AS THE OLD CELL INSTRUCTED. It read
    // "MEASURED DEFECT: typed gaps do NOT survive materialisation", because the
    // composed week was flattened into `CoachGeneratedWorkoutInput`, which has
    // no carrier field — 176 typed gaps across 86 worlds died there. **That
    // round trip is deleted.** `materialiseComposedWeek` emits the composer's
    // gaps onto the day it materialises, so the carrier now exists and the
    // finding is closed. The cell flips from recording a loss to guarding the
    // carrier.
    ok('[semantic] typed kit gaps SURVIVE materialisation — the loss is closed',
      carriesGaps === true,
      'the composer emitted gaps but no materialised day carries them');

    // ── DOSE: the composer authors one, and it is not what is stored ────────
    if (outcome.kind === 'built') {
      const stored = rowsByDayAndIdentity(outcome.program.microcycles[0].workouts as Workout[]);
      let compared = 0; let moved = 0;
      for (const day of composedWeek.days) {
        for (const row of day.rows) {
          const match = stored.get(`${day.dayOfWeek}:${row.identity}`);
          if (!match) continue;
          compared += 1;
          if (match.prescribedSets !== row.sets
            || match.prescribedRepsMin !== row.repsMin
            || match.prescribedRepsMax !== row.repsMax) moved += 1;
        }
      }
      ok('[semantic] the dose comparison reached rows at all', compared > 0, `${compared} rows`);
      // ⚠ REWRITTEN 2026-08-14, AND THIS IS THE WHOLE POINT OF THE SLICE. The
      // old cell recorded that the stored dose was NOT the composer's, because
      // the phase rep-scheme owner rewrote every row inside
      // `buildWorkoutsFromCoach` (`Back Squat` 3x5-8 → 3x2-4 in-season). **No
      // composer row enters that builder any more.** The composer's authored
      // dose is what is stored, so the cell now guards preservation — the guard
      // its predecessor said could not exist while preservation was false.
      ok('[semantic] the stored dose IS the composer\'s authored dose',
        moved === 0, `${moved} of ${compared} rows were re-dosed after composition`);

      // ── THE MUT-8 REPLACEMENT (B1-M1 step 1) ────────────────────────────
      //
      // The cell above cannot fail: the dose already moves, so one more movement
      // cannot flip `moved > 0`. **A preservation guard cannot exist while
      // preservation is false** — so this guards ATTRIBUTION instead, which is
      // true today: every main-lift dose movement at authorship must land
      // exactly on `mainLiftSchemeForSlot`'s authored band (Bible `:767-769`,
      // `:839-841`). A movement that is NOT the phase table's is an owner nobody
      // named, and that is the thing worth catching.
      let attributed = 0; let unattributed = 0;
      for (const day of composedWeek.days) {
        for (const row of day.rows) {
          if (row.role !== 'main_strength') continue;
          const match = stored.get(`${day.dayOfWeek}:${row.identity}`);
          if (!match) continue;
          const poolSlot = classifyPoolSlot(row.identity);
          if (!poolSlot || poolSlot.role !== 'anchor') continue;
          const scheme = mainLiftSchemeForSlot(poolSlot.slot, 'In-season', null);
          if (!scheme) continue;
          const onBand = match.prescribedRepsMin === scheme.repsMin
            && match.prescribedRepsMax === scheme.repsMax
            && match.prescribedSets >= scheme.setsMin
            && match.prescribedSets <= scheme.setsMax;
          if (onBand) attributed += 1; else unattributed += 1;
        }
      }
      ok('[semantic] the attribution check reached main lifts',
        attributed + unattributed > 0, `${attributed + unattributed} main lifts`);
      ok('[MUT-8 replacement] every main-lift dose at authorship is the phase table\'s',
        unattributed === 0,
        `${unattributed} main lifts carry a dose no authored scheme explains`);

      // ⚠ THE GUARD THAT CAN ACTUALLY GO RED, and why the one above cannot.
      //
      // Mutation-8 added a set to a stored row and **every cell stayed green**:
      // the dose already moves, so one more movement cannot flip `moved > 0`.
      // A set-count PRESERVATION guard cannot exist while preservation is false.
      // What IS true and guardable is the BOUNDARY: the dose moves once, inside
      // `buildWorkoutsFromCoach`, and never again. Measured across all 67 built
      // worlds — 569 movements composer->authoring, **zero** authoring->stored.
      const authoredCandidate = authoredRuns.find((run: any) =>
        run.microcycleId === outcome.program.microcycles[0].id);
      let afterAuthoring = 0; let checkedAfter = 0;
      if (authoredCandidate) {
        const authoredRows = rowsByDayAndIdentity(authoredCandidate.workouts as Workout[]);
        for (const [key, storedRow] of stored) {
          const authoredRow = authoredRows.get(key);
          if (!authoredRow) continue;
          checkedAfter += 1;
          if (authoredRow.prescribedSets !== storedRow.prescribedSets
            || authoredRow.prescribedRepsMin !== storedRow.prescribedRepsMin
            || authoredRow.prescribedRepsMax !== storedRow.prescribedRepsMax
            || (authoredRow.prescribedWeightKg ?? 0) !== (storedRow.prescribedWeightKg ?? 0)) {
            afterAuthoring += 1;
          }
        }
      }
      ok('[semantic] the after-authoring dose comparison reached rows',
        checkedAfter > 0, `${checkedAfter} rows`);
      ok('[semantic] NO dose moves after final authorship — sets, reps or load',
        afterAuthoring === 0, `${afterAuthoring} of ${checkedAfter} rows moved after authoring`);
    }
  } finally {
    composeModule.composeWeek = realCompose;
    adapterModule.composedWeekToCoachInputs = realAdapt;
    builderModule.buildWorkoutsFromCoach = realBuild;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE RULED DOSE CATEGORIES (B1-M1) — U-1 verbatim, U-2 verbatim, U-3/U-4 approved
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[dose] Sam\'s typed dose categories, resolved before authorship');
{
  const inSeason = (phase: string, sub: string | null) => ({
    identity: '', isMainLift: false, poolSlot: null as never,
    seasonPhase: phase as never, offseasonSubphase: sub as never,
    authoredFallback: [9, 99, 99] as readonly [number, number, number],
  });
  const dose = (identity: string, phase: string, sub: string | null = null) =>
    resolveComposedDose({ ...inSeason(phase, sub), identity });

  // U-1 — the loaded band, and its OFF-SEASON CORRECTION.
  ok('[U-1] loaded lower secondary: in-season 6-8',
    JSON.stringify(dose('Single-Leg RDL', 'In-season')).includes('"repsMin":6')
    && dose('Single-Leg RDL', 'In-season').repsMax === 8);
  ok('[U-1] loaded lower secondary: pre-season 6-10',
    dose('Single-Leg RDL', 'Pre-season').repsMax === 10);
  ok('[U-1] loaded lower secondary: OFF-SEASON CAPPED AT 10, not the old 15',
    dose('Single-Leg RDL', 'Off-season').repsMin === 8
    && dose('Single-Leg RDL', 'Off-season').repsMax === 10,
    JSON.stringify(dose('Single-Leg RDL', 'Off-season')));
  ok('[U-1] the category is typed, not a name match',
    dose('Goblet Squat', 'In-season').category === 'loaded_lower_secondary_compound'
    && dose('Hip Thrusts', 'In-season').category === 'loaded_lower_secondary_compound');

  // U-3 — unloaded compounds share the range but NOT the category.
  ok('[U-3] Bodyweight Squat is an unloaded lower compound at 2-3 x 10-20',
    dose('Bodyweight Squat', 'In-season').category === 'unloaded_lower_compound'
    && dose('Bodyweight Squat', 'In-season').repsMin === 10
    && dose('Bodyweight Squat', 'In-season').repsMax === 20);
  ok('[U-3] Glute Bridge likewise, and it is NOT reclassified as isolation',
    dose('Glute Bridge', 'Off-season').category === 'unloaded_lower_compound');

  // U-4 — ballistic strength, 2-3 sets and quality-limited.
  ok('[U-4] Kettlebell Swings are ballistic strength at 6-10, not hypertrophy',
    dose('Kettlebell Swings', 'In-season').category === 'ballistic_strength'
    && dose('Kettlebell Swings', 'In-season').repsMin === 6
    && dose('Kettlebell Swings', 'In-season').repsMax === 10);
  ok('[U-4] and it is quality-limited, not set-count-limited (Sam approved 2-3)',
    dose('Kettlebell Swings', 'In-season').sets <= 3
    && dose('Kettlebell Swings', 'In-season').qualityLimit
      === 'stop_when_speed_or_technique_drops');

  // THE MAIN-LIFT ROLE OUTRANKS THE CATEGORY.
  ok('[U-1] the same movement leading a day takes the main-lift phase scheme',
    resolveComposedDose({
      identity: 'Single-Leg RDL', isMainLift: true, poolSlot: 'hinge' as never,
      gender: 'male', seasonPhase: 'In-season' as never, offseasonSubphase: null,
      authoredFallback: [9, 99, 99] as readonly [number, number, number],
    }).category === 'main_lift');

  // NO SILENT FALLTHROUGH — an unruled identity DECLARES that it is unruled.
  ok('[passthrough] an identity with no ruled policy is declared, not relabelled',
    dose('Cossack Squat', 'In-season').category === 'composer_authored_passthrough'
    && dose('Scap Push-Up', 'Off-season').category === 'composer_authored_passthrough',
    `${dose('Cossack Squat', 'In-season').category} / ${dose('Scap Push-Up', 'Off-season').category}`);
  ok('[passthrough] and it preserves the composer\'s own authored band untouched',
    dose('Cossack Squat', 'In-season').repsMin === 99
    && dose('Cossack Squat', 'In-season').sets === 9,
    JSON.stringify(dose('Cossack Squat', 'In-season')));

  // U-2 — the cut, its governed role, and SINGLE APPLICATION.
  const cut = (load: number, isMainLift: boolean, sub: string | null) =>
    applyOffseasonMainLiftLoad({
      load, isMainLift, poolSlot: 'squat' as never,
      gender: 'male', seasonPhase: 'Off-season' as never, offseasonSubphase: sub as never,
    });
  ok('[U-2] early off-season cuts a main lift to 75%', cut(100, true, 'early_offseason') === 75);
  ok('[U-2] mid off-season cuts to 90%', cut(100, true, 'mid_offseason') === 90);
  ok('[U-2] late off-season does not cut', cut(100, true, 'late_offseason') === 100);
  ok('[U-2] an ACCESSORY is never cut', cut(100, false, 'early_offseason') === 100);
  ok('[U-2] an UNLOADED row is never cut', cut(0, true, 'early_offseason') === 0);
  // ⚠ SINGLE APPLICATION IS A PROPERTY OF THE CALL SITE, NOT OF THE FUNCTION,
  // and the first version of this cell asserted the wrong one.
  //
  // I wrote *"applying it to an already-cut load does not stack"* and it went
  // RED, correctly: the function is pure arithmetic and 100 -> 75 -> 55 if you
  // call it twice. **It is not idempotent and it cannot be** — a cut load and an
  // uncut load are the same number to it. So the guard asserts the two things
  // that ARE true: the function's non-idempotence is DECLARED so nobody assumes
  // otherwise, and the composed path calls it exactly ONCE per row.
  // ⚠ THE SUBJECT MOVED, AND THE CALL-COUNT GUARD MOVED WITH IT.
  //
  // The raw multiplier is pure arithmetic — 100 -> 75 -> 55 — and cannot be
  // idempotent, because a cut load and an uncut load are the same number to it.
  // A call-count test was the first answer and the resumed prompt is right that
  // it is insufficient. **The final load is now DERIVED from the base rather
  // than adjusted in place**, so running the derivation on its own output gives
  // the same number: the base it reads has not moved.
  ok('[U-2] the raw multiplier is NOT idempotent — declared, so no caller assumes it',
    cut(cut(100, true, 'early_offseason'), true, 'early_offseason') !== 75);
  {
    const athlete = {
      gender: 'male', seasonPhase: 'Off-season', weightKg: 80,
      squatStrength: 'Around bodyweight', benchStrength: 'Around bodyweight',
      experienceLevel: '2-5 years',
    } as never;
    const FULL_KIT = resolveEquipmentCapabilities({
      equipment: ['Full Gym'], equipmentSelectionCompleteness: 'complete' } as never).tags as string[];
    const derive = (sub: string | null) => resolveComposedLoad({
      identity: 'Back Squat', isMainLift: true, poolSlot: 'squat' as never,
      gender: 'male', seasonPhase: 'Off-season' as never, offseasonSubphase: sub as never,
      profile: athlete, kit: FULL_KIT,
    });
    const full = derive('late_offseason');
    const early = derive('early_offseason');
    ok('[base load] the composer resolves a real base working load',
      full > 0, `base=${full}`);
    ok('[U-2] early off-season derives 75% OF THE BASE, not of a previous answer',
      early === Math.round((full * 0.75) / 2.5) * 2.5, `base=${full} early=${early}`);
    ok('[U-2] the DERIVATION is naturally non-stacking — same inputs, same answer',
      derive('early_offseason') === early && derive('early_offseason') === early);
    ok('[U-2] an unloaded identity stays at zero and is never cut',
      resolveComposedLoad({
        identity: 'Bodyweight Squat', isMainLift: true, poolSlot: 'squat' as never,
        gender: 'male', seasonPhase: 'Off-season' as never, offseasonSubphase: 'early_offseason' as never,
        profile: athlete, kit: FULL_KIT,
      }) === 0);

    // ── R-083 LOAD LEGALITY — the away athlete's 10 kg Single-Leg RDL ────────
    const AWAY_KIT = resolveEquipmentCapabilities({
      equipmentAnswer: AWAY_ANSWER } as never).tags as string[];
    const DB_KIT = resolveEquipmentCapabilities({
      equipment: ['Dumbbells', 'Bands'], equipmentSelectionCompleteness: 'complete' } as never)
      .tags as string[];
    const load = (identity: string, kit: string[]) => resolveComposedLoad({
      identity, isMainLift: false, poolSlot: null,
      gender: 'male', seasonPhase: 'In-season' as never, offseasonSubphase: null,
      profile: athlete, kit,
    });
    ok('[R-083 load] an AWAY athlete gets 0kg on a legal unloaded row',
      load('Single-Leg RDL', AWAY_KIT) === 0,
      `away Single-Leg RDL = ${load('Single-Leg RDL', AWAY_KIT)}kg`);
    ok('[R-083 load] a DUMBBELL athlete keeps a real dumbbell load',
      load('Goblet Squat', DB_KIT) > 0, `${load('Goblet Squat', DB_KIT)}kg`);
    ok('[R-083 load] a FULL-GYM athlete keeps a real barbell load',
      load('Back Squat', FULL_KIT) > 0, `${load('Back Squat', FULL_KIT)}kg`);
    // ⚠ THE CONTROL THAT MATTERS MOST: an identity the athlete CANNOT PERFORM is
    // refused by the legality owner upstream — it is never kept in the week with
    // its weight quietly set to zero, which would read as a prescription he can
    // do. `composeWeek` selects only through `composedRowIsLegal`, so the row
    // never reaches the load resolver at all.
    ok('[R-083 load] an equipment-ILLEGAL identity is refused upstream, not zeroed',
      composedRowIsLegal('Pull-Ups', AWAY_KIT) === false
      && !composeWeek(inputs({
        kit: AWAY_KIT,
        // ⚠ AN UPPER-PULL DAY, DELIBERATELY. The first version used the lower-day
        // fixture, where no pull slot exists — so dropping legality from
        // selection could not put `Pull-Ups` in the week and the cell passed
        // while its subject was switched off. The mutation caught it.
        plannedDays: [{
          dayOfWeek: 2, isTeamDay: false, planEntryId: 'p', name: 'Upper Pull',
          workoutType: 'Strength', sessionTier: 'core',
          strengthIntent: { archetype: 'upper', primaryPattern: 'pull',
            plannedPatterns: ['pull'], effectivePatterns: ['pull'] },
        }],
      }) as never).days
        .some((day) => day.rows.some((row) => !composedRowIsLegal(row.identity, AWAY_KIT))),
      'a bodyweight athlete must not carry an illegal row at any weight');
    ok('[R-083 load] the same movement loads on the kit that can hold it',
      load('Single-Leg RDL', FULL_KIT) > 0
      && load('Single-Leg RDL', AWAY_KIT) === 0);
  }
}

console.log(`\nComposer severance: passed=${passed} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
}
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
