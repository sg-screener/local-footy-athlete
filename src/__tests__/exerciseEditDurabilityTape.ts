/**
 * DOES AN ATHLETE'S OWN EXERCISE EDIT SURVIVE A RELAUNCH?
 *
 * THE CLAIM UNDER TEST IS AN INFERENCE, AND THAT IS WHY THIS EXISTS.
 * `docs/COACH_REBUILD_SURVEY_2026-08-09.md` §5.2 states that a today-only
 * exercise edit does not survive a relaunch, and its own §9.8 files that as an
 * INFERENCE rather than a finding: it follows from three separately-measured
 * facts — `partialize` omits `dateOverrides`, `rebuildDerivedWorld` empties it,
 * and no exercise path appends a decision — that **have never been observed
 * together**. `docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md` §8 makes
 * measuring it the first act of the ledger-doors unit, before a line is built
 * against it. A premise stated as a mechanism is still a claim.
 *
 * WHAT IS MEASURED, and it is deliberately the smallest honest thing: one
 * exercise-level edit, landed through the real athlete door, then a real
 * process death and boot.
 *
 *   BEFORE  — generated, nothing edited. The floor.
 *   ACTED   — after ONE `remove_exercise` lands through
 *             `executeProgramControlActionDurably`.
 *   BOOTED  — after the heap dies, the disk is restored, and the boot derives.
 *
 * WHY `remove_exercise` AND NOT `swap_exercise`. All three exercise-level
 * actions reach the SAME destination — `replaceExerciseAtDate` /
 * `addExerciseAtDate` / `removeExerciseAtDate` all land in
 * `applyProgramOverrideWrite(writer:'program_control')`
 * (`programControlActions.ts:423`, cases at `:665`, `:710`, `:728`) — so the
 * durability question is one question about one surface. A swap additionally
 * passes `assessTapSwapCandidateSafety`, which can refuse for reasons that have
 * nothing to do with durability and would make a refusal look like a result.
 * The probe therefore takes the path with the fewest ways to be misread, and
 * asserts the shared destination directly by photographing `dateOverrides`.
 *
 * THE PROBE ASSERTS ITS OWN PRECONDITIONS, because this is the exact trap
 * LR-29 item 1 lost a day to: "the boot restored it" and "there was nothing to
 * restore" are the same reading unless the acted world DIFFERS from the floor.
 * So ACTED must differ from BEFORE and an override must exist before any
 * verdict is read — otherwise the run prints VACUOUS and stops.
 *
 * AND IT RUNS A CONTROL FIRST. A relaunch with NOTHING edited must reproduce
 * BEFORE. Without that, a boot whose own regeneration diverges would make a
 * perfectly durable edit look lost, and this report would blame the wrong
 * layer — the misattribution the sibling tape's control was added to prevent.
 *
 * This asserts nothing and is NOT in `test:bible`. It prints a measurement.
 *
 * Run: npm run tape:exercise-edit-durability
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};

import type { TrainingProgram, Workout } from '../types/domain';
import { flushPendingStorageWrites, pendingStorageWriteCount } from '../store/asyncStorageCompat';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { useDecisionLedgerStore, decisionLedgerEntries } from '../store/decisionLedgerStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { seedManualOverride } from './support/programOverrideHarness';
import { runQuiescentBoot } from '../store/quiescentBoot';
import {
  samDevicePass20260805Profile,
  SAM_PASS_20260805_TODAY_ISO,
  SAM_PASS_20260805_CURRENT_WEEK,
  SAM_PASS_20260805_ENTRY_WEEK,
  SAM_PASS_20260805_GENERATION_DAY,
  SAM_PASS_20260805_MARKED_DAYS,
} from './support/samDevicePass20260805Fixture';

const TODAY = SAM_PASS_20260805_TODAY_ISO;
const WEEK = SAM_PASS_20260805_CURRENT_WEEK;

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => undefined; console.warn = () => undefined; console.error = () => undefined;
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => undefined; console.warn = () => undefined; console.error = () => undefined;
  try { return await body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

async function settleWrites(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await flushPendingStorageWrites().catch(() => undefined);
    if (pendingStorageWriteCount() === 0) break;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  await flushPendingStorageWrites().catch(() => undefined);
}

/** The sibling tape's world, reached the same way: by ACTING through real doors. */
function reachWorldByActing(): void {
  durable.clear();
  const profile = samDevicePass20260805Profile();
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useDecisionLedgerStore.getState().clear();
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 0, lastTransaction: null,
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') useCalendarStore.getState().setGameDay(date, SAM_PASS_20260805_GENERATION_DAY);
  }
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: SAM_PASS_20260805_GENERATION_DAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: SAM_PASS_20260805_ENTRY_WEEK,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {},
    selectedDate: SAM_PASS_20260805_GENERATION_DAY,
    reason: 'exercise-edit-tape:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

/**
 * The row's display name lives at `row.exercise.name`, NOT at `row.name` — the
 * row is a PRESCRIPTION (`WorkoutExercise`: sets, reps, load) that points at an
 * exercise. The first run of this tape read `row.name`, got `undefined` for
 * every row, and asked the door to remove `"undefined"`. The door refused and
 * the tape ABORTED rather than printing "the edit did not survive", which is
 * the only reason that mistake cost nothing: a probe that cannot act must never
 * be readable as a probe that acted and lost.
 */
function exercisesOn(date: string): string[] {
  const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
  const day = week.find((entry) => entry.date === date);
  const workout = day?.workout as Workout | null | undefined;
  return (workout?.exercises ?? []).map(
    (row) => (row as unknown as { exercise?: { name?: string } }).exercise?.name ?? '(unnamed)',
  );
}

/** A future day carrying at least two exercises — removing from a one-exercise
 *  day risks the day itself changing shape, which is a different measurement. */
function pickTargetDay(): { date: string; exercise: string } {
  const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
  for (const day of week) {
    if (day.date <= TODAY) continue;
    const workout = day.workout as Workout | null | undefined;
    const names = (workout?.exercises ?? []).map(
      (row) => (row as unknown as { exercise?: { name?: string } }).exercise?.name ?? '',
    ).filter(Boolean);
    // A name that appears twice on the day is AMBIGUOUS to the door's matcher
    // and would be refused for a reason unrelated to durability.
    const unique = names.filter((name, index) => names.indexOf(name) === names.lastIndexOf(name) && index === names.indexOf(name));
    if (names.length >= 2 && unique.length >= 1) return { date: day.date, exercise: unique[0]! };
  }
  throw new Error('TAPE ABORT: no future day with two or more exercises — the probe is vacuous');
}

async function actOneExerciseRemoval(target: { date: string; exercise: string }): Promise<void> {
  const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
  const result = await quietAsync(() => executeProgramControlActionDurably({
    type: 'remove_exercise',
    source: { screen: 'session_detail', surface: 'exercise-edit-tape', initiatedBy: 'tap' },
    payload: { date: target.date, exercise: target.exercise },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: true,
    scope: 'today_only',
  } as never, {
    visibleWeek: week,
    todayISO: TODAY,
    applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
  })) as { ok?: boolean; message?: string };
  console.log(`\n   [act] remove_exercise "${target.exercise}" on ${target.date}`);
  console.log(`   [act] ok      : ${result.ok}`);
  if (result.message) console.log(`   [act] message : ${result.message}`);
  if (!result.ok) throw new Error('TAPE ABORT: the edit did not land — there is nothing to measure');
}

async function relaunch(): Promise<void> {
  await settleWrites();
  const disk = new Map(durable);
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [], exposureContractsByWeek: {}, blockState: null,
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
  } as never);
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useDecisionLedgerStore.getState().clear();
  await settleWrites();
  durable.clear();
  for (const [key, value] of disk) durable.set(key, value);
  await quietAsync(async () => {
    await useProgramStore.persist.rehydrate();
    await useCalendarStore.persist.rehydrate();
    await useProfileStore.persist.rehydrate();
    await useCoachUpdatesStore.persist.rehydrate();
    await useDecisionLedgerStore.persist.rehydrate();
  });
  await quietAsync(() => runQuiescentBoot());
  await settleWrites();
}

/**
 * The photograph. The noun is THE EXERCISES ON ONE DAY, printed as a list and
 * never as a length — `a count taken for a record`: a day that lost the bench
 * press and gained a row has the same count and is not the same day.
 */
function photograph(label: string, date: string): { list: string; overrides: number; kinds: string[] } {
  const names = exercisesOn(date);
  const list = names.join(' | ') || '(no exercises)';
  const state = useProgramStore.getState() as unknown as {
    dateOverrides?: Record<string, unknown>;
  };
  const overrides = Object.keys(state.dateOverrides ?? {}).length;
  const entries = decisionLedgerEntries();
  const kinds = entries.map((entry) => entry.decision.kind);
  console.log(`\n── ${label} ──`);
  console.log(`   exercises on ${date} : ${list}`);
  console.log(`   dateOverrides        : ${overrides}`);
  console.log(`   ledger entries       : ${entries.length} [${kinds.join(', ')}]`);
  return { list, overrides, kinds };
}

const main = async (): Promise<void> => {
  console.log('\n════ DOES AN EXERCISE EDIT SURVIVE A RELAUNCH? ════');
  console.log(`world: Sam's 2026-08-05 pass · generated ${SAM_PASS_20260805_GENERATION_DAY} · week ${WEEK}`);
  console.log('the claim under test: survey §5.2, filed as an INFERENCE at §9.8');

  // ── THE CONTROL, FIRST AND ON AN UNTOUCHED WORLD ────────────────────────
  reachWorldByActing();
  const target = pickTargetDay();
  const controlBefore = photograph('CONTROL BEFORE — generated, nothing edited', target.date);
  await relaunch();
  const controlAfter = photograph('CONTROL BOOTED — relaunched with nothing to restore', target.date);
  const controlHolds = controlAfter.list === controlBefore.list;
  console.log(`\n   CONTROL: does a boot with no edit reproduce the day? ${controlHolds ? 'YES' : 'NO'}`);
  if (!controlHolds) {
    console.log('   ⚠ THE CONTROL FAILED. The boot does not reproduce an UNEDITED day, so');
    console.log('     nothing below can distinguish a lost edit from a diverging boot.');
    console.log('     STOPPING — reporting this instead of a verdict it cannot support.');
    return;
  }

  // ── THE MEASUREMENT ─────────────────────────────────────────────────────
  reachWorldByActing();
  const before = photograph('BEFORE — generated, nothing edited', target.date);
  await actOneExerciseRemoval(target);
  const acted = photograph('ACTED — one exercise removed through the athlete door', target.date);

  // VACUITY GATE. This is the whole lesson of LR-29 item 1.
  if (acted.list === before.list) {
    console.log('\n   ⚠ VACUOUS: the acted day is IDENTICAL to the floor. The edit did not');
    console.log('     change the visible day, so "it survived" and "it never happened"');
    console.log('     are the same reading. No verdict. Fix the probe, not the report.');
    return;
  }
  if (acted.overrides === 0) {
    console.log('\n   ⚠ VACUOUS: no override was written, so the surface under test was');
    console.log('     never populated. No verdict.');
    return;
  }

  await relaunch();
  const booted = photograph('BOOTED — heap died, disk restored, world derived', target.date);

  console.log('\n════ THE READING ════');
  console.log(`   the removed exercise    : "${target.exercise}" on ${target.date}`);
  console.log(`   BEFORE  : ${before.list}`);
  console.log(`   ACTED   : ${acted.list}`);
  console.log(`   BOOTED  : ${booted.list}`);
  console.log('');
  const survived = booted.list === acted.list;
  const reverted = booted.list === before.list;
  console.log(`   did the edit SURVIVE the relaunch?  ${survived ? 'YES' : 'NO'}`);
  console.log(`   did the day revert to the floor?    ${reverted ? 'YES' : 'NO'}`);
  console.log(`   ledger kinds after the edit         : [${acted.kinds.join(', ') || '(empty)'}]`);
  console.log(`   dateOverrides  ACTED -> BOOTED      : ${acted.overrides} -> ${booted.overrides}`);
  console.log('');
  if (!survived && reverted) {
    console.log('   VERDICT: the survey\'s §5.2 inference is CONFIRMED by measurement.');
    console.log('   The athlete\'s edit is gone and the generated day is back. The three');
    console.log('   mechanisms have now been observed TOGETHER, on one world.');
  } else if (survived) {
    console.log('   VERDICT: the inference is REFUTED. The edit survived, so something');
    console.log('   carries it that the three-mechanism reading did not account for.');
    console.log('   Do NOT build the ledger route for destination 2 against a bug that');
    console.log('   is not there — find the carrier first.');
  } else {
    console.log('   VERDICT: NEITHER. The booted day matches neither the edit nor the');
    console.log('   floor, so a third thing moved. That is its own finding and it is');
    console.log('   reported as one rather than forced into a yes/no.');
  }
};

main().catch((error) => {
  console.error('\nTAPE FAILED');
  console.error(error);
  process.exit(1);
});
