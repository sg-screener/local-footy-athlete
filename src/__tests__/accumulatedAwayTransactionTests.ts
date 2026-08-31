/* Preserved-phone Away journey: accumulated facts + moved game + restart + atomic trip/kit. */
(global as { __DEV__?: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
} };

import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { DEV_E2E_STANDARD_PROFILE } from '../dev/e2e/devE2EStandardProfile';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { visibleSignature } from './compilerYear/invariants';
import { readinessActionForKind } from '../utils/weekReadinessActions';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { useProgramStore } from '../store/programStore';
import { ownedEquipmentKit } from '../store/profileStore';
import {
  createTemporaryEquipmentFact,
  createTemporaryScheduleFact,
  normalizeTemporarySourceFacts,
  temporaryFactScope,
} from '../rules/temporarySourceFact';
import { commitTemporarySourceFactSet } from '../store/temporarySourceFactTransaction';
import { buildScheduleAcknowledgment } from '../utils/readinessAcknowledgment';

const TODAY = '2026-08-31';
const SATURDAY = '2026-09-05';
const RETURN = '2026-09-06';
const LAST_AWAY = '2026-09-05';
let passed = 0;
const failures: string[] = [];
function check(label: string, condition: boolean, detail = ''): void {
  if (condition) passed += 1;
  else failures.push(`${label}: ${detail}`);
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${condition ? '' : ` ${detail}`}`);
}
function read() { return quiet(() => deriveVisibleWeekLive(TODAY, TODAY)); }
function facts() {
  return normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext)
    .temporarySourceFacts;
}
function activeFact(kind: string) {
  return facts().find((fact: any) => fact.factKind === kind && fact.status === 'active') as any;
}
function rowEquipment(): string[] {
  return read().flatMap((day) => day.workout?.exercises ?? [])
    .flatMap((row) => row.exercise?.equipmentRequired ?? [])
    .map(String);
}

async function main(): Promise<void> {
  await quietAsync(() => coldStartThroughOnboarding({
    profile: DEV_E2E_STANDARD_PROFILE,
    installDayISO: TODAY,
  }));

  const cleanMove = await quietAsync(() => executeFixtureMutationTransaction({
    action: 'move', fixtureKind: 'game', sourceDate: SATURDAY, targetDate: RETURN,
    todayISO: TODAY,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab', commandId: 'away-clean:move-game' },
  }));
  check('clean equivalent reaches the moved Sunday fixture', cleanMove.outcome === 'accepted', JSON.stringify(cleanMove));
  const cleanKit = ownedEquipmentKit();
  const cleanAway = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_schedule_modifier',
    source: { screen: 'program_tab', surface: 'away_this_week', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: {
      date: TODAY, todayISO: TODAY,
      awaySpan: { from: TODAY, until: LAST_AWAY },
      awayEquipment: { tags: cleanKit.tags, conditioningModalities: cleanKit.conditioningModalities },
    },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { visibleWeek: read(), todayISO: TODAY }));
  check('clean equivalent Away succeeds through the same atomic door', cleanAway.ok === true, JSON.stringify(cleanAway));

  // Start again and reach the phone's accumulated order only by actions.
  await quietAsync(() => coldStartThroughOnboarding({
    profile: DEV_E2E_STANDARD_PROFILE,
    installDayISO: TODAY,
  }));

  // The relevant arrival order from the phone: fatigue, tired/sleep context,
  // moved fixture, then a restarted accepted state before Away is answered.
  for (const kind of ['tired_today', 'poor_sleep_today'] as const) {
    const result = await quietAsync(() => executeProgramControlActionDurably(
      readinessActionForKind(kind, { anchorDateISO: TODAY, todayISO: TODAY }),
      { visibleWeek: read(), todayISO: TODAY },
    ));
    check(`accumulated ${kind} fact lands`, result.ok === true, JSON.stringify(result));
  }
  const moved = await quietAsync(() => executeFixtureMutationTransaction({
    action: 'move', fixtureKind: 'game', sourceDate: SATURDAY, targetDate: RETURN,
    todayISO: TODAY,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab', commandId: 'away-phone-ledger:move-game' },
  }));
  check('Saturday game moves to Sunday before Away', moved.outcome === 'accepted', JSON.stringify(moved));
  const restarted = await quietAsync(() => relaunchApp({ storage, todayISO: TODAY }));
  check('accumulated state restarts before Away', restarted.ok, restarted.error);
  const priorKinds = facts().filter((fact: any) => fact.status === 'active').map((fact: any) => fact.factKind);
  check('restarted ledger retains fatigue then sleep order',
    priorKinds[0] === 'fatigue' && priorKinds[1] === 'poor_sleep', JSON.stringify(priorKinds));

  const before = visibleSignature(read());
  const beforeTeam = read().filter((day) => /Team Training/i.test(day.workout?.name ?? '')).length;
  const beforeWeighted = rowEquipment().filter((item) => !/bodyweight|band/i.test(item)).length;
  check('accumulated control has club work and weighted rows', beforeTeam > 0 && beforeWeighted > 0,
    `team=${beforeTeam} weighted=${beforeWeighted}`);

  // Rejection injection occurs at the real accepted candidate gateway with the
  // complete two-fact set. It proves neither half can publish alone and names
  // the typed reason the acknowledgment mapper receives.
  const accepted = normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext);
  const kit = ownedEquipmentKit();
  const scope = temporaryFactScope({ kind: 'window', from: TODAY, until: LAST_AWAY });
  const schedule = createTemporaryScheduleFact({
    observedDate: TODAY, scope, scheduleKind: 'travel', unavailableDates: [],
    sourceActor: 'athlete', sourceSurface: 'away_this_week',
  });
  const equipment = createTemporaryEquipmentFact({
    observedDate: TODAY, scope, mode: 'without', equipmentTags: kit.tags,
    conditioningModalities: kit.conditioningModalities,
    sourceActor: 'athlete', sourceSurface: 'away_this_week',
  });
  const rejected = await commitTemporarySourceFactSet({
    nextFacts: normalizeTemporarySourceFacts({ value: [
      ...accepted.temporarySourceFacts, schedule, equipment,
    ] }),
    targetFactId: schedule.factId,
    todayISO: TODAY,
    reason: 'test:accumulated-away-rejection',
    expectedAcceptedRevision: accepted.revision,
    testHooks: { verifyCandidate: () => false },
  });
  check('typed accumulated rejection is captured',
    rejected.ok === false
      && rejected.reason === 'temporary_source_fact_visible_candidate_test_rejection',
    JSON.stringify(rejected));
  check('rejected transaction leaves neither travel nor equipment active',
    !activeFact('schedule') && !activeFact('equipment'), JSON.stringify(facts()));
  const refusal = buildScheduleAcknowledgment({ ok: false, failureReason: rejected.reason }, 'away_equipment');
  check('failure copy uses the typed reason and says both halves stayed unchanged',
    refusal.tone === 'error' && /Travel and equipment stayed unchanged/.test(refusal.message)
      && !/week is unchanged/.test(refusal.message), refusal.message);

  const result = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_schedule_modifier',
    source: { screen: 'program_tab', surface: 'away_this_week', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: {
      date: TODAY, todayISO: TODAY,
      awaySpan: { from: TODAY, until: LAST_AWAY },
      awayEquipment: { tags: kit.tags, conditioningModalities: kit.conditioningModalities },
    },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { visibleWeek: read(), todayISO: TODAY }));
  check('accumulated Away and Bodyweight answer commits atomically', result.ok === true, JSON.stringify(result));
  check('success contains one active travel and one linked equipment fact',
    !!activeFact('schedule') && !!activeFact('equipment'), JSON.stringify(facts()));
  check('team training inside the trip is removed',
    read().every((day) => day.date > LAST_AWAY || !/Team Training/i.test(day.workout?.name ?? '')),
    visibleSignature(read()));
  const unavailable = new Set(kit.tags.map((tag) => String(tag).replace(/_/g, ' ')));
  const weightedAfter = rowEquipment().filter((item) =>
    [...unavailable].some((tag) => item.toLowerCase().includes(tag.replace(/s$/, ''))));
  check('weighted exercises use valid available alternatives', weightedAfter.length === 0,
    JSON.stringify(weightedAfter));
  check('Sunday return-date game remains outside the Away span',
    /Game/i.test(read().find((day) => day.date === RETURN)?.workout?.name ?? ''), visibleSignature(read()));

  const after = visibleSignature(read());
  const restartAway = await quietAsync(() => relaunchApp({ storage, todayISO: TODAY }));
  check('Away result reconstructs exactly at restart', restartAway.ok && visibleSignature(read()) === after,
    restartAway.error);
  const travel = activeFact('schedule');
  const cleared = await quietAsync(() => executeProgramControlActionDurably({
    type: 'clear_fatigue_status',
    source: { screen: 'program_tab', surface: 'my_status', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { modifierId: travel?.factId, date: TODAY },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
  }, { visibleWeek: read(), todayISO: TODAY }));
  check('Clear resolves travel and equipment together', cleared.ok === true
    && !activeFact('schedule') && !activeFact('equipment'), JSON.stringify(cleared));
  check('Clear restores the accumulated pre-Away program', visibleSignature(read()) === before,
    `${before} -> ${visibleSignature(read())}`);
  const restartClear = await quietAsync(() => relaunchApp({ storage, todayISO: TODAY }));
  check('cleared result reconstructs exactly', restartClear.ok && visibleSignature(read()) === before,
    restartClear.error);

  console.log(`Accumulated Away transaction: ${passed} passed, ${failures.length} failed`);
  if (failures.length) { failures.forEach((failure) => console.error(failure)); process.exitCode = 1; }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
