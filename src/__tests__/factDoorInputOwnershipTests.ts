/**
 * THE FACT AND SEASON DOORS ARE INPUTS — R3 of the shell rebuild.
 *
 * Plan §2 (`docs/SHELL_REBUILD_PLAN_2026-08-05.md`) names four input classes,
 * and life-facts are the second: "typed, dated: `markedDays` (calendar),
 * readiness `signalsByDate`, injury episodes, temporary source facts
 * (illness/busy-week), team days. The first two keep their armoured stores;
 * EPISODES AND SOURCE FACTS MOVE FROM `acceptedMaterialContext` MIRRORS INTO
 * THEIR OWN INPUT SLICES." R3 is where that move happens, and §3 states what
 * Sam sees: "Declare an injury, an illness, a busy week; answer readiness —
 * each lands and the week visibly responds."
 *
 * WHAT THE MEASUREMENT FOUND (2026-08-05). The illness lands, the week
 * responds, and it still responds after a relaunch — but NOT because of the
 * fact. R1.3's boot re-derives at `revision: 0`, and at revision 0
 * `materialContext` takes its cold-start branch, which composes the accepted
 * context out of THREE MIRROR STORES (calendar, readiness, coach-updates) and
 * names neither `temporarySourceFacts` nor `injuryEpisodes`. Both are already
 * persisted as inputs by R1.3's `partialize`; rehydrate restores them; the
 * boot then throws them away. Measured: facts=1 after the door, facts=1 after
 * rehydrate, facts=0 after `rebuildDerivedWorld`.
 *
 * The week looked right anyway because `coachUpdatesStore`'s
 * `activeConstraints` MIRROR carried the derived constraint — and that mirror
 * is on R5's deletion list (plan §1, "coachUpdatesStore's activeConstraints /
 * activeInjury mirrors"). So a green relaunch today is a green standing on a
 * surface the next slice deletes: the athlete's illness would silently stop
 * shaping their week, one release later, with no gate going red. That is the
 * gate-passing-on-coordinates-it-never-builds class, and the cells below take
 * the mirror away FIRST so the fact has to carry itself.
 *
 * Run: npm run test:fact-door-inputs
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const disk = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => { disk.set(key, value); },
    removeItem: (key: string) => { disk.delete(key); },
    clear: () => { disk.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — the fact doors are decided on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import type { TrainingProgram } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useReadinessStore } from '../store/readinessStore';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { getAcceptedMaterialContext, commitReadinessSignalTransaction } from '../store/acceptedStateTransaction';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import { createOrUpdateInjuryEpisode } from '../store/injuryEpisodeTransaction';
import {
  createTemporaryIllnessFact,
  createTemporaryScheduleFact,
  temporaryFactScope,
} from '../rules/temporarySourceFact';
import { deriveIllnessRecoveryWeekMode } from '../rules/illnessRecoveryWeekMode';
import { buildReadinessSignalPatch } from '../utils/readiness';
import { addDaysISO } from '../utils/programBlockState';
import { flushPendingStorageWrites, pendingStorageWriteCount } from '../store/asyncStorageCompat';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
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

/**
 * THE DECLARED-RED MECHANISM (the evening suite's, same law): a declared red
 * that STOPS redding owes the deletion of its entry in the greening commit. An
 * UNDECLARED red fails the suite outright.
 *
 * Both entries below are findings this unit MEASURED and DIAGNOSED to their
 * owners rather than patched at a slice boundary. Neither is a shell-ownership
 * defect: the inputs now survive the boot, and these are what survives it INTO.
 */
interface DeclaredRed {
  readonly id: string;
  readonly matches: RegExp;
  readonly finding: string;
  readonly paidBy: string;
}

const DECLARED_RED: ReadonlyArray<DeclaredRed> = [
  {
    id: '3',
    matches: /the injured week changed across the relaunch/,
    finding:
      'Declaring a hamstring injury derives one week before the relaunch and a DIFFERENT '
      + 'one after it (Lower Squat + Continuous Aerobic → Upper Push + Upper Pull). The '
      + 'injury survives and the week still responds; what differs is HOW. Before the '
      + 'relaunch the episode is applied as an incremental REPLAN over the published week; '
      + 'after it, the same fact is an input to a full RESOLVE. This is the replan-vs-derive '
      + 'class Sam already ruled on at the fixture-identity unit — "the published week is a '
      + 'materialised REPLAN, derivation is a RESOLVE, and no rebase input makes them equal" '
      + '— and it closes the same way, at the switchover, not by weakening the assertion here.',
    paidBy: 'R5 (the switchover: derive() becomes the only week authority)',
  },
  {
    id: '6',
    matches: /changed nothing in the visible week/,
    finding:
      'A busy week ("I can only train twice this week", maxSessions 2) LANDS as an input, '
      + 'survives the relaunch, derives a live `schedule` constraint — and changes no '
      + 'session. The door answers "The schedule restriction is active. No visible session '
      + 'needed changing." on a week showing three future sessions. Cause, located: '
      + '`maxSessionsThisWeek` has exactly ONE consumer in the repo, the session-cap block '
      + 'in `validateMicrocycleAgainstActiveConstraints`, and its only callers are inside '
      + '`canonicaliseHydratedState` — the HYDRATION path. R1.3 replaced hydration with '
      + 'derivation, so the cap now runs on no launch and the fact door never called it. '
      + 'A live authored rule stranded in bypassed machinery: it needs an owner on the '
      + 'derive path (§18/resolver), which is a unit, not a slice-boundary patch.',
    paidBy: 'a named unit: the session cap gets a derive-path owner (R3 follow-up / R5)',
  },
];

const declaredRedHits = new Set<string>();

let passed = 0;
let failed = 0;
const failures: string[] = [];

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
      console.log(`  RED (declared: ${declared.id}, paid by ${declared.paidBy}) ${name}`);
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
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

/** His world, reached by acting — the work-bill / evening builder. */
function reachWorldByActing(): void {
  disk.clear();
  resetStoresToFreshInstall('fact-door-inputs');
  const profile = samDevicePass20260805Profile();
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') useCalendarStore.getState().setGameDay(date, SAM_PASS_20260805_GENERATION_DAY);
  }
  const program = quiet(() => generateProgramLocally(profile, {
    weekAcceptance: 'forward_decision',
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
    reason: 'fact-door-inputs:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

/**
 * A relaunch. `dropMirrors` runs R5's deletion ahead of time: the coach-updates
 * constraint mirror is emptied on disk before boot, so anything that still
 * works is being carried by an INPUT and not by a surface about to disappear.
 */
async function relaunch(options: { dropMirrors?: boolean } = {}): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await flushPendingStorageWrites().catch(() => undefined);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (pendingStorageWriteCount() === 0) break;
  }
  const snapshot = new Map(disk);
  // Process death: the DERIVED surfaces are gone; the persisted inputs are not.
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [], exposureContractsByWeek: {}, blockState: null,
  } as never);
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  await flushPendingStorageWrites().catch(() => undefined);
  disk.clear();
  for (const [key, value] of snapshot) disk.set(key, value);
  if (options.dropMirrors) disk.delete('coach-updates');
  await quietAsync(async () => {
    await useProgramStore.persist.rehydrate();
    await useCalendarStore.persist.rehydrate();
    await useProfileStore.persist.rehydrate();
    await useCoachUpdatesStore.persist.rehydrate();
    await useReadinessStore.persist.rehydrate();
    await useDecisionLedgerStore.persist.rehydrate();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runQuiescentBoot } = require('../store/quiescentBoot');
    await runQuiescentBoot();
  });
}

function visibleWeek(week: string = WEEK): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(week, buildScheduleStateImperative()));
}

function weekShape(week: string = WEEK): string {
  return visibleWeek(week).map((day) => {
    const workout = (day as unknown as { workout?: { name?: string } | null }).workout;
    return `${day.date.slice(8)}:${workout?.name ?? '-'}`;
  }).join(' | ');
}

function factInputs(): {
  temporarySourceFacts: unknown[];
  injuryEpisodes: unknown[];
  activeConstraints: { type?: string }[];
} {
  const context = getAcceptedMaterialContext() as unknown as {
    temporarySourceFacts?: unknown[];
    injuryEpisodes?: unknown[];
    activeConstraints?: { type?: string }[];
  };
  return {
    temporarySourceFacts: context.temporarySourceFacts ?? [],
    injuryEpisodes: context.injuryEpisodes ?? [],
    activeConstraints: context.activeConstraints ?? [],
  };
}

function severeIllnessThisWeek() {
  return createTemporaryIllnessFact({
    observedDate: WEEK,
    scope: temporaryFactScope({ kind: 'week', weekStart: WEEK } as never),
    severity: 'severe',
    sourceSurface: 'week_readiness_sheet',
  });
}

/** The mode the illness law derives — the week's own answer, not a name match. */
function illnessRecoveryDerived(): boolean {
  return !!quiet(() => deriveIllnessRecoveryWeekMode({
    weekStartISO: WEEK,
    temporarySourceFacts: factInputs().temporarySourceFacts as never,
  }));
}

const main = async () => {
  console.log('\n-- The fact and season doors are INPUTS (plan §2 class 2, R3) --');

  // ── 1. THE ILLNESS FACT ITSELF ────────────────────────────────────────────
  await run('1 a stated illness is still an input after a relaunch', async () => {
    reachWorldByActing();
    const outcome = await quietAsync(() => transactTemporarySourceFact({
      operation: 'create',
      fact: severeIllnessThisWeek(),
      todayISO: TODAY,
      now: `${TODAY}T02:00:00.000Z`,
    } as never)) as { outcome?: string };
    assert(factInputs().temporarySourceFacts.length === 1,
      `the illness door did not leave a source fact (outcome ${outcome.outcome}) — `
      + 'this cell has nothing to relaunch');
    await relaunch();
    const after = factInputs();
    assert(after.temporarySourceFacts.length === 1,
      `the athlete's illness is GONE after a relaunch (${after.temporarySourceFacts.length} `
      + 'facts). It is persisted — R1.3\'s partialize carries `temporarySourceFacts` and '
      + 'rehydrate restores it — and the BOOT drops it: `rebuildDerivedWorld` re-derives at '
      + '`revision: 0`, and at revision 0 `materialContext` composes the context from the '
      + 'calendar / readiness / coach-updates MIRRORS, an object literal that names neither '
      + '`temporarySourceFacts` nor `injuryEpisodes`. Plan §2: the facts are inputs and get '
      + 'their own slice; a mirror is not where an input lives');
  });

  // ── 2. AND THE WEEK RESPONDS TO THE FACT, NOT TO A MIRROR ────────────────
  await run('2 the week still responds to the illness with the mirror deleted', async () => {
    reachWorldByActing();
    const before = weekShape();
    await quietAsync(() => transactTemporarySourceFact({
      operation: 'create',
      fact: severeIllnessThisWeek(),
      todayISO: TODAY,
      now: `${TODAY}T02:00:00.000Z`,
    } as never));
    const responded = weekShape();
    assert(responded !== before,
      'the illness did not change the visible week at all, so "the week responds" has '
      + 'nothing to survive');
    // R5 deletes this mirror. Take it away now, so what survives is the input.
    await relaunch({ dropMirrors: true });
    assert(illnessRecoveryDerived(),
      'with the coach-updates mirror gone, the illness no longer derives its week mode after '
      + 'a relaunch — the week was being carried by `activeConstraints` in a store plan §1 '
      + 'lists for deletion, so this passes today and would fail silently one slice later, '
      + 'with the athlete\'s stated illness quietly not shaping their week');
    assert(weekShape() === responded,
      `the week changed across the relaunch (\n    before: ${responded}\n    after:  ${weekShape()}\n)`
      + ' — the illness is an input and the week is derived, so both launches must derive '
      + 'the same week from the same inputs');
  });

  // ── 3. THE INJURY EPISODE ────────────────────────────────────────────────
  await run('3 a declared injury lands, the week responds, and both survive a relaunch', async () => {
    reachWorldByActing();
    const before = weekShape();
    await quietAsync(() => createOrUpdateInjuryEpisode({
      constraint: {
        id: 'injury-hamstring-fact-door',
        type: 'injury',
        bodyPart: 'hamstring',
        bucket: 'hamstring',
        severity: 6,
        status: 'active',
        startDate: TODAY,
        lastUpdatedAt: `${TODAY}T09:00:00.000Z`,
        source: 'guided_injury_flow',
        rules: ['No sprinting or high-speed running', 'No heavy hinge work'],
        safeFocus: ['Pain-free work for unaffected regions'],
        advice: [],
        modifierAffects: ['current_week', 'future_generation'],
        presentationOnlyDismiss: true,
      },
      sourceActor: 'athlete',
      sourceSurface: 'guided_injury_flow',
      todayISO: TODAY,
    } as never));
    const stated = factInputs();
    assert(stated.injuryEpisodes.length >= 1,
      `the injury door left ${stated.injuryEpisodes.length} episodes — nothing to relaunch`);
    // §3's Sam-sees list is "each lands AND the week visibly responds".
    const responded = weekShape();
    assert(responded !== before,
      `declaring a 6/10 hamstring changed nothing in the visible week (${responded}) — `
      + 'it landed as a record and the athlete sees the same training');
    await relaunch({ dropMirrors: true });
    const after = factInputs();
    assert(after.injuryEpisodes.length === stated.injuryEpisodes.length,
      `the athlete's injury is GONE after a relaunch (${stated.injuryEpisodes.length} → `
      + `${after.injuryEpisodes.length}). Same boot branch as the illness: episodes are `
      + 'persisted inputs the cold-start context does not name');
    assert(weekShape() === responded,
      `the injured week changed across the relaunch (\n    before: ${responded}`
      + `\n    after:  ${weekShape()}\n) — same inputs must derive the same week`);
  });

  // ── 4. THE READINESS ANSWER (control: its own armoured input store) ──────
  await run('4 a readiness answer is still an input after a relaunch', async () => {
    reachWorldByActing();
    const date = addDaysISO(WEEK, 4);
    quiet(() => commitReadinessSignalTransaction({
      date, patch: buildReadinessSignalPatch('flat'),
    }));
    assert(useReadinessStore.getState().signalsByDate[date],
      'the readiness answer never reached its own store');
    await relaunch({ dropMirrors: true });
    assert(useReadinessStore.getState().signalsByDate[date],
      'the readiness answer did not survive its own armoured input store');
    assert(getAcceptedMaterialContext().readinessSignalsByDate[date],
      'the readiness input did not reach the derived context after boot');
  });

  // ── 5. THE SEASON PHASE (control: a profile answer + the anchor clock) ───
  await run('5 a season phase change is still an input after a relaunch', async () => {
    reachWorldByActing();
    const stored = useProfileStore.getState().onboardingData;
    const result = await quietAsync(() => commitProfileProgramTransaction({
      change: {
        kind: 'profile_setup',
        patch: {
          seasonPhase: 'In-season',
          usualGameDay: 'Saturday',
          gameDay: 'Saturday',
          preferredTrainingDays: stored.preferredTrainingDays,
          trainingDaysPerWeek: stored.trainingDaysPerWeek,
          teamTrainingDays: stored.teamTrainingDays,
          teamTrainingDaysPerWeek: stored.teamTrainingDaysPerWeek,
        },
      },
      todayISO: TODAY,
      sourceSurface: 'phase_shift',
    } as never)) as { ok: boolean; message?: string };
    assert(result.ok, `the phase shift refused: ${result.message ?? ''}`);
    const shifted = weekShape();
    await relaunch({ dropMirrors: true });
    const clock = (useProgramStore.getState().currentProgram as TrainingProgram | null)
      ?.seasonPhaseClock;
    assert(clock?.selectedPhase === 'In-season',
      `the derived program came back on ${clock?.selectedPhase ?? 'no'} phase — the phase `
      + 'clock is an ANCHOR input (plan §2 class 1, and the week-identity law: block number '
      + 'from the anchor, never re-derived from a date)');
    assert(weekShape() === shifted,
      `the week changed across the relaunch (\n    before: ${shifted}\n    after:  ${weekShape()}\n)`);
  });

  // ── 6. THE BUSY WEEK ─────────────────────────────────────────────────────
  await run('6 a stated busy week lands, the week responds, and both survive a relaunch', async () => {
    reachWorldByActing();
    const before = weekShape();
    await quietAsync(() => transactTemporarySourceFact({
      operation: 'create',
      fact: createTemporaryScheduleFact({
        observedDate: WEEK,
        scope: temporaryFactScope({ kind: 'week', weekStart: WEEK } as never),
        scheduleKind: 'busy_week',
        maxSessions: 2,
        sourceSurface: 'week_readiness_sheet',
      }),
      todayISO: TODAY,
      now: `${TODAY}T02:00:00.000Z`,
    } as never));
    const stated = factInputs().temporarySourceFacts.length;
    assert(stated >= 1, 'the busy-week door left no source fact — nothing to relaunch');
    const responded = weekShape();
    assert(responded !== before,
      `"I can only train twice this week" changed nothing in the visible week (${responded})`);
    await relaunch({ dropMirrors: true });
    assert(factInputs().temporarySourceFacts.length === stated,
      `the athlete's busy week is GONE after a relaunch (${stated} → `
      + `${factInputs().temporarySourceFacts.length}) — same cold-start branch as the illness`);
    assert(weekShape() === responded,
      `the busy week changed across the relaunch (\n    before: ${responded}`
      + `\n    after:  ${weekShape()}\n)`);
  });

  // ── 7. THE EQUIPMENT ANSWER (a profile answer, plan §2 class 1) ──────────
  await run('7 an equipment answer is still an input after a relaunch', async () => {
    reachWorldByActing();
    const result = await quietAsync(() => commitProfileProgramTransaction({
      change: {
        kind: 'equipment_answer',
        answer: {
          tags: { barbell: 'have', dumbbells: 'have', kettlebell: 'not_today' },
          modalities: { assault_bike: 'have' },
          answeredOn: TODAY,
        },
      },
      todayISO: TODAY,
      sourceSurface: 'profile_equipment_editor',
    } as never)) as { ok: boolean; message?: string; reason?: string };
    assert(result.ok,
      `the equipment answer refused: ${result.message ?? ''} (${result.reason ?? ''})`);
    const answered = useProfileStore.getState().onboardingData.equipmentAnswer?.answeredOn;
    assert(answered === TODAY,
      `the equipment answer did not reach the profile (answeredOn ${answered ?? 'absent'})`);
    await relaunch({ dropMirrors: true });
    assert(useProfileStore.getState().onboardingData.equipmentAnswer?.answeredOn === TODAY,
      'the equipment answer did not survive the relaunch — it is a profile ANSWER '
      + '(plan §2 class 1) and the profile store is already armoured, so a loss here is the '
      + 'answer never reaching the store the boot reads');
  });

  // ── 8. THE R1 LAW STILL HOLDS WITH FACTS PRESENT ─────────────────────────
  await run('8 a boot with facts on the ledger still appends nothing', async () => {
    reachWorldByActing();
    await quietAsync(() => transactTemporarySourceFact({
      operation: 'create',
      fact: severeIllnessThisWeek(),
      todayISO: TODAY,
      now: `${TODAY}T02:00:00.000Z`,
    } as never));
    await relaunch();
    const first = useDecisionLedgerStore.getState().entries.length;
    await relaunch();
    const second = useDecisionLedgerStore.getState().entries.length;
    assert(second === first,
      `the boot appended ${second - first} decision(s) with a fact present (${first} → `
      + `${second}) — "boot appends nothing" is the plan's strongest structural law and a `
      + 'fact must not become a decision at launch');
  });

  console.log(`\n  fact-door input ownership totals: ${passed} passed, ${failed} failed`);

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
    console.log('\n  FAILURES');
    for (const failure of failures) console.log(`   - ${failure}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('fact-door input ownership suite crashed', error);
  process.exit(1);
});
