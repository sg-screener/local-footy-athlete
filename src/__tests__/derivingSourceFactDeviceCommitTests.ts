/** Real onboarding -> durable fact -> compiler -> clear/restart acceptance. */

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
import { coldStartThroughOnboarding, quietAsync, relaunchApp } from './support/athleteJourney';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { profileForDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { applyPlanChange, previewPlanChangeRisk } from '../utils/planChangeProducer';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';

const WEEK = '2026-07-13';
let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}
function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error;
  console.warn = () => undefined; console.error = () => undefined;
  try { return body(); } finally { console.warn = warn; console.error = error; }
}
async function run(name: string, body: () => Promise<void>): Promise<void> {
  memory.clear();
  try { await body(); passes += 1; console.log(`  PASS [invariant] ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`); }
}

async function seedDeviceExact(): Promise<string> {
  await quietAsync(() => coldStartThroughOnboarding({
    profile: profileForDevE2ESeed('standard-in-season-week'), installDayISO: WEEK,
  }));
  return WEEK;
}

/** The ACCEPTED effective week as the athlete would see it — mode + a stable
 *  day/tier/intensity signature. This is the pure-projection read; it is what a
 *  correct (b)-style scoped-regen commit must have re-authored. */
function acceptedWeek(anchor: string): { mode: string; signature: string; blockingViolations: string[]; optionalCount: number } {
  const state = useProgramStore.getState();
  const rebased = rebaseAcceptedEffectiveWeek({
    surfaces: state as never, weekStart: anchor,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
  return {
    mode: rebased.contract.identity.mode,
    blockingViolations: rebased.evaluation.blockingViolations.map((v) => v.code),
    optionalCount: rebased.visibleWorkouts.filter((w) =>
      w.sessionTier === 'optional' || w.sessionTier === 'recovery').length,
    signature: rebased.visibleWorkouts
      .map((w) => `${w.dayOfWeek}:${w.workoutType}/${w.sessionTier ?? '-'}/${w.intensity ?? '-'}`)
      .join('  '),
  };
}

/** The VISIBLE resolver signature (what the athlete taps on) — must reflect the
 *  reduction too, not only the accepted-effective-week. */
function visibleSignature(anchor: string): string {
  return resolveWeekWithConditioning(anchor, buildScheduleStateImperative())
    .map((d) => `${d.workout?.dayOfWeek}:${d.workout?.workoutType ?? 'Rest'}/${d.workout?.sessionTier ?? '-'}`)
    .join('  ');
}

function activeAdjustments() {
  return useProgramStore.getState().reversibleAdjustmentLedger.adjustments
    .filter((a) => a.status === 'active');
}

async function commitSevereIllness(anchor: string) {
  return executeProgramControlActionDurably({
    type: 'set_illness_status',
    source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
    scope: 'current_week', payload: { date: anchor, todayISO: anchor, severity: 'severe' },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  } as never, { todayISO: anchor });
}

async function main(): Promise<void> {
  // ── D1 — a DERIVING severe illness (bed-ridden) commit must produce a REDUCED,
  // mode-authored week, not a silent no-op. Pins BOTH pre-fix failure modes:
  //   • device-exact real base → rejected (accepted_composition_base_changed_by_temporary_fact);
  //   • R1-style null base → "succeeds" but leaves the accepted week byte-identical
  //     game_week (the mode is generation-only and this path never regenerates).
  // A correct scoped-regen commit re-authors the week under illness_recovery.
  await run('D1 deriving-illness: a severe illness commit re-authors an illness_recovery week', async () => {
    const anchor = await seedDeviceExact();
    const res = await executeProgramControlActionDurably({
      type: 'set_illness_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, todayISO: anchor, severity: 'severe' },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: anchor });
    assert((res as { ok?: boolean }).ok === true,
      `severe illness rejected against a real composition base: "${(res as { message?: string }).message}"`);
    assert(acceptedWeek(anchor).mode === 'optional_week',
      `the accepted week was not re-authored under illness_recovery (silent no-op), mode=${acceptedWeek(anchor).mode}`);
  });

  // ── D2 — the same class for severe FATIGUE (cooked): the commit must actually
  // REDUCE the accepted week (not a no-op). Equal pre-fix behaviour with D1 is the
  // proof this is a deriving-commit ownership issue, not illness-specific.
  await run('D2 deriving-fatigue: a severe (cooked) fatigue commit actually reduces the accepted week', async () => {
    const anchor = await seedDeviceExact();
    const before = acceptedWeek(anchor).signature;
    const res = await executeProgramControlActionDurably({
      type: 'set_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, todayISO: anchor, level: 'cooked' },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: anchor });
    assert((res as { ok?: boolean }).ok === true,
      `severe fatigue rejected against a real composition base: "${(res as { message?: string }).message}"`);
    assert(acceptedWeek(anchor).signature !== before,
      'the accepted week was byte-identical after a severe fatigue commit (silent no-op)');
  });

  // ── D3 — cascade: clearing the fact restores the accepted week BYTE-IDENTICAL to
  // the pre-illness authored week (via stored prior state, not a re-regeneration).
  await run('D3 cascade: clearing the severe illness fact restores the accepted week byte-identical', async () => {
    const anchor = await seedDeviceExact();
    const before = acceptedWeek(anchor).signature;
    const commit = await executeProgramControlActionDurably({
      type: 'set_illness_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, todayISO: anchor, severity: 'severe' },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: anchor });
    // Non-vacuous: the fact must actually have re-authored a reduced week first,
    // else "restore" is trivially true. RED until the commit itself works.
    assert((commit as { ok?: boolean }).ok === true &&
      acceptedWeek(anchor).signature !== before,
      'precondition: the severe illness commit must first re-author a reduced week');
    const modifierId = (commit as { createdModifierIds?: string[] }).createdModifierIds?.[0];
    await executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, modifierId },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    } as never, { todayISO: anchor });
    assert(acceptedWeek(anchor).signature === before,
      'clearing the fact did not restore the accepted week byte-identical');
  });

  // ── D4 — §18 validates the EFFECTIVE (re-authored) week (rider 1). The commit is
  // accepted AND the resulting illness_recovery week passes §18 (no blocking
  // violations) — the fact stays gated, validated against the reduced week, not
  // bypassed.
  await run('D4 §18 validates the effective week: the illness_recovery week has no blocking violations', async () => {
    const anchor = await seedDeviceExact();
    const commit = await commitSevereIllness(anchor);
    assert((commit as { ok?: boolean }).ok === true, `commit rejected: "${(commit as { message?: string }).message}"`);
    const week = acceptedWeek(anchor);
    assert(week.mode === 'optional_week', `not illness_recovery, mode=${week.mode}`);
    assert(week.blockingViolations.length === 0,
      `the effective illness_recovery week has §18 blocking violations: ${week.blockingViolations.join(',')}`);
  });

  // Facts are the input; a persisted adjustment snapshot is no longer the owner.
  await run('D5 authorised change: one durable illness fact reconstructs the same reduced week', async () => {
    const anchor = await seedDeviceExact();
    const commit = await commitSevereIllness(anchor);
    assert((commit as { ok?: boolean }).ok === true, `commit rejected: "${(commit as { message?: string }).message}"`);
    const factId = (commit as { createdModifierIds?: string[] }).createdModifierIds?.[0];
    const facts = useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts;
    assert(facts.filter(fact => 'factId' in fact && fact.factId === factId).length === 1,
      'expected exactly one accepted illness fact');
    const beforeRestart = acceptedWeek(anchor).signature;
    const restarted = await quietAsync(() => relaunchApp({ storage: memory, todayISO: anchor }));
    assert(restarted.ok && acceptedWeek(anchor).signature === beforeRestart,
      `the accepted illness week changed on restart: ${restarted.error ?? ''}`);
  });

  // ── D6 — the re-authored week is visibly OPTIONAL/reduced on BOTH the accepted and
  // the visible surfaces, and the commit discloses (Sam's bed-ridden semantics).
  await run('D6 visibly optional + disclosed: the bed-ridden week marks sessions optional and discloses', async () => {
    const anchor = await seedDeviceExact();
    const before = visibleSignature(anchor);
    const commit = await commitSevereIllness(anchor);
    assert((commit as { ok?: boolean }).ok === true, `commit rejected: "${(commit as { message?: string }).message}"`);
    assert(acceptedWeek(anchor).optionalCount >= 1,
      'the illness_recovery week marks no sessions optional/recovery on the accepted surface');
    assert(visibleSignature(anchor) !== before,
      'the VISIBLE resolver did not reflect the reduction (still full week)');
    assert(/nothing's required|optional/i.test((commit as { message?: string }).message ?? ''),
      `commit did not disclose the optional/recovery week: "${(commit as { message?: string }).message}"`);
  });

  // ── D7 — no read-time regression. An INERT (minor) illness fact must NOT trigger a
  // regen: the accepted week stays byte-identical (record-only), proving the scoped
  // regen fires ONLY for deriving facts and resolvers stay pure projection.
  await run('D7 no read-time regression: a minor (inert) illness fact leaves the accepted week byte-identical', async () => {
    const anchor = await seedDeviceExact();
    const before = acceptedWeek(anchor).signature;
    const commit = await executeProgramControlActionDurably({
      type: 'set_illness_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'today_only', payload: { date: anchor, todayISO: anchor, severity: 'minor' },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: anchor });
    assert((commit as { ok?: boolean }).ok === true, `minor illness rejected: "${(commit as { message?: string }).message}"`);
    assert(acceptedWeek(anchor).signature === before,
      'a minor (inert) illness fact changed the accepted week — it must be record-only');
  });

  // Clearing a fact removes only that fact's effect, never a later athlete edit.
  await run('D8 edit-during-illness: clearing and restarting preserve the accepted removal', async () => {
    const anchor = await seedDeviceExact();
    const before = acceptedWeek(anchor).signature;
    const commit = await commitSevereIllness(anchor);
    assert((commit as { ok?: boolean }).ok === true &&
      acceptedWeek(anchor).signature !== before,
      'precondition: the severe illness commit must first re-author a reduced week');
    // Athlete bins Monday's (optional) session during the illness week.
    const week = resolveWeekWithConditioning(anchor, buildScheduleStateImperative());
    const mon = week.find((d) => d.workout && d.workout.workoutType !== 'Rest');
    assert(!!mon?.workout, 'must reach a removable illness-day session');
    if (mon?.workout) {
      const change = { kind: 'remove_session' as const, date: mon.date };
      const preview = previewPlanChangeRisk({ change, visibleWeek: week, todayISO: anchor,
        profile: useProfileStore.getState().onboardingData ?? undefined });
      const removed = applyPlanChange({ change, visibleWeek: week, todayISO: anchor, trace: preview.trace,
        applyOverride: () => undefined });
      assert(removed.ok, `illness-day removal refused: ${removed.message}`);
    }
    const factId = (commit as { createdModifierIds?: string[] }).createdModifierIds?.[0];
    await executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, modifierId: factId },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    } as never, { todayISO: anchor });
    const removedDay = () => resolveWeekWithConditioning(anchor, buildScheduleStateImperative())
      .find(day => day.date === mon!.date)?.workout;
    assert(!removedDay() || removedDay()!.workoutType === 'Rest', 'clearing illness resurrected the removed session');
    assert(activeAdjustments().filter(adjustment => adjustment.sourceFactId === factId).length === 0,
      'a cleared fact still owns an active adjustment');
    const afterClear = acceptedWeek(anchor).signature;
    const restarted = await quietAsync(() => relaunchApp({ storage: memory, todayISO: anchor }));
    assert(restarted.ok && acceptedWeek(anchor).signature === afterClear,
      'the independent athlete removal did not survive restart');
  });

  // ── D9 — athlete-owned pins survive the scoped regen (decideOverrideSweep). A user
  // removal/override made BEFORE the illness fact must still be honoured in the
  // re-authored illness_recovery week (not silently reinstated by regeneration).
  await run('D9 pins survive: a pre-illness athlete removal is preserved through the scoped regen', async () => {
    const anchor = await seedDeviceExact();
    // Athlete bins Monday's session BEFORE getting sick.
    const week0 = resolveWeekWithConditioning(anchor, buildScheduleStateImperative());
    const mon = week0.find((d) => d.workout && d.workout.workoutType !== 'Rest');
    assert(!!mon?.workout, 'precondition: a non-rest session to remove');
    const change = { kind: 'remove_session' as const, date: mon!.date };
    const preview = previewPlanChangeRisk({ change, visibleWeek: week0, todayISO: anchor,
      profile: useProfileStore.getState().onboardingData ?? undefined });
    const removed = applyPlanChange({ change, visibleWeek: week0, todayISO: anchor, trace: preview.trace,
      applyOverride: () => undefined });
    assert((removed as { ok?: boolean }).ok === true, `precondition removal failed: "${(removed as { message?: string }).message}"`);
    const removalConstraintsBefore = useProgramStore.getState().userRemovalConstraints.length;
    const commit = await commitSevereIllness(anchor);
    assert((commit as { ok?: boolean }).ok === true, `commit rejected: "${(commit as { message?: string }).message}"`);
    assert(useProgramStore.getState().userRemovalConstraints.length >= removalConstraintsBefore,
      'the pre-illness user removal constraint was dropped by the scoped regen');
    const monDow = mon!.workout!.dayOfWeek;
    const after = rebaseAcceptedEffectiveWeek({
      surfaces: useProgramStore.getState() as never, weekStart: anchor,
      profile: useProfileStore.getState().onboardingData,
      markedDays: useProgramStore.getState().acceptedMaterialContext.markedDays,
    });
    const monAfter = after.visibleWorkouts.find((w) => w.dayOfWeek === monDow);
    assert(!monAfter || monAfter.workoutType === 'Rest',
      'the athlete-removed Monday session was silently reinstated by the illness regen');
  });

  console.log(`\nDeriving source-fact device-commit invariants: ${passes} passing, ${failures.length} failing`);
  totalsPrinted(failures.length);
  if (failures.length > 0) {
    console.log('Currently RED (pins the diagnosed bug; green after the approved fix):');
    for (const name of failures) console.log(`  - ${name}`);
  }
// TOTALS-OR-RED (Sam, 2026-08-03): the explicit exit is GONE, not moved.
// `process.exit(0)` hard-overrides `process.exitCode`, so it silently
// un-arms this suite — proven by a surviving mutation during the rollout.
// `totalsPrinted(...)` above already set the correct code from the report.
}

main().catch((error) => { console.error('SUITE THREW:', error); process.exit(1); });
