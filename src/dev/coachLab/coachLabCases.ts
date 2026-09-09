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
  // Slice S1 bench (R-397, 2026-09-10): where the athlete is in the year,
  // what comes next, and the fourteen days they recorded. PENDING until Sam's
  // recorded review, like every case before it.
  {
    id: 's1-phase',
    athleteMessage: 'what phase am i in',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality', 'voice'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    ownerReview: {
      status: 'approved',
      idealAnswer: 'You’re in-season: build week, week 6 of the phase and week 2 of block 2. You’ve got a game this Saturday, so the priority is maintaining strength and fitness while staying fresh for it.',
      correctionReason: null,
      approvedModel: 'gpt-5.6-terra',
      approvedPromptVersion: 'coach-lab-openai-v4-situation',
    },
  },
  {
    id: 's1-block-week',
    athleteMessage: 'what block and week is this',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality', 'voice'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    ownerReview: {
      status: 'approved',
      idealAnswer: 'This is In-season, build week: Block 2, Week 2. It’s Phase Week 6 and not a deload week.',
      correctionReason: null,
      approvedModel: 'gpt-5.6-terra',
      approvedPromptVersion: 'coach-lab-openai-v4-situation',
    },
  },
  {
    id: 's1-deload',
    athleteMessage: 'is this a deload week',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality', 'lfa_consistency'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    ownerReview: {
      status: 'approved',
      idealAnswer: 'No — this is not a deload week. It’s marked as an in-season build week, with the deload flag off. Today’s quick check shows low energy, but there’s no active program modifier visible. Use that as a cue to keep today’s lower session controlled; if you feel flatter once you start, back off volume or intensity rather than forcing it.',
      correctionReason: null,
      approvedModel: 'gpt-5.6-terra',
      approvedPromptVersion: 'coach-lab-openai-v4-situation',
    },
  },
  {
    id: 's1-next-week',
    athleteMessage: 'whats next week look like',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality', 'voice'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    // 2026-09-10: the tape Sam approved for this row was recorded BEFORE the
    // fixture had a next week ("I can only see this week…"), so it is not the
    // ideal. Real answer, same day: "Next week is set around your Saturday
    // game: Lower Hinge on Monday, team training Tuesday, rest Wednesday,
    // Upper Pull plus conditioning Thursday, rest Friday, game Saturday, then
    // rest Sunday…" — PENDING until Sam approves those words.
    ownerReview: PENDING,
  },
  {
    id: 's1-next-game',
    athleteMessage: 'when is my next game after this one',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    ownerReview: {
      status: 'approved',
      idealAnswer: 'After this Saturday’s game, your next game is Saturday 5 September.',
      correctionReason: null,
      approvedModel: 'gpt-5.6-terra',
      approvedPromptVersion: 'coach-lab-openai-v4-situation',
    },
  },
  {
    id: 's1-club-nights',
    athleteMessage: 'what nights do i train with the club',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    ownerReview: {
      status: 'approved',
      idealAnswer: 'You train with the club on Tuesday nights. This week’s Tuesday session is Team Training.',
      correctionReason: null,
      approvedModel: 'gpt-5.6-terra',
      approvedPromptVersion: 'coach-lab-openai-v4-situation',
    },
  },
  {
    id: 's1-nordic-swap-in-season',
    athleteMessage: 'can i do leg curls instead of nordics',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['lfa_consistency', 'coaching_quality', 'program_factuality'],
    // Left PENDING on 2026-09-10: the recorded answer ("yes") contradicts
    // R-394 (in season a curl does not replace the Nordic), so it cannot be
    // the ideal. Re-taped after slice S2 (retrieval), then reviewed.
    ownerReview: PENDING,
  },
  {
    id: 's1-flat-all-week',
    athleteMessage: 'ive been flat all week whats going on',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['coaching_quality', 'program_factuality', 'medical_safety'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    ownerReview: {
      status: 'approved',
      idealAnswer: 'You’ve recorded low energy and moderate soreness today, so being flat may reflect normal accumulated load rather than anything specific we can pin down. Your measured load is still in the target band (1.08), and you completed Thursday’s session and Saturday’s game. For today’s Lower Squat, keep the main work only if you’re moving well; trim volume and skip any finisher. If the flatness persists or worsens through the week, use the readiness check so the week can be reduced.',
      correctionReason: null,
      approvedModel: 'gpt-5.6-terra',
      approvedPromptVersion: 'coach-lab-openai-v4-situation',
    },
  },
  {
    id: 's1-last-week',
    athleteMessage: 'how did i go last week',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality', 'voice'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    ownerReview: {
      status: 'approved',
      idealAnswer: 'I can see two full sessions from last week: Thursday felt good, then Saturday was hard. That’s solid work, but there’s no full weekly completion or load summary here, so I can’t fairly score the whole week. Your load is currently in the target range, and your Back Squat has moved from 95 kg to 100 kg for 5 reps this week.',
      correctionReason: null,
      approvedModel: 'gpt-5.6-terra',
      approvedPromptVersion: 'coach-lab-openai-v4-situation',
    },
  },
  {
    id: 's1-why-changed',
    athleteMessage: 'why did my week change',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality', 'voice'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    ownerReview: {
      status: 'approved',
      idealAnswer: 'Nothing in the current snapshot shows a recorded program change or a visible modifier. Your week is set around Tuesday team training and the Saturday game: lower today, upper plus conditioning Thursday, with rest Wednesday, Friday and Sunday to protect freshness. Today’s quick check recorded low energy and moderate soreness, but it is a today-only observation and hasn’t produced a visible change. If you meant a specific session or exercise, which one changed?',
      correctionReason: null,
      approvedModel: 'gpt-5.6-terra',
      approvedPromptVersion: 'coach-lab-openai-v4-situation',
    },
  },
  {
    id: 's1-one-rm',
    athleteMessage: 'whats my squat 1rm',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['program_factuality', 'voice'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    ownerReview: {
      status: 'approved',
      idealAnswer: 'Your current estimated Back Squat 1RM is about 117 kg, based on 100 kg for 5 reps this week (Brzycki estimate). That’s up from roughly 111 kg off 95 kg for 5 last week.',
      correctionReason: null,
      approvedModel: 'gpt-5.6-terra',
      approvedPromptVersion: 'coach-lab-openai-v4-situation',
    },
  },
  {
    id: 's1-mas-pace',
    athleteMessage: 'what pace should i run my 4 min efforts at',
    source: 'coach-90-plan-slice-s1-2026-09-10',
    requiresLiveProgramFacts: true,
    reviewFocus: ['lfa_consistency', 'program_factuality', 'judgement_transparency'],
    // Sam, 2026-09-10: "approve all" on the S1 tapes (docs/COACH_LAB_S1_TAPES_2026-09-10.md).
    ownerReview: {
      status: 'approved',
      idealAnswer: 'For 4-minute efforts, use about 90–100% of your MAS: roughly 15.4–17.1 km/h from your measured 17.1 MAS. Start nearer 15.5–16 km/h and aim to hold the same pace across all reps rather than blasting the first one. You’ve recorded low energy today, so keep it controlled if you’re doing them today; if you fade badly, stop the hard work rather than forcing the pace.',
      correctionReason: null,
      approvedModel: 'gpt-5.6-terra',
      approvedPromptVersion: 'coach-lab-openai-v4-situation',
    },
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
    // R-397 (slice S1): the Lab athlete carries a season and a standing
    // pattern, so a phase-dependent answer can be held to a fact.
    situation: {
      season: {
        phase: 'In-season',
        subphase: null,
        phaseWeekNumber: 6,
        weekKind: 'build',
        blockNumber: 2,
        weekInBlock: 2,
        isDeloadWeek: false,
      },
      standing: {
        usualGameDay: 'Saturday',
        clubNights: ['Tuesday'],
        gymDays: ['Monday', 'Thursday'],
        sessionsPerWeek: 2,
        christmasBreak: null,
      },
      fixturesAhead: ['2026-09-05', '2026-09-12', '2026-09-19'],
      nextWeek: {
        weekStart: '2026-08-31',
        days: [
          day('2026-08-31', 'training', ['Lower Hinge']),
          day('2026-09-01', 'training', ['Team Training']),
          day('2026-09-02', 'rest', []),
          day('2026-09-03', 'training', ['Upper Pull', 'Conditioning']),
          day('2026-09-04', 'rest', []),
          day('2026-09-05', 'game', []),
          day('2026-09-06', 'rest', []),
        ],
        explanations: [],
      },
    },
    history: {
      readiness: options.readiness === 'not_recorded' ? [] : [{
        date: '2026-08-24',
        energy: 'low',
        soreness: 'moderate',
        source: 'quick_check',
        updatedAt: '2026-08-24T08:00:00.000Z',
      }],
      sessionOutcomes: [
        { date: '2026-08-20', completion: 'full', reason: null, feeling: 'good', components: [] },
        { date: '2026-08-22', completion: 'full', reason: null, feeling: 'hard', components: [] },
      ],
      recentChanges: [],
    },
    injuries: [],
    mas: { masKmh: 17.1, source: 'measured', seconds: 420 },
  });
}
