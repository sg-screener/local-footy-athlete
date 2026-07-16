/**
 * constraintResolutionTests — preserves the legacy detector's pure
 * classification fixtures while proving dispatcher mutation is bypassed.
 *
 * Live failure being regression-protected:
 *   • Legacy phrase detection remains pure compatibility documentation.
 *   • Dispatcher mutation through that path is retired; typed source-fact
 *     follow-up owns exact recovery and visible verification.
 *
 * The canonical semantic classifier + source-fact transaction now own
 * recovery before the synchronous dispatcher is reached.
 *
 * Run: npm run test:constraint-resolution
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const realLog = console.log;
console.log = (..._args: any[]) => {};

import {
  detectConstraintResolution,
  formatResolutionAmbiguityQuestion,
  formatResolutionSuccessReply,
  formatResolutionInactiveReply,
} from '../utils/constraintResolutionDetector';
import { dispatchCoachIntent } from '../utils/coachIntentDispatcher';
import type { DispatchDeps } from '../utils/coachIntentDispatcher';
import type {
  ActiveConstraint,
  ActiveFatigueConstraint,
  ActiveInjuryConstraint,
  ActiveSorenessConstraint,
} from '../store/coachUpdatesStore';
import type { CoachContextPacket, CoachIntent } from '../utils/coachIntent';

// ─── Harness ───
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    realLog(`  \u2713 ${name}`);
  } else {
    fail++;
    failures.push(name);
    realLog(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`);
  }
}
function section(label: string) {
  realLog(`\n${label}`);
}

// ─── Constraint factories ───
function fatigue(id = 'cf-1', severity = 5): ActiveFatigueConstraint {
  return {
    id,
    type: 'fatigue',
    severity,
    status: 'active',
    startDate: '2026-04-27T08:00:00Z',
    lastUpdatedAt: '2026-04-27T08:00:00Z',
    rules: [],
    safeFocus: [],
    advice: [],
  };
}

function injury(
  bodyPart: string,
  id = `ci-${bodyPart}`,
  severity = 7,
): ActiveInjuryConstraint {
  return {
    id,
    type: 'injury',
    bodyPart,
    bucket: 'hamstring' as any,
    severity,
    status: 'active',
    startDate: '2026-04-27T08:00:00Z',
    lastUpdatedAt: '2026-04-27T08:00:00Z',
    rules: [],
    safeFocus: [],
    advice: [],
  };
}

function soreness(
  bodyPart: string,
  id = `cs-${bodyPart}`,
  severity = 5,
): ActiveSorenessConstraint {
  return {
    id,
    type: 'soreness',
    bodyPart,
    bucket: 'lower_general' as any,
    severity,
    status: 'active',
    startDate: '2026-04-27T08:00:00Z',
    lastUpdatedAt: '2026-04-27T08:00:00Z',
    rules: [],
    safeFocus: [],
    advice: [],
  };
}

// ─── Dispatcher harness ───
interface MutationLog {
  resolutionApplied: Array<{ ids: string[] }>;
  nonInjuryConstraintApplied: Array<{ kind: string }>;
  uaeRuns: Array<{ bodyPart: string; severity: number }>;
}

function makeDeps(log: MutationLog, clearedRefs: ActiveConstraint[][]): DispatchDeps {
  return {
    runUAEForInjury(bodyPart, severity, _note) {
      log.uaeRuns.push({ bodyPart, severity });
      return `(uae stub for ${bodyPart} ${severity}/10)`;
    },
    runProgression(_outcome, current, _note) {
      return `(progression stub for ${current.bodyPart})`;
    },
    inspect(_query) {
      return { kind: 'no_match', message: '(inspect stub)' };
    },
    reapplyInjuryAtSeverity(_bp, _sev, _monday, _today) {
      return { applied: 0, visibleDiffDetected: false };
    },
    generalReply(_intent, _packet) {
      return '(general stub)';
    },
    applyNonInjuryConstraint(kind, _intent, _packet) {
      log.nonInjuryConstraintApplied.push({ kind });
      return { reply: '(non-injury stub)', mutated: true };
    },
    applyConstraintResolution(ids, _todayISO) {
      log.resolutionApplied.push({ ids });
      // Test harness returns the constraints the test pre-staged via
      // the clearedRefs back-channel so success reply rendering is
      // exercised end-to-end.
      const cleared = clearedRefs[0] ?? [];
      return { cleared };
    },
  };
}

function makePacket(
  userMessage: string,
  activeConstraints: ActiveConstraint[],
  overrides: Partial<CoachContextPacket> = {},
): CoachContextPacket {
  return {
    userMessage,
    recentMessages: [],
    activeInjury: null,
    activeConstraints,
    pendingInjury: null,
    coachUpdate: null,
    currentWeek: [],
    nextWeek: [],
    todayISO: '2026-04-29',
    ...overrides,
  };
}

function freshIntent(): CoachIntent {
  // Detector runs BEFORE classifier so this intent should never reach
  // the routing switch — but we still need a value to pass.
  return {
    intent: 'fatigue',
    confidence: 0.9,
    needsClarification: false,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 1. Detector — fatigue-specific phrases
// ─────────────────────────────────────────────────────────────────────
section('[1] detector — fatigue resolved phrases');
{
  const constraints: ActiveConstraint[] = [fatigue('cf-fat')];
  const cases = [
    'no fatigue anymore',
    'Update on how I\'m feeling: no fatigue anymore',
    'No I\'m fine - I have no fatigue',
    'not cooked anymore',
    'energy is back',
    'feeling fresh',
    'feel normal again',
    'fatigue is gone',
  ];
  for (const msg of cases) {
    const r = detectConstraintResolution(msg, constraints);
    ok(`"${msg}" → matched`, r.matched && !r.ambiguous, JSON.stringify(r));
    ok(`"${msg}" → kind=fatigue`, r.kind === 'fatigue');
    ok(
      `"${msg}" → resolves cf-fat`,
      r.constraintIdsToResolve.length === 1 && r.constraintIdsToResolve[0] === 'cf-fat',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// 2. Detector — injury / soreness body-part-specific phrases
// ─────────────────────────────────────────────────────────────────────
section('[2] detector — body-part resolved phrases');
{
  const constraints: ActiveConstraint[] = [injury('hammy', 'ci-hammy', 7)];
  const cases = [
    'hammy is fine now',
    'hammy cleared up',
    'hammy feels good again',
    'pain is gone in my hammy',
    'no more hammy pain',
    'my hammy feels great now',
  ];
  for (const msg of cases) {
    const r = detectConstraintResolution(msg, constraints);
    ok(`"${msg}" → matched`, r.matched && !r.ambiguous, JSON.stringify(r));
    ok(`"${msg}" → kind=injury`, r.kind === 'injury');
    ok(
      `"${msg}" → resolves ci-hammy`,
      r.constraintIdsToResolve.length === 1 && r.constraintIdsToResolve[0] === 'ci-hammy',
    );
  }

  // Soreness branch
  const sCons: ActiveConstraint[] = [soreness('quads', 'cs-quads', 4)];
  const r = detectConstraintResolution('quads not sore anymore', sCons);
  ok(
    'soreness phrase → kind=soreness, resolves cs-quads',
    r.matched && r.kind === 'soreness' && r.constraintIdsToResolve[0] === 'cs-quads',
  );
}

// ─────────────────────────────────────────────────────────────────────
// 3. Detector — explicit all-clear
// ─────────────────────────────────────────────────────────────────────
section('[3] detector — explicit all-clear is ambiguous across active facts');
{
  const constraints: ActiveConstraint[] = [
    fatigue('cf-1'),
    injury('hammy', 'ci-hammy'),
    soreness('shoulder', 'cs-shoulder'),
  ];
  const cases = [
    'all good now',
    'everything is fine',
    'clear all issues',
    'remove all flags',
  ];
  for (const msg of cases) {
    const r = detectConstraintResolution(msg, constraints);
    ok(`"${msg}" → matched, kind=all`, r.matched && r.kind === 'all', JSON.stringify(r));
    ok(
      `"${msg}" → resolves nothing until exact selection`,
      r.ambiguous && r.constraintIdsToResolve.length === 0 &&
        (r.candidates ?? []).length === 3,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. Detector — ambiguous generic phrase + multi-constraint
// ─────────────────────────────────────────────────────────────────────
section('[4] detector — ambiguous generic phrase asks question');
{
  const constraints: ActiveConstraint[] = [
    fatigue('cf-1'),
    injury('hammy', 'ci-hammy'),
    injury('shoulder', 'ci-shoulder'),
  ];
  const r = detectConstraintResolution("I'm fine now", constraints);
  ok(
    'ambiguous: matched=true, ambiguous=true',
    r.matched && r.ambiguous && r.kind === 'generic',
    JSON.stringify(r),
  );
  ok(
    'ambiguous: no ids resolved yet',
    r.constraintIdsToResolve.length === 0,
  );
  ok(
    'ambiguous: candidates list = all 3',
    (r.candidates ?? []).length === 3,
  );

  const question = formatResolutionAmbiguityQuestion(r.candidates ?? []);
  ok(
    'ambiguity question names fatigue + body parts',
    /fatigue/i.test(question) && /hammy/i.test(question) && /shoulder/i.test(question),
    question,
  );
  ok('ambiguity question requires one exact fact', /which exact one/i.test(question) &&
    !/all of them/i.test(question), question);

  // Single active constraint + generic phrase = NOT ambiguous, just resolves it.
  const singleResolution = detectConstraintResolution("I'm fine now", [fatigue('cf-only')]);
  ok(
    'single-constraint generic: not ambiguous, resolves the one',
    singleResolution.matched &&
      !singleResolution.ambiguous &&
      singleResolution.constraintIdsToResolve.length === 1,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 5. Detector — no resolution phrase → matched=false
// ─────────────────────────────────────────────────────────────────────
section('[5] detector — non-resolution messages pass through');
{
  const constraints: ActiveConstraint[] = [fatigue('cf-1')];
  const cases = [
    'I\'m feeling cooked again',
    'My hammy is sore',
    'Can you remove deadlifts',
    'Why is the program the same',
    '5/10',
  ];
  for (const msg of cases) {
    const r = detectConstraintResolution(msg, constraints);
    ok(`"${msg}" → matched=false`, !r.matched, JSON.stringify(r));
  }
}

// ─────────────────────────────────────────────────────────────────────
// 6. Detector — resolution phrase but no active constraint
// ─────────────────────────────────────────────────────────────────────
section('[6] detector — phrase fires with no matching active constraint');
{
  // Fatigue phrase, no active fatigue.
  const r1 = detectConstraintResolution('no fatigue anymore', [
    injury('hammy', 'ci-hammy'),
  ]);
  ok(
    'fatigue phrase + no active fatigue → matched, no ids, kind=fatigue',
    r1.matched && r1.constraintIdsToResolve.length === 0 && r1.kind === 'fatigue',
    JSON.stringify(r1),
  );

  // Body-part phrase, no matching constraint.
  const r2 = detectConstraintResolution('shoulder is fine now', [fatigue('cf-1')]);
  ok(
    'shoulder phrase + no shoulder constraint → matched, no ids',
    r2.matched && r2.constraintIdsToResolve.length === 0 && r2.bodyPart === 'shoulder',
    JSON.stringify(r2),
  );

  // Generic phrase, no active constraints.
  const r3 = detectConstraintResolution("I'm fine now", []);
  ok(
    'generic phrase + no active → matched, no ids',
    r3.matched && r3.constraintIdsToResolve.length === 0 && !r3.ambiguous,
    JSON.stringify(r3),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 7. Reply formatters
// ─────────────────────────────────────────────────────────────────────
section('[7] reply formatters');
{
  const successFat = formatResolutionSuccessReply([fatigue('cf-1')], 'fatigue');
  ok(
    'fatigue success: "I\'ve cleared the fatigue flag"',
    /cleared.*fatigue/i.test(successFat) && /back to normal/i.test(successFat),
    successFat,
  );

  const successHammy = formatResolutionSuccessReply([injury('hammy', 'ci-hammy')], 'injury');
  ok(
    'injury success: names "hammy"',
    /cleared.*hammy/i.test(successHammy),
    successHammy,
  );

  const successAll = formatResolutionSuccessReply(
    [fatigue('cf-1'), injury('hammy')],
    'all',
  );
  ok(
    'all-clear success names both',
    /fatigue/i.test(successAll) && /hammy/i.test(successAll),
    successAll,
  );

  const inactiveFat = formatResolutionInactiveReply('fatigue');
  ok(
    'inactive fatigue: "didn\'t have an active fatigue flag"',
    /didn'?t have an active fatigue/i.test(inactiveFat),
    inactiveFat,
  );

  const inactiveShoulder = formatResolutionInactiveReply('injury', 'shoulder');
  ok(
    'inactive shoulder: names body part',
    /shoulder/i.test(inactiveShoulder) && /didn'?t have/i.test(inactiveShoulder),
    inactiveShoulder,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 8. Dispatcher integration — fatigue resolved clears card + reply
// ─────────────────────────────────────────────────────────────────────
// Retired compatibility behaviour only. Canonical fact recovery is covered
// below and in temporarySourceFactTransactionTests.
if (false) {
section('[8] dispatcher — fatigue resolved clears constraint, no fatigue re-created');
{
  const log: MutationLog = {
    resolutionApplied: [],
    nonInjuryConstraintApplied: [],
    uaeRuns: [],
  };
  const cleared = [fatigue('cf-1')];
  const deps = makeDeps(log, [cleared]);

  const packet = makePacket('Update on how I\'m feeling: no fatigue anymore', [
    fatigue('cf-1'),
  ]);
  const outcome = dispatchCoachIntent(freshIntent(), packet, deps);

  ok('outcome.handled', outcome.handled);
  ok(
    'replyMode = constraint_resolution_applied',
    outcome.replyMode === 'constraint_resolution_applied',
    outcome.replyMode,
  );
  ok('mutated=true', outcome.mutated);
  ok(
    'applyConstraintResolution called with cf-1',
    log.resolutionApplied.length === 1 &&
      log.resolutionApplied[0].ids.length === 1 &&
      log.resolutionApplied[0].ids[0] === 'cf-1',
  );
  ok(
    'NO new fatigue constraint applied',
    log.nonInjuryConstraintApplied.length === 0,
  );
  ok('NO UAE run', log.uaeRuns.length === 0);
  ok(
    'reply names cleared fatigue',
    /cleared.*fatigue/i.test(outcome.reply) && /back to normal/i.test(outcome.reply),
    outcome.reply,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 9. Dispatcher integration — multi-constraint single clear (only target)
// ─────────────────────────────────────────────────────────────────────
section('[9] dispatcher — injury phrase requires typed episode resolution');
{
  const log: MutationLog = {
    resolutionApplied: [],
    nonInjuryConstraintApplied: [],
    uaeRuns: [],
  };
  // Athlete has fatigue + hammy, says only the hammy is good.
  const cleared = [injury('hammy', 'ci-hammy', 7)];
  const deps = makeDeps(log, [cleared]);

  const packet = makePacket('hammy is fine now', [
    fatigue('cf-fat'),
    injury('hammy', 'ci-hammy', 7),
  ]);
  const outcome = dispatchCoachIntent(freshIntent(), packet, deps);

  ok('outcome.handled', outcome.handled);
  ok(
    'replyMode = constraint_resolution_ambiguous',
    outcome.replyMode === 'constraint_resolution_ambiguous',
  );
  ok(
    'generic dispatcher resolves no injury id',
    log.resolutionApplied.length === 0,
  );
  ok(
    'reply directs the exact Injury resolved action',
    /Injury resolved/i.test(outcome.reply) && !/fatigue/i.test(outcome.reply),
    outcome.reply,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 10. Dispatcher integration — ambiguous resolution asks question
// ─────────────────────────────────────────────────────────────────────
section('[10] dispatcher — ambiguous resolution asks which to clear');
{
  const log: MutationLog = {
    resolutionApplied: [],
    nonInjuryConstraintApplied: [],
    uaeRuns: [],
  };
  const deps = makeDeps(log, [[]]);

  const packet = makePacket("I'm fine now", [
    fatigue('cf-fat'),
    injury('hammy', 'ci-hammy'),
    injury('shoulder', 'ci-shoulder'),
  ]);
  const outcome = dispatchCoachIntent(freshIntent(), packet, deps);

  ok('outcome.handled', outcome.handled);
  ok(
    'replyMode = constraint_resolution_ambiguous',
    outcome.replyMode === 'constraint_resolution_ambiguous',
    outcome.replyMode,
  );
  ok('mutated=false', !outcome.mutated);
  ok(
    'NO resolution applied (waits for athlete reply)',
    log.resolutionApplied.length === 0,
  );
  ok(
    'reply asks which to clear, lists all options',
    /which exact one/i.test(outcome.reply) &&
      /fatigue/i.test(outcome.reply) &&
      /hammy/i.test(outcome.reply) &&
      /shoulder/i.test(outcome.reply) &&
      !/all of them/i.test(outcome.reply),
    outcome.reply,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 11. Dispatcher integration — explicit all-clear wipes every constraint
// ─────────────────────────────────────────────────────────────────────
section('[11] dispatcher — explicit all-clear clarifies and preserves every fact');
{
  const log: MutationLog = {
    resolutionApplied: [],
    nonInjuryConstraintApplied: [],
    uaeRuns: [],
  };
  const all: ActiveConstraint[] = [
    fatigue('cf-fat'),
    injury('hammy', 'ci-hammy'),
    injury('shoulder', 'ci-shoulder'),
  ];
  const deps = makeDeps(log, [all]);

  const packet = makePacket('all good now', all);
  const outcome = dispatchCoachIntent(freshIntent(), packet, deps);

  ok('outcome.handled', outcome.handled);
  ok(
    'replyMode = constraint_resolution_ambiguous',
    outcome.replyMode === 'constraint_resolution_ambiguous',
  );
  ok(
    'no ids resolved',
    log.resolutionApplied.length === 0,
  );
  ok(
    'reply names all three facts without offering bulk clear',
    /fatigue/i.test(outcome.reply) &&
      /hammy/i.test(outcome.reply) &&
      /shoulder/i.test(outcome.reply) &&
      !/all of them/i.test(outcome.reply),
    outcome.reply,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 12. Dispatcher integration — pending clarification beats resolution
// ─────────────────────────────────────────────────────────────────────
section('[12] dispatcher — pending clarification still wins over resolution');
{
  const log: MutationLog = {
    resolutionApplied: [],
    nonInjuryConstraintApplied: [],
    uaeRuns: [],
  };
  const deps = makeDeps(log, [[]]);

  // Pending injury context is set ("how bad is it?") and the athlete
  // replies. The detector MUST NOT intercept this — pending clarifier
  // takes priority. But the detector also doesn't match a bare "9/10"
  // anyway, so the dispatch flows to the severity_reply route.
  const packet = makePacket('9/10', [], {
    pendingInjury: { bodyPart: 'shoulder', timestamp: Date.now() },
  });
  const intent: CoachIntent = {
    intent: 'injury_severity_reply',
    confidence: 0.95,
    needsClarification: false,
    payload: { bodyPart: 'shoulder', severity: 9 },
  };
  const outcome = dispatchCoachIntent(intent, packet, deps);

  ok(
    'pending clarifier route honoured (not constraint resolution)',
    outcome.replyMode !== 'constraint_resolution_applied' &&
      outcome.replyMode !== 'constraint_resolution_ambiguous',
    outcome.replyMode,
  );
  ok(
    'NO resolution applied',
    log.resolutionApplied.length === 0,
  );
  ok('UAE was run', log.uaeRuns.length === 1 && log.uaeRuns[0].bodyPart === 'shoulder');
}

// ─────────────────────────────────────────────────────────────────────
// 13. Dispatcher integration — phrase but no matching constraint
// ─────────────────────────────────────────────────────────────────────
section('[13] dispatcher — phrase but nothing to clear → honest reply');
{
  const log: MutationLog = {
    resolutionApplied: [],
    nonInjuryConstraintApplied: [],
    uaeRuns: [],
  };
  const deps = makeDeps(log, [[]]);

  const packet = makePacket('no fatigue anymore', []);
  const outcome = dispatchCoachIntent(freshIntent(), packet, deps);

  ok('outcome.handled', outcome.handled);
  ok(
    'replyMode = constraint_resolution_no_match',
    outcome.replyMode === 'constraint_resolution_no_match',
    outcome.replyMode,
  );
  ok('mutated=false', !outcome.mutated);
  ok(
    'reply: "didn\'t have an active fatigue flag"',
    /didn'?t have an active fatigue/i.test(outcome.reply),
    outcome.reply,
  );
  ok(
    'NO new fatigue constraint created',
    log.nonInjuryConstraintApplied.length === 0,
  );
}

// ─────────────────────────────────────────────────────────────────────
}

section('[8] dispatcher — phrase resolution compatibility path is bypassed');
{
  const log: MutationLog = {
    resolutionApplied: [],
    nonInjuryConstraintApplied: [],
    uaeRuns: [],
  };
  const outcome = dispatchCoachIntent(
    freshIntent(),
    makePacket('back to normal', [fatigue('cf-retired')]),
    makeDeps(log, [[]]),
  );
  ok('legacy phrase resolver performs no mutation',
    !outcome.mutated && log.resolutionApplied.length === 0);
  ok('fact-shaped intent fails closed at the canonical async boundary',
    outcome.replyMode === 'source_fact_transaction_required', outcome.replyMode);
}

// Done
// ─────────────────────────────────────────────────────────────────────
realLog(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  realLog(`\nFailures:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
