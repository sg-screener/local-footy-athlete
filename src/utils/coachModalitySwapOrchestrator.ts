/**
 * coachModalitySwapOrchestrator.ts — Phase 3 entry-point used by
 * CoachScreen's mutation gate.
 *
 * Inputs (all explicit, store reads via injected deps):
 *   • userMessage           — the athlete's typed turn
 *   • referenceResolution   — Phase 2 resolver output (target date)
 *   • todayISO              — engine clock
 *
 * Steps:
 *   1. Parse the user message for a from/to modality.
 *   2. Resolve the target day via referenceResolution.
 *   3. Build a swap_conditioning_modality event.
 *   4. Apply the event through the same applyAdjustmentEvents pipeline
 *      that injuries / program adjustments use.
 *   5. Re-read the visible projection and verify the target session
 *      now contains the requested modality and no longer contains the
 *      old one.
 *   6. Compose a reply ONLY when verification passes; otherwise reply
 *      honestly that the change couldn't be applied.
 *
 * Pure side-effect surface: writes a single setManualOverride entry.
 */

import { applyAdjustmentEvents } from './applyAdjustmentEvents';
import { buildScheduleStateImperative } from './coachWeekDiff';
import {
  buildProgramTabProjectedWeek,
  buildDayWorkoutProjectedDay,
} from './visibleProgramReadModel';
import { useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import {
  useCoachPreferencesStore,
  canonicalSessionKey,
} from '../store/coachPreferencesStore';
import {
  parseModalitySwapRequest,
  buildSwapConditioningModalityEvent,
  dayHasModality,
  applyModalityPreferenceToWorkout,
} from './coachModalitySwap';
import type { ConditioningModality } from '../data/exerciseTags';
import type { CoachReferenceResolution } from './coachReferenceResolver';
import { logger } from './logger';

export type ModalitySwapOutcomeKind =
  | 'applied'
  | 'applied_preference'
  | 'unparseable'
  | 'no_target'
  | 'ambiguous'
  | 'no_match'
  | 'verification_failed'
  | 'engine_rejected';

export interface ModalitySwapOutcome {
  kind: ModalitySwapOutcomeKind;
  reply: string;
  /** True only when the override actually landed AND the projection verified. */
  applied: boolean;
  /** Categorical label used by the dev debug overlay + logs. */
  route: string;
  /** Mirrors the resolution status so the debug block is one-stop. */
  referenceStatus: CoachReferenceResolution['status'] | null;
  /** Bound target the orchestrator acted on (when known). */
  targetDate?: string;
  targetSessionName?: string;
  /** Parsed swap intent (for logging / overlay). */
  fromModality?: ConditioningModality | null;
  toModality?: ConditioningModality;
  /** Visible-projection diff: did the requested modality land? */
  projectionShowsTo?: boolean;
  projectionShowsFrom?: boolean;
}

export interface OrchestrateInput {
  userMessage: string;
  todayISO: string;
  referenceResolution: CoachReferenceResolution | null;
  /** Test seam — defaults to live store reads. */
  applyEvents?: typeof applyAdjustmentEvents;
  buildState?: () => any;
  /**
   * Test seam — defaults to the live projection (Program tab + DayWorkout).
   * Tests inject a stub that returns a deterministic ProjectionCheck so
   * the orchestrator can be exercised end-to-end without needing Zustand
   * store wiring.
   */
  verifyProjectionsFn?: (args: VerifyProjectionsArgs) => ProjectionCheck;
  /**
   * Test seam — invoked when the orchestrator decides to write a
   * recurring modality preference instead of (or in addition to) a
   * per-date event. Defaults to the live `coachPreferencesStore` writer.
   */
  setModalityPreferenceFn?: (
    sessionName: string,
    pref: {
      from: ConditioningModality | null;
      to: ConditioningModality;
      bikeLabel?: import('./coachModalitySwap').BikeLabel | null;
    },
  ) => void;
  /**
   * Test seam — return the resolved week so the orchestrator can scan
   * for future-this-week sessions whose name matches the target. Defaults
   * to a live read via `buildScheduleStateImperative`.
   */
  resolveCurrentWeekFn?: () => Array<{
    date: string;
    workout?: { name?: string } | null;
  }>;
  /**
   * Test seam — direct path the orchestrator uses to push a future-this-week
   * rewrite to the override store after recording the recurring preference.
   * Defaults to programStore.setManualOverride.
   */
  setManualOverrideFn?: (
    date: string,
    workout: any,
    ctx?: { intent?: string; reason?: string },
  ) => void;
}

export interface VerifyProjectionsArgs {
  targetDate: string;
  todayISO: string;
  fromModality: ConditioningModality | null;
  toModality: ConditioningModality;
}

/**
 * Run the Phase 3 swap pathway. Returns an outcome with a ready-to-render
 * reply for every kind. The caller (CoachScreen) renders the reply and
 * returns — never falls through to legacy.
 */
export function orchestrateModalitySwap(input: OrchestrateInput): ModalitySwapOutcome {
  const ref = input.referenceResolution;
  const parse = parseModalitySwapRequest(input.userMessage);

  // ─── 1. Reference resolution gates ──────────────────────────────
  if (!ref) {
    return finalize({
      kind: 'no_target',
      route: 'no_reference_resolution',
      reply: 'Which session do you mean?',
      applied: false,
      referenceStatus: null,
    });
  }

  if (ref.status === 'ambiguous' || ref.status === 'expired' || ref.status === 'no_target' || ref.status === 'no_reference') {
    const reply =
      ref.clarifierQuestion ?? 'Which session do you mean?';
    return finalize({
      kind: ref.status === 'ambiguous' ? 'ambiguous' : 'no_target',
      route: `reference_${ref.status}`,
      reply,
      applied: false,
      referenceStatus: ref.status,
    });
  }

  // ─── 2. Parse the modality intent ──────────────────────────────
  if (!parse) {
    const dayLabel = formatDayLabel(ref.target?.date ?? '');
    const sessionName = ref.target?.sessionName ?? 'that session';
    return finalize({
      kind: 'unparseable',
      route: 'unparseable_modality',
      reply:
        `I can see you mean ${dayLabel}'s ${sessionName}, ` +
        `but I can't apply that change automatically yet.`,
      applied: false,
      referenceStatus: ref.status,
      targetDate: ref.target?.date,
      targetSessionName: sessionName,
    });
  }

  if (!ref.target) {
    return finalize({
      kind: 'no_target',
      route: 'no_target_after_parse',
      reply: 'Which session do you mean?',
      applied: false,
      referenceStatus: ref.status,
      toModality: parse.to,
      fromModality: parse.from,
    });
  }

  const targetDate = ref.target.date;
  const targetSessionName = ref.target.sessionName;

  // ─── 3a. Same-modality label correction → recurring preference ───
  // "I want a regular bike, not an assault bike" parses as
  // from=bike, to=bike with bikeLabel set. There's no per-date swap
  // event to build (the modality didn't change), so this ALWAYS routes
  // through the preference path regardless of date. The reply composer
  // owns the honest "I don't distinguish bike subtypes in display" copy.
  if (parse.from && parse.from === parse.to) {
    return runRecurringPreferencePath(input, ref, parse, {
      targetDate,
      targetSessionName,
    });
  }

  // ─── 3b. Past-target → recurring preference path ───────────────
  // The user almost never means "edit only the past Wednesday".
  // What they typically mean is: "use bike instead of rower for these
  // sessions going forward." Record the preference, eagerly rewrite
  // any future-this-week matching sessions, never touch the past.
  if (targetDate < input.todayISO && !messageImpliesJustThisSession(input.userMessage)) {
    return runRecurringPreferencePath(input, ref, parse, {
      targetDate,
      targetSessionName,
    });
  }

  // ─── 3b. Build + apply the swap event ──────────────────────────
  const event = buildSwapConditioningModalityEvent({
    date: targetDate,
    from: parse.from,
    to: parse.to,
    bikeLabel: parse.bikeLabel ?? (parse.to === 'bike' ? 'standard' : null),
    reason: `coach modality swap: ${parse.from ?? 'auto'} → ${parse.to}`,
  });

  const applyEvents = input.applyEvents ?? applyAdjustmentEvents;

  let applyResult;
  try {
    applyResult = applyEvents([event], {
      todayISO: input.todayISO,
      allowFutureWeeks: true,
      allowPastDates: false,
      ...(input.buildState ? { buildState: input.buildState } : {}),
    });
  } catch (err) {
    logger.warn('[coach-modality-swap] apply_threw', {
      detail: err instanceof Error ? err.message : String(err),
    });
    return finalize({
      kind: 'engine_rejected',
      route: 'apply_threw',
      reply:
        `I can see you mean ${formatDayLabel(targetDate)}'s ${targetSessionName}, ` +
        `but I couldn't safely change the ${parse.from ?? 'session'} to ${parse.toToken}.`,
      applied: false,
      referenceStatus: ref.status,
      targetDate,
      targetSessionName,
      toModality: parse.to,
      fromModality: parse.from,
    });
  }

  if (!applyResult.applied || applyResult.applied.length === 0) {
    logger.debug('[coach-modality-swap] engine_rejected', {
      rejected: applyResult.rejected,
    });
    return finalize({
      kind: 'engine_rejected',
      route: 'engine_rejected',
      reply:
        `I can see you mean ${formatDayLabel(targetDate)}'s ${targetSessionName}, ` +
        `but I couldn't safely change the ${parse.from ?? 'session'} to ${parse.toToken} in the visible program.`,
      applied: false,
      referenceStatus: ref.status,
      targetDate,
      targetSessionName,
      toModality: parse.to,
      fromModality: parse.from,
    });
  }

  // ─── 4. Verify the visible projection ───────────────────────────
  const verifyFn = input.verifyProjectionsFn ?? verifyProjections;
  const verification = verifyFn({
    targetDate,
    todayISO: input.todayISO,
    fromModality: parse.from,
    toModality: parse.to,
  });

  if (!verification.bothProjectionsShowTo || verification.programTabStillShowsFrom || verification.dayWorkoutStillShowsFrom) {
    logger.warn('[coach-modality-swap] verification_failed', { verification });
    return finalize({
      kind: 'verification_failed',
      route: 'verification_failed',
      reply:
        `I can see you mean ${formatDayLabel(targetDate)}'s ${targetSessionName}, ` +
        `but the change didn't actually land in the visible program. I'm not going to pretend it did.`,
      applied: false,
      referenceStatus: ref.status,
      targetDate,
      targetSessionName,
      toModality: parse.to,
      fromModality: parse.from,
      projectionShowsTo: verification.programTabShowsTo && verification.dayWorkoutShowsTo,
      projectionShowsFrom: verification.programTabStillShowsFrom || verification.dayWorkoutStillShowsFrom,
    });
  }

  // ─── 5. Success — compose the verified reply ────────────────────
  const reply = composeSuccessReply({
    targetDate,
    targetSessionName,
    fromModality: parse.from,
    toModality: parse.to,
    fromToken: parse.from,
    toToken: parse.toToken,
  });

  return finalize({
    kind: 'applied',
    route: 'modality_swap_applied',
    reply,
    applied: true,
    referenceStatus: ref.status,
    targetDate,
    targetSessionName,
    toModality: parse.to,
    fromModality: parse.from,
    projectionShowsTo: true,
    projectionShowsFrom: false,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDayLabel(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0).toLocaleDateString(undefined, {
      weekday: 'long',
    });
  } catch {
    return iso;
  }
}

function composeSuccessReply(args: {
  targetDate: string;
  targetSessionName: string;
  fromModality: ConditioningModality | null;
  toModality: ConditioningModality;
  fromToken?: ConditioningModality | null;
  toToken: string;
}): string {
  const day = formatDayLabel(args.targetDate);
  const fromWord =
    args.fromModality === 'row'
      ? 'rower'
      : args.fromModality === 'bike'
        ? 'bike'
        : args.fromModality === 'run'
          ? 'run'
          : args.fromModality
            ? args.fromModality
            : 'previous option';
  const toWord =
    args.toModality === 'row'
      ? 'rower'
      : args.toModality === 'bike'
        ? 'bike'
        : args.toModality === 'run'
          ? 'run'
          : args.toToken;
  if (args.fromModality) {
    return `Done — ${day}'s ${args.targetSessionName} is now on the ${toWord} instead of the ${fromWord}.`;
  }
  return `Done — ${day}'s ${args.targetSessionName} is now on the ${toWord}.`;
}

export interface ProjectionCheck {
  programTabShowsTo: boolean;
  programTabStillShowsFrom: boolean;
  dayWorkoutShowsTo: boolean;
  dayWorkoutStillShowsFrom: boolean;
  bothProjectionsShowTo: boolean;
}

function verifyProjections(args: {
  targetDate: string;
  todayISO: string;
  fromModality: ConditioningModality | null;
  toModality: ConditioningModality;
}): ProjectionCheck {
  const programStore = useProgramStore.getState();
  const cuStore = useCoachUpdatesStore.getState();
  const baseState = buildScheduleStateImperative();
  const activeConstraints = (cuStore.activeConstraints ?? []).filter(
    (c) => c.status !== 'resolved',
  );
  const stateWithConstraints = { ...baseState, activeConstraints };

  // Use the Monday derived from the target date so we project the
  // correct calendar week, even if the target lives in a future week.
  const targetMonday = mondayOf(args.targetDate);
  const week = buildProgramTabProjectedWeek({
    mondayISO: targetMonday,
    todayISO: args.todayISO,
    state: stateWithConstraints,
    overrideContexts: programStore.overrideContexts ?? {},
  });
  const tabDay = week.find((d) => d.date === args.targetDate) ?? null;

  const dayProjection = buildDayWorkoutProjectedDay({
    date: args.targetDate,
    todayISO: args.todayISO,
    state: stateWithConstraints,
    overrideContext: programStore.overrideContexts?.[args.targetDate],
  });

  const programTabShowsTo = dayHasModality(tabDay, args.toModality);
  const programTabStillShowsFrom = args.fromModality
    ? dayHasModality(tabDay, args.fromModality)
    : false;
  const dayWorkoutShowsTo = dayHasModality(dayProjection, args.toModality);
  const dayWorkoutStillShowsFrom = args.fromModality
    ? dayHasModality(dayProjection, args.fromModality)
    : false;

  return {
    programTabShowsTo,
    programTabStillShowsFrom,
    dayWorkoutShowsTo,
    dayWorkoutStillShowsFrom,
    bothProjectionsShowTo: programTabShowsTo && dayWorkoutShowsTo,
  };
}

function mondayOf(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = dt.getDay();
  const offset = dow === 0 ? -6 : -(dow - 1);
  dt.setDate(dt.getDate() + offset);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// ─── Recurring-preference helpers ───────────────────────────────────

/**
 * "Just this session" / "only Wednesday" / "this one" — when the user
 * explicitly scopes the request to the single past instance, we honour
 * it and let the per-date applier reject it (it's still a past date).
 * Otherwise we infer a recurring intent.
 */
function messageImpliesJustThisSession(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    /\b(just|only)\s+(this\s+session|this\s+one|that\s+session|that\s+one|this\s+week|that\s+week)\b/.test(
      lower,
    ) ||
    /\bjust\s+(today|wednesday|thursday|friday|saturday|sunday|monday|tuesday)\b/.test(lower) ||
    /\bonly\s+(today|wednesday|thursday|friday|saturday|sunday|monday|tuesday)\b/.test(lower) ||
    /\bone[- ]off\b/.test(lower)
  );
}

interface RecurringPathArgs {
  targetDate: string;
  targetSessionName: string;
}

/**
 * Write a recurring modality preference for the resolved session name.
 * Eagerly rewrite any future-this-week matching sessions via the same
 * setManualOverride pathway the per-date applier uses, then VERIFY the
 * change actually landed in the visible projection (Program tab + the
 * DayWorkout view) before claiming success. Past dates are NEVER
 * rewritten — the preference is forward-looking.
 *
 * Hard verification gate: if the preference saves but neither the
 * Program tab nor the DayWorkout projection now shows `to`, we refuse
 * to say "Done" and return an honest "saved but didn't land" reply.
 */
function runRecurringPreferencePath(
  input: OrchestrateInput,
  ref: CoachReferenceResolution,
  parse: NonNullable<ReturnType<typeof parseModalitySwapRequest>>,
  args: RecurringPathArgs,
): ModalitySwapOutcome {
  const setPref =
    input.setModalityPreferenceFn ??
    ((sessionName, pref) =>
      useCoachPreferencesStore.getState().setModalityPreference(sessionName, {
        from: pref.from ?? null,
        to: pref.to,
        bikeLabel: pref.bikeLabel ?? null,
      }));

  setPref(args.targetSessionName, {
    from: parse.from,
    to: parse.to,
    bikeLabel: parse.bikeLabel ?? null,
  });

  // Best-effort eager rewrite for future-this-week matching sessions.
  // The recurring preference is the source of truth for future weeks
  // (projectVisibleDay reads the store on every render), so even when
  // this loop fails the user sees the change next time they navigate.
  const resolveWeek = input.resolveCurrentWeekFn ?? defaultResolveCurrentWeek;
  const setOverride = input.setManualOverrideFn ?? defaultSetManualOverride;
  const targetKey = canonicalSessionKey(args.targetSessionName);
  let eagerWrites = 0;
  let firstFutureMatchDate: string | null = null;
  let scannedWeek: Array<{ date: string; workout?: { name?: string } | null }> = [];
  try {
    scannedWeek = resolveWeek() ?? [];
    for (const day of scannedWeek) {
      if (!day || day.date <= input.todayISO) continue; // strict: today or earlier untouched
      const w: any = day.workout;
      if (!w || canonicalSessionKey(w.name ?? '') !== targetKey) continue;
      if (!firstFutureMatchDate) firstFutureMatchDate = day.date;
      const rewritten = applyModalityPreferenceToWorkout(w, {
        from: parse.from,
        to: parse.to,
        bikeLabel: parse.bikeLabel ?? null,
      });
      if (rewritten === w) continue;
      setOverride(day.date, rewritten, {
        intent: 'program_adjustment',
        reason: `coach modality preference: ${parse.from ?? 'auto'} → ${parse.to}`,
      });
      eagerWrites++;
    }
  } catch (err) {
    logger.warn('[coach-modality-swap] eager_rewrite_threw', {
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Verification gate ──
  // Pick the first future date the visible projection should now show
  // the requested modality. Prefer (a) an eager-write target this
  // week, (b) the same weekday next week, (c) a 7-day fallback.
  const verificationDate = pickVerificationDate({
    eagerHits: scannedWeek,
    targetSessionName: args.targetSessionName,
    todayISO: input.todayISO,
    targetDate: args.targetDate,
  });

  const verifyFn = input.verifyProjectionsFn ?? verifyProjections;
  const verification = verifyFn({
    targetDate: verificationDate,
    todayISO: input.todayISO,
    fromModality: parse.from,
    toModality: parse.to,
  });

  // Same-modality label-only correction (e.g. parse.from === parse.to === 'bike')
  // can't use the modality-presence rule — the modality is identical on both
  // sides by design. Treat the preference write itself as the landing signal
  // and confirm the modality didn't disappear (paranoia guard for an empty
  // / structurally broken projection).
  const isLabelOnlyCorrection =
    !!parse.from && parse.from === parse.to && !!parse.bikeLabel;

  const projectionLanded = isLabelOnlyCorrection
    ? verification.programTabShowsTo || verification.dayWorkoutShowsTo
    : (verification.programTabShowsTo || verification.dayWorkoutShowsTo) &&
      !(verification.programTabStillShowsFrom && verification.dayWorkoutStillShowsFrom);

  logger.debug('[coach-modality-swap] preference_verification', {
    sessionName: args.targetSessionName,
    from: parse.from ?? null,
    to: parse.to,
    bikeLabel: parse.bikeLabel ?? null,
    isLabelOnlyCorrection,
    verificationDate,
    eagerWrites,
    projectionLanded,
    verification,
  });

  if (!projectionLanded) {
    const reply = composeRecurringPreferenceFailureReply({
      sessionName: args.targetSessionName,
      fromModality: parse.from,
      toModality: parse.to,
      toToken: parse.toToken,
    });
    return finalize({
      kind: 'verification_failed',
      route: 'modality_preference_verification_failed',
      reply,
      applied: false,
      referenceStatus: ref.status,
      targetDate: args.targetDate,
      targetSessionName: args.targetSessionName,
      toModality: parse.to,
      fromModality: parse.from,
      projectionShowsTo:
        verification.programTabShowsTo && verification.dayWorkoutShowsTo,
      projectionShowsFrom:
        verification.programTabStillShowsFrom ||
        verification.dayWorkoutStillShowsFrom,
    });
  }

  const reply = composeRecurringPreferenceReply({
    sessionName: args.targetSessionName,
    fromModality: parse.from,
    toModality: parse.to,
    toToken: parse.toToken,
    bikeLabel: parse.bikeLabel ?? null,
    firstFutureDate: firstFutureMatchDate ?? verificationDate,
  });

  logger.debug('[coach-modality-swap] applied_preference', {
    sessionName: args.targetSessionName,
    from: parse.from ?? null,
    to: parse.to,
    eagerWrites,
    targetDate: args.targetDate,
    firstFutureDate: firstFutureMatchDate ?? verificationDate,
    verificationDate,
  });

  return finalize({
    kind: 'applied_preference',
    route: 'modality_preference_applied',
    reply,
    applied: true,
    referenceStatus: ref.status,
    targetDate: args.targetDate,
    targetSessionName: args.targetSessionName,
    toModality: parse.to,
    fromModality: parse.from,
    projectionShowsTo: true,
    projectionShowsFrom: false,
  });
}

/**
 * Pick a future date the verification projection can probe. Strategy:
 *  1. The first future-this-week matching date the eager loop saw, or
 *  2. The same weekday as the resolved past target, +7 days, or
 *  3. Today + 7 days as a last-resort.
 */
function pickVerificationDate(args: {
  eagerHits: Array<{ date: string; workout?: { name?: string } | null }>;
  targetSessionName: string;
  todayISO: string;
  targetDate: string;
}): string {
  const targetKey = canonicalSessionKey(args.targetSessionName);
  for (const day of args.eagerHits ?? []) {
    if (!day || day.date <= args.todayISO) continue;
    const w: any = day.workout;
    if (!w) continue;
    if (canonicalSessionKey(w.name ?? '') === targetKey) return day.date;
  }
  // Fallback — same DOW next week.
  return addDaysISO(args.targetDate, 7) ?? addDaysISO(args.todayISO, 7) ?? args.todayISO;
}

function addDaysISO(iso: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function defaultResolveCurrentWeek(): Array<{
  date: string;
  workout?: { name?: string } | null;
}> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { resolveWeekWithConditioning, getMondayStr } = require('./sessionResolver');
  const monday = getMondayStr(0);
  const state = buildScheduleStateImperative();
  return resolveWeekWithConditioning(monday, state);
}

function defaultSetManualOverride(date: string, workout: any, ctx?: any): void {
  useProgramStore.getState().setManualOverride(date, workout, ctx);
}

function composeRecurringPreferenceReply(args: {
  sessionName: string;
  fromModality: ConditioningModality | null;
  toModality: ConditioningModality;
  toToken: string;
  bikeLabel?: import('./coachModalitySwap').BikeLabel | null;
  firstFutureDate?: string;
}): string {
  const fromWord = modalityToWord(args.fromModality, 'previous option', null);
  const toWord = modalityToWord(args.toModality, args.toToken, args.bikeLabel ?? null);
  const firstDayLabel = args.firstFutureDate ? formatDayLabel(args.firstFutureDate) : null;

  // Same-modality bike-label correction — both sides are "bike", just the
  // subtype changed. Reply lands without "instead of" framing.
  const isLabelOnly = args.fromModality === 'bike' && args.toModality === 'bike';
  if (isLabelOnly) {
    const noteLabel =
      args.bikeLabel === 'standard'
        ? `regular bike`
        : args.bikeLabel === 'assault'
          ? `assault bike`
          : `bike`;
    const opposite = args.bikeLabel === 'standard' ? 'an assault bike' : 'a regular bike';
    return (
      `Done — I'll use a ${noteLabel} for ${args.sessionName} sessions going forward, ` +
      `not ${opposite}. Note: I don't currently distinguish bike subtypes in the ` +
      `program display, so the change shows up as wording / coach-note only.`
    );
  }

  const lead =
    firstDayLabel && /^[A-Z]/.test(firstDayLabel)
      ? `Done — next ${firstDayLabel}'s ${args.sessionName} is now on the ${toWord}`
      : `Done — your next ${args.sessionName} is now on the ${toWord}`;
  if (args.fromModality) {
    return `${lead} instead of the ${fromWord}, and I'll use the ${toWord} for these sessions going forward.`;
  }
  return `${lead}, and I'll use the ${toWord} for these sessions going forward.`;
}

/**
 * Honest reply when the preference saved but no future visible session
 * shows the requested modality. Required by the Coach contract — never
 * say "Done" unless the visible projection actually changed.
 */
function composeRecurringPreferenceFailureReply(args: {
  sessionName: string;
  fromModality: ConditioningModality | null;
  toModality: ConditioningModality;
  toToken: string;
}): string {
  const toWord = args.toModality === 'row'
    ? 'rower'
    : args.toModality === 'bike'
      ? 'bike'
      : args.toModality === 'run'
        ? 'run'
        : args.toToken;
  return (
    `I saved the ${toWord} preference for ${args.sessionName}, ` +
    `but it didn't land in the visible program yet. ` +
    `I'm not going to pretend it changed.`
  );
}

function modalityToWord(
  modality: ConditioningModality | null,
  fallback: string,
  bikeLabel: import('./coachModalitySwap').BikeLabel | null,
): string {
  if (!modality) return fallback;
  if (modality === 'row') return 'rower';
  if (modality === 'bike') {
    if (bikeLabel === 'standard') return 'regular bike';
    if (bikeLabel === 'assault') return 'assault bike';
    return 'bike';
  }
  if (modality === 'run') return 'run';
  if (modality === 'ski') return 'ski';
  if (modality === 'swim') return 'swim';
  return modality;
}

function finalize(out: ModalitySwapOutcome): ModalitySwapOutcome {
  logger.debug('[coach-modality-swap] outcome', {
    kind: out.kind,
    route: out.route,
    applied: out.applied,
    targetDate: out.targetDate ?? null,
    fromModality: out.fromModality ?? null,
    toModality: out.toModality ?? null,
    projectionShowsTo: out.projectionShowsTo ?? null,
    projectionShowsFrom: out.projectionShowsFrom ?? null,
    referenceStatus: out.referenceStatus,
  });
  return out;
}
