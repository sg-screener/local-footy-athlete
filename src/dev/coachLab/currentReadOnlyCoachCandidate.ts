import { coachAnswer } from '../../rules/coachAnswer';
import { lexicalQuestionReader } from '../../rules/coachQuestion';
import type {
  CoachLabCandidate,
  CoachLabResponseV1,
} from './coachLab';

function answerMode(verdict: ReturnType<typeof coachAnswer>['verdict']): CoachLabResponseV1['answerMode'] {
  if (verdict === 'answered') return 'answer';
  if (verdict === 'no_rule') return 'generic_refusal';
  return 'honest_limit';
}

/**
 * The living deterministic Q&A path, adapted without changing it. This is the
 * honest before picture the future conversational candidates must beat.
 */
export const currentReadOnlyCoachCandidate: CoachLabCandidate = {
  id: 'current-read-only-coach',
  answer({ labCase, snapshot }) {
    const question = lexicalQuestionReader.read({
      message: labCase.athleteMessage,
      week: snapshot.visibleWeek,
      todayISO: snapshot.asOfDateISO,
    });
    const answer = coachAnswer({
      question,
      week: snapshot.visibleWeek,
      todayISO: snapshot.asOfDateISO,
    });
    const usedVisibleWeek = answer.grounds.dates.length > 0
      || answer.grounds.usedProjectionNames.length > 0;

    return {
      schemaVersion: 1,
      message: answer.text,
      answerMode: answerMode(answer.verdict),
      basis: usedVisibleWeek ? ['athlete_snapshot'] : [],
      snapshotFieldsUsed: usedVisibleWeek ? ['visibleWeek'] : [],
      knowledgeSources: [],
      judgementLabel: 'not_needed',
      programActions: [],
      diagnostics: {
        provider: 'deterministic',
        model: 'current-read-only-coach',
        promptVersion: 'none',
        tokenUse: 0,
      },
    };
  },
};
