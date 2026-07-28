/**
 * coachClarifierAdvanceTests — the Q7 multi-turn clarifier ADVANCE contract
 * (L10 run-3 Finding 2, escalation-approved redesign).
 *
 * The freeze this kills: "Add a session on Wednesday" (past) stores a
 * single-field targetDate clarifier; "Yes" resolves the date but the
 * add_session still lacks its add-type, the executor returns not-applied,
 * and the controller only clears/advances the pending on
 * `mutated && applied` — so the pending stays frozen as the ORIGINAL date
 * slot and every later reply re-emits the answered date question verbatim.
 *
 * Contract under test (owned multi-field transaction):
 *   A1  "Add a session on Wednesday" (past) → asks which-Wednesday.
 *   A2  "Yes" → ADVANCES to the add-type question. Never the date question
 *       again, never a bare "one more detail" freeze.
 *   A3  "An easy conditioning session" → applied through the owned add
 *       path OR an honest §18 refusal — never a re-ask.
 *   INV after a field is answered, no subsequent clarifier reply equals a
 *       previously-answered field's question.
 *   REG the exact reported transcript ("Yes" then "what detail") never
 *       reproduces the date question twice.
 *
 * Run: npm run test:coach-clarifier-advance
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  handleCoachTurn,
  type CoachTurnDebug,
  type CoachTurnMessage,
} from '../utils/coachTurnController';
import {
  usePendingCoachClarifierStore,
  getPendingClarifierSnapshot,
} from '../store/pendingCoachClarifierStore';
import { buildSmokeCoachBikeFlowProgram } from '../data/smokeCoachBikeFlowProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCoachContextStateStore } from '../store/coachContextStateStore';

// ─── Tiny harness ──────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}
function section(label: string) { console.log(`\n${label}`); }

// Friday — so "Wednesday" resolves to THIS week's (past) Wednesday.
const FIXED_TODAY = '2026-07-03';
const PAST_WEDNESDAY = '2026-07-01';
const NEXT_WEDNESDAY = '2026-07-08';

const DATE_QUESTION_RE = /is in the past\.\s*do you mean next wednesday/i;
const ADD_TYPE_QUESTION_RE = /what (?:would you like|should i|do you want) (?:me )?to add/i;
const ONE_MORE_DETAIL_RE = /one more detail|did not apply a candidate/i;

interface Turn {
  reply: string;
  debug: CoachTurnDebug | null;
  askedQuestion: string | null;
}

async function sendTurn(id: string, content: string): Promise<Turn> {
  const inputMessage: CoachTurnMessage = { id, role: 'user', content };
  const messages: CoachTurnMessage[] = [];
  let debug: CoachTurnDebug | null = null;
  await handleCoachTurn({
    userMessage: inputMessage,
    messages,
    todayISO: FIXED_TODAY,
    classifier: {
      classify: async () => ({
        status: 'classified' as const,
        provenance: 'deterministic' as const,
        intent: {
          intent: 'request_program_adjustment' as const,
          confidence: 1,
          needsClarification: false,
        },
      }),
    },
    pendingCoachProposal: null,
    pendingReadiness: null,
    pendingInjury: null,
    smokeCoachBikeFlow: false,
    isFocused: true,
    smokeWednesdayMissingReason: null,
    smokeWednesdayOpenTarget: null,
    setPendingCoachProposal: () => {},
    setPendingReadiness: () => {},
    appendUser: () => messages.push(inputMessage),
    appendAssistant: (message) => messages.push(message),
    appendUserAndAssistant: (message) => {
      messages.push(inputMessage, message);
    },
    clearInput: () => {},
    setIsLoading: () => {},
    setCoachProgressLabel: () => {},
    startSetupRebuildProgress: () => {},
    clearSetupRebuildProgress: () => {},
    setLastCoachDebug: (nextDebug) => {
      debug = nextDebug;
    },
  });
  const reply = messages.find((message) => message.role === 'assistant')?.content ?? '';
  return {
    reply,
    debug,
    askedQuestion: getPendingClarifierSnapshot()?.askedQuestion ?? null,
  };
}

function seed() {
  const program = buildSmokeCoachBikeFlowProgram(new Date(`${FIXED_TODAY}T12:00:00`)) as any;
  // The profile store was never seeded here. It went unnoticed while the two
  // capacity answers had silent defaults; Sam's 2026-07-28 ruling deleted them
  // (Bible Section 9: no default, no unknown tier), so an unseeded profile now
  // makes the coach refuse the turn rather than plan against a guessed tier.
  useProfileStore.setState({
    onboardingData: {
      seasonPhase: 'In-season', trainingDaysPerWeek: 5,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
      usualGameDay: 'Saturday', trainingLocation: 'Commercial gym', equipment: ['Full Gym'],
      experienceLevel: '2-5 years', conditioningLevel: 'Good',
      recentTrainingLoad: 'Very consistent', injuries: [],
    },
    isOnboardingComplete: true,
  } as never);
  useProgramStore.getState().clear();
  useProgramStore.getState().setCurrentProgram(program);
  useProgramStore.getState().setCurrentMicrocycle(program.microcycles[0]);
  useCoachContextStateStore.getState().clearCoachContext();
  usePendingCoachClarifierStore.getState().clearPending();
}

// ─── Scenario 1: the three-turn advance contract ───────────────────

async function runAdvanceScenario() {
  section('[A] Q7 add-session clarifier advances field by field');
  seed();

  const turn1 = await sendTurn('advance-1', 'Add a session on Wednesday');
  ok('A1.1 past-Wednesday add asks the which-Wednesday date question',
    DATE_QUESTION_RE.test(turn1.reply),
    JSON.stringify({ reply: turn1.reply, route: turn1.debug?.route }));
  const pending1 = getPendingClarifierSnapshot();
  ok('A1.2 a pending clarifier is stored for the add',
    !!pending1 && DATE_QUESTION_RE.test(pending1.askedQuestion),
    JSON.stringify({ operation: pending1?.operation, missingFields: pending1?.missingFields }));

  const turn2 = await sendTurn('advance-2', 'Yes');
  ok('A2.1 accepting next Wednesday advances to the add-type question',
    ADD_TYPE_QUESTION_RE.test(turn2.reply),
    JSON.stringify({ reply: turn2.reply, route: turn2.debug?.route }));
  ok('A2.2 the date question is never re-asked once answered',
    !DATE_QUESTION_RE.test(turn2.reply),
    turn2.reply);
  ok('A2.3 no bare "one more detail" freeze reply',
    !ONE_MORE_DETAIL_RE.test(turn2.reply),
    turn2.reply);
  const pending2 = getPendingClarifierSnapshot();
  ok('A2.4 the pending clarifier advanced off the answered date field',
    !!pending2 && !DATE_QUESTION_RE.test(pending2.askedQuestion),
    JSON.stringify({ askedQuestion: pending2?.askedQuestion, missingFields: pending2?.missingFields }));

  const turn3 = await sendTurn('advance-3', 'An easy conditioning session');
  const askedSoFar = [turn1.reply, turn2.reply];
  ok('A3.1 the add-type answer is never met with a re-ask of an answered field',
    askedSoFar.every((question) => question !== turn3.reply) &&
      !DATE_QUESTION_RE.test(turn3.reply),
    JSON.stringify({ reply: turn3.reply, route: turn3.debug?.route }));
  const overrides = useProgramStore.getState().dateOverrides ?? {};
  const weekOverlays = useProgramStore.getState().weekScopedOverlays ?? {};
  const applied = Object.keys(overrides).includes(NEXT_WEDNESDAY) ||
    JSON.stringify(weekOverlays).includes(NEXT_WEDNESDAY);
  const honestRefusal = /can['’]t|couldn['’]t|won['’]t|not (?:able|adding|going)/i.test(turn3.reply);
  ok('A3.2 the completed transaction either applies the add or refuses honestly',
    applied || honestRefusal,
    JSON.stringify({ reply: turn3.reply, overrideDates: Object.keys(overrides) }));

  // Invariant: once a field is answered, no later clarifier reply may equal
  // a previously-answered field's question.
  ok('INV.1 no clarifier reply after the date answer equals the date question',
    ![turn2, turn3].some((turn) => DATE_QUESTION_RE.test(turn.reply)),
    JSON.stringify({ turn2: turn2.reply, turn3: turn3.reply }));
  ok('INV.2 askedQuestion history never re-emits an answered field verbatim',
    ![turn2.askedQuestion, turn3.askedQuestion]
      .filter((question): question is string => !!question)
      .some((question) => question === turn1.askedQuestion),
    JSON.stringify({
      turn1: turn1.askedQuestion,
      turn2: turn2.askedQuestion,
      turn3: turn3.askedQuestion,
    }));
}

// ─── Scenario 2: the exact reported freeze transcript ──────────────

async function runReportedTranscriptRegression() {
  section('[REG] reported transcript: "Yes" then "what detail" never loops the date question');
  seed();

  const turn1 = await sendTurn('reg-1', 'Add a session on Wednesday');
  const turn2 = await sendTurn('reg-2', 'Yes');
  const turn3 = await sendTurn('reg-3', 'what detail');

  const replies = [turn1.reply, turn2.reply, turn3.reply];
  const dateQuestionCount = replies.filter((reply) => DATE_QUESTION_RE.test(reply)).length;
  ok('REG.1 the date question appears exactly once across the transcript',
    dateQuestionCount === 1,
    JSON.stringify(replies));
  ok('REG.2 "what detail" gets a concrete outstanding-field answer, not the frozen slot',
    !DATE_QUESTION_RE.test(turn3.reply) && turn3.reply.trim().length > 0,
    JSON.stringify({ reply: turn3.reply, route: turn3.debug?.route }));
}

// ─── Run ───────────────────────────────────────────────────────────

async function main() {
  await useProgramStore.persist.rehydrate();
  await runAdvanceScenario();
  await runReportedTranscriptRegression();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
