/**
 * STAGE 2a — INJURY AUTHORITY OWNERSHIP (region-scoped anchor participation).
 *
 * Sam's D10 ruling, recorded in Addendum A of
 * `docs/DURABLE_ATHLETE_STATE_FACT_OWNERSHIP_REASSESSMENT_2026-07-24.md`:
 *
 *   > an injury never silently withdraws team-training/game conditioning-sprint
 *   > credit; affected-region work pauses per the Bible bands; injuries at every
 *   > severity become recordable.
 *
 * What rider 0 established (`docs/investigations/RIDER0_INJURY_AUTHORITY_AT_THE_GATE_2026-07-24.md`):
 * the §18 gate never ignored anything. `applyGenerationSafetyToSection18Contract`
 * demotes EVERY anchor to `modified` as soon as any main-strength pattern is
 * prohibited, which zeroes their conditioning and sprint production claim — and
 * it authors a matching typed reduction for strength, and for sprint on a
 * lower-body injury, but NEVER for conditioning, in any branch. The contract
 * handed to the gate therefore asserts both "these anchors no longer produce
 * conditioning" and "this week requires 3 conditioning exposures". It is
 * unsatisfiable before the gate runs, and because the fact and the week commit
 * in one transaction, the unsatisfiable week takes the athlete's injury report
 * down with it. Measured: EVERY injury from 6/10 up, in either region, is
 * rejected and records nothing.
 *
 * Run: npm run test:injury-authority
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
// This file runs as BOTH the forking parent and each forked child, so both
// paths carry their own clear — see runOne and main below.
armTotalsOrRed();
import { useProgramStore } from '../store/programStore';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import {
  buildGuidedInjuryConstraint,
  type GuidedInjuryRegion,
} from '../utils/guidedInjuryControl';
import { applyGenerationSafetyToSection18Contract } from '../rules/section18SafetyPolicy';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { useProfileStore } from '../store/profileStore';
import { onboardingToCoachingInputs } from '../utils/coachingEngine';
import { coachingPlanForTests } from './support/coachingPlanForTests';
import { generateProgramLocally } from '../services/api/generateProgram';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { looksLikeNeuralPrimer } from '../rules/weekStructureValidator';
import { getSessionComponents } from '../utils/sessionComponents';
import { buildDeterministicCoachNoteDescriptors } from '../utils/deterministicCoachNoteFactory';
import { rebuildDerivedWorld } from '../store/quiescentBoot';
import type { OnboardingData, Workout } from '../types/domain';
import type { GenerationConstraintContext } from '../utils/generationConstraints';
import {
  SPENT_TODAY,
  SPENT_WEEK_1,
  acceptedWeek,
  markSpentDaysDone,
  quietAsync,
  runScenariosForked,
  seedSpentWeekFriday,
} from './spentWeekFridayTestSupport';

let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

interface Scenario { id: string; name: string; body: () => Promise<void> }
const scenarios: Scenario[] = [];
function scenario(id: string, name: string, body: () => Promise<void>): void {
  scenarios.push({ id, name, body });
}

async function run(name: string, body: () => Promise<void>): Promise<void> {
  try { await body(); passes += 1; console.log(`  PASS [invariant] ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`); }
}

const AREA_FOR_REGION: Record<GuidedInjuryRegion, string> = {
  upper_body: 'Shoulder',
  lower_body: 'Hamstring',
  back_midline: 'Lower back',
  /* `other: 'Other'` went with the region (Sam, 2026-08-21). It was never
     exercised — no invariant below iterates it — and it could not have been:
     "Other" resolves to no bucket, so the writer would have thrown on it. */
};

async function reportInjury(region: GuidedInjuryRegion, severity: number) {
  const constraint = buildGuidedInjuryConstraint({
    region,
    area: AREA_FOR_REGION[region],
    severity,
    severityBand: severity >= 8 ? 'avoid' : severity >= 6 ? 'moderate' : severity >= 4 ? 'slight' : 'mild',
    adjustmentLevel: severity >= 8 ? 'training_paused' : severity >= 6 ? 'moderate' : severity >= 4 ? 'slight' : 'minimal',
    triggers: region === 'upper_body' ? ['Pressing'] : ['Sprinting'],
    seriousSymptoms: false,
  }, { todayISO: SPENT_TODAY });
  return quietAsync(() => executeProgramControlActionDurably({
    type: 'set_injury_modifier',
    source: { screen: 'program_tab', surface: 'guided_injury_flow', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { constraint },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as never, { todayISO: SPENT_TODAY }), !!process.env.INJURY_LOUD);
}

function recordedState() {
  const accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext);
  return {
    activeInjury: accepted.activeInjury,
    episodes: accepted.injuryEpisodes.length,
    facts: accepted.temporarySourceFacts.length,
  };
}

function currentWeekContract() {
  const state = useProgramStore.getState();
  return rebaseAcceptedEffectiveWeek({
    surfaces: state as never,
    weekStart: SPENT_WEEK_1,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  }).contract;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE G-2 QUALITY-LOWER MATRIX
//
// `docs/INJURY_AUTHORITY_EXHAUSTION_RULING_V2_2026-08-06.md` §3: three worlds —
// no-game (must NOT exhaust), Saturday game + severe upper (must FILL G-2),
// genuinely exhausted (the typed reduction witnessed only there).
//
// The worlds are driven at the layer that OWNS the decision — `buildCoachingPlan`
// places, `buildWorkoutsFromCoach` composes — because the seeded world carries a
// Saturday fixture in every one of its weeks (measured: weeks 1-4 all resolve
// `in_season_game_week` off the profile's usual game day), so a no-game week is
// not reachable from it at all. `G7` closes the loop end-to-end on the seed.
// ═══════════════════════════════════════════════════════════════════════════

const G2_DAY = 'Thursday';   // G-2 for a Saturday game, and a team-training day

function matrixProfile(
  gameDay: 'Saturday' | undefined,
  overrides: Partial<OnboardingData> = {},
): Partial<OnboardingData> {
  return {
    // ── FIELDS THE REAL GENERATOR REQUIRES AND THE OLD TWO-STEP DID NOT ─────
    //
    // `buildWorkoutsFromCoach` never asked where the athlete trains, so the
    // fixture never said. `generateProgramLocally` refuses without it — "I still
    // need to know what equipment you can train with" — which is correct product
    // behaviour and was simply unreachable from the old harness. **Adding the
    // fixture's missing facts is instrument repair; no expectation moves.**
    trainingLocation: 'Commercial gym',
    equipmentSelectionCompleteness: 'complete',
    equipment: ['Full Gym'],
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    sprintExposure: '2+ times per week',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Very consistent',
    experienceLevel: '2-5 years',
    injuries: [],
    motivation: 'Get stronger',
    gameDay,
    usualGameDay: gameDay,
    ...overrides,
  };
}

/** Severe (pause-band) restrictions, in the shape the pipeline actually reads. */
function injuryConstraints(
  regions: ReadonlyArray<'upper_body' | 'lower_body'>,
): GenerationConstraintContext {
  return {
    injuries: regions.map((region, index) => ({
      id: `matrix-${region}-${index}`,
      sourceType: 'injury',
      bodyPart: region === 'upper_body' ? 'Shoulder' : 'Hamstring',
      region,
      severity: 9,
      severityBand: 'avoid',
      onboardingSeverity: 'Severe',
      triggers: [],
      reduceAffectedWork: true,
      removeRiskyWork: true,
      pauseAffectedTraining: true,
      injuryKeys: [],
    })),
  } as never as GenerationConstraintContext;
}

function matrixWorld(args: {
  gameDay: 'Saturday' | undefined;
  restricted: ReadonlyArray<'upper_body' | 'lower_body'>;
  profileOverrides?: Partial<OnboardingData>;
}) {
  const profile = matrixProfile(args.gameDay, args.profileOverrides);
  const inputs = onboardingToCoachingInputs(profile as OnboardingData, {
    generationConstraints: args.restricted.length > 0
      ? injuryConstraints(args.restricted)
      : undefined,
  });
  const plan = coachingPlanForTests(inputs);
  // ── THE HARNESS DROVE A PIPELINE THAT NO LONGER EXISTS ──────────────────
  //
  // It went plan -> `buildWorkoutsFromCoach` with NO `composeWeek` in between.
  // That was the shape of generation once; production is now composer + adapter
  // + assembly, and the adapter alone throws by design:
  //
  //   "B1-PIVOT: the legacy strength-content builder is severed. A strength plan
  //    entry reached fallbackExercisesForPlanEntry, which means composeWeek did
  //    not cover a day the planner asked for."
  //
  // **The subject of this suite — injury authority over the G-2 day — is a live
  // product rule**, so the instrument is repaired rather than the suite deleted.
  // It now drives the REAL generator, which runs every stage in the order
  // production runs them. No expectation is rebased and no product code changes.
  const program = generateProgramLocally(profile as OnboardingData, {
    todayISO: '2026-07-20',
    blockNumber: 1,
    microcycleLimit: 1,
    ...(args.restricted.length > 0
      ? { generationConstraints: injuryConstraints(args.restricted) }
      : {}),
  } as never);
  const workouts = program.microcycles[0].workouts;
  return {
    plan,
    workouts,
    // THE V2 CONTRACT, deliberately: `main_strength_frequency` is the typed
    // metric the ruling names, the one `applyReductionProjections` lowers the
    // planner-selected target off, and the one `hasFrequencyReduction`
    // authorises a miss against. The legacy contract calls the same decision
    // `weekly_exposure_count`, and asserting on that name would pass while
    // proving nothing about the metric that governs the gate.
    reductionMetrics: (plan.weeklyExposureContractV2?.authorisedReductions ?? [])
      .map((entry) => entry.metric),
    qualityLowerDays: plan.weeklyPlan
      .filter((entry) => entry.strengthVariant === 'quality_low_volume')
      .map((entry) => entry.dayOfWeek),
  };
}

function workoutForDay(workouts: readonly Workout[], dayName: string): Workout | undefined {
  const dayNum: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
  };
  return workouts.find((workout) => workout.dayOfWeek === dayNum[dayName]);
}

function rowSummary(workout: Workout | undefined): string {
  return (workout?.exercises ?? [])
    .map((row) => `${row.exercise?.name}[${row.prescribedSets}x${row.prescribedRepsMin}-${row.prescribedRepsMax}]`)
    .join(', ');
}

function registerScenarios(): void {
  // ── G1 — WORLD 1: no game. The last resort must be UNREACHABLE, and nothing
  // may exhaust. Without a fixture there is no G-2, so the safe lower patterns
  // have ordinary days to live on and the week keeps its count by substitution
  // alone — which is the rule the exception is an exception TO.
  scenario('g1', 'G1 a no-game week with a severe upper injury never reaches the G-2 exception and never exhausts', async () => {
    const world = matrixWorld({ gameDay: undefined, restricted: ['upper_body'] });
    assert(world.qualityLowerDays.length === 0,
      `a week with no fixture placed the G-2 quality-lower on ${world.qualityLowerDays.join(', ')} — `
      + 'the exception is scoped to the G-2 slot, and a week with no game has none');
    assert(!world.reductionMetrics.includes('main_strength_frequency'),
      'a no-game week authorised a main-strength FREQUENCY reduction: '
      + `${world.reductionMetrics.join(', ')} — substitution was available and was not exhausted`);
  });

  // ── G2 — WORLD 2: Saturday game + severe upper. THE HEADLINE. Both upper
  // patterns are paused and heavy lower is barred at G-2, so the day used to be
  // stranded (docs/UPPER_BODY_SEVERE_STRENGTH_MISS_DIAGNOSIS_2026-08-06.md).
  // The anchor's own second state fills it.
  scenario('g2', 'G2 a Saturday game + severe upper injury FILLS the G-2 day with the authored quality-lower', async () => {
    const world = matrixWorld({ gameDay: 'Saturday', restricted: ['upper_body'] });
    assert(world.qualityLowerDays.includes(G2_DAY),
      `the G-2 day (${G2_DAY}) did not receive the quality-lower; placed on `
      + `[${world.qualityLowerDays.join(', ') || 'nothing'}]. The day is stranded again: `
      + 'upper is paused by the injury and heavy lower is barred by the game.');
    assert(!world.reductionMetrics.includes('main_strength_frequency'),
      'the week authorised a main-strength FREQUENCY reduction even though the G-2 '
      + 'exception could fill the day — exhaustion must be a MEASURED outcome, and '
      + `this week is not exhausted. Reductions: ${world.reductionMetrics.join(', ')}`);
  });

  // ── G3 — THE BINDING GATE. The shape the placer produces must be the shape
  // `looksLikeNeuralPrimer` licenses. This is what stops the producer and the
  // authored definition drifting apart: a heavier "quality" lower would still
  // pass G2 above and would be a full lower session two days before a game.
  scenario('g3', 'G3 the G-2 session the placer ships satisfies the authored neural-primer definition', async () => {
    const world = matrixWorld({ gameDay: 'Saturday', restricted: ['upper_body'] });
    const workout = workoutForDay(world.workouts, G2_DAY);
    assert(workout, `no workout was built for ${G2_DAY}`);
    assert(looksLikeNeuralPrimer(workout!),
      `the G-2 session is NOT a neural primer by the authored definition `
      + `(rules/weekStructureValidator.looksLikeNeuralPrimer): ${rowSummary(workout)}`);
    // And the husk cannot come back: a day that carries a strength component
    // must carry strength rows.
    assert((workout!.exercises ?? []).length > 0,
      `${G2_DAY} shipped with zero rows — the husk the diagnosis measured`);
  });

  // ── G4 — SAM'S SENTENCE, VERBATIM. "2x3 box squats to high box + 2x3 vertical
  // jumps". Both halves are composed here; the week's authorised power-primer
  // budget decides whether the jump row survives to the athlete (measured: in the
  // seeded world the budget is 0 for `game_load_protection`, and the power owner
  // removes it — content built to the number the contract authorises).
  scenario('g4', 'G4 the authored G-2 content is High Box Squat 2x3 + Vertical Jump 2x3, and rotation does not rewrite it', async () => {
    const world = matrixWorld({ gameDay: 'Saturday', restricted: ['upper_body'] });
    const workout = workoutForDay(world.workouts, G2_DAY);
    const rows = (workout?.exercises ?? []).map((row) => ({
      name: row.exercise?.name ?? '',
      sets: row.prescribedSets,
      repsMax: row.prescribedRepsMax,
    }));
    const squat = rows.find((row) => row.name === 'High Box Squat');
    assert(squat, `the G-2 session does not name High Box Squat — "low range of motion" is `
      + `the ruling, and a rotated full-range squat is not it: ${rowSummary(workout)}`);
    assert(squat!.sets === 2 && squat!.repsMax === 3,
      `High Box Squat shipped ${squat!.sets}x${squat!.repsMax}, not the authored 2x3 — `
      + 'a phase rep scheme overwrote the dose that IS the exception');
    const jump = rows.find((row) => row.name === 'Vertical Jump');
    assert(jump && jump.sets === 2 && jump.repsMax === 3,
      `the composed G-2 session is missing the authored 2x3 Vertical Jump: ${rowSummary(workout)}`);
  });

  // ── G5 — THE RULING'S OWN ENFORCEMENT. A healthy week must not move a byte.
  // The exception is a FALLBACK: it never displaces a week that already fits.
  scenario('g5', 'G5 a healthy Saturday-game week never reaches the G-2 exception', async () => {
    const healthy = matrixWorld({ gameDay: 'Saturday', restricted: [] });
    assert(healthy.qualityLowerDays.length === 0,
      `a HEALTHY week placed the G-2 quality-lower on ${healthy.qualityLowerDays.join(', ')} — `
      + 'the exception has become a default, which is exactly what ruling V2 forbids');
    // And a lower-body restriction must not reach it either: upper is safe, so
    // G-2 carries upper work as it always has.
    const lowerHurt = matrixWorld({ gameDay: 'Saturday', restricted: ['lower_body'] });
    assert(lowerHurt.qualityLowerDays.length === 0,
      'a LOWER-body restriction reached the quality-lower exception — the branch is '
      + 'for a slot with no upper substitute, not for any injury at all');
  });

  // ── G6 — WORLD 3: genuine exhaustion. Every main-strength pattern is paused,
  // so there is no safe work of that kind to place anywhere and the typed
  // frequency reduction is the honest answer. Witnessed HERE and nowhere else.
  scenario('g6', 'G6 a genuinely exhausted week authorises the typed main-strength frequency reduction', async () => {
    const exhausted = matrixWorld({
      gameDay: 'Saturday', restricted: ['upper_body', 'lower_body'],
    });
    assert(exhausted.reductionMetrics.includes('main_strength_frequency'),
      'every main-strength pattern is paused and no typed main_strength_frequency '
      + `reduction was authorised: ${exhausted.reductionMetrics.join(', ')}`);
    assert(exhausted.qualityLowerDays.length === 0,
      'a week with no safe squat placed the quality-lower anyway — the authored shape '
      + 'is squat-family, and building it out of banned movements would be a primer in '
      + 'name only');
  });

  // ── G8 — SAM'S LAST-RESORT RULING, PINNED (2026-08-06, verbatim):
  //
  //   "the app should not prefer to do g-2 box jumps and vertical jump though,
  //    it should try and get it on g-3 or earlier but as a last resort it's okay"
  //
  // Same injury, same fixture as G2 — the ONLY difference is that Wednesday is
  // available, and Wednesday is G-3, non-team, and legal for ordinary lower
  // strength (`lower_strength_g3` state 3). An earlier eligible day exists, so
  // the lower work belongs THERE and the G-2 quality session must not be built.
  scenario('g8', 'G8 an earlier eligible day takes the lower work, and the G-2 quality session is NOT built', async () => {
    const world = matrixWorld({
      gameDay: 'Saturday',
      restricted: ['upper_body'],
      profileOverrides: {
        trainingDaysPerWeek: 6,
        preferredTrainingDays: [
          'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
        ],
      },
    });
    assert(world.qualityLowerDays.length === 0,
      'an earlier eligible day (Wednesday, G-3, non-team) was free and the app built '
      + `the G-2 quality session anyway, on [${world.qualityLowerDays.join(', ')}]. `
      + 'Sam: it "should try and get it on g-3 or earlier"; G-2 is the LAST resort, '
      + 'not the first choice.');
  });

  // ── G7 — END TO END on the seeded world, through the same re-derivation boot
  // runs. This is the cell the R5.1 switchover makes the shipping path: before
  // the fix it threw `planner_selected_target_miss:main_strength:2` outright.
  scenario('g7', 'G7 the seeded severe-upper world re-derives to a full, admissible week with no husk', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const result = await reportInjury('upper_body', 9);
    assert((result as { ok?: boolean }).ok === true,
      `the injury was rejected: "${(result as { message?: string }).message}"`);
    // The derive path, not the door's replan — the same body boot runs.
    await quietAsync(() => rebuildDerivedWorld());

    const week = acceptedWeek(SPENT_WEEK_1);
    assert(week.blockingViolations.length === 0,
      `the re-derived week carries ${week.blockingViolations.length} blocking violation(s): `
      + week.blockingViolations.join('  '));

    const state = useProgramStore.getState();
    const rebased = rebaseAcceptedEffectiveWeek({
      surfaces: state as never,
      weekStart: SPENT_WEEK_1,
      profile: useProfileStore.getState().onboardingData,
      markedDays: state.acceptedMaterialContext.markedDays,
    });
    const exposure = (rebased.contract as never as {
      mainStrength?: { exposure?: { achievedCount?: number; plannerSelectedTarget?: number } };
    }).mainStrength?.exposure;
    assert(exposure?.achievedCount === exposure?.plannerSelectedTarget,
      `the week achieved ${exposure?.achievedCount} main-strength sessions against a `
      + `selected target of ${exposure?.plannerSelectedTarget}`);

    // RULING 4a, DELIVERED — and this cell now asserts it BY NAME.
    //
    // Sam, 2026-08-06: "The authored 2x3 Vertical Jump half is EXEMPT from the
    // weekly power budget when it ships as part of the G-2 quality-lower
    // session." Both halves of the authored prescription must reach the
    // athlete: the squat AND the jump. Asserting the row COUNT would pass on a
    // week that shipped two squats, so the assertion is on the movements by
    // name — the same reason G4 names them (a mutation that satisfied the shape
    // validator shipped a full-range Back Squat two days before a game).
    //
    // THE THIRD OWNER, found by instrumentation and now fixed at the owner:
    // `section18AcceptedWeekGateway.weeklyPowerBudget`. Measured on this world
    // before the fix — `budget=0` (a fixture plus two team trainings), and the
    // G-2 day is a candidate with `tooClose=true` AND `anchorDay=true`, so it
    // could never be kept and was stripped:
    //
    //   [gateway] budget=0 candidates=["d4/variant=quality_low_volume/
    //             tooClose=true/anchorDay=true"] keep=0
    //   [gateway] >>> STRIPPING d4 variant=quality_low_volume
    //
    // The two suspects the boundary report named were both REFUTED by probe:
    // `contract.safety.prohibitedPower` is FALSE here (so neither finaliser
    // site fires), and the canonicalisation re-decide never removes the row
    // (`IN=1 OUT=1`, and `updatePowerForPhase`'s removal branch never fires —
    // `gMinusTwoBlocked` is false for a 5+ years athlete). The gateway was a
    // THIRD reader of the weekly-budget question with its own copy of it.
    const g2Day = rebased.visibleWorkouts.find((workout) => workout.dayOfWeek === 4);
    const g2Names = (g2Day?.exercises ?? []).map((row) =>
      String((row as { exercise?: { name?: string } }).exercise?.name ?? row.exerciseId));
    for (const movement of ['High Box Squat', 'Vertical Jump']) {
      assert(g2Names.includes(movement),
        `the G-2 quality-lower session does not ship "${movement}" to the athlete. `
        + `d4 rows: [${g2Names.join(', ')}]`);
    }

    // THE HUSK, as a standing law: no session may carry a strength component
    // while carrying no rows to put in it.
    const husks = rebased.visibleWorkouts.filter((workout) =>
      (workout.exercises ?? []).length === 0 &&
      getSessionComponents(workout as never)
        .some((component: { id: unknown }) => String(component.id) === 'strength'));
    assert(husks.length === 0,
      `${husks.length} session(s) ship a strength component with zero rows: `
      + husks.map((workout) => `d${workout.dayOfWeek}`).join(', '));

    // SAM'S SIGNED COACH NOTE reaches the athlete, and it says what he SIGNED.
    // The sentence is composed (the day, the body part and the fixture day all
    // vary by world), so this pins the RENDERED result byte-for-byte against
    // the quote in the signing doc — composition that drifts by one character
    // is a reworded signed sentence, which is not this seat's to do.
    const noteDays = rebased.visibleWorkouts.map((workout) => {
      const date = new Date(`${SPENT_WEEK_1}T12:00:00`);
      date.setDate(date.getDate() + (workout.dayOfWeek - 1));
      return { date: date.toISOString().slice(0, 10), workout: workout as never };
    });
    const notes = buildDeterministicCoachNoteDescriptors(noteDays);
    const g2Note = notes.find((note) => note.sourceId.startsWith('injury_game_proximity:'));
    assert(!!g2Note, 'the G-2 quality-lower session ships no Coach Note. notes: '
      + notes.map((note) => note.sourceId).join(', '));
    const SIGNED = 'Your Thursday session is deliberately small this week: your shoulder '
      + 'is paused and there is a game on Saturday, so it is a short, sharp lower session '
      + 'instead of a full one.';
    assert(g2Note!.body === SIGNED,
      `the composed Coach Note is not Sam's signed sentence.\n  signed: ${SIGNED}\n  shipped: ${g2Note!.body}`);

    // THE COUNTING HALF IS NOT PINNED HERE, AND THIS CELL DOES NOT PRETEND IT
    // IS. An assertion on `contract.power.achievedPrimerCount` was written,
    // measured, and REMOVED as vacuous: the gateway's count is overwritten by
    // `section18EffectiveWeekEvaluator:1027` from its own ledger, so the value
    // this cell could read is the EVALUATOR's, never the gateway's. Mutating
    // the gateway's count back to `hasPowerRow` leaves it green — and mutating
    // the evaluator's ledger predicate is already caught by the
    // blocking-violations assertion above (`reduction_contradiction:power:1`).
    //
    // So the gateway's three non-strip power sites (what competes for the
    // budget, what is counted, what the repair detail reports) have NO
    // observable surface from here. What enforces them instead is that
    // `hasPowerRow` is no longer imported into that module at all — a compile
    // gate, not a test. Declared rather than papered over: keeping the
    // assertion would have been a cell passing on coordinates it never builds.
  });

  // ── I1 — the headline. An upper-body 8/10 must be RECORDED. Nothing about
  // an athlete telling the app their shoulder is badly hurt is conditional on
  // the app's ability to produce an admissible week from it.
  scenario('i1', 'I1 an upper-body 8-10/10 injury is recorded (fact, episode and activeInjury)', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const result = await reportInjury('upper_body', 9);
    assert((result as { ok?: boolean }).ok === true,
      `the injury was rejected: "${(result as { message?: string }).message}"`);
    const state = recordedState();
    assert(state.activeInjury, 'activeInjury is null — the app has no memory that the athlete is hurt');
    assert(state.episodes === 1, `expected 1 injury episode, found ${state.episodes}`);
    assert(state.facts >= 1, `expected a durable injury fact, found ${state.facts}`);
  });

  // ── I2 — region scoping. Sam's ruling in one assertion: a shoulder does not
  // stop someone running. The team trainings and the game keep normal
  // participation, so their conditioning and sprint credit survives, and the
  // week stays admissible without any gate exception. This is the invariant
  // that makes I1 possible rather than a symptom fix on top of it.
  scenario('i2', 'I2 an upper-body injury does not withdraw team-training or game conditioning/sprint credit', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const before = currentWeekContract();
    const beforeNormal = before.anchors.filter((a) => a.participation === 'normal_unrestricted').length;
    assert(beforeNormal === before.anchors.length && before.anchors.length > 0,
      'the seed did not start with every anchor at normal participation');

    const result = await reportInjury('upper_body', 9);
    assert((result as { ok?: boolean }).ok === true,
      `the injury was rejected: "${(result as { message?: string }).message}"`);

    const after = currentWeekContract();
    const withdrawn = after.anchors.filter((anchor) =>
      anchor.currentProductionClaim.conditioning === false ||
      anchor.currentProductionClaim.sprintHighSpeed === false);
    assert(withdrawn.length === 0,
      `an upper-body injury withdrew field credit from ${withdrawn.length} anchor(s): ` +
      withdrawn.map((a) => `${a.kind}@${a.dayOfWeek}:${a.participation}`).join(', '));

    // And the affected region IS restricted — region scoping must not become
    // "the injury changes nothing". Asserted against the safety policy, which is
    // the owner Stage 2a changed. Whether the restriction then reaches the
    // athlete's visible week is materialisation, pinned separately by I6.
    const policy = applyGenerationSafetyToSection18Contract({
      contract: JSON.parse(JSON.stringify(before)),
      generationConstraints: {
        injuries: [{
          region: 'upper_body', injuryKeys: ['shoulder'], severity: 9, 
          pauseAffectedTraining: true, removeRiskyWork: true,
        }],
      } as never,
    });
    const prohibited = policy.strengthPatterns.prohibitedPatterns ?? [];
    assert(prohibited.includes('push') && prohibited.includes('pull'),
      `an 8-10/10 upper-body injury did not prohibit push/pull (got ${JSON.stringify(prohibited)})`);
    assert(!prohibited.includes('squat') && !prohibited.includes('hinge'),
      `an upper-body injury prohibited lower-body patterns (got ${JSON.stringify(prohibited)})`);
  });

  // ── I6 — MATERIALISATION. RED and quarantined by Sam's sequencing: the
  // committed week must actually stop prescribing the affected work.
  //
  // Stage 2a makes the injury RECORDABLE, which is what the ruling asked for and
  // is the difference between the app knowing the athlete is hurt and not. It
  // does not make the injury VISIBLE: the injury path validates the existing
  // base against a stricter contract and never re-authors content, so the
  // shoulder-injured athlete's Monday pressing session is still on screen. That
  // is rider 0's divergence 3, and it is the same missing owner as the
  // partly-spent week in Stage 1's T4 — both are answered by the §18
  // elapsed-week / materialisation reassessment, not by another line here.
  scenario('i6', 'I6 [QUARANTINED] the committed week for an upper-body 8-10/10 stops prescribing push/pull', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const result = await reportInjury('upper_body', 9);
    assert((result as { ok?: boolean }).ok === true,
      `the injury was rejected: "${(result as { message?: string }).message}"`);
    const prohibited = currentWeekContract().strengthPatterns.prohibitedPatterns ?? [];
    assert(prohibited.includes('push') && prohibited.includes('pull'),
      `the committed week carries no push/pull prohibition (got ${JSON.stringify(prohibited)}) — ` +
      'the injury was recorded but the week was never re-authored');
  });

  // ── I3 — the whole matrix. The trigger was never the severity band: it is
  // "any injury that prohibits a main-strength pattern", i.e. >=6/10 in any
  // region. Pinning every cell is what stops the fix being tuned to 8-10.
  for (const region of ['upper_body', 'lower_body', 'back_midline'] as const) {
    for (const severity of [2, 5, 7, 9]) {
      scenario(`i3-${region}-${severity}`,
        `I3 ${region} ${severity}/10 is recorded`, async () => {
          seedSpentWeekFriday();
          await markSpentDaysDone();
          const result = await reportInjury(region, severity);
          assert((result as { ok?: boolean }).ok === true,
            `${region} ${severity}/10 was rejected: "${(result as { message?: string }).message}"`);
          const state = recordedState();
          assert(state.activeInjury && state.episodes === 1,
            `${region} ${severity}/10 committed but recorded nothing (activeInjury=${!!state.activeInjury}, episodes=${state.episodes})`);
        });
    }
  }

  // ── I4 — B4, as restated in Addendum A. Withdrawing production credit and
  // authorising the matching typed reduction are ONE decision. No contract may
  // reach the gate claiming both "this no longer produces X" and "this week
  // requires X" — that is unsatisfiable by construction, and it is precisely
  // what destroyed the athlete's injury report.
  //
  // Behavioural, not a source scan: it drives the real safety policy across the
  // injury matrix and inspects the contract it produces, so it holds however the
  // implementation is refactored.
  scenario('i4', 'I4 no contract withdraws anchor credit for a domain without authorising a reduction in it', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const baseline = currentWeekContract();
    const offenders: string[] = [];

    for (const region of ['upper_body', 'lower_body', 'back_midline'] as const) {
      for (const severity of [2, 5, 7, 9]) {
        const contract = applyGenerationSafetyToSection18Contract({
          contract: JSON.parse(JSON.stringify(baseline)),
          generationConstraints: {
            injuries: [{
              region,
              injuryKeys: [],
              severity,
              pauseAffectedTraining: severity >= 8,
              removeRiskyWork: severity >= 6,
            }],
          } as never,
        });
        const claims = (domain: 'conditioning' | 'sprintHighSpeed') =>
          contract.anchors.filter((anchor) => anchor.currentProductionClaim[domain] === false).length;
        const authorised = (metric: string) =>
          contract.authorisedReductions.some((reduction) => reduction.metric === metric);

        if (claims('conditioning') > 0 && !authorised('conditioning_core_frequency')) {
          offenders.push(`${region}/${severity}: ${claims('conditioning')} anchor(s) lost conditioning credit with no conditioning_core_frequency reduction`);
        }
        if (claims('sprintHighSpeed') > 0 && !authorised('sprint_high_speed_frequency')) {
          offenders.push(`${region}/${severity}: ${claims('sprintHighSpeed')} anchor(s) lost sprint credit with no sprint_high_speed_frequency reduction`);
        }
      }
    }
    assert(offenders.length === 0,
      `${offenders.length} unsatisfiable contract(s):\n    ${offenders.join('\n    ')}`);
  });

  // ── I5 — the week the athlete is left with must actually be admissible, and
  // it must still be an in-season week rather than something the gate salvaged.
  // I1 could in principle be satisfied by a week that limps; this says it does
  // not.
  scenario('i5', 'I5 the week after an upper-body 8-10/10 injury is admissible with no blocking violations', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const result = await reportInjury('upper_body', 9);
    assert((result as { ok?: boolean }).ok === true,
      `the injury was rejected: "${(result as { message?: string }).message}"`);
    const week = acceptedWeek(SPENT_WEEK_1);
    assert(week.blockingViolations.length === 0,
      `the accepted week carries ${week.blockingViolations.length} blocking violation(s): ${week.blockingViolations.join('  ')}`);
  });
}

async function runOne(id: string): Promise<void> {
  registerScenarios();
  const target = scenarios.find((entry) => entry.id === id);
  if (!target) { console.error(`unknown scenario id: ${id}`); process.exit(2); }
  await run(target.name, target.body);
  // A child's REPORT is the `PASS/FAIL [invariant]` verdict line `run` printed —
  // that is the line the parent greps, so it is this process's totals line.
  totalsPrinted(failures.length);
  if (failures.length > 0) process.exit(1);
}

async function main(): Promise<void> {
  const only = process.env.INJURY_ONLY;
  if (only) { await runOne(only); return; }
  registerScenarios();
  runScenariosForked({
    title: 'Stage 2a: injury authority ownership (region-scoped anchor participation)',
    scenarioIds: scenarios.map((entry) => entry.id),
    envVar: 'INJURY_ONLY',
    filename: __filename,
  });
  // The parent's totals line is printed inside `runScenariosForked` (shared
  // support, not this suite's to edit). That helper prints unconditionally and
  // then exits 1 on any failure, so RETURNING from it is reachable only by way
  // of the print and only with zero failures — the clear is anchored to the
  // report, not to the guard.
  totalsPrinted(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
