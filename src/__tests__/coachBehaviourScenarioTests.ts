/**
 * coachBehaviourScenarioTests — coach behaviour regression harness.
 *
 * Tests whether the coach behaves like a smart S&C coach across realistic
 * multi-turn conversations. Runs through the real deterministic pipeline
 * (buildCoachContextPacket → routeCoachCommand → executeCoachCommand)
 * with the same store wiring the live CoachScreen uses.
 *
 * IMPORTANT: Uses the real system date (Date.now) because
 * buildCoachContextPacket internally calls getMondayStr(0) which is
 * not injectable. The shared fixture's block bounds are computed from
 * the real date so the program is always in-block.
 *
 * Fast, deterministic, no Maestro, no LLM. Fails on dumb responses.
 *
 * Run: npm run test:coach-behaviour-scenarios
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  useCoachContextStateStore,
} from '../store/coachContextStateStore';
import { useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import {
  isMutationLike,
  type CoachReferenceResolution,
} from '../utils/coachReferenceResolver';
import {
  routeCoachCommand,
  isMutateCommand,
  type CoachCommand,
} from '../utils/coachCommandRouter';
import {
  executeCoachCommand,
  type ExecutionResult,
} from '../utils/coachCommandExecutor';
import { buildCoachContextPacket } from '../utils/coachContextPacket';
import type { CoachContextPacket } from '../utils/coachIntent';
import {
  usePendingCoachClarifierStore,
  getPendingClarifierSnapshot,
} from '../store/pendingCoachClarifierStore';
import {
  captureFromExecutorClarify,
  resumeFromPending,
} from '../utils/coachClarifierResume';
import {
  buildSmokeCoachBikeFlowProgram,
} from '../data/smokeCoachBikeFlowProgram';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { getMondayStr } from '../utils/sessionResolver';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { PendingCoachProposal } from '../utils/coachIntent';

// ─── Tiny test harness ──────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  \u2713 ${name}`);
  } else {
    fail++;
    const msg = name + (detail ? `\n      ${detail}` : '');
    failures.push(msg);
    console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function section(label: string) {
  console.log(`\n${label}`);
}

// ─── Date helpers ───────────────────────────────────────────────────

/** Real today ISO — matches what buildCoachContextPacket uses. */
function realTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// ─── Global bad-response rules ──────────────────────────────────────

const DUMB_RESPONSE_PATTERNS: Array<{ name: string; re: RegExp }> = [
  {
    name: 'legacy verified command path leak',
    re: /program changes need to go through the verified coach command path/i,
  },
  { name: 'vague delegation', re: /I can talk through that/i },
  { name: 'unhelpful cant-see', re: /I can'?t see/i },
];

function assertNoDumbClarifier(reply: string, context: string) {
  for (const { name, re } of DUMB_RESPONSE_PATTERNS) {
    ok(
      `${context}: no dumb response (${name})`,
      !re.test(reply),
      `Reply contained dumb pattern "${name}": "${reply.slice(0, 200)}"`,
    );
  }
}

// ─── Assertion helpers ──────────────────────────────────────────────

function assertReplyNotContains(
  reply: string,
  forbidden: string[],
  context: string,
) {
  for (const f of forbidden) {
    ok(
      `${context}: reply does not contain "${f.slice(0, 60)}"`,
      !reply.toLowerCase().includes(f.toLowerCase()),
      `Reply contained forbidden text: "${reply.slice(0, 200)}"`,
    );
  }
}

function assertReplyContainsAny(
  reply: string,
  expected: string[],
  context: string,
) {
  const found = expected.some((e) =>
    reply.toLowerCase().includes(e.toLowerCase()),
  );
  ok(
    `${context}: reply contains one of [${expected.map((e) => `"${e}"`).join(', ')}]`,
    found,
    `Reply: "${reply.slice(0, 200)}"`,
  );
}

function assertVisibleWeekDayContains(
  week: ResolvedDay[],
  dayOfWeek: number,
  token: string,
  context: string,
) {
  const day = week.find((d) => d.dayOfWeek === dayOfWeek);
  const name = day?.workout?.name ?? '';
  const desc = day?.workout?.description ?? '';
  const notes = (day?.workout?.exercises ?? [])
    .map((e: any) => e?.notes ?? '')
    .join(' ');
  const optTitles = (day?.workout?.conditioningBlock?.options ?? [])
    .map((o: any) => o?.title ?? '')
    .join(' ');
  const text = `${name} ${desc} ${notes} ${optTitles}`.toLowerCase();
  ok(
    `${context}: ${SHORT[dayOfWeek]} visible workout contains "${token}"`,
    text.includes(token.toLowerCase()),
    `Visible name: "${name}" desc: "${desc}"`,
  );
}

function assertVisibleWeekDayNotContains(
  week: ResolvedDay[],
  dayOfWeek: number,
  token: string,
  context: string,
) {
  const day = week.find((d) => d.dayOfWeek === dayOfWeek);
  const name = day?.workout?.name ?? '';
  const desc = day?.workout?.description ?? '';
  const notes = (day?.workout?.exercises ?? [])
    .map((e: any) => e?.notes ?? '')
    .join(' ');
  const optTitles = (day?.workout?.conditioningBlock?.options ?? [])
    .map((o: any) => o?.title ?? '')
    .join(' ');
  const text = `${name} ${desc} ${notes} ${optTitles}`.toLowerCase();
  ok(
    `${context}: ${SHORT[dayOfWeek]} visible workout does NOT contain "${token}"`,
    !text.includes(token.toLowerCase()),
    `Visible name: "${name}" desc: "${desc}"`,
  );
}

// ─── Store seeding ──────────────────────────────────────────────────

function seedStores() {
  const program = buildSmokeCoachBikeFlowProgram(); // uses real Date.now
  const ps = useProgramStore.getState();
  ps.setCurrentProgram(program);
  ps.setCurrentMicrocycle(program.microcycles[0]);
  useCoachContextStateStore.getState().clearCoachContext();
  const cu = useCoachUpdatesStore.getState();
  if (cu.setActiveInjury) cu.setActiveInjury(null as any);
  if (cu.setActiveConstraints) cu.setActiveConstraints([]);
  usePendingCoachClarifierStore.getState().clearPending();
  ps.clearManualOverrides();
  try {
    const { useCoachPreferencesStore } = require('../store/coachPreferencesStore');
    useCoachPreferencesStore.getState().clearAllModalityPreferences();
  } catch { /* store may not exist */ }
}

function getVisibleWeek(todayISO: string): ResolvedDay[] {
  // Use getMondayStr(0) — same as buildCoachContextPacket does internally
  const monday = getMondayStr(0);
  return buildProgramTabProjectedWeek({
    mondayISO: monday,
    todayISO,
    state: buildScheduleStateImperative() as any,
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  });
}

// ─── Multi-turn coach runner ────────────────────────────────────────

interface TurnState {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  pendingProposal: PendingCoachProposal | null;
  todayISO: string;
}

interface TurnResult {
  reply: string;
  packet: CoachContextPacket;
  routedCommand: CoachCommand;
  executionResult: ExecutionResult | null;
  visibleWeek: ResolvedDay[];
}

function runCoachTurn(userMessage: string, state: TurnState): TurnResult {
  const recentMessages = state.messages.slice(-8);

  // 1. Build context packet (includes auto-bind)
  const packet = buildCoachContextPacket({
    userMessage,
    recentMessages,
    todayISO: state.todayISO,
    pendingInjury: null,
    pendingCoachProposal: state.pendingProposal,
  });

  // 2. Check pending clarifier resume
  const pendingClarifier = getPendingClarifierSnapshot();
  if (pendingClarifier) {
    const resumed = resumeFromPending({
      pending: pendingClarifier,
      newMessage: userMessage,
      newResolution: packet.referenceResolution ?? null,
    });
    if (resumed && resumed.mode === 'mutate') {
      usePendingCoachClarifierStore.getState().clearPending();
      const result = executeCoachCommand({
        command: resumed,
        todayISO: state.todayISO,
        referenceResolution: packet.referenceResolution ?? null,
        userMessage,
      });
      state.messages.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: result.reply },
      );
      return {
        reply: result.reply,
        packet,
        routedCommand: resumed,
        executionResult: result,
        visibleWeek: getVisibleWeek(state.todayISO),
      };
    }
  }

  // 3. Route through the command router
  const routedCommand = routeCoachCommand({
    userMessage,
    todayISO: state.todayISO,
    referenceResolution: packet.referenceResolution ?? null,
  });

  // 4. Execute if it's a mutate command
  let executionResult: ExecutionResult | null = null;
  let reply: string;

  if (isMutateCommand(routedCommand)) {
    executionResult = executeCoachCommand({
      command: routedCommand,
      todayISO: state.todayISO,
      referenceResolution: packet.referenceResolution ?? null,
      userMessage,
    });
    reply = executionResult.reply;

    // Capture pending clarifier if executor returned clarify
    if (executionResult.kind === 'clarify' && routedCommand.mode === 'mutate') {
      const captured = captureFromExecutorClarify({
        routedCommand,
        askedQuestion: executionResult.reply,
        originalMessage: userMessage,
        missingFields:
          routedCommand.mode === 'mutate' ? routedCommand.missingFields : undefined,
      });
      if (captured) {
        usePendingCoachClarifierStore.getState().setPending(captured);
      }
    } else if (
      executionResult.kind === 'mutated' ||
      executionResult.kind === 'rejected' ||
      executionResult.kind === 'rejected_with_alternatives'
    ) {
      if (getPendingClarifierSnapshot()) {
        usePendingCoachClarifierStore.getState().clearPending();
      }
    }
  } else {
    // Conversation / explain / inspect_state / clarify
    if (routedCommand.mode === 'conversation' || routedCommand.mode === 'explain') {
      reply = `[conversation: ${routedCommand.reason}]`;
    } else if (routedCommand.mode === 'inspect_state') {
      reply = `[inspect_state: ${routedCommand.reason}]`;
    } else if (routedCommand.mode === 'clarify') {
      reply = routedCommand.question;
    } else {
      reply = `[${routedCommand.mode}: ${(routedCommand as any).reason ?? 'unknown'}]`;
    }
  }

  // Write lastExplainedSession for conversation turns that reference a day
  if (
    (routedCommand.mode === 'conversation' || routedCommand.mode === 'explain') &&
    packet.referenceResolution?.target
  ) {
    const target = packet.referenceResolution.target;
    const day = packet.currentWeek.find((d) => d.date === target.date);
    const { extractModalitiesFromSession } = require('../utils/coachReferenceResolver');
    const modalities = day?.workout
      ? extractModalitiesFromSession({
          name: day.workout.name,
          exercises: day.workout.exercises,
        })
      : undefined;
    useCoachContextStateStore.getState().setLastExplainedSession({
      date: target.date,
      sessionName: target.sessionName,
      modalities,
      source: 'coach_explanation',
    });
  }

  state.messages.push(
    { role: 'user', content: userMessage },
    { role: 'assistant', content: reply },
  );

  return {
    reply,
    packet,
    routedCommand,
    executionResult,
    visibleWeek: getVisibleWeek(state.todayISO),
  };
}

// ─── Scenario types ─────────────────────────────────────────────────

interface TurnExpectation {
  user: string;
  expectReplyNotContains?: string[];
  expectReplyContainsAny?: string[];
  /** Accepts multiple modes — pass if any matches. */
  expectRouterModeIn?: string[];
  expectRouterOperation?: string;
  expectNeedsClarification?: boolean;
  expectApplied?: boolean;
  /** Assert the resolved target date is >= todayISO. */
  expectTargetIsFuture?: boolean;
  /** Assert the resolved target date is < todayISO (past). */
  expectTargetIsPast?: boolean;
  /** Assert the router scope (one_off / recurring / this_week). */
  expectScope?: string;
  /** Assert the target day-of-week (0=Sun..6=Sat). */
  expectTargetDow?: number;
  expectVisibleContains?: Array<{ dayOfWeek: number; token: string }>;
  expectVisibleNotContains?: Array<{ dayOfWeek: number; token: string }>;
}

interface Scenario {
  name: string;
  turns: TurnExpectation[];
}

// ─── Scenario runner ────────────────────────────────────────────────

function runScenario(scenario: Scenario) {
  section(`[Scenario] ${scenario.name}`);
  seedStores();

  const todayISO = realTodayISO();
  const state: TurnState = {
    messages: [],
    pendingProposal: null,
    todayISO,
  };

  for (let i = 0; i < scenario.turns.length; i++) {
    const turn = scenario.turns[i];
    const turnLabel = `T${i + 1}`;
    console.log(`  --- ${turnLabel}: "${turn.user}" ---`);

    const result = runCoachTurn(turn.user, state);

    // Global bad-response check on every turn
    assertNoDumbClarifier(result.reply, turnLabel);

    // Router mode
    if (turn.expectRouterModeIn) {
      const matched = turn.expectRouterModeIn.includes(result.routedCommand.mode);
      ok(
        `${turnLabel}: router mode in [${turn.expectRouterModeIn.join(', ')}]`,
        matched,
        `got ${result.routedCommand.mode}`,
      );
    }

    // Router operation
    if (turn.expectRouterOperation) {
      const op =
        result.routedCommand.mode === 'mutate' ? result.routedCommand.operation : null;
      ok(
        `${turnLabel}: router operation = ${turn.expectRouterOperation}`,
        op === turn.expectRouterOperation,
        `got ${op}`,
      );
    }

    // needsClarification
    if (turn.expectNeedsClarification !== undefined) {
      const nc =
        result.routedCommand.mode === 'mutate'
          ? result.routedCommand.needsClarification
          : result.routedCommand.mode === 'clarify'
          ? true  // clarify mode implies clarification needed
          : null;
      ok(
        `${turnLabel}: needsClarification = ${turn.expectNeedsClarification}`,
        nc === turn.expectNeedsClarification,
        `got ${nc} (mode=${result.routedCommand.mode})`,
      );
    }

    // Applied
    if (turn.expectApplied !== undefined && result.executionResult) {
      ok(
        `${turnLabel}: applied = ${turn.expectApplied}`,
        result.executionResult.applied === turn.expectApplied,
        `got applied=${result.executionResult.applied} kind=${result.executionResult.kind}`,
      );
    }

    // Target is future
    if (turn.expectTargetIsFuture) {
      const targetDate = result.packet.referenceResolution?.target?.date ?? null;
      ok(
        `${turnLabel}: target is future (>= ${state.todayISO})`,
        targetDate != null && targetDate >= state.todayISO,
        `target date: ${targetDate}`,
      );
    }

    // Target is past
    if (turn.expectTargetIsPast) {
      const targetDate = result.packet.referenceResolution?.target?.date ?? null;
      ok(
        `${turnLabel}: target is past (< ${state.todayISO})`,
        targetDate != null && targetDate < state.todayISO,
        `target date: ${targetDate}`,
      );
    }

    // Scope
    if (turn.expectScope) {
      const scope = result.routedCommand.mode === 'mutate'
        ? result.routedCommand.scope
        : null;
      ok(
        `${turnLabel}: scope = ${turn.expectScope}`,
        scope === turn.expectScope,
        `got ${scope}`,
      );
    }

    // Target day-of-week
    if (turn.expectTargetDow !== undefined) {
      const targetDate = result.packet.referenceResolution?.target?.date ?? null;
      const actualDow = targetDate ? isoToDow(targetDate) : null;
      ok(
        `${turnLabel}: target dow = ${turn.expectTargetDow} (${SHORT[turn.expectTargetDow]})`,
        actualDow === turn.expectTargetDow,
        `got dow=${actualDow} date=${targetDate}`,
      );
    }

    // Reply content
    if (turn.expectReplyNotContains) {
      assertReplyNotContains(result.reply, turn.expectReplyNotContains, turnLabel);
    }
    if (turn.expectReplyContainsAny) {
      assertReplyContainsAny(result.reply, turn.expectReplyContainsAny, turnLabel);
    }

    // Visible week
    if (turn.expectVisibleContains) {
      for (const { dayOfWeek, token } of turn.expectVisibleContains) {
        assertVisibleWeekDayContains(result.visibleWeek, dayOfWeek, token, turnLabel);
      }
    }
    if (turn.expectVisibleNotContains) {
      for (const { dayOfWeek, token } of turn.expectVisibleNotContains) {
        assertVisibleWeekDayNotContains(result.visibleWeek, dayOfWeek, token, turnLabel);
      }
    }
  }
}

// ─── Scenario definitions ───────────────────────────────────────────
//
// All scenarios use the real today — the fixture seeds a program whose
// block bounds always cover the current date. The visible week is the
// real current week with the Wednesday Easy Aerobic Flush (20min Rower).

const TODAY = realTodayISO();
const TODAY_DOW = isoToDow(TODAY);
const MONDAY_IS_PAST = TODAY_DOW > 1; // true except on Monday itself

const scenarios: Scenario[] = [
  // ── 1. Bare "Monday" after Monday has passed → next Monday one-off ──
  ...(MONDAY_IS_PAST ? [{
    name: 'Bare "Monday" after Monday has passed → next Monday one-off',
    turns: [
      {
        user: "Can you add some cardio to Monday's session?",
        expectRouterModeIn: ['mutate'],
        expectRouterOperation: 'add_conditioning',
        expectTargetIsFuture: true,
        expectTargetDow: 1, // Monday
        expectScope: 'one_off',
        expectReplyNotContains: [
          'in the past',
          "can't change it",
          'verified coach command path',
        ],
      },
    ],
  }] : [{
    // On Monday itself, the target should be today's Monday (not past)
    name: 'Bare "Monday" on Monday → today one-off',
    turns: [
      {
        user: "Can you add some cardio to Monday's session?",
        expectRouterModeIn: ['mutate'],
        expectRouterOperation: 'add_conditioning',
        expectTargetDow: 1,
        expectScope: 'one_off',
      },
    ],
  }]),

  // ── 1b. "next Monday" → next Monday one-off ──
  {
    name: '"next Monday" → next Monday one-off',
    turns: [
      {
        user: "Can you add some cardio to next Monday's session?",
        expectRouterModeIn: ['mutate'],
        expectRouterOperation: 'add_conditioning',
        expectTargetIsFuture: true,
        expectTargetDow: 1,
        expectScope: 'one_off',
      },
    ],
  },

  // ── 1c. "every Monday" → recurring scope ──
  {
    name: '"every Monday" → recurring scope',
    turns: [
      {
        user: 'Can you add cardio to every Monday?',
        expectRouterModeIn: ['mutate'],
        expectRouterOperation: 'add_conditioning',
        expectTargetDow: 1,
        expectScope: 'recurring',
      },
    ],
  },

  // ── 1d. "Mondays" (plural) → recurring scope ──
  {
    name: '"Mondays" plural → recurring scope',
    turns: [
      {
        user: 'Can you add cardio on Mondays?',
        expectRouterModeIn: ['mutate'],
        expectRouterOperation: 'add_conditioning',
        expectTargetDow: 1,
        expectScope: 'recurring',
      },
    ],
  },

  // ── 2. Pending conditioning option resume — finisher ──
  {
    name: 'Pending conditioning option resume — finisher',
    turns: [
      {
        user: "Can you add some cardio to Wednesday's session?",
        expectRouterModeIn: ['mutate'],
        expectRouterOperation: 'add_conditioning',
        expectReplyNotContains: ['verified coach command path'],
      },
      {
        user: 'Finisher please',
        expectReplyNotContains: [
          'verified coach command path',
          'which session',
          'which day',
          'I can talk through that',
        ],
      },
    ],
  },

  // ── 3. Steady state option resume ──
  {
    name: 'Pending conditioning option resume — steady state',
    turns: [
      {
        user: "Can you add some cardio to Wednesday's session?",
        expectRouterModeIn: ['mutate'],
        expectRouterOperation: 'add_conditioning',
      },
      {
        user: 'Steady state please',
        expectReplyNotContains: [
          'verified coach command path',
          'which session',
          'which day',
        ],
      },
    ],
  },

  // ── 4. Short intervals option resume ──
  {
    name: 'Pending conditioning option resume — short intervals',
    turns: [
      {
        user: "Can you add some cardio to Wednesday's session?",
        expectRouterModeIn: ['mutate'],
        expectRouterOperation: 'add_conditioning',
      },
      {
        user: 'Short intervals',
        expectReplyNotContains: [
          'verified coach command path',
          'which session',
          'which day',
        ],
      },
    ],
  },

  // ── 5. Midweek row to bike — no clarifier ──
  {
    name: 'Midweek row to bike — no clarifier',
    turns: [
      {
        user: 'Why is there a mid week row?',
        expectRouterModeIn: ['conversation', 'explain'],
      },
      {
        user: 'Can you change to a bike?',
        expectRouterModeIn: ['mutate'],
        expectRouterOperation: 'swap_conditioning_modality_once',
        expectNeedsClarification: false,
        expectApplied: true,
        expectReplyNotContains: [
          'which session',
          'Which session should I switch',
        ],
        expectVisibleContains: [
          { dayOfWeek: 3, token: 'bike' },
        ],
        expectVisibleNotContains: [
          { dayOfWeek: 3, token: 'rower' },
        ],
      },
    ],
  },

  // ── 6. Normal bike correction (full 3-turn flow) ──
  {
    name: 'Normal bike correction — full 3-turn flow',
    turns: [
      {
        user: 'Why is there a mid week row?',
        expectRouterModeIn: ['conversation', 'explain'],
      },
      {
        user: 'Can you change to a bike?',
        expectRouterModeIn: ['mutate'],
        expectNeedsClarification: false,
        expectApplied: true,
        expectReplyNotContains: ['which session'],
      },
      {
        user: 'You changed to an assault bike I wanted a normal bike',
        expectReplyNotContains: ['which session'],
        expectVisibleContains: [
          { dayOfWeek: 3, token: 'bike' },
        ],
        expectVisibleNotContains: [
          { dayOfWeek: 3, token: 'rower' },
        ],
      },
    ],
  },

  // ── 7. Ambiguous command should clarify ──
  {
    name: 'Ambiguous "change conditioning" clarifies — does not mutate randomly',
    turns: [
      {
        user: 'Can you change conditioning?',
        // The router emits mode='clarify' (not mutate with needsClarification)
        // because the request has no actionable payload.
        expectRouterModeIn: ['clarify', 'mutate'],
        expectNeedsClarification: true,
      },
    ],
  },

  // ── 8. Explicit "last Monday" → past date, not silently mutated ──
  ...(MONDAY_IS_PAST ? [{
    name: 'Explicit "last Monday" targets past Monday — not auto-advanced',
    turns: [
      {
        user: 'Can you add cardio to last Monday?',
        expectTargetIsPast: true,
        expectTargetDow: 1,
        expectReplyNotContains: [
          'verified coach command path',
        ],
      },
    ],
  }] : []),
];

// ─── Main ───────────────────────────────────────────────────────────

console.log('============================================================');
console.log('COACH BEHAVIOUR REGRESSION HARNESS');
console.log(`Today: ${TODAY} (${SHORT[TODAY_DOW]}), Monday past: ${MONDAY_IS_PAST}`);
console.log('============================================================');

for (const scenario of scenarios) {
  try {
    runScenario(scenario);
  } catch (err) {
    fail++;
    const msg = `[Scenario] ${scenario.name} THREW: ${err instanceof Error ? err.message : String(err)}`;
    failures.push(msg);
    console.log(`  \u2717 ${msg}`);
    if (err instanceof Error && err.stack) {
      console.log(`      ${err.stack.split('\n').slice(1, 4).join('\n      ')}`);
    }
  }
}

// ─── Summary ────────────────────────────────────────────────────────

console.log(`\n\u2014 Summary \u2014`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);

if (failures.length > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
}

if (fail > 0) {
  console.log(`\nBEHAVIOUR REGRESSION: ${fail} scenario check(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${pass} checks passed.`);
  // Explicit exit — Zustand persist middleware fires an async
  // AsyncStorage write after the event loop drains. In Node.js
  // (no window.localStorage) that throws ReferenceError. Exiting
  // before the microtask fires keeps the process clean.
  process.exit(0);
}
