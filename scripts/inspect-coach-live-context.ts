/**
 * inspect-coach-live-context.ts
 *
 * Diagnostic script — mirror the live CoachScreen handleSend flow for the
 * three coach-bike-flow turns and dump the EXACT context the router sees
 * at each step. Goal: find why turn 2 ("Can you change to a bike?")
 * raises a clarifier in the live app even though the pipeline test
 * (smokeCoachBikeFlowTests.ts) auto-binds it to Wednesday.
 *
 * Run: npx sucrase-node scripts/inspect-coach-live-context.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = true;

import { runSmokeBootstrap, __resetSmokeBootstrapForTest } from '../src/utils/smokeBootstrap';
import { buildCoachContextPacket } from '../src/utils/coachContextPacket';
import {
  routeCoachCommand,
  isMutateCommand,
} from '../src/utils/coachCommandRouter';
import { dispatchCoachIntent } from '../src/utils/coachIntentDispatcher';
import { buildLiveDispatchDeps } from '../src/utils/coachDispatchDeps';
import { executeCoachCommand } from '../src/utils/coachCommandExecutor';
import { parseModalitySwapRequest } from '../src/utils/coachModalitySwap';
import { orchestrateModalitySwap } from '../src/utils/coachModalitySwapOrchestrator';
import {
  useCoachContextStateStore,
  getCoachContextSnapshot,
} from '../src/store/coachContextStateStore';
import { extractModalitiesFromSession, isMutationLike } from '../src/utils/coachReferenceResolver';
import type { CoachIntent } from '../src/utils/coachIntent';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function header(label: string) {
  console.log('\n' + '='.repeat(72));
  console.log(label);
  console.log('='.repeat(72));
}

function dumpPacket(label: string, packet: any) {
  console.log(`\n--- ${label} ---`);
  console.log('userMessage:', JSON.stringify(packet.userMessage));
  console.log('todayISO:', packet.todayISO);
  console.log('currentWeek.length:', packet.currentWeek?.length ?? 0);
  for (const d of packet.currentWeek ?? []) {
    if (d.workout) {
      console.log(`  ${d.date} dow=${d.dayOfWeek} short=${d.short} name="${d.workout.name}" type=${(d.workout as any).workoutType ?? '-'} desc="${(d.workout.description ?? '').slice(0, 60)}"`);
      const exes = d.workout.exercises ?? [];
      for (const ex of exes) {
        console.log(`    - exercise.name="${ex.exercise?.name}" notes="${(ex.notes ?? '').slice(0, 60)}"`);
      }
    }
  }
  console.log('lastOpenedWorkout:', JSON.stringify(packet.lastOpenedWorkout));
  console.log('lastExplainedSession:', JSON.stringify(packet.lastExplainedSession));
  console.log('lastDiscussedWorkout:', JSON.stringify(packet.lastDiscussedWorkout));
  console.log('referenceResolution:', JSON.stringify(packet.referenceResolution, null, 2));
}

async function main() {
  header('Stage 0: clean slate + smoke bootstrap');
  __resetSmokeBootstrapForTest();
  useCoachContextStateStore.getState().clearCoachContext();
  await runSmokeBootstrap({ flow: 'coach-bike-flow' });

  const today = todayISO();
  const deps = buildLiveDispatchDeps(today);

  // ── Turn 1 ────────────────────────────────────────────────────────
  header('Turn 1: "Why is there a mid week row?"');
  const turn1Msg = 'Why is there a mid week row?';
  const turn1Packet = buildCoachContextPacket({
    userMessage: turn1Msg,
    recentMessages: [],
    todayISO: today,
    pendingInjury: null,
    pendingCoachProposal: null,
  });
  dumpPacket('Turn 1 packet', turn1Packet);
  console.log('isMutationLike("' + turn1Msg + '") =', isMutationLike(turn1Msg));

  const turn1Cmd = routeCoachCommand({
    userMessage: turn1Msg,
    todayISO: today,
    referenceResolution: turn1Packet.referenceResolution ?? null,
  });
  console.log('\nrouteCoachCommand mode =', turn1Cmd.mode);
  console.log('routeCoachCommand =', JSON.stringify(turn1Cmd, null, 2));
  console.log('isMutateCommand =', isMutateCommand(turn1Cmd));

  const turn1Intent: CoachIntent = {
    intent: 'general_question',
    confidence: 0,
    needsClarification: false,
    rationale: 'router_bypass',
  };
  const turn1Outcome = await dispatchCoachIntent(turn1Intent, turn1Packet, deps);
  console.log('\ndispatcher outcome.handled =', turn1Outcome.handled);
  console.log('dispatcher outcome.replyMode =', turn1Outcome.replyMode);
  console.log('dispatcher outcome.referencedSession =', JSON.stringify(turn1Outcome.referencedSession));
  console.log('dispatcher outcome.reply =', JSON.stringify((turn1Outcome.reply ?? '').slice(0, 200)));

  // Mirror CoachScreen line 1774: write lastExplainedSession after the
  // dispatcher returns a referencedSession.
  if (turn1Outcome.referencedSession) {
    const day = turn1Packet.currentWeek.find(
      (d: any) => d.date === turn1Outcome.referencedSession!.date,
    );
    const modalities = day?.workout
      ? extractModalitiesFromSession({
          name: day.workout.name,
          exercises: day.workout.exercises,
        })
      : undefined;
    useCoachContextStateStore.getState().setLastExplainedSession({
      date: turn1Outcome.referencedSession.date,
      sessionName: turn1Outcome.referencedSession.sessionName,
      modalities,
      source: 'coach_explanation',
    });
    console.log(
      '\nsetLastExplainedSession called with date=' +
        turn1Outcome.referencedSession.date +
        ' sessionName="' +
        turn1Outcome.referencedSession.sessionName +
        '" modalities=' +
        JSON.stringify(modalities),
    );
  } else {
    console.log('\n!! dispatcher did NOT return a referencedSession — lastExplainedSession remains null !!');
  }

  console.log('\nctx after turn 1 =', JSON.stringify(getCoachContextSnapshot(), null, 2));

  // ── Turn 2 ────────────────────────────────────────────────────────
  header('Turn 2: "Can you change to a bike?"');
  const turn2Msg = 'Can you change to a bike?';
  const turn2Packet = buildCoachContextPacket({
    userMessage: turn2Msg,
    recentMessages: [
      { role: 'user', content: turn1Msg },
      { role: 'assistant', content: turn1Outcome.reply ?? '' },
    ],
    todayISO: today,
    pendingInjury: null,
    pendingCoachProposal: null,
  });
  dumpPacket('Turn 2 packet', turn2Packet);
  console.log('isMutationLike("' + turn2Msg + '") =', isMutationLike(turn2Msg));

  const turn2Cmd = routeCoachCommand({
    userMessage: turn2Msg,
    todayISO: today,
    referenceResolution: turn2Packet.referenceResolution ?? null,
  });
  console.log('\nrouteCoachCommand mode =', turn2Cmd.mode);
  console.log('routeCoachCommand =', JSON.stringify(turn2Cmd, null, 2));
  console.log('isMutateCommand =', isMutateCommand(turn2Cmd));
  if (turn2Cmd.mode === 'mutate') {
    console.log('mutate.operation =', turn2Cmd.operation);
    console.log('mutate.needsClarification =', turn2Cmd.needsClarification);
    console.log('mutate.clarificationQuestion =', turn2Cmd.clarificationQuestion ?? null);
    console.log('mutate.target =', JSON.stringify(turn2Cmd.target));
    console.log('mutate.missingFields =', JSON.stringify(turn2Cmd.missingFields));
  }

  // ── Orchestrator-layer inspection ──────────────────────────────
  header('Turn 2: parseModalitySwapRequest("Can you change to a bike?")');
  const parse = parseModalitySwapRequest(turn2Msg);
  console.log('parse =', JSON.stringify(parse, null, 2));

  header('Turn 2: orchestrateModalitySwap()');
  const orchestratorOutcome = orchestrateModalitySwap({
    userMessage: turn2Msg,
    todayISO: today,
    referenceResolution: turn2Packet.referenceResolution ?? null,
  });
  console.log('outcome.kind =', orchestratorOutcome.kind);
  console.log('outcome.route =', orchestratorOutcome.route);
  console.log('outcome.applied =', orchestratorOutcome.applied);
  console.log('outcome.referenceStatus =', orchestratorOutcome.referenceStatus);
  console.log('outcome.targetDate =', (orchestratorOutcome as any).targetDate ?? null);
  console.log('outcome.targetSessionName =', (orchestratorOutcome as any).targetSessionName ?? null);
  console.log('outcome.toModality =', (orchestratorOutcome as any).toModality ?? null);
  console.log('outcome.fromModality =', (orchestratorOutcome as any).fromModality ?? null);
  console.log('outcome.reply =', JSON.stringify(orchestratorOutcome.reply));

  // ── Executor-layer inspection ──────────────────────────────────
  header('Turn 2: executeCoachCommand()');
  if (turn2Cmd.mode === 'mutate') {
    const exec = executeCoachCommand({
      command: turn2Cmd,
      todayISO: today,
      referenceResolution: turn2Packet.referenceResolution ?? null,
      userMessage: turn2Msg,
    });
    console.log('executor.kind =', exec.kind);
    console.log('executor.applied =', exec.applied);
    console.log('executor.route =', exec.route);
    console.log('executor.reply =', JSON.stringify(exec.reply));
    if ((exec as any).modalityOutcome) {
      console.log(
        'executor.modalityOutcome.kind =',
        (exec as any).modalityOutcome.kind,
      );
      console.log(
        'executor.modalityOutcome.route =',
        (exec as any).modalityOutcome.route,
      );
    }
  } else {
    console.log('!! turn2Cmd.mode is not "mutate" — skipping executeCoachCommand !!');
    console.log('turn2Cmd.mode =', turn2Cmd.mode);
  }

  console.log('\nctx after turn 2 =', JSON.stringify(getCoachContextSnapshot(), null, 2));
}

main().catch((err) => {
  console.error('Diagnostic crashed:', err);
  process.exit(1);
});
