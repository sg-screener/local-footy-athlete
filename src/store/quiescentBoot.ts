/**
 * THE QUIESCENT BOOT — R1.3 of the shell rebuild
 * (`docs/SHELL_REBUILD_PLAN_2026-08-05.md`, approved 2026-08-05).
 *
 * Boot reads inputs and derives. There is no hydration migration, no accepted
 * revision mint, no envelope readback — those categories ceased to exist when
 * outputs stopped being stored. The derived world is rebuilt in memory:
 *
 *   1. generate the program from profile answers + the persisted phase clock
 *   2. replay the decision ledger through the SAME door interpreters that
 *      recorded it (under the replay latch — replay never appends)
 *
 * `quiescentBootTests` holds the laws: boot leaves every persisted key
 * byte-identical within a small write budget; the visible week survives a
 * relaunch by derivation; replay is idempotent; an old-shape envelope is
 * parked byte-identical for R2's migration before any new-shape write.
 * `wornWorldBootTests` holds the one they all missed: a program generated on
 * an EARLIER day, booted today, keeps its anchor and its week.
 *
 * R5.1 — THE SWITCHOVER (`docs/R5_DELETION_SEQUENCE_2026-08-06.md`). This
 * module also owns what happens after a decision LANDS, because it is the
 * same act: `settleDerivedWorldAfterDecision` is `rebuildDerivedWorld` under
 * the replay latch. Until R5.1 the doors published a materialised replan and
 * boot resolved instead, so the week after a tap was composed by a different
 * engine than the week after a relaunch — measured by `fixture-identity-3`
 * (three untouched days disagree) and `fact-door-inputs` cell 3 (an injured
 * week derives differently either side of a relaunch). Settling by
 * re-derivation makes the two engines one BY CONSTRUCTION: a landed decision
 * now produces the post-relaunch week, because it runs the post-relaunch
 * body. The replan engine keeps working and loses its authority; R5.2–R5.6
 * delete it.
 */

import { useProgramStore, PROGRAM_STORE_PERSISTENCE_KEY } from './programStore';
import { useProfileStore } from './profileStore';
import { useCalendarStore } from './calendarStore';
import {
  decisionLedgerEntries,
  beginLedgerReplay,
  endLedgerReplay,
  ledgerReplayActive,
} from './decisionLedgerStore';
import { asyncStorageCompat } from './asyncStorageCompat';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import { logger } from '../utils/logger';

// The parking key + old-shape detector live at the boundary that enforces
// them (programStore), because zustand's post-migration write-back can fire
// before this module ever runs; re-exported here for the boot suite.
export { PRE_REBUILD_ENVELOPE_PARKING_KEY } from './programStore';

export async function parkPreRebuildEnvelopeIfPresent(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { programEnvelopeIsOldShape, PRE_REBUILD_ENVELOPE_PARKING_KEY: parkingKey } =
    require('./programStore');
  try {
    const existing = await asyncStorageCompat.getItem(parkingKey);
    if (existing !== null) return; // parked once, forever — never overwritten
    const raw = await asyncStorageCompat.getItem(PROGRAM_STORE_PERSISTENCE_KEY);
    if (raw === null || !programEnvelopeIsOldShape(raw)) return;
    await asyncStorageCompat.setItem(parkingKey, raw);
  } catch (error) {
    // Parking is insurance for R2; a failed park must not block boot.
    logger.error('[quiescentBoot] failed to park the pre-rebuild envelope', { error });
  }
}

/**
 * The typed refusal when the persisted inputs carry no generation anchor.
 * `appHydrationGate` catches it, logs it, and publishes
 * `status: 'failed', failedStores: ['derived-world']` — the boot error screen
 * with its Try Again, which is a visible failure rather than a silent wrong
 * week (L-C1). A world that cannot say WHEN it was generated cannot be
 * derived, and inventing the day is the defect this replaced.
 */
export class MissingGenerationAnchorError extends Error {
  readonly code = 'missing_generation_anchor';

  constructor() {
    super(
      'The derived world cannot be rebuilt: the persisted inputs carry no '
      + 'generation anchor. The anchor is recorded at generation and read at '
      + 'boot; it is never guessed from today.',
    );
    this.name = 'MissingGenerationAnchorError';
  }
}

/** Monday of the week containing the given ISO date, local semantics. */
function mondayOf(dateISO: string): string {
  const parsed = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  const day = parsed.getDay();
  parsed.setDate(parsed.getDate() - ((day + 6) % 7));
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function replayDates(entry: DecisionLedgerEntry): string[] {
  const decision = entry.decision;
  switch (decision.kind) {
    case 'plan_change': {
      const change = decision.change as Record<string, unknown>;
      return [change.date, change.fromDate, change.toDate,
        ...(Array.isArray(change.dates) ? change.dates : [])]
        .filter((value): value is string => typeof value === 'string');
    }
    case 'fixture_add':
    case 'fixture_remove':
      return [decision.date];
    case 'fixture_move':
      return [decision.fromDate, decision.toDate];
    case 'migrated_day_placement':
      return [decision.date];
    case 'reversal':
      return [];
  }
}

/** Replay one landed decision through the door interpreter that recorded it. */
function replayEntry(entry: DecisionLedgerEntry): void {
  const occurredOn = entry.occurredAt.slice(0, 10);
  const decision = entry.decision;
  if (decision.kind === 'reversal') {
    // No reversal producer exists yet (undo door lands with LR-29's heir);
    // a reversal entry is declared, typed, and inert until then.
    return;
  }
  if (decision.kind === 'migrated_day_placement') {
    // R2: the old world's `dateOverrides`, replayed onto the surface they
    // came from. This is the one decision that carries CONTENT rather than
    // intent (see its note in types/decisionLedger.ts), so replay places the
    // workout back rather than re-running a producer there is no intent for.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { applyProgramOverrideWrite } = require('./programStore');
    applyProgramOverrideWrite({
      date: decision.date,
      workout: decision.workout,
      context: undefined,
      writer: 'program_control',
    });
    return;
  }
  // Lazy requires: the interpreters live in utils and import stores — the
  // same circular-import dodge the adapters use, with one home here.
  if (decision.kind === 'plan_change') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { applyPlanChange } = require('../utils/planChangeProducer');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveWeekWithConditioning } = require('../utils/sessionResolver');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildScheduleStateImperative } = require('../utils/coachWeekDiff');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { applyProgramOverrideWrite } = require('./programStore');
    const weeks = [...new Set(replayDates(entry).map(mondayOf))];
    const state = buildScheduleStateImperative();
    const visibleWeek = weeks.flatMap((week) => resolveWeekWithConditioning(week, state));
    const result = applyPlanChange({
      change: decision.change,
      visibleWeek,
      todayISO: occurredOn,
      route: 'quiescent_boot_replay',
      applyOverride: (date: string, workout: unknown, context: unknown) => {
        if (!workout) return;
        applyProgramOverrideWrite({ date, workout, context, writer: 'program_control' });
      },
    });
    if (!result.ok) {
      logger.warn('[quiescentBoot] a ledger decision no longer applies on replay', {
        entryId: entry.id, kind: decision.change.kind, outcome: result.outcome,
      });
    }
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { executeFixtureMutationInMemory } = require('./fixtureMutationTransaction');
  const revision = (useProgramStore.getState() as unknown as {
    acceptedMaterialContext: { revision: number };
  }).acceptedMaterialContext.revision;
  const action = decision.kind === 'fixture_add' ? 'add'
    : decision.kind === 'fixture_remove' ? 'remove' : 'move';
  const result = executeFixtureMutationInMemory({
    action,
    fixtureKind: decision.fixtureKind,
    ...(decision.kind === 'fixture_add' ? { targetDate: decision.date } : {}),
    ...(decision.kind === 'fixture_remove' ? { sourceDate: decision.date } : {}),
    ...(decision.kind === 'fixture_move'
      ? { sourceDate: decision.fromDate, targetDate: decision.toDate } : {}),
    expectedAcceptedRevision: revision,
    source: {
      requestedBy: 'athlete',
      producer: 'tap',
      surface: 'program_tab',
      commandId: `quiescent-boot-replay:${entry.id}`,
    },
    todayISO: occurredOn,
  });
  if (result.outcome === 'conflicted' || result.outcome === 'impossible') {
    logger.warn('[quiescentBoot] a fixture decision no longer applies on replay', {
      entryId: entry.id, kind: decision.kind, outcome: result.outcome,
    });
  }
}

/**
 * THE BOOT'S SUBSTANCE, one owner: park the old world for R2, then rebuild
 * the derived world. The hydration gate calls this once per process; the
 * quiescent-boot suite calls it once per simulated relaunch — same body,
 * no test-only path.
 */
export async function runQuiescentBoot(): Promise<void> {
  await parkPreRebuildEnvelopeIfPresent();
  await rebuildDerivedWorld();
}

/**
 * R5.1 — THE SWITCHOVER, one owner.
 *
 * A door that has just landed a decision settles by RE-DERIVING, never by
 * keeping the replan it built on the way. The week an athlete sees after a
 * tap is therefore the week they see after a relaunch, because it is built
 * by the same body.
 *
 * Replay calls the door interpreters directly and is already inside a
 * derivation, so settling is skipped under the latch — not as a guard on
 * intent, but because a derivation that re-entered itself would replay the
 * ledger against its own half-finished effects.
 */
export async function settleDerivedWorldAfterDecision(): Promise<void> {
  if (ledgerReplayActive()) return;
  await rebuildDerivedWorld();
}

/**
 * Rebuild the derived world from inputs. Idempotent; safe to call again.
 * Everything it builds lives in memory — persistence carries inputs only.
 */
export async function rebuildDerivedWorld(): Promise<void> {
  const profileState = useProfileStore.getState();
  if (!profileState.isOnboardingComplete) return;
  const profile = profileState.onboardingData;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { generateProgramLocally } = require('../services/api/generateProgram');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { commitRebuiltProgram } = require('../utils/weekRebuild');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { todayISOLocal } = require('../utils/appDate');
  const storeState = useProgramStore.getState() as unknown as {
    generationAnchorISO?: string | null;
    hydratedSeasonPhaseClock?: unknown;
  };
  // THE ANCHOR IS A DECISION (Sam, 2026-08-06), and boot READS it. There is
  // no `?? todayISOLocal()` here and there must never be one again: that was
  // not a fallback, it was the only branch that ever ran, and it re-anchored
  // every worn athlete's program to today and deleted the week they were in
  // (`wornWorldBootTests`). Re-anchoring to today is the clock-twin of "a
  // decision never rebases from a stored week" — a derivation quietly
  // authoring an input it was supposed to read. Absent anchor is a typed
  // REFUSAL, reported through the boot's own failure surface, never a guess.
  const generationISO = storeState.generationAnchorISO;
  if (!generationISO) {
    throw new MissingGenerationAnchorError();
  }
  const clock = storeState.hydratedSeasonPhaseClock ?? undefined;
  beginLedgerReplay();
  try {
    // A CLEAN SLATE first: after a real process death the derived surfaces
    // are empty; an in-process rebuild must start from the same emptiness or
    // replaying the ledger meets its own earlier effects (and the accepted
    // ledger equivalence rightly refuses). Idempotence lives here.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createEmptyReversibleAdjustmentLedger } = require('../rules/reversibleAdjustmentLedger');
    useProgramStore.setState({
      currentProgram: null,
      currentMicrocycle: null,
      todayWorkout: null,
      blockState: null,
      dateOverrides: {},
      overrideContexts: {},
      weekScopedOverlays: {},
      userRemovalConstraints: [],
      exposureContractsByWeek: {},
      reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
      acceptedMaterialContext: {
        ...(useProgramStore.getState() as unknown as {
          acceptedMaterialContext: Record<string, unknown>;
        }).acceptedMaterialContext,
        markedDays: {},
        activeConstraints: [],
        activeInjury: null,
        readinessSignalsByDate: {},
        revision: 0,
        lastTransaction: null,
        acceptedCompositionBase: null,
        acceptedProfileSnapshot: null,
      },
    } as never);
    const program = generateProgramLocally(profile, {
      // A boot replays; it decides nothing (plan §2, "boot appends nothing").
      weekAcceptance: 'restoration',
      todayISO: generationISO,
      previousProgram: null,
      ...(clock ? { seasonPhaseClock: clock } : {}),
    });
    commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
      markedDays: useCalendarStore.getState().markedDays ?? {},
      // TODAY, not the anchor: generation is anchored to the recorded input,
      // but the accepted rebase and the selected microcycle follow the
      // athlete's current day — the same week they are about to look at.
      selectedDate: todayISOLocal(),
      reason: 'quiescent_boot',
    });
    for (const entry of decisionLedgerEntries()) {
      try {
        replayEntry(entry);
      } catch (error) {
        logger.warn('[quiescentBoot] replay threw for a ledger entry', {
          entryId: entry.id, error,
        });
      }
    }
  } finally {
    endLedgerReplay();
  }
}
