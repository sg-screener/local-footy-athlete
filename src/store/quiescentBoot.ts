/**
 * THE QUIESCENT BOOT — R1.3 of the shell rebuild
 * (`docs/SHELL_REBUILD_PLAN_2026-08-05.md`, approved 2026-08-05).
 *
 * Boot reads inputs and derives. There is no hydration migration, no accepted
 * revision mint, no envelope readback — those categories ceased to exist when
 * outputs stopped being stored. The derived world is rebuilt in memory:
 *
 *   1. generate the program from profile answers + the persisted phase clock
 *   2. fold accepted exercise edits through their pure weekly compiler and
 *      replay the remaining decisions through their owning interpreters
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

import {
  useProgramStore,
  PROGRAM_STORE_PERSISTENCE_KEY,
  generationAnchorForProgram,
  statedProgressionInputs,
  projectProgramPersistedInputs,
} from './programStore';
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
import type { CanonicalAcceptedSessionEditEffect } from '../rules/canonicalWeeklySessionEditState';
import type { CanonicalAcceptedFixtureEditEffect } from '../rules/canonicalWeeklyFixtureEditState';
import type { CanonicalAcceptedDayPlacementEffect } from '../rules/canonicalDayPlacementEffect';
import {
  bootReplayableEntries,
  unreadableEntryCount,
} from '../rules/decisionLedgerReplay';
import {
  isLegacyMigratedDayPlacementEntry,
  liftLegacyMigratedDayPlacementEntry,
} from '../rules/legacyMigratedDayPlacementIngress';
import { recoverGenerationAnchor } from '../rules/generationAnchorRecovery';
import { storedGameAnchor } from '../rules/gameAnchor';
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
  if (isLegacyMigratedDayPlacementEntry(entry)) {
    return [liftLegacyMigratedDayPlacementEntry(entry).dateISO];
  }
  const decision = entry.decision;
  switch (decision.kind) {
    case 'lighter_day':
      return [decision.acceptedEffect.dateISO];
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
    case 'program_control': {
      const payload = (decision.action as { payload?: Record<string, unknown> }).payload ?? {};
      return [payload.date, payload.fromDate, payload.toDate]
        .filter((value): value is string => typeof value === 'string');
    }
    case 'reversal':
    case 'legacy_plan_change_effect_upgrade':
    case 'legacy_fixture_effect_upgrade':
    case 'legacy_day_placement_effect_upgrade':
      return [];
    case 'block_boundary_notice_acknowledged':
    case 'weekly_commitment_answer':
      // NO DATE COORDINATE, BECAUSE IT IS NOT A DAY-SCOPED EDIT. The answer's
      // whole effect is the canonical commitment fact on the PROFILE, which is
      // persisted in its own store and rebuilt from at boot like every other
      // profile answer. Replaying it here would re-apply a profile change that
      // is already applied.
      return [];
  }
}

/** Replay one landed non-exercise decision through its remaining interpreter. */
function replayEntry(entry: DecisionLedgerEntry,
  facts: import('../rules/temporarySourceFact').TemporarySourceFact[]): void {
  const decision = entry.decision;
  if (decision.kind === 'lighter_day') {
    const { commitCanonicalAcceptedLighterDayEffect } = require('../utils/lighterDayTransaction');
    commitCanonicalAcceptedLighterDayEffect(decision.acceptedEffect, facts);
    return;
  }
  if (decision.kind === 'reversal') {
    // UNREACHABLE BY CONSTRUCTION, and kept as the exhaustiveness arm.
    // `bootReplayableEntries` drops reversals before this function is called — a
    // reversal is not an action, it is a statement about one, and its whole
    // effect is the ENTRY IT REMOVES from the replay set. Deleting this arm
    // would make the switch non-exhaustive; making it throw would turn a
    // filter regression into a bricked boot.
    return;
  }
  if (decision.kind === 'block_boundary_notice_acknowledged') {
    // NOTHING TO REPLAY. Dismissing a notice is not an edit — it stops a card
    // being drawn, and the card's own derivation reads this entry back off the
    // ledger. Replaying it would have nothing to apply.
    return;
  }
  if (decision.kind === 'weekly_commitment_answer') {
    // NOTHING TO REPLAY, AND THAT IS NOT AN OMISSION.
    // A confirmation's effect is the commitment fact on the profile; the
    // profile store persists it and boot builds from it. Re-running anything
    // here would be a SECOND application of a change that is already durable —
    // and for a `declined` answer there was never an effect at all, only a
    // record that the question was put and answered.
    return;
  }
  // Session edits never enter this interpreter. Their exact accepted effects
  // are folded by `compileSessionDecisionGroup` below.
  if (decision.kind === 'plan_change') return;
  // Fixture edits are accepted effects too; their compiler group owns them.
  if (decision.kind === 'fixture_add' || decision.kind === 'fixture_remove' ||
    decision.kind === 'fixture_move') return;
}

/**
 * Exercise actions are accepted facts at boot, not fresh requests. Translate
 * each contiguous ledger group once, fold it over the authored (unfiltered)
 * week, then publish only the material Swap/Add dates. Remove remains the
 * exclusion projection so Restore can reveal the original authored row.
 */
function compileExerciseDecisionGroup(entries: readonly DecisionLedgerEntry[]): void {
  if (entries.length === 0) return;
  // Lazy imports keep the store/rules boundary from closing the generation
  // cycle while still making this one explicit compiler handoff.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { canonicalWeeklyExerciseEditStateFrom } =
    require('../rules/canonicalWeeklyExerciseEditState');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { compileCanonicalWeeklyExerciseEdits } =
    require('../rules/canonicalWeeklyExerciseEditCompiler');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { resolveWeekWithConditioning } = require('../utils/sessionResolver');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildScheduleStateImperative } = require('../utils/coachWeekDiff');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { applyProgramOverrideWrite } = require('./programStore');

  const weeks = [...new Set(entries.flatMap(replayDates).map(mondayOf))];
  for (const weekStartISO of weeks) {
    const state = canonicalWeeklyExerciseEditStateFrom({ weekStartISO, entries });
    if (state.edits.length === 0) continue;
    const authoredState = { ...buildScheduleStateImperative(), athleteExclusions: [] };
    const days = resolveWeekWithConditioning(weekStartISO, authoredState);
    const workouts = days.flatMap((day: { workout?: unknown }) =>
      day.workout ? [day.workout] : []);
    const compiled = compileCanonicalWeeklyExerciseEdits({ workouts, state });
    for (const date of compiled.materialDates) {
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
      const workout = compiled.workouts.find((candidate: { dayOfWeek: number }) =>
        candidate.dayOfWeek === dayOfWeek);
      if (!workout) continue;
      applyProgramOverrideWrite({
        date,
        workout,
        context: compiled.overrideContextsByDate[date],
        writer: 'program_control',
      });
    }
  }
}

/** Fold accepted whole-session edit effects without asking the live door again. */
function compileSessionDecisionGroup(
  entries: readonly DecisionLedgerEntry[],
  completeLedger: readonly DecisionLedgerEntry[],
): Array<{ sourceEntryId: string; acceptedEffect: CanonicalAcceptedSessionEditEffect }> {
  if (entries.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { canonicalWeeklySessionEditStateFrom } =
    require('../rules/canonicalWeeklySessionEditState');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { commitCanonicalAcceptedSessionEditEffect } =
    require('./acceptedStateTransaction');
  const upgradeRows = completeLedger.filter((entry) =>
    entry.decision.kind === 'legacy_plan_change_effect_upgrade');
  const upgrades: Array<{
    sourceEntryId: string;
    acceptedEffect: CanonicalAcceptedSessionEditEffect;
  }> = [];
  for (const entry of entries) {
    const state = canonicalWeeklySessionEditStateFrom({
      entries: [entry, ...upgradeRows],
      weekStartISO: null,
    });
    const effect = state.effects[0];
    if (effect) {
      commitCanonicalAcceptedSessionEditEffect(effect);
      continue;
    }
    // One compatibility boundary for a row written before accepted effects
    // existed. It runs once; the appended upgrade makes later boots canonical.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { replayLegacyPlanChangeEntryToEffect } =
      require('./legacyPlanChangeEffectMigration');
    upgrades.push({
      sourceEntryId: entry.id,
      acceptedEffect: replayLegacyPlanChangeEntryToEffect(entry),
    });
  }
  return upgrades;
}

/** Fold accepted fixture effects without re-entering request validation. */
function compileFixtureDecisionGroup(
  entries: readonly DecisionLedgerEntry[],
  completeLedger: readonly DecisionLedgerEntry[],
): Array<{ sourceEntryId: string; acceptedEffect: CanonicalAcceptedFixtureEditEffect }> {
  if (entries.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { canonicalWeeklyFixtureEditStateFrom } =
    require('../rules/canonicalWeeklyFixtureEditState');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { commitCanonicalAcceptedFixtureEditEffect } =
    require('./acceptedStateTransaction');
  const upgradeRows = completeLedger.filter((entry) =>
    entry.decision.kind === 'legacy_fixture_effect_upgrade');
  const upgrades: Array<{
    sourceEntryId: string;
    acceptedEffect: CanonicalAcceptedFixtureEditEffect;
  }> = [];
  for (const entry of entries) {
    const state = canonicalWeeklyFixtureEditStateFrom({
      entries: [entry, ...upgradeRows],
      weekStartISO: null,
    });
    const effect = state.effects[0];
    if (effect) {
      commitCanonicalAcceptedFixtureEditEffect(effect);
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { replayLegacyFixtureEntryToEffect } =
      require('./legacyFixtureEffectMigration');
    const acceptedEffect = replayLegacyFixtureEntryToEffect(entry);
    commitCanonicalAcceptedFixtureEditEffect(acceptedEffect);
    upgrades.push({ sourceEntryId: entry.id, acceptedEffect });
  }
  return upgrades;
}

/** Lift one retired content row, then publish only its current typed effect. */
function compileLegacyDayPlacementEntry(
  entry: DecisionLedgerEntry,
  completeLedger: readonly DecisionLedgerEntry[],
): { sourceEntryId: string; acceptedEffect: CanonicalAcceptedDayPlacementEffect } | null {
  if (!isLegacyMigratedDayPlacementEntry(entry)) return null;
  const upgrade = completeLedger.find((candidate) =>
    candidate.decision.kind === 'legacy_day_placement_effect_upgrade' &&
    candidate.decision.sourceEntryId === entry.id);
  const effect = upgrade?.decision.kind === 'legacy_day_placement_effect_upgrade'
    ? upgrade.decision.acceptedEffect
    : liftLegacyMigratedDayPlacementEntry(entry);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { commitCanonicalAcceptedDayPlacementEffect } =
    require('./acceptedStateTransaction');
  commitCanonicalAcceptedDayPlacementEffect(effect);
  return upgrade ? null : { sourceEntryId: entry.id, acceptedEffect: effect };
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
 * The boot fold and remaining replay interpreters are already inside a
 * derivation, so settling is skipped under the latch — not as a guard on
 * intent, but because a derivation that re-entered itself would consume the
 * ledger against its own half-finished effects.
 */
export async function settleDerivedWorldAfterDecision(): Promise<void> {
  if (ledgerReplayActive()) return;
  // A SETTLE IS AN ATHLETE ACTION'S LAST PUBLICATION STEP, NOT A BOOT.
  //
  // Measured on Sam's device 2026-08-24: reporting an injury could leave the
  // whole program missing and My Status showing no injury. The injury fact had
  // already committed successfully; then `rebuildDerivedWorldNow` took its
  // deliberate clean slate (currentProgram=null, activeConstraints=[]), and a
  // later generation/acceptance failure escaped with that half-built world
  // still live. The next screen therefore saw neither the old program nor the
  // newly accepted injury projection.
  //
  // The existing accepted-state transaction already owns exact memory,
  // mirror, durable-envelope and visible-projection rollback. Use that owner
  // for the ENTIRE settle instead of adding an injury-specific rescue. The
  // pre-state captured here already contains the accepted injury and the safe
  // live recomposition, so a failed re-derivation degrades to that complete
  // world rather than to an empty program.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runCoachMutationTransaction } = require('./coachMutationTransaction');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { todayISOLocal } = require('../utils/appDate');
  const outcome = await runCoachMutationTransaction({
    todayISO: todayISOLocal(),
    allowAcceptedStateOnlyChange: true,
    allowIdempotentNoop: true,
    mutate: () => {
      rebuildDerivedWorldNow();
      return true;
    },
    didApply: (applied: boolean) => applied,
  });
  if (!outcome.ok) {
    logger.error('[quiescentBoot] post-decision settle failed; complete accepted world restored', {
      route: outcome.route,
      reason: outcome.reason,
    });
  }
}

/**
 * THE FIXTURE MARKS ARE THE LEDGER'S, NOT THE DISK'S (ruled 2026-08-06,
 * `docs/FIXTURE_BOOT_ORDER_RULING_2026-08-06.md`).
 *
 * A fixture reached the calendar as a DECISION, and the decision ledger owns
 * it. `markedDays` is that decision's projection. Boot used to rehydrate the
 * projection from disk BEFORE replaying the ledger, so the replayed decision
 * found its own effect already present and refused as `no_change`
 * (`resolveFixtureMutation`, "The requested fixture is already present") — a
 * second representation pre-empting its owner, in boot ORDER rather than in a
 * writer. The week the fixture implies was then never composed, and the
 * athlete re-opened the app holding a different week (`945e0cb4` measured the
 * whole chain, two-directionally).
 *
 * So boot drops the fixture marks and re-derives them:
 *
 *   - `game` / `noGame` are fixture marks. They are DROPPED here and put back
 *     by the ledger replay that follows, which is the only fixture input.
 *   - the RECURRING fixture is a profile ANSWER, not a decision — nothing in
 *     the ledger records it — so it is re-derived from `gameDay` through the
 *     same pure function onboarding seeds it with. This is a derivation of a
 *     persisted input, not a restoration of a stored consequence, which is why
 *     it is not the rejected option (b): generation is not fed by it.
 *   - `rest` marks are NOT fixture marks and are left untouched. They are
 *     carried by their own doors and are out of this ruling's scope; declared,
 *     not silently widened.
 *
 * The empty write is legitimate here and is exactly what the calendar door
 * refuses by default, so boot opens a reset act for it — the mechanism that
 * already exists for "an act is in flight that may legitimately empty this".
 */
function deriveBootFixtureMarks(
  // The ANSWER this needs, not the mirror it happens to arrive on — a
  // `ReturnType<typeof useProfileStore.getState>['onboardingData']` annotation
  // here reads as a 72nd profile-mirror consumer to LR-4's detector, and this
  // function consumes exactly one field.
  //
  // IT TAKES BOTH ANCHOR FIELDS NOW, AND THAT IS A FIX (2026-08-12,
  // `HOW_TO_BUILD_THIS_APP` §5 item 2). It read `gameDay` ALONE, and `gameDay`
  // used to be narrowed to Fri/Sat/Sun on the way into storage — so an athlete
  // who told the phase sheet "Wednesday" had `usualGameDay: 'Wednesday'` and
  // `gameDay: 'Varies'`. This function wiped every game mark on the line above
  // and then re-seeded NOTHING, so their fixtures disappeared on relaunch. The
  // narrowing is gone and both fields are read through the one owner.
  profile: { gameDay?: string; usualGameDay?: string } | null,
  program: { startDate?: string; endDate?: string },
): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { computeGameDatesForBlock } = require('../utils/sessionResolver');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    applyCalendarMarkedDaysWrite,
    beginCalendarResetAction,
    endCalendarResetAction,
  } = require('./calendarStore');
  const current = useCalendarStore.getState().markedDays ?? {};
  const next: Record<string, import('./calendarStore').CalendarDayType> = {};
  for (const [date, mark] of Object.entries(current)) {
    if (mark !== 'game' && mark !== 'noGame') next[date] = mark;
  }
  const gameDay = storedGameAnchor(profile);
  if (gameDay && program.startDate && program.endDate) {
    for (const date of computeGameDatesForBlock(
      gameDay, program.startDate, program.endDate,
    ) as string[]) {
      next[date] = 'game';
    }
  }
  const resetActionId = beginCalendarResetAction('quiescent_boot');
  try {
    applyCalendarMarkedDaysWrite({ next, writer: 'quiescent_boot', resetActionId });
  } finally {
    endCalendarResetAction(resetActionId);
  }
}

/**
 * Rebuild the derived world from inputs. Idempotent; safe to call again.
 * Everything it builds lives in memory — persistence carries inputs only.
 */
export async function rebuildDerivedWorld(): Promise<void> {
  rebuildDerivedWorldNow();
}

/**
 * Synchronous body so the post-decision transaction can include every write
 * in its rollback boundary. `async () => rebuildDerivedWorld()` would hand the
 * transaction a Promise and let verification run before a future asynchronous
 * body; this function makes the mutation boundary structural.
 */
export function rebuildDerivedWorldNow(): void {
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
  // A LEGACY WORLD IS ASKED WHAT IT REMEMBERS BEFORE IT IS REFUSED
  // (2026-08-09, after a real device could not open).
  //
  // The refusal below is CORRECT and stays: `?? todayISOLocal()` was not a
  // fallback, it was the only branch that ever ran, and it deleted the week
  // worn athletes were standing in. Nothing here consults the device clock.
  //
  // But a world built across pre-2026-08-06 eras never stored an anchor at all
  // — "the anchor rides the program it anchors", and a program generated before
  // that ruling carries no such field — so the refusal was permanent and the
  // athlete's app could never open again. `recoverGenerationAnchor` reads what
  // the world itself testifies to (its own earliest week, or its oldest
  // decision) and refuses only a world that testifies to nothing. Same move as
  // `preRebuildEnvelopeMigration`: read the result the old world stored rather
  // than invent the intent it never recorded.
  //
  // AND THE READ ASKS THE ANCHOR'S OWN HOME, NOT ONLY ITS MIRROR (2026-08-10,
  // found by the first working run-through since 18 July). "The anchor rides
  // the program it anchors" is the ruling; `state.generationAnchorISO` is a
  // MIRROR that the install door stamps off the program
  // (`generationAnchorForProgram`, programStore.ts). Reading only the mirror
  // meant any install path that did not stamp it — the dev-E2E seed installs
  // through `commitAcceptedStateTransaction` directly — produced a world that
  // boot classified as a LEGACY WORLD UNDER REPAIR and shouted about, on every
  // single launch, while its anchor sat in the one place the ruling says it
  // lives. `recoverGenerationAnchor` then answered with evidence
  // `stored_anchor`, whose own doc comment reads "not a recovery at all".
  //
  // Asking the home before declaring a repair is why the shout below is now
  // only ever a real repair. This is a read moving to where the value lives,
  // not a guard added over a false alarm — the false alarm had no other cause.
  let generationISO = storeState.generationAnchorISO
    ?? generationAnchorForProgram(useProgramStore.getState().currentProgram);
  if (!generationISO) {
    const recovered = recoverGenerationAnchor({
      storedAnchorISO: storeState.generationAnchorISO,
      program: useProgramStore.getState().currentProgram as never,
      ledger: decisionLedgerEntries(),
    });
    if (recovered) {
      generationISO = recovered.anchorISO;
      // REPORTED, NEVER SILENT. A recovered anchor is a world being repaired,
      // and a repair nobody can see is indistinguishable from a world that was
      // always fine.
      logger.error('[quiescentBoot] generation anchor RECOVERED from the world itself', {
        anchorISO: recovered.anchorISO, evidence: recovered.evidence,
      });
      // NOTHING IS WRITTEN HERE, deliberately. The recovery is DERIVED from
      // the world's own program, so it is the same answer on every boot — and
      // the rebuild below stamps the anchor onto the program it commits
      // (`weekRebuild.ts:800`), so the world heals itself without this door
      // reaching around the store's write owner. No new stored state; the
      // store-armour law is not bent for a repair.
    }
  }
  if (!generationISO) {
    throw new MissingGenerationAnchorError();
  }
  // The same accepted clock projection used by persistence: a live decision
  // has a new program clock; only cold hydration needs the restored fallback.
  const clock = projectProgramPersistedInputs(useProgramStore.getState()).seasonPhaseClock ?? undefined;

  // ⚠ CAPTURED BEFORE THE CLEAN SLATE, AND THAT POSITION IS THE WHOLE FIX.
  //
  // **MEASURED (`test:block-two-boot-preservation`).** Boot regenerated with no
  // `blockNumber` and no `progressionHistory`, so it authored a fresh BLOCK ONE
  // against an explicitly empty history. An athlete holding 100 kg on their own
  // recorded Deadlift came back at 75 — a first-block anchor estimate — their
  // restored accessory row vanished entirely, the very-hard volume reduction was
  // undone, and the stored explanation went with it. **The whole block-boundary
  // layer survived only while the app stayed open.**
  //
  // ⚠ **READING THEM AFTER THE CLEAN SLATE WOULD NOT HAVE WORKED, AND A FIRST
  // ATTEMPT DID EXACTLY THAT.** The slate below sets `blockState: null` — so a
  // read placed with the `generateProgramLocally` call returns the value boot
  // itself just erased, and the fix silently does nothing. `sessionFeedback` and
  // `weightOverrides` are not in the slate and survive it; `blockState` is not.
  //
  // This is the shape `utils/weekRebuild.ts` already uses at the rollover: the
  // caller that owns the grid STATES the inputs. Boot still decides nothing — it
  // hands generation the same recorded facts the rollover handed it, so the same
  // inputs author the same block on both paths.
  const bootProgressionInputs = (() => {
    /**
     * WHICH BLOCK THE ATHLETE IS IN — RESTORED, NEVER INFERRED (Sam, 2026-08-18).
     *
     * *"Once Block 2 is accepted, restart must never infer or reset them to
     * Block 1."*
     *
     * ⚠ **THE FOUR FIELDS AND THE `blockState ?? currentAcceptedBlock` LADDER
     * MOVED TO `statedProgressionInputs` (`programStore`) ON 2026-08-20 AND
     * NOTHING ABOUT WHAT BOOT STATES CHANGED.** They were written out here, and
     * two other regenerating doors then shipped without them — the settings
     * transaction stating none of the four, the dated-fact transaction stating
     * the block's coordinates but not its history. A list written by hand is a
     * list the next door forgets, which is the same lesson
     * `projectProgramPersistedInputs` learned about the PERSISTED field list.
     * Read that function's header for the measured cost of both silences.
     *
     * **THE CAPTURE POINT IS STILL BOOT'S OWN AND IS STILL LOAD-BEARING** — see
     * the note above: the slate below sets `blockState: null`, so a read placed
     * with the `generateProgramLocally` call returns the value boot itself just
     * erased and the fix silently does nothing. The projection takes the state as
     * an ARGUMENT precisely so this caller keeps choosing the moment.
     */
    return {
      // WHAT EACH ACCEPTED BLOCK REQUIRED (Sam, 2026-08-17) — the completion
      // denominator, and the reason it is a stored input rather than a read-time
      // count. THIS caller regenerates with `previousProgram: null`, so nothing
      // here can count the block that just ended; it can only READ what
      // acceptance recorded. Same map the rollover states, so a relaunch and a
      // rollover reach the identical value, which is what stops a raised load
      // being un-raised on the next launch.
      //
      // ⚠ CAPTURED WITH THE OTHERS, BEFORE THE CLEAN SLATE, for the same reason
      // `blockState` is: a read placed with the `generateProgramLocally` call
      // below would answer from state this function has already emptied.
      ...statedProgressionInputs(useProgramStore.getState()),
    };
  })();
  const sourceFacts = useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts;
  const { sourceFactRequiresCompilation } = require('../rules/canonicalWeeklySourceFactCompiler');
  const { composeTemporarySourceFactCompatibility } = require('../rules/temporarySourceFact');
  const baseFacts = sourceFacts.filter(fact => !sourceFactRequiresCompilation(fact));
  const baseFactCompatibility = composeTemporarySourceFactCompatibility({ temporarySourceFacts: baseFacts });

  const legacySessionEffectUpgrades: Array<{
    sourceEntryId: string;
    acceptedEffect: CanonicalAcceptedSessionEditEffect;
  }> = [];
  const legacyFixtureEffectUpgrades: Array<{
    sourceEntryId: string;
    acceptedEffect: CanonicalAcceptedFixtureEditEffect;
  }> = [];
  const legacyDayPlacementEffectUpgrades: Array<{
    sourceEntryId: string;
    acceptedEffect: CanonicalAcceptedDayPlacementEffect;
  }> = [];
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
        readinessSignalsByDate: {},
        revision: 0,
        lastTransaction: null,
        acceptedCompositionBase: null,
        acceptedProfileSnapshot: null,
        temporarySourceFacts: [],
        injuryEpisodes: [],
      },
    } as never);
    const program = generateProgramLocally(profile, {
      // A BOOT REPLAYS; IT DECIDES NOTHING. It may record a block nobody has
      // recorded yet, and it may never re-author one. Passing the old `true`
      // here re-recorded the block under whatever exclusions were live at
      // launch, which laundered a reversible `today_only` removal into a
      // permanent generation input and destroyed the athlete's main lift.
      recordSelections: 'replay',
      // A boot replays; it decides nothing (plan §2, "boot appends nothing").
      weekAcceptance: 'restoration',
      temporarySourceFacts: baseFacts,
      activeConstraints: baseFactCompatibility.activeConstraints,
      readinessSignal: null,
      todayISO: generationISO,
      previousProgram: null,
      ...(clock ? { seasonPhaseClock: clock } : {}),
      // ABSENT BLOCK STATE MEANS BLOCK 1 — the pre-existing default, and the
      // truthful answer for an athlete who has not crossed a boundary yet.
      ...(bootProgressionInputs.blockState
        ? { blockNumber: bootProgressionInputs.blockState.blockNumber }
        : {}),
      progressionHistory: bootProgressionInputs,
    });
    deriveBootFixtureMarks(profile, program);
    commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
      // One captured input for generation AND acceptance. Re-reading the
      // downstream ProfileStore mirror here created a cold-reload race in
      // which the accepted snapshot (and then disk) became an empty profile
      // even though this exact complete profile generated the program above.
      profile,
      markedDays: useCalendarStore.getState().markedDays ?? {},
      // TODAY, not the anchor: generation is anchored to the recorded input,
      // but the accepted rebase and the selected microcycle follow the
      // athlete's current day — the same week they are about to look at.
      selectedDate: todayISOLocal(),
      reason: 'quiescent_boot',
    });
    // Fixture/session replay must see the healthy base, not an injury whose
    // dated effect has not been compiled yet. Lighter-day decisions receive
    // their fact lookup explicitly rather than publishing future constraints.
    useProgramStore.setState({ acceptedMaterialContext: {
      ...useProgramStore.getState().acceptedMaterialContext,
      ...baseFactCompatibility,
      temporarySourceFacts: baseFacts,
    } });
    // THE UNDO IS HONOURED HERE, AND ONLY HERE. An annulled decision is not
    // replayed, so the world the boot builds is the world the remaining
    // decisions imply — which is the same body that answered the athlete the
    // moment they tapped undo (`settleDerivedWorldAfterDecision`).
    //
    // ── THE REPLAY PHASE CANNOT KILL THE BOOT (2026-08-09, after a device
    // ── failed to open on real accumulated data) ──────────────────────────
    //
    // The base world above is already committed by the time we get here, so a
    // replay that cannot finish costs the athlete ONE decision's effect. A
    // replay that THROWS used to cost them the whole app: the boot error
    // screen, on data this app itself wrote.
    //
    // The per-entry catch below is older and narrower — it never covered the
    // computation of the replay SET, which is where the throw came from. This
    // outer catch covers the phase rather than a kind, which is the difference
    // between armour and a patch: whatever a future decision kind, a future
    // filter or a corrupt persisted row does, it degrades the world by one
    // decision instead of closing the door.
    //
    // A FAILURE TO BUILD THE BASE WORLD IS DELIBERATELY *NOT* CAUGHT. There is
    // nothing to degrade to — an athlete with no program is not better served
    // by a blank app than by the error screen and its Try Again. The scope is
    // the claim: replay is recoverable, generation is not.
    try {
      const entries = decisionLedgerEntries();
      const unreadable = unreadableEntryCount(entries);
      if (unreadable > 0) {
        logger.error('[quiescentBoot] persisted ledger rows could not be read', {
          unreadable, total: entries.length,
        });
      }
      let exerciseGroup: DecisionLedgerEntry[] = [];
      let sessionGroup: DecisionLedgerEntry[] = [];
      let fixtureGroup: DecisionLedgerEntry[] = [];
      const flushExerciseGroup = () => {
        if (exerciseGroup.length === 0) return;
        const group = exerciseGroup;
        exerciseGroup = [];
        try {
          compileExerciseDecisionGroup(group);
        } catch (error) {
          logger.warn('[quiescentBoot] exercise-edit compiler fold failed', {
            entryIds: group.map((candidate) => candidate.id), error,
          });
        }
      };
      const flushSessionGroup = () => {
        if (sessionGroup.length === 0) return;
        const group = sessionGroup;
        sessionGroup = [];
        try {
          legacySessionEffectUpgrades.push(...compileSessionDecisionGroup(group, entries));
        } catch (error) {
          logger.warn('[quiescentBoot] session-edit compiler fold failed', {
            entryIds: group.map((candidate) => candidate.id), error,
          });
        }
      };
      const flushFixtureGroup = () => {
        if (fixtureGroup.length === 0) return;
        const group = fixtureGroup;
        fixtureGroup = [];
        try {
          legacyFixtureEffectUpgrades.push(...compileFixtureDecisionGroup(group, entries));
        } catch (error) {
          logger.warn('[quiescentBoot] fixture-edit compiler fold failed', {
            entryIds: group.map((candidate) => candidate.id), error,
          });
        }
      };
      for (const entry of bootReplayableEntries(entries)) {
        if (entry.decision.kind === 'program_control') {
          flushSessionGroup();
          flushFixtureGroup();
          exerciseGroup.push(entry);
          continue;
        }
        if (entry.decision.kind === 'plan_change') {
          flushExerciseGroup();
          flushFixtureGroup();
          sessionGroup.push(entry);
          continue;
        }
        if (entry.decision.kind === 'fixture_add' ||
          entry.decision.kind === 'fixture_move' ||
          entry.decision.kind === 'fixture_remove') {
          flushExerciseGroup();
          flushSessionGroup();
          fixtureGroup.push(entry);
          continue;
        }
        if (isLegacyMigratedDayPlacementEntry(entry)) {
          flushExerciseGroup();
          flushSessionGroup();
          flushFixtureGroup();
          try {
            const upgrade = compileLegacyDayPlacementEntry(entry, entries);
            if (upgrade) legacyDayPlacementEffectUpgrades.push(upgrade);
          } catch (error) {
            logger.warn('[quiescentBoot] legacy day-placement ingress failed', {
              entryId: entry.id, error,
            });
          }
          continue;
        }
        flushExerciseGroup();
        flushSessionGroup();
        flushFixtureGroup();
        try {
          replayEntry(entry, sourceFacts);
        } catch (error) {
          logger.warn('[quiescentBoot] replay threw for a ledger entry', {
            entryId: entry.id, error,
          });
        }
      }
      flushExerciseGroup();
      flushSessionGroup();
      flushFixtureGroup();
    } catch (error) {
      logger.error('[quiescentBoot] the replay phase failed; the base world stands', {
        error,
      });
    }
    // Fact compilation is outside the legacy replay's best-effort boundary.
    // A fact cannot silently disappear on error: live transactions roll back;
    // boot reports failure and retains the persisted inputs for retry.
    const { compileAcceptedSourceFacts } = require('./sourceFactCompilation');
    compileAcceptedSourceFacts(sourceFacts);
  } finally {
    endLedgerReplay();
    if (legacySessionEffectUpgrades.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { appendLegacyPlanChangeEffectUpgrade } = require('./decisionLedgerStore');
      for (const upgrade of legacySessionEffectUpgrades) {
        appendLegacyPlanChangeEffectUpgrade(upgrade);
      }
    }
    if (legacyFixtureEffectUpgrades.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { appendLegacyFixtureEffectUpgrade } = require('./decisionLedgerStore');
      for (const upgrade of legacyFixtureEffectUpgrades) {
        appendLegacyFixtureEffectUpgrade(upgrade);
      }
    }
    if (legacyDayPlacementEffectUpgrades.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { appendLegacyDayPlacementEffectUpgrade } = require('./decisionLedgerStore');
      for (const upgrade of legacyDayPlacementEffectUpgrades) {
        appendLegacyDayPlacementEffectUpgrade(upgrade);
      }
    }
  }
}
