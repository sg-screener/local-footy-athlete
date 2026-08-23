import type { AsyncCoachLabCandidate, CoachLabResponseV1 } from './coachLab';
import { COACH_LAB_RESPONSE_SCHEMA_VERSION } from './coachLab';
import { serializeCoachSnapshotForModel } from './coachLabBrainPack';
import type { OpenAIResponseRequest, OpenAIResponseResult } from './openAIResponsesClient';

export const OPENAI_COACH_LAB_MODEL = 'gpt-5.6-sol';
export const OPENAI_COACH_LAB_PROMPT_VERSION = 'coach-lab-openai-v1';

export interface OpenAICoachLabClient {
  create(request: OpenAIResponseRequest): Promise<OpenAIResponseResult>;
}

function parseModelPayload(outputText: string): Omit<CoachLabResponseV1, 'schemaVersion' | 'diagnostics'> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error('Coach Lab model output was not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Coach Lab model output was not a response object.');
  }
  return parsed as Omit<CoachLabResponseV1, 'schemaVersion' | 'diagnostics'>;
}

export function createOpenAICoachLabCandidate(args: {
  readonly client: OpenAICoachLabClient;
  readonly instructions: string;
  readonly model?: string;
}): AsyncCoachLabCandidate {
  const model = args.model ?? OPENAI_COACH_LAB_MODEL;
  return {
    id: `openai:${model}`,
    async answer({ labCase, snapshot }) {
      const result = await args.client.create({
        model,
        instructions: args.instructions,
        input: JSON.stringify({
          athleteMessage: labCase.athleteMessage,
          reviewFocus: labCase.reviewFocus,
          requiresLiveProgramFacts: labCase.requiresLiveProgramFacts,
          currentAthleteSnapshot: JSON.parse(serializeCoachSnapshotForModel(snapshot)),
        }),
      });
      const payload = parseModelPayload(result.outputText);
      return {
        schemaVersion: COACH_LAB_RESPONSE_SCHEMA_VERSION,
        ...payload,
        diagnostics: {
          provider: 'openai',
          model,
          promptVersion: OPENAI_COACH_LAB_PROMPT_VERSION,
          tokenUse: result.totalTokens,
        },
      };
    },
  };
}
