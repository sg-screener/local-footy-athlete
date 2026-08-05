/**
 * SAM'S 2026-08-05 DEVICE PASS, REPLAYED THROUGH REAL DOORS — L11 reassessment.
 *
 * His combined stages-1+2 device pass FAILED on seven findings. Per L11, every
 * finding is reproduced here as a cell reached by ACTING — fresh install, his
 * 22 exported answers, generate through the accept boundary, his calendar,
 * then the exact doors his taps used — never by seeding a state nobody
 * arrived at (AGENTS.md fixture-fidelity law; the export is a conformance
 * target only).
 *
 * THE DECLARED-RED MECHANISM (copied from the walker): a cell that reproduces
 * a device finding is DECLARED below. A declared red that stops redding fails
 * the suite — the commit that turns it green owes the deletion of its entry.
 * An UNDECLARED red fails the suite outright. So this suite is green exactly
 * when the reproduction ledger matches reality, in both directions.
 *
 * A cell that PASSES here while the defect is real on his phone is itself a
 * finding: the defect needs a coordinate fresh acting cannot build (worn
 * state, legacy hydration ingress, or a door this suite does not walk), and
 * the cell's comment names the suspected coordinate.
 *
 * Run: npm run test:device-pass-2026-08-05
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — device pass replay entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { flushPendingStorageWrites, pendingStorageWriteCount } from '../store/asyncStorageCompat';

import type { TrainingProgram, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { PlanChange } from '../utils/planChangeTypes';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { applyPlanChange, listPlanChangeOptionsForDay } from '../utils/planChangeProducer';
import {
  executeProgramControlAction,
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
} from '../utils/programControlActions';
import { seedManualOverride } from './support/programOverrideHarness';
import { decideProfileSetupChange } from '../rules/profileSetupChange';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { ownSeasonPhase } from '../rules/seasonPhaseOwner';
import { canonicalFixtureKind } from '../rules/fixtureConditionedAvailability';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { readinessActionForKind } from '../utils/weekReadinessActions';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
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

// ── The reproduction ledger ──────────────────────────────────────────────
//
// One entry per device finding this suite CAN currently red on. `matches`
// pins the failure text so a different failure in the same cell cannot hide
// behind a declared entry. Findings not listed here either pass (the defect
// needs a coordinate this suite cannot build fresh — the cell comment says
// which) or are ruling conflicts that go back to Sam, not into a cell.
interface DeclaredRed {
  id: string;
  finding: string;
  matches: RegExp;
  why: string;
  paidBy: string;
}

const DECLARED_RED: ReadonlyArray<DeclaredRed> = [
  // finding-5b and finding-worn-removals were declared red here and RETIRED
  // 2026-08-05 evening, both by ONE fix, and the ledger owes the correction it
  // promised: THE DELOAD WAS INNOCENT. Their entries blamed "the
  // deload-modified week", and measurement (recorded in
  // docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-08-05.md §0) falsified that —
  // regenerating the same week with no fact, no constraint and no deload
  // produced the identical rejection.
  //
  // The measured root was that WEEK IDENTITY HAD TWO OWNERS. The scoped regen
  // stated the block NUMBER from the stored anchor and let generation re-derive
  // the block START from the date, so re-authoring the second week of a block
  // planned the FIRST week's strength patterns onto it (the allocator
  // alternates on `weekNumber % 2`). Pinned history covered pull/squat, the
  // regenerated remainder covered pull/squat again, and hinge/push were never
  // in the candidate at all — not removed, never reachable. §18 read the gap as
  // `pattern_imbalance` and the athlete's stored fact was rolled back.
  //
  // One owner of week identity retired both cells: 5b lands, and the
  // one-root-many-doors measurement now reports 0 of 4 doors refusing, which is
  // what "one root" meant all along.
  // finding-6b-door was declared red here and RETIRED 2026-08-05 evening by
  // Sam's §12 signing (docs/METCON_RESIGN_AND_SIGNOFFS_2026-08-05.md §2,
  // option b). The DOSE was always the athlete's own choice and correct; the
  // WORDS were the question, and the answer is a day-scoped sentence selected
  // by the TYPED CAUSE:
  //
  //   > Easy day: keep RPE 5-6; every rep fast and clean.
  //
  // "Deload:" is now reserved for the scheduled door — a week the block plan
  // really laid down — so an athlete-chosen easy day can no longer describe a
  // week the athlete is not in. `DeloadWeekPolicy` carries the door that minted
  // it, which is what makes the selection typed rather than read back out of
  // the words. The latent sibling recorded in that entry was paid in the same
  // commit: the idempotence guard matched "Deload week:" while appending
  // "Deload: ", so it never recognised its own output; it now compares against
  // the exact sentence and cannot drift from it again.
  //
  // finding-7 was declared red here and RETIRED 2026-08-05 evening: Sam's
  // display-times ruling re-scoped the sweep to rendered lines (names and
  // clock-times exempt, no workbook re-sign), and the two surviving reds were
  // paid in the same commit — the Rest-line derives duration-spelled text
  // when the authored cell carries a ratio (doseLineForDisplay), and the
  // MetCon description reworded (PROPOSED, parked for Sam).
];

let passed = 0;
let failed = 0;
const failures: string[] = [];
const declaredRedHits = new Set<string>();

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const declared = DECLARED_RED.find(
      (entry) => name.startsWith(entry.id) && entry.matches.test(message),
    );
    if (declared) {
      declaredRedHits.add(declared.id);
      passed += 1;
      console.log(`  RED (declared: ${declared.id}) ${name}`);
      console.log(`      ${message.split('\n')[0]}`);
      return;
    }
    failed += 1;
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

function quiet<T>(body: () => T): T {
  const log = console.log;
  const warn = console.warn;
  const error = console.error;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return body();
  } finally {
    console.log = log;
    console.warn = warn;
    console.error = error;
  }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log;
  const warn = console.warn;
  const error = console.error;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return await body();
  } finally {
    console.log = log;
    console.warn = warn;
    console.error = error;
  }
}

/**
 * Fresh install, his 22 answers, generate THROUGH THE ACCEPT BOUNDARY on his
 * generation day, his one game mark, then his pass day. Every step a door.
 */
function reachHisWorldByActing(): void {
  localStorageData.clear();
  const profile = samDevicePass20260805Profile();
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  // THE ACCEPTED STATE IS CLEARED FIRST, AND THAT IS NOT A STYLE CHOICE.
  //
  // `coachUpdatesStore` carries a COMPATIBILITY MIRROR of accepted state, kept
  // by a subscriber: any write to `activeConstraints` makes it re-read
  // `programStore.acceptedMaterialContext` and, while that context still holds
  // facts or a non-zero revision, republish ITS constraints over whatever was
  // just written. Emptying the mirror before its source therefore restored the
  // previous cell's constraints instead of clearing them, and this "fresh
  // install" started worn — carrying the prior cell's illness constraint into
  // generation, which silently deloaded the week.
  //
  // It went unseen only because no earlier cell had ever committed an illness
  // fact: the doors that leaked were the harmless ones. The §18 week-identity
  // fix made the illness door land, and the leak became a deload sentence on a
  // build week. Source first, mirrors after — then the mirror has nothing to
  // copy back.
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

  // Onboarding, through the profile door.
  useProfileStore.setState({ onboardingData: {}, isOnboardingComplete: false } as never);
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());

  // His one mark, before generation — the game predates his pass.
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') useCalendarStore.getState().setGameDay(date, SAM_PASS_20260805_GENERATION_DAY);
  }

  // Generate on his generation day, THROUGH THE ACCEPT BOUNDARY — the walker's
  // own lesson ("harness enters below the door", named four times).
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
  quiet(() => commitRebuiltProgram(
    program,
    { preserve: [], clear: [], conflictsRemoved: [] },
    {
      markedDays: useCalendarStore.getState().markedDays ?? {},
      selectedDate: SAM_PASS_20260805_GENERATION_DAY,
      reason: 'device-pass-2026-08-05:generate',
    },
  ));
  // Point the visible microcycle at the week his pass was looking at.
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

function mondayFor(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  const offset = (parsed.getDay() + 6) % 7;
  parsed.setDate(parsed.getDate() - offset);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function visibleWeek(week: string = WEEK): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(week, buildScheduleStateImperative()));
}

function weekOf(date: string): ResolvedDay[] {
  return visibleWeek(mondayFor(date));
}

/** The sheet's dispatch, mirrored — MOVE/BIN via the wrapper, else direct. */
function tapThroughTheScreen(change: PlanChange) {
  const anchorDate = change.kind === 'move_session' ? change.fromDate
    : (change as { date?: string }).date ?? TODAY;
  const context = { visibleWeek: weekOf(anchorDate), todayISO: TODAY };
  const screenAction = programControlActionForPlanChange(change);
  if (!screenAction) {
    return quiet(() => applyPlanChange({
      change, visibleWeek: context.visibleWeek, todayISO: TODAY,
      applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
    })) as { outcome?: string; ok?: boolean; message?: string };
  }
  return quiet(() => executeProgramControlAction(screenAction, {
    ...context,
    applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
  })) as { outcome?: string; ok?: boolean; message?: string };
}

/** The Profile setup sheet's decision, with HIS stored answers as the base. */
function hisSetupDecision(selectionPatch: {
  seasonPhase: 'Pre-season' | 'In-season' | 'Off-season';
  gameDay?: 'Saturday' | null;
}) {
  const stored = useProfileStore.getState().onboardingData;
  const owned = ownSeasonPhase({
    profile: stored,
    program: useProgramStore.getState().currentProgram as TrainingProgram | null,
  });
  return decideProfileSetupChange({
    stored,
    ownedPhase: owned.phase ?? 'Pre-season',
    lfaDayCountNeedsSync: false,
    storedPosition: (stored.position ?? null) as never,
    selection: {
      name: stored.firstName ?? '',
      position: (stored.position ?? null) as never,
      experience: (stored.experienceLevel ?? null) as never,
      twoKmSeconds: stored.twoKmTimeTrial?.seconds ?? null,
      twoKmAnswer: stored.twoKmTimeTrial ?? null,
      seasonPhase: selectionPatch.seasonPhase,
      preferredDays: (stored.preferredTrainingDays ?? []) as never,
      teamDays: (stored.teamTrainingDays ?? []) as never,
      gameDay: (selectionPatch.gameDay ?? null) as never,
    },
  });
}

/**
 * THE WORN COORDINATE, reached through the hydration door.
 *
 * His export carries exactly one active constraint, and its launch log shows
 * `temporary_source_fact:hydrate` re-minting an ACTIVE `busy_week` fact for
 * 2026-07-27 — a week already over — from a LEGACY schedule constraint
 * (`sourceSurface: hydration_migration`). Current code never writes that
 * constraint shape (L15), so no sequence of fresh acts can author it. The one
 * door it still enters by is HYDRATION: bytes an old build persisted, read at
 * launch. So this reaches it the way his phone does — act the world, flush,
 * edit the persisted envelope to what the old build left (the export is the
 * conformance proof such bytes exist on a real device), relaunch.
 *
 * The unowned-legacy predicate is loadCanonicalTemporarySourceFactOwnership
 * (temporarySourceFactTransaction.ts:229-244): a `schedule` constraint with no
 * `temporarySourceFactIds` re-migrates on EVERY transaction, and
 * `composeTemporarySourceFactCompatibility` re-emits the constraint itself, so
 * the pair never expires.
 */
const LEGACY_SCHEDULE_CONSTRAINT = {
  id: 'legacy-busy-week-2026-07-27',
  type: 'schedule',
  status: 'active',
  weekStartISO: '2026-07-27',
  startDate: '2026-07-27',
  createdAt: '2026-07-27T09:00:00.000Z',
  lastUpdatedAt: '2026-07-27T09:00:00.000Z',
  description: 'Busy week',
};

async function relaunchWithLegacyScheduleConstraint(): Promise<void> {
  // 1. PERSIST — drain, do not assume (walker relaunch precedent).
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await flushPendingStorageWrites().catch(() => undefined);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (pendingStorageWriteCount() === 0) break;
  }
  // 2. THE OLD BUILD'S BYTES: the persisted program envelope, plus the legacy
  //    constraint no current writer can produce.
  const rawEnvelope = localStorageData.get('program-store');
  assert(rawEnvelope, 'worn coordinate: no persisted program-store envelope to edit');
  const envelope = JSON.parse(rawEnvelope) as {
    state?: { acceptedMaterialContext?: { activeConstraints?: unknown[] } };
  };
  assert(envelope.state?.acceptedMaterialContext,
    'worn coordinate: the persisted envelope has no acceptedMaterialContext');
  envelope.state.acceptedMaterialContext.activeConstraints = [
    ...(envelope.state.acceptedMaterialContext.activeConstraints ?? []),
    LEGACY_SCHEDULE_CONSTRAINT,
  ];
  localStorageData.set('program-store', JSON.stringify(envelope));
  // 3. KILL MEMORY, KEEP DISK — photograph AFTER the edit, because zustand
  //    persists on every setState and the blanking writes (walker lesson).
  const disk = new Map(localStorageData);
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [], exposureContractsByWeek: {},
    blockState: null,
  } as never);
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  await flushPendingStorageWrites().catch(() => undefined);
  localStorageData.clear();
  for (const [key, value] of disk) localStorageData.set(key, value);
  // 4. HYDRATE from what was actually written — his launch, including the
  //    `temporary_source_fact:hydrate` transaction his export recorded last.
  await quietAsync(async () => {
    await useProgramStore.persist.rehydrate();
    await useCalendarStore.persist.rehydrate();
    await useProfileStore.persist.rehydrate();
    await useCoachUpdatesStore.persist.rehydrate();
  });
  // Give the post-hydration migration transaction a turn to run.
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
  // THE COORDINATE MUST BE REACHED, or the cell proves nothing (fixture-
  // fidelity law). His export's launch shows the constraint surviving AND the
  // busy_week fact minted from it — both must be observable here.
  const context = (useProgramStore.getState() as unknown as {
    acceptedMaterialContext: {
      activeConstraints?: { id?: string; type?: string }[];
      temporarySourceFacts?: { factId?: string; factKind?: string }[];
    };
  }).acceptedMaterialContext;
  assert((context.activeConstraints ?? []).some(
    (constraint) => constraint.id === LEGACY_SCHEDULE_CONSTRAINT.id),
    'worn coordinate NOT reached: the legacy schedule constraint did not survive '
    + 'hydration — this world is not his, and every worn cell would pass vacuously');
}

/** True once any transaction has re-minted his busy_week fact. */
function busyWeekFactMinted(): boolean {
  const facts = (useProgramStore.getState() as unknown as {
    acceptedMaterialContext: { temporarySourceFacts?: { factId?: string }[] };
  }).acceptedMaterialContext.temporarySourceFacts ?? [];
  return facts.some((fact) => /schedule:week:2026-07-27:busy_week/.test(String(fact.factId ?? '')));
}

const main = async () => {
  console.log('\n-- Sam device pass 2026-08-05, replayed --');

  // ── Finding 1: cannot change season mode from profile ────────────────
  await run('finding-1a: season change Pre-season -> Off-season lands through the setup sheet', async () => {
    reachHisWorldByActing();
    const decision = hisSetupDecision({ seasonPhase: 'Off-season' });
    assert(decision.canSave,
      `(1a) Save is blocked for a pure phase change: blockedBy=${JSON.stringify(decision.blockedBy)}`);
    const result = await quietAsync(() => commitProfileProgramTransaction({
      change: { kind: 'profile_setup', patch: decision.patch },
      todayISO: TODAY,
      sourceSurface: 'profile_setup',
    }));
    assert(result.ok,
      `(1a) the transaction refused the phase change: reason=${result.reason ?? 'none'} "${result.message}"`);
    const owned = ownSeasonPhase({
      profile: useProfileStore.getState().onboardingData,
      program: useProgramStore.getState().currentProgram as TrainingProgram | null,
    });
    assert(owned.phase === 'Off-season',
      `(1a) the transaction reported ok but the OWNED phase is still ${owned.phase} `
      + `(source=${owned.source}) — the visible week is not built on his answer`);
  });

  await run('finding-1b: season change Pre-season -> In-season with a game day lands', async () => {
    reachHisWorldByActing();
    const decision = hisSetupDecision({ seasonPhase: 'In-season', gameDay: 'Saturday' });
    assert(decision.canSave,
      `(1b) Save is blocked: blockedBy=${JSON.stringify(decision.blockedBy)}`);
    const result = await quietAsync(() => commitProfileProgramTransaction({
      change: { kind: 'profile_setup', patch: decision.patch },
      todayISO: TODAY,
      sourceSurface: 'profile_setup',
    }));
    assert(result.ok,
      `(1b) the transaction refused: reason=${result.reason ?? 'none'} "${result.message}"`);
    const owned = ownSeasonPhase({
      profile: useProfileStore.getState().onboardingData,
      program: useProgramStore.getState().currentProgram as TrainingProgram | null,
    });
    assert(owned.phase === 'In-season',
      `(1b) ok reported but the OWNED phase is still ${owned.phase} (source=${owned.source})`);
  });

  // ── Finding 2: cannot add a pre-season game ──────────────────────────
  await run('finding-2: adding a pre-season fixture on a future Saturday lands', async () => {
    reachHisWorldByActing();
    const owned = ownSeasonPhase({
      profile: useProfileStore.getState().onboardingData,
      program: useProgramStore.getState().currentProgram as TrainingProgram | null,
    });
    // The screen's gate: `if (currentPhase !== 'In-season' && !== 'Pre-season') return;`
    // (useHomeScreen.ts:1207). His world must pass it, or the tap dies SILENTLY.
    assert(owned.phase === 'In-season' || owned.phase === 'Pre-season',
      `(2) the add-game tap is silently swallowed: the OWNED phase is ${owned.phase} `
      + `(source=${owned.source}) while his profile selection is `
      + `${owned.profileSelection} — the gate returns before any transaction`);
    const revision = (useProgramStore.getState() as unknown as {
      acceptedMaterialContext: { revision: number };
    }).acceptedMaterialContext.revision;
    const mutation = await quietAsync(() => executeFixtureMutationTransaction({
      action: 'add',
      fixtureKind: canonicalFixtureKind(owned),
      targetDate: '2026-08-08',
      expectedAcceptedRevision: revision,
      source: {
        requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
        commandId: `home-fixture:add:none:2026-08-08:revision-${revision}`,
      },
      todayISO: TODAY,
    } as never));
    // Success is anything the screen would not alert on. The refusal spellings
    // are the transaction's own ('no_change' | 'conflicted' | 'impossible' —
    // useHomeScreen.ts:1069-1072); the success spellings come through from the
    // accepted-state layer ('accepted' | 'repaired' | 'regenerated' |
    // 'fallback', acceptedStateTransaction.ts:1772).
    const refused = mutation.outcome === 'no_change'
      || mutation.outcome === 'conflicted' || mutation.outcome === 'impossible';
    assert(!refused,
      `(2) the fixture transaction was ${mutation.outcome}: `
      + `reason=${(mutation as { reason?: string }).reason ?? 'none'} `
      + `error=${String((mutation as { error?: unknown }).error ?? 'none')}`);
    const marks = useCalendarStore.getState().markedDays ?? {};
    assert(marks['2026-08-08'] === 'game',
      `(2) transaction ${mutation.outcome} but the calendar holds `
      + `${JSON.stringify(marks['2026-08-08'] ?? null)} for 2026-08-08`);
  });

  // ── Finding 4: program adjustments error out ─────────────────────────
  await run('finding-4a: moving a session through the screen door lands', async () => {
    reachHisWorldByActing();
    const week = visibleWeek();
    const withSession = week.filter((day) => day.workout
      && (day.date > TODAY)
      && !(day.workout as { isTeamDay?: boolean }).isTeamDay);
    assert(withSession.length > 0, '(4a) no future non-team session in his week to move');
    const source = withSession[0]!;
    const options = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: week, date: source.date, todayISO: TODAY,
    }));
    assert(!options.move.refusal,
      `(4a) his ${source.date} offers no move at all: "${options.move.refusal?.message}"`);
    const scope = options.move.scopes[0];
    assert(scope && scope.destinations.length > 0,
      `(4a) a move is offered but carries no destination`);
    const destination = scope.destinations[0]!;
    const result = tapThroughTheScreen({
      kind: 'move_session', fromDate: source.date, toDate: destination.date, scope: scope.id,
    } as PlanChange);
    assert(result.ok ?? result.outcome === 'applied',
      `(4a) the offered move ${source.date} -> ${destination.date} failed: `
      + `outcome=${result.outcome ?? 'none'} "${result.message}"`);
  });

  await run('finding-4b: removing a session through the screen door lands', async () => {
    reachHisWorldByActing();
    const week = visibleWeek();
    const withSession = week.filter((day) => day.workout
      && (day.date > TODAY)
      && !(day.workout as { isTeamDay?: boolean }).isTeamDay);
    assert(withSession.length > 0, '(4b) no future non-team session in his week to remove');
    const source = withSession[withSession.length - 1]!;
    const result = tapThroughTheScreen({
      kind: 'remove_session', date: source.date, scope: 'whole_day',
    } as never as PlanChange);
    assert(result.ok ?? result.outcome === 'applied',
      `(4b) removing his ${source.date} session failed: `
      + `outcome=${result.outcome ?? 'none'} "${result.message}"`);
  });

  // ── Finding 5: cannot log fatigue or illness readiness facts ─────────
  await run('finding-5a: logging "tired today" through the readiness door lands', async () => {
    reachHisWorldByActing();
    const action = readinessActionForKind('tired_today', { anchorDateISO: WEEK, todayISO: TODAY });
    const result = await quietAsync(() => executeProgramControlActionDurably(action, {
      visibleWeek: visibleWeek(), todayISO: TODAY,
    }));
    assert(result.ok,
      `(5a) the fatigue door refused: outcome=${(result as { outcome?: string }).outcome ?? 'none'} `
      + `reason=${(result as { reason?: string }).reason ?? 'none'} "${result.message}"`);
    const facts = (useProgramStore.getState() as unknown as {
      acceptedMaterialContext: { temporarySourceFacts?: { factKind?: string }[] };
    }).acceptedMaterialContext.temporarySourceFacts ?? [];
    assert(facts.some((fact) => fact.factKind === 'fatigue'),
      `(5a) door reported ok but no fatigue fact is in the accepted state — factKinds=${
        JSON.stringify(facts.map((fact) => fact.factKind ?? null))}`);
  });

  await run('finding-5b: logging "properly sick" (moderate illness) through the readiness door lands', async () => {
    reachHisWorldByActing();
    const action = readinessActionForKind('illness_moderate', { anchorDateISO: WEEK, todayISO: TODAY });
    // PROBE_5B=1 lifts the log silencer so the transaction's own diagnostics
    // name the refusing layer (instrumentation-alive rule: the cell must be
    // able to say WHAT it saw, not only that it was refused).
    const exec = process.env.PROBE_5B === '1'
      ? <T>(body: () => Promise<T>) => body()
      : quietAsync;
    const result = await exec(() => executeProgramControlActionDurably(action, {
      visibleWeek: visibleWeek(), todayISO: TODAY,
    }));
    assert(result.ok,
      `(5b) the illness door refused: outcome=${(result as { outcome?: string }).outcome ?? 'none'} `
      + `reason=${(result as { reason?: string }).reason ?? 'none'} "${result.message}"`);
    const facts = (useProgramStore.getState() as unknown as {
      acceptedMaterialContext: { temporarySourceFacts?: { factKind?: string }[] };
    }).acceptedMaterialContext.temporarySourceFacts ?? [];
    assert(facts.some((fact) => fact.factKind === 'illness'),
      `(5b) door reported ok but no illness fact is in the accepted state — factKinds=${
        JSON.stringify(facts.map((fact) => fact.factKind ?? null))}`);
  });

  // ── The worn coordinate: the same doors, on his hydrated world ───────
  await run('finding-1-worn: season change still lands with his legacy schedule constraint hydrated', async () => {
    reachHisWorldByActing();
    await relaunchWithLegacyScheduleConstraint();
    const decision = hisSetupDecision({ seasonPhase: 'Off-season' });
    assert(decision.canSave,
      `(1-worn) Save is blocked: blockedBy=${JSON.stringify(decision.blockedBy)}`);
    const result = await quietAsync(() => commitProfileProgramTransaction({
      change: { kind: 'profile_setup', patch: decision.patch },
      todayISO: TODAY,
      sourceSurface: 'profile_setup',
    }));
    assert(result.ok,
      `(1-worn) the transaction refused the phase change on the worn world: `
      + `reason=${result.reason ?? 'none'} "${result.message}"`);
    const owned = ownSeasonPhase({
      profile: useProfileStore.getState().onboardingData,
      program: useProgramStore.getState().currentProgram as TrainingProgram | null,
    });
    assert(owned.phase === 'Off-season',
      `(1-worn) ok reported but the OWNED phase is still ${owned.phase} (source=${owned.source})`);
  });

  await run('finding-4-worn: a screen-door move still lands with his legacy schedule constraint hydrated', async () => {
    reachHisWorldByActing();
    await relaunchWithLegacyScheduleConstraint();
    const week = visibleWeek();
    const withSession = week.filter((day) => day.workout
      && (day.date > TODAY)
      && !(day.workout as { isTeamDay?: boolean }).isTeamDay);
    assert(withSession.length > 0, '(4-worn) no future non-team session in his week to move');
    const source = withSession[0]!;
    const options = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: week, date: source.date, todayISO: TODAY,
    }));
    assert(!options.move.refusal,
      `(4-worn) his ${source.date} offers no move: "${options.move.refusal?.message}"`);
    const scope = options.move.scopes[0];
    assert(scope && scope.destinations.length > 0, '(4-worn) a move is offered but carries no destination');
    const result = tapThroughTheScreen({
      kind: 'move_session', fromDate: source.date, toDate: scope.destinations[0]!.date, scope: scope.id,
    } as PlanChange);
    assert(result.ok ?? result.outcome === 'applied',
      `(4-worn) the offered move failed on the worn world: `
      + `outcome=${result.outcome ?? 'none'} "${result.message}"`);
  });

  await run('finding-5a-worn: "tired today" still lands with his legacy schedule constraint hydrated', async () => {
    reachHisWorldByActing();
    await relaunchWithLegacyScheduleConstraint();
    const action = readinessActionForKind('tired_today', { anchorDateISO: WEEK, todayISO: TODAY });
    const result = await quietAsync(() => executeProgramControlActionDurably(action, {
      visibleWeek: visibleWeek(), todayISO: TODAY,
    }));
    assert(result.ok,
      `(5a-worn) the fatigue door refused on the worn world: `
      + `reason=${(result as { reason?: string }).reason ?? 'none'} "${result.message}"`);
    const facts = (useProgramStore.getState() as unknown as {
      acceptedMaterialContext: { temporarySourceFacts?: { factKind?: string }[] };
    }).acceptedMaterialContext.temporarySourceFacts ?? [];
    assert(facts.some((fact) => fact.factKind === 'fatigue'),
      `(5a-worn) door reported ok but no fatigue fact landed — factKinds=${
        JSON.stringify(facts.map((fact) => fact.factKind ?? null))}`);
    // The conformance check: his export's launch minted the stale busy_week
    // fact from the constraint. If no transaction here re-minted it, the worn
    // world is NOT conformant with his device and these passes say less.
    assert(busyWeekFactMinted(),
      '(5a-worn) the legacy constraint never re-minted his busy_week fact — the '
      + 'worn world does not conform to the export, and the three worn passes '
      + 'do not cover his device');
  });

  // ── Finding 3: the athlete must be able to CHOOSE recovery ───────────
  //
  // Sam's 2026-08-05 ruling (docs/DISPLAY_TIMES_RULING_2026-08-05.md §1): the
  // 2026-07-31 charter ruling STANDS — the app never places recovery
  // uninvited — and the defect is that no findable athlete door exists to
  // CHOOSE a recovery session. The Bible grants the choice outright ("you can
  // always add a recovery or mobility flow to any day as optional", cited at
  // planChangeTypes.ts beside the chartered 'recovery' id). This cell asserts
  // the CHOICE is offered somewhere in his week's add vocabulary.
  await run('finding-3: every category the producer offers is findable in the type menu', async () => {
    // The first draft of this cell asked the PRODUCER and passed — recovery
    // was offered. The phone still had no door, because the SHEET's render
    // vocabulary (five MenuOption rows) could not reach it: the same
    // enters-below-the-door shape, one layer higher. The sheet now derives
    // row visibility from `planChangeTypeMenu`, so this cell asserts
    // findability against the model the sheet actually renders from.
    const { menuReachableCategoryIds } = await import('../screens/home/planChangeTypeMenu');
    const reachable = menuReachableCategoryIds();
    reachHisWorldByActing();
    const offered = new Set<string>();
    for (const day of visibleWeek()) {
      const options = quiet(() => listPlanChangeOptionsForDay({
        visibleWeek: visibleWeek(), date: day.date, todayISO: TODAY,
      })) as unknown as {
        categories?: { id: string }[];
        addOnTopCategories?: { id: string }[];
      };
      for (const category of options.categories ?? []) offered.add(category.id);
      for (const category of options.addOnTopCategories ?? []) offered.add(category.id);
    }
    assert(offered.has('recovery'),
      `(3) the producer no longer offers 'recovery' anywhere in his week — the `
      + `chartered choice regressed below the menu. Offered: [${[...offered].sort().join(', ')}]`);
    const unfindable = [...offered].filter((id) => !reachable.has(id as never));
    assert(unfindable.length === 0,
      `(3) producer-offered categories no menu row can reach — chartered `
      + `choices invisible on the phone: [${unfindable.sort().join(', ')}]`);
  });

  // ── The worn coordinate II: his five removals, then every door ───────
  //
  // The 5b probe named the refusing layer: "Section 18 final-week rejection
  // (pattern_imbalance:strength_patterns:{squat:2,hinge:0,push:0,pull:2})" —
  // a recomposition triggered by an athlete's report is gated on the WHOLE
  // week's pattern balance, and the transaction rolls back when the gate
  // fails. His export records userRemovalConstraintCount: 5. If five removals
  // wear the stored week below the gate, then EVERY door that recomposes
  // through §18 refuses afterwards — one root, four doors, defects differing
  // only by coordinates. This cell wears the week by acting his removals and
  // then tries each door.
  await run('finding-worn-removals: after five removals, every recomposing door still works', async () => {
    reachHisWorldByActing();
    let removed = 0;
    const removalLog: string[] = [];
    for (const cycle of (useProgramStore.getState().currentProgram as TrainingProgram).microcycles) {
      const weekStart = cycle.startDate.slice(0, 10);
      for (const day of visibleWeek(weekStart)) {
        if (removed >= 5) break;
        if (!day.workout || day.date <= TODAY) continue;
        if ((day.workout as { isTeamDay?: boolean }).isTeamDay) continue;
        const result = tapThroughTheScreen({
          kind: 'remove_session', date: day.date, scope: 'whole_day',
        } as never as PlanChange);
        if (result.ok ?? result.outcome === 'applied') {
          removed += 1;
          removalLog.push(day.date);
        }
      }
      if (removed >= 5) break;
    }
    assert(removed >= 3,
      `(worn-removals) only ${removed} removals landed — the worn coordinate was `
      + `not reached (his device carries 5)`);

    const doorFailures: string[] = [];

    const fatigue = await quietAsync(() => executeProgramControlActionDurably(
      readinessActionForKind('tired_today', { anchorDateISO: WEEK, todayISO: TODAY }),
      { visibleWeek: visibleWeek(), todayISO: TODAY },
    ));
    if (!fatigue.ok) doorFailures.push(`fatigue: "${fatigue.message}"`);

    const illness = await quietAsync(() => executeProgramControlActionDurably(
      readinessActionForKind('illness_moderate', { anchorDateISO: WEEK, todayISO: TODAY }),
      { visibleWeek: visibleWeek(), todayISO: TODAY },
    ));
    if (!illness.ok) doorFailures.push(`illness: "${illness.message}"`);

    const decision = hisSetupDecision({ seasonPhase: 'Off-season' });
    if (!decision.canSave) {
      doorFailures.push(`season-change: Save blocked ${JSON.stringify(decision.blockedBy)}`);
    } else {
      const setup = await quietAsync(() => commitProfileProgramTransaction({
        change: { kind: 'profile_setup', patch: decision.patch },
        todayISO: TODAY,
        sourceSurface: 'profile_setup',
      }));
      if (!setup.ok) doorFailures.push(`season-change: reason=${setup.reason ?? 'none'} "${setup.message}"`);
    }

    const owned = ownSeasonPhase({
      profile: useProfileStore.getState().onboardingData,
      program: useProgramStore.getState().currentProgram as TrainingProgram | null,
    });
    const revision = (useProgramStore.getState() as unknown as {
      acceptedMaterialContext: { revision: number };
    }).acceptedMaterialContext.revision;
    const fixture = await quietAsync(() => executeFixtureMutationTransaction({
      action: 'add',
      fixtureKind: canonicalFixtureKind(owned),
      targetDate: '2026-08-15',
      expectedAcceptedRevision: revision,
      source: {
        requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
        commandId: `home-fixture:add:none:2026-08-15:revision-${revision}`,
      },
      todayISO: TODAY,
    } as never));
    if (fixture.outcome === 'conflicted' || fixture.outcome === 'impossible') {
      doorFailures.push(`fixture-add: ${fixture.outcome} `
        + `reason=${(fixture as { reason?: string }).reason ?? 'none'}`);
    }

    assert(doorFailures.length === 0,
      `(worn-removals) after ${removed} removals [${removalLog.join(', ')}], `
      + `${doorFailures.length} of 4 recomposing doors refuse — one worn week, `
      + `many dead doors:\n    ${doorFailures.join('\n    ')}`);
  });

  // ── Finding 6a: duplicated session description on the Metcon screen ──
  //
  // The duplication mechanism the screen shows: `workout.description` renders
  // at the top (DayWorkoutScreenV2:1231) and each conditioning row's
  // `exercise.notes || exercise.exercise?.description` renders below it
  // (:2171). The same non-empty string in both positions is one sentence
  // rendered twice. The PROMOTION that makes them equal lives in the athlete
  // MOVE split (sessionComponents.ts:397: a conditioning-only remainder takes
  // `conditioning.items[0].description` as its session description) — so the
  // coordinate is reached by ACTING a scoped move, not by generation alone.
  const duplicatedSentences = (label: string): string[] => {
    const program = useProgramStore.getState().currentProgram as TrainingProgram | null;
    if (!program) return [`${label}: no program`];
    const offences: string[] = [];
    for (const cycle of program.microcycles) {
      const week = visibleWeek(cycle.startDate.slice(0, 10));
      for (const day of week) {
        const workout = day.workout as Workout | null | undefined;
        if (!workout || !workout.description) continue;
        for (const exercise of workout.exercises ?? []) {
          const rowText = (exercise as { notes?: string }).notes
            || (exercise as { exercise?: { description?: string } }).exercise?.description
            || '';
          if (rowText && rowText.trim() === workout.description.trim()) {
            offences.push(`${label} ${day.date} "${workout.name}": "${rowText.slice(0, 80)}"`);
          }
        }
      }
    }
    return offences;
  };

  await run('finding-6a: a conditioning-only day never renders the same sentence twice', async () => {
    reachHisWorldByActing();
    const fresh = duplicatedSentences('fresh');
    assert(fresh.length === 0,
      `(6a) one sentence, two render positions, straight from generation:\n    ${fresh.join('\n    ')}`);
  });

  await run('finding-6a-moved: after every offered scoped move, still no sentence twice', async () => {
    reachHisWorldByActing();
    // Walk every scoped (non-whole-day) move the sheet offers this week, take
    // the first destination of each, and sweep after each landing.
    const week = visibleWeek();
    let performed = 0;
    for (const day of week) {
      if (!day.workout || day.date <= TODAY) continue;
      const options = quiet(() => listPlanChangeOptionsForDay({
        visibleWeek: visibleWeek(), date: day.date, todayISO: TODAY,
      }));
      if (options.move.refusal) continue;
      for (const scope of options.move.scopes) {
        if (scope.id === 'whole_day' || scope.destinations.length === 0) continue;
        const destination = scope.destinations[0]!;
        const result = tapThroughTheScreen({
          kind: 'move_session', fromDate: day.date, toDate: destination.date, scope: scope.id,
        } as PlanChange);
        if (!(result.ok ?? result.outcome === 'applied')) continue;
        performed += 1;
        const after = duplicatedSentences(`after ${scope.id} ${day.date}->${destination.date}`);
        assert(after.length === 0,
          `(6a) the move split promoted a row sentence into the session description:`
          + `\n    ${after.join('\n    ')}`);
      }
    }
    assert(performed > 0,
      '(6a) no scoped move landed anywhere this week — the coordinate was not reached, '
      + 'and this cell proves nothing (fixture-fidelity law: say so, do not pass silently)');
  });

  // ── Finding 6b: "Deload:" note text on non-deload weeks ──────────────
  await run('finding-6b: no "Deload:" note on any non-deload week', async () => {
    reachHisWorldByActing();
    const program = useProgramStore.getState().currentProgram as TrainingProgram | null;
    assert(program, '(6b) no program');
    const offences: string[] = [];
    for (const cycle of program.microcycles) {
      const weekKind = (cycle as { weekKind?: string }).weekKind ?? 'standard';
      if (weekKind === 'deload') continue;
      const week = visibleWeek(cycle.startDate.slice(0, 10));
      for (const day of week) {
        const workout = day.workout as Workout | null | undefined;
        if (!workout) continue;
        const texts: string[] = [workout.description ?? ''];
        for (const exercise of workout.exercises ?? []) {
          texts.push((exercise as { notes?: string }).notes ?? '');
        }
        for (const text of texts) {
          if (/Deload:/i.test(text)) {
            offences.push(`${day.date} (weekKind=${weekKind}) "${workout.name}": "${text.slice(0, 90)}"`);
          }
        }
      }
    }
    assert(offences.length === 0,
      `(6b) a deload sentence reaches a non-deload week:\n    ${offences.join('\n    ')}`);
  });

  await run('finding-6b-door: the G-1 "deloaded" route does not stamp deload copy on a standard week', async () => {
    // `resolveDoorDeloadPolicy` (deloadWeekRules.ts:134-146) never reads week
    // kind, and the g1 'deloaded' route applies BOTH deload note appliers to
    // the landing session (g1LandingAsk.ts:481-495). Reached by acting: add a
    // fixture on Saturday, then move a session onto G-1 Friday and answer the
    // landing ask with 'deloaded'.
    reachHisWorldByActing();
    const owned = ownSeasonPhase({
      profile: useProfileStore.getState().onboardingData,
      program: useProgramStore.getState().currentProgram as TrainingProgram | null,
    });
    const revision = (useProgramStore.getState() as unknown as {
      acceptedMaterialContext: { revision: number };
    }).acceptedMaterialContext.revision;
    await quietAsync(() => executeFixtureMutationTransaction({
      action: 'add',
      fixtureKind: canonicalFixtureKind(owned),
      targetDate: '2026-08-08',
      expectedAcceptedRevision: revision,
      source: {
        requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
        commandId: `home-fixture:add:none:2026-08-08:revision-${revision}`,
      },
      todayISO: TODAY,
    } as never));
    // ADD onto the G-1 Friday, answering the landing ask with 'deloaded' —
    // the ask-flow suite's own route (its cell 24 proves the add door lands
    // the DELOAD_LAW dose). A MOVE onto G-1 is refused outright ("Big session
    // the day before your game"), which is why the first draft of this cell
    // never reached the coordinate.
    const result = tapThroughTheScreen({
      kind: 'add_category', date: '2026-08-07', category: 'strength_full',
      g1Route: 'deloaded',
    } as never as PlanChange);
    const landed = result.ok ?? result.outcome === 'applied';
    assert(landed,
      `(6b-door) the deloaded G-1 add refused — the coordinate was not reached: `
      + `outcome=${result.outcome ?? 'none'} "${result.message}"`);
    // The deloaded DOSE is the athlete's choice and correct. What must not
    // happen on a standard week is the "Deload:" WEEK copy appearing — the
    // signed sentences claim week semantics ("the week\'s one quality
    // exposure", "keep RPE {min}-{max}") that a one-day route cannot make true.
    const offences: string[] = [];
    const friday = visibleWeek().find((day) => day.date === '2026-08-07');
    const workout = friday?.workout as Workout | null | undefined;
    if (workout) {
      const texts = [workout.description ?? '',
        ...(workout.exercises ?? []).map((exercise) => (exercise as { notes?: string }).notes ?? '')];
      for (const text of texts) {
        if (/Deload:/i.test(text)) offences.push(`2026-08-07 "${workout.name}": "${text.slice(0, 90)}"`);
      }
    }
    assert(offences.length === 0,
      `(6b-door) week-deload copy stamped on a standard week by a one-day route:\n    ${
        offences.join('\n    ')}`);
  });

  // ── Finding 7: athletes see times, never ratios ──────────────────────
  //
  // RE-SCOPED per docs/DISPLAY_TIMES_RULING_2026-08-05.md ("just show us the
  // time — the app can handle logic behind the scenes"):
  // - Ratios flag only on ATHLETE-RENDERED lines. The rendered inputs are the
  //   composer's joinNotes fields (conditioningSelection.ts: Work/Rest/Sets/
  //   intensity/effortCue/modalityNotes), cue text, coach-template
  //   descriptions, and the acted world's rendered strings.
  // - Colon forms that ARE times stay: clock times ("every 2:00", "1:40",
  //   "15:15", "30:30" — two-digit right side) and TEMPLATE NAMES anywhere
  //   they appear ("Flush Intervals 2:1 (2 min / 1 min)" — durations sit in
  //   the name itself). Names are stripped before scanning.
  // - `workToRest` stays workbook-internal and unrendered — a leak into any
  //   rendered line is caught by this same sweep.
  await run('finding-7: no athlete-rendered line carries a work:rest ratio', async () => {
    const TEMPLATE_NAMES = CONDITIONING_TEMPLATES
      .map((template) => (template as { name?: string }).name ?? '')
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const withoutNames = (text: string): string => {
      let out = text;
      for (const name of TEMPLATE_NAMES) out = out.split(name).join(' ');
      return out;
    };
    // One detector, owned by the dose module beside the parse — the render
    // path (doseLineForDisplay) and this sweep read the same definition.
    const { containsWorkRestRatio } = await import('../rules/conditioningDose');
    const isRatioBearing = (text: string): boolean =>
      containsWorkRestRatio(withoutNames(text));
    const offences: string[] = [];
    const flag = (surface: string, text: string | null | undefined): void => {
      if (text && isRatioBearing(text)) offences.push(`${surface}: "${text.slice(0, 90)}"`);
    };

    // 1. The RENDERED rows for all 55 templates, through the real composer —
    //    what the athlete's conditioning row actually says, after the display
    //    rule's dose-line derivation.
    const { composeConditioningRows } = await import('../rules/conditioningSelection');
    for (const template of CONDITIONING_TEMPLATES) {
      const name = (template as { name?: string }).name ?? '?';
      for (const row of composeConditioningRows(template as never, TODAY)) {
        flag(`template "${name}" rendered notes`, (row as { notes?: string }).notes);
      }
    }

    // 2. Coach-template descriptions — rendered in four screen positions
    //    (coachRevisionTemplates.ts: workout.description, option.description,
    //    row notes, exercise.description).
    const { listCoachRevisionTemplates } = await import('../utils/coachRevisionTemplates');
    for (const def of listCoachRevisionTemplates()) {
      const template = def as { templateId?: string; label?: string; description?: string };
      flag(`coach template "${template.label ?? template.templateId}" description`,
        template.description);
    }

    // 3. The acted world's rendered strings, every week.
    reachHisWorldByActing();
    const program = useProgramStore.getState().currentProgram as TrainingProgram | null;
    assert(program, '(7) no program');
    for (const cycle of program.microcycles) {
      for (const day of visibleWeek(cycle.startDate.slice(0, 10))) {
        const workout = day.workout as Workout | null | undefined;
        if (!workout) continue;
        flag(`${day.date} description`, workout.description);
        for (const exercise of workout.exercises ?? []) {
          flag(`${day.date} row notes`, (exercise as { notes?: string }).notes);
        }
      }
    }

    assert(offences.length === 0,
      `(7) a ratio reaches an athlete-rendered line (times and template names `
      + `are exempt per the 2026-08-05 ruling):\n    ${offences.join('\n    ')}`);
  });

  console.log(`\nDevice pass 2026-08-05 totals: ${passed} passed, ${failed} failed`);

  // THE RATCHET DIRECTION: a declared red that no longer reds is a cell that
  // went green, and the commit that turned it green owes the deletion.
  const stale = DECLARED_RED.filter((entry) => !declaredRedHits.has(entry.id));
  if (stale.length > 0) {
    console.error(`DECLARED RED NO LONGER REDS — delete the entry:\n  ${
      stale.map((entry) => `${entry.id} (paid by ${entry.paidBy})`).join('\n  ')}`);
    totalsPrinted(failed + stale.length);
    process.exit(1);
  }

  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
};

void main();
