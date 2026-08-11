import { useState } from 'react';
import type { DayOfWeek, SeasonPhase } from '../types/domain';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { useRebuildNotice } from './useRebuildNotice';
import {
  beginRebuildNotice,
  clearRebuildNoticeError,
  endRebuildNotice,
  setRebuildNoticeError,
} from '../store/rebuildNoticeStore';
import { ownSeasonPhase } from '../rules/seasonPhaseOwner';
import { applyPhaseShift } from '../utils/profileMutations';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { classifyProgramMutationRefusal } from '../rules/programMutationRefusal';
import { todayISOLocal } from '../utils/appDate';
import { logger } from '../utils/logger';
import {
  NEXT_PHASE,
  WEEK_DAYS,
  type PhaseShiftStep,
} from '../screens/home/homeScreenConstants';
import { storedGameAnchor } from '../rules/gameAnchor';

/**
 * The one owner of the athlete's season-phase review flow.
 *
 * This logic used to live inside `useHomeScreen`, which made a working phase
 * change unreachable from My Status without copying it. The status move is an
 * ownership move, not a second implementation: the atomic transaction,
 * refusal handling, re-confirmed availability and game-anchor answer all moved
 * together.
 */
export function useSeasonPhaseControl() {
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const currentProgram = useProgramStore((s) => s.currentProgram);
  const ownedPhase = ownSeasonPhase({ program: currentProgram, profile: onboardingData });
  const currentPhase = (ownedPhase.phase ?? 'Pre-season') as SeasonPhase;
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<PhaseShiftStep>('confirm');
  const [targetPhase, setTargetPhase] = useState<SeasonPhase>(currentPhase);
  const [pendingPreferredDays, setPendingPreferredDays] = useState<DayOfWeek[]>([]);
  const [pendingTeamDays, setPendingTeamDays] = useState<DayOfWeek[]>([]);
  const [pendingGameDay, setPendingGameDay] = useState<DayOfWeek | null>(null);
  const [gameAnchorAnswered, setGameAnchorAnswered] = useState(false);
  const {
    isRebuilding,
    rebuildMsgIdx,
    rebuildMsgOpacity,
    rebuildError,
    rebuildErrorCanRetry,
  } = useRebuildNotice();

  const open = (target: SeasonPhase = currentPhase) => {
    clearRebuildNoticeError();
    setTargetPhase(target);
    setStep('confirm');
    setPendingPreferredDays(
      (onboardingData.preferredTrainingDays as DayOfWeek[]) || [],
    );
    setPendingTeamDays((onboardingData.teamTrainingDays as DayOfWeek[]) || []);
    const storedGameDay = storedGameAnchor(onboardingData);
    setPendingGameDay(storedGameDay);
    setGameAnchorAnswered(Boolean(storedGameDay));
    setVisible(true);
  };

  const selectTargetPhase = (target: SeasonPhase) => {
    clearRebuildNoticeError();
    setTargetPhase(target);
  };

  const close = () => {
    if (isRebuilding) return;
    setVisible(false);
    setStep('confirm');
    clearRebuildNoticeError();
  };

  const back = () => {
    if (isRebuilding) return;
    setStep((previous) => {
      if (previous === 'availability') return 'confirm';
      if (previous === 'teamDays') return 'availability';
      if (previous === 'gameDay') return 'teamDays';
      return previous;
    });
  };

  const togglePreferredDay = (day: DayOfWeek) => {
    setPendingPreferredDays((previous) => previous.includes(day)
      ? previous.filter((candidate) => candidate !== day)
      : [...previous, day]);
  };

  const toggleTeamDay = (day: DayOfWeek) => {
    setPendingTeamDays((previous) => previous.includes(day)
      ? previous.filter((candidate) => candidate !== day)
      : [...previous, day]);
  };

  const answerGameDay = (day: DayOfWeek) => {
    setPendingGameDay(day);
    setGameAnchorAnswered(true);
  };

  const answerNoGameDay = () => {
    setPendingGameDay(null);
    setGameAnchorAnswered(true);
  };

  const execute = async () => {
    beginRebuildNotice();
    setStep('building');
    const interactiveStep: PhaseShiftStep = targetPhase === 'In-season'
      ? 'gameDay'
      : targetPhase === 'Pre-season'
        ? 'teamDays'
        : 'availability';
    try {
      const nextProfile = applyPhaseShift(onboardingData, {
        targetPhase,
        preferredTrainingDays: pendingPreferredDays,
        teamTrainingDays: pendingTeamDays,
        gameAnchor: targetPhase === 'In-season' && gameAnchorAnswered
          ? (pendingGameDay
            ? { kind: 'usual_day', day: pendingGameDay }
            : { kind: 'no_usual_day' })
          : undefined,
      });
      const patch: Partial<typeof onboardingData> = {
        seasonPhase: nextProfile.seasonPhase,
        preferredTrainingDays: nextProfile.preferredTrainingDays,
        trainingDaysPerWeek: nextProfile.trainingDaysPerWeek,
        teamTrainingDays: nextProfile.teamTrainingDays,
        teamTrainingDaysPerWeek: nextProfile.teamTrainingDaysPerWeek,
        usualGameDay: nextProfile.usualGameDay,
        gameDay: nextProfile.gameDay,
      };
      const result = await commitProfileProgramTransaction({
        change: { kind: 'profile_setup', patch },
        todayISO: todayISOLocal(),
        sourceSurface: 'phase_shift',
      });
      if (!result.ok || !result.changedProgram) {
        const refusal = classifyProgramMutationRefusal({ reason: result.reason });
        logger.error('[PhaseShift] refused:', refusal.diagnostic ?? result.message);
        setRebuildNoticeError(refusal.userMessage, refusal.canRetry);
        setStep(interactiveStep);
        return;
      }
      setVisible(false);
      setStep('confirm');
    } catch (error: any) {
      const refusal = classifyProgramMutationRefusal({ error });
      logger.error('[PhaseShift] failed:', error?.diagnostic || error?.message || error);
      setRebuildNoticeError(refusal.userMessage, refusal.canRetry);
      setStep(interactiveStep);
    } finally {
      endRebuildNotice();
    }
  };

  const advance = async () => {
    if (step === 'confirm') {
      setStep('availability');
      return;
    }
    if (step === 'availability') {
      if (targetPhase === 'Off-season') await execute();
      else setStep('teamDays');
      return;
    }
    if (step === 'teamDays') {
      if (targetPhase === 'In-season') setStep('gameDay');
      else await execute();
      return;
    }
    if (step === 'gameDay' && gameAnchorAnswered) await execute();
  };

  return {
    currentPhase,
    nextPhase: NEXT_PHASE[currentPhase],
    visible,
    step,
    targetPhase,
    pendingPreferredDays,
    pendingTeamDays,
    pendingGameDay,
    gameAnchorAnswered,
    isRebuilding,
    error: rebuildError,
    canRetry: rebuildErrorCanRetry,
    msgIdx: rebuildMsgIdx,
    msgOpacity: rebuildMsgOpacity,
    open,
    close,
    back,
    togglePreferredDay,
    toggleTeamDay,
    answerGameDay,
    answerNoGameDay,
    selectTargetPhase,
    advance,
  };
}
