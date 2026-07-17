import {
  observeRenderedAthleteActionOutcome,
  registerAthleteActionUIOutcome,
} from '../dev/e2e/athleteActionUIObservation';
import { stableTestIdToken } from './stableTestId';

export interface CoachFixtureReplyObservation {
  traceId: string;
  assistantId: string;
  observationId: string;
  controlId: string;
}

export function coachFixtureReplyControlId(assistantId: string): string {
  return `coach-fixture-reply-${stableTestIdToken(assistantId)}`;
}

export function registerCoachFixtureReply(args: {
  traceId: string;
  assistantId: string;
  resultCode: string;
  replyText: string;
}): CoachFixtureReplyObservation {
  const observation: CoachFixtureReplyObservation = {
    traceId: args.traceId,
    assistantId: args.assistantId,
    observationId: `coach-fixture-reply:${args.assistantId}`,
    controlId: coachFixtureReplyControlId(args.assistantId),
  };
  registerAthleteActionUIOutcome({
    traceId: observation.traceId,
    observationId: observation.observationId,
    controlId: observation.controlId,
    domainReturn: {
      assistantId: observation.assistantId,
      resultCode: args.resultCode,
      replyText: args.replyText,
    },
  });
  return observation;
}

/** Call only from the assistant bubble's post-commit React effect. */
export function observeCoachFixtureReply(args: {
  observation: CoachFixtureReplyObservation;
  renderedText: string;
}): void {
  observeRenderedAthleteActionOutcome({
    traceId: args.observation.traceId,
    observationId: args.observation.observationId,
    renderedText: args.renderedText,
    controlId: args.observation.controlId,
    accessibilityNode: {
      assistantId: args.observation.assistantId,
      testID: args.observation.controlId,
      accessibilityRole: 'text',
      accessibilityLabel: args.renderedText,
    },
  });
}
