/**
 * THE COACH'S MOVE — DOES IT LAND, DOES IT RECORD, DOES IT SURVIVE THE NIGHT?
 *
 * SEAT INBOX item 1 (2026-08-10), quoting slice 3's own first line of NOT
 * COVERED back at it: *"No screen is mounted, no store is touched,
 * executeProgramControlActionDurably is not called by any cell in this suite…
 * It is the first thing the next pass owes."*
 *
 * `coachTabSlice3Tests` proves, at SOURCE level, that the coach's output is a
 * `ProgramControlAction`, that `move_session` reaches `applyPlanChange`, and
 * that `applyPlanChange` appends a `plan_change` decision. Three true readings
 * of three files. **What no cell anywhere does is run them.** The slice's whole
 * durability claim — *"it goes through the SAME door as the Program tab's own
 * move, so the toast and Undo work on it exactly as they do on your own tap"* —
 * is an inference across three source readings, and the seat named it the
 * likeliest place the slice is wrong.
 *
 * ## THE ATHLETE'S OWN TAP IS THE CONTROL, ON THE SAME WEEK
 *
 * The order is explicit and the reason is the whole point: *"a tape that only
 * exercises the coach cannot show they are the same door."* A coach arm alone
 * can only report whether the coach's move landed. The claim under test is
 * SAMENESS, and sameness needs two photographs of one week reached two ways.
 * So both arms move the same session, from the same day to the same day, on the
 * same generated world, and the verdict is a comparison of the two — not a
 * reading of either.
 *
 * ## AND THE UNDO RIDES ALONG, BECAUSE IT IS CLAIMED TO COME FREE
 *
 * The seat: *"it is claimed to come free; free claims are the ones that rot."*
 * The mechanism (`undoLastDecision` → append a `reversal` → re-derive) is proven
 * over an athlete-tapped move by `tape:lr29-undo-durability`. It has never been
 * asked to unwind a COACH-authored one. If the coach's decision reaches the
 * ledger in the door's own vocabulary, undo cannot tell the difference — and
 * that "cannot tell the difference" is a measurement, not a deduction.
 *
 * ## SIX PHOTOGRAPHS, TWO ARMS, ONE WEEK
 *
 *   FLOOR        — generated, nothing landed. Taken TWICE, as the instrument's
 *                  own control: the two arms are separately-reached worlds, and
 *                  comparing them means nothing unless reaching is repeatable.
 *   COACH-ACTED  — after the coach's proposal is confirmed through the screen's
 *                  own call.
 *   COACH-BOOTED — heap dead, disk restored, boot replayed.
 *   COACH-UNDONE — after `undoLastDecision` over the coach's decision.
 *   COACH-UNDO-BOOTED — and after another relaunch.
 *   TAP-ACTED / TAP-BOOTED — the same move through `PlanChangeSheet`'s door.
 *
 * ## THIS TAPE ASSERTS NOTHING AND THAT IS DELIBERATE
 *
 * It is a tape, not a gate — the `tape:lr29-*` shape the order named. Its
 * result is the printed lines. It DOES abort loudly when it cannot act, because
 * the boot-replay tape's finding was that a probe too easy to fail reads exactly
 * like a system that works, and a vacuous comparison must never be published as
 * agreement.
 *
 * FIDELITY CAVEAT, STATED RATHER THAN HIDDEN: no React renders here. The coach
 * arm calls the same rule functions `CoachTabScreen.send`/`handleConfirm` call,
 * with the same arguments, in the same order — but it reproduces the hook body
 * (`projectWeekFor`) rather than mounting the hook. What a mounted screen could
 * still get wrong is listed in NOT COVERED at the bottom of the run.
 *
 * Run: npm run tape:coach-move-durability
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

import type { TrainingProgram } from '../types/domain';
import type { PlanChange } from '../utils/planChangeTypes';
import type { ProgramControlAction } from '../types/programControlAction';
import type { VisibleWeek } from '../rules/visibleProjection';
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
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { project } from '../rules/projectVisibleWeek';
import {
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
} from '../utils/programControlActions';
import { listPlanChangeOptionsForDay } from '../utils/planChangeProducer';
import { readCoachMessage } from '../rules/coachRead';
import { coachProposal } from '../rules/coachProposal';
import { coachChangeOutcome } from '../rules/coachChangeOutcome';
import { undoLastDecision, pendingUndoTarget } from '../store/undoLastDecision';
import { runQuiescentBoot } from '../store/quiescentBoot';
import { weekdayName } from '../utils/appDate';
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

/**
 * THE WEEK, BOTH WAYS, FROM ONE COMPUTATION — `projectWeekFor`'s body.
 *
 * `useResolvedWeek` returns `{ weekDays, visibleWeek }` out of a single
 * `projectWeekFor(monday, state)` call: `weekDays` is `ResolvedDay[]`, the door's
 * input, and `visibleWeek` is `project()` OVER THAT SAME ARRAY, the coach's
 * input. They are not two derivations that could disagree; the second is a
 * function of the first.
 *
 * That matters more than it looks, and the tape prints both for a reason — see
 * the coach arm.
 */
function readWeekBothWays(mondayISO: string = WEEK): { weekDays: unknown[]; visibleWeek: VisibleWeek } {
  const state = buildScheduleStateImperative();
  const overrideContexts = useProgramStore.getState().overrideContexts ?? {};
  const weekDays = quiet(() => buildProgramTabProjectedWeek({
    mondayISO,
    todayISO: TODAY,
    state,
    overrideContexts,
    modalityPreferences: (state as unknown as { modalityPreferences?: Record<string, unknown> })
      .modalityPreferences,
  }));
  const visibleWeek = quiet(() => project({ week: weekDays, weekStart: mondayISO }));
  return { weekDays: weekDays as unknown[], visibleWeek };
}

/**
 * The world, reached by ACTING — the hand-built-fixture ban (AGENTS.md) and the
 * same world both sibling tapes use, so a divergence here is comparable with
 * theirs rather than being a fourth story about a different week.
 */
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
    reason: 'coach-move-tape:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

/**
 * WHICH DAY MOVES, CHOSEN THROUGH THE PROJECTION'S OWN CAPABILITY FLAG.
 *
 * Not "the last future session" — `capabilities.canMoveWholeDay` is the field
 * `coachProposal` consults before it proposes anything, so a source day chosen
 * any other way could produce a REFUSAL that the tape would then have to report
 * as if it were a durability finding. The probe picks a day the coach is
 * actually allowed to move, or it aborts saying so.
 */
function chooseMove(visibleWeek: VisibleWeek): { from: string; to: string } {
  const movable = visibleWeek.days.filter((day) =>
    day.date > TODAY && day.capabilities.canMoveWholeDay && day.parts.length > 0);
  const empty = visibleWeek.days.filter((day) => day.date > TODAY && day.parts.length === 0);
  if (movable.length === 0) {
    throw new Error('TAPE ABORT: no future day the projection says can move — nothing to propose');
  }
  if (empty.length === 0) {
    throw new Error('TAPE ABORT: no empty future day to land on — the probe cannot act');
  }
  return { from: movable[movable.length - 1]!.date, to: empty[empty.length - 1]!.date };
}

// ─── SAM'S MULTI-PART CATCH (2026-08-10) ────────────────────────────────────
//
// *"i tried moving monday S&C to wednesday and it only moved the strength - so
// multi session days dont work yet"*
//
// The arms above move a day chosen through `canMoveWholeDay` and say nothing
// about a day carrying TWO parts, which is the shape Sam actually moved. The
// existing photograph is blind to it by construction: it prints a per-date
// HEADLINE, and a day whose conditioning stayed behind still has a headline.
// **A photograph that cannot see the defect cannot clear it**, so the section
// below photographs PART KINDS and nothing else.

/**
 * THE WEEK AFTER `WEEK` — and the reason the section needs it is a finding.
 *
 * This world's `TODAY` is Wednesday 2026-08-05, and its anchored day is Monday
 * 2026-08-03 (`strength+team_training`) — Sam's *"monday S&C"* EXACTLY, sitting
 * two days in the PAST. Every remaining future day of that week is unanchored,
 * so the current week cannot reproduce his shape at all: the first run of this
 * section moved an unanchored Saturday and printed NOT REPRODUCED, which looked
 * like a clean result and was a probe that never reached the case.
 *
 * The next Monday is still inside `PLAN_CHANGE_EDIT_HORIZON_WEEKS` (3), so it is
 * a day the athlete may legally move.
 */
function nextMondayISO(mondayISO: string): string {
  const [year, month, day] = mondayISO.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

const NEXT_WEEK = nextMondayISO(WEEK);

/** The day's parts as the projection kinds them — the unit the defect lives in. */
function partsOf(visibleWeek: VisibleWeek, dateISO: string): string {
  const day = visibleWeek.days.find((candidate) => candidate.date === dateISO);
  if (!day) return '(no such day)';
  if (day.parts.length === 0) return '—';
  return day.parts.map((part) => part.kind).sort().join('+');
}

/**
 * A SOURCE DAY WITH TWO OR MORE DISTINCT PART KINDS, and a destination with none.
 *
 * DISTINCT kinds, not `parts.length`: two strength parts on one day is not the
 * shape Sam described, and a length would count it as if it were. Same law the
 * photograph above is written under — `a count taken for a record`.
 */
function choosePartedMove(visibleWeek: VisibleWeek): { from: string; to: string } {
  const parted = visibleWeek.days.filter((day) => {
    if (day.date <= TODAY) return false;
    return new Set(day.parts.map((part) => part.kind)).size >= 2;
  });
  const empty = visibleWeek.days.filter((day) => day.date > TODAY && day.parts.length === 0);
  // PREFER AN ANCHORED DAY, AND THE REASON IS THE TYPE'S OWN DOCSTRING.
  // `PlanChangeMoveScopeId`: *"`whole_day` is offered only on days that carry no
  // anchor, because on a combined day it would take the anchor with it."* So a
  // two-part day WITHOUT a team night is the easy case — the picker offers
  // whole_day and the door has a whole day to move. Sam's day was "monday S&C",
  // and Monday is a team-training night. **Choosing the last parted day reached
  // the easy case on the first run and reported NOT REPRODUCED**, which is a
  // probe finding, not a product one. Anchored days are tried FIRST.
  const anchored = parted.filter((day) =>
    day.parts.some((part) => part.kind === 'team_training'));
  const preferred = anchored.length > 0 ? anchored : parted;
  if (parted.length === 0) {
    throw new Error(
      'TAPE ABORT (multi-part section): no future day in this world carries two distinct '
      + 'part kinds, so Sam\'s shape cannot be reproduced here. That is a finding about '
      + 'the WORLD, not a pass — do not read the single-part result above as covering it.',
    );
  }
  if (empty.length === 0) {
    throw new Error('TAPE ABORT (multi-part section): no empty future day to land on');
  }
  console.log(`   [probe] parted future days: ${parted.length}`
    + ` · of those, ANCHORED (carry team_training): ${anchored.length}`
    + ` → trying ${anchored.length > 0 ? 'an ANCHORED day (Sam\'s shape)' : 'an UNANCHORED day'}`);
  return { from: preferred[preferred.length - 1]!.date, to: empty[empty.length - 1]!.date };
}

/**
 * WHAT THE ATHLETE'S OWN PICKER OFFERS FOR THIS DAY — read from the owner.
 *
 * `listPlanChangeOptionsForDay` is the exported entry to `moveOptionsForDay`,
 * which is the module the census found the coach never consults. Printing it
 * beside the coach's action is the parity claim made VISIBLE: the athlete is
 * asked a question, and the tape shows what that question's options were while
 * the coach answered none of them.
 */
function scopeIdsOfferedFor(weekDays: unknown[], dateISO: string): string[] {
  try {
    const options = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: weekDays as never,
      date: dateISO,
      todayISO: TODAY,
    }));
    return ((options.move?.scopes ?? []) as ReadonlyArray<{ id: string }>).map((s) => s.id);
  } catch {
    return [];
  }
}

function scopesOfferedFor(weekDays: unknown[], dateISO: string): string {
  try {
    const options = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: weekDays as never,
      date: dateISO,
      todayISO: TODAY,
    }));
    const scopes = (options.move?.scopes ?? []) as ReadonlyArray<{ id: string; label: string }>;
    if (scopes.length === 0) return '(none offered)';
    return scopes.map((scope) => `${scope.id}="${scope.label}"`).join(' · ');
  } catch (error) {
    return `(producer threw: ${(error as Error).message})`;
  }
}

/**
 * THE ATHLETE'S TAP WITH AN EXPLICIT SCOPE — the third arm, and the one that
 * separates the two defects.
 *
 * Arms 1 and 2 both send NO scope, so they cannot tell "the door mishandles a
 * whole-day move" from "the coach never said which part". This arm sends the
 * scope the picker actually offers, which is what a real athlete tap carries.
 */
async function scopedTapArm(
  chosen: { from: string; to: string },
  scope: string,
  mondayISO: string = WEEK,
): Promise<{ ok: boolean; outcome?: string; message?: string }> {
  const { weekDays } = readWeekBothWays(mondayISO);
  const change = {
    kind: 'move_session', fromDate: chosen.from, toDate: chosen.to, scope,
  } as never as PlanChange;
  const action = programControlActionForPlanChange(change);
  if (!action) throw new Error('TAPE ABORT: the sheet owner produced no action for a scoped move');
  return await quietAsync(() => executeProgramControlActionDurably(
    action,
    { visibleWeek: weekDays as never, todayISO: TODAY },
  )) as { ok: boolean; outcome?: string; message?: string };
}

/**
 * THE COACH'S TURN, THROUGH THE COACH'S OWN PATH, IN THE SCREEN'S OWN ORDER.
 *
 * `CoachTabScreen.send` → `readCoachMessage` → `coachProposal`; then
 * `handleConfirm` → `executeProgramControlActionDurably(action, context)`; then
 * the settling effect → `coachChangeOutcome`. Every call below is one of those,
 * with the arguments the screen passes — INCLUDING the context object, which is
 * copied from `handleConfirm` verbatim and not improved on the way past. **A
 * tape that hands the door a better argument than the screen does is a tape
 * measuring a screen nobody ships**, and this tape's whole first finding was
 * exactly that argument.
 *
 * THIS IS A MIRROR, AND A MIRROR DRIFTS. The tap arm below does not have this
 * problem — it calls `programControlActionForPlanChange`, the sheet's own
 * extracted owner, which exists because a device suite once hand-copied the
 * sheet's payload and kept the bug after the sheet was fixed. `handleConfirm`
 * lives inside a component and has no such owner to call, so the context object
 * two lines down is a COPY. `coachTabSlice3Tests` [7] is what stops it drifting:
 * it reads the screen's own call site and reds if that call stops passing a
 * visible week. The mirror is honest only while that cell is green.
 */
async function coachArm(
  chosen: { from: string; to: string },
  mondayISO: string = WEEK,
): Promise<{
  message: string;
  intent: string;
  verdict: string;
  cardLines: readonly string[];
  door: { ok: boolean; outcome?: string; message?: string };
  said: string;
  saidVerdict: string;
  action: ProgramControlAction | null;
}> {
  const { weekDays, visibleWeek } = readWeekBothWays(mondayISO);
  // The first message anybody would type — the matrix's Q+M+D row, composed from
  // the two days the probe picked so the reader is genuinely exercised rather
  // than bypassed with a hand-built request.
  const message = `can you move ${weekdayName(chosen.from)} to ${weekdayName(chosen.to)}?`;
  const read = readCoachMessage({ message, week: visibleWeek, todayISO: TODAY });
  console.log(`\n   [coach] athlete types : "${message}"`);
  console.log(`   [coach] read as       : ${read.intent}`);
  if (read.intent !== 'change') {
    return {
      message, intent: read.intent, verdict: 'not-a-change', cardLines: [],
      door: { ok: false }, said: '(never reached)', saidVerdict: 'n/a', action: null,
    };
  }
  const proposal = coachProposal({ request: read.request, week: visibleWeek });
  console.log(`   [coach] proposal      : ${proposal.verdict}`);
  if (proposal.verdict !== 'proposed' || !proposal.action || !proposal.card) {
    console.log(`   [coach] says instead  : "${proposal.text}"`);
    return {
      message, intent: read.intent, verdict: proposal.verdict, cardLines: [],
      door: { ok: false }, said: proposal.text, saidVerdict: 'n/a', action: null,
    };
  }
  const card = proposal.card as unknown as Record<string, unknown>;
  const cardLines = Object.entries(card)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => `${key}: ${String(value)}`);
  for (const line of cardLines) console.log(`   [card] ${line}`);

  // ── THE YES. THIS IS `handleConfirm`, COPIED. ─────────────────────────────
  const before = visibleWeek;
  const action = proposal.action;
  const result = await quietAsync(() => executeProgramControlActionDurably(
    action,
    { visibleWeek: weekDays as never, todayISO: TODAY },
  )) as { ok: boolean; outcome?: 'applied' | 'no_change' | 'refused'; message?: string };
  console.log(`\n   [door] ok            : ${result.ok}`);
  console.log(`   [door] outcome       : ${result.outcome ?? '(none)'}`);
  if (result.message) console.log(`   [door] message       : "${result.message}"`);

  // ── AND THE SETTLING EFFECT: what the athlete is actually told. ───────────
  const after = readWeekBothWays(mondayISO).visibleWeek;
  const outcome = coachChangeOutcome({
    action,
    before,
    after,
    door: { ok: result.ok, outcome: result.outcome, message: result.message },
  });
  console.log(`   [coach] SAYS         : "${outcome.text}"`);
  console.log(`   [coach] verdict      : ${outcome.verdict}`);
  if (outcome.violations.length > 0) {
    console.log(`   [coach] violations   : ${outcome.violations.join(' | ')}`);
  }
  return {
    message,
    intent: read.intent,
    verdict: proposal.verdict,
    cardLines,
    door: { ok: result.ok, outcome: result.outcome, message: result.message },
    said: outcome.text,
    saidVerdict: outcome.verdict,
    action,
  };
}

/**
 * THE CONTROL — THE ATHLETE'S OWN TAP, THROUGH THE SHEET'S OWN OWNER.
 *
 * `PlanChangeSheet.commitPlanChange` builds its action with
 * `programControlActionForPlanChange` and calls the door with
 * `{ visibleWeek: weekDays, todayISO }`. Both are reproduced exactly; the action
 * is not hand-written here, because a harness that mirrors a screen drifts from
 * it and that owner exists for precisely this reason (its own doc comment says
 * so).
 */
async function tapArm(
  chosen: { from: string; to: string },
  mondayISO: string = WEEK,
): Promise<{
  door: { ok: boolean; outcome?: string; message?: string };
  action: ProgramControlAction | null;
}> {
  const { weekDays } = readWeekBothWays(mondayISO);
  const change = {
    kind: 'move_session', fromDate: chosen.from, toDate: chosen.to,
  } as never as PlanChange;
  const action = programControlActionForPlanChange(change);
  if (!action) throw new Error('TAPE ABORT: the sheet owner produced no action for move_session');
  const result = await quietAsync(() => executeProgramControlActionDurably(
    action,
    { visibleWeek: weekDays as never, todayISO: TODAY },
  )) as { ok: boolean; outcome?: 'applied' | 'no_change' | 'refused'; message?: string };
  console.log(`\n   [tap] ok             : ${result.ok}`);
  console.log(`   [tap] outcome        : ${result.outcome ?? '(none)'}`);
  if (result.message) console.log(`   [tap] message        : "${result.message}"`);
  return { door: { ok: result.ok, outcome: result.outcome, message: result.message }, action };
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

interface Photograph {
  readonly shape: string;
  readonly kinds: readonly string[];
  readonly decisions: readonly string[];
  readonly overrides: number;
}

/**
 * THE PHOTOGRAPH IS TAKEN OFF THE PROJECTION, NOT OFF THE STORE.
 *
 * `visibleDay.headline` is the sentence HomeScreenV2 renders and the sentence
 * the coach speaks — the app's one account of what is on a day. A store-level
 * photograph would answer a question nobody asked: the claim is that the
 * athlete's WEEK survives, and the week is what they read.
 *
 * `a count taken for a record`: the shape is a per-date STRING, never a length.
 * A week with the session on Tuesday and the same week with it on Thursday have
 * identical lengths, and length is blind to the only thing a move changes.
 */
function photograph(label: string): Photograph {
  const { visibleWeek } = readWeekBothWays();
  const shape = visibleWeek.days
    .map((day) => `${day.date}:${day.parts.length > 0 ? String(day.headline) : '—'}`)
    .sort()
    .join(' | ');
  const entries = decisionLedgerEntries();
  const kinds = entries.map((entry) => entry.decision.kind);
  // The decision's own payload, minus the fields that cannot be equal across two
  // separately-timed runs. What is LEFT is what the two arms are claimed to
  // share — and the writer/source fields are printed rather than compared,
  // because the boundary already recorded that the ledger records the CHANGE and
  // not its author.
  const decisions = entries.map((entry) => {
    const decision = entry.decision as unknown as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(decision)) {
      if (key === 'id' || key === 'atISO' || key === 'recordedAtISO') continue;
      copy[key] = value;
    }
    return JSON.stringify(copy);
  });
  const overrides = Object.keys(
    (useProgramStore.getState() as unknown as { dateOverrides?: Record<string, unknown> })
      .dateOverrides ?? {},
  ).length;

  console.log(`\n── ${label} ──`);
  console.log(`   week shape      : ${shape}`);
  console.log(`   dateOverrides   : ${overrides}`);
  console.log(`   ledger entries  : ${entries.length} [${kinds.join(', ')}]`);
  return { shape, kinds, decisions, overrides };
}

const main = async (): Promise<void> => {
  console.log('\n════ THE COACH\'S MOVE — DOES IT LAND, RECORD, AND SURVIVE? ════');
  console.log(`world: Sam's 2026-08-05 pass · generated ${SAM_PASS_20260805_GENERATION_DAY} · week ${WEEK}`);
  console.log('the claim under test: "the coach\'s move goes through the SAME door as the');
  console.log('athlete\'s own tap, so the ledger, undo and durability come free."');

  // ── THE INSTRUMENT'S OWN CONTROL, FIRST. ─────────────────────────────────
  //
  // The two arms are separately-reached worlds. Every verdict below compares one
  // against the other, and that comparison says nothing about the coach unless
  // reaching the world twice produces the same week. Measured, not assumed —
  // the sibling tape's three "side-writers" were all its own instrument.
  reachWorldByActing();
  const floorA = photograph('FLOOR A — generated, nothing landed');
  reachWorldByActing();
  const floorB = photograph('FLOOR B — generated again (instrument control)');
  const reachIsRepeatable = floorA.shape === floorB.shape;
  console.log(`\n   [control] is reaching the world repeatable? ${reachIsRepeatable ? 'YES' : 'NO'}`);
  if (!reachIsRepeatable) {
    console.log('   ⚠ NO — the two arms below stand on different floors, so a difference');
    console.log('     between them cannot be attributed to the coach. Read each arm against');
    console.log('     ITS OWN floor and treat the cross-arm verdict as UNREADABLE.');
  }

  const chosen = chooseMove(readWeekBothWays().visibleWeek);
  console.log(`\n   [probe] the move both arms will make: ${chosen.from} (${weekdayName(chosen.from)})`
    + ` → ${chosen.to} (${weekdayName(chosen.to)})`);

  // ── ARM 1: THE COACH ──────────────────────────────────────────────────────
  console.log('\n════ ARM 1 — THE COACH PROPOSES, THE ATHLETE CONFIRMS ════');
  const coach = await coachArm(chosen);
  const coachActed = photograph('COACH-ACTED — after the confirm');
  await relaunch();
  const coachBooted = photograph('COACH-BOOTED — heap dead, disk restored, boot replayed');

  // ── THE UNDO, OVER A COACH-LANDED MOVE ────────────────────────────────────
  console.log('\n════ AND UNDO, WHICH IS CLAIMED TO COME FREE ════');
  const undoTarget = pendingUndoTarget();
  console.log(`   [undo] pending target: ${undoTarget
    ? `${undoTarget.id} (${undoTarget.decision.kind})` : 'NONE — nothing to undo'}`);
  let undoOutcome = 'not-attempted';
  if (undoTarget) {
    const result = await quietAsync(() => undoLastDecision());
    undoOutcome = result.outcome;
    console.log(`   [undo] outcome       : ${result.outcome}`);
    if (result.outcome === 'refused') {
      console.log(`   [undo] reason        : ${(result as { reason?: string }).reason}`);
    }
  }
  const coachUndone = photograph('COACH-UNDONE — undoLastDecision over the coach\'s decision');
  await relaunch();
  const coachUndoBooted = photograph('COACH-UNDO-BOOTED — and it relaunched again');

  // ── ARM 2: THE CONTROL — THE ATHLETE'S OWN TAP, SAME MOVE, SAME WEEK ──────
  console.log('\n════ ARM 2 — THE SAME MOVE, THE ATHLETE\'S OWN TAP ════');
  reachWorldByActing();
  const tap = await tapArm(chosen);
  const tapActed = photograph('TAP-ACTED — after the sheet\'s door ran');
  await relaunch();
  const tapBooted = photograph('TAP-BOOTED — heap dead, disk restored, boot replayed');

  // ── THE ANSWER ────────────────────────────────────────────────────────────
  console.log('\n════ THE ANSWER ════');

  const tapMoved = tapActed.shape !== floorA.shape;
  const coachMoved = coachActed.shape !== floorA.shape;

  // THE CONTROL ARM IS THE PRECONDITION, AND IT IS READ FIRST. If the athlete's
  // own tap does not move this week either, the probe is wrong about the world
  // and NOTHING below is about the coach.
  console.log(`   PROBE — did the ATHLETE'S TAP move the week? ${tapMoved ? 'YES' : 'NO — VACUOUS'}`);
  if (!tapMoved) {
    console.log('   ⚠ THE CONTROL DID NOT MOVE THE WEEK, so this run answers nothing about');
    console.log('     the coach. The chosen move is not one this world performs; fix the');
    console.log('     probe before reading a single line below as a coach finding.');
  }
  console.log('');
  console.log(`   coach: read → proposal            : ${coach.intent} → ${coach.verdict}`);
  console.log(`   coach: the door said ok?          : ${coach.door.ok} (${coach.door.outcome ?? 'no outcome'})`);
  console.log(`   coach: did the week move?         : ${coachMoved ? 'YES' : 'NO'}`);
  console.log(`   coach: what the athlete is told   : "${coach.said}"`);
  console.log('');
  console.log(`   ── SAMENESS, the claim the order named ──`);
  console.log(`   COACH-ACTED  vs TAP-ACTED         : ${coachActed.shape === tapActed.shape ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log(`   COACH-BOOTED vs TAP-BOOTED        : ${coachBooted.shape === tapBooted.shape ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log(`   ledger kinds, coach               : [${coachActed.kinds.join(', ')}]`);
  console.log(`   ledger kinds, tap                 : [${tapActed.kinds.join(', ')}]`);
  console.log(`   the DECISION each arm recorded    : ${
    coachActed.decisions.join('') === tapActed.decisions.join('') ? 'IDENTICAL' : 'DIFFERENT'}`);
  for (const line of coachActed.decisions) console.log(`     coach: ${line}`);
  for (const line of tapActed.decisions) console.log(`     tap  : ${line}`);
  console.log('');
  console.log(`   ── DURABILITY ──`);
  console.log(`   coach: ACTED → BOOTED             : ${coachActed.shape === coachBooted.shape ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log(`   tap  : ACTED → BOOTED             : ${tapActed.shape === tapBooted.shape ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log('');
  console.log(`   ── UNDO OVER A COACH-LANDED MOVE ──`);
  console.log(`   undo outcome                      : ${undoOutcome}`);
  console.log(`   UNDONE back to the floor?         : ${coachUndone.shape === floorA.shape ? 'YES' : 'NO'}`);
  console.log(`   and it survived the relaunch?     : ${coachUndone.shape === coachUndoBooted.shape ? 'YES' : 'NO'}`);

  // ── THE READING ───────────────────────────────────────────────────────────
  console.log('');
  if (!coachMoved && tapMoved) {
    console.log('   ✗✗ THE COACH\'S MOVE DOES NOT LAND, AND THE ATHLETE\'S SAME MOVE DOES.');
    console.log('      Same world, same two days, same door — one arm moved the week and the');
    console.log('      other did not. The claim "it goes through the SAME door as the Program');
    console.log('      tab\'s own move" is FALSE as shipped, and every downstream free claim');
    console.log('      (the ledger records it, undo covers it, it survives the night) is');
    console.log('      VACUOUS rather than proven — there is nothing to record or undo.');
    console.log(`      Read the door line: "${coach.door.message ?? '(no message)'}"`);
  } else if (coachMoved && tapMoved && coachActed.shape === tapActed.shape) {
    console.log('   ✓✓ THE TWO ARMS PRODUCED THE SAME WEEK, and it is the same week after a');
    console.log('      relaunch. The coach\'s move is the athlete\'s move.');
  } else if (coachMoved && !tapMoved) {
    console.log('   ? THE COACH MOVED THE WEEK AND THE CONTROL DID NOT. That is a finding');
    console.log('     about the PROBE or the sheet\'s door, not a durability result — read');
    console.log('     the tap arm before concluding anything about the coach.');
  } else if (coachMoved && tapMoved) {
    console.log('   ? BOTH ARMS MOVED THE WEEK AND THE TWO WEEKS DIFFER. Two doors, or one');
    console.log('     door given different arguments. Diff the two ACTED shapes above.');
  }

  // ══ SAM'S MULTI-PART DAY (2026-08-10) ═════════════════════════════════════
  console.log('\n\n════ SAM\'S CATCH — A DAY WITH TWO PARTS ════');
  console.log('"i tried moving monday S&C to wednesday and it only moved the strength');
  console.log(' - so multi session days dont work yet"');
  console.log('\nthe question this section answers: is that the DOOR losing a part on any');
  console.log('whole-day move, or the COACH never saying which part? One run tells them');
  console.log('apart, because the athlete\'s own tap is run on the same day.');

  reachWorldByActing();
  // NEXT WEEK, not this one — this world's only anchored day is Monday
  // 2026-08-03 and it is already in the past. See `nextMondayISO`.
  const partedFloor = readWeekBothWays(NEXT_WEEK).visibleWeek;
  // THE WORLD, PRINTED. The first run of this section picked a day with no team
  // anchor, reported NOT REPRODUCED, and looked like a clean result. Printing
  // every day's parts is what makes "which shape did the probe actually reach?"
  // answerable from the output instead of from the chooser's source.
  console.log(`\n   [world] EVERY day of week ${NEXT_WEEK} and what it carries`
    + ` (today is ${TODAY}, ${weekdayName(TODAY)}):`);
  for (const day of partedFloor.days) {
    const kinds = new Set(day.parts.map((part) => part.kind));
    const when = day.date < TODAY ? 'past  ' : day.date === TODAY ? 'TODAY ' : 'future';
    console.log(`     ${day.date} ${weekdayName(day.date).padEnd(9)} ${when}  ${
      day.parts.length === 0 ? '—' : [...kinds].sort().join('+')}`
      + `${kinds.has('team_training') ? '   ← ANCHORED' : ''}`);
  }
  const parted = choosePartedMove(partedFloor);
  const srcParts = partsOf(partedFloor, parted.from);
  const dstParts = partsOf(partedFloor, parted.to);
  console.log(`\n   [probe] source day    : ${parted.from} (${weekdayName(parted.from)}) parts = ${srcParts}`);
  console.log(`   [probe] destination   : ${parted.to} (${weekdayName(parted.to)}) parts = ${dstParts}`);
  console.log(`   [probe] the PICKER offers the athlete:`);
  console.log(`     ${scopesOfferedFor(readWeekBothWays(NEXT_WEEK).weekDays, parted.from)}`);

  // ── ARM A: THE COACH, ON A TWO-PART DAY ───────────────────────────────────
  console.log('\n──── ARM A — THE COACH (sends NO scope) ────');
  const partedCoach = await coachArm(parted, NEXT_WEEK);
  const coachSrcAfter = partsOf(readWeekBothWays(NEXT_WEEK).visibleWeek, parted.from);
  const coachDstAfter = partsOf(readWeekBothWays(NEXT_WEEK).visibleWeek, parted.to);
  console.log(`\n   source ${parted.from}: ${srcParts}  →  ${coachSrcAfter}`);
  console.log(`   dest   ${parted.to}: ${dstParts}  →  ${coachDstAfter}`);

  // ── ARM B: THE ATHLETE'S TAP, SAME (SCOPELESS) ACTION ─────────────────────
  console.log('\n──── ARM B — THE ATHLETE\'S TAP, also scopeless (the control) ────');
  reachWorldByActing();
  const partedTap = await tapArm(parted, NEXT_WEEK);
  const tapSrcAfter = partsOf(readWeekBothWays(NEXT_WEEK).visibleWeek, parted.from);
  const tapDstAfter = partsOf(readWeekBothWays(NEXT_WEEK).visibleWeek, parted.to);
  console.log(`   door ok: ${partedTap.door.ok} (${partedTap.door.outcome ?? 'no outcome'})`);
  console.log(`   source ${parted.from}: ${srcParts}  →  ${tapSrcAfter}`);
  console.log(`   dest   ${parted.to}: ${dstParts}  →  ${tapDstAfter}`);

  // ── ARM C: THE ATHLETE'S TAP WITH THE SCOPE THE PICKER OFFERS ─────────────
  console.log('\n──── ARM C — THE ATHLETE\'S TAP carrying an explicit whole_day scope ────');
  reachWorldByActing();
  let scopedSrcAfter = '(not run)';
  let scopedDstAfter = '(not run)';
  let scopedDoor: { ok: boolean; outcome?: string; message?: string } | null = null;
  try {
    scopedDoor = await scopedTapArm(parted, 'whole_day', NEXT_WEEK);
    scopedSrcAfter = partsOf(readWeekBothWays(NEXT_WEEK).visibleWeek, parted.from);
    scopedDstAfter = partsOf(readWeekBothWays(NEXT_WEEK).visibleWeek, parted.to);
    console.log(`   door ok: ${scopedDoor.ok} (${scopedDoor.outcome ?? 'no outcome'})`);
    if (scopedDoor.message) console.log(`   door says: "${scopedDoor.message}"`);
    console.log(`   source ${parted.from}: ${srcParts}  →  ${scopedSrcAfter}`);
    console.log(`   dest   ${parted.to}: ${dstParts}  →  ${scopedDstAfter}`);
  } catch (error) {
    console.log(`   ARM C could not run: ${(error as Error).message}`);
  }

  // ── ARM D: THE ATHLETE'S TAP USING A SCOPE THE PICKER ACTUALLY OFFERS ─────
  //
  // Arms A-C all send either nothing or `whole_day`. On an anchored day the
  // picker offers NEITHER — it offers component scopes. This arm takes the
  // first row the owner actually lists, which is the route a real athlete has,
  // and it is what turns "the coach lacks parity" from a reading into a
  // measurement: same day, same destination, athlete succeeds, coach refused.
  console.log('\n──── ARM D — THE ATHLETE\'S TAP with a scope the PICKER offers ────');
  reachWorldByActing();
  const offeredIds = scopeIdsOfferedFor(readWeekBothWays(NEXT_WEEK).weekDays, parted.from);
  const realScope = offeredIds.find((id) => id !== 'whole_day') ?? offeredIds[0] ?? null;
  let offeredDoor: { ok: boolean; outcome?: string; message?: string } | null = null;
  let offeredSrcAfter = '(not run)';
  let offeredDstAfter = '(not run)';
  if (!realScope) {
    console.log('   the picker offers no scope at all for this day — arm D cannot run.');
  } else {
    console.log(`   using scope: ${realScope} (of [${offeredIds.join(', ')}])`);
    try {
      offeredDoor = await scopedTapArm(parted, realScope, NEXT_WEEK);
      offeredSrcAfter = partsOf(readWeekBothWays(NEXT_WEEK).visibleWeek, parted.from);
      offeredDstAfter = partsOf(readWeekBothWays(NEXT_WEEK).visibleWeek, parted.to);
      console.log(`   door ok: ${offeredDoor.ok} (${offeredDoor.outcome ?? 'no outcome'})`);
      if (offeredDoor.message) console.log(`   door says: "${offeredDoor.message}"`);
      console.log(`   source ${parted.from}: ${srcParts}  →  ${offeredSrcAfter}`);
      console.log(`   dest   ${parted.to}: ${dstParts}  →  ${offeredDstAfter}`);
    } catch (error) {
      console.log(`   ARM D could not run: ${(error as Error).message}`);
    }
  }

  // ── THE READING, AND IT NAMES WHICH DEFECT ────────────────────────────────
  //
  // THE DOOR'S OUTCOME IS READ BEFORE THE PARTS, AND THAT ORDER IS THE WHOLE
  // CORRECTNESS OF THIS BLOCK. The first version of this verdict compared parts
  // only: on an anchored day all three arms were REFUSED, nothing moved, and it
  // printed "DOOR DEFECT — a scopeless whole-day move does not carry the whole
  // day." A refusal read as a partial move. That is the exact hazard
  // `chooseMove` above is documented against — *"a source day chosen any other
  // way could produce a REFUSAL that the tape would then have to report as if it
  // were a durability finding"* — reintroduced in a new section, and caught only
  // because the door printed its reason. **A refusal is not a defect; it is the
  // app declining, and it must be classified before any part is compared.**
  console.log('\n──── WHICH DEFECT IS IT? ────');
  const srcKindCount = new Set(srcParts.split('+')).size;
  const coachRefused = partedCoach.door.ok !== true;
  const tapRefused = partedTap.door.ok !== true;
  const scopedRefused = scopedDoor ? scopedDoor.ok !== true : true;
  const coachLostAPart = !coachRefused && coachDstAfter !== srcParts;
  const tapLostAPart = !tapRefused && tapDstAfter !== srcParts;
  console.log(`   source day carried            : ${srcParts} (${srcKindCount} distinct kinds)`);
  console.log(`   coach arm: door ok?           : ${!coachRefused} → dest = ${coachDstAfter}`);
  console.log(`   tap   arm: door ok?           : ${!tapRefused} → dest = ${tapDstAfter}`);
  console.log(`   scoped tap: door ok?          : ${!scopedRefused} → dest = ${scopedDstAfter}`);
  console.log(`   coach arm == tap arm?         : ${coachDstAfter === tapDstAfter ? 'IDENTICAL' : 'DIFFERENT'}`);
  const offeredWorked = offeredDoor?.ok === true;
  console.log(`   ARM D (picker's own scope)    : ${
    offeredDoor === null ? 'not run' : `${offeredWorked ? 'APPLIED' : 'refused'} → dest = ${offeredDstAfter}`}`);
  console.log('');
  if (coachRefused && tapRefused) {
    console.log('   ⊘ NOT A MOVE AT ALL — BOTH ARMS WERE REFUSED, so this run says NOTHING');
    console.log('     about parts being lost. The door declined identically for the coach and');
    console.log('     for the athlete\'s own tap:');
    console.log(`       "${partedCoach.door.message ?? '(no message)'}"`);
    console.log('     THIS IS NOT SAM\'S REPORTED SHAPE. He saw a move that PARTIALLY applied');
    console.log('     ("it only moved the strength"), not a refusal. Do not report this as');
    console.log('     his defect reproduced, and do not report it as cleared.');
    console.log('');
    console.log('     WHAT IT DOES SHOW IS A PARITY FACT (L-C4), AND IT IS WORTH THE RUN:');
    console.log('     on this anchored day the athlete\'s own picker offers scope rows and');
    console.log('     NO whole_day row — exactly as PlanChangeMoveScopeId\'s docstring says');
    console.log('     — so an athlete CAN move part of this day by choosing a scope, while');
    console.log('     the coach, which never sends one, can only be refused. The athlete has');
    console.log('     a route here and the coach does not.');
    if (offeredWorked) {
      console.log('');
      console.log('     ✗✗ AND ARM D MEASURED IT RATHER THAN ARGUING IT: the athlete\'s tap,');
      console.log(`        carrying the picker's own "${realScope}" row, APPLIED on the same`);
      console.log('        day the coach was refused. Same day, same destination, same door.');
      console.log('        **THE COACH IS REFUSED WHERE THE ATHLETE SUCCEEDS** — an L-C4');
      console.log('        parity defect, measured, not read off a constant.');
    }
  } else if (coachLostAPart && tapLostAPart && coachDstAfter === tapDstAfter) {
    console.log('   ✗✗ DOOR DEFECT, NOT A COACH DEFECT — and it has been shipping under');
    console.log('      EVERY athlete tap, not just the coach\'s. A scopeless whole-day move');
    console.log('      does not carry the whole day. That breaks the Bible\'s own move law,');
    console.log('      "Do not lose the session", and the coach is merely the surface that');
    console.log('      made it visible. Fix it at the door and say so plainly.');
    if (!scopedRefused && scopedDstAfter === srcParts) {
      console.log('      NOTE: the SCOPED tap (arm C) carried every part, so the door is');
      console.log('      correct when TOLD the scope — the defect is what an OMITTED scope');
      console.log('      means, which is exactly coachProposal\'s recorded assumption.');
    }
  } else if (coachLostAPart && !tapLostAPart && !tapRefused) {
    console.log('   ✗✗ COACH DEFECT — the athlete\'s tap moved every part and the coach\'s');
    console.log('      move did not. The assumption recorded in coachProposal.ts §4 —');
    console.log('      "An omitted scope is the door\'s whole-day move, which is what was');
    console.log('      asked for" — is FALSE for a multi-part day.');
  } else if (coachRefused !== tapRefused) {
    console.log('   ✗✗ PARITY BREAK AT THE DOOR — one arm was refused and the other was not,');
    console.log('      on the same day, with the same two dates. Read both door messages');
    console.log('      above: the coach and the athlete are NOT reaching the same door with');
    console.log('      the same arguments, which is the slice\'s central claim.');
  } else if (!coachLostAPart && !tapLostAPart) {
    console.log('   ✓ Both arms carried every part of the day. Sam\'s shape is NOT');
    console.log('     reproduced by this world/day — which does not clear the defect, it');
    console.log('     means this probe did not reach it. Report as NOT REPRODUCED, never');
    console.log('     as fixed, and say which day was tried.');
  } else {
    console.log('   ? Mixed result — read the three arms above before concluding anything.');
  }
  console.log('');
  console.log('   AND THE CARD — L-C2 asks whether what Sam READ matched what happened:');
  for (const line of partedCoach.cardLines) console.log(`     [card] ${line}`);
  console.log(`     [coach SAYS] "${partedCoach.said}" (${partedCoach.saidVerdict})`);
  console.log('     A card that named the whole day while one part stayed is an L-C2');
  console.log('     failure on its own, independent of which defect above is true.');

  console.log('\n   NOT COVERED: one action kind, one week, one world, depth 1, no device.');
  console.log('   NO REACT: the arms call the screens\' own rule functions with the screens\'');
  console.log('   own arguments, but nothing is mounted — a defect that lives in render');
  console.log('   order, in a stale closure, or in the settling effect\'s timing is outside');
  console.log('   what this tape can see. It ASSERTS NOTHING: a zero exit code means the');
  console.log('   process ran, never that the coach works.');
  console.log('');
};

void main().catch((error) => {
  console.error('\nTAPE ABORTED', error);
  process.exitCode = 1;
});
