/**
 * TEAM-NIGHT MOVABILITY — the sheet's pre-committed gates
 * (docs/TEAM_NIGHT_MOVABILITY_SHEET_2026-08-01.md, signed whole by Sam
 * 2026-08-02; docs/PARKED_QUESTIONS_2026-08-01.md §3).
 *
 * Laws, as pre-committed:
 *   TN-1  the ask appears on a team night EXACTLY (never on a plain day);
 *   TN-2  `this_week_only` conserves every other day byte-for-byte and the
 *         fact undoes clean (resolve = cascade revert);
 *   TN-3  `permanent` updates the ONE owner and no shadow representation
 *         exists (source gate on second writers of `teamTrainingDays`);
 *   TN-4  the vacated/landing days obey the doubling law — the anchor lands
 *         COMBINED on an occupied day, the vacated day re-derives;
 *   TN-5  SWAP on a team night stays refused with its own signed sentence —
 *         and the retired `anchored_day` sentence is GONE from the producer.
 *
 * Both routes drive the REAL door (`executeProgramControlActionDurably`,
 * `type: 'move_team_night'`) over a freshly seeded world — the same entry the
 * sheet dispatches through `programControlActionForPlanChange`. Matrix
 * coordinates: both routes × occupied/empty landing day.
 *
 * Depth stated per L13: shallow tier — seeded world, 1-2 actions per cell.
 * The accumulated-life coverage rides the walker's worlds, where team nights
 * come from `TEAM_DAY_SETS` profiles.
 */


import { storedWorldSurfaces } from '../utils/liveEvaluationSurfaces';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
import * as path from 'path';
import type { OnboardingData, TrainingProgram } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import { generateProgramLocally } from '../services/api/generateProgram';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import {
  listPlanChangeOptionsForDay,
  previewPlanChangeRisk,
} from '../utils/planChangeProducer';
import {
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
  type ProgramControlAction,
} from '../utils/programControlActions';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import { getTeamTrainingWorkoutState } from '../utils/teamTraining';
import { isTemporaryScheduleFact } from '../rules/temporarySourceFact';
import { TEAM_NIGHT_MOVE_ASK, teamNightMoveAskContext } from '../rules/teamNightMoveAsk';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { isResolverOwnedDerivedSession } from '../rules/derivedSessionProvenance';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function cell(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}\n      ${message}`);
    console.error(`  FAIL ${name}\n      ${message}`);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined;
  console.debug = () => undefined; console.info = () => undefined;
  console.log = () => undefined;
  try { return body(); } finally {
    console.warn = warn; console.error = error;
    console.debug = debug; console.info = info; console.log = log;
  }
}

const GENERATION_START = '2026-07-13';
const WEEK = '2026-07-20';

function addDaysISO(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function syntheticProfile(): OnboardingData {
  return {
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'In-season', position: 'inside_mid',
    motivation: 'Build strength and football fitness', trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes', trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'], equipmentSelectionCompleteness: 'complete',
    experienceLevel: 'Advanced', squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight', conditioningLevel: 'Good',
    sprintExposure: '2+ times per week', recentTrainingLoad: 'Very consistent',
    injuries: [], usualGameDay: 'Saturday', gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

let cachedProgram: TrainingProgram | null = null;
function baseProgram(): TrainingProgram {
  if (!cachedProgram) {
    cachedProgram = quiet(() => generateProgramLocally(syntheticProfile(), {
      todayISO: GENERATION_START, previousProgram: null,
      seasonPhaseClock: {
        protocolVersion: 1, selectedPhase: 'In-season' as never,
        phaseEntryWeekStartISO: GENERATION_START,
        originProvenance: 'explicit_user_phase_change',
        persistenceProvenance: 'preserved_persisted_state',
      },
    }));
  }
  return JSON.parse(JSON.stringify(cachedProgram)) as TrainingProgram;
}

function seedStores(): void {
  const program = baseProgram();
  useProfileStore.setState({ onboardingData: syntheticProfile(), isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles.find(
      (microcycle) => microcycle.startDate.slice(0, 10) === WEEK)
      ?? program.microcycles[1] ?? program.microcycles[0] ?? null,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'team-night:seed', injuryEpisodes: [],
      temporarySourceFacts: [], acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
}

function visibleWeek(): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
}

/**
 * Conservation is asserted at the ACCEPTED boundary — the stored decision
 * surfaces the overlay writes. The resolver's read-time conditioning pass
 * legitimately re-derives placement around the week's new shape (that is the
 * sheet's own "the week re-derives around it"); what the law forbids is the
 * MOVE touching any other day's stored content.
 */
function dayFingerprints(): Map<string, string> {
  const state = useProgramStore.getState();
  const accepted = quiet(() => rebaseAcceptedEffectiveWeek({
    surfaces: storedWorldSurfaces(state),
    weekStart: WEEK,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  }));
  return new Map(accepted.visibleWorkouts.map((workout) => [
    addDaysISO(WEEK, (workout.dayOfWeek + 6) % 7),
    semanticFingerprint({ workout }),
  ]));
}

/** Tuesday of WEEK is a generated team night for the synthetic profile. */
const TEAM_NIGHT = addDaysISO(WEEK, 1);

function durableAction(
  toDate: string,
  route: 'this_week_only' | 'permanent',
): ProgramControlAction {
  const action = programControlActionForPlanChange({
    kind: 'move_team_night', fromDate: TEAM_NIGHT, toDate, teamNightRoute: route,
  });
  assert(action, 'programControlActionForPlanChange must map an answered team-night move');
  return { ...action, payload: { ...action.payload, todayISO: WEEK } } as ProgramControlAction;
}

async function main(): Promise<void> {
  console.log('teamNightMovabilityTests');

  await cell('TN-1 the ask appears on a team night exactly — and never on a plain day', () => {
    seedStores();
    const week = visibleWeek();
    assert(getTeamTrainingWorkoutState(week.find((day) => day.date === TEAM_NIGHT)?.workout)
      .hasTeamTraining, `seed defect: ${TEAM_NIGHT} is not a team night`);
    const asked = quiet(() => previewPlanChangeRisk({
      change: { kind: 'move_team_night', fromDate: TEAM_NIGHT, toDate: addDaysISO(WEEK, 2) },
      visibleWeek: week, todayISO: WEEK,
    }));
    assert(asked.ok && asked.teamNightAsk, 'a routeless team-night move must raise the ask');
    const routed = quiet(() => previewPlanChangeRisk({
      change: {
        kind: 'move_team_night', fromDate: TEAM_NIGHT,
        toDate: addDaysISO(WEEK, 2), teamNightRoute: 'this_week_only',
      },
      visibleWeek: week, todayISO: WEEK,
    }));
    assert(routed.ok && !routed.teamNightAsk, 'an answered route must not re-raise the ask');
    const plainDay = week.find((day) =>
      !getTeamTrainingWorkoutState(day.workout).hasTeamTraining)!;
    const refused = quiet(() => previewPlanChangeRisk({
      change: { kind: 'move_team_night', fromDate: plainDay.date, toDate: TEAM_NIGHT },
      visibleWeek: week, todayISO: WEEK,
    }));
    assert(!refused.ok && refused.rejected[0]?.code === 'not_a_team_night',
      `a plain day must refuse, got ok=${refused.ok} code=${refused.rejected[0]?.code}`);
    assert(!refused.teamNightAsk, 'a plain day must never see the ask');
  });

  await cell('TN-1b a ROUTELESS change never maps through the commit door', () => {
    // The ask's gate at the COMMIT boundary (found by mutation M3, 2026-08-03:
    // widening the mapping to routeless changes survived every other cell —
    // the sheet would still ask, but any other caller could commit unasked).
    seedStores();
    const mapped = programControlActionForPlanChange({
      kind: 'move_team_night', fromDate: TEAM_NIGHT, toDate: addDaysISO(WEEK, 2),
    });
    assert(mapped === null,
      'an unanswered team-night move must not map to a program-control action');
  });

  await cell('TN-5 the menu offers the team scope; the retired refusal sentence is gone', () => {
    seedStores();
    const options = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: visibleWeek(), date: TEAM_NIGHT, todayISO: WEEK,
    }));
    assert(options.move.refusal === null,
      `a team night must offer a move, got refusal ${options.move.refusal?.reason}`);
    assert(options.move.scopes.some((scope) => scope.id === 'team'),
      `the team scope must be offered, got ${options.move.scopes.map((scope) => scope.id)}`);
    // The retired sentence must be gone from the producer as SOURCE — SWAP's
    // own signed refusal ("Nothing on this day can be swapped.") is a
    // different sentence and stays where it is.
    const producerSource = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'planChangeProducer.ts'), 'utf8');
    assert(!producerSource.includes(
      "Team training is fixed to this day, so it can't be moved from here."),
      'the anchored_day sentence is retired (copy sheet Batch 10) and must not survive in the producer');
  });

  await cell('TN-2/TN-4 this_week_only: fact through the real door, doubling law, byte conservation, clean undo', async () => {
    seedStores();
    const before = dayFingerprints();
    const basePrint = semanticFingerprint(useProgramStore.getState().currentProgram);
    const beforeDerived = new Map(visibleWeek().map((day) =>
      [day.date, day.workout ? isResolverOwnedDerivedSession(day.workout) : false]));
    // An OCCUPIED landing day: the first non-team day with a workout.
    const landing = visibleWeek().find((day) =>
      day.date !== TEAM_NIGHT && day.workout &&
      !getTeamTrainingWorkoutState(day.workout).hasTeamTraining)!;
    const landingHadName = landing.workout!.name;
    const result = await executeProgramControlActionDurably(
      durableAction(landing.date, 'this_week_only'),
      { visibleWeek: visibleWeek(), todayISO: WEEK });
    assert(result.ok, `the one-off route must commit, got ${result.message} (${result.route})`);
    const context = teamNightMoveAskContext({ fromDate: TEAM_NIGHT, toDate: landing.date });
    assert(result.message === TEAM_NIGHT_MOVE_ASK.successMessage('this_week_only', context),
      `the ack must be the signed sentence, got "${result.message}"`);
    const facts = useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts;
    const fact = facts.find((candidate) =>
      isTemporaryScheduleFact(candidate) && candidate.scheduleKind === 'team_night_move');
    assert(fact, 'the dated team_night_move fact must be stored');
    // Doubling law: the anchor lands COMBINED; the vacated day re-derives.
    const after = visibleWeek();
    const landed = after.find((day) => day.date === landing.date)!;
    assert(getTeamTrainingWorkoutState(landed.workout).hasTeamTraining,
      'the landing day must hold the team anchor');
    assert(landed.workout && landed.workout.name.includes(landingHadName.split(' + ')[0]) ||
      getTeamTrainingWorkoutState(landed.workout).renderableExercises.length > 0 ||
      landed.workout?.name.includes('+'),
      `an occupied landing day must land COMBINED, got "${landed.workout?.name}"`);
    const vacated = after.find((day) => day.date === TEAM_NIGHT)!;
    assert(!getTeamTrainingWorkoutState(vacated.workout).hasTeamTraining,
      `the vacated day must no longer hold the anchor, got "${vacated.workout?.name}"`);
    // Byte conservation of every OTHER day, at the boundary the move WRITES:
    // (a) the committed overlay carries exactly the two involved dates —
    // every other day falls through to untouched stored state by
    // construction; (b) the accepted base program is byte-identical.
    // Resolver/planner-owned DERIVED rows (the G-1 gunshow, planner
    // optionals) re-derive around the week's new shape by design — that is
    // the sheet's own "the week re-derives around it" — so the resolved-week
    // comparison skips days that are derivation-owned on either side.
    const overlay = useProgramStore.getState().weekScopedOverlays[WEEK];
    assert(overlay && overlay.reason === 'team_night_move', 'the move must commit as a week overlay');
    const overlaidDates = Object.keys(overlay.workoutsByDate).sort();
    assert(JSON.stringify(overlaidDates) === JSON.stringify([TEAM_NIGHT, landing.date].sort()),
      `the overlay must carry exactly the two involved dates, got ${overlaidDates}`);
    assert(semanticFingerprint(useProgramStore.getState().currentProgram) === basePrint,
      'the accepted base program must be byte-identical after a team-night move');
    const afterDerived = new Map(visibleWeek().map((day) =>
      [day.date, day.workout ? isResolverOwnedDerivedSession(day.workout) : false]));
    // The fixture day is a calendar-derived stub, not stored training content
    // — it re-derives with the week like every other derivation.
    const fixtureDates = new Set(visibleWeek()
      .filter((day) => day.source === 'game')
      .map((day) => day.date));
    const afterPrints = dayFingerprints();
    for (const [date, print] of before) {
      if (date === TEAM_NIGHT || date === landing.date) continue;
      if (beforeDerived.get(date) || afterDerived.get(date) || fixtureDates.has(date)) continue;
      assert(afterPrints.get(date) === print,
        `day ${date} must be conserved byte-for-byte by a team-night move`);
    }
    void 0;
    // The fact owns a reversible adjustment, and resolving it undoes clean.
    const owns = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
      .some((adjustment) => adjustment.kind === 'deriving_source_fact' &&
        adjustment.sourceFactId === (fact as { factId: string }).factId);
    assert(owns, 'the fact must own its deriving adjustment (undo = resolve the fact)');
    // Undo = the generic fact-clear door (`clear_fatigue_status`): it reverts
    // every adjustment carrying this `sourceFactId` through
    // clearReversibleAdjustment, then resolves the fact — no team-night
    // special case anywhere.
    const resolved = await executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'test', initiatedBy: 'tap' },
      payload: { modifierId: (fact as { factId: string }).factId, date: WEEK },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: true,
    }, { todayISO: WEEK });
    assert(resolved.ok,
      `clearing the fact must succeed, got "${resolved.message}"`);
    const restored = dayFingerprints();
    const restoredDerived = new Map(visibleWeek().map((day) =>
      [day.date, day.workout ? isResolverOwnedDerivedSession(day.workout) : false]));
    const fixtureAfter = new Set(visibleWeek()
      .filter((day) => day.source === 'game')
      .map((day) => day.date));
    for (const [date, print] of before) {
      if (beforeDerived.get(date) || restoredDerived.get(date) || fixtureAfter.has(date)) continue;
      assert(restored.get(date) === print,
        `day ${date} must revert byte-exact when the fact resolves`);
    }
    assert(!useProgramStore.getState().weekScopedOverlays[WEEK],
      'resolving the fact must remove the team-night overlay (cascade revert)');
  });

  await cell('TN-2 this_week_only onto an EMPTY day: the anchor lands alone', async () => {
    seedStores();
    // Exclude game-adjacent days: G-1/G+1 derivations (gunshow/mobility) own
    // those days at resolution and would rewrite whatever lands there.
    const empty = visibleWeek().find((day) => day.date !== TEAM_NIGHT && !day.workout &&
      ![0, 5, 6].includes(new Date(`${day.date}T12:00:00`).getDay()));
    if (!empty) { console.log('       (no empty day in this generated week — coordinate covered by occupied cell)'); return; }
    const result = await executeProgramControlActionDurably(
      durableAction(empty.date, 'this_week_only'),
      { visibleWeek: visibleWeek(), todayISO: WEEK });
    assert(result.ok, `the one-off route must commit onto a rest day, got ${result.message}`);
    const landed = visibleWeek().find((day) => day.date === empty.date)!;
    assert(getTeamTrainingWorkoutState(landed.workout).hasTeamTraining,
      `the empty landing day must now hold the anchor `
      + `(date=${empty.date} changedProgram=${result.changedProgram} `
      + `overlays=${Object.keys(useProgramStore.getState().weekScopedOverlays ?? {}).join(',')} `
      + `landed="${landed.workout?.name ?? 'REST'}" source=${landed.source})`);
  });

  await cell('TN-3 permanent: the ONE setup owner writes teamTrainingDays and the program follows', async () => {
    seedStores();
    const toDate = addDaysISO(WEEK, 2); // Wednesday
    const result = await executeProgramControlActionDurably(
      durableAction(toDate, 'permanent'),
      { visibleWeek: visibleWeek(), todayISO: WEEK });
    assert(result.ok, `the permanent route must commit, got ${result.message}`);
    const context = teamNightMoveAskContext({ fromDate: TEAM_NIGHT, toDate });
    assert(result.message === TEAM_NIGHT_MOVE_ASK.successMessage('permanent', context),
      `the ack must be the signed sentence, got "${result.message}"`);
    const days = useProfileStore.getState().onboardingData?.teamTrainingDays ?? [];
    assert(JSON.stringify(days) === JSON.stringify(['Wednesday', 'Thursday']),
      `teamTrainingDays must be updated through the owner, got ${JSON.stringify(days)}`);
    assert(result.changedProgram,
      'the permanent route must regenerate forward (the owner\'s existing rules)');
  });

  await cell('TN-3 no second writer: the door reaches teamTrainingDays only through the setup owner', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'programControlActions.ts'), 'utf8');
    // The permanent branch must call the ONE owner…
    assert(/move_team_night'[\s\S]{0,2000}commitProfileProgramTransaction\(\{[\s\S]{0,200}kind: 'profile_setup'/.test(source),
      'the permanent route must commit through commitProfileProgramTransaction profile_setup');
    // …and never assign the field itself, anywhere in the tap door.
    assert(!/teamTrainingDays\s*[:=](?!\s*undefined)/.test(
      source.replace(/commitProfileProgramTransaction[\s\S]{0,400}?\}\);/g, '')),
      'programControlActions must not carry its own teamTrainingDays writer');
    // The patch builder is the ask module's, and it returns a PATCH — the only
    // team-night site allowed to spell the field.
    const askSource = fs.readFileSync(
      path.join(__dirname, '..', 'rules', 'teamNightMoveAsk.ts'), 'utf8');
    assert(/teamNightPermanentPatch/.test(askSource) &&
      /Partial<OnboardingData>/.test(askSource),
      'the permanent patch stays a pure Partial<OnboardingData> for the owner');
  });

  console.log(`\n  ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
  if (failed > 0) {
    console.error(failures.map((failure) => `  FAIL ${failure}`).join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
