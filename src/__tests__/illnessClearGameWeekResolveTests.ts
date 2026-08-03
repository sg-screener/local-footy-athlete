/**
 * FINDING #4 — illness-clear RESOLVE-TIME on a GAME week (fix pinned; GREEN post-fix).
 *
 * Pins the on-device merge blocker recorded in
 * docs/audits/UNIT02_DOOR_ROUTING_REPORT_2026-07-23.md §"Finding #4 is NOT fixed" and
 * diagnosed + fixed per docs/ILLNESS_CLEAR_LEDGER_REASSESSMENT_2026-07-23.md (approved
 * Option (a)-scoping + Q6): after the readiness-card clear of a severe illness on a GAME
 * week, the week reverts but the illness fact used to stay ACTIVE (a half-apply).
 *
 * WHY THE EXISTING HARNESS LIED (the third seed-fidelity recurrence). The device-exact seed
 * in derivingSourceFactDeviceCommitTests.ts (D3/D8) drives clear_fatigue_status and is GREEN
 * — because it reset `markedDays: {}` and stubbed `setGameDay`, DROPPING the Saturday game
 * that `standard-in-season-week` witnesses. Without the fixture there is no game-proximity
 * re-tiering, so the resolve's re-canonicalisation is idempotent and the clear succeeds; the
 * device HAS the game, so it is not idempotent and the resolve was rejected. This suite
 * seeds via the canonical device-exact fixture (deviceExactSeed.ts) that restores the game.
 *
 * ROOT CAUSE (fixed). The clear's resolve (transactTemporarySourceFact 'resolve') removes a
 * fact and took the re-canonicalising deriving branch (scopedRegen only fires when a NEW
 * fatigue id APPEARS, not when one is removed), whose re-canonicalisation of the game week
 * drifts acceptedCompositionBase.surfaces (nulls todayWorkout) → verifyCandidate rejects with
 * `accepted_composition_base_changed_by_temporary_fact`, and the cascade revert had already
 * committed → half-apply. FIX (temporarySourceFactTransaction.ts): a REMOVE of a fact that
 * OWNS a scoped-regen (deriving_source_fact) reversible adjustment is a stored-prior-state
 * restore — base-preserving, symmetric with the scoped-regen ADD (typed ownership, no
 * fact-kind sniffing). G1 shows the restStress divergence Option (a) targeted is already nil
 * here; the load-bearing fix is the resolve-branch retirement (Q6).
 *
 * WHAT THIS PINS: C1 (no-game control) · F4 (the fixed clear) · G1 (authoring==visible
 * restStress) · G2 (byte-identical base restore) · G3 (atomic, no half-apply) · F5 (cooked
 * fatigue generalises) · P1 (projection facts NOT captured by the base-preserve) · FIDELITY
 * (the fixture installs + self-checks the witnessed game).
 *
 * Run: TZ=Australia/Melbourne npx sucrase-node src/__tests__/illnessClearGameWeekResolveTests.ts
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
armTotalsOrRed();
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import { installDeviceExactSeed, teardownDeviceExactSeed, primeDeviceExactGeneration } from './deviceExactSeed';

const WEEK = '2026-07-13'; // Monday anchor for standard-in-season-week
let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}
function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined; console.log = () => undefined;
  try { return body(); } finally { console.warn = warn; console.error = error; console.log = log; }
}
async function run(name: string, body: () => Promise<void>): Promise<void> {
  memory.clear();
  try { await body(); passes += 1; console.log(`  PASS [invariant] ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`); }
}

/** Device-exact seed via the canonical fixture. `withGame` toggles the seed's WITNESSED
 *  Saturday game — the fidelity dimension the deriving suite dropped. withGame=false is the
 *  deliberate no-fixture control proving the game mark is load-bearing. */
function seedDeviceExact(withGame: boolean): string {
  return installDeviceExactSeed({ withWitnessedFixtures: withGame }).anchor;
}

async function commitSevereIllness(anchor: string): Promise<{ ok?: boolean; message?: string; createdModifierIds?: string[] }> {
  return await executeProgramControlActionDurably({
    type: 'set_illness_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'current_week', payload: { date: anchor, todayISO: anchor, severity: 'severe' },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  } as never, { todayISO: anchor }) as never;
}
async function commitSevereFatigue(anchor: string): Promise<{ ok?: boolean; message?: string; createdModifierIds?: string[] }> {
  return await executeProgramControlActionDurably({
    type: 'set_fatigue_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'current_week', payload: { date: anchor, todayISO: anchor, level: 'cooked' },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  } as never, { todayISO: anchor }) as never;
}
async function clearFact(anchor: string, modifierId: string | undefined): Promise<void> {
  await executeProgramControlActionDurably({
    type: 'clear_fatigue_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'current_week', payload: { date: anchor, modifierId },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
  } as never, { todayISO: anchor });
}
function derivingAdjustmentSourceFactIds(): string[] {
  return (useProgramStore.getState().reversibleAdjustmentLedger.adjustments as Array<{ kind: string; sourceFactId?: string }>)
    .filter((a) => a.kind === 'deriving_source_fact' && a.sourceFactId)
    .map((a) => a.sourceFactId as string);
}
function activeFactCount(): number {
  const facts = (useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts ?? []) as Array<{ status?: string }>;
  return facts.filter((f) => f.status === 'active').length;
}
type RestStress = { achievedActiveRecoveryCount?: number; achievedModerateDayCount?: number; achievedTrueFullRestCount?: number; achievedHardDayCount?: number };
/** Authoring signature = the stored contract for WEEK; visible signature = the
 *  resolveWeekWithConditioning-resolved re-derivation. Q4/Q5 require these equal. */
function authoringVsVisibleRestStress(week: string): { authoring: RestStress | null; visible: RestStress | null } {
  const state = useProgramStore.getState();
  const overlay = state.weekScopedOverlays[week] ?? null;
  const mc = state.currentProgram?.microcycles.find((m: { startDate: string; endDate: string }) =>
    week >= m.startDate.slice(0, 10) && week <= m.endDate.slice(0, 10)) ?? state.currentMicrocycle;
  const authoring = ((overlay?.exposureContractV2 ?? mc?.exposureContractV2) as { restStress?: RestStress } | undefined)?.restStress ?? null;
  let visible: RestStress | null = null;
  try {
    visible = (rebaseAcceptedEffectiveWeek({
      surfaces: state as never, weekStart: week,
      profile: useProfileStore.getState().onboardingData,
      markedDays: state.acceptedMaterialContext.markedDays,
    }).evaluation.contract as { restStress?: RestStress }).restStress ?? null;
  } catch { visible = null; }
  return { authoring, visible };
}
function currentBaseSurfaces(): Record<string, unknown> {
  const s = useProgramStore.getState();
  return {
    currentProgram: s.currentProgram, currentMicrocycle: s.currentMicrocycle, todayWorkout: s.todayWorkout,
    blockState: s.blockState, dateOverrides: s.dateOverrides, overrideContexts: s.overrideContexts,
    weekScopedOverlays: s.weekScopedOverlays, userRemovalConstraints: s.userRemovalConstraints,
    reversibleAdjustmentLedger: s.reversibleAdjustmentLedger, exposureContractsByWeek: s.exposureContractsByWeek,
  };
}

(async () => {
  console.log('\nFinding #4 — illness-clear RESOLVE-TIME failure on a game week (DIAGNOSIS HARNESS)\n');
  await primeDeviceExactGeneration();

  // ── CONTROL: no game mark — the clear resolves the fact (the existing D-suite path).
  //    Proves the failure is fixture-driven, not intrinsic to the clear.
  await run('C1 control (no game): clearing the severe illness fact resolves it', async () => {
    const anchor = seedDeviceExact(false);
    const commit = await commitSevereIllness(anchor);
    assert(commit.ok === true, `illness commit rejected: "${commit.message}"`);
    assert(activeFactCount() === 1, 'precondition: exactly one active fact after the illness commit');
    await clearFact(anchor, commit.createdModifierIds?.[0]);
    assert(activeFactCount() === 0,
      'control regression: the illness fact did not resolve even WITHOUT a game week');
  });

  // ── FAITHFUL DEVICE-EXACT: Saturday game mark present. The illness commit lands
  //    (finding #1-#3 device-verified), but the CLEAR leaves the fact ACTIVE — the
  //    exact merge blocker. RED until the resolve/clear path is fixed. Asserts the
  //    CORRECT behaviour: the fact resolves on a game week too.
  await run('F4 device-exact (game week): clearing the severe illness fact resolves it', async () => {
    const anchor = seedDeviceExact(true);
    const commit = await commitSevereIllness(anchor);
    assert(commit.ok === true, `illness commit rejected on a game week: "${commit.message}"`);
    assert(activeFactCount() === 1, 'precondition: exactly one active fact after the illness commit');
    await clearFact(anchor, commit.createdModifierIds?.[0]);
    assert(activeFactCount() === 0,
      'FINDING #4: the illness fact stayed ACTIVE after clear on a game week — the resolve step ' +
      'was rejected (accepted_composition_base_changed_by_temporary_fact) while the cascade revert ' +
      'had already reverted the week');
  });

  // ── G1 — authoring == visible §18 signature on a game week (Q4/Q5). The authored
  //    illness_recovery contract's restStress must equal the resolveWeekWithConditioning
  //    re-derivation, so "visible == accepted" holds by construction on any re-tiered week.
  await run('G1 authoring == visible §18 restStress signature on the illness game week', async () => {
    const anchor = seedDeviceExact(true);
    const commit = await commitSevereIllness(anchor);
    assert(commit.ok === true, `illness commit rejected: "${commit.message}"`);
    const { authoring, visible } = authoringVsVisibleRestStress(anchor);
    assert(authoring !== null && visible !== null, 'missing authoring or visible contract');
    assert(JSON.stringify(authoring) === JSON.stringify(visible),
      `authored restStress ${JSON.stringify(authoring)} != visible ${JSON.stringify(visible)}`);
  });

  // ── G2 — resolving an overlay-owned fact removal leaves acceptedCompositionBase
  //    byte-identical (Q6 / typed ownership). The scoped-regen ADD keeps the base clean
  //    (preserveExact); undo restores the stored prior state, never re-derives. So after
  //    clearing the overlay-owned illness fact on a game week, the composition base must
  //    match the pre-illness base exactly AND the fact must be resolved. RED today: the
  //    resolve re-canonicalises the game-week base and is rejected, so the clear does not
  //    complete.
  await run('G2 clearing an overlay-owned fact leaves the authored week surfaces byte-identical', async () => {
    const anchor = seedDeviceExact(true);
    // The authored program surfaces (what the athlete is prescribed), excluding the
    // reversibleAdjustmentLedger which legitimately retains the now-cleared adjustment as
    // history (prior art R12/D3 compare the restored WEEK, not the ledger record). The
    // todayWorkout→null re-canonicalise drift the resolve is rejected on lives here.
    const weekSurfaces = (): string => {
      const { reversibleAdjustmentLedger: _l, ...rest } = currentBaseSurfaces();
      return semanticFingerprint(rest);
    };
    const before = weekSurfaces();
    const commit = await commitSevereIllness(anchor);
    assert(commit.ok === true, `illness commit rejected: "${commit.message}"`);
    await clearFact(anchor, commit.createdModifierIds?.[0]);
    assert(activeFactCount() === 0, 'the overlay-owned fact was not resolved by the clear');
    assert(weekSurfaces() === before,
      'the authored week surfaces were not restored byte-identical after the overlay-owned clear');
  });

  // ── G3 — cascade + resolve atomicity (no half-apply). On a game week the clear must be
  //    all-or-nothing: it must NOT leave the week reverted while the fact stays active.
  await run('G3 the game-week clear is atomic — never week-reverted-but-fact-active', async () => {
    const anchor = seedDeviceExact(true);
    const commit = await commitSevereIllness(anchor);
    assert(commit.ok === true, `illness commit rejected: "${commit.message}"`);
    const illnessMode = ((): string | undefined => {
      const o = useProgramStore.getState().weekScopedOverlays[anchor];
      return (o?.exposureContractV2 as { identity?: { mode?: string } } | undefined)?.identity?.mode;
    })();
    assert(illnessMode === 'optional_week', `precondition: illness week authored, mode=${illnessMode}`);
    await clearFact(anchor, commit.createdModifierIds?.[0]);
    const factActive = activeFactCount() > 0;
    const overlayGone = !useProgramStore.getState().weekScopedOverlays[anchor];
    // Half-apply = the week reverted (overlay gone) but the fact is still active.
    assert(!(factActive && overlayGone),
      'HALF-APPLY: the week reverted (illness overlay removed) but the illness fact is still active');
  });

  // ── F5 — typed-ownership generalisation (NOT an illness special-case). Severe FATIGUE
  //    (cooked) also authors a scoped-regen overlay, so its clear must resolve on a game
  //    week too — via the same sourceFactId-linked base-preserve, no fact-kind branch.
  await run('F5 severe FATIGUE (cooked) clears on a game week too (typed ownership, not illness-only)', async () => {
    const anchor = seedDeviceExact(true);
    const commit = await commitSevereFatigue(anchor);
    assert(commit.ok === true, `cooked fatigue commit rejected on a game week: "${commit.message}"`);
    assert(activeFactCount() === 1, 'precondition: exactly one active fact after the cooked commit');
    await clearFact(anchor, commit.createdModifierIds?.[0]);
    assert(activeFactCount() === 0,
      'the cooked fatigue fact stayed active after clear — the ownership base-preserve did not generalise');
  });

  // ── P1 — ownership-scoping pin, REWRITTEN 2026-08-03 for the approved schedule-fact
  //    lanes (docs/SCHEDULE_FACT_OWNERSHIP_REASSESSMENT_2026-08-01.md option 2, Sam
  //    2026-08-02). The original cell asserted an unruled schedule fact "must re-project,
  //    never silently base-preserve" — that re-projecting third lane is the retired dead
  //    lane (it re-canonicalised the base and the verifier refused every device commit).
  //    Under the lanes an UNRULED (max_sessions) fact commits INERT and HONEST: ok, no
  //    program change, base preserved. What this cell keeps — its real payload — is the
  //    OWNERSHIP SCOPING: the illness fact's scoped-regen adjustment is never captured,
  //    minted, or stolen by another fact's commit.
  await run('P1 an unruled schedule fact commits record-only and never touches the illness adjustment', async () => {
    const anchor = seedDeviceExact(true);
    const illness = await commitSevereIllness(anchor);
    assert(illness.ok === true, `illness commit rejected: "${illness.message}"`);
    const illnessFactId = illness.createdModifierIds?.[0];
    // Ownership scoping: the only scoped-regen adjustment belongs to the illness fact.
    const owned = derivingAdjustmentSourceFactIds();
    assert(owned.length === 1 && owned[0] === illnessFactId,
      `expected exactly one scoped-regen adjustment owned by the illness fact, got ${JSON.stringify(owned)}`);
    // A max_sessions schedule fact — UNRULED, so record-only by the approved lanes.
    const sched = await executeProgramControlActionDurably({
      type: 'set_schedule_modifier',
      source: { screen: 'program_tab', surface: 'schedule_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, todayISO: anchor, maxSessionsThisWeek: 3 },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: anchor }) as { ok?: boolean; changedProgram?: boolean };
    assert(sched.ok === true,
      'the unruled schedule fact was refused — the inert lane regressed to the dead lane');
    assert(sched.changedProgram === false,
      'an unruled schedule fact claims a program change — record-only must be honest');
    // The illness fact still owns its adjustment; the record-only fact minted none.
    const ownedAfter = derivingAdjustmentSourceFactIds();
    assert(ownedAfter.length === 1 && ownedAfter[0] === illnessFactId,
      'the record-only fact must not mint or steal a scoped-regen adjustment');
  });

  // ── FIDELITY — the canonical fixture actually installs the witnessed game (the dimension
  //    the deriving suite dropped) and its self-check would throw if it were dropped.
  await run('FIDELITY the device-exact fixture installs the witnessed Saturday game', async () => {
    const withGame = installDeviceExactSeed({ withWitnessedFixtures: true });
    assert(withGame.gameDate !== null, 'the witnessed game fixture was not installed');
    assert(useProgramStore.getState().acceptedMaterialContext.markedDays[withGame.gameDate!] === 'game',
      'the game mark is not present in accepted markedDays after install');
    const noGame = installDeviceExactSeed({ withWitnessedFixtures: false });
    assert(noGame.gameDate === null, 'the no-fixture control should not install a game');
  });

  teardownDeviceExactSeed();
  console.log(`\nFinding #4 illness-clear game-week diagnosis: ${passes} passing, ${failures.length} failing\n`);
  totalsPrinted(failures.length);
  if (failures.length > 0) process.exitCode = 1;
})();
