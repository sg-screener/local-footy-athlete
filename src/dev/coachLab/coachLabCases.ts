import {
  buildCoachSnapshot,
  type CoachSnapshot,
} from '../../rules/liveAthleteSnapshot';
import type { JournalLoadModel } from '../../rules/journalLoad';
import type { JournalWeek } from '../../rules/journalWeek';
import type { SignedCopy } from '../../rules/signedCopy';
import type {
  VisibleDay,
  VisibleDayKind,
  VisibleWeek,
} from '../../rules/visibleProjection';
import type { CoachLabCase } from './coachLab';

const PENDING = {
  status: 'pending',
  idealAnswer: null,
  correctionReason: null,
  approvedModel: null,
  approvedPromptVersion: null,
} as const;

export const ROOTED_SOL_APPROVED_ANSWER = 'Don’t skip automatically. For today’s Lower Squat, warm up and reassess, then reduce the lower-body volume and avoid extra sets or grinders. Keep the main lift only if you’re moving well; otherwise use recovery or unaffected work. That’s sensible with low energy, moderate soreness, team training tomorrow and Saturday’s game. I can’t alter the plan here. If this is pain rather than ordinary soreness, stop the affected work and see a physio.';

/**
 * The first ten questions come from the messy-language examples in Sam's Coach
 * redesign brief. They are evaluation inputs; approval is bound to an exact
 * answer/model/prompt tape, never inherited by a competing response.
 */
export const COACH_LAB_CASES: readonly CoachLabCase[] = [
  {
    id: 'program-thursday-messy',
    athleteMessage: 'whats on thurs',
    source: 'coach-redesign-brief-2026-08-24',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality', 'voice'],
    ownerReview: PENDING,
  },
  {
    id: 'next-game-messy',
    athleteMessage: 'when we playing this week',
    source: 'coach-redesign-brief-2026-08-24',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality', 'voice'],
    ownerReview: PENDING,
  },
  {
    id: 'rooted-but-wants-to-train',
    athleteMessage: 'legs are rooted but dont wanna skip',
    source: 'coach-redesign-brief-2026-08-24',
    requiresLiveProgramFacts: true,
    reviewFocus: ['coaching_quality', 'lfa_consistency', 'judgement_transparency', 'medical_safety', 'voice'],
    ownerReview: {
      status: 'approved',
      idealAnswer: ROOTED_SOL_APPROVED_ANSWER,
      correctionReason: null,
      approvedModel: 'gpt-5.6-sol',
      approvedPromptVersion: 'coach-lab-openai-v2-retrieval',
    },
  },
  {
    id: 'painful-shoulder-alternative',
    athleteMessage: 'shoulder doesnt like this. what can i do thats basically the same',
    source: 'coach-redesign-brief-2026-08-24',
    requiresLiveProgramFacts: true,
    reviewFocus: ['coaching_quality', 'program_factuality', 'medical_safety', 'voice'],
    ownerReview: PENDING,
  },
  {
    id: 'missing-machine',
    athleteMessage: 'dont have that machine',
    source: 'coach-redesign-brief-2026-08-24',
    requiresLiveProgramFacts: true,
    reviewFocus: ['coaching_quality', 'program_factuality', 'voice'],
    ownerReview: PENDING,
  },
  {
    id: 'missed-monday-cram-wednesday',
    athleteMessage: 'missed monday. cram it weds?',
    source: 'coach-redesign-brief-2026-08-24',
    requiresLiveProgramFacts: true,
    reviewFocus: ['coaching_quality', 'program_factuality', 'lfa_consistency', 'voice'],
    ownerReview: PENDING,
  },
  {
    id: 'after-footy-why',
    athleteMessage: 'why tf have i got this after footy',
    source: 'coach-redesign-brief-2026-08-24',
    requiresLiveProgramFacts: true,
    reviewFocus: ['coaching_quality', 'program_factuality', 'lfa_consistency', 'voice'],
    ownerReview: PENDING,
  },
  {
    id: 'strength-loss-concern',
    athleteMessage: 'am i losing strength doing this',
    source: 'coach-redesign-brief-2026-08-24',
    requiresLiveProgramFacts: true,
    reviewFocus: ['coaching_quality', 'program_factuality', 'judgement_transparency', 'voice'],
    ownerReview: PENDING,
  },
  {
    id: 'flat-deload-question',
    athleteMessage: 'feel flat. do i need a deload?',
    source: 'coach-redesign-brief-2026-08-24',
    requiresLiveProgramFacts: true,
    reviewFocus: ['coaching_quality', 'lfa_consistency', 'judgement_transparency', 'medical_safety', 'voice'],
    ownerReview: PENDING,
  },
  {
    id: 'knee-bottom-range-follow-up',
    athleteMessage: 'knee is sore mostly when i get near the bottom',
    source: 'coach-redesign-brief-2026-08-24',
    requiresLiveProgramFacts: false,
    reviewFocus: ['coaching_quality', 'judgement_transparency', 'medical_safety', 'voice'],
    ownerReview: PENDING,
  },
];

const signed = (text: string) => text as SignedCopy;

function day(
  date: string,
  kind: VisibleDayKind,
  parts: readonly string[],
): VisibleDay {
  return {
    date,
    kind,
    headline: signed(kind === 'game' ? 'Game Day' : kind === 'rest' ? 'Rest Day' : 'Training Day'),
    parts: parts.map((headline, index) => ({
      id: `${date}-part-${index}`,
      kind: 'strength',
      headline: signed(headline),
      bucket: signed('Strength'),
      detail: null,
      rows: [],
      capabilities: {
        canSwap: false,
        canMove: false,
        canRemove: false,
        canEditRows: false,
      },
      countsTowardLoad: true,
    })),
    gaps: [],
    capabilities: {
      canAdd: false,
      canMoveWholeDay: false,
      canRemoveWholeDay: false,
      refusal: null,
    },
    owner: 'plan',
  };
}

/**
 * One Saturday game, low-energy readiness recorded. `readiness: 'not_recorded'`
 * is the same world with no check-in — the state Sam's device was in when the
 * Coach invented a tier (F14, 2026-09-09).
 */
export function coachLabFixtureSnapshot(
  options: { readonly readiness?: 'reported' | 'not_recorded' } = {},
): CoachSnapshot {
  const weekStart = '2026-08-24';
  const visibleWeek: VisibleWeek = {
    weekStart,
    days: [
      day('2026-08-24', 'training', ['Lower Squat']),
      day('2026-08-25', 'training', ['Team Training']),
      day('2026-08-26', 'rest', []),
      day('2026-08-27', 'training', ['Upper Push', 'Conditioning']),
      day('2026-08-28', 'rest', []),
      day('2026-08-29', 'game', []),
      day('2026-08-30', 'rest', []),
    ],
    explanations: [],
  };
  const journalWeek = {
    weekStart,
    days: [],
    work: {
      sessionsPlanned: 4,
      completedFull: 2,
      completedPartial: 0,
      skipped: 0,
      notAnswered: 2,
      missingReasons: 0,
    },
    load: { thisWeek: 2, comparison: null, comparisonAvailable: true },
    felt: {
      feelingsRecorded: 1,
      sorenessRecorded: 1,
      gameFeelsRecorded: 0,
      gameFeelLatest: null,
      differedFromPlan: 0,
      nothingRecorded: false,
    },
    kinds: {
      strength: 2,
      conditioning: 1,
      sprint: 0,
      teamTraining: 1,
      games: 1,
      recovery: 0,
    },
    dataState: 'load_ready',
  } as JournalWeek;
  const loadModel = {
    weekStart,
    headline: { value: { ratio: 1.08, band: 'in' }, provenance: 'signed' },
    sweetSpotBand: { value: { low: 0.8, high: 1.3 }, provenance: 'signed' },
    coverage: {
      value: { sessionsMeasured: 2, sessionsPlanned: 4, liftsUnmeasured: 0 },
      provenance: 'signed',
    },
  } as unknown as JournalLoadModel;

  return buildCoachSnapshot({
    asOfDateISO: '2026-08-24',
    visibleWeek,
    journalWeek,
    loadModel,
    strengthLifts: [{
      exerciseName: 'Back Squat',
      thisWeek: { weightKg: 100, reps: 5 },
      lastWeek: { weightKg: 95, reps: 5 },
      direction: 'up',
    }],
    strengthHistory: [{
      exerciseName: 'Back Squat',
      points: [
        { weekStart: '2026-08-17', topSet: { weightKg: 95, reps: 5 } },
        { weekStart, topSet: { weightKg: 100, reps: 5 } },
      ],
    }],
    twoKmTimeTrial: {
      seconds: 420,
      recordedOn: '2026-08-24',
      source: 'profile_edit',
    },
    readinessSignal: options.readiness === 'not_recorded' ? null : {
      date: '2026-08-24',
      energy: 'low',
      soreness: 'moderate',
      source: 'quick_check',
      updatedAt: '2026-08-24T08:00:00.000Z',
    },
    activeModifiers: [],
  });
}
